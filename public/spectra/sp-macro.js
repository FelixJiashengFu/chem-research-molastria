/* 谱图馆的数学（下）：大分子与高分子一族的演示用到的模型。纯函数，没有 DOM（tools/spectra-test.mjs 测）。
   浏览器：window.MOLASTRIA_SPECTRA_MACRO；node：module.exports。常数照 sp-models.js（CODATA 2018）。 */
(function (root) {
  'use strict';
  const h = 6.62607015e-34, c = 2.99792458e8, e = 1.602176634e-19, me = 9.1093837015e-31, NA = 6.02214076e23, R = 8.314462618;

  // ── 电子显微镜 ────────────────────────────────────────────────────────
  /** 加速电压 kV 下电子的德布罗意波长（pm）；rel = false 时不做相对论修正。 */
  function electronWavelength(kV, rel = true) {
    const eV = e * kV * 1e3;
    return 1e12 * h / Math.sqrt(2 * me * eV * (rel ? 1 + eV / (2 * me * c * c) : 1));
  }
  /** 衬度传递函数 CTF(k)，k 是空间频率（Å⁻¹）。df 欠焦量（μm，正数是欠焦），cs 球差系数（mm），ac 振幅衬度比例，B 包络的 B 因子（Å²）。
      χ(k) = πλΔf k² − (π/2) C_s λ³ k⁴，CTF = −sin(χ + arcsin ac) · exp(−B k² / 4)。 */
  function ctf(k, o = {}) {
    const { kV = 300, df = 1.5, cs = 2.7, ac = 0.07, B = 0 } = o, lam = electronWavelength(kV) / 100; // Å
    const chi = Math.PI * lam * df * 1e4 * k * k - (Math.PI / 2) * cs * 1e7 * lam ** 3 * k ** 4;
    return -Math.sin(chi + Math.asin(ac)) * Math.exp((-B * k * k) / 4);
  }
  /** CTF 的前 n 个零点（Å⁻¹），只算球差还没开始主导的低频一段（逐点找变号再二分）。 */
  function ctfZeros(o = {}, n = 6, kmax = 0.5) {
    const out = [], f = (k) => ctf(k, { ...o, B: 0 });
    let k0 = 1e-4, v0 = f(k0);
    for (let k = 2e-4; k <= kmax && out.length < n; k += 1e-4) {
      const v = f(k);
      if (v0 * v < 0) { let a = k0, b = k; for (let i = 0; i < 40; i++) { const m = (a + b) / 2; if (f(a) * f(m) <= 0) b = m; else a = m; } out.push((a + b) / 2); }
      k0 = k; v0 = v;
    }
    return out;
  }
  /** 能量色散 X 射线谱仪（硅探测器）的分辨率：FWHM² = 噪声² + 2.3548²·F·ε·E。默认按 Mn Kα（5.895 keV）处 129 eV 定噪声，F = 0.115，ε = 3.76 eV。返回 eV。 */
  function edsFwhm(keV, at = 129) {
    const F = 0.115, eps = 3.76, k = 2.3548 ** 2 * F * eps, noise2 = at * at - k * 5895;
    return Math.sqrt(noise2 + k * keV * 1000);
  }

  // ── 核磁 ──────────────────────────────────────────────────────────────
  /** Karplus（1959）：邻位 ³J(H,H)（Hz）随二面角 φ（度）变化。0–90° 用 8.5cos²φ − 0.28，90–180° 用 9.5cos²φ − 0.28。 */
  function karplus(phi) {
    const p = ((Math.abs(phi) % 360) + 360) % 360, q = p > 180 ? 360 - p : p, cs = Math.cos((q * Math.PI) / 180);
    return (q <= 90 ? 8.5 : 9.5) * cs * cs - 0.28;
  }
  /** Bernoulli 统计：相邻两个单体成内消旋（m）的概率 Pm 给出三元组（mm、mr、rr）和五元组的比例。 */
  function triads(Pm) { const r = 1 - Pm; return { mm: Pm * Pm, mr: 2 * Pm * r, rr: r * r }; }
  function pentads(Pm) {
    const m = Pm, r = 1 - Pm;
    return { mmmm: m ** 4, mmmr: 2 * m ** 3 * r, rmmr: m * m * r * r, mmrr: 2 * m * m * r * r, mmrm: 2 * m ** 3 * r, rmrr: 2 * m * r ** 3, rmrm: 2 * m * m * r * r, rrrr: r ** 4, mrrr: 2 * m * r ** 3, mrrm: m * m * r * r };
  }
  /** 无规卷曲的 Cα、Cβ 化学位移（ppm），Wishart 等 1995（J. Biomol. NMR 5, 67）一类的典型值；甘氨酸没有 Cβ。 */
  const RANDOM_COIL = {
    G: [45.1, null], A: [52.5, 19.1], S: [58.3, 63.8], T: [61.8, 69.8], V: [62.2, 32.9], L: [55.1, 42.4], I: [61.1, 38.8], D: [54.2, 41.1], E: [56.6, 29.9], K: [56.2, 33.1],
    R: [56.0, 30.9], N: [53.1, 38.9], Q: [55.7, 29.4], F: [57.7, 39.6], Y: [57.9, 38.8], W: [57.5, 29.6], M: [55.4, 32.9], H: [55.0, 29.0], C: [58.2, 28.0], P: [63.3, 32.1],
  };
  /** 一段序列在 CBCANNH（HNCACB）和 CBCA(CO)NNH 里的条带：每个有 N–H 的残基（脯氨酸和 N 端第一个没有）一条。sec = 二级结构的位移偏差（helix: Cα +2.6, Cβ −0.4；sheet: Cα −1.4, Cβ +2.2；粗略的平均值）。 */
  function strips(seq, sec = '') {
    const s = String(seq).toUpperCase().replace(/[^A-Z]/g, ''), dev = { h: [2.6, -0.4], e: [-1.4, 2.2] };
    const shift = (i) => { const rc = RANDOM_COIL[s[i]]; if (!rc) throw new Error(`unknown residue "${s[i]}"`); const d = dev[sec[i]] || [0, 0]; return [rc[0] + d[0], rc[1] == null ? null : rc[1] + d[1]]; };
    const out = [];
    for (let i = 1; i < s.length; i++) {
      if (s[i] === 'P') continue;
      const own = shift(i), prev = shift(i - 1);
      out.push({ i: i + 1, res: s[i], prevRes: s[i - 1], own, prev });
    }
    return out;
  }

  // ── X 射线纤维衍射 ────────────────────────────────────────────────────
  /** 整数阶 Bessel 函数 J_n(x)，用积分表示 (1/π)∫₀^π cos(nτ − x sin τ) dτ（Simpson，x ≤ 40 时误差 < 1e-9）。 */
  function besselJ(n, x) {
    const N = 400, dt = Math.PI / N;
    let s = 0;
    for (let i = 0; i <= N; i++) { const t = i * dt, w = i === 0 || i === N ? 1 : i % 2 ? 4 : 2; s += w * Math.cos(n * t - x * Math.sin(t)); }
    return (s * dt) / 3 / Math.PI;
  }
  /** 螺旋的纤维衍射强度：螺距 P（Å）、半径 r（Å）、每圈 u 个重复单元、两条链沿轴错开 offset（以螺距计）。第 l 层线上 R（Å⁻¹）处的强度
      I = |1 + exp(2πi·l·offset)|² · Σ_m J²_{l−u·m}(2πRr)（m = −1、0、1，Cochran–Crick–Vand）。单链时 offset = null。 */
  function helixIntensity(l, R, o = {}) {
    const { r = 10, u = 10, offset = 0.375 } = o, x = 2 * Math.PI * Math.abs(R) * r;
    let s = 0;
    for (const m of [-1, 0, 1]) { const n = l - u * m; if (Math.abs(n) <= 2 * u) s += besselJ(Math.abs(n), x) ** 2; }
    const two = offset == null ? 1 : 4 * Math.cos(Math.PI * l * offset) ** 2;
    return two * s;
  }

  // ── 光散射与黏度 ──────────────────────────────────────────────────────
  /** 静态光散射的光学常数 K（mol·cm²·g⁻²）：K = 4π² n₀² (dn/dc)² / (N_A λ⁴)，λ 是真空波长（nm），dn/dc（mL/g）。 */
  const lsK = (n0, dndc, nm) => (4 * Math.PI ** 2 * n0 * n0 * dndc * dndc) / (NA * (nm * 1e-7) ** 4);
  /** Zimm 方程：Kc/R_θ = (1/M_w)(1 + q²R_g²/3) + 2A₂c。c（g/mL），Rg（nm），A2（mol·mL/g²），θ（度）。返回 Kc/R（mol/g）。 */
  function zimmY(c, theta, o) {
    const { Mw, Rg, A2, n0 = 1.496, nm = 658 } = o, q = (4 * Math.PI * n0 * Math.sin((theta * Math.PI) / 360)) / nm; // nm⁻¹
    return (1 / Mw) * (1 + (q * q * Rg * Rg) / 3) + 2 * A2 * c;
  }
  /** 从 (c, θ, Kc/R) 点用最小二乘拟合平面 y = a + b·sin²(θ/2) + d·c，反推 M_w、R_g、A₂。 */
  function zimmFit(points, o = {}) {
    const { n0 = 1.496, nm = 658 } = o, rows = points.map((p) => [1, Math.sin((p.theta * Math.PI) / 360) ** 2, p.c]), y = points.map((p) => p.y);
    const A = [[0, 0, 0], [0, 0, 0], [0, 0, 0]], b = [0, 0, 0];
    rows.forEach((r, k) => { for (let i = 0; i < 3; i++) { b[i] += r[i] * y[k]; for (let j = 0; j < 3; j++) A[i][j] += r[i] * r[j]; } });
    const x = solve3(A, b), Mw = 1 / x[0], Rg = Math.sqrt((3 * x[1] * nm * nm) / (16 * Math.PI ** 2 * n0 * n0 * x[0]));
    return { Mw, Rg, A2: x[2] / 2, a: x[0], b: x[1], d: x[2] };
  }
  function solve3(A, b) {
    const M = A.map((r, i) => [...r, b[i]]);
    for (let i = 0; i < 3; i++) {
      let p = i; for (let k = i + 1; k < 3; k++) if (Math.abs(M[k][i]) > Math.abs(M[p][i])) p = k;
      [M[i], M[p]] = [M[p], M[i]];
      for (let k = 0; k < 3; k++) if (k !== i) { const f = M[k][i] / M[i][i]; for (let j = i; j < 4; j++) M[k][j] -= f * M[i][j]; }
    }
    return M.map((r, i) => r[3] / r[i]);
  }
  /** 稀溶液黏度：给定特性黏数 [η]（mL/g）和 Huggins 常数 k_H，浓度 c（g/mL）下的相对黏度 η_r = 1 + [η]c + k_H[η]²c²。 */
  const viscRel = (c, eta, kH = 0.35) => 1 + eta * c + kH * eta * eta * c * c;
  /** 直线拟合 y = a + b x（最小二乘）。 */
  function linfit(xs, ys) {
    const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
    let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (xs[i] - mx) * (ys[i] - my); sxx += (xs[i] - mx) ** 2; }
    const b = sxy / sxx; return { a: my - b * mx, b };
  }
  /** Mark–Houwink：[η] = K·M^a，反过来 M_v = ([η]/K)^(1/a)。 */
  const markHouwinkM = (eta, K, a) => (eta / K) ** (1 / a);

  // ── 分析超速离心 ──────────────────────────────────────────────────────
  /** Svedberg 方程：M = s·R·T / (D·(1 − v̄ρ))。s（S，10⁻¹³ s），D（cm²/s），v̄（mL/g），ρ（g/mL），T（K）。返回 kg/mol。 */
  const svedberg = (s, D, vbar = 0.73, rho = 0.9982, T = 293.15) => (s * 1e-13 * R * T) / (D * 1e-4 * (1 - vbar * rho));
  /** 沉降速度实验里 t 秒时的浓度分布（相对初始浓度）：界面在 r_b = r_m·exp(ω²st)，宽度由扩散给出，平台按径向稀释 exp(−2ω²st) 降低（近似的 Faxén 解）。 */
  function svProfile(r, t, o = {}) {
    const { s = 4.3, D = 5.9e-7, rpm = 50000, rm = 6.0 } = o, w2 = (2 * Math.PI * rpm / 60) ** 2, st = s * 1e-13 * w2 * t, rb = rm * Math.exp(st);
    if (r < rm) return 0;
    return Math.exp(-2 * st) * 0.5 * erfc((rb - r) / Math.sqrt(4 * D * Math.max(t, 1)));
  }
  const svBoundary = (t, o = {}) => { const { s = 4.3, rpm = 50000, rm = 6.0 } = o; return rm * Math.exp(s * 1e-13 * (2 * Math.PI * rpm / 60) ** 2 * t); };
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }

  // ── 热稳定性 ──────────────────────────────────────────────────────────
  /** 两态去折叠：ΔG_u(T) = ΔH(1 − T/Tm) + ΔCp(T − Tm − T ln(T/Tm))（J/mol）；只和天然态结合的配体（解离常数 Kd，浓度 L，同单位）再加 RT ln(1 + L/Kd)。 */
  function unfoldDG(T, o = {}) {
    const { Tm = 328.15, dH = 400e3, dCp = 8e3, L = 0, Kd = 1 } = o;
    return dH * (1 - T / Tm) + dCp * (T - Tm - T * Math.log(T / Tm)) + R * T * Math.log(1 + L / Kd);
  }
  const fracUnfolded = (T, o) => { const K = Math.exp(-unfoldDG(T, o) / (R * T)); return K / (1 + K); };
  /** 表观熔点：ΔG_u = 0 的温度（二分法，250–400 K）。 */
  function apparentTm(o) { let a = 250, b = 400; for (let i = 0; i < 60; i++) { const m = (a + b) / 2; if (unfoldDG(a, o) * unfoldDG(m, o) <= 0) b = m; else a = m; } return (a + b) / 2; }

  // ── 氢氘交换 ──────────────────────────────────────────────────────────
  /** 一段肽在 t 秒时吸收的氘数：每个可交换的酰胺氢 i 以 k_int/PF_i 交换；D₂O 占比 dfrac，回交换损失 back。 */
  const hdxUptake = (t, pf, o = {}) => { const { kint = 3, dfrac = 0.9, back = 0.25 } = o; return dfrac * (1 - back) * pf.reduce((s, p) => s + (1 - Math.exp((-kint * t) / p)), 0); };
  /** 氘原子数的分布（Poisson–二项）：每个位点被氘取代的概率 p_i。 */
  function deuteriumDist(ps) {
    let d = [1];
    for (const p of ps) { const n = new Array(d.length + 1).fill(0); d.forEach((v, k) => { n[k] += v * (1 - p); n[k + 1] += v * p; }); d = n; }
    return d;
  }
  /** 残基的元素组成（不含末端的水）。 */
  const RESIDUE_FORMULA = {
    G: 'C2H3NO', A: 'C3H5NO', S: 'C3H5NO2', P: 'C5H7NO', V: 'C5H9NO', T: 'C4H7NO2', C: 'C3H5NOS', L: 'C6H11NO', I: 'C6H11NO', N: 'C4H6N2O2', D: 'C4H5NO3',
    Q: 'C5H8N2O2', K: 'C6H12N2O', E: 'C5H7NO3', M: 'C5H9NOS', H: 'C6H7N3O', F: 'C9H9NO', R: 'C6H12N4O', Y: 'C9H9NO2', W: 'C11H10N2O',
  };
  function peptideFormula(seq) {
    const tot = { H: 2, O: 1 };
    for (const ch of String(seq).toUpperCase()) { const f = RESIDUE_FORMULA[ch]; if (!f) throw new Error(`unknown residue "${ch}"`); for (const [, el, n] of f.matchAll(/([A-Z][a-z]?)(\d*)/g)) tot[el] = (tot[el] || 0) + (n ? +n : 1); }
    return ['C', 'H', 'N', 'O', 'S'].filter((el) => tot[el]).map((el) => `${el}${tot[el] > 1 ? tot[el] : ''}`).join('');
  }
  /** 能交换、又能在质谱里看到的酰胺氢数：去掉 N 端两个（回交换太快）和脯氨酸。 */
  const exchangeableAmides = (seq) => [...String(seq).toUpperCase()].filter((ch, i) => i >= 2 && ch !== 'P').length;
  const D_MINUS_H = 2.014101778 - 1.007825032;

  // ── 凝胶电泳 ──────────────────────────────────────────────────────────
  /** SDS-PAGE 的半对数校准：log₁₀M 对迁移率 Rf 作直线（最小二乘），返回 M(Rf)。 */
  function gelCalibration(ladder) { const f = linfit(ladder.map((l) => l.rf), ladder.map((l) => Math.log10(l.m))); return { ...f, mass: (rf) => 10 ** (f.a + f.b * rf), rf: (m) => (Math.log10(m) - f.a) / f.b }; }

  const api = {
    electronWavelength, ctf, ctfZeros, edsFwhm, karplus, triads, pentads, RANDOM_COIL, strips, besselJ, helixIntensity,
    lsK, zimmY, zimmFit, viscRel, linfit, markHouwinkM, svedberg, svProfile, svBoundary, erfc, unfoldDG, fracUnfolded, apparentTm,
    hdxUptake, deuteriumDist, RESIDUE_FORMULA, peptideFormula, exchangeableAmides, D_MINUS_H, gelCalibration,
  };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MOLASTRIA_SPECTRA_MACRO = api;
})(typeof self !== 'undefined' ? self : globalThis);
