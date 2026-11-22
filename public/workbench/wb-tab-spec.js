/* 计算工作台 · “光谱与输出”和“批量作业”两个标签。往 window.MOLASTRIA_WB_TABS 里登记，由 workbench.js 画出来。
   - 光谱与输出：读 Gaussian / ORCA / xTB 等的输出，画红外（开源代码台的 ir-core.js 展宽）、拉曼（活性或按 Polavarapu 换成强度）、
     紫外（TD 激发态展成 ε）、轨道能级、优化收敛（每项判据除以阈值，对数轴上低于 1 就算过）、原子电荷，并把每一步的结构放进查看器；
   - 批量作业：当前结构的每一帧（构象、扫描点、路径上的像）各写一份输入（开源代码台的 code-core.js），再写一个作业脚本（Slurm / PBS
     作业数组，或者依次运行的 bash / bat），打成一个 zip。 */
(function () {
  'use strict';
  const TABS = (window.MOLASTRIA_WB_TABS = window.MOLASTRIA_WB_TABS || []);
  const tr = (s) => (window.ChemI18n && document.documentElement.lang === 'en' ? window.ChemI18n.t(s) : s);

  // ── 光谱与输出 ───────────────────────────────────────────────────────
  TABS.push({ id: 'spec', n: 6, zh: '光谱与输出', en: 'Spectra & outputs', build(ctx, panel) {
    const { h, L, btn, field, sel, numIn, check, card, status, val, C, F, S, on, emit, current, setFrames, setFrame, use, view, plot, levels, download, csv, fileBox, errText } = ctx;
    const Code = window.MolAstriaCode, IR = window.MOLASTRIA_IR_CORE;
    const PROG = { gaussian: 'Gaussian', orca: 'ORCA', xtb: 'xTB', psi4: 'Psi4', pyscf: 'PySCF', nwchem: 'NWChem', cp2k: 'CP2K', qchem: 'Q-Chem' };
    let out = null; // { text, name, program, r, uv, raman, orbs, conv, charges }
    const st = h('p', { class: 'wb-status' }), sum = h('div', {});
    const secIr = h('div', { class: 'wb-sec' }), secRa = h('div', { class: 'wb-sec' }), secUv = h('div', { class: 'wb-sec' }), secOrb = h('div', { class: 'wb-sec' }), secConv = h('div', { class: 'wb-sec' }), secQ = h('div', { class: 'wb-sec' });

    function take(text, name, program, fromBuild) {
      if (out && out.text === text) return;
      const t = String(text || '');
      const prog = program || (Code ? Code.detect(t) : '');
      const r = Code && prog ? Code.parseOutput(t, prog) : { program: '', ir: [], geoms: [], steps: [], freqs: [], imaginary: [], energy: null, warnings: [] };
      out = { text: t, name: ctx.safeName((name || 'output').replace(/\.\w+$/, '')), program: prog, r, uv: C.uvOf(t), raman: C.ramanOf(t), orbs: C.orbitalsOf(t), conv: C.convergence(t, r.steps), charges: F.chargesOf(t) };
      const found = [r.ir.length && L('红外', 'IR'), out.raman.length && L('拉曼', 'Raman'), out.uv.length && L('紫外', 'UV-vis'), out.orbs && L('轨道能级', 'orbital energies'), Object.keys(out.conv.series).length && L('收敛判据', 'convergence criteria'), out.charges.length && L('原子电荷', 'atomic charges')].filter(Boolean);
      if (!prog && !found.length) { status(st, L('认不出这是哪个程序的输出（认 Gaussian、ORCA、xTB、Psi4、PySCF、NWChem、CP2K、Q-Chem）。', 'Could not tell which program wrote this (Gaussian, ORCA, xTB, Psi4, PySCF, NWChem, CP2K and Q-Chem are recognised).'), 'bad'); out = null; draw(); return; }
      if (!fromBuild && r.geoms.length) {
        const E = r.steps.length === r.geoms.length ? r.steps : [];
        setFrames(r.geoms.map((g, k) => ({ atoms: g, cell: null, energy: Number.isFinite(E[k]) ? E[k] : null, comment: `${prog} step ${k + 1}` })), { name: out.name, charge: S.charge, mult: S.mult, frame: r.geoms.length - 1, source: 'output' });
        emit('output', t, name, prog);
      }
      use('cclib');
      status(st, found.length ? L(`读入 ${PROG[prog] || prog || ''} 输出：找到 ${found.join('、')}。`, `Read the ${PROG[prog] || prog || ''} output: found ${found.join(', ')}.`) : L('读入了，但没找到光谱、轨道或收敛信息。', 'Read it, but found no spectra, orbitals or convergence data.'), found.length ? '' : 'warn');
      draw();
    }
    on('output', (text, name, program) => take(text, name, program, true));

    function kv(rows) { return h('div', { class: 'wb-kv' }, rows.filter(Boolean).map(([k, v]) => h('div', {}, h('small', { text: k }), h('b', { text: String(v) })))); }
    function draw() {
      for (const s of [sum, secIr, secRa, secUv, secOrb, secConv, secQ]) s.replaceChildren();
      if (!out) return;
      const r = out.r;
      sum.append(kv([
        [L('程序', 'Program'), PROG[out.program] || out.program || '?'],
        Number.isFinite(r.energy) && [L('最后的能量', 'Final energy'), `${r.energy.toFixed(8)} Eh`],
        r.normal !== null && r.normal !== undefined && [L('正常结束', 'Normal termination'), r.normal ? L('是', 'yes') : L('否', 'no')],
        r.optConverged !== null && r.optConverged !== undefined && [L('优化收敛', 'Optimisation converged'), r.optConverged ? L('是', 'yes') : L('否', 'no')],
        r.geoms.length && [L('结构', 'Geometries'), r.geoms.length],
        r.freqs.length && [L('振动频率', 'Frequencies'), r.freqs.length],
        r.freqs.length && [L('虚频', 'Imaginary'), r.imaginary.length ? r.imaginary.map((f) => `${Math.abs(f).toFixed(1)}i`).join(', ') : L('没有', 'none')],
        out.uv.length && [L('激发态', 'Excited states'), out.uv.length],
      ]));
      if (r.imaginary && r.imaginary.length) sum.append(h('p', { class: 'wb-status', 'data-warn': 'true', text: r.imaginary.length === 1 ? L('有 1 个虚频：如果这是过渡态，正好；如果本该是极小点，沿虚频方向推一下结构再优化。', 'One imaginary frequency: fine for a transition state; if this should be a minimum, displace along that mode and reoptimise.') : L(`有 ${r.imaginary.length} 个虚频，这不是极小点，也不是一阶鞍点。`, `${r.imaginary.length} imaginary frequencies: neither a minimum nor a first-order saddle point.`) }));
      if (r.geoms.length) sum.append(h('div', { class: 'wb-row' }, btn(L(`把 ${r.geoms.length} 个结构放进查看器`, r.geoms.length === 1 ? 'Put this geometry in the viewer' : `Put the ${r.geoms.length} geometries in the viewer`), () => {
        const E = r.steps.length === r.geoms.length ? r.steps : [];
        setFrames(r.geoms.map((g, k) => ({ atoms: g, cell: null, energy: Number.isFinite(E[k]) ? E[k] : null, comment: `${out.program} step ${k + 1}` })), { name: out.name, charge: S.charge, mult: S.mult, frame: r.geoms.length - 1, source: 'output' });
      }, 'small')));
      drawIr(); drawRaman(); drawUv(); drawOrbs(); drawConv(); drawCharges();
    }

    // 红外
    const irFw = numIn(20, { min: 1, max: 200, step: 1 }), irSc = numIn(1, { min: 0.8, max: 1.1, step: 0.001 });
    const irSh = sel([['lorentz', L('洛伦兹', 'Lorentzian')], ['gauss', L('高斯', 'Gaussian')]], 'lorentz', { 'aria-label': L('线型', 'Line shape') });
    for (const c of [irFw, irSc, irSh]) c.addEventListener('change', () => drawIr());
    function drawIr() {
      secIr.replaceChildren();
      if (!out || !out.r.ir.length || !IR) return;
      const b = IR.broaden(out.r.ir, { fwhm: val(irFw, 20), shape: irSh.value, scale: val(irSc, 1), from: 400, to: 4000, step: 2 });
      const top = Math.max(...b.sticks.map((s) => s.int)) || 1;
      // 最强的几个峰标数字，挨得太近（< 60 cm⁻¹）的只标强的那个，免得数字叠在一起
      const strong = IR.strongest(b.sticks, 8).reduce((acc, p) => (acc.length < 5 && acc.every((q) => Math.abs(q.freq - p.freq) >= 60) ? [...acc, p] : acc), []);
      secIr.append(h('h3', { class: 'wb-h3', text: L('红外', 'Infrared') }),
        h('div', { class: 'wb-row' }, field(L('半高宽（cm⁻¹）', 'FWHM (cm⁻¹)'), irFw, 'n'), field(L('频率校正因子', 'Scale factor'), irSc, 'n'), field(L('线型', 'Line shape'), irSh, 's')),
        plot({ series: [{ x: b.x, y: b.y, kind: 'line', color: 'var(--accent)' }, { x: b.sticks.map((s) => s.freq), y: b.sticks.map((s) => (s.int / top) * b.max), kind: 'sticks', color: 'var(--gold)', width: 1 }], reverseX: true, xLabel: L('波数 / cm⁻¹', 'Wavenumber / cm⁻¹'), yLabel: 'ε / L mol⁻¹ cm⁻¹', markers: strong.map((s) => ({ x: s.freq, text: s.freq.toFixed(0) })), tip: (i) => `${b.x[i].toFixed(0)} cm⁻¹  ε ${b.y[i].toFixed(1)}` }),
        h('p', { class: 'wb-small', text: L('棒的高度按最强峰缩放。B3LYP 一类杂化泛函的谐振频率通常偏高几个百分点，校正因子按方法和基组查 NIST CCCBDB；要叠实验谱，用开源代码台的红外标签。', 'Stick heights are scaled to the strongest band. Harmonic frequencies from hybrid functionals such as B3LYP usually run a few per cent high; look up the scale factor for your method and basis in NIST CCCBDB. To overlay an experimental spectrum use the IR tab of the Code Desk.') }),
        h('div', { class: 'wb-row' }, btn(L('下载谱（CSV）', 'Download the spectrum (CSV)'), () => download(`${out.name}_ir.csv`, csv([['wavenumber_cm-1', b.x], ['epsilon', b.y]]))), btn(L('下载峰表（CSV）', 'Download the band list (CSV)'), () => download(`${out.name}_ir_sticks.csv`, csv([['wavenumber_cm-1', b.sticks.map((s) => s.freq)], ['intensity_km_mol', b.sticks.map((s) => s.int)]])), 'small')));
    }

    // 拉曼
    const raMode = sel([['int', L('散射强度（Polavarapu）', 'Scattering intensity (Polavarapu)')], ['act', L('拉曼活性', 'Raman activity')]], 'int', { 'aria-label': L('纵轴', 'Vertical axis') });
    const raNm = numIn(532, { min: 200, max: 1500, step: 1 }), raT = numIn(298.15, { min: 1, max: 2000, step: 1 }), raFw = numIn(10, { min: 1, max: 200, step: 1 });
    for (const c of [raMode, raNm, raT, raFw]) c.addEventListener('change', () => drawRaman());
    function drawRaman() {
      secRa.replaceChildren();
      if (!out || !out.raman.length) return;
      const inten = raMode.value === 'int';
      const sticks = inten ? C.ramanIntensity(out.raman, val(raNm, 532), val(raT, 298.15)).map((m) => ({ pos: m.freq, h: m.int })) : out.raman.filter((m) => m.freq > 1).map((m) => ({ pos: m.freq, h: m.act }));
      if (inten) use('raman');
      const sc = val(irSc, 1);
      const b = C.broaden(sticks.map((s) => ({ pos: s.pos * sc, h: s.h })), { from: 0, to: 4000, n: 1600, fwhm: val(raFw, 10), shape: 'lorentz' });
      const ym = Math.max(...b.y) || 1, hm = Math.max(...sticks.map((s) => s.h)) || 1;
      secRa.append(h('h3', { class: 'wb-h3', text: L('拉曼', 'Raman') }),
        h('div', { class: 'wb-row' }, field(L('纵轴', 'Vertical axis'), raMode, 'm'), field(L('激光（nm）', 'Laser (nm)'), raNm, 'n'), field(L('温度（K）', 'Temperature (K)'), raT, 'n'), field(L('半高宽（cm⁻¹）', 'FWHM (cm⁻¹)'), raFw, 'n')),
        plot({ series: [{ x: b.x, y: b.y.map((y) => y / ym), kind: 'line', color: 'var(--accent)' }, { x: sticks.map((s) => s.pos * sc), y: sticks.map((s) => s.h / hm), kind: 'sticks', color: 'var(--gold)', width: 1 }], xLabel: L('拉曼位移 / cm⁻¹', 'Raman shift / cm⁻¹'), yLabel: L('相对强度', 'Relative intensity'), tip: (i) => `${b.x[i].toFixed(0)} cm⁻¹` }),
        h('p', { class: 'wb-small', text: inten ? L('程序给的是拉曼活性 S（Å⁴/amu），和测到的强度不是一回事。这里按 Polavarapu（1990）换成 Stokes 强度：I ∝ (ν₀ − ν)⁴ S / ν / (1 − e^(−hcν/kT))，所以低频峰会变强。频率校正因子和红外用同一个。', 'Programs print the Raman activity S (Å⁴/amu), which is not the measured intensity. It is converted to Stokes intensity following Polavarapu (1990): I ∝ (ν₀ − ν)⁴ S / ν / (1 − e^(−hcν/kT)), which strengthens low-frequency bands. The frequency scale factor is the one set for IR.') : L('纵轴是程序给的拉曼活性，没有按激光波长和温度换算。', 'The vertical axis is the activity as printed, not converted for laser wavelength and temperature.') }),
        h('div', { class: 'wb-row' }, btn(L('下载谱（CSV）', 'Download the spectrum (CSV)'), () => download(`${out.name}_raman.csv`, csv([['shift_cm-1', b.x], [inten ? 'intensity_rel' : 'activity_rel', b.y.map((y) => y / ym)]])))));
    }

    // 紫外
    const uvFw = numIn(0.3, { min: 0.05, max: 1.5, step: 0.05 }), uvLo = numIn(180, { min: 100, max: 1000, step: 10 }), uvHi = numIn(600, { min: 150, max: 2000, step: 10 });
    for (const c of [uvFw, uvLo, uvHi]) c.addEventListener('change', () => drawUv());
    function drawUv() {
      secUv.replaceChildren();
      if (!out || !out.uv.length) return;
      const lo = val(uvLo, 180), hi = Math.max(lo + 20, val(uvHi, 600));
      const s = C.uvSpectrum(out.uv, { fromNm: lo, toNm: hi, fwhmEv: val(uvFw, 0.3) });
      const em = Math.max(...s.eps) || 1, fm = Math.max(...out.uv.map((t) => t.f)) || 1;
      const vis = out.uv.filter((t) => t.nm >= lo && t.nm <= hi && t.f > 0);
      const anyMult = out.uv.some((t) => t.mult), hasSinglets = out.uv.some((t) => t.mult === 1);
      secUv.append(...[h('h3', { class: 'wb-h3', text: L('紫外可见', 'UV–vis') }),
        h('div', { class: 'wb-row' }, field(L('半高宽（eV）', 'FWHM (eV)'), uvFw, 'n'), field(L('从（nm）', 'From (nm)'), uvLo, 'n'), field(L('到（nm）', 'To (nm)'), uvHi, 'n')),
        plot({ series: [{ x: s.nm, y: s.eps, kind: 'line', color: 'var(--accent)' }, { x: vis.map((t) => t.nm), y: vis.map((t) => (t.f / fm) * em), kind: 'sticks', color: 'var(--gold)', width: 1.4 }], xLabel: L('波长 / nm', 'Wavelength / nm'), yLabel: 'ε / L mol⁻¹ cm⁻¹', tip: (i) => `${s.nm[i].toFixed(0)} nm (${s.ev[i].toFixed(2)} eV)  ε ${s.eps[i].toFixed(0)}` }),
        h('p', { class: 'wb-small', text: L('每个激发态在能量轴上展成高斯，面积按振子强度 f 换算（∫ε dν̃ = f / 4.319×10⁻⁹），所以纵轴是摩尔吸光系数；棒的高度按最大的 f 缩放。', 'Each excited state becomes a Gaussian on the energy axis with area set by the oscillator strength (∫ε dν̃ = f / 4.319×10⁻⁹), so the vertical axis is the molar absorption coefficient; sticks are scaled to the largest f.') }),
        h('div', { class: 'wb-tablewrap' }, h('table', { class: 'wb-table' }, h('thead', {}, h('tr', {}, ['#', 'eV', 'nm', 'f', ...(anyMult ? [L('多重度', 'Mult.')] : [])].map((x) => h('th', { text: x })))), h('tbody', {}, out.uv.map((t, k) => h('tr', {}, h('td', { text: String(k + 1) }), h('td', { text: t.ev.toFixed(3) }), h('td', { text: t.nm.toFixed(1) }), h('td', { text: t.mult > 1 && !t.f && hasSinglets ? L('0（自旋禁阻）', '0 (spin-forbidden)') : t.f.toFixed(4) }), anyMult ? h('td', { text: t.mult ? String(t.mult) : '' }) : null))))),
        anyMult && hasSinglets && out.uv.some((t) => t.mult === 3) ? h('p', { class: 'wb-small', text: L('程序同时算了三重态：它们和基态之间的跃迁自旋禁阻，f = 0，不进谱，但能量照样列出来（看系间窜越和 TADF 的能隙 ΔE_ST 时有用）。', 'The program also computed triplets: transitions to them are spin-forbidden (f = 0) and add nothing to the spectrum, but their energies are listed (useful for intersystem crossing and the TADF gap ΔE_ST).') }) : null,
        h('div', { class: 'wb-row' }, btn(L('下载谱（CSV）', 'Download the spectrum (CSV)'), () => download(`${out.name}_uv.csv`, csv([['wavelength_nm', s.nm], ['energy_eV', s.ev], ['epsilon', s.eps]]))), btn(L('下载激发态（CSV）', 'Download the states (CSV)'), () => download(`${out.name}_states.csv`, csv([['state', out.uv.map((_, k) => k + 1)], ['eV', out.uv.map((t) => t.ev)], ['nm', out.uv.map((t) => t.nm)], ['f', out.uv.map((t) => t.f)], ['multiplicity', out.uv.map((t) => t.mult ?? '')]])), 'small'))].filter(Boolean));
    }

    // 轨道能级
    function drawOrbs() {
      secOrb.replaceChildren();
      if (!out || !out.orbs) return;
      const o = out.orbs, fr = C.frontier(o);
      const list = (arr) => arr.map((x, i) => ({ e: x.e, occ: x.occ, i }));
      secOrb.append(h('h3', { class: 'wb-h3', text: L('轨道能级', 'Orbital energies') }),
        kv([fr.homo !== null && ['HOMO', `${(fr.homo * C.HARTREE_EV).toFixed(3)} eV`], fr.lumo !== null && ['LUMO', `${(fr.lumo * C.HARTREE_EV).toFixed(3)} eV`], fr.gapEv !== null && [L('能隙', 'Gap'), `${fr.gapEv.toFixed(3)} eV`], [L('轨道数', 'Orbitals'), o.alpha.length + (o.beta ? o.beta.length : 0)]]),
        levels({ alpha: list(o.alpha), beta: o.beta ? list(o.beta) : null }),
        h('p', { class: 'wb-small', text: L('要看轨道的形状，让程序写一个 Molden 文件（ORCA：orca_2mkl 名字 -molden），在“波函数与表面”里读进来。Kohn–Sham 的 HOMO–LUMO 能隙不等于光学能隙，也不等于基本能隙。', 'To see orbital shapes, have the program write a Molden file (ORCA: orca_2mkl name -molden) and load it under “Wavefunctions & surfaces”. A Kohn–Sham HOMO–LUMO gap is neither the optical gap nor the fundamental gap.') }));
    }

    // 优化收敛
    function drawConv() {
      secConv.replaceChildren();
      if (!out) return;
      const cv = out.conv, keys = Object.keys(cv.series), E = out.r.steps.filter(Number.isFinite);
      if (E.length < 2 && !keys.length) return;
      secConv.append(h('h3', { class: 'wb-h3', text: L('优化收敛', 'Optimisation convergence') }));
      if (E.length >= 2) {
        const e0 = E[E.length - 1], xs = E.map((_, k) => k + 1), rel = E.map((e) => (e - e0) * C.HARTREE_KCAL);
        const canPick = out.r.geoms.length === out.r.steps.length && S.frames.length === out.r.geoms.length;
        secConv.append(...[plot({ series: [{ x: xs, y: rel, kind: 'line', dots: true, color: 'var(--accent)' }], xTicks: Math.max(2, Math.min(7, xs.length - 1)), xLabel: L('步', 'Step'), yLabel: 'E − E_final / kcal mol⁻¹', hline: [{ y: 0 }], tip: (i) => `${L('第', 'step ')}${i + 1}${L(' 步', '')}: ${E[i].toFixed(8)} Eh (${rel[i] >= 0 ? '+' : ''}${rel[i].toFixed(3)} kcal/mol)`, onPick: canPick ? (i) => setFrame(i) : null }),
          canPick ? h('p', { class: 'wb-small', text: L('点曲线上的一步，查看器跳到那一步的结构。', 'Click a step to show its geometry in the viewer.') }) : null].filter(Boolean));
      }
      if (keys.length) {
        const n = Math.max(...keys.map((k) => cv.series[k].length));
        const COL = ['var(--accent)', 'var(--gold)', 'var(--info,#2563eb)', 'var(--danger)', 'var(--muted)'];
        secConv.append(plot({ series: keys.map((k, j) => ({ x: cv.series[k].map((_, i) => i + 1), y: cv.series[k].map((v) => Math.max(1e-6, Math.abs(v) / cv.thresholds[k])), kind: 'line', dots: true, color: COL[j % COL.length], name: k })), logY: true, xTicks: Math.max(2, Math.min(7, n - 1)), xLabel: L('步', 'Step'), yLabel: L('值 / 阈值', 'value / threshold'), hline: [{ y: 1, text: L('阈值', 'threshold') }], tip: (i) => `${L('第', 'step ')}${i + 1}${L(' 步', '')}: ${keys.map((k) => `${k} ${cv.series[k][i] !== undefined ? (Math.abs(cv.series[k][i]) / cv.thresholds[k]).toFixed(2) : '–'}`).join('; ')}` }),
          h('div', { class: 'wb-legend' }, keys.map((k, j) => h('span', {}, h('span', { class: 'wb-swatch', style: `display:inline-block;background:${COL[j % COL.length]}` }), ` ${k} (${cv.thresholds[k]})`))),
          h('p', { class: 'wb-small', text: L(`每项判据除以它的阈值，低于 1 就过了。${n} 步里全部判据都过的步：${cv.converged.map((c, i) => (c ? i + 1 : null)).filter(Boolean).join('、') || '没有'}。`, `Each criterion is divided by its threshold, so below 1 means it passes. Steps of ${n} where every criterion passes: ${cv.converged.map((c, i) => (c ? i + 1 : null)).filter(Boolean).join(', ') || 'none'}.`) }),
          h('div', { class: 'wb-row' }, btn(L('下载收敛数据（CSV）', 'Download convergence data (CSV)'), () => download(`${out.name}_convergence.csv`, csv([['step', Array.from({ length: n }, (_, i) => i + 1)], ...keys.map((k) => [k.replace(/\s+/g, '_'), cv.series[k]]), ['energy_Eh', out.r.steps]])), 'small')));
      }
    }

    // 原子电荷
    function drawCharges() {
      secQ.replaceChildren();
      if (!out || !out.charges.length) return;
      const qs = sel(out.charges.map((c, k) => [String(k), `${c.kind} (${c.q.length})`]), '0', { 'aria-label': L('电荷', 'Charges') });
      const tb = h('div', {});
      const fill = () => {
        const q = out.charges[Number(qs.value)].q, fr = current(), ok = fr && fr.atoms.length === q.length;
        tb.replaceChildren(h('div', { class: 'wb-tablewrap', style: 'max-height:320px;overflow:auto' }, h('table', { class: 'wb-table' }, h('thead', {}, h('tr', {}, h('th', { text: L('原子', 'Atom') }), h('th', { text: L('电荷', 'Charge') }))),
          h('tbody', {}, q.map((v, i) => h('tr', {}, h('td', { text: ok ? `${fr.atoms[i].el}${i + 1}` : String(i + 1) }), h('td', { text: v.toFixed(4) })))))),
          h('p', { class: 'wb-small', text: L(`总和 ${q.reduce((s, v) => s + v, 0).toFixed(4)}`, `Sum ${q.reduce((s, v) => s + v, 0).toFixed(4)}`) }));
      };
      qs.addEventListener('change', fill); fill();
      secQ.append(h('h3', { class: 'wb-h3', text: L('原子电荷', 'Atomic charges') }), h('div', { class: 'wb-row' }, field(L('哪一种', 'Which'), qs, 'm'),
        btn(L('按电荷给原子着色', 'Colour atoms by charge'), () => {
          const q = out.charges[Number(qs.value)].q, fr = current();
          if (!fr || fr.atoms.length !== q.length) { status(st, L('查看器里的结构和电荷的原子数对不上。', 'The structure in the viewer and the charges have different atom counts.'), 'bad'); return; }
          const s = Math.max(...q.map(Math.abs)) || 1;
          S.tint = q.map((v) => { const t = Math.max(-1, Math.min(1, v / s)), c = Math.round(255 * (1 - Math.abs(t))); return t < 0 ? `rgb(255,${c},${c})` : `rgb(${c},${c},255)`; });
          view.restyle();
        }, 'small'),
        btn(L('画近似静电势', 'Draw the approximate ESP'), () => { emit('output', out.text, out.name, out.program); ctx.show('wfn'); }, 'small'),
        btn(L('下载（CSV）', 'Download (CSV)'), () => download(`${out.name}_charges.csv`, csv([['atom', out.charges[0].q.map((_, i) => i + 1)], ...out.charges.map((c) => [c.kind, c.q])])), 'small')), tb,
        h('p', { class: 'wb-small', text: L('Mulliken 和 Löwdin 电荷随基组变化很大，加了弥散函数时尤其不可靠；比较不同分子时用 CHELPG、ESP 或 Hirshfeld 一类电荷更稳妥。', 'Mulliken and Löwdin charges depend strongly on the basis set and are unreliable with diffuse functions; for comparing molecules, CHELPG, ESP or Hirshfeld-type charges are safer.') }));
    }

    const SAMPLES = [
      ['dvb-raman-g16.out', L('二乙烯基苯：Gaussian 16 频率和拉曼', 'Divinylbenzene: Gaussian 16 frequencies + Raman')],
      ['dvb-td-g16.out', L('二乙烯基苯：Gaussian 16 TD-DFT', 'Divinylbenzene: Gaussian 16 TD-DFT')],
      ['dvb-opt-g16.out', L('二乙烯基苯：Gaussian 16 优化', 'Divinylbenzene: Gaussian 16 optimisation')],
      ['dvb-raman-orca5.out', L('二乙烯基苯：ORCA 5 频率和拉曼', 'Divinylbenzene: ORCA 5 frequencies + Raman')],
    ];
    panel.append(card(L('读程序输出：光谱、轨道、收敛和电荷', 'Program outputs: spectra, orbitals, convergence and charges'),
      h('p', { class: 'wb-p', text: L('读 Gaussian（.log / .out）、ORCA、xTB、Psi4、PySCF、NWChem、CP2K、Q-Chem 的输出。频率计算出红外和拉曼，TD-DFT 出紫外，优化出收敛曲线和每一步的结构，Gaussian 和 ORCA 还读轨道能级和原子电荷。文件只在你的浏览器里读，不会上传。', 'Reads outputs from Gaussian (.log / .out), ORCA, xTB, Psi4, PySCF, NWChem, CP2K and Q-Chem. Frequency jobs give IR and Raman, TD-DFT gives UV–vis, optimisations give the convergence history and every geometry; Gaussian and ORCA outputs also give orbital energies and atomic charges. Files are read in your browser and never uploaded.') }),
      fileBox({ accept: '.log,.out,.txt', paste: true, onText: (t, n) => (t == null ? status(st, L('读不出来。', 'Could not read it.'), 'bad') : take(t, n)), hint: L('输出文件', 'Output file') }),
      h('div', { class: 'wb-row' }, h('span', { class: 'wb-small', text: L('示例（cclib 的测试数据，BSD 许可）：', 'Samples (cclib test data, BSD licence): ') }),
        ...SAMPLES.map(([f, label]) => btn(label, async () => {
          try { const t = await (await fetch(`samples/${f}`)).text(); out = null; take(t, f); } catch { status(st, L('示例载入失败。', 'The sample failed to load.'), 'bad'); }
        }, 'small'))),
      st, sum, secIr, secRa, secUv, secOrb, secConv, secQ));
  } });

  // ── 批量作业 ─────────────────────────────────────────────────────────
  TABS.push({ id: 'batch', n: 7, zh: '批量作业', en: 'Batch jobs', build(ctx, panel) {
    const { h, L, btn, field, sel, numIn, check, card, status, val, C, S, on, use, filesView, pre } = ctx;
    const Code = window.MolAstriaCode;
    if (!Code) { panel.append(card(L('批量作业', 'Batch jobs'), h('p', { class: 'wb-status', 'data-bad': 'true', text: L('开源代码台的输入生成没有载入。', 'The Code Desk input generator did not load.') }))); return; }
    const TASK_EN = { sp: 'Single point', opt: 'Optimisation', freq: 'Frequencies', optfreq: 'Optimisation + frequencies' };
    const XTB = (m) => Code.METHODS[m]?.kind === 'xtb';
    const progSel = sel(Code.PROGRAMS.map(([id, n]) => [id, n]), 'orca', { 'aria-label': L('程序', 'Program') });
    const methSel = sel([], '', { 'aria-label': L('方法', 'Method') });
    const basSel = sel(Code.BASES.map((b) => [b, Code.BASIS_NAME.pretty[b] || b]), 'def2-svp', { 'aria-label': L('基组', 'Basis set') });
    const taskSel = sel(Code.TASKS.map((t) => [t, L(Code.TASK_LABEL[t], TASK_EN[t])]), 'opt', { 'aria-label': L('任务', 'Task') });
    const solv = check(L('隐式溶剂：水', 'Implicit solvent: water'), false);
    const d3 = check(L('D3 色散校正', 'D3 dispersion'), true);
    function methods() {
      const p = progSel.value, keep = methSel.value;
      const list = Object.keys(Code.METHODS).filter((m) => (p === 'xtb' || p === 'crest' ? XTB(m) : !XTB(m) || p === 'orca'));
      methSel.replaceChildren(...list.map((m) => h('option', { value: m, text: m })));
      methSel.value = list.includes(keep) ? keep : list.includes('B3LYP') ? 'B3LYP' : list[0];
      basSel.disabled = XTB(methSel.value);
    }
    progSel.addEventListener('change', methods); methSel.addEventListener('change', () => { basSel.disabled = XTB(methSel.value); });
    methods();

    const which = sel([['all', L('全部帧', 'All frames')], ['cur', L('只有当前帧', 'The current frame only')], ['list', L('指定的帧', 'Chosen frames')]], 'all', { 'aria-label': L('哪些帧', 'Which frames') });
    const listIn = h('input', { type: 'text', value: '1-3', spellcheck: 'false', 'aria-label': L('帧号，比如 1-3,5', 'Frame numbers, e.g. 1-3,5') });
    const listField = field(L('帧号', 'Frame numbers'), listIn, 's');
    listField.hidden = true;
    which.addEventListener('change', () => { listField.hidden = which.value !== 'list'; });
    const prefix = h('input', { type: 'text', value: '', spellcheck: 'false', placeholder: L('默认用结构名', 'Defaults to the structure name'), 'aria-label': L('文件名前缀', 'File name prefix') });
    const schedSel = sel([['slurm', 'Slurm'], ['pbs', 'PBS'], ['bash', L('bash（依次运行）', 'bash (one after another)')], ['bat', L('Windows .bat（依次运行）', 'Windows .bat (one after another)')], ['none', L('不要脚本', 'No script')]], 'slurm', { 'aria-label': L('调度系统', 'Scheduler') });
    const cores = numIn(8, { min: 1, max: 256, step: 1 }), mem = numIn(16, { min: 1, max: 2048, step: 1 }), hours = numIn(24, { min: 1, max: 720, step: 1 });
    const part = h('input', { type: 'text', spellcheck: 'false', placeholder: L('可不填', 'optional'), 'aria-label': L('分区或队列', 'Partition or queue') });
    const acct = h('input', { type: 'text', spellcheck: 'false', placeholder: L('可不填', 'optional'), 'aria-label': L('账户', 'Account') });
    const modIn = h('input', { type: 'text', spellcheck: 'false', placeholder: L('默认按程序名，写 none 不加', 'defaults to the program name; none to skip'), 'aria-label': 'module load' });
    const countEl = h('p', { class: 'wb-small' }), st = h('p', { class: 'wb-status' }), outEl = h('div', {});
    const count = () => { countEl.textContent = S.frames.length ? L(`当前结构“${S.name}”有 ${S.frames.length} 帧（电荷 ${S.charge}，多重度 ${S.mult}）。构象页留下的代表构象、扫描或路径上的各点都会是这里的帧。`, `The current structure “${S.name}” has ${S.frames.length} frame${S.frames.length > 1 ? 's' : ''} (charge ${S.charge}, multiplicity ${S.mult}). Representative conformers, scan points and path images all arrive here as frames.`) : L('还没有结构。', 'No structure yet.'); };
    on('frames', count); on('meta', count); count();

    /** “1-3,5” → [0,1,2,4]（从 0 开始，去重排序，超出范围的丢掉）。 */
    function parseList(s, n) {
      const out = new Set();
      for (const part of String(s).split(/[,，\s]+/).filter(Boolean)) {
        const m = /^(\d+)(?:-(\d+))?$/.exec(part);
        if (!m) return null;
        const a = Number(m[1]), b = Number(m[2] || m[1]);
        for (let k = Math.min(a, b); k <= Math.max(a, b) && k - Math.min(a, b) < 10000; k++) if (k >= 1 && k <= n) out.add(k - 1);
      }
      return [...out].sort((a, b) => a - b);
    }
    /** 把生成的输入里写死的核数和内存改成脚本里申请的（留 20–25 % 给程序自己）。 */
    function fit(prog, text, nc, memGB) {
      const mb = Math.max(500, Math.floor((memGB * 1024 * 0.75) / nc));
      if (prog === 'orca') return text.replace(/%pal nprocs \d+ end/, `%pal nprocs ${nc} end`).replace(/%maxcore \d+/, `%maxcore ${mb}`);
      if (prog === 'gaussian') return text.replace(/%nprocshared=\d+/, `%nprocshared=${nc}`).replace(/%mem=\d+GB/, `%mem=${Math.max(1, Math.floor(memGB * 0.8))}GB`);
      if (prog === 'psi4') return text.replace(/^memory \d+ GB/m, `memory ${Math.max(1, Math.floor(memGB * 0.8))} GB`);
      if (prog === 'nwchem') return text.replace(/^memory total \d+ mb/m, `memory total ${Math.max(500, Math.floor((memGB * 1024 * 0.8) / nc))} mb`);
      return text;
    }
    function generate() {
      if (!S.frames.length) { status(st, L('先载入一个结构。', 'Load a structure first.'), 'bad'); return; }
      const idx = which.value === 'all' ? S.frames.map((_, k) => k) : which.value === 'cur' ? [S.frame] : parseList(listIn.value, S.frames.length);
      if (!idx || !idx.length) { status(st, L('帧号写得不对，或者都超出了范围（写成 1-3,5 这样）。', 'The frame numbers are invalid or all out of range (write them like 1-3,5).'), 'bad'); return; }
      if (idx.length > 500) { status(st, L('一次最多 500 帧。', 'At most 500 frames at a time.'), 'bad'); return; }
      const prog = progSel.value, base = ctx.safeName(prefix.value.trim() || S.name || 'mol');
      const pad = String(S.frames.length).length;
      const files = [], commands = [], notes = new Set();
      const nc = Math.round(val(cores, 8));
      for (const k of idx) {
        const name = idx.length === 1 && which.value === 'cur' ? base : `${base}_${String(k + 1).padStart(pad, '0')}`;
        const g = Code.generate(prog, S.frames[k].atoms, { charge: S.charge, mult: S.mult, method: methSel.value, basis: basSel.value, task: taskSel.value, solvent: solv.firstChild.checked ? 'water' : '', d3: d3.firstChild.checked, name });
        if (!g.supported) { status(st, tr((g.notes && g.notes[0]) || '这个组合写不出输入。'), 'bad'); return; }
        files.push({ name: g.filename, text: fit(prog, g.text, nc, val(mem, 16)) });
        for (const n of g.notes || []) notes.add(tr(n));
        const stem = g.filename.replace(/\.[\w]+$/, '');
        commands.push(prog === 'xtb' ? `${g.run} -P ${nc} > ${stem}.out` : prog === 'crest' ? `${g.run.replace(/-T \d+/, `-T ${nc}`)} > ${stem}_crest.out` : '');
      }
      const sched = schedSel.value;
      let script = null;
      if (sched !== 'none' && prog !== 'qcschema') {
        const mod = modIn.value.trim();
        const text = C.jobScript({ scheduler: sched, program: prog, files: files.map((f) => f.name), commands: commands.some(Boolean) ? commands : null, cores: nc, memGB: val(mem, 16), hours: val(hours, 24), partition: part.value.trim(), account: acct.value.trim(), name: base, module: mod.toLowerCase() === 'none' ? false : mod || undefined });
        script = { name: sched === 'slurm' ? `${base}.slurm` : sched === 'pbs' ? `${base}.pbs` : sched === 'bat' ? `run_${base}.bat` : `run_${base}.sh`, text };
      }
      if (prog === 'qcschema') notes.add(L('QCSchema 是给 QCEngine 一类工具读的 JSON，不写作业脚本。', 'QCSchema is JSON for tools such as QCEngine; no job script is written.'));
      if (XTB(methSel.value)) use(methSel.value === 'GFN2-xTB' ? 'gfn2' : methSel.value === 'GFN1-xTB' ? 'gfn1' : 'gfnff');
      if (prog === 'crest') use('crest');
      if (prog === 'pyscf') use('pyscf');
      if (solv.firstChild.checked && (prog === 'xtb' || prog === 'crest')) use('alpb');
      const all = script ? [...files, script] : files;
      const submit = !script ? '' : sched === 'slurm' ? `sbatch ${script.name}` : sched === 'pbs' ? `qsub ${script.name}` : sched === 'bat' ? script.name : `bash ${script.name}`;
      outEl.replaceChildren(...[
        submit ? h('div', {}, h('p', { class: 'wb-small', text: L('把 zip 解压到集群上的一个目录里，然后运行：', 'Unzip into a directory on the cluster, then run:') }), pre(submit)) : null,
        notes.size ? h('ul', { class: 'wb-notes' }, [...notes].map((n) => h('li', { text: n }))) : null,
        filesView(all, `${base}_${prog}_${files.length}.zip`)].filter(Boolean));
      status(st, L(`写好了 ${files.length} 份 ${Code.PROGRAMS.find((p) => p[0] === prog)[1]} 输入${script ? '和一个作业脚本' : ''}。`, `Wrote ${files.length} ${Code.PROGRAMS.find((p) => p[0] === prog)[1]} input${files.length > 1 ? 's' : ''}${script ? ' and a job script' : ''}.`));
    }

    panel.append(card(L('每一帧写一份输入，加一个作业脚本', 'One input per frame, plus a job script'),
      h('p', { class: 'wb-p', text: L('输入由开源代码台的生成器写（和代码台写的一样），电荷和多重度取查看器下面填的。Slurm 和 PBS 写成作业数组，一帧一个任务，可以同时跑；bash 和 .bat 一个接一个跑。CREST 每个任务在自己的子目录里跑，免得输出互相覆盖。', 'Inputs come from the Code Desk generator (the same files it writes), with the charge and multiplicity set under the viewer. Slurm and PBS scripts are job arrays, one task per frame, so they can run side by side; bash and .bat scripts run one after another. Each CREST task runs in its own subdirectory so the outputs do not overwrite each other.') }),
      countEl,
      h('div', { class: 'wb-row' }, field(L('程序', 'Program'), progSel, 's'), field(L('方法', 'Method'), methSel, 's'), field(L('基组', 'Basis set'), basSel, 's'), field(L('任务', 'Task'), taskSel, 'm')),
      h('div', { class: 'wb-row' }, solv, d3),
      h('div', { class: 'wb-row' }, field(L('哪些帧', 'Which frames'), which, 'm'), listField, field(L('文件名前缀', 'File name prefix'), prefix, 'm')),
      h('h3', { class: 'wb-h3', text: L('作业脚本', 'Job script') }),
      h('div', { class: 'wb-row' }, field(L('调度系统', 'Scheduler'), schedSel, 'm'), field(L('核数', 'Cores'), cores, 'n'), field(L('内存（GB）', 'Memory (GB)'), mem, 'n'), field(L('时长（小时）', 'Wall time (h)'), hours, 'n')),
      h('div', { class: 'wb-row' }, field(L('分区或队列', 'Partition or queue'), part, 's'), field(L('账户', 'Account'), acct, 's'), field('module load', modIn, 'm')),
      h('div', { class: 'wb-row' }, btn(L('写输入和脚本', 'Write the inputs and script'), generate, 'primary')),
      st, outEl,
      h('p', { class: 'wb-small', text: L('脚本里的 module 名字、Gaussian 的命令（g16）和临时目录按常见的集群写的，提交前对照你们集群的说明改一下。核数和内存已经按上面的设置改进了输入（ORCA 的 %pal 和 %maxcore、Gaussian 的 %nprocshared 和 %mem、Psi4 和 NWChem 的 memory），给程序留了两成余量。', 'Module names, the Gaussian command (g16) and the scratch directory follow common cluster setups; check them against your cluster’s documentation before submitting. Cores and memory set above are written into the inputs too (ORCA %pal and %maxcore, Gaussian %nprocshared and %mem, the Psi4 and NWChem memory lines), with about a fifth held back for the program.') })));
  } });
})();
