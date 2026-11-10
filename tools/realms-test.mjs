// Tests for 物理疆界图 (Realms of Physics): the content's integrity. Every link joins two existing nodes, every theory
// says where it works and where it breaks, every solved problem has a theory that explains it, and both languages are filled.
// Also the double-pendulum demo (pr-models.js): energy conservation at the page's RK4 step, the small-angle normal modes,
// the m2 → 0 limit and the exponential separation of two nearby starts.
//   node --test tools/realms-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/physics-realms/pr-data.js', import.meta.url), 'utf8'), box);
const D = box.window.MOLASTRIA_REALMS;
const nodes = [...D.theories, ...D.problems];
const ids = new Map(nodes.map((n) => [n.id, n]));
const both = (t, where) => { assert.ok(t && t.zh?.trim() && t.en?.trim(), `${where}: both languages`); assert.ok(!/[一-鿿]/.test(t.en), `${where}: no Chinese in the English text`); };

test('ids are unique and every node belongs to a known branch with a known status', () => {
  assert.equal(ids.size, nodes.length, 'unique ids');
  const branches = new Set(D.branches.map((b) => b.id));
  for (const t of D.theories) { assert.ok(branches.has(t.b), `${t.id}: branch`); assert.ok(D.status[t.st], `${t.id}: status`); }
  for (const p of D.problems) { assert.ok(branches.has(p.b), `${p.id}: branch`); assert.ok(D.pstatus[p.st], `${p.id}: status`); assert.ok(p.id.startsWith('p-'), `${p.id}: problem ids start with p-`); }
});

test('every theory states its domain and its frontier in both languages', () => {
  for (const t of D.theories) for (const k of ['name', 'gist', 'works', 'breaks']) both(t[k], `${t.id}.${k}`);
  for (const p of D.problems) for (const k of ['name', 'desc']) both(p[k], `${p.id}.${k}`);
  for (const b of D.branches) both(b.name, `branch ${b.id}`);
  for (const c of D.cube) { both(c.name, 'cube'); both(c.note, 'cube'); }
});

test('links join existing nodes, theory–theory links only between theories, and no duplicates', () => {
  const kinds = new Set(['explains', 'partial', 'fails', 'candidate', 'limit', 'builds', 'replaces']), seen = new Set();
  for (const l of D.links) {
    assert.ok(ids.has(l.a) && ids.has(l.b), `${l.a} → ${l.b}: both ends exist`);
    assert.ok(kinds.has(l.type), `${l.a} → ${l.b}: type ${l.type}`);
    const key = `${l.a}|${l.b}`; assert.ok(!seen.has(key), `${key}: duplicate`); seen.add(key);
    const tt = ['limit', 'builds', 'replaces'].includes(l.type);
    assert.equal(l.a.startsWith('p-'), false, `${key}: links start at a theory`);
    assert.equal(l.b.startsWith('p-'), !tt, `${key}: ${l.type} ends at a ${tt ? 'theory' : 'problem'}`);
    if (l.note) both(l.note, `${key} note`);
    if (l.type === 'limit') assert.ok(l.note, `${key}: a limit names its condition`);
  }
});

test('every node is connected; solved problems are explained, open ones are not', () => {
  const deg = new Map();
  for (const l of D.links) { deg.set(l.a, (deg.get(l.a) || 0) + 1); deg.set(l.b, (deg.get(l.b) || 0) + 1); }
  for (const n of nodes) assert.ok(deg.get(n.id), `${n.id}: connected`);
  for (const p of D.problems) {
    const explained = D.links.some((l) => l.b === p.id && l.type === 'explains');
    if (p.st === 'solved') assert.ok(explained, `${p.id}: a solved problem has an explaining theory`);
    if (p.st === 'open') assert.ok(D.links.some((l) => l.b === p.id && ['fails', 'partial', 'candidate'].includes(l.type)), `${p.id}: an open problem shows where theories stop`);
  }
  // Candidate theories never "explain" anything outright: they are not confirmed.
  for (const l of D.links) if (l.type === 'explains') assert.ok(!['candidate'].includes(ids.get(l.a).st), `${l.a} → ${l.b}: a candidate theory cannot explain`);
});

