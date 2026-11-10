// Tests for the probability demos in 数学基础与探索 (public/fundamental-science/math/fm-prob.js): the seeded RNG,
// the exact moments and the samplers, the normal density, the lattice-aligned histogram, and the two theorems the demos show.
//   node --test tools/fm-prob-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/fundamental-science/math/fm-prob.js', import.meta.url), 'utf8'), box);
const P = box.window.MOLASTRIA_FM_PROB;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('RNG: reproducible from its seed, in [0, 1), uniform by a chi-square test, with the right mean and variance', () => {
  const a = P.rng(2026), b = P.rng(2026), c = P.rng(2027);
  const sa = Array.from({ length: 50 }, a), sb = Array.from({ length: 50 }, b), sc = Array.from({ length: 50 }, c);
  assert.deepEqual(sa, sb, 'same seed, same stream');
  assert.notDeepEqual(sa, sc, 'another seed, another stream');
  const r = P.rng(1), N = 200000, K = 20, bins = new Array(K).fill(0);
  let s = 0, s2 = 0;
  for (let i = 0; i < N; i++) { const u = r(); assert.ok(u >= 0 && u < 1); bins[Math.floor(u * K)]++; s += u; s2 += u * u; }
  const chi2 = bins.reduce((t, o) => t + (o - N / K) ** 2 / (N / K), 0);
  assert.ok(chi2 < 43.82, `chi-square with 19 degrees of freedom below its 99.9 % point: ${chi2}`);
  close(s / N, 0.5, 5 * Math.sqrt(1 / 12 / N), 'mean 1/2');
  close(s2 / N - (s / N) ** 2, 1 / 12, 2e-3, 'variance 1/12');
});

test('distributions: exact moments of the coin, the fair die, the loaded die and the exponential', () => {
  const m = (k) => P.moments(P.DISTS[k]);
  close(m('coin').mean, 0.5, 1e-15, 'coin mean'); close(m('coin').variance, 0.25, 1e-15, 'coin variance'); close(m('coin').skew, 0, 1e-12, 'coin skew');
  close(m('die').mean, 3.5, 1e-12, 'die mean'); close(m('die').variance, 35 / 12, 1e-12, 'die variance'); close(m('die').skew, 0, 1e-12, 'die skew');
  // Loaded die: P(6) = 1/2, P(1…5) = 1/10 each. E X = 4.5, E X² = 23.5, Var = 3.25, third central moment = −4.5.
  close(m('loaded').mean, 4.5, 1e-12, 'loaded mean'); close(m('loaded').variance, 3.25, 1e-12, 'loaded variance');
  close(m('loaded').skew, -4.5 / 3.25 ** 1.5, 1e-12, 'loaded skew (left-skewed)');
  close(m('exp').mean, 1, 0, 'exp mean'); close(m('exp').variance, 1, 0, 'exp variance'); close(m('exp').skew, 2, 0, 'exp skew');
  for (const d of Object.values(P.DISTS)) if (d.probs) close(d.probs.reduce((a, b) => a + b, 0), 1, 1e-12, 'probabilities sum to 1');
});

test('samplers: sample mean and variance agree with the exact values within a few standard errors', () => {
  const N = 200000;
  // Fourth central moments, to size the standard error of the sample variance: Var(s²) ≈ (μ₄ − σ⁴)/N.
  const mu4 = (d) => { if (d.kind === 'exp') return 9; const { mean } = P.moments(d); return d.values.reduce((s, v, i) => s + (v - mean) ** 4 * d.probs[i], 0); };
  for (const [k, d] of Object.entries(P.DISTS)) {
    const draw = P.sampler(d, P.rng(11)), { mean, variance } = P.moments(d), [lo, hi] = P.support(d);
    let s = 0, s2 = 0;
    for (let i = 0; i < N; i++) { const x = draw(); assert.ok(x >= lo && x <= hi, `${k}: ${x} in the support`); if (d.values) assert.ok(d.values.includes(x)); s += x; s2 += x * x; }
    const m = s / N, v = s2 / N - m * m;
    close(m, mean, 5 * Math.sqrt(variance / N), `${k}: mean`);
    close(v, variance, 5 * Math.sqrt((mu4(d) - variance ** 2) / N) + 1e-3 * variance, `${k}: variance`);
  }
  // The discrete sampler hits each face with its probability.
  const d = P.DISTS.loaded, draw = P.sampler(d, P.rng(5)), seen = new Map();
  for (let i = 0; i < N; i++) { const x = draw(); seen.set(x, (seen.get(x) || 0) + 1); }
  d.values.forEach((v, i) => close(seen.get(v) / N, d.probs[i], 5 * Math.sqrt(d.probs[i] * (1 - d.probs[i]) / N), `loaded die face ${v}`));
});

