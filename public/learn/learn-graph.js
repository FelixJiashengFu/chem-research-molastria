'use strict';
// 研习台的三种 SVG 图：学习路线图（planMap，分层的依赖图）、知识图（knowledgeGraph，手写的力导向图，可拖动、缩放）、
// AI 给的示意图（diagram，限定格式的 JSON 画成分层图）。只画，不改数据。
// 文字一律用 textContent / createTextNode 写入，模型给的文字从不进 innerHTML；颜色全部来自 shared-nav.css 的 CSS 变量，
// 样式在 learn-graph.css。图里的文字是数据（AI 生成或学习者自己的），整张图标 translate="no"，不走词典。
// 力导向图的做法照 physics-realms/pr.js：斥力 + 弹簧 + 向锚点的引力，requestAnimationFrame 降温后停；
// 拖节点、拖空白平移、滚轮和双指缩放；CSS zoom（顶栏的界面缩放）下按 rect.width / clientWidth 换算指针坐标。
(function (root) {
  const SVGNS = 'http://www.w3.org/2000/svg';
  let uid = 0;
  const nextUid = () => (++uid).toString(36);

  // ── 小工具 ────────────────────────────────────────────────────────────
  const isEn = (lang) => (lang ? /^en/i.test(lang) : (root.document && root.document.documentElement.lang === 'en'));
  const T = (lang, zh, en) => (isEn(lang) ? en : zh);
  const el = (tag, attrs, parent) => {
    const n = root.document.createElementNS(SVGNS, tag);
    if (attrs) for (const k in attrs) if (attrs[k] != null) n.setAttribute(k, String(attrs[k]));
    if (parent) parent.appendChild(n);
    return n;
  };
  const hel = (tag, cls, parent) => {
    const n = root.document.createElement(tag);
    if (cls) n.className = cls;
    if (parent) parent.appendChild(n);
    return n;
  };
  const str = (v) => (v == null ? '' : String(v)).replace(/\s+/g, ' ').trim();
  const reducedMotion = () => { try { return !!root.matchMedia && root.matchMedia('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
  const f1 = (v) => (Math.round(v * 10) / 10).toString();

  // 估算文字宽度（单位：字号 em）：汉字、全角约 1 em，拉丁字母约 0.56 em。SVG 里没有自动换行，靠它来折行。
  const charW = (c) => {
    const k = c.codePointAt(0);
    if (k >= 0x2e80 || (k >= 0x1100 && k <= 0x11ff)) return 1;
    if (/[A-Z0-9@%&MW#]/.test(c)) return 0.66;
    if (/[il.,:;'|!()\[\] ]/.test(c)) return 0.32;
    return 0.56;
  };
  const textW = (s) => { let w = 0; for (const c of s) w += charW(c); return w; };
  // 折行：拉丁单词整词换行（过长再硬切），汉字逐字换行；超出 maxLines 时最后一行加省略号。
  const wrap = (text, maxEm, maxLines) => {
    const s = str(text);
    if (!s) return [''];
    const tokens = s.match(/[（(“‘《「【\[]*(?:[\u2e80-\uffff]|[^\s\u2e80-\uffff（(“‘《「【\[]+)[，。、：；！？）)”’》」】\]…,.;:!?]*|\s+|./g) || [s];
    const lines = [];
    let cur = '', w = 0;
    const push = () => { lines.push(cur.trim()); cur = ''; w = 0; };
    for (let t of tokens) {
      if (/^\s+$/.test(t)) { if (cur) { cur += ' '; w += 0.32; } continue; }
      let tw = textW(t);
      if (w + tw > maxEm && cur.trim()) push();
      while (tw > maxEm) { // 单个词比一行还长：硬切
        let part = '', pw = 0;
        for (const c of t) { if (pw + charW(c) > maxEm) break; part += c; pw += charW(c); }
        if (!part) part = t[0];
        cur += part; push();
        t = t.slice(part.length); tw = textW(t);
      }
      cur += t; w += tw;
    }
    if (cur.trim()) push();
    if (lines.length > maxLines) {
      const keep = lines.slice(0, maxLines);
      let last = keep[maxLines - 1];
      while (last && textW(last) + 1 > maxEm) last = [...last].slice(0, -1).join('');
      keep[maxLines - 1] = last.replace(/\s+$/, '') + '…';
      return keep;
    }
    return lines;
  };
  const clip = (text, maxEm) => {
    const s = str(text);
    if (textW(s) <= maxEm) return s;
    let out = '', w = 0;
    for (const c of s) { if (w + charW(c) > maxEm - 1) break; out += c; w += charW(c); }
    return out.replace(/\s+$/, '') + '…';
  };
  // 多行文字：一个 <text>，每行一个 <tspan>
  const multiText = (parent, lines, { x = 0, y = 0, lh, cls }) => {
    const t = el('text', { class: cls, x, y: y - ((lines.length - 1) * lh) / 2 }, parent);
    lines.forEach((line, i) => {
      const s = el('tspan', { x, dy: i ? lh : 0 }, t);
      s.textContent = line;
    });
    return t;
  };

  // 各节点的宽度跟着所在容器：容器宽度（CSS px，已经包含页面的 CSS zoom 换算）
  const widthOf = (node) => {
    let n = node;
    while (n && n.nodeType === 1) {
      const w = n.clientWidth;
      if (w) return w;
      n = n.parentElement;
    }
    return 800;
  };

  // 容器宽度跨过断点时重画（横排 ↔ 竖排）；每个元素只挂一个观察者
  const watchers = new WeakMap();
  const watch = (target, key, redraw) => {
    const old = watchers.get(target);
    if (old) old.disconnect();
    if (!('ResizeObserver' in root)) return;
    let last = key;
    let first = true;
    const ro = new root.ResizeObserver(() => {
      if (first) { first = false; return; }
      if (!target.isConnected) { ro.disconnect(); watchers.delete(target); return; }
      const k = redraw.key();
      if (k !== last) { last = k; redraw.draw(); }
    });
    ro.observe(target.parentElement || target);
    watchers.set(target, ro);
  };

  // ── 分层（最长路径），图里有环时按 DFS 的回边断开 ─────────────────────
  // deps: Map(id → [前置 id])。返回 { [id]: {layer, index} }，index 按前置节点的平均位置排，减少交叉。
  const layerize = (ids, deps) => {
    const layer = new Map(), order = new Map(ids.map((id, i) => [id, i]));
    // 先沿“前置 → 后继”的方向做 DFS，从没有前置的节点开始；指回栈上节点的边是回边（环），去掉
    const pre = new Map(ids.map((id) => [id, [...new Set(deps.get(id) || [])].filter((d) => order.has(d) && d !== id)]));
    const out = new Map(ids.map((id) => [id, []]));
    for (const id of ids) for (const d of pre.get(id)) out.get(d).push(id);
    const state = new Map(), back = new Set();
    const dfs = (id) => {
      state.set(id, 1);
      for (const nx of out.get(id)) {
        if (state.get(nx) === 1) back.add(id + '\u0000' + nx);
        else if (!state.get(nx)) dfs(nx);
      }
      state.set(id, 2);
    };
    for (const id of ids) if (!pre.get(id).length && !state.get(id)) dfs(id);
    for (const id of ids) if (!state.get(id)) dfs(id);
    const visit = (id) => {
      if (layer.has(id)) return layer.get(id);
      layer.set(id, 0);
      let L = 0;
      for (const d of pre.get(id)) if (!back.has(d + '\u0000' + id)) L = Math.max(L, visit(d) + 1);
      layer.set(id, L);
      return L;
    };
    for (const id of ids) visit(id);
    const byLayer = [];
    for (const id of ids) { const L = layer.get(id); (byLayer[L] = byLayer[L] || []).push(id); }
    const pos = new Map();
    const res = {};
    byLayer.forEach((list, L) => {
      if (!list) return;
      if (L > 0) {
        const bary = (id) => {
          const ds = pre.get(id).filter((d) => pos.has(d));
          return ds.length ? ds.reduce((s, d) => s + pos.get(d), 0) / ds.length : Infinity;
        };
        list.sort((a, b) => (bary(a) - bary(b)) || (order.get(a) - order.get(b)));
      }
      list.forEach((id, i) => { pos.set(id, list.length > 1 ? i / (list.length - 1) : 0.5); res[id] = { layer: L, index: i }; });
    });
    return res;
  };
  // 外部给的布局要覆盖全部节点、数值合法，否则自己算
  const usableLayout = (layout, ids) => {
    if (!layout || typeof layout !== 'object') return null;
    for (const id of ids) {
      const p = layout[id];
      if (!p || !Number.isFinite(+p.layer) || !Number.isFinite(+p.index) || p.layer < 0 || p.index < 0) return null;
    }
    return layout;
  };
  // 把 {layer,index} 整理成按层排好的列表（index 可能不连续）
  const columns = (ids, layout) => {
    const cols = [];
    for (const id of ids) { const L = Math.round(+layout[id].layer); (cols[L] = cols[L] || []).push(id); }
    const dense = cols.filter(Boolean);
    for (const c of dense) c.sort((a, b) => (+layout[a].index) - (+layout[b].index));
    return dense;
  };

  // ── 学习路线图 ────────────────────────────────────────────────────────
  const STATUS = {
    held: ['已掌握', 'Already known'],
    todo: ['待学', 'To learn'],
    doing: ['正在学', 'Learning now'],
    done: ['已学会', 'Learned'],
    shaky: ['不稳', 'Shaky'],
  };
  const statusText = (st, lang) => { const s = STATUS[st] || STATUS.todo; return isEn(lang) ? s[1] : s[0]; };
  const PLAN_BREAK = 560;
  const P = { font: 13, lh: 17, padX: 12, padY: 10, gapIn: 14, margin: 14, iconW: 18 };

  const icon = (g, st, x, y) => {
    if (st === 'held' || st === 'done') el('path', { class: 'lg-ico', d: `M${x - 4.5} ${y}l3 3.2 6-6.6` }, g);
    else if (st === 'shaky') { el('path', { class: 'lg-ico', d: `M${x} ${y - 5}v6` }, g); el('circle', { class: 'lg-ico-dot', cx: x, cy: y + 4.4, r: 1.3 }, g); }
    else if (st === 'doing') el('circle', { class: 'lg-ico-dot', cx: x, cy: y, r: 3.4 }, g);
    else el('circle', { class: 'lg-ico-ring', cx: x, cy: y, r: 3.6 }, g);
  };

  function planMap(svgEl, plan, layout, opts) {
    opts = opts || {};
    if (!svgEl) return null;
    const lang = opts.lang;
    const raw = (plan && Array.isArray(plan.nodes)) ? plan.nodes : [];
    const nodes = [];
    const seen = new Set();
    for (const n of raw) {
      if (!n || n.id == null) continue;
      const id = String(n.id);
      if (seen.has(id)) continue;
      seen.add(id);
      nodes.push({ id, label: str(n.label) || id, detail: str(n.detail), st: STATUS[n.status] ? n.status : 'todo', deps: Array.isArray(n.deps) ? n.deps.map(String) : [] });
    }
    const ids = nodes.map((n) => n.id);
    const byId = new Map(nodes.map((n) => [n.id, n]));
    for (const n of nodes) n.deps = [...new Set(n.deps)].filter((d) => byId.has(d) && d !== n.id);
    const goalId = plan && plan.goalId != null ? String(plan.goalId) : null;
    const current = opts.current != null ? String(opts.current) : null;

    while (svgEl.firstChild) svgEl.removeChild(svgEl.firstChild);
    svgEl.setAttribute('class', ((svgEl.getAttribute('class') || '').replace(/\blg-plan(-\w+)?\b/g, '').trim() + ' lg-plan').trim());
    svgEl.setAttribute('translate', 'no');
    svgEl.setAttribute('role', 'group');
    svgEl.setAttribute('aria-label', T(lang, '学习路线图', 'Learning map'));
    if (!nodes.length) {
      svgEl.setAttribute('viewBox', '0 0 320 60');
      svgEl.setAttribute('width', 320); svgEl.setAttribute('height', 60);
      const t = el('text', { class: 'lg-empty-text', x: 160, y: 34, 'text-anchor': 'middle' }, svgEl);
      t.textContent = T(lang, '还没有路线', 'No map yet');
      return { orientation: 'none', width: 320, height: 60 };
    }

    const lay = usableLayout(layout, ids) || layerize(ids, new Map(nodes.map((n) => [n.id, n.deps])));
    const cols = columns(ids, lay);
    const cw = widthOf(svgEl.parentElement || svgEl);
    const wide = cw >= PLAN_BREAK;
    const maxPer = Math.max(...cols.map((c) => c.length));

    // 节点尺寸
    let nodeW, gapX;
    if (wide) {
      nodeW = 150;
      const free = cw - 2 * P.margin - cols.length * nodeW;
      gapX = cols.length > 1 ? Math.max(30, Math.min(64, free / (cols.length - 1))) : 0;
    } else {
      gapX = 12;
      nodeW = Math.max(96, Math.min(170, (cw - 2 * P.margin - (maxPer - 1) * gapX) / maxPer));
    }
    const maxEm = (nodeW - 2 * P.padX - P.iconW) / P.font;
    for (const n of nodes) {
      n.lines = wrap(n.label, maxEm, 3);
      n.w = nodeW;
      n.h = Math.max(40, n.lines.length * P.lh + 2 * P.padY);
    }

    // 位置（节点中心）
    let W, H;
    if (wide) {
      const colH = cols.map((c) => c.reduce((s, id) => s + byId.get(id).h, 0) + (c.length - 1) * P.gapIn);
      H = Math.max(...colH) + 2 * P.margin;
      W = cols.length * nodeW + (cols.length - 1) * gapX + 2 * P.margin;
      cols.forEach((c, L) => {
        let y = (H - colH[L]) / 2;
        const x = P.margin + L * (nodeW + gapX) + nodeW / 2;
        for (const id of c) { const n = byId.get(id); n.x = x; n.y = y + n.h / 2; y += n.h + P.gapIn; }
      });
    } else {
      const rowH = cols.map((c) => Math.max(...c.map((id) => byId.get(id).h)));
      const gapY = 34;
      W = Math.max(maxPer * nodeW + (maxPer - 1) * gapX + 2 * P.margin, 200);
      H = rowH.reduce((s, h) => s + h, 0) + (cols.length - 1) * gapY + 2 * P.margin;
      let y = P.margin;
      cols.forEach((c, L) => {
        const rowW = c.length * nodeW + (c.length - 1) * gapX;
        let x = (W - rowW) / 2;
        for (const id of c) { const n = byId.get(id); n.x = x + nodeW / 2; n.y = y + rowH[L] / 2; x += nodeW + gapX; }
        y += rowH[L] + gapY;
      });
    }

    // 兜底的回边（环）画在图外侧，给它留出边距
    const hasBack = nodes.some((n) => n.deps.some((d) => (+lay[d].layer) >= (+lay[n.id].layer)));
    if (hasBack) {
      const extra = 44;
      for (const n of nodes) { if (wide) n.y += extra; else n.x += extra; }
      if (wide) H += extra; else W += extra;
    }
    svgEl.setAttribute('viewBox', `0 0 ${f1(W)} ${f1(H)}`);
    svgEl.setAttribute('width', f1(W));
    svgEl.setAttribute('height', f1(H));
    svgEl.setAttribute('preserveAspectRatio', 'xMidYMin meet');
    svgEl.classList.toggle('lg-plan-v', !wide);

    const mid = 'lg-arr-' + nextUid(), midOn = mid + '-on';
    const defs = el('defs', null, svgEl);
    for (const [id, cls] of [[mid, 'lg-arrow'], [midOn, 'lg-arrow lg-arrow-on']]) {
      const m = el('marker', { id, class: cls, viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto-start-reverse', markerUnits: 'userSpaceOnUse' }, defs);
      el('path', { d: 'M0 0L10 5L0 10z' }, m);
    }

    // 边：从前置节点指向依赖它的节点
    const gE = el('g', { class: 'lg-plan-edges', 'aria-hidden': 'true' }, svgEl);
    for (const n of nodes) {
      for (const d of n.deps) {
        const a = byId.get(d);
        let dpath;
        const backEdge = (+lay[a.id].layer) >= (+lay[n.id].layer);
        if (backEdge) { // 环或同层：画成绕开的弧（learn-core 已断环，这里只是兜底）
          const x1 = a.x, y1 = a.y - (wide ? a.h / 2 : 0), x2 = n.x, y2 = n.y - (wide ? n.h / 2 : 0);
          const xs = wide ? x1 : a.x - a.w / 2, xe = wide ? x2 : n.x - n.w / 2 - 1;
          const ys = wide ? y1 : a.y, ye = wide ? y2 - 1 : n.y;
          const bend = Math.min(52, 26 + Math.abs(wide ? x2 - x1 : y2 - y1) * 0.08);
          dpath = wide
            ? `M${f1(xs)} ${f1(ys)}C${f1(xs)} ${f1(ys - bend)} ${f1(xe)} ${f1(ye - bend)} ${f1(xe)} ${f1(ye)}`
            : `M${f1(xs)} ${f1(ys)}C${f1(xs - bend)} ${f1(ys)} ${f1(xe - bend)} ${f1(ye)} ${f1(xe)} ${f1(ye)}`;
        } else if (wide) {
          const x1 = a.x + a.w / 2, y1 = a.y, x2 = n.x - n.w / 2 - 1, y2 = n.y;
          const c = Math.max(18, (x2 - x1) / 2);
          dpath = `M${f1(x1)} ${f1(y1)}C${f1(x1 + c)} ${f1(y1)} ${f1(x2 - c)} ${f1(y2)} ${f1(x2)} ${f1(y2)}`;
        } else {
          const x1 = a.x, y1 = a.y + a.h / 2, x2 = n.x, y2 = n.y - n.h / 2 - 1;
          const c = Math.max(14, (y2 - y1) / 2);
          dpath = `M${f1(x1)} ${f1(y1)}C${f1(x1)} ${f1(y1 + c)} ${f1(x2)} ${f1(y2 - c)} ${f1(x2)} ${f1(y2)}`;
        }
        const on = n.id === current || n.st === 'doing';
        const p = el('path', { class: 'lg-plan-edge', d: dpath, 'data-from': a.id, 'data-to': n.id, 'marker-end': `url(#${on ? midOn : mid})` }, gE);
        if (on) p.classList.add('on');
        if (a.st === 'held' && (n.st === 'held')) p.classList.add('held');
      }
    }

    // 节点
    const gN = el('g', { class: 'lg-plan-nodes' }, svgEl);
    const order = cols.flat();
    const go = (id) => { if (typeof opts.onSelect === 'function') opts.onSelect(id); };
    for (const id of order) {
      const n = byId.get(id);
      const g = el('g', { class: 'lg-pnode', 'data-id': n.id, 'data-st': n.st, transform: `translate(${f1(n.x)} ${f1(n.y)})`, tabindex: 0, role: 'button' }, gN);
      if (n.id === current) g.classList.add('is-current');
      if (n.id === goalId) g.classList.add('is-goal');
      const parts = [n.label, statusText(n.st, lang)];
      if (n.id === goalId) parts.push(T(lang, '目标', 'Goal'));
      if (n.id === current) parts.push(T(lang, '当前', 'Current'));
      g.setAttribute('aria-label', parts.join(' · '));
      const title = el('title', null, g);
      title.textContent = parts.join(' · ') + (n.detail ? '\n' + n.detail : '');
      if (n.st === 'doing' || n.id === current) el('rect', { class: 'lg-pulse', x: -n.w / 2 - 4, y: -n.h / 2 - 4, width: n.w + 8, height: n.h + 8, rx: 12 }, g);
      el('rect', { class: 'lg-pbox', x: -n.w / 2, y: -n.h / 2, width: n.w, height: n.h, rx: 9 }, g);
      if (n.id === goalId) el('rect', { class: 'lg-goal-ring', x: -n.w / 2 + 3, y: -n.h / 2 + 3, width: n.w - 6, height: n.h - 6, rx: 7 }, g);
      icon(g, n.st, -n.w / 2 + P.padX + 4, 0);
      const tx = -n.w / 2 + P.padX + P.iconW;
      const t = multiText(g, n.lines, { x: tx, y: 0, lh: P.lh, cls: 'lg-plabel' });
      t.setAttribute('dominant-baseline', 'central');
      g.addEventListener('click', () => go(n.id));
      g.addEventListener('keydown', (ev) => {
        if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); go(n.id); return; }
        // 方向键在节点之间移动焦点（按排列顺序）
        const k = { ArrowRight: 1, ArrowDown: 1, ArrowLeft: -1, ArrowUp: -1 }[ev.key];
        if (k) {
          ev.preventDefault();
          const i = order.indexOf(n.id), j = Math.max(0, Math.min(order.length - 1, i + k));
          const nx = gN.querySelector(`[data-id="${CSS_escape(order[j])}"]`);
          if (nx) nx.focus();
        }
      });
    }

    watch(svgEl, wide, { key: () => widthOf(svgEl.parentElement || svgEl) >= PLAN_BREAK, draw: () => planMap(svgEl, plan, layout, opts) });
    return { orientation: wide ? 'horizontal' : 'vertical', width: W, height: H };
  }
  const CSS_escape = (s) => (root.CSS && root.CSS.escape ? root.CSS.escape(s) : String(s).replace(/["\\]/g, '\\$&'));

  // ── 知识图（力导向）───────────────────────────────────────────────────
  const posCache = new Map(); // 重画时（比如删掉一个命题后）沿用原来的位置，图不会整个跳
  const PALETTE = 6; // learn-graph.css 里 .lg-kn[data-c=0..5]

  function knowledgeGraph(container, data, opts) {
    opts = opts || {};
    const lang = opts.lang;
    const doc = root.document;
    const api = { destroy() {}, focus() {}, setHighlight() {}, fit() {} };
    if (!container) return api;
    while (container.firstChild) container.removeChild(container.firstChild);
    container.classList.add('lg-kg');

    const rawNodes = data && Array.isArray(data.nodes) ? data.nodes : [];
    const nodes = [];
    const N = new Map();
    for (const r of rawNodes) {
      if (!r || r.id == null || N.has(String(r.id))) continue;
      const sessions = Array.isArray(r.sessions) ? r.sessions.map(String) : [];
      const n = { id: String(r.id), text: str(r.text), sessions, rawDeg: Number.isFinite(+r.degree) ? +r.degree : 0, links: [], vx: 0, vy: 0 };
      nodes.push(n); N.set(n.id, n);
    }
    const links = [];
    const linkSeen = new Set();
    for (const l of (data && Array.isArray(data.links) ? data.links : [])) {
      if (!l) continue;
      const s = N.get(String(l.source && typeof l.source === 'object' ? l.source.id : l.source));
      const t = N.get(String(l.target && typeof l.target === 'object' ? l.target.id : l.target));
      if (!s || !t || s === t) continue;
      const key = s.id + '\u0000' + t.id;
      if (linkSeen.has(key)) continue;
      linkSeen.add(key);
      const e = { s, t, chain: l.chain != null ? String(l.chain) : '' };
      links.push(e); s.links.push(e); t.links.push(e);
    }

    if (!nodes.length) {
      const empty = hel('div', 'lg-kg-empty', container);
      const strong = hel('strong', null, empty);
      strong.textContent = T(lang, '知识图还是空的', 'The knowledge graph is empty');
      const p = hel('p', null, empty);
      p.textContent = T(lang, '学完一次、或导入笔记后，学到的命题和推理链会出现在这里。', 'Finish a session or import notes, and the propositions and reasoning chains you learned will show up here.');
      api.destroy = () => { while (container.firstChild) container.removeChild(container.firstChild); };
      return api;
    }

    for (const n of nodes) {
      n.deg = Math.max(n.rawDeg, n.links.length);
      n.r = 5 + Math.min(10, Math.sqrt(n.deg) * 2.8);
    }

    // 同一次学习得到的命题聚在一起：每个会话一个锚点，排在一个圆上
    const sess = [];
    for (const n of nodes) { const k = n.sessions[0] || ''; if (!sess.includes(k)) sess.push(k); }
    const anchor = new Map();
    const R = sess.length > 1 ? 50 + 34 * Math.sqrt(nodes.length) * Math.min(1, sess.length / 4) : 0;
    sess.forEach((k, i) => { const a = (i / sess.length) * Math.PI * 2 - Math.PI / 2; anchor.set(k, [Math.cos(a) * R, Math.sin(a) * R]); });
    const colorOf = (k) => { let h = 0; for (const c of k) h = (h * 31 + c.codePointAt(0)) >>> 0; return k ? h % PALETTE : 0; };

    let seed = 11 + nodes.length;
    const rnd = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    let cached = 0;
    for (const n of nodes) {
      const c = posCache.get(n.id);
      if (c) { n.x = c[0]; n.y = c[1]; cached++; continue; }
      const nb = n.links.map((e) => (e.s === n ? e.t : e.s)).find((m) => posCache.has(m.id));
      const [ax, ay] = nb ? posCache.get(nb.id) : anchor.get(n.sessions[0] || '');
      n.x = ax + (rnd() - 0.5) * 80; n.y = ay + (rnd() - 0.5) * 80;
    }
    let alpha = cached / nodes.length > 0.8 ? 0.3 : 1;
    // 小图每个标签都显示：连线拉长一些，给标签留地方
    const allLabels = nodes.length <= 24;
    const restLen = allLabels ? 96 : 52, repK = allLabels ? 5 : 1;

    const tick = () => {
      const n0 = nodes.length;
      for (let i = 0; i < n0; i++) {
        const a = nodes[i];
        for (let j = i + 1; j < n0; j++) {
          const b = nodes[j];
          let dx = b.x - a.x, dy = b.y - a.y, d2 = dx * dx + dy * dy;
          if (d2 > 160000) continue;
          if (d2 < 1) { dx = rnd() - 0.5; dy = rnd() - 0.5; d2 = 1; }
          const d = Math.sqrt(d2), f = (repK * 1100 * (a.r + b.r) / 14 * alpha) / d2;
          const fx = (dx / d) * f, fy = (dy / d) * f;
          a.vx -= fx; a.vy -= fy; b.vx += fx; b.vy += fy;
        }
      }
      for (const e of links) {
        const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const f = (d - (restLen + e.s.r + e.t.r)) * 0.06 * alpha;
        const fx = (dx / d) * f, fy = (dy / d) * f;
        e.s.vx += fx; e.s.vy += fy; e.t.vx -= fx; e.t.vy -= fy;
      }
      for (const n of nodes) {
        const [ax, ay] = anchor.get(n.sessions[0] || '');
        const g = 0.012 * alpha;
        n.vx += (ax - n.x) * g - n.x * 0.003 * alpha; n.vy += (ay - n.y) * g - n.y * 0.003 * alpha;
        if (n.fixed) { n.vx = 0; n.vy = 0; continue; }
        n.vx *= 0.58; n.vy *= 0.58;
        n.x += Math.max(-30, Math.min(30, n.vx)); n.y += Math.max(-30, Math.min(30, n.vy));
      }
      alpha = Math.max(0, alpha * 0.982);
    };

    // DOM
    const wrapEl = hel('div', 'lg-kg-wrap', container);
    wrapEl.setAttribute('translate', 'no');
    const svg = el('svg', { class: 'lg-kg-svg', role: 'group', 'aria-label': T(lang, `知识图：${nodes.length} 个命题、${links.length} 条推理关系。拖动平移，滚轮或双指缩放，拖动节点调整位置。`, `Knowledge graph: ${nodes.length} propositions, ${links.length} reasoning links. Drag to pan, scroll or pinch to zoom, drag a node to move it.`) }, wrapEl);
    const amid = 'lg-karr-' + nextUid();
    const defs = el('defs', null, svg);
    const mk = el('marker', { id: amid, class: 'lg-arrow', viewBox: '0 0 10 10', refX: 10, refY: 5, markerWidth: 5, markerHeight: 5, orient: 'auto' }, defs);
    el('path', { d: 'M0 0L10 5L0 10z' }, mk);
    const vp = el('g', null, svg);
    const gE = el('g', { class: 'lg-kg-edges', 'aria-hidden': 'true' }, vp);
    const gN = el('g', { class: 'lg-kg-nodes' }, vp);
    for (const e of links) {
      e.el = el('line', { class: 'lg-ke', 'marker-end': `url(#${amid})` }, gE);
      if (e.chain) e.el.dataset.chain = e.chain;
    }
    const focusable = nodes.length <= 150;
    const labelEm = 14;
    for (const n of nodes) {
      const g = el('g', { class: 'lg-kn', 'data-id': n.id, 'data-c': colorOf(n.sessions[0] || '') }, gN);
      if (focusable) { g.setAttribute('tabindex', 0); g.setAttribute('role', 'button'); g.setAttribute('aria-label', n.text); }
      if (n.deg >= 3 || nodes.length <= 24) g.classList.add('lg-big');
      el('title', null, g).textContent = n.text;
      el('circle', { r: f1(n.r) }, g);
      const t = el('text', { y: f1(n.r + 12) }, g);
      t.textContent = clip(n.text, labelEm);
      n.el = g; n.tEl = t; n.lw = textW(t.textContent); n.i = nodes.indexOf(n);
    }
    const zoomBox = hel('div', 'lg-kg-zoom', wrapEl);
    const zbtn = (z, txt, label) => {
      const b = hel('button', 'lg-zbtn', zoomBox);
      b.type = 'button'; b.dataset.z = z; b.textContent = txt;
      if (label) b.setAttribute('aria-label', label);
      return b;
    };
    zbtn('in', '+', T(lang, '放大', 'Zoom in'));
    zbtn('out', '−', T(lang, '缩小', 'Zoom out'));
    zbtn('fit', T(lang, '全图', 'Fit'), null).classList.add('lg-zfit');

    const cam = { x: 0, y: 0, k: 1 };
    let W = 800, H = 560;
    const applyCam = () => {
      vp.setAttribute('transform', `translate(${f1(W / 2 + cam.x)} ${f1(H / 2 + cam.y)}) scale(${cam.k.toFixed(4)})`);
      svg.classList.toggle('lg-near', cam.k > 1.3);
      svg.style.setProperty('--lg-label', `${(11 / Math.min(1, Math.sqrt(cam.k))).toFixed(2)}px`);
      relabel();
    };
    // 标签避让：按优先级（选中 > 相邻高亮 > 搜索命中 > 连得多）逐个放，先试节点下方、再试上方，
    // 和已放的标签或别的节点重叠就藏起来（悬停、选中时它的优先级最高，会露出来）。镜头和布局停下来后重算。
    let lblT = 0;
    const declutter = () => {
      lblT = 0;
      if (dead) return;
      const k = cam.k, fw = 11 / Math.min(1, Math.sqrt(k)), fs = fw * k; // 标签字号：世界坐标、屏幕像素
      const cls = (n, c) => n.el.classList.contains(c);
      const focusOn = svg.classList.contains('lg-focus'), near = k > 1.3;
      const shown = (n) => (focusOn ? cls(n, 'hl') : cls(n, 'lg-big') || near || cls(n, 'match') || cls(n, 'hl'));
      const ox = W / 2 + cam.x, oy = H / 2 + cam.y;
      const circles = nodes.map((n) => [ox + n.x * k - n.r * k, oy + n.y * k - n.r * k, ox + n.x * k + n.r * k, oy + n.y * k + n.r * k, n]);
      const rank = (n) => (cls(n, 'on') ? 8e6 : 0) + (cls(n, 'hl') ? 4e6 : 0) + (cls(n, 'match') ? 2e6 : 0) + n.deg * 1000 - n.i;
      const list = nodes.filter(shown).sort((a, b) => rank(b) - rank(a));
      const kept = [];
      const hits = (b, self) => kept.some((o) => b[0] < o[2] && b[2] > o[0] && b[1] < o[3] && b[3] > o[1])
        || circles.some((c) => c[4] !== self && b[0] < c[2] && b[2] > c[0] && b[1] < c[3] && b[3] > c[1]);
      for (const n of nodes) if (!shown(n)) n.tEl.classList.remove('lg-lhide');
      for (const n of list) {
        const sx = ox + n.x * k, sy = oy + n.y * k, w = n.lw * fs, pad = 2;
        let placed = false;
        for (const yb of [n.r + 3 + fw * 0.9, -(n.r + 4)]) {
          const base = sy + yb * k;
          const b = [sx - w / 2 - pad, base - fs * 0.92 - pad, sx + w / 2 + pad, base + fs * 0.26 + pad];
          if (hits(b, n) && !(cls(n, 'on') && yb > 0)) continue; // 选中的那个总要显示
          kept.push(b); n.tEl.setAttribute('y', f1(yb)); placed = true; break;
        }
        n.tEl.classList.toggle('lg-lhide', !placed);
      }
    };
    function relabel(now) {
      if (now) { root.clearTimeout(lblT); declutter(); return; }
      if (!lblT) lblT = root.setTimeout(declutter, 80);
    }
    const draw = () => {
      for (const n of nodes) n.el.setAttribute('transform', `translate(${f1(n.x)} ${f1(n.y)})`);
      for (const e of links) {
        const dx = e.t.x - e.s.x, dy = e.t.y - e.s.y, d = Math.sqrt(dx * dx + dy * dy) || 1;
        const ux = dx / d, uy = dy / d;
        e.el.setAttribute('x1', f1(e.s.x + ux * e.s.r)); e.el.setAttribute('y1', f1(e.s.y + uy * e.s.r));
        e.el.setAttribute('x2', f1(e.t.x - ux * (e.t.r + 2))); e.el.setAttribute('y2', f1(e.t.y - uy * (e.t.r + 2)));
      }
    };
    const resize = () => {
      W = svg.clientWidth || 800; H = svg.clientHeight || 560;
      svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
      applyCam();
    };
    const remember = () => { for (const n of nodes) posCache.set(n.id, [n.x, n.y]); };
    let raf = 0, dead = false;
    const run = () => {
      if (raf || dead) return;
      let frames = 0;
      const step = () => {
        tick(); draw();
        if (++frames % 12 === 0) relabel();
        if (alpha > 0.01 && !dead) raf = root.requestAnimationFrame(step);
        else { raf = 0; remember(); relabel(true); }
      };
      raf = root.requestAnimationFrame(step);
    };
    const reheat = (a) => { alpha = Math.max(alpha, a); run(); };

    // 高亮
    let picked = null, hover = null;
    const lit = () => {
      const id = picked || hover;
      const near = new Set();
      if (id && N.has(id)) { near.add(id); for (const e of N.get(id).links) { near.add(e.s.id); near.add(e.t.id); } }
      svg.classList.toggle('lg-focus', near.size > 0);
      for (const n of nodes) { n.el.classList.toggle('hl', near.has(n.id)); n.el.classList.toggle('on', n.id === picked); }
      for (const e of links) e.el.classList.toggle('hl', !!id && (e.s.id === id || e.t.id === id));
      relabel(true);
    };
    const setHighlight = (h) => {
      const set = h instanceof Set ? h : new Set(Array.isArray(h) ? h.map(String) : []);
      let m = 0;
      for (const n of nodes) { const on = set.has(n.id); n.el.classList.toggle('match', on); if (on) m++; }
      svg.classList.toggle('lg-searching', m > 0);
      relabel();
    };

    // 视角
    let anim = 0;
    const animateTo = (goal, instant) => {
      root.cancelAnimationFrame(anim);
      if (instant || reducedMotion()) { Object.assign(cam, goal); applyCam(); return; }
      const from = { ...cam }, t0 = root.performance.now();
      const step = (t) => {
        const u = Math.min(1, (t - t0) / 380), s = u * u * (3 - 2 * u);
        cam.x = from.x + (goal.x - from.x) * s; cam.y = from.y + (goal.y - from.y) * s; cam.k = from.k + (goal.k - from.k) * s;
        applyCam(); if (u < 1) anim = root.requestAnimationFrame(step);
      };
      anim = root.requestAnimationFrame(step);
    };
    // 全图：小图（标签全显示）留出半个标签宽的边，最多放大到 1 倍，免得节点挤在一起、标签叠成一团
    const fitGoal = () => {
      const maxLw = allLabels ? Math.max(...nodes.map((n) => n.lw)) : 0;
      let k = 1, x0, x1, y0, y1;
      for (let it = 0; it < 3; it++) {
        const fw = 11 / Math.min(1, Math.sqrt(k));
        const px = allLabels ? maxLw * fw / 2 + 6 : 30, top = allLabels ? fw * 1.3 + 6 : 10, bottom = allLabels ? fw * 1.3 + 8 : 24;
        x0 = Infinity; x1 = -Infinity; y0 = Infinity; y1 = -Infinity;
        for (const n of nodes) { x0 = Math.min(x0, n.x - Math.max(n.r, px)); x1 = Math.max(x1, n.x + Math.max(n.r, px)); y0 = Math.min(y0, n.y - n.r - top); y1 = Math.max(y1, n.y + n.r + bottom); }
        k = Math.max(0.2, Math.min(allLabels ? 1 : 1.8, Math.min(W / (x1 - x0), H / (y1 - y0))));
      }
      return { x: -((x0 + x1) / 2) * k, y: -((y0 + y1) / 2) * k, k };
    };
    const fit = (instant) => animateTo(fitGoal(), instant);
    const centerOn = (n) => animateTo({ x: -n.x * Math.max(cam.k, 1.2), y: -n.y * Math.max(cam.k, 1.2), k: Math.max(cam.k, 1.2) });

    // 指针
    const local = (ev) => { const r = svg.getBoundingClientRect(), s = r.width / (svg.clientWidth || r.width) || 1; return [(ev.clientX - r.left) / s, (ev.clientY - r.top) / s]; };
    const toWorld = ([sx, sy]) => [(sx - W / 2 - cam.x) / cam.k, (sy - H / 2 - cam.y) / cam.k];
    const zoomAt = ([sx, sy], f) => {
      root.cancelAnimationFrame(anim);
      const k = Math.max(0.2, Math.min(4, cam.k * f)), [wx, wy] = toWorld([sx, sy]);
      cam.k = k; cam.x = sx - W / 2 - wx * k; cam.y = sy - H / 2 - wy * k; applyCam();
    };
    const select = (id) => { if (id && typeof opts.onSelect === 'function') opts.onSelect(id); };
    const ptr = new Map();
    let drag = null, pinch = null, moved = 0;
    const onDown = (ev) => {
      if (ev.button > 0) return;
      try { svg.setPointerCapture(ev.pointerId); } catch { /* 已经离开 */ }
      ptr.set(ev.pointerId, local(ev));
      moved = 0;
      if (ptr.size === 2) { const [a, b] = [...ptr.values()]; pinch = { d: Math.hypot(a[0] - b[0], a[1] - b[1]) || 1, k: cam.k }; if (drag && drag.node) drag.node.fixed = false; drag = null; return; }
      const g = ev.target.closest && ev.target.closest('.lg-kn');
      const p = local(ev);
      if (g) { const n = N.get(g.dataset.id); n.fixed = true; drag = { node: n, p }; }
      else drag = { pan: true, p, cx: cam.x, cy: cam.y };
    };
    const onMove = (ev) => {
      const p = local(ev);
      if (ptr.has(ev.pointerId)) ptr.set(ev.pointerId, p);
      if (pinch && ptr.size === 2) {
        const [a, b] = [...ptr.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]) || 1;
        zoomAt([(a[0] + b[0]) / 2, (a[1] + b[1]) / 2], (pinch.k * d / pinch.d) / cam.k); return;
      }
      if (!drag) {
        const g = ev.target.closest && ev.target.closest('.lg-kn'), id = g ? g.dataset.id : null;
        if (id !== hover) { hover = id; lit(); svg.style.cursor = id ? 'pointer' : ''; }
        return;
      }
      moved += Math.abs(p[0] - drag.p[0]) + Math.abs(p[1] - drag.p[1]);
      if (drag.pan) { cam.x = drag.cx + p[0] - drag.p[0]; cam.y = drag.cy + p[1] - drag.p[1]; applyCam(); svg.classList.add('lg-panning'); return; }
      if (moved > 3) { const [wx, wy] = toWorld(p); drag.node.x = wx; drag.node.y = wy; drag.node.vx = drag.node.vy = 0; svg.classList.add('lg-dragging'); reheat(0.3); draw(); }
      drag.p = p;
    };
    const onEnd = (ev) => {
      ptr.delete(ev.pointerId);
      if (ptr.size < 2) pinch = null;
      if (!drag) return;
      const d = drag; drag = null; svg.classList.remove('lg-panning', 'lg-dragging');
      if (d.node) { d.node.fixed = false; remember(); }
      if (moved <= 4 && ev.type === 'pointerup') {
        if (d.node) { picked = d.node.id; lit(); select(d.node.id); }
        else if (picked) { picked = null; lit(); if (typeof opts.onClear === 'function') opts.onClear(); }
      }
    };
    const onLeave = () => { if (!drag && hover) { hover = null; lit(); } };
    const onWheel = (ev) => { ev.preventDefault(); zoomAt(local(ev), Math.exp(-Math.max(-60, Math.min(60, ev.deltaY)) * 0.0035)); };
    const onKey = (ev) => {
      const g = ev.target.closest && ev.target.closest('.lg-kn');
      if (g && (ev.key === 'Enter' || ev.key === ' ')) { ev.preventDefault(); picked = g.dataset.id; lit(); select(picked); return; }
      if (ev.key === '+' || ev.key === '=') { ev.preventDefault(); zoomAt([W / 2, H / 2], 1.25); }
      else if (ev.key === '-') { ev.preventDefault(); zoomAt([W / 2, H / 2], 1 / 1.25); }
      else if (ev.key === 'Escape' && picked) { picked = null; lit(); if (typeof opts.onClear === 'function') opts.onClear(); }
    };
    const onFocusIn = (ev) => { const g = ev.target.closest && ev.target.closest('.lg-kn'); if (g) { hover = g.dataset.id; lit(); } };
    const onFocusOut = () => { if (hover) { hover = null; lit(); } };
    svg.addEventListener('pointerdown', onDown);
    svg.addEventListener('pointermove', onMove);
    svg.addEventListener('pointerup', onEnd);
    svg.addEventListener('pointercancel', onEnd);
    svg.addEventListener('pointerleave', onLeave);
    svg.addEventListener('wheel', onWheel, { passive: false });
    svg.addEventListener('keydown', onKey);
    svg.addEventListener('focusin', onFocusIn);
    svg.addEventListener('focusout', onFocusOut);
    zoomBox.addEventListener('click', (ev) => {
      const z = ev.target.closest('[data-z]'); if (!z) return;
      if (z.dataset.z === 'fit') fit(); else zoomAt([W / 2, H / 2], z.dataset.z === 'in' ? 1.3 : 1 / 1.3);
    });

    // 启动：先在后台算一段（有时间上限，400 个节点也不卡），剩下的边动边算
    const t0 = root.performance.now();
    const budget = reducedMotion() ? 400 : 160;
    for (let i = 0; i < 320 && alpha > 0.02; i++) { tick(); if (root.performance.now() - t0 > budget) break; }
    if (reducedMotion()) alpha = 0;
    resize(); draw(); fit(true); lit(); relabel(true);
    if (opts.highlight) setHighlight(opts.highlight);
    if (alpha > 0.02) {
      // 后面的移动让镜头跟一次，避免停下来时偏到一边
      run();
      const t = root.setTimeout(() => { if (!dead) fit(); }, 900);
      api._t = t;
    } else remember();
    let ro = null;
    if ('ResizeObserver' in root) {
      ro = new root.ResizeObserver(() => { const w0 = W, h0 = H; resize(); if (Math.abs(w0 - W) > 40 || Math.abs(h0 - H) > 40) fit(true); });
      ro.observe(svg);
    }

    api.destroy = () => {
      dead = true;
      root.cancelAnimationFrame(raf); root.cancelAnimationFrame(anim); root.clearTimeout(lblT);
      if (api._t) root.clearTimeout(api._t);
      if (ro) ro.disconnect();
      remember();
      while (container.firstChild) container.removeChild(container.firstChild);
      container.classList.remove('lg-kg');
    };
    api.focus = (id) => {
      id = id == null ? null : String(id);
      picked = id && N.has(id) ? id : null;
      lit();
      if (picked) centerOn(N.get(picked));
    };
    api.setHighlight = setHighlight;
    api.fit = () => fit();
    api.svg = svg;
    return api;
  }

  // ── AI 给的示意图 ─────────────────────────────────────────────────────
  // diagram = {nodes:[{id,label}], edges:[{from,to,label?}]}（已经过 learn-core 的 parseDiagram 校验；这里再防一次）。
  const D = { font: 12.5, lh: 16, padX: 10, padY: 8, margin: 12, maxW: 168, minW: 64 };
  function diagram(container, dg, opts) {
    opts = opts || {};
    if (!container) return null;
    const lang = opts.lang;
    const nodes = [];
    const byId = new Map();
    for (const r of (dg && Array.isArray(dg.nodes) ? dg.nodes : []).slice(0, 24)) {
      if (!r || r.id == null || byId.has(String(r.id))) continue;
      const n = { id: String(r.id), label: str(r.label) || String(r.id) };
      nodes.push(n); byId.set(n.id, n);
    }
    const edges = [];
    for (const e of (dg && Array.isArray(dg.edges) ? dg.edges : []).slice(0, 40)) {
      if (!e || !byId.has(String(e.from)) || !byId.has(String(e.to))) continue;
      edges.push({ a: byId.get(String(e.from)), b: byId.get(String(e.to)), label: str(e.label) });
    }
    while (container.firstChild) container.removeChild(container.firstChild);
    if (!nodes.length) return null;
    container.classList.add('lg-diagram');
    container.setAttribute('translate', 'no');

    const ids = nodes.map((n) => n.id);
    const deps = new Map(ids.map((id) => [id, []]));
    for (const e of edges) if (e.a !== e.b) deps.get(e.b.id).push(e.a.id);
    const lay = layerize(ids, deps);
    const cols = columns(ids, lay);
    for (const n of nodes) n.layer = lay[n.id].layer;
    const cw = widthOf(container);
    const maxPer = Math.max(...cols.map((c) => c.length));

    // 节点尺寸跟着文字
    const size = (maxW) => {
      for (const n of nodes) {
        n.lines = wrap(n.label, (maxW - 2 * D.padX) / D.font, 3);
        n.w = Math.max(D.minW, Math.min(maxW, Math.max(...n.lines.map(textW)) * D.font + 2 * D.padX + 2));
        n.h = n.lines.length * D.lh + 2 * D.padY;
      }
    };
    const hasLabels = edges.some((e) => e.label);
    const labW = Math.max(0, ...edges.map((e) => (e.label ? textW(clip(e.label, 12)) * 11 : 0)));
    const gapH = hasLabels ? Math.max(56, Math.min(140, labW + 34)) : 44;
    size(D.maxW);
    const colW = cols.map((c) => Math.max(...c.map((id) => byId.get(id).w)));
    const wideW = colW.reduce((s, w) => s + w, 0) + (cols.length - 1) * gapH + 2 * D.margin;
    const wide = cw >= PLAN_BREAK && wideW <= cw * 1.05;
    if (!wide) {
      const maxW = Math.max(D.minW + 16, Math.min(D.maxW, (cw - 2 * D.margin - (maxPer - 1) * 14) / maxPer));
      size(maxW);
    }

    let W, H;
    if (wide) {
      const gapV = 16;
      const colH = cols.map((c) => c.reduce((s, id) => s + byId.get(id).h, 0) + (c.length - 1) * gapV);
      H = Math.max(...colH) + 2 * D.margin + (hasLabels ? 10 : 0);
      W = wideW;
      let x = D.margin;
      cols.forEach((c, L) => {
        let y = (H - colH[L]) / 2;
        for (const id of c) { const n = byId.get(id); n.x = x + colW[L] / 2; n.y = y + n.h / 2; y += n.h + gapV; }
        x += colW[L] + gapH;
      });
    } else {
      const gapX = 14, gapV = hasLabels ? 50 : 34;
      const rowH = cols.map((c) => Math.max(...c.map((id) => byId.get(id).h)));
      const rowW = cols.map((c) => c.reduce((s, id) => s + byId.get(id).w, 0) + (c.length - 1) * gapX);
      W = Math.max(...rowW) + 2 * D.margin;
      H = rowH.reduce((s, h) => s + h, 0) + (cols.length - 1) * gapV + 2 * D.margin;
      let y = D.margin;
      cols.forEach((c, L) => {
        let x = (W - rowW[L]) / 2;
        for (const id of c) { const n = byId.get(id); n.x = x + n.w / 2; n.y = y + rowH[L] / 2; x += n.w + gapX; }
        y += rowH[L] + gapV;
      });
    }

    // 回边（环、同层或反向）绕到图的外侧：横排走上方，竖排走右侧，先留出边距
    const isBack = (e) => lay[e.a.id].layer >= lay[e.b.id].layer;
    const backN = edges.filter((e) => e.a !== e.b && isBack(e)).length;
    const room = backN ? 24 + 12 * Math.min(backN, 4) : 0;
    if (wide) { for (const n of nodes) n.y += room; H += room; } else W += room;
    const outer = wide ? Math.min(...nodes.map((n) => n.y - n.h / 2)) : Math.max(...nodes.map((n) => n.x + n.w / 2));

    const svg = el('svg', { class: 'lg-dg-svg', viewBox: `0 0 ${f1(W)} ${f1(H)}`, width: f1(W), height: f1(H), role: 'img', preserveAspectRatio: 'xMidYMin meet' }, container);
    const summary = nodes.map((n) => n.label).join(', ');
    const tt = el('title', null, svg);
    tt.textContent = T(lang, '示意图：', 'Diagram: ') + summary;
    const mid = 'lg-darr-' + nextUid();
    const defs = el('defs', null, svg);
    const m = el('marker', { id: mid, class: 'lg-arrow', viewBox: '0 0 10 10', refX: 9, refY: 5, markerWidth: 7, markerHeight: 7, orient: 'auto', markerUnits: 'userSpaceOnUse' }, defs);
    el('path', { d: 'M0 0L10 5L0 10z' }, m);

    // 边：从框的边缘出发，到框的边缘为止（射线和矩形求交）
    const edgePt = (n, tx, ty, pad) => {
      const dx = tx - n.x, dy = ty - n.y;
      if (!dx && !dy) return [n.x, n.y];
      const sx = (n.w / 2 + pad) / Math.abs(dx || 1e-9), sy = (n.h / 2 + pad) / Math.abs(dy || 1e-9);
      const s = Math.min(sx, sy);
      return [n.x + dx * s, n.y + dy * s];
    };
    const gE = el('g', { class: 'lg-dg-edges' }, svg);
    const gL = el('g', { class: 'lg-dg-elabels' }, svg);
    const pairCount = new Map();
    let backSeen = 0;
    for (const e of edges) {
      if (e.a === e.b) continue;
      const key = [e.a.id, e.b.id].sort().join('\u0000');
      const k = pairCount.get(key) || 0; pairCount.set(key, k + 1);
      let d, lx, ly;
      if (isBack(e)) {
        const bi = backSeen++, off = 18 + 12 * Math.min(bi, 3);
        if (wide) {
          const x1 = e.a.x, y1 = e.a.y - e.a.h / 2, x2 = e.b.x, y2 = e.b.y - e.b.h / 2 - 1.5, cy = outer - off;
          d = `M${f1(x1)} ${f1(y1)}C${f1(x1)} ${f1(cy)} ${f1(x2)} ${f1(cy)} ${f1(x2)} ${f1(y2)}`;
          lx = (x1 + x2) / 2; ly = (y1 + y2) / 8 + (cy * 3) / 4;
        } else {
          const x1 = e.a.x + e.a.w / 2, y1 = e.a.y, x2 = e.b.x + e.b.w / 2 + 1.5, y2 = e.b.y, cx = outer + off;
          d = `M${f1(x1)} ${f1(y1)}C${f1(cx)} ${f1(y1)} ${f1(cx)} ${f1(y2)} ${f1(x2)} ${f1(y2)}`;
          lx = (x1 + x2) / 8 + (cx * 3) / 4; ly = (y1 + y2) / 2;
        }
      } else {
        const [x1, y1] = edgePt(e.a, e.b.x, e.b.y, 0);
        const [x2, y2] = edgePt(e.b, e.a.x, e.a.y, 1.5);
        if (k > 0) {
          const mx = (x1 + x2) / 2, my = (y1 + y2) / 2, dx = x2 - x1, dy = y2 - y1, L = Math.hypot(dx, dy) || 1;
          const bend = (24 + 14 * k) * (k % 2 ? -1 : 1);
          const cx = mx - (dy / L) * bend, cy = my + (dx / L) * bend;
          d = `M${f1(x1)} ${f1(y1)}Q${f1(cx)} ${f1(cy)} ${f1(x2)} ${f1(y2)}`;
          lx = (x1 + 2 * cx + x2) / 4; ly = (y1 + 2 * cy + y2) / 4;
        } else {
          d = `M${f1(x1)} ${f1(y1)}L${f1(x2)} ${f1(y2)}`;
          lx = (x1 + x2) / 2; ly = (y1 + y2) / 2;
        }
      }
      el('path', { class: 'lg-dg-edge', d, 'marker-end': `url(#${mid})` }, gE);
      if (e.label) {
        const t = el('text', { class: 'lg-dg-elabel', x: f1(lx), y: f1(ly), 'text-anchor': 'middle', 'dominant-baseline': 'central' }, gL);
        t.textContent = clip(e.label, 12);
        if (t.textContent !== e.label) el('title', null, t).textContent = e.label;
      }
    }
    const gN = el('g', { class: 'lg-dg-nodes' }, svg);
    for (const n of nodes) {
      const g = el('g', { class: 'lg-dn', transform: `translate(${f1(n.x)} ${f1(n.y)})` }, gN);
      el('rect', { x: f1(-n.w / 2), y: f1(-n.h / 2), width: f1(n.w), height: f1(n.h), rx: 7 }, g);
      const t = multiText(g, n.lines, { x: 0, y: 0, lh: D.lh, cls: 'lg-dlabel' });
      t.setAttribute('text-anchor', 'middle');
      t.setAttribute('dominant-baseline', 'central');
      if (n.lines.join(' ').replace('…', '') !== n.label) el('title', null, g).textContent = n.label;
    }
    // 边的文字画在节点上面，所以把文字层移到最后
    svg.appendChild(gL);

    watch(container, wide, { key: () => { const w = widthOf(container); return w >= PLAN_BREAK && wideW <= w * 1.05; }, draw: () => diagram(container, dg, opts) });
    return svg;
  }

  const API = { planMap, knowledgeGraph, diagram, statusText, layerize, wrap };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.MOLASTRIA_LEARN_GRAPH = API;
})(typeof globalThis !== 'undefined' ? globalThis : this);
