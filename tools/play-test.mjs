// Tests for the playground (public/qchem/): the games' physics in play-models.js against known results, and the
// tunnelling levels in play.js (each one winnable on its slider, none already won at the start).   node --test tools/play-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/qchem/play-models.js', import.meta.url), 'utf8'), box);
const P = box.window.MOLASTRIA_PLAY;
const plain = (v) => JSON.parse(JSON.stringify(v)); // values from the vm realm have other prototypes
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('particle in a box: λ = 8mcL²/(h(N+1)) and its inverse', () => {
  close(P.boxLambda(1, 1), 1648.6, 0.5, 'L = 1 nm, N = 1 (8mc/h · L² / 2)');
  close(P.boxLambda(1.4, 10), 587.6, 0.5, 'L = 1.4 nm, N = 10');
  close(P.boxLengthFor(587.6, 10), 1.4, 1e-3, 'inverse');
  close(P.boxLevel(1, 1), 0.37603, 1e-4, 'E1 for L = 1 nm in eV');
  close(P.boxLevel(2, 1) / P.boxLevel(1, 1), 4, 1e-12, 'E ∝ n²');
  // every target the game can draw (430–680 nm) is reachable with its sliders (N 2–16 even, L 0.40–2.40 nm, step 0.01) to 8 nm
  for (let target = 430; target <= 680; target++) {
    let ok = false;
    for (let N = 2; N <= 16 && !ok; N += 2) for (let i = 40; i <= 240 && !ok; i++) ok = Math.abs(P.boxLambda(i / 100, N) - target) <= 8;
    assert.ok(ok, `target ${target} nm reachable`);
  }
});

test('hydrogen orbitals: radial nodes where the textbook puts them, angular nodes on the right planes', () => {
  const o = (id) => P.orbitals.find((x) => x.id === id);
  const sign = (id, x, z) => Math.sign(P.psi(o(id), x, z));
  assert.notEqual(sign('2s', 0, 1.9), sign('2s', 0, 2.1), '2s node at r = 2');
  for (const r of [(18 - Math.sqrt(108)) / 4, (18 + Math.sqrt(108)) / 4]) assert.notEqual(sign('3s', 0, r - 0.05), sign('3s', 0, r + 0.05), `3s node at ${r.toFixed(3)}`);
  close(P.psi(o('2pz'), 3, 0), 0, 1e-12, '2pz vanishes in the xy plane');
  close(P.psi(o('3dz2'), Math.SQRT2, 1), 0, 1e-9, 'dz² cone at 3cos²θ = 1');
  assert.equal(sign('3dx2y2', 2, 0), sign('3dx2y2', -2, 0), 'dx²−y² has the same sign on both sides of the y = 0 slice');
  assert.notEqual(sign('3px', 2, 0), sign('3px', -2, 0), 'px changes sign');
  for (const x of P.orbitals) { const nd = P.nodes(x); assert.equal(nd.radial + nd.angular, x.n - 1, `${x.id}: n − 1 nodes in all`); }
});

test('ground-state configurations, Cr and Cu exceptions, and the rule checker', () => {
  const sum = (o) => Object.values(o).reduce((a, b) => a + b, 0);
  for (let Z = 1; Z <= 36; Z++) assert.equal(sum(P.config(Z)), Z, `Z = ${Z} electron count`);
  assert.equal(P.configText(8), '1s2 2s2 2p4');
  assert.equal(P.configText(24), '1s2 2s2 2p6 3s2 3p6 4s1 3d5');
  assert.equal(P.configText(29), '1s2 2s2 2p6 3s2 3p6 4s1 3d10');
  assert.equal(P.configText(26), '1s2 2s2 2p6 3s2 3p6 4s2 3d6');
  assert.equal(P.configText(36).split(' ').length, 8);
  assert.deepEqual(plain(P.checkConfig(7, { '1s': [2], '2s': [2], '2p': [1, 1, 1] })), { ok: true });
  assert.equal(P.checkConfig(7, { '1s': [2], '2s': [2], '2p': [2, 1, 0] }).rule, 'hund');
  assert.equal(P.checkConfig(8, { '1s': [2], '2s': [2], '2p': [2, 1, 1] }).ok, true, 'O 2p⁴: one pair, two singles');
  assert.equal(P.checkConfig(8, { '1s': [2], '2s': [2], '2p': [2, 2, 0] }).rule, 'hund');
  assert.equal(P.checkConfig(7, { '1s': [2], '2s': [1], '2p': [2, 1, 1] }).rule, 'aufbau');
  assert.equal(P.checkConfig(7, { '1s': [2], '2s': [2], '2p': [1, 1] }).rule, 'count');
  assert.equal(P.checkConfig(24, { '1s': [2], '2s': [2], '2p': [2, 2, 2], '3s': [2], '3p': [2, 2, 2], '4s': [1], '3d': [1, 1, 1, 1, 1] }).ok, true, 'Cr');
  assert.equal(P.checkConfig(24, { '1s': [2], '2s': [2], '2p': [2, 2, 2], '3s': [2], '3p': [2, 2, 2], '4s': [2], '3d': [1, 1, 1, 1, 0] }).rule, 'aufbau', 'Cr 4s²3d⁴ is not the ground state');
  assert.equal(P.elements.length, 37);
});

