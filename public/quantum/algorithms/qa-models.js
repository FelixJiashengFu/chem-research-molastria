/* 量子算法 · 交互实验室的数学模型（纯函数，不碰 DOM；tools/quantum-algorithms-test.mjs 用已知结果检验）。
   演示 1：态矢量模拟器（最多 5 个量子比特，Quirk 式的列：一列里的 • 控制同列所有门，两个 × 交换）。
   演示 2：Grover 振幅放大（解析式与模拟对照）。  演示 3：量子相位估计的读数分布。
   演示 4：横场 Ising 链的 Trotter 误差（精确演化用 Jacobi 对角化）。  演示 5：两比特 VQE，参数平移法则求梯度。
   约定：量子比特 0 是最上面一根线，也是基矢标签 |q0 q1 …⟩ 的最高位。 */
(() => {
  'use strict';
  const M = {};
  const TAU = 2 * Math.PI;

  // ── 态矢量 ─────────────────────────────────────────────────────────────
  M.zero = (n) => { const re = new Float64Array(1 << n), im = new Float64Array(1 << n); re[0] = 1; return { n, re, im }; };
  M.basis = (n, k) => { const s = M.zero(n); s.re[0] = 0; s.re[k] = 1; return s; };
  M.clone = (s) => ({ n: s.n, re: Float64Array.from(s.re), im: Float64Array.from(s.im) });
  const bit = (n, q) => 1 << (n - 1 - q);
  // 2×2 复矩阵写成 [a, b, c, d]，每个元素 [实部, 虚部]
  const c = (r, i = 0) => [r, i];
  const R2 = Math.SQRT1_2;
  M.U = {
    I: [c(1), c(0), c(0), c(1)],
    H: [c(R2), c(R2), c(R2), c(-R2)],
    X: [c(0), c(1), c(1), c(0)],
    Y: [c(0), c(0, -1), c(0, 1), c(0)],
    Z: [c(1), c(0), c(0), c(-1)],
    S: [c(1), c(0), c(0), c(0, 1)],
    Sdg: [c(1), c(0), c(0), c(0, -1)],
    T: [c(1), c(0), c(0), c(R2, R2)],
    Tdg: [c(1), c(0), c(0), c(R2, -R2)],
  };
  M.Ry = (t) => [c(Math.cos(t / 2)), c(-Math.sin(t / 2)), c(Math.sin(t / 2)), c(Math.cos(t / 2))];
  M.Rx = (t) => [c(Math.cos(t / 2)), c(0, -Math.sin(t / 2)), c(0, -Math.sin(t / 2)), c(Math.cos(t / 2))];
  M.Rz = (t) => [c(Math.cos(t / 2), -Math.sin(t / 2)), c(0), c(0), c(Math.cos(t / 2), Math.sin(t / 2))];
  M.P = (phi) => [c(1), c(0), c(0), c(Math.cos(phi), Math.sin(phi))];
  // 作用在 target 上，controls 里的比特都为 1 时才作用
  M.apply = (s, U, target, controls = []) => {
    const { n, re, im } = s, tb = bit(n, target);
    let cm = 0; for (const q of controls) cm |= bit(n, q);
    const [[ar, ai], [br, bi], [cr, ci], [dr, di]] = U;
    for (let i = 0; i < re.length; i++) {
      if (i & tb || (i & cm) !== cm) continue;
      const j = i | tb, xr = re[i], xi = im[i], yr = re[j], yi = im[j];
      re[i] = ar * xr - ai * xi + br * yr - bi * yi; im[i] = ar * xi + ai * xr + br * yi + bi * yr;
      re[j] = cr * xr - ci * xi + dr * yr - di * yi; im[j] = cr * xi + ci * xr + dr * yi + di * yr;
    }
    return s;
  };
  M.swap = (s, a, b, controls = []) => {
    const { n, re, im } = s, ab = bit(n, a), bb = bit(n, b);
    let cm = 0; for (const q of controls) cm |= bit(n, q);
    for (let i = 0; i < re.length; i++) {
      if ((i & cm) !== cm || !(i & ab) || i & bb) continue;
      const j = (i & ~ab) | bb;
      [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]];
    }
    return s;
  };
  M.probs = (s) => Array.from(s.re, (r, i) => r * r + s.im[i] * s.im[i]);
  M.norm = (s) => M.probs(s).reduce((a, b) => a + b, 0);
  M.label = (n, k) => k.toString(2).padStart(n, '0');
  // 某些比特的边缘分布：qs 里的比特按顺序拼成读数
  M.marginal = (s, qs) => {
    const p = M.probs(s), out = new Array(1 << qs.length).fill(0);
    p.forEach((v, i) => { let k = 0; for (const q of qs) k = (k << 1) | ((i >> (s.n - 1 - q)) & 1); out[k] += v; });
    return out;
  };
  // 按 [0,1) 的随机数 u 抽一个基矢
  M.sample = (p, u) => { let acc = 0; for (let i = 0; i < p.length; i++) { acc += p[i]; if (u < acc) return i; } return p.length - 1; };

  // ── 演示 1：网格线路 ───────────────────────────────────────────────────
  // grid[col][q] 是门名或 ''；'•' 是控制，'x' 是交换端点。一列里的 • 控制同列所有其他门。
  M.GRID_GATES = ['H', 'X', 'Y', 'Z', 'S', 'Sdg', 'T', 'Tdg', '•', 'x'];
  M.runColumn = (s, col) => {
    const controls = [], swaps = [], gates = [];
    col.forEach((g, q) => { if (g === '•') controls.push(q); else if (g === 'x') swaps.push(q); else if (g) gates.push([g, q]); });
    for (const [g, q] of gates) M.apply(s, M.U[g], q, controls);
    if (swaps.length === 2) M.swap(s, swaps[0], swaps[1], controls);
    return s;
  };
  M.runGrid = (n, grid, init = 0) => { const s = M.basis(n, init); for (const col of grid) M.runColumn(s, col); return s; };
  // 一列是否成立（给界面提示用）：控制要有作用对象，交换要成对
  M.columnIssue = (col) => {
    const ctl = col.filter((g) => g === '•').length, sw = col.filter((g) => g === 'x').length, other = col.filter((g) => g && g !== '•' && g !== 'x').length;
    if (sw && sw !== 2) return 'swap';
    if (ctl && !other && !sw) return 'control';
    return '';
  };
  // 预设线路：每个预设给出比特数和网格（列优先）
  const cols = (n, list) => list.map((spec) => { const col = new Array(n).fill(''); for (const [q, g] of Object.entries(spec)) col[+q] = g; return col; });
  M.presets = {
    bell: { n: 2, grid: cols(2, [{ 0: 'H' }, { 0: '•', 1: 'X' }]) },
    ghz: { n: 3, grid: cols(3, [{ 0: 'H' }, { 0: '•', 1: 'X' }, { 1: '•', 2: 'X' }]) },
    // Deutsch–Jozsa：f(x0,x1) = x0 ⊕ x1（平衡），比特 2 是辅助比特
    dj: { n: 3, grid: cols(3, [{ 2: 'X' }, { 0: 'H', 1: 'H', 2: 'H' }, { 0: '•', 2: 'X' }, { 1: '•', 2: 'X' }, { 0: 'H', 1: 'H' }]) },
    // Bernstein–Vazirani：秘密串 s = 101，比特 3 是辅助比特
    bv: { n: 4, grid: cols(4, [{ 3: 'X' }, { 0: 'H', 1: 'H', 2: 'H', 3: 'H' }, { 0: '•', 3: 'X' }, { 2: '•', 3: 'X' }, { 0: 'H', 1: 'H', 2: 'H' }]) },
    // 两比特 Grover：标记 |11⟩，一次迭代就以概率 1 找到
    grover: { n: 2, grid: cols(2, [{ 0: 'H', 1: 'H' }, { 0: '•', 1: 'Z' }, { 0: 'H', 1: 'H' }, { 0: 'X', 1: 'X' }, { 0: '•', 1: 'Z' }, { 0: 'X', 1: 'X' }, { 0: 'H', 1: 'H' }]) },
    // 三比特 QFT（S = R2，T = R3），末尾交换比特 0 和 2；输入 |001⟩
    qft: { n: 3, init: 1, grid: cols(3, [{ 0: 'H' }, { 1: '•', 0: 'S' }, { 2: '•', 0: 'T' }, { 1: 'H' }, { 2: '•', 1: 'S' }, { 2: 'H' }, { 0: 'x', 2: 'x' }]) },
    // 相位回踢：控制 T 门把相位 π/4 留在控制比特上
    kickback: { n: 2, grid: cols(2, [{ 0: 'H', 1: 'X' }, { 0: '•', 1: 'T' }, { 0: 'H' }]) },
  };

  // ── 一般线路（演示 2、3 的模拟对照与测试用） ───────────────────────────
  M.run = (n, ops, init = 0) => {
    const s = M.basis(n, init);
    for (const o of ops) {
      if (o.swap) M.swap(s, o.swap[0], o.swap[1], o.c || []);
      else M.apply(s, typeof o.u === 'string' ? M.U[o.u] : o.u, o.t, o.c || []);
    }
    return s;
  };
  // QFT：|j⟩ → 2^{-n/2} Σ_k e^{2πi jk/2^n} |k⟩（含末尾的比特反转）
  M.qftOps = (qs, inverse = false) => {
    const ops = [], m = qs.length;
    for (let i = 0; i < m; i++) {
      ops.push({ u: 'H', t: qs[i] });
      for (let j = i + 1; j < m; j++) ops.push({ u: M.P(TAU / 2 ** (j - i + 1)), t: qs[i], c: [qs[j]] });
    }
    for (let i = 0; i < m >> 1; i++) ops.push({ swap: [qs[i], qs[m - 1 - i]] });
    if (!inverse) return ops;
    return ops.reverse().map((o) => (o.swap ? o : { ...o, u: o.u === 'H' ? 'H' : M.dagger(o.u) }));
  };
  M.dagger = (U) => { const [[ar, ai], [br, bi], [cr, ci], [dr, di]] = U; return [[ar, -ai], [cr, -ci], [br, -bi], [dr, -di]]; };

  // ── 演示 2：Grover ────────────────────────────────────────────────────
  // N 个元素里有 m 个被标记；k 次迭代后的成功概率 sin²((2k+1)θ)，sin θ = √(m/N)
  M.groverTheta = (N, m) => Math.asin(Math.sqrt(m / N));
  M.groverP = (N, m, k) => Math.sin((2 * k + 1) * M.groverTheta(N, m)) ** 2;
  M.groverBest = (N, m) => Math.max(0, Math.floor(Math.PI / (4 * M.groverTheta(N, m))));
  // 每个被标记元素与未标记元素的振幅（实数）
  M.groverAmps = (N, m, k) => { const t = M.groverTheta(N, m), a = (2 * k + 1) * t; return { marked: Math.sin(a) / Math.sqrt(m), unmarked: m < N ? Math.cos(a) / Math.sqrt(N - m) : 0 }; };
  // 经典随机无放回抽查，找到第一个标记元素所需的期望查询次数 (N+1)/(m+1)
  M.classicalQueries = (N, m) => (N + 1) / (m + 1);
  // 用态矢量真跑 Grover：n 比特，marked 是被标记的基矢集合
  M.groverRun = (n, marked, k) => {
    const s = M.zero(n), N = 1 << n, amp = 1 / Math.sqrt(N);
    s.re.fill(amp);
    const mk = new Set(marked);
    for (let it = 0; it < k; it++) {
      for (const i of mk) s.re[i] = -s.re[i];
      let mean = 0; for (let i = 0; i < N; i++) mean += s.re[i];
      mean /= N;
      for (let i = 0; i < N; i++) s.re[i] = 2 * mean - s.re[i];
    }
    return s;
  };

  // ── 演示 3：相位估计 ─────────────────────────────────────────────────
  // t 个计数比特，本征相位 φ ∈ [0,1)：读数 m 的概率 |2^{-t} Σ_k e^{2πi k(φ − m/2^t)}|²
  M.qpeDist = (t, phi) => {
    const T = 1 << t;
    return Array.from({ length: T }, (_, m) => {
      const d = phi - m / T, s = Math.sin(Math.PI * d);
      if (Math.abs(s) < 1e-12) return 1;
      return (Math.sin(Math.PI * T * d) / (T * s)) ** 2;
    });
  };
  // 用线路真跑：计数比特 0..t−1，第 t 个比特是 U = P(2πφ) 的本征态 |1⟩
  M.qpeRun = (t, phi) => {
    const n = t + 1, ops = [{ u: 'X', t: t }];
    for (let q = 0; q < t; q++) ops.push({ u: 'H', t: q });
    // 比特 q 控制 U^{2^{t−1−q}}（比特 0 是最高位）
    for (let q = 0; q < t; q++) ops.push({ u: M.P(TAU * phi * 2 ** (t - 1 - q)), t: t, c: [q] });
    ops.push(...M.qftOps([...Array(t).keys()], true));
    return M.marginal(M.run(n, ops), [...Array(t).keys()]);
  };
  // 读数落在最近的 t 位二进制小数上的概率至少 4/π² ≈ 0.405
  M.qpeNearest = (t, phi) => { const T = 1 << t, m = Math.round(phi * T) % T; return { m, p: M.qpeDist(t, phi)[m] }; };

  // ── 实对称矩阵的 Jacobi 对角化 ─────────────────────────────────────────
  M.jacobi = (A0) => {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-26) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), cs = 1 / Math.sqrt(t * t + 1), sn = t * cs;
        for (let k = 0; k < n; k++) { const a = A[k][p], b = A[k][q]; A[k][p] = cs * a - sn * b; A[k][q] = sn * a + cs * b; }
        for (let k = 0; k < n; k++) { const a = A[p][k], b = A[q][k]; A[p][k] = cs * a - sn * b; A[q][k] = sn * a + cs * b; }
        for (let k = 0; k < n; k++) { const a = V[k][p], b = V[k][q]; V[k][p] = cs * a - sn * b; V[k][q] = sn * a + cs * b; }
      }
    }
    return { values: A.map((r, i) => r[i]), vectors: V };
  };

  // ── 演示 4：横场 Ising 链与 Trotter ───────────────────────────────────
  // H = −J Σ Z_i Z_{i+1} − h Σ X_i（开边界）= A + B，A 是对角的 ZZ 部分，B 是横场部分
  // 对角元 −J Σ z_i z_{i+1}，z = ±1（比特 0 → +1）
  M.isingZZ = (n, J) => Array.from({ length: 1 << n }, (_, k) => { let zz = 0; for (let i = 0; i + 1 < n; i++) zz += ((k >> (n - 1 - i)) ^ (k >> (n - 2 - i))) & 1 ? -1 : 1; return -J * zz; });
  M.isingMatrix = (n, J, h) => {
    const N = 1 << n, H = Array.from({ length: N }, () => new Array(N).fill(0)), d = M.isingZZ(n, J);
    for (let k = 0; k < N; k++) { H[k][k] = d[k]; for (let q = 0; q < n; q++) H[k][k ^ bit(n, q)] += -h; }
    return H;
  };
  // 精确演化 e^{−iHt}|ψ0⟩（ψ0 为实向量）
  M.evolveExact = (H, psi0, t) => {
    const { values, vectors: V } = M.jacobi(H), N = H.length, re = new Float64Array(N), im = new Float64Array(N);
    for (let a = 0; a < N; a++) {
      let ov = 0; for (let k = 0; k < N; k++) ov += V[k][a] * psi0[k];
      const cr = Math.cos(values[a] * t) * ov, ci = -Math.sin(values[a] * t) * ov;
      for (let k = 0; k < N; k++) { re[k] += V[k][a] * cr; im[k] += V[k][a] * ci; }
    }
    return { re, im };
  };
  // e^{−iAτ}：对角相位；e^{−iBτ} = ⊗ e^{ihτX} = ⊗ Rx(−2hτ)
  const stepA = (s, d, tau) => { for (let k = 0; k < d.length; k++) { const cs = Math.cos(d[k] * tau), sn = -Math.sin(d[k] * tau), r = s.re[k], i = s.im[k]; s.re[k] = cs * r - sn * i; s.im[k] = cs * i + sn * r; } };
  const stepB = (s, h, tau) => { const U = M.Rx(-2 * h * tau); for (let q = 0; q < s.n; q++) M.apply(s, U, q); };
  M.evolveTrotter = (n, J, h, psi0, t, r, order = 1) => {
    const s = { n, re: Float64Array.from(psi0), im: new Float64Array(psi0.length) }, d = M.isingZZ(n, J), tau = t / r;
    for (let k = 0; k < r; k++) {
      if (order === 2) { stepA(s, d, tau / 2); stepB(s, h, tau); stepA(s, d, tau / 2); } else { stepB(s, h, tau); stepA(s, d, tau); }
    }
    return s;
  };
  M.stateError = (a, b) => { let e = 0; for (let k = 0; k < a.re.length; k++) e += (a.re[k] - b.re[k]) ** 2 + (a.im[k] - b.im[k]) ** 2; return Math.sqrt(e); };
  // 一组步数下的误差曲线（初态 |0…0⟩）
  M.trotterCurve = (n, J, h, t, rs) => {
    const psi0 = new Array(1 << n).fill(0); psi0[0] = 1;
    const ex = M.evolveExact(M.isingMatrix(n, J, h), psi0, t);
    return rs.map((r) => ({ r, e1: M.stateError(ex, M.evolveTrotter(n, J, h, psi0, t, r, 1)), e2: M.stateError(ex, M.evolveTrotter(n, J, h, psi0, t, r, 2)) }));
  };
  // 门数：每一步一阶是 (n−1) 个 ZZ 旋转 + n 个 X 旋转；二阶的 A 半步可与下一步合并，近似同样多
  M.trotterGates = (n, r, order) => (order === 2 ? r * (2 * n - 1) + (n - 1) : r * (2 * n - 1));

  // ── 演示 5：两比特 VQE ────────────────────────────────────────────────
  // H = −Z0Z1 − h(X0 + X1)；拟设 Ry(θ0)⊗Ry(θ1) → CNOT(0→1) → Ry(θ2)⊗Ry(θ3)
  M.vqeTerms = (h) => [{ c: -1, p: 'ZZ' }, { c: -h, p: 'XI' }, { c: -h, p: 'IX' }];
  M.ansatz = (th) => M.run(2, [{ u: M.Ry(th[0]), t: 0 }, { u: M.Ry(th[1]), t: 1 }, { u: 'X', t: 1, c: [0] }, { u: M.Ry(th[2]), t: 0 }, { u: M.Ry(th[3]), t: 1 }]);
  // ⟨P⟩：把 X 比特先用 H 转到 Z 基，再读宇称
  M.pauliExp = (s, p) => {
    const t = M.clone(s);
    [...p].forEach((g, q) => { if (g === 'X') M.apply(t, M.U.H, q); });
    const pr = M.probs(t);
    return pr.reduce((acc, v, k) => { let par = 0; [...p].forEach((g, q) => { if (g !== 'I' && (k >> (t.n - 1 - q)) & 1) par ^= 1; }); return acc + (par ? -v : v); }, 0);
  };
  M.energy = (th, terms) => { const s = M.ansatz(th); return terms.reduce((e, { c: k, p }) => e + k * M.pauliExp(s, p), 0); };
  // 有限测量次数：每一项各测 shots 次，rand 是 [0,1) 随机数发生器
  M.energyShots = (th, terms, shots, rand) => {
    const s = M.ansatz(th);
    return terms.reduce((e, { c: k, p }) => { const q = (1 + M.pauliExp(s, p)) / 2; let up = 0; for (let i = 0; i < shots; i++) if (rand() < q) up++; return e + k * (2 * up / shots - 1); }, 0);
  };
  // 参数平移法则：∂E/∂θ_j = [E(θ + π/2 e_j) − E(θ − π/2 e_j)] / 2，对 Ry 门精确成立
  M.gradient = (th, f) => th.map((_, j) => { const a = th.slice(), b = th.slice(); a[j] += Math.PI / 2; b[j] -= Math.PI / 2; return (f(a) - f(b)) / 2; });
  M.pauliMatrix = (terms) => {
    const one = { I: [[1, 0], [0, 1]], X: [[0, 1], [1, 0]], Z: [[1, 0], [0, -1]] };
    const kron = (A, B) => A.flatMap((ra) => B.map((rb) => ra.flatMap((a) => rb.map((b) => a * b))));
    const H = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]];
    for (const { c: k, p } of terms) { const P = kron(one[p[0]], one[p[1]]); for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) H[i][j] += k * P[i][j]; }
    return H;
  };
  M.exactGround = (terms) => Math.min(...M.jacobi(M.pauliMatrix(terms)).values);
  // 梯度下降；shots = 0 表示精确期望值
  M.vqeRun = ({ h, steps = 60, lr = 0.3, shots = 0, seed = 7, start = [0.4, -0.3, 0.2, 0.1] }) => {
    const terms = M.vqeTerms(h), rand = M.rng(seed);
    const f = shots ? (th) => M.energyShots(th, terms, shots, rand) : (th) => M.energy(th, terms);
    let th = start.slice();
    const trace = [{ k: 0, e: M.energy(th, terms) }];
    for (let k = 1; k <= steps; k++) { const g = M.gradient(th, f); th = th.map((v, j) => v - lr * g[j]); trace.push({ k, e: M.energy(th, terms) }); }
    return { trace, theta: th, exact: M.exactGround(terms), evals: steps * 2 * th.length * terms.length * Math.max(1, shots) };
  };
  // 可复现的伪随机数（mulberry32）
  M.rng = (seed) => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

  // ── Shor 的经典部分：阶 r 与 gcd（量子计算机只负责找 r） ─────────────
  const gcd = (a, b) => { while (b) [a, b] = [b, a % b]; return a; };
  M.gcd = gcd;
  const powmod = (a, e, n) => { let r = 1n, b = BigInt(a) % BigInt(n), x = BigInt(e); const N = BigInt(n); while (x > 0n) { if (x & 1n) r = (r * b) % N; b = (b * b) % N; x >>= 1n; } return Number(r); };
  M.powmod = powmod;
  M.order = (a, N) => { if (gcd(a, N) !== 1) return 0; let x = a % N; for (let r = 1; r <= N; r++) { if (x === 1) return r; x = (x * a) % N; } return 0; };
  // 返回每一步：gcd(a,N) 碰巧不为 1、r 为奇数、a^{r/2} ≡ −1 (mod N) 三种情况要换一个 a
  M.shorClassical = (N, a) => {
    const g = gcd(a, N);
    if (g !== 1) return { lucky: g, factors: [g, N / g] };
    const r = M.order(a, N);
    if (r % 2) return { r, fail: 'odd' };
    const h = powmod(a, r / 2, N);
    if (h === N - 1) return { r, fail: 'minus1' };
    const p = gcd(h - 1, N), q = gcd(h + 1, N);
    return { r, h, factors: [p, q].filter((f) => f !== 1 && f !== N).length ? [p, q].sort((x, y) => x - y) : null };
  };
  // 相位估计读出 m/2^t ≈ s/r，用连分数找 r
  M.convergents = (num, den) => { const out = []; let [h0, h1, k0, k1] = [0, 1, 1, 0]; let a = num, b = den; while (b) { const q = Math.floor(a / b); [h0, h1] = [h1, q * h1 + h0]; [k0, k1] = [k1, q * k1 + k0]; out.push([h1, k1]); [a, b] = [b, a - q * b]; } return out; };

  if (typeof window !== 'undefined') window.MOLASTRIA_QA_MODELS = M;
  if (typeof module !== 'undefined') module.exports = M;
})();