test('the limit graph has no cycles, so "reduces to" always points to a smaller theory', () => {
  const out = new Map();
  for (const l of D.links) if (l.type === 'limit') (out.get(l.a) || out.set(l.a, []).get(l.a)).push(l.b);
  const state = new Map();
  const visit = (v) => { assert.notEqual(state.get(v), 1, `cycle through ${v}`); if (state.get(v) === 2) return; state.set(v, 1); for (const w of out.get(v) || []) visit(w); state.set(v, 2); };
  for (const v of out.keys()) visit(v);
});

test('the ħ-c-G cube has its eight corners, each pointing at a node when it names one', () => {
  assert.equal(D.cube.length, 8);
  assert.equal(new Set(D.cube.map((c) => c.k.join(''))).size, 8, 'eight distinct corners');
  for (const c of D.cube) if (c.node) assert.ok(ids.has(c.node), `cube → ${c.node}`);
});

// ── 双摆演示（pr-models.js）：积分器诚实，小角度极限和 m₂ → 0 的极限都对 ─────────────────
const mbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/physics-realms/pr-models.js', import.meta.url), 'utf8'), mbox);
const PM = mbox.window.MOLASTRIA_REALMS_MODELS;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const deg = Math.PI / 180, H = 1 / 600; // the page integrates with RK4 at h = 1/600 s, ten steps per 60 Hz frame
// Times at which θ1 changes sign, linearly interpolated, until `count` crossings are seen.
const crossings = (y, p, count, check = () => {}) => {
  let t = 0, prev = y[0]; const out = [];
  while (out.length < count) { y = PM.rk4(y, H, p); t += H; if (prev > 0 !== y[0] > 0) out.push(t - H * y[0] / (y[0] - prev)); prev = y[0]; check(y); }
  return out;
};

test('double pendulum: RK4 at the page step conserves energy to 1e-6 of (m1+m2)gl1 + m2gl2 over 300 s of chaos', () => {
  const p = PM.DEFAULTS, scale = PM.energyScale(p);
  for (const [a, b] of [[120, -30], [150, 150], [179, 0], [90, 90]]) {
    let y = [a * deg, b * deg, 0, 0], worst = 0;
    const E0 = PM.energy(y, p);
    for (let i = 0; i < 300 / H; i++) { y = PM.rk4(y, H, p); worst = Math.max(worst, Math.abs(PM.energy(y, p) - E0)); }
    assert.ok(worst / scale < 1e-6, `start (${a}°, ${b}°): drift ${worst / scale}`);
  }
  // The error is at least fourth order: on a regular orbit, halving h cuts the drift over 10 s by more than 2⁴ = 16
  // (RK4's energy error on an oscillation shrinks like h⁵ per unit time, so the ratio is near 2⁵ = 32).
  const drift = (h) => { let y = [40 * deg, 20 * deg, 0, 0], w = 0; const E0 = PM.energy(y, p); for (let i = 0; i < Math.round(10 / h); i++) { y = PM.rk4(y, h, p); w = Math.max(w, Math.abs(PM.energy(y, p) - E0)); } return w; };
  const r = drift(1 / 100) / drift(1 / 200);
  assert.ok(r > 16 && r < 40, `at least fourth-order convergence: ratio ${r}`);
});

