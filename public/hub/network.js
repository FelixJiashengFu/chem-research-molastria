/* MolAstria 网状查询：节点/连线全部由 data.json 真实条目计算，点节点跨库查询 */
const TYPE_LABEL = {tutorial:"深度教程", qa:"论坛帖", discipline:"学科频道", tool:"平台工具",
  software:"软件/官网", archive:"邮件归档", resource:"资源索引", job:"学术招聘", conference:"学术会议", announcement:"公告",
  preprint:"预印本", paper:"期刊论文", repo:"开源仓库", database:"数据库"};
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const KIND_LABEL = {hub:"中心枢纽", source:"数据源", tag:"主题", category:"数据库分类", db:"数据库/官网"};
const itemSources = (it) => [...new Set(it.sourceIds?.length ? it.sourceIds : [it.source])];
const fromSource = (it, id) => itemSources(it).includes(id);
const isOfficial = (it) => it.source === "resdir" || (it.origins || []).includes("atlas");
const PRESETS = ["Multiwfn", "ORCA", "VASP", "Gaussian", "分子动力学", "静电势", "基组", "机器学习", "LAMMPS", "激发态"];

let DATA = null, ITEMS = [], SOURCES = [];
let nodes = [], edges = [], nodeById = new Map(), neighbors = new Map();
let selected = null, queryText = "", sourceFilter = "", kindFilter = "";
let resultList = [], shown = 40;
let view = {x: 0, y: 0, k: 1};
let matchedNodes = new Set();
let simRunning = !window.matchMedia("(prefers-reduced-motion: reduce)").matches, dragNode = null, dragBg = null, hoverNode = null, moved = false;

/* ---------- 数据 -> 网 ----------
   节点：枢纽 / 合并后的来源 / Top24 主题 / 资源分类 / 数据库与软件官网
   连线：枢纽-来源、来源-主题(按条目数加权)、主题共现、分类-数据库、来源-分类 */
