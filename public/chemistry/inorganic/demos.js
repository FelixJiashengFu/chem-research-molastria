'use strict';
// 化学学科馆 01 · 无机化学的三个演示：Slater 有效核电荷与电离能、Born–Haber 循环与晶格能、Frost 图。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, plot, flow, box, table } = K;
  const sym = (z) => M.SYMBOLS[z];

  // ── Slater 规则 ─────────────────────────────────────────────────────────
  D.slater = {
    kind: 'data',
    title: ['有效核电荷和第一电离能：周期表上的锯齿', 'Effective nuclear charge and first ionisation energy: the sawtooth of the table'],
    intro: ['拖动原子序数，看最外层电子的 Slater 有效核电荷、由它估算的电离能和实测值怎样随周期变化。', 'Move along the atomic numbers to see the Slater effective nuclear charge on the outermost electron, the ionisation energy estimated from it, and the measured value.'],
    ctl: [['z', ['原子序数 Z', 'Atomic number Z'], 1, 36, 1, 11, (v) => `${v} · ${sym(v)}`]],
    btn: [[['碱金属 K', 'Alkali metal K'], { z: 19 }], [['N 和 O 的台阶', 'The N–O step'], { z: 8 }], [['锌 Zn', 'Zinc'], { z: 30 }], [['氪 Kr', 'Krypton'], { z: 36 }]],
    figs: [[0.5, ['最外层电子的 Z*（Slater 规则）。金色点是当前元素。', 'Z* on the outermost electron (Slater’s rules). The gold dot is the current element.']], [0.5, ['第一电离能：实线是实测（NIST），虚线是 13.6 eV × (Z*/n*)² 的估计。', 'First ionisation energy: solid line measured (NIST), dashed line the estimate 13.6 eV × (Z*/n*)².']]],
    note: ['Slater 规则把屏蔽常数写成几档固定数（0.35、0.85、1.00），是 1930 年的经验规则 [@slater1930]；它把 s 和 p 电子放在同一组，所以解释不了 B 比 Be 低、O 比 N 低的台阶（这要靠 2p 比 2s 屏蔽更多、以及电子成对的排斥）。实测电离能是 NIST 原子光谱数据库的数值，由编者按手册录入，云端连不上 NIST，没有逐条联网核对。类氢估计对过渡金属偏高很多，演示正好能看出这个公式的适用范围。', 'Slater’s rules write shielding as a few fixed numbers (0.35, 0.85, 1.00), an empirical rule of 1930 [@slater1930]; they put s and p in one group, so they cannot explain the dips at B and O (which come from 2p being more shielded than 2s and from pairing repulsion). Measured ionisation energies are NIST Atomic Spectra Database values typed in by the editor; the cloud environment could not reach NIST to recheck them one by one. The hydrogen-like estimate is far too high for the transition metals, which shows where the formula stops working.'],
    draw(s, f, c) {
      const zs = Array.from({ length: 36 }, (_, i) => i + 1), zf = zs.map((z) => { const v = M.valence(z); return M.slater(z, v.n, v.l).zeff; });
      const v = M.valence(s.z), r = M.slater(s.z, v.n, v.l), est = M.slaterIE(s.z);
      const period = [2, 10, 18, 36].map((x) => ({ x: x + 0.5, color: c.line }));
      plot(f[0], { x: [0.5, 36.5], y: [0, 9], xl: 'Z', yl: 'Z*', series: [{ xs: zs, ys: zf, color: c.accent, dots: 3, line: true }], marks: [...period, { x: s.z, y: r.zeff, color: c.gold }] });
      plot(f[1], { x: [0.5, 36.5], y: [0, 26], xl: 'Z', yl: 'IE₁ / eV', series: [{ xs: zs, ys: zs.map((z) => M.IE1[z]), color: c.accent, dots: 2.5, line: true, label: L('实测', 'measured') }, { xs: zs, ys: zs.map((z) => M.slaterIE(z)), color: c.muted, dash: [5, 4], width: 1.4, label: L('Slater 估计', 'Slater estimate') }], marks: [...period, { x: s.z, y: M.IE1[s.z], color: c.gold }] });
      return [[['元素', 'Element'], `${sym(s.z)}（Z = ${s.z}）`, 1], [['电子排布', 'Configuration'], M.configText(s.z)], [[`最外层 ${v.n}${'spdf'[v.l]} 电子的 σ`, `σ for the outer ${v.n}${'spdf'[v.l]} electron`], fix(r.sigma, 2)], [['有效核电荷 Z*', 'Effective nuclear charge Z*'], fix(r.zeff, 2), 1], [['实测 IE₁', 'Measured IE₁'], `${fix(M.IE1[s.z], 3)} eV`], [['估计 13.6 (Z*/n*)²', 'Estimate 13.6 (Z*/n*)²'], `${fix(est, 1)} eV`]];
    },
  };

  // ── Born–Haber 循环 ─────────────────────────────────────────────────────
  // 数据（kJ/mol，298 K）：sub 金属升华，ie 电离能之和，atom 非金属原子化，ea 电子获得焓之和，dfH 生成焓；
  // 结构：madelung 常数（对 r₀），nu 每式离子数，r₀（pm），Born 指数 n，Shannon 六配位半径（pm）
  const SALTS = {
    NaCl: { z: [1, 1], sub: 107.3, ie: 495.8, atom: 121.7, ea: -349.0, dfH: -411.2, madelung: 1.74756, nu: 2, r0: 282.0, n: 8, rp: 102, rm: 181, type: ['NaCl 型', 'rock salt'] },
    KCl: { z: [1, 1], sub: 89.0, ie: 418.8, atom: 121.7, ea: -349.0, dfH: -436.5, madelung: 1.74756, nu: 2, r0: 314.6, n: 9, rp: 138, rm: 181, type: ['NaCl 型', 'rock salt'] },
    LiF: { z: [1, 1], sub: 159.3, ie: 520.2, atom: 79.4, ea: -328.2, dfH: -616.0, madelung: 1.74756, nu: 2, r0: 201.3, n: 6, rp: 76, rm: 133, type: ['NaCl 型', 'rock salt'] },
    CsCl: { z: [1, 1], sub: 76.1, ie: 375.7, atom: 121.7, ea: -349.0, dfH: -443.0, madelung: 1.76267, nu: 2, r0: 356.2, n: 10.5, rp: 167, rm: 181, type: ['CsCl 型', 'caesium chloride'] },
    MgO: { z: [2, 2], sub: 147.1, ie: 2188.4, atom: 249.2, ea: 657, dfH: -601.6, madelung: 1.74756, nu: 2, r0: 210.6, n: 7, rp: 72, rm: 140, type: ['NaCl 型', 'rock salt'], circular: true },
    CaF2: { z: [2, 1], sub: 177.8, ie: 1735.2, atom: 158.8, ea: -656.4, dfH: -1228.0, madelung: 2.51939, nu: 3, r0: 236.6, n: 8, rp: 100, rm: 133, type: ['萤石型', 'fluorite'] },
  };
  D.bornhaber = {
    kind: 'data',
    title: ['Born–Haber 循环：把看不见的晶格能拼出来', 'The Born–Haber cycle: assembling a lattice energy no one can measure'],
    intro: ['选一种盐，看循环的每一步，再和两个静电模型比较。改一改 Born 指数，看排斥项有多重要。', 'Pick a salt, follow each step of the cycle, then compare with two electrostatic models. Change the Born exponent to see how much the repulsion matters.'],
    sel: [['salt', ['化合物', 'Compound'], Object.keys(SALTS).map((k) => [k, k.replace('2', '₂')]), 'NaCl']],
    ctl: [['nb', ['Born 指数 n 的修正', 'Adjust the Born exponent n'], -3, 3, 0.5, 0, (v) => (v === 0 ? L('用推荐值', 'recommended') : `${v > 0 ? '+' : ''}${v}`)]],
    figs: [['html', ['', '']], [0.45, ['三种方法得到的晶格能（kJ/mol）。', 'The lattice energy from three methods (kJ/mol).']]],
    note: ['热化学数据是常见教科书（298 K）的数值，由编者录入，没有联网逐条核对；不同教材之间相差几 kJ/mol。MgO 用到 O 的第二电子获得焓，而这个数本身就是从 Born–Haber 循环反推出来的，所以 MgO 的“循环值”和静电模型不是独立的比较。Born–Landé 的 Born 指数按离子的稀有气体电子构型取平均（He 5、Ne 7、Ar 9、Kr 10、Xe 12）。Kapustinskii 用 Shannon 六配位半径 [@shannon1976]。', 'Thermochemical data are common textbook values (298 K) typed in by the editor and not rechecked online; textbooks differ by a few kJ/mol. MgO uses the second electron-gain enthalpy of O, itself back-calculated from Born–Haber cycles, so for MgO the “cycle value” and the electrostatic models are not an independent comparison. The Born exponent averages the noble-gas configurations of the ions (He 5, Ne 7, Ar 9, Kr 10, Xe 12). Kapustinskii uses Shannon six-coordinate radii [@shannon1976].'],
    draw(s, f, c) {
      const d = SALTS[s.salt], U = M.bornHaberU(d), n = Math.max(4, d.n + s.nb), BL = M.bornLande(d.madelung, d.z[0], d.z[1], d.r0, n), KP = M.kapustinskii(d.nu, d.z[0], d.z[1], d.rp, d.rm);
      const name = s.salt.replace('2', '₂'), metal = name.match(/^[A-Z][a-z]?/)[0];
      f[0].innerHTML = flow(box(L(`${metal}(s) 升华`, `${metal}(s) sublimes`), `+${fix(d.sub, 1)}`), box(L('电离', 'Ionise'), `+${fix(d.ie, 1)}`), box(L('非金属原子化', 'Atomise non-metal'), `+${fix(d.atom, 1)}`), box(L('获得电子', 'Gain electrons'), `${d.ea > 0 ? '+' : ''}${fix(d.ea, 1)}`), box(L('气态离子 → 晶体', 'Gaseous ions → crystal'), `−U = −${fix(U, 0)}`, 'is-gold'))
        + `<p class="muted" style="margin:0;font-size:13px">${L(`五步加起来等于生成焓 Δ_f H°(${name}) = ${fix(d.dfH, 1)} kJ/mol，所以 U = ${fix(d.sub, 1)} + ${fix(d.ie, 1)} + ${fix(d.atom, 1)} + (${fix(d.ea, 1)}) − (${fix(d.dfH, 1)}) = ${fix(U, 1)} kJ/mol。`, `The five steps add up to the enthalpy of formation Δ_f H°(${name}) = ${fix(d.dfH, 1)} kJ/mol, so U = ${fix(d.sub, 1)} + ${fix(d.ie, 1)} + ${fix(d.atom, 1)} + (${fix(d.ea, 1)}) − (${fix(d.dfH, 1)}) = ${fix(U, 1)} kJ/mol.`)}${d.circular ? L(' 注意：O²⁻ 的电子获得焓本身来自这类循环。', ' Note: the electron gain to O²⁻ itself comes from such cycles.') : ''}</p>`;
      const top = Math.max(U, BL, KP) * 1.15;
      plot(f[1], { x: [0, 4], y: [0, top], xt: [1, 2, 3], xf: (t) => [L('Born–Haber', 'Born–Haber'), 'Born–Landé', 'Kapustinskii'][t - 1], yl: 'U / kJ mol⁻¹', series: [{ xs: [1], ys: [U], color: c.gold, bars: 0.6 }, { xs: [2], ys: [BL], color: c.accent, bars: 0.6 }, { xs: [3], ys: [KP], color: c.info, bars: 0.6 }], texts: [{ x: 1, y: U, s: fix(U, 0), align: 'center', dy: -6 }, { x: 2, y: BL, s: fix(BL, 0), align: 'center', dy: -6 }, { x: 3, y: KP, s: fix(KP, 0), align: 'center', dy: -6 }] });
      return [[['结构类型', 'Structure type'], L(d.type[0], d.type[1])], [['Born–Haber 晶格能', 'Born–Haber lattice energy'], `${fix(U, 0)} kJ/mol`, 1], [[`Born–Landé（𝓜 = ${d.madelung}，n = ${n}）`, `Born–Landé (𝓜 = ${d.madelung}, n = ${n})`], `${fix(BL, 0)} kJ/mol`], [['与循环值之差', 'Difference from the cycle'], `${fix((100 * (BL - U)) / U, 1)} %`], [['Kapustinskii', 'Kapustinskii'], `${fix(KP, 0)} kJ/mol`], [['r₊/r₋', 'r₊/r₋'], fix(d.rp / d.rm, 3)]];
    },
  };

  // ── Frost 图 ────────────────────────────────────────────────────────────
  // 酸性溶液（pH 0）的标准电势（V），[高氧化态, 低氧化态, E°]；物种名按氧化态
  const FROST = {
    Mn: { c: [[7, 6, 0.56], [6, 4, 2.26], [4, 3, 0.95], [3, 2, 1.51], [2, 0, -1.18]], sp: { 7: 'MnO₄⁻', 6: 'MnO₄²⁻', 4: 'MnO₂', 3: 'Mn³⁺', 2: 'Mn²⁺', 0: 'Mn' } },
    Cl: { c: [[7, 5, 1.189], [5, 3, 1.214], [3, 1, 1.645], [1, 0, 1.611], [0, -1, 1.358]], sp: { 7: 'ClO₄⁻', 5: 'ClO₃⁻', 3: 'HClO₂', 1: 'HClO', 0: 'Cl₂', '-1': 'Cl⁻' } },
    N: { c: [[5, 4, 0.803], [4, 3, 1.07], [3, 2, 0.996], [2, 1, 1.59], [1, 0, 1.77], [0, -1, -1.87], [-1, -2, 1.41], [-2, -3, 1.275]], sp: { 5: 'NO₃⁻', 4: 'N₂O₄', 3: 'HNO₂', 2: 'NO', 1: 'N₂O', 0: 'N₂', '-1': 'NH₃OH⁺', '-2': 'N₂H₅⁺', '-3': 'NH₄⁺' } },
    O: { c: [[0, -1, 0.695], [-1, -2, 1.763]], sp: { 0: 'O₂', '-1': 'H₂O₂', '-2': 'H₂O' } },
    Cu: { c: [[2, 1, 0.153], [1, 0, 0.521]], sp: { 2: 'Cu²⁺', 1: 'Cu⁺', 0: 'Cu' } },
    Fe: { c: [[3, 2, 0.771], [2, 0, -0.447]], sp: { 3: 'Fe³⁺', 2: 'Fe²⁺', 0: 'Fe' } },
  };
  D.frost = {
    kind: 'data',
    title: ['Frost 图：哪个氧化态最稳定，哪个会歧化', 'Frost diagrams: which oxidation state is most stable, which disproportionates'],
    intro: ['选一种元素。点越低越稳定；凸起的点（红色）会歧化；两点连线越陡，高价的那个越是强氧化剂。', 'Pick an element. Lower points are more stable; bulging points (red) disproportionate; the steeper the line between two points, the stronger the oxidant at the top.'],
    sel: [['el', ['元素（酸性溶液，pH 0）', 'Element (acid solution, pH 0)'], [['Mn', ['锰', 'Manganese']], ['Cl', ['氯', 'Chlorine']], ['N', ['氮', 'Nitrogen']], ['O', ['氧', 'Oxygen']], ['Cu', ['铜', 'Copper']], ['Fe', ['铁', 'Iron']]], 'Mn']],
    figs: [[0.62, ['nE°（相对单质，V）对氧化态。金色虚线是 O₂/H₂O（1.23 V）的斜率参照：比它陡的电对能氧化水。', 'nE° (relative to the element, V) against oxidation state. The gold dashed line has the slope of O₂/H₂O (1.23 V): couples steeper than it can oxidise water.']], ['html', ['', '']]],
    note: ['标准电势取自常用的 Latimer 图（Bard、Parsons 和 Jordan 编的标准电势表一系），25 °C、酸性溶液，由编者录入，没有联网逐条核对。Frost 图只说热力学：Mn 的图说明 MnO₄⁻ 应该能氧化水，但这个反应很慢。碱性溶液里的电势不同，图的形状也会变（例如 MnO₂ 在碱中更稳定）。', 'Standard potentials come from common Latimer diagrams (the tables edited by Bard, Parsons and Jordan and their descendants), 25 °C, acid solution, typed in by the editor and not rechecked online. A Frost diagram says only what is thermodynamically possible: the manganese diagram says MnO₄⁻ should oxidise water, but the reaction is slow. Potentials in base differ and change the shape (MnO₂, for example, is more stable in base).'],
    draw(s, f, c) {
      const d = FROST[s.el], pts = M.frost(d.c), xs = pts.map((p) => p[0]), ys = pts.map((p) => p[1]);
      const lo = Math.min(...ys), hi = Math.max(...ys), pad = Math.max(0.6, (hi - lo) * 0.12);
      const dis = pts.map((_, i) => M.disproportionates(pts, i)), minI = ys.indexOf(lo);
      const x0 = Math.min(...xs) - 0.6, x1 = Math.max(...xs) + 0.6;
      plot(f[0], {
        x: [x0, x1], y: [lo - pad, hi + pad], xl: L('氧化态', 'oxidation state'), yl: 'nE° / V',
        xt: Array.from({ length: Math.round(x1 - x0) + 1 }, (_, i) => Math.ceil(x0) + i).filter((t) => t >= Math.min(...xs) && t <= Math.max(...xs)),
        series: [{ xs, ys, color: c.accent, width: 2 }, { xs: xs.filter((_, i) => !dis[i]), ys: ys.filter((_, i) => !dis[i]), color: c.accent, dots: 5 }, { xs: xs.filter((_, i) => dis[i]), ys: ys.filter((_, i) => dis[i]), color: c.danger, dots: 6 }, { xs: [x0, x1], ys: [ys[0] + 1.229 * (x0 - xs[0]), ys[0] + 1.229 * (x1 - xs[0])], color: c.gold, dash: [5, 4], width: 1.2 }],
        texts: pts.map(([x, y], i) => ({ x, y, s: d.sp[x], dx: i === pts.length - 1 ? -7 : 7, align: i === pts.length - 1 ? 'right' : 'left', dy: i === minI ? 16 : -8, color: dis[i] ? c.danger : c.ink })),
      });
      const rows = d.c.map(([a, b, E]) => [`${d.sp[a]} / ${d.sp[b]}`, `${a} → ${b}`, `${E > 0 ? '+' : ''}${E.toFixed(3)} V`, E > 1.229 ? L('能氧化水', 'can oxidise water') : E < 0 ? L('能还原 H⁺', 'can reduce H⁺') : '—']);
      f[1].innerHTML = table([L('电对', 'Couple'), L('氧化态', 'States'), 'E°', L('和水比', 'Versus water')], rows);
      return [[['最稳定的物种', 'Most stable species'], d.sp[xs[minI]], 1], [['会歧化的物种', 'Species that disproportionate'], dis.some(Boolean) ? xs.filter((_, i) => dis[i]).map((x) => d.sp[x]).join('、') : L('没有', 'none')], xs[xs.length - 1] > 0 ? [[`${d.sp[xs[xs.length - 1]]} → ${d.sp[0]}`, `${d.sp[xs[xs.length - 1]]} → ${d.sp[0]}`], `E° = ${fix(ys[ys.length - 1] / xs[xs.length - 1], 2)} V`] : [[`${d.sp[0]} → ${d.sp[xs[0]]}`, `${d.sp[0]} → ${d.sp[xs[0]]}`], `E° = ${fix(ys[0] / xs[0], 2)} V`]];
    },
  };
});
