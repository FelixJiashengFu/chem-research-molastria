'use strict';
// 光学（/optics/）演示背后的数学：纯函数，没有 DOM。tools/optics-test.mjs 对照解析解和已知值测这里的每一个函数。
// 页面里 optics-demos.js 经 window.MOLASTRIA_OPTICS_MODELS 拿到它们。长度单位写在每个函数的注释里（波场水槽用 μm，X 射线用 Å，薄膜用 nm）。
(() => {
  const TAU = 2 * Math.PI;
  const sinc = (x) => (Math.abs(x) < 1e-9 ? 1 - (x * x) / 6 : Math.sin(x) / x);

  // ── 夫琅禾费（远场）强度 ───────────────────────────────────────
  // 单缝：缝宽 a，波长 lam（同一单位），s = sinθ；中央归一为 1
  const slitI = (a, lam, s) => sinc((Math.PI * a * s) / lam) ** 2;
  // N 条缝宽 a、间距 d 的缝：单缝因子 × 多缝因子（sin Nβ / N sin β）²，中央归一为 1
  const multiI = (N, a, d, lam, s) => {
    const b = (Math.PI * d * s) / lam, sb = Math.sin(b);
    const arr = N === 1 ? 1 : Math.abs(sb) < 1e-12 ? 1 : (Math.sin(N * b) / (N * sb)) ** 2;
    return slitI(a, lam, s) * arr;
  };

  // ── Bessel 函数：积分表示 Jn(x) = (1/π)∫₀^π cos(nτ − x sin τ) dτ，Simpson 积分（|x| ≤ 60 时误差 < 1e-12）──
  const besselJ = (n, x) => { const m = 2 * Math.max(200, Math.ceil(Math.abs(x) * 8)), h = Math.PI / m; let s = 0; for (let i = 0; i <= m; i++) { const t = i * h, f = Math.cos(n * t - x * Math.sin(t)); s += (i === 0 || i === m ? 1 : i % 2 ? 4 : 2) * f; } return (s * h) / 3 / Math.PI; };
  // 圆孔（直径 D）的夫琅禾费图样：v = π D sinθ / λ，I = [2 J₁(v)/v]²；第一个暗环在 v = 3.8317…，即 sinθ = 1.22 λ/D
  const airyI = (v) => (Math.abs(v) < 1e-6 ? 1 : ((2 * besselJ(1, v)) / v) ** 2);
  const AIRY_ZERO = 3.831705970207512;
  // 两个等亮的非相干点光源（间距 sep，以 v 为单位）沿连线的像强度
  const twoPoint = (v, sep) => airyI(v - sep / 2) + airyI(v + sep / 2);

  // ── 菲涅耳积分 C(u) = ∫₀ᵘ cos(πt²/2) dt，S(u) = ∫₀ᵘ sin(πt²/2) dt（Simpson 积分）──
  const fresnelCS = (u) => { const sg = u < 0 ? -1 : 1, U = Math.abs(u); if (U === 0) return [0, 0]; if (U > 40) { const p = (Math.PI * U * U) / 2; return [sg * (0.5 + Math.sin(p) / (Math.PI * U)), sg * (0.5 - Math.cos(p) / (Math.PI * U))]; } const m = 2 * Math.max(100, Math.ceil(U * U * 40)), h = U / m; let c = 0, s = 0; for (let i = 0; i <= m; i++) { const t = i * h, p = (Math.PI * t * t) / 2, w = i === 0 || i === m ? 1 : i % 2 ? 4 : 2; c += w * Math.cos(p); s += w * Math.sin(p); } return [(sg * c * h) / 3, (sg * s * h) / 3]; };
  // 缝 [−a/2, a/2] 在距离 z 处、横向位置 x 的菲涅耳（傍轴）衍射强度，以没有遮挡时为 1。edge = true 时是半无限的直边（x < 0 一侧被挡）
  const fresnelSlit = (x, a, lam, z, edge) => {
    const k = Math.sqrt(2 / (lam * z));
    const [c1, s1] = edge ? [-0.5, -0.5] : fresnelCS(k * (-a / 2 - x)), [c2, s2] = fresnelCS(k * ((edge ? 0 : a / 2) - x));
    return 0.5 * ((c2 - c1) ** 2 + (s2 - s1) ** 2);
  };
  // 菲涅耳数 N_F = w² / (λ z)，w 是半宽：远大于 1 是几何阴影（近场），远小于 1 是夫琅禾费（远场）
  const fresnelNumber = (a, lam, z) => (a / 2) ** 2 / (lam * z);

  // ── 波场水槽：x = 0 处一道屏，屏上开口由点源（惠更斯子波）代替，二维标量波，长度单位 μm ──
  // 开口：single 单缝（宽 a）、double 双缝（宽 a、间距 d）、grating N 缝、obstacle 宽 a 的挡板（其余都开着，算到 ±extent）
  const apertures = (o) => {
    const { mode, a, d = 0, N = 1, extent = 20 } = o;
    if (mode === 'obstacle') return [[-extent, -a / 2], [a / 2, extent]];
    const n = mode === 'single' ? 1 : mode === 'double' ? 2 : N;
    return Array.from({ length: n }, (_, i) => { const c = (i - (n - 1) / 2) * d; return [c - a / 2, c + a / 2]; });
  };
  // 每个开口按间距约 lam/step 撒点源；返回 { y, w }（w 是每个点源代表的宽度）
  const tankSources = (o, lam, step = 6) => {
    const ys = [], ws = [];
    for (const [y0, y1] of apertures(o)) { const n = Math.max(2, Math.ceil(((y1 - y0) * step) / lam)), h = (y1 - y0) / n; for (let i = 0; i < n; i++) { ys.push(y0 + (i + 0.5) * h); ws.push(h); } }
    return { y: Float64Array.from(ys), w: Float64Array.from(ws) };
  };
  // 二维的惠更斯–菲涅耳（Kirchhoff）求和：U(x, y) = Σ w e^{i(kr − π/4)} / √(λr) · (1 + cos θ)/2。开口无限宽时 |U| → 1（入射波的振幅）
  const tankAt = (src, lam, x, y) => {
    const k = TAU / lam; let re = 0, im = 0;
    for (let j = 0; j < src.y.length; j++) { const dy = y - src.y[j], r = Math.hypot(x, dy); if (r < 1e-9) continue; const amp = (src.w[j] * (1 + x / r)) / (2 * Math.sqrt(lam * r)), ph = k * r - Math.PI / 4; re += amp * Math.cos(ph); im += amp * Math.sin(ph); }
    return [re, im];
  };
  // 在 x ∈ [0, x1]、y ∈ [−y1, y1] 的 nx × ny 格点上算一遍（开口上下对称，只算一半再镜像）
  const tankGrid = (src, lam, x1, y1, nx, ny) => {
    const re = new Float32Array(nx * ny), im = new Float32Array(nx * ny), half = Math.ceil(ny / 2);
    for (let j = 0; j < half; j++) { const y = -y1 + (2 * y1 * j) / (ny - 1); for (let i = 0; i < nx; i++) { const x = Math.max(1e-3, (x1 * i) / (nx - 1)), [a, b] = tankAt(src, lam, x, y), p = j * nx + i, q = (ny - 1 - j) * nx + i; re[p] = re[q] = a; im[p] = im[q] = b; } }
    return { re, im, nx, ny };
  };
  // 接收屏上一点的“矢量图”：每个开口按 bins 段合成的小箭头（复振幅），首尾相接就是总振幅
  const phasors = (src, lam, x, y, bins = 36) => {
    const out = [], n = src.y.length, per = Math.max(1, Math.ceil(n / bins)), k = TAU / lam;
    for (let j0 = 0; j0 < n; j0 += per) { let re = 0, im = 0; for (let j = j0; j < Math.min(n, j0 + per); j++) { const r = Math.hypot(x, y - src.y[j]), amp = (src.w[j] * (1 + x / r)) / (2 * Math.sqrt(lam * r)), ph = k * r - Math.PI / 4; re += amp * Math.cos(ph); im += amp * Math.sin(ph); } out.push([re, im]); }
    return out;
  };
  // 远场（透镜焦面）方向 s = sinθ 上的矢量图：每个点源的相位是 −k y sinθ（相对于中心）
  const phasorsFar = (src, lam, s, bins = 36) => {
    const out = [], n = src.y.length, per = Math.max(1, Math.ceil(n / bins)), k = TAU / lam; let W = 0; for (let j = 0; j < n; j++) W += src.w[j];
    for (let j0 = 0; j0 < n; j0 += per) { let re = 0, im = 0; for (let j = j0; j < Math.min(n, j0 + per); j++) { const ph = -k * src.y[j] * s; re += (src.w[j] / W) * Math.cos(ph); im += (src.w[j] / W) * Math.sin(ph); } out.push([re, im]); }
    return out;
  };
  // 水槽右边的远场（夫琅禾费，透镜焦面）强度：挡板用 Babinet 原理时远场除了中心一点和单缝一样，这里只给缝和光栅
  const farI = (o, lam, s) => (o.mode === 'single' ? slitI(o.a, lam, s) : multiI(o.mode === 'double' ? 2 : o.N, o.a, o.d, lam, s));

  // ── 颜色：CIE 1931 2° 配色函数的解析拟合（Wyman, Sloan & Shirley 2013），XYZ → sRGB ─────
  const g = (x, mu, s1, s2) => { const t = (x - mu) / (x < mu ? s1 : s2); return Math.exp(-0.5 * t * t); };
  const cie = (nm) => [1.056 * g(nm, 599.8, 37.9, 31.0) + 0.362 * g(nm, 442.0, 16.0, 26.7) - 0.065 * g(nm, 501.1, 20.4, 26.2), 0.821 * g(nm, 568.8, 46.9, 40.5) + 0.286 * g(nm, 530.9, 16.3, 31.1), 1.217 * g(nm, 437.0, 11.8, 36.0) + 0.681 * g(nm, 459.0, 26.0, 13.8)];
  // 照明近似为 6504 K 的黑体（和 D65 的白点很接近）；相对谱功率
  const illum = (nm) => { const l = nm * 1e-9, c2 = 1.4387769e-2; return 1 / (l ** 5 * Math.expm1(c2 / (l * 6504))); };
  const gam = (v) => (v <= 0.0031308 ? 12.92 * v : 1.055 * v ** (1 / 2.4) - 0.055);
  const xyzToRGB = (X, Y, Z) => [3.2406 * X - 1.5372 * Y - 0.4986 * Z, -0.9689 * X + 1.8758 * Y + 0.0415 * Z, 0.0557 * X - 0.204 * Y + 1.057 * Z];
  // 反射谱 R(λ) 在白光照明下的颜色；返回 0–255 的 sRGB（超出色域的分量截断）和亮度 Y（完美白 = 1）
  const spectrumColor = (R, step = 5) => {
    let X = 0, Y = 0, Z = 0, N = 0;
    for (let nm = 380; nm <= 780; nm += step) { const [x, y, z] = cie(nm), e = illum(nm), r = R(nm); X += x * e * r; Y += y * e * r; Z += z * e * r; N += y * e; }
    X /= N; Y /= N; Z /= N;
    const rgb = xyzToRGB(X, Y, Z).map((v) => Math.round(255 * gam(Math.min(1, Math.max(0, v)))));
    return { rgb, Y };
  };
  // 单色光的显示颜色（亮度归一，只用来给波长上色）
  const monoRGB = (nm) => { const [x, y, z] = cie(nm), v = xyzToRGB(x, y, z).map((q) => Math.max(0, q)), m = Math.max(...v, 1e-9); return v.map((q) => Math.round(255 * gam(q / m))); };

  // ── 菲涅耳公式：从折射率 n1 射向 n2，入射角 th（弧度）。返回振幅反射系数 rs、rp（全反射时是复数的模 1）、反射率 Rs、Rp ──
  const fresnel = (n1, n2, th) => {
    const ci = Math.cos(th), st = (n1 / n2) * Math.sin(th);
    if (st >= 1) return { rs: 1, rp: 1, Rs: 1, Rp: 1, tir: true, tt: NaN };
    const ct = Math.sqrt(1 - st * st), rs = (n1 * ci - n2 * ct) / (n1 * ci + n2 * ct), rp = (n2 * ci - n1 * ct) / (n2 * ci + n1 * ct);
    return { rs, rp, Rs: rs * rs, Rp: rp * rp, tir: false, tt: Math.asin(st) };
  };
  const brewster = (n1, n2) => Math.atan(n2 / n1);
  const critical = (n1, n2) => (n1 > n2 ? Math.asin(n2 / n1) : NaN);

  // ── 单层薄膜：n0 | 膜 n1，厚 d（nm）| 基底 n2，波长 lam（nm），入射角 th0（弧度，在 n0 里）。多次反射全部相干叠加（Airy 公式）──
  const filmR = (n0, n1, n2, d, lam, th0 = 0, pol = 'avg') => {
    if (pol === 'avg') return (filmR(n0, n1, n2, d, lam, th0, 's') + filmR(n0, n1, n2, d, lam, th0, 'p')) / 2;
    const s0 = Math.sin(th0), c0 = Math.cos(th0), s1 = (n0 * s0) / n1, c1 = Math.sqrt(1 - s1 * s1), s2 = (n0 * s0) / n2, c2 = Math.sqrt(Math.max(0, 1 - s2 * s2));
    const r = (na, ca, nb, cb) => (pol === 's' ? (na * ca - nb * cb) / (na * ca + nb * cb) : (nb * ca - na * cb) / (nb * ca + na * cb));
    const r01 = r(n0, c0, n1, c1), r12 = r(n1, c1, n2, c2), b = (2 * TAU * n1 * d * c1) / lam;
    const cr = Math.cos(b), sr = Math.sin(b);
    // r = (r01 + r12 e^{iβ}) / (1 + r01 r12 e^{iβ})，β = 2 · 2π n1 d cosθ1 / λ
    const nr = r01 + r12 * cr, ni = r12 * sr, dr = 1 + r01 * r12 * cr, di = r01 * r12 * sr;
    return (nr * nr + ni * ni) / (dr * dr + di * di);
  };

  // ── 迈克耳孙干涉仪：光源是几条高斯谱线 [中心波长 nm, 半高宽 nm, 相对强度]，光程差 delta（μm）处的强度（0–2，平均为 1）──
  const interferogram = (lines, delta) => {
    let s = 0, w = 0;
    for (const [l0, fw, a] of lines) { const sig = 1e3 / l0, sd = ((1e3 * fw) / (l0 * l0)) / 2.3548200450309493; s += a * (1 + Math.exp(-2 * Math.PI * Math.PI * sd * sd * delta * delta) * Math.cos(TAU * sig * delta)); w += a; }
    return s / w;
  };
  // 相干长度（μm）的常用估计 λ²/Δλ
  const coherenceLength = (l0, fw) => (l0 * l0) / fw / 1e3;

  // ── 光栅：N 条缝、周期 d，第 m 级 R = mN；分开两条谱线需要 N ≥ λ/(m Δλ) ─────
  const gratingAngle = (d, lam, m) => { const s = (m * lam) / d; return Math.abs(s) <= 1 ? Math.asin(s) : NaN; };
  const resolvingPower = (m, N) => Math.abs(m) * N;

  // ── 布拉格：N 层间距 d 的原子面，掠射角 th，波长 lam；各层反射波的相位差 2kd sinθ。返回 |Σ|²/N²，以及每层的小箭头 ──
  const braggLayers = (N, d, lam, th) => { const p = (2 * TAU * d * Math.sin(th)) / lam; let re = 0, im = 0; for (let n = 0; n < N; n++) { re += Math.cos(n * p); im += Math.sin(n * p); } return (re * re + im * im) / (N * N); };
  const braggPhasors = (N, d, lam, th) => { const p = (2 * TAU * d * Math.sin(th)) / lam; return Array.from({ length: N }, (_, n) => [Math.cos(n * p) / N, Math.sin(n * p) / N]); };

  // ── 粉末 X 射线衍射（立方晶系）──────────────────────────────────
  // 原子散射因子 f(s) = Z − 41.78214 s² Σ aᵢ exp(−bᵢ s²)，s = sinθ/λ（Å⁻¹）；系数和谱图馆 spectra/sp-tables.js 是同一张表（来自 pymatgen，MIT）
  const XSF = { Cu: [29, 1.579, 62.94, 1.82, 12.453, 1.658, 2.504, 0.532, 0.333], Al: [13, 2.276, 72.322, 2.428, 19.773, 0.858, 3.08, 0.317, 0.408], Fe: [26, 2.544, 64.424, 2.343, 14.88, 1.759, 2.854, 0.506, 0.35], W: [74, 5.709, 28.782, 4.677, 5.084, 2.019, 0.572, 0, 0], Si: [14, 2.129, 57.775, 2.533, 16.476, 0.835, 2.88, 0.322, 0.386], C: [6, 0.731, 36.995, 1.195, 11.297, 0.456, 2.814, 0.125, 0.346], Na: [11, 2.241, 108.004, 1.333, 24.505, 0.907, 3.391, 0.286, 0.435], Cl: [17, 1.452, 30.935, 2.292, 9.98, 0.787, 2.234, 0.322, 0.323], K: [19, 3.951, 137.075, 2.545, 22.402, 1.98, 4.532, 0.482, 0.434], Cs: [55, 6.062, 155.837, 5.986, 19.695, 3.303, 3.335, 1.096, 0.379] };
  const formFactor = (el, s) => { const c = XSF[el]; let t = 0; for (let i = 1; i < 9; i += 2) t += c[i] * Math.exp(-c[i + 1] * s * s); return c[0] - 41.78214 * s * s * t; };
  // 晶胞里的原子（分数坐标）；B 是各向同性的 Debye–Waller 因子（Å²，室温附近的典型值），强度乘 exp(−2B s²)。没有计入反常散射、吸收和择优取向
  const FCC = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
  const shift = (list, v) => list.map((p) => p.map((x, i) => x + v[i]));
  const CRYSTALS = {
    Cu: { type: 'fcc', a: 3.615, B: 0.55, basis: FCC.map((p) => ['Cu', p]) },
    Al: { type: 'fcc', a: 4.0495, B: 0.82, basis: FCC.map((p) => ['Al', p]) },
    Fe: { type: 'bcc', a: 2.8665, B: 0.35, basis: [['Fe', [0, 0, 0]], ['Fe', [0.5, 0.5, 0.5]]] },
    W: { type: 'bcc', a: 3.1652, B: 0.17, basis: [['W', [0, 0, 0]], ['W', [0.5, 0.5, 0.5]]] },
    Si: { type: 'diamond', a: 5.431, B: 0.46, basis: [...FCC, ...shift(FCC, [0.25, 0.25, 0.25])].map((p) => ['Si', p]) },
    C: { type: 'diamond', a: 3.5668, B: 0.16, basis: [...FCC, ...shift(FCC, [0.25, 0.25, 0.25])].map((p) => ['C', p]) },
    NaCl: { type: 'rocksalt', a: 5.6402, B: 1.6, basis: [...FCC.map((p) => ['Na', p]), ...shift(FCC, [0.5, 0, 0]).map((p) => ['Cl', p])] },
    KCl: { type: 'rocksalt', a: 6.2917, B: 1.9, basis: [...FCC.map((p) => ['K', p]), ...shift(FCC, [0.5, 0, 0]).map((p) => ['Cl', p])] },
    CsCl: { type: 'cscl', a: 4.123, B: 1.8, basis: [['Cs', [0, 0, 0]], ['Cl', [0.5, 0.5, 0.5]]] },
  };
  // 结构因子 F(hkl) = Σ f_j e^{2πi(hx + ky + lz)}；返回 |F|²
  const structureF2 = (cr, h, k, l, s) => { let re = 0, im = 0; const dw = Math.exp(-(cr.B || 0) * s * s); for (const [el, [x, y, z]] of cr.basis) { const f = formFactor(el, s) * dw, p = TAU * (h * x + k * y + l * z); re += f * Math.cos(p); im += f * Math.sin(p); } return re * re + im * im; };
  // 粉末图上的峰：每个 h² + k² + l² 一组（立方晶系里同一组面间距相同），强度 ∝ 多重度 × |F|² × 洛伦兹–偏振因子，最强峰记 100
  const powderPeaks = (cr, lam, ttMax = 120) => {
    const groups = new Map(), lim = Math.ceil((2 * cr.a) / lam) + 1;
    for (let h = -lim; h <= lim; h++) for (let k = -lim; k <= lim; k++) for (let l = -lim; l <= lim; l++) {
      const q = h * h + k * k + l * l; if (!q) continue;
      const d = cr.a / Math.sqrt(q), st = lam / (2 * d); if (st > Math.sin((ttMax * Math.PI) / 360)) continue;
      const s = 1 / (2 * d), F2 = structureF2(cr, h, k, l, s);
      const key = q, gp = groups.get(key) || { q, d, mult: 0, F2: 0, hkl: null };
      gp.mult++;
      if (F2 > 1e-6) { gp.F2 = F2; const t = [h, k, l].map(Math.abs).sort((x, y) => y - x); if (!gp.hkl || t.join('') > gp.hkl.join('')) gp.hkl = t; }
      groups.set(key, gp);
    }
    const out = [];
    for (const gp of groups.values()) {
      if (!gp.hkl) continue; // 系统消光：这一组面全部 F = 0
      let mult = 0; for (let h = -lim; h <= lim; h++) for (let k = -lim; k <= lim; k++) for (let l = -lim; l <= lim; l++) if (h * h + k * k + l * l === gp.q && structureF2(cr, h, k, l, 1 / (2 * gp.d)) > 1e-6) mult++;
      const th = Math.asin(lam / (2 * gp.d)), lp = (1 + Math.cos(2 * th) ** 2) / (Math.sin(th) ** 2 * Math.cos(th));
      out.push({ hkl: gp.hkl, q: gp.q, d: gp.d, tt: (720 * th) / TAU, mult, F2: gp.F2, I: mult * gp.F2 * lp });
    }
    out.sort((a, b) => a.tt - b.tt);
    const mx = Math.max(...out.map((p) => p.I)); for (const p of out) p.I = (100 * p.I) / mx;
    return out;
  };
  // Scherrer：晶粒大小 L（nm）给出的峰半高宽（2θ，度），K = 0.9
  const scherrer = (L, lam, tt) => (((0.9 * lam) / (L * 10 * Math.cos((tt * Math.PI) / 360))) * 360) / TAU;

  // ── Jones 矢量和矩阵：复数写成 [re, im] ─────────────────────────────
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const apply = (M, v) => [cadd(cmul(M[0][0], v[0]), cmul(M[0][1], v[1])), cadd(cmul(M[1][0], v[0]), cmul(M[1][1], v[1]))];
  const rot = (t) => { const c = Math.cos(t), s = Math.sin(t); return [[[c, 0], [-s, 0]], [[s, 0], [c, 0]]]; };
  const mm = (A, B) => [0, 1].map((i) => [0, 1].map((j) => cadd(cmul(A[i][0], B[0][j]), cmul(A[i][1], B[1][j]))));
  // 透光轴与 x 轴成 t 的偏振片；快轴与 x 轴成 t、相位延迟 g 的波片（g = π/2 是四分之一波片，π 是半波片）
  const polarizer = (t) => mm(mm(rot(t), [[[1, 0], [0, 0]], [[0, 0], [0, 0]]]), rot(-t));
  const waveplate = (t, gd) => mm(mm(rot(t), [[[1, 0], [0, 0]], [[0, 0], [Math.cos(gd), Math.sin(gd)]]]), rot(-t));
  const intensity = (v) => v[0][0] ** 2 + v[0][1] ** 2 + v[1][0] ** 2 + v[1][1] ** 2;
  // 偏振椭圆：方位角 psi（长轴与 x 轴的夹角）、椭率角 chi（tan χ = 短轴/长轴，正为左旋，按迎着光看的约定）、Stokes 参数
  const ellipse = (v) => {
    const [ex, ey] = v, S0 = intensity(v), S1 = ex[0] ** 2 + ex[1] ** 2 - ey[0] ** 2 - ey[1] ** 2, c = cmul(ex, [ey[0], -ey[1]]), S2 = 2 * c[0], S3 = -2 * c[1];
    return { S0, S1, S2, S3, psi: 0.5 * Math.atan2(S2, S1), chi: S0 > 0 ? 0.5 * Math.asin(Math.max(-1, Math.min(1, S3 / S0))) : 0 };
  };

  // ── 光线追迹：沿 z 轴排列的球面（顶点 z，曲率半径 R，Infinity 是平面，后面的折射率 n）。光线 [z, y, 方向角] ──
  // 返回折射点的折线和最后与光轴的交点 zf（没有就 NaN）；用精确的斯涅尔定律，不做傍轴近似
  const trace = (surfaces, y0, n0 = 1, zStart = -10) => {
    let z = zStart, y = y0, dz = 1, dy = 0, n = n0; const pts = [[z, y]];
    for (const S of surfaces) {
      let t;
      if (!Number.isFinite(S.R)) t = (S.z - z) / dz;
      else { const cz = S.z + S.R, oz = z - cz, b = oz * dz + y * dy, c = oz * oz + y * y - S.R * S.R, disc = b * b - c; if (disc < 0) return { pts, zf: NaN, lost: true }; const sq = Math.sqrt(disc); t = S.R > 0 ? -b - sq : -b + sq; }
      if (!(t > 0)) return { pts, zf: NaN, lost: true };
      z += t * dz; y += t * dy; pts.push([z, y]);
      if (S.ap && Math.abs(y) > S.ap) return { pts, zf: NaN, lost: true };
      let nz = -1, ny = 0;
      if (Number.isFinite(S.R)) { const cz = S.z + S.R; nz = (z - cz) / Math.abs(S.R); ny = y / Math.abs(S.R); if (nz * dz + ny * dy > 0) { nz = -nz; ny = -ny; } } // 法线朝着来光的一边
      const mu = n / S.n, ci = -(nz * dz + ny * dy), k = 1 - mu * mu * (1 - ci * ci);
      if (k < 0) return { pts, zf: NaN, lost: true, tir: true };
      const f = mu * ci - Math.sqrt(k); dz = mu * dz + f * nz; dy = mu * dy + f * ny; n = S.n;
    }
    const zf = Math.abs(dy) > 1e-12 ? z - (y * dz) / dy : NaN;
    return { pts, zf, dir: [dz, dy] };
  };
  // 傍轴（近轴）近似：薄透镜的磨镜者公式 1/f = (n − 1)(1/R1 − 1/R2)，单个折射面的焦距 f' = n2 R / (n2 − n1)
  const lensmaker = (n, R1, R2) => 1 / ((n - 1) * (1 / R1 - 1 / R2));
  const thinImage = (f, s) => { const si = 1 / (1 / f - 1 / s); return { si, m: -si / s }; };

  // ── FFT（基 2，原地，复数分开存）──────────────────────────────────
  const fft = (re, im, inv = false) => {
    const n = re.length;
    for (let i = 1, j = 0; i < n; i++) { let bit = n >> 1; for (; j & bit; bit >>= 1) j ^= bit; j ^= bit; if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; } }
    for (let len = 2; len <= n; len <<= 1) { const ang = ((inv ? 1 : -1) * TAU) / len, wr = Math.cos(ang), wi = Math.sin(ang); for (let i = 0; i < n; i += len) { let cr = 1, ci = 0; for (let j = 0; j < len / 2; j++) { const a = i + j, b = a + len / 2, tr = re[b] * cr - im[b] * ci, ti = re[b] * ci + im[b] * cr; re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti; const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t; } } }
    if (inv) for (let i = 0; i < n; i++) { re[i] /= n; im[i] /= n; }
    return [re, im];
  };
  // 4f 成像：物（一维，n 个采样点，视场宽 L μm，光栅时 L = 16p）→ 傅里叶面（空间频率 fx，单位 1/μm）→ 光阑 → 像。
  // obj: 'amp' 振幅光栅（透光 / 不透光）、'phase' 相位光栅（处处透光，凸起处多走 phi 的相位）、'cell' 一个透明的“细胞”（相位物）
  // na 是物镜的数值孔径：只有 |fx| ≤ NA/λ 的频率通过；zernike 时把零频（直流）乘上 e^{iπ/2}（相衬）
  const fourier4f = (o) => {
    const { n = 512, kind = 'amp', p = 4, duty = 0.5, phi = 0.6, lam = 0.55, na = 0.3, zernike = false, dark = false } = o;
    // 光栅取整 16 个周期、每周期 32 个采样点，这样采样后的物仍然严格周期，频谱里没有泄漏；细胞用固定的 80 μm 视场
    const L = kind === 'cell' ? o.L || 80 : 16 * p;
    const re = new Float64Array(n), im = new Float64Array(n), dx = L / n;
    for (let i = 0; i < n; i++) {
      const x = (i - n / 2) * dx;
      // 光栅按整数下标取相位（每周期 n/16 个点），免得 x/p 的舍入让个别采样点落错边、在频谱里漏出不该有的成分
      const per = n / 16, inGrating = (((i - n / 2) % per) + per) % per < duty * per;
      if (kind === 'amp') { re[i] = inGrating ? 1 : 0; }
      else { const on = kind === 'phase' ? inGrating : Math.abs(x) < 3 * p * duty; const ph = on ? phi : 0; re[i] = Math.cos(ph); im[i] = Math.sin(ph); }
    }
    const obj = { re: Float64Array.from(re), im: Float64Array.from(im) };
    fft(re, im);
    const spec = new Float64Array(n), cut = na / lam, fx = (k) => (k <= n / 2 ? k : k - n) / L;
    let kept = 0;
    for (let k = 0; k < n; k++) {
      spec[k] = Math.hypot(re[k], im[k]) / n;
      const pass = Math.abs(fx(k)) <= cut + 1e-12;
      if (!pass) { re[k] = 0; im[k] = 0; } else if (k === 0 && dark) { re[0] = 0; im[0] = 0; } else if (k === 0 && zernike) { const r = re[0]; re[0] = -im[0]; im[0] = r; }
      if (pass) kept++;
    }
    fft(re, im, true);
    const img = Float64Array.from({ length: n }, (_, i) => re[i] * re[i] + im[i] * im[i]);
    return { obj, spec, img, fx: Float64Array.from({ length: n }, (_, k) => fx(k)), cut, kept, dx };
  };
  // 阿贝的分辨极限：相干照明、正入射时，周期 p 的光栅要成像，至少要让 ±1 级进入物镜：p ≥ λ / NA
  const abbeLimit = (lam, na) => lam / na;

  window.MOLASTRIA_OPTICS_MODELS = { TAU, sinc, slitI, multiI, besselJ, airyI, AIRY_ZERO, twoPoint, fresnelCS, fresnelSlit, fresnelNumber, apertures, tankSources, tankAt, tankGrid, phasors, phasorsFar, farI, cie, spectrumColor, monoRGB, fresnel, brewster, critical, filmR, interferogram, coherenceLength, gratingAngle, resolvingPower, braggLayers, braggPhasors, XSF, formFactor, CRYSTALS, structureF2, powderPeaks, scherrer, polarizer, waveplate, apply, intensity, ellipse, trace, lensmaker, thinImage, fft, fourier4f, abbeLimit };
})();
