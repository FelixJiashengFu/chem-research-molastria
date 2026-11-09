// Tests for the Quantum Computers pavilion (/quantum/computing/): the three demo models against analytic results,
// and the content's integrity (statuses, formulas, references, links, both languages).
//   node --test tools/quantum-computing-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const load = (file) => { const box = { window: {} }; vm.runInNewContext(readFileSync(new URL(`../public/quantum/computing/${file}`, import.meta.url), 'utf8'), box); return box.window; };
const M = load('qc-models.js').MOLASTRIA_QC_MODELS;
const D = load('qc-data.js').MOLASTRIA_QC;
const MATH = load('qc-math.js').MOLASTRIA_QC_MATH;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

// ── 演示 1：Bloch 方程 ────────────────────────────────────────────────────
test('Bloch equations: undamped evolution follows the generalised Rabi formula', () => {
  for (const [omega, delta] of [[5, 0], [5, 3], [2, -7], [12, 12]]) {
    const tr = M.bloch({ omega, delta }, 1.3, 260);
    for (const q of tr.filter((_, i) => i % 13 === 0)) close(q.p1, M.rabiP1(omega, delta, q.t), 1e-6, `Ω = ${omega}, Δ = ${delta}, t = ${q.t}`);
    const last = tr[tr.length - 1];
    close(Math.hypot(last.x, last.y, last.z), 1, 1e-6, 'pure states stay on the sphere');
  }
  close(M.rabiP1(5, 0, M.piTime(5)), 1, 1e-12, 'a π pulse flips |0⟩ to |1⟩');
  close(M.rabiP1(5, 5, 10), M.rabiP1(5, 5, 10), 0, 'deterministic');
  assert.ok(Math.max(...Array.from({ length: 400 }, (_, i) => M.rabiP1(4, 4, i / 100))) <= 0.5 + 1e-12, 'Δ = Ω flips at most 50 %');
});

test('Bloch equations: damping drives the state to the analytic steady state, T1 relaxes, T2 dephases', () => {
  for (const p of [{ omega: 2, delta: 1, T1: 1, T2: 0.8 }, { omega: 0.5, delta: 0, T1: 3, T2: 6 }]) {
    const tr = M.bloch(p, 60, 600), last = tr[tr.length - 1];
    close(last.z, M.steadyZ(p), 1e-6, 'steady-state z');
    assert.ok(last.p1 <= 0.5, 'a driven, damped qubit never inverts in steady state');
  }
  // free decay from |1⟩: z(t) = 1 − 2 e^{−t/T1}
  const T1 = 2, tr = M.bloch({ omega: 0, delta: 0, T1, T2: 2 * T1 }, 3, 300, [0, 0, -1]);
  for (const q of tr.filter((_, i) => i % 50 === 0)) close(q.z, 1 - 2 * Math.exp(-q.t / T1), 1e-7, `T1 decay at t = ${q.t}`);
  // free precession from |+⟩ with detuning: transverse length decays as e^{−t/T2}
  const T2 = 0.7, ram = M.bloch({ omega: 0, delta: 3, T1: Infinity, T2 }, 2, 200, [1, 0, 0]);
  for (const q of ram.filter((_, i) => i % 40 === 0)) close(Math.hypot(q.x, q.y), Math.exp(-q.t / T2), 1e-7, `T2 decay at t = ${q.t}`);
  assert.ok(M.piFidelity({ omega: 5, delta: 0, T1: 10, T2: 4 }) > 0.98 && M.piFidelity({ omega: 5, delta: 0, T1: 0.05, T2: 0.05 }) < 0.8, 'short-lived qubits flip badly');
});

