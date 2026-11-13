// Tests for the six figures on the home page (public/home-figs-models.js): each against an analytic result or its source data.
//   node --test tools/home-figs-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL(`../public/${file}`, import.meta.url), 'utf8');
const load = (file) => { const box = { window: {} }; vm.runInNewContext(read(file), box); return box.window; };
const M = load('home-figs-models.js').MOLASTRIA_HOME_FIGS;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);

test('infrared: the modes are the ones in the Spectra Hall data, and a lone line keeps its height', () => {
  const V = load('spectra/sp-computed.js').MOLASTRIA_SPECTRA_COMPUTED.vib;
  for (const [name, m] of Object.entries(M.IR)) {
    const want = V[name].modes.filter((x) => x[0] > 450 && x[1] >= 1).map((x) => [Math.round(x[0]), +x[1].toFixed(1)]);
    assert.equal(JSON.stringify(m.modes), JSON.stringify(want), name);
    assert.equal(V[name].method, 'B3LYP'); assert.equal(V[name].basis, 'def2-svpd');
    for (const [nu] of m.bands) assert.ok(m.modes.some(([c]) => Math.abs(c - nu) < 80), `${name}: a band label at ${nu} sits on a line`);
  }
  near(M.lorentz([[1000, 50]], 1000), 50, 1e-12); near(M.lorentz([[1000, 50]], 1014), 25, 1e-12, 'half height at the half width');
});

test('benzene: orthonormal Hückel orbitals, bond orders 2/3, 0, −1/3, and a sixfold density of six electrons', () => {
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) near(M.HUCKEL[a].reduce((s, c, i) => s + c * M.HUCKEL[b][i], 0), a === b ? 1 : 0, 1e-12);
  near(M.bondOrder(0, 0), 1, 1e-12); near(M.bondOrder(0, 1), 2 / 3, 1e-12); near(M.bondOrder(0, 2), 0, 1e-12); near(M.bondOrder(0, 3), -1 / 3, 1e-12);
  const z = 0.8, at = (r, deg) => M.benzeneDensity(r * Math.cos(deg * Math.PI / 180), r * Math.sin(deg * Math.PI / 180), z);
  for (const r of [1.2, 2.64, 3.5]) for (const deg of [7, 23]) { near(at(r, deg), at(r, deg + 60), 1e-12 * (1 + at(r, deg)), 'sixfold'); near(at(r, deg), at(r, -deg), 1e-12 * (1 + at(r, deg)), 'mirror'); }
  // The Slater 2p_z orbital is normalised: ∫φ² = 1 (radial quadrature; the angular part of z² gives 4π/3).
  let n = 0; const h = 0.002; for (let r = h / 2; r < 30; r += h) n += (M.pz(0, 0, r) ** 2) * r * r * h; near(n * 4 * Math.PI / 3, 1, 1e-4, 'norm');
});

test('hydrogen: the states are normalised and orthogonal, 1s and 2p_z match their textbook forms', () => {
  const overlap = (a, b) => { // ∫ψ_a ψ_b d³r, Gauss–Legendre-free: midpoint in r and cos θ
    let s = 0; const hr = 0.02, hc = 0.004;
    for (let r = hr / 2; r < 90; r += hr) { let ang = 0; for (let c = -1 + hc / 2; c < 1; c += hc) ang += M.hydrogen(a[0], a[1], r, c) * M.hydrogen(b[0], b[1], r, c) * hc; s += ang * r * r * hr; }
    return s * 2 * Math.PI;
  };
  const S = [[1, 0], [2, 1], [3, 1], [3, 2], [4, 3]];
  for (const s of S) near(overlap(s, s), 1, 2e-4, `norm ${s}`);
  near(overlap([2, 1], [3, 1]), 0, 2e-4); near(overlap([3, 1], [3, 2]), 0, 2e-4); near(overlap([2, 1], [4, 3]), 0, 2e-4);
  near(M.hydrogen(1, 0, 0.7, 0.3), Math.exp(-0.7) / Math.sqrt(Math.PI), 1e-12);
  near(M.hydrogen(2, 1, 1.3, 0.5), 1.3 * 0.5 * Math.exp(-0.65) / (4 * Math.sqrt(2 * Math.PI)), 1e-12);
  near(M.hydrogenE(3), -1.5117, 1e-3);
});

