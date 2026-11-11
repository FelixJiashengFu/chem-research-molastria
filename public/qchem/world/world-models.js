/* 量子世界（游乐场 20）的物理：纯函数，没有 DOM 和 WebGL，tools/play-test.mjs 测。
   单位：原子单位（ħ = mₑ = e = 1，长度是玻尔半径 a₀）。四个场景：
   · 氢原子：ψ_nlm = R_nl(r)·Y_l^m(θ,φ)，含 Condon–Shortley 相位；两个定态叠加时各自按 e^{−iE t} 转。
   · 双缝：两条缝各发出一束柱面波（缝宽 A 的单缝衍射包络 × 1/√r 衰减），屏上的概率 = |ψ₁ + ψ₂|²；
     开着路径探测器时两束不再相干，概率 = |ψ₁|² + |ψ₂|²。
   · 隧穿：一维含时薛定谔方程，Crank–Nicolson 格式（幺正，二阶精度），三对角方程用 Thomas 算法解。
   · 纠缠：自旋单态，Alice 和 Bob 沿平面内的角 a、b 测量，P(相同) = sin²((a−b)/2)，所以 E = −cos(a−b)。 */
(() => {
  'use strict';
  const TAU = Math.PI * 2;

  // 相位 → 颜色（全场统一：0 相位天蓝，π 相位橙红）。c、s 是单位复数的实部和虚部。
  const C1 = Math.cos(1), S1 = Math.sin(1), C6 = Math.cos(0.6), S6 = Math.sin(0.6);
  function phaseRGB(c, s, out) {
    out.r = 0.62 - 0.38 * c;
    out.g = 0.55 + 0.30 * (c * C1 + s * S1);
    out.b = 0.60 + 0.40 * (c * C6 - s * S6);
    return out;
  }

  // ── 氢原子 ──────────────────────────────────────────────────────────
  // 氢的里德伯能量用约化质量修正过的 13.598 eV（无穷重核是 13.606 eV），这样 1s→2p 的 ΔE = 10.199 eV，λ = 121.57 nm，
  // 与观测到的莱曼 α 一致。波函数本身用玻尔半径 a₀（约化质量的修正只有万分之五，画不出来）。
  const RY_EV = 13.598, HC_EV_NM = 1239.842;
  const levelEV = (n) => -RY_EV / (n * n);
  const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
  // 一个分量 c·ψ_nlm（m ≥ 0）：归一化系数里已经乘了权重 c。
  function hComp(n, l, m, c = 1) {
    const k = n - l - 1;
    let pmm = 1;
    for (let i = 1; i <= m; i++) pmm *= -(2 * i - 1);
    return {
      n, l, m, k, al: 2 * l + 1, pmm, E: -0.5 / (n * n),
      norm: c * Math.sqrt(Math.pow(2 / n, 3) * fact(k) / (2 * n * fact(n + l))) * Math.sqrt((2 * l + 1) / (4 * Math.PI) * fact(l - m) / fact(l + m)),
    };
  }
  // R_nl(r)·N·P_l^m(cos θ)（不含 e^{imφ}）。z/r = cos θ。
  function hAmp(cp, z, r) {
    const rho = 2 * r / cp.n;
    let Lk = 1;
    if (cp.k > 0) { // 广义拉盖尔多项式 L_k^{2l+1}(ρ)，三项递推
      let L0 = 1, L1 = 1 + cp.al - rho;
      Lk = L1;
      for (let j = 1; j < cp.k; j++) { Lk = ((2 * j + 1 + cp.al - rho) * L1 - (j + cp.al) * L0) / (j + 1); L0 = L1; L1 = Lk; }
    }
    let rl = 1;
    for (let i = 0; i < cp.l; i++) rl *= rho;
    const ct = z / r;
    let pm = cp.pmm;
    if (cp.m > 0) { const s = Math.sqrt(Math.max(0, 1 - ct * ct)); for (let i = 0; i < cp.m; i++) pm *= s; }
    let P = pm; // 连带勒让德函数 P_l^m，从 P_m^m 向上递推
    if (cp.l > cp.m) {
      let p0 = pm, p1 = ct * (2 * cp.m + 1) * pm;
      P = p1;
      for (let ll = cp.m + 2; ll <= cp.l; ll++) { P = (ct * (2 * ll - 1) * p1 - (ll + cp.m - 1) * p0) / (ll - cp.m); p0 = p1; p1 = P; }
    }
    return cp.norm * Math.exp(-rho / 2) * rl * Lk * P;
  }
  // 各分量在 (x, y, z) 处的复振幅，写进 re[k]、im[k]（t = 0 时）。
  function hEval(comps, x, y, z, re, im) {
    const r = Math.sqrt(x * x + y * y + z * z) + 1e-9, rxy = Math.sqrt(x * x + y * y);
    const cph = rxy > 1e-9 ? x / rxy : 1, sph = rxy > 1e-9 ? y / rxy : 0;
    for (let k = 0; k < comps.length; k++) {
      const c = comps[k], A = hAmp(c, z, r);
      let cr = 1, ci = 0;
      for (let i = 0; i < c.m; i++) { const t = cr * cph - ci * sph; ci = cr * sph + ci * cph; cr = t; }
      re[k] = A * cr; im[k] = A * ci;
    }
  }
  // 预设：单个定态，或两个定态的等权叠加（每个分量的权重 1/√2）。
  const H_PRESETS = [
    { id: '1s', c: [[1, 0, 0]] }, { id: '2s', c: [[2, 0, 0]] }, { id: '2pz', c: [[2, 1, 0]] }, { id: '2p1', c: [[2, 1, 1]] },
    { id: '3pz', c: [[3, 1, 0]] }, { id: '3dz', c: [[3, 2, 0]] }, { id: '3d1', c: [[3, 2, 1]] }, { id: '4f', c: [[4, 3, 0]] },
    { id: 'sp', c: [[1, 0, 0], [2, 1, 0]] }, { id: 'ss', c: [[1, 0, 0], [2, 0, 0]] },
  ];
  const hComps = (preset) => { const w = 1 / Math.sqrt(preset.c.length); return preset.c.map((c) => hComp(c[0], c[1], c[2], w)); };
  const lyman = () => { const dE = levelEV(2) - levelEV(1); return { dE, nm: HC_EV_NM / dE }; };

  // ── 双缝 ────────────────────────────────────────────────────────────
  // 几何（场景单位）：源在 SX，缝屏在 BX，探测屏在 EX；缝间距 D，缝宽 A，波长 LAM。
  const SLIT = { SX: -24, BX: -6, EX: 22, ZW: 18, D: 10, A: 2, LAM: 2 };
  const sinc = (x) => Math.abs(x) < 1e-6 ? 1 : Math.sin(x) / x;
  // 一条缝在 (dx, dz) 处的振幅：单缝衍射包络（sin θ ≈ dz/r）乘柱面波的 1/√r 衰减（近处截断）。
  const slitAmp = (dx, dz) => { const r = Math.hypot(dx, dz); return sinc(Math.PI * SLIT.A * dz / r / SLIT.LAM) * Math.sqrt(3 / (r + 3)); };
  // 屏上 NB 个格子的概率：相干 Ic，以及两条缝各自的 I1、I2。
  function slitScreen(NB = 720) {
    const { BX, EX, ZW, D, LAM } = SLIT, L = EX - BX, K = TAU / LAM, Z1 = D / 2, Z2 = -D / 2;
    const Ic = new Float64Array(NB), I1 = new Float64Array(NB), I2 = new Float64Array(NB), z = new Float64Array(NB);
    for (let b = 0; b < NB; b++) {
      const zz = -ZW + (b + 0.5) * (2 * ZW / NB), a1 = slitAmp(L, zz - Z1), a2 = slitAmp(L, zz - Z2);
      const ph = K * (Math.hypot(L, zz - Z1) - Math.hypot(L, zz - Z2));
      z[b] = zz; I1[b] = a1 * a1; I2[b] = a2 * a2; Ic[b] = a1 * a1 + a2 * a2 + 2 * a1 * a2 * Math.cos(ph);
    }
    return { z, Ic, I1, I2 };
  }

  // ── 隧穿：Crank–Nicolson ────────────────────────────────────────────
  // (1 + i dt H/2) ψⁿ⁺¹ = (1 − i dt H/2) ψⁿ，H = −½ d²/dx² + V，两端 ψ = 0。
  // 波包 k₀ = 2（E = 2 Ha），势垒高度 v0·E、宽度 w，中心在 XB。
  const TUN = { N: 1200, DX: 0.1, DT: 0.04, XB: 60, K0: 2, SIG: 4, X0: 30, TM: 30 };
  function tunnel(opt = {}) {
    const P = { ...TUN, ...opt }, { N, DX, DT, XB, K0, SIG, X0 } = P, E0 = K0 * K0 / 2, RC = DT / (4 * DX * DX);
    const re = new Float64Array(N), im = new Float64Array(N), V = new Float64Array(N), beta = new Float64Array(N);
    const cpr = new Float64Array(N), cpi = new Float64Array(N), ivr = new Float64Array(N), ivi = new Float64Array(N), dr = new Float64Array(N), di = new Float64Array(N);
    let v0 = 1.4, w = 1, j0 = 0, nb = 0;
    // 势垒占整数个格点：nb = round(w/DX) 个，宽度正好是 nb·DX。（写成 |x − XB| ≤ w/2 的话两端各多算半格，
    // w = 1 时实际宽 1.1，透射率差出两成多。）
    function build(nv0 = v0, nw = w) { // 预先做好 Thomas 算法的前向消元（与 ψ 无关）
      v0 = nv0; nb = Math.max(1, Math.round(nw / DX)); w = nb * DX; j0 = Math.round(XB / DX) - (nb >> 1);
      for (let j = 0; j < N; j++) {
        V[j] = j >= j0 && j < j0 + nb ? v0 * E0 : 0;
        beta[j] = 2 * RC + DT * V[j] / 2;
        let a, b;
        if (j === 0) { a = 1; b = beta[0]; } else { a = 1 - RC * cpi[j - 1]; b = beta[j] + RC * cpr[j - 1]; }
        const q = 1 / (a * a + b * b);
        ivr[j] = a * q; ivi[j] = -b * q; cpr[j] = RC * ivi[j]; cpi[j] = -RC * ivr[j];
      }
    }
    function launch() { // 归一化的高斯波包
      const nrm = Math.pow(2 * Math.PI * SIG * SIG, -0.25);
      for (let j = 0; j < N; j++) { const x = j * DX, g = nrm * Math.exp(-(x - X0) * (x - X0) / (4 * SIG * SIG)); re[j] = g * Math.cos(K0 * x); im[j] = g * Math.sin(K0 * x); }
    }
    function step() {
      for (let j = 0; j < N; j++) {
        const b = beta[j], sr = (j > 0 ? re[j - 1] : 0) + (j < N - 1 ? re[j + 1] : 0), si = (j > 0 ? im[j - 1] : 0) + (j < N - 1 ? im[j + 1] : 0);
        dr[j] = re[j] + b * im[j] - RC * si; di[j] = im[j] - b * re[j] + RC * sr;
      }
      let pr = dr[0] * ivr[0] - di[0] * ivi[0], pi = dr[0] * ivi[0] + di[0] * ivr[0];
      dr[0] = pr; di[0] = pi;
      for (let j = 1; j < N; j++) { const tr = dr[j] - RC * pi, ti = di[j] + RC * pr; pr = tr * ivr[j] - ti * ivi[j]; pi = tr * ivi[j] + ti * ivr[j]; dr[j] = pr; di[j] = pi; }
      re[N - 1] = dr[N - 1]; im[N - 1] = di[N - 1];
      for (let j = N - 2; j >= 0; j--) { const xr = re[j + 1], xi = im[j + 1]; re[j] = dr[j] - (cpr[j] * xr - cpi[j] * xi); im[j] = di[j] - (cpr[j] * xi + cpi[j] * xr); }
    }
    const norm = () => { let p = 0; for (let j = 0; j < N; j++) p += re[j] * re[j] + im[j] * im[j]; return p * DX; };
    const pRight = () => { let p = 0; for (let j = j0 + nb; j < N; j++) p += re[j] * re[j] + im[j] * im[j]; return p * DX; };
    // 测量之后的“塌缩”：每步把没被选中的一侧压低 22%，再归一化（动画用的示意，不是一个物理过程）。
    function squeeze(through) {
      let n = 0;
      for (let j = 0; j < N; j++) { const s = 1 / (1 + Math.exp(-(j * DX - XB) / 1.2)), f = 1 - 0.22 * (through ? 1 - s : s); re[j] *= f; im[j] *= f; n += re[j] * re[j] + im[j] * im[j]; }
      n = 1 / Math.sqrt(n * DX);
      for (let j = 0; j < N; j++) { re[j] *= n; im[j] *= n; }
    }
    build(); launch();
    return { P, E0, re, im, V, build, launch, step, norm, pRight, squeeze, get v0() { return v0; }, get w() { return w; }, get left() { return j0 * DX; }, get right() { return (j0 + nb) * DX; } };
  }
  // 平面波透过方势垒的透射率（ħ = m = 1）。E 是动能，Vb 是势垒高度。
  function transmission(E, Vb, w) {
    if (Math.abs(Vb - E) < 1e-9) return 1 / (1 + E * w * w / 2);
    if (E < Vb) { const k = Math.sqrt(2 * (Vb - E)), s = Math.sinh(k * w); return 1 / (1 + Vb * Vb * s * s / (4 * E * (Vb - E))); }
    const k = Math.sqrt(2 * (E - Vb)), s = Math.sin(k * w);
    return 1 / (1 + Vb * Vb * s * s / (4 * E * (E - Vb)));
  }
  // 高斯波包（动量宽度 σ_k = 1/(2σ)）对透射率的平均：∫ T(k²/2) |φ(k)|² dk。
  function packetTransmission(Vb, w, k0 = TUN.K0, sig = TUN.SIG, n = 2001) {
    const sk = 1 / (2 * sig);
    let s = 0, wsum = 0;
    for (let i = 0; i < n; i++) {
      const k = k0 + (i / (n - 1) * 2 - 1) * 6 * sk;
      if (k <= 0) continue;
      const g = Math.exp(-(k - k0) * (k - k0) / (2 * sk * sk));
      s += g * transmission(k * k / 2, Vb, w); wsum += g;
    }
    return s / wsum;
  }

  // ── 纠缠：单态 ──────────────────────────────────────────────────────
  // 一对粒子的结果。rand 是 [0,1) 的随机数函数。Alice 的结果纯随机；Bob 与她相同的概率 sin²((a−b)/2)。
  function singlet(a, b, rand) {
    const A = rand() < 0.5 ? 1 : -1, s = Math.sin((a - b) / 2), B = rand() < s * s ? A : -A;
    return [A, B];
  }
  const correlation = (d) => -Math.cos(d);
  // CHSH：Alice 用 0 和 π/2，Bob 用 π/4 和 3π/4；S = E(a,b) − E(a,b′) + E(a′,b) + E(a′,b′)，量子是 −2√2。
  const CHSH = { A: [0, Math.PI / 2], B: [Math.PI / 4, 3 * Math.PI / 4], sign: [1, -1, 1, 1] };
  const chshS = () => CHSH.sign.reduce((s, g, idx) => s + g * correlation(CHSH.A[idx >> 1] - CHSH.B[idx & 1]), 0);
  // 一个确定性的局域模型（结果只看自己的角度：sign cos(角 − λ)，λ 均匀分布）给出的相关是直线 −1 + 2θ/π，
  // 它在 CHSH 角上刚好顶到 |S| = 2。
  const linearModel = (d) => { d = Math.abs(d) % TAU; if (d > Math.PI) d = TAU - d; return -1 + 2 * d / Math.PI; };

  window.MOLASTRIA_WORLD = {
    TAU, phaseRGB,
    RY_EV, levelEV, hComp, hAmp, hEval, H_PRESETS, hComps, lyman,
    SLIT, slitAmp, slitScreen,
    TUN, tunnel, transmission, packetTransmission,
    singlet, correlation, CHSH, chshS, linearModel,
  };
})();