test('tunnelling: exact wavefunction conserves flux and matches the closed-form transmission', () => {
  for (const [E, V0, a, m] of [[1, 2, 0.3, P.const.me], [1, 2, 0.8, P.const.me], [3, 2, 0.5, P.const.me], [0.05, 0.1, 0.01, P.const.mp]]) {
    const b = P.barrier(E, V0, a, m);
    close(b.T + b.R, 1, 1e-9, `T + R = 1 (E=${E}, V0=${V0}, a=${a})`);
    close(b.T, P.barrierT(E, V0, a, m), 1e-9 + b.T * 1e-9, 'matches the closed form');
    for (const x of [0, a]) { const l = b.psi(x - 1e-9), r = b.psi(x + 1e-9); close(Math.hypot(l.re - r.re, l.im - r.im), 0, 1e-6, `continuous at ${x}`); }
  }
  // resonance above the barrier: k′a = π  ⇒  E − V0 = π²ħ²/(2ma²)
  const { hbar, me, eV } = P.const, Eres = 1 + (Math.PI ** 2 * hbar ** 2) / (2 * me * 1e-18) / eV;
  close(P.barrier(Eres, 1, 1).T, 1, 1e-9, 'T = 1 at the first resonance');
  assert.ok(P.barrier(0.5, 1, 0.3, P.const.mp).T < 1e-6 * P.barrier(0.5, 1, 0.3).T, 'a proton tunnels far less than an electron');
});

test('tunnelling levels in play.js: winnable on the slider, not won at the start', () => {
  const src = readFileSync(new URL('../public/qchem/play.js', import.meta.url), 'utf8');
  const start = src.indexOf('const MISSIONS = [');
  const MISSIONS = vm.runInNewContext(`(${src.slice(start + 'const MISSIONS = '.length, src.indexOf('];', start) + 1)})`);
  assert.equal(MISSIONS.length, 4);
  for (const [i, M] of MISSIONS.entries()) {
    const m = M.p === 'p' ? P.const.mp : P.const.me, [lo, hi, step] = M.range;
    const T = (v) => P.barrier(M.free === 'E' ? v : M.E, M.V, M.free === 'a' ? v : M.a, m).T;
    const inGoal = (x) => x >= M.goal[0] && x <= M.goal[1];
    assert.ok(!inGoal(T(M.free === 'E' ? M.E : M.a)), `level ${i + 1} is not already won`);
    let wins = 0;
    for (let k = 0; lo + k * step <= hi + 1e-12; k++) if (inGoal(T(Number((lo + k * step).toFixed(6))))) wins++;
    assert.ok(wins > 0, `level ${i + 1} has a winning slider position`);
  }
  assert.ok(MISSIONS[1].range[1] < MISSIONS[1].V, 'level 2: the energy stays below the barrier');
  assert.ok(MISSIONS[3].range[0] > MISSIONS[3].V, 'level 4: the energy stays above the barrier');
});