test('diffusion: the score matches a finite difference of log p_t, and the flow carries noise onto the eight modes', () => {
  const logp = (x, y, t) => { const a = M.alpha(t), v = a * a * M.S0 ** 2 + 1 - a * a; let p = 0; for (const [mx, my] of M.MODES) p += Math.exp(-((x - a * mx) ** 2 + (y - a * my) ** 2) / (2 * v)); return Math.log(p / (8 * 2 * Math.PI * v)); };
  for (const [x, y, t] of [[0.4, -0.9, 0.5], [1.5, 1.2, 0.2], [-0.3, 0.1, 0.9]]) {
    const h = 1e-5, [sx, sy] = M.score(x, y, t);
    near(sx, (logp(x + h, y, t) - logp(x - h, y, t)) / (2 * h), 1e-5); near(sy, (logp(x, y + h, t) - logp(x, y - h, t)) / (2 * h), 1e-5);
  }
  near(M.alpha(0), 1, 1e-12); assert.ok(M.alpha(1) < 0.01, 'almost pure noise at t = 1');
  const { frames, ts } = M.reverseFlow(400), end = frames[frames.length - 1], seen = new Array(8).fill(0);
  assert.equal(ts[0], 1); assert.ok(ts[ts.length - 1] < 0.002);
  let far = 0;
  for (let i = 0; i < 400; i++) { let best = Infinity, k = 0; M.MODES.forEach(([mx, my], j) => { const d = Math.hypot(end[2 * i] - mx, end[2 * i + 1] - my); if (d < best) { best = d; k = j; } }); seen[k]++; if (best > 4 * M.S0) far++; }
  assert.ok(far <= 4, `${far} points ended away from every mode`);
  assert.ok(seen.every((n) => n > 25 && n < 80), `each mode gets its share: ${seen}`);
  assert.deepEqual([...M.reverseFlow(5).frames[90]], [...M.reverseFlow(5).frames[90]], 'same seed, same picture');
});

test('NMR: 6 protons in a 3:1:2 pattern, Lorentzian lines of height a·T₂ after a long acquisition, wiggles after a short one', () => {
  near(M.LINES.reduce((s, l) => s + l[1], 0), 6, 1e-12); assert.equal(M.LINES.length, 8);
  near(M.fid(0), 6, 1e-12);
  const [f0, a] = M.LINES[3]; // the OH singlet, well apart from the rest
  near(M.ppmOf(f0), 2.61, 1e-12);
  near(M.absorption(f0), a * M.T2, 0.02 * a * M.T2, 'peak height');
  near(M.absorption(f0, 20), M.absorption(f0), 1e-9, 'a long acquisition is the full transform');
  // Against a direct numerical integral of the cut-off FID.
  for (const [f, T] of [[f0 + 3, 0.3], [-70, 0.8], [10, 0.15]]) { let s = 0; const h = 1e-5; for (let t = h / 2; t < T; t += h) s += M.fid(t) * Math.cos(2 * Math.PI * f * t) * h; near(M.absorption(f, T), s, 0.02 + 0.02 * Math.abs(s)); } // the integral also holds the small counter-rotating part
  let neg = false; for (let f = f0 + 2; f < f0 + 30; f += 0.5) if (M.absorption(f, 0.12) < -0.01) neg = true;
  assert.ok(neg, 'truncation wiggles dip below zero');
});

test('double slit: bright fringes at whole numbers, dark at halves, and the landings follow the intensity', () => {
  near(M.slit(0), 1, 1e-12); near(M.slit(0.5), 0, 1e-12); near(M.slit(1.5), 0, 1e-12); near(M.slit(4.5), 0, 1e-12, 'the envelope zero');
  assert.ok(M.slit(1) > M.slit(2) && M.slit(2) > M.slit(3));
  const P = M.landings(6000);
  let bright = 0;
  for (let i = 0; i < 6000; i++) { const u = P[2 * i]; assert.ok(Math.abs(u) <= 7 && P[2 * i + 1] >= 0 && P[2 * i + 1] < 1); if (Math.abs(u - Math.round(u)) < 0.25) bright++; }
  assert.ok(bright / 6000 > 0.8, `most electrons land on the bright halves: ${bright / 6000}`); // ∫cos² over the bright half = ½ + 1/π ≈ 0.818
  near(bright / 6000, 0.5 + 1 / Math.PI, 0.02);
});

