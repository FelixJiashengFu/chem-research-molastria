'use strict';
// 期刊发表：期刊目录（按类别分组，可筛选、搜索，每种期刊可展开详情）和“从研究到发表”指导。
// 数据在 journals-data.js、journals-guide.js，各有中英两版，按站点语言取用；界面文字写中文，由 i18n.js 翻译。
// 地址：#j-<期刊 id> 打开该刊详情，#g-<章节 id> 跳到指导章节。
(() => {
  const D = window.MOLASTRIA_JOURNALS, G = window.MOLASTRIA_JOURNALS_GUIDE;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = (pair) => pair[en ? 1 : 0];
  const text = (t) => (en ? t.en : t.zh);
  const cats = Object.fromEntries(D.categories.map(([id, zh, e]) => [id, [zh, e]]));
  const list = D.journals;

  // ── 出处：期刊自己的链接（links 的键）或出版社层面的政策页（sources 的键）──
  const srcLabel = (j, key) => (key === 'crossref' || j.links[key] ? L(D.linkNames[key]) : L(D.sources[key]));
  const srcUrl = (j, key) => (key === 'crossref' ? `https://api.crossref.org/journals/${j.issn[0][1]}` : j.links[key] || D.sources[key][2]);
  const ext = (url, label) => `<a href="${esc(url)}" target="_blank" rel="noopener noreferrer">${esc(label)}</a>`;
  const srcLinks = (j, keys) => keys.map((k) => ext(srcUrl(j, k), srcLabel(j, k))).join(' · ');
  const issnText = (j) => j.issn.map(([kind, v]) => `${v}${kind === 'p' ? '（印刷版）' : kind === 'e' ? '（电子版）' : ''}`).join('，');

  // ── 期刊目录 ────────────────────────────────────────────────────────────
  const haystack = (j) => [j.name, j.abbr, j.short, j.zh, ...D.publishers[j.pub], ...cats[j.cat], ...j.issn.flatMap(([, v]) => [v, v.replace('-', '')]),
    ...Object.values(j.f || {}).flatMap((t) => [t.zh, t.en])].filter(Boolean).join(' ').toLowerCase();
  const index = new Map(list.map((j) => [j.id, haystack(j)]));

  function card(j) {
    const fields = D.fields.filter(([k]) => j.f?.[k]);
    const missing = D.fields.filter(([k]) => k !== 'num' && !j.f?.[k]).map(([, zh, e]) => (en ? e : zh));
    const links = Object.entries(j.links).map(([k, url]) => `<li>${ext(url, L(D.linkNames[k]))}</li>`).join('');
    const scope = j.f?.scope ? text(j.f.scope) : '';
    const short = en && /[㐀-鿿]/.test(j.short) ? '' : j.short; // e.g. 化学学报: the English page shows the English abbreviation only
    return `<article class="jr-card" id="j-${esc(j.id)}" data-id="${esc(j.id)}">
  <div class="jr-head">
    <h4><span class="jr-name" translate="no" lang="en">${esc(j.name)}</span>${j.zh ? ` <span class="jr-zh" translate="no" lang="zh-CN">${esc(j.zh)}</span>` : ''}</h4>
    <p class="jr-sub" translate="no" lang="${lang}"><span>${esc(j.abbr)}${short && short !== j.abbr ? ` · ${esc(short)}` : ''}</span><span>${esc(L(D.publishers[j.pub]))}</span>${j.issn.length ? `<span>ISSN ${esc(j.issn.map(([, v]) => v).join(' / '))}</span>` : ''}</p>
    <ul class="jr-tags" translate="no" lang="${lang}"><li class="jr-oa" data-oa="${esc(j.oa)}">${esc(L(D.oaModels[j.oa]))}</li>${j.types.map((t) => `<li>${esc(L(D.types[t]))}</li>`).join('')}</ul>
  </div>
  ${scope ? `<p class="jr-scope" translate="no" lang="${lang}">${esc(scope.length > 150 ? `${scope.slice(0, 148)}…` : scope)}</p>` : ''}
  <button type="button" class="jr-toggle" aria-expanded="false" aria-controls="jd-${esc(j.id)}">查看详情</button>
  <div class="jr-detail" id="jd-${esc(j.id)}" hidden>
    <dl class="jr-facts">
      <div><dt>全称</dt><dd translate="no" lang="en">${esc(j.name)}${j.zh ? `（<span lang="zh-CN">${esc(j.zh)}</span>）` : ''}</dd></div>
      <div><dt>缩写</dt><dd translate="no" lang="en">${esc(j.abbr)}</dd></div>
      <div><dt>出版社</dt><dd translate="no" lang="${lang}">${esc(L(D.publishers[j.pub]))}</dd></div>
      <div><dt>类别</dt><dd translate="no" lang="${lang}">${esc(L(cats[j.cat]))}</dd></div>
      ${j.issn.length ? `<div><dt>ISSN</dt><dd>${esc(issnText(j))} <span class="jr-src">出处：${srcLinks(j, [j.issnSrc])}</span></dd></div>` : ''}
    </dl>
    <dl class="jr-fields">${fields.map(([k, zh, e]) => `<div><dt translate="no" lang="${lang}">${esc(en ? e : zh)}</dt><dd><span translate="no" lang="${lang}">${esc(text(j.f[k]))}</span> <span class="jr-src">出处：${srcLinks(j, j.f[k].src)}</span></dd></div>`).join('')}</dl>
    ${missing.length ? `<p class="jr-missing">以下几项没有在官网核实，本页不写，请看作者指南：<span translate="no" lang="${lang}">${esc(missing.join(en ? ', ' : '、'))}</span></p>` : ''}
    <h5>官方链接</h5>
    <ul class="jr-links" translate="no" lang="${lang}">${links}</ul>
    <p class="jr-checked">以上信息核对于 ${esc(D.checked)}；规定和数字会变，投稿前以官网为准。</p>
  </div>
</article>`;
  }

  const listEl = $('#jr-list');
  listEl.innerHTML = D.categories.map(([id]) => {
    const items = list.filter((j) => j.cat === id);
    return items.length ? `<section class="jr-group" data-cat="${esc(id)}" aria-labelledby="jr-cat-${esc(id)}"><h3 id="jr-cat-${esc(id)}" translate="no" lang="${lang}">${esc(L(cats[id]))}<span class="jr-group-n"></span></h3><div class="jr-cards">${items.map(card).join('')}</div></section>` : '';
  }).join('');

  // Filter menus come from the data, so they always match what is listed.
  const fill = (sel, entries) => { sel.insertAdjacentHTML('beforeend', entries.map(([v, label]) => `<option value="${esc(v)}" lang="${lang}">${esc(label)}</option>`).join('')); };
  const used = (key) => [...new Set(list.flatMap((j) => (Array.isArray(j[key]) ? j[key] : [j[key]])))];
  fill($('#jr-cat'), D.categories.map(([id]) => [id, L(cats[id])]));
  fill($('#jr-pub'), used('pub').map((p) => [p, L(D.publishers[p])]).sort((a, b) => a[1].localeCompare(b[1], lang)));
  fill($('#jr-oa'), Object.keys(D.oaModels).filter((k) => used('oa').includes(k)).map((k) => [k, L(D.oaModels[k])]));
  fill($('#jr-type'), Object.keys(D.types).filter((k) => used('types').includes(k)).map((k) => [k, L(D.types[k])]));

  const controls = ['#jr-q', '#jr-cat', '#jr-pub', '#jr-oa', '#jr-type'].map($);
  function applyFilters() {
    const [q, cat, pub, oa, type] = controls.map((c) => c.value.trim());
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const j of list) {
      const ok = (!cat || j.cat === cat) && (!pub || j.pub === pub) && (!oa || j.oa === oa) && (!type || j.types.includes(type))
        && words.every((w) => index.get(j.id).includes(w));
      document.getElementById(`j-${j.id}`).hidden = !ok;
      if (ok) shown++;
    }
    listEl.querySelectorAll('.jr-group').forEach((g) => {
      const n = g.querySelectorAll('.jr-card:not([hidden])').length;
      g.hidden = !n;
      g.querySelector('.jr-group-n').textContent = ` · ${n}`;
    });
    $('#jr-count').textContent = shown === list.length ? `共 ${list.length} 项` : `显示 ${shown} 项，共 ${list.length} 项`;
    $('#jr-empty').hidden = shown > 0;
    $('#jr-reset').hidden = !controls.some((c) => c.value);
  }
  const reset = () => { controls.forEach((c) => { c.value = ''; }); applyFilters(); };
  controls.forEach((c) => c.addEventListener(c.tagName === 'SELECT' ? 'change' : 'input', applyFilters));
  $('#jr-reset').addEventListener('click', reset);
  $('#jr-empty-reset').addEventListener('click', () => { reset(); controls[0].focus(); });

  const nJournals = list.filter((j) => j.cat !== 'preprint').length;
  $('#jr-meta').textContent = `收录 ${nJournals} 种期刊和 ${list.length - nJournals} 个预印本平台 · 信息核对于 ${D.checked}`;

  function setOpen(article, open) {
    const btn = article.querySelector('.jr-toggle');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '收起详情' : '查看详情';
    article.querySelector('.jr-detail').hidden = !open;
    article.classList.toggle('open', open);
  }
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.jr-toggle');
    if (!btn) return;
    const article = btn.closest('.jr-card');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    setOpen(article, open);
    if (open) history.replaceState(null, '', `#j-${article.dataset.id}`);
  });

  // ── 从研究到发表 ──────────────────────────────────────────────────────────
  const chapters = en ? G.en : G.zh;
  $('#jr-toc').innerHTML = `<ol>${chapters.map((c, i) => `<li><a href="#${esc(c.id)}" data-chapter="${esc(c.id)}"><span>${String(i + 1).padStart(2, '0')}</span>${esc(c.title)}</a></li>`).join('')}</ol>`;
  $('#jr-toc').lang = lang;
  // The chapters are bundled with the site; strip active content anyway before inserting, as the handbook reader does.
  const clean = (html) => {
    const doc = new DOMParser().parseFromString(html, 'text/html');
    doc.querySelectorAll('script,iframe,object,embed,style,link,base,meta,form').forEach((n) => n.remove());
    doc.querySelectorAll('*').forEach((n) => [...n.attributes].forEach((a) => { if (/^on/i.test(a.name) || (/^(href|src)$/i.test(a.name) && /^\s*(javascript|data):/i.test(a.value))) n.removeAttribute(a.name); }));
    doc.querySelectorAll('a[href]').forEach((a) => { if (/^https?:/.test(a.getAttribute('href'))) { a.target = '_blank'; a.rel = 'noopener noreferrer'; } });
    return doc.body.innerHTML;
  };
  const body = $('#jr-guide-body');
  body.lang = lang;
  body.innerHTML = chapters.map((c, i) => `<section class="jr-chapter" id="${esc(c.id)}"><h3><span>${String(i + 1).padStart(2, '0')}</span>${esc(c.title)}</h3>${clean(c.html)}</section>`).join('');

  const markChapter = (id) => $('#jr-toc').querySelectorAll('a').forEach((a) => { if (a.dataset.chapter === id) a.setAttribute('aria-current', 'true'); else a.removeAttribute('aria-current'); });

  // ── 地址 ──────────────────────────────────────────────────────────────────
  function readHash(scroll) {
    const id = decodeURIComponent((location.hash || '').slice(1));
    if (id.startsWith('j-')) {
      const article = document.getElementById(id);
      if (!article) return;
      if (article.hidden) reset();
      setOpen(article, true);
      if (scroll) article.scrollIntoView({ block: 'start' });
    } else if (id.startsWith('g-')) {
      markChapter(id);
      const target = document.getElementById(id);
      if (target && scroll) target.scrollIntoView({ block: 'start' });
    }
  }
  window.addEventListener('hashchange', () => readHash(true));
  $('#jr-toc').addEventListener('click', (e) => { const a = e.target.closest('a[data-chapter]'); if (a) markChapter(a.dataset.chapter); });
  applyFilters();
  readHash(true);
})();
