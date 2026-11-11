/* MolAstria 网状查询：以查询为中心的实体网。引擎在 net-engine.js（实体、关系、检索），这里只管画图、搜索框和结果列表。
   地址栏 ?q=词 或 ?src=来源 可直接分享；点节点换中心会记进浏览器历史，后退键能回到上一个中心。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // i18n.js is deferred and runs after this script, so the language comes from <html lang> (set in the page head) and
  // translations are looked up when labels are drawn; labels are redrawn once the dictionary is ready.
  const EN = document.documentElement.lang === 'en';
  const tr = (s) => (EN && window.ChemI18n?.t ? window.ChemI18n.t(s) : s);
  const TYPE_LABEL = { tutorial: '深度教程', qa: '论坛帖', discipline: '学科频道', tool: '平台工具', software: '软件/官网', archive: '邮件归档', resource: '资源索引', job: '学术招聘', conference: '学术会议', announcement: '公告', preprint: '预印本', paper: '期刊论文', repo: '开源仓库', database: '数据库', handbook: '讲解手册' };
  const KIND_LABEL = { software: '软件', database: '数据库', name: '程序与方法', concept: '概念', topic: '主题', category: '资源分类', source: '来源', doc: '条目', query: '关键词', hub: '全网' };
  const KIND_COLOR = { software: '#3f8a4f', database: '#3f8a4f', name: '#2a8c80', concept: '#7a62b8', topic: '#7a62b8', category: '#2f6f9c', query: '#c4923f', hub: '#c4923f' };
  const PRESETS = ['Shermo', 'Multiwfn', 'ORCA', '静电势', '过渡态', '分子动力学', 'electrostatic potential', '机器学习势', 'ChEMBL', '锂电池 电解液'];
  const NARROW = () => window.matchMedia('(max-width: 640px)').matches;
  const REDUCED = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let NET = null, R = null;                 // engine, current result
  let state = { q: '', src: '' };
  let sourceFilter = '', typeFilter = '', shown = 30;
  let trail = [];
  let recordNext = false;                   // the next render comes from the search box (or a ?q= link), so a miss is recorded
  const counted = new Set();                // each word is counted once per visit
  const reported = new Set();               // words this visit reported to the site owner (the focus note says so)
  const display = (e) => EN && e.nameEn ? e.nameEn.replace(/^./, (c) => c.toUpperCase()) : tr(e.name);
  const sourceOf = (id) => NET.sourceById.get(id) || { id, name: id, color: '#7d8a80' };

  /* ---------- graph model ----------
     A small force simulation in the spirit of Obsidian's graph view: springs along links, repulsion between nodes,
     gravity toward the centre, and a soft hint of rings. Dragging a node keeps the simulation warm so its neighbours
     follow; at rest the nodes drift gently. Recentring glides the camera, fades old nodes out and grows new ones from
     the node they hang off. */
  let nodes = [], edges = [], byId = new Map(), keep = new Map(), ghosts = [];
  let view = { x: 0, y: 0, k: 1 }, goal = null, inertia = null, fitPending = false;
  let alpha = 0, alphaTarget = 0, hover = null, drag = null, pan = null, moved = false, clock = 0, last = 0;
  const pointers = new Map(); let pinch = null;

  function scale() { const c = $('graph'); return Math.max(0.42, Math.min(1.15, Math.min(c.clientWidth || 900, c.clientHeight || 680) / 2 / 400)); }
  function node(id, o) {
    const old = keep.get(id), from = o.from && byId.get(o.from);
    const n = { vx: 0, vy: 0, appear: 0, hl: 1, grow: 0, phase: Math.random() * Math.PI * 2, ...o, id };
    if (old) Object.assign(n, { x: old.x, y: old.y, vx: old.vx, vy: old.vy, appear: old.appear, hl: old.hl, grow: old.grow, phase: old.phase });
    else { const a = Math.random() * Math.PI * 2; n.x = (from ? from.x : 0) + Math.cos(a) * 18; n.y = (from ? from.y : 0) + Math.sin(a) * 18; }
    nodes.push(n); byId.set(id, n); return n;
  }
  function edge(a, b, w, kind, len, k) {
    if (byId.has(a) && byId.has(b) && a !== b && !edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) edges.push({ a, b, w, kind, len, k, phase: Math.random() });
  }

  function buildGraph() {
    const s = scale(), narrow = NARROW();
    const centerId = R.mode === 'entity' ? 'e:' + R.center.idx : R.mode === 'source' ? 's:' + R.source.id : R.mode === 'text' ? 'q' : 'hub';
    // If the new centre is already on screen, slide the world so it sits at the origin and let the camera glide after it.
    const prev = byId.get(centerId);
    if (prev && (prev.x || prev.y)) {
      const dx = prev.x, dy = prev.y;
      for (const n of [...nodes, ...ghosts]) { n.x -= dx; n.y -= dy; }
      view.x += dx * view.k; view.y += dy * view.k;
    }
    keep = new Map(nodes.map((n) => [n.id, n]));
    const before = nodes;
    nodes = []; edges = []; byId = new Map();
    const R1 = 150 * s, RD = 240 * s, R2 = 290 * s, RS = 360 * s;
    const ring1Max = narrow ? 8 : 12, docMax = narrow ? 6 : 10, extMax = narrow ? 3 : 6, ring2Max = narrow ? 6 : 14;
    if (R.mode === 'entity') node(centerId, { kind: R.center.kind, entity: R.center, label: display(R.center), center: true, r: 26 });
    else if (R.mode === 'source') node(centerId, { kind: 'source', source: R.source, label: tr(R.source.name), center: true, r: 26, color: R.source.color });
    else if (R.mode === 'text') node(centerId, { kind: 'query', label: R.q, center: true, r: 24 });
    else node(centerId, { kind: 'hub', label: 'MolAstria', center: true, r: 26 });

    const ring1 = R.related.slice(0, ring1Max);
    const extra = [...(R.siblings || []).slice(0, 4).map((e) => ({ entity: e, sibling: true })), ...(R.category ? [{ entity: R.category, sibling: true }] : [])]
      .filter((x) => !ring1.some((r) => r.entity === x.entity) && x.entity !== R.center);
    const maxScore = Math.max(...ring1.map((r) => r.score), 0.01);
    [...ring1, ...extra].forEach((r) => {
      const strength = r.sibling ? 0.25 : r.score / maxScore;
      node('e:' + r.entity.idx, { kind: r.entity.kind, entity: r.entity, label: display(r.entity), ring: 1, target: R1 * (1.25 - 0.4 * strength), from: centerId, r: 7 + Math.min(10, Math.log2(1 + r.entity.docs.size) * 1.5) });
      edge(centerId, 'e:' + r.entity.idx, r.sibling ? 0.5 : 1 + 3 * strength, r.sibling ? 'sibling' : 'center', R1 * (1.3 - 0.45 * strength), r.sibling ? 0.03 : 0.05 + 0.05 * strength);
    });
    for (const x of R.second.slice(0, ring2Max)) {
      const via = byId.get('e:' + x.via.idx); if (!via || byId.has('e:' + x.entity.idx)) continue;
      node('e:' + x.entity.idx, { kind: x.entity.kind, entity: x.entity, label: display(x.entity), ring: 2, target: R2, from: via.id, r: 5 + Math.min(6, Math.log2(1 + x.entity.docs.size)) });
      edge(via.id, 'e:' + x.entity.idx, 0.8, 'hop', 85 * s, 0.07);
    }
    // Links between first-ring entities that are related to each other give the net its mesh.
    const ents = nodes.filter((n) => n.entity && n.ring === 1);
    for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
      const w = NET.relation(ents[i].entity, ents[j].entity);
      if (w > (R.mode === 'overview' ? 0.04 : 0.12) && !NET.twins(ents[i].entity, ents[j].entity)) edge(ents[i].id, ents[j].id, w * 3, 'mesh', 140 * s, 0.015);
    }
    // Entries: the best direct hits, then further reading.
    const docsShown = [...NET.dedupe(R.primary).slice(0, R.mode === 'overview' ? 0 : docMax).map((x) => ({ ...x, primary: true })), ...NET.dedupe(R.extended).slice(0, extMax).map((x) => ({ ...x, primary: false }))];
    const entityNodes = nodes.filter((n) => n.entity && !n.center);
    for (const x of docsShown) {
      const id = 'd:' + x.doc.i; if (byId.has(id) || x.doc === R.center?.item) continue;   // the centre's own catalogue page is the centre
      const linked = entityNodes.filter((n) => x.doc.ents.has(n.entity.idx));
      node(id, { kind: 'doc', doc: x.doc, label: x.doc.title, ring: 3, target: RD, from: linked[0]?.id || centerId, r: 4, color: sourceOf(x.doc.source).color, primary: x.primary });
      if (x.primary) edge(centerId, id, 0.6, 'doc', RD * 0.85, 0.02);
      for (const n of linked.slice(0, 3)) edge(n.id, id, 0.5, 'doc', 70 * s, 0.05);
    }
    // Sources of the entries shown.
    const srcCount = new Map();
    for (const n of nodes) if (n.doc) for (const sid of n.doc.sources) srcCount.set(sid, (srcCount.get(sid) || 0) + 1);
    if (R.mode === 'overview') for (const src of NET.sources) srcCount.set(src.id, NET.docs.filter((d) => d.sources.includes(src.id)).length);
    for (const [sid] of [...srcCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, narrow ? 5 : 10)) {
      if (R.mode === 'source' && sid === R.source.id) continue;
      const src = sourceOf(sid), id = 's:' + sid;
      const docNodes = nodes.filter((n) => n.doc && n.doc.sources.includes(sid));
      node(id, { kind: 'source', source: src, label: tr(src.name), ring: 4, target: RS, from: docNodes[0]?.id || centerId, r: 8, color: src.color });
      for (const n of docNodes) edge(n.id, id, 0.3, 'source', 80 * s, 0.03);
      if (R.mode === 'overview') {
        edge(centerId, id, 0.6, 'source', RS, 0.02);
        // In the overview each source also ties to the programs and concepts it covers most.
        for (const n of entityNodes.filter((m) => m.ring === 1)) {
          let hits = 0; for (const [i] of n.entity.docs) if (NET.docs[i].sources.includes(sid)) hits++;
          if (hits >= Math.max(3, n.entity.docs.size * 0.4)) edge(n.id, id, 0.5, 'source', 150 * s, 0.02);
        }
      }
    }
    // Nodes that are not part of the new view fade out where they are.
    const stay = new Set(nodes.map((n) => n.id));
    ghosts = ghosts.concat(before.filter((n) => !stay.has(n.id)).map((n) => ({ ...n, fade: n.appear }))).slice(-80);
    for (const n of nodes) n.deg = edges.filter((e) => e.a === n.id || e.b === n.id).length;
    alpha = 1; alphaTarget = 0; fitPending = true;
    if (REDUCED) { for (let i = 0; i < 320; i++) tick(); alpha = 0; ghosts = []; for (const n of nodes) n.appear = 1; fitView(true); }
  }

  function tick() {
    // Every force shares one floor, so the net keeps its shape at rest and still answers a drag.
    const s = scale(), a = Math.max(alpha, 0.05), hold = a;
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const p = nodes[i], q = nodes[j];
      let dx = p.x - q.x, dy = p.y - q.y, d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 0.5; }
      const d = Math.sqrt(d2);
      let f = 210 * s * s * a * ((p.kind === 'doc' ? 0.35 : 1) + (q.kind === 'doc' ? 0.35 : 1)) / d2;
      const min = p.r + q.r + (p.kind === 'doc' && q.kind === 'doc' ? 5 : 18) * s;
      if (d < min) f += (min - d) * 0.35 / d;
      p.vx += dx * f; p.vy += dy * f; q.vx -= dx * f; q.vy -= dy * f;
    }
    for (const e of edges) {
      const p = byId.get(e.a), q = byId.get(e.b);
      const dx = q.x - p.x, dy = q.y - p.y, d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - e.len) * e.k * hold / d;
      const wp = q.deg / (p.deg + q.deg || 1), wq = 1 - wp;
      p.vx += dx * f * wp * 2; p.vy += dy * f * wp * 2; q.vx -= dx * f * wq * 2; q.vy -= dy * f * wq * 2;
    }
    for (const n of nodes) {
      if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = n.vy = 0; continue; }
      const g = n.center ? 0.08 : n.ring >= 3 ? 0.012 : 0.007;
      n.vx -= n.x * g * hold; n.vy -= n.y * g * hold;
      if (n.target) { const d = Math.max(1, Math.hypot(n.x, n.y)), pull = (d - n.target) * 0.02 * hold / d; n.vx -= n.x * pull; n.vy -= n.y * pull; }
      if (!REDUCED) { n.vx += Math.cos(clock * 0.7 + n.phase) * 0.018; n.vy += Math.sin(clock * 0.55 + n.phase * 1.7) * 0.018; }
      n.vx *= 0.6; n.vy *= 0.6;
      n.x += Math.max(-24, Math.min(24, n.vx)); n.y += Math.max(-24, Math.min(24, n.vy));
    }
    alpha += (alphaTarget - alpha) * 0.0228;
  }

  /* Camera: eased moves toward a goal; fit puts every node in view. */
  function fitView(now = false) {
    const c = $('graph'), W = c.clientWidth || 900, H = c.clientHeight || 680;
    if (!nodes.length) return;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
    for (const n of nodes) { x0 = Math.min(x0, n.x - n.r - 50); x1 = Math.max(x1, n.x + n.r + 50); y0 = Math.min(y0, n.y - n.r - 12); y1 = Math.max(y1, n.y + n.r + 28); }
    const k = Math.max(NARROW() ? 0.38 : 0.6, Math.min(1.25, Math.min(W / (x1 - x0), H / (y1 - y0))));
    goal = { k, x: -(x0 + x1) / 2 * k, y: -(y0 + y1) / 2 * k };
    if (now || REDUCED) { view = goal; goal = null; }
  }
  function zoomAt(sx, sy, factor) {
    const c = $('graph'), base = goal || view;
    const wx = (sx - c.clientWidth / 2 - base.x) / base.k, wy = (sy - c.clientHeight / 2 - base.y) / base.k;
    const k = Math.max(0.35, Math.min(3.2, base.k * factor));
    goal = { k, x: sx - c.clientWidth / 2 - wx * k, y: sy - c.clientHeight / 2 - wy * k };
    if (REDUCED) { view = goal; goal = null; }
  }

  /* ---------- drawing ---------- */
  const THEME = {};
  function readTheme() {
    const css = getComputedStyle(document.documentElement), v = (n, d) => css.getPropertyValue(n).trim() || d;
    Object.assign(THEME, { edge: v('--graph-edge', 'rgba(60,90,70,.18)'), hot: v('--accent-2', '#4b704f'), gold: v('--gold', '#a67d42'), label: v('--ink', '#1c3a2f'), halo: v('--paper', '#f6f5ee'), ring: v('--surface', '#fdfcf8'), muted: v('--muted', '#6b7a70') });
  }
  readTheme();
  document.addEventListener('chemhub:theme', () => { readTheme(); draw(); });
  const ease = (t) => 1 - Math.pow(1 - Math.min(1, Math.max(0, t)), 3);
  const clamp01 = (t) => Math.min(1, Math.max(0, t));
  const fillOf = (n) => n.center && n.kind !== 'source' ? '#c4923f' : n.color || KIND_COLOR[n.kind] || '#7d8a80';

  function draw() {
    const c = $('graph'), ctx = c.getContext('2d'), W = c.clientWidth, H = c.clientHeight;
    if (!W) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2 + view.x, H / 2 + view.y); ctx.scale(view.k, view.k);
    const focus = drag || hover;
    const near = new Set(); if (focus) { near.add(focus.id); for (const e of edges) { if (e.a === focus.id) near.add(e.b); if (e.b === focus.id) near.add(e.a); } }
    for (const n of nodes) {
      n.appear += (1 - n.appear) * 0.09;
      n.hl += ((focus ? (near.has(n.id) ? 1 : 0.13) : 1) - n.hl) * 0.16;
      n.grow += ((n === focus ? 1 : 0) - n.grow) * 0.2;
    }
    // Fading nodes from the previous view.
    ghosts = ghosts.filter((g) => (g.fade -= 0.05) > 0);
    for (const g of ghosts) { ctx.globalAlpha = g.fade * 0.6; ctx.beginPath(); ctx.arc(g.x, g.y, g.r * g.fade, 0, Math.PI * 2); ctx.fillStyle = fillOf(g); ctx.fill(); }
    // Links, with light flowing along the ones that touch the focused node (or out of the centre at rest).
    for (const e of edges) {
      const p = byId.get(e.a), q = byId.get(e.b);
      const hot = focus && (e.a === focus.id || e.b === focus.id);
      const vis = Math.min(p.hl, q.hl) * Math.min(p.appear, q.appear);
      ctx.globalAlpha = vis * (hot ? 0.95 : e.kind === 'source' ? 0.4 : e.kind === 'center' ? 0.75 : 0.6);
      ctx.strokeStyle = hot ? THEME.hot : e.kind === 'center' ? THEME.hot : THEME.edge;
      ctx.lineWidth = (hot ? 1.6 : 0.7) * Math.max(0.6, Math.min(3.5, e.w)) / Math.sqrt(view.k);
      ctx.setLineDash(e.kind === 'sibling' ? [5, 5] : e.kind === 'source' ? [2, 4] : []);
      ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(q.x, q.y); ctx.stroke();
      if (!REDUCED && (hot || (!focus && e.kind === 'center'))) {
        const out = hot ? (e.a === focus.id ? [p, q] : [q, p]) : [p, q];
        const speed = hot ? 0.55 : 0.18, dots = hot ? 2 : 1;
        ctx.fillStyle = hot ? THEME.hot : THEME.gold;
        for (let k = 0; k < dots; k++) {
          const t = (clock * speed + e.phase + k / dots) % 1;
          ctx.globalAlpha = vis * (hot ? 0.9 : 0.55) * Math.sin(t * Math.PI);
          ctx.beginPath(); ctx.arc(out[0].x + (out[1].x - out[0].x) * t, out[0].y + (out[1].y - out[0].y) * t, (hot ? 2.2 : 1.6) / Math.sqrt(view.k), 0, Math.PI * 2); ctx.fill();
        }
      }
    }
    ctx.setLineDash([]);
    for (const n of nodes) {
      const a = n.hl * ease(n.appear);
      const r = n.r * (0.35 + 0.65 * ease(n.appear)) * (1 + 0.22 * n.grow);
      const fill = fillOf(n);
      if (n.center) {
        const pulse = REDUCED ? 0 : Math.sin(clock * 1.6) * 0.5 + 0.5;
        ctx.globalAlpha = a * (0.1 + 0.12 * pulse); ctx.beginPath(); ctx.arc(n.x, n.y, r + 8 + 5 * pulse, 0, Math.PI * 2); ctx.fillStyle = THEME.gold; ctx.fill();
      }
      ctx.globalAlpha = a;
      if (n.grow > 0.02 || n.center) { ctx.shadowColor = fill; ctx.shadowBlur = (n.center ? 16 : 0) + 18 * n.grow; }
      ctx.beginPath(); ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      if (n.kind === 'doc' && !n.primary) { ctx.fillStyle = THEME.ring; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = n.color; ctx.lineWidth = 1.8; ctx.stroke(); }
      else { ctx.fillStyle = fill; ctx.fill(); ctx.shadowBlur = 0; ctx.strokeStyle = n === focus ? THEME.label : THEME.ring; ctx.lineWidth = n.center ? 2.5 : 1.3; ctx.stroke(); }
      // Labels fade in with zoom for the outer nodes; the focused node and its neighbours always show theirs.
      const zoomVis = n.center || n.ring === 1 || n.kind === 'source' ? 1 : n.ring === 2 ? clamp01((view.k - 0.7) / 0.35) : clamp01((view.k - 1.5) / 0.4);
      const la = a * Math.max(zoomVis, focus && near.has(n.id) && (n.kind !== 'doc' || n === focus) ? 1 : 0);
      if (la < 0.04) continue;
      const max = n.kind === 'doc' ? (n === focus ? 30 : 18) : n.center ? (EN ? 28 : 22) : (EN ? 18 : 14);
      const text = n.label.length > max ? n.label.slice(0, max - 1) + '…' : n.label;
      ctx.globalAlpha = la;
      const px = (v) => (v / Math.min(1, Math.sqrt(view.k))).toFixed(1) + 'px';   // labels stay legible when zoomed out
      ctx.font = (n.center ? '700 ' + px(15) : n === focus ? '700 ' + px(13) : n.kind === 'source' ? '600 ' + px(11.5) : n.ring === 2 ? px(11) : '600 ' + px(12)) + " 'Segoe UI','Microsoft YaHei',sans-serif";
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = THEME.halo;
      const y = n.y + r + (n.center ? 18 : 13) / Math.min(1, Math.sqrt(view.k));
      ctx.strokeText(text, n.x, y); ctx.fillStyle = n.kind === 'source' ? THEME.muted : THEME.label; ctx.fillText(text, n.x, y);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function loop(t) {
    const dt = last ? Math.min(0.05, (t - last) / 1000) : 0.016; last = t; clock += dt;
    if (!REDUCED || drag || alpha > 0.002) tick();
    if (goal) {
      const f = 0.14;
      view = { x: view.x + (goal.x - view.x) * f, y: view.y + (goal.y - view.y) * f, k: view.k + (goal.k - view.k) * f };
      if (Math.abs(goal.x - view.x) + Math.abs(goal.y - view.y) < 0.5 && Math.abs(goal.k - view.k) < 0.002) { view = goal; goal = null; }
    }
    if (inertia && !pan) { view.x += inertia.x; view.y += inertia.y; inertia.x *= 0.92; inertia.y *= 0.92; if (Math.abs(inertia.x) + Math.abs(inertia.y) < 0.1) inertia = null; }
    if (fitPending && alpha < 0.35) { fitPending = false; fitView(); }
    draw(); requestAnimationFrame(loop);
  }

  /* ---------- graph interaction ---------- */
  function toWorld(ev) {
    const c = $('graph'), r = c.getBoundingClientRect();
    const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
    return { x: (sx - c.clientWidth / 2 - view.x) / view.k, y: (sy - c.clientHeight / 2 - view.y) / view.k, sx, sy };
  }
  function pick(p) {
    let best = null, bd = Infinity;
    for (const n of nodes) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < n.r * (1 + 0.22 * n.grow) + 7 / view.k && d < bd) { bd = d; best = n; } }
    return best;
  }
  function tooltip(n, p) {
    const tip = $('tooltip'), c = $('graph');
    if (!n) { tip.hidden = true; return; }
    let html;
    if (n.doc) {
      const src = n.doc.sources.map((x) => sourceOf(x).name).join(' · ');
      html = `<b class="tip-title">${esc(n.doc.title)}</b><span class="tip-meta"><span>${esc(src)}</span> · <span>${esc(TYPE_LABEL[n.doc.type] || n.doc.type)}</span></span><span class="tip-hint">${n.primary ? '单击：在右侧列表中定位' : '关联延伸 · 单击定位'}</span>`;
    } else if (n.entity) {
      const e = n.entity;
      html = `<b>${esc(display(e))}</b><span class="tip-meta"><span>${esc(KIND_LABEL[e.kind])}</span> · <span>${e.docs.size} 条相关条目</span></span>${e.desc ? `<span class="tip-desc">${esc(e.desc.slice(0, 90))}</span>` : ''}<span class="tip-hint">${n.center ? '当前中心' : '单击：以它为中心'}</span>`;
    } else if (n.source) {
      html = `<b>${esc(n.source.name)}</b><span class="tip-meta"><span>来源</span> · <span>${esc(n.source.role || '')}</span></span><span class="tip-hint">${n.center ? '当前中心' : '单击：看这个来源的全部条目'}</span>`;
    } else html = `<b>${esc(n.label)}</b><span class="tip-hint">${n.kind === 'hub' ? '全网概览' : '全文检索的关键词'}</span>`;
    tip.innerHTML = html; tip.hidden = false;
    tip.style.left = Math.max(8, Math.min(c.clientWidth - tip.offsetWidth - 8, p.sx + 14)) + 'px';
    tip.style.top = Math.min(c.clientHeight - tip.offsetHeight - 8, p.sy + 14) + 'px';
  }
  function activate(n) {
    if (!n || n.center) return;
    if (n.entity) navigate({ q: n.entity.name });
    else if (n.source) navigate({ src: n.source.id });
    else if (n.doc) locate(n.doc);
  }
  function bindGraph() {
    const c = $('graph');
    c.addEventListener('pointerdown', (ev) => {
      pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      c.setPointerCapture(ev.pointerId);
      if (pointers.size === 2) {
        const [a, b] = [...pointers.values()];
        pinch = { d: Math.hypot(a.x - b.x, a.y - b.y), k: view.k };
        if (drag) { drag.fx = drag.fy = null; drag = null; } pan = null; return;
      }
      moved = false; inertia = null; const p = toWorld(ev), n = pick(p);
      if (n) { drag = n; n.fx = n.x; n.fy = n.y; n.grab = { x: p.x - n.x, y: p.y - n.y }; alphaTarget = 0.3; }
      else pan = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y, t: performance.now(), lx: ev.clientX, ly: ev.clientY };
    });
    c.addEventListener('pointermove', (ev) => {
      if (pointers.has(ev.pointerId)) pointers.set(ev.pointerId, { x: ev.clientX, y: ev.clientY });
      if (pinch && pointers.size === 2) {
        const [a, b] = [...pointers.values()], r = c.getBoundingClientRect();
        const d = Math.hypot(a.x - b.x, a.y - b.y);
        zoomAt((a.x + b.x) / 2 - r.left, (a.y + b.y) / 2 - r.top, (pinch.k * d / pinch.d) / (goal || view).k);
        return;
      }
      const p = toWorld(ev);
      if (drag) {
        if (Math.hypot(p.x - drag.grab.x - drag.fx, p.y - drag.grab.y - drag.fy) > 3 / view.k) moved = true;
        if (moved) { drag.fx = p.x - drag.grab.x; drag.fy = p.y - drag.grab.y; }
        return;
      }
      if (pan) {
        moved = true; goal = null;
        view.x = pan.vx + ev.clientX - pan.x; view.y = pan.vy + ev.clientY - pan.y;
        pan.dx = ev.clientX - pan.lx; pan.dy = ev.clientY - pan.ly; pan.lx = ev.clientX; pan.ly = ev.clientY;
        return;
      }
      const n = pick(p); hover = n;
      c.style.cursor = n ? 'pointer' : 'grab'; tooltip(n, p);
    });
    const up = (ev) => {
      pointers.delete(ev.pointerId);
      if (pinch) { if (pointers.size < 2) pinch = null; return; }
      if (drag) {
        const n = drag; drag = null; alphaTarget = 0;
        n.fx = n.fy = null;          // let it go: it springs back into the net like in Obsidian
        if (!moved) activate(n);
      }
      if (pan && moved && (pan.dx || pan.dy)) inertia = { x: pan.dx || 0, y: pan.dy || 0 };
      pan = null;
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { if (!drag) hover = null; tooltip(null); });
    c.addEventListener('dblclick', (ev) => { if (!pick(toWorld(ev))) fitView(); });
    c.addEventListener('wheel', (ev) => {
      ev.preventDefault(); const p = toWorld(ev);
      zoomAt(p.sx, p.sy, Math.exp(-Math.max(-60, Math.min(60, ev.deltaY)) * 0.0045));
    }, { passive: false });
    window.addEventListener('resize', () => { if (R) fitView(); });
  }

  /* ---------- results ---------- */
  function highlighter() {
    const words = new Set();
    if (R.mode === 'entity') for (const a of R.center.aliases) if (a.length >= 2) words.add(a);
    if (R.q) for (const t of R.q.toLowerCase().split(/\s+/)) if (t.length >= 2) { words.add(t); for (const g of window.MolAstriaTerms?.groups || []) if (g.includes(t)) g.forEach((x) => x.length >= 2 && words.add(x)); }
    const list = [...words].sort((a, b) => b.length - a.length).map((w) => w.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'));
    if (!list.length) return esc;
    const re = new RegExp(`(${list.join('|')})`, 'gi');
    return (text) => String(text ?? '').split(re).map((part, i) => i % 2 ? `<mark>${esc(part)}</mark>` : esc(part)).join('');
  }
  function entityChip(e, extra = '') { return `<button class="net-chip k-${e.kind}" type="button" data-q="${esc(e.name)}"${extra}>${esc(display(e))}<small>${e.docs.size}</small></button>`; }
  function card(x, mark) {
    const d = x.doc, all = [d, ...(x.also || [])];
    const sources = [...new Set(all.flatMap((y) => y.sources))].map((sid) => sourceOf(sid));
    const badges = sources.map((s) => `<span class="src-badge" style="--sc:${esc(s.color)}">${esc(s.name)}</span>`).join('');
    const ents = [...d.ents.entries()].filter(([k]) => k !== R.center?.idx).sort((a, b) => b[1] - a[1]).map(([k]) => NET.entities.find((e) => e.idx === k)).filter((e) => e && !e.broad).slice(0, 4);
    const meta = [d.date, d.metric, d.authors ? '✎ ' + d.authors : ''].filter(Boolean).map(esc).join(' · ');
    const excerpt = d.excerpt && !/^该文在计算化学公社的讨论帖|^X-MOL /.test(d.excerpt) ? d.excerpt : '';
    const mirrors = x.also?.length ? `<span class="mirror">${x.also.map((y) => `<a href="${esc(y.url)}" target="_blank" rel="noopener">${esc(sourceOf(y.source).name)}</a>`).join(' · ')}</span>` : '';
    return `<article class="net-item" id="doc-${d.i}"><div class="card-top">${badges}<span class="type-badge">${esc(TYPE_LABEL[d.type] || d.type)}</span></div>` +
      `<h4><a href="${esc(d.url)}" target="${d.type === 'handbook' ? '_self' : '_blank'}" rel="noopener">${mark(d.title)}</a></h4>` +
      (excerpt ? `<p>${mark(excerpt.slice(0, 220))}</p>` : '') +
      (ents.length ? `<div class="net-item-ents">${ents.map((e) => entityChip(e)).join('')}</div>` : '') +
      `<div class="card-foot"><span>${meta}</span>${mirrors}<a class="open-btn" href="${esc(d.url)}" target="${d.type === 'handbook' ? '_self' : '_blank'}" rel="noopener">${d.type === 'handbook' ? '阅读 <i class="ico-ext ico-right" aria-hidden="true"></i>' : '原文 <i class="ico-ext" aria-hidden="true"></i>'}</a></div></article>`;
  }
  function renderFocus() {
    const f = $('netFocus');
    const primary = NET.dedupe(R.primary);
    const srcN = new Set(R.primary.flatMap((x) => x.doc.sources)).size;
    if (R.mode === 'entity') {
      const e = R.center;
      f.innerHTML = `<div class="focus-kind k-${e.kind}">${esc(KIND_LABEL[e.kind])}</div><h2 id="resultTitle">${esc(display(e))}</h2>` +
        (R.corrected ? `<p class="focus-note">${esc(`按「${display(e)}」查询，你输入的是「${R.q}」。`)}</p>` : '') +
        (e.desc ? `<p class="focus-desc">${esc(e.desc)}</p>` : '') +
        `<div class="focus-stats"><span>${primary.length} 条直接相关</span><span>${R.related.length} 个关联概念</span><span>${srcN} 个来源</span></div>` +
        (e.url ? `<a class="btn primary focus-link" href="${esc(e.url)}" target="_blank" rel="noopener">访问官网 <i class="ico-ext" aria-hidden="true"></i></a>` : '');
    } else if (R.mode === 'text') {
      f.innerHTML = `<div class="focus-kind k-query">全文检索</div><h2 id="resultTitle">「${esc(R.q)}」</h2>` +
        `<div class="focus-stats"><span>${primary.length} 条命中</span><span>${R.related.length} 个关联概念</span></div>` +
        (R.suggestions?.length ? `<p class="focus-note">没有找到。你是不是要找：${R.suggestions.map((s) => entityChip(s.entity)).join('')}</p>` : '') +
        (missed(R.q) ? `<p class="focus-note net-miss-note">术语表里还没有这个词。<a href="#misses">已记进这台设备上的“没找到的词”</a>${reported.has(MISSES.keyOf(R.q)) ? '，这个词也匿名报给了站长。' : ''}</p>` : '');
    } else if (R.mode === 'source') {
      f.innerHTML = `<div class="focus-kind k-source">来源</div><h2 id="resultTitle">${esc(R.source.name)}</h2><p class="focus-desc">${esc(R.source.role || '')}</p>` +
        `<div class="focus-stats"><span>${primary.length} 条条目</span><span>${R.related.length} 个常见概念</span></div>` +
        (R.source.url ? `<a class="btn primary focus-link" href="${esc(R.source.url)}" target="_blank" rel="noopener">访问原站 <i class="ico-ext" aria-hidden="true"></i></a>` : '');
    } else {
      f.innerHTML = `<div class="focus-kind k-hub">全网概览</div><h2 id="resultTitle">从任意一个词开始</h2>` +
        `<p class="focus-desc">图里是条目最多的软件、方法与概念。点一个节点，或在上方搜索，网就以它为中心展开。</p>`;
    }
  }
  function renderRelated() {
    const box = $('netRelated');
    const near = R.related.slice(0, 14);
    const sib = (R.siblings || []).filter((e) => !near.some((r) => r.entity === e));
    box.innerHTML = (near.length ? `<h3>${R.mode === 'overview' ? '常见节点' : '关系最紧'}</h3><div class="chip-row">${near.map((r) => entityChip(r.entity)).join('')}</div>` : '') +
      (sib.length ? `<h3>同类</h3><div class="chip-row">${sib.map((e) => entityChip(e)).join('')}</div>` : '');
  }
  function renderResults() {
    const mark = highlighter();
    let list = NET.dedupe(R.primary);
    const bySource = new Map(), byType = new Map();
    for (const x of list) { for (const sid of new Set([x.doc, ...x.also].flatMap((y) => y.sources))) bySource.set(sid, (bySource.get(sid) || 0) + 1); byType.set(x.doc.type, (byType.get(x.doc.type) || 0) + 1); }
    $('breakdown').innerHTML = [...bySource.entries()].sort((a, b) => b[1] - a[1]).map(([sid, n]) => {
      const s = sourceOf(sid);
      return `<button type="button" class="bd${sourceFilter === sid ? ' on' : ''}" data-src-filter="${esc(sid)}" aria-pressed="${sourceFilter === sid}"><i style="background:${esc(s.color)}"></i>${esc(s.name)} <b>${n}</b></button>`;
    }).join('');
    $('typeLine').hidden = byType.size < 2;
    $('typeChips').innerHTML = byType.size > 1 ? [...byType.entries()].sort((a, b) => b[1] - a[1]).map(([t, n]) =>
      `<button type="button" class="bd${typeFilter === t ? ' on' : ''}" data-type-filter="${esc(t)}" aria-pressed="${typeFilter === t}">${esc(TYPE_LABEL[t] || t)} <b>${n}</b></button>`).join('') : '';
    if (sourceFilter) list = list.filter((x) => [x.doc, ...x.also].some((y) => y.sources.includes(sourceFilter)));
    if (typeFilter) list = list.filter((x) => x.doc.type === typeFilter);
    const part = list.slice(0, shown);
    let html = part.map((x) => card(x, mark)).join('');
    if (!list.length) html = '<div class="empty">没有命中条目。换个说法，或点上方的关联概念试试。</div>';
    const ext = NET.dedupe(R.extended);
    if (ext.length && !sourceFilter && !typeFilter && list.length <= shown) {
      const names = R.related.slice(0, 3).map((r) => display(r.entity)).join('、');
      html += `<h3 class="net-further">关联延伸<small>讲${esc(names)}等相关内容的条目</small></h3>` + ext.map((x) => card(x, esc)).join('');
    }
    $('netResults').innerHTML = html;
    $('netMore').style.display = list.length > shown ? '' : 'none';
    $('netMsg').textContent = `共 ${list.length} 条 · 已显示 ${Math.min(shown, list.length)} 条`;
  }
  function locate(doc) {
    const list = NET.dedupe(R.primary).concat(NET.dedupe(R.extended));
    const k = list.findIndex((x) => x.doc === doc || x.also.includes(doc));
    if (k >= shown && k < R.primary.length) { shown = k + 10; renderResults(); }
    const el = $('doc-' + (list[k]?.doc.i ?? doc.i));
    if (!el) return;
    el.scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'center' });
    el.classList.remove('flash'); void el.offsetWidth; el.classList.add('flash');
  }
  function renderTrail() {
    $('netTrail').innerHTML = trail.length > 1 ? '<span class="muted small">路径：</span>' + trail.map((t, i) =>
      i === trail.length - 1 ? `<b>${esc(t.label)}</b>` : `<button type="button" data-trail="${i}">${esc(t.label)}</button><span aria-hidden="true">›</span>`).join('') : '';
  }

  /* ---------- words the term table did not know (net-misses.js) ----------
     The list stays on this device. The first time a word is kept, the word alone (and its full-text hit count) is also reported
     to the account service once, so the site owner sees which words people miss across the site (deploy/account-worker.js,
     POST /net/miss; it keeps no IP or account). No sign-in token and no other searches go with it; "匿名报给站长" turns it off. */
  const MISSES = window.MolAstriaNetMisses;
  function loadMisses() { try { return MISSES.parse(localStorage.getItem(MISSES.KEY)); } catch { return MISSES ? MISSES.parse(null) : null; } }
  function saveMisses(s) { try { if (s.off || !s.share || s.items.length) localStorage.setItem(MISSES.KEY, JSON.stringify(s)); else localStorage.removeItem(MISSES.KEY); } catch { /* storage blocked */ } renderMisses(); }
  function reportMiss(word) {
    const base = String(window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
    if (!base || location.protocol === 'file:') return false;   // the single-file copy has no site origin the service accepts
    // read the (tiny) body: an unread response keeps the request open in Chromium, which holds the connection and stalls "network idle"
    fetch(`${base}/net/miss`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(word), credentials: 'omit' })
      .then((r) => r.text()).catch(() => {});
    return true;
  }
  const missed = (q) => !!MISSES && loadMisses().items.some((x) => MISSES.keyOf(x.q) === MISSES.keyOf(q));
  function noteMiss() {
    if (!MISSES || !recordNext || state.src) return;
    const key = MISSES.keyOf(state.q);
    if (counted.has(key) || !MISSES.missOf(R)) return;
    counted.add(key);
    const before = loadMisses();
    const word = MISSES.reportOf(before, state.q, R);
    saveMisses(MISSES.record(before, state.q, R));
    if (word && reportMiss(word)) reported.add(key);
  }
  function renderMisses() {
    if (!MISSES || !$('missList')) return;
    const s = loadMisses(), list = MISSES.ranked(s);
    $('missOn').checked = !s.off;
    $('missShare').checked = !s.off && s.share;
    $('missShare').disabled = s.off;
    $('missActions').hidden = !list.length;
    $('missList').innerHTML = s.off ? '<p class="small muted">已关闭，不再记录；以前记下的也已清空。</p>'
      : !list.length ? '<p class="small muted">还没有记下的词。</p>'
      : `<ul>${list.map((x) => `<li><button type="button" class="net-miss-q" data-miss-q="${esc(x.q)}" translate="no">${esc(x.q)}</button><span class="small muted">${x.n} 次 · 全文 ${x.hits} 条</span><button type="button" class="net-miss-x" data-miss-x="${esc(x.q)}" aria-label="删除这个词">×</button></li>`).join('')}</ul>`;
    if (list.length) {
      const opts = EN ? { title: 'Network query: words the term table does not know', intro: 'The network query did not recognise these words (full-text search only); suggested additions to the term table search-terms.js:', line: (x) => `- ${x.q} (${x.n}×, ${x.hits} full-text hits)` } : {};
      const iss = MISSES.issueUrl(s, opts);
      $('missIssue').href = iss.url;
      $('missIssue').title = iss.included < iss.total ? `地址太长，只放了查得最多的 ${iss.included} 个词` : '';
    }
  }
  function bindMisses() {
    if (!MISSES || !$('missList')) return;
    $('missOn').addEventListener('change', (ev) => { saveMisses(MISSES.setOff(loadMisses(), !ev.target.checked)); $('missMsg').textContent = ev.target.checked ? '已开启记录。' : '已关闭并清空。'; if (R) renderFocus(); });
    $('missShare').addEventListener('change', (ev) => { saveMisses(MISSES.setShare(loadMisses(), ev.target.checked)); $('missMsg').textContent = ev.target.checked ? '以后新记下的词会匿名报给站长。' : '不再报给站长，词只留在这台设备上。'; });
    $('missClear').addEventListener('click', () => { saveMisses(MISSES.clear(loadMisses())); $('missMsg').textContent = '已清空。'; });
    $('missCopy').addEventListener('click', async () => {
      const text = MISSES.toText(loadMisses(), EN ? { times: 'times', hits: 'full-text hits' } : undefined);
      try { await navigator.clipboard.writeText(text); $('missMsg').textContent = '已复制到剪贴板。'; }
      catch { $('missMsg').textContent = '浏览器不让复制，请手动选中上面的词。'; }
    });
    $('missList').addEventListener('click', (ev) => {
      const x = ev.target.closest('[data-miss-x]');
      if (x) { saveMisses(MISSES.remove(loadMisses(), x.dataset.missX)); return; }
      const q = ev.target.closest('[data-miss-q]');
      if (q) { navigate({ q: q.dataset.missQ }); document.querySelector('.net-graph-panel').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); }
    });
    // Another tab of the site changed the list.
    window.addEventListener('storage', (ev) => { if (ev.key === MISSES.KEY) renderMisses(); });
    renderMisses();
  }

  /* ---------- navigation ---------- */
  function render() {
    R = state.src ? NET.source(state.src) : NET.query(state.q);
    noteMiss(); recordNext = false;
    sourceFilter = ''; typeFilter = ''; shown = 30;
    $('netQ').value = state.q || '';
    const label = R.mode === 'entity' ? display(R.center) : R.mode === 'source' ? R.source.name : R.mode === 'text' ? R.q : '';
    if (label && trail[trail.length - 1]?.label !== label) { trail.push({ label, q: state.q, src: state.src }); trail = trail.slice(-7); }
    if (!label) trail = [];
    $('graphTitle').textContent = R.mode === 'overview' ? '全网概览' : `以「${label}」为中心`;
    document.title = (label ? label + ' · ' : '') + '网状查询 · MolAstria';
    buildGraph(); renderFocus(); renderRelated(); renderResults(); renderTrail();
  }
  function navigate(next, push = true, typed = false) {
    state = { q: next.q || '', src: next.src || '' };
    recordNext = typed;
    if (push) {
      const u = new URL(location.href);
      u.searchParams.delete('q'); u.searchParams.delete('src'); u.searchParams.delete('select');
      if (state.q) u.searchParams.set('q', state.q); if (state.src) u.searchParams.set('src', state.src);
      history.pushState(state, '', u);
    }
    closeSuggest(); render();
    if (NARROW()) document.querySelector('.net-graph-panel').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth', block: 'start' });
  }
  window.addEventListener('popstate', () => { const p = new URLSearchParams(location.search); state = { q: p.get('q') || '', src: p.get('src') || '' }; render(); });

  /* ---------- search box with suggestions ---------- */
  let active = -1, items = [];
  function closeSuggest() { $('netSuggest').hidden = true; $('netQ').setAttribute('aria-expanded', 'false'); $('netQ').removeAttribute('aria-activedescendant'); active = -1; }
  function openSuggest() {
    const q = $('netQ').value.trim();
    if (!q) { closeSuggest(); return; }
    items = NET.suggest(q, 7).map((s) => ({ q: s.entity.name, label: display(s.entity), kind: KIND_LABEL[s.entity.kind], n: s.entity.docs.size, fuzzy: s.fuzzy }));
    items.push({ q, label: q, kind: '全文检索', n: null, text: true });
    $('netSuggest').innerHTML = items.map((it, i) => `<li id="sg-${i}" role="option" aria-selected="${i === active}" data-i="${i}"><span class="sg-label">${it.text ? `搜索「${esc(it.label)}」` : esc(it.label)}</span><span class="sg-kind">${esc(it.kind)}${it.n != null ? ` · ${it.n}` : ''}${it.fuzzy ? ' · 拼写相近' : ''}</span></li>`).join('');
    $('netSuggest').hidden = false; $('netQ').setAttribute('aria-expanded', 'true');
  }
  function move(d) {
    if ($('netSuggest').hidden) openSuggest();
    active = (active + d + items.length) % items.length;
    [...$('netSuggest').children].forEach((li, i) => li.setAttribute('aria-selected', String(i === active)));
    $('netQ').setAttribute('aria-activedescendant', 'sg-' + active);
  }
  function bindSearch() {
    const input = $('netQ');
    let t;
    input.addEventListener('input', () => { clearTimeout(t); active = -1; t = setTimeout(openSuggest, 60); });
    input.addEventListener('focus', () => { if (input.value.trim()) openSuggest(); });
    input.addEventListener('blur', () => setTimeout(closeSuggest, 150));
    input.addEventListener('keydown', (ev) => {
      if (ev.key === 'ArrowDown') { ev.preventDefault(); move(1); }
      else if (ev.key === 'ArrowUp') { ev.preventDefault(); move(-1); }
      else if (ev.key === 'Escape') closeSuggest();
      else if (ev.key === 'Enter') { ev.preventDefault(); const it = items[active]; navigate({ q: it ? it.q : input.value.trim() }, true, true); }
    });
    $('netSuggest').addEventListener('mousedown', (ev) => { const li = ev.target.closest('li'); if (li) { ev.preventDefault(); navigate({ q: items[Number(li.dataset.i)].q }, true, true); } });
    $('netGo').addEventListener('click', () => navigate({ q: input.value.trim() }, true, true));
    document.addEventListener('keydown', (ev) => { if (ev.key === '/' && !/input|textarea|select/i.test(document.activeElement?.tagName || '')) { ev.preventDefault(); input.focus(); } });
  }

  /* ---------- the rest of the page ---------- */
  function renderStats() {
    const pairs = new Map();
    for (const d of NET.docs) { const ks = [...d.ents.keys()]; for (let i = 0; i < ks.length; i++) for (let j = i + 1; j < ks.length; j++) { const k = ks[i] < ks[j] ? ks[i] + ':' + ks[j] : ks[j] + ':' + ks[i]; pairs.set(k, (pairs.get(k) || 0) + 1); } }
    const linked = [...pairs.values()].filter((n) => n >= 2).length;
    const stats = [[NET.docs.length.toLocaleString('en-US'), '条条目（含讲解手册）'], [NET.entities.length, '个软件、方法与概念节点'], [linked.toLocaleString('en-US'), '对有据可查的关联'], [NET.sources.length, '个来源']];
    $('netStats').innerHTML = stats.map(([v, l]) => `<div class="stat"><b>${esc(v)}</b><span>${esc(l)}</span></div>`).join('');
  }
  function renderDirectory() {
    const officials = NET.docs.filter((d) => d.official);
    const groups = new Map();
    for (const d of officials) { const c = d.category || '未分类'; if (!groups.has(c)) groups.set(c, []); groups.get(c).push(d); }
    $('dbDirectory').innerHTML = [...groups.entries()].map(([cat, list]) => `<div class="db-group"><h3>${esc(cat)}（${list.length}）</h3><div class="db-table">` +
      list.map((d) => `<div class="db-cell"><h4>${esc(d.title)}</h4><p>${esc(d.excerpt || d.metric || '')}</p><div class="db-actions"><button class="btn locate-btn" type="button" data-q="${esc(d.title)}">在网中查看</button><a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener">访问官网 <i class="ico-ext" aria-hidden="true"></i></a></div></div>`).join('') + '</div></div>').join('') +
      `<div class="db-group"><h3>数据源入口（${NET.sources.length} 个来源）</h3><div class="db-table">` + NET.sources.map((s) => {
        const n = NET.docs.filter((d) => d.sources.includes(s.id)).length;
        return `<div class="db-cell"><h4>${esc(s.name)}</h4><p><span>${esc(s.role || '')}</span> · <span>共 ${n} 条</span></p><div class="db-actions"><button class="btn locate-btn" type="button" data-src="${esc(s.id)}">在网中查看</button>${s.url ? `<a class="btn primary" href="${esc(s.url)}" target="_blank" rel="noopener">访问原站 <i class="ico-ext" aria-hidden="true"></i></a>` : ''}</div></div>`;
      }).join('') + '</div></div>';
  }
  document.addEventListener('click', (ev) => {
    const q = ev.target.closest('[data-q]');
    if (q) { navigate({ q: q.dataset.q }); if (q.classList.contains('locate-btn')) document.querySelector('.net-graph-panel').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); return; }
    const s = ev.target.closest('[data-src]');
    if (s) { navigate({ src: s.dataset.src }); document.querySelector('.net-graph-panel').scrollIntoView({ behavior: REDUCED ? 'auto' : 'smooth' }); return; }
    const sf = ev.target.closest('[data-src-filter]');
    if (sf) { sourceFilter = sourceFilter === sf.dataset.srcFilter ? '' : sf.dataset.srcFilter; shown = 30; renderResults(); return; }
    const tf = ev.target.closest('[data-type-filter]');
    if (tf) { typeFilter = typeFilter === tf.dataset.typeFilter ? '' : tf.dataset.typeFilter; shown = 30; renderResults(); return; }
    const tr = ev.target.closest('[data-trail]');
    if (tr) { const t = trail[Number(tr.dataset.trail)]; trail = trail.slice(0, Number(tr.dataset.trail)); navigate({ q: t.q, src: t.src }); }
  });

  function start() {
    const data = window.CHEMRESEARCH_DATA;
    if (!data || !Array.isArray(data.items)) throw new Error('缺少合并资源数据，请完整解压压缩包后打开');
    NET = window.MolAstriaNet.build(data, window.CHEMDB_CONTENT?.guides || [], window.MolAstriaTerms);
    // For the browser tests: the current result, the drawn nodes and where a node is on screen.
    window.MolAstriaNetView = { view: () => view, net: NET, current: () => R, nodes: () => nodes, settled: () => alpha < 0.03 && !goal && !fitPending,
      screenOf: (id) => { const n = byId.get(id), c = $('graph'), r = c.getBoundingClientRect(); return n && { x: r.left + c.clientWidth / 2 + view.x + n.x * view.k, y: r.top + c.clientHeight / 2 + view.y + n.y * view.k }; } };
    $('generatedAt').textContent = `数据生成：${new Date(data.generatedAt).toLocaleString('zh-CN')} · 每周四自动更新`;
    $('presetChips').innerHTML = PRESETS.map((p) => `<button class="chip preset" type="button" data-q="${esc(p)}">${esc(p)}</button>`).join('');
    $('netMore').addEventListener('click', () => { shown += 30; renderResults(); });
    $('relayoutBtn').addEventListener('click', () => { for (const n of nodes) if (!n.center) { const a = Math.random() * Math.PI * 2; n.fx = n.fy = null; n.x = Math.cos(a) * 40; n.y = Math.sin(a) * 40; } alpha = 1; fitPending = true; });
    $('fitBtn').addEventListener('click', () => fitView());
    $('netBack').addEventListener('click', () => history.back());
    renderStats(); renderDirectory(); bindGraph(); bindSearch(); bindMisses();
    // ?q= and ?src= links; the old ?select=tag:X / db:id / src:id links still work.
    const p = new URLSearchParams(location.search);
    const sel = p.get('select') || '';
    if (sel.startsWith('src:')) state.src = sel.slice(4);
    else if (sel.startsWith('db:')) state.q = NET.docs.find((d) => d.id === sel.slice(3))?.title || '';
    else if (/^(tag|cat):/.test(sel)) state.q = sel.slice(4);
    if (p.get('q')) state.q = p.get('q');
    if (p.get('src')) state.src = p.get('src');
    history.replaceState(state, '', location.href);
    recordNext = !!state.q && !state.src;    // a ?q= link carries a search someone typed (the home page passes its query on)
    render(); requestAnimationFrame(loop);
  }
  document.addEventListener('DOMContentLoaded', () => window.ChemI18n?.ready?.then(() => {
    if (!EN || !R) return;
    for (const n of nodes) n.label = n.entity ? display(n.entity) : n.source ? tr(n.source.name) : n.label;
    $('graphTitle').textContent = R.mode === 'overview' ? '全网概览' : `以「${R.mode === 'entity' ? display(R.center) : R.mode === 'source' ? R.source.name : R.q}」为中心`;
    renderFocus(); renderRelated(); renderResults(); draw();
  }));
  try { start(); } catch (e) {
    $('netFocus').textContent = '数据加载失败：' + e.message + '。请完整解压所有文件，再重新打开本页。';
    console.error(e);
  }
})();
