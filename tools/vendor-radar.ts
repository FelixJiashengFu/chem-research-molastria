// Copies the web build of 预印本雷达 PreprintRadar (a separate repository) into public/radar/app/, where
// public/radar/index.html shows it under the MolAstria header. Build the radar first, then run this:
//   cd ../PreprintRadar && deno task web
//   deno run --allow-read --allow-write tools/vendor-radar.ts [path/to/PreprintRadar]
// The radar follows the system's light/dark setting through prefers-color-scheme; the copy also obeys
// MolAstria's own switch (data-theme on <html>, which radar/index.html mirrors into the frame), and its
// page loads MolAstria's i18n.js so the English site translates it like every other module.
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const site = `${Deno.args[0] ?? `${repo}../PreprintRadar`}/site/`;
const out = `${repo}public/radar/app/`;
await Deno.mkdir(`${out}assets`, { recursive: true });

/** Each rule inside @media (prefers-color-scheme: dark) twice: forced by data-theme=dark, and automatic unless data-theme=light. */
function themeable(css: string) {
  const AT = "@media (prefers-color-scheme: dark)";
  let res = "", i = 0;
  for (let at = css.indexOf(AT); at >= 0; at = css.indexOf(AT, i)) {
    const open = css.indexOf("{", at);
    let depth = 1, j = open + 1;
    for (; depth && j < css.length; j++) depth += css[j] === "{" ? 1 : css[j] === "}" ? -1 : 0;
    const inner = css.slice(open + 1, j - 1);
    const rules = [...inner.matchAll(/([^{}]+)\{([^{}]*)\}/g)].map((m) => [m[1].trim(), m[2]] as const);
    const scope = (sel: string, root: string) => sel.split(",").map((s) => s.trim().startsWith(":root") ? s.trim().replace(":root", root) : `${root} ${s.trim()}`).join(", ");
    res += css.slice(i, at)
      + rules.map(([sel, body]) => `${scope(sel, ':root[data-theme="dark"]')} {${body}}`).join("\n")
      + `\n${AT} {\n${rules.map(([sel, body]) => `  ${scope(sel, ':root:not([data-theme="light"])')} {${body}}`).join("\n")}\n}`;
    i = j;
  }
  return res + css.slice(i);
}

let css = await Deno.readTextFile(`${site}style.css`);
const autoRules = css.split("@media (prefers-color-scheme: dark)").length - 1;
css = themeable(css);
await Deno.writeTextFile(`${out}style.css`, `/* Copied from PreprintRadar by tools/vendor-radar.ts; dark rules also follow MolAstria's data-theme. */\n${css}`);

// The per-source colours are written into a <style> at run time with the same media query.
let app = await Deno.readTextFile(`${site}app.js`);
const SRC_DARK = "`@media (prefers-color-scheme: dark){${sources().map((s) => `.src.${s.id}{--c:${s.dark}}`).join(\"\")}}`";
if (!app.includes(SRC_DARK)) throw new Error("app.js: the source-colour rule changed; update tools/vendor-radar.ts");
app = app.replace(SRC_DARK, "sources().map((s) => `:root[data-theme=\"dark\"] .src.${s.id}{--c:${s.dark}}`).join(\"\") +\n    `@media (prefers-color-scheme: dark){${sources().map((s) => `:root:not([data-theme=\"light\"]) .src.${s.id}{--c:${s.dark}}`).join(\"\")}}`");
// A parsed query reads "a 且 b 或 c"; on the English site show the operators in English.
const OPS = 'const ops = (s) => document.documentElement.lang === "en" ? String(s).replace(/ 且 /g, " AND ").replace(/ 或 /g, " OR ").replace(/(^|[\\s(])非 /g, "$1NOT ") : s;\n';
app = app.replaceAll("esc(s.interpreted)", "esc(ops(s.interpreted))").replaceAll("esc(t.interpreted)", "esc(ops(t.interpreted))").replaceAll("${r.interpreted}", "${ops(r.interpreted)}");
app = app.replace(/^(async function api\()/m, `${OPS}$1`);
// "收藏" is both the Save button and the list's name; call the list 我的收藏 so English can say Save / My saved papers.
app = app.replace('["saved", "star", "收藏"]', '["saved", "star", "我的收藏"]').replace("<h1>收藏</h1>", "<h1>我的收藏</h1>");
await Deno.writeTextFile(`${out}app.js`, app);

for (const f of ["radar-web.js", "icon.svg", "assets/icon.png"]) await Deno.copyFile(`${site}${f}`, `${out}${f}`);

// The radar's own page, minus its standalone SEO head and the crawler text inside <main>.
const html = await Deno.readTextFile(`${site}index.html`);
const body = /<body>([\s\S]*)<\/body>/.exec(html)?.[1].replace(/<main id="main">[\s\S]*?<\/main>/, '<main id="main"></main>');
if (!body?.includes('id="nav"')) throw new Error("index.html: unexpected layout; update tools/vendor-radar.ts");
const version = /"softwareVersion":"([^"]+)"/.exec(html)?.[1] ?? "";
await Deno.writeTextFile(`${out}index.html`, `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <meta name="robots" content="noindex">
  <title>预印本雷达 · MolAstria</title>
  <!-- 预印本雷达 PreprintRadar ${version} (https://github.com/FelixJiashengFu/PreprintRadar), copied by tools/vendor-radar.ts -->
  <script>try{var d=document.documentElement,s=localStorage,t=s.getItem("chemhub-theme"),l=(location.search.match(/[?&]lang=(en|zh)/)||[])[1]||s.getItem("chemhub-lang");if(t==="dark"||t==="light")d.dataset.theme=t;if(l==="en"){d.lang="en";d.dataset.i18n="pending";setTimeout(function(){delete d.dataset.i18n},3000)}}catch(e){}</script>
  <style>:root[data-i18n=pending] body{visibility:hidden}</style>
  <script src="../../i18n.js" defer></script>
  <link rel="icon" href="assets/icon.png">
  <link rel="stylesheet" href="style.css">
</head>
<body>${body}</body>
</html>
`);
console.log(`radar ${version} → public/radar/app/ (${autoRules} dark-mode blocks made themeable)`);
