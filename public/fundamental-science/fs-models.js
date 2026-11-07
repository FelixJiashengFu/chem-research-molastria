/* 进一步基础科学发现 · 交互式理论实验室的数学模型（纯函数，不碰 DOM；tools/fundamental-test.mjs 用已知解析解检验）。
   演示 1：一维 GRW 局域化事件。  演示 2：两能级隧穿体系的 Lindblad 动力学（解析解）。
   演示 3：圆锥交叉附近的双态模型与 Berry 相位（离散 Wilson 环）。  另有 FCI 维数（BigInt 精确计算）。 */
(() => {
  'use strict';
  const M = {};

  // ── 演示 1：GRW 局域化 ─────────────────────────────────────────────────
  // 叠加态 ψ(x) ∝ g(x+a) + g(x−a)，g 为宽 σ 的高斯包；局域化算符 L_{x0} = (π r_C²)^{-1/4} e^{−(x−x0)²/2r_C²}。
  M.grid = (L, n) => Array.from({ length: n }, (_, i) => -L + (2 * L * i) / (n - 1));
  M.normalize = (psi, dx) => {
    const s = Math.sqrt(psi.reduce((t, v) => t + v * v, 0) * dx);
    return psi.map((v) => v / s);
  };
  M.doublePeak = (x, a, sigma) => {
    const dx = x[1] - x[0];
    return M.normalize(x.map((v) => Math.exp(-((v + a) ** 2) / (4 * sigma * sigma)) + Math.exp(-((v - a) ** 2) / (4 * sigma * sigma))), dx);
  };
  // 局域化中心的概率密度 p(x0) = ‖L_{x0}ψ‖² = ∫ (√π r_C)^{-1} e^{−(x−x0)²/r_C²} |ψ(x)|² dx
  M.hitDensity = (x, psi, rc) => {
    const dx = x[1] - x[0], k = 1 / (Math.sqrt(Math.PI) * rc);
    return x.map((x0) => {
      let s = 0;
      for (let i = 0; i < x.length; i++) s += Math.exp(-((x[i] - x0) ** 2) / (rc * rc)) * psi[i] * psi[i];
      return k * s * dx;
    });
  };
  M.afterHit = (x, psi, x0, rc) => M.normalize(psi.map((v, i) => v * Math.exp(-((x[i] - x0) ** 2) / (2 * rc * rc))), x[1] - x[0]);
  // 按累积分布抽样：u 为 [0,1) 的均匀随机数
  M.sample = (x, p, u) => {
    const dx = x[1] - x[0], total = p.reduce((t, v) => t + v, 0) * dx;
    let c = 0;
    for (let i = 0; i < x.length; i++) { c += (p[i] * dx) / total; if (c >= u) return x[i]; }
    return x[x.length - 1];
  };
  M.weightLeft = (x, psi) => {
    const dx = x[1] - x[0];
    let s = 0;
    for (let i = 0; i < x.length; i++) if (x[i] < 0) s += psi[i] * psi[i] * dx; else if (x[i] === 0) s += psi[i] * psi[i] * dx / 2;
    return s;
  };
  // 系综平均：每次局域化把相距 2a 的两峰之间的相干乘以 e^{−(2a)²/4r_C²} = e^{−a²/r_C²}
  M.coherenceAfterHit = (a, rc) => Math.exp(-(a * a) / (rc * rc));

  // ── 演示 2：两能级隧穿 + 退相干 ─────────────────────────────────────────
  // H = −(Δ/2)σx（左右局域态为基），𝒟[ρ] = (γ/2)(σzρσz − ρ)。z = P_L − P_R 满足 z'' + γ z' + ω² z = 0，z(0)=1，z'(0)=0。
  M.C_CM = 2.99792458e10; // 光速，cm/s
  M.omegaFromWavenumber = (cm) => 2 * Math.PI * M.C_CM * cm; // rad/s
  M.zOf = (t, w, g) => {
    if (g === 0) return Math.cos(w * t);
    const h = g / 2;
    if (Math.abs(h - w) < 1e-12 * w) return Math.exp(-w * t) * (1 + w * t);
    if (h < w) { const W = Math.sqrt(w * w - h * h); return Math.exp(-h * t) * (Math.cos(W * t) + (h / W) * Math.sin(W * t)); }
    const s = Math.sqrt(h * h - w * w); // 过阻尼：写成两个衰减指数，避免大 t 时溢出
    return 0.5 * ((1 + h / s) * Math.exp((s - h) * t) + (1 - h / s) * Math.exp((-s - h) * t));
  };
  M.pLeft = (t, w, g) => (1 + M.zOf(t, w, g)) / 2;
  // CSL 对尺寸远小于 r_C 的刚性物体的退相干率；质量以 u 计，m0 取 1 u（核子质量的近似）
  M.cslRate = (lambda, massU, dMeters, rcMeters) => lambda * massU * massU * (1 - Math.exp(-(dMeters * dMeters) / (4 * rcMeters * rcMeters)));

  // ── 演示 3：圆锥交叉与 Berry 相位 ───────────────────────────────────────
  // H = d·σ + ε0，d = (λy, Δ, κx)：即 [[κx, λy − iΔ], [λy + iΔ, −κx]]；ε0 = (k/2)(x² + y²)。
  M.dVec = (x, y, p) => [p.lam * y, p.delta, p.kappa * x];
  M.energies = (x, y, p) => {
    const [a, b, c] = M.dVec(x, y, p), r = Math.hypot(a, b, c), e0 = 0.5 * p.k * (x * x + y * y);
    return [e0 - r, e0 + r];
  };
  // d·σ 本征值 −|d| 的本征矢（复数，[re1, im1, re2, im2]），已归一
  M.lowerState = (d) => {
    const [dx, dy, dz] = d, r = Math.hypot(dx, dy, dz);
    let v = dz >= 0 ? [-dx, dy, dz + r, 0] : [r - dz, 0, -dx, -dy]; // 两种写法在各自的半球上都不奇异
    const n = Math.hypot(...v) || 1;
    return v.map((c) => c / n);
  };
  const inner = (u, v) => [u[0] * v[0] + u[1] * v[1] + u[2] * v[2] + u[3] * v[3], u[0] * v[1] - u[1] * v[0] + u[2] * v[3] - u[3] * v[2]]; // ⟨u|v⟩
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  M.loop = (cx, cy, r, n) => Array.from({ length: n }, (_, j) => { const t = (2 * Math.PI * j) / n; return [cx + r * Math.cos(t), cy + r * Math.sin(t)]; });
  // 离散 Wilson 环：γ = −arg ∏⟨u_j|u_{j+1}⟩，与相位约定（规范）无关；结果在 (−π, π]
  M.berryPhase = (pts, p) => {
    const us = pts.map(([x, y]) => M.lowerState(M.dVec(x, y, p)));
    let prod = [1, 0];
    for (let j = 0; j < us.length; j++) {
      prod = cmul(prod, inner(us[j], us[(j + 1) % us.length]));
      const m = Math.hypot(prod[0], prod[1]); prod = [prod[0] / m, prod[1] / m];
    }
    let g = -Math.atan2(prod[1], prod[0]);
    if (g <= -Math.PI) g += 2 * Math.PI;
    return g;
  };
  // 平行输运：每一步去掉与前一步的相对相位，回到起点时与初始态差一个因子 e^{−iγ}
  M.transport = (pts, p) => {
    const out = [];
    let prev = null;
    for (const [x, y] of [...pts, pts[0]]) {
      let u = M.lowerState(M.dVec(x, y, p));
      if (prev) {
        const [re, im] = inner(prev, u), m = Math.hypot(re, im) || 1, c = re / m, s = -im / m; // 乘以 e^{−i arg⟨prev|u⟩}
        u = [u[0] * c - u[1] * s, u[0] * s + u[1] * c, u[2] * c - u[3] * s, u[2] * s + u[3] * c];
      }
      out.push(u);
      prev = u;
    }
    return out;
  };
  // 下态 Bloch 矢量 n = −d̂
  M.bloch = (x, y, p) => { const d = M.dVec(x, y, p), r = Math.hypot(...d) || 1; return d.map((c) => -c / r); };
  // 解析对照：κ = λ、环以交叉点为中心时，d̂ 扫过的立体角 Ω = 2π(1 − Δ/√(Δ² + κ²r²))，|γ| = Ω/2（mod 2π）
  M.solidAngleCentred = (kappa, r, delta) => 2 * Math.PI * (1 - delta / Math.hypot(delta, kappa * r));

  // ── FCI 维数 ────────────────────────────────────────────────────────────
  M.binom = (n, k) => {
    n = BigInt(n); k = BigInt(k);
    if (k < 0n || k > n) return 0n;
    if (k > n - k) k = n - k;
    let r = 1n;
    for (let i = 1n; i <= k; i++) r = (r * (n - k + i)) / i;
    return r;
  };
  M.fci = (K, N) => {
    const na = Math.ceil(N / 2), nb = N - na;
    return { all: M.binom(K, N), sz: M.binom(K / 2, na) * M.binom(K / 2, nb), na, nb };
  };

  if (typeof window !== 'undefined') window.MOLASTRIA_FS_MODELS = M;
  if (typeof module !== 'undefined') module.exports = M;
})();
