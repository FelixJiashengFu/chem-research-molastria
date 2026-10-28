// Search-engine build for public/: static guide chapters, a crawlable resource directory, per-page
// canonical / Open Graph / JSON-LD, sitemap.xml, robots.txt and 404.html. Re-runnable.
//   deno run --allow-read --allow-write tools/build-seo.ts
// The site address and the Search Console token live in site.config.json.
const repo = new URL("../", import.meta.url);
const pub = new URL("public/", repo);
const cfg = JSON.parse(await Deno.readTextFile(new URL("site.config.json", repo)));
const SITE: string = cfg.siteUrl.endsWith("/") ? cfg.siteUrl : cfg.siteUrl + "/";
const NAME: string = cfg.siteName;
const TODAY = new Date().toISOString().slice(0, 10);
const esc = (v: unknown) => String(v ?? "").replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]!));
const strip = (html: string) => html.replace(/<[^>]+>/g, " ").replace(/&nbsp;/g, " ").replace(/&amp;/g, "&").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/\s+/g, " ").trim();
const clip = (s: string, n: number) => (s.length > n ? s.slice(0, n - 1) + "…" : s);
const write = async (path: string, text: string) => {
  const url = new URL(path, pub);
  await Deno.mkdir(new URL(".", url), { recursive: true });
  await Deno.writeTextFile(url, text);
};
const load = (file: string) => {
  const g = globalThis as any;
  g.window = g;
  new Function(Deno.readTextFileSync(new URL(file, pub)))();
};
load("atlas/content.js");
load("merged-data.js");
const content = (globalThis as any).CHEMDB_CONTENT;
const data = (globalThis as any).CHEMRESEARCH_DATA;
const THEME_BOOT = '<script>try{var d=document.documentElement,s=localStorage,t=s.getItem("chemhub-theme"),l=(location.search.match(/[?&]lang=(en|zh)/)||[])[1]||s.getItem("chemhub-lang");if(t==="dark"||t==="light")d.dataset.theme=t;d.dataset.bg=s.getItem("chemhub-bg")||"stars";var g=s.getItem("chemhub-bg-strength");if(g)d.style.setProperty("--bg-strength",g);if(l==="en"){d.lang="en";d.dataset.i18n="pending";setTimeout(function(){delete d.dataset.i18n},3000)}}catch(e){}</script>';

// ── head blocks ──────────────────────────────────────────────────────────
function seoHead(o: { path: string; title: string; description: string; type?: string; jsonld?: unknown[] }) {
  const url = SITE + o.path;
  const ld = [...(o.jsonld || [])];
  const lines = [
    `<link rel="canonical" href="${esc(url)}">`,
    `<meta property="og:type" content="${o.type || "website"}">`,
    `<meta property="og:site_name" content="${esc(NAME)} · ${esc(cfg.siteNameZh)}">`,
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(SITE)}og.png">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="zh_CN">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">` : "",
    ld.length ? `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, "\\u003c")}</script>` : "",
  ].filter(Boolean);
  return `<!-- seo:start -->\n  ${lines.join("\n  ")}\n  <!-- seo:end -->`;
}
const website = { "@context": "https://schema.org", "@type": "WebSite", name: NAME, alternateName: cfg.siteNameZh, url: SITE, inLanguage: "zh-CN", description: "计算化学研究资源统一入口：数据库、论文、中文教程与开源工具。" };
const crumbs = (items: [string, string][]) => ({ "@context": "https://schema.org", "@type": "BreadcrumbList", itemListElement: items.map(([name, path], i) => ({ "@type": "ListItem", position: i + 1, name, item: SITE + path })) });

async function injectHead(file: string, path: string, extra: { type?: string; jsonld?: unknown[] } = {}) {
  const url = new URL(file, pub);
  let html = await Deno.readTextFile(url);
  const title = strip(html.match(/<title>([\s\S]*?)<\/title>/)?.[1] || NAME);
  const description = html.match(/<meta name="description" content="([^"]*)"/)?.[1] || "";
  html = html.replace(/\s*<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, "");
  html = html.replace(/(<title>[\s\S]*?<\/title>)/, `$1\n  ${seoHead({ path, title, description, ...extra })}`);
  await Deno.writeTextFile(url, html);
  return { path, title };
}

// ── static page shell ────────────────────────────────────────────────────
function page(o: { rel: string; path: string; title: string; description: string; section: string; css: string[]; body: string; jsonld?: unknown[]; type?: string }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}">
  <meta name="theme-color" content="#173f34">
  ${seoHead({ path: o.path, title: o.title, description: o.description, jsonld: o.jsonld, type: o.type })}
  <link rel="icon" href="${o.rel}favicon.svg" type="image/svg+xml">
  ${THEME_BOOT}
  <script src="${o.rel}i18n.js" defer></script>
  <script src="${o.rel}backdrop.js" defer></script>
  <link rel="stylesheet" href="${o.rel}shared-nav.css">
  ${o.css.map((c) => `<link rel="stylesheet" href="${o.rel}${c}">`).join("\n  ")}
  <script src="${o.rel}shared-nav.js" defer></script>
</head>
<body data-section="${o.section}">
${o.body}
</body>
</html>
`;
}

