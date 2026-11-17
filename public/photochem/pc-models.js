'use strict';
// 光化学与激发态（/photochem/）演示背后的数学：纯函数，没有 DOM。tools/photochem-test.mjs 对照解析解、独立的数值积分和教科书数值测这里的每一个函数。
// 页面里 pc-demos.js 经 window.MOLASTRIA_PHOTOCHEM_MODELS 拿到它们。
// 模型都是教科书里的小模型：振子强度和 Strickler–Berg、Jablonski 动力学、位移谐振子的 Franck–Condon 因子、能隙律、Förster / Dexter、
// Kasha 激子链、Landau–Zener（和直接解含时薛定谔方程对照）、线性锥形交叉和几何相位、Marcus 和 Marcus–Levich–Jortner、
// TADF 的两态动力学、激发态氧化还原电位和 Rehm–Weller、Stern–Volmer、自由基对的单重态产率、瞬态吸收和仪器响应卷积。
(() => {
  const TAU = 2 * Math.PI;
  // 常数（CODATA 2018）
  const C = {
    kB: 8.617333262e-5, // eV/K
    hbar: 6.582119569e-16, // eV·s
    h: 4.135667696e-15, // eV·s
    NA: 6.02214076e23,
    cm1: 1.239841984e-4, // 1 cm⁻¹ 是多少 eV
    gammaE: 176.0859630, // 电子旋磁比 rad μs⁻¹ mT⁻¹
    D2nm3: 5.0341, // 1 D² /(4πε₀ · 1 nm³) 是多少 cm⁻¹（见 dipoleCm）
  };

  // ── 数值工具 ──────────────────────────────────────────────────────
  // 对称矩阵的本征值和本征向量（Jacobi 旋转）：values 从小到大，vectors[k] 是第 k 个本征向量
  function symEig(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-30) break;
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
  // ln Γ(x)（Lanczos，g = 7）
  const LZ = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
  function lnGamma(x) {
    if (x < 0.5) return Math.log(Math.PI / Math.abs(Math.sin(Math.PI * x))) - lnGamma(1 - x);
    x -= 1; let a = LZ[0]; const t = x + 7.5;
    for (let i = 1; i < 9; i++) a += LZ[i] / (x + i);
    return 0.5 * Math.log(TAU) + (x + 0.5) * Math.log(t) - t + Math.log(a);
  }
  // erfcx(x) = e^{x²} erfc(x)，x ≥ 0 用 Numerical Recipes 的 erfcc（相对误差 < 1.2 × 10⁻⁷）去掉 e^{−x²}；x < 0 用 2e^{x²} − erfcx(−x)
  function erfcx(x) {
    if (x < 0) return 2 * Math.exp(x * x) - erfcx(-x);
    const t = 1 / (1 + 0.5 * x);
    return t * Math.exp(-1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
  }
  const erfc = (x) => (x >= 0 ? Math.exp(-x * x) * erfcx(x) : 2 - Math.exp(-x * x) * erfcx(-x));
  const gauss = (x, x0, fwhm) => Math.exp((-4 * Math.LN2 * (x - x0) ** 2) / (fwhm * fwhm));
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  function trapz(xs, ys) { let s = 0; for (let i = 1; i < xs.length; i++) s += 0.5 * (xs[i] - xs[i - 1]) * (ys[i] + ys[i - 1]); return s; }

  // ── 第一章 光的吸收：Beer–Lambert、振子强度、跃迁偶极、Strickler–Berg ───────────
  // 高斯谱带 ε(ν̃) = ε_max exp(−4 ln2 (ν̃ − ν̃₀)²/Δ²) 的面积 ∫ε dν̃ = ε_max Δ √(π / (4 ln 2))
  const bandArea = (epsMax, fwhm) => epsMax * fwhm * Math.sqrt(Math.PI / (4 * Math.LN2));
  // f = 4.319 × 10⁻⁹ ∫ε dν̃（ε 的单位 M⁻¹ cm⁻¹，ν̃ 的单位 cm⁻¹）
  const oscStrength = (epsMax, fwhm) => 4.319e-9 * bandArea(epsMax, fwhm);
  // f = 4.702 × 10⁻⁷ ν̃ |μ|²（μ 以 debye 计）
  const dipoleD = (f, nu) => Math.sqrt(f / (4.702e-7 * nu));
  // Strickler–Berg 的简化式：k_r ≈ 2.880 × 10⁻⁹ n² ν̃_max² ∫ε dν̃（s⁻¹）
  const stricklerBerg = (epsMax, fwhm, nu, n = 1) => 2.88e-9 * n * n * nu * nu * bandArea(epsMax, fwhm);
  const absorbance = (eps, c, l = 1) => eps * c * l;
  const transmit = (A) => 10 ** -A;

  // ── 第二章 Jablonski 动力学 ──────────────────────────────────────
  // k：{ F（荧光）, IC, ISC, P（磷光）, TNR（T₁ 的无辐射）, q（猝灭速率常数 × 浓度，同时作用于 S₁ 和 T₁）}，单位 s⁻¹
  function jablonski(k) {
    const q = k.q || 0, kS = k.F + k.IC + k.ISC + q, kT = k.P + k.TNR + q;
    const phiF = k.F / kS, phiIC = k.IC / kS, phiISC = k.ISC / kS, phiQS = q / kS;
    const phiP = phiISC * (k.P / kT), phiTNR = phiISC * (k.TNR / kT), phiQT = phiISC * (q / kT);
    const S = (t) => Math.exp(-kS * t);
    const T = (t) => (Math.abs(kT - kS) < 1e-12 * kS ? k.ISC * t * Math.exp(-kS * t) : (k.ISC / (kT - kS)) * (Math.exp(-kS * t) - Math.exp(-kT * t)));
    return { kS, kT, tauS: 1 / kS, tauT: 1 / kT, phiF, phiIC, phiISC, phiQS, phiP, phiTNR, phiQT, S, T, tau0: 1 / k.F };
  }

  // ── 第三章 Franck–Condon ─────────────────────────────────────────
  // 位移相同频率的谐振子，T = 0：|⟨0|v′⟩|² = e^{−S} Sᵛ / v!（Poisson）
  const poisson = (S, v) => Math.exp(-S + v * Math.log(Math.max(S, 1e-300)) - lnGamma(v + 1));
  // 归一化的谐振子本征函数 ψ_v(x)，m = ħ = 1，频率 w；递推 ψ_{n+1} = √(2/(n+1)) √w x ψ_n − √(n/(n+1)) ψ_{n−1}
  function hoPsi(nmax, x, w) {
    const out = new Float64Array(nmax + 1), y = Math.sqrt(w) * x;
    out[0] = (w / Math.PI) ** 0.25 * Math.exp(-0.5 * y * y);
    if (nmax > 0) out[1] = Math.SQRT2 * y * out[0];
    for (let n = 1; n < nmax; n++) out[n + 1] = Math.sqrt(2 / (n + 1)) * y * out[n] - Math.sqrt(n / (n + 1)) * out[n - 1];
    return out;
  }
  // 一般的 Franck–Condon 因子：下面的势频率 w1、在 0；上面的势频率 w2、移到 d（坐标以下面的势的无量纲单位计，w1 = 1 时 S = w2 d² / 2）。
  // 返回 { from0（下面 v = 0 到上面 v′ 的 |⟨|⟩|²，吸收）, to0（上面 v′ = 0 到下面 v 的，发射）}，用细格子上的梯形求积
  function fcFactors(w1, w2, d, nmax = 20, N = 2400) {
    const L = 10 / Math.sqrt(Math.min(w1, w2)) + Math.abs(d), xs = lin(-L, L + Math.abs(d), N), dx = xs[1] - xs[0];
    const a = new Float64Array(nmax + 1), b = new Float64Array(nmax + 1);
    for (const x of xs) {
      const lo = hoPsi(nmax, x, w1), up = hoPsi(nmax, x - d, w2);
      for (let v = 0; v <= nmax; v++) { a[v] += lo[0] * up[v] * dx; b[v] += up[0] * lo[v] * dx; }
    }
    return { from0: Array.from(a, (x) => x * x), to0: Array.from(b, (x) => x * x) };
  }
  // 振动结构的谱：E00（eV），hw（eV），FC 因子数组，展宽 FWHM（eV），kind 'abs'（ν 加权）或 'em'（ν³ 加权）
  function vibronic(xs, E00, hw, fc, fwhm, kind = 'abs') {
    const sgn = kind === 'em' ? -1 : 1, pw = kind === 'em' ? 3 : 1;
    const ys = xs.map((E) => fc.reduce((s, p, v) => s + p * gauss(E, E00 + sgn * v * hw, fwhm), 0) * Math.max(E, 0) ** pw);
    const m = Math.max(...ys) || 1;
    return ys.map((y) => y / m);
  }

  // ── 第四章 能隙律和 Kasha 规则 ───────────────────────────────────
  // 单模、T = 0 的多声子速率：k = C e^{−S} S^p / Γ(p + 1)，p = ΔE / ħω（Γ 函数把 p 延拓到非整数）
  const gapRate = (dE, hw, S, Cpre = 1e13) => Cpre * Math.exp(-S + (dE / hw) * Math.log(S) - lnGamma(dE / hw + 1));
  // Englman–Jortner 的弱耦合渐近式：k ≈ C e^{−S} exp(−γ ΔE/ħω)，γ = ln(ΔE / (S ħω)) − 1（再乘 √(ħω/2πΔE) 才和上面的 Stirling 展开一致）
  const gapEJ = (dE, hw, S, Cpre = 1e13) => { const p = dE / hw, g = Math.log(p / S) - 1; return Cpre * Math.exp(-S - g * p) / Math.sqrt(TAU * p); };
  // 两个激发态的命运：kr1、kr2 是 S₁、S₂ 的辐射速率；能级 E1、E2（cm⁻¹）；内转换按上面的能隙律
  function kasha({ E1, E2, kr1, kr2, hw, S, Cpre = 1e13 }) {
    const k21 = gapRate(E2 - E1, hw, S, Cpre), k10 = gapRate(E1, hw, S, Cpre);
    return { k21, k10, phiS2: kr2 / (kr2 + k21), phiS1: (k21 / (kr2 + k21)) * (kr1 / (kr1 + k10)), tauS2: 1 / (kr2 + k21), tauS1: 1 / (kr1 + k10) };
  }

  // ── 第五章 能量转移 ──────────────────────────────────────────────
  // Förster 半径：R₀⁶ = 9 ln10 κ² Φ_D J / (128 π⁵ n⁴ N_A)，J 以 M⁻¹ cm⁻¹ nm⁴ 计时 R₀(nm) = 0.02108 (κ² Φ_D n⁻⁴ J)^{1/6}
  function forsterR0(kappa2, phiD, n, J) {
    // J：M⁻¹ cm⁻¹ nm⁴ → cm⁶ mol⁻¹（× 10³ cm³/L × 10⁻²⁸ cm⁴/nm⁴）
    const Jcgs = J * 1e3 * 1e-28, R6 = (9 * Math.LN10 * kappa2 * phiD * Jcgs) / (128 * Math.PI ** 5 * n ** 4 * C.NA);
    return R6 ** (1 / 6) * 1e7; // cm → nm
  }
  const fretE = (r, R0) => 1 / (1 + (r / R0) ** 6);
  const dexterE = (r, rc, L, kD0tau) => { const k = kD0tau * Math.exp((-2 * (r - rc)) / L); return k / (1 + k); }; // k_ET τ_D 归一到接触距离 r_c
  // 重叠积分 J = ∫ F_D(λ) ε_A(λ) λ⁴ dλ / ∫ F_D dλ：给体发射和受体吸收都是高斯（λ 以 nm 计）
  function overlapJ(lD, wD, lA, wA, epsA) {
    const xs = lin(Math.min(lD, lA) - 4 * Math.max(wD, wA), Math.max(lD, lA) + 4 * Math.max(wD, wA), 1500);
    const F = xs.map((l) => gauss(l, lD, wD)), E = xs.map((l) => epsA * gauss(l, lA, wA));
    return trapz(xs, xs.map((l, i) => F[i] * E[i] * l ** 4)) / trapz(xs, F);
  }
  // 点偶极耦合（cm⁻¹）：V = 5.034 μ²(D²) (cos α − 3 cos θ₁ cos θ₂) / r³(nm³)；平行偶极、和连线夹角 θ 时取 1 − 3cos²θ
  const dipoleCm = (muD, rNm, theta) => (C.D2nm3 * muD * muD * (1 - 3 * Math.cos(theta) ** 2)) / rNm ** 3;
  // Kasha 激子链：N 个平行的偶极排成一行，间距 r，偶极和链方向夹角 θ。all = true 时所有分子对都按 1/r³ 耦合，否则只有最近邻。
  // 返回本征能量（相对单体，cm⁻¹）和每个态的振子强度（以单体为 1）
  function exciton(N, V1, all = false) {
    const H = Array.from({ length: N }, (_, i) => Array.from({ length: N }, (_, j) => (i === j ? 0 : all ? V1 / Math.abs(i - j) ** 3 : Math.abs(i - j) === 1 ? V1 : 0)));
    const { values, vectors } = symEig(H);
    return { E: values, f: vectors.map((v) => v.reduce((s, x) => s + x, 0) ** 2) };
  }

  // ── 第六章 势能面交叉 ────────────────────────────────────────────
  // Landau–Zener：两条透热态能量差随时间线性变化（斜率 α），耦合 V，ħ = 1。留在原来透热态上的概率 P = exp(−2π V² / α)
  const lzP = (V, alpha) => Math.exp((-TAU * V * V) / alpha);
  // 直接解含时薛定谔方程：H(t) = [[αt/2, V], [V, −αt/2]]，从 t = −T 的透热态 1 出发，RK4。返回轨迹 { t, p1（透热态 1 的布居）, pUp（上面的绝热态）}、最终跳到上面绝热态的概率 final 和模长 norm
  function lzSolve(V, alpha, T, dt = 0.005, every = 20) {
    // 从 t = −T 时下面的绝热态出发（α > 0 时它主要是透热态 1）；跳到上面绝热态的概率在 T → ∞ 时就是 P_LZ。
    // 终点看绝热布居而不看透热布居：透热布居在有限时间里有 ~V/(αT) 的振荡，绝热布居的修正是 (V/αT)² 量级。
    const e0 = (-alpha * T) / 2, W0 = Math.hypot(e0, V);
    let ar = Math.sqrt((1 - e0 / W0) / 2), ai = 0, br = -Math.sign(V || 1) * Math.sqrt((1 + e0 / W0) / 2), bi = 0, t = -T;
    const f = (t, ar, ai, br, bi) => { const e = (alpha * t) / 2; return [e * ai + V * bi, -(e * ar + V * br), -e * bi + V * ai, -(-e * br + V * ar)]; }; // i dc/dt = H c
    const out = { t: [], p1: [], pUp: [] };
    const n = Math.round((2 * T) / dt);
    for (let s = 0; s <= n; s++) {
      if (s % every === 0) {
        const e = (alpha * t) / 2, W = Math.hypot(e, V), c = Math.sqrt((1 + e / W) / 2), sn = Math.sign(V || 1) * Math.sqrt((1 - e / W) / 2);
        // 上面的绝热态 (c, sn)：⟨up|ψ⟩
        const ur = c * ar + sn * br, ui = c * ai + sn * bi;
        out.t.push(t); out.p1.push(ar * ar + ai * ai); out.pUp.push(ur * ur + ui * ui);
      }
      const k1 = f(t, ar, ai, br, bi), h = dt / 2;
      const k2 = f(t + h, ar + h * k1[0], ai + h * k1[1], br + h * k1[2], bi + h * k1[3]);
      const k3 = f(t + h, ar + h * k2[0], ai + h * k2[1], br + h * k2[2], bi + h * k2[3]);
      const k4 = f(t + dt, ar + dt * k3[0], ai + dt * k3[1], br + dt * k3[2], bi + dt * k3[3]);
      ar += (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); ai += (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      br += (dt / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]); bi += (dt / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
      t += dt;
    }
    { const e = (alpha * t) / 2, W = Math.hypot(e, V), c = Math.sqrt((1 + e / W) / 2), sn = Math.sign(V || 1) * Math.sqrt((1 - e / W) / 2), ur = c * ar + sn * br, ui = c * ai + sn * bi; out.final = ur * ur + ui * ui; }
    out.p1end = ar * ar + ai * ai;
    out.norm = ar * ar + ai * ai + br * br + bi * bi;
    return out;
  }
  // 线性锥形交叉：H(x, y) = s x + [[g x, h y], [h y, −g x]]（s 是倾斜，g 是调谐方向的梯度差，h 是耦合方向）。返回两个绝热能量
  const coneE = (x, y, g, h, s = 0) => { const r = Math.hypot(g * x, h * y); return [s * x - r, s * x + r]; };
  // 下面那个绝热态的实本征向量
  const coneVec = (x, y, g, h) => { const a = g * x, b = h * y, th = Math.atan2(b, a); return [Math.sin(th / 2), -Math.cos(th / 2)]; };
  // 沿着以 (x0, y0) 为圆心、半径 r 的圈走一周，下面绝热态的几何（Berry）相位：每一步取和上一步重叠为正的符号，回到起点时比较符号
  function berryPhase(x0, y0, r, g, h, n = 720) {
    let prev = coneVec(x0 + r, y0, g, h);
    const first = prev;
    for (let k = 1; k <= n; k++) {
      const a = (TAU * k) / n;
      let v = coneVec(x0 + r * Math.cos(a), y0 + r * Math.sin(a), g, h);
      if (v[0] * prev[0] + v[1] * prev[1] < 0) v = [-v[0], -v[1]];
      prev = v;
    }
    return prev[0] * first[0] + prev[1] * first[1] < 0 ? Math.PI : 0;
  }

  // ── 第七章 电子转移：Marcus ─────────────────────────────────────
  // 经典 Marcus：k = (2π/ħ) V² (4πλk_BT)^{−1/2} exp(−(ΔG° + λ)² / 4λk_BT)。λ、ΔG°、V 用 eV
  const marcusBarrier = (dG, lam) => ((dG + lam) ** 2) / (4 * lam);
  const marcusK = (dG, lam, V, T = 298.15) => { const kT = C.kB * T; return (TAU / C.hbar) * V * V / Math.sqrt(4 * Math.PI * lam * kT) * Math.exp(-marcusBarrier(dG, lam) / kT); };
  // Marcus–Levich–Jortner：一个高频模（ħω，Huang–Rhys 因子 S）量子化，溶剂部分 λ_s 经典
  function mljK(dG, lamS, V, hw, S, T = 298.15, vmax = 40) {
    const kT = C.kB * T; let s = 0;
    for (let v = 0; v <= vmax; v++) s += poisson(S, v) * Math.exp(-((dG + lamS + v * hw) ** 2) / (4 * lamS * kT));
    return (TAU / C.hbar) * V * V / Math.sqrt(4 * Math.PI * lamS * kT) * s;
  }
  // 两条抛物线：反应物 G_R(q) = λ q²，产物 G_P(q) = λ (q − 1)² + ΔG°；交点 q* = (λ + ΔG°) / 2λ
  const marcusCurves = (q, lam, dG) => [lam * q * q, lam * (q - 1) ** 2 + dG];
  const marcusCross = (lam, dG) => (lam + dG) / (2 * lam);

  // ── 第八章 TADF：S₁ 和 T₁ 的两态动力学 ────────────────────────────
  // p：{ kr, knrS, kISC, knrT, dEST（eV）, T（K）}；kRISC 由细致平衡给出：k_RISC = (k_ISC / 3) exp(−ΔE_ST / k_BT)（三重态有三个子能级）
  function tadf(p) {
    const kT = C.kB * p.T, kRISC = p.kRISC ?? (p.kISC / 3) * Math.exp(-p.dEST / kT);
    const a = p.kr + p.knrS + p.kISC, b = kRISC + p.knrT;
    const disc = Math.sqrt((a - b) ** 2 + 4 * kRISC * p.kISC), l1 = (-(a + b) + disc) / 2, l2 = (-(a + b) - disc) / 2; // l1 是慢的（延迟），l2 是快的（瞬时）
    // 从 S₁ 出发：S(t) = c1 e^{l1 t} + c2 e^{l2 t}，S(0) = 1，S′(0) = −a
    const cS1 = (-a - l2) / (l1 - l2), cS2 = 1 - cS1;
    // 从 T₁ 出发：S(0) = 0，S′(0) = k_RISC
    const cT1 = kRISC / (l1 - l2);
    const fromS = (t) => cS1 * Math.exp(l1 * t) + cS2 * Math.exp(l2 * t);
    const fromT = (t) => cT1 * (Math.exp(l1 * t) - Math.exp(l2 * t));
    const phiPF = p.kr / a, phiISC = p.kISC / a, phiRISC = kRISC / b, loop = phiISC * phiRISC;
    const phiF = phiPF / (1 - loop), phiDF = phiF - phiPF;
    const phiFfromT = phiRISC * phiF;
    // 电激发：25 % 单重态、75 % 三重态
    const etaEL = 0.25 * phiF + 0.75 * phiFfromT;
    return { kRISC, l1, l2, tauPF: -1 / l2, tauDF: -1 / l1, fromS, fromT, phiPF, phiDF, phiF, phiISC, phiRISC, phiFfromT, etaEL, cS1, cS2 };
  }

  // ── 第九章 光催化 ────────────────────────────────────────────────
  // 激发态电位（V，相对同一参比）：E(PC⁺/PC*) = E(PC⁺/PC) − E₀₀，E(PC*/PC⁻) = E(PC/PC⁻) + E₀₀
  const excitedPot = (Eox, Ered, E00) => ({ oxStar: Eox - E00, redStar: Ered + E00 });
  // Rehm–Weller：ΔG_ET = E(D⁺/D) − E(A/A⁻) − E₀₀ − w（eV）；猝灭速率 k_q = k_d / (1 + (k_d / (K k_0)) …) 的原始写法：
  // k_q = k_diff / (1 + 0.25 [exp(ΔG‡ / RT) + exp(ΔG / RT)])，ΔG‡ = ΔG/2 + √((ΔG/2)² + ΔG‡(0)²)，ΔG‡(0) ≈ 0.104 eV（2.4 kcal/mol）
  const rehmWellerDG = (Eox, Ered, E00, w = 0) => Eox - Ered - E00 - w;
  function rehmWellerK(dG, T = 298.15, kdiff = 2e10, dG0 = 0.104) {
    const kT = C.kB * T, dGs = dG / 2 + Math.sqrt((dG / 2) ** 2 + dG0 * dG0);
    return kdiff / (1 + 0.25 * (Math.exp(dGs / kT) + Math.exp(dG / kT)));
  }
  // Stern–Volmer：动态 I₀/I = 1 + K_D[Q]（K_D = k_q τ₀），加上静态 (1 + K_D[Q])(1 + K_S[Q])；寿命只看动态的
  const sternVolmer = (Q, kq, tau0, KS = 0) => ({ I: (1 + kq * tau0 * Q) * (1 + KS * Q), tau: 1 + kq * tau0 * Q });

  // ── 第十章 自由基对：单重态产率 ──────────────────────────────────
  // 两个电子自旋，电子 1 和一个自旋 ½ 的核有超精细耦合（轴对称张量 Axx = Ayy = a⊥，Azz = a∥，单位 mT），外场 B（mT）在 xz 平面里和 z 轴夹角 θ。
  // 基矢 |e1 e2 n⟩，每个是 α 或 β。哈密顿量是实对称的（S_y I_y 是实矩阵）。单重态复合速率 k（μs⁻¹），初态是单重态（核自旋随机）。
  // Φ_S = (1 / tr P_S) Σ_mn |⟨m|P_S|n⟩|² k² / (k² + ω_mn²)
  function rpHamiltonian(B, theta, aPerp, aPar) {
    const g = C.gammaE, n = 8, H = Array.from({ length: n }, () => new Array(n).fill(0));
    const bit = (s, k) => (s >> (2 - k)) & 1; // k = 0：电子 1，1：电子 2，2：核；0 = α，1 = β
    const mz = (s, k) => (bit(s, k) ? -0.5 : 0.5);
    const flip = (s, k) => s ^ (1 << (2 - k));
    const bx = B * Math.sin(theta), bz = B * Math.cos(theta);
    for (let s = 0; s < n; s++) {
      // Zeeman：γ (B_z (S1z + S2z) + B_x (S1x + S2x))
      H[s][s] += g * bz * (mz(s, 0) + mz(s, 1));
      for (const k of [0, 1]) H[flip(s, k)][s] += g * bx * 0.5;
      // 超精细：a∥ S1z Iz + a⊥ (S1x Ix + S1y Iy) = a∥ S1z Iz + (a⊥ / 2)(S1⁺ I⁻ + S1⁻ I⁺)
      H[s][s] += g * aPar * mz(s, 0) * mz(s, 2);
      if (bit(s, 0) !== bit(s, 2)) H[flip(flip(s, 0), 2)][s] += g * aPerp * 0.5;
    }
    return H;
  }
  function rpProjector() {
    const P = Array.from({ length: 8 }, () => new Array(8).fill(0));
    // |S⟩ = (|αβ⟩ − |βα⟩)/√2 ⊗ |核⟩
    for (const nuc of [0, 1]) {
      const ab = (0 << 2) | (1 << 1) | nuc, ba = (1 << 2) | (0 << 1) | nuc;
      P[ab][ab] += 0.5; P[ba][ba] += 0.5; P[ab][ba] -= 0.5; P[ba][ab] -= 0.5;
    }
    return P;
  }
  function singletYield(B, theta, aPerp, aPar, k) {
    const H = rpHamiltonian(B, theta, aPerp, aPar), P = rpProjector(), { values: E, vectors: U } = symEig(H);
    const Pm = U.map((u) => P.map((row) => row.reduce((s, x, j) => s + x * u[j], 0)));
    let s = 0;
    for (let m = 0; m < 8; m++) for (let nn = 0; nn < 8; nn++) {
      const pmn = U[m].reduce((acc, x, i) => acc + x * Pm[nn][i], 0), w = E[m] - E[nn];
      s += pmn * pmn * (k * k) / (k * k + w * w);
    }
    return s / 2;
  }

  // ── 第十一章 瞬态吸收：A → B → 基态，指数和高斯仪器响应的卷积 ──────
  // (e^{−kt} θ(t)) ⊗ 高斯(σ) = ½ exp(−t²/2σ²) erfcx((kσ² − t)/(√2 σ))
  // z < 0 时 erfcx(z) = 2e^{z²} − erfcx(−z)，把 e^{z²} 和 e^{−t²/2σ²} 先合起来，免得溢出
  function expIRF(t, k, sig) {
    if (sig <= 0) return t >= 0 ? Math.exp(-k * t) : 0;
    const z = (k * sig * sig - t) / (Math.SQRT2 * sig), g = Math.exp((-t * t) / (2 * sig * sig));
    return z >= 0 ? 0.5 * g * erfcx(z) : Math.exp(-k * t + (k * k * sig * sig) / 2) - 0.5 * g * erfcx(-z);
  }
  const stepIRF = (t, sig) => (sig <= 0 ? (t >= 0 ? 1 : 0) : 0.5 * erfc(-t / (Math.SQRT2 * sig)));
  // 依次反应 A → B（k1）→ 基态（k2）：c_A = e^{−k1 t}，c_B = k1/(k2 − k1)(e^{−k1 t} − e^{−k2 t})；都和仪器响应卷积
  function seqPops(t, k1, k2, sig) {
    const a = expIRF(t, k1, sig);
    const b = Math.abs(k2 - k1) < 1e-9 * k1 ? k1 * t * Math.exp(-k1 * t) * stepIRF(t, sig) : (k1 / (k2 - k1)) * (expIRF(t, k1, sig) - expIRF(t, k2, sig));
    return [a, b];
  }
  // 物种光谱（摩尔吸光系数的形状，任意单位）：基态吸收 G、A 的激发态吸收、A 的受激发射（负）、B 的吸收
  function taSpectra(l, sp) {
    const G = sp.g * gauss(l, sp.lg, sp.wg);
    const A = sp.esaA * gauss(l, sp.lesaA, sp.wesa) - sp.se * gauss(l, sp.lse, sp.wg);
    const Bs = sp.esaB * gauss(l, sp.lesaB, sp.wesa);
    return { G, A, B: Bs };
  }
  // ΔA(λ, t) = c_A (ε_A − ε_G) + c_B (ε_B − ε_G)：A 和 B 都还没回到基态，所以都有基态漂白
  const taDelta = (l, t, k1, k2, sig, sp) => { const [a, b] = seqPops(t, k1, k2, sig), s = taSpectra(l, sp); return a * (s.A - s.G) + b * (s.B - s.G); };

  window.MOLASTRIA_PHOTOCHEM_MODELS = { TAU, C, symEig, lnGamma, erfc, erfcx, gauss, lin, trapz, bandArea, oscStrength, dipoleD, stricklerBerg, absorbance, transmit, jablonski, poisson, hoPsi, fcFactors, vibronic, gapRate, gapEJ, kasha, forsterR0, fretE, dexterE, overlapJ, dipoleCm, exciton, lzP, lzSolve, coneE, coneVec, berryPhase, marcusBarrier, marcusK, mljK, marcusCurves, marcusCross, tadf, excitedPot, rehmWellerDG, rehmWellerK, sternVolmer, rpHamiltonian, rpProjector, singletYield, expIRF, stepIRF, seqPops, taSpectra, taDelta };
})();
