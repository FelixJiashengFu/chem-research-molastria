'use strict';
// 化学机器学习（/chem-ml/）演示背后的数学：纯函数，没有 DOM。tools/chemml-test.mjs 对照解析结果和已知性质测这里的每一个函数。
// 页面里 cml-demos.js 经 window.MOLASTRIA_CHEMML_MODELS 拿到它们。
// 内容：带种子的随机数 · 线性代数（Cholesky、Jacobi 对角化）· 小型 SMILES 读法（价态、芳香性的凯库勒检查、分子式和分子量）·
// ECFP 式的圆形指纹和 Tanimoto · Coulomb 矩阵 · 核函数和高斯过程（后验、边际似然、按网格挑超参数）· 岭回归、k 近邻、核岭回归和学习曲线 ·
// 一层隐藏层的神经网络（解析梯度 + Adam）· Weisfeiler–Lehman 着色（消息传递的分辨能力）· 采集函数（EI、UCB、PI）和贝叶斯优化循环 ·
// 主动学习（方差采样、委员会）· SMILES 记号的 n 元语言模型 · 多项式外推和适用域 · Pareto 前沿和超体积 · 按“骨架”分组的数据集和三种划分 ·
// 特征筛选泄漏 · 不确定度的校准。全部自己写，没有复制任何程序（RDKit、scikit-learn、GPyTorch、BoTorch……）的代码；
// 指纹的哈希和 RDKit 不同，数值不能和它直接比，性质（同一个分子不同写法给出同一个指纹、相似度的排序）是一样的。
(() => {
  // ── 随机数 ───────────────────────────────────────────────────────
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    let spare = null;
    next.normal = () => { if (spare !== null) { const s = spare; spare = null; return s; } let u = 0, v = 0; while (u === 0) u = next(); v = next(); const r = Math.sqrt(-2 * Math.log(u)); spare = r * Math.sin(2 * Math.PI * v); return r * Math.cos(2 * Math.PI * v); };
    next.int = (n) => Math.floor(next() * n);
    next.shuffle = (arr) => { const a2 = arr.slice(); for (let i = a2.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [a2[i], a2[j]] = [a2[j], a2[i]]; } return a2; };
    return next;
  }
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  const std = (v) => { const m = mean(v); return Math.sqrt(v.reduce((s, x) => s + (x - m) ** 2, 0) / v.length); };
  const median = (v) => { const s = v.slice().sort((a, b) => a - b), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
  const rmse = (a, b) => Math.sqrt(a.reduce((s, x, i) => s + (x - b[i]) ** 2, 0) / a.length);
  const mae = (a, b) => a.reduce((s, x, i) => s + Math.abs(x - b[i]), 0) / a.length;
  const r2 = (pred, y) => { const m = mean(y), ss = y.reduce((s, v) => s + (v - m) ** 2, 0); return 1 - y.reduce((s, v, i) => s + (v - pred[i]) ** 2, 0) / ss; };
  const sq = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - b[i]) ** 2; return s; };

  // 误差函数（Numerical Recipes 的 erfc 切比雪夫近似，相对误差 < 1.2 × 10⁻⁷）
  function erfc(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const r = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? r : 2 - r;
  }
  const Phi = (z) => 0.5 * erfc(-z / Math.SQRT2);
  const phi = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);

  // ── 线性代数 ─────────────────────────────────────────────────────
  // Cholesky：A = L Lᵀ（A 对称正定）；不正定时返回 null
  function cholesky(A) {
    const n = A.length, L = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        let s = A[i][j];
        const Li = L[i], Lj = L[j];
        for (let k = 0; k < j; k++) s -= Li[k] * Lj[k];
        if (i === j) { if (!(s > 0)) return null; Li[i] = Math.sqrt(s); } else Li[j] = s / Lj[j];
      }
    }
    return L;
  }
  const fwd = (L, b) => { const n = L.length, x = new Float64Array(n); for (let i = 0; i < n; i++) { let s = b[i]; for (let k = 0; k < i; k++) s -= L[i][k] * x[k]; x[i] = s / L[i][i]; } return x; };
  const bwd = (L, b) => { const n = L.length, x = new Float64Array(n); for (let i = n - 1; i >= 0; i--) { let s = b[i]; for (let k = i + 1; k < n; k++) s -= L[k][i] * x[k]; x[i] = s / L[i][i]; } return x; };
  const cholSolve = (L, b) => bwd(L, fwd(L, b));
  // 对称矩阵的 Jacobi 对角化：返回从大到小的本征值和对应的本征向量（列）
  function symEig(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = range(n).map((i) => range(n).map((j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = range(n).sort((a, b) => A[b][b] - A[a][a]);
    return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => range(n).map((k) => V[k][i])) };
  }
  // 一般线性方程组（带部分主元的高斯消元），岭回归用
  function solve(A0, b0) {
    const n = A0.length, A = A0.map((r) => Array.from(r)), b = Array.from(b0);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(A[r][c]) > Math.abs(A[p][c])) p = r;
      [A[c], A[p]] = [A[p], A[c]]; [b[c], b[p]] = [b[p], b[c]];
      const d = A[c][c] || 1e-300;
      for (let r = c + 1; r < n; r++) { const f = A[r][c] / d; if (!f) continue; for (let k = c; k < n; k++) A[r][k] -= f * A[c][k]; b[r] -= f * b[c]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = b[r]; for (let k = r + 1; k < n; k++) s -= A[r][k] * x[k]; x[r] = s / (A[r][r] || 1e-300); }
    return x;
  }

  // ── SMILES：一个够用的小读法 ─────────────────────────────────────
  // 认得：B C N O P S F Cl Br I、芳香的 b c n o p s、方括号原子（同位素、H 数、电荷）、键 - = # :、分支、环号 0–9 和 %nn、'.' 分开的几个组分；
  // 不认得手性和双键构型的符号（@、/、\ 会被读过去，但不进入指纹）。价态按常见的价（N 3/5、S 2/4/6……）补隐含氢，
  // 芳香原子要能写成凯库勒式（每个需要双键的芳香原子都能在芳香键上配成对），否则算无效：c1cccc1 就过不了。
  const ELEM = { H: [1, 1.008], B: [5, 10.81], C: [6, 12.011], N: [7, 14.007], O: [8, 15.999], F: [9, 18.998], Na: [11, 22.99], Si: [14, 28.085], P: [15, 30.974], S: [16, 32.06], Cl: [17, 35.45], K: [19, 39.098], Se: [34, 78.971], Br: [35, 79.904], I: [53, 126.904] };
  const VAL = { B: [3], C: [4], N: [3, 5], O: [2], P: [3, 5], S: [2, 4, 6], F: [1], Cl: [1], Br: [1], I: [1], Si: [4], Se: [2, 4, 6] };
  const TOKEN = /\[[^\]]*\]|Br|Cl|%\d\d|[BCNOPSFI]|[bcnops]|[()=#\-:/\\.]|\d/g;
  function tokens(s) {
    const out = []; let pos = 0;
    TOKEN.lastIndex = 0;
    for (let m = TOKEN.exec(s); m; m = TOKEN.exec(s)) { if (m.index !== pos) return null; out.push(m[0]); pos = m.index + m[0].length; }
    return pos === s.length ? out : null;
  }
  function parseSmiles(s) {
    const fail = (why) => ({ ok: false, why });
    s = String(s || '').trim();
    if (!s) return fail('empty');
    const tk = tokens(s);
    if (!tk) return fail('token');
    const atoms = [], bonds = [], stack = [], rings = {};
    let prev = -1, pending = null;
    const addBond = (a, b, order) => {
      if (a === b || bonds.some((x) => (x.a === a && x.b === b) || (x.a === b && x.b === a))) return false;
      const arom = order === null ? atoms[a].arom && atoms[b].arom : order === 1.5;
      bonds.push({ a, b, order: order === null ? (arom ? 1.5 : 1) : order, implicit: order === null });
      return true;
    };
    const BO = { '-': 1, '=': 2, '#': 3, ':': 1.5, '/': 1, '\\': 1 };
    for (const t of tk) {
      if (t === '(') { if (prev < 0) return fail('branch'); stack.push(prev); continue; }
      if (t === ')') { if (!stack.length || pending !== null) return fail('branch'); prev = stack.pop(); continue; }
      if (t === '.') { if (prev < 0 || pending !== null || stack.length) return fail('dot'); prev = -1; continue; }
      if (t in BO) { if (prev < 0 || pending !== null) return fail('bond'); pending = BO[t]; continue; }
      if (/^(%\d\d|\d)$/.test(t)) {
        if (prev < 0) return fail('ring');
        const k = t.replace('%', '');
        if (rings[k]) { const r = rings[k]; delete rings[k]; let o = pending ?? r.order; if (pending !== null && r.order !== null && pending !== r.order) return fail('ring'); if (!addBond(r.atom, prev, o)) return fail('ring'); }
        else rings[k] = { atom: prev, order: pending };
        pending = null; continue;
      }
      let a;
      if (t[0] === '[') {
        const m = /^\[(\d*)([A-Z][a-z]?|se|as|[bcnops])(@{0,2})(?:H(\d?))?([+-]\d*|\++|-+)?\]$/.exec(t);
        if (!m) return fail('bracket');
        const raw = m[2], arom = /^[a-z]/.test(raw), el = arom ? raw[0].toUpperCase() + raw.slice(1) : raw;
        if (!ELEM[el]) return fail('element');
        let ch = 0; const c = m[5] || '';
        if (c) ch = /\d/.test(c) ? (c[0] === '+' ? 1 : -1) * Number(c.slice(1)) : (c[0] === '+' ? 1 : -1) * c.length;
        a = { el, arom, charge: ch, hFix: m[4] === undefined ? 0 : Number(m[4] || 1), bracket: true };
      } else {
        const arom = /^[a-z]$/.test(t);
        a = { el: arom ? t.toUpperCase() : t, arom, charge: 0, hFix: null, bracket: false };
      }
      atoms.push(a);
      const i = atoms.length - 1;
      if (prev >= 0 && !addBond(prev, i, pending)) return fail('bond');
      pending = null; prev = i;
    }
    if (pending !== null || stack.length) return fail('dangling');
    if (Object.keys(rings).length) return fail('ring-open');
    if (!atoms.length) return fail('empty');
    const mol = { atoms, bonds };
    const nb = atoms.map(() => []);
    bonds.forEach((b, k) => { nb[b.a].push([b.b, k]); nb[b.b].push([b.a, k]); });
    mol.nb = nb;
    // 环键：去掉这根键两头还连得上
    const reach = (from, to, skip) => { const seen = new Set([from]), q = [from]; while (q.length) { const x = q.pop(); if (x === to) return true; for (const [y, k] of nb[x]) if (k !== skip && !seen.has(y)) { seen.add(y); q.push(y); } } return false; };
    bonds.forEach((b, k) => { b.ring = reach(b.a, b.b, k); if (b.implicit && b.order === 1.5 && !b.ring) b.order = 1; });
    atoms.forEach((a, i) => { a.ring = nb[i].some(([, k]) => bonds[k].ring); a.degree = nb[i].length; });
    for (const b of bonds) if (b.order === 1.5 && !b.ring) return fail('aromatic-chain');
    for (const a of atoms) if (a.arom && !a.ring) return fail('aromatic-chain');
    // 价态和隐含氢
    for (let i = 0; i < atoms.length; i++) {
      const a = atoms[i];
      let used = 0, nAr = 0;
      for (const [, k] of nb[i]) { const o = bonds[k].order; if (o === 1.5) nAr++; else used += o; }
      a.needPi = false;
      if (a.arom) {
        used += nAr;
        const donor = a.el === 'O' || a.el === 'S' || a.el === 'Se' || (a.bracket && a.hFix > 0 && (a.el === 'N' || a.el === 'P')) || ((a.el === 'N' || a.el === 'P') && a.charge === 0 && used >= 3);
        // 已经有环外双键（如 c(=O)）或者再加一个 π 键就超价的芳香原子，不再需要环里的双键
        if (!donor && used + 1 <= Math.max(...(VAL[a.el] || [4])) + (a.charge > 0 && a.el === 'N' ? 1 : 0)) { used += 1; a.needPi = true; }
      }
      if (a.bracket) {
        a.h = a.hFix;
        const allowed = (VAL[a.el] || [used + a.h]).map((v) => v + (a.el === 'N' || a.el === 'P' || a.el === 'O' || a.el === 'S' ? a.charge : -Math.abs(a.charge)));
        if (VAL[a.el] && used + a.h > Math.max(...allowed) && !(a.el === 'C' && a.charge !== 0 && used + a.h <= 3)) return fail('valence');
      } else {
        const v = VAL[a.el];
        if (!v) return fail('element');
        const fitV = v.find((x) => x >= used);
        if (fitV === undefined) return fail('valence');
        a.h = fitV - used;
      }
    }
    // 凯库勒检查：需要 π 键的芳香原子在芳香键上能两两配对（增广路的二分图……这里是一般图，用回溯，分子小）
    const need = atoms.map((a, i) => (a.needPi ? i : -1)).filter((i) => i >= 0);
    if (need.length) {
      if (need.length % 2) return fail('kekule');
      const needSet = new Set(need), match = new Map();
      const order = need.slice().sort((x, y) => nb[x].length - nb[y].length);
      const solveK = (idx) => {
        while (idx < order.length && match.has(order[idx])) idx++;
        if (idx === order.length) return true;
        const x = order[idx];
        for (const [y, k] of nb[x]) if (bonds[k].order === 1.5 && needSet.has(y) && !match.has(y)) { match.set(x, y); match.set(y, x); if (solveK(idx + 1)) return true; match.delete(x); match.delete(y); }
        return false;
      };
      if (!solveK(0)) return fail('kekule');
    }
    // 分子式（Hill 写法）和分子量
    const count = {};
    for (const a of atoms) { count[a.el] = (count[a.el] || 0) + 1; if (a.h) count.H = (count.H || 0) + a.h; }
    const keys = Object.keys(count).sort((x, y) => (count.C ? (x === 'C' ? -1 : y === 'C' ? 1 : x === 'H' ? -1 : y === 'H' ? 1 : 0) : 0) || x.localeCompare(y));
    mol.formula = keys.map((k) => `${k}${count[k] > 1 ? count[k] : ''}`).join('');
    mol.mw = Object.entries(count).reduce((s, [k, n]) => s + ELEM[k][1] * n, 0);
    mol.heavy = atoms.length;
    mol.ok = true;
    mol.charge = atoms.reduce((s, a) => s + a.charge, 0);
    return mol;
  }

  // ── 圆形指纹（ECFP 的做法，哈希自己定）──────────────────────────
  // FNV-1a 32 位
  const hash = (arr) => { let h = 0x811c9dc5; const s = arr.join(','); for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; } return h >>> 0; };
  const ATOMNO = (el) => ELEM[el][0];
  // 返回 { ids: Set, perAtom: [[r=0 的 id, r=1 …]], bits: Set }
  function ecfp(mol, radius = 2, nbits = 2048) {
    const { atoms, bonds, nb } = mol;
    let cur = atoms.map((a) => hash([ATOMNO(a.el), a.degree, a.h, a.charge, a.ring ? 1 : 0, a.arom ? 1 : 0]));
    const perAtom = cur.map((x) => [x]), ids = new Set(cur), envs = new Set(atoms.map((_, i) => `0:${i}`));
    // 每个原子在每个半径覆盖的键集合：两个原子的环境一样（覆盖同一组键）时只留一个，和 ECFP 去重的做法一样
    let cover = atoms.map(() => new Set()), seenCover = new Set();
    for (let r = 1; r <= radius; r++) {
      const next = atoms.map((_, i) => hash([r, cur[i], ...nb[i].map(([j, k]) => `${bonds[k].order}:${cur[j]}`).sort()]));
      const newCover = atoms.map((_, i) => { const s = new Set(cover[i]); for (const [j, k] of nb[i]) { s.add(k); for (const x of cover[j]) s.add(x); } return s; });
      atoms.forEach((_, i) => {
        perAtom[i].push(next[i]);
        const key = [...newCover[i]].sort((x, y) => x - y).join(',');
        if (!seenCover.has(key) || !newCover[i].size) { seenCover.add(key); ids.add(next[i]); envs.add(`${r}:${i}`); }
      });
      cur = next; cover = newCover;
    }
    const bits = new Set([...ids].map((x) => x % nbits));
    return { ids, perAtom, bits, envs };
  }
  const tanimoto = (A, B) => { let both = 0; for (const x of A) if (B.has(x)) both++; const u = A.size + B.size - both; return u ? both / u : 1; };
  // 离原子 i 不超过 r 根键的原子（ECFP 一个环境覆盖的范围）
  function shell(mol, i, r) {
    const d = new Map([[i, 0]]), q = [i];
    while (q.length) { const x = q.shift(); if (d.get(x) >= r) continue; for (const [y] of mol.nb[x]) if (!d.has(y)) { d.set(y, d.get(x) + 1); q.push(y); } }
    return d;
  }

  // 二维摆放：弹簧模型（键长 1，非键原子互相排斥），只为了画图；从 BFS 顺序摆成的圆开始，确定性的
  function layout2d(mol, iters = 500) {
    const n = mol.atoms.length;
    if (n === 1) return [[0, 0]];
    const P = range(n).map((i) => [Math.cos((2 * Math.PI * i) / n) * n * 0.25 + 0.01 * i, Math.sin((2 * Math.PI * i) / n) * n * 0.25]);
    const bonded = new Set(mol.bonds.map((b) => `${Math.min(b.a, b.b)},${Math.max(b.a, b.b)}`));
    for (let t = 0; t < iters; t++) {
      const F = range(n).map(() => [0, 0]), step = 0.12 * (1 - t / iters) + 0.01;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], d = Math.hypot(dx, dy) || 1e-3, ux = dx / d, uy = dy / d;
        let f = bonded.has(`${i},${j}`) ? (d - 1) * 2 : -0.9 / (d * d);
        if (!bonded.has(`${i},${j}`) && d > 3) f *= 0.3;
        F[i][0] += f * ux; F[i][1] += f * uy; F[j][0] -= f * ux; F[j][1] -= f * uy;
      }
      for (let i = 0; i < n; i++) { const m = Math.hypot(F[i][0], F[i][1]), c = m > 1 ? 1 / m : 1; P[i][0] += step * F[i][0] * c; P[i][1] += step * F[i][1] * c; }
    }
    const cx = mean(P.map((p) => p[0])), cy = mean(P.map((p) => p[1]));
    return P.map((p) => [p[0] - cx, p[1] - cy]);
  }

  // ── Weisfeiler–Lehman 着色：消息传递网络（求和读出）分得开的分子，WL 也分得开 ──
  function wl(mol, rounds) {
    let col = mol.atoms.map((a) => hash([a.el, a.degree]));
    const hist = [counts(col)];
    for (let t = 0; t < rounds; t++) { col = col.map((c, i) => hash([c, ...mol.nb[i].map(([j]) => col[j]).sort()])); hist.push(counts(col)); }
    return { col, hist };
    function counts(c) { const m = {}; for (const x of c) m[x] = (m[x] || 0) + 1; return Object.entries(m).map(([k, v]) => `${k}x${v}`).sort().join('|'); }
  }
  // 一层“消息传递”的数值版本：h ← tanh(W h + U Σ 邻居 h)，读出 Σ h。权重固定（随机种子），只为了看出置换不变
  function mpnnReadout(mol, rounds, seed = 7, dim = 8) {
    const R = rng(seed), W = range(dim).map(() => range(dim).map(() => R.normal() * 0.5)), U = range(dim).map(() => range(dim).map(() => R.normal() * 0.5));
    const emb = {}; const e = (el) => (emb[el] ||= (() => { const r2_ = rng(ATOMNO(el) * 97 + 3); return range(dim).map(() => r2_.normal()); })());
    let h = mol.atoms.map((a) => e(a.el).map((v, k) => v + 0.1 * a.degree * (k % 2 ? 1 : -1)));
    for (let t = 0; t < rounds; t++) {
      h = h.map((hi, i) => { const s = new Array(dim).fill(0); for (const [j] of mol.nb[i]) for (let k = 0; k < dim; k++) s[k] += h[j][k]; return range(dim).map((k) => Math.tanh(W[k].reduce((acc, w, m) => acc + w * hi[m], 0) + U[k].reduce((acc, u, m) => acc + u * s[m], 0))); });
    }
    return range(dim).map((k) => h.reduce((acc, hi) => acc + hi[k], 0));
  }
  // 把分子的原子重新编号（测试置换不变用）
  function permute(mol, perm) {
    const inv = []; perm.forEach((p, i) => { inv[p] = i; });
    const atoms = perm.map((p) => ({ ...mol.atoms[p] })), bonds = mol.bonds.map((b) => ({ ...b, a: inv[b.a], b: inv[b.b] }));
    const nb = atoms.map(() => []); bonds.forEach((b, k) => { nb[b.a].push([b.b, k]); nb[b.b].push([b.a, k]); });
    return { ...mol, atoms, bonds, nb };
  }

  // ── Coulomb 矩阵（Rupp 等 2012）────────────────────────────────
  const BOHR = 0.529177210903;
  const GEOMS = {
    h2o: { name: ['水', 'water'], atoms: [['O', 0, 0, 0.1173], ['H', 0, 0.7572, -0.4692], ['H', 0, -0.7572, -0.4692]] },
    nh3: { name: ['氨', 'ammonia'], atoms: [['N', 0, 0, 0.1162], ['H', 0, 0.9377, -0.2711], ['H', 0.8121, -0.4689, -0.2711], ['H', -0.8121, -0.4689, -0.2711]] },
    ch4: { name: ['甲烷', 'methane'], atoms: [['C', 0, 0, 0], ['H', 0.6291, 0.6291, 0.6291], ['H', -0.6291, -0.6291, 0.6291], ['H', -0.6291, 0.6291, -0.6291], ['H', 0.6291, -0.6291, -0.6291]] },
    ch2o: { name: ['甲醛', 'formaldehyde'], atoms: [['C', 0, 0, 0], ['O', 0, 0, 1.205], ['H', 0, 0.943, -0.587], ['H', 0, -0.943, -0.587]] },
    c2h4: { name: ['乙烯', 'ethylene'], atoms: [['C', 0, 0, 0.6695], ['C', 0, 0, -0.6695], ['H', 0, 0.9289, 1.2321], ['H', 0, -0.9289, 1.2321], ['H', 0, 0.9289, -1.2321], ['H', 0, -0.9289, -1.2321]] },
    hcn: { name: ['氰化氢', 'hydrogen cyanide'], atoms: [['H', 0, 0, -1.6644], ['C', 0, 0, -0.5986], ['N', 0, 0, 0.5532]] },
  };
  function coulombMatrix(atoms) {
    const Z = atoms.map((a) => ATOMNO(a[0])), R = atoms.map((a) => [a[1] / BOHR, a[2] / BOHR, a[3] / BOHR]);
    return Z.map((zi, i) => Z.map((zj, j) => (i === j ? 0.5 * zi ** 2.4 : (zi * zj) / Math.sqrt(sq(R[i], R[j])))));
  }
  const cmEigen = (atoms, pad = 0) => { const v = symEig(coulombMatrix(atoms)).values; while (v.length < pad) v.push(0); return v; };
  function rotateAtoms(atoms, a, b) {
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    return atoms.map(([el, x, y, z]) => { const x1 = ca * x - sa * y, y1 = sa * x + ca * y; return [el, x1, cb * y1 - sb * z, sb * y1 + cb * z]; });
  }

  // ── 核函数和高斯过程 ─────────────────────────────────────────────
  // 输入都是数组（一维的也写成 [x]）。kernel：{ type, l, s2 }，type ∈ rbf | m52 | m32 | per | lin
  function kfun(K) {
    const l = K.l, s2 = K.s2 ?? 1;
    if (K.type === 'm52') return (a, b) => { const r = Math.sqrt(sq(a, b)) / l, q = Math.sqrt(5) * r; return s2 * (1 + q + (q * q) / 3) * Math.exp(-q); };
    if (K.type === 'm32') return (a, b) => { const q = (Math.sqrt(3) * Math.sqrt(sq(a, b))) / l; return s2 * (1 + q) * Math.exp(-q); };
    if (K.type === 'per') return (a, b) => { const p = K.p || 0.5; let s = 0; for (let i = 0; i < a.length; i++) s += Math.sin((Math.PI * Math.abs(a[i] - b[i])) / p) ** 2; return s2 * Math.exp((-2 * s) / (l * l)); };
    if (K.type === 'lin') return (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += (a[i] - 0.5) * (b[i] - 0.5); return s2 * (s / (l * l)) + 1e-9; };
    return (a, b) => s2 * Math.exp(-sq(a, b) / (2 * l * l));
  }
  // 拟合：X（n×d），y（n），noise 是噪声方差。返回 { predict(x) → [μ, σ²], lml, alpha, L }
  function gpFit(X, y, K, noise = 1e-6, prior = 0) {
    const n = X.length, k = kfun(K);
    if (!n) return { predict: (x) => [prior, k(x, x)], lml: 0, n: 0 };
    const A = X.map((xi, i) => X.map((xj, j) => k(xi, xj) + (i === j ? noise + 1e-10 : 0)));
    let L = cholesky(A), jit = 1e-8;
    while (!L && jit < 1) { for (let i = 0; i < n; i++) A[i][i] += jit; L = cholesky(A); jit *= 10; }
    const yc = y.map((v) => v - prior), alpha = cholSolve(L, yc);
    let logdet = 0; for (let i = 0; i < n; i++) logdet += Math.log(L[i][i]);
    const lml = -0.5 * yc.reduce((s, v, i) => s + v * alpha[i], 0) - logdet - 0.5 * n * Math.log(2 * Math.PI);
    const predict = (x) => { const ks = X.map((xi) => k(x, xi)); let m = prior; for (let i = 0; i < n; i++) m += ks[i] * alpha[i]; const v = fwd(L, ks); let vv = 0; for (let i = 0; i < n; i++) vv += v[i] * v[i]; return [m, Math.max(1e-12, k(x, x) - vv)]; };
    return { predict, lml, alpha, L, n };
  }
  // 按网格挑超参数（长度 l 和噪声），最大化对数边际似然；y 先标准化
  const L_GRID = [0.03, 0.045, 0.06, 0.08, 0.1, 0.13, 0.17, 0.22, 0.3, 0.4, 0.55, 0.75, 1];
  const N_GRID = [1e-4, 1e-3, 1e-2, 0.03, 0.1];
  function gpAuto(X, y, type = 'rbf', fixNoise, lgrid = L_GRID, ngrid = N_GRID) {
    const m = y.length ? mean(y) : 0, s = y.length > 1 ? std(y) || 1 : 1, ys = y.map((v) => (v - m) / s);
    let best = null;
    for (const l of lgrid) for (const nz of fixNoise !== undefined ? [fixNoise] : ngrid) { const g = gpFit(X, ys, { type, l, s2: 1 }, nz); if (!best || g.lml > best.g.lml) best = { g, l, nz }; }
    const predict = (x) => { const [mu, v] = best.g.predict(x); return [m + s * mu, s * s * v]; };
    return { predict, l: best.l, noise: best.nz, lml: best.g.lml, m, s };
  }
  // 从先验里抽样本函数：xs（一维网格）
  function gpSample(xs, K, nsamp, seed) {
    const k = kfun(K), n = xs.length, A = xs.map((a) => xs.map((b) => k([a], [b])));
    for (let i = 0; i < n; i++) A[i][i] += 1e-6 * (K.s2 ?? 1);
    const L = cholesky(A), R = rng(seed);
    return range(nsamp).map(() => { const z = range(n).map(() => R.normal()); return range(n).map((i) => { let s = 0; for (let j = 0; j <= i; j++) s += L[i][j] * z[j]; return s; }); });
  }
  // 多元正态的对数密度，直接按定义算（测试拿来对 gpFit 的 lml）
  function mvnLogpdf(y, C) {
    const n = y.length, L = cholesky(C), a = cholSolve(L, y);
    let ld = 0; for (let i = 0; i < n; i++) ld += Math.log(L[i][i]);
    return -0.5 * y.reduce((s, v, i) => s + v * a[i], 0) - ld - 0.5 * n * Math.log(2 * Math.PI);
  }

  // ── 学习曲线：同一份数据，四种模型 ──────────────────────────────
  // 一份“分子性质”的玩具数据：二维描述符 x ∈ [0, 1]²，性质是一个光滑的函数加噪声
  const truth2 = (x) => Math.sin(3 * x[0]) * Math.cos(2 * x[1]) + 0.6 * Math.exp(-((x[0] - 0.7) ** 2 + (x[1] - 0.3) ** 2) / 0.05) + 0.5 * x[1];
  function toyData(n, noise, seed) { const R = rng(seed); return range(n).map(() => { const x = [R(), R()]; return { x, y: truth2(x) + noise * R.normal() }; }); }
  function ridgeFit(X, y, lam = 1e-3, feats = (x) => [1, ...x]) {
    const F = X.map(feats), p = F[0].length, A = range(p).map((i) => range(p).map((j) => F.reduce((s, f) => s + f[i] * f[j], 0) + (i === j && i > 0 ? lam : 0))), b = range(p).map((i) => F.reduce((s, f, k) => s + f[i] * y[k], 0));
    const w = solve(A, b);
    return { w, predict: (x) => feats(x).reduce((s, v, i) => s + v * w[i], 0) };
  }
  function knnFit(X, y, k = 5) {
    return { predict: (x) => { const d = X.map((xi, i) => [sq(x, xi), i]).sort((a, b) => a[0] - b[0]).slice(0, Math.min(k, X.length)); return mean(d.map(([, i]) => y[i])); } };
  }
  // 核岭回归 = GP 的后验均值；长度和正则由网格上的边际似然挑
  const krrFit = (X, y) => { const g = gpAuto(X, y, 'rbf', undefined, [0.05, 0.08, 0.13, 0.22, 0.4], [1e-3, 1e-2, 0.05]); return { predict: (x) => g.predict(x)[0], l: g.l }; };
  function learningCurve(kind, sizes, { noise = 0.05, seeds = 4, test = 300 } = {}) {
    const T = toyData(test, 0, 12345);
    return sizes.map((n) => {
      const errs = range(seeds).map((sd) => {
        const D = toyData(n, noise, 1000 + 17 * sd + n), X = D.map((d) => d.x), y = D.map((d) => d.y);
        const model = kind === 'mean' ? { predict: () => mean(y) } : kind === 'linear' ? ridgeFit(X, y) : kind === 'knn' ? knnFit(X, y, 5) : krrFit(X, y);
        return mae(T.map((t) => model.predict(t.x)), T.map((t) => t.y));
      });
      return mean(errs);
    });
  }
  // 对数坐标上的直线拟合：返回斜率和截距
  function loglogSlope(xs, ys) { const X = xs.map(Math.log10), Y = ys.map(Math.log10), mx = mean(X), my = mean(Y); const b = X.reduce((s, x, i) => s + (x - mx) * (Y[i] - my), 0) / X.reduce((s, x) => s + (x - mx) ** 2, 0); return { slope: b, icept: my - b * mx }; }

  // ── 一层隐藏层的神经网络（tanh），全批量 Adam ─────────────────────
  function mlpInit(H, seed) { const R = rng(seed); return { H, w1: range(H).map(() => R.normal() * 3), b1: range(H).map(() => R.normal() * 1.5), w2: range(H).map(() => R.normal() / Math.sqrt(H)), b2: 0, m: null, v: null, t: 0 }; }
  const mlpPredict = (P, x) => { let s = P.b2; for (let j = 0; j < P.H; j++) s += P.w2[j] * Math.tanh(P.w1[j] * x + P.b1[j]); return s; };
  // 均方误差 + λ‖w‖² 的值和解析梯度
  function mlpLossGrad(P, xs, ys, lam = 0) {
    const H = P.H, g = { w1: new Array(H).fill(0), b1: new Array(H).fill(0), w2: new Array(H).fill(0), b2: 0 };
    let loss = 0;
    xs.forEach((x, n) => {
      const a = range(H).map((j) => Math.tanh(P.w1[j] * x + P.b1[j]));
      let out = P.b2; for (let j = 0; j < H; j++) out += P.w2[j] * a[j];
      const e = out - ys[n]; loss += e * e;
      const d = (2 * e) / xs.length;
      g.b2 += d;
      for (let j = 0; j < H; j++) { g.w2[j] += d * a[j]; const dz = d * P.w2[j] * (1 - a[j] * a[j]); g.w1[j] += dz * x; g.b1[j] += dz; }
    });
    loss /= xs.length;
    for (let j = 0; j < H; j++) { loss += lam * (P.w1[j] ** 2 + P.w2[j] ** 2); g.w1[j] += 2 * lam * P.w1[j]; g.w2[j] += 2 * lam * P.w2[j]; }
    return { loss, g };
  }
  function mlpStep(P, xs, ys, lr = 0.01, lam = 0, steps = 1) {
    const keys = ['w1', 'b1', 'w2'];
    let loss = 0;
    for (let s = 0; s < steps; s++) {
      const r = mlpLossGrad(P, xs, ys, lam); loss = r.loss;
      if (!P.m) { P.m = { w1: new Array(P.H).fill(0), b1: new Array(P.H).fill(0), w2: new Array(P.H).fill(0), b2: 0 }; P.v = JSON.parse(JSON.stringify(P.m)); }
      P.t++;
      const b1c = 1 - 0.9 ** P.t, b2c = 1 - 0.999 ** P.t;
      for (const k of keys) for (let j = 0; j < P.H; j++) { P.m[k][j] = 0.9 * P.m[k][j] + 0.1 * r.g[k][j]; P.v[k][j] = 0.999 * P.v[k][j] + 0.001 * r.g[k][j] ** 2; P[k][j] -= (lr * (P.m[k][j] / b1c)) / (Math.sqrt(P.v[k][j] / b2c) + 1e-8); }
      P.m.b2 = 0.9 * P.m.b2 + 0.1 * r.g.b2; P.v.b2 = 0.999 * P.v.b2 + 0.001 * r.g.b2 ** 2; P.b2 -= (lr * (P.m.b2 / b1c)) / (Math.sqrt(P.v.b2 / b2c) + 1e-8);
    }
    return loss;
  }
  const truth1 = (x) => Math.sin(6 * x) * 0.8 + 0.4 * Math.cos(15 * x) * x;
  function data1(n, noise, seed) { const R = rng(seed); return range(n).map(() => { const x = R(); return [x, truth1(x) + noise * R.normal()]; }).sort((a, b) => a[0] - b[0]); }

  // ── 贝叶斯优化 ───────────────────────────────────────────────────
  // 一维：“产率随温度”（x 是归一化的温度），一个宽的局部峰和一个窄的全局峰
  const yield1 = (x) => 0.55 * Math.exp(-(((x - 0.25) / 0.16) ** 2)) + 0.9 * Math.exp(-(((x - 0.74) / 0.06) ** 2)) + 0.05 * Math.sin(9 * x);
  // 二维：温度 × 浓度，全局峰窄、局部峰宽
  const yield2 = (x) => 0.92 * Math.exp(-(((x[0] - 0.76) / 0.1) ** 2 + ((x[1] - 0.28) / 0.13) ** 2)) + 0.62 * Math.exp(-(((x[0] - 0.28) / 0.22) ** 2 + ((x[1] - 0.68) / 0.22) ** 2)) + 0.05 * x[0];
  // 采集函数：μ、σ 是后验，best 是目前最好的值（求最大）
  const EI = (mu, sd, best, xi = 0.01) => { if (sd < 1e-12) return Math.max(0, mu - best - xi); const z = (mu - best - xi) / sd; return (mu - best - xi) * Phi(z) + sd * phi(z); };
  const PI_ = (mu, sd, best, xi = 0.01) => (sd < 1e-12 ? (mu > best + xi ? 1 : 0) : Phi((mu - best - xi) / sd));
  const UCB = (mu, sd, _b, beta = 2) => mu + beta * sd;
  function acquire(name, mu, sd, best, par) { return name === 'ei' ? EI(mu, sd, best, par ?? 0.01) : name === 'pi' ? PI_(mu, sd, best, par ?? 0.01) : name === 'ucb' ? UCB(mu, sd, best, par ?? 2) : name === 'greedy' ? mu : 0; }
  // 一维的一步：给已有的点（xs，ys），返回后验和下一个点
  function boStep1(xs, ys, strategy, { grid = lin(0, 1, 201), seed = 1, par, noise } = {}) {
    const g = gpAuto(xs.map((x) => [x]), ys, 'rbf', noise ?? 1e-4), best = Math.max(...ys);
    const post = grid.map((x) => { const [m, v] = g.predict([x]); return [m, Math.sqrt(v)]; });
    let next;
    if (strategy === 'random') next = rng(seed * 7919 + xs.length)();
    else { const a = post.map(([m, s]) => acquire(strategy, m, s, best, par)); let k = 0; a.forEach((v, i) => { if (v > a[k]) k = i; }); next = grid[k]; if (xs.some((x) => Math.abs(x - next) < 1e-9)) next = grid[(k + 1) % grid.length]; }
    return { g, post, next, acq: strategy === 'random' ? null : post.map(([m, s]) => acquire(strategy, m, s, best, par)) };
  }
  // 起始点：拉丁超立方（每一维分 n 段，每段一个）
  function lhs(n, d, seed) { const R = rng(seed), cols = range(d).map(() => R.shuffle(range(n))); return range(n).map((i) => cols.map((c) => (c[i] + R()) / n)); }
  // 跑一整个循环：返回每一步之后“到目前为止最好的真值”
  function boRun(f, d, strategy, { n0 = 3, budget = 20, seed = 1, grid, par, q = 1 } = {}) {
    const G = grid || (d === 1 ? lin(0, 1, 101).map((x) => [x]) : lin(0, 1, 21).flatMap((a) => lin(0, 1, 21).map((b) => [a, b])));
    const R = rng(seed * 104729 + 11);
    const X = lhs(n0, d, seed), Y = X.map(f), hist = [];
    let bestSoFar = -Infinity;
    for (const y of Y) { bestSoFar = Math.max(bestSoFar, y); hist.push(bestSoFar); }
    while (X.length < budget) {
      let picks = [];
      if (strategy === 'random') picks = range(Math.min(q, budget - X.length)).map(() => range(d).map(() => R()));
      else {
        // q > 1：kriging believer，把选中的点按模型的均值当成“假装测过”，再挑下一个
        const fx = X.slice(), fy = Y.slice();
        for (let b = 0; b < Math.min(q, budget - X.length); b++) {
          const g = gpAuto(fx, fy, 'rbf', 1e-4), best = Math.max(...fy);
          let bi = -1, bv = -Infinity;
          G.forEach((x, i) => { if (fx.some((z) => sq(z, x) < 1e-12)) return; const [m, v] = g.predict(x); const a = acquire(strategy, m, Math.sqrt(v), best, par); if (a > bv) { bv = a; bi = i; } });
          const x = G[bi]; picks.push(x); fx.push(x); fy.push(g.predict(x)[0]);
        }
      }
      for (const x of picks) { X.push(x); const y = f(x); Y.push(y); bestSoFar = Math.max(bestSoFar, y); hist.push(bestSoFar); }
    }
    return { X, Y, hist };
  }
  // 网格上的真最大值（regret 的参照）
  const maxOn = (f, d) => (d === 1 ? Math.max(...lin(0, 1, 2001).map(f)) : Math.max(...lin(0, 1, 201).flatMap((a) => lin(0, 1, 201).map((b) => f([a, b])))));

  // ── 主动学习（一维回归）────────────────────────────────────────
  // 要学的函数：大部分平缓，0.7 附近有一个陡的台阶
  const step1 = (x) => 0.3 * Math.sin(4 * x) + 1 / (1 + Math.exp(-(x - 0.7) / 0.015));
  function activeRun(strategy, { n0 = 4, budget = 30, seed = 1, pool = 200, committee = 5 } = {}) {
    const R = rng(seed * 31 + 5), P = range(pool).map(() => R()).sort((a, b) => a - b), test = lin(0, 1, 301);
    const taken = R.shuffle(range(pool)).slice(0, n0), curve = [];
    const fitAll = (idx) => gpAuto(idx.map((i) => [P[i]]), idx.map((i) => step1(P[i])), 'rbf', 1e-4);
    const err = (g) => rmse(test.map((x) => g.predict([x])[0]), test.map(step1));
    while (true) {
      const g = fitAll(taken);
      curve.push([taken.length, err(g)]);
      if (taken.length >= budget) return { curve, taken: taken.map((i) => P[i]), model: g };
      const free = range(pool).filter((i) => !taken.includes(i));
      let pick;
      if (strategy === 'random') pick = free[R.int(free.length)];
      else if (strategy === 'var') { let bv = -1; for (const i of free) { const v = g.predict([P[i]])[1]; if (v > bv) { bv = v; pick = i; } } }
      else if (strategy === 'fixed') {
        // 方差采样，但长度固定在 0.25、不随数据调：方差只和点的位置有关，结果就是均匀铺开
        const h = gpFit(taken.map((i) => [P[i]]), taken.map(() => 0), { type: 'rbf', l: 0.25, s2: 1 }, 1e-4);
        let bv = -1; for (const i of free) { const v = h.predict([P[i]])[1]; if (v > bv) { bv = v; pick = i; } }
      } else {
        // 委员会：自助重抽样的训练集，各自挑超参数；挑委员们分歧最大的点
        const C = range(committee).map(() => { const boot = [...new Set(taken.map(() => taken[R.int(taken.length)]))]; return fitAll(boot.length > 2 ? boot : taken); });
        let bv = -1; for (const i of free) { const ps = C.map((c) => c.predict([P[i]])[0]); const v = std(ps); if (v > bv) { bv = v; pick = i; } }
      }
      taken.push(pick);
    }
  }

  // ── SMILES 的 n 元语言模型 ───────────────────────────────────────
  // 训练集：常见的小分子（每条都要能被上面的读法读通，测试核对）
  const CORPUS = ['CCO', 'CC(=O)O', 'CC(C)O', 'CCCCO', 'CC(C)=O', 'CCOCC', 'CCN', 'CCCN', 'CNC', 'CN(C)C', 'CC#N', 'CC=C', 'C=CC=C', 'CC(C)C', 'CCCCC', 'C1CCCCC1', 'C1CCCC1', 'C1CCOC1', 'C1CCNCC1', 'C1COCCN1', 'C1CCC(CC1)O', 'C1CCC(=O)CC1', 'c1ccccc1', 'Cc1ccccc1', 'CCc1ccccc1', 'Oc1ccccc1', 'Nc1ccccc1', 'Clc1ccccc1', 'Brc1ccccc1', 'Fc1ccccc1', 'COc1ccccc1', 'O=Cc1ccccc1', 'OC(=O)c1ccccc1', 'CC(=O)c1ccccc1', 'N#Cc1ccccc1', 'O=[N+]([O-])c1ccccc1', 'Cc1ccc(C)cc1', 'Cc1ccccc1C', 'Oc1ccc(O)cc1', 'Nc1ccc(O)cc1', 'c1ccncc1', 'Cc1ccncc1', 'c1ccc2ccccc2c1', 'c1ccc2[nH]ccc2c1', 'c1ccoc1', 'c1ccsc1', 'c1cc[nH]c1', 'c1cnc[nH]1', 'c1ncncn1', 'c1ccc(cc1)c1ccccc1', 'OCCO', 'OCC(O)CO', 'NCCO', 'NCCN', 'OC(=O)CC(=O)O', 'OC(=O)C=CC(=O)O', 'CC(N)C(=O)O', 'NCC(=O)O', 'CC(C)CC(N)C(=O)O', 'OC(=O)CCC(N)C(=O)O', 'CCOC(=O)C', 'COC(=O)C', 'CC(=O)OC(C)=O', 'CC(=O)N', 'CNC(=O)C', 'CN(C)C=O', 'O=C(N)N', 'CS(C)=O', 'CCS', 'CSC', 'CCCl', 'ClCCl', 'ClC(Cl)Cl', 'FC(F)(F)C', 'CCBr', 'CI', 'C=O', 'CC=O', 'CCC=O', 'O=C1CCCC1', 'O=C1CCCCC1', 'CC1CCCCC1', 'CC1=CCCCC1', 'C1=CCCCC1', 'C1=CC=CC1', 'CC(C)(C)O', 'CC(C)(C)C', 'CCCCCC', 'CCCCCCC', 'CCCCCCCC', 'CCCCCCO', 'CCCCCC(=O)O', 'OCc1ccccc1', 'NCc1ccccc1', 'OC(=O)Cc1ccccc1', 'C(=O)Oc1ccccc1', 'Cc1ccc(cc1)S(=O)(=O)O', 'O=S(=O)(O)O', 'OP(=O)(O)O', 'CCOP(=O)(OCC)OCC', 'c1ccc(cc1)O', 'c1ccc(cc1)N', 'c1ccc(cc1)C=O', 'Cc1cccc(C)c1', 'COc1ccc(cc1)C=O', 'CC(=O)Nc1ccc(O)cc1', 'Oc1ccccc1C(=O)O', 'CC(=O)Oc1ccccc1C(=O)O', 'Cn1cnc2c1c(=O)n(C)c(=O)n2C', 'O=C1NC(=O)C=C1', 'O=C1C=CC(=O)C=C1', 'C1CC2CCC1C2', 'C1CC2CCCC2C1', 'C1CCC2CCCCC2C1', 'C1CC1', 'CC1CC1', 'C1CCC1', 'OC1CCCC1', 'NC1CCCCC1', 'C1CCN(CC1)C', 'CN1CCOCC1', 'CCN(CC)CC', 'CCCCN', 'NCCCCN', 'NCCCCCN', 'C(CO)N', 'OCC(=O)O', 'CC(O)C(=O)O', 'OC(CC(=O)O)(CC(=O)O)C(=O)O', 'C=CC(=O)O', 'C=CC#N', 'C=CC=O', 'CC(=C)C', 'CC(=C)C(=O)OC', 'C=Cc1ccccc1', 'C#Cc1ccccc1', 'C#C', 'CC#C', 'N#CC#N', 'O=C=O', 'S=C=S', 'OO', 'NN', 'CON', 'CCON', 'c1ccc2ncccc2c1', 'c1ccc2occc2c1', 'c1ccc2sccc2c1', 'Cc1ccco1', 'Cc1cccs1', 'O=Cc1ccco1', 'c1csc(n1)N', 'c1cc(ccn1)N', 'Nc1ncccn1', 'Cc1cc(C)nc(C)n1', 'COc1ccc(OC)cc1', 'CCOc1ccccc1', 'CCCc1ccccc1', 'CC(C)c1ccccc1'];
  function ngramTrain(corpus, n) {
    const T = {};
    for (const s of corpus) { const tk = ['^', ...tokens(s), '$']; for (let i = 1; i < tk.length; i++) { const ctx = tk.slice(Math.max(0, i - n + 1), i).join(' '); (T[ctx] ||= {})[tk[i]] = ((T[ctx] ||= {})[tk[i]] || 0) + 1; } }
    return { n, T };
  }
  // 按上下文抽下一个记号；上下文没见过时退回更短的上下文（简单的回退）
  function ngramSample(model, seed, temp = 1, maxLen = 60) {
    const R = rng(seed), out = ['^'];
    while (out.length < maxLen) {
      let dist = null;
      for (let k = model.n - 1; k >= 1 && !dist; k--) dist = model.T[out.slice(-k).join(' ')] || null;
      if (!dist) break;
      const ent = Object.entries(dist), w = ent.map(([, c]) => c ** (1 / Math.max(0.05, temp))), tot = w.reduce((a, b) => a + b, 0);
      let u = R() * tot, pick = ent[ent.length - 1][0];
      for (let i = 0; i < ent.length; i++) { u -= w[i]; if (u <= 0) { pick = ent[i][0]; break; } }
      if (pick === '$') break;
      out.push(pick);
    }
    return out.slice(1).join('');
  }
  // 分子的“身份证”：分子式 + 半径 3 的指纹（自己的哈希；用来近似判断两个字符串是不是同一个分子）
  const molKey = (mol) => `${mol.formula}|${[...ecfp(mol, 3, 1 << 30).ids].sort((a, b) => a - b).join('.')}`;
  function ngramEval(n, count, temp, seed) {
    const model = ngramTrain(CORPUS, n), train = new Set(CORPUS.map((s) => molKey(parseSmiles(s))));
    const samples = range(count).map((i) => ngramSample(model, seed * 1009 + i, temp));
    const parsed = samples.map((s) => ({ s, m: parseSmiles(s) }));
    const valid = parsed.filter((p) => p.m.ok), keys = valid.map((p) => molKey(p.m)), uniq = new Set(keys), novel = [...uniq].filter((k) => !train.has(k));
    return { samples: parsed, validity: valid.length / count, uniqueness: valid.length ? uniq.size / valid.length : 0, novelty: uniq.size ? novel.length / uniq.size : 0, nValid: valid.length, nUnique: uniq.size, nNovel: novel.length, novelKeys: new Set(novel) };
  }
  const molKeyOf = (s) => { const m = parseSmiles(s); return m.ok ? molKey(m) : ''; };

  // ── 多项式回归、外推和适用域（Goodhart 定律的小例子）───────────────
  const proxyTruth = (x) => Math.exp(-(((x - 0.45) / 0.25) ** 2)) + 0.25 * x;
  function polyFit(xs, ys, deg, lam = 1e-6) { return ridgeFit(xs.map((x) => [x]), ys, lam, (x) => range(deg + 1).map((p) => (2 * x[0] - 1) ** p)); }

  // ── 多目标：Pareto 前沿和超体积（两个目标都求最大）─────────────
  const dominates = (a, b) => a[0] >= b[0] && a[1] >= b[1] && (a[0] > b[0] || a[1] > b[1]);
  const paretoIdx = (P) => P.map((p, i) => i).filter((i) => !P.some((q, j) => j !== i && dominates(q, P[i])));
  function hypervolume(P, ref = [0, 0]) {
    const F = paretoIdx(P).map((i) => P[i]).filter((p) => p[0] > ref[0] && p[1] > ref[1]).sort((a, b) => b[0] - a[0]);
    let hv = 0, yPrev = ref[1];
    for (const p of F) { if (p[1] > yPrev) { hv += (p[0] - ref[0]) * (p[1] - yPrev); yPrev = p[1]; } }
    return hv;
  }
  // 加权和：max w·f₀ + (1−w)·f₁，只能挑到前沿凸包上的点
  const weightedPick = (P, w) => { let k = 0; P.forEach((p, i) => { if (w * p[0] + (1 - w) * p[1] > w * P[k][0] + (1 - w) * P[k][1]) k = i; }); return k; };
  // 玩具反应：x = [温度, 催化剂用量]；产率在高温高用量时高，“绿色程度”（1 − 成本和能耗）相反，中间有一段凹进去的前沿
  const objectives = (x) => {
    const yld = 1 - Math.exp(-3 * (0.25 + x[0] * 0.9) * (0.3 + x[1])) - 0.15 * (x[0] - 0.8) ** 2;
    const green = 1 - 0.55 * x[0] ** 2 - 0.45 * x[1] - 0.18 * Math.sin(3 * Math.PI * x[0] * x[1]) ** 2;
    return [yld, green];
  };

  // ── 评估：按骨架分组的数据和三种划分 ─────────────────────────────
  // K 个骨架（簇中心），每个骨架下面若干分子（中心附近的小扰动）。性质 = 全局的光滑函数 + 骨架自己的偏移 + 噪声。
  function scaffoldData({ K = 24, per = 10, spread = 0.035, offset = 0.35, noise = 0.05, seed = 1 } = {}) {
    const R = rng(seed), out = [];
    for (let c = 0; c < K; c++) {
      const cx = [R(), R()], off = offset * R.normal();
      for (let j = 0; j < per; j++) { const x = [cx[0] + spread * R.normal(), cx[1] + spread * R.normal()]; out.push({ x, y: truth2(x) + off + noise * R.normal(), g: c, t: c * per + j }); }
    }
    return out;
  }
  // 划分：random（随机 20 %）、scaffold（整组骨架留作测试）、time（按“合成顺序”最后 20 %，这里骨架编号就是顺序）
  function split(D, how, seed = 1, frac = 0.2) {
    const R = rng(seed * 13 + 1);
    if (how === 'random') { const idx = R.shuffle(range(D.length)), nt = Math.round(frac * D.length); return { test: idx.slice(0, nt), train: idx.slice(nt) }; }
    if (how === 'scaffold') { const groups = R.shuffle([...new Set(D.map((d) => d.g))]), nt = Math.round(frac * groups.length), tg = new Set(groups.slice(0, nt)); return { test: range(D.length).filter((i) => tg.has(D[i].g)), train: range(D.length).filter((i) => !tg.has(D[i].g)) }; }
    const order = range(D.length).sort((a, b) => D[a].t - D[b].t), nt = Math.round(frac * D.length); return { train: order.slice(0, D.length - nt), test: order.slice(D.length - nt) };
  }
  function splitScore(D, how, model = 'knn', seed = 1) {
    const S = split(D, how, seed), X = S.train.map((i) => D[i].x), y = S.train.map((i) => D[i].y);
    const m = model === 'knn' ? knnFit(X, y, 3) : krrFit(X, y);
    const p = S.test.map((i) => m.predict(D[i].x)), t = S.test.map((i) => D[i].y);
    // 测试分子到最近训练分子的距离（“离训练集有多远”）
    const near = S.test.map((i) => Math.sqrt(Math.min(...X.map((x) => sq(x, D[i].x)))));
    return { mae: mae(p, t), r2: r2(p, t), near: mean(near), S, pred: p };
  }

  // ── 泄漏：先在全部数据上挑特征，再做交叉验证 ─────────────────────
  // 数据完全是噪声：n 个样本、p 个随机特征、随机标签。任何“学到的”东西都是假的。
  function leakage({ n = 40, p = 500, k = 10, folds = 5, seed = 1, lam = 1 } = {}) {
    const R = rng(seed), X = range(n).map(() => range(p).map(() => R.normal())), y = range(n).map(() => R.normal());
    const top = (rows) => { const ym = mean(rows.map((i) => y[i])); const sc = range(p).map((j) => { const xm = mean(rows.map((i) => X[i][j])); let sxy = 0, sxx = 0, syy = 0; for (const i of rows) { const a = X[i][j] - xm, b = y[i] - ym; sxy += a * b; sxx += a * a; syy += b * b; } return [Math.abs(sxy) / Math.sqrt(sxx * syy + 1e-300), j]; }); return sc.sort((a, b) => b[0] - a[0]).slice(0, k).map(([, j]) => j); };
    const order = R.shuffle(range(n)), fold = (f) => order.filter((_, i) => i % folds === f);
    const cv = (pick) => { const pr = new Array(n); for (let f = 0; f < folds; f++) { const te = fold(f), tr = range(n).filter((i) => !te.includes(i)), feats = pick(tr), m = ridgeFit(tr.map((i) => feats.map((j) => X[i][j])), tr.map((i) => y[i]), lam); for (const i of te) pr[i] = m.predict(feats.map((j) => X[i][j])); } return r2(pr, y); };
    const all = top(range(n));
    return { wrong: cv(() => all), right: cv((tr) => top(tr)) };
  }

  // ── 不确定度的校准 ───────────────────────────────────────────────
  // 数据从一个已知的 GP 里抽（长度 0.12、噪声标准差 0.1），再用某组（可能是错的）超参数去拟合，看预测区间盖住真值的比例
  function calibration({ l = 0.12, noise = 0.1, n = 25, seed = 1, tests = 200, auto = false } = {}) {
    const R = rng(seed), xs = range(n + tests).map(() => R()), f = gpSample(xs, { type: 'rbf', l: 0.12, s2: 1 }, 1, seed + 99)[0], ys = f.map((v) => v + 0.1 * R.normal());
    const X = xs.slice(0, n).map((x) => [x]), Y = ys.slice(0, n);
    const g = auto ? gpAuto(X, Y) : (() => { const fit = gpFit(X, Y, { type: 'rbf', l, s2: 1 }, noise * noise); return { predict: fit.predict, l, noise: noise * noise }; })();
    const z = range(tests).map((t) => { const i = n + t, [m, v] = g.predict([xs[i]]); const s = Math.sqrt(v + (auto ? 0 : noise * noise) + (auto ? g.noise * g.s * g.s : 0)); return (ys[i] - m) / s; });
    const levels = lin(0.05, 0.95, 19);
    const cover = levels.map((p) => { const zc = -Math.SQRT2 * inverfc(1 + p) ; return z.filter((v) => Math.abs(v) <= Math.abs(zc)).length / z.length; });
    const nll = mean(z.map((v, t) => 0.5 * v * v)) ;
    return { z, levels, cover, nll, g, data: { xs, ys, f, n } };
  }
  // erfc 的反函数（牛顿法）：返回 x 使 erfc(x) = y
  function inverfc(y) { let x = 0; for (let i = 0; i < 60; i++) { const e = erfc(x) - y, d = (-2 / Math.sqrt(Math.PI)) * Math.exp(-x * x); x -= e / d; } return x; }
  // 区间 ±z 的覆盖概率
  const zFor = (p) => -Math.SQRT2 * inverfc(1 + p);

  window.MOLASTRIA_CHEMML_MODELS = {
    rng, range, lin, mean, std, median, rmse, mae, r2, sq, erfc, Phi, phi, inverfc, zFor,
    cholesky, cholSolve, symEig, solve,
    ELEM, tokens, parseSmiles, layout2d, ecfp, tanimoto, shell, hash, wl, mpnnReadout, permute,
    GEOMS, BOHR, coulombMatrix, cmEigen, rotateAtoms,
    kfun, gpFit, gpAuto, gpSample, mvnLogpdf, L_GRID, N_GRID,
    truth2, toyData, ridgeFit, knnFit, krrFit, learningCurve, loglogSlope,
    mlpInit, mlpPredict, mlpLossGrad, mlpStep, truth1, data1,
    yield1, yield2, EI, PI: PI_, UCB, acquire, boStep1, lhs, boRun, maxOn,
    step1, activeRun,
    CORPUS, ngramTrain, ngramSample, ngramEval, molKey, molKeyOf,
    proxyTruth, polyFit,
    dominates, paretoIdx, hypervolume, weightedPick, objectives,
    scaffoldData, split, splitScore, leakage, calibration,
  };
})();
