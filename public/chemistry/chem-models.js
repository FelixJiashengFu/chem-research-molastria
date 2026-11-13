/* 化学学科馆 · 演示的数学：十五个展馆的演示用到的全部计算，都是纯函数（不碰 DOM），由 tools/chemistry-test.mjs 对照解析解和已知数值测。
   单位写在函数旁边；常数用 CODATA 2018 的精确值或推荐值。各展馆的演示（<id>/demos.js）只负责控件和画图。 */
(() => {
  'use strict';
  const M = {};
  // ── 常数 ────────────────────────────────────────────────────────────────
  M.R = 8.314462618;          // J mol⁻¹ K⁻¹
  M.F = 96485.33212;          // C mol⁻¹
  M.kB = 1.380649e-23;        // J K⁻¹
  M.h = 6.62607015e-34;       // J s
  M.NA = 6.02214076e23;       // mol⁻¹
  M.c = 299792458;            // m s⁻¹
  M.e = 1.602176634e-19;      // C
  M.me = 9.1093837015e-31;    // kg
  M.eps0 = 8.8541878128e-12;  // F m⁻¹
  M.amu = 1.66053906660e-27;  // kg
  M.eV = 96.485332;           // kJ mol⁻¹ per eV
  M.linspace = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  // 二分法求根：f(a)、f(b) 异号
  M.bisect = (f, a, b, tol = 1e-12, it = 200) => {
    let fa = f(a);
    for (let i = 0; i < it; i++) { const m = (a + b) / 2, fm = f(m); if (Math.abs(b - a) < tol || fm === 0) return m; if ((fm < 0) === (fa < 0)) { a = m; fa = fm; } else b = m; }
    return (a + b) / 2;
  };
  // 实对称矩阵的全部本征值和本征向量（Jacobi 旋转），返回按本征值从小到大排好的 { values, vectors }，vectors[k] 是第 k 个本征向量
  M.jacobi = (A0) => {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = A.map((_, i) => i).sort((a, b) => A[a][a] - A[b][b]);
    return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => V.map((r) => r[i])) };
  };

  // ═════ 01 无机化学 ═════════════════════════════════════════════════════
  M.SYMBOLS = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca', 'Sc', 'Ti', 'V', 'Cr', 'Mn', 'Fe', 'Co', 'Ni', 'Cu', 'Zn', 'Ga', 'Ge', 'As', 'Se', 'Br', 'Kr', 'Rb', 'Sr', 'Y', 'Zr', 'Nb', 'Mo', 'Tc', 'Ru', 'Rh', 'Pd', 'Ag', 'Cd', 'In', 'Sn', 'Sb', 'Te', 'I', 'Xe'];
  // 构造原理的填充顺序（Madelung 规则），以及 Z ≤ 54 里基态排布不按这个顺序的元素
  const ORDER = [[1, 0], [2, 0], [2, 1], [3, 0], [3, 1], [4, 0], [3, 2], [4, 1], [5, 0], [4, 2], [5, 1]];
  const CAP = (l) => 2 * (2 * l + 1);
  const EXCEPT = { 24: { '3,2': 5, '4,0': 1 }, 29: { '3,2': 10, '4,0': 1 }, 41: { '4,2': 4, '5,0': 1 }, 42: { '4,2': 5, '5,0': 1 }, 44: { '4,2': 7, '5,0': 1 }, 45: { '4,2': 8, '5,0': 1 }, 46: { '4,2': 10, '5,0': 0 }, 47: { '4,2': 10, '5,0': 1 } };
  // 基态电子排布：[[n, l, 电子数]…]，按 n、l 排好
  M.config = (Z) => {
    let left = Z;
    const occ = {};
    for (const [n, l] of ORDER) { if (left <= 0) break; const k = Math.min(left, CAP(l)); occ[`${n},${l}`] = k; left -= k; }
    if (EXCEPT[Z]) Object.assign(occ, EXCEPT[Z]);
    return Object.entries(occ).filter(([, k]) => k > 0).map(([key, k]) => { const [n, l] = key.split(',').map(Number); return [n, l, k]; }).sort((a, b) => a[0] - b[0] || a[1] - b[1]);
  };
  M.configText = (Z) => M.config(Z).map(([n, l, k]) => `${n}${'spdf'[l]}${String(k).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`).join(' ');
  // Slater 规则：第 Z 号元素中一个 (n, l) 电子感受到的屏蔽常数 σ 和有效核电荷 Z* = Z − σ（Slater 1930）
  M.slater = (Z, n, l) => {
    const cfg = M.config(Z), grp = (nn, ll) => (ll <= 1 ? `${nn}sp` : `${nn}${'spdf'[ll]}`);
    const order = (nn, ll) => (ll <= 1 ? nn * 10 : nn * 10 + ll + 0.5); // 组的先后：(1s)(2s,2p)(3s,3p)(3d)(4s,4p)(4d)(4f)(5s,5p)…
    const me = grp(n, l), mine = order(n, l);
    let sigma = 0;
    for (const [nn, ll, k] of cfg) {
      const g = grp(nn, ll), o = order(nn, ll), cnt = g === me ? k - 1 : k;
      if (cnt <= 0) continue;
      if (g === me) sigma += cnt * (n === 1 ? 0.30 : 0.35);
      else if (o > mine) continue;
      else if (l >= 2) sigma += cnt * 1.0;
      else if (nn === n - 1) sigma += cnt * 0.85;
      else if (nn < n - 1) sigma += cnt * 1.0;
      else sigma += cnt * 1.0; // 同 n 的 d、f 电子在 s、p 外层之前时算全屏蔽（只出现在 n 更小的组里）
    }
    return { sigma, zeff: Z - sigma };
  };
  // 最外层（最高 n，再取最高 l）的电子
  M.valence = (Z) => { const cfg = M.config(Z), nmax = Math.max(...cfg.map((c) => c[0])), outer = cfg.filter((c) => c[0] === nmax).sort((a, b) => b[1] - a[1])[0]; return { n: outer[0], l: outer[1] }; };
  // 第一电离能（eV），H–Kr。NIST 原子光谱数据库的数值，由编者按手册录入（云端连不上 NIST，没有逐条联网核对）
  M.IE1 = [null, 13.598, 24.587, 5.392, 9.323, 8.298, 11.260, 14.534, 13.618, 17.423, 21.565, 5.139, 7.646, 5.986, 8.152, 10.487, 10.360, 12.968, 15.760, 4.341, 6.113, 6.561, 6.828, 6.746, 6.767, 7.434, 7.902, 7.881, 7.640, 7.726, 9.394, 5.999, 7.900, 9.789, 9.752, 11.814, 14.000];
  // Slater 轨道指数给出的“类氢”估计：IE ≈ 13.606 eV × (Z*/n*)²，n* 是 Slater 的有效主量子数
  M.nStar = (n) => [0, 1, 2, 3, 3.7, 4.0, 4.2][n];
  M.slaterIE = (Z) => { const v = M.valence(Z), z = M.slater(Z, v.n, v.l).zeff; return 13.606 * (z / M.nStar(v.n)) ** 2; };

  // Born–Haber 循环（kJ/mol）：ΔfH = ΔsubH(M) + ΣIE(M) + ½D 或 ΔatH(X) + ΣEA(X) − U，由此求晶格能 U
  M.bornHaberU = (c) => c.sub + c.ie + c.atom + c.ea - c.dfH;
  // Kapustinskii 方程（kJ/mol）：U = K ν |z₊z₋| / (r₊ + r₋) · (1 − d/(r₊ + r₋))，K = 1.2025×10⁻⁴ J m mol⁻¹，d = 3.45×10⁻¹¹ m；半径用 pm
  M.kapustinskii = (nu, zp, zm, rp, rm) => { const r = (rp + rm) * 1e-12; return (1.2025e-4 * nu * Math.abs(zp * zm) / r) * (1 - 3.45e-11 / r) / 1000; };
  // Born–Landé（kJ/mol）：U = N_A M |z₊z₋| e² / (4πε₀ r₀) · (1 − 1/n)
  M.bornLande = (madelung, zp, zm, r0pm, nBorn) => (M.NA * madelung * Math.abs(zp * zm) * M.e ** 2 / (4 * Math.PI * M.eps0 * r0pm * 1e-12)) * (1 - 1 / nBorn) / 1000;

  // Frost 图：给一串相邻氧化态之间的标准电势（V），按 nE° 累加。couples：[[高氧化态, 低氧化态, E°]…]，以 0 价为零点
  M.frost = (couples) => {
    const pts = { 0: 0 }, list = couples.slice();
    for (let guard = 0; guard < 20 && list.length; guard++) for (let i = list.length - 1; i >= 0; i--) {
      const [hi, lo, E] = list[i];
      if (pts[lo] !== undefined && pts[hi] === undefined) { pts[hi] = pts[lo] + (hi - lo) * E; list.splice(i, 1); }
      else if (pts[hi] !== undefined && pts[lo] === undefined) { pts[lo] = pts[hi] - (hi - lo) * E; list.splice(i, 1); }
      else if (pts[hi] !== undefined && pts[lo] !== undefined) list.splice(i, 1);
    }
    return Object.keys(pts).map(Number).sort((a, b) => a - b).map((n) => [n, pts[n]]);
  };
  // 一个中间氧化态会不会歧化：它在两侧邻点连线的上方（凸起）就会
  M.disproportionates = (pts, i) => { if (i <= 0 || i >= pts.length - 1) return false; const [x0, y0] = pts[i - 1], [x1, y1] = pts[i], [x2, y2] = pts[i + 1]; return y1 > y0 + ((y2 - y0) * (x1 - x0)) / (x2 - x0) + 1e-9; };

  // ═════ 02 有机化学 ═════════════════════════════════════════════════════
  // 三项 Fourier 扭转势（kJ/mol），φ 用度，φ = 180° 是反式
  M.torsion = (phiDeg, V1, V2, V3) => { const p = (phiDeg * Math.PI) / 180; return (V1 / 2) * (1 + Math.cos(p)) + (V2 / 2) * (1 - Math.cos(2 * p)) + (V3 / 2) * (1 + Math.cos(3 * p)); };
  // 由 φ = 60°（邻位交叉）、120°（重叠）、0°（顺叠）三个能量解出 V₁、V₂、V₃：E0 = V1 + V3，E60 = 0.75 (V1 + V2)，E120 = 0.25 V1 + 0.75 V2 + V3
  M.torsionFit = (E60, E120, E0) => { const V1 = (E60 / 0.75 - (E120 - E0) / 0.75) / 2, V2 = E60 / 0.75 - V1, V3 = E0 - V1; return [V1, V2, V3]; };
  // 各构象的 Boltzmann 布居：按 φ 积分 exp(−V/RT)，返回反式区（120°–240°）的比例和整条分布（每度一个点）
  M.torsionPop = (V1, V2, V3, T) => {
    const RT = (M.R * T) / 1000, w = [];
    for (let d = 0; d < 360; d++) w.push(Math.exp(-M.torsion(d, V1, V2, V3) / RT));
    const Z = w.reduce((a, b) => a + b, 0), anti = w.slice(120, 240).reduce((a, b) => a + b, 0) / Z;
    return { anti, gauche: 1 - anti, density: w.map((x) => x / Z) };
  };
  // 环己烷：A 值（kJ/mol）给出的平伏比例
  M.equatorial = (A, T) => 1 / (1 + Math.exp(-(A * 1000) / (M.R * T)));
  // Eyring 方程：ΔG‡（kJ/mol）、T（K）→ k（s⁻¹）
  M.eyring = (dG, T) => ((M.kB * T) / M.h) * Math.exp(-(dG * 1000) / (M.R * T));
  // 酸碱反应 HA + B⁻ ⇌ A⁻ + HB：log K = pKa(HB) − pKa(HA)；等物质的量混合时的转化率 x，x²/(1 − x)² = K
  M.acidBase = (pKaHA, pKaHB) => { const logK = pKaHB - pKaHA, r = 10 ** (logK / 2); return { logK, K: 10 ** logK, x: r / (1 + r) }; };
  // Hammett：k_X/k_H = 10^(ρσ)
  M.hammett = (rho, sigma) => 10 ** (rho * sigma);
  // 对映体比 → ee 和 ΔΔG‡（kJ/mol）
  M.ee = (major, minor) => (major - minor) / (major + minor);
  M.ddG = (ratio, T) => (M.R * T * Math.log(ratio)) / 1000;

  // ═════ 03 物理化学 ═════════════════════════════════════════════════════
  // Maxwell–Boltzmann 速率分布：v（m/s）、摩尔质量 Mkg（kg/mol）、T（K）→ 概率密度（s/m）
  M.mb = (v, Mkg, T) => { const a = Mkg / (2 * M.R * T); return 4 * Math.PI * (a / Math.PI) ** 1.5 * v * v * Math.exp(-a * v * v); };
  M.speeds = (Mkg, T) => ({ mp: Math.sqrt((2 * M.R * T) / Mkg), mean: Math.sqrt((8 * M.R * T) / (Math.PI * Mkg)), rms: Math.sqrt((3 * M.R * T) / Mkg) });
  // van der Waals：Vm（L/mol）、T（K）、a（L² bar mol⁻²）、b（L/mol）→ p（bar）
  M.Rbar = 0.0831446;
  M.vdwP = (Vm, T, a, b) => (M.Rbar * T) / (Vm - b) - a / (Vm * Vm);
  M.vdwCrit = (a, b) => ({ Tc: (8 * a) / (27 * M.Rbar * b), pc: a / (27 * b * b), Vc: 3 * b });
  // 合成氨 N₂ + 3H₂ ⇌ 2NH₃，原料 1 : 3，理想气体，ΔH°（kJ/mol）和 ΔS°（J/(mol K)）取常数。p 用 bar。
  // 返回 K、反应进度 ξ（每摩尔 N₂）和平衡时 NH₃ 的摩尔分数
  // dCp（J/(mol K)）不为零时按 Kirchhoff 修正：ΔH(T) = ΔH° + ΔCp (T − 298.15)，ΔS(T) = ΔS° + ΔCp ln(T/298.15)
  M.haber = (T, p, dCp = 0, dH = -92.2, dS = -198.1) => {
    const H = dH * 1000 + dCp * (T - 298.15), S = dS + dCp * Math.log(T / 298.15), lnK = -(H - T * S) / (M.R * T);
    const lnQ = (xi) => 2 * Math.log(2 * xi) + 2 * Math.log(4 - 2 * xi) - Math.log(1 - xi) - 3 * Math.log(3 * (1 - xi)) - 2 * Math.log(p);
    const xi = M.bisect((x) => lnQ(x) - lnK, 1e-12, 1 - 1e-12);
    return { K: Math.exp(lnK), lnK, xi, y: (2 * xi) / (4 - 2 * xi) };
  };
  // 连续一级反应 A → B → C，[A]₀ = 1
  M.consecutive = (k1, k2, t) => {
    const A = Math.exp(-k1 * t);
    const B = Math.abs(k1 - k2) < 1e-12 * Math.max(k1, k2) ? k1 * t * Math.exp(-k1 * t) : (k1 / (k2 - k1)) * (Math.exp(-k1 * t) - Math.exp(-k2 * t));
    return { A, B, C: 1 - A - B };
  };
  M.tmaxB = (k1, k2) => (Math.abs(k1 - k2) < 1e-12 * Math.max(k1, k2) ? 1 / k1 : Math.log(k1 / k2) / (k1 - k2));
  // 线型刚性转子的转动布居：B（cm⁻¹）、T（K）→ { pops（J = 0…Jmax）, q }。σ 是对称数（只除配分函数，不处理核自旋的奇偶交替）
  M.c2 = 1.438776877; // 第二辐射常数 hc/k_B，cm K
  M.rotPop = (B, T, Jmax = 60, sigma = 1) => {
    const w = Array.from({ length: Jmax + 1 }, (_, J) => (2 * J + 1) * Math.exp((-M.c2 * B * J * (J + 1)) / T)), q = w.reduce((a, b) => a + b, 0);
    return { pops: w.map((x) => x / q), q: q / sigma };
  };
  M.Jmax = (B, T) => Math.sqrt(T / (2 * M.c2 * B)) - 0.5;
  // Arrhenius：由两个温度的速率比求 Ea（kJ/mol）
  M.arrheniusEa = (ratio, T1, T2) => (M.R * Math.log(ratio)) / (1 / T1 - 1 / T2) / 1000;
  M.langmuir = (K, p) => (K * p) / (1 + K * p);

  // ═════ 04 分析化学 ═════════════════════════════════════════════════════
  M.Kw = 1.0e-14;
  // n 元酸各型体的分布分数 α₀…αₙ（α_j：失去 j 个质子），pKas 从小到大
  M.alphas = (pH, pKas) => {
    const h = 10 ** -pH, n = pKas.length, terms = [];
    let prodK = 1;
    for (let j = 0; j <= n; j++) { if (j > 0) prodK *= 10 ** -pKas[j - 1]; terms.push(h ** (n - j) * prodK); }
    // 用对数避免下溢：按最大项归一
    const tot = terms.reduce((a, b) => a + b, 0);
    return terms.map((t) => t / tot);
  };
  M.alphasLog = (pH, pKas) => { // 数值稳的版本：log 域求和
    const n = pKas.length, lt = [];
    let s = 0;
    for (let j = 0; j <= n; j++) { if (j > 0) s -= pKas[j - 1]; lt.push(-(n - j) * pH + s); }
    const mx = Math.max(...lt), w = lt.map((x) => 10 ** (x - mx)), tot = w.reduce((a, b) => a + b, 0);
    return w.map((x) => x / tot);
  };
  // 用浓度 Cb 的 NaOH 滴定体积 Va、浓度 Ca 的 n 元酸，加入 Vb 时的 pH（解电荷平衡，忽略活度）
  M.titrationPH = (Ca, Va, Cb, Vb, pKas) => {
    const V = Va + Vb, Ct = (Ca * Va) / V, Na = (Cb * Vb) / V;
    const F = (pH) => { const h = 10 ** -pH, a = M.alphasLog(pH, pKas); let nbar = 0; a.forEach((x, j) => { nbar += j * x; }); return h + Na - M.Kw / h - Ct * nbar; };
    return M.bisect(F, -2, 16, 1e-10);
  };
  // 可重复的伪随机数（mulberry32）和标准正态
  M.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  M.gauss = (r) => { let u = 0; while (u === 0) u = r(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * r()); };
  // 最小二乘直线
  M.linfit = (xs, ys) => {
    const n = xs.length, xb = xs.reduce((a, b) => a + b, 0) / n, yb = ys.reduce((a, b) => a + b, 0) / n;
    let sxx = 0, sxy = 0; xs.forEach((x, i) => { sxx += (x - xb) ** 2; sxy += (x - xb) * (ys[i] - yb); });
    const b1 = sxy / sxx, b0 = yb - b1 * xb, ss = ys.reduce((a, y, i) => a + (y - b0 - b1 * xs[i]) ** 2, 0), syx = Math.sqrt(ss / (n - 2));
    const syy = ys.reduce((a, y) => a + (y - yb) ** 2, 0);
    return { n, b0, b1, syx, sxx, xb, yb, r2: 1 - ss / syy };
  };
  // 由信号 y0（m 次平均）反推浓度和它的标准偏差
  M.calibX = (f, y0, m = 1) => ({ x0: (y0 - f.b0) / f.b1, sx0: (f.syx / f.b1) * Math.sqrt(1 / m + 1 / f.n + (y0 - f.yb) ** 2 / (f.b1 * f.b1 * f.sxx)) });
  // 双侧 95 % 的 t 值（自由度 1–30，再大用 1.96 附近的近似）
  M.t95 = (df) => [NaN, 12.706, 4.303, 3.182, 2.776, 2.571, 2.447, 2.365, 2.306, 2.262, 2.228, 2.201, 2.179, 2.160, 2.145, 2.131, 2.120, 2.110, 2.101, 2.093, 2.086, 2.080, 2.074, 2.069, 2.064, 2.060, 2.056, 2.052, 2.048, 2.045, 2.042][df] || 1.96 + 2.4 / df;
  // van Deemter：H = A + B/u + Cu；分离度（Purnell）
  M.vanDeemter = (u, A, B, C) => A + B / u + C * u;
  M.resolution = (N, alpha, k) => (Math.sqrt(N) / 4) * ((alpha - 1) / alpha) * (k / (1 + k));

  window.MOLASTRIA_CHEM_MODELS = M;
})();
