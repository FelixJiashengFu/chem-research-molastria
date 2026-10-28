// Build the offline single-file edition: every module inlined into one HTML file.
//   deno run --allow-read --allow-write tools/bundle-single.ts [out.html]
// Pages run in a srcdoc iframe. A small shim stands in for location / history and turns in-site links into
// messages to the wrapper, which swaps pages and keeps #page=…&query=…&anchor=… in the address bar.
// The two data catalogs are embedded once in the wrapper and handed to the pages through `parent`.
// Links to pages that only exist online (static guide / resource directory, downloads) open the live site.
const repo = new URL("../", import.meta.url);
const pub = new URL("public/", repo);
const cfg = JSON.parse(await Deno.readTextFile(new URL("site.config.json", repo)));
const SITE: string = cfg.siteUrl.endsWith("/") ? cfg.siteUrl : cfg.siteUrl + "/";
const out = Deno.args[0] ?? decodeURIComponent(new URL("dist/ChemResearchHub-单文件版.html", repo).pathname).replace(/^\/([A-Za-z]:)/, "$1");

const PAGES: Record<string, { file: string; title: string }> = {
  search: { file: "index.html", title: "统一搜索" },
  network: { file: "hub/network.html", title: "网状查询" },
  atlas: { file: "atlas/index.html", title: "中文讲解与数据库" },
  hub: { file: "hub/index.html", title: "论文与社区" },
  lab: { file: "lab/index.html", title: "AI 实验室" },
};
const DATA_FILES = new Set(["merged-data.js", "hub/data.js"]);
const read = (path: string) => Deno.readTextFile(new URL(path, pub));
const resolve = (from: string, ref: string) => new URL(ref, new URL(from, "https://x.invalid/")).pathname.slice(1);
const favicon = `data:image/svg+xml;base64,${btoa(await read("favicon.svg"))}`;
const safeScript = (js: string) => js.replace(/<\/script/gi, "<\\/script").replace(/<!--/g, "<\\!--");
const rewrite = (js: string) => js
  .replace(/(?<![\w.$])location\.(hash|search|pathname)\b/g, "window.__CHEM_LOCATION__.$1")
  .replace(/(?<![\w.$])history\.replaceState\(/g, "window.__CHEM_HISTORY__.replaceState(");

const FILES = Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, v.file]));
const SHIM = `window.__CHEM_PAGE_CONFIG__ = __CHEM_CONFIG_PLACEHOLDER__;
(() => {
  const config = window.__CHEM_PAGE_CONFIG__;
  const root = 'https://chemresearch.invalid/';
  const site = ${JSON.stringify(SITE)};
  const files = ${JSON.stringify(FILES)};
  const currentFile = files[config.page];
  const address = {pathname:'/'+currentFile, search:config.search||'', hash:config.hash||''};
  window.__CHEM_LOCATION__ = address;
  try { window.CHEMRESEARCH_DATA = window.CHEMRESEARCH_DATA || parent.CHEMRESEARCH_DATA; window.CHEMVIS_DATA = window.CHEMVIS_DATA || parent.CHEMVIS_DATA; } catch {}
  const route = () => ({page:config.page,search:address.search,hash:address.hash});
  const publish = () => parent.postMessage({type:'chem-state',route:route()},'*');
  window.__CHEM_HISTORY__ = {
    replaceState(_state,_title,url) {
      if(url!==undefined && url!==null) {
        const u = new URL(String(url),root+currentFile+address.search+address.hash);
        address.search=u.search;address.hash=u.hash;publish();
      }
    }
  };
  window.__CHEM_LINK__ = path => root + path;
  const resolveLink = raw => {
    const u=new URL(raw,root+currentFile+address.search+address.hash);
    if(u.origin!==new URL(root).origin)return null;
    const path=u.pathname.replace(/^\\//,'');
    const page=Object.keys(files).find(key=>files[key]===path);
    return page?{page,search:u.search,hash:u.hash}:{online:site+path+u.search+u.hash};
  };
  document.addEventListener('click',event=>{
    const link=event.target.closest('a[href]');if(!link)return;
    const raw=link.getAttribute('href');
    if(!raw || /^(data:|blob:|mailto:|tel:|https?:)/i.test(raw) && !raw.startsWith(root))return;
    const next=resolveLink(raw);if(!next)return;
    event.preventDefault();
    if(next.online){window.open(next.online,'_blank','noopener');return;}
    if(next.page===config.page && next.search===address.search) {
      address.hash=next.hash;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
      const target=next.hash&&document.getElementById(decodeURIComponent(next.hash.slice(1)));
      if(target)target.scrollIntoView({behavior:'smooth'});
      else if(!next.hash)window.scrollTo({top:0});
      publish();
    } else parent.postMessage({type:'chem-nav',route:next},'*');
  },true);
  document.addEventListener('DOMContentLoaded',()=>{
    if(address.hash){const target=document.getElementById(decodeURIComponent(address.hash.slice(1)));if(target)target.scrollIntoView();}
  });
})();`;

