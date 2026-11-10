/* 3D 分子查看器：给任何页面一个能转、能缩放的分子或蛋白结构。
   画图用 3Dmol.js（BSD-3-Clause，https://github.com/3dmol/3Dmol.js），第一次用到时才从 jsDelivr 载入，
   和实验室载入 RDKit.js 的做法一样；本文件只管外面的工具条、多帧切换和主题。
   用法：MolAstriaMol3D.mount(el, { xyz }) / { pdb } / { sdf } / { pdbId: '3ENI' }，可选 style、label、
   highlight（[{ sel: { resn: 'FAD' }, color: 'orange' }]）、spin。返回 { viewer, setFrame, destroy } 的 Promise。
   window.MolAstriaMol3D；在 node 里 module.exports 只导出纯函数（tools/mol3d-test.mjs 测）。 */
(function (root) {
  'use strict';

  const VERSION = '2.5.5';
  const SRC = `https://cdn.jsdelivr.net/npm/3dmol@${VERSION}/build/3Dmol-min.js`;
  const RCSB = (id) => `https://files.rcsb.org/download/${id}.cif`;

  // ── 纯函数 ──────────────────────────────────────────────────────────────
  /** 把一段（可能多帧的）XYZ 拆成帧：每帧 { n, comment, atoms: [[符号, x, y, z]] }。坏帧整段丢掉。 */
  function splitXyz(text) {
    const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
    const frames = [];
    let i = 0;
    while (i < lines.length) {
      if (!lines[i].trim()) { i++; continue; }
      const n = Number(lines[i].trim());
      if (!Number.isInteger(n) || n < 1 || i + 2 + n > lines.length) break;
      const atoms = [];
      for (let k = 0; k < n; k++) {
        const f = (lines[i + 2 + k] || '').trim().split(/\s+/);
        const xyz = f.slice(1, 4).map(Number);
        if (!/^[A-Z][a-z]?$/.test(f[0] || '') || xyz.length < 3 || !xyz.every(Number.isFinite)) return frames;
        atoms.push([f[0], ...xyz]);
      }
      frames.push({ n, comment: (lines[i + 1] || '').trim(), atoms });
      i += 2 + n;
    }
    return frames;
  }
  /** 帧再拼回 XYZ 文本（3Dmol 读的格式）。 */
  const joinXyz = (frames) => frames.map((f) => `${f.atoms.length}\n${f.comment}\n${f.atoms.map((a) => `${a[0]} ${a[1].toFixed(5)} ${a[2].toFixed(5)} ${a[3].toFixed(5)}`).join('\n')}\n`).join('');
  /** 一个 PDB 编号只能是 4 位（字母数字，第一位是数字），或者新式的 pdb_0000xxxx。 */
  const cleanPdbId = (v) => {
    const s = String(v ?? '').trim().toUpperCase();
    return /^[1-9][A-Z0-9]{3}$/.test(s) || /^PDB_[0-9A-Z]{8}$/.test(s) ? s : '';
  };
  /** 各种显示样式对应的 3Dmol 样式对象。 */
  function styleOf(kind) {
    switch (kind) {
      case 'stick': return { stick: { radius: 0.14, colorscheme: 'Jmol' } };
      case 'sphere': return { sphere: { colorscheme: 'Jmol' } };
      case 'line': return { line: { colorscheme: 'Jmol' } };
      case 'cartoon': return { cartoon: { color: 'spectrum' } };
      default: return { stick: { radius: 0.12, colorscheme: 'Jmol' }, sphere: { scale: 0.24, colorscheme: 'Jmol' } };
    }
  }
  /** 化学式（Hill 顺序：有碳时 C、H 在前，其余按字母）。 */
  function formula(atoms) {
    const c = {};
    for (const a of atoms) c[a[0]] = (c[a[0]] || 0) + 1;
    const keys = Object.keys(c).sort();
    const order = c.C ? ['C', 'H', ...keys.filter((k) => k !== 'C' && k !== 'H')].filter((k) => c[k]) : keys;
    return order.map((k) => k + (c[k] > 1 ? c[k] : '')).join('');
  }
  const pure = { splitXyz, joinXyz, cleanPdbId, styleOf, formula, VERSION, SRC };
  if (typeof module === 'object' && module.exports) { module.exports = pure; return; }

  // ── 浏览器 ──────────────────────────────────────────────────────────────
  let loading = null;
  /** 载入 3Dmol.js（只载一次）。 */
  function load() {
    if (root.$3Dmol) return Promise.resolve(root.$3Dmol);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = SRC; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (root.$3Dmol ? resolve(root.$3Dmol) : reject(new Error('3Dmol.js 载入后不可用')));
      s.onerror = () => { loading = null; reject(new Error('3Dmol.js 载入失败（需要联网访问 cdn.jsdelivr.net）')); };
      document.head.append(s);
    });
    return loading;
  }
  const dark = () => {
    const t = document.documentElement.dataset.theme;
    return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  };
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  const STYLES = [['ballstick', '球棍'], ['stick', '棍'], ['sphere', '空间填充'], ['line', '线']];
  const PROTEIN_STYLES = [['cartoon', '卡通'], ['stick', '棍'], ['line', '线']];

  /** 在 el 里放一个查看器。opts 见文件头。 */
  async function mount(el, opts = {}) {
    if (!el) throw new Error('mount: 没有容器');
    el.classList.add('m3-box');
    const protein = !!(opts.pdb || opts.pdbId || opts.cif);
    const styles = protein ? PROTEIN_STYLES : STYLES;
    let style = styles.some(([k]) => k === opts.style) ? opts.style : styles[0][0];
    el.innerHTML = `<div class="m3-stage" role="img" aria-label="${esc(opts.label || '3D 分子结构')}"><p class="m3-state">正在载入 3D 查看器…</p></div>`
      + `<div class="m3-bar"><label class="m3-style">样式 <select>${styles.map(([k, n]) => `<option value="${k}"${k === style ? ' selected' : ''}>${n}</option>`).join('')}</select></label>`
      + `<button type="button" class="text-button m3-spin" aria-pressed="false">自动旋转</button><button type="button" class="text-button m3-reset">复位</button><button type="button" class="text-button m3-png">保存图片</button>`
      + '<span class="m3-frames" hidden><input type="range" min="1" value="1" aria-label="帧"><span class="m3-fnum"></span></span><span class="m3-info muted"></span></div>';
    const stage = el.querySelector('.m3-stage'), state = el.querySelector('.m3-state'), info = el.querySelector('.m3-info');
    let $3D;
    try { $3D = await load(); } catch (e) { state.textContent = e.message; state.dataset.bad = 'true'; throw e; }

    let data = '', format = 'xyz', frames = 0;
    if (opts.xyz) {
      const fr = splitXyz(opts.xyz);
      if (!fr.length) { state.textContent = '这段 XYZ 读不出原子。'; state.dataset.bad = 'true'; throw new Error('bad xyz'); }
      data = joinXyz(fr); frames = fr.length;
      info.textContent = `${formula(fr[0].atoms)} · ${fr[0].atoms.length} 个原子`;
    } else if (opts.sdf) { data = opts.sdf; format = 'sdf'; }
    else if (opts.pdb) { data = opts.pdb; format = 'pdb'; }
    else if (opts.cif) { data = opts.cif; format = 'cif'; }
    else if (opts.pdbId) {
      const id = cleanPdbId(opts.pdbId);
      if (!id) { state.textContent = 'PDB 编号不对。'; state.dataset.bad = 'true'; throw new Error('bad pdb id'); }
      state.textContent = `正在从 RCSB PDB 下载 ${id}…`;
      try {
        const res = await fetch(RCSB(id));
        if (!res.ok) throw new Error(String(res.status));
        data = await res.text(); format = 'cif';
      } catch {
        state.textContent = `${id} 下载失败（需要联网访问 files.rcsb.org）。`; state.dataset.bad = 'true';
        throw new Error('pdb download failed');
      }
      info.innerHTML = `<a href="https://www.rcsb.org/structure/${id}" target="_blank" rel="noopener">RCSB PDB ${id} <i class="ico-ext" aria-hidden="true"></i></a>`;
    }
    state.remove();
    const viewer = $3D.createViewer(stage, { backgroundColor: dark() ? '#10141c' : '#ffffff', backgroundAlpha: 0, antialias: true });
    if (frames > 1) viewer.addModelsAsFrames(data, format); else viewer.addModel(data, format);
    const paint = () => {
      viewer.setStyle({}, styleOf(style));
      if (protein && style === 'cartoon') viewer.setStyle({ hetflag: true, not: { resn: ['HOH', 'WAT'] } }, { stick: { radius: 0.2, colorscheme: 'Jmol' }, sphere: { scale: 0.3, colorscheme: 'Jmol' } });
      for (const h of opts.highlight || []) viewer.setStyle(h.sel, { stick: { radius: 0.28, color: h.color || 'orange' }, sphere: { scale: 0.45, color: h.color || 'orange' } }); // 单个金属离子没有键，要靠球才看得见
      viewer.render();
    };
    paint();
    viewer.zoomTo();
    viewer.render();

    const sel = el.querySelector('.m3-style select');
    sel.addEventListener('change', () => { style = sel.value; paint(); });
    const spinBtn = el.querySelector('.m3-spin');
    let spinning = false;
    const setSpin = (on) => { spinning = on; viewer.spin(on ? 'y' : false); spinBtn.setAttribute('aria-pressed', String(on)); };
    spinBtn.addEventListener('click', () => setSpin(!spinning));
    if (opts.spin && !matchMedia('(prefers-reduced-motion: reduce)').matches) setSpin(true);
    el.querySelector('.m3-reset').addEventListener('click', () => { viewer.zoomTo(); viewer.render(); });
    el.querySelector('.m3-png').addEventListener('click', () => {
      const a = document.createElement('a');
      a.href = viewer.pngURI(); a.download = `${(opts.name || 'molecule').replace(/[^\w.-]+/g, '_')}.png`;
      document.body.append(a); a.click(); a.remove();
    });
    const fbox = el.querySelector('.m3-frames'), range = fbox.querySelector('input'), fnum = fbox.querySelector('.m3-fnum');
    const setFrame = async (i) => {
      const k = Math.max(0, Math.min(frames - 1, i));
      range.value = String(k + 1);
      fnum.textContent = `第 ${k + 1} / ${frames} 帧`;
      await viewer.setFrame(k);
      viewer.render();
      el.dataset.frame = String(k);
    };
    if (frames > 1) {
      fbox.hidden = false; range.max = String(frames);
      range.addEventListener('input', () => setFrame(Number(range.value) - 1));
      await setFrame(0);
    }
    // 主题切换时换背景色；容器变大小时重画。
    const onTheme = () => { viewer.setBackgroundColor(dark() ? '#10141c' : '#ffffff', 0); viewer.render(); };
    const mo = new MutationObserver(onTheme);
    mo.observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { viewer.resize(); viewer.render(); }) : null;
    ro?.observe(stage);
    el.dataset.ready = 'true';
    el.m3 = { viewer, setFrame, frames };
    return {
      viewer, frames, setFrame,
      destroy() { mo.disconnect(); ro?.disconnect(); try { viewer.clear(); } catch { /* gone */ } el.innerHTML = ''; delete el.dataset.ready; },
    };
  }

  /** 一个“查看 3D 结构”按钮：点了才载入，适合结果列表这类一页多个的地方。 */
  function button(el, opts, label = '查看 3D 结构') {
    el.innerHTML = `<button type="button" class="button small m3-open">${esc(label)}</button>`;
    el.querySelector('button').addEventListener('click', () => { mount(el, opts).catch(() => { /* 错误已经写在框里 */ }); }, { once: true });
  }

  root.MolAstriaMol3D = { ...pure, load, mount, button };
})(typeof window !== 'undefined' ? window : globalThis);
