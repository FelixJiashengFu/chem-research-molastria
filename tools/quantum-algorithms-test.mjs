// Tests for the Quantum Algorithms section: the simulator and demo models against known results, and the content's integrity
// (every algorithm, formula, reference, relation and track id resolves).   node --test tools/quantum-algorithms-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../public/quantum/algorithms/', import.meta.url);
const load = (file) => { const box = { window: {} }; vm.runInNewContext(readFileSync(new URL(file, dir), 'utf8'), box); return box.window; };
const M = load('qa-models.js').MOLASTRIA_QA_MODELS;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const probsOf = (p) => [...p].map((v) => Math.round(v * 1e9) / 1e9);

test('gates are unitary and the simulator keeps the norm', () => {
  for (const [name, U] of Object.entries(M.U)) {
    const s = M.zero(1); M.apply(s, M.U.H, 0); M.apply(s, U, 0);
    close(M.norm(s), 1, 1e-12, `${name} keeps the norm`);
  }
  const s = M.zero(3);
  for (const g of ['H', 'T', 'S', 'Y']) for (let q = 0; q < 3; q++) M.apply(s, M.U[g], q, q ? [q - 1] : []);
  close(M.norm(s), 1, 1e-12, 'controlled gates keep the norm');
  // HZH = X
  const a = M.basis(1, 0); M.apply(a, M.U.H, 0); M.apply(a, M.U.Z, 0); M.apply(a, M.U.H, 0);
  close(M.probs(a)[1], 1, 1e-12, 'HZH|0⟩ = |1⟩');
});

test('presets: Bell, GHZ, Deutsch–Jozsa, Bernstein–Vazirani, two-qubit Grover, QFT, phase kickback', () => {
  const run = (k) => M.probs(M.runGrid(M.presets[k].n, M.presets[k].grid, M.presets[k].init || 0));
  assert.deepEqual(probsOf(run('bell')), [0.5, 0, 0, 0.5]);
  const g = run('ghz'); close(g[0], 0.5, 1e-12, 'GHZ |000⟩'); close(g[7], 0.5, 1e-12, 'GHZ |111⟩');
  const dj = M.marginal(M.runGrid(3, M.presets.dj.grid), [0, 1]);
  close(dj[0], 0, 1e-12, 'balanced oracle never reads 00'); close(dj[3], 1, 1e-12, 'x0⊕x1 reads 11');
  const bv = M.marginal(M.runGrid(4, M.presets.bv.grid), [0, 1, 2]);
  close(bv[0b101], 1, 1e-12, 'Bernstein–Vazirani reads the secret 101');
  close(run('grover')[3], 1, 1e-12, 'one Grover iteration finds |11⟩ among four');
  const q = M.runGrid(3, M.presets.qft.grid, 1);
  for (let k = 0; k < 8; k++) {
    close(q.re[k], Math.cos(2 * Math.PI * k / 8) / Math.sqrt(8), 1e-12, `QFT|1⟩ re[${k}]`);
    close(q.im[k], Math.sin(2 * Math.PI * k / 8) / Math.sqrt(8), 1e-12, `QFT|1⟩ im[${k}]`);
  }
  // kickback: control ends in H·(|0⟩+e^{iπ/4}|1⟩)/√2, P(0) = cos²(π/8)
  close(M.marginal(M.runGrid(2, M.presets.kickback.grid), [0])[0], Math.cos(Math.PI / 8) ** 2, 1e-12, 'phase kickback');
  for (const [k, p] of Object.entries(M.presets)) for (const col of p.grid) assert.equal(M.columnIssue(col), '', `${k}: every column is valid`);
  assert.equal(M.columnIssue(['•', '']), 'control');
  assert.equal(M.columnIssue(['x', '', '']), 'swap');
});

test('QFT ops match the DFT for every basis input, and the inverse undoes it', () => {
  const n = 4, N = 16;
  for (const j of [0, 3, 9, 15]) {
    const s = M.run(n, M.qftOps([0, 1, 2, 3]), j);
    for (let k = 0; k < N; k++) {
      close(s.re[k], Math.cos(2 * Math.PI * j * k / N) / 4, 1e-12, `re ${j},${k}`);
      close(s.im[k], Math.sin(2 * Math.PI * j * k / N) / 4, 1e-12, `im ${j},${k}`);
    }
    const back = M.run(n, [...M.qftOps([0, 1, 2, 3]), ...M.qftOps([0, 1, 2, 3], true)], j);
    close(M.probs(back)[j], 1, 1e-12, `QFT⁻¹ QFT |${j}⟩`);
  }
});

