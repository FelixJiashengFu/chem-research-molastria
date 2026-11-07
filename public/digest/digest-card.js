/* 首页的“本周精选”卡片：本周概览和前三篇（带一句解读），点进每周精选页。读不到时整块不显示。 */
(() => {
  'use strict';
  const box = document.getElementById('digest-card');
  const api = String(window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
  if (!box || !api) return;
  const en = document.documentElement.lang === 'en';
  const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  fetch(`${api}/digest/preview`).then((r) => (r.ok ? r.json() : null)).then((d) => {
    const items = (d?.items || []).slice(0, 3);
    if (!items.length) return;
    const when = new Date(`${d.week}T12:00:00Z`).toLocaleDateString(en ? 'en-GB' : 'zh-CN', { month: 'long', day: 'numeric' });
    box.querySelector('.dc-week').textContent = when;
    box.querySelector('.dc-overview').textContent = (en ? d.overview_en : d.overview_zh) || '';
    box.querySelector('.dc-list').innerHTML = items.map((it) => `<li><span class="dc-src" translate="no">${h(it.source)}</span><a href="${h(it.url)}" target="_blank" rel="noopener" translate="no">${h(it.title)}</a>${(en ? it.why_en : it.why_zh) ? `<small translate="no">${h(en ? it.why_en : it.why_zh)}</small>` : ''}</li>`).join('');
    box.hidden = false;
  }).catch(() => {});
})();
