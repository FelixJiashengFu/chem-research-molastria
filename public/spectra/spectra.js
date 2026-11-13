'use strict';
// 谱图馆页面：把 sp-data.js、十一个 sp-m-*.js（91 种方法）、sp-atlas.js（速查表）、sp-refs.js（文献）画出来。
// 图由 sp-figs.js（实测、计算、示意）和 sp-gens.js / sp-gens2.js（交互演示）给出“视图”，这里只负责装进页面、滚到跟前再画。
// 内容文字自带中英两版（translate="no"），index.html 里的固定文字走 i18n。写法照 nmr/nmr.js。
(() => {
  const D = window.MOLASTRIA_SPECTRA, METHODS = window.MOLASTRIA_SPECTRA_METHODS || [], ATLAS = window.MOLASTRIA_SPECTRA_ATLAS, REFS = window.MOLASTRIA_SPECTRA_REFS, MEAS = window.MOLASTRIA_SPECTRA_MEASURED;
  const K = window.MOLASTRIA_SPECTRA_KIT, V = window.MOLASTRIA_SPECTRA_VIEWS, G = window.MOLASTRIA_SPECTRA_GENS, M = window.MOLASTRIA_SPECTRA_MODELS, TABLES = window.MOLASTRIA_SPECTRA_TABLES, MS = window.MOLASTRIA_SPECTRA_MS;
  if (!D || !K || !V || !G || !ATLAS || !REFS) { document.body.classList.remove('js-render'); return; }
  const { en, lang, esc, tx, L, rich, chem } = K;
  const $ = (s, r = document) => r.querySelector(s);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const T = (t) => rich(tx(t));
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  const famById = Object.fromEntries(D.families.map((f) => [f.id, f]));
  const order = D.families.flatMap((f) => METHODS.filter((m) => m.fam === f.id));
  const byId = Object.fromEntries(order.map((m) => [m.id, m]));
  const refById = Object.fromEntries(REFS.refs.map((r) => [r.id, r]));
  const genKind = {}; for (const [k, list] of Object.entries(D.genKinds)) for (const g of list) genKind[g] = k;
  const figKey = (f) => (f.gen ? 'gen' : Object.keys(D.figKinds).find((k) => f[k] != null));
  const kindOf = (f) => f.kind || (f.gen ? genKind[f.gen] : D.figKinds[figKey(f)]) || 'sketch';
  const kindTag = (k) => `<span class="sp-kind" data-kind="${k}" translate="no" lang="${lang}">${esc(tx(D.kinds[k]))}</span>`;
  const mLink = (id) => (byId[id] ? `<a class="sp-chip" href="#m-${id}" translate="no" lang="${lang}">${esc(byId[id].abbr || tx(byId[id].name))}</a>` : '');
  const surname = (a) => a.trim().replace(/ et al\..*/, '').split(' ').pop();
  const shortRef = (r) => { const list = r.authors.replace(/,? et al\..*/, '').split(/,\s*|;\s*| and /).filter(Boolean), many = list.length > 2 || /et al/.test(r.authors); return `${surname(list[0])}${many ? ' et al.' : list.length === 2 ? ` & ${surname(list[1])}` : ''} ${r.year}`; };
  const cite = (ids) => (ids?.length ? `<p class="fs-cite">${ids.filter((id) => refById[id]).map((id) => `<a href="#ref-${id}" data-ref="${id}" translate="no">${esc(shortRef(refById[id]))}</a>`).join(' · ')}</p>` : '');
  const href = (h) => (h.startsWith('#') || /^https?:/.test(h) ? h : `../${h}`);

  // ── 图：先放一个空壳，滚到跟前再画 ────────────────────────────────────
  const FIGS = [];
  function figHtml(f, title) {
    FIGS.push(f);
    const k = kindOf(f), t = title || f.title;
    return `<figure class="sp-fig" data-kind="${k}" data-fig="${FIGS.length - 1}"><header class="sp-fig-h">${kindTag(k)}${t ? C(T(t), 'b') : ''}</header><div class="sp-view"><p class="sp-wait">${L('滚到这里时开始画……', 'Drawn when scrolled into view…')}</p></div>${f.cap ? `<figcaption translate="no" lang="${lang}">${T(f.cap)}</figcaption>` : ''}</figure>`;
  }
  function mountFig(el) {
    if (el.dataset.done) return;
    el.dataset.done = '1';
    const f = FIGS[+el.dataset.fig], host = $('.sp-view', el);
    host.setAttribute('translate', 'no'); host.lang = lang;
    try {
      const key = figKey(f), view = f.gen ? G[f.gen](f.args || {}) : V[key](f);
      K.mount(host, view);
      if (view.pick) host.insertAdjacentHTML('beforeend', `<p class="sp-hint">${L('这张图可以点：点一个峰看它的详情。', 'This figure is clickable: click a peak for its details.')}</p>`);
    } catch (err) { host.innerHTML = `<p class="sp-wait">${L('这张图没能画出来：', 'This figure could not be drawn: ')}${esc(err.message || err)}</p>`; }
  }
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((list) => { for (const e of list) if (e.isIntersecting) { io.unobserve(e.target); mountFig(e.target); } }, { rootMargin: '500px 0px' }) : null;
  const arm = (root) => { for (const el of root.querySelectorAll('.sp-fig:not([data-done])')) { if (io) io.observe(el); else mountFig(el); } };

  // ── 首屏 ──────────────────────────────────────────────────────────────
  $('#sp-question').innerHTML = C(esc(tx(D.hero.question))) + (en ? '' : `<span class="fs-q-en" lang="en" translate="no">${esc(D.hero.question.en)}</span>`);
  $('#sp-lead').innerHTML = C(T(D.hero.lead));
  $('#sp-honest').innerHTML = C(T(D.hero.honesty));
  $('#sp-legend').innerHTML = Object.keys(D.kinds).map((k) => `<li>${kindTag(k)}${C(T(D.kindsLong[k]))}</li>`).join('');

  // ── 能量的尺子、按问题找方法 ──────────────────────────────────────────
  $('#sp-ladder-intro').innerHTML = C(T(D.ladder.intro));
  $('#sp-ladder-rest').innerHTML = C(T(D.ladder.rest));
  $('#sp-ladder-table').innerHTML = `<thead><tr>${[L('波段', 'Region'), L('能量和波长', 'Energy and wavelength'), L('推动的是什么', 'What it moves'), L('对应的方法', 'Methods')].map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody translate="no" lang="${lang}">${D.ladder.rows.map((r) => `<tr><th>${T(r.band)}</th><td>${T(r.range)}</td><td>${T(r.moves)}</td><td class="sp-chips">${r.methods.map(mLink).join('')}</td></tr>`).join('')}</tbody>`;
  $('#sp-q-grid').innerHTML = D.questions.map((q) => `<article class="sp-q"><h3>${C(T(q.q))}</h3><p class="sp-chips">${q.methods.map(mLink).join('')}</p>${C(T(q.note), 'p', 'sp-q-note')}</article>`).join('');

  // ── 方法目录 ──────────────────────────────────────────────────────────
  let fam = '', query = '';
  const famBtn = (id, name, n) => `<button type="button" class="button" data-fam="${id}" aria-pressed="${fam === id}">${C(esc(name))} <span class="sp-n">${n}</span></button>`;
  const hay = (m) => `${m.id} ${m.abbr || ''} ${m.name.zh} ${m.name.en} ${m.one.zh} ${m.one.en} ${famById[m.fam].name.zh} ${famById[m.fam].name.en}`.toLowerCase();
  function renderGrid() {
    const words = query.toLowerCase().split(/\s+/).filter(Boolean), list = order.filter((m) => (!fam || m.fam === fam) && words.every((w) => hay(m).includes(w)));
    $('#sp-fams').innerHTML = famBtn('', L('全部', 'All'), order.length) + D.families.map((f) => famBtn(f.id, tx(f.name), order.filter((m) => m.fam === f.id).length)).join('');
    $('#sp-count').textContent = en ? `${list.length} of ${order.length} methods` : `显示 ${list.length} / ${order.length} 种方法`;
    const groups = D.families.map((f) => [f, list.filter((m) => m.fam === f.id)]).filter(([, l]) => l.length);
    $('#sp-grid').innerHTML = groups.length ? groups.map(([f, l]) => `<section class="sp-fam" data-fam="${f.id}"><header><h3>${C(esc(tx(f.name)))}</h3>${C(T(f.blurb), 'p')}</header><div class="sp-cards">${l.map((m) => {
      const kinds = [...new Set((m.figs || []).map(kindOf))];
      return `<a class="sp-card" href="#m-${m.id}" data-id="${m.id}"><span class="sp-abbr" translate="no">${esc(m.abbr || '')}</span><h4>${C(esc(tx(m.name)))}${m.core ? `<span class="sp-core">${L('常用', 'Core')}</span>` : ''}</h4>${C(T(m.one), 'p')}<span class="sp-card-k">${kinds.map(kindTag).join('')}<span class="sp-n">${L(`${(m.figs || []).length} 张图`, `${(m.figs || []).length} figure${(m.figs || []).length === 1 ? '' : 's'}`)}</span></span></a>`;
    }).join('')}</div></section>`).join('') : `<p class="muted">${L('没有符合的方法。换个词，或者清掉筛选。', 'No method matches. Try another word or clear the filter.')}</p>`;
  }
  $('#sp-fams').addEventListener('click', (e) => { const b = e.target.closest('button[data-fam]'); if (!b) return; fam = b.dataset.fam; renderGrid(); });
  $('#sp-q').addEventListener('input', (e) => { query = e.target.value; renderGrid(); });
  renderGrid();

  // ── 方法详解 ──────────────────────────────────────────────────────────
  let current = '';
  const block = (title, html) => (html ? `<section class="sp-sec"><h4>${title}</h4>${html}</section>` : '');
  const paras = (list) => (list || []).map((p) => C(T(p), 'p')).join('');
  const items = (list, tag = 'ul') => (list?.length ? `<${tag} translate="no" lang="${lang}">${list.map((p) => `<li>${T(p)}</li>`).join('')}</${tag}>` : '');
  function showMethod(id, record) {
    const m = byId[id];
    if (!m) return false;
    current = id;
    const i = order.indexOf(m), prev = order[i - 1], next = order[i + 1], f = famById[m.fam], table = m.table && ATLAS.TABLES.find((t) => t.id === m.table);
    const nav = `<nav class="sp-pn" aria-label="${L('前后的方法', 'Previous and next method')}">${prev ? `<a class="button" href="#m-${prev.id}"><i class="ico-ext ico-left" aria-hidden="true"></i> ${C(esc(prev.abbr || tx(prev.name)))}</a>` : '<span></span>'}<a class="button" href="#sp-methods">${L('回到目录', 'Back to the catalogue')}</a>${next ? `<a class="button" href="#m-${next.id}">${C(esc(next.abbr || tx(next.name)))} <i class="ico-ext ico-right" aria-hidden="true"></i></a>` : '<span></span>'}</nav>`;
    $('#sp-method').innerHTML = `<header class="sp-m-h"><p class="sp-m-fam">${C(esc(tx(f.name)))}${m.core ? ` · <span class="sp-core">${L('常用', 'Core')}</span>` : ''}</p><h3 id="sp-m-title"><span class="sp-abbr" translate="no">${esc(m.abbr || '')}</span>${C(esc(tx(m.name)))}${en ? '' : `<span class="sp-m-en" lang="en" translate="no">${esc(m.name.en)}</span>`}</h3>${C(T(m.one), 'p', 'lead')}</header>
      ${(m.figs || []).length ? `<section class="sp-sec sp-figs"><h4>${L('谱图', 'Spectra')}</h4>${m.figs.map((fg) => figHtml(fg)).join('')}</section>` : ''}
      <div class="sp-cols"><div>${block(L('原理', 'How it works'), paras(m.how))}${block(L('坐标轴', 'The axes'), paras([m.axes]))}${block(L('怎样读谱', 'How to read it'), items(m.read, 'ol'))}</div>
      <div>${block(L('能回答什么', 'What it tells you'), items(m.tells))}${block(L('样品', 'Sample'), paras([m.sample]))}${block(L('关键数字', 'Key numbers'), m.nums?.length ? `<dl class="sp-nums" translate="no" lang="${lang}">${m.nums.map(([a, b]) => `<div><dt>${T(a)}</dt><dd>${T(b)}</dd></div>`).join('')}</dl>` : '')}${block(L('常见的坑', 'Pitfalls'), items(m.traps))}</div></div>
      ${table || m.see?.length ? `<section class="sp-sec sp-see"><h4>${L('接着看', 'See also')}</h4><p class="sp-chips">${table ? `<a class="sp-chip" href="#t-${table.id}">${L('速查表：', 'Table: ')}${C(esc(tx(table.title)))}</a>` : ''}${(m.see || []).map(([h, t]) => `<a class="sp-chip" href="${esc(href(h))}">${C(T(t))}${h.startsWith('#') ? '' : ` ${ext}`}</a>`).join('')}</p></section>` : ''}
      ${m.refs?.length ? `<section class="sp-sec"><h4>${L('文献', 'References')}</h4>${cite(m.refs)}</section>` : ''}${nav}`;
    arm($('#sp-method'));
    for (const a of document.querySelectorAll('.sp-card')) a.classList.toggle('is-on', a.dataset.id === id);
    if (record) { try { window.MolAstriaActivity && window.MolAstriaActivity('read'); } catch { /* 记不上不要紧 */ } }
    return true;
  }

  // ── 联合解谱 ──────────────────────────────────────────────────────────
  // a step whose computed spectrum is not in sp-computed.js is left out rather than drawn as an empty frame
  const COMPUTED = window.MOLASTRIA_SPECTRA_COMPUTED || { vib: {}, uv: {} };
  const hasData = (st) => !st.fig || (!(st.fig.vib && !COMPUTED.vib[st.fig.vib]) && !(st.fig.uv && !COMPUTED.uv[st.fig.uv]));
  let caseId = D.cases[0].id;
  function renderCase() {
    const c = D.cases.find((x) => x.id === caseId) || D.cases[0];
    $('#sp-case-tabs').innerHTML = D.cases.map((x) => `<button type="button" class="fs-tab" role="tab" id="case-${x.id}" data-case="${x.id}" aria-selected="${x.id === c.id}" aria-controls="sp-case-panel"><b translate="no">${esc(x.formula)}</b>${C(esc(tx(x.name)))}</button>`).join('');
    $('#sp-case-panel').innerHTML = `<div class="fs-panel sp-case" role="tabpanel" aria-labelledby="case-${c.id}">${C(T(c.intro), 'p', 'lead')}<ol class="sp-steps">${c.steps.filter(hasData).map((s, i) => `<li><div class="sp-step-t"><span class="sp-step-n">${i + 1}</span>${mLink(s.method)}${C(T(s.text), 'p')}</div>${s.fig ? figHtml({ ...s.fig, kind: s.kind || s.fig.kind }) : ''}</li>`).join('')}</ol></div>`;
    arm($('#sp-case-panel'));
  }
  $('#sp-case-tabs').addEventListener('click', (e) => { const b = e.target.closest('[data-case]'); if (!b) return; caseId = b.dataset.case; renderCase(); });
  renderCase();

  // ── 动手实验台 ────────────────────────────────────────────────────────
  $('#sp-lab-list').innerHTML = D.labs.map((l, i) => `<article class="fs-demo sp-lab" id="lab-${l.id}" aria-labelledby="lab-${l.id}-h"><header><p class="fs-demo-n">${L(`实验台 ${i + 1}`, `Bench ${i + 1}`)}</p><h3 id="lab-${l.id}-h">${C(esc(tx(l.title)))}</h3>${C(T(l.intro), 'p', 'muted')}</header>${figHtml(l.fig)}</article>`).join('');
  arm($('#sp-lab-list'));

  // ── 速查表 ────────────────────────────────────────────────────────────
  const cell = (c) => (c == null ? '' : T(c));
  function tableRows(t) {
    if (!t.compute) return t.rows;
    if (t.compute === 'losses') return t.rows.map(([f, note]) => [chem(f), String(Math.round(M.monoMass(f))), M.monoMass(f).toFixed(4), note]);
    if (t.compute === 'isotopes') return t.els.map((e) => [e, TABLES.isotopes[e].i.filter((x) => x[2] > 0).map(([A, m, ab]) => `${A}${e}: ${m.toFixed(5)} (${(100 * ab).toFixed(ab < 0.001 ? 4 : 2)})`).join(' · ')]);
    if (t.compute === 'adducts') return Object.entries(t.rows).map(([k, note]) => { const fn = M.ADDUCTS[k], off = fn(0), sl = fn(1) - off; return [k.replace('2+', '²⁺').replace(/\+(•?)$/, '⁺$1').replace(/-$/, '⁻'), `${sl === 1 ? 'M' : `${+sl.toFixed(2)} M`} ${off >= 0 ? '+' : '−'} ${Math.abs(off).toFixed(4)}`, note]; });
    if (t.compute === 'analyzers') return ATLAS.ANALYZERS.map((z) => [z.name, `${K.num(z.R[0], 0)} – ${K.num(z.R[1], 0)}`, z.acc, z.range, z.note]);
    if (t.compute === 'residues') return Object.entries(t.names).map(([k, n]) => [n, k, M.RESIDUE[k].toFixed(5)]);
    if (t.compute === 'xlines') return Object.entries(ATLAS.XLINES).sort((a, b) => a[1].Z - b[1].Z).map(([e, z]) => [e, String(z.Z), ...[z.ka, z.kb, z.la, z.lb].map((v) => (v ? v.toFixed(3) : '–'))]);
    if (t.compute === 'alines') return Object.entries(ATLAS.ALINES).map(([e, z]) => [`${e} · ${tx(z.name)}`, z.color || '–', [(z.flame || []).join(', '), z.bands ? `${L('谱带', 'bands')} ${z.bands.map((b) => b.join('–')).join(', ')}` : ''].filter(Boolean).join('; ') || '–', (z.icp || []).map(([nm, st]) => `${st} ${nm.toFixed(3)}`).join(', ') || '–']);
    return [];
  }
  const tableHtml = (t) => `<div class="sp-scroll"><table class="sp-table" translate="no" lang="${lang}"><thead><tr>${t.cols.map((c) => `<th>${cell(c)}</th>`).join('')}</tr></thead><tbody>${tableRows(t).map((r) => `<tr>${r.map((c, i) => (i ? `<td>${cell(c)}</td>` : `<th>${cell(c)}</th>`)).join('')}</tr>`).join('')}</tbody></table></div>`;
  $('#sp-atlas-list').innerHTML = ATLAS.TABLES.map((t) => `<details class="sp-atlas-item" id="t-${t.id}"><summary>${C(esc(tx(t.title)), 'b')}<span class="sp-n">${C(esc(tx(famById[t.fam].name)))}${t.compute && !['analyzers', 'alines', 'xlines'].includes(t.compute) ? ` · ${L('现算', 'computed live')}` : ''}</span></summary>${C(T(t.note), 'p', 'muted')}<div class="sp-atlas-body"></div></details>`).join('');
  const fillTable = (d) => { const body = $('.sp-atlas-body', d); if (!body.firstChild) body.innerHTML = tableHtml(ATLAS.TABLES.find((t) => `t-${t.id}` === d.id)); };
  for (const d of document.querySelectorAll('.sp-atlas-item')) d.addEventListener('toggle', () => { if (d.open) fillTable(d); });

  // ── 数据来源 ──────────────────────────────────────────────────────────
  $('#sp-ledger-intro').innerHTML = C(T(D.ledger.intro));
  $('#sp-ledger-grid').innerHTML = D.ledger.items.map((it) => `<article class="fs-theory sp-ledger"><h3>${C(T(it.title))}</h3><p class="fs-theory-meta">${kindTag(it.kind)}</p>${C(T(it.text), 'p')}</article>`).join('');
  $('#sp-unverified').innerHTML = `<h3>${C(T(D.ledger.unverified.title))}</h3>${C(T(D.ledger.unverified.intro), 'p')}${items(D.ledger.unverified.items)}`;
  if (MEAS) {
    const src = MEAS.sources.massbank;
    $('.sp-records summary').textContent = L(`${Object.keys(MEAS.ms).length} 张实测质谱的记录清单（MassBank，${src.date} 的版本）`, `The ${Object.keys(MEAS.ms).length} measured mass spectra, record by record (MassBank, version of ${src.date})`);
    $('#sp-records').innerHTML = `<thead><tr>${[L('化合物', 'Compound'), L('分子式', 'Formula'), L('仪器与类型', 'Instrument and type'), L('记录', 'Record'), L('作者', 'Authors'), L('许可证', 'Licence')].map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody translate="no">${Object.entries(MEAS.ms).map(([id, r]) => `<tr><th>${esc(MS.msName(id))}</th><td>${chem(r.formula)}</td><td>${esc(r.inst || '')}${r.type ? ` · ${esc(r.type)}` : ''}${r.ce ? ` · CE ${esc(r.ce)}` : ''}</td><td><a href="${esc(src.record + r.acc)}" target="_blank" rel="noopener noreferrer">${esc(r.acc)}</a></td><td>${esc(r.authors)}</td><td>${esc(r.lic)}</td></tr>`).join('')}</tbody>`;
  }

  // ── 文献 ──────────────────────────────────────────────────────────────
  const areaSel = $('#sp-lib-area'), sortSel = $('#sp-lib-sort'), areaName = (a) => (famById[a] ? tx(famById[a].name) : L('量化计算方法', 'Computational methods'));
  areaSel.insertAdjacentHTML('beforeend', [...D.families.map((f) => f.id), 'calc'].filter((a) => REFS.refs.some((r) => r.area === a)).map((a) => `<option value="${a}" translate="no" lang="${lang}">${esc(areaName(a))}</option>`).join(''));
  $('#sp-lib-intro').innerHTML = L(`共 ${REFS.refs.length} 篇：各种方法的原始论文、综述和标准教材里引用最多的工作。每篇的题目、年份、卷期按 DOI 在 OpenAlex 核对（核对日期 ${REFS.checked}）；没能核对上的列在“数据来源与核对”里。`, `${REFS.refs.length} entries: the original papers, reviews and most-cited works for each method. Title, year and volume were checked by DOI against OpenAlex (checked ${REFS.checked}); anything that could not be confirmed is listed under “Data sources and checks”.`);
  let libRefs = [];
  function renderRefs() {
    const a = areaSel.value, desc = sortSel.value === 'year-desc';
    const list = REFS.refs.filter((r) => !a || r.area === a).sort((x, y) => (desc ? y.year - x.year : x.year - y.year) || x.id.localeCompare(y.id));
    libRefs = list;
    if (window.MolAstriaCite && !document.getElementById('sp-cite')) { const cb = window.MolAstriaCite.bar(() => libRefs.map((r) => window.MolAstriaCite.fromRef(r)), { name: 'molastria-spectra', label: en ? 'Export these references' : '导出这些文献' }); cb.id = 'sp-cite'; $('#sp-lib-count').after(cb); }
    $('#sp-lib-count').textContent = en ? `${list.length} of ${REFS.refs.length}` : `显示 ${list.length} / ${REFS.refs.length} 篇`;
    $('#sp-refs').innerHTML = list.map((r) => `<li class="fs-ref" id="ref-${r.id}"><span translate="no">${esc(r.authors)} (${r.year}). <span class="fs-ref-title">${esc(r.title)}</span>. <i>${esc(r.journal)}</i>${r.vol ? ` ${esc(r.vol)}` : ''}${r.pages ? `, ${esc(r.pages)}` : ''}.</span>
      <div class="fs-ref-meta"><span translate="no" lang="${lang}">${esc(areaName(r.area))}</span>${r.doi ? `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener noreferrer" translate="no">doi:${esc(r.doi)} ${ext}</a>` : ''}</div></li>`).join('');
  }
  areaSel.addEventListener('change', renderRefs); sortSel.addEventListener('change', renderRefs);
  renderRefs();

  // ── 地址里的 #… ───────────────────────────────────────────────────────
  const scrollTo = (el) => { if (!el) return; const still = matchMedia('(prefers-reduced-motion: reduce)').matches; el.scrollIntoView({ behavior: still ? 'auto' : 'smooth', block: 'start' }); };
  function openFromHash(record) {
    const h = decodeURIComponent(location.hash.slice(1));
    if (h.startsWith('m-')) { if (showMethod(h.slice(2), record)) setTimeout(() => scrollTo($('#sp-reader')), 60); return; }
    if (h.startsWith('t-')) { const d = document.getElementById(h); if (d) { d.open = true; fillTable(d); setTimeout(() => scrollTo(d), 60); } return; }
    if (h.startsWith('case-')) { if (D.cases.some((c) => `case-${c.id}` === h)) { caseId = h.slice(5); renderCase(); setTimeout(() => scrollTo($('#sp-cases')), 60); } return; }
    if (h.startsWith('ref-')) {
      if (!document.getElementById(h)) { areaSel.value = ''; renderRefs(); }
      const el = document.getElementById(h);
      if (el) setTimeout(() => { scrollTo(el); el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 2400); }, 60);
      return;
    }
    if (h) { const el = document.getElementById(h); if (el) setTimeout(() => scrollTo(el), 60); }
  }
  window.addEventListener('hashchange', () => openFromHash(true));
  if (!/^#m-/.test(location.hash) || !byId[location.hash.slice(3)]) showMethod('ir', false);
  openFromHash(false);
  document.body.classList.remove('js-render');
})();