function buildGraph(){
  nodes = []; edges = []; nodeById = new Map(); neighbors = new Map();
  const addNode = (n) => { nodes.push(n); nodeById.set(n.id, n); neighbors.set(n.id, new Set()); return n; };
  const addEdge = (a, b, w, kind) => {
    if (a === b || !nodeById.has(a) || !nodeById.has(b)) return;
    if (edges.some((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a))) {
      const old = edges.find((e) => (e.a === a && e.b === b) || (e.a === b && e.b === a));
      old.w = Math.max(old.w, w); return;
    }
    edges.push({a, b, w, kind}); neighbors.get(a).add(b); neighbors.get(b).add(a);
  };
  const addNodeRaw = addNode;
  addNodeRaw({id:"hub", kind:"hub", label:"MolAstria", sub:"全部真实条目", count:ITEMS.length, color:"#a67d42", r:26});

  const srcCount = {};
  ITEMS.forEach((i) => itemSources(i).forEach((id) => srcCount[id] = (srcCount[id] || 0) + 1));
  for (const s of SOURCES)
    addNode({id:"src:" + s.id, kind:"source", label:s.name, sub:s.statusLabel || s.status, count:srcCount[s.id] || 0,
      color:s.color || "#7d8a80", sourceId:s.id, url:s.url || "", r:15 + Math.min(13, Math.sqrt(srcCount[s.id] || 0))});

  const tagCount = {};
  ITEMS.forEach((i) => (i.tags || []).forEach((t) => tagCount[t] = (tagCount[t] || 0) + 1));
  const topTags = Object.entries(tagCount).sort((a,b) => b[1] - a[1]).slice(0, 24).map((e) => e[0]);
  for (const t of topTags)
    addNode({id:"tag:" + t, kind:"tag", label:t, sub:"主题标签", count:tagCount[t], color:"#6e5aa8", tag:t,
      r:9 + Math.min(11, Math.sqrt(tagCount[t]) * 0.75)});

  const officials = ITEMS.filter(isOfficial);
  const cats = [...new Set(officials.map((i) => i.category || "未分类"))];
  for (const c of cats)
    addNode({id:"cat:" + c, kind:"category", label:c, sub:"数据库分类",
      count:officials.filter((i) => (i.category || "未分类") === c).length, color:"#2f7d8c", category:c, r:14});
  for (const it of officials)
    addNode({id:"db:" + it.id, kind:"db", label:it.title, sub:it.category || "", count:1, color:"#3f8a4f",
      item:it, url:it.url, category:it.category || "未分类",
      r:10 + Math.min(5, String(it.title).length * 0.25)});

  for (const s of SOURCES) addEdge("hub", "src:" + s.id, 3, "hub");
  // 来源-主题：每源取自家最强的 6 个标签
  for (const s of SOURCES){
    const c = {};
    ITEMS.filter((i) => fromSource(i, s.id)).forEach((i) => (i.tags || []).forEach((t) => {
      if (topTags.includes(t)) c[t] = (c[t] || 0) + 1;
    }));
    Object.entries(c).sort((a,b) => b[1] - a[1]).slice(0, 6)
      .forEach(([t, n]) => addEdge("src:" + s.id, "tag:" + t, n, "source-tag"));
  }
  // 主题共现：同一条目内共同出现，>=5 次才连，上限 50 条最强
  const co = new Map();
  for (const it of ITEMS){
    const ts = [...new Set((it.tags || []).filter((t) => topTags.includes(t)))];
    for (let i = 0; i < ts.length; i++) for (let j = i + 1; j < ts.length; j++){
      const k = ts[i] + "||" + ts[j]; co.set(k, (co.get(k) || 0) + 1);
    }
  }
  [...co.entries()].filter((e) => e[1] >= 5).sort((a,b) => b[1] - a[1]).slice(0, 50)
    .forEach(([k, n]) => { const [a, b] = k.split("||"); addEdge("tag:" + a, "tag:" + b, n, "co"); });
  // 分类与数据库
  for (const source of SOURCES){
    const sourceOfficials = officials.filter((it) => fromSource(it, source.id));
    for (const category of cats){
      const count = sourceOfficials.filter((it) => (it.category || "未分类") === category).length;
      if (count) addEdge("src:" + source.id, "cat:" + category, count, "source-cat");
    }
  }
  for (const it of officials) addEdge("cat:" + (it.category || "未分类"), "db:" + it.id, 2, "cat-db");
  // 数据库官网若自身标题命中某主题标签，连一条（如 ORCA -> ORCA 主题）
  for (const it of officials){
    for (const t of topTags){
      if (it.title.toLowerCase() === t.toLowerCase() || (it.tags || []).includes(t))
        addEdge("db:" + it.id, "tag:" + t, 2, "db-tag");
    }
  }
  layoutInitial();
}

function layoutInitial(){
  const c = $("graph"); const W = c.clientWidth || 900, H = c.clientHeight || 680;
  const cx = W / 2, cy = H / 2;
  const ring = (list, radius, start) => list.forEach((n, i) => {
    const a = start + i / Math.max(1, list.length) * Math.PI * 2;
    n.x = cx + Math.cos(a) * radius; n.y = cy + Math.sin(a) * radius * 0.82; n.vx = 0; n.vy = 0;
  });
  const hub = nodeById.get("hub"); if (hub){ hub.x = cx; hub.y = cy; hub.vx = hub.vy = 0; }
  ring(nodes.filter((n) => n.kind === "source"), 190, -Math.PI / 2);
  ring(nodes.filter((n) => n.kind === "tag"), 330, -Math.PI / 2 + 0.2);
  ring(nodes.filter((n) => n.kind === "category"), 255, -Math.PI / 2 + 0.5);
  ring(nodes.filter((n) => n.kind === "db"), 415, -Math.PI / 2 + 0.1);
}