test('Hückel rings: Frost-circle levels, classic delocalization energies, Hückel rule', () => {
  const benzene = P.huckelFill(6, 6), cbd = P.huckelFill(4, 4), cp = P.huckelFill(5, 6);
  close(benzene.energy, 8, 1e-9, 'benzene Eπ = 6α + 8β');
  close(benzene.delocalization, 2, 1e-9, 'benzene DE = 2β');
  close(cbd.delocalization, 0, 1e-9, 'cyclobutadiene DE = 0');
  assert.equal(cbd.open, true, 'cyclobutadiene is open-shell in Hückel theory');
  assert.equal(benzene.open, false);
  close(cp.delocalization, 2.472, 1e-3, 'cyclopentadienyl anion DE = 2.47β');
  close(P.huckelFill(3, 2).delocalization, 2, 1e-9, 'cyclopropenyl cation DE = 2β');
  assert.equal(P.huckelRule(6), 'aromatic');
  assert.equal(P.huckelRule(8), 'antiaromatic');
  assert.deepEqual(plain(P.rings.map((r) => P.ringElectrons(r))), [2, 4, 4, 2, 6, 4, 6, 6, 8, 8, 10]);
});

test('hydrogen lines: Rydberg formula with the reduced-mass constant (vacuum wavelengths)', () => {
  close(P.lineNm(3, 2), 656.47, 0.02, 'Hα');
  close(P.lineNm(4, 2), 486.27, 0.02, 'Hβ');
  close(P.lineNm(2, 1), 121.57, 0.01, 'Lyman α');
  close(P.lineNm(4, 3), 1875.6, 0.5, 'Paschen α');
  close(P.levelEV(1), -13.598, 1e-3, 'ground level');
  // every line the game can ask for (n₁ ≤ 3, n₂ ≤ 7) is on its 90–2000 nm spectrum and no two coincide
  const lams = [];
  for (let nl = 1; nl <= 3; nl++) for (let nu = nl + 1; nu <= 7; nu++) { const l = P.lineNm(nu, nl); assert.ok(l > 90 && l < 2000, `${nu}→${nl} at ${l}`); lams.push(l); }
  lams.sort((a, b) => a - b);
  for (let i = 1; i < lams.length; i++) assert.ok(lams[i] - lams[i - 1] > 0.5, 'lines are distinct (the closest, Lyman 7→1 and 6→1, are 0.7 nm apart)');
});

test('wavelength colours: red at 650 nm, blue at 450 nm, nothing outside the visible', () => {
  const [r1, g1, b1] = P.wavelengthRGB(650), [r2, , b2] = P.wavelengthRGB(450);
  assert.ok(r1 > 200 && g1 < 120 && b1 === 0);
  assert.ok(b2 > 200 && r2 === 0);
  assert.deepEqual(plain(P.wavelengthRGB(900)), [0, 0, 0]);
});

// ── 07–14：量子嘉年华分会场与物理疆界（play-quantum-models.js）────────────────
const qbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/qchem/play-quantum-models.js', import.meta.url), 'utf8'), qbox);
const Q = qbox.window.MOLASTRIA_PLAYQ;

test('Stern–Gerlach: cos²(Δθ/2) per analyser, the 1/4 paradox, many small steps reach 1, every level winnable on its slider', () => {
  close(Q.sgStep(0, 90), 0.5, 1e-12, '+z then +x');
  close(Q.sgStep(0, 180), 0, 1e-12, '+z then −z');
  close(Q.sgChain([0, 90, 180]), 0.25, 1e-12, 'a +x analyser between +z and −z passes 1/4');
  close(Q.sgChain([0, 45, 90, 135, 180]), Math.cos(Math.PI / 8) ** 8, 1e-12, 'four equal steps');
  for (let m = 1; m < 40; m++) assert.ok(Q.sgEven(m + 1) > Q.sgEven(m), 'more analysers, more atoms through');
  assert.ok(Q.sgEven(200) > 0.98, 'the Zeno limit approaches 1');
  const grid = Array.from({ length: 73 }, (_, i) => i * 5); // the slider: 0–360° in 5° steps
  for (const L of Q.sgLevels) {
    const won = (mid) => { const p = Q.sgChain([0, ...mid, ...(L.last == null ? [] : [L.last])]); return p >= L.lo - 1e-12 && p <= L.hi + 1e-12; };
    assert.equal(won(Array(L.middle).fill(0)), false, `${L.id}: not won at the start`);
    let ok = false;
    const walk = (mid) => { if (ok) return; if (mid.length === L.middle) { ok = won(mid); return; } for (const a of grid) walk([...mid, a]); };
    walk([]);
    assert.ok(ok, `${L.id}: winnable`);
  }
});

