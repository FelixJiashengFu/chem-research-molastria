'use strict';
// 化学学科馆 02 · 有机化学的四个演示：丁烷的扭转势与构象布居、环己烷的 A 值、pKa 判断酸碱反应、Hammett 图。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, pct, plot, flow, box, table } = K;

  // ── 扭转势与构象 ────────────────────────────────────────────────────────
  D.torsion = {
    kind: 'model',
    title: ['单键旋转：丁烷的能量曲线和构象布居', 'Rotation about a single bond: butane’s energy curve and conformer populations'],
    intro: ['调三个构象的能量和温度，看扭转势的形状和各构象的 Boltzmann 布居。', 'Set the energies of three conformations and the temperature to see the torsion potential and the Boltzmann populations of the conformers.'],
    ctl: [
      ['g', ['邻位交叉（φ = 60°）的能量', 'Energy of gauche (φ = 60°)'], 0, 10, 0.1, 3.8, (v) => `${fix(v, 1)} kJ/mol`],
      ['e', ['H/CH₃ 重叠（φ = 120°）', 'H/CH₃ eclipsed (φ = 120°)'], 4, 25, 0.5, 16, (v) => `${fix(v, 1)} kJ/mol`],
      ['s', ['顺叠（φ = 0°）', 'Syn (φ = 0°)'], 8, 30, 0.5, 19, (v) => `${fix(v, 1)} kJ/mol`],
      ['T', ['温度', 'Temperature'], 100, 600, 5, 298, (v) => `${v} K`],
    ],
    btn: [[['丁烷（教科书值）', 'Butane (textbook values)'], { g: 3.8, e: 16, s: 19, T: 298 }], [['乙烷式的三重对称', 'Ethane-like threefold'], { g: 0, e: 12, s: 12, T: 298 }], [['低温 150 K', 'Cold, 150 K'], { T: 150 }], [['高温 600 K', 'Hot, 600 K'], { T: 600 }]],
    figs: [[0.42, ['扭转势 V(φ)，反式在 180°。', 'Torsion potential V(φ), anti at 180°.']], [0.42, ['这个温度下各个二面角出现的概率（每度）。阴影是反式区（120°–240°）。', 'Probability of each dihedral angle at this temperature (per degree). Shaded: the anti region (120°–240°).']]],
    note: ['V₁、V₂、V₃ 由三个能量反解（见公式），所以曲线一定经过你设的三个点，但邻位交叉的极小值可能偏离 60° 一两度。真实丁烷的构象分布还和溶剂、振动的零点能有关；这里只算一维势上的经典 Boltzmann 分布。教科书值（3.8、16、19 kJ/mol）取自 Clayden 等的教材，编者录入，未逐条核对原始测量。', 'V₁, V₂ and V₃ are solved from the three energies (see the formula), so the curve always passes through the three points you set, though the gauche minimum may sit a degree or two away from 60°. Real butane populations also depend on solvent and zero-point vibration; this computes only the classical Boltzmann distribution on a one-dimensional potential. The textbook values (3.8, 16 and 19 kJ/mol) are from Clayden and co-workers’ textbook, typed in by the editor, not checked against the original measurements.'],
    draw(s, f, c) {
      const [V1, V2, V3] = M.torsionFit(s.g, s.e, s.s), xs = K.lin(0, 360, 361), ys = xs.map((d) => M.torsion(d, V1, V2, V3));
      const pop = M.torsionPop(V1, V2, V3, s.T), top = Math.max(...ys);
      plot(f[0], { x: [0, 360], y: [Math.min(0, ...ys) - 1, top * 1.12 + 1], xt: [0, 60, 120, 180, 240, 300, 360], xf: (t) => `${t}°`, xl: 'φ', yl: 'V / kJ mol⁻¹', series: [{ xs, ys, color: c.accent, width: 2.4 }], hmarks: [{ y: (M.R * s.T) / 1000, color: c.gold }], texts: [{ x: 180, y: 0, s: L('反式', 'anti'), align: 'center', dy: -8 }, { x: 60, y: M.torsion(60, V1, V2, V3), s: L('邻位交叉', 'gauche'), align: 'center', dy: -8 }, { x: 300, y: M.torsion(300, V1, V2, V3), s: L('邻位交叉', 'gauche'), align: 'center', dy: -8 }, { x: 4, y: (M.R * s.T) / 1000, s: `RT = ${fix((M.R * s.T) / 1000, 2)} kJ/mol`, dy: -5, color: c.gold }] });
      const dens = pop.density.concat(pop.density[0]);
      plot(f[1], { x: [0, 360], y: [0, Math.max(...dens) * 1.15], xt: [0, 60, 120, 180, 240, 300, 360], xf: (t) => `${t}°`, xl: 'φ', yl: L('概率 / 度', 'probability / deg'), bands: [{ x0: 120, x1: 240, color: c.gold }], series: [{ xs, ys: dens, color: c.info, width: 2, fill: true }] });
      const ratio = pop.anti / pop.gauche;
      return [[['V₁, V₂, V₃', 'V₁, V₂, V₃'], `${fix(V1, 2)}, ${fix(V2, 2)}, ${fix(V3, 2)} kJ/mol`], [['反式', 'Anti'], pct(pop.anti), 1], [['两个邻位交叉合计', 'Both gauche together'], pct(pop.gauche), 1], [['反式 : 邻位交叉', 'Anti : gauche'], `${fix(ratio, 2)} : 1`], [['RT', 'RT'], `${fix((M.R * s.T) / 1000, 2)} kJ/mol`]];
    },
  };

  // ── 环己烷的 A 值 ───────────────────────────────────────────────────────
  // A 值（kcal/mol，Eliel 和 Wilen 汇编里常引的数值；OH、卤素等随溶剂变化，这里取一个代表值），演示里换算成 kJ/mol
  const A = { H: 0, F: 0.25, CN: 0.2, I: 0.47, Br: 0.48, Cl: 0.53, OMe: 0.6, OH: 0.87, CO2Me: 1.27, CO2H: 1.4, NH2: 1.4, Me: 1.74, Et: 1.79, iPr: 2.21, Ph: 2.8, tBu: 4.9 };
  const NAME = { H: ['（无）', '(none)'], F: ['氟', 'F'], CN: ['氰基', 'CN'], I: ['碘', 'I'], Br: ['溴', 'Br'], Cl: ['氯', 'Cl'], OMe: ['甲氧基', 'OMe'], OH: ['羟基', 'OH'], CO2Me: ['甲酯基', 'CO₂Me'], CO2H: ['羧基', 'CO₂H'], NH2: ['氨基', 'NH₂'], Me: ['甲基', 'methyl'], Et: ['乙基', 'ethyl'], iPr: ['异丙基', 'isopropyl'], Ph: ['苯基', 'phenyl'], tBu: ['叔丁基', 'tert-butyl'] };
  const opts = (skipH) => Object.keys(A).filter((k) => !skipH || k !== 'H').map((k) => [k, NAME[k]]);
  D.chair = {
    kind: 'data',
    title: ['环己烷椅式：取代基去平伏还是直立', 'The cyclohexane chair: equatorial or axial'],
    intro: ['选一个取代基（可以再加一个 1,4 位的取代基），看两种椅式的自由能差和平衡比例怎样随温度变。', 'Pick a substituent (optionally a second one at C-4) to see the free-energy difference between the two chairs and how the equilibrium shifts with temperature.'],
    sel: [['a', ['1 位取代基', 'Substituent at C-1'], opts(true), 'Me'], ['b', ['4 位取代基', 'Substituent at C-4'], opts(false), 'H'], ['rel', ['两者关系', 'Relationship'], [['trans', ['反式（同时平伏或同时直立）', 'trans (both equatorial or both axial)']], ['cis', ['顺式（一个平伏、一个直立）', 'cis (one equatorial, one axial)']]], 'trans']],
    ctl: [['T', ['温度', 'Temperature'], 150, 450, 5, 298, (v) => `${v} K`]],
    btn: [[['甲基环己烷', 'Methylcyclohexane'], { a: 'Me', b: 'H', T: 298 }], [['叔丁基锁环', 'tert-Butyl locks the ring'], { a: 'tBu', b: 'H' }], [['顺-1-叔丁基-4-甲基', 'cis-1-tBu-4-Me'], { a: 'tBu', b: 'Me', rel: 'cis' }], [['反-1,4-二甲基', 'trans-1,4-dimethyl'], { a: 'Me', b: 'Me', rel: 'trans' }]],
    figs: [['html', ['', '']], [0.42, ['优势椅式的比例对温度。金色点是当前温度。', 'Fraction of the preferred chair against temperature. The gold dot is the current temperature.']]],
    note: ['A 值按 1,4 位取代基互不影响相加，这对 1,4 位通常成立；1,2 和 1,3 位的取代基彼此有额外作用（1,3-双直立的两个取代基相撞约 15 kJ/mol 以上），这里不算。羟基、卤素的 A 值随溶剂变化可达 ±0.2 kcal/mol；数值由编者按 Eliel 和 Wilen《Stereochemistry of Organic Compounds》常引的汇编录入，未逐条核对原始文献。', 'A values are added assuming the 1,4 substituents do not interact, which usually holds for 1,4; 1,2 and 1,3 substituents interact further (two 1,3-diaxial substituents clash by more than about 15 kJ/mol), not modelled here. A values for OH and the halogens vary by up to ±0.2 kcal/mol with solvent; the numbers were typed in by the editor from the compilation commonly quoted from Eliel and Wilen’s Stereochemistry of Organic Compounds, not checked against the original papers.'],
    draw(s, f, c) {
      const a = A[s.a] * 4.184, b = A[s.b] * 4.184, one = s.b === 'H';
      // 椅式 I：1 位平伏。trans 时 4 位也平伏；cis 时 4 位直立。dG = G(I) − G(II)
      const dG = one ? -a : s.rel === 'trans' ? -(a + b) : -(a - b);
      const pI = 1 / (1 + Math.exp((dG * 1000) / (M.R * s.T))), win = pI >= 0.5 ? pI : 1 - pI;
      const nm = (k) => L(...NAME[k]), eq = L('平伏', 'eq'), ax = L('直立', 'ax');
      const I = one ? `${nm(s.a)} ${eq}` : `${nm(s.a)} ${eq} · ${nm(s.b)} ${s.rel === 'trans' ? eq : ax}`;
      const II = one ? `${nm(s.a)} ${ax}` : `${nm(s.a)} ${ax} · ${nm(s.b)} ${s.rel === 'trans' ? ax : eq}`;
      f[0].innerHTML = flow(box(L('椅式 I', 'Chair I'), `${I} · ${pct(pI)}`, pI >= 0.5 ? 'is-on' : ''), box(L('环翻转', 'ring flip'), `ΔG = ${fix(Math.abs(dG), 1)} kJ/mol`), box(L('椅式 II', 'Chair II'), `${II} · ${pct(1 - pI)}`, pI < 0.5 ? 'is-on' : ''));
      const Ts = K.lin(150, 450, 121), fr = Ts.map((t) => { const p = 1 / (1 + Math.exp((-Math.abs(dG) * 1000) / (M.R * t))); return 100 * p; });
      plot(f[1], { x: [150, 450], y: [50, 100.5], xl: 'T / K', yl: L('优势椅式 / %', 'preferred chair / %'), series: [{ xs: Ts, ys: fr, color: c.accent, width: 2.4 }], marks: [{ x: s.T, y: 100 * win, color: c.gold }] });
      const K_ = Math.exp((Math.abs(dG) * 1000) / (M.R * s.T));
      return [[['两种椅式的自由能差', 'Free-energy difference'], `${fix(Math.abs(dG), 2)} kJ/mol`, 1], [['平衡常数 K', 'Equilibrium constant K'], fmt(K_, 3)], [['优势椅式', 'Preferred chair'], `${pI >= 0.5 ? L('I', 'I') : L('II', 'II')} · ${pct(win)}`, 1], [['A 值（kJ/mol）', 'A values (kJ/mol)'], one ? fix(a, 2) : `${fix(a, 2)}、${fix(b, 2)}`]];
    },
  };

  // ── pKa 判断酸碱反应 ────────────────────────────────────────────────────
  // [键, 酸（中、英）, pKa（水中约值）, 共轭碱（中、英）]
  const ACIDS = [
    ['HCl', ['HCl', 'HCl'], -7, ['Cl⁻', 'Cl⁻']], ['H3O', ['H₃O⁺', 'H₃O⁺'], -1.7, ['水', 'water']], ['TFA', ['三氟乙酸', 'trifluoroacetic acid'], 0.5, ['三氟乙酸根', 'trifluoroacetate']], ['HF', ['HF', 'HF'], 3.2, ['F⁻', 'F⁻']],
    ['AcOH', ['乙酸', 'acetic acid'], 4.76, ['乙酸根', 'acetate']], ['pyH', ['吡啶鎓', 'pyridinium'], 5.2, ['吡啶', 'pyridine']], ['H2CO3', ['碳酸', 'carbonic acid'], 6.35, ['碳酸氢根', 'bicarbonate']], ['acac', ['乙酰丙酮', 'acetylacetone'], 9.0, ['乙酰丙酮负离子', 'acac⁻']],
    ['NH4', ['NH₄⁺', 'NH₄⁺'], 9.25, ['NH₃', 'NH₃']], ['PhOH', ['苯酚', 'phenol'], 10.0, ['苯氧负离子', 'phenoxide']], ['MeNO2', ['硝基甲烷', 'nitromethane'], 10.2, ['硝基甲烷负离子', 'nitronate']], ['Et3NH', ['三乙铵', 'triethylammonium'], 10.75, ['三乙胺', 'triethylamine']],
    ['malonate', ['丙二酸二乙酯', 'diethyl malonate'], 13, ['丙二酸酯负离子', 'malonate enolate']], ['H2O', ['水', 'water'], 15.7, ['OH⁻', 'hydroxide']], ['EtOH', ['乙醇', 'ethanol'], 16, ['乙醇钠（EtO⁻）', 'ethoxide']], ['tBuOH', ['叔丁醇', 'tert-butanol'], 18, ['叔丁醇钾（tBuO⁻）', 'tert-butoxide']],
    ['acetone', ['丙酮', 'acetone'], 19.3, ['丙酮烯醇负离子', 'acetone enolate']], ['EtOAc', ['乙酸乙酯', 'ethyl acetate'], 25, ['酯烯醇负离子', 'ester enolate']], ['ethyne', ['乙炔', 'ethyne'], 25, ['乙炔负离子', 'acetylide']], ['H2', ['H₂', 'H₂'], 35, ['NaH（H⁻）', 'NaH (H⁻)']],
    ['iPr2NH', ['二异丙胺', 'diisopropylamine'], 36, ['LDA', 'LDA']], ['NH3', ['NH₃', 'NH₃'], 38, ['氨基钠（NH₂⁻）', 'sodium amide']], ['butane', ['丁烷', 'butane'], 50, ['正丁基锂', 'n-butyllithium']],
  ];
  const byKey = Object.fromEntries(ACIDS.map((a) => [a[0], a]));
  D.pka = {
    kind: 'data',
    title: ['两个 pKa 判断一个酸碱反应', 'Two pKa values decide an acid–base reaction'],
    intro: ['选一个酸和一个碱。平衡偏向较弱的酸那一边，K = 10^ΔpKa。', 'Pick an acid and a base. Equilibrium favours the weaker acid, K = 10^ΔpKa.'],
    sel: [['ha', ['酸 HA', 'Acid HA'], ACIDS.map((a) => [a[0], [`${a[1][0]}（${a[2]}）`, `${a[1][1]} (${a[2]})`]]), 'acetone'], ['hb', ['碱 B⁻（括号里是它的共轭酸的 pKa）', 'Base B⁻ (pKa of its conjugate acid in brackets)'], ACIDS.map((a) => [a[0], [`${a[3][0]}（${a[2]}）`, `${a[3][1]} (${a[2]})`]]), 'EtOH']],
    btn: [[['丙酮 + 乙醇钠', 'Acetone + ethoxide'], { ha: 'acetone', hb: 'EtOH' }], [['丙酮 + LDA', 'Acetone + LDA'], { ha: 'acetone', hb: 'iPr2NH' }], [['苯酚 + 碳酸氢钠', 'Phenol + bicarbonate'], { ha: 'PhOH', hb: 'H2CO3' }], [['乙酸 + 碳酸氢钠', 'Acetic acid + bicarbonate'], { ha: 'AcOH', hb: 'H2CO3' }]],
    figs: [['html', ['', '']], [0.6, ['pKa 尺（水中约值）。金色是你选的酸，绿色是所选碱的共轭酸。', 'The pKa ladder (approximate values in water). Gold: your acid; green: the conjugate acid of your base.']]],
    note: ['数值是常用的水中近似值，各来源相差一个单位左右；大于约 20 的值在水里测不到，是从 DMSO 等溶剂外推的，只适合比较数量级。水的 pKa 取 15.7（以纯水的浓度 55.5 mol/L 计；若以活度 1 计则为 14）。真实反应还要看溶剂、反离子和动力学：平衡有利不等于反应快。', 'Values are common approximate figures in water; sources differ by about one unit, and values above about 20 cannot be measured in water and are extrapolated from DMSO and other solvents, good only for orders of magnitude. Water is taken as 15.7 (counting pure water as 55.5 mol/L; it is 14 with unit activity). Real reactions also depend on solvent, counter-ion and kinetics: a favourable equilibrium is not necessarily a fast reaction.'],
    draw(s, f, c) {
      const ha = byKey[s.ha], hb = byKey[s.hb], r = M.acidBase(ha[2], hb[2]);
      const sorted = ACIDS.slice().sort((p, q) => p[2] - q[2]);
      const col = (i) => [0.02, 0.27, 0.52, 0.77][i % 4];
      f[0].innerHTML = `<p class="chm-eq">${L(...ha[1])} + ${L(...hb[3])} ⇌ ${L(...ha[3])} + ${L(...hb[1])}</p>`;
      plot(f[1], {
        x: [0, 1], y: [-10, 53], xt: [], yl: 'pKa',
        series: [{ xs: sorted.map((_, i) => col(i)), ys: sorted.map((a) => a[2]), color: c.muted, dots: 3 }],
        texts: sorted.map((a, i) => ({ x: col(i), y: a[2], s: `${L(...a[1])} ${fmt(a[2])}`, dx: 7, dy: 4, color: a[0] === s.ha ? c.gold : a[0] === s.hb ? c.accent : c.ink2 })),
        marks: [], hmarks: [{ y: ha[2], color: c.gold, dash: [6, 3] }, { y: hb[2], color: c.accent, dash: [6, 3] }],
      });
      const verdict = r.logK > 2 ? L('几乎完全向右', 'essentially complete to the right') : r.logK > 0 ? L('偏向右边', 'favours the right') : r.logK > -2 ? L('偏向左边，但有可观的量', 'favours the left, but with a useful amount') : L('几乎不反应', 'barely proceeds');
      return [[['log K', 'log K'], fix(r.logK, 2), 1], [['K', 'K'], fmt(r.K, 3)], [['1 : 1 时的转化率', 'Conversion at 1 : 1'], pct(r.x, r.x > 0.999 || r.x < 0.001 ? 3 : 1), 1], [['结论', 'Verdict'], verdict]];
    },
  };

  // ── Hammett 图 ──────────────────────────────────────────────────────────
  // σ_m、σ_p、σ_p⁺（Hansch、Leo、Taft 1991 汇编里的常用值，编者录入）
  const SIG = [['NMe₂', -0.16, -0.83, -1.7], ['NH₂', -0.16, -0.66, -1.3], ['OH', 0.12, -0.37, -0.92], ['OMe', 0.12, -0.27, -0.78], ['Me', -0.07, -0.17, -0.31], ['H', 0, 0, 0], ['F', 0.34, 0.06, -0.07], ['Cl', 0.37, 0.23, 0.11], ['Br', 0.39, 0.23, 0.15], ['I', 0.35, 0.18, 0.14], ['CO₂Et', 0.37, 0.45, 0.48], ['COMe', 0.38, 0.5, 0.5], ['CF₃', 0.43, 0.54, 0.61], ['CN', 0.56, 0.66, 0.66], ['NO₂', 0.71, 0.78, 0.79]];
  const RX = {
    benzoic: { rho: 1.0, plus: false, t: ['取代苯甲酸在水中电离（25 °C，定义 ρ = 1）', 'Ionisation of benzoic acids in water (25 °C, ρ = 1 by definition)'], y: ['log(K_X/K_H)', 'log(K_X/K_H)'] },
    ester: { rho: 2.5, plus: false, t: ['苯甲酸乙酯的碱性水解（含水乙醇）', 'Alkaline hydrolysis of ethyl benzoates (aqueous ethanol)'], y: ['log(k_X/k_H)', 'log(k_X/k_H)'] },
    phenylacetic: { rho: 0.49, plus: false, t: ['苯乙酸在水中电离：多一个 CH₂，效应衰减', 'Ionisation of phenylacetic acids in water: one more CH₂ damps the effect'], y: ['log(K_X/K_H)', 'log(K_X/K_H)'] },
    cumyl: { rho: -4.54, plus: true, t: ['枯基氯的溶剂解（90 % 丙酮水溶液，用 σ⁺）', 'Solvolysis of cumyl chlorides (90 % aqueous acetone, using σ⁺)'], y: ['log(k_X/k_H)', 'log(k_X/k_H)'] },
  };
  D.hammett = {
    kind: 'data',
    title: ['Hammett 图：把取代基效应变成一条直线', 'The Hammett plot: substituent effects on a straight line'],
    intro: ['选一个反应和取代基的位置，看各取代基落在斜率 ρ 的直线上的位置和对应的速率（或平衡常数）倍数。', 'Pick a reaction and a ring position to see where each substituent falls on the line of slope ρ and the factor it multiplies the rate (or equilibrium constant) by.'],
    sel: [['rx', ['反应', 'Reaction'], Object.entries(RX).map(([k, v]) => [k, v.t]), 'ester'], ['pos', ['取代位置', 'Position'], [['p', ['对位', 'para']], ['m', ['间位', 'meta']]], 'p'], ['x', ['看一个取代基', 'Highlight a substituent'], SIG.map((r, i) => [String(i), [r[0], r[0]]]), '14']],
    btn: [[['对硝基 + 酯水解', 'p-NO₂ + ester hydrolysis'], { rx: 'ester', pos: 'p', x: '14' }], [['对甲氧基 + 枯基氯', 'p-OMe + cumyl chloride'], { rx: 'cumyl', pos: 'p', x: '3' }], [['苯乙酸的衰减', 'Damping in phenylacetic acid'], { rx: 'phenylacetic', pos: 'p', x: '14' }]],
    figs: [[0.6, ['横轴是取代基常数，纵轴是 ρσ。点越靠右越吸电子。', 'Substituent constant across, ρσ up. Further right means more electron-withdrawing.']]],
    note: ['σ 值和 ρ 值由编者按 Hansch、Leo 和 Taft 的汇编 [@hansch1991] 以及教科书里常引的数值录入，没有逐条核对原表。枯基氯溶剂解的 ρ⁺ = −4.54 来自 Brown 和 Okamoto 的经典测定；间位取代基没有直接共振，这时 σ_m⁺ 和 σ_m 相近，演示里直接用 σ_m。真实数据点会在直线附近散开，这里画的是方程预测，不是实测点。', 'The σ and ρ values were typed in by the editor from the compilation by Hansch, Leo and Taft [@hansch1991] and commonly quoted textbook values, not checked line by line against the original tables. ρ⁺ = −4.54 for cumyl chloride solvolysis is Brown and Okamoto’s classic measurement; meta substituents have no direct resonance, so σ_m⁺ is close to σ_m and σ_m is used. Real data scatter about the line; the points drawn are the equation’s predictions, not measurements.'],
    draw(s, f, c) {
      const rx = RX[s.rx], col = s.pos === 'm' ? 1 : rx.plus ? 3 : 2, xs = SIG.map((r) => r[col]), ys = xs.map((x) => rx.rho * x);
      const lo = Math.min(...xs) - 0.15, hi = Math.max(...xs) + 0.15, ylo = Math.min(...ys, rx.rho * lo), yhi = Math.max(...ys, rx.rho * hi), pad = (yhi - ylo) * 0.12 + 0.1;
      const i = Number(s.x), sx = xs[i], sy = ys[i];
      plot(f[0], { x: [lo, hi], y: [ylo - pad, yhi + pad], xl: s.pos === 'm' ? 'σ_m' : rx.plus ? 'σ_p⁺' : 'σ_p', yl: L(...rx.y), series: [{ xs: [lo, hi], ys: [rx.rho * lo, rx.rho * hi], color: c.faint, width: 1.5, dash: [5, 4] }, { xs, ys, color: c.accent, dots: 4 }], marks: [{ x: sx, y: sy, color: c.gold }], texts: SIG.map((r, j) => ({ x: xs[j], y: ys[j], s: r[0], dx: 6, dy: j % 2 ? 14 : -6, color: j === i ? c.gold : c.ink2 })) });
      const fac = M.hammett(rx.rho, sx);
      const rows = [[['ρ', 'ρ'], `${rx.rho > 0 ? '+' : ''}${fix(rx.rho, 2)}`], [[`${SIG[i][0]} 的 σ`, `σ for ${SIG[i][0]}`], fix(sx, 2)], [['log(k_X/k_H) = ρσ', 'log(k_X/k_H) = ρσ'], fix(sy, 2)], [['倍数 k_X/k_H', 'Factor k_X/k_H'], fmt(fac, 3), 1]];
      if (s.rx === 'benzoic') rows.push([['预测 pKa（苯甲酸 4.20 − σ）', 'Predicted pKa (benzoic acid 4.20 − σ)'], fix(4.2 - sx, 2), 1]);
      return rows;
    },
  };
});