/* ---------- 力导向模拟（原生 Canvas，O(n^2) 斥力，仅模拟目录与主题节点） ---------- */
function step(){
  const ns = visibleNodes();
  for (let i = 0; i < ns.length; i++) for (let j = i + 1; j < ns.length; j++){
    const a = ns[i], b = ns[j];
    let dx = a.x - b.x, dy = a.y - b.y; let d2 = dx * dx + dy * dy;
    if (d2 < 1){ dx = (i - j) || 1; dy = 1; d2 = 2; }
    const f = 5200 / d2; const d = Math.sqrt(d2);
    a.vx += dx / d * f; a.vy += dy / d * f; b.vx -= dx / d * f; b.vy -= dy / d * f;
  }
  for (const e of edges){
    const a = nodeById.get(e.a), b = nodeById.get(e.b);
    if (!a || !b || !isVisible(a) || !isVisible(b)) continue;
    const dx = b.x - a.x, dy = b.y - a.y; const d = Math.max(20, Math.hypot(dx, dy));
    const rest = e.kind === "hub" ? 190 : e.kind === "co" ? 150 : 120;
    const f = (d - rest) * 0.012;
    a.vx += dx / d * f * d * 0.02; a.vy += dy / d * f * d * 0.02;
    b.vx -= dx / d * f * d * 0.02; b.vy -= dy / d * f * d * 0.02;
  }
  const c = $("graph"); const cx = (c.clientWidth || 900) / 2, cy = (c.clientHeight || 680) / 2;
  for (const n of ns){
    if (n === dragNode) continue;
    n.vx += (cx - n.x) * 0.0012; n.vy += (cy - n.y) * 0.0012;
    n.vx *= 0.86; n.vy *= 0.86;
    n.x += Math.max(-14, Math.min(14, n.vx)); n.y += Math.max(-14, Math.min(14, n.vy));
  }
}
function isVisible(n){ return !kindFilter || n.kind === kindFilter || n.kind === "hub"; }
function visibleNodes(){ return nodes.filter(isVisible); }

/* 画布颜色取自全站 CSS 变量，切换浅色/深色时重新读取。 */
const THEME = {};
function readTheme(){
  const css = getComputedStyle(document.documentElement), v = (name) => css.getPropertyValue(name).trim();
  Object.assign(THEME, {edge: v("--graph-edge") || "rgba(60,90,70,0.18)", edgeHot: v("--accent-2") || "#4b704f",
    match: v("--gold") || "#a67d42", selected: v("--ink") || "#1c3a2f", ring: v("--surface") || "#fdfcf8",
    label: v("--ink") || "#1c3a2f", halo: v("--paper") || "#f6f5ee", count: "#ffffff"});
}
readTheme();
document.addEventListener("chemhub:theme", readTheme);
function draw(){
  const c = $("graph"), ctx = c.getContext("2d");
  const W = c.clientWidth, H = c.clientHeight; if (!W) return;
  const dpr = Math.min(2, window.devicePixelRatio || 1);
  if (c.width !== W * dpr || c.height !== H * dpr){ c.width = W * dpr; c.height = H * dpr; }
  ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, W, H);
  ctx.save(); ctx.translate(view.x, view.y); ctx.scale(view.k, view.k);
  const active = new Set();
  if (selected){ active.add(selected.id); (neighbors.get(selected.id) || []).forEach((x) => active.add(x)); }
  const q = queryText.trim().toLowerCase();
  for (const e of edges){
    const a = nodeById.get(e.a), b = nodeById.get(e.b);
    if (!a || !b || !isVisible(a) || !isVisible(b)) continue;
    const hot = selected && (e.a === selected.id || e.b === selected.id);
    ctx.strokeStyle = hot ? THEME.edgeHot : THEME.edge;
    ctx.lineWidth = hot ? 2.2 : Math.min(3, 0.5 + Math.log10(e.w + 1));
    ctx.globalAlpha = selected && !hot ? 0.25 : 1;
    ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke();
  }
  ctx.globalAlpha = 1;
  for (const n of visibleNodes()){
    const dim = selected && !active.has(n.id);
    const match = q && matchedNodes.has(n.id);
    ctx.globalAlpha = dim ? 0.28 : 1;
    ctx.beginPath(); ctx.arc(n.x, n.y, n.r, 0, Math.PI * 2);
    ctx.fillStyle = n.color; ctx.fill();
    ctx.lineWidth = (selected && selected.id === n.id) || match ? 3.4 : 1.4;
    ctx.strokeStyle = match ? THEME.match : (selected && selected.id === n.id ? THEME.selected : THEME.ring);
    ctx.stroke();
    ctx.fillStyle = THEME.label; ctx.font = (n.kind === "source" || n.kind === "hub" ? "700 " : "") + "12px 'Segoe UI','Microsoft YaHei',sans-serif";
    ctx.textAlign = "center";
    const label = n.label.length > 16 ? n.label.slice(0, 15) + "…" : n.label;
    ctx.lineWidth = 3; ctx.strokeStyle = THEME.halo; ctx.lineJoin = "round";
    ctx.strokeText(label, n.x, n.y + n.r + 15);
    ctx.fillText(label, n.x, n.y + n.r + 15);
    if (n.kind === "source" || n.kind === "tag")
      { ctx.fillStyle = THEME.count; ctx.font = "10px sans-serif"; ctx.fillText(String(n.count), n.x, n.y + 4); }
  }
  ctx.restore(); ctx.globalAlpha = 1;
}
function loop(){ if (simRunning) step(); draw(); requestAnimationFrame(loop); }