test('Grover: the closed form matches the simulated statevector, and the best k is about (π/4)√(N/m)', () => {
  for (const [n, marked] of [[3, [5]], [5, [3, 17]], [6, [1, 2, 40]]]) {
    const N = 1 << n, m = marked.length;
    for (let k = 0; k <= 8; k++) {
      const p = M.probs(M.groverRun(n, marked, k)), succ = marked.reduce((a, i) => a + p[i], 0);
      close(succ, M.groverP(N, m, k), 1e-12, `n=${n} m=${m} k=${k}`);
      const a = M.groverAmps(N, m, k);
      close(M.groverRun(n, marked, k).re[marked[0]], a.marked, 1e-12, 'marked amplitude');
    }
    const best = M.groverBest(N, m);
    for (let k = 0; k < best; k++) assert.ok(M.groverP(N, m, k) < M.groverP(N, m, best) + 1e-12, `k=${best} is at least as good as k=${k}`);
  }
  assert.equal(M.groverBest(1 << 20, 1), 804); // floor(π/4 · 1024)
  close(M.classicalQueries(1024, 1), 512.5, 1e-12, 'classical (N+1)/(m+1)');
});

test('phase estimation: the closed-form distribution equals the circuit, sums to 1, and is exact for t-bit phases', () => {
  for (const t of [2, 3, 5]) for (const phi of [0.1, 0.25, 0.618, 0.99]) {
    const a = M.qpeDist(t, phi), b = M.qpeRun(t, phi);
    close(a.reduce((x, y) => x + y, 0), 1, 1e-12, 'normalised');
    a.forEach((v, m) => close(v, b[m], 1e-10, `t=${t} φ=${phi} m=${m}`));
  }
  close(M.qpeDist(4, 5 / 16)[5], 1, 1e-12, 'φ = 5/16 is read exactly with 4 bits');
  for (const phi of [0.03, 0.5 / 16 + 1 / 16, 0.777]) assert.ok(M.qpeNearest(4, phi).p >= 4 / Math.PI ** 2 - 1e-12, 'nearest outcome ≥ 4/π²');
});

test('Jacobi diagonalisation reproduces a known spectrum and the TFIM ground state', () => {
  const { values } = M.jacobi([[2, 1, 0], [1, 2, 1], [0, 1, 2]]);
  const want = [2 - Math.SQRT2, 2, 2 + Math.SQRT2];
  values.slice().sort((a, b) => a - b).forEach((v, i) => close(v, want[i], 1e-12, `eigenvalue ${i}`));
  // two-spin TFIM: E0 = −√(J² + 4h²)
  close(Math.min(...M.jacobi(M.isingMatrix(2, 1, 0.7)).values), -Math.hypot(1, 1.4), 1e-12, 'two-spin ground energy');
  // h = 0: classical ferromagnet, E0 = −J(n−1)
  close(Math.min(...M.jacobi(M.isingMatrix(4, 1, 0)).values), -3, 1e-12, 'h = 0');
});

test('Trotter: first order error falls as 1/r, second order as 1/r², both vanish when [A,B] = 0', () => {
  const c = M.trotterCurve(4, 1, 0.8, 2, [64, 128, 256]);
  const slope = (k) => Math.log2(c[1][k] / c[2][k]);
  close(slope('e1'), 1, 0.05, 'first-order slope'); close(slope('e2'), 2, 0.05, 'second-order slope');
  assert.ok(c[2].e2 < c[2].e1, 'second order is more accurate');
  const free = M.trotterCurve(3, 0, 0.8, 2, [1])[0];
  close(free.e1, 0, 1e-12, 'J = 0 commutes'); close(free.e2, 0, 1e-12, 'J = 0 commutes (2nd)');
  // exact evolution conserves the norm and energy
  const H = M.isingMatrix(3, 1, 0.5), psi0 = [1, 0, 0, 0, 0, 0, 0, 0], ex = M.evolveExact(H, psi0, 3.1);
  close(ex.re.reduce((a, v, i) => a + v * v + ex.im[i] * ex.im[i], 0), 1, 1e-12, 'unitary');
});

