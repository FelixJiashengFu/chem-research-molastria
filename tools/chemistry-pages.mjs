// 化学学科馆：按 public/chemistry/chem-subjects.js 的名单写出十五个展馆页 public/chemistry/<id>/index.html（生成的文件，不要手改）。
// 每个展馆页只是一个空架子：内容由 chem.js 从同目录的 data.js、math.js、demos.js 画出来。
//   node tools/chemistry-pages.mjs          写出全部展馆页
//   node tools/chemistry-pages.mjs --check  只核对现有文件是不是最新的（tools/chemistry-test.mjs 也会核对）
import { readFileSync, writeFileSync, mkdirSync, existsSync } from 'node:fs';
import vm from 'node:vm';
import { pathToFileURL } from 'node:url';

const root = new URL('../public/chemistry/', import.meta.url);
const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('chem-subjects.js', root), 'utf8'), box);
const { subjects, soon = [] } = box.window.MOLASTRIA_CHEM_SUBJECTS;
const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/"/g, '&quot;');
const HEAD = '<script>try{var d=document.documentElement,s=localStorage,t=s.getItem("chemhub-theme"),l=(location.search.match(/[?&]lang=(en|zh)/)||[])[1]||s.getItem("chemhub-lang");if(t==="dark"||t==="light")d.dataset.theme=t;d.dataset.bg=s.getItem("chemhub-bg")||"stars";var z=+s.getItem("molastria-zoom");if(z&&z!==1&&!window.__MOLASTRIA_DESKTOP__)d.style.zoom=z;var x=+s.getItem("molastria-text");if(x&&x!==1)d.style.setProperty("--cr-text-zoom",x);var f=s.getItem("molastria-font");if(f)d.dataset.font=f;var g=s.getItem("chemhub-bg-strength");if(g)d.style.setProperty("--bg-strength",g);if(l==="en"){d.lang="en";d.dataset.i18n="pending";setTimeout(function(){delete d.dataset.i18n},3000)}}catch(e){}</script>';

// 还在准备的展馆：只有首屏和一段说明，由 ../chem-soon.js 按页面语言写进来，不载入 data.js、演示和公式
export function soonPage([id, num, , zh, en]) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${esc(`化学学科馆 ${num} · ${zh}：这个展馆正在准备，即将上线。Chemistry Disciplines ${num} · ${en}: this hall is being prepared and will open soon.`)}">
  <meta name="robots" content="noindex">
  <meta name="theme-color" content="#173f34">
  <title>${esc(`${zh} · ${en} · 化学学科馆 · MolAstria`)}</title>
  <link rel="icon" href="../../favicon.svg" type="image/svg+xml">
  ${HEAD}
  <script src="../../i18n.js" defer></script>
  <script src="../../backdrop.js" defer></script>
  <link rel="stylesheet" href="../../shared-nav.css">
  <link rel="stylesheet" href="../../fundamental-science/fundamental.css">
  <link rel="stylesheet" href="../chem.css">
  <script src="../../shared-nav.js" defer></script>
  <script src="../chem-subjects.js" defer></script>
  <script src="../chem-soon.js" defer></script>
</head>
<body data-section="chemistry" data-hall="${id}" class="js-render">
<!-- 生成的文件，不要手改：node tools/chemistry-pages.mjs。这个展馆还在准备（chem-subjects.js 的 soon），文字由 ../chem-soon.js 按页面语言写进来。 -->
<main>
  <section translate="no" class="fs-hero" aria-labelledby="chm-h1">
    <nav class="chm-switch" id="chm-switch"></nav>
    <p class="eyebrow" id="chm-eyebrow">MOLASTRIA · CHEMISTRY DISCIPLINES · ${num}</p>
    <h1 id="chm-h1">${esc(zh)}<span class="fs-h1-en" lang="en">${esc(en)}</span></h1>
    <p class="lead" id="chm-lead">这个展馆正在准备，即将上线。</p>
    <nav class="fs-jump" id="chm-jump"><a class="button primary" href="../index.html">全部展馆</a></nav>
  </section>
</main>
</body>
</html>
`;
}

export function page([id, num, , zh, en, line]) {
  return `<!doctype html>
<html lang="zh-CN">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <meta name="description" content="${esc(`化学学科馆 ${num} · ${zh}：${line[0]}。分章讲解、核心公式、带数字的例题、浏览器里当场计算的演示、自测题和按 DOI 核对过的文献。${en}: ${line[1]}.`)}">
  <meta name="theme-color" content="#173f34">
  <title>${esc(`${zh} · ${en} · 化学学科馆 · MolAstria`)}</title>
  <link rel="icon" href="../../favicon.svg" type="image/svg+xml">
  ${HEAD}
  <script src="../../i18n.js" defer></script>
  <script src="../../backdrop.js" defer></script>
  <link rel="stylesheet" href="../../shared-nav.css">
  <link rel="stylesheet" href="../../fundamental-science/fundamental.css">
  <link rel="stylesheet" href="../chem.css">
  <script src="../../shared-nav.js" defer></script>
  <script src="../chem-subjects.js" defer></script>
  <script src="data.js" defer></script>
  <script src="math.js" defer></script>
  <script src="../chem-models.js" defer></script>
  <script src="demos.js" defer></script>
  <script src="../chem.js" defer></script>
