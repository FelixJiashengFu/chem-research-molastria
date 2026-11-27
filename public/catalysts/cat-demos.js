'use strict';
// 人工催化剂（/catalysts/）的十四个演示。数学都在 cat-models.js（纯函数，tools/cat-test.mjs 测）。
// cat.js 用 window.MOLASTRIA_CAT_DEMOS(K, DEMOS) 把它们登记进去。写法和 AI 蛋白质设计（../protein-design/pd-demos.js）一样：
// title，kind，intro，sel 下拉 [键, 名字, [[值, 名字]…], 初值]，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，chk 开关 [键, 名字, 初值]，
// btn 预设 [名字, { 键: 值 }]，act 动作，state，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 返回读数 [[名字, 值, 是否加粗]]。
// 这里不画任何真实催化剂的结构，所有曲线都是公式现算出来的；玩具数据集也是自己生成的，不是论文里的数据。
window.MOLASTRIA_CAT_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_CAT_MODELS;
  const { L, fix, fmt, pct, plot, fit, lin, font, table, css, sup } = K;
  const memo = (s, slot, key, make) => { s._c ||= {}; if (!s._c[slot] || s._c[slot].key !== key) s._c[slot] = { key, v: make() }; return s._c[slot].v; };
  const sci = (v, d = 2) => (v === 0 ? '0' : `${(v / 10 ** Math.floor(Math.log10(Math.abs(v)))).toFixed(d)} × 10${sup(Math.floor(Math.log10(Math.abs(v))))}`);
  const time = (sec) => (sec < 60 ? `${fix(sec, 1)} s` : sec < 3600 ? `${fix(sec / 60, 1)} min` : sec < 86400 * 2 ? `${fix(sec / 3600, 1)} h` : sec < 86400 * 400 ? `${fix(sec / 86400, 1)} ${L('天', 'days')}` : `${fmt(sec / 3.156e7, 2)} ${L('年', 'years')}`);

  // ── 1. 催化就是一个指数：ΔΔG‡ 和加速倍数 ───────────────────────────────
  DEMOS.accel = {
    title: L('催化的全部算术：把垒降低多少，就快多少', 'The whole arithmetic of catalysis: lower the barrier, gain the rate'),
    kind: 'exact',
    intro: L('催化剂不改变平衡，只降低过渡态的自由能。Eyring 方程说速率和垒高是指数关系：298 K 时每降 1.364 kcal/mol，速率快十倍。那篇笼催化论文里最强和最弱的笼差四个数量级以上，换算过来只有 5.5 kcal/mol——两三个氢键的事。拖动看一个没有催化剂时要一年的反应，被降低多少垒才在一小时内做完。', 'A catalyst does not change the equilibrium, it lowers the free energy of the transition state. The Eyring equation makes rate exponential in that barrier: at 298 K every 1.364 kcal/mol is a factor of ten. The strongest and weakest cages in the cage-catalysis paper differ by more than four orders of magnitude, which converts to only 5.5 kcal/mol — two or three hydrogen bonds. Drag to see how much barrier has to go for a reaction that takes a year to finish within the hour.'),
    ctl: [['dGu', L('没有催化剂时的垒 ΔG‡ (kcal/mol)', 'Uncatalysed barrier ΔG‡ (kcal/mol)'), 18, 36, 0.5, 28, (v) => `${v}`], ['dd', L('催化剂降低的量 ΔΔG‡ (kcal/mol)', 'Lowered by ΔΔG‡ (kcal/mol)'), 0, 18, 0.1, 6, (v) => `${v}`], ['T', L('温度 (K)', 'Temperature (K)'), 253, 373, 1, 298, (v) => `${v}`]],
    btn: [[L('笼催化：四个数量级', 'Cage catalysis: four orders of magnitude'), { dGu: 26, dd: 5.5, T: 298 }], [L('一个酶：10¹⁰ 倍', 'An enzyme: 10¹⁰-fold'), { dGu: 30, dd: 13.6, T: 298 }], [L('只差一个氢键', 'One hydrogen bond'), { dGu: 26, dd: 1.5, T: 298 }]],
    figs: [[0.45, L('速率随垒高的变化（对数纵轴）：金色是有催化剂，墨色是没有；竖线是现在的两个垒。', 'Rate against barrier height (log scale): gold is catalysed, ink is not; the vertical lines are the two current barriers.')], ['html', L('换算表。', 'The conversion table.')]],
    note: L('Eyring 方程 k = (k_BT/h)·exp(−ΔG‡/RT)，透射系数取 1，标准态按一级反应算。真实的双分子反应还要带上浓度和标准态的项，这里只比较同一个反应有没有催化剂的差别。', 'The Eyring equation k = (k_BT/h)·exp(−ΔG‡/RT) with a transmission coefficient of one and a first-order standard state. A real bimolecular reaction also carries concentration and standard-state terms; here only the catalysed and uncatalysed versions of the same reaction are compared.'),
    draw(s, [pv, tv]) {
      const c = css(), T = s.T, xs = lin(10, 40, 160);
      const ys = xs.map((g) => Math.log10(M.eyring(g, T)));
      const kU = M.eyring(s.dGu, T), kC = M.eyring(s.dGu - s.dd, T);
      plot(pv, { x: [10, 40], y: [Math.min(...ys), Math.max(...ys)], xl: L('活化自由能 ΔG‡ (kcal/mol)', 'activation free energy ΔG‡ (kcal/mol)'), yl: L('lg k (s⁻¹)', 'lg k (s⁻¹)'),
        series: [{ xs, ys, color: c.ink2, width: 2.2, label: L('Eyring 方程', 'Eyring equation') }],
        marks: [{ x: s.dGu, y: Math.log10(kU), color: c.ink2 }, { x: s.dGu - s.dd, y: Math.log10(kC), color: c.gold }],
        texts: [{ s: L('没有催化剂', 'uncatalysed'), x: s.dGu, y: Math.log10(kU), dx: 6, dy: -8, color: c.ink2 }, { s: L('有催化剂', 'catalysed'), x: s.dGu - s.dd, y: Math.log10(kC), dx: 6, dy: -8, color: c.gold }] });
      tv.innerHTML = table([L('项目', 'Quantity'), L('没有催化剂', 'Uncatalysed'), L('有催化剂', 'Catalysed')], [
        [L('ΔG‡ (kcal/mol)', 'ΔG‡ (kcal/mol)'), fix(s.dGu, 1), fix(s.dGu - s.dd, 1)],
        [L('速率常数 (s⁻¹)', 'Rate constant (s⁻¹)'), sci(kU), sci(kC)],
        [L('半衰期', 'Half-life'), time(M.halfLife(kU)), time(M.halfLife(kC))],
      ]);
      return [[L('加速倍数', 'Rate enhancement'), sci(M.rateRatio(s.dd, T), 2), true],
        [L('相当于几个数量级', 'Orders of magnitude'), fix(M.decades(s.dd, T), 2)],
        [L('这个温度下一个数量级值多少', 'One order of magnitude at this temperature'), `${fix(M.kcalPerDecade(T), 3)} kcal/mol`],
        [L('半衰期从', 'Half-life from'), `${time(M.halfLife(kU))} → ${time(M.halfLife(kC))}`, true]];
    },
  };

  // ── 2. 预组织：有效摩尔浓度 ────────────────────────────────────────────
  DEMOS.em = {
    title: L('预组织值多少钱：有效摩尔浓度', 'What preorganisation is worth: effective molarity'),
    kind: 'exact',
    intro: L('两个分子要反应，先得撞在一起，而撞在一起要付平动和转动的熵。把它们先装进一个笼子（或者用一条链拴在一起），这笔钱就提前付过了，二级反应变成一级反应。省下来的多少，用“有效摩尔浓度” EM = k_分子内 / k_分子间 来量：EM = 10⁵ M 的意思是，要让自由的两个分子反应得这么快，得把浓度加到十万摩尔每升——做不到，所以笼子不是“浓缩”，是把不可能变成可能。', 'Two molecules have to meet before they react, and meeting costs translational and rotational entropy. Put them in a cage first (or tie them together with a tether) and that bill is already paid: a second-order reaction becomes first-order. How much was saved is measured by the effective molarity EM = k_intra / k_inter. An EM of 10⁵ M means free molecules would have to be at a hundred thousand moles per litre to react that fast — impossible, so a cage does not concentrate, it enables.'),
    ctl: [['lgEM', L('有效摩尔浓度（10 的几次方 M）', 'Effective molarity (powers of ten, M)'), 0, 8, 0.1, 5, (v) => `10^${v} M`], ['c', L('实际浓度（10 的几次方 M）', 'Actual concentration (powers of ten, M)'), -4, 0, 0.1, -2, (v) => `10^${v} M`]],
    btn: [[L('典型的笼催化', 'A typical catalytic cage'), { lgEM: 5, c: -2 }], [L('拴在一起的两段链', 'Two tethered chains'), { lgEM: 2, c: -2 }], [L('酶的活性位点', 'An enzyme active site'), { lgEM: 8, c: -3 }]],
    figs: [[0.45, L('分子内（一级）和分子间（二级）速率随浓度的变化；交点就是有效摩尔浓度。', 'Intramolecular (first-order) and intermolecular (second-order) rates against concentration; they cross at the effective molarity.')]],
    note: L('EM 的定义是两个速率常数之比，单位是浓度。图里把分子间速率写成 k₂·c，分子内写成 k₁ = EM·k₂，所以两条线在 c = EM 处相交——这正是 EM 的意思。把 EM 换成自由能用 −RT ln EM，所以 10⁵ M 在 298 K 相当于 6.8 kcal/mol。真实体系里 EM 还受笼内构象、溶剂和产物抑制影响，这里只算最干净的那一层。', 'EM is defined as the ratio of two rate constants and carries units of concentration. The figure writes the intermolecular rate as k₂·c and the intramolecular one as k₁ = EM·k₂, so the lines cross exactly at c = EM, which is what EM means. Converting EM to free energy with −RT ln EM makes 10⁵ M worth 6.8 kcal/mol at 298 K. In a real system EM also depends on conformation inside the cage, on solvent and on product inhibition; only the cleanest layer is computed here.'),
    draw(s, [pv]) {
      const c = css(), EM = 10 ** s.lgEM, k2 = 1, xs = lin(-6, 9, 200);
      const inter = xs.map((x) => Math.log10(k2 * 10 ** x)), intra = xs.map(() => Math.log10(k2 * EM));
      plot(pv, { x: [-6, 9], y: [-7, 9.5], xl: L('浓度 lg c (M)', 'concentration lg c (M)'), yl: L('lg（速率 / k₂）', 'lg(rate / k₂)'),
        series: [{ xs, ys: inter, color: c.ink2, width: 2.2, label: L('分子间（二级）', 'intermolecular (second order)') }, { xs, ys: intra, color: c.gold, width: 2.4, label: L('关进笼里（一级）', 'inside the cage (first order)') }],
        marks: [{ x: s.lgEM, y: Math.log10(EM), color: c.accent }, { x: s.c, y: s.c, color: c.info }],
        texts: [{ s: 'EM', x: s.lgEM, y: Math.log10(EM), dx: 6, dy: -8, color: c.accent }] });
      const gain = EM / 10 ** s.c;
      return [[L('有效摩尔浓度 EM', 'Effective molarity EM'), `${sci(EM, 2)} M`, true],
        [L('换成自由能', 'As free energy'), `${fix(M.emToDG(EM), 2)} kcal/mol`],
        [L('在现在这个浓度下，关进笼里快多少', 'Gain from the cage at this concentration'), `${sci(gain, 2)} ×`, true],
        [L('把自由分子加到同样快要多少浓度', 'Concentration needed to match it in free solution'), `${sci(EM, 2)} M（${EM > 55 ? L('比纯水还浓，做不到', 'denser than pure water: impossible') : L('还能做到', 'reachable')}）`]];
    },
  };

  // ── 3. 笼催化的热力学循环 ──────────────────────────────────────────────
  DEMOS.cagecycle = {
    title: L('笼子为什么能催化：它对过渡态的结合比对底物强', 'Why a cage catalyses: it binds the transition state better than the substrate'),
    kind: 'exact',
    intro: L('Pauling 的那句话写成公式就是 k_cat/k_uncat = K_TS/K_S：催化的全部本事，就是“抓过渡态比抓底物紧多少”。但现实有两个刹车：底物结合太紧，笼子一直被占着（饱和）；产物结合太紧，笼子出不了活（产物抑制）。三个滑块一起调，看表观速率怎么被这两件事按住。', 'Pauling’s remark, written as an equation, is k_cat/k_uncat = K_TS/K_S: all a catalyst does is bind the transition state more tightly than the substrate. Reality adds two brakes: bind the substrate too tightly and the cage is permanently occupied (saturation), bind the product too tightly and the cage never turns over (product inhibition). Move all three sliders and watch the apparent rate get held down.'),
    ctl: [['lgKS', L('底物结合常数 lg K_S (M⁻¹)', 'Substrate binding lg K_S (M⁻¹)'), 1, 7, 0.1, 3, (v) => `10^${v}`], ['lgKTS', L('过渡态结合常数 lg K_TS (M⁻¹)', 'Transition-state binding lg K_TS (M⁻¹)'), 1, 12, 0.1, 7, (v) => `10^${v}`], ['lgKP', L('产物结合常数 lg K_P (M⁻¹)', 'Product binding lg K_P (M⁻¹)'), 0, 7, 0.1, 2, (v) => `10^${v}`], ['conv', L('反应已经走了多少', 'Conversion so far'), 0, 0.95, 0.01, 0.2, pct]],
    btn: [[L('理想：抓紧过渡态、放开产物', 'Ideal: tight on the TS, loose on the product'), { lgKS: 3, lgKTS: 8, lgKP: 1 }], [L('产物抑制', 'Product inhibition'), { lgKS: 3, lgKTS: 8, lgKP: 6, conv: 0.5 }], [L('底物结合太紧', 'Substrate bound too tightly'), { lgKS: 6, lgKTS: 7, lgKP: 1 }]],
    figs: [[0.45, L('表观速率随底物浓度的变化：金色是现在的参数，虚线是没有产物抑制时。', 'Apparent rate against substrate concentration: gold is the current setting, dashed is the same cage without product inhibition.')], ['html', L('自由能图上的四个点。', 'The four points on the free-energy diagram.')]],
    note: L('用的是最简单的饱和模型：速率 = k_cat·[笼]·θ，占有率 θ = K_S[S]/(1 + K_S[S] + K_P[P])。k_cat/k_uncat = K_TS/K_S 是热力学循环的恒等式（假设过渡态本身的化学一样，只是被结合了），不含动力学假设之外的东西。真实体系里过渡态的结合常数测不出来，只能从加速倍数反推，这里的 K_TS 是直接给定的。', 'The simplest saturation model: rate = k_cat·[cage]·θ with θ = K_S[S]/(1 + K_S[S] + K_P[P]). The identity k_cat/k_uncat = K_TS/K_S comes from the thermodynamic cycle, assuming the chemistry of the transition state itself is unchanged and only bound. In a real system K_TS cannot be measured and is inferred from the acceleration; here it is simply given.'),
    draw(s, [pv, dv]) {
      const c = css(), KS = 10 ** s.lgKS, KTS = 10 ** s.lgKTS, KP = 10 ** s.lgKP;
      const xs = lin(-7, 0, 160), S0 = 1e-2;
      const rate = (lgc, kp) => { const S = 10 ** lgc * (1 - s.conv), P = 10 ** lgc * s.conv; return M.occupancy(KS, S, P, kp); };
      plot(pv, { x: [-7, 0], y: [0, 1.05], xl: L('底物总浓度 lg c (M)', 'total substrate lg c (M)'), yl: L('表观速率 / k_cat[笼]', 'apparent rate / k_cat[cage]'),
        series: [{ xs, ys: xs.map((x) => rate(x, KP)), color: c.gold, width: 2.4, label: L('现在的参数', 'current setting') }, { xs, ys: xs.map((x) => rate(x, 0)), color: c.ink2, width: 2, dash: [5, 4], label: L('没有产物抑制', 'no product inhibition') }],
        marks: [{ x: Math.log10(S0), y: rate(Math.log10(S0), KP), color: c.accent }] });
      const dGS = M.dGofK(KS), dGTS = M.dGofK(KTS), dGP = M.dGofK(KP);
      dv.innerHTML = table([L('状态', 'State'), L('结合常数 (M⁻¹)', 'Binding constant (M⁻¹)'), L('结合自由能 (kcal/mol)', 'Binding free energy (kcal/mol)')], [
        [L('底物在笼里', 'Substrate in the cage'), sci(KS, 2), fix(dGS, 2)],
        [L('过渡态在笼里', 'Transition state in the cage'), sci(KTS, 2), fix(dGTS, 2)],
        [L('产物在笼里', 'Product in the cage'), sci(KP, 2), fix(dGP, 2)],
      ]);
      const acc = M.cageAccel(KS, KTS), th = rate(Math.log10(S0), KP), th0 = rate(Math.log10(S0), 0);
      return [[L('加速上限 K_TS/K_S', 'Ceiling on the acceleration K_TS/K_S'), `${sci(acc, 2)} ×`, true],
        [L('相当于降低了多少垒', 'Barrier lowered by'), `${fix(M.ddGFromRatio(acc), 2)} kcal/mol`],
        [L('在 10 mM 下笼子被占住的比例', 'Cage occupancy at 10 mM'), pct(th)],
        [L('产物抑制让速率剩下', 'Product inhibition leaves'), th0 > 0 ? pct(th / th0) : '—', true]];
    },
  };

  // ── 4. 主客体滴定 ──────────────────────────────────────────────────────
  DEMOS.titration = {
    title: L('怎么量“笼子抓得有多紧”：核磁滴定和 1:1 拟合', 'Measuring how tightly a cage holds: an NMR titration and a 1:1 fit'),
    kind: 'experiment',
    intro: L('结合常数不是直接读出来的，是拟合出来的。固定主体浓度，一点点加客体，盯着某个氢的化学位移走；位移随加入量的那条曲线，形状由 K_a 决定。这里按 1:1 模型的精确解（二次方程）造一批带噪声的点，再用网格扫描把 K_a 和 Δδ_max 拟合回来——顺便看清楚一件事：主体浓度选得不对，曲线要么一下子就平（太强），要么几乎是直线（太弱），两种情况下 K_a 都拟合不准。', 'A binding constant is never read off, it is fitted. Hold the host concentration fixed, add guest in portions and follow one proton’s chemical shift; the shape of the shift-versus-added curve is what fixes K_a. Here noisy points are generated from the exact 1:1 solution (a quadratic) and K_a together with Δδ_max are fitted back by a grid scan — which also makes one thing obvious: choose the host concentration badly and the curve either saturates at once (too strong) or is nearly a straight line (too weak), and K_a cannot be pinned down either way.'),
    ctl: [['lgKa', L('真实的 K_a（10 的几次方 M⁻¹）', 'True K_a (powers of ten, M⁻¹)'), 1, 7, 0.1, 3.5, (v) => `10^${v}`], ['lgH', L('主体浓度（10 的几次方 M）', 'Host concentration (powers of ten, M)'), -6, -1, 0.1, -3, (v) => `10^${v} M`], ['noise', L('噪声（ppm）', 'Noise (ppm)'), 0, 0.05, 0.002, 0.006, (v) => `${v}`], ['pts', L('测几个点', 'Number of points'), 5, 24, 1, 12, String]],
    act: [[L('换一批噪声', 'Another noise draw'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    btn: [[L('刚刚好：K_a·[H] ≈ 1–100', 'Just right: K_a·[H] ≈ 1–100'), { lgKa: 3.5, lgH: -3 }], [L('太强，一加就满', 'Too strong: saturated at once'), { lgKa: 7, lgH: -3 }], [L('太弱，几乎是直线', 'Too weak: almost a straight line'), { lgKa: 1.5, lgH: -4 }]],
    state: () => ({ seed: 1 }),
    figs: [[0.45, L('滴加曲线：点是“实验数据”，线是拟合出来的曲线。', 'The titration curve: points are the “data”, the line is the fit.')]],
    note: L('1:1 结合的精确解来自质量守恒加平衡常数，不用过量近似。拟合是对 lg K_a 做两轮网格扫描，每个 K_a 下 Δδ_max 有线性最小二乘的闭式解。判断条件 Wilcox 参数 p = K_a·[H]₀ 在 1 到 100 之间时曲线的形状才真正含有 K_a 的信息，这也是文献里对 1:1 滴定的通用建议。真实样品还要考虑 1:2 结合、自聚集和溶剂效应，这些都没有算进来。', 'The exact 1:1 solution follows from mass balance plus the equilibrium constant, with no excess approximation. The fit is two rounds of a grid scan over lg K_a, with a closed-form least-squares solution for Δδ_max at each K_a. The Wilcox parameter p = K_a·[H]₀ has to lie between about 1 and 100 for the curve shape to carry information about K_a, which is the standard advice for 1:1 titrations. Real samples also need 1:2 binding, self-aggregation and solvent effects, none of which are included.'),
    draw(s, [pv]) {
      const c = css(), Ka = 10 ** s.lgKa, h0 = 10 ** s.lgH, dmax = 0.45;
      const guests = lin(0, h0 * 8, s.pts);
      const R = M.rng(s.seed * 7919 + s.pts);
      const clean = M.titrationCurve(h0, guests, Ka, dmax);
      const obs = clean.map((v) => v + s.noise * M.gauss(R));
      const fitv = memo(s, 'fit', `${s.lgKa}|${s.lgH}|${s.noise}|${s.pts}|${s.seed}`, () => M.fitKa(h0, guests, obs));
      const gs = lin(0, h0 * 8, 120);
      plot(pv, { x: [0, 8], y: [0, dmax * 1.15], xl: L('加入的客体 / 主体', 'guest added / host'), yl: L('Δδ (ppm)', 'Δδ (ppm)'),
        series: [{ xs: gs.map((g) => g / h0), ys: M.titrationCurve(h0, gs, fitv.Ka, fitv.dmax), color: c.gold, width: 2.4, label: L('拟合', 'fit') },
          { xs: guests.map((g) => g / h0), ys: obs, color: c.accent, dots: 4, label: L('数据', 'data') },
          { xs: gs.map((g) => g / h0), ys: M.titrationCurve(h0, gs, Ka, dmax), color: c.ink2, width: 1.6, dash: [5, 4], label: L('真值', 'truth') }] });
      const p = Ka * h0, err = Math.abs(fitv.Ka - Ka) / Ka;
      return [[L('拟合出来的 K_a', 'Fitted K_a'), `${sci(fitv.Ka, 2)} M⁻¹`, true],
        [L('和真值差多少', 'Error against the truth'), pct(err, 1), true],
        [L('Wilcox 参数 p = K_a[H]₀', 'Wilcox parameter p = K_a[H]₀'), `${fmt(p, 3)}（${p >= 1 && p <= 100 ? L('在好用的区间里', 'in the usable window') : L('超出 1–100，拟合不可靠', 'outside 1–100: the fit is unreliable')}）`],
        [L('结合自由能', 'Binding free energy'), `${fix(M.dGofK(fitv.Ka), 2)} kcal/mol`]];
    },
  };

  // ── 5. 玩具随机森林：描述符 → 活化自由能 ───────────────────────────────
  DEMOS.forest = {
    title: L('数据驱动的构效关系：在玩具数据上训一个随机森林，再问它为什么', 'Data-driven structure–activity: train a random forest on toy data, then ask it why'),
    kind: 'experiment',
    intro: L('这是那篇笼催化论文的做法在浏览器里的最小版本：给每个笼算一组有物理意义的描述符（预组织程度、空腔体积、笼内静电势、结构单元之间的夹角、柔性），用它们预测活化自由能，再看模型靠的是哪几个。数据是这里现生成的玩具数据（规律由我们自己写死，加了噪声），不是论文的数据集——所以请看方法和结论的形状，不要把这里的数字当成真实的笼。', 'This is the smallest browser version of what the cage-catalysis paper did: compute a few physically meaningful descriptors for each cage (preorganisation, cavity volume, electrostatic potential inside, the angle between building blocks, flexibility), predict the activation free energy from them, then ask which ones the model used. The data are toy data generated here, with a rule we wrote ourselves plus noise — look at the shape of the method and the conclusion, and do not read the numbers as real cages.'),
    ctl: [['n', L('数据集大小', 'Data set size'), 20, 300, 5, 120, String], ['noise', L('实验噪声 (kcal/mol)', 'Experimental noise (kcal/mol)'), 0, 1.2, 0.05, 0.25, (v) => `${v}`], ['trees', L('几棵树', 'Number of trees'), 1, 120, 1, 60, String], ['depth', L('最大深度', 'Maximum depth'), 1, 10, 1, 7, String]],
    btn: [[L('像论文那样：30 个笼', 'As in the paper: 30 cages'), { n: 30, noise: 0.25, trees: 60, depth: 7 }], [L('数据多一些', 'More data'), { n: 300, noise: 0.25, trees: 60, depth: 7 }], [L('只有一棵很浅的树', 'A single shallow tree'), { n: 120, noise: 0.25, trees: 1, depth: 2 }]],
    figs: [[0.5, L('袋外预测对真值（每个点是一个没被这棵树见过的笼）；对角线是完美预测。', 'Out-of-bag predictions against the truth (each point is a cage the trees scoring it never saw); the diagonal is a perfect model.')], [0.42, L('两种“为什么”：置换重要性（把一列打乱，误差变差多少）和一个笼的精确 Shapley 值。', 'Two kinds of “why”: permutation importance (how much worse the error gets when a column is shuffled) and the exact Shapley values for one cage.')], ['html', L('这个笼的描述符和它每一项的贡献。', 'The descriptors of that cage and what each contributed.')]],
    note: L('回归树、装袋、袋外预测、置换重要性和 Shapley 值全部是按定义自己写的（见 cat-models.js）。Shapley 值用的是精确枚举：五个特征就是 32 个子集，背景取训练集的前 30 个样本，所以满足效率公理 Σφ = f(x) − E[f]（读数里核对）。真实工作里特征多、样本少，一般用 TreeSHAP 近似。玩具数据的规律是：预组织越好、笼内静电势越正、夹角越接近 92°、柔性越低，垒越低；体积只在太小的时候有害——这是我们写进去的，所以模型找回它才算正常，不能当成关于真实笼的发现。', 'The regression tree, bagging, out-of-bag prediction, permutation importance and Shapley values are all written from their definitions (see cat-models.js). The Shapley values are exact: five features means 32 subsets, with the first 30 training rows as the background, so the efficiency axiom Σφ = f(x) − E[f] holds exactly (it is checked in the readout). Real work has more features and fewer samples and uses the TreeSHAP approximation. The rule behind the toy data is: better preorganisation, a more positive electrostatic potential inside, an angle closer to 92° and lower flexibility all lower the barrier, while volume only hurts when it is too small. We put that rule in, so the model recovering it is a sanity check, not a discovery about real cages.'),
    draw(s, [sv, iv, tv]) {
      const c = css();
      const key = `${s.n}|${s.noise}|${s.trees}|${s.depth}`;
      const R = memo(s, 'run', key, () => {
        const d = M.cageData(s.n, 7, s.noise);
        const F = M.buildForest(d.X, d.y, { trees: s.trees, seed: 3, mtry: 2, maxDepth: s.depth, minLeaf: 3 });
        const oob = M.oobPredict(F);
        const sh = M.shapley(F, d.X[0], d.X.slice(0, Math.min(30, d.X.length)));
        return { d, F, oob, met: M.metrics(d.y, oob), imp: M.permImportance(F), sh };
      });
      const { d, oob, met, imp, sh } = R;
      const lo = Math.min(...d.y, ...oob) - 0.5, hi = Math.max(...d.y, ...oob) + 0.5;
      plot(sv, { x: [lo, hi], y: [lo, hi], eq: true, xl: L('真实 ΔG‡ (kcal/mol)', 'true ΔG‡ (kcal/mol)'), yl: L('袋外预测 (kcal/mol)', 'out-of-bag prediction (kcal/mol)'),
        series: [{ xs: [lo, hi], ys: [lo, hi], color: c.ink2, width: 1.5, dash: [5, 4], label: L('完美预测', 'perfect') }, { xs: d.y, ys: oob, color: c.gold, dots: 3.4, label: L('每个笼', 'each cage') }] });
      const NAMES = [L('预组织', 'preorganisation'), L('空腔体积', 'cavity volume'), L('笼内静电势', 'electrostatics'), L('单元夹角', 'bite angle'), L('柔性', 'flexibility')];
      const idx = NAMES.map((_, i) => i);
      plot(iv, { x: [-0.6, 4.6], y: [Math.min(0, ...sh.phi) - 0.2, Math.max(...imp, ...sh.phi) + 0.3], xt: idx, xf: (t) => NAMES[t] || '', yl: L('kcal/mol', 'kcal/mol'),
        series: [{ xs: idx.map((i) => i - 0.18), ys: imp, color: c.accent, bars: 0.32, base: 0, label: L('置换重要性（RMSE 变差）', 'permutation importance (ΔRMSE)') },
          { xs: idx.map((i) => i + 0.18), ys: sh.phi, color: c.gold, bars: 0.32, base: 0, label: L('第一个笼的 Shapley 值', 'Shapley values for cage 1') }] });
      tv.innerHTML = table([L('描述符', 'Descriptor'), L('这个笼的值', 'Value for this cage'), L('Shapley 贡献 (kcal/mol)', 'Shapley contribution (kcal/mol)')],
        NAMES.map((nm, i) => [nm, fix(d.X[0][i], 2), fix(sh.phi[i], 3)]));
      const sum = sh.phi.reduce((a, b) => a + b, 0);
      return [[L('袋外 MAE', 'Out-of-bag MAE'), `${fix(met.mae, 3)} kcal/mol`, true],
        [L('袋外 R²', 'Out-of-bag R²'), fix(met.r2, 3), true],
        [L('最重要的描述符', 'Most important descriptor'), NAMES[imp.indexOf(Math.max(...imp))]],
        [L('检验：Σ Shapley = 预测 − 平均', 'Check: Σ Shapley = prediction − mean'), Math.abs(sum - (sh.pred - sh.base)) < 1e-9 ? L('一分不差', 'exact') : L('对不上', 'fails')]];
    },
  };

  // ── 6. 笼内静电 ────────────────────────────────────────────────────────
  DEMOS.electro = {
    title: L('笼内的静电：带电的笼子怎样稳定住带电的过渡态', 'Electrostatics inside: how a charged cage stabilises a charged transition state'),
    kind: 'exact',
    intro: L('把电荷均匀铺在一个半径 R 的球壳上，球内部的电势处处相同。于是笼子对一个客体的静电作用只取决于客体带多少电——底物和过渡态带的电不一样，差额就是催化。硝基羟醛反应正好是这种情况：过渡态上长出一个负电荷（硝基稳定的碳负离子），一个带正电的钯笼就把它按住。调笼电荷、笼半径和溶剂介电常数，看这项能给出几个数量级。', 'Spread charge evenly over a shell of radius R and the potential everywhere inside is the same. The electrostatic effect of a cage on its guest then depends only on the guest’s own charge — and since the substrate and the transition state carry different charge, the difference is the catalysis. The nitro-aldol reaction is exactly this case: negative charge grows on the transition state (a nitro-stabilised carbanion) and a cationic palladium cage holds it down. Change the cage charge, its radius and the solvent, and see how many orders of magnitude the term is worth.'),
    ctl: [['Q', L('笼的总电荷', 'Total cage charge'), 0, 12, 1, 4, (v) => `${v > 0 ? '+' : ''}${v}`], ['R', L('电荷到客体的距离 (Å)', 'Charge-to-guest distance (Å)'), 4, 14, 0.2, 7, (v) => `${v}`], ['eps', L('介电常数 ε', 'Dielectric constant ε'), 2, 80, 1, 37, String], ['dq', L('过渡态比底物多带的电荷', 'Extra charge on the TS'), -1, 0, 0.05, -0.6, (v) => `${v}`]],
    btn: [[L('乙腈里的钯笼', 'A palladium cage in acetonitrile'), { Q: 4, R: 7, eps: 37, dq: -0.6 }], [L('水里', 'In water'), { Q: 4, R: 7, eps: 78, dq: -0.6 }], [L('没有溶剂屏蔽（气相）', 'No screening (gas phase)'), { Q: 4, R: 7, eps: 1, dq: -0.6 }]],
    figs: [[0.45, L('稳定化随距离的变化（三种溶剂）；竖线是现在的距离。', 'Stabilisation against distance for three solvents; the vertical line is the current distance.')]],
    note: L('用的是最粗的球壳模型：ΔΔG = 332.06·Q·Δq/(ε·R)，Q 是笼的总电荷，Δq 是过渡态相对底物多带的电荷，R 是电荷到客体的有效距离，ε 是均匀介电常数。真实的笼有离散的金属中心、不均匀的屏蔽和反离子，连续介质模型会高估，所以这里算出来的是“最多值多少”。要做认真的计算得用 PCM / COSMO 或者显式溶剂，见[电磁学与介电]栏目。', 'The crudest shell model: ΔΔG = 332.06·Q·Δq/(ε·R), with Q the total cage charge, Δq the extra charge on the transition state, R the effective charge-to-guest distance and ε a uniform dielectric constant. A real cage has discrete metal centres, uneven screening and counterions, and a continuum model overestimates, so this is an upper bound. A serious calculation needs PCM/COSMO or explicit solvent; see the electromagnetism and dielectrics section.'),
    draw(s, [pv]) {
      const c = css(), rs = lin(4, 14, 120);
      const curve = (eps) => rs.map((r) => M.cageElectrostatic({ Q: s.Q, R: r, eps, qS: 0, qTS: s.dq }).ddG);
      const now = M.cageElectrostatic({ Q: s.Q, R: s.R, eps: s.eps, qS: 0, qTS: s.dq });
      plot(pv, { x: [4, 14], y: [Math.min(-30, ...curve(Math.max(2, s.eps))) * 1.05, 2], xl: L('距离 R (Å)', 'distance R (Å)'), yl: L('ΔΔG‡ (kcal/mol)', 'ΔΔG‡ (kcal/mol)'),
        series: [{ xs: rs, ys: curve(s.eps), color: c.gold, width: 2.4, label: L(`现在的 ε = ${s.eps}`, `current ε = ${s.eps}`) }, { xs: rs, ys: curve(78), color: c.info, width: 1.8, dash: [5, 4], label: L('水 ε = 78', 'water ε = 78') }, { xs: rs, ys: curve(8), color: c.accent, width: 1.8, dash: [2, 3], label: L('二氯甲烷 ε = 8', 'dichloromethane ε = 8') }],
        marks: [{ x: s.R, y: now.ddG, color: c.gold }] });
      return [[L('静电稳定化 ΔΔG‡', 'Electrostatic stabilisation ΔΔG‡'), `${fix(now.ddG, 2)} kcal/mol`, true],
        [L('换成加速倍数', 'As a rate enhancement'), `${sci(M.rateRatio(-now.ddG), 2)} ×`, true],
        [L('相当于几个数量级', 'Orders of magnitude'), fix(M.decades(-now.ddG), 2)],
        [L('换成水以后还剩', 'What survives in water'), `${fix(M.cageElectrostatic({ Q: s.Q, R: s.R, eps: 78, qS: 0, qTS: s.dq }).ddG, 2)} kcal/mol`]];
    },
  };

  // ── 7. 米氏动力学 ──────────────────────────────────────────────────────
  DEMOS.mm = {
    title: L('一个循环跑起来是什么样：米氏动力学、TON 和 TOF', 'What a cycle looks like running: Michaelis–Menten, TON and TOF'),
    kind: 'exact',
    intro: L('人工金属酶、设计酶和笼催化都会报 k_cat、K_M、TON、TOF 这几个数，但它们各自说的是不同的事。这里把微分方程原样积分（结合那一步用指数积分，底物由物料平衡给出），不做稳态近似，然后把结果和教科书的稳态公式叠在一起：开头有一小段“预稳态”，稳态近似在那段里是错的；到后面底物耗尽，速率又掉下来。TON 是累计转化数，TOF 是单位时间的转化数——同一条曲线上的两个读法。', 'Artificial metalloenzymes, designed enzymes and cage catalysts all report k_cat, K_M, TON and TOF, and those four numbers say different things. Here the three differential equations are integrated as they stand — the fast binding step with an exponential integrator and the substrate from mass balance — with no steady-state approximation, and the textbook steady-state formula is laid over the result: there is a short pre-steady-state at the beginning where the approximation is wrong, and at the end the substrate runs out and the rate falls again. TON is the cumulative turnover number, TOF the turnovers per unit time — two readings of the same curve.'),
    ctl: [['lgE', L('催化剂浓度 lg [E]₀ (M)', 'Catalyst lg [E]₀ (M)'), -8, -4, 0.1, -6, (v) => `10^${v} M`], ['lgS', L('底物浓度 lg [S]₀ (M)', 'Substrate lg [S]₀ (M)'), -5, -1, 0.1, -3, (v) => `10^${v} M`], ['k2', L('k_cat (s⁻¹)', 'k_cat (s⁻¹)'), 0.5, 200, 0.5, 20, (v) => `${v}`], ['lgKM', L('lg K_M (M)', 'lg K_M (M)'), -6, -2, 0.1, -4, (v) => `10^${v} M`], ['lgKP', L('产物抑制 lg K_P (M⁻¹)', 'Product inhibition lg K_P (M⁻¹)'), 0, 6, 0.2, 0, (v) => `10^${v}`]],
    btn: [[L('饱和：[S] ≫ K_M', 'Saturated: [S] ≫ K_M'), { lgE: -6, lgS: -3, k2: 20, lgKM: -5, lgKP: 0 }], [L('一级：[S] ≪ K_M', 'First order: [S] ≪ K_M'), { lgE: -6, lgS: -5, k2: 20, lgKM: -3, lgKP: 0 }], [L('产物把它毒死了', 'Poisoned by its own product'), { lgE: -6, lgS: -3, k2: 20, lgKM: -4, lgKP: 5 }]],
    figs: [[0.45, L('底物、复合物和产物随时间的变化（复合物放大了 100 倍才看得见）。', 'Substrate, complex and product against time (the complex is scaled ×100 to be visible).')], [0.42, L('初速率随底物浓度的变化：点是数值积分，线是米氏公式。', 'Initial rate against substrate concentration: points are the numerical integration, the line is the Michaelis–Menten formula.')]],
    note: L('积分的是 E + S ⇌ ES → E + P，k₋₁ 由 K_M 和 k_cat 反推（取 k₁ = 10⁷ M⁻¹s⁻¹），产物抑制按快速平衡折进自由催化剂里；结合这一步快几个数量级，所以复合物用指数积分推进、底物由物料平衡给出，三项严格守恒。米氏公式是稳态近似的结果，所以两条曲线在预稳态和底物耗尽时本来就该分开——这正是要看的地方。真实体系还有失活、底物抑制和多个中间体。', 'The integrated equations are those of E + S ⇌ ES → E + P, with k₋₁ recovered from K_M and k_cat at k₁ = 10⁷ M⁻¹s⁻¹, and product inhibition folded into the free catalyst as a rapid equilibrium; binding is orders of magnitude faster than the chemistry, so the complex is advanced with an exponential integrator and the substrate comes from mass balance, which conserves the three species exactly. The Michaelis–Menten formula is the steady-state result, so the two curves are supposed to separate during the pre-steady-state and when the substrate runs out — that is the point. Real systems also deactivate, suffer substrate inhibition and pass through more intermediates.'),
    draw(s, [tv, kv]) {
      const c = css(), e0 = 10 ** s.lgE, s0 = 10 ** s.lgS, Km = 10 ** s.lgKM, KP = 10 ** s.lgKP;
      const k1 = 1e7, km1 = Math.max(0, k1 * Km - s.k2);
      const tEnd = Math.max(5, (3 * s0) / (s.k2 * e0));
      const key = `${s.lgE}|${s.lgS}|${s.k2}|${s.lgKM}|${s.lgKP}`;
      const sim = memo(s, 'sim', key, () => M.mmSimulate({ e0, s0, k1, km1, k2: s.k2, KP, tEnd, steps: 1500 }));
      plot(tv, { x: [0, tEnd], y: [0, s0 * 1.05], xl: L('时间 (s)', 'time (s)'), yl: L('浓度 (M)', 'concentration (M)'),
        series: [{ xs: sim.t, ys: sim.S, color: c.ink2, width: 2.2, label: L('底物', 'substrate') }, { xs: sim.t, ys: sim.P, color: c.gold, width: 2.4, label: L('产物', 'product') }, { xs: sim.t, ys: sim.ES.map((v) => v * 100), color: c.accent, width: 1.8, label: L('复合物 ×100', 'complex ×100') }] });
      const lgs = lin(-6, -1, 26);
      const num = lgs.map((x) => { const r = M.mmSimulate({ e0, s0: 10 ** x, k1, km1, k2: s.k2, KP: 0, tEnd: 0.02 / s.k2 * 10, steps: 200 }); return r.P / (0.02 / s.k2 * 10); });
      plot(kv, { x: [-6, -1], y: [0, Math.max(...num, s.k2 * e0) * 1.1], xl: L('lg [S]₀ (M)', 'lg [S]₀ (M)'), yl: L('初速率 (M/s)', 'initial rate (M/s)'),
        series: [{ xs: lgs, ys: lgs.map((x) => M.mmRate(10 ** x, e0, s.k2, Km)), color: c.gold, width: 2.4, label: L('米氏公式', 'Michaelis–Menten') }, { xs: lgs, ys: num, color: c.accent, dots: 3.2, label: L('数值积分', 'numerical') }],
        hmarks: [{ y: s.k2 * e0, color: c.muted }], marks: [{ x: s.lgKM, color: c.info }] });
      return [[L('最后的 TON（转化数）', 'Final TON (turnover number)'), fix(sim.TON, 1), true],
        [L('平均 TOF', 'Average TOF'), `${fmt(sim.TOF, 3)} s⁻¹`, true],
        [L('催化效率 k_cat/K_M', 'Catalytic efficiency k_cat/K_M'), `${sci(M.efficiency(s.k2, Km), 2)} M⁻¹s⁻¹`],
        [L('底物转化了多少', 'Substrate converted'), pct(sim.P[sim.P.length - 1] / s0)]];
    },
  };

  // ── 8. 活性位点的几何精度 ──────────────────────────────────────────────
  DEMOS.geom = {
    title: L('为什么设计酶这么难：三个基团摆歪零点几埃就全没了', 'Why designed enzymes are hard: a few tenths of an ångström and it is gone'),
    kind: 'toy',
    intro: L('从头设计酶的难处不在“想出一个机理”，而在“把三四个基团摆到准确的位置上，并且让骨架真的把它们按在那里”。这里用三个氢键作为一个最小的活性位点，每个氢键的能量按 12–10 势随距离变化、按 cos²θ 随角度变化。把任意一个基团推开 0.3 Å 或者转过 15°，看总稳定化少了多少、速率掉了几倍。', 'The hard part of designing an enzyme is not inventing a mechanism, it is putting three or four groups in exactly the right place and having the backbone actually hold them there. Here a minimal active site is three hydrogen bonds, each with a 12–10 distance dependence and a cos²θ angular term. Push any one group out by 0.3 Å or rotate it by 15° and watch how much stabilisation is lost and how many fold the rate drops.'),
    ctl: [['dr1', L('基团 1 的距离偏差 (Å)', 'Group 1 distance offset (Å)'), -0.4, 1.2, 0.05, 0.3, (v) => `${v}`], ['th1', L('基团 1 的角度偏差 (°)', 'Group 1 angle offset (°)'), 0, 80, 1, 15, (v) => `${v}°`], ['dr2', L('基团 2 的距离偏差 (Å)', 'Group 2 distance offset (Å)'), -0.4, 1.2, 0.05, 0, (v) => `${v}`], ['th2', L('基团 2 的角度偏差 (°)', 'Group 2 angle offset (°)'), 0, 80, 1, 0, (v) => `${v}°`], ['D', L('一个理想氢键值多少 (kcal/mol)', 'An ideal hydrogen bond is worth (kcal/mol)'), 1, 5, 0.1, 2.5, (v) => `${v}`]],
    btn: [[L('完美摆放', 'Perfectly placed'), { dr1: 0, th1: 0, dr2: 0, th2: 0 }], [L('一个基团松了 0.5 Å', 'One group loosened by 0.5 Å'), { dr1: 0.5, th1: 0, dr2: 0, th2: 0 }], [L('两个都歪了', 'Both askew'), { dr1: 0.4, th1: 25, dr2: 0.3, th2: 20 }]],
    figs: [[0.45, L('一个氢键的能量随距离的变化（不同角度偏差）；点是现在的基团 1。', 'The energy of one hydrogen bond against distance at several angles; the dot is the current group 1.')], ['html', L('三个基团各自的贡献。', 'What each of the three groups contributes.')]],
    note: L('玩具模型：12–10 势加 cos²θ 是分子力场里描述氢键的常见写法，参数是我们选的（理想距离 2.9 Å），不对应任何具体体系。真实的活性位点还有静电、去溶剂化、底物自身的应变和骨架的柔性，而且“摆歪”本身也会被骨架弛豫部分补偿——所以这里算出来的损失偏大。要看真实的数，读那几篇设计酶的论文和[反应动力学]栏目的过渡态理论。', 'A toy model: a 12–10 potential with a cos²θ angular term is the usual way force fields describe a hydrogen bond, and the parameters here (ideal distance 2.9 Å) are our choice and correspond to no particular system. A real active site also has electrostatics, desolvation, strain in the substrate itself and a flexible backbone, and the backbone partly relaxes to compensate a misplacement — so the loss computed here is an overestimate. For real numbers read the designed-enzyme papers and the transition-state theory in the reaction-kinetics section.'),
    draw(s, [pv, tv]) {
      const c = css(), r0 = 2.9, rs = lin(2.4, 4.4, 140);
      const line = (deg) => rs.map((r) => M.hbond(r, (deg * Math.PI) / 180, s.D, r0));
      plot(pv, { x: [2.4, 4.4], y: [-s.D * 1.15, s.D * 0.6], xl: L('氢键距离 (Å)', 'hydrogen-bond distance (Å)'), yl: L('能量 (kcal/mol)', 'energy (kcal/mol)'),
        series: [{ xs: rs, ys: line(0), color: c.gold, width: 2.4, label: L('角度正好', 'ideal angle') }, { xs: rs, ys: line(30), color: c.accent, width: 1.8, dash: [5, 4], label: '30°' }, { xs: rs, ys: line(60), color: c.ink2, width: 1.6, dash: [2, 3], label: '60°' }],
        marks: [{ x: r0 + s.dr1, y: M.hbond(r0 + s.dr1, (s.th1 * Math.PI) / 180, s.D, r0), color: c.info }] });
      const groups = [{ dr: s.dr1, dth: (s.th1 * Math.PI) / 180 }, { dr: s.dr2, dth: (s.th2 * Math.PI) / 180 }, { dr: 0, dth: 0 }];
      const a = M.activeSite(groups, 298.15, s.D, r0);
      tv.innerHTML = table([L('基团', 'Group'), L('距离 (Å)', 'Distance (Å)'), L('角度', 'Angle'), L('能量 (kcal/mol)', 'Energy (kcal/mol)')],
        groups.map((g, i) => [`${i + 1}`, fix(r0 + g.dr, 2), `${fix((g.dth * 180) / Math.PI, 0)}°`, fix(M.hbond(r0 + g.dr, g.dth, s.D, r0), 2)]));
      return [[L('现在的总稳定化', 'Stabilisation as placed'), `${fix(a.now, 2)} kcal/mol`],
        [L('完美摆放能有', 'If perfectly placed'), `${fix(a.ideal, 2)} kcal/mol`],
        [L('损失', 'Lost'), `${fix(a.lost, 2)} kcal/mol`, true],
        [L('速率只剩', 'Rate left'), `${a.factor < 0.01 ? sci(a.factor, 2) : pct(a.factor, 1)}`, true]];
    },
  };

  // ── 9. ee 和 ΔΔG‡ ──────────────────────────────────────────────────────
  DEMOS.ee = {
    title: L('98 % ee 有多难：对映选择性换成能量', 'How hard is 98 % ee: enantioselectivity as an energy'),
    kind: 'exact',
    intro: L('不对称催化报的是 ee（对映体过量），但催化剂真正要做的事是让两条通向不同手性的路径差出一点点自由能。换算是 ΔΔG‡ = RT ln[(1+ee)/(1−ee)]：50 % ee 只要 0.65 kcal/mol，90 % 要 1.74，99 % 要 3.14。也就是说从 90 % 做到 99 % 要再找 1.4 kcal/mol——而这正好是计算化学算不准的量级。顺便看温度：降温几乎总是提高 ee，但前提是 ΔΔH‡ 和 ΔΔS‡ 同号。', 'Asymmetric catalysis reports ee, but what the catalyst actually does is make two paths to opposite handedness differ by a little free energy. The conversion is ΔΔG‡ = RT ln[(1+ee)/(1−ee)]: 50 % ee needs only 0.65 kcal/mol, 90 % needs 1.74 and 99 % needs 3.14. Going from 90 % to 99 % therefore means finding another 1.4 kcal/mol — exactly the scale computational chemistry cannot resolve. The temperature panel shows the other half: cooling almost always raises ee, provided ΔΔH‡ and ΔΔS‡ have the same sign.'),
    ctl: [['ee', L('目标 ee', 'Target ee'), 0, 0.999, 0.001, 0.9, (v) => `${(100 * v).toFixed(1)} %`], ['T', L('温度 (K)', 'Temperature (K)'), 193, 373, 1, 298, (v) => `${v}`], ['dH', L('ΔΔH‡ (kcal/mol)', 'ΔΔH‡ (kcal/mol)'), 0, 5, 0.1, 2.2, (v) => `${v}`], ['dS', L('ΔΔS‡ (cal/mol·K)', 'ΔΔS‡ (cal/mol·K)'), -6, 6, 0.2, 1.5, (v) => `${v}`]],
    btn: [[L('一个好催化剂：98 % ee', 'A good catalyst: 98 % ee'), { ee: 0.98, T: 298 }], [L('勉强可用：90 %', 'Just usable: 90 %'), { ee: 0.9, T: 298 }], [L('药用标准：99.5 %', 'Pharma grade: 99.5 %'), { ee: 0.995, T: 253 }]],
    figs: [[0.45, L('ee 和 ΔΔG‡ 的换算（三个温度）；点是现在的设定。', 'The conversion between ee and ΔΔG‡ at three temperatures; the dot is the current setting.')], [0.42, L('同一个催化剂（固定 ΔΔH‡ 和 ΔΔS‡）在不同温度下的 ee。', 'The ee of one catalyst (fixed ΔΔH‡ and ΔΔS‡) against temperature.')]],
    note: L('ΔΔG‡ = RT ln(er)，er = (1+ee)/(1−ee)，只假设两条路径各自是一步、共用同一个前因子。温度那张图用 ΔΔG‡ = ΔΔH‡ − TΔΔS‡ 外推，真实体系里机理可能随温度变（等动力学温度附近尤其靠不住），所以外推不要拉太远。ee 的测量本身也有误差，99 % 和 99.5 % 在手性柱上常常分不清楚。', 'ΔΔG‡ = RT ln(er) with er = (1+ee)/(1−ee), assuming only that each path is one step and that they share a prefactor. The temperature panel extrapolates with ΔΔG‡ = ΔΔH‡ − TΔΔS‡; in a real system the mechanism can change with temperature (especially near an isokinetic temperature), so do not extrapolate far. Measuring ee has its own error, and 99 % against 99.5 % is often beyond what a chiral column resolves.'),
    draw(s, [pv, tvv]) {
      const c = css(), ees = lin(0, 0.999, 200);
      const curve = (T) => ees.map((e) => M.eeToDdG(e, T));
      plot(pv, { x: [0, 1], y: [0, 5], xl: L('ee', 'ee'), yl: L('ΔΔG‡ (kcal/mol)', 'ΔΔG‡ (kcal/mol)'), xf: (t) => `${Math.round(100 * t)} %`,
        series: [{ xs: ees, ys: curve(s.T), color: c.gold, width: 2.4, label: L(`现在 ${s.T} K`, `current ${s.T} K`) }, { xs: ees, ys: curve(298.15), color: c.ink2, width: 1.8, dash: [5, 4], label: '298 K' }, { xs: ees, ys: curve(195), color: c.info, width: 1.8, dash: [2, 3], label: '195 K' }],
        marks: [{ x: s.ee, y: M.eeToDdG(s.ee, s.T), color: c.accent }] });
      const Ts = lin(193, 373, 120);
      plot(tvv, { x: [193, 373], y: [0, 1], xl: L('温度 (K)', 'temperature (K)'), yl: 'ee', yf: (t) => `${Math.round(100 * t)} %`,
        series: [{ xs: Ts, ys: Ts.map((T) => M.eeAtT(s.dH, s.dS, T)), color: c.gold, width: 2.4, label: L('同一个催化剂', 'the same catalyst') }],
        marks: [{ x: s.T, y: M.eeAtT(s.dH, s.dS, s.T), color: c.accent }], hmarks: [{ y: 0.99, color: c.muted }] });
      const dd = M.eeToDdG(s.ee, s.T);
      return [[L('需要的 ΔΔG‡', 'Required ΔΔG‡'), `${fix(dd, 3)} kcal/mol`, true],
        [L('两条路径的速率比 er', 'Rate ratio of the two paths, er'), `${fix(M.erOf(s.ee), 1)} : 1`],
        [L('再往上到 99.5 % 还要多少', 'Extra needed to reach 99.5 %'), `${fix(Math.max(0, M.eeToDdG(0.995, s.T) - dd), 3)} kcal/mol`, true],
        [L('这个催化剂在 195 K 的 ee', 'This catalyst’s ee at 195 K'), pct(M.eeAtT(s.dH, s.dS, 195), 2)]];
    },
  };

  // ── 10. 孔里的富集 ─────────────────────────────────────────────────────
  DEMOS.langmuir = {
    title: L('孔里的浓度：Langmuir 等温线和受限空间的富集', 'Concentration inside a pore: the Langmuir isotherm and confinement'),
    kind: 'exact',
    intro: L('MOF、沸石和多孔有机笼的催化有一半靠“把底物吸进来”。吸附自由能每多 1.36 kcal/mol，孔内外的浓度比就差十倍；对一个二级反应来说，速率差一百倍。但吸附太强又会堵住孔——Langmuir 等温线在高压下饱和，正是这件事的数学。', 'Half of what MOFs, zeolites and porous organic cages do as catalysts is pull the substrate in. Every extra 1.36 kcal/mol of adsorption free energy is a tenfold concentration ratio between pore and bulk, and for a second-order reaction a hundredfold in rate. But bind too strongly and the pore clogs — the saturation of the Langmuir isotherm at high pressure is the mathematics of exactly that.'),
    ctl: [['dG', L('吸附自由能 ΔG_ads (kcal/mol)', 'Adsorption free energy ΔG_ads (kcal/mol)'), -12, 0, 0.1, -4, (v) => `${v}`], ['lgc', L('本体浓度 lg c (M)', 'bulk concentration lg c (M)'), -5, 0, 0.1, -2, (v) => `10^${v} M`], ['T', L('温度 (K)', 'Temperature (K)'), 253, 473, 5, 298, (v) => `${v}`]],
    btn: [[L('刚好：中等吸附', 'Just right: moderate adsorption'), { dG: -4, lgc: -2, T: 298 }], [L('太弱，进不来', 'Too weak: nothing comes in'), { dG: -1, lgc: -2, T: 298 }], [L('太强，孔被堵住', 'Too strong: the pore is clogged'), { dG: -10, lgc: -2, T: 298 }]],
    figs: [[0.45, L('Langmuir 等温线：孔的占有率随本体浓度的变化（三种吸附强度）。', 'Langmuir isotherms: pore occupancy against bulk concentration at three adsorption strengths.')], [0.42, L('二级反应在孔内相对本体的加速倍数随吸附强度的变化：先升后降。', 'The rate enhancement of a second-order reaction inside the pore against adsorption strength: up, then down.')]],
    note: L('Langmuir 模型假设位点等价、互不影响、每个位点最多一个分子；分配系数按 K_p = exp(−ΔG_ads/RT) 算。“先升后降”里的下降来自占有率饱和：两个反应物要同时在孔里，吸附太强时孔被第一个分子占满，第二个进不来。真实的多孔催化剂还有扩散限制、孔口效应和吸附热随覆盖度变化（Temkin、Freundlich 等更合适的等温线），这里都没有。', 'The Langmuir model assumes equivalent, non-interacting sites with at most one molecule each, and the partition coefficient is K_p = exp(−ΔG_ads/RT). The downturn in the second panel comes from saturation: both reactants have to be inside at once, and if adsorption is too strong the first molecule fills the pore and the second cannot get in. Real porous catalysts also have diffusion limitation, pore-mouth effects and a heat of adsorption that changes with coverage (Temkin or Freundlich isotherms fit better); none of that is here.'),
    draw(s, [pv, rv]) {
      const c = css(), lgs = lin(-7, 1, 160), T = s.T;
      const iso = (dG) => lgs.map((x) => M.langmuir(10 ** x, M.enrichment(dG, T)));
      plot(pv, { x: [-7, 1], y: [0, 1.05], xl: L('本体浓度 lg c (M)', 'bulk concentration lg c (M)'), yl: L('孔的占有率 θ', 'pore occupancy θ'),
        series: [{ xs: lgs, ys: iso(s.dG), color: c.gold, width: 2.4, label: L('现在的 ΔG_ads', 'current ΔG_ads') }, { xs: lgs, ys: iso(-2), color: c.ink2, width: 1.8, dash: [5, 4], label: '−2 kcal/mol' }, { xs: lgs, ys: iso(-8), color: c.info, width: 1.8, dash: [2, 3], label: '−8 kcal/mol' }],
        marks: [{ x: s.lgc, y: M.langmuir(10 ** s.lgc, M.enrichment(s.dG, T)), color: c.accent }] });
      const dGs = lin(-12, 0, 140), cB = 10 ** s.lgc;
      const gain = (dG) => { const th = M.langmuir(cB, M.enrichment(dG, T)); return (th * (1 - th) * M.enrichment(dG, T)) / 0.25; };
      const ys = dGs.map(gain);
      plot(rv, { x: [-12, 0], y: [0, Math.max(...ys) * 1.1], xl: L('ΔG_ads (kcal/mol)', 'ΔG_ads (kcal/mol)'), yl: L('相对加速（任意单位）', 'relative rate (arbitrary units)'),
        series: [{ xs: dGs, ys, color: c.gold, width: 2.4, label: L('孔内二级反应', 'second order inside the pore') }],
        marks: [{ x: s.dG, y: gain(s.dG), color: c.accent }] });
      const Kp = M.enrichment(s.dG, T), th = M.langmuir(cB, Kp);
      const best = dGs[ys.indexOf(Math.max(...ys))];
      return [[L('分配系数 K_p', 'Partition coefficient K_p'), sci(Kp, 2), true],
        [L('孔内浓度比本体高', 'Concentration inside, relative to bulk'), `${sci(Kp, 2)} ×`],
        [L('现在的占有率', 'Current occupancy'), pct(th)],
        [L('这个本体浓度下最好的吸附强度', 'Best adsorption strength at this bulk concentration'), `${fix(best, 1)} kcal/mol`, true]];
    },
  };

  // ── 11. 火山图 ─────────────────────────────────────────────────────────
  DEMOS.volcano = {
    title: L('Sabatier 原理：为什么最好的催化剂在山顶上', 'The Sabatier principle: why the best catalyst sits on top of the hill'),
    kind: 'toy',
    intro: L('催化剂和反应物的结合不能太弱（吸不上来）也不能太强（放不出去）。把这两条线性自由能关系画在一起，决速的总是高的那个垒，于是活性对吸附能的曲线是一座山——这就是多相催化和单原子催化里到处在用的火山图。山顶的位置只由两条线的斜率和截距决定，有闭式解。', 'A catalyst must not bind its reactant too weakly (nothing sticks) or too strongly (nothing leaves). Draw the two linear free-energy relations together, let the larger barrier decide the rate, and activity against adsorption energy is a hill — the volcano plot that heterogeneous and single-atom catalysis use everywhere. Where the summit sits depends only on the slopes and intercepts of the two lines, and has a closed form.'),
    ctl: [['x', L('这个催化剂的 ΔG_ads (eV)', 'ΔG_ads of this catalyst (eV)'), -2, 2, 0.05, -0.8, (v) => `${v}`], ['a1', L('吸附这一步的 BEP 斜率', 'BEP slope of the adsorption step'), 0.1, 1, 0.05, 0.5, (v) => `${v}`], ['a2', L('脱附这一步的 BEP 斜率', 'BEP slope of the desorption step'), 0.1, 1, 0.05, 0.5, (v) => `${v}`], ['T', L('温度 (K)', 'Temperature (K)'), 300, 800, 10, 500, (v) => `${v}`]],
    btn: [[L('山顶上', 'On the summit'), { x: -0.3, a1: 0.5, a2: 0.5 }], [L('结合太强', 'Binding too strong'), { x: -1.6, a1: 0.5, a2: 0.5 }], [L('结合太弱', 'Binding too weak'), { x: 1.2, a1: 0.5, a2: 0.5 }]],
    figs: [[0.45, L('火山图：TOF 随吸附能的变化；两条虚线是两步各自的垒，交点就是山顶。', 'The volcano: TOF against adsorption energy; the dashed lines are the two barriers and they cross at the summit.')]],
    note: L('玩具模型：两个表观垒各自对吸附能线性（Brønsted–Evans–Polanyi 关系），TOF = (k_BT/h)·exp(−max(两个垒)/RT)。真实的火山图用的是 DFT 算出来的吸附能和实测的活性，而且常常用两个描述符画成二维的；这里的截距和斜率是我们选的，只用来说明形状。把活性和吸附能联系起来的更细的做法见[反应动力学与过渡态]栏目的能量跨度模型。', 'A toy model: two apparent barriers, each linear in the adsorption energy (a Brønsted–Evans–Polanyi relation), with TOF = (k_BT/h)·exp(−max(barriers)/RT). Real volcano plots use DFT adsorption energies and measured activities, and are often drawn in two descriptors; the slopes and intercepts here are our choice and only illustrate the shape. The finer way of linking activity to binding is the energy-span model in the reaction-kinetics section.'),
    draw(s, [pv]) {
      const c = css(), p = { a1: s.a1, a2: s.a2, T: s.T }, xs = lin(-2.5, 2.5, 200);
      const tof = xs.map((x) => M.volcanoTOF(x, p).logTOF);
      const peak = M.volcanoPeak(p), top = M.volcanoTOF(peak, p), now = M.volcanoTOF(s.x, p);
      plot(pv, { x: [-2.5, 2.5], y: [Math.min(...tof), top.logTOF + 1], xl: L('吸附自由能 ΔG_ads (eV)', 'adsorption free energy ΔG_ads (eV)'), yl: L('lg TOF (s⁻¹)', 'lg TOF (s⁻¹)'),
        series: [{ xs, ys: tof, color: c.gold, width: 2.6, label: L('TOF', 'TOF') },
          { xs, ys: xs.map((x) => Math.log10(M.KB_H * s.T) - (Math.max(0, 1.1 + s.a1 * x) * M.EV_KCAL) / (M.R_KCAL * s.T * Math.LN10)), color: c.info, width: 1.5, dash: [4, 4], label: L('只看吸附这一步', 'adsorption step alone') },
          { xs, ys: xs.map((x) => Math.log10(M.KB_H * s.T) - (Math.max(0, 0.8 - s.a2 * x) * M.EV_KCAL) / (M.R_KCAL * s.T * Math.LN10)), color: c.accent, width: 1.5, dash: [2, 3], label: L('只看脱附这一步', 'desorption step alone') }],
        marks: [{ x: s.x, y: now.logTOF, color: c.gold }, { x: peak, y: top.logTOF, color: c.ink2 }] });
      return [[L('山顶在哪', 'Where the summit is'), `ΔG_ads = ${fix(peak, 2)} eV`, true],
        [L('这个催化剂离山顶', 'This catalyst is off the summit by'), `${fix(Math.abs(s.x - peak), 2)} eV`],
        [L('决速的是哪一步', 'Which step is rate-limiting'), now.limiting === 1 ? L('吸附和活化', 'adsorption and activation') : L('表面反应和脱附', 'surface reaction and desorption'), true],
        [L('比山顶慢多少', 'How much slower than the summit'), `${sci(10 ** (top.logTOF - now.logTOF), 2)} ×`]];
    },
  };

  // ── 12. 标度关系 ───────────────────────────────────────────────────────
  DEMOS.scaling = {
    title: L('标度关系：为什么所有人都卡在 0.37 V', 'Scaling relations: why everybody is stuck at 0.37 V'),
    kind: 'exact',
    intro: L('析氧反应要经过 *OH、*O、*OOH 三个中间体。麻烦在于 *OH 和 *OOH 结合到同一个位点上、用同一种化学键，所以它们的吸附能被锁在一起：ΔG_OOH ≈ ΔG_OH + 3.2 eV，在几十种氧化物上都成立。四步各自不能超过 1.23 eV，而这条锁死的关系让最好的情况也要 3.2/2 − 1.23 = 0.37 V 过电位。拖动两个吸附能试试：只要标度关系不破，你永远下不去 0.37 V。', 'The oxygen-evolution reaction passes through *OH, *O and *OOH. The trouble is that *OH and *OOH bind to the same site through the same kind of bond, so their adsorption energies are locked together: ΔG_OOH ≈ ΔG_OH + 3.2 eV, on dozens of oxides. No step may exceed 1.23 eV, and that locked relation makes even the best case cost 3.2/2 − 1.23 = 0.37 V of overpotential. Drag the two adsorption energies: as long as the scaling holds, you never get below 0.37 V.'),
    ctl: [['dGOH', L('ΔG_OH (eV)', 'ΔG_OH (eV)'), 0.2, 2.6, 0.02, 1.0, (v) => `${v}`], ['dGO', L('ΔG_O (eV)', 'ΔG_O (eV)'), 1.0, 4.4, 0.02, 2.4, (v) => `${v}`], ['sc', L('标度关系的常数 Δ (eV)', 'Scaling constant Δ (eV)'), 2.4, 3.6, 0.02, 3.2, (v) => `${v}`]],
    btn: [[L('最好的情况（标度关系锁着）', 'The best case under scaling'), { dGOH: 1.23, dGO: 2.46, sc: 3.2 }], [L('IrO₂ 一类', 'Something like IrO₂'), { dGOH: 0.9, dGO: 2.3, sc: 3.2 }], [L('假如能把 Δ 推到 2.46', 'If Δ could be pushed to 2.46'), { dGOH: 1.23, dGO: 2.46, sc: 2.46 }]],
    figs: [[0.45, L('四步的自由能台阶：红线是 1.23 eV（理想），超出的部分就是过电位。', 'The four free-energy steps: the line at 1.23 eV is ideal, and whatever sticks out above it is the overpotential.')], [0.42, L('过电位随 ΔG_OH 的变化；横虚线是标度关系给的下限。', 'Overpotential against ΔG_OH; the dashed line is the floor set by the scaling relation.')]],
    note: L('四个电化学步骤的自由能差之和固定为 4.92 eV（水分解成氧气的热力学），每一步的自由能差超过 1.23 eV 的部分就是过电位。标度关系 ΔG_OOH = ΔG_OH + Δ 是在大量金属氧化物表面上拟合出来的经验关系（Δ ≈ 3.2 eV，散布约 ±0.2 eV），不是定理；用三维位点、分子催化剂、非共价作用或者质子–电子解耦都可能破坏它，这正是这个领域在找的出路。这里不含动力学，只算热力学的下限。', 'The four electrochemical steps sum to a fixed 4.92 eV (the thermodynamics of splitting water to oxygen), and whatever any single step carries above 1.23 eV is the overpotential. The scaling relation ΔG_OOH = ΔG_OH + Δ is an empirical fit across many metal-oxide surfaces (Δ ≈ 3.2 eV with a spread of about ±0.2 eV), not a theorem; three-dimensional sites, molecular catalysts, non-covalent interactions and proton–electron decoupling can all break it, which is exactly what the field is looking for. There is no kinetics here, only the thermodynamic floor.'),
    draw(s, [pv, ov]) {
      const c = css(), r = M.oerSteps(s.dGOH, s.dGO, s.sc);
      const labs = ['H₂O → *OH', '*OH → *O', '*O → *OOH', '*OOH → O₂'];
      plot(pv, { x: [-0.6, 3.6], y: [0, Math.max(2.2, Math.max(...r.steps) * 1.2)], xt: [0, 1, 2, 3], xf: (t) => labs[t] || '', yl: L('每一步的 ΔG (eV)', 'ΔG of each step (eV)'),
        series: [{ xs: [0, 1, 2, 3], ys: r.steps, color: c.gold, bars: 0.6, base: 0, label: L('四步', 'the four steps') }],
        hmarks: [{ y: 1.23, color: c.danger }],
        texts: [{ s: L('理想 1.23 eV', 'ideal 1.23 eV'), x: -0.5, y: 1.3, color: c.danger }] });
      const xs = lin(0.2, 2.6, 160);
      const etas = xs.map((x) => M.oerSteps(x, x + (s.dGO - s.dGOH), s.sc).eta);
      plot(ov, { x: [0.2, 2.6], y: [0, Math.max(1.6, Math.max(...etas) * 1.05)], xl: L('ΔG_OH (eV)', 'ΔG_OH (eV)'), yl: L('过电位 η (V)', 'overpotential η (V)'),
        series: [{ xs, ys: etas, color: c.gold, width: 2.4, label: L('标度关系锁着', 'under the scaling relation') }],
        hmarks: [{ y: M.oerLimit(s.sc), color: c.info }], marks: [{ x: s.dGOH, y: r.eta, color: c.accent }] });
      return [[L('过电位', 'Overpotential'), `${fix(r.eta, 3)} V`, true],
        [L('决速的是哪一步', 'Which step limits'), labs[r.limiting]],
        [L('这个 Δ 给的下限', 'The floor set by this Δ'), `${fix(M.oerLimit(s.sc), 3)} V`, true],
        [L('ΔG_OOH（被锁死的）', 'ΔG_OOH (locked)'), `${fix(r.dGOOH, 2)} eV`]];
    },
  };

  // ── 13. 纳米颗粒的每位点活性 ───────────────────────────────────────────
  DEMOS.nano = {
    title: L('纳米酶的数字怎么读：按颗粒算还是按位点算', 'Reading nanozyme numbers: per particle or per site'),
    kind: 'exact',
    intro: L('纳米酶的论文常常报“k_cat 比辣根过氧化物酶高几十倍”，但那个 k_cat 是按一个颗粒算的。一个 20 nm 的铂颗粒有几万个表面原子，每个都可能是活性位点；按位点算回去，往往就低于天然酶了。这不是说纳米酶没用（它便宜、耐热、好回收），而是说这两个数不能直接比。拖动粒径看表面原子数、分散度和每位点活性怎么变。', 'Nanozyme papers often report a k_cat tens of times that of horseradish peroxidase — but that k_cat is per particle. A 20 nm platinum particle has tens of thousands of surface atoms, any of which may be a site, and divided back out per site the number usually falls below the natural enzyme. This does not make nanozymes useless (they are cheap, robust and recoverable), it means the two numbers are not comparable as printed. Drag the diameter and watch the surface atom count, the dispersion and the per-site activity move.'),
    sel: [['mat', L('材料', 'Material'), [['pt', L('铂（21.45 g/cm³，195.1）', 'Platinum (21.45 g/cm³, 195.1)')], ['au', L('金（19.3 g/cm³，197.0）', 'Gold (19.3 g/cm³, 197.0)')], ['fe3o4', L('四氧化三铁（5.17 g/cm³，231.5）', 'Magnetite (5.17 g/cm³, 231.5)')], ['ceo2', L('二氧化铈（7.22 g/cm³，172.1）', 'Ceria (7.22 g/cm³, 172.1)')]], 'pt']],
    ctl: [['d', L('颗粒直径 (nm)', 'Particle diameter (nm)'), 1, 50, 0.5, 10, (v) => `${v} nm`], ['lgk', L('按颗粒算的 k_cat（10 的几次方 s⁻¹）', 'k_cat per particle (powers of ten, s⁻¹)'), 0, 6, 0.1, 4, (v) => `10^${v} s⁻¹`], ['frac', L('表面原子里真正有活性的比例', 'Fraction of surface atoms that are active'), 0.001, 1, 0.001, 1, (v) => pct(v, 1)]],
    btn: [[L('常见的报法：按颗粒', 'The usual claim: per particle'), { d: 10, lgk: 4, frac: 1 }], [L('小颗粒', 'A small particle'), { d: 2, lgk: 4, frac: 1 }], [L('只有台阶和顶角有活性', 'Only steps and corners are active'), { d: 10, lgk: 4, frac: 0.05 }]],
    figs: [[0.45, L('表面原子数和分散度随粒径的变化（对数纵轴）。', 'Surface atom count and dispersion against diameter (log scale).')], ['html', L('和一个天然酶（辣根过氧化物酶，k_cat 约 10³ s⁻¹）对比。', 'Compared with a natural enzyme (horseradish peroxidase, k_cat ≈ 10³ s⁻¹).')]],
    note: L('表面原子数按球面积乘以表面位点密度（取 15 nm⁻²，金属常见的量级）算，总原子数按体相密度算，所以分散度 = 表面 / 总数。这是数量级的估算，真实颗粒有形状、小面、台阶和缺陷，位点密度和活性都不均匀。拿来比的 k_cat ≈ 10³ s⁻¹ 是辣根过氧化物酶的常见量级（底物和条件不同会差几倍），这里只用来看位置。要点不是“纳米酶不行”，而是“分母要写清楚”。', 'The surface atom count is the sphere’s area times a site density of 15 nm⁻², a typical metal value, and the total count comes from the bulk density, so dispersion is surface over total. This is an order-of-magnitude estimate: real particles have shapes, facets, steps and defects, with uneven site density and activity. The comparison value of k_cat ≈ 10³ s⁻¹ is the usual range for horseradish peroxidase (it varies severalfold with substrate and conditions) and is only here for position. The point is not that nanozymes do not work, it is that the denominator has to be stated.'),
    draw(s, [pv, tv]) {
      const c = css();
      const MAT = { pt: [21.45, 195.08, L('铂', 'platinum')], au: [19.3, 196.97, L('金', 'gold')], fe3o4: [5.17, 231.53, L('四氧化三铁', 'magnetite')], ceo2: [7.22, 172.11, L('二氧化铈', 'ceria')] };
      const [rho, Mw, nm] = MAT[s.mat] || MAT.pt;
      const ds = lin(1, 50, 120);
      const surf = ds.map((d) => Math.log10(M.particle(d, rho, Mw, 15).surface));
      const tot = ds.map((d) => Math.log10(M.particle(d, rho, Mw, 15).total));
      plot(pv, { x: [1, 50], y: [0, Math.max(...tot) * 1.05], xl: L('直径 (nm)', 'diameter (nm)'), yl: L('lg（原子数）', 'lg(atoms)'),
        series: [{ xs: ds, ys: tot, color: c.ink2, width: 2.2, label: L('总原子数', 'all atoms') }, { xs: ds, ys: surf, color: c.gold, width: 2.4, label: L('表面原子数', 'surface atoms') }],
        marks: [{ x: s.d, y: Math.log10(M.particle(s.d, rho, Mw, 15).surface), color: c.accent }] });
      const P = M.particle(s.d, rho, Mw, 15), kPart = 10 ** s.lgk, sites = Math.max(1, P.surface * s.frac);
      const per = M.perSite(kPart, sites), HRP = 1e3;
      tv.innerHTML = table([L('按什么算', 'Per what'), L('k_cat (s⁻¹)', 'k_cat (s⁻¹)'), L('和辣根过氧化物酶比', 'Against horseradish peroxidase')], [
        [L('一个颗粒', 'One particle'), sci(kPart, 2), `${sci(kPart / HRP, 2)} ×`],
        [L('一个表面原子', 'One surface atom'), sci(kPart / P.surface, 2), `${sci(kPart / P.surface / HRP, 2)} ×`],
        [L('一个活性位点', 'One active site'), sci(per, 2), `${sci(per / HRP, 2)} ×`],
      ]);
      return [[L(`${nm} 颗粒的总原子数`, `Atoms in the ${nm} particle`), sci(P.total, 2)],
        [L('表面原子数', 'Surface atoms'), sci(P.surface, 2), true],
        [L('分散度', 'Dispersion'), pct(P.dispersion)],
        [L('按位点算，和天然酶比', 'Per site, against the natural enzyme'), `${sci(per / HRP, 2)} ×`, true]];
    },
  };

  // ── 14. 筛选的通量 ─────────────────────────────────────────────────────
  DEMOS.screen = {
    title: L('原位筛选为什么值得：同样的时间能测多少个', 'Why in situ screening pays: how many you can test in the same time'),
    kind: 'experiment',
    intro: L('那篇论文最实在的一条贡献不是机器学习，而是把“合成—分离—表征—测试”四步压成在溶液里现组装现测。每个候选从几周变成几天，同样的时间里能测的笼从几个变成几十个。这件事的后果可以算：如果活性在对数尺度上近似正态分布，测 n 个里最好的那个的期望值随 lg n 增长；而“至少撞上一个超过门槛的”的概率是 1 − (1 − p)ⁿ。拖动看两条流程的差别。', 'The most practical contribution of that paper is not the machine learning, it is collapsing “prepare, isolate, characterise, test” into assembling and measuring in solution. Each candidate goes from weeks to days, and the number of cages testable in the same time goes from a handful to dozens. The consequence is computable: if activity is roughly normal on a log scale, the expected best of n grows with lg n, and the chance of hitting at least one above a threshold is 1 − (1 − p)ⁿ. Drag to compare the two workflows.'),
    ctl: [['days', L('一共有多少天', 'Days available'), 30, 720, 10, 365, (v) => `${v}`], ['slow', L('老流程每个要几天', 'Days per candidate, old route'), 5, 60, 1, 21, (v) => `${v}`], ['fast', L('原位流程每个要几天', 'Days per candidate, in situ'), 0.5, 20, 0.5, 3, (v) => `${v}`], ['thr', L('算“命中”的门槛（高出平均几个标准差）', 'Hit threshold (standard deviations above the mean)'), 0.5, 4, 0.1, 2, (v) => `${v}σ`]],
    btn: [[L('论文那样的一年', 'A year, as in the paper'), { days: 365, slow: 21, fast: 3, thr: 2 }], [L('只有三个月', 'Only three months'), { days: 90, slow: 21, fast: 3, thr: 2 }], [L('要找一个很罕见的笼', 'Hunting something rare'), { days: 365, slow: 21, fast: 3, thr: 3.5 }]],
    figs: [[0.45, L('测 n 个里最好的那个的期望活性（以标准差为单位）；两条竖线是两种流程能测的数量。', 'The expected best of n, in standard deviations; the two vertical lines are what each workflow can test.')], ['html', L('两条流程的对比。', 'The two workflows side by side.')]],
    note: L('用的是正态分布的次序统计量：E[max of n] = n∫zφ(z)Φ(z)ⁿ⁻¹dz，数值积分算出来的（n = 2 时正好是 1/√π ≈ 0.5642，可以核对）。假设每个候选的活性独立同分布、都测得准、门槛固定——现实里候选之间相关（同一个家族），而且“测得快”常常意味着测得粗，所以这是一个上限式的估计。真正的意义在数量级：n 从 5 变成 100，期望最好的那个只涨约 1.3 个标准差，但“至少撞上一个”的概率可能从 10 % 跳到 90 %。', 'This uses the order statistics of a normal: E[max of n] = n∫zφ(z)Φ(z)ⁿ⁻¹dz, integrated numerically (at n = 2 it is exactly 1/√π ≈ 0.5642, which can be checked). It assumes candidates are independent and identically distributed, all measured accurately, against a fixed threshold — in reality candidates within one family are correlated, and measuring fast often means measuring crudely, so this is an optimistic bound. The meaning is in the orders of magnitude: going from 5 to 100 candidates raises the expected best by only about 1.3 standard deviations, but the chance of hitting at least one can jump from 10 % to 90 %.'),
    draw(s, [pv, tv]) {
      const c = css();
      const ns = Array.from({ length: 60 }, (_, i) => Math.round(10 ** (i / 59 * 2.7)));
      const ys = memo(s, 'best', 'x', () => ns.map((n) => M.expectedBestZ(n)));
      const slow = M.screen({ daysEach: s.slow, days: s.days, mu: 0, sigma: 1, threshold: s.thr });
      const fast = M.screen({ daysEach: s.fast, days: s.days, mu: 0, sigma: 1, threshold: s.thr });
      plot(pv, { x: [0, 2.7], y: [0, 3.6], xl: L('测了多少个（lg n）', 'candidates tested (lg n)'), yl: L('最好的那个（σ）', 'the best one (σ)'), xf: (t) => `10${t === 0 ? '' : ''}${t ? `^${t}` : ''}`,
        series: [{ xs: ns.map((n) => Math.log10(n)), ys, color: c.gold, width: 2.6, label: L('期望最好值', 'expected best') }],
        marks: [{ x: Math.log10(slow.n), y: slow.best, color: c.ink2 }, { x: Math.log10(fast.n), y: fast.best, color: c.accent }],
        hmarks: [{ y: s.thr, color: c.danger }] });
      tv.innerHTML = table([L('流程', 'Workflow'), L('能测几个', 'Candidates'), L('最好的那个 (σ)', 'Best one (σ)'), L('至少命中一个', 'At least one hit')], [
        [L('合成—分离—表征—测试', 'Prepare, isolate, characterise, test'), String(slow.n), fix(slow.best, 2), pct(slow.pAny)],
        [L('原位现组装现测', 'Assemble and measure in situ'), String(fast.n), fix(fast.best, 2), pct(fast.pAny)],
      ]);
      return [[L('老流程能测', 'Old route tests'), `${slow.n} ${L('个', '')}`],
        [L('原位流程能测', 'In situ tests'), `${fast.n} ${L('个', '')}`, true],
        [L('最好的那个高多少', 'The best one is better by'), `${fix(fast.best - slow.best, 2)} σ`],
        [L('命中率从', 'Chance of a hit'), `${pct(slow.pAny)} → ${pct(fast.pAny)}`, true]];
    },
  };
};