test('VQE: the parameter-shift gradient equals a finite difference and descent reaches the exact ground energy', () => {
  const terms = M.vqeTerms(0.6), th = [0.3, -1.1, 0.7, 0.2];
  const g = M.gradient(th, (x) => M.energy(x, terms));
  th.forEach((_, j) => { const a = th.slice(), b = th.slice(), h = 1e-5; a[j] += h; b[j] -= h; close(g[j], (M.energy(a, terms) - M.energy(b, terms)) / (2 * h), 1e-8, `∂E/∂θ${j}`); });
  for (const h of [0.2, 0.6, 1.5]) {
    const r = M.vqeRun({ h, steps: 800, lr: 0.3 });
    close(r.trace.at(-1).e, r.exact, 1e-5, `h=${h} converges`);
    assert.ok(r.trace.at(-1).e >= r.exact - 1e-9, 'variational: never below the ground energy');
  }
  // E0 of −ZZ − h(X0+X1) is −√(1 + 4h²)
  close(M.exactGround(M.vqeTerms(0.6)), -Math.sqrt(1 + 4 * 0.36), 1e-12, 'exact ground energy');
  const noisy = M.vqeRun({ h: 0.6, steps: 80, lr: 0.15, shots: 200 });
  assert.ok(Math.abs(noisy.trace.at(-1).e - noisy.exact) < 0.15, 'shot noise still lands near the ground state');
});

test('Shor, classical part: orders, factors and the failure cases that call for another a', () => {
  assert.equal(M.order(7, 15), 4); assert.equal(M.order(2, 21), 6); assert.equal(M.order(3, 15), 0);
  assert.deepEqual([...M.shorClassical(15, 7).factors], [3, 5]);
  assert.deepEqual([...M.shorClassical(21, 2).factors], [3, 7]);
  assert.equal(M.shorClassical(15, 6).lucky, 3);
  assert.equal(M.shorClassical(21, 4).fail, 'odd'); // order of 4 mod 21 is 3
  assert.equal(M.shorClassical(15, 14).fail, 'minus1'); // 14 ≡ −1
  for (const [N, a] of [[35, 2], [91, 3], [143, 5], [221, 7]]) { const r = M.shorClassical(N, a); if (r.factors) assert.equal(r.factors[0] * r.factors[1], N, `${N} = p·q`); }
  // QPE on 7 mod 15 (r = 4) with 8 bits reads m = 64 → 64/256 = 1/4, whose convergents include denominator 4
  assert.ok(M.convergents(64, 256).some(([, k]) => k === 4));
  assert.equal(M.powmod(7, 2, 15), 4);
});

test('content: every id resolves, every formula has MathML, references and the hub card are in place', () => {
  const D = load('qa-data.js').MOLASTRIA_QA;
  const MATH = existsSync(new URL('qa-math.js', dir)) ? load('qa-math.js').MOLASTRIA_QA_MATH : {};
  const A = new Set(D.algos.map((a) => a.id)), R = new Set(D.refs.map((r) => r.id)), nodes = new Set([...A, ...D.apps.map((p) => p.id)]);
  assert.equal(A.size, D.algos.length, 'unique algorithm ids');
  assert.equal(R.size, D.refs.length, 'unique reference ids');
  for (const a of D.algos) {
    assert.ok(D.tiers.some((t) => t.id === a.tier), `${a.id}: tier`);
    for (const k of ['name', 'tagline', 'speedup']) assert.ok(a[k]?.zh && a[k]?.en, `${a.id}: ${k} in both languages`);
    assert.ok(a.explain.length >= 2 && a.explain.every((p) => p.zh && p.en), `${a.id}: explanation`);
    for (const f of a.formulas) { assert.ok(D.math[f], `${a.id}: formula ${f}`); assert.ok(MATH[f], `${a.id}: MathML for ${f} (run node tools/fundamental-math.mjs)`); }
    for (const r of a.refs) assert.ok(R.has(r), `${a.id}: reference ${r}`);
    assert.ok(a.checks.length >= 3, `${a.id}: self-checks`);
    if (a.demo) assert.ok(['circuit', 'grover', 'qpe', 'trotter', 'vqe', 'shor'].includes(a.demo.id), `${a.id}: demo`);
    if (a.demo?.preset) assert.ok(M.presets[a.demo.preset], `${a.id}: preset ${a.demo.preset}`);
    assert.ok(D.evidence[a.evidence], `${a.id}: evidence level`);
  }
  for (const [x, y, t] of D.relations) { assert.ok(nodes.has(x) && nodes.has(y), `relation ${x} → ${y}`); assert.ok(t.zh && t.en, `relation ${x} → ${y} text`); }
  for (const tr of D.tracks) for (const ph of tr.phases) for (const id of ph.algos) assert.ok(A.has(id), `track ${tr.id}: ${id}`);
  for (const e of D.estimates) { for (const r of e.refs) assert.ok(R.has(r), `estimate ${e.id}: ${r}`); }
  for (const r of D.refs) {
    assert.ok(r.doi || r.arxiv || r.url, `${r.id}: a link`);
    assert.ok(r.note?.zh && r.note?.en, `${r.id}: note in both languages`);
    assert.ok(D.kinds[r.kind], `${r.id}: kind`);
  }
  for (const key of Object.keys(D.math)) assert.ok(MATH[key], `MathML for ${key}`);
  const hub = load('../sections.js').MOLASTRIA_QUANTUM_SECTIONS.find((s) => s.id === 'algorithms');
  assert.equal(hub.path, 'algorithms/index.html');
});

