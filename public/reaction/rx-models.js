'use strict';
// 反应动力学与过渡态（/reaction/）演示背后的数学：纯函数，没有 DOM。tools/reaction-test.mjs 对照解析解、已知值和独立的数值解测这里的每一个函数。
// 页面里 rx-demos.js 经 window.MOLASTRIA_RXN_MODELS 拿到它们。
// 势能面用 Müller–Brown 模型势（1979 年的论文给出的四个高斯项），所以“驻点在哪里”有公认的答案可以对照；
// 速率常数照 Eyring 公式、RRKM 照 Beyer–Swinehart 数态、隧穿照 Eckart 的解析透射系数（测试里另用数值解 Schrödinger 方程核对）、
// 动力学用催化循环的精确稳态（线性方程组），能量跨度模型的公式和它逐位对照。
(() => {
  // ── 常数（SI，2019 年定义值）────────────────────────────────────
  const KB = 1.380649e-23, H = 6.62607015e-34, NA = 6.02214076e23, R = KB * NA, C_CM = 2.99792458e10; // c 用 cm/s
  const HCK = (H * C_CM) / KB; // hc/k = 1.438777 cm·K：波数换温度
  const KJ_PER_CM = (H * C_CM * NA) / 1000; // 1 cm⁻¹ = 0.0119627 kJ/mol
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gauss = (rand) => { let u = 0, v = 0; while (u === 0) u = rand(); while (v === 0) v = rand(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * v); };

  // ── 第一、二章：Müller–Brown 势能面 ─────────────────────────────
  // V(x, y) = Σ A_k exp[a_k (x − x0_k)² + b_k (x − x0_k)(y − y0_k) + c_k (y − y0_k)²]，参数照 Müller & Brown 1979。
  const MB = { A: [-200, -100, -170, 15], a: [-1, -1, -6.5, 0.7], b: [0, 0, 11, 0.6], c: [-10, -10, -6.5, 0.7], x0: [1, 0, -0.5, -1], y0: [0, 0.5, 1.5, 1] };
  function mbAll(x, y) {
    let v = 0, gx = 0, gy = 0, hxx = 0, hxy = 0, hyy = 0;
    for (let k = 0; k < 4; k++) {
      const dx = x - MB.x0[k], dy = y - MB.y0[k], a = MB.a[k], b = MB.b[k], c = MB.c[k];
      const t = MB.A[k] * Math.exp(a * dx * dx + b * dx * dy + c * dy * dy), qx = 2 * a * dx + b * dy, qy = b * dx + 2 * c * dy;
      v += t; gx += t * qx; gy += t * qy; hxx += t * (qx * qx + 2 * a); hxy += t * (qx * qy + b); hyy += t * (qy * qy + 2 * c);
    }
    return { v, g: [gx, gy], h: [[hxx, hxy], [hxy, hyy]] };
  }
  const mb = (x, y) => mbAll(x, y).v;
  const mbGrad = (x, y) => mbAll(x, y).g;
  // 2 × 2 对称矩阵的本征值（升序）和对应的单位本征向量
  function eig2([[a, b], [, d]]) {
    const m = (a + d) / 2, r = Math.hypot((a - d) / 2, b), l1 = m - r, l2 = m + r;
    const vec = (l) => { let v = Math.abs(b) > 1e-14 ? [b, l - a] : (Math.abs(a - l) < Math.abs(d - l) ? [1, 0] : [0, 1]); const n = Math.hypot(v[0], v[1]); return [v[0] / n, v[1] / n]; };
    return { vals: [l1, l2], vecs: [vec(l1), vec(l2)] };
  }
  // 从 (x, y) 出发用 Newton 法找梯度为零的点（极小、鞍点都行）；步长限制在 0.05 以内防止跳太远
  function stationary(x, y, it = 200) {
    for (let i = 0; i < it; i++) {
      const { g, h } = mbAll(x, y), det = h[0][0] * h[1][1] - h[0][1] * h[1][0];
      if (Math.hypot(g[0], g[1]) < 1e-10) break;
      let dx = -(h[1][1] * g[0] - h[0][1] * g[1]) / det, dy = -(-h[1][0] * g[0] + h[0][0] * g[1]) / det;
      const n = Math.hypot(dx, dy); if (n > 0.05) { dx *= 0.05 / n; dy *= 0.05 / n; }
      x += dx; y += dy;
    }
    const { v, g, h } = mbAll(x, y), e = eig2(h);
    return { x, y, v, grad: Math.hypot(g[0], g[1]), index: e.vals.filter((l) => l < 0).length, eig: e.vals };
  }
  // 论文里的五个驻点（坐标、能量取到论文的位数），测试核对 Newton 法从附近出发都能落回来
  const MB_POINTS = [
    { id: 'MA', kind: 'min', x: -0.558, y: 1.442, v: -146.70 },
    { id: 'MB', kind: 'min', x: 0.623, y: 0.028, v: -108.17 },
    { id: 'MC', kind: 'min', x: -0.050, y: 0.467, v: -80.77 },
    { id: 'S1', kind: 'ts', x: -0.822, y: 0.624, v: -40.66 },
    { id: 'S2', kind: 'ts', x: 0.212, y: 0.293, v: -72.25 },
  ];
  // 最速下降：从 (x, y) 沿 −∇V 走，每步弧长 ds（RK4），直到梯度很小或走满 nmax 步
  function descend(x, y, ds = 0.004, nmax = 4000, gtol = 0.5) {
    const dir = (p) => { const g = mbGrad(p[0], p[1]), n = Math.hypot(g[0], g[1]) || 1; return [-g[0] / n, -g[1] / n]; };
    const pts = [[x, y]];
    let p = [x, y];
    for (let i = 0; i < nmax; i++) {
      const k1 = dir(p), k2 = dir([p[0] + (ds / 2) * k1[0], p[1] + (ds / 2) * k1[1]]), k3 = dir([p[0] + (ds / 2) * k2[0], p[1] + (ds / 2) * k2[1]]), k4 = dir([p[0] + ds * k3[0], p[1] + ds * k3[1]]);
      const q = [p[0] + (ds / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), p[1] + (ds / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
      if (mb(q[0], q[1]) > mb(p[0], p[1])) break; // 已经到底，再走就上坡了
      p = q; pts.push(p);
      const g = mbGrad(p[0], p[1]); if (Math.hypot(g[0], g[1]) < gtol) break;
    }
    return pts;
  }
  // IRC（这里质量都取 1，所以就是从鞍点出发的最速下降路径）：沿负曲率方向两边各推一小步再下山，返回整条路径和弧长
  function irc(ts, push = 0.01, ds = 0.004) {
    const { h } = mbAll(ts.x, ts.y), v = eig2(h).vecs[0];
    const a = descend(ts.x - push * v[0], ts.y - push * v[1], ds), b = descend(ts.x + push * v[0], ts.y + push * v[1], ds);
    const pts = [...a.reverse(), [ts.x, ts.y], ...b];
    let s = 0;
    const out = pts.map((p, i) => { if (i) s += Math.hypot(p[0] - pts[i - 1][0], p[1] - pts[i - 1][1]); return { x: p[0], y: p[1], s, v: mb(p[0], p[1]) }; });
    const s0 = out[a.length].s; out.forEach((p) => { p.s -= s0; });
    return out;
  }

  // ── 第二章：微动弹性带（NEB）和爬坡像（CI-NEB）──────────────────
  // 切线用 Henkelman & Jónsson 2000 的“改进的切线”；弹簧力只取沿切线的分量，真实的力只取垂直切线的分量；
  // 爬坡像去掉弹簧，把沿切线的真实力反过来。优化器是 quick-min（速度只保留沿力的分量）。
  function nebInit(a, b, n) { return Array.from({ length: n }, (_, i) => [a[0] + ((b[0] - a[0]) * i) / (n - 1), a[1] + ((b[1] - a[1]) * i) / (n - 1)]); }
  function nebForces(img, { k = 300, climb = false } = {}) {
    const n = img.length, E = img.map((p) => mb(p[0], p[1])), F = img.map(() => [0, 0]);
    let top = 1; for (let i = 2; i < n - 1; i++) if (E[i] > E[top]) top = i;
    let fmax = 0;
    for (let i = 1; i < n - 1; i++) {
      const tp = [img[i + 1][0] - img[i][0], img[i + 1][1] - img[i][1]], tm = [img[i][0] - img[i - 1][0], img[i][1] - img[i - 1][1]];
      let t;
      if (E[i + 1] > E[i] && E[i] > E[i - 1]) t = tp;
      else if (E[i + 1] < E[i] && E[i] < E[i - 1]) t = tm;
      else {
        const dmax = Math.max(Math.abs(E[i + 1] - E[i]), Math.abs(E[i - 1] - E[i])), dmin = Math.min(Math.abs(E[i + 1] - E[i]), Math.abs(E[i - 1] - E[i]));
        t = E[i + 1] > E[i - 1] ? [tp[0] * dmax + tm[0] * dmin, tp[1] * dmax + tm[1] * dmin] : [tp[0] * dmin + tm[0] * dmax, tp[1] * dmin + tm[1] * dmax];
      }
      const tn = Math.hypot(t[0], t[1]) || 1; t = [t[0] / tn, t[1] / tn];
      const g = mbGrad(img[i][0], img[i][1]), gt = g[0] * t[0] + g[1] * t[1];
      if (climb && i === top) F[i] = [-g[0] + 2 * gt * t[0], -g[1] + 2 * gt * t[1]];
      else {
        const sp = k * (Math.hypot(tp[0], tp[1]) - Math.hypot(tm[0], tm[1]));
        F[i] = [-(g[0] - gt * t[0]) + sp * t[0], -(g[1] - gt * t[1]) + sp * t[1]];
      }
      fmax = Math.max(fmax, Math.hypot(-(g[0] - gt * t[0]), -(g[1] - gt * t[1])), climb && i === top ? Math.hypot(g[0], g[1]) : 0);
    }
    return { F, E, top, fmax };
  }
  // 走 steps 步；st 是 { img, vel }，原地更新并返回最后一步的力
  function nebRun(st, steps, { k = 300, climb = false, dt = 0.002, maxStep = 0.02 } = {}) {
    st.vel ||= st.img.map(() => [0, 0]);
    let f = nebForces(st.img, { k, climb });
    for (let s = 0; s < steps; s++) {
      for (let i = 1; i < st.img.length - 1; i++) {
        const Fi = f.F[i], fn = Math.hypot(Fi[0], Fi[1]) || 1, vf = st.vel[i][0] * Fi[0] + st.vel[i][1] * Fi[1];
        st.vel[i] = vf > 0 ? [(vf / fn) * (Fi[0] / fn), (vf / fn) * (Fi[1] / fn)] : [0, 0];
        st.vel[i][0] += Fi[0] * dt; st.vel[i][1] += Fi[1] * dt;
        let dx = st.vel[i][0] * dt, dy = st.vel[i][1] * dt; const d = Math.hypot(dx, dy);
        if (d > maxStep) { dx *= maxStep / d; dy *= maxStep / d; }
        st.img[i][0] += dx; st.img[i][1] += dy;
      }
      f = nebForces(st.img, { k, climb });
    }
    return f;
  }

  // ── 第一章：Hammond 假说、Bell–Evans–Polanyi 和 Marcus 理论 ────
  // 两条一样弯的抛物线：反应物 V_R = λ x²，产物 V_P = λ (x − 1)² + ΔG°。交点 x‡ = ½ + ΔG°/(2λ)，势垒 ΔG‡ = (λ + ΔG°)²/(4λ)。
  const marcusBarrier = (lam, dG) => ((lam + dG) ** 2) / (4 * lam);
  const crossing = (lam, dG) => 0.5 + dG / (2 * lam);
  const leffler = (lam, dG) => 0.5 + dG / (2 * lam); // dΔG‡/dΔG°：BEP 的斜率，正好等于过渡态的位置 x‡
  const parabolas = (lam, dG, x) => [lam * x * x, lam * (x - 1) ** 2 + dG];

  // ── 第三章：Eyring 公式 ─────────────────────────────────────────
  // k = κ (k_B T / h) exp(−ΔG‡/RT)，能量用 kJ/mol；一级反应的半衰期 ln2 / k
  const kTh = (T) => (KB * T) / H;
  const eyring = (dG, T, kappa = 1) => kappa * kTh(T) * Math.exp((-dG * 1000) / (R * T));
  const eyringHS = (dH, dS, T, kappa = 1) => eyring(dH - (T * dS) / 1000, T, kappa); // ΔH‡ kJ/mol，ΔS‡ J/(mol K)
  const barrierFor = (k, T) => (R * T * Math.log(kTh(T) / k)) / 1000; // 反过来：给定速率常数要多高的 ΔG‡
  const halfLife = (k) => Math.LN2 / k;
  // 单分子（溶液中）反应的 Arrhenius 参数：Ea = ΔH‡ + RT，A = e (k_B T/h) exp(ΔS‡/R)
  const arrheniusOf = (dH, dS, T) => ({ Ea: dH + (R * T) / 1000, A: Math.E * kTh(T) * Math.exp(dS / R) });
  // 最小二乘直线 y = a + b x，附斜率和截距的标准误
  function lineFit(xs, ys) {
    const n = xs.length, mx = xs.reduce((s, v) => s + v, 0) / n, my = ys.reduce((s, v) => s + v, 0) / n;
    let sxx = 0, sxy = 0; for (let i = 0; i < n; i++) { sxx += (xs[i] - mx) ** 2; sxy += (xs[i] - mx) * (ys[i] - my); }
    const b = sxy / sxx, a = my - b * mx, res = ys.reduce((s, y, i) => s + (y - a - b * xs[i]) ** 2, 0), s2 = n > 2 ? res / (n - 2) : 0;
    return { a, b, sb: Math.sqrt(s2 / sxx), sa: Math.sqrt(s2 * (1 / n + (mx * mx) / sxx)), cov: (-mx * s2) / sxx };
  }
  // 由 (T, k) 拟合 Eyring 图 ln(k/T) = ln(k_B/h) + ΔS‡/R − ΔH‡/(R T) 和 Arrhenius 图 ln k = ln A − Ea/(R T)
  function eyringFit(Ts, ks) {
    const f = lineFit(Ts.map((T) => 1 / T), ks.map((k, i) => Math.log(k / Ts[i])));
    return { dH: (-f.b * R) / 1000, dS: (f.a - Math.log(KB / H)) * R, sH: (f.sb * R) / 1000, sS: f.sa * R, corr: -f.cov / (f.sa * f.sb), fit: f };
  }
  function arrheniusFit(Ts, ks) { const f = lineFit(Ts.map((T) => 1 / T), ks.map(Math.log)); return { Ea: (-f.b * R) / 1000, lnA: f.a }; }
  // 合成的“实验”：真值 ΔH‡、ΔS‡，几个温度，每个 ln k 加上相对误差 noise（高斯）
  function fakeKinetics(dH, dS, T0, T1, n, noise, seed) {
    const rand = rng(seed), Ts = Array.from({ length: n }, (_, i) => T0 + ((T1 - T0) * i) / (n - 1));
    return { Ts, ks: Ts.map((T) => eyringHS(dH, dS, T) * Math.exp(noise * gauss(rand))) };
  }

  // ── 第四章：RRKM ────────────────────────────────────────────────
  // Beyer–Swinehart：谐振子的能级数，能量按 grain（cm⁻¹）分格；返回每一格里的状态数（态密度 × grain）
  function beyerSwinehart(freqs, emax, grain = 1) {
    const n = Math.floor(emax / grain) + 1, t = new Float64Array(n); t[0] = 1;
    for (const f of freqs) { const s = Math.max(1, Math.round(f / grain)); for (let j = s; j < n; j++) t[j] += t[j - s]; }
    return t;
  }
  const cumsum = (a) => { const o = new Float64Array(a.length); let s = 0; for (let i = 0; i < a.length; i++) { s += a[i]; o[i] = s; } return o; };
  // 用三重循环直接数（只给测试用，振子少、能量小时）
  function bruteCount(freqs, emax) { let n = 0; const go = (i, e) => { if (i === freqs.length) { n++; return; } for (let v = 0; e + v * freqs[i] <= emax; v++) go(i + 1, e + v * freqs[i]); }; go(0, 0); return n; }
  // 微正则速率 k(E) = σ N‡(E − E0) / (h ρ(E))。能量都以 cm⁻¹ 计、从零点能算起，此时 k = σ c N‡ / ρ（ρ 是每 cm⁻¹ 的状态数）。
  // 分格以后很多格是空的（频率有公约数时尤其明显），微正则的 k(E) 在空格上没有意义：先把态密度做一个宽 smooth（cm⁻¹）的滑动平均，总状态数不变。
  function smoothCounts(t, w) {
    if (w <= 1) return t;
    const n = t.length, c = cumsum(t), o = new Float64Array(n), h = Math.floor(w / 2);
    for (let j = 0; j < n; j++) { const a = Math.max(0, j - h), b = Math.min(n - 1, j + h); o[j] = (c[b] - (a ? c[a - 1] : 0)) / (b - a + 1); }
    return o;
  }
  function rrkm({ freqs, tsFreqs, E0, emax, grain = 10, sigma = 1, smooth = 250 }) {
    const raw = beyerSwinehart(freqs, emax, grain), rho = smoothCounts(raw, Math.round(smooth / grain)), Nts = cumsum(beyerSwinehart(tsFreqs, emax, grain)), n = rho.length, k = new Float64Array(n), j0 = Math.round(E0 / grain);
    // ρ（每 cm⁻¹）= rho[j]/grain，N‡ 是个数；k = σ c N‡ / (rho/grain)，写开就是 σ c N‡ grain / rho
    for (let j = j0; j < n; j++) k[j] = rho[j] > 0 ? (sigma * C_CM * Nts[j - j0] * grain) / rho[j] : 0;
    return { grain, E: Array.from({ length: n }, (_, j) => j * grain), rho, raw, Nts, k };
  }
  // 经典 RRK / 经典 RRKM：k = σ c (Πν / Πν‡) ((E − E0)/E)^(s−1)
  function rrkClassical(freqs, tsFreqs, E0, E, sigma = 1) {
    if (E <= E0) return 0;
    const s = freqs.length, ratio = freqs.reduce((p, v) => p * v, 1) / tsFreqs.reduce((p, v) => p * v, 1);
    return sigma * C_CM * ratio * ((E - E0) / E) ** (s - 1);
  }
  const qvib = (freqs, T) => freqs.reduce((q, f) => q / (1 - Math.exp((-HCK * f) / T)), 1); // 从零点能算起
  const tstHarmonic = ({ freqs, tsFreqs, E0, sigma = 1 }, T) => sigma * kTh(T) * (qvib(tsFreqs, T) / qvib(freqs, T)) * Math.exp((-HCK * E0) / T);
  // 强碰撞假设下的热速率常数：k_uni = Σ k(E) P(E) / (1 + k(E)/ω)，P(E) 是玻尔兹曼分布，ω 是碰撞频率（s⁻¹）
  function falloff(r, T, omega) {
    let Q = 0, num = 0, low = 0;
    for (let j = 0; j < r.rho.length; j++) {
      const p = r.rho[j] * Math.exp((-HCK * r.E[j]) / T); Q += p;
      if (r.k[j] > 0) { num += (r.k[j] * p) / (1 + r.k[j] / omega); low += p; }
    }
    let inf = 0; for (let j = 0; j < r.rho.length; j++) if (r.k[j] > 0) inf += r.k[j] * r.rho[j] * Math.exp((-HCK * r.E[j]) / T);
    return { k: num / Q, kinf: inf / Q, k0: (omega * low) / Q };
  }
  const lindemann = (kinf, k0) => (kinf * k0) / (kinf + k0); // k0 是低压极限 k₀[M]（s⁻¹）
  // 碰撞频率：ω = β_c k_c [M]，[M] = p / (k_B T)；k_c 取气体动理学量级 2 × 10⁻¹⁰ cm³ s⁻¹
  const collisionRate = (pPa, T, beta = 1, kc = 2e-10) => beta * kc * (pPa / (KB * T)) * 1e-6;
  // 演示用的“玩具分子”：9 个振动模式；过渡态少一个模式（变成反应坐标），其余几个变软。不是任何真实分子。
  const TOY = { freqs: [3000, 2950, 1500, 1450, 1200, 1000, 900, 600, 400], tsFreqs: [3000, 2950, 1450, 1400, 1100, 800, 500, 300], E0: 20000 };

  // ── 第五章：隧穿（Eckart 势垒、Wigner、Bell）────────────────────
  // 无量纲单位：能量以 ħω‡ 为单位，长度以 √(ħ/(mω‡)) 为单位，势垒顶的曲率因此是 −1。
  // V(x) = A y/(1+y) + B y/(1+y)²，y = e^{x/L}；左边（反应物）V → 0，右边 V → A。V1 是从左边量的势垒高，V2 从右边量。
  function eckart(V1, V2) {
    const A = V1 - V2, B = (Math.sqrt(V1) + Math.sqrt(V2)) ** 2;
    const Vu = (x) => { const y = Math.exp(x); return (A * y) / (1 + y) + (B * y) / (1 + y) ** 2; }; // L = 1
    // 势垒顶：y* = (B + A)/(B − A)（A ≠ B），在 L = 1 时用有限差分求曲率，再按曲率 = −1 定出 L
    const xs = Math.log((B + A) / (B - A)), hh = 1e-4, curv = (Vu(xs + hh) - 2 * Vu(xs) + Vu(xs - hh)) / (hh * hh), L = Math.sqrt(-curv);
    const V = (x) => Vu(x / L);
    // Eckart 1930 的解析透射系数：a = L k_左，b = L k_右，d = ½√(8BL² − 1)（ħ = m = 1）
    const P = (E) => {
      if (E <= 0 || E <= A) return 0;
      const a = L * Math.sqrt(2 * E), b = L * Math.sqrt(2 * (E - A)), dd = 8 * B * L * L - 1;
      // P = (cosh p − cosh m)/(cosh p + cosh D)；p、D 可以上千，直接算 cosh 会溢出，所以先提出 e^{max(p, D)}
      const p = 2 * Math.PI * (a + b), m = Math.abs(2 * Math.PI * (a - b)), ch = (z, M) => Math.exp(z - M) * (1 + Math.exp(-2 * z)) / 2;
      if (dd >= 0) { const D = Math.PI * Math.sqrt(dd), M = Math.max(p, D); return (ch(p, M) - ch(m, M)) / (ch(p, M) + ch(D, M)); }
      return (ch(p, p) - ch(m, p)) / (ch(p, p) + Math.cos(Math.PI * Math.sqrt(-dd)) * Math.exp(-p));
    };
    return { A, B, L, V, P, top: xs * L };
  }
  // 热平均的隧穿因子 κ(T) = β e^{βV1} ∫ P(E) e^{−βE} dE（经典的阶跃 P 给出 1）；beta 以 1/ħω‡ 为单位
  function kappaEckart(V1, V2, beta, n = 4000) {
    const ek = eckart(V1, V2), e0 = Math.max(0, ek.A), e1 = V1 + 40 / beta, h = (e1 - e0) / n;
    let s = 0;
    for (let i = 0; i <= n; i++) { const E = e0 + i * h, w = i === 0 || i === n ? 0.5 : 1; s += w * ek.P(E) * Math.exp(-beta * (E - V1)); }
    return beta * s * h;
  }
  const kappaWigner = (u) => 1 + (u * u) / 24; // u = ħω‡/(k_B T) = hcν‡/(k_B T)
  const kappaBell = (u) => (u < 2 * Math.PI ? u / 2 / Math.sin(u / 2) : Infinity); // 无限抛物线势垒；u ≥ 2π 时发散
  const uOf = (nuCm, T) => (HCK * nuCm) / T;
  // 数值核对用：把 −½ψ″ + Vψ = Eψ 从右往左用 RK4 积出来（右边只有透射波），读出入射波的振幅，T = (k_右/k_左)/|入射|²
  function transmitNumeric(V, E, A, xl, xr, n = 20000) {
    const kL = Math.sqrt(2 * E), kR = Math.sqrt(2 * (E - A)), h = (xl - xr) / n;
    let x = xr, re = Math.cos(kR * xr), im = Math.sin(kR * xr), dre = -kR * im, dim = kR * re; // ψ = e^{ik x}，ψ′ = ik ψ
    const f = (xx, a, b, c, d) => { const w = 2 * (V(xx) - E); return [c, d, w * a, w * b]; };
    for (let i = 0; i < n; i++) {
      const k1 = f(x, re, im, dre, dim), k2 = f(x + h / 2, re + (h / 2) * k1[0], im + (h / 2) * k1[1], dre + (h / 2) * k1[2], dim + (h / 2) * k1[3]);
      const k3 = f(x + h / 2, re + (h / 2) * k2[0], im + (h / 2) * k2[1], dre + (h / 2) * k2[2], dim + (h / 2) * k2[3]), k4 = f(x + h, re + h * k3[0], im + h * k3[1], dre + h * k3[2], dim + h * k3[3]);
      re += (h / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]); im += (h / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1]);
      dre += (h / 6) * (k1[2] + 2 * k2[2] + 2 * k3[2] + k4[2]); dim += (h / 6) * (k1[3] + 2 * k2[3] + 2 * k3[3] + k4[3]);
      x += h;
    }
    // 入射振幅 a = ½(ψ + ψ′/(ik)) e^{−ikx}；ψ′/(ik) = (dim − i dre)/k
    const pr = (re + dim / kL) / 2, pi = (im - dre / kL) / 2;
    return kR / kL / (pr * pr + pi * pi);
  }

  // ── 第六章：动力学同位素效应 ────────────────────────────────────
  const AMU = { H: 1.00782503, D: 2.01410178, T: 3.01604928, C: 12, N: 14.00307401, O: 15.99491462 };
  const reduced = (a, b) => (a * b) / (a + b);
  const isoFreq = (nuH, heavy, iso) => nuH * Math.sqrt(reduced(AMU[heavy], AMU.H) / reduced(AMU[heavy], AMU[iso])); // 双原子近似：ν ∝ 1/√μ
  // 半经典的一级 KIE：反应物里 X–H 伸缩的零点能在过渡态里丢掉（tsFrac 是过渡态里还剩下的那一部分频率比例，对称的过渡态是 0）。
  // bendLoss：同时丢掉的弯曲振动（cm⁻¹，按同样的质量比换算），可以为 0。tunnel：乘上 Wigner 隧穿修正之比（imag 是 H 的虚频，D 的按 √μ 换算）。
  function kie({ nu = 2900, T = 298.15, heavy = 'C', iso = 'D', tsFrac = 0, bendLoss = 0, tunnel = false, imag = 1200 }) {
    const lost = (n) => n * (1 - tsFrac) + bendLoss * (n / nu);
    const nuI = isoFreq(nu, heavy, iso), dz = 0.5 * (lost(nu) - lost(nuI)); // 零点能之差（cm⁻¹）
    let k = Math.exp((HCK * dz) / T), tun = 1;
    if (tunnel) { const imI = isoFreq(imag, heavy, iso); tun = kappaWigner(uOf(imag, T)) / kappaWigner(uOf(imI, T)); k *= tun; }
    return { kie: k, nuI, dzpe: dz, dzpeKJ: dz * KJ_PER_CM, tun };
  }
  // Swain–Schaad 指数：ln(k_H/k_T) / ln(k_H/k_D)，半经典（只有零点能）时与温度、频率无关
  const swainSchaad = (heavy = 'C') => { const f = (iso) => 1 - Math.sqrt(reduced(AMU[heavy], AMU.H) / reduced(AMU[heavy], AMU[iso])); return f('T') / f('D'); };

  // ── 第七、八章：催化循环的精确稳态 ──────────────────────────────
  // 循环 I0 → I1 → … → I(n−1) → I0，第 i 步正向速率常数 kf[i]、逆向 kr[i]（都是一级或准一级，s⁻¹）。
  // 稳态：每一步的净速率相等 = TOF，催化剂总量为 1。用 n 个未知数（各中间体的分数）的线性方程组解（Gauss 消元），返回分数和 TOF。
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  function cycleSteady(kf, kr) {
    const n = kf.length, A = Array.from({ length: n }, () => new Array(n).fill(0)), b = new Array(n).fill(0);
    // 方程：dx_j/dt = kf[j−1] x_{j−1} − kr[j−1] x_j − kf[j] x_j + kr[j] x_{j+1} = 0（j = 1 … n−1），再加 Σ x = 1
    for (let j = 1; j < n; j++) {
      const pj = j - 1, nj = (j + 1) % n;
      A[j][pj] += kf[pj]; A[j][j] -= kr[pj] + kf[j]; A[j][nj] += kr[j];
    }
    for (let j = 0; j < n; j++) A[0][j] = 1; b[0] = 1;
    const x = solve(A, b);
    return { x, tof: kf[0] * x[0] - kr[0] * x[1 % n] };
  }
  // 由能量剖面（kJ/mol）造速率常数：I[i] 是中间体，T[i] 是 I[i] 和 I[i+1] 之间的过渡态，最后一个中间体之后回到 I[0] + ΔGr
  function profileRates(I, T, dGr, temp) {
    const n = I.length, kf = [], kr = [];
    for (let i = 0; i < n; i++) { const next = i + 1 < n ? I[i + 1] : I[0] + dGr; kf.push(eyring(T[i] - I[i], temp)); kr.push(eyring(T[i] - next, temp)); }
    return { kf, kr };
  }
  const cycleTOF = (I, T, dGr, temp) => { const { kf, kr } = profileRates(I, T, dGr, temp); return cycleSteady(kf, kr); };
  // 能量跨度模型（Kozuch & Shaik）：TOF = (k_BT/h)(e^{−ΔGr/RT} − 1) / Σ_ij e^{(T_i − I_j − δ_ij)/RT}，
  // δ′_ij = ΔGr 当过渡态 T_i 排在中间体 I_j 之后（i ≥ j），否则 0；
  // 能量跨度 δE = max(T_i − I_j，T_i 在 I_j 之前时再加 ΔGr)。同时找出 TDTS、TDI 和能量跨度 δE。
  function energeticSpan(I, T, dGr, temp) {
    const n = I.length, RT = (R * temp) / 1000;
    let sum = 0, best = -Infinity, ti = 0, ij = 0;
    const terms = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) {
      // dGr 是带符号的反应自由能（放能为负）：过渡态排在中间体前面时，要到下一圈才轮到它，跨度加上 ΔGr
      const span = T[i] - I[j] + (i < j ? dGr : 0);
      // 公式里的分母项：T_i 排在 I_j 之后（i ≥ j）时减去 ΔGr，和分子的 e^{−ΔGr/RT} 抵消，主导项因此就是 e^{−跨度/RT}
      terms.push({ i, j, e: span }); sum += Math.exp((T[i] - I[j] - (i >= j ? dGr : 0)) / RT);
      if (span > best) { best = span; ti = i; ij = j; }
    }
    const tof = (kTh(temp) * (Math.exp(-dGr / RT) - 1)) / sum;
    return { tof, dE: best, tdts: ti, tdi: ij, terms, approx: kTh(temp) * Math.exp(-best / RT) };
  }
  // 速率（TOF）控制度：X_i = ∂ ln TOF / ∂(−G_i/RT)，有限差分；对过渡态和中间体各算一份
  function tofControl(I, T, dGr, temp, h = 1e-4) {
    const RT = (R * temp) / 1000, base = Math.log(cycleTOF(I, T, dGr, temp).tof);
    const d = (mod) => (Math.log(mod()) - base) / (-h / RT);
    const XT = T.map((_, i) => d(() => { const t = T.slice(); t[i] += h; return cycleTOF(I, t, dGr, temp).tof; }));
    // 中间体 I0 同时出现在循环的头尾：挪动它要连带下一圈的那一份（ΔGr 不变）
    const XI = I.map((_, i) => d(() => { const a = I.slice(); a[i] += h; return cycleTOF(a, T, dGr, temp).tof; }));
    return { XT, XI };
  }

  // ── 第七章：表面上的微观动力学 A(g) + * ⇌ A*，A* ⇌ B*，B* ⇌ B(g) + * ──
  // 能量（kJ/mol）：G(A*)、G(B*) 相对于 A(g) + *，三个过渡态，ΔGr° 是 A(g) → B(g)；分压 pA、pB（bar）。
  // 气相分子的压力放进准一级速率常数：吸附的正向乘 pA，B 的再吸附乘 pB。这样它就是一个三步的循环，cycleSteady 精确求解。
  // Gfree 把“空位 + 气相分子”这个状态整体挪动（默认 0），只用来算空位自己的速率控制度
  function surface({ GA, GB, T1, T2, T3, dGr, pA = 1, pB = 0.01, temp = 500, Gfree = 0 }) {
    const kf = [eyring(T1 - Gfree, temp) * pA, eyring(T2 - GA, temp), eyring(T3 - GB, temp)];
    const kr = [eyring(T1 - GA, temp), eyring(T2 - GB, temp), eyring(T3 - dGr - Gfree, temp) * pB];
    const st = cycleSteady(kf, kr);
    return { theta: { free: st.x[0], A: st.x[1], B: st.x[2] }, tof: st.tof, kf, kr };
  }
  function surfaceDRC(p, h = 1e-4) {
    const RT = (R * p.temp) / 1000, base = Math.log(surface(p).tof), out = {};
    for (const key of ['T1', 'T2', 'T3', 'GA', 'GB', 'Gfree']) out[key] = (Math.log(surface({ ...p, [key]: (p[key] || 0) + h }).tof) - base) / (-h / RT);
    return out;
  }
  // 火山图：描述符 ΔE = G(A*)。线性标度关系 G(B*) = γ ΔE + δ；中间一步的过渡态按 BEP：Ea = α (G(B*) − G(A*)) + E0（不低于 0 和吸热量）。
  // 吸附和脱附的过渡态比两端高 barrierAds（kJ/mol）。返回 TOF 随描述符的曲线。
  function volcanoPoint(dE, { gamma = 1, delta = -20, alpha = 0.5, E0 = 70, dGr = -40, barrierAds = 10, pA = 1, pB = 0.01, temp = 500 } = {}) {
    const GA = dE, GB = gamma * dE + delta, ea = Math.max(E0 + alpha * (GB - GA), GB - GA, 0);
    const T1 = Math.max(0, GA) + barrierAds, T2 = GA + ea, T3 = Math.max(GB, dGr) + barrierAds;
    return { GA, GB, T1, T2, T3, ...surface({ GA, GB, T1, T2, T3, dGr, pA, pB, temp }) };
  }

  window.MOLASTRIA_RXN_MODELS = { KB, H, NA, R, C_CM, HCK, KJ_PER_CM, rng, gauss, MB, mbAll, mb, mbGrad, eig2, stationary, MB_POINTS, descend, irc, nebInit, nebForces, nebRun, marcusBarrier, crossing, leffler, parabolas, kTh, eyring, eyringHS, barrierFor, halfLife, arrheniusOf, lineFit, eyringFit, arrheniusFit, fakeKinetics, beyerSwinehart, cumsum, bruteCount, rrkm, rrkClassical, qvib, tstHarmonic, falloff, lindemann, collisionRate, TOY, eckart, kappaEckart, kappaWigner, kappaBell, uOf, transmitNumeric, AMU, reduced, isoFreq, kie, swainSchaad, solve, cycleSteady, profileRates, cycleTOF, energeticSpan, tofControl, surface, surfaceDRC, volcanoPoint };
})();