// ── 演示 2：电路保真度 ────────────────────────────────────────────────────
test('circuit budget: gate counts, product of fidelities, and the depth limit', () => {
  assert.deepEqual({ ...M.gateCounts(53, 20) }, { g1: 1060, g2: 520, meas: 53 });
  const p = { n: 53, depth: 20, e1: 0.0016, e2: 0.0062, em: 0.038 }, r = M.circuitFidelity(p);
  close(r.F, 0.9984 ** 1060 * 0.9938 ** 520 * 0.962 ** 53, 1e-15, 'product of success probabilities');
  close(r.log10F, Math.log10(r.F), 1e-12, 'log10F');
  const gates = { ...p, em: 0 }, d = M.maxDepth(gates);
  assert.ok(M.circuitFidelity({ ...gates, depth: d }).F >= 0.5 && M.circuitFidelity({ ...gates, depth: d + 1 }).F < 0.5, 'maxDepth is the last depth with F ≥ 1/2');
  assert.equal(M.maxDepth({ n: 4, e1: 0, e2: 0, em: 0 }), Infinity);
  const sq = M.maxSquare({ e1: 1e-3, e2: 1e-3, em: 0 });
  assert.ok(M.circuitFidelity({ n: sq, depth: sq, e1: 1e-3, e2: 1e-3, em: 0 }).F >= 0.5 && M.circuitFidelity({ n: sq + 1, depth: sq + 1, e1: 1e-3, e2: 1e-3, em: 0 }).F < 0.5, 'maxSquare');
});

// ── 演示 3：纠错 ──────────────────────────────────────────────────────────
test('repetition code: exact formula, symmetry at p = 1/2, and Monte Carlo agreement', () => {
  close(M.repetitionPL(1, 0.2), 0.2, 1e-15, 'd = 1 is the bare bit');
  close(M.repetitionPL(3, 0.1), 3 * 0.01 * 0.9 + 0.001, 1e-15, 'd = 3');
  close(M.repetitionPL(5, 0.5), 0.5, 1e-12, 'p = 1/2 stays 1/2');
  assert.ok(M.repetitionPL(7, 0.1) < M.repetitionPL(5, 0.1) && M.repetitionPL(7, 0.6) > M.repetitionPL(5, 0.6), 'threshold at 1/2');
  close(M.binom(10, 3), 120, 1e-9, 'binomial');
  for (const [d, p] of [[3, 0.1], [7, 0.2], [11, 0.3]]) {
    const exact = M.repetitionPL(d, p), shots = 40000, mc = M.repetitionMC(d, p, shots, 11);
    close(mc, exact, 5 * Math.sqrt((exact * (1 - exact)) / shots), `Monte Carlo d = ${d}, p = ${p}`);
  }
  assert.equal(M.repetitionMC(5, 0.2, 1000, 3), M.repetitionMC(5, 0.2, 1000, 3), 'seeded sampling is reproducible');
});

test('surface code: Fowler scaling, Λ, qubit counts and the resource budget', () => {
  const { A, pth } = M.SURFACE;
  close(M.surfacePL(3, pth), A, 1e-15, 'at threshold every distance gives A');
  close(M.surfacePL(5, 0.001) / M.surfacePL(7, 0.001), M.lambda(0.001), 1e-9, 'Λ = p_th/p per step of 2');
  assert.equal(M.surfaceQubits(7), 97);
  assert.equal(M.surfaceQubits(3), 17);
  const b = M.surfaceBudget({ p: 0.001, Q: 100, N: 1e9 });
  assert.ok(M.surfacePL(b.d, 0.001) <= b.perRound && M.surfacePL(b.d - 2, 0.001) > b.perRound, 'smallest sufficient odd distance');
  assert.equal(b.physical, 100 * (2 * b.d * b.d - 1));
  assert.equal(M.surfaceBudget({ p: 0.01, Q: 1, N: 10 }).d, Infinity, 'above threshold nothing helps');
  // the text quotes about distance 27 and ~1,500 qubits per logical qubit at p = 0.1 % and target 1e-12
  const q = M.surfaceBudget({ p: 0.001, Q: 1, N: 1e10 });
  assert.equal(q.d, 27); assert.equal(q.perLogical, 1457);
});