test('CHSH: classical strategies top out at 3/4, the quantum optimum is cos²(π/8) and nothing on the slider grid beats it', () => {
  let best = 0;
  for (let m = 0; m < 16; m++) best = Math.max(best, Q.chshClassical([m & 1, (m >> 1) & 1], [(m >> 2) & 1, (m >> 3) & 1]));
  assert.equal(best, 0.75);
  assert.equal(Q.chshClassical([0, 1], [0, 1]), 0.25, 'the game starts at 25%');
  close(Q.chshQuantum([0, 45], [22.5, -22.5]), Q.tsirelson, 1e-12, 'optimal angles');
  close(Q.tsirelson, (2 + Math.SQRT2) / 4, 1e-15, 'Tsirelson');
  close(Q.chshS([0, 45], [22.5, -22.5]), 2 * Math.SQRT2, 1e-12, 'S = 2√2');
  let top = 0;
  for (let i = 0; i < 400; i++) { const r = () => Math.round((Math.random() * 180 - 90) * 2) / 2, A = [r(), r()], B = [r(), r()], w = Q.chshQuantum(A, B); top = Math.max(top, w); close(w, 0.5 + Q.chshS(A, B) / 8, 1e-12, 'P(win) = 1/2 + S/8'); }
  assert.ok(top <= Q.tsirelson + 1e-12);
  assert.equal(Q.chshQuantum([0, 0], [0, 0]), 0.75, 'all angles equal: quantum play reduces to a classical strategy');
});

test('circuits: gates are unitary, textbook identities hold, every puzzle is normalised and its par is the true minimum', () => {
  const norm = (v) => v.reduce((t, [a, b]) => t + a * a + b * b, 0);
  const st = Q.run(3, [{ g: 'H', q: 0 }, { g: 'T', q: 1 }, { g: 'H', q: 1 }, { g: 'CNOT', c: 0, t: 2 }, { g: 'S', q: 2 }]);
  close(norm(st), 1, 1e-12, 'norm preserved');
  const same = (a, b, n = 1) => { for (let basis = 0; basis < 1 << n; basis++) close(Q.fidelity(Q.run(n, a, basis), Q.run(n, b, basis)), 1, 1e-12, 'same action'); };
  same([{ g: 'H', q: 0 }, { g: 'Z', q: 0 }, { g: 'H', q: 0 }], [{ g: 'X', q: 0 }]);
  same([{ g: 'T', q: 0 }, { g: 'T', q: 0 }], [{ g: 'S', q: 0 }]);
  same([{ g: 'S', q: 0 }, { g: 'S', q: 0 }], [{ g: 'Z', q: 0 }]);
  close(Q.fidelity(Q.run(2, [{ g: 'CNOT', c: 0, t: 1 }, { g: 'CNOT', c: 1, t: 0 }, { g: 'CNOT', c: 0, t: 1 }], 1), Q.zero(2, 2)), 1, 1e-12, 'swap |01⟩ → |10⟩');
  assert.equal(new Set(Q.puzzles.map((p) => p.id)).size, Q.puzzles.length);
  for (const pz of Q.puzzles) {
    close(norm(pz.target), 1, 1e-12, `${pz.id} target normalised`);
    assert.equal(Q.solved(pz, []), false, `${pz.id}: not solved by the empty circuit`);
    const mv = Q.moves(pz.n, pz.allow);
    let found = -1;
    for (let d = 1; d <= pz.par && found < 0; d++) {
      const dfs = (seq) => { if (found >= 0) return; if (seq.length === d) { if (Q.solved(pz, seq)) found = d; return; } for (const m of mv) dfs([...seq, m]); };
      dfs([]);
    }
    assert.equal(found, pz.par, `${pz.id}: par ${pz.par} is the minimum`);
  }
});

test('repetition code: the decoder fixes every single flip, and p_L = 3p² − 2p³ matches all 8 error patterns', () => {
  for (let q = 0; q < 3; q++) { const e = [0, 0, 0]; e[q] = 1; assert.equal(Q.decode(Q.syndrome(e)), q); assert.equal(Q.logicalFail(e, q), false); }
  assert.equal(Q.decode([0, 0]), -1);
  for (const p of [0.01, 0.05, 0.15, 0.3, 0.5, 0.7]) {
    let pl = 0;
    for (let m = 0; m < 8; m++) { const e = [m & 1, (m >> 1) & 1, (m >> 2) & 1], k = e[0] + e[1] + e[2]; if (Q.logicalFail(e, Q.decode(Q.syndrome(e)))) pl += p ** k * (1 - p) ** (3 - k); }
    close(Q.pLogical(p), pl, 1e-12, `p = ${p}`);
  }
  close(Q.pLogical(0.5), 0.5, 1e-15, 'break-even at p = 1/2');
  assert.ok(Q.pLogical(0.15) < 0.15 && Q.pLogical(0.6) > 0.6);
});

