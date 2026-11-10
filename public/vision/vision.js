/* 愿景页：按页面语言把 vision-data.js 画出来（整块 translate="no"，英文是手写的，不走 i18n）。
   中文页可以打开“中英对照”，每段下面加英文译文，选择存在 molastria-vision-bi。 */
(() => {
  'use strict';
  const V = window.MOLASTRIA_VISION, root = document.getElementById('vision');
  if (!V || !root) return;
  const en = document.documentElement.lang === 'en';
  const L = (pair) => pair[en ? 1 : 0];
  const T = (zh, e) => (en ? e : zh);
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI'];
  const STATUS = { live: ['已上线', 'Live'], next: ['规划中', 'Planned'], idea: ['设想', 'Idea'] };
  const ext = (href) => /^https?:/.test(href);
  const a = (href, html, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${href}"${ext(href) ? ' target="_blank" rel="noopener noreferrer"' : ''}>${html}</a>`;
  let bi = false;
  try { bi = !en && localStorage.getItem('molastria-vision-bi') === '1'; } catch (e) { /* 读不到就不对照 */ }

  const para = (b) => {
    const [kind, zh, e, link] = b;
    const src = link ? ` ${a(link.href, `${en ? link.en : link.zh}<i class="ico-ext" aria-hidden="true"></i>`, 'vs-src')}` : '';
    const cls = kind === 'key' ? 'vs-key' : '';
    return `<div class="vs-para${cls ? ` ${cls}` : ''}"><p>${en ? e : zh}${src}</p>${en ? '' : `<p class="vs-en" lang="en">${e}</p>`}</div>`;
  };

  const eras = `<figure class="vs-eras" aria-label="${T('工业化的四个阶段', 'Four stages of industrialisation')}">
    <ol>${V.eras.map(([zh, e, dz, de], i) => `<li class="${i === V.eras.length - 1 ? 'now' : ''}"><b>${en ? e : zh}</b><span>${en ? de : dz}</span></li>`).join('')}</ol>
    <figcaption>${T('编者按文章第四段画的示意：最后一格就是作者所说的“工业革命2.5”。', 'Editor’s sketch of the essay’s fourth paragraph; the last step is what the author calls “Industrial Revolution 2.5”.')}</figcaption>
  </figure>`;

  const essay = V.parts.map((p, i) => `<section class="vs-part" id="part-${i + 1}" aria-labelledby="part-${i + 1}-h">
      <h3 id="part-${i + 1}-h"><span class="vs-num" aria-hidden="true">${ROMAN[i]}</span><span>${L([p.zh, p.en])}</span>${en ? '' : `<small lang="en">${p.en}</small>`}</h3>
      ${p.body.map(para).join('')}${i === 0 ? eras : ''}
    </section>`).join('');

  const O = V.outlook;
  const item = ([st, zh, e, href]) => `<li class="vo-item vo-${st}"><em class="vo-tag">${L(STATUS[st])}</em><span>${href ? a(href, en ? e : zh) : (en ? e : zh)}</span></li>`;
  const pledges = O.pledges.map((p, i) => `<article class="vo-card">
      <p class="vo-n">${String(i + 1).padStart(2, '0')}</p>
      <h3>${L(p.head)}</h3>
      <blockquote><p>“${L(p.quote)}”</p></blockquote>
      <ul>${p.items.map(item).join('')}</ul>
    </article>`).join('');

  root.innerHTML = `
  <header class="vs-hero">
    <svg class="vs-mark" viewBox="0 0 240 70" aria-hidden="true">
      <g fill="none" stroke="currentColor" stroke-width="1.4" stroke-linecap="round">
        <path d="M10 60h40v-12h40v-12h40v-12h40"/><path d="M170 24h18" stroke-dasharray="2 4"/>
      </g>
      <g fill="currentColor"><circle cx="30" cy="60" r="2.4"/><circle cx="70" cy="48" r="2.4"/><circle cx="110" cy="36" r="2.4"/><circle cx="150" cy="24" r="2.4"/></g>
      <g fill="none" stroke="currentColor" stroke-width="1.3"><circle cx="208" cy="16" r="9"/><circle cx="208" cy="16" r="14" opacity=".45"/></g>
      <text x="208" y="20" text-anchor="middle" font-size="10" fill="currentColor" font-family="Georgia,serif">2.5</text>
    </svg>
    <p class="eyebrow">${T('愿景 · 一篇个人文章', 'VISION · A PERSONAL ESSAY')}</p>
    <h1>${L(V.title)}</h1>
    <p class="vs-sub">${L(V.subtitle)}</p>
    ${en ? '' : `<p class="vs-sub-en" lang="en">${V.subtitle[1]}</p>`}
    <p class="vs-by">${L(V.byline)}</p>
  </header>

  <aside class="vs-guide">
    <p>${T('这一页有两部分。<b>第一部分</b>是站长的文章原文，一字未改，小标题是编者加的；<b>第二部分</b>是编者写的展望，把文章里的承诺对照到 MolAstria 已有的栏目和路线图。',
      'This page has two parts. <b>Part one</b> is the operator’s essay; the Chinese original is unchanged, the section titles were added by the editor, and the English is a hand-made translation. <b>Part two</b> is the editor’s outlook, which sets the essay’s commitments against MolAstria’s existing sections and roadmap.')}</p>
    <nav class="vs-jump" aria-label="${T('本页目录', 'On this page')}">
      ${V.parts.map((p, i) => `<a href="#part-${i + 1}">${ROMAN[i]} · ${L([p.zh, p.en])}</a>`).join('')}
      <a class="vs-jump-o" href="#outlook">${T('展望', 'Outlook')}</a>
    </nav>
    ${en ? '' : `<button type="button" class="vs-bi" aria-pressed="${bi}">${bi ? '只看中文' : '中英对照'}</button>`}
  </aside>

  <article class="vs-essay${bi ? ' bi' : ''}" aria-label="${L(V.title)}">
    <p class="vs-label">${T('第一部分 · 原文', 'Part one · The essay')}</p>
    ${essay}
    <p class="vs-sign">— Jiasheng Fu</p>
    ${en ? '<p class="vs-note">Translated from the Chinese original. Where the two differ, the Chinese is authoritative.</p>' : ''}
  </article>

  <section class="vo" id="outlook" aria-labelledby="outlook-h">
    <p class="vs-label">${T('第二部分 · 编者的展望', 'Part two · Editor’s outlook')}</p>
    <h2 id="outlook-h">${L(O.title)}</h2>
    <p class="vo-intro">${L(O.intro)}</p>
    <p class="vo-legend">${['live', 'next', 'idea'].map((s) => `<span class="vo-item vo-${s}"><em class="vo-tag">${L(STATUS[s])}</em>${{ live: T('现在就能用', 'works today'), next: T('已经排进路线图', 'on the roadmap'), idea: T('还没排进路线图', 'not yet on the roadmap') }[s]}</span>`).join('')}</p>
    <div class="vo-grid">${pledges}</div>
    <section class="vo-trust">
      <h3>${L(O.trust.head)}</h3>
      <p>${L(O.trust.text)}</p>
      <ul>${O.trust.items.map((x) => `<li>${L(x)}</li>`).join('')}</ul>
    </section>
    <p class="vo-close">${L(O.close)}</p>
    <p class="vo-more">${a('../about/index.html#story', T('MolAstria 的品牌故事', 'The story of MolAstria'))} · ${a('../about/index.html', T('阿斯特赖亚科技的三个阶段', 'Morning Glory’s three stages'))} · ${a('https://github.com/FelixJiashengFu/chem-research-molastria/blob/main/docs/ROADMAP.md', `${T('完整路线图', 'Full roadmap')}<i class="ico-ext" aria-hidden="true"></i>`)}</p>
  </section>`;

  // 站内链接相对 /vision/：数据里写的是相对站点根的地址，加 ../
  root.querySelectorAll('.vo-card a[href]').forEach((x) => { const h = x.getAttribute('href'); if (!ext(h)) x.setAttribute('href', `../${h}`); });

  const btn = root.querySelector('.vs-bi');
  btn?.addEventListener('click', () => {
    bi = !bi;
    root.querySelector('.vs-essay').classList.toggle('bi', bi);
    btn.setAttribute('aria-pressed', String(bi));
    btn.textContent = bi ? '只看中文' : '中英对照';
    try { localStorage.setItem('molastria-vision-bi', bi ? '1' : '0'); } catch (e) { /* 存不了就算了 */ }
  });
})();
