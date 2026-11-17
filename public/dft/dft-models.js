'use strict';
// 密度泛函理论（/dft/）演示背后的数学：纯函数，没有 DOM。tools/dft-test.mjs 对照解析结果和文献数值测这里的每一个函数。
// 页面里 dft-demos.js 经 window.MOLASTRIA_DFT_MODELS 拿到它们。单位一律是原子单位（Hartree、bohr），另有说明的除外。
// 内容：Thomas–Fermi 原子和它的修正 · 两格点 Hubbard 二聚体的精确解和它的 Kohn–Sham 系统 · 一维 Kohn–Sham 自洽（软库仑势，线性混合和 Pulay DIIS）·
// 交换增强因子（LDA、B88、PBE、revPBE、PBEsol）和氢原子的交换能 · 均匀电子气（交换和 PW92 关联）· 分数电子数的 E(N) ·
// 色散校正的阻尼函数 · 一维平面波基组的截断收敛 · k 点采样和展宽 · Birch–Murnaghan 状态方程和拟合 · 两能级 Casida 模型和电荷转移激发 ·
// 径向积分格点和 Becke 分割。全部自己写，没有复制任何程序的代码。
(() => {
  const PI = Math.PI;

  // ── 小工具 ────────────────────────────────────────────────────────
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  // 对称矩阵的全部本征值和本征矢（循环 Jacobi）。A 是二维数组，不会被改动。返回按本征值从小到大排好的 { values, vectors }，vectors[k] 是第 k 个本征矢。
  function symEig(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] * A[i][j];
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = [...Array(n).keys()].sort((a, b) => A[a][a] - A[b][b]);
    return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => V.map((r) => r[i])) };
  }
  // 小线性方程组（Gauss 消元，部分主元）
  function solve(A0, b0) {
    const n = b0.length, A = A0.map((r, i) => [...r, b0[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]];
      if (Math.abs(A[c][c]) < 1e-300) return null;
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / A[c][c]; for (let k = c; k <= n; k++) A[r][k] -= f * A[c][k]; }
    }
    const x = Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = A[r][n]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / A[r][r]; }
    return x;
  }
  // 一维极小（黄金分割）
  function goldenMin(f, a, b, tol = 1e-10) {
    const g = (Math.sqrt(5) - 1) / 2;
    let c = b - g * (b - a), d = a + g * (b - a), fc = f(c), fd = f(d);
    while (b - a > tol) { if (fc < fd) { b = d; d = c; fd = fc; c = b - g * (b - a); fc = f(c); } else { a = c; c = d; fc = fd; d = a + g * (b - a); fd = f(d); } }
    return (a + b) / 2;
  }

  // ── 第一章：Thomas–Fermi 原子 ─────────────────────────────────────
  // E_TF = −0.768745 Z^{7/3}；加 Scott 修正 +Z²/2，再加 Schwinger 的交换项 −0.2699 Z^{5/3}（中性原子的大 Z 展开）。
  const TF = 0.768745, SCHWINGER = 0.269900;
  const tfEnergy = (Z, terms = 1) => -TF * Z ** (7 / 3) + (terms >= 2 ? 0.5 * Z * Z : 0) - (terms >= 3 ? SCHWINGER * Z ** (5 / 3) : 0);
  // 非相对论的“精确”总能量（Hartree）：H 解析，He 取 Pekeris 型的高精度变分值，Li–Ar 取 Chakravorty 等 1993 年的估计值（文献 chakravorty1993）。
  const ATOMS = [
    ['H', 1, -0.5], ['He', 2, -2.903724], ['Li', 3, -7.47806], ['Be', 4, -14.66736], ['B', 5, -24.65391], ['C', 6, -37.8450], ['N', 7, -54.5892], ['O', 8, -75.0673], ['F', 9, -99.7339],
    ['Ne', 10, -128.9376], ['Na', 11, -162.2546], ['Mg', 12, -200.0530], ['Al', 13, -242.3460], ['Si', 14, -289.3590], ['P', 15, -341.2590], ['S', 16, -398.1100], ['Cl', 17, -460.1480], ['Ar', 18, -527.5400],
  ];

  // ── 第二章：两格点 Hubbard 二聚体（两个电子，自旋单态）─────────────
  // 基：|双占 1⟩、|双占 2⟩、|各一个的单态⟩。格点势 v1 = −Δv/2、v2 = +Δv/2，跳跃 t，同格点排斥 U。Δn = n2 − n1。
  function dimer(dv, U, t = 0.5) {
    const v1 = -dv / 2, v2 = dv / 2, h = -Math.SQRT2 * t;
    const { values, vectors } = symEig([[U + 2 * v1, 0, h], [0, U + 2 * v2, h], [h, h, v1 + v2]]);
    const c = vectors[0], n1 = 2 * c[0] ** 2 + c[2] ** 2, n2 = 2 * c[1] ** 2 + c[2] ** 2;
    return { E: values[0], n1, n2, dn: n2 - n1, gap: values[1] - values[0], c };
  }
  // 没有相互作用的两个电子：Δn_s(Δv) = −2Δv/√(Δv² + 4t²)；反过来，给定 Δn 时 Kohn–Sham 势差 Δv_s = −2tΔn/√(4 − Δn²)
  const dimerDnS = (dv, t = 0.5) => (-2 * dv) / Math.sqrt(dv * dv + 4 * t * t);
  const dimerVs = (dn, t = 0.5) => (-2 * t * dn) / Math.sqrt(Math.max(1e-300, 4 - dn * dn));
  const dimerTs = (dn, t = 0.5) => -2 * t * Math.sqrt(Math.max(0, 1 - (dn * dn) / 4));
  // 从精确解反推：给定目标 Δn，二分求出产生它的 Δv（Hohenberg–Kohn 映射的逆），再算普适泛函 F[n] = E − Σ v_i n_i
  function dimerInvert(dn, U, t = 0.5) {
    let a = -60, b = 60; // Δn(Δv) 单调递减
    for (let i = 0; i < 200; i++) { const m = (a + b) / 2; if (dimer(m, U, t).dn > dn) a = m; else b = m; }
    const dv = (a + b) / 2, r = dimer(dv, U, t);
    return { dv, F: r.E - (dv * r.dn) / 2, E: r.E };
  }

  // ── 第三章：一维 Kohn–Sham 自洽（软库仑相互作用）──────────────────
  // 对称三对角矩阵（对角 d、次对角 e）的最低 k 个本征值：Sturm 序列二分；本征矢：反迭代（Thomas 算法）
  function sturmCount(d, e, x) {
    let q = d[0] - x, c = q < 0 ? 1 : 0;
    for (let i = 1; i < d.length; i++) { q = d[i] - x - (e[i - 1] * e[i - 1]) / (Math.abs(q) < 1e-300 ? 1e-300 : q); if (q < 0) c++; }
    return c;
  }
  function triEig(d, e, k) {
    let lo = Infinity, hi = -Infinity;
    for (let i = 0; i < d.length; i++) { const r = (i > 0 ? Math.abs(e[i - 1]) : 0) + (i < d.length - 1 ? Math.abs(e[i]) : 0); lo = Math.min(lo, d[i] - r); hi = Math.max(hi, d[i] + r); }
    const vals = [], vecs = [];
    for (let j = 0; j < k; j++) {
      let a = lo, b = hi;
      for (let it = 0; it < 80; it++) { const m = (a + b) / 2; if (sturmCount(d, e, m) > j) b = m; else a = m; }
      const lam = (a + b) / 2;
      vals.push(lam);
      // 反迭代：(T − λ' I) y = x
      const n = d.length, shift = lam + 1e-10 * (1 + Math.abs(lam));
      let x = Array.from({ length: n }, (_, i) => 1 + 0.01 * Math.sin(i * 1.3 + j));
      for (let it = 0; it < 4; it++) {
        const cp = new Float64Array(n), dp = new Float64Array(n);
        let den = d[0] - shift; cp[0] = (e[0] || 0) / den; dp[0] = x[0] / den;
        for (let i = 1; i < n; i++) { den = d[i] - shift - e[i - 1] * cp[i - 1]; if (Math.abs(den) < 1e-300) den = 1e-300; cp[i] = i < n - 1 ? e[i] / den : 0; dp[i] = (x[i] - e[i - 1] * dp[i - 1]) / den; }
        const y = new Array(n); y[n - 1] = dp[n - 1];
        for (let i = n - 2; i >= 0; i--) y[i] = dp[i] - cp[i] * y[i + 1];
        for (const v of vecs) { let s = 0; for (let i = 0; i < n; i++) s += y[i] * v[i]; for (let i = 0; i < n; i++) y[i] -= s * v[i]; } // 和已经找到的正交（简并时有用）
        let nn = 0; for (let i = 0; i < n; i++) nn += y[i] * y[i]; nn = Math.sqrt(nn);
        x = y.map((v) => v / nn);
      }
      vecs.push(x);
    }
    return { values: vals, vectors: vecs };
  }
  // 局域交换（玩具）：照搬三维 LDA 的形式 e_x = −(3/4)(3/π)^{1/3} n^{4/3}
  const CX = 0.75 * Math.cbrt(3 / PI);
  // opt：{ Z, N（偶数，闭壳层）, xc: 'none' | 'h' | 'x2' | 'lda', mix: 'linear' | 'diis', alpha, L, n, maxIt, tol }
  // xc：'none' 不要电子间相互作用；'h' 只有 Hartree；'x2' 两个电子的精确交换 v_x = −v_H/2；'lda' Hartree 加局域交换（玩具）
  function ks1d(opt = {}) {
    const Z = opt.Z ?? 2, N = opt.N ?? 2, xc = opt.xc || 'x2', alpha = opt.alpha ?? 0.5, L = opt.L ?? 10, np = opt.n ?? 161, maxIt = opt.maxIt ?? 200, tol = opt.tol ?? 1e-8, mix = opt.mix || 'linear';
    const x = lin(-L, L, np), h = x[1] - x[0], nocc = N / 2;
    const vext = x.map((xi) => -Z / Math.sqrt(xi * xi + 1));
    const W = x.map((xi) => x.map((xj) => 1 / Math.sqrt((xi - xj) ** 2 + 1)));
    const integ = (f) => f.reduce((s, v) => s + v, 0) * h;
    const hartree = (n) => x.map((_, i) => { let s = 0; for (let j = 0; j < np; j++) s += W[i][j] * n[j]; return s * h; });
    const potentials = (n) => {
      if (xc === 'none') return { vh: x.map(() => 0), vx: x.map(() => 0) };
      const vh = hartree(n);
      const vx = xc === 'x2' ? vh.map((v) => -v / 2) : xc === 'lda' ? n.map((v) => -Math.cbrt((3 * Math.max(v, 0)) / PI)) : x.map(() => 0);
      return { vh, vx };
    };
    const solveKS = (n) => {
      const { vh, vx } = potentials(n), d = x.map((_, i) => 1 / (h * h) + vext[i] + vh[i] + vx[i]), e = Array(np - 1).fill(-1 / (2 * h * h));
      const { values, vectors } = triEig(d, e, nocc + 1);
      const orbs = vectors.slice(0, nocc).map((v) => v.map((c) => c / Math.sqrt(h)));
      const nout = x.map((_, i) => 2 * orbs.reduce((s, o) => s + o[i] * o[i], 0));
      return { eps: values, orbs, nout, vh, vx };
    };
    // 总能量：E = T_s + ∫v_ext n + E_H + E_xc（用轨道直接算，和本征值求和的写法在收敛时相等）
    const energy = (n, orbs) => {
      let Ts = 0;
      for (const o of orbs) for (let i = 0; i < np; i++) { const l = i > 0 ? o[i - 1] : 0, r = i < np - 1 ? o[i + 1] : 0; Ts += 2 * (-0.5 * o[i] * (l - 2 * o[i] + r)) / (h * h) * h; }
      const Eext = integ(n.map((v, i) => v * vext[i]));
      if (xc === 'none') return { E: Ts + Eext, Ts, Eext, EH: 0, Ex: 0 };
      const vh = hartree(n), EH = 0.5 * integ(n.map((v, i) => v * vh[i]));
      const Ex = xc === 'x2' ? -EH / 2 : xc === 'lda' ? -CX * integ(n.map((v) => Math.max(v, 0) ** (4 / 3))) : 0;
      return { E: Ts + Eext + EH + Ex, Ts, Eext, EH, Ex };
    };
    // 起点：没有相互作用的电子
    let nin = (() => { const d = x.map((_, i) => 1 / (h * h) + vext[i]), e = Array(np - 1).fill(-1 / (2 * h * h)); const { vectors } = triEig(d, e, nocc); return x.map((_, i) => 2 * vectors.reduce((s, v) => s + (v[i] * v[i]) / h, 0)); })();
    const hist = [], histIn = [], histR = [];
    let last = null, converged = false;
    for (let it = 0; it < maxIt; it++) {
      last = solveKS(nin);
      const R = last.nout.map((v, i) => v - nin[i]), res = Math.sqrt(integ(R.map((r) => r * r)));
      hist.push(res);
      if (!Number.isFinite(res)) break;
      if (res < tol) { converged = true; break; }
      if (mix === 'diis') {
        histIn.push(nin.slice()); histR.push(R);
        if (histIn.length > 6) { histIn.shift(); histR.shift(); }
        const m = histR.length, B = Array.from({ length: m + 1 }, (_, i) => Array.from({ length: m + 1 }, (_, j) => (i === m || j === m ? (i === j ? 0 : -1) : integ(histR[i].map((r, k) => r * histR[j][k])))));
        const c = solve(B, [...Array(m).fill(0), -1]);
        if (c) nin = x.map((_, k) => Math.max(0, c.slice(0, m).reduce((s, ci, i) => s + ci * (histIn[i][k] + alpha * histR[i][k]), 0)));
        else nin = nin.map((v, k) => Math.max(0, v + alpha * R[k]));
      } else nin = nin.map((v, k) => Math.max(0, v + alpha * R[k]));
      const q = integ(nin); nin = nin.map((v) => (v * N) / q); // 电子数守住
    }
    const en = energy(last.nout, last.orbs);
    return { x, h, vext, n: last.nout, eps: last.eps, orbs: last.orbs, vh: last.vh, vx: last.vx, hist, converged, iters: hist.length, ...en };
  }

  // ── 第四章：交换增强因子和均匀电子气 ───────────────────────────────
  const KAPPA = 0.804, MU_PBE = 0.2195149727645171, MU_GE = 10 / 81, BETA_B88 = 0.0042;
  const CXS = 1.5 * Math.cbrt(3 / (4 * PI)); // 每个自旋的 LDA 交换系数
  const XS = 2 ** (1 / 3) * 2 * Math.cbrt(3 * PI * PI); // x_σ = XS · s（自旋不极化）
  const FX = {
    lda: () => 1,
    ge: (s) => 1 + MU_GE * s * s,
    b88: (s) => { const x = XS * s; return 1 + ((BETA_B88 / CXS) * x * x) / (1 + 6 * BETA_B88 * x * Math.asinh(x)); },
    pbe: (s) => 1 + KAPPA - KAPPA / (1 + (MU_PBE * s * s) / KAPPA),
    revpbe: (s) => 1 + 1.245 - 1.245 / (1 + (MU_PBE * s * s) / 1.245),
    pbesol: (s) => 1 + KAPPA - KAPPA / (1 + (MU_GE * s * s) / KAPPA),
  };
  // 径向积分：Gauss–Chebyshev（第二类）加 Becke 的映射 r = r_m (1 + x)/(1 − x)。返回 [[r, 权重(含 4πr²)]]
  function radialGrid(nr, rm = 1) {
    const out = [];
    for (let i = 1; i <= nr; i++) {
      const th = (i * PI) / (nr + 1), x = Math.cos(th), w = (PI / (nr + 1)) * Math.sin(th) ** 2 / Math.sqrt(1 - x * x);
      const r = (rm * (1 + x)) / (1 - x), dr = (2 * rm) / (1 - x) ** 2;
      out.push([r, w * dr * 4 * PI * r * r]);
    }
    return out;
  }
  // 氢原子 1s 密度 n = e^{−2r}/π（完全自旋极化）。交换能按自旋标度 E_x[n↑, 0] = ½ E_x[2n↑] 来算；s 用 2n。
  function hydrogenEx(fx, nr = 400) {
    let E = 0;
    for (const [r, w] of radialGrid(nr, 1)) {
      const n = (2 * Math.exp(-2 * r)) / PI;
      if (n < 1e-250) continue; // 太远的点贡献是零（也免得 0/0）
      const s = (2 * n) / (2 * Math.cbrt(3 * PI * PI * n) * n); // |∇n| = 2n
      E += w * 0.5 * (-CX * n ** (4 / 3)) * fx(s);
    }
    return E;
  }
  // 均匀电子气：ε_x(r_s) = −(3/4)(9/(4π²))^{1/3}/r_s；PW92 关联（不极化和完全极化）
  const EPS_X = 0.75 * Math.cbrt(9 / (4 * PI * PI));
  const ueX = (rs, zeta = 0) => (-EPS_X / rs) * (zeta ? 2 ** (1 / 3) : 1);
  const PW = { 0: [0.031091, 0.2137, 7.5957, 3.5876, 1.6382, 0.49294], 1: [0.015545, 0.20548, 14.1189, 6.1977, 3.3662, 0.62517] };
  function pw92(rs, zeta = 0) {
    const [A, a1, b1, b2, b3, b4] = PW[zeta ? 1 : 0], q = 2 * A * (b1 * Math.sqrt(rs) + b2 * rs + b3 * rs ** 1.5 + b4 * rs * rs);
    return -2 * A * (1 + a1 * rs) * Math.log(1 + 1 / q);
  }
  const rsOf = (n) => Math.cbrt(3 / (4 * PI * n));

  // ── 第五章：分数电子数 ────────────────────────────────────────────
  // 精确的 E(N) 在整数之间是直线（PPLB 1982）。近似泛函加一个弯曲 b（eV）：E = E_lin + b δ(δ − 1)，b > 0 下凸（离域误差），b < 0 上凸（定域误差）。
  // N 从 N0 − 1 到 N0 + 1，E(N0) = 0。I 电离能、A 电子亲和能（eV）。
  function fracE(N, I, A, b = 0) {
    // 以 N0 = 0 为原点：N < 0 那段斜率 −I，N > 0 那段斜率 −A；δ 是 N 的小数部分，整数点上弯曲项为零
    const d = N - Math.floor(N), base = N < 0 ? -I * N : -A * N;
    return base + b * d * (d - 1);
  }
  const fracSlopes = (I, A, b) => ({ homo: -I + b, lumo: -A - b, gapExact: I - A, gapApprox: I - A - 2 * b });

  // ── 第六章：色散校正 ──────────────────────────────────────────────
  // 能量单位 kcal/mol、距离 Å。C6 的原子单位 Eh·a0⁶ = 13.7752 kcal mol⁻¹ Å⁶。
  const C6AU = 627.5094740631 * 0.529177210903 ** 6;
  const dampZero = (R, R0, sr = 1.1, a = 14) => 1 / (1 + 6 * (R / (sr * R0)) ** -a);
  const dispZero = (R, C6, R0, sr) => (-C6 / R ** 6) * dampZero(R, R0, sr);
  const dispBJ = (R, C6, R0, a1 = 0.43, a2 = 1.6) => -C6 / (R ** 6 + (a1 * R0 + a2) ** 6);
  const dispBare = (R, C6) => -C6 / R ** 6;
  // D3 的写法里 C8 = 3 C6 √(Q_A Q_B)，R0 = √(C8/C6)；这里直接用 C8 = C6 R0²，s8 是 C8 项的比例。
  const dispBJ8 = (R, C6, R0, a1 = 0.43, a2 = 1.6, s8 = 1) => dispBJ(R, C6, R0, a1, a2) - (s8 * C6 * R0 * R0) / (R ** 8 + (a1 * R0 + a2) ** 8);
  // 玩具的“半局域泛函”曲线：纯指数排斥 A e^{−bR}（自己没有色散，也没有极小）。A、b 解一次，让 排斥 + 默认的 BJ 色散（含 C8）的极小
  // 正好在 Re、深 De（Ar₂ 的实验值：Re = 3.757 Å，De = 99.55 cm⁻¹ = 0.2846 kcal/mol）。之后换阻尼、换参数时排斥不变。
  function toyRepulsion(disp, Re = 3.757, De = 99.55 / 349.755) {
    const h = 1e-5, dD = (R) => (disp(R + h) - disp(R - h)) / (2 * h);
    const fit = (b) => { const A = -dD(Re) / (-b * Math.exp(-b * Re)); return { A, b, depth: -(A * Math.exp(-b * Re) + disp(Re)) }; };
    // 深度随 b 增大而变深（排斥在 Re 处变小），二分
    let lo = 0.5, hi = 20;
    for (let i = 0; i < 100; i++) { const m = (lo + hi) / 2; if (fit(m).depth < De) lo = m; else hi = m; }
    return fit((lo + hi) / 2);
  }
  // Ar₂ 的默认参数：C6 = 64.3 au，R0 = 1.9 Å，BJ 的 a1 = 0.43、a2 = 1.6 Å（都只是让玩具模型落在实验值附近的选择）
  const AR = { C6: 64.3 * C6AU, R0: 1.9, a1: 0.43, a2: 1.6, Re: 3.757, De: 99.55 / 349.755 };
  const curveMin = (f, a, b) => { const R = goldenMin(f, a, b); return { R, E: f(R) }; };

  // ── 第七章：平面波基组和 k 点 ─────────────────────────────────────
  // 一维晶格（晶格常数 a），每个格点一个高斯阱 V(x) = −V0 exp(−x²/(2σ²))。傅里叶系数 V_G = −V0 σ√(2π)/a · exp(−G²σ²/2)。
  // 基：|k + G⟩，G = 2πm/a，|m| ≤ M。返回最低的本征值。
  function pwBands(k, M, o = {}) {
    const a = o.a ?? 4, V0 = o.V0 ?? 2, sg = o.sigma ?? 0.4, n = 2 * M + 1, H = [];
    const VG = (m) => -V0 * (sg * Math.sqrt(2 * PI) / a) * Math.exp(-0.5 * ((2 * PI * m) / a) ** 2 * sg * sg);
    for (let i = 0; i < n; i++) { H.push([]); for (let j = 0; j < n; j++) { const mi = i - M, mj = j - M; H[i].push((i === j ? 0.5 * (k + (2 * PI * mi) / a) ** 2 : 0) + VG(mi - mj)); } }
    return symEig(H);
  }
  const pwE0 = (k, M, o) => pwBands(k, M, o).values[0];
  // 基态波函数在实空间的值：ψ(x) = Σ c_m e^{i(k+G_m)x}，k = 0 时取实部（偶的基态，c_m = c_{−m}）
  function pwPsi(M, o = {}, xs) {
    const a = o.a ?? 4, c = pwBands(0, M, o).vectors[0];
    const y = xs.map((x) => c.reduce((s, cm, i) => s + cm * Math.cos((2 * PI * (i - M) * x) / a), 0));
    const nrm = Math.sqrt(y.reduce((s, v) => s + v * v, 0) * (xs[1] - xs[0]) / (xs[xs.length - 1] - xs[0]) * a) || 1;
    return y.map((v) => v / nrm);
  }
  const pwCutoff = (M, a = 4) => 0.5 * ((2 * PI * M) / a) ** 2; // 最高平面波的动能（Hartree）
  // k 点：一维紧束缚链。'metal'：单带半满，ε = −2t cos k；'insulator'：二聚化链，两条带 ±|t1 + t2 e^{ik}|，下带全满。
  // nk 个 Monkhorst–Pack 点 k_j = (2j − nk − 1)π/nk。smear：Fermi–Dirac 展宽宽度（单位 t），0 表示不展宽。返回每个格点的带能（含自旋 2）。
  function bandEnergy(kind, nk, smear = 0, t = 1, t2 = 0.6) {
    const ks = Array.from({ length: nk }, (_, j) => ((2 * (j + 1) - nk - 1) * PI) / nk);
    if (kind === 'insulator') { let s = 0; for (const k of ks) s += -Math.hypot(t + t2 * Math.cos(k), t2 * Math.sin(k)); return (2 * s) / nk / 2; }
    const eps = ks.map((k) => -2 * t * Math.cos(k));
    if (!smear) { let s = 0; for (const e of eps) if (e < -1e-12) s += 2 * e; else if (Math.abs(e) <= 1e-12) s += e; return s / nk; }
    // 展宽：调 μ 让电子数守住（半满每个格点 1 个电子），μ = 0 由对称性保证
    let s = 0; for (const e of eps) s += (2 * e) / (1 + Math.exp(e / smear)); return s / nk;
  }
  const bandExact = (kind, t = 1, t2 = 0.6) => {
    if (kind === 'metal') return (-4 * t) / PI;
    let s = 0; const n = 20000; for (let j = 0; j < n; j++) { const k = -PI + ((j + 0.5) * 2 * PI) / n; s += -Math.hypot(t + t2 * Math.cos(k), t2 * Math.sin(k)); } return s / n;
  };

  // ── 第八章：Birch–Murnaghan 状态方程 ──────────────────────────────
  // E 用 eV、V 用 Å³、B 用 GPa（1 eV/Å³ = 160.21766 GPa）
  const GPA = 160.21766208;
  function bmE(V, V0, B0, Bp, E0 = 0) { const b = B0 / GPA, eta = (V0 / V) ** (2 / 3) - 1; return E0 + ((9 * V0 * b) / 16) * (eta ** 3 * Bp + eta ** 2 * (6 - 4 * (V0 / V) ** (2 / 3))); }
  function bmP(V, V0, B0, Bp) { const y = (V0 / V) ** (1 / 3); return 1.5 * B0 * (y ** 7 - y ** 5) * (1 + 0.75 * (Bp - 4) * (y * y - 1)); }
  // 三阶 BM 的 E(V) 恰好是 x = V^{−2/3} 的三次多项式：线性最小二乘拟合，再从多项式读出 V0、B0、B0'
  function bmFit(Vs, Es) {
    const X = Vs.map((v) => v ** (-2 / 3)), A = [[0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0], [0, 0, 0, 0]], b = [0, 0, 0, 0];
    X.forEach((x, k) => { const row = [1, x, x * x, x ** 3]; for (let i = 0; i < 4; i++) { b[i] += row[i] * Es[k]; for (let j = 0; j < 4; j++) A[i][j] += row[i] * row[j]; } });
    const c = solve(A, b);
    if (!c) return null;
    const E = (v) => { const x = v ** (-2 / 3); return c[0] + c[1] * x + c[2] * x * x + c[3] * x ** 3; };
    const V0 = goldenMin(E, Math.min(...Vs) * 0.8, Math.max(...Vs) * 1.2, 1e-12), hV = V0 * 1e-3;
    const d2 = (E(V0 + hV) - 2 * E(V0) + E(V0 - hV)) / (hV * hV), B0 = V0 * d2 * GPA;
    const Bv = (v) => { const hh = v * 1e-3; return v * (E(v + hh) - 2 * E(v) + E(v - hh)) / (hh * hh); }, dB = (Bv(V0 * 1.002) - Bv(V0 * 0.998)) / (V0 * 0.004);
    return { V0, B0, Bp: -V0 * dB / Bv(V0), E0: E(V0), E };
  }
  // 可重复的伪随机数（mulberry32），加噪声用
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * PI * r());

  // ── 第九章：两能级 Casida 模型和电荷转移 ───────────────────────────
  // 单个占据—空轨道对，轨道能差 Δ，耦合积分 K（Hartree 部分 KH，交换关联部分 Kxc，都按自旋分开写）：
  //   单态 ω_S² = Δ² + 2Δ(2KH + Kxc↑↑ + Kxc↑↓)，三态 ω_T² = Δ² + 2Δ(Kxc↑↑ − Kxc↑↓)（Casida 1995 的单极点形式）
  function casida(D, KH, Kpp, Kpm) { const s = D * D + 2 * D * (2 * KH + Kpp + Kpm), t = D * D + 2 * D * (Kpp - Kpm); return { S: Math.sqrt(Math.max(0, s)), T: Math.sqrt(Math.max(0, t)), TDA_S: D + 2 * KH + Kpp + Kpm, TDA_T: D + Kpp - Kpm }; }
  // 给体—受体相距 R（Å）时的电荷转移激发（eV）。精确的渐近：IP_D − EA_A − 1/R；
  // 半局域泛函：轨道能差 ε_L(A) − ε_H(D)，轨道不重叠，核函数的贡献是零；长程混入 α 的精确交换：再减 α/R，轨道能也朝 IP、EA 靠 α 的比例。
  const HARTREE_EV = 27.211386245988, BOHR_A = 0.529177210903;
  function ctEnergy(R, IP, EA, gapError, alphaLR) {
    const coul = (HARTREE_EV * BOHR_A) / R; // 1/R，eV
    return { exact: IP - EA - coul, dfa: IP - EA - gapError * (1 - alphaLR) - alphaLR * coul };
  }

  // ── 第十章：积分格点 ──────────────────────────────────────────────
  // 氢原子：∫n 和 LDA 交换能对径向点数的收敛。H₂：两个 1s 的成键密度，球面用 Gauss–Legendre(θ) × 均匀(φ) 的积格点，
  // becke = true 时用 Becke 的模糊分割（多项式迭代三次）把积分分到两个原子上，否则只用一个原子的格点（中心在 A）。
  function gaussLegendre(n) {
    const x = [], w = [];
    for (let i = 1; i <= n; i++) {
      let z = Math.cos((PI * (i - 0.25)) / (n + 0.5)), pp = 0;
      for (let it = 0; it < 100; it++) { let p1 = 1, p2 = 0; for (let j = 1; j <= n; j++) { const p3 = p2; p2 = p1; p1 = ((2 * j - 1) * z * p2 - (j - 1) * p3) / j; } pp = (n * (z * p1 - p2)) / (z * z - 1); const z1 = z; z = z1 - p1 / pp; if (Math.abs(z - z1) < 1e-15) break; }
      x.push(z); w.push(2 / ((1 - z * z) * pp * pp));
    }
    return { x, w };
  }
  const EX_LDA_H = (-0.75 * Math.cbrt(6 / PI) * (27 / 64)) / Math.cbrt(PI); // LSDA 交换，解析：−(3/4)(6/π)^{1/3}·(27/64)·π^{−1/3} ≈ −0.2680
  function hAtomGrid(nr) {
    let N = 0, Ex = 0;
    for (const [r, w] of radialGrid(nr, 1)) { const n = Math.exp(-2 * r) / PI; N += w * n; Ex += w * -0.75 * Math.cbrt(6 / PI) * n ** (4 / 3); }
    return { N, Ex, errN: N - 1, errEx: Ex - EX_LDA_H };
  }
  function h2Grid(nr, nth, becke = true, R = 1.4) {
    const A = [0, 0, -R / 2], B = [0, 0, R / 2], S = Math.exp(-R) * (1 + R + (R * R) / 3); // 1s 重叠积分
    const phi = (p, c) => Math.exp(-Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2])) / Math.sqrt(PI);
    const dens = (p) => { const s = phi(p, A) + phi(p, B); return (s * s) / (1 + S); }; // 两个电子
    const gl = gaussLegendre(nth), nph = 2 * nth, rg = radialGrid(nr, 1);
    const cell = (p, i) => { // Becke 权重
      const C = [A, B], d = C.map((c) => Math.hypot(p[0] - c[0], p[1] - c[1], p[2] - c[2]));
      const s = (mu) => { let f = mu; for (let k = 0; k < 3; k++) f = 1.5 * f - 0.5 * f ** 3; return 0.5 * (1 - f); };
      const P = [s((d[0] - d[1]) / R), s((d[1] - d[0]) / R)];
      return P[i] / (P[0] + P[1]);
    };
    let total = 0, pts = 0;
    for (const [ci, c] of (becke ? [A, B] : [A]).entries()) {
      for (const [r, wr] of rg) for (let a = 0; a < nth; a++) for (let b = 0; b < nph; b++) {
        const ct = gl.x[a], st = Math.sqrt(1 - ct * ct), ph = (2 * PI * (b + 0.5)) / nph, w = (wr / (4 * PI)) * gl.w[a] * ((2 * PI) / nph);
        const p = [c[0] + r * st * Math.cos(ph), c[1] + r * st * Math.sin(ph), c[2] + r * ct];
        total += w * dens(p) * (becke ? cell(p, ci) : 1); pts++;
      }
    }
    return { N: total, err: total - 2, pts };
  }

  window.MOLASTRIA_DFT_MODELS = {
    lin, symEig, solve, goldenMin,
    TF, SCHWINGER, tfEnergy, ATOMS,
    dimer, dimerDnS, dimerVs, dimerTs, dimerInvert,
    triEig, ks1d,
    FX, KAPPA, MU_PBE, MU_GE, BETA_B88, XS, CXS, radialGrid, hydrogenEx, ueX, pw92, rsOf, EPS_X,
    fracE, fracSlopes,
    AR, C6AU, dampZero, dispZero, dispBJ, dispBJ8, dispBare, toyRepulsion, curveMin,
    pwBands, pwE0, pwPsi, pwCutoff, bandEnergy, bandExact,
    GPA, bmE, bmP, bmFit, rng, gauss,
    casida, ctEnergy, HARTREE_EV, BOHR_A,
    gaussLegendre, EX_LDA_H, hAtomGrid, h2Grid,
  };
})();
