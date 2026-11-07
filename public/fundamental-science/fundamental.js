'use strict';
// 进一步基础科学发现：把 fs-data.js 的内容画成页面（支柱、详解标签页、主线、理论比较、开放问题、路线图、文献库），
// 并驱动交互式理论实验室的三个演示（数学在 fs-models.js，这里只负责控件和画图）。
// 内容是中英两版，按站点语言取用，标 translate="no"；界面上固定的文字写中文，由 i18n.js 翻译。
// 地址：#s-<支柱> 打开对应的详解，#ref-<id> 跳到文献。
(() => {
  const D = window.MOLASTRIA_FS, MATH = window.MOLASTRIA_FS_MATH || {}, M = window.MOLASTRIA_FS_MODELS;
  if (!D || !M) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  // 正文里的 x^{…}、r_C 之类写成上下标
  const rich = (s) => esc(s).replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/([A-Za-zΓγλΔσρΩ])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/g, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(esc(en ? e : zh));
  const st = (s) => `<span class="fs-st" data-s="${s}" translate="no" lang="${lang}">${esc(tx(D.status[s]))}</span>`;
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  const refById = Object.fromEntries(D.refs.map((r) => [r.id, r]));
  const shortRef = (r) => `${r.authors.split(',')[0].replace(/ et al\..*/, '').trim().split(' ').pop()}${r.authors.includes(',') || /et al/.test(r.authors) ? (r.authors.split(',').length === 2 ? ` & ${r.authors.split(',')[1].trim().split(' ').pop()}` : ' et al.') : ''} ${r.year}`;
  const cite = (ids) => (ids?.length ? `<p class="fs-cite">${ids.map((id) => `<a href="#ref-${id}" data-ref="${id}" translate="no">${esc(shortRef(refById[id]))}</a>`).join(' · ')}</p>` : '');

  // ── 首屏与理念 ──────────────────────────────────────────────────────────
  $('#fs-question').innerHTML = C(esc(tx(D.hero.question)), 'span') + (en ? '' : `<span class="fs-q-en" lang="en" translate="no">${esc(D.hero.question.en)}</span>`);
  $('#fs-lead').innerHTML = C(esc(tx(D.hero.lead)));
  $('#fs-honest').innerHTML = C(esc(tx(D.hero.honesty)));
  $('#fs-legend').innerHTML = Object.keys(D.status).map((s) => `<li>${st(s)}${C(esc(tx(D.statusLong[s])))}</li>`).join('');
  $('#fs-intro-text').innerHTML = D.intro.map((p) => C(esc(tx(p)), 'p')).join('');
  for (const el of document.querySelectorAll('[data-demo-intro]')) { el.innerHTML = rich(tx(D.demos[el.dataset.demoIntro].intro)); el.setAttribute('translate', 'no'); el.lang = lang; }
  for (const el of document.querySelectorAll('[data-demo-notes]')) { el.innerHTML = rich(tx(D.demos[el.dataset.demoNotes].notes)); el.setAttribute('translate', 'no'); el.lang = lang; }
  for (const el of document.querySelectorAll('.fs-demo .fs-formula[data-math]')) { if (MATH[el.dataset.math]) { el.innerHTML = MATH[el.dataset.math]; el.tabIndex = 0; } else el.textContent = D.math[el.dataset.math]?.[0] || ''; }

  // ── 五大支柱与详解 ──────────────────────────────────────────────────────
  $('#fs-pillar-grid').innerHTML = D.pillars.map((p) => `<a class="fs-pillar" href="#s-${p.id}" data-tab="${p.id}">
    <span class="fs-num">${p.num}</span>${C(esc(tx(p.title)), 'h3')}${C(esc(tx(p.summary)), 'p')}<span class="fs-more">阅读详解 →</span></a>`).join('');

  const tabs = $('#fs-tabs'), panels = $('#fs-panels');
  tabs.innerHTML = D.sections.map((s, i) => `<button class="fs-tab" type="button" role="tab" id="tab-${s.id}" aria-controls="s-${s.id}" aria-selected="${i === 0}" tabindex="${i === 0 ? 0 : -1}"><b>${s.num}</b>${C(esc(tx(s.title)))}</button>`).join('');
  panels.innerHTML = D.sections.map((s, i) => `<div class="fs-panel" role="tabpanel" id="s-${s.id}" aria-labelledby="tab-${s.id}" tabindex="-1"${i ? ' hidden' : ''}>
    ${C(`${s.num} · ${esc(tx(s.title))}`, 'h3')}
    ${C(esc(tx(s.intro)), 'p', 'fs-intro')}
    <h4 class="fs-sub-h">核心公式</h4>
    <div class="fs-formulas">${s.formulas.map(([k, cap]) => `<figure>${formula(k)}${C(rich(tx(cap)), 'figcaption')}</figure>`).join('')}</div>
    ${s.calculator ? calculatorHTML() : ''}
    <h4 class="fs-sub-h">关键概念</h4>
    <ul class="fs-topics">${s.topics.map(([status, name, text, refs]) => `<li class="fs-topic"><h4>${C(esc(tx(name)))}${st(status)}</h4>${C(rich(tx(text)), 'p')}${cite(refs)}</li>`).join('')}</ul>
    ${s.callouts ? s.callouts.map((c) => C(esc(tx(c)), 'p', 'fs-callout')).join('') : ''}
    ${s.questions?.length ? `<h4 class="fs-sub-h">重点问题</h4><div class="fs-qa">${s.questions.map(([q, a], j) => `<details${j === 0 ? ' open' : ''}><summary>${C(esc(tx(q)))}</summary>${C(rich(tx(a)), 'p')}</details>`).join('')}</div>` : ''}
    <h4 class="fs-sub-h">本节参考文献</h4>${cite(s.refs)}
  </div>`).join('');

  function selectTab(id, { focus = false, scroll = false } = {}) {
    const btn = $(`#tab-${id}`);
    if (!btn) return false;
    for (const b of tabs.querySelectorAll('.fs-tab')) { const on = b === btn; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; }
    for (const p of panels.children) p.hidden = p.id !== `s-${id}`;
    if (focus) btn.focus();
    if (scroll) $('#fs-sections').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
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

  // ── 三条主线 ────────────────────────────────────────────────────────────
  $('#fs-dir-grid').innerHTML = D.directions.map((d) => `<article class="fs-dir" id="${d.id}">
    <div class="fs-dir-top"><span class="fs-num">${d.num}</span>${st('proposed')}</div>
    ${C(esc(tx(d.title)), 'h3')}${en ? '' : `<p class="fs-en" lang="en" translate="no">${esc(d.title.en)}</p>`}
    ${C(esc(tx(d.tagline)), 'p', 'fs-tag')}
    <dl>${Object.keys(D.fieldNames).map((k) => `<div><dt>${C(esc(tx(D.fieldNames[k])))}</dt>${C(rich(tx(d.fields[k])), 'dd', k === 'status' ? 'fs-status-text' : '')}</div>`).join('')}</dl>
    <p class="fs-cite"><a href="#s-${d.pillar}" data-tab="${d.pillar}">相关的理论详解 →</a></p>
  </article>`).join('');

  // ── 理论比较 ────────────────────────────────────────────────────────────
  $('#fs-explorer-note').innerHTML = C(esc(tx(D.explorerNote)));
  const kinds = Object.keys(D.kinds);
  const filter = $('#fs-kind-filter');
  filter.innerHTML = `<button type="button" class="fs-chip" data-kind="" aria-pressed="true">全部</button>` + kinds.map((k) => `<button type="button" class="fs-chip" data-kind="${k}" aria-pressed="false">${C(esc(tx(D.kinds[k][0])))}</button>`).join('');
  filter.insertAdjacentHTML('afterend', `<p class="fs-kind-legend" id="fs-kind-legend" aria-live="polite"></p>`);
  function renderTheories(kind) {
    $('#fs-kind-legend').innerHTML = kind ? C(`<b>${esc(tx(D.kinds[kind][0]))}</b>：${esc(tx(D.kinds[kind][1]))}`) : C(kinds.map((k) => `<b>${esc(tx(D.kinds[k][0]))}</b>：${esc(tx(D.kinds[k][1]))}`).join(en ? ' ' : ''));
    $('#fs-theory-grid').innerHTML = D.theories.filter((t) => !kind || t.kind === kind).map((t) => `<article class="fs-theory" id="th-${t.id}">
      <div class="fs-theory-meta"><span class="fs-kind" data-k="${t.kind}" translate="no" lang="${lang}">${esc(tx(D.kinds[t.kind][0]))}</span>${st(t.status)}</div>
      ${C(esc(tx(t.name)), 'h3')}
      <dl><div><dt>核心思想</dt>${C(rich(tx(t.idea)), 'dd')}</div><div><dt>与标准量子力学的关系</dt>${C(rich(tx(t.relation)), 'dd')}</div><div><dt>在化学中的作用</dt>${C(rich(tx(t.chem)), 'dd')}</div></dl>
      ${cite(t.refs)}</article>`).join('');
  }
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('.fs-chip');
    if (!b) return;
    for (const c of filter.children) c.setAttribute('aria-pressed', c === b);
    renderTheories(b.dataset.kind);
  });
  renderTheories('');

  // ── 开放问题与路线图 ────────────────────────────────────────────────────
  const pillarOf = Object.fromEntries(D.sections.map((s) => [s.id, s]));
  $('#fs-open').innerHTML = D.openQuestions.map(([status, area, q]) => `<li>${C(esc(tx(q)), 'p')}<div class="fs-open-meta">${st(status)}<a href="#s-${area}" data-tab="${area}" translate="no" lang="${lang}">${pillarOf[area].num} · ${esc(tx(pillarOf[area].title))}</a></div></li>`).join('');
  $('#fs-road').innerHTML = D.roadmap.map((r) => `<li><div class="fs-phase"><span>Phase ${r.phase}</span>${st('proposed')}</div>${C(esc(tx(r.title)), 'h3')}${C(esc(tx(r.items)), 'p')}${C(esc(tx(r.practice)), 'p', 'fs-practice')}</li>`).join('');

  // ── 文献库 ──────────────────────────────────────────────────────────────
  const citedBy = {};
  for (const s of D.sections) for (const id of new Set([...s.refs, ...s.topics.flatMap((t) => t[3] || [])])) (citedBy[id] ||= []).push(s);
  $('#fs-lib-intro').innerHTML = C(esc(en
    ? `${D.refs.length} references. Title, authors, year, journal and DOI of each were checked against Crossref (and arXiv for the XENONnT paper) on ${D.checked}. Filter by research area or status; each entry links to the publisher through its DOI.`
    : `共 ${D.refs.length} 篇。每一篇的题目、作者、年份、期刊和 DOI 都在 ${D.checked} 于 Crossref 核对过（XENONnT 的论文另在 arXiv 核对）。可以按研究领域和状态筛选；每条都通过 DOI 链接到出版方。`));
  const areaSel = $('#fs-lib-area'), statusSel = $('#fs-lib-status'), sortSel = $('#fs-lib-sort');
  areaSel.insertAdjacentHTML('beforeend', Object.entries(D.areas).map(([k, v]) => `<option value="${k}">${esc(tx(v))}</option>`).join(''));
  statusSel.insertAdjacentHTML('beforeend', ['established', 'active', 'hypothesis'].map((k) => `<option value="${k}">${esc(tx(D.status[k]))}</option>`).join(''));
  for (const o of [...areaSel.options, ...statusSel.options].filter((o) => o.value)) { o.setAttribute('translate', 'no'); o.lang = lang; }
  function renderRefs() {
    const a = areaSel.value, s = statusSel.value, desc = sortSel.value === 'year-desc';
    const list = D.refs.filter((r) => (!a || r.area === a) && (!s || r.status === s)).sort((x, y) => (desc ? y.year - x.year : x.year - y.year) || x.id.localeCompare(y.id));
    $('#fs-lib-count').textContent = en ? `${list.length} of ${D.refs.length}` : `显示 ${list.length} / ${D.refs.length} 篇`;
    $('#fs-refs').innerHTML = list.map((r) => `<li class="fs-ref" id="ref-${r.id}">
      <span translate="no">${esc(r.authors)} (${r.year}). <span class="fs-ref-title">${esc(r.title)}</span>. <i>${esc(r.journal)}</i> ${esc(r.vol)}, ${esc(r.pages)}.</span>
      <div class="fs-ref-meta">${st(r.status)}<span translate="no" lang="${lang}">${esc(tx(D.areas[r.area]))}</span>
        <a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener noreferrer" translate="no">doi:${esc(r.doi)}</a>${r.arxiv ? `<a href="https://arxiv.org/abs/${esc(r.arxiv)}" target="_blank" rel="noopener noreferrer" translate="no">arXiv:${esc(r.arxiv)}</a>` : ''}
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

  // ── FCI 维数计算器（第 03 节） ──────────────────────────────────────────
  function calculatorHTML() {
    return `<div class="fs-calc" id="fs-calc"><h4>FCI 维数计算器</h4>
      <div class="fs-calc-row"><label>电子数 N<input type="number" id="calc-n" min="2" max="80" step="1" value="10"></label>
      <label>自旋轨道数 K（偶数）<input type="number" id="calc-k" min="2" max="400" step="2" value="40"></label></div>
      <div class="fs-calc-out" id="calc-out" aria-live="polite"></div></div>`;
  }
  const group = (big) => big.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  const sci = (big) => { const s = big.toString(); return s.length <= 6 ? s : `${s[0]}.${s.slice(1, 3)} × 10^${s.length - 1}`; };
  function bytes(big) { // CI 向量占用的内存（每个系数 8 字节）
    const b = Number(big) * 8, u = [['B', 1], ['KB', 1024], ['MB', 1024 ** 2], ['GB', 1024 ** 3], ['TB', 1024 ** 4], ['PB', 1024 ** 5]];
    if (!Number.isFinite(b) || b > 1024 ** 6) return en ? 'far beyond any computer' : '远超任何计算机';
    const [n, f] = u.filter(([, v]) => b >= v).pop() || u[0];
    return `${(b / f).toPrecision(3)} ${n}`;
  }
  function renderCalc() {
    const out = $('#calc-out');
    if (!out) return;
    const N = Math.round(Number($('#calc-n').value)), K = Math.round(Number($('#calc-k').value));
    if (!(N >= 1 && K >= 2 && K % 2 === 0 && N <= K && K <= 400 && N <= 80)) { out.innerHTML = L('请输入 1 ≤ N ≤ K、K 为偶数（K ≤ 400，N ≤ 80）。', 'Enter 1 ≤ N ≤ K with K even (K ≤ 400, N ≤ 80).'); return; }
    const f = M.fci(K, N);
    out.innerHTML = C(`${en ? 'All determinants' : '全部行列式'} D = C(${K}, ${N}) = <b>${group(f.all)}</b> ≈ ${rich(sci(f.all).replace('10^', '10^{') + (f.all.toString().length > 6 ? '}' : ''))}`, 'div')
      + C(`${en ? `Fixed S<sub>z</sub> (N<sub>α</sub> = ${f.na}, N<sub>β</sub> = ${f.nb}, ${K / 2} spatial orbitals)` : `固定 S<sub>z</sub>（N<sub>α</sub> = ${f.na}，N<sub>β</sub> = ${f.nb}，${K / 2} 个空间轨道）`}：<b>${group(f.sz)}</b>`, 'div')
      + C(`${en ? 'Memory for one CI vector (8 bytes per coefficient)' : '存一个 CI 向量所需内存（每个系数 8 字节）'}：<b>${bytes(f.sz)}</b>`, 'div');
  }
  $('#calc-n')?.addEventListener('input', renderCalc);
  $('#calc-k')?.addEventListener('input', renderCalc);
  renderCalc();

  // 打开地址里指定的详解或文献
  function openFromHash() {
    const h = location.hash.slice(1);
    if (h.startsWith('s-')) { if (selectTab(h.slice(2))) setTimeout(() => $('#fs-sections').scrollIntoView({ block: 'start' }), 60); }
    else if (h.startsWith('ref-') && $(`#${CSS.escape(h)}`)) setTimeout(() => $(`#${CSS.escape(h)}`).scrollIntoView({ block: 'center' }), 60);
  }
  window.addEventListener('hashchange', openFromHash);
  openFromHash();

  // ── 画图工具 ────────────────────────────────────────────────────────────
  const css = () => { const s = getComputedStyle(document.documentElement); const g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent-text'), accentFill: g('--accent'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), paper: g('--paper'), surface: g('--surface'), violet: g('--violet') }; };
  function fit(cv) {
    const ratio = cv.dataset.ratio ? Number(cv.dataset.ratio) : (cv.dataset.ratio = cv.height / cv.width, cv.height / cv.width);
    const w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth), h = Math.round(w * ratio), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  const fmt = (v, d = 3) => (Math.abs(v) >= 1e4 || (Math.abs(v) < 1e-2 && v !== 0) ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`) : Number(v.toPrecision(d)).toString());
  const sup = (s) => String(s).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  // 坐标轴 + 曲线
  function plot(cv, o) {
    const { ctx, w, h } = fit(cv), c = css();
    const pad = { l: 46, r: 12, t: 14, b: 34 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
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
      if (s.fill) { ctx.lineTo(X(s.xs[s.xs.length - 1]), Y(o.y0)); ctx.lineTo(X(s.xs[0]), Y(o.y0)); ctx.closePath(); ctx.globalAlpha = 0.18; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = 1; ctx.beginPath(); s.xs.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(s.ys[i])) : ctx.moveTo(X(x), Y(s.ys[i])))); }
      ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.stroke(); ctx.setLineDash([]);
    }
    for (const m of o.marks || []) { ctx.strokeStyle = m.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(m.x), pad.t); ctx.lineTo(X(m.x), pad.t + H); ctx.stroke(); ctx.setLineDash([]); }
    ctx.restore();
    // 图例
    let lx = pad.l + 8;
    ctx.font = font(11.5);
    for (const s of o.series.filter((s) => s.label)) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx, pad.t + 9); ctx.lineTo(lx + 18, pad.t + 9); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(s.label, lx + 22, pad.t + 13);
      lx += 30 + ctx.measureText(s.label).width;
    }
  }
  const ticks = (a, b, n = 5) => { const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(10))); return out; };
  const readout = (el, rows) => { el.innerHTML = rows.map(([k, v, big]) => `<dt>${C(rich(en ? k[1] : k[0]))}</dt><dd${big ? ' class="fs-big"' : ''} translate="no">${v}</dd>`).join(''); };
  const bind = (ids, fn) => { for (const id of ids) $(`#${id}`).addEventListener('input', fn); };

  // ── 演示 1：量子叠加与坍缩 ──────────────────────────────────────────────
  const g = { psi: null, x: null, x0: null, hits: 0 };
  function grwState() {
    const a = Number($('#g-sep').value) / 2, sigma = Number($('#g-sigma').value), rc = Number($('#g-rc').value);
    $('#g-sep-v').textContent = `${2 * a} nm`; $('#g-sigma-v').textContent = `${sigma} nm`; $('#g-rc-v').textContent = `${rc} nm`;
    return { a, sigma, rc };
  }
  function grwReset() {
    const { a, sigma, rc } = grwState();
    g.x = M.grid(Math.max(300, a + 5 * sigma + 2 * rc), 1201);
    g.super = M.doublePeak(g.x, a, sigma);
    g.psi = g.super; g.x0 = null;
    g.p = M.hitDensity(g.x, g.super, rc);
    grwDraw();
  }
  function grwDraw() {
    const { a, rc } = grwState(), c = css(), x = g.x;
    const dens = (psi) => psi.map((v) => v * v);
    const series = [];
    if (g.x0 !== null) series.push({ xs: x, ys: dens(g.super), color: c.muted, dash: [5, 4], width: 1.5, label: en ? 'before' : '局域化前 |ψ|²' });
    series.push({ xs: x, ys: dens(g.psi), color: c.accent, fill: true, label: g.x0 === null ? (en ? '|ψ|² superposition' : '叠加态 |ψ|²') : (en ? '|ψ|² after the hit' : '局域化后 |ψ|²') });
    series.push({ xs: x, ys: g.p, color: c.gold, width: 1.8, dash: [2, 3], label: en ? 'p(x₀)' : '局域化中心的分布 p(x₀)' });
    const ymax = Math.max(...series.flatMap((s) => s.ys)) * 1.12;
    plot($('#g-canvas'), { x0: x[0], x1: x[x.length - 1], y0: 0, y1: ymax, xt: ticks(x[0], x[x.length - 1], 6), yt: [], xf: (t) => t, yf: () => '', xl: en ? 'position x (nm)' : '位置 x（nm）', yl: en ? 'probability density' : '概率密度', series, marks: g.x0 === null ? [] : [{ x: g.x0, color: c.ink2 }] });
    const left = M.weightLeft(x, g.psi), pLeft = M.weightLeft(x, g.p.map((v) => Math.sqrt(Math.max(v, 0))));
    readout($('#g-read'), [
      [['左侧波包的概率', 'Probability in the left packet'], left.toFixed(3), true],
      [['局域化中心落在左侧的概率', 'Chance the centre lands on the left'], pLeft.toFixed(3)],
      [['最近一次的中心 x₀', 'Last centre x₀'], g.x0 === null ? '—' : `${g.x0.toFixed(0)} nm`],
      [['系综平均后两峰的相干因子', 'Ensemble coherence factor between the peaks'], `e<sup>−a²/r<sub>C</sub>²</sup> = ${fmt(M.coherenceAfterHit(a, rc))}`],
      [['单个核子的平均局域化间隔 1/λ（λ = 10⁻¹⁶ s⁻¹）', 'Mean time between hits, one nucleon (λ = 10⁻¹⁶ s⁻¹)'], en ? '≈ 3.2 × 10⁸ years' : '≈ 3.2 × 10⁸ 年'],
      [['含 10²³ 个核子的刚性物体（速率 Nλ）', 'Rigid body of 10²³ nucleons (rate Nλ)'], '≈ 10⁻⁷ s'],
    ]);
    $('#g-cap').innerHTML = g.x0 === null
      ? L('实线：叠加态的概率密度；点线：局域化中心 x₀ 的概率分布。点“随机发生一次局域化”按这个分布抽取 x₀。', 'Solid: probability density of the superposition; dotted: distribution of the localization centre x₀. "Trigger one localization" draws x₀ from it.')
      : L(`第 ${g.hits} 次抽样：x₀ = ${g.x0.toFixed(0)} nm。两峰间距 ${(2 * a).toFixed(0)} nm ${2 * a > 3 * rc ? '远大于' : '不远大于'} r_C = ${rc} nm，${2 * a > 3 * rc ? '所以另一个波包几乎完全消失' : '所以两个波包都还在，只是比例改变'}。`,
        `Draw ${g.hits}: x₀ = ${g.x0.toFixed(0)} nm. The separation of ${(2 * a).toFixed(0)} nm is ${2 * a > 3 * rc ? 'much larger than' : 'not much larger than'} r_C = ${rc} nm, ${2 * a > 3 * rc ? 'so the other packet almost vanishes' : 'so both packets survive with changed weights'}.`);
    $('#g-canvas').setAttribute('aria-label', en ? `Probability density; left-packet probability ${left.toFixed(2)}` : `概率密度曲线；左侧波包概率 ${left.toFixed(2)}`);
  }
  $('#g-hit').addEventListener('click', () => {
    const { rc } = grwState();
    g.x0 = M.sample(g.x, g.p, Math.random());
    g.psi = M.afterHit(g.x, g.super, g.x0, rc);
    g.hits++;
    grwDraw();
  });
  $('#g-reset').addEventListener('click', grwReset);
  bind(['g-sep', 'g-sigma', 'g-rc'], grwReset);

  // ── 演示 2：分子量子相干 ────────────────────────────────────────────────
  const NH3 = { 'c-delta': -0.1, 'c-env': 10.5, 'c-lambda': -16, 'c-mass': 1.23, 'c-d': -0.12 };
  function cohDraw() {
    const v = (id) => Number($(`#${id}`).value);
    const delta = 10 ** v('c-delta'), envOn = v('c-env') > 8.001, genv = envOn ? 10 ** v('c-env') : 0;
    const lam = 10 ** v('c-lambda'), mass = 10 ** v('c-mass'), dA = 10 ** v('c-d');
    const gcsl = M.cslRate(lam, mass, dA * 1e-10, 1e-7);
    $('#c-delta-v').textContent = `${fmt(delta)} cm⁻¹`;
    $('#c-env-v').textContent = envOn ? `${fmt(genv)} s⁻¹` : (en ? 'none' : '无（孤立）');
    $('#c-lambda-v').textContent = `${fmt(lam)} s⁻¹`;
    $('#c-mass-v').textContent = `${fmt(mass)} u`;
    $('#c-d-v').textContent = `${fmt(dA)} Å`;
    const w = M.omegaFromWavenumber(delta), period = (2 * Math.PI) / w, T = 4 * period;
    const unit = T < 2e-9 ? [1e12, 'ps'] : T < 2e-6 ? [1e9, 'ns'] : T < 2e-3 ? [1e6, 'µs'] : [1e3, 'ms'];
    const n = 600, ts = Array.from({ length: n + 1 }, (_, i) => (T * i) / n), xs = ts.map((t) => t * unit[0]);
    const c = css(), total = genv + gcsl;
    plot($('#c-canvas'), { x0: 0, x1: T * unit[0], y0: 0, y1: 1.05, xt: ticks(0, T * unit[0], 6), yt: [0, 0.25, 0.5, 0.75, 1], xf: (t) => t, yf: (t) => t.toFixed(2), xl: en ? `time (${unit[1]})` : `时间（${unit[1]}）`, yl: en ? 'P(left)' : '左侧构型的概率 P_L',
      series: [
        { xs, ys: ts.map((t) => M.pLeft(t, w, 0)), color: c.muted, dash: [6, 4], width: 1.6, label: en ? 'isolated (standard QM)' : '孤立分子（标准量子力学）' },
        { xs, ys: ts.map((t) => M.pLeft(t, w, total)), color: c.accent, width: 2.2, label: en ? 'environment + collapse' : '环境 + 坍缩项' },
        { xs, ys: ts.map((t) => M.pLeft(t, w, gcsl)), color: c.gold, dash: [2, 3], width: 2, label: en ? 'collapse term alone' : '只有坍缩项' },
      ] });
    const h = total / 2, over = h > w;
    const ratio = genv > 0 ? gcsl / genv : null;
    readout($('#c-read'), [
      [['振荡周期 2π/ω', 'Oscillation period 2π/ω'], `${fmt(period * unit[0])} ${unit[1]}`, true],
      [['环境退相干率 γ_env', 'Environmental rate γ_env'], `${genv ? fmt(genv) : 0} s⁻¹`],
      [['坍缩模型退相干率 Γ_CSL', 'Collapse-model rate Γ_CSL'], `${fmt(gcsl)} s⁻¹`],
      [['Γ_CSL / γ_env', 'Γ_CSL / γ_env'], ratio === null ? '—' : fmt(ratio)],
      [['动力学区域', 'Regime'], total === 0 ? (en ? 'undamped' : '无阻尼') : over ? (en ? 'overdamped: localized' : '过阻尼：停在初始构型') : (en ? 'underdamped: oscillates' : '欠阻尼：仍在振荡')],
      [[over ? '局域化态的弛豫时间' : '相干衰减时间 2/γ', over ? 'Relaxation time of the localized state' : 'Coherence decay time 2/γ'], total === 0 ? '∞' : `${fmt((over ? 1 / (h - Math.sqrt(h * h - w * w)) : 2 / total) * unit[0])} ${unit[1]}`],
    ]);
    const orders = ratio ? Math.round(-Math.log10(ratio)) : null;
    $('#c-cap').innerHTML = ratio !== null && ratio < 1e-3
      ? L(`坍缩项比环境退相干小约 ${orders} 个数量级，“只有坍缩项”的曲线与孤立分子几乎重合：在单个分子上，坍缩模型的效应被环境完全掩盖。`, `The collapse term is about ${orders} orders of magnitude below environmental decoherence, so "collapse term alone" sits on top of the isolated curve: for a single molecule, collapse effects are buried under the environment.`)
      : over ? L('退相干率超过 2ω，振荡消失，分子停留在初始构型：这就是环境“冻结”隧穿、稳定手性构型的机制。', 'The decoherence rate exceeds 2ω, the oscillation disappears and the molecule stays in its starting configuration: this is how an environment can "freeze" tunnelling and stabilise a chiral form.')
        : L('同一个方程里，环境退相干和坍缩项形式相同：只看衰减曲线，无法判断它来自哪一种。', 'In this equation environmental decoherence and the collapse term have the same form: the decay curve alone cannot tell which one caused it.');
    $('#c-canvas').setAttribute('aria-label', en ? `P(left) over ${fmt(T * unit[0])} ${unit[1]}; period ${fmt(period * unit[0])} ${unit[1]}` : `左侧构型的概率随时间变化，时间范围 ${fmt(T * unit[0])} ${unit[1]}，周期 ${fmt(period * unit[0])} ${unit[1]}`);
  }
  bind(['c-delta', 'c-env', 'c-lambda', 'c-mass', 'c-d'], cohDraw);
  $('#c-nh3').addEventListener('click', () => { for (const [id, val] of Object.entries(NH3)) $(`#${id}`).value = val; cohDraw(); });

  // ── 演示 3：圆锥交叉与 Berry 相位 ───────────────────────────────────────
  const view = { az: -0.75, el: 0.5 };
  function ciParams() {
    const v = (id) => Number($(`#${id}`).value);
    const p = { kappa: v('b-kappa'), lam: v('b-lam'), delta: v('b-delta'), k: 1 }, loop = { cx: v('b-cx'), cy: v('b-cy'), r: v('b-r') };
    for (const id of ['b-kappa', 'b-lam', 'b-delta', 'b-cx', 'b-cy', 'b-r']) $(`#${id}-v`).textContent = v(id).toFixed(2);
    return { p, loop };
  }
  function ciDraw() {
    const { p, loop } = ciParams(), c = css();
    const pts = M.loop(loop.cx, loop.cy, loop.r, 720);
    const gamma = M.berryPhase(pts, p);
    const encloses = p.delta === 0 && Math.hypot(loop.cx, loop.cy) < loop.r;
    const onCI = p.delta === 0 && Math.abs(Math.hypot(loop.cx, loop.cy) - loop.r) < 0.02;
    const gap = Math.min(...pts.map(([x, y]) => 2 * Math.hypot(...M.dVec(x, y, p))));
    drawSurfaces(p, pts, c);
    drawSphere(p, pts, c);
    drawTransport(p, pts, c);
    const centred = Math.abs(p.kappa - p.lam) < 1e-9 && Math.hypot(loop.cx, loop.cy) < 1e-9;
    const rows = [
      [['Berry 相位 γ（数值）', 'Berry phase γ (numerical)'], `${(gamma / Math.PI).toFixed(4)} π = ${gamma.toFixed(4)} rad`, true],
      [['环路与简并点', 'Loop and degeneracy'], p.delta > 0 ? (en ? 'no degeneracy (Δ > 0 opens a gap)' : '没有简并点（Δ > 0 打开能隙）') : onCI ? (en ? 'loop passes through the intersection' : '环路经过交叉点（相位无定义）') : encloses ? (en ? 'encloses the conical intersection' : '包围圆锥交叉') : (en ? 'does not enclose it' : '不包围交叉点')],
      [['环路上的最小能隙 E₊ − E₋', 'Smallest gap on the loop E₊ − E₋'], gap.toFixed(3)],
      [['回到起点时的本征矢', 'Eigenvector after one loop'], p.delta === 0 ? (Math.abs(Math.abs(gamma) - Math.PI) < 1e-3 ? (en ? 'sign flipped (× −1)' : '变号（× −1）') : (en ? 'unchanged' : '不变')) : (en ? `× e^(−iγ)` : `乘以 e^(−iγ)`)],
    ];
    if (centred) rows.push([['解析对照 Ω/2', 'Analytic check Ω/2'], `${(M.solidAngleCentred(p.kappa, loop.r, p.delta) / 2 / Math.PI).toFixed(4)} π`]);
    readout($('#b-read'), rows);
    $('#b-surface').setAttribute('aria-label', en ? `Two potential energy surfaces; Berry phase ${(gamma / Math.PI).toFixed(3)} π` : `两个势能面与环路；Berry 相位 ${(gamma / Math.PI).toFixed(3)} π`);
  }
  function drawSurfaces(p, pts, c) {
    const cv = $('#b-surface'), { ctx, w, h } = fit(cv);
    const n = 28, R = 1.5, ca = Math.cos(view.az), sa = Math.sin(view.az), ce = Math.cos(view.el), se = Math.sin(view.el);
    const proj = (x, y, z) => { const X = x * ca - y * sa, Y = x * sa + y * ca; return [X, Y * se + z * ce, -Y * ce + z * se]; };
    const surf = (sign) => { const v = []; for (let i = 0; i <= n; i++) { v.push([]); for (let j = 0; j <= n; j++) { const x = -R + (2 * R * i) / n, y = -R + (2 * R * j) / n; v[i].push([x, y, M.energies(x, y, p)[sign]]); } } return v; };
    const lo = surf(0), hi = surf(1), all = [...lo.flat(), ...hi.flat()];
    const zmin = Math.min(...all.map((q) => q[2])), zmax = Math.max(...all.map((q) => q[2]));
    const zs = 2.2 / Math.max(1e-9, zmax - zmin), zc = (zmin + zmax) / 2, floor = -1.25;
    const P = (x, y, z) => proj(x, y, (z - zc) * zs);
    const pr = all.map(([x, y, z]) => P(x, y, z)).concat([P(-R, -R, zmin - 0.6 / zs), P(R, R, zmin - 0.6 / zs)]);
    const sxMin = Math.min(...pr.map((q) => q[0])), sxMax = Math.max(...pr.map((q) => q[0])), syMin = Math.min(...pr.map((q) => q[1])), syMax = Math.max(...pr.map((q) => q[1]));
    const s = Math.min((w - 30) / (sxMax - sxMin), (h - 30) / (syMax - syMin)), ox = w / 2 - ((sxMin + sxMax) / 2) * s, oy = h / 2 + ((syMin + syMax) / 2) * s;
    const S = (q) => [ox + q[0] * s, oy - q[1] * s];
    // 底面网格与环路投影
    const fz = floor / zs + zc;
    ctx.strokeStyle = c.line; ctx.lineWidth = 1;
    for (let k = -3; k <= 3; k++) { const t = (k / 3) * R; for (const [a, b] of [[[t, -R], [t, R]], [[-R, t], [R, t]]]) { const A = S(P(a[0], a[1], fz)), B = S(P(b[0], b[1], fz)); ctx.beginPath(); ctx.moveTo(...A); ctx.lineTo(...B); ctx.stroke(); } }
    ctx.strokeStyle = c.violet; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.4; ctx.beginPath();
    pts.forEach(([x, y], i) => { const q = S(P(x, y, fz)); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.stroke(); ctx.setLineDash([]);
    const ci = S(P(0, 0, fz)); ctx.fillStyle = p.delta === 0 ? c.warn : c.faint; ctx.beginPath(); ctx.arc(...ci, 3.5, 0, 2 * Math.PI); ctx.fill();
    // 曲面：先画下层（不透明），再画环路，最后画上层（半透明），各自按深度排序
    const quads = (v) => { const out = []; for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) { const q = [v[i][j], v[i + 1][j], v[i + 1][j + 1], v[i][j + 1]].map(([x, y, z]) => P(x, y, z)); out.push({ q, d: q.reduce((t, r) => t + r[2], 0) / 4, z: (v[i][j][2] + v[i + 1][j + 1][2]) / 2 }); } return out.sort((a, b) => a.d - b.d); };
    const paint = (list, color, alpha) => { for (const { q, z } of list) { const sh = 0.55 + 0.45 * ((z - zmin) / (zmax - zmin || 1)); ctx.beginPath(); q.forEach((r, k) => (k ? ctx.lineTo(...S(r)) : ctx.moveTo(...S(r)))); ctx.closePath(); ctx.globalAlpha = alpha * sh; ctx.fillStyle = color; ctx.fill(); ctx.globalAlpha = Math.min(1, alpha + 0.15); ctx.strokeStyle = c.paper; ctx.lineWidth = 0.6; ctx.stroke(); } ctx.globalAlpha = 1; };
    paint(quads(lo), c.accentFill, 0.9);
    ctx.strokeStyle = c.violet; ctx.lineWidth = 2.6; ctx.beginPath();
    pts.forEach(([x, y], i) => { const q = S(P(x, y, M.energies(x, y, p)[0])); i ? ctx.lineTo(...q) : ctx.moveTo(...q); }); ctx.closePath(); ctx.stroke();
    paint(quads(hi), c.gold, 0.32);
    if (p.delta === 0) { const q = S(P(0, 0, 0)); ctx.fillStyle = c.warn; ctx.beginPath(); ctx.arc(...q, 4.5, 0, 2 * Math.PI); ctx.fill(); }
    ctx.fillStyle = c.ink2; ctx.font = font(11.5); ctx.textAlign = 'left';
    ctx.fillText(en ? 'E₊ (upper)  ·  E₋ (lower)  ·  loop  ·  ● degeneracy' : 'E₊（上层）· E₋（下层）· 环路 · ● 简并点', 10, 16);
    const ax = S(P(R, 0, fz)), ay = S(P(0, R, fz)); ctx.fillText('x', ax[0] + 4, ax[1] + 4); ctx.fillText('y', ay[0] + 4, ay[1] + 4);
  }
  function drawSphere(p, pts, c) {
    const cv = $('#b-sphere'), { ctx, w, h } = fit(cv);
    const R = Math.min(w, h) / 2 - 22, cx = w / 2, cy = h / 2, az = 0.6, el = 0.35;
    const ca = Math.cos(az), sa = Math.sin(az), ce = Math.cos(el), se = Math.sin(el);
    // Bloch 矢量分量 (n_x, n_y, n_z) 分别对应 σx、σy、σz
    const proj = ([x, y, z]) => { const X = x * ca - y * sa, Y = x * sa + y * ca; return [cx + R * X, cy - R * (Y * se + z * ce), -Y * ce + z * se]; };
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
    const circle = (f) => { ctx.beginPath(); for (let i = 0; i <= 120; i++) { const t = (2 * Math.PI * i) / 120, q = proj(f(t)); i ? ctx.lineTo(q[0], q[1]) : ctx.moveTo(q[0], q[1]); } ctx.stroke(); };
    ctx.setLineDash([3, 3]); circle((t) => [Math.cos(t), Math.sin(t), 0]); circle((t) => [Math.cos(t), 0, Math.sin(t)]); ctx.setLineDash([]);
    ctx.font = font(11); ctx.fillStyle = c.muted;
    for (const [v, lab] of [[[1.18, 0, 0], 'σx'], [[0, 1.18, 0], 'σy'], [[0, 0, 1.18], 'σz']]) { const q = proj(v), o = proj([0, 0, 0]); ctx.strokeStyle = c.faint; ctx.beginPath(); ctx.moveTo(o[0], o[1]); ctx.lineTo(q[0], q[1]); ctx.stroke(); ctx.fillText(lab, q[0] + 2, q[1]); }
    const path = pts.map(([x, y]) => proj(M.bloch(x, y, p)));
    for (let i = 0; i < path.length; i++) { const a = path[i], b = path[(i + 1) % path.length]; ctx.strokeStyle = c.violet; ctx.globalAlpha = a[2] > 0 ? 1 : 0.35; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
    ctx.globalAlpha = 1; ctx.fillStyle = c.violet; ctx.beginPath(); ctx.arc(path[0][0], path[0][1], 4, 0, 2 * Math.PI); ctx.fill();
  }
  function drawTransport(p, pts, c) {
    const tr = M.transport(pts.filter((_, i) => i % 4 === 0), p), n = tr.length, th = tr.map((_, i) => (360 * i) / (n - 1));
    const series = [
      { xs: th, ys: tr.map((u) => u[0]), color: c.accent, width: 2, label: 'Re u₁' },
      { xs: th, ys: tr.map((u) => u[2]), color: c.gold, width: 2, label: 'Re u₂' },
    ];
    if (p.delta > 0) series.push({ xs: th, ys: tr.map((u) => u[1]), color: c.accent, dash: [3, 3], width: 1.4, label: 'Im u₁' }, { xs: th, ys: tr.map((u) => u[3]), color: c.gold, dash: [3, 3], width: 1.4, label: 'Im u₂' });
    plot($('#b-transport'), { x0: 0, x1: 360, y0: -1.05, y1: 1.05, xt: [0, 90, 180, 270, 360], yt: [-1, 0, 1], xf: (t) => `${t}°`, yf: (t) => t, xl: en ? 'angle along the loop' : '沿环路的角度', yl: en ? 'component' : '分量', series });
  }
  bind(['b-kappa', 'b-lam', 'b-delta', 'b-cx', 'b-cy', 'b-r'], ciDraw);
  // 拖动或用方向键旋转视角
  const surf = $('#b-surface');
  surf.tabIndex = 0;
  let drag = null;
  surf.addEventListener('pointerdown', (e) => { drag = [e.clientX, e.clientY, view.az, view.el]; surf.setPointerCapture(e.pointerId); });
  surf.addEventListener('pointermove', (e) => { if (!drag) return; view.az = drag[2] + (e.clientX - drag[0]) * 0.01; view.el = Math.max(0.08, Math.min(1.4, drag[3] + (e.clientY - drag[1]) * 0.01)); requestAnimationFrame(ciDraw); });
  surf.addEventListener('pointerup', () => { drag = null; });
  surf.addEventListener('keydown', (e) => {
    const d = { ArrowLeft: [-0.1, 0], ArrowRight: [0.1, 0], ArrowUp: [0, -0.08], ArrowDown: [0, 0.08] }[e.key];
    if (!d) return;
    e.preventDefault(); view.az += d[0]; view.el = Math.max(0.08, Math.min(1.4, view.el + d[1])); ciDraw();
  });

  // ── 启动、重绘 ──────────────────────────────────────────────────────────
  const redraw = () => { grwDraw(); cohDraw(); ciDraw(); };
  grwReset(); cohDraw(); ciDraw();
  let pending = 0;
  const later = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(redraw); };
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(later); for (const id of ['g-canvas', 'c-canvas', 'b-surface', 'b-sphere', 'b-transport']) ro.observe($(`#${id}`)); }
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', later);
})();
