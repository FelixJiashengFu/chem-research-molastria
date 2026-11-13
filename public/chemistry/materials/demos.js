'use strict';
// 化学学科馆 11 · 材料化学的三个演示：一维紧束缚能带和态密度、半导体的载流子和费米能级、量子点的尺寸和颜色。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, plot, box, flow } = K;
  const KB = 8.617333e-5; // eV/K

  // ── 一维紧束缚：能带和态密度 ────────────────────────────────────────────
  D.tb = {
    kind: 'exact',
    title: ['从两个原子到能带：一维紧束缚链', 'From two atoms to bands: a one-dimensional tight-binding chain'],
    intro: ['每个晶胞里有 A、B 两个原子，在位能差 2δ，晶胞内和晶胞间的跃迁积分 β₁、β₂。调这三个数，看两条能带和态密度怎样变；再调每个晶胞的电子数，看费米能级落在带里（金属）还是带隙里（半导体或绝缘体）。', 'Each cell holds two atoms A and B, with a site-energy difference 2δ and hopping integrals β₁ (inside the cell) and β₂ (between cells). Adjust them to see the two bands and the density of states change, then set the electrons per cell to see whether the Fermi level falls inside a band (metal) or in a gap (semiconductor or insulator).'],
    ctl: [['d', ['在位能差的一半 δ', 'Half the site-energy difference δ'], 0, 3, 0.05, 0, (v) => `${fix(v, 2)} eV`], ['b1', ['晶胞内跃迁 |β₁|', 'Intra-cell hopping |β₁|'], 0, 4, 0.05, 2.6, (v) => `${fix(v, 2)} eV`], ['b2', ['晶胞间跃迁 |β₂|', 'Inter-cell hopping |β₂|'], 0, 4, 0.05, 2.1, (v) => `${fix(v, 2)} eV`], ['ne', ['每个晶胞的电子数', 'Electrons per cell'], 0, 4, 0.1, 2, (v) => fix(v, 1)]],
    btn: [[['等距链（金属）', 'Uniform chain (metal)'], { d: 0, b1: 2.4, b2: 2.4, ne: 2 }], [['键长交替（聚乙炔）', 'Bond alternation (polyacetylene)'], { d: 0, b1: 2.6, b2: 2.1, ne: 2 }], [['两种原子（离子性）', 'Two kinds of atom (ionic)'], { d: 2, b1: 1.2, b2: 1.2, ne: 2 }], [['孤立的双原子分子', 'Isolated diatomics'], { d: 0, b1: 2.5, b2: 0, ne: 2 }], [['氧化掺杂（每个晶胞少 0.4 个电子）', 'Oxidative doping (0.4 fewer electrons per cell)'], { d: 0, b1: 2.6, b2: 2.1, ne: 1.6 }]],
    figs: [[0.62, ['能带 E(k)，k 以 π/a 为单位（a 是晶胞长度）。金色虚线是费米能级，阴影是被占据的能量范围。', 'Bands E(k), with k in units of π/a (a is the cell length). The gold dashed line is the Fermi level; the shading marks the occupied energy range.']], [0.5, ['态密度（按 k 均匀取样、直方图统计，单位任意）。带边处态密度很高（一维的范霍夫奇点）。', 'Density of states (uniform k sampling, histogrammed, arbitrary units). It peaks at the band edges (one-dimensional van Hove singularities).']]],
    note: ['两原子晶胞的紧束缚（Hückel 型）模型按解析式精确计算：E±(k) = ᾱ ± √(δ² + β₁² + β₂² + 2β₁β₂ cos ka)，平均在位能 ᾱ 取 0，β 取负值。态密度是对两万个 k 点取样后的直方图。真实材料是三维的，有许多条轨道和电子–电子相互作用；这个模型只抓住了“重叠决定带宽、交替和异种原子打开带隙、填充决定导电性”这几个定性要点。聚乙炔那组跃迁积分是示意值，模型给出的带隙（约 1 eV）低于实测的约 1.5 eV。把电子拿走一些（氧化掺杂），费米能级落进价带，链就导电了：掺杂聚乙炔导电是 2000 年诺贝尔化学奖的工作，不过真实材料里拿走的电荷先和晶格畸变结合成孤子、极化子，不是简单地在刚性的带里留下空位。', 'The two-atom-cell tight-binding (Hückel-type) model is computed exactly from E±(k) = ᾱ ± √(δ² + β₁² + β₂² + 2β₁β₂ cos ka), with mean site energy ᾱ = 0 and negative β. The density of states is a histogram over twenty thousand k points. Real materials are three-dimensional, with many orbitals and electron–electron interactions; this model captures only the qualitative points that overlap sets the bandwidth, alternation and unlike atoms open a gap, and filling decides conduction. The polyacetylene hoppings are illustrative, and the model’s gap (about 1 eV) is below the measured value of about 1.5 eV. Remove some electrons (oxidative doping) and the Fermi level drops into the valence band, so the chain conducts: conducting doped polyacetylene was the work of the 2000 Nobel Prize in Chemistry, although in the real material the removed charge first binds to lattice distortions as solitons and polarons rather than simply leaving holes in rigid bands.'],
    draw(s, f, c) {
      const b1 = -s.b1, b2 = -s.b2, band = (k) => M.tbBands(k, s.d, -s.d, b1, b2);
      const ks = K.lin(-1, 1, 241), lo = ks.map((k) => band(k)[0]), up = ks.map((k) => band(k)[1]);
      // 费米能级：两条带各容纳每个晶胞 2 个电子，把全部 k 点的能量排序，按电子数取
      const NS = 20000, es = [];
      for (let i = 0; i < NS; i++) { const k = -1 + (2 * (i + 0.5)) / NS, [a, b] = band(k); es.push(a, b); }
      es.sort((x, y) => x - y);
      const occ = Math.round((s.ne / 4) * es.length), EF = occ <= 0 ? es[0] : occ >= es.length ? es[es.length - 1] : (es[occ - 1] + es[occ]) / 2;
      const loMax = Math.max(...lo), upMin = Math.min(...up), gap = Math.max(0, upMin - loMax), Emin = es[0], Emax = es[es.length - 1];
      const ym = Math.max(1, Math.abs(Emin), Math.abs(Emax)) * 1.12;
      const shade = occ > 0 ? [{ y0: Emin, y1: EF, color: c.gold, alpha: 0.12 }] : [];
      plot(f[0], { x: [-1, 1], y: [-ym, ym], xt: [-1, -0.5, 0, 0.5, 1], xf: (t) => (t === 0 ? '0' : t === 1 ? 'π/a' : t === -1 ? '−π/a' : t > 0 ? 'π/2a' : '−π/2a'), xl: 'k', yl: 'E / eV', hbands: shade, series: [{ xs: ks, ys: lo, color: c.accent, width: 2.6, label: L('下面的带', 'lower band') }, { xs: ks, ys: up, color: c.danger, width: 2.6, label: L('上面的带', 'upper band') }], hmarks: [{ y: EF, color: c.gold, dash: [6, 4] }] });
      // 态密度直方图
      const nb = 160, w = (2 * ym) / nb, h = new Array(nb).fill(0);
      for (const e of es) { const i = Math.floor((e + ym) / w); if (i >= 0 && i < nb) h[i]++; }
      const ex = h.map((_, i) => -ym + (i + 0.5) * w), hmax = Math.max(...h);
      const dos = h.map((v) => v / hmax);
      plot(f[1], { x: [-ym, ym], y: [0, 1.08], yt: [], xl: 'E / eV', yl: L('态密度', 'DOS'), bands: occ > 0 ? [{ x0: Emin, x1: EF, color: c.gold, alpha: 0.16 }] : [], series: [{ xs: ex, ys: dos, color: c.accent, width: 1.8, fill: true }], marks: [{ x: EF, color: c.gold }] });
      const full = Math.abs(s.ne - Math.round(s.ne)) < 1e-9 && Math.round(s.ne) % 2 === 0;
      const kind = s.ne <= 0 || s.ne >= 4 ? L('没有可动的电子', 'no mobile electrons') : full && gap > 0.05 ? (gap < 3 ? L('半导体', 'semiconductor') : L('绝缘体', 'insulator')) : L('金属', 'metal');
      return [[['带隙', 'Gap'], gap > 1e-3 ? `${fix(gap, 2)} eV` : L('没有', 'none'), 1], [['下面的带宽', 'Lower width'], `${fix(loMax - Emin, 2)} eV`], [['上面的带宽', 'Upper width'], `${fix(Emax - upMin, 2)} eV`], [['总宽度', 'Total width'], `${fix(Emax - Emin, 2)} eV`], [['费米能级', 'Fermi level'], `${fix(EF, 2)} eV`], [['判断', 'Verdict'], kind, 1]];
    },
  };

  // ── 半导体的载流子和费米能级 ────────────────────────────────────────────
  // 带隙的 Varshni 参数（Eg0 eV，α eV/K，β K）、有效质量（态密度质量，单位 m₀）、迁移率（cm² V⁻¹ s⁻¹，300 K 纯晶体），常引值，编者录入
  const MAT = {
    si: [['硅', 'Silicon'], { Eg0: 1.17, a: 4.73e-4, b: 636, me: 1.08, mh: 0.81, mun: 1400, mup: 450 }],
    ge: [['锗', 'Germanium'], { Eg0: 0.7437, a: 4.774e-4, b: 235, me: 0.56, mh: 0.29, mun: 3900, mup: 1900 }],
    gaas: [['砷化镓', 'Gallium arsenide'], { Eg0: 1.519, a: 5.405e-4, b: 204, me: 0.067, mh: 0.48, mun: 8500, mup: 400 }],
  };
  D.carriers = {
    kind: 'model',
    title: ['掺杂、温度和费米能级', 'Doping, temperature and the Fermi level'],
    intro: ['选一种半导体，调温度和掺杂浓度，看电子和空穴浓度、费米能级和电阻率怎样变。温度高到本征载流子超过掺杂浓度时，掺杂就“失效”了。', 'Pick a semiconductor and adjust temperature and doping to see the electron and hole concentrations, the Fermi level and the resistivity change. Once intrinsic carriers outnumber the dopants at high temperature, doping stops mattering.'],
    sel: [['m', ['材料', 'Material'], Object.entries(MAT).map(([k, v]) => [k, v[0]]), 'si']],
    ctl: [['T', ['温度', 'Temperature'], 150, 800, 5, 300, (v) => `${v} K（${fix(v - 273.15, 0)} °C）`], ['lN', ['掺杂浓度 lg(N / cm⁻³)', 'Doping lg(N / cm⁻³)'], 12, 19, 0.1, 16, (v) => `${fmt(10 ** v, 2)} cm⁻³`]],
    chk: [['dop', ['掺杂', 'Doped'], true], ['pt', ['p 型（受主，如硼）；不勾是 n 型（施主，如磷）', 'p-type (acceptors such as boron); unticked is n-type (donors such as phosphorus)'], false]],
    btn: [[['纯硅，室温', 'Pure silicon, room temperature'], { m: 'si', T: 300, dop: false }], [['硅掺磷 10¹⁶', 'Silicon + 10¹⁶ P'], { m: 'si', T: 300, dop: true, pt: false, lN: 16 }], [['硅掺硼 10¹⁶', 'Silicon + 10¹⁶ B'], { m: 'si', T: 300, dop: true, pt: true, lN: 16 }], [['锗掺杂，加热到 500 K', 'Doped germanium at 500 K'], { m: 'ge', T: 500, dop: true, pt: false, lN: 15 }], [['砷化镓，纯', 'Pure gallium arsenide'], { m: 'gaas', T: 300, dop: false }]],
    figs: [[0.6, ['载流子浓度对温度（对数纵轴）。蓝线是电子，红线是空穴，灰色虚线是本征浓度 n_i，金色竖线是当前温度。', 'Carrier concentration against temperature (log axis). Blue: electrons; red: holes; grey dashed: the intrinsic concentration n_i; gold: the current temperature.']], [0.62, ['能带图：价带顶取 0，导带底是 E_g。灰色虚线是本征能级 E_i，金线是费米能级 E_F。', 'Band diagram: valence-band top at 0 and conduction-band bottom at E_g. Grey dashed: the intrinsic level E_i; gold: the Fermi level E_F.']]],
    note: ['按非简并半导体的标准公式计算：有效态密度 N_c、N_v ∝ (m*T)^{3/2}，n_i = √(N_cN_v) e^{−E_g/2kT}，带隙随温度按 Varshni 式减小，电中性 n − p = N_d − N_a 和 np = n_i² 联立求出 n、p。假设杂质全部电离（低温下的“冻析”不计入，硅里大约 100 K 以下才明显）、掺杂不超过约 10¹⁸ cm⁻³（更浓时费米能级进到带里，要用费米–狄拉克统计），迁移率取 300 K 纯晶体的值且不随温度和掺杂变（实际上掺杂 10¹⁸ 时硅的电子迁移率降到约 300，高温下也会下降），所以掺杂浓、温度高时的电阻率只是量级。材料参数是常引值，由编者录入，未逐条复核。', 'Computed with the standard non-degenerate formulas: effective densities of states N_c, N_v ∝ (m*T)^{3/2}, n_i = √(N_cN_v) e^{−E_g/2kT}, the gap shrinking with temperature by the Varshni form, and charge neutrality n − p = N_d − N_a solved together with np = n_i². Dopants are assumed fully ionised (freeze-out at low temperature is ignored; in silicon it matters below about 100 K), doping is assumed below about 10¹⁸ cm⁻³ (beyond that the Fermi level enters a band and Fermi–Dirac statistics are needed), and mobilities are the 300 K values for pure crystals, held fixed with temperature and doping (in reality silicon’s electron mobility falls to about 300 at 10¹⁸ doping and also drops at high temperature), so resistivities at heavy doping or high temperature are only order-of-magnitude. Material parameters are commonly quoted values typed by the editor and not rechecked.'],
    draw(s, f, c) {
      const P = MAT[s.m][1], N = s.dop ? 10 ** s.lN : 0, Nd = s.pt ? 0 : N, Na = s.pt ? N : 0, r = M.semi(P, s.T, Nd, Na);
      const Ts = K.lin(150, 800, 131), rs = Ts.map((T) => M.semi(P, T, Nd, Na));
      plot(f[0], { x: [150, 800], y: [0, 20], logy: true, xl: 'T / K', yl: L('浓度 / cm⁻³', 'concentration / cm⁻³'), series: [{ xs: Ts, ys: rs.map((q) => q.ni), color: c.faint, width: 1.4, dash: [5, 4], label: 'n_i' }, { xs: Ts, ys: rs.map((q) => q.n), color: c.info, width: 2.4, label: L('电子 n', 'electrons n') }, { xs: Ts, ys: rs.map((q) => q.p), color: c.danger, width: 2.4, label: L('空穴 p', 'holes p') }], marks: [{ x: s.T, color: c.gold }] });
      const top = r.Eg + 0.35;
      plot(f[1], { x: [0, 1], y: [-0.35, top], xt: [], xl: '', yl: 'E / eV', hbands: [{ y0: -0.35, y1: 0, color: c.danger, alpha: 0.18 }, { y0: r.Eg, y1: top, color: c.info, alpha: 0.18 }], hmarks: [{ y: r.Ei, color: c.faint, dash: [5, 4] }, { y: r.EF, color: c.gold, dash: [] }], texts: [{ x: 0.02, y: -0.35, s: L('价带', 'valence band'), dy: -8, color: c.danger }, { x: 0.02, y: top, s: L('导带', 'conduction band'), dy: 16, color: c.info }, { x: 0.98, y: r.EF, s: 'E_F', dy: -6, align: 'right', color: c.gold }, { x: 0.72, y: r.Ei, s: 'E_i', dy: 14, align: 'right', color: c.ink2 }] });
      const type = !s.dop ? L('本征', 'intrinsic') : r.n > 10 * r.p ? L('n 型', 'n-type') : r.p > 10 * r.n ? L('p 型', 'p-type') : L('接近本征', 'near intrinsic');
      return [[['带隙', 'Gap'], `${fix(r.Eg, 3)} eV`], [['本征浓度 n_i', 'Intrinsic n_i'], `${fmt(r.ni, 2)} cm⁻³`], [['电子 n', 'Electrons n'], `${fmt(r.n, 2)} cm⁻³`, 1], [['空穴 p', 'Holes p'], `${fmt(r.p, 2)} cm⁻³`, 1], [['E_F − E_i', 'E_F − E_i'], `${fix(r.EF - r.Ei, 3)} eV`], [['电阻率', 'Resistivity'], `${fmt(1 / r.sigma, 3)} Ω cm`, 1], [['类型', 'Type'], type]];
    },
  };

  // ── 量子点：尺寸和颜色 ──────────────────────────────────────────────────
  // [名字, 块体带隙 eV（300 K）, m_e*, m_h*（单位 m₀）, 相对介电常数]，常引值，编者录入
  const QD = {
    cdse: [['CdSe', 'CdSe'], 1.74, 0.13, 0.45, 10.6],
    cds: [['CdS', 'CdS'], 2.42, 0.21, 0.8, 8.9],
    inp: [['InP', 'InP'], 1.34, 0.077, 0.64, 12.4],
    pbs: [['PbS', 'PbS'], 0.41, 0.085, 0.085, 17.2],
  };
  D.brus = {
    kind: 'model',
    title: ['量子点：尺寸决定颜色', 'Quantum dots: size sets the colour'],
    intro: ['调量子点的直径，看 Brus 方程给出的最低激发能和颜色怎样变。选 CdSe 时，图上的点是 Yu 等人由实测吸收谱和电镜尺寸拟合出的经验关系，可以看到简单模型在小尺寸时偏差有多大。', 'Adjust the dot diameter to see the lowest excitation energy and colour from the Brus equation. For CdSe the dots on the plot are the empirical relation Yu and co-workers fitted from measured absorption spectra and microscope sizes, showing how far the simple model drifts at small sizes.'],
    sel: [['m', ['材料', 'Material'], Object.entries(QD).map(([k, v]) => [k, v[0]]), 'cdse']],
    ctl: [['D', ['直径', 'Diameter'], 1.6, 16, 0.1, 4, (v) => `${fix(v, 1)} nm`]],
    btn: [[['CdSe 2.5 nm（蓝绿）', 'CdSe 2.5 nm (blue-green)'], { m: 'cdse', D: 2.5 }], [['CdSe 4 nm（黄）', 'CdSe 4 nm (yellow)'], { m: 'cdse', D: 4 }], [['CdSe 6.5 nm（红）', 'CdSe 6.5 nm (red)'], { m: 'cdse', D: 6.5 }], [['InP 4 nm（无镉）', 'InP 4 nm (cadmium-free)'], { m: 'inp', D: 4 }], [['PbS 5 nm（近红外）', 'PbS 5 nm (near infrared)'], { m: 'pbs', D: 5 }]],
    figs: [[0.6, ['最低激发能对直径。彩色线是 Brus 方程，灰色虚线是块体带隙，点是 CdSe 第一激子吸收峰的经验关系（Yu 等，2003）。', 'Lowest excitation energy against diameter. Coloured line: the Brus equation; grey dashed: the bulk gap; dots: the empirical first-exciton absorption of CdSe (Yu et al., 2003).']], ['html', ['第一吸收峰对应的光谱色（只在可见区画出）；CdSe 另给出实测拟合的颜色。', 'The spectral colour of the first absorption peak (drawn only in the visible); for CdSe the colour from the empirical fit is shown too.']]],
    note: ['Brus 方程（有效质量近似，球形无限深势阱，加一项电子–空穴库仑吸引）[@brus1984]。它用的是抛物线能带，量子点很小时限域能把电子推到能带不再是抛物线的地方，所以小尺寸时明显高估：CdSe 直径 2 nm 时它给出约 5.2 eV，实测第一吸收峰约 2.7 eV，直径 4 nm 时两者才接近（2.55 和约 2.1 eV）；PbS 这类激子玻尔半径很大（约 20 nm）的材料偏差更大。CdSe 的点用 Yu 等人 2003 年的多项式（第一激子吸收峰波长 → 直径，适用约 1.5–8 nm）[@yu2003]。显示的颜色是吸收峰对应的光谱色，实际的发光还会红移十几到二十纳米。材料参数是常引值，由编者录入，未逐条复核。', 'The Brus equation (effective-mass approximation, an infinitely deep spherical well, plus an electron–hole Coulomb term) [@brus1984]. It assumes parabolic bands; in very small dots the confinement pushes electrons where the bands are no longer parabolic, so it overestimates markedly at small sizes: for 2 nm CdSe it gives about 5.2 eV against a measured first absorption near 2.7 eV, and the two only approach each other around 4 nm (2.55 against about 2.1 eV); materials with a large exciton Bohr radius such as PbS (about 20 nm) deviate more. The CdSe dots use the 2003 polynomial of Yu and co-workers (first-exciton wavelength → diameter, valid for about 1.5–8 nm) [@yu2003]. The colour shown is the spectral colour of the absorption peak; actual emission is red-shifted by a further ten to twenty nanometres. Material parameters are commonly quoted values typed by the editor and not rechecked.'],
    draw(s, f, c) {
      const [nm, Eg, me, mh, eps] = QD[s.m], E = (Dn) => M.brus(Dn / 2, Eg, me, mh, eps);
      const ds = K.lin(1.6, 16, 145), ys = ds.map(E), ymax = Math.min(6, Math.max(...ys) + 0.2);
      const yu = s.m === 'cdse' ? K.lin(440, 640, 21).map((l) => [M.cdseD(l), 1239.84 / l]) : [];
      plot(f[0], { x: [1.6, 16], y: [Math.max(0, Eg - 0.3), ymax], xl: L('直径 / nm', 'diameter / nm'), yl: 'E / eV', series: [{ xs: ds, ys, color: c.accent, width: 2.6, label: L('Brus 方程', 'Brus equation') }, ...(yu.length ? [{ pts: yu, color: c.ink2, dots: 3.5, line: false, label: L('CdSe 实测拟合', 'CdSe empirical') }] : [])], hmarks: [{ y: Eg, color: c.faint }], marks: [{ x: s.D, y: E(s.D), color: c.gold }] });
      const e = E(s.D), lam = 1239.84 / e;
      const yuE = s.m === 'cdse' && s.D >= 1.6 && s.D <= 8 ? (() => { let lo = 440, hi = 660; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (M.cdseD(mid) < s.D) lo = mid; else hi = mid; } return 1239.84 / ((lo + hi) / 2); })() : null;
      const sw = (t, l) => { const vis = l >= 380 && l <= 780, rgb = vis ? M.waveRGB(l) : null; return `<div class="chm-box"><b>${t}</b><span>${fix(l, 0)} nm${vis ? '' : l < 380 ? L('，紫外', ', ultraviolet') : L('，红外', ', infrared')}</span><span style="display:block;height:34px;border-radius:6px;margin-top:4px;background:${rgb ? `rgb(${rgb.join(',')})` : 'transparent'};border:1px solid var(--line)"></span></div>`; };
      f[1].innerHTML = flow(box(L(`${nm[0]}，直径 ${fix(s.D, 1)} nm`, `${nm[1]}, ${fix(s.D, 1)} nm across`), L(`块体带隙 ${fix(Eg, 2)} eV`, `bulk gap ${fix(Eg, 2)} eV`)), sw(L('Brus 方程', 'Brus equation'), lam), ...(yuE ? [sw(L('实测拟合', 'Empirical fit'), 1239.84 / yuE)] : []));
      const R = (s.D / 2) * 1e-9, hbar = 1.054571817e-34, m0 = 9.1093837e-31, q = 1.602176634e-19;
      const conf = ((hbar * hbar * Math.PI * Math.PI) / (2 * R * R)) * (1 / (me * m0) + 1 / (mh * m0)) / q, coul = (1.786 * q) / (4 * Math.PI * 8.8541878128e-12 * eps * R);
      const aB = eps * 0.0529177 * (1 / me + 1 / mh); // 激子玻尔半径，nm
      return [[['激发能', 'Excitation'], `${fix(e, 2)} eV`, 1], [['波长', 'Wavelength'], `${fix(lam, 0)} nm`, 1], [['限域能', 'Confinement'], `+${fix(conf, 2)} eV`], [['库仑项', 'Coulomb'], `−${fix(coul, 2)} eV`], [['激子玻尔半径', 'Bohr radius'], `${fix(aB, 1)} nm`], ...(yuE ? [[['实测拟合', 'Empirical'], `${fix(yuE, 2)} eV`]] : [])];
    },
  };
});
