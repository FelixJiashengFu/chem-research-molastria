/* 最近更新的面板：一张浮在页面上的玻璃卡片，列出最近上线的新栏目和新功能。
   每一行：图标、名字、日期、进度圈（读过几章，或者打开过没有）、一行说明和“更多”；顶上一行是“全部标为已看”和还没看的条数。
   由 shared-nav.js 在点账号面板的“最近更新”、页脚的“更新记录”、地址带 ?updates=1 或首页每一版第一次打开时载入。
   数据在 updates-data.js，逻辑在 updates-core.js。文字自带中英两版，整张卡片 translate="no"。 */
(() => {
  if (window.MolAstriaUpdates) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const C = window.MOLASTRIA_UPDATES_CORE;
  const DATA = window.MOLASTRIA_UPDATES || { items: [] };
  const items = DATA.items.slice().sort((a, b) => (a.date < b.date ? 1 : a.date > b.date ? -1 : 0));
  const base = window.__CHEM_LINK__ ? new URL(window.__CHEM_LINK__('')) : new URL('..', document.currentScript.src);
  const link = (p) => String(new URL(p, base));
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const T = (pair) => (Array.isArray(pair) ? (en ? pair[1] : pair[0]) : pair);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const read = (k) => { try { return JSON.parse(localStorage.getItem(k) || 'null'); } catch { return null; } };
  const state = () => C.migrate(read(C.KEY));
  const save = (s) => { try { localStorage.setItem(C.KEY, JSON.stringify(s)); } catch { /* 存不了就只是每次都算新的 */ } };
  const changed = () => window.dispatchEvent(new CustomEvent('molastria:updates'));

  const GROUP = { find: ['发现', 'Discover'], learn: ['学习', 'Learn'], explore: ['探索', 'Explore'], models: ['模型与 AI', 'Models & AI'], make: ['工具', 'Tools'] };
  // 每条一枚自己画的小图（24 × 24 的线稿，白色画在分组颜色的底上）
  const ICONS = {
    world: '<circle cx="11" cy="13" r="6.5"/><path d="M4.5 13h13M11 6.5c-2.2 1.8-2.2 11.2 0 13M11 6.5c2.2 1.8 2.2 11.2 0 13"/><path d="M15.5 3.5c2.6.4 4.6 2.4 5 5M18.8 3.2l-3.3.3.6 3"/>',
    key: '<circle cx="8" cy="12" r="3.5"/><path d="M11.5 12H20M17 12v3M20 12v2.5"/>',
    extract: '<path d="M6 3.5h8l4 4v13H6z"/><path d="M14 3.5v4h4"/><path d="M12 10.5l2.2 1.3v2.5L12 15.6l-2.2-1.3v-2.5z"/><path d="M8.5 18h7"/>',
    loop: '<path d="M7 8.5a5 5 0 0 1 8.6-1.2M17 15.5a5 5 0 0 1-8.6 1.2"/><path d="M15.8 4.5v3h-3M8.2 19.5v-3h3"/><circle cx="12" cy="12" r="1.3"/>',
    page: '<path d="M5 5.5h6.5v13H5z"/><path d="M12.5 5.5c2.5 0 5 .8 6.5 2.5v10.5c-1.5-1.7-4-2.5-6.5-2.5"/><path d="M7 9h2.5M7 12h2.5"/>',
    nmr: '<path d="M3.5 18.5h17"/><path d="M5 18.5c1.5 0 1.7-9 2.5-9s1 9 2.5 9 1.3-4 2-4 .8 4 2 4 1.5-12 2.3-12 1 12 2.7 12"/>',
    md: '<circle cx="8" cy="9" r="2.3"/><circle cx="16" cy="8" r="1.7"/><circle cx="14.5" cy="16" r="2.6"/><path d="M4 4.5h16v15H4z"/>',
    tensor: '<circle cx="5.5" cy="12" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="18.5" cy="12" r="2"/><path d="M7.5 12h2.5M14 12h2.5M5.5 14v4M12 14v4M18.5 14v4"/>',
    light: '<path d="M3.5 12h3c1.2-4 2.4-4 3.6 0s2.4 4 3.6 0 2.4-4 3.6 0"/><path d="m17 8 3-3M17.5 12h3M17 16l3 3"/>',
    field: '<circle cx="8" cy="12" r="2"/><circle cx="16" cy="12" r="2"/><path d="M10 12h4"/><path d="M9.2 10.3C10.5 7 13.5 7 14.8 10.3M9.2 13.7C10.5 17 13.5 17 14.8 13.7"/><path d="M8.5 9.5C10 4 14 4 15.5 9.5M8.5 14.5C10 20 14 20 15.5 14.5"/>',
    graph: '<circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="12" cy="17.5" r="2"/><path d="M8 7h8M7 8.8l4 7M17 8.8l-4 7"/>',
    barrier: '<path d="M3.5 18c3 0 3.5-2.5 5-6.5S11 5 12 5s2 2.5 3.5 6.5 1.5 4 5 4"/><path d="M3.5 20h17"/><circle cx="12" cy="5" r="1.2"/>',
    density: '<circle cx="12" cy="12" r="2"/><circle cx="12" cy="12" r="5" stroke-dasharray="2 2.2"/><circle cx="12" cy="12" r="8.2" stroke-dasharray="1.2 3"/>',
    spins: '<path d="M6 16V8M6 8 4.3 9.8M6 8l1.7 1.8M12 8v8M12 16l-1.7-1.8M12 16l1.7-1.8M18 16V8M18 8l-1.7 1.8M18 8l1.7 1.8"/><path d="M3.5 19.5h17"/>',
    symmetry: '<path d="M12 3.5 19.5 16.5h-15Z"/><path d="M12 3.5v13M12 11.5 4.5 16.5M12 11.5l7.5 5" stroke-dasharray="1.6 1.8"/>',
    wave: '<path d="M3 12c1.5 0 1.5-5 3-5s1.5 10 3 10 1.5-10 3-10 1.5 10 3 10 1.5-10 3-10 1.5 5 3 5"/>',
    atoms: '<circle cx="12" cy="12" r="2.4"/><circle cx="5.5" cy="6.5" r="1.6"/><circle cx="18.5" cy="7" r="1.6"/><circle cx="17" cy="18.5" r="1.6"/><path d="m7 7.8 3.2 2.6M17.2 8l-3.3 2.6M15.9 17.1l-2.4-3.3"/><path d="M12 9.6V6M12 6l-1.2 1.2M12 6l1.2 1.2"/>',
    lens: '<path d="M12 4c2 2.4 2 13.6 0 16-2-2.4-2-13.6 0-16Z"/><path d="M3 8.5 12 12l9-3.5M3 15.5l9-3.5 9 3.5"/>',
    crystal: '<path d="M12 3.5 19 7.5v9l-7 4-7-4v-9Z"/><path d="M12 3.5v8.5m0 0 7-4.5M12 12l-7-4.5M12 12v8.5"/>',
  };
  const svg = (inner, cls = '') => `<svg class="${cls}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${inner}</svg>`;
  const chevL = svg('<path d="m14.5 5.5-6.5 6.5 6.5 6.5"/>');
  const cross = svg('<path d="m6.5 6.5 11 11M17.5 6.5l-11 11"/>');

  // 进度圈：灰色的轨道，金色的弧；满了画一个对勾
  const ring = (p) => {
    const r = 10.5, c = 2 * Math.PI * r, full = p.frac >= 1;
    const tip = p.total > 1 ? L(`已读 ${p.done} / ${p.total} 章`, `${p.done} of ${p.total} chapters read`) : p.frac ? L('打开过', 'Opened') : L('还没打开', 'Not opened yet');
    return `<span class="up-ring${full ? ' up-full' : ''}" role="img" aria-label="${esc(tip)}" title="${esc(tip)}"><svg viewBox="0 0 28 28" aria-hidden="true"><circle class="up-ring-track" cx="14" cy="14" r="${r}"/>`
      + (p.frac > 0 ? `<circle class="up-ring-arc" cx="14" cy="14" r="${r}" stroke-dasharray="${(c * Math.min(1, p.frac)).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 14 14)"/>` : '')
      + (full ? '<path class="up-ring-tick" d="m9.5 14.3 3 3 6-6.3"/>' : '')
      + '</svg></span>';
  };

  let scrim = null, sheet = null, opener = null, onBack = null;

  function row(x, s, now) {
    const p = C.progress(x, s, read);
    const fresh = C.isNew(x, s, p);
    const href = link(x.path);
    return `<li class="up-row" data-id="${esc(x.id)}">`
      + `<div class="up-top"><a class="up-tile" href="${href}" data-g="${esc(x.group)}" tabindex="-1" aria-hidden="true">${svg(ICONS[x.icon] || ICONS.page)}</a>`
      + `<a class="up-name" href="${href}"><b>${fresh ? `<i class="up-new" aria-label="${L('新', 'New')}"></i>` : ''}${esc(en ? x.en : x.zh)}</b><small>${esc(T(GROUP[x.group] || ['', '']))}${p.total > 1 ? ` · ${esc(L(`已读 ${p.done} / ${p.total} 章`, `${p.done} of ${p.total} chapters read`))}` : x.store ? ` · ${esc(p.frac ? L('读过这一章', 'Chapter read') : L('新的一章', 'New chapter'))}` : ''}</small></a>`
      + ring(p) + '</div>'
      + `<p class="up-note"><span>${esc(T(x.note))}</span><button type="button" class="up-more" aria-expanded="false" aria-controls="up-m-${esc(x.id)}">${L('更多', 'more')}</button></p>`
      + `<div class="up-more-box" id="up-m-${esc(x.id)}" hidden><p>${esc(T(x.more))}</p><a class="up-go" href="${href}">${L('打开看看', 'Take a look')}<i class="ico-ext ico-right" aria-hidden="true"></i></a></div>`
      + '</li>';
  }

  function paint() {
    const s = state(), now = Date.now();
    const n = C.newCount(items, s, read);
    const body = sheet.querySelector('.up-body');
    const keepOpen = new Set([...body.querySelectorAll('.up-more[aria-expanded="true"]')].map((b) => b.closest('.up-row').dataset.id));
    body.innerHTML = `<div class="up-all"><button type="button" class="up-all-btn"${n ? '' : ' disabled'}>${n ? L('全部标为已看', 'Mark all as seen') : L('都看过了', 'All caught up')}</button><span class="up-all-n" aria-label="${esc(L(`还有 ${n} 条没看`, `${n} not seen yet`))}">${n}</span></div>`
      + C.byDay(items).map((g) => {
        const day = C.relDay(g.date, now), [, m, d] = g.date.split('-').map(Number);
        const exact = L(`${m} 月 ${d} 日`, `${['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'][m - 1]} ${d}`);
        const label = en ? day.en : day.zh;
        return `<section class="up-day"><h3>${esc(label)}${label === exact ? '' : `<small>${esc(exact)}</small>`}</h3><ul class="up-card">${g.items.map((x) => row(x, s, now)).join('')}</ul></section>`;
      }).join('')
      + `<p class="up-foot">${L('这里只列新栏目和大的新功能；每一处小改动都在', 'Only new sections and bigger features are listed here; every small change is in the')} <a href="https://github.com/FelixJiashengFu/chem-research-molastria/commits/main" target="_blank" rel="noopener noreferrer">${L('GitHub 的提交记录', 'GitHub commit history')}</a>${L('里。', '.')}</p>`;
    keepOpen.forEach((id) => { const b = body.querySelector(`.up-row[data-id="${CSS.escape(id)}"] .up-more`); if (b) toggle(b, true); });
  }

  function toggle(btn, open) {
    const box = btn.closest('.up-row').querySelector('.up-more-box');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? L('收起', 'less') : L('更多', 'more');
    box.hidden = !open;
  }

  function build() {
    scrim = document.createElement('div');
    scrim.className = 'up-scrim';
    scrim.hidden = true;
    scrim.innerHTML = `<div class="up-sheet" tabindex="-1" role="dialog" aria-modal="true" aria-labelledby="up-title" translate="no">`
      + `<header class="up-head"><button type="button" class="up-round up-back" aria-label="${L('返回账号面板', 'Back to the account panel')}">${chevL}</button>`
      + `<h2 id="up-title">${L('最近更新', 'What’s new')}</h2>`
      + `<button type="button" class="up-round up-x" aria-label="${L('关闭', 'Close')}">${cross}</button></header>`
      + '<div class="up-body"></div></div>';
    document.body.append(scrim);
    sheet = scrim.querySelector('.up-sheet');
    scrim.addEventListener('click', (e) => {
      if (e.target === scrim) { close(); return; }
      if (e.target.closest('.up-x')) { close(); return; }
      if (e.target.closest('.up-back')) { const back = onBack; close(false); back?.(); return; }
      const more = e.target.closest('.up-more');
      if (more) { toggle(more, more.getAttribute('aria-expanded') !== 'true'); return; }
      if (e.target.closest('.up-all-btn')) {
        save(C.ackAll(items, state()));
        paint();
        changed();
        sheet.querySelector('.up-all-btn')?.focus();
        return;
      }
      // 同一页里的链接（首页图册）：关掉再跳
      if (e.target.closest('a[href]')) close(false);
    });
    scrim.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); close(); return; }
      if (e.key !== 'Tab') return;
      const list = [...sheet.querySelectorAll('a[href]:not([tabindex="-1"]), button:not([disabled])')].filter((el) => el.offsetParent !== null);
      if (!list.length) return;
      const first = list[0], last = list[list.length - 1];
      if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
      else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
    });
  }

  function open(opts = {}) {
    if (!scrim) build();
    opener = opts.opener || document.activeElement;
    onBack = typeof opts.onBack === 'function' ? opts.onBack : null;
    sheet.querySelector('.up-back').hidden = !onBack;
    paint();
    save(C.markOpened(items, state()));
    changed();
    if (!scrim.hidden) return;
    scrim.hidden = false;
    document.documentElement.classList.add('up-lock');
    sheet.querySelector('.up-body').scrollTop = 0;
    if (reduced()) scrim.classList.add('open');
    else requestAnimationFrame(() => requestAnimationFrame(() => scrim.classList.add('open')));
    (onBack ? sheet.querySelector('.up-back') : sheet).focus({ preventScroll: true });
  }

  function close(focusBack = true) {
    if (!scrim || scrim.hidden) return;
    scrim.classList.remove('open');
    document.documentElement.classList.remove('up-lock');
    const done = () => { if (!scrim.classList.contains('open')) scrim.hidden = true; };
    if (reduced()) done(); else setTimeout(done, 260);
    if (focusBack && opener && opener.isConnected) opener.focus?.({ preventScroll: true });
  }

  window.MolAstriaUpdates = { open, close, isOpen: () => !!scrim && !scrim.hidden, items };
})();
