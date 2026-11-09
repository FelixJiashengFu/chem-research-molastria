'use strict';
// 量子计算机：把 qc-data.js 的内容画成页面（台阶、七个部分与详解、硬件路线对比、里程碑、证据账本、开放问题、学习路线、文献库），
// 并驱动交互式实验室的三个演示（数学在 qc-models.js，这里只负责控件和画图）。版式沿用量子生物学与基础科学栏目。
// 内容是中英两版，按站点语言取用，标 translate="no"；界面上固定的文字写中文，由 i18n.js 翻译。
// 地址：#s-<部分> 打开对应的详解（#qc-noise、#qc-qec 也行），#ref-<id> 跳到文献，#demo-… 跳到演示。
(() => {
  const D = window.MOLASTRIA_QC, MATH = window.MOLASTRIA_QC_MATH || {}, M = window.MOLASTRIA_QC_MODELS;
  if (!D || !M) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  // 正文里的 x^{…}、T_1、e_m 之类写成上下标
  const rich = (s) => esc(s).replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/([A-Za-zΓγλΔσρΩωεΦκ])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/g, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(rich(en ? e : zh));
  const st = (s) => `<span class="fs-st" data-s="${s}" translate="no" lang="${lang}">${esc(tx(D.status[s]))}</span>`;
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  const refById = Object.fromEntries(D.refs.map((r) => [r.id, r]));
  const surname = (a) => a.trim().replace(/ et al\..*/, '').split(' ').pop();
  const shortRef = (r) => {
    if (/^(Google|Microsoft)/.test(r.authors)) return `${r.authors.split(',')[0].replace(/ and Collaborators/, '')} ${r.year}`;
    const list = r.authors.replace(/ et al\..*/, '').split(','), many = list.length > 2 || /et al/.test(r.authors);
    return `${surname(list[0])}${many ? ' et al.' : list.length === 2 ? ` & ${surname(list[1])}` : ''} ${r.year}`;
  };
  const cite = (ids) => (ids?.length ? `<p class="fs-cite">${ids.map((id) => `<a href="#ref-${id}" data-ref="${id}" translate="no">${esc(shortRef(refById[id]))}</a>`).join(' · ')}</p>` : '');
  const secById = Object.fromEntries(D.sections.map((s) => [s.id, s]));
  const secLink = (id) => `<a href="#s-${id}" data-tab="${id}" translate="no" lang="${lang}">${secById[id].num} · ${esc(tx(secById[id].title))}</a>`;
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';

  // ── 首屏、介绍与台阶 ────────────────────────────────────────────────────
  $('#qc-question').innerHTML = C(esc(tx(D.hero.question))) + (en ? '' : `<span class="fs-q-en" lang="en" translate="no">${esc(D.hero.question.en)}</span>`);
  $('#qc-lead').innerHTML = C(esc(tx(D.hero.lead)));
  $('#qc-honest').innerHTML = C(esc(tx(D.hero.honesty)));
  $('#qc-legend').innerHTML = Object.keys(D.status).map((s) => `<li>${st(s)}${C(esc(tx(D.statusLong[s])))}</li>`).join('');
  $('#qc-intro-text').innerHTML = D.intro.map((p) => C(esc(tx(p)), 'p')).join('');
  $('#qc-levels').innerHTML = D.levels.map((l, i) => `<article class="qc-level" data-k="${l.k}"><span class="qc-level-n">Step ${i + 1}</span><h4>${C(esc(tx(l.title)))}${st(l.status)}</h4>${C(esc(tx(l.text)), 'p')}</article>`).join('');
  for (const el of document.querySelectorAll('[data-demo-intro]')) { el.innerHTML = rich(tx(D.demos[el.dataset.demoIntro].intro)); el.setAttribute('translate', 'no'); el.lang = lang; }
  for (const el of document.querySelectorAll('[data-demo-notes]')) { el.innerHTML = rich(tx(D.demos[el.dataset.demoNotes].notes)); el.setAttribute('translate', 'no'); el.lang = lang; }
  for (const el of document.querySelectorAll('.fs-demo .fs-formula[data-math]')) { if (MATH[el.dataset.math]) { el.innerHTML = MATH[el.dataset.math]; el.tabIndex = 0; } else el.textContent = D.math[el.dataset.math]?.[0] || ''; }

  // ── 七个部分与详解 ──────────────────────────────────────────────────────
  $('#qc-pillar-grid').innerHTML = D.pillars.map((p) => `<a class="fs-pillar" href="#s-${p.id}" data-tab="${p.id}">
    <span class="fs-num">${p.num}</span>${C(esc(tx(p.title)), 'h3')}${C(esc(tx(p.summary)), 'p')}<span class="fs-more">阅读详解 <i class="ico-ext ico-right" aria-hidden="true"></i></span></a>`).join('');

  const tabs = $('#qc-tabs'), panels = $('#qc-panels');
  tabs.innerHTML = D.sections.map((s, i) => `<button class="fs-tab" type="button" role="tab" id="tab-${s.id}" aria-controls="s-${s.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><b>${s.num}</b>${C(esc(tx(s.title)))}</button>`).join('');
  panels.innerHTML = D.sections.map((s, i) => `<div class="fs-panel" role="tabpanel" id="s-${s.id}" aria-labelledby="tab-${s.id}" tabindex="-1"${i ? ' hidden' : ''}>
    ${C(`${s.num} · ${esc(tx(s.title))}`, 'h3')}
    ${C(rich(tx(s.intro)), 'p', 'fs-intro')}
    <h4 class="fs-sub-h">核心公式</h4>
    <div class="fs-formulas">${s.formulas.map(([k, cap]) => `<figure>${formula(k)}${C(rich(tx(cap)), 'figcaption')}</figure>`).join('')}</div>
    <h4 class="fs-sub-h">关键结论</h4>
    <ul class="fs-topics">${s.topics.map(([status, name, text, refs]) => `<li class="fs-topic"><h4>${C(esc(tx(name)))}${st(status)}</h4>${C(rich(tx(text)), 'p')}${cite(refs)}</li>`).join('')}</ul>
    ${s.questions?.length ? `<h4 class="fs-sub-h">常见问题</h4><div class="fs-qa">${s.questions.map(([q, a], j) => `<details${j === 0 ? ' open' : ''}><summary>${C(esc(tx(q)))}</summary>${C(rich(tx(a)), 'p')}</details>`).join('')}</div>` : ''}
    <h4 class="fs-sub-h">本节参考文献</h4>${cite(s.refs)}
  </div>`).join('');

  function selectTab(id, { focus = false, scroll = false } = {}) {
    const btn = $(`#tab-${id}`);
    if (!btn) return false;
    for (const b of tabs.querySelectorAll('.fs-tab')) { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; }
    for (const p of panels.children) p.hidden = p.id !== `s-${id}`;
    if (focus) btn.focus();
    if (scroll) $('#qc-sections').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    return true;
  }
  tabs.addEventListener('click', (e) => { const b = e.target.closest('.fs-tab'); if (!b) return; const id = b.id.slice(4); selectTab(id); history.replaceState(null, '', `#s-${id}`); });
  tabs.addEventListener('keydown', (e) => {
    const list = [...tabs.querySelectorAll('.fs-tab')], i = list.indexOf(document.activeElement);
    if (i < 0) return;
    const j = e.key === 'ArrowRight' ? (i + 1) % list.length : e.key === 'ArrowLeft' ? (i - 1 + list.length) % list.length : e.key === 'Home' ? 0 : e.key === 'End' ? list.length - 1 : -1;
    if (j < 0) return;
    e.preventDefault();
    selectTab(list[j].id.slice(4), { focus: true });
  });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-tab]');
    if (!a) return;
    e.preventDefault();
    selectTab(a.dataset.tab, { scroll: true });
    history.replaceState(null, '', `#s-${a.dataset.tab}`);
  });

  // ── 硬件路线对比与里程碑 ────────────────────────────────────────────────
  $('#qc-platforms-note').innerHTML = C(esc(tx(D.platformsNote)));
  const F = D.platformFields;
  $('#qc-plat-grid').innerHTML = D.platforms.map((p) => `<article class="qc-plat" id="plat-${p.id}" data-status="${p.status}">
    <header>${C(esc(tx(p.name)), 'h3')}${st(p.status)}</header>
    <dl>${['carrier', 'temp', 'gate', 'coherence', 'best', 'link', 'plus', 'minus'].map((k) => `<div class="qc-plat-${k}"><dt>${C(esc(tx(F[k])))}</dt>${C(rich(tx(p[k])), 'dd')}</div>`).join('')}</dl>
    <p class="qc-plat-more">${secLink(p.section)}</p>${cite(p.refs)}</article>`).join('');
  $('#qc-timeline').innerHTML = D.milestones.map((m) => `<li><span class="qc-year" translate="no">${m.year}</span><div>${C(rich(tx(m.text)), 'p')}<div class="qc-tl-meta">${st(m.status)}${cite([m.ref]).replace(/<\/?p[^>]*>/g, '')}</div></div></li>`).join('');

  // ── 证据账本 ────────────────────────────────────────────────────────────
  $('#qc-ledger-note').innerHTML = C(esc(tx(D.ledgerNote)));
  const filter = $('#qc-ledger-filter'), kinds = Object.keys(D.status);
  filter.innerHTML = `<button type="button" class="fs-chip" data-kind="" aria-pressed="true">全部</button>` + kinds.map((k) => `<button type="button" class="fs-chip" data-kind="${k}" aria-pressed="false">${C(esc(tx(D.status[k])))}</button>`).join('');
  function renderLedger(kind) {
    $('#qc-ledger-grid').innerHTML = D.ledger.filter((c) => !kind || c.status === kind).map((c) => `<article class="fs-theory" id="claim-${c.id}">
      <div class="fs-theory-meta">${st(c.status)}<span class="qc-ledger-sec">${secLink(c.section)}</span></div>
      ${C(esc(tx(c.claim)), 'h3')}
      <dl><div><dt>${C(esc(tx(D.ledgerFields.evidence)))}</dt>${C(rich(tx(c.evidence)), 'dd')}</div><div><dt>${C(esc(tx(D.ledgerFields.caveat)))}</dt>${C(rich(tx(c.caveat)), 'dd')}</div></dl>
      ${cite(c.refs)}</article>`).join('') || C(esc(en ? 'No claim has this label.' : '没有这一类的说法。'), 'p', 'muted');
  }
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('.fs-chip');
    if (!b) return;
    for (const c of filter.children) c.setAttribute('aria-pressed', c === b);
    renderLedger(b.dataset.kind);
  });
  renderLedger('');

  // ── 开放问题、学习路线与工具 ────────────────────────────────────────────
  $('#qc-open').innerHTML = D.openQuestions.map(([status, area, q]) => `<li>${C(esc(tx(q)), 'p')}<div class="fs-open-meta">${st(status)}${secLink(area)}</div></li>`).join('');
  const site = (path) => `../../${path}`;
  $('#qc-road').innerHTML = D.path.map((p) => `<li><div class="fs-phase"><span>Step ${p.step}</span></div>${C(esc(tx(p.title)), 'h3')}${C(esc(tx(p.text)), 'p')}
    <ul class="qc-links">${p.links.map(([href, label]) => `<li><a href="${esc(site(href))}" translate="no" lang="${lang}">${esc(tx(label))} <i class="ico-ext ico-right" aria-hidden="true"></i></a></li>`).join('')}</ul></li>`).join('');
  $('#qc-tools').innerHTML = D.tools.map((t) => `<li><a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(t.name)} ${ext}</a>${C(esc(tx(t.text)))}${t.ref ? cite([t.ref]).replace(/<\/?p[^>]*>/g, '') : ''}</li>`).join('');

  // ── 文献库 ──────────────────────────────────────────────────────────────
  const citedBy = {};
  for (const s of D.sections) for (const id of new Set([...s.refs, ...s.topics.flatMap((t) => t[3] || [])])) (citedBy[id] ||= []).push(s);
  $('#qc-lib-intro').innerHTML = C(esc(en
    ? `${D.refs.length} references. Title, authors, year, journal, volume and pages of each were checked against OpenAlex (which draws on Crossref) on ${D.checked}. Filter by area or status; each entry links to the publisher through its DOI.`
    : `共 ${D.refs.length} 篇。每一篇的题目、作者、年份、期刊、卷号和页码都在 ${D.checked} 于 OpenAlex（数据来自 Crossref）核对过。可以按研究领域和状态筛选；每条都通过 DOI 链接到出版方。`));
  const areaSel = $('#qc-lib-area'), statusSel = $('#qc-lib-status'), sortSel = $('#qc-lib-sort');
  areaSel.insertAdjacentHTML('beforeend', Object.entries(D.areas).map(([k, v]) => `<option value="${k}">${esc(tx(v))}</option>`).join(''));
  statusSel.insertAdjacentHTML('beforeend', kinds.map((k) => `<option value="${k}">${esc(tx(D.status[k]))}</option>`).join(''));
  for (const o of [...areaSel.options, ...statusSel.options].filter((o) => o.value)) { o.setAttribute('translate', 'no'); o.lang = lang; }
  function renderRefs() {
    const a = areaSel.value, s = statusSel.value, desc = sortSel.value === 'year-desc';
    const list = D.refs.filter((r) => (!a || r.area === a) && (!s || r.status === s)).sort((x, y) => (desc ? y.year - x.year : x.year - y.year) || x.id.localeCompare(y.id));
    $('#qc-lib-count').textContent = en ? `${list.length} of ${D.refs.length}` : `显示 ${list.length} / ${D.refs.length} 篇`;
    $('#qc-refs').innerHTML = list.map((r) => `<li class="fs-ref" id="ref-${r.id}">
      <span translate="no">${esc(r.authors)} (${r.year}). <span class="fs-ref-title">${esc(r.title)}</span>. <i>${esc(r.journal)}</i> ${esc(r.vol)}, ${esc(r.pages)}.</span>
      <div class="fs-ref-meta">${st(r.status)}<span translate="no" lang="${lang}">${esc(tx(D.areas[r.area]))}</span>
        <a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener noreferrer" translate="no">doi:${esc(r.doi)}</a>
        ${citedBy[r.id] ? `<span translate="no" lang="${lang}">${en ? 'Cited in' : '引用于'} ${citedBy[r.id].map((sec) => `<a href="#s-${sec.id}" data-tab="${sec.id}">${sec.num}</a>`).join(', ')}</span>` : ''}</div></li>`).join('');
  }
  for (const el of [areaSel, statusSel, sortSel]) el.addEventListener('change', renderRefs);
  renderRefs();
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-ref]');
    if (!a) return;
    e.preventDefault();
    areaSel.value = ''; statusSel.value = ''; renderRefs();
    const li = $(`#ref-${a.dataset.ref}`);
    history.replaceState(null, '', `#ref-${a.dataset.ref}`);
    li.scrollIntoView({ behavior: 'smooth', block: 'center' });
    li.classList.add('flash'); setTimeout(() => li.classList.remove('flash'), 1600);
  });

  // 其他栏目链到这里的锚点：#qc-noise、#qc-qec 打开对应的详解
  const alias = { 'qc-noise': 'noise', 'qc-qec': 'qec' };
  function openFromHash() {
    const h = location.hash.slice(1), tab = h.startsWith('s-') ? h.slice(2) : alias[h];
    if (tab) { if (selectTab(tab)) setTimeout(() => $('#qc-sections').scrollIntoView({ block: 'start' }), 60); }
    else if (h.startsWith('ref-') && $(`#${CSS.escape(h)}`)) setTimeout(() => $(`#${CSS.escape(h)}`).scrollIntoView({ block: 'center' }), 60);
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  // ── 画图工具 ────────────────────────────────────────────────────────────
  const css = () => { const s = getComputedStyle(document.documentElement); const g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent-text'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), ok: g('--ok'), paper: g('--paper'), violet: g('--violet') }; };
  function fit(cv) {
    const ratio = cv.dataset.ratio ? Number(cv.dataset.ratio) : (cv.dataset.ratio = cv.height / cv.width, cv.height / cv.width);
    const w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth), h = Math.round(w * ratio), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  const sup = (s) => String(s).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
  const fmt = (v, d = 3) => (!Number.isFinite(v) ? '∞' : Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`) : Number(v.toPrecision(d)).toString());
  const pct = (v) => (v >= 0.001 ? `${Number((100 * v).toPrecision(3))} %` : `${fmt(100 * v)} %`);
  const big = (v) => (v >= 1e6 ? fmt(v) : Math.round(v).toLocaleString('en-US'));
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  function plot(cv, o) {
    const { ctx, w, h } = fit(cv), c = css();
    const pad = { l: 54, r: 12, t: 26, b: 34 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const X = (v) => pad.l + ((v - o.x0) / (o.x1 - o.x0)) * W, Y = (v) => pad.t + H - ((v - o.y0) / (o.y1 - o.y0)) * H;
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
    for (const t of o.xt) { ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), pad.t + H); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(o.xf(t), X(t), pad.t + H + 15); }
    for (const t of o.yt) { ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(pad.l + W, Y(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(o.yf(t), pad.l - 6, Y(t) + 4); }
    ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + H); ctx.lineTo(pad.l + W, pad.t + H); ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = 'center'; ctx.fillText(o.xl, pad.l + W / 2, h - 4);
    ctx.save(); ctx.translate(11, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yl, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip();
    for (const s of o.series) {
      if (s.dots) { ctx.fillStyle = s.color; s.xs.forEach((x, i) => { if (Number.isFinite(s.ys[i])) { ctx.beginPath(); ctx.arc(X(x), Y(s.ys[i]), 3.6, 0, 2 * Math.PI); ctx.fill(); } }); continue; }
      ctx.beginPath();
      let pen = false;
      s.xs.forEach((x, i) => { const y = s.ys[i]; if (!Number.isFinite(y)) { pen = false; return; } if (pen) ctx.lineTo(X(x), Y(y)); else { ctx.moveTo(X(x), Y(y)); pen = true; } });
      ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.stroke(); ctx.setLineDash([]);
    }
    for (const m of o.hmarks || []) { ctx.strokeStyle = m.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, Y(m.y)); ctx.lineTo(pad.l + W, Y(m.y)); ctx.stroke(); ctx.setLineDash([]); }
    for (const m of o.marks || []) {
      ctx.strokeStyle = m.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(m.x), pad.t); ctx.lineTo(X(m.x), pad.t + H); ctx.stroke(); ctx.setLineDash([]);
      if (m.y !== undefined && Number.isFinite(m.y)) { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 4.5, 0, 2 * Math.PI); ctx.fill(); }
    }
    ctx.restore();
    let lx = pad.l;
    ctx.font = font(11);
    for (const s of o.series.filter((s) => s.label)) {
      const wd = 26 + ctx.measureText(s.label).width;
      if (lx + wd > w - 4) break;
      if (s.dots) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(lx + 8, 10, 3.6, 0, 2 * Math.PI); ctx.fill(); }
      else { ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx, 10); ctx.lineTo(lx + 16, 10); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(s.label, lx + 20, 14);
      lx += wd + 8;
    }
  }
  const ticks = (a, b, n = 5) => { const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(10))); return out; };
  const readout = (el, rows) => { el.innerHTML = rows.map(([k, v, bigv]) => `<dt>${C(rich(en ? k[1] : k[0]))}</dt><dd${bigv ? ' class="fs-big"' : ''} translate="no">${v}</dd>`).join(''); };
  const val = (id) => Number($(`#${id}`).value);
  const bind = (ids, fn) => { for (const id of ids) $(`#${id}`).addEventListener('input', fn); };
  const lazy = (fn) => { let q = 0; return () => { cancelAnimationFrame(q); q = requestAnimationFrame(fn); }; };
  const set = (id, v) => { $(`#${id}`).value = v; };
  const us = (t) => (t >= 1000 ? `${fmt(t / 1000)} ms` : t >= 1 ? `${fmt(t)} μs` : `${fmt(t * 1000)} ns`);

  // ── 演示 1：Rabi 振荡与 Bloch 球 ────────────────────────────────────────
  const bOpts = () => { const T1 = 10 ** val('b-t1'); return { omega: val('b-omega'), delta: val('b-delta'), T1, T2: Math.min(10 ** val('b-t2'), 2 * T1) }; };
  function sphere(cv, tr) {
    const { ctx, w, h } = fit(cv), c = css(), R = Math.min(w, h) * 0.38, cx = w / 2, cy = h / 2 + 4;
    const el = 0.32, az = -0.6; // 视角：仰角与方位角
    const P = ([x, y, z]) => { const x1 = x * Math.cos(az) - y * Math.sin(az), y1 = x * Math.sin(az) + y * Math.cos(az); return [cx + R * x1, cy - R * (z * Math.cos(el) - y1 * Math.sin(el)), y1 * Math.cos(el) + z * Math.sin(el)]; };
    ctx.strokeStyle = c.line; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    ctx.beginPath(); for (let i = 0; i <= 64; i++) { const a = (i / 64) * 2 * Math.PI, p = P([Math.cos(a), Math.sin(a), 0]); i ? ctx.lineTo(p[0], p[1]) : ctx.moveTo(p[0], p[1]); } ctx.stroke();
    for (const [v, lab] of [[[0, 0, 1], '|0⟩'], [[0, 0, -1], '|1⟩'], [[1, 0, 0], 'x'], [[0, 1, 0], 'y']]) {
      const a = P([0, 0, 0]), b = P(v);
      ctx.strokeStyle = c.faint || c.line; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); ctx.setLineDash([]);
      const t = P(v.map((q) => q * 1.16)); ctx.fillStyle = c.ink2; ctx.font = font(12, 600); ctx.textAlign = 'center'; ctx.fillText(lab, t[0], t[1] + 4);
    }
    ctx.lineWidth = 1.8;
    for (let i = 1; i < tr.length; i++) {
      const a = P([tr[i - 1].x, tr[i - 1].y, tr[i - 1].z]), b = P([tr[i].x, tr[i].y, tr[i].z]);
      ctx.strokeStyle = b[2] < 0 ? c.muted : c.accent; ctx.globalAlpha = b[2] < 0 ? 0.55 : 1;
      ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke();
    }
    ctx.globalAlpha = 1;
    const e = tr[tr.length - 1], pe = P([e.x, e.y, e.z]), o = P([0, 0, 0]);
    ctx.strokeStyle = c.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(pe[0], pe[1]); ctx.stroke();
    ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(pe[0], pe[1], 5, 0, 2 * Math.PI); ctx.fill();
  }
  function rabiDraw() {
    const p = bOpts(), c = css(), win = val('b-win');
    $('#b-omega-v').textContent = `${p.omega.toFixed(1)} MHz`; $('#b-delta-v').textContent = `${p.delta.toFixed(1)} MHz`;
    $('#b-t1-v').textContent = us(p.T1); $('#b-t2-v').textContent = us(p.T2) + (10 ** val('b-t2') > 2 * p.T1 ? (en ? ' (= 2T₁)' : '（= 2T₁）') : '');
    $('#b-win-v').textContent = us(win);
    const tr = M.bloch(p, win, 500), ideal = tr.map((q) => M.rabiP1(p.omega, p.delta, q.t));
    plot($('#b-curve'), { x0: 0, x1: win, y0: 0, y1: 1, xt: ticks(0, win, 5), yt: [0, 0.25, 0.5, 0.75, 1], xf: (t) => t, yf: (t) => t.toFixed(2),
      xl: en ? 'time (μs)' : '时间（μs）', yl: 'P(|1⟩)',
      series: [{ xs: tr.map((q) => q.t), ys: ideal, color: c.muted, dash: [5, 4], width: 1.4, label: en ? 'no damping' : '无衰减' },
        { xs: tr.map((q) => q.t), ys: tr.map((q) => q.p1), color: c.accent, width: 2.2, label: en ? 'with T₁, T₂' : '含 T₁、T₂' }],
      hmarks: [{ y: (1 - M.steadyZ(p)) / 2, color: c.gold }] });
    sphere($('#b-sphere'), tr);
    const tpi = M.piTime(p.omega), fpi = M.piFidelity(p), gen = Math.hypot(p.omega, p.delta), ss = (1 - M.steadyZ(p)) / 2;
    readout($('#b-read'), [
      [['π 脉冲后 P(|1⟩)', 'P(|1⟩) after a π pulse'], (100 * fpi).toFixed(2) + ' %', true],
      [['π 脉冲时长', 'π-pulse duration'], us(tpi)],
      [['广义 Rabi 频率', 'Generalised Rabi frequency'], `${fmt(gen)} MHz`],
      [['最大翻转概率 Ω²/(Ω²+Δ²)', 'Maximum flip Ω²/(Ω²+Δ²)'], (100 * (p.omega ** 2) / (gen ** 2)).toFixed(1) + ' %'],
      [['T₂ 内能做的 π 脉冲数', 'π pulses within T₂'], fmt(p.T2 / tpi)],
      [['长时间驱动后的稳态 P(|1⟩)', 'Steady-state P(|1⟩) under long driving'], (100 * ss).toFixed(1) + ' %'],
    ]);
    const n = p.T2 / tpi;
    $('#b-cap').innerHTML = Math.abs(p.delta) > 0.2 * p.omega
      ? L(`有失谐时比特绕倾斜的轴转动，最多只能翻到 ${(100 * (p.omega ** 2) / (gen ** 2)).toFixed(0)}%，振荡也更快：所以每个比特的频率都要先校准。金色虚线是长时间驱动后的稳态。`, `With detuning the qubit rotates about a tilted axis, flips at most ${(100 * (p.omega ** 2) / (gen ** 2)).toFixed(0)}% and oscillates faster: this is why every qubit\'s frequency must be calibrated first. The gold dashed line is the steady state under long driving.`)
      : n < 20
        ? L(`T₂ 之内只能做约 ${fmt(n)} 个 π 脉冲：振荡很快被抹平，状态趋向金色虚线所示的稳态（P(|1⟩) ≤ 50%）。这样的比特没法跑有意义的电路。`, `Only about ${fmt(n)} π pulses fit within T₂: the oscillation washes out quickly and the state drifts to the steady state of the gold dashed line (P(|1⟩) ≤ 50%). Such a qubit cannot run a meaningful circuit.`)
        : L(`共振驱动：P(|1⟩) = sin²(Ωt/2)，Ωt = π 时完全翻转（π 脉冲）。T₂ 之内能做约 ${fmt(n)} 个 π 脉冲；“相干时间 / 门时间”这个比值才是衡量比特好坏的关键。`, `Resonant driving: P(|1⟩) = sin²(Ωt/2), fully flipped when Ωt = π (a π pulse). About ${fmt(n)} π pulses fit within T₂; this ratio of coherence time to gate time is what really measures a qubit.`);
    $('#b-curve').setAttribute('aria-label', en ? `Rabi oscillation; after a π pulse P(|1⟩) = ${(100 * fpi).toFixed(1)} %` : `Rabi 振荡；π 脉冲后 P(|1⟩) = ${(100 * fpi).toFixed(1)}%`);
  }
  const rabi = lazy(rabiDraw);
  bind(['b-omega', 'b-delta', 'b-t1', 'b-t2', 'b-win'], rabi);
  $('#b-ideal').addEventListener('click', () => { set('b-delta', 0); set('b-t1', 3); set('b-t2', 3); rabiDraw(); });
  $('#b-detune').addEventListener('click', () => { set('b-delta', val('b-omega')); rabiDraw(); });
  $('#b-short').addEventListener('click', () => { set('b-delta', 0); set('b-t1', -0.3); set('b-t2', -0.5); rabiDraw(); });

  // ── 演示 2：电路保真度预算 ──────────────────────────────────────────────
  const cOpts = () => ({ n: val('c-n'), depth: val('c-depth'), e1: 10 ** val('c-e1'), e2: 10 ** val('c-e2'), em: 10 ** val('c-em') });
  function budgetDraw() {
    const p = cOpts(), c = css(), r = M.circuitFidelity(p);
    $('#c-n-v').textContent = p.n; $('#c-depth-v').textContent = p.depth;
    $('#c-e1-v').textContent = pct(p.e1); $('#c-e2-v').textContent = pct(p.e2); $('#c-em-v').textContent = pct(p.em);
    const Dmax = 200, ds = Array.from({ length: Dmax }, (_, i) => i + 1), lf = (q) => ds.map((d) => M.circuitFidelity({ ...q, depth: d }).log10F);
    const cur = lf(p), better = lf({ ...p, e2: p.e2 / 10, e1: p.e1 / 10 });
    const y0 = Math.max(-12, Math.floor(Math.min(...cur))), yt = ticks(y0, 0, 6).filter((t) => Number.isInteger(t));
    plot($('#c-curve'), { x0: 0, x1: Dmax, y0, y1: 0, xt: ticks(0, Dmax, 8), yt, xf: (t) => t, yf: (t) => (t === 0 ? '1' : `10${sup(t)}`),
      xl: en ? 'circuit depth (layers)' : '电路深度（层）', yl: en ? 'circuit fidelity F' : '电路保真度 F',
      series: [{ xs: ds, ys: cur, color: c.accent, width: 2.4, label: en ? 'current errors' : '当前误差' },
        { xs: ds, ys: better, color: c.info, dash: [6, 4], width: 1.6, label: en ? 'gate errors ÷ 10' : '门误差 ÷ 10' }],
      hmarks: [{ y: Math.log10(0.5), color: c.gold }],
      marks: [{ x: p.depth, y: r.log10F, color: c.gold }] });
    const dm = M.maxDepth({ ...p, em: 0 }), sq = M.maxSquare({ e1: p.e1, e2: p.e2, em: 0 });
    readout($('#c-read'), [
      [['整条电路的保真度 F', 'Whole-circuit fidelity F'], pct(r.F), true],
      [['单比特门 / 两比特门 / 读出', 'Single-qubit gates / two-qubit gates / readouts'], `${big(r.g1)} / ${big(r.g2)} / ${r.meas}`],
      [['期望出错次数', 'Expected number of errors'], fmt(r.g1 * p.e1 + r.g2 * p.e2 + r.meas * p.em)],
      [['只看门误差，F ≥ 50% 时最多的层数', 'Most layers with gate-only F ≥ 50%'], dm === Infinity ? '∞' : big(dm)],
      [['只看门误差，F ≥ 50% 的最大方形电路（n = 深度）', 'Largest square circuit (n = depth) with gate-only F ≥ 50%'], sq >= 2000 ? '≥ 2000' : String(sq)],
    ]);
    $('#c-cap').innerHTML = r.F < 0.01
      ? L(`F = ${pct(r.F)}：几乎每次运行都至少出一个错。随机电路采样实验就在这个区间工作，靠大量重复从噪声里统计出微弱的信号（交叉熵基准）；但要得到可靠的计算结果，这远远不够。金色虚线是 F = 50%。`, `F = ${pct(r.F)}: almost every run contains at least one error. Random-circuit-sampling experiments work in this regime, extracting a weak signal from the noise by many repetitions (cross-entropy benchmarking); for reliable computation it is far from enough. The gold dashed line is F = 50%.`)
      : L(`log F 随深度线性下降，也就是 F 指数衰减；每层的斜率由 n·e₁ + ⌊n/2⌋·e₂ 决定。把门误差降低十倍（蓝色虚线），能跑的深度只增加约十倍：要跑 10⁹ 个门，必须靠纠错。`, `log F falls linearly with depth, so F decays exponentially, with a slope per layer set by n·e₁ + ⌊n/2⌋·e₂. Cutting gate errors tenfold (blue dashed) only buys about ten times the depth: running 10⁹ gates requires error correction.`);
    $('#c-curve').setAttribute('aria-label', en ? `Circuit fidelity versus depth; at depth ${p.depth} F = ${pct(r.F)}` : `电路保真度随深度变化；深度 ${p.depth} 时 F = ${pct(r.F)}`);
  }
  const budget = lazy(budgetDraw);
  bind(['c-n', 'c-depth', 'c-e1', 'c-e2', 'c-em'], budget);
  $('#c-syc').addEventListener('click', () => { set('c-n', 53); set('c-depth', 20); set('c-e1', Math.log10(0.0016)); set('c-e2', Math.log10(0.0062)); set('c-em', Math.log10(0.038)); budgetDraw(); });
  $('#c-good').addEventListener('click', () => { set('c-e1', -4); set('c-e2', -3); set('c-em', -2.3); budgetDraw(); });
  $('#c-logical').addEventListener('click', () => { set('c-e1', -5); set('c-e2', -5); set('c-em', -5); budgetDraw(); });

  // ── 演示 3：重复码与表面码 ──────────────────────────────────────────────
  const DS = [1, 3, 5, 7, 9, 11, 13, 15, 17, 19, 21];
  const mcCache = new Map();
  const mc = (d, p) => { const k = `${d}|${p}`; if (!mcCache.has(k)) mcCache.set(k, M.repetitionMC(d, p, 20000, 7 + d)); return mcCache.get(k); };
  function qecDraw() {
    const c = css(), p = val('q-p'), phys = 10 ** val('q-phys'), Q = Math.round(10 ** val('q-q')), N = 10 ** val('q-n');
    $('#q-p-v').textContent = `${(100 * p).toFixed(1)} %`; $('#q-phys-v').textContent = pct(phys); $('#q-q-v').textContent = big(Q); $('#q-n-v').textContent = `10${sup(val('q-n').toFixed(1).replace(/\.0$/, ''))}`;
    // 重复码
    const exact = DS.map((d) => M.repetitionPL(d, p)), samp = DS.map((d) => (M.repetitionPL(d, p) * 20000 >= 10 ? mc(d, p) : NaN)), lg = (v) => (v > 0 ? Math.log10(v) : NaN); // 期望次数不到 10 次的点抽样噪声太大，不画
    const fine = Array.from({ length: 101 }, (_, i) => 1 + (20 * i) / 100);
    const ylo = Math.max(-8, Math.floor(Math.min(...exact.map(lg)))) ;
    plot($('#q-rep'), { x0: 1, x1: 21, y0: Math.min(ylo, -1), y1: 0, xt: DS.filter((d) => d % 4 === 1), yt: ticks(Math.min(ylo, -1), 0, 6).filter(Number.isInteger), xf: (t) => t, yf: (t) => (t === 0 ? '1' : `10${sup(t)}`),
      xl: en ? 'code distance d' : '码距 d', yl: en ? 'logical error p_L' : '逻辑错误率 p_L',
      series: [{ xs: DS, ys: exact.map(lg), color: c.accent, width: 2.2, label: en ? 'exact' : '精确值' },
        { xs: DS, ys: samp.map(lg), color: c.gold, dots: true, label: en ? '20,000 random trials' : '20000 次随机抽样' },
        { xs: [1, 21], ys: [lg(p), lg(p)], color: c.muted, dash: [5, 4], width: 1.3, label: en ? 'unprotected bit' : '不编码的比特' }] });
    $('#q-rep-cap').innerHTML = p < 0.5
      ? L(`p = ${(100 * p).toFixed(1)}% < 50%：码距越大，逻辑错误越少（每加 2 约降低 ${fmt(M.repetitionPL(5, p) > 0 ? M.repetitionPL(3, p) / M.repetitionPL(5, p) : Infinity)} 倍）。金点是随机抽样，和精确值吻合；抽样次数有限，太小的概率抽不到。`, `p = ${(100 * p).toFixed(1)}% < 50%: larger distance, fewer logical errors (about ${fmt(M.repetitionPL(5, p) > 0 ? M.repetitionPL(3, p) / M.repetitionPL(5, p) : Infinity)} times fewer per step of 2). Gold dots are random samples, matching the exact values; with finite trials, very small probabilities are not sampled.`)
      : L(`p = ${(100 * p).toFixed(1)}% > 50%：多数表决反而放大错误，码距越大越糟。这就是“阈值”的含义：只有低于阈值，增加冗余才有用。`, `p = ${(100 * p).toFixed(1)}% > 50%: majority voting amplifies errors and larger codes are worse. This is what a threshold means: redundancy helps only below it.`);
    // 表面码
    const S = M.SURFACE, b = M.surfaceBudget({ p: phys, Q, N }), dmax = Math.max(29, Number.isFinite(b.d) ? b.d + 4 : 29);
    const dd = Array.from({ length: (dmax - 1) / 2 }, (_, i) => 3 + 2 * i), cur = dd.map((d) => Math.log10(M.surfacePL(d, phys)));
    const willow = dd.map((d) => Math.log10(M.surfacePL(d, S.pth / 2.14)));
    const tgt = Math.log10(b.perRound), y0 = Math.min(-16, Math.floor(tgt) - 1);
    plot($('#q-surf'), { x0: 3, x1: dmax, y0, y1: 0, xt: ticks(3, dmax, 8).filter((t) => t % 2 === 1 || t % 5 === 0), yt: ticks(y0, 0, 6).filter(Number.isInteger), xf: (t) => t, yf: (t) => (t === 0 ? '1' : `10${sup(t)}`),
      xl: en ? 'code distance d' : '码距 d', yl: en ? 'logical error per round' : '每轮逻辑错误率',
      series: [{ xs: dd, ys: cur, color: c.accent, width: 2.4, label: en ? `p = ${pct(phys)}` : `p = ${pct(phys)}` },
        { xs: dd, ys: willow, color: c.muted, dash: [5, 4], width: 1.4, label: 'Λ = 2.14' }],
      hmarks: [{ y: tgt, color: c.gold }],
      marks: Number.isFinite(b.d) ? [{ x: b.d, y: Math.log10(b.pL), color: c.gold }] : [] });
    const lam = M.lambda(phys);
    readout($('#q-read'), [
      [['需要的码距 d', 'Required distance d'], Number.isFinite(b.d) ? String(b.d) : (en ? 'none (above threshold)' : '不可能（高于阈值）'), true],
      [['总物理比特（不含魔术态工厂）', 'Total physical qubits (no magic-state factories)'], Number.isFinite(b.physical) ? big(b.physical) : '—'],
      [['每个逻辑比特', 'Per logical qubit'], Number.isFinite(b.d) ? big(b.perLogical) : '—'],
      [['抑制因子 Λ = p_th/p', 'Suppression factor Λ = p_th/p'], fmt(lam)],
      [['每轮逻辑错误率的目标', 'Target logical error per round'], fmt(b.perRound)],
    ]);
    $('#q-surf-cap').innerHTML = !Number.isFinite(b.d)
      ? L(`物理错误率 ${pct(phys)} 已接近或超过表面码阈值 ${pct(S.pth)}：码距越大反而越差。`, `A physical error of ${pct(phys)} is at or above the surface-code threshold of ${pct(S.pth)}: larger codes only make things worse.`)
      : L(`要让 ${big(Q)} 个逻辑比特跑 ${fmt(N)} 轮、总失败概率不超过 1%，每轮逻辑错误率要低于金色虚线 ${fmt(b.perRound)}，需要码距 ${b.d}，共约 ${big(b.physical)} 个物理比特。物理错误率每降低一点，码距和比特数都会大幅减少。灰色虚线是 Λ = 2.14（Willow 实测）。`, `For ${big(Q)} logical qubits running ${fmt(N)} rounds with at most 1% total failure, the logical error per round must stay below the gold line at ${fmt(b.perRound)}, which takes distance ${b.d} and about ${big(b.physical)} physical qubits. Every small improvement in physical error cuts the distance and qubit count sharply. The grey dashed line is Λ = 2.14 (measured on Willow).`);
    $('#q-surf').setAttribute('aria-label', en ? `Surface-code logical error versus distance; required distance ${b.d}` : `表面码逻辑错误率随码距变化；需要码距 ${b.d}`);
  }
  const qec = lazy(qecDraw);
  bind(['q-p', 'q-phys', 'q-q', 'q-n'], qec);
  $('#q-willow').addEventListener('click', () => { set('q-phys', Math.log10(M.SURFACE.pth / 2.14)); qecDraw(); });
  $('#q-good').addEventListener('click', () => { set('q-phys', -4); qecDraw(); });

  // ── 启动、重绘 ──────────────────────────────────────────────────────────
  const redraw = () => { rabiDraw(); budgetDraw(); qecDraw(); };
  redraw();
  const later = lazy(redraw);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(later); for (const id of ['b-curve', 'c-curve', 'q-rep']) ro.observe($(`#${id}`)); }
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', later);
})();