test('double pendulum: small-angle normal modes for equal masses and lengths are ω² = (g/l)(2 ∓ √2)', () => {
  const p = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 }, [slow, fast] = PM.normalModes(p);
  close(slow.omega2, p.g * (2 - Math.SQRT2), 1e-12, 'slow ω²');
  close(fast.omega2, p.g * (2 + Math.SQRT2), 1e-12, 'fast ω²');
  close(slow.shape, Math.SQRT2, 1e-12, 'slow mode in phase, θ2 = √2 θ1');
  close(fast.shape, -Math.SQRT2, 1e-12, 'fast mode out of phase, θ2 = −√2 θ1');
  const q = { m1: 2, m2: 0.5, l1: 0.7, l2: 1.3, g: 3 }, [qa, qb] = PM.normalModes(q);
  close(qa.omega2 * qb.omega2, (q.m1 + q.m2) * q.g * q.g / (q.m1 * q.l1 * q.l2), 1e-9, 'product of the ω² is det K / det M');
  // The integrator agrees: started in either mode at 0.1°, the motion stays in that mode and θ1 changes sign at the mode frequency.
  for (const [name, m] of [['slow', slow], ['fast', fast]]) {
    const e = 0.1 * deg, period = 2 * Math.PI / Math.sqrt(m.omega2);
    const c = crossings([e, m.shape * e, 0, 0], p, 6, (y) => assert.ok(Math.abs(y[1] - m.shape * y[0]) < 1e-3 * e, `${name}: stays in the mode`));
    close((c[5] - c[1]) / 2, period, 2e-5 * period, `${name}: period 2π/ω`);
  }
});

test('double pendulum: the equations reduce to the simple pendulum θ̈ = −(g/l) sin θ when m2 → 0', () => {
  for (const th of [0.3, 1.2, 2.8, -2]) for (const [t2, w1, w2] of [[0, 0, 0], [1, 0.5, -2], [-2.5, -1, 3]]) {
    const a1 = PM.deriv([th, t2, w1, w2], { m1: 1, m2: 1e-12, l1: 0.8, l2: 1, g: 9.81 })[2];
    close(a1, -(9.81 / 0.8) * Math.sin(th), 1e-9, `θ = ${th}, θ2 = ${t2}`);
  }
  // …and the upper bob then swings with the exact large-amplitude period T = 2π / (√(g/l) · AGM(1, cos(θ0/2))).
  const th0 = 2, p = { m1: 1, m2: 1e-12, l1: 1, l2: 1, g: 9.81 };
  let a = 1, b = Math.cos(th0 / 2);
  for (let i = 0; i < 30; i++) [a, b] = [(a + b) / 2, Math.sqrt(a * b)];
  const exact = 2 * Math.PI / (Math.sqrt(p.g / p.l1) * a), c = crossings([th0, 0, 0, 0], p, 3);
  close(c[2] - c[0], exact, 1e-6 * exact, 'period of the simple pendulum from θ0 = 2 rad (about 2.4 times the small-angle period)');
});

test('double pendulum: two starts 1e-6 rad apart separate exponentially, then saturate', () => {
  const p = PM.DEFAULTS;
  let a = [120 * deg, -30 * deg, 0, 0], b = [120 * deg + 1e-6, -30 * deg, 0, 0];
  close(PM.separation(a, b), 1e-6, 1e-15, 'initial separation');
  close(PM.separation([Math.PI - 0.01, 0, 0, 0], [-Math.PI + 0.01, 0, 0, 0]), 0.02, 1e-12, 'angles wrap around ±π');
  let hit = null, big = 0;
  for (let i = 0; i < 60 / H; i++) { a = PM.rk4(a, H, p); b = PM.rk4(b, H, p); const d = PM.separation(a, b); if (hit === null && d > 0.1) hit = i * H; big = Math.max(big, d); }
  assert.ok(hit !== null && hit > 3 && hit < 30, `grows by 10⁵ within a few tens of seconds: ${hit}`);
  assert.ok(big > 1 && big <= Math.PI * Math.SQRT2 + 1e-9, `saturates at order one radian: ${big}`);
  assert.deepEqual([...PM.positions([0, 0], { l1: 1, l2: 2 })], [0, -1, 0, -3], 'hanging straight down');
});