// ── 内容 ──────────────────────────────────────────────────────────────────
const both = (t, where) => { assert.ok(t && t.zh && t.en, `${where}: needs zh and en`); assert.ok(!/[㐀-鿿]/.test(t.en), `${where}: Chinese left in the English text`); };
test('content: every status, formula, reference and link resolves, in both languages', () => {
  const ids = new Set(D.refs.map((r) => r.id));
  assert.equal(ids.size, D.refs.length, 'reference ids are unique');
  assert.ok(D.refs.length >= 55, 'at least 55 references');
  const statuses = new Set(Object.keys(D.status));
  assert.deepEqual([...statuses], ['established', 'active', 'contested', 'hypothesis']);
  for (const r of D.refs) {
    assert.ok(statuses.has(r.status), r.id);
    assert.match(r.doi, /^10\.\d{4,}\/\S+$/, r.id);
    assert.ok(D.areas[r.area], `${r.id} area`);
    assert.ok(r.title && r.authors && r.journal && r.vol && r.pages && r.year > 1900, `${r.id} complete`);
  }
  const cited = new Set(), cite = (r, where) => { assert.ok(ids.has(r), `${where} cites ${r}`); cited.add(r); };
  for (const s of D.sections) {
    for (const [key, cap] of s.formulas) { assert.ok(D.math[key] && MATH[key]?.startsWith('<math'), `${s.id}: formula ${key}`); both(cap, `${s.id}.${key}`); }
    for (const [st, a, b, refs = []] of s.topics) { assert.ok(statuses.has(st), `${s.id} status ${st}`); both(a, s.id); both(b, s.id); refs.forEach((r) => cite(r, s.id)); }
    s.refs.forEach((r) => cite(r, s.id));
    for (const [q, a] of s.questions) { both(q, s.id); both(a, s.id); }
    both(s.title, s.id); both(s.intro, s.id);
    assert.ok(D.pillars.some((p) => p.id === s.id), `${s.id} has a pillar card`);
  }
  for (const p of D.pillars) { both(p.title, p.id); both(p.summary, p.id); }
  for (const c of D.ledger) { assert.ok(statuses.has(c.status) && D.sections.some((s) => s.id === c.section), c.id); c.refs.forEach((r) => cite(r, c.id)); both(c.claim, c.id); both(c.evidence, c.id); both(c.caveat, c.id); }
  for (const p of D.platforms) { assert.ok(statuses.has(p.status) && D.sections.some((s) => s.id === p.section), p.id); p.refs.forEach((r) => cite(r, p.id)); for (const k of Object.keys(D.platformFields)) both(p[k], `${p.id}.${k}`); both(p.name, p.id); }
  assert.equal(D.platforms.length, 6, 'six hardware routes');
  for (const m of D.milestones) { assert.ok(statuses.has(m.status), String(m.year)); cite(m.ref, `milestone ${m.year}`); both(m.text, String(m.year)); }
  const years = [...D.milestones.map((m) => m.year)];
  assert.deepEqual(years, [...years].sort((a, b) => a - b), 'milestones in order');
  for (const [st, area, q] of D.openQuestions) { assert.ok(statuses.has(st) && D.sections.some((s) => s.id === area), area); both(q, 'open question'); }
  for (const k of ['rabi', 'budget', 'qec']) { both(D.demos[k].intro, k); both(D.demos[k].notes, k); }
  for (const key of ['blochEq', 'circuitF', 'surface']) assert.ok(MATH[key], `demo formula ${key}`);
  for (const t of D.tools) { assert.match(t.url, /^https:\/\//, t.name); both(t.text, t.name); if (t.ref) cite(t.ref, t.name); }
  for (const r of D.refs) assert.ok(cited.has(r.id), `${r.id} is cited somewhere`);
  // learning-path links point at pages that exist (the sister pavilions may land in a separate pull request)
  for (const p of D.path) for (const [href, label] of p.links) {
    both(label, href);
    const file = href.split('#')[0];
    if (/^quantum\/(algorithms|biology)\//.test(file)) continue;
    assert.ok(existsSync(new URL(`../public/${file}`, import.meta.url)), href);
  }
  assert.deepEqual(Object.keys(MATH).sort(), Object.keys(D.math).sort(), 'qc-math.js is up to date: run node tools/fundamental-math.mjs');
  // the hub lists this pavilion as live
  const hub = readFileSync(new URL('../public/quantum/sections.js', import.meta.url), 'utf8');
  assert.match(hub, /id: 'computing', path: 'computing\/index\.html', live: true/);
});