// ── guide CSS: the reader's rules from atlas/styles.css, re-scoped for standalone pages ──
function cssBlocks(css: string) {
  const out: { head: string; body: string }[] = [];
  let i = 0;
  while (i < css.length) {
    const open = css.indexOf("{", i);
    if (open < 0) break;
    const head = css.slice(i, open).trim();
    let depth = 1, j = open + 1;
    while (j < css.length && depth) { if (css[j] === "{") depth++; else if (css[j] === "}") depth--; j++; }
    out.push({ head, body: css.slice(open + 1, j - 1) });
    i = j;
  }
  return out;
}
function guideRules(css: string): string {
  return cssBlocks(css).map(({ head, body }) => {
    if (head.startsWith("@media")) { const inner = guideRules(body); return inner ? `${head}{${inner}}` : ""; }
    if (head.startsWith("@")) return "";
    return head.includes(".guide-article") ? `${head}{${body}}` : "";
  }).join("");
}
const atlasCss = await Deno.readTextFile(new URL("atlas/styles.css", pub));
let guideCss = guideRules(atlasCss);
const rootVars = Object.fromEntries([...(atlasCss.match(/:root\{([^}]*)\}/)?.[1] || "").matchAll(/(--[\w-]+):([^;]+)/g)].map((m) => [m[1], m[2]]));
const global = new Set(["--paper", "--ink", "--muted", "--line", "--surface"]);
const used = [...new Set([...guideCss.matchAll(/var\((--[\w-]+)/g)].map((m) => m[1]))].filter((v) => rootVars[v] && !global.has(v) && !v.startsWith("--t-"));
guideCss = `/* Generated by tools/build-seo.ts from atlas/styles.css (reader rules) + standalone layout. */
:root{${used.map((v) => `${v}:${rootVars[v]}`).join(";")}}
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.7 var(--font-sans)}
a{color:var(--accent-text)}
.sg{max-width:1240px;margin:0 auto;padding:28px 32px 60px;display:grid;grid-template-columns:250px minmax(0,1fr);gap:40px}
.sg-toc{position:sticky;top:calc(var(--cr-nav-height,64px) + 16px);align-self:start;max-height:calc(100vh - 110px);overflow:auto;font-size:12.5px;border-right:1px solid var(--line);padding-right:14px}
.sg-toc h2{font-size:12px;letter-spacing:1.5px;color:var(--muted);margin:0 0 10px}
.sg-toc ol{list-style:none;margin:0;padding:0;display:grid;gap:2px}
.sg-toc a{display:flex;gap:8px;padding:6px 8px;border-radius:4px;color:var(--ink-2);text-decoration:none}
.sg-toc a span{font-family:var(--font-mono);color:var(--faint);font-size:11px;padding-top:1px}
.sg-toc a:hover{background:var(--surface-2)}
.sg-toc a[aria-current=page]{background:var(--accent-soft);color:var(--ink);font-weight:600}
.sg-crumbs{font-size:12px;color:var(--muted);display:flex;gap:6px;flex-wrap:wrap}
.sg-crumbs a{color:var(--muted)}
.sg-main{min-width:0}
.sg-tools{display:flex;gap:14px;align-items:center;justify-content:space-between;border-bottom:1px solid var(--line);padding-bottom:12px;flex-wrap:wrap}
.sg-tools a{font-size:12.5px;font-weight:600}
.sg-pager{display:flex;justify-content:space-between;gap:12px;border-top:1px solid var(--line);margin-top:26px;padding-top:16px}
.sg-pager a{display:grid;gap:2px;max-width:46%;padding:10px 14px;border:1px solid var(--line);border-radius:6px;background:var(--surface);text-decoration:none;color:var(--ink)}
.sg-pager a small{color:var(--muted);font-size:11.5px}
.sg-pager a:last-child{text-align:right;margin-left:auto}
.sg-foot{grid-column:1/-1;border-top:1px solid var(--line);padding-top:16px;font-size:12px;color:var(--muted)}
@media(max-width:900px){.sg{grid-template-columns:1fr;padding:20px 16px 48px;gap:16px}.sg-toc{position:static;max-height:none;border-right:0;border-bottom:1px solid var(--line);padding:0 0 12px}.sg-toc ol{grid-template-columns:1fr 1fr}}
${guideCss}`;
await write("guide/guide.css", guideCss);

// ── guide chapters ───────────────────────────────────────────────────────
const LABELS = ["封面与阅读地图", "三分钟导读", "全景与分层逻辑", "01 · 综合化合物与化学信息", "02 · 量子化学基准与参数", "03 · 材料与晶体：计算库", "03 · 材料与晶体：实验库", "04 · 生物大分子结构", "05 · 药物与化学空间", "06–07 · 代谢与反应通路", "08 · 光谱与波谱", "09 · 机器学习：分子与催化", "09 · 机器学习：材料与工具", "10 · 软件：量化与动力学", "10 · 软件：分析与工作流", "11 · 社区与中文入口", "接入实况与边界", "细读质疑与使用提醒", "关键术语与附录"];
function cleanGuide(html: string) {
  return html
    .replace(/<(script|style|iframe|object|embed|form)\b[\s\S]*?<\/\1>/gi, "")
    .replace(/<(link|meta|base)\b[^>]*>/gi, "")
    .replace(/\s+on\w+\s*=\s*("[^"]*"|'[^']*'|[^\s>]+)/gi, "")
    .replace(/(href|src)\s*=\s*("|')\s*(javascript|data):[^"']*\2/gi, "")
    .replace(/<a\s+([^>]*href=("|')https?:[^"']+\2[^>]*)>/gi, (m, attrs) => /target=/.test(attrs) ? m : `<a ${attrs} target="_blank" rel="noopener">`);
}
const guides = content.guides as { id: string; title: string; html: string }[];
const guidePages: string[] = [];
const toc = (current: number) => `<nav class="sg-toc" aria-label="讲解目录"><h2>中文讲解 · ${guides.length} 章</h2><ol>${guides.map((g, i) => `<li><a href="${esc(g.id)}.html"${i === current ? ' aria-current="page"' : ""}><span>${String(i + 1).padStart(2, "0")}</span>${esc(LABELS[i] || g.title)}</a></li>`).join("")}</ol></nav>`;
for (const [i, g] of guides.entries()) {
  const html = cleanGuide(g.html);
  const lead = strip(html.match(/<p class="lead">([\s\S]*?)<\/p>/)?.[1] || html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] || "");
  const title = `${g.title} · 计算化学数据库中文讲解 · ${NAME}`;
  const description = clip(lead || `${g.title}：计算化学数据库与资源导航中文讲解第 ${i + 1} 章。`, 150);
  const prev = guides[i - 1], next = guides[i + 1];
  const path = `guide/${g.id}.html`;
  guidePages.push(path);
  const body = `<main class="sg">
${toc(i)}
<div class="sg-main">
  <div class="sg-tools"><nav class="sg-crumbs" aria-label="位置"><a href="../index.html">首页</a><span>/</span><a href="index.html">中文讲解</a><span>/</span><span>${esc(LABELS[i] || g.title)}</span></nav><a href="../atlas/index.html#guide/${esc(g.id)}">在阅读器中打开 ↗</a></div>
  <p class="en-only" translate="no">This chapter is written in Chinese. Your browser’s translate feature gives a full English version.</p>
  <article class="guide-article">
${html}
  </article>
  <nav class="sg-pager" aria-label="翻页">${prev ? `<a href="${esc(prev.id)}.html"><small>← 上一章</small>${esc(LABELS[i - 1] || prev.title)}</a>` : "<span></span>"}${next ? `<a href="${esc(next.id)}.html"><small>下一章 →</small>${esc(LABELS[i + 1] || next.title)}</a>` : ""}</nav>
</div>
<footer class="sg-foot">MolAstria · 计算化学数据库与资源导航中文讲解，材料版本 ${esc(content.date)}。全文、更新日期与使用许可以各资源原站为准。</footer>
</main>`;
  await write(path, page({
    rel: "../", path, title, description, section: "atlas", css: ["theme-auto.css", "guide/guide.css"], body, type: "article",
    jsonld: [
      { "@context": "https://schema.org", "@type": "TechArticle", headline: g.title, description, inLanguage: "zh-CN", datePublished: content.date, dateModified: TODAY, isPartOf: { "@type": "WebSite", name: NAME, url: SITE }, mainEntityOfPage: SITE + path, image: SITE + "og.png", publisher: { "@type": "Organization", name: NAME, url: SITE } },
      crumbs([["首页", ""], ["中文讲解", "guide/"], [LABELS[i] || g.title, path]]),
    ],
  }));
}
await write("guide/index.html", page({
  rel: "../", path: "guide/", section: "atlas", css: ["theme-auto.css", "guide/guide.css"],
  title: `计算化学数据库中文讲解（${guides.length} 章）· ${NAME}`,
  description: `从化合物、量子化学基准、晶体材料、生物大分子、药物、光谱到机器学习数据集与计算软件，${guides.length} 章中文讲解帮你判断该去哪个数据库、能拿到什么、边界在哪里。`,
  body: `<main class="sg">${toc(-1)}<div class="sg-main"><div class="sg-tools"><nav class="sg-crumbs" aria-label="位置"><a href="../index.html">首页</a><span>/</span><span>中文讲解</span></nav><a href="../atlas/index.html#guide">在阅读器中打开 ↗</a></div><article class="guide-article"><h1>计算化学数据库中文讲解</h1><p class="lead">一百零三个数据库与资源入口，按研究问题分层讲解：先分清去哪一层，再决定用哪个库。下面是全部 ${guides.length} 章。</p><ol>${guides.map((g, i) => `<li><a href="${esc(g.id)}.html">${esc(LABELS[i] || g.title)}</a> — ${esc(g.title)}</li>`).join("")}</ol></article></div><footer class="sg-foot">材料版本 ${esc(content.date)}。</footer></main>`,
  jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "计算化学数据库中文讲解", inLanguage: "zh-CN", url: SITE + "guide/", hasPart: guides.map((g) => ({ "@type": "TechArticle", headline: g.title, url: `${SITE}guide/${g.id}.html` })) }, crumbs([["首页", ""], ["中文讲解", "guide/"]])],
}));

// ── resource directory ───────────────────────────────────────────────────
const TYPES: Record<string, string> = { database: "数据库", software: "软件官网", tutorial: "深度教程", qa: "论坛问答", paper: "期刊论文", preprint: "预印本", repo: "开源仓库", tool: "平台工具", discipline: "学科频道", resource: "资源索引", archive: "邮件归档", conference: "学术会议", job: "学术招聘", announcement: "公告" };
const SLUG: Record<string, string> = { database: "databases", software: "software", tutorial: "tutorials", qa: "forum", paper: "papers", preprint: "preprints", repo: "open-source", tool: "tools", discipline: "channels", resource: "indexes", archive: "archives", conference: "conferences", job: "jobs", announcement: "announcements" };
const sourceName = new Map((data.sources as any[]).map((s) => [s.id, s.name]));
const items = data.items as any[];
const byType = new Map<string, any[]>();
for (const it of items) { if (!byType.has(it.type)) byType.set(it.type, []); byType.get(it.type)!.push(it); }
const typeOrder = Object.keys(TYPES).filter((t) => byType.has(t));
const resCss = `/* Generated by tools/build-seo.ts */
*{box-sizing:border-box}
body{margin:0;background:var(--paper);color:var(--ink);font:14px/1.75 var(--font-sans)}
a{color:var(--accent-text)}
.rs{max-width:1100px;margin:0 auto;padding:36px 32px 64px}
.rs-crumbs{font-size:12px;color:var(--muted)}.rs-crumbs a{color:var(--muted)}
.rs h1{font-size:clamp(26px,3vw,36px);letter-spacing:-.6px;margin:10px 0 10px;font-weight:600}
.rs .lead{color:var(--muted);max-width:70ch;margin:0 0 22px}
.rs-types{display:grid;grid-template-columns:repeat(auto-fill,minmax(200px,1fr));gap:10px;margin:0 0 30px;padding:0;list-style:none}
.rs-types a{display:flex;justify-content:space-between;gap:8px;padding:12px 14px;border:1px solid var(--line);border-radius:6px;background:var(--surface);text-decoration:none;color:var(--ink);font-weight:600}
.rs-types a span{color:var(--muted);font-weight:400;font-family:var(--font-num)}
.rs-types a:hover{border-color:var(--line-strong)}
.rs h2{font-size:18px;margin:30px 0 8px;padding-top:8px;border-top:1px solid var(--line)}
.rs-list{list-style:none;margin:0;padding:0}
.rs-list li{padding:11px 0;border-bottom:1px solid var(--line)}
.rs-list a{font-weight:600;text-decoration:none}.rs-list a:hover{text-decoration:underline}
.rs-list p{margin:3px 0 0;color:var(--muted);font-size:13px}
.rs-list small{color:var(--faint);font-size:12px;margin-left:6px}
.rs-foot{margin-top:36px;font-size:12px;color:var(--muted)}
@media(max-width:720px){.rs{padding:24px 16px 48px}}
`;
await write("resources/resources.css", resCss);
const entry = (it: any) => {
  const desc = clip(String(it.excerpt || it.atlasRecords?.[0]?.description || ""), 180);
  const srcs = (it.sourceIds as string[]).map((id) => sourceName.get(id) || id).join(" / ");
  return `<li><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a><small>${esc(srcs)}${it.date ? ` · ${esc(it.date)}` : ""}</small>${desc ? `<p>${esc(desc)}</p>` : ""}</li>`;
};
const resourcePages: string[] = [];
for (const t of typeOrder) {
  const list = byType.get(t)!;
  const groups = new Map<string, any[]>();
  for (const it of list) { const k = it.category || sourceName.get(it.sourceIds[0]) || "其他"; if (!groups.has(k)) groups.set(k, []); groups.get(k)!.push(it); }
  const path = `resources/${SLUG[t] || t}.html`;
  resourcePages.push(path);
  const examples = list.slice(0, 4).map((x) => x.title).join("、");
  await write(path, page({
    rel: "../", path, section: "search", css: ["resources/resources.css"],
    title: `计算化学${TYPES[t]}（${list.length} 条）· ${NAME}`,
    description: clip(`MolAstria 收录的 ${list.length} 条计算化学${TYPES[t]}，按分类列出标题、来源与原文链接，例如：${examples}。`, 155),
    body: `<main class="rs"><nav class="rs-crumbs" aria-label="位置"><a href="../index.html">首页</a> / <a href="index.html">资源目录</a> / ${esc(TYPES[t])}</nav><h1>计算化学${esc(TYPES[t])} · ${list.length} 条</h1><p class="lead">数据快照日期 ${esc(cfg.dataDate)}。只列标题、来源与短摘要，阅读全文请访问原站。也可以回到 <a href="../index.html?q=">统一搜索</a> 按关键词筛选，或用 AI 助手带出处地提问。</p>${[...groups.entries()].map(([g, arr]) => `<h2>${esc(g)} <small class="muted">${arr.length}</small></h2><ul class="rs-list">${arr.map(entry).join("")}</ul>`).join("")}<p class="rs-foot">MolAstria 只做标题级聚合索引，版权归原作者与原站所有。</p></main>`,
    jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: `计算化学${TYPES[t]}`, inLanguage: "zh-CN", url: SITE + path, numberOfItems: list.length }, crumbs([["首页", ""], ["资源目录", "resources/"], [TYPES[t], path]])],
  }));
}
const atlasCats = new Map<string, any[]>();
for (const r of content.resources as any[]) { if (!atlasCats.has(r.category)) atlasCats.set(r.category, []); atlasCats.get(r.category)!.push(r); }
await write("resources/index.html", page({
  rel: "../", path: "resources/", section: "search", css: ["resources/resources.css"],
  title: `计算化学资源目录：数据库、软件、教程与论文 · ${NAME}`,
  description: `${items.length} 条去重后的计算化学资源：${content.resources.length} 个数据库与研究资源、量化与分子模拟软件、Sobereva 与计算化学公社教程、arXiv 预印本、期刊论文与 GitHub 开源项目。`,
  body: `<main class="rs"><nav class="rs-crumbs" aria-label="位置"><a href="../index.html">首页</a> / 资源目录</nav><h1>计算化学资源目录</h1><p class="lead">${items.length} 条去重后的资源，快照日期 ${esc(cfg.dataDate)}。按类型浏览，或回到 <a href="../index.html">统一搜索</a>、<a href="../hub/network.html">网状查询</a>。</p><ul class="rs-types">${typeOrder.map((t) => `<li><a href="${SLUG[t] || t}.html">${esc(TYPES[t])}<span>${byType.get(t)!.length}</span></a></li>`).join("")}</ul><h2>数据库与研究资源（ChemDB Atlas · ${content.resources.length} 条）</h2>${[...atlasCats.entries()].map(([c, arr]) => `<h2>${esc(c)} <small class="muted">${arr.length}</small></h2><ul class="rs-list">${arr.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a><small>${esc(r.access)}</small><p>${esc(r.description)}</p></li>`).join("")}</ul>`).join("")}<p class="rs-foot">中文讲解见 <a href="../guide/index.html">${guides.length} 章讲解</a>。</p></main>`,
  jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "计算化学资源目录", inLanguage: "zh-CN", url: SITE + "resources/", numberOfItems: items.length }, crumbs([["首页", ""], ["资源目录", "resources/"]])],
}));

// ── main pages ───────────────────────────────────────────────────────────
const datasetDescription = `${items.length} 条计算化学研究资源的标题级索引，涵盖数据库、软件、中文教程、学术论文与开源项目。条目保留名称、简短说明、原始网址、来源、分类和主题标签，可用于资源检索与导航。数据来自项目保存的目录快照，完整内容及使用许可请以各原始网站为准。`;
// Google Dataset requires a description containing 50–5000 characters.
const datasetDescriptionLength = Array.from(datasetDescription).length;
if (datasetDescriptionLength < 50 || datasetDescriptionLength > 5000) {
  throw new Error(`Dataset description must contain 50–5000 characters; got ${datasetDescriptionLength}`);
}
const mains = [
  await injectHead("index.html", "", { jsonld: [website, { "@context": "https://schema.org", "@type": "Dataset", name: "MolAstria 计算化学资源目录", description: datasetDescription, url: SITE, inLanguage: "zh-CN", dateModified: cfg.dataDate, isAccessibleForFree: true, creator: { "@type": "Organization", name: NAME, url: SITE }, distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE + "merged-data.json" }] }] }),
  await injectHead("atlas/index.html", "atlas/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "ChemDB Atlas 计算化学数据库导航", inLanguage: "zh-CN", url: SITE + "atlas/" }] }),
  await injectHead("hub/index.html", "hub/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "计算化学论文与社区", inLanguage: "zh-CN", url: SITE + "hub/" }] }),
  await injectHead("hub/network.html", "hub/network.html"),
  await injectHead("lab/index.html", "lab/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "闭环电解液分子发现 · AI 实验室", applicationCategory: "ScientificApplication", operatingSystem: "Web", inLanguage: "zh-CN", url: SITE + "lab/", isAccessibleForFree: true, description: "用 Muse 或 DeepSeek 提出电解液溶剂分子，RDKit 过滤，UMA 三级精度筛选，可靠性层分配 DFT 验证。" }] }),
];

// ── 404, sitemap, robots ─────────────────────────────────────────────────
await write("404.html", `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>页面不存在 · ${esc(NAME)}</title>
  <meta name="robots" content="noindex">
  <link rel="icon" href="${SITE}favicon.svg" type="image/svg+xml">
  ${THEME_BOOT}
  <script src="${SITE}i18n.js" defer></script>
  <script src="${SITE}backdrop.js" defer></script>
  <link rel="stylesheet" href="${SITE}shared-nav.css">
  <link rel="stylesheet" href="${SITE}resources/resources.css">
  <script src="${SITE}shared-nav.js" defer></script>
</head>
<body data-section="">
<main class="rs"><h1>这个页面不存在</h1><p class="lead">链接可能已经改名。可以从这些入口继续：</p><ul class="rs-types"><li><a href="${SITE}">统一搜索<span>↗</span></a></li><li><a href="${SITE}resources/">资源目录<span>↗</span></a></li><li><a href="${SITE}guide/">中文讲解<span>↗</span></a></li><li><a href="${SITE}lab/">AI 实验室<span>↗</span></a></li></ul></main>
</body>
</html>
`);
const urls = [
  ["", "1.0", "weekly"], ["lab/", "0.9", "weekly"], ["resources/", "0.9", "weekly"], ["guide/", "0.8", "monthly"],
  ["atlas/", "0.8", "monthly"], ["hub/", "0.7", "weekly"], ["hub/network.html", "0.6", "monthly"],
  ...guidePages.map((p) => [p, "0.7", "monthly"]), ...resourcePages.map((p) => [p, "0.5", "weekly"]),
];
await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
${urls.map(([p, pr, f]) => `  <url><loc>${esc(SITE + p)}</loc><lastmod>${TODAY}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`).join("\n")}
</urlset>
`);
await write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
await write(".nojekyll", "");
console.log(`site ${SITE}\n${mains.length} main pages, ${guidePages.length + 1} guide pages, ${resourcePages.length + 1} resource pages, ${urls.length} sitemap URLs`);
