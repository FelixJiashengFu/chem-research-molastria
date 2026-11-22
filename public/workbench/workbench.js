/* 计算工作台的界面（workbench.js）：页面骨架、3D 查看器（3Dmol.js）、“结构”“晶体与表面”“项目与引用”三个标签，
   以及给其他标签用的公共工具。wb-tab-path.js、wb-tab-wfn.js、wb-tab-spec.js 往 window.MOLASTRIA_WB_TABS 里登记 { id, n, zh, en, build(ctx, panel) }，
   这里按 n 排好画出来；它们之间用 ctx.on / ctx.emit 传消息（'frames' 换了结构、'frame' 换了帧、'edit' 改了原子、'picks' 选的原子变了、'used' 用到了新方法）。
   功能清单参照 Ester Studio 2.1.2（github.com/Ahey1/Ester-Studio，张子轩）。它的许可证不许销售修改版，MolAstria 有付费的部分，
   所以这里没有用它的任何代码、界面文字或图，全部按公开的文件格式和文献自己写（文献表在 wb-calc.js 的 REFS）。
   页面文字自带中英两版（整页 translate="no"）。上次的结构和设置存在 localStorage 的 molastria-workbench。 */
(function () {
  'use strict';
  const WB = window.MolAstriaWB, C = window.MolAstriaWBCalc, F = window.MolAstriaWBWfn;
  const app = document.getElementById('wb');
  if (!WB || !C || !F || !app) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const STORE = 'molastria-workbench';
  const MAX_SAVE = 400000, MAX_FILE = 80e6;

  // ── 小工具 ───────────────────────────────────────────────────────────
  /** Element builder: text goes in as textContent, never as HTML. `value` is set after the children (so a <select> keeps it). */
  function h(tag, attrs, ...kids) {
    const el = document.createElement(tag);
    let value;
    for (const [k, v] of Object.entries(attrs || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'value') value = v;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat(Infinity)) if (kid != null && kid !== false) el.append(kid.nodeType ? kid : document.createTextNode(String(kid)));
    if (value !== undefined) el.value = value;
    return el;
  }
  const ico = (dir = '') => h('i', { class: `ico-ext${dir ? ' ico-' + dir : ''}`, 'aria-hidden': 'true' });
  const prefs = (() => { try { return JSON.parse(localStorage.getItem(STORE) || '{}') || {}; } catch { return {}; } })();
  function savePrefs(patch) {
    Object.assign(prefs, patch);
    try { localStorage.setItem(STORE, JSON.stringify(prefs)); } catch { /* 隐私模式或存满了：只是下次不复原 */ }
  }
  const btn = (text, onclick, cls = '', attrs = {}) => h('button', { type: 'button', class: `wb-btn ${cls}`.trim(), onclick, ...attrs }, text);
  const field = (label, control, cls = '') => h('label', { class: `wb-f ${cls}`.trim() }, h('span', { text: label }), control);
  const sel = (options, value, attrs = {}) => h('select', { ...attrs, value: String(value) }, options.map(([v, t]) => h('option', { value: String(v), text: t })));
  const numIn = (value, o = {}) => h('input', { type: 'number', value: String(value), min: o.min, max: o.max, step: o.step || 'any', inputmode: 'decimal', ...(o.attrs || {}) });
  const check = (label, checked, onchange) => h('label', { class: 'wb-check' }, h('input', { type: 'checkbox', checked: !!checked, onchange }), label);
  const card = (title, ...kids) => h('section', { class: 'wb-card' }, title ? h('h2', { class: 'wb-h2' }, title) : null, ...kids);
  const pre = (text) => h('pre', { class: 'wb-pre', text });
  const val = (input, dflt = 0) => { const v = Number(input.value); return Number.isFinite(v) ? v : dflt; };
  const safeName = (s) => String(s || 'molecule').replace(/[^\w.-]+/g, '_').replace(/^_+|_+$/g, '').slice(0, 40) || 'molecule';
  function status(el, msg, kind) {
    el.textContent = msg || '';
    el.dataset.bad = String(kind === 'bad');
    el.dataset.warn = String(kind === 'warn');
  }
  const fmt = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const pct = (v) => `${(100 * v).toFixed(1)} %`;

  function download(name, data, type = 'text/plain;charset=utf-8') {
    const blob = data instanceof Blob ? data : new Blob([data], { type });
    const a = h('a', { href: URL.createObjectURL(blob), download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 5000);
  }
  async function copyText(text, el) {
    try { await navigator.clipboard.writeText(text); if (el) { const t = el.textContent; el.textContent = L('已复制', 'Copied'); setTimeout(() => (el.textContent = t), 1400); } } catch { /* 剪贴板不可用 */ }
  }

  /** 选文件 / 拖进来 / 粘贴。onText(text, name)；太大的文件 onText(null, name, 'big')。 */
  function fileBox({ accept = '', title, hint, onText, paste = true, multiple = false, pasteHint }) {
    const input = h('input', { type: 'file', accept, hidden: true, multiple });
    const box = h('div', { class: 'wb-drop', tabindex: '0', role: 'button', 'aria-label': title || L('选择文件', 'Choose a file') },
      h('b', { text: title || L('选择文件，或者拖到这里', 'Choose a file, or drop it here') }), hint ? h('small', { text: hint }) : null, input);
    const take = async (files) => {
      for (const f of files) {
        if (f.size > MAX_FILE) { onText(null, f.name, 'big'); continue; }
        try { onText(await f.text(), f.name); } catch { onText(null, f.name, 'read'); }
      }
    };
    box.addEventListener('click', () => input.click());
    box.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); input.click(); } });
    input.addEventListener('click', (e) => e.stopPropagation());
    input.addEventListener('change', () => { take([...input.files]); input.value = ''; });
    box.addEventListener('dragover', (e) => { e.preventDefault(); box.dataset.over = 'true'; });
    box.addEventListener('dragleave', () => { delete box.dataset.over; });
    box.addEventListener('drop', (e) => { e.preventDefault(); delete box.dataset.over; take([...(e.dataTransfer?.files || [])]); });
    const wrap = h('div', {}, box);
    if (paste) {
      const ta = h('textarea', { rows: '6', spellcheck: 'false', placeholder: pasteHint || L('把文件内容贴在这里', 'Paste the file contents here') });
      wrap.append(h('details', { class: 'wb-paste' }, h('summary', { text: L('或者粘贴文字', 'Or paste text') }), ta,
        h('div', { class: 'wb-row' }, btn(L('读入粘贴的内容', 'Read the pasted text'), () => { if (ta.value.trim()) onText(ta.value, ''); }, 'small'))));
    }
    return wrap;
  }
  /** 一组生成的文件：每个一个框，能下载、复制；多个时可以打成 zip。files: [{ name, text }]。 */
  function filesView(files, zipName = 'molastria-workbench.zip') {
    const out = h('div', { class: 'wb-files' });
    if (files.length > 1) out.append(h('div', { class: 'wb-row' }, btn(L(`全部打成 zip（${files.length} 个文件）`, `Download all as zip (${files.length} files)`), () => download(zipName, new Blob([C.zip(files)], { type: 'application/zip' })), 'primary')));
    for (const f of files) {
      const cp = btn(L('复制', 'Copy'), () => copyText(f.text, cp), 'small');
      out.append(h('div', { class: 'wb-file' }, h('div', { class: 'wb-file-h' }, h('span', { text: f.name }), cp, btn(L('下载', 'Download'), () => download(f.name, f.text), 'small')), pre(f.text)));
    }
    return out;
  }

  const ERR = {
    'molden:format': ['这不是 Molden 文件（找不到 [Molden Format] 或 [GTO]）。', 'This is not a Molden file (no [Molden Format] or [GTO] section).'],
    'supercell:nocell': ['这个结构没有晶胞。先载入一个晶体，或者在“晶体与表面”里给它加一个盒子。', 'This structure has no cell. Load a crystal first, or give it a box under “Crystals & surfaces”.'],
    'slab:nocell': ['切表面要先有晶胞（载入 CIF、POSCAR 或一个预设晶体）。', 'Cutting a surface needs a cell (load a CIF, a POSCAR or a preset crystal).'],
    'slab:hkl': ['密勒指数不能全是 0。', 'The Miller indices cannot all be zero.'],
    'cif:nocell': ['CIF 要有晶胞。', 'A CIF needs a cell.'],
    'poscar:nocell': ['POSCAR 要有晶胞。', 'A POSCAR needs a cell.'],
    'hirshfeld:fragments': ['Hirshfeld 面要分里外两部分：先选一个片段（查看器里的“选片段”），而且结构里要有别的分子。', 'A Hirshfeld surface needs an inside and an outside: pick a fragment (“Pick fragment” in the viewer) in a structure that has other molecules too.'],
    'idpp:count': ['两端的原子数不一样。', 'The two ends have different numbers of atoms.'],
    'job:nofiles': ['没有要算的文件。', 'There are no input files.'],
    stopped: ['已停止。', 'Stopped.'],
    load: ['需要的程序库载入失败（要联网访问 cdn.jsdelivr.net）。', 'A library failed to load (needs access to cdn.jsdelivr.net).'],
  };
  function errText(e) {
    const m = String((e && e.message) || e || '');
    if (ERR[m]) return L(...ERR[m]);
    if (/:empty$/.test(m)) return L('这个文件里没读出原子。看看格式对不对。', 'No atoms could be read from this file. Check the format.');
    if (/^smiles:/.test(m)) return smilesErr(m.slice(7));
    if (/^write:/.test(m)) return L('这种格式写不了。', 'That format cannot be written.');
    return L(`出错了：${m}`, `Something went wrong: ${m}`);
  }
  function smilesErr(code) {
    return {
      parse: L('这个 SMILES 读不懂，检查一下括号和环编号。', 'This SMILES could not be parsed; check brackets and ring numbers.'),
      big: L('分子太大（重原子超过 100 个），请直接读入坐标文件。', 'The molecule is too large (over 100 heavy atoms); load a coordinate file instead.'),
      hcount: L('方括号里写的氢数和价态对不上。', 'The hydrogen count in brackets does not fit the valence.'),
      embed: L('搭不出三维结构（可能是太张的环）。', 'Could not build a 3D structure (perhaps a very strained ring).'),
      stereo: L('按写的立体构型搭不出来。', 'No 3D structure matches the stereochemistry as written.'),
      empty: L('先写一个 SMILES。', 'Type a SMILES first.'),
      load: L('OpenChemLib 载入失败（要联网访问 cdn.jsdelivr.net）。', 'OpenChemLib failed to load (needs access to cdn.jsdelivr.net).'),
      stopped: L('已停止。', 'Stopped.'),
    }[code] || L(`SMILES 出错：${code}`, `SMILES error: ${code}`);
  }

  // ── 状态和消息 ───────────────────────────────────────────────────────
  const S = { frames: [], frame: 0, name: 'molecule', charge: 0, mult: 1, smiles: '', source: '', mode: 'rotate', picks: [], measures: [], frag: new Set(), labels: !!prefs.labels, style: prefs.style || 'ballstick', used: new Set(['ester', 'threedmol']), tint: null, cip: null };
  const bus = {};
  const on = (k, f) => (bus[k] = bus[k] || []).push(f);
  const emit = (k, ...a) => { for (const f of bus[k] || []) { try { f(...a); } catch (e) { console.error(e); } } };
  const current = () => S.frames[S.frame] || null;
  const use = (...ids) => { let n = 0; for (const id of ids) if (C.REFS[id] && !S.used.has(id)) { S.used.add(id); n++; } if (n) emit('used'); };
  const cloneAtom = (a) => ({ el: a.el, x: +a.x, y: +a.y, z: +a.z, ...(a.frozen ? { frozen: true } : {}) });
  const cloneFrame = (f) => ({ atoms: (f.atoms || []).map(cloneAtom), cell: f.cell ? f.cell.map((v) => v.slice()) : null, energy: Number.isFinite(f.energy) ? f.energy : null, comment: f.comment || '', ...(f.ff && Number.isFinite(f.energy) ? { ff: f.ff } : {}) });
  const electrons = (atoms, charge = S.charge) => atoms.reduce((s, a) => s + (WB.ZOF[a.el] || 0), 0) - charge;
  const xyzOf = (atoms, title = '') => `${atoms.length}\n${title}\n${atoms.map((a) => `${a.el} ${a.x.toFixed(6)} ${a.y.toFixed(6)} ${a.z.toFixed(6)}`).join('\n')}\n`;
  const formula = (atoms) => (window.MolAstriaMol3D?.formula ? window.MolAstriaMol3D.formula(atoms.map((a) => [a.el])) : ''); // mol3d.js 认 [元素, x, y, z]

  function setFrames(frames, meta = {}) {
    const list = (frames || []).map(cloneFrame).filter((f) => f.atoms.length);
    if (!list.length) return;
    S.frames = list;
    S.frame = Math.max(0, Math.min(list.length - 1, meta.frame || 0));
    if (meta.name) S.name = safeName(meta.name);
    if (Number.isInteger(meta.charge)) S.charge = meta.charge;
    if (Number.isInteger(meta.mult) && meta.mult >= 1) S.mult = meta.mult;
    S.smiles = meta.smiles ?? '';
    S.source = meta.source || '';
    S.picks = []; S.frag = new Set(); S.tint = null; S.cip = null;
    if (!meta.keepMeasures) S.measures = [];
    view.clearSurfaces();
    syncMeta();
    emit('frames');
    view.draw({ fit: !meta.keepView });
    autosave();
  }
  function setFrame(i) {
    if (!S.frames.length) return;
    const k = Math.max(0, Math.min(S.frames.length - 1, i));
    if (k === S.frame) return;
    S.frame = k; S.picks = []; S.tint = null; S.cip = null;
    view.clearSurfaces();
    emit('frame');
    view.draw({ fit: false });
  }
  /** 原子改了（冻结、删除、居中……）：重画，通知。 */
  function edited() { S.cip = null; emit('edit'); view.draw({ fit: false }); autosave(); }

  const compact = (frames) => frames.map((f) => ({ a: f.atoms.map((a) => [a.el, +a.x.toFixed(6), +a.y.toFixed(6), +a.z.toFixed(6), a.frozen ? 1 : 0]), c: f.cell || null, e: Number.isFinite(f.energy) ? f.energy : null, t: f.comment || '' }));
  const okCell = (c) => Array.isArray(c) && c.length === 3 && c.every((v) => Array.isArray(v) && v.length === 3 && v.every(Number.isFinite)) ? c : null;
  const expand = (list) => (Array.isArray(list) ? list : []).slice(0, 5000).map((f) => ({
    atoms: (Array.isArray(f?.a) ? f.a : []).filter((r) => Array.isArray(r) && WB.element(r[0]) && [r[1], r[2], r[3]].every((v) => Number.isFinite(+v)))
      .map(([el, x, y, z, fz]) => ({ el: WB.element(el), x: +x, y: +y, z: +z, ...(fz ? { frozen: true } : {}) })),
    cell: okCell(f?.c), energy: Number.isFinite(f?.e) ? f.e : null, comment: String(f?.t || '').slice(0, 300),
  })).filter((f) => f.atoms.length);
  let saveTimer = 0;
  function autosave() {
    clearTimeout(saveTimer);
    saveTimer = setTimeout(() => {
      if (!S.frames.length) return;
      let frames = S.frames.length > 200 ? [S.frames[S.frame]] : S.frames;
      let last = { frames: compact(frames), frame: frames.length === 1 ? 0 : S.frame, name: S.name, charge: S.charge, mult: S.mult, smiles: S.smiles };
      if (JSON.stringify(last).length > MAX_SAVE) { frames = [S.frames[S.frame]]; last = { ...last, frames: compact(frames), frame: 0 }; }
      if (JSON.stringify(last).length > MAX_SAVE) last = null;
      savePrefs({ last });
    }, 400);
  }

  // ── 3D 查看器 ────────────────────────────────────────────────────────
  const view = (() => {
    let $3D = null, v = null, ready = null, deco = [], cellShapes = [], surfs = [], sid = 0;
    const stage = h('div', { class: 'wb-stage', role: 'img', 'aria-label': L('三维结构', '3D structure') });
    const msg = h('div', { class: 'wb-stage-msg', text: L('还没有结构。在“结构”页读入一个文件、写一个 SMILES，或者点一个例子。', 'No structure yet. Load a file, type a SMILES or pick an example on the Structure tab.') });
    const info = h('div', { class: 'wb-vinfo' }), read = h('div', { class: 'wb-vread' });
    for (const el of [msg, info, read]) el.style.zIndex = '3';
    stage.append(msg, info, read);
    const legend = h('div', { class: 'wb-legend' });
    const dark = () => { const t = document.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); };
    const bg = () => (S.style === 'pub' ? '#ffffff' : dark() ? '#10141c' : '#ffffff');
    function init() {
      if (ready) return ready;
      ready = (window.MolAstriaMol3D ? window.MolAstriaMol3D.load() : Promise.reject(new Error('load'))).then(($) => {
        $3D = $;
        v = $.createViewer(stage, { backgroundColor: bg(), backgroundAlpha: S.style === 'pub' ? 1 : 0, antialias: true });
        const ro = typeof ResizeObserver === 'function' ? new ResizeObserver(() => { v.resize(); v.render(); }) : null;
        ro?.observe(stage);
        new MutationObserver(() => { applyBg(); v.render(); }).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        stage.dataset.ready = 'true';
      }).catch(() => {
        msg.hidden = false; msg.dataset.bad = 'true';
        msg.textContent = L('3D 查看器载入失败（要联网访问 cdn.jsdelivr.net）。读写文件、生成输入这些功能照常能用。', 'The 3D viewer failed to load (needs access to cdn.jsdelivr.net). Reading and writing files and making inputs still work.');
      });
      return ready;
    }
    function applyBg() { if (!v) return; const pub = S.style === 'pub'; stage.dataset.pub = String(pub); v.setBackgroundColor(bg(), pub ? 1 : 0); }
    const STY = {
      ballstick: () => ({ stick: { radius: 0.14, colorscheme: 'Jmol' }, sphere: { scale: 0.25, colorscheme: 'Jmol' } }),
      stick: () => ({ stick: { radius: 0.19, colorscheme: 'Jmol' } }),
      sphere: () => ({ sphere: { scale: 0.95, colorscheme: 'Jmol' } }),
      line: () => ({ line: { colorscheme: 'Jmol', linewidth: 2 } }),
      pub: () => ({ stick: { radius: 0.15, colorscheme: 'Jmol' }, sphere: { scale: 0.27, colorscheme: 'Jmol' } }),
    };
    function applyStyle() {
      const make = STY[S.style] || STY.ballstick;
      const spec = make();
      if (S.tint) { const f = (atom) => S.tint[atom.index] ?? '#cccccc'; for (const k of Object.keys(spec)) { delete spec[k].colorscheme; spec[k].colorfunc = f; } }
      v.setStyle({}, spec);
      if (S.style === 'pub' && !S.tint) v.setStyle({ elem: 'C' }, { stick: { radius: 0.15, color: '#8c8c8c' }, sphere: { scale: 0.27, color: '#8c8c8c' } });
      v.setViewStyle(S.style === 'pub' ? { style: 'outline', color: 'black', width: 0.035 } : { style: '' });
      applyBg();
    }
    function clearDeco() { for (const s of deco) v.removeShape(s); deco = []; v.removeAllLabels(); }
    const P = (a) => ({ x: a.x, y: a.y, z: a.z });
    function decorate() {
      if (!v) return;
      clearDeco();
      const fr = current();
      if (!fr) return;
      const A = fr.atoms;
      A.forEach((a, i) => { if (a.frozen) deco.push(v.addSphere({ center: P(a), radius: 0.48, color: '#3b82f6', opacity: 0.42 })); });
      for (const i of S.frag) if (A[i]) deco.push(v.addSphere({ center: P(A[i]), radius: 0.52, color: '#16a34a', opacity: 0.3 }));
      for (const m of S.measures) {
        if (!m.picks.every((i) => A[i])) continue;
        for (let k = 1; k < m.picks.length; k++) deco.push(v.addCylinder({ start: P(A[m.picks[k - 1]]), end: P(A[m.picks[k]]), radius: 0.035, color: '#9a7b1c', dashed: true, fromCap: 1, toCap: 1 }));
        const c = m.picks.map((i) => A[i]).reduce((s, a) => ({ x: s.x + a.x / m.picks.length, y: s.y + a.y / m.picks.length, z: s.z + a.z / m.picks.length }), { x: 0, y: 0, z: 0 });
        const r = WB.measure(A, m.picks, fr.cell);
        if (r) v.addLabel(`${r.value.toFixed(r.type === 'bond' ? 3 : 1)}${r.unit}`, { position: c, fontSize: 12, fontColor: '#5b4300', backgroundColor: '#fff6d6', backgroundOpacity: 0.85, borderThickness: 0, inFront: true });
      }
      S.picks.forEach((i, k) => {
        if (!A[i]) return;
        deco.push(v.addSphere({ center: P(A[i]), radius: 0.46, color: '#d4a017', opacity: 0.62 }));
        if (k) deco.push(v.addCylinder({ start: P(A[S.picks[k - 1]]), end: P(A[i]), radius: 0.04, color: '#d4a017', dashed: true, fromCap: 1, toCap: 1 }));
      });
      if (S.labels && A.length <= 400) A.forEach((a, i) => v.addLabel(`${a.el}${i + 1}`, { position: P(a), fontSize: 11, fontColor: '#111', backgroundColor: '#ffffff', backgroundOpacity: 0.72, borderThickness: 0, inFront: true }));
      if (S.cip) {
        for (const [i, l] of S.cip.centres) if (A[i]) v.addLabel(l, { position: P(A[i]), fontSize: 14, fontColor: '#ffffff', backgroundColor: '#9a3412', backgroundOpacity: 0.92, borderThickness: 0, inFront: true, alignment: 'center' });
        for (const [i, j, l] of S.cip.bonds) if (A[i] && A[j]) v.addLabel(l, { position: { x: (A[i].x + A[j].x) / 2, y: (A[i].y + A[j].y) / 2, z: (A[i].z + A[j].z) / 2 }, fontSize: 14, fontColor: '#ffffff', backgroundColor: '#1d4ed8', backgroundOpacity: 0.92, borderThickness: 0, inFront: true, alignment: 'center' });
      }
      read.textContent = pickReading();
    }
    function drawCell(cell) {
      for (const s of cellShapes) v.removeShape(s);
      cellShapes = [];
      if (!cell) return;
      const pt = (i, j, k) => ({ x: i * cell[0][0] + j * cell[1][0] + k * cell[2][0], y: i * cell[0][1] + j * cell[1][1] + k * cell[2][1], z: i * cell[0][2] + j * cell[1][2] + k * cell[2][2] });
      const corners = [];
      for (let n = 0; n < 8; n++) corners.push([n & 1, (n >> 1) & 1, (n >> 2) & 1]);
      for (let a = 0; a < 8; a++) for (let b = a + 1; b < 8; b++) {
        const d = (a ^ b);
        if (d === 1 || d === 2 || d === 4) cellShapes.push(v.addCylinder({ start: pt(...corners[a]), end: pt(...corners[b]), radius: 0.03, color: d === 1 ? '#dc2626' : d === 2 ? '#16a34a' : d === 4 ? '#2563eb' : '#888', fromCap: 1, toCap: 1, opacity: 0.8 }));
      }
    }
    async function draw(o = {}) {
      await init();
      const fr = current();
      info.textContent = fr ? infoText() : '';
      if (!v) return;
      v.removeAllModels();
      clearDeco();
      drawCell(fr?.cell || null);
      if (!fr) { msg.hidden = false; v.render(); return; }
      msg.hidden = true;
      v.addModel(xyzOf(fr.atoms, S.name), 'xyz');
      applyStyle();
      v.setClickable({}, true, (atom, _v, ev) => onAtomClick(atom.index, ev));
      decorate();
      if (o.fit) v.zoomTo();
      v.render();
    }
    function infoText() {
      const fr = current();
      const parts = [formula(fr.atoms), L(`${fr.atoms.length} 个原子`, `${fr.atoms.length} atoms`)];
      if (S.frames.length > 1) parts.push(L(`第 ${S.frame + 1} / ${S.frames.length} 帧`, `frame ${S.frame + 1} / ${S.frames.length}`));
      if (fr.cell) { const c = WB.cellParams(fr.cell); parts.push(`a ${c.a.toFixed(2)} b ${c.b.toFixed(2)} c ${c.c.toFixed(2)} Å`); }
      return parts.join(' · ');
    }
    function onAtomClick(i, ev) {
      const fr = current();
      if (!fr || !fr.atoms[i]) return;
      if (S.mode === 'measure') {
        if (S.picks.length >= 4) S.picks = [];
        const at = S.picks.indexOf(i);
        if (at >= 0) S.picks.splice(at, 1); else S.picks.push(i);
        emit('picks');
      } else if (S.mode === 'freeze') {
        const a = fr.atoms[i];
        const on = !a.frozen;
        for (const f of S.frames) if (f.atoms[i]) { if (on) f.atoms[i].frozen = true; else delete f.atoms[i].frozen; }
        emit('edit'); autosave();
      } else if (S.mode === 'fragment') {
        let group = [i];
        if (!ev?.shiftKey) { const fg = WB.fragments(fr.atoms, WB.bonds(fr.atoms, null)); group = fg.list[fg.of[i]] || [i]; }
        const on = !S.frag.has(i);
        for (const j of group) { if (on) S.frag.add(j); else S.frag.delete(j); }
        emit('frag');
      } else {
        S.picks = [i];
        emit('picks');
      }
      decorate(); v.render();
    }
    function pickReading() {
      const fr = current();
      if (!fr || !S.picks.length) return '';
      const A = fr.atoms, lab = S.picks.map((i) => `${A[i].el}${i + 1}`).join('–');
      if (S.picks.length === 1) { const a = A[S.picks[0]]; return `${lab}  (${a.x.toFixed(3)}, ${a.y.toFixed(3)}, ${a.z.toFixed(3)}) Å`; }
      const r = WB.measure(A, S.picks, fr.cell);
      if (!r) return lab;
      const name = { bond: L('距离', 'Distance'), angle: L('键角', 'Angle'), dihedral: L('二面角', 'Dihedral') }[r.type];
      return `${name} ${lab} = ${r.value.toFixed(r.type === 'bond' ? 4 : 2)} ${r.unit}`;
    }

    // 等值面
    function gradient(sc) {
      const G = $3D.Gradient;
      if (sc.type === 'nci') return new G.CustomLinear(sc.min, sc.max, [0x1d4ed8, 0x16a34a, 0xdc2626]);
      return new G.RWB(sc.min, sc.max, sc.mid ?? 0);
    }
    function paintSurface(s) {
      for (const sh of s.shapes) v.removeShape(sh);
      s.shapes = [];
      if (s.hide) return;
      const op = s.opacity ?? 0.85;
      if (s.cvol) s.shapes.push(v.addIsosurface(s.vol, { isoval: s.iso, voldata: s.cvol, volscheme: gradient(s.scheme), opacity: op, smoothness: 1 }));
      else {
        s.shapes.push(v.addIsosurface(s.vol, { isoval: s.iso, color: s.colors[0], opacity: op, smoothness: 1 }));
        if (s.signed) s.shapes.push(v.addIsosurface(s.vol, { isoval: -s.iso, color: s.colors[1], opacity: op, smoothness: 1 }));
      }
    }
    /** o: { label, cube, colorCube?, iso, signed?, colors?: [正, 负], scheme?: { type: 'rwb' | 'nci', min, max, mid }, range: [lo, hi]（滑杆，对数刻度）, opacity, file }。 */
    async function addSurface(o) {
      await init();
      if (!v) return null;
      const s = { id: ++sid, colors: ['#2563eb', '#dc2626'], range: [o.iso / 20, o.iso * 20], ...o, shapes: [] };
      s.vol = new $3D.VolumeData(o.cube, 'cube');
      s.cvol = o.colorCube ? new $3D.VolumeData(o.colorCube, 'cube') : null;
      surfs.push(s);
      paintSurface(s);
      v.render();
      renderLegend();
      return s;
    }
    function removeSurface(s) { for (const sh of s.shapes) v.removeShape(sh); surfs = surfs.filter((x) => x !== s); renderLegend(); v.render(); }
    function clearSurfaces() { if (v) for (const s of surfs) for (const sh of s.shapes) v.removeShape(sh); surfs = []; renderLegend(); }
    function renderLegend() {
      legend.replaceChildren(...surfs.map((s) => {
        const [lo, hi] = s.range;
        const toT = (x) => Math.round(1000 * Math.log(x / lo) / Math.log(hi / lo));
        const fromT = (t) => lo * (hi / lo) ** (t / 1000);
        const out = h('output', { text: `${s.signed ? '±' : ''}${s.iso.toPrecision(3)}` });
        let timer = 0;
        const slider = h('input', { type: 'range', min: '0', max: '1000', value: String(toT(s.iso)), 'aria-label': L('等值', 'Isovalue') });
        slider.addEventListener('input', () => {
          s.iso = fromT(Number(slider.value)); out.textContent = `${s.signed ? '±' : ''}${s.iso.toPrecision(3)}`;
          clearTimeout(timer); timer = setTimeout(() => { paintSurface(s); v.render(); }, 120);
        });
        const op = h('input', { type: 'range', min: '15', max: '100', value: String(Math.round((s.opacity ?? 0.85) * 100)), 'aria-label': L('不透明度', 'Opacity'), style: 'flex:0 1 80px' });
        op.addEventListener('change', () => { s.opacity = Number(op.value) / 100; paintSurface(s); v.render(); });
        const sw = s.cvol ? h('span', { class: 'wb-grad', style: s.scheme.type === 'nci' ? 'background:linear-gradient(90deg,#1d4ed8,#16a34a,#dc2626)' : 'background:linear-gradient(90deg,#dc2626,#fff,#2563eb)', title: `${s.scheme.min} … ${s.scheme.max}` })
          : h('span', {}, h('span', { class: 'wb-swatch', style: `display:inline-block;background:${s.colors[0]}` }), s.signed ? h('span', { class: 'wb-swatch', style: `display:inline-block;margin-left:2px;background:${s.colors[1]}` }) : null);
        const hide = h('button', { type: 'button', class: 'wb-btn small', 'aria-pressed': String(!!s.hide), text: L('隐藏', 'Hide') });
        hide.addEventListener('click', () => { s.hide = !s.hide; hide.setAttribute('aria-pressed', String(s.hide)); paintSurface(s); v.render(); });
        return h('div', { class: 'wb-surf', 'data-surface': s.kind || '' }, sw, h('b', { text: s.label }), slider, out, op,
          s.file ? btn(L('cube', 'cube'), () => download(s.file, s.cube), 'small', { title: L('下载这个格点数据（Gaussian cube）', 'Download this grid (Gaussian cube)') }) : null,
          hide, h('button', { type: 'button', class: 'wb-x', text: L('移除', 'Remove'), onclick: () => removeSurface(s) }));
      }));
    }
    const png = () => (v ? v.pngURI() : null);
    return { stage, legend, init, draw, decorate: () => { if (v) { decorate(); v.render(); } }, restyle: () => { if (v && current()) { applyStyle(); v.render(); } }, addSurface, clearSurfaces, png, fit: () => { if (v) { v.zoomTo(); v.render(); } }, get viewer() { return v; }, get lib() { return $3D; }, surfaces: () => surfs.slice(), info: () => (info.textContent = current() ? infoText() : '') };
  })();

  // ── 画图（SVG，悬停读数，点一下选点）─────────────────────────────────
  const SVGNS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  function sv(tag, attrs = {}, text) { const el = document.createElementNS(SVGNS, tag); for (const [k, v] of Object.entries(attrs)) if (v != null) el.setAttribute(k, v); if (text != null) el.textContent = text; return el; }
  function niceTicks(lo, hi, n = 6) {
    const span = hi - lo || 1, raw = span / n, mag = 10 ** Math.floor(Math.log10(raw)), f = raw / mag;
    const step = (f < 1.5 ? 1 : f < 3 ? 2 : f < 7 ? 5 : 10) * mag;
    const out = [];
    for (let t = Math.ceil(lo / step - 1e-9) * step; t <= hi + step * 1e-9 && out.length < 40; t += step) out.push(Math.abs(t) < step * 1e-9 ? 0 : t);
    return { ticks: out, step };
  }
  const tickFmt = (v, step) => v.toFixed(Math.min(6, Math.max(0, -Math.floor(Math.log10(step) + 1e-9))));
  /**
   * spec: { series: [{ x, y, kind: 'line' | 'sticks' | 'points', color, width, dash, name }], xLabel, yLabel, xRange, yRange, reverseX, logY,
   *         markers: [{ x, text }], hline: [{ y, text }], highlight: { s, i }, pick: 序号（悬停和点选用哪条线）, onPick(i), tip(i) → 文字, h }
   */
  function plot(spec) {
    const W = spec.w || 640, H = spec.h || 280, m = { l: 64, r: 16, t: 14, b: 44 };
    const wrap = h('div', { class: 'wb-plot' });
    const series = spec.series.filter((s) => s && s.x && s.x.length);
    if (!series.length) return wrap;
    const ty = (v) => (spec.logY ? Math.log10(v) : v);
    const xs = series.flatMap((s) => s.x).filter(Number.isFinite), ys = series.flatMap((s) => s.y.map(ty)).filter(Number.isFinite);
    let [x0, x1] = spec.xRange || [Math.min(...xs), Math.max(...xs)];
    if (x1 === x0) { x0 -= 1; x1 += 1; }
    let [y0, y1] = spec.yRange ? spec.yRange.map(ty) : [Math.min(...ys), Math.max(...ys)];
    if (!spec.logY && series.some((s) => s.kind === 'sticks')) y0 = Math.min(y0, 0);
    if (y1 === y0) { y0 -= 1; y1 += 1; }
    if (!spec.yRange) { const p = (y1 - y0) * 0.07; y1 += p; if (y0 !== 0 || spec.logY) y0 -= p; }
    const iw = W - m.l - m.r, ih = H - m.t - m.b;
    const X = (v) => m.l + (spec.reverseX ? (x1 - v) : (v - x0)) / (x1 - x0) * iw;
    const Y = (v) => m.t + ih - (ty(v) - y0) / (y1 - y0) * ih;
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': spec.label || `${spec.yLabel || ''} / ${spec.xLabel || ''}` });
    const cid = `wbclip${++uid}`;
    const defs = sv('defs'); const cp = sv('clipPath', { id: cid }); cp.append(sv('rect', { x: m.l, y: m.t, width: iw, height: ih })); defs.append(cp); svg.append(defs);
    const xt = niceTicks(x0, x1, spec.xTicks || 7);
    for (const t of xt.ticks) { svg.append(sv('line', { class: 'grid', x1: X(t), x2: X(t), y1: m.t, y2: m.t + ih })); svg.append(sv('text', { x: X(t), y: m.t + ih + 16, 'text-anchor': 'middle' }, tickFmt(t, xt.step))); }
    if (spec.logY) {
      for (let p = Math.ceil(y0); p <= Math.floor(y1); p++) { const yy = m.t + ih - (p - y0) / (y1 - y0) * ih; svg.append(sv('line', { class: 'grid', x1: m.l, x2: m.l + iw, y1: yy, y2: yy })); svg.append(sv('text', { x: m.l - 6, y: yy + 4, 'text-anchor': 'end' }, `1e${p}`)); }
    } else {
      const yt = niceTicks(y0, y1, 5);
      for (const t of yt.ticks) { svg.append(sv('line', { class: 'grid', x1: m.l, x2: m.l + iw, y1: Y(t), y2: Y(t) })); svg.append(sv('text', { x: m.l - 6, y: Y(t) + 4, 'text-anchor': 'end' }, tickFmt(t, yt.step))); }
    }
    svg.append(sv('path', { class: 'ax', d: `M${m.l} ${m.t}V${m.t + ih}H${m.l + iw}` }));
    if (spec.xLabel) svg.append(sv('text', { class: 'lab', x: m.l + iw / 2, y: H - 6, 'text-anchor': 'middle' }, spec.xLabel));
    if (spec.yLabel) svg.append(sv('text', { class: 'lab', x: 14, y: m.t + ih / 2, 'text-anchor': 'middle', transform: `rotate(-90 14 ${m.t + ih / 2})` }, spec.yLabel));
    const g = sv('g', { 'clip-path': `url(#${cid})` });
    for (const hl of spec.hline || []) { g.append(sv('line', { class: 'mk', x1: m.l, x2: m.l + iw, y1: Y(hl.y), y2: Y(hl.y) })); if (hl.text) g.append(sv('text', { class: 'mkt', x: m.l + iw - 4, y: Y(hl.y) - 4, 'text-anchor': 'end' }, hl.text)); }
    series.forEach((s, si) => {
      const color = s.color || ['var(--accent)', 'var(--gold)', 'var(--info,#2563eb)', 'var(--danger)'][si % 4];
      const st = `stroke:${color};${s.width ? `stroke-width:${s.width};` : ''}${s.dash ? `stroke-dasharray:${s.dash};` : ''}`;
      if (s.kind === 'sticks') {
        const base = Y(spec.logY ? 10 ** y0 : Math.max(y0, 0));
        s.x.forEach((x, i) => { if (Number.isFinite(x) && Number.isFinite(s.y[i])) g.append(sv('line', { class: 'stk', style: st, x1: X(x), x2: X(x), y1: base, y2: Y(s.y[i]) })); });
      } else {
        let d = '', pen = false;
        s.x.forEach((x, i) => { const y = s.y[i]; if (!Number.isFinite(x) || !Number.isFinite(ty(y))) { pen = false; return; } d += `${pen ? 'L' : 'M'}${X(x).toFixed(1)} ${Y(y).toFixed(1)}`; pen = true; });
        if (s.kind !== 'points') g.append(sv('path', { class: 'ser', style: st, d }));
        if (s.kind === 'points' || s.dots) s.x.forEach((x, i) => { if (Number.isFinite(ty(s.y[i]))) g.append(sv('circle', { class: 'pt', cx: X(x), cy: Y(s.y[i]), r: 3.6, style: `fill:${color}` })); });
      }
    });
    // 竖线的标注：挨得近的错开到下一行，不叠在一起
    const rows = [];
    for (const mk of (spec.markers || []).map((k) => ({ ...k, px: X(k.x) })).sort((a, b) => a.px - b.px)) {
      g.append(sv('line', { class: 'mk', x1: mk.px, x2: mk.px, y1: m.t, y2: m.t + ih }));
      if (!mk.text) continue;
      let r = rows.findIndex((end) => mk.px + 4 >= end);
      if (r < 0) r = rows.length;
      rows[r] = mk.px + 4 + String(mk.text).length * 7 + 4;
      g.append(sv('text', { class: 'mkt', x: mk.px + 4, y: m.t + 12 + r * 13 }, mk.text));
    }
    if (spec.highlight) { const s = series[spec.highlight.s || 0], i = spec.highlight.i; if (s && Number.isFinite(s.y[i])) g.append(sv('circle', { class: 'hl', cx: X(s.x[i]), cy: Y(s.y[i]), r: 6 })); }
    svg.append(g);
    const tip = h('div', { class: 'wb-tip', hidden: true });
    const ps = series[spec.pick || 0];
    const nearest = (e) => {
      const r = svg.getBoundingClientRect(), px = (e.clientX - r.left) / r.width * W;
      let best = -1, bd = Infinity;
      ps.x.forEach((x, i) => { const d = Math.abs(X(x) - px); if (d < bd && Number.isFinite(ps.y[i])) { bd = d; best = i; } });
      return best;
    };
    svg.addEventListener('pointermove', (e) => {
      const i = nearest(e);
      if (i < 0) { tip.hidden = true; return; }
      tip.hidden = false;
      tip.textContent = spec.tip ? spec.tip(i) : `${ps.x[i].toPrecision(5)}, ${ps.y[i].toPrecision(5)}`;
      tip.style.left = `${(X(ps.x[i]) / W) * 100}%`; tip.style.top = `${(Y(ps.y[i]) / H) * 100}%`;
    });
    svg.addEventListener('pointerleave', () => { tip.hidden = true; });
    if (spec.onPick) { svg.style.cursor = 'pointer'; svg.addEventListener('click', (e) => { const i = nearest(e); if (i >= 0) spec.onPick(i); }); }
    wrap.append(svg, tip);
    return wrap;
  }
  /** 曲线 → CSV。cols: [[表头, 数组]]。 */
  const csv = (cols) => [cols.map((c) => c[0]).join(','), ...cols[0][1].map((_, i) => cols.map((c) => (Number.isFinite(c[1][i]) ? +c[1][i].toPrecision(10) : c[1][i] ?? '')).join(','))].join('\n') + '\n';

  /** 轨道能级图。alpha / beta: [{ e（Eh）, occ, i（在源里的下标）}]。pick(spin, i)。selected: { spin, i }。 */
  function levels({ alpha, beta, pick, selected, span = 7 }) {
    const W = 520, H = 360, m = { t: 14, b: 26 };
    const cols = beta ? [['alpha', alpha], ['beta', beta]] : [['alpha', alpha]];
    const win = cols.map(([spin, list]) => {
      const s = list.slice().sort((a, b) => a.e - b.e);
      const ho = s.reduce((k, o, j) => (o.occ > 0.5 ? j : k), -1);
      return { spin, list: s.slice(Math.max(0, ho - span), Math.min(s.length, ho + span + 2)), homo: s[ho], lumo: s[ho + 1] };
    });
    const all = win.flatMap((w) => w.list.map((o) => o.e * C.HARTREE_EV));
    const lo = Math.min(...all), hi = Math.max(...all), pad = (hi - lo || 1) * 0.06;
    const Y = (e) => m.t + (H - m.t - m.b) * (1 - (e * C.HARTREE_EV - lo + pad) / (hi - lo + 2 * pad));
    const svg = sv('svg', { viewBox: `0 0 ${W} ${H}`, role: 'img', 'aria-label': L('轨道能级图', 'Orbital level diagram') });
    const cw = W / cols.length;
    win.forEach((w, c) => {
      const x0 = c * cw + 60, x1 = (c + 1) * cw - 90;
      if (beta) svg.append(sv('text', { x: (x0 + x1) / 2, y: H - 6, 'text-anchor': 'middle' }, w.spin === 'alpha' ? 'α' : 'β'));
      // 简并的能级并排画
      const groups = [];
      for (const o of w.list) { const g = groups[groups.length - 1]; if (g && Math.abs(g[0].e - o.e) * C.HARTREE_EV < 0.01) g.push(o); else groups.push([o]); }
      const labels = [];
      for (const gr of groups) {
        const n = gr.length, gw = (x1 - x0) / n;
        gr.forEach((o, k) => {
          const y = Y(o.e), a = x0 + k * gw + 3, b = x0 + (k + 1) * gw - 3;
          const on = selected && selected.spin === w.spin && selected.i === o.i;
          const ln = sv('line', { class: `lv${o.occ > 0.5 ? ' occ' : ''}${on ? ' on' : ''}`, x1: a, x2: b, y1: y, y2: y });
          const hit = sv('line', { class: 'hit', x1: a, x2: b, y1: y, y2: y });
          const t = sv('title', {}, `${w.spin} #${o.i + 1}  ${(o.e * C.HARTREE_EV).toFixed(3)} eV  occ ${o.occ}`);
          hit.append(t);
          if (pick) for (const el of [ln, hit]) el.addEventListener('click', () => pick(w.spin, o.i));
          svg.append(ln, hit);
        });
        const o = gr[0];
        labels.push({ o, y: Y(o.e), tag: o === w.homo ? 'HOMO' : o === w.lumo ? 'LUMO' : '' });
      }
      // 能量的数字：HOMO、LUMO 一定写，其余的和已经写了的隔不到 11 个单位就不写（悬停仍能看到）
      const kept = [];
      for (const lb of [...labels.filter((l) => l.tag), ...labels.filter((l) => !l.tag)]) {
        if (!lb.tag && kept.some((k) => Math.abs(k.y - lb.y) < 11)) continue;
        kept.push(lb);
        svg.append(sv('text', { class: lb.tag ? 'fr' : '', x: x1 + 6, y: lb.y + 4 }, `${(lb.o.e * C.HARTREE_EV).toFixed(2)}${lb.tag ? ' ' + lb.tag : ''}`));
      }
      if (w.homo && w.lumo) {
        const gap = (w.lumo.e - w.homo.e) * C.HARTREE_EV, ym = (Y(w.homo.e) + Y(w.lumo.e)) / 2;
        svg.append(sv('text', { x: x0 - 6, y: ym + 4, 'text-anchor': 'end' }, `Δ ${gap.toFixed(2)}`));
      }
    });
    svg.append(sv('text', { x: 4, y: 12 }, 'eV'));
    return h('div', { class: 'wb-levels' }, svg);
  }

  // ── Web Worker（格点计算）───────────────────────────────────────────
  let worker = null, jobId = 0;
  const jobs = new Map();
  function runJob(msg, onProgress) {
    if (!worker) {
      try { worker = new Worker('wb-worker.js'); } catch (e) { return Promise.reject(e); }
      worker.onmessage = (ev) => {
        const d = ev.data || {}, j = jobs.get(d.id);
        if (!j) return;
        if (d.type === 'progress') { j.onProgress?.(d.k, d.n); return; }
        jobs.delete(d.id);
        if (d.type === 'done') j.resolve(d); else j.reject(new Error(d.message || 'error'));
      };
      worker.onerror = (e) => { e.preventDefault?.(); stopJobs('load'); };
    }
    const id = ++jobId;
    return new Promise((resolve, reject) => { jobs.set(id, { resolve, reject, onProgress }); worker.postMessage({ ...msg, id }); });
  }
  function stopJobs(why = 'stopped') {
    if (worker) worker.terminate();
    worker = null;
    for (const j of jobs.values()) j.reject(new Error(why));
    jobs.clear();
  }
  /** 一条进度条。set(k, n)；done() 收起。 */
  function progress() {
    const bar = h('i'), el = h('div', { class: 'wb-prog', hidden: true }, bar);
    return { el, set(k, n) { el.hidden = false; bar.style.width = `${Math.round((100 * (k + 1)) / Math.max(1, n))}%`; }, done() { el.hidden = true; bar.style.width = '0'; } };
  }

  // ── 读入任何文件 ─────────────────────────────────────────────────────
  const fromBohr = (atoms) => atoms.map((a) => ({ el: a.el || WB.SYMBOLS[(a.Z || 1) - 1] || 'X', x: a.x * WB.BOHR, y: a.y * WB.BOHR, z: a.z * WB.BOHR }));
  // OpenChemLib（BSD-3）只在标 R/S 时载入（约 1.1 MB，和 smiles3d.js 同一个版本，浏览器会复用缓存）
  let oclPromise = null;
  const loadOCL = () => (oclPromise = oclPromise || import(`${window.MolAstriaSmiles3D?.BASE || 'https://cdn.jsdelivr.net/npm/openchemlib@9.25.1/dist/'}openchemlib.js`).catch(() => { oclPromise = null; throw new Error('load'); }));
  async function smilesTo3D(smi, { conformers = 6, wide = false, onProgress } = {}) {
    if (!window.MolAstriaSmiles3D) throw new Error('smiles:load');
    let r;
    try { r = await window.MolAstriaSmiles3D.run(String(smi).trim(), { opts: { conformers, wide }, onProgress }); } catch (e) { throw new Error(`smiles:${/stopped/.test(e.message) ? 'stopped' : 'load'}`); }
    if (!r || r.error) throw new Error(`smiles:${r ? r.error : 'load'}`);
    use('mmff');
    // 力场给的是 kcal/mol；帧里的能量一律存 Eh（构象归簇、能量曲线都按 Eh 算），ff 记下是哪个力场的能量
    return { ...r, frames: r.frames.map((f) => ({ ...f, energy: Number.isFinite(f.energy) ? f.energy / WB.HARTREE_KCAL : null, ff: Number.isFinite(f.energy) ? 'MMFF94s+' : undefined })) };
  }
  /** 读一个文件（或一段文字）。返回 { kind: 'structure' | 'molden' | 'cube', frames, meta, note }。 */
  async function readAny(text, name = '') {
    const t = String(text || '');
    if (/\[Molden Format\]|\[GTO\]/i.test(t)) {
      const w = F.parseMolden(t);
      return { kind: 'molden', frames: [{ atoms: fromBohr(w.atoms), cell: null, comment: 'molden' }], meta: { name: name.replace(/\.\w+$/, '') }, molden: t, wfn: w };
    }
    const fmt = WB.detectFormat(t, name);
    if (fmt === 'cube') {
      const c = F.parseCube(t);
      return { kind: 'cube', frames: [{ atoms: fromBohr(c.atoms), cell: null, comment: c.title || 'cube' }], meta: { name: name.replace(/\.\w+$/, '') }, cube: t, parsed: c };
    }
    const Code = window.MolAstriaCode;
    // 程序输出（Gaussian 的 .log、ORCA 的 .out……）：输出里会抄一遍输入（“* xyz 0 1”、route 行），所以要先认输出，再按结构格式读
    const prog = Code && !/^\s*\d+\s*\n/.test(t) && !['cif', 'pdb', 'mol', 'cdxml', 'poscar'].includes(fmt) ? Code.detect(t) : '';
    if (prog) {
      const r = Code.parseOutput(t, prog);
      if (!r.geoms.length) throw new Error('output:nogeom');
      const E = r.steps.length === r.geoms.length ? r.steps : [];
      return { kind: 'structure', frames: r.geoms.map((g, k) => ({ atoms: g, cell: null, energy: Number.isFinite(E[k]) ? E[k] : null, comment: `${prog} step ${k + 1}` })), meta: { name: name.replace(/\.\w+$/, ''), frame: r.geoms.length - 1 }, note: L(`从 ${prog} 输出里读出 ${r.geoms.length} 个结构（显示最后一个）。`, `Read ${r.geoms.length} geometries from the ${prog} output (showing the last).`), output: t, program: prog };
    }
    const r = WB.parseAny(t, name);
    if (r.format === 'cdxml') {
      if (!r.molblock) throw new Error('cdxml:empty');
      const RD = window.ChemLab?.loadRDKit ? await window.ChemLab.loadRDKit().catch(() => null) : null;
      if (!RD) throw new Error('load');
      const mol = RD.get_mol(r.molblock);
      if (!mol) throw new Error('cdxml:empty');
      const smi = mol.get_smiles(); mol.delete();
      const g = await smilesTo3D(smi);
      return { kind: 'structure', frames: [g.frames[0]], meta: { name: name.replace(/\.\w+$/, '') || 'cdxml', smiles: smi, charge: g.charge, mult: g.mult }, note: L(`CDXML 里读出 ${r.atoms} 个原子、${r.bonds} 根键，转成 SMILES ${smi} 再搭三维结构（ChemDraw 的二维坐标没有用）。`, `Read ${r.atoms} atoms and ${r.bonds} bonds from the CDXML, turned them into the SMILES ${smi} and built 3D coordinates (ChemDraw's 2D layout is not used).`) };
    }
    const notes = [];
    if (r.notes.includes('ragged')) notes.push(L('各帧的原子数不一样，有的功能只看当前帧。', 'The frames have different atom counts; some tools use only the current frame.'));
    if (r.notes.includes('partial-occupancy')) notes.push(L('CIF 里有部分占据的位置，全部按占满写进来了。', 'The CIF has partially occupied sites; all of them were kept as full atoms.'));
    if (r.notes.includes('flat')) notes.push(L('这是二维结构（z 全是 0）。要三维坐标请用 SMILES 生成。', 'This is a 2D structure (all z = 0). Use the SMILES route for 3D coordinates.'));
    const fmtName = { xyz: 'XYZ', pdb: 'PDB', mol: 'MOL/SDF', cif: 'CIF', poscar: 'POSCAR', gjf: 'Gaussian', orca: 'ORCA' }[r.format] || r.format;
    notes.unshift(L(`读成 ${fmtName}：${r.frames.length} 帧，${r.frames[0].atoms.length} 个原子。`, `Read as ${fmtName}: ${r.frames.length} frame${r.frames.length > 1 ? 's' : ''}, ${r.frames[0].atoms.length} atoms.`));
    return { kind: 'structure', frames: r.frames, meta: { name: name.replace(/\.\w+$/, ''), charge: r.charge, mult: r.mult }, note: notes.join(' '), energyUnit: r.energyUnit };
  }

  // ── 例子 ─────────────────────────────────────────────────────────────
  const X = (s) => s.trim().split('\n').map((l) => { const [el, x, y, z] = l.trim().split(/\s+/); return { el, x: +x, y: +y, z: +z }; });
  const EXAMPLES = {
    aspirin: { zh: '阿司匹林', en: 'Aspirin', smiles: 'CC(=O)Oc1ccccc1C(=O)O', atoms: X(`C -2.384207 -0.628262 2.411516
C -1.672755 0.017219 1.260260
O -2.231685 0.601589 0.340907
O -0.302069 -0.140054 1.433309
C 0.435839 0.355326 0.354232
C 1.006794 1.622520 0.511036
C 1.778360 2.163098 -0.515719
C 1.987463 1.435483 -1.686819
C 1.430668 0.160547 -1.832616
C 0.651795 -0.399412 -0.807864
C 0.081135 -1.765434 -0.944136
O -0.538472 -2.390208 -0.103119
O 0.320075 -2.306386 -2.154561
H -2.131814 -0.110066 3.339824
H -2.110268 -1.684540 2.472723
H -3.464269 -0.560589 2.252914
H 0.844034 2.188199 1.424142
H 2.215474 3.152490 -0.404535
H 2.587498 1.858845 -2.489204
H 1.615412 -0.388847 -2.753028
H -0.119008 -3.181520 -2.109261`) },
    water2: { zh: '水二聚体（S22 几何）', en: 'Water dimer (S22 geometry)', atoms: X(`O -1.551007 -0.114520 0.000000
H -1.934259 0.762503 0.000000
H -0.599677 0.040712 0.000000
O 1.350625 0.111469 0.000000
H 1.680398 -0.373741 -0.758561
H 1.680398 -0.373741 0.758561`) },
    formaldehyde: { zh: '甲醛（和示例 Molden 同一个几何）', en: 'Formaldehyde (same geometry as the sample Molden)', smiles: 'C=O', atoms: X(`C 0 0 -0.5265
O 0 0 0.6795
H 0 0.9374 -1.1135
H 0 -0.9374 -1.1135`) },
    butane: { zh: '正丁烷（试二面角扫描、构象）', en: 'n-Butane (try a dihedral scan or conformers)', smiles: 'CCCC', atoms: X(`C -1.326003 -1.409453 0.024905
C 0.039176 -0.754435 -0.111780
C -0.039176 0.754435 0.111779
C 1.326003 1.409453 -0.024905
H -1.246695 -2.488713 -0.138889
H -2.030343 -1.005279 -0.709192
H -1.740655 -1.247172 1.024943
H 0.439684 -0.962769 -1.110765
H 0.727739 -1.203299 0.613604
H -0.727739 1.203299 -0.613605
H -0.439684 0.962768 1.110764
H 1.246694 2.488713 0.138888
H 1.740656 1.247173 -1.024943
H 2.030342 1.005280 0.709193`) },
    nh3: { zh: '氨的翻转：两帧是反应的两端（试 IDPP 路径）', en: 'Ammonia inversion: the two frames are the two ends (try the IDPP path)', frames: [
      { atoms: X('N 0 0 0.1165\nH 0.9377 0 -0.2718\nH -0.4689 0.8121 -0.2718\nH -0.4689 -0.8121 -0.2718'), comment: 'reactant' },
      { atoms: X('N 0 0 -0.1165\nH 0.9377 0 0.2718\nH -0.4689 0.8121 0.2718\nH -0.4689 -0.8121 0.2718'), comment: 'product' }] },
  };
  function loadExample(id) {
    const ex = EXAMPLES[id];
    if (!ex) return;
    setFrames(ex.frames || [{ atoms: ex.atoms, comment: ex.en }], { name: id, charge: 0, mult: 1, smiles: ex.smiles || '', source: 'example' });
  }

  // ── 页面骨架 ─────────────────────────────────────────────────────────
  const registered = (window.MOLASTRIA_WB_TABS || []).filter((t) => t && t.id && typeof t.build === 'function');
  const TABS = [
    { id: 'build', n: 1, zh: '结构', en: 'Structure', build: buildTab },
    { id: 'crystal', n: 2, zh: '晶体与表面', en: 'Crystals & surfaces', build: crystalTab },
    ...registered,
    { id: 'project', n: 9, zh: '项目与引用', en: 'Project & citations', build: projectTab },
  ].sort((a, b) => a.n - b.n);
  const tabBar = h('div', { class: 'wb-tabs', role: 'tablist', 'aria-label': L('工作台的功能', 'Workbench tools') });
  const panels = h('div', { class: 'wb-panels' });
  const ctx = {
    h, L, en, ico, btn, field, sel, numIn, check, card, pre, val, status, fmt, pct, download, copyText, fileBox, filesView, errText, safeName, csv,
    WB, C, F, S, on, emit, current, setFrames, setFrame, edited, use, view, plot, levels, runJob, stopJobs, progress, readAny, smilesTo3D, electrons, xyzOf, formula, fromBohr,
    show: (id) => show(id, true),
  };
  function show(id, push) {
    if (!TABS.some((t) => t.id === id)) id = 'build';
    for (const t of TABS) { t.tabEl.setAttribute('aria-selected', String(t.id === id)); t.tabEl.tabIndex = t.id === id ? 0 : -1; t.panel.hidden = t.id !== id; }
    document.body.dataset.tab = id;
    if (push) { try { history.replaceState(null, '', `${location.pathname}${location.search}#${id}`); } catch { /* file:// */ } }
    savePrefs({ tab: id });
    emit('tab', id);
  }
  TABS.forEach((t, k) => {
    t.tabEl = h('button', { type: 'button', role: 'tab', class: 'wb-tab', id: `wb-t-${t.id}`, 'aria-controls': `wb-p-${t.id}`, onclick: () => show(t.id, true) }, h('b', { text: String(k + 1) }), L(t.zh, t.en));
    t.panel = h('div', { role: 'tabpanel', id: `wb-p-${t.id}`, 'aria-labelledby': `wb-t-${t.id}`, hidden: true });
    tabBar.append(t.tabEl);
    panels.append(t.panel);
  });
  tabBar.addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.findIndex((t) => t.tabEl === document.activeElement);
    if (i < 0) return;
    const j = (i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length;
    TABS[j].tabEl.focus(); show(TABS[j].id, true);
  });

  // 查看器那一栏
  const styleSel = sel([['ballstick', L('球棍', 'Ball and stick')], ['stick', L('棍', 'Sticks')], ['sphere', L('空间填充', 'Space filling')], ['line', L('线', 'Lines')], ['pub', L('出版风格（白底描边）', 'Publication (white, outlined)')]], S.style, { 'aria-label': L('样式', 'Style') });
  styleSel.addEventListener('change', () => { S.style = styleSel.value; savePrefs({ style: S.style }); view.restyle(); });
  const labelBtn = btn(L('原子编号', 'Atom labels'), () => { S.labels = !S.labels; labelBtn.setAttribute('aria-pressed', String(S.labels)); savePrefs({ labels: S.labels }); view.decorate(); }, 'small', { 'aria-pressed': String(S.labels) });
  const MODES = [['rotate', L('旋转', 'Rotate')], ['measure', L('测量', 'Measure')], ['freeze', L('冻结', 'Freeze')], ['fragment', L('选片段', 'Pick fragment')]];
  const HINT = {
    rotate: L('拖动旋转，滚轮缩放，右键平移。点一个原子看坐标。', 'Drag to rotate, scroll to zoom, right-drag to pan. Click an atom for its coordinates.'),
    measure: L('依次点 2、3、4 个原子量距离、键角、二面角；再点一次取消。量好了按“记下”，反应路径页能把它用作约束或扫描坐标。', 'Click 2, 3 or 4 atoms for a distance, angle or dihedral; click again to deselect. “Keep” stores it for the reaction-path tab (constraints, scans).'),
    freeze: L('点原子冻结或解冻（蓝色）。导出 Gaussian、POSCAR 和写路径输入时会带上。', 'Click atoms to freeze or unfreeze them (blue). Gaussian and POSCAR exports and the path inputs use them.'),
    fragment: L('点一个原子选中它所在的整个分子（绿色），按住 Shift 只选这一个原子。Hirshfeld 面和 IGM 用它分里外。', 'Click an atom to select its whole molecule (green); hold Shift to toggle just that atom. The Hirshfeld surface and IGM use this to split inside and outside.'),
  };
  const modeHint = h('p', { class: 'wb-modehint', text: HINT[S.mode] });
  const seg = h('div', { class: 'wb-seg', role: 'group', 'aria-label': L('点原子做什么', 'What a click does') }, MODES.map(([k, t]) => h('button', { type: 'button', 'data-mode': k, 'aria-pressed': String(S.mode === k), text: t, onclick: () => setMode(k) })));
  function setMode(k) {
    S.mode = k;
    for (const b of seg.children) b.setAttribute('aria-pressed', String(b.dataset.mode === k));
    modeHint.textContent = HINT[k];
    if (k !== 'measure' && S.picks.length > 1) { S.picks = []; emit('picks'); view.decorate(); }
  }
  const keepBtn = btn(L('记下', 'Keep'), () => {
    if (S.picks.length < 2) return;
    const type = ['', '', 'bond', 'angle', 'dihedral'][S.picks.length];
    S.measures.push({ type, picks: S.picks.slice() });
    S.picks = [];
    emit('picks'); emit('measures'); view.decorate();
  }, 'small', { hidden: true });
  const clearPick = btn(L('清除选择', 'Clear'), () => { S.picks = []; S.frag = new Set(); emit('picks'); emit('frag'); view.decorate(); }, 'small');
  on('picks', () => { keepBtn.hidden = S.picks.length < 2; });
  const chargeIn = numIn(S.charge, { min: -20, max: 20, step: 1, attrs: { 'aria-label': L('电荷', 'Charge') } });
  const multIn = numIn(S.mult, { min: 1, max: 20, step: 1, attrs: { 'aria-label': L('多重度', 'Multiplicity') } });
  const nameIn = h('input', { type: 'text', value: S.name, spellcheck: 'false', 'aria-label': L('名字（文件名用）', 'Name (used for file names)'), class: 'mono' });
  chargeIn.addEventListener('change', () => { S.charge = Math.round(val(chargeIn)); emit('meta'); autosave(); });
  multIn.addEventListener('change', () => { S.mult = Math.max(1, Math.round(val(multIn, 1))); emit('meta'); autosave(); });
  nameIn.addEventListener('change', () => { S.name = safeName(nameIn.value); nameIn.value = S.name; emit('meta'); autosave(); });
  function syncMeta() { chargeIn.value = String(S.charge); multIn.value = String(S.mult); nameIn.value = S.name; }
  const frameRange = h('input', { type: 'range', min: '1', max: '1', value: '1', 'aria-label': L('帧', 'Frame') });
  const frameNum = h('span');
  let playing = 0;
  const playBtn = btn(L('播放', 'Play'), () => {
    if (playing) { clearInterval(playing); playing = 0; playBtn.textContent = L('播放', 'Play'); return; }
    playBtn.textContent = L('停', 'Stop');
    playing = setInterval(() => { if (S.frame >= S.frames.length - 1) setFrame(0); else setFrame(S.frame + 1); }, 140);
  }, 'small');
  frameRange.addEventListener('input', () => setFrame(Number(frameRange.value) - 1));
  const frameBox = h('div', { class: 'wb-frames', hidden: true }, playBtn, frameRange, frameNum);
  const syncFrames = () => {
    frameBox.hidden = S.frames.length < 2;
    frameRange.max = String(S.frames.length); frameRange.value = String(S.frame + 1);
    const fr = current();
    frameNum.textContent = `${S.frame + 1} / ${S.frames.length}${fr && Number.isFinite(fr.energy) ? `  E = ${fr.energy.toFixed(6)} Eh` : ''}`;
    if (S.frames.length < 2 && playing) { clearInterval(playing); playing = 0; playBtn.textContent = L('播放', 'Play'); }
  };
  on('frames', syncFrames); on('frame', syncFrames);
  on('edit', () => view.info());
  const side = h('aside', { class: 'wb-side', 'aria-label': L('三维查看器', '3D viewer') },
    h('div', { class: 'wb-view' }, view.stage,
      h('div', { class: 'wb-vbar' }, styleSel, labelBtn, seg, keepBtn, clearPick,
        btn(L('复位', 'Reset'), () => view.fit(), 'small'),
        btn(L('存图', 'PNG'), () => { const u = view.png(); if (u) { const a = h('a', { href: u, download: `${S.name}.png` }); document.body.append(a); a.click(); a.remove(); } }, 'small')),
      modeHint, frameBox,
      h('div', { class: 'wb-vbar' }, field(L('名字', 'Name'), nameIn, 'm'), field(L('电荷', 'Charge'), chargeIn, 'n'), field(L('多重度', 'Multiplicity'), multIn, 'n')),
      view.legend));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && (S.picks.length || S.frag.size) && !e.target.closest?.('input,textarea,select,dialog')) { S.picks = []; S.frag = new Set(); emit('picks'); emit('frag'); view.decorate(); } });

  app.replaceChildren(
    h('header', { class: 'wb-mast' },
      h('p', { class: 'wb-eyebrow', text: 'MOLASTRIA · WORKBENCH' }),
      h('h1', {}, L('计算工作台', 'Computational Workbench'), en ? null : h('span', { lang: 'en', text: 'Computational Workbench' })),
      h('p', { class: 'wb-lead', text: L('一个放在浏览器里的计算化学工作台：读写九种结构格式、搭晶体和表面；量键长键角、冻结原子、标 R/S 和 E/Z，写扫描、过渡态、IRC 和 NEB 的输入，读回结果画能量曲线；生成构象并按 RMSD 归簇、算 Boltzmann 布居；从 Molden 画分子轨道和电子密度，做 Hirshfeld 面、指纹图和 IGM / IGMH / IRI 弱相互作用图；读红外、拉曼、紫外光谱和优化收敛；一次给很多结构写好输入和集群作业脚本。全部在你的浏览器里算，文件不上传。',
        'A computational chemistry workbench in the browser: read and write nine structure formats and build crystals and surfaces; measure, freeze atoms, label R/S and E/Z, and write scan, transition-state, IRC and NEB inputs, then read the results back as energy profiles; generate conformers, cluster them by RMSD and get Boltzmann populations; draw orbitals and densities from a Molden file, Hirshfeld surfaces with fingerprint plots and IGM / IGMH / IRI weak-interaction maps; read IR, Raman and UV spectra and optimisation convergence; and write inputs and cluster job scripts for many structures at once. Everything runs in your browser and no file is uploaded.') }),
      h('p', { class: 'wb-credit' }, L('功能清单参照 ', 'The feature list follows '), h('a', { href: 'https://github.com/Ahey1/Ester-Studio', target: '_blank', rel: 'noopener', text: 'Ester Studio' }),
        L('（张子轩的 Windows 桌面程序）。这里的代码是 MolAstria 按公开的文件格式和文献自己写的，不是 Ester Studio 本身，也没有用它的代码；怎样引用两者见“项目与引用”。', ' (a Windows desktop program by Zixuan Zhang). The code here is MolAstria’s own, written from public file formats and papers; it is not Ester Studio and uses none of its code. How to cite both is under “Project & citations”.'))),
    tabBar,
    h('div', { class: 'wb-layout' }, panels, side));

  // ── 标签 1：结构 ─────────────────────────────────────────────────────
  function buildTab(cx, panel) {
    const smiIn = h('input', { type: 'text', class: 'mono', spellcheck: 'false', autocomplete: 'off', placeholder: 'CC(=O)Oc1ccccc1C(=O)O', 'aria-label': 'SMILES', value: S.smiles || '' });
    const st = h('p', { class: 'wb-status', role: 'status' });
    const prog = progress();
    const goSmiles = async () => {
      const smi = smiIn.value.trim();
      if (!smi) { status(st, smilesErr('empty'), 'bad'); return; }
      status(st, L('正在搭三维结构（第一次要载入约 2.5 MB 的 OpenChemLib）……', 'Building 3D coordinates (the first time loads about 2.5 MB of OpenChemLib)…'));
      try {
        const r = await smilesTo3D(smi, { conformers: 6, onProgress: (k, n) => prog.set(k, n) });
        prog.done();
        setFrames([r.frames[0]], { name: safeName(smi.replace(/[^\w]+/g, '').slice(0, 16) || 'smiles'), smiles: smi, charge: r.charge, mult: r.mult, source: 'smiles' });
        status(st, L(`搭好了（MMFF94s+ 优化，取 ${r.frames.length} 个构象里能量最低的一个）。电荷 ${r.charge}、多重度 ${r.mult} 按 SMILES 填好了。`, `Done (MMFF94s+ optimised, lowest of ${r.frames.length} conformers). Charge ${r.charge} and multiplicity ${r.mult} were set from the SMILES.`));
      } catch (e) { prog.done(); status(st, errText(e), 'bad'); }
    };
    smiIn.addEventListener('keydown', (e) => { if (e.key === 'Enter') goSmiles(); });
    const exSel = sel([['', L('选一个例子……', 'Pick an example…')], ...Object.entries(EXAMPLES).map(([k, e]) => [k, L(e.zh, e.en)])], '', { 'aria-label': L('例子', 'Examples') });
    exSel.addEventListener('change', () => { if (exSel.value) { loadExample(exSel.value); status(st, L(`载入了例子：${L(EXAMPLES[exSel.value].zh, EXAMPLES[exSel.value].en)}。`, `Loaded the example: ${EXAMPLES[exSel.value].en}.`)); exSel.value = ''; } });
    const onText = async (text, name, why) => {
      if (text == null) { status(st, why === 'big' ? L(`${name} 太大了（超过 80 MB）。`, `${name} is too large (over 80 MB).`) : L(`${name} 读不出来。`, `${name} could not be read.`), 'bad'); return; }
      status(st, L('正在读……', 'Reading…'));
      try {
        const r = await readAny(text, name);
        setFrames(r.frames, { ...r.meta, source: name || 'paste' });
        if (r.kind === 'molden') { emit('molden', r.molden, name, r.wfn); status(st, L(`读入 Molden：${r.wfn.atoms.length} 个原子、${r.wfn.nbf} 个基函数、${r.wfn.mos.length} 个轨道。轨道和密度在“波函数与表面”页。`, `Read the Molden file: ${r.wfn.atoms.length} atoms, ${r.wfn.nbf} basis functions, ${r.wfn.mos.length} orbitals. Orbitals and densities are on the “Wavefunctions & surfaces” tab.`)); return; }
        if (r.kind === 'cube') { emit('cube', r.cube, name, r.parsed); status(st, L(`读入 cube：${r.parsed.n.join(' × ')} 个格点。等值面画在右边，调法在“波函数与表面”页。`, `Read the cube: ${r.parsed.n.join(' × ')} points. The isosurface is drawn on the right; adjust it on the “Wavefunctions & surfaces” tab.`)); return; }
        if (r.output) emit('output', r.output, name, r.program);
        status(st, r.note || L('读好了。', 'Done.'), r.note && /二维|2D|不一样|different/.test(r.note) ? 'warn' : '');
      } catch (e) {
        status(st, /output:nogeom/.test(e.message) ? L('认出是程序输出，但里面没有结构。', 'This looks like a program output but holds no geometry.') : errText(e), 'bad');
      }
    };
    panel.append(card(L('读入结构', 'Load a structure'),
      h('div', { class: 'wb-row' }, field('SMILES', smiIn, 'grow'), btn(L('生成 3D', 'Build 3D'), goSmiles, 'primary')),
      h('div', { class: 'wb-row' }, field(L('例子', 'Examples'), exSel, 'grow')),
      h('div', { style: 'margin-top:10px' }, fileBox({ accept: '.xyz,.extxyz,.trj,.pdb,.ent,.mol,.sdf,.cif,.vasp,.gjf,.com,.inp,.cdxml,.cube,.cub,.molden,.log,.out,.txt,POSCAR,CONTCAR', onText, multiple: false,
        hint: L('XYZ（含多帧和 extxyz）、PDB、MOL / SDF、CIF、POSCAR / CONTCAR、Gaussian（.gjf）、ORCA（.inp）、ChemDraw（.cdxml）、cube、Molden，或者 Gaussian / ORCA / xTB 等程序的输出（读出每一步的结构）。',
          'XYZ (multi-frame and extxyz too), PDB, MOL / SDF, CIF, POSCAR / CONTCAR, Gaussian (.gjf), ORCA (.inp), ChemDraw (.cdxml), cube, Molden, or a Gaussian / ORCA / xTB … output (every step’s geometry).') })),
      prog.el, st));
    if (window.MolAstriaSketch) { const b = window.MolAstriaSketch.attach(smiIn, L('画结构', 'Draw')); if (b) b.classList.add('wb-btn', 'small'); }
    on('frames', () => { if (S.smiles) smiIn.value = S.smiles; });

    // 当前结构
    const kv = h('div', { class: 'wb-kv' });
    const warn = h('p', { class: 'wb-status' });
    const mlist = h('ul', { class: 'wb-list' });
    const frozenLine = h('p', { class: 'wb-small' });
    function renderInfo() {
      const fr = current();
      if (!fr) { kv.replaceChildren(h('div', {}, h('small', { text: L('还没有结构', 'No structure yet') }))); status(warn, ''); return; }
      const A = fr.atoms, ne = electrons(A);
      const fg = A.length <= 4000 ? WB.fragments(A, WB.bonds(A, fr.cell)) : null;
      const items = [[L('化学式', 'Formula'), formula(A)], [L('原子', 'Atoms'), A.length], [L('帧', 'Frames'), S.frames.length], [L('片段（分子）', 'Fragments'), fg ? fg.list.length : '—'], [L('电子数', 'Electrons'), ne]];
      if (Number.isFinite(fr.energy)) items.push([L('这一帧的能量', 'Energy of this frame'), fr.ff ? `${(fr.energy * WB.HARTREE_KCAL).toFixed(3)} kcal/mol (${fr.ff})` : `${fr.energy.toFixed(6)} Eh`]);
      if (fr.cell) { const c = WB.cellParams(fr.cell); items.push([L('晶胞 a, b, c', 'Cell a, b, c'), `${c.a.toFixed(3)}, ${c.b.toFixed(3)}, ${c.c.toFixed(3)} Å`], [L('α, β, γ', 'α, β, γ'), `${c.alpha.toFixed(2)}°, ${c.beta.toFixed(2)}°, ${c.gamma.toFixed(2)}°`], [L('体积', 'Volume'), `${c.volume.toFixed(2)} Å³`]); }
      kv.replaceChildren(...items.map(([k, v]) => h('div', {}, h('small', { text: k }), h('b', { text: String(v) }))));
      const msgs = [];
      if ((ne - (S.mult - 1)) % 2 !== 0 || S.mult - 1 > ne) msgs.push(L(`电子数 ${ne} 和多重度 ${S.mult} 对不上（偶数个电子要奇数多重度，奇数个电子要偶数多重度）。`, `${ne} electrons do not fit multiplicity ${S.mult} (an even electron count needs an odd multiplicity and vice versa).`));
      if (A.length <= 3000) {
        let dmin = Infinity, pair = null;
        for (let i = 0; i < A.length; i++) for (let j = i + 1; j < A.length; j++) { const d = Math.hypot(A[i].x - A[j].x, A[i].y - A[j].y, A[i].z - A[j].z); if (d < dmin) { dmin = d; pair = [i, j]; } }
        if (pair && dmin < 0.55) msgs.push(L(`${A[pair[0]].el}${pair[0] + 1} 和 ${A[pair[1]].el}${pair[1] + 1} 只相距 ${dmin.toFixed(3)} Å，可能是重复的原子。`, `${A[pair[0]].el}${pair[0] + 1} and ${A[pair[1]].el}${pair[1] + 1} are only ${dmin.toFixed(3)} Å apart; possibly a duplicated atom.`));
      }
      status(warn, msgs.join(' '), msgs.length ? 'warn' : '');
      const fz = A.map((a, i) => (a.frozen ? i + 1 : 0)).filter(Boolean);
      frozenLine.textContent = fz.length ? L(`冻结的原子（${fz.length} 个）：${C.ranges(fz)}`, `Frozen atoms (${fz.length}): ${C.ranges(fz)}`) : '';
    }
    function renderMeasures() {
      const fr = current();
      mlist.replaceChildren(...S.measures.map((m, k) => {
        const r = fr && m.picks.every((i) => fr.atoms[i]) ? WB.measure(fr.atoms, m.picks, fr.cell) : null;
        const lab = fr ? m.picks.map((i) => `${fr.atoms[i]?.el || '?'}${i + 1}`).join('–') : '';
        const name = { bond: L('距离', 'Distance'), angle: L('键角', 'Angle'), dihedral: L('二面角', 'Dihedral') }[m.type];
        return h('li', {}, h('span', { text: `${name} ${lab}` }), h('b', { text: r ? `${r.value.toFixed(m.type === 'bond' ? 4 : 2)} ${r.unit}` : '—' }),
          h('button', { type: 'button', class: 'wb-x', text: L('删', 'Remove'), onclick: () => { S.measures.splice(k, 1); emit('measures'); view.decorate(); } }));
      }));
      if (!S.measures.length) mlist.append(h('li', {}, h('span', { class: 'wb-small', style: 'margin:0', text: L('在查看器里选“测量”，点 2–4 个原子，再按“记下”。', 'Choose “Measure” in the viewer, click 2–4 atoms and press “Keep”.') })));
    }
    for (const k of ['frames', 'frame', 'edit', 'meta']) on(k, renderInfo);
    for (const k of ['frames', 'frame', 'measures', 'edit']) on(k, renderMeasures);
    const editSt = h('p', { class: 'wb-status' });
    const allFrames = (fn) => { for (const f of S.frames) fn(f); };
    // R/S 和 E/Z
    const cipSt = h('p', { class: 'wb-status' }), cipOut = h('p', { class: 'wb-small' });
    const CIP_WHY = {
      elements: ['R/S 只给有机分子标（H、B、C、N、O、F、Si、P、S、Cl、Br、I、Se）；这个结构里有别的元素。', 'R/S labels are for organic molecules (H, B, C, N, O, F, Si, P, S, Cl, Br, I, Se); this structure has other elements.'],
      valence: ['从键长推不出合理的键级（可能是自由基、卡宾，或者少了氢）。补齐氢再试，或者从 SMILES 生成结构。', 'No sensible bond orders follow from the bond lengths (a radical, a carbene, or missing hydrogens?). Add the hydrogens and try again, or build the structure from SMILES.'],
      search: ['结构太复杂，推键级时搜索超时了。', 'The structure is too complex; the bond-order search timed out.'],
      ocl: ['OpenChemLib 读不进这个结构。', 'OpenChemLib could not read this structure.'],
    };
    on('frame', () => { cipOut.textContent = ''; status(cipSt, ''); });
    on('frames', () => { cipOut.textContent = ''; status(cipSt, ''); });
    const cipFrame = () => {
      const fr = current();
      if (!fr) { status(cipSt, L('先载入一个结构。', 'Load a structure first.'), 'bad'); return null; }
      if (fr.cell) { status(cipSt, L('晶体不标构型（先在“晶体与表面”里取出一个分子）。', 'Crystals are not labelled (take out one molecule first).'), 'warn'); return null; }
      if (fr.atoms.length > 1500) { status(cipSt, L('原子太多（超过 1500 个）。', 'Too many atoms (over 1500).'), 'bad'); return null; }
      return fr;
    };
    const cipBtn = btn(L('标出 R/S 和 E/Z', 'Label R/S and E/Z'), async () => {
      if (!cipFrame()) return;
      status(cipSt, L('正在载入 OpenChemLib……', 'Loading OpenChemLib…'));
      let OCL;
      try { OCL = await loadOCL(); } catch { status(cipSt, errText('load'), 'bad'); return; }
      const fr = cipFrame(); // 载入库的这段时间里结构可能换了：按现在的结构标
      if (!fr) return;
      const r = WB.cipLabels(OCL, fr.atoms, S.charge, WB.bonds(fr.atoms, null));
      if (!r.ok) {
        S.cip = null; view.decorate(); cipOut.textContent = '';
        status(cipSt, r.why === 'charge' ? L(`推出的形式电荷之和是 ${(r.charges || []).reduce((a, b) => a + b, 0)}，和查看器下面填的总电荷 ${S.charge} 不一样。先把总电荷改对。`, `The formal charges add up to ${(r.charges || []).reduce((a, b) => a + b, 0)}, not the total charge ${S.charge} set under the viewer. Fix the charge first.`) : L(...(CIP_WHY[r.why] || CIP_WHY.valence)), 'bad');
        return;
      }
      S.cip = { centres: r.centres, bonds: r.bonds }; view.decorate(); use('cip', 'openchemlib');
      const A = fr.atoms;
      const parts = [...r.centres.map(([i, l]) => `${A[i].el}${i + 1} (${l})`), ...r.bonds.map(([i, j, l]) => `${A[i].el}${i + 1}=${A[j].el}${j + 1} (${l})`)];
      status(cipSt, r.centres.length || r.bonds.length ? L(`找到 ${r.centres.length} 个手性中心、${r.bonds.length} 个有 E/Z 之分的双键，标在查看器里了。`, `Found ${r.centres.length} stereocentre${r.centres.length === 1 ? '' : 's'} and ${r.bonds.length} E/Z double bond${r.bonds.length === 1 ? '' : 's'}, labelled in the viewer.`) : L('没有手性中心，也没有 E/Z 之分的双键。', 'No stereocentres and no E/Z double bonds.'));
      cipOut.textContent = [parts.join(L('，', ', ')), r.unsure ? L(`另有 ${r.unsure} 处 CIP 规则判不出来。`, `${r.unsure} more could not be resolved by the CIP rules.`) : '', L('键级和形式电荷是从键长推的，构型按三维坐标定（CIP 规则，OpenChemLib 实现）。', 'Bond orders and formal charges are inferred from bond lengths; configurations come from the 3D coordinates (CIP rules as implemented in OpenChemLib).')].filter(Boolean).join(' ');
    }, 'small');
    panel.append(card(L('当前结构', 'Current structure'), kv, warn, frozenLine,
      h('h3', { class: 'wb-h3', text: L('立体构型', 'Stereochemistry') }), h('div', { class: 'wb-row' }, cipBtn, btn(L('收起标记', 'Hide labels'), () => { S.cip = null; view.decorate(); cipOut.textContent = ''; status(cipSt, ''); }, 'small')), cipSt, cipOut,
      h('h3', { class: 'wb-h3', text: L('量过的内坐标', 'Kept measurements') }), mlist,
      h('h3', { class: 'wb-h3', text: L('小修改（每一帧一起改）', 'Small edits (applied to every frame)') }),
      h('div', { class: 'wb-row' },
        btn(L('平移到原点', 'Centre at origin'), () => { const fr = current(); if (!fr || fr.cell) { status(editSt, L('晶体不平移。', 'Crystals are not moved.'), 'warn'); return; } allFrames((f) => { const c = f.atoms.reduce((s, a) => [s[0] + a.x / f.atoms.length, s[1] + a.y / f.atoms.length, s[2] + a.z / f.atoms.length], [0, 0, 0]); for (const a of f.atoms) { a.x -= c[0]; a.y -= c[1]; a.z -= c[2]; } }); edited(); view.fit(); status(editSt, L('已平移到原点。', 'Centred.')); }, 'small'),
        btn(L('删掉选中的原子', 'Delete picked atoms'), () => {
          const kill = new Set([...S.picks, ...S.frag]);
          if (!kill.size) { status(editSt, L('先在查看器里点选原子（测量或选片段模式）。', 'Pick atoms in the viewer first (Measure or Pick fragment mode).'), 'warn'); return; }
          if (S.frames.some((f) => f.atoms.length !== S.frames[0].atoms.length)) { status(editSt, L('各帧原子数不一样，没法一起删。', 'Frames differ in atom count, so atoms cannot be deleted from all of them.'), 'bad'); return; }
          allFrames((f) => { f.atoms = f.atoms.filter((_, i) => !kill.has(i)); });
          S.picks = []; S.frag = new Set(); S.measures = []; emit('measures'); edited(); status(editSt, L(`删掉了 ${kill.size} 个原子。`, `Deleted ${kill.size} atoms.`));
        }, 'small'),
        btn(L('只留选中的片段', 'Keep only the picked fragment'), () => {
          if (!S.frag.size) { status(editSt, L('先用“选片段”点一个分子。', 'Use “Pick fragment” on a molecule first.'), 'warn'); return; }
          const keep = new Set(S.frag);
          allFrames((f) => { f.atoms = f.atoms.filter((_, i) => keep.has(i)); f.cell = null; });
          S.picks = []; S.frag = new Set(); S.measures = []; emit('measures'); edited(); view.fit(); status(editSt, L(`留下了 ${keep.size} 个原子（去掉了晶胞）。`, `Kept ${keep.size} atoms (cell removed).`));
        }, 'small'),
        btn(L('全部解冻', 'Unfreeze all'), () => { allFrames((f) => f.atoms.forEach((a) => delete a.frozen)); edited(); }, 'small')),
      editSt));

    // 导出
    const fmtSel = sel(WB.FORMATS.filter((f) => !['cdxml', 'cube'].includes(f)).flatMap((f) => (f === 'mol' ? [['mol', 'MOL'], ['sdf', 'SDF']] : [[f, { xyz: 'XYZ', pdb: 'PDB', cif: 'CIF', poscar: 'POSCAR (VASP)', gjf: 'Gaussian (.gjf)', orca: 'ORCA (.inp)' }[f] || f]])), prefs.fmt || 'xyz', { 'aria-label': L('格式', 'Format') });
    let allBox;
    const allChk = check(L('所有帧（XYZ、PDB、SDF）', 'All frames (XYZ, PDB, SDF)'), false, () => renderExport());
    allBox = allChk.querySelector('input');
    const out = pre('');
    const exSt = h('p', { class: 'wb-status' });
    let text = '', fname = '';
    function renderExport() {
      const fr = current();
      if (!fr) { out.textContent = ''; return; }
      const f = fmtSel.value;
      try {
        text = WB.write(f, S.frames, { frame: S.frame, all: allBox.checked, title: S.name, name: S.name, charge: S.charge, mult: S.mult });
        fname = `${S.name}${allBox.checked && ['xyz', 'pdb', 'sdf'].includes(f) && S.frames.length > 1 ? '_all' : ''}.${WB.EXT[f]}`;
        out.textContent = text.length > 60000 ? text.slice(0, 60000) + '\n…' : text;
        status(exSt, f === 'gjf' || f === 'orca' ? L('这里只写结构和一行默认的方法。要完整设置方法、基组和任务，用开源代码台或“批量与作业”页。', 'Only the geometry and a default method line are written. For full method, basis and task settings use the Code Desk or the “Batch & jobs” tab.') : '');
      } catch (e) { text = ''; out.textContent = ''; status(exSt, errText(e), 'bad'); }
    }
    fmtSel.addEventListener('change', () => { savePrefs({ fmt: fmtSel.value }); renderExport(); });
    for (const k of ['frames', 'frame', 'edit', 'meta']) on(k, renderExport);
    const cpBtn = btn(L('复制', 'Copy'), () => text && copyText(text, cpBtn));
    panel.append(card(L('导出', 'Export'),
      h('div', { class: 'wb-row' }, field(L('格式', 'Format'), fmtSel, 'm'), allChk),
      h('div', { class: 'wb-row' }, btn(L('下载', 'Download'), () => text && download(fname, text), 'primary'), cpBtn,
        btn(h('span', {}, L('送进开源代码台写输入 ', 'Send to the Code Desk '), ico('right')), () => {
          const fr = current(); if (!fr) return;
          try { localStorage.setItem('molastria-code-import', JSON.stringify({ xyz: WB.write('xyz', S.frames, { frame: S.frame }), charge: S.charge, mult: S.mult, name: S.name, from: 'workbench' })); } catch { /* 存不下就只跳过去 */ }
          location.href = '../code/#input';
        })),
      exSt, out));
  }

  // ── 标签 2：晶体与表面 ───────────────────────────────────────────────
  function crystalTab(cx, panel) {
    const st = h('p', { class: 'wb-status' });
    const preSel = sel(Object.entries(WB.PRESETS).map(([k, p]) => [k, `${L(p.zh, p.en)} · a = ${p.p[0]} Å`]), 'nacl', { 'aria-label': L('晶体', 'Crystal') });
    panel.append(card(L('晶体预设', 'Preset crystals'),
      h('p', { class: 'wb-p', text: L('十七种常见晶体，晶格常数是室温实验值（Wyckoff、CRC 手册）。载入的是惯用晶胞（面心立方是 4 个格点的立方胞）。', 'Seventeen common crystals with room-temperature experimental lattice constants (Wyckoff, CRC Handbook). The conventional cell is loaded (the 4-site cube for fcc).') }),
      h('div', { class: 'wb-row' }, field(L('晶体', 'Crystal'), preSel, 'grow'), btn(L('载入', 'Load'), () => {
        const fr = WB.crystal(preSel.value);
        setFrames([fr], { name: preSel.value, charge: 0, mult: 1, source: 'preset' });
        status(st, L(`载入了 ${L(WB.PRESETS[preSel.value].zh, WB.PRESETS[preSel.value].en)}，${fr.atoms.length} 个原子。`, `Loaded ${WB.PRESETS[preSel.value].en}, ${fr.atoms.length} atoms.`));
      }, 'primary')), st));

    // 晶胞
    const cin = ['a', 'b', 'c', 'alpha', 'beta', 'gamma'].map((k, i) => numIn(i < 3 ? 10 : 90, { min: i < 3 ? 0.5 : 10, max: i < 3 ? 500 : 170, step: i < 3 ? 0.001 : 0.01, attrs: { 'aria-label': k } }));
    const cellSt = h('p', { class: 'wb-status' });
    const padIn = numIn(10, { min: 2, max: 60, step: 0.5 });
    const fillCell = () => { const fr = current(); if (fr?.cell) { const c = WB.cellParams(fr.cell); [c.a, c.b, c.c, c.alpha, c.beta, c.gamma].forEach((v, i) => (cin[i].value = v.toFixed(i < 3 ? 4 : 3))); } };
    for (const k of ['frames', 'frame', 'edit']) on(k, fillCell);
    panel.append(card(L('晶胞', 'Cell'),
      h('div', { class: 'wb-row' }, ...['a (Å)', 'b (Å)', 'c (Å)', 'α (°)', 'β (°)', 'γ (°)'].map((t, i) => field(t, cin[i], 'n'))),
      h('div', { class: 'wb-row' },
        btn(L('按这些参数改晶胞（分数坐标不变）', 'Apply these parameters (fractional coordinates kept)'), () => {
          const fr = current();
          if (!fr?.cell) { status(cellSt, errText('supercell:nocell'), 'bad'); return; }
          const nc = WB.cellFromParams(...cin.map((x) => val(x)));
          for (const f of S.frames) {
            if (!f.cell) continue;
            const inv = WB.inv3(f.cell);
            for (const a of f.atoms) { const q = WB.fracToCart(WB.cartToFrac([a.x, a.y, a.z], f.cell, inv), nc); a.x = q[0]; a.y = q[1]; a.z = q[2]; }
            f.cell = nc.map((v) => v.slice());
          }
          edited(); view.draw({ fit: true }); status(cellSt, L('晶胞改好了。', 'Cell updated.'));
        })),
      h('div', { class: 'wb-row' }, field(L('真空层（Å）', 'Padding (Å)'), padIn, 'n'), btn(L('给分子加一个长方体盒子', 'Put the molecule in a box'), () => {
        const fr = current();
        if (!fr) return;
        const pad = val(padIn, 10);
        for (const f of S.frames) {
          const lo = [0, 1, 2].map((d) => Math.min(...f.atoms.map((a) => [a.x, a.y, a.z][d]))), hi = [0, 1, 2].map((d) => Math.max(...f.atoms.map((a) => [a.x, a.y, a.z][d])));
          const L3 = lo.map((v, d) => hi[d] - v + pad);
          for (const a of f.atoms) { a.x += pad / 2 - lo[0]; a.y += pad / 2 - lo[1]; a.z += pad / 2 - lo[2]; }
          f.cell = [[L3[0], 0, 0], [0, L3[1], 0], [0, 0, L3[2]]];
        }
        edited(); view.draw({ fit: true }); fillCell(); status(cellSt, L('加好了盒子（每边比分子大一个真空层）。', 'Boxed (each edge is the molecule’s extent plus the padding).'));
      })), cellSt));

    // 超胞
    const sc = [numIn(2, { min: 1, max: 12, step: 1 }), numIn(2, { min: 1, max: 12, step: 1 }), numIn(2, { min: 1, max: 12, step: 1 })];
    const scSt = h('p', { class: 'wb-status' });
    panel.append(card(L('超胞', 'Supercell'),
      h('div', { class: 'wb-row' }, field('na', sc[0], 'n'), field('nb', sc[1], 'n'), field('nc', sc[2], 'n'), btn(L('生成超胞', 'Make supercell'), () => {
        const fr = current();
        try {
          const n = sc.map((x) => Math.max(1, Math.min(12, Math.round(val(x, 1)))));
          if (fr.atoms.length * n[0] * n[1] * n[2] > 20000) { status(scSt, L('超过两万个原子，浏览器会很卡，换小一点。', 'Over 20 000 atoms would make the browser crawl; use smaller numbers.'), 'bad'); return; }
          const out = WB.supercell(fr, ...n);
          setFrames([out], { name: `${S.name}_${n.join('x')}`, charge: S.charge, mult: S.mult, source: 'supercell' });
          status(scSt, L(`${n.join(' × ')} 超胞，${out.atoms.length} 个原子。`, `${n.join(' × ')} supercell, ${out.atoms.length} atoms.`));
        } catch (e) { status(scSt, errText(fr ? e : 'supercell:nocell'), 'bad'); }
      }, 'primary')), scSt));

    // 表面
    const hkl = [numIn(1, { step: 1 }), numIn(1, { step: 1 }), numIn(1, { step: 1 })];
    const layers = numIn(4, { min: 1, max: 30, step: 1 }), vac = numIn(15, { min: 0, max: 60, step: 0.5 });
    const rep = [numIn(2, { min: 1, max: 8, step: 1 }), numIn(2, { min: 1, max: 8, step: 1 })], fix = numIn(2, { min: 0, max: 20, step: 1 });
    const slSt = h('p', { class: 'wb-status' });
    panel.append(card(L('切表面（slab）', 'Cut a surface (slab)'),
      h('p', { class: 'wb-p', text: L('按密勒指数 (h k l) 在当前晶胞里找出这层面的原胞（两条面内最短的格矢），叠若干层原子面，把表面转到 xy 平面、法线沿 z，上下加真空。可以冻结最下面几层（写 POSCAR 的 Selective dynamics 和 Gaussian 的 −1）。', 'From Miller indices (h k l) it finds the primitive cell of that plane in the current cell (the two shortest in-plane lattice vectors), stacks atomic layers, turns the surface into the xy plane with the normal along z and adds vacuum above and below. The bottom layers can be frozen (written as Selective dynamics in POSCAR and −1 in Gaussian).') }),
      h('div', { class: 'wb-row' }, field('h', hkl[0], 'n'), field('k', hkl[1], 'n'), field('l', hkl[2], 'n'), field(L('原子层数', 'Atomic layers'), layers, 'n'), field(L('真空（Å）', 'Vacuum (Å)'), vac, 'n')),
      h('div', { class: 'wb-row' }, field(L('面内重复 a', 'In-plane repeat a'), rep[0], 'n'), field(L('面内重复 b', 'In-plane repeat b'), rep[1], 'n'), field(L('冻结底层', 'Freeze bottom layers'), fix, 'n'),
        btn(L('切表面', 'Cut'), () => {
          const fr = current();
          if (!fr?.cell) { status(slSt, errText('slab:nocell'), 'bad'); return; }
          try {
            const out = WB.slab(fr, hkl.map((x) => Math.round(val(x))), { layers: Math.round(val(layers, 4)), vacuum: val(vac, 15), repeat: rep.map((x) => Math.round(val(x, 1))), fixBottom: Math.round(val(fix, 0)) });
            const tag = hkl.map((x) => Math.round(val(x))).join('');
            setFrames([out], { name: `${S.name}_${tag}`, charge: 0, mult: 1, source: 'slab' });
            const nf = out.atoms.filter((a) => a.frozen).length;
            status(slSt, L(`(${hkl.map((x) => Math.round(val(x))).join(' ')}) 面：面间距 d = ${out.d.toFixed(4)} Å，${out.atoms.length} 个原子${nf ? `，冻结 ${nf} 个` : ''}。`, `(${hkl.map((x) => Math.round(val(x))).join(' ')}) surface: interplanar spacing d = ${out.d.toFixed(4)} Å, ${out.atoms.length} atoms${nf ? `, ${nf} frozen` : ''}.`));
          } catch (e) { status(slSt, errText(e), 'bad'); }
        }, 'primary')), slSt));
    panel.append(card(L('导出晶体', 'Export the crystal'),
      h('p', { class: 'wb-p', text: L('CIF 写成 P1（全部原子都列出来），POSCAR 用分数坐标、按元素排好，extxyz 把晶胞写在注释行。', 'CIF is written in P1 (every atom listed), POSCAR in fractional coordinates sorted by element, extxyz with the cell on the comment line.') }),
      h('div', { class: 'wb-row' }, ...[['cif', 'CIF'], ['poscar', 'POSCAR'], ['xyz', 'extxyz']].map(([f, t]) => btn(t, () => {
        const fr = current();
        if (!fr?.cell) { status(slSt, errText('cif:nocell'), 'bad'); return; }
        try { download(f === 'poscar' ? `${S.name}.vasp` : `${S.name}.${f}`, WB.write(f, S.frames, { frame: S.frame, title: S.name })); } catch (e) { status(slSt, errText(e), 'bad'); }
      })))));
  }

  // ── 标签 9：项目与引用 ───────────────────────────────────────────────
  function projectTab(cx, panel) {
    const st = h('p', { class: 'wb-status' });
    const snapshot = () => ({ app: 'molastria-workbench', version: 1, saved: new Date().toISOString(), name: S.name, charge: S.charge, mult: S.mult, smiles: S.smiles, frame: S.frame, frames: compact(S.frames), measures: S.measures, frag: [...S.frag], used: [...S.used] });
    const openProject = (text, name) => {
      let d;
      try { d = JSON.parse(text); } catch { d = null; }
      if (!d || d.app !== 'molastria-workbench') { status(st, L('这不是工作台的项目文件。', 'This is not a workbench project file.'), 'bad'); return; }
      const frames = expand(d.frames);
      if (!frames.length) { status(st, L('项目里没有结构。', 'The project holds no structure.'), 'bad'); return; }
      const n = frames[0].atoms.length;
      setFrames(frames, { name: d.name || name, charge: Number.isInteger(d.charge) ? d.charge : 0, mult: Number.isInteger(d.mult) ? d.mult : 1, smiles: typeof d.smiles === 'string' ? d.smiles.slice(0, 500) : '', frame: Number.isInteger(d.frame) ? d.frame : 0, source: 'project' });
      S.measures = (Array.isArray(d.measures) ? d.measures : []).filter((m) => m && ['bond', 'angle', 'dihedral'].includes(m.type) && Array.isArray(m.picks) && m.picks.length === { bond: 2, angle: 3, dihedral: 4 }[m.type] && m.picks.every((i) => Number.isInteger(i) && i >= 0 && i < n)).slice(0, 50);
      for (const id of Array.isArray(d.used) ? d.used : []) if (C.REFS[id]) S.used.add(id);
      emit('measures'); emit('used'); view.decorate();
      status(st, L(`打开了项目 ${S.name}（${frames.length} 帧，保存于 ${String(d.saved || '').slice(0, 10)}）。`, `Opened project ${S.name} (${frames.length} frames, saved ${String(d.saved || '').slice(0, 10)}).`));
    };
    panel.append(card(L('项目', 'Project'),
      h('p', { class: 'wb-p', text: L('项目文件是一个 JSON：全部帧（坐标、晶胞、能量、冻结标记）、名字、电荷、多重度、量过的内坐标和用到的方法。浏览器另外会自动记住上次的结构（只在这台设备上）。', 'A project file is JSON: every frame (coordinates, cell, energy, frozen flags), the name, charge, multiplicity, kept measurements and the methods used. The browser also remembers the last structure by itself (on this device only).') }),
      h('div', { class: 'wb-row' }, btn(L('保存项目', 'Save project'), () => { if (!S.frames.length) return; download(`${S.name}.molastria.json`, JSON.stringify(snapshot(), null, 1), 'application/json'); }, 'primary'),
        btn(L('清空工作台', 'Clear the workbench'), () => { S.frames = []; S.frame = 0; S.picks = []; S.measures = []; S.frag = new Set(); view.clearSurfaces(); savePrefs({ last: null }); emit('frames'); view.draw(); status(st, L('清空了。', 'Cleared.')); })),
      h('div', { style: 'margin-top:10px' }, fileBox({ accept: '.json', paste: false, title: L('打开项目文件（.molastria.json）', 'Open a project file (.molastria.json)'), onText: (t, n) => (t == null ? status(st, L('读不出来。', 'Could not read it.'), 'bad') : openProject(t, n)) })), st));

    // 引用
    const list = h('ul', { class: 'wb-refs' });
    const picked = new Set();
    function renderRefs() {
      for (const id of S.used) picked.add(id);
      list.replaceChildren(...Object.entries(C.REFS).map(([id, r]) => {
        const box = h('input', { type: 'checkbox', checked: picked.has(id), 'aria-label': id, onchange: (e) => { if (e.target.checked) picked.add(id); else picked.delete(id); } });
        const where = r.doi ? `https://doi.org/${r.doi}` : r.url;
        return h('li', {}, box, h('span', {}, `${r.authors.slice(0, 3).map((a) => a.split(',')[0]).join(', ')}${r.authors.length > 3 ? ' et al.' : ''} (${r.year}). ${r.title}. `, h('i', { text: r.journal }), r.volume ? ` ${r.volume}` : '', r.pages ? `, ${r.pages}` : '', '. ',
          h('a', { href: where, target: '_blank', rel: 'noopener', text: r.doi ? `doi:${r.doi}` : where }), S.used.has(id) ? h('small', { text: L('　· 这次用到了', '  · used this session') }) : null));
      }));
    }
    on('used', renderRefs);
    renderRefs();
    const ids = () => Object.keys(C.REFS).filter((id) => picked.has(id));
    panel.append(card(L('引用', 'Citations'),
      h('p', { class: 'wb-p', text: L('用到某个功能时，它依据的方法会自动勾上（比如画了 Hirshfeld 面就勾上 Hirshfeld 1977 和 Spackman 2009）。也可以自己勾，导出成 BibTeX、RIS 或 CSV。', 'When you use a tool, the papers behind it are ticked automatically (drawing a Hirshfeld surface ticks Hirshfeld 1977 and Spackman 2009, for example). Tick more by hand and export as BibTeX, RIS or CSV.') }),
      h('div', { class: 'wb-row' }, btn('BibTeX', () => download('molastria-workbench.bib', C.bibtex(ids()))), btn('RIS', () => download('molastria-workbench.ris', C.ris(ids()))), btn('CSV', () => download('molastria-workbench-refs.csv', C.refsCsv(ids()))),
        btn(L('全选', 'Select all'), () => { for (const id of Object.keys(C.REFS)) picked.add(id); renderRefs(); }, 'small'), btn(L('只留用到的', 'Only the used ones'), () => { picked.clear(); renderRefs(); }, 'small')),
      list));

    const er = C.REFS.ester;
    panel.append(card(L('关于 Ester Studio', 'About Ester Studio'),
      h('p', { class: 'wb-p', text: L('这一页的功能清单（结构编辑和格式转换、晶体和表面、反应路径、构象、波函数分析、光谱、批量作业）参照的是 Ester Studio，一个面向计算化学的 Windows 桌面工作台。Ester Studio 的源码公开、可以免费使用，但它的许可证不允许销售软件或修改版，修改版也必须沿用同一份许可证；MolAstria 有付费的部分，所以没有拿它的代码改，而是按公开的文件格式和文献把这些功能重新写了一遍，界面和文字也都是自己的。它的许可证第 1.2 条写明，独立重写同样的思路和功能不算修改版。',
        'The feature list on this page (structure editing and format conversion, crystals and surfaces, reaction paths, conformers, wavefunction analysis, spectra, batch jobs) follows Ester Studio, a Windows desktop workbench for computational chemistry. Ester Studio’s source is public and free to use, but its licence forbids selling the software or a modified version and requires modified versions to keep the same licence. MolAstria has paid tiers, so instead of modifying Ester’s code we rewrote these functions from public file formats and papers, with our own interface and wording. Article 1.2 of its licence states that an independent reimplementation of the same ideas and functions is not a modified version.') }),
      h('p', { class: 'wb-p', text: L('如果你在论文里用了 Ester Studio 本身，请这样引用：', 'If you use Ester Studio itself in a paper, cite it as:') }),
      h('p', { class: 'wb-cite' }, `${er.authors[0]}. ${er.title}. ${er.journal}, ${er.year}. `, h('a', { href: er.url, target: '_blank', rel: 'noopener', text: er.url })),
      h('p', { class: 'wb-p', text: L('用了这一页，请引用上面“引用”里勾上的方法原文，并注明结果来自 MolAstria 计算工作台（molastria.com/workbench/）。', 'If you used this page, cite the method papers ticked under “Citations” and say the results came from the MolAstria workbench (molastria.com/workbench/).') }),
      h('h3', { class: 'wb-h3', text: L('浏览器里不做的事', 'What this page does not do') }),
      h('ul', { class: 'wb-limits' },
        h('li', {}, L('不运行 Gaussian、ORCA、xTB 这些程序：这里写输入和作业脚本、读它们的输出。想在线算，用', 'It does not run Gaussian, ORCA or xTB: it writes their inputs and job scripts and reads their outputs. To compute online, use the '), h('a', { href: '../models/', text: L('模型接口', 'model interface') }), L('（xTB、UMA 等）或开源代码台的 ', ' (xTB, UMA and more) or the Code Desk’s '), h('a', { href: '../code/#quacc', text: L('quacc 流水线', 'quacc pipelines') }), L('。', '.')),
        h('li', { text: L('Hirshfeld 面、IGM、IRI 用的是自由原子球平均密度的叠加（原子密度由 PySCF 的 def2-TZVP 原子计算得到），这是 IGM 原文和 CrystalExplorer 的做法；读入 Molden 文件后可以算真实密度的 IGMH。别的基于真实密度的分析（精确静电势、ELF、AIM 临界点等）请用 Multiwfn 并引用它。', 'Hirshfeld surfaces, IGM and IRI use a sum of spherically averaged free-atom densities (from PySCF def2-TZVP atomic calculations), as in the original IGM paper and CrystalExplorer; with a Molden file loaded, IGMH runs on the real density. For other real-density analyses (exact ESP, ELF, AIM critical points and so on) use Multiwfn and cite it.') }),
        h('li', { text: L('点电荷静电势只是近似，用来给面着色；精确的静电势请让程序输出 cube（Gaussian cubegen、ORCA orca_plot、Multiwfn）再读进来。', 'The point-charge electrostatic potential is an approximation for colouring surfaces; for the exact ESP, have your program write a cube (Gaussian cubegen, ORCA orca_plot, Multiwfn) and load it.') }),
        h('li', { text: L('不做分子动力学或元动力学采样（批量作业页写的 CREST 输入可以拿到集群上跑）。R/S 和 E/Z 的键级是从键长推的，金属配合物和推不出键级的结构不标。', 'No molecular dynamics or metadynamics sampling (run the CREST input from the batch tab on a cluster). R/S and E/Z labels rely on bond orders inferred from bond lengths, so metal complexes and structures whose bond orders cannot be inferred are not labelled.') }))));
  }

  // ── 画出全部标签 ─────────────────────────────────────────────────────
  for (const t of TABS) {
    try { t.build(ctx, t.panel); } catch (e) { console.error(e); t.panel.append(card('', h('p', { class: 'wb-status', 'data-bad': 'true', text: errText(e) }))); }
  }
  const hash = location.hash.replace(/^#/, '');
  show(TABS.some((t) => t.id === hash) ? hash : prefs.tab || 'build', false);

  // 开始时的结构：地址里的 ?smiles=，否则上次的，否则阿司匹林
  const q = new URLSearchParams(location.search);
  const qs = (q.get('smiles') || '').trim().slice(0, 400);
  const last = prefs.last && expand(prefs.last.frames);
  if (qs) {
    loadExample('aspirin');
    smilesTo3D(qs).then((r) => setFrames([r.frames[0]], { name: 'smiles', smiles: qs, charge: r.charge, mult: r.mult, source: 'url' })).catch(() => { /* 留着阿司匹林 */ });
  } else if (last && last.length) {
    setFrames(last, { name: prefs.last.name, charge: prefs.last.charge, mult: prefs.last.mult, smiles: prefs.last.smiles || '', frame: prefs.last.frame || 0, source: 'restore' });
  } else loadExample('aspirin');
  window.MolAstriaWorkbench = ctx; // 给浏览器测试和控制台用
})();