</head>
<body data-section="chemistry" data-hall="${id}" class="js-render">
<!-- 生成的文件，不要手改：node tools/chemistry-pages.mjs。文字自带中英两版，由 ../chem.js 按页面语言写进来，每个 section 标 translate="no"（页脚照常翻译）。 -->
<a class="skip" href="#chm-map" id="chm-skip" translate="no">跳到各章</a>
<main>
  <section translate="no" class="fs-hero" aria-labelledby="chm-h1">
    <nav class="chm-switch" id="chm-switch"></nav>
    <p class="eyebrow" id="chm-eyebrow">MOLASTRIA · CHEMISTRY DISCIPLINES · ${num}</p>
    <h1 id="chm-h1">${esc(zh)}<span class="fs-h1-en" lang="en">${esc(en)}</span></h1>
    <blockquote class="fs-question" id="chm-question"></blockquote>
    <p class="lead" id="chm-lead"></p>
    <p class="chm-scope" id="chm-scope"></p>
    <ul class="fs-legend" id="chm-legend"></ul>
    <nav class="fs-jump" id="chm-jump"></nav>
  </section>
  <section translate="no" class="fs-block" id="chm-map" aria-labelledby="chm-map-h" tabindex="-1">
    <h2 id="chm-map-h">各章</h2>
    <p class="muted" id="chm-map-note"></p>
    <p class="chm-progress" id="chm-progress" aria-live="polite"></p>
    <div class="chm-chapters" id="chm-chapters"></div>
  </section>
  <section translate="no" class="fs-block fs-reader" id="chm-reader" aria-labelledby="chm-reader-h" tabindex="-1">
    <h2 id="chm-reader-h">阅读与演示</h2>
    <div class="chm-bar">
      <button type="button" class="button" id="chm-prev"><i class="ico-ext ico-left" aria-hidden="true"></i></button>
      <select id="chm-select"></select>
      <button type="button" class="button" id="chm-next"><i class="ico-ext ico-right" aria-hidden="true"></i></button>
    </div>
    <div id="chm-panel"></div>
  </section>
  <section translate="no" class="fs-block" id="chm-labs" aria-labelledby="chm-labs-h" tabindex="-1">
    <h2 id="chm-labs-h">全部演示</h2>
    <p class="muted" id="chm-labs-note"></p>
    <ul class="chm-demo-list" id="chm-demo-list"></ul>
  </section>
  <section translate="no" class="fs-block" id="chm-history" aria-labelledby="chm-history-h" tabindex="-1">
    <h2 id="chm-history-h">发展时间线</h2>
    <p class="muted" id="chm-history-note"></p>
    <ol class="chm-timeline" id="chm-timeline"></ol>
  </section>
  <section translate="no" class="fs-block" id="chm-quiz" aria-labelledby="chm-quiz-h" tabindex="-1">
    <h2 id="chm-quiz-h">自测</h2>
    <p class="muted" id="chm-quiz-note"></p>
    <p class="chm-score" id="chm-score" aria-live="polite"></p>
    <div class="chm-quiz" id="chm-quiz-list"></div>
  </section>
  <section translate="no" class="fs-block" id="chm-path" aria-labelledby="chm-path-h" tabindex="-1">
    <h2 id="chm-path-h">教材与学习路线</h2>
    <p class="muted" id="chm-path-note"></p>
    <ul class="chm-books" id="chm-books"></ul>
    <ul class="chm-site" id="chm-path-site" style="margin-top:14px"></ul>
    <h3 class="fs-sub-h" id="chm-open-h">还没解决的问题</h3>
    <ol class="chm-open" id="chm-open-list"></ol>
  </section>
  <section translate="no" class="fs-block" id="chm-library" aria-labelledby="chm-library-h" tabindex="-1">
    <h2 id="chm-library-h">参考文献</h2>
    <p class="muted" id="chm-library-note"></p>
    <div class="fs-kind-filter" role="group" id="chm-ref-filter"></div>
    <p class="chm-progress" id="chm-ref-count" aria-live="polite"></p>
    <ol class="fs-refs" id="chm-refs"></ol>
  </section>
  <section translate="no" class="fs-block" id="chm-more" aria-labelledby="chm-more-h">
    <h2 id="chm-more-h">接着逛</h2>
    <div id="chm-more-body"></div>
  </section>
</main>
<noscript><p style="padding:24px">这一页的内容和演示由脚本生成，请打开 JavaScript。This page is rendered by script; please enable JavaScript.</p></noscript>
</body>
</html>
`;
}

if (import.meta.url === pathToFileURL(process.argv[1] || '').href) {
  const check = process.argv.includes('--check');
  let stale = 0;
  for (const s of subjects) {
    const dir = new URL(`${s[0]}/`, root), file = new URL('index.html', dir), html = soon.includes(s[0]) ? soonPage(s) : page(s);
    if (check) { if (!existsSync(file) || readFileSync(file, 'utf8') !== html) { console.log(`stale: public/chemistry/${s[0]}/index.html`); stale++; } continue; }
    mkdirSync(dir, { recursive: true });
    writeFileSync(file, html);
  }
  if (check) { console.log(stale ? `${stale} page(s) out of date: run node tools/chemistry-pages.mjs` : 'all pages up to date'); process.exit(stale ? 1 : 0); }
  console.log(`wrote ${subjects.length} hall pages under public/chemistry/`);
}
