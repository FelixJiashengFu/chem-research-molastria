'use strict';
// 分子动力学与自由能（/md/）的演示数学：都是纯函数（随机数用带种子的生成器，同一个种子同一个结果），没有 DOM。tools/md-test.mjs 逐个核对。
// 单位：除特别说明外都是约化单位（kT = 1、m = 1、Lennard-Jones 的 ε = σ = 1）。
// 1 积分器 · 2 恒温器 · 3 二维 LJ 流体 · 4 力场的对势和二面角 · 5 FEP / BAR / TI · 6 伞形采样和 WHAM · 7 元动力学 · 8 Jarzynski 和 Crooks · 9 马尔可夫态模型 · 10 误差估计
(() => {
  // ── 随机数 ───────────────────────────────────────────────────────────
  // mulberry32：32 位种子，返回 [0, 1) 的均匀数
  function rng(seed = 1) {
    let a = seed >>> 0;
    const u = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let spare = null;
    u.normal = () => { if (spare !== null) { const s = spare; spare = null; return s; } let x = 0; while (x === 0) x = u(); const y = u(), r = Math.sqrt(-2 * Math.log(x)); spare = r * Math.sin(2 * Math.PI * y); return r * Math.cos(2 * Math.PI * y); };
    return u;
  }
  const mean = (a) => a.reduce((s, v) => s + v, 0) / a.length;
  const variance = (a) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / (a.length - 1); };
  // 直方图：在 [lo, hi) 里分 n 格，返回格心和概率密度（落在范围外的不算进分子，但算进总数）
  function histogram(xs, lo, hi, n) {
    const c = new Float64Array(n), w = (hi - lo) / n;
    for (const x of xs) { const i = Math.floor((x - lo) / w); if (i >= 0 && i < n) c[i]++; }
    const tot = xs.length || 1;
    return { x: Array.from({ length: n }, (_, i) => lo + (i + 0.5) * w), p: Array.from(c, (v) => v / tot / w), count: c };
  }
  // 对数和的指数：log Σ exp(a_i)，不溢出
  const logSumExp = (a) => { let m = -Infinity; for (const v of a) if (v > m) m = v; if (m === -Infinity) return -Infinity; let s = 0; for (const v of a) s += Math.exp(v - m); return m + Math.log(s); };

  // ── 1. 积分器 ─────────────────────────────────────────────────────────
  // 两个一维体系：谐振子 H = p²/2 + x²/2，单摆 H = p²/2 + (1 − cos x)
  const SYS = {
    harm: { f: (x) => -x, V: (x) => 0.5 * x * x },
    pend: { f: (x) => -Math.sin(x), V: (x) => 1 - Math.cos(x) },
  };
  const energy = (sys, x, p) => 0.5 * p * p + SYS[sys].V(x);
  // 一步：euler 显式欧拉，symp 辛欧拉（先 p 后 x），verlet 速度 Verlet，rk4 四阶龙格–库塔
  function step(method, sys, x, p, h) {
    const f = SYS[sys].f;
    if (method === 'euler') return [x + h * p, p + h * f(x)];
    if (method === 'symp') { const p1 = p + h * f(x); return [x + h * p1, p1]; }
    if (method === 'verlet') { const ph = p + 0.5 * h * f(x), x1 = x + h * ph; return [x1, ph + 0.5 * h * f(x1)]; }
    // rk4：y = (x, p)，y' = (p, f(x))
    const k1x = p, k1p = f(x), k2x = p + 0.5 * h * k1p, k2p = f(x + 0.5 * h * k1x), k3x = p + 0.5 * h * k2p, k3p = f(x + 0.5 * h * k2x), k4x = p + h * k3p, k4p = f(x + h * k3x);
    return [x + (h / 6) * (k1x + 2 * k2x + 2 * k3x + k4x), p + (h / 6) * (k1p + 2 * k2p + 2 * k3p + k4p)];
  }
  // 积分 n 步，返回轨迹和能量
  function integrate(method, sys, x0, p0, h, n) {
    const xs = [x0], ps = [p0], E = [energy(sys, x0, p0)];
    let x = x0, p = p0;
    for (let i = 0; i < n; i++) { [x, p] = step(method, sys, x, p, h); if (!Number.isFinite(x) || Math.abs(x) > 1e6) break; xs.push(x); ps.push(p); E.push(energy(sys, x, p)); }
    return { xs, ps, E };
  }
  // 速度 Verlet 用在谐振子上精确守恒的“影子能量”：H̃ = p²/2 + (1 − h²/4) x²/2
  const shadowHarm = (x, p, h) => 0.5 * p * p + 0.5 * (1 - (h * h) / 4) * x * x;
  // 速度 Verlet 解谐振子的数值角频率：cos(ω̃h) = 1 − h²/2（h < 2 才稳定）
  const verletOmega = (h) => (h < 2 ? Math.acos(1 - (h * h) / 2) / h : NaN);

  // ── 2. 恒温器 ─────────────────────────────────────────────────────────
  // 两种体系，kT 目标 = 1：osc 一个一维谐振子（ω = 1）；gas N 个一维自由粒子（没有势能，只有动能，最能看出恒温器本身对动能分布做了什么）。
  // 恒温器：none、berendsen、csvr（Bussi 的随机速度重标）、nh（Nosé–Hoover）、nhc（Nosé–Hoover 链，长 M）、langevin（BAOAB）、andersen
  function thermoState(sys = 'osc', N = 1, seed = 1, M = 3) {
    const r = rng(seed), n = sys === 'osc' ? 1 : N;
    // 起点：振子在 x = 1、p = 0（能量 = kT/2）；气体每个粒子 |p| = 0.7、方向随机（温度 0.49），让恒温器自己把分布调出来
    const p = Array.from({ length: n }, () => (sys === 'osc' ? 0 : 0.7 * (r() < 0.5 ? -1 : 1)));
    return { sys, N: n, x: new Array(n).fill(sys === 'osc' ? 1 : 0), p, xi: new Array(M).fill(0), r, t: 0 };
  }
  const kin = (p) => p.reduce((s, v) => s + 0.5 * v * v, 0);
  function thermoRun(s, method, h, n, { tau = 0.5, Q = 1, gamma = 1, nu = 1, M = 3 } = {}) {
    const { x, p, N, r } = s, osc = s.sys === 'osc', f = (i) => (osc ? -x[i] : 0);
    const vv = () => { for (let i = 0; i < N; i++) p[i] += 0.5 * h * f(i); for (let i = 0; i < N; i++) x[i] += h * p[i]; for (let i = 0; i < N; i++) p[i] += 0.5 * h * f(i); };
    // Nosé–Hoover 链的半步（Martyna–Klein–Tuckerman 的写法：从链尾往回、再从链头往前），每个热浴变量的“质量”都是 Q
    const chain = (dt) => {
      const m = method === 'nh' ? 1 : M, xi = s.xi, G = (k) => (k === 0 ? (2 * kin(p) - N) / Q : (Q * xi[k - 1] * xi[k - 1] - 1) / Q);
      for (let k = m - 1; k >= 0; k--) { if (k < m - 1) xi[k] *= Math.exp(-0.25 * dt * xi[k + 1]); xi[k] += 0.5 * dt * G(k); if (k < m - 1) xi[k] *= Math.exp(-0.25 * dt * xi[k + 1]); }
      const sc = Math.exp(-dt * xi[0]); for (let i = 0; i < N; i++) p[i] *= sc;
      for (let k = 0; k < m; k++) { if (k < m - 1) xi[k] *= Math.exp(-0.25 * dt * xi[k + 1]); xi[k] += 0.5 * dt * G(k); if (k < m - 1) xi[k] *= Math.exp(-0.25 * dt * xi[k + 1]); }
    };
    for (let it = 0; it < n; it++) {
      if (method === 'langevin') {
        const c = Math.exp(-gamma * h), sq = Math.sqrt(1 - c * c);
        for (let i = 0; i < N; i++) { p[i] += 0.5 * h * f(i); x[i] += 0.5 * h * p[i]; p[i] = c * p[i] + sq * r.normal(); x[i] += 0.5 * h * p[i]; p[i] += 0.5 * h * f(i); }
      } else if (method === 'nh' || method === 'nhc') { chain(0.5 * h); vv(); chain(0.5 * h); }
      else {
        vv();
        if (method === 'berendsen') {
          // Berendsen 等人 1984：λ² = 1 + (Δt/τ)(T₀/T − 1)
          const T = (2 * kin(p)) / N, lam = T > 0 ? Math.sqrt(Math.max(0, 1 + (h / tau) * (1 / T - 1))) : 1;
          for (let i = 0; i < N; i++) p[i] *= lam;
        } else if (method === 'csvr') {
          // Bussi、Donadio、Parrinello 2007 附录的式 (A7)：总动能换成从正确分布里抽的新值，所有速度按同一个比例缩放
          const K = kin(p), Kbar = N / 2, c = Math.exp(-h / tau), R1 = r.normal();
          let S = 0; for (let k = 1; k < N; k++) { const z = r.normal(); S += z * z; }
          const K2 = c * K + ((1 - c) * Kbar * (R1 * R1 + S)) / N + 2 * Math.sqrt((c * (1 - c) * K * Kbar) / N) * R1;
          if (K > 0) { const a = Math.sqrt(Math.max(0, K2) / K); for (let i = 0; i < N; i++) p[i] *= a; }
        } else if (method === 'andersen') {
          // Andersen 1980：每个粒子以速率 ν 和热浴“碰撞”，碰一次就从麦克斯韦分布里重新抽速度
          const pr = 1 - Math.exp(-nu * h);
          for (let i = 0; i < N; i++) if (r() < pr) p[i] = r.normal();
        }
      }
      s.t += h;
    }
    return s;
  }
  // 正则系综里 N 个一维自由度的总动能 K 服从 Γ(N/2, kT)：p(K) = K^{N/2−1} e^{−K} / Γ(N/2)
  const lnGamma = (z) => { // Lanczos 近似（g = 7），z > 0
    const g = 7, c = [0.99999999999980993, 676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (z < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * z)) - lnGamma(1 - z);
    z -= 1; let a = c[0]; const t = z + g + 0.5; for (let i = 1; i < g + 2; i++) a += c[i] / (z + i);
    return 0.5 * Math.log(2 * Math.PI) + (z + 0.5) * Math.log(t) - t + Math.log(a);
  };
  const kinPdf = (K, N) => (K <= 0 ? 0 : Math.exp((N / 2 - 1) * Math.log(K) - K - lnGamma(N / 2)));

  // ── 3. 二维 Lennard-Jones 流体（周期边界）──────────────────────────────
  const RC = 2.5, VC = 4 * (RC ** -12 - RC ** -6);
  function ljBox(N, rho, T, seed = 1) {
    const L = Math.sqrt(N / rho), side = Math.ceil(Math.sqrt(N)), a = L / side, r = rng(seed);
    const x = new Float64Array(2 * N), u = new Float64Array(2 * N), v = new Float64Array(2 * N);
    for (let i = 0; i < N; i++) { x[2 * i] = (i % side + 0.5 + 0.1 * (r() - 0.5)) * a; x[2 * i + 1] = (Math.floor(i / side) + 0.5 + 0.1 * (r() - 0.5)) * a; }
    for (let k = 0; k < 2 * N; k++) v[k] = Math.sqrt(T) * r.normal();
    // 去掉质心速度，再把温度调到 T（二维：kT = K / (N − 1)，减掉的 2 个自由度是质心）
    for (const d of [0, 1]) { let m = 0; for (let i = 0; i < N; i++) m += v[2 * i + d]; m /= N; for (let i = 0; i < N; i++) v[2 * i + d] -= m; }
    let K = 0; for (let k = 0; k < 2 * N; k++) K += 0.5 * v[k] * v[k];
    const sc = Math.sqrt((T * (N - 1)) / K); for (let k = 0; k < 2 * N; k++) v[k] *= sc;
    u.set(x);
    const s = { N, L, rho, T, x, u, x0: Float64Array.from(x), v, f: new Float64Array(2 * N), r, t: 0, U: 0, vir: 0, gr: new Float64Array(60), grN: 0, msd: [] };
    ljForces(s);
    return s;
  }
  function ljForces(s) {
    const { N, L, x, f } = s;
    f.fill(0); let U = 0, vir = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let dx = x[2 * i] - x[2 * j], dy = x[2 * i + 1] - x[2 * j + 1];
      dx -= L * Math.round(dx / L); dy -= L * Math.round(dy / L);
      const r2 = dx * dx + dy * dy;
      if (r2 >= RC * RC) continue;
      const ir6 = 1 / (r2 * r2 * r2), fr = (24 * ir6 * (2 * ir6 - 1)) / r2;
      U += 4 * ir6 * (ir6 - 1) - VC; vir += fr * r2;
      f[2 * i] += fr * dx; f[2 * i + 1] += fr * dy; f[2 * j] -= fr * dx; f[2 * j + 1] -= fr * dy;
    }
    s.U = U; s.vir = vir;
  }
  // n 步速度 Verlet；thermo = 'nve' 或 'langevin'（BAOAB，γ = 1，目标温度 s.T）
  function ljRun(s, h, n, thermo = 'nve') {
    const { N, L, x, u, v, f, r } = s, c = Math.exp(-h), sq = Math.sqrt((1 - c * c) * s.T);
    for (let it = 0; it < n; it++) {
      if (thermo === 'langevin') {
        for (let k = 0; k < 2 * N; k++) { v[k] += 0.5 * h * f[k]; const dx = 0.5 * h * v[k]; x[k] += dx; u[k] += dx; }
        for (let k = 0; k < 2 * N; k++) v[k] = c * v[k] + sq * r.normal();
        for (let k = 0; k < 2 * N; k++) { const dx = 0.5 * h * v[k]; x[k] += dx; u[k] += dx; x[k] -= L * Math.floor(x[k] / L); }
      } else {
        for (let k = 0; k < 2 * N; k++) { v[k] += 0.5 * h * f[k]; const dx = h * v[k]; x[k] += dx; u[k] += dx; x[k] -= L * Math.floor(x[k] / L); }
      }
      ljForces(s);
      for (let k = 0; k < 2 * N; k++) v[k] += 0.5 * h * f[k];
      s.t += h;
    }
    return s;
  }
  const ljKinetic = (s) => { let K = 0; for (const q of s.v) K += 0.5 * q * q; return K; };
  const ljTemp = (s) => ljKinetic(s) / (s.N - 1);
  // 维里压强（二维）：P = ρkT + (1/2A) Σ r·F
  const ljPressure = (s) => s.rho * ljTemp(s) + s.vir / (2 * s.L * s.L);
  // 累计径向分布函数 g(r)（0 到 rmax 分 60 格），二维的壳面积 2πr dr
  function ljSampleGr(s, rmax = 3) {
    const { N, L, x, gr } = s, w = rmax / gr.length;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      let dx = x[2 * i] - x[2 * j], dy = x[2 * i + 1] - x[2 * j + 1];
      dx -= L * Math.round(dx / L); dy -= L * Math.round(dy / L);
      const k = Math.floor(Math.hypot(dx, dy) / w); if (k < gr.length) gr[k] += 2;
    }
    s.grN++;
  }
  function ljGr(s, rmax = 3) {
    const n = s.gr.length, w = rmax / n;
    return Array.from({ length: n }, (_, k) => { const r = (k + 0.5) * w, shell = Math.PI * (((k + 1) * w) ** 2 - (k * w) ** 2); return { r, g: s.grN ? s.gr[k] / (s.grN * s.N * s.rho * shell) : 0 }; });
  }
  // 均方位移（用没有折回盒子的坐标）
  const ljMSD = (s) => { let m = 0; for (let k = 0; k < 2 * s.N; k++) m += (s.u[k] - s.x0[k]) ** 2; return m / s.N; };

  // ── 4. 力场 ───────────────────────────────────────────────────────────
  const lj = (r, eps = 1, sig = 1) => 4 * eps * ((sig / r) ** 12 - (sig / r) ** 6);
  const ljF = (r, eps = 1, sig = 1) => (24 * eps * (2 * (sig / r) ** 12 - (sig / r) ** 6)) / r; // F = −dV/dr
  // 截断的三种做法：cut 直接截断（能量在 r_c 处跳）、shift 能量平移（力在 r_c 处跳）、sf 能量和力都平移
  function ljCut(r, rc, mode, eps = 1, sig = 1) {
    if (r >= rc) return 0;
    if (mode === 'cut') return lj(r, eps, sig);
    if (mode === 'shift') return lj(r, eps, sig) - lj(rc, eps, sig);
    return lj(r, eps, sig) - lj(rc, eps, sig) + (r - rc) * ljF(rc, eps, sig);
  }
  function ljCutF(r, rc, mode, eps = 1, sig = 1) { if (r >= rc) return 0; return mode === 'sf' ? ljF(r, eps, sig) - ljF(rc, eps, sig) : ljF(r, eps, sig); }
  // 三维均匀 LJ 流体截断以后少算的能量（每个粒子）：U_tail/N = (8/3)πρεσ³[(σ/r_c)⁹/3 − (σ/r_c)³]
  const ljTail = (rho, rc, eps = 1, sig = 1) => (8 / 3) * Math.PI * rho * eps * sig ** 3 * ((sig / rc) ** 9 / 3 - (sig / rc) ** 3);
  // Lorentz–Berthelot 组合规则
  const lorentzBerthelot = (s1, e1, s2, e2) => ({ sig: 0.5 * (s1 + s2), eps: Math.sqrt(e1 * e2) });
  // 库仑能（kJ/mol，距离 nm，电荷以 e 为单位）：138.935 458 q₁q₂/(ε_r r)
  const COULOMB = 138.935458;
  const coulomb = (r, q1, q2, epsr = 1) => (COULOMB * q1 * q2) / (epsr * r);
  // 丁烷 C–C–C–C 二面角的 Ryckaert–Bellemans 势（kJ/mol）：V = Σ Cₙ cosⁿψ，ψ = φ − 180°（φ = 180° 是反式）
  const RB = [9.28, 12.16, -13.12, -3.06, 26.24, -31.5];
  const torsion = (phiDeg) => { const c = Math.cos(((phiDeg - 180) * Math.PI) / 180); let v = 0, cn = 1; for (const C of RB) { v += C * cn; cn *= c; } return v; };
  const R_KJ = 0.0083144626; // 气体常数 kJ/(mol·K)
  // 二面角的分布 P(φ) ∝ exp(−V/RT)，返回反式（120°–240°）的比例、两个旁式的比例
  function torsionPopulations(T, n = 3600) {
    let tr = 0, all = 0;
    for (let i = 0; i < n; i++) { const phi = ((i + 0.5) * 360) / n, w = Math.exp(-torsion(phi) / (R_KJ * T)); all += w; if (phi >= 120 && phi < 240) tr += w; }
    return { trans: tr / all, gauche: 1 - tr / all };
  }
  // 在区间里找一维函数的最小值（黄金分割）
  function argmin(f, a, b, tol = 1e-9) { const g = (Math.sqrt(5) - 1) / 2; let c = b - g * (b - a), d = a + g * (b - a); while (b - a > tol) { if (f(c) < f(d)) b = d; else a = c; c = b - g * (b - a); d = a + g * (b - a); } return (a + b) / 2; }

  // ── 5. 自由能微扰（FEP）、BAR 和热力学积分（TI）──────────────────────
  // 两个谐振子态（kT = 1）：U₀ = k₀x²/2，U₁ = k₁(x − d)²/2。精确答案 ΔF = ½ ln(k₁/k₀)，和 d 无关。
  const harmDF = (k0, k1) => 0.5 * Math.log(k1 / k0);
  const fepSample = (k, c, n, r) => Array.from({ length: n }, () => c + r.normal() / Math.sqrt(k));
  const dU = (x, k0, k1, d) => 0.5 * k1 * (x - d) ** 2 - 0.5 * k0 * x * x;
  // Zwanzig：ΔF = −ln⟨e^{−ΔU}⟩₀（正向），= ln⟨e^{ΔU}⟩₁（反向）
  const fepForward = (w0) => -(logSumExp(w0.map((v) => -v)) - Math.log(w0.length));
  const fepReverse = (w1) => logSumExp(w1) - Math.log(w1.length);
  // Bennett 接受率：找 ΔF 使 Σ₀ f(ΔU − ΔF − M) = Σ₁ f(ΔF + M − ΔU)，M = ln(n₁/n₀)，f(x) = 1/(1 + eˣ)
  function bar(w0, w1) {
    const fermi = (x) => (x > 0 ? Math.exp(-x) / (1 + Math.exp(-x)) : 1 / (1 + Math.exp(x)));
    const M = Math.log(w1.length / w0.length);
    const g = (C) => w0.reduce((s, v) => s + fermi(v - C - M), 0) - w1.reduce((s, v) => s + fermi(C + M - v), 0);
    let lo = Math.min(...w0, ...w1) - 50, hi = Math.max(...w0, ...w1) + 50;
    for (let i = 0; i < 200; i++) { const m = 0.5 * (lo + hi); if (g(m) > 0) hi = m; else lo = m; }
    return 0.5 * (lo + hi);
  }
  // 线性混合 U_λ = (1 − λ)U₀ + λU₁ 仍是谐振子：k_λ = (1 − λ)k₀ + λk₁，中心 c_λ = λk₁d / k_λ
  const kLam = (l, k0, k1) => (1 - l) * k0 + l * k1;
  const cLam = (l, k0, k1, d) => (l * k1 * d) / kLam(l, k0, k1);
  // 被积函数 ⟨∂U/∂λ⟩_λ = ⟨U₁ − U₀⟩_λ 的解析式
  function tiIntegrand(l, k0, k1, d) { const k = kLam(l, k0, k1), c = cLam(l, k0, k1, d); return 0.5 * k1 * ((c - d) ** 2 + 1 / k) - 0.5 * k0 * (c * c + 1 / k); }
  // 梯形法：n 个窗口（含两端），每个窗口用解析的被积函数或 m 个样本的平均
  function tiTrapezoid(n, k0, k1, d, m = 0, r = null) {
    const ls = Array.from({ length: n }, (_, i) => i / (n - 1));
    const ys = ls.map((l) => { if (!m) return tiIntegrand(l, k0, k1, d); const xs = fepSample(kLam(l, k0, k1), cLam(l, k0, k1, d), m, r); return mean(xs.map((x) => dU(x, k0, k1, d))); });
    let s = 0; for (let i = 1; i < n; i++) s += 0.5 * (ys[i] + ys[i - 1]) * (ls[i] - ls[i - 1]);
    return { ls, ys, dF: s };
  }
  // 软核 LJ（Beutler 等人 1994）：V = 4ελ[1/(α(1−λ) + r⁶)² − 1/(α(1−λ) + r⁶)]，σ = 1
  const softcore = (r, l, alpha = 0.5) => { const s = alpha * (1 - l) + r ** 6; return 4 * l * (1 / (s * s) - 1 / s); };

  // ── 共用：一维过阻尼 Langevin（D = 1，kT = 1）──────────────────────────
  // 势：dw 双阱 h(x² − 1)² + t·x；tw 三阱 2h·x²(x² − 1.5)²（三个阱一样深，垒高 h）
  const pot = {
    dw: (x, h, t = 0) => h * (x * x - 1) ** 2 + t * x,
    dwD: (x, h, t = 0) => 4 * h * x * (x * x - 1) + t,
    tw: (x, h, t = 0) => 2 * h * x * x * (x * x - 1.5) ** 2 + t * x,
    twD: (x, h, t = 0) => 2 * h * (2 * x * (x * x - 1.5) ** 2 + 4 * x ** 3 * (x * x - 1.5)) + t,
  };

  // ── 6. 伞形采样和 WHAM ────────────────────────────────────────────────
  // 每个窗口加偏置 k/2 (x − cᵢ)²，跑 n 步过阻尼 Langevin，返回样本
  function umbrellaRun({ h = 4, t = 0, k = 30, nWin = 12, lo = -1.6, hi = 1.6, n = 3000, dt = 2e-3, seed = 1 } = {}) {
    const r = rng(seed), centres = Array.from({ length: nWin }, (_, i) => lo + ((hi - lo) * i) / (nWin - 1)), sq = Math.sqrt(2 * dt);
    const samples = centres.map((c) => {
      let x = c; const out = [];
      for (let i = 0; i < n + 200; i++) { x += -(pot.dwD(x, h, t) + k * (x - c)) * dt + sq * r.normal(); if (i >= 200 && i % 2 === 0) out.push(x); }
      return out;
    });
    return { centres, samples, k };
  }
  // WHAM（Kumar 等人 1992）：在格子上自洽求 P(x) 和每个窗口的 fᵢ
  function wham(centres, samples, k, lo, hi, nb = 60, tol = 1e-8, maxIt = 5000) {
    const w = (hi - lo) / nb, xb = Array.from({ length: nb }, (_, b) => lo + (b + 0.5) * w);
    const cnt = Array.from({ length: nb }, () => 0), Ni = samples.map((s) => s.length);
    for (const s of samples) for (const x of s) { const b = Math.floor((x - lo) / w); if (b >= 0 && b < nb) cnt[b]++; }
    const bias = centres.map((c) => xb.map((x) => 0.5 * k * (x - c) ** 2));
    let f = centres.map(() => 0), P = new Array(nb).fill(1 / nb), it = 0;
    for (; it < maxIt; it++) {
      P = xb.map((_, b) => { if (!cnt[b]) return 0; let den = 0; for (let i = 0; i < centres.length; i++) den += Ni[i] * Math.exp(f[i] - bias[i][b]); return cnt[b] / den; });
      const fn = centres.map((_, i) => { let z = 0; for (let b = 0; b < nb; b++) z += P[b] * Math.exp(-bias[i][b]); return -Math.log(z); });
      const shift = fn[0], diff = Math.max(...fn.map((v, i) => Math.abs(v - shift - f[i])));
      f = fn.map((v) => v - shift);
      if (diff < tol) break;
    }
    const F = P.map((p) => (p > 0 ? -Math.log(p / w) : NaN)), fmin = Math.min(...F.filter(Number.isFinite));
    return { x: xb, F: F.map((v) => v - fmin), f, it: it + 1 };
  }

  // ── 7. 元动力学 ───────────────────────────────────────────────────────
  // 偏置存在格子上（[−2.4, 2.4] 分 481 点），每 stride 步在当前位置加一个高 w、宽 σ 的高斯；well-tempered 时高度乘 exp(−V(x)/ΔT)
  const MG = { lo: -2.4, hi: 2.4, n: 481 };
  function metadState(seed = 1) { return { x: -1, t: 0, step: 0, V: new Float64Array(MG.n), dV: new Float64Array(MG.n), hills: 0, r: rng(seed), side: -1, cross: 0, firstCross: NaN }; }
  function biasAt(s, x) {
    const d = (MG.hi - MG.lo) / (MG.n - 1), u = (x - MG.lo) / d, i = Math.max(0, Math.min(MG.n - 2, Math.floor(u))), a = Math.max(0, Math.min(1, u - i));
    return [s.V[i] * (1 - a) + s.V[i + 1] * a, s.dV[i] * (1 - a) + s.dV[i + 1] * a];
  }
  function metadRun(s, n, { shape = 'dw', h = 5, w = 0.3, sigma = 0.15, stride = 100, wt = 0, dt = 2e-3, on = true } = {}) {
    const D = pot[`${shape}D`], d = (MG.hi - MG.lo) / (MG.n - 1), sq = Math.sqrt(2 * dt), mid = shape === 'dw' ? 0 : Math.sqrt(0.5);
    for (let it = 0; it < n; it++) {
      const [, dv] = biasAt(s, s.x);
      s.x += -(D(s.x, h) + (on ? dv : 0)) * dt + sq * s.r.normal();
      // 两边有墙（偏置格子之外不让走）
      if (s.x < MG.lo + 0.05) s.x = 2 * (MG.lo + 0.05) - s.x; if (s.x > MG.hi - 0.05) s.x = 2 * (MG.hi - 0.05) - s.x;
      s.t += dt; s.step++;
      const side = s.x < -mid ? -1 : s.x > mid ? 1 : 0;
      if (side && side !== s.side) { if (s.side) { s.cross++; if (!Number.isFinite(s.firstCross)) s.firstCross = s.t; } s.side = side; }
      if (on && s.step % stride === 0) {
        const hgt = wt > 0 ? w * Math.exp(-biasAt(s, s.x)[0] / wt) : w;
        for (let i = 0; i < MG.n; i++) { const q = MG.lo + i * d, e = (q - s.x) / sigma; if (Math.abs(e) > 6) continue; const g = hgt * Math.exp(-0.5 * e * e); s.V[i] += g; s.dV[i] += (-g * e) / sigma; }
        s.hills++;
      }
    }
    return s;
  }
  // 由偏置估计自由能：普通元动力学 F ≈ −V，well-tempered F ≈ −(1 + T/ΔT) V（kT = 1）
  function metadF(s, wt = 0) { const fac = wt > 0 ? 1 + 1 / wt : 1, d = (MG.hi - MG.lo) / (MG.n - 1); const F = Array.from(s.V, (v) => -fac * v); return { x: Array.from({ length: MG.n }, (_, i) => MG.lo + i * d), F }; }

  // ── 8. Jarzynski 等式和 Crooks 定理 ────────────────────────────────────
  // 粒子在双阱 h(x² − 1)² 里，被一个劲度 κ 的谐振陷阱从 λ₀ 拉到 λ₁（匀速，用时 τ），过阻尼 Langevin。
  // H(x, λ) = U(x) + κ(x − λ)²/2；功 W = ∫ ∂H/∂λ dλ = −κ Σ (x − λ) Δλ。初始构型从 λ₀ 的玻尔兹曼分布精确抽（格子上的逆累积分布）。
  const jH = (x, l, h, kap) => pot.dw(x, h) + 0.5 * kap * (x - l) ** 2;
  const JG = { lo: -4, hi: 4, n: 4001 };
  function jZ(l, h, kap) { const d = (JG.hi - JG.lo) / (JG.n - 1); let z = 0; for (let i = 0; i < JG.n; i++) z += Math.exp(-jH(JG.lo + i * d, l, h, kap)) * d; return z; }
  const jarzDF = (l0, l1, h, kap) => -Math.log(jZ(l1, h, kap) / jZ(l0, h, kap));
  function jSampler(l, h, kap) {
    const d = (JG.hi - JG.lo) / (JG.n - 1), cdf = new Float64Array(JG.n); let s = 0;
    for (let i = 0; i < JG.n; i++) { s += Math.exp(-jH(JG.lo + i * d, l, h, kap)); cdf[i] = s; }
    return (u) => { const t = u * s; let a = 0, b = JG.n - 1; while (a < b) { const m = (a + b) >> 1; if (cdf[m] < t) a = m + 1; else b = m; } return JG.lo + a * d; };
  }
  function jarzRun({ h = 3, kap = 6, l0 = -1, l1 = 1.5, tau = 1, n = 200, dt = 2e-3, seed = 1 } = {}) {
    const r = rng(seed), draw = jSampler(l0, h, kap), steps = Math.max(1, Math.round(tau / dt)), dl = (l1 - l0) / steps, sq = Math.sqrt(2 * dt), W = [];
    for (let k = 0; k < n; k++) {
      let x = draw(r()), l = l0, w = 0;
      for (let i = 0; i < steps; i++) {
        w += -kap * (x - l) * dl; l += dl; // 先移动陷阱（做功），再让粒子走一步
        x += -(pot.dwD(x, h) + kap * (x - l)) * dt + sq * r.normal();
      }
      W.push(w);
    }
    return W;
  }
  const jarzEstimate = (W) => -(logSumExp(W.map((w) => -w)) - Math.log(W.length));
  const cumulantEstimate = (W) => mean(W) - 0.5 * variance(W);

  // ── 9. 马尔可夫态模型 ──────────────────────────────────────────────────
  // 周期区间 [0, 4) 上的四阱势 U = (h/2)(1 + cos 2πx) + (H/2)(1 − cos πx) + (a/2)(1 + cos(πx/2))：阱在 0.5、1.5、2.5、3.5。
  // x = 0、2 处的垒高 h，x = 1、3 处高 h + H，所以阱两两成对：{3.5, 0.5} 和 {1.5, 2.5}；最慢的过程是两对之间来回，快的过程是一对之内。
  // a 让两对一深一浅（{1.5, 2.5} 更深）。
  const msmU = (x, h, H, a = 1) => 0.5 * h * (1 + Math.cos(2 * Math.PI * x)) + 0.5 * H * (1 - Math.cos(Math.PI * x)) + 0.5 * a * (1 + Math.cos((Math.PI * x) / 2));
  const msmUD = (x, h, H, a = 1) => -Math.PI * h * Math.sin(2 * Math.PI * x) + 0.5 * Math.PI * H * Math.sin(Math.PI * x) - (Math.PI / 4) * a * Math.sin((Math.PI * x) / 2);
  function msmTraj({ h = 2, H = 3, T = 1000, dt = 4e-3, every = 5, seed = 1 } = {}) {
    const r = rng(seed), n = Math.round(T / dt), sq = Math.sqrt(2 * dt), out = new Float32Array(Math.floor(n / every));
    let x = 1.5;
    for (let i = 0, k = 0; i < n; i++) { x += -msmUD(x, h, H) * dt + sq * r.normal(); x -= 4 * Math.floor(x / 4); if ((i + 1) % every === 0) out[k++] = x; }
    return { x: out, dt: dt * every };
  }
  // 对称矩阵的全部特征值和特征向量（Jacobi 转动）
  function jacobi(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = c * a - s * b; A[k][q] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = c * a - s * b; A[q][k] = s * a + c * b; }
        for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = c * a - s * b; V[k][q] = s * a + c * b; }
      }
    }
    const ord = A.map((_, i) => i).sort((i, j) => A[j][j] - A[i][i]);
    return { values: ord.map((i) => A[i][i]), vectors: ord.map((i) => V.map((r) => r[i])) };
  }
  // 从离散轨迹在滞后 lag（步）上数转移，做对称化（可逆的简单估计），返回转移矩阵的特征值、平稳分布和第二个右特征向量
  function msmEstimate(dtraj, nS, lag) {
    const C = Array.from({ length: nS }, () => new Array(nS).fill(0));
    for (let i = 0; i + lag < dtraj.length; i++) C[dtraj[i]][dtraj[i + lag]] += 1;
    for (let i = 0; i < nS; i++) for (let j = i + 1; j < nS; j++) { const m = 0.5 * (C[i][j] + C[j][i]); C[i][j] = C[j][i] = m; }
    const c = C.map((r) => r.reduce((s, v) => s + v, 0)), tot = c.reduce((s, v) => s + v, 0);
    if (c.some((v) => v === 0)) return null; // 有没去过的态
    const S = C.map((r, i) => r.map((v, j) => v / Math.sqrt(c[i] * c[j])));
    const { values, vectors } = jacobi(S);
    const pi = c.map((v) => v / tot), psi2 = vectors[1].map((v, i) => v / Math.sqrt(pi[i]));
    return { values, pi, psi2, T: C.map((r, i) => r.map((v) => v / c[i])) };
  }
  // 等宽的 nS 个态；off 把边界整体挪一段（以 4/nS 为单位），挪 0.5 时 4 个态的边界正好落在阱底
  const discretize = (x, nS, off = 0) => Array.from(x, (v) => { const u = (((v / 4) * nS - off) % nS + nS) % nS; return Math.min(nS - 1, Math.floor(u)); });
  const impliedTimescale = (lam, tau) => (lam > 0 && lam < 1 ? -tau / Math.log(lam) : NaN);
  // 参照答案：把 Smoluchowski 方程放在 m 个格点上（相邻格点的跳跃速率 (D/Δx²)e^{−ΔU/2}，满足细致平衡），对称化以后求本征值；弛豫时间 tₖ = −1/μₖ
  function msmExact(h, H, m = 120) {
    const dx = 4 / m, U = Array.from({ length: m }, (_, i) => msmU((i + 0.5) * dx, h, H)), k0 = 1 / (dx * dx);
    const A = Array.from({ length: m }, () => new Array(m).fill(0));
    for (let i = 0; i < m; i++) for (const j of [(i + 1) % m, (i + m - 1) % m]) { A[i][j] += k0; A[i][i] -= k0 * Math.exp(-(U[j] - U[i]) / 2); }
    const { values } = jacobi(A);
    const Z = U.reduce((s, u) => s + Math.exp(-u), 0);
    return { times: values.slice(1, 6).map((mu) => -1 / mu), pi: U.map((u) => Math.exp(-u) / Z) };
  }

  // ── 10. 有相关的数据怎么估误差 ─────────────────────────────────────────
  // AR(1) 过程 x_t = φx_{t−1} + √(1 − φ²) ξ，方差 1，相关时间 τ = −1/ln φ
  function ar1(n, tau, seed = 1) { const r = rng(seed), phi = Math.exp(-1 / tau), q = Math.sqrt(1 - phi * phi), x = new Float64Array(n); let v = r.normal(); for (let i = 0; i < n; i++) { v = phi * v + q * r.normal(); x[i] = v; } return x; }
  // 均值的真实标准误（n 很大时）：√[(1 + φ)/((1 − φ) n)]
  const ar1Error = (n, tau) => { const phi = Math.exp(-1 / tau); return Math.sqrt((1 + phi) / ((1 - phi) * n)); };
  // Flyvbjerg–Petersen 分块：每次把相邻两点平均，长度减半，记下“把块当独立样本”时的标准误
  function blocking(x) {
    let a = Array.from(x); const out = [];
    while (a.length >= 4) {
      const n = a.length, m = mean(a), v = a.reduce((s, q) => s + (q - m) ** 2, 0) / (n - 1);
      out.push({ size: x.length / n, n, se: Math.sqrt(v / n), err: Math.sqrt(v / n) / Math.sqrt(2 * (n - 1)) });
      const b = []; for (let i = 0; i + 1 < n; i += 2) b.push(0.5 * (a[i] + a[i + 1])); a = b;
    }
    return out;
  }
  // 积分自相关时间 τ_int = 1/2 + Σ ρ(t)，求和到 ρ 第一次小于 0 为止（一种常见的截断）
  function tauInt(x) {
    const n = x.length, m = mean(x), v = x.reduce((s, q) => s + (q - m) ** 2, 0) / n; let s = 0.5;
    for (let t = 1; t < n / 4; t++) { let c = 0; for (let i = 0; i + t < n; i++) c += (x[i] - m) * (x[i + t] - m); const rho = c / ((n - t) * v); if (rho < 0) break; s += rho; }
    return s;
  }

  window.MOLASTRIA_MD_MODELS = {
    rng, mean, variance, histogram, logSumExp, argmin,
    SYS, energy, step, integrate, shadowHarm, verletOmega,
    thermoState, thermoRun, kin, lnGamma, kinPdf,
    RC, ljBox, ljForces, ljRun, ljKinetic, ljTemp, ljPressure, ljSampleGr, ljGr, ljMSD,
    lj, ljF, ljCut, ljCutF, ljTail, lorentzBerthelot, COULOMB, coulomb, RB, torsion, R_KJ, torsionPopulations,
    harmDF, fepSample, dU, fepForward, fepReverse, bar, kLam, cLam, tiIntegrand, tiTrapezoid, softcore,
    pot, umbrellaRun, wham, MG, metadState, biasAt, metadRun, metadF,
    jH, jZ, jarzDF, jSampler, jarzRun, jarzEstimate, cumulantEstimate,
    msmU, msmUD, msmTraj, jacobi, msmEstimate, discretize, impliedTimescale, msmExact,
    ar1, ar1Error, blocking, tauInt,
  };
})();
