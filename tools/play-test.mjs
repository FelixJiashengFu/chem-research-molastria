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
