'use strict';
// 谱图馆 · 交互演示（上）：质谱、振动与电子光谱、磁共振。每个演示是一个“视图”（控件 + draw），数学全部在 sp-models.js。
// 其余的（色谱、X 射线、原子光谱、热分析、电化学和其他方法）在 sp-gens2.js。
(() => {
  const K = window.MOLASTRIA_SPECTRA_KIT, M = window.MOLASTRIA_SPECTRA_MODELS, D = window.MOLASTRIA_SPECTRA, ATLAS = window.MOLASTRIA_SPECTRA_ATLAS, TABLES = window.MOLASTRIA_SPECTRA_TABLES;
  const MEAS = window.MOLASTRIA_SPECTRA_MEASURED || { ms: {} };
  if (!K || !M || !D) return;
  const { L, tx, esc, num, fix, chem, ctl } = K;
  const G = (window.MOLASTRIA_SPECTRA_GENS = {});
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const logs = (a, b, n) => lin(Math.log10(a), Math.log10(b), n).map((v) => 10 ** v);
  const gauss = (x, x0, fwhm) => Math.exp((-4 * Math.LN2 * (x - x0) ** 2) / (fwhm * fwhm));
  const sub = (n) => String(n).replace(/\d/g, (d) => '₀₁₂₃₄₅₆₇₈₉'[d]);
  Object.assign(K, { lin, logs, gauss, sub });

  // ── 质谱 ──────────────────────────────────────────────────────────────
  G.isotope = (a) => {
    const defs = [];
    if (a.free) { defs.push(ctl.text('f', L('分子式（可带电荷）', 'Formula (charge allowed)'), a.formulas[0], 'C8H11N4O2+')); defs.push({ ...ctl.select('ex', L('例子', 'Examples'), a.formulas.map((x) => [x, chem(x)])), apply: (v) => ({ f: v }) }); defs.push(ctl.log('R', L('分辨本领 m/Δm', 'Resolving power m/Δm'), 500, 500000, 10000, (v) => num(Math.round(v / 100) * 100, 0))); }
    else if (!a.lock && a.formulas.length > 1) defs.push(ctl.select('f', L('分子式', 'Formula'), a.formulas.map((x) => [x, chem(x)])));
    return {
      ctl: defs,
      draw: (s) => {
        const { formula, charge } = M.ion(s.f || a.formulas[0]), comp = M.parseFormula(formula), atoms = Object.values(comp).reduce((x, y) => x + y, 0);
        const mono = M.monoMass(formula, charge), fw = a.free ? mono / s.R : 0, fine = a.free && atoms <= 200 && fw < 0.2;
        const pat = M.isotopePattern(formula, { charge, resolution: fine ? Math.max(2e-4, fw / 4) : 0.2, min: 1e-5 }), vis = pat.filter((p) => p.rel >= 0.05);
        const x0 = Math.floor(vis[0].mz - 1), x1 = Math.ceil(vis[vis.length - 1].mz + 1), top = pat.reduce((x, y) => (y.rel > x.rel ? y : x));
        const sticks = vis.map((p) => ({ x: p.mz, y: p.rel, c: 0, tip: `m/z ${p.mz.toFixed(4)} · ${fix(p.rel, 2)} %`, label: !a.free && p.rel >= 4 ? `${p.mz.toFixed(vis.length > 12 ? 0 : 2)}` : '' }));
        const plots = [{ x: [x0, x1], y: [0, 125], sticks, xl: 'm/z', yl: L('相对丰度（%）', 'relative abundance (%)'), h: 280, curfmt: (v) => `m/z ${v.toFixed(3)}` }];
        if (a.free) {
          const xs = lin(x0, x1, 1600), ys = xs.map((x) => { let y = 0; for (const p of vis) if (Math.abs(x - p.mz) < 3 * fw) y += p.rel * gauss(x, p.mz, fw); return y; });
          plots[0].series = [{ xs, ys, c: 1, label: L(`分辨本领 ${num(Math.round(s.R / 100) * 100, 0)} 时的峰形（半高宽 ${fix(fw, 4)}）`, `profile at a resolving power of ${num(Math.round(s.R / 100) * 100, 0)} (FWHM ${fix(fw, 4)})`) }];
          for (const st of sticks) st.w = 0.8;
        }
        const out = [[charge ? L('离子', 'Ion') : L('分子', 'Molecule'), `${chem(formula)}${charge ? (Math.abs(charge) > 1 ? ` ${Math.abs(charge)}` : ' ') + (charge > 0 ? '+' : '−') : ''}`],
          [charge ? L('单同位素 m/z', 'Monoisotopic m/z') : L('单同位素质量', 'Monoisotopic mass'), mono.toFixed(4)], [L('平均摩尔质量', 'Average molar mass'), `${M.avgMass(formula).toFixed(3)} g/mol`],
          [L('最高峰', 'Tallest peak'), `m/z ${top.mz.toFixed(4)}${Math.abs(top.mz - mono) > 0.3 ? L('（不是单同位素峰）', ' (not the monoisotopic peak)') : ''}`]];
        const unit = M.isotopePattern(formula, { charge, resolution: 0.2, min: 1e-4 }).filter((p) => p.rel >= 0.1).slice(0, 8);
        out.push([L('各峰（标称质量）', 'Peaks (nominal masses)'), unit.map((p) => `${Math.round(p.mz * (Math.abs(charge) || 1)) / (Math.abs(charge) || 1)}: ${fix(p.rel, 1)}`).join(' · ')]);
        if (a.free && !fine && fw < 0.2) out.push([L('说明', 'Note'), L('原子数超过 200 时不展开精细结构，只按标称质量合并。', 'With more than 200 atoms the fine structure is not expanded; peaks are merged by nominal mass.')]);
        return { plots, out };
      },
    };
  };

  G.resolve = () => {
    const ions = [['CO', 'CO⁺'], ['N2', 'N₂⁺'], ['C2H4', 'C₂H₄⁺•']].map(([f, n]) => ({ n, mz: M.monoMass(f, 1) }));
    return {
      ctl: [ctl.log('R', L('分辨本领 m/Δm', 'Resolving power m/Δm'), 200, 30000, 500, (v) => num(Math.round(v / 10) * 10, 0))],
      draw: (s) => {
        const fw = 28 / s.R, xs = lin(27.96, 28.07, 900);
        return { plots: [{ x: [27.96, 28.07], y: [0, 1.6], noy: true, series: [{ xs, ys: xs.map((x) => ions.reduce((y, i) => y + gauss(x, i.mz, fw), 0)), c: 0 }], sticks: ions.map((i) => ({ x: i.mz, y: 1.02, c: 1, dash: true, w: 1, label: `${i.n} ${i.mz.toFixed(4)}`, tip: `${i.n} m/z ${i.mz.toFixed(5)}` })), xl: 'm/z', yl: L('强度（三种离子等量）', 'intensity (equal amounts of the three ions)'), h: 260, curfmt: (v) => `m/z ${v.toFixed(4)}` }],
          out: [[L('峰的半高宽', 'Peak width (FWHM)'), `${fix(fw, 4)} (m/z 28 ÷ ${num(Math.round(s.R / 10) * 10, 0)})`], [L('分开 CO⁺ 和 N₂⁺ 需要', 'To separate CO⁺ from N₂⁺'), `m/Δm ≈ ${Math.round(M.resolvingPower(ions[0].mz, ions[1].mz))}`], [L('分开 N₂⁺ 和 C₂H₄⁺• 需要', 'To separate N₂⁺ from C₂H₄⁺•'), `m/Δm ≈ ${Math.round(M.resolvingPower(ions[1].mz, ions[2].mz))}`]] };
      },
    };
  };

  G.envelope = (a) => ({
    ctl: [{ ...ctl.seg('cond', L('溶液条件', 'Solution conditions'), [['den', L('变性（酸性含有机溶剂）', 'Denaturing (acidic, organic solvent)')], ['nat', L('非变性（醋酸铵水溶液）', 'Native (aqueous ammonium acetate)')]]), apply: () => ({ picks: [] }) }],
    pick: (st, s, api) => api.set({ picks: [...(s.picks || []), st.data].slice(-2) }),
    draw: (s) => {
      const [zc, w, z0, z1] = s.cond === 'nat' ? [8, 0.75, 6, 10] : [18, 3.4, 9, 28], picks = s.picks || [], sticks = [];
      for (let z = z0; z <= z1; z++) { const h = 100 * Math.exp(-((z - zc) ** 2) / (2 * w * w)), mz = M.chargeState(a.mass, z); if (h > 0.5) sticks.push({ x: mz, y: h, c: picks.includes(z) ? 3 : 0, label: `${z}+`, data: z, tip: `m/z ${mz.toFixed(2)} · ${z}+` }); }
      const out = [[L('蛋白质', 'Protein'), tx(a.name)]];
      if (picks.length === 2 && Math.abs(picks[0] - picks[1]) === 1) {
        const [zh, zl] = [Math.max(...picks), Math.min(...picks)], m1 = M.chargeState(a.mass, zh), m2 = M.chargeState(a.mass, zl), r = M.deconvolute(m1, m2);
        out.push([L('选中的两个峰', 'The two peaks chosen'), `m/z ${m1.toFixed(2)}, ${m2.toFixed(2)}`], [L('反算', 'Worked back'), `z = (m₁ − 1.00728) / (m₂ − m₁) = ${r.z} → M = ${r.z} × (${m2.toFixed(2)} − 1.00728) = ${r.M.toFixed(1)} Da`]);
      } else out.push([L('试一试', 'Try it'), L('点两个相邻的峰，由它们的 m/z 反算电荷数和分子质量。', 'Click two neighbouring peaks to work back the charge and the molecular mass from their m/z values.')]);
      return { plots: [{ x: [500, s.cond === 'nat' ? 3200 : 2100], y: [0, 125], sticks, xl: 'm/z', yl: L('相对强度（示意）', 'relative intensity (schematic)'), h: 280 }], out };
    },
  });

  G.adducts = (a) => ({
    draw: () => {
      const m = M.monoMass(a.formula), list = Object.entries(M.ADDUCTS).map(([k, fn]) => ({ k, mz: fn(m), neg: /-$/.test(k) }));
      return { plots: [{ x: [Math.floor(Math.min(...list.map((l) => l.mz)) - 20), Math.ceil(Math.max(...list.map((l) => l.mz)) + 25)], y: [0, 1.9], noy: true, sticks: list.map((l) => ({ x: l.mz, y: 1, c: l.neg ? 3 : 0, label: l.k.replace('2+', '²⁺').replace(/\+$/, '⁺').replace(/-$/, '⁻'), tip: `${l.k} m/z ${l.mz.toFixed(4)}` })), xl: 'm/z', legend: [{ c: 0, t: L('正离子模式', 'positive mode') }, { c: 3, t: L('负离子模式', 'negative mode') }], h: 240 }],
        out: [[L('中性分子', 'Neutral molecule'), `${chem(a.formula)} · M = ${m.toFixed(4)}`], ...list.map((l) => [l.k, `m/z ${l.mz.toFixed(4)}`])] };
    },
  });

  G.polymer = (a) => ({
    ctl: [ctl.range('mn', L('数均分子量 M_n', 'Number-average molar mass M_n'), 800, 5000, 50, a.mn, (v) => `${v}`), ctl.range('pdi', L('分散度 Đ', 'Dispersity Đ'), 1.01, 1.3, 0.01, a.pdi, (v) => fix(v, 2))],
    draw: (s) => {
      const rep = M.monoMass(a.repeat), end = M.monoMass(a.end), cat = M.monoMass(a.cation, 1), sz = M.schulzZimm(s.mn, s.pdi), sticks = [];
      for (let n = 3; n * rep < s.mn * 4; n++) { const mass = n * M.avgMass(a.repeat) + M.avgMass(a.end); sticks.push({ x: n * rep + end + cat, y: sz.w(mass) / mass, n }); }
      const top = Math.max(...sticks.map((t) => t.y)), vis = sticks.filter((t) => t.y > top * 0.004).map((t) => ({ ...t, y: (100 * t.y) / top, c: 0, tip: `n = ${t.n} · m/z ${t.x.toFixed(3)}` })), best = vis.reduce((x, y) => (y.y > x.y ? y : x));
      best.label = `n = ${best.n}, m/z ${best.x.toFixed(2)}`;
      return { plots: [{ x: [Math.floor(vis[0].x / 100) * 100 - 100, Math.ceil(vis[vis.length - 1].x / 100) * 100 + 100], y: [0, 125], sticks: vis, xl: 'm/z', yl: L('相对强度（模型）', 'relative intensity (model)'), h: 280 }],
        out: [[L('重复单元', 'Repeat unit'), `${chem(a.repeat)} · ${rep.toFixed(4)}`], [L('离子', 'Ions'), `[H–(${chem(a.repeat)})ₙ–OH + ${a.cation}]⁺`], ['M_n / M_w', `${Math.round(sz.Mn)} / ${Math.round(sz.Mw)}`], [L('能看到的聚合度', 'Degrees of polymerisation visible'), `n = ${vis[0].n}–${vis[vis.length - 1].n}`]] };
    },
  });

  G.tof = () => ({
    ctl: [ctl.range('U', L('加速电压', 'Accelerating voltage'), 5, 30, 1, 20, (v) => `${v} kV`), ctl.range('Lm', L('飞行距离', 'Flight path'), 0.5, 3, 0.1, 1, (v) => `${fix(v, 1)} m`)],
    draw: (s) => {
      const t = (mz) => M.tofTime(mz, s.U * 1000, s.Lm) * 1e6, xs = lin(50, 10000, 400);
      return { plots: [{ x: [0, 10000], series: [{ xs, ys: xs.map(t), c: 0 }], pts: [1000, 5000, 10000].map((m) => ({ x: m, y: t(m), c: 1, label: `${fix(t(m), 2)} μs` })), xl: 'm/z', yl: L('飞行时间（μs）', 'flight time (μs)'), h: 260 }],
        out: [[L('m/z 1000 和 1001', 'm/z 1000 and 1001'), L(`相差 ${fix((t(1001) - t(1000)) * 1000, 1)} ns`, `${fix((t(1001) - t(1000)) * 1000, 1)} ns apart`)], [L('m/z 10 000 和 10 001', 'm/z 10 000 and 10 001'), L(`相差 ${fix((t(10001) - t(10000)) * 1000, 2)} ns`, `${fix((t(10001) - t(10000)) * 1000, 2)} ns apart`)], [L('动能', 'Kinetic energy'), L(`每个电荷 ${s.U} keV，和质量无关`, `${s.U} keV per charge, whatever the mass`)]] };
    },
  });

  G.breakdown = (a) => ({
    draw: () => {
      const recs = a.ids.map((id) => MEAS.ms[id]).filter(Boolean), series = [], pts = [];
      a.ions.forEach(([mz, label], i) => {
        const ys = recs.map((r) => { const tot = r.peaks.reduce((x, p) => x + p[1], 0); return (100 * r.peaks.filter((p) => Math.abs(p[0] - mz) < 0.01).reduce((x, p) => x + p[1], 0)) / tot; }), xs = recs.map((r) => +r.ce);
        series.push({ xs, ys, c: i % 6, label: `m/z ${label}` }); xs.forEach((x, k) => pts.push({ x, y: ys[k], c: i % 6 }));
      });
      return { plots: [{ x: [10, 95], y: [0, 105], series, pts, xl: L('碰撞能量（仪器的归一化单位）', 'collision energy (normalised instrument units)'), yl: L('占总离子流的比例（%）', 'share of total ion current (%)'), h: 300 }] };
    },
  });

  G.bars = (a) => ({ draw: () => ({ plots: [{ html: K.barChart(a) }] }) });
  G.analyzers = () => ({ draw: () => ({ plots: [{ html: K.barChart({ log: true, xl: L('分辨本领 m/Δm（半高宽定义，对数刻度）', 'resolving power m/Δm (FWHM definition, log scale)'), rows: ATLAS.ANALYZERS.map((z) => [z.name, z.R[0], z.R[1]]) }) }] }) });
  G.crossSections = () => ({ draw: () => ({ plots: [{ html: K.barChart({ log: true, xl: L('每个分子的截面（cm²，对数刻度）', 'cross-section per molecule (cm², log scale)'), rows: [
    [L('紫外–可见吸收（强发色团）', 'UV–visible absorption (strong chromophore)'), 1e-17, 1e-15], [L('荧光（吸收 × 量子产率）', 'Fluorescence (absorption × quantum yield)'), 1e-18, 1e-16], [L('表面增强拉曼（热点里）', 'Surface-enhanced Raman (in hot spots)'), 1e-21, 1e-16],
    [L('红外吸收', 'Infrared absorption'), 1e-21, 1e-18], [L('共振拉曼', 'Resonance Raman'), 1e-26, 1e-23], [L('Rayleigh 散射', 'Rayleigh scattering'), 1e-27, 1e-25], [L('普通拉曼', 'Ordinary Raman'), 1e-31, 1e-28]] }) }] }) });

  G.peptide = (a) => ({
    ctl: [ctl.text('seq', L('肽段序列（单字母）', 'Peptide sequence (one-letter)'), a.seq, a.seq)],
    draw: (s) => {
      const p = M.peptide(s.seq || a.seq), sticks = [...p.b.map((i) => ({ x: i.mz, y: 55, c: 0, label: `b${sub(i.n)}`, tip: `b${i.n} ${i.seq} m/z ${i.mz.toFixed(4)}` })), ...p.y.map((i) => ({ x: i.mz, y: 90, c: 1, label: `y${sub(i.n)}`, tip: `y${i.n} ${i.seq} m/z ${i.mz.toFixed(4)}` }))];
      const row = (name, list) => `<tr><th>${name}</th>${list.map((i) => `<td>${i.mz.toFixed(3)}</td>`).join('')}</tr>`;
      return { plots: [{ x: [0, Math.ceil((p.mh + 40) / 100) * 100], y: [0, 125], noy: true, sticks, xl: 'm/z', yl: L('强度（示意）', 'intensity (schematic)'), legend: [{ c: 0, t: L('b 离子（含 N 端）', 'b ions (N-terminal)') }, { c: 1, t: L('y 离子（含 C 端）', 'y ions (C-terminal)') }], h: 290 }],
        out: [[L('肽段', 'Peptide'), `${p.seq} · M = ${p.M.toFixed(4)}`], ['[M+H]⁺', p.mh.toFixed(4)], ['[M+2H]²⁺', p.mh2.toFixed(4)]],
        html: `<div class="sp-scroll"><table class="sp-table sp-mini"><tr><th>n</th>${p.b.map((i) => `<td>${i.n}</td>`).join('')}</tr>${row('b', p.b)}${row('y', p.y)}</table></div>` };
    },
  });

  G.elements = (a) => ({
    ctl: [ctl.seg('el', L('元素', 'Element'), a.els.map((e) => [e, e]))],
    draw: (s) => {
      const iso = TABLES.isotopes[s.el].i.filter((i) => i[2] > 0), sticks = iso.map(([A, m, ab]) => ({ x: A, y: 100 * ab, c: 0, label: `${fix(100 * ab, ab < 0.1 ? 2 : 1)}`, tip: `${A}${s.el} · ${m.toFixed(4)} u · ${fix(100 * ab, 3)} %` }));
      return { plots: [{ x: [iso[0][0] - 1.5, iso[iso.length - 1][0] + 1.5], sticks, xticks: iso.map((i) => i[0]), xl: L('质量数', 'mass number'), yl: L('天然丰度（%）', 'natural abundance (%)'), h: 260 }], out: [[L('稳定同位素', 'Stable isotopes'), `${iso.length}`], [L('标准原子量', 'Standard atomic weight'), `${TABLES.isotopes[s.el].m}`]] };
    },
  });

  G.decay14c = () => ({
    ctl: [ctl.range('t', L('样品的年龄', 'Age of the sample'), 0, 50000, 100, 5730, (v) => L(`${v} 年`, `${v} years`))],
    draw: (s) => { const f = (t) => 0.5 ** (t / 5730), xs = lin(0, 50000, 300); return { plots: [{ x: [0, 50000], y: [0, 105], series: [{ xs, ys: xs.map((t) => 100 * f(t)), c: 0 }], pts: [{ x: s.t, y: 100 * f(s.t), c: 1, r: 4.5 }], vlines: [5730, 11460, 17190].map((x, i) => ({ x, label: `${i + 1} t½`, c: 5 })), xl: L('年龄（年）', 'age (years)'), yl: L('剩下的 ¹⁴C（%）', '¹⁴C remaining (%)'), h: 260 }], out: [[L('剩下的 ¹⁴C', '¹⁴C remaining'), `${num(100 * f(s.t), 3)} %`], [L('经过的半衰期数', 'Half-lives elapsed'), fix(s.t / 5730, 2)]] }; },
  });

  G.depth = () => ({
    ctl: [ctl.range('rp', L('投影射程 R_p', 'Projected range R_p'), 40, 250, 5, 100, (v) => `${v} nm`), ctl.range('dr', L('射程的标准差 ΔR_p', 'Range straggle ΔR_p'), 10, 80, 1, 35, (v) => `${v} nm`)],
    draw: (s) => { const xs = lin(0, 450, 400); return { plots: [{ x: [0, 450], y: [3e14, 4e19], logy: true, series: [{ xs, ys: xs.map((x) => 1e15 + 1e19 * Math.exp(-((x - s.rp) ** 2) / (2 * s.dr * s.dr))), c: 0 }], hlines: [{ y: 1e15, c: 5 }], xl: L('深度（nm）', 'depth (nm)'), yl: L('硼浓度（cm⁻³）', 'boron concentration (cm⁻³)'), h: 270 }], out: [[L('注入剂量（峰下面积）', 'Implanted dose (area under the peak)'), `${num(1e19 * s.dr * 1e-7 * Math.sqrt(2 * Math.PI), 2)} cm⁻²`], [L('动态范围', 'Dynamic range'), L('四个数量级', 'four orders of magnitude')]] }; },
  });

  // ── 振动与转动 ────────────────────────────────────────────────────────
  const DIA = { H35Cl: 'H³⁵Cl', H37Cl: 'H³⁷Cl', D35Cl: 'D³⁵Cl', '12C16O': '¹²C¹⁶O', '13C16O': '¹³C¹⁶O' };
  G.rovib = (a) => ({
    ctl: [...(a.all ? [ctl.select('mol', L('分子', 'Molecule'), [['HCl', L('HCl（³⁵Cl 和 ³⁷Cl 按天然丰度）', 'HCl (³⁵Cl and ³⁷Cl at natural abundance)')], ...Object.keys(M.DIATOMICS).map((k) => [k, DIA[k] || k])], a.mol === 'H35Cl' ? 'HCl' : a.mol)] : []), ctl.range('T', L('温度', 'Temperature'), 50, 1500, 10, a.T || 296, (v) => `${v} K`)],
    draw: (s) => {
      const mol = s.mol || a.mol, parts = mol === 'HCl' ? [['H35Cl', 0.7576, 0], ['H37Cl', 0.2424, 1]] : [[mol, 1, 0]], sticks = [], out = [];
      for (const [k, w, c] of parts) {
        const lines = M.rovibBand(M.DIATOMICS[k], s.T).filter((l) => l.rel > 0.004), best = { P: null, R: null };
        for (const l of lines) { const st = { x: l.nu, y: l.rel * w, c, tip: `${DIA[k]} ${l.branch}(${l.J}) ${l.nu.toFixed(2)} cm⁻¹`, br: l.branch, J: l.J }; sticks.push(st); if (!best[l.branch] || st.y > best[l.branch].y) best[l.branch] = st; }
        if (c === 0) for (const b of ['P', 'R']) if (best[b]) best[b].label = `${b}(${best[b].J})`;
        const cst = M.DIATOMICS[k];
        out.push([DIA[k], `ν₀ = ${M.bandOrigin(cst).toFixed(2)} cm⁻¹ · B_e = ${fix(cst.Be, 4)} cm⁻¹ · r_e = ${fix(M.bondLength(cst), 4)} Å · ${L('最强的线', 'strongest lines')} P(${best.P?.J}), R(${best.R?.J})`]);
      }
      const lo = Math.min(...sticks.map((t) => t.x)), hi = Math.max(...sticks.map((t) => t.x)), pad = (hi - lo) * 0.04;
      return { plots: [{ x: [lo - pad, hi + pad], y: [0, 1.2], noy: true, rev: true, sticks, xl: L('波数（cm⁻¹）', 'wavenumber (cm⁻¹)'), yl: L('相对强度', 'relative intensity'), legend: parts.length > 1 ? parts.map(([k, , c]) => ({ c, t: DIA[k] })) : [], h: 300, curfmt: (v) => `${v.toFixed(1)} cm⁻¹` }], out };
    },
  });

  G.overtones = () => ({
    draw: () => {
      const c = M.DIATOMICS.H35Cl, nu = [1, 2, 3].map((v) => M.bandOrigin(c, v)), name = [L('基频 0→1', 'fundamental 0→1'), L('一级泛频 0→2', 'first overtone 0→2'), L('二级泛频 0→3', 'second overtone 0→3')];
      return { plots: [{ x: [2000, 9400], y: [1e-4, 12], logy: true, noy: true, sticks: nu.map((x, i) => ({ x, y: 40 ** -i, c: 0, w: 2.4, label: x.toFixed(1), tip: `${tx(name[i])} ${x.toFixed(2)} cm⁻¹` })), vlines: [2, 3].map((k) => ({ x: k * nu[0], label: `${k} × ${nu[0].toFixed(0)}`, c: 5 })), xl: L('波数（cm⁻¹）', 'wavenumber (cm⁻¹)'), yl: L('强度（示意，对数）', 'intensity (schematic, log)'), h: 250 }],
        out: nu.map((x, i) => [name[i], `${x.toFixed(2)} cm⁻¹${i ? L(`，比 ${i + 1} × 基频低 ${((i + 1) * nu[0] - x).toFixed(1)} cm⁻¹`, `, ${((i + 1) * nu[0] - x).toFixed(1)} cm⁻¹ below ${i + 1} × the fundamental`) : ''}`]) };
    },
  });

  G.rotational = (a) => ({
    ctl: [ctl.log('T', L('温度', 'Temperature'), 3, 1000, a.T || 296, (v) => `${num(v < 20 ? +v.toFixed(1) : Math.round(v), 1)} K`)],
    draw: (s) => {
      const ghz = a.unit === 'GHz', lines = M.rotationalLines(M.DIATOMICS[a.mol], s.T, 40).filter((l) => l.rel > 0.004), key = ghz ? 'ghz' : 'cm', top = lines.reduce((x, y) => (y.rel > x.rel ? y : x));
      const sticks = lines.map((l) => ({ x: l[key], y: l.rel, c: 0, label: l.J < 3 || l === top ? `${l.J}→${l.J + 1}` : '', tip: `J = ${l.J} → ${l.J + 1} · ${ghz ? `${l.ghz.toFixed(3)} GHz` : `${l.cm.toFixed(2)} cm⁻¹`}` }));
      return { plots: [{ x: [0, Math.max(...sticks.map((t) => t.x)) * 1.06], y: [0, 1.22], noy: true, sticks, xl: ghz ? L('频率（GHz）', 'frequency (GHz)') : L('波数（cm⁻¹）', 'wavenumber (cm⁻¹)'), yl: L('相对强度', 'relative intensity'), h: 270, curfmt: (v) => (ghz ? `${v.toFixed(1)} GHz` : `${v.toFixed(1)} cm⁻¹`) }],
        out: [[DIA[a.mol] || a.mol, `B₀ = ${fix(M.DIATOMICS[a.mol].Be - M.DIATOMICS[a.mol].ae / 2, 4)} cm⁻¹ · r_e = ${fix(M.bondLength(M.DIATOMICS[a.mol]), 4)} Å`], [L('最强的线', 'Strongest line'), `J = ${top.J} → ${top.J + 1} · ${ghz ? `${top.ghz.toFixed(3)} GHz` : `${top.cm.toFixed(2)} cm⁻¹`}`], ['J = 0 → 1', ghz ? `${lines[0].ghz.toFixed(3)} GHz` : `${lines[0].cm.toFixed(2)} cm⁻¹`]] };
    },
  });

  G.atrDepth = () => ({
    ctl: [ctl.range('th', L('入射角', 'Angle of incidence'), 35, 65, 1, 45, (v) => `${v}°`), ctl.range('n2', L('样品折射率', 'Refractive index of the sample'), 1.3, 1.7, 0.01, 1.5, (v) => fix(v, 2))],
    draw: (s) => {
      const xs = lin(400, 4000, 200), dp = (nu, n1) => { const q = Math.sin((s.th * Math.PI) / 180) ** 2 - (s.n2 / n1) ** 2; return q > 0 ? 1e4 / nu / (2 * Math.PI * n1 * Math.sqrt(q)) : NaN; };
      const cr = [[L('金刚石（n = 2.40）', 'Diamond (n = 2.40)'), 2.40, 0], [L('ZnSe（n = 2.42）', 'ZnSe (n = 2.42)'), 2.42, 1], [L('锗（n = 4.00）', 'Germanium (n = 4.00)'), 4.0, 2]];
      return { plots: [{ x: [400, 4000], rev: true, series: cr.map(([label, n1, c]) => ({ xs, ys: xs.map((x) => dp(x, n1)), c, label, dash: c === 1 })), xl: L('波数（cm⁻¹）', 'wavenumber (cm⁻¹)'), yl: L('穿透深度（μm）', 'penetration depth (μm)'), h: 270 }],
        out: cr.map(([label, n1]) => [label, Number.isFinite(dp(1000, n1)) ? L(`1000 cm⁻¹ 处 ${fix(dp(1000, n1), 2)} μm，3000 cm⁻¹ 处 ${fix(dp(3000, n1), 2)} μm`, `${fix(dp(1000, n1), 2)} μm at 1000 cm⁻¹, ${fix(dp(3000, n1), 2)} μm at 3000 cm⁻¹`) : L('入射角小于临界角，没有全反射', 'below the critical angle: no total internal reflection')]) };
    },
  });

  G.twoD = (a) => ({
    draw: () => ({ plots: [{ x: a.range, y: a.range, xl: a.xl, yl: a.yl, h: 420, extra: (sx, sy) => {
      const out = [`<line class="sp-vl sp-c5" stroke-dasharray="5 4" x1="${sx(a.range[0])}" y1="${sy(a.range[0])}" x2="${sx(a.range[1])}" y2="${sy(a.range[1])}"/>`];
      for (const [w1, w3, amp, wd] of a.peaks) for (const [dy, cls, dash] of [[0, 'sp-c0', ''], [-a.anh, 'sp-c3', 'stroke-dasharray="4 3"']]) for (const k of [1, 0.66, 0.36]) {
        const rx = Math.abs(sx(w1 + wd * k * 0.55) - sx(w1)), ry = Math.abs(sy(w3 + wd * k * 0.34) - sy(w3)), diag = w1 === w3;
        out.push(`<ellipse class="sp-line ${cls}" ${dash} opacity="${0.35 + 0.65 * amp}" cx="${sx(w1).toFixed(1)}" cy="${sy(w3 + dy).toFixed(1)}" rx="${(diag ? rx * 1.25 : rx).toFixed(1)}" ry="${(diag ? ry * 0.8 : ry).toFixed(1)}" ${diag ? `transform="rotate(-38 ${sx(w1).toFixed(1)} ${sy(w3 + dy).toFixed(1)})"` : ''}/>`);
      }
      return out.join('');
    }, legend: [{ c: 0, t: L('漂白与受激发射（0→1）', 'bleach and stimulated emission (0→1)') }, { c: 3, dash: true, t: L('激发态吸收（1→2）', 'excited-state absorption (1→2)') }] }] }),
  });

  // ── 电子光谱 ──────────────────────────────────────────────────────────
  G.beer = () => ({
    ctl: [ctl.range('st', L('杂散光', 'Stray light'), 0, 1, 0.01, 0.1, (v) => `${fix(v, 2)} %`)],
    draw: (s) => { const xs = lin(0, 4, 200), ap = (A) => M.beer(1, A, 1, s.st / 100).A; return { plots: [{ x: [0, 4], y: [0, 4.2], series: [{ xs, ys: xs, c: 5, dash: true, label: L('理想仪器', 'ideal instrument') }, { xs, ys: xs.map(ap), c: 0, label: L('有杂散光', 'with stray light') }], xl: L('真实吸光度', 'true absorbance'), yl: L('读到的吸光度', 'absorbance read'), h: 280 }], out: [1, 2, 3].map((A) => [`A = ${A}`, L(`读数 ${fix(ap(A), 3)}，低 ${fix((100 * (A - ap(A))) / A, 1)} %`, `reads ${fix(ap(A), 3)}, ${fix((100 * (A - ap(A))) / A, 1)} % low`)]) }; },
  });

  G.jablonski = () => ({
    draw: () => {
      const lv = (x0, x1, y, cls = 'sp-lv') => `<line class="${cls}" x1="${x0}" x2="${x1}" y1="${y}" y2="${y}"/>`, vib = (x0, x1, y) => [1, 2, 3].map((k) => lv(x0, x1, y - k * 11, 'sp-lv is-vib')).join('');
      const arrow = (x, y0, y1, c) => `<line class="sp-arrow sp-c${c}" x1="${x}" x2="${x}" y1="${y0}" y2="${y1 + (y1 > y0 ? -7 : 7)}"/><path class="sp-head sp-c${c}" d="M${x} ${y1}l-4.5 ${y1 > y0 ? -9 : 9}h9z"/>`;
      const wavy = (x0, y0, x1, y1, c) => { const n = 9, pts = []; for (let i = 0; i <= n * 4; i++) { const u = i / (n * 4), px = x0 + (x1 - x0) * u, py = y0 + (y1 - y0) * u, len = Math.hypot(x1 - x0, y1 - y0), ox = (-(y1 - y0) / len) * 4 * Math.sin(u * n * 2 * Math.PI), oy = ((x1 - x0) / len) * 4 * Math.sin(u * n * 2 * Math.PI); pts.push(`${(px + ox).toFixed(1)} ${(py + oy).toFixed(1)}`); } return `<path class="sp-line sp-c${c}" d="M${pts.join('L')}"/>`; };
      const t = (x, y, s2, anchor = 'start', cls = 'sp-lbl') => `<text class="${cls}" x="${x}" y="${y}" text-anchor="${anchor}">${K.svgRich(s2)}</text>`;
      const S0 = 330, S1 = 170, S2 = 80, T1 = 225;
      const rows = [[0, L('吸收', 'Absorption'), '10⁻¹⁵ s'], [5, L('振动弛豫', 'Vibrational relaxation'), '10⁻¹²–10⁻¹⁰ s'], [5, L('内转换', 'Internal conversion'), '10⁻¹¹–10⁻⁹ s'], [1, L('荧光', 'Fluorescence'), '10⁻¹⁰–10⁻⁷ s'], [4, L('系间窜越', 'Intersystem crossing'), '10⁻¹⁰–10⁻⁸ s'], [3, L('磷光', 'Phosphorescence'), '10⁻⁶–10 s']];
      const svg = `<svg class="sp-plot sp-diagram" viewBox="0 0 720 370" role="img" aria-label="Jablonski">
        ${lv(60, 330, S0)}${vib(60, 330, S0)}${lv(60, 250, S1)}${vib(60, 250, S1)}${lv(60, 190, S2)}${vib(60, 190, S2)}${lv(300, 440, T1)}${vib(300, 440, T1)}
        ${t(52, S0 + 4, 'S₀', 'end', 'sp-axis')}${t(52, S1 + 4, 'S₁', 'end', 'sp-axis')}${t(52, S2 + 4, 'S₂', 'end', 'sp-axis')}${t(448, T1 + 4, 'T₁', 'start', 'sp-axis')}
        ${arrow(85, S0, S1 - 22, 0)}${arrow(115, S0, S2 - 22, 0)}
        ${wavy(140, S2 - 22, 140, S2, 5)}${wavy(160, S2, 160, S1 - 33, 5)}${wavy(180, S1 - 33, 180, S1, 5)}
        ${arrow(205, S1, S0 - 22, 1)}${arrow(228, S1, S0, 1)}
        ${wavy(252, S1, 310, T1 - 22, 4)}${wavy(330, T1 - 22, 330, T1, 5)}
        ${arrow(380, T1, S0, 3)}${arrow(405, T1, S0 - 11, 3)}
        ${rows.map(([c, name, time], i) => `<line class="sp-line sp-c${c}" x1="490" x2="514" y1="${96 + i * 34}" y2="${96 + i * 34}"/>${t(522, 100 + i * 34, tx(name))}${t(522, 114 + i * 34, time, 'start', 'sp-tick')}`).join('')}
      </svg>`;
      return { plots: [{ html: svg }] };
    },
  });

  G.decay = () => ({
    ctl: [ctl.range('t1', 'τ₁', 0.2, 5, 0.1, 1, (v) => `${fix(v, 1)} ns`), ctl.range('t2', 'τ₂', 0.5, 12, 0.1, 4, (v) => `${fix(v, 1)} ns`)],
    draw: (s) => {
      const sg = 0.24 / 2.35482, xs = lin(-1, 30, 600), norm = (ys) => { const top = Math.max(...ys); return ys.map((y) => y / top); };
      return { plots: [{ x: [-1, 30], y: [1e-4, 2.5], logy: true, series: [{ xs, ys: xs.map((t) => Math.exp(-(t * t) / (2 * sg * sg))), c: 5, dash: true, label: L('仪器响应', 'instrument response') }, { xs, ys: norm(xs.map((t) => M.decayIrf(t, s.t1, 0, sg))), c: 0, label: `τ = ${fix(s.t1, 1)} ns` }, { xs, ys: norm(xs.map((t) => M.decayIrf(t, s.t2, 0, sg))), c: 1, label: `τ = ${fix(s.t2, 1)} ns` }], xl: L('时间（ns）', 'time (ns)'), yl: L('归一化计数（对数）', 'normalised counts (log)'), h: 280 }],
        out: [[L('降到 1/e 的时间', 'Time to fall to 1/e'), `${fix(s.t1, 1)} ns, ${fix(s.t2, 1)} ns`], [L('降到 1 % 的时间', 'Time to fall to 1 %'), `${fix(s.t1 * Math.log(100), 1)} ns, ${fix(s.t2 * Math.log(100), 1)} ns`]] };
    },
  });

  G.kinetics = () => ({
    ctl: [ctl.log('t1', 'τ₁ (A → B)', 0.3, 20, 2, (v) => `${num(+v.toPrecision(2), 2)} ps`), ctl.log('t2', L('τ₂（B → 基态）', 'τ₂ (B → ground state)'), 30, 1000, 150, (v) => `${num(+v.toPrecision(2), 0)} ps`)],
    draw: (s) => {
      const sg = 0.15 / 2.35482, xs = logs(0.05, 3000, 400), A = xs.map((t) => M.decayIrf(t, s.t1, 0, sg)), k1 = 1 / s.t1, k2 = 1 / s.t2, B = xs.map((t, i) => (k1 / (k1 - k2)) * (M.decayIrf(t, s.t2, 0, sg) - A[i]));
      return { plots: [{ x: [0.05, 3000], y: [-1.15, 1.15], logx: true, zero: true, series: [{ xs, ys: A, c: 0, label: L('A 的激发态吸收', 'excited-state absorption of A') }, { xs, ys: B, c: 1, label: L('B 的吸收', 'absorption of B') }, { xs, ys: A.map((v, i) => -(v + B[i])), c: 3, label: L('基态漂白', 'ground-state bleach') }], xl: L('泵浦–探测延迟（ps，对数）', 'pump–probe delay (ps, log)'), yl: L('ΔA（归一化）', 'ΔA (normalised)'), h: 290 }],
        out: [[L('B 的布居最大的时刻', 'Time at which B peaks'), `${num(Math.log(k1 / k2) / (k1 - k2), 2)} ps`]] };
    },
  });

  G.tauc = () => ({
    ctl: [ctl.range('eg', L('带隙 E_g', 'Band gap E_g'), 1, 4, 0.01, 3.3, (v) => `${fix(v, 2)} eV`)],
    draw: (s) => {
      const xs = lin(s.eg - 0.7, s.eg + 0.7, 300), al = (e) => (Math.sqrt(Math.max(e - s.eg, 0)) + 0.06 * Math.exp(Math.min(0, e - s.eg) / 0.06)) / e;
      return { plots: [{ x: [s.eg - 0.7, s.eg + 0.7], y: [-0.03, 0.75], series: [{ xs, ys: xs.map((e) => (al(e) * e) ** 2), c: 0, label: '(αhν)²' }, { xs: [s.eg, s.eg + 0.7], ys: [0, 0.7], c: 1, dash: true, label: L('线性段的外推', 'extrapolation of the linear part') }], vlines: [{ x: s.eg, label: `E_g = ${fix(s.eg, 2)} eV`, c: 1 }], xl: L('光子能量 hν（eV）', 'photon energy hν (eV)'), yl: L('(αhν)²（任意单位）', '(αhν)² (arbitrary units)'), h: 280 }],
        out: [[L('带隙', 'Band gap'), `${fix(s.eg, 2)} eV`], [L('吸收边的波长', 'Wavelength of the absorption edge'), `${fix(M.conv.evToNm(s.eg), 0)} nm`]] };
    },
  });

  // ── 磁共振 ────────────────────────────────────────────────────────────
  const MULT = [L('单峰', 'singlet'), L('双峰', 'doublet'), L('三重峰', 'triplet'), L('四重峰', 'quartet'), L('五重峰', 'quintet'), L('六重峰', 'sextet'), L('七重峰', 'septet')];
  G.nmr1h = (a) => ({
    ctl: [...(a.mols.length > 1 ? [ctl.select('i', L('分子', 'Molecule'), a.mols.map((m, i) => [i, tx(m.name)]), 0)] : []), ctl.seg('mhz', L('谱仪频率', 'Spectrometer frequency'), [[60, '60 MHz'], [90, '90 MHz'], [400, '400 MHz'], [800, '800 MHz']], a.mhz)],
    draw: (s) => {
      const mol = a.mols[+s.i || 0], mhz = +s.mhz, fw = 1 / mhz, lines = [], marks = [], out = [];
      for (const g of mol.groups) {
        const mult = M.multiplet(g.J.map(([J, n]) => ({ n, J })));
        for (const l of mult) lines.push({ x: g.shift + l.dHz / mhz, a: g.n * l.w });
        out.push([`${g.label}`, `δ ${fix(g.shift, 2)} ppm · ${g.n}H · ${g.J.length === 0 ? MULT[0] : g.J.length === 1 ? `${MULT[g.J[0][1]] || L('多重峰', 'multiplet')} (J = ${g.J[0][0]} Hz)` : L('多重峰', 'multiplet')}`]);
      }
      const lo = Math.max(-0.5, Math.min(...mol.groups.map((g) => g.shift)) - 0.9), hi = Math.max(...mol.groups.map((g) => g.shift)) + 0.9;
      const grid = new Set(lin(lo, hi, 1400)); for (const l of lines) for (let k = -30; k <= 30; k++) grid.add(l.x + (k / 30) * 14 * fw * (Math.abs(k) > 15 ? 2 : 0.5));
      const xs = [...grid].filter((x) => x >= lo && x <= hi).sort((p, q) => p - q), h = fw / 2, ys = xs.map((x) => lines.reduce((y, l) => y + (l.a * h) / (Math.PI * ((x - l.x) ** 2 + h * h)), 0)), top = Math.max(...ys);
      for (const g of mol.groups) { const near = Math.max(...xs.map((x, i) => (Math.abs(x - g.shift) < 0.06 + 12 / mhz ? ys[i] : 0))); marks.push([g.shift, `${g.label} (${g.n}H)`, near / top]); }
      return { plots: [{ x: [lo, hi], y: [0, 1.25], rev: true, noy: true, series: [{ xs, ys: ys.map((y) => y / top), c: 0 }], marks, xl: L('化学位移 δ（ppm）', 'chemical shift δ (ppm)'), yl: L('强度', 'intensity'), h: 290, curfmt: (v) => `${v.toFixed(3)} ppm` }], out };
    },
  });

  G.epr = (a0) => {
    const epr = (window.MOLASTRIA_SPECTRA_METHODS || []).find((m) => m.id === 'epr'), a = a0.presets ? a0 : { ...(epr?.figs.find((f) => f.gen === 'epr')?.args || {}), free: true };
    const fromPreset = (i) => { const p = a.presets[i], [s1, s2] = [p.sets[0], p.sets[1] || [0, 0.5, 0]]; return { n1: s1[0], I1: s1[1], a1: s1[2], n2: s2[0], I2: s2[1], a2: s2[2], lw: p.lw }; };
    const defs = [{ ...ctl.select('p', L('自由基', 'Radical'), a.presets.map((p, i) => [i, tx(p.name)]), 0), apply: (v) => (a.free ? fromPreset(+v) : {}) }, ctl.seg('view', L('记录方式', 'Display'), [['d', L('一阶导数', 'First derivative')], ['a', L('吸收线', 'Absorption')]], 'd')];
    if (a.free) {
      const I = [[0.5, 'I = ½'], [1, 'I = 1'], [1.5, 'I = 3⁄2'], [2.5, 'I = 5⁄2']], p0 = fromPreset(0);
      defs.push(ctl.range('n1', L('第一组：等价核的个数', 'Set 1: number of equivalent nuclei'), 0, 8, 1, p0.n1, (v) => `${v}`), ctl.seg('I1', L('第一组：核自旋', 'Set 1: nuclear spin'), I, p0.I1), ctl.range('a1', L('第一组：耦合常数', 'Set 1: coupling constant'), 0, 10, 0.005, p0.a1, (v) => `${fix(v, 3)} mT`),
        ctl.range('n2', L('第二组：等价核的个数', 'Set 2: number of equivalent nuclei'), 0, 8, 1, p0.n2, (v) => `${v}`), ctl.seg('I2', L('第二组：核自旋', 'Set 2: nuclear spin'), I, p0.I2), ctl.range('a2', L('第二组：耦合常数', 'Set 2: coupling constant'), 0, 10, 0.005, p0.a2, (v) => `${fix(v, 3)} mT`), ctl.log('lw', L('线宽（峰–峰）', 'Line width (peak to peak)'), 0.005, 2, p0.lw, (v) => `${num(+v.toPrecision(2), 3)} mT`));
    }
    return {
      ctl: defs,
      draw: (s) => {
        const p = a.presets[+s.p], sets = (a.free ? [[s.n1, +s.I1, s.a1], [s.n2, +s.I2, s.a2]] : p.sets).filter((x) => x[0] > 0 && x[2] > 0).map(([n, I, av]) => ({ n, I, a: av })), lw = a.free ? s.lw : p.lw;
        const sp = M.eprSpectrum(sets, { g: p.g, ghz: a.ghz, pp: lw, n: 2400 });
        let ys = sp.ys;
        if (s.view === 'a') { let acc = 0; ys = sp.ys.map((y) => (acc += y)); }
        const top = Math.max(...ys.map(Math.abs)) || 1;
        return { plots: [{ x: [sp.xs[0], sp.xs[sp.xs.length - 1]], y: s.view === 'a' ? [-0.05, 1.15] : [-1.15, 1.15], noy: true, zero: true, series: [{ xs: sp.xs, ys: ys.map((y) => y / top), c: 0 }], xl: L('磁场（mT）', 'magnetic field (mT)'), yl: s.view === 'a' ? L('吸收', 'absorption') : L('吸收的一阶导数', 'first derivative of absorption'), h: 290, curfmt: (v) => `${v.toFixed(3)} mT` }],
          out: [[L('中心磁场', 'Centre field'), `${sp.b0.toFixed(2)} mT (g = ${p.g}, ${a.ghz} GHz)`], [L('谱线条数', 'Number of lines'), `${sp.lines.length}${sets.length ? ` = ${sets.map((x) => `(2 × ${x.n} × ${x.I} + 1)`).join(' × ')}` : ''}`], [L('相对强度', 'Relative intensities'), sp.lines.length <= 13 ? sp.lines.map((l) => num(l.w / sp.lines[0].w, 1)).join(' : ') : L('见图', 'see the figure')], [L('谱的总宽度', 'Total width'), `${fix(sp.lines[sp.lines.length - 1].dB - sp.lines[0].dB, 3)} mT`]] };
      },
    };
  };

  G.deer = () => ({
    ctl: [ctl.range('r', L('平均距离', 'Mean distance'), 1.8, 8, 0.05, 3.5, (v) => `${fix(v, 2)} nm`), ctl.range('sg', L('分布的标准差', 'Standard deviation of the distribution'), 0.05, 1.2, 0.01, 0.3, (v) => `${fix(v, 2)} nm`)],
    draw: (s) => {
      const rs = lin(Math.max(1.2, s.r - 3 * s.sg), s.r + 3 * s.sg, 41), pw = rs.map((r) => Math.exp(-((r - s.r) ** 2) / (2 * s.sg * s.sg))), ps = pw.reduce((x, y) => x + y, 0), tmax = Math.min(8, Math.max(1.5, (3 * s.r ** 3) / 52.04)), ts = lin(0, tmax, 260), xs2 = lin(0, 1, 61);
      const V = ts.map((t) => { let f = 0; rs.forEach((r, i) => { const w = (2 * Math.PI * 52.04) / r ** 3; let c = 0; for (const x of xs2) c += Math.cos((1 - 3 * x * x) * w * t); f += (pw[i] / ps) * (c / xs2.length); }); return 1 - 0.3 * (1 - f); });
      const rr = lin(1, 9, 240);
      return { plots: [{ x: [0, tmax], y: [0.62, 1.02], series: [{ xs: ts, ys: V, c: 0 }], xl: L('泵浦脉冲的时刻 t（μs）', 'pump-pulse time t (μs)'), yl: L('归一化回波强度', 'normalised echo intensity'), h: 250 }, { x: [1, 9], noy: true, series: [{ xs: rr, ys: rr.map((r) => Math.exp(-((r - s.r) ** 2) / (2 * s.sg * s.sg))), c: 1, fill: true }], xl: L('自旋间距 r（nm）', 'spin–spin distance r (nm)'), yl: 'P(r)', h: 170 }],
        out: [[L('偶极频率', 'Dipolar frequency'), `52.04 / r³ = ${fix(M.dipolarMHz(s.r), 2)} MHz`], [L('振荡周期', 'Oscillation period'), `${fix(1 / M.dipolarMHz(s.r), 2)} μs`]] };
    },
  });

  G.mossbauer = (a) => ({
    ctl: [ctl.select('p', L('样品', 'Sample'), a.presets.map((p, i) => [i, tx(p.name)]), 0)],
    draw: (s) => {
      const p = a.presets[+s.p], lines = p.B ? M.mossbauerSextet(p.B, p.is, p.qs) : p.qs ? M.mossbauerDoublet(p.is, p.qs) : [{ v: p.is, w: 1 }], span = p.B ? 12 : 4.5, xs = lin(-span, span, 900), wmax = Math.max(...lines.map((l) => l.w)), h = 0.125;
      const ys = xs.map((v) => 100 - 9 * lines.reduce((y, l) => y + ((l.w / wmax) * h * h) / ((v - l.v) ** 2 + h * h), 0));
      return { plots: [{ x: [-span, span], y: [89.5, 100.8], series: [{ xs, ys, c: 0 }], vlines: [{ x: 0, c: 5 }], xl: L('速度（mm/s，相对 α-Fe）', 'velocity (mm/s, relative to α-Fe)'), yl: L('透过率（%，示意的吸收深度）', 'transmission (%, schematic depth)'), h: 280, curfmt: (v) => `${v.toFixed(2)} mm/s` }],
        out: [[L('同质异能位移 δ', 'Isomer shift δ'), `${fix(p.is, 2)} mm/s`], [p.B ? L('四极位移 ε', 'Quadrupole shift ε') : L('四极分裂 ΔE_Q', 'Quadrupole splitting ΔE_Q'), `${fix(p.qs, 2)} mm/s`], [L('超精细场', 'Hyperfine field'), p.B ? `${p.B} T` : L('无（顺磁或抗磁）', 'none (paramagnetic or diamagnetic)')], [L('谱线位置', 'Line positions'), `${lines.map((l) => fix(l.v, 2)).join(', ')} mm/s`]] };
    },
  });
})();
