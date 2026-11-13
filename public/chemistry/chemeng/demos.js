'use strict';
// 化学学科馆 14 · 化学工程的三个演示：CSTR、PFR 和串联釜、理想溶液的 T–x–y 图、McCabe–Thiele 作图。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, plot } = K;
  const P = (v) => `${fix(v * 100, 1)} %`;

  // ── 理想反应器 ──────────────────────────────────────────────────────────
  // N 个等体积 CSTR 串联，总 Da 相同；一级用解析式，二级逐釜解二次方程（c 以进料浓度为 1）
  const tanks = (Da, N, n) => {
    if (n === 1) return M.tanksX(Da, N);
    const a = Da / N; let c = 1;
    for (let i = 0; i < N; i++) c = (-1 + Math.sqrt(1 + 4 * a * c)) / (2 * a);
    return 1 - c;
  };
  D.reactors = {
    kind: 'exact',
    title: ['CSTR、PFR 和串联釜', 'CSTR, PFR and tanks in series'],
    intro: ['调 Damköhler 数（反应速率 × 停留时间），比较三种反应器的转化率；右边的 Levenspiel 图里，CSTR 需要的体积是矩形面积，PFR 是曲线下的面积。', 'Adjust the Damköhler number (rate × residence time) to compare conversions in the three reactor types; in the Levenspiel plot on the right, the CSTR volume is the rectangle and the PFR volume the area under the curve.'],
    sel: [['n', ['反应级数', 'Reaction order'], [[1, ['一级', 'first order']], [2, ['二级', 'second order']]], 1]],
    ctl: [['lD', ['Damköhler 数 lg Da', 'Damköhler number lg Da'], -1, 2, 0.01, Math.log10(2), (v) => `Da = ${fmt(10 ** v, 3)}`], ['N', ['串联的釜数', 'Tanks in series'], 1, 20, 1, 3, (v) => String(v)]],
    btn: [[['例题：Da = 2，一级', 'Worked example: Da = 2, first order'], { n: 1, lD: Math.log10(2), N: 3 }], [['高转化率', 'High conversion'], { lD: Math.log10(20), N: 5 }], [['二级反应', 'Second order'], { n: 2, lD: Math.log10(5), N: 3 }], [['多釜逼近 PFR', 'Many tanks approach a PFR'], { n: 1, lD: Math.log10(5), N: 20 }]],
    figs: [[0.6, ['转化率对 Da（对数横轴）。金线是当前的 Da。', 'Conversion against Da (log axis). Gold: the current Da.']], [0.6, ['Levenspiel 图：1/(−r_A) 对 X（以进料速率为 1）。到 PFR 的转化率为止，浅色矩形是 CSTR 需要的体积，深色是 PFR 需要的体积。', 'Levenspiel plot: 1/(−r_A) against X (feed rate taken as 1). Up to the PFR’s conversion, the light rectangle is the CSTR volume needed and the dark area the PFR volume.']]],
    note: ['等温、恒密度、单一反应 A → 产物，速率 −r_A = k c_A^n；Da = kτc₀^{n−1}。CSTR 和 PFR 用解析解；串联釜每个釜的空时是 τ/N，一级反应用 X = 1 − (1 + Da/N)^{−N}，二级反应逐釜解二次方程。真实反应器还有不等温、密度变化、非理想混合（见停留时间分布）和多个反应的选择性问题。', 'Isothermal, constant density, a single reaction A → products with rate −r_A = k c_A^n; Da = kτc₀^{n−1}. CSTR and PFR use analytical solutions; each tank in series has space time τ/N, with X = 1 − (1 + Da/N)^{−N} for first order and a quadratic solved tank by tank for second order. Real reactors add non-isothermal behaviour, density changes, non-ideal mixing (see residence-time distributions) and selectivity among several reactions.'],
    draw(s, f, c) {
      const n = +s.n, Da = 10 ** s.lD, ds = K.lin(-1, 2, 151).map((v) => 10 ** v);
      plot(f[0], { x: [-1, 2], logx: true, y: [0, 1.02], xl: 'Da', yl: 'X', series: [{ xs: ds, ys: ds.map((d) => M.cstrX(d, n)), color: c.danger, width: 2.4, label: 'CSTR' }, { xs: ds, ys: ds.map((d) => tanks(d, s.N, n)), color: c.gold, width: 2, dash: [6, 4], label: L(`${s.N} 釜串联`, `${s.N} tanks`) }, { xs: ds, ys: ds.map((d) => M.pfrX(d, n)), color: c.accent, width: 2.4, label: 'PFR' }], marks: [{ x: Da, color: c.gold }] });
      const xp = M.pfrX(Da, n), inv = (x) => 1 / (1 - x) ** n, xs = K.lin(0, 0.97, 200), top = Math.min(40, inv(Math.max(0.6, xp)) * 1.15);
      const cut = K.lin(0, xp, 100);
      plot(f[1], { x: [0, 1], y: [0, top], xl: 'X', yl: '1/(−r_A)', series: [{ pts: [[0, inv(xp)], [xp, inv(xp)]], color: c.danger, width: 1.5, fill: true, label: L('CSTR 体积', 'CSTR volume') }, { xs: cut, ys: cut.map(inv), color: c.accent, width: 1.5, fill: true, label: L('PFR 体积', 'PFR volume') }, { xs, ys: xs.map(inv), color: c.ink2 || c.accent, width: 2 }], marks: [{ x: xp, color: c.gold }] });
      const ratio = n === 1 ? xp / (1 - xp) / -Math.log(1 - xp) : xp / (1 - xp) ** 2 / (xp / (1 - xp));
      return [[['CSTR', 'CSTR'], P(M.cstrX(Da, n)), 1], [['PFR', 'PFR'], P(xp), 1], [[`${s.N} 釜串联`, `${s.N} tanks`], P(tanks(Da, s.N, n))], [['同转化率的体积比', 'Volume ratio'], `${fix(ratio, 2)} ×`]];
    },
  };

  // ── 理想溶液的 T–x–y 图 ─────────────────────────────────────────────────
  // Antoine 常数（lg P/mmHg = A − B/(T/°C + C)），常引值，编者录入
  const ANT = { benzene: [6.90565, 1211.033, 220.79], toluene: [6.95464, 1344.8, 219.482], hexane: [6.87601, 1171.17, 224.41], heptane: [6.89677, 1264.9, 216.544], oxylene: [6.99891, 1474.679, 213.686] };
  const NAME = { benzene: ['苯', 'benzene'], toluene: ['甲苯', 'toluene'], hexane: ['正己烷', 'n-hexane'], heptane: ['正庚烷', 'n-heptane'], oxylene: ['邻二甲苯', 'o-xylene'] };
  const SYS = { bt: ['benzene', 'toluene'], hh: ['hexane', 'heptane'], tx: ['toluene', 'oxylene'] };
  D.txy = {
    kind: 'exact',
    title: ['理想溶液的 T–x–y 图', 'The T–x–y diagram of an ideal solution'],
    intro: ['选一个双组分体系，调压力和液相组成，读出泡点温度和平衡气相组成。下面那条线是泡点线，上面是露点线，两线之间是两相区；气相总是比液相富含易挥发组分。', 'Pick a binary system and adjust pressure and liquid composition to read the bubble temperature and equilibrium vapour composition. The lower curve is the bubble-point line and the upper the dew-point line, with the two-phase region between; the vapour is always richer in the more volatile component.'],
    sel: [['sys', ['体系', 'System'], Object.entries(SYS).map(([k, [a, b]]) => [k, [`${NAME[a][0]}–${NAME[b][0]}`, `${NAME[a][1]}–${NAME[b][1]}`]]), 'bt']],
    ctl: [['P', ['压力', 'Pressure'], 200, 1520, 10, 760, (v) => `${v} mmHg（${fix(v / 760, 2)} atm）`], ['x', ['液相中易挥发组分的摩尔分数', 'Mole fraction of the lighter component in the liquid'], 0, 1, 0.01, 0.5, (v) => fix(v, 2)]],
    btn: [[['例题：苯–甲苯 1 atm，x = 0.5', 'Worked example: benzene–toluene, 1 atm, x = 0.5'], { sys: 'bt', P: 760, x: 0.5 }], [['减压到 0.3 atm', 'Reduced to 0.3 atm'], { P: 230 }], [['加压到 2 atm', 'Raised to 2 atm'], { P: 1520 }]],
    figs: [[0.62, ['T–x–y 图：蓝线是泡点线（液相组成 x），红线是露点线（气相组成 y），金色水平线连着平衡的两相。', 'T–x–y diagram: blue is the bubble-point line (liquid composition x), red the dew-point line (vapour composition y); the gold tie line joins the phases in equilibrium.']], [0.62, ['x–y 图：平衡线越远离对角线，越容易精馏分离。', 'x–y diagram: the further the equilibrium curve is from the diagonal, the easier the distillation.']]],
    note: ['按拉乌尔定律和 道尔顿定律计算（两相都理想），饱和蒸气压用 Antoine 方程。这三对都是结构相近的烃类，接近理想溶液；醇和水、丙酮和氯仿这类体系偏离很大，需要活度系数（NRTL 等），可能出现共沸物。Antoine 常数是常引值，由编者录入，未逐条复核，适用范围大约是每种物质正常沸点上下几十度。', 'Computed with Raoult’s and Dalton’s laws (both phases ideal) and Antoine vapour pressures. All three pairs are structurally similar hydrocarbons and close to ideal; systems such as alcohol–water or acetone–chloroform deviate strongly, need activity coefficients (NRTL and others) and may form azeotropes. Antoine constants are commonly quoted values typed by the editor and not rechecked, valid roughly within a few tens of degrees of each normal boiling point.'],
    draw(s, f, c) {
      const [a, b] = SYS[s.sys], A1 = ANT[a], A2 = ANT[b], xs = K.lin(0, 1, 101);
      const bub = xs.map((x) => M.bubbleT(x, s.P, A1, A2)), dew = xs.map((y) => M.dewT(y, s.P, A1, A2).T);
      const r = M.bubbleT(s.x, s.P, A1, A2), lo = Math.min(...bub.map((q) => q.T)), hi = Math.max(...dew);
      const pad = (hi - lo) * 0.08 + 1;
      plot(f[0], { x: [0, 1], y: [lo - pad, hi + pad], xl: `x, y（${L(NAME[a][0], NAME[a][1])}）`, yl: 'T / °C', series: [{ xs, ys: bub.map((q) => q.T), color: c.info, width: 2.4, label: L('泡点线', 'bubble') }, { xs, ys: dew, color: c.danger, width: 2.4, label: L('露点线', 'dew') }, { pts: [[s.x, r.T], [r.y1, r.T]], color: c.gold, width: 2, dots: 4, line: true }] });
      plot(f[1], { x: [0, 1], y: [0, 1], xl: 'x', yl: 'y', series: [{ xs: [0, 1], ys: [0, 1], color: c.faint, width: 1, dash: [4, 4] }, { xs: bub.map((_, i) => xs[i]), ys: bub.map((q) => q.y1), color: c.accent, width: 2.4 }], marks: [{ x: s.x, y: r.y1, color: c.gold }] });
      const alpha = M.antoine(r.T, A1) / M.antoine(r.T, A2), dw = M.dewT(s.x, s.P, A1, A2).T;
      return [[['泡点温度', 'Bubble point'], `${fix(r.T, 1)} °C`, 1], [['平衡气相 y', 'Vapour y'], fix(r.y1, 3), 1], [['同组成的露点', 'Dew point at same z'], `${fix(dw, 1)} °C`], [['相对挥发度 α', 'Relative volatility α'], fix(alpha, 2)], [[`${L(NAME[a][0], NAME[a][1])}沸点`, `${NAME[a][1]} b.p.`], `${fix(M.bubbleT(1, s.P, A1, A2).T, 1)} °C`], [[`${L(NAME[b][0], NAME[b][1])}沸点`, `${NAME[b][1]} b.p.`], `${fix(M.bubbleT(0, s.P, A1, A2).T, 1)} °C`]];
    },
  };

  // ── McCabe–Thiele ───────────────────────────────────────────────────────
  D.mccabe = {
    kind: 'exact',
    title: ['McCabe–Thiele 作图：精馏塔要几块板', 'McCabe–Thiele: how many stages a column needs'],
    intro: ['在 x–y 图上从塔顶组成开始，在平衡线和操作线之间画台阶，每一级台阶是一块理论板。调回流比，看板数怎样变：回流比降到最小回流比附近，台阶挤在夹点，板数趋于无穷。', 'Starting from the top composition on the x–y diagram, step between the equilibrium curve and the operating lines; each step is one theoretical stage. Adjust the reflux ratio to see the count change: near the minimum reflux the steps crowd into the pinch and the number of stages heads to infinity.'],
    sel: [['q', ['进料状态', 'Feed condition'], [[1, ['饱和液体（q = 1）', 'saturated liquid (q = 1)']], [0.5, ['一半汽化（q = 0.5）', 'half vapour (q = 0.5)']], [0, ['饱和蒸气（q = 0）', 'saturated vapour (q = 0)']]], 1]],
    ctl: [['a', ['相对挥发度 α', 'Relative volatility α'], 1.3, 5, 0.05, 2.5, (v) => fix(v, 2)], ['R', ['回流比 R', 'Reflux ratio R'], 0.3, 10, 0.05, 2, (v) => fix(v, 2)], ['xD', ['塔顶组成 x_D', 'Distillate x_D'], 0.8, 0.995, 0.005, 0.95, (v) => fix(v, 3)], ['xB', ['塔底组成 x_B', 'Bottoms x_B'], 0.005, 0.2, 0.005, 0.05, (v) => fix(v, 3)], ['zF', ['进料组成 z_F', 'Feed z_F'], 0.2, 0.8, 0.01, 0.5, (v) => fix(v, 2)]],
    btn: [[['例题：α = 2.5，R = 2', 'Worked example: α = 2.5, R = 2'], { a: 2.5, R: 2, xD: 0.95, xB: 0.05, zF: 0.5, q: 1 }], [['接近最小回流比', 'Near minimum reflux'], { a: 2.5, R: 1.2, xD: 0.95, xB: 0.05, zF: 0.5, q: 1 }], [['大回流比', 'High reflux'], { R: 8 }], [['难分离（α = 1.5）', 'Hard separation (α = 1.5)'], { a: 1.5, R: 5, xD: 0.95, xB: 0.05, zF: 0.5, q: 1 }], [['高纯度（99.5 %）', 'High purity (99.5 %)'], { a: 2.5, R: 3, xD: 0.995, xB: 0.005, zF: 0.5, q: 1 }]],
    figs: [[0.8, ['x–y 图：绿线是平衡线，红线是精馏段和提馏段操作线，灰色虚线是 q 线，金色台阶是理论板，蓝点依次是 x_B、z_F、x_D。', 'x–y diagram: green is the equilibrium curve, red the rectifying and stripping operating lines, grey dashed the q-line, and the gold steps the theoretical stages; blue dots mark x_B, z_F and x_D.']]],
    note: ['恒定相对挥发度、恒摩尔溢流（每块板上汽化和冷凝的摩尔数相等）、理论板（离开每块板的气液达到平衡），全凝器，再沸器算一块板。进料板取台阶第一次越过两条操作线交点的那一块（最优进料位置）。最小回流比由 q 线和平衡线的交点（夹点）求出；Fenske 方程给全回流时的最少板数。实际塔板效率通常是 50–80 %，实际板数要再除以效率。', 'Constant relative volatility, constant molar overflow (equal moles vaporised and condensed on each tray), theoretical stages (vapour and liquid leaving each stage in equilibrium), a total condenser, and the reboiler counted as a stage. The feed stage is the step that first crosses the intersection of the operating lines (the optimum feed location). Minimum reflux comes from where the q-line meets the equilibrium curve (the pinch); the Fenske equation gives the minimum stages at total reflux. Real tray efficiencies are usually 50–80 %, so the actual number of trays is the theoretical count divided by the efficiency.'],
    draw(s, f, c) {
      const q = +s.q, r = M.mccabe({ a: s.a, xD: s.xD, xB: s.xB, zF: s.zF, q, R: s.R }), xs = K.lin(0, 1, 201);
      const nmin = Math.log((s.xD / (1 - s.xD)) * ((1 - s.xB) / s.xB)) / Math.log(s.a);
      const ok = Number.isFinite(r.stages) && s.xB < s.zF && s.zF < s.xD;
      const series = [{ xs: [0, 1], ys: [0, 1], color: c.faint, width: 1, dash: [4, 4] }, { xs, ys: xs.map((x) => M.eqY(x, s.a)), color: c.accent, width: 2.4, label: L('平衡线', 'equilibrium') }];
      if (s.xB < s.zF && s.zF < s.xD) {
        series.push({ pts: [[s.xD, s.xD], [r.xi, r.yi]], color: c.danger, width: 2, label: L('操作线', 'operating lines') }, { pts: [[r.xi, r.yi], [s.xB, s.xB]], color: c.danger, width: 2 });
        const qEnd = q === 1 ? [s.zF, Math.max(r.yi, M.eqY(s.zF, s.a))] : q === 0 ? [Math.min(r.xi, M.eqX(s.zF, s.a)), s.zF] : [r.xi, r.yi];
        series.push({ pts: [[s.zF, s.zF], qEnd], color: c.faint, width: 1.5, dash: [5, 4], label: L('q 线', 'q-line') });
      }
      if (ok) series.push({ pts: r.pts, color: c.gold, width: 1.8 });
      series.push({ pts: [[s.xB, s.xB], [s.zF, s.zF], [s.xD, s.xD]], color: c.info, dots: 4.5, line: false });
      plot(f[0], { x: [0, 1], y: [0, 1], xl: 'x', yl: 'y', series });
      const st = !ok ? (s.R <= r.Rmin ? L('分不开（R ≤ R_min）', 'impossible (R ≤ R_min)') : L('组成设置不合理', 'check compositions')) : String(r.stages);
      return [[['理论板数', 'Theoretical stages'], st, 1], [['进料板（从上数）', 'Feed stage (from top)'], ok ? String(r.feed) : '—'], [['最小回流比 R_min', 'Minimum reflux R_min'], fix(r.Rmin, 2), 1], [['R / R_min', 'R / R_min'], fix(s.R / r.Rmin, 2)], [['最少板数（Fenske）', 'Minimum stages (Fenske)'], fix(nmin, 1)]];
    },
  };
});
