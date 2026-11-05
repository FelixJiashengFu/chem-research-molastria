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
  const display = (e) => EN && e.nameEn ? e.nameEn.replace(/^./, (c) => c.toUpperCase()) : tr(e.name);
  const sourceOf = (id) => NET.sourceById.get(id) || { id, name: id, color: '#7d8a80' };

  /* ---------- graph model ---------- */
  let nodes = [], edges = [], byId = new Map(), keep = new Map();
  let view = { x: 0, y: 0, k: 1 }, alpha = 0, hover = null, drag = null, pan = null, moved = false;

  function scale() { const c = $('graph'); return Math.max(0.42, Math.min(1.15, Math.min(c.clientWidth || 900, c.clientHeight || 680) / 2 / 400)); }
  function node(id, o) {
    const old = keep.get(id);
    const n = { id, x: old ? old.x : (o.ax ?? 0) + (Math.random() - 0.5) * 30, y: old ? old.y : (o.ay ?? 0) + (Math.random() - 0.5) * 30, vx: 0, vy: 0, ...o };
    nodes.push(n); byId.set(id, n); return n;
  }
  function edge(a, b, w, kind) { if (byId.has(a) && byId.has(b) && a !== b && !edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) edges.push({ a, b, w, kind }); }

  function buildGraph() {
    keep = new Map(nodes.map((n) => [n.id, n]));
    nodes = []; edges = []; byId = new Map();
    const s = scale(), narrow = NARROW();
    const R1 = 150 * s, RD = 245 * s, R2 = 300 * s, RS = 375 * s;
    const ring1Max = narrow ? 8 : 12, docMax = narrow ? 6 : 10, extMax = narrow ? 3 : 6, ring2Max = narrow ? 6 : 14;
    let centerId;
    if (R.mode === 'entity') { centerId = 'e:' + R.center.idx; node(centerId, { kind: R.center.kind, entity: R.center, label: display(R.center), center: true, r: 30, fx: 0, fy: 0 }); }
    else if (R.mode === 'source') { centerId = 's:' + R.source.id; node(centerId, { kind: 'source', source: R.source, label: tr(R.source.name), center: true, r: 30, fx: 0, fy: 0, color: R.source.color }); }
    else if (R.mode === 'text') { centerId = 'q'; node(centerId, { kind: 'query', label: R.q, center: true, r: 28, fx: 0, fy: 0 }); }
    else { centerId = 'hub'; node(centerId, { kind: 'hub', label: 'MolAstria', center: true, r: 30, fx: 0, fy: 0 }); }

    const ring1 = R.related.slice(0, ring1Max);
    const extra = [...(R.siblings || []).slice(0, 4).map((e) => ({ entity: e, sibling: true })), ...(R.category ? [{ entity: R.category, sibling: true }] : [])]
      .filter((x) => !ring1.some((r) => r.entity === x.entity) && x.entity !== R.center);
    const firstAll = [...ring1, ...extra];
    const maxScore = Math.max(...ring1.map((r) => r.score), 0.01);
    firstAll.forEach((r, i) => {
      const a = -Math.PI / 2 + (i / Math.max(1, firstAll.length)) * Math.PI * 2;
      const strength = r.sibling ? 0.3 : r.score / maxScore;
      node('e:' + r.entity.idx, { kind: r.entity.kind, entity: r.entity, label: display(r.entity), ring: 1, target: R1 * (1.25 - 0.4 * strength), angle: a, ax: Math.cos(a) * R1, ay: Math.sin(a) * R1, r: 9 + Math.min(10, Math.log2(1 + r.entity.docs.size) * 1.6) });
      edge(centerId, 'e:' + r.entity.idx, r.sibling ? 0.5 : 1 + 3 * strength, r.sibling ? 'sibling' : 'center');
    });
    for (const x of R.second.slice(0, ring2Max)) {
      const via = byId.get('e:' + x.via.idx); if (!via || byId.has('e:' + x.entity.idx)) continue;
      node('e:' + x.entity.idx, { kind: x.entity.kind, entity: x.entity, label: display(x.entity), ring: 2, target: R2, angle: via.angle, ax: via.x * 1.8, ay: via.y * 1.8, r: 7 + Math.min(6, Math.log2(1 + x.entity.docs.size)) });
      edge(via.id, 'e:' + x.entity.idx, 0.8, 'hop');
    }
    // Links between first-ring entities that are related to each other give the net its mesh.
    const ents = nodes.filter((n) => n.entity && n.ring === 1);
    for (let i = 0; i < ents.length; i++) for (let j = i + 1; j < ents.length; j++) {
      const w = NET.relation(ents[i].entity, ents[j].entity);
      if (w > 0.12 && !NET.twins(ents[i].entity, ents[j].entity)) edge(ents[i].id, ents[j].id, w * 3, 'mesh');
    }
    // Entries: the best direct hits, then further reading.
    const docsShown = [...NET.dedupe(R.primary).slice(0, R.mode === 'overview' ? 0 : docMax).map((x) => ({ ...x, primary: true })), ...NET.dedupe(R.extended).slice(0, extMax).map((x) => ({ ...x, primary: false }))];
    const entityNodes = nodes.filter((n) => n.entity);
    docsShown.forEach((x, i) => {
      const id = 'd:' + x.doc.i; if (byId.has(id)) return;
      const linked = entityNodes.filter((n) => x.doc.ents.has(n.entity.idx) && !n.center);
      const anchor = linked[0];
      const a = anchor ? anchor.angle : -Math.PI / 2 + (i / docsShown.length) * Math.PI * 2;
      node(id, { kind: 'doc', doc: x.doc, label: x.doc.title, ring: 3, target: RD, angle: a, ax: Math.cos(a) * RD, ay: Math.sin(a) * RD, r: 5, color: sourceOf(x.doc.source).color, primary: x.primary });
      if (x.primary) edge(centerId, id, 0.6, 'doc');
      for (const n of linked.slice(0, 3)) edge(n.id, id, 0.5, 'doc');
    });
    // Sources of the entries shown.
    const srcCount = new Map();
    for (const n of nodes) if (n.doc) for (const sid of n.doc.sources) srcCount.set(sid, (srcCount.get(sid) || 0) + 1);
    if (R.mode === 'overview') for (const src of NET.sources) srcCount.set(src.id, NET.docs.filter((d) => d.sources.includes(src.id)).length);
    [...srcCount.entries()].sort((a, b) => b[1] - a[1]).slice(0, narrow ? 5 : 10).forEach(([sid], i, arr) => {
      if (R.mode === 'source' && sid === R.source.id) return;
      const src = sourceOf(sid), id = 's:' + sid;
      const docNodes = nodes.filter((n) => n.doc && n.doc.sources.includes(sid));
      const a = docNodes.length ? Math.atan2(docNodes.reduce((t, n) => t + Math.sin(n.angle), 0), docNodes.reduce((t, n) => t + Math.cos(n.angle), 0)) : -Math.PI / 2 + (i / arr.length) * Math.PI * 2;
      node(id, { kind: 'source', source: src, label: tr(src.name), ring: 4, target: RS, angle: a, ax: Math.cos(a) * RS, ay: Math.sin(a) * RS, r: 9, color: src.color });
      for (const n of docNodes) edge(n.id, id, 0.3, 'source');
      if (R.mode === 'overview') edge(centerId, id, 0.6, 'source');
    });
    alpha = 1;
    if (REDUCED) { for (let i = 0; i < 260; i++) step(); alpha = 0; }
  }

  function step() {
    const s = scale();
    for (let i = 0; i < nodes.length; i++) for (let j = i + 1; j < nodes.length; j++) {
      const a = nodes[i], b = nodes[j];
      let dx = a.x - b.x, dy = a.y - b.y, d2 = dx * dx + dy * dy;
      if (d2 < 0.01) { dx = Math.random() - 0.5; dy = Math.random() - 0.5; d2 = 0.5; }
      const d = Math.sqrt(d2), min = a.r + b.r + (a.kind === 'doc' && b.kind === 'doc' ? 6 : 22) * s;
      let f = 900 * s * s * alpha / d2;
      if (d < min) f += (min - d) * 0.5;
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    for (const e of edges) {
      if (e.kind === 'center' || e.kind === 'doc' && e.a === nodes[0].id) continue;
      const a = byId.get(e.a), b = byId.get(e.b);
      const dx = b.x - a.x, dy = b.y - a.y, d = Math.max(1, Math.hypot(dx, dy));
      const f = (d - 70 * s) * 0.004 * alpha * Math.min(2, e.w);
      a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
    }
    for (const n of nodes) {
      if (n.fx != null) { n.x = n.fx; n.y = n.fy; n.vx = n.vy = 0; continue; }
      if (n.target) {
        const d = Math.max(1, Math.hypot(n.x, n.y)), pull = (d - n.target) * 0.06 * alpha;
        n.vx -= n.x / d * pull; n.vy -= n.y / d * pull;
      }
      n.vx *= 0.62; n.vy *= 0.62;
      n.x += Math.max(-20, Math.min(20, n.vx)); n.y += Math.max(-20, Math.min(20, n.vy));
    }
    alpha *= 0.985;
  }

  /* ---------- drawing ---------- */
  const THEME = {};
  function readTheme() {
    const css = getComputedStyle(document.documentElement), v = (n, d) => css.getPropertyValue(n).trim() || d;
    Object.assign(THEME, { edge: v('--graph-edge', 'rgba(60,90,70,.18)'), hot: v('--accent-2', '#4b704f'), gold: v('--gold', '#a67d42'), label: v('--ink', '#1c3a2f'), halo: v('--paper', '#f6f5ee'), ring: v('--surface', '#fdfcf8'), muted: v('--muted', '#6b7a70') });
  }
  readTheme();
  document.addEventListener('chemhub:theme', () => { readTheme(); draw(); });

  function draw() {
    const c = $('graph'), ctx = c.getContext('2d'), W = c.clientWidth, H = c.clientHeight;
    if (!W) return;
    const dpr = Math.min(2, window.devicePixelRatio || 1);
    if (c.width !== Math.round(W * dpr) || c.height !== Math.round(H * dpr)) { c.width = Math.round(W * dpr); c.height = Math.round(H * dpr); }
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
    ctx.save(); ctx.translate(W / 2 + view.x, H / 2 + view.y); ctx.scale(view.k, view.k);
    const focus = hover || drag;
    const near = new Set(); if (focus) { near.add(focus.id); for (const e of edges) { if (e.a === focus.id) near.add(e.b); if (e.b === focus.id) near.add(e.a); } }
    for (const e of edges) {
      const a = byId.get(e.a), b = byId.get(e.b);
      const hot = focus && (e.a === focus.id || e.b === focus.id);
      ctx.globalAlpha = focus && !hot ? 0.15 : e.kind === 'source' ? 0.45 : 1;
      ctx.strokeStyle = hot || e.kind === 'center' ? THEME.hot : THEME.edge;
      ctx.lineWidth = (hot ? 1.2 : 0.6) * Math.max(0.6, Math.min(4, e.w)) / Math.sqrt(view.k);
      ctx.setLineDash(e.kind === 'sibling' ? [5, 5] : e.kind === 'source' ? [2, 4] : []);
      ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
    }
    ctx.setLineDash([]);
    for (const n of nodes) {
      ctx.globalAlpha = focus && !near.has(n.id) ? 0.3 : 1;
      if (n.center) { ctx.beginPath(); ctx.arc(n.x, n.y, n.r + 9, 0, Math.PI * 2); ctx.fillStyle = THEME.gold; ctx.globalAlpha *= 0.18; ctx.fill(); ctx.globalAlpha = focus && !near.has(n.id) ? 0.3 : 1; }
      ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
      ctx.fillStyle = n.center && n.kind !== 'source' ? '#c4923f' : n.color || KIND_COLOR[n.kind] || '#7d8a80';
      if (n.kind === 'doc' && !n.primary) { ctx.fillStyle = THEME.ring; ctx.fill(); ctx.strokeStyle = n.color; ctx.lineWidth = 2; ctx.stroke(); }
      else { ctx.fill(); ctx.strokeStyle = n === focus ? THEME.label : THEME.ring; ctx.lineWidth = n.center ? 3 : 1.5; ctx.stroke(); }
      const showLabel = n.kind !== 'doc' || n === focus || view.k > 1.6;
      if (!showLabel) continue;
      const max = n.kind === 'doc' ? 18 : n.center ? (EN ? 28 : 22) : (EN ? 18 : 14);
      const text = n.label.length > max ? n.label.slice(0, max - 1) + '…' : n.label;
      ctx.font = (n.center ? '700 15px' : n.kind === 'source' ? '600 11.5px' : n.ring === 2 ? '11px' : '600 12px') + " 'Segoe UI','Microsoft YaHei',sans-serif";
      ctx.textAlign = 'center'; ctx.lineJoin = 'round'; ctx.lineWidth = 4; ctx.strokeStyle = THEME.halo;
      const y = n.y + n.r + (n.center ? 19 : 14);
      ctx.strokeText(text, n.x, y); ctx.fillStyle = n.kind === 'source' ? THEME.muted : THEME.label; ctx.fillText(text, n.x, y);
    }
    ctx.restore(); ctx.globalAlpha = 1;
  }
  function loop() { if (alpha > 0.02) step(); draw(); requestAnimationFrame(loop); }

  /* ---------- graph interaction ---------- */
  function toWorld(ev) {
    const c = $('graph'), r = c.getBoundingClientRect();
    const sx = ev.clientX - r.left, sy = ev.clientY - r.top;
    return { x: (sx - c.clientWidth / 2 - view.x) / view.k, y: (sy - c.clientHeight / 2 - view.y) / view.k, sx, sy };
  }
  function pick(p) {
    let best = null, bd = Infinity;
    for (const n of nodes) { const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < n.r + 6 / view.k && d < bd) { bd = d; best = n; } }
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
      moved = false; const p = toWorld(ev), n = pick(p);
      if (n) { drag = n; drag.fx = n.x; drag.fy = n.y; } else pan = { x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y };
      c.setPointerCapture(ev.pointerId);
    });
    c.addEventListener('pointermove', (ev) => {
      const p = toWorld(ev);
      if (drag) { if (Math.abs(p.x - drag.fx) + Math.abs(p.y - drag.fy) > 2) moved = true; if (moved && !drag.center) { drag.fx = p.x; drag.fy = p.y; alpha = Math.max(alpha, 0.25); } return; }
      if (pan) { moved = true; view.x = pan.vx + ev.clientX - pan.x; view.y = pan.vy + ev.clientY - pan.y; draw(); return; }
      const n = pick(p); if (n !== hover) { hover = n; draw(); }
      c.style.cursor = n ? 'pointer' : 'grab'; tooltip(n, p);
    });
    const up = () => {
      if (drag) { const n = drag; if (!n.center) { n.fx = moved ? n.fx : null; n.fy = moved ? n.fy : null; } drag = null; if (!moved) activate(n); }
      pan = null; draw();
    };
    c.addEventListener('pointerup', up); c.addEventListener('pointercancel', up);
    c.addEventListener('pointerleave', () => { hover = null; tooltip(null); draw(); });
    c.addEventListener('dblclick', (ev) => { if (!pick(toWorld(ev))) { view = { x: 0, y: 0, k: 1 }; draw(); } });
    c.addEventListener('wheel', (ev) => {
      ev.preventDefault(); const p = toWorld(ev);
      const k2 = Math.max(0.4, Math.min(3, view.k * (ev.deltaY < 0 ? 1.12 : 0.89)));
      view.x = p.sx - c.clientWidth / 2 - p.x * k2; view.y = p.sy - c.clientHeight / 2 - p.y * k2; view.k = k2; draw();
    }, { passive: false });
    window.addEventListener('resize', () => { if (R) buildGraph(); });
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
    const badges = sources.map((s) => `<span class="src-badge" style="--sc:${esc(s.color)};background:${esc(s.color)}">${esc(s.name)}</span>`).join('');
    const ents = [...d.ents.entries()].filter(([k]) => k !== R.center?.idx).sort((a, b) => b[1] - a[1]).map(([k]) => NET.entities.find((e) => e.idx === k)).filter((e) => e && !e.broad).slice(0, 4);
    const meta = [d.date, d.metric, d.authors ? '✎ ' + d.authors : ''].filter(Boolean).map(esc).join(' · ');
    const excerpt = d.excerpt && !/^该文在计算化学公社的讨论帖|^X-MOL /.test(d.excerpt) ? d.excerpt : '';
    const mirrors = x.also?.length ? `<span class="mirror">${x.also.map((y) => `<a href="${esc(y.url)}" target="_blank" rel="noopener">${esc(sourceOf(y.source).name)}</a>`).join(' · ')}</span>` : '';
    return `<article class="net-item" id="doc-${d.i}"><div class="card-top">${badges}<span class="type-badge">${esc(TYPE_LABEL[d.type] || d.type)}</span></div>` +
      `<h4><a href="${esc(d.url)}" target="${d.type === 'handbook' ? '_self' : '_blank'}" rel="noopener">${mark(d.title)}</a></h4>` +
      (excerpt ? `<p>${mark(excerpt.slice(0, 220))}</p>` : '') +
      (ents.length ? `<div class="net-item-ents">${ents.map((e) => entityChip(e)).join('')}</div>` : '') +
      `<div class="card-foot"><span>${meta}</span>${mirrors}<a class="open-btn" href="${esc(d.url)}" target="${d.type === 'handbook' ? '_self' : '_blank'}" rel="noopener">${d.type === 'handbook' ? '阅读 →' : '原文 ↗'}</a></div></article>`;
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
        (e.url ? `<a class="btn primary focus-link" href="${esc(e.url)}" target="_blank" rel="noopener">访问官网 ↗</a>` : '');
    } else if (R.mode === 'text') {
      f.innerHTML = `<div class="focus-kind k-query">全文检索</div><h2 id="resultTitle">「${esc(R.q)}」</h2>` +
        `<div class="focus-stats"><span>${primary.length} 条命中</span><span>${R.related.length} 个关联概念</span></div>` +
        (R.suggestions?.length ? `<p class="focus-note">没有找到。你是不是要找：${R.suggestions.map((s) => entityChip(s.entity)).join('')}</p>` : '');
    } else if (R.mode === 'source') {
      f.innerHTML = `<div class="focus-kind k-source">来源</div><h2 id="resultTitle">${esc(R.source.name)}</h2><p class="focus-desc">${esc(R.source.role || '')}</p>` +
        `<div class="focus-stats"><span>${primary.length} 条条目</span><span>${R.related.length} 个常见概念</span></div>` +
        (R.source.url ? `<a class="btn primary focus-link" href="${esc(R.source.url)}" target="_blank" rel="noopener">访问原站 ↗</a>` : '');
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

  /* ---------- navigation ---------- */
  function render() {
    R = state.src ? NET.source(state.src) : NET.query(state.q);
    sourceFilter = ''; typeFilter = ''; shown = 30;
    $('netQ').value = state.q || '';
    const label = R.mode === 'entity' ? display(R.center) : R.mode === 'source' ? R.source.name : R.mode === 'text' ? R.q : '';
    if (label && trail[trail.length - 1]?.label !== label) { trail.push({ label, q: state.q, src: state.src }); trail = trail.slice(-7); }
    if (!label) trail = [];
    $('graphTitle').textContent = R.mode === 'overview' ? '全网概览' : `以「${label}」为中心`;
    document.title = (label ? label + ' · ' : '') + '网状查询 · MolAstria';
    buildGraph(); renderFocus(); renderRelated(); renderResults(); renderTrail();
  }
  function navigate(next, push = true) {
    state = { q: next.q || '', src: next.src || '' };
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
      else if (ev.key === 'Enter') { ev.preventDefault(); const it = items[active]; navigate({ q: it ? it.q : input.value.trim() }); }
    });
    $('netSuggest').addEventListener('mousedown', (ev) => { const li = ev.target.closest('li'); if (li) { ev.preventDefault(); navigate({ q: items[Number(li.dataset.i)].q }); } });
    $('netGo').addEventListener('click', () => navigate({ q: input.value.trim() }));
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
      list.map((d) => `<div class="db-cell"><h4>${esc(d.title)}</h4><p>${esc(d.excerpt || d.metric || '')}</p><div class="db-actions"><button class="btn locate-btn" type="button" data-q="${esc(d.title)}">在网中查看</button><a class="btn primary" href="${esc(d.url)}" target="_blank" rel="noopener">访问官网 ↗</a></div></div>`).join('') + '</div></div>').join('') +
      `<div class="db-group"><h3>数据源入口（${NET.sources.length} 个来源）</h3><div class="db-table">` + NET.sources.map((s) => {
        const n = NET.docs.filter((d) => d.sources.includes(s.id)).length;
        return `<div class="db-cell"><h4>${esc(s.name)}</h4><p>${esc(s.role || '')} · ${n} 条</p><div class="db-actions"><button class="btn locate-btn" type="button" data-src="${esc(s.id)}">在网中查看</button>${s.url ? `<a class="btn primary" href="${esc(s.url)}" target="_blank" rel="noopener">访问原站 ↗</a>` : ''}</div></div>`;
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
    window.MolAstriaNetView = { net: NET, current: () => R, nodes: () => nodes, settled: () => alpha <= 0.02,
      screenOf: (id) => { const n = byId.get(id), c = $('graph'), r = c.getBoundingClientRect(); return n && { x: r.left + c.clientWidth / 2 + view.x + n.x * view.k, y: r.top + c.clientHeight / 2 + view.y + n.y * view.k }; } };
    $('generatedAt').textContent = `数据生成：${new Date(data.generatedAt).toLocaleString('zh-CN')} · 每周四自动更新`;
    $('presetChips').innerHTML = PRESETS.map((p) => `<button class="chip preset" type="button" data-q="${esc(p)}">${esc(p)}</button>`).join('');
    $('netMore').addEventListener('click', () => { shown += 30; renderResults(); });
    $('relayoutBtn').addEventListener('click', () => { for (const n of nodes) if (!n.center) { n.fx = n.fy = null; n.x = Math.cos(n.angle || 0) * (n.target || 100); n.y = Math.sin(n.angle || 0) * (n.target || 100); } alpha = 1; });
    $('fitBtn').addEventListener('click', () => { view = { x: 0, y: 0, k: 1 }; draw(); });
    $('netBack').addEventListener('click', () => history.back());
    renderStats(); renderDirectory(); bindGraph(); bindSearch();
    // ?q= and ?src= links; the old ?select=tag:X / db:id / src:id links still work.
    const p = new URLSearchParams(location.search);
    const sel = p.get('select') || '';
    if (sel.startsWith('src:')) state.src = sel.slice(4);
    else if (sel.startsWith('db:')) state.q = NET.docs.find((d) => d.id === sel.slice(3))?.title || '';
    else if (/^(tag|cat):/.test(sel)) state.q = sel.slice(4);
    if (p.get('q')) state.q = p.get('q');
    if (p.get('src')) state.src = p.get('src');
    history.replaceState(state, '', location.href);
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
