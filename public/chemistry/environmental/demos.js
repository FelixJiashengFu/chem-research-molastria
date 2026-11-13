'use strict';
// 化学学科馆 13 · 环境化学的四个演示：开放体系的碳酸盐平衡、CO₂ 的辐射强迫、单箱模型、原子经济性和 E 因子。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, plot } = K;

  // ── 碳酸盐体系 ──────────────────────────────────────────────────────────
  D.carbonate = {
    kind: 'exact',
    title: ['和大气平衡的水：CO₂、碱度和 pH', 'Water in equilibrium with air: CO₂, alkalinity and pH'],
    intro: ['调大气 CO₂ 分压和水的碱度，看 pH 和各种无机碳的浓度。碱度为零就是纯水（雨水）；碱度越高，水越能“吃下”CO₂，pH 却下降得越少。', 'Adjust the atmospheric CO₂ pressure and the water’s alkalinity to see the pH and the concentrations of each form of inorganic carbon. Zero alkalinity is pure water (rain); the higher the alkalinity, the more CO₂ the water takes up and the less its pH falls.'],
    ctl: [['p', ['大气 CO₂', 'Atmospheric CO₂'], 150, 1500, 5, 420, (v) => `${v} ppm`], ['alk', ['碱度', 'Alkalinity'], 0, 3, 0.01, 1, (v) => `${fix(v, 2)} mmol/L`]],
    btn: [[['雨水，工业化前', 'Rain, preindustrial'], { p: 280, alk: 0 }], [['雨水，今天', 'Rain, today'], { p: 420, alk: 0 }], [['河水（碱度 1 mmol/L）', 'River water (alkalinity 1 mmol/L)'], { p: 420, alk: 1 }], [['碱度像海水（2.3 mmol/L），280 ppm', 'Seawater-like alkalinity (2.3 mmol/L), 280 ppm'], { p: 280, alk: 2.3 }], [['同上，1000 ppm', 'Same at 1000 ppm'], { p: 1000, alk: 2.3 }]],
    figs: [[0.55, ['三种无机碳的分数对 pH（封闭体系的分布曲线），金线是当前 pH。', 'Fractions of the three forms of inorganic carbon against pH (closed-system distribution), with the current pH in gold.']], [0.55, ['开放体系的 pH 对大气 CO₂（当前碱度）。灰线是工业化前，金点是当前状态。', 'Open-system pH against atmospheric CO₂ (at the current alkalinity). Grey: preindustrial; gold: the current state.']]],
    note: ['按淡水 25 °C 的常数（pK_H 1.47、pK₁ 6.35、pK₂ 10.33、pK_w 14.00）精确解电荷平衡，活度系数取 1。海水的离子强度高，表观常数不同（pK₁* 约 5.85、pK₂* 约 8.97），而且有硼酸盐碱度，所以“碱度像海水”那两个预设只用来示意趋势：真实表层海水今天的 pH 约 8.05，比这里算的低。常数是常引值，由编者录入，未逐条复核。', 'Solves the charge balance exactly with fresh-water constants at 25 °C (pK_H 1.47, pK₁ 6.35, pK₂ 10.33, pK_w 14.00) and unit activity coefficients. Seawater’s high ionic strength gives different apparent constants (pK₁* about 5.85, pK₂* about 8.97) and adds borate alkalinity, so the two “seawater-like” presets only show the trend: real surface seawater today has pH about 8.05, lower than computed here. Constants are commonly quoted values typed by the editor and not rechecked.'],
    draw(s, f, c) {
      const r = M.carbOpen(s.p * 1e-6, s.alk * 1e-3), r0 = M.carbOpen(280e-6, s.alk * 1e-3);
      const ps = K.lin(2, 12, 201), fr = ps.map((x) => M.carbFrac(x));
      plot(f[0], { x: [2, 12], y: [0, 1.05], xl: 'pH', yl: L('分数', 'fraction'), series: [{ xs: ps, ys: fr.map((q) => q[0]), color: c.info, width: 2.4, label: 'CO₂(aq)' }, { xs: ps, ys: fr.map((q) => q[1]), color: c.accent, width: 2.4, label: 'HCO₃⁻' }, { xs: ps, ys: fr.map((q) => q[2]), color: c.danger, width: 2.4, label: 'CO₃²⁻' }], marks: [{ x: r.pH, color: c.gold }] });
      const cs = K.lin(150, 1500, 136), ph = cs.map((p) => M.carbOpen(p * 1e-6, s.alk * 1e-3).pH), lo = Math.min(...ph), hi = Math.max(...ph);
      plot(f[1], { x: [150, 1500], y: [Math.floor((lo - 0.1) * 10) / 10, Math.ceil((hi + 0.1) * 10) / 10], xl: 'CO₂ / ppm', yl: 'pH', series: [{ xs: cs, ys: ph, color: c.accent, width: 2.4 }], marks: [{ x: 280, color: c.faint }, { x: s.p, y: r.pH, color: c.gold }] });
      const um = (v) => `${fmt(v * 1e6, 3)} μmol/L`;
      return [[['pH', 'pH'], fix(r.pH, 2), 1], [['和 280 ppm 比', 'vs 280 ppm'], `${r.pH - r0.pH >= 0 ? '+' : '−'}${fix(Math.abs(r.pH - r0.pH), 2)}`], [['CO₂(aq)', 'CO₂(aq)'], um(r.co2)], [['HCO₃⁻', 'HCO₃⁻'], um(r.hco3)], [['CO₃²⁻', 'CO₃²⁻'], um(r.co3), 1], [['溶解无机碳', 'Total DIC'], um(r.DIC)]];
    },
  };

  // ── 辐射强迫和平衡增温 ──────────────────────────────────────────────────
  D.forcing = {
    kind: 'model',
    title: ['CO₂ 的辐射强迫和平衡增温', 'CO₂ radiative forcing and equilibrium warming'],
    intro: ['调 CO₂ 浓度和气候敏感度，看辐射强迫和平衡增温。注意强迫随浓度对数增长：从 280 到 560 ppm 和从 560 到 1120 ppm 增加的一样多。', 'Adjust the CO₂ concentration and the climate sensitivity to see the forcing and equilibrium warming. Note that forcing grows with the logarithm of concentration: 280 to 560 ppm adds as much as 560 to 1120 ppm.'],
    ctl: [['C', ['CO₂ 浓度', 'CO₂ concentration'], 180, 1200, 5, 420, (v) => `${v} ppm`], ['S', ['平衡气候敏感度', 'Equilibrium climate sensitivity'], 1.5, 6, 0.1, 3, (v) => `${fix(v, 1)} °C/${L('倍增', 'doubling')}`]],
    btn: [[['末次冰期（约 190 ppm）', 'Last glacial maximum (about 190 ppm)'], { C: 190 }], [['工业化前', 'Preindustrial'], { C: 278 }], [['2020 年代中期', 'Mid-2020s'], { C: 420 }], [['加倍', 'Doubled'], { C: 556 }], [['四倍', 'Quadrupled'], { C: 1110 }]],
    figs: [[0.55, ['辐射强迫对 CO₂ 浓度（相对 278 ppm）。灰色竖线是每一次倍增。', 'Radiative forcing against CO₂ (relative to 278 ppm). Grey lines mark each doubling.']], [0.55, ['平衡增温对 CO₂。两条灰色虚线是敏感度 2.5 和 4 °C（可能范围的两端），彩色线是你选的敏感度。', 'Equilibrium warming against CO₂. The two grey dashed lines are sensitivities of 2.5 and 4 °C (the ends of the likely range); the coloured line is your chosen sensitivity.']]],
    note: ['强迫用 Myhre 等人的简化式 ΔF = 5.35 ln(C/C₀) W/m²（C₀ = 278 ppm）[@myhre1998]，平衡增温 ΔT = λΔF，λ = 敏感度/(5.35 ln 2)。只算 CO₂，不含甲烷、N₂O、卤代烃的增温，也不含气溶胶的冷却；“平衡”指海洋充分吸热之后，实际增温在排放持续时会落后于它。末次冰期的低 CO₂ 不是冰期降温的全部原因，冰盖和反照率的变化贡献很大。敏感度 2.5–4 °C 的范围按 IPCC 第六次评估报告的“可能”区间录入。', 'Forcing uses the simplified expression of Myhre and co-workers, ΔF = 5.35 ln(C/C₀) W/m² (C₀ = 278 ppm) [@myhre1998], and equilibrium warming ΔT = λΔF with λ = sensitivity/(5.35 ln 2). Only CO₂ is counted, with no warming from methane, N₂O or halocarbons and no aerosol cooling; “equilibrium” means after the ocean has fully warmed, and actual warming lags behind while emissions continue. Low glacial CO₂ was not the whole cause of ice-age cooling: ice sheets and albedo contributed a great deal. The 2.5–4 °C range is entered as the “likely” range of the IPCC Sixth Assessment Report.'],
    draw(s, f, c) {
      const cs = K.lin(180, 1200, 205), F = (x) => M.forcingCO2(x), dF = F(s.C), dT = M.warming(dF, s.S);
      plot(f[0], { x: [180, 1200], y: [-2.5, 9.5], xl: 'CO₂ / ppm', yl: 'ΔF / W m⁻²', series: [{ xs: cs, ys: cs.map(F), color: c.accent, width: 2.6 }], marks: [{ x: 556, color: c.faint }, { x: 1112, color: c.faint }, { x: s.C, y: dF, color: c.gold }], hmarks: [{ y: 0, color: c.faint }] });
      const t25 = cs.map((x) => M.warming(F(x), 2.5)), t4 = cs.map((x) => M.warming(F(x), 4));
      plot(f[1], { x: [180, 1200], y: [-4, 12], xl: 'CO₂ / ppm', yl: 'ΔT / °C', series: [{ xs: cs, ys: t4, color: c.faint, width: 1, dash: [4, 4], label: '4 °C' }, { xs: cs, ys: t25, color: c.faint, width: 1, dash: [4, 4], label: '2.5 °C' }, { xs: cs, ys: cs.map((x) => M.warming(F(x), s.S)), color: c.danger, width: 2.6, label: L('你的选择', 'your choice') }], marks: [{ x: s.C, y: dT, color: c.gold }], hmarks: [{ y: 0, color: c.faint }] });
      return [[['辐射强迫', 'Forcing'], `${dF >= 0 ? '+' : '−'}${fix(Math.abs(dF), 2)} W/m²`, 1], [['平衡增温', 'Equilibrium ΔT'], `${dT >= 0 ? '+' : '−'}${fix(Math.abs(dT), 1)} °C`, 1], [['倍增次数', 'Doublings'], fix(Math.log2(s.C / 278), 2)], [['敏感度参数 λ', 'Parameter λ'], `${fix(M.warming(1, s.S), 2)} K/(W m⁻²)`]];
    },
  };

  // ── 单箱模型 ────────────────────────────────────────────────────────────
  // 大气寿命（年），常引值，编者录入
  const LIFE = [[['一氧化碳（约 2 个月）', 'Carbon monoxide (about 2 months)'], 0.17], [['甲烷（扰动寿命约 12 年）', 'Methane (perturbation lifetime about 12 years)'], 12], [['CFC-11（约 52 年）', 'CFC-11 (about 52 years)'], 52], [['N₂O（约 110 年）', 'N₂O (about 110 years)'], 110], [['SF₆（约 1000 年）', 'SF₆ (about 1000 years)'], 1000]];
  D.box = {
    kind: 'exact',
    title: ['单箱模型：寿命决定减排多快见效', 'A one-box model: lifetime sets how fast cuts pay off'],
    intro: ['污染物排放稳定多年、浓度已经稳态。第 10 年把排放降到一定比例，看浓度怎样走向新的稳态。寿命短的几乎立刻响应，寿命长的要几十上百年。', 'A pollutant has had steady emissions for years and is at steady state. In year 10 emissions drop to a chosen fraction; watch the concentration head for its new steady state. Short-lived species respond almost at once, long-lived ones take decades or centuries.'],
    ctl: [['lt', ['寿命 lg(τ / 年)', 'Lifetime lg(τ / years)'], -2, 3, 0.01, Math.log10(12), (v) => { const t = 10 ** v; return t < 1 ? `${fix(t * 365, 0)} ${L('天', 'days')}` : `${fmt(t, 3)} ${L('年', 'years')}`; }], ['cut', ['减排后剩下的排放', 'Emissions remaining after the cut'], 0, 150, 5, 50, (v) => `${v} %`]],
    btn: LIFE.map(([nm, t]) => [nm, { lt: Math.log10(t) }]).concat([[['完全停排', 'Stop entirely'], { cut: 0 }]]),
    figs: [[0.55, ['浓度（相对原来的稳态）对时间。灰色虚线是新的稳态，金线是减排的时刻。', 'Concentration (relative to the old steady state) against time. Grey dashed: the new steady state; gold: the moment of the cut.']]],
    note: ['单箱模型 dC/dt = S − C/τ 的解析解，假设污染物充分混合、按一级动力学去除。真实的大气不是一个箱子：甲烷的去除会反过来影响 OH，所以它的扰动寿命（约 12 年）比单纯对 OH 的寿命（约 9 年）长；CO₂ 根本不能用一个寿命描述，排放的 CO₂ 一部分几十年内进入海洋和陆地，一部分要上千年才能移除。所以这里没有放 CO₂。各物种的寿命是常引的量级，由编者录入，未逐条复核。', 'The analytical solution of the one-box model dC/dt = S − C/τ, assuming a well-mixed pollutant removed by first-order kinetics. The real atmosphere is not one box: methane removal feeds back on OH, so its perturbation lifetime (about 12 years) exceeds its lifetime against OH alone (about 9 years); CO₂ cannot be described by a single lifetime at all, since part of emitted CO₂ goes into the ocean and land within decades and part takes millennia to remove, which is why CO₂ is not offered here. Lifetimes are commonly quoted orders of magnitude typed by the editor and not rechecked.'],
    draw(s, f, c) {
      const tau = 10 ** s.lt, tc = 10, end = Math.min(3000, Math.max(30, tc + 5 * tau)), ts = K.lin(0, end, 401), k = s.cut / 100;
      const C = (t) => M.box(t, { S: 1 / tau, tau, C0: 1, tCut: tc, cut: k });
      const ymax = Math.max(1.1, k * 1.1);
      plot(f[0], { x: [0, end], y: [0, ymax], xl: L('时间 / 年', 'time / years'), yl: 'C / C₀', series: [{ xs: ts, ys: ts.map(C), color: c.accent, width: 2.6 }], marks: [{ x: tc, color: c.gold }], hmarks: [{ y: k, color: c.faint }] });
      const t90 = tau * Math.LN10, after10 = C(tc + 10);
      const tf = (t) => (t < 1 ? `${fix(t * 365, 0)} ${L('天', 'days')}` : `${fmt(t, 3)} ${L('年', 'years')}`);
      return [[['寿命', 'Lifetime'], tf(tau)], [['新稳态', 'New steady state'], `${fix(k * 100, 0)} %`, 1], [['走完 90 %', '90 % of the way'], tf(t90), 1], [['减排 10 年后', '10 years after'], `${fix(after10 * 100, 1)} %`]];
    },
  };

  // ── 原子经济性和 E 因子 ─────────────────────────────────────────────────
  // [名字, 产物, [[计量数, 反应物]…], 副产物说明]；第一个反应物是限量试剂
  const RX = {
    eochl: [['环氧乙烷：氯醇法', 'Ethylene oxide: chlorohydrin route'], 'C2H4O', [[1, 'C2H4'], [1, 'Cl2'], [1, 'Ca(OH)2']], ['CaCl₂ + H₂O', 'CaCl₂ + H₂O']],
    eodir: [['环氧乙烷：银催化直接氧化', 'Ethylene oxide: direct silver-catalysed oxidation'], 'C2H4O', [[1, 'C2H4'], [0.5, 'O2']], ['无（理想情况）', 'none (ideal)']],
    wittig: [['Wittig：环己酮 → 亚甲基环己烷', 'Wittig: cyclohexanone → methylenecyclohexane'], 'C7H12', [[1, 'C6H10O'], [1, 'C19H17P']], ['Ph₃PO', 'Ph₃PO']],
    da: [['Diels–Alder：丁二烯 + 马来酸酐', 'Diels–Alder: butadiene + maleic anhydride'], 'C8H8O3', [[1, 'C4H6'], [1, 'C4H2O3']], ['无', 'none']],
    ester: [['Fischer 酯化：乙酸 + 乙醇', 'Fischer esterification: acetic acid + ethanol'], 'C4H8O2', [[1, 'C2H4O2'], [1, 'C2H6O']], ['H₂O', 'H₂O']],
    suzuki: [['Suzuki 偶联：溴苯 + 苯硼酸', 'Suzuki coupling: bromobenzene + phenylboronic acid'], 'C12H10', [[1, 'C6H5Br'], [1, 'C6H7BO2'], [2, 'K2CO3']], ['KBr、B(OH)₃、KHCO₃ 等', 'KBr, B(OH)₃, KHCO₃ and so on']],
  };
  D.atom = {
    kind: 'exact',
    title: ['原子经济性和 E 因子', 'Atom economy and the E factor'],
    intro: ['选一个反应看原子经济性（只由计量式决定），再调产率、试剂过量和不回收的溶剂，看 E 因子（每千克产品的废物）怎样变。往往是溶剂而不是副产物决定了 E 因子。', 'Pick a reaction to see its atom economy (fixed by the stoichiometry), then adjust yield, reagent excess and unrecovered solvent to see the E factor (waste per kilogram of product). Solvent, more than by-products, often decides the E factor.'],
    sel: [['rx', ['反应', 'Reaction'], Object.entries(RX).map(([k, v]) => [k, v[0]]), 'eochl']],
    ctl: [['y', ['产率', 'Yield'], 10, 100, 1, 90, (v) => `${v} %`], ['ex', ['其他试剂过量', 'Excess of other reagents'], 0, 200, 5, 0, (v) => `${v} %`], ['sv', ['不回收的溶剂', 'Unrecovered solvent'], 0, 100, 0.5, 0, (v) => `${fix(v, 1)} kg/kg ${L('产品', 'product')}`]],
    btn: [[['理想的直接氧化', 'Ideal direct oxidation'], { rx: 'eodir', y: 100, ex: 0, sv: 0 }], [['氯醇法', 'Chlorohydrin route'], { rx: 'eochl', y: 90, ex: 10, sv: 0 }], [['实验室的 Wittig', 'A lab Wittig reaction'], { rx: 'wittig', y: 80, ex: 20, sv: 30 }], [['典型的药物合成步骤', 'A typical pharmaceutical step'], { rx: 'suzuki', y: 85, ex: 30, sv: 40 }]],
    figs: [[0.5, ['每千克产品带出多少千克别的东西：理论副产物、没反应和过量的原料、溶剂。', 'Kilograms of everything else per kilogram of product: theoretical by-products, unreacted and excess feed, solvent.']]],
    note: ['摩尔质量由化学式按标准原子量算出。原子经济性 = 产物摩尔质量 / Σ(计量数 × 反应物摩尔质量)。E 因子 = (投入的总质量 − 产品质量)/产品质量，这里按“每摩尔限量试剂”记账：过量只加在其他试剂上，没反应的原料、副产物和不回收的溶剂都算废物；水算不算废物各家做法不同，这里算。Wittig 的 C₁₉H₁₇P 是叶立德 Ph₃P=CH₂，它本身还要由季鏻盐和强碱制备，实际废物更多；Suzuki 的碳酸钾用量和副产物是简化写法，催化剂的钯量很少，没有计入。', 'Molar masses are computed from the formulas with standard atomic weights. Atom economy = product molar mass / Σ(coefficient × reactant molar mass). E factor = (total input mass − product mass)/product mass, booked here per mole of limiting reagent: excess is added to the other reagents only, and unreacted feed, by-products and unrecovered solvent all count as waste; water is counted too, though practice varies. The Wittig C₁₉H₁₇P is the ylide Ph₃P=CH₂, which must itself be made from a phosphonium salt and a strong base, so real waste is larger; the Suzuki potassium carbonate amount and by-products are simplified, and the small amount of palladium catalyst is not counted.'],
    draw(s, f, c) {
      const [, prod, rs, bp] = RX[s.rx], Mp = M.molarMass(prod), y = s.y / 100, ex = s.ex / 100;
      const ae = M.atomEconomy(prod, rs), sumR = rs.reduce((a, [n, fm]) => a + n * M.molarMass(fm), 0);
      const inputs = rs.reduce((a, [n, fm], i) => a + n * M.molarMass(fm) * (i ? 1 + ex : 1), 0), mp = y * Mp;
      const byp = (y * (sumR - Mp)) / mp, unr = (inputs - y * sumR) / mp, E = (inputs - mp) / mp + s.sv;
      const vals = [byp, unr, s.sv], top = Math.max(1, ...vals) * 1.15;
      const names = [L('副产物', 'by-products'), L('未反应和过量', 'unreacted & excess'), L('溶剂', 'solvent')];
      plot(f[0], { x: [0.4, 3.6], y: [0, top], xt: [1, 2, 3], xf: (t) => names[t - 1] || '', yl: L('kg / kg 产品', 'kg / kg product'), series: [{ xs: [1], ys: [byp], color: c.danger, bars: 0.5 }, { xs: [2], ys: [unr], color: c.gold, bars: 0.5 }, { xs: [3], ys: [s.sv], color: c.info, bars: 0.5 }] });
      return [[['原子经济性', 'Atom economy'], `${fix(ae * 100, 1)} %`, 1], [['副产物', 'By-products'], L(bp[0], bp[1])], [['E 因子', 'E factor'], fix(E, 2), 1], [['过程质量强度', 'PMI'], fix(E + 1, 2)], [['产物', 'Product'], `${fix(Mp, 2)} g/mol`]];
    },
  };
});
