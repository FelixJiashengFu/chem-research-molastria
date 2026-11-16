'use strict';
// NequIP（/nequip/）演示背后的数学：纯函数，没有 DOM。tools/nequip-test.mjs 对照解析解和已知值测这里的每一个函数。
// 页面里 nequip-demos.js 经 window.MOLASTRIA_NEQUIP_MODELS 拿到它们。
// 这里没有真的 NequIP 网络：演示用的是能在浏览器里当场算、又能看清一个概念的小模型（球谐函数、Clebsch–Gordan、Bessel 径向基、近邻图、
// Lennard-Jones 分子动力学、高斯过程拟合），每个演示的“模型说明”写清楚它和 NequIP 的关系。论文和官方仓库的数字放在 PAPER 里，逐个注明出处。
(() => {
  const TAU = 2 * Math.PI;

  // ── 随机数（固定种子，同一个种子同一个结果）──────────────────────
  const rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ── 三维小工具 ──────────────────────────────────────────────────
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const norm = (a) => Math.hypot(a[0], a[1], a[2]);
  const matVec = (M, v) => M.map((row) => row.reduce((s, x, j) => s + x * v[j], 0));
  const matMul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)));
  const transpose = (A) => A[0].map((_, j) => A.map((row) => row[j]));
  // 绕 z 转 a、再绕 y 转 b、再绕 z 转 c（ZYZ 欧拉角），R = Rz(a) Ry(b) Rz(c)
  const Rz = (t) => [[Math.cos(t), -Math.sin(t), 0], [Math.sin(t), Math.cos(t), 0], [0, 0, 1]];
  const Ry = (t) => [[Math.cos(t), 0, Math.sin(t)], [0, 1, 0], [-Math.sin(t), 0, Math.cos(t)]];
  const Rx = (t) => [[1, 0, 0], [0, Math.cos(t), -Math.sin(t)], [0, Math.sin(t), Math.cos(t)]];
  const euler = (a, b, c) => matMul(matMul(Rz(a), Ry(b)), Rz(c));

  // ── 第一章：一根键的势能曲线 ─────────────────────────────────────
  // Morse 势 V(r) = D (1 − e^{−a(r − re)})²，以无穷远为 D；谐振子 V = ½ k (r − re)²，k = 2 D a² 是 Morse 在平衡点的曲率；
  // 三次项展开 V ≈ ½ k x² − a k x³/2（x = r − re）。单位随意（演示用约化单位）。
  const morse = (r, D, a, re) => D * (1 - Math.exp(-a * (r - re))) ** 2;
  const morseF = (r, D, a, re) => { const e = Math.exp(-a * (r - re)); return -2 * D * a * e * (1 - e); }; // F = −dV/dr
  const harmonic = (r, D, a, re) => D * a * a * (r - re) ** 2;
  const cubic = (r, D, a, re) => { const x = r - re; return D * a * a * x * x * (1 - a * x); };

  // ── 第二章：等变的检查 ──────────────────────────────────────────
  // 一个“分子”（坐标单位 Å，形状接近甲醇，只用来演示），两种给每个原子算一个向量的模型：
  //   等变的：v_i = Σ_j φ(r_ij) (r_j − r_i)，φ 只看距离（这就是一条 l = 1 的消息）
  //   不等变的：同样的和，再乘一个固定的、不各向同性的矩阵 A（相当于网络直接吃了坐标分量，对方向有偏好）
  // 以及一个不变的“能量” E = Σ_{i<j} ψ(r_ij)。
  const MOL = { z: ['C', 'O', 'H', 'H', 'H', 'H'], pos: [[0, 0, 0], [1.43, 0, 0], [1.75, 0.89, 0.18], [-0.36, 1.03, 0.05], [-0.36, -0.5, 0.89], [-0.36, -0.5, -0.89]] };
  const phi = (r) => Math.exp(-((r / 1.6) ** 2));
  const psi = (r) => Math.exp(-r) / r;
  const ANISO = [[1.3, 0.4, 0], [-0.2, 0.7, 0.3], [0.1, 0, 0.5]];
  const centred = (pos) => { const c = [0, 1, 2].map((k) => pos.reduce((s, p) => s + p[k], 0) / pos.length); return pos.map((p) => sub(p, c)); };
  const vecModel = (pos) => pos.map((ri, i) => pos.reduce((s, rj, j) => { if (i === j) return s; const d = sub(rj, ri), w = phi(norm(d)); return [s[0] + w * d[0], s[1] + w * d[1], s[2] + w * d[2]]; }, [0, 0, 0]));
  const badModel = (pos) => vecModel(pos).map((v) => matVec(ANISO, v));
  const pairEnergy = (pos) => { let e = 0; for (let i = 0; i < pos.length; i++) for (let j = i + 1; j < pos.length; j++) e += psi(norm(sub(pos[i], pos[j]))); return e; };
  // 相对误差 ‖f(Rx) − R f(x)‖ / ‖f(x)‖（所有原子一起算）
  const equivError = (model, pos, R) => {
    const a = model(pos.map((p) => matVec(R, p))), b = model(pos).map((v) => matVec(R, v));
    let num = 0, den = 0;
    a.forEach((v, i) => { const d = sub(v, b[i]); num += dot(d, d); den += dot(b[i], b[i]); });
    return Math.sqrt(num / Math.max(den, 1e-300));
  };

  // ── 第三章：实球谐函数和 Wigner D 矩阵 ──────────────────────────
  const fact = (n) => { let f = 1; for (let k = 2; k <= n; k++) f *= k; return f; };
  // 连带 Legendre 函数 P_l^m(x)，m ≥ 0，不带 Condon–Shortley 的 (−1)^m
  const legendreP = (l, m, x) => {
    let pmm = 1; const s = Math.sqrt(Math.max(0, 1 - x * x));
    for (let k = 1; k <= m; k++) pmm *= (2 * k - 1) * s;
    if (l === m) return pmm;
    let p1 = x * (2 * m + 1) * pmm;
    if (l === m + 1) return p1;
    let p0 = pmm;
    for (let ll = m + 2; ll <= l; ll++) { const p2 = ((2 * ll - 1) * x * p1 - (ll + m - 1) * p0) / (ll - m); p0 = p1; p1 = p2; }
    return p1;
  };
  // 归一化的实球谐函数 Y_lm(n)，m = −l … l；n 不必是单位向量（只看方向）。l = 1 的三个分量正比于 (y, z, x)
  const realSH = (l, m, x, y, z) => {
    const r = Math.hypot(x, y, z) || 1, ct = z / r, ph = Math.atan2(y, x), am = Math.abs(m);
    const N = Math.sqrt(((2 * l + 1) / (4 * Math.PI)) * (fact(l - am) / fact(l + am))), P = legendreP(l, am, ct);
    if (m === 0) return N * P;
    return Math.SQRT2 * N * P * (m > 0 ? Math.cos(am * ph) : Math.sin(am * ph));
  };
  const shVec = (l, v) => Array.from({ length: 2 * l + 1 }, (_, i) => realSH(l, i - l, v[0], v[1], v[2]));
  // Gauss–Legendre 求积点（Newton 法求 P_n 的零点）
  const gaussLegendre = (n) => {
    const x = [], w = [];
    for (let i = 1; i <= n; i++) {
      let z = Math.cos((Math.PI * (i - 0.25)) / (n + 0.5)), dp = 0;
      for (let it = 0; it < 100; it++) { let p0 = 1, p1 = z; for (let k = 2; k <= n; k++) { const p2 = ((2 * k - 1) * z * p1 - (k - 1) * p0) / k; p0 = p1; p1 = p2; } dp = (n * (z * p1 - p0)) / (z * z - 1); const dz = p1 / dp; z -= dz; if (Math.abs(dz) < 1e-15) break; }
      x.push(z); w.push(2 / ((1 - z * z) * dp * dp));
    }
    return { x, w };
  };
  // 球面上的求积格点：对次数 ≤ deg 的球面多项式精确
  const sphereGrid = (deg) => {
    const g = gaussLegendre(Math.ceil((deg + 1) / 2) + 1), nph = deg + 2, pts = [];
    g.x.forEach((ct, i) => { const st = Math.sqrt(1 - ct * ct); for (let k = 0; k < nph; k++) { const p = (TAU * k) / nph; pts.push([[st * Math.cos(p), st * Math.sin(p), ct], (g.w[i] * TAU) / nph]); } });
    return pts;
  };
  // D^l(R)_{mm'} = ∫ Y_lm(n) Y_lm'(R⁻¹ n) dΩ：函数 f(n) = Σ c_m Y_lm(n) 转成 f(R⁻¹ n) 后，系数变成 D c
  const wignerD = (l, R) => {
    const Rt = transpose(R), n = 2 * l + 1, D = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const [p, w] of sphereGrid(2 * l)) { const a = shVec(l, p), b = shVec(l, matVec(Rt, p)); for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) D[i][j] += w * a[i] * b[j]; }
    return D;
  };
  // 一组系数在球面上的值，和它的“能量” Σ c²（旋转不改变它）
  const shEval = (l, c, v) => shVec(l, v).reduce((s, y, i) => s + y * c[i], 0);

  // ── 第四章：Clebsch–Gordan 系数和张量积 ────────────────────────
  // 复数基下的 ⟨l1 m1 l2 m2 | L M⟩（Racah 公式）
  const cgComplex = (j1, m1, j2, m2, J, M) => {
    if (m1 + m2 !== M || J < Math.abs(j1 - j2) || J > j1 + j2 || Math.abs(m1) > j1 || Math.abs(m2) > j2 || Math.abs(M) > J) return 0;
    const pre = Math.sqrt(((2 * J + 1) * fact(J + j1 - j2) * fact(J - j1 + j2) * fact(j1 + j2 - J)) / fact(j1 + j2 + J + 1)) * Math.sqrt(fact(J + M) * fact(J - M) * fact(j1 - m1) * fact(j1 + m1) * fact(j2 - m2) * fact(j2 + m2));
    let s = 0;
    for (let k = 0; k <= j1 + j2 + J; k++) {
      const d = [k, j1 + j2 - J - k, j1 - m1 - k, j2 + m2 - k, J - j2 + m1 + k, J - j1 - m2 + k];
      if (d.some((x) => x < 0)) continue;
      s += (k % 2 ? -1 : 1) / d.reduce((p, x) => p * fact(x), 1);
    }
    return pre * s;
  };
  // 复数球谐 → 实球谐的幺正矩阵 U[实 m][复 m']（实球谐不带 Condon–Shortley 相位，和 realSH 一致）；复数存成 [re, im]
  const toReal = (l) => {
    const n = 2 * l + 1, U = Array.from({ length: n }, () => Array.from({ length: n }, () => [0, 0])), s = Math.SQRT1_2;
    for (let m = -l; m <= l; m++) {
      const r = m + l, sg = Math.abs(m) % 2 ? -1 : 1;
      if (m === 0) U[r][l] = [1, 0];
      else if (m > 0) { U[r][m + l] = [sg * s, 0]; U[r][-m + l] = [s, 0]; }
      else { const mu = -m; U[r][mu + l] = [0, -sg * s]; U[r][-mu + l] = [0, s]; }
    }
    return U;
  };
  // 实数基下的 CG 张量 C[a][b][c]（a ∈ l1，b ∈ l2，c ∈ L），满足 out_c = Σ C x_a y_b 和旋转对易；整体归一为 Σ C² = 2L + 1
  const cgCache = {};
  const cgReal = (l1, l2, L) => {
    const key = `${l1},${l2},${L}`;
    if (cgCache[key]) return cgCache[key];
    const U1 = toReal(l1), U2 = toReal(l2), U3 = toReal(L), n1 = 2 * l1 + 1, n2 = 2 * l2 + 1, n3 = 2 * L + 1;
    const re = [], im = [];
    let nre = 0, nim = 0;
    for (let a = 0; a < n1; a++) { re.push([]); im.push([]); for (let b = 0; b < n2; b++) { re[a].push(new Array(n3).fill(0)); im[a].push(new Array(n3).fill(0)); for (let c = 0; c < n3; c++) {
      let sr = 0, si = 0;
      for (let m1 = -l1; m1 <= l1; m1++) for (let m2 = -l2; m2 <= l2; m2++) {
        const M = m1 + m2; if (Math.abs(M) > L) continue;
        const cg = cgComplex(l1, m1, l2, m2, L, M); if (!cg) continue;
        // U3[c][M] · conj(U1[a][m1]) · conj(U2[b][m2]) · cg
        const u3 = U3[c][M + L], u1 = U1[a][m1 + l1], u2 = U2[b][m2 + l2];
        const p1 = [u1[0] * u2[0] - u1[1] * u2[1], -(u1[0] * u2[1] + u1[1] * u2[0])]; // conj(u1)·conj(u2)
        sr += cg * (u3[0] * p1[0] - u3[1] * p1[1]); si += cg * (u3[0] * p1[1] + u3[1] * p1[0]);
      }
      re[a][b][c] = sr; im[a][b][c] = si; nre += sr * sr; nim += si * si;
    } } }
    const pick = nre >= nim ? re : im, scale = Math.sqrt(n3 / Math.max(nre, nim, 1e-300));
    const C = pick.map((A) => A.map((B) => B.map((v) => (Math.abs(v) < 1e-14 ? 0 : v * scale))));
    cgCache[key] = C;
    return C;
  };
  // 两个特征 x（阶 l1）、y（阶 l2）经 CG 合成阶 L 的输出
  const tensorProduct = (l1, x, l2, y, L) => { const C = cgReal(l1, l2, L), out = new Array(2 * L + 1).fill(0); for (let a = 0; a < x.length; a++) for (let b = 0; b < y.length; b++) for (let c = 0; c < out.length; c++) out[c] += C[a][b][c] * x[a] * y[b]; return out; };
  // l = 1 的实球谐分量顺序是 (y, z, x)：普通向量和它互换
  const toL1 = (v) => [v[1], v[2], v[0]];
  const fromL1 = (c) => [c[2], c[0], c[1]];
  // 按论文的选择规则数路径：输入特征 ins = [[l, p], …]（p = 1 偶，−1 奇），滤波器是球谐 Y^lf（宇称 (−1)^lf，lf ≤ lfMax），输出只留 lo ≤ lMax
  const tpPaths = (ins, lfMax, lMax, keepOdd = true) => {
    const out = [];
    for (const [li, pi] of ins) for (let lf = 0; lf <= lfMax; lf++) { const pf = lf % 2 ? -1 : 1; for (let lo = Math.abs(li - lf); lo <= Math.min(li + lf, lMax); lo++) { const po = pi * pf; if (!keepOdd && po !== (lo % 2 ? -1 : 1)) continue; out.push({ li, pi, lf, pf, lo, po }); } }
    return out;
  };
  // 特征的不可约表示：0 … lMax 阶，parity 'both' 时偶宇称、奇宇称各一份（论文的设定），'natural' 时只留 (−1)^l
  const featureIrreps = (lMax, parity = 'both') => { const out = []; for (let l = 0; l <= lMax; l++) { if (parity === 'both') { out.push([l, 1], [l, -1]); } else out.push([l, l % 2 ? -1 : 1]); } return out; };
  const irrepName = (l, p) => `${l}${p > 0 ? 'e' : 'o'}`;

  // ── 第五章：径向基、包络和近邻图 ────────────────────────────────
  // 论文式 (6)：B_n(r) = (2/r_c) · sin(nπ r / r_c) / r，n = 1 … N_b（训练时 nπ 也是可学的，这里固定在初值）
  const bessel = (n, r, rc) => (r < 1e-9 ? (2 / rc) * ((n * Math.PI) / rc) : ((2 / rc) * Math.sin((n * Math.PI * r) / rc)) / r);
  // DimeNet 的多项式包络（p = 6 时论文用的那一个）：u(x) = 1 − (p+1)(p+2)/2 x^p + p(p+2) x^{p+1} − p(p+1)/2 x^{p+2}，x = r / r_c，x ≥ 1 时为 0
  const envelope = (x, p = 6) => (x >= 1 ? 0 : 1 - (((p + 1) * (p + 2)) / 2) * x ** p + p * (p + 2) * x ** (p + 1) - ((p * (p + 1)) / 2) * x ** (p + 2));
  const envelopeD = (x, p = 6) => (x >= 1 ? 0 : (-(p * (p + 1) * (p + 2)) / 2) * x ** (p - 1) + p * (p + 1) * (p + 2) * x ** p - ((p * (p + 1) * (p + 2)) / 2) * x ** (p + 1));
  const envelopeD2 = (x, p = 6) => (x >= 1 ? 0 : (-(p * (p - 1) * (p + 1) * (p + 2)) / 2) * x ** (p - 2) + p * p * (p + 1) * (p + 2) * x ** (p - 1) - ((p * (p + 1) * (p + 1) * (p + 2)) / 2) * x ** p);
  // 二维的“液体快照”：盒子 w × h（Å）里撒点，任意两点不近于 dmin（固定种子的投点法）
  const scatter = (w, h, dmin, seed = 7, tries = 6000) => {
    const R = rng(seed), pts = [];
    for (let t = 0; t < tries; t++) { const p = [R() * w, R() * h]; if (pts.every((q) => Math.hypot(p[0] - q[0], p[1] - q[1]) >= dmin)) pts.push(p); }
    return pts;
  };
  const neighbours = (pts, rc) => pts.map((p, i) => pts.reduce((a, q, j) => { if (j !== i && Math.hypot(p[0] - q[0], p[1] - q[1]) < rc) a.push(j); return a; }, []));
  // 从 i 出发沿近邻图走 T 步能到的原子（消息传递 T 层后的感受野），hop[j] 是最少几步
  const hops = (nb, i, T) => { const hop = new Map([[i, 0]]); let front = [i]; for (let t = 1; t <= T; t++) { const nx = []; for (const a of front) for (const b of nb[a]) if (!hop.has(b)) { hop.set(b, t); nx.push(b); } front = nx; } return hop; };

  // ── 第六章：二维 Lennard-Jones 小团簇的分子动力学 ──────────────
  // 约化单位：ε = σ = m = 1。保守力 F = −∇E；“不保守的力”另加一项成对的、和连线垂直的力 eps·g(r)·n̂⊥（大小相等方向相反，动量守恒，
  // 但不是任何能量的梯度）：直接预测力、不经过能量求导的模型，误差就可能带这种旋度。
  const LJ_RC = 2.5;
  const ljPair = (r) => { const s6 = r ** -6; return 4 * (s6 * s6 - s6); };
  const ljForceMag = (r) => { const s6 = r ** -6; return (24 * (2 * s6 * s6 - s6)) / r; }; // −dV/dr
  const ljShift = ljPair(LJ_RC);
  const ljEnergy = (x) => { let e = 0; const n = x.length / 2; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { const r = Math.hypot(x[2 * i] - x[2 * j], x[2 * i + 1] - x[2 * j + 1]); if (r < LJ_RC) e += ljPair(r) - ljShift; } return e; };
  const curlG = (r) => (r < LJ_RC ? (1 - r / LJ_RC) ** 2 : 0);
  const ljForces = (x, eps = 0) => {
    const n = x.length / 2, f = new Float64Array(2 * n);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = x[2 * i] - x[2 * j], dy = x[2 * i + 1] - x[2 * j + 1], r = Math.hypot(dx, dy);
      if (r >= LJ_RC) continue;
      const m = ljForceMag(r), ux = dx / r, uy = dy / r, g = eps * curlG(r);
      const fx = m * ux - g * uy, fy = m * uy + g * ux; // 第二项：垂直于连线
      f[2 * i] += fx; f[2 * i + 1] += fy; f[2 * j] -= fx; f[2 * j + 1] -= fy;
    }
    return f;
  };
  // 六边形的 7 原子团簇 + 固定种子的初速度（去掉质心动量和角动量），温度 kT
  const cluster = (kT = 0.05, seed = 3) => {
    const a = 2 ** (1 / 6), x = [0, 0];
    for (let k = 0; k < 6; k++) x.push(a * Math.cos((k * Math.PI) / 3), a * Math.sin((k * Math.PI) / 3));
    const R = rng(seed), n = x.length / 2, v = [];
    for (let i = 0; i < 2 * n; i++) { const u1 = Math.max(R(), 1e-12), u2 = R(); v.push(Math.sqrt(-2 * Math.log(u1)) * Math.cos(TAU * u2) * Math.sqrt(kT)); }
    for (const k of [0, 1]) { let m = 0; for (let i = 0; i < n; i++) m += v[2 * i + k]; for (let i = 0; i < n; i++) v[2 * i + k] -= m / n; }
    let Lz = 0, I = 0; for (let i = 0; i < n; i++) { Lz += x[2 * i] * v[2 * i + 1] - x[2 * i + 1] * v[2 * i]; I += x[2 * i] ** 2 + x[2 * i + 1] ** 2; }
    const w = Lz / I; for (let i = 0; i < n; i++) { v[2 * i] += w * x[2 * i + 1]; v[2 * i + 1] -= w * x[2 * i]; }
    return { x: Float64Array.from(x), v: Float64Array.from(v), t: 0 };
  };
  const kinetic = (v) => { let k = 0; for (let i = 0; i < v.length; i++) k += v[i] * v[i]; return k / 2; };
  // 速度 Verlet 走 steps 步
  const verlet = (st, dt, steps, eps = 0) => {
    let f = ljForces(st.x, eps);
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < st.x.length; i++) { st.v[i] += 0.5 * dt * f[i]; st.x[i] += dt * st.v[i]; }
      f = ljForces(st.x, eps);
      for (let i = 0; i < st.x.length; i++) st.v[i] += 0.5 * dt * f[i];
      st.t += dt;
    }
    return st;
  };
  // 把第 k 个原子沿边长 h 的小正方形走一圈，力做的功 ∮F·dl（中点法）：保守力是 0（到 h 的高阶），有旋度的力不是
  const loopWork = (x0, k, h, eps = 0, n = 40) => {
    const corners = [[0, 0], [h, 0], [h, h], [0, h], [0, 0]], x = Float64Array.from(x0);
    let W = 0;
    for (let s = 0; s < 4; s++) { const [ax, ay] = corners[s], [bx, by] = corners[s + 1]; for (let i = 0; i < n; i++) { const t = (i + 0.5) / n; x[2 * k] = x0[2 * k] + ax + (bx - ax) * t; x[2 * k + 1] = x0[2 * k + 1] + ay + (by - ay) * t; const f = ljForces(x, eps); W += (f[2 * k] * (bx - ax) + f[2 * k + 1] * (by - ay)) / n; } }
    return W;
  };

  // ── 第七章：论文和官方资料里的数字，以及高斯过程的小实验 ────────
  // 数字原样抄自 Batzner 等人论文 arXiv 第 3 版（2021-12-16）的表格，单位写在每一项里。云端会话打不开 Nature 的网页，没能逐项对照正式发表的版本。
  const PAPER = {
    // 表 II：revised MD-17，1000 个构型（950 训练 + 50 验证）；能量 meV、力分量 meV/Å 的 MAE，l = 0, 1, 2, 3
    rmd17: {
      Aspirin: { E: [25.2, 3.8, 2.4, 2.3], F: [41.9, 12.9, 8.7, 8.5] },
      Azobenzene: { E: [20.3, 1.1, 0.8, 0.7], F: [42.3, 5.6, 4.2, 3.6] },
      Benzene: { E: [3.2, 0.09, 0.06, 0.04], F: [10.3, 0.4, 0.4, 0.3] },
      Ethanol: { E: [2.0, 1.0, 0.5, 0.4], F: [13.7, 7.6, 4.2, 3.4] },
      Malonaldehyde: { E: [4.4, 1.6, 0.9, 0.8], F: [23.4, 10.4, 6.0, 5.2] },
      Naphthalene: { E: [14.7, 0.4, 0.3, 0.2], F: [20.1, 2.0, 1.3, 1.2] },
      Paracetamol: { E: [17.5, 2.1, 1.4, 1.4], F: [37.6, 10.8, 6.9, 6.9] },
      'Salicylic acid': { E: [11.4, 1.0, 0.8, 0.7], F: [28.7, 5.7, 4.2, 4.0] },
      Toluene: { E: [9.7, 0.5, 0.3, 0.3], F: [27.2, 2.7, 1.8, 1.6] },
      Uracil: { E: [10.0, 0.6, 0.4, 0.4], F: [25.8, 4.1, 3.0, 3.2] },
    },
    // 同一张表里其他方法的力 MAE（meV/Å）：没有报告的写 null
    rmd17Others: {
      FCHL19: [20.9, 10.8, 2.6, 6.2, 10.2, 6.5, 12.2, 9.5, 8.8, 4.2], GAP: [44.9, 24.5, 6.0, 18.1, 26.4, 16.5, 28.9, 24.7, 17.8, 17.6],
      ANI: [40.6, 35.4, 10.0, 13.4, 24.5, 29.2, 30.4, 29.7, 24.3, 21.4], ACE: [17.9, 10.9, 0.5, 7.3, 11.1, 5.1, 12.7, 9.3, 6.5, 6.6],
    },
    // 表 VI：LiPS（Li6.75P3S11，83 个原子），训练集 10 / 100 / 1000 / 2500 个结构；能量 meV/atom、力 meV/Å
    lips: { N: [10, 100, 1000, 2500], Emae: [2.03, 0.44, 0.12, 0.08], Fmae: [109.9, 28.4, 8.3, 4.9], Frmse: [142.0, 36.8, 11.2, 6.6] },
    // 表 IV：水和三种冰，力分量 RMSE（meV/Å）。NequIP 只用 133 个结构（模型 a，λ_E = 0），DeepMD 用 133 500 个
    water: { parts: ['Liquid water', 'Ice Ih (b)', 'Ice Ih (c)', 'Ice Ih (d)'], nequip: [12.5, 10.8, 12.5, 10.3], deepmd: [40.4, 43.3, 26.8, 25.4], nNequip: 133, nDeepmd: 133500 },
    // 正文：LiPS 的 Li 扩散系数，NequIP（2500 个结构训练，十条 50 ps 轨迹的平均）对 AIMD，单位 cm²/s
    lipsDiffusion: { nequip: 1.25e-5, aimd: 1.37e-5 },
  };
  // 幂律拟合 ε = a N^b（对 log ε、log N 做最小二乘），返回 { a, b }
  const powerFit = (N, eps) => { const X = N.map(Math.log), Y = eps.map(Math.log), n = X.length, mx = X.reduce((s, v) => s + v, 0) / n, my = Y.reduce((s, v) => s + v, 0) / n; let sxy = 0, sxx = 0; for (let i = 0; i < n; i++) { sxy += (X[i] - mx) * (Y[i] - my); sxx += (X[i] - mx) ** 2; } const b = sxy / sxx; return { a: Math.exp(my - b * mx), b }; };

  // 高斯过程（RBF 核）拟合一维势能曲线：只用能量，或者能量加力（导数观测）。返回在 xs 上的能量和力的预测
  const solve = (A, b) => { // 带部分主元的高斯消元
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) { let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r; [M[c], M[p]] = [M[p], M[c]]; for (let r = c + 1; r < n; r++) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; } }
    const x = new Array(n).fill(0); for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / M[r][r]; }
    return x;
  };
  const gpFit = (train, xs, { ell = 0.35, sf = 1, noise = 1e-6, forces = false } = {}) => {
    // 观测：每个点一个能量；forces 时另加一个“导数” dE/dx = −F
    const obs = [];
    for (const p of train) { obs.push({ x: p.x, d: 0, y: p.E }); if (forces) obs.push({ x: p.x, d: 1, y: -p.F }); }
    const mu = train.reduce((s, p) => s + p.E, 0) / train.length, l2 = ell * ell;
    const k = (a, da, b, db) => { const r = a - b, e = sf * sf * Math.exp((-r * r) / (2 * l2)); if (!da && !db) return e; if (da && !db) return (-r / l2) * e; if (!da && db) return (r / l2) * e; return (1 / l2 - (r * r) / (l2 * l2)) * e; };
    const K = obs.map((o) => obs.map((q) => k(o.x, o.d, q.x, q.d))); K.forEach((r, i) => { r[i] += noise; });
    const alpha = solve(K, obs.map((o) => o.y - (o.d ? 0 : mu)));
    return xs.map((x) => ({ x, E: mu + obs.reduce((s, o, i) => s + k(x, 0, o.x, o.d) * alpha[i], 0), F: -obs.reduce((s, o, i) => s + k(x, 1, o.x, o.d) * alpha[i], 0) }));
  };

  // ── 第八章：代价的估计 ──────────────────────────────────────────
  // 数密度（原子 / Å³），由常见的密度和晶格常数算出：水 1.0 g/cm³（18.015 g/mol，每个分子 3 个原子）、硅 a = 5.431 Å 的金刚石结构、铜 a = 3.615 Å 的面心立方
  const NA = 6.02214076e23;
  const DENSITY = { water: (3 * NA) / 18.015 / 1e24, si: 8 / 5.431 ** 3, cu: 4 / 3.615 ** 3 };
  const sphereN = (rho, r) => (4 / 3) * Math.PI * r ** 3 * rho; // 半径 r 的球里平均有多少个原子（不算中心的那一个时再减 1）

  window.MOLASTRIA_NEQUIP_MODELS = { TAU, rng, dot, cross, sub, norm, matVec, matMul, transpose, Rx, Ry, Rz, euler, morse, morseF, harmonic, cubic, MOL, centred, vecModel, badModel, pairEnergy, equivError, fact, legendreP, realSH, shVec, gaussLegendre, sphereGrid, wignerD, shEval, cgComplex, toReal, cgReal, tensorProduct, toL1, fromL1, tpPaths, featureIrreps, irrepName, bessel, envelope, envelopeD, envelopeD2, scatter, neighbours, hops, LJ_RC, ljPair, ljForceMag, ljEnergy, ljForces, cluster, kinetic, verlet, loopWork, PAPER, powerFit, solve, gpFit, NA, DENSITY, sphereN };
})();
