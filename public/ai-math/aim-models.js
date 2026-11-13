/* 前沿 AI 数学 · 交互演示的数学（纯函数，不碰 DOM；tools/ai-math-test.mjs 对照解析解和讲义的核验记录）。
   每一组函数对应一个主题的演示：线性代数与优化（01–09）、序列模型（10–16）、生成模型（17–29）、决策（30–34）、
   学习理论与科学 AI（35–42），以及附录 K 的数值核验。所有随机数都来自带种子的 rng，同一个种子同一个结果。 */
(() => {
  'use strict';
  const M = {};

  // ── 随机数、基本函数 ────────────────────────────────────────────────────
  M.rng = (seed) => { let a = seed >>> 0; return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  M.gauss = (rand) => { let u = 0; while (u === 0) u = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * rand()); };
  M.linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  M.normalPdf = (x, mu = 0, sd = 1) => Math.exp(-0.5 * ((x - mu) / sd) ** 2) / (sd * Math.sqrt(2 * Math.PI));
  M.sigmoid = (x) => 1 / (1 + Math.exp(-x));
  M.softmax = (s, temp = 1) => { const m = Math.max(...s), e = s.map((v) => Math.exp((v - m) / temp)), z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); };
  M.lgamma = (x) => { // Lanczos
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, t = x + 5.5; t -= (x + 0.5) * Math.log(t); let s = 1.000000000190015;
    for (const c of g) s += c / ++y;
    return -t + Math.log((2.5066282746310005 * s) / x);
  };
  M.trapz = (xs, ys) => { let s = 0; for (let i = 1; i < xs.length; i++) s += 0.5 * (ys[i] + ys[i - 1]) * (xs[i] - xs[i - 1]); return s; };

  // ── 小矩阵工具（行主序的二维数组） ──────────────────────────────────────
  M.matmul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((s, v, k) => s + v * B[k][j], 0)));
  M.transpose = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  M.matvec = (A, v) => A.map((r) => r.reduce((s, x, k) => s + x * v[k], 0));
  M.norm = (v) => Math.hypot(...v);
  M.rot2 = (a) => [[Math.cos(a), -Math.sin(a)], [Math.sin(a), Math.cos(a)]];
  // 谱范数：对 AᵀA 做幂迭代
  M.specNorm = (A, iters = 200) => {
    const At = M.transpose(A); let v = A[0].map((_, i) => 1 + 0.1 * i), s = 0;
    for (let k = 0; k < iters; k++) { const w = M.matvec(At, M.matvec(A, v)); const n = M.norm(w); if (n === 0) return 0; v = w.map((x) => x / n); s = Math.sqrt(n); }
    return s;
  };
  // 解线性方程组 Ax = b（部分选主元的高斯消元）；A 是方阵
  M.solve = (A, b) => {
    const n = A.length, a = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(a[r][c]) > Math.abs(a[p][c])) p = r;
      [a[c], a[p]] = [a[p], a[c]];
      if (Math.abs(a[c][c]) < 1e-14) a[c][c] = 1e-14;
      for (let r = c + 1; r < n; r++) { const f = a[r][c] / a[c][c]; for (let k = c; k <= n; k++) a[r][k] -= f * a[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = a[r][n]; for (let k = r + 1; k < n; k++) s -= a[r][k] * x[k]; x[r] = s / a[r][r]; }
    return x;
  };

  // ── 01 表征：马氏距离 ‖x−y‖²_M，M = LᵀL ──────────────────────────────────
  M.linearMap = (sx, sy, shear, angle) => M.matmul(M.rot2(angle), [[sx, shear], [0, sy]]);
  M.mahalanobis = (x, y, L) => M.norm(M.matvec(L, [x[0] - y[0], x[1] - y[1]]));
  M.cosine = (x, y) => (x[0] * y[0] + x[1] * y[1]) / (M.norm(x) * M.norm(y));
  M.cloud = (n, seed = 20261112) => { const r = M.rng(seed), pts = []; for (let i = 0; i < n; i++) pts.push([1.5 * M.gauss(r), 0.35 * M.gauss(r)]); return pts.sort((a, b) => a[0] - b[0]); };

  // ── 02 SVD、低秩与 LoRA ─────────────────────────────────────────────────
  M.spectrum = (n, decay) => Array.from({ length: n }, (_, i) => Math.exp(-i / decay));
  M.energyKept = (sig, r) => { const tot = sig.reduce((s, v) => s + v * v, 0); return sig.slice(0, r).reduce((s, v) => s + v * v, 0) / tot; };
  M.loraFraction = (m, n, r) => (r * (m + n)) / (m * n);

  // ── 03 反向传播：y = w₂·tanh(w₁x)，L = ½(y − target)² ──────────────────
  M.tinyNet = (x, w1, w2, target) => {
    const z = w1 * x, h = Math.tanh(z), y = w2 * h, L = 0.5 * (y - target) ** 2;
    const yb = y - target, hb = w2 * yb, zb = (1 - h * h) * hb;
    return { z, h, y, L, yb, hb, zb, gw2: h * yb, gw1: x * zb, gx: w1 * zb };
  };
  M.tinyNetFD = (x, w1, w2, target, eps = 1e-5) => {
    const f = (a, b) => M.tinyNet(x, a, b, target).L;
    return { gw1: (f(w1 + eps, w2) - f(w1 - eps, w2)) / (2 * eps), gw2: (f(w1, w2 + eps) - f(w1, w2 - eps)) / (2 * eps) };
  };

  // ── 04 Beta–Bernoulli ───────────────────────────────────────────────────
  M.betaPdf = (x, a, b) => (x <= 0 || x >= 1 ? 0 : Math.exp((a - 1) * Math.log(x) + (b - 1) * Math.log(1 - x) + M.lgamma(a + b) - M.lgamma(a) - M.lgamma(b)));
  M.betaMean = (a, b) => a / (a + b);
  M.betaSd = (a, b) => Math.sqrt((a * b) / ((a + b) ** 2 * (a + b + 1)));

  // ── 05 KL 的两个方向：双峰目标 p 与高斯候选 q ───────────────────────────
  M.bimodal = (x, sep = 2, sd = 0.6) => 0.5 * M.normalPdf(x, -sep, sd) + 0.5 * M.normalPdf(x, sep, sd);
  M.klPair = (mu, sd, sep = 2, psd = 0.6) => {
    const xs = M.linspace(-12, 12, 2401); let fwd = 0, rev = 0, hp = 0;
    const dx = xs[1] - xs[0];
    for (const x of xs) {
      const p = M.bimodal(x, sep, psd), q = M.normalPdf(x, mu, sd), lq = -0.5 * ((x - mu) / sd) ** 2 - Math.log(sd * Math.sqrt(2 * Math.PI));
      if (p > 1e-300) { fwd += p * (Math.log(p) - lq) * dx; hp -= p * Math.log(p) * dx; }
      if (q > 1e-300) rev += q * (lq - Math.log(Math.max(p, 1e-300))) * dx;
    }
    return { forward: fwd, reverse: rev, entropy: hp, cross: hp + fwd };
  };
  // 正向 KL 在高斯族里的最小点是矩匹配；反向 KL 用坐标搜索求
  M.forwardFit = (sep = 2, psd = 0.6) => ({ mu: 0, sd: Math.sqrt(sep * sep + psd * psd) });
  M.reverseFit = (sep = 2, psd = 0.6, start = 1) => {
    let mu = start * sep, sd = psd, step = 0.2, best = M.klPair(mu, sd, sep, psd).reverse;
    for (let it = 0; it < 80 && step > 1e-4; it++) {
      let moved = false;
      for (const [dm, ds] of [[step, 0], [-step, 0], [0, step], [0, -step]]) {
        const s2 = sd + ds; if (s2 <= 0.05) continue;
        const v = M.klPair(mu + dm, s2, sep, psd).reverse;
        if (v < best - 1e-12) { best = v; mu += dm; sd = s2; moved = true; }
      }
      if (!moved) step /= 2;
    }
    return { mu, sd, kl: best };
  };

  // ── 06 高维：薄壳与点积的尺度 ───────────────────────────────────────────
  M.shellSamples = (d, n, seed = 20261112) => { const r = M.rng(seed + d), out = []; for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < d; k++) { const g = M.gauss(r); s += g * g; } out.push(Math.sqrt(s / d)); } return out; };
  M.shellSd = (d) => 1 / Math.sqrt(2 * d); // ‖X‖/√d 的标准差（大 d 近似）
  M.dotSamples = (d, n, seed = 7) => { const r = M.rng(seed + d), out = []; for (let i = 0; i < n; i++) { let s = 0; for (let k = 0; k < d; k++) s += M.gauss(r) * M.gauss(r); out.push(s); } return out; };
  M.histogram = (vals, lo, hi, bins) => { const h = new Array(bins).fill(0), w = (hi - lo) / bins; for (const v of vals) { const i = Math.floor((v - lo) / w); if (i >= 0 && i < bins) h[i]++; } return h.map((c) => c / (vals.length * w)); };
  M.sd = (v) => { const m = v.reduce((a, b) => a + b, 0) / v.length; return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length); };

  // ── 07 二次损失上的梯度下降、理想预条件、Adam ───────────────────────────
  // L = ½(θ₁² + κθ₂²)
  M.gdPath = (start, eta, kappa, steps, momentum = 0) => { let [a, b] = start, va = 0, vb = 0; const out = [[a, b]]; for (let i = 0; i < steps; i++) { va = momentum * va + a; vb = momentum * vb + kappa * b; a -= eta * va; b -= eta * vb; out.push([a, b]); if (!Number.isFinite(a + b) || Math.abs(a) + Math.abs(b) > 1e6) break; } return out; };
  M.precondPath = (start, eta, steps) => { let [a, b] = start; const out = [[a, b]]; for (let i = 0; i < steps; i++) { a -= eta * a; b -= eta * b; out.push([a, b]); } return out; };
  M.adamPath = (start, eta, kappa, steps, b1 = 0.9, b2 = 0.999, eps = 1e-8, wd = 0) => {
    let th = [...start], m = [0, 0], v = [0, 0]; const out = [[...th]];
    for (let t = 1; t <= steps; t++) {
      const g = [th[0], kappa * th[1]];
      for (let i = 0; i < 2; i++) { m[i] = b1 * m[i] + (1 - b1) * g[i]; v[i] = b2 * v[i] + (1 - b2) * g[i] * g[i]; const mh = m[i] / (1 - b1 ** t), vh = v[i] / (1 - b2 ** t); th[i] = (1 - eta * wd) * th[i] - (eta * mh) / (Math.sqrt(vh) + eps); }
      out.push([...th]);
    }
    return out;
  };
  M.quadLoss = (p, kappa) => 0.5 * (p[0] * p[0] + kappa * p[1] * p[1]);

  // ── 08 自然梯度：Δ* = −√(2δ / gᵀF⁻¹g) F⁻¹g ─────────────────────────────
  M.fisher2 = (a, b, angle) => { const R = M.rot2(angle); return M.matmul(M.matmul(R, [[a, 0], [0, b]]), M.transpose(R)); };
  M.inv2 = (A) => { const d = A[0][0] * A[1][1] - A[0][1] * A[1][0]; return [[A[1][1] / d, -A[0][1] / d], [-A[1][0] / d, A[0][0] / d]]; };
  M.naturalStep = (F, g, delta) => { const Fi = M.inv2(F), d = M.matvec(Fi, g), q = g[0] * d[0] + g[1] * d[1], s = Math.sqrt((2 * delta) / q); return [-s * d[0], -s * d[1]]; };
  M.quadForm = (F, d) => d[0] * (F[0][0] * d[0] + F[0][1] * d[1]) + d[1] * (F[1][0] * d[0] + F[1][1] * d[1]);
  // 伯努利分布 KL(p‖p+Δ) 与 ½FΔ²（F = 1/(p(1−p))）的对照
  M.bernKL = (p, q) => p * Math.log(p / q) + (1 - p) * Math.log((1 - p) / (1 - q));

  // ── 09 Muon：极因子与 Newton–Schulz（三次迭代 s ← 1.5s − 0.5s³） ────────
  M.newtonSchulz = (sig, iters) => { const top = Math.max(...sig); let s = sig.map((v) => v / top); for (let k = 0; k < iters; k++) s = s.map((v) => 1.5 * v - 0.5 * v ** 3); return s; };
  M.nuclear = (sig) => sig.reduce((a, b) => a + b, 0);

  // ── 11 注意力 ───────────────────────────────────────────────────────────
  M.attention = (q, keys, values, scale = Math.sqrt(q.length), mask = null) => {
    const scores = keys.map((k, j) => (mask && !mask[j] ? -Infinity : k.reduce((s, v, i) => s + v * q[i], 0) / scale));
    const w = M.softmax(scores.map((s) => (s === -Infinity ? -1e9 : s)));
    const out = values[0].map((_, c) => values.reduce((s, v, j) => s + w[j] * v[c], 0));
    return { scores, weights: w, out };
  };
  M.softmaxJacobian = (a) => a.map((ai, i) => a.map((aj, j) => ai * ((i === j ? 1 : 0) - aj)));
  M.causalWeights = (logits) => logits.map((row, i) => { const w = M.softmax(row.slice(0, i + 1)); return row.map((_, j) => (j <= i ? w[j] : 0)); });
  // 附录 B：O = AV，A = row-softmax(QKᵀ/√d)，上游 G = ∂L/∂O
  M.attnForward = (Q, K, V) => { const d = Q[0].length, S = M.matmul(Q, M.transpose(K)).map((r) => r.map((v) => v / Math.sqrt(d))), A = S.map((r) => M.softmax(r)); return { S, A, O: M.matmul(A, V) }; };
  M.attnBackward = (Q, K, V, G) => {
    const d = Q[0].length, { A } = M.attnForward(Q, K, V);
    const Vb = M.matmul(M.transpose(A), G), B = M.matmul(G, M.transpose(V));
    const Sb = A.map((r, i) => { const dot = r.reduce((s, a, k) => s + a * B[i][k], 0); return r.map((a, j) => a * (B[i][j] - dot)); });
    const Qb = M.matmul(Sb, K).map((r) => r.map((v) => v / Math.sqrt(d))), Kb = M.matmul(M.transpose(Sb), Q).map((r) => r.map((v) => v / Math.sqrt(d)));
    return { Qb, Kb, Vb, Sb };
  };
  M.randMat = (rows, cols, rand) => Array.from({ length: rows }, () => Array.from({ length: cols }, () => M.gauss(rand)));
  M.frob = (A, B) => A.reduce((s, r, i) => s + r.reduce((t, v, j) => t + v * B[i][j], 0), 0);
  // 方向导数：解析值 ⟨∇L, D⟩ 与中心差分
  M.attnGradCheck = (seed = 37, h = 1e-5, n = 4, d = 3) => {
    const r = M.rng(seed), Q = M.randMat(n, d, r), K = M.randMat(n, d, r), V = M.randMat(n, d, r), G = M.randMat(n, d, r);
    const DQ = M.randMat(n, d, r), DK = M.randMat(n, d, r), DV = M.randMat(n, d, r);
    const loss = (q, k, v) => M.frob(G, M.attnForward(q, k, v).O);
    const add = (A, D, s) => A.map((row, i) => row.map((x, j) => x + s * D[i][j]));
    const b = M.attnBackward(Q, K, V, G);
    const analytic = M.frob(b.Qb, DQ) + M.frob(b.Kb, DK) + M.frob(b.Vb, DV);
    const numeric = (loss(add(Q, DQ, h), add(K, DK, h), add(V, DV, h)) - loss(add(Q, DQ, -h), add(K, DK, -h), add(V, DV, -h))) / (2 * h);
    return { analytic, numeric, rel: Math.abs(analytic - numeric) / Math.abs(analytic) };
  };

  // ── 12 RoPE ─────────────────────────────────────────────────────────────
  M.ropeDot = (q, k, m, n, w) => { const a = M.matvec(M.rot2(m * w), q), b = M.matvec(M.rot2(n * w), k); return a[0] * b[0] + a[1] * b[1]; };
  M.ropeRel = (q, k, rel, w) => { const b = M.matvec(M.rot2(rel * w), k); return q[0] * b[0] + q[1] * b[1]; };

  // ── 13 双随机混合与 Sinkhorn 归一化 ─────────────────────────────────────
  M.sinkhornNormalize = (A, iters) => {
    let P = A.map((r) => [...r]);
    for (let k = 0; k < iters; k++) {
      P = P.map((r) => { const s = r.reduce((a, b) => a + b, 0); return r.map((v) => v / s); });
      const cs = P[0].map((_, j) => P.reduce((s, r) => s + r[j], 0));
      P = P.map((r) => r.map((v, j) => v / cs[j]));
    }
    return P;
  };
  M.marginResidual = (P) => { let m = 0; for (const r of P) m = Math.max(m, Math.abs(r.reduce((a, b) => a + b, 0) - 1)); for (let j = 0; j < P[0].length; j++) m = Math.max(m, Math.abs(P.reduce((s, r) => s + r[j], 0) - 1)); return m; };
  M.positiveMatrix = (n, seed = 20261112) => { const r = M.rng(seed); return Array.from({ length: n }, () => Array.from({ length: n }, () => 0.1 + r())); };
  M.repeatNorms = (A, v, layers) => { const out = [M.norm(v)]; let x = [...v]; for (let i = 0; i < layers; i++) { x = M.matvec(A, x); out.push(M.norm(x)); } return out; };

  // ── 14 状态空间模型：hₜ = a hₜ₋₁ + xₜ ─────────────────────────────────
  M.ssmKernel = (a, n) => Array.from({ length: n }, (_, t) => Array.from({ length: n }, (_, s) => (s <= t ? a ** (t - s) : 0)));
  M.ssmRun = (a, xs) => { let h = 0; return xs.map((x) => (h = a * h + x)); };
  M.zoh = (A, B, dt) => { const Ab = Math.exp(A * dt); return { Ab, Bb: Math.abs(A) < 1e-12 ? B * dt : ((Ab - 1) / A) * B }; };

  // ── 15 MoE：top-k 路由 ──────────────────────────────────────────────────
  M.moeRoute = (tokens, experts, k, skew = 1, balance = 0, seed = 20261112) => {
    const r = M.rng(seed), bias = Array.from({ length: experts }, (_, e) => skew * (e === 0 ? 1.2 : e === 2 ? 0.8 : e === 4 ? 0.3 : 0));
    const logits = Array.from({ length: tokens }, () => bias.map((b) => b + M.gauss(r)));
    const load = new Array(experts).fill(0), route = [];
    for (const row of logits) { // 负载均衡偏置：已经接了很多 token 的专家被压低
      const adj = row.map((v, e) => v - balance * load[e]);
      const idx = adj.map((v, e) => [v, e]).sort((x, y) => y[0] - x[0]).slice(0, k).map((x) => x[1]);
      const w = M.softmax(idx.map((e) => adj[e])), g = new Array(experts).fill(0);
      idx.forEach((e, i) => { g[e] = w[i]; load[e]++; });
      route.push(g);
    }
    return { route, load, mean: (tokens * k) / experts };
  };

  // ── 16 对比学习：InfoNCE ────────────────────────────────────────────────
  M.pairEmbeddings = (n, d, noise, seed = 20261112) => {
    const r = M.rng(seed), unit = (v) => { const s = M.norm(v); return v.map((x) => x / s); };
    const img = Array.from({ length: n }, () => unit(Array.from({ length: d }, () => M.gauss(r))));
    const txt = img.map((v) => unit(v.map((x) => x + noise * M.gauss(r))));
    return { img, txt };
  };
  M.infoNCE = (img, txt, tau) => {
    const sim = img.map((z) => txt.map((w) => z.reduce((s, v, i) => s + v * w[i], 0)));
    const P = sim.map((row) => M.softmax(row, tau));
    const loss = -P.reduce((s, row, i) => s + Math.log(row[i]), 0) / P.length;
    return { sim, P, loss };
  };

  // ── 18 VAE：高斯 KL 的闭式 ──────────────────────────────────────────────
  M.gaussKL = (mu, sd) => 0.5 * (mu * mu + sd * sd - 1 - Math.log(sd * sd));
  M.gaussKLnumeric = (mu, sd) => { const xs = M.linspace(mu - 10 * sd - 2, mu + 10 * sd + 2, 8001); return M.trapz(xs, xs.map((x) => { const q = M.normalPdf(x, mu, sd); return q > 1e-300 ? q * (Math.log(q) - Math.log(M.normalPdf(x))) : 0; })); };

  // ── 19 掩码扩散 ─────────────────────────────────────────────────────────
  M.maskTokens = (n, t, seed = 20261112) => { const r = M.rng(seed), u = Array.from({ length: n }, () => r()); return u.map((v) => v < t); }; // 同一组均匀数：t 增大时掩码只增不减
  M.unmaskOrder = (n, seed = 5) => { const r = M.rng(seed); return Array.from({ length: n }, (_, i) => [r(), i]).sort((a, b) => a[0] - b[0]).map((x) => x[1]); };

  // ── 20 DDPM：线性 β 日程与 ᾱ ────────────────────────────────────────────
  M.alphaBar = (T = 1000, b0 = 1e-4, b1 = 0.02) => { const out = [1]; let p = 1; for (let s = 1; s <= T; s++) { p *= 1 - (b0 + ((b1 - b0) * (s - 1)) / (T - 1)); out.push(p); } return out; };
  M.twoBlobs = (n, seed = 20261112) => { const r = M.rng(seed), x0 = [], eps = []; for (let i = 0; i < n; i++) { const c = i % 2 ? [1.6, 1.1] : [-1.6, -1.1]; x0.push([c[0] + 0.28 * M.gauss(r), c[1] + 0.28 * M.gauss(r)]); eps.push([M.gauss(r), M.gauss(r)]); } return { x0, eps }; };
  M.noised = (x0, eps, ab) => x0.map((p, i) => [Math.sqrt(ab) * p[0] + Math.sqrt(1 - ab) * eps[i][0], Math.sqrt(ab) * p[1] + Math.sqrt(1 - ab) * eps[i][1]]);

  // ── 21 Score：双峰高斯混合加噪后的密度、score、去噪均值 ─────────────────
  // x₀ ~ ½N(−m, s²) + ½N(m, s²)，xₜ = a x₀ + σ ε
  M.gmm = (x, m, s, a = 1, sig = 0) => {
    const v = a * a * s * s + sig * sig, sd = Math.sqrt(v), p1 = 0.5 * M.normalPdf(x, -a * m, sd), p2 = 0.5 * M.normalPdf(x, a * m, sd), p = p1 + p2;
    const w1 = p > 0 ? p1 / p : 0.5, w2 = 1 - w1;
    const score = (w1 * (-(x + a * m)) + w2 * (-(x - a * m))) / v;
    const post = (mu) => mu + ((a * s * s) / v) * (x - a * mu); // E[x₀ | xₜ = x, 分量]
    const denoise = w1 * post(-m) + w2 * post(m);
    return { p, score, denoise, w2 };
  };

  // ── 22 OU 过程：dX = −θX dt + g dW，X₀ ~ N(0, v₀) ───────────────────────
  M.ouVar = (t, theta, g, v0 = 1) => v0 * Math.exp(-2 * theta * t) + ((g * g) / (2 * theta)) * (1 - Math.exp(-2 * theta * t));
  M.ouPaths = (n, steps, T, theta, g, seed = 20261112, starts = null) => {
    const r = M.rng(seed), dt = T / steps, paths = [];
    for (let i = 0; i < n; i++) { let x = starts ? starts[i] : M.gauss(r); const p = [x]; for (let k = 0; k < steps; k++) { x += -theta * x * dt + g * Math.sqrt(dt) * M.gauss(r); p.push(x); } paths.push(p); }
    return paths;
  };
  // 概率流 ODE：dx/dt = −θx − ½g²·(−x/v(t)) 的精确解 x(t) = x₀ √(v(t)/v₀)
  M.ouFlow = (x0, t, theta, g, v0 = 1) => x0 * Math.sqrt(M.ouVar(t, theta, g, v0) / v0);
  // 反向 SDE（正时钟 τ = T − t）：dX = [θX + g²·s(X, T−τ)] dτ + g dW，s = −x/v
  M.ouReverse = (n, steps, T, theta, g, seed = 11, v0 = 1) => {
    const r = M.rng(seed), dt = T / steps, sdT = Math.sqrt(M.ouVar(T, theta, g, v0)), paths = [];
    for (let i = 0; i < n; i++) { let x = sdT * M.gauss(r); const p = [x]; for (let k = 0; k < steps; k++) { const t = T - k * dt; x += (theta * x - (g * g * x) / M.ouVar(t, theta, g, v0)) * dt + g * Math.sqrt(dt) * M.gauss(r); p.push(x); } paths.push(p); }
    return paths;
  };

  // ── 23 连续性方程：Xₜ = e^{−λt} X₀ ─────────────────────────────────────
  M.contractDensity = (x, t, lam) => M.normalPdf(x, 0, Math.exp(-lam * t));
  M.contractLogP = (x0, t, lam) => Math.log(M.normalPdf(x0)) + lam * t; // 沿轨迹 d log p/dt = −∇·v = λ

  // ── 24/25 高斯流：X₀ ~ N(0,1)，X₁ ~ N(m₁, s₁²)，独立耦合，线性插值 ─────
  M.flowVar = (t, s1 = 0.5) => (1 - t) ** 2 + s1 * s1 * t * t;
  M.flowVelocity = (x, t, m1 = 2, s1 = 0.5) => m1 + ((-(1 - t) + s1 * s1 * t) / M.flowVar(t, s1)) * (x - m1 * t);
  M.flowExact = (z, t, m1 = 2, s1 = 0.5) => m1 * t + Math.sqrt(M.flowVar(t, s1)) * z;
  M.flowOT = (z, t, m1 = 2, s1 = 0.5) => m1 * t + (1 - t + s1 * t) * z;
  M.flowMinStd = (s1 = 0.5) => { const t = 1 / (1 + s1 * s1); return { t, sd: Math.sqrt(M.flowVar(t, s1)) }; };
  M.euler = (v, x0, n) => { let x = x0; const h = 1 / n, path = [x]; for (let k = 0; k < n; k++) { x += h * v(x, k * h); path.push(x); } return path; };
  M.heun = (v, x0, n) => { let x = x0; const h = 1 / n, path = [x]; for (let k = 0; k < n; k++) { const t = k * h, f0 = v(x, t), xt = x + h * f0; x += 0.5 * h * (f0 + v(xt, t + h)); path.push(x); } return path; };
  M.flowErrors = (z = 1, steps = [4, 8, 16, 32, 64, 128]) => steps.map((n) => { const v = (x, t) => M.flowVelocity(x, t), exact = M.flowExact(z, 1); return { n, euler: Math.abs(M.euler(v, z, n).at(-1) - exact), heun: Math.abs(M.heun(v, z, n).at(-1) - exact) }; });

  // ── 26 最优传输与 Sinkhorn ──────────────────────────────────────────────
  M.pairCost = (xs, ys, perm) => xs.reduce((s, x, i) => s + (x - ys[perm[i]]) ** 2, 0) / xs.length;
  M.sortedPerm = (xs, ys) => { const ix = xs.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), iy = ys.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]), perm = []; ix.forEach(([, i], r) => { perm[i] = iy[r][1]; }); return perm; };
  M.sinkhornOT = (xs, ys, eps, iters = 500) => {
    const n = xs.length, m = ys.length, a = 1 / n, b = 1 / m, C = xs.map((x) => ys.map((y) => (x - y) ** 2));
    // log 域，避免 ε 小时下溢
    let f = new Array(n).fill(0), g = new Array(m).fill(0);
    const lse = (arr) => { const mx = Math.max(...arr); return mx + Math.log(arr.reduce((s, v) => s + Math.exp(v - mx), 0)); };
    for (let k = 0; k < iters; k++) {
      f = f.map((_, i) => eps * (Math.log(a) - lse(C[i].map((c, j) => (g[j] - c) / eps))));
      g = g.map((_, j) => eps * (Math.log(b) - lse(C.map((row, i) => (f[i] - row[j]) / eps))));
    }
    const P = C.map((row, i) => row.map((c, j) => Math.exp((f[i] + g[j] - c) / eps)));
    return { P, cost: P.reduce((s, row, i) => s + row.reduce((t, p, j) => t + p * C[i][j], 0), 0) };
  };

  // ── 28 MeanFlow：z(t) = z₀e^{t}，v = z ──────────────────────────────────
  M.meanVelocity = (zt, r, t) => (Math.abs(t - r) < 1e-12 ? zt : (zt - zt * Math.exp(r - t)) / (t - r));
  M.meanFlowResidual = (z0, r, t, h = 1e-5) => {
    const zt = z0 * Math.exp(t), u = M.meanVelocity(zt, r, t), v = zt;
    const dudt = (M.meanVelocity(zt, r, t + h) - M.meanVelocity(zt, r, t - h)) / (2 * h), dudz = (M.meanVelocity(zt + h, r, t) - M.meanVelocity(zt - h, r, t)) / (2 * h);
    return u - (v - (t - r) * (dudt + dudz * v));
  };

  // ── 29 引导与逆问题 ─────────────────────────────────────────────────────
  // 先验 p(x) = ½N(−1.5, 0.8²) + ½N(1.5, 0.8²)，条件 p(x|c) = N(1.5, 0.8²)；倾斜 p(x|c)^w p(x)^{1−w} 归一化
  M.tilted = (xs, w) => { const raw = xs.map((x) => { const pc = M.normalPdf(x, 1.5, 0.8), pu = 0.5 * M.normalPdf(x, -1.5, 0.8) + 0.5 * pc; return Math.exp(w * Math.log(pc) + (1 - w) * Math.log(pu)); }), z = M.trapz(xs, raw); return raw.map((v) => v / z); };
  M.gaussPosterior = (m0, s0, y, sn) => { const prec = 1 / (s0 * s0) + 1 / (sn * sn); return { mean: (m0 / (s0 * s0) + y / (sn * sn)) / prec, sd: Math.sqrt(1 / prec) }; };

  // ── 30 MDP：一条链上的值迭代 ────────────────────────────────────────────
  // 状态 0…n−1，动作 左/右，以 slip 的概率走反；到达最右端得到奖励 1 并终止
  M.chainBackup = (V, gamma, slip = 0.1) => {
    const n = V.length, next = new Array(n).fill(0), policy = new Array(n).fill(1);
    for (let s = 0; s < n - 1; s++) {
      const val = (to) => (to === n - 1 ? 1 : gamma * V[to]);
      const L = Math.max(0, s - 1), R = s + 1, qL = (1 - slip) * val(L) + slip * val(R), qR = (1 - slip) * val(R) + slip * val(L);
      next[s] = Math.max(qL, qR); policy[s] = qR >= qL ? 1 : 0;
    }
    return { V: next, policy };
  };
  M.valueIteration = (n, gamma, sweeps, slip = 0.1) => { let V = new Array(n).fill(0); const hist = [V], gaps = []; let policy = []; for (let k = 0; k < sweeps; k++) { const r = M.chainBackup(V, gamma, slip); gaps.push(Math.max(...r.V.map((v, i) => Math.abs(v - V[i])))); V = r.V; policy = r.policy; hist.push(V); } return { V, hist, gaps, policy }; };

  // ── 31 策略梯度：伯努利 bandit，奖励 r = a，logit 参数 ──────────────────
  M.banditStats = (p, b) => { const g1 = (1 - p) * (1 - b), g0 = -p * (0 - b), mean = p * g1 + (1 - p) * g0; return { mean, variance: p * g1 * g1 + (1 - p) * g0 * g0 - mean * mean, trueGrad: p * (1 - p), bestBaseline: 1 - p }; };
  // 附录 H：G 个独立动作，基线取含自身的组均值；枚举 2^G 种组合求 E[gᵢ(rᵢ − r̄)]
  M.groupMeanGradient = (p, G, leaveOneOut = false) => {
    let total = 0;
    for (let mask = 0; mask < 1 << G; mask++) {
      const a = Array.from({ length: G }, (_, i) => (mask >> i) & 1), prob = a.reduce((s, v) => s * (v ? p : 1 - p), 1), sum = a.reduce((s, v) => s + v, 0);
      const base = leaveOneOut ? (sum - a[0]) / (G - 1) : sum / G;
      total += prob * (a[0] - p) * (a[0] - base);
    }
    return total;
  };

  // ── 32 PPO 裁剪与 GRPO 组内优势 ─────────────────────────────────────────
  M.ppoClip = (rho, A, eps) => Math.min(rho * A, Math.max(1 - eps, Math.min(1 + eps, rho)) * A);
  M.groupAdvantage = (rewards, eps = 0) => { const m = rewards.reduce((a, b) => a + b, 0) / rewards.length, sd = Math.sqrt(rewards.reduce((s, r) => s + (r - m) ** 2, 0) / rewards.length); return rewards.map((r) => (sd + eps === 0 ? 0 : (r - m) / (sd + eps))); };

  // ── 33 KL 正则的最优策略与 DPO ──────────────────────────────────────────
  M.tiltPolicy = (ref, rewards, beta) => { const lw = ref.map((p, i) => Math.log(p) + rewards[i] / beta), m = Math.max(...lw), e = lw.map((v) => Math.exp(v - m)), z = e.reduce((a, b) => a + b, 0); return e.map((v) => v / z); };
  M.klDiscrete = (p, q) => p.reduce((s, v, i) => s + (v > 0 ? v * Math.log(v / q[i]) : 0), 0);
  M.regObjective = (pi, ref, rewards, beta) => pi.reduce((s, p, i) => s + p * rewards[i], 0) - beta * M.klDiscrete(pi, ref);
  M.dpoLoss = (margin) => Math.log(1 + Math.exp(-margin)); // −log σ(margin)，margin = β × 相对对数比差

  // ── 34 测试时计算 ───────────────────────────────────────────────────────
  M.passAtK = (p, k) => 1 - (1 - p) ** k;
  // 以 c 的概率整题“共同失败”，否则各次独立成功；单次成功率仍是 p
  M.passCorrelated = (p, k, c) => { const pi = Math.min(1, p / (1 - c)); return (1 - c) * (1 - (1 - pi) ** k); };
  // 两道题、凹效用 Uᵢ(c) = Aᵢ(1 − e^{−c/τᵢ})，预算 C：最优分配让边际效用相等
  M.utility = (c, A, tau) => A * (1 - Math.exp(-c / tau));
  M.bestSplit = (C, A1, t1, A2, t2) => { let best = 0, arg = 0; for (let i = 0; i <= 2000; i++) { const c = (C * i) / 2000, u = M.utility(c, A1, t1) + M.utility(C - c, A2, t2); if (u > best) { best = u; arg = c; } } return { c1: arg, total: best }; };

  // ── 35 缩放律 ───────────────────────────────────────────────────────────
  M.scalingLoss = (N, C, o) => o.Linf + o.a * N ** -o.alpha + o.b * (C / (o.k * N)) ** -o.beta;
  M.scalingOpt = (C, o) => { const N = ((o.alpha * o.a * C ** o.beta) / (o.beta * o.b * o.k ** o.beta)) ** (1 / (o.alpha + o.beta)); return { N, D: C / (o.k * N), loss: M.scalingLoss(N, C, o) }; };

  // ── 36 双下降：最小范数最小二乘（真算，不是手画） ───────────────────────
  // y = xᵀw* + 噪声，x ∈ R^D 各分量独立标准正态；只用前 p 个特征拟合 n 个样本。
  // p ≤ n 解正规方程，p > n 取最小范数插值解 w = Xᵀ(XXᵀ + λI)⁻¹y。返回测试均方误差（对若干次试验平均）。
  M.doubleDescent = (n, D, ps, noise, ridge = 0, trials = 12, seed = 20261112) => ps.map((p) => {
    let tot = 0;
    for (let tr = 0; tr < trials; tr++) {
      const r = M.rng(seed + 1000 * tr + p), wstar = Array.from({ length: D }, () => M.gauss(r) / Math.sqrt(D));
      const X = M.randMat(n, D, r), y = X.map((x) => x.reduce((s, v, i) => s + v * wstar[i], 0) + noise * M.gauss(r));
      const Xp = X.map((x) => x.slice(0, p)); let w;
      const lam = Math.max(ridge, 1e-9);
      if (p <= n) { const Xt = M.transpose(Xp), A = M.matmul(Xt, Xp).map((row, i) => row.map((v, j) => v + (i === j ? lam : 0))); w = M.solve(A, M.matvec(Xt, y)); }
      else { const Xt = M.transpose(Xp), A = M.matmul(Xp, Xt).map((row, i) => row.map((v, j) => v + (i === j ? lam : 0))); w = M.matvec(Xt, M.solve(A, y)); }
      // 测试误差的精确期望：‖w − w*₁..p‖² + ‖w*_{p+1..D}‖² + 噪声²
      let e = noise * noise;
      for (let i = 0; i < D; i++) e += (i < p ? w[i] - wstar[i] : wstar[i]) ** 2;
      tot += e;
    }
    return tot / trials;
  });
  M.rbf = (n, len) => Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.exp(-((i - j) ** 2) / (2 * len * len))));

  // ── 37 保形预测（分割保形，回归） ───────────────────────────────────────
  M.conformalQuantile = (scores, alpha) => { const n = scores.length, k = Math.ceil((n + 1) * (1 - alpha)); if (k > n) return Infinity; return [...scores].sort((a, b) => a - b)[k - 1]; };
  M.conformalTrial = (n, alpha, noise, seed, nTest = 400) => {
    const r = M.rng(seed), truth = (x) => Math.sin(1.6 * x), model = (x) => 0.85 * Math.sin(1.6 * x) + 0.08 * x; // 固定的、不完美的预测器
    const draw = () => { const x = -2 + 4 * r(); return [x, truth(x) + noise * M.gauss(r)]; };
    const cal = Array.from({ length: n }, draw), q = M.conformalQuantile(cal.map(([x, y]) => Math.abs(y - model(x))), alpha);
    const test = Array.from({ length: nTest }, draw), covered = test.filter(([x, y]) => Math.abs(y - model(x)) <= q).length / nTest;
    return { q, covered, cal, model, truth };
  };
  M.conformalCoverage = (n, alpha, noise, trials = 300, seed = 20261112) => { const out = []; for (let t = 0; t < trials; t++) out.push(M.conformalTrial(n, alpha, noise, seed + 17 * t, 200).covered); return out; };

  // ── 38 因果：二值 Z → X、Z → Y、X → Y ───────────────────────────────────
  // P(Z=1)=pz；P(X=1|Z)=σ(−c + 2cZ)；P(Y=1|X,Z)=base + effect·X + conf·Z
  M.scm = (pz, c, effect, conf, base = 0.2) => {
    const px = (z) => M.sigmoid(-c + 2 * c * z), py = (x, z) => base + effect * x + conf * z;
    const cond = (x) => { let num = 0, den = 0; for (const z of [0, 1]) { const w = (z ? pz : 1 - pz) * (x ? px(z) : 1 - px(z)); num += w * py(x, z); den += w; } return num / den; };
    const doX = (x) => (1 - pz) * py(x, 0) + pz * py(x, 1);
    return { observed: cond(1) - cond(0), causal: doX(1) - doX(0), pY_x1: cond(1), pY_x0: cond(0), pY_do1: doX(1), pY_do0: doX(0) };
  };

  // ── 39 等变性：成对势 E = Σ ½(r_ij − 1)² ────────────────────────────────
  M.pairEnergy = (X) => { let E = 0; const F = X.map(() => [0, 0]); for (let i = 0; i < X.length; i++) for (let j = i + 1; j < X.length; j++) { const dx = X[i][0] - X[j][0], dy = X[i][1] - X[j][1], r = Math.hypot(dx, dy), f = -(r - 1) / r; E += 0.5 * (r - 1) ** 2; F[i][0] += f * dx; F[i][1] += f * dy; F[j][0] -= f * dx; F[j][1] -= f * dy; } return { E, F }; };
  M.transformPoints = (X, angle, reflect = false, shift = [0, 0]) => { const R = M.rot2(angle); return X.map(([x, y]) => { const v = M.matvec(R, [reflect ? -x : x, y]); return [v[0] + shift[0], v[1] + shift[1]]; }); };
  M.equivarianceError = (X, angle, reflect = false) => { const F = M.pairEnergy(X).F, F2 = M.pairEnergy(M.transformPoints(X, angle, reflect, [0.7, -0.3])).F, RF = M.transformPoints(F, angle, reflect); return Math.max(...F2.map((f, i) => Math.hypot(f[0] - RF[i][0], f[1] - RF[i][1]))); };

  // ── 40 Fourier 截断与一个可解析的 PDE ───────────────────────────────────
  M.signal = (x, hi = 0.35) => Math.sin(x) + hi * Math.sin(9 * x) + 0.5 * hi * Math.sin(17 * x + 0.6);
  M.fourierTruncate = (ys, keep) => { // 实信号的离散傅里叶级数，只留 |k| ≤ keep
    const n = ys.length, out = new Array(n).fill(0);
    for (let k = 0; k <= Math.min(keep, Math.floor(n / 2)); k++) {
      let re = 0, im = 0; for (let j = 0; j < n; j++) { const a = (2 * Math.PI * k * j) / n; re += ys[j] * Math.cos(a); im -= ys[j] * Math.sin(a); }
      const s = k === 0 || (n % 2 === 0 && k === n / 2) ? 1 / n : 2 / n;
      for (let j = 0; j < n; j++) { const a = (2 * Math.PI * k * j) / n; out[j] += s * (re * Math.cos(a) - im * Math.sin(a)); }
    }
    return out;
  };
  M.rms = (a, b) => Math.sqrt(a.reduce((s, v, i) => s + (v - b[i]) ** 2, 0) / a.length);
  M.poisson = (x, a) => Math.sin(Math.PI * x) / (a * Math.PI * Math.PI); // −a u″ = sin(πx)，u(0)=u(1)=0

  // ── 41 双阱能量、Gibbs 分布与 Langevin ──────────────────────────────────
  M.wellEnergy = (x) => (x * x - 1) ** 2;
  M.gibbs = (xs, T) => { const raw = xs.map((x) => Math.exp(-M.wellEnergy(x) / T)), z = M.trapz(xs, raw); return raw.map((v) => v / z); };
  M.langevin = (n, steps, T, h, seed = 20261112, start = -1) => { const r = M.rng(seed), out = []; for (let i = 0; i < n; i++) { let x = start; for (let k = 0; k < steps; k++) x += -4 * x * (x * x - 1) * h + Math.sqrt(2 * T * h) * M.gauss(r); out.push(x); } return out; };
  M.freeEnergy = (xs, q, T) => { const E = M.trapz(xs, xs.map((x, i) => q[i] * M.wellEnergy(x))), H = -M.trapz(xs, q.map((v) => (v > 0 ? v * Math.log(v) : 0))); return E - T * H; };

  // ── 42 Grönwall：ẋ = −Lx 的一类例子与上界 ───────────────────────────────
  M.gronwall = (t, L, e0, delta) => Math.exp(L * t) * e0 + (L === 0 ? delta * t : (delta * (Math.exp(L * t) - 1)) / L);
  // 真场 v = L·sin(x)，学到的场 v̂ = v + δ·cos(3x)：|v − v̂| ≤ δ，v 是 L-Lipschitz；数值积分两条轨迹的差
  M.gronwallExample = (L, e0, delta, n = 400) => { let x = 0.3, y = 0.3 + e0; const h = 1 / n, out = [Math.abs(y - x)]; for (let k = 0; k < n; k++) { const fx = (u) => L * Math.sin(u), fy = (u) => L * Math.sin(u) + delta * Math.cos(3 * u); const x1 = x + h * fx(x), y1 = y + h * fy(y); x += 0.5 * h * (fx(x) + fx(x1)); y += 0.5 * h * (fy(y) + fy(y1)); out.push(Math.abs(y - x)); } return out; };

  // ── 附录 K：讲义核验记录里的数字（本页重新计算后与它对照） ──────────────
  M.RECORD = {
    attn: { analytic: 2.3823546672, numeric: 2.3823546671, rel: 6.717e-11 },
    sinkhorn: { residual: 2.22e-16, spec: 1 },
    flowDeriv: 3.917e-11,
    groupMean: 0.1575,
    flow: [[4, 1.595e-1, 4.835e-3], [8, 8.522e-2, 2.441e-3], [16, 4.432e-2, 7.638e-4], [32, 2.264e-2, 2.1e-4], [64, 1.144e-2, 5.487e-5], [128, 5.755e-3, 1.401e-5]],
  };
  // 高斯流解析轨迹的导数与速度场之差（若干时刻的最大值）
  M.flowDerivativeGap = (z = 1, h = 1e-6) => Math.max(...[0.1, 0.3, 0.5, 0.7, 0.9].map((t) => Math.abs((M.flowExact(z, t + h) - M.flowExact(z, t - h)) / (2 * h) - M.flowVelocity(M.flowExact(z, t), t))));

  window.MOLASTRIA_AIM_MODELS = M;
})();