test('Grover: the closed form matches step-by-step oracle + diffusion, and the best iteration count is right', () => {
  for (const N of [4, 16, 64]) {
    let v = Array(N).fill(1 / Math.sqrt(N));
    for (let k = 0; k <= 12; k++) {
      const [am, ao] = Q.groverAmps(N, k);
      close(v[3], am, 1e-12, `N ${N} k ${k} marked`); close(v[0], ao, 1e-12, `N ${N} k ${k} other`);
      v = Q.groverStep(v, 3);
    }
  }
  close(Q.groverP(4, 1), 1, 1e-12, 'N = 4: one iteration is certain');
  assert.equal(Q.groverBest(1024), 25);
  close(Q.groverP(1024, 25), 0.99946, 1e-5, 'N = 1024 success at k = 25');
  for (const N of Q.groverSizes) { const kb = Q.groverBest(N); assert.ok(Q.groverP(N, kb) >= Q.groverP(N, kb + 1) && Q.groverP(N, kb) >= Q.groverP(N, Math.max(0, kb - 1)), `N ${N}`); assert.ok(Q.groverP(N, kb) > 0.9); }
});

test('noise-assisted transport: agrees with the biology pavilion’s solver, conserves probability, and each network teaches its lesson', () => {
  const bbox = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../public/quantum/biology/qb-models.js', import.meta.url), 'utf8'), bbox);
  const M = bbox.window.MOLASTRIA_QB_MODELS, H = M.fmoH();
  for (const gamma of [0, 0.5, 20]) {
    const opt = { gamma, kappa: 1, loss: 0.002, trap: 2, start: 0 };
    close(Q.transfer(H, opt).efficiency, M.transfer(H, opt).efficiency, 1e-9, `FMO γ = ${gamma}`);
  }
  for (const net of Q.networks) {
    const c = Q.enaqtCurve(net), mx = Math.max(...c), at = c.indexOf(mx);
    for (const s of [0, 30, 90]) { const r = Q.transfer(net.H, { ...Q.enaqtRates, gamma: Q.gammaAt(s), trap: net.trap }); close(r.efficiency + r.lost, 1, 1e-9, `${net.id}: η + loss = 1`); }
    assert.ok(c[120] < 0.05, `${net.id}: strong dephasing freezes transfer (Zeno)`);
    assert.ok(c[net.s0] < 0.97 * mx, `${net.id}: not passed where the slider starts`);
    if (net.id === 'chain') assert.equal(at, 0, 'the clean chain does best with no noise');
    else { assert.ok(at > 1 && at < 120, `${net.id}: an interior optimum`); assert.ok(c[0] < 0.5 * mx, `${net.id}: coherent transport is poor`); }
  }
  assert.ok(Q.enaqtCurve(Q.networks[2])[0] < 1e-6, 'the dark state blocks coherent transfer completely');
  assert.equal(Q.gammaAt(0), 0); close(Q.gammaAt(1), 0.01, 1e-15, 'slider low end'); close(Q.gammaAt(120), 1000, 1e-9, 'slider high end');
});

test('Planck units: dimensions solve uniquely and give the CODATA Planck values', () => {
  for (const tg of Q.planckTargets) { const e = Q.solveDims(tg.dim); assert.deepEqual(plain(Q.dims(...e)).map((x) => x + 0), plain(tg.dim), tg.id); for (const x of e) assert.ok(Number.isInteger(2 * x) && Math.abs(x) <= 6, `${tg.id}: half-integer exponents within the steppers`); }
  const v = (id) => Q.value(...Q.solveDims(Q.planckTargets.find((x) => x.id === id).dim));
  close(v('length') / 1.616255e-35, 1, 1e-5, 'Planck length');
  close(v('time') / 5.391247e-44, 1, 1e-5, 'Planck time');
  close(v('mass') / 2.176434e-8, 1, 1e-5, 'Planck mass');
  close(v('energy') / 1.602176634e-10 / 1.22089e19, 1, 1e-4, 'Planck energy in GeV');
  assert.deepEqual(plain(Q.solveDims([1, 1, -2])).map((x) => x + 0), [0, 4, -1], 'force c⁴/G has no ħ');
  assert.deepEqual(plain(Q.solveDims([1, 2, -3])).map((x) => x + 0), [0, 5, -1], 'power c⁵/G has no ħ');
});

