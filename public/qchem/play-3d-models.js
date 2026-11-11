/* 游乐场 16–19（立体馆）的数学：纯函数，没有 DOM，tools/play-test.mjs 测。
   16 价层电子对排布：单位球面上的点电荷模型（推斥 ∝ 1/r，孤对的权重更大），能量、梯度、放松、形状判断；
   17 手性 R/S：四面体中心的 CIP 转向（三重积的符号）；
   18 密勒晶面：(hkl) 在立方晶胞里的那一张面（原点按负指数挪到相邻顶点）和它与晶胞的截面多边形；
   19 Bloch 球：单比特门是绕某根轴的转动，最少门数用广度优先搜索。 */
window.MOLASTRIA_PLAY3D = (() => {
  'use strict';
  // ── 向量与矩阵（3×3，按行存成长度 9 的数组）──────────────────────────
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const len = (a) => Math.hypot(a[0], a[1], a[2]);
  const unit = (a) => { const n = len(a) || 1; return [a[0] / n, a[1] / n, a[2] / n]; };
  const angle = (a, b) => (Math.acos(Math.max(-1, Math.min(1, dot(unit(a), unit(b))))) * 180) / Math.PI;
  const ID = [1, 0, 0, 0, 1, 0, 0, 0, 1];
  const apply = (m, v) => [m[0] * v[0] + m[1] * v[1] + m[2] * v[2], m[3] * v[0] + m[4] * v[1] + m[5] * v[2], m[6] * v[0] + m[7] * v[1] + m[8] * v[2]];
  const applyT = (m, v) => [m[0] * v[0] + m[3] * v[1] + m[6] * v[2], m[1] * v[0] + m[4] * v[1] + m[7] * v[2], m[2] * v[0] + m[5] * v[1] + m[8] * v[2]]; // 转置 = 逆
  function mul(a, b) {
    const r = new Array(9);
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) r[i * 3 + j] = a[i * 3] * b[j] + a[i * 3 + 1] * b[3 + j] + a[i * 3 + 2] * b[6 + j];
    return r;
  }
  // 绕单位轴 n 转 θ（右手定则，Rodrigues）
  function axisAngle(n, th) {
    const [x, y, z] = unit(n), c = Math.cos(th), s = Math.sin(th), C = 1 - c;
    return [c + x * x * C, x * y * C - z * s, x * z * C + y * s, y * x * C + z * s, c + y * y * C, y * z * C - x * s, z * x * C - y * s, z * y * C + x * s, c + z * z * C];
  }
  const rotate = (v, n, th) => apply(axisAngle(n, th), v);
  // 长时间拖动累积的舍入误差：把矩阵重新正交化（Gram–Schmidt）
  function orthonormalize(m) {
    const a = unit([m[0], m[1], m[2]]), b0 = [m[3], m[4], m[5]], b = unit(sub(b0, scale(a, dot(a, b0)))), c = cross(a, b);
    return [...a, ...b, ...c];
  }
  // 随机转动（均匀分布：单位四元数）
  function randomRotation(rnd = Math.random) {
    const u1 = rnd(), u2 = rnd() * 2 * Math.PI, u3 = rnd() * 2 * Math.PI, a = Math.sqrt(1 - u1), b = Math.sqrt(u1);
    const [w, x, y, z] = [a * Math.sin(u2), a * Math.cos(u2), b * Math.sin(u3), b * Math.cos(u3)];
    return [1 - 2 * (y * y + z * z), 2 * (x * y - z * w), 2 * (x * z + y * w), 2 * (x * y + z * w), 1 - 2 * (x * x + z * z), 2 * (y * z - x * w), 2 * (x * z - y * w), 2 * (y * z + x * w), 1 - 2 * (x * x + y * y)];
  }
  // 把 a 转到 b 的最小转动
  function between(a, b) {
    const u = unit(a), v = unit(b), ax = cross(u, v), s = len(ax), c = dot(u, v);
    if (s < 1e-9) return c > 0 ? ID.slice() : axisAngle(Math.abs(u[0]) < 0.9 ? cross(u, [1, 0, 0]) : cross(u, [0, 1, 0]), Math.PI);
    return axisAngle(ax, Math.atan2(s, c));
  }
  // 球面上 a 到 b 的插值（f 从 0 到 1）
  function slerp(a, b, f) {
    const u = unit(a), v = unit(b), w = Math.acos(Math.max(-1, Math.min(1, dot(u, v))));
    if (w < 1e-6) return v;
    const s = Math.sin(w);
    if (s < 1e-6) return unit(add(scale(u, 1 - f), scale(v, f)));
    return add(scale(u, Math.sin((1 - f) * w) / s), scale(v, Math.sin(f * w) / s));
  }

  // ── 16 价层电子对：单位球面上的推斥模型 ───────────────────────────────
  // 每一对电子对之间 E = w / r（r 是球面上两点的弦长）。成键对 B 与成键对 1，成键对与孤对 L 1.2，孤对与孤对 1.5。
  // 权重不是算出来的，只是为了重现 VSEPR 的经验排序（孤对占的地方更大）；tools/play-test.mjs 核对 13 个分子的最低能量构型都是课本上的形状。
  const WEIGHT = { BB: 1, BL: 1.2, LB: 1.2, LL: 1.5 };
  const w = (a, b) => WEIGHT[a + b];
  function energy(P, K) {
    let e = 0;
    for (let i = 0; i < P.length; i++) for (let j = i + 1; j < P.length; j++) e += w(K[i], K[j]) / len(sub(P[i], P[j]));
    return e;
  }
  // 第 i 个点受到的推力（−∂E/∂rᵢ，还没投影到切平面）
  function force(P, K, i) {
    const f = [0, 0, 0];
    for (let j = 0; j < P.length; j++) {
      if (j === i) continue;
      const d = sub(P[i], P[j]), r = Math.max(len(d), 1e-3), s = w(K[i], K[j]) / (r * r * r);
      f[0] += s * d[0]; f[1] += s * d[1]; f[2] += s * d[2];
    }
    return f;
  }
  // 沿切向推一步再拉回球面。only 给出时只动这些点（松手的那一个），其余不动
  // 每步最多走 0.1 弧度，挤在一起的点不会一下子飞出去；离最低点近了，步长随推力一起变小
  function relax(P, K, steps = 600, only = null, lr = 0.25) {
    let Q = P.map((p) => unit(p));
    const idx = only ?? Q.map((_, i) => i);
    for (let s = 0; s < steps; s++) {
      const F = idx.map((i) => force(Q, K, i));
      Q = Q.slice();
      idx.forEach((i, n) => {
        const p = Q[i], f = F[n], t = sub(f, scale(p, dot(f, p))), g = len(t) * lr;
        Q[i] = unit(add(p, scale(t, g > 0.1 ? (0.1 / g) * lr : lr)));
      });
    }
    return Q;
  }
  // 只看成键对（原子）的位置判断形状
  function shapeOf(P, K) {
    const B = P.filter((_, i) => K[i] === 'B'), m = B.length, A = [];
    for (let i = 0; i < m; i++) for (let j = i + 1; j < m; j++) A.push(angle(B[i], B[j]));
    const straight = A.filter((a) => a > 160).length, sum = A.reduce((a, b) => a + b, 0);
    if (m === 2) return A[0] > 170 ? 'linear' : 'bent';
    if (m === 3) return straight === 1 && A.every((a) => a > 75) ? 't-shaped' : sum > 354 && A.every((a) => a > 105) ? 'trigonal-planar' : straight === 0 && sum < 352 ? 'trigonal-pyramidal' : 'irregular';
    if (m === 4) {
      if (straight === 2 && A.filter((a) => a > 75 && a < 105).length === 4) return 'square-planar';
      if (A.every((a) => a > 95 && a < 125)) return 'tetrahedral';
      if (straight === 1 && A.filter((a) => a > 75 && a < 105).length === 4) return 'seesaw';
      return 'irregular';
    }
    if (m === 5) {
      const right = A.filter((a) => a > 75 && a < 105).length;
      if (straight === 1 && right === 6 && A.filter((a) => a > 105 && a < 135).length === 3) return 'trigonal-bipyramidal';
      if (straight === 2 && right === 8) return 'square-pyramidal';
      return 'irregular';
    }
    if (m === 6) return straight === 3 && A.filter((a) => a > 75 && a < 105).length === 12 ? 'octahedral' : 'irregular';
    return 'irregular';
  }
  // 中心原子 → 成键对 B 个、孤对 L 个；emin 是这个模型下的全局最低能量（测试里用多起点放松核对）
  const molecules = [
    { id: 'co2', f: 'CO₂', c: 'C', x: 'O', B: 2, L: 0, shape: 'linear', emin: 0.5 },
    { id: 'bf3', f: 'BF₃', c: 'B', x: 'F', B: 3, L: 0, shape: 'trigonal-planar', emin: 1.7321 },
    { id: 'so2', f: 'SO₂', c: 'S', x: 'O', B: 2, L: 1, shape: 'bent', emin: 1.9616 },
    { id: 'ch4', f: 'CH₄', c: 'C', x: 'H', B: 4, L: 0, shape: 'tetrahedral', emin: 3.6742 },
    { id: 'nh3', f: 'NH₃', c: 'N', x: 'H', B: 3, L: 1, shape: 'trigonal-pyramidal', emin: 4.0392 },
    { id: 'h2o', f: 'H₂O', c: 'O', x: 'H', B: 2, L: 2, shape: 'bent', emin: 4.4658 },
    { id: 'pcl5', f: 'PCl₅', c: 'P', x: 'Cl', B: 5, L: 0, shape: 'trigonal-bipyramidal', emin: 6.4747 },
    { id: 'sf4', f: 'SF₄', c: 'S', x: 'F', B: 4, L: 1, shape: 'seesaw', emin: 6.9839 },
    { id: 'clf3', f: 'ClF₃', c: 'Cl', x: 'F', B: 3, L: 2, shape: 't-shaped', emin: 7.5555 },
    { id: 'xef2', f: 'XeF₂', c: 'Xe', x: 'F', B: 2, L: 3, shape: 'linear', emin: 8.1892 },
    { id: 'sf6', f: 'SF₆', c: 'S', x: 'F', B: 6, L: 0, shape: 'octahedral', emin: 9.9853 },
    { id: 'brf5', f: 'BrF₅', c: 'Br', x: 'F', B: 5, L: 1, shape: 'square-pyramidal', emin: 10.6463 },
    { id: 'xef4', f: 'XeF₄', c: 'Xe', x: 'F', B: 4, L: 2, shape: 'square-planar', emin: 11.3667 },
  ];
  const kinds = (m) => [...'B'.repeat(m.B), ...'L'.repeat(m.L)];
  const shapes = ['linear', 'bent', 'trigonal-planar', 'trigonal-pyramidal', 't-shaped', 'tetrahedral', 'seesaw', 'square-planar', 'trigonal-bipyramidal', 'square-pyramidal', 'octahedral'];
  // 过关：形状对，并且能量离最低不到 1%
  const solved = (m, P, K) => shapeOf(P, K) === m.shape && energy(P, K) <= m.emin * 1.01;
  // 随机起点：均匀撒在球面上，但不能一开始就排好
  function scatter(m, rnd = Math.random) {
    const K = kinds(m);
    for (let tries = 0; ; tries++) {
      const P = K.map(() => { const z = rnd() * 2 - 1, a = rnd() * 2 * Math.PI, r = Math.sqrt(1 - z * z); return [r * Math.cos(a), r * Math.sin(a), z]; });
      const ok = P.every((p, i) => P.every((q, j) => j <= i || len(sub(p, q)) > 0.35));
      if (ok && (!solved(m, P, K) || tries > 50)) return P;
    }
  }

  // ── 17 手性：CIP 规则下的 R/S ────────────────────────────────────────
  // 让优先级第 4 的基团朝后（离开观察者），1 → 2 → 3 顺时针是 R，逆时针是 S。
  // 等价的写法：a、b、c 是从中心指向 1、2、3 号基团的向量，a · (b × c) < 0 是 R，> 0 是 S（和第 4 个基团在哪无关，只要是四面体）。
  const handedness = (center, p1, p2, p3) => (dot(sub(p1, center), cross(sub(p2, center), sub(p3, center))) < 0 ? 'R' : 'S');
  const TETRA = [[1, 1, 1], [1, -1, -1], [-1, 1, -1], [-1, -1, 1]].map(unit);
  // groups 按优先级 1–4 排；el 是直接和手性碳相连的原子（决定颜色），r 是画出来的半径
  const chirals = [
    { id: 'bcf', name: ['溴氯氟甲烷', 'Bromochlorofluoromethane'], groups: [['Br', 'Br', 0.6], ['Cl', 'Cl', 0.54], ['F', 'F', 0.44], ['H', 'H', 0.32]],
      why: ['直接相连的原子按原子序数排：Br（35）> Cl（17）> F（9）> H（1）。', 'Rank the attached atoms by atomic number: Br (35) > Cl (17) > F (9) > H (1).'],
      note: { R: ['这是 (R)-溴氯氟甲烷。它是最简单的手性分子之一：一个碳上连着四个不同的原子。', 'This is (R)-bromochlorofluoromethane, one of the simplest chiral molecules: one carbon carrying four different atoms.'], S: ['这是 (S)-溴氯氟甲烷。它是最简单的手性分子之一：一个碳上连着四个不同的原子。', 'This is (S)-bromochlorofluoromethane, one of the simplest chiral molecules: one carbon carrying four different atoms.'] } },
    { id: 'ala', name: ['丙氨酸', 'Alanine'], groups: [['NH₂', 'N', 0.5], ['COOH', 'C', 0.62], ['CH₃', 'C', 0.55], ['H', 'H', 0.32]],
      why: ['N（7）最大。COOH 和 CH₃ 都从碳开始，再往外看一层：COOH 的碳连着 (O, O, O)（双键算两次），CH₃ 的碳连着 (H, H, H)，所以 COOH 第二。', 'N (7) is highest. COOH and CH₃ both start with carbon, so look one shell further: the COOH carbon carries (O, O, O) (a double bond counts twice), the CH₃ carbon (H, H, H), so COOH is second.'],
      note: { S: ['这是 (S)-丙氨酸，也就是 L-丙氨酸：蛋白质里的丙氨酸都是这一种。', 'This is (S)-alanine, that is L-alanine: the alanine in proteins.'], R: ['这是 (R)-丙氨酸，也就是 D-丙氨酸：蛋白质里没有，但细菌的细胞壁里有。', 'This is (R)-alanine, that is D-alanine: absent from proteins, but found in bacterial cell walls.'] } },
    { id: 'lac', name: ['乳酸', 'Lactic acid'], groups: [['OH', 'O', 0.48], ['COOH', 'C', 0.62], ['CH₃', 'C', 0.55], ['H', 'H', 0.32]],
      why: ['O（8）最大；COOH 的碳连着 (O, O, O)，胜过 CH₃ 的 (H, H, H)。', 'O (8) is highest; the COOH carbon with (O, O, O) beats the CH₃ carbon with (H, H, H).'],
      note: { S: ['这是 (S)-乳酸，也就是 L-乳酸：剧烈运动时肌肉里产生的主要是它。', 'This is (S)-lactic acid, that is L-lactic acid: the one muscles make during hard exercise.'], R: ['这是 (R)-乳酸，也就是 D-乳酸：一些细菌发酵会产生它。', 'This is (R)-lactic acid, that is D-lactic acid: some bacteria make it by fermentation.'] } },
    { id: 'but', name: ['2-丁醇', '2-Butanol'], groups: [['OH', 'O', 0.48], ['C₂H₅', 'C', 0.64], ['CH₃', 'C', 0.55], ['H', 'H', 0.32]],
      why: ['O 最大；乙基和甲基都从碳开始，乙基的碳连着 (C, H, H)，甲基的碳连着 (H, H, H)，所以乙基第二。', 'O is highest; ethyl and methyl both start with carbon, but the ethyl carbon carries (C, H, H) and the methyl carbon (H, H, H), so ethyl is second.'],
      note: { R: ['这是 (R)-2-丁醇。两种对映体的沸点、密度都一样，只有旋光方向相反。', 'This is (R)-2-butanol. The two enantiomers share boiling point and density; they rotate polarised light in opposite directions.'], S: ['这是 (S)-2-丁醇。两种对映体的沸点、密度都一样，只有旋光方向相反。', 'This is (S)-2-butanol. The two enantiomers share boiling point and density; they rotate polarised light in opposite directions.'] } },
    { id: 'gly', name: ['甘油醛', 'Glyceraldehyde'], groups: [['OH', 'O', 0.48], ['CHO', 'C', 0.58], ['CH₂OH', 'C', 0.62], ['H', 'H', 0.32]],
      why: ['O 最大；CHO 的碳连着 (O, O, H)，CH₂OH 的碳连着 (O, H, H)，所以 CHO 第二。', 'O is highest; the CHO carbon carries (O, O, H) and the CH₂OH carbon (O, H, H), so CHO is second.'],
      note: { R: ['这是 (R)-甘油醛，也就是 D-甘油醛：糖的 D/L 命名就是拿它作参照的。', 'This is (R)-glyceraldehyde, that is D-glyceraldehyde: the reference the D/L names of sugars are defined against.'], S: ['这是 (S)-甘油醛，也就是 L-甘油醛。糖的 D/L 命名拿甘油醛作参照。', 'This is (S)-glyceraldehyde, that is L-glyceraldehyde. The D/L names of sugars are defined against glyceraldehyde.'] } },
    { id: 'ibu', name: ['布洛芬', 'Ibuprofen'], groups: [['COOH', 'C', 0.62], ['Ar', 'C', 0.72], ['CH₃', 'C', 0.55], ['H', 'H', 0.32]],
      why: ['三个都从碳开始，看下一层：COOH 是 (O, O, O)，苯环上的碳（Ar，4-异丁基苯基）是 (C, C, C)，CH₃ 是 (H, H, H)。', 'Three start with carbon, so look one shell out: COOH has (O, O, O), the ring carbon (Ar, 4-isobutylphenyl) has (C, C, C), CH₃ has (H, H, H).'],
      note: { S: ['这是 (S)-布洛芬，止痛消炎主要靠它。药片一般是两种对映体各半，体内会把相当一部分 R 型转成 S 型。', 'This is (S)-ibuprofen, which does most of the pain relief. Tablets are usually half and half, and the body converts much of the R form into S.'], R: ['这是 (R)-布洛芬，单独几乎不起作用；药片一般是两种对映体各半，体内会把相当一部分 R 型转成 S 型。', 'This is (R)-ibuprofen, nearly inactive on its own; tablets are usually half and half, and the body converts much of it into the S form.'] } },
  ];
  // 摆出一个构型：want 是 'R' 或 'S'；返回四个基团（按优先级）的位置
  function placeChiral(want, rnd = Math.random) {
    const order = [0, 1, 2, 3];
    for (let i = 3; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [order[i], order[j]] = [order[j], order[i]]; }
    const P = order.map((k) => TETRA[k]);
    if (handedness([0, 0, 0], P[0], P[1], P[2]) !== want) [P[0], P[1]] = [P[1], P[0]];
    return P;
  }

  // ── 18 密勒指数 ──────────────────────────────────────────────────────
  // (hkl) 的那一张面：在 a、b、c 轴上的截距是 1/h、1/k、1/l（以晶胞边长为单位）。指数为负的轴，原点挪到那条轴的另一端，
  // 这样画出来的面总在晶胞里：h(x − Ox) + k(y − Oy) + l(z − Oz) = 1，Ox = 1 当 h < 0。
  function millerPlane(h, k, l) {
    const n = [h, k, l], o = n.map((v) => (v < 0 ? 1 : 0));
    return { n, d: 1 + dot(n, o), origin: o };
  }
  const CORNERS = []; for (let i = 0; i < 8; i++) CORNERS.push([(i >> 2) & 1, (i >> 1) & 1, i & 1]);
  const EDGES = [];
  for (const a of CORNERS) for (let ax = 0; ax < 3; ax++) if (!a[ax]) { const b = a.slice(); b[ax] = 1; EDGES.push([a, b]); }
  // 平面 n·r = d 与单位立方体的截面：顶点按绕中心的角度排好
  function cubeSection(n, d) {
    const pts = [], eps = 1e-9;
    const push = (p) => { if (!pts.some((q) => len(sub(p, q)) < 1e-7)) pts.push(p); };
    for (const [a, b] of EDGES) {
      const fa = dot(n, a) - d, fb = dot(n, b) - d;
      if (Math.abs(fa) < eps) push(a);
      if (Math.abs(fb) < eps) push(b);
      if (fa * fb < 0) { const s = fa / (fa - fb); push(add(a, scale(sub(b, a), s))); }
    }
    if (pts.length < 3) return [];
    const c = scale(pts.reduce(add, [0, 0, 0]), 1 / pts.length), N = unit(n);
    const u = unit(sub(pts[0], c)), v = cross(N, u);
    return pts.map((p) => [p, Math.atan2(dot(sub(p, c), v), dot(sub(p, c), u))]).sort((x, y) => x[1] - y[1]).map((x) => x[0]);
  }
  function polygonArea(poly) {
    let s = [0, 0, 0];
    for (let i = 0; i < poly.length; i++) s = add(s, cross(poly[i], poly[(i + 1) % poly.length]));
    return len(s) / 2;
  }
  // (hkl) 和 (h̄k̄l̄) 是同一族晶面
  const millerSame = (a, b) => (a[0] === b[0] && a[1] === b[1] && a[2] === b[2]) || (a[0] === -b[0] && a[1] === -b[1] && a[2] === -b[2]);
  const dSpacing = (h, k, l) => 1 / Math.sqrt(h * h + k * k + l * l); // 立方晶胞，以 a 为单位
  // 题目分三档：只有 0 和 1；出现 2；出现负数
  const millerTiers = (() => {
    const all = [];
    for (let h = -2; h <= 2; h++) for (let k = -2; k <= 2; k++) for (let l = -2; l <= 2; l++) {
      if (!h && !k && !l) continue;
      const first = [h, k, l].find((v) => v);
      if (first < 0) continue; // (h̄k̄l̄) 和 (hkl) 只留一个
      const g = [h, k, l].reduce((a, b) => gcd(a, Math.abs(b)), 0);
      if (g > 1 && !(g === 2 && [h, k, l].filter((v) => v).length <= 2 && [h, k, l].every((v) => Math.abs(v) <= 2))) continue; // 只保留 (200)、(220) 这样常见的
      all.push([h, k, l]);
    }
    const neg = (m) => m.some((v) => v < 0), two = (m) => m.some((v) => Math.abs(v) === 2);
    return [all.filter((m) => !neg(m) && !two(m)), all.filter((m) => !neg(m) && two(m)), all.filter(neg)];
  })();
  function gcd(a, b) { a = Math.abs(a); while (b) [a, b] = [b, a % b]; return a; }

  // ── 19 Bloch 球 ─────────────────────────────────────────────────────
  // U = exp(−iθ n·σ/2) 把 Bloch 矢量绕 n 转 θ（右手定则）。下面的门都差一个整体相位，对 Bloch 矢量没有影响。
  const S2 = Math.SQRT1_2;
  const gates = {
    H: { axis: [S2, 0, S2], angle: Math.PI },
    X: { axis: [1, 0, 0], angle: Math.PI },
    Y: { axis: [0, 1, 0], angle: Math.PI },
    Z: { axis: [0, 0, 1], angle: Math.PI },
    S: { axis: [0, 0, 1], angle: Math.PI / 2 },
    Sdg: { axis: [0, 0, 1], angle: -Math.PI / 2 },
    T: { axis: [0, 0, 1], angle: Math.PI / 4 },
    Tdg: { axis: [0, 0, 1], angle: -Math.PI / 4 },
    SX: { axis: [1, 0, 0], angle: Math.PI / 2 },
  };
  const gateLabel = { H: 'H', X: 'X', Y: 'Y', Z: 'Z', S: 'S', Sdg: 'S†', T: 'T', Tdg: 'T†', SX: '√X' };
  // 门的 2×2 矩阵（复数写成 [实, 虚]），测试拿它和转动对拍
  const r = S2;
  const matrices = {
    H: [[[r, 0], [r, 0]], [[r, 0], [-r, 0]]],
    X: [[[0, 0], [1, 0]], [[1, 0], [0, 0]]],
    Y: [[[0, 0], [0, -1]], [[0, 1], [0, 0]]],
    Z: [[[1, 0], [0, 0]], [[0, 0], [-1, 0]]],
    S: [[[1, 0], [0, 0]], [[0, 0], [0, 1]]],
    Sdg: [[[1, 0], [0, 0]], [[0, 0], [0, -1]]],
    T: [[[1, 0], [0, 0]], [[0, 0], [r, r]]],
    Tdg: [[[1, 0], [0, 0]], [[0, 0], [r, -r]]],
    SX: [[[0.5, 0.5], [0.5, -0.5]], [[0.5, -0.5], [0.5, 0.5]]],
  };
  const applyGate = (v, g) => rotate(v, gates[g].axis, gates[g].angle);
  const near = (a, b, tol = 1e-6) => len(sub(a, b)) < tol;
  const key = (v) => v.map((x) => (Math.abs(x) < 5e-7 ? 0 : x).toFixed(6)).join(',');
  // 从 start 用 allowed 里的门到 target 最少要几个门（找不到返回 Infinity）
  function minGates(start, target, allowed, maxDepth = 10) {
    if (near(start, target)) return 0;
    let frontier = [start];
    const seen = new Set([key(start)]);
    for (let d = 1; d <= maxDepth; d++) {
      const next = [];
      for (const v of frontier) for (const g of allowed) {
        const u = applyGate(v, g);
        if (near(u, target)) return d;
        const k = key(u);
        if (!seen.has(k)) { seen.add(k); next.push(u); }
      }
      frontier = next;
    }
    return Infinity;
  }
  const run = (start, seq) => seq.reduce((v, g) => applyGate(v, g), start);
  const ZERO = [0, 0, 1];
  // 关卡：target 由一串门从 start 算出来（数据里只写这串门，免得手抄坐标出错）；min 是最少门数，tools/play-test.mjs 用 minGates 核对
  const blochLevels = [
    { id: 'plus', start: ZERO, via: ['H'], gates: ['H', 'X', 'Z'], min: 1, name: ['|+⟩', '|+⟩'] },
    { id: 'one', start: ZERO, via: ['X'], gates: ['H', 'Z'], min: 3, name: ['不用 X 的 |1⟩', '|1⟩ without X'] },
    { id: 'plusi', start: ZERO, via: ['H', 'S'], gates: ['H', 'S'], min: 2, name: ['|+i⟩', '|+i⟩'] },
    { id: 'minus', start: ZERO, via: ['H', 'Z'], gates: ['H', 'S'], min: 3, name: ['|−⟩', '|−⟩'] },
    { id: 'tstate', start: ZERO, via: ['H', 'T'], gates: ['H', 'T', 'X'], min: 2, name: ['T 态', 'The T state'] },
    { id: 'minusi', start: [1, 0, 0], via: ['Sdg'], gates: ['T'], min: 6, name: ['只用 T', 'T gates only'] },
    { id: 'tilt', start: ZERO, via: ['H', 'T', 'H'], gates: ['H', 'T'], min: 3, name: ['斜着的轴', 'A tilted axis'] },
    { id: 'deep', start: ZERO, via: ['H', 'T', 'H', 'T'], gates: ['H', 'T'], min: 4, name: ['H、T 交替', 'H and T in turn'] },
    { id: 'sx', start: ZERO, via: ['H', 'S', 'H'], gates: ['SX', 'Z'], min: 1, name: ['√X 一步', 'One √X'] },
  ].map((L) => ({ ...L, target: run(L.start, L.via) }));
  // 星数：到了 1 颗，最多比最少多一个门 2 颗，正好最少 3 颗
  const blochStars = (L, used) => (used <= L.min ? 3 : used <= L.min + 1 ? 2 : 1);

  return {
    add, sub, scale, dot, cross, len, unit, angle, ID, apply, applyT, mul, axisAngle, rotate, orthonormalize, randomRotation, between, slerp,
    WEIGHT, energy, force, relax, shapeOf, molecules, kinds, shapes, solved, scatter,
    handedness, TETRA, chirals, placeChiral,
    millerPlane, cubeSection, polygonArea, millerSame, dSpacing, millerTiers, CORNERS, EDGES,
    gates, gateLabel, matrices, applyGate, minGates, run, blochLevels, blochStars, near,
  };
})();