test('normal density: integrates to 1 with mean μ and variance σ²', () => {
  for (const [mu, sigma] of [[0, 1], [3.5, 0.17], [1, 0.05], [-2, 4]]) {
    const a = mu - 12 * sigma, b = mu + 12 * sigma, n = 4000, h = (b - a) / n;
    let i0 = 0, i1 = 0, i2 = 0;
    for (let k = 0; k <= n; k++) { const x = a + k * h, w = k === 0 || k === n ? 1 : k % 2 ? 4 : 2, f = P.normalPdf(x, mu, sigma); i0 += w * f; i1 += w * f * x; i2 += w * f * (x - mu) ** 2; }
    close(i0 * h / 3, 1, 1e-10, `∫φ = 1 (μ = ${mu}, σ = ${sigma})`);
    close(i1 * h / 3, mu, 1e-9 * Math.max(1, Math.abs(mu)), 'mean');
    close(i2 * h / 3, sigma * sigma, 1e-9 * sigma * sigma, 'variance');
  }
  close(P.normalPdf(0, 0, 1), 1 / Math.sqrt(2 * Math.PI), 1e-15, 'φ(0)');
});

test('histogram: bins plus the two overflow counts sum to n, and discrete bins are centred on the lattice', () => {
  const rand = P.rng(3);
  for (const [k, d] of Object.entries(P.DISTS)) for (const n of [1, 2, 5, 30, 100]) {
    const xs = P.sampleMeans(d, n, 3000, rand), { lo, hi, bins, step } = P.binsFor(d, n), h = P.histogram(xs, lo, hi, bins);
    assert.equal(h.counts.length, bins);
    assert.equal(h.counts.reduce((a, b) => a + b, 0) + h.under + h.over, xs.length, `${k}, n = ${n}: nothing lost`);
    assert.ok((h.under + h.over) / xs.length < 0.01, `${k}, n = ${n}: the range holds almost everything`);
    close(h.width, (hi - lo) / bins, 1e-12, 'width');
    if (step) {
      // Each bin holds a whole number of lattice points k/n, none of them on an edge.
      const per = h.width / step;
      close(per, Math.round(per), 1e-9, `${k}, n = ${n}: whole lattice points per bin`);
      for (const x of xs.slice(0, 200)) { const f = (x - lo) / h.width; assert.ok(Math.abs(f - Math.round(f)) > 0.4 / Math.round(per) - 1e-9, `${k}, n = ${n}: ${x} away from an edge`); }
    }
  }
  const all = P.histogram([0, 0.1, 0.5, 0.99, 1, 2, -1], 0, 1, 4);
  assert.deepEqual([[...all.counts], all.under, all.over], [[2, 0, 1, 1], 1, 2]);
  const inside = P.histogram([0.2, 0.4, 0.6, 0.8], 0, 1, 5);
  assert.equal(inside.counts.reduce((a, b) => a + b, 0), 4, 'a range that holds every value counts all n');
});

test('law of large numbers: the running mean is reproducible and settles inside the 1/√N band', () => {
  const a = P.runningMean(P.DISTS.die, 5000, 42), b = P.runningMean(P.DISTS.die, 5000, 42);
  assert.deepEqual([...a], [...b], 'same seed, same path');
  const draw = P.sampler(P.DISTS.die, P.rng(42)); let s = 0; for (let i = 0; i < 5000; i++) s += draw();
  close(a[4999], s / 5000, 1e-12, 'the last point is the mean of the same draws');
  assert.equal(P.runningMean(P.DISTS.die, 100, 42)[99], a[99], 'a shorter run is a prefix of a longer one');
  for (const [k, d] of Object.entries(P.DISTS)) {
    const N = 100000, x = P.runningMean(d, N, 7), { mean, sd } = P.moments(d);
    close(x[N - 1], mean, 4 * sd / Math.sqrt(N), `${k}: x̄_N near μ`);
  }
  close(P.band(P.DISTS.coin, 100), 1.96 * 0.5 / 10, 1e-15, 'band half-width 1.96σ/√n');
});

test('central limit theorem: sample means have mean μ, spread σ/√n and skewness shrinking like 1/√n', () => {
  const rand = P.rng(9);
  for (const [k, d] of Object.entries(P.DISTS)) for (const n of [1, 4, 30]) {
    const xs = P.sampleMeans(d, n, 20000, rand), s = P.summary(xs), { mean, sd, skew } = P.moments(d), se = sd / Math.sqrt(n);
    close(s.mean, mean, 5 * se / Math.sqrt(xs.length), `${k}, n = ${n}: mean of means`);
    close(s.sd / se, 1, 0.04, `${k}, n = ${n}: sd of means / (σ/√n)`);
    close(s.skew, skew / Math.sqrt(n), 0.12, `${k}, n = ${n}: skewness γ/√n`);
  }
  // For n = 30 exponential means, the histogram is close to the normal density: total variation under 0.06.
  const d = P.DISTS.exp, n = 30, xs = P.sampleMeans(d, n, 40000, rand), { lo, hi, bins } = P.binsFor(d, n), h = P.histogram(xs, lo, hi, bins);
  let tv = 0;
  h.counts.forEach((c, j) => { const x = lo + (j + 0.5) * h.width; tv += Math.abs(c / xs.length - P.normalPdf(x, 1, 1 / Math.sqrt(n)) * h.width); });
  assert.ok(tv / 2 < 0.06, `total variation ${tv / 2}`);
  assert.deepEqual(P.summary([]).n, 0);
});
