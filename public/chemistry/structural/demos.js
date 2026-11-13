'use strict';
// 化学学科馆 05 · 结构化学的四个演示：第二周期双原子分子的分子轨道、点群判定、立方晶体的粉末衍射、堆积与密度。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fix, pct, plot, levels, table, box, flow, fit, font } = K;
  const sub = (g) => (g.length > 1 ? `${g[0]}<sub>${g.slice(1)}</sub>` : g);
  const supN = (n) => String(n).replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]);

  // ── 双原子分子的分子轨道 ────────────────────────────────────────────────
  // [显示名, 价电子数, 每个原子的价电子数, 平衡键长 pm（气相；离子取盐里的典型值）]，键长由编者录入
  const MOL = {
    Li2: ['Li₂', 2, 1, 267.3], Be2: ['Be₂', 4, 2, 245], B2: ['B₂', 6, 3, 159.0], C2: ['C₂', 8, 4, 124.3], N2: ['N₂', 10, 5, 109.8], N2p: ['N₂⁺', 9, 5, 111.6],
    O2p: ['O₂⁺', 11, 6, 111.6], O2: ['O₂', 12, 6, 120.7], O2m: ['O₂⁻', 13, 6, 133], O2mm: ['O₂²⁻', 14, 6, 149], F2: ['F₂', 14, 7, 141.2], Ne2: ['Ne₂', 16, 8, 310],
  };
  const MIXED_AUTO = (k) => MOL[k][2] <= 5;
  const E = { mixed: { 'σ2s': -0.8, 'σ*2s': 0.9, 'π2p': 3.2, 'σ2p': 3.9, 'π*2p': 5.1, 'σ*2p': 6.2 }, plain: { 'σ2s': -0.8, 'σ*2s': 0.9, 'σ2p': 2.9, 'π2p': 3.5, 'π*2p': 5.1, 'σ*2p': 6.0 } };
  D.mo = {
    kind: 'model',
    title: ['第二周期双原子分子的分子轨道', 'Molecular orbitals of second-row diatomics'],
    intro: ['选一个分子或离子，看价电子怎样填进分子轨道，键级和磁性怎样跟着变；也可以手动打开或关掉 s–p 混合。', 'Pick a molecule or ion to see how the valence electrons fill the molecular orbitals and how bond order and magnetism follow; you can also switch s–p mixing on or off by hand.'],
    sel: [['m', ['分子', 'Molecule'], Object.entries(MOL).map(([k, v]) => [k, [v[0], v[0]]]), 'O2'], ['mix', ['轨道顺序', 'Orbital order'], [['auto', ['按实际（Li₂–N₂ 有 s–p 混合）', 'As observed (s–p mixing for Li₂–N₂)']], ['mixed', ['总是 s–p 混合（π2p 低于 σ2p）', 'Always mixed (π2p below σ2p)']], ['plain', ['不混合（σ2p 低于 π2p）', 'No mixing (σ2p below π2p)']]], 'auto']],
    btn: [[['O₂ 为什么是顺磁的', 'Why O₂ is paramagnetic'], { m: 'O2', mix: 'auto' }], [['B₂：s–p 混合决定磁性', 'B₂: s–p mixing decides magnetism'], { m: 'B2', mix: 'auto' }], [['N₂ 的三重键', 'The triple bond of N₂'], { m: 'N2', mix: 'auto' }], [['超氧根和过氧根', 'Superoxide and peroxide'], { m: 'O2m', mix: 'auto' }]],
    figs: [[0.78, ['左右两列是原子的 2s、2p，中间是分子轨道；金色箭头是电子。能量只是示意，不按比例。', 'The outer columns are the atoms’ 2s and 2p; the middle is the molecular orbitals; gold arrows are electrons. Energies are schematic, not to scale.']]],
    note: ['定性的分子轨道图：只算价电子、只排顺序，不解 Schrödinger 方程。第一行 σ2s 的成键和反键在 Be₂、Ne₂ 里相互抵消，键级为 0，它们只靠很弱的色散力结合（Be₂ 的结合能约 10 kJ/mol）。键长是气相平衡值（Huber 和 Herzberg 的光谱常数汇编），O₂⁻ 和 O₂²⁻ 取盐里的典型值，Ne₂ 是范德华距离，都由编者录入，未逐条复核。', 'A qualitative MO diagram: valence electrons only and the ordering only, with no Schrödinger equation solved. In Be₂ and Ne₂ bonding and antibonding cancel, the bond order is 0, and they are held only by weak dispersion (Be₂ is bound by about 10 kJ/mol). Bond lengths are gas-phase equilibrium values (from Huber and Herzberg’s compilation of spectroscopic constants); O₂⁻ and O₂²⁻ are typical values in salts and Ne₂ is a van der Waals distance. All were typed in by the editor and not rechecked one by one.'],
    draw(s, f, c) {
      const [nm, nel, va, re] = MOL[s.m], mixed = s.mix === 'auto' ? MIXED_AUTO(s.m) : s.mix === 'mixed', r = M.moFill(nel, mixed), en = E[mixed ? 'mixed' : 'plain'];
      const atom = (col) => [{ e: 0, col, n: 1, spins: [Math.min(2, va)], label: '2s' }, { e: 4.2, col, n: 3, spins: [0, 1, 2].map((k) => { const p = Math.max(0, va - 2); return (p > k ? 1 : 0) + (p > 3 + k ? 1 : 0); }), label: '2p' }];
      const mos = r.occ.map((o) => ({ e: en[o.key], col: 1, n: o.deg, spins: o.spins, label: o.key, color: o.sign > 0 ? c.accent : c.danger }));
      const links = [];
      for (const k of ['σ2s', 'σ*2s']) { links.push({ from: [0, 0], to: [1, en[k]], dx0: 20, dx1: -36 }, { from: [2, 0], to: [1, en[k]], dx0: -20, dx1: 36 }); }
      for (const k of ['σ2p', 'π2p', 'π*2p', 'σ*2p']) { links.push({ from: [0, 4.2], to: [1, en[k]], dx0: 52, dx1: -36 }, { from: [2, 4.2], to: [1, en[k]], dx0: -52, dx1: 36 }); }
      levels(f[0], { y: [-1.6, 6.9], cols: 3, heads: [L('原子', 'Atom'), nm, L('原子', 'Atom')], levels: [...atom(0), ...mos, ...atom(2)], links });
      const conf = r.occ.filter((o) => o.n).map((o) => `(${o.key})${supN(o.n)}`).join(' ');
      const bo = r.order, mag = r.unpaired ? L(`顺磁（${r.unpaired} 个未成对电子）`, `paramagnetic (${r.unpaired} unpaired)`) : L('反磁', 'diamagnetic');
      return [[['价电子组态', 'Valence configuration'], conf], [['成键 / 反键电子', 'Bonding / antibonding electrons'], `${r.bonding} / ${r.anti}`], [['键级', 'Bond order'], bo ? fix(bo, bo % 1 ? 1 : 0) : L('0（不成键）', '0 (no bond)'), 1], [['磁性', 'Magnetism'], mag, 1], [['实测键长（约）', 'Measured bond length (approx.)'], `${re} pm`]];
    },
  };

  // ── 点群判定 ────────────────────────────────────────────────────────────
  // 每个分子的对称元素（编者按结构写出）和期望的点群；tools/chemistry-test.mjs 核对流程给出的点群与期望一致
  const PG = [
    ['h2o', ['水', 'Water'], 'H₂O', { n: 2, sv: 1 }, 'C2v'], ['nh3', ['氨', 'Ammonia'], 'NH₃', { n: 3, sv: 1 }, 'C3v'], ['chcl3', ['三氯甲烷', 'Chloroform'], 'CHCl₃', { n: 3, sv: 1 }, 'C3v'],
    ['sf4', ['四氟化硫（跷跷板）', 'Sulfur tetrafluoride (seesaw)'], 'SF₄', { n: 2, sv: 1 }, 'C2v'], ['hcl', ['氯化氢', 'Hydrogen chloride'], 'HCl', { linear: 1 }, 'C∞v'], ['co2', ['二氧化碳', 'Carbon dioxide'], 'CO₂', { linear: 1, i: 1 }, 'D∞h'],
    ['ch4', ['甲烷', 'Methane'], 'CH₄', { cubic: 'Td' }, 'Td'], ['sf6', ['六氟化硫', 'Sulfur hexafluoride'], 'SF₆', { cubic: 'Oh', i: 1 }, 'Oh'], ['c60', ['富勒烯 C₆₀', 'Buckminsterfullerene C₆₀'], 'C₆₀', { cubic: 'Ih', i: 1 }, 'Ih'],
    ['bf3', ['三氟化硼', 'Boron trifluoride'], 'BF₃', { n: 3, perp: 1, sh: 1 }, 'D3h'], ['pcl5', ['五氯化磷', 'Phosphorus pentachloride'], 'PCl₅', { n: 3, perp: 1, sh: 1 }, 'D3h'], ['xef4', ['四氟化氙', 'Xenon tetrafluoride'], 'XeF₄', { n: 4, perp: 1, sh: 1, i: 1 }, 'D4h'],
    ['c6h6', ['苯', 'Benzene'], 'C₆H₆', { n: 6, perp: 1, sh: 1, i: 1 }, 'D6h'], ['c2h4', ['乙烯', 'Ethylene'], 'C₂H₄', { n: 2, perp: 1, sh: 1, i: 1 }, 'D2h'], ['ethst', ['乙烷（交叉式）', 'Ethane (staggered)'], 'C₂H₆', { n: 3, perp: 1, sv: 1, i: 1 }, 'D3d'],
    ['ethec', ['乙烷（重叠式）', 'Ethane (eclipsed)'], 'C₂H₆', { n: 3, perp: 1, sh: 1 }, 'D3h'], ['allene', ['丙二烯', 'Allene'], 'H₂C=C=CH₂', { n: 2, perp: 1, sv: 1 }, 'D2d'], ['chair', ['环己烷（椅式）', 'Cyclohexane (chair)'], 'C₆H₁₂', { n: 3, perp: 1, sv: 1, i: 1 }, 'D3d'],
    ['fcst', ['二茂铁（交错式）', 'Ferrocene (staggered)'], 'Fe(C₅H₅)₂', { n: 5, perp: 1, sv: 1, i: 1 }, 'D5d'], ['fcec', ['二茂铁（重叠式）', 'Ferrocene (eclipsed)'], 'Fe(C₅H₅)₂', { n: 5, perp: 1, sh: 1 }, 'D5h'], ['s8', ['环八硫（王冠形）', 'Cyclo-octasulfur (crown)'], 'S₈', { n: 4, perp: 1, sv: 1 }, 'D4d'],
    ['coen3', ['三（乙二胺）合钴(III)', 'Tris(ethylenediamine)cobalt(III)'], '[Co(en)₃]³⁺', { n: 3, perp: 1 }, 'D3'], ['h2o2', ['过氧化氢', 'Hydrogen peroxide'], 'H₂O₂', { n: 2 }, 'C2'], ['n2f2', ['反式二氟二氮烯', 'trans-Difluorodiazene'], 'N₂F₂', { n: 2, sh: 1, i: 1 }, 'C2h'],
    ['boh3', ['硼酸（平面）', 'Boric acid (planar)'], 'B(OH)₃', { n: 3, sh: 1 }, 'C3h'], ['tfcot', ['1,3,5,7-四氟环辛四烯', '1,3,5,7-Tetrafluorocyclooctatetraene'], 'C₈H₄F₄', { n: 2, s2n: 1 }, 'S4'], ['hocl', ['次氯酸', 'Hypochlorous acid'], 'HOCl', { sigma: 1 }, 'Cs'],
    ['meso', ['内消旋 1,2-二溴-1,2-二氯乙烷（反式构象）', 'meso-1,2-Dibromo-1,2-dichloroethane (anti)'], 'CHBrCl–CHBrCl', { i: 1 }, 'Ci'], ['chfclbr', ['溴氯氟甲烷', 'Bromochlorofluoromethane'], 'CHFClBr', {}, 'C1'],
  ];
  const Q = {
    linear: ['是线型分子吗？', 'Is it linear?'], cubic: ['有多条高次轴（四面体、八面体、二十面体那样）？', 'Several high-order axes (as in T, O, I)?'], cn: ['有旋转轴 Cₙ（n ≥ 2）？', 'Any rotation axis Cₙ (n ≥ 2)?'],
    sigma: ['有镜面？', 'Any mirror plane?'], i: ['有对称中心 i？', 'An inversion centre i?'], perp: ['有 {n} 条垂直于主轴的 C₂？', '{n} C₂ axes perpendicular to the principal axis?'],
    sh: ['有水平镜面 σh？', 'A horizontal mirror σh?'], sd: ['有 {n} 个二面角镜面 σd？', '{n} dihedral mirrors σd?'], sv: ['有 {n} 个竖直镜面 σv？', '{n} vertical mirrors σv?'], s2n: ['有和主轴重合的 S{2n}？', 'An S{2n} along the principal axis?'],
  };
  D.pointgroup = {
    kind: 'exact',
    title: ['判定分子的点群', 'Finding a molecule’s point group'],
    intro: ['选一个分子，按流程一步步回答“有没有这个对称元素”，最后得到点群，以及它是不是手性的、能不能有偶极矩。', 'Pick a molecule and answer “does it have this symmetry element?” step by step through the flowchart to reach its point group, and whether it is chiral and can have a dipole.'],
    sel: [['m', ['分子', 'Molecule'], PG.map(([k, n, fm]) => [k, [`${fm} · ${n[0]}`, `${fm} · ${n[1]}`]]), 'h2o']],
    btn: [[['水', 'Water'], { m: 'h2o' }], [['二茂铁的两种构象', 'Ferrocene conformers'], { m: 'fcst' }], [['少见的 S₄', 'The rare S₄'], { m: 'tfcot' }], [['手性的配合物', 'A chiral complex'], { m: 'coen3' }]],
    figs: [['html', ['判定路径：每一格是一个问题和这个分子的答案。', 'The path: each box is a question and this molecule’s answer.']]],
    note: ['点群判定是精确的逻辑：答案由对称元素唯一决定。每个分子的对称元素由编者按理想几何写出（例如二茂铁的两种构象、环己烷取理想椅式）；真实分子的振动会暂时破坏对称性，但平均结构的点群就是这里给出的。“极性”指能不能有永久偶极矩：只有 C₁、Cₛ、Cₙ、Cₙᵥ 可以。“手性”指没有任何非真转动 Sₙ。', 'Point-group assignment is exact logic: the answer is fixed by the symmetry elements. Each molecule’s elements were written down by the editor for its idealised geometry (the two ferrocene conformers, an ideal cyclohexane chair, and so on); real molecules vibrate away from this symmetry momentarily, but the point group of the average structure is the one shown. “Polar” means able to have a permanent dipole: only C₁, Cₛ, Cₙ and Cₙᵥ can. “Chiral” means having no improper rotation Sₙ.'],
    draw(s, f) {
      const row = PG.find((r) => r[0] === s.m), pg = M.pointGroup(row[3]), g = pg.group, n = row[3].n || 1;
      const cells = pg.steps.map(([q, v]) => box(L(Q[q][0], Q[q][1]).replace('{n}', n).replace('{2n}', ['₀','₁','₂','₃','₄','₅','₆','₇','₈','₉','₁₀','₁₁','₁₂'][2 * n] || '₂ₙ'), v ? L('是', 'yes') : L('否', 'no'), v ? 'is-accent' : ''));
      f[0].innerHTML = flow(...cells, `<div class="chm-box is-gold"><b>${L('点群', 'Point group')}</b><span style="font-size:17px">${sub(g)}</span></div>`);
      const h = M.groupOrder(g);
      return [[['点群', 'Point group'], sub(g), 1], [['群的阶（对称操作数）', 'Order (number of operations)'], Number.isFinite(h) ? String(h) : '∞'], [['手性', 'Chiral'], M.chiralGroup(g) ? L('是（有对映体）', 'yes (has an enantiomer)') : L('不是', 'no'), 1], [['可以有永久偶极矩', 'Can have a permanent dipole'], M.polarGroup(g) ? L('可以', 'yes') : L('不可以', 'no'), 1]];
    },
  };

  // ── 立方晶体与粉末衍射 ──────────────────────────────────────────────────
  // a（pm，室温）、摩尔质量、常引的室温密度（g/cm³），Z 是两种原子 / 离子的电子数；都由编者录入
  const X = {
    Po: { t: 'sc', a: 335.9, M: 208.98, rho: 9.196, Z: [84], n: ['α-钋', 'α-Polonium'] },
    Fe: { t: 'bcc', a: 286.65, M: 55.845, rho: 7.874, Z: [26], n: ['α-铁', 'α-Iron'] },
    Na: { t: 'bcc', a: 429.06, M: 22.990, rho: 0.968, Z: [11], n: ['钠', 'Sodium'] },
    W: { t: 'bcc', a: 316.52, M: 183.84, rho: 19.25, Z: [74], n: ['钨', 'Tungsten'] },
    Cu: { t: 'fcc', a: 361.49, M: 63.546, rho: 8.96, Z: [29], n: ['铜', 'Copper'] },
    Al: { t: 'fcc', a: 404.95, M: 26.982, rho: 2.70, Z: [13], n: ['铝', 'Aluminium'] },
    Ag: { t: 'fcc', a: 408.53, M: 107.868, rho: 10.49, Z: [47], n: ['银', 'Silver'] },
    Au: { t: 'fcc', a: 407.82, M: 196.967, rho: 19.30, Z: [79], n: ['金', 'Gold'] },
    Mg: { t: 'hcp', a: 320.94, c: 521.08, M: 24.305, rho: 1.738, Z: [12], n: ['镁', 'Magnesium'] },
    Zn: { t: 'hcp', a: 266.49, c: 494.68, M: 65.38, rho: 7.14, Z: [30], n: ['锌', 'Zinc'] },
    Ti: { t: 'hcp', a: 295.08, c: 468.55, M: 47.867, rho: 4.506, Z: [22], n: ['α-钛', 'α-Titanium'] },
    C: { t: 'diamond', a: 356.71, M: 12.011, rho: 3.515, Z: [6], n: ['金刚石', 'Diamond'] },
    Si: { t: 'diamond', a: 543.10, M: 28.085, rho: 2.329, Z: [14], n: ['硅', 'Silicon'] },
    Ge: { t: 'diamond', a: 565.79, M: 72.630, rho: 5.323, Z: [32], n: ['锗', 'Germanium'] },
    NaCl: { t: 'rocksalt', a: 564.02, M: 58.443, rho: 2.165, Z: [18, 10], n: ['氯化钠（岩盐）', 'Sodium chloride (rock salt)'], r: [181, 102], who: ['Cl⁻', 'Na⁺'] },
    KCl: { t: 'rocksalt', a: 629.2, M: 74.551, rho: 1.984, Z: [18, 18], n: ['氯化钾', 'Potassium chloride'], r: [181, 138], who: ['Cl⁻', 'K⁺'] },
    CsCl: { t: 'cscl', a: 412.3, M: 168.36, rho: 3.988, Z: [18, 54], n: ['氯化铯', 'Caesium chloride'], r: [181, 174], who: ['Cl⁻', 'Cs⁺'] },
    GaAs: { t: 'zincblende', a: 565.33, M: 144.645, rho: 5.317, Z: [31, 33], n: ['砷化镓（闪锌矿）', 'Gallium arsenide (zinc blende)'], r: [122, 119], who: ['Ga', 'As'] },
    CaF2: { t: 'fluorite', a: 546.3, M: 78.07, rho: 3.18, Z: [18, 10], n: ['氟化钙（萤石）', 'Calcium fluoride (fluorite)'], r: [112, 131], who: ['Ca²⁺', 'F⁻'] },
  };
  const TYPE = { sc: ['简单立方', 'simple cubic'], bcc: ['体心立方', 'body-centred cubic'], fcc: ['面心立方', 'face-centred cubic'], hcp: ['六方密堆积', 'hexagonal close-packed'], diamond: ['金刚石型', 'diamond'], rocksalt: ['岩盐型', 'rock salt'], cscl: ['氯化铯型', 'caesium chloride'], zincblende: ['闪锌矿型', 'zinc blende'], fluorite: ['萤石型', 'fluorite'] };
  const RULE = { sc: ['所有 hkl 都出现', 'all hkl appear'], bcc: ['h + k + l 为偶数', 'h + k + l even'], fcc: ['h、k、l 全奇或全偶', 'h, k, l all odd or all even'], diamond: ['全奇，或全偶且 h + k + l 是 4 的倍数', 'all odd, or all even with h + k + l a multiple of 4'], rocksalt: ['面心格子的规则；全奇的衍射是两种离子之差，所以弱', 'the fcc rule; all-odd reflections are a difference of the two ions and so weak'], cscl: ['都出现；h + k + l 为奇数的是两种离子之差，所以弱', 'all appear; h + k + l odd is a difference of the two ions and so weak'], zincblende: ['面心格子的规则', 'the fcc rule'], fluorite: ['面心格子的规则', 'the fcc rule'] };
  const LAM = { cu: [154.06, 'Cu Kα₁'], co: [178.90, 'Co Kα₁'], mo: [70.93, 'Mo Kα₁'] };
  const cubicKeys = Object.keys(X).filter((k) => X[k].t !== 'hcp');
  const atomsOf = (x) => M.cubicCell(x.t).map((q) => ({ Z: q.s === 'A' ? x.Z[0] : x.Z[1], p: q.p }));
  const hklLab = (r) => (r.on.length ? r.on : r.hkl).map((s) => `(${s})`).join('/');
  D.powder = {
    kind: 'model',
    title: ['立方晶体的粉末衍射图', 'Powder patterns of cubic crystals'],
    intro: ['选一种晶体和 X 射线，看衍射峰在哪里、哪些被系统消光。峰位由 Bragg 方程精确给出，强度由结构因子粗略估算。', 'Choose a crystal and an X-ray source to see where the peaks fall and which are systematically absent. Peak positions follow exactly from Bragg’s law; intensities are a rough structure-factor estimate.'],
    sel: [['x', ['晶体', 'Crystal'], cubicKeys.map((k) => [k, [`${X[k].n[0]} · ${TYPE[X[k].t][0]}`, `${X[k].n[1]} · ${TYPE[X[k].t][1]}`]]), 'Cu'], ['lam', ['X 射线', 'X-rays'], Object.entries(LAM).map(([k, v]) => [k, [`${v[1]}（${v[0]} pm）`, `${v[1]} (${v[0]} pm)`]]), 'cu']],
    chk: [['lab', ['标出衍射指数', 'Label the reflections'], true]],
    btn: [[['铜（面心）', 'Copper (fcc)'], { x: 'Cu', lam: 'cu' }], [['铁（体心）', 'Iron (bcc)'], { x: 'Fe', lam: 'cu' }], [['硅：(200) 也消失', 'Silicon: (200) vanishes too'], { x: 'Si', lam: 'cu' }], [['KCl 像简单立方', 'KCl looks simple cubic'], { x: 'KCl', lam: 'cu' }]],
    figs: [[0.5, ['粉末衍射图（相对强度，峰宽人为取 0.25°）。灰色短线是这个晶胞允许的位置里被消光的那些。', 'Powder pattern (relative intensity, peak width set to 0.25°). Grey ticks mark positions in this cell that are systematically absent.']], ['html', ['前几条衍射：指数、N = h² + k² + l²、晶面间距和 2θ。', 'The first reflections: indices, N = h² + k² + l², spacing and 2θ.']]],
    note: ['峰位是精确的：只要晶胞参数对，2θ 就对。强度只是示意：原子散射因子用 Z·exp(−2.5 s²) 粗略代替（s = sin θ/λ，Å⁻¹），考虑了多重度和 Lorentz–偏振因子，没有计入温度因子、吸收和择优取向，和实测的相对强度可以差到三成。KCl 里 K⁺ 和 Cl⁻ 都有 18 个电子，全奇的衍射几乎抵消，图样看起来像晶胞减半的简单立方，这正是早年 Bragg 解 KCl 时碰到的现象。晶胞参数是常引的室温值，由编者录入，未逐条复核。', 'Positions are exact: if the cell parameter is right, 2θ is right. Intensities are indicative only: atomic scattering factors are crudely replaced by Z·exp(−2.5 s²) (s = sin θ/λ in Å⁻¹), with multiplicity and the Lorentz–polarisation factor included but no temperature factor, absorption or preferred orientation, so relative intensities may be off by up to thirty per cent. In KCl, K⁺ and Cl⁻ both have 18 electrons, the all-odd reflections almost cancel and the pattern looks like a simple cubic cell of half the size, exactly what the Braggs met when they solved KCl. Cell parameters are commonly quoted room-temperature values typed in by the editor and not rechecked one by one.'],
    draw(s, f, c) {
      const x = X[s.x], [lam, lamN] = LAM[s.lam], tmax = Math.min(150, s.lam === 'mo' ? 70 : 150), R = M.powder(x.a, lam, atomsOf(x), tmax), on = R.filter((r) => !r.absent);
      const ts = K.lin(5, tmax, 1400), w = 0.25 / 2.355, ys = ts.map((t) => on.reduce((y, r) => y + r.I * Math.exp(-0.5 * ((t - r.tth) / w) ** 2), 0));
      const texts = s.lab ? on.filter((r) => r.I > 3).slice(0, 14).map((r) => ({ x: r.tth, y: Math.min(r.I, 100) + 3, s: hklLab(r).replace(/[()]/g, ''), align: 'center', color: c.ink2 })) : [];
      plot(f[0], { x: [5, tmax], y: [0, 118], xl: '2θ / °', yl: L('相对强度', 'Relative intensity'), series: [{ xs: ts, ys, color: c.accent, width: 1.8, fill: true }, { xs: R.filter((r) => r.absent).map((r) => r.tth), ys: R.filter((r) => r.absent).map(() => 6), sticks: true, color: c.faint, width: 1.2 }], texts });
      f[1].innerHTML = table([L('指数 hkl', 'hkl'), 'N', 'd / pm', '2θ / °', L('相对强度', 'Rel. intensity')], R.slice(0, 12).map((r) => [hklLab(r), String(r.N), fix(r.d, 1), fix(r.tth, 2), r.absent ? L('消光', 'absent') : fix(r.I, 1)]));
      const first = on[0];
      return [[['晶格类型', 'Lattice type'], L(TYPE[x.t][0], TYPE[x.t][1])], [['晶胞参数 a', 'Cell parameter a'], `${x.a} pm`], [['衍射条件', 'Reflection condition'], L(RULE[x.t][0], RULE[x.t][1])], [[`第一条衍射（${lamN}）`, `First reflection (${lamN})`], `${hklLab(first)} · 2θ = ${fix(first.tth, 2)}°`, 1], [['这一范围里出现的衍射', 'Reflections in this range'], `${on.length} / ${R.length}`]];
    },
  };

  // ── 堆积与密度 ──────────────────────────────────────────────────────────
  const CN = { sc: '6', bcc: '8', fcc: '12', hcp: '12', diamond: '4', rocksalt: '6 : 6', cscl: '8 : 8', zincblende: '4 : 4', fluorite: '8 : 4' };
  const ZC = { sc: 1, bcc: 2, fcc: 4, hcp: 2, diamond: 8, rocksalt: 4, cscl: 1, zincblende: 4, fluorite: 4 };
  // 画晶胞：立方用斜投影，六方画一个六棱柱（三个原胞）
  function drawCell(cv, x, s, c) {
    const { ctx, w, h } = fit(cv);
    let pts = [], edges = [], scale, rA, rB;
    const P = (p) => [p[0] + 0.42 * p[1], p[2] + 0.3 * p[1]];
    if (x.t === 'hcp') {
      const q = x.c / x.a, hex = Array.from({ length: 6 }, (_, k) => [Math.cos((k * Math.PI) / 3), Math.sin((k * Math.PI) / 3)]);
      for (const z of [0, q]) { for (const v of hex) pts.push({ p: [v[0], v[1], z], s: 'A' }); pts.push({ p: [0, 0, z], s: 'A' }); }
      for (let k = 0; k < 3; k++) { const t = Math.PI / 6 + (2 * k * Math.PI) / 3; pts.push({ p: [Math.cos(t) / Math.sqrt(3), Math.sin(t) / Math.sqrt(3), q / 2], s: 'A' }); }
      for (const z of [0, q]) for (let k = 0; k < 6; k++) edges.push([[...hex[k], z], [...hex[(k + 1) % 6], z]]);
      for (const v of hex) edges.push([[v[0], v[1], 0], [v[0], v[1], q]]);
      rA = 0.5;
    } else {
      for (const at of M.cubicCell(x.t)) {
        const opts = at.p.map((v) => (Math.abs(v) < 1e-9 ? [0, 1] : [v]));
        for (const a of opts[0]) for (const b of opts[1]) for (const z of opts[2]) pts.push({ p: [a, b, z], s: at.s });
      }
      const C = [[0, 0, 0], [1, 0, 0], [0, 1, 0], [0, 0, 1], [1, 1, 0], [1, 0, 1], [0, 1, 1], [1, 1, 1]];
      for (const a of C) for (const b of C) if (a < b && Math.abs(a[0] - b[0]) + Math.abs(a[1] - b[1]) + Math.abs(a[2] - b[2]) === 1) edges.push([a, b]);
      if (x.r) { rA = x.r[0] / x.a; rB = x.r[1] / x.a; } else rA = M.touchRadius(x.t, 1);
    }
    const xy = pts.map((q) => P(q.p)).concat(edges.flat().map(P)), us = xy.map((p) => p[0]), vs = xy.map((p) => p[1]);
    const u0 = Math.min(...us) - 0.35, u1 = Math.max(...us) + 0.35, v0 = Math.min(...vs) - 0.35, v1 = Math.max(...vs) + 0.35;
    scale = Math.min(w / (u1 - u0), h / (v1 - v0));
    const ox = (w - (u1 - u0) * scale) / 2, oy = (h - (v1 - v0) * scale) / 2, S = (p) => { const [u, v] = P(p); return [ox + (u - u0) * scale, h - oy - (v - v0) * scale]; };
    ctx.strokeStyle = c.line; ctx.lineWidth = 1.2;
    for (const [a, b] of edges) { const A = S(a), B = S(b); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }
    if (x.t === 'diamond' || x.t === 'zincblende') {
      const d0 = Math.sqrt(3) / 4 + 1e-6; ctx.strokeStyle = c.muted; ctx.lineWidth = 2;
      for (const a of pts) for (const b of pts) if (a !== b && a.p[0] + a.p[1] + a.p[2] < b.p[0] + b.p[1] + b.p[2] && Math.hypot(a.p[0] - b.p[0], a.p[1] - b.p[1], a.p[2] - b.p[2]) < d0) { const A = S(a.p), B = S(b.p); ctx.beginPath(); ctx.moveTo(A[0], A[1]); ctx.lineTo(B[0], B[1]); ctx.stroke(); }
    }
    const k = s.real ? 1 : 0.32;
    pts.sort((a, b) => b.p[1] - a.p[1]);
    for (const q of pts) {
      const [X0, Y0] = S(q.p), r = Math.max(3, (q.s === 'B' ? rB : rA) * scale * k);
      const base = q.s === 'B' ? c.info : x.r ? c.ok : c.accent, gr = ctx.createRadialGradient(X0 - r * 0.35, Y0 - r * 0.35, r * 0.1, X0, Y0, r); gr.addColorStop(0, c.paper); gr.addColorStop(0.35, base); gr.addColorStop(1, base);
      ctx.globalAlpha = s.real ? 0.85 : 1; ctx.fillStyle = gr; ctx.beginPath(); ctx.arc(X0, Y0, r, 0, 2 * Math.PI); ctx.fill();
      ctx.globalAlpha = 1; ctx.strokeStyle = c.paper; ctx.lineWidth = 1; ctx.stroke();
    }
    if (s.holes && x.t === 'fcc') {
      const oct = [[0.5, 0.5, 0.5], [0.5, 0, 0], [0, 0.5, 0], [0, 0, 0.5], [0.5, 1, 0], [0.5, 0, 1], [0.5, 1, 1], [1, 0.5, 0], [0, 0.5, 1], [1, 0.5, 1], [1, 0, 0.5], [0, 1, 0.5], [1, 1, 0.5]];
      const tet = [0.25, 0.75].flatMap((a) => [0.25, 0.75].flatMap((b) => [0.25, 0.75].map((z) => [a, b, z])));
      for (const p of oct) { const [X0, Y0] = S(p); ctx.fillStyle = c.danger; ctx.fillRect(X0 - 4, Y0 - 4, 8, 8); }
      for (const p of tet) { const [X0, Y0] = S(p); ctx.fillStyle = c.gold; ctx.beginPath(); ctx.moveTo(X0, Y0 - 6); ctx.lineTo(X0 - 5.2, Y0 + 3); ctx.lineTo(X0 + 5.2, Y0 + 3); ctx.closePath(); ctx.fill(); }
    }
    ctx.font = font(11, 600); ctx.fillStyle = c.ink2; ctx.textAlign = 'left';
    ctx.fillText(x.t === 'hcp' ? L('六方晶胞（三个原胞拼成的六棱柱）', 'Hexagonal cell (prism of three primitive cells)') : L('惯用晶胞', 'Conventional cell'), 8, 16);
  }
  D.packing = {
    kind: 'exact',
    title: ['堆积方式、空间利用率和密度', 'Packing, packing fraction and density'],
    intro: ['选一种金属或离子晶体，看它的晶胞、配位数和空间利用率，并且只用晶胞参数和摩尔质量算出密度，和实测值比。', 'Choose a metal or an ionic crystal to see its cell, coordination number and packing fraction, and compute its density from the cell parameter and molar mass alone, compared with the measured value.'],
    sel: [['x', ['晶体', 'Crystal'], Object.keys(X).map((k) => [k, [`${X[k].n[0]} · ${TYPE[X[k].t][0]}`, `${X[k].n[1]} · ${TYPE[X[k].t][1]}`]]), 'Cu']],
    chk: [['real', ['原子画成真实大小（相切）', 'Draw atoms at true size (touching)'], false], ['holes', ['标出八面体和四面体空隙（面心立方）', 'Show octahedral and tetrahedral holes (fcc)'], false]],
    btn: [[['铜的空隙', 'Holes in copper'], { x: 'Cu', holes: true, real: false }], [['体心的铁', 'Body-centred iron'], { x: 'Fe', holes: false }], [['镁：六方密堆积', 'Magnesium: hcp'], { x: 'Mg', holes: false }], [['金刚石为什么这么空', 'Why diamond is so empty'], { x: 'C', holes: false, real: false }]],
    figs: [[0.78, ['晶胞的斜投影。二元晶体的两种原子分别画成绿色和蓝色（右边读数里写着哪个是哪个）；红方块是八面体空隙，金三角是四面体空隙。', 'Oblique projection of the cell. The two kinds of atom in a binary crystal are drawn green and blue (the readout says which is which); red squares are octahedral holes, gold triangles tetrahedral holes.']]],
    note: ['由晶胞求密度是精确的几何：ρ = ZM/(N_A V)。和实测的差别来自晶胞参数的温度、空位和杂质，通常在 0.5 % 以内。单质的空间利用率按原子相切算（六方密堆积用实际的 c/a，所以镁略高于理想的 74.05 %、锌和钛的 c/a 偏离理想值较多）；离子晶体用 Shannon 离子半径、GaAs 用共价半径，这些半径本身就是约定，空间利用率只能看大小。晶胞参数、半径和密度都是常引的室温值，由编者录入，未逐条复核。', 'Density from the cell is exact geometry: ρ = ZM/(N_A V). Differences from the measured value come from the temperature of the cell parameter, vacancies and impurities, and are usually within 0.5 %. For elements the packing fraction assumes touching atoms (hcp uses the actual c/a, so magnesium comes out slightly above the ideal 74.05 %, while zinc and titanium depart further from the ideal c/a); ionic crystals use Shannon ionic radii and GaAs covalent radii. Those radii are themselves conventions, so these packing fractions indicate size only. Cell parameters, radii and densities are commonly quoted room-temperature values typed in by the editor and not rechecked one by one.'],
    draw(s, f, c) {
      const x = X[s.x], V = M.cellVolume(x.t, x.a, x.c), Z = ZC[x.t], rho = M.cellDensity(Z, x.M, V);
      drawCell(f[0], x, s, c);
      const phi = M.packFraction(Z, x.r ? (x.t === 'fluorite' ? [x.r[0], x.r[1], x.r[1]] : x.r) : [M.touchRadius(x.t, x.a)], V);
      const rows = [[['结构类型', 'Structure type'], L(TYPE[x.t][0], TYPE[x.t][1])], [[x.r ? '每个晶胞的式量数 Z' : '每个晶胞的原子数 Z', x.r ? 'Formula units per cell Z' : 'Atoms per cell Z'], String(Z)], [['配位数', 'Coordination number'], CN[x.t]],
        [['空间利用率', 'Packing fraction'], pct(phi), 1], [['由晶胞算出的密度', 'Density from the cell'], `${fix(rho, 3)} g/cm³`, 1], [['实测密度', 'Measured density'], `${x.rho} g/cm³（${(100 * (rho / x.rho - 1)).toFixed(1).replace('-', '−')} %）`]];
      if (x.who) rows.push([['绿色 / 蓝色', 'Green / blue'], `${x.who[0]} / ${x.who[1]}`]);
      if (!x.r) rows.push([['相切的原子半径', 'Touching atomic radius'], `${fix(M.touchRadius(x.t, x.a), 1)} pm`]);
      if (x.t === 'hcp') rows.push([['c/a（理想值 1.633）', 'c/a (ideal 1.633)'], fix(x.c / x.a, 3)]);
      return rows;
    },
  };
});
