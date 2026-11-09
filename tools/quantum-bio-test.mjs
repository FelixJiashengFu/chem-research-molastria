// Tests for the Quantum Biology section: the three demo models against analytic results and independent time
// integration, and the content's integrity (statuses, formulas, references, links, both languages).
//   node --test tools/quantum-bio-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const load = (file) => { const box = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/quantum/biology/${file}`, import.meta.url), 'utf8'), box); return box.window; };
const M = load('qb-models.js').MOLASTRIA_QB_MODELS;
const D = load('qb-data.js').MOLASTRIA_QB;
const MATH = load('qb-math.js').MOLASTRIA_QB_MATH;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// ── 演示 1：FMO ───────────────────────────────────────────────────────────
test('FMO: the Hamiltonian is symmetric and the efficiency and losses add up to one', () => {
  for (let a = 0; a < 7; a++) for (let b = 0; b < 7; b++) assert.equal(M.FMO[a][b], M.FMO[b][a]);
  close(M.CM_TO_RADPS, 0.188365, 1e-6, '1 cm⁻¹ in rad/ps');
  const H = M.fmoH();
  for (const gamma of [0, 0.3, 30, 3e3]) {
    const r = M.transfer(H, { gamma, kappa: 1, loss: 1e-3, trap: 2, start: 0 });
    close(r.efficiency + r.lost, 1, 1e-9, `γ = ${gamma}`);
    assert.ok(r.efficiency > 0 && r.efficiency < 1);
  }
});

test('FMO: the linear-solve efficiency agrees with explicit time evolution', () => {
  const H = M.fmoH();
  for (const gamma of [0.5, 20, 5e3]) {
    const o = { gamma, kappa: 1, loss: 1e-3, trap: 2, start: 0 }, eta = M.transfer(H, o).efficiency;
    const ev = M.evolve(H, o, 1500, 15000), last = ev[ev.length - 1];
    close(last.trapped, eta, 2e-3, `γ = ${gamma}`);
    close(last.pop.reduce((s, v) => s + v, 0), 0, 1e-3, 'nothing left after 1.5 ns');
  }
});

test('FMO: dephasing helps, then hinders (environment-assisted transport and the Zeno effect)', () => {
  const H = M.fmoH(), eta = (gamma) => M.transfer(H, { gamma, kappa: 1, loss: 1e-3, trap: 2, start: 0 }).efficiency;
  const coherent = eta(0), mid = eta(30), zeno = eta(1e5);
  assert.ok(mid > coherent + 0.05, `moderate dephasing beats coherent transport (${mid} vs ${coherent})`);
  assert.ok(zeno < mid - 0.1, `strong dephasing slows transfer again (${zeno})`);
});

test('two-site check: an isolated degenerate dimer oscillates as cos²(Jt)', () => {
  const J = 2, H = [[0, J], [J, 0]];
  const ev = M.evolve(H, { gamma: 0, kappa: 0, loss: 0, trap: 1, start: 0 }, 3, 300);
  for (const p of ev) close(p.pop[0], Math.cos(J * p.t) ** 2, 1e-9, `t = ${p.t}`);
  // Haken–Strobl dimer: populations obey the damped two-level equation; long-time limit 1/2 each
  const ev2 = M.evolve(H, { gamma: 3, kappa: 0, loss: 0, trap: 1, start: 0 }, 40, 400);
  close(ev2[ev2.length - 1].pop[0], 0.5, 1e-6, 'equal populations');
});

