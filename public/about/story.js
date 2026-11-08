/* 关于页的 MolAstria 品牌故事：按页面语言把 story-data.js 画进 #story（整块 translate="no"，英文是手写的，不走 i18n）。 */
(() => {
  'use strict';
  const S = window.MOLASTRIA_STORY, host = document.getElementById('story-body');
  if (!S || !host) return;
  const en = document.documentElement.lang === 'en';
  const L = (pair) => pair[en ? 1 : 0];
  const ROMAN = ['I', 'II', 'III', 'IV', 'V', 'VI', 'VII', 'VIII'];
  const list = (cls, rows, tag = 'ul') => `<${tag} class="${cls}">${rows.map((r) => `<li>${L(r)}</li>`).join('')}</${tag}>`;
  const block = (b) => {
    switch (b[0]) {
      case 'p': return `<p>${L(b.slice(1))}</p>`;
      case 'key': return `<p class="story-key">${L(b.slice(1))}</p>`;
      case 'why': return `<p class="story-why">${L(b.slice(1))}</p>`;
      case 'ladder': return list('story-ladder', b[1], 'ol');
      case 'ask': return list('story-questions', b[1]);
      case 'stanza': return list('story-stanza', b[1]);
      case 'quote': return `<blockquote class="story-quote"><p lang="en">${S.quote.en}</p>${en ? '' : `<p class="story-zh">${S.quote.zh}</p>`}<p class="story-cite">${S.quote.cite}</p></blockquote>`;
      default: return '';
    }
  };
  document.getElementById('story-title').innerHTML = L(S.title);
  host.innerHTML = S.chapters.map((c, i) => `<article class="story-ch"><h3><span class="story-num" aria-hidden="true">${ROMAN[i]}</span><span>${en ? c.en : c.zh}</span></h3>${!en && c.sub ? `<p class="story-en" lang="en">${c.sub}</p>` : ''}${c.body.map(block).join('')}</article>`).join('')
    + `<div class="story-coda"><p class="story-coda-name">MolAstria</p><p class="story-coda-en" lang="en">${S.coda.motto[1]}</p>${en ? '' : `<p class="story-zh">${S.coda.motto[0]}</p>`}<span class="story-rule" aria-hidden="true"></span><p class="story-coda-line" lang="en">${S.coda.line[1]}</p>${en ? '' : `<p class="story-zh">${S.coda.line[0]}</p>`}</div>`;
})();
