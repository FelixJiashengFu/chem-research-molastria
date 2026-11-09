'use strict';
// 量子生物学：把 qb-data.js 的内容画成页面（层次、方向与详解、证据账本、开放问题、学习路线、文献库），
// 并驱动交互式实验室的三个演示（数学在 qb-models.js，这里只负责控件和画图）。
// 内容是中英两版，按站点语言取用，标 translate="no"；界面上固定的文字写中文，由 i18n.js 翻译。
// 地址：#s-<方向> 打开对应的详解，#ref-<id> 跳到文献，#demo-… 跳到演示。
(() => {
  const D = window.MOLASTRIA_QB, MATH = window.MOLASTRIA_QB_MATH || {}, M = window.MOLASTRIA_QB_MODELS;
  if (!D || !M) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  // 正文里的 x^{…}、ω_{mn} 之类写成上下标
  const rich = (s) => esc(s).replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/([A-Za-zΓγλΔσρΩωεΦκ])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/g, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(rich(en ? e : zh)); // 说明文字里的 A_H、k_B 写成下标
  const st = (s) => `<span class="fs-st" data-s="${s}" translate="no" lang="${lang}">${esc(tx(D.status[s]))}</span>`;
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  const refById = Object.fromEntries(D.refs.map((r) => [r.id, r]));
  const surname = (a) => a.trim().replace(/ et al\..*/, '').split(' ').pop();
  const shortRef = (r) => { const list = r.authors.replace(/ et al\..*/, '').split(','); const many = list.length > 2 || /et al/.test(r.authors); return `${surname(list[0])}${many ? ' et al.' : list.length === 2 ? ` & ${surname(list[1])}` : ''} ${r.year}`; };
  const cite = (ids) => (ids?.length ? `<p class="fs-cite">${ids.map((id) => `<a href="#ref-${id}" data-ref="${id}" translate="no">${esc(shortRef(refById[id]))}</a>`).join(' · ')}</p>` : '');
  const secById = Object.fromEntries(D.sections.map((s) => [s.id, s]));
  const secLink = (id) => `<a href="#s-${id}" data-tab="${id}" translate="no" lang="${lang}">${secById[id].num} · ${esc(tx(secById[id].title))}</a>`;

  // ── 首屏、理念与层次 ────────────────────────────────────────────────────
  $('#qb-crumbs').innerHTML = `<a href="../index.html">${L('量子嘉年华', 'Quantum Carnival')}</a><span aria-hidden="true">/</span>${L('量子生物学', 'Quantum Biology')}`;
  $('#qb-question').innerHTML = C(esc(tx(D.hero.question))) + (en ? '' : `<span class="fs-q-en" lang="en" translate="no">${esc(D.hero.question.en)}</span>`);
  $('#qb-lead').innerHTML = C(esc(tx(D.hero.lead)));
  $('#qb-honest').innerHTML = C(esc(tx(D.hero.honesty)));
  $('#qb-legend').innerHTML = Object.keys(D.status).map((s) => `<li>${st(s)}${C(esc(tx(D.statusLong[s])))}</li>`).join('');
  $('#qb-intro-text').innerHTML = D.intro.map((p) => C(esc(tx(p)), 'p')).join('');
  $('#qb-levels').innerHTML = D.levels.map((l, i) => `<article class="qb-level" data-k="${l.k}"><span class="qb-level-n">Level ${i + 1}</span><h4>${C(esc(tx(l.title)))}${st(l.status)}</h4>${C(esc(tx(l.text)), 'p')}</article>`).join('');
  for (const el of document.querySelectorAll('[data-demo-intro]')) { el.innerHTML = rich(tx(D.demos[el.dataset.demoIntro].intro)); el.setAttribute('translate', 'no'); el.lang = lang; }
  for (const el of document.querySelectorAll('[data-demo-notes]')) { el.innerHTML = rich(tx(D.demos[el.dataset.demoNotes].notes)); el.setAttribute('translate', 'no'); el.lang = lang; }
  for (const el of document.querySelectorAll('.fs-demo .fs-formula[data-math]')) { if (MATH[el.dataset.math]) { el.innerHTML = MATH[el.dataset.math]; el.tabIndex = 0; } else el.textContent = D.math[el.dataset.math]?.[0] || ''; }

  // ── 研究方向与详解 ──────────────────────────────────────────────────────
  $('#qb-pillar-grid').innerHTML = D.pillars.map((p) => `<a class="fs-pillar" href="#s-${p.id}" data-tab="${p.id}">
    <span class="fs-num">${p.num}</span>${C(esc(tx(p.title)), 'h3')}${C(esc(tx(p.summary)), 'p')}<span class="fs-more">阅读详解 <i class="ico-ext ico-right" aria-hidden="true"></i></span></a>`).join('');

  const tabs = $('#qb-tabs'), panels = $('#qb-panels');
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
    if (scroll) $('#qb-sections').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
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

  // ── 证据账本 ────────────────────────────────────────────────────────────
  $('#qb-ledger-note').innerHTML = C(esc(tx(D.ledgerNote)));
  const filter = $('#qb-ledger-filter'), kinds = Object.keys(D.status);
  filter.innerHTML = `<button type="button" class="fs-chip" data-kind="" aria-pressed="true">全部</button>` + kinds.map((k) => `<button type="button" class="fs-chip" data-kind="${k}" aria-pressed="false">${C(esc(tx(D.status[k])))}</button>`).join('');
  function renderLedger(kind) {
    $('#qb-ledger-grid').innerHTML = D.ledger.filter((c) => !kind || c.status === kind).map((c) => `<article class="fs-theory" id="claim-${c.id}">
      <div class="fs-theory-meta">${st(c.status)}<span class="qb-ledger-sec">${secLink(c.section)}</span></div>
      ${C(esc(tx(c.claim)), 'h3')}
      <dl><div><dt>${C(esc(tx(D.ledgerFields.evidence)))}</dt>${C(rich(tx(c.evidence)), 'dd')}</div><div><dt>${C(esc(tx(D.ledgerFields.caveat)))}</dt>${C(rich(tx(c.caveat)), 'dd')}</div></dl>
      ${cite(c.refs)}</article>`).join('') || C(esc(en ? 'No claim has this label.' : '没有这一类的主张。'), 'p', 'muted');
  }
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('.fs-chip');
    if (!b) return;
    for (const c of filter.children) c.setAttribute('aria-pressed', c === b);
    renderLedger(b.dataset.kind);
  });
  renderLedger('');

  // ── 开放问题与学习路线 ──────────────────────────────────────────────────
  $('#qb-open').innerHTML = D.openQuestions.map(([status, area, q]) => `<li>${C(esc(tx(q)), 'p')}<div class="fs-open-meta">${st(status)}${secLink(area)}</div></li>`).join('');
  const site = (path) => `../../${path}`;
  $('#qb-road').innerHTML = D.path.map((p) => `<li><div class="fs-phase"><span>Step ${p.step}</span></div>${C(esc(tx(p.title)), 'h3')}${C(esc(tx(p.text)), 'p')}
    <ul class="qb-links">${p.links.map(([href, label]) => `<li><a href="${esc(site(href))}" translate="no" lang="${lang}">${esc(tx(label))} <i class="ico-ext ico-right" aria-hidden="true"></i></a></li>`).join('')}</ul></li>`).join('');

  // ── 文献库 ──────────────────────────────────────────────────────────────
  const citedBy = {};
  for (const s of D.sections) for (const id of new Set([...s.refs, ...s.topics.flatMap((t) => t[3] || [])])) (citedBy[id] ||= []).push(s);
  $('#qb-lib-intro').innerHTML = C(esc(en
    ? `${D.refs.length} references. Title, authors, year, journal and volume of each were checked against Crossref on ${D.checked}. Filter by area or by strength of evidence; each entry links to the publisher through its DOI.`
    : `共 ${D.refs.length} 篇。每一篇的题目、作者、年份、期刊和卷号都在 ${D.checked} 于 Crossref 核对过。可以按研究领域和证据强度筛选；每条都通过 DOI 链接到出版方。`));
  const areaSel = $('#qb-lib-area'), statusSel = $('#qb-lib-status'), sortSel = $('#qb-lib-sort');
  areaSel.insertAdjacentHTML('beforeend', Object.entries(D.areas).map(([k, v]) => `<option value="${k}">${esc(tx(v))}</option>`).join(''));
  statusSel.insertAdjacentHTML('beforeend', kinds.map((k) => `<option value="${k}">${esc(tx(D.status[k]))}</option>`).join(''));
  for (const o of [...areaSel.options, ...statusSel.options].filter((o) => o.value)) { o.setAttribute('translate', 'no'); o.lang = lang; }
  function renderRefs() {
    const a = areaSel.value, s = statusSel.value, desc = sortSel.value === 'year-desc';
    const list = D.refs.filter((r) => (!a || r.area === a) && (!s || r.status === s)).sort((x, y) => (desc ? y.year - x.year : x.year - y.year) || x.id.localeCompare(y.id));
    $('#qb-lib-count').textContent = en ? `${list.length} of ${D.refs.length}` : `显示 ${list.length} / ${D.refs.length} 篇`;
    $('#qb-refs').innerHTML = list.map((r) => `<li class="fs-ref" id="ref-${r.id}">
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

  function openFromHash() {
    const h = location.hash.slice(1);
    if (h.startsWith('s-')) { if (selectTab(h.slice(2))) setTimeout(() => $('#qb-sections').scrollIntoView({ block: 'start' }), 60); }
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
  const fmt = (v, d = 3) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`) : Number(v.toPrecision(d)).toString());
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  function plot(cv, o) {
    const { ctx, w, h } = fit(cv), c = css();
    const pad = { l: 50, r: 12, t: 26, b: 34 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
    const X = (v) => pad.l + ((v - o.x0) / (o.x1 - o.x0)) * W, Y = (v) => pad.t + H - ((v - o.y0) / (o.y1 - o.y0)) * H;
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
    for (const t of o.xt) { ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), pad.t + H); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(o.xf(t), X(t), pad.t + H + 15); }
    for (const t of o.yt) { ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(pad.l + W, Y(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(o.yf(t), pad.l - 6, Y(t) + 4); }
    ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + H); ctx.lineTo(pad.l + W, pad.t + H); ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = 'center'; ctx.fillText(o.xl, pad.l + W / 2, h - 4);
    ctx.save(); ctx.translate(11, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yl, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip();
    for (const s of o.series) {
      ctx.beginPath();
      s.xs.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(s.ys[i])) : ctx.moveTo(X(x), Y(s.ys[i]))));
      ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.stroke(); ctx.setLineDash([]);
    }
    for (const m of o.marks || []) {
      ctx.strokeStyle = m.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(m.x), pad.t); ctx.lineTo(X(m.x), pad.t + H); ctx.stroke(); ctx.setLineDash([]);
      if (m.y !== undefined) { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 4.5, 0, 2 * Math.PI); ctx.fill(); }
    }
    ctx.restore();
    // 图例（放在坐标区上方，放不下就换行到第二列之后不再画）
    let lx = pad.l, ly = 14;
    ctx.font = font(11);
    for (const s of o.series.filter((s) => s.label)) {
      const wd = 26 + ctx.measureText(s.label).width;
      if (lx + wd > w - 4) { lx = pad.l; ly += 0; break; }
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx, ly - 4); ctx.lineTo(lx + 16, ly - 4); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(s.label, lx + 20, ly);
      lx += wd + 8;
    }
  }
  const ticks = (a, b, n = 5) => { const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(10))); return out; };
  const readout = (el, rows) => { el.innerHTML = rows.map(([k, v, big]) => `<dt>${C(rich(en ? k[1] : k[0]))}</dt><dd${big ? ' class="fs-big"' : ''} translate="no">${v}</dd>`).join(''); };
  const val = (id) => Number($(`#${id}`).value);
  const bind = (ids, fn) => { for (const id of ids) $(`#${id}`).addEventListener('input', fn); };
  const lazy = (fn) => { let q = 0; return () => { cancelAnimationFrame(q); q = requestAnimationFrame(fn); }; };

  // ── 演示 1：FMO 中的能量传递 ────────────────────────────────────────────
  const H = M.fmoH(), GMIN = -2, GMAX = 4;
  const curveCache = new Map();
  const eOpts = () => ({ gamma: val('e-gamma') <= GMIN ? 0 : 10 ** val('e-gamma'), kappa: 10 ** val('e-kappa'), loss: 10 ** val('e-loss'), trap: 2, start: Number($('#e-start').value) });
  function eCurve(o) {
    const key = `${o.kappa}|${o.loss}|${o.start}`;
    if (!curveCache.has(key)) {
      const lg = Array.from({ length: 49 }, (_, i) => GMIN + ((GMAX - GMIN) * i) / 48);
      curveCache.set(key, { lg, eff: lg.map((l) => M.transfer(H, { ...o, gamma: 10 ** l }).efficiency), zero: M.transfer(H, { ...o, gamma: 0 }).efficiency });
    }
    return curveCache.get(key);
  }
  const rate = (v) => `${fmt(v)} ps⁻¹`;
  function enaqtDraw() {
    const o = eOpts(), c = css(), cur = eCurve(o), r = M.transfer(H, o);
    $('#e-gamma-v').textContent = o.gamma ? rate(o.gamma) : (en ? '0 (coherent)' : '0（完全相干）');
    $('#e-kappa-v').textContent = rate(o.kappa);
    $('#e-loss-v').textContent = rate(o.loss);
    const best = cur.lg[cur.eff.indexOf(Math.max(...cur.eff))];
    const lo = Math.min(cur.zero, ...cur.eff), y0 = Math.max(0, Math.floor((lo - 0.02) * 20) / 20);
    plot($('#e-curve'), { x0: GMIN, x1: GMAX, y0, y1: 1, xt: [-2, -1, 0, 1, 2, 3, 4], yt: ticks(y0, 1, 5), xf: (t) => `10${sup(t)}`, yf: (t) => t.toFixed(2),
      xl: en ? 'pure dephasing rate γ (ps⁻¹)' : '纯退相干率 γ（ps⁻¹）', yl: en ? 'efficiency η' : '传递效率 η',
      series: [
        { xs: cur.lg, ys: cur.eff, color: c.accent, width: 2.4, label: en ? 'η(γ)' : '传递效率 η(γ)' },
        { xs: [GMIN, GMAX], ys: [cur.zero, cur.zero], color: c.muted, dash: [5, 4], width: 1.4, label: en ? 'fully coherent (γ = 0)' : '完全相干（γ = 0）' },
      ],
      marks: [{ x: o.gamma ? Math.log10(o.gamma) : GMIN, y: r.efficiency, color: c.gold }] });
    // 布居
    const ev = M.evolve(H, o, 2, 200), ts = ev.map((p) => p.t);
    const colors = [c.accent, c.gold, c.warn, c.info, c.violet, c.ok, c.ink2];
    plot($('#e-pop'), { x0: 0, x1: 2, y0: 0, y1: 1, xt: [0, 0.5, 1, 1.5, 2], yt: [0, 0.25, 0.5, 0.75, 1], xf: (t) => t, yf: (t) => t.toFixed(2),
      xl: en ? 'time (ps)' : '时间（ps）', yl: en ? 'population' : '布居',
      series: [...H.map((_, a) => ({ xs: ts, ys: ev.map((p) => p.pop[a]), color: colors[a], width: a === 2 || a === o.start ? 2.2 : 1.3, label: `${a + 1}` })),
        { xs: ts, ys: ev.map((p) => p.trapped), color: c.ink, dash: [6, 4], width: 2, label: en ? 'trapped' : '已捕获' }] });
    readout($('#e-read'), [
      [['传递效率 η', 'Transfer efficiency η'], `${(100 * r.efficiency).toFixed(2)} %`, true],
      [['损失的比例', 'Fraction lost'], `${(100 * r.lost).toFixed(2)} %`],
      [['平均传递时间', 'Mean transfer time'], `${fmt(r.meanTime)} ps`],
      [['完全相干时的效率', 'Efficiency when fully coherent'], `${(100 * cur.zero).toFixed(2)} %`],
      [['效率最高的 γ（曲线上）', 'Best γ on the curve'], `≈ ${rate(10 ** best)} ≈ ${fmt(10 ** best / M.CM_TO_RADPS)} cm⁻¹`],
    ]);
    const g = o.gamma, regime = !g ? 'coh' : Math.log10(g) < best - 1 ? 'low' : Math.log10(g) > best + 1 ? 'high' : 'mid';
    $('#e-cap').innerHTML = {
      coh: L('γ = 0：纯量子演化。激发在色素之间来回振荡，一部分被相消干涉“困住”，到达位点 3 的速度变慢，损失增加。', 'γ = 0: purely quantum evolution. The excitation oscillates between pigments, part of it is "trapped" by destructive interference, it reaches site 3 more slowly and more is lost.'),
      low: L('退相干较弱：比完全相干时好，但激发仍在一些位点上停留较久。', 'Weak dephasing: better than fully coherent, but the excitation still lingers on some sites.'),
      mid: L('退相干率与能量差和耦合（几十到几百 cm⁻¹）相当：干涉造成的“陷阱”被打破，激发最快到达反应中心，这就是环境辅助的量子传输。', 'Dephasing comparable to the energy gaps and couplings (tens to hundreds of cm⁻¹): the interference "traps" are broken and the excitation reaches the reaction centre fastest; this is environment-assisted quantum transport.'),
      high: L('退相干过强：每一步跳跃都被频繁打断，传递变慢（量子 Zeno 效应），效率重新下降。', 'Excessive dephasing: every hop is interrupted too often, transfer slows down (the quantum Zeno effect) and efficiency falls again.'),
    }[regime];
    $('#e-curve').setAttribute('aria-label', en ? `Efficiency versus dephasing; current efficiency ${(100 * r.efficiency).toFixed(1)} %` : `传递效率随退相干率变化；当前效率 ${(100 * r.efficiency).toFixed(1)}%`);
    return best;
  }
  const enaqt = lazy(enaqtDraw);
  bind(['e-gamma', 'e-kappa', 'e-loss'], enaqt);
  $('#e-start').addEventListener('change', enaqt);
  $('#e-coherent').addEventListener('click', () => { $('#e-gamma').value = GMIN; enaqtDraw(); });
  $('#e-best').addEventListener('click', () => { const o = eOpts(), cur = eCurve(o); $('#e-gamma').value = cur.lg[cur.eff.indexOf(Math.max(...cur.eff))]; enaqtDraw(); });

  // ── 演示 2：自由基对罗盘 ────────────────────────────────────────────────
  const rOpts = () => { const ax = val('r-ax'); return { B: val('r-b'), theta: (val('r-theta') * Math.PI) / 180, ax, ay: ax, az: val('r-az'), k: 1 / 10 ** val('r-life') }; };
  function compassDraw() {
    const p = rOpts(), c = css(), life = 1 / p.k;
    $('#r-b-v').textContent = `${p.B} μT`; $('#r-theta-v').textContent = `${val('r-theta')}°`;
    $('#r-az-v').textContent = `${p.az.toFixed(2)} mT`; $('#r-ax-v').textContent = `${p.ax.toFixed(2)} mT`;
    $('#r-life-v').textContent = `${fmt(life)} μs`;
    const curve = M.yieldCurve(p, 91), ys = curve.map((q) => q[1]), deg = curve.map((q) => (q[0] * 180) / Math.PI);
    const now = M.singletYield(p), mx = Math.max(...ys), mn = Math.min(...ys), mean = ys.reduce((a, b) => a + b) / ys.length;
    const span = Math.max(0.02, mx - mn), y0 = Math.max(0, mn - span * 0.4), y1 = Math.min(1, mx + span * 0.4);
    plot($('#r-curve'), { x0: 0, x1: 180, y0, y1, xt: [0, 30, 60, 90, 120, 150, 180], yt: ticks(y0, y1, 4), xf: (t) => `${t}°`, yf: (t) => t.toFixed(3),
      xl: en ? 'angle θ between field and molecular axis' : '磁场与分子轴的夹角 θ', yl: en ? 'singlet yield Φ' : '单重态产率 Φ',
      series: [{ xs: deg, ys, color: c.accent, width: 2.4, label: en ? 'singlet yield Φ(θ)' : '单重态产率 Φ(θ)' }], marks: [{ x: val('r-theta'), y: now, color: c.gold }] });
    drawPolar(curve, mean, mx - mn, p.theta, c);
    const larmorUs = p.B > 0 ? (2 * Math.PI) / (M.GAMMA_E * p.B * 1e-3) : Infinity;
    readout($('#r-read'), [
      [['当前方向的单重态产率', 'Singlet yield at this angle'], now.toFixed(4), true],
      [['各方向的最大值 / 最小值', 'Maximum / minimum over angles'], `${mx.toFixed(4)} / ${mn.toFixed(4)}`],
      [['各向异性 ΔΦ_S = 最大 − 最小', 'Anisotropy ΔΦ_S = max − min'], `${fmt(mx - mn)}`],
      [['电子 Larmor 周期 2π/(γ_e B)', 'Electron Larmor period 2π/(γ_e B)'], Number.isFinite(larmorUs) ? `${fmt(larmorUs)} μs` : '∞'],
      [['寿命 / Larmor 周期', 'Lifetime / Larmor period'], Number.isFinite(larmorUs) ? fmt(life / larmorUs) : '0'],
    ]);
    const iso = Math.abs(p.ax - p.az) < 1e-9;
    $('#r-cap').innerHTML = iso
      ? L('超精细耦合各向同性时，产率与磁场方向无关：罗盘需要各向异性的耦合才能“指方向”。', 'With an isotropic hyperfine coupling the yield does not depend on field direction: a compass needs an anisotropic coupling to "point".')
      : larmorUs > 3 * life
        ? L('自由基对在一个 Larmor 周期内就已反应，磁场来不及改变自旋演化，方向效应很弱。把寿命调长或把磁场调强试试。', 'The pair reacts within a Larmor period, so the field has no time to change the spin evolution and the directional effect is weak. Try a longer lifetime or a stronger field.')
        : L('曲线关于 90° 对称：把 B 换成 −B 不改变产率，所以这种罗盘只能感知倾角，不分南北，与知更鸟的倾角罗盘一致。', 'The curve is symmetric about 90°: replacing B by −B leaves the yield unchanged, so this compass senses inclination only, not north versus south, as the robin\'s inclination compass does.');
    $('#r-curve').setAttribute('aria-label', en ? `Singlet yield versus angle; anisotropy ${fmt(mx - mn)}` : `单重态产率随方向变化；各向异性 ${fmt(mx - mn)}`);
  }
  function drawPolar(curve, mean, span, theta, c) {
    const cv = $('#r-polar'), { ctx, w, h } = fit(cv), cx = w / 2, cy = h / 2, R = Math.min(w, h) / 2 - 18;
    ctx.strokeStyle = c.line; ctx.lineWidth = 1;
    for (const f of [0.25, 0.5, 0.75, 1]) { ctx.beginPath(); ctx.arc(cx, cy, R * f, 0, 2 * Math.PI); ctx.stroke(); }
    ctx.beginPath(); ctx.moveTo(cx - R, cy); ctx.lineTo(cx + R, cy); ctx.moveTo(cx, cy - R); ctx.lineTo(cx, cy + R); ctx.stroke();
    // 半径：0.55R 对应平均值，±0.4R 对应 ±(最大 − 最小)/2；方向角从“分子轴”（向上）量起
    const rad = (y) => R * (0.55 + (span > 1e-9 ? (0.8 * (y - mean)) / span : 0));
    const pts = [...curve, ...curve.slice(1).map(([t, y]) => [2 * Math.PI - t, y]).reverse()];
    ctx.beginPath();
    pts.forEach(([t, y], i) => { const x = cx + rad(y) * Math.sin(t), yy = cy - rad(y) * Math.cos(t); i ? ctx.lineTo(x, yy) : ctx.moveTo(x, yy); });
    ctx.closePath(); ctx.globalAlpha = 0.16; ctx.fillStyle = c.accent; ctx.fill(); ctx.globalAlpha = 1; ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = c.gold; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(cx, cy); ctx.lineTo(cx + R * Math.sin(theta), cy - R * Math.cos(theta)); ctx.stroke();
    ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'center';
    ctx.fillText(en ? 'molecular axis' : '分子轴', cx, 12);
    ctx.fillStyle = c.gold; ctx.fillText('B', cx + (R + 9) * Math.sin(theta), cy - (R + 9) * Math.cos(theta) + 4);
  }
  const compass = lazy(compassDraw);
  bind(['r-b', 'r-theta', 'r-az', 'r-ax', 'r-life'], compass);
  $('#r-earth').addEventListener('click', () => { for (const [id, v] of [['r-b', 50], ['r-theta', 30], ['r-az', 1], ['r-ax', 0], ['r-life', 0]]) $(`#${id}`).value = v; compassDraw(); });
  $('#r-iso').addEventListener('click', () => { $('#r-ax').value = $('#r-az').value; compassDraw(); });

  // ── 演示 3：氢隧穿与同位素效应 ──────────────────────────────────────────
  const kOpts = () => ({ V0: val('k-v0'), nuBarrier: val('k-nu'), nuCH: val('k-ch'), T: val('k-t') });
  function kieDraw() {
    const p = kOpts(), c = css();
    $('#k-v0-v').textContent = `${p.V0} kJ/mol`; $('#k-nu-v').textContent = `${p.nuBarrier}i cm⁻¹`; $('#k-ch-v').textContent = `${p.nuCH} cm⁻¹`; $('#k-t-v').textContent = `${p.T} K`;
    const Ts = Array.from({ length: 26 }, (_, i) => 250 + 4 * i), inv = Ts.map((T) => 1000 / T);
    const q = Ts.map((T) => M.isotope({ ...p, T })), s = Ts.map((T) => M.isotope({ ...p, T, tunnel: false }));
    const lnH = q.map((r) => Math.log(r.H.k)), lnD = q.map((r) => Math.log(r.D.k)), lnHs = s.map((r) => Math.log(r.H.k)), lnDs = s.map((r) => Math.log(r.D.k));
    const all = [...lnH, ...lnD, ...lnHs, ...lnDs], y0 = Math.floor(Math.min(...all)), y1 = Math.ceil(Math.max(...all));
    plot($('#k-arr'), { x0: inv[inv.length - 1], x1: inv[0], y0, y1, xt: ticks(inv[inv.length - 1], inv[0], 5), yt: ticks(y0, y1, 5), xf: (t) => t.toFixed(1), yf: (t) => t,
      xl: en ? '1000 / T (K⁻¹)' : '1000 / T（K⁻¹）', yl: 'ln k',
      series: [
        { xs: inv, ys: lnH, color: c.accent, width: 2.4, label: 'H' }, { xs: inv, ys: lnD, color: c.gold, width: 2.4, label: 'D' },
        { xs: inv, ys: lnHs, color: c.accent, dash: [5, 4], width: 1.4, label: en ? 'H, no tunnelling' : 'H（无隧穿）' }, { xs: inv, ys: lnDs, color: c.gold, dash: [5, 4], width: 1.4, label: en ? 'D, no tunnelling' : 'D（无隧穿）' },
      ], marks: [{ x: 1000 / p.T, color: c.ink2 }] });
    const kie = q.map((r) => r.kie), kies = s.map((r) => r.kie), ky1 = Math.max(...kie, ...kies) * 1.1;
    plot($('#k-kie'), { x0: 250, x1: 350, y0: 0, y1: ky1, xt: [250, 275, 300, 325, 350], yt: ticks(0, ky1, 4), xf: (t) => t, yf: (t) => fmt(t, 2), xl: en ? 'temperature (K)' : '温度（K）', yl: 'kH / kD',
      series: [{ xs: Ts, ys: kie, color: c.accent, width: 2.4, label: en ? 'with tunnelling' : '含隧穿' }, { xs: Ts, ys: kies, color: c.muted, dash: [5, 4], width: 1.6, label: en ? 'zero-point energy only' : '只有零点能差' }],
      marks: [{ x: p.T, y: M.isotope(p).kie, color: c.gold }] });
    const now = M.isotope(p), semi = M.isotope({ ...p, tunnel: false }).kie, arr = M.arrhenius(p);
    readout($('#k-read'), [
      [['同位素效应 k_H/k_D（含隧穿）', 'Isotope effect k_H/k_D (with tunnelling)'], fmt(now.kie), true],
      [['半经典值（只有零点能差）', 'Semiclassical value (zero-point energy only)'], fmt(semi)],
      [['隧穿修正 Q_H / Q_D', 'Tunnelling correction Q_H / Q_D'], `${fmt(now.H.Q)} / ${fmt(now.D.Q)}`],
      [['指前因子之比 A_H/A_D（278–318 K）', 'Prefactor ratio A_H/A_D (278–318 K)'], fmt(arr.ratioA)],
      [['活化能差 E_a(D) − E_a(H)', 'Activation-energy difference E_a(D) − E_a(H)'], `${fmt(arr.dEa)} kJ/mol`],
    ]);
    const u = (p.nuBarrier * M.CM_TO_KJ) / (M.R * p.T);
    $('#k-cap').innerHTML = arr.ratioA < 0.7
      ? L(`A_H/A_D = ${fmt(arr.ratioA)}，小于半经典下限 0.7，同位素效应 ${fmt(now.kie)} ${now.kie > semi * 1.2 ? '也明显超过零点能给出的' : '接近零点能给出的'} ${fmt(semi)}：这是实验中用来判断氢隧穿的典型特征。u = hν‡/(k_B T) = ${u.toFixed(2)}${u > 2 * Math.PI ? '，已超过 2π，速率主要来自势垒下方深处的隧穿' : ''}。`,
        `A_H/A_D = ${fmt(arr.ratioA)}, below the semiclassical lower bound of 0.7, and the isotope effect of ${fmt(now.kie)} is ${now.kie > semi * 1.2 ? 'well above' : 'close to'} the zero-point value of ${fmt(semi)}: this is the typical signature experiments use to detect hydrogen tunnelling. u = hν‡/(k_B T) = ${u.toFixed(2)}${u > 2 * Math.PI ? ', beyond 2π, so the rate comes mainly from tunnelling deep below the barrier top' : ''}.`)
      : L(`A_H/A_D = ${fmt(arr.ratioA)}，在半经典范围 0.7–1.2 之内，同位素效应接近零点能给出的 ${fmt(semi)}：势垒宽时隧穿很弱，Arrhenius 图上的实线和虚线几乎重合。`,
        `A_H/A_D = ${fmt(arr.ratioA)}, inside the semiclassical range 0.7–1.2, and the isotope effect is close to the zero-point value of ${fmt(semi)}: with a wide barrier tunnelling is weak and the solid and dashed Arrhenius lines nearly coincide.`);
    $('#k-arr').setAttribute('aria-label', en ? `Arrhenius plot; isotope effect ${fmt(now.kie)} at ${p.T} K` : `Arrhenius 图；${p.T} K 时同位素效应 ${fmt(now.kie)}`);
  }
  const kieLazy = lazy(kieDraw);
  bind(['k-v0', 'k-nu', 'k-ch', 'k-t'], kieLazy);
  $('#k-classical').addEventListener('click', () => { $('#k-nu').value = 300; kieDraw(); });
  $('#k-deep').addEventListener('click', () => { $('#k-nu').value = 1700; kieDraw(); });

  // ── 启动、重绘 ──────────────────────────────────────────────────────────
  const redraw = () => { enaqtDraw(); compassDraw(); kieDraw(); };
  redraw();
  const later = lazy(redraw);
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(later); for (const id of ['e-curve', 'r-curve', 'k-arr']) ro.observe($(`#${id}`)); }
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', later);
})();
