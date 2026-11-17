'use strict';
// 群论（/group-theory/）演示背后的数学：纯函数，没有 DOM。tools/group-test.mjs 对照解析结果和教科书的表测这里的每一个函数。
// 页面里 gt-demos.js 经 window.MOLASTRIA_GROUP_MODELS 拿到它们。
// 内容：有限群（置换生成、乘法表、共轭类、子群）· 三维对称操作 · 分子库（理想几何，标准取向）· 从坐标找对称元素并按点群流程图判定 ·
// 特征标表（每个类带一个代表操作的矩阵，测试里用它们重建整个群）· 约化公式和直积 · 振动的 Γ_vib · 简单价力场的简正模和它们的不可约表示 ·
// 环状 π 体系的 Hückel 轨道 · 角重叠模型（d 轨道分裂）· 十七种壁纸群 · 晶体学限制 · SU(2) → SO(3) · Clebsch–Gordan 系数 ·
// 二维近自由电子能带 · Landau 自由能。全部自己写，没有复制任何程序的代码。
(() => {
  const TAU = 2 * Math.PI;

  // ── 小工具 ────────────────────────────────────────────────────────
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const n = norm(a); return [a[0] / n, a[1] / n, a[2] / n]; };
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const mv = (M, v) => [dot(M[0], v), dot(M[1], v), dot(M[2], v)];
  const mm = (A, B) => A.map((r) => [0, 1, 2].map((j) => r[0] * B[0][j] + r[1] * B[1][j] + r[2] * B[2][j]));
  const tr = (M) => M[0][0] + M[1][1] + M[2][2];
  const det = (M) => dot(M[0], cross(M[1], M[2]));
  const transpose = (M) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => M[j][i]));
  const I3 = () => [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
  const sameM = (A, B, tol = 1e-6) => A.every((r, i) => r.every((v, j) => Math.abs(v - B[i][j]) < tol));
  // 绕单位轴 u 转 θ（Rodrigues）
  function rot(u, th) {
    const [x, y, z] = unit(u), c = Math.cos(th), s = Math.sin(th), C = 1 - c;
    return [[c + x * x * C, x * y * C - z * s, x * z * C + y * s], [y * x * C + z * s, c + y * y * C, y * z * C - x * s], [z * x * C - y * s, z * y * C + x * s, c + z * z * C]];
  }
  const refl = (n) => { const u = unit(n); return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) - 2 * u[i] * u[j])); };
  const inversion = () => [[-1, 0, 0], [0, -1, 0], [0, 0, -1]];
  const improper = (u, th) => mm(refl(u), rot(u, th));
  // 操作的写法：{ t: 'E' } | { t: 'C', n, k, ax } | { t: 's', nrm } | { t: 'i' } | { t: 'S', n, k, ax }
  function opMatrix(o) {
    if (o.t === 'E') return I3();
    if (o.t === 'C') return rot(o.ax, (TAU * (o.k || 1)) / o.n);
    if (o.t === 's') return refl(o.nrm);
    if (o.t === 'i') return inversion();
    if (o.t === 'S') return improper(o.ax, (TAU * (o.k || 1)) / o.n);
    throw new Error(`unknown op ${o.t}`);
  }

  // 对称矩阵的本征值（Jacobi 旋转）：{ values（从小到大）, vectors（vectors[k] 是第 k 个本征向量）}
  function symEig(A0) {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A.map((_, i) => A.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] * A[p][q];
      if (off < 1e-26) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = A.map((_, i) => i).sort((i, j) => A[i][i] - A[j][j]);
    return { values: idx.map((i) => A[i][i]), vectors: idx.map((i) => V.map((r) => r[i])) };
  }

  // ── 第一章：有限群（用置换表示）────────────────────────────────────
  // 置换 p 是数组，p[i] 是 i 去的地方；乘积 a·b = 先做 b 再做 a（和函数复合一样）。
  const pmul = (a, b) => b.map((x) => a[x]);
  const pkey = (p) => p.join(',');
  const cyc = (n, ...cycles) => { const p = Array.from({ length: n }, (_, i) => i); for (const c of cycles) c.forEach((x, i) => { p[x] = c[(i + 1) % c.length]; }); return p; };
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const FINITE = {
    C2: { gens: [['r', cyc(2, [0, 1])]], zh: '循环群 C₂', en: 'Cyclic group C₂' },
    C3: { gens: [['r', cyc(3, [0, 1, 2])]], zh: '循环群 C₃', en: 'Cyclic group C₃' },
    C4: { gens: [['r', cyc(4, [0, 1, 2, 3])]], zh: '循环群 C₄', en: 'Cyclic group C₄' },
    C6: { gens: [['r', cyc(6, [0, 1, 2, 3, 4, 5])]], zh: '循环群 C₆', en: 'Cyclic group C₆' },
    V4: { gens: [['a', cyc(4, [0, 1], [2, 3])], ['b', cyc(4, [0, 2], [1, 3])]], zh: 'Klein 四元群 V₄ = C₂ × C₂', en: 'Klein four-group V₄ = C₂ × C₂' },
    D3: { gens: [['r', cyc(3, [0, 1, 2])], ['s', cyc(3, [1, 2])]], zh: '二面体群 D₃（≅ S₃，正三角形）', en: 'Dihedral group D₃ (≅ S₃, the triangle)' },
    D4: { gens: [['r', cyc(4, [0, 1, 2, 3])], ['s', cyc(4, [1, 3])]], zh: '二面体群 D₄（正方形）', en: 'Dihedral group D₄ (the square)' },
    D5: { gens: [['r', cyc(5, [0, 1, 2, 3, 4])], ['s', cyc(5, [1, 4], [2, 3])]], zh: '二面体群 D₅（正五边形）', en: 'Dihedral group D₅ (the pentagon)' },
    D6: { gens: [['r', cyc(6, [0, 1, 2, 3, 4, 5])], ['s', cyc(6, [1, 5], [2, 4])]], zh: '二面体群 D₆（正六边形）', en: 'Dihedral group D₆ (the hexagon)' },
    Q8: { gens: [['i', cyc(8, [0, 1, 4, 5], [2, 7, 6, 3])], ['j', cyc(8, [0, 2, 4, 6], [1, 3, 5, 7])]], zh: '四元数群 Q₈', en: 'Quaternion group Q₈' },
    A4: { gens: [['a', cyc(4, [0, 1, 2])], ['b', cyc(4, [0, 1], [2, 3])]], zh: '交错群 A₄（正四面体的转动，≅ T）', en: 'Alternating group A₄ (rotations of the tetrahedron, ≅ T)' },
    S4: { gens: [['a', cyc(4, [0, 1, 2, 3])], ['b', cyc(4, [0, 1])]], zh: '对称群 S₄（立方体的转动，≅ O ≅ T_d）', en: 'Symmetric group S₄ (rotations of the cube, ≅ O ≅ T_d)' },
  };
  const SUPS = { 2: '²', 3: '³', 4: '⁴', 5: '⁵', 6: '⁶', 7: '⁷' };
  // 把字（如 'rrs'）写成 r²s
  const wordName = (w) => (w === '' ? 'e' : w.replace(/(.)\1*/g, (m) => m[0] + (m.length > 1 ? SUPS[m.length] || `^${m.length}` : '')));
  // 由生成元得到整个群：元素按最短字排列（BFS），每个元素带名字
  function finiteGroup(id) {
    const G = FINITE[id], n = G.gens[0][1].length, e = range(n);
    const els = [{ p: e, w: '' }], seen = new Map([[pkey(e), 0]]);
    for (let q = 0; q < els.length; q++) for (const [g, gp] of G.gens) {
      const p = pmul(els[q].p, gp), k = pkey(p);
      if (!seen.has(k)) { seen.set(k, els.length); els.push({ p, w: els[q].w + g }); }
    }
    const N = els.length, idx = (p) => seen.get(pkey(p));
    const table = els.map((a) => els.map((b) => idx(pmul(a.p, b.p))));
    const inv = range(N).map((i) => table[i].indexOf(0));
    const order = range(N).map((i) => { let k = 1, x = i; while (x !== 0) { x = table[x][i]; k++; } return k; });
    const classOf = new Array(N).fill(-1), classes = [];
    for (let i = 0; i < N; i++) {
      if (classOf[i] >= 0) continue;
      const c = [...new Set(range(N).map((g) => table[table[g][i]][inv[g]]))].sort((a, b) => a - b);
      for (const x of c) classOf[x] = classes.length;
      classes.push(c);
    }
    // 子群：由一个或两个元素生成的全部子群（这里的群都不超过 24 阶，每个子群都能由两个元素生成）
    const gen = (list) => { const S = new Set([0, ...list]); let grew = true; while (grew) { grew = false; for (const a of [...S]) for (const b of [...S]) { const c = table[a][b]; if (!S.has(c)) { S.add(c); grew = true; } } } return [...S].sort((a, b) => a - b); };
    const subs = new Map();
    for (let a = 0; a < N; a++) for (let b = a; b < N; b++) { const s = gen([a, b]); subs.set(s.join(','), s); }
    const subgroups = [...subs.values()].sort((a, b) => a.length - b.length || a.join().localeCompare(b.join()));
    const normal = (S) => { const set = new Set(S); return S.every((h) => range(N).every((g) => set.has(table[table[g][h]][inv[g]]))); };
    const center = range(N).filter((z) => range(N).every((g) => table[z][g] === table[g][z]));
    const abelian = center.length === N;
    return { id, zh: G.zh, en: G.en, n: N, names: els.map((x) => wordName(x.w)), perms: els.map((x) => x.p), table, inv, order, classes, classOf, subgroups, normal, center, abelian };
  }
  // 群公理逐条核对（给演示的读数和测试用）
  function checkAxioms(g) {
    const { n, table } = g, R = range(n);
    const closed = table.every((r) => r.every((x) => x >= 0 && x < n));
    const assoc = R.every((a) => R.every((b) => R.every((c) => table[table[a][b]][c] === table[a][table[b][c]])));
    const identity = R.every((a) => table[0][a] === a && table[a][0] === a);
    const inverses = R.every((a) => R.some((b) => table[a][b] === 0 && table[b][a] === 0));
    const latin = table.every((r) => new Set(r).size === n) && R.every((j) => new Set(R.map((i) => table[i][j])).size === n);
    return { closed, assoc, identity, inverses, latin };
  }
  // 左陪集 gH
  const cosets = (g, H) => { const out = [], used = new Set(); for (let x = 0; x < g.n; x++) { if (used.has(x)) continue; const c = H.map((h) => g.table[x][h]).sort((a, b) => a - b); c.forEach((y) => used.add(y)); out.push(c); } return out; };

  // ── 第二章：分子库（理想几何，单位 Å，按特征标表的标准取向放好）──────────
  const MASS = { H: 1.008, B: 10.81, C: 12.011, N: 14.007, O: 15.999, F: 18.998, P: 30.974, S: 32.06, Cl: 35.45, Br: 79.904, Xe: 131.29, Fe: 55.845, Co: 58.933, Pt: 195.08 };
  const RCOV = { H: 0.32, B: 0.84, C: 0.76, N: 0.71, O: 0.66, F: 0.57, P: 1.07, S: 1.05, Cl: 1.02, Br: 1.2, Xe: 1.4, Fe: 1.32, Co: 1.26, Pt: 1.36 };
  const ring = (el, r, z, n, phase = 0) => range(n).map((k) => [el, r * Math.cos(phase + (TAU * k) / n), r * Math.sin(phase + (TAU * k) / n), z]);
  const deg = (d) => (d * Math.PI) / 180;
  // 把一组原子用若干个 3×3 操作生成轨道（去掉重复的），用来造出对称性完全精确的示意分子
  function orbit(atoms, ops) {
    const out = [];
    for (const [el, x, y, z] of atoms) for (const R of ops) { const p = mv(R, [x, y, z]); if (!out.some((a) => a[0] === el && Math.hypot(a[1] - p[0], a[2] - p[1], a[3] - p[2]) < 1e-6)) out.push([el, ...p]); }
    return out;
  }
  const PHI = (1 + Math.sqrt(5)) / 2;
  const icosa = (el, r) => { const v = []; for (const s1 of [1, -1]) for (const s2 of [1, -1]) { v.push([0, s1, s2 * PHI], [s1, s2 * PHI, 0], [s2 * PHI, 0, s1]); } const k = r / Math.hypot(1, PHI); return v.map((p) => [el, p[0] * k, p[1] * k, p[2] * k]); };
  const C3z = [I3(), rot([0, 0, 1], TAU / 3), rot([0, 0, 1], (2 * TAU) / 3)];
  const D3ops = [...C3z, ...C3z.map((R) => mm(R, rot([1, 0, 0], Math.PI)))];
  const S4z = [0, 1, 2, 3].map((k) => (k % 2 ? improper([0, 0, 1], (k * TAU) / 4) : rot([0, 0, 1], (k * TAU) / 4)));
  const tet = 0.629; // CH₄ 的 H 在 (±a, ±a, ±a)，C–H = 1.09 Å
  const MOLS = [
    { id: 'chbrcl', zh: '反式 1-溴-2-氯乙烯', en: 'trans-1-bromo-2-chloroethylene', f: 'CHBr=CHCl', pg: 'Cs', atoms: [['C', 0.67, 0, 0], ['C', -0.67, 0, 0], ['H', 1.22, 0.94, 0], ['H', -1.22, -0.94, 0], ['Br', 1.62, -1.6, 0], ['Cl', -1.55, 1.5, 0]] },
    { id: 'ch2cl2', zh: '二氯甲烷', en: 'dichloromethane', f: 'CH₂Cl₂', pg: 'C2v', tbl: 'C2v', atoms: [['C', 0, 0, 0], ['Cl', 1.47, 0, -0.84], ['Cl', -1.47, 0, -0.84], ['H', 0, 0.89, 0.63], ['H', 0, -0.89, 0.63]] },
    { id: 'h2o', zh: '水', en: 'water', f: 'H₂O', pg: 'C2v', tbl: 'C2v', atoms: [['O', 0, 0, 0], ['H', 0, 0.7572, -0.5865], ['H', 0, -0.7572, -0.5865]] },
    { id: 'nh3', zh: '氨', en: 'ammonia', f: 'NH₃', pg: 'C3v', tbl: 'C3v', atoms: [['N', 0, 0, 0], ...ring('H', 0.9377, -0.3816, 3)] },
    { id: 'brf5', zh: '五氟化溴', en: 'bromine pentafluoride', f: 'BrF₅', pg: 'C4v', tbl: 'C4v', atoms: [['Br', 0, 0, 0], ['F', 0, 0, 1.69], ...ring('F', 1.77, -0.2, 4)] },
    { id: 'ch4', zh: '甲烷', en: 'methane', f: 'CH₄', pg: 'Td', tbl: 'Td', atoms: [['C', 0, 0, 0], ['H', tet, tet, tet], ['H', tet, -tet, -tet], ['H', -tet, tet, -tet], ['H', -tet, -tet, tet]] },
    { id: 'bf3', zh: '三氟化硼', en: 'boron trifluoride', f: 'BF₃', pg: 'D3h', tbl: 'D3h', atoms: [['B', 0, 0, 0], ...ring('F', 1.31, 0, 3)] },
    { id: 'pcl5', zh: '五氯化磷', en: 'phosphorus pentachloride', f: 'PCl₅', pg: 'D3h', tbl: 'D3h', atoms: [['P', 0, 0, 0], ...ring('Cl', 2.02, 0, 3), ['Cl', 0, 0, 2.12], ['Cl', 0, 0, -2.12]] },
    { id: 'ethane-e', zh: '乙烷（重叠式）', en: 'ethane (eclipsed)', f: 'C₂H₆', pg: 'D3h', tbl: 'D3h', atoms: [['C', 0, 0, 0.765], ['C', 0, 0, -0.765], ...ring('H', 1.02, 1.13, 3), ...ring('H', 1.02, -1.13, 3)] },
    { id: 'ethane-s', zh: '乙烷（交叉式）', en: 'ethane (staggered)', f: 'C₂H₆', pg: 'D3d', tbl: 'D3d', atoms: [['C', 0, 0, 0.765], ['C', 0, 0, -0.765], ...ring('H', 1.02, 1.13, 3, deg(90)), ...ring('H', 1.02, -1.13, 3, deg(270))] },
    { id: 'cyclohexane', zh: '环己烷（椅式）', en: 'cyclohexane (chair)', f: 'C₆H₁₂', pg: 'D3d', tbl: 'D3d', atoms: [...range(6).map((k) => ['C', 1.45 * Math.cos(deg(30 + 60 * k)), 1.45 * Math.sin(deg(30 + 60 * k)), k % 2 ? -0.25 : 0.25]), ...range(6).map((k) => ['H', 1.45 * Math.cos(deg(30 + 60 * k)), 1.45 * Math.sin(deg(30 + 60 * k)), k % 2 ? -1.34 : 1.34]), ...range(6).map((k) => ['H', 2.48 * Math.cos(deg(30 + 60 * k)), 2.48 * Math.sin(deg(30 + 60 * k)), k % 2 ? 0.11 : -0.11])] },
    { id: 'allene', zh: '丙二烯', en: 'allene', f: 'C₃H₄', pg: 'D2d', tbl: 'D2d', atoms: [['C', 0, 0, 0], ['C', 0, 0, 1.31], ['C', 0, 0, -1.31], ['H', 0.656, 0.656, 1.87], ['H', -0.656, -0.656, 1.87], ['H', 0.656, -0.656, -1.87], ['H', -0.656, 0.656, -1.87]] },
    { id: 'ethylene', zh: '乙烯', en: 'ethylene', f: 'C₂H₄', pg: 'D2h', tbl: 'D2h', atoms: [['C', 0, 0, 0.667], ['C', 0, 0, -0.667], ['H', 0, 0.923, 1.232], ['H', 0, -0.923, 1.232], ['H', 0, 0.923, -1.232], ['H', 0, -0.923, -1.232]] },
    { id: 'xef4', zh: '四氟化氙', en: 'xenon tetrafluoride', f: 'XeF₄', pg: 'D4h', tbl: 'D4h', atoms: [['Xe', 0, 0, 0], ...ring('F', 1.95, 0, 4)] },
    { id: 'ptcl4', zh: '四氯合铂(II) 离子', en: 'tetrachloroplatinate(II)', f: '[PtCl₄]²⁻', pg: 'D4h', tbl: 'D4h', atoms: [['Pt', 0, 0, 0], ...ring('Cl', 2.31, 0, 4)] },
    { id: 'benzene', zh: '苯', en: 'benzene', f: 'C₆H₆', pg: 'D6h', tbl: 'D6h', atoms: [...ring('C', 1.397, 0, 6), ...ring('H', 2.481, 0, 6)] },
    { id: 'ferrocene-e', zh: '二茂铁（重叠式）', en: 'ferrocene (eclipsed)', f: 'Fe(C₅H₅)₂', pg: 'D5h', atoms: [['Fe', 0, 0, 0], ...ring('C', 1.22, 1.66, 5), ...ring('C', 1.22, -1.66, 5), ...ring('H', 2.29, 1.66, 5), ...ring('H', 2.29, -1.66, 5)] },
    { id: 'ferrocene-s', zh: '二茂铁（交错式）', en: 'ferrocene (staggered)', f: 'Fe(C₅H₅)₂', pg: 'D5d', atoms: [['Fe', 0, 0, 0], ...ring('C', 1.22, 1.66, 5), ...ring('C', 1.22, -1.66, 5, deg(36)), ...ring('H', 2.29, 1.66, 5), ...ring('H', 2.29, -1.66, 5, deg(36))] },
    { id: 'sf6', zh: '六氟化硫', en: 'sulfur hexafluoride', f: 'SF₆', pg: 'Oh', tbl: 'Oh', atoms: [['S', 0, 0, 0], ['F', 1.56, 0, 0], ['F', -1.56, 0, 0], ['F', 0, 1.56, 0], ['F', 0, -1.56, 0], ['F', 0, 0, 1.56], ['F', 0, 0, -1.56]] },
    { id: 'b12h12', zh: '十二氢十二硼酸根', en: 'dodecaborate', f: '[B₁₂H₁₂]²⁻', pg: 'Ih', atoms: [...icosa('B', 1.70), ...icosa('H', 2.89)] },
    { id: 'co2', zh: '二氧化碳', en: 'carbon dioxide', f: 'CO₂', pg: 'D∞h', atoms: [['C', 0, 0, 0], ['O', 0, 0, 1.16], ['O', 0, 0, -1.16]] },
    { id: 'hcn', zh: '氰化氢', en: 'hydrogen cyanide', f: 'HCN', pg: 'C∞v', atoms: [['H', 0, 0, -1.63], ['C', 0, 0, -0.57], ['N', 0, 0, 0.59]] },
    { id: 'h2o2', zh: '过氧化氢', en: 'hydrogen peroxide', f: 'H₂O₂', pg: 'C2', tbl: 'C2', atoms: [['O', 0, 0.725, 0], ['O', 0, -0.725, 0], ['H', 0.84, 0.92, 0.45], ['H', -0.84, -0.92, 0.45]] },
    { id: 'dce', zh: '反式 1,2-二氯乙烯', en: 'trans-1,2-dichloroethylene', f: 'CHCl=CHCl', pg: 'C2h', tbl: 'C2h', atoms: [['C', 0.6, 0.29, 0], ['C', -0.6, -0.29, 0], ['H', 1.47, -0.36, 0], ['H', -1.47, 0.36, 0], ['Cl', 0.75, 2.02, 0], ['Cl', -0.75, -2.02, 0]] },
    { id: 'boh3', zh: '硼酸', en: 'boric acid', f: 'B(OH)₃', pg: 'C3h', atoms: [['B', 0, 0, 0], ...ring('O', 1.37, 0, 3), ...ring('H', 1.93, 0, 3, deg(26))] },
    { id: 'propeller', zh: 'C₃ 螺旋桨（示意）', en: 'C₃ propeller (schematic)', f: 'PX₃', pg: 'C3', atoms: [['P', 0, 0, 0.3], ...orbit([['C', 1.6, 0, 0], ['O', 2.2, 0.6, 0.5], ['N', 2.1, -0.5, -0.6]], C3z)] },
    { id: 'coen3', zh: '三(乙二胺)合钴（骨架示意）', en: 'tris(ethylenediamine)cobalt (skeleton)', f: '[Co(en)₃]³⁺', pg: 'D3', atoms: [['Co', 0, 0, 0], ...orbit([['N', 1.6, 0.55, 1.05], ['C', 2.55, 0.35, 0.45]], D3ops)] },
    { id: 's4', zh: 'S₄ 示意分子', en: 'an S₄ model (schematic)', f: 'C₄X₄', pg: 'S4', atoms: [...orbit([['C', 1.2, 0.4, 0.3], ['Cl', 2.0, 1.5, 0.9]], S4z)] },
    { id: 'meso', zh: '内消旋 1,2-二氯-1,2-二氟乙烷（反式交叉）', en: 'meso-1,2-dichloro-1,2-difluoroethane (anti)', f: 'CHFCl–CHFCl', pg: 'Ci', atoms: (() => { const top = [['C', 0, 0, 0.77], ['H', 1.02 * Math.cos(deg(90)), 1.02 * Math.sin(deg(90)), 1.13], ['F', 1.25 * Math.cos(deg(210)), 1.25 * Math.sin(deg(210)), 1.22], ['Cl', 1.6 * Math.cos(deg(330)), 1.6 * Math.sin(deg(330)), 1.34]]; return [...top, ...top.map(([e, x, y, z]) => [e, -x, -y, -z])]; })() },
    { id: 'chfclbr', zh: '溴氯氟甲烷', en: 'bromochlorofluoromethane', f: 'CHFClBr', pg: 'C1', atoms: [['C', 0, 0, 0], ['H', tet, tet, tet], ['F', 0.79, -0.79, -0.79], ['Cl', -1.02, 1.02, -1.02], ['Br', -1.12, -1.12, 1.12]] },
  ];
  const molecule = (id) => MOLS.find((m) => m.id === id);
  // 质心放到原点（对称的分子，质心在所有对称元素上，所以标准取向不变）
  function centred(m) {
    const M = m.atoms.reduce((s, a) => s + MASS[a[0]], 0), c = [1, 2, 3].map((k) => m.atoms.reduce((s, a) => s + MASS[a[0]] * a[k], 0) / M);
    return m.atoms.map(([el, x, y, z]) => ({ el, r: [x - c[0], y - c[1], z - c[2]], m: MASS[el] }));
  }
  const bonds = (atoms) => { const out = []; for (let i = 0; i < atoms.length; i++) for (let j = i + 1; j < atoms.length; j++) if (norm(sub(atoms[i].r, atoms[j].r)) < 1.18 * (RCOV[atoms[i].el] + RCOV[atoms[j].el])) out.push([i, j]); return out; };
  // 操作 R 把原子集合映回自己吗？返回原子的去向（不对称则 null）
  function mapAtoms(atoms, R, tol = 0.02) {
    const img = [];
    for (const a of atoms) {
      const p = mv(R, a.r);
      const j = atoms.findIndex((b) => b.el === a.el && Math.abs(b.r[0] - p[0]) < tol && Math.abs(b.r[1] - p[1]) < tol && Math.abs(b.r[2] - p[2]) < tol);
      if (j < 0) return null;
      img.push(j);
    }
    return img;
  }

  // ── 从坐标找对称元素，按流程图判定点群 ─────────────────────────────
  const SUB = { 1: '₁', 2: '₂', 3: '₃', 4: '₄', 5: '₅', 6: '₆', 7: '₇', 8: '₈', 9: '₉', 10: '₁₀', 12: '₁₂' };
  const dedup = (vs) => { const out = []; for (const v of vs) { if (!(norm(v) > 1e-6)) continue; const u = unit(v); if (!out.some((w) => Math.abs(dot(w, u)) > 0.99995)) out.push(u); } return out; };
  function symmetryElements(atoms, tol = 0.02) {
    const pts = atoms.map((a) => a.r), N = atoms.length;
    const ok = (R) => !!mapAtoms(atoms, R, tol);
    const far = pts.reduce((b, p) => (norm(p) > norm(b) ? p : b), [0, 0, 0]);
    const linear = N <= 1 || (norm(far) > tol && pts.every((p) => norm(cross(p, unit(far))) < tol));
    const inv = ok(inversion());
    if (linear) return { linear: true, inv, axes: [{ ax: unit(far), n: Infinity }], planes: [], improper: [] };
    // 候选轴：原子方向、同种原子对的中点、同种原子对的叉积、惯量主轴
    const cand = [];
    for (let i = 0; i < N; i++) {
      cand.push(pts[i]);
      for (let j = i + 1; j < N; j++) if (atoms[i].el === atoms[j].el) { cand.push(add(pts[i], pts[j])); cand.push(cross(pts[i], pts[j])); }
    }
    const In = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (const a of atoms) { const [x, y, z] = a.r; In[0][0] += a.m * (y * y + z * z); In[1][1] += a.m * (x * x + z * z); In[2][2] += a.m * (x * x + y * y); In[0][1] -= a.m * x * y; In[0][2] -= a.m * x * z; In[1][2] -= a.m * y * z; }
    In[1][0] = In[0][1]; In[2][0] = In[0][2]; In[2][1] = In[1][2];
    cand.push(...symEig(In).vectors, [0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const axes = [];
    for (const u of dedup(cand)) { let best = 1; for (let n = 2; n <= 12; n++) if (ok(rot(u, TAU / n))) best = n; if (best > 1) axes.push({ ax: u, n: best }); }
    axes.sort((a, b) => b.n - a.n);
    const pc = [];
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) if (atoms[i].el === atoms[j].el) pc.push(sub(pts[i], pts[j]));
    for (const a of axes) { pc.push(a.ax); for (const p of pts) pc.push(cross(a.ax, p)); for (const b of axes) pc.push(cross(a.ax, b.ax)); }
    pc.push([0, 0, 1], [1, 0, 0], [0, 1, 0]);
    const planes = dedup(pc).filter((nrm) => ok(refl(nrm))).map((nrm) => ({ nrm }));
    const imp = [];
    for (const a of axes) { let best = 0; for (let n = 3; n <= 24; n++) if (ok(improper(a.ax, TAU / n))) best = n; if (best) imp.push({ ax: a.ax, n: best }); }
    return { linear: false, inv, axes, planes, improper: imp };
  }
  // 点群的阶
  function groupOrder(pg) {
    if (/∞/.test(pg)) return Infinity;
    const fixed = { C1: 1, Cs: 2, Ci: 2, T: 12, Td: 24, Th: 24, O: 24, Oh: 48, I: 60, Ih: 120 };
    if (fixed[pg]) return fixed[pg];
    const m = pg.match(/^([CDS])(\d+)([hvd]?)$/);
    if (!m) return NaN;
    const n = Number(m[2]);
    if (m[1] === 'S') return n;
    if (m[1] === 'C') return m[3] ? 2 * n : n;
    return m[3] ? 4 * n : 2 * n;
  }
  const pretty = (pg) => pg.replace(/^([CDSTOI])(∞|\d+)?([hvds]?)$/, (_, a, n, s) => a + (n ? (n === '∞' ? '∞' : [...n].map((d) => SUB[d]).join('')) : '') + (s ? { h: 'ₕ', v: 'ᵥ', d: 'd', s: 'ₛ' }[s] : '')).replace(/^Ci$/, 'Cᵢ');
  // 按 Harris 和 Bertolucci 那张流程图的顺序走一遍。返回每一步问了什么、答了什么，用到哪些对称元素（elements 里的下标）。
  function classify(atoms, tol = 0.02) {
    const S = symmetryElements(atoms, tol), steps = [], els = [];
    const addEl = (e) => { els.push(e); return els.length - 1; };
    const step = (node, ans, use = []) => steps.push({ node, ans, use });
    if (S.linear) {
      const ia = addEl({ kind: 'C', n: Infinity, ax: S.axes[0].ax, role: 'principal' });
      const ii = S.inv ? addEl({ kind: 'i' }) : -1;
      const pg = S.inv ? 'D∞h' : 'C∞v';
      step('special', true, [ia, ...(ii >= 0 ? [ii] : [])]);
      return { pg, steps, els, end: 'special', S };
    }
    const high = S.axes.filter((a) => a.n >= 3);
    const principal = S.axes[0];
    // 先把所有找到的元素都列出来，主轴排第一
    const axisIdx = S.axes.map((a, k) => addEl({ kind: 'C', n: a.n, ax: a.ax, role: k === 0 ? 'principal' : 'axis' }));
    const planeIdx = S.planes.map((p) => addEl({ kind: 's', nrm: p.nrm, role: 'plane' }));
    const invIdx = S.inv ? addEl({ kind: 'i' }) : -1;
    const impIdx = S.improper.map((p) => addEl({ kind: 'S', n: p.n, ax: p.ax, role: 'improper' }));
    if (high.length >= 2) {
      const has5 = S.axes.some((a) => a.n === 5), has4 = S.axes.some((a) => a.n === 4);
      const pg = has5 ? (S.inv ? 'Ih' : 'I') : has4 ? (S.inv ? 'Oh' : 'O') : S.inv ? 'Th' : S.planes.length ? 'Td' : 'T';
      step('special', true, axisIdx.filter((_, k) => S.axes[k].n >= 3));
      return { pg, steps, els, end: 'special', S };
    }
    step('special', false);
    if (!principal) {
      step('cn', false);
      if (S.planes.length) { step('sigmaA', true, [planeIdx[0]]); return { pg: 'Cs', steps, els, end: 'Cs', S }; }
      step('sigmaA', false);
      if (S.inv) { step('inv', true, [invIdx]); return { pg: 'Ci', steps, els, end: 'Ci', S }; }
      step('inv', false);
      return { pg: 'C1', steps, els, end: 'C1', S };
    }
    const n = principal.n, z = principal.ax;
    els[axisIdx[0]].role = 'principal';
    step('cn', true, [axisIdx[0]]);
    const isH = (p) => Math.abs(Math.abs(dot(p.nrm, z)) - 1) < 1e-4;
    const isV = (p) => Math.abs(dot(p.nrm, z)) < 1e-4;
    const perp = S.axes.map((a, k) => k).filter((k) => k > 0 && S.axes[k].n >= 2 && Math.abs(dot(S.axes[k].ax, z)) < 1e-4);
    const hIdx = planeIdx.filter((_, k) => isH(S.planes[k])), vIdx = planeIdx.filter((_, k) => isV(S.planes[k]));
    const s2n = S.improper.findIndex((p) => Math.abs(Math.abs(dot(p.ax, z)) - 1) < 1e-4 && p.n === 2 * n);
    let pg, end;
    if (S.planes.length) step('sigmaB', true, [planeIdx[0]]);
    else {
      step('sigmaB', false);
      if (s2n >= 0 && !perp.length) { step('s2n', true, [impIdx[s2n]]); return { pg: `S${2 * n}`, steps, els, end: 'S2n', S, n }; }
      step('s2n', false);
    }
    // 竖直镜面按“是否含 C₂′ 轴”分成 σv 和 σd
    for (const k of vIdx) els[k].role = 'σv';
    for (const k of hIdx) els[k].role = 'σh';
    for (const k of perp) els[axisIdx[k]].role = 'perp';
    if (perp.length) {
      step('perpC2', true, perp.map((k) => axisIdx[k]));
      if (hIdx.length) {
        for (const k of vIdx) { const contains = perp.some((q) => Math.abs(dot(els[k].nrm, S.axes[q].ax)) < 1e-4); els[k].role = contains ? 'σv' : 'σd'; }
        step('sigmaHD', true, hIdx); pg = `D${n}h`; end = 'Dnh';
      } else {
        step('sigmaHD', false);
        for (const k of vIdx) els[k].role = 'σd';
        if (vIdx.length) { step('sigmaVD', true, vIdx); pg = `D${n}d`; end = 'Dnd'; } else { step('sigmaVD', false); pg = `D${n}`; end = 'Dn'; }
      }
    } else {
      step('perpC2', false);
      if (hIdx.length) { step('sigmaHC', true, hIdx); pg = `C${n}h`; end = 'Cnh'; } else {
        step('sigmaHC', false);
        if (vIdx.length) { step('sigmaVC', true, vIdx); pg = `C${n}v`; end = 'Cnv'; } else { step('sigmaVC', false); pg = `C${n}`; end = 'Cn'; }
      }
    }
    return { pg, steps, els, end, S, n };
  }
  // 由找到的对称元素生成整个点群（矩阵去重），测试里拿它的阶去和 groupOrder 比
  function closure(mats, max = 200) {
    const out = [I3()];
    const has = (M) => out.some((X) => sameM(X, M, 1e-5));
    for (const M of mats) if (!has(M)) out.push(M);
    for (let i = 0; i < out.length && out.length <= max; i++) for (let j = 0; j < out.length && out.length <= max; j++) { const P = mm(out[i], out[j]); if (!has(P)) out.push(P); }
    return out;
  }
  const elementMatrices = (S) => [...S.axes.map((a) => rot(a.ax, TAU / a.n)), ...S.planes.map((p) => refl(p.nrm)), ...(S.inv ? [inversion()] : []), ...S.improper.map((p) => improper(p.ax, TAU / p.n))];
  // 对称元素作用到一半（t = 0…1）时的矩阵：转动转 t 份，反映把垂直分量从 +1 线性变到 −1（中间会压扁），反演同理
  function partial(el, t) {
    if (el.kind === 'C') return rot(el.ax, (t * TAU) / (Number.isFinite(el.n) ? el.n : 8));
    if (el.kind === 's') { const u = el.nrm, f = 1 - 2 * t; return [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + (f - 1) * u[i] * u[j])); }
    if (el.kind === 'i') { const f = 1 - 2 * t; return [[f, 0, 0], [0, f, 0], [0, 0, f]]; }
    if (el.kind === 'S') { const u = el.ax, f = 1 - 2 * t, R = rot(u, (t * TAU) / el.n); const P = [0, 1, 2].map((i) => [0, 1, 2].map((j) => (i === j ? 1 : 0) + (f - 1) * u[i] * u[j])); return mm(P, R); }
    return I3();
  }

  // ── 第三、四章：特征标表 ────────────────────────────────────────────
  // 每个类：[名字, 个数, 代表操作]。每个不可约表示：[名字, 特征标, 线性函数和转动, 二次函数]；E、T 一对或三个写成一个括号算一项。
  const Z = [0, 0, 1], X = [1, 0, 0], Y = [0, 1, 0];
  const at = (d) => [Math.cos(deg(d)), Math.sin(deg(d)), 0];
  const E = { t: 'E' };
  const TABLES = {
    C1: { classes: [['E', 1, E]], irreps: [['A', [1], ['x', 'y', 'z', 'R_x', 'R_y', 'R_z'], ['x²', 'y²', 'z²', 'xy', 'xz', 'yz']]] },
    Cs: { classes: [['E', 1, E], ['σ_h', 1, { t: 's', nrm: Z }]], irreps: [["A'", [1, 1], ['x', 'y', 'R_z'], ['x²', 'y²', 'z²', 'xy']], ["A''", [1, -1], ['z', 'R_x', 'R_y'], ['yz', 'xz']]] },
    Ci: { classes: [['E', 1, E], ['i', 1, { t: 'i' }]], irreps: [['A_g', [1, 1], ['R_x', 'R_y', 'R_z'], ['x²', 'y²', 'z²', 'xy', 'xz', 'yz']], ['A_u', [1, -1], ['x', 'y', 'z'], []]] },
    C2: { classes: [['E', 1, E], ['C_2', 1, { t: 'C', n: 2, ax: Z }]], irreps: [['A', [1, 1], ['z', 'R_z'], ['x²', 'y²', 'z²', 'xy']], ['B', [1, -1], ['x', 'y', 'R_x', 'R_y'], ['yz', 'xz']]] },
    C2v: { classes: [['E', 1, E], ['C_2', 1, { t: 'C', n: 2, ax: Z }], ['σ_v(xz)', 1, { t: 's', nrm: Y }], ["σ_v'(yz)", 1, { t: 's', nrm: X }]],
      irreps: [['A_1', [1, 1, 1, 1], ['z'], ['x²', 'y²', 'z²']], ['A_2', [1, 1, -1, -1], ['R_z'], ['xy']], ['B_1', [1, -1, 1, -1], ['x', 'R_y'], ['xz']], ['B_2', [1, -1, -1, 1], ['y', 'R_x'], ['yz']]] },
    C3v: { classes: [['E', 1, E], ['2C_3', 2, { t: 'C', n: 3, ax: Z }], ['3σ_v', 3, { t: 's', nrm: Y }]],
      irreps: [['A_1', [1, 1, 1], ['z'], ['x²+y²', 'z²']], ['A_2', [1, 1, -1], ['R_z'], []], ['E', [2, -1, 0], ['(x, y)', '(R_x, R_y)'], ['(x²−y², xy)', '(xz, yz)']]] },
    C4v: { classes: [['E', 1, E], ['2C_4', 2, { t: 'C', n: 4, ax: Z }], ['C_2', 1, { t: 'C', n: 2, ax: Z }], ['2σ_v', 2, { t: 's', nrm: Y }], ['2σ_d', 2, { t: 's', nrm: at(135) }]],
      irreps: [['A_1', [1, 1, 1, 1, 1], ['z'], ['x²+y²', 'z²']], ['A_2', [1, 1, 1, -1, -1], ['R_z'], []], ['B_1', [1, -1, 1, 1, -1], [], ['x²−y²']], ['B_2', [1, -1, 1, -1, 1], [], ['xy']], ['E', [2, 0, -2, 0, 0], ['(x, y)', '(R_x, R_y)'], ['(xz, yz)']]] },
    C2h: { classes: [['E', 1, E], ['C_2', 1, { t: 'C', n: 2, ax: Z }], ['i', 1, { t: 'i' }], ['σ_h', 1, { t: 's', nrm: Z }]],
      irreps: [['A_g', [1, 1, 1, 1], ['R_z'], ['x²', 'y²', 'z²', 'xy']], ['B_g', [1, -1, 1, -1], ['R_x', 'R_y'], ['xz', 'yz']], ['A_u', [1, 1, -1, -1], ['z'], []], ['B_u', [1, -1, -1, 1], ['x', 'y'], []]] },
    D2: { classes: [['E', 1, E], ['C_2(z)', 1, { t: 'C', n: 2, ax: Z }], ['C_2(y)', 1, { t: 'C', n: 2, ax: Y }], ['C_2(x)', 1, { t: 'C', n: 2, ax: X }]],
      irreps: [['A', [1, 1, 1, 1], [], ['x²', 'y²', 'z²']], ['B_1', [1, 1, -1, -1], ['z', 'R_z'], ['xy']], ['B_2', [1, -1, 1, -1], ['y', 'R_y'], ['xz']], ['B_3', [1, -1, -1, 1], ['x', 'R_x'], ['yz']]] },
    D3: { classes: [['E', 1, E], ['2C_3', 2, { t: 'C', n: 3, ax: Z }], ['3C_2', 3, { t: 'C', n: 2, ax: X }]],
      irreps: [['A_1', [1, 1, 1], [], ['x²+y²', 'z²']], ['A_2', [1, 1, -1], ['z', 'R_z'], []], ['E', [2, -1, 0], ['(x, y)', '(R_x, R_y)'], ['(x²−y², xy)', '(xz, yz)']]] },
    D2h: { classes: [['E', 1, E], ['C_2(z)', 1, { t: 'C', n: 2, ax: Z }], ['C_2(y)', 1, { t: 'C', n: 2, ax: Y }], ['C_2(x)', 1, { t: 'C', n: 2, ax: X }], ['i', 1, { t: 'i' }], ['σ(xy)', 1, { t: 's', nrm: Z }], ['σ(xz)', 1, { t: 's', nrm: Y }], ['σ(yz)', 1, { t: 's', nrm: X }]],
      irreps: [['A_g', [1, 1, 1, 1, 1, 1, 1, 1], [], ['x²', 'y²', 'z²']], ['B_1g', [1, 1, -1, -1, 1, 1, -1, -1], ['R_z'], ['xy']], ['B_2g', [1, -1, 1, -1, 1, -1, 1, -1], ['R_y'], ['xz']], ['B_3g', [1, -1, -1, 1, 1, -1, -1, 1], ['R_x'], ['yz']],
        ['A_u', [1, 1, 1, 1, -1, -1, -1, -1], [], []], ['B_1u', [1, 1, -1, -1, -1, -1, 1, 1], ['z'], []], ['B_2u', [1, -1, 1, -1, -1, 1, -1, 1], ['y'], []], ['B_3u', [1, -1, -1, 1, -1, 1, 1, -1], ['x'], []]] },
    D3h: { classes: [['E', 1, E], ['2C_3', 2, { t: 'C', n: 3, ax: Z }], ['3C_2', 3, { t: 'C', n: 2, ax: X }], ['σ_h', 1, { t: 's', nrm: Z }], ['2S_3', 2, { t: 'S', n: 3, ax: Z }], ['3σ_v', 3, { t: 's', nrm: Y }]],
      irreps: [["A_1'", [1, 1, 1, 1, 1, 1], [], ['x²+y²', 'z²']], ["A_2'", [1, 1, -1, 1, 1, -1], ['R_z'], []], ["E'", [2, -1, 0, 2, -1, 0], ['(x, y)'], ['(x²−y², xy)']], ["A_1''", [1, 1, 1, -1, -1, -1], [], []], ["A_2''", [1, 1, -1, -1, -1, 1], ['z'], []], ["E''", [2, -1, 0, -2, 1, 0], ['(R_x, R_y)'], ['(xz, yz)']]] },
    D2d: { classes: [['E', 1, E], ['2S_4', 2, { t: 'S', n: 4, ax: Z }], ['C_2', 1, { t: 'C', n: 2, ax: Z }], ["2C_2'", 2, { t: 'C', n: 2, ax: X }], ['2σ_d', 2, { t: 's', nrm: at(135) }]],
      irreps: [['A_1', [1, 1, 1, 1, 1], [], ['x²+y²', 'z²']], ['A_2', [1, 1, 1, -1, -1], ['R_z'], []], ['B_1', [1, -1, 1, 1, -1], [], ['x²−y²']], ['B_2', [1, -1, 1, -1, 1], ['z'], ['xy']], ['E', [2, 0, -2, 0, 0], ['(x, y)', '(R_x, R_y)'], ['(xz, yz)']]] },
    D3d: { classes: [['E', 1, E], ['2C_3', 2, { t: 'C', n: 3, ax: Z }], ['3C_2', 3, { t: 'C', n: 2, ax: X }], ['i', 1, { t: 'i' }], ['2S_6', 2, { t: 'S', n: 6, ax: Z }], ['3σ_d', 3, { t: 's', nrm: X }]],
      irreps: [['A_1g', [1, 1, 1, 1, 1, 1], [], ['x²+y²', 'z²']], ['A_2g', [1, 1, -1, 1, 1, -1], ['R_z'], []], ['E_g', [2, -1, 0, 2, -1, 0], ['(R_x, R_y)'], ['(x²−y², xy)', '(xz, yz)']], ['A_1u', [1, 1, 1, -1, -1, -1], [], []], ['A_2u', [1, 1, -1, -1, -1, 1], ['z'], []], ['E_u', [2, -1, 0, -2, 1, 0], ['(x, y)'], []]] },
    D4h: { classes: [['E', 1, E], ['2C_4', 2, { t: 'C', n: 4, ax: Z }], ['C_2', 1, { t: 'C', n: 2, ax: Z }], ["2C_2'", 2, { t: 'C', n: 2, ax: X }], ["2C_2''", 2, { t: 'C', n: 2, ax: at(45) }], ['i', 1, { t: 'i' }], ['2S_4', 2, { t: 'S', n: 4, ax: Z }], ['σ_h', 1, { t: 's', nrm: Z }], ['2σ_v', 2, { t: 's', nrm: Y }], ['2σ_d', 2, { t: 's', nrm: at(135) }]],
      irreps: [['A_1g', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [], ['x²+y²', 'z²']], ['A_2g', [1, 1, 1, -1, -1, 1, 1, 1, -1, -1], ['R_z'], []], ['B_1g', [1, -1, 1, 1, -1, 1, -1, 1, 1, -1], [], ['x²−y²']], ['B_2g', [1, -1, 1, -1, 1, 1, -1, 1, -1, 1], [], ['xy']], ['E_g', [2, 0, -2, 0, 0, 2, 0, -2, 0, 0], ['(R_x, R_y)'], ['(xz, yz)']],
        ['A_1u', [1, 1, 1, 1, 1, -1, -1, -1, -1, -1], [], []], ['A_2u', [1, 1, 1, -1, -1, -1, -1, -1, 1, 1], ['z'], []], ['B_1u', [1, -1, 1, 1, -1, -1, 1, -1, -1, 1], [], []], ['B_2u', [1, -1, 1, -1, 1, -1, 1, -1, 1, -1], [], []], ['E_u', [2, 0, -2, 0, 0, -2, 0, 2, 0, 0], ['(x, y)'], []]] },
    D6h: { classes: [['E', 1, E], ['2C_6', 2, { t: 'C', n: 6, ax: Z }], ['2C_3', 2, { t: 'C', n: 3, ax: Z }], ['C_2', 1, { t: 'C', n: 2, ax: Z }], ["3C_2'", 3, { t: 'C', n: 2, ax: X }], ["3C_2''", 3, { t: 'C', n: 2, ax: at(30) }], ['i', 1, { t: 'i' }], ['2S_3', 2, { t: 'S', n: 3, ax: Z }], ['2S_6', 2, { t: 'S', n: 6, ax: Z }], ['σ_h', 1, { t: 's', nrm: Z }], ['3σ_d', 3, { t: 's', nrm: X }], ['3σ_v', 3, { t: 's', nrm: at(30) }]],
      irreps: [['A_1g', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [], ['x²+y²', 'z²']], ['A_2g', [1, 1, 1, 1, -1, -1, 1, 1, 1, 1, -1, -1], ['R_z'], []], ['B_1g', [1, -1, 1, -1, 1, -1, 1, -1, 1, -1, 1, -1], [], []], ['B_2g', [1, -1, 1, -1, -1, 1, 1, -1, 1, -1, -1, 1], [], []],
        ['E_1g', [2, 1, -1, -2, 0, 0, 2, 1, -1, -2, 0, 0], ['(R_x, R_y)'], ['(xz, yz)']], ['E_2g', [2, -1, -1, 2, 0, 0, 2, -1, -1, 2, 0, 0], [], ['(x²−y², xy)']],
        ['A_1u', [1, 1, 1, 1, 1, 1, -1, -1, -1, -1, -1, -1], [], []], ['A_2u', [1, 1, 1, 1, -1, -1, -1, -1, -1, -1, 1, 1], ['z'], []], ['B_1u', [1, -1, 1, -1, 1, -1, -1, 1, -1, 1, -1, 1], [], []], ['B_2u', [1, -1, 1, -1, -1, 1, -1, 1, -1, 1, 1, -1], [], []],
        ['E_1u', [2, 1, -1, -2, 0, 0, -2, -1, 1, 2, 0, 0], ['(x, y)'], []], ['E_2u', [2, -1, -1, 2, 0, 0, -2, 1, 1, -2, 0, 0], [], []]] },
    Td: { classes: [['E', 1, E], ['8C_3', 8, { t: 'C', n: 3, ax: [1, 1, 1] }], ['3C_2', 3, { t: 'C', n: 2, ax: Z }], ['6S_4', 6, { t: 'S', n: 4, ax: Z }], ['6σ_d', 6, { t: 's', nrm: [1, -1, 0] }]],
      irreps: [['A_1', [1, 1, 1, 1, 1], [], ['x²+y²+z²']], ['A_2', [1, 1, 1, -1, -1], [], []], ['E', [2, -1, 2, 0, 0], [], ['(2z²−x²−y², x²−y²)']], ['T_1', [3, 0, -1, 1, -1], ['(R_x, R_y, R_z)'], []], ['T_2', [3, 0, -1, -1, 1], ['(x, y, z)'], ['(xy, xz, yz)']]] },
    Oh: { classes: [['E', 1, E], ['8C_3', 8, { t: 'C', n: 3, ax: [1, 1, 1] }], ['6C_2', 6, { t: 'C', n: 2, ax: [1, 1, 0] }], ['6C_4', 6, { t: 'C', n: 4, ax: Z }], ['3C_2(=C_4²)', 3, { t: 'C', n: 2, ax: Z }], ['i', 1, { t: 'i' }], ['6S_4', 6, { t: 'S', n: 4, ax: Z }], ['8S_6', 8, { t: 'S', n: 6, ax: [1, 1, 1] }], ['3σ_h', 3, { t: 's', nrm: Z }], ['6σ_d', 6, { t: 's', nrm: [1, -1, 0] }]],
      irreps: [['A_1g', [1, 1, 1, 1, 1, 1, 1, 1, 1, 1], [], ['x²+y²+z²']], ['A_2g', [1, 1, -1, -1, 1, 1, -1, 1, 1, -1], [], []], ['E_g', [2, -1, 0, 0, 2, 2, 0, -1, 2, 0], [], ['(2z²−x²−y², x²−y²)']], ['T_1g', [3, 0, -1, 1, -1, 3, 1, 0, -1, -1], ['(R_x, R_y, R_z)'], []], ['T_2g', [3, 0, 1, -1, -1, 3, -1, 0, -1, 1], [], ['(xy, xz, yz)']],
        ['A_1u', [1, 1, 1, 1, 1, -1, -1, -1, -1, -1], [], []], ['A_2u', [1, 1, -1, -1, 1, -1, 1, -1, -1, 1], [], []], ['E_u', [2, -1, 0, 0, 2, -2, 0, 1, -2, 0], [], []], ['T_1u', [3, 0, -1, 1, -1, -3, -1, 0, 1, 1], ['(x, y, z)'], []], ['T_2u', [3, 0, 1, -1, -1, -3, 1, 0, 1, -1], [], []]] },
  };
  const tableOrder = (T) => T.classes.reduce((s, c) => s + c[1], 0);
  const tableIds = Object.keys(TABLES);
  // 约化公式 n_i = (1/h) Σ_c g_c χ(c) χ_i(c)
  const reduce = (T, chars) => { const h = tableOrder(T); return T.irreps.map((ir) => T.classes.reduce((s, c, k) => s + c[1] * chars[k] * ir[1][k], 0) / h); };
  const inner = (T, a, b) => T.classes.reduce((s, c, k) => s + c[1] * a[k] * b[k], 0) / tableOrder(T);
  const product = (T, a, b) => T.classes.map((_, k) => a[k] * b[k]);
  // 按多重度写成 2A₁ + B₂
  const fmtIrrep = (name) => name.replace(/_([^_]+)$/, (_, s) => s.split('').map((ch) => ({ 1: '₁', 2: '₂', 3: '₃', g: 'g', u: 'u' }[ch] || ch)).join(''));
  const decompName = (T, mult) => T.irreps.map((ir, i) => [Math.round(mult[i]), fmtIrrep(ir[0])]).filter(([m]) => m).map(([m, nm]) => (m > 1 ? `${m}${nm}` : nm)).join(' + ') || '0';
  // 向量表示（x, y, z）、轴矢（R）和二次函数（对称平方）的特征标：用代表操作的矩阵算
  const vecChars = (T) => T.classes.map((c) => tr(opMatrix(c[2])));
  const rotChars = (T) => T.classes.map((c) => { const M = opMatrix(c[2]); return det(M) * tr(M); });
  const quadChars = (T) => T.classes.map((c) => { const M = opMatrix(c[2]), t = tr(M); return (t * t + tr(mm(M, M))) / 2; });

  // ── 第六章：振动的对称性 ────────────────────────────────────────────
  // Γ_3N(R) = 不动原子数 × tr R；Γ_vib = Γ_3N − Γ_trans − Γ_rot
  function gammaVib(m) {
    const T = TABLES[m.tbl], atoms = centred(m);
    const unmoved = T.classes.map((c) => { const R = opMatrix(c[2]); return atoms.filter((a) => norm(sub(mv(R, a.r), a.r)) < 1e-3).length; });
    const g3N = T.classes.map((c, k) => unmoved[k] * tr(opMatrix(c[2])));
    const gt = vecChars(T), gr = rotChars(T), gv = g3N.map((x, k) => x - gt[k] - gr[k]);
    const mult = reduce(T, gv).map((x) => Math.round(x * 1e6) / 1e6);
    const ir = T.irreps.map((r) => r[2].some((f) => /^\(?x|^\(?y|^\(?z|\(x|z\)$/.test(f) && !/R/.test(f)));
    const ra = T.irreps.map((r) => r[3].length > 0);
    return { T, unmoved, g3N, gt, gr, gv, mult, ir, ra, nModes: 3 * atoms.length - 6 };
  }
  // 简单价力场：键伸缩 k_r（mdyn/Å，按元素对给）+ 键角弯曲 k_θ（mdyn·Å/rad²）+ 平面三配位中心的面外弯曲 k_w。
  // 平衡构型下 Hessian = Σ k (∇q)(∇q)ᵀ（梯度为零，这一步是精确的）；∇q 用中心差分。
  function internalGrads(atoms) {
    const B = bonds(atoms), terms = [];
    const coord = (f) => (x) => f(x);
    const bondLen = (i, j) => (X) => norm(sub(X[i], X[j]));
    const angle = (i, c, j) => (X) => { const a = sub(X[i], X[c]), b = sub(X[j], X[c]); return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / norm(a) / norm(b)))); };
    const wag = (c, i, j, k) => (X) => { const n = unit(cross(sub(X[j], X[i]), sub(X[k], X[i]))); return dot(sub(X[c], X[i]), n); };
    for (const [i, j] of B) terms.push({ kind: 'r', key: [atoms[i].el, atoms[j].el].sort().join('-'), f: coord(bondLen(i, j)) });
    const nb = atoms.map((_, c) => B.filter(([i, j]) => i === c || j === c).map(([i, j]) => (i === c ? j : i)));
    nb.forEach((list, c) => {
      for (let a = 0; a < list.length; a++) for (let b = a + 1; b < list.length; b++) { const th = angle(list[a], c, list[b])(atoms.map((x) => x.r)); if (th < deg(170)) terms.push({ kind: 'a', f: angle(list[a], c, list[b]) }); }
      if (list.length === 3 && Math.abs(wag(c, ...list)(atoms.map((x) => x.r))) < 1e-3) terms.push({ kind: 'w', f: wag(c, ...list) });
    });
    const X0 = atoms.map((a) => a.r.slice()), h = 1e-5, N = atoms.length;
    for (const t of terms) {
      t.g = new Array(3 * N).fill(0);
      for (let i = 0; i < N; i++) for (let d = 0; d < 3; d++) { const Xp = X0.map((p) => p.slice()), Xm = X0.map((p) => p.slice()); Xp[i][d] += h; Xm[i][d] -= h; t.g[3 * i + d] = (t.f(Xp) - t.f(Xm)) / (2 * h); }
    }
    return terms;
  }
  const FF = {
    h2o: { r: { 'H-O': 8.45 }, a: 0.66 }, nh3: { r: { 'H-N': 6.4 }, a: 0.48 }, ch4: { r: { 'C-H': 5.0 }, a: 0.46 }, bf3: { r: { 'B-F': 8.8 }, a: 0.8, w: 2.5 },
    ch2cl2: { r: { 'C-H': 4.9, 'C-Cl': 2.9 }, a: 0.5 },
  };
  // 实验的基频（cm⁻¹），按不可约表示列出（Shimanouchi 1972 的表；BF₃ 是 ¹¹BF₃）
  const EXP = {
    h2o: [['A_1', 3657], ['A_1', 1595], ['B_2', 3756]], nh3: [['A_1', 3337], ['A_1', 950], ['E', 3444], ['E', 1627]], ch4: [['A_1', 2917], ['E', 1534], ['T_2', 3019], ['T_2', 1306]],
    bf3: [["A_1'", 888], ["A_2''", 691], ["E'", 1454], ["E'", 480]],
  };
  function normalModes(id) {
    const m = molecule(id), atoms = centred(m), N = atoms.length, ff = FF[id], terms = internalGrads(atoms);
    const H = Array.from({ length: 3 * N }, () => new Array(3 * N).fill(0));
    for (const t of terms) { const k = t.kind === 'r' ? ff.r[t.key] : t.kind === 'a' ? ff.a : ff.w || 0; for (let p = 0; p < 3 * N; p++) if (t.g[p]) for (let q = 0; q < 3 * N; q++) H[p][q] += k * t.g[p] * t.g[q]; }
    const sm = atoms.flatMap((a) => [a.m, a.m, a.m]).map(Math.sqrt);
    const Hm = H.map((r, p) => r.map((v, q) => v / sm[p] / sm[q]));
    const { values, vectors } = symEig(Hm);
    const modes = values.map((lam, k) => ({ lam, wn: Math.sign(lam) * 1302.79 * Math.sqrt(Math.abs(lam)), vec: vectors[k], cart: vectors[k].map((v, p) => v / sm[p]) }));
    const vib = modes.filter((x) => x.wn > 20).sort((a, b) => b.wn - a.wn);
    // 按频率把简并的模分在一起，每组算出在每个类上的特征标，对上不可约表示
    const T = TABLES[m.tbl], ops = T.classes.map((c) => { const R = opMatrix(c[2]); return { R, img: mapAtoms(atoms, R, 1e-3) }; });
    const act = (R, img, v) => { const out = new Array(3 * N).fill(0); for (let i = 0; i < N; i++) { const d = mv(R, [v[3 * i], v[3 * i + 1], v[3 * i + 2]]); out[3 * img[i]] = d[0]; out[3 * img[i] + 1] = d[1]; out[3 * img[i] + 2] = d[2]; } return out; };
    const groups = [];
    for (const md of vib) { const g = groups.find((x) => Math.abs(x.wn - md.wn) < 1e-3 * md.wn); if (g) g.modes.push(md); else groups.push({ wn: md.wn, modes: [md] }); }
    for (const g of groups) {
      g.chars = ops.map(({ R, img }) => g.modes.reduce((s, md) => s + md.vec.reduce((t, v, p) => t + v * act(R, img, md.vec)[p], 0), 0));
      g.irrep = (T.irreps.find((ir) => ir[1].every((x, k) => Math.abs(x - g.chars[k]) < 1e-3)) || ['?'])[0];
      for (const md of g.modes) md.irrep = g.irrep;
    }
    return { m, atoms, bonds: bonds(atoms), modes: vib, groups, zero: modes.length - vib.length, T };
  }

  // ── 第五章：环状 π 体系的 Hückel 轨道 ────────────────────────────────
  // CₙHₙ：E_k = α + 2β cos(2πk/n)，k = 0, ±1, …；系数 c_j = cos 或 sin(2πkj/n)（实数组合）
  const huckelLevels = (n) => range(n).map((k) => ({ k: k <= n / 2 ? k : k - n, x: 2 * Math.cos((TAU * k) / n) })).sort((a, b) => b.x - a.x);
  const huckelMatrix = (n) => range(n).map((i) => range(n).map((j) => ((i - j + n) % n === 1 || (j - i + n) % n === 1 ? 1 : 0)));
  const huckelCoeffs = (n, k, sin = false) => { const c = range(n).map((j) => (sin ? Math.sin : Math.cos)((TAU * k * j) / n)); const s = Math.hypot(...c); return c.map((v) => v / s); };
  // 苯（D6h）的 π 轨道的对称标记，按 |k|
  const BENZENE_PI = { 0: 'a_2u', 1: 'e_1g', 2: 'e_2u', 3: 'b_2g' };
  // 填 nπ 个电子（从低到高，同一层两个自旋），总 π 能量（单位 β，α 当零）和是否有未配对电子
  function huckelFill(n, ne) {
    const L = huckelLevels(n); let left = ne, E = 0;
    const occ = L.map(() => 0);
    // 简并的层一起填（Hund 规则）
    const shells = []; for (let i = 0; i < L.length;) { let j = i; while (j < L.length && Math.abs(L[j].x - L[i].x) < 1e-9) j++; shells.push([i, j]); i = j; }
    let unpaired = 0;
    for (const [i, j] of shells) {
      const cap = 2 * (j - i), put = Math.min(cap, left); left -= put;
      const deg2 = j - i; for (let q = 0; q < put; q++) occ[i + (q % deg2)]++;
      E += put * L[i].x;
      if (put > 0 && put < cap) unpaired = Math.min(put, cap - put);
    }
    return { levels: L, occ, E, unpaired };
  }

  // ── 第七章：角重叠模型（AOM，只算 σ）─────────────────────────────────
  // 配体在单位方向 (x, y, z)：d 轨道的角向因子 F_σ（z², x²−y², xy, xz, yz 的顺序）
  const D_NAMES = ['z²', 'x²−y²', 'xy', 'xz', 'yz'];
  const Fsig = ([x, y, z]) => [(3 * z * z - 1) / 2, (Math.sqrt(3) / 2) * (x * x - y * y), Math.sqrt(3) * x * y, Math.sqrt(3) * x * z, Math.sqrt(3) * y * z];
  const s3 = 1 / Math.sqrt(3);
  const GEOMS = {
    oh: { zh: '八面体', en: 'octahedral', L: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]], ax: [4, 5], pg: 'Oh' },
    td: { zh: '四面体', en: 'tetrahedral', L: [[s3, s3, s3], [s3, -s3, -s3], [-s3, s3, -s3], [-s3, -s3, s3]], ax: [], pg: 'Td' },
    sp: { zh: '平面正方形', en: 'square planar', L: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0]], ax: [], pg: 'D4h' },
    tbp: { zh: '三角双锥', en: 'trigonal bipyramidal', L: [[1, 0, 0], at(120), at(240), [0, 0, 1], [0, 0, -1]], ax: [3, 4], pg: 'D3h' },
    spy: { zh: '四方锥', en: 'square pyramidal', L: [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1]], ax: [4], pg: 'C4v' },
    lin: { zh: '直线形', en: 'linear', L: [[0, 0, 1], [0, 0, -1]], ax: [0, 1], pg: 'D∞h' },
  };
  // 返回 5 个能级（单位 e_σ）和对应的轨道组成；axial 是轴向配体的 e_σ 倍数（拉长时小于 1，模拟 Jahn–Teller）
  function aom(geom, axial = 1) {
    const g = GEOMS[geom], H = range(5).map(() => new Array(5).fill(0));
    g.L.forEach((v, li) => { const F = Fsig(v), w = g.ax.includes(li) ? axial : 1; for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) H[i][j] += w * F[i] * F[j]; });
    const { values, vectors } = symEig(H);
    return values.map((e, k) => ({ e, vec: vectors[k], main: D_NAMES[vectors[k].reduce((b, v, i, a) => (Math.abs(v) > Math.abs(a[b]) ? i : b), 0)] }));
  }
  // d 电子按高自旋或低自旋填进能级，P 是成对能（单位 e_σ），返回 CFSE（相对重心）和未配对电子数
  function dFill(levels, nd, P, low) {
    const e = levels.map((l) => l.e), bary = e.reduce((s, x) => s + x, 0) / 5, occ = [0, 0, 0, 0, 0];
    if (low) for (let q = 0; q < nd; q++) occ[Math.floor(q / 2)]++;
    else { for (let q = 0; q < nd; q++) occ[q < 5 ? q : q - 5]++; }
    const pairs = occ.reduce((s, o) => s + (o === 2 ? 1 : 0), 0), unpaired = occ.reduce((s, o) => s + (o === 1 ? 1 : 0), 0);
    const E = occ.reduce((s, o, i) => s + o * (e[i] - bary), 0) + pairs * P;
    return { occ, E, unpaired, pairs };
  }

  // ── 第八章：十七种壁纸群 ──────────────────────────────────────────
  // 每个群：格子类型和点操作（分数坐标里的 2×2 矩阵 + 平移）。来源：国际晶体学表 A 卷的一般位置。
  const A = (a, b, c, d, tx = 0, ty = 0) => ({ m: [[a, b], [c, d]], t: [tx, ty] });
  const P2 = [A(1, 0, 0, 1), A(-1, 0, 0, -1)];
  const P4 = [...P2, A(0, -1, 1, 0), A(0, 1, -1, 0)];
  const P3 = [A(1, 0, 0, 1), A(0, -1, 1, -1), A(-1, 1, -1, 0)];
  const P6 = [...P3, A(-1, 0, 0, -1), A(0, 1, -1, 1), A(1, -1, 1, 0)];
  const WALL = {
    p1: { lat: 'oblique', ops: [A(1, 0, 0, 1)], pt: '1' },
    p2: { lat: 'oblique', ops: P2, pt: '2' },
    pm: { lat: 'rect', ops: [A(1, 0, 0, 1), A(-1, 0, 0, 1)], pt: 'm' },
    pg: { lat: 'rect', ops: [A(1, 0, 0, 1), A(-1, 0, 0, 1, 0, 0.5)], pt: 'm' },
    cm: { lat: 'rect', ops: [A(1, 0, 0, 1), A(-1, 0, 0, 1)], center: true, pt: 'm' },
    p2mm: { lat: 'rect', ops: [...P2, A(-1, 0, 0, 1), A(1, 0, 0, -1)], pt: '2mm' },
    p2mg: { lat: 'rect', ops: [...P2, A(-1, 0, 0, 1, 0.5, 0), A(1, 0, 0, -1, 0.5, 0)], pt: '2mm' },
    p2gg: { lat: 'rect', ops: [...P2, A(-1, 0, 0, 1, 0.5, 0.5), A(1, 0, 0, -1, 0.5, 0.5)], pt: '2mm' },
    c2mm: { lat: 'rect', ops: [...P2, A(-1, 0, 0, 1), A(1, 0, 0, -1)], center: true, pt: '2mm' },
    p4: { lat: 'square', ops: P4, pt: '4' },
    p4mm: { lat: 'square', ops: [...P4, A(-1, 0, 0, 1), A(1, 0, 0, -1), A(0, 1, 1, 0), A(0, -1, -1, 0)], pt: '4mm' },
    p4gm: { lat: 'square', ops: [...P4, A(-1, 0, 0, 1, 0.5, 0.5), A(1, 0, 0, -1, 0.5, 0.5), A(0, 1, 1, 0, 0.5, 0.5), A(0, -1, -1, 0, 0.5, 0.5)], pt: '4mm' },
    p3: { lat: 'hex', ops: P3, pt: '3' },
    p3m1: { lat: 'hex', ops: [...P3, A(0, -1, -1, 0), A(-1, 1, 0, 1), A(1, 0, 1, -1)], pt: '3m' },
    p31m: { lat: 'hex', ops: [...P3, A(0, 1, 1, 0), A(1, -1, 0, -1), A(-1, 0, -1, 1)], pt: '3m' },
    p6: { lat: 'hex', ops: P6, pt: '6' },
    p6mm: { lat: 'hex', ops: [...P6, A(0, -1, -1, 0), A(-1, 1, 0, 1), A(1, 0, 1, -1), A(0, 1, 1, 0), A(1, -1, 0, -1), A(-1, 0, -1, 1)], pt: '6mm' },
  };
  const LATTICE = { oblique: [[1, 0], [0.32, 0.88]], rect: [[1, 0], [0, 0.72]], square: [[1, 0], [0, 1]], hex: [[1, 0], [-0.5, Math.sqrt(3) / 2]] };
  // 分数坐标 → 笛卡儿
  const toCart = (lat, [u, v]) => { const [a, b] = LATTICE[lat]; return [u * a[0] + v * b[0], u * a[1] + v * b[1]]; };
  const applyAff = (op, [u, v]) => [op.m[0][0] * u + op.m[0][1] * v + op.t[0], op.m[1][0] * u + op.m[1][1] * v + op.t[1]];
  // 一个群的全部操作（含 c 心格子的 (½, ½) 平移）
  const wallOps = (id) => { const W = WALL[id]; return W.center ? [...W.ops, ...W.ops.map((o) => ({ m: o.m, t: [o.t[0] + 0.5, o.t[1] + 0.5] }))] : W.ops; };

  // 晶体学限制：转动 2π/n 在格子基底里的矩阵迹 = 2cos(2π/n)，必须是整数
  const restrictionTrace = (n) => 2 * Math.cos(TAU / n);
  const allowedRotation = (n) => Math.abs(restrictionTrace(n) - Math.round(restrictionTrace(n))) < 1e-9;

  // ── 第九章：SU(2) → SO(3) ─────────────────────────────────────────
  // 复数用 [实部, 虚部]，2×2 复矩阵用 [[a, b], [c, d]]
  const cm = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const cconj = (a) => [a[0], -a[1]];
  const m2 = (A2, B2) => [[cadd(cm(A2[0][0], B2[0][0]), cm(A2[0][1], B2[1][0])), cadd(cm(A2[0][0], B2[0][1]), cm(A2[0][1], B2[1][1]))], [cadd(cm(A2[1][0], B2[0][0]), cm(A2[1][1], B2[1][0])), cadd(cm(A2[1][0], B2[0][1]), cm(A2[1][1], B2[1][1]))]];
  const dag = (A2) => [[cconj(A2[0][0]), cconj(A2[1][0])], [cconj(A2[0][1]), cconj(A2[1][1])]];
  const PAULI = [[[[0, 0], [1, 0]], [[1, 0], [0, 0]]], [[[0, 0], [0, -1]], [[0, 1], [0, 0]]], [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]]];
  // U = cos(θ/2) − i sin(θ/2) n·σ
  function su2(n, th) {
    const [x, y, z] = unit(n), c = Math.cos(th / 2), s = Math.sin(th / 2);
    return [[[c, -s * z], [-s * y, -s * x]], [[s * y, -s * x], [c, s * z]]];
  }
  // R_ij = ½ tr(σ_i U σ_j U†)
  const so3FromSu2 = (U) => [0, 1, 2].map((i) => [0, 1, 2].map((j) => { const P = m2(m2(PAULI[i], U), m2(PAULI[j], dag(U))); return (P[0][0][0] + P[1][1][0]) / 2; }));

  // ── 第十章：Clebsch–Gordan 系数（Racah 公式，j 可以是半整数）──────────
  const LF = [0]; for (let i = 1; i < 200; i++) LF[i] = LF[i - 1] + Math.log(i);
  const lfact = (x) => { const k = Math.round(x); if (Math.abs(x - k) > 1e-9 || k < 0) return NaN; return LF[k]; };
  function cg(j1, m1, j2, m2v, J, M) {
    if (Math.abs(m1 + m2v - M) > 1e-9 || J < Math.abs(j1 - j2) - 1e-9 || J > j1 + j2 + 1e-9 || Math.abs(m1) > j1 + 1e-9 || Math.abs(m2v) > j2 + 1e-9 || Math.abs(M) > J + 1e-9) return 0;
    const isInt = (x) => Math.abs(x - Math.round(x)) < 1e-9;
    if (!isInt(j1 + j2 + J) || !isInt(j1 - m1) || !isInt(j2 - m2v) || !isInt(J - M)) return 0;
    const pre = 0.5 * (Math.log(2 * J + 1) + lfact(J + j1 - j2) + lfact(J - j1 + j2) + lfact(j1 + j2 - J) - lfact(j1 + j2 + J + 1) + lfact(J + M) + lfact(J - M) + lfact(j1 - m1) + lfact(j1 + m1) + lfact(j2 - m2v) + lfact(j2 + m2v));
    let s = 0;
    for (let k = 0; k < 200; k++) {
      const d = [k, j1 + j2 - J - k, j1 - m1 - k, j2 + m2v - k, J - j2 + m1 + k, J - j1 - m2v + k];
      if (d[1] < -1e-9 || d[2] < -1e-9 || d[3] < -1e-9) break;
      if (d.some((x) => x < -1e-9)) continue;
      s += (k % 2 ? -1 : 1) * Math.exp(pre - d.reduce((t, x) => t + lfact(x), 0));
    }
    return s;
  }
  const mList = (j) => range(Math.round(2 * j) + 1).map((k) => j - k);
  const jList = (j1, j2) => range(Math.round(2 * Math.min(j1, j2)) + 1).map((k) => j1 + j2 - k);
  const half = (x) => (Math.abs(x - Math.round(x)) < 1e-9 ? String(Math.round(x)).replace('-', '−') : `${x < 0 ? '−' : ''}${Math.round(Math.abs(2 * x))}/2`);

  // ── 第十一章：二维正方格子的近自由电子能带 ─────────────────────────
  // 单位：ħ²/2m · (2π/a)² = 1，k 以 2π/a 为单位。倒格矢 G = (p, q)，|p|, |q| ≤ gmax。V10 是最短倒格矢的傅里叶分量，V11 是次短的。
  function nfeBasis(gmax = 3) { const B = []; for (let p = -gmax; p <= gmax; p++) for (let q = -gmax; q <= gmax; q++) B.push([p, q]); return B; }
  function nfeBands(k, V10, V11, gmax = 3, nb = 8) {
    const B = nfeBasis(gmax), H = B.map((g, i) => B.map((h, j) => {
      if (i === j) return (k[0] + g[0]) ** 2 + (k[1] + g[1]) ** 2;
      const d = [g[0] - h[0], g[1] - h[1]], a = Math.abs(d[0]) + Math.abs(d[1]);
      if (a === 1) return V10;
      if (Math.abs(d[0]) === 1 && Math.abs(d[1]) === 1) return V11;
      return 0;
    }));
    return symEig(H).values.slice(0, nb);
  }
  const emptyLattice = (k, gmax = 3, nb = 8) => nfeBasis(gmax).map((g) => (k[0] + g[0]) ** 2 + (k[1] + g[1]) ** 2).sort((a, b) => a - b).slice(0, nb);
  // Γ(0,0) → X(½,0) → M(½,½) → Γ：返回路径上的点和累计长度
  function bzPath(n = 60) {
    const P = [[0, 0], [0.5, 0], [0.5, 0.5], [0, 0]], out = [];
    let s = 0;
    for (let seg = 0; seg < 3; seg++) {
      const a = P[seg], b = P[seg + 1], len = Math.hypot(b[0] - a[0], b[1] - a[1]), m = Math.max(2, Math.round(n * len / 0.5));
      for (let i = seg ? 1 : 0; i <= m; i++) { const t = i / m; out.push({ k: [a[0] + t * (b[0] - a[0]), a[1] + t * (b[1] - a[1])], s: s + t * len }); }
      s += len;
    }
    return { pts: out, ticks: [0, 0.5, 1, 1 + Math.SQRT1_2], labels: ['Γ', 'X', 'M', 'Γ'] };
  }
  // 能级的简并度（容差内相等的个数）
  const degeneracies = (vals, tol = 1e-6) => { const out = []; for (let i = 0; i < vals.length;) { let j = i; while (j < vals.length && Math.abs(vals[j] - vals[i]) < tol) j++; out.push([vals[i], j - i]); i = j; } return out; };

  // ── 第十二章：Landau 自由能 ────────────────────────────────────────
  // f(m) = a (t − 1) m² + b m⁴ − h m，t = T/T_c
  const landauF = (m, t, h = 0, a = 1, b = 1) => a * (t - 1) * m * m + b * m ** 4 - h * m;
  const landauM0 = (t, a = 1, b = 1) => (t >= 1 ? 0 : Math.sqrt((a * (1 - t)) / (2 * b)));
  // 有外场时求整体最小（先在格点上找，再用牛顿法修正）
  function landauMin(t, h, a = 1, b = 1) {
    let best = 0, fb = Infinity;
    for (let m = -2; m <= 2; m += 0.001) { const f = landauF(m, t, h, a, b); if (f < fb) { fb = f; best = m; } }
    for (let it = 0; it < 30; it++) { const g = 2 * a * (t - 1) * best + 4 * b * best ** 3 - h, H2 = 2 * a * (t - 1) + 12 * b * best * best; if (Math.abs(H2) < 1e-12) break; best -= g / H2; }
    return best;
  }

  window.MOLASTRIA_GROUP_MODELS = {
    TAU, dot, cross, norm, unit, sub, add, scale, mv, mm, tr, det, transpose, I3, sameM, rot, refl, inversion, improper, opMatrix, symEig, range, deg,
    FINITE, finiteGroup, checkAxioms, cosets, pmul,
    MASS, RCOV, MOLS, molecule, centred, bonds, mapAtoms, symmetryElements, groupOrder, pretty, classify, closure, elementMatrices, partial, orbit,
    TABLES, tableIds, tableOrder, reduce, inner, product, fmtIrrep, decompName, vecChars, rotChars, quadChars,
    gammaVib, normalModes, FF, EXP,
    huckelLevels, huckelMatrix, huckelCoeffs, huckelFill, BENZENE_PI,
    D_NAMES, Fsig, GEOMS, aom, dFill,
    WALL, LATTICE, toCart, applyAff, wallOps, restrictionTrace, allowedRotation,
    su2, so3FromSu2, m2, dag, PAULI,
    cg, mList, jList, half,
    nfeBands, emptyLattice, bzPath, degeneracies, nfeBasis,
    landauF, landauM0, landauMin,
  };
})();
