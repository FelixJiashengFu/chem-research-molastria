// Tests for the Fundamental Science section: the demo models against known analytic results, and the content's integrity
// (every status, formula, reference id and pillar link resolves).   node --test tools/fundamental-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import './fm-prob-test.mjs'; // 数学子模块概率论演示的数学，随这个文件一起在 CI 里跑

const load = (file) => { const box = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/fundamental-science/${file}`, import.meta.url), 'utf8'), box); return box.window; };
const M = load('fs-models.js').MOLASTRIA_FS_MODELS;
const D = load('fs-data.js').MOLASTRIA_FS;
const MATH = load('fs-math.js').MOLASTRIA_FS_MATH;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('GRW: the hit density is normalised and a hit far from both peaks is improbable', () => {
  const x = M.grid(1500, 1201), dx = x[1] - x[0];
  const psi = M.doublePeak(x, 400, 40);
  close(psi.reduce((s, v) => s + v * v, 0) * dx, 1, 1e-9, 'ψ normalised');
  const p = M.hitDensity(x, psi, 100);
  close(p.reduce((s, v) => s + v, 0) * dx, 1, 2e-3, '∫p(x0)dx0 = 1');
  const at = (v) => p[Math.round((v + 1500) / dx)];
  assert.ok(at(400) > 50 * at(0), 'hits land near the peaks');
  close(M.weightLeft(x, psi), 0.5, 1e-6, 'symmetric superposition');
});

test('GRW: a hit on one peak removes the other when the peaks are farther apart than r_C', () => {
  const x = M.grid(1500, 1201);
  const after = M.afterHit(x, M.doublePeak(x, 400, 40), 400, 100);
  assert.ok(M.weightLeft(x, after) < 1e-6, 'left peak gone');
  const near = M.afterHit(x, M.doublePeak(x, 30, 40), 30, 100); // peaks closer than r_C: barely changed
  assert.ok(M.weightLeft(x, near) > 0.3, 'close peaks survive');
  close(M.coherenceAfterHit(100, 100), Math.exp(-1), 1e-15, 'e^{-a²/r_C²}');
});

test('two-level system: analytic solution satisfies z″ + γz′ + ω²z = 0 in every regime', () => {
  const w = 1;
  for (const g of [0, 0.3, 2, 7]) {
    const h = 1e-4;
    for (const t of [0.3, 1.7, 4.2]) {
      const z = M.zOf(t, w, g), zp = (M.zOf(t + h, w, g) - M.zOf(t - h, w, g)) / (2 * h);
      const zpp = (M.zOf(t + h, w, g) - 2 * z + M.zOf(t - h, w, g)) / (h * h);
      close(zpp + g * zp + w * w * z, 0, 1e-5, `ODE residual γ=${g}, t=${t}`);
    }
    close(M.zOf(0, w, g), 1, 1e-12, 'z(0) = 1');
    close((M.zOf(1e-6, w, g) - M.zOf(0, w, g)) / 1e-6, 0, 1e-5, "z'(0) = 0");
  }
  close(M.pLeft(Math.PI, 1, 0), 0, 1e-12, 'isolated: full transfer after half a period');
  // ammonia: 0.79 cm⁻¹ → period ≈ 42 ps
  close(2 * Math.PI / M.omegaFromWavenumber(0.7934) * 1e12, 42.04, 0.05, 'NH₃ inversion period (ps)');
});

test('CSL rate: quadratic for d ≪ r_C and saturating at λ(m/m0)² for d ≫ r_C', () => {
  close(M.cslRate(1e-16, 17, 1e-5, 1e-7), 1e-16 * 289, 1e-20, 'saturated');
  const small = M.cslRate(1e-16, 17, 0.76e-10, 1e-7);
  close(small, 1e-16 * 289 * (0.76e-10) ** 2 / (4e-14), small * 1e-6, 'quadratic regime');
});

test('Berry phase: π around a real conical intersection, 0 outside it, Ω/2 when the degeneracy is lifted', () => {
  const p = { kappa: 1, lam: 1, delta: 0, k: 1 };
  close(Math.abs(M.berryPhase(M.loop(0, 0, 0.5, 400), p)), Math.PI, 1e-9, 'encloses CI');
  close(M.berryPhase(M.loop(1, 0, 0.5, 400), p), 0, 1e-9, 'misses CI');
  close(Math.abs(M.berryPhase(M.loop(0.2, -0.1, 0.6, 400), { ...p, kappa: 1.7, lam: 0.6 })), Math.PI, 1e-9, 'anisotropic, off-centre');
  for (const delta of [0.1, 0.4, 1.5]) {
    const g = Math.abs(M.berryPhase(M.loop(0, 0, 0.5, 2000), { ...p, delta }));
    close(g, M.solidAngleCentred(1, 0.5, delta) / 2, 2e-5, `Δ=${delta}`);
  }
  const tr = M.transport(M.loop(0, 0, 0.5, 400), p);
  const a = tr[0], b = tr[tr.length - 1];
  close(a[0] * b[0] + a[2] * b[2], -1, 1e-9, 'real eigenvector returns with its sign flipped');
});

test('FCI dimension: exact binomials', () => {
  assert.equal(M.binom(40, 10), 847660528n);
  assert.equal(M.binom(4, 2), 6n);
  const f = M.fci(20, 10);
  assert.equal(f.all, 184756n);
  assert.equal(f.sz, 252n * 252n);
});

test('content: every status, formula, reference and pillar link resolves', () => {
  const ids = new Set(D.refs.map((r) => r.id));
  assert.equal(ids.size, D.refs.length, 'reference ids are unique');
  const statuses = new Set(Object.keys(D.status));
  for (const r of D.refs) {
    assert.ok(statuses.has(r.status), r.id);
    assert.match(r.doi, /^10\.\d{4,}\/\S+$/, r.id);
    assert.ok(D.areas[r.area], `${r.id} area`);
  }
  const seenMath = new Set();
  for (const s of D.sections) {
    for (const [key] of s.formulas) { assert.ok(D.math[key] && MATH[key]?.startsWith('<math'), `${s.id}: formula ${key}`); seenMath.add(key); }
    for (const [st, , , refs = []] of s.topics) { assert.ok(statuses.has(st), `${s.id} status ${st}`); for (const r of refs) assert.ok(ids.has(r), `${s.id} cites ${r}`); }
    for (const r of s.refs) assert.ok(ids.has(r), `${s.id} cites ${r}`);
    for (const pair of [s.title, s.intro, ...s.topics.flatMap(([, a, b]) => [a, b])]) assert.ok(pair.zh && pair.en, `${s.id}: both languages`);
  }
  for (const key of ['fci', 'grwHit', 'twoLevel', 'ci', 'cslRate']) assert.ok(MATH[key], key);
  for (const t of D.theories) { assert.ok(D.kinds[t.kind], t.id); for (const r of t.refs) assert.ok(ids.has(r), `${t.id} cites ${r}`); }
  for (const p of D.pillars) assert.ok(D.sections.some((s) => s.id === p.id), `pillar ${p.id}`);
  for (const d of D.directions) { assert.ok(D.sections.some((s) => s.id === d.pillar), d.id); assert.equal(Object.keys(d.fields).length, 6, d.id); }
  // Proposed directions never claim results.
  for (const d of D.directions) assert.match(d.fields.status.zh, /计划方向/);
  assert.deepEqual(Object.keys(MATH).sort(), Object.keys(D.math).sort(), 'fs-math.js is up to date: run node tools/fundamental-math.mjs');
});

// ── 数学基础与探索（math/）：内容完整、引用都能对上 ─────────────────────────
const FM = load('math/fm-data.js').MOLASTRIA_FM;
const FM_MATH = load('math/fm-math.js').MOLASTRIA_FM_MATH;
const both = (t, where) => { assert.ok(t && t.zh && t.en, `${where}: needs zh and en`); assert.ok(!/[㐀-鿿]/.test(t.en), `${where}: Chinese left in the English text`); };

test('math module: ten subjects in three tiers, each complete in both languages', () => {
  assert.equal(FM.subjects.length, 10);
  assert.deepEqual([...new Set(FM.subjects.map((s) => s.tier))].sort(), [1, 2, 3]);
  assert.equal(new Set(FM.subjects.map((s) => s.id)).size, 10, 'unique ids');
  for (const s of FM.subjects) {
    for (const k of ['name', 'tagline']) both(s[k], `${s.id}.${k}`);
    assert.ok(s.explain.length >= 3, `${s.id}: at least three explanation paragraphs`);
    s.explain.forEach((p, i) => both(p, `${s.id}.explain[${i}]`));
    assert.ok(s.outline.length >= 5, `${s.id}: outline`);
    for (const [t, w] of s.outline) { both(t, `${s.id}.outline`); assert.match(w, /^\d+(–\d+)?$/); }
    for (const k of ['inQC', 'checks', 'pitfalls']) { assert.ok(s[k].length >= 2, `${s.id}.${k}`); s[k].forEach((t) => both(t, `${s.id}.${k}`)); }
    both(s.practice.title, `${s.id}.practice.title`); both(s.practice.body, `${s.id}.practice.body`);
    assert.ok(s.practice.code.length > 40, `${s.id}: practice code`);
    assert.ok(s.books.length >= 4, `${s.id}: at least four books`);
  }
});

test('math module: every formula, book, video and relation resolves', () => {
  const books = new Map(FM.books.map((b) => [b.id, b])), videos = new Map(FM.videos.map((v) => [v.id, v]));
  assert.equal(books.size, FM.books.length, 'unique book ids');
  assert.equal(videos.size, FM.videos.length, 'unique video ids');
  const ids = new Set(FM.subjects.map((s) => s.id)), targets = new Set(FM.targets.map((t) => t.id));
  for (const s of FM.subjects) {
    for (const f of s.formulas) { assert.ok(FM.math[f], `${s.id}: formula ${f}`); assert.match(FM_MATH[f] || '', /^<math[\s\S]*<\/math>$/, `MathML for ${f} (run node tools/fundamental-math.mjs)`); }
    for (const b of s.books) assert.ok(books.has(b), `${s.id}: book ${b}`);
    for (const v of s.videos) assert.ok(videos.has(v), `${s.id}: video ${v}`);
  }
  assert.deepEqual(Object.keys(FM.math).sort(), Object.keys(FM_MATH).sort(), 'fm-math.js matches fm-data.js');
  for (const b of FM.books) assert.ok(FM.subjects.find((s) => s.id === b.subj).books.includes(b.id), `${b.id} is listed under its subject`);
  for (const b of FM.books) {
    assert.ok(ids.has(b.subj), `${b.id}: subject`);
    assert.ok(FM.roles[b.role] && FM.levels[b.level], `${b.id}: role and level`);
    both(b.note, `${b.id}.note`);
    if (b.doi) assert.match(b.doi, /^10\.\d{4,9}\/\S+$/, `${b.id}: DOI`);
    if (b.free) assert.match(b.url || '', /^https:\/\//, `${b.id}: a free book links to where it is free`);
    if (b.role !== 'zh') assert.ok(b.doi || b.year, `${b.id}: DOI or year`);
  }
  const host = { yt: /^https:\/\/www\.youtube\.com\//, bili: /^https:\/\/www\.bilibili\.com\/video\/BV\w+\/$/, ocw: /^https:\/\/ocw\.mit\.edu\/courses\/[\w-]+\/$/, web: /^https:\/\// };
  for (const v of FM.videos) { assert.match(v.url, host[v.p], `${v.id}: url matches platform`); both(v.note, `${v.id}.note`); assert.ok(FM.levels[v.level], `${v.id}: level`); }
  for (const [a, b, t] of FM.relations) { assert.ok(ids.has(a), `relation from ${a}`); assert.ok(ids.has(b) || targets.has(b), `relation to ${b}`); both(t, `relation ${a}→${b}`); }
  for (const id of ids) assert.ok(FM.relations.some(([a, b]) => a === id || b === id), `${id} appears on the map`);
  for (const t of FM.tracks) { both(t.name, t.id); for (const p of t.phases) { both(p.goal, `${t.id} phase`); for (const s of p.subjects) assert.ok(ids.has(s), `${t.id}: ${s}`); } }
  for (const t of FM.tracks.filter((x) => x.id === 'math')) assert.deepEqual([...new Set(t.phases.flatMap((p) => p.subjects))].sort(), [...ids].sort(), 'the mathematical-physics track covers every subject');
  for (const h of FM.hall) { both(h.title, `Hall ${h.ch}`); for (const s of h.subj) assert.ok(ids.has(s), `Hall ${h.ch}: ${s}`); }
});

test('math module: the worked numbers in the exercises are right', () => {
  // Helium, ψ ∝ e^{-ζ(r1+r2)}: E(ζ) = ζ² − 27ζ/8 is smallest at ζ = 27/16 with E = −(27/16)² = −2.84765625 Eh.
  const E = (z) => z * z - 27 * z / 8;
  close(E(27 / 16), -2.84765625, 1e-12, 'E(27/16)');
  assert.ok(E(27 / 16) < E(27 / 16 + 1e-3) && E(27 / 16) < E(27 / 16 - 1e-3), 'minimum');
  assert.match(FM.math.varHe[0], /2\.8477/);
  // Benzene Hückel (α = 0, β = −1): the circulant eigenvalues −2cos(2πk/6) are −2, −1, −1, 1, 1, 2.
  const ev = [0, 1, 2, 3, 4, 5].map((k) => Math.round(-2 * Math.cos(2 * Math.PI * k / 6) * 1e9) / 1e9).sort((a, b) => a - b);
  assert.deepEqual(ev, [-2, -1, -1, 1, 1, 2]);
  // Water, C2v, molecule in the yz plane: Γ3N = (9, −1, 1, 3) reduces to 3A1 + A2 + 2B1 + 3B2; minus translations
  // (A1 + B1 + B2) and rotations (A2 + B1 + B2) leaves 2A1 + B2.
  const chi = [[1, 1, 1, 1], [1, 1, -1, -1], [1, -1, 1, -1], [1, -1, -1, 1]], g = [9, -1, 1, 3];
  const n = chi.map((r) => r.reduce((s, c, i) => s + c * g[i], 0) / 4);
  assert.deepEqual(n, [3, 1, 2, 3]);
  assert.deepEqual(n.map((x, i) => x - [1, 0, 1, 1][i] - [0, 1, 1, 1][i]), [2, 0, 0, 1]);
});
