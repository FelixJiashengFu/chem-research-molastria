/* 数学基础与探索 · “概率论与随机过程”详解里交互演示的数学（纯函数，不碰 DOM；tools/fm-prob-test.mjs 检验）。
   演示 1：大数定律。掷硬币、掷骰子或抽指数分布，累计平均值 x̄ₙ 收敛到期望 μ，图上画出逐点 95% 区间 μ ± 1.96σ/√n。
   演示 2：中心极限定理。从一个偏斜的分布（指数分布、灌铅骰子）里抽 n 个数求平均，重复很多次，
   样本均值的直方图对照均值 μ、标准差 σ/√n 的正态密度。离散分布的样本均值只取 k/n 这些格点值，分箱对齐格点，避免出现梳齿。
   随机数用带种子的 mulberry32：同一个种子得到同一串数，所以演示可以复现。 */
(() => {
  'use strict';
  const P = {};

  // 可复现的随机数（mulberry32），返回 [0, 1) 上的均匀分布
  P.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // 分布：离散的写出取值和概率（整数取值，步长 1），连续的写出抽样方法和精确矩。
  P.DISTS = {
    coin: { kind: 'discrete', values: [0, 1], probs: [0.5, 0.5] },                          // 正面记 1
    die: { kind: 'discrete', values: [1, 2, 3, 4, 5, 6], probs: [1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6, 1 / 6] },
    loaded: { kind: 'discrete', values: [1, 2, 3, 4, 5, 6], probs: [0.1, 0.1, 0.1, 0.1, 0.1, 0.5] }, // 灌铅骰子：一半的时候是 6
    exp: { kind: 'exp', rate: 1, min: 0 },                                                    // 指数分布，λ = 1
  };

  // 精确的均值、方差、标准差、偏度
  P.moments = (d) => {
    if (d.kind === 'exp') { const m = 1 / d.rate; return { mean: m, variance: m * m, sd: m, skew: 2 }; }
    const mean = d.values.reduce((s, v, i) => s + v * d.probs[i], 0);
    const c = (k) => d.values.reduce((s, v, i) => s + (v - mean) ** k * d.probs[i], 0);
    const variance = c(2), sd = Math.sqrt(variance);
    return { mean, variance, sd, skew: c(3) / sd ** 3 };
  };
  P.support = (d) => (d.kind === 'exp' ? [0, Infinity] : [Math.min(...d.values), Math.max(...d.values)]);

  // 抽样器：离散分布按累积概率反查，指数分布用 −ln(1 − u)/λ
  P.sampler = (d, rand) => {
    if (d.kind === 'exp') return () => -Math.log(1 - rand()) / d.rate;
    const cum = []; let s = 0;
    for (const p of d.probs) cum.push(s += p);
    cum[cum.length - 1] = 1;
    return () => { const u = rand(); let i = 0; while (u >= cum[i]) i++; return d.values[i]; };
  };

  // 大数定律：前 N 次的累计平均值 x̄₁ … x̄_N
  P.runningMean = (d, N, seed) => {
    const draw = P.sampler(d, P.rng(seed)), out = new Float64Array(N);
    let s = 0;
    for (let i = 0; i < N; i++) { s += draw(); out[i] = s / (i + 1); }
    return out;
  };
  // 逐点区间的半宽 z·σ/√n（z = 1.96 时是 95%）
  P.band = (d, n, z = 1.96) => (z * P.moments(d).sd) / Math.sqrt(n);

  // 中心极限定理：count 个样本均值，每个是 n 次抽样的平均
  P.sampleMeans = (d, n, count, rand) => {
    const draw = P.sampler(d, rand), out = new Float64Array(count);
    for (let j = 0; j < count; j++) { let s = 0; for (let i = 0; i < n; i++) s += draw(); out[j] = s / n; }
    return out;
  };

  // 分箱：显示范围取 μ ± 4.5σ/√n（指数分布右边多留一些），截到支撑集内。
  // 离散分布的和 S = n·x̄ 是整数，每个箱子装 k 个相邻的整数，箱子边界落在半整数上，格点永远在箱子正中间附近。
  P.binsFor = (d, n, maxBins = 48) => {
    const { mean, sd } = P.moments(d), s = sd / Math.sqrt(n), [a, b] = P.support(d);
    if (d.kind === 'exp') {
      const lo = Math.max(a, mean - 4.5 * s), hi = mean + (n < 4 ? 6 : 5) * s;
      return { lo, hi, bins: maxBins, step: 0 };
    }
    const sLo = Math.max(n * a, Math.floor(n * (mean - 4.5 * s))), sHi = Math.min(n * b, Math.ceil(n * (mean + 4.5 * s)));
    const m = sHi - sLo + 1, k = Math.ceil(m / maxBins), bins = Math.ceil(m / k);
    return { lo: (sLo - 0.5) / n, hi: (sLo - 0.5 + bins * k) / n, bins, step: 1 / n };
  };
  // 直方图：counts 是每个箱子的个数，under / over 是落在范围外的个数；counts 之和 + under + over = 样本数
  P.histogram = (xs, lo, hi, bins) => {
    const counts = new Array(bins).fill(0), width = (hi - lo) / bins;
    let under = 0, over = 0;
    for (const x of xs) {
      if (x < lo) { under++; continue; }
      if (x >= hi) { over++; continue; }
      counts[Math.min(bins - 1, Math.floor((x - lo) / width))]++;
    }
    return { counts, lo, hi, width, under, over };
  };

  // 正态密度
  P.normalPdf = (x, mu, sigma) => Math.exp(-0.5 * ((x - mu) / sigma) ** 2) / (sigma * Math.sqrt(2 * Math.PI));

  // 一组数的均值、标准差（n − 1 归一）和偏度
  P.summary = (xs) => {
    const n = xs.length;
    if (!n) return { n, mean: NaN, sd: NaN, skew: NaN };
    let m = 0; for (const x of xs) m += x; m /= n;
    let c2 = 0, c3 = 0; for (const x of xs) { const d = x - m; c2 += d * d; c3 += d * d * d; }
    const sd = n > 1 ? Math.sqrt(c2 / (n - 1)) : 0, pop = Math.sqrt(c2 / n);
    return { n, mean: m, sd, skew: pop > 0 ? (c3 / n) / pop ** 3 : 0 };
  };

  if (typeof window !== 'undefined') window.MOLASTRIA_FM_PROB = P;
  if (typeof module !== 'undefined') module.exports = P;
})();
