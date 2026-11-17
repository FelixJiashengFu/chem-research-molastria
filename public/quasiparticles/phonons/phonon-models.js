'use strict';
// 声子（/quasiparticles/phonons/）演示背后的数学：纯函数，没有 DOM。tools/phonon-test.mjs 对照解析解和已知值测这里的每一个函数。
// 页面里 phonon-demos.js 经 window.MOLASTRIA_PHONON_MODELS 拿到它们。
// 模型都是教科书里的小模型（弹簧连起来的原子链、二维格子、最近邻中心力的面心立方、Debye 和 Einstein、FPU 链、准谐近似、
// Callaway 式的弛豫时间、Morse 链上的有限位移），每个演示的“模型说明”写清楚它和真实材料的距离。
(() => {
  const TAU = 2 * Math.PI;

  // ── 随机数（固定种子，同一个种子同一个结果）──────────────────────
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gauss = (r) => { const u = Math.max(1e-12, r()), v = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(TAU * v); };

  // ── 对称矩阵的本征值（Jacobi 旋转，小矩阵用）────────────────────
  // 返回 { values（从小到大）, vectors（vectors[k] 是第 k 个本征向量）}
  function symEig(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-26) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = A.map((_, i) => i).sort((i, j) => A[i][i] - A[j][j]);
    return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => V.map((r) => r[i])) };
  }
  // 2 × 2 实对称矩阵 [[a, b], [b, d]] 的本征值和本征向量（解析）
  function eig2(a, b, d) {
    const m = (a + d) / 2, r = Math.hypot((a - d) / 2, b), l1 = m - r, l2 = m + r;
    const vec = (l) => { const x = Math.abs(b) > 1e-14 ? [b, l - a] : (Math.abs(l - a) < Math.abs(l - d) ? [1, 0] : [0, 1]); const n = Math.hypot(...x); return [x[0] / n, x[1] / n]; };
    return { values: [l1, l2], vectors: [vec(l1), vec(l2)] };
  }

  // ── 第一章：一维单原子链 ──────────────────────────────────────────
  // 质量 m，最近邻弹簧 K1，次近邻弹簧 K2，晶格常数 a。ω²(q) = (4/m)[K1 sin²(qa/2) + K2 sin²(qa)]
  const chainW2 = (q, K1 = 1, m = 1, K2 = 0, a = 1) => (4 / m) * (K1 * Math.sin((q * a) / 2) ** 2 + K2 * Math.sin(q * a) ** 2);
  const chainW = (q, K1, m, K2, a) => Math.sqrt(Math.max(0, chainW2(q, K1, m, K2, a)));
  // 群速度 dω/dq（解析导数）
  const chainVg = (q, K1 = 1, m = 1, K2 = 0, a = 1) => { const w = chainW(q, K1, m, K2, a); if (w < 1e-12) return a * Math.sqrt((K1 + 4 * K2) / m) * (q >= 0 ? 1 : -1); return ((2 / m) * a * (K1 * Math.sin(q * a) + 2 * K2 * Math.sin(2 * q * a))) / (2 * w); };
  // N 个原子、周期边界的链允许的波矢：q = 2πn/(Na)，n = −N/2+1 … N/2
  const chainQs = (N, a = 1) => Array.from({ length: N }, (_, i) => (TAU * (i - Math.floor((N - 1) / 2))) / (N * a));
  // 周期链的力常数矩阵（N × N），用来和解析色散对照
  function chainHessian(N, K1 = 1, K2 = 0) {
    const H = Array.from({ length: N }, () => new Array(N).fill(0));
    const add = (i, j, k) => { j = ((j % N) + N) % N; H[i][i] += k; H[i][j] -= k; };
    for (let i = 0; i < N; i++) { add(i, i + 1, K1); add(i, i - 1, K1); if (K2) { add(i, i + 2, K2); add(i, i - 2, K2); } }
    return H;
  }

  // ── 第二章：双原子链（一般形式）─────────────────────────────────────
  // 一个原胞里有质量 m1、m2 两个原子；胞内弹簧 K1（连 1 和 2），胞间弹簧 K2（连 2 和下一个胞的 1），晶格常数 a。
  // 质量加权的动力学矩阵 D = [[ (K1+K2)/m1, −(K1 + K2 e^{−iqa})/√(m1 m2) ], [c.c., (K1+K2)/m2]]，是 2 × 2 厄米矩阵。
  function diatomic(q, K1 = 1, K2 = 1, m1 = 1, m2 = 2, a = 1) {
    const d11 = (K1 + K2) / m1, d22 = (K1 + K2) / m2, s = Math.sqrt(m1 * m2);
    const re = -(K1 + K2 * Math.cos(q * a)) / s, im = (K2 * Math.sin(q * a)) / s; // D12 = re + i·im
    const mid = (d11 + d22) / 2, r = Math.sqrt(((d11 - d22) / 2) ** 2 + re * re + im * im);
    const w2 = [mid - r, mid + r];
    // 本征向量（质量加权的）e = (D12, λ − d11)，再换成真实位移 u = e/√m
    const vec = (l) => { let e1 = [re, im], e2 = [l - d11, 0]; if (Math.hypot(re, im) < 1e-14) { e1 = Math.abs(l - d11) < Math.abs(l - d22) ? [1, 0] : [0, 0]; e2 = Math.abs(l - d11) < Math.abs(l - d22) ? [0, 0] : [1, 0]; } const n = Math.hypot(...e1, ...e2) || 1; return [[e1[0] / n / Math.sqrt(m1), e1[1] / n / Math.sqrt(m1)], [e2[0] / n / Math.sqrt(m2), e2[1] / n / Math.sqrt(m2)]]; };
    return { w2, w: w2.map((x) => Math.sqrt(Math.max(0, x))), u: w2.map(vec) };
  }

  // ── 第三章：二维格子（中心力弹簧，近邻 K1、次近邻 K2）───────────────
  // D_αβ(k) = (1/m) Σ_R K_R (1 − cos k·R) R̂_α R̂_β，求和遍历所有近邻向量 R（±R 都算）。
  const LAT2D = {
    square: { nn: [[1, 0], [-1, 0], [0, 1], [0, -1]], nnn: [[1, 1], [-1, -1], [1, -1], [-1, 1]], path: [['Γ', [0, 0]], ['X', [Math.PI, 0]], ['M', [Math.PI, Math.PI]], ['Γ', [0, 0]]], a1: [1, 0], a2: [0, 1] },
    triangle: { nn: [0, 1, 2, 3, 4, 5].map((k) => [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)]), nnn: [0, 1, 2, 3, 4, 5].map((k) => [Math.sqrt(3) * Math.cos((k * Math.PI) / 3 + Math.PI / 6), Math.sqrt(3) * Math.sin((k * Math.PI) / 3 + Math.PI / 6)]), path: [['Γ', [0, 0]], ['M', [Math.PI, Math.PI / Math.sqrt(3)]], ['K', [(4 * Math.PI) / 3, 0]], ['Γ', [0, 0]]], a1: [1, 0], a2: [0.5, Math.sqrt(3) / 2] },
  };
  function dyn2d(k, lat, K1 = 1, K2 = 0, m = 1) {
    let a = 0, b = 0, d = 0;
    for (const [R, K] of [[LAT2D[lat].nn, K1], [LAT2D[lat].nnn, K2]]) for (const r of R) {
      if (!K) continue;
      const n = Math.hypot(r[0], r[1]), ux = r[0] / n, uy = r[1] / n, f = (K / m) * (1 - Math.cos(k[0] * r[0] + k[1] * r[1]));
      a += f * ux * ux; b += f * ux * uy; d += f * uy * uy;
    }
    return [a, b, d];
  }
  // 沿高对称路径取 n 个点：返回 { s（路径长度坐标）, k, labels: [[s, 名字]] }
  function bzPath(lat, n = 240) {
    const P = LAT2D[lat].path, seg = [];
    let tot = 0;
    for (let i = 0; i < P.length - 1; i++) { const L = Math.hypot(P[i + 1][1][0] - P[i][1][0], P[i + 1][1][1] - P[i][1][1]); seg.push(L); tot += L; }
    const pts = [], labels = [[0, P[0][0]]];
    let acc = 0;
    for (let i = 0; i < seg.length; i++) {
      const m = Math.max(2, Math.round((n * seg[i]) / tot)), [A, B] = [P[i][1], P[i + 1][1]];
      for (let j = i ? 1 : 0; j <= m; j++) { const t = j / m; pts.push({ s: acc + t * seg[i], k: [A[0] + t * (B[0] - A[0]), A[1] + t * (B[1] - A[1])] }); }
      acc += seg[i]; labels.push([acc, P[i + 1][0]]);
    }
    return { pts, labels, len: tot };
  }
  function band2d(lat, K1, K2, m = 1, n = 240) {
    const { pts, labels, len } = bzPath(lat, n);
    const out = pts.map(({ s, k }) => { const [a, b, d] = dyn2d(k, lat, K1, K2, m), e = eig2(a, b, d); const kk = Math.hypot(k[0], k[1]); const lon = (v) => (kk < 1e-9 ? 0.5 : Math.abs(v[0] * k[0] + v[1] * k[1]) / kk); return { s, k, w: e.values.map((x) => Math.sqrt(Math.max(0, x))), w2: e.values, L: e.vectors.map(lon) }; });
    return { pts: out, labels, len };
  }
  // 布里渊区（Wigner–Seitz 原胞）的顶点
  function bzPolygon(lat) {
    if (lat === 'square') return [[Math.PI, Math.PI], [-Math.PI, Math.PI], [-Math.PI, -Math.PI], [Math.PI, -Math.PI]];
    const r = (4 * Math.PI) / 3; return [0, 1, 2, 3, 4, 5].map((k) => [r * Math.cos((k * Math.PI) / 3), r * Math.sin((k * Math.PI) / 3)]);
  }
  // 长波极限的声速（沿方向 θ），从 k → 0 的斜率算
  const sound2d = (lat, K1, K2, m, th, eps = 1e-4) => { const [a, b, d] = dyn2d([eps * Math.cos(th), eps * Math.sin(th)], lat, K1, K2, m); return eig2(a, b, d).values.map((x) => Math.sqrt(Math.max(0, x)) / eps); };

  // ── 第四章：面心立方（最近邻中心力）和态密度 ─────────────────────────
  // 最近邻距离取 1：12 个近邻 (±1, ±1, 0)/√2 及其轮换；常规晶胞边长 a = √2，原胞体积 a³/4。
  const FCC = (() => { const s = Math.SQRT1_2, v = []; for (const [i, j] of [[0, 1], [0, 2], [1, 2]]) for (const si of [-1, 1]) for (const sj of [-1, 1]) { const r = [0, 0, 0]; r[i] = si * s; r[j] = sj * s; v.push(r); } return v; })();
  const FCC_A = Math.SQRT2, FCC_VCELL = FCC_A ** 3 / 4;
  const FCC_B = [[-1, 1, 1], [1, -1, 1], [1, 1, -1]].map((b) => b.map((x) => (TAU / FCC_A) * x)); // 倒格子原胞矢量
  function dynFcc(k, K = 1, m = 1) {
    const D = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const r of FCC) { const f = (K / m) * (1 - Math.cos(k[0] * r[0] + k[1] * r[1] + k[2] * r[2])); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) D[i][j] += f * r[i] * r[j]; } // |r| = 1
    return D;
  }
  // 3 × 3 实对称矩阵的本征值（三角公式，比 Jacobi 快；用于布里渊区撒点）
  function eig3vals(A) {
    const p1 = A[0][1] ** 2 + A[0][2] ** 2 + A[1][2] ** 2, q = (A[0][0] + A[1][1] + A[2][2]) / 3;
    if (p1 < 1e-30) return [A[0][0], A[1][1], A[2][2]].sort((x, y) => x - y);
    const p2 = (A[0][0] - q) ** 2 + (A[1][1] - q) ** 2 + (A[2][2] - q) ** 2 + 2 * p1, p = Math.sqrt(p2 / 6);
    const B = A.map((r, i) => r.map((x, j) => (x - (i === j ? q : 0)) / p));
    const det = B[0][0] * (B[1][1] * B[2][2] - B[1][2] * B[2][1]) - B[0][1] * (B[1][0] * B[2][2] - B[1][2] * B[2][0]) + B[0][2] * (B[1][0] * B[2][1] - B[1][1] * B[2][0]);
    const phi = Math.acos(Math.max(-1, Math.min(1, det / 2))) / 3, e1 = q + 2 * p * Math.cos(phi), e3 = q + 2 * p * Math.cos(phi + TAU / 3);
    return [e3, 3 * q - e1 - e3, e1];
  }
  // 在倒格子原胞上撒 n³ 个均匀点（Monkhorst–Pack），返回所有频率（每点 3 个，等权）
  function fccFreqs(n = 20, K = 1, m = 1) {
    const out = new Float64Array(3 * n ** 3);
    let c = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) for (let l = 0; l < n; l++) {
      const f = [(i + 0.5) / n, (j + 0.5) / n, (l + 0.5) / n], k = [0, 1, 2].map((x) => f[0] * FCC_B[0][x] + f[1] * FCC_B[1][x] + f[2] * FCC_B[2][x]);
      for (const v of eig3vals(dynFcc(k, K, m))) out[c++] = Math.sqrt(Math.max(0, v));
    }
    return out;
  }
  // 二维正方格子：撒 n² 个点，每点 2 个频率
  function squareFreqs(n = 200, K1 = 1, K2 = 0.5, m = 1) {
    const out = new Float64Array(2 * n * n);
    let c = 0;
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const k = [TAU * ((i + 0.5) / n - 0.5), TAU * ((j + 0.5) / n - 0.5)], [a, b, d] = dyn2d(k, 'square', K1, K2, m); for (const v of eig2(a, b, d).values) out[c++] = Math.sqrt(Math.max(0, v)); }
    return out;
  }
  // 一维链：撒 n 个点
  const chainFreqs = (n = 4000, K1 = 1, m = 1, K2 = 0) => Float64Array.from({ length: n }, (_, i) => chainW(TAU * ((i + 0.5) / n - 0.5), K1, m, K2));
  // 直方图：每个原子 dim 支，归一成 ∫g dω = dim
  function histogram(freqs, bins, wmax, dim) {
    const g = new Float64Array(bins), dw = wmax / bins, per = freqs.length / dim;
    for (const w of freqs) { const b = Math.min(bins - 1, Math.floor(w / dw)); g[b] += 1; }
    for (let b = 0; b < bins; b++) g[b] /= per * dw;
    return { g, dw, ws: Array.from({ length: bins }, (_, b) => (b + 0.5) * dw) };
  }
  // 一维链的解析态密度（每个原子 1 支）：g(ω) = (2/π) / √(ω_max² − ω²)
  const chainDos = (w, wmax) => (w < wmax ? 2 / (Math.PI * Math.sqrt(wmax * wmax - w * w)) : 0);
  // fcc 模型的长波声速：沿 ndir 个方向求 Σ_s ∫ dΩ / v_s³，给出低频态密度 g(ω) ≈ c ω²（每个原子）
  function fccLowCoef(ndir = 400, K = 1, m = 1) {
    const r = rng(7), eps = 1e-4;
    let acc = 0;
    for (let i = 0; i < ndir; i++) {
      const z = 2 * ((i + r()) / ndir) - 1, ph = TAU * ((i * 0.6180339887) % 1), s = Math.sqrt(1 - z * z), u = [s * Math.cos(ph), s * Math.sin(ph), z]; // 球面上大致均匀的点
      for (const v of eig3vals(dynFcc(u.map((x) => x * eps), K, m))) acc += 1 / (Math.sqrt(v) / eps) ** 3;
    }
    const sumInv = (4 * Math.PI * acc) / ndir; // Σ_s ∫ dΩ v_s^−3
    return (FCC_VCELL / (2 * Math.PI) ** 3) * sumInv; // 每个原子：g(ω) = V_cell/(2π)³ · ω² · Σ_s ∫dΩ v_s^−3
  }
  // 和同样低频行为的 Debye 模型：g = 9ω²/ω_D³ ⇒ ω_D = (9/c)^{1/3}
  const debyeFromCoef = (c) => Math.cbrt(9 / c);

  // ── 第四、五章：量子统计和热容 ───────────────────────────────────────
  const bose = (x) => (x > 700 ? 0 : 1 / Math.expm1(x)); // x = ħω/kT
  const einsteinTerm = (x) => (x < 1e-8 ? 1 : x > 700 ? 0 : (x * x * Math.exp(x)) / Math.expm1(x) ** 2); // 一个振子的 C/k_B
  // Einstein 固体：每个原子 3 个振子，C/(3Nk_B) 在高温趋于 1；返回 C/(N k_B)
  const einsteinC = (T, thE) => 3 * einsteinTerm(thE / T);
  // Gauss–Legendre 求积的节点和权重
  function gaussLegendre(n) {
    const x = new Float64Array(n), w = new Float64Array(n);
    for (let i = 0; i < n; i++) {
      let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5)), pp = 0;
      for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; } pp = (n * (z * p1 - p2)) / (z * z - 1); const z1 = z; z = z1 - p1 / pp; if (Math.abs(z - z1) < 1e-15) break; }
      x[i] = z; w[i] = 2 / ((1 - z * z) * pp * pp);
    }
    return { x, w };
  }
  const GL = gaussLegendre(64);
  const integrate = (f, a, b) => { let s = 0; for (let i = 0; i < GL.x.length; i++) s += GL.w[i] * f(a + ((GL.x[i] + 1) * (b - a)) / 2); return (s * (b - a)) / 2; };
  // Debye 热容 C/(N k_B) = 9 (T/Θ)³ ∫₀^{Θ/T} x⁴eˣ/(eˣ−1)² dx（上限很大时截在 60：被积函数已经小于 10⁻¹⁹）
  const debyeC = (T, thD) => { if (T <= 0) return 0; const xD = thD / T; return 9 * (1 / xD) ** 3 * integrate((x) => x * x * einsteinTerm(x), 0, Math.min(xD, 60)); };
  const debyeT3 = (T, thD) => ((12 * Math.PI ** 4) / 5) * (T / thD) ** 3; // 低温极限
  // 由一组频率（等权，每个原子 dim 支）算 C/(N k_B)；hw 是 ħω 换成温度的系数（ħω/k_B = hw·ω）
  function cvFromFreqs(freqs, T, hw, dim) { const per = freqs.length / dim; let s = 0; for (const w of freqs) if (w > 1e-12) s += einsteinTerm((hw * w) / T); return s / per; }
  // 振子的平均能量（含零点能），以 ħω 为单位：1/2 + n(x)
  const oscEnergy = (x) => 0.5 + bose(x);
  const R_GAS = 8.314462618; // J/(mol K)

  // ── 第六章：中子散射和拉曼 ───────────────────────────────────────────
  // 中子：E [meV] = 2.0721 k² [Å⁻¹]（ħ²/2m_n），λ [Å] = 2π/k
  const NEUTRON = 2.072124; // meV Å²
  const kOfE = (E) => Math.sqrt(Math.max(0, E) / NEUTRON);
  const lambdaOfE = (E) => TAU / kOfE(E);
  // 换算：1 meV = 8.06554 cm⁻¹ = 0.241799 THz = 11.6045 K
  const MEV = { cm: 8.065544, thz: 0.2417990, K: 11.60452 };
  // 能量转移 ħω（中子损失的能量）时，动量转移 Q 能取的范围（散射角 0 到 180°）
  const qRange = (Ei, hw) => { if (hw > Ei) return null; const ki = kOfE(Ei), kf = kOfE(Ei - hw); return [Math.abs(ki - kf), ki + kf]; };
  // 散射角 2θ：|Q|² = ki² + kf² − 2 ki kf cos 2θ
  const scatAngle = (Ei, hw, Q) => { const ki = kOfE(Ei), kf = kOfE(Ei - hw), c = (ki * ki + kf * kf - Q * Q) / (2 * ki * kf); return Math.abs(c) <= 1 ? Math.acos(c) : NaN; };
  // fcc 模型沿 [h00] 的三支频率和偏振（以 2π/a 为单位的 h），按最大频率 wmax 标定
  const FCC_WMAX = Math.sqrt(8); // X 点的纵波：8 个近邻的 k·r = ±π，D_xx = 8 × 2 × ½（K = m = 1），是整个模型的最高频率
  function fccAlong(h, dir = [1, 0, 0]) {
    const n = Math.hypot(...dir), k = dir.map((x) => (x / n) * h * (TAU / FCC_A)), e = symEig(dynFcc(k));
    return e.values.map((v, i) => ({ w: Math.sqrt(Math.max(0, v)) / FCC_WMAX, e: e.vectors[i] }));
  }
  // 一个声子在 Q 处的单声子散射强度（只看形状）：|Q·e|²/ω × (n + 1)（中子产生声子）或 × n（湮灭）
  const onePhonon = (Qvec, e, hw, T) => { const x = hw / (T / MEV.K); const qe = Qvec[0] * e[0] + Qvec[1] * e[1] + Qvec[2] * e[2]; return { create: (qe * qe) / hw * (bose(x) + 1), annihilate: (qe * qe) / hw * bose(x) }; };
  const lorentz = (x, x0, g) => g / Math.PI / ((x - x0) ** 2 + g * g);
  // 拉曼：反斯托克斯 / 斯托克斯强度比。散射光的功率按 ν⁴，数光子的探测器按 ν³（power = 4 或 3）
  const HC_K = 1.438777; // hc/k_B，cm·K
  const ramanRatio = (nu, T, laser, power = 4) => ((laser + nu) / (laser - nu)) ** power * Math.exp((-HC_K * nu) / T);
  const ramanTemp = (nu, ratio, laser, power = 4) => (HC_K * nu) / Math.log(((laser + nu) / (laser - nu)) ** power / ratio);

  // ── 第七章：非谐性 ──────────────────────────────────────────────────
  // FPU 链：N 个可动的原子，两端固定。V = Σ [½Δ² + (α/3)Δ³ + (β/4)Δ⁴]，Δ = u_{j+1} − u_j，m = K = 1。
  const fpuW = (k, N) => 2 * Math.sin((k * Math.PI) / (2 * (N + 1)));
  function fpuInit(N = 32, E1 = 1, mode = 1) {
    // 只有第 mode 个简正模有能量 E1（初始速度为零）
    const A = Math.sqrt(2 * E1) / fpuW(mode, N), c = Math.sqrt(2 / (N + 1)), u = new Float64Array(N + 2), v = new Float64Array(N + 2);
    for (let j = 1; j <= N; j++) u[j] = A * c * Math.sin((j * mode * Math.PI) / (N + 1));
    return { N, u, v, t: 0 };
  }
  function fpuAcc(s, alpha, beta, a) {
    const { N, u } = s;
    for (let j = 1; j <= N; j++) { const dR = u[j + 1] - u[j], dL = u[j] - u[j - 1]; a[j] = dR - dL + alpha * (dR * dR - dL * dL) + beta * (dR ** 3 - dL ** 3); }
  }
  function fpuStep(s, dt, steps, alpha = 0.25, beta = 0) {
    const a = s.a || (s.a = new Float64Array(s.N + 2));
    if (!s.ready) { fpuAcc(s, alpha, beta, a); s.ready = true; }
    for (let n = 0; n < steps; n++) {
      for (let j = 1; j <= s.N; j++) { s.v[j] += 0.5 * dt * a[j]; s.u[j] += dt * s.v[j]; }
      fpuAcc(s, alpha, beta, a);
      for (let j = 1; j <= s.N; j++) s.v[j] += 0.5 * dt * a[j];
    }
    s.t += dt * steps;
    return s;
  }
  function fpuModes(s, kmax) {
    const { N, u, v } = s, c = Math.sqrt(2 / (N + 1)), out = [];
    for (let k = 1; k <= kmax; k++) { let Q = 0, P = 0; for (let j = 1; j <= N; j++) { const sn = Math.sin((j * k * Math.PI) / (N + 1)); Q += u[j] * sn; P += v[j] * sn; } Q *= c; P *= c; const w = fpuW(k, N); out.push(0.5 * (P * P + w * w * Q * Q)); }
    return out;
  }
  function fpuEnergy(s, alpha, beta) { let E = 0; for (let j = 1; j <= s.N; j++) E += 0.5 * s.v[j] ** 2; for (let j = 0; j <= s.N; j++) { const d = s.u[j + 1] - s.u[j]; E += 0.5 * d * d + (alpha / 3) * d ** 3 + (beta / 4) * d ** 4; } return E; }
  // 准谐近似：一个原子 3 个频率 ω(V) = ω₀ (V/V₀)^(−γ)；静态能 E₀(V) = ½ B V₀ (V/V₀ − 1)²。能量以 ħω₀ 为单位，温度以 ħω₀/k_B 为单位。
  // 自由能 F(V, T) = E₀ + 3[x/2 + T ln(1 − e^{−x/T})]（x = ω/ω₀），zp = false 时去掉零点能
  function qhaF(v, T, gamma, BV, zp = true) { const x = v ** -gamma, vib = (zp ? 0.5 * x : 0) + (T > 0 ? T * Math.log(-Math.expm1(-x / T)) : 0); return 0.5 * BV * (v - 1) ** 2 + 3 * vib; }
  function qhaVolume(T, gamma, BV, zp = true) {
    // 黄金分割找 F 的最小值
    let a = 0.6, b = 1.6;
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a), fc = qhaF(c, T, gamma, BV, zp), fd = qhaF(d, T, gamma, BV, zp);
    for (let i = 0; i < 120; i++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = qhaF(c, T, gamma, BV, zp); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = qhaF(d, T, gamma, BV, zp); } }
    return (a + b) / 2;
  }
  // 热导率（Debye + 弛豫时间，Callaway 式但不区分正常过程），约化单位：t = T/Θ，y = ħω/k_BΘ。
  // τ⁻¹ = b + a y⁴ + u y² t e^{−1/(3t)}（边界、点缺陷、倒逆过程），κ ∝ t³ ∫₀^{1/t} x⁴eˣ/(eˣ−1)² τ(xt) dx
  function kappa(t, { b = 1e-3, a = 0, u = 1 } = {}) {
    const xD = 1 / t, ex = Math.exp(-1 / (3 * t));
    const f = (x) => { const y = x * t; return (x * x * einsteinTerm(x)) / (b + a * y ** 4 + u * y * y * t * ex); };
    // 被积函数在 x 小处也平滑；分两段求积提高精度
    const top = Math.min(xD, 60), mid = Math.min(top, 8);
    return t ** 3 * (integrate(f, 0, mid) + (top > mid ? integrate(f, mid, top) : 0));
  }

  // ── 第八章：冻结声子（有限位移）─────────────────────────────────────
  // 一维链（m = 1）：最近邻的“键”是 Morse 势（阱深 1，平衡距离 rₑ = 1，α = 2，尾巴很短），
  // 再加一条范围为 λ 的排斥尾巴 Cλ² e^{−(r−1)/λ}（C = 2，它的二阶导数 C e^{−(r−1)/λ} 总是正的）：λ 越大，力常数伸得越远。
  // 只用 Morse 调范围不行：α 小时 Morse 的远处尾巴 φ″ < 0，长波本身就不稳定，分不清是插值的错还是物理的错。
  // 势在 rc 处截断，并把力平移到零（力连续）：φ(r) = V(r) − V(rc) − (r − rc) V′(rc)，r < rc。
  const PAIR = { rc: 5.537, alpha: 2, C: 2 }; // 截断半径故意取一个不会正好落在 n·a 上的数（a 的滑块步长是 0.01），否则有限位移会把一个近邻推过截断
  const mV = (r, lam) => { const e = Math.exp(-PAIR.alpha * (r - 1)); return (1 - e) ** 2 - 1 + PAIR.C * lam * lam * Math.exp(-(r - 1) / lam); };
  const mD1 = (r, lam) => { const e = Math.exp(-PAIR.alpha * (r - 1)); return 2 * PAIR.alpha * e * (1 - e) - PAIR.C * lam * Math.exp(-(r - 1) / lam); };
  const mD2 = (r, lam) => { const e = Math.exp(-PAIR.alpha * (r - 1)); return 2 * PAIR.alpha ** 2 * e * (2 * e - 1) + PAIR.C * Math.exp(-(r - 1) / lam); };
  const phi = (r, lam, rc = PAIR.rc) => (r < rc ? mV(r, lam) - mV(rc, lam) - (r - rc) * mD1(rc, lam) : 0);
  const phi1 = (r, lam, rc = PAIR.rc) => (r < rc ? mD1(r, lam) - mD1(rc, lam) : 0);
  const phi2 = (r, lam, rc = PAIR.rc) => (r < rc ? mD2(r, lam) : 0);
  // 解析的谐振色散：ω²(q) = (2/m) Σ_{n≥1} φ″(na)(1 − cos nqa)
  const pairW2 = (q, a, lam, rc = PAIR.rc) => { let s = 0; for (let n = 1; n * a < rc; n++) s += phi2(n * a, lam, rc) * (1 - Math.cos(n * q * a)); return 2 * s; };
  // N 个原子的周期超胞里，原子 0 移动 h 后各原子受的力（所有周期像都算进去）
  function pairForces(N, a, h, lam, rc = PAIR.rc) {
    const L = N * a, x = Array.from({ length: N }, (_, j) => j * a + (j === 0 ? h : 0)), F = new Float64Array(N), nimg = Math.ceil(rc / L) + 1;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let img = -nimg; img <= nimg; img++) {
      if (i === j && img === 0) continue;
      const d = x[j] + img * L - x[i], r = Math.abs(d);
      if (r < rc) F[i] += phi1(r, lam, rc) * Math.sign(d); // F_i = −∂φ/∂x_i = φ′(r)·sign(x_j − x_i)
    }
    return F;
  }
  // 有限位移得到的力常数 Φ(j) = −∂F_j/∂u₀；central = true 用 ±h 的中心差分；noise 是加在每个力上的高斯噪声（标准差）
  function fdConstants(N, a, h, lam, { central = true, noise = 0, seed = 1, rc = PAIR.rc } = {}) {
    const r = rng(seed), noisy = (F) => (noise ? F.map((f) => f + noise * gauss(r)) : F);
    const Fp = noisy(pairForces(N, a, h, lam, rc)), Fm = noisy(pairForces(N, a, central ? -h : 0, lam, rc));
    return Array.from(Fp, (f, j) => -(f - Fm[j]) / (central ? 2 * h : h));
  }
  // 由超胞力常数插值任意 q 的频率平方：ω²(q) = Σ_j Φ(j) cos(q x_j)，x_j 取最近的周期像（正好一半的距离时 cos 两边一样）
  function fdW2(q, Phi, a) { const N = Phi.length; let s = 0; for (let j = 0; j < N; j++) s += Phi[j] * Math.cos(q * (j > N / 2 ? j - N : j) * a); return s; }
  const signedW = (w2) => (w2 >= 0 ? Math.sqrt(w2) : -Math.sqrt(-w2)); // 习惯：虚频画成负数
  // 最近邻的 φ″ 在这里变号（对分法；没有尾巴时是 1 + ln2/α）
  function inflection(lam) { let lo = 1, hi = 4; if (mD2(hi, lam) > 0) return Infinity; for (let i = 0; i < 60; i++) { const m = (lo + hi) / 2; if (mD2(m, lam) > 0) lo = m; else hi = m; } return (lo + hi) / 2; }

  // ── 材料的 Debye 温度（K），Kittel《固体物理导论》第 8 版第 5 章表 1（低温极限的数值）──
  const DEBYE = { Pb: 105, Ag: 225, Na: 158, Cu: 343, Al: 428, Fe: 470, Si: 645, C: 2230 };

  window.MOLASTRIA_PHONON_MODELS = { TAU, rng, gauss, symEig, eig2, chainW2, chainW, chainVg, chainQs, chainHessian, diatomic, LAT2D, dyn2d, bzPath, band2d, bzPolygon, sound2d, FCC, FCC_A, FCC_VCELL, FCC_B, dynFcc, eig3vals, fccFreqs, squareFreqs, chainFreqs, histogram, chainDos, fccLowCoef, debyeFromCoef, bose, einsteinTerm, einsteinC, gaussLegendre, integrate, debyeC, debyeT3, cvFromFreqs, oscEnergy, R_GAS, NEUTRON, kOfE, lambdaOfE, MEV, qRange, scatAngle, FCC_WMAX, fccAlong, onePhonon, lorentz, HC_K, ramanRatio, ramanTemp, fpuW, fpuInit, fpuStep, fpuModes, fpuEnergy, qhaF, qhaVolume, kappa, PAIR, phi, phi1, phi2, pairW2, pairForces, fdConstants, fdW2, signedW, inflection, DEBYE };
})();
