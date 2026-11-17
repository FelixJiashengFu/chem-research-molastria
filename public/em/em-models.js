'use strict';
// 电磁学与介电（/em/）的演示数学：全部是纯函数，没有 DOM，tools/em-test.mjs 逐个对照解析解和教科书数值。
// 单位：除非另外说明都用 SI。em-demos.js 只调这里的函数画图。
window.MOLASTRIA_EM_MODELS = (() => {
  const PI = Math.PI;
  const C = {
    e: 1.602176634e-19, eps0: 8.8541878128e-12, mu0: 1.25663706212e-6, kB: 1.380649e-23, NA: 6.02214076e23,
    c: 299792458, hbar: 1.054571817e-34, me: 9.1093837015e-31, debye: 3.33564e-30, a0: 5.29177210903e-11, Eh: 4.3597447222071e-18,
    muB: 9.2740100783e-24,
  };
  C.coul = 1 / (4 * PI * C.eps0); // 8.9876e9 N m² C⁻²
  C.bornKJ = (C.NA * C.e * C.e * C.coul) / 2 / 1e-10 / 1000; // N_A e²/(8πε₀) in kJ mol⁻¹ Å：694.7

  // ── 复数 ──
  const cx = (re, im = 0) => ({ re, im });
  const cadd = (a, b) => cx(a.re + b.re, a.im + b.im);
  const cmul = (a, b) => cx(a.re * b.re - a.im * b.im, a.re * b.im + a.im * b.re);
  const cdiv = (a, b) => { const d = b.re * b.re + b.im * b.im; return cx((a.re * b.re + a.im * b.im) / d, (a.im * b.re - a.re * b.im) / d); };
  const cpow = (a, p) => { const r = Math.hypot(a.re, a.im), t = Math.atan2(a.im, a.re); if (r === 0) return cx(0); const rp = r ** p; return cx(rp * Math.cos(p * t), rp * Math.sin(p * t)); };
  const csqrt = (a) => cpow(a, 0.5);

  // ── 1. 点电荷的场（三维的库仑场，演示画 z = 0 的切面） ──
  // charges: [{ x, y, z?, q }]，单位任意（k = 1）：E = Σ q r̂ / r²
  function field3(charges, x, y, z = 0) {
    let Ex = 0, Ey = 0, Ez = 0;
    for (const c of charges) { const dx = x - c.x, dy = y - c.y, dz = z - (c.z || 0), r2 = dx * dx + dy * dy + dz * dz, r = Math.sqrt(r2), f = c.q / (r2 * r); Ex += f * dx; Ey += f * dy; Ez += f * dz; }
    return [Ex, Ey, Ez];
  }
  function potential3(charges, x, y, z = 0) { let V = 0; for (const c of charges) V += c.q / Math.hypot(x - c.x, y - c.y, z - (c.z || 0)); return V; }
  // 穿过以 (cx,cy,cz) 为心、半径 R 的球面的电通量（数值积分），高斯定律给 4π·Σq_内
  function fluxSphere(charges, cxp, cyp, czp, R, n = 120) {
    let F = 0;
    for (let i = 0; i < n; i++) {
      const th = ((i + 0.5) / n) * PI, st = Math.sin(th), ct = Math.cos(th);
      for (let j = 0; j < 2 * n; j++) {
        const ph = ((j + 0.5) / (2 * n)) * 2 * PI, nx = st * Math.cos(ph), ny = st * Math.sin(ph), nz = ct;
        const [Ex, Ey, Ez] = field3(charges, cxp + R * nx, cyp + R * ny, czp + R * nz);
        F += (Ex * nx + Ey * ny + Ez * nz) * R * R * st * (PI / n) * (PI / n);
      }
    }
    return F;
  }
  // 从 (x,y) 沿场线（dir = +1 顺着、−1 逆着）走，平面内的 RK4，步长 h；碰到电荷或出界就停
  function traceLine(charges, x, y, dir = 1, h = 0.02, max = 1500, box = 3) {
    const pts = [[x, y]];
    const f = (px, py) => { const [Ex, Ey] = field3(charges, px, py); const m = Math.hypot(Ex, Ey) || 1; return [(dir * Ex) / m, (dir * Ey) / m]; };
    for (let i = 0; i < max; i++) {
      const [k1x, k1y] = f(x, y), [k2x, k2y] = f(x + (h / 2) * k1x, y + (h / 2) * k1y), [k3x, k3y] = f(x + (h / 2) * k2x, y + (h / 2) * k2y), [k4x, k4y] = f(x + h * k3x, y + h * k3y);
      x += (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x); y += (h / 6) * (k1y + 2 * k2y + 2 * k3y + k4y);
      pts.push([x, y]);
      if (Math.abs(x) > box || Math.abs(y) > box) break;
      if (charges.some((c) => Math.hypot(x - c.x, y - c.y) < h * 1.5 && c.q * dir < 0)) break;
    }
    return pts;
  }

  // ── 2. 拉普拉斯方程：单位正方形，上边 V = 1，其余三边接地 ──
  // 解析解：V = Σ_{k 奇} 4/(kπ) sin(kπx) sinh(kπy)/sinh(kπ)；中心点由叠加原理恰好是 1/4
  function boxAnalytic(x, y, terms = 199) {
    let V = 0;
    for (let k = 1; k <= terms; k += 2) {
      const a = k * PI, r = a < 300 ? Math.sinh(a * y) / Math.sinh(a) : Math.exp(a * (y - 1));
      V += (4 / a) * Math.sin(a * x) * r;
    }
    return V;
  }
  function laplaceInit(n) { const V = Array.from({ length: n }, () => new Float64Array(n)); for (let i = 0; i < n; i++) V[n - 1][i] = 1; V[n - 1][0] = 0.5; V[n - 1][n - 1] = 0.5; return { n, V, it: 0 }; }
  // 一次扫过全部内点。omega = 1 是 Gauss–Seidel，1 < ω < 2 是超松弛（SOR）；jacobi = true 时用上一轮的值（Jacobi）。返回最大改变量
  function laplaceSweep(st, omega = 1, jacobi = false) {
    const { n, V } = st, src = jacobi ? V.map((r) => Float64Array.from(r)) : V;
    let d = 0;
    for (let j = 1; j < n - 1; j++) for (let i = 1; i < n - 1; i++) {
      const nv = 0.25 * (src[j - 1][i] + src[j + 1][i] + src[j][i - 1] + src[j][i + 1]), dv = omega * (nv - V[j][i]);
      V[j][i] += dv; if (Math.abs(dv) > d) d = Math.abs(dv);
    }
    st.it++;
    return d;
  }
  const sorOmega = (n) => 2 / (1 + Math.sin(PI / (n - 1)));

  // ── 3. 多极展开 ──
  // 分子的点电荷模型（Å，e）。TIP3P 水、EPM2 二氧化碳、OPLS 风格的甲烷（只为看出八极矩是第一个不为零的项）
  const MOLECULES = {
    water: (() => { const r = 0.9572, t = (104.52 * PI) / 180 / 2; return [{ x: 0, y: 0, z: 0, q: -0.834 }, { x: r * Math.sin(t), y: 0, z: r * Math.cos(t), q: 0.417 }, { x: -r * Math.sin(t), y: 0, z: r * Math.cos(t), q: 0.417 }]; })(),
    co2: [{ x: 0, y: 0, z: 0, q: 0.6512 }, { x: 0, y: 0, z: 1.149, q: -0.3256 }, { x: 0, y: 0, z: -1.149, q: -0.3256 }],
    methane: (() => { const d = 1.09 / Math.sqrt(3); return [{ x: 0, y: 0, z: 0, q: -0.24 }, ...[[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(([a, b, c]) => ({ x: a * d, y: b * d, z: c * d, q: 0.06 }))]; })(),
    ion: [{ x: 0, y: 0, z: 0, q: 1 }],
  };
  function legendre(l, x) { if (l === 0) return 1; let p0 = 1, p1 = x; for (let k = 2; k <= l; k++) { const p2 = ((2 * k - 1) * x * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } return p1; }
  // 截到 L 阶的多极势（k = 1 的单位），点 P 在原点外、离原点比任何电荷都远
  function multipoleV(charges, P, L) {
    const R = Math.hypot(P[0], P[1], P[2]);
    let V = 0;
    for (const c of charges) {
      const r = Math.hypot(c.x, c.y, c.z || 0); if (r === 0) { V += c.q / R; continue; }
      const cg = (c.x * P[0] + c.y * P[1] + (c.z || 0) * P[2]) / (r * R);
      for (let l = 0; l <= L; l++) V += (c.q * r ** l * legendre(l, cg)) / R ** (l + 1);
    }
    return V;
  }
  const exactV = (charges, P) => potential3(charges, P[0], P[1], P[2]);
  // 单极、偶极（e·Å）、Buckingham 四极张量 Θ_ab = ½Σq(3 r_a r_b − r² δ_ab)（e·Å²）
  function moments(charges) {
    const q = charges.reduce((s, c) => s + c.q, 0), mu = [0, 0, 0], Th = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const c of charges) {
      const r = [c.x, c.y, c.z || 0], r2 = r[0] ** 2 + r[1] ** 2 + r[2] ** 2;
      for (let a = 0; a < 3; a++) { mu[a] += c.q * r[a]; for (let b = 0; b < 3; b++) Th[a][b] += 0.5 * c.q * (3 * r[a] * r[b] - (a === b ? r2 : 0)); }
    }
    return { q, mu, Th, muD: (Math.hypot(...mu) * C.e * 1e-10) / C.debye, eA2toB: (C.e * 1e-20) / 3.33564e-40 };
  }

  // ── 4. 极性分子的介电常数 ──
  // 极化率体积 α'（Å³）、偶极矩 μ（D）、温度 T（K）。Debye 的取向极化率体积 μ²/(4πε₀·3k_BT)，换成 Å³
  const orientVol = (muD, T) => ((muD * C.debye) ** 2 * C.coul) / (3 * C.kB * T) * 1e30;
  // 摩尔极化 P_m = (4π/3) N_A (α' + μ²/3kT·…)，cm³ mol⁻¹
  const molarPol = (alpha, muD, T) => ((4 * PI) / 3) * C.NA * (alpha + orientVol(muD, T)) * 1e-24;
  // Clausius–Mossotti：(ε − 1)/(ε + 2) = n·(4π/3)·α_tot；n 是数密度（m⁻³）
  function clausius(nDens, alphaTot) { const x = nDens * ((4 * PI) / 3) * alphaTot * 1e-30; return x >= 1 ? Infinity : (1 + 2 * x) / (1 - x); }
  const gasDensity = (T, p = 101325) => p / (C.kB * T);
  // Onsager（1936）：(ε − n²)(2ε + n²) / [ε (n² + 2)²] = g·N μ² / (9 ε₀ k_B T)；g = 1 是 Onsager，g ≠ 1 是 Kirkwood 的推广
  function onsagerRHS(nDens, muD, T) { return (nDens * (muD * C.debye) ** 2) / (9 * C.eps0 * C.kB * T); }
  function onsager(nDens, muD, T, n2, g = 1) {
    // (ε − n²)(2ε + n²) = R (n² + 2)² ε  →  2ε² − (n² + R(n² + 2)²) ε − n⁴ = 0，取正根
    const R = g * onsagerRHS(nDens, muD, T), b = n2 + R * (n2 + 2) ** 2;
    return (b + Math.sqrt(b * b + 8 * n2 * n2)) / 4;
  }
  // 要让 Onsager 方程给出实验的 ε，需要多大的 Kirkwood 因子 g
  function kirkwoodG(nDens, muD, T, n2, epsExp) { return ((epsExp - n2) * (2 * epsExp + n2)) / (epsExp * (n2 + 2) ** 2) / onsagerRHS(nDens, muD, T); }
  // 气体：α'（Å³）、μ（D）；液体：ε（实验）、密度（kg m⁻³）、摩尔质量（g mol⁻¹）、光频 n、温度
  const GASES = {
    h2o: { alpha: 1.45, mu: 1.855 }, nh3: { alpha: 2.26, mu: 1.47 }, hcl: { alpha: 2.63, mu: 1.109 }, co: { alpha: 1.95, mu: 0.11 }, ch4: { alpha: 2.59, mu: 0 },
  };
  const LIQUIDS = {
    water: { eps: 78.4, rho: 997, M: 18.015, n: 1.333, mu: 1.855, T: 298.15 },
    methanol: { eps: 32.7, rho: 787, M: 32.04, n: 1.329, mu: 1.70, T: 298.15 },
    dmso: { eps: 46.7, rho: 1095, M: 78.13, n: 1.479, mu: 3.96, T: 298.15 },
    acetonitrile: { eps: 35.9, rho: 777, M: 41.05, n: 1.344, mu: 3.92, T: 298.15 },
    acetone: { eps: 20.7, rho: 785, M: 58.08, n: 1.359, mu: 2.88, T: 298.15 },
    chloroform: { eps: 4.81, rho: 1479, M: 119.38, n: 1.446, mu: 1.04, T: 298.15 },
  };
  const liquidDensity = (L) => (L.rho / (L.M * 1e-3)) * C.NA;

  // ── 5. 连续介质溶剂化 ──
  // Born：ΔG = −(N_A q² e²/8πε₀ r)(1 − 1/ε)，kJ mol⁻¹，r 用 Å
  const bornKJ = (z, r, eps) => -C.bornKJ * z * z * (1 - 1 / eps) / r;
  // Marcus（1991）的水合自由能（kJ mol⁻¹）和 Pauling 晶体半径（Å）
  const IONS = [
    ['Li⁺', 1, 0.60, -475], ['Na⁺', 1, 0.95, -365], ['K⁺', 1, 1.33, -295], ['Rb⁺', 1, 1.48, -275], ['Cs⁺', 1, 1.69, -250],
    ['F⁻', -1, 1.36, -465], ['Cl⁻', -1, 1.81, -340], ['Br⁻', -1, 1.95, -315], ['I⁻', -1, 2.16, -275],
  ];
  // Kirkwood（1934）：球形空腔（半径 a、里面 ε = 1）里离心 d 的点电荷，外面介电常数 ε。返回 W/(q²/4πε₀a)
  function kirkwood(x, eps, L = 400) { let s = 0; for (let l = 0; l <= L; l++) { const t = ((l + 1) * (1 - eps)) / ((l + 1) * eps + l) * x ** (2 * l); s += t; if (Math.abs(t) < 1e-15 && l > 4) break; } return 0.5 * s; }
  // 球面上均匀撒 n 个点（Fibonacci 格子）
  function sphereGrid(n) { const out = [], g = PI * (3 - Math.sqrt(5)); for (let i = 0; i < n; i++) { const z = 1 - (2 * (i + 0.5)) / n, r = Math.sqrt(1 - z * z), t = g * i; out.push([r * Math.cos(t), r * Math.sin(t), z]); } return out; }
  // Cholesky 解对称正定方程组 A x = b（A 是二维数组，会被改写）
  function cholSolve(A, b) {
    const n = b.length;
    for (let j = 0; j < n; j++) {
      const Aj = A[j];
      let s = Aj[j]; for (let k = 0; k < j; k++) s -= Aj[k] * Aj[k];
      if (!(s > 0)) throw new Error('matrix not positive definite');
      const d = Math.sqrt(s); Aj[j] = d;
      for (let i = j + 1; i < n; i++) { const Ai = A[i]; let t = Ai[j]; for (let k = 0; k < j; k++) t -= Ai[k] * Aj[k]; Ai[j] = t / d; }
    }
    const y = new Float64Array(n);
    for (let i = 0; i < n; i++) { let t = b[i]; const Ai = A[i]; for (let k = 0; k < i; k++) t -= Ai[k] * y[k]; y[i] = t / Ai[i]; }
    for (let i = n - 1; i >= 0; i--) { let t = y[i]; for (let k = i + 1; k < n; k++) t -= A[k][i] * y[k]; y[i] = t / A[i][i]; }
    return y;
  }
  // COSMO（Klamt–Schüürmann 1993）：先当溶剂是导体解出表面电荷，再乘 f(ε) = (ε − 1)/(ε + xk)。
  // 半径 1 的球、电荷 +1 在 (0, 0, d)。返回 { W（单位 q²/4πε₀a）, qs（表面电荷）, pts, total }
  function cosmo(d, eps, n, xk = 0.5) {
    const pts = sphereGrid(n), area = (4 * PI) / n, self = 1.07 * Math.sqrt((4 * PI) / area);
    const A = pts.map((p, i) => { const row = new Float64Array(n); for (let j = 0; j < n; j++) row[j] = i === j ? self : 1 / Math.hypot(p[0] - pts[j][0], p[1] - pts[j][1], p[2] - pts[j][2]); return row; });
    const phi = pts.map((p) => 1 / Math.hypot(p[0], p[1], p[2] - d));
    const q0 = cholSolve(A, phi.map((v) => -v)), f = eps === Infinity ? 1 : (eps - 1) / (eps + xk), qs = Array.from(q0, (v) => f * v);
    let W = 0, total = 0; for (let i = 0; i < n; i++) { W += 0.5 * qs[i] * phi[i]; total += qs[i]; }
    return { W, qs, pts, total, f };
  }

  // ── 6. 介电弛豫 ──
  // Havriliak–Negami：ε(ω) = ε∞ + Δε / (1 + (iωτ)^{1−α})^β；α = 0、β = 1 是 Debye，β = 1 是 Cole–Cole，α = 0 是 Cole–Davidson
  // 约定 ε = ε′ − iε″，返回 { re: ε′, im: ε″ }（ε″ ≥ 0）
  function hn(w, epsS, epsInf, tau, alpha = 0, beta = 1) {
    const iwt = cpow(cx(0, w * tau), 1 - alpha), den = cpow(cadd(cx(1), iwt), beta), v = cadd(cx(epsInf), cdiv(cx(epsS - epsInf), den));
    return { re: v.re, im: -v.im };
  }
  // 水：静态介电常数（Malmberg & Maryott 1956，0–100 °C），粘度（Vogel 式），Debye 时间按 τ ∝ η/T 从 25 °C 的 8.27 ps 推
  const waterEpsS = (t) => 87.740 - 0.40008 * t + 9.398e-4 * t * t - 1.410e-6 * t ** 3;
  const waterEta = (t) => 2.414e-5 * 10 ** (247.8 / (t + 273.15 - 140));
  const waterTau = (t) => 8.27e-12 * (waterEta(t) / waterEta(25)) * (298.15 / (t + 273.15));
  // 介电加热：功率密度 ωε₀ε″E²（E 是有效值），以及功率穿透深度 1/(2·(ω/c)·Im√ε)
  const heatPower = (f, epsIm, Erms) => 2 * PI * f * C.eps0 * epsIm * Erms * Erms;
  function penetration(f, e) { const n = csqrt(cx(e.re, -e.im)); return C.c / (2 * 2 * PI * f * Math.abs(n.im)); }
  // Kramers–Kronig：从 ε″ 算 ε′ − ε∞ = (2/π) P∫ ω′ε″(ω′)/(ω′² − ω²) dω′。对数格点上做，跳过奇点附近（用对称的格点抵消）
  function kkReal(epsIm, w, lo = -6, hi = 6, n = 20000) {
    // 积分变量 u = ln ω′，dω′ = ω′ du；主值：把 ω′ = ω 放在两个格点正中间
    const u0 = Math.log(w), du = (hi - lo) * Math.LN10 / n, start = u0 - Math.ceil((u0 - lo * Math.LN10) / du) * du + du / 2;
    let s = 0;
    for (let u = start; u < hi * Math.LN10; u += du) { const wp = Math.exp(u); s += (wp * epsIm(wp) * wp) / (wp * wp - w * w) * du; }
    return (2 / PI) * s;
  }

  // ── 7. 全频介电谱：取向（Debye）+ 离子（红外 Lorentz）+ 电子（紫外 Lorentz） ──
  function lorentz(w, de, w0, g) { const v = cdiv(cx(de * w0 * w0), cx(w0 * w0 - w * w, -g * w)); return { re: v.re, im: v.im }; } // ε″ = Im ≥ 0
  function fullSpectrum(w, p) {
    const d = hn(w, p.dOr, 0, p.tau), a = lorentz(w, p.dIon, p.wIon, p.gIon), b = lorentz(w, p.dEl, p.wEl, p.gEl);
    return { re: 1 + d.re + a.re + b.re, im: d.im + a.im + b.im, parts: [d, a, b] };
  }

  // ── 8. 线圈的磁场 ──
  // 半径 R、电流 I、圈数 N 的圆线圈在轴上 z0 处，轴上一点 z 的 B_z（T）
  const loopAxis = (z, z0, R, I = 1, N = 1) => (C.mu0 * N * I * R * R) / (2 * (R * R + (z - z0) ** 2) ** 1.5);
  // Biot–Savart 数值积分：线圈在 z = z0 平面、圆心在轴上，点 (ρ, z) 处的 [B_ρ, B_z]（T）
  function loopField(rho, z, z0, R, I = 1, N = 1, m = 180) {
    let Br = 0, Bz = 0;
    for (let k = 0; k < m; k++) {
      const t = ((k + 0.5) / m) * 2 * PI, dt = (2 * PI) / m, lx = R * Math.cos(t), ly = R * Math.sin(t), dlx = -R * Math.sin(t) * dt, dly = R * Math.cos(t) * dt;
      const rx = rho - lx, ry = -ly, rz = z - z0, r3 = Math.hypot(rx, ry, rz) ** 3;
      // dl × r，dl 没有 z 分量
      Br += (dly * rz) / r3; Bz += (dlx * ry - dly * rx) / r3;
    }
    const k = (C.mu0 * N * I) / (4 * PI);
    return [k * Br, k * Bz];
  }
  // 两个同轴线圈（间距 d，anti = true 时电流相反：反亥姆霍兹，得到梯度场）
  function pairField(rho, z, d, R, anti = false, I = 1, N = 1, m = 120) { const a = loopField(rho, z, -d / 2, R, I, N, m), b = loopField(rho, z, d / 2, R, anti ? -I : I, N, m); return [a[0] + b[0], a[1] + b[1]]; }
  const pairAxis = (z, d, R, anti = false, I = 1, N = 1) => loopAxis(z, -d / 2, R, I, N) + (anti ? -1 : 1) * loopAxis(z, d / 2, R, I, N);
  const helmholtzCentre = (R, I = 1, N = 1) => (4 / 5) ** 1.5 * (C.mu0 * N * I) / R;

  // ── 9. 物质的磁性 ──
  const coth = (x) => (Math.abs(x) < 1e-6 ? 1 / x + x / 3 : 1 / Math.tanh(x));
  function brillouin(J, x) { if (Math.abs(x) < 1e-8) return ((J + 1) / (3 * J)) * x; const a = (2 * J + 1) / (2 * J), b = 1 / (2 * J); return a * coth(a * x) - b * coth(b * x); }
  const langevin = (x) => (Math.abs(x) < 1e-6 ? x / 3 : coth(x) - 1 / x);
  // 顺磁离子每个离子的平均磁矩（μ_B），B（T）、T（K）
  const paraMoment = (J, g, B, T) => g * J * brillouin(J, (g * C.muB * J * B) / (C.kB * T));
  const pEff = (J, g) => g * Math.sqrt(J * (J + 1));
  // Weiss 平均场：m = B_J( 3J/(J+1) · (m + h)/t )，t = T/T_c，h 是外场（以交换场为单位）。不动点迭代（取正的那个解）
  function weiss(J, t, h = 0) {
    if (t <= 0) return 1;
    let m = 1;
    for (let i = 0; i < 20000; i++) { const nm = brillouin(J, ((3 * J) / (J + 1)) * (m + h) / t); if (Math.abs(nm - m) < 1e-13) return nm; m = nm; }
    return m;
  }
  // 平均场的低温和临界行为：J = ½ 时 1 − m ≈ 2e^{−2/t}；T_c 附近 m ≈ √(3(1−t))·√( (J+1)²·… )，这里给一般 J 的系数
  const weissCritical = (J, t) => Math.sqrt((10 / 3) * ((J + 1) ** 2 / ((J + 1) ** 2 + J * J)) * (1 - t));
  // Stoner–Wohlfarth：单畴、单轴各向异性，e(θ) = ½ sin²θ − h cos(θ − ψ)，h = H/H_K。沿 hs 扫场、追踪局部极小
  function swEnergy(th, h, psi) { return 0.5 * Math.sin(th) ** 2 - h * Math.cos(th - psi); }
  function swRelax(th, h, psi) {
    for (let i = 0; i < 400; i++) {
      const g = 0.5 * Math.sin(2 * th) + h * Math.sin(th - psi), H = Math.cos(2 * th) + h * Math.cos(th - psi);
      const step = H > 1e-6 ? g / H : 0.1 * Math.sign(g || 1);
      const s = Math.max(-0.2, Math.min(0.2, step)); th -= s; if (Math.abs(s) < 1e-12) break;
    }
    return th;
  }
  function swLoop(psi, n = 400, hmax = 2) {
    const down = [], up = [];
    let th = psi; // 从正的大场开始，磁矩接近场的方向
    for (let i = 0; i <= n; i++) { const h = hmax - (2 * hmax * i) / n; th = swRelax(th, h, psi); down.push([h, Math.cos(th - psi)]); }
    for (let i = 0; i <= n; i++) { const h = -hmax + (2 * hmax * i) / n; th = swRelax(th, h, psi); up.push([h, Math.cos(th - psi)]); }
    return { down, up };
  }
  const swSwitch = (psi) => 1 / (Math.abs(Math.cos(psi)) ** (2 / 3) + Math.abs(Math.sin(psi)) ** (2 / 3)) ** 1.5;
  // 从扫场曲线读出矫顽场（m 过零处）和剩磁（h = 0 处）
  function swCoercive(loop) { const d = loop.down; for (let i = 1; i < d.length; i++) if (d[i - 1][1] > 0 && d[i][1] <= 0) { const [h0, m0] = d[i - 1], [h1, m1] = d[i]; return -(h0 + ((h1 - h0) * m0) / (m0 - m1)); } return 0; }

  // ── 10. 偶极辐射 ──
  // 赫兹偶极子 p(t) = p₀ cos ωt 沿 z。用 k = 1、p₀/4πε₀ = 1 的单位，点 (x, z) 在 xz 平面里，时间相位 φ = ωt。返回实的 [E_x, E_z]
  function dipoleE(x, z, phase) {
    const r = Math.hypot(x, z), nx = x / r, nz = z / r, kr = r;
    // 复振幅：E = [k²(n×p)×n /r + (3n(n·p) − p)(1/r³ − i k/r²)] e^{ikr}，p = ẑ；再乘 e^{−iωt} 取实部
    const ph = kr - phase, cr = Math.cos(ph), sr = Math.sin(ph);
    const far = 1 / r, nearRe = 1 / r ** 3, nearIm = -1 / r ** 2;
    // (n×ẑ)×n = ẑ − n(n·ẑ) ；3n(n·ẑ) − ẑ
    const ax = -nx * nz, az = 1 - nz * nz, bx = 3 * nx * nz, bz = 3 * nz * nz - 1;
    const reF = far * cr, reN = nearRe * cr - nearIm * sr;
    return [ax * reF + bx * reN, az * reF + bz * reN];
  }
  // 电场线是 ψ = sin²θ [sin(kr − ωt) + cos(kr − ωt)/(kr)] 的等值线（E = ∇×H/(−iωε₀)，所以是 r sinθ·H_φ 落后 90° 的那一部分）
  function dipolePsi(x, z, phase) { const r = Math.hypot(x, z), s2 = (x * x) / (r * r), ph = r - phase; return s2 * (Math.sin(ph) + Math.cos(ph) / r); }
  // 时间平均的辐射功率（Larmor）：P = ω⁴ p₀² / (12π ε₀ c³)
  const larmor = (p0, w) => (w ** 4 * p0 * p0) / (12 * PI * C.eps0 * C.c ** 3);
  // 远场时间平均 Poynting 通量密度 S(θ, r)
  const poyntingFar = (p0, w, th, r) => (w ** 4 * p0 * p0 * Math.sin(th) ** 2) / (32 * PI * PI * C.eps0 * C.c ** 3 * r * r);
  const skinDepth = (f, sigma, mur = 1) => Math.sqrt(2 / (2 * PI * f * C.mu0 * mur * sigma));

  // ── 11. Drude 振子的色散力（London） ──
  // 两个三维各向同性谐振子（电荷 q、质量 m、频率 ω₀），偶极–偶极耦合，间距 R。用 ħω₀ = 1、α′ = q²/(4πε₀mω₀²) = 1 的单位：
  // 简正频率 ω² = ω₀²(1 ± κ)，κ = α′/R³（x、y 方向）和 ω₀²(1 ± 2κ)（z 方向）。返回零点能的变化 ΔE（单位 ħω₀）
  function drudePair(R) {
    const k = 1 / R ** 3;
    if (2 * k >= 1) return NaN; // 极化灾难：R³ ≤ 2α′
    const ws = [1 + k, 1 - k, 1 + k, 1 - k, 1 + 2 * k, 1 - 2 * k].map(Math.sqrt);
    return 0.5 * ws.reduce((s, w) => s + w, 0) - 3;
  }
  const londonC6 = 0.75; // −ΔE·R⁶ 的极限：(3/4)ħω₀α′²
  // London 公式 C₆ = (3/4) I α′² 的读数（eV·Å⁶），以及换成原子单位
  const c6eVA6toAU = (v) => (v * C.e) / C.Eh / (C.a0 * 1e10) ** 6;
  const casimirP = (d) => (PI * PI * C.hbar * C.c) / (240 * d ** 4);

  // ── 12. Ewald 求和：NaCl 的 Madelung 常数 ──
  // erfc：Numerical Recipes 的 Chebyshev 拟合，相对误差 < 1.2e-7
  function erfc(x) { const z = Math.abs(x), t = 1 / (1 + 0.5 * z), r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? r : 2 - r; }
  // 岩盐结构的立方晶胞（边长 1）：8 个离子
  const NACL = [[0, 0, 0, 1], [0.5, 0.5, 0, 1], [0.5, 0, 0.5, 1], [0, 0.5, 0.5, 1], [0.5, 0, 0, -1], [0, 0.5, 0, -1], [0, 0, 0.5, -1], [0.5, 0.5, 0.5, -1]];
  // 每个晶胞的能量（单位 q²/4πε₀a），alpha 是分裂参数（1/a），nr、nk 是实空间、倒空间的截断
  function ewald(alpha, nr = 3, nk = 6) {
    let Er = 0, Ek = 0;
    const N = NACL.length;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) for (let a = -nr; a <= nr; a++) for (let b = -nr; b <= nr; b++) for (let c = -nr; c <= nr; c++) {
      if (i === j && a === 0 && b === 0 && c === 0) continue;
      const dx = NACL[j][0] - NACL[i][0] + a, dy = NACL[j][1] - NACL[i][1] + b, dz = NACL[j][2] - NACL[i][2] + c, r = Math.hypot(dx, dy, dz);
      Er += 0.5 * NACL[i][3] * NACL[j][3] * erfc(alpha * r) / r;
    }
    for (let a = -nk; a <= nk; a++) for (let b = -nk; b <= nk; b++) for (let c = -nk; c <= nk; c++) {
      if (!a && !b && !c) continue;
      const kx = 2 * PI * a, ky = 2 * PI * b, kz = 2 * PI * c, k2 = kx * kx + ky * ky + kz * kz;
      let sr = 0, si = 0; for (const [x, y, z, q] of NACL) { const t = kx * x + ky * y + kz * z; sr += q * Math.cos(t); si += q * Math.sin(t); }
      Ek += ((2 * PI) / k2) * Math.exp(-k2 / (4 * alpha * alpha)) * (sr * sr + si * si);
    }
    const Es = -(alpha / Math.sqrt(PI)) * NACL.reduce((s, x) => s + x[3] * x[3], 0);
    const E = Er + Ek + Es;
    return { Er, Ek, Es, E, M: -E / 8 }; // 每个晶胞 4 对离子，最近邻距离 a/2：E = −4M/(a/2)
  }
  // 直接求和：以一个 Na⁺ 为中心，球形截断（半径 n·r₀，r₀ = 最近邻距离 = 1）
  function madelungSphere(n) { let s = 0; for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) { if (!i && !j && !k) continue; const r = Math.hypot(i, j, k); if (r > n) continue; s += ((i + j + k) % 2 ? 1 : -1) / r; } return s; }
  // Evjen（1932）：在 n×n×n 的立方体上截断，面上的离子算 1/2、棱 1/4、角 1/8
  function madelungEvjen(n) { let s = 0; for (let i = -n; i <= n; i++) for (let j = -n; j <= n; j++) for (let k = -n; k <= n; k++) { if (!i && !j && !k) continue; let w = 1; for (const v of [i, j, k]) if (Math.abs(v) === n) w *= 0.5; s += (((i + j + k) % 2 ? 1 : -1) * w) / Math.hypot(i, j, k); } return s; }

  return {
    C, cx, cadd, cmul, cdiv, cpow, csqrt,
    field3, potential3, fluxSphere, traceLine,
    boxAnalytic, laplaceInit, laplaceSweep, sorOmega,
    MOLECULES, legendre, multipoleV, exactV, moments,
    orientVol, molarPol, clausius, gasDensity, onsagerRHS, onsager, kirkwoodG, GASES, LIQUIDS, liquidDensity,
    bornKJ, IONS, kirkwood, sphereGrid, cholSolve, cosmo,
    hn, waterEpsS, waterEta, waterTau, heatPower, penetration, kkReal,
    lorentz, fullSpectrum,
    loopAxis, loopField, pairField, pairAxis, helmholtzCentre,
    coth, brillouin, langevin, paraMoment, pEff, weiss, weissCritical, swEnergy, swRelax, swLoop, swSwitch, swCoercive,
    dipoleE, dipolePsi, larmor, poyntingFar, skinDepth,
    drudePair, londonC6, c6eVA6toAU, casimirP,
    erfc, NACL, ewald, madelungSphere, madelungEvjen,
  };
})();