async function bundlePage(file: string) {
  let html = await read(file);
  html = html.replace(/\s*<!-- seo:start -->[\s\S]*?<!-- seo:end -->/, "");
  html = html.replace(/<link rel="icon"[^>]*>/, `<link rel="icon" href="${favicon}" type="image/svg+xml">`);
  // Stylesheets.
  const links = [...html.matchAll(/<link rel="stylesheet" href="([^"]+)">/g)];
  for (const [tag, href] of links) {
    const css = (await read(resolve(file, href))).replace(/<\/style/gi, "<\\/style");
    html = html.replace(tag, () => `<style>\n${css}\n</style>`);
  }
  // Scripts: data files come from the wrapper; the AI modules are inlined so nothing loads lazily.
  // Deferred scripts move to the end of <body> in their original order, which keeps their timing.
  const scripts = [...html.matchAll(/<script src="([^"]+)"( defer)?><\/script>/g)];
  const deferred: string[] = [];
  let sawAI = false;
  for (const [tag, src, defer] of scripts) {
    const path = resolve(file, src);
    if (DATA_FILES.has(path)) { html = html.replace(tag, ""); continue; }
    if (path.startsWith("ai/")) sawAI = true;
    const code = path.startsWith("ai/") ? await read(path) : rewrite(await read(path));
    const inline = `<script>\n${safeScript(code)}\n</script>`;
    if (defer) { deferred.push(inline); html = html.replace(tag, ""); } else html = html.replace(tag, () => inline);
  }
  if (!sawAI) for (const p of ["ai/config.js", "ai/ai.js"]) deferred.push(`<script>\n${safeScript(await read(p))}\n</script>`);
  html = html.replace("</body>", () => `${deferred.join("\n")}\n</body>`);
  // The shim runs first, before the theme boot and any page script.
  html = html.replace(/<head>/, () => `<head>\n<script>${SHIM}</script>`);
  return html;
}

const pages: Record<string, string> = {};
for (const [key, p] of Object.entries(PAGES)) pages[key] = await bundlePage(p.file);
const json = (path: string, name: string) => read(path).then((js) => js.replace(new RegExp(`^\\s*window\\.${name}\\s*=\\s*`), "").replace(/;\s*$/, ""));
const merged = await json("merged-data.js", "CHEMRESEARCH_DATA");
const hub = await json("hub/data.js", "CHEMVIS_DATA");
JSON.parse(merged); JSON.parse(hub);
const embed = (s: string) => s.replace(/<\//g, "<\\/");

const wrapper = `<!doctype html>
<html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1">
<meta name="description" content="ChemResearch Hub 单文件版：1,465 条计算化学资源、网状查询、19 章中文讲解与 AI 实验室，一个文件即可离线打开。">
<title>ChemResearch Hub · 单文件版</title>
<link rel="icon" href="${favicon}" type="image/svg+xml">
<style>html,body{margin:0;width:100%;height:100%;background:#f6f5ee}#site{border:0;width:100%;height:100%;display:block}#loading{position:fixed;inset:0;display:grid;place-items:center;font:16px "Microsoft YaHei",sans-serif;color:#204f3d;background:#f6f5ee}@media (prefers-color-scheme:dark){html,body,#loading{background:#101613;color:#9fd0aa}}</style></head>
<body><div id="loading" role="status">正在打开计算化学研究导航…</div><iframe id="site" title="计算化学研究导航" allow="clipboard-write"></iframe><noscript>请在浏览器中启用 JavaScript 后重新打开此文件。</noscript>
<script type="application/json" id="data-merged">${embed(merged)}</script>
<script type="application/json" id="data-hub">${embed(hub)}</script>
<script>
window.CHEMRESEARCH_DATA=JSON.parse(document.getElementById('data-merged').textContent);
window.CHEMVIS_DATA=JSON.parse(document.getElementById('data-hub').textContent);
const CHEM_PAGES=${JSON.stringify(pages).replace(/<\//g, "<\\/")};
const TITLES=${JSON.stringify(Object.fromEntries(Object.entries(PAGES).map(([k, v]) => [k, v.title])))};
const frame=document.getElementById('site');
function decodeRoute(){const p=new URLSearchParams(location.hash.slice(1));const page=p.get('page')||'search';return {page:CHEM_PAGES[page]?page:'search',search:p.get('query')||'',hash:p.get('anchor')||''};}
function encodeRoute(route){const p=new URLSearchParams({page:route.page});if(route.search)p.set('query',route.search);if(route.hash)p.set('anchor',route.hash);return '#'+p;}
function render(route){frame.srcdoc=CHEM_PAGES[route.page].replace('__CHEM_CONFIG_PLACEHOLDER__',JSON.stringify(route).replace(/</g,'\\\\u003c'));document.title=TITLES[route.page]+' · ChemResearch Hub 单文件版';}
window.addEventListener('message',event=>{if(event.source!==frame.contentWindow)return;const m=event.data;if(!m||!['chem-nav','chem-state'].includes(m.type)||!CHEM_PAGES[m.route?.page])return;const r={page:m.route.page,search:String(m.route.search||''),hash:String(m.route.hash||'')};if(m.type==='chem-state'){history.replaceState(null,'',encodeRoute(r));}else{const next=encodeRoute(r);if(location.hash===next)render(r);else location.hash=next;}});
window.addEventListener('hashchange',()=>render(decodeRoute()));
frame.addEventListener('load',()=>document.getElementById('loading').style.display='none');
render(decodeRoute());
</script></body></html>
`;
await Deno.mkdir(out.replace(/[\\/][^\\/]*$/, ""), { recursive: true });
await Deno.writeTextFile(out, wrapper);
console.log(`${out}: ${(new TextEncoder().encode(wrapper).length / 1048576).toFixed(2)} MB, pages ${Object.keys(pages).join(", ")}`);
