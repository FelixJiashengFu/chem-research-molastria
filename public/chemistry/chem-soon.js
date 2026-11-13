'use strict';
// 化学学科馆 · 还在准备的展馆页：首屏写上名字、展馆切换和“即将上线”的说明，按页面语言取中文或英文（页面标 translate="no"）。
(() => {
  const S = window.MOLASTRIA_CHEM_SUBJECTS, id = document.body.dataset.hall;
  if (!S) return;
  const en = document.documentElement.lang === 'en', L = (zh, e) => (en ? e : zh);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const soon = new Set(S.soon || []);
  const SUB = S.subjects.map(([sid, num, , zh, e, line, , , , rel]) => ({ id: sid, num, zh, en: e, line, rel }));
  const me = SUB.find((s) => s.id === id);
  if (!me) return;
  const name = (s) => (en ? s.en : s.zh);
  if (en) document.title = `${me.en} · Chemistry Disciplines · MolAstria`;
  const $ = (s) => document.querySelector(s);
  $('#chm-switch').innerHTML = `<a href="../index.html">${L('全部展馆', 'All halls')}</a>` + SUB.map((s) => (soon.has(s.id) ? `<span class="chm-soon"${s === me ? ' aria-current="page"' : ''}><b>${s.num}</b>${esc(name(s))}</span>` : `<a href="../${s.id}/index.html"><b>${s.num}</b>${esc(name(s))}</a>`)).join('');
  $('#chm-switch').setAttribute('aria-label', L('十五个展馆', 'The fifteen halls'));
  $('#chm-h1').innerHTML = en ? esc(me.en) : `${esc(me.zh)}<span class="fs-h1-en" lang="en">${esc(me.en)}</span>`;
  const rel = (me.rel || []).filter((r) => !soon.has(r)).map((r) => SUB.find((s) => s.id === r)).filter(Boolean);
  $('#chm-lead').innerHTML = L('这个展馆正在准备，即将上线。在那之前，可以先去相关的展馆看看：', 'This hall is being prepared and will open soon. Meanwhile, related halls are open:');
  $('#chm-jump').innerHTML = `<a class="button primary" href="../index.html">${L('全部展馆', 'All halls')}</a>` + rel.map((s) => `<a class="button" href="../${s.id}/index.html">${s.num} · ${esc(name(s))}</a>`).join('');
  document.body.classList.remove('js-render');
})();
