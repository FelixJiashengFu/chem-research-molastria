/* 谱图馆的数学：页面上所有“算出来的”谱和演示都从这里来。纯函数，没有 DOM（tools/spectra-test.mjs 测）。
   浏览器：window.MOLASTRIA_SPECTRA_MODELS；node：module.exports。
   同位素质量和丰度、X 射线散射因子在 sp-tables.js（生成的表），这里只做计算。 */
(function (root) {
  'use strict';
  const TABLES = (typeof module === 'object' && module.exports) ? require('./sp-tables.js') : root.MOLASTRIA_SPECTRA_TABLES;
  const ISO = TABLES.isotopes, XSF = TABLES.xsf;

  // ── 常数（CODATA 2018）────────────────────────────────────────────────
  const K = {
    h: 6.62607015e-34, c: 2.99792458e8, kB: 1.380649e-23, e: 1.602176634e-19, NA: 6.02214076e23, R: 8.314462618, F: 96485.33212,
    me: 5.48579909065e-4,           // 电子质量（u）
    mp: 1.007276466621,             // 质子质量（u）
    amu: 1.66053906660e-27,
    muB: 9.2740100783e-24, muN: 5.0507837461e-27,
    hc_eVnm: 1239.841984,           // E(eV) = 1239.84 / λ(nm)
    cm_per_eV: 8065.543937,         // 1 eV = 8065.54 cm⁻¹
    kB_cm: 0.695034800,             // k_B，cm⁻¹/K
    RH: 109677.58341,               // 氢原子的 Rydberg 常数（cm⁻¹，已含约化质量）
  };

  // ── 单位换算 ──────────────────────────────────────────────────────────
  const conv = {
    nmToEv: (nm) => K.hc_eVnm / nm,
    evToNm: (ev) => K.hc_eVnm / ev,
    nmToCm: (nm) => 1e7 / nm,
    cmToNm: (cm) => 1e7 / cm,
    cmToEv: (cm) => cm / K.cm_per_eV,
    evToCm: (ev) => ev * K.cm_per_eV,
    cmToHz: (cm) => cm * K.c * 100,
    hzToCm: (hz) => hz / (K.c * 100),
    cmToKjMol: (cm) => (cm * 100 * K.h * K.c * K.NA) / 1000,
    /** 拉曼位移（cm⁻¹）在给定激光波长（nm）下对应的散射光波长（nm）；Stokes 一侧位移为正。 */
    ramanToNm: (shift, laserNm) => 1e7 / (1e7 / laserNm - shift),
    /** 真空波长 → 标准空气中的波长（nm）。Edlén 1966 的折射率公式，200 nm 以上适用。 */
    vacToAir: (nm) => { const s2 = (1e3 / nm) ** 2; return nm / (1 + 8.34254e-5 + 2.406147e-2 / (130 - s2) + 1.5998e-4 / (38.9 - s2)); },
  };

  // ── 线型 ──────────────────────────────────────────────────────────────
  const LN2 = Math.log(2);
  /** 面积为 1 的线型；fwhm 是半高全宽。shape: 'gauss' | 'lorentz'。 */
  function line(d, fwhm, shape) {
    if (shape === 'lorentz') { const g = fwhm / 2; return g / (Math.PI * (d * d + g * g)); }
    const s = fwhm / Math.sqrt(8 * LN2);
    return Math.exp(-(d * d) / (2 * s * s)) / (s * Math.sqrt(2 * Math.PI));
  }
  /** 把一组棒 [{ x, y, w? }] 展宽成连续曲线。opts: { from, to, n = 1200, fwhm, shape = 'gauss', peak = false }。
      peak 为 true 时每条棒的峰高等于 y（而不是面积等于 y），画“示意谱”时用。 */
  function broaden(sticks, opts) {
    const { from, to, n = 1200, shape = 'gauss', peak = false } = opts;
    const xs = new Array(n), ys = new Array(n).fill(0);
    for (let i = 0; i < n; i++) xs[i] = from + ((to - from) * i) / (n - 1);
    for (const s of sticks) {
      const w = s.w || opts.fwhm, norm = peak ? s.y / line(0, w, s.shape || shape) : s.y;
      const cut = (s.shape || shape) === 'lorentz' ? 40 * w : 4 * w;
      for (let i = 0; i < n; i++) { const d = xs[i] - s.x; if (Math.abs(d) <= cut) ys[i] += norm * line(d, w, s.shape || shape); }
    }
    return { xs, ys };
  }
  /** 一阶导数线型（EPR 的记录方式）：洛伦兹或高斯吸收线对场的导数，峰-峰宽 pp。 */
  function derivLine(d, pp, shape) {
    if (shape === 'gauss') { const s = pp / 2; return (-d / (s * s)) * Math.exp(-(d * d) / (2 * s * s)); }
    const g = (pp * Math.sqrt(3)) / 2; // 洛伦兹：ΔB_pp = (2/√3)·Γ(半高半宽)
    return (-2 * d * g) / (Math.PI * (d * d + g * g) ** 2);
  }

  // ── 分子式、质量、同位素峰型 ──────────────────────────────────────────
  /** 'C8H10N4O2'、'Ca(OH)2'、'CuSO4·5H2O' → { C: 8, H: 10, ... }。认不出的元素抛错。 */
  function parseFormula(str) {
    const s = String(str).replace(/\s+/g, '').replace(/[·.*]/g, '·');
    const total = {};
    for (const part of s.split('·')) {
      if (!part) continue;
      const lead = part.match(/^(\d+)(?=[A-Z(\[])/);
      const mult = lead ? Number(lead[1]) : 1, body = lead ? part.slice(lead[0].length) : part;
      let i = 0;
      const group = (close) => {
        const out = {};
        while (i < body.length) {
          const ch = body[i];
          if (ch === '(' || ch === '[') { i++; const inner = group(ch === '(' ? ')' : ']'); const m = body.slice(i).match(/^\d+/); const k = m ? Number(m[0]) : 1; if (m) i += m[0].length; for (const el in inner) out[el] = (out[el] || 0) + inner[el] * k; continue; }
          if (ch === close) { i++; return out; }
          const m = body.slice(i).match(/^([A-Z][a-z]?)(\d*)/);
          if (!m) throw new Error(`cannot read "${body.slice(i)}" in formula "${str}"`);
          if (!ISO[m[1]]) throw new Error(`unknown element "${m[1]}" in formula "${str}"`);
          out[m[1]] = (out[m[1]] || 0) + (m[2] ? Number(m[2]) : 1);
          i += m[0].length;
        }
        if (close) throw new Error(`missing "${close}" in formula "${str}"`);
        return out;
      };
      const one = group('');
      for (const el in one) total[el] = (total[el] || 0) + one[el] * mult;
    }
    if (!Object.keys(total).length) throw new Error('empty formula');
    return total;
  }
  const lightest = (el) => ISO[el].i.reduce((a, b) => (b[2] > a[2] ? b : a));
  /** 单同位素质量（每种元素取丰度最高的同位素）。charge ≠ 0 时返回 m/z（扣掉或加上电子质量）。 */
  function monoMass(formula, charge = 0) {
    const f = typeof formula === 'string' ? parseFormula(formula) : formula;
    let m = 0;
    for (const el in f) m += lightest(el)[1] * f[el];
    return charge ? (m - charge * K.me) / Math.abs(charge) : m;
  }
  /** 平均（化学）摩尔质量，用标准原子量。 */
  function avgMass(formula) {
    const f = typeof formula === 'string' ? parseFormula(formula) : formula;
    let m = 0;
    for (const el in f) m += ISO[el].m * f[el];
    return m;
  }
  /** 各元素的质量分数（元素分析 CHN 用）。 */
  function composition(formula) {
    const f = typeof formula === 'string' ? parseFormula(formula) : formula, M = avgMass(f), out = {};
    for (const el in f) out[el] = (ISO[el].m * f[el]) / M;
    return out;
  }
  /** 不饱和度（环加双键数），只按 C、H、N、P、卤素、Si 计。 */
  function dbe(formula) {
    const f = typeof formula === 'string' ? parseFormula(formula) : formula, g = (k) => f[k] || 0;
    return g('C') + g('Si') - (g('H') + g('F') + g('Cl') + g('Br') + g('I')) / 2 + (g('N') + g('P')) / 2 + 1;
  }
  /**
   * 同位素峰型：把每个原子的同位素分布逐个卷起来。
   * opts: { charge = 0（给 m/z）, resolution = 0.2（质量相差不到这么多的峰并成一个；给 1e-4 看精细结构）, min = 1e-6（相对丰度低于它的丢掉） }
   * 返回 [{ mz, mass, p（总和为 1 的概率）, rel（最高峰为 100）}]，按质量排序。
   */
  function isotopePattern(formula, opts = {}) {
    const f = typeof formula === 'string' ? parseFormula(formula) : formula;
    const { charge = 0, resolution = 0.2, min = 1e-6 } = opts;
    const merge = (peaks) => {
      peaks.sort((a, b) => a[0] - b[0]);
      const out = [];
      for (const p of peaks) {
        const last = out[out.length - 1];
        if (last && p[0] - last[0] < resolution) { const w = last[1] + p[1]; last[0] = (last[0] * last[1] + p[0] * p[1]) / w; last[1] = w; } else out.push([p[0], p[1]]);
      }
      const top = Math.max(...out.map((p) => p[1]));
      return out.filter((p) => p[1] >= top * min * 0.01);
    };
    const convolve = (a, b) => { const out = []; for (const x of a) for (const y of b) out.push([x[0] + y[0], x[1] * y[1]]); return merge(out); };
    let dist = [[0, 1]];
    for (const el in f) {
      // 一种元素 n 个原子：二进制拆分，反复平方
      let base = ISO[el].i.map((r) => [r[1], r[2]]), n = f[el], acc = [[0, 1]];
      const norm = base.reduce((s, p) => s + p[1], 0);
      base = base.map((p) => [p[0], p[1] / norm]);
      while (n > 0) { if (n & 1) acc = convolve(acc, base); n >>= 1; if (n) base = convolve(base, base); }
      dist = convolve(dist, acc);
    }
    const top = Math.max(...dist.map((p) => p[1])), z = Math.abs(charge) || 1;
    return dist.filter((p) => p[1] >= top * min).map(([mass, p]) => ({ mass, mz: charge ? (mass - charge * K.me) / z : mass, p, rel: (100 * p) / top }));
  }
  /** 带电荷的写法：'C8H11N4O2+'（末尾一个 + 或 − 是一个电荷，'++' 是两个）、'SO4 2-'（空格后写电荷数）→ { formula, charge }；没有电荷记号时 charge = 0。 */
  function ion(str) {
    const s = String(str).trim();
    let m = s.match(/^(.+?)\s+(\d+)([+-])$/);
    if (m) return { formula: m[1], charge: (m[3] === '+' ? 1 : -1) * Number(m[2]) };
    m = s.match(/^(.+?)(\++|-+)$/);
    if (m) return { formula: m[1].trim(), charge: (m[2][0] === '+' ? 1 : -1) * m[2].length };
    return { formula: s, charge: 0 };
  }
  /** 常见加合离子的 m/z。M 是中性分子的单同位素质量。 */
  const ADDUCTS = {
    '[M+H]+': (M) => M + K.mp, '[M+Na]+': (M) => M + 22.98976928 - K.me, '[M+K]+': (M) => M + 38.96370649 - K.me, '[M+NH4]+': (M) => M + 18.03437413 - K.me,
    '[M+2H]2+': (M) => (M + 2 * K.mp) / 2, '[2M+H]+': (M) => 2 * M + K.mp, '[M-H]-': (M) => M - K.mp, '[M+Cl]-': (M) => M + 34.96885268 + K.me,
    '[M+HCOO]-': (M) => M + 44.99765427 + K.me, '[M]+•': (M) => M - K.me,
  };
  /** 质量偏差（ppm）。 */
  const ppm = (measured, exact) => (1e6 * (measured - exact)) / exact;
  /** 多电荷离子：ESI 里蛋白质（质量 M）带 z 个质子的 m/z。 */
  const chargeState = (M, z) => (M + z * K.mp) / z;
  /** 从相邻两个电荷态的 m/z（m1 < m2，m1 的电荷多一个）反推 m2 那个峰的电荷 z 和分子质量 M。 */
  function deconvolute(m1, m2) { const z2 = (m1 - K.mp) / (m2 - m1), z = Math.round(z2); return { z, M: z * (m2 - K.mp) }; }

  // 肽段的 b / y 离子（单电荷，单同位素质量）
  const RESIDUE = { G: 57.021464, A: 71.037114, S: 87.032028, P: 97.052764, V: 99.068414, T: 101.047679, C: 103.009185, L: 113.084064, I: 113.084064, N: 114.042927, D: 115.026943, Q: 128.058578, K: 128.094963, E: 129.042593, M: 131.040485, H: 137.058912, F: 147.068414, R: 156.101111, Y: 163.063329, W: 186.079313 };
  const WATER = 18.010565;
  function peptide(seq) {
    const s = String(seq).toUpperCase().replace(/[^A-Z]/g, '');
    for (const ch of s) if (!RESIDUE[ch]) throw new Error(`unknown residue "${ch}"`);
    const M = [...s].reduce((a, ch) => a + RESIDUE[ch], 0) + WATER, b = [], y = [];
    let run = 0;
    for (let i = 0; i < s.length - 1; i++) { run += RESIDUE[s[i]]; b.push({ n: i + 1, mz: run + K.mp, seq: s.slice(0, i + 1) }); }
    run = 0;
    for (let i = s.length - 1; i > 0; i--) { run += RESIDUE[s[i]]; y.push({ n: s.length - i, mz: run + WATER + K.mp, seq: s.slice(i) }); }
    return { seq: s, M, mh: M + K.mp, mh2: (M + 2 * K.mp) / 2, b, y };
  }

  // ── 质量分析器 ────────────────────────────────────────────────────────
  /** 飞行时间（s）：离子（m/z）经电压 U（V）加速后飞过长度 L（m）的无场区。 */
  const tofTime = (mz, U, L) => L * Math.sqrt((mz * K.amu) / (2 * K.e * U));
  /** 回旋频率（Hz）：FT-ICR，磁场 B（T）。 */
  const cyclotron = (mz, B) => (K.e * B) / (2 * Math.PI * mz * K.amu);
  /** 分开两个质量所需的分辨率 m/Δm。 */
  const resolvingPower = (m1, m2) => ((m1 + m2) / 2) / Math.abs(m1 - m2);

  // ── 双原子分子的转振谱 ────────────────────────────────────────────────
  // 光谱常数（cm⁻¹），取自 Huber & Herzberg《Constants of Diatomic Molecules》(1979)。mu 是约化质量（u），给同位素换算用。
  const DIATOMICS = {
    'H35Cl': { we: 2990.9463, wexe: 52.8186, weye: 0.22437, weze: -0.01218, Be: 10.59341, ae: 0.30718, De: 5.3194e-4, mA: 1.00782503, mB: 34.96885268 },
    '12C16O': { we: 2169.81358, wexe: 13.28831, weye: 0.010511, Be: 1.93128087, ae: 0.01750441, De: 6.12147e-6, mA: 12, mB: 15.99491462 },
  };
  /** 同位素替换：约化质量变了，常数按 ρ = √(μ/μ′) 的幂次缩放。 */
  function isotopologue(base, mA, mB) {
    const mu = (base.mA * base.mB) / (base.mA + base.mB), mu2 = (mA * mB) / (mA + mB), r = Math.sqrt(mu / mu2);
    return { we: base.we * r, wexe: base.wexe * r * r, weye: base.weye * r ** 3, weze: (base.weze || 0) * r ** 4, Be: base.Be * r * r, ae: base.ae * r ** 3, De: base.De * r ** 4, mA, mB };
  }
  DIATOMICS['H37Cl'] = isotopologue(DIATOMICS['H35Cl'], 1.00782503, 36.96590259);
  DIATOMICS['D35Cl'] = isotopologue(DIATOMICS['H35Cl'], 2.01410178, 34.96885268);
  DIATOMICS['13C16O'] = isotopologue(DIATOMICS['12C16O'], 13.00335484, 15.99491462);
  /** 能级 E(v, J)，cm⁻¹（从势阱底算起）。 */
  function rovibLevel(c, v, J) {
    const x = v + 0.5, jj = J * (J + 1);
    return c.we * x - c.wexe * x * x + (c.weye || 0) * x ** 3 + (c.weze || 0) * x ** 4 + (c.Be - c.ae * x) * jj - c.De * jj * jj;
  }
  /**
   * 基频带（v = 0 → v′，默认 1）的 P、R 支。T：温度（K）。返回 [{ branch: 'P'|'R', J（下能级）, nu, rel }]，rel 归一到最强线为 1。
   * 强度 ∝ ν · S_J · exp(−E_rot(J)/kT)，Hönl–London 因子 S = J+1（R 支）、J（P 支）。
   */
  function rovibBand(c, T = 296, opts = {}) {
    const { v1 = 1, jmax = 40 } = opts, lines = [], e0 = rovibLevel(c, 0, 0);
    for (let J = 0; J <= jmax; J++) {
      const pop = Math.exp(-(rovibLevel(c, 0, J) - e0) / (K.kB_cm * T));
      const r = rovibLevel(c, v1, J + 1) - rovibLevel(c, 0, J);
      lines.push({ branch: 'R', J, nu: r, rel: r * (J + 1) * pop });
      if (J >= 1) { const p = rovibLevel(c, v1, J - 1) - rovibLevel(c, 0, J); lines.push({ branch: 'P', J, nu: p, rel: p * J * pop }); }
    }
    const top = Math.max(...lines.map((l) => l.rel));
    return lines.map((l) => ({ ...l, rel: l.rel / top })).filter((l) => l.rel > 1e-5).sort((a, b) => a.nu - b.nu);
  }
  /** 带心 ν₀ = G(v′) − G(0)。 */
  const bandOrigin = (c, v1 = 1) => rovibLevel(c, v1, 0) - rovibLevel(c, 0, 0);
  /** 纯转动谱（v = 0）：J → J+1 的线，频率（GHz）和相对强度。强度 ∝ ν²·(J+1)·exp(−E_J/kT)·(1 − exp(−hν/kT))。 */
  function rotationalLines(c, T = 296, jmax = 30) {
    const out = [], e0 = rovibLevel(c, 0, 0);
    for (let J = 0; J <= jmax; J++) {
      const nu = rovibLevel(c, 0, J + 1) - rovibLevel(c, 0, J), pop = Math.exp(-(rovibLevel(c, 0, J) - e0) / (K.kB_cm * T));
      out.push({ J, cm: nu, ghz: conv.cmToHz(nu) / 1e9, rel: nu * nu * (J + 1) * pop * (1 - Math.exp(-nu / (K.kB_cm * T))) });
    }
    const top = Math.max(...out.map((l) => l.rel));
    return out.map((l) => ({ ...l, rel: l.rel / top }));
  }
  /** 平衡键长（Å），由 Be 算：Be = h / (8π² c μ r²)。 */
  const bondLength = (c) => { const mu = ((c.mA * c.mB) / (c.mA + c.mB)) * K.amu; return 1e10 * Math.sqrt(K.h / (8 * Math.PI ** 2 * K.c * 100 * c.Be * mu)); };

  // ── 氢原子谱线 ────────────────────────────────────────────────────────
  /** n2 → n1 的跃迁：真空波数（cm⁻¹）、真空波长和空气波长（nm）。 */
  function hydrogenLine(n1, n2) { const nu = K.RH * (1 / (n1 * n1) - 1 / (n2 * n2)), vac = 1e7 / nu; return { nu, vac, air: vac > 200 ? conv.vacToAir(vac) : vac }; }

  // ── 拉曼强度 ──────────────────────────────────────────────────────────
  /** 拉曼活性 S（Å⁴/amu）→ 相对散射强度：∝ (ν₀ − ν)⁴ · S / (ν · (1 − exp(−hcν/kT)))。laserNm：激发波长。 */
  function ramanIntensity(act, shift, laserNm = 532, T = 298) {
    const nu0 = 1e7 / laserNm;
    return ((nu0 - shift) ** 4 * act) / (shift * (1 - Math.exp(-shift / (K.kB_cm * T))));
  }
  /** 反 Stokes / Stokes 强度比。 */
  const antiStokesRatio = (shift, laserNm = 532, T = 298) => { const nu0 = 1e7 / laserNm; return ((nu0 + shift) / (nu0 - shift)) ** 4 * Math.exp(-shift / (K.kB_cm * T)); };

  // ── 朗伯–比尔定律 ─────────────────────────────────────────────────────
  /** 吸光度 A = ε c l；stray 是杂散光占入射光的比例（0 表示理想仪器）。返回 { A（表观）, T }。 */
  function beer(eps, conc, path = 1, stray = 0) { const T0 = 10 ** (-eps * conc * path), T = (T0 + stray) / (1 + stray); return { A: -Math.log10(T), T, ideal: eps * conc * path }; }

  // ── 电子光谱的振动结构（Franck–Condon）───────────────────────────────
  /** 一个位移谐振子的振动序列：强度按 Poisson 分布 S^n e^{−S} / n!。emission 为 true 时向低能方向排（镜像）。 */
  function vibronic(e00, spacing, S, n = 7, emission = false) {
    const out = [];
    let fact = 1;
    for (let k = 0; k < n; k++) { if (k) fact *= k; out.push({ x: e00 + (emission ? -1 : 1) * k * spacing, y: (S ** k * Math.exp(-S)) / fact, n: k }); }
    return out;
  }
  /** 荧光衰减：exp(−t/τ) 卷上高斯型仪器响应（中心 t0，标准差 s）的解析式。 */
  function decayIrf(t, tau, t0 = 0, s = 0.1) {
    const z = (s * s / tau - (t - t0)) / (s * Math.SQRT2);
    return 0.5 * Math.exp((s * s) / (2 * tau * tau) - (t - t0) / tau) * erfc(z);
  }
  function erfc(x) { // Abramowitz–Stegun 7.1.26，绝对误差 < 1.5e-7
    const z = Math.abs(x), t = 1 / (1 + 0.3275911 * z);
    const y = t * (0.254829592 + t * (-0.284496736 + t * (1.421413741 + t * (-1.453152027 + t * 1.061405429)))) * Math.exp(-z * z);
    return x >= 0 ? y : 2 - y;
  }

  // ── 粉末 X 射线衍射 ───────────────────────────────────────────────────
  const WAVELENGTHS = { 'Cu Kα': 1.5418, 'Cu Kα1': 1.540593, 'Mo Kα': 0.71073, 'Co Kα': 1.79026, 'Cr Kα': 2.29100, 'Ag Kα': 0.56087 };
  /** 原子散射因子 f(s)，s = sinθ/λ（Å⁻¹）。 */
  function scatteringFactor(el, s) {
    const p = XSF[el];
    if (!p) throw new Error(`no scattering factor for ${el}`);
    let sum = 0;
    for (let i = 0; i < 8; i += 2) sum += p[i] * Math.exp(-p[i + 1] * s * s);
    return ISO[el].z - 41.78214 * s * s * sum;
  }
  const rad = (d) => (d * Math.PI) / 180;
  /** 倒易度规：返回 d(h,k,l)（Å）。cell: { a, b, c, alpha, beta, gamma }（缺省的角是 90°，缺省的 b、c 等于 a）。 */
  function dSpacing(cell, h, k, l) {
    const a = cell.a, b = cell.b || a, c = cell.c || a, al = rad(cell.alpha || 90), be = rad(cell.beta || 90), ga = rad(cell.gamma || 90);
    const ca = Math.cos(al), cb = Math.cos(be), cg = Math.cos(ga), sa = Math.sin(al), sb = Math.sin(be), sg = Math.sin(ga);
    const V2 = 1 - ca * ca - cb * cb - cg * cg + 2 * ca * cb * cg;
    const inv = (h * h * sa * sa) / (a * a) + (k * k * sb * sb) / (b * b) + (l * l * sg * sg) / (c * c)
      + (2 * h * k * (ca * cb - cg)) / (a * b) + (2 * k * l * (cb * cg - ca)) / (b * c) + (2 * h * l * (cg * ca - cb)) / (a * c);
    return Math.sqrt(V2 / inv);
  }
  /**
   * 粉末衍射图。crystal: { cell, atoms: [{ el, x, y, z, occ?, B? }]（整个晶胞里的全部原子，分数坐标）}。
   * opts: { lambda = 1.5418, tmin = 5, tmax = 90 }。
   * 强度 I = m·|F|²·LP，LP = (1 + cos²2θ)/(sin²θ cosθ)；多重度 m 靠把球内所有 hkl 都数一遍自动得到。
   * 返回 [{ tt（2θ，度）, d, I（最强为 100）, hkl: [h,k,l]（代表的一组）, m }]。
   */
  function powderPattern(crystal, opts = {}) {
    const { lambda = 1.5418, tmin = 5, tmax = 90 } = opts, cell = crystal.cell;
    const dmin = lambda / (2 * Math.sin(rad(tmax / 2))), a = cell.a, b = cell.b || a, c = cell.c || a;
    const H = Math.ceil(a / dmin) + 1, Kmax = Math.ceil(b / dmin) + 1, Lmax = Math.ceil(c / dmin) + 1, groups = new Map();
    for (let h = -H; h <= H; h++) for (let k = -Kmax; k <= Kmax; k++) for (let l = -Lmax; l <= Lmax; l++) {
      if (!h && !k && !l) continue;
      const d = dSpacing(cell, h, k, l);
      if (d < dmin) continue;
      const st = lambda / (2 * d), tt = (2 * Math.asin(st) * 180) / Math.PI;
      if (tt < tmin || tt > tmax) continue;
      const s = 1 / (2 * d);
      let re = 0, im = 0;
      for (const at of crystal.atoms) {
        const f = scatteringFactor(at.el, s) * (at.occ ?? 1) * Math.exp(-(at.B || 0) * s * s), ph = 2 * Math.PI * (h * at.x + k * at.y + l * at.z);
        re += f * Math.cos(ph); im += f * Math.sin(ph);
      }
      const F2 = re * re + im * im;
      if (F2 < 1e-6) continue;
      const th = rad(tt / 2), lp = (1 + Math.cos(2 * th) ** 2) / (Math.sin(th) ** 2 * Math.cos(th));
      const key = d.toFixed(4);
      const g = groups.get(key) || { d, tt, I: 0, m: 0, hkl: [h, k, l] };
      g.I += F2 * lp; g.m += 1;
      // 代表指数：非负、从大到小排的那一个最好看
      const score = (v) => (v[0] >= 0 && v[1] >= 0 && v[2] >= 0 ? 1e6 : 0) + v[0] * 1e4 + v[1] * 1e2 + v[2];
      if (score([h, k, l]) > score(g.hkl)) g.hkl = [h, k, l];
      groups.set(key, g);
    }
    const peaks = [...groups.values()].sort((p, q) => p.tt - q.tt), top = Math.max(...peaks.map((p) => p.I));
    return peaks.map((p) => ({ ...p, I: (100 * p.I) / top })).filter((p) => p.I > 0.05);
  }
  /** Bragg 定律和 Scherrer 公式。size：晶粒尺寸（nm）→ 峰的半高宽（度 2θ）。 */
  const bragg = { twoTheta: (d, lambda = 1.5418) => (2 * Math.asin(lambda / (2 * d)) * 180) / Math.PI, d: (tt, lambda = 1.5418) => lambda / (2 * Math.sin(rad(tt / 2))) };
  const scherrerWidth = (sizeNm, tt, lambda = 1.5418, Kf = 0.9) => ((Kf * lambda) / (sizeNm * 10 * Math.cos(rad(tt / 2)))) * (180 / Math.PI);
  // 常见结构：晶胞参数（Å，室温）和晶胞里的全部原子
  const fcc = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]];
  const at = (el, sites) => sites.map(([x, y, z]) => ({ el, x, y, z }));
  const shift = (sites, d) => sites.map(([x, y, z]) => [x + d[0], y + d[1], z + d[2]]);
  const CRYSTALS = {
    NaCl: { name: 'NaCl', type: 'rock salt', cell: { a: 5.6402 }, atoms: [...at('Na', fcc), ...at('Cl', shift(fcc, [0.5, 0.5, 0.5]))] },
    KCl: { name: 'KCl', type: 'rock salt', cell: { a: 6.2931 }, atoms: [...at('K', fcc), ...at('Cl', shift(fcc, [0.5, 0.5, 0.5]))] },
    MgO: { name: 'MgO', type: 'rock salt', cell: { a: 4.2117 }, atoms: [...at('Mg', fcc), ...at('O', shift(fcc, [0.5, 0.5, 0.5]))] },
    Si: { name: 'Si', type: 'diamond', cell: { a: 5.43102 }, atoms: [...at('Si', fcc), ...at('Si', shift(fcc, [0.25, 0.25, 0.25]))] },
    C: { name: 'C (diamond)', type: 'diamond', cell: { a: 3.56683 }, atoms: [...at('C', fcc), ...at('C', shift(fcc, [0.25, 0.25, 0.25]))] },
    ZnS: { name: 'ZnS', type: 'zinc blende', cell: { a: 5.4093 }, atoms: [...at('Zn', fcc), ...at('S', shift(fcc, [0.25, 0.25, 0.25]))] },
    CaF2: { name: 'CaF₂', type: 'fluorite', cell: { a: 5.4631 }, atoms: [...at('Ca', fcc), ...at('F', shift(fcc, [0.25, 0.25, 0.25])), ...at('F', shift(fcc, [0.75, 0.75, 0.75]))] },
    Cu: { name: 'Cu', type: 'fcc', cell: { a: 3.6149 }, atoms: at('Cu', fcc) },
    Al: { name: 'Al', type: 'fcc', cell: { a: 4.0495 }, atoms: at('Al', fcc) },
    Au: { name: 'Au', type: 'fcc', cell: { a: 4.0782 }, atoms: at('Au', fcc) },
    Fe: { name: 'α-Fe', type: 'bcc', cell: { a: 2.8665 }, atoms: at('Fe', [[0, 0, 0], [0.5, 0.5, 0.5]]) },
    W: { name: 'W', type: 'bcc', cell: { a: 3.1652 }, atoms: at('W', [[0, 0, 0], [0.5, 0.5, 0.5]]) },
    CsCl: { name: 'CsCl', type: 'CsCl', cell: { a: 4.123 }, atoms: [{ el: 'Cs', x: 0, y: 0, z: 0 }, { el: 'Cl', x: 0.5, y: 0.5, z: 0.5 }] },
    TiO2: { name: 'TiO₂ (rutile)', type: 'rutile', cell: { a: 4.5937, c: 2.9587 }, atoms: [...at('Ti', [[0, 0, 0], [0.5, 0.5, 0.5]]), ...at('O', [[0.3049, 0.3049, 0], [0.6951, 0.6951, 0], [0.8049, 0.1951, 0.5], [0.1951, 0.8049, 0.5]])] },
  };

  // ── 电子顺磁共振 ──────────────────────────────────────────────────────
  /** 共振磁场（mT）：hν = g μ_B B。freq 单位 GHz。 */
  const eprField = (g, ghz) => (K.h * ghz * 1e9) / (g * K.muB) * 1e3;
  const eprG = (mT, ghz) => (K.h * ghz * 1e9) / (K.muB * mT * 1e-3);
  /** 一阶超精细结构。sets: [{ n（等价核个数）, I（核自旋）, a（超精细耦合，mT）}]。返回 [{ dB（相对中心的偏移，mT）, w（权重，总和为 1）}]。 */
  function hyperfine(sets) {
    let lines = new Map([[0, 1]]);
    for (const s of sets) for (let k = 0; k < s.n; k++) {
      const next = new Map(), mult = Math.round(2 * s.I + 1);
      for (const [pos, w] of lines) for (let j = 0; j < mult; j++) { const p = Math.round((pos + (j - s.I) * s.a) * 1e6) / 1e6; next.set(p, (next.get(p) || 0) + w / mult); }
      lines = next;
    }
    return [...lines].map(([dB, w]) => ({ dB, w })).sort((p, q) => p.dB - q.dB);
  }
  /** 把超精细线画成一阶导数谱。返回 { xs（mT）, ys }。 */
  function eprSpectrum(sets, opts = {}) {
    const { g = 2.0023, ghz = 9.5, pp = 0.05, shape = 'lorentz', n = 1600, span } = opts;
    const lines = hyperfine(sets), b0 = eprField(g, ghz);
    const half = span ? span / 2 : Math.max(1, Math.max(...lines.map((l) => Math.abs(l.dB))) * 1.25 + 8 * pp);
    const xs = new Array(n), ys = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { xs[i] = b0 - half + (2 * half * i) / (n - 1); for (const l of lines) ys[i] += l.w * derivLine(xs[i] - b0 - l.dB, pp, shape); }
    return { xs, ys, b0, lines };
  }
  /** DEER / PELDOR：两个电子自旋相距 r（nm）时的偶极耦合频率（MHz），g = 2.0023 时是 52.04 / r³。 */
  const dipolarMHz = (rNm, g1 = 2.0023, g2 = 2.0023) => (1e-7 * g1 * g2 * K.muB * K.muB) / (K.h * (rNm * 1e-9) ** 3) / 1e6;

  // ── 穆斯堡尔谱（⁵⁷Fe）────────────────────────────────────────────────
  const FE57 = { E: 14412.95, muG: 0.09044, muE: -0.1549, width: 0.097 }; // 能量 eV；核磁矩（μ_N）：基态 I = 1/2，激发态 I = 3/2；自然线宽 mm/s（源和吸收体合起来约 0.194）
  /** 磁超精细六线谱的位置（mm/s）和相对强度（粉末 3:2:1:1:2:3）。B：超精细场（T）；is：同质异能位移；qs：四极位移 ε（一阶）。 */
  function mossbauerSextet(B, is = 0, qs = 0) {
    const toV = (K.muN * B) / K.e / FE57.E * K.c * 1e3; // 1 μ_N·B 对应的速度（mm/s）
    const gg = FE57.muG / 0.5, ge = FE57.muE / 1.5, lines = [];
    for (const [mg, me, w] of [[-0.5, -1.5, 3], [-0.5, -0.5, 2], [-0.5, 0.5, 1], [0.5, -0.5, 1], [0.5, 0.5, 2], [0.5, 1.5, 3]]) {
      const q = Math.abs(me) === 1.5 ? qs : -qs;
      lines.push({ v: is + (-ge * me + gg * mg) * toV + q, w, mg, me });
    }
    return lines.sort((a, b) => a.v - b.v);
  }
  /** 四极双线：位置 is ± Δ/2。 */
  const mossbauerDoublet = (is, delta) => [{ v: is - delta / 2, w: 1 }, { v: is + delta / 2, w: 1 }];

  // ── 色谱 ──────────────────────────────────────────────────────────────
  /** 高斯峰。area：面积；tr：保留时间；N：理论塔板数（σ = tr/√N）。 */
  const gaussPeak = (t, tr, N, area = 1) => { const s = tr / Math.sqrt(N); return (area / (s * Math.sqrt(2 * Math.PI))) * Math.exp(-((t - tr) ** 2) / (2 * s * s)); };
  /** 指数修饰高斯（拖尾峰）。tau：拖尾的时间常数。 */
  function emgPeak(t, tr, sigma, tau, area = 1) {
    if (tau <= 0) return (area / (sigma * Math.sqrt(2 * Math.PI))) * Math.exp(-((t - tr) ** 2) / (2 * sigma * sigma));
    const z = (sigma / tau - (t - tr) / sigma) / Math.SQRT2;
    return (area / (2 * tau)) * Math.exp((sigma * sigma) / (2 * tau * tau) - (t - tr) / tau) * erfc(z);
  }
  /** 一张色谱图：peaks [{ tr, area, N?, tau? }]。返回 { ts, ys }。 */
  function chromatogram(peaks, opts = {}) {
    const { t0 = 0, t1 = Math.max(...peaks.map((p) => p.tr)) * 1.15, n = 1500, N = 10000 } = opts;
    const ts = new Array(n), ys = new Array(n).fill(0);
    for (let i = 0; i < n; i++) { ts[i] = t0 + ((t1 - t0) * i) / (n - 1); for (const p of peaks) { const s = p.tr / Math.sqrt(p.N || N); ys[i] += p.tau ? emgPeak(ts[i], p.tr, s, p.tau, p.area ?? 1) : gaussPeak(ts[i], p.tr, p.N || N, p.area ?? 1); } }
    return { ts, ys };
  }
  /** 分离度 Rs = 2 (t2 − t1) / (w1 + w2)，w = 4σ（基线宽）。 */
  const resolution = (t1, t2, N1, N2 = N1) => (2 * (t2 - t1)) / (4 * t1 / Math.sqrt(N1) + 4 * t2 / Math.sqrt(N2));
  /** Purnell 方程：Rs = (√N / 4) · ((α − 1)/α) · (k2 / (1 + k2))。 */
  const purnell = (N, alpha, k2) => (Math.sqrt(N) / 4) * ((alpha - 1) / alpha) * (k2 / (1 + k2));
  /** van Deemter：H = A + B/u + C·u。返回 H 和最佳流速 u_opt = √(B/C)、最小板高 A + 2√(BC)。 */
  const vanDeemter = (u, A, B, C) => A + B / u + C * u;
  const vanDeemterOpt = (A, B, C) => ({ u: Math.sqrt(B / C), H: A + 2 * Math.sqrt(B * C) });
  /** Kovats 保留指数。等温：对调整保留时间取对数内插；程序升温（linear = true）：对保留时间线性内插。alkanes: [{ n（碳数）, t }]。 */
  function kovats(t, alkanes, linear = false) {
    const a = alkanes.slice().sort((p, q) => p.t - q.t);
    for (let i = 0; i < a.length - 1; i++) if (t >= a[i].t && t <= a[i + 1].t) {
      const f = linear ? (t - a[i].t) / (a[i + 1].t - a[i].t) : (Math.log(t) - Math.log(a[i].t)) / (Math.log(a[i + 1].t) - Math.log(a[i].t));
      return 100 * (a[i].n + (a[i + 1].n - a[i].n) * f);
    }
    return NaN;
  }
  /** 对映体过量 ee（%）。 */
  const ee = (major, minor) => (100 * (major - minor)) / (major + minor);
  /** 高分子的摩尔质量分布（Schulz–Zimm，重量分布）：给 Mn 和分散度 Đ，返回 w(M) 的函数以及 Mn、Mw。 */
  function schulzZimm(Mn, D) {
    const k = 1 / (D - 1), lgk = lgamma(k + 1);
    const w = (M) => Math.exp((k + 1) * Math.log(k / Mn) + k * Math.log(M) - (k * M) / Mn - lgk); // 重量分数密度 w(M)
    return { w, Mn, Mw: Mn * D, k };
  }
  function lgamma(x) { // Lanczos
    const g = [76.18009172947146, -86.50532032941677, 24.01409824083091, -1.231739572450155, 0.1208650973866179e-2, -0.5395239384953e-5];
    let y = x, tmp = x + 5.5, ser = 1.000000000190015;
    tmp -= (x + 0.5) * Math.log(tmp);
    for (const c of g) ser += c / ++y;
    return -tmp + Math.log((2.5066282746310005 * ser) / x);
  }

  // ── 热分析 ────────────────────────────────────────────────────────────
  /** 分步失重：formulas 是依次留下的固体的化学式。返回每一步后剩余质量的百分数（第一项是 100）。 */
  function tgaSteps(formulas) { const m0 = avgMass(formulas[0]); return formulas.map((f) => (100 * avgMass(f)) / m0); }
  /** 画 TGA 曲线：steps [{ T（台阶中点，°C）, to（这一步之后的剩余质量 %）, w（台阶宽度，°C）}]。 */
  function tgaCurve(steps, opts = {}) {
    const { from = 25, to = 1000, n = 600 } = opts, xs = [], ys = [];
    for (let i = 0; i < n; i++) {
      const T = from + ((to - from) * i) / (n - 1);
      let m = 100, prev = 100;
      for (const s of steps) { m -= (prev - s.to) / (1 + Math.exp(-(T - s.T) / (s.w / 4))); prev = s.to; }
      xs.push(T); ys.push(m);
    }
    return { xs, ys };
  }

  // ── 电化学 ────────────────────────────────────────────────────────────
  /**
   * 可逆单电子对 O + n e⁻ ⇌ R 的循环伏安：显式有限差分解一维扩散（无量纲），电极表面满足 Nernst 方程。
   * opts: { n = 1, T = 298.15, E0 = 0, Ei = 0.3, Es = −0.3（V，相对 E0 写）, pts = 400（单程点数）}
   * 返回 { E: [...], psi: [...] }，psi 是无量纲电流 i / (n F A C √(nFvD/RT))；可逆波的峰值是 0.4463。
   */
  function cyclicVoltammogram(opts = {}) {
    const { n = 1, T = 298.15, E0 = 0, Ei = 0.3, Es = -0.3, pts = 400 } = opts;
    const f = (n * K.F) / (K.R * T), dE = (Ei - Es) / pts, dtau = f * dE; // 无量纲时间步 τ = f·v·t
    const lam = 0.45, dx = Math.sqrt(dtau / lam), nx = Math.ceil((6 * Math.sqrt(2 * f * (Ei - Es))) / dx) + 5;
    let O = new Float64Array(nx).fill(1), R = new Float64Array(nx).fill(0);
    const E = [], psi = [];
    for (let step = 0; step <= 2 * pts; step++) {
      const e = step <= pts ? Ei - step * dE : Es + (step - pts) * dE, theta = Math.exp(f * (e - E0));
      // 表面：C_O/C_R = θ，且流量守恒（D_O = D_R）⇒ 表面处 O + R 的梯度为零（三点差分）
      const tot = (4 * (O[1] + R[1]) - (O[2] + R[2])) / 3;
      O[0] = (tot * theta) / (1 + theta); R[0] = tot / (1 + theta);
      E.push(e); psi.push((-3 * O[0] + 4 * O[1] - O[2]) / (2 * dx));
      const O2 = O.slice(), R2 = R.slice();
      for (let i = 1; i < nx - 1; i++) { O2[i] = O[i] + lam * (O[i + 1] - 2 * O[i] + O[i - 1]); R2[i] = R[i] + lam * (R[i + 1] - 2 * R[i] + R[i - 1]); }
      O = O2; R = R2;
    }
    return { E, psi };
  }
  /** Randles–Ševčík：峰电流（A）。A：面积 cm²，D：cm²/s，C：mol/cm³，v：V/s。 */
  const randlesSevcik = (n, A, D, C, v, T = 298.15) => 0.4463 * n * K.F * A * C * Math.sqrt((n * K.F * v * D) / (K.R * T));
  /** Randles 等效电路的阻抗：Rs + [Cdl ∥ (Rct + Zw)]，Zw = σ ω^(−1/2) (1 − j)。返回 { re, im }（im 为负表示容性）。 */
  function randlesImpedance(freq, { Rs = 10, Rct = 100, Cdl = 2e-5, sigma = 0 } = {}) {
    const w = 2 * Math.PI * freq, zw = sigma / Math.sqrt(w), ar = Rct + zw, ai = -zw; // 法拉第支路 a = ar + j·ai
    // 并联：1/Z = 1/a + jωC  ⇒  Z = a / (1 + jωC·a)
    const dr = 1 - w * Cdl * ai, di = w * Cdl * ar, den = dr * dr + di * di;
    return { re: Rs + (ar * dr + ai * di) / den, im: (ai * dr - ar * di) / den };
  }
  /** 强碱滴定一元弱酸：加入体积 Vb 后的 pH（解电荷平衡，二分法）。ca、cb：浓度 mol/L；Va：酸的体积；pKa。 */
  function titrationPH(Vb, { ca = 0.1, Va = 25, cb = 0.1, pKa = 4.756, pKw = 14 } = {}) {
    const Ka = 10 ** -pKa, Kw = 10 ** -pKw, A = (ca * Va) / (Va + Vb), Na = (cb * Vb) / (Va + Vb);
    const g = (h) => h + Na - Kw / h - (A * Ka) / (Ka + h);
    let lo = 1e-15, hi = 1;
    for (let i = 0; i < 200; i++) { const mid = Math.sqrt(lo * hi); if (g(mid) > 0) hi = mid; else lo = mid; }
    return -Math.log10(Math.sqrt(lo * hi));
  }

  // ── 散射 ──────────────────────────────────────────────────────────────
  /** 均匀球的小角散射形状因子 P(q)，R 和 q 用互为倒数的单位。P(0) = 1。 */
  function sphereForm(q, R) { const x = q * R; if (x < 1e-4) return 1 - (x * x) / 5; const a = (3 * (Math.sin(x) - x * Math.cos(x))) / x ** 3; return a * a; }
  /** Guinier 近似：P ≈ exp(−q²Rg²/3)，球的 Rg = √(3/5)·R。 */
  const guinier = (q, Rg) => Math.exp(-(q * q * Rg * Rg) / 3);
  /** 动态光散射：Stokes–Einstein 扩散系数（m²/s）、散射矢量 q（m⁻¹）和衰减率 Γ = D q²（s⁻¹）。radius nm，eta Pa·s，lambda nm，angle 度。 */
  function dls(radiusNm, { T = 298.15, eta = 0.89e-3, lambdaNm = 633, nRef = 1.33, angle = 173 } = {}) {
    const D = (K.kB * T) / (6 * Math.PI * eta * radiusNm * 1e-9), q = ((4 * Math.PI * nRef) / (lambdaNm * 1e-9)) * Math.sin(rad(angle / 2));
    return { D, q, gamma: D * q * q };
  }

  // ── γ 能谱与 X 射线 ───────────────────────────────────────────────────
  /** Compton 散射：能量 E（keV）的光子散射到角度 θ 后的能量；康普顿边（θ = 180° 时电子得到的最大能量）和反散射峰。 */
  function compton(E) { const eps = E / 510.99895; return { edge: (E * 2 * eps) / (1 + 2 * eps), backscatter: E / (1 + 2 * eps) }; }
  /** Moseley 定律估算 Kα 能量（keV）：E ≈ 10.2 eV · (Z − 1)²。 */
  const moseleyKa = (Z) => (10.204 * (Z - 1) ** 2) / 1000;
  /** XPS：动能 = hν − 结合能 − 功函数。Al Kα 1486.6 eV，Mg Kα 1253.6 eV。 */
  const xpsKinetic = (be, hv = 1486.6, phi = 4.5) => hv - be - phi;
  /** 放射性碳年龄（常规年龄，Libby 平均寿命 8033 年）。F：样品的现代碳比例。 */
  const radiocarbonAge = (F) => -8033 * Math.log(F);
  /** δ 值（‰）：(R_sample / R_standard − 1) × 1000。 */
  const delta = (Rs, Rstd) => (Rs / Rstd - 1) * 1000;

  // ── 一阶核磁多重峰（给“联合解谱”的示意用）────────────────────────────
  /** n 个等价的 I = 1/2 邻核把一条线分成 n+1 条，强度是二项式系数。返回 [{ dHz, w }]，Σw = 1。可以连续嵌套（groups: [{ n, J }]）。 */
  function multiplet(groups) { return hyperfine(groups.map((g) => ({ n: g.n, I: 0.5, a: g.J }))).map((l) => ({ dHz: l.dB, w: l.w })); }

  const api = {
    K, conv, line, broaden, derivLine, erfc,
    parseFormula, ion, monoMass, avgMass, composition, dbe, isotopePattern, ADDUCTS, ppm, chargeState, deconvolute, peptide, RESIDUE,
    tofTime, cyclotron, resolvingPower,
    DIATOMICS, isotopologue, rovibLevel, rovibBand, bandOrigin, rotationalLines, bondLength, hydrogenLine,
    ramanIntensity, antiStokesRatio, beer, vibronic, decayIrf,
    WAVELENGTHS, scatteringFactor, dSpacing, powderPattern, bragg, scherrerWidth, CRYSTALS,
    eprField, eprG, hyperfine, eprSpectrum, dipolarMHz, FE57, mossbauerSextet, mossbauerDoublet,
    gaussPeak, emgPeak, chromatogram, resolution, purnell, vanDeemter, vanDeemterOpt, kovats, ee, schulzZimm,
    tgaSteps, tgaCurve, cyclicVoltammogram, randlesSevcik, randlesImpedance, titrationPH,
    sphereForm, guinier, dls, compton, moseleyKa, xpsKinetic, radiocarbonAge, delta, multiplet,
  };
  if (typeof module === 'object' && module.exports) module.exports = api; else root.MOLASTRIA_SPECTRA_MODELS = api;
})(typeof self !== 'undefined' ? self : globalThis);
