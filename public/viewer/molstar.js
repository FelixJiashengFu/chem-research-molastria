/* Mol* 查看器：给蛋白质和其他大分子一个专业的 3D 查看器（小分子仍用 mol3d.js 的 3Dmol.js）。
   画图用 Mol*（MIT，https://github.com/molstar/molstar，许可证见 THIRD-PARTY-molstar.md），第一次打开时才从 jsDelivr
   载入写死版本的 viewer 构建（约 5 MB）和它的浅色 / 深色主题样式；纯函数在 molstar-core.js（tools/molstar-test.mjs 测）。
   用法：MolAstriaMolstar.open(el, { pdbId } | { pdbText } | { mmcifText } | { trajectoryFrames: { residues, frames } }，
     可选 rmsf（[{ chain, res, a }]，写进 B 因子，按 RMSF 着色 / 粗细）、label、name、color、rep）
   返回 Promise<{ viewer, plugin, frames, setFrame, setColor, setRep, destroy }>；button(el, opts, label) 放一个点了才载入的按钮。
   Mol* 画布里的按钮和提示是英文（Mol* 自己的界面）；外面的工具条和提示自带中英两版（按 <html lang>），整块标 translate="no"。
   离线（桌面版没网时）、没有 WebGL、CDN 载不到时在框里写明原因，不抛到页面上。 */
