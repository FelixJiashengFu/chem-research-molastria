/* 计算工作台 · “反应路径”和“构象”两个标签。往 window.MOLASTRIA_WB_TABS 里登记，由 workbench.js 画出来（ctx 见那边的注释）。
   反应路径：用查看器里量好的内坐标写受限优化、扫描、过渡态、IRC、NEB / QST2 的输入（xTB、ORCA、Gaussian）；检查两端的原子对应、
   生成 IDPP 初始路径；读回结果（多帧 XYZ、ORCA 的 NEB / IRC / 扫描表、Gaussian 的 IRC / 扫描）画能量曲线，点曲线上的点看那一帧。
   构象：从 SMILES 用 OpenChemLib + MMFF94s+ 生成一批构象，或读入别处的系综（CREST 等），按 RMSD 归簇、算 Boltzmann 布居和加权平均的内坐标。 */
(function () {
  'use strict';
  const TABS = (window.MOLASTRIA_WB_TABS = window.MOLASTRIA_WB_TABS || []);

  TABS.push({ id: 'path', n: 3, zh: '反应路径', en: 'Reaction path', build(ctx, panel) {
    const { h, L, btn, field, sel, numIn, check, card, status, val, WB, C, S, on, current, setFrames, setFrame, use, plot, csv, download, fileBox, filesView, errText } = ctx;
    const NOTE = {
      'need-scan': ['扫描要在下面的内坐标里把一个标成“扫描”。', 'A scan needs one of the coordinates below marked “Scan”.'],
      'need-product': ['NEB / QST2 要有终点结构（见“终点”）。', 'NEB / QST2 needs a product structure (see “Product”).'],
      'xtb-no-ts': ['xTB 自己不找过渡态，也不做 IRC：用 ORCA（方法可以选 XTB2）或 Gaussian。', 'xTB does not optimise transition states or run IRCs by itself: use ORCA (XTB2 is available as a method) or Gaussian.'],
      'xtb-path': ['xtb --path 是 RMSD 偏置的路径搜索（Grimme 等的方法），结果写在 xtbpath_*.xyz；最高点只是过渡态的近似，再用 ORCA 或 Gaussian 精修。', 'xtb --path runs an RMSD-biased path search (Grimme and co-workers); results go to xtbpath_*.xyz. The highest point only approximates the transition state, so refine it with ORCA or Gaussian.'],
      'nothing-to-constrain': ['受限优化至少要一个约束或一个冻结的原子。', 'A constrained optimisation needs at least one constraint or frozen atom.'],
      'xtb-scan-log': ['扫描的每一步结构和能量写在 xtbscan.log（多帧 XYZ，注释行带能量），读回下面就能画曲线。', 'Every scan step’s geometry and energy goes to xtbscan.log (multi-frame XYZ with energies on the comment lines); read it back below for the profile.'],
      'solvent-skipped': ['这个溶剂不在这个程序的隐式溶剂表里，略过了。', 'This solvent is not in the program’s implicit-solvent list, so it was left out.'],
      'irc-from-ts': ['IRC 要从优化好的过渡态出发（先跑“过渡态”，再用它的结构）。', 'An IRC must start from an optimised transition state (run “Transition state” first and use its geometry).'],
      'neb-same-order': ['两端的原子顺序必须一样，先用下面的“检查两端”。', 'Both ends must list the atoms in the same order; use “Check the two ends” below first.'],
      'orca-relaxscan': ['ORCA 把扫描能量写在 *.relaxscanact.dat，结构在 *_trj.xyz；输出里的 “The Calculated Surface” 表也能直接读回来。', 'ORCA writes scan energies to *.relaxscanact.dat and geometries to *_trj.xyz; the “The Calculated Surface” table in the output can be read back directly.'],
      qst2: ['Gaussian 的 QST2 从反应物和产物两端找过渡态，两端的原子顺序必须一样。', 'Gaussian’s QST2 searches a transition state from reactant and product; both must list atoms in the same order.'],
      program: ['这个程序不支持。', 'This program is not supported.'],
    };
    const noteText = (n) => {
      if (n.startsWith('gaussian-scan-starts-at-current:')) { const v = n.split(':')[1]; return L(`Gaussian 的扫描从当前几何的值开始（现在是 ${v}），“起点”只用来算步长；想从别处开始，先把结构调到那里。`, `A Gaussian scan starts from the current geometry’s value (now ${v}); “From” only sets the step size. To start elsewhere, move the structure there first.`); }
      if (n.startsWith('bad-coords:')) return L(`内坐标的定义有问题（${n.slice(11)}）：原子个数不对、编号超出范围或重复。`, `A coordinate definition is wrong (${n.slice(11)}): wrong atom count, index out of range or repeated.`);
      return NOTE[n] ? L(...NOTE[n]) : n;
    };

    // ── 写输入 ─────────────────────────────────────────────────────────
    const progSel = sel([['orca', 'ORCA'], ['gaussian', 'Gaussian'], ['xtb', 'xTB']], 'orca', { 'aria-label': L('程序', 'Program') });
    const taskSel = sel([['constrain', L('受限优化', 'Constrained optimisation')], ['scan', L('弛豫扫描', 'Relaxed scan')], ['ts', L('过渡态优化', 'Transition-state optimisation')], ['irc', 'IRC'], ['neb', L('NEB（ORCA、xTB）/ QST2（Gaussian）', 'NEB (ORCA, xTB) / QST2 (Gaussian)')]], 'scan', { 'aria-label': L('任务', 'Task') });
    const METHODS = { orca: ['B3LYP', 'PBE0', 'BP86', 'TPSSh', 'HF', 'XTB2'], gaussian: ['B3LYP', 'PBE1PBE', 'M062X', 'HF'], xtb: ['GFN2-xTB', 'GFN1-xTB', 'GFN-FF'] };
    const methSel = sel([], '', { 'aria-label': L('方法', 'Method') });
    const basSel = sel([['def2-svp', 'def2-SVP'], ['def2-tzvp', 'def2-TZVP'], ['6-31g*', '6-31G*'], ['cc-pvdz', 'cc-pVDZ'], ['sto-3g', 'STO-3G']], 'def2-svp', { 'aria-label': L('基组', 'Basis') });
    const PRETTY = { 'def2-svp': 'def2-SVP', 'def2-tzvp': 'def2-TZVP', '6-31g*': '6-31G*', 'cc-pvdz': 'cc-pVDZ', 'sto-3g': 'STO-3G' };
    const solvSel = sel([['', L('气相', 'Gas phase')], ...C.ALPB.map(([n, e]) => [n, `${n} (ε ${e})`])], '', { 'aria-label': L('溶剂', 'Solvent') });
    const d3Box = check(L('D3(BJ) 色散', 'D3(BJ) dispersion'), true, () => {});
    const coresIn = numIn(8, { min: 1, max: 256, step: 1 }), memIn = numIn(16, { min: 1, max: 2048, step: 1 }), imgIn = numIn(8, { min: 3, max: 30, step: 1 }), ircIn = numIn(30, { min: 5, max: 200, step: 1 });
    const fillMethods = () => {
      const p = progSel.value;
      methSel.replaceChildren(...METHODS[p].map((m) => h('option', { value: m, text: m })));
      basSel.disabled = p === 'xtb'; d3Box.querySelector('input').disabled = p === 'xtb';
    };
    progSel.addEventListener('change', () => { fillMethods(); renderCoords(); });
    fillMethods();
    const coordBox = h('div', {});
    const role = new Map(); // 内坐标在 S.measures 里的下标 → { role: '' | 'fix' | 'scan', value, from, to, steps }
    function renderCoords() {
      const fr = current();
      const rows = S.measures.map((m, k) => {
        const r = fr && m.picks.every((i) => fr.atoms[i]) ? WB.measure(fr.atoms, m.picks, fr.cell) : null;
        const st = role.get(k) || { role: '', value: '', from: r ? +r.value.toFixed(3) : 0, to: r ? +(r.value + (m.type === 'bond' ? 1 : 120)).toFixed(3) : 0, steps: 12 };
        role.set(k, st);
        const lab = fr ? m.picks.map((i) => `${fr.atoms[i]?.el || '?'}${i + 1}`).join('–') : '';
        const name = { bond: L('距离', 'Distance'), angle: L('键角', 'Angle'), dihedral: L('二面角', 'Dihedral') }[m.type];
        const rs = sel([['', L('不用', 'Unused')], ['fix', L('约束', 'Constrain')], ['scan', L('扫描', 'Scan')]], st.role, { 'aria-label': L('用法', 'Role') });
        const vIn = numIn(st.value, { attrs: { placeholder: r ? r.value.toFixed(3) : '', 'aria-label': L('约束到', 'Constrain to') } });
        const fIn = numIn(st.from), tIn = numIn(st.to), nIn = numIn(st.steps, { min: 2, max: 200, step: 1 });
        const sync = () => { st.role = rs.value; st.value = vIn.value; st.from = val(fIn); st.to = val(tIn); st.steps = Math.round(val(nIn, 12)); fixBox.hidden = st.role !== 'fix'; scanBox.hidden = st.role !== 'scan'; };
        const fixBox = h('span', { class: 'wb-row', style: 'margin:0' }, field(L('约束到（空着就是现值）', 'Value (blank = current)'), vIn, 's'));
        const scanBox = h('span', { class: 'wb-row', style: 'margin:0' }, field(L('起点', 'From'), fIn, 'n'), field(L('终点', 'To'), tIn, 'n'), field(L('步数', 'Steps'), nIn, 'n'));
        for (const el of [rs, vIn, fIn, tIn, nIn]) el.addEventListener('change', sync);
        sync();
        return h('li', {}, h('span', { text: `${name} ${lab}` }), h('b', { text: r ? `${r.value.toFixed(m.type === 'bond' ? 3 : 1)} ${r.unit}` : '' }), rs, fixBox, scanBox);
      });
      coordBox.replaceChildren(rows.length ? h('ul', { class: 'wb-list' }, rows) : h('p', { class: 'wb-small', text: L('还没有内坐标。在查看器里选“测量”，点 2–4 个原子，按“记下”，它就出现在这里。', 'No coordinates yet. Choose “Measure” in the viewer, click 2–4 atoms and press “Keep”; it shows up here.') }));
      const fz = fr ? fr.atoms.map((a, i) => (a.frozen ? i + 1 : 0)).filter(Boolean) : [];
      frozenLine.textContent = fz.length ? L(`冻结的原子：${C.ranges(fz)}（在查看器里用“冻结”改）`, `Frozen atoms: ${C.ranges(fz)} (change with “Freeze” in the viewer)`) : L('没有冻结的原子（在查看器里用“冻结”点选）。', 'No frozen atoms (click them with “Freeze” in the viewer).');
    }
    const frozenLine = h('p', { class: 'wb-small' });
    on('measures', () => { role.clear(); renderCoords(); });
    for (const k of ['frames', 'frame', 'edit']) on(k, renderCoords);

    // 终点
    let product = null, productName = '';
    const prodSel = sel([], '', { 'aria-label': L('终点结构', 'Product structure') });
    const prodSt = h('p', { class: 'wb-status' });
    function fillProducts() {
      const keep = prodSel.value;
      const opts = [['', L('没有终点', 'No product')]];
      S.frames.forEach((f, k) => { if (k !== S.frame) opts.push([`f${k}`, L(`当前结构的第 ${k + 1} 帧${f.comment ? `（${f.comment.slice(0, 30)}）` : ''}`, `Frame ${k + 1} of the current structure${f.comment ? ` (${f.comment.slice(0, 30)})` : ''}`)]); });
      if (product) opts.push(['file', L(`读入的文件：${productName}`, `Loaded file: ${productName}`)]);
      prodSel.replaceChildren(...opts.map(([v, t]) => h('option', { value: v, text: t })));
      prodSel.value = opts.some(([v]) => v === keep) ? keep : product ? 'file' : S.frames.length > 1 ? `f${S.frame === S.frames.length - 1 ? 0 : S.frames.length - 1}` : '';
    }
    const productAtoms = () => {
      const v = prodSel.value;
      if (v === 'file') return product;
      if (v.startsWith('f')) return S.frames[Number(v.slice(1))]?.atoms || null;
      return null;
    };
    for (const k of ['frames', 'frame']) on(k, fillProducts);
    const prodFile = fileBox({ accept: '.xyz,.pdb,.mol,.sdf,.gjf,.com,.inp,.log,.out', title: L('另外读入终点结构', 'Load a separate product structure'), paste: true, onText: async (t, name) => {
      if (t == null) { status(prodSt, L('读不出来。', 'Could not read it.'), 'bad'); return; }
      try { const r = await ctx.readAny(t, name); product = r.frames[r.frames.length - 1].atoms; productName = name || L('粘贴的结构', 'pasted structure'); fillProducts(); prodSel.value = 'file'; status(prodSt, L(`终点：${product.length} 个原子。`, `Product: ${product.length} atoms.`)); } catch (e) { status(prodSt, errText(e), 'bad'); }
    } });

    const out = h('div', {});
    const genSt = h('p', { class: 'wb-status' });
    function generate() {
      const fr = current();
      if (!fr) { status(genSt, L('先载入一个结构。', 'Load a structure first.'), 'bad'); return; }
      const cons = [], scans = [];
      S.measures.forEach((m, k) => {
        const st = role.get(k);
        if (!st || !st.role) return;
        const atoms = m.picks.map((i) => i + 1);
        if (st.role === 'fix') cons.push({ type: m.type, atoms, value: st.value === '' ? undefined : Number(st.value) });
        else scans.push({ type: m.type, atoms, from: st.from, to: st.to, steps: st.steps });
      });
      const p = progSel.value, task = taskSel.value;
      const frozen = fr.atoms.map((a, i) => (a.frozen ? i + 1 : 0)).filter(Boolean);
      const prod = productAtoms();
      const r = C.pathInput(p, task, fr.atoms, {
        charge: S.charge, mult: S.mult, method: methSel.value, basis: p === 'orca' ? PRETTY[basSel.value] : basSel.value, solvent: solvSel.value, d3: d3Box.querySelector('input').checked,
        cores: Math.round(val(coresIn, 8)), mem: Math.round(val(memIn, 16)), name: S.name, constraints: cons, scan: task === 'scan' ? scans[0] : undefined, frozen,
        product: task === 'neb' ? prod : undefined, images: Math.round(val(imgIn, 8)), ircPoints: Math.round(val(ircIn, 30)), guess: task === 'neb' && guess ? guess : undefined,
      });
      const notes = r.notes.map(noteText);
      if (task === 'scan' && scans.length > 1) notes.unshift(L('标了不止一个“扫描”，只用第一个。', 'More than one coordinate is marked “Scan”; only the first is used.'));
      if (task !== 'scan' && scans.length) notes.unshift(L('这个任务不扫描，标成“扫描”的内坐标没有用上。', 'This task does not scan, so the coordinates marked “Scan” were not used.'));
      if (task === 'neb' && prod && prod.length !== fr.atoms.length) { status(genSt, L('两端原子数不一样。', 'The two ends have different atom counts.'), 'bad'); out.replaceChildren(); return; }
      if (!r.supported) { status(genSt, notes.join(' '), 'bad'); out.replaceChildren(); return; }
      use(...(p === 'xtb' || methSel.value === 'XTB2' ? ['gfn2'] : []), ...(solvSel.value && (p === 'xtb' || methSel.value === 'XTB2') ? ['alpb'] : []), ...(task === 'neb' ? ['cineb'] : []), ...(task === 'irc' ? ['irc'] : []), ...(guess && task === 'neb' ? ['idpp'] : []));
      status(genSt, L('写好了。把这些文件放进同一个文件夹，运行下面的命令（或者到“批量与作业”页写集群脚本）。', 'Done. Put these files in one folder and run the command below (or write a cluster script on the “Batch & jobs” tab).'));
      out.replaceChildren(...[filesView(r.files, `${S.name}_${task}.zip`), h('p', { class: 'wb-small', text: L('运行：', 'Run:') }), ctx.pre(r.run), notes.length ? h('ul', { class: 'wb-notes' }, notes.map((n) => h('li', { text: n }))) : null].filter(Boolean));
    }
    panel.append(card(L('写路径计算的输入', 'Write a path calculation'),
      h('p', { class: 'wb-p', text: L('用查看器里量好的内坐标当约束或扫描坐标，冻结的原子直接带上；终点结构用于 NEB 和 QST2。生成的是输入文件，计算要在装了这些程序的电脑或集群上跑。', 'Kept measurements become constraints or scan coordinates, frozen atoms are carried over, and the product structure is used for NEB and QST2. This writes input files; the calculations run on a computer or cluster with these programs.') }),
      h('div', { class: 'wb-row' }, field(L('程序', 'Program'), progSel, 's'), field(L('任务', 'Task'), taskSel, 'grow')),
      h('div', { class: 'wb-row' }, field(L('方法', 'Method'), methSel, 's'), field(L('基组', 'Basis'), basSel, 's'), field(L('溶剂', 'Solvent'), solvSel, 's'), d3Box),
      h('div', { class: 'wb-row' }, field(L('核数', 'Cores'), coresIn, 'n'), field(L('内存（GB）', 'Memory (GB)'), memIn, 'n'), field(L('NEB 像数', 'NEB images'), imgIn, 'n'), field(L('IRC 点数', 'IRC points'), ircIn, 'n')),
      h('h3', { class: 'wb-h3', text: L('内坐标', 'Coordinates') }), coordBox, frozenLine,
      h('h3', { class: 'wb-h3', text: L('终点（NEB / QST2）', 'Product (NEB / QST2)') }), h('div', { class: 'wb-row' }, field(L('终点结构', 'Product structure'), prodSel, 'grow')), h('div', { style: 'margin-top:8px' }, prodFile), prodSt,
      h('div', { class: 'wb-row' }, btn(L('写输入', 'Write inputs'), generate, 'primary')), genSt, out));

    // ── 端点检查和 IDPP ───────────────────────────────────────────────
    let guess = null;
    const idImg = numIn(8, { min: 1, max: 30, step: 1 });
    const mapSt = h('p', { class: 'wb-status' }), idSt = h('p', { class: 'wb-status' });
    const idOut = h('div', {});
    panel.append(card(L('检查两端，生成初始路径', 'Check the ends and build a starting path'),
      h('p', { class: 'wb-p', text: L('NEB 和 QST2 要求两端的原子一一对应。这里按元素找最优对应（叠合后用匈牙利算法），再用 IDPP（Smidstrup 等 2014）生成中间的像：让每个像的原子间距接近两端距离的线性插值，比直接线性插值少很多原子相撞。', 'NEB and QST2 need the two ends to list atoms in corresponding order. This finds the best element-wise mapping (superposition plus the Hungarian algorithm), then builds the images with IDPP (Smidstrup et al. 2014), which makes each image’s interatomic distances close to an interpolation of the end-point distances and avoids most of the atom clashes of a straight linear interpolation.') }),
      h('div', { class: 'wb-row' },
        btn(L('检查两端', 'Check the two ends'), () => {
          const fr = current(), B = productAtoms();
          if (!fr || !B) { status(mapSt, L('先选一个终点结构（上面的“终点”）。', 'Pick a product structure first (“Product” above).'), 'bad'); return; }
          const m = WB.mapAtoms(fr.atoms, B);
          use('kabsch', 'horn');
          if (!m.ok) { status(mapSt, m.why === 'count' ? L(`两端原子数不一样（${fr.atoms.length} 和 ${B.length}）。`, `The ends have different atom counts (${fr.atoms.length} and ${B.length}).`) : L('两端的元素组成不一样。', 'The two ends have different compositions.'), 'bad'); return; }
          const direct = WB.superpose(fr.atoms.map((a) => [a.x, a.y, a.z]), B.map((a) => [a.x, a.y, a.z])).rmsd;
          status(mapSt, m.changed ? L(`顺序对不上：按最优对应重排后 RMSD ${m.rmsd.toFixed(3)} Å（照原顺序是 ${direct.toFixed(3)} Å）。按“按最优对应重排终点”改过来。`, `The order does not match: after the best remapping the RMSD is ${m.rmsd.toFixed(3)} Å (${direct.toFixed(3)} Å in the given order). Press “Reorder the product” to fix it.`) : L(`顺序对得上，叠合后 RMSD ${m.rmsd.toFixed(3)} Å。`, `The order matches; RMSD after superposition ${m.rmsd.toFixed(3)} Å.`), m.changed ? 'warn' : '');
          reorder.hidden = !m.changed; reorder.order = m.order;
        }),
        Object.assign(btn(L('按最优对应重排终点', 'Reorder the product'), () => {
          const B = productAtoms(); if (!B || !reorder.order) return;
          const nb = reorder.order.map((j) => ({ ...B[j] }));
          product = nb; productName = L('重排后的终点', 'reordered product'); fillProducts(); prodSel.value = 'file'; reorder.hidden = true;
          status(mapSt, L('重排好了：终点改用重排后的结构（“读入的文件”那一项）。', 'Reordered: the product is now the reordered structure (the “Loaded file” entry).'));
        }), { hidden: true })),
      mapSt,
      h('div', { class: 'wb-row' }, field(L('中间像的个数', 'Intermediate images'), idImg, 'n'), btn(L('生成 IDPP 路径', 'Build the IDPP path'), () => {
        const fr = current(), B = productAtoms();
        const nImg = Math.max(1, Math.min(30, Math.round(val(idImg, 8))));
        if (!fr || !B) { status(idSt, L('先选一个终点结构。', 'Pick a product structure first.'), 'bad'); return; }
        if (B.length !== fr.atoms.length || B.some((a, i) => a.el !== fr.atoms[i].el)) { status(idSt, L('两端的原子顺序不一样，先“检查两端”并重排。', 'The ends list atoms in different orders; check and reorder them first.'), 'bad'); return; }
        status(idSt, L('正在优化路径……', 'Optimising the path…'));
        setTimeout(() => {
          try {
            const A = fr.atoms;
            const r = WB.idpp(A, B, { images: nImg });
            const lin = WB.linearPath(A, B, nImg);
            const linMin = Math.min(...lin.map((X) => { let m = Infinity; for (let i = 0; i < X.length; i++) for (let j = i + 1; j < X.length; j++) m = Math.min(m, Math.hypot(X[i].x - X[j].x, X[i].y - X[j].y, X[i].z - X[j].z)); return m; }));
            use('idpp');
            const frames = r.frames.map((atoms, k) => ({ atoms, comment: `IDPP image ${k}/${r.frames.length - 1}` }));
            guess = WB.write('xyz', frames, { all: true });
            setFrames(frames, { name: `${S.name}_idpp`, charge: S.charge, mult: S.mult, keepMeasures: true, keepView: true, source: 'idpp' });
            status(idSt, L(`路径有 ${frames.length} 帧（含两端），${r.iterations} 步收敛，最大力 ${r.fmax.toExponential(1)}。每帧最近的两原子：IDPP ${Math.min(...r.minDist).toFixed(2)} Å，线性插值 ${linMin.toFixed(2)} Å。用查看器下面的播放看，写 ORCA NEB 时会当作初始路径。`, `The path has ${frames.length} frames (ends included), converged in ${r.iterations} steps (max force ${r.fmax.toExponential(1)}). Closest atom pair over the frames: IDPP ${Math.min(...r.minDist).toFixed(2)} Å, linear interpolation ${linMin.toFixed(2)} Å. Play it below the viewer; an ORCA NEB input will use it as the starting path.`), Math.min(...r.minDist) < 0.7 ? 'warn' : '');
            idOut.replaceChildren(h('div', { class: 'wb-row' }, btn(L('下载路径（多帧 XYZ）', 'Download the path (multi-frame XYZ)'), () => download(`${S.name}.xyz`, guess)), btn(L('下载 ORCA 的 .allxyz', 'Download ORCA .allxyz'), () => download(`${S.name}.allxyz`, C.allxyz(guess)))));
          } catch (err) { status(idSt, errText(err), 'bad'); }
        }, 30);
      }, 'primary')), idSt, idOut));

    // ── 读结果，画能量曲线 ─────────────────────────────────────────────
    let path = null;
    const unitSel = sel([['kcal', 'kcal/mol'], ['kj', 'kJ/mol'], ['ev', 'eV'], ['eh', 'Eh']], 'kcal', { 'aria-label': L('单位', 'Unit') });
    const zeroSel = sel([['first', L('第一点', 'first point')], ['min', L('最低点', 'lowest point')], ['last', L('最后一点', 'last point')]], 'first', { 'aria-label': L('零点', 'Zero') });
    const prSt = h('p', { class: 'wb-status' });
    const prOut = h('div', {});
    const UNIT = { kcal: 'kcal/mol', kj: 'kJ/mol', ev: 'eV', eh: 'Eh' };
    function renderProfile(hi = null) {
      if (!path) { prOut.replaceChildren(); return; }
      const pr = C.profile(path, { unit: unitSel.value, zero: zeroSel.value });
      if (!pr) { prOut.replaceChildren(h('p', { class: 'wb-small', text: L('能量少于两个点，画不了曲线。', 'Fewer than two energies; no profile to draw.') })); return; }
      const u = UNIT[pr.unit], d = pr.unit === 'eh' ? 6 : pr.unit === 'ev' ? 3 : 2;
      const xLab = path.x ? path.xLabel : path.frames && path.frames.length === path.energies.length ? L('路径长度 / Å（相邻帧 RMS 位移累加）', 'path length / Å (summed RMS displacement)') : L('点', 'point');
      const hasFrames = path.frames && path.frames.length === path.energies.length;
      const fig = plot({ series: [{ x: pr.x, y: pr.rel, kind: 'line', dots: true, color: 'var(--accent)' }], xLabel: xLab, yLabel: `ΔE / ${u}`, hline: [{ y: 0 }],
        markers: pr.smooth ? [{ x: pr.smooth.x, text: L(`样条最高点 ${pr.smooth.e.toFixed(d)}`, `spline max ${pr.smooth.e.toFixed(d)}`) }] : [],
        highlight: { s: 0, i: hi ?? pr.top }, tip: (i) => `#${i + 1}  ${pr.rel[i].toFixed(d)} ${u}`, onPick: hasFrames ? (i) => { setFrame(i); renderProfile(i); } : null });
      const items = [[L('正向能垒（最高点 − 第一点）', 'Forward barrier (top − first)'), `${pr.barrier.toFixed(d)} ${u}`], [L('逆向能垒（最高点 − 最后一点）', 'Reverse barrier (top − last)'), `${pr.reverse.toFixed(d)} ${u}`], [L('反应能（最后 − 第一点）', 'Reaction energy (last − first)'), `${pr.reaction.toFixed(d)} ${u}`], [L('最高点', 'Highest point'), `#${pr.top + 1}${path.ts != null ? L(`（程序标的过渡态 #${path.ts + 1}）`, ` (program’s TS #${path.ts + 1})`) : ''}`]];
      if (pr.smooth) items.push([L('样条插值的最高点', 'Spline-interpolated maximum'), `${pr.smooth.e.toFixed(d)} ${u}`]);
      prOut.replaceChildren(fig, h('div', { class: 'wb-kv' }, items.map(([k, v]) => h('div', {}, h('small', { text: k }), h('b', { text: v })))),
        h('p', { class: 'wb-small', text: L(`读成：${path.label}，${path.energies.length} 个点${hasFrames ? '，带结构（点曲线上的点看那一帧）' : ''}。这是电子能的曲线，不含零点能和热校正。`, `Read as: ${path.label}, ${path.energies.length} points${hasFrames ? ', with geometries (click a point to see that frame)' : ''}. These are electronic energies without zero-point or thermal corrections.`) }),
        h('div', { class: 'wb-row' }, btn(L('下载 CSV', 'Download CSV'), () => download(`${S.name}_profile.csv`, csv([['x', pr.x], ['energy_Eh', path.energies], [`dE_${pr.unit}`, pr.rel]])))));
    }
    unitSel.addEventListener('change', () => renderProfile());
    zeroSel.addEventListener('change', () => renderProfile());
    const takePath = (p, src) => {
      path = p;
      if (p.frames && p.frames.length === p.energies.length && p.frames.length) {
        setFrames(p.frames.map((atoms, k) => ({ atoms, energy: p.relative ? null : p.energies[k], comment: `${p.label} ${k + 1}` })), { name: `${S.name}_path`, charge: S.charge, mult: S.mult, keepView: false, frame: p.ts ?? 0, source: src });
      }
      status(prSt, '');
      renderProfile();
    };
    panel.append(card(L('读结果，画能量曲线', 'Read the results as an energy profile'),
      fileBox({ accept: '.xyz,.log,.out,.txt,.trj', onText: (t, name) => {
        if (t == null) { status(prSt, L('读不出来。', 'Could not read it.'), 'bad'); return; }
        const p = C.readPath(t, (x) => WB.parseAny(x, 'path.xyz'));
        if (!p) { status(prSt, L('没认出路径数据。支持：多帧 XYZ（注释行带能量，如 xtbscan.log、ORCA 的 *_MEP_trj.xyz、*_IRC_Full_trj.xyz）、ORCA 输出（NEB 的 PATH SUMMARY、IRC PATH SUMMARY、弛豫扫描表）、Gaussian 的 IRC 和扫描输出。', 'No path data recognised. Supported: multi-frame XYZ with energies on the comment lines (xtbscan.log, ORCA *_MEP_trj.xyz, *_IRC_Full_trj.xyz), ORCA outputs (NEB PATH SUMMARY, IRC PATH SUMMARY, relaxed-scan table) and Gaussian IRC and scan outputs.'), 'bad'); return; }
        if (!p.energies.length) { status(prSt, L('这个多帧文件的注释行里没有能量。', 'This multi-frame file has no energies on its comment lines.'), 'bad'); return; }
        takePath(p, name);
      }, hint: L('多帧 XYZ（xtbscan.log、ORCA 的 *_trj.xyz）、ORCA 或 Gaussian 的输出', 'Multi-frame XYZ (xtbscan.log, ORCA *_trj.xyz), ORCA or Gaussian outputs') }),
      h('div', { class: 'wb-row' }, field(L('单位', 'Unit'), unitSel, 's'), field(L('零点', 'Zero'), zeroSel, 's'),
        btn(L('用当前的多帧结构', 'Use the current frames'), () => {
          const E = S.frames.map((f) => f.energy);
          if (S.frames.length < 2 || !E.every(Number.isFinite)) { status(prSt, L('当前结构要有至少两帧，而且每帧都有能量。', 'The current structure needs at least two frames, each with an energy.'), 'bad'); return; }
          path = { kind: 'frames', label: L('当前的多帧结构', 'current frames'), energies: E, x: null, xLabel: '', frames: S.frames.map((f) => f.atoms), ts: null, relative: false };
          status(prSt, ''); renderProfile(S.frame);
        }),
        btn(L('示例：Gaussian 弛豫扫描', 'Sample: Gaussian relaxed scan'), async () => {
          status(prSt, L('正在载入示例……', 'Loading the sample…'));
          try { const t = await (await fetch('samples/dvb-scan-g16.log')).text(); const p = C.readPath(t, null); if (p) { takePath(p, 'sample'); status(prSt, L('示例：二乙烯基苯一个二面角的弛豫扫描（Gaussian 16，B3LYP/STO-3G，cclib 的测试数据节选）。', 'Sample: relaxed scan of a divinylbenzene dihedral (Gaussian 16, B3LYP/STO-3G, excerpt of cclib’s test data).')); } else status(prSt, L('示例文件里没有扫描。', 'No scan in the sample.'), 'bad'); } catch { status(prSt, L('示例载入失败。', 'The sample failed to load.'), 'bad'); }
        }, 'small')),
      prSt, prOut));
    renderCoords(); fillProducts();
  } });

  TABS.push({ id: 'conf', n: 4, zh: '构象', en: 'Conformers', build(ctx, panel) {
    const { h, L, btn, field, sel, numIn, check, card, status, val, WB, C, S, on, current, setFrames, setFrame, use, download, csv, fileBox, errText, progress } = ctx;
    const smiIn = h('input', { type: 'text', class: 'mono', spellcheck: 'false', autocomplete: 'off', placeholder: 'CCCC', 'aria-label': 'SMILES', value: S.smiles || '' });
    on('frames', () => { if (S.smiles && S.source !== 'conformers') smiIn.value = S.smiles; });
    const nSel = sel([['10', '10'], ['20', '20'], ['30', '30']], '20', { 'aria-label': L('个数', 'Count') });
    const gSt = h('p', { class: 'wb-status' });
    const prog = progress();
    panel.append(card(L('生成或读入构象', 'Generate or load conformers'),
      h('p', { class: 'wb-p', text: L('从 SMILES 生成：OpenChemLib 按扭转角规则搭出一批不同的构象，再各自用 MMFF94s+ 优化（在你的浏览器里算，小分子最多 30 个）。也可以读入别处算好的系综，比如 CREST 的 crest_conformers.xyz 或 xtb 的多帧文件，注释行里的能量会自动读出来。', 'From a SMILES: OpenChemLib builds a set of distinct conformers from torsion rules and optimises each with MMFF94s+ (in your browser, up to 30 for small molecules). Or load an ensemble computed elsewhere, such as CREST’s crest_conformers.xyz or a multi-frame xtb file; energies on the comment lines are read automatically.') }),
      h('div', { class: 'wb-row' }, field('SMILES', smiIn, 'grow'), field(L('最多几个', 'Up to'), nSel, 'n'), btn(L('生成构象', 'Generate'), async () => {
        const smi = smiIn.value.trim();
        if (!smi) { status(gSt, L('先写一个 SMILES。', 'Type a SMILES first.'), 'bad'); return; }
        status(gSt, L('正在生成和优化构象……', 'Generating and optimising conformers…'));
        try {
          const r = await ctx.smilesTo3D(smi, { conformers: Number(nSel.value), wide: true, onProgress: (k, n) => prog.set(k, n) });
          prog.done();
          const frames = r.frames.map((f, k) => ({ atoms: f.atoms, energy: f.energy, ff: f.ff, comment: `conformer ${k + 1} MMFF94s+ E = ${Number.isFinite(f.energy) ? (f.energy * C.HARTREE_KCAL).toFixed(3) : 'n/a'} kcal/mol` })); // smilesTo3D 已经换成 Eh 了
          setFrames(frames, { name: `conf_${ctx.safeName(smi.replace(/[^\w]+/g, '').slice(0, 12))}`, smiles: smi, charge: r.charge, mult: r.mult, source: 'conformers' });
          status(gSt, L(`生成了 ${frames.length} 个构象（试了 ${r.tried} 个起点）。下面自动归簇了。`, `Generated ${frames.length} conformers (from ${r.tried} starting points). They are clustered below.`));
          cluster();
        } catch (e) { prog.done(); status(gSt, errText(e), 'bad'); }
      }, 'primary'), btn(L('停止', 'Stop'), () => { window.MolAstriaSmiles3D?.stop(); prog.done(); }, 'small')),
      prog.el, gSt,
      h('p', { class: 'wb-small', text: L('读入系综：在“结构”页读入多帧文件，再回到这里按“归簇”。', 'To load an ensemble, read the multi-frame file on the Structure tab, then press “Cluster” here.') })));

    const rmsdIn = numIn(0.5, { min: 0.05, max: 5, step: 0.05 }), winIn = numIn('', { min: 0, max: 100, step: 0.5, attrs: { placeholder: L('不限', 'none') } }), TIn = numIn(298.15, { min: 1, max: 3000, step: 1 });
    const heavyBox = check(L('只比重原子', 'Heavy atoms only'), true, () => {}), permBox = check(L('允许同种原子换位（对称等价）', 'Allow swapping equivalent atoms'), true, () => {});
    const cSt = h('p', { class: 'wb-status' });
    const cOut = h('div', {});
    let last = null;
    function cluster() {
      if (S.frames.length < 2) { status(cSt, L('当前结构只有一帧。先生成构象，或者在“结构”页读入一个多帧文件。', 'The current structure has a single frame. Generate conformers or load a multi-frame file on the Structure tab first.'), 'bad'); return; }
      const n0 = S.frames[0].atoms.length;
      if (S.frames.some((f) => f.atoms.length !== n0)) { status(cSt, L('各帧原子数不一样，不能比较。', 'The frames differ in atom count and cannot be compared.'), 'bad'); return; }
      const T = val(TIn, 298.15);
      const r = WB.clusterConformers(S.frames, { rmsd: val(rmsdIn, 0.5), heavy: heavyBox.querySelector('input').checked, permute: permBox.querySelector('input').checked, window: winIn.value === '' ? Infinity : val(winIn), unit: 'eh', T });
      use('kabsch', 'horn');
      last = { r, T };
      const rows = r.clusters.map((c, k) => h('tr', { 'data-click': '1', 'data-on': String(c.rep === S.frame), onclick: () => { setFrame(c.rep); render(); } },
        h('td', { text: String(k + 1) }), h('td', { text: `#${c.rep + 1}` }), h('td', { text: String(c.members.length) }), h('td', { text: r.hasEnergy ? c.rel.toFixed(2) : '—' }), h('td', { text: r.hasEnergy ? ctx.pct(c.pop) : '—' }), h('td', { text: c.maxRmsd.toFixed(3) })));
      // 量过的内坐标的 Boltzmann 平均（二面角按圆周平均）
      const avgs = [];
      if (r.hasEnergy && S.measures.length) {
        const kept = r.clusters.flatMap((c) => c.members);
        const bz = WB.boltzmann(kept.map((i) => S.frames[i].energy), 'eh', T);
        for (const m of S.measures) {
          const vals = kept.map((i) => WB.measure(S.frames[i].atoms, m.picks)?.value);
          let avg;
          if (m.type === 'dihedral') { let s = 0, c = 0; vals.forEach((v, k) => { s += bz.pop[k] * Math.sin(v * Math.PI / 180); c += bz.pop[k] * Math.cos(v * Math.PI / 180); }); avg = Math.atan2(s, c) * 180 / Math.PI; } else avg = vals.reduce((s, v, k) => s + bz.pop[k] * v, 0);
          const lab = m.picks.map((i) => `${S.frames[0].atoms[i].el}${i + 1}`).join('–');
          avgs.push(h('li', {}, h('span', { text: lab }), h('b', { text: `${avg.toFixed(m.type === 'bond' ? 3 : 1)} ${m.type === 'bond' ? 'Å' : '°'}` }), h('small', { text: L(`（范围 ${Math.min(...vals).toFixed(1)} … ${Math.max(...vals).toFixed(1)}）`, ` (range ${Math.min(...vals).toFixed(1)} … ${Math.max(...vals).toFixed(1)})`) })));
        }
      }
      const reps = r.clusters.map((c) => c.rep);
      cOut.replaceChildren(...[
        h('div', { class: 'wb-tablewrap' }, h('table', { class: 'wb-table' }, h('thead', {}, h('tr', {}, ...[L('簇', 'Cluster'), L('代表', 'Representative'), L('成员', 'Members'), 'ΔE (kcal/mol)', L(`布居（${T} K）`, `Population (${T} K)`), L('簇内最大 RMSD (Å)', 'Max RMSD in cluster (Å)')].map((t) => h('th', { text: t })))), h('tbody', {}, rows))),
        h('p', { class: 'wb-small', text: L(`${S.frames.length} 个构象归成 ${r.clusters.length} 簇${r.dropped ? `，能量窗外丢掉 ${r.dropped} 个` : ''}。点一行看那个构象。布居按${S.source === 'conformers' ? ' MMFF94s+ 力场能' : '注释行里的能量'}算（电子能或力场能，不是自由能），只能当参考；正式比较要在更高的理论层级上重新优化、算频率。`, `${S.frames.length} conformers in ${r.clusters.length} clusters${r.dropped ? `, ${r.dropped} outside the energy window dropped` : ''}. Click a row to view that conformer. Populations use ${S.source === 'conformers' ? 'MMFF94s+ force-field energies' : 'the energies from the comment lines'} (electronic or force-field energies, not free energies), so treat them as a guide; re-optimise at a higher level with frequencies for a real comparison.`) }),
        avgs.length ? h('div', {}, h('h3', { class: 'wb-h3', text: L('量过的内坐标的 Boltzmann 平均', 'Boltzmann averages of the kept measurements') }), h('ul', { class: 'wb-list' }, avgs)) : null,
        h('div', { class: 'wb-row' },
          btn(L('下载代表构象（多帧 XYZ）', 'Download representatives (multi-frame XYZ)'), () => download(`${S.name}_reps.xyz`, WB.write('xyz', reps.map((i, k) => ({ ...S.frames[i], comment: `cluster ${k + 1} rep ${i + 1}${r.hasEnergy ? ` E = ${S.frames[i].energy.toFixed(8)} Eh dE = ${r.clusters[k].rel.toFixed(3)} kcal/mol pop = ${r.clusters[k].pop.toFixed(4)}` : ''}` })), { all: true }))),
          btn(L('下载表格 CSV', 'Download table CSV'), () => download(`${S.name}_clusters.csv`, csv([['cluster', r.clusters.map((_, k) => k + 1)], ['rep_frame', reps.map((i) => i + 1)], ['members', r.clusters.map((c) => c.members.length)], ['dE_kcal_mol', r.clusters.map((c) => c.rel)], ['population', r.clusters.map((c) => c.pop)], ['max_rmsd_A', r.clusters.map((c) => c.maxRmsd)]]))),
          btn(L('只留代表构象', 'Keep only the representatives'), () => { setFrames(reps.map((i) => S.frames[i]), { name: `${S.name}_reps`, smiles: S.smiles, charge: S.charge, mult: S.mult, keepMeasures: true, keepView: true, source: 'conformers' }); cluster(); }),
          btn(L('去批量写输入', 'Write inputs for them'), () => { setFrames(reps.map((i) => S.frames[i]), { name: `${S.name}_reps`, smiles: S.smiles, charge: S.charge, mult: S.mult, keepMeasures: true, keepView: true, source: 'conformers' }); ctx.show('batch'); }))].filter(Boolean));
      status(cSt, '');
    }
    const render = () => { if (last) for (const tr of cOut.querySelectorAll('tbody tr')) tr.dataset.on = String(Number(tr.children[1].textContent.slice(1)) - 1 === S.frame); };
    on('frame', render);
    panel.append(card(L('归簇和 Boltzmann 布居', 'Clustering and Boltzmann populations'),
      h('p', { class: 'wb-p', text: L('按能量从低到高，每个构象和已有各簇的代表叠合（Kabsch / Horn 四元数法）后比 RMSD，小于阈值就归进去。勾上“允许同种原子换位”时，同种元素之间按最优对应比（处理甲基转动这类对称等价）。', 'From the lowest energy up, each conformer is superposed on every cluster representative (Kabsch / Horn quaternion method) and joins the first one within the RMSD threshold. With “Allow swapping equivalent atoms”, atoms of the same element are matched optimally (handling symmetry such as a rotated methyl).') }),
      h('div', { class: 'wb-row' }, field(L('RMSD 阈值（Å）', 'RMSD threshold (Å)'), rmsdIn, 'n'), field(L('能量窗（kcal/mol）', 'Energy window (kcal/mol)'), winIn, 's'), field(L('温度（K）', 'Temperature (K)'), TIn, 'n')),
      h('div', { class: 'wb-row' }, heavyBox, permBox, btn(L('归簇', 'Cluster'), cluster, 'primary')), cSt, cOut));
  } });
})();