function toWorld(ev){
  const r = $("graph").getBoundingClientRect();
  return {x: (ev.clientX - r.left - view.x) / view.k, y: (ev.clientY - r.top - view.y) / view.k,
          sx: ev.clientX - r.left, sy: ev.clientY - r.top};
}
function pick(p){ let best = null, bd = 1e9;
  for (const n of visibleNodes()){ const d = Math.hypot(n.x - p.x, n.y - p.y); if (d < n.r + 7 && d < bd){ bd = d; best = n; } }
  return best;
}
function bindGraph(){
  const c = $("graph"), tip = $("tooltip");
  c.addEventListener("pointerdown", (ev) => {
    moved = false; const p = toWorld(ev); const n = pick(p);
    if (n){ dragNode = n; n.vx = n.vy = 0; } else dragBg = {x: ev.clientX, y: ev.clientY, vx: view.x, vy: view.y};
    c.setPointerCapture(ev.pointerId);
  });
  c.addEventListener("pointermove", (ev) => {
    const p = toWorld(ev);
    if (dragNode){ moved = true; dragNode.x = p.x; dragNode.y = p.y; dragNode.vx = dragNode.vy = 0; return; }
    if (dragBg){ moved = true; view.x = dragBg.vx + ev.clientX - dragBg.x; view.y = dragBg.vy + ev.clientY - dragBg.y; return; }
    const n = pick(p); hoverNode = n; c.style.cursor = n ? "pointer" : "grab";
    if (n){
      tip.hidden = false;
      tip.innerHTML = "<b>" + esc(n.label) + "</b> · " + esc(KIND_LABEL[n.kind] || n.kind) + "<br>" +
        esc(n.sub || "") + (n.count ? " · 关联/包含 " + n.count + " 条" : "") + "<br><span style='color:var(--muted)'>单击查询 · 拖动挪位</span>";
      tip.style.left = Math.max(8, Math.min(c.clientWidth - 290, p.sx + 16)) + "px"; tip.style.top = (p.sy + 14) + "px";
    } else tip.hidden = true;
  });
  const up = (ev) => {
    if (dragNode && !moved) selectNode(dragNode);
    else if (dragNode && moved) { /* 拖动结束，不触发查询 */ }
    else if (!dragNode && !moved && dragBg) { /* 点空白不取消选择，避免误触 */ }
    dragNode = null; dragBg = null;
  };
  c.addEventListener("pointerup", up); c.addEventListener("pointercancel", up);
  c.addEventListener("pointerleave", () => { tip.hidden = true; });
  c.addEventListener("dblclick", () => { view = {x: 0, y: 0, k: 1}; });
  c.addEventListener("wheel", (ev) => {
    ev.preventDefault(); const p = toWorld(ev);
    const k2 = Math.max(0.35, Math.min(2.6, view.k * (ev.deltaY < 0 ? 1.1 : 0.9)));
    view.x = p.sx - p.x * k2; view.y = p.sy - p.y * k2; view.k = k2;
  }, {passive: false});
  window.addEventListener("resize", () => draw());
}