test('rotation gates, mid-circuit measurement and Bloch vectors', () => {
  // Gate strings: rotations carry their angle in units of π; anything else is refused.
  assert.equal(JSON.stringify(M.parseGate('Ry:0.5')), JSON.stringify({ name: 'Ry', turns: 0.5 }));
  for (const bad of ['Ry:3', 'Rq:0.5', 'Ry:', 'Ry:0.12345', 'H:1', 'eval']) assert.equal(M.parseGate(bad), null, bad);
  assert.equal(M.rotGate('Rz', 0.33333), 'Rz:0.333');
  // Ry(θ)|0⟩ = cos(θ/2)|0⟩ + sin(θ/2)|1⟩, Bloch vector (sin θ, 0, cos θ).
  for (const t of [0, 0.25, 0.5, 1, -0.7]) {
    const e = M.runGridEnsemble(1, [[M.rotGate('Ry', t)]]);
    const [x, y, z] = M.bloch(e, 0);
    close(x, Math.sin(t * Math.PI), 1e-12, `Ry(${t}π) x`); close(y, 0, 1e-12, 'y'); close(z, Math.cos(t * Math.PI), 1e-12, 'z');
  }
  // Rx(π/2)|0⟩ points along −y; Rz only turns the phase.
  const rx = M.bloch(M.runGridEnsemble(1, M.presets.rotation.grid), 0);
  close(rx[1], -1, 1e-12, 'Rx(π/2)|0⟩ is −y');
  const rz = M.bloch(M.runGridEnsemble(1, [['H'], ['Rz:0.5']]), 0);
  close(rz[1], 1, 1e-12, 'Rz(π/2)H|0⟩ is +y');
  // Measurement between two H kills the interference: 50/50 instead of |0⟩.
  close(M.ensembleProbs(M.runGridEnsemble(1, M.presets.measure.grid))[0], 0.5, 1e-12, 'H M H');
  close(M.ensembleProbs(M.runGridEnsemble(1, [['H'], ['H']]))[0], 1, 1e-12, 'H H = I');
  // Measuring one half of a Bell pair leaves two branches, each a product state; the reduced states stay maximally mixed.
  const bm = M.runGridEnsemble(2, [...M.presets.bell.grid, ['M', '']]);
  assert.equal(bm.length, 2);
  bm.forEach((b) => close(b.w, 0.5, 1e-12, 'each branch has weight ½'));
  M.bloch(bm, 1).forEach((v, i) => close(v, 0, 1e-12, `measured Bell half ${i}`));
  // Teleportation: qubit 2 ends in the Bloch vector qubit 0 started with, in every branch.
  const tp = M.runGridEnsemble(3, M.presets.teleport.grid);
  assert.equal(tp.length, 4, 'four measurement outcomes');
  const want = [Math.sin(0.35 * Math.PI), 0, Math.cos(0.35 * Math.PI)];
  for (const b of tp) M.bloch([{ w: 1, s: b.s }], 2).forEach((v, i) => close(v, want[i], 1e-12, `teleported component ${i}`));
  // A pure single qubit has |r| = 1; a Bell half has |r| = 0.
  const bell = M.runGridEnsemble(2, M.presets.bell.grid);
  close(Math.hypot(...M.bloch(bell, 0)), 0, 1e-12, 'Bell half is maximally mixed');
  // Without measurements the ensemble is the plain statevector.
  const g = M.runGridEnsemble(3, M.presets.ghz.grid);
  assert.equal(g.length, 1); assert.deepEqual(probsOf(M.ensembleProbs(g)), probsOf(M.probs(M.runGrid(3, M.presets.ghz.grid))));
  // A column that mixes a control and a measurement is flagged.
  assert.equal(M.columnIssue(['•', 'M']), 'measure');
  assert.equal(M.columnIssue(['M', 'M']), '');
  // Stepping: after column 0 of the Bell circuit only H has acted.
  close(M.ensembleProbs(M.runGridEnsemble(2, M.presets.bell.grid, 0, 1))[2], 0.5, 1e-12, 'after column 1: (|00⟩+|10⟩)/√2');
});