test('ħ-c-G cube: the cases cover all eight corners and use the same corners as the Realms of Physics map', () => {
  const rbox = { window: {} };
  vm.runInNewContext(readFileSync(new URL('../public/physics-realms/pr-data.js', import.meta.url), 'utf8'), rbox);
  const realms = rbox.window.MOLASTRIA_REALMS.cube.map((x) => x.k.join(''));
  assert.deepEqual([...realms].sort(), Object.keys(Q.cubeName).sort());
  const used = new Set(Q.cubeCases.map((x) => x.k.join('')));
  assert.equal(used.size, 8, 'every corner has at least one phenomenon');
  const src = readFileSync(new URL('../public/qchem/play-quantum.js', import.meta.url), 'utf8');
  for (const x of Q.cubeCases) assert.match(src, new RegExp(`\\n\\s+${x.id}: \\[`), `${x.id} has a bilingual text`);
});

// ── 15：二维波包画墙（play-wave2d-models.js）────────────────────────────────
const wbox = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/qchem/play-wave2d-models.js', import.meta.url), 'utf8'), wbox);
const W2 = wbox.window.MOLASTRIA_WAVE2D;

test('2D wave packet: the radix-2 FFT matches a direct DFT and inverts', () => {
  const n = 16, re = Float64Array.from({ length: n }, (_, i) => Math.sin(i * 1.7) + 0.3), im = Float64Array.from({ length: n }, (_, i) => Math.cos(i * i * 0.4));
  const a = Float64Array.from(re), b = Float64Array.from(im), p = W2.plan(n);
  W2.fft(a, b, p);
  for (let k = 0; k < n; k++) {
    let sr = 0, si = 0;
    for (let j = 0; j < n; j++) { const ph = (-2 * Math.PI * j * k) / n; sr += re[j] * Math.cos(ph) - im[j] * Math.sin(ph); si += re[j] * Math.sin(ph) + im[j] * Math.cos(ph); }
    close(a[k], sr, 1e-12, `Re X_${k}`); close(b[k], si, 1e-12, `Im X_${k}`);
  }
  W2.fft(a, b, p, true);
  for (let j = 0; j < n; j++) { close(a[j] / n, re[j], 1e-14, 'round trip re'); close(b[j] / n, im[j], 1e-14, 'round trip im'); }
  assert.throws(() => W2.plan(96), /power of 2/);
});

test('2D wave packet: the split-operator step is unitary with walls and barriers; with the absorbing edges, norm + absorbed = 1', () => {
  const N = W2.N, V = new Float64Array(N * N);
  for (let y = 0; y < N; y++) { for (let x = 60; x < 64; x++) if (y < 56 || y > 72) V[y * N + x] = W2.WALL; V[y * N + 90] = 1; }
  const s = W2.sim({ nx: N, dt: 0.25, V, absorb: 0 });
  W2.gaussian(s, { x0: 30, y0: 64, sx: 6, sy: 12, kx: 1.2, ky: 0.3 });
  close(W2.norm(s), 1, 1e-14, 'normalised packet');
  W2.step(s, 1000);
  close(W2.norm(s), 1, 1e-12, 'periodic box: |ψ|² summed stays 1 after 1000 steps');
  const a = W2.sim({ nx: N, dt: 0.25, V });
  W2.gaussian(a, { x0: 30, y0: 64, sx: 6, sy: 12, kx: 1.2, ky: 0.3 });
  let last = 1;
  for (let k = 0; k < 8; k++) { W2.step(a, 50); const nm = W2.norm(a); assert.ok(nm <= last + 1e-15, 'absorption only removes probability'); last = nm; close(nm + W2.absorbed(a), 1, 1e-12, 'every bit of lost probability is accounted for'); }
  assert.ok(last < 0.5, 'the edges really absorb');
  assert.ok(W2.WALL * 0.25 < Math.PI, 'V·dt stays below π, so e^{−iV dt} does not alias the wall into a different potential');
});