/* ---------- 查询逻辑（跨库） ---------- */
function itemHay(it){
  return (it.title + " " + (it.excerpt || "") + " " + (it.category || "") + " " +
    (it.tags || []).join(" ") + " " + (it.authors || "") + " " + (it.metric || "")).toLowerCase();
}
function nodeMatchesQuery(n, q){
  if (n.label.toLowerCase().includes(q)) return true;
  return nodeItems(n, "").some((it) => itemHay(it).includes(q));
}
function nodeItems(n, q){
  let list = [];
  if (!n || n.kind === "hub") list = ITEMS.slice();
  else if (n.kind === "source") list = ITEMS.filter((i) => fromSource(i, n.sourceId));
  else if (n.kind === "tag") list = ITEMS.filter((i) => (i.tags || []).includes(n.tag));
  else if (n.kind === "category") list = ITEMS.filter((i) => isOfficial(i) && (i.category || "未分类") === n.category);
  else if (n.kind === "db"){
    const it = n.item; const key = it.title.toLowerCase();
    const related = ITEMS.filter((x) => x.id !== it.id &&
      (itemHay(x).includes(key) || (x.tags || []).some((t) => t.toLowerCase() === key)));
    list = [it, ...related];
  }
  if (sourceFilter) list = list.filter((i) => fromSource(i, sourceFilter));
  if (q) list = list.filter((i) => itemHay(i).includes(q));
  return list;
}
function selectNode(n){ selected = n; $("nodeSelect").value = n?.id || ""; refreshResults(); draw(); }
function refreshResults(){
  const q = queryText.trim().toLowerCase();
  resultList = nodeItems(selected, q);
  matchedNodes = q ? new Set(nodes.filter((n) => nodeMatchesQuery(n, q)).map((n) => n.id)) : new Set();
  $("nodeSelect").value = selected?.id || "";
  shown = 40; renderResults(q);
}
function renderResults(q){
  const sm = (id) => SOURCES.find((s) => s.id === id) || {name: id, color: "#7d8a80"};
  const what = selected ? (KIND_LABEL[selected.kind] + "「" + selected.label + "」") : "全部资源";
  $("resultTitle").textContent = "跨库查询结果 · " + what + (q ? " ∩ 关键词「" + queryText.trim() + "」" : "");
  $("selectedInfo").innerHTML = selected
    ? "当前选中：<b>" + esc(selected.label) + "</b>（" + esc(KIND_LABEL[selected.kind]) + "）" +
      (selected.sub ? " · " + esc(selected.sub) : "") +
      " · 命中 <b>" + resultList.length + "</b> 条真实条目。点结果卡片「原文」回原站；再点其它节点可换查询对象，清空关键词/重置可回到全网。"
    : "未选中节点：当前展示合并后全部 " + ITEMS.length + " 条资源。点图中节点、使用节点选择框，或输入关键词进行跨库查询。";
  const by = {};
  resultList.forEach((i) => itemSources(i).forEach((id) => by[id] = (by[id] || 0) + 1));
  $("breakdown").innerHTML = Object.entries(by).sort((a,b) => b[1] - a[1])
    .map(([id, n]) => '<span class="bd"><i style="display:inline-block;width:8px;height:8px;border-radius:3px;background:' +
      esc(sm(id).color) + ';margin-right:5px"></i>' + esc(sm(id).name) + " <b>" + n + "</b></span>").join("")
    || '<span class="bd">无命中来源</span>';
  const list = resultList.slice(0, shown);
  $("netResults").innerHTML = list.length ? list.map((it) => {
    const s = sm(it.source);
    const originLabel = (it.origins || []).includes("atlas") ? '<span class="type-badge">Atlas 资源目录</span>' : "";
    const meta = [it.date, it.metric || "", it.authors ? ("✎ " + it.authors) : "", it.category].filter(Boolean).map(esc).join(" · ");
    return '<article class="net-item"><div class="card-top">' +
      '<span class="src-badge" style="--sc:' + esc(s.color) + ";background:" + esc(s.color) + '">' + esc(s.name) + "</span>" +
      '<span class="type-badge">' + esc(TYPE_LABEL[it.type] || it.type) + "</span>" + originLabel + "</div>" +
      '<h4><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.title) + "</a></h4>" +
      "<p>" + esc(it.excerpt || "（原站未提供摘要，点原文阅读）") + "</p>" +
      '<div class="card-foot"><span>' + meta + '</span><a class="open-btn" href="' + esc(it.url) + '" target="_blank" rel="noopener">原文 ↗</a></div></article>';
  }).join("") : '<div class="empty">没有命中条目。换个关键词，或点图中的主题/来源节点试试。</div>';
  $("netMore").style.display = resultList.length > shown ? "" : "none";
  $("netMsg").textContent = "共 " + resultList.length + " 条 · 已显示 " + Math.min(shown, resultList.length) + " 条";
}