test('Grover: 32 items peak after 4 iterations, and the amplitudes stay normalised', () => {
  assert.equal(M.groverBest(32), 4);
  for (let k = 0; k < 8; k++) { const g = M.grover(32, k); near(g.marked ** 2 + 31 * g.rest ** 2, 1, 1e-12); }
  near(M.grover(32, 0).marked ** 2, 1 / 32, 1e-12); assert.ok(M.grover(32, 4).marked ** 2 > 0.999); assert.ok(M.grover(32, 6).marked ** 2 < M.grover(32, 4).marked ** 2, 'more is worse');
});

test('central limit theorem: standardised means have mean 0 and variance 1; n = 12 is close to normal, n = 1 is flat', () => {
  for (const n of [1, 2, 3, 6, 12]) { const x = M.cltSamples(n, 4000); let m = 0, v = 0; for (const a of x) m += a; m /= 4000; for (const a of x) v += (a - m) ** 2; near(m, 0, 0.06, `mean n=${n}`); near(v / 4000, 1, 0.07, `variance n=${n}`); }
  const flat = M.cltSamples(1, 4000); assert.ok(Math.max(...flat) < Math.sqrt(3) + 1e-6 && Math.min(...flat) > -Math.sqrt(3) - 1e-6);
  const h = M.histogram(M.cltSamples(12, 4000), -3.6, 3.6, 12); near(h[5] + h[6], 4000 * 0.4515, 120, 'within ±0.6σ'); // erf(0.6/√2)
  near(M.normalPdf(0), 0.398942, 1e-6);
});

test('logistic map: a fixed point at r = 2.5, a 2-cycle at r = 3.2, chaos filling the interval at r = 4', () => {
  for (const x of M.logisticOrbit(2.5)) near(x, 0.6, 1e-6);
  const two = [...new Set([...M.logisticOrbit(3.2)].map((x) => x.toFixed(4)))].sort(); assert.deepEqual(two, ['0.5130', '0.7995']);
  const c = M.logisticOrbit(4, 300, 2000, 0.3); assert.ok(Math.min(...c) < 0.01 && Math.max(...c) > 0.99);
});

test('H₂ Morse oscillator: well depth, range parameter, the fundamental, turning points on the curve', () => {
  near(M.H2.De, 4.948, 0.002); near(M.H2.a, 1.904, 0.003); assert.equal(M.H2.vmax, 17);
  near((M.morseLevel(1) - M.morseLevel(0)) * 8065.544, 4401.21 - 2 * 121.34, 1e-6); // 4158.5 cm⁻¹ (measured 4161)
  near(M.morse(M.H2.re), 0, 1e-15); near(M.morse(50), M.H2.De, 1e-9);
  for (const v of [0, 5, 17]) { const E = M.morseLevel(v), [a, b] = M.morseTurn(E); assert.ok(E < M.H2.De && a < M.H2.re && b > M.H2.re); near(M.morse(a), E, 1e-9); near(M.morse(b), E, 1e-9); }
  assert.ok(M.morseLevel(17) > M.morseLevel(16));
});

test('Maxwell–Boltzmann: normalised, most probable speed of N₂ at 300 K is 422 m/s', () => {
  near(M.vMostProbable(300), 422, 0.5);
  for (const T of [100, 300, 1000]) { let s = 0, best = 0, at = 0; for (let v = 0.5; v < 6000; v += 1) { const f = M.maxwell(v, T); s += f; if (f > best) { best = f; at = v; } } near(s, 1, 1e-4); near(at, M.vMostProbable(T), 1); }
  near(M.maxwell(M.vMostProbable(100), 100), 4 / (Math.sqrt(Math.PI) * Math.E * M.vMostProbable(100)), 1e-9);
});

test('chlorine isotope clusters: 3 : 1 for one chlorine, about 9 : 6 : 1 for two', () => {
  const one = M.chlorinePattern(1); near(one[1][1], 0.2424 / 0.7576, 1e-12);
  const two = M.chlorinePattern(2).map((p) => p[1]); near(two[1], 0.640, 0.001); near(two[2], 0.102, 0.001);
  assert.equal(M.chlorinePattern(4).length, 5); assert.equal(Math.max(...M.chlorinePattern(4).map((p) => p[1])), 1);
});
