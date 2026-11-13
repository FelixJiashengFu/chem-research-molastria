'use strict';
// 化学学科馆 10 · 生物化学的四个演示：肽和蛋白质的净电荷与等电点、酶动力学和抑制、血红蛋白的协同结合、DNA 双链熔解。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, pct, plot } = K;

  // ── 等电点 ──────────────────────────────────────────────────────────────
  const PEP = {
    gg: [['甘氨酰甘氨酸', 'Gly-Gly'], 'GG'],
    enk: [['亮氨酸脑啡肽', 'Leu-enkephalin'], 'YGGFL'],
    ang: [['血管紧张素 II', 'Angiotensin II'], 'DRVYIHPF'],
    brady: [['缓激肽', 'Bradykinin'], 'RPPGFSPFR'],
    glc: [['胰高血糖素', 'Glucagon'], 'HSQGTFTSDYSKYLDSRRAQDFVQWLMNT'],
    ubq: [['泛素（人）', 'Ubiquitin (human)'], 'MQIFVKTLTGKTITLEVEPSDTIENVKAKIQDKEGIPPDQQRLIFAGKQLEDGRTLSDYNIQKESTLHLVLRLRGG'],
    lyz: [['溶菌酶（鸡蛋清，8 个 Cys 都在二硫键里）', 'Lysozyme (hen egg white, all 8 Cys in disulfides)'], 'KVFGRCELAAAMKRHGLDNYRGYSLGNWVCAAKFESNFNTQATNRNTDGSTDYGILQINSRWWCNDGRTPGSRNLCNIPCSALLSSDITASVNCAKKIVSDGNGMNAWVAWRNRCKGTDVQAWIRGCRL', { C: 0 }],
  };
  D.pi = {
    kind: 'model',
    title: ['肽和蛋白质的净电荷与等电点', 'Net charge and isoelectric point of peptides and proteins'],
    intro: ['选一条肽或一个蛋白质，拖动 pH，看每个可电离基团的质子化程度加起来得到的净电荷；净电荷为零的地方就是等电点。', 'Pick a peptide or protein and move the pH to see the net charge summed over the protonation of every ionisable group; where it crosses zero is the isoelectric point.'],
    sel: [['p', ['分子', 'Molecule'], Object.entries(PEP).map(([k, v]) => [k, v[0]]), 'ang']],
    ctl: [['pH', ['pH', 'pH'], 0, 14, 0.05, 7.4, (v) => fix(v, 2)]],
    btn: [[['血管紧张素 II，生理 pH', 'Angiotensin II at physiological pH'], { p: 'ang', pH: 7.4 }], [['泛素', 'Ubiquitin'], { p: 'ubq', pH: 7.4 }], [['溶菌酶：碱性蛋白', 'Lysozyme: a basic protein'], { p: 'lyz', pH: 7.4 }], [['胰高血糖素在胃酸里', 'Glucagon in stomach acid'], { p: 'glc', pH: 2 }]],
    figs: [[0.55, ['净电荷对 pH。金点是当前 pH，红线是等电点。', 'Net charge against pH. The gold dot is the current pH, the red line the isoelectric point.']], ['html', ['序列：酸性残基（D、E）红色，碱性残基（K、R）蓝色，组氨酸（H）紫色，酪氨酸和半胱氨酸（Y、C）金色。', 'Sequence: acidic residues (D, E) red, basic (K, R) blue, histidine (H) violet, tyrosine and cysteine (Y, C) gold.']]],
    note: ['每个基团按 Henderson–Hasselbalch 方程独立计算再相加，pKa 用一套常用的值（N 端 8.6、C 端 3.6、D 3.9、E 4.1、H 6.5、C 8.5、Y 10.1、K 10.8、R 12.5，与 EMBOSS 等程序的默认表相近，由编者录入，未逐条复核）。真实蛋白质里基团的 pKa 会被周围环境改变一两个单位，不同的 pKa 表算出的等电点可以差 0.5 以上；溶菌酶的二硫键半胱氨酸不计入。', 'Each group is computed independently with the Henderson–Hasselbalch equation and summed, using a common pKa set (N-terminus 8.6, C-terminus 3.6, D 3.9, E 4.1, H 6.5, C 8.5, Y 10.1, K 10.8, R 12.5, close to the defaults of programs such as EMBOSS, typed by the editor and not rechecked). In real proteins the environment shifts pKa values by a unit or two, and different pKa tables give isoelectric points differing by 0.5 or more; lysozyme’s disulfide-bonded cysteines are not counted.'],
    draw(s, f, c) {
      const [, seq, over] = PEP[s.p], cnt = { ...M.ionCounts(seq), ...(over || {}) }, pI = M.pI(cnt), ps = K.lin(0, 14, 281), z = ps.map((p) => M.netCharge(p, cnt));
      const zmax = Math.max(...z.map(Math.abs)) * 1.1;
      plot(f[0], { x: [0, 14], y: [-zmax, zmax], xl: 'pH', yl: L('净电荷', 'Net charge'), series: [{ xs: ps, ys: z, color: c.accent, width: 2.6 }], hmarks: [{ y: 0, color: c.faint }], marks: [{ x: pI, color: c.danger }, { x: s.pH, y: M.netCharge(s.pH, cnt), color: c.gold }] });
      const col = { D: c.danger, E: c.danger, K: c.info, R: c.info, H: c.violet || c.accent, Y: c.gold, C: c.gold };
      f[1].innerHTML = `<div style="font-family:var(--font-mono,monospace);font-size:13px;line-height:1.7;word-break:break-all;letter-spacing:.06em">${[...seq].map((a) => (col[a] ? `<b style="color:${col[a]}">${a}</b>` : `<span style="color:var(--muted)">${a}</span>`)).join('')}</div>`;
      return [[['等电点 pI', 'Isoelectric point pI'], fix(pI, 2), 1], [['当前净电荷', 'Net charge now'], (M.netCharge(s.pH, cnt) >= 0 ? '+' : '') + fix(M.netCharge(s.pH, cnt), 2), 1], [['残基数', 'Residues'], String(seq.length)], [['酸性 D + E', 'Acidic D + E'], String(cnt.D + cnt.E)], [['碱性 K + R', 'Basic K + R'], String(cnt.K + cnt.R)], [['组氨酸 H', 'Histidine H'], String(cnt.H)]];
    },
  };

  // ── 酶动力学 ────────────────────────────────────────────────────────────
  const INH = { comp: ['竞争性', 'competitive'], uncomp: ['反竞争性', 'uncompetitive'], non: ['非竞争性', 'noncompetitive'] };
  D.mm = {
    kind: 'exact',
    title: ['Michaelis–Menten 动力学和三种可逆抑制', 'Michaelis–Menten kinetics and three kinds of reversible inhibition'],
    intro: ['选抑制类型，调抑制剂浓度，看速率曲线和 Lineweaver–Burk 直线怎样变化：竞争性抑制的直线交在纵轴上，非竞争性的交在横轴上，反竞争性的彼此平行。', 'Pick an inhibition type and set the inhibitor concentration to see how the rate curve and Lineweaver–Burk lines change: competitive lines meet on the y-axis, noncompetitive on the x-axis, and uncompetitive lines are parallel.'],
    sel: [['t', ['抑制类型', 'Inhibition type'], Object.entries(INH).map(([k, v]) => [k, v]), 'comp']],
    ctl: [['i', ['抑制剂浓度 [I]/K_i', 'Inhibitor [I]/K_i'], 0, 10, 0.1, 2, (v) => fix(v, 1)], ['S', ['底物浓度 [S]/K_m', 'Substrate [S]/K_m'], 0.1, 10, 0.1, 1, (v) => fix(v, 1)]],
    btn: [[['竞争性：[I] = 2K_i', 'Competitive, [I] = 2K_i'], { t: 'comp', i: 2, S: 1 }], [['竞争性，底物加到 10K_m', 'Competitive, substrate raised to 10K_m'], { t: 'comp', i: 2, S: 10 }], [['非竞争性：[I] = K_i', 'Noncompetitive, [I] = K_i'], { t: 'non', i: 1, S: 1 }], [['反竞争性：[I] = K_i', 'Uncompetitive, [I] = K_i'], { t: 'uncomp', i: 1, S: 1 }]],
    figs: [[0.6, ['速率对底物浓度（以 K_m 和 V_max 为单位）。灰线是没有抑制剂。', 'Rate against substrate (in units of K_m and V_max). Grey: no inhibitor.']], [0.6, ['Lineweaver–Burk 图：1/v 对 1/[S]，[I]/K_i = 0、1、2…… 和当前值（彩色）。', 'Lineweaver–Burk plot: 1/v against 1/[S] for [I]/K_i = 0, 1, 2 … and the current value (coloured).']]],
    note: ['速率按稳态的 Michaelis–Menten 方程和三种可逆抑制的标准式精确计算（非竞争性这里指抑制剂和酶、酶–底物复合物的结合常数相同）。双倒数图会放大低底物浓度处的误差，现在拟合参数一般直接对 v–[S] 曲线做非线性拟合。', 'Rates follow the steady-state Michaelis–Menten equation and the standard forms for the three reversible inhibition types exactly (noncompetitive here means the inhibitor binds the enzyme and the enzyme–substrate complex equally). Double-reciprocal plots magnify errors at low substrate, so parameters are now usually fitted to the v–[S] curve by nonlinear regression.'],
    draw(s, f, c) {
      const Ss = K.lin(0, 10, 201), v = (S, i) => M.mmRate(S, { Vmax: 1, Km: 1, I: i, Ki: 1, type: s.t });
      plot(f[0], { x: [0, 10], y: [0, 1.05], xl: '[S] / K_m', yl: 'v / V_max', series: [{ xs: Ss, ys: Ss.map((S) => v(S, 0)), color: c.faint, width: 1.8, label: L('无抑制剂', 'no inhibitor') }, { xs: Ss, ys: Ss.map((S) => v(S, s.i)), color: c.accent, width: 2.6, label: L('有抑制剂', 'inhibited') }], hmarks: [{ y: 1, color: c.faint }], marks: [{ x: s.S, y: v(s.S, s.i), color: c.gold }] });
      const xs = K.lin(-1.2, 10, 120), lines = [0, 1, 2, 4].filter((i) => i !== s.i).map((i) => ({ xs, ys: xs.map((x) => 1 / v(1 / x, i)), color: c.faint, width: 1.2 }));
      const yv = xs.map((x) => 1 / v(1 / x, s.i)), ytop = Math.min(25, Math.max(...yv.filter(Number.isFinite)) * 1.05);
      plot(f[1], { x: [-1.2, 10], y: [-1, ytop], xl: 'K_m/[S]', yl: 'V_max/v', series: [...lines, { xs, ys: yv, color: c.accent, width: 2.4 }], hmarks: [{ y: 0, color: c.faint }], marks: [{ x: 0, color: c.faint }] });
      const a = 1 + s.i, Kapp = s.t === 'comp' ? a : s.t === 'uncomp' ? 1 / a : 1, Vapp = s.t === 'comp' ? 1 : 1 / a;
      return [[['表观 K_m', 'Apparent K_m'], `${fix(Kapp, 2)} K_m`, 1], [['表观 V_max', 'Apparent V_max'], `${fix(Vapp, 2)} V_max`, 1], [['当前速率', 'Current rate'], `${fix(v(s.S, s.i), 3)} V_max`], [['被抑制掉的比例', 'Fraction inhibited'], pct(1 - v(s.S, s.i) / v(s.S, 0), 0)]];
    },
  };

  // ── 血红蛋白的协同结合 ──────────────────────────────────────────────────
  const HbMWC = { n: 4, KR: 1.4, KT: 140, L0: 1e5 };
  D.hill = {
    kind: 'model',
    title: ['血红蛋白的协同结合和氧的运送', 'Cooperative binding of haemoglobin and oxygen delivery'],
    intro: ['调 p₅₀（亲和力）、Hill 系数（协同性）和组织里的氧分压，看从肺（100 Torr）到组织能放出多少氧；和不协同的肌红蛋白比一比。', 'Adjust p₅₀ (affinity), the Hill coefficient (cooperativity) and tissue oxygen pressure to see how much oxygen is released between the lungs (100 Torr) and the tissue, compared with non-cooperative myoglobin.'],
    ctl: [['p50', ['p₅₀', 'p₅₀'], 5, 50, 0.5, 26, (v) => `${fix(v, 1)} Torr`], ['n', ['Hill 系数 n_H', 'Hill coefficient n_H'], 1, 4, 0.05, 2.8, (v) => fix(v, 2)], ['pt', ['组织氧分压', 'Tissue pO₂'], 5, 60, 1, 40, (v) => `${v} Torr`]],
    chk: [['mwc', ['叠上 MWC 模型曲线（参数见说明）', 'Overlay the MWC model (parameters in the note)'], false]],
    btn: [[['静息组织（40 Torr）', 'Resting tissue (40 Torr)'], { p50: 26, n: 2.8, pt: 40 }], [['运动中的肌肉（20 Torr）', 'Exercising muscle (20 Torr)'], { p50: 26, n: 2.8, pt: 20 }], [['示意：酸性让 p₅₀ 右移（Bohr 效应）', 'Illustrative: acid shifts p₅₀ right (Bohr effect)'], { p50: 32, n: 2.8, pt: 20 }], [['假如没有协同（n_H = 1）', 'If there were no cooperativity (n_H = 1)'], { p50: 26, n: 1, pt: 20 }]],
    figs: [[0.6, ['氧饱和度对氧分压。彩色是血红蛋白（Hill），灰色是肌红蛋白（p₅₀ = 2.8 Torr），竖线是肺和组织。', 'Oxygen saturation against pO₂. Coloured: haemoglobin (Hill); grey: myoglobin (p₅₀ = 2.8 Torr); vertical lines: lungs and tissue.']], [0.6, ['Hill 图：lg(Y/(1−Y)) 对 lg p。直线的斜率就是 n_H；MWC 曲线两端的斜率回到 1。', 'Hill plot: lg(Y/(1−Y)) against lg p. The slope is n_H; the MWC curve returns to slope 1 at both ends.']]],
    note: ['Hill 方程只是经验拟合，它假设结合要么一个也没有、要么全满，所以 n_H 是协同程度的量度，不等于结合位点数（血红蛋白有 4 个位点，n_H 约 2.8–3）。MWC 曲线用 n = 4、K_R = 1.4 Torr、K_T = 140 Torr、L = 10⁵，这组数是编者为了让 p₅₀ ≈ 26 Torr、最大斜率约 2.9 而选的示意值，不是文献拟合结果。p₅₀ 的数值是常引的近似值（人成年血红蛋白在 37 °C、pH 7.4 约 26 Torr），由编者录入。', 'The Hill equation is only an empirical fit that assumes binding is all or nothing, so n_H measures the degree of cooperativity and is not the number of sites (haemoglobin has 4 sites and n_H ≈ 2.8–3). The MWC curve uses n = 4, K_R = 1.4 Torr, K_T = 140 Torr and L = 10⁵, illustrative values chosen by the editor to give p₅₀ ≈ 26 Torr and a maximum slope near 2.9, not a literature fit. p₅₀ values are commonly quoted approximations (about 26 Torr for adult human haemoglobin at 37 °C and pH 7.4) typed by the editor.'],
    draw(s, f, c) {
      const ps = K.lin(0.2, 120, 300), Y = (p) => M.hill(p, s.p50, s.n), Mb = (p) => M.hill(p, 2.8, 1), W = (p) => M.mwc(p, HbMWC);
      const series = [{ xs: ps, ys: ps.map(Mb), color: c.faint, width: 1.8, label: L('肌红蛋白', 'myoglobin') }, { xs: ps, ys: ps.map(Y), color: c.accent, width: 2.6, label: L('血红蛋白', 'haemoglobin') }];
      if (s.mwc) series.push({ xs: ps, ys: ps.map(W), color: c.gold, width: 1.8, dash: [6, 4], label: 'MWC' });
      plot(f[0], { x: [0, 120], y: [0, 1.04], xl: 'pO₂ / Torr', yl: 'Y', series, marks: [{ x: 100, y: Y(100), color: c.danger }, { x: s.pt, y: Y(s.pt), color: c.info }], bands: [{ x0: s.pt, x1: 100, color: c.gold, alpha: 0.06 }] });
      const lp = K.lin(-0.5, 2.5, 200), lg = (y) => Math.log10(y / (1 - y));
      const hs = [{ xs: lp, ys: lp.map((l) => lg(Mb(10 ** l))), color: c.faint, width: 1.6 }, { xs: lp, ys: lp.map((l) => lg(Y(10 ** l))), color: c.accent, width: 2.4 }];
      if (s.mwc) hs.push({ xs: lp, ys: lp.map((l) => lg(W(10 ** l))), color: c.gold, width: 1.8, dash: [6, 4] });
      plot(f[1], { x: [-0.5, 2.5], y: [-4, 4], xt: [0, 1, 2], xf: (t) => fmt(10 ** t, 1), xl: 'pO₂ / Torr', yl: 'lg(Y/(1−Y))', series: hs, hmarks: [{ y: 0, color: c.faint }] });
      const dHb = Y(100) - Y(s.pt), dMb = Mb(100) - Mb(s.pt);
      return [[['肺里的饱和度', 'Saturation in lungs'], pct(Y(100), 1)], [['组织里的饱和度', 'Saturation in tissue'], pct(Y(s.pt), 1)], [['血红蛋白放出', 'Haemoglobin releases'], pct(dHb, 0), 1], [['肌红蛋白放出', 'Myoglobin would release'], pct(dMb, 0)], [['运送效率之比', 'Ratio'], `${fix(dHb / dMb, 1)} ×`, 1]];
    },
  };

  // ── DNA 熔解 ────────────────────────────────────────────────────────────
  const SEQ = {
    dick: [['Dickerson 十二聚体（自互补）', 'Dickerson dodecamer (self-complementary)'], 'CGCGAATTCGCG'],
    p18: [['18 聚体，GC 50 %', '18-mer, 50 % GC'], 'TTGGAACCTTGCAGTTCG'],
    at: [['富 AT 十二聚体（自互补）', 'AT-rich dodecamer (self-complementary)'], 'AAATTTAAATTT'],
    gc: [['富 GC 十二聚体', 'GC-rich dodecamer'], 'GCGGCGGCGGCG'],
    p24: [['24 聚体', '24-mer'], 'ACGTTGCAAGGCTTACCGGATCCA'],
  };
  D.melt = {
    kind: 'model',
    title: ['DNA 双链熔解', 'DNA duplex melting'],
    intro: ['选一段序列，调链浓度和盐浓度，看双链分数随温度的熔解曲线和熔点。最近邻模型把相邻两对碱基的堆积能加起来。', 'Pick a sequence and set strand and salt concentrations to see the melting curve and melting temperature. The nearest-neighbour model sums the stacking energies of neighbouring base pairs.'],
    sel: [['q', ['序列（5′→3′）', 'Sequence (5′→3′)'], Object.entries(SEQ).map(([k, v]) => [k, v[0]]), 'p18']],
    ctl: [['lc', ['总链浓度 lg(C_T / mol L⁻¹)', 'Total strands lg(C_T / mol L⁻¹)'], -8, -3, 0.1, -6, (v) => `${fmt(10 ** v * 1e6, 2)} μmol/L`], ['ln', ['Na⁺ 浓度 lg([Na⁺] / mol L⁻¹)', 'Na⁺ lg([Na⁺] / mol L⁻¹)'], -2, 0, 0.05, 0, (v) => `${fmt(10 ** v, 2)} mol/L`]],
    btn: [[['18 聚体，1 μmol/L，1 mol/L NaCl', '18-mer, 1 μmol/L, 1 mol/L NaCl'], { q: 'p18', lc: -6, ln: 0 }], [['同一条，盐降到 50 mmol/L', 'Same, salt down to 50 mmol/L'], { q: 'p18', lc: -6, ln: Math.log10(0.05) }], [['富 AT 对比富 GC', 'AT-rich against GC-rich'], { q: 'at', lc: -6, ln: 0 }], [['浓度提高 100 倍', '100 times more concentrated'], { q: 'p18', lc: -4, ln: 0 }]],
    figs: [[0.6, ['双链分数对温度（两态模型）。虚线是浓度低 10 倍时的曲线。', 'Fraction in duplex against temperature (two-state model). Dashed: ten times lower concentration.']], [0.5, ['熔点对总链浓度：每高 10 倍，熔点升高几度。', 'Melting temperature against total strand concentration: a few degrees higher per tenfold.']]],
    note: ['两态模型（只有单链和完整双链），最近邻参数按 SantaLucia 1998 的统一参数表录入（ΔH 和 ΔS，含末端起始项和自互补的对称校正），由编者录入，未逐条复核；盐校正只改 ΔS：ΔS(Na⁺) = ΔS(1 mol/L) + 0.368(N − 1) ln[Na⁺]。没有考虑发夹、错配、悬垂末端和 Mg²⁺；长于约 30 个碱基对时两态假设不再成立。', 'A two-state model (single strands and the complete duplex only); nearest-neighbour parameters follow SantaLucia’s 1998 unified table (ΔH and ΔS, with terminal initiation terms and the symmetry correction for self-complementary strands), typed by the editor and not rechecked; the salt correction changes only ΔS: ΔS(Na⁺) = ΔS(1 mol/L) + 0.368(N − 1) ln[Na⁺]. Hairpins, mismatches, dangling ends and Mg²⁺ are not included, and beyond about 30 base pairs the two-state assumption fails.'],
    draw(s, f, c) {
      const seq = SEQ[s.q][1], Na = 10 ** s.ln, CT = 10 ** s.lc, d = M.nnDNA(seq, Na), Tm = M.dnaTm(d.dH, d.dS, CT, d.self);
      const Ts = K.lin(0, 100, 301), fr = (C) => Ts.map((t) => M.duplexFrac(t + 273.15, d.dH, d.dS, C, d.self));
      plot(f[0], { x: [0, 100], y: [0, 1.04], xl: 'T / °C', yl: L('双链分数', 'Fraction duplex'), series: [{ xs: Ts, ys: fr(CT / 10), color: c.faint, width: 1.5, dash: [6, 4] }, { xs: Ts, ys: fr(CT), color: c.accent, width: 2.6 }], marks: [{ x: Tm - 273.15, y: 0.5, color: c.gold }] });
      const lcs = K.lin(-8, -3, 60);
      plot(f[1], { x: [-8, -3], y: [Math.min(...lcs.map((l) => M.dnaTm(d.dH, d.dS, 10 ** l, d.self))) - 275, Math.max(...lcs.map((l) => M.dnaTm(d.dH, d.dS, 10 ** l, d.self))) - 271], xt: [-8, -7, -6, -5, -4, -3], xf: (t) => `10${'⁻'}${'⁰¹²³⁴⁵⁶⁷⁸⁹'[-t]}`, xl: 'C_T / mol L⁻¹', yl: 'T_m / °C', series: [{ xs: lcs, ys: lcs.map((l) => M.dnaTm(d.dH, d.dS, 10 ** l, d.self) - 273.15), color: c.accent, width: 2.4 }], marks: [{ x: s.lc, y: Tm - 273.15, color: c.gold }] });
      const g37 = d.dH - 310.15 * d.dS / 1000;
      return [[['序列', 'Sequence'], seq.length > 14 ? `${seq.slice(0, 12)}…` : seq], [['GC 含量', 'GC content'], pct(d.gc, 0)], [['ΔH°', 'ΔH°'], `${fix(d.dH, 1)} kcal/mol`], [['ΔS°（含盐校正）', 'ΔS° (salt-corrected)'], `${fix(d.dS, 1)} cal/(mol·K)`], [['ΔG°₃₇', 'ΔG°₃₇'], `${fix(g37, 1)} kcal/mol`], [['熔点 T_m', 'Melting point T_m'], `${fix(Tm - 273.15, 1)} °C`, 1]];
    },
  };
});