/* ---------- 数据库总表 ---------- */
function renderDirectory(){
  const officials = ITEMS.filter(isOfficial);
  const groups = {};
  officials.forEach((i) => { const c = i.category || "未分类"; (groups[c] = groups[c] || []).push(i); });
  let html = Object.entries(groups).map(([cat, list]) =>
    '<div class="db-group"><h3>' + esc(cat) + "（" + list.length + "）</h3><div class='db-table'>" +
    list.map((it) => '<div class="db-cell"><h4>' + esc(it.title) + '</h4><p>' + esc(it.excerpt || it.metric || "") + '</p>' +
      '<div class="db-actions"><button class="btn locate-btn" type="button" data-db="' + esc(it.id) + '">在网中定位</button>' +
      '<a class="btn primary" href="' + esc(it.url) + '" target="_blank" rel="noopener">访问官网 ↗</a></div></div>').join("") +
    "</div></div>").join("");
  html += '<div class="db-group"><h3>数据源入口（' + SOURCES.length + ' 个来源）</h3><div class="db-table">' +
    SOURCES.map((s) => {
      const n = ITEMS.filter((i) => fromSource(i, s.id)).length;
      return '<div class="db-cell"><h4>' + esc(s.name) + '</h4><p>' + esc(s.role) + " · " + n + " 条 · " + esc(s.statusLabel || s.status) + '</p>' +
        '<div class="db-actions"><button class="btn locate-src" type="button" data-src="' + esc(s.id) + '">在网中定位</button>' +
        (s.url ? '<a class="btn primary" href="' + esc(s.url) + '" target="_blank" rel="noopener">访问原站 ↗</a>' : "") + "</div></div>";
    }).join("") + "</div></div>";
  $("dbDirectory").innerHTML = html;
  document.querySelectorAll(".locate-btn").forEach((b) => b.addEventListener("click", () => {
    const n = nodeById.get("db:" + b.dataset.db); if (n){ selectNode(n);
      document.querySelector(".net-graph-panel").scrollIntoView({behavior:"smooth"}); }
  }));
  document.querySelectorAll(".locate-src").forEach((b) => b.addEventListener("click", () => {
    const n = nodeById.get("src:" + b.dataset.src); if (n){ selectNode(n);
      document.querySelector(".net-graph-panel").scrollIntoView({behavior:"smooth"}); }
  }));
}

