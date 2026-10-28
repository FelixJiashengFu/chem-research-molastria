/* ChemVis Hub 前端：纯原生 JS，数据来自 data.json（爬虫落盘的真实标题/摘要/链接） */
const TYPE_LABEL = {tutorial:"深度教程", qa:"论坛帖", discipline:"学科频道", tool:"平台工具",
  software:"软件/官网", archive:"邮件归档", resource:"资源索引", job:"学术招聘", conference:"学术会议", announcement:"公告",
  preprint:"预印本", paper:"期刊论文", repo:"开源仓库", database:"数据库"};
const state = { data:null, filtered:[], shown:24, q:"", source:"", type:"", tag:"", sort:"recent" };
const $ = (id) => document.getElementById(id);
const esc = (s) => String(s ?? "").replace(/[&<>"']/g, (c) => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
const sourceMeta = (id) => (state.data?.sources || []).find((s) => s.id === id) || {name:id, color:"#94a3b8", url:"#"};

function cardHTML(it){
  const sm = sourceMeta(it.source);
  const chips = (it.tags || []).map((t) => '<button class="chip" type="button" data-tag="' + esc(t) + '">' + esc(t) + "</button>").join("");
  const excerpt = it.excerpt
    ? '<p class="excerpt">' + esc(it.excerpt) + "</p>"
    : '<p class="excerpt">（原站未在目录页提供摘要，点「原文」阅读全文）</p>';
  const mirror = it.mirror ? '<div class="mirror-note">⇄ 经 Sobereva 官方目录交叉引用收录' +
    (it.sob_url ? ' · <a href="' + esc(it.sob_url) + '" target="_blank" rel="noopener">对应博文</a>' : "") + "</div>" : "";
  const meta = [it.date, it.metric || (it.views ? ("👁 " + it.views) : ""), it.authors ? ("✎ " + it.authors) : "", it.category].filter(Boolean).map(esc).join(" · ");
  return '<article class="card"><div class="card-top">' +
    '<span class="src-badge" style="--sc:' + esc(sm.color) + ';background:' + esc(sm.color) + '">' + esc(sm.name) + "</span>" +
    '<span class="type-badge">' + esc(TYPE_LABEL[it.type] || it.type) + "</span></div>" +
    '<h3><a href="' + esc(it.url) + '" target="_blank" rel="noopener">' + esc(it.title) + "</a></h3>" +
    excerpt + mirror +
    '<div class="chips">' + chips + "</div>" +
    '<div class="card-foot"><span>' + meta + '</span>' +
    '<a class="open-btn" href="' + esc(it.url) + '" target="_blank" rel="noopener">原文 ↗</a></div></article>';
}
function bindChips(root){
  root.querySelectorAll("[data-tag]").forEach((b) => b.addEventListener("click", () => {
    state.tag = b.dataset.tag; $("fTag").value = state.tag; state.shown = 24; applyFilters();
    document.getElementById("explore").scrollIntoView({behavior:"smooth"});
  }));
}
function renderCards(el, list){ el.innerHTML = list.length ? list.map(cardHTML).join("") : '<div class="empty">没有匹配的条目。换个关键词或清空筛选试试。</div>'; bindChips(el); }

/* ---------- 图表（内联 SVG / CSS 条形，全部由真实数据计算） ---------- */
function donut(bySource){
  const total = bySource.reduce((a,b) => a + b.count, 0) || 1;
  let acc = 0; const R = 62, C = 2 * Math.PI * R; const segs = [];
  for (const s of bySource){
    const frac = s.count / total; const dash = frac * C;
    segs.push('<circle cx="90" cy="90" r="' + R + '" fill="none" stroke="' + esc(s.color) + '" stroke-width="26" ' +
      'stroke-dasharray="' + dash.toFixed(1) + " " + C.toFixed(1) + '" stroke-dashoffset="' + (-acc * C).toFixed(1) + '" transform="rotate(-90 90 90)"/>');
    acc += frac;
  }
  $("donutChart").innerHTML = '<svg viewBox="0 0 180 180" width="190" height="190" role="img" aria-label="来源构成环形图">' +
    segs.join("") + '<text x="90" y="86" text-anchor="middle" fill="#e8eefc" font-size="26" font-weight="700">' + total + "</text>" +
    '<text x="90" y="108" text-anchor="middle" fill="#93a4c8" font-size="12">真实条目</text></svg>';
  $("donutLegend").innerHTML = bySource.map((s) =>
    '<span><i style="background:' + esc(s.color) + '"></i>' + esc(s.name) + " " + s.count + "</span>").join("");
}
function bars(el, rows){
  const max = Math.max(1, ...rows.map((r) => r.count));
  el.innerHTML = rows.map((r) =>
    '<div class="bar-row"><span class="name" title="' + esc(r.name) + '">' + esc(r.name) + '</span>' +
    '<span class="bar-track"><span class="bar-fill" style="display:block;width:' + (r.count / max * 100).toFixed(1) + '%"></span></span>' +
    '<span class="num">' + r.count + "</span></div>").join("") || '<p class="muted">暂无数据</p>';
}
function histogram(items){
  const buckets = Array.from({length:10}, (_,i) => ({name: (i*100+1) + "–" + (i+1)*100, count:0}));
  for (const it of items){ if (it.sob_id){ const b = Math.min(9, Math.floor((it.sob_id - 1) / 100)); buckets[b].count++; } }
  const max = Math.max(1, ...buckets.map((b) => b.count)); const W = 460, H = 170, bw = W / buckets.length;
  const rects = buckets.map((b,i) => {
    const h = b.count / max * (H - 34);
    return '<rect x="' + (i*bw + 5).toFixed(1) + '" y="' + (H - 20 - h).toFixed(1) + '" width="' + (bw - 10).toFixed(1) +
      '" height="' + h.toFixed(1) + '" rx="4" fill="url(#hg)"><title>' + b.name + ": " + b.count + ' 篇</title></rect>' +
      '<text x="' + (i*bw + bw/2).toFixed(1) + '" y="' + (H - 6) + '" text-anchor="middle" fill="#93a4c8" font-size="8.5">' + (i*100+1) + "</text>" +
      '<text x="' + (i*bw + bw/2).toFixed(1) + '" y="' + (H - 26 - h).toFixed(1) + '" text-anchor="middle" fill="#c3cfe9" font-size="10">' + b.count + "</text>";
  }).join("");
  $("histChart").innerHTML = '<svg viewBox="0 0 ' + W + " " + H + '" width="100%" role="img" aria-label="博文编号分布直方图">' +
    '<defs><linearGradient id="hg" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#22d3ee"/><stop offset="1" stop-color="#7c3aed"/></linearGradient></defs>' + rects + "</svg>";
}

/* ---------- 筛选 ---------- */
function applyFilters(){
  const q = state.q.trim().toLowerCase();
  const terms = q.split(/\s+/).filter(Boolean);
  let list = state.data.items.filter((it) => {
    if (state.source && it.source !== state.source) return false;
    if (state.type && it.type !== state.type) return false;
    if (state.tag && !(it.tags || []).includes(state.tag)) return false;
    if (!terms.every(term => (it.title + " " + (it.excerpt || "") + " " + (it.tags || []).join(" ") + " " + (it.category || "")).toLowerCase().includes(term))) return false;
    return true;
  });
  if (state.sort === "recent") list.sort((a,b) => (b.sob_id || 0) - (a.sob_id || 0) || a.title.localeCompare(b.title, "zh"));
  if (state.sort === "date") list.sort((a,b) => String(b.date || "").localeCompare(String(a.date || "")));
  if (state.sort === "title") list.sort((a,b) => a.title.localeCompare(b.title, "zh"));
  if (state.sort === "source") list.sort((a,b) => a.source.localeCompare(b.source) || (b.sob_id || 0) - (a.sob_id || 0));
  state.filtered = list;
  renderCards($("cards"), list.slice(0, state.shown));
  $("loadMore").style.display = list.length > state.shown ? "" : "none";
  $("resultInfo").textContent = "共 " + list.length + " 条真实条目" + (q ? "（搜索：" + state.q + "）" : "") + " · 已显示 " + Math.min(state.shown, list.length) + " 条";
}

function renderAll(){
  const d = state.data; const items = d.items;
  $("generatedAt").textContent = "数据快照：" + new Date(d.generatedAt).toLocaleString("zh-CN");
  $("complianceLine").textContent = d.compliance || "";
  const bySrc = d.sources.map((s) => ({...s, count: items.filter((i) => i.source === s.id).length}));
  const maxCount = Math.max(1, ...bySrc.map((s) => s.count));
  const dated = items.filter((i) => i.date).sort((a,b) => String(b.date).localeCompare(String(a.date)));
  $("heroStats").innerHTML = [
    [items.length, "快照条目总数"], [d.sources.filter((s) => s.status === "ok").length + " / " + d.sources.length, "快照抓取成功来源"],
    [dated[0] ? dated[0].date : "—", "快照内最新日期"], [new Set(items.flatMap((i) => i.tags || [])).size, "主题标签数"],
  ].map(([v,l]) => '<div class="stat"><b>' + esc(v) + "</b><span>" + esc(l) + "</span></div>").join("");
  $("sourceCards").innerHTML = d.sources.map((s) => {
    const cnt = items.filter((i) => i.source === s.id).length;
    return '<article class="source-card" style="--sc:' + esc(s.color) + '"><h3>' + esc(s.name) + "</h3>" +
      '<p class="role">' + esc(s.role) + "</p>" +
      '<span class="badge ' + esc(s.status) + '">' + esc(s.statusLabel) + "</span>" +
      '<div class="meter"><i style="width:' + (cnt / maxCount * 100).toFixed(1) + '%"></i></div>' +
      '<div class="meta">' + cnt + ' 条 · 快照采集于 ' + new Date(s.fetchedAt).toLocaleString("zh-CN") +
      (s.url ? '<br><a href="' + esc(s.url) + '" target="_blank" rel="noopener">访问原站 ↗</a>' : '<br>点下方卡片进各官网') + "</div></article>";
  }).join("");
  donut(bySrc);
  const tagCount = {}; items.forEach((i) => (i.tags || []).forEach((t) => tagCount[t] = (tagCount[t] || 0) + 1));
  bars($("tagBars"), Object.entries(tagCount).map(([name,count]) => ({name,count})).sort((a,b) => b.count - a.count).slice(0,10));
  const typeCount = {}; items.forEach((i) => typeCount[i.type] = (typeCount[i.type] || 0) + 1);
  bars($("typeBars"), Object.entries(typeCount).map(([k,count]) => ({name: TYPE_LABEL[k] || k, count})).sort((a,b) => b.count - a.count));
  histogram(items);
  /* 筛选下拉 */
  $("fSource").innerHTML = '<option value="">全部来源</option>' + d.sources.map((s) => '<option value="' + esc(s.id) + '">' + esc(s.name) + "</option>").join("");
  const types = [...new Set(items.map((i) => i.type))];
  $("fType").innerHTML = '<option value="">全部类型</option>' + types.map((t) => '<option value="' + esc(t) + '">' + esc(TYPE_LABEL[t] || t) + "</option>").join("");
  const tags = Object.keys(tagCount).sort((a,b) => tagCount[b] - tagCount[a]);
  $("fTag").innerHTML = '<option value="">全部主题</option>' + tags.map((t) => '<option value="' + esc(t) + '">' + esc(t) + " (" + tagCount[t] + ")</option>").join("");
  if (state.source) $("fSource").value = state.source;
  if (state.type) $("fType").value = state.type;
  if (state.tag) $("fTag").value = state.tag;
  /* 分区 */
  renderCards($("latestCards"), dated.slice(0, 9));
  renderCards($("freshCards"), items.filter((i) => i.source === "arxiv" || i.source === "crossref")
    .sort((a,b) => String(b.date || "").localeCompare(String(a.date || ""))).slice(0, 18));
  renderCards($("openCards"), items.filter((i) => i.source === "github" || i.source === "resdir").slice(0, 24));
  renderCards($("xmolCards"), items.filter((i) => i.source === "xmol").slice(0, 24));
  renderCards($("cclCards"), items.filter((i) => i.source === "ccl").slice(0, 24));
  if ((d.xmolHomepageStats || []).length)
    $("xmolNote").textContent = "X-MOL 首页公开数据：" + d.xmolHomepageStats.join(" · ") + "。下方为其真实学科频道与工具入口（原站直达）。";
  $("footSources").innerHTML = d.sources.filter((s) => s.url).map((s) => '<a href="' + esc(s.url) + '" target="_blank" rel="noopener">' + esc(s.name) + "</a>").join(" · ");
  applyFilters();
}

async function loadData(){
  if (window.CHEMVIS_DATA) {
    state.data = window.CHEMVIS_DATA;
  } else {
    const r = await fetch("data.json");
    if (!r.ok) throw new Error("data.json 加载失败 HTTP " + r.status);
    state.data = await r.json();
  }
  state.data.sources.forEach(source => {
    source.itemCount = state.data.items.filter(item => item.source === source.id).length;
  });
  renderAll();
}
/* 事件 */
$("q").addEventListener("input", (e) => { state.q = e.target.value; state.shown = 24; applyFilters(); });
$("fSource").addEventListener("change", (e) => { state.source = e.target.value; state.shown = 24; applyFilters(); });
$("fType").addEventListener("change", (e) => { state.type = e.target.value; state.shown = 24; applyFilters(); });
$("fTag").addEventListener("change", (e) => { state.tag = e.target.value; state.shown = 24; applyFilters(); });
$("fSort").addEventListener("change", (e) => { state.sort = e.target.value; applyFilters(); });
$("clearFilters").addEventListener("click", () => {
  state.q = state.source = state.type = state.tag = ""; state.shown = 24;
  $("q").value = ""; $("fSource").value = ""; $("fType").value = ""; $("fTag").value = ""; applyFilters();
});
$("loadMore").addEventListener("click", () => { state.shown += 24; applyFilters(); });
$("refreshBtn").addEventListener("click", () => {
  $("refreshMsg").textContent = "这是随压缩包保存的数据快照。需要更新时，在包根目录的 maintenance 文件夹中创建 Python 虚拟环境，安装 requirements.txt，再运行 refresh_data.py；它会同步生成离线数据与统一搜索索引。具体命令见包内 README.md。更新完成后重新打开网页。";
  $("refreshBtn").setAttribute("aria-expanded", "true");
});
loadData().catch((e) => {
  $("resultInfo").textContent = "数据加载失败：" + e.message + "。请完整解压压缩包，确认 hub/data.js 与本页一起保留。";
});