(function (root) {
  'use strict';
  const C = root.MolAstriaMolstarCore;
  if (!C) return;

  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const dark = () => {
    const t = document.documentElement.dataset.theme;
    return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const EN = () => document.documentElement.lang === 'en';
  const T = (zh, en) => (EN() ? en : zh); // 这个查看器自带中英两版，整块标 translate="no"（放在 translate="no" 的栏目里也一样能用）
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const desktop = () => !!(root.__MOLASTRIA_DESKTOP__ || root.__TAURI_INTERNALS__);
  const BG = () => (dark() ? 0x10141c : 0xffffff);
  const offlineMsg = () => (desktop()
    ? T('Mol* 要联网从 cdn.jsdelivr.net 载入。桌面版现在连不上网：可以先下载 .pdb 用本机软件打开，联网后再试。', 'Mol* loads from cdn.jsdelivr.net and the desktop app is offline right now: download the .pdb and open it in a program on your computer, or try again once online.')
    : T('Mol* 没能载入（需要联网访问 cdn.jsdelivr.net）。可以先下载 .pdb 用本机软件打开。', 'Mol* did not load (it needs cdn.jsdelivr.net). You can download the .pdb and open it in a program on your computer.'));

  // ── 载入 ────────────────────────────────────────────────────────────────
  let loading = null;
  function themeLink() {
    let link = document.getElementById('molastria-molstar-css');
    const href = C.css(dark());
    if (!link) { link = document.createElement('link'); link.id = 'molastria-molstar-css'; link.rel = 'stylesheet'; link.crossOrigin = 'anonymous'; document.head.append(link); }
    if (link.getAttribute('href') !== href) link.href = href;
    return link;
  }
  /** 载入 Mol*（只载一次）。 */
  function load() {
    if (root.molstar?.Viewer) { themeLink(); return Promise.resolve(root.molstar); }
    if (loading) return loading;
    if (navigator.onLine === false) return Promise.reject(new Error(offlineMsg()));
    themeLink();
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = C.SRC; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (root.molstar?.Viewer ? resolve(root.molstar) : reject(new Error(T('Mol* 载入后不可用', 'Mol* loaded but is not usable'))));
      s.onerror = () => { loading = null; s.remove(); reject(new Error(offlineMsg())); };
      document.head.append(s);
    });
    return loading;
  }
  const webgl = () => { try { const c = document.createElement('canvas'); return !!(c.getContext('webgl2') || c.getContext('webgl')); } catch { return false; } };

  /** 要画的数据：{ data, format, frames, times, bDomain, rmsfDomain, caOnly, label, link }。 */
  async function source(opts, say) {
    if (opts.trajectoryFrames) {
      const pdb = C.framesToPdb(opts.trajectoryFrames, opts.rmsf);
      if (!pdb) throw new Error(T('轨迹里没有能用的帧。', 'The trajectory has no usable frames.'));
      return fromPdb(pdb, null, opts.rmsf != null); // framesToPdb already wrote the RMSF into the B column
    }
    if (opts.pdbText) return fromPdb(String(opts.pdbText), opts.rmsf);
    if (opts.mmcifText) return { data: String(opts.mmcifText), format: 'mmcif', bDomain: null };
    if (opts.pdbId) {
      const id = C.cleanPdbId(opts.pdbId);
      if (!id) throw new Error(T('PDB 编号不对：是四位，第一位是 1–9 的数字，比如 1L2Y。', 'Not a PDB ID: four characters starting with a digit 1–9, such as 1L2Y.'));
      if (navigator.onLine === false) throw new Error(T(`${id} 要从 RCSB PDB 下载，现在没有网络。`, `${id} has to be downloaded from the RCSB PDB and there is no network.`));
      say(T(`正在从 RCSB PDB 下载 ${id}…`, `Downloading ${id} from the RCSB PDB…`));
      let text, missing = false;
      try {
        const res = await fetch(C.RCSB(id));
        if (res.status === 404) { missing = true; throw new Error(T(`RCSB PDB 里没有 ${id}。`, `The RCSB PDB has no entry ${id}.`)); }
        if (!res.ok) throw new Error(String(res.status));
        text = await res.text();
      } catch (e) {
        throw new Error(missing ? e.message : T(`${id} 下载失败（需要联网访问 files.rcsb.org）。`, `Downloading ${id} failed (it needs files.rcsb.org).`));
      }
      return { data: text, format: 'mmcif', bDomain: null, link: id };
    }
    throw new Error(T('没有要显示的结构。', 'Nothing to show.'));
  }
  function fromPdb(pdb, rmsf, bIsRmsf = false) {
    const r = rmsf ? C.withRmsf(pdb, rmsf) : null;
    const text = r?.domain ? r.pdb : pdb;
    const models = C.parseModels(text);
    if (!models.length) throw new Error(T('这段 PDB 读不出原子。', 'No atoms could be read from this PDB.'));
    const b = models[0].atoms.map((a) => a.b);
    if (bIsRmsf && b.some((v) => v > 0)) return { data: text, format: 'pdb', bDomain: C.domainOf(b), rmsfDomain: C.domainOf(b.map(C.bToRmsf)), times: models.map((m) => m.t), caOnly: models[0].atoms.every((a) => a.name === 'CA'), atoms: models[0].atoms.length };
    const hasB = !!r?.domain;
    return { data: text, format: 'pdb', bDomain: hasB ? r.domain : null, rmsfDomain: hasB ? r.rmsfDomain : null, times: models.map((m) => m.t), caOnly: models[0].atoms.every((a) => a.name === 'CA'), atoms: models[0].atoms.length, hasFileB: !hasB && b.some((v) => v > 0) };
  }

  const COLORS = [['rmsf', '按 RMSF（B 因子）', 'By RMSF (B factor)'], ['chain-id', '按链', 'By chain'], ['sequence-id', '彩虹（N 端到 C 端）', 'Rainbow (N to C)'], ['secondary-structure', '按二级结构', 'By secondary structure'], ['residue-name', '按残基', 'By residue'], ['hydrophobicity', '按疏水性', 'By hydrophobicity']];
  const REPS = [['cartoon', '卡通', 'Cartoon'], ['putty', '粗细按 B 因子（putty）', 'Putty (thickness by B)'], ['ball-and-stick', '球棍', 'Ball and stick'], ['spacefill', '空间填充', 'Spacefill'], ['molecular-surface', '分子表面', 'Molecular surface']];

  /** 在 el 里放一个 Mol* 查看器。opts 见文件头。 */
  async function open(el, opts = {}) {
    if (!el) throw new Error('open: no container');
    el.classList.add('ms-box');
    el.setAttribute('translate', 'no'); el.lang = EN() ? 'en' : 'zh-CN';
    delete el.dataset.ready;
    el.innerHTML = `<div class="ms-stage" role="img" aria-label="${esc(opts.label || T('3D 大分子结构', '3D macromolecular structure'))}"><div class="ms-canvas"></div><p class="ms-state">${T('正在载入 Mol*…', 'Loading Mol*…')}</p></div>`
      + `<div class="ms-bar"><label class="ms-color">${T('着色', 'Colour')} <select></select></label><label class="ms-rep">${T('表示', 'Style')} <select></select></label>`
      + `<span class="ms-frames" hidden><button type="button" class="text-button ms-play" aria-pressed="false">${T('播放', 'Play')}</button><input type="range" min="1" value="1" aria-label="${T('帧', 'Frame')}"><span class="ms-fnum"></span></span>`
      + `<button type="button" class="text-button ms-spin" aria-pressed="false">${T('自动旋转', 'Spin')}</button><button type="button" class="text-button ms-reset">${T('复位', 'Reset view')}</button><button type="button" class="text-button ms-png">${T('保存图片', 'Save image')}</button></div>`
      + '<p class="ms-legend muted small" hidden></p><p class="ms-info muted small"></p>';
    const stage = el.querySelector('.ms-canvas'), state = el.querySelector('.ms-state'), info = el.querySelector('.ms-info'), legend = el.querySelector('.ms-legend');
    const say = (t) => { state.textContent = t; };
    const fail = (e) => { state.textContent = e.message; state.dataset.bad = 'true'; el.dataset.failed = 'true'; el.querySelector('.ms-bar').hidden = true; return e; };

    if (!webgl()) throw fail(new Error(T('这个浏览器没有 WebGL，Mol* 画不出来。可以下载 .pdb 用本机软件打开。', 'This browser has no WebGL, so Mol* cannot draw. You can download the .pdb and open it in a program on your computer.')));
    let src, ms;
    try { [ms, src] = await Promise.all([load(), source(opts, say)]); } catch (e) { throw fail(e); }
    say(T('正在搭建结构…', 'Building the structure…'));

    let viewer;
    try {
      viewer = await ms.Viewer.create(stage, {
        layoutIsExpanded: false, layoutShowControls: false, layoutShowSequence: false, layoutShowLog: false, layoutShowLeftPanel: false, layoutShowRemoteState: false, collapseLeftPanel: true,
        viewportShowExpand: false, viewportShowControls: false, viewportShowSettings: false, viewportShowSelectionMode: false, viewportShowAnimation: false, viewportShowTrajectoryControls: false,
        pdbProvider: 'rcsb', emdbProvider: 'rcsb',
      });
      await viewer.loadStructureFromData(src.data, src.format, { dataLabel: opts.name || opts.label || 'structure' });
    } catch (e) {
      try { viewer?.dispose(); } catch { /* 已经坏了 */ }
      throw fail(new Error(`${T('Mol* 没能显示这个结构：', 'Mol* could not show this structure: ')}${e?.message || e}`));
    }
    state.remove();
    const plugin = viewer.plugin;
    const setBg = () => { try { plugin.canvas3d?.setProps({ renderer: { backgroundColor: BG() } }); } catch { /* 画布还没好 */ } };
    setBg();

    // 着色和表示：只列这个结构用得上的
    const hasB = !!src.bDomain || !!src.hasFileB;
    const colors = COLORS.filter(([k]) => (k === 'rmsf' ? hasB : !(src.caOnly && k === 'secondary-structure')));
    const reps = REPS.filter(([k]) => (k === 'putty' ? hasB : !(src.caOnly && (k === 'ball-and-stick' || k === 'molecular-surface'))));
    let color = colors.some(([k]) => k === opts.color) ? opts.color : hasB && src.bDomain ? 'rmsf' : src.caOnly ? 'sequence-id' : 'chain-id';
    let rep = reps.some(([k]) => k === opts.rep) ? opts.rep : 'cartoon';
    const csel = el.querySelector('.ms-color select'), rsel = el.querySelector('.ms-rep select');
    csel.innerHTML = colors.map(([k, n, e]) => `<option value="${k}"${k === color ? ' selected' : ''}>${T(n, e)}</option>`).join('');
    rsel.innerHTML = reps.map(([k, n, e]) => `<option value="${k}"${k === rep ? ' selected' : ''}>${T(n, e)}</option>`).join('');

    const showLegend = () => {
      legend.hidden = color !== 'rmsf';
      if (color !== 'rmsf') return;
      legend.innerHTML = src.rmsfDomain
        ? `<span class="ms-ramp" aria-hidden="true"></span><span>${T(`蓝色动得少、红色动得多：Cα RMSF 从 ${src.rmsfDomain[0].toFixed(2)} 到 ${src.rmsfDomain[1].toFixed(2)} Å（写成 B 因子 8π²/3·RMSF²）。`, `Blue moves least, red most: Cα RMSF from ${src.rmsfDomain[0].toFixed(2)} to ${src.rmsfDomain[1].toFixed(2)} Å (written as the B factor 8π²/3·RMSF²).`)}</span>`
        : `<span class="ms-ramp" aria-hidden="true"></span><span>${T('按文件里的 B 因子着色：蓝色低、红色高。', 'Coloured by the B factors in the file: blue low, red high.')}</span>`;
    };
    async function paint() {
      const sm = plugin.managers.structure;
      const structs = sm.hierarchy.current.structures;
      const name = color === 'rmsf' ? 'uncertainty' : color;
      const colorParams = color === 'rmsf' && src.bDomain ? { domain: src.bDomain } : undefined;
      for (const st of structs) {
        await sm.component.clear([st]);
        const poly = await plugin.builders.structure.tryCreateComponentStatic(st.cell, 'polymer');
        if (poly) await plugin.builders.structure.representation.addRepresentation(poly, { type: rep, color: name, ...(colorParams ? { colorParams } : {}), ...(rep === 'putty' && src.bDomain ? { size: 'uncertainty', sizeParams: { bfactorFactor: 0.04 } } : {}) });
        if (!src.caOnly) {
          const lig = await plugin.builders.structure.tryCreateComponentStatic(st.cell, 'ligand');
          if (lig) await plugin.builders.structure.representation.addRepresentation(lig, { type: 'ball-and-stick', color: 'element-symbol' });
          const ion = await plugin.builders.structure.tryCreateComponentStatic(st.cell, 'ion');
          if (ion) await plugin.builders.structure.representation.addRepresentation(ion, { type: 'ball-and-stick', color: 'element-symbol' });
        }
      }
      el.dataset.color = color; el.dataset.rep = rep;
      showLegend();
    }
    try { await paint(); } catch { /* 留着 Mol* 自己的默认画法 */ }
    csel.addEventListener('change', () => { color = csel.value; paint().catch(() => {}); });
    rsel.addEventListener('change', () => { rep = rsel.value; paint().catch(() => {}); });

    // 多帧：轨迹（或者 NMR 结构的多个模型）
    const cellOf = (re) => [...plugin.state.data.cells.values()].find((c) => re.test(c.transform.transformer.id));
    const traj = cellOf(/trajectory-from-/), frames = Math.max(1, Number(traj?.obj?.data?.frameCount) || 1);
    const times = src.times || [];
    const fbox = el.querySelector('.ms-frames'), range = fbox.querySelector('input'), fnum = fbox.querySelector('.ms-fnum'), play = fbox.querySelector('.ms-play');
    let cur = 0, busy = Promise.resolve(), timer = 0;
    const setFrame = (i) => {
      const k = Math.max(0, Math.min(frames - 1, i));
      cur = k; range.value = String(k + 1); fnum.textContent = C.frameLabel(k, frames, times[k], EN());
      busy = busy.then(async () => {
        const m = cellOf(/model-from-trajectory$/);
        if (m && m.transform.params?.modelIndex !== k) await plugin.state.data.build().to(m.transform.ref).update((old) => ({ ...old, modelIndex: k })).commit();
        el.dataset.frame = String(k);
      }).catch(() => { /* 换帧失败就停在原来那帧 */ });
      return busy;
    };
    const stop = () => { clearInterval(timer); timer = 0; play.setAttribute('aria-pressed', 'false'); play.textContent = T('播放', 'Play'); };
    if (frames > 1) {
      fbox.hidden = false; range.max = String(frames);
      range.addEventListener('input', () => { stop(); setFrame(Number(range.value) - 1); });
      play.addEventListener('click', () => {
        if (timer) { stop(); return; }
        play.setAttribute('aria-pressed', 'true'); play.textContent = T('暂停', 'Pause');
        timer = setInterval(() => { busy.then(() => { if (timer) setFrame((cur + 1) % frames); }); }, reduced() ? 600 : 160);
      });
      setFrame(0);
    }
    el.dataset.frames = String(frames);

    // 旋转、复位、截图
    const spinBtn = el.querySelector('.ms-spin');
    let spinning = false;
    const setSpin = (on) => {
      spinning = on; spinBtn.setAttribute('aria-pressed', String(on));
      try { plugin.canvas3d?.setProps({ trackball: { animate: on ? { name: 'spin', params: { speed: 0.6 } } : { name: 'off', params: {} } } }); } catch { /* 旧版本没有这个参数 */ }
    };
    spinBtn.addEventListener('click', () => setSpin(!spinning));
    if (opts.spin && !reduced()) setSpin(true);
    el.querySelector('.ms-reset').addEventListener('click', () => { try { plugin.managers.camera.reset(undefined, reduced() ? 0 : 250); } catch { /* 没有相机 */ } });
    el.querySelector('.ms-png').addEventListener('click', async () => {
      try {
        const uri = await plugin.helpers.viewportScreenshot.getImageDataUri();
        const a = document.createElement('a');
        a.href = uri; a.download = `${String(opts.name || 'structure').replace(/[^\w.-]+/g, '_')}.png`;
        document.body.append(a); a.click(); a.remove();
      } catch { /* 截不了图就算了 */ }
    });

    info.innerHTML = [
      src.link ? `<a href="https://www.rcsb.org/structure/${esc(src.link)}" target="_blank" rel="noopener">RCSB PDB ${esc(src.link)} <i class="ico-ext" aria-hidden="true"></i></a>` : '',
      src.caOnly ? `<span>${T('只有 Cα 原子：画成一根沿主链的管子，没有侧链和二级结构。', 'Cα atoms only: drawn as a tube along the backbone, with no side chains or secondary structure.')}</span>` : '',
      `<span>${T('拖动旋转、滚轮缩放、右键平移；画布里的按钮和提示是 Mol* 自己的英文界面。', 'Drag to rotate, scroll to zoom, right-drag to pan; the buttons inside the canvas are Mol*’s own.')}</span>`,
      `<a href="https://molstar.org/" target="_blank" rel="noopener">Mol* ${esc(C.VERSION)} <i class="ico-ext" aria-hidden="true"></i></a>`,
    ].filter(Boolean).join(' ');

    // 主题切换时换样式和背景；容器变大小时重画
    const onTheme = () => { themeLink(); setBg(); };
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const mq = matchMedia('(prefers-color-scheme: dark)');
    mq.addEventListener?.('change', onTheme);
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { try { viewer.handleResize(); } catch { /* 已经关了 */ } }) : null;
    ro?.observe(stage);

    el.dataset.ready = 'true';
    const handle = {
      viewer, plugin, frames, setFrame,
      setColor(k) { if (colors.some(([x]) => x === k)) { color = k; csel.value = k; return paint(); } return Promise.resolve(); },
      setRep(k) { if (reps.some(([x]) => x === k)) { rep = k; rsel.value = k; return paint(); } return Promise.resolve(); },
      destroy() { stop(); mo.disconnect(); mq.removeEventListener?.('change', onTheme); ro?.disconnect(); try { viewer.dispose(); } catch { /* gone */ } el.innerHTML = ''; delete el.dataset.ready; el.ms = null; },
    };
    el.ms = handle;
    return handle;
  }

  /** 一个“用 Mol* 查看”按钮：点了才载入（约 5 MB）。 */
  function button(el, opts, label = T('用 Mol* 查看', 'View in Mol*')) {
    el.innerHTML = `<button type="button" class="button small ms-open">${esc(label)}</button>`;
    el.querySelector('button').addEventListener('click', () => { open(el, opts).catch(() => { /* 原因已经写在框里 */ }); }, { once: true });
  }

  root.MolAstriaMolstar = { ...C, load, open, button };
})(typeof window !== 'undefined' ? window : globalThis);
