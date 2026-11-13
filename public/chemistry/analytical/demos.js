'use strict';
// 化学学科馆 04 · 分析化学的四个演示：酸碱滴定曲线、分布分数与 EDTA 条件常数、校准曲线与检出限、van Deemter 方程与分离度。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, pct, plot } = K;

  // pKa（25 °C，离子强度约 0 或 0.1，Harris《Quantitative Chemical Analysis》附录常引的数值，编者录入）
  const ACIDS = {
    HCl: { pKa: [-8], t: ['盐酸（强酸）', 'hydrochloric acid (strong)'] },
    acetic: { pKa: [4.756], t: ['乙酸', 'acetic acid'] },
    NH4: { pKa: [9.25], t: ['氯化铵（NH₄⁺，很弱的酸）', 'ammonium chloride (NH₄⁺, very weak)'] },
    phosphoric: { pKa: [2.148, 7.198, 12.35], t: ['磷酸', 'phosphoric acid'] },
    carbonic: { pKa: [6.351, 10.329], t: ['碳酸（CO₂ 水溶液）', 'carbonic acid (aqueous CO₂)'] },
    citric: { pKa: [3.128, 4.761, 6.396], t: ['柠檬酸', 'citric acid'] },
    glycine: { pKa: [2.35, 9.78], t: ['甘氨酸（H₂Gly⁺）', 'glycine (H₂Gly⁺)'] },
    edta: { pKa: [0.0, 1.5, 2.0, 2.69, 6.13, 10.37], t: ['EDTA（H₆Y²⁺）', 'EDTA (H₆Y²⁺)'] },
  };
  const pick = (keys) => keys.map((k) => [k, ACIDS[k].t]);
  const SUB = '₀₁₂₃₄₅₆₇₈₉', SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹';
  // 通用的型体名：HₙA、Hₙ₋₁A⁻ …（不管真实电荷，只表示失去了几个质子）
  const spName = (n, j) => `${n - j > 0 ? `H${n - j > 1 ? SUB[n - j] : ''}` : ''}A${j ? `${j > 1 ? SUP[j] : ''}⁻` : ''}`;

  // ── 滴定曲线 ────────────────────────────────────────────────────────────
  D.titration = {
    kind: 'exact',
    title: ['酸碱滴定曲线：解电荷平衡，不靠近似', 'Acid–base titration curves from the full charge balance'],
    intro: ['选一种酸和浓度，用 NaOH 滴定。曲线由完整的电荷平衡解出，不做任何近似。', 'Pick an acid and its concentration and titrate with NaOH. The curve comes from the full charge balance, with no approximations.'],
    sel: [['acid', ['被滴定的酸（25.00 mL）', 'Acid titrated (25.00 mL)'], pick(['HCl', 'acetic', 'NH4', 'phosphoric', 'carbonic', 'citric', 'glycine']), 'acetic']],
    ctl: [['lc', ['浓度（酸和碱相同）', 'Concentration (acid and base equal)'], -4, 0, 0.1, -1, (v) => `${fmt(10 ** v, 3)} mol/L`], ['vb', ['已加入 NaOH', 'NaOH added'], 0, 80, 0.1, 12.5, (v) => `${fix(v, 1)} mL`]],
    btn: [[['乙酸 0.1 M', 'Acetic acid, 0.1 M'], { acid: 'acetic', lc: -1, vb: 12.5 }], [['盐酸 0.001 M', 'HCl, 0.001 M'], { acid: 'HCl', lc: -3, vb: 25 }], [['磷酸三个台阶', 'Phosphoric acid: three steps'], { acid: 'phosphoric', lc: -1, vb: 25 }], [['NH₄⁺ 几乎看不到突跃', 'NH₄⁺: barely a jump'], { acid: 'NH4', lc: -1, vb: 25 }]],
    figs: [[0.55, ['pH 对加入的 NaOH 体积。竖线是各等当点；金色点是当前体积。阴影是酚酞（8.2–10.0）和甲基橙（3.1–4.4）的变色范围。', 'pH against NaOH volume. Vertical lines mark the equivalence points; the gold dot is the current volume. Shaded: colour ranges of phenolphthalein (8.2–10.0) and methyl orange (3.1–4.4).']]],
    note: ['精确地解 [H⁺] + [Na⁺] = [OH⁻] + Σ j[Hₙ₋ⱼA^j⁻]，只忽略活度系数（离子强度高时 pH 读数会偏离约 0.1）。盐酸当作 pKa = −8 的一元酸。pKa 由编者按 Harris 教材附录常引的数值录入，碳酸体系假定是封闭的（CO₂ 不逸出）。', 'Solves [H⁺] + [Na⁺] = [OH⁻] + Σ j[Hₙ₋ⱼA^j⁻] exactly, neglecting only activity coefficients (at high ionic strength real pH readings differ by about 0.1). HCl is treated as a monoprotic acid with pKa = −8. pKa values were typed by the editor from those commonly quoted in the appendix of Harris’s textbook; the carbonate system is assumed closed (no CO₂ escapes).'],
    draw(s, f, c) {
      const a = ACIDS[s.acid], C = 10 ** s.lc, n = a.pKa.length, vmax = Math.max(30, 25 * n + 10), vs = K.lin(0, vmax, 401), ph = vs.map((v) => M.titrationPH(C, 25, C, v, a.pKa));
      const cur = M.titrationPH(C, 25, C, s.vb, a.pKa);
      plot(f[0], { x: [0, vmax], y: [0, 14], xl: L('NaOH / mL', 'NaOH / mL'), yl: 'pH', hbands: [{ y0: 8.2, y1: 10, color: c.danger, alpha: 0.08 }, { y0: 3.1, y1: 4.4, color: c.gold, alpha: 0.12 }], series: [{ xs: vs, ys: ph, color: c.accent, width: 2.4 }], marks: [...Array.from({ length: n }, (_, i) => ({ x: 25 * (i + 1), color: c.faint })), { x: s.vb, y: cur, color: c.gold }] });
      const eq = M.titrationPH(C, 25, C, 25, a.pKa), d1 = M.titrationPH(C, 25, C, 24.9, a.pKa), d2 = M.titrationPH(C, 25, C, 25.1, a.pKa);
      return [[['当前 pH', 'Current pH'], fix(cur, 2), 1], [['第一等当点（25.00 mL）的 pH', 'pH at the first equivalence point (25.00 mL)'], fix(eq, 2)], [['24.90 → 25.10 mL 的突跃', 'Jump from 24.90 to 25.10 mL'], `${fix(d2 - d1, 2)} pH`, 1], [['pKa', 'pKa'], a.pKa.map((x) => (x < 0 ? L('强酸', 'strong') : fix(x, 2))).join('、')]];
    },
  };

  // ── 分布分数和 EDTA 条件常数 ──────────────────────────────────────────
  // EDTA 金属配合物 log K_f（25 °C，μ = 0.1，Harris 附录常引的数值，编者录入）
  const KF = [['Mg²⁺', 8.79], ['Ca²⁺', 10.65], ['Mn²⁺', 13.89], ['Zn²⁺', 16.5], ['Pb²⁺', 18.0], ['Cu²⁺', 18.78], ['Fe³⁺', 25.1]];
  D.speciation = {
    kind: 'data',
    title: ['分布分数：在某个 pH 下溶液里是哪种型体', 'Distribution fractions: which form dominates at a given pH'],
    intro: ['选一个酸体系、调 pH，看各型体的比例；下图是 EDTA 和几种金属的条件形成常数随 pH 的变化。', 'Pick an acid system and a pH to see the fraction of each form; below, the conditional formation constants of EDTA with several metals against pH.'],
    sel: [['acid', ['酸体系', 'Acid system'], pick(['phosphoric', 'carbonic', 'citric', 'glycine', 'edta', 'acetic']), 'phosphoric']],
    ctl: [['pH', ['pH', 'pH'], 0, 14, 0.05, 7.4, (v) => fix(v, 2)]],
    btn: [[['血液 pH 7.4', 'Blood, pH 7.4'], { pH: 7.4 }], [['海水 pH 8.1', 'Seawater, pH 8.1'], { acid: 'carbonic', pH: 8.1 }], [['EDTA 在 pH 10', 'EDTA at pH 10'], { acid: 'edta', pH: 10 }]],
    figs: [[0.45, ['各型体的分布分数对 pH，竖线是当前 pH。', 'Distribution fractions against pH; the vertical line is the current pH.']], [0.45, ['log K′ = log αY⁴⁻ + log K_f。虚线 log K′ = 8 是 0.01 mol/L 时能准确滴定的经验下限。', 'log K′ = log αY⁴⁻ + log K_f. The dashed line log K′ = 8 is the rule-of-thumb minimum for an accurate titration at 0.01 mol/L.']]],
    note: ['分布分数只由 pH 和 pKa 决定，和总浓度无关（只要没有沉淀、聚合）。条件常数只考虑了 EDTA 的质子化，没考虑金属的水解和与缓冲液（如氨）的配位，高 pH 时 Fe³⁺、Pb²⁺ 等实际会先水解沉淀。pKa 和 log K_f 由编者录入。', 'Distribution fractions depend only on pH and the pKa values, not on total concentration (provided nothing precipitates or polymerises). The conditional constants include only EDTA protonation, not metal hydrolysis or binding to buffers such as ammonia; at high pH Fe³⁺, Pb²⁺ and others actually hydrolyse and precipitate first. pKa and log K_f values were typed by the editor.'],
    draw(s, f, c) {
      const a = ACIDS[s.acid], n = a.pKa.length, pHs = K.lin(0, 14, 281), al = pHs.map((p) => M.alphasLog(p, a.pKa)), cols = [c.danger, c.gold, c.accent, c.info, c.violet || c.muted, c.muted, c.ink2];
      plot(f[0], { x: [0, 14], y: [0, 1.02], xl: 'pH', yl: 'α', series: Array.from({ length: n + 1 }, (_, j) => ({ xs: pHs, ys: al.map((r) => r[j]), color: cols[j % cols.length], width: 2.2, label: spName(n, j) })), marks: [{ x: s.pH, color: c.gold }] });
      const ed = ACIDS.edta.pKa, la = pHs.map((p) => Math.log10(M.alphasLog(p, ed)[6]));
      plot(f[1], { x: [0, 14], y: [-4, 28], xl: 'pH', yl: "log K′", series: KF.map(([nm, lk], i) => ({ xs: pHs, ys: la.map((x) => x + lk), color: cols[i % cols.length], width: 1.8 })), hmarks: [{ y: 8, color: c.ink2 }], marks: [{ x: s.pH, color: c.gold }], texts: KF.map(([nm, lk], i) => ({ x: 13.9, y: lk + la[la.length - 1], s: nm, align: 'right', dy: -4, color: cols[i % cols.length] })) });
      const now = M.alphasLog(s.pH, a.pKa), top = now.indexOf(Math.max(...now));
      const rows = [[['占优势的型体', 'Dominant form'], top === 0 ? L('完全质子化', 'fully protonated') : L(`失去 ${top} 个质子`, `${top} proton${top > 1 ? 's' : ''} lost`), 1], [['它的比例', 'Its fraction'], pct(now[top])]];
      if (s.acid === 'edta') rows.push([['αY⁴⁻', 'αY⁴⁻'], fmt(now[6], 3), 1]);
      rows.push([['此 pH 下 log K′(Ca²⁺)', 'log K′(Ca²⁺) at this pH'], fix(Math.log10(M.alphasLog(s.pH, ed)[6]) + 10.65, 2)]);
      return rows;
    },
  };

  // ── 校准曲线 ────────────────────────────────────────────────────────────
  D.calibration = {
    kind: 'model',
    title: ['校准曲线、预测区间和检出限', 'Calibration line, prediction band and detection limit'],
    intro: ['模拟一组带噪声的标准溶液。调噪声、标准个数和未知样的信号，看反推浓度的不确定度在哪里最小。', 'Simulate standards with noise. Change the noise, the number of standards and the unknown’s signal to see where the back-calculated concentration is most certain.'],
    state: { seed: 7 },
    ctl: [['noise', ['信号噪声（标准偏差）', 'Signal noise (standard deviation)'], 0.001, 0.03, 0.001, 0.008, (v) => fix(v, 3)], ['n', ['标准个数（0–10 mg/L 均匀分布）', 'Number of standards (spread over 0–10 mg/L)'], 3, 12, 1, 6, (v) => String(v)], ['y0', ['未知样的信号', 'Unknown’s signal'], 0, 0.55, 0.005, 0.25, (v) => fix(v, 3)], ['m', ['未知样平行测定次数', 'Replicate readings of the unknown'], 1, 10, 1, 3, (v) => String(v)]],
    act: [[['换一组随机数据', 'New random data'], (s) => { s.seed = (s.seed * 1103515245 + 12345) % 2147483647; }]],
    figs: [[0.55, ['点是标准，实线是最小二乘直线，两条虚线之间是 95 % 预测带；金色是未知样和它的 95 % 误差棒。', 'Dots: standards; line: least-squares fit; between the dashed lines: the 95 % prediction band; gold: the unknown with its 95 % error bar.']]],
    note: ['真实斜率 0.050 /(mg/L)、截距 0.002，噪声是独立同分布的正态噪声（伪随机，种子固定所以可以重现）。LOD 这里用 3.3 s_y/x / b₁ 近似，严格做法要用空白的重复测定。预测带按单次测量画；平行测定次数 m 只影响未知样那一点的误差棒。', 'The true slope is 0.050 per mg/L and the intercept 0.002; noise is independent and normally distributed (pseudo-random with a fixed seed, so reproducible). The LOD is approximated as 3.3 s_y/x / b₁; strictly it should come from replicate blanks. The prediction band is drawn for single readings; the number of replicates m affects only the error bar of the unknown.'],
    draw(s, f, c) {
      const r = M.rng(s.seed), xs = K.lin(0, 10, s.n), ys = xs.map((x) => 0.002 + 0.05 * x + s.noise * M.gauss(r)), fit = M.linfit(xs, ys), t = M.t95(s.n - 2);
      const xx = K.lin(-0.5, 11, 120), band = (x, m) => t * fit.syx * Math.sqrt(1 / m + 1 / fit.n + (x - fit.xb) ** 2 / fit.sxx);
      const est = M.calibX(fit, s.y0, s.m), lod = (3.3 * fit.syx) / fit.b1;
      plot(f[0], {
        x: [-0.5, 11], y: [Math.min(0, ...ys) - 0.03, 0.6], xl: L('浓度 / mg L⁻¹', 'concentration / mg L⁻¹'), yl: L('信号', 'signal'),
        series: [{ xs: xx, ys: xx.map((x) => fit.b0 + fit.b1 * x + band(x, 1)), color: c.faint, width: 1, dash: [3, 3] }, { xs: xx, ys: xx.map((x) => fit.b0 + fit.b1 * x - band(x, 1)), color: c.faint, width: 1, dash: [3, 3] }, { xs: xx, ys: xx.map((x) => fit.b0 + fit.b1 * x), color: c.accent, width: 2 }, { xs, ys, color: c.ink, dots: 4 }],
        hmarks: [{ y: s.y0, color: c.gold }], marks: [{ x: est.x0, y: s.y0, color: c.gold }],
        after: ({ ctx, X, Y }) => { ctx.strokeStyle = c.gold; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(est.x0 - t * est.sx0), Y(s.y0)); ctx.lineTo(X(est.x0 + t * est.sx0), Y(s.y0)); ctx.stroke(); },
      });
      return [[['斜率 b₁ / 截距 b₀', 'Slope b₁ / intercept b₀'], `${fix(fit.b1, 4)} / ${fix(fit.b0, 4)}`], [['R²', 'R²'], fix(fit.r2, 5)], [['未知样浓度', 'Unknown concentration'], `${fix(est.x0, 3)} ± ${fix(t * est.sx0, 3)} mg/L（95 %）`, 1], [['检出限 LOD ≈ 3.3 s_y/x / b₁', 'LOD ≈ 3.3 s_y/x / b₁'], `${fix(lod, 3)} mg/L`, 1], [['定量限 LOQ ≈ 10 s_y/x / b₁', 'LOQ ≈ 10 s_y/x / b₁'], `${fix(lod / 0.33, 3)} mg/L`]];
    },
  };

  // ── van Deemter 和分离度 ───────────────────────────────────────────────
  D.vandeemter = {
    kind: 'model',
    title: ['van Deemter 曲线和两个峰的分离', 'The van Deemter curve and separating two peaks'],
    intro: ['调 A、B、C 三项和流速，看塔板高度、塔板数和两个峰能不能分开（15 cm 柱）。', 'Adjust the A, B and C terms and the flow velocity to see the plate height, plate number and whether two peaks separate (15 cm column).'],
    ctl: [['u', ['流动相线速度 u', 'Mobile-phase linear velocity u'], 0.2, 8, 0.05, 1.8, (v) => `${fix(v, 2)} mm/s`], ['A', ['A：涡流扩散', 'A: eddy diffusion'], 0, 15, 0.5, 5, (v) => `${fix(v, 1)} μm`], ['B', ['B：纵向扩散', 'B: longitudinal diffusion'], 1, 30, 0.5, 10, (v) => `${fix(v, 1)} μm·mm/s`], ['C', ['C：传质阻力', 'C: mass-transfer resistance'], 0.2, 10, 0.1, 3, (v) => `${fix(v, 1)} μm·s/mm`], ['alpha', ['选择性 α', 'Selectivity α'], 1.01, 1.3, 0.005, 1.08, (v) => fix(v, 3)]],
    btn: [[['最佳流速', 'Optimum velocity'], { u: 1.83 }], [['5 μm → 2 μm 填料', '5 μm → 2 μm particles'], { A: 2, C: 1.2 }], [['流速太快', 'Far too fast'], { u: 7 }]],
    figs: [[0.5, ['H 对 u：实线是总和，虚线是 A、B/u、Cu 三项；金色点是当前流速。', 'H against u: solid the total, dashed the A, B/u and Cu terms; the gold dot is the current velocity.']], [0.5, ['模拟色谱图：k = 4.0 和 4.0α 两个等高峰。', 'Simulated chromatogram: two equal peaks at k = 4.0 and 4.0α.']]],
    note: ['参数是教学用的典型量级（5 μm 填料的 HPLC），不对应某根具体的柱子。峰按高斯形状画，σ = t_R/√N；死时间 t₀ = L/u。真实色谱还有柱外展宽、峰拖尾和随保留变化的 C 项。', 'Parameters are typical teaching magnitudes (HPLC with 5 μm particles), not a specific column. Peaks are Gaussian with σ = t_R/√N and dead time t₀ = L/u. Real chromatography adds extra-column broadening, tailing and a C term that varies with retention.'],
    draw(s, f, c) {
      const us = K.lin(0.15, 8, 200), H = us.map((u) => M.vanDeemter(u, s.A, s.B, s.C)), h = M.vanDeemter(s.u, s.A, s.B, s.C), uo = Math.sqrt(s.B / s.C), hmin = s.A + 2 * Math.sqrt(s.B * s.C);
      plot(f[0], { x: [0, 8], y: [0, Math.min(80, Math.max(...H.filter((x) => x < 200)))], xl: 'u / mm s⁻¹', yl: 'H / μm', series: [{ xs: us, ys: us.map(() => s.A), color: c.muted, dash: [4, 4], width: 1.2 }, { xs: us, ys: us.map((u) => s.B / u), color: c.info, dash: [4, 4], width: 1.2 }, { xs: us, ys: us.map((u) => s.C * u), color: c.danger, dash: [4, 4], width: 1.2 }, { xs: us, ys: H, color: c.accent, width: 2.4 }], marks: [{ x: s.u, y: h, color: c.gold }] });
      const Lmm = 150, N = (Lmm * 1000) / h, t0 = Lmm / s.u, k1 = 4, k2 = 4 * s.alpha, t1 = t0 * (1 + k1), t2 = t0 * (1 + k2), s1 = t1 / Math.sqrt(N), s2 = t2 / Math.sqrt(N);
      const ts = K.lin(t1 - 6 * s1, t2 + 6 * s2, 500), g = (t, m, sd) => Math.exp(-((t - m) ** 2) / (2 * sd * sd)) / sd, ys = ts.map((t) => g(t, t1, s1) + g(t, t2, s2)), top = Math.max(...ys);
      plot(f[1], { x: [ts[0], ts[ts.length - 1]], y: [0, 1.1], xl: 't / s', yt: [], series: [{ xs: ts, ys: ys.map((y) => y / top), color: c.accent, width: 2, fill: true }] });
      const Rs = (t2 - t1) / (2 * (s1 + s2));
      return [[['塔板高度 H', 'Plate height H'], `${fix(h, 1)} μm`], [['理论塔板数 N（15 cm）', 'Plate number N (15 cm)'], fmt(N, 4), 1], [['最佳流速 / 最小塔板高度', 'Optimum velocity / minimum H'], `${fix(uo, 2)} mm/s / ${fix(hmin, 1)} μm`], [['分离度 R_s', 'Resolution R_s'], fix(Rs, 2), 1], [['分析时间（第二个峰）', 'Analysis time (second peak)'], `${fix(t2 / 60, 1)} min`], [['基线分离（R_s ≥ 1.5）', 'Baseline separation (R_s ≥ 1.5)'], Rs >= 1.5 ? L('是', 'yes') : L('否', 'no')]];
    },
  };
});
