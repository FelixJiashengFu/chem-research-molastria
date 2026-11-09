/* 游乐场 · 量子嘉年华与物理疆界的八个小游戏的数学（纯函数，不碰 DOM；tools/play-test.mjs 用解析解和已知结果检验）。
   Stern–Gerlach 串联、CHSH 贝尔游戏、量子电路（态矢量模拟）、三比特重复码、Grover 搜索、
   噪声辅助的激发能传递（Haken–Strobl 主方程）、普朗克单位的量纲分析、ħ-c-G 立方体。 */
(() => {
  'use strict';
  const Q = {};
  const rad = (d) => (d * Math.PI) / 180;

  // ── 07 Stern–Gerlach 串联 ────────────────────────────────────────────────
  // 原子以 |+θ₀⟩ 进入，每个分析器沿 xz 平面里的角度 θᵢ 测量，只放行“+”那一束。
  // 自旋 ½ 的投影概率 |⟨+θᵢ|+θᵢ₋₁⟩|² = cos²((θᵢ − θᵢ₋₁)/2)，所以总透过率是这些因子的乘积。
  Q.sgStep = (from, to) => Math.cos(rad(to - from) / 2) ** 2;
  Q.sgChain = (angles) => { let p = 1; for (let i = 1; i < angles.length; i++) p *= Q.sgStep(angles[i - 1], angles[i]); return p; };
  // 从 0° 转到 180°，中间均匀插 m 个分析器：cos^{2(m+1)}(π / (2(m+1)))，m → ∞ 时趋于 1
  Q.sgEven = (m) => Math.cos(Math.PI / (2 * (m + 1))) ** (2 * (m + 1));
  // 关卡：middle 是玩家能调的分析器个数；last 是固定的最后一个分析器（null 表示没有）；目标是透过率落在 [lo, hi]
  Q.sgLevels = [
    { id: 'quarter', middle: 1, last: null, lo: 0.23, hi: 0.27 },
    { id: 'paradox', middle: 1, last: 180, lo: 0.24, hi: 1 },
    { id: 'ladder', middle: 3, last: 180, lo: 0.5, hi: 1 },
  ];

  // ── 08 CHSH 贝尔游戏 ─────────────────────────────────────────────────────
  // 裁判给 Alice 和 Bob 各一个随机比特 x、y；两人各回答一个比特 a、b，a ⊕ b = x ∧ y 就赢。
  // 共享 |Φ⁺⟩ = (|00⟩ + |11⟩)/√2，Alice 沿角度 α、Bob 沿 β 测偏振（光子约定）：P(a = b) = cos²(α − β)。
  Q.pSame = (alpha, beta) => Math.cos(rad(alpha - beta)) ** 2;
  // 量子策略：A = [α₀, α₁]，B = [β₀, β₁]（度）
  Q.chshQuantum = (A, B) => {
    let w = 0;
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) { const s = Q.pSame(A[x], B[y]); w += x & y ? 1 - s : s; }
    return w / 4;
  };
  // 经典确定性策略：a = [a(0), a(1)]，b = [b(0), b(1)]
  Q.chshClassical = (a, b) => {
    let w = 0;
    for (let x = 0; x < 2; x++) for (let y = 0; y < 2; y++) w += (a[x] ^ b[y]) === (x & y) ? 1 : 0;
    return w / 4;
  };
  Q.tsirelson = Math.cos(Math.PI / 8) ** 2; // (2 + √2)/4 ≈ 0.8536
  // CHSH 关联量 S = E(0,0) + E(0,1) + E(1,0) − E(1,1)，E = P(相同) − P(不同)；获胜概率 = 1/2 + S/8
  Q.chshS = (A, B) => { const E = (x, y) => 2 * Q.pSame(A[x], B[y]) - 1; return E(0, 0) + E(0, 1) + E(1, 0) - E(1, 1); };

  // ── 09 量子电路（态矢量）─────────────────────────────────────────────────
  // 复数用 [re, im]。基矢下标的最高位是 q0：|q0 q1 q2⟩。
  const s2 = Math.SQRT1_2;
  Q.gates1 = {
    H: [[[s2, 0], [s2, 0]], [[s2, 0], [-s2, 0]]],
    X: [[[0, 0], [1, 0]], [[1, 0], [0, 0]]],
    Z: [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]],
    S: [[[1, 0], [0, 0]], [[0, 0], [0, 1]]],
    T: [[[1, 0], [0, 0]], [[0, 0], [s2, s2]]],
  };
  Q.zero = (n, basis = 0) => { const v = Array.from({ length: 1 << n }, () => [0, 0]); v[basis] = [1, 0]; return v; };
  const bit = (n, q) => 1 << (n - 1 - q);
  Q.apply = (state, n, g) => {
    const v = state.map((z) => [z[0], z[1]]);
    if (g.g === 'CNOT') {
      const c = bit(n, g.c), t = bit(n, g.t);
      for (let i = 0; i < v.length; i++) if (i & c && !(i & t)) { const j = i | t; [v[i], v[j]] = [v[j], v[i]]; }
      return v;
    }
    const U = Q.gates1[g.g], m = bit(n, g.q);
    for (let i = 0; i < v.length; i++) {
      if (i & m) continue;
      const a = v[i], b = v[i | m];
      const mulc = (u, z) => [u[0] * z[0] - u[1] * z[1], u[0] * z[1] + u[1] * z[0]];
      const na = mulc(U[0][0], a), nb = mulc(U[0][1], b), ma = mulc(U[1][0], a), mb = mulc(U[1][1], b);
      v[i] = [na[0] + nb[0], na[1] + nb[1]]; v[i | m] = [ma[0] + mb[0], ma[1] + mb[1]];
    }
    return v;
  };
  Q.run = (n, gates, basis = 0) => gates.reduce((s, g) => Q.apply(s, n, g), Q.zero(n, basis));
  // 保真度 |⟨target|ψ⟩|²，不管整体相位
  Q.fidelity = (psi, target) => {
    let re = 0, im = 0;
    for (let i = 0; i < psi.length; i++) { const [a, b] = target[i], [c, d] = psi[i]; re += a * c + b * d; im += a * d - b * c; }
    return re * re + im * im;
  };
  // 目标态：用 {基矢下标: [re, im]} 写，未写的振幅为 0
  const T = (n, amps) => { const v = Q.zero(n); v[0] = [0, 0]; for (const [k, z] of Object.entries(amps)) v[Number(k)] = z; return v; };
  const h = 0.5;
  // allow：可用的门；par：最少门数（tools/play-test.mjs 用穷举搜索核对）；start：初态的基矢下标
  Q.puzzles = [
    { id: 'flip', n: 1, allow: ['H', 'Z'], par: 3, target: T(1, { 1: [1, 0] }), ket: '|1⟩' },
    { id: 'minus', n: 1, allow: ['H', 'X'], par: 2, target: T(1, { 0: [s2, 0], 1: [-s2, 0] }), ket: '|−⟩ = (|0⟩ − |1⟩)/√2' },
    { id: 'plusi', n: 1, allow: ['H', 'T'], par: 3, target: T(1, { 0: [s2, 0], 1: [0, s2] }), ket: '|+i⟩ = (|0⟩ + i|1⟩)/√2' },
    { id: 'bell', n: 2, allow: ['H', 'CNOT'], par: 2, target: T(2, { 0: [s2, 0], 3: [s2, 0] }), ket: '|Φ⁺⟩ = (|00⟩ + |11⟩)/√2' },
    { id: 'singlet', n: 2, allow: ['H', 'X', 'Z', 'CNOT'], par: 4, target: T(2, { 1: [s2, 0], 2: [-s2, 0] }), ket: '|Ψ⁻⟩ = (|01⟩ − |10⟩)/√2' },
    { id: 'swap', n: 2, allow: ['CNOT'], par: 2, start: 1, target: T(2, { 2: [1, 0] }), ket: '|01⟩ → |10⟩' },
    { id: 'cz', n: 2, allow: ['H', 'CNOT'], par: 3, target: T(2, { 0: [h, 0], 1: [h, 0], 2: [h, 0], 3: [-h, 0] }), ket: '(|00⟩ + |01⟩ + |10⟩ − |11⟩)/2' },
    { id: 'ghz', n: 3, allow: ['H', 'CNOT'], par: 3, target: T(3, { 0: [s2, 0], 7: [s2, 0] }), ket: '|GHZ⟩ = (|000⟩ + |111⟩)/√2' },
    { id: 'phase', n: 2, allow: ['H', 'T', 'CNOT'], par: 3, target: T(2, { 0: [s2, 0], 3: [h, h] }), ket: '(|00⟩ + e^{iπ/4}|11⟩)/√2' },
    { id: 'ghzminus', n: 3, allow: ['H', 'X', 'Z', 'CNOT'], par: 4, target: T(3, { 0: [s2, 0], 7: [-s2, 0] }), ket: '(|000⟩ − |111⟩)/√2' },
  ];
  // 所有可用的门（给定比特数和允许的门名）
  Q.moves = (n, allow) => {
    const out = [];
    for (const g of allow) {
      if (g === 'CNOT') { for (let c = 0; c < n; c++) for (let t = 0; t < n; t++) if (c !== t) out.push({ g, c, t }); }
      else for (let q = 0; q < n; q++) out.push({ g, q });
    }
    return out;
  };
  Q.solved = (pz, gates) => Q.fidelity(Q.run(pz.n, gates, pz.start || 0), pz.target) > 1 - 1e-9;

  // ── 10 三比特重复码（比特翻转）───────────────────────────────────────────
  // 逻辑 |0⟩ → |000⟩。测两个奇偶校验 s₁ = q₀ ⊕ q₁、s₂ = q₁ ⊕ q₂（不读出数据本身），按最可能的单比特错误纠正。
  Q.syndrome = (err) => [err[0] ^ err[1], err[1] ^ err[2]];
  Q.decode = ([s1, s2]) => (s1 && !s2 ? 0 : s1 && s2 ? 1 : !s1 && s2 ? 2 : -1); // −1：不动
  // 纠正后多数票仍是错的就算逻辑错误
  Q.logicalFail = (err, fix) => { const e = err.slice(); if (fix >= 0) e[fix] ^= 1; return e[0] + e[1] + e[2] >= 2; };
  // 每个比特独立以概率 p 翻转：p_L = 3p²(1 − p) + p³ = 3p² − 2p³；p < 1/2 时 p_L < p
  Q.pLogical = (p) => 3 * p * p - 2 * p ** 3;

  // ── 11 Grover 搜索 ───────────────────────────────────────────────────────
  // N 个候选里有 1 个标记项。sin θ = 1/√N，k 次迭代后：标记项振幅 sin((2k + 1)θ)，其余每项 cos((2k + 1)θ)/√(N − 1)。
  Q.groverTheta = (N) => Math.asin(1 / Math.sqrt(N));
  Q.groverAmps = (N, k) => { const a = (2 * k + 1) * Q.groverTheta(N); return [Math.sin(a), Math.cos(a) / Math.sqrt(N - 1)]; };
  Q.groverP = (N, k) => Math.sin((2 * k + 1) * Q.groverTheta(N)) ** 2;
  Q.groverBest = (N) => { const r = Math.PI / (4 * Q.groverTheta(N)) - 0.5; const a = Math.floor(r), b = a + 1; return Q.groverP(N, a) >= Q.groverP(N, b) ? a : b; };
  // 逐步模拟（测试用）：oracle 把标记项变号，扩散把每个振幅绕平均值翻转
  Q.groverStep = (v, marked) => { const w = v.slice(); w[marked] = -w[marked]; const m = w.reduce((t, x) => t + x, 0) / w.length; return w.map((x) => 2 * m - x); };
  Q.groverSizes = [4, 8, 16, 64, 256, 1024];

  // ── 12 噪声辅助的激发能传递（Haken–Strobl）────────────────────────────────
  // dρ/dt = −i[H, ρ] − {Λ, ρ} − γ(ρ − diag ρ)，Λ = (κ/2)|trap⟩⟨trap| + (Γ/2)·1；ħ = 1，能量和速率以耦合 J 为单位。
  // 效率 η = κ ∫₀^∞ ρ_trap(t) dt，用 ∫ e^{𝓛t} dt = −𝓛⁻¹ 直接解线性方程。
  const solveC = (N, Ar, Ai, br, bi) => { // 复数高斯消元（列主元）
    const a = Array.from({ length: N }, (_, r) => [...Array.from({ length: N }, (_, c) => [Ar[r * N + c], Ai[r * N + c]]), [br[r], bi[r]]]);
    for (let col = 0; col < N; col++) {
      let p = col, best = 0;
      for (let r = col; r < N; r++) { const m = Math.hypot(...a[r][col]); if (m > best) { best = m; p = r; } }
      [a[col], a[p]] = [a[p], a[col]];
      const [pr, pi] = a[col][col], d = pr * pr + pi * pi;
      for (let r = 0; r < N; r++) {
        if (r === col) continue;
        const [xr, xi] = a[r][col]; if (xr === 0 && xi === 0) continue;
        const fr = (xr * pr + xi * pi) / d, fi = (xi * pr - xr * pi) / d;
        for (let c = col; c <= N; c++) { const [yr, yi] = a[col][c]; a[r][c] = [a[r][c][0] - (fr * yr - fi * yi), a[r][c][1] - (fr * yi + fi * yr)]; }
      }
    }
    return a.map((row, r) => { const [pr, pi] = row[r], [yr, yi] = row[N], d = pr * pr + pi * pi; return [(yr * pr + yi * pi) / d, (yi * pr - yr * pi) / d]; });
  };
  Q.transfer = (H, { gamma, kappa, loss, trap, start = 0 }) => {
    const n = H.length, N = n * n, re = new Float64Array(N * N), im = new Float64Array(N * N), id = (a, b) => a * n + b;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const row = id(a, b) * N;
      for (let c = 0; c < n; c++) { im[row + id(c, b)] -= H[a][c]; im[row + id(a, c)] += H[c][b]; }
      re[row + id(a, b)] -= (a === trap ? kappa / 2 : 0) + (b === trap ? kappa / 2 : 0) + loss + (a === b ? 0 : gamma);
    }
    const br = new Float64Array(N), bi = new Float64Array(N);
    br[id(start, start)] = -1;
    const x = solveC(N, re, im, br, bi);
    let tr = 0; for (let a = 0; a < n; a++) tr += x[id(a, a)][0];
    return { efficiency: kappa * x[id(trap, trap)][0], lost: loss * tr };
  };
  // s0：滑块的起点（不能一开始就过关）。三张“网络”：整齐的链（相干最好）、能量台阶（适量噪声最好）、菱形暗态（没有噪声就几乎传不过去）。台阶的能量 0、3、6（以 J 为单位）
  Q.networks = [
    { id: 'chain', H: [[0, 1, 0], [1, 0, 1], [0, 1, 0]], trap: 2, s0: 85, pos: [[0, 0], [1, 0], [2, 0]] },
    { id: 'stairs', H: [[0, 1, 0], [1, 3, 1], [0, 1, 6]], trap: 2, s0: 0, pos: [[0, 0.6], [1, 0], [2, -0.6]] },
    { id: 'dark', H: [[0, 1, 1, 0], [1, 0, 0, 1], [1, 0, 0, -1], [0, 1, -1, 0]], trap: 3, s0: 0, pos: [[0, 0], [1, -0.7], [1, 0.7], [2, 0]] },
  ];
  Q.enaqtRates = { kappa: 1, loss: 0.02 };
  // 滑块位置 s（0–120）→ γ：0 是完全没有退相干，其余在 10⁻² 到 10³ 之间按对数均匀分布
  Q.gammaAt = (s) => (s <= 0 ? 0 : 10 ** (-2 + (5 * (s - 1)) / 119));
  Q.enaqtCurve = (net) => Array.from({ length: 121 }, (_, s) => Q.transfer(net.H, { ...Q.enaqtRates, gamma: Q.gammaAt(s), trap: net.trap }).efficiency);

  // ── 13 普朗克单位工坊 ────────────────────────────────────────────────────
  // ħ^a c^b G^c 的量纲（M, L, T）：ħ = [M L² T⁻¹]，c = [L T⁻¹]，G = [M⁻¹ L³ T⁻²]。三者独立，所以每个目标量纲有唯一解。
  Q.hbar = 1.054571817e-34; Q.c = 299792458; Q.G = 6.67430e-11; // CODATA 2018
  Q.dims = (a, b, c) => [a - c, 2 * a + b + 3 * c, -a - b - 2 * c];
  Q.value = (a, b, c) => Q.hbar ** a * Q.c ** b * Q.G ** c;
  // 给定量纲 [M, L, T]，解出指数（克拉默法则；行列式 = 2）
  Q.solveDims = ([M, L, Tm]) => { // a − c = M，2a + b + 3c = L，−a − b − 2c = T
    const c = (L + Tm - M) / 2, a = M + c, b = L - 2 * a - 3 * c;
    return [a, b, c];
  };
  Q.planckTargets = [
    { id: 'length', dim: [0, 1, 0], unit: 'm' }, { id: 'time', dim: [0, 0, 1], unit: 's' },
    { id: 'mass', dim: [1, 0, 0], unit: 'kg' }, { id: 'energy', dim: [1, 2, -2], unit: 'J' },
    { id: 'force', dim: [1, 1, -2], unit: 'N' }, { id: 'power', dim: [1, 2, -3], unit: 'W' },
    { id: 'density', dim: [1, -3, 0], unit: 'kg/m³' }, { id: 'momentum', dim: [1, 1, -1], unit: 'kg·m/s' },
  ];

  // ── 14 ħ-c-G 立方体分拣 ──────────────────────────────────────────────────
  // k = [1/c, G, ħ] 是否必须“打开”才能解释这个现象（与物理疆界图的立方体同一约定）。
  Q.cubeCases = [
    { id: 'billiard', k: [0, 0, 0] }, { id: 'tides', k: [0, 1, 0] }, { id: 'muon', k: [1, 0, 0] },
    { id: 'mercury', k: [1, 1, 0] }, { id: 'gps', k: [1, 1, 0] }, { id: 'gw', k: [1, 1, 0] },
    { id: 'hydrogen', k: [0, 0, 1] }, { id: 'stm', k: [0, 0, 1] }, { id: 'annihilation', k: [1, 0, 1] },
    { id: 'gold', k: [1, 0, 1] }, { id: 'cow', k: [0, 1, 1] }, { id: 'qbounce', k: [0, 1, 1] },
    { id: 'chandrasekhar', k: [1, 1, 1] }, { id: 'hawking', k: [1, 1, 1] },
  ];
  Q.cubeName = { '000': 'newton', '100': 'sr', '010': 'newtongrav', '001': 'qm', '110': 'gr', '101': 'sm', '011': 'nqg', '111': 'qg' };

  if (typeof window !== 'undefined') window.MOLASTRIA_PLAYQ = Q;
  if (typeof module !== 'undefined') module.exports = Q;
})();