// ── 演示 2：自由基对 ──────────────────────────────────────────────────────
const earth = { B: 50, theta: 0.4, ax: 0, ay: 0, az: 1, k: 1 };
test('radical pair: limits that must hold exactly', () => {
  close(M.singletYield({ B: 0, theta: 0, ax: 0, ay: 0, az: 0, k: 1 }), 1, 1e-12, 'no field, no hyperfine: stays singlet');
  close(M.singletYield({ ...earth, k: 1e7 }), 1, 1e-6, 'instant reaction: all singlet');
  // isotropic hyperfine: no direction dependence
  const iso = (th) => M.singletYield({ ...earth, ax: 0.8, ay: 0.8, az: 0.8, theta: th });
  close(iso(0), iso(1.1), 1e-12, 'isotropic coupling');
  // B → −B (θ → π − θ) leaves the yield unchanged: an inclination compass
  for (const th of [0.2, 0.7, 1.3]) close(M.singletYield({ ...earth, theta: th }), M.singletYield({ ...earth, theta: Math.PI - th }), 1e-12, `θ = ${th}`);
  // P_S is a projector with trace 2 (one singlet × two nuclear states)
  const P = M.singletProjector();
  close(P.reduce((s, r, i) => s + r[i], 0), 2, 1e-12, 'Tr P_S');
});

test('radical pair: the eigen formula equals direct time integration and an anisotropic coupling gives a compass', () => {
  for (const p of [earth, { ...earth, B: 120, theta: 1.1, ax: 0.3, ay: 0.3 }]) close(M.singletYieldTime(p, 40, 200000), M.singletYield(p), 1e-6, 'time integral');
  const curve = M.yieldCurve(earth, 37).map((q) => q[1]);
  assert.ok(Math.max(...curve) - Math.min(...curve) > 0.1, 'clear anisotropy at 50 μT with a 1 μs lifetime');
  const short = M.yieldCurve({ ...earth, k: 100 }, 37).map((q) => q[1]);
  assert.ok(Math.max(...short) - Math.min(...short) < 0.01, 'a 10 ns pair barely feels the Earth field');
  // Jacobi: eigenvectors are orthonormal and diagonalize H
  const H = M.rpHamiltonian(earth), { w, V } = M.jacobi(H);
  for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) {
    let dot = 0, hij = 0;
    for (let k = 0; k < 8; k++) { dot += V[k][i] * V[k][j]; for (let l = 0; l < 8; l++) hij += V[k][i] * H[k][l] * V[l][j]; }
    close(dot, i === j ? 1 : 0, 1e-10, 'orthonormal'); close(hij, i === j ? w[i] : 0, 1e-8, 'diagonal');
  }
});

// ── 演示 3：隧穿与同位素效应 ──────────────────────────────────────────────
test('Bell tunnelling: high-barrier limit equals (u/2)/sin(u/2); no tunnelling for a flat barrier', () => {
  for (const nu of [300, 800, 1000]) { const hnu = nu * M.CM_TO_KJ; close(M.tunnelQ(150, hnu, 298), M.bellInfinite(hnu, 298), 1e-6, `ν‡ = ${nu}`); }
  close(M.tunnelQ(60, 1e-3, 298), 1, 3e-3, 'ν‡ → 0: classical (a step on the integration grid)');
  close(M.transmission(10, 10, 5), 0.5, 1e-15, 'P = 1/2 at the barrier top');
});

test('isotope effect: zero-point value without tunnelling, larger with it, Arrhenius signatures', () => {
  const p = { V0: 60, nuCH: 2900, nuBarrier: 1000, T: 298 };
  const semi = M.isotope({ ...p, tunnel: false });
  close(semi.kie, Math.exp((0.5 * 2900 * (1 - Math.SQRT1_2) * M.CM_TO_KJ) / (M.R * 298)), 1e-9, 'k_H/k_D from zero-point energy');
  close(semi.kie, 7.77, 0.05, 'about 7 for C–H at room temperature');
  const q = M.isotope(p);
  assert.ok(q.H.Q > q.D.Q && q.D.Q > 1, 'H tunnels more than D');
  assert.ok(q.kie > semi.kie, 'tunnelling raises the isotope effect');
  const a = M.arrhenius(p), s = M.arrhenius({ ...p, tunnel: false });
  close(s.ratioA, 1, 1e-9, 'semiclassical A_H/A_D = 1');
  close(s.dEa, 0.5 * 2900 * (1 - Math.SQRT1_2) * M.CM_TO_KJ, 1e-6, 'semiclassical ΔEa = ΔZPE');
  assert.ok(a.ratioA < 0.7 && a.dEa > s.dEa, 'tunnelling signature: A_H/A_D < 0.7 and enlarged ΔEa');
  const hot = M.isotope({ ...p, T: 340 }).kie, cold = M.isotope({ ...p, T: 260 }).kie;
  assert.ok(hot < cold, 'in the Bell model the isotope effect always falls with temperature');
});

