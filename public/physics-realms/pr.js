'use strict';
// 物理疆界图：把 pr-data.js 画成一张可以拖动、缩放的网状图（类似 Obsidian 的图谱视图），加上 ħ-c-G 立方体、各理论的疆界一览和未解决的问题。
// 内容是中英两版，按站点语言取用，标 translate="no"；页面上的固定文字也在这里成对写出，所以英文页不依赖词典。
// 地址：#n-<节点 id> 选中对应的节点。筛选和“局部图”的开关存在 localStorage 的 molastria-realms-view。
(() => {
  const D = window.MOLASTRIA_REALMS;
  if (!D) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(esc(en ? e : zh));
  const R = (t, tag = 'span', cls = '') => C(esc(tx(t)), tag, cls);
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
  const SVGNS = 'http://www.w3.org/2000/svg';

  if (en) document.title = 'Realms of Physics · MolAstria';

  // ── 节点与关系 ────────────────────────────────────────────────────────
  const nodes = [...D.theories.map((t) => ({ ...t, kind: 't' })), ...D.problems.map((p) => ({ ...p, kind: 'p' }))];
  const N = new Map(nodes.map((n) => [n.id, n]));
  const B = new Map(D.branches.map((b) => [b.id, b]));
  for (const n of nodes) n.links = [];
  const edges = D.links.map((l, i) => ({ ...l, i, s: N.get(l.a), t: N.get(l.b) }));
  for (const e of edges) { e.s.links.push(e); e.t.links.push(e); }
  for (const n of nodes) n.r = n.kind === 't' ? 7 + Math.min(7, n.links.length * 0.42) : 4 + Math.min(3.5, n.links.length * 0.45);
  const name = (id) => tx(N.get(id).name);
  const EDGE = {
    explains: ['能很好解释', 'Explains well'], partial: ['只解释一部分', 'Explains in part'], fails: ['解释不了', 'Cannot explain'],
    candidate: ['候选解答', 'Candidate answer'], limit: ['极限下退化为', 'Reduces in a limit to'], builds: ['建立在……之上', 'Builds on'], replaces: ['取代', 'Replaces'],
  };
  const EDGE_KEYS = ['explains', 'partial', 'fails', 'candidate', 'limit', 'builds'];
  const edgeKey = (t) => (t === 'replaces' ? 'builds' : t);

  // ── 首屏 ──────────────────────────────────────────────────────────────
  const openN = D.problems.filter((p) => p.st === 'open').length;
  $('#pr-quote').innerHTML = L('每一个物理理论都是一张地图，而每一张地图都有边。', 'Every physical theory is a map, and every map has an edge.')
    + (en ? '' : '<span class="pr-q-en" lang="en" translate="no">Every physical theory is a map, and every map has an edge.</span>');
  $('#pr-lead').innerHTML = L(
    `从牛顿力学到量子场论，从热力学到宇宙学，这里把 ${D.theories.length} 个物理理论和它们要回答的 ${D.problems.length} 个问题连成一张网：哪个理论能很好地解释哪个现象，哪里只解释了一半，又在哪里彻底失效、把接力棒交给了下一个理论。点任意一个节点，看它的适用范围和疆界在哪里。`,
    `From Newtonian mechanics to quantum field theory, from thermodynamics to cosmology, this page links ${D.theories.length} physical theories and the ${D.problems.length} questions they set out to answer into one web: which theory explains which phenomenon well, where it only gets halfway, and where it fails outright and hands the baton to the next theory. Click any node to see its domain of validity and where its frontier lies.`);
  $('#pr-honest').innerHTML = L(
    '这是一张教学用的地图，不是学科分类的标准答案：一条连线压缩了很多历史和细节，“失效”指的是在那个问题上需要更完整的理论，并不是说原来的理论错了。数值和年份在编写时逐条核对过；未解决的问题如实标注，不替任何候选理论下结论。',
    'This is a teaching map, not an official taxonomy: each line compresses a lot of history and detail, and “cannot explain” means a more complete theory is needed for that question, not that the older theory is wrong. Figures and dates were checked one by one when written; open problems are labelled as open, and no candidate theory is declared the winner.');
  $('#pr-stats').innerHTML = [
    [D.theories.length, '个理论', 'theories'], [D.problems.length, '个问题与现象', 'problems & phenomena'], [D.links.length, '条关系', 'links'],
    [D.links.filter((l) => l.type === 'fails').length, '处疆界（解释不了）', 'frontiers (cannot explain)'], [openN, '个未解决的问题', 'open problems'],
  ].map(([n, zh, e]) => `<div><dt translate="no">${n}</dt><dd>${L(zh, e)}</dd></div>`).join('');
  $('#pr-jump').innerHTML = [
    ['#pr-map', '网状图', 'The graph', true], ['#pr-cube', 'ħ-c-G 立方体', 'The ħ-c-G cube'], ['#pr-bounds', '各理论的疆界', 'Where each theory ends'], ['#pr-open', '未解决的问题', 'Open problems'],
  ].map(([h, zh, e, p]) => `<a class="button${p ? ' primary' : ''}" href="${h}">${L(zh, e)}</a>`).join('');

  // ── 图的工具栏与图例 ──────────────────────────────────────────────────
  $('#pr-map-h').innerHTML = L('理论与问题的网状图', 'The web of theories and problems');
  $('#pr-map-note').innerHTML = L(
    '大圆点是理论，小圆点是问题，虚线圈是未解决的问题。拖动画布平移，滚轮或双指缩放，拖动节点会带动和它相连的节点。鼠标停在节点上会高亮它的邻居；点一下固定选中，旁边的面板列出它解释什么、在哪里失效。',
    'Large dots are theories, small dots are problems, dashed rings are open problems. Drag the canvas to pan, scroll or pinch to zoom, and drag a node to pull its neighbours along. Hover a node to light up its neighbours; click to pin it and the panel lists what it explains and where it fails.');
  const view = Object.assign({ branches: D.branches.map((b) => b.id), edges: EDGE_KEYS, openOnly: false, local: false, depth: 1, labels: false }, store.get('molastria-realms-view', {}));
  const saveView = () => store.set('molastria-realms-view', { branches: view.branches, edges: view.edges, openOnly: view.openOnly, local: view.local, depth: view.depth, labels: view.labels });
  $('#pr-tools').innerHTML = `
    <div class="pr-search" role="search"><label for="pr-q" class="pr-vh">${L('搜索理论或问题', 'Search theories or problems')}</label>
      <input id="pr-q" type="search" list="pr-names" autocomplete="off" placeholder="${esc(en ? 'Search: GPS, gold, blackbody…' : '搜索：GPS、金的颜色、黑体辐射……')}">
      <datalist id="pr-names">${nodes.map((n) => `<option value="${esc(tx(n.name))}">`).join('')}</datalist></div>
    <div class="pr-toggles">
      <label><input type="checkbox" id="pr-local"${view.local ? ' checked' : ''}>${L('局部图', 'Local graph')}</label>
      <select id="pr-depth" aria-label="${esc(en ? 'Local graph depth' : '局部图的深度')}" translate="no">${[1, 2].map((d) => `<option value="${d}"${view.depth === d ? ' selected' : ''}>${esc(en ? `${d} step${d > 1 ? 's' : ''}` : `${d} 步`)}</option>`).join('')}</select>
      <label><input type="checkbox" id="pr-openonly"${view.openOnly ? ' checked' : ''}>${L('问题只看未解决的', 'Open problems only')}</label>
      <label><input type="checkbox" id="pr-labels"${view.labels ? ' checked' : ''}>${L('显示全部名称', 'Show all labels')}</label>
    </div>
    <div class="pr-filter" aria-label="${esc(en ? 'Branches' : '分支')}">${D.branches.map((b) => `<button type="button" class="pr-bchip" data-b="${b.id}" aria-pressed="${view.branches.includes(b.id)}">${R(b.name)}</button>`).join('')}</div>
    <div class="pr-filter pr-efilter" aria-label="${esc(en ? 'Kinds of link' : '关系的类型')}">${EDGE_KEYS.map((k) => `<button type="button" class="pr-echip" data-e="${k}" aria-pressed="${view.edges.includes(k)}"><i class="pr-eline" data-type="${k}" aria-hidden="true"></i>${L(...EDGE[k])}</button>`).join('')}</div>`;
  $('#pr-legend').innerHTML = `
    <span><i class="pr-lg pr-lg-t" aria-hidden="true"></i>${L('理论', 'Theory')}</span>
    <span><i class="pr-lg pr-lg-p" aria-hidden="true"></i>${L('已解释的问题', 'Explained problem')}</span>
    <span><i class="pr-lg pr-lg-open" aria-hidden="true"></i>${L('未解决的问题', 'Open problem')}</span>
    <span><i class="pr-lg pr-lg-pred" aria-hidden="true"></i>${L('预言待证实', 'Predicted, unconfirmed')}</span>
    <span><i class="pr-lg pr-lg-cand" aria-hidden="true"></i>${L('候选或尚未检验的理论', 'Candidate or untested theory')}</span>
    <span class="pr-lg-arrow"><i class="pr-eline" data-type="limit" aria-hidden="true"></i>${L('金色箭头：在极限下退化为', 'Gold arrow: reduces in a limit to')}</span>`;

  // ── 力导向布局 ────────────────────────────────────────────────────────
  // 每个分支在一个圆上有自己的锚点，节点被弱弱地拉向锚点，于是同一分支聚成一团；连线是弹簧，节点之间互相排斥。
  const ORDER = ['classical', 'complex', 'thermo', 'cm', 'chem', 'quantum', 'qft', 'frontier', 'cosmo', 'rel', 'em'];
  const anchor = {};
  ORDER.forEach((b, i) => { const a = (i / ORDER.length) * Math.PI * 2 - Math.PI / 2; anchor[b] = [Math.cos(a) * 520, Math.sin(a) * 380]; });
  let seed = 7;
  const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
  for (const n of nodes) { const [ax, ay] = anchor[n.b]; n.x = ax + (rnd() - 0.5) * 120; n.y = ay + (rnd() - 0.5) * 120; n.vx = 0; n.vy = 0; }
  let alpha = 1;
  const REST = { limit: 120, builds: 125, replaces: 120, explains: 78, partial: 88, fails: 96, candidate: 96 };
  const tick = () => {
    const live = nodes.filter((n) => n.vis);
    for (let i = 0; i < live.length; i++) {
      const a = live[i];
      for (let j = i + 1; j < live.length; j++) {
        const b = live[j];
        let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
        if (d2 < 1) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = 1; }
        if (d2 > 250000) continue;
        const q = (a.kind === 't' ? 1.7 : 1) * (b.kind === 't' ? 1.7 : 1);
        const f = (2000 * q * alpha) / d2, d = Math.sqrt(d2);
        a.vx -= (dx / d) * f; a.vy -= (dy / d) * f; b.vx += (dx / d) * f; b.vy += (dy / d) * f;
      }
    }
    for (const e of edges) {
      if (!e.vis) continue;
      const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const k = (e.s.kind === 't' && e.t.kind === 't' ? 0.035 : 0.05) * alpha, f = (d - REST[e.type]) * k;
      const fx = (dx / d) * f, fy = (dy / d) * f;
      e.s.vx += fx; e.s.vy += fy; e.t.vx -= fx; e.t.vy -= fy;
    }
    for (const n of live) {
      const [ax, ay] = anchor[n.b], g = (n.kind === 't' ? 0.016 : 0.006) * alpha;
      n.vx += (ax - n.x) * g - n.x * 0.002 * alpha; n.vy += (ay - n.y) * g - n.y * 0.002 * alpha;
      if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
      n.vx *= 0.58; n.vy *= 0.58;
      n.x += Math.max(-30, Math.min(30, n.vx)); n.y += Math.max(-30, Math.min(30, n.vy));
    }
    alpha = Math.max(0.0, alpha * 0.982);
  };

  // ── SVG ───────────────────────────────────────────────────────────────
  const svg = $('#pr-graph'), wrap = $('#pr-graph-wrap');
  svg.setAttribute('aria-label', en ? 'Graph of physical theories and the problems they explain' : '物理理论与它们所解释问题的网状图');
  svg.innerHTML = `<defs><marker id="pr-arrow" viewBox="0 0 10 10" refX="10" refY="5" markerWidth="6" markerHeight="6" orient="auto"><path d="M0 0L10 5L0 10z"/></marker></defs><g id="pr-vp"><g id="pr-edges"></g><g id="pr-nodes"></g></g>`;
  const vp = $('#pr-vp'), gE = $('#pr-edges'), gN = $('#pr-nodes');
  for (const e of edges) {
    e.el = document.createElementNS(SVGNS, 'line');
    e.el.setAttribute('class', 'pr-edge');
    e.el.dataset.type = e.type;
    if (e.type === 'limit') e.el.setAttribute('marker-end', 'url(#pr-arrow)');
    gE.appendChild(e.el);
  }
  for (const n of nodes) {
    const g = document.createElementNS(SVGNS, 'g');
    g.setAttribute('class', `pr-node pr-${n.kind}`);
    g.dataset.id = n.id; g.dataset.b = n.b; g.dataset.st = n.st;
    g.innerHTML = `<circle r="${n.r.toFixed(1)}"></circle><text y="${(n.r + 12).toFixed(1)}" translate="no" lang="${lang}">${esc(tx(n.name).replace(/\s*[（(][^）)]*[）)]\s*$/, ''))}</text>`;
    n.el = g; gN.appendChild(g);
  }
  const cam = { x: 0, y: 0, k: 1 };
  let W = 800, H = 600;
  const applyCam = () => {
    vp.setAttribute('transform', `translate(${(W / 2 + cam.x).toFixed(1)} ${(H / 2 + cam.y).toFixed(1)}) scale(${cam.k.toFixed(4)})`);
    svg.classList.toggle('pr-near', cam.k > 1.35);
    // 缩小时文字按比例放大一些，保持能读
    svg.style.setProperty('--pr-label', `${(11.5 / Math.min(1, Math.sqrt(cam.k))).toFixed(2)}px`);
  };
  const draw = () => {
    for (const n of nodes) if (n.vis) n.el.setAttribute('transform', `translate(${n.x.toFixed(1)} ${n.y.toFixed(1)})`);
    for (const e of edges) {
      if (!e.vis) continue;
      const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
      const pad = e.type === 'limit' ? e.t.r + 3 : 0;
      e.el.setAttribute('x1', e.s.x.toFixed(1)); e.el.setAttribute('y1', e.s.y.toFixed(1));
      e.el.setAttribute('x2', (e.t.x - (dx / d) * pad).toFixed(1)); e.el.setAttribute('y2', (e.t.y - (dy / d) * pad).toFixed(1));
    }
  };
  const resize = () => {
    W = svg.clientWidth || 800; H = svg.clientHeight || 600;
    svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
    applyCam();
  };
  let raf = 0;
  const run = () => {
    if (raf) return;
    const step = () => { tick(); draw(); raf = alpha > 0.01 ? requestAnimationFrame(step) : 0; };
    raf = requestAnimationFrame(step);
  };
  const reheat = (a = 0.35) => { alpha = Math.max(alpha, a); run(); };

  // ── 可见性：筛选与局部图 ──────────────────────────────────────────────
  let picked = null, hover = null;
  const within = (id, depth) => {
    const seen = new Set([id]); let front = [id];
    for (let k = 0; k < depth; k++) {
      const next = [];
      for (const v of front) for (const e of N.get(v).links) { if (!view.edges.includes(edgeKey(e.type))) continue; const o = e.a === v ? e.b : e.a; if (!seen.has(o)) { seen.add(o); next.push(o); } }
      front = next;
    }
    return seen;
  };
  const applyVisibility = () => {
    const local = view.local && picked ? within(picked, view.depth) : null;
    for (const n of nodes) {
      n.vis = view.branches.includes(n.b) && (n.kind === 't' || !view.openOnly || n.st !== 'solved');
      if (local) n.vis = local.has(n.id);
      if (n.id === picked) n.vis = true;
      n.el.classList.toggle('gone', !n.vis);
    }
    for (const e of edges) { e.vis = e.s.vis && e.t.vis && view.edges.includes(edgeKey(e.type)); e.el.classList.toggle('gone', !e.vis); }
    svg.classList.toggle('pr-all-labels', view.labels || !!local);
    for (const b of document.querySelectorAll('.pr-bchip')) b.setAttribute('aria-pressed', view.branches.includes(b.dataset.b));
    for (const b of document.querySelectorAll('.pr-echip')) b.setAttribute('aria-pressed', view.edges.includes(b.dataset.e));
    $('#pr-count').innerHTML = L(`显示 ${nodes.filter((n) => n.vis).length} 个节点、${edges.filter((e) => e.vis).length} 条关系`, `Showing ${nodes.filter((n) => n.vis).length} nodes and ${edges.filter((e) => e.vis).length} links`);
  };
  const focus = (id) => {
    const near = new Set();
    if (id) { near.add(id); for (const e of N.get(id).links) if (e.vis) { near.add(e.a); near.add(e.b); } }
    svg.classList.toggle('pr-focus', !!id);
    for (const n of nodes) { n.el.classList.toggle('hl', near.has(n.id)); n.el.classList.toggle('on', n.id === picked); }
    for (const e of edges) e.el.classList.toggle('hl', !!id && (e.a === id || e.b === id));
  };

  // ── 视角：适配、平移到节点 ────────────────────────────────────────────
  let anim = 0;
  const animateTo = (goal) => {
    cancelAnimationFrame(anim);
    const from = { ...cam }, t0 = performance.now();
    const step = (t) => {
      const u = Math.min(1, (t - t0) / 420), s = u * u * (3 - 2 * u);
      cam.x = from.x + (goal.x - from.x) * s; cam.y = from.y + (goal.y - from.y) * s; cam.k = from.k + (goal.k - from.k) * s;
      applyCam(); if (u < 1) anim = requestAnimationFrame(step);
    };
    anim = requestAnimationFrame(step);
  };
  const fitGoal = () => {
    const vis = nodes.filter((n) => n.vis);
    if (!vis.length) return { x: 0, y: 0, k: 1 };
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity;
    for (const n of vis) { x0 = Math.min(x0, n.x - 40); x1 = Math.max(x1, n.x + 40); y0 = Math.min(y0, n.y - 20); y1 = Math.max(y1, n.y + 30); }
    const k = Math.max(0.3, Math.min(2.2, Math.min(W / (x1 - x0), H / (y1 - y0))));
    return { x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k, k };
  };
  const fit = (instant) => { const g = fitGoal(); if (instant) { Object.assign(cam, g); applyCam(); } else animateTo(g); };
  const centerOn = (n) => { const k = Math.max(cam.k, 1.15); animateTo({ x: -n.x * k, y: -n.y * k, k }); };

  // ── 侧栏 ──────────────────────────────────────────────────────────────
  const panel = $('#pr-panel');
  const chip = (id, note) => {
    const n = N.get(id);
    return `<li><button type="button" class="pr-chip pr-chip-${n.kind}" data-go="${id}" data-b="${n.b}" data-st="${n.st}" translate="no" lang="${lang}">${esc(tx(n.name))}</button>${note ? C(esc(tx(note)), 'p') : ''}</li>`;
  };
  const badge = (n) => (n.kind === 't'
    ? `<span class="pr-st" data-s="${n.st}">${R(D.status[n.st])}</span>`
    : `<span class="pr-st" data-s="p-${n.st}">${R(D.pstatus[n.st])}</span>`);
  const group = (title, items) => (items.length ? `<h4>${title}</h4><ul class="pr-rel">${items.join('')}</ul>` : '');
  const intro = () => {
    const tips = ['p-hydrogen', 'p-gps', 'p-gold', 'p-blackbody', 'p-mercury', 'p-hightc', 'gr', 'qchem'];
    return `<p class="pr-panel-k">${L('从这里开始', 'Start here')}</p>
      <h3>${L('选一个节点', 'Pick a node')}</h3>
      <p>${L('点图上的任意圆点，或者先看看这几个：氢原子光谱一路串起四个理论；GPS 同时需要两种相对论；金的颜色是相对论量子化学的结果。', 'Click any dot on the graph, or try one of these: the hydrogen spectrum threads through four theories; GPS needs both relativities; the colour of gold is a result of relativistic quantum chemistry.')}</p>
      <ul class="pr-rel pr-tips">${tips.map((id) => chip(id)).join('')}</ul>
      <p class="pr-hint">${L('键盘：在搜索框里输入名称后按回车；Esc 取消选中。', 'Keyboard: type a name in the search box and press Enter; Esc clears the selection.')}</p>`;
  };
  const showPanel = (id) => {
    if (!id) { panel.innerHTML = intro(); return; }
    const n = N.get(id), out = (type) => n.links.filter((e) => e.type === type && e.a === id), inc = (type) => n.links.filter((e) => e.type === type && e.b === id);
    const head = `<p class="pr-panel-k"><span class="pr-dot" data-b="${n.b}" aria-hidden="true"></span>${R(B.get(n.b).name)}${n.year ? ` · <span translate="no">${esc(n.year)}</span>` : ''}</p>
      <h3 translate="no" lang="${lang}">${esc(tx(n.name))}</h3><p>${badge(n)}</p>`;
    if (n.kind === 't') {
      const lineage = [
        ...out('limit').map((e) => chip(e.b, T2(`在 ${tx(e.note)} 时退化为它`, `Reduces to it when ${tx(e.note)}`))),
        ...inc('limit').map((e) => chip(e.a, T2(`更完整的理论：它在 ${tx(e.note)} 时回到本理论`, `More complete theory: reduces to this one when ${tx(e.note)}`))),
        ...inc('builds').map((e) => chip(e.a, T2(`本理论建立在它之上：${tx(e.note)}`, `This theory builds on it: ${tx(e.note)}`))),
        ...out('builds').map((e) => chip(e.b, T2(`建立在本理论之上：${tx(e.note)}`, `Builds on this theory: ${tx(e.note)}`))),
        ...out('replaces').map((e) => chip(e.b, T2(`被本理论取代：${tx(e.note)}`, `Replaced by this theory: ${tx(e.note)}`))),
        ...inc('replaces').map((e) => chip(e.a, T2(`取代了本理论：${tx(e.note)}`, `Replaced this theory: ${tx(e.note)}`))),
      ];
      panel.innerHTML = head + `${R(n.gist, 'p')}${n.eq ? `<p class="pr-eq" translate="no">${esc(n.eq)}</p>` : ''}
        <h4>${L('适用范围', 'Where it works')}</h4>${R(n.works, 'p', 'pr-works')}
        <h4>${L('疆界：在这里失效', 'Frontier: where it breaks down')}</h4>${R(n.breaks, 'p', 'pr-breaks')}
        ${group(L('能很好解释', 'Explains well'), out('explains').map((e) => chip(e.b, e.note)))}
        ${group(L('只解释一部分', 'Explains in part'), out('partial').map((e) => chip(e.b, e.note)))}
        ${group(L('解释不了', 'Cannot explain'), out('fails').map((e) => chip(e.b, e.note)))}
        ${group(L('作为候选解答', 'Offered as a candidate answer'), out('candidate').map((e) => chip(e.b, e.note)))}
        ${group(L('极限与传承', 'Limits & lineage'), lineage)}
        ${n.link ? `<p><a class="button" href="${esc(n.link[0])}">${L(n.link[1], n.link[2])} ${ext}</a></p>` : ''}`;
    } else {
      panel.innerHTML = head + `${R(n.desc, 'p')}
        ${group(L('能很好解释它的理论', 'Theories that explain it well'), inc('explains').map((e) => chip(e.a, e.note)))}
        ${group(L('只解释了一部分', 'Explain it in part'), inc('partial').map((e) => chip(e.a, e.note)))}
        ${group(L('在这里失效的理论', 'Theories that break down here'), inc('fails').map((e) => chip(e.a, e.note)))}
        ${group(L('候选解答', 'Candidate answers'), inc('candidate').map((e) => chip(e.a, e.note)))}`;
    }
    panel.scrollTop = 0;
  };
  function T2(zh, e) { return { zh, en: e }; }

  const select = (id, { center = true, hash = true } = {}) => {
    if (id && !N.has(id)) id = null;
    picked = id;
    if (id && !N.get(id).vis) { // 被筛选掉的节点：先把它的分支打开
      const n = N.get(id);
      if (!view.branches.includes(n.b)) view.branches.push(n.b);
      if (n.kind === 'p' && view.openOnly && n.st === 'solved') view.openOnly = false, $('#pr-openonly').checked = false;
    }
    applyVisibility(); focus(id); showPanel(id);
    if (view.local) { reheat(0.25); setTimeout(() => fit(), 30); } else if (id && center) centerOn(N.get(id));
    if (hash) history.replaceState(null, '', id ? `#n-${id}` : location.pathname + location.search);
  };

  // ── 指针：平移、缩放、拖动节点 ────────────────────────────────────────
  // CSS zoom（顶栏的界面缩放）下 clientX 与元素内部坐标的比例不同，所以按 rect.width / clientWidth 换算。
  const local = (ev) => { const r = svg.getBoundingClientRect(), s = r.width / (svg.clientWidth || r.width) || 1; return [(ev.clientX - r.left) / s, (ev.clientY - r.top) / s]; };
  const toWorld = ([sx, sy]) => [(sx - W / 2 - cam.x) / cam.k, (sy - H / 2 - cam.y) / cam.k];
  const zoomAt = ([sx, sy], f) => {
    cancelAnimationFrame(anim);
    const k = Math.max(0.25, Math.min(4, cam.k * f)), [wx, wy] = toWorld([sx, sy]);
    cam.k = k; cam.x = sx - W / 2 - wx * k; cam.y = sy - H / 2 - wy * k; applyCam();
  };
  const ptr = new Map();
  let drag = null, pinch = null, moved = 0;
  svg.addEventListener('pointerdown', (ev) => {
    if (ev.button > 0) return;
    svg.setPointerCapture(ev.pointerId);
    ptr.set(ev.pointerId, local(ev));
    moved = 0;
    if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, k: cam.k }; if (drag?.node) drag.node.fixed = false; drag = null; return; }
    const g = ev.target.closest('.pr-node');
    const p = local(ev);
    if (g) { const n = N.get(g.dataset.id); n.fixed = true; drag = { node: n, p }; }
    else drag = { pan: true, p, cx: cam.x, cy: cam.y };
  });
  svg.addEventListener('pointermove', (ev) => {
    const p = local(ev);
    if (ptr.has(ev.pointerId)) ptr.set(ev.pointerId, p);
    if (pinch && ptr.size === 2) {
      const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
      zoomAt([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], (pinch.k * d / pinch.d) / cam.k); return;
    }
    if (!drag) {
      const g = ev.target.closest?.('.pr-node'), id = g ? g.dataset.id : null;
      if (id !== hover) { hover = id; if (!picked) focus(id); svg.style.cursor = id ? 'pointer' : ''; }
      return;
    }
    moved += Math.abs(p[0] - drag.p[0]) + Math.abs(p[1] - drag.p[1]);
    if (drag.pan) { cam.x = drag.cx + p[0] - drag.p[0]; cam.y = drag.cy + p[1] - drag.p[1]; applyCam(); svg.classList.add('pr-panning'); return; }
    if (moved > 3) { const [wx, wy] = toWorld(p); drag.node.x = wx; drag.node.y = wy; drag.node.vx = drag.node.vy = 0; reheat(0.3); draw(); }
  });
  const end = (ev) => {
    ptr.delete(ev.pointerId);
    if (ptr.size < 2) pinch = null;
    if (!drag) return;
    const d = drag; drag = null; svg.classList.remove('pr-panning');
    if (d.node) d.node.fixed = false;
    if (moved <= 4 && ev.type === 'pointerup') {
      if (d.node) select(d.node.id === picked ? null : d.node.id, { center: false });
      else if (picked) select(null);
    }
  };
  svg.addEventListener('pointerup', end);
  svg.addEventListener('pointercancel', end);
  svg.addEventListener('pointerleave', () => { if (!drag && hover) { hover = null; if (!picked) focus(null); } });
  svg.addEventListener('wheel', (ev) => { ev.preventDefault(); zoomAt(local(ev), Math.exp(-Math.max(-60, Math.min(60, ev.deltaY)) * 0.0035)); }, { passive: false });
  $('#pr-zoom').innerHTML = `<button type="button" class="pr-zbtn" data-z="in" aria-label="${esc(en ? 'Zoom in' : '放大')}">+</button><button type="button" class="pr-zbtn" data-z="out" aria-label="${esc(en ? 'Zoom out' : '缩小')}">−</button><button type="button" class="pr-zbtn pr-zfit" data-z="fit">${L('全图', 'Fit')}</button>`;
  $('#pr-zoom').addEventListener('click', (ev) => {
    const z = ev.target.closest('[data-z]')?.dataset.z; if (!z) return;
    if (z === 'fit') fit(); else zoomAt([W / 2, H / 2], z === 'in' ? 1.3 : 1 / 1.3);
  });

  // ── 工具栏事件 ────────────────────────────────────────────────────────
  document.addEventListener('click', (ev) => {
    const go = ev.target.closest('[data-go]');
    if (go) { ev.preventDefault(); select(go.dataset.go); if (!go.closest('#pr-panel')) wrap.scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const bc = ev.target.closest('.pr-bchip');
    if (bc) {
      const b = bc.dataset.b, on = view.branches.includes(b);
      // 按住 Alt 点：只看这一个分支；全部关掉时恢复全部
      if (ev.altKey) view.branches = [b];
      else view.branches = on ? view.branches.filter((x) => x !== b) : [...view.branches, b];
      if (!view.branches.length) view.branches = D.branches.map((x) => x.id);
      if (picked && !view.branches.includes(N.get(picked).b)) { picked = null; showPanel(null); }
      saveView(); applyVisibility(); focus(picked); reheat(0.4); return;
    }
    const ec = ev.target.closest('.pr-echip');
    if (ec) {
      const k = ec.dataset.e, on = view.edges.includes(k);
      view.edges = on ? view.edges.filter((x) => x !== k) : [...view.edges, k];
      saveView(); applyVisibility(); focus(picked); reheat(0.25);
    }
  });
  $('#pr-local').addEventListener('change', (ev) => { view.local = ev.target.checked; saveView(); applyVisibility(); focus(picked); reheat(0.3); setTimeout(() => fit(), 40); });
  $('#pr-depth').addEventListener('change', (ev) => { view.depth = +ev.target.value; saveView(); if (view.local) { applyVisibility(); focus(picked); reheat(0.3); setTimeout(() => fit(), 40); } });
  $('#pr-openonly').addEventListener('change', (ev) => { view.openOnly = ev.target.checked; saveView(); applyVisibility(); focus(picked); reheat(0.35); });
  $('#pr-labels').addEventListener('change', (ev) => { view.labels = ev.target.checked; saveView(); applyVisibility(); });
  const q = $('#pr-q');
  const norm = (s) => s.toLowerCase().replace(/[\s·（）()、，,-]/g, '');
  const matches = (s) => { const k = norm(s); return k ? nodes.filter((n) => norm(n.name.zh).includes(k) || norm(n.name.en).includes(k)) : []; };
  q.addEventListener('input', () => {
    const m = new Set(matches(q.value).map((n) => n.id));
    for (const n of nodes) n.el.classList.toggle('match', m.has(n.id));
    svg.classList.toggle('pr-searching', m.size > 0);
    const exact = nodes.find((n) => tx(n.name) === q.value);
    if (exact) select(exact.id);
  });
  q.addEventListener('keydown', (ev) => {
    if (ev.key === 'Enter') { ev.preventDefault(); const m = matches(q.value); if (m.length) select(m[0].id); }
    if (ev.key === 'Escape') { q.value = ''; q.dispatchEvent(new Event('input')); }
  });
  document.addEventListener('keydown', (ev) => { if (ev.key === 'Escape' && picked && document.activeElement !== q) select(null); });

  // ── 启动：先在后台算好布局，再显示 ────────────────────────────────────
  applyVisibility();
  for (let i = 0; i < 320; i++) tick();
  alpha = 0;
  resize(); fit(true); draw(); focus(null); showPanel(null);
  if ('ResizeObserver' in window) new ResizeObserver(() => { const k = W; resize(); if (Math.abs(k - W) > 40) fit(true); }).observe(svg);

  // ── ħ-c-G 立方体 ──────────────────────────────────────────────────────
  $('#pr-cube-h').innerHTML = L('ħ-c-G 立方体：三个常数，八个角', 'The ħ-c-G cube: three constants, eight corners');
  $('#pr-cube-note').innerHTML = L(
    '一个理论在多大范围里成立，常常可以用它“打开”了哪些基本常数来概括：1/c 不为零意味着相对论效应，G 意味着引力，ħ 意味着量子效应。从牛顿力学这个角出发，每打开一个常数就走到一个更大的理论。再加上玻尔兹曼常数 k_B 就进入统计物理；霍金温度 T = ħc³/(8πGMk_B) 同时用到了全部四个。点一个角，在上面的网状图里定位它。',
    'How far a theory reaches can often be summed up by which fundamental constants it “switches on”: a non-zero 1/c brings relativity, G brings gravity, ħ brings quantum effects. Starting from the Newtonian corner, each constant you switch on takes you to a larger theory. Add Boltzmann’s constant k_B and you enter statistical physics; the Hawking temperature T = ħc³/(8πGMk_B) uses all four at once. Click a corner to find it in the graph above.');
  const O = [78, 268], EX = [190, 0], EY = [92, -78], EZ = [0, -168];
  const pos = ([a, b, c]) => [O[0] + a * EX[0] + b * EY[0] + c * EZ[0], O[1] + a * EX[1] + b * EY[1] + c * EZ[1]];
  const cubeSvg = $('#pr-cube-svg');
  cubeSvg.setAttribute('aria-label', en ? 'The ħ-c-G cube of physical theories' : '物理理论的 ħ-c-G 立方体');
  let cs = '';
  for (const v of D.cube) for (let ax = 0; ax < 3; ax++) if (!v.k[ax]) {
    const w = v.k.slice(); w[ax] = 1; const [x1, y1] = pos(v.k), [x2, y2] = pos(w);
    cs += `<line class="pr-cube-e${v.k.every((x) => !x) ? ' pr-cube-axis' : ''}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/>`;
  }
  const axl = [[[0.55, 0, 0], '1/c', 0, 18], [[0, 0.55, 0], 'G', 14, 10], [[0, 0, 0.5], 'ħ', -16, 4]];
  for (const [p, t, dx, dy] of axl) { const [x, y] = pos(p); cs += `<text class="pr-cube-ax" x="${x + dx}" y="${y + dy}" translate="no">${t}</text>`; }
  D.cube.forEach((v, i) => {
    const [x, y] = pos(v.k), right = v.k[0] === 1, lx = right ? x + 12 : x - 12;
    cs += `<g class="pr-cube-v" tabindex="0" role="button" data-i="${i}"${v.node ? ` data-b="${N.get(v.node).b}"` : ''}><circle cx="${x}" cy="${y}" r="8"/><text x="${lx}" y="${y + 4}" text-anchor="${right ? 'start' : 'end'}" translate="no" lang="${lang}">${esc(tx(v.name))}</text></g>`;
  });
  cubeSvg.innerHTML = cs;
  const cubeInfo = (i) => {
    const v = D.cube[i];
    for (const g of cubeSvg.querySelectorAll('.pr-cube-v')) g.classList.toggle('on', +g.dataset.i === i);
    const on = ['1/c', 'G', 'ħ'].filter((_, a) => v.k[a]);
    $('#pr-cube-info').innerHTML = `<p class="pr-panel-k pr-cube-k" translate="no">${on.length ? esc(on.join(' + ')) : '—'}</p><h3 translate="no" lang="${lang}">${esc(tx(v.name))}</h3>${R(v.note, 'p')}${v.node ? `<p><button type="button" class="button" data-go="${v.node}">${L('在网状图里看', 'Show in the graph')} <i class="ico-ext ico-up" aria-hidden="true"></i></button></p>` : ''}`;
  };
  cubeSvg.addEventListener('click', (ev) => { const g = ev.target.closest('.pr-cube-v'); if (g) cubeInfo(+g.dataset.i); });
  cubeSvg.addEventListener('keydown', (ev) => { const g = ev.target.closest('.pr-cube-v'); if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); cubeInfo(+g.dataset.i); } });
  cubeSvg.addEventListener('mouseover', (ev) => { const g = ev.target.closest('.pr-cube-v'); if (g) cubeInfo(+g.dataset.i); });
  cubeInfo(7);

  // ── 各理论的疆界 ──────────────────────────────────────────────────────
  $('#pr-bounds-h').innerHTML = L('各理论的疆界一览', 'Where each theory ends');
  $('#pr-bounds-note').innerHTML = L('每个理论一张卡片：在什么条件下成立、在哪里失效，以及接替它的更完整的理论。', 'One card per theory: the conditions under which it holds, where it breaks down, and the more complete theory that takes over.');
  $('#pr-bounds-filter').innerHTML = `<label>${L('分支', 'Branch')}<select id="pr-bf" translate="no"><option value="">${esc(en ? 'All branches' : '全部分支')}</option>${D.branches.filter((b) => D.theories.some((t) => t.b === b.id)).map((b) => `<option value="${b.id}">${esc(tx(b.name))}</option>`).join('')}</select></label>`;
  const successors = (id) => edges.filter((e) => e.type === 'limit' && e.b === id).map((e) => e.a);
  const drawBounds = () => {
    const f = $('#pr-bf').value;
    $('#pr-bounds-list').innerHTML = D.theories.filter((t) => !f || t.b === f).map((t) => {
      const sup = successors(t.id), red = edges.filter((e) => e.type === 'limit' && e.a === t.id).map((e) => e.b);
      return `<article class="pr-bound" data-b="${t.b}">
        <header><span class="pr-dot" data-b="${t.b}" aria-hidden="true"></span><h3><button type="button" class="pr-link" data-go="${t.id}" translate="no" lang="${lang}">${esc(tx(t.name))}</button></h3><span class="pr-st" data-s="${t.st}">${R(D.status[t.st])}</span></header>
        <dl><dt>${L('成立', 'Holds')}</dt><dd>${R(t.works)}</dd><dt>${L('失效', 'Breaks')}</dt><dd>${R(t.breaks)}</dd>
        ${sup.length ? `<dt>${L('更完整的理论', 'Superseded by')}</dt><dd><ul class="pr-inline">${sup.map((id) => chip(id)).join('')}</ul></dd>` : ''}
        ${red.length ? `<dt>${L('极限下退化为', 'Reduces to')}</dt><dd><ul class="pr-inline">${red.map((id) => chip(id)).join('')}</ul></dd>` : ''}</dl>
      </article>`;
    }).join('');
  };
  $('#pr-bf').addEventListener('change', drawBounds);
  drawBounds();

  // ── 未解决的问题 ──────────────────────────────────────────────────────
  $('#pr-open-h').innerHTML = L('疆界之外：未解决的问题', 'Beyond the frontier: open problems');
  $('#pr-open-note').innerHTML = L('这些问题现有的理论都解释不了，或者只解释了一部分；“预言待证实”是理论已经给出答案、实验还没有确认的问题。', 'No current theory explains these, or only in part; “predicted, not yet confirmed” marks questions where theory has given an answer that experiment has yet to confirm.');
  const rel = (p, type) => p.links.filter((e) => e.b === p.id && e.type === type).map((e) => e.a);
  $('#pr-open-list').innerHTML = nodes.filter((n) => n.kind === 'p' && n.st !== 'solved').sort((a, b) => (a.st === 'open' ? 0 : 1) - (b.st === 'open' ? 0 : 1)).map((p) => `<article class="pr-oq" data-b="${p.b}">
      <header><span class="pr-st" data-s="p-${p.st}">${R(D.pstatus[p.st])}</span><h3><button type="button" class="pr-link" data-go="${p.id}" translate="no" lang="${lang}">${esc(tx(p.name))}</button></h3></header>
      ${R(p.desc, 'p')}
      ${rel(p, 'fails').length ? `<p class="pr-oq-k">${L('在这里失效', 'Break down here')}</p><ul class="pr-inline">${rel(p, 'fails').map((id) => chip(id)).join('')}</ul>` : ''}
      ${rel(p, 'partial').length ? `<p class="pr-oq-k">${L('部分解释', 'Explain in part')}</p><ul class="pr-inline">${rel(p, 'partial').map((id) => chip(id)).join('')}</ul>` : ''}
      ${rel(p, 'candidate').length ? `<p class="pr-oq-k">${L('候选解答', 'Candidates')}</p><ul class="pr-inline">${rel(p, 'candidate').map((id) => chip(id)).join('')}</ul>` : ''}
    </article>`).join('');

  $('#pr-foot').innerHTML = `<strong>${L('MolAstria · 物理疆界图', 'MolAstria · Realms of Physics')}</strong>
    <p>${L(`内容由 MolAstria 编写，${D.checked} 核对；全部免费。发现不准确的地方，欢迎在 GitHub 上提 issue。`, `Written by MolAstria and checked on ${D.checked}; all free. If you spot something inaccurate, please open an issue on GitHub.`)}</p>
    <p><a href="../quantum/index.html">${L('量子嘉年华', 'Quantum Carnival')}</a> · <a href="../quantum/physics/index.html">${L('量子物理', 'Quantum physics')}</a> · <a href="../fundamental-science/index.html">${L('进一步基础科学发现', 'Advancing Fundamental Science')}</a> · <a href="../fundamental-science/math/index.html">${L('数学基础与探索', 'Mathematical Foundations & Exploration')}</a> · <a href="../manual/index.html">${L('讲解手册', 'Explainer handbook')}</a> · <a href="#pr-h1">${L('回到顶部', 'Back to top')} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p>`;

  // ── 地址 ──────────────────────────────────────────────────────────────
  const fromHash = () => { const h = location.hash.slice(1); if (h.startsWith('n-') && N.has(h.slice(2))) { select(h.slice(2), { hash: false }); setTimeout(() => $('#pr-map').scrollIntoView({ block: 'start' }), 60); } };
  window.addEventListener('hashchange', fromHash);
  fromHash();
  window.__realms = { select, nodes: () => nodes.filter((n) => n.vis).length, picked: () => picked, cam };
})();
