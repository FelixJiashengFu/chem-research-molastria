'use strict';
// 核磁共振栏目：把 nmr-data.js 的内容画成页面（三层问题、十一个部分与详解、方法对比、时间线、说法核对、开放问题、学习路线、文献库），
// 并驱动动手实验室的五个演示（数学在 nmr-models.js，这里只负责控件和画图）。版式沿用基础科学栏目，写法照 quantum/computing/qc.js。
// 内容是中英两版，按站点语言取用，标 translate="no"；界面上固定的文字写中文，由 i18n.js 翻译。
// 地址：#s-<部分> 打开对应的详解，#ref-<id> 跳到文献，#demo-… 跳到演示。
(() => {
  const D = window.MOLASTRIA_NMR, MATH = window.MOLASTRIA_NMR_MATH || {}, M = window.MOLASTRIA_NMR_MODELS;
  if (!D || !M) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  // 正文里的 x^{…}、τ_c、T_R 之类写成上下标
  const rich = (s) => esc(s).replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/([A-Za-zΓγλΔσρΩωεΦκτνδημ])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/g, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(rich(en ? e : zh));
  const st = (s) => `<span class="fs-st" data-s="${s}" translate="no" lang="${lang}">${esc(tx(D.status[s]))}</span>`;
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  const refById = Object.fromEntries(D.refs.map((r) => [r.id, r]));
  const surname = (a) => a.trim().replace(/ et al\..*/, '').split(' ').pop();
  const shortRef = (r) => {
    const list = r.authors.replace(/ et al\..*/, '').split(','), many = list.length > 2 || /et al/.test(r.authors);
    return `${surname(list[0])}${many ? ' et al.' : list.length === 2 ? ` & ${surname(list[1])}` : ''} ${r.year}`;
  };
  const cite = (ids) => (ids?.length ? `<p class="fs-cite">${ids.filter((id) => refById[id]).map((id) => `<a href="#ref-${id}" data-ref="${id}" translate="no">${esc(shortRef(refById[id]))}</a>`).join(' · ')}</p>` : '');
  const bare = (html) => html.replace(/<\/?p[^>]*>/g, '');
  const secById = Object.fromEntries(D.sections.map((s) => [s.id, s]));
  const secLink = (id) => (secById[id] ? `<a href="#s-${id}" data-tab="${id}" translate="no" lang="${lang}">${secById[id].num} · ${esc(tx(secById[id].title))}</a>` : '');
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';

  // ── 首屏、介绍与三层问题 ────────────────────────────────────────────────
  $('#nmr-question').innerHTML = C(esc(tx(D.hero.question))) + (en ? '' : `<span class="fs-q-en" lang="en" translate="no">${esc(D.hero.question.en)}</span>`);
  $('#nmr-lead').innerHTML = C(esc(tx(D.hero.lead)));
  $('#nmr-honest').innerHTML = C(esc(tx(D.hero.honesty)));
  $('#nmr-legend').innerHTML = Object.keys(D.status).map((s) => `<li>${st(s)}${C(esc(tx(D.statusLong[s])))}</li>`).join('');
  $('#nmr-intro-text').innerHTML = D.intro.map((p) => C(rich(tx(p)), 'p')).join('');
  $('#nmr-levels').innerHTML = D.levels.map((l, i) => `<article class="nmr-level" data-k="${l.k}"><span class="nmr-level-n">Level ${i + 1}</span><h4>${C(esc(tx(l.title)))}${st(l.status)}</h4>${C(rich(tx(l.text)), 'p')}</article>`).join('');
  for (const el of document.querySelectorAll('[data-demo-intro]')) { el.innerHTML = rich(tx(D.demos[el.dataset.demoIntro].intro)); el.setAttribute('translate', 'no'); el.lang = lang; }
  for (const el of document.querySelectorAll('[data-demo-notes]')) { el.innerHTML = rich(tx(D.demos[el.dataset.demoNotes].notes)); el.setAttribute('translate', 'no'); el.lang = lang; }
  for (const el of document.querySelectorAll('.fs-demo .fs-formula[data-math]')) { if (MATH[el.dataset.math]) { el.innerHTML = MATH[el.dataset.math]; el.tabIndex = 0; } else el.textContent = D.math[el.dataset.math]?.[0] || ''; }

  // ── 十一个部分与详解 ────────────────────────────────────────────────────
  $('#nmr-pillar-grid').innerHTML = D.pillars.map((p) => `<a class="fs-pillar" href="#s-${p.id}" data-tab="${p.id}">
    <span class="fs-num">${p.num}</span>${C(esc(tx(p.title)), 'h3')}${C(esc(tx(p.summary)), 'p')}<span class="fs-more">阅读详解 <i class="ico-ext ico-right" aria-hidden="true"></i></span></a>`).join('');

  const tabs = $('#nmr-tabs'), panels = $('#nmr-panels');
  tabs.innerHTML = D.sections.map((s, i) => `<button class="fs-tab" type="button" role="tab" id="tab-${s.id}" aria-controls="s-${s.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><b>${s.num}</b>${C(esc(tx(s.title)))}</button>`).join('');
  panels.innerHTML = D.sections.map((s, i) => `<div class="fs-panel" role="tabpanel" id="s-${s.id}" aria-labelledby="tab-${s.id}" tabindex="-1"${i ? ' hidden' : ''}>
    ${C(`${s.num} · ${esc(tx(s.title))}`, 'h3')}
    ${C(rich(tx(s.intro)), 'p', 'fs-intro')}
    <h4 class="fs-sub-h">核心公式</h4>
    <div class="fs-formulas">${s.formulas.map(([k, cap]) => `<figure>${formula(k)}${C(rich(tx(cap)), 'figcaption')}</figure>`).join('')}</div>
    <h4 class="fs-sub-h">关键方法与结论</h4>
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
    if (scroll) $('#nmr-sections').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
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

  // ── 方法对比与时间线 ────────────────────────────────────────────────────
  $('#nmr-families-note').innerHTML = C(esc(tx(D.familiesNote)));
  const F = D.familyFields;
  $('#nmr-fam-grid').innerHTML = D.families.map((p) => `<article class="nmr-fam" id="fam-${p.id}" data-status="${p.status}">
    <header>${C(esc(tx(p.name)), 'h3')}${st(p.status)}</header>
    <dl>${Object.keys(F).map((k) => `<div class="nmr-fam-${k}"><dt>${C(esc(tx(F[k])))}</dt>${C(rich(tx(p[k])), 'dd')}</div>`).join('')}</dl>
    <p class="nmr-fam-more">${secLink(p.section)}</p>${cite(p.refs)}</article>`).join('');
  $('#nmr-timeline').innerHTML = D.milestones.map((m) => `<li><span class="nmr-year" translate="no">${m.year}</span><div>${C(rich(tx(m.text)), 'p')}<div class="nmr-tl-meta">${st(m.status)}${bare(cite([m.ref]))}</div></div></li>`).join('');

  // ── 说法核对 ────────────────────────────────────────────────────────────
  $('#nmr-ledger-note').innerHTML = C(esc(tx(D.ledgerNote)));
  const filter = $('#nmr-ledger-filter'), kinds = Object.keys(D.status);
  filter.innerHTML = `<button type="button" class="fs-chip" data-kind="" aria-pressed="true">全部</button>` + kinds.map((k) => `<button type="button" class="fs-chip" data-kind="${k}" aria-pressed="false">${C(esc(tx(D.status[k])))}</button>`).join('');
  function renderLedger(kind) {
    $('#nmr-ledger-grid').innerHTML = D.ledger.filter((c) => !kind || c.status === kind).map((c) => `<article class="fs-theory" id="claim-${c.id}">
      <div class="fs-theory-meta">${st(c.status)}<span class="nmr-ledger-sec">${secLink(c.section)}</span></div>
      ${C(esc(tx(c.claim)), 'h3')}
      <dl><div><dt>${C(esc(tx(D.ledgerFields.evidence)))}</dt>${C(rich(tx(c.evidence)), 'dd')}</div><div><dt>${C(esc(tx(D.ledgerFields.caveat)))}</dt>${C(rich(tx(c.caveat)), 'dd')}</div></dl>
      ${cite(c.refs)}</article>`).join('') || C(esc(en ? 'No statement has this label.' : '没有这一类的说法。'), 'p', 'muted');
  }
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('.fs-chip');
    if (!b) return;
    for (const c of filter.children) c.setAttribute('aria-pressed', c === b);
    renderLedger(b.dataset.kind);
  });
  renderLedger('');

  // ── 开放问题、学习路线与工具 ────────────────────────────────────────────
  $('#nmr-open').innerHTML = D.openQuestions.map(([status, area, q]) => `<li>${C(rich(tx(q)), 'p')}<div class="fs-open-meta">${st(status)}${secLink(area)}</div></li>`).join('');
  const site = (path) => (path.startsWith('#') ? path : `../${path}`);
  $('#nmr-road').innerHTML = D.path.map((p) => `<li><div class="fs-phase"><span>Step ${p.step}</span></div>${C(esc(tx(p.title)), 'h3')}${C(rich(tx(p.text)), 'p')}
    <ul class="nmr-links">${p.links.map(([href, label]) => `<li><a href="${esc(site(href))}" translate="no" lang="${lang}">${esc(tx(label))} <i class="ico-ext ico-right" aria-hidden="true"></i></a></li>`).join('')}</ul></li>`).join('');
  $('#nmr-tools').innerHTML = D.tools.map((t) => `<li><a href="${esc(t.url)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(t.name)} ${ext}</a>${C(esc(tx(t.text)))}${t.ref ? bare(cite([t.ref])) : ''}</li>`).join('');

  // ── 文献库 ──────────────────────────────────────────────────────────────
  const citedBy = {};
  for (const s of D.sections) for (const id of new Set([...s.refs, ...s.topics.flatMap((t) => t[3] || [])])) (citedBy[id] ||= []).push(s);
  $('#nmr-lib-intro').innerHTML = C(esc(en
    ? `${D.refs.length} references. Each was looked up by its DOI in OpenAlex (which draws on Crossref) on ${D.checked}, and its title, authors, year, journal, volume and pages compared. Filter by area or maturity; each entry links to the publisher through its DOI.`
    : `共 ${D.refs.length} 篇。每一篇都在 ${D.checked} 按 DOI 在 OpenAlex（数据来自 Crossref）查过，题目、作者、年份、期刊、卷号和页码逐项对照。可以按研究领域和成熟程度筛选；每条都通过 DOI 链接到出版方。`));
  const areaSel = $('#nmr-lib-area'), statusSel = $('#nmr-lib-status'), sortSel = $('#nmr-lib-sort');
  areaSel.insertAdjacentHTML('beforeend', Object.entries(D.areas).map(([k, v]) => `<option value="${k}">${esc(tx(v))}</option>`).join(''));
  statusSel.insertAdjacentHTML('beforeend', kinds.map((k) => `<option value="${k}">${esc(tx(D.status[k]))}</option>`).join(''));
  for (const o of [...areaSel.options, ...statusSel.options].filter((o) => o.value)) { o.setAttribute('translate', 'no'); o.lang = lang; }
  function renderRefs() {
    const a = areaSel.value, s = statusSel.value, desc = sortSel.value === 'year-desc';
    const list = D.refs.filter((r) => (!a || r.area === a) && (!s || r.status === s)).sort((x, y) => (desc ? y.year - x.year : x.year - y.year) || x.id.localeCompare(y.id));
    $('#nmr-lib-count').textContent = en ? `${list.length} of ${D.refs.length}` : `显示 ${list.length} / ${D.refs.length} 篇`;
    $('#nmr-refs').innerHTML = list.map((r) => `<li class="fs-ref" id="ref-${r.id}">
      <span translate="no">${esc(r.authors)} (${r.year}). <span class="fs-ref-title">${esc(r.title)}</span>. <i>${esc(r.journal)}</i>${r.vol ? ` ${esc(r.vol)}` : ''}${r.pages ? `, ${esc(r.pages)}` : ''}.</span>
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

  function openFromHash() {
    const h = location.hash.slice(1);
    if (h.startsWith('s-')) { if (selectTab(h.slice(2))) setTimeout(() => $('#nmr-sections').scrollIntoView({ block: 'start' }), 60); }
    else if (h.startsWith('ref-') && $(`#${CSS.escape(h)}`)) setTimeout(() => $(`#${CSS.escape(h)}`).scrollIntoView({ block: 'center' }), 60);
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  // ── 画图工具 ────────────────────────────────────────────────────────────
  const css = () => { const s = getComputedStyle(document.documentElement); const g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent-text'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), ok: g('--ok'), paper: g('--paper'), violet: g('--violet') }; };
  function fit(cv) {
    const ratio = cv.dataset.ratio ? Number(cv.dataset.ratio) : (cv.dataset.ratio = cv.height / cv.width, cv.height / cv.width);
    const w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth), h = Math.round(w * Math.max(ratio, w < 420 ? 0.62 : 0)), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  const sup = (s) => String(s).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
  const fmt = (v, d = 3) => (!Number.isFinite(v) ? '∞' : Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`) : Number(v.toPrecision(d)).toString());
  const big = (v) => (v >= 1e7 ? fmt(v) : Math.round(v).toLocaleString('en-US'));
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  // 一张图：series 里 { xs, ys, color } 画折线，加 sticks: true 画从横轴竖起的线（谱线、旋转边带），加 fill 填充到横轴
  function plot(cv, o) {
    const { ctx, w, h } = fit(cv), c = css();
    const pad = { l: o.yt.length ? 54 : 26, r: 12, t: 26, b: 34 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const X = (v) => pad.l + ((v - o.x0) / (o.x1 - o.x0)) * W, Y = (v) => pad.t + H - ((v - o.y0) / (o.y1 - o.y0)) * H;
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
    let lastX = -1e9;
    for (const t of o.xt) { ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), pad.t + H); ctx.stroke(); const lab = String(o.xf(t)), wd = ctx.measureText(lab).width; if (Math.abs(X(t) - lastX) > wd + 6) { const edge = X(t) + wd / 2 > w - 2; ctx.textAlign = edge ? 'right' : 'center'; ctx.fillText(lab, edge ? w - 2 : X(t), pad.t + H + 15); lastX = X(t); } }
    for (const t of o.yt) { ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(pad.l + W, Y(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(o.yf(t), pad.l - 6, Y(t) + 4); }
    ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + H); ctx.lineTo(pad.l + W, pad.t + H); ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = 'center'; ctx.fillText(o.xl, pad.l + W / 2, h - 4);
    ctx.save(); ctx.translate(11, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yl, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip();
    for (const s of o.series) {
      if (s.sticks) { ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; s.xs.forEach((x, i) => { ctx.beginPath(); ctx.moveTo(X(x), Y(0)); ctx.lineTo(X(x), Y(s.ys[i])); ctx.stroke(); }); continue; }
      ctx.beginPath();
      let pen = false;
      s.xs.forEach((x, i) => { const y = s.ys[i]; if (!Number.isFinite(y)) { pen = false; return; } if (pen) ctx.lineTo(X(x), Y(y)); else { ctx.moveTo(X(x), Y(y)); pen = true; } });
      if (s.fill) { ctx.lineTo(X(s.xs[s.xs.length - 1]), Y(0)); ctx.lineTo(X(s.xs[0]), Y(0)); ctx.closePath(); ctx.globalAlpha = 0.22; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = 1; }
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
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx, 10); ctx.lineTo(lx + 16, 10); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(s.label, lx + 20, 14);
      lx += wd + 8;
    }
  }
  const ticks = (a, b, n = 5) => { const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m - 1e-9) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(10))); return out; };
  const ints = (a, b) => { const out = []; for (let t = Math.ceil(a); t <= b; t++) out.push(t); return out; };
  const pow = (t) => (t === 0 ? '1' : `10${sup(t)}`);
  const readout = (el, rows) => { el.innerHTML = rows.map(([k, v, bigv]) => `<dt>${C(rich(en ? k[1] : k[0]))}</dt><dd${bigv ? ' class="fs-big"' : ''} translate="no">${v}</dd>`).join(''); };
  const val = (id) => Number($(`#${id}`).value);
  const bind = (ids, fn) => { for (const id of ids) $(`#${id}`).addEventListener('input', fn); };
  const lazy = (fn) => { let q = 0; return () => { cancelAnimationFrame(q); q = requestAnimationFrame(fn); }; };
  const set = (id, v) => { $(`#${id}`).value = v; };
  const press = (id, fn) => $(`#${id}`).addEventListener('click', fn);
  const time = (t) => (t >= 1 ? `${fmt(t)} s` : t >= 1e-3 ? `${fmt(t * 1e3)} ms` : t >= 1e-6 ? `${fmt(t * 1e6)} μs` : t >= 1e-9 ? `${fmt(t * 1e9)} ns` : `${fmt(t * 1e12)} ps`);
  const hz = (f) => (Math.abs(f) >= 1e9 ? `${fmt(f / 1e9, 4)} GHz` : Math.abs(f) >= 1e6 ? `${fmt(f / 1e6, 4)} MHz` : Math.abs(f) >= 1e3 ? `${fmt(f / 1e3)} kHz` : `${fmt(f)} Hz`);
  const tesla = (b) => (b >= 0.1 ? `${fmt(b)} T` : b >= 1e-4 ? `${fmt(b * 1e3)} mT` : `${fmt(b * 1e6)} μT`);
  const perc = (v, d = 1) => `${(100 * v).toFixed(d)} %`;

  // ── 演示 1：FID 与傅里叶变换 ────────────────────────────────────────────
  const FT = { sw: 200, f0: 30, noise: 0.15 };
  function ftDraw() {
    const c = css(), T2 = 10 ** val('f-t2'), aq = 10 ** val('f-aq'), lb = val('f-lb'), ns = 2 ** val('f-ns');
    $('#f-t2-v').textContent = time(T2); $('#f-aq-v').textContent = time(aq); $('#f-lb-v').textContent = `${lb.toFixed(2)} Hz`; $('#f-ns-v').textContent = String(ns);
    const n = Math.max(8, Math.round(aq * FT.sw)), fid = M.fid([{ f: FT.f0, T2 }], { sw: FT.sw, n, noise: FT.noise / Math.sqrt(ns), seed: 11 });
    const ts = Array.from({ length: n }, (_, i) => i * fid.dt);
    plot($('#f-fid'), { x0: 0, x1: aq, y0: -1.4, y1: 1.4, xt: ticks(0, aq, 6), yt: [-1, 0, 1], xf: (t) => t, yf: (t) => t, xl: en ? 'time (s)' : '时间（s）', yl: en ? 'signal' : '信号',
      series: [{ xs: ts, ys: Array.from(fid.re), color: c.accent, width: 1.5, label: en ? 'real part of the FID' : 'FID 的实部' },
        { xs: ts, ys: ts.map((t) => Math.exp(-t / T2)), color: c.muted, dash: [5, 4], width: 1.2, label: 'exp(−t/T₂*)' }],
      marks: T2 < aq ? [{ x: T2, color: c.gold }] : [] });
    const sp = M.spectrum(fid, { lb, size: 2048 }), f = Array.from(sp.f), y = Array.from(sp.y);
    const m = M.measureWidth(sp.f, sp.y);
    let s1 = 0, s2 = 0, k = 0;
    for (let i = 0; i < f.length; i++) if (f[i] > -95 && f[i] < -15) { s1 += y[i]; s2 += y[i] * y[i]; k++; }
    const rms = Math.sqrt(Math.max(0, s2 / k - (s1 / k) ** 2)), snr = m.height / rms, natural = M.fwhm(T2), expected = natural + lb, trunc = aq < 3 * T2 / (1 + Math.PI * lb * T2);
    const lo = Math.min(...y.filter((_, i) => f[i] >= 0 && f[i] <= 60));
    plot($('#f-spec'), { x0: 0, x1: 60, y0: Math.min(-0.12 * m.height, lo * 1.1), y1: m.height * 1.12, xt: ticks(0, 60, 6), yt: [], xf: (t) => t, yf: () => '', xl: en ? 'frequency (Hz)' : '频率（Hz）', yl: en ? 'intensity' : '强度',
      series: [{ xs: f, ys: y, color: c.accent, width: 1.8, label: en ? 'spectrum (real part)' : '谱（实部）' }], hmarks: [{ y: 0, color: c.line }] });
    readout($('#f-read'), [
      [['谱上量到的线宽（半高全宽）', 'Linewidth measured on the spectrum (FWHM)'], `${fmt(m.width)} Hz`, true],
      [['按公式 1/(πT₂*) + 线展宽', 'From 1/(πT₂*) + line broadening'], `${fmt(expected)} Hz`],
      [['信噪比（峰高 / 噪声均方根）', 'Signal-to-noise (peak height / r.m.s. noise)'], rms > 0 ? fmt(snr) : '∞'],
      [['数字分辨率 1 / 采样时间', 'Digital resolution, 1 / acquisition time'], `${fmt(1 / aq)} Hz`],
      [['采样点数', 'Points acquired'], String(n)],
    ]);
    $('#f-cap').innerHTML = trunc
      ? L(`采样在信号衰减完之前就停了（采样时间 ${time(aq)}，不到衰减时间的三倍）：谱线两侧出现正负交替的波纹，线宽由采样时间决定，而不是 T₂*。加一点指数窗可以压掉波纹，代价是线变宽。`, `Acquisition stops before the signal has decayed (${time(aq)}, less than three decay times): alternating wiggles appear on both sides and the width is set by the acquisition time, not T₂*. An exponential window removes the wiggles at the cost of a broader line.`)
      : Math.abs(lb - natural) < 0.25 * natural
        ? L(`线展宽约等于自然线宽（匹配滤波）：信噪比最高，线宽变成原来的两倍。这是灵敏度和分辨率之间的标准取舍。`, `The line broadening roughly equals the natural width (a matched filter): the best signal-to-noise, at twice the linewidth. This is the standard trade between sensitivity and resolution.`)
        : L(`洛伦兹线的半高全宽是 1/(πT₂*) = ${fmt(natural)} Hz，加上窗函数的 ${lb.toFixed(2)} Hz。累加 ${ns} 次让噪声降到 1/√${ns}：信噪比翻一倍要多花四倍时间。`, `A Lorentzian line has a full width at half height of 1/(πT₂*) = ${fmt(natural)} Hz, plus ${lb.toFixed(2)} Hz from the window. Adding ${ns} scans reduces the noise by √${ns}: doubling signal-to-noise costs four times the time.`);
    $('#f-spec').setAttribute('aria-label', en ? `Spectrum; linewidth ${fmt(m.width)} Hz, signal-to-noise ${fmt(snr)}` : `傅里叶变换后的谱；线宽 ${fmt(m.width)} Hz，信噪比 ${fmt(snr)}`);
  }
  bind(['f-t2', 'f-aq', 'f-lb', 'f-ns'], lazy(ftDraw));
  press('f-trunc', () => { set('f-t2', 0); set('f-aq', -0.7); set('f-lb', 0); ftDraw(); });
  press('f-match', () => { set('f-aq', 0.3); set('f-t2', -0.5); set('f-lb', (M.fwhm(10 ** -0.5)).toFixed(2)); ftDraw(); });
  press('f-acc', () => { set('f-ns', 8); ftDraw(); });

  // ── 演示 2：自旋体系 ────────────────────────────────────────────────────
  let preset = M.PRESETS[0];
  $('#s-presets').innerHTML = M.PRESETS.map((p, i) => `<button type="button" class="button" data-preset="${p.id}" aria-pressed="${i === 0}" translate="no" lang="${lang}">${esc(en ? p.en : p.zh)}</button>`).join('');
  function spinsDraw() {
    const c = css(), field = 10 ** val('s-field'), lw = val('s-lw');
    $('#s-field-v').textContent = `${field >= 1000 ? fmt(field / 1000, 3) + ' GHz' : Math.round(field) + ' MHz'}`; $('#s-lw-v').textContent = `${lw.toFixed(1)} Hz`;
    const lines = M.mergeLines(M.spinSystem({ shifts: preset.shifts, J: preset.J, field }), 0.02).filter((l) => l.I > 2e-3);
    const lo = Math.min(...preset.shifts), hi = Math.max(...preset.shifts), margin = Math.max(0.12, 40 / field), a = lo - margin, b = hi + margin;
    const sp = M.renderSpectrum(lines, { field, lo: a, hi: b, npts: 1600, lw });
    const ymax = Math.max(...sp.y);
    plot($('#s-spec'), { x0: b, x1: a, y0: -0.03 * ymax, y1: ymax * 1.1, xt: ticks(a, b, 7), yt: [], xf: (t) => t, yf: () => '', xl: en ? 'chemical shift (ppm)' : '化学位移（ppm）', yl: en ? 'intensity' : '强度',
      series: [{ xs: Array.from(sp.x), ys: Array.from(sp.y), color: c.accent, width: 1.7, label: en ? `${Math.round(field)} MHz` : `${Math.round(field)} MHz` }] });
    let ratio = Infinity, jmax = 0;
    for (let i = 0; i < preset.shifts.length; i++) for (let j = i + 1; j < preset.shifts.length; j++) { const J = Math.abs(preset.J[i]?.[j] || 0), dv = Math.abs(preset.shifts[i] - preset.shifts[j]) * field; if (J > 0.2 && dv > 0) { ratio = Math.min(ratio, dv / J); jmax = Math.max(jmax, J); } }
    readout($('#s-read'), [
      [['最小的 Δν / J', 'Smallest Δν / J'], fmt(ratio), true],
      [['磁场', 'Field'], `${fmt(M.fieldOf(field), 3)} T`],
      [['自旋数', 'Number of spins'], String(preset.shifts.length)],
      [['强度超过 0.2% 的跃迁', 'Transitions above 0.2% intensity'], String(lines.length)],
      [['谱宽（Hz）', 'Spectral span (Hz)'], fmt((hi - lo) * field)],
    ]);
    $('#s-cap').innerHTML = ratio < 3
      ? L(`Δν/J = ${fmt(ratio)}：强耦合。位移差和耦合常数差不多大，谱线的位置和强度都不能用“n+1 规则”读出来，必须对角化哈密顿量；内侧的线高、外侧的线矮。`, `Δν/J = ${fmt(ratio)}: strong coupling. Shift difference and coupling are comparable, so neither line positions nor intensities follow the n+1 rule and the Hamiltonian has to be diagonalised; inner lines are tall, outer lines short.`)
      : ratio < 12
        ? L(`Δν/J = ${fmt(ratio)}：多重峰的形状大致对了，但强度向耦合的对方倾斜（屋顶效应）。台式低场谱仪的谱常常是这个样子。`, `Δν/J = ${fmt(ratio)}: the multiplets have roughly the right shape, but their intensities lean towards the coupling partner (the roof effect). Benchtop low-field spectra often look like this.`)
        : L(`Δν/J = ${fmt(ratio)}：弱耦合（一级谱）。每组峰按 n+1 规则分裂，强度接近二项式系数；耦合常数（Hz）不随磁场变，所以用 ppm 画时多重峰越来越窄。`, `Δν/J = ${fmt(ratio)}: weak coupling (a first-order spectrum). Each group splits by the n+1 rule with near-binomial intensities; couplings in Hz do not change with field, so on a ppm axis the multiplets become ever narrower.`);
    $('#s-spec').setAttribute('aria-label', en ? `Simulated ¹H spectrum of ${preset.en} at ${Math.round(field)} MHz` : `${preset.zh} 在 ${Math.round(field)} MHz 下的模拟 ¹H 谱`);
  }
  $('#s-presets').addEventListener('click', (e) => {
    const b = e.target.closest('[data-preset]');
    if (!b) return;
    preset = M.PRESETS.find((p) => p.id === b.dataset.preset);
    for (const x of $('#s-presets').children) x.setAttribute('aria-pressed', x === b);
    spinsDraw();
  });
  bind(['s-field', 's-lw'], lazy(spinsDraw));
  for (const [id, mhz] of [['s-60', 60], ['s-400', 400], ['s-1200', 1200]]) press(id, () => { set('s-field', Math.log10(mhz)); spinsDraw(); });

  // ── 演示 3：弛豫与 NOE ──────────────────────────────────────────────────
  const TC = Array.from({ length: 151 }, (_, i) => -12 + (5 * i) / 150);
  function relaxDraw() {
    const c = css(), ltc = val('r-tc'), tc = 10 ** ltc, field = val('r-field'), r = val('r-r');
    $('#r-tc-v').textContent = time(tc); $('#r-field-v').textContent = `${field} MHz`; $('#r-r-v').textContent = `${r.toFixed(2)} Å`;
    const all = TC.map((l) => M.relax({ field, tc: 10 ** l, r })), now = M.relax({ field, tc, r });
    const lt1 = all.map((q) => Math.log10(q.T1)), lt2 = all.map((q) => Math.log10(q.T2));
    const y0 = Math.floor(Math.min(...lt2)), y1 = Math.ceil(Math.max(...lt1, ...lt2));
    const xt = ints(-12, -7), xf = (t) => ({ '-12': '1 ps', '-11': '10 ps', '-10': '100 ps', '-9': '1 ns', '-8': '10 ns', '-7': '100 ns' }[t]);
    plot($('#r-t'), { x0: -12, x1: -7, y0, y1, xt, yt: ints(y0, y1), xf, yf: (t) => `${pow(t)} s`, xl: en ? 'correlation time τc' : '相关时间 τc', yl: en ? 'relaxation time' : '弛豫时间',
      series: [{ xs: TC, ys: lt1, color: c.accent, width: 2.2, label: 'T₁' }, { xs: TC, ys: lt2, color: c.info, width: 2.2, label: 'T₂' }],
      marks: [{ x: ltc, y: Math.log10(now.T1), color: c.gold }, { x: ltc, y: Math.log10(now.T2), color: c.gold }] });
    plot($('#r-noe'), { x0: -12, x1: -7, y0: -1.1, y1: 0.6, xt, yt: [-1, -0.5, 0, 0.5], xf, yf: (t) => `${t > 0 ? '+' : ''}${100 * t} %`, xl: en ? 'correlation time τc' : '相关时间 τc', yl: 'NOE',
      series: [{ xs: TC, ys: all.map((q) => q.noe), color: c.accent, width: 2.2, label: en ? 'steady-state NOE' : '稳态 NOE' }],
      hmarks: [{ y: 0, color: c.muted }], marks: [{ x: ltc, y: now.noe, color: c.gold }] });
    readout($('#r-read'), [
      [['T₁', 'T₁'], time(now.T1), true],
      [['T₂', 'T₂'], time(now.T2), true],
      [['线宽 1/(πT₂)', 'Linewidth 1/(πT₂)'], hz(now.linewidth)],
      [['稳态 NOE', 'Steady-state NOE'], `${now.noe > 0 ? '+' : ''}${perc(now.noe)}`],
      [['ωτ_c', 'ωτ_c'], fmt(now.x)],
    ]);
    $('#r-cap').innerHTML = now.x < 0.3
      ? L(`ωτ_c = ${fmt(now.x)} ≪ 1（极窄化区）：分子转得比拉莫尔频率快得多，T₁ ≈ T₂，线很窄，NOE 是正的。有机小分子在普通溶剂里就在这里。`, `ωτ_c = ${fmt(now.x)} ≪ 1 (extreme narrowing): the molecule tumbles much faster than the Larmor frequency, T₁ ≈ T₂, lines are narrow and the NOE is positive. Small organic molecules in ordinary solvents live here.`)
      : now.x < 3
        ? L(`ωτ_c = ${fmt(now.x)}，接近 1：T₁ 在最小值附近，NOE 很弱甚至为零（过零点在 ωτ_c ≈ 1.12）。分子量 1000 上下的分子常落在这里，这时改用 ROESY。`, `ωτ_c = ${fmt(now.x)}, close to 1: T₁ is near its minimum and the NOE is weak or zero (the crossing is at ωτ_c ≈ 1.12). Molecules of about 1000 Da often land here, which is when ROESY is used instead.`)
        : L(`ωτ_c = ${fmt(now.x)} ≫ 1（慢运动区）：T₁ 回升，T₂ 继续缩短，线宽 ${hz(now.linewidth)}；NOE 是负的，而且自旋扩散很快。这就是大蛋白质谱线变宽、需要氘代和 TROSY 的原因。`, `ωτ_c = ${fmt(now.x)} ≫ 1 (slow motion): T₁ rises again while T₂ keeps shortening, giving a ${hz(now.linewidth)} line; the NOE is negative and spin diffusion is fast. This is why large proteins give broad lines and call for deuteration and TROSY.`);
    $('#r-t').setAttribute('aria-label', en ? `T₁ and T₂ against correlation time; now T₁ = ${time(now.T1)}, T₂ = ${time(now.T2)}` : `T₁ 和 T₂ 随相关时间变化；现在 T₁ = ${time(now.T1)}，T₂ = ${time(now.T2)}`);
  }
  bind(['r-tc', 'r-field', 'r-r'], lazy(relaxDraw));
  const fromMw = (kda) => { if (!(kda > 0)) return; set('r-tc', Math.max(-12, Math.min(-7, Math.log10(M.tauC({ mw: kda * 1000 }).tc))).toFixed(2)); relaxDraw(); };
  press('r-mw-go', () => fromMw(Number($('#r-mw').value)));
  $('#r-mw').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); fromMw(Number(e.target.value)); } });
  press('r-small', () => { set('r-tc', -11); relaxDraw(); });
  press('r-zero', () => { set('r-tc', Math.log10(Math.sqrt(5) / 2 / (2 * Math.PI * val('r-field') * 1e6)).toFixed(2)); relaxDraw(); });
  press('r-prot', () => { set('r-mw', 20); fromMw(20); });

  // ── 演示 4：魔角旋转 ────────────────────────────────────────────────────
  const powderCache = new Map();
  const smooth = (p) => { const y = Array.from(p.y); return { f: p.f, y: y.map((v, i) => (0.25 * (y[i - 1] ?? v) + 0.5 * v + 0.25 * (y[i + 1] ?? v))) }; }; // 直方图的格点噪声用三点平均抹掉
  const powder = (delta, eta) => { const k = `${delta}|${eta}`; if (!powderCache.has(k)) { if (powderCache.size > 40) powderCache.clear(); powderCache.set(k, smooth(M.powder({ delta, eta, bins: 110, grid: 330 }))); } return powderCache.get(k); };
  function masDraw() {
    const c = css(), delta = val('m-delta'), eta = val('m-eta'), rate = 10 ** val('m-rate'); // 都用 kHz
    $('#m-delta-v').textContent = `${delta.toFixed(1)} kHz`; $('#m-eta-v').textContent = eta.toFixed(2); $('#m-rate-v').textContent = `${fmt(rate)} kHz`;
    const sb = M.sidebands({ delta, eta, rate, grid: 16 }), pw = powder(delta, eta);
    const centre = sb.find((s) => s.N === 0).I, seen = sb.filter((s) => s.N !== 0 && s.I > 0.01).length;
    const xr = 1.25 * delta, ymax = Math.max(...sb.map((s) => s.I)) * 1.12, pmax = Math.max(...pw.y);
    const vis = sb.filter((s) => Math.abs(s.f) <= xr && s.I > 5e-4);
    plot($('#m-spec'), { x0: xr, x1: -xr, y0: 0, y1: ymax, xt: ticks(-xr, xr, 6), yt: ticks(0, ymax, 4), xf: (t) => t, yf: (t) => `${Math.round(100 * t)} %`, xl: en ? 'frequency from the isotropic shift (kHz)' : '相对各向同性位移的频率（kHz）', yl: en ? 'share of intensity' : '强度占比',
      series: [{ xs: Array.from(pw.f), ys: Array.from(pw.y).map((v) => (v / pmax) * ymax * 0.55), color: c.muted, width: 1.3, fill: true, label: en ? 'static powder (scaled)' : '静止粉末谱（任意比例）' },
        { xs: vis.map((s) => s.f), ys: vis.map((s) => s.I), color: c.accent, sticks: true, width: 2.4, label: en ? 'under MAS' : '魔角旋转下' },
        { xs: [0], ys: [centre], color: c.gold, sticks: true, width: 2.8, label: en ? 'centreband' : '中心带' }] });
    readout($('#m-read'), [
      [['中心带占全部强度', 'Centreband share of the intensity'], perc(centre), true],
      [['强度超过 1% 的边带', 'Sidebands above 1%'], String(seen)],
      [['δ / ν_r', 'δ / ν_r'], fmt(delta / rate)],
      [['粉末谱的总宽度', 'Full width of the powder pattern'], `${fmt(delta * (3 + eta) / 2)} kHz`],
      [['魔角', 'Magic angle'], `${(M.MAGIC * 180 / Math.PI).toFixed(2)}°`],
    ]);
    $('#m-cap').innerHTML = delta / rate > 2
      ? L(`转速比各向异性小得多：谱分裂成间隔 ν_r = ${fmt(rate)} kHz 的许多边带，它们的包络大致描出静止粉末谱（灰色）。由边带强度可以反推出 δ 和 η（Herzfeld–Berger 分析）。`, `Spinning much slower than the anisotropy: the spectrum splits into many sidebands spaced by ν_r = ${fmt(rate)} kHz whose envelope roughly traces the static powder pattern (grey). The sideband intensities give back δ and η (Herzfeld–Berger analysis).`)
      : delta / rate > 0.5
        ? L(`转速和各向异性相当：只剩几条边带，${perc(centre, 0)} 的强度已经回到中心带。`, `Spinning comparable to the anisotropy: a few sidebands remain and ${perc(centre, 0)} of the intensity is back in the centreband.`)
        : L(`转速远大于各向异性：几乎全部强度（${perc(centre)}）集中在各向同性位移处，和溶液谱一样是一条线。化学位移各向异性容易转掉；¹H 之间的偶极耦合是均匀展宽，要转到 100 kHz 以上才明显变窄。`, `Spinning far above the anisotropy: nearly all the intensity (${perc(centre)}) sits at the isotropic shift, one line as in solution. Shift anisotropy is easy to spin out; ¹H–¹H dipolar couplings broaden homogeneously and only narrow markedly above 100 kHz.`);
    $('#m-spec').setAttribute('aria-label', en ? `Spinning sidebands at ${fmt(rate)} kHz; centreband ${perc(centre)}` : `转速 ${fmt(rate)} kHz 下的旋转边带；中心带占 ${perc(centre)}`);
  }
  bind(['m-delta', 'm-eta', 'm-rate'], lazy(masDraw));
  for (const [id, khz] of [['m-slow', 1], ['m-mid', 15], ['m-fast', 150]]) press(id, () => { set('m-rate', Math.log10(khz).toFixed(2)); masDraw(); });

  // ── 演示 5：极化度 ──────────────────────────────────────────────────────
  $('#p-nuc').innerHTML = Object.entries(M.NUCLEI).map(([k, n]) => `<option value="${k}">${esc(n.label)}${String(n.spin) !== '1/2' ? (en ? ` (spin ${n.spin})` : `（自旋 ${n.spin}）`) : ''}</option>`).join('');
  $('#p-nuc').setAttribute('translate', 'no');
  const LT = Array.from({ length: 131 }, (_, i) => (2.6 * i) / 130);
  function polarDraw() {
    const c = css(), key = $('#p-nuc').value, nuc = M.NUCLEI[key], B = 10 ** val('p-b'), T = 10 ** val('p-t');
    $('#p-b-v').textContent = tesla(B); $('#p-t-v').textContent = `${fmt(T)} K`;
    const pn = M.nuclearP(key, B, T), pe = M.electronP(B, T), lg = (v) => Math.log10(Math.max(v, 1e-300));
    const yn = LT.map((l) => lg(M.nuclearP(key, B, 10 ** l))), ye = LT.map((l) => lg(M.electronP(B, 10 ** l)));
    const y0 = Math.floor(Math.min(...yn));
    plot($('#p-curve'), { x0: 0, x1: 2.6, y0, y1: 0.15, xt: [0, 0.477, 1, 1.477, 2, 2.474], yt: ints(y0, 0).filter((t) => (y0 < -8 ? t % 2 === 0 : true)), xf: (t) => `${Math.round(10 ** t)} K`, yf: pow, xl: en ? 'temperature' : '温度', yl: en ? 'polarisation P' : '极化度 P',
      series: [{ xs: LT, ys: yn, color: c.accent, width: 2.3, label: nuc.label }, { xs: LT, ys: ye, color: c.info, width: 2, dash: [6, 4], label: en ? 'electron' : '电子' }],
      marks: [{ x: Math.log10(T), y: lg(pn), color: c.gold }, { x: Math.log10(T), y: lg(pe), color: c.gold }] });
    const rc = M.receptivity(key), ppm = pn * 1e6;
    readout($('#p-read'), [
      [['核的极化度', 'Nuclear polarisation'], pn >= 0.001 ? perc(pn, 2) : `${fmt(ppm)} ppm`, true],
      [['相当于每多少个自旋净多出 1 个', 'One net spin in every'], big(1 / pn)],
      [['同样条件下电子的极化度', 'Electron polarisation, same conditions'], pe >= 0.001 ? perc(pe, 2) : `${fmt(pe * 1e6)} ppm`],
      [['拉莫尔频率', 'Larmor frequency'], hz(M.larmor(key, B) * 1e6)],
      [['DNP 增强上限 γ_e/γ_n', 'DNP enhancement ceiling γ_e/γ_n'], fmt(M.dnpMax(key), 4)],
      [['相对 ¹H 的灵敏度（等量自旋 / 天然丰度）', 'Sensitivity relative to ¹H (equal spins / natural abundance)'], `${fmt(rc.perSpin)} / ${fmt(rc.natural)}`],
    ]);
    $('#p-cap').innerHTML = pe > 0.5 && pn < 0.05
      ? L(`${fmt(T)} K、${tesla(B)} 下电子几乎完全极化（${perc(pe, 0)}），核只有 ${perc(pn, 2)}。溶解 DNP 就在这样的条件下用微波把电子的极化搬给核，再迅速溶解、送进谱仪。`, `At ${fmt(T)} K and ${tesla(B)} the electrons are almost fully polarised (${perc(pe, 0)}) while the nuclei reach only ${perc(pn, 2)}. Dissolution DNP uses microwaves under such conditions to hand the electron polarisation to the nuclei, then dissolves the sample quickly and transfers it to the spectrometer.`)
      : pn < 1e-6
        ? L(`极化度只有 ${fmt(ppm)} ppm：这么低的磁场下，热平衡信号几乎测不到。低场和零场 NMR 因此要靠预极化、超极化或者光泵磁力计这样的非感应探测。`, `The polarisation is only ${fmt(ppm)} ppm: at so low a field the thermal signal is barely detectable. Low- and zero-field NMR therefore rely on prepolarisation, hyperpolarisation or non-inductive detectors such as optically pumped magnetometers.`)
        : L(`每 ${big(1 / pn)} 个 ${nuc.label} 自旋里只有 1 个净贡献信号，这就是 NMR 灵敏度低的根源。极化度与 B₀/T 成正比：把磁场加倍只赚两倍，而借用电子的极化最多可以赚 ${fmt(M.dnpMax(key), 3)} 倍。`, `Only one ${nuc.label} spin in ${big(1 / pn)} contributes net signal, which is the root of NMR's low sensitivity. Polarisation is proportional to B₀/T: doubling the field buys a factor of two, while borrowing electron polarisation can buy up to ${fmt(M.dnpMax(key), 3)}.`);
    $('#p-curve').setAttribute('aria-label', en ? `Polarisation against temperature at ${tesla(B)}; ${nuc.label} now ${fmt(ppm)} ppm` : `${tesla(B)} 下极化度随温度变化；${nuc.label} 现在是 ${fmt(ppm)} ppm`);
  }
  bind(['p-b', 'p-t'], lazy(polarDraw));
  $('#p-nuc').addEventListener('change', polarDraw);
  press('p-room', () => { set('p-b', Math.log10(9.4)); set('p-t', Math.log10(298)); polarDraw(); });
  press('p-ddnp', () => { set('p-nuc', 'C13'); set('p-b', Math.log10(3.35)); set('p-t', Math.log10(1.2)); polarDraw(); });
  press('p-earth', () => { set('p-nuc', 'H1'); set('p-b', Math.log10(5e-5)); set('p-t', Math.log10(298)); polarDraw(); });

  // ── 启动、重绘 ──────────────────────────────────────────────────────────
  const redraw = () => { ftDraw(); spinsDraw(); relaxDraw(); masDraw(); polarDraw(); };
  redraw();
  const later = lazy(redraw);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(later); for (const id of ['f-fid', 's-spec', 'r-t', 'm-spec', 'p-curve']) ro.observe($(`#${id}`)); }
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', later);
})();