/* ---------- 初始化 ---------- */
function renderStats(){
  const officials = ITEMS.filter(isOfficial);
  const stats = [
    [SOURCES.length, "数据源"], [officials.length, "数据库 / 软件官网"],
    [ITEMS.length, "真实条目"], [nodes.length, "图中节点"], [edges.length, "真实关系连线"],
  ];
  $("netStats").innerHTML = stats.map(([v, l]) =>
    '<div class="stat"><b>' + esc(v) + "</b><span>" + esc(l) + "</span></div>").join("");
}
async function load(){
  DATA = window.CHEMRESEARCH_DATA;
  if (!DATA || !Array.isArray(DATA.items) || !Array.isArray(DATA.sources))
    throw new Error("缺少合并资源数据，请完整解压压缩包后打开");
  ITEMS = DATA.items; SOURCES = DATA.sources;
  $("generatedAt").textContent = "数据生成：" + new Date(DATA.generatedAt).toLocaleString("zh-CN");
  $("netSource").innerHTML = '<option value="">全部来源</option>' +
    SOURCES.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>").join("");
  $("presetChips").innerHTML = PRESETS.map((p) => '<button class="chip preset" type="button" data-q="' + esc(p) + '">' + esc(p) + "</button>").join("");
  document.querySelectorAll(".preset").forEach((b) => b.addEventListener("click", () => {
    selected = null; queryText = b.dataset.q; $("netQ").value = queryText; refreshResults(); draw();
    document.querySelector(".net-results-panel").scrollIntoView({behavior:"smooth", block:"nearest"});
  }));
  buildGraph(); renderStats(); renderDirectory();
  $("nodeSelect").innerHTML = '<option value="">全部资源</option>' + nodes.filter((n) => n.kind !== "hub")
    .map((n) => '<option value="' + esc(n.id) + '">' + esc(KIND_LABEL[n.kind] + ' · ' + n.label) + '</option>').join("");
  $("pauseBtn").textContent = simRunning ? "暂停布局" : "继续布局";
  // 支持 ?q=关键词 与 ?select=tag:Multiwfn 形式的深链（便于分享与验收）
  const params = new URLSearchParams(location.search);
  if (params.get("q")){ queryText = params.get("q"); $("netQ").value = queryText; }
  if (params.get("select") && nodeById.has(params.get("select"))) selected = nodeById.get(params.get("select"));
  refreshResults();
  bindGraph(); requestAnimationFrame(loop);
}
$("nodeSelect").addEventListener("change", (e) => selectNode(nodeById.get(e.target.value) || null));
$("netQ").addEventListener("input", (e) => { queryText = e.target.value; refreshResults(); draw(); });
$("netSource").addEventListener("change", (e) => { sourceFilter = e.target.value; refreshResults(); });
$("netKind").addEventListener("change", (e) => { kindFilter = e.target.value; draw(); });
$("netMore").addEventListener("click", () => { shown += 40; renderResults(queryText.trim().toLowerCase()); });
$("netReset").addEventListener("click", () => {
  selected = null; queryText = ""; sourceFilter = ""; kindFilter = "";
  $("netQ").value = ""; $("netSource").value = ""; $("netKind").value = ""; $("nodeSelect").value = "";
  view = {x: 0, y: 0, k: 1}; layoutInitial(); refreshResults(); draw();
});
$("pauseBtn").addEventListener("click", () => {
  simRunning = !simRunning; $("pauseBtn").textContent = simRunning ? "暂停布局" : "继续布局";
});
$("relayoutBtn").addEventListener("click", () => { layoutInitial(); simRunning = true; $("pauseBtn").textContent = "暂停布局"; });
load().catch((e) => {
  $("selectedInfo").textContent = "数据加载失败：" + e.message + "。请完整解压所有文件，再重新打开本页。";
  $("netResults").innerHTML = '<div class="empty">数据加载失败：' + esc(e.message) + "</div>";
});
