/* 量子计算机 · 交互式实验室的数学模型（纯函数，不碰 DOM；tools/quantum-computing-test.mjs 用解析解检验）。
   演示 1：被微波驱动的量子比特：旋转坐标系里的 Bloch 方程（Rabi 频率 Ω、失谐 Δ、T₁、T₂），RK4 积分。
   演示 2：电路保真度预算：数字误差模型，整条电路的成功概率 ≈ 每个门和每次读出的保真度连乘。
   演示 3：量子纠错：重复码的精确逻辑错误率与蒙特卡罗抽样、表面码的经验标度律与物理比特数估算。
   单位：频率用 MHz（Ω/2π、Δ/2π），时间用 μs，所以角频率 = 2π × MHz，单位 rad/μs。 */
(() => {
  'use strict';
  const M = {};
  const TAU = 2 * Math.PI;

  // ── 演示 1：Bloch 方程 ────────────────────────────────────────────────
  // 约定：z = P(|0⟩) − P(|1⟩)，从 |0⟩（z = 1）出发；驱动沿 x 轴，H = (Δ/2)σ_z + (Ω/2)σ_x（ħ = 1）。
  // dx/dt = −Δy − x/T₂；dy/dt = Δx − Ωz − y/T₂；dz/dt = Ωy − (z − 1)/T₁。T 为 Infinity 时不衰减。
  M.blochRate = ([x, y, z], { omega, delta, T1 = Infinity, T2 = Infinity }) => {
    const W = TAU * omega, D = TAU * delta, g1 = 1 / T1, g2 = 1 / T2;
    return [-D * y - g2 * x, D * x - W * z - g2 * y, W * y - g1 * (z - 1)];
  };
  // 从 r0 积分到 tEnd（μs），返回 n + 1 个点 { t, x, y, z, p1 }
  M.bloch = (p, tEnd, n = 400, r0 = [0, 0, 1]) => {
    const out = [], h = tEnd / n, sub = Math.max(1, Math.ceil((h * TAU * Math.hypot(p.omega, p.delta)) / 0.02));
    const dt = h / sub, add = (a, b, s) => a.map((v, i) => v + s * b[i]);
    let r = r0.slice();
    const push = (t) => out.push({ t, x: r[0], y: r[1], z: r[2], p1: (1 - r[2]) / 2 });
    push(0);
    for (let i = 1; i <= n; i++) {
      for (let s = 0; s < sub; s++) {
        const k1 = M.blochRate(r, p), k2 = M.blochRate(add(r, k1, dt / 2), p), k3 = M.blochRate(add(r, k2, dt / 2), p), k4 = M.blochRate(add(r, k3, dt), p);
        r = r.map((v, j) => v + (dt / 6) * (k1[j] + 2 * k2[j] + 2 * k3[j] + k4[j]));
      }
      push(i * h);
    }
    return out;
  };
  // 无衰减时的解析解（广义 Rabi 公式）：P₁(t) = Ω²/(Ω²+Δ²) · sin²(√(Ω²+Δ²) t / 2)
  M.rabiP1 = (omega, delta, t) => { const W = TAU * Math.hypot(omega, delta); return W ? ((omega * omega) / (omega * omega + delta * delta)) * Math.sin((W * t) / 2) ** 2 : 0; };
  // π 脉冲时长（μs）：Ω t = π
  M.piTime = (omega) => 1 / (2 * omega);
  // 持续驱动下的稳态（Bloch 方程令导数为零）：z_ss = (1 + Δ²T₂²) / (1 + Δ²T₂² + Ω²T₁T₂)
  M.steadyZ = ({ omega, delta, T1, T2 }) => { const W = TAU * omega, D = TAU * delta; return (1 + D * D * T2 * T2) / (1 + D * D * T2 * T2 + W * W * T1 * T2); };
  // 只看衰减时，π 脉冲后 |1⟩ 的保真度粗估：中途 T₁ 衰减和退相位（时间按脉冲长度的一半平均）
  M.piFidelity = (p) => { const tr = M.bloch(p, M.piTime(p.omega), 200); return tr[tr.length - 1].p1; };

  // ── 演示 2：电路保真度预算 ────────────────────────────────────────────
  // 砖墙式电路：每层每个比特一个单比特门，⌊n/2⌋ 个两比特门；最后每个比特读出一次。误差都按概率给（0.001 = 0.1%）。
  M.gateCounts = (n, depth) => ({ g1: n * depth, g2: Math.floor(n / 2) * depth, meas: n });
  M.circuitFidelity = ({ n, depth, e1, e2, em }) => {
    const c = M.gateCounts(n, depth);
    const log = c.g1 * Math.log1p(-e1) + c.g2 * Math.log1p(-e2) + c.meas * Math.log1p(-em);
    return { ...c, F: Math.exp(log), log10F: log / Math.LN10 };
  };
  // 保真度降到 target 之前最多能跑多少层（不含读出时 target 不变；含读出则先扣掉）
  M.maxDepth = ({ n, e1, e2, em }, target = 0.5) => {
    const perLayer = n * Math.log1p(-e1) + Math.floor(n / 2) * Math.log1p(-e2), rest = Math.log(target) - n * Math.log1p(-em);
    if (rest > 0) return 0;
    return perLayer < 0 ? Math.floor(rest / perLayer) : Infinity;
  };
  // n = depth 的“方形”电路里，保真度还不低于 target 的最大 n（本页自定义的粗略尺度，不是 IBM 的量子体积）
  M.maxSquare = (p, target = 0.5, cap = 2000) => { let best = 0; for (let n = 2; n <= cap; n++) { if (M.circuitFidelity({ ...p, n, depth: n }).F >= target) best = n; else break; } return best; };

  // ── 演示 3：量子纠错 ──────────────────────────────────────────────────
  // 二项式系数（对数，避免溢出）
  const lnFact = (() => { const t = [0]; for (let i = 1; i <= 400; i++) t[i] = t[i - 1] + Math.log(i); return (k) => t[k]; })();
  M.binom = (n, k) => Math.exp(lnFact(n) - lnFact(k) - lnFact(n - k));
  // 距离 d（奇数）的重复码，每个比特独立以概率 p 翻转，多数表决：超过一半翻转就出错
  M.repetitionPL = (d, p) => { let s = 0; for (let k = (d + 1) / 2; k <= d; k++) s += Math.exp(lnFact(d) - lnFact(k) - lnFact(d - k) + k * Math.log(p) + (d - k) * Math.log1p(-p)); return s; };
  // 可复现的随机数（mulberry32），蒙特卡罗用
  M.rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  M.repetitionMC = (d, p, shots, seed = 1) => {
    const r = M.rng(seed);
    let fail = 0;
    for (let s = 0; s < shots; s++) { let flips = 0; for (let i = 0; i < d; i++) if (r() < p) flips++; if (flips > d / 2) fail++; }
    return fail / shots;
  };
  // 表面码的经验标度律（Fowler et al. 2012）：每轮逻辑错误率 p_L ≈ A (p/p_th)^((d+1)/2)，A ≈ 0.03，p_th ≈ 0.57%
  M.SURFACE = { A: 0.03, pth: 0.0057 };
  M.surfacePL = (d, p, { A, pth } = M.SURFACE) => A * (p / pth) ** ((d + 1) / 2);
  // 每把距离加 2，逻辑错误率下降的倍数 Λ = p_th / p
  M.lambda = (p, { pth } = M.SURFACE) => pth / p;
  // 旋转表面码一个逻辑比特的物理比特数：d² 个数据比特 + d² − 1 个测量比特
  M.surfaceQubits = (d) => 2 * d * d - 1;
  // 资源估算：Q 个逻辑比特、N 轮纠错，要求整个计算的逻辑失败概率不超过 budget；返回需要的最小奇数距离和物理比特数（不含魔术态工厂）
  M.surfaceBudget = ({ p, Q, N, budget = 0.01 }, model = M.SURFACE) => {
    if (p >= model.pth) return { d: Infinity, physical: Infinity, perRound: budget / (Q * N) };
    const target = budget / (Q * N);
    let d = 3;
    while (M.surfacePL(d, p, model) > target && d < 999) d += 2;
    return { d, perLogical: M.surfaceQubits(d), physical: Q * M.surfaceQubits(d), perRound: target, pL: M.surfacePL(d, p, model) };
  };

  window.MOLASTRIA_QC_MODELS = M;
})();
