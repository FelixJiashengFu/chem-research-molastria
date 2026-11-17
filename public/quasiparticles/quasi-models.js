'use strict';
// 准粒子（/quasiparticles/）演示背后的数学：纯函数，没有 DOM。tools/quasi-test.mjs 对照解析解和文献里的数值测这里的每一个函数。
// 页面里 quasi-demos.js 经 window.MOLASTRIA_QUASI_MODELS 拿到它们。声子馆自己的数学在 phonons/phonon-models.js。
// 模型都是教科书里的小模型（洛伦兹谱函数、Debye 声子数、紧束缚能带、自旋波、氢原子式激子和 Elliott 公式、Fröhlich 极化子的
// Feynman 变分、Drude 金属、耦合振子和黄昆方程、BCS 能隙方程、Kitaev 链、带 Einstein 声子自能的 ARPES 谱），每个演示的说明写清楚它和真实材料的距离。
(() => {
  const TAU = 2 * Math.PI, SQPI = Math.sqrt(Math.PI);

  // ── 数值工具 ──────────────────────────────────────────────────────
  // 对称矩阵的本征值（Jacobi 旋转，小矩阵用）：{ values（从小到大）, vectors（vectors[k] 是第 k 个本征向量）}
  function symEig(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 80; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-28) break;
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
  // Gauss–Legendre 求积（n 点），在 [a, b] 上积分
  function gaussLegendre(n) {
    const x = new Float64Array(n), w = new Float64Array(n);
    for (let i = 0; i < Math.ceil(n / 2); i++) {
      let z = Math.cos((Math.PI * (i + 0.75)) / (n + 0.5)), pp = 0;
      for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 0; j < n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j + 1) * z * p2 - j * p3) / (j + 1); } pp = (n * (z * p1 - p2)) / (z * z - 1); const dz = p1 / pp; z -= dz; if (Math.abs(dz) < 1e-15) break; }
      x[i] = -z; x[n - 1 - i] = z; w[i] = w[n - 1 - i] = 2 / ((1 - z * z) * pp * pp);
    }
    return { x, w };
  }
  const GL = gaussLegendre(96);
  const integrate = (f, a, b) => { let s = 0; for (let i = 0; i < GL.x.length; i++) s += GL.w[i] * f(a + ((GL.x[i] + 1) * (b - a)) / 2); return (s * (b - a)) / 2; };
  // 分段积分（把 [a, b] 切成 m 段，每段 96 点）
  const integrateN = (f, a, b, m = 8) => { let s = 0; for (let k = 0; k < m; k++) s += integrate(f, a + ((b - a) * k) / m, a + ((b - a) * (k + 1)) / m); return s; };
  // ∫₀^∞ f(τ) e^{−τ} dτ，f 在 0 处可以像 τ^{−1/2} 那样发散：代换 τ = s²，∫₀^∞ 2s e^{−s²} f(s²) ds，s 截到 8（e^{−64} 可以忽略）
  const laplace0 = (f) => integrateN((s) => (s < 1e-300 ? 0 : 2 * s * Math.exp(-s * s) * f(s * s)), 0, 8, 24);
  const golden = (f, a, b, n = 100) => { const g = (Math.sqrt(5) - 1) / 2; let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d); for (let i = 0; i < n; i++) { if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); } } return (a + b) / 2; };
  const bose = (x) => 1 / Math.expm1(x);
  const fermi = (x) => (x > 40 ? Math.exp(-x) : 1 / (Math.exp(x) + 1));
  const lorentz = (x, x0, g) => g / Math.PI / ((x - x0) ** 2 + g * g);

  // 常数（CODATA 2018）
  const C = { hbar: 1.054571817e-34, e: 1.602176634e-19, me: 9.1093837015e-31, eps0: 8.8541878128e-12, kB: 1.380649e-23, c: 299792458, Ry: 13.605693, aB: 0.0529177, meV_K: 11.60452, cm_meV: 8.065544, mec2: 510998.95 };

  // ── 第一章：谱函数和准粒子 ───────────────────────────────────────
  // A(ω) = Z·洛伦兹(E, Γ) + (1 − Z)·宽的“非相干”部分（高斯，中心 Ei、宽 W）。∫A dω = 1（求和规则）。
  const spectral = (w, { E = 1, G = 0.05, Z = 0.7, Ei = 3, W = 1.5 } = {}) => Z * lorentz(w, E, G) + ((1 - Z) * Math.exp(-(((w - Ei) / W) ** 2) / 2)) / (W * Math.sqrt(TAU));
  // 加进去一个粒子以后，“还留在原来那个态里”的振幅 |G(t)|：准粒子部分 Z e^{−Γt}，非相干部分 (1−Z) e^{−W²t²/2} 很快退相干
  const survival = (t, { G = 0.05, Z = 0.7, W = 1.5, E = 1, Ei = 3 } = {}) => { const re = Z * Math.exp(-G * t) * Math.cos(E * t) + (1 - Z) * Math.exp(-(W * W * t * t) / 2) * Math.cos(Ei * t), im = -Z * Math.exp(-G * t) * Math.sin(E * t) - (1 - Z) * Math.exp(-(W * W * t * t) / 2) * Math.sin(Ei * t); return Math.hypot(re, im); };

  // ── 第二章：声子数不守恒 ─────────────────────────────────────────
  // Debye 模型里每个原子平均有多少个声子：n/N = 9 (T/Θ)³ ∫₀^{Θ/T} x²/(eˣ−1) dx；能量 U/(N k_B Θ) 同理
  const phononNumber = (T, th) => { if (T <= 0) return 0; const xD = th / T; return 9 * (T / th) ** 3 * integrateN((x) => (x < 1e-8 ? x : (x * x) / Math.expm1(x)), 0, Math.min(xD, 80), 6); };
  const phononNumberLow = (T, th) => 9 * 2 * 1.2020569031595942 * (T / th) ** 3; // ∫₀^∞ x²/(eˣ−1) = 2ζ(3)
  const phononNumberHigh = (T, th) => 4.5 * (T / th) - 1.5 + 0.1875 * (th / T); // 高温：x²/(eˣ−1) ≈ x − x²/2 + x³/12，积分后乘 9(T/Θ)³

  // ── 第三章：紧束缚能带、有效质量和空穴 ──────────────────────────
  // E(k) = −2t cos(ka)，a = 1，ħ = 1。N 个 k 点，电场让每个电子的 k 平移 dk（全部一起，Bloch 振荡的一瞬）。
  const tbE = (k, t = 1) => -2 * t * Math.cos(k);
  const tbV = (k, t = 1) => 2 * t * Math.sin(k);
  const tbMass = (k, t = 1) => 1 / (2 * t * Math.cos(k)); // m* = ħ²/(d²E/dk²)
  // 填充 nu（0..1）：最低能量的 round(nu·N) 个态有电子，然后 k 整体平移 dk。返回电子的总速度和“空穴”的总速度。
  function tbCurrent(N, nu, dk, t = 1) {
    const ks = Array.from({ length: N }, (_, i) => (TAU * (i - Math.floor(N / 2))) / N), occ = Math.round(nu * N);
    const order = ks.map((k, i) => [tbE(k, t), i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).map((x) => x[1]);
    const full = new Set(order.slice(0, occ));
    let je = 0, jh = 0;
    ks.forEach((k, i) => { const v = tbV(k + dk, t); if (full.has(i)) je += v; else jh += v; });
    return { ks, full, electrons: -je, holes: jh, occ }; // 电荷 −e 的电子：J = −e Σ_occ v；空穴：J = +e Σ_empty v（单位 e = 1）
  }

  // ── 第四章：费米液体 ─────────────────────────────────────────────
  // 准粒子的衰减率：Γ(ε, T) = a[ε² + (πk_BT)²]（费米液体）或 Γ = a′·max(|ε|, πk_BT)（“边缘费米液体”，作对照）
  const flGamma = (eps, T, a = 1) => a * (eps * eps + (Math.PI * T) ** 2);
  const mflGamma = (eps, T, a = 1) => a * Math.max(Math.abs(eps), Math.PI * T);
  // 动量分布：n(k) 在 k_F 处跳 Z，两边是光滑的（这里用 Z·θ + (1−Z)·费米函数式的平滑台阶做示意）
  const nk = (k, Z = 0.7, w = 0.6) => Z * (k < 0 ? 1 : 0) + (1 - Z) * fermi(k / w);
  // Kadowaki–Woods：A/γ² ≈ 1.0 × 10⁻⁵ μΩ·cm·(mol·K/mJ)²（重费米子）
  const KW = 1.0e-5;

  // ── 第五章：磁振子 ───────────────────────────────────────────────
  // 一维海森堡链 H = −J Σ S_i·S_{i+1}（铁磁 J > 0）：ħω = 2JS(1 − cos ka)；反铁磁（线性自旋波）：ħω = 2JS|sin ka|
  const magnonFM = (k, J = 1, S = 0.5) => 2 * J * S * (1 - Math.cos(k));
  const magnonAFM = (k, J = 1, S = 0.5) => 2 * J * S * Math.abs(Math.sin(k));
  // 自旋 1/2 链的一个磁振子扇区（N 个格点，一个翻转的自旋）：精确对角化，本征值应等于 J(1 − cos k)
  function oneMagnonExact(N, J = 1) {
    const H = Array.from({ length: N }, () => new Array(N).fill(0));
    for (let i = 0; i < N; i++) { H[i][i] = J; H[i][(i + 1) % N] -= J / 2; H[(i + 1) % N][i] -= J / 2; }
    return symEig(H).values;
  }
  // 三维简单立方铁磁体的 Bloch T^{3/2} 定律：每个格点的磁振子数 n = ζ(3/2)/(4π)^{3/2} · (k_BT/2JS)^{3/2}（E = 2JS k²a²）
  const blochDeficit = (T, J = 1, S = 0.5) => (2.6123753486854883 / (4 * Math.PI) ** 1.5) * (T / (2 * J * S)) ** 1.5 / S;

  // ── 第六章：激子 ─────────────────────────────────────────────────
  // 氢原子模型：Ry* = 13.606 eV · μ/ε²，a* = 0.0529 nm · ε/μ（μ 以 m_e 为单位）
  const excitonRy = (mu, eps) => (C.Ry * 1000 * mu) / (eps * eps); // meV
  const excitonA = (mu, eps) => (C.aB * eps) / mu; // nm
  const levels3D = (Eg, Ry, n) => Eg - Ry / (n * n);
  const levels2D = (Eg, Ry, n) => Eg - Ry / ((n - 0.5) ** 2);
  // Elliott 公式（三维，只有 s 态可见）：吸收 ∝ Σ_n (4π/n³) Ry^{3/2} δ(E − E_n) + θ(E − Eg) · π e^{πx}/sinh(πx) · Ry^{1/2}，x = √(Ry/(E − Eg))
  const sommerfeld = (E, Eg, Ry) => { if (E <= Eg) return 0; const x = Math.sqrt(Ry / (E - Eg)); return x > 30 ? 2 * Math.PI : (Math.PI * x * Math.exp(Math.PI * x)) / Math.sinh(Math.PI * x) / x; };
  function elliott(E, Eg, Ry, G, nmax = 60) {
    let s = 0; for (let n = 1; n <= nmax; n++) s += ((4 * Math.PI) / n ** 3) * Ry ** 1.5 * lorentz(E, levels3D(Eg, Ry, n), G);
    // 连续部分也展宽（对台阶做一个简单的洛伦兹卷积：数值积分）
    const cont = integrateN((e) => sommerfeld(e, Eg, Ry) * Math.sqrt(Ry) * lorentz(E, e, G), Eg, Eg + 40 * Ry + 40 * G, 24);
    // 没有画进去的 n > nmax 的线，按线密度 = 2π √Ry 补成从 E_nmax 到 Eg 的平台
    const tail = Math.sqrt(Ry) * 2 * Math.PI * (Math.atan((Eg - E) / G) - Math.atan((levels3D(Eg, Ry, nmax + 0.5) - E) / G)) / Math.PI;
    return s + cont + tail;
  }

  // ── 第七章：极化子（Fröhlich 模型，ħω_LO = 1）─────────────────────
  // Feynman 变分：E(v, w) = 3(v − w)²/(4v) − (αv/√π) ∫₀^∞ e^{−τ} [w²τ + (v² − w²)(1 − e^{−vτ})/v]^{−1/2} dτ，对 v > w > 0 取最小
  const D = (t, v, w) => w * w * t + ((v * v - w * w) * -Math.expm1(-v * t)) / v;
  const feynmanE = (alpha, v, w) => (3 * (v - w) ** 2) / (4 * v) - ((alpha * v) / SQPI) * laplace0((t) => 1 / Math.sqrt(D(t, v, w)));
  // 在 (ln w, ln(v − w)) 上用 Nelder–Mead 找最小值
  function nelder(f, x0, step = 0.4, iters = 400) {
    let P = [x0, [x0[0] + step, x0[1]], [x0[0], x0[1] + step]].map((x) => [x, f(x)]);
    for (let it = 0; it < iters; it++) {
      P.sort((a, b) => a[1] - b[1]);
      const [b, g, w] = P, c = [(b[0][0] + g[0][0]) / 2, (b[0][1] + g[0][1]) / 2], at = (t) => [c[0] + t * (w[0][0] - c[0]), c[1] + t * (w[0][1] - c[1])];
      const r = at(-1), fr = f(r);
      if (fr < b[1]) { const e = at(-2), fe = f(e); P[2] = fe < fr ? [e, fe] : [r, fr]; }
      else if (fr < g[1]) P[2] = [r, fr];
      else { const k = at(0.5), fk = f(k); if (fk < w[1]) P[2] = [k, fk]; else P = [b, ...[g, w].map(([x]) => { const y = [(x[0] + b[0][0]) / 2, (x[1] + b[0][1]) / 2]; return [y, f(y)]; })]; }
      if (Math.abs(P[0][1] - P[2][1]) < 1e-13 && it > 40) break;
    }
    P.sort((a, b) => a[1] - b[1]); return P[0][0];
  }
  function feynman(alpha) {
    const f = ([lw, ld]) => { const w = Math.exp(lw), v = w + Math.exp(ld); return feynmanE(alpha, v, w); };
    // 起点：弱耦合 v ≈ w ≈ 3，强耦合 v ≈ 4α²/9π（Feynman 1955），w 约 1
    let x = [Math.log(3), Math.log(alpha < 3 ? 0.1 + alpha / 10 : Math.max(0.5, (4 * alpha * alpha) / (9 * Math.PI) - 1))];
    x = nelder(f, x); x = nelder(f, x, 0.1);
    const w = Math.exp(x[0]), v = w + Math.exp(x[1]), E = feynmanE(alpha, v, w);
    // Feynman 的有效质量：m*/m = 1 + (αv³/(3√π)) ∫₀^∞ e^{−τ} τ² D(τ)^{−3/2} dτ
    const mass = 1 + ((alpha * v ** 3) / (3 * SQPI)) * laplace0((t) => (t * t) / D(t, v, w) ** 1.5);
    return { E, v, w, mass };
  }
  const polaronWeak = (alpha) => -alpha - 0.0159196 * alpha * alpha; // 微扰论（二阶系数 −0.0159）
  const polaronStrong = (alpha) => -0.108513 * alpha * alpha; // Pekar
  const polaronStrongFeynman = (alpha) => -(alpha * alpha) / (3 * Math.PI) - 3 * Math.log(2) - 0.75;

  // ── 第八章：等离激元（Drude）─────────────────────────────────────
  // ħω_p（eV）由电子密度 n（cm⁻³）、有效质量 m*（m_e）算出
  const plasmaEV = (n, m = 1) => (C.hbar * Math.sqrt((n * 1e6 * C.e * C.e) / (C.eps0 * C.me * m))) / C.e;
  // ε(ω) = ε∞ − ω_p²/(ω² + iγω)，返回 [Re, Im]
  const drude = (w, wp, g, einf = 1) => { const d = w * w * w * w + g * g * w * w; return [einf - (wp * wp * w * w) / d, (wp * wp * g * w) / d]; };
  const csqrt = ([a, b]) => { const r = Math.hypot(a, b), x = Math.sqrt((r + a) / 2), y = Math.sign(b || 1) * Math.sqrt(Math.max(0, (r - a) / 2)); return [x, y]; };
  const reflect = (eps) => { const [n, k] = csqrt(eps); return ((n - 1) ** 2 + k * k) / ((n + 1) ** 2 + k * k); };
  const lossFn = ([a, b]) => b / (a * a + b * b); // −Im(1/ε)

  // ── 第九章：极化激元 ─────────────────────────────────────────────
  // 微腔：光子 E_c(k) = √(E₀² + (ħck/n)²)（k 以 μm⁻¹ 为单位，ħc = 197.327 eV·nm），激子 E_x 不随 k 变，耦合 ħΩ（Rabi 劈裂）
  const HBARC = 197.3269804; // eV·nm
  const cavityE = (k, E0, n = 3.5) => Math.sqrt(E0 * E0 + ((HBARC * k * 1e-3) / n) ** 2);
  const polariton = (Ec, Ex, Om) => { const m = (Ec + Ex) / 2, r = Math.sqrt(((Ec - Ex) / 2) ** 2 + (Om / 2) ** 2); const X = 0.5 * (1 + (Ec - Ex) / (2 * r)); return { lo: m - r, up: m + r, Xlo: X }; }; // Xlo：下支里激子的比例（Hopfield 系数 |X|²）
  // 光子在腔里的“质量”：m_c = E₀ n²/c²，以 m_e 为单位
  const cavityMass = (E0, n = 3.5) => (E0 * n * n) / C.mec2;
  // 黄昆方程：c²k² = ω² ε(ω)，ε(ω) = ε∞(ω_L² − ω²)/(ω_T² − ω²)。频率用 cm⁻¹，k 用 cm⁻¹（k/2π 的单位就是波数）
  function phononPolariton(k, wT, wL, einf) {
    const ck2 = k * k, A = einf, B = -(einf * wL * wL + ck2), Cc = ck2 * wT * wT, disc = Math.sqrt(B * B - 4 * A * Cc);
    return [Math.sqrt((-B - disc) / (2 * A)), Math.sqrt((-B + disc) / (2 * A))];
  }
  const lst = (wT, wL, einf) => einf * (wL / wT) ** 2; // ε(0)

  // ── 第十章：BCS ──────────────────────────────────────────────────
  // 能隙方程（弱耦合，截断 ω_D）：1/λ = ∫₀^{ω_D} tanh(√(ξ²+Δ²)/2T)/√(ξ²+Δ²) dξ。能量单位任意（同 ω_D），k_B = 1。
  const gapLHS = (D2, T, wD) => integrateN((x) => { const E = Math.sqrt(x * x + D2); return (T > 0 ? Math.tanh(E / (2 * T)) : 1) / E; }, 0, wD, 24);
  const gap0 = (lam, wD) => wD / Math.sinh(1 / lam); // T = 0 的精确解
  const tcBCS = (lam, wD) => { // 解 ∫₀^{ω_D} tanh(ξ/2T)/ξ dξ = 1/λ
    const f = (T) => integrateN((x) => (x < 1e-12 ? 1 / (2 * T) : Math.tanh(x / (2 * T)) / x), 0, wD, 32) - 1 / lam;
    let lo = 1e-6 * wD, hi = wD; for (let i = 0; i < 100; i++) { const m = Math.sqrt(lo * hi); if (f(m) > 0) lo = m; else hi = m; } return Math.sqrt(lo * hi);
  };
  function gapT(T, lam, wD) {
    const tc = tcBCS(lam, wD); if (T >= tc) return 0;
    let lo = 0, hi = gap0(lam, wD) * 1.0001;
    for (let i = 0; i < 80; i++) { const m = (lo + hi) / 2; if (gapLHS(m * m, T, wD) > 1 / lam) lo = m; else hi = m; } return (lo + hi) / 2;
  }
  const bogoliubov = (xi, Delta) => { const E = Math.sqrt(xi * xi + Delta * Delta); return { E, u2: 0.5 * (1 + xi / E), v2: 0.5 * (1 - xi / E) }; };
  const bcsDOS = (E, Delta, G = 0) => { if (!G) return Math.abs(E) > Delta ? Math.abs(E) / Math.sqrt(E * E - Delta * Delta) : 0; const z = [Math.abs(E), G], z2 = [z[0] * z[0] - z[1] * z[1] - Delta * Delta, 2 * z[0] * z[1]], s = csqrt(z2), d = s[0] * s[0] + s[1] * s[1]; return (z[0] * s[0] + z[1] * s[1]) / d; }; // Dynes 展宽：Re[(E + iΓ)/√((E + iΓ)² − Δ²)]

  // ── 第十一章：Kitaev 链 ──────────────────────────────────────────
  // H = −μ Σ (c†c − ½) − t Σ (c†_j c_{j+1} + h.c.) + Δ Σ (c_j c_{j+1} + h.c.)，开边界，N 个格点。BdG 矩阵 2N × 2N（Δ 取实数）。
  function kitaevBdG(N, mu, t, Dl) {
    const n = 2 * N, H = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < N; i++) { H[i][i] = -mu; H[N + i][N + i] = mu; }
    for (let i = 0; i < N - 1; i++) {
      H[i][i + 1] = H[i + 1][i] = -t; H[N + i][N + i + 1] = H[N + i + 1][N + i] = t;
      // 配对：Δ c_i c_{i+1} + h.c. → 块 [[h, Δ̂], [Δ̂ᵀ, −h]]，Δ̂ 反对称
      H[i][N + i + 1] = Dl; H[N + i + 1][i] = Dl; H[i + 1][N + i] = -Dl; H[N + i][i + 1] = -Dl;
    }
    return H;
  }
  const kitaevSpectrum = (N, mu, t, Dl) => symEig(kitaevBdG(N, mu, t, Dl));
  const kitaevBulk = (k, mu, t, Dl) => Math.sqrt((2 * t * Math.cos(k) + mu) ** 2 + (2 * Dl * Math.sin(k)) ** 2);
  // 一个零能模在每个格点上的权重（粒子和空穴分量的平方和）
  const modeWeight = (vec, N) => Array.from({ length: N }, (_, i) => vec[i] ** 2 + vec[N + i] ** 2);

  // ── 第十二章：ARPES ──────────────────────────────────────────────
  // 线性能带 ε_k = v k，和一个 Einstein 声子（ω_E，耦合 λ）耦合，T = 0：
  // Re Σ(ω) = −(λω_E/2) ln|(ω_E + ω)/(ω_E − ω)|，Im Σ(ω) = −(πλω_E/2) θ(|ω| − ω_E) − Γ₀
  const sigmaRe = (w, lam, wE) => (Math.abs(Math.abs(w) - wE) < 1e-9 ? 0 : -(lam * wE / 2) * Math.log(Math.abs((wE + w) / (wE - w))));
  const sigmaIm = (w, lam, wE, G0 = 0) => -(Math.PI * lam * wE / 2) * (Math.abs(w) > wE ? 1 : 0) - G0;
  const arpesA = (k, w, { v = 1, lam = 0.5, wE = 0.06, G0 = 0.01 } = {}) => { const re = w - v * k - sigmaRe(w, lam, wE), im = sigmaIm(w, lam, wE, G0); return -im / Math.PI / (re * re + im * im); };
  // 谱峰（MDC 的峰）：在给定 ω 上，k_peak = (ω − Re Σ)/v
  const arpesPeak = (w, { v = 1, lam = 0.5, wE = 0.06 } = {}) => (w - sigmaRe(w, lam, wE)) / v;

  window.MOLASTRIA_QUASI_MODELS = { TAU, C, symEig, gaussLegendre, integrate, integrateN, laplace0, golden, nelder, bose, fermi, lorentz, spectral, survival, phononNumber, phononNumberLow, phononNumberHigh, tbE, tbV, tbMass, tbCurrent, flGamma, mflGamma, nk, KW, magnonFM, magnonAFM, oneMagnonExact, blochDeficit, excitonRy, excitonA, levels3D, levels2D, sommerfeld, elliott, feynmanE, feynman, polaronWeak, polaronStrong, polaronStrongFeynman, plasmaEV, drude, csqrt, reflect, lossFn, HBARC, cavityE, polariton, cavityMass, phononPolariton, lst, gapLHS, gap0, tcBCS, gapT, bogoliubov, bcsDOS, kitaevBdG, kitaevSpectrum, kitaevBulk, modeWeight, sigmaRe, sigmaIm, arpesA, arpesPeak };
})();
