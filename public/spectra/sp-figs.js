'use strict';
// 谱图馆 · 六种基本的图：实测质谱（ms、msseries）、实测的 xy 谱（xy）、量化计算的振动谱（vib）和电子谱（uv）、示意谱（sketch）。
// 每种图是一个“视图”（控件 + draw），由 sp-plot.js 的 mount 装进页面。交互演示在 sp-gens.js。
(() => {
  const K = window.MOLASTRIA_SPECTRA_KIT, M = window.MOLASTRIA_SPECTRA_MODELS, D = window.MOLASTRIA_SPECTRA;
  const MEAS = window.MOLASTRIA_SPECTRA_MEASURED || { ms: {}, xy: {}, sources: {} }, COMP = window.MOLASTRIA_SPECTRA_COMPUTED || { vib: {}, uv: {} }, MARKS = window.MOLASTRIA_SPECTRA_MSMARKS || {};
  if (!K || !M || !D) return;
  const { L, tx, esc, num, fix, chem, ctl } = K;
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  const V = {};

  // ── 实测质谱 ──────────────────────────────────────────────────────────
  const msName = (id) => { const r = MEAS.ms[id]; if (!r) return id; const n = r.names[r.names.length > 1 && /^[a-z]/.test(r.names[0]) && r.names[1].length < r.names[0].length ? 1 : 0]; return `${n.charAt(0).toUpperCase()}${n.slice(1)} · ${chem(r.formula)}${r.ms === 'MS2' ? ` · MS²${r.ce ? ` (CE ${r.ce})` : ''}` : ` · ${r.ion || r.type}`}`; };
  const msDec = (r) => (/QFT|ITFT|QTOF/.test(r.type) ? 4 : 0);
  function msPlot(id, o = {}) {
    const r = MEAS.ms[id], top = Math.max(...r.peaks.map((p) => p[1])), dec = msDec(r);
    const sticks = r.peaks.map(([mz, i]) => ({ x: mz, y: (100 * i) / top, tip: `m/z ${mz.toFixed(4)} · ${fix((100 * i) / top, 1)} %` }));
    const used = new Set();
    for (const [m, text] of MARKS[id] || []) {
      const near = sticks.filter((s) => Math.abs(s.x - m) <= 0.3).sort((a, b) => b.y - a.y)[0];
      if (near && !used.has(near)) { near.label = `${dec ? near.x.toFixed(dec) : Math.round(near.x)} ${text}`; near.c = 1; used.add(near); }
    }
    for (const s of [...sticks].sort((a, b) => b.y - a.y).slice(0, 8)) if (!s.label && s.y >= 15) s.label = dec ? s.x.toFixed(dec) : String(Math.round(s.x));
    const lo = Math.min(...r.peaks.map((p) => p[0])), hi = Math.max(...r.peaks.map((p) => p[0]), r.prec || 0, r.ms === 'MS2' ? 0 : r.mass || 0);
    const p = { x: o.x || [Math.max(0, Math.floor((lo - 6) / 10) * 10), Math.ceil((hi + 8) / 10) * 10], y: [0, 125], sticks, xl: 'm/z', yl: L('相对强度（%）', 'relative intensity (%)'), h: o.h || 300, curfmt: (v) => `m/z ${v.toFixed(1)}`, aria: `${L('实测质谱', 'Measured mass spectrum')}: ${r.names[0]}` };
    if (o.overlay && r.formula) {
      const pat = M.isotopePattern(r.formula, { charge: 1 }), t = pat.reduce((a, b) => (b.rel > a.rel ? b : a)), near = sticks.filter((s) => Math.abs(s.x - t.mz) <= 0.3).sort((a, b) => b.y - a.y)[0];
      if (near) { p.pts = pat.filter((q) => q.rel > 0.5).map((q) => ({ x: q.mz, y: (q.rel * near.y) / 100, c: 3, open: true, r: 4.2 })); p.legend = [{ c: 3, dot: true, t: L(`分子离子 ${chem(r.formula)}⁺• 的理论同位素分布（按最高峰对齐）`, `calculated isotope pattern of the molecular ion ${chem(r.formula)}⁺• (scaled to the tallest peak)`) }]; }
    }
    return p;
  }
  function msOut(id) {
    const r = MEAS.ms[id], out = [[L('化合物', 'Compound'), `${r.names[0]} · ${chem(r.formula)}`], [L('单同位素质量', 'Monoisotopic mass'), `${r.mass.toFixed(4)} Da`]];
    out.push([L('仪器', 'Instrument'), `${r.inst}${r.res ? ` · R ≈ ${r.res}` : ''}`]);
    out.push([L('电离', 'Ionisation'), `${r.ion || r.type}${r.mode ? ` (${r.mode === 'POSITIVE' ? L('正离子', 'positive') : L('负离子', 'negative')})` : ''}${r.matrix ? ` · ${L('基质', 'matrix')} ${r.matrix}` : ''}`]);
    if (r.prec) out.push([L('母离子', 'Precursor'), `${r.adduct || ''} m/z ${r.prec.toFixed(4)}${r.ce ? ` · ${r.frag || 'CID'} ${L('碰撞能量', 'collision energy')} ${r.ce}` : r.frag ? ` · ${r.frag}` : ''}`]);
    if (r.rt != null) out.push([L('保留时间', 'Retention time'), `${r.rt.toFixed(2)} min`]);
    if (r.ri != null) out.push([L('保留指数', 'Retention index'), `${r.ri}`]);
    return out;
  }
  const msSrc = (id) => { const r = MEAS.ms[id]; return `<p class="sp-src">${L('数据', 'Data')}: MassBank <a href="${esc(MEAS.sources.massbank.record + r.acc)}" target="_blank" rel="noopener noreferrer">${esc(r.acc)} ${ext}</a> · ${esc(r.authors)} · ${L('许可证', 'licence')} ${esc(r.lic)}${r.of ? ` · ${L(`这条记录有 ${r.of} 个峰，这里画最强的 ${r.peaks.length} 个`, `this record has ${r.of} peaks; the ${r.peaks.length} strongest are drawn`)}` : ''}</p>`; };
  V.ms = (f) => {
    const ids = (f.pick || [f.ms]).filter((id) => MEAS.ms[id]);
    return {
      ctl: ids.length > 1 ? [ctl.select('id', L('实测记录', 'Measured record'), ids.map((id) => [id, msName(id)]), f.ms)] : [],
      draw: (s) => { const id = s.id || f.ms; return { plots: [msPlot(id, { overlay: f.overlay })], out: msOut(id), html: msSrc(id) }; },
    };
  };
  V.msseries = (f) => {
    const ids = f.msseries.filter((id) => MEAS.ms[id]), also = (f.also || []).filter((id) => MEAS.ms[id]);
    const hi = Math.max(...[...ids, ...also].flatMap((id) => MEAS.ms[id].peaks.map((p) => p[0])));
    const defs = [];
    if (also.length) defs.push(ctl.seg('which', L('化合物', 'Compound'), [['', MEAS.ms[ids[0]].names[0]], ...also.map((id) => [id, MEAS.ms[id].names[0]])], ''));
    defs.push(ctl.range('i', L('碰撞能量', 'Collision energy'), 0, ids.length - 1, 1, Math.min(1, ids.length - 1), (v) => `${MEAS.ms[ids[v]].ce}`, { show: (s) => !s.which }));
    return { ctl: defs, draw: (s) => { const id = s.which || ids[s.i]; return { plots: [msPlot(id, { x: [40, Math.ceil((hi + 10) / 10) * 10] })], out: msOut(id), html: msSrc(id) }; } };
  };

  // ── 实测的 xy 谱 ──────────────────────────────────────────────────────
  V.xy = (f) => ({
    draw: () => {
      const r = MEAS.xy[f.xy];
      return { plots: [{ series: [{ xs: r.x, ys: r.y, c: 0 }], rev: f.rev, xl: f.xl, yl: f.yl, marks: (f.marks || []).map(([x, t]) => [x, t]), h: 300 }],
        html: `<p class="sp-src">${L('数据', 'Data')}: ${esc(r.what)} · ${esc(r.by)} · ${esc(r.from)} · ${L('许可证', 'licence')} ${esc(r.lic)}${r.doi ? ` · <a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener noreferrer">doi:${esc(r.doi)} ${ext}</a>` : ''}</p>` };
    },
  });

  // ── 量化计算的振动谱 ──────────────────────────────────────────────────
  const SCALE = 0.965;
  const molName = (id) => (D.molecules[id] ? `${tx(D.molecules[id][0])} ${D.molecules[id][1]}` : id);
  const compSrc = (c, what) => `<p class="sp-src">${L('计算', 'Calculation')}: ${esc(COMP.program || 'PySCF')} · ${what} · <a href="https://github.com/FelixJiashengFu/chem-research-molastria/blob/main/tools/spectra/calcs.py" target="_blank" rel="noopener noreferrer">tools/spectra/calcs.py ${ext}</a></p>`;
  const missing = (id) => ({ plots: [], out: [[molName(id), L('这个分子的计算结果还没有生成。', 'The calculation for this molecule has not been generated yet.')]] });
  V.vib = (f) => {
    const all = Object.keys(COMP.vib), ids = (f.pick === 'all' ? Object.keys(D.molecules).filter((id) => COMP.vib[id]) : f.pick || [f.vib]).filter((id) => COMP.vib[id] || id === f.vib);
    const defs = [];
    if (ids.length > 1) defs.push(ctl.select('id', L('分子', 'Molecule'), ids.map((id) => [id, molName(id)]), all.includes(f.vib) ? f.vib : ids[0], { }));
    if (f.mode === 'both') defs.push(ctl.seg('mode', L('谱', 'Spectrum'), [['both', L('红外和拉曼', 'Infrared and Raman')], ['ir', L('红外', 'Infrared')], ['raman', L('拉曼', 'Raman')]], 'both'));
    defs.push(ctl.range('fwhm', L('线宽（画图用）', 'Line width (for drawing)'), 2, 40, 1, 12, (v) => `${v} cm⁻¹`));
    defs.push(ctl.check('scale', L(`乘标度因子 ${SCALE}`, `Apply scale factor ${SCALE}`), false));
    if (defs[0] && defs[0].k === 'id') defs[0].apply = () => ({ sel: null });
    return {
      ctl: defs,
      pick: (st, s, api) => api.set({ sel: st.data }),
      draw: (s) => {
        const id = s.id || f.vib, c = COMP.vib[id];
        if (!c) return missing(id);
        let mode = s.mode || f.mode || 'ir';
        if (!c.raman && mode !== 'ir') mode = 'ir';
        const k = s.scale ? SCALE : 1, modes = c.modes.map((m, i) => ({ i, nu: m[0] * k, ir: m[1], act: m[2], depol: m[3], ram: m[2] == null ? 0 : M.ramanIntensity(m[2], m[0] * k, 532, 298) }));
        const hi = Math.max(4000, Math.ceil((Math.max(...modes.map((m) => m.nu)) * 1.03) / 100) * 100), lo = Math.max(0, Math.min(400, Math.floor((Math.min(...modes.map((m) => m.nu)) - 60) / 100) * 100));
        const series = [], sticks = [], norm = (key) => { const top = Math.max(...modes.map((m) => m[key]), 1e-12); const b = M.broaden(modes.map((m) => ({ x: m.nu, y: m[key] })), { from: lo, to: hi, n: 1700, fwhm: s.fwhm, shape: 'lorentz' }); const t2 = Math.max(...b.ys, 1e-12); return { top, xs: b.xs, ys: b.ys.map((v) => v / t2) }; };
        const tip = (m) => `${fix(m.nu, 1)} cm⁻¹ · IR ${num(m.ir, 2)} km/mol${m.act != null ? ` · Raman ${num(m.act, 2)} Å⁴/amu` : ''}`;
        if (mode !== 'raman') { const b = norm('ir'); series.push({ xs: b.xs, ys: b.ys, c: 0, label: mode === 'both' ? L('红外', 'Infrared') : '' }); for (const m of modes) sticks.push({ x: m.nu, y: 0.001 + (0.999 * m.ir) / b.top * 0, c: 0, tip: tip(m), data: m.i, w: 0.01 }); }
        if (mode !== 'ir') { const b = norm('ram'); series.push({ xs: b.xs, ys: b.ys, c: 1, label: mode === 'both' ? L('拉曼（532 nm 激发，298 K）', 'Raman (532 nm excitation, 298 K)') : '' }); if (mode === 'raman') for (const m of modes) sticks.push({ x: m.nu, y: 0, c: 1, tip: tip(m), data: m.i, w: 0.01 }); }
        const sel = s.sel != null ? modes[s.sel] : null;
        if (sel) sticks.push({ x: sel.nu, y: 1.05, c: 3, dash: true, w: 1.2, data: sel.i, tip: tip(sel) });
        const exp = (D.expVib[id] || []).filter((e) => (mode === 'both' ? true : mode === 'ir' ? e[2] !== 'r' : (D.expVib[id].some((x) => x[2] === 'r') ? e[2] === 'r' : true)));
        const out = [[L('方法', 'Method'), `${c.method}/${c.basis} · ${L(`${c.atoms} 个原子，${c.modes.length} 个振动模式`, `${c.atoms} atoms, ${c.modes.length} vibrational modes`)}`]];
        const strongest = [...modes].sort((a, b) => (mode === 'raman' ? b.ram - a.ram : b.ir - a.ir))[0];
        if (sel) {
          out.push([L('选中的模式', 'Selected mode'), `${fix(sel.nu, 1)} cm⁻¹${s.scale ? L('（已乘标度因子）', ' (scaled)') : L('（谐振，未标度）', ' (harmonic, unscaled)')}`]);
          out.push([L('红外强度', 'Infrared intensity'), `${num(sel.ir, 2)} km/mol${sel.ir < 0.01 ? L('（红外非活性）', ' (infrared-inactive)') : ''}`]);
          if (sel.act != null) out.push([L('拉曼活性', 'Raman activity'), `${num(sel.act, 2)} Å⁴/amu${sel.act < 0.01 ? L('（拉曼非活性）', ' (Raman-inactive)') : sel.depol != null ? ` · ${L('退偏比', 'depolarisation ratio')} ${fix(sel.depol, 2)}${sel.depol < 0.74 ? L('（偏振带，全对称振动）', ' (polarised: totally symmetric)') : L('（退偏带）', ' (depolarised)')}` : ''}`]);
        } else { out.push([mode === 'raman' ? L('最强的拉曼带', 'Strongest Raman band') : L('最强的红外带', 'Strongest infrared band'), `${fix(strongest.nu, 1)} cm⁻¹`]); out.push([L('提示', 'Hint'), L('点谱上任何一个峰，看这个振动模式的频率、红外强度、拉曼活性和退偏比。', 'Click any peak to see the frequency, infrared intensity, Raman activity and depolarisation ratio of that mode.')]); }
        if (exp.length) out.push([L('实验基频（竖虚线）', 'Experimental fundamentals (dashed lines)'), exp.map((e) => `${e[0]} (${e[1]})`).join(', ') + ' cm⁻¹']);
        const notes = [];
        if (c.imag) notes.push(L(`有 ${c.imag.length} 个模式算出来是虚频（${c.imag.map((v) => fix(v, 0)).join('、')} cm⁻¹，甲基的近乎自由的转动），没有画。`, `${c.imag.length} mode came out imaginary (${c.imag.map((v) => fix(v, 0)).join(', ')} cm⁻¹, a nearly free methyl rotation) and is not drawn.`));
        if (!c.raman && (s.mode || f.mode) !== 'ir') notes.push(L('这个分子只算了红外。', 'Only the infrared spectrum was computed for this molecule.'));
        return { plots: [{ x: [lo, hi], y: [0, 1.22], rev: true, series, sticks, noy: true, vlines: exp.map((e) => ({ x: e[0], label: e[1], c: 5 })), xl: L('波数（cm⁻¹）', 'wavenumber (cm⁻¹)'), yl: L('相对强度（每条曲线各自归一）', 'relative intensity (each curve normalised)'), h: 320, curfmt: (v) => `${v.toFixed(0)} cm⁻¹` }],
          out, html: compSrc(c, `${c.method}/${c.basis}, ${L('气相，谐振近似', 'gas phase, harmonic')}`) , note: notes.join(' ') };
      },
    };
  };

  // ── 量化计算的电子激发谱 ──────────────────────────────────────────────
  const XC = { b3lyp: 'B3LYP', 'cam-b3lyp': 'CAM-B3LYP' };
  V.uv = (f) => {
    const ids = (f.pick === 'all' ? Object.keys(D.molecules).filter((id) => COMP.uv[id]) : f.pick || [f.uv]).filter((id) => COMP.uv[id] || id === f.uv);
    const defs = [];
    if (ids.length > 1) defs.push(ctl.select('id', L('分子', 'Molecule'), ids.map((id) => [id, molName(id)]), COMP.uv[f.uv] ? f.uv : ids[0]));
    defs.push(ctl.seg('xc', L('泛函', 'Functional'), [['both', L('两种都画', 'Both')], ['b3lyp', 'B3LYP'], ['cam-b3lyp', 'CAM-B3LYP']], f.compare ? 'both' : 'cam-b3lyp'));
    return {
      ctl: defs,
      draw: (s) => {
        const id = s.id || f.uv, c = COMP.uv[id];
        if (!c) return missing(id);
        const which = s.xc === 'both' ? Object.keys(XC) : [s.xc], series = [], sticks = [], out = [[L('方法', 'Method'), `${c.td === 'TDA' ? 'TDA' : 'TD'}-DFT/${c.basis} · ${L('结构', 'geometry')} ${c.geom}`]];
        const longest = Math.max(...Object.values(c.states).flat().map((st) => 1239.842 / st[0]), ...(D.expUv[id] || []).map((e) => e[0]));
        const x0 = 130, x1 = Math.ceil((longest + 90) / 50) * 50, xs = []; for (let i = 0; i <= 700; i++) xs.push(x0 + ((x1 - x0) * i) / 700);
        const sig = 0.4 / 2.35482;
        which.forEach((xc) => {
          const st = c.states[xc], col = xc === 'b3lyp' ? 0 : 1;
          series.push({ xs, ys: xs.map((nm) => { const e = 1239.842 / nm; let y = 0; for (const [ev, fo] of st) y += fo * Math.exp(-((e - ev) ** 2) / (2 * sig * sig)); return y; }), c: col, label: XC[xc] });
          for (const [ev, fo] of st) sticks.push({ x: 1239.842 / ev, y: fo, c: col, tip: `${XC[xc]} · ${fix(1239.842 / ev, 1)} nm · ${fix(ev, 2)} eV · f = ${fix(fo, 3)}` });
          const bright = st.filter((q) => q[1] > 0.01).sort((a, b) => a[0] - b[0])[0], first = st[0];
          out.push([`${XC[xc]}`, `${L('最低激发态', 'lowest excited state')} ${fix(1239.842 / first[0], 0)} nm (${fix(first[0], 2)} eV, f = ${fix(first[1], 3)})${bright && bright !== first ? `；${L('最低的允许跃迁', 'lowest allowed transition')} ${fix(1239.842 / bright[0], 0)} nm (${fix(bright[0], 2)} eV, f = ${fix(bright[1], 3)})` : ''}`]);
        });
        const exp = D.expUv[id] || [];
        if (exp.length) out.push([L('实验的最大吸收（竖虚线）', 'Experimental maxima (dashed lines)'), exp.map((e) => `${e[0]} nm (${tx(e[1])})`).join('; ')]);
        return { plots: [{ x: [x0, x1], series, sticks, vlines: exp.map((e) => ({ x: e[0], label: `${e[0]}`, c: 5 })), xl: L('波长（nm）', 'wavelength (nm)'), yl: L('振子强度 f', 'oscillator strength f'), h: 300, curfmt: (v) => `${v.toFixed(0)} nm` }], out,
          html: compSrc(c, `TD-DFT (B3LYP, CAM-B3LYP)/${c.basis}, ${L('气相，垂直激发，前 8 个单重态', 'gas phase, vertical excitations, first 8 singlets')}`), note: c.unconverged ? L('有个别激发态的迭代没有完全收敛。', 'A few excited states did not converge fully.') : '' };
      },
    };
  };

  // ── 示意谱 ────────────────────────────────────────────────────────────
  const g = (x, x0, fwhm) => Math.exp((-4 * Math.LN2 * (x - x0) ** 2) / (fwhm * fwhm));
  V.sketch = (f) => ({
    draw: () => {
      const k = f.sketch, [a, b] = [Math.min(...k.x), Math.max(...k.x)], n = 900, xs = []; for (let i = 0; i < n; i++) xs.push(a + ((b - a) * i) / (n - 1));
      const sets = k.sets || [{ peaks: k.peaks }], series = [], marks = [], vlines = [], pal = [0, 2, 3, 4];
      let free = 0;
      const curve = (set) => xs.map((x) => {
        if (k.edge) return 0.5 + Math.atan((x - set.e0) / 1.6) / Math.PI + (set.white - 1) * g(x, set.e0 + 3.5, 7) + set.pre[1] * g(x, set.pre[0], 1.8);
        let y = 0; for (const p of set.peaks) y += p[1] * g(x, p[0], p[2]);
        return y;
      });
      const all = sets.map(curve);
      sets.forEach((set, i) => { series.push({ xs, ys: all[i], c: set.alt ? 1 : set.dash ? 4 : pal[free++ % 4], dash: !!set.dash, label: set.label, fill: !!k.sum }); for (const p of set.peaks || []) if (p[3]) marks.push([p[0], p[3]]); if (k.edge) vlines.push({ x: set.pre[0], c: 5 }); });
      if (k.sum) series.push({ xs, ys: xs.map((_, j) => all.reduce((s2, ys) => s2 + ys[j], 0)), c: 5, w: 1.8, label: L('合计（拟合的包络）', 'Sum (fitted envelope)') });
      if (typeof k.rise === 'number') { const pk = sets[0].peaks, tot = pk.reduce((s2, p) => s2 + p[1], 0); series[0].ys = xs.map((x, j) => all[0][j] + 0.05 + (k.rise * pk.reduce((s2, p) => s2 + p[1] / (1 + Math.exp(-(x - p[0]) / (p[2] / 2))), 0)) / tot); }
      if (Array.isArray(k.rise)) series[0].ys = xs.map((x, j) => all[0][j] + (x > k.rise[0] ? k.rise[2] * ((x - k.rise[0]) / (k.rise[1] - k.rise[0])) ** 2 : 0));
      if (k.ups) {
        series[0].ys = xs.map((x, j) => (x > k.ups.cutoff ? 0 : all[0][j] * (1 / (1 + Math.exp(-(x - k.ups.fermi) / 0.06))) + 0.07 / (1 + Math.exp(-(x - k.ups.fermi) / 0.06)) + 2.4 * Math.exp(-(k.ups.cutoff - x) / 1.5)) / (1 + Math.exp((x - k.ups.cutoff + 0.12) / 0.04)));
        vlines.push({ x: k.ups.cutoff, label: L('二次电子截止', 'secondary-electron cut-off'), c: 1 }, { x: k.ups.fermi, label: L('费米边', 'Fermi edge'), c: 1 });
      }
      const flat = series.flatMap((s2) => s2.ys), lo = Math.min(0, ...flat), hi = Math.max(...flat);
      return { plots: [{ x: [a, b], y: [lo < 0 ? lo * 1.15 : 0, hi * (marks.length ? 1.22 : 1.1)], rev: k.rev ?? k.x[0] > k.x[1], series, marks, vlines, zero: k.zero, noy: !k.yt, xl: k.xl, yl: k.yl, h: 280 }] };
    },
  });

  window.MOLASTRIA_SPECTRA_VIEWS = V;
  window.MOLASTRIA_SPECTRA_MS = { msPlot, msOut, msSrc, msName };
})();
