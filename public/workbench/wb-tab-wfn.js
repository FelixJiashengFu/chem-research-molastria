/* 计算工作台 · “波函数与表面”标签。往 window.MOLASTRIA_WB_TABS 里登记，由 workbench.js 画出来。
   - Molden：轨道能级图、在格点上算分子轨道和电子密度（wb-worker.js，页面不卡），画等值面，格点积分核对归一化和电子数；
   - cube：读任何程序写的 cube 画等值面，第二个 cube（比如静电势）映射到第一个的等值面上着色；
   - 点电荷近似的静电势（电荷从 Gaussian / ORCA 输出里读）；
   - Hirshfeld 面（d_norm 着色）、指纹图、接触比例；IGM δg^inter 和 IRI 弱相互作用等值面（sign(λ₂)ρ 着色）和散点图。
   后两类用自由原子球平均密度的叠加（wb-promol.js，PySCF 算的），页面上标明。 */
(function () {
  'use strict';
  const TABS = (window.MOLASTRIA_WB_TABS = window.MOLASTRIA_WB_TABS || []);

  TABS.push({ id: 'wfn', n: 5, zh: '波函数与表面', en: 'Wavefunctions & surfaces', build(ctx, panel) {
    const { h, L, btn, field, sel, numIn, card, status, val, WB, C, F, S, on, emit, current, setFrames, use, view, levels, runJob, stopJobs, progress, download, csv, fileBox, errText } = ctx;
    const BOHR = WB.BOHR;
    const bohrAtoms = (atoms) => atoms.map((a) => ({ el: a.el, Z: WB.ZOF[a.el] || 1, x: a.x / BOHR, y: a.y / BOHR, z: a.z / BOHR }));
    const qualSel = () => sel([['low', L('粗（快）', 'Coarse (fast)')], ['medium', L('中', 'Medium')], ['high', L('细（慢）', 'Fine (slow)')]], 'medium', { 'aria-label': L('格点', 'Grid') });
    const jobErr = (e) => (/stopped/.test(e.message) ? L('已停止。', 'Stopped.') : /mo:index/.test(e.message) ? L('没有这个轨道。', 'No such orbital.') : errText(e));

    // ── Molden ────────────────────────────────────────────────────────
    let mol = null; // { text, name, w }
    let pick = null; // { spin, i }
    const mSt = h('p', { class: 'wb-status' }), mInfo = h('div', {}), mLev = h('div', {}), mProg = progress();
    const moSel = sel([], '', { 'aria-label': L('轨道', 'Orbital') });
    const mQual = qualSel();
    function takeMolden(text, name, w, fromBuild) {
      try { w = w || F.parseMolden(text); } catch (e) { status(mSt, errText(e), 'bad'); return; }
      mol = { text, name: ctx.safeName((name || 'molden').replace(/\.\w+$/, '')), w };
      if (!fromBuild) setFrames([{ atoms: ctx.fromBohr(w.atoms), comment: 'molden' }], { name: mol.name, charge: S.charge, mult: S.mult, source: 'molden' });
      use('molden');
      const fm = F.frontierMos(w);
      pick = fm.alpha.homo >= 0 ? { spin: 'alpha', i: fm.alpha.homo } : null;
      const occ = w.mos.reduce((s, m) => s + m.occ, 0);
      mInfo.replaceChildren(...[h('div', { class: 'wb-kv' }, [[L('原子', 'Atoms'), w.atoms.length], [L('基函数', 'Basis functions'), w.nbf], [L('轨道', 'Orbitals'), w.mos.length], [L('占据数之和', 'Total occupation'), occ.toFixed(2)], [L('自旋', 'Spin'), w.mos.some((m) => m.spin === 'beta') ? L('非限制（α、β 分开）', 'unrestricted (α and β)') : L('限制性', 'restricted')]].map(([k, v]) => h('div', {}, h('small', { text: k }), h('b', { text: String(v) })))),
        w.warnings.includes('no-mo') ? h('p', { class: 'wb-status', 'data-warn': 'true', text: L('文件里没有分子轨道（[MO] 段），只能看结构。', 'The file has no molecular orbitals ([MO] section); only the structure can be shown.') }) : null].filter(Boolean));
      const opt = (m, i) => {
        const tag = i === fm.alpha.homo ? ' HOMO' : i === fm.alpha.lumo ? ' LUMO' : fm.beta && i === fm.beta.homo ? ' β-HOMO' : fm.beta && i === fm.beta.lumo ? ' β-LUMO' : '';
        return h('option', { value: String(i), text: `#${i + 1} ${m.spin === 'beta' ? 'β' : 'α'} ${(m.e * C.HARTREE_EV).toFixed(3)} eV occ ${m.occ.toFixed(2)}${m.sym ? ` ${m.sym}` : ''}${tag}` });
      };
      moSel.replaceChildren(...w.mos.map(opt));
      if (pick) moSel.value = String(pick.i);
      drawLevels();
      status(mSt, L(`读入 ${mol.name}：${w.mos.length} 个轨道。点能级图上的一条线选轨道。`, `Loaded ${mol.name}: ${w.mos.length} orbitals. Click a level in the diagram to pick an orbital.`));
    }
    function drawLevels() {
      if (!mol) { mLev.replaceChildren(); return; }
      const list = (spin) => mol.w.mos.map((m, i) => ({ e: m.e, occ: m.occ, i, spin: m.spin })).filter((o) => o.spin === spin);
      const beta = list('beta');
      mLev.replaceChildren(levels({ alpha: list('alpha'), beta: beta.length ? beta : null, selected: pick, pick: (spin, i) => { pick = { spin, i }; moSel.value = String(i); drawLevels(); } }));
    }
    moSel.addEventListener('change', () => { const i = Number(moSel.value); pick = { spin: mol.w.mos[i].spin, i }; drawLevels(); });
    on('molden', (text, name, w) => takeMolden(text, name, w, true));
    async function drawMo() {
      if (!mol) { status(mSt, L('先读入一个 Molden 文件。', 'Load a Molden file first.'), 'bad'); return; }
      const i = Number(moSel.value), m = mol.w.mos[i];
      status(mSt, L(`正在算第 ${i + 1} 个轨道……`, `Computing orbital ${i + 1}…`));
      try {
        const r = await runJob({ job: 'mo', molden: mol.text, index: i, quality: mQual.value }, (k, n) => mProg.set(k, n));
        mProg.done();
        const fm = F.frontierMos(mol.w);
        const tag = i === fm.alpha.homo ? 'HOMO' : i === fm.alpha.lumo ? 'LUMO' : `MO ${i + 1}`;
        await view.addSurface({ kind: 'mo', label: `${tag} (${(m.e * C.HARTREE_EV).toFixed(2)} eV)`, cube: r.cube, iso: 0.05, signed: true, colors: ['#2563eb', '#dc2626'], range: [0.004, 0.4], file: `${mol.name}_mo${i + 1}.cube` });
        status(mSt, L(`画好了。格点上 ∫|ψ|² dV = ${r.integral.toFixed(4)}（归一化的轨道应接近 1；明显小于 1 说明格子太小或太粗）。`, `Done. ∫|ψ|² dV on the grid = ${r.integral.toFixed(4)} (a normalised orbital gives about 1; much less means the box is too small or the grid too coarse).`), Math.abs(r.integral - 1) > 0.05 ? 'warn' : '');
      } catch (e) { mProg.done(); status(mSt, jobErr(e), 'bad'); }
    }
    async function drawDensity() {
      if (!mol) { status(mSt, L('先读入一个 Molden 文件。', 'Load a Molden file first.'), 'bad'); return; }
      status(mSt, L('正在算电子密度……', 'Computing the electron density…'));
      try {
        const r = await runJob({ job: 'density', molden: mol.text, quality: mQual.value }, (k, n) => mProg.set(k, n));
        mProg.done();
        const nel = mol.w.mos.reduce((s, m) => s + m.occ, 0);
        await view.addSurface({ kind: 'density', label: L('电子密度 ρ', 'Electron density ρ'), cube: r.cube, iso: 0.02, colors: ['#7c3aed'], range: [0.0005, 0.5], opacity: 0.6, file: `${mol.name}_density.cube` });
        status(mSt, L(`画好了。格点积分 ∫ρ dV = ${r.integral.toFixed(3)}，占据数之和是 ${nel.toFixed(3)}（差一点是格点的误差，核附近最尖的部分格子取不到）。`, `Done. Grid integral ∫ρ dV = ${r.integral.toFixed(3)} against a total occupation of ${nel.toFixed(3)} (a small gap is grid error: the cusp at each nucleus is too sharp for the grid).`));
      } catch (e) { mProg.done(); status(mSt, jobErr(e), 'bad'); }
    }
    panel.append(card(L('分子轨道和电子密度（Molden）', 'Orbitals and density (Molden)'),
      h('p', { class: 'wb-p', text: L('Molden 文件里有基组和分子轨道系数，ORCA（orca_2mkl -molden）、PySCF、Psi4、Molpro、Gaussian 经 Multiwfn 都能写。这里按基函数逐点算轨道和密度（球谐和笛卡尔的 d、f、g 函数都认），格点在后台线程里算，等值面画在右边，可以下载成 cube。', 'A Molden file holds the basis set and orbital coefficients; ORCA (orca_2mkl -molden), PySCF, Psi4, Molpro and Gaussian via Multiwfn can all write one. Orbitals and densities are evaluated point by point from the basis functions (spherical and Cartesian d, f, g are all handled) on a grid in a background thread; the isosurface appears on the right and can be downloaded as a cube.') }),
      fileBox({ accept: '.molden,.input,.mold,.molf,.txt', paste: true, onText: (t, n) => (t == null ? status(mSt, L('读不出来。', 'Could not read it.'), 'bad') : takeMolden(t, n)), hint: 'Molden (.molden)' }),
      h('div', { class: 'wb-row' }, ...[['formaldehyde.molden', L('示例：甲醛 B3LYP/def2-SVP', 'Sample: formaldehyde B3LYP/def2-SVP')], ['water-dimer.molden', L('示例：水二聚体（试 IGMH）', 'Sample: water dimer (try IGMH)')]].map(([f, label]) => btn(label, async () => {
        try { const t = await (await fetch(`samples/${f}`)).text(); takeMolden(t, f); } catch { status(mSt, L('示例载入失败。', 'The sample failed to load.'), 'bad'); }
      }, 'small'))),
      mInfo, mLev,
      h('div', { class: 'wb-row' }, field(L('轨道', 'Orbital'), moSel, 'grow'), field(L('格点', 'Grid'), mQual, 's')),
      h('div', { class: 'wb-row' }, btn(L('画这个轨道', 'Draw this orbital'), drawMo, 'primary'), btn(L('画电子密度', 'Draw the density'), drawDensity), btn(L('停止', 'Stop'), () => { stopJobs(); mProg.done(); }, 'small')),
      mProg.el, mSt));

    // ── cube ──────────────────────────────────────────────────────────
    let cube = null, cube2 = null;
    const cSt = h('p', { class: 'wb-status' }), cInfo = h('div', {});
    const cMin = numIn(-0.05, { step: 0.005 }), cMax = numIn(0.05, { step: 0.005 });
    function takeCube(text, name, parsed, fromBuild) {
      let c;
      try { c = parsed || F.parseCube(text); } catch { status(cSt, L('这个 cube 读不出来。', 'This cube could not be read.'), 'bad'); return; }
      cube = { text, name: ctx.safeName((name || 'cube').replace(/\.\w+$/, '')), c };
      if (!fromBuild) setFrames([{ atoms: ctx.fromBohr(c.atoms), comment: 'cube' }], { name: cube.name, charge: S.charge, mult: S.mult, source: 'cube' });
      let mn = Infinity, mx = -Infinity;
      for (let i = 0; i < c.data.length; i++) { const v = c.data[i]; if (v < mn) mn = v; if (v > mx) mx = v; }
      const signed = mn < -0.05 * Math.abs(mx);
      const integ = F.cubeIntegral(c);
      cInfo.replaceChildren(h('div', { class: 'wb-kv' }, [[L('格点', 'Grid'), c.n.join(' × ')], [L('最小值', 'Minimum'), mn.toExponential(3)], [L('最大值', 'Maximum'), mx.toExponential(3)], [L('∑ 值 × dV', '∑ value × dV'), integ.toFixed(4)]].map(([k, v]) => h('div', {}, h('small', { text: k }), h('b', { text: String(v) })))));
      const iso = signed ? 0.05 : Math.min(0.02, mx / 4);
      view.addSurface({ kind: 'cube', label: cube.name, cube: text, iso, signed, colors: signed ? ['#2563eb', '#dc2626'] : ['#7c3aed'], range: [Math.max(iso / 50, 1e-6), Math.max(iso * 20, mx)], opacity: signed ? 0.85 : 0.6 });
      status(cSt, L(`读入 cube：${c.n.join(' × ')} 个格点${signed ? '，有正有负（像是轨道），画了 ± 两个面' : ''}。`, `Read the cube: ${c.n.join(' × ')} points${signed ? ', with both signs (looks like an orbital), drawn as ± surfaces' : ''}.`));
    }
    on('cube', (text, name, parsed) => takeCube(text, name, parsed, true));
    const cube2Box = fileBox({ accept: '.cube,.cub', paste: false, title: L('第二个 cube：映射到上面那个的等值面上着色（比如静电势）', 'A second cube to colour the first one’s isosurface (an ESP, say)'), onText: (t, name) => {
      if (t == null) { status(cSt, L('读不出来。', 'Could not read it.'), 'bad'); return; }
      try { cube2 = { text: t, name, c: F.parseCube(t) }; } catch { status(cSt, L('这个 cube 读不出来。', 'This cube could not be read.'), 'bad'); return; }
      status(cSt, L(`第二个 cube：${cube2.c.n.join(' × ')}。按“映射”画。`, `Second cube: ${cube2.c.n.join(' × ')}. Press “Map” to draw it.`));
    } });
    panel.append(card(L('cube 等值面和静电势映射', 'Cube isosurfaces and ESP mapping'),
      h('p', { class: 'wb-p', text: L('读 Gaussian cubegen、ORCA orca_plot、Multiwfn、PySCF 等写的 cube。要画分子表面静电势：第一个 cube 用电子密度（常用 ρ = 0.001 a.u. 的面），第二个用静电势，两个的格子要一样。', 'Reads cubes from Gaussian cubegen, ORCA orca_plot, Multiwfn, PySCF and others. For an ESP-mapped surface, load the electron density as the first cube (the ρ = 0.001 a.u. surface is the usual choice) and the electrostatic potential as the second, on the same grid.') }),
      fileBox({ accept: '.cube,.cub', paste: false, onText: (t, n) => (t == null ? status(cSt, L('读不出来。', 'Could not read it.'), 'bad') : takeCube(t, n)), title: L('读入 cube（选文件或拖进来）', 'Load a cube (choose or drop a file)') }),
      cInfo,
      h('div', { style: 'margin-top:10px' }, cube2Box),
      h('div', { class: 'wb-row' }, field(L('色标下限（红）', 'Scale minimum (red)'), cMin, 's'), field(L('色标上限（蓝）', 'Scale maximum (blue)'), cMax, 's'),
        btn(L('映射', 'Map'), () => {
          if (!cube || !cube2) { status(cSt, L('要先有两个 cube。', 'Two cubes are needed.'), 'bad'); return; }
          if (cube.c.n.join() !== cube2.c.n.join()) status(cSt, L('两个 cube 的格子不一样，颜色会对不准。', 'The two cubes have different grids; the colours will be off.'), 'warn');
          view.addSurface({ kind: 'esp', label: L(`${cube.name} 上的 ${ctx.safeName(cube2.name)}`, `${ctx.safeName(cube2.name)} on ${cube.name}`), cube: cube.text, colorCube: cube2.text, iso: 0.001, scheme: { type: 'rwb', min: val(cMin, -0.05), max: val(cMax, 0.05), mid: 0 }, range: [0.0002, 0.05] });
        }, 'primary')), cSt));

    // ── 点电荷静电势 ─────────────────────────────────────────────────
    let charges = [];
    const qSel = sel([], '', { 'aria-label': L('电荷', 'Charges') });
    const qSt = h('p', { class: 'wb-status' }), qProg = progress(), qList = h('div', {});
    const qText = h('textarea', { rows: '3', spellcheck: 'false', placeholder: L('或者每行写一个电荷，顺序和原子一样', 'Or one charge per line, in atom order') });
    function takeCharges(text) {
      charges = F.chargesOf(text);
      qSel.replaceChildren(...charges.map((c, k) => h('option', { value: String(k), text: `${c.kind} (${c.q.length})` })));
      status(qSt, charges.length ? L(`读出 ${charges.map((c) => c.kind).join('、')} 电荷。`, `Read ${charges.map((c) => c.kind).join(', ')} charges.`) : L('输出里没找到原子电荷（认 Mulliken、Löwdin、CHELPG、ESP、Hirshfeld 表）。', 'No atomic charges found (Mulliken, Löwdin, CHELPG, ESP and Hirshfeld tables are recognised).'), charges.length ? '' : 'bad');
    }
    on('output', (text) => takeCharges(text));
    const currentQ = () => {
      const typed = qText.value.trim() ? qText.value.trim().split(/[\s,;]+/).map(Number) : null;
      if (typed && typed.every(Number.isFinite)) return typed;
      return charges[Number(qSel.value)]?.q || null;
    };
    const qQual = qualSel();
    const qRange = numIn(0.05, { min: 0.001, max: 1, step: 0.005 });
    panel.append(card(h('span', {}, L('近似静电势（点电荷）', 'Approximate ESP (point charges)'), h('span', { class: 'wb-tag', 'data-kind': 'approx', text: L('近似', 'approximate') })),
      h('p', { class: 'wb-p', text: L('没有静电势 cube 时的快捷办法：用输出里的原子电荷算 V(r) = Σ q_A / |r − R_A|，画在原子密度叠加的 ρ = 0.001 a.u. 面上。它只反映电荷分布的大致样子，孤对电子、σ 穴这类细节看不出来；精确的静电势请让程序写 cube 再用上面那一块。', 'A shortcut when no ESP cube is at hand: V(r) = Σ q_A / |r − R_A| from the output’s atomic charges, drawn on the ρ = 0.001 a.u. surface of the summed atomic densities. It only shows the rough charge distribution, not lone pairs or σ-holes; for the real ESP have the program write a cube and use the box above.') }),
      fileBox({ accept: '.log,.out,.txt', paste: false, title: L('读一个 Gaussian / ORCA 输出取电荷', 'Read a Gaussian / ORCA output for charges'), onText: (t) => (t == null ? status(qSt, L('读不出来。', 'Could not read it.'), 'bad') : takeCharges(t)) }),
      h('div', { class: 'wb-row' }, field(L('电荷', 'Charges'), qSel, 'm'), field(L('色标 ± (a.u.)', 'Scale ± (a.u.)'), qRange, 'n'), field(L('格点', 'Grid'), qQual, 's')),
      h('div', { style: 'margin-top:8px' }, qText),
      h('div', { class: 'wb-row' },
        btn(L('画静电势面', 'Draw the ESP surface'), async () => {
          const fr = current(), q = currentQ();
          if (!fr || !q) { status(qSt, L('先读入一个结构和电荷。', 'Load a structure and charges first.'), 'bad'); return; }
          if (q.length !== fr.atoms.length) { status(qSt, L(`电荷有 ${q.length} 个，原子有 ${fr.atoms.length} 个，对不上。`, `${q.length} charges for ${fr.atoms.length} atoms; they do not match.`), 'bad'); return; }
          status(qSt, L('正在算……', 'Computing…'));
          try {
            const r = await runJob({ job: 'espq', atoms: bohrAtoms(fr.atoms), charges: q, quality: qQual.value }, (k, n) => qProg.set(k, n));
            qProg.done();
            const s = val(qRange, 0.05);
            await view.addSurface({ kind: 'espq', label: L('点电荷静电势（近似）', 'Point-charge ESP (approx.)'), cube: r.rhoCube, colorCube: r.espCube, iso: 0.001, scheme: { type: 'rwb', min: -s, max: s, mid: 0 }, range: [0.0002, 0.02], file: `${S.name}_promol_density.cube` });
            use('hirshfeld');
            status(qSt, L(`画好了：红色是负（富电子），蓝色是正，色标 ±${s} a.u.。`, `Done: red is negative (electron-rich), blue positive, scale ±${s} a.u.`));
          } catch (e) { qProg.done(); status(qSt, jobErr(e), 'bad'); }
        }, 'primary'),
        btn(L('按电荷给原子着色', 'Colour atoms by charge'), () => {
          const fr = current(), q = currentQ();
          if (!fr || !q || q.length !== fr.atoms.length) { status(qSt, L('电荷和原子数对不上。', 'Charges and atoms do not match.'), 'bad'); return; }
          const s = Math.max(...q.map(Math.abs)) || 1;
          const col = (v) => { const t = Math.max(-1, Math.min(1, v / s)); const c = Math.round(255 * (1 - Math.abs(t))); return t < 0 ? `rgb(255,${c},${c})` : `rgb(${c},${c},255)`; };
          S.tint = q.map(col); view.restyle();
          qList.replaceChildren(h('div', { class: 'wb-tablewrap' }, h('table', { class: 'wb-table' }, h('thead', {}, h('tr', {}, h('th', { text: L('原子', 'Atom') }), h('th', { text: L('电荷', 'Charge') }))), h('tbody', {}, q.map((v, i) => h('tr', {}, h('td', { text: `${fr.atoms[i].el}${i + 1}` }), h('td', { text: v.toFixed(4) })))))));
        }),
        btn(L('恢复元素颜色', 'Element colours again'), () => { S.tint = null; view.restyle(); qList.replaceChildren(); }, 'small')),
      qProg.el, qSt, qList));

    // ── Hirshfeld 面 ─────────────────────────────────────────────────
    const hSt = h('p', { class: 'wb-status' }), hProg = progress(), hOut = h('div', {});
    const hQual = qualSel(), dMin = numIn(-0.4, { step: 0.05 }), dMax = numIn(1.4, { step: 0.05 });
    const radIn = numIn(8, { min: 3, max: 15, step: 0.5 });
    const ENVELOPE = 0.001; // a.u.，孤立团簇朝外那一侧的等密度面（Bader 的分子表面常用 0.001）
    /** 晶体：3 × 3 × 3 超胞里离中心最近的那个完整分子，加上 radius Å 内的邻居。 */
    function crystalCluster(fr, radius) {
      const big = WB.supercell(fr, 3, 3, 3);
      const sh = WB.fracToCart([1, 1, 1], fr.cell);
      for (const a of big.atoms) { a.x -= sh[0]; a.y -= sh[1]; a.z -= sh[2]; }
      const fg = WB.fragments(big.atoms, WB.bonds(big.atoms, null));
      if (fg.list.length < 2) return { network: true };
      const ctr = WB.fracToCart([0.5, 0.5, 0.5], fr.cell);
      let best = null, bd = Infinity;
      for (const g of fg.list) {
        const c = g.reduce((s, i) => [s[0] + big.atoms[i].x / g.length, s[1] + big.atoms[i].y / g.length, s[2] + big.atoms[i].z / g.length], [0, 0, 0]);
        const d = Math.hypot(c[0] - ctr[0], c[1] - ctr[1], c[2] - ctr[2]);
        if (d < bd) { bd = d; best = g; }
      }
      const ins = best.map((i) => big.atoms[i]), inSet = new Set(best);
      const near = big.atoms.filter((a, i) => !inSet.has(i) && ins.some((b) => Math.hypot(a.x - b.x, a.y - b.y, a.z - b.z) < radius));
      // 邻居按整个分子收进来，看起来不会是断开的碎片
      const nearSet = new Set(near);
      const groups = new Set();
      big.atoms.forEach((a, i) => { if (nearSet.has(a)) groups.add(fg.of[i]); });
      const outs = [...groups].flatMap((g) => fg.list[g]).filter((i) => !inSet.has(i)).map((i) => big.atoms[i]);
      return { atoms: [...ins, ...outs].map((a) => ({ el: a.el, x: a.x, y: a.y, z: a.z })), inside: ins.map((_, k) => k) };
    }
    function insideOf(fr) {
      if (S.frag.size) return [...S.frag].sort((a, b) => a - b);
      const fg = WB.fragments(fr.atoms, WB.bonds(fr.atoms, null));
      return fg.list.length > 1 ? fg.list[0] : null;
    }
    function drawFingerprint(surface, filter) {
      const cv = h('canvas', { class: 'wb-canvas', width: '380', height: '360', role: 'img', 'aria-label': L('指纹图：横轴 d_i，纵轴 d_e', 'Fingerprint plot: d_i across, d_e up') });
      const g = cv.getContext('2d');
      const lo = 0.4, hi = 2.6, step = 0.01, m = { l: 44, b: 38, t: 10, r: 10 }, W = 380 - m.l - m.r, H = 360 - m.t - m.b;
      g.fillStyle = '#fff'; g.fillRect(0, 0, 380, 360);
      const all = F.fingerprint(surface, { lo, hi, step });
      const sub = filter ? F.fingerprint(surface, { lo, hi, step, filter }) : null;
      const n = all.n, px = W / n, py = H / n;
      let mx = 0; for (const c of (sub || all).H) if (c > mx) mx = c;
      const ramp = (t) => { const s = [[43, 89, 195], [34, 197, 94], [239, 68, 68]]; const x = Math.min(1, Math.max(0, t)) * 2, k = Math.min(1, Math.floor(x)), f = x - k; return `rgb(${s[k].map((v, j) => Math.round(v + (s[k + 1][j] - v) * f)).join(',')})`; };
      for (let j = 0; j < n; j++) for (let i = 0; i < n; i++) {
        const c = all.H[j * n + i];
        if (!c) continue;
        const cs = sub ? sub.H[j * n + i] : c;
        g.fillStyle = sub && !cs ? '#cfcfcf' : ramp(Math.log1p(cs) / Math.log1p(mx || 1));
        g.fillRect(m.l + i * px, m.t + H - (j + 1) * py, Math.ceil(px), Math.ceil(py));
      }
      g.strokeStyle = '#555'; g.lineWidth = 1; g.strokeRect(m.l, m.t, W, H);
      g.fillStyle = '#333'; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (let v = 0.6; v <= 2.6001; v += 0.4) { const x = m.l + ((v - lo) / (hi - lo)) * W, y = m.t + H - ((v - lo) / (hi - lo)) * H; g.fillText(v.toFixed(1), x, m.t + H + 14); g.textAlign = 'right'; g.fillText(v.toFixed(1), m.l - 4, y + 4); g.textAlign = 'center'; }
      g.fillText('d_i / Å', m.l + W / 2, 356); g.save(); g.translate(12, m.t + H / 2); g.rotate(-Math.PI / 2); g.fillText('d_e / Å', 0, 0); g.restore();
      return cv;
    }
    panel.append(card(h('span', {}, L('Hirshfeld 面和指纹图', 'Hirshfeld surface and fingerprint plot'), h('span', { class: 'wb-tag', 'data-kind': 'approx', text: L('原子密度叠加', 'promolecule') })),
      h('p', { class: 'wb-p', text: L('Hirshfeld 面把空间分给一个分子和它的邻居：分子的原子密度之和占总和一半的地方就是面（Spackman 和 Jayatilaka 2009）。面上用 d_norm 着色：红色是比范德华半径之和还近的接触（氢键等），白色约等于范德华接触，蓝色更远。指纹图是面上每一点到里面最近原子的距离 d_i 和到外面最近原子的距离 d_e 的二维分布。', 'The Hirshfeld surface divides space between a molecule and its neighbours: it lies where the molecule’s summed atomic densities make up half of the total (Spackman and Jayatilaka 2009). It is coloured by d_norm: red for contacts closer than the sum of van der Waals radii (hydrogen bonds and the like), white for about a van der Waals contact, blue for longer. The fingerprint plot is the 2D distribution of d_i and d_e, the distances from each surface point to the nearest atom inside and outside.') }),
      h('p', { class: 'wb-small', text: L('选“里面”：在查看器里用“选片段”点一个分子；不选就用第一个分子。晶体（有晶胞）会自动取 3 × 3 × 3 超胞中间那个分子和它周围的分子。', 'Choosing “inside”: click a molecule with “Pick fragment” in the viewer; otherwise the first molecule is used. For a crystal (with a cell), the molecule at the centre of a 3 × 3 × 3 supercell and its neighbours are taken automatically.') }),
      h('div', { class: 'wb-row' }, field(L('晶体邻居半径（Å）', 'Crystal neighbour radius (Å)'), radIn, 'n'), field(L('d_norm 下限（红）', 'd_norm minimum (red)'), dMin, 'n'), field(L('d_norm 上限（蓝）', 'd_norm maximum (blue)'), dMax, 'n'), field(L('格点', 'Grid'), hQual, 's')),
      h('div', { class: 'wb-row' }, btn(L('画 Hirshfeld 面', 'Draw the Hirshfeld surface'), async () => {
        let fr = current();
        if (!fr) { status(hSt, L('先载入一个结构。', 'Load a structure first.'), 'bad'); return; }
        let inside;
        const crystal = !!fr.cell;
        if (fr.cell) {
          const cl = crystalCluster(fr, val(radIn, 8));
          if (cl.network) { status(hSt, L('这个晶体连成了一整片（没有分立的分子），Hirshfeld 面要分立的分子或离子。', 'This crystal is one connected network (no separate molecules); a Hirshfeld surface needs discrete molecules or ions.'), 'bad'); return; }
          setFrames([{ atoms: cl.atoms, comment: 'cluster' }], { name: `${S.name}_cluster`, charge: 0, mult: 1, keepView: false, source: 'cluster' });
          S.frag = new Set(cl.inside); emit('frag'); view.decorate();
          fr = current(); inside = cl.inside;
          status(hSt, L(`从晶胞里取了中间的分子（${cl.inside.length} 个原子）和周围 ${cl.atoms.length - cl.inside.length} 个原子，正在算……`, `Took the central molecule (${cl.inside.length} atoms) and ${cl.atoms.length - cl.inside.length} surrounding atoms from the cell; computing…`));
        } else {
          inside = insideOf(fr);
          if (!inside) { status(hSt, errText('hirshfeld:fragments'), 'bad'); return; }
          if (!S.frag.size) { S.frag = new Set(inside); emit('frag'); view.decorate(); }
          status(hSt, L('正在算……', 'Computing…'));
        }
        if (inside.length === fr.atoms.length) { status(hSt, errText('hirshfeld:fragments'), 'bad'); return; }
        try {
          const r = await runJob({ job: 'hirshfeld', atoms: bohrAtoms(fr.atoms), inside, vdw: WB.VDW, quality: hQual.value, envelope: crystal ? 0 : ENVELOPE }, (k, n) => hProg.set(k, n));
          hProg.done();
          use('hirshfeld', 'hsurf', 'fingerprint', 'bondi');
          await view.addSurface({ kind: 'hirshfeld', label: 'Hirshfeld (d_norm)', cube: r.wCube, colorCube: r.dCube, iso: 0.5, scheme: { type: 'rwb', min: val(dMin, -0.4), max: val(dMax, 1.4), mid: 0 }, range: [0.3, 0.7], opacity: 0.9, file: `${S.name}_hirshfeld_weight.cube` });
          const shares = F.contactShares(r.surface);
          const fsel = sel([['', L('全部接触', 'All contacts')], ...shares.map((s) => [s.pair, `${s.pair}  ${(100 * s.share).toFixed(1)} %`])], '', { 'aria-label': L('只看一类接触', 'One kind of contact') });
          const box = h('div', {}, drawFingerprint(r.surface, null));
          fsel.addEventListener('change', () => box.replaceChildren(drawFingerprint(r.surface, fsel.value ? (p) => `${p.ei}···${p.ee}` === fsel.value : null)));
          const minDn = r.surface.reduce((m, p) => Math.min(m, p.di + p.de), Infinity);
          const nFree = r.surface.filter((p) => p.free).length, pFree = r.surface.length ? (100 * nFree) / r.surface.length : 0;
          hOut.replaceChildren(h('div', { class: 'wb-two' },
            h('div', {}, h('h3', { class: 'wb-h3', text: L('指纹图', 'Fingerprint plot') }), field(L('分解', 'Decompose'), fsel, 'm'), box),
            h('div', {}, h('h3', { class: 'wb-h3', text: L('接触比例（里面···外面，按面上的点数）', 'Contact shares (inside···outside, by surface points)') }),
              h('div', { class: 'wb-tablewrap' }, h('table', { class: 'wb-table' }, h('thead', {}, h('tr', {}, h('th', { text: L('接触', 'Contact') }), h('th', { text: L('比例', 'Share') }))), h('tbody', {}, shares.slice(0, 14).map((s) => h('tr', {}, h('td', { text: s.pair }), h('td', { text: `${(100 * s.share).toFixed(1)} %` })))))),
              h('p', { class: 'wb-small', text: L(`面上 ${r.surface.length} 个采样点；最短的 d_i + d_e = ${minDn.toFixed(2)} Å。${nFree ? `${pFree.toFixed(0)} % 的面朝外、没有邻居（孤立团簇用 ρ = ${ENVELOPE} a.u. 的等密度面把它合上），不算进接触比例和指纹图。` : ''}`, `${r.surface.length} surface points; shortest d_i + d_e = ${minDn.toFixed(2)} Å.${nFree ? ` ${pFree.toFixed(0)} % of the surface faces outward with no neighbour (an isolated cluster is closed off by the ρ = ${ENVELOPE} a.u. isodensity surface) and is left out of the shares and the fingerprint.` : ''}`) }),
              h('div', { class: 'wb-row' }, btn(L('下载面上的点（CSV）', 'Download surface points (CSV)'), () => download(`${S.name}_hirshfeld_points.csv`, csv([['d_i', r.surface.map((p) => p.di)], ['d_e', r.surface.map((p) => p.de)], ['inside_el', r.surface.map((p) => p.ei)], ['outside_el', r.surface.map((p) => p.ee)]]))),
                btn('d_norm cube', () => download(`${S.name}_dnorm.cube`, r.dCube), 'small')))));
          status(hSt, L('画好了。', 'Done.'));
        } catch (e) { hProg.done(); status(hSt, jobErr(e), 'bad'); }
      }, 'primary'), btn(L('停止', 'Stop'), () => { stopJobs(); hProg.done(); }, 'small')),
      hProg.el, hSt, hOut));

    // ── IGM / IRI ─────────────────────────────────────────────────────
    const iSt = h('p', { class: 'wb-status' }), iProg = progress(), iOut = h('div', {});
    const kSel = sel([['igm', L('IGM：片段之间的 δg^inter（原子密度叠加）', 'IGM: δg^inter between fragments (promolecule)')], ['igmh', L('IGMH：同上，但用 Molden 的真实密度', 'IGMH: the same on the real density from the Molden file')], ['iri', L('IRI：化学键和弱相互作用一起看', 'IRI: chemical bonds and weak interactions together')]], 'igm', { 'aria-label': L('方法', 'Method') });
    const iQual = qualSel();
    const sMin = numIn(-0.04, { step: 0.005 }), sMax = numIn(0.02, { step: 0.005 });
    function scatterPlot(pts, kind) {
      const cv = h('canvas', { class: 'wb-canvas', width: '420', height: '300', role: 'img', 'aria-label': L('散点图', 'Scatter plot') });
      const g = cv.getContext('2d'), m = { l: 48, b: 38, t: 10, r: 10 }, W = 420 - m.l - m.r, H = 300 - m.t - m.b;
      const x0 = -0.05, x1 = 0.05, y0 = 0, y1 = kind === 'igm' ? Math.max(0.02, Math.min(0.2, Math.max(...pts.map((p) => p[1])))) : 2.5;
      g.fillStyle = '#fff'; g.fillRect(0, 0, 420, 300);
      const col = (x) => { const t = (x - val(sMin, -0.04)) / (val(sMax, 0.02) - val(sMin, -0.04)); const s = [[29, 78, 216], [22, 163, 74], [220, 38, 38]]; const u = Math.min(1, Math.max(0, t)) * 2, k = Math.min(1, Math.floor(u)), f = u - k; return `rgb(${s[k].map((v, j) => Math.round(v + (s[k + 1][j] - v) * f)).join(',')})`; };
      for (const [x, y] of pts) { if (x < x0 || x > x1 || y > y1) continue; g.fillStyle = col(x); g.fillRect(m.l + ((x - x0) / (x1 - x0)) * W, m.t + H - ((y - y0) / (y1 - y0)) * H, 1.6, 1.6); }
      g.strokeStyle = '#555'; g.strokeRect(m.l, m.t, W, H);
      g.fillStyle = '#333'; g.font = '11px system-ui, sans-serif'; g.textAlign = 'center';
      for (let v = -0.04; v <= 0.0401; v += 0.02) g.fillText(v.toFixed(2), m.l + ((v - x0) / (x1 - x0)) * W, m.t + H + 14);
      g.textAlign = 'right';
      for (let k = 0; k <= 4; k++) { const v = y0 + ((y1 - y0) * k) / 4; g.fillText(v.toFixed(kind === 'igm' ? 3 : 1), m.l - 4, m.t + H - (k / 4) * H + 4); }
      g.textAlign = 'center'; g.fillText('sign(λ₂)ρ / a.u.', m.l + W / 2, 296);
      g.save(); g.translate(12, m.t + H / 2); g.rotate(-Math.PI / 2); g.fillText(kind === 'igm' ? 'δg^inter / a.u.' : 'IRI / a.u.', 0, 0); g.restore();
      return cv;
    }
    panel.append(card(h('span', {}, L('IGM 和 IRI 弱相互作用', 'IGM and IRI weak interactions'), h('span', { class: 'wb-tag', 'data-kind': 'approx', text: L('原子密度叠加', 'promolecule') })),
      h('p', { class: 'wb-p', text: L('IGM（Lefebvre 等 2017）：两个片段的密度梯度“各自取绝对值再相加”和“真实相加”之差 δg^inter，只在片段之间有相互作用的地方不为零。IGMH（Lu 和 Chen 2022）把片段密度换成真实分子密度的 Hirshfeld 划分，要先读入 Molden 文件，面上的 sign(λ₂)ρ 也用真实密度算。IRI（Lu 和 Chen 2021）：|∇ρ| / ρ^1.1，化学键和弱相互作用都显出来。面用 sign(λ₂)ρ 着色：蓝色是强吸引（氢键），绿色是范德华，红色是位阻。', 'IGM (Lefebvre et al. 2017): δg^inter, the difference between adding the two fragments’ density gradients “as absolute values” and adding them for real, is non-zero only where the fragments interact. IGMH (Lu and Chen 2022) replaces the fragment densities with a Hirshfeld partition of the real molecular density; it needs a Molden file, and sign(λ₂)ρ on the surface then comes from the real density too. IRI (Lu and Chen 2021): |∇ρ| / ρ^1.1, which shows chemical bonds and weak interactions together. Surfaces are coloured by sign(λ₂)ρ: blue for strong attraction (hydrogen bonds), green for van der Waals, red for steric clash.') }),
      h('p', { class: 'wb-small', text: L('IGM 的两个片段：在查看器里用“选片段”选的是片段 1，其余是片段 2；不选就用第一个分子。', 'IGM fragments: what you pick with “Pick fragment” in the viewer is fragment 1 and the rest fragment 2; without a pick the first molecule is fragment 1.') }),
      h('div', { class: 'wb-row' }, field(L('方法', 'Method'), kSel, 'grow'), field(L('格点', 'Grid'), iQual, 's'), field(L('色标下限（蓝）', 'Scale minimum (blue)'), sMin, 'n'), field(L('色标上限（红）', 'Scale maximum (red)'), sMax, 'n')),
      h('div', { class: 'wb-row' }, btn(L('计算并画面', 'Compute and draw'), async () => {
        const fr = current();
        if (!fr) { status(iSt, L('先载入一个结构。', 'Load a structure first.'), 'bad'); return; }
        const kind = kSel.value;
        let frag = null;
        if (kind === 'igmh') {
          if (!mol) { status(iSt, L('IGMH 的真实密度从 Molden 文件里算：先在上面“分子轨道和电子密度”里读入一个（可以试水二聚体示例）。', 'IGMH takes the real density from a Molden file: load one under “Orbitals and density” above first (try the water dimer sample).'), 'bad'); return; }
          if (mol.w.atoms.length !== fr.atoms.length) { status(iSt, L(`查看器里的结构有 ${fr.atoms.length} 个原子，Molden 文件有 ${mol.w.atoms.length} 个，不是同一个体系。`, `The structure in the viewer has ${fr.atoms.length} atoms and the Molden file ${mol.w.atoms.length}; they are not the same system.`), 'bad'); return; }
          if (mol.w.nbf > 800) { status(iSt, L('基函数超过 800 个，浏览器里算会很慢。', 'More than 800 basis functions; too slow for the browser.'), 'bad'); return; }
        }
        if (kind === 'igm' || kind === 'igmh') {
          const ins = insideOf(fr);
          if (!ins || ins.length === fr.atoms.length) { status(iSt, L('IGM 要两个片段：结构里要有至少两个分子，或者用“选片段”选一部分原子。', 'IGM needs two fragments: the structure must hold at least two molecules, or pick some atoms with “Pick fragment”.'), 'bad'); return; }
          const set = new Set(ins);
          frag = fr.atoms.map((_, i) => (set.has(i) ? 0 : 1));
          if (!S.frag.size) { S.frag = new Set(ins); emit('frag'); view.decorate(); }
        }
        if (fr.atoms.length > 400) { status(iSt, L('原子太多（超过 400 个），浏览器里算会很慢。先“只留选中的片段”或删掉远处的分子。', 'Too many atoms (over 400) for the browser. Keep only the relevant fragment or delete distant molecules first.'), 'bad'); return; }
        status(iSt, L('正在算……', 'Computing…'));
        try {
          const r = await runJob(kind === 'igmh' ? { job: 'igmh', molden: mol.text, frag, quality: iQual.value } : { job: kind, atoms: bohrAtoms(fr.atoms), frag, quality: iQual.value }, (k, n) => iProg.set(k, n));
          iProg.done();
          const isIgm = kind !== 'iri';
          use(kind === 'igmh' ? 'igmh' : kind === 'igm' ? 'igm' : 'iri');
          if (kind === 'igmh') use('igm', 'molden');
          const iso = isIgm ? 0.005 : 1.0;
          await view.addSurface({ kind, label: kind === 'igm' ? 'IGM δg^inter' : kind === 'igmh' ? 'IGMH δg^inter' : 'IRI', cube: r.mainCube, colorCube: r.colorCube, iso, scheme: { type: 'nci', min: val(sMin, -0.04), max: val(sMax, 0.02) }, range: isIgm ? [0.001, 0.05] : [0.3, 3], opacity: 0.85, file: `${S.name}_${kind}.cube` });
          iOut.replaceChildren(h('h3', { class: 'wb-h3', text: L('散点图（每个点是一个格点）', 'Scatter plot (one dot per grid point)') }), scatterPlot(r.scatter, isIgm ? 'igm' : 'iri'),
            h('p', { class: 'wb-small', text: isIgm ? L('左边的尖峰（sign(λ₂)ρ < 0）是氢键这类吸引，靠近 0 的是范德华，右边是位阻。', 'Spikes on the left (sign(λ₂)ρ < 0) are attractions such as hydrogen bonds, near zero van der Waals, on the right steric clash.') : L('IRI 低的区域（图的下部）对应化学键和弱相互作用，按 sign(λ₂)ρ 区分。', 'Low IRI (the lower part of the plot) marks chemical bonds and weak interactions, told apart by sign(λ₂)ρ.') }),
            h('div', { class: 'wb-row' }, btn(L('下载两个 cube', 'Download both cubes'), () => download(`${S.name}_${kind}.zip`, new Blob([C.zip([{ name: `${S.name}_${kind}.cube`, text: r.mainCube }, { name: `${S.name}_sl2r.cube`, text: r.colorCube }])], { type: 'application/zip' })))));
          status(iSt, L(`画好了（等值 ${iso}，右边的滑杆能调）。`, `Done (isovalue ${iso}; adjust it with the slider on the right).`));
        } catch (e) { iProg.done(); status(iSt, jobErr(e), 'bad'); }
      }, 'primary'), btn(L('停止', 'Stop'), () => { stopJobs(); iProg.done(); }, 'small')),
      iProg.el, iSt, iOut));
  } });
})();
