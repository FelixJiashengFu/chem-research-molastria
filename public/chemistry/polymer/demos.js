'use strict';
// 化学学科馆 09 · 高分子化学的四个演示：逐步聚合的链长和分布、共聚组成和漂移、无规线团、Flory–Huggins 相图。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, pct, plot } = K;

  // ── 逐步聚合：Carothers 方程和 Flory 分布 ───────────────────────────────
  D.step = {
    kind: 'exact',
    title: ['逐步聚合：反应程度、配比和链长分布', 'Step growth: extent of reaction, stoichiometry and chain-length distribution'],
    intro: ['调反应程度 p 和两种官能团的配比 r，看数均聚合度怎样在最后一点点转化里猛涨，以及链长分布的形状；打开对照，看同样数均长度的活性聚合分布有多窄。', 'Adjust the extent of reaction p and the functional-group ratio r to see the number-average degree of polymerisation shoot up in the last few per cent of conversion, and the shape of the chain-length distribution; switch on the comparison to see how narrow a living polymerisation of the same average length is.'],
    ctl: [['p', ['反应程度 p', 'Extent of reaction p'], 0.5, 0.999, 0.001, 0.99, (v) => fix(v, 3)], ['r', ['配比 r = N_A/N_B', 'Ratio r = N_A/N_B'], 0.9, 1, 0.001, 1, (v) => fix(v, 3)]],
    chk: [['liv', ['叠上同样数均长度的活性聚合（Poisson）分布', 'Overlay a living (Poisson) distribution of the same average length'], true]],
    btn: [[['p = 0.95：还只是低聚物', 'p = 0.95: still oligomers'], { p: 0.95, r: 1 }], [['p = 0.99：实用尼龙的下限', 'p = 0.99: the lower limit for useful nylon'], { p: 0.99, r: 1 }], [['p = 0.999', 'p = 0.999'], { p: 0.999, r: 1 }], [['配比差 1 %（r = 0.99）', '1 % imbalance (r = 0.99)'], { p: 0.999, r: 0.99 }]],
    figs: [[0.55, ['数均聚合度对反应程度（纵轴对数）。灰线是 r = 1，彩色线是当前配比。', 'Number-average degree of polymerisation against extent of reaction (log axis). Grey: r = 1; coloured: the current ratio.']], [0.55, ['质量分数分布 w_x：Flory 最可几分布（按当前 p、r = 1），和同样 X̄n 的 Poisson 分布对照。', 'Weight-fraction distribution w_x: the Flory most probable distribution (current p, r = 1) against a Poisson distribution of the same X̄n.']]],
    note: ['Carothers 方程和 Flory 分布都是精确的解析式，前提是等活性假设（官能团的反应性和链长无关）和没有成环、没有副反应。分布图按 r = 1 画；r < 1 时链长上限是 (1 + r)/(1 − r)。“尼龙-6,6 的 Mn”按每个单体残基平均 113.2 g/mol 算，忽略端基。', 'The Carothers equation and Flory distribution are exact analytic results assuming equal reactivity (functional-group reactivity independent of chain length), no cyclisation and no side reactions. The distribution is drawn for r = 1; with r < 1 the chain length is capped at (1 + r)/(1 − r). The “nylon-6,6 Mn” row uses an average of 113.2 g/mol per monomer residue and ignores end groups.'],
    draw(s, f, c) {
      const ps = K.lin(0.5, 0.999, 300), xn = M.carothers(s.p, s.r);
      plot(f[0], { x: [0.5, 1], y: [0, 3.4], logy: true, xl: 'p', yl: 'X̄n', series: [{ xs: ps, ys: ps.map((p) => M.carothers(p, 1)), color: c.faint, width: 1.6 }, { xs: ps, ys: ps.map((p) => M.carothers(p, s.r)), color: c.accent, width: 2.4 }], marks: [{ x: s.p, y: xn, color: c.gold }] });
      const xw = M.floryXw(s.p), xmax = Math.max(20, Math.min(4000, Math.ceil(xw * 2.5))), xs = K.lin(1, xmax, 400).map(Math.round), w = xs.map((x) => M.floryW(s.p, x));
      const xn1 = M.carothers(s.p, 1), nu = xn1 - 1, wp = xs.map((x) => (M.poissonN(nu, x) * x) / xn1);
      const series = [{ xs, ys: w, color: c.accent, width: 2.4, fill: true, label: L('Flory 分布', 'Flory') }];
      if (s.liv) series.push({ xs, ys: wp, color: c.gold, width: 2, label: L('活性聚合', 'living') });
      const ytop = Math.max(...w, ...(s.liv ? wp : [0])) * 1.12;
      plot(f[1], { x: [0, xmax], y: [0, ytop], xl: 'x', yl: 'w_x', series, marks: [{ x: xn1, color: c.faint }] });
      return [[['数均聚合度 X̄n', 'Number average X̄n'], fix(xn, 1), 1], [['重均聚合度 X̄w（r = 1）', 'Weight average X̄w (r = 1)'], fix(xw, 1)], [['分散度 Đ', 'Dispersity Đ'], `${fix(1 + s.p, 3)}${s.liv ? L(`（活性 ${fix(M.poissonD(nu), 3)}）`, ` (living ${fix(M.poissonD(nu), 3)})`) : ''}`, 1], [['剩下的单体（按分子数）', 'Monomer left (by number)'], pct(1 - s.p, 1)], [['尼龙-6,6 的 Mn', 'Mn of nylon-6,6'], `${fmt(xn * 113.2, 3)} g/mol`], [['链长上限（p → 1）', 'Ceiling as p → 1'], s.r < 1 ? fix((1 + s.r) / (1 - s.r), 0) : '∞']];
    },
  };

  // ── 共聚：Mayo–Lewis 和组成漂移 ─────────────────────────────────────────
  // 竞聚率是教科书常引值（约 60 °C 自由基共聚），编者录入
  const PAIRS = [
    [['苯乙烯 / 甲基丙烯酸甲酯', 'Styrene / methyl methacrylate'], 0.52, 0.46, 0.5],
    [['苯乙烯 / 马来酸酐（交替）', 'Styrene / maleic anhydride (alternating)'], 0.02, 0.001, 0.5],
    [['苯乙烯 / 醋酸乙烯酯（很难共聚）', 'Styrene / vinyl acetate (barely copolymerise)'], 55, 0.01, 0.2],
    [['苯乙烯 / 丁二烯', 'Styrene / butadiene'], 0.78, 1.39, 0.25],
    [['理想共聚 r₁r₂ = 1', 'Ideal, r₁r₂ = 1'], 2, 0.5, 0.5],
  ];
  D.copoly = {
    kind: 'exact',
    title: ['共聚组成和组成漂移', 'Copolymer composition and drift'],
    intro: ['调两个竞聚率和投料组成，看瞬时共聚物组成 F₁ 偏离投料组成多少；右图把聚合一直做下去，看剩下的单体和生成的共聚物组成怎样随转化率漂移。', 'Adjust the two reactivity ratios and the feed composition to see how far the instantaneous copolymer composition F₁ departs from the feed; the right figure runs the polymerisation on to show how the remaining monomer and the copolymer drift with conversion.'],
    ctl: [['l1', ['竞聚率 r₁（对数滑杆）', 'Reactivity ratio r₁ (log slider)'], -3, 2, 0.01, Math.log10(0.52), (v) => `r₁ = ${fmt(10 ** v, 3)}`], ['l2', ['竞聚率 r₂（对数滑杆）', 'Reactivity ratio r₂ (log slider)'], -3, 2, 0.01, Math.log10(0.46), (v) => `r₂ = ${fmt(10 ** v, 3)}`], ['f', ['投料中单体 1 的摩尔分数 f₁', 'Feed mole fraction f₁'], 0.01, 0.99, 0.01, 0.5, (v) => fix(v, 2)]],
    btn: PAIRS.map(([nm, r1, r2, f]) => [nm, { l1: Math.log10(r1), l2: Math.log10(r2), f }]),
    figs: [[0.62, ['瞬时共聚物组成 F₁ 对投料组成 f₁。和对角线的交点是恒比点。', 'Instantaneous copolymer composition F₁ against feed f₁. Crossings of the diagonal are azeotropes.']], [0.55, ['从当前投料一直聚合下去：剩下单体的 f₁、此刻生成的共聚物 F₁ 和到此为止的累积组成。', 'Polymerising on from the current feed: f₁ of the remaining monomer, the copolymer F₁ being formed, and the cumulative composition so far.']]],
    note: ['Mayo–Lewis 方程（末端模型）精确；组成漂移按 Skeist 方程数值积分。末端模型忽略了倒数第二个单元的影响和解聚，有些单体对（如含丙烯腈的体系）需要更复杂的模型。按钮里的竞聚率是教科书常引的近似值（约 60 °C），由编者录入，未逐条复核；不同文献和温度下差别可达 20 % 以上。', 'The Mayo–Lewis equation (terminal model) is exact; drift is from numerical integration of the Skeist equation. The terminal model ignores penultimate-unit effects and depropagation, and some pairs (those with acrylonitrile, for instance) need richer models. The reactivity ratios on the buttons are approximate textbook values (about 60 °C) typed by the editor and not rechecked; values differ by 20 % or more between sources and temperatures.'],
    draw(s, f, c) {
      const r1 = 10 ** s.l1, r2 = 10 ** s.l2, fs = K.lin(0, 1, 201), F = M.mayoLewis(s.f, r1, r2);
      const az = (r1 < 1 && r2 < 1) || (r1 > 1 && r2 > 1) ? (1 - r2) / (2 - r1 - r2) : null;
      plot(f[0], { x: [0, 1], y: [0, 1], xl: 'f₁', yl: 'F₁', series: [{ xs: [0, 1], ys: [0, 1], color: c.faint, width: 1.2, dash: [5, 4] }, { xs: fs, ys: fs.map((x) => M.mayoLewis(x, r1, r2)), color: c.accent, width: 2.6 }], marks: [{ x: s.f, y: F, color: c.gold }, ...(az !== null ? [{ x: az, y: az, color: c.danger }] : [])] });
      const d = M.copolyDrift(s.f, r1, r2);
      plot(f[1], { x: [0, 1], y: [0, 1], xl: L('转化率', 'Conversion'), yl: L('单体 1 的摩尔分数', 'Mole fraction of 1'), series: [{ xs: d.X, ys: d.f, color: c.info, width: 2, label: L('剩下的单体 f₁', 'monomer f₁') }, { xs: d.X, ys: d.Fi, color: c.accent, width: 2.4, label: L('瞬时 F₁', 'instant F₁') }, { xs: d.X, ys: d.Fc, color: c.gold, width: 2, dash: [6, 4], label: L('累积', 'cumulative') }] });
      const p = r1 * r2, kind = p < 0.05 ? L('倾向交替', 'tends to alternate') : Math.abs(Math.log10(p)) < 0.05 ? L('理想（无规）', 'ideal (random)') : p > 1 ? L('倾向成段', 'tends to blocks') : L('介于理想和交替之间', 'between ideal and alternating');
      const i90 = Math.round(0.9 / 0.99 * (d.X.length - 1));
      return [[['r₁r₂', 'r₁r₂'], `${fmt(p, 3)}（${kind}）`, 1], [['瞬时共聚物 F₁', 'Instantaneous F₁'], fix(F, 3), 1], [['恒比点', 'Azeotrope'], az !== null && az > 0 && az < 1 ? `f₁ = ${fix(az, 3)}` : L('没有', 'none')], [['M₁ 平均段长', 'Mean run of M₁'], fix(1 + (r1 * s.f) / (1 - s.f), 2)], [['M₂ 平均段长', 'Mean run of M₂'], fix(1 + (r2 * (1 - s.f)) / s.f, 2)], [['90 % 转化时 F₁', 'F₁ at 90 %'], fix(d.Fi[i90], 3)]];
    },
  };

  // ── 无规线团 ────────────────────────────────────────────────────────────
  const TET = (109.47 * Math.PI) / 180;
  const CHAINS = { fjc: [['自由连接链', 'Freely jointed chain'], null], frc: [['自由旋转链（四面体键角）', 'Freely rotating chain (tetrahedral angle)'], TET] };
  const stats = (pts) => { const n = pts.length, cm = [0, 1, 2].map((k) => pts.reduce((a, p) => a + p[k], 0) / n), e = pts[n - 1]; return { R: Math.hypot(...e), Rg: Math.sqrt(pts.reduce((a, p) => a + (p[0] - cm[0]) ** 2 + (p[1] - cm[1]) ** 2 + (p[2] - cm[2]) ** 2, 0) / n) }; };
  D.chain = {
    kind: 'model',
    title: ['无规线团：末端距随链长怎样增长', 'Random coils: how the end-to-end distance grows with length'],
    intro: ['在三维里随机生成一条链（左图是它在平面上的投影），看它的末端距和回转半径；右图对每个链长生成 300 条链取平均，和 ⟨R²⟩ = C_N·N·b² 对照。', 'Generate a random chain in three dimensions (the left figure is its projection onto a plane) and read its end-to-end distance and radius of gyration; on the right, 300 chains are averaged at each length and compared with ⟨R²⟩ = C_N·N·b².'],
    sel: [['m', ['链模型', 'Chain model'], Object.entries(CHAINS).map(([k, v]) => [k, v[0]]), 'frc']],
    ctl: [['ln', ['键数 N（对数滑杆）', 'Bonds N (log slider)'], 1, 3.5, 0.05, 2.5, (v) => `N = ${Math.round(10 ** v)}`], ['seed', ['换一条链', 'Another chain'], 1, 60, 1, 7, (v) => `#${v}`]],
    btn: [[['短链 N = 30', 'Short, N = 30'], { ln: Math.log10(30), m: 'frc' }], [['N = 1000', 'N = 1000'], { ln: 3, m: 'frc' }], [['自由连接链 N = 1000', 'Freely jointed, N = 1000'], { ln: 3, m: 'fjc' }]],
    figs: [[0.9, ['链在 xy 平面上的投影（以键长 b 为单位）。绿点是起点，红点是终点，虚线是末端距。', 'Projection of the chain on the xy plane (in units of bond length b). Green marks the start, red the end, and the dashed line is the end-to-end vector.']], [0.6, ['均方根末端距对键数（双对数）。点是 300 条链的平均，实线是理论，虚线是良溶剂里 N^0.588 的斜率（只示意斜率）。', 'Root-mean-square end-to-end distance against bond count (log–log). Dots average 300 chains, solid lines are theory, the dashed line shows the N^0.588 slope of a good solvent (slope only).']]],
    note: ['蒙特卡洛模拟：自由连接链每根键的方向完全随机；自由旋转链固定键角 109.47°、绕上一根键的转角均匀随机，特征比 C∞ = (1 + cos θ′)/(1 − cos θ′) = 2（θ′ = 180° − 109.47°），有限 N 的 C_N 用精确式。两种模型都没有排除体积，是理想链；真实聚乙烯因为反式比旁式能量低，C∞ 约 6.7。300 条链的平均有约 ±8 % 的统计误差。', 'A Monte Carlo simulation: the freely jointed chain points each bond in a random direction; the freely rotating chain fixes the bond angle at 109.47° with a uniformly random rotation about the previous bond, giving a characteristic ratio C∞ = (1 + cos θ′)/(1 − cos θ′) = 2 (θ′ = 180° − 109.47°), with the exact finite-N C_N. Neither model has excluded volume, so both are ideal chains; real polyethylene has C∞ ≈ 6.7 because trans is lower in energy than gauche. Averages of 300 chains carry about ±8 % statistical error.'],
    draw(s, f, c) {
      const N = Math.round(10 ** s.ln), th = CHAINS[s.m][1], pts = M.chain3d(N, th, s.seed * 104729 + 17), st = stats(pts);
      const xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]), cx = (Math.min(...xs) + Math.max(...xs)) / 2, cy = (Math.min(...ys) + Math.max(...ys)) / 2, h = Math.max(Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)) / 2 * 1.12 + 1;
      const e = pts[N];
      plot(f[0], { x: [cx - h, cx + h], y: [cy - h, cy + h], eq: true, xl: 'x / b', yl: 'y / b', series: [{ pts: pts.map((p) => [p[0], p[1]]), color: c.accent, width: N > 1000 ? 0.8 : 1.4 }, { xs: [0, e[0]], ys: [0, e[1]], color: c.gold, width: 1.6, dash: [6, 4] }, { xs: [0], ys: [0], color: c.ok || c.info, dots: 5 }, { xs: [e[0]], ys: [e[1]], color: c.danger, dots: 5 }] });
      const Ns = [10, 30, 100, 300, 1000, 3000], sim = Ns.map((n) => { let r2 = 0; for (let k = 0; k < 300; k++) { const q = M.chain3d(n, th, k * 7919 + n); const z = q[n]; r2 += z[0] ** 2 + z[1] ** 2 + z[2] ** 2; } return Math.sqrt(r2 / 300); });
      const lnN = K.lin(1, 3.5, 60), th2 = (C) => lnN.map((l) => Math.log10(Math.sqrt(C * 10 ** l)));
      const theo = lnN.map((l) => Math.log10(Math.sqrt(M.charRatio(10 ** l, th) * 10 ** l)));
      const R10 = Math.log10(Math.sqrt(M.charRatio(10, th) * 10));
      plot(f[1], { x: [1, 3.5], y: [0.3, 2.4], xt: [1, 2, 3], xf: (t) => fmt(10 ** t, 1), yt: [0.5, 1, 1.5, 2], yf: (t) => fmt(10 ** t, 2), xl: 'N', yl: '√⟨R²⟩ / b', series: [{ xs: lnN, ys: th2(1), color: c.faint, width: 1.2, label: 'C∞ = 1' }, { xs: lnN, ys: th2(6.7), color: c.info, width: 1.2, label: L('聚乙烯 C∞ ≈ 6.7', 'PE C∞ ≈ 6.7') }, { xs: lnN, ys: theo, color: c.accent, width: 2.2, label: L('当前模型', 'model') }, { xs: lnN, ys: lnN.map((l) => R10 + 0.588 * (l - 1)), color: c.danger, width: 1.4, dash: [6, 4], label: 'N^0.588' }, { xs: Ns.map(Math.log10), ys: sim.map(Math.log10), color: c.gold, dots: 4.5 }], marks: [{ x: s.ln, color: c.gold }] });
      const Rth = Math.sqrt(M.charRatio(N, th) * N), Lc = th == null ? N : N * Math.sin(TET / 2);
      return [[['这条链的末端距', 'This chain’s R'], `${fix(st.R, 1)} b`, 1], [['理论 √⟨R²⟩', 'Theory √⟨R²⟩'], `${fix(Rth, 1)} b`], [['这条链的回转半径', 'This chain’s R_g'], `${fix(st.Rg, 1)} b`], [['理论 R_g = √⟨R²⟩/√6', 'Theory R_g'], `${fix(Rth / Math.sqrt(6), 1)} b`], [['伸直长度', 'Contour length'], `${fix(Lc, 0)} b`], [['伸直 / 线团', 'Extended / coil'], `${fix(Lc / Rth, 1)} ×`, 1]];
    },
  };

  // ── Flory–Huggins ───────────────────────────────────────────────────────
  D.fh = {
    kind: 'exact',
    title: ['Flory–Huggins：高分子溶液什么时候分相', 'Flory–Huggins: when a polymer solution phase-separates'],
    intro: ['调链长 N 和相互作用参数 χ，看混合自由能曲线什么时候出现两个“凹坑”，并用公切线求出共存的两相；右图是 χ–φ 相图，链越长，临界点越低、越偏向稀溶液。', 'Adjust the chain length N and interaction parameter χ to see when the free-energy curve develops two dips, and find the coexisting phases by the common tangent; the right figure is the χ–φ phase diagram, whose critical point drops and shifts to dilute solution as chains lengthen.'],
    ctl: [['ln', ['链长 N（对数滑杆）', 'Chain length N (log slider)'], 0, 4, 0.05, 2, (v) => `N = ${Math.round(10 ** v)}`], ['chi', ['相互作用参数 χ', 'Interaction parameter χ'], 0.3, 2.6, 0.005, 0.7, (v) => fix(v, 3)], ['phi', ['总体积分数 φ', 'Overall volume fraction φ'], 0.005, 0.95, 0.005, 0.1, (v) => fix(v, 3)]],
    chk: [['lg', ['φ 用对数轴（看长链的稀相）', 'Log φ axis (to see the dilute phase of long chains)'], false]],
    btn: [[['N = 1：两种小分子（正规溶液）', 'N = 1: two small molecules (regular solution)'], { ln: 0, chi: 2.5, phi: 0.5, lg: false }], [['N = 100，刚过临界', 'N = 100, just past critical'], { ln: 2, chi: 0.65, phi: 0.1, lg: false }], [['N = 1000，稀相几乎是纯溶剂', 'N = 1000: the dilute phase is nearly pure solvent'], { ln: 3, chi: 0.6, phi: 0.05, lg: true }], [['良溶剂 χ = 0.4，任何浓度都互溶', 'Good solvent χ = 0.4: miscible at all φ'], { ln: 3, chi: 0.4, phi: 0.1, lg: false }]],
    figs: [[0.62, ['每个格点的混合自由能。有两相时画出公切线（金色），它的两个切点就是共存的两相；红点是拐点（旋节点）。', 'Free energy of mixing per site. With two phases the common tangent (gold) is drawn; its two points of contact are the coexisting phases, and red dots mark the inflections (spinodal points).']], [0.62, ['χ–φ 相图：实线是双节线（共存线），虚线是旋节线，红点是临界点。在线上方分相；双节线和旋节线之间是亚稳区。', 'χ–φ phase diagram: the solid line is the binodal (coexistence), the dashed line the spinodal, the red dot the critical point. Above the lines the solution separates; between binodal and spinodal it is metastable.']]],
    note: ['Flory–Huggins 平均场理论，精确求解：双节线由自由能曲线的下凸包（公切线）求出，旋节线由二阶导数为零给出。理论假设链段和溶剂分子占同样大的格点、χ 和浓度无关，所以对真实体系只是半定量；它预言的临界点 χc → ½ 和长链溶液的高度不对称相图是对的，但稀溶液里链彼此分开，平均场不够准确。χ 越大对应温度越低（上临界溶解温度体系）。', 'Flory–Huggins mean-field theory, solved exactly: the binodal comes from the lower convex hull (common tangent) of the free-energy curve and the spinodal from where the second derivative vanishes. The theory assumes segments and solvent occupy equal lattice sites and that χ is independent of concentration, so it is only semi-quantitative for real systems; its critical point χc → ½ and the strongly asymmetric phase diagram of long chains are right, but in dilute solution the chains are isolated and mean field is not accurate. Larger χ corresponds to lower temperature (for systems with an upper critical solution temperature).'],
    draw(s, f, c) {
      const N = Math.round(10 ** s.ln), cr = M.fhCrit(N), bin = M.fhBinodal(N, s.chi), xr = s.lg ? [-5, 0] : [0, 1];
      const phis = s.lg ? K.lin(-5, -0.0005, 400).map((t) => 10 ** t) : K.lin(0.001, 0.999, 400), X = (p) => (s.lg ? Math.log10(p) : p);
      const g = phis.map((p) => M.fhG(p, N, s.chi));
      // 旋节点：χ = χs(φ) 的两个根
      const sp = []; for (let i = 1; i < phis.length; i++) { const a = M.fhSpinodal(phis[i - 1], N) - s.chi, b = M.fhSpinodal(phis[i], N) - s.chi; if (a * b < 0) sp.push(phis[i - 1] + ((phis[i] - phis[i - 1]) * a) / (a - b)); }
      const series = [{ xs: phis.map(X), ys: g, color: c.accent, width: 2.4 }];
      if (bin) { const [a, b] = bin, ga = M.fhG(a, N, s.chi), gb = M.fhG(b, N, s.chi), tl = phis.filter((p) => p >= a && p <= b); series.push({ xs: tl.map(X), ys: tl.map((p) => ga + ((gb - ga) * (p - a)) / (b - a)), color: c.gold, width: 2 }); }
      series.push({ xs: sp.map(X), ys: sp.map((p) => M.fhG(p, N, s.chi)), color: c.danger, dots: 4.5 });
      const gmin = Math.min(...g), gmax = Math.max(...g, 0);
      plot(f[0], { x: xr, y: [gmin - (gmax - gmin) * 0.08, gmax + (gmax - gmin) * 0.08 + 1e-6], xt: s.lg ? [-5, -4, -3, -2, -1, 0] : undefined, xf: s.lg ? (t) => (t === 0 ? '1' : `10${'⁻'}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[-t]}`) : undefined, xl: 'φ', yl: 'ΔG_mix / kT', series, marks: [{ x: X(s.phi), y: M.fhG(s.phi, N, s.chi), color: c.gold }] });
      // 相图
      const top = Math.max(cr.chi * 1.6, s.chi * 1.1), chis = K.lin(cr.chi * 1.0005, top, 26), B = chis.map((x) => M.fhBinodal(N, x)), ok = B.map((b, i) => [b, chis[i]]).filter(([b]) => b);
      const spx = phis.filter((p) => M.fhSpinodal(p, N) <= top * 1.02);
      plot(f[1], { x: xr, y: [Math.max(0, cr.chi * 0.6), top], xt: s.lg ? [-5, -4, -3, -2, -1, 0] : undefined, xf: s.lg ? (t) => (t === 0 ? '1' : `10⁻${'⁰¹²³⁴⁵⁶⁷⁸⁹'[-t]}`) : undefined, xl: 'φ', yl: 'χ', series: [{ xs: [...ok.slice().reverse().map(([b]) => X(b[0])), X(cr.phi), ...ok.map(([b]) => X(b[1]))], ys: [...ok.slice().reverse().map(([, x]) => x), cr.chi, ...ok.map(([, x]) => x)], color: c.accent, width: 2.4, label: L('双节线', 'binodal') }, { xs: spx.map(X), ys: spx.map((p) => M.fhSpinodal(p, N)), color: c.info, width: 1.6, dash: [6, 4], label: L('旋节线', 'spinodal') }, { xs: [X(cr.phi)], ys: [cr.chi], color: c.danger, dots: 5 }], hmarks: [{ y: s.chi, color: c.gold }], marks: [{ x: X(s.phi), y: s.chi, color: c.gold }] });
      const unstable = !!bin && s.chi > M.fhSpinodal(s.phi, N), two = bin && s.phi > bin[0] && s.phi < bin[1];
      const state = unstable ? L('不稳定，自发分相', 'unstable, separates spontaneously') : two ? L('亚稳，要成核才分相', 'metastable, needs nucleation') : L('均匀的一相', 'one homogeneous phase');
      return [[['临界 χc', 'Critical χc'], fix(cr.chi, 4)], [['临界 φc', 'Critical φc'], fix(cr.phi, 4)], [['当前状态', 'State'], state, 1], [['稀相 φ′', 'Dilute phase φ′'], bin ? fmt(bin[0], 3) : '—'], [['浓相 φ″', 'Concentrated phase φ″'], bin ? fmt(bin[1], 3) : '—'], [['浓相体积比例', 'Concentrated share'], bin && (two || unstable) ? pct((s.phi - bin[0]) / (bin[1] - bin[0]), 0) : '—']];
    },
  };
});
