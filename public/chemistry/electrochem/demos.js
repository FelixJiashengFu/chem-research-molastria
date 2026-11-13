'use strict';
// 化学学科馆 08 · 电化学的四个演示：Nernst 方程和水的稳定区、Butler–Volmer 与 Tafel、循环伏安模拟、电池的理论容量和能量。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, plot } = K;
  const RT_F = (M.R * 298.15) / M.F, N59 = RT_F * Math.LN10; // 0.05916 V

  // ── Nernst 方程、pH 和水的稳定区 ────────────────────────────────────────
  // [显示名, 半反应, E°（V，25 °C）, n, 氧化态一侧 H⁺ 的计量数, 比值那一项写的是什么]
  const CP = {
    fe: ['Fe³⁺/Fe²⁺', 'Fe³⁺ + e⁻ → Fe²⁺', 0.771, 1, 0, ['lg([Fe³⁺]/[Fe²⁺])', 'lg([Fe³⁺]/[Fe²⁺])']],
    cu: ['Cu²⁺/Cu', 'Cu²⁺ + 2e⁻ → Cu', 0.340, 2, 0, ['lg[Cu²⁺]', 'lg[Cu²⁺]']],
    zn: ['Zn²⁺/Zn', 'Zn²⁺ + 2e⁻ → Zn', -0.762, 2, 0, ['lg[Zn²⁺]', 'lg[Zn²⁺]']],
    agcl: ['AgCl/Ag', 'AgCl + e⁻ → Ag + Cl⁻', 0.222, 1, 0, ['−lg[Cl⁻]', '−lg[Cl⁻]']],
    mno4: ['MnO₄⁻/Mn²⁺', 'MnO₄⁻ + 8H⁺ + 5e⁻ → Mn²⁺ + 4H₂O', 1.507, 5, 8, ['lg([MnO₄⁻]/[Mn²⁺])', 'lg([MnO₄⁻]/[Mn²⁺])']],
    cr: ['Cr₂O₇²⁻/Cr³⁺', 'Cr₂O₇²⁻ + 14H⁺ + 6e⁻ → 2Cr³⁺ + 7H₂O', 1.36, 6, 14, ['lg([Cr₂O₇²⁻]/[Cr³⁺]²)', 'lg([Cr₂O₇²⁻]/[Cr³⁺]²)']],
    o2: ['O₂/H₂O', 'O₂ + 4H⁺ + 4e⁻ → 2H₂O', 1.229, 4, 4, ['lg p(O₂)', 'lg p(O₂)']],
    h2: ['H⁺/H₂', '2H⁺ + 2e⁻ → H₂', 0, 2, 2, ['−lg p(H₂)', '−lg p(H₂)']],
  };
  D.nernst = {
    kind: 'exact',
    title: ['Nernst 方程：浓度、pH 和水的稳定区', 'The Nernst equation: concentration, pH and the stability window of water'],
    intro: ['选一个电对，调 pH 和浓度比，看电极电势怎样变化，和水的两条线（析氧、析氢）比一比：电对在上面那条线之上就能把水氧化，在下面那条线之下就能把水还原。', 'Pick a couple and adjust pH and the concentration ratio to see how the electrode potential moves, then compare it with the two lines for water (oxygen and hydrogen evolution): above the upper line the couple can oxidise water, below the lower one it can reduce water.'],
    sel: [['cp', ['电对', 'Couple'], Object.entries(CP).map(([k, v]) => [k, [v[0], v[0]]]), 'mno4']],
    ctl: [['pH', ['pH', 'pH'], 0, 14, 0.1, 0, (v) => fix(v, 1)], ['r', ['浓度比项（不含 H⁺）', 'Concentration term (without H⁺)'], -4, 4, 0.1, 0, (v) => fix(v, 1)]],
    btn: [[['高锰酸钾在酸里', 'Permanganate in acid'], { cp: 'mno4', pH: 0, r: 0 }], [['高锰酸钾在中性', 'Permanganate at neutral pH'], { cp: 'mno4', pH: 7, r: 0 }], [['Fe³⁺/Fe²⁺ 浓度比 100:1', 'Fe³⁺/Fe²⁺ at 100:1'], { cp: 'fe', pH: 1, r: 2 }], [['锌在水里', 'Zinc in water'], { cp: 'zn', pH: 7, r: -2 }], [['Ag/AgCl 参比（饱和 KCl 约 4.2 mol/L）', 'Ag/AgCl reference (sat. KCl ≈ 4.2 mol/L)'], { cp: 'agcl', pH: 7, r: -0.62 }]],
    figs: [[0.62, ['电势对 pH（相对标准氢电极）：彩色线是选中的电对（浓度比按右边滑杆），两条虚线之间是水的热力学稳定区（p(O₂) = p(H₂) = 1 bar）。', 'Potential against pH (vs SHE): the coloured line is the chosen couple (at the slider’s concentration ratio); between the two dashed lines water is thermodynamically stable (p(O₂) = p(H₂) = 1 bar).']], [0.42, ['当前 pH 下电势对浓度比项：斜率是 59.16/n mV 每十倍。', 'Potential against the concentration term at the current pH: the slope is 59.16/n mV per decade.']]],
    note: ['按 Nernst 方程精确计算（25 °C），图上左下角是选中电对的半反应；“相对 Ag/AgCl”按饱和 KCl 的 Ag/AgCl 电极 +0.197 V 换算。活度用浓度代替，固体和水的活度取 1。直线只在这些物种真的存在的 pH 范围里有意义：Fe³⁺ 在 pH 约 2 以上开始水解沉淀、Zn²⁺ 在碱性里变成 Zn(OH)₂ 和锌酸根、MnO₄⁻ 在中性和碱性里被还原成 MnO₂ 而不是 Mn²⁺，要看完整的 Pourbaix 图。水的稳定区是热力学的：实际电极上析氢、析氧都要过电位（见下一个演示），所以锌能在水里放着不剧烈反应，水溶液电池的电压也能略超过 1.23 V。E° 是常引的标准电极电势，由编者录入，未逐条复核。', 'Computed exactly from the Nernst equation (25 °C); the half-reaction of the chosen couple is printed at the lower left of the figure, and “vs Ag/AgCl” uses +0.197 V for Ag/AgCl in saturated KCl. Concentrations stand in for activities, and solids and water have unit activity. The straight lines only mean something where the species actually exist: Fe³⁺ hydrolyses and precipitates above about pH 2, Zn²⁺ becomes Zn(OH)₂ and zincate in base, and MnO₄⁻ is reduced to MnO₂ rather than Mn²⁺ in neutral and basic solution, for which one needs the full Pourbaix diagram. The water window is thermodynamic: real electrodes need overpotential to evolve hydrogen or oxygen (see the next demo), which is why zinc can sit in water without reacting violently and why aqueous batteries can slightly exceed 1.23 V. E° are commonly quoted standard potentials typed by the editor and not rechecked.'],
    draw(s, f, c) {
      const [nm, rx, E0, n, mH, rl] = CP[s.cp], E = (pH, r) => M.nernst(E0, n, r, 0, pH, mH), ps = K.lin(0, 14, 141);
      const eO = (pH) => 1.229 - N59 * pH, eH = (pH) => -N59 * pH;
      plot(f[0], { x: [0, 14], y: [-1.3, 1.9], xl: 'pH', yl: 'E / V vs SHE', series: [{ xs: ps, ys: ps.map(eO), color: c.danger, width: 1.6, dash: [6, 4], label: L('O₂/H₂O 析氧线', 'O₂/H₂O line') }, { xs: ps, ys: ps.map(eH), color: c.info, width: 1.6, dash: [6, 4], label: L('H⁺/H₂ 析氢线', 'H⁺/H₂ line') }, { xs: ps, ys: ps.map((p) => E(p, s.r)), color: c.accent, width: 2.6, label: nm }], marks: [{ x: s.pH, y: E(s.pH, s.r), color: c.gold }], texts: [{ x: 0.2, y: -1.3, s: rx, dy: -8, color: c.accent }] });
      const rs = K.lin(-4, 4, 81);
      plot(f[1], { x: [-4, 4], y: [Math.min(E(s.pH, -4), E(s.pH, 4)) - 0.05, Math.max(E(s.pH, -4), E(s.pH, 4)) + 0.05], xl: L(rl[0], rl[1]), yl: 'E / V', series: [{ xs: rs, ys: rs.map((r) => E(s.pH, r)), color: c.accent, width: 2.4 }], marks: [{ x: s.r, y: E(s.pH, s.r), color: c.gold }] });
      const e = E(s.pH, s.r), up = eO(s.pH), lo = eH(s.pH);
      const vs = e > up ? L('能氧化水', 'oxidises water') : e < lo ? L('能还原水', 'reduces water') : L('在稳定区里', 'inside window');
      return [[['电极电势', 'Potential'], `${fix(e, 3)} V`, 1], [['相对 Ag/AgCl', 'vs Ag/AgCl'], `${fix(e - 0.197, 3)} V`], [['每个 pH', 'Per pH unit'], mH ? `−${fix((1000 * N59 * mH) / n, 1)} mV` : L('无关', 'none')], [['每十倍浓度', 'Per decade'], `${fix((1000 * N59) / n, 1)} mV`], [['和水比', 'vs water'], vs, 1]];
    },
  };

  // ── Butler–Volmer 和 Tafel ──────────────────────────────────────────────
  D.bv = {
    kind: 'exact',
    title: ['Butler–Volmer 方程和 Tafel 图', 'The Butler–Volmer equation and the Tafel plot'],
    intro: ['调交换电流密度 j₀ 和传递系数 α，看电流怎样随过电位指数增长；打开传质极限，看电流在扩散限制下变平。右图是 Tafel 图：直线段的斜率就是 Tafel 斜率，外推到 η = 0 得到 j₀。', 'Adjust the exchange current density j₀ and transfer coefficient α to see the current grow exponentially with overpotential; turn on the mass-transport limit to see it level off. The right figure is the Tafel plot: the slope of the straight part is the Tafel slope, and extrapolating to η = 0 gives j₀.'],
    ctl: [['lj', ['交换电流密度 lg(j₀ / mA cm⁻²)', 'Exchange current lg(j₀ / mA cm⁻²)'], -9, 1, 0.1, -3, (v) => `j₀ = ${fmt(10 ** v, 2)} mA/cm²`], ['a', ['阴极传递系数 α', 'Cathodic transfer coefficient α'], 0.2, 0.8, 0.01, 0.5, (v) => fix(v, 2)], ['jl', ['极限扩散电流', 'Limiting diffusion current'], 0.5, 100, 0.5, 20, (v) => `${fix(v, 1)} mA/cm²`]],
    chk: [['lim', ['计入传质极限（两个方向一样大）', 'Include the mass-transport limit (same in both directions)'], false]],
    btn: [[['铂上析氢（j₀ ≈ 1 mA/cm²）', 'Hydrogen on platinum (j₀ ≈ 1 mA/cm²)'], { lj: 0, a: 0.5, lim: false }], [['汞上析氢（j₀ ≈ 10⁻⁹ mA/cm²）', 'Hydrogen on mercury (j₀ ≈ 10⁻⁹ mA/cm²)'], { lj: -9, a: 0.5, lim: false }], [['不对称：α = 0.3', 'Asymmetric: α = 0.3'], { lj: -3, a: 0.3, lim: false }], [['传质控制', 'Mass-transport control'], { lj: -1, a: 0.5, lim: true, jl: 5 }]],
    figs: [[0.6, ['电流密度对过电位（还原电流为负）。虚线是两个方向各自的分电流。', 'Current density against overpotential (reduction negative). Dashed lines are the two partial currents.']], [0.6, ['Tafel 图：lg|j| 对 η。灰色虚线是两条 Tafel 直线，交在 η = 0、lg j₀。', 'Tafel plot: lg|j| against η. Grey dashed lines are the two Tafel lines, meeting at η = 0, lg j₀.']]],
    note: ['电流按 Butler–Volmer 方程精确计算（单电子，25 °C，α_a = 1 − α），传质极限用同一形式的闭式解 j = (e^{α_a fη} − e^{−α_c fη})/(1/j₀ + e^{α_a fη}/j_lim + e^{−α_c fη}/j_lim)，相当于反应物和产物都从溶液里扩散来、扩散层厚度一定。没有计入溶液电阻（真实测量里要做 iR 补偿）。电荷转移电阻 R_ct = RT/(F j₀)，就是曲线在 η = 0 处斜率的倒数。铂和汞上析氢的 j₀ 是教科书常引的量级，由编者录入，未逐条复核；不同晶面、不同酸、不同表面处理可以差一两个数量级。', 'Current from the Butler–Volmer equation exactly (one electron, 25 °C, α_a = 1 − α); the mass-transport limit uses the closed form of the same kind, j = (e^{α_a fη} − e^{−α_c fη})/(1/j₀ + e^{α_a fη}/j_lim + e^{−α_c fη}/j_lim), corresponding to reactant and product both diffusing from solution through a fixed diffusion layer. Solution resistance is not included (real measurements need iR compensation). The charge-transfer resistance is R_ct = RT/(F j₀), the inverse of the slope of the curve at η = 0. The j₀ for hydrogen on platinum and mercury are textbook orders of magnitude typed by the editor and not rechecked; facets, acids and surface treatment can change them by one or two orders.'],
    draw(s, f, c) {
      const j0 = 10 ** s.lj, aa = 1 - s.a, ff = 1 / RT_F, jl = s.lim ? s.jl : Infinity, cap = s.lim ? s.jl * 1.6 : 100;
      const bc = Math.LN10 / (s.a * ff), ba = Math.LN10 / (aa * ff);
      const em = Math.min(1.6, Math.max(0.12, Math.max(bc, ba) * Math.log10((s.lim ? s.jl * 30 : cap) / j0) * 1.08));
      const st = em > 1 ? 0.5 : em > 0.5 ? 0.25 : em > 0.25 ? 0.1 : 0.05, xt = K.lin(-Math.floor(em / st) * st, Math.floor(em / st) * st, 2 * Math.floor(em / st) + 1).map((v) => +v.toFixed(2));
      const es = K.lin(-em, em, 300), j = (e) => M.butlerVolmer(e, j0, s.a, 1, 298.15, jl, jl), big = (v) => (Math.abs(v) > cap * 20 ? NaN : v);
      const ycap = s.lim ? s.jl * 1.15 : cap;
      plot(f[0], { x: [-em, em], y: [-ycap, ycap], xt, xl: 'η / V', yl: 'j / mA cm⁻²', series: [{ xs: es, ys: es.map((e) => big(j0 * Math.exp(aa * ff * e))), color: c.danger, width: 1.3, dash: [5, 4], label: L('氧化分电流', 'anodic') }, { xs: es, ys: es.map((e) => big(-j0 * Math.exp(-s.a * ff * e))), color: c.info, width: 1.3, dash: [5, 4], label: L('还原分电流', 'cathodic') }, { xs: es, ys: es.map((e) => big(j(e))), color: c.accent, width: 2.6, label: L('净电流', 'net') }], hmarks: s.lim ? [{ y: s.jl, color: c.faint }, { y: -s.jl, color: c.faint }] : [] });
      const lmin = s.lj - 1.5, lmax = Math.log10(ycap) + 0.3;
      const lg = (v) => { const a = Math.log10(Math.abs(v)); return a < lmin - 1 ? NaN : a; };
      plot(f[1], { x: [-em, em], y: [lmin, lmax], xt, xl: 'η / V', yl: 'lg(|j| / mA cm⁻²)', series: [{ xs: es, ys: es.map((e) => s.lj + e / ba), color: c.faint, width: 1.3, dash: [5, 4] }, { xs: es, ys: es.map((e) => s.lj - e / bc), color: c.faint, width: 1.3, dash: [5, 4] }, { xs: es, ys: es.map((e) => lg(j(e))), color: c.accent, width: 2.6 }], marks: [{ x: 0, y: s.lj, color: c.gold }] });
      // 还原电流达到 10 mA/cm² 要多大的过电位（二分）
      const target = 10, solve = () => { if (s.lim && s.jl <= target) return null; let lo = -3, hi = 0; for (let k = 0; k < 80; k++) { const m = (lo + hi) / 2; if (-j(m) > target) lo = m; else hi = m; } return (lo + hi) / 2; };
      const e10 = solve(), rct = RT_F / (j0 * 1e-3);
      return [[['阴极 Tafel 斜率', 'Cathodic Tafel slope'], `${fix(bc * 1000, 0)} mV/dec`, 1], [['阳极 Tafel 斜率', 'Anodic Tafel slope'], `${fix(ba * 1000, 0)} mV/dec`], [['还原 10 mA/cm² 的 η', 'η for −10 mA/cm²'], e10 === null ? L('达不到', 'unreachable') : `${fix(e10 * 1000, 0)} mV`, 1], [['电荷转移电阻 R_ct', 'Charge-transfer R_ct'], `${fmt(rct, 3)} Ω cm²`]];
    },
  };

  // ── 循环伏安 ────────────────────────────────────────────────────────────
  const peaks = (r) => {
    const h = Math.floor(r.E.length / 2); let ic = 0, ia = h;
    for (let i = 0; i <= h; i++) if (r.j[i] < r.j[ic]) ic = i;
    for (let i = h; i < r.E.length; i++) if (r.j[i] > r.j[ia]) ia = i;
    const edge = (i, a, b) => i <= a + 2 || i >= b - 2;
    return { ic, ia, okc: !edge(ic, 0, h), oka: !edge(ia, h, r.E.length - 1), dE: r.E[ia] - r.E[ic] };
  };
  D.cv = {
    kind: 'model',
    title: ['循环伏安：可逆、准可逆和不可逆', 'Cyclic voltammetry: reversible, quasi-reversible and irreversible'],
    intro: ['在电极上把 O 还原成 R 再氧化回来。调标准速率常数 k⁰ 和扫速 v，看两个峰怎样分开；把模拟的峰电流和 Randles–Ševčík 方程比一比。', 'Reduce O to R at the electrode and oxidise it back. Adjust the standard rate constant k⁰ and the scan rate v to see the peaks separate, and compare the simulated peak current with the Randles–Ševčík equation.'],
    ctl: [['lk', ['标准速率常数 lg(k⁰ / cm s⁻¹)', 'Standard rate constant lg(k⁰ / cm s⁻¹)'], -6, 0, 0.1, 0, (v) => `k⁰ = ${fmt(10 ** v, 2)} cm/s`], ['lv', ['扫速 lg(v / V s⁻¹)', 'Scan rate lg(v / V s⁻¹)'], -2, 1, 0.1, -1, (v) => `${fmt(10 ** v, 3)} V/s`], ['a', ['传递系数 α', 'Transfer coefficient α'], 0.3, 0.7, 0.05, 0.5, (v) => fix(v, 2)], ['c', ['浓度', 'Concentration'], 0.1, 10, 0.1, 1, (v) => `${fix(v, 1)} mmol/L`]],
    btn: [[['可逆（快的电子转移）', 'Reversible (fast electron transfer)'], { lk: 0, lv: -1, a: 0.5 }], [['准可逆（k⁰ = 0.005 cm/s）', 'Quasi-reversible (k⁰ = 0.005 cm/s)'], { lk: -2.3, lv: -1, a: 0.5 }], [['不可逆（k⁰ ≈ 3 × 10⁻⁶ cm/s）', 'Irreversible (k⁰ ≈ 3 × 10⁻⁶ cm/s)'], { lk: -5.5, lv: -1, a: 0.5 }], [['准可逆体系扫快一点', 'Quasi-reversible, scanned faster'], { lk: -2.3, lv: 0.7, a: 0.5 }]],
    figs: [[0.62, ['电流密度对电势（相对 E°′；还原电流为负，IUPAC 习惯）。灰线是可逆体系，用来对照。', 'Current density against potential (vs E°′; reduction negative, IUPAC convention). The grey curve is the reversible case for comparison.']], [0.45, ['峰间距 ΔE_p 对扫速：可逆体系是一条约 58 mV 的水平线，电子转移越慢，扫得越快峰分得越开。', 'Peak separation ΔE_p against scan rate: a reversible system stays near 58 mV, while slower electron transfer separates the peaks more at higher scan rates.']]],
    note: ['有限差分数值模拟：O + e⁻ ⇌ R，D_O = D_R = 1.0 × 10⁻⁵ cm²/s，半无限线性扩散，电极反应按 Butler–Volmer，从 +0.5 V 扫到 −0.5 V 再回来，25 °C。可逆情形的峰电流和 Randles–Ševčík 方程相差不到 0.5 %，峰间距约 58 mV。可逆、准可逆、不可逆的划分用常见的判据 Λ = k⁰/√(DFv/RT)：Λ > 15 可逆，Λ < 10⁻²⁽¹⁺α⁾ 不可逆。“可逆理论值”是 Randles–Ševčík 方程，“不可逆理论值”是 i_p = 0.4958 nFAc√(αnFvD/RT)。没有计入溶液电阻、双电层充电电流和吸附，实测伏安图都会带这些。', 'A finite-difference simulation: O + e⁻ ⇌ R, D_O = D_R = 1.0 × 10⁻⁵ cm²/s, semi-infinite linear diffusion, Butler–Volmer electrode kinetics, sweeping from +0.5 V to −0.5 V and back at 25 °C. In the reversible case the peak current agrees with Randles–Ševčík to within 0.5 % and the peak separation is about 58 mV. The reversible / quasi-reversible / irreversible split uses the common criterion Λ = k⁰/√(DFv/RT): Λ > 15 reversible, Λ < 10⁻²⁽¹⁺α⁾ irreversible. “Reversible theory” is the Randles–Ševčík equation and “irreversible theory” is i_p = 0.4958 nFAc√(αnFvD/RT). Solution resistance, double-layer charging and adsorption are not included; real voltammograms carry all of them.'],
    draw(s, f, c) {
      const Dc = 1e-5, v = 10 ** s.lv, k0 = 10 ** s.lk, base = { c: s.c * 1e-3, D: Dc, v, alpha: s.a, Ei: 0.5, Ev: -0.5, steps: 1600 };
      const r = M.cv({ ...base, k0 }), rr = M.cv({ ...base, k0: 10 }), p = peaks(r), ip = M.randlesSevcik(1, s.c * 1e-3, Dc, v);
      const ymax = Math.max(...rr.j.map(Math.abs), ...r.j.map(Math.abs)) * 1.12;
      plot(f[0], { x: [-0.5, 0.5], y: [-ymax, ymax * 0.9], xl: 'E − E°′ / V', yl: 'j / mA cm⁻²', series: [{ xs: rr.E, ys: rr.j, color: c.faint, width: 1.4, label: L('可逆', 'reversible') }, { xs: r.E, ys: r.j, color: c.accent, width: 2.4, label: `k⁰ = ${fmt(k0, 2)}` }], hmarks: [{ y: -ip, color: c.danger }], marks: [p.okc ? { x: r.E[p.ic], y: r.j[p.ic], color: c.gold } : null, p.oka ? { x: r.E[p.ia], y: r.j[p.ia], color: c.gold } : null].filter(Boolean), texts: [{ x: 0.49, y: -ip, s: L('Randles–Ševčík 峰电流', 'Randles–Ševčík i_p'), align: 'right', dy: 14, color: c.danger }] });
      const lvs = K.lin(-2, 1, 13), dEs = lvs.map((lv) => { const q = peaks(M.cv({ ...base, v: 10 ** lv, k0, steps: 1000 })); return q.okc && q.oka ? q.dE * 1000 : NaN; });
      const top = Math.max(120, ...dEs.filter(Number.isFinite)) * 1.1;
      plot(f[1], { x: [-2, 1], y: [0, top], xl: 'lg(v / V s⁻¹)', yl: 'ΔE_p / mV', series: [{ xs: lvs, ys: dEs, color: c.accent, width: 2, dots: 3.5, line: true }], hmarks: [{ y: 57.0, color: c.faint }], marks: [{ x: s.lv, color: c.gold }] });
      const Lam = k0 / Math.sqrt((Dc * v) / RT_F), regime = Lam > 15 ? L('可逆', 'reversible') : Lam < 10 ** (-2 * (1 + s.a)) ? L('不可逆', 'irreversible') : L('准可逆', 'quasi-reversible');
      const ipIrr = 0.4958 * M.F * s.c * 1e-6 * Math.sqrt((s.a * v * Dc) / RT_F) * 1000;
      const ipc = -r.j[p.ic];
      return [[['判据 Λ', 'Criterion Λ'], `${fmt(Lam, 3)}（${regime}）`, 1], [['模拟的还原峰', 'Simulated peak'], p.okc ? `${fmt(ipc, 3)} mA/cm²` : L('峰超出扫描范围', 'peak outside the window')], [['可逆理论值', 'Reversible theory'], `${fmt(ip, 3)} mA/cm²`], [['不可逆理论值', 'Irreversible theory'], `${fmt(ipIrr, 3)} mA/cm²`], [['峰间距 ΔE_p', 'Peak separation ΔE_p'], p.okc && p.oka ? `${fix(p.dE * 1000, 0)} mV` : L('有一个峰超出扫描范围', 'a peak lies outside the window'), 1], [['3 mm 盘电极', 'On a 3 mm disc'], p.okc ? `${fmt(ipc * 0.0707 * 1000, 3)} μA` : '—']];
    },
  };

  // ── 电池的理论容量和能量 ────────────────────────────────────────────────
  // [名字, 每个式量转移的电子数, 计算容量用的摩尔质量（g/mol）, 平均电压（V vs Li⁺/Li）, 角色, 本身是否带可用的锂]
  const MAT = {
    lco: [['钴酸锂 LiCoO₂', 'LiCoO₂'], 1, 97.87, 3.9, 'c', true],
    nmc: [['三元 LiNi⅓Mn⅓Co⅓O₂', 'NMC111'], 1, 96.46, 3.7, 'c', true],
    lmo: [['锰酸锂 LiMn₂O₄', 'LiMn₂O₄'], 1, 180.81, 4.0, 'c', true],
    lfp: [['磷酸铁锂 LiFePO₄', 'LiFePO₄'], 1, 157.76, 3.4, 'c', true],
    s: [['硫（→ Li₂S）', 'Sulfur (→ Li₂S)'], 2, 32.06, 2.1, 'c', false],
    li: [['锂金属', 'Lithium metal'], 1, 6.94, 0, 'a', true],
    gr: [['石墨（→ LiC₆）', 'Graphite (→ LiC₆)'], 1, 72.06, 0.1, 'a', false],
    si: [['硅（→ Li₁₅Si₄）', 'Silicon (→ Li₁₅Si₄)'], 3.75, 28.09, 0.4, 'a', false],
    lto: [['钛酸锂 Li₄Ti₅O₁₂', 'Li₄Ti₅O₁₂'], 3, 459.09, 1.55, 'a', false],
  };
  const cap = (k) => M.specCap(MAT[k][1], MAT[k][2]);
  const opts = (role) => Object.entries(MAT).filter(([, v]) => v[4] === role).map(([k, v]) => [k, v[0]]);
  D.battery = {
    kind: 'exact',
    title: ['锂电池的理论容量和能量', 'Theoretical capacity and energy of lithium batteries'],
    intro: ['选一个正极和一个负极，算它们的理论比容量、电池电压和理论比能量；右图把常见材料按电压和容量摆在一起，阴影是常用碳酸酯电解液大致稳定的电压范围。', 'Choose a cathode and an anode to compute their theoretical specific capacities, the cell voltage and the theoretical specific energy; the right figure places common materials by voltage and capacity, with the shaded band roughly where carbonate electrolytes are stable.'],
    sel: [['ca', ['正极', 'Cathode'], opts('c'), 'lco'], ['an', ['负极', 'Anode'], opts('a'), 'gr']],
    btn: [[['手机电池：钴酸锂 | 石墨', 'Phone: LiCoO₂ | graphite'], { ca: 'lco', an: 'gr' }], [['电动车和储能：磷酸铁锂 | 石墨', 'EV and storage: LiFePO₄ | graphite'], { ca: 'lfp', an: 'gr' }], [['锂硫电池：硫 | 锂金属', 'Lithium–sulfur: S | Li metal'], { ca: 's', an: 'li' }], [['快充长寿命：锰酸锂 | 钛酸锂', 'Fast-charge, long-life: LiMn₂O₄ | Li₄Ti₅O₁₂'], { ca: 'lmo', an: 'lto' }], [['硅负极：三元 | 硅', 'Silicon anode: NMC | Si'], { ca: 'nmc', an: 'si' }]],
    figs: [[0.55, ['理论比容量：正极、负极，以及两者合在一起（每克活性材料）。', 'Theoretical specific capacity: cathode, anode, and the pair together (per gram of active material).']], [0.62, ['常见电极材料的平均电压（相对 Li⁺/Li）和理论比容量（对数轴）。阴影是碳酸酯电解液大致稳定的范围；石墨、硅和锂在它下面，要靠 SEI 膜保护。', 'Average voltage (vs Li⁺/Li) and theoretical capacity (log axis) of common electrode materials. The shaded band is roughly where carbonate electrolytes are stable; graphite, silicon and lithium sit below it and rely on the SEI.']]],
    note: ['理论比容量 Q = nF/(3.6M) 精确，M 取计算时惯用的式量（钴酸锂按 LiCoO₂，石墨按 C₆，硅按 Si，硫按 S）；两极串联 1/Q = 1/Q₊ + 1/Q₋。平均电压是常引的近似值（编者录入，未逐条复核），真实的放电曲线有斜坡和平台。钴酸锂只能可逆地用约一半的锂（实际约 140–150 mAh/g），三元材料的实际容量取决于镍含量和充电截止电压。实际电芯还有集流体、隔膜、电解液、导电剂和外壳，能量密度通常只有这里理论值的三分之一到一半；“实际估计”一行就是用这个经验范围乘出来的。电解液的稳定范围（约 1.0–4.5 V）是示意。', 'Theoretical capacity Q = nF/(3.6M) is exact, with M the formula mass conventionally used (LiCoO₂ for cobalt oxide, C₆ for graphite, Si for silicon, S for sulfur); two electrodes in series give 1/Q = 1/Q₊ + 1/Q₋. Average voltages are commonly quoted approximate values (typed by the editor, not rechecked); real discharge curves have slopes and plateaus. LiCoO₂ can reversibly give up only about half its lithium (about 140–150 mAh/g in practice), and the practical capacity of NMC depends on nickel content and the charge cut-off. Real cells also carry current collectors, separator, electrolyte, conductive additive and casing, so their energy density is usually a third to a half of the theoretical value here; the “practical estimate” row simply applies that empirical range. The electrolyte stability band (about 1.0–4.5 V) is indicative.'],
    draw(s, f, c) {
      const qc = cap(s.ca), qa = cap(s.an), qp = 1 / (1 / qc + 1 / qa), V = MAT[s.ca][3] - MAT[s.an][3], W = V * qp;
      plot(f[0], { x: [0.4, 3.6], y: [0, Math.max(qc, qa) * 1.18], xt: [1, 2, 3], xf: (t) => [L('正极', 'Cathode'), L('负极', 'Anode'), L('合计', 'Pair')][t - 1], yl: 'mAh g⁻¹', series: [{ xs: [1], ys: [qc], color: c.danger, bars: 0.55 }, { xs: [2], ys: [qa], color: c.info, bars: 0.55 }, { xs: [3], ys: [qp], color: c.gold, bars: 0.55 }], texts: [{ x: 1, y: qc, s: fix(qc, 0), align: 'center', dy: -6 }, { x: 2, y: qa, s: fix(qa, 0), align: 'center', dy: -6 }, { x: 3, y: qp, s: fix(qp, 0), align: 'center', dy: -6 }] });
      const ks = Object.keys(MAT), sel = (k) => k === s.ca || k === s.an;
      plot(f[1], { x: [2, 3.75], logx: false, y: [-0.3, 4.6], xt: [2, 2.5, 3, 3.5], xf: (t) => fix(10 ** t, 0), xl: L('理论比容量 / mAh g⁻¹（对数）', 'Theoretical capacity / mAh g⁻¹ (log)'), yl: 'V vs Li⁺/Li', hbands: [{ y0: 1.0, y1: 4.5, color: c.ok || c.info, alpha: 0.08 }], series: [{ xs: ks.filter((k) => !sel(k)).map((k) => Math.log10(cap(k))), ys: ks.filter((k) => !sel(k)).map((k) => MAT[k][3]), color: c.faint, dots: 4.5 }, { xs: [Math.log10(qc), Math.log10(qa)], ys: [MAT[s.ca][3], MAT[s.an][3]], color: c.gold, dots: 6, line: true, width: 1.5, dash: [4, 4] }], texts: ks.map((k) => ({ x: Math.log10(cap(k)), y: MAT[k][3], s: L(MAT[k][0][0].split(/[ （]/)[0], MAT[k][0][1].split(' ')[0]), align: Math.log10(cap(k)) > 3.4 ? 'right' : 'left', dx: Math.log10(cap(k)) > 3.4 ? -8 : 8, dy: k === 'nmc' ? 14 : 4, color: sel(k) ? c.ink : c.muted })) });
      const rows = [[['正极理论比容量', 'Cathode capacity'], `${fix(qc, 0)} mAh/g`], [['负极理论比容量', 'Anode capacity'], `${fix(qa, 0)} mAh/g`], [['电池电压（平均）', 'Cell voltage (average)'], `${fix(V, 2)} V`, 1], [['活性材料的理论比能量', 'Theoretical specific energy (active materials)'], V > 0 ? `${fix(W, 0)} Wh/kg` : '—', 1], [['实际电芯的粗略估计', 'Rough practical cell estimate'], V > 0 ? `${fix(W / 3, 0)}–${fix(W / 2, 0)} Wh/kg` : '—']];
      if (!MAT[s.ca][5] && !MAT[s.an][5]) rows.push([['注意', 'Note'], L('两边都不带锂，要预先补锂才能工作', 'neither side holds lithium, so it must be prelithiated'), 1]);
      return rows;
    },
  };
});