test('2D wave packet: a free packet moves at k/m and spreads as σ(t) = σ₀√(1 + (t/(2σ₀²))²) (ħ = m = 1)', () => {
  const s = W2.sim({ nx: W2.N, dt: 0.25, absorb: 0 });
  const x0 = 36, y0 = 50, s0x = 5, s0y = 7, kx = 1, ky = 0.5;
  W2.gaussian(s, { x0, y0, sx: s0x, sy: s0y, kx, ky });
  for (const T of [20, 40]) {
    W2.step(s, Math.round(T / 0.25) - s.steps);
    const m = W2.moments(s);
    close(m.x, x0 + kx * T, 1e-6, `⟨x⟩ at t = ${T}`); close(m.y, y0 + ky * T, 1e-6, `⟨y⟩ at t = ${T}`);
    close(m.sx, W2.freeWidth(s0x, T), 1e-6, `σx at t = ${T}`); close(m.sy, W2.freeWidth(s0y, T), 1e-6, `σy at t = ${T}`);
  }
  close(W2.freeWidth(5, 50), 5 * Math.SQRT2, 1e-12, 'σ grows by √2 at t = 2σ₀²');
});

test('2D wave packet: double-slit dark fringes sit where d·sinθ = (m + ½)λ, spaced λL/d near the centre', () => {
  const nx = 256, ny = 128, k = 2, d = 16, w = 4, xw = 64, xs = 228, dt = 0.2, lam = (2 * Math.PI) / k, L = xs - (xw + 2), c = ny / 2;
  const V = new Float64Array(nx * ny);
  for (let y = 0; y < ny; y++) {
    const open = Math.abs(y + 0.5 - (c - d / 2)) < w / 2 || Math.abs(y + 0.5 - (c + d / 2)) < w / 2;
    if (!open) for (let x = xw; x < xw + 4; x++) V[y * nx + x] = 10; // E = 2 here, so the wall is raised to 10 (V·dt = 2)
  }
  const s = W2.sim({ nx, ny, dt, V });
  W2.gaussian(s, { x0: 30, y0: c - 0.5, sx: 10, sy: 16, kx: k });
  const I = new Float64Array(ny);
  for (let n = 0; n < 700; n++) { W2.step(s); for (let y = 0; y < ny; y++) { const i = y * nx + xs; I[y] += s.re[i] ** 2 + s.im[i] ** 2; } }
  const top = Math.max(...I), mins = [];
  for (let y = 13; y < ny - 13; y++) if (I[y] < I[y - 1] && I[y] <= I[y + 1] && I[y] < 0.1 * top) {
    const den = I[y - 1] - 2 * I[y] + I[y + 1]; mins.push(y + (den > 0 ? (I[y - 1] - I[y + 1]) / (2 * den) : 0) + 0.5 - c); // parabolic, relative to the axis
  }
  const inner = mins.filter((v) => Math.abs(v) < 30), outer = mins.filter((v) => Math.abs(v) >= 30);
  assert.equal(inner.length, 2, `two dark fringes beside the central bright one: ${mins.map((v) => v.toFixed(1))}`);
  close(inner[1] - inner[0], (lam * L) / d, 0.05 * ((lam * L) / d), 'their spacing is λL/d');
  for (const v of inner) close(Math.abs(v), L * Math.tan(Math.asin(lam / (2 * d))), 1.5, 'm = 0 dark fringe');
  assert.ok(outer.length >= 1, 'the next dark fringes are on the screen');
  for (const v of outer) close(Math.abs(v), L * Math.tan(Math.asin((1.5 * lam) / d)), 2.5, 'm = 1 dark fringe');
  const f = W2.fringes(I, 12, ny - 12);
  assert.equal(f.count, 3, 'the counter sees the central and the two first-order bright fringes');
});

