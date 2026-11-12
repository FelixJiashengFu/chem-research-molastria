/* 书架页（/shelf/）：一排排木书架上立着书脊，点一本抽出来看封面和详情。
   “站内书架”是生成的 shelf-books.js（各栏目核对过的教材和讲解手册 25 册），“我的书架”是自己摆的书：
   从站内拿过来，或者输 DOI / ISBN / 书名查到再加（浏览器直接问 OpenAlex、Crossref、Open Library，不经过账号服务），也能手填。
   逻辑在 shelf-core.js；存档 molastria-shelf（在云同步的清单里），看法偏好 molastria-shelf-view 只留在本机。
   界面文字自带中英两版，translate="no"。 */
(() => {
  'use strict';
  const C = window.MolAstriaShelfCore;
  const CAT = window.MOLASTRIA_SHELF_BOOKS;
  const app = document.getElementById('sh');
  if (!C || !CAT || !app) return;
  const root = document.documentElement;
  const en = root.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const T = (o) => (o ? (en ? o.en : o.zh) : '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const UP = '../';
  const VIEW_KEY = 'molastria-shelf-view';

  // ── 存档
  const load = () => { try { return C.parse(localStorage.getItem(C.KEY)); } catch { return C.empty(); } };
  let state = load();
  function save(next) {
    state = next;
    try { const s = C.serialize(state); if (s) localStorage.setItem(C.KEY, s); else localStorage.removeItem(C.KEY); } catch { /* private mode */ }
  }
  const ui = (() => { try { return { view: 'spine', tab: 'site', ...JSON.parse(localStorage.getItem(VIEW_KEY) || '{}') }; } catch { return { view: 'spine', tab: 'site' }; } })();
  ui.q = ''; ui.filter = 'all';
  if (!['spine', 'cover'].includes(ui.view)) ui.view = 'spine';
  if (!['site', 'mine'].includes(ui.tab)) ui.tab = 'site';
  const saveUi = () => { try { localStorage.setItem(VIEW_KEY, JSON.stringify({ view: ui.view, tab: ui.tab })); } catch { /* ignore */ } };

  // ── 书
  const shelfOf = {};
  CAT.shelves.forEach((s) => s.books.forEach((id) => { shelfOf[id] = s; }));
  const MINE_SHELF = { id: 'mine', zh: '我自己加的书', en: 'Added by you', motif: 'leaf' };
  function book(id) {
    const b = CAT.books[id];
    if (b) return { id, ...b, title: en && b.tEn ? b.tEn : b.t, shelf: shelfOf[id], own: false };
    const m = state.mine.find((x) => x.id === id);
    return m ? { ...m, title: m.t, shelf: MINE_SHELF, own: true, from: [] } : null;
  }
  const cjk = (s) => /[\u3400-\u9fff]/.test(s || '');
  const spineTitle = (b) => {
    if (b.shelf?.series) return b.title.replace(/^[\d–]+\s*·\s*/, '');
    const t = String(b.title || '').split(/[:：]\s/)[0];
    return t.length > 46 ? t.slice(0, 44) + '…' : t;
  };
  const surname = (a) => {
    const first = String(a || '').split(/,\s*|、|，| and /)[0].trim();
    if (!first) return '';
    if (cjk(first)) return first.slice(0, 6);
    return first.split(/\s+/).pop();
  };
  const levelName = { intro: ['入门', 'Introductory'], core: ['核心', 'Core'], adv: ['深入', 'Advanced'] };
  const statusName = { want: ['想读', 'Want to read'], reading: ['在读', 'Reading'], done: ['读完', 'Finished'] };
  const SN = (s) => (statusName[s] ? L(...statusName[s]) : '');

  // ── 封面图案（金线，跟着书所在的那层）
  const MOTIF = {
    hex: '<g fill="none" stroke="currentColor" stroke-width="1.1"><path d="M60 22l26 15v30L60 82 34 67V37z"/><circle cx="60" cy="52" r="15"/><path d="M60 22V8M86 37l12-7M86 67l12 7M60 82v14M34 67l-12 7M34 37l-12-7" opacity=".55"/><path d="M98 30l12-7 12 7M22 30L10 23" opacity=".35"/></g>',
    orbit: '<g fill="none" stroke="currentColor" stroke-width="1.1"><ellipse cx="60" cy="52" rx="44" ry="15"/><ellipse cx="60" cy="52" rx="44" ry="15" transform="rotate(60 60 52)"/><ellipse cx="60" cy="52" rx="44" ry="15" transform="rotate(-60 60 52)"/></g><circle cx="60" cy="52" r="5" fill="currentColor"/><circle cx="104" cy="52" r="2.4" fill="currentColor"/>',
    grid: '<g fill="none" stroke="currentColor"><path d="M14 20h92M14 36h92M14 52h92M14 68h92M14 84h92M22 12v80M40 12v80M58 12v80M76 12v80M94 12v80" stroke-width=".5" opacity=".45"/><path d="M14 70C30 70 34 26 52 26s22 48 40 48 14-30 14-30" stroke-width="1.4"/></g><circle cx="52" cy="26" r="2.6" fill="currentColor"/>',
    circuit: '<g fill="none" stroke="currentColor" stroke-width="1.1"><path d="M10 30h100M10 52h100M10 74h100"/><rect x="26" y="22" width="16" height="16" rx="2"/><rect x="62" y="44" width="16" height="16" rx="2"/><path d="M92 30v44"/><circle cx="92" cy="74" r="6"/><path d="M92 68v12M86 74h12"/></g><circle cx="92" cy="30" r="3" fill="currentColor"/>',
    star: '<g fill="none" stroke="currentColor" stroke-width="1.1"><ellipse cx="60" cy="52" rx="46" ry="17" transform="rotate(-18 60 52)"/></g><path d="M60 24l6.5 21.5L88 52l-21.5 6.5L60 80l-6.5-21.5L32 52l21.5-6.5z" fill="currentColor" opacity=".9"/><circle cx="100" cy="38" r="3" fill="currentColor"/>',
    leaf: '<g fill="none" stroke="currentColor" stroke-width="1.1"><path d="M60 88C30 70 32 34 60 16c28 18 30 54 0 72z"/><path d="M60 88V28M60 44l-12-8M60 56l14-9M60 68l-14-8" opacity=".7"/></g>',
  };
  const motif = (b) => `<svg class="cv-motif" viewBox="0 0 120 100" aria-hidden="true">${MOTIF[b.shelf?.motif] || MOTIF.leaf}</svg>`;

  function coverHtml(b, cls = '') {
    const sp = C.spine(b.id, b);
    const style = `--bg:${sp.bg};--hi:${sp.hi}`;
    if (b.shelf?.series) {
      return `<div class="cv cv-series ${cls}" style="--bg:#173f34;--hi:#25604d" aria-hidden="true">
        <span class="cv-kicker">MOLASTRIA · ${en ? 'HANDBOOK' : '讲解手册'}</span>
        <span class="cv-vol">${String(b.vol).padStart(2, '0')}</span>${motif(b)}
        <span class="cv-title ${cjk(b.title) ? 'cjk' : ''}">${esc(spineTitle(b))}</span>
        <span class="cv-auth">molastria.com</span></div>`;
    }
    return `<div class="cv ${sp.light ? 'cv-light' : ''} ${cls}" style="${style}" aria-hidden="true">
      <span class="cv-title ${cjk(b.title) ? 'cjk' : ''}">${esc(String(b.title).split(/[:：]\s/)[0])}</span>
      ${b.ed ? `<span class="cv-ed">${esc(T(b.ed))}</span>` : ''}${motif(b)}
      <span class="cv-auth">${esc(String(b.a || '').split(/,\s*(?![^()]*\))/).slice(0, 3).join(' · '))}</span>
      <span class="cv-pub">${esc(String(b.pub || '').replace(/\s*\(.*\)$/, ''))}${b.y ? ' · ' + esc(b.y) : ''}</span></div>`;
  }

  // 中文书名一个字一行竖着排（不靠 writing-mode：有的字体没有竖排字宽，字会叠在一起）
  function cjkStack(t, room) {
    const ch = Array.from(String(t).replace(/\s+/g, ''));
    const n = Math.max(3, Math.floor(room / 14.6));
    const shown = ch.length > n ? [...ch.slice(0, n - 1), '⋮'] : ch;
    return `<span class="sp-t cjk" aria-hidden="true">${shown.map((c) => `<i>${esc(c)}</i>`).join('')}</span>`;
  }
  function spineHtml(b, i) {
    const sp = C.spine(b.id, b);
    const it = state.items[b.id] || {};
    const series = b.shelf?.series;
    // 书名一栏放不下就排两栏（书脊加宽、加高一点），两栏也放不下就截短
    const t0 = spineTitle(b), wide = cjk(t0) ? 1.1 : 0.55;
    const cap1 = Math.floor((sp.h - (series ? 78 : 70)) / (11.5 * wide));
    const cols = series || cjk(t0) || t0.length <= cap1 ? 1 : 2;
    const h = series ? 186 : cols === 2 ? Math.min(sp.h + 12, 204) : sp.h;
    const cap = Math.floor((h - 66) / (10.5 * wide));
    const w = series ? 36 : cols === 2 ? Math.max(sp.w, 44) : sp.w;
    const t = cols === 2 && t0.length > cap * 2 + 2 ? t0.slice(0, cap * 2).replace(/\s+\S*$/, '') + '…' : t0;
    const st = it.s ? `<span class="sp-mark sp-${it.s}" aria-hidden="true"></span>` : '';
    const label = `${b.title}${b.a && !series ? ' · ' + b.a : ''}${it.s ? ' · ' + SN(it.s) : ''}`;
    return `<div class="sp-slot" data-id="${esc(b.id)}" style="--i:${i}"><button type="button" class="sp ${sp.light && !series ? 'sp-light' : ''} ${series ? 'sp-series' : ''} ${series ? "" : "sp-band" + sp.band}" data-id="${esc(b.id)}"
      style="--w:${w}px;--h:${h}px;--bg:${series ? '#173f34' : sp.bg};--hi:${series ? '#25604d' : sp.hi}" aria-label="${esc(label)}" title="${esc(label)}">
      ${series ? `<span class="sp-vol">${String(b.vol).padStart(2, '0')}</span>` : ''}
      ${cjk(t0) ? cjkStack(t0, h - (series ? 66 : 62)) : `<span class="sp-t ${cols === 2 ? 'two' : ''}">${esc(t)}</span>`}
      ${series ? '<span class="sp-star" aria-hidden="true"></span>' : `<span class="sp-a ${cjk(b.a) ? 'cjk' : ''}">${esc(surname(b.a))}</span>`}
      ${b.free ? '<span class="sp-free" aria-hidden="true"></span>' : ''}${st}</button></div>`;
  }
  function faceHtml(b, i) {
    const it = state.items[b.id] || {};
    const label = `${b.title}${b.a ? ' · ' + b.a : ''}${it.s ? ' · ' + SN(it.s) : ''}`;
    return `<div class="sp-slot face" data-id="${esc(b.id)}" style="--i:${i}"><button type="button" class="face-btn" data-id="${esc(b.id)}" aria-label="${esc(label)}" title="${esc(label)}">
      ${coverHtml(b)}${it.s ? `<span class="face-st face-${it.s}">${esc(SN(it.s))}</span>` : ''}</button></div>`;
  }

  // ── 页面骨架（一次），书架部分每次筛选重画
  function counts() {
    const c = C.counts(state);
    return { site: Object.keys(CAT.books).length, ...c };
  }
  function mast() {
    const c = counts();
    return `<header class="sh-mast">
      <p class="sh-eyebrow">MOLASTRIA · ${en ? 'LIBRARY' : '书架'}</p>
      <h1>${L('书架', 'Bookshelf')}<small>${L('Bookshelf', '书架')}</small></h1>
      <p class="sh-lead">${L(`站内各栏目推荐、逐本核对过的 ${c.site - 25} 本教材，加上 MolAstria 讲解手册 25 册。抽一本出来看它讲什么、哪一章推荐它；把要读的放上自己的书架，标在读、读完，写几句笔记。`, `${c.site - 25} textbooks recommended across the site, each one checked, plus the 25 volumes of the MolAstria Handbook. Pull one out to see what it covers and which chapter recommends it; put the ones you mean to read on your own shelf, mark them reading or finished, and keep a few notes.`)}</p>
      <dl class="sh-stats" id="sh-stats"></dl>
    </header>`;
  }
  function statsHtml() {
    const c = counts();
    const cell = (n, zh, e, act) => `<div><dt>${L(zh, e)}</dt><dd>${act ? `<button type="button" data-go="${act}">${n}</button>` : n}</dd></div>`;
    return cell(c.site, '站内书目', 'On the site', '') + cell(c.mine, '我的书架', 'My shelf', 'mine') + cell(c.reading, '在读', 'Reading', 'reading') + cell(c.done, '读完', 'Finished', 'done');
  }
  function toolbar() {
    const chips = [['all', '全部', 'All'], ['reading', '在读', 'Reading'], ['want', '想读', 'Want'], ['done', '读完', 'Finished'], ['free', '开放获取', 'Free to read'], ['noted', '有笔记', 'With notes']];
    return `<div class="sh-bar" role="toolbar" aria-label="${L('书架工具', 'Shelf tools')}">
      <div class="sh-tabs" role="tablist">
        <button type="button" role="tab" data-tab="site">${L('站内书架', 'Site shelves')}</button>
        <button type="button" role="tab" data-tab="mine">${L('我的书架', 'My shelf')} <span class="sh-n" id="sh-n-mine"></span></button>
      </div>
      <label class="sh-search"><span class="sr">${L('搜索书名、作者', 'Search titles and authors')}</span>
        <input id="sh-q" type="search" autocomplete="off" placeholder="${L('搜书名、作者、出版社…', 'Search title, author, publisher…')}"></label>
      <div class="sh-view" role="group" aria-label="${L('摆法', 'Display')}">
        <button type="button" data-view="spine" title="${L('书脊朝外', 'Spines out')}"><span class="ico-spines" aria-hidden="true"></span><span>${L('书脊', 'Spines')}</span></button>
        <button type="button" data-view="cover" title="${L('封面朝外', 'Covers out')}"><span class="ico-covers" aria-hidden="true"></span><span>${L('封面', 'Covers')}</span></button>
      </div>
      <div class="sh-chips" role="group" aria-label="${L('筛选', 'Filter')}">${chips.map(([k, zh, e]) => `<button type="button" data-filter="${k}">${L(zh, e)}</button>`).join('')}</div>
    </div>`;
  }
  app.innerHTML = mast() + toolbar() + '<div id="sh-body" class="sh-body"></div>' + `<footer class="sh-foot">
      <p>${L('书目来自讲解手册、量子物理、量子算法和数学基础几个栏目的书单，以及一排计算化学经典；DOI 在 OpenAlex 或 Crossref 核对过（' + CAT.checked + '）。列出一本书不代表作者或出版社认可本站。封面是本站按书名生成的装帧，不是出版社的封面。', 'Books come from the reading lists of the Handbook, Quantum Physics, Quantum Algorithms and Mathematical Foundations, plus a row of computational chemistry classics; DOIs were checked against OpenAlex or Crossref (' + CAT.checked + '). Listing a book does not mean its authors or publisher endorse this site. Covers are bindings we generate from the title, not the publishers\' covers.')}</p>
      <p>${L('你的书架存在这个浏览器里；在账号页打开云同步后跟着账号走。查书时由你的浏览器直接问 OpenAlex、Crossref 和 Open Library，不经过 MolAstria 的服务器。', 'Your shelf is stored in this browser, and follows your account once cloud sync is on in the account page. Lookups go from your browser straight to OpenAlex, Crossref and Open Library, not through MolAstria\'s servers.')}</p>
    </footer>`;
  const body = document.getElementById('sh-body');
  const qBox = document.getElementById('sh-q');

  function syncBar() {
    app.querySelectorAll('[data-tab]').forEach((b) => { const on = b.dataset.tab === ui.tab; b.setAttribute('aria-selected', on); b.tabIndex = on ? 0 : -1; });
    app.querySelectorAll('[data-view]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.view === ui.view));
    app.querySelectorAll('[data-filter]').forEach((b) => b.setAttribute('aria-pressed', b.dataset.filter === ui.filter));
    document.getElementById('sh-n-mine').textContent = state.order.length || '';
    document.getElementById('sh-stats').innerHTML = statsHtml();
    app.dataset.tab = ui.tab;
  }

  // ── 书架
  let firstPaint = true;
  function caseHtml(sh, ids, opts = {}) {
    const list = ids.map(book).filter(Boolean).filter((b) => C.matches(b, state.items[b.id], ui.q, ui.filter));
    if (!list.length && !opts.keepEmpty) return '';
    const books = list.map((b, i) => (ui.view === 'cover' ? faceHtml(b, i) : spineHtml(b, i))).join('').replace(/class="sp-slot( face)?"(?![\s\S]*class="sp-slot)/, (m, f) => `class="sp-slot${f || ''} last"`);
    return `<section class="sh-case" data-shelf="${esc(sh.id)}" aria-labelledby="sh-h-${esc(sh.id)}">
      <div class="sh-plaque"><h2 id="sh-h-${esc(sh.id)}">${esc(T(sh) || L(sh.zh, sh.en))}</h2>
        <span class="sh-count">${L(`${list.length} 本`, `${list.length} ${list.length === 1 ? 'book' : 'books'}`)}</span>
        ${opts.extra || ''}${sh.hint ? `<p>${esc(T(sh.hint))}</p>` : ''}</div>
      <div class="sh-row ${ui.view === 'cover' ? 'covers' : ''}" role="list">${books}${opts.empty && !list.length ? opts.empty : ''}</div>
    </section>`;
  }
  function draw() {
    syncBar();
    let html = '';
    if (ui.tab === 'site') {
      html = CAT.shelves.map((s) => caseHtml({ ...s, zh: s.zh, en: s.en }, s.books)).join('');
      if (!html) html = `<p class="sh-none">${L('没有符合的书。换个词，或者把筛选改回“全部”。', 'No books match. Try another word, or set the filter back to All.')}</p>`;
    } else {
      html = addPanel() + caseHtml({ id: 'mine', zh: '我的书架', en: 'My shelf', hint: { zh: state.order.length > 1 ? '按住一本书拖动可以换位置（触屏先按住一下），也可以在详情里左右挪。' : '从站内书架抽一本，点“放上我的书架”；或者在上面输 DOI、ISBN 或书名。', en: state.order.length > 1 ? 'Drag a book to move it (on touch screens, press and hold first), or move it left or right from its details.' : 'Pull a book from the site shelves and choose "Put on my shelf", or type a DOI, ISBN or title above.' } },
        state.order, { keepEmpty: true, extra: state.order.length ? `<div class="sh-tools"><button type="button" class="sh-btn ghost" data-act="bib">${L('导出 BibTeX', 'Export BibTeX')}</button></div>` : '',
          empty: `<div class="sh-empty"><span class="lean" aria-hidden="true"></span><p>${state.order.length ? L('没有符合的书。', 'No books match.') : L('架子还空着。', 'The shelf is still empty.')}</p></div>` });
    }
    body.innerHTML = html;
    body.classList.toggle('enter', firstPaint && !reduce);
    firstPaint = false;
    bindAdd();
  }

  // ── 加书（我的书架）
  let addOpen = false, addMsg = '', addResults = [], addBusy = false, manual = null;
  function addPanel() {
    const res = addResults.map((b, i) => `<li class="sh-hit"><div class="sh-hit-cv">${coverHtml({ ...b, id: 'tmp' + i, title: b.t, shelf: MINE_SHELF }, 'mini')}</div>
        <div><strong>${esc(b.t)}</strong><span>${esc([b.a, b.pub, b.y].filter(Boolean).join(' · '))}</span>${b.doi ? `<code>doi:${esc(b.doi)}</code>` : ''}${b.isbn ? `<code>ISBN ${esc(C.hyphenIsbn(b.isbn))}</code>` : ''}</div>
        <button type="button" class="sh-btn" data-add="${i}">${L('放上书架', 'Add')}</button></li>`).join('');
    const m = manual || {};
    return `<section class="sh-add ${addOpen ? 'open' : ''}" aria-label="${L('加一本书', 'Add a book')}">
      <form id="sh-find" class="sh-find" autocomplete="off">
        <label for="sh-find-q">${L('加一本书', 'Add a book')}</label>
        <div class="sh-find-row"><input id="sh-find-q" name="q" placeholder="${L('DOI、ISBN 或书名', 'DOI, ISBN or title')}" maxlength="200">
        <button type="submit" class="sh-btn" ${addBusy ? 'disabled' : ''}>${addBusy ? L('查找中…', 'Looking…') : L('查找', 'Look up')}</button>
        <button type="button" class="sh-btn ghost" data-act="manual">${L('手动填写', 'Type it in')}</button></div>
        <p class="sh-find-msg" role="status" aria-live="polite">${esc(addMsg)}</p>
      </form>
      ${res ? `<ul class="sh-hits">${res}</ul>` : ''}
      ${manual ? `<form id="sh-manual" class="sh-manual">
        <label class="wide"><span>${L('书名', 'Title')} *</span><input name="t" required maxlength="300" value="${esc(m.t || '')}"></label>
        <label class="wide"><span>${L('作者（逗号分开）', 'Authors (comma separated)')}</span><input name="a" maxlength="300" value="${esc(m.a || '')}"></label>
        <label><span>${L('出版社', 'Publisher')}</span><input name="pub" maxlength="300" value="${esc(m.pub || '')}"></label>
        <label><span>${L('年份', 'Year')}</span><input name="y" inputmode="numeric" maxlength="4" value="${esc(m.y || '')}"></label>
        <label><span>DOI</span><input name="doi" maxlength="200" value="${esc(m.doi || '')}"></label>
        <label><span>ISBN</span><input name="isbn" maxlength="20" value="${esc(m.isbn || '')}"></label>
        <label class="wide"><span>${L('链接', 'Link')}</span><input name="url" type="url" maxlength="500" placeholder="https://" value="${esc(m.url || '')}"></label>
        <div class="wide sh-manual-go"><button type="submit" class="sh-btn">${L('放上书架', 'Add to shelf')}</button><button type="button" class="sh-btn ghost" data-act="manual-x">${L('取消', 'Cancel')}</button></div>
      </form>` : ''}
    </section>`;
  }
  function bindAdd() {
    const f = document.getElementById('sh-find');
    if (f) f.onsubmit = (e) => { e.preventDefault(); find(f.q.value); };
    const mf = document.getElementById('sh-manual');
    if (mf) mf.onsubmit = (e) => {
      e.preventDefault();
      const d = Object.fromEntries(new FormData(mf));
      if (d.isbn && !C.normIsbn(d.isbn)) { addMsg = L('ISBN 的校验位不对，检查一下有没有抄错。', 'That ISBN\'s check digit is wrong; check for a typo.'); manual = d; draw(); return; }
      if (d.doi && !C.normDoi(d.doi)) { addMsg = L('DOI 应该以 10. 开头，比如 10.1002/9781119019572。', 'A DOI starts with 10., for example 10.1002/9781119019572.'); manual = d; draw(); return; }
      put(d);
    };
  }
  async function getJson(url, ms = 9000) {
    const ac = new AbortController();
    const t = setTimeout(() => ac.abort(), ms);
    try {
      const r = await fetch(url, { signal: ac.signal, headers: { Accept: 'application/json' } });
      const text = await r.text();
      if (!r.ok) return null;
      return JSON.parse(text);
    } catch { return null; } finally { clearTimeout(t); }
  }
  async function find(q) {
    const d = C.detect(q);
    addResults = []; manual = null;
    if (d.kind === 'empty') { addMsg = L('输一个 DOI、ISBN 或书名。', 'Type a DOI, ISBN or title.'); draw(); return; }
    if (d.kind === 'bad-isbn') { addMsg = L('这串数字像 ISBN，但校验位不对，检查一下有没有抄错。', 'That looks like an ISBN, but the check digit is wrong; check for a typo.'); draw(); return; }
    addBusy = true; addMsg = L('正在查找…', 'Looking it up…'); draw();
    const inp = document.getElementById('sh-find-q'); if (inp) inp.value = q;
    let found = [];
    for (const [src, url] of C.lookupUrls(d)) {
      const j = await getJson(url);
      found = j ? C.results(src, j, d) : [];
      if (found.length) break;
    }
    addBusy = false;
    if (found.length) {
      addResults = found;
      addMsg = d.kind === 'title' ? L(`找到 ${found.length} 本，挑一本放上去。`, `Found ${found.length}; pick one to add.`) : L('找到了。', 'Found it.');
    } else {
      addMsg = L('没有查到。可以手动填写，DOI / ISBN 已经帮你填上。', 'Nothing found. You can type it in; the DOI / ISBN is already filled.');
      manual = d.kind === 'doi' ? { doi: d.value } : d.kind === 'isbn' ? { isbn: d.value } : { t: d.value };
    }
    draw();
    const again = document.getElementById('sh-find-q'); if (again) again.value = q;
  }
  function put(b) {
    const r = C.addCustom(state, b, CAT);
    if (!r.id) { addMsg = r.error === 'full' ? L(`最多放 ${C.MAX_MINE} 本自己加的书。`, `You can add up to ${C.MAX_MINE} books of your own.`) : L('要有书名。', 'A title is needed.'); draw(); return; }
    save(r.state);
    addResults = []; manual = null;
    addMsg = r.existed ? L('这本书站内已经有了，已经放上你的书架。', 'This book is already on the site; it is now on your shelf.') : L('放上去了。', 'Added.');
    ui.filter = 'all'; ui.q = ''; qBox.value = '';
    draw();
    flash(r.id);
  }
  const flash = (id) => { const el = body.querySelector(`.sp-slot[data-id="${CSS.escape(id)}"]`); if (el) { el.classList.add('flash'); el.scrollIntoView({ block: 'nearest', behavior: reduce ? 'auto' : 'smooth' }); setTimeout(() => el.classList.remove('flash'), 1600); } };

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  function exportBib() {
    const list = state.order.map(book).filter((b) => b && !b.shelf?.series).map((b) => ({ ...b, t: b.t, edEn: b.ed?.en }));
    download(`molastria-shelf-${new Date().toISOString().slice(0, 10)}.bib`, C.bibtex(list), 'application/x-bibtex');
  }

  // ── 取一本书：对话框
  const dlg = document.createElement('div');
  dlg.className = 'sh-dlg'; dlg.hidden = true; dlg.setAttribute('translate', 'no');
  dlg.innerHTML = '<div class="sh-dlg-back" data-act="close"></div><div class="sh-dlg-box" role="dialog" aria-modal="true" aria-labelledby="bk-title" tabindex="-1"></div>';
  document.body.append(dlg);
  const box = dlg.querySelector('.sh-dlg-box');
  let openId = null, lastFocus = null, noteTimer = 0;

  function visibleIds() { return [...body.querySelectorAll('.sp-slot[data-id]')].map((x) => x.dataset.id); }
  function linkFor(href) { return /^https?:/.test(href) ? href : UP + href; }
  function bookDetail(b) {
    const it = state.items[b.id] || {};
    const sp = C.spine(b.id, b);
    const depth = b.shelf?.series ? 40 : sp.w;
    const ids = visibleIds(), k = ids.indexOf(b.id);
    const mine = C.onMine(state, b.id);
    const badges = [b.free ? `<span class="bdg free">${L('开放获取', 'Free to read')}</span>` : '', b.lv && levelName[b.lv] ? `<span class="bdg">${L(...levelName[b.lv])}</span>` : '', b.own ? `<span class="bdg">${L('自己加的', 'Added by you')}</span>` : ''].join('');
    const ident = [b.doi ? `<a href="https://doi.org/${esc(b.doi)}" target="_blank" rel="noopener">doi:${esc(b.doi)} <i class="ico-ext" aria-hidden="true"></i></a>` : '',
      b.isbn ? `<span>ISBN ${esc(C.hyphenIsbn(b.isbn))}</span>` : '',
      b.url && !b.shelf?.series ? `<a href="${esc(linkFor(b.url))}" target="_blank" rel="noopener">${L('作者或出版社页面', 'Author or publisher page')} <i class="ico-ext" aria-hidden="true"></i></a>` : ''].filter(Boolean).join('');
    const qs = encodeURIComponent([String(b.title).split(/[:：]\s/)[0], surname(b.a)].filter(Boolean).join(' '));
    const findLinks = b.shelf?.series ? '' : `<p class="bk-find">${L('找这本书：', 'Find a copy: ')}<a href="https://openlibrary.org/search?q=${qs}" target="_blank" rel="noopener">Open Library</a> · <a href="https://search.worldcat.org/search?q=${qs}" target="_blank" rel="noopener">WorldCat</a> · <a href="https://www.google.com/search?tbm=bks&q=${qs}" target="_blank" rel="noopener">Google Books</a></p>`;
    const from = (b.from || []).map((f) => `<li><a href="${esc(linkFor(f.href))}">${esc(T(f))}</a></li>`).join('');
    const stars = [1, 2, 3, 4, 5].map((n) => `<button type="button" class="star ${it.r >= n ? 'on' : ''}" data-rate="${n}" aria-label="${L(`${n} 星`, `${n} star${n > 1 ? 's' : ''}`)}" aria-pressed="${it.r === n}"></button>`).join('');
    return `<button type="button" class="bk-x" data-act="close" aria-label="${L('放回去', 'Put it back')}"></button>
      <div class="bk-stage" style="--depth:${Math.max(26, depth)}px">
        <div class="bk ${reduce ? '' : 'pull'}" id="bk3d">
          <div class="bk-face bk-front">${coverHtml(b, 'big')}</div>
          <div class="bk-face bk-spine" style="--bg:${b.shelf?.series ? '#173f34' : sp.bg};--hi:${b.shelf?.series ? '#25604d' : sp.hi}"></div>
          <div class="bk-face bk-pages"></div><div class="bk-face bk-top"></div><div class="bk-face bk-back" style="--bg:${b.shelf?.series ? '#173f34' : sp.bg}"></div>
        </div>
        <div class="bk-nav">
          <button type="button" class="sh-btn ghost" data-step="-1" ${k <= 0 ? 'disabled' : ''} aria-label="${L('上一本', 'Previous book')}"><i class="ico-ext ico-left" aria-hidden="true"></i></button>
          <span>${k >= 0 ? `${k + 1} / ${ids.length}` : ''}</span>
          <button type="button" class="sh-btn ghost" data-step="1" ${k < 0 || k >= ids.length - 1 ? 'disabled' : ''} aria-label="${L('下一本', 'Next book')}"><i class="ico-ext ico-right" aria-hidden="true"></i></button>
        </div>
      </div>
      <div class="bk-info">
        <p class="bk-kicker">${esc(T(b.shelf) || L(b.shelf?.zh, b.shelf?.en))}</p>
        <h2 id="bk-title" class="${cjk(b.title) ? 'cjk' : ''}">${esc(b.title)}</h2>
        ${b.sub ? `<p class="bk-sub">${esc(T(b.sub))}</p>` : ''}
        <p class="bk-by">${esc(b.a || '')}${b.ed ? ` · ${esc(T(b.ed))}` : ''}</p>
        <p class="bk-pub">${esc([b.pub, b.y].filter(Boolean).join(' · '))}</p>
        ${badges ? `<p class="bk-badges">${badges}</p>` : ''}
        ${b.note ? `<p class="bk-note">${esc(T(b.note))}</p>` : ''}
        ${b.shelf?.series ? `<p><a class="sh-btn" href="${esc(linkFor(b.url))}">${L('翻开这一章', 'Open this chapter')} <i class="ico-ext ico-right" aria-hidden="true"></i></a></p>` : ''}
        ${from ? `<div class="bk-from"><h3>${L('站内推荐它的地方', 'Recommended on this site in')}</h3><ul>${from}</ul></div>` : ''}
        ${ident ? `<p class="bk-ids">${ident}</p>` : ''}${findLinks}
        <div class="bk-mine">
          <div class="bk-status" role="group" aria-label="${L('读到哪了', 'Reading status')}">${C.STATUS.map((s) => `<button type="button" data-status="${s}" aria-pressed="${it.s === s}">${esc(SN(s))}</button>`).join('')}</div>
          <div class="bk-stars" role="group" aria-label="${L('评分', 'Rating')}">${stars}</div>
          <label class="bk-notes"><span>${L('我的笔记', 'My notes')}</span><textarea id="bk-note" rows="3" maxlength="${C.MAX_NOTE}" placeholder="${L('读到第几章、哪里好、哪里卡住……只存在你这里。', 'Where you are, what is good, where you got stuck… kept only for you.')}">${esc(it.n || '')}</textarea></label>
          <div class="bk-acts">
            ${mine ? `<button type="button" class="sh-btn ghost" data-act="unshelve">${b.own ? L('从书架上删掉', 'Remove this book') : L('从我的书架拿下来', 'Take off my shelf')}</button>` : `<button type="button" class="sh-btn" data-act="shelve">${L('放上我的书架', 'Put on my shelf')}</button>`}
            ${mine && ui.tab === 'mine' && state.order.length > 1 ? `<button type="button" class="sh-btn ghost" data-move="-1" aria-label="${L('往左挪', 'Move left')}"><i class="ico-ext ico-left" aria-hidden="true"></i> ${L('往左挪', 'Left')}</button><button type="button" class="sh-btn ghost" data-move="1" aria-label="${L('往右挪', 'Move right')}">${L('往右挪', 'Right')} <i class="ico-ext ico-right" aria-hidden="true"></i></button>` : ''}
          </div>
        </div>
      </div>`;
  }
  function openBook(id, fromEl) {
    const b = book(id);
    if (!b) return;
    if (!openId) lastFocus = fromEl || document.activeElement;
    openId = id;
    box.innerHTML = bookDetail(b);
    box.dataset.series = b.shelf?.series ? '1' : '';
    if (dlg.hidden) { dlg.hidden = false; document.documentElement.classList.add('sh-lock'); requestAnimationFrame(() => dlg.classList.add('on')); }
    try { history.replaceState(null, '', '#b-' + id); } catch { /* file:// */ }
    box.focus({ preventScroll: true });
    const note = document.getElementById('bk-note');
    note.oninput = () => { clearTimeout(noteTimer); noteTimer = setTimeout(() => { save(C.setNote(state, openId, note.value)); syncBar(); }, 400); };
    tilt();
  }
  function closeBook() {
    if (!openId) return;
    const note = document.getElementById('bk-note');
    if (note) { clearTimeout(noteTimer); const cur = state.items[openId]?.n || ''; if (note.value.trim() !== cur) save(C.setNote(state, openId, note.value)); }
    const id = openId;
    openId = null;
    dlg.classList.remove('on');
    document.documentElement.classList.remove('sh-lock');
    setTimeout(() => { if (!openId) { dlg.hidden = true; box.innerHTML = ''; } }, reduce ? 0 : 220);
    try { history.replaceState(null, '', location.pathname + location.search + (ui.tab === 'mine' ? '#mine' : '')); } catch { /* ignore */ }
    draw();
    const back = body.querySelector(`.sp-slot[data-id="${CSS.escape(id)}"] button`);
    (back || lastFocus)?.focus?.({ preventScroll: true });
  }
  function refreshBook() { if (!openId) return; const y = box.scrollTop; openBook(openId); box.scrollTop = y; document.getElementById('bk3d')?.classList.remove('pull'); }
  // 跟着指针稍微转一点书（电脑上）
  function tilt() {
    const stage = box.querySelector('.bk-stage'), bk = document.getElementById('bk3d');
    if (!stage || !bk || reduce || !matchMedia('(hover: hover)').matches) return;
    stage.onpointermove = (e) => { const r = stage.getBoundingClientRect(); bk.style.setProperty('--ty', ((e.clientX - r.left) / r.width - 0.5) * 26 + 'deg'); bk.style.setProperty('--tx', -((e.clientY - r.top) / r.height - 0.5) * 12 + 'deg'); };
    stage.onpointerleave = () => { bk.style.removeProperty('--ty'); bk.style.removeProperty('--tx'); };
  }

  dlg.addEventListener('click', (e) => {
    const t = e.target.closest('button, .sh-dlg-back');
    if (!t) return;
    if (t.dataset.act === 'close') return closeBook();
    if (t.dataset.step) { const ids = visibleIds(), k = ids.indexOf(openId) + +t.dataset.step; if (ids[k]) openBook(ids[k]); return; }
    if (t.dataset.status) { const cur = state.items[openId]?.s; save(C.setStatus(state, openId, cur === t.dataset.status ? '' : t.dataset.status)); return refreshBook(); }
    if (t.dataset.rate) { const cur = state.items[openId]?.r; save(C.setRating(state, openId, cur === +t.dataset.rate ? 0 : +t.dataset.rate)); return refreshBook(); }
    if (t.dataset.act === 'shelve') { save(C.addToMine(state, openId)); return refreshBook(); }
    if (t.dataset.act === 'unshelve') {
      const own = openId.startsWith('u-');
      save(C.removeFromMine(state, openId));
      if (own) return closeBook();
      return refreshBook();
    }
    if (t.dataset.move) { save(C.moveBy(state, openId, +t.dataset.move)); draw(); return refreshBook(); }
  });
  dlg.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); closeBook(); return; }
    if ((e.key === 'ArrowLeft' || e.key === 'ArrowRight') && !e.target.closest('textarea, input')) {
      const ids = visibleIds(), k = ids.indexOf(openId) + (e.key === 'ArrowLeft' ? -1 : 1);
      if (ids[k]) { e.preventDefault(); openBook(ids[k]); }
      return;
    }
    if (e.key === 'Tab') { // 焦点留在对话框里
      const f = [...box.querySelectorAll('button:not([disabled]), a[href], textarea, input')];
      if (!f.length) return;
      const first = f[0], last = f[f.length - 1];
      if (e.shiftKey && (document.activeElement === first || document.activeElement === box)) { e.preventDefault(); last.focus(); } else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    }
  });

  // ── 工具栏和书架上的点击
  app.addEventListener('click', (e) => {
    const t = e.target.closest('button');
    if (!t) return;
    if (t.dataset.tab) { setTab(t.dataset.tab); return; }
    if (t.dataset.view) { ui.view = t.dataset.view; saveUi(); draw(); return; }
    if (t.dataset.filter) { ui.filter = ui.filter === t.dataset.filter && t.dataset.filter !== 'all' ? 'all' : t.dataset.filter; draw(); return; }
    if (t.dataset.go) { if (t.dataset.go === 'mine') setTab('mine'); else { ui.filter = t.dataset.go; setTab('mine'); } return; }
    if (t.dataset.act === 'bib') return exportBib();
    if (t.dataset.act === 'manual') { manual = manual ? null : { t: '' }; addMsg = ''; draw(); document.querySelector('#sh-manual [name=t]')?.focus(); return; }
    if (t.dataset.act === 'manual-x') { manual = null; addMsg = ''; draw(); return; }
    if (t.dataset.add != null) { const b = addResults[+t.dataset.add]; if (b) put(b); return; }
    if (t.dataset.id && !dragJustEnded) openBook(t.dataset.id, t);
  });
  app.addEventListener('keydown', (e) => {
    const tab = e.target.closest('[role=tab]');
    if (tab && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); setTab(ui.tab === 'site' ? 'mine' : 'site'); app.querySelector(`[data-tab="${ui.tab}"]`).focus(); return; }
    const sp = e.target.closest('.sp-slot[data-id] button');
    if (sp && ui.tab === 'mine' && e.altKey && e.shiftKey && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) {
      e.preventDefault();
      const id = sp.dataset.id;
      save(C.moveBy(state, id, e.key === 'ArrowLeft' ? -1 : 1)); draw();
      body.querySelector(`.sp-slot[data-id="${CSS.escape(id)}"] button`)?.focus();
    }
  });
  function setTab(tab) {
    ui.tab = tab; saveUi();
    if (tab === 'site' && ['reading', 'want', 'done', 'noted'].includes(ui.filter) && !Object.keys(state.items).length) ui.filter = 'all';
    try { history.replaceState(null, '', location.pathname + location.search + (tab === 'mine' ? '#mine' : '')); } catch { /* ignore */ }
    firstPaint = true; draw();
  }
  let qTimer = 0;
  qBox.addEventListener('input', () => { clearTimeout(qTimer); qTimer = setTimeout(() => { ui.q = qBox.value; draw(); }, 120); });

  // ── 我的书架：拖动换位（鼠标拖动 6 px 起，触屏按住 0.4 秒起）
  let drag = null, dragJustEnded = false;
  body.addEventListener('pointerdown', (e) => {
    if (ui.tab !== 'mine' || e.button > 0) return;
    const slot = e.target.closest('.sp-slot[data-id]');
    if (!slot) return;
    drag = { slot, id: slot.dataset.id, x: e.clientX, y: e.clientY, on: false, pid: e.pointerId, touch: e.pointerType !== 'mouse', timer: 0 };
    if (drag.touch) drag.timer = setTimeout(() => startDrag(), 400);
  });
  function startDrag() {
    if (!drag || drag.on) return;
    drag.on = true;
    drag.slot.classList.add('dragging');
    body.classList.add('is-dragging');
    try { drag.slot.setPointerCapture(drag.pid); } catch { /* ignore */ }
    if (navigator.vibrate && drag.touch) try { navigator.vibrate(8); } catch { /* ignore */ }
  }
  body.addEventListener('pointermove', (e) => {
    if (!drag) return;
    const dx = e.clientX - drag.x, dy = e.clientY - drag.y;
    if (!drag.on) {
      if (drag.touch) { if (Math.hypot(dx, dy) > 10) { clearTimeout(drag.timer); drag = null; } return; }
      if (Math.hypot(dx, dy) < 6) return;
      startDrag();
    }
    e.preventDefault();
    drag.slot.style.transform = `translate(${dx}px, ${dy}px) rotate(${Math.max(-8, Math.min(8, dx / 30))}deg)`;
    drag.slot.style.pointerEvents = 'none';
    const under = document.elementFromPoint(e.clientX, e.clientY)?.closest('.sp-slot[data-id]');
    body.querySelectorAll('.drop-l,.drop-r').forEach((x) => x.classList.remove('drop-l', 'drop-r'));
    drag.target = null;
    if (under && under !== drag.slot) {
      const r = under.getBoundingClientRect();
      const after = e.clientX > r.left + r.width / 2;
      under.classList.add(after ? 'drop-r' : 'drop-l');
      drag.target = { id: under.dataset.id, after };
    }
  }, { passive: false });
  function endDrag() {
    if (!drag) return;
    clearTimeout(drag.timer);
    const d = drag; drag = null;
    if (!d.on) return;
    dragJustEnded = true; setTimeout(() => { dragJustEnded = false; }, 60);
    body.classList.remove('is-dragging');
    if (d.target) {
      const without = state.order.filter((x) => x !== d.id);
      let to = without.indexOf(d.target.id) + (d.target.after ? 1 : 0);
      save(C.moveTo(state, d.id, to));
    }
    draw();
    flash(d.id);
  }
  body.addEventListener('pointerup', endDrag);
  body.addEventListener('pointercancel', endDrag);
  body.addEventListener('contextmenu', (e) => { if (drag?.touch) e.preventDefault(); });

  // ── 别的标签页（或云同步）改了存档
  window.addEventListener('storage', (e) => { if (e.key === C.KEY) { state = load(); draw(); if (openId) refreshBook(); } });

  // ── 地址：#mine 打开我的书架，#b-<id> 打开一本书
  const h = decodeURIComponent(location.hash.slice(1));
  if (h === 'mine') ui.tab = 'mine';
  if (h.startsWith('b-') && !CAT.books[h.slice(2)] && state.order.includes(h.slice(2))) ui.tab = 'mine';
  draw();
  if (h.startsWith('b-') && book(h.slice(2))) openBook(h.slice(2));
  window.addEventListener('hashchange', () => {
    const k = decodeURIComponent(location.hash.slice(1));
    if (k === 'mine' && ui.tab !== 'mine') { if (openId) closeBook(); setTab('mine'); }
    else if (k.startsWith('b-') && k.slice(2) !== openId && book(k.slice(2))) openBook(k.slice(2));
    else if (!k && openId) closeBook();
  });
  document.body.classList.add('js-ready');
  window.MolAstriaShelf = { state: () => state, open: openBook, close: closeBook };
})();
