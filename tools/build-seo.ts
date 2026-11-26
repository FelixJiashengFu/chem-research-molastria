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
const THEME_BOOT = '<script>try{var d=document.documentElement,s=localStorage,t=s.getItem("chemhub-theme"),l=(location.search.match(/[?&]lang=(en|zh)/)||[])[1]||s.getItem("chemhub-lang");if(t==="dark"||t==="light")d.dataset.theme=t;d.dataset.bg=s.getItem("chemhub-bg")||"stars";var z=+s.getItem("molastria-zoom");if(z&&z!==1&&!window.__MOLASTRIA_DESKTOP__)d.style.zoom=z;var x=+s.getItem("molastria-text");if(x&&x!==1)d.style.setProperty("--cr-text-zoom",x);var f=s.getItem("molastria-font");if(f)d.dataset.font=f;var g=s.getItem("chemhub-bg-strength");if(g)d.style.setProperty("--bg-strength",g);if(l==="en"){d.lang="en";d.dataset.i18n="pending";setTimeout(function(){delete d.dataset.i18n},3000)}}catch(e){}</script>';

// ── head blocks ──────────────────────────────────────────────────────────
// English versions: the same HTML at ?lang=en (i18n.js translates it in the browser). Pages written in Chinese only
// (the static guide chapters and resource lists) get no English alternate.
const enUrl = (url: string) => url + (url.includes("?") ? "&" : "?") + "lang=en";
const enPaths = new Set<string>();
// At ?lang=en the canonical and og:url point at the English address, so the two versions are not folded into one.
const EN_HEAD = '<script>if(/[?&]lang=en(&|$)/.test(location.search))document.querySelectorAll(\'link[rel=canonical],meta[property="og:url"]\').forEach(function(e){var a=e.tagName==="LINK"?"href":"content",u=e.getAttribute(a);e.setAttribute(a,u+(u.indexOf("?")<0?"?":"&")+"lang=en")})</script>';
function seoHead(o: { path: string; title: string; description: string; type?: string; jsonld?: unknown[]; en?: boolean }) {
  const url = SITE + o.path;
  const ld = [...(o.jsonld || [])];
  const en = o.en !== false;
  if (en) enPaths.add(o.path);
  const lines = [
    `<link rel="canonical" href="${esc(url)}">`,
    ...(en ? [
      `<link rel="alternate" hreflang="zh-CN" href="${esc(url)}">`,
      `<link rel="alternate" hreflang="en" href="${esc(enUrl(url))}">`,
      `<link rel="alternate" hreflang="x-default" href="${esc(url)}">`,
      EN_HEAD,
    ] : []),
    `<meta property="og:type" content="${o.type || "website"}">`,
    `<meta property="og:site_name" content="${esc(NAME)}">`, // the bare brand: Google reads it (with the WebSite JSON-LD) as the site name above each result
    `<meta property="og:title" content="${esc(o.title)}">`,
    `<meta property="og:description" content="${esc(o.description)}">`,
    `<meta property="og:url" content="${esc(url)}">`,
    `<meta property="og:image" content="${esc(SITE)}og.png">`,
    `<meta property="og:image:width" content="1200"><meta property="og:image:height" content="630">`,
    `<meta property="og:locale" content="zh_CN"><meta property="og:locale:alternate" content="en_US">`,
    `<meta name="twitter:card" content="summary_large_image">`,
    cfg.googleSiteVerification ? `<meta name="google-site-verification" content="${esc(cfg.googleSiteVerification)}">` : "",
    ld.length ? `<script type="application/ld+json">${JSON.stringify(ld.length === 1 ? ld[0] : ld).replace(/</g, "\\u003c")}</script>` : "",
  ].filter(Boolean);
  return `<!-- seo:start -->\n  ${lines.join("\n  ")}\n  <!-- seo:end -->`;
}
const website = { "@context": "https://schema.org", "@type": "WebSite", name: NAME, alternateName: [cfg.siteNameZh, "molastria.com"], url: SITE, inLanguage: ["zh-CN", "en"], description: "Integrated Chemical Research & Computing Foundry, bilingual: databases, papers, tutorials and open-source tools. 数据库、文献、教程与开源工具一站检索。" };
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
function page(o: { rel: string; path: string; title: string; description: string; section: string; css: string[]; body: string; jsonld?: unknown[]; type?: string; en?: boolean }) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>${esc(o.title)}</title>
  <meta name="description" content="${esc(o.description)}">
  <meta name="theme-color" content="#173f34">
  ${seoHead({ path: o.path, title: o.title, description: o.description, jsonld: o.jsonld, type: o.type, en: o.en ?? false })}
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
const LABELS = ["封面与阅读地图", "三分钟导读", "全景与分层逻辑", "01 · 综合化合物与化学信息", "02 · 量子化学基准与参数", "03 · 材料与晶体：计算库", "03 · 材料与晶体：实验库", "04 · 生物大分子结构", "05 · 药物与化学空间", "06–07 · 代谢与反应通路", "08 · 光谱与波谱", "09 · 机器学习：分子与催化", "09 · 机器学习：材料与工具", "17 · 科学语言模型与多模态", "10 · 软件：量化与动力学", "10 · 软件：分析与工作流", "11 · 社区与中文入口", "12 · 量子化学程序与方法库", "13 · 周期体系与凝聚态", "14 · 波函数分析与动力学", "15 · 量子力学与量子化学课程", "16 · 量子计算与量子化学算法", "接入实况与边界", "细读质疑与使用提醒", "关键术语与附录"];
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
const toc = (current: number) => `<nav class="sg-toc" aria-label="讲解目录"><h2>说明讲解手册 · ${guides.length} 章</h2><ol>${guides.map((g, i) => `<li><a href="${esc(g.id)}.html"${i === current ? ' aria-current="page"' : ""}><span>${String(i + 1).padStart(2, "0")}</span>${esc(LABELS[i] || g.title)}</a></li>`).join("")}</ol></nav>`;
for (const [i, g] of guides.entries()) {
  const html = cleanGuide(g.html);
  const lead = strip(html.match(/<p class="lead">([\s\S]*?)<\/p>/)?.[1] || html.match(/<p[^>]*>([\s\S]*?)<\/p>/)?.[1] || "");
  const title = `${g.title} · 计算化学数据库说明讲解手册 · ${NAME}`;
  const description = clip(lead || `${g.title}：计算化学数据库与资源导航说明讲解手册第 ${i + 1} 章。`, 150);
  const prev = guides[i - 1], next = guides[i + 1];
  const path = `guide/${g.id}.html`;
  guidePages.push(path);
  const body = `<main class="sg">
${toc(i)}
<div class="sg-main">
  <div class="sg-tools"><nav class="sg-crumbs" aria-label="位置"><a href="../index.html">首页</a><span>/</span><a href="index.html">说明讲解手册</a><span>/</span><span>${esc(LABELS[i] || g.title)}</span></nav><a href="../manual/index.html#${esc(g.id)}">在阅读器中打开 <i class="ico-ext" aria-hidden="true"></i></a></div>
  <p class="en-only" translate="no">This chapter is written in Chinese. Your browser’s translate feature gives a full English version.</p>
  <article class="guide-article">
${html}
  </article>
  <nav class="sg-pager" aria-label="翻页">${prev ? `<a href="${esc(prev.id)}.html"><small><i class="ico-ext ico-left" aria-hidden="true"></i> 上一章</small>${esc(LABELS[i - 1] || prev.title)}</a>` : "<span></span>"}${next ? `<a href="${esc(next.id)}.html"><small>下一章 <i class="ico-ext ico-right" aria-hidden="true"></i></small>${esc(LABELS[i + 1] || next.title)}</a>` : ""}</nav>
</div>
<footer class="sg-foot">MolAstria · 计算化学数据库与资源导航说明讲解手册，材料版本 ${esc(content.date)}。全文、更新日期与使用许可以各资源原站为准。</footer>
</main>`;
  await write(path, page({
    rel: "../", path, title, description, section: "manual", css: ["theme-auto.css", "guide/guide.css"], body, type: "article",
    jsonld: [
      { "@context": "https://schema.org", "@type": "TechArticle", headline: g.title, description, inLanguage: "zh-CN", datePublished: content.date, dateModified: TODAY, isPartOf: { "@type": "WebSite", name: NAME, url: SITE }, mainEntityOfPage: SITE + path, image: SITE + "og.png", publisher: { "@type": "Organization", name: NAME, url: SITE } },
      crumbs([["首页", ""], ["说明讲解手册", "guide/"], [LABELS[i] || g.title, path]]),
    ],
  }));
}
await write("guide/index.html", page({
  rel: "../", path: "guide/", section: "manual", css: ["theme-auto.css", "guide/guide.css"],
  title: `计算化学数据库说明讲解手册（${guides.length} 章）· ${NAME}`,
  description: `从化合物、量子化学基准、晶体材料、生物大分子、药物、光谱到机器学习数据集与计算软件，${guides.length} 章讲解帮你判断该去哪个数据库、能拿到什么、边界在哪里。`,
  body: `<main class="sg">${toc(-1)}<div class="sg-main"><div class="sg-tools"><nav class="sg-crumbs" aria-label="位置"><a href="../index.html">首页</a><span>/</span><span>说明讲解手册</span></nav><a href="../manual/index.html">在阅读器中打开 <i class="ico-ext" aria-hidden="true"></i></a></div><article class="guide-article"><h1>计算化学数据库说明讲解手册</h1><p class="lead">一百零三个数据库与资源入口，按研究问题分层讲解：先分清去哪一层，再决定用哪个库。下面是全部 ${guides.length} 章。</p><ol>${guides.map((g, i) => `<li><a href="${esc(g.id)}.html">${esc(LABELS[i] || g.title)}</a> — ${esc(g.title)}</li>`).join("")}</ol></article></div><footer class="sg-foot">材料版本 ${esc(content.date)}。</footer></main>`,
  jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "计算化学数据库说明讲解手册", inLanguage: "zh-CN", url: SITE + "guide/", hasPart: guides.map((g) => ({ "@type": "TechArticle", headline: g.title, url: `${SITE}guide/${g.id}.html` })) }, crumbs([["首页", ""], ["说明讲解手册", "guide/"]])],
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
  body: `<main class="rs"><nav class="rs-crumbs" aria-label="位置"><a href="../index.html">首页</a> / 资源目录</nav><h1>计算化学资源目录</h1><p class="lead">${items.length} 条去重后的资源，快照日期 ${esc(cfg.dataDate)}。按类型浏览，或回到 <a href="../index.html">统一搜索</a>、<a href="../hub/network.html">网状查询</a>。</p><ul class="rs-types">${typeOrder.map((t) => `<li><a href="${SLUG[t] || t}.html">${esc(TYPES[t])}<span>${byType.get(t)!.length}</span></a></li>`).join("")}</ul><h2>数据库与研究资源（ChemDB Atlas · ${content.resources.length} 条）</h2>${[...atlasCats.entries()].map(([c, arr]) => `<h2>${esc(c)} <small class="muted">${arr.length}</small></h2><ul class="rs-list">${arr.map((r) => `<li><a href="${esc(r.url)}" target="_blank" rel="noopener">${esc(r.name)}</a><small>${esc(r.access)}</small><p>${esc(r.description)}</p></li>`).join("")}</ul>`).join("")}<p class="rs-foot">讲解手册见 <a href="../guide/index.html">${guides.length} 章讲解</a>。</p></main>`,
  jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "计算化学资源目录", inLanguage: "zh-CN", url: SITE + "resources/", numberOfItems: items.length }, crumbs([["首页", ""], ["资源目录", "resources/"]])],
}));