// ── 内容 ──────────────────────────────────────────────────────────────────
const both = (t, where) => { assert.ok(t && t.zh && t.en, `${where}: needs zh and en`); assert.ok(!/[㐀-鿿]/.test(t.en), `${where}: Chinese left in the English text`); };
test('content: every status, formula, reference and link resolves, in both languages', () => {
  const ids = new Set(D.refs.map((r) => r.id));
  assert.equal(ids.size, D.refs.length, 'reference ids are unique');
  assert.ok(D.refs.length >= 50, 'at least 50 references');
  const statuses = new Set(Object.keys(D.status));
  assert.deepEqual([...statuses], ['established', 'active', 'contested', 'hypothesis']);
  for (const r of D.refs) {
    assert.ok(statuses.has(r.status), r.id);
    assert.match(r.doi, /^10\.\d{4,}\/\S+$/, r.id);
    assert.ok(D.areas[r.area], `${r.id} area`);
    assert.ok(r.title && r.authors && r.journal && r.vol && r.pages && r.year > 1900, `${r.id} complete`);
  }
  const cited = new Set();
  for (const s of D.sections) {
    for (const [key, cap] of s.formulas) { assert.ok(D.math[key] && MATH[key]?.startsWith('<math'), `${s.id}: formula ${key}`); both(cap, `${s.id}.${key}`); }
    for (const [st, a, b, refs = []] of s.topics) { assert.ok(statuses.has(st), `${s.id} status ${st}`); both(a, s.id); both(b, s.id); for (const r of refs) { assert.ok(ids.has(r), `${s.id} cites ${r}`); cited.add(r); } }
    for (const r of s.refs) { assert.ok(ids.has(r), `${s.id} cites ${r}`); cited.add(r); }
    for (const [q, a] of s.questions) { both(q, s.id); both(a, s.id); }
    both(s.title, s.id); both(s.intro, s.id);
    assert.ok(D.pillars.some((p) => p.id === s.id), `${s.id} has a pillar card`);
  }
  for (const c of D.ledger) { assert.ok(statuses.has(c.status) && D.sections.some((s) => s.id === c.section), c.id); for (const r of c.refs) { assert.ok(ids.has(r), `${c.id} cites ${r}`); cited.add(r); } both(c.claim, c.id); both(c.evidence, c.id); both(c.caveat, c.id); }
  for (const [st, area, q] of D.openQuestions) { assert.ok(statuses.has(st) && D.sections.some((s) => s.id === area), area); both(q, 'open question'); }
  for (const k of ['enaqt', 'compass', 'kie']) { both(D.demos[k].intro, k); both(D.demos[k].notes, k); }
  for (const key of ['hakenStrobl', 'yield', 'bellP']) assert.ok(MATH[key], `demo formula ${key}`);
  // reviews are listed in the library without being cited by a section; everything else is cited somewhere
  for (const r of D.refs) if (r.area !== 'review') assert.ok(cited.has(r.id), `${r.id} is cited`);
  // learning-path links point at pages that exist
  for (const p of D.path) for (const [href, label] of p.links) { both(label, href); assert.ok(existsSync(new URL(`../public/${href.split('#')[0]}`, import.meta.url)), href); }
  assert.deepEqual(Object.keys(MATH).sort(), Object.keys(D.math).sort(), 'qb-math.js is up to date: run node tools/fundamental-math.mjs');
});
