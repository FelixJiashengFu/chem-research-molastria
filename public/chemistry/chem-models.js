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

  // ── 05 结构化学 ─────────────────────────────────────────────────────────
  M.hydrogenE = (Z, n) => (-13.605693 * Z * Z) / (n * n);       // eV
  M.nodes = (n, l) => ({ radial: n - l - 1, angular: l });
  // 第二周期同核双原子分子的价层分子轨道：[名字, 简并度, 成键 +1 / 反键 −1]；mixed 是有 s–p 混合的顺序（Li₂–N₂）
  M.MO_ORDER = {
    mixed: [['σ2s', 1, 1], ['σ*2s', 1, -1], ['π2p', 2, 1], ['σ2p', 1, 1], ['π*2p', 2, -1], ['σ*2p', 1, -1]],
    plain: [['σ2s', 1, 1], ['σ*2s', 1, -1], ['σ2p', 1, 1], ['π2p', 2, 1], ['π*2p', 2, -1], ['σ*2p', 1, -1]],
  };
  // 按 Aufbau 和 Hund 规则填 nel 个价电子；spins[k] 是第 k 个简并轨道上的电子数
  M.moFill = (nel, mixed) => {
    let left = nel, b = 0, a = 0, unp = 0;
    const occ = M.MO_ORDER[mixed ? 'mixed' : 'plain'].map(([key, deg, sign]) => {
      const put = Math.max(0, Math.min(left, 2 * deg)); left -= put;
      const spins = Array.from({ length: deg }, (_, k) => (put > k ? 1 : 0) + (put > deg + k ? 1 : 0));
      if (sign > 0) b += put; else a += put;
      unp += spins.filter((x) => x === 1).length;
      return { key, deg, sign, n: put, spins };
    });
    return { occ, bonding: b, anti: a, order: (b - a) / 2, unpaired: unp };
  };
  // 点群判定流程。f：linear、i、cubic（'Td' | 'Oh' | 'Ih' …）、n（主轴次数，没有轴为 1）、perp（n 条垂直 C₂）、sh、sv（σv 或 σd）、s2n、sigma（有没有镜面）
  M.pointGroup = (f) => {
    const steps = [], ask = (q, v) => (steps.push([q, !!v]), !!v);
    if (ask('linear', f.linear)) return { group: ask('i', f.i) ? 'D∞h' : 'C∞v', steps };
    if (ask('cubic', f.cubic)) return { group: f.cubic, steps };
    if (!ask('cn', f.n >= 2)) return { group: ask('sigma', f.sigma) ? 'Cs' : ask('i', f.i) ? 'Ci' : 'C1', steps };
    const n = f.n;
    if (ask('perp', f.perp)) return { group: ask('sh', f.sh) ? `D${n}h` : ask('sd', f.sv) ? `D${n}d` : `D${n}`, steps };
    return { group: ask('sh', f.sh) ? `C${n}h` : ask('sv', f.sv) ? `C${n}v` : ask('s2n', f.s2n) ? `S${2 * n}` : `C${n}`, steps };
  };
  M.groupOrder = (g) => {
    const fixed = { C1: 1, Cs: 2, Ci: 2, T: 12, Td: 24, Th: 24, O: 24, Oh: 48, I: 60, Ih: 120 };
    if (g in fixed) return fixed[g];
    if (g.includes('∞')) return Infinity;
    const m = /^([CDS])(\d+)([vhd]?)$/.exec(g); if (!m) return NaN;
    const n = Number(m[2]);
    return m[1] === 'S' ? n : m[1] === 'C' ? (m[3] ? 2 * n : n) : m[3] ? 4 * n : 2 * n;
  };
  M.chiralGroup = (g) => /^(C\d+|D\d+|T|O|I)$/.test(g);            // 没有任何非真转动
  M.polarGroup = (g) => /^(C1|Cs|C\d+|C\d+v|C∞v)$/.test(g);        // 可以有永久偶极矩
  // 立方晶胞：基元的分数坐标。A、B 是两种原子（单质只有 A）
  M.cubicCell = (type) => {
    const F = [[0, 0, 0], [0.5, 0.5, 0], [0.5, 0, 0.5], [0, 0.5, 0.5]], sh = (ps, d) => ps.map((p) => p.map((x, i) => (x + d[i]) % 1));
    const A = (ps) => ps.map((p) => ({ s: 'A', p })), B = (ps) => ps.map((p) => ({ s: 'B', p }));
    const T8 = [0.25, 0.75].flatMap((x) => [0.25, 0.75].flatMap((y) => [0.25, 0.75].map((z) => [x, y, z])));
    return {
      sc: () => A([[0, 0, 0]]), bcc: () => A([[0, 0, 0], [0.5, 0.5, 0.5]]), fcc: () => A(F),
      diamond: () => A([...F, ...sh(F, [0.25, 0.25, 0.25])]), rocksalt: () => [...A(F), ...B(sh(F, [0.5, 0, 0]))],
      cscl: () => [...A([[0, 0, 0]]), ...B([[0.5, 0.5, 0.5]])], zincblende: () => [...A(F), ...B(sh(F, [0.25, 0.25, 0.25]))],
      fluorite: () => [...A(F), ...B(T8)],
    }[type]();
  };
  // 原子散射因子的粗略近似：f ≈ Z·exp(−2.5 s²)，s = sinθ/λ（Å⁻¹）。只给相对强度的趋势
  M.fApprox = (Z, s) => Z * Math.exp(-2.5 * s * s);
  // 立方晶体的粉末衍射：a、λ 以 pm 计；atoms 是 [{ Z, p }]。同一个 N = h² + k² + l² 的所有衍射叠在一起（自动计入多重度）
  M.powder = (a, lam, atoms, tthMax = 150) => {
    const Nmax = Math.floor(((2 * a) / lam * Math.sin(((tthMax / 2) * Math.PI) / 180)) ** 2), H = Math.ceil(Math.sqrt(Nmax)), acc = new Map();
    for (let h = -H; h <= H; h++) for (let k = -H; k <= H; k++) for (let l = -H; l <= H; l++) {
      const N = h * h + k * k + l * l; if (!N || N > Nmax) continue;
      const s = (Math.sqrt(N) / (2 * a)) * 100;
      let re = 0, im = 0;
      for (const at of atoms) { const ph = 2 * Math.PI * (h * at.p[0] + k * at.p[1] + l * at.p[2]), f = M.fApprox(at.Z, s); re += f * Math.cos(ph); im += f * Math.sin(ph); }
      const F2 = re * re + im * im, fam = [Math.abs(h), Math.abs(k), Math.abs(l)].sort((x, y) => y - x).join('');
      const e = acc.get(N) || { N, F2: 0, fams: new Map() }; e.F2 += F2; e.fams.set(fam, (e.fams.get(fam) || 0) + F2); acc.set(N, e);
    }
    const out = [...acc.values()].sort((x, y) => x.N - y.N).map((e) => {
      const d = a / Math.sqrt(e.N), th = Math.asin(lam / (2 * d)), lp = (1 + Math.cos(2 * th) ** 2) / (Math.sin(th) ** 2 * Math.cos(th));
      return { N: e.N, d, tth: (2 * th * 180) / Math.PI, I: e.F2 * lp, F2: e.F2, hkl: [...e.fams.keys()], on: [...e.fams].filter(([, v]) => v > 1e-6).map(([k]) => k) };
    });
    const mx = Math.max(...out.map((r) => r.I));
    for (const r of out) { r.I = (100 * r.I) / mx; r.absent = r.I < 1e-6; }
    return out;
  };
  // 堆积：晶胞体积（pm³）、由晶胞求密度（g/cm³）、相切时的原子半径
  M.cellVolume = (type, a, c) => (type === 'hcp' ? (Math.sqrt(3) / 2) * a * a * c : a ** 3);
  M.cellDensity = (Z, Mg, Vpm3) => (Z * Mg) / (M.NA * Vpm3 * 1e-30);
  M.touchRadius = (type, a) => ({ sc: a / 2, bcc: (Math.sqrt(3) * a) / 4, fcc: (Math.SQRT2 * a) / 4, hcp: a / 2, diamond: (Math.sqrt(3) * a) / 8 })[type];
  M.packFraction = (Z, radii, V) => (Z * radii.reduce((s, r) => s + (4 / 3) * Math.PI * r ** 3, 0)) / V;

  // ── 06 量子与计算化学 ───────────────────────────────────────────────────
  // 一维势箱：E_n（J），N 个 π 电子（偶数）填到 N/2，HOMO → LUMO 的波长（nm）。L 以 pm 计
  M.boxE = (n, Lpm) => (n * n * M.h * M.h) / (8 * M.me * (Lpm * 1e-12) ** 2);
  M.boxLambda = (N, Lpm) => (8 * M.me * M.c * (Lpm * 1e-12) ** 2) / (M.h * (N + 1)) * 1e9;
  // 实对称矩阵的 Jacobi 对角化：返回按本征值从小到大排好的 { values, vectors }（vectors[k] 是第 k 个本征向量）
  M.jacobiEig = (A0) => {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-15) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), sn = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - sn * akq; A[k][q] = sn * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - sn * aqk; A[q][k] = sn * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - sn * vkq; V[k][q] = sn * vkp + c * vkq; }
      }
    }
    const idx = A.map((_, i) => i).sort((i, j) => A[i][i] - A[j][j]);
    return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => V.map((r) => r[i])) };
  };
  // Hückel：n 个 p 轨道、键 bonds（[i, j]），杂原子用 h（α_X = α + h β）和 k（β_CX = k β）。E = α + x β，β < 0，所以 x 越大能量越低。
  // 电子从 x 最大的轨道往下填；返回 x（从低能到高能）、系数、π 能量（以 β 计）、HOMO/LUMO 能隙（以 |β| 计）
  M.huckel = (n, bonds, nel, het = {}) => {
    const H = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (__, j) => (i === j ? -(het[i]?.h || 0) : 0)));
    for (const [i, j, k = 1] of bonds) { H[i][j] = -k; H[j][i] = -k; }
    const { values, vectors } = M.jacobiEig(H), x = values.map((v) => -v), occ = x.map(() => 0);
    let left = nel;
    for (let k = 0; k < n && left > 0;) {
      let g = 1; while (k + g < n && Math.abs(x[k + g] - x[k]) < 1e-8) g++;
      const put = Math.min(2 * g, left); for (let q = 0; q < g; q++) occ[k + q] = (put > q ? 1 : 0) + (put > g + q ? 1 : 0);
      left -= put; k += g;
    }
    const homo = occ.reduce((h, o, k) => (o > 0 ? k : h), -1);
    const Epi = x.reduce((s, xi, k) => s + occ[k] * xi, 0);
    return { x, vectors, occ, Epi, homo, gap: homo + 1 < n ? x[homo] - x[homo + 1] : NaN };
  };
  M.huckelChain = (n) => Array.from({ length: n }, (_, k) => 2 * Math.cos(((k + 1) * Math.PI) / (n + 1)));
  M.huckelRing = (n) => Array.from({ length: n }, (_, k) => 2 * Math.cos((2 * Math.PI * k) / n)).sort((a, b) => b - a);
  // Morse 势：由光谱常数 ωe、ωexe（cm⁻¹）和约化质量 μ（amu）得到 De（cm⁻¹）、a（pm⁻¹）；能级 G(v)（cm⁻¹，从势能最低点算）
  M.morseParams = (we, wexe, mu) => { const De = (we * we) / (4 * wexe), a = 2 * Math.PI * M.c * 100 * we * Math.sqrt((mu * M.amu) / (2 * De * M.h * M.c * 100)); return { De, a: a * 1e-12, vmax: Math.floor(we / (2 * wexe) - 0.5) }; };
  M.morseV = (r, re, De, a) => De * (1 - Math.exp(-a * (r - re))) ** 2;
  M.morseG = (v, we, wexe) => we * (v + 0.5) - wexe * (v + 0.5) ** 2;
  // 二维 Lennard-Jones 流体的分子动力学（约化单位 σ = ε = m = 1），速度 Verlet，截断 2.5σ 并平移势能。确定的种子，同样的输入同样的结果
  M.ljMD = ({ N = 64, rho = 0.6, T = 1, dt = 0.005, steps = 1000, seed = 7, rc = 2.5 }) => {
    const side = Math.ceil(Math.sqrt(N)), L = Math.sqrt(N / rho), r = M.rng(seed), x = [], y = [], vx = [], vy = [], ax = new Float64Array(N), ay = new Float64Array(N);
    for (let i = 0; i < N; i++) { x.push(((i % side) + 0.5) * (L / side)); y.push((Math.floor(i / side) + 0.5) * (L / side)); vx.push(M.gauss(r)); vy.push(M.gauss(r)); }
    const mx = vx.reduce((a, b) => a + b, 0) / N, my = vy.reduce((a, b) => a + b, 0) / N;
    for (let i = 0; i < N; i++) { vx[i] -= mx; vy[i] -= my; }
    const dof = 2 * N - 2, K0 = vx.reduce((s, v, i) => s + v * v + vy[i] * vy[i], 0) / 2, sc = Math.sqrt((T * dof) / 2 / K0);
    for (let i = 0; i < N; i++) { vx[i] *= sc; vy[i] *= sc; }
    const rc2 = rc * rc, Vc = 4 * (rc ** -12 - rc ** -6);
    const force = () => {
      ax.fill(0); ay.fill(0); let U = 0;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        let dx = x[i] - x[j], dy = y[i] - y[j]; dx -= L * Math.round(dx / L); dy -= L * Math.round(dy / L);
        const r2 = dx * dx + dy * dy; if (r2 > rc2) continue;
        const i2 = 1 / r2, i6 = i2 * i2 * i2, f = 24 * i2 * i6 * (2 * i6 - 1);
        U += 4 * i6 * (i6 - 1) - Vc; ax[i] += f * dx; ay[i] += f * dy; ax[j] -= f * dx; ay[j] -= f * dy;
      }
      return U;
    };
    let U = force();
    const out = { t: [], K: [], U: [], E: [], L, x, y }, every = Math.max(1, Math.round(steps / 300)), nb = 60, rmax = Math.min(L / 2, 4), gr = new Float64Array(nb);
    let ngr = 0;
    for (let s = 0; s <= steps; s++) {
      if (s) {
        for (let i = 0; i < N; i++) { vx[i] += 0.5 * dt * ax[i]; vy[i] += 0.5 * dt * ay[i]; x[i] = (((x[i] + dt * vx[i]) % L) + L) % L; y[i] = (((y[i] + dt * vy[i]) % L) + L) % L; }
        U = force();
        for (let i = 0; i < N; i++) { vx[i] += 0.5 * dt * ax[i]; vy[i] += 0.5 * dt * ay[i]; }
      }
      if (s % every === 0) {
        const K = vx.reduce((q, v, i) => q + v * v + vy[i] * vy[i], 0) / 2;
        out.t.push(s * dt); out.K.push(K / N); out.U.push(U / N); out.E.push((K + U) / N);
        if (s >= steps / 2) {
          ngr++;
          for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) { let dx = x[i] - x[j], dy = y[i] - y[j]; dx -= L * Math.round(dx / L); dy -= L * Math.round(dy / L); const d = Math.hypot(dx, dy); if (d < rmax) gr[Math.floor((d / rmax) * nb)] += 2; }
        }
      }
    }
    out.gr = Array.from(gr, (g, k) => { const r0 = (k * rmax) / nb, r1 = ((k + 1) * rmax) / nb; return g / (ngr * N * rho * Math.PI * (r1 * r1 - r0 * r0)); });
    out.grR = Array.from(gr, (_, k) => ((k + 0.5) * rmax) / nb);
    out.Tmean = (2 * N * out.K.slice(Math.floor(out.K.length / 2)).reduce((a, b) => a + b, 0)) / Math.ceil(out.K.length / 2) / dof;
    return out;
  };

  // ── 07 配位与金属有机 ───────────────────────────────────────────────────
  // d 轨道在三种配位场里的能量（以该几何的分裂能 Δ 为单位；平面正方形取角重叠模型常引的相对值，以 Δo 计）
  M.DSPLIT = {
    oct: [['t₂g', -0.4, 3], ['eg', 0.6, 2]],
    tet: [['e', -0.6, 2], ['t₂', 0.4, 3]],
    sq: [['d_xz, d_yz', -0.514, 2], ['d_z²', -0.428, 1], ['d_xy', 0.228, 1], ['d_x²−y²', 1.228, 1]],
  };
  // n 个 d 电子：比较每一种“成对数 p”的总能量（轨道能 + p·P），取最低；能量相同时取高自旋。Δ、P 同单位（cm⁻¹）
  M.ligandField = (n, geom, Delta, P) => {
    const orbs = M.DSPLIT[geom].flatMap(([name, e, g]) => Array.from({ length: g }, () => ({ name, e }))).sort((a, b) => a.e - b.e);
    let best = null;
    for (let p = Math.max(0, n - 5); 2 * p <= n; p++) {
      const sgl = n - 2 * p; if (p + sgl > 5) continue;
      const occ = orbs.map((_, i) => (i < p ? 2 : i < p + sgl ? 1 : 0)), E = occ.reduce((s, o, i) => s + o * orbs[i].e, 0) * Delta + p * P;
      if (!best || E < best.E - 1e-9) best = { E, p, occ, unpaired: sgl, cfse: occ.reduce((s, o, i) => s + o * orbs[i].e, 0) };
    }
    const hs = Math.min(n, 10 - n);
    return { ...best, orbs, spin: best.unpaired === hs ? 'high' : 'low', muSO: Math.sqrt(best.unpaired * (best.unpaired + 2)) };
  };
  // 共价（中性配体）计数法：电子数 = 族数 + 2·L + X − 电荷 + 金属–金属键；氧化态 = 电荷 + X；d 电子数 = 族数 − 氧化态
  M.electronCount = ({ group, L = 0, X = 0, charge = 0, mm = 0 }) => ({ count: group + 2 * L + X - charge + mm, ox: charge + X, d: group - (charge + X) });
  // 逐级配合：logK 是逐级常数，返回各 ML_i 的分数、平均配体数 n̄（L 是游离配体浓度，mol/L）
  M.stepwise = (logK, Lfree) => {
    let b = 1; const t = [1];
    for (const lk of logK) { b *= 10 ** lk; t.push(b * Lfree ** t.length); }
    const sum = t.reduce((a, c) => a + c, 0), frac = t.map((c) => c / sum);
    return { frac, nbar: frac.reduce((s, f, i) => s + i * f, 0) };
  };
  // 可见光波长（nm）→ 近似的 sRGB 颜色（Bruton 的分段近似），以及吸收某波长时看到的近似补色
  M.waveRGB = (lam) => {
    let r = 0, g = 0, b = 0;
    if (lam < 440) { r = -(lam - 440) / 60; b = 1; } else if (lam < 490) { g = (lam - 440) / 50; b = 1; } else if (lam < 510) { g = 1; b = -(lam - 510) / 20; } else if (lam < 580) { r = (lam - 510) / 70; g = 1; } else if (lam < 645) { r = 1; g = -(lam - 645) / 65; } else r = 1;
    const f = lam < 420 ? 0.3 + (0.7 * (lam - 380)) / 40 : lam > 700 ? 0.3 + (0.7 * (780 - lam)) / 80 : 1;
    return [r, g, b].map((v) => Math.round(255 * Math.max(0, Math.min(1, v * f)) ** 0.8));
  };

  // ── 08 电化学 ───────────────────────────────────────────────────────────
  // Nernst：E = E° − (RT/nF) ln Q；mH 是反应式里 H⁺ 的计量数（氧化态一侧），所以 E 随 pH 下降 (mH/n)·0.05916 V
  M.nernst = (E0, n, lgOx, lgRed, pH = 0, mH = 0, T = 298.15) => E0 + ((M.R * T * Math.LN10) / (n * M.F)) * (lgOx - lgRed - mH * pH);
  // Butler–Volmer，带两侧的极限扩散电流（同一形式的闭式解）：j0、jla、jlc 都取正值（mA/cm²），η 以 V 计
  M.butlerVolmer = (eta, j0, alpha, n = 1, T = 298.15, jla = Infinity, jlc = Infinity) => {
    const f = (n * M.F) / (M.R * T), a = Math.exp((1 - alpha) * f * eta), c = Math.exp(-alpha * f * eta);
    return (a - c) / (1 / j0 + a / jla + c / jlc);
  };
  // 循环伏安的有限差分模拟：O + n e⁻ ⇌ R，溶液里开始只有 O（c，mol/L），半无限线性扩散，电极反应按 Butler–Volmer（k0，cm/s）。
  // 返回电位（V，相对 E°′）和电流密度（mA/cm²，还原为负）
  M.cv = ({ c = 1e-3, D = 1e-5, v = 0.1, k0 = 1, alpha = 0.5, n = 1, Ei = 0.4, Ev = -0.4, T = 298.15, steps = 2000 }) => {
    const f = (n * M.F) / (M.R * T), tt = (2 * Math.abs(Ei - Ev)) / v, dt = tt / steps, dx = Math.sqrt((D * dt) / 0.4), nx = Math.ceil((6 * Math.sqrt(D * tt)) / dx) + 2, lam = (D * dt) / (dx * dx);
    const C = c * 1e-3; // mol/cm³
    let O = new Float64Array(nx).fill(C), R = new Float64Array(nx), O2 = new Float64Array(nx), R2 = new Float64Array(nx);
    const E = [], j = [], dir = Ev < Ei ? -1 : 1;
    for (let k = 0; k <= steps; k++) {
      const t = k * dt, Et = t <= tt / 2 ? Ei + dir * v * t : Ev - dir * v * (t - tt / 2), eta = Et;
      const kf = k0 * Math.exp(-alpha * f * eta), kb = k0 * Math.exp((1 - alpha) * f * eta);
      // 表面浓度梯度用三点公式；通量和表面浓度一起解出，k 很大时也稳定
      const J = ((kf * (4 * O[1] - O[2]) - kb * (4 * R[1] - R[2])) / 3) / (1 + (2 * dx * (kf + kb)) / (3 * D)); // 还原通量，mol cm⁻² s⁻¹
      O[0] = (4 * O[1] - O[2] - (2 * dx * J) / D) / 3; R[0] = (4 * R[1] - R[2] + (2 * dx * J) / D) / 3;
      E.push(Et); j.push(-n * M.F * J * 1000);
      for (let i = 1; i < nx - 1; i++) { O2[i] = O[i] + lam * (O[i + 1] - 2 * O[i] + O[i - 1]); R2[i] = R[i] + lam * (R[i + 1] - 2 * R[i] + R[i - 1]); }
      O2[0] = O[0]; R2[0] = R[0]; O2[nx - 1] = C; R2[nx - 1] = 0;
      [O, O2] = [O2, O]; [R, R2] = [R2, R];
    }
    return { E, j };
  };
  // Randles–Ševčík：可逆体系的峰电流密度（mA/cm²），c 以 mol/L 计
  M.randlesSevcik = (n, c, D, v, T = 298.15) => 0.4463 * n * M.F * (c * 1e-3) * Math.sqrt((n * M.F * v * D) / (M.R * T)) * 1000;
  // 理论比容量（mAh/g）：每摩尔式量转移 n 个电子
  M.specCap = (n, Mg) => (n * M.F) / (3.6 * Mg);

  // ── 09 高分子化学 ───────────────────────────────────────────────────────
  // Carothers 方程：两种官能团 A、B，r = N_A/N_B ≤ 1，p 是 A 的反应程度
  M.carothers = (p, r = 1) => (1 + r) / (1 + r - 2 * r * p);
  // Flory 最可几分布（线形逐步聚合，r = 1）：x 聚体的数量分数和质量分数
  M.floryN = (p, x) => (1 - p) * p ** (x - 1);
  M.floryW = (p, x) => x * (1 - p) ** 2 * p ** (x - 1);
  M.floryXw = (p) => (1 + p) / (1 - p);
  // 活性聚合的 Poisson 分布：每条链从 1 个引发单元开始，平均加上 ν 个单体
  M.poissonN = (nu, x) => { if (x < 1) return 0; let lg = -nu + (x - 1) * Math.log(nu); for (let k = 2; k < x; k++) lg -= Math.log(k); return Math.exp(lg); };
  M.poissonD = (nu) => 1 + nu / (1 + nu) ** 2;
  // Mayo–Lewis 共聚方程：瞬时共聚物组成 F1
  M.mayoLewis = (f1, r1, r2) => { const f2 = 1 - f1, a = r1 * f1 * f1 + f1 * f2; return a / (a + f1 * f2 + r2 * f2 * f2); };
  // 组成漂移（Skeist 积分）：df1/dX = (f1 − F1)/(1 − X)；返回转化率、剩余单体组成、瞬时和累积共聚物组成
  M.copolyDrift = (f10, r1, r2, Xmax = 0.99, n = 400) => {
    let f1 = f10, cum = 0; const X = [0], f = [f10], Fi = [M.mayoLewis(f10, r1, r2)], Fc = [Fi[0]], dX = Xmax / n;
    for (let k = 1; k <= n; k++) {
      const x0 = (k - 1) * dX, F0 = M.mayoLewis(f1, r1, r2);
      const g = (ff, xx) => (ff - M.mayoLewis(ff, r1, r2)) / (1 - xx); // RK2
      const k1 = g(f1, x0), k2 = g(Math.min(1, Math.max(0, f1 + dX * k1)), x0 + dX);
      f1 = Math.min(1, Math.max(0, f1 + (dX * (k1 + k2)) / 2)); cum += (dX * (F0 + M.mayoLewis(f1, r1, r2))) / 2;
      X.push(k * dX); f.push(f1); Fi.push(M.mayoLewis(f1, r1, r2)); Fc.push(cum / (k * dX));
    }
    return { X, f, Fi, Fc };
  };
  // 三维自由旋转链：键长 b，键角 θ（自由连接链 θ 取 null），返回坐标；Rosenbluth 之外的最简单的链
  M.chain3d = (N, theta, seed) => {
    const r = M.rng(seed), pts = [[0, 0, 0]], ct = theta == null ? null : Math.cos(Math.PI - theta), st = theta == null ? 0 : Math.sqrt(1 - ct * ct);
    const unit = () => { const z = 2 * r() - 1, ph = 2 * Math.PI * r(), s = Math.sqrt(1 - z * z); return [s * Math.cos(ph), s * Math.sin(ph), z]; };
    let u = unit();
    for (let i = 0; i < N; i++) {
      const p = pts[i]; pts.push([p[0] + u[0], p[1] + u[1], p[2] + u[2]]);
      if (ct === null) { u = unit(); continue; }
      // 和上一根键成固定夹角、绕它随机转一个角度
      const a = Math.abs(u[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0], e1 = norm3(cross3(u, a)), e2 = cross3(u, e1), ph = 2 * Math.PI * r();
      u = [0, 1, 2].map((k) => ct * u[k] + st * (Math.cos(ph) * e1[k] + Math.sin(ph) * e2[k]));
    }
    return pts;
  };
  const cross3 = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm3 = (a) => { const l = Math.hypot(...a); return a.map((v) => v / l); };
  // 自由旋转链的特征比（N 有限时的精确式）：C_N = (1+c)/(1−c) − 2c(1−c^N)/(N(1−c)²)，c = cos(π − θ)
  M.charRatio = (N, theta) => { if (theta == null) return 1; const c = Math.cos(Math.PI - theta); return (1 + c) / (1 - c) - (2 * c * (1 - c ** N)) / (N * (1 - c) ** 2); };
  // Flory–Huggins：每个格点的混合自由能（kT），φ 是聚合物体积分数，N 是聚合度
  M.fhG = (phi, N, chi) => (phi / N) * Math.log(phi) + (1 - phi) * Math.log(1 - phi) + chi * phi * (1 - phi);
  M.fhCrit = (N) => ({ chi: 0.5 * (1 + 1 / Math.sqrt(N)) ** 2, phi: 1 / (1 + Math.sqrt(N)) });
  M.fhSpinodal = (phi, N) => 0.5 * (1 / (N * phi) + 1 / (1 - phi));
  // 双节线：在对数加密的网格上求自由能曲线的下凸包，跳过的那一段两端就是共存的两相
  M.fhBinodal = (N, chi) => {
    const c = M.fhCrit(N); if (chi <= c.chi) return null;
    const xs = []; for (let k = 0; k <= 1200; k++) { const t = k / 1200; xs.push(t < 0.5 ? 10 ** (-9 + 16 * t) : 0); }
    const grid = [...new Set(xs.filter((v) => v > 0 && v < 0.5).concat(Array.from({ length: 1200 }, (_, k) => 0.02 + (0.97 * k) / 1199)))].filter((v) => v > 0 && v < 1).sort((a, b) => a - b);
    const P = grid.map((x) => [x, M.fhG(x, N, chi)]), H = [];
    for (const q of P) { while (H.length >= 2) { const [a, b] = [H[H.length - 2], H[H.length - 1]]; if ((b[0] - a[0]) * (q[1] - a[1]) - (b[1] - a[1]) * (q[0] - a[0]) <= 0) H.pop(); else break; } H.push(q); }
    let best = null;
    for (let i = 1; i < H.length; i++) { const gap = H[i][0] - H[i - 1][0]; if (gap > 0.02 && (!best || gap > best[1] - best[0])) best = [H[i - 1][0], H[i][0]]; }
    return best;
  };

  window.MOLASTRIA_CHEM_MODELS = M;
})();