test('2D wave packet: a barrier uniform in y transmits what the 1D square-barrier formula gives (averaged over the packet’s k)', () => {
  const N = W2.N;
  const T1 = (k, V, a) => { const E = (k * k) / 2, q = Math.sqrt(2 * Math.abs(V - E)), f = E < V ? Math.sinh(q * a) : Math.sin(q * a); return 1 / (1 + (V * V * f * f) / (4 * E * Math.abs(V - E))); };
  const avg = (k0, sx, V, a) => { const sk = 1 / (2 * sx); let s = 0, w = 0; for (let i = -400; i <= 400; i++) { const k = k0 + (i / 100) * sk, g = Math.exp(-((k - k0) ** 2) / (2 * sk * sk)); s += g * T1(k, V, a); w += g; } return s / w; };
  const through = (V0, a) => {
    const V = new Float64Array(N * N);
    for (let y = 0; y < N; y++) for (let x = 60; x < 60 + a; x++) V[y * N + x] = V0;
    const s = W2.sim({ nx: N, dt: 0.25, V });
    W2.gaussian(s, { x0: 28, y0: 64, sx: 8, sy: 10, kx: 1 });
    W2.step(s, 320);
    return W2.prob(s, [60 + a, 0, N, N], true);
  };
  // the barrier is a few grid points wide, so its width is only defined to about a cell: allow 20 %
  for (const a of [2, 3, 4]) { const sim = through(1, a), ref = avg(1, 8, 1, a); close(sim / ref, 1, 0.2, `V = 2E, ${a} cells: ${sim.toFixed(5)} vs ${ref.toFixed(5)}`); }
  assert.ok(through(W2.WALL, 4) < 3e-4, 'a 4-cell wall lets almost nothing through');
  assert.ok(through(W2.WALL, 2) < 5e-3, 'a 2-cell wall leaks a few tenths of a per cent at most (the grid cannot resolve the decay inside it)');
});

test('2D wave packet: the fringe counter counts bright fringes, not the weak side lobes of one slit', () => {
  const ys = Array.from({ length: 101 }, (_, i) => i - 50);
  const two = ys.map((y) => Math.cos((Math.PI * y) / 12) ** 2 * Math.exp(-((y / 40) ** 2)));
  assert.equal(W2.fringes(two).count, 9, 'cos² fringes every 12 rows under a broad envelope');
  const sinc = ys.map((y) => { const u = (Math.PI * y) / 14; return y ? (Math.sin(u) / u) ** 2 : 1; });
  assert.equal(W2.fringes(sinc).count, 1, 'a single slit’s 4.7 % side lobes are below the threshold');
  assert.equal(W2.fringes(new Float64Array(20)).count, 0);
});

test('2D wave packet levels: each reference solution fits the budget and earns three stars; doing nothing earns none', () => {
  assert.equal(new Set(W2.levels.map((L) => L.id)).size, W2.levels.length);
  assert.equal(W2.levels.filter((L) => L.goal.type === 'none').length, 1, 'one free-play level');
  for (const L of W2.levels) {
    if (L.goal.type === 'none') continue;
    assert.equal(L.stars.length, 3, `${L.id}: three star thresholds`);
    const base = W2.layout(L), ref = W2.refCells(L);
    for (let i = 0; i < base.length; i++) if (!W2.editable(base[i])) assert.equal(ref[i], base[i], `${L.id}: locked cells stay`);
    assert.ok(W2.edits(L, ref) <= L.budget, `${L.id}: the reference uses ${W2.edits(L, ref)} of ${L.budget} cells`);
    const none = W2.runner(L, base).run(), best = W2.runner(L, ref).run();
    assert.equal(none.stars, 0, `${L.id}: no edits, no stars (${none.value})`);
    assert.equal(best.stars, 3, `${L.id}: the reference gets three stars (${best.value})`);
  }
  // the brush leaves no corner-only gaps on a diagonal: every block shares an edge with the next
  const line = W2.brushLine(10, 30, 30, 10);
  for (let i = 1; i < line.length; i++) assert.ok(Math.abs(line[i][0] - line[i - 1][0]) < W2.BRUSH && Math.abs(line[i][1] - line[i - 1][1]) < W2.BRUSH);
  // tunnelling: the locked column cannot be erased, so the barrier can be thinned but never opened
  const tun = W2.levels.find((L) => L.id === 'tunnel'), cells = W2.paint(W2.layout(tun), [[0, 0, W2.N, W2.N, W2.EMPTY]]);
  assert.ok(cells.every((v) => v === W2.EMPTY || v === W2.BARRIER_LOCK) && cells.some((v) => v === W2.BARRIER_LOCK));
});