// ── main pages ───────────────────────────────────────────────────────────
const datasetDescription = `${items.length} 条计算化学研究资源的标题级索引，涵盖数据库、软件、中文教程、学术论文与开源项目。条目保留名称、简短说明、原始网址、来源、分类和主题标签，可用于资源检索与导航。数据来自项目保存的目录快照，完整内容及使用许可请以各原始网站为准。`;
// Google Dataset requires a description containing 50–5000 characters.
const datasetDescriptionLength = Array.from(datasetDescription).length;
if (datasetDescriptionLength < 50 || datasetDescriptionLength > 5000) {
  throw new Error(`Dataset description must contain 50–5000 characters; got ${datasetDescriptionLength}`);
}
// 化学学科馆：开放的展馆（chem-subjects.js 里 soon 的展馆还在准备，页面标 noindex，不进 sitemap）
load("chemistry/chem-subjects.js");
const chemSubjects = (globalThis as any).MOLASTRIA_CHEM_SUBJECTS;
const chemHalls: string[][] = chemSubjects.subjects.filter((s: string[]) => !(chemSubjects.soon || []).includes(s[0]));
const mains = [
  await injectHead("index.html", "", { jsonld: [website, { "@context": "https://schema.org", "@type": "Dataset", name: "MolAstria 计算化学资源目录", description: datasetDescription, url: SITE, inLanguage: "zh-CN", dateModified: cfg.dataDate, isAccessibleForFree: true, creator: { "@type": "Organization", name: NAME, url: SITE }, distribution: [{ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: SITE + "merged-data.json" }] }] }),
  await injectHead("atlas/index.html", "atlas/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "ChemDB Atlas 计算化学数据库导航", inLanguage: "zh-CN", url: SITE + "atlas/" }] }),
  await injectHead("manual/index.html", "manual/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebPage", name: "计算化学数据库说明讲解手册 · 阅读器", inLanguage: "zh-CN", url: SITE + "manual/" }] }),
  await injectHead("journals/index.html", "journals/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "期刊发表：计算化学期刊投稿与发表指南", inLanguage: "zh-CN", url: SITE + "journals/", isAccessibleForFree: true, about: ["computational chemistry journals", "quantum chemistry", "scholarly publishing", "peer review", "preprints"] }, crumbs([["首页", ""], ["期刊发表", "journals/"]])] }),
  await injectHead("videos/index.html", "videos/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "计算化学教学视频", inLanguage: "zh-CN", url: SITE + "videos/", isAccessibleForFree: true, about: ["computational chemistry tutorials", "quantum chemistry lectures", "density functional theory", "molecular dynamics tutorials", "teaching videos"] }, crumbs([["首页", ""], ["教学视频", "videos/"]])] }),
  await injectHead("scimodels/index.html", "scimodels/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "科学领域语言模型与多模态基础模型", inLanguage: "zh-CN", url: SITE + "scimodels/", isAccessibleForFree: true, about: ["scientific large language models", "multimodal foundation models", "chemistry language models", "AI for science", "LLM API pricing"] }, crumbs([["首页", ""], ["科学大模型", "scimodels/"]])] }),
  await injectHead("digest/index.html", "digest/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "MolAstria 每周精选 · Weekly Picks", inLanguage: "zh-CN", url: SITE + "digest/", isAccessibleForFree: true, description: "每周一从 ChemRxiv、arXiv 化学物理和计算化学期刊的新论文里挑出值得读的十篇左右，每篇一句解读；前五篇和点评公开。" }, crumbs([["首页", ""], ["每周精选", "digest/"]])] }),
  await injectHead("review/index.html", "review/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "MolAstria 复习卡片 · Review cards", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "review/", isAccessibleForFree: true, description: "中英术语、研习台的知识点和自己写的卡片，按 FSRS 间隔重复算法安排复习，可导出到 Anki。" }] }),
  await injectHead("pet/index.html", "pet/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "MolAstria 小宠物 · Pets", applicationCategory: "GameApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "pet/", isAccessibleForFree: true, description: "从三个 3D 吉祥物里领养一只：起名字、摸摸、喂食、陪它玩、哄它睡觉，升级解锁配饰。" }] }),
  await injectHead("shelf/index.html", "shelf/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "MolAstria 书架 · Bookshelf", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "shelf/", isAccessibleForFree: true, description: "站内各栏目推荐、逐本核对过的计算化学、量子物理、量子算法和数学教材，加上讲解手册 25 册；放上自己的书架，标在读、读完，写笔记，导出 BibTeX。" }] }),
  await injectHead("extract/index.html", "extract/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "MolAstria 文献信息抽取 · Literature Extractor", applicationCategory: "ScientificApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "extract/", isAccessibleForFree: true, description: "把化学论文里的反应图、底物表或一页 PDF 交给一组分工的 AI 智能体，读出反应物、产物、条件和产率；R 基团由规则代入枚举，SMILES 用 RDKit 核对，每条反应打分，导出 JSON 和 CSV。思路来自 ChemEAGLE（arXiv:2507.20230）。", about: ["chemical information extraction", "multi-agent system", "reaction scheme", "substrate scope", "SMILES", "RDKit", "PubChem", "ChemEAGLE"], citation: "https://arxiv.org/abs/2507.20230" }] }),
  await injectHead("workbench/index.html", "workbench/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "MolAstria 计算工作台 · Workbench", applicationCategory: "ScientificApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "workbench/", isAccessibleForFree: true, description: "在浏览器里读写九种结构格式（XYZ、PDB、MOL、CIF、POSCAR、Gaussian、ORCA、CDXML、cube），搭超胞和表面；写扫描、过渡态、IRC、NEB 的输入并画能量曲线；构象按 RMSD 归簇；标 R/S 和 E/Z；从 Molden 画分子轨道和电子密度，做 Hirshfeld 面、指纹图和 IGM / IGMH / IRI 弱相互作用图；读红外、拉曼、紫外和优化收敛；批量写输入和 Slurm / PBS 作业脚本。功能清单参照 Ester Studio，代码是独立重写的。", about: ["computational chemistry", "Hirshfeld surface", "independent gradient model", "IGMH", "Molden", "cube file", "reaction path", "nudged elastic band", "conformer clustering", "CIP stereodescriptors", "Raman spectrum", "Slurm", "Ester Studio"] }] }),
  await injectHead("paper/index.html", "paper/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "MolAstria 论文工坊 · Paper Studio", applicationCategory: "ScientificApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "paper/", isAccessibleForFree: true, description: "用你自己的大模型 API key，在浏览器里把想法和实验记录写成 LaTeX 论文：大纲、在 OpenAlex / Semantic Scholar / Crossref 找真实文献并核对、按实验记录画图、写全文、多位审稿人打分并按意见修改，导出 zip 或在 Overleaf 打开；另有科研工坊、投稿体检（双盲、编译日志、引用核对、arXiv 打包）和 LaTeX 助手。流程和提示词照 PaperOrchestra Studio（Apache-2.0）重写，key 只存在用户的浏览器里。", about: ["scientific writing", "LaTeX", "literature review", "citation verification", "peer review", "PaperOrchestra", "Overleaf", "arXiv submission", "bring your own key"] }] }),
  await injectHead("code/index.html", "code/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "MolAstria 开源代码台 · Code Desk", applicationCategory: "ScientificApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "code/", isAccessibleForFree: true, description: "从 SMILES 直接生成三维坐标，一个分子一键写出 PySCF、Psi4、xTB、CREST、ORCA、Gaussian、NWChem、CP2K、ASE 的输入和 QCSchema；读 xTB、ORCA、Psi4、Gaussian、PySCF、NWChem、CP2K、Q-Chem 的输出；查软件包的版本、许可证、已知漏洞和存档；跨引擎搜代码。", about: ["PySCF", "Psi4", "xtb", "ORCA", "NWChem", "CP2K", "Q-Chem", "OpenChemLib", "QCSchema", "cclib", "open-source licences", "Software Heritage", "OSV"] }] }),
  await injectHead("fundamental-science/index.html", "fundamental-science/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "进一步基础科学发现 · Advancing Fundamental Science", inLanguage: "zh-CN", url: SITE + "fundamental-science/", isAccessibleForFree: true, about: ["foundations of quantum mechanics", "quantum chemistry", "reduced density matrices", "Berry phase", "conical intersections", "objective collapse models", "open quantum systems"] }, crumbs([["首页", ""], ["进一步基础科学发现", "fundamental-science/"]])] }),
  await injectHead("fundamental-science/math/index.html", "fundamental-science/math/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "数学基础与探索 · Mathematical Foundations & Exploration", inLanguage: ["zh-CN", "en"], url: SITE + "fundamental-science/math/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "为量子力学基础与量子化学准备的数学地图：线性代数、泛函分析与谱理论、群论与表示论、微分几何与拓扑、概率与随机过程、数值分析、变分法、算子代数、张量网络、测度论；讲解、大纲、练习、核对过的教材与公开课视频。", about: ["linear algebra", "functional analysis", "spectral theory", "representation theory", "differential geometry", "stochastic processes", "numerical analysis", "variational methods", "operator algebras", "tensor networks", "measure theory", "quantum chemistry"] }, crumbs([["首页", ""], ["进一步基础科学发现", "fundamental-science/"], ["数学基础与探索", "fundamental-science/math/"]])] }),
  await injectHead("quantum/index.html", "quantum/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "量子嘉年华 · Quantum Carnival", inLanguage: ["zh-CN", "en"], url: SITE + "quantum/", isAccessibleForFree: true, description: "MolAstria 的量子母栏目：量子物理、量子计算机、量子算法、量子生物学四个展馆，中英双语讲解、交互演示与核对过的文献和课程。", about: ["quantum physics", "quantum mechanics", "quantum computing", "quantum algorithms", "quantum biology"] }, crumbs([["首页", ""], ["量子嘉年华", "quantum/"]])] }),
  await injectHead("quantum/biology/index.html", "quantum/biology/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "量子生物学 · Quantum Biology", inLanguage: ["zh-CN", "en"], url: SITE + "quantum/biology/", isAccessibleForFree: true, about: ["quantum biology", "photosynthetic energy transfer", "radical pair mechanism", "avian magnetoreception", "hydrogen tunnelling", "kinetic isotope effect", "proton tunnelling in DNA", "open quantum systems"] }, crumbs([["首页", ""], ["量子嘉年华", "quantum/"], ["量子生物学", "quantum/biology/"]])] }),
  await injectHead("quantum/physics/index.html", "quantum/physics/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "量子物理 · Quantum Physics", inLanguage: ["zh-CN", "en"], url: SITE + "quantum/physics/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "量子嘉年华的量子物理展馆：从量子的诞生到量子场、凝聚态与量子光学的十二章中英双语讲解，四个浏览器里实时计算的交互演示（一维定态、隧穿、Stern–Gerlach、Bell 不等式），关键实验时间线，以及核对过的原始论文、教材与公开课。", about: ["quantum mechanics", "Schrödinger equation", "quantum tunnelling", "angular momentum", "entanglement", "Bell inequality", "decoherence", "scattering theory", "relativistic quantum mechanics", "condensed matter physics", "quantum optics"] }, crumbs([["首页", ""], ["量子嘉年华", "quantum/"], ["量子物理", "quantum/physics/"]])] }),
  await injectHead("quantum/algorithms/index.html", "quantum/algorithms/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "量子算法 · Quantum Algorithms", inLanguage: ["zh-CN", "en"], url: SITE + "quantum/algorithms/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "从线路模型、量子傅里叶变换、相位估计、振幅放大和块编码，到 Shor、Grover、哈密顿量模拟、HHL、量子行走，再到费米子映射、化学基态能量的资源估算、VQE、QAOA 和误差缓解；每个算法标明加速的证据等级，配浏览器里的量子线路模拟器和交互演示，文献逐条核对。", about: ["quantum algorithms", "quantum phase estimation", "Shor's algorithm", "Grover search", "Hamiltonian simulation", "quantum signal processing", "variational quantum eigensolver", "quantum chemistry", "resource estimation"] }, crumbs([["首页", ""], ["量子嘉年华", "quantum/"], ["量子算法", "quantum/algorithms/"]])] }),
  await injectHead("quantum/computing/index.html", "quantum/computing/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "量子计算机 · Quantum Computers", inLanguage: ["zh-CN", "en"], url: SITE + "quantum/computing/", isAccessibleForFree: true, description: "量子计算机的物理层：量子比特的物理与噪声，超导、离子阱、中性原子、光子、半导体自旋和拓扑六条硬件路线，量子纠错与容错，量子优势实验与争议；附交互演示与核对过的文献。", about: ["quantum computing", "qubits", "superconducting qubits", "trapped ions", "neutral atoms", "quantum error correction", "surface code", "quantum advantage"] }, crumbs([["首页", ""], ["量子嘉年华", "quantum/"], ["量子计算机", "quantum/computing/"]])] }),
  await injectHead("macro/index.html", "macro/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "热、统计与流体 · Heat, Statistics and Flow", inLanguage: ["zh-CN", "en"], url: SITE + "macro/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "热力学、统计力学、流体力学、相变与重整化群四章：从可逆的元胞自动机讲到熵、Landauer 原理、黑洞热力学、系综与配分函数、Planck 公式、Ising 模型、格子气和格子 Boltzmann、Navier–Stokes 方程与湍流、临界指数、普适性、Kadanoff 块自旋和 Wilson 重整化群；十个在浏览器里当场计算的演示和 88 篇核对过的文献。", about: ["thermodynamics", "statistical mechanics", "fluid mechanics", "entropy", "cellular automata", "lattice Boltzmann method", "Ising model", "Navier–Stokes equations", "phase transitions", "critical phenomena", "renormalization group"] }, crumbs([["首页", ""], ["热、统计与流体", "macro/"]])] }),
  await injectHead("optics/index.html", "optics/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "光学 · Optics", inLanguage: ["zh-CN", "en"], url: SITE + "optics/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "光学八章：波和惠更斯–菲涅耳原理、干涉与相干性、菲涅耳和夫琅禾费衍射、光栅与光谱仪、X 射线晶体衍射、偏振与菲涅耳公式、几何光学与像差、傅里叶光学与阿贝成像、超分辨显微镜；十二个在浏览器里当场计算的演示和 46 篇核对过的文献。", about: ["optics", "diffraction", "interference", "X-ray crystallography", "polarization", "geometric optics", "Fourier optics", "microscopy"] }, crumbs([["首页", ""], ["光学", "optics/"]])] }),
  await injectHead("nmr/index.html", "nmr/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "核磁共振 · NMR", inLanguage: ["zh-CN", "en"], url: SITE + "nmr/", isAccessibleForFree: true, description: "核磁共振方法的发展与最新技术：脉冲傅里叶变换、多维谱、生物大分子、魔角旋转固体 NMR、超极化、磁共振成像、低场与零场、计算与机器学习；附五个交互演示与按 DOI 核对过的 203 篇文献。", about: ["nuclear magnetic resonance", "NMR spectroscopy", "solid-state NMR", "magic-angle spinning", "dynamic nuclear polarization", "hyperpolarization", "magnetic resonance imaging", "zero-field NMR"] }, crumbs([["首页", ""], ["核磁共振", "nmr/"]])] }),
  await injectHead("news/index.html", "news/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "化学与材料新闻 · Chemistry & Materials News, Explained", inLanguage: ["zh-CN", "en"], url: SITE + "news/", isAccessibleForFree: true, description: "最新的化学和材料研究图解：做了什么、怎么做到的、还差什么，配交互演示；每条链接原始论文，DOI 逐条核对。", about: ["metal-organic frameworks", "quantum sensing", "electron paramagnetic resonance", "optically detected magnetic resonance", "radical pairs", "spin polarization"] }, crumbs([["首页", ""], ["化学与材料新闻", "news/"]])] }),
  await injectHead("toronto/index.html", "toronto/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "多伦多大学 · AI 化学与材料 · U of T AI for Chemistry & Materials", inLanguage: ["zh-CN", "en"], url: SITE + "toronto/", isAccessibleForFree: true, description: "多伦多大学里做 AI 化学、材料发现、自驱实验室和计算化学的组织：加速联盟、Matter Lab、清洁能源实验室、A3MD、von Lilienfeld 组、Vector 研究所、SciNet Trillium 等，每条事实带出处。", about: ["self-driving laboratories", "materials discovery", "Acceleration Consortium", "University of Toronto", "machine learning for chemistry"] }, crumbs([["首页", ""], ["多伦多大学 · AI 化学与材料", "toronto/"]])] }),
  await injectHead("industry/index.html", "industry/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "AI 化学与材料企业图谱 · AI Chemistry & Materials Companies", inLanguage: ["zh-CN", "en"], url: SITE + "industry/", isAccessibleForFree: true, description: "做 AI 化学、材料发现、计算化学软件、量子化学计算和实验自动化的八十多家公司，各一句话，标出和多伦多大学有据可查的关系。", about: ["AI for chemistry", "materials informatics", "computational chemistry software", "quantum computing", "laboratory automation"] }, crumbs([["首页", ""], ["AI 化学与材料企业图谱", "industry/"]])] }),
  await injectHead("nmr/nmrium/index.html", "nmr/nmrium/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "NMRium 谱图处理 · MolAstria", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "nmr/nmrium/", isAccessibleForFree: true, codeRepository: "https://github.com/cheminfo/nmrium", description: "在浏览器里用开源的 NMRium 处理核磁数据：JCAMP-DX、Bruker、原始 FID，傅里叶变换、相位、基线、积分、找峰和二维谱；数据不上传。" }, crumbs([["首页", ""], ["核磁共振", "nmr/"], ["NMRium 谱图处理", "nmr/nmrium/"]])] }),
  await injectHead("nmr/walkthrough/index.html", "nmr/walkthrough/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "逐步解谱讲解 · NMR walkthroughs · MolAstria", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "nmr/walkthrough/", isAccessibleForFree: true, codeRepository: "https://github.com/FelixJiashengFu/nmr-walkthrough", description: "核磁解谱点一下动一步：谱图放大高亮一个信号，结构长出一块，配观察、依据、结论、核对四句讲解；三个实测数据的示例（巴豆酸乙酯、香草醛、布洛芬），也能贴上自己的峰表、用自己的大模型 API key 生成，网页逐个核对每个数是否来自用户的数据。", about: ["NMR spectroscopy", "structure elucidation", "HSQC", "HMBC", "COSY", "chemistry education", "bring your own key"] }, crumbs([["首页", ""], ["核磁共振", "nmr/"], ["逐步解谱讲解", "nmr/walkthrough/"]])] }),
  await injectHead("spectra/index.html", "spectra/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "谱图馆 · Spectra Hall", inLanguage: ["zh-CN", "en"], url: SITE + "spectra/", isAccessibleForFree: true, description: "91 种分析方法的谱图怎么来、怎么读：红外、拉曼、紫外、荧光、质谱、GC-MS、LC-MS、色谱、核磁、顺磁、X 射线衍射、光电子能谱、原子光谱、热分析、电化学，以及冷冻电镜、测序、凝胶电泳、光散射、超速离心等大分子与高分子的方法；开放许可的实测质谱、量化计算的红外拉曼紫外谱、78 个交互演示、16 张速查表和 178 篇文献，每张图都写明来源。", about: ["analytical chemistry", "spectroscopy", "infrared spectroscopy", "Raman spectroscopy", "mass spectrometry", "GC-MS", "LC-MS", "chromatography", "X-ray diffraction", "X-ray photoelectron spectroscopy", "thermal analysis", "cyclic voltammetry"] }, crumbs([["首页", ""], ["谱图馆", "spectra/"]])] }),
  await injectHead("quasiparticles/index.html", "quasiparticles/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "准粒子 · Quasiparticles", inLanguage: ["zh-CN", "en"], url: SITE + "quasiparticles/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "准粒子十二章：什么是准粒子（谱函数判据）、声子、空穴和有效质量、费米液体、磁振子、激子、极化子、等离激元、极化激元、库珀对和 Bogoliubov 准粒子、任意子和 Majorana、怎样测量准粒子（中子、光谱、ARPES）；十三个在浏览器里当场计算的演示和 57 篇按 DOI 核对过的文献。", about: ["quasiparticles", "phonons", "holes", "Fermi liquid", "magnons", "excitons", "polarons", "plasmons", "polaritons", "BCS theory", "anyons", "Majorana zero modes", "ARPES"] }, crumbs([["首页", ""], ["准粒子", "quasiparticles/"]])] }),
  await injectHead("quasiparticles/phonons/index.html", "quasiparticles/phonons/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "声子 · Phonons", inLanguage: ["zh-CN", "en"], url: SITE + "quasiparticles/phonons/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "声子馆九章：一维原子链、双原子链和光学支、三维晶体和布里渊区、声子的量子化和态密度、热容（Einstein 和 Debye）、中子散射和拉曼、非谐性与热膨胀、晶格热导率、冻结声子和机器学习势；十一个在浏览器里当场计算的演示和 53 篇核对过的文献。", about: ["phonons", "lattice dynamics", "Brillouin zone", "density of states", "Debye model", "neutron scattering", "Raman spectroscopy", "thermal conductivity", "phonopy", "machine-learned interatomic potentials"] }, crumbs([["首页", ""], ["准粒子", "quasiparticles/"], ["声子", "quasiparticles/phonons/"]])] }),
  await injectHead("group-theory/index.html", "group-theory/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "群论 · Group Theory", inLanguage: ["zh-CN", "en"], url: SITE + "group-theory/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "群论十二章：什么是群、分子点群和判定流程图、表示和特征标表、约化公式和直积、分子轨道、分子振动和红外拉曼选择定则、晶体场和配位场、晶体的对称（平面群、空间群）、李群和李代数、角动量和 Wigner–Eckart 定理、能带和拓扑、对称性破缺和今天的群论；十五个在浏览器里当场计算的演示（含贴 XYZ 坐标判定点群）和 54 篇按 DOI 核对过的文献。", about: ["group theory", "point groups", "character tables", "representation theory", "molecular vibrations", "selection rules", "ligand field theory", "space groups", "Lie groups", "angular momentum", "band theory", "symmetry breaking"] }, crumbs([["首页", ""], ["群论", "group-theory/"]])] }),
  await injectHead("md/index.html", "md/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "分子动力学与自由能 · Molecular Dynamics & Free Energy", inLanguage: ["zh-CN", "en"], url: SITE + "md/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "分子动力学与自由能十章：模拟盒子和周期性边界、积分器和影子哈密顿量、恒温器和系综、力场、炼金术自由能（FEP、热力学积分、BAR、MBAR）、伞形采样和 WHAM、元动力学和增强采样、Jarzynski 等式和非平衡功、马尔可夫态模型、误差棒和机器学习势；十二个在浏览器里当场计算的演示和 78 篇按 DOI 核对过的文献。", about: ["molecular dynamics", "integrators", "thermostats", "force fields", "free energy perturbation", "thermodynamic integration", "umbrella sampling", "metadynamics", "Jarzynski equality", "Markov state models"] }, crumbs([["首页", ""], ["分子动力学与自由能", "md/"]])] }),
  await injectHead("dft/index.html", "dft/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "密度泛函理论 · Density Functional Theory", inLanguage: ["zh-CN", "en"], url: SITE + "dft/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "密度泛函理论十章：为什么用密度、Hohenberg–Kohn 定理、Kohn–Sham 方程和自洽场、Jacob 阶梯上的泛函、自相互作用和离域误差与带隙问题、色散修正、基组赝势和 k 点、固体的状态方程和带隙、含时 DFT 和激发态、格点和选泛函；十二个在浏览器里当场计算的演示和 70 篇按 DOI 核对过的文献。", about: ["density functional theory", "Hohenberg–Kohn theorems", "Kohn–Sham equations", "exchange–correlation functionals", "Jacob's ladder", "delocalization error", "band gap problem", "dispersion correction", "plane waves", "pseudopotentials", "equation of state", "time-dependent DFT"] }, crumbs([["首页", ""], ["密度泛函理论", "dft/"]])] }),
  await injectHead("reaction/index.html", "reaction/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "反应动力学与过渡态 · Reaction Kinetics & Transition States", inLanguage: ["zh-CN", "en"], url: SITE + "reaction/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "反应动力学与过渡态八章：势能面和驻点、反应路径（NEB、IRC）、过渡态理论和 Eyring 公式、RRKM 和压力下降曲线、隧穿修正、动力学同位素效应、微观动力学和火山图、能量跨度模型；十三个在浏览器里当场计算的演示和 54 篇按 DOI 核对过的文献。", about: ["reaction kinetics", "transition state theory", "potential energy surfaces", "nudged elastic band", "intrinsic reaction coordinate", "RRKM theory", "quantum tunnelling", "kinetic isotope effects", "microkinetic modelling", "energetic span model"] }, crumbs([["首页", ""], ["反应动力学与过渡态", "reaction/"]])] }),
  await injectHead("em/index.html", "em/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "电磁学与介电 · Electromagnetism & Dielectrics", inLanguage: ["zh-CN", "en"], url: SITE + "em/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "电磁学与介电十二章：麦克斯韦方程、静电学和拉普拉斯方程、多极展开、介电常数和 Onsager–Kirkwood 理论、连续介质溶剂化模型（Born、PCM、COSMO、SMD）、Debye 弛豫和微波加热、介电谱和 Kramers–Kronig、静磁学、顺磁和铁磁、偶极辐射和散射、电磁学和量子（Aharonov–Bohm、色散力、Casimir）、Ewald 求和和可极化力场；十五个在浏览器里当场计算的演示和 55 篇按 DOI 核对过的文献。", about: ["electromagnetism", "Maxwell equations", "electrostatics", "multipole expansion", "dielectric constant", "continuum solvation models", "Debye relaxation", "dielectric spectroscopy", "magnetism", "dipole radiation", "dispersion forces", "Ewald summation"] }, crumbs([["首页", ""], ["电磁学与介电", "em/"]])] }),
  await injectHead("tensor/index.html", "tensor/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "张量网络与强关联 · Tensor Networks & Strong Correlation", inLanguage: ["zh-CN", "en"], url: SITE + "tensor/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "张量网络与强关联十章：强关联和指数墙、纠缠和面积律、矩阵乘积态、DMRG、时间演化和纠缠增长、二维的 PEPS 和 MERA、量子化学 DMRG 和轨道排序、和 CASSCF 对照、FeMoco 和铁硫簇、量子线路和量子优越性；十四个在浏览器里当场计算的演示（含真跑的两格点 DMRG）和 95 篇按 DOI 核对过的文献。", about: ["tensor networks", "strong correlation", "entanglement", "area law", "matrix product states", "DMRG", "PEPS", "CASSCF", "active space", "FeMoco", "iron-sulfur clusters", "quantum advantage"] }, crumbs([["首页", ""], ["张量网络与强关联", "tensor/"]])] }),
  await injectHead("photochem/index.html", "photochem/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "光化学与激发态 · Photochemistry & Excited States", inLanguage: ["zh-CN", "en"], url: SITE + "photochem/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "光化学与激发态十一章：光的吸收、Jablonski 图、Franck–Condon 原理、Kasha 规则和能隙律、能量转移和激子、锥形交叉和 Landau–Zener、Marcus 电子转移和倒置区、热活化延迟荧光、光催化、视觉 DNA 光合作用和磁感里的光化学、瞬态吸收和飞秒化学；十五个在浏览器里当场计算的演示和 72 篇按 DOI 核对过的文献。", about: ["photochemistry", "excited states", "Jablonski diagram", "Franck–Condon principle", "Kasha's rule", "energy transfer", "conical intersections", "Marcus theory", "TADF", "photoredox catalysis", "transient absorption"] }, crumbs([["首页", ""], ["光化学与激发态", "photochem/"]])] }),
  await injectHead("nequip/index.html", "nequip/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "NequIP · E(3)-equivariant interatomic potentials", inLanguage: ["zh-CN", "en"], url: SITE + "nequip/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "NequIP 八章：为什么需要机器学习势、不变与等变、球谐函数和不可约表示、张量积与 Clebsch–Gordan 系数、NequIP 的结构、力和能量守恒、论文的实验与数据效率、训练部署与 Allegro、MACE、基础模型；十个在浏览器里当场计算的演示和 36 篇核对过的文献。", about: ["NequIP", "equivariant neural networks", "machine-learned interatomic potentials", "spherical harmonics", "Clebsch–Gordan coefficients", "molecular dynamics", "Allegro", "MACE"] }, crumbs([["首页", ""], ["NequIP", "nequip/"]])] }),
  await injectHead("chem-ml/index.html", "chem-ml/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "Chemistry machine learning", inLanguage: ["zh-CN", "en"], url: SITE + "chem-ml/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "化学机器学习十章：为什么用机器学习、分子表示（SMILES、指纹、Coulomb 矩阵）、高斯过程、神经网络和消息传递、贝叶斯优化、主动学习、生成模型、自驱实验室、评估的陷阱（骨架划分、数据泄漏、校准）、前沿；十八个在浏览器里当场计算的演示（含一张 Chemiscope 结构–性质图）和 67 篇核对过的文献。", about: ["machine learning in chemistry", "molecular fingerprints", "Gaussian processes", "Bayesian optimization", "active learning", "generative models", "self-driving laboratories", "scaffold split", "data leakage"] }, crumbs([["首页", ""], ["化学机器学习", "chem-ml/"]])] }),
  await injectHead("world-models/index.html", "world-models/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "世界模型 · World Models", inLanguage: ["zh-CN", "en"], url: SITE + "world-models/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "世界模型十一章：什么是世界模型、潜空间和状态空间模型、在想象里学（Dyna、World Models、Dreamer）、用模型规划（MPC、MuZero）、JEPA 和自监督表征、视频世界模型（Genie、Cosmos）、学出来的物理模拟器（GNS、DMD、力匹配）、天气和地球系统（GraphCast、GenCast）、分子世界（马尔可夫态模型、学出来的传播器、机器学习势）、实验室世界模型（贝叶斯优化、自驱实验室）、什么时候该相信世界模型；每章写明和化学研究的联系，附约七十个世界物理模型的总览、十三个在浏览器里当场计算的演示和 80 篇按 DOI / arXiv 核对过的文献。", about: ["world models", "model-based reinforcement learning", "Dreamer", "MuZero", "JEPA", "video world models", "learned simulators", "dynamic mode decomposition", "weather forecasting", "Markov state models", "machine learning potentials", "self-driving laboratories"] }, crumbs([["首页", ""], ["世界模型", "world-models/"]])] }),
  await injectHead("protein-design/index.html", "protein-design/", { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: "AI 蛋白质设计 · AI Protein Design", inLanguage: ["zh-CN", "en"], url: SITE + "protein-design/", isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "AI 蛋白质设计十一章：设计是一道反问题、折叠的物理和 HP 模型、Rosetta 和 Top7 的二十年、协同进化与蛋白质语言模型（ESM、ProGen、Evo）、逆折叠（ProteinMPNN、LigandMPNN）、扁散生成骱架（RFdiffusion、Chroma、Proteina）、结合蛋白与抗体（AlphaProteo、BindCraft、Chai-2、RFantibody）、从头设计的酶、通用大模型（OpenAI GPT-4b micro 和 GPT-6）、怎么判断一份成果的真假、生物安全与治理；55 项成果逐项标明证据等级和权重开放程度，十二个在浏览器里当场计算的演示，79 篇文献按 DOI 核对过。", about: ["protein design", "AlphaFold", "ProteinMPNN", "RFdiffusion", "ESM", "protein language models", "de novo enzymes", "binder design", "antibody design", "OpenAI", "biosecurity", "nucleic acid synthesis screening"] }, crumbs([["首页", ""], ["AI 蛋白质设计", "protein-design/"]])] }),
  await injectHead("ai-math/index.html", "ai-math/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "前沿 AI 数学 · Frontier AI Mathematics", inLanguage: ["zh-CN", "en"], url: SITE + "ai-math/", isAccessibleForFree: true, description: "前沿 AI 背后的数学：44 个主题从线性代数、优化几何、Transformer 到扩散、流匹配、强化学习与科学 AI，每个主题一个在浏览器里现算的演示，另有 12 篇附录推导、数值核验和核对过的 43 条参考资料。", about: ["machine learning mathematics", "transformers", "diffusion models", "flow matching", "reinforcement learning", "natural gradient", "optimal transport", "scientific machine learning"] }, crumbs([["首页", ""], ["前沿 AI 数学", "ai-math/"]])] }),
  await injectHead("chemistry/index.html", "chemistry/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "化学学科馆 · Chemistry Disciplines", inLanguage: ["zh-CN", "en"], url: SITE + "chemistry/", isAccessibleForFree: true, description: "十四门化学学科的展馆：无机、有机、物理、分析、结构、量子与计算、配位与金属有机、电化学、高分子、生物、材料、环境、核化学与放射化学、化学工程；分章讲解、核心公式、现算的演示和按 DOI 核对的文献。", hasPart: chemHalls.map(([id, , , zh, en]) => ({ "@type": "Course", name: `${zh} · ${en}`, url: SITE + `chemistry/${id}/` })) }] }),
  ...(await Promise.all(chemHalls.map(([id, , , zh, en]) => injectHead(`chemistry/${id}/index.html`, `chemistry/${id}/`, { jsonld: [{ "@context": "https://schema.org", "@type": "Course", name: `${zh} · ${en}`, inLanguage: ["zh-CN", "en"], url: SITE + `chemistry/${id}/`, isAccessibleForFree: true, provider: { "@type": "Organization", name: "MolAstria", url: SITE }, isPartOf: { "@type": "CollectionPage", name: "化学学科馆 · Chemistry Disciplines", url: SITE + "chemistry/" } }] })))),
  await injectHead("hub/index.html", "hub/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "计算化学论文与社区", inLanguage: "zh-CN", url: SITE + "hub/" }] }),
  await injectHead("hub/network.html", "hub/network.html"),
  await injectHead("pro/index.html", "pro/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebPage", name: "MolAstria Pro", inLanguage: "zh-CN", url: SITE + "pro/" }] }),
  await injectHead("download/index.html", "download/", { jsonld: [{ "@context": "https://schema.org", "@type": "SoftwareApplication", name: "MolAstria Desktop", applicationCategory: "EducationalApplication", operatingSystem: "Windows 10, Windows 11, macOS 11+", url: SITE + "download/", downloadUrl: "https://github.com/FelixJiashengFu/chem-research-molastria/releases/latest", offers: { "@type": "Offer", price: "0", priceCurrency: "USD" } }] }),
  await injectHead("about/index.html", "about/", { jsonld: [{ "@context": "https://schema.org", "@type": "AboutPage", name: "关于 · Morning Glory 阿斯特赖亚科技与 MolAstria", inLanguage: "zh-CN", url: SITE + "about/", mainEntity: { "@type": "Organization", name: "Morning Glory", alternateName: ["阿斯特赖亚科技"], legalName: "16513778 Canada Inc.", slogan: "Intelligence Beyond Boundaries.", url: SITE + "about/", address: { "@type": "PostalAddress", addressLocality: "Toronto", addressRegion: "ON", addressCountry: "CA" }, knowsAbout: ["artificial intelligence", "intelligent automation", "data science", "computational chemistry", "quantum chemistry", "scientific machine learning"] } }, crumbs([["首页", ""], ["关于", "about/"]])] }),
  await injectHead("api/index.html", "api/", { jsonld: [{ "@context": "https://schema.org", "@type": "Dataset", name: "MolAstria 开放数据接口 · MolAstria open data API", description: "MolAstria 整理的计算化学开放数据，中英双语的静态 JSON：资源目录（数据库、软件、数据集、课程）、期刊投稿指南、科学大模型与官方价格、教学视频和中英术语表。免费、不用注册、不用 key。Curated, bilingual open data for computational chemistry as static JSON: a resource catalogue, a journal guide, science foundation models with official prices, teaching videos and a Chinese-English term table. Free, no sign-up, no key.", url: SITE + "api/", inLanguage: ["zh-CN", "en"], isAccessibleForFree: true, license: "https://creativecommons.org/licenses/by/4.0/", keywords: ["computational chemistry", "quantum chemistry", "open data", "计算化学", "开放数据"], creator: { "@type": "Organization", name: NAME, url: SITE }, distribution: ["index", "resources", "journals", "scimodels", "videos", "terms"].map((id) => ({ "@type": "DataDownload", encodingFormat: "application/json", contentUrl: `${SITE}api/v1/${id}.json` })) }] }),
  await injectHead("pro/terms.html", "pro/terms.html"),
  await injectHead("pro/refund.html", "pro/refund.html"),
  await injectHead("pro/privacy.html", "pro/privacy.html"),
  await injectHead("train/index.html", "train/", { type: "article", jsonld: [{ "@context": "https://schema.org", "@type": "TechArticle", headline: "用开源小模型训练你自己的化学研究 Agent", inLanguage: "zh-CN", url: SITE + "train/", datePublished: "2026-10-28", dateModified: TODAY, image: SITE + "og.png", publisher: { "@type": "Organization", name: NAME, url: SITE }, about: ["small language models", "chemistry agents", "LoRA", "GRPO", "RDKit"] }, crumbs([["首页", ""], ["训练 Agent", "train/"]])] }),
  await injectHead("radar/index.html", "radar/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "预印本雷达 PreprintRadar", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: "zh-CN", url: SITE + "radar/", isAccessibleForFree: true, codeRepository: "https://github.com/FelixJiashengFu/PreprintRadar", description: "同时检索 arXiv、ChemRxiv、bioRxiv 等 28 个预印本平台与开放仓库的最新论文，按兴趣主题定时推荐，一键导出 PDF 合集。" }] }),
  await injectHead("research-atlas/index.html", "research-atlas/", { jsonld: [{ "@context": "https://schema.org", "@type": "Dataset", name: "中美·研究图谱", inLanguage: "zh-CN", url: SITE + "research-atlas/", isAccessibleForFree: true, license: "https://creativecommons.org/publicdomain/zero/1.0/", creator: { "@type": "Person", name: "Jiasheng Fu" }, description: "中美二十所大学的数学、物理、化学教授合作网络，北美与中国量子化学 / 计算化学课题组地图，Top 20 学者档案，中美细分方向对比与北美计算化学产业报告。数据来自 OpenAlex。" }] }),
  await injectHead("physics-realms/index.html", "physics-realms/", { jsonld: [{ "@context": "https://schema.org", "@type": "LearningResource", name: "物理疆界图 · Realms of Physics", inLanguage: ["zh-CN", "en"], url: SITE + "physics-realms/", isAccessibleForFree: true, learningResourceType: "interactive graph", provider: { "@type": "Organization", name: "MolAstria", url: SITE }, description: "经典力学、电磁学、热力学与统计物理、相对论、量子力学、量子场论、凝聚态、宇宙学与量子引力前沿的理论，连同它们能解释和解释不了的问题，画成一张网状图；每个理论都写明适用范围和失效之处。", about: ["classical mechanics", "electromagnetism", "thermodynamics", "statistical mechanics", "special relativity", "general relativity", "quantum mechanics", "quantum field theory", "condensed matter physics", "cosmology", "quantum gravity", "domain of validity"] }, crumbs([["首页", ""], ["物理疆界图", "physics-realms/"]])] }),
  await injectHead("qchem/index.html", "qchem/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "MolAstria 游乐场", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: "zh-CN", url: SITE + "qchem/", isAccessibleForFree: true, description: "用真实的物理公式玩量子世界的二十个小游戏：量子化学（盒中粒子、氢原子轨道、电子排布、量子隧穿、Hückel 芳香性、氢原子光谱），量子嘉年华（Stern–Gerlach 自旋过滤、CHSH 贝尔游戏、量子电路拼图、三比特纠错、Grover 搜索、噪声辅助的能量传递、二维波包画墙），物理疆界（普朗克单位、ħ-c-G 立方体），3D 立体馆（价层电子对排布、手性 R/S、密勒晶面、Bloch 球导航、量子世界），以及在浏览器里运行的量子化学计算器 QChem Web。" }] }),
  await injectHead("particles/index.html", "particles/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "GPU 粒子力场 · Particle HIVE", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "particles/", isAccessibleForFree: true, codeRepository: "https://github.com/0ffz/particle-hive", license: "https://opensource.org/licenses/MIT", description: "浏览器内置 WebGPU 粒子计算着色器模拟器，支持 Lennard-Jones、Morse 自组装、Tersoff 多体键序势与恒定重力外场，提供三维视角、DBSCAN 实时聚类、均方速率统计与预设 YAML 配置。" }] }),
  await injectHead("open-models/index.html", "open-models/", { jsonld: [{ "@context": "https://schema.org", "@type": "CollectionPage", name: "开放模型馆 · Open Model Hall", inLanguage: ["zh-CN", "en"], url: SITE + "open-models/", isAccessibleForFree: true, description: "Meta、Google DeepMind、微软、英伟达、深势科技、字节跳动、IBM、百度、Orbital Materials、Chai Discovery、Rowan、上海人工智能实验室、商汤科技开放给科研的化学、材料与生物分子 AI 模型、科学大模型、数据集和工具，每条写明使用条件和原始出处，并按任务比较。", about: ["machine-learning interatomic potentials", "protein structure prediction", "generative materials design", "machine-learned density functionals"] }] }),
  await injectHead("open-models/deepmind/index.html", "open-models/deepmind/"),
  await injectHead("open-models/microsoft/index.html", "open-models/microsoft/"),
  await injectHead("open-models/nvidia/index.html", "open-models/nvidia/"),
  await injectHead("open-models/dp/index.html", "open-models/dp/"),
  await injectHead("open-models/bytedance/index.html", "open-models/bytedance/"),
  await injectHead("open-models/ibm/index.html", "open-models/ibm/"),
  await injectHead("open-models/baidu/index.html", "open-models/baidu/"),
  await injectHead("open-models/orbital/index.html", "open-models/orbital/"),
  await injectHead("open-models/chai/index.html", "open-models/chai/"),
  await injectHead("open-models/rowan/index.html", "open-models/rowan/"),
  await injectHead("open-models/shlab/index.html", "open-models/shlab/"),
  await injectHead("open-models/sensetime/index.html", "open-models/sensetime/"),
  await injectHead("vision/index.html", "vision/", { jsonld: [{ "@context": "https://schema.org", "@type": "Article", headline: "工业革命2.5：我愿成为“曼哈顿计划2.0”的一份子", alternativeHeadline: "Industrial Revolution 2.5: why I want to be part of Manhattan Project 2.0", inLanguage: ["zh-CN", "en"], url: SITE + "vision/", datePublished: "2026-11-10", author: { "@type": "Person", name: "Jiasheng Fu" }, publisher: { "@type": "Organization", name: "MolAstria", url: SITE } }, crumbs([["首页", ""], ["愿景", "vision/"]])] }),
  await injectHead("programming/index.html", "programming/", { jsonld: [{ "@context": "https://schema.org", "@type": "LearningResource", name: "计算物理与化学的编程语言 · Programming languages for computational physics and chemistry", inLanguage: ["zh-CN", "en"], url: SITE + "programming/", isAccessibleForFree: true, learningResourceType: "tutorial", provider: { "@type": "Organization", name: NAME, url: SITE }, about: ["Python", "Fortran", "C++", "Julia", "OpenMP", "MPI", "CUDA", "MATLAB", "R", "SQL", "Bash", "OpenQASM"] }] }),
  await injectHead("meta/index.html", "meta/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebPage", name: "Meta × 化学：Muse 识图、UMA 脚本与开放数据集", inLanguage: "zh-CN", url: SITE + "meta/", isAccessibleForFree: true, about: ["Universal Model for Atoms (UMA)", "Open Molecules 2025 (OMol25)", "fairchem", "Meta Muse"] }] }),
  await injectHead("models/index.html", "models/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "量子化学模型接口：15 个机器学习势在线计算", applicationCategory: "ScientificApplication", operatingSystem: "Web", inLanguage: "zh-CN", url: SITE + "models/", isAccessibleForFree: true, about: ["Universal Model for Atoms (UMA)", "Open Molecules 2025 (OMol25)", "MACE-OFF23", "ANI-2x", "machine learning interatomic potentials"] }] }),
  await injectHead("learn/index.html", "learn/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebApplication", name: "研习台 · Study Desk", applicationCategory: "EducationalApplication", operatingSystem: "Web", inLanguage: ["zh-CN", "en"], url: SITE + "learn/", isAccessibleForFree: true, provider: { "@type": "Organization", name: NAME, url: SITE }, description: "AI 家教：先用诊断题摸底，再画出从已会到目标的依赖路线，一步一讲、每步一道检查题；练习跨主题穿插，学到的命题和推理链积累成跨会话的知识图。可以从站内量子物理、数学基础等章节开始，用自己的 AI key，数据只存在本机。", about: ["quantum physics", "mathematics", "quantum computing", "computational chemistry", "tutoring"] }] }),
  await injectHead("chat/index.html", "chat/", { jsonld: [{ "@context": "https://schema.org", "@type": "WebPage", name: "讨论室 · Discussion Rooms", inLanguage: ["zh-CN", "en"], url: SITE + "chat/", isAccessibleForFree: true, provider: { "@type": "Organization", name: NAME, url: SITE }, description: "和做计算化学、量子化学与分子模拟的人实时聊天：量子化学与 DFT、机器学习势、软件报错求助、论文与预印本等主题房间，也可以自己开一间。不用登录就能看，登录后取一个昵称发言。", about: ["computational chemistry", "quantum chemistry", "density functional theory", "machine learning interatomic potentials"] }, crumbs([["首页", ""], ["讨论室", "chat/"]])] }),
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
<main class="rs"><h1>这个页面不存在</h1><p class="lead">链接可能已经改名。可以从这些入口继续：</p><ul class="rs-types"><li><a href="${SITE}">统一搜索<span><i class="ico-ext" aria-hidden="true"></i></span></a></li><li><a href="${SITE}resources/">资源目录<span><i class="ico-ext" aria-hidden="true"></i></span></a></li><li><a href="${SITE}guide/">说明讲解手册<span><i class="ico-ext" aria-hidden="true"></i></span></a></li><li><a href="${SITE}lab/">AI 实验室<span><i class="ico-ext" aria-hidden="true"></i></span></a></li></ul></main>
</body>
</html>
`);
const urls = [
  ["", "1.0", "weekly"], ["lab/", "0.9", "weekly"], ["meta/", "0.8", "monthly"], ["models/", "0.8", "weekly"], ["train/", "0.9", "weekly"], ["radar/", "0.8", "weekly"], ["research-atlas/", "0.8", "monthly"], ["qchem/", "0.8", "monthly"], ["download/", "0.8", "monthly"], ["about/", "0.5", "yearly"], ["pro/", "0.7", "monthly"], ["pro/terms.html", "0.2", "yearly"], ["pro/refund.html", "0.2", "yearly"], ["pro/privacy.html", "0.2", "yearly"], ["resources/", "0.9", "weekly"], ["guide/", "0.8", "monthly"],
  ["manual/", "0.8", "monthly"], ["journals/", "0.8", "monthly"], ["scimodels/", "0.8", "monthly"], ["videos/", "0.8", "monthly"], ["fundamental-science/", "0.8", "monthly"], ["fundamental-science/math/", "0.8", "monthly"], ["digest/", "0.8", "weekly"], ["atlas/", "0.8", "monthly"], ["hub/", "0.7", "weekly"], ["hub/network.html", "0.6", "monthly"],
  ["api/", "0.7", "monthly"],
  ["quantum/", "0.8", "monthly"],
  ["quantum/biology/", "0.8", "monthly"],
  ["quantum/physics/", "0.8", "monthly"],
  ["quantum/algorithms/", "0.8", "monthly"],
  ["quantum/computing/", "0.8", "monthly"],
  ["nmr/", "0.8", "monthly"],
  ["nmr/nmrium/", "0.6", "monthly"],
  ["nmr/walkthrough/", "0.7", "monthly"],
  ["macro/", "0.8", "monthly"],
  ["optics/", "0.8", "monthly"],
  ["news/", "0.8", "weekly"],
  ["toronto/", "0.7", "monthly"],
  ["industry/", "0.7", "monthly"],
  ["spectra/", "0.8", "monthly"],
  ["ai-math/", "0.8", "monthly"],
  ["nequip/", "0.8", "monthly"],
  ["chem-ml/", "0.8", "monthly"],
  ["world-models/", "0.8", "monthly"],
  ["protein-design/", "0.8", "monthly"],
  ["quasiparticles/", "0.8", "monthly"],
  ["quasiparticles/phonons/", "0.8", "monthly"],
  ["group-theory/", "0.8", "monthly"],
  ["md/", "0.8", "monthly"],
  ["dft/", "0.8", "monthly"],
  ["reaction/", "0.8", "monthly"],
  ["em/", "0.8", "monthly"],
  ["tensor/", "0.8", "monthly"],
  ["photochem/", "0.8", "monthly"],
  ["chemistry/", "0.8", "monthly"],
  ...chemHalls.map(([id]) => [`chemistry/${id}/`, "0.7", "monthly"]),
  ...guidePages.map((p) => [p, "0.7", "monthly"]), ...resourcePages.map((p) => [p, "0.5", "weekly"]),
  ["physics-realms/", "0.8", "monthly"],
  ["learn/", "0.8", "monthly"],
  ["extract/", "0.7", "monthly"],
  ["workbench/", "0.8", "monthly"],
  ["paper/", "0.8", "monthly"],
  ["particles/", "0.8", "monthly"],
  ["chat/", "0.7", "daily"],
  ["open-models/", "0.8", "monthly"],
  ["open-models/deepmind/", "0.6", "monthly"],
  ["open-models/microsoft/", "0.6", "monthly"],
  ["open-models/nvidia/", "0.6", "monthly"],
  ["open-models/dp/", "0.6", "monthly"],
  ["open-models/bytedance/", "0.6", "monthly"],
  ["open-models/ibm/", "0.6", "monthly"],
  ["open-models/baidu/", "0.6", "monthly"],
  ["open-models/orbital/", "0.6", "monthly"],
  ["open-models/chai/", "0.6", "monthly"],
  ["open-models/rowan/", "0.6", "monthly"],
  ["open-models/shlab/", "0.6", "monthly"],
  ["open-models/sensetime/", "0.6", "monthly"],
  ["programming/", "0.8", "monthly"],
  ["vision/", "0.5", "yearly"],
];
await write("sitemap.xml", `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${urls.flatMap(([p, pr, f]) => {
  const zh = SITE + p;
  if (!enPaths.has(p)) return [`  <url><loc>${esc(zh)}</loc><lastmod>${TODAY}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority></url>`];
  const alt = `<xhtml:link rel="alternate" hreflang="zh-CN" href="${esc(zh)}"/><xhtml:link rel="alternate" hreflang="en" href="${esc(enUrl(zh))}"/><xhtml:link rel="alternate" hreflang="x-default" href="${esc(zh)}"/>`;
  return [zh, enUrl(zh)].map((loc) => `  <url><loc>${esc(loc)}</loc><lastmod>${TODAY}</lastmod><changefreq>${f}</changefreq><priority>${pr}</priority>${alt}</url>`);
}).join("\n")}
</urlset>
`);
await write("robots.txt", `User-agent: *\nAllow: /\n\nSitemap: ${SITE}sitemap.xml\n`);
await write(".nojekyll", "");

// ── installable web app (PWA): head tags on every page, a fresh sw.js version per deploy ─────────────────
// Manifest, home-screen icon, standalone mode and status bar for iPad / iPhone / Android, and viewport-fit=cover so
// shared-nav.css can keep the top bar clear of the status bar. The media theme-colors come before a page's own one.
// Skipped: radar/app, qchem/app, research-atlas/app and nmr/nmrium/app (copied apps shown in frames) and offline.html (sw.js shows it under other pages'
// addresses, so it has its own head). tools/bundle-single.ts strips the block again.
const pwaHead = (rel: string) => `<!-- pwa:start -->
  <link rel="manifest" href="${rel}manifest.webmanifest">
  <link rel="apple-touch-icon" href="${rel}assets/pwa/apple-touch-icon.png">
  <meta name="apple-mobile-web-app-capable" content="yes"><meta name="mobile-web-app-capable" content="yes">
  <meta name="apple-mobile-web-app-title" content="${esc(NAME)}">
  <meta name="apple-mobile-web-app-status-bar-style" content="black-translucent">
  <meta name="theme-color" media="(prefers-color-scheme: light)" content="#173f34">
  <meta name="theme-color" media="(prefers-color-scheme: dark)" content="#101613">
  <!-- pwa:end -->`;
const htmlFiles = async (dir: string): Promise<string[]> => {
  const out: string[] = [];
  for await (const e of Deno.readDir(new URL(dir, pub))) {
    const path = dir + e.name;
    if (e.isDirectory && path !== "radar/app" && path !== "qchem/app" && path !== "research-atlas/app" && path !== "nmr/nmrium/app" && path !== "particles/app") out.push(...await htmlFiles(path + "/"));
    else if (e.isFile && path.endsWith(".html") && path !== "offline.html") out.push(path);
  }
  return out;
};
let pwaPages = 0;
for (const file of await htmlFiles("")) {
  const url = new URL(file, pub);
  const rel = file === "404.html" ? SITE : "../".repeat(file.split("/").length - 1);
  const html = (await Deno.readTextFile(url)).replace(/\s*<!-- pwa:start -->[\s\S]*?<!-- pwa:end -->/, "")
    .replace(/<meta name="viewport" content="([^"]*)">/, (_m, c: string) => `<meta name="viewport" content="${/viewport-fit/.test(c) ? c : c + ",viewport-fit=cover"}">\n  ${pwaHead(rel)}`);
  if (html.includes("<!-- pwa:start -->")) pwaPages++;
  await Deno.writeTextFile(url, html);
}
const swUrl = new URL("sw.js", pub);
await Deno.writeTextFile(swUrl, (await Deno.readTextFile(swUrl)).replace(/const VERSION = '[^']*';/, () => `const VERSION = '${new Date().toISOString().replace(/[-:.]/g, "")}';`));
console.log(`site ${SITE}\n${mains.length} main pages, ${guidePages.length + 1} guide pages, ${resourcePages.length + 1} resource pages, ${urls.length} sitemap URLs, PWA head on ${pwaPages} pages`);
