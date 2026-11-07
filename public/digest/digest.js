/* 每周精选页：读账号服务的公开预览（本周概览 + 前五篇和点评），写出下一期的时间，Pro 用户的按钮改成去订阅。
   论文标题、作者、解读是外部内容：全部转义，标 translate="no"，解读按站点语言取中文或英文那一份。 */
(() => {
  'use strict';
  const PAY = window.MOLASTRIA_PAY || {};
  const en = document.documentElement.lang === 'en';
  const $ = (id) => document.getElementById(id);
  const h = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  const api = String(PAY.accountApi || '').replace(/\/+$/, '');
  const account = (() => { try { return localStorage.getItem('molastria-session') ? JSON.parse(localStorage.getItem('molastria-account') || 'null') : null; } catch { return null; } })();

  // Issues are built on Mondays from 12:00 UTC (the first try of the account service's scheduled job).
  const nextIssue = (now = new Date()) => {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), 12));
    const add = (8 - d.getUTCDay()) % 7; // days until Monday
    d.setUTCDate(d.getUTCDate() + add);
    if (d <= now) d.setUTCDate(d.getUTCDate() + 7);
    return d;
  };
  const day = (d, opts) => d.toLocaleDateString(en ? 'en-GB' : 'zh-CN', opts);
  const issueDay = (week) => day(new Date(`${week}T12:00:00Z`), { year: 'numeric', month: 'long', day: 'numeric' });
  const nextText = () => day(nextIssue(), { month: 'long', day: 'numeric', weekday: 'long' });

  function show(d) {
    const items = d?.items || [];
    if (!items.length) { waiting(); return; }
    $('dg-issue').innerHTML = `<span>${T('本期')}</span><b translate="no">${h(issueDay(d.week))}</b><span>${T('下一期')} <span translate="no">${h(nextText())}</span></span>`;
    $('dg-overview').textContent = (en ? d.overview_en : d.overview_zh) || '';
    $('dg-picks').innerHTML = items.map((it) => {
      const why = (en ? it.why_en : it.why_zh) || '';
      return `<li class="dg-pick"><div><p class="dg-meta"><span class="dg-src" translate="no">${h(it.source)}</span>${it.date ? `<span translate="no">${h(it.date)}</span>` : ''}</p>`
        + `<h3 class="dg-title" translate="no"><a href="${h(it.url)}" target="_blank" rel="noopener">${h(it.title)}</a></h3>`
        + (it.authors ? `<p class="dg-authors" translate="no">${h(it.authors)}</p>` : '')
        + `<p class="dg-why" translate="no">${h(why)}</p></div></li>`;
    }).join('');
    const rest = Math.max(0, (d.total || items.length) - items.length);
    $('dg-more').textContent = rest ? T(`完整的一期还有 ${rest} 篇，每周一随邮件送到 Pro 会员的邮箱`) : '';
    $('dg-letter').hidden = false;
    $('dg-waiting').hidden = true;
  }
  function waiting() {
    $('dg-issue').innerHTML = `<span>${T('下一期')}</span><b translate="no">${h(nextText())}</b>`;
    $('dg-waiting').hidden = false;
    $('dg-letter').hidden = true;
  }

  if (account?.pro) {
    $('dg-actions').innerHTML = `<a class="dg-btn primary" href="../pro/account.html#digest-card">${T('在账号页订阅邮件')} <i class="ico-ext ico-right" aria-hidden="true"></i></a>`;
  }
  if (!api) { waiting(); return; }
  fetch(`${api}/digest/preview`).then((r) => (r.ok ? r.json() : null)).then(show).catch(waiting);
})();
