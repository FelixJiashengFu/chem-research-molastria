/* 量子嘉年华 · 量子物理：交互演示的数学（纯函数，不碰 DOM；tools/quantum-physics-test.mjs 用解析解检验）。
   单位：演示 1 和演示 2 的波包用 ħ = m = 1；演示 2 的透射率用 eV 和 Å（ħ²/2mₑ = 3.80998 eV·Å²）。
   演示 1：一维定态（有限差分 + Sturm 二分 + 反幂迭代）。演示 2：方势垒的透射率（解析）与高斯波包（Crank–Nicolson）。
   演示 3：Stern–Gerlach 串联。演示 4：CHSH 不等式（量子预言、一个定域隐变量模型、按概率抽样的“实验”）。 */
(() => {
  'use strict';
  const M = {};

  // 可复现的随机数（mulberry32），演示和测试共用
  M.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ── 演示 1：一维定态 ─────────────────────────────────────────────────
  M.grid = (L, n) => Array.from({ length: n }, (_, i) => -L + (2 * L * i) / (n - 1));
  // 势能（ħ = m = 1）。p 是参数对象，缺省值就是页面上的初值。
  M.potentials = {
    harmonic: (x, p) => 0.5 * (p.omega ?? 1) ** 2 * x * x,
    well: (x, p) => (Math.abs(x) <= (p.a ?? 2) / 2 ? 0 : (p.V0 ?? 8)),
    double: (x, p) => (p.lam ?? 0.5) * (x * x - (p.b ?? 1.6) ** 2) ** 2,
    morse: (x, p) => (p.D ?? 8) * (1 - Math.exp(-(p.alpha ?? 0.7) * (x + 1.5))) ** 2,
  };
  // 三点差分：H = −½ d²/dx² + V，内部格点（两端 ψ = 0）。返回对角线 d 与副对角线常数 e。
  M.hamiltonian = (x, V) => { const h = x[1] - x[0]; return { d: x.map((xi) => 1 / (h * h) + V(xi)), e: -1 / (2 * h * h), h }; };
  // Sturm 序列：小于 λ 的本征值个数
  M.countBelow = (d, e, lam) => {
    let q = d[0] - lam, c = q < 0 ? 1 : 0;
    for (let i = 1; i < d.length; i++) { q = d[i] - lam - (e * e) / (q === 0 ? 1e-300 : q); if (q < 0) c++; }
    return c;
  };
  M.eigenvalue = (d, e, k) => {
    let lo = Math.min(...d) - 2 * Math.abs(e), hi = Math.max(...d) + 2 * Math.abs(e);
    for (let it = 0; it < 200 && hi - lo > 1e-12 * Math.max(1, Math.abs(hi)); it++) { const mid = (lo + hi) / 2; if (M.countBelow(d, e, mid) > k) hi = mid; else lo = mid; }
    return (lo + hi) / 2;
  };
  // 三对角方程组（Thomas 算法），a、c 是副对角线常数，b 是对角线数组
  const thomas = (a, b, c, r) => {
    const n = b.length, cp = new Float64Array(n), dp = new Float64Array(n), x = new Float64Array(n);
    cp[0] = c / b[0]; dp[0] = r[0] / b[0];
    for (let i = 1; i < n; i++) { const m = b[i] - a * cp[i - 1]; cp[i] = c / m; dp[i] = (r[i] - a * dp[i - 1]) / m; }
    x[n - 1] = dp[n - 1];
    for (let i = n - 2; i >= 0; i--) x[i] = dp[i] - cp[i] * x[i + 1];
    return x;
  };
  M.eigenvector = (d, e, lam, h) => {
    const shift = d.map((v) => v - lam - 1e-9 * Math.max(1, Math.abs(lam)));
    let v = new Float64Array(d.length).map((_, i) => 1 + 0.01 * Math.sin(i));
    for (let it = 0; it < 4; it++) { v = thomas(e, shift, e, v); const s = Math.sqrt(v.reduce((t, y) => t + y * y, 0) * h); v = v.map((y) => y / s); }
    let k = 0; for (let i = 1; i < v.length; i++) if (Math.abs(v[i]) > Math.abs(v[k])) k = i; // 符号约定：从左数第一个波峰朝上
    for (let i = 0; i < v.length; i++) if (Math.abs(v[i]) > 0.2 * Math.abs(v[k])) { if (v[i] < 0) v = v.map((y) => -y); break; }
    return Array.from(v);
  };
  M.states = (kind, p, n = 6, L = 7, N = 700) => {
    const x = M.grid(L, N), V = (xi) => M.potentials[kind](xi, p), { d, e, h } = M.hamiltonian(x, V);
    const out = [];
    for (let k = 0; k < n; k++) { const E = M.eigenvalue(d, e, k); out.push({ E, psi: M.eigenvector(d, e, E, h) }); }
    return { x, V: x.map(V), states: out };
  };
  // 解析能级：谐振子 ω(n+½)，Morse ω(n+½) − ω²(n+½)²/4D，其中 ω = α√(2D)
  M.exact = {
    harmonic: (n, p) => (p.omega ?? 1) * (n + 0.5),
    morse: (n, p) => { const D = p.D ?? 8, w = (p.alpha ?? 0.7) * Math.sqrt(2 * D); return w * (n + 0.5) - (w * (n + 0.5)) ** 2 / (4 * D); },
  };

  // ── 演示 2：隧穿 ────────────────────────────────────────────────────
  M.HB2M = 3.80998; // ħ²/2mₑ，eV·Å²
  M.MASS = { e: 1, mu: 206.768, p: 1836.153, d: 3670.483 }; // 电子、μ 子、质子、氘核，以 mₑ 为单位
  // 方势垒：高 V0（eV）、宽 a（Å），粒子质量 m（mₑ），能量 E（eV）。返回透射率 T。
  M.transmission = (E, V0, a, m) => {
    const c = M.HB2M / m; // ħ²/2m
    if (E <= 0) return 0;
    if (Math.abs(E - V0) < 1e-12) return 1 / (1 + (V0 * a * a) / (4 * c));
    if (E < V0) { const k = Math.sqrt((V0 - E) / c) * a, s = Math.sinh(k); return 1 / (1 + (V0 * V0 * s * s) / (4 * E * (V0 - E))); }
    const k = Math.sqrt((E - V0) / c) * a, s = Math.sin(k);
    return 1 / (1 + (V0 * V0 * s * s) / (4 * E * (E - V0)));
  };
  // WKB 粗估：T ≈ exp(−2κa)
  M.wkb = (E, V0, a, m) => (E >= V0 ? 1 : Math.exp(-2 * Math.sqrt((V0 - E) * m / M.HB2M) * a));

  // 波包（ħ = m = 1）：ψ 是交错存放的复数数组 [re0, im0, re1, im1, …]
  M.packet = (x, x0, k0, sigma) => {
    const h = x[1] - x[0], psi = new Float64Array(2 * x.length);
    for (let i = 0; i < x.length; i++) { const g = Math.exp(-((x[i] - x0) ** 2) / (4 * sigma * sigma)); psi[2 * i] = g * Math.cos(k0 * x[i]); psi[2 * i + 1] = g * Math.sin(k0 * x[i]); }
    const s = Math.sqrt(M.norm(psi, h)); return psi.map((v) => v / s);
  };
  M.norm = (psi, h) => { let s = 0; for (let i = 0; i < psi.length; i += 2) s += psi[i] * psi[i] + psi[i + 1] * psi[i + 1]; return s * h; };
  // Crank–Nicolson：(1 + iHΔt/2) ψ' = (1 − iHΔt/2) ψ，H = −½∂² + V，两端 ψ = 0。返回一个函数，每调用一次走 steps 步。
  M.cnStepper = (x, V, dt) => {
    const n = x.length, h = x[1] - x[0], off = -1 / (2 * h * h), r = dt / 2;
    const bRe = new Float64Array(n).fill(1), bIm = Float64Array.from(x, (_, i) => r * (1 / (h * h) + V[i]));
    const aIm = r * off; // 副对角线 = i·r·off
    const cpRe = new Float64Array(n), cpIm = new Float64Array(n), dRe = new Float64Array(n), dIm = new Float64Array(n);
    // 预先分解：m_i = b_i − a·c'_{i−1}，c'_i = a / m_i（复数运算）
    const mRe = new Float64Array(n), mIm = new Float64Array(n);
    mRe[0] = bRe[0]; mIm[0] = bIm[0];
    { const q = mRe[0] ** 2 + mIm[0] ** 2; cpRe[0] = (aIm * mIm[0]) / q; cpIm[0] = (aIm * mRe[0]) / q; }
    for (let i = 1; i < n; i++) {
      mRe[i] = bRe[i] + aIm * cpIm[i - 1]; mIm[i] = bIm[i] - aIm * cpRe[i - 1];
      const q = mRe[i] ** 2 + mIm[i] ** 2; cpRe[i] = (aIm * mIm[i]) / q; cpIm[i] = (aIm * mRe[i]) / q;
    }
    return (psi, steps = 1) => {
      for (let s = 0; s < steps; s++) {
        // 右端 (1 − iHΔt/2) ψ
        for (let i = 0; i < n; i++) {
          const re = psi[2 * i], im = psi[2 * i + 1];
          let hRe = (1 / (h * h) + V[i]) * re, hIm = (1 / (h * h) + V[i]) * im;
          if (i > 0) { hRe += off * psi[2 * i - 2]; hIm += off * psi[2 * i - 1]; }
          if (i < n - 1) { hRe += off * psi[2 * i + 2]; hIm += off * psi[2 * i + 3]; }
          dRe[i] = re + r * hIm; dIm[i] = im - r * hRe;
        }
        // 前代
        let q = mRe[0] ** 2 + mIm[0] ** 2, pr = (dRe[0] * mRe[0] + dIm[0] * mIm[0]) / q, pi = (dIm[0] * mRe[0] - dRe[0] * mIm[0]) / q;
        dRe[0] = pr; dIm[0] = pi;
        for (let i = 1; i < n; i++) {
          const zr = dRe[i] + aIm * dIm[i - 1], zi = dIm[i] - aIm * dRe[i - 1];
          q = mRe[i] ** 2 + mIm[i] ** 2; dRe[i] = (zr * mRe[i] + zi * mIm[i]) / q; dIm[i] = (zi * mRe[i] - zr * mIm[i]) / q;
        }
        // 回代
        psi[2 * (n - 1)] = dRe[n - 1]; psi[2 * (n - 1) + 1] = dIm[n - 1];
        for (let i = n - 2; i >= 0; i--) {
          const xr = psi[2 * (i + 1)], xi = psi[2 * (i + 1) + 1];
          psi[2 * i] = dRe[i] - (cpRe[i] * xr - cpIm[i] * xi); psi[2 * i + 1] = dIm[i] - (cpRe[i] * xi + cpIm[i] * xr);
        }
      }
      return psi;
    };
  };
  M.weightRight = (x, psi, x1) => { const h = x[1] - x[0]; let s = 0; for (let i = 0; i < x.length; i++) if (x[i] > x1) s += psi[2 * i] ** 2 + psi[2 * i + 1] ** 2; return s * h; };
  // 平面波透射率（ħ = m = 1，势垒高 V0、宽 a），用来对照波包
  M.transmissionAU = (E, V0, a) => M.transmission(E, V0, a, M.HB2M * 2);
  // 波包的平均透射率：∫ T(k²/2) |φ(k)|² dk，φ 是动量空间的高斯（中心 k0，宽 1/2σ）
  M.packetTransmission = (k0, sigma, V0, a) => {
    const sk = 1 / (2 * sigma); let s = 0, w = 0;
    for (let i = -400; i <= 400; i++) { const k = k0 + (i / 100) * sk, g = Math.exp(-((k - k0) ** 2) / (2 * sk * sk)); if (k > 0) s += g * M.transmissionAU(k * k / 2, V0, a); w += g; }
    return s / w;
  };

  // ── 演示 3：Stern–Gerlach 串联 ──────────────────────────────────────
  // 自旋 ½ 在 x–z 平面内沿 θ 方向极化；分析器沿 φ，“上”通道的概率 cos²((θ−φ)/2)。只让“上”通道继续往下走。
  M.pass = (theta, phi) => Math.cos((theta - phi) / 2) ** 2;
  M.chain = (angles) => { let p = 1; for (let i = 1; i < angles.length; i++) p *= M.pass(angles[i - 1], angles[i]); return p; };
  M.runChain = (angles, n, rand) => {
    const counts = new Array(angles.length).fill(0); counts[0] = n;
    for (let k = 0; k < n; k++) { for (let i = 1; i < angles.length; i++) { if (rand() < M.pass(angles[i - 1], angles[i])) counts[i]++; else break; } }
    return counts;
  };

  // ── 演示 4：CHSH ────────────────────────────────────────────────────
  const wrap = (t) => { let d = ((t % (2 * Math.PI)) + 2 * Math.PI) % (2 * Math.PI); if (d > Math.PI) d = 2 * Math.PI - d; return d; };
  M.Eqm = (a, b) => -Math.cos(a - b); // 自旋单态
  M.Elhv = (a, b) => -1 + (2 * wrap(a - b)) / Math.PI; // λ 均匀分布，A = sign cos(a−λ)，B = −sign cos(b−λ)
  M.S = (E, a, a2, b, b2) => E(a, b) - E(a, b2) + E(a2, b) + E(a2, b2);
  M.sampleE = (a, b, n, rand, model = 'qm') => {
    let s = 0;
    for (let k = 0; k < n; k++) {
      if (model === 'qm') { const A = rand() < 0.5 ? 1 : -1; const B = rand() < Math.cos((a - b) / 2) ** 2 ? -A : A; s += A * B; }
      else { const l = rand() * 2 * Math.PI; const A = Math.cos(a - l) >= 0 ? 1 : -1, B = Math.cos(b - l) >= 0 ? -1 : 1; s += A * B; }
    }
    return s / n;
  };

  if (typeof window !== 'undefined') window.MOLASTRIA_QP_MODELS = M;
  if (typeof module !== 'undefined') module.exports = M;
})();
