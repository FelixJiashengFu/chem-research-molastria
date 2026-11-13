'use strict';
// 化学学科馆 07 · 配位与金属有机化学的三个演示：配体场分裂与高低自旋、逐级配合与螯合效应、18 电子计数。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, pct, plot, levels, table, box, flow } = K;
  const SUPD = (n) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

  // ── 配体场和高低自旋 ────────────────────────────────────────────────────
  // [显示名, d 电子数, 几何, Δ（cm⁻¹）, P（cm⁻¹）]：教科书常引的近似值，编者录入
  const CX = {
    ti: ['[Ti(H₂O)₆]³⁺', 1, 'oct', 20300, 0], cr: ['[Cr(H₂O)₆]³⁺', 3, 'oct', 17400, 0], feaq: ['[Fe(H₂O)₆]²⁺', 6, 'oct', 10400, 17600], fecn: ['[Fe(CN)₆]⁴⁻', 6, 'oct', 33000, 17600],
    conh3: ['[Co(NH₃)₆]³⁺', 6, 'oct', 22900, 21000], cof6: ['[CoF₆]³⁻', 6, 'oct', 13100, 21000], mnaq: ['[Mn(H₂O)₆]²⁺', 5, 'oct', 7800, 25500], cuaq: ['[Cu(H₂O)₆]²⁺', 9, 'oct', 12600, 0],
    cocl4: ['[CoCl₄]²⁻', 7, 'tet', 3300, 22500], nicn4: ['[Ni(CN)₄]²⁻', 8, 'sq', 25000, 15000],
  };
  const GEO = { oct: ['八面体', 'octahedral'], tet: ['四面体', 'tetrahedral'], sq: ['平面正方形', 'square planar'] };
  D.ligandfield = {
    kind: 'model',
    title: ['配体场分裂、高低自旋和颜色', 'Ligand-field splitting, high and low spin, and colour'],
    intro: ['选一个配合物，或者自己调 d 电子数、几何、分裂能 Δ 和成对能 P，看电子怎样填、有几个未成对电子、CFSE 是多少。', 'Pick a complex, or set the d-electron count, geometry, splitting Δ and pairing energy P yourself, to see how electrons fill, how many are unpaired and what the CFSE is.'],
    sel: [['g', ['几何', 'Geometry'], Object.entries(GEO).map(([k, v]) => [k, v]), 'oct']],
    ctl: [['n', ['d 电子数', 'd electrons'], 1, 10, 1, 6, (v) => `d${SUPD(v)}`], ['D', ['分裂能 Δ', 'Splitting Δ'], 2000, 40000, 100, 10400, (v) => `${v} cm⁻¹`], ['P', ['成对能 P', 'Pairing energy P'], 5000, 30000, 100, 17600, (v) => `${v} cm⁻¹`]],
    btn: Object.entries(CX).map(([, v]) => [[v[0], v[0]], { n: v[1], g: v[2], D: v[3], P: v[4] || 20000 }]),
    figs: [[0.6, ['d 轨道的能级（以 Δ 为单位，按比例画）和电子。', 'd-orbital levels (to scale, in units of Δ) and electrons.']], ['html', ['吸收和看到的颜色（只对 d¹、d⁹、高自旋 d⁴ 和 d⁶ 这类只有一个自旋允许跃迁的体系大致成立）。', 'Absorbed and perceived colour (roughly valid only for d¹, d⁹, high-spin d⁴ and d⁶, which have a single spin-allowed band).']]],
    note: ['晶体场模型：只排轨道顺序和填充，用“每多一对电子付出 P”比较高低自旋。平面正方形的轨道能量用角重叠模型常引的相对值。Δ 和 P 是教科书常引的近似值（如 [Fe(H₂O)₆]²⁺ Δo ≈ 10 400 cm⁻¹、Fe²⁺ 的 P ≈ 17 600 cm⁻¹），由编者录入，未逐条复核；真实的吸收谱有多个谱带，要用 Tanabe–Sugano 图读，颜色只是示意。', 'A crystal-field model: it only orders and fills the orbitals, comparing high and low spin by charging P for each electron pair. Square-planar orbital energies use commonly quoted angular-overlap values. Δ and P are approximate textbook values (for example Δo ≈ 10 400 cm⁻¹ for [Fe(H₂O)₆]²⁺ and P ≈ 17 600 cm⁻¹ for Fe²⁺) typed by the editor and not rechecked; real spectra have several bands that need a Tanabe–Sugano diagram, so the colour is only indicative.'],
    draw(s, f, c) {
      const r = M.ligandField(s.n, s.g, s.D, s.P), groups = [];
      r.orbs.forEach((o, i) => { const g = groups.find((q) => q.name === o.name); if (g) g.ks.push(i); else groups.push({ name: o.name, e: o.e, ks: [i] }); });
      const ys = groups.map((g) => g.e);
      levels(f[0], { y: [Math.min(...ys) - 0.35, Math.max(...ys) + 0.45], yl: 'E / Δ', levels: groups.map((g) => ({ e: g.e, n: g.ks.length, spins: g.ks.map((k) => r.occ[k]), label: g.name, color: g.e < 0 ? c.accent : c.danger })) });
      const lam = 1e7 / s.D, inVis = lam >= 380 && lam <= 780, rgb = inVis ? M.waveRGB(lam) : null, comp = rgb ? rgb.map((v) => 255 - v) : null;
      const sw = (col, t) => `<div class="chm-box"><b>${t}</b><span style="display:block;height:34px;border-radius:6px;margin-top:4px;background:${col ? `rgb(${col.join(',')})` : 'transparent'};border:1px solid var(--line)"></span></div>`;
      f[1].innerHTML = flow(sw(rgb, L(`吸收 ${fix(lam, 0)} nm`, `absorbs ${fix(lam, 0)} nm`)), sw(comp, inVis ? L('看到的颜色（补色，约）', 'seen (complement, approx.)') : L('吸收不在可见区', 'absorption outside the visible')));
      const cf = r.cfse * s.D;
      return [[['几何', 'Geometry'], L(GEO[s.g][0], GEO[s.g][1])], [['自旋态', 'Spin state'], r.spin === 'high' ? L('高自旋', 'high spin') : L('低自旋', 'low spin'), 1], [['未成对电子', 'Unpaired electrons'], String(r.unpaired), 1], [['纯自旋磁矩', 'Spin-only moment'], `${fix(r.muSO, 2)} μB`], [['CFSE（不含成对能）', 'CFSE (excluding pairing)'], `${fix(r.cfse, 2)} Δ = ${fmt(cf * 0.011963, 3)} kJ/mol`], [['Δ 和 P 谁大', 'Δ against P'], s.D > s.P ? 'Δ > P' : 'Δ < P']];
    },
  };

  // ── 逐级配合和螯合效应 ──────────────────────────────────────────────────
  // 逐级 log K（25 °C，离子强度约 0–1 mol/L 的文献常引值，编者录入）
  const SYS = {
    cunh3: [['Cu²⁺–NH₃', 'Cu²⁺–NH₃'], [4.31, 3.67, 3.04, 2.30], 'NH₃', 1], ninh3: [['Ni²⁺–NH₃', 'Ni²⁺–NH₃'], [2.80, 2.24, 1.73, 1.19, 0.75, 0.03], 'NH₃', 1], nien: [['Ni²⁺–乙二胺', 'Ni²⁺–ethylenediamine'], [7.52, 6.28, 4.26], 'en', 2],
  };
  D.speciation = {
    kind: 'exact',
    title: ['逐级配合和螯合效应', 'Stepwise complexation and the chelate effect'],
    intro: ['选一个体系，看各种配合物 ML_i 的分数随游离配体浓度怎样变化；Ni²⁺ 的两个体系可以按配位 N 原子的浓度直接比较。', 'Pick a system to see how the fractions of each ML_i change with free-ligand concentration; the two Ni²⁺ systems can be compared directly at the same concentration of donor N atoms.'],
    sel: [['sys', ['体系', 'System'], Object.entries(SYS).map(([k, v]) => [k, v[0]]), 'cunh3']],
    ctl: [['lg', ['配位 N 原子的浓度 lg[N]', 'Donor-N concentration lg[N]'], -8, 0, 0.05, -3, (v) => `[N] = ${fmt(10 ** v, 2)} mol/L`]],
    btn: [[['Cu²⁺–NH₃（Bjerrum 的经典体系）', 'Cu²⁺–NH₃ (Bjerrum’s classic)'], { sys: 'cunh3', lg: -3 }], [['Ni²⁺ 与 NH₃', 'Ni²⁺ with NH₃'], { sys: 'ninh3', lg: -1 }], [['Ni²⁺ 与乙二胺：同样的 N 浓度', 'Ni²⁺ with en at the same N concentration'], { sys: 'nien', lg: -1 }]],
    figs: [[0.55, ['各物种的分数对 lg[N]（N 是配位氮原子的游离浓度；乙二胺每个分子两个 N）。竖线是当前浓度。', 'Fraction of each species against lg[N] (free donor-N concentration; ethylenediamine has two N per molecule). The vertical line is the current concentration.']], [0.42, ['Ni²⁺ 体系：游离 Ni²⁺ 的分数，NH₃ 和乙二胺在相同 N 浓度下对比。Cu²⁺ 体系：平均配体数 n̄（生成函数）。', 'Ni²⁺ systems: fraction of free Ni²⁺, NH₃ against ethylenediamine at the same N concentration. Cu²⁺: the mean ligand number n̄ (formation function).']]],
    note: ['物种分布由累积稳定常数精确算出：α_i = β_i[L]^i/Σβ_j[L]^j，[L] 是游离配体浓度。没有计入 NH₃ 和乙二胺的质子化（真实溶液里要按 pH 求条件常数）和活度系数。log K 是文献常引值（Cu²⁺–NH₃ 来自 Bjerrum 的测量），由编者录入，未逐条复核。', 'Species distributions follow exactly from the overall constants: α_i = β_i[L]^i/Σβ_j[L]^j, with [L] the free-ligand concentration. Protonation of NH₃ and ethylenediamine (in real solutions one uses conditional constants at the given pH) and activity coefficients are not included. The log K are commonly quoted literature values (Cu²⁺–NH₃ from Bjerrum’s measurements) typed by the editor and not rechecked.'],
    draw(s, f, c) {
      const [, lk, lig, nN] = SYS[s.sys], ps = K.lin(-8, 0, 241), cols = [c.muted, c.info, c.accent, c.gold, c.danger, c.violet || c.ok, c.ok];
      const at = (lgN) => M.stepwise(lk, 10 ** lgN / nN);
      const series = lk.map((_, i) => i).concat(lk.length).map((i) => ({ xs: ps, ys: ps.map((p) => at(p).frac[i]), color: cols[i % cols.length], width: 2, label: i === 0 ? 'M' : `ML${i > 1 ? SUPD(i) : ''}` }));
      plot(f[0], { x: [-8, 0], y: [0, 1.05], xl: 'lg[N]', yl: L('分数', 'Fraction'), series, marks: [{ x: s.lg, color: c.gold }] });
      if (s.sys !== 'cunh3') plot(f[1], { x: [-8, 0], y: [-12, 0.5], xl: 'lg[N]', yl: 'lg α(Ni²⁺)', series: [{ xs: ps, ys: ps.map((p) => Math.log10(M.stepwise(SYS.ninh3[1], 10 ** p).frac[0])), color: c.info, width: 2, label: 'NH₃' }, { xs: ps, ys: ps.map((p) => Math.log10(M.stepwise(SYS.nien[1], 10 ** p / 2).frac[0])), color: c.accent, width: 2, label: L('乙二胺', 'en') }], marks: [{ x: s.lg, color: c.gold }] });
      else plot(f[1], { x: [-8, 0], y: [0, 4.2], xl: 'lg[N]', yl: 'n̄', series: [{ xs: ps, ys: ps.map((p) => at(p).nbar), color: c.accent, width: 2.2 }], marks: [{ x: s.lg, y: at(s.lg).nbar, color: c.gold }] });
      const r = at(s.lg), main = r.frac.indexOf(Math.max(...r.frac));
      const rows = [[['游离配体浓度', 'Free-ligand concentration'], `[${lig}] = ${fmt(10 ** s.lg / nN, 3)} mol/L`], [['平均配体数 n̄', 'Mean ligand number n̄'], fix(r.nbar, 2), 1], [['主要物种', 'Main species'], `${main === 0 ? 'M' : `ML${main > 1 ? SUPD(main) : ''}`}（${pct(r.frac[main])}）`], [['游离金属离子', 'Free metal ion'], pct(r.frac[0], 2)]];
      if (s.sys !== 'cunh3') { const a = M.stepwise(SYS.ninh3[1], 10 ** s.lg).frac[0], b = M.stepwise(SYS.nien[1], 10 ** s.lg / 2).frac[0]; rows.push([['游离 Ni²⁺：NH₃ / en 之比', 'Free Ni²⁺: NH₃ / en ratio'], fmt(a / b, 3), 1]); }
      return rows;
    },
  };

  // ── 18 电子计数 ─────────────────────────────────────────────────────────
  const METALS = { Ti: 4, Zr: 4, V: 5, Cr: 6, Mo: 6, W: 6, Mn: 7, Re: 7, Fe: 8, Ru: 8, Co: 9, Rh: 9, Ir: 9, Ni: 10, Pd: 10, Pt: 10 };
  // 预设：金属、L 配体数（CO、膦、η²-烯烃）、X 配体数（H、卤素、烷基、芳基）、η⁵-Cp（L₂X）、金属–金属键、电荷
  const PRE = [
    ['Fe(CO)₅', 'Fe(CO)₅', 'Fe', 5, 0, 0, 0, 0], ['Cr(CO)₆', 'Cr(CO)₆', 'Cr', 6, 0, 0, 0, 0], ['Ni(CO)₄', 'Ni(CO)₄', 'Ni', 4, 0, 0, 0, 0],
    ['二茂铁 Cp₂Fe', 'Ferrocene Cp₂Fe', 'Fe', 0, 0, 2, 0, 0], ['Wilkinson 催化剂 RhCl(PPh₃)₃', 'Wilkinson’s RhCl(PPh₃)₃', 'Rh', 3, 1, 0, 0, 0], ['Vaska 配合物 IrCl(CO)(PPh₃)₂', 'Vaska’s IrCl(CO)(PPh₃)₂', 'Ir', 3, 1, 0, 0, 0],
    ['Mn₂(CO)₁₀（每个 Mn）', 'Mn₂(CO)₁₀ (per Mn)', 'Mn', 5, 0, 0, 1, 0], ['Cp₂ZrCl₂', 'Cp₂ZrCl₂', 'Zr', 0, 2, 2, 0, 0], ['Zeise 盐阴离子 [PtCl₃(C₂H₄)]⁻', 'Zeise’s anion [PtCl₃(C₂H₄)]⁻', 'Pt', 1, 3, 0, 0, -1],
    ['Pd(Ph)Br(PPh₃)₂', 'Pd(Ph)Br(PPh₃)₂', 'Pd', 2, 2, 0, 0, 0], ['[Mn(CO)₆]⁺', '[Mn(CO)₆]⁺', 'Mn', 6, 0, 0, 0, 1],
  ];
  const count = (m, nl, nx, cp, mm, q) => M.electronCount({ group: METALS[m], L: nl + 2 * cp, X: nx + cp, charge: q, mm });
  D.eighteen = {
    kind: 'exact',
    title: ['数电子：18 电子规则', 'Counting electrons: the 18-electron rule'],
    intro: ['选金属、加配体，按共价（中性配体）法数电子，同时得到氧化态和 d 电子数。也可以从几个经典配合物开始。', 'Choose a metal and add ligands to count electrons by the covalent (neutral-ligand) method, getting the oxidation state and d count too. Or start from a classic complex.'],
    sel: [['m', ['金属', 'Metal'], Object.keys(METALS).map((k) => [k, [`${k}（第 ${METALS[k]} 族）`, `${k} (group ${METALS[k]})`]]), 'Fe']],
    ctl: [['l', ['L 配体（CO、PR₃、η²-烯烃，各 2 e）', 'L ligands (CO, PR₃, η²-alkene; 2 e each)'], 0, 7, 1, 5, String], ['x', ['X 配体（H、Cl、CH₃、芳基，各 1 e）', 'X ligands (H, Cl, CH₃, aryl; 1 e each)'], 0, 5, 1, 0, String], ['cp', ['η⁵-Cp（L₂X，5 e）', 'η⁵-Cp (L₂X, 5 e)'], 0, 2, 1, 0, String], ['mm', ['金属–金属键（各 1 e）', 'Metal–metal bonds (1 e each)'], 0, 2, 1, 0, String], ['q', ['配合物的电荷', 'Overall charge'], -2, 2, 1, 0, (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0')]],
    btn: PRE.map(([zh, en, m, l, x, cp, mm, q]) => [[zh, en], { m, l, x, cp, mm, q }]),
    figs: [['html', ['逐项加起来：金属的族数、每类配体的贡献、减去电荷。', 'Adding it up: the metal’s group number, each ligand type’s contribution, minus the charge.']], ['html', ['几个经典配合物的计数（同一套规则算出）。', 'Counts for some classic complexes (computed with the same rules).']]],
    note: ['共价计数法是精确的记账规则，和离子法给出相同的总数。16 电子的配合物有一个空位，常见于平面正方形 d⁸ 和催化中间体。它只回答“有几个电子”，不保证配合物稳定：早期过渡金属和平面正方形 d⁸ 常是 16 电子，高自旋的 Werner 型配合物不遵守 18 电子规则。配位数按每个配体占的位置算（Cp 算 3 个位置，η²-烯烃算 1 个）。', 'Covalent counting is exact bookkeeping and gives the same total as the ionic method. A 16-electron complex has one vacancy, common for square-planar d⁸ and catalytic intermediates. It only answers “how many electrons”, not whether the complex is stable: early transition metals and square-planar d⁸ complexes are often 16-electron, and high-spin Werner-type complexes do not follow the 18-electron rule. Coordination number counts sites per ligand (Cp takes 3, an η²-alkene 1).'],
    draw(s, f) {
      const g = METALS[s.m], r = count(s.m, s.l, s.x, s.cp, s.mm, s.q);
      const parts = [box(`${s.m}`, `${g} e`)];
      if (s.l) parts.push(box(`${s.l} × L`, `+${2 * s.l} e`));
      if (s.x) parts.push(box(`${s.x} × X`, `+${s.x} e`));
      if (s.cp) parts.push(box(`${s.cp} × Cp`, `+${5 * s.cp} e`));
      if (s.mm) parts.push(box('M–M', `+${s.mm} e`));
      if (s.q) parts.push(box(L('电荷', 'Charge'), `${s.q > 0 ? '−' : '+'}${Math.abs(s.q)} e`));
      f[0].innerHTML = flow(...parts, box(L('总数', 'Total'), `${r.count} e`, r.count === 18 ? 'is-gold' : 'is-accent'));
      const os = (v) => (v > 0 ? `+${v}` : v < 0 ? `−${-v}` : '0');
      f[1].innerHTML = table([L('配合物', 'Complex'), L('电子数', 'Electrons'), L('氧化态', 'Ox. state'), L('d 电子', 'd count')], PRE.map(([zh, en, m, l, x, cp, mm, q]) => { const t = count(m, l, x, cp, mm, q); return [L(zh, en), String(t.count), os(t.ox), `d${SUPD(t.d)}`]; }), PRE.findIndex(([, , m, l, x, cp, mm, q]) => m === s.m && l === s.l && x === s.x && cp === s.cp && mm === s.mm && q === s.q));
      const cn = s.l + s.x + 3 * s.cp + s.mm, verdict = r.count === 18 ? L('饱和', 'saturated') : r.count === 16 ? L('有一个空位', 'one vacancy') : r.count > 18 ? L('超过 18，少见', 'over 18, rare') : L('不饱和', 'unsaturated');
      return [[['价电子总数', 'Valence electron count'], `${r.count}`, 1], [['判断', 'Verdict'], verdict], [['氧化态', 'Oxidation state'], os(r.ox)], [['d 电子数', 'd count'], r.d >= 0 ? `d${SUPD(r.d)}` : L('不合理（d 电子为负）', 'impossible (negative d count)')], [['配位位置数', 'Coordination sites'], String(cn)]];
    },
  };
});
