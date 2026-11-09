/* Shared header for every module: navigation, light/dark switch and the AI assistant entry.
   Paths work on disk, under any hosting subdirectory, and inside the single-file build. */
(() => {
  const script = document.currentScript;
  const base = window.__CHEM_LINK__ ? new URL(window.__CHEM_LINK__('')) : new URL('.', script.src);
  const link = (path) => String(new URL(path, base));
  const section = document.body.dataset.section || 'search';
  const links = [
    ['search', 'index.html', '统一搜索'],
    ['network', 'hub/network.html', '网状查询'],
    ['manual', 'manual/index.html', '讲解手册'],
    ['videos', 'videos/index.html', '教学视频', true],
    ['atlas', 'atlas/index.html#resources', '数据库'],
    ['hub', 'hub/index.html', '论文与社区'],
    ['radar', 'radar/index.html', '预印本雷达'],
    ['research', 'research-atlas/index.html', '研究图谱', true],
    ['digest', 'digest/index.html', '每周精选', true],
    ['journals', 'journals/index.html', '期刊发表'],
    ['scimodels', 'scimodels/index.html', '科学大模型', true],
    ['lab', 'lab/index.html', 'AI 实验室'],
    ['meta', 'meta/index.html', 'Meta', true],
    ['models', 'models/index.html', '模型接口', true],
    ['qchem', 'qchem/index.html', '游乐场', true],
    ['fundamental', 'fundamental-science/index.html', '进一步基础科学发现', true],
    ['quantum', 'quantum/index.html', '量子嘉年华', true],
    ['train', 'train/index.html', '训练 Agent', true],
    ['agent', 'atlas/index.html#agent', 'Agent 工程']
  ];
  // Each person's order of the modules (see arrange below); modules added later keep their place after the one before them.
  const ORDER = 'molastria-nav-order';
  const ordered = (() => {
    let saved = null;
    try { saved = JSON.parse(localStorage.getItem(ORDER) || 'null'); } catch { /* private mode */ }
    if (!Array.isArray(saved) || !saved.length) return links;
    const rank = new Map(saved.map((id, i) => [id, i]));
    const out = links.filter(([id]) => rank.has(id)).sort((a, b) => rank.get(a[0]) - rank.get(b[0]));
    links.forEach((l, i) => { if (!rank.has(l[0])) out.splice(i ? out.indexOf(links[i - 1]) + 1 : 0, 0, l); });
    return out;
  })();
  // MolAstria mark: a benzene ring on an electron orbit, with a four-point star. Monochrome, inverts with the theme.
  const mark = '<svg class="cr-mark" viewBox="0 0 40 40" aria-hidden="true"><rect class="m-tile" width="40" height="40" rx="9"/><ellipse class="m-hair" cx="19" cy="21" rx="15" ry="5.6" transform="rotate(-28 19 21)"/><path class="m-line" d="M19 11.2 27.5 16.1v9.8L19 30.8l-8.5-4.9v-9.8Z"/><circle class="m-thin" cx="19" cy="21" r="4.9"/><circle class="m-dot" cx="5.7" cy="26" r="1.3"/><path class="m-star" d="M30.6 5.2c.45 2.9 1.5 3.95 4.4 4.4-2.9.45-3.95 1.5-4.4 4.4-.45-2.9-1.5-3.95-4.4-4.4 2.9-.45 3.95-1.5 4.4-4.4Z"/><circle class="m-dot" cx="35" cy="17.5" r=".7"/></svg>';
  const palette = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.2.2-2.4 1.5-2.4H17a4 4 0 0 0 4-4C21 7 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/></svg>';
  const moon = '<svg class="cr-theme-dark" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
  const sun = '<svg class="cr-theme-light" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
  const spark = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z"/><path d="M19 15.5c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z"/></svg>';
  const textSize = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5h10M8 5.5v13M13.5 11h7.5M17.25 11v7.5"/></svg>';
  const chevron = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 3.5 3 3 3-3"/></svg>';

  // Pro account summary cached by pay/account.js; signed-in Pro users go straight to their account page.
  const readAccount = () => { try { return localStorage.getItem('molastria-session') ? JSON.parse(localStorage.getItem('molastria-account') || 'null') : null; } catch { return null; } };
  const proHref = () => link(readAccount()?.pro ? 'pro/account.html' : 'pro/index.html');

  const nav = document.createElement('header');
  nav.className = 'cr-header';
  const en = document.documentElement.lang === 'en';
  nav.innerHTML = `<a class="cr-brand" href="${link('index.html')}" aria-label="MolAstria">${mark}<span><span class="cr-word">Mol<i>Astria</i></span><small>计算化学研究导航</small></span></a>`
    + `<nav class="cr-links" aria-label="全站导航">${ordered.map(([id, path, label, fresh]) => `<a href="${link(path)}" data-id="${id}" draggable="false">${label}${fresh ? '<span class="cr-new">新</span>' : ''}</a>`).join('')}`
    + `<div class="cr-more" hidden><button class="cr-more-btn" type="button" aria-expanded="false" aria-controls="cr-more-menu">更多${chevron}</button><div class="cr-more-menu" id="cr-more-menu" hidden></div></div>`
    + `<a class="cr-pro-link" href="${proHref()}" data-id="pro">Pro</a></nav>`
    + `<div class="cr-tools"><a class="cr-pro" href="${proHref()}" title="${readAccount()?.pro ? '我的 Pro 账号' : 'MolAstria Pro 与桌面版下载'}"><span>Pro</span></a><button class="cr-icon-btn cr-lang" type="button" id="cr-lang" lang="${en ? 'zh-CN' : 'en'}" aria-label="${en ? '切换到中文' : 'Switch to English'}" title="${en ? '切换到中文' : 'Switch to English'}" translate="no">${en ? '中' : 'EN'}</button>`
    + `<button class="cr-icon-btn" type="button" id="cr-disp" aria-label="${en ? 'Display: scale, text size and typeface' : '显示设置：缩放、字号与字体'}" title="${en ? 'Display' : '显示设置'}" aria-haspopup="dialog" aria-expanded="false" translate="no">${textSize}</button>`
    + `<button class="cr-icon-btn" type="button" id="cr-bg" aria-label="更换背景" title="更换背景" aria-haspopup="dialog" aria-expanded="false">${palette}</button>`
    + `<button class="cr-icon-btn" type="button" id="cr-theme" aria-label="切换浅色 / 深色">${moon}${sun}</button>`
    + `<button class="cr-ai-btn" type="button" id="cr-ai" aria-haspopup="dialog">${spark}<span class="cr-label">AI 助手</span><span class="cr-dot" aria-hidden="true"></span></button></div>`;
  document.body.prepend(nav);

  const row = nav.querySelector('.cr-links'), more = row.querySelector('.cr-more'), moreBtn = more.firstElementChild, menu = more.lastElementChild;
  const items = [...row.querySelectorAll(':scope > a:not(.cr-pro-link)')];
  const markCurrent = () => {
    const hash = (window.__CHEM_LOCATION__ || location).hash || '';
    const active = section === 'atlas' && hash.startsWith('#agent') ? 'agent' : section;
    nav.querySelectorAll('.cr-links a').forEach((a) => {
      if (a.dataset.id === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
    moreBtn.toggleAttribute('data-current', !!menu.querySelector('[aria-current]'));
  };
  // One row at every desktop width: links that do not fit move, in their order, into the "更多" menu.
  // Phones keep every link in the row and scroll it sideways.
  const phone = matchMedia('(max-width:760px)');
  const setMenu = (open) => { menu.hidden = !open; moreBtn.setAttribute('aria-expanded', String(open)); };
  const fits = () => {
    const shown = [...row.children].filter((el) => el.offsetWidth);
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    return shown.reduce((w, el) => w + el.getBoundingClientRect().width, gap * (shown.length - 1)) <= row.clientWidth + 0.5;
  };
  let navDragging = false; // while a module is lifted the row keeps its layout
  const fit = () => {
    if (navDragging) return;
    const open = !menu.hidden, focused = document.activeElement;
    items.forEach((a) => row.insertBefore(a, more));
    more.hidden = true;
    if (!phone.matches && !fits()) {
      more.hidden = false;
      for (let i = items.length - 1; i >= 0 && !fits(); i--) menu.prepend(items[i]);
    }
    setMenu(open && !more.hidden);
    // Moving a focused link drops its focus; give it back (or to the button when the link went into the closed menu).
    if (focused !== document.activeElement && row.contains(focused)) (focused.offsetWidth ? focused : moreBtn).focus({ preventScroll: true });
    markCurrent();
  };
  moreBtn.addEventListener('click', () => setMenu(menu.hidden));
  more.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !menu.hidden) { e.stopPropagation(); setMenu(false); moreBtn.focus(); } });
  more.addEventListener('focusout', (e) => { if (e.relatedTarget && !more.contains(e.relatedTarget)) setMenu(false); });
  menu.addEventListener('click', (e) => { if (e.target.closest('a')) setMenu(false); });
  document.addEventListener('click', (e) => { if (!more.contains(e.target)) setMenu(false); });
  fit();
  // Re-fit when the row's width changes, when English labels arrive and when web fonts finish loading.
  new ResizeObserver(fit).observe(row);
  document.addEventListener('chemhub:i18n', fit);
  document.fonts?.ready.then(fit);
  window.addEventListener('hashchange', markCurrent);
  // On phones the link row scrolls sideways: bring the current section into view.
  const current = row.querySelector('[aria-current]');
  if (current && row.scrollWidth > row.clientWidth) row.scrollLeft = Math.max(0, current.offsetLeft - (row.clientWidth - current.offsetWidth) / 2);

  // ── Brand notice (TRADEMARKS.md): one line under the page's footer, or after its content. Full-screen app pages skip it.
  {
    const legal = document.createElement('p');
    legal.className = 'cr-legal';
    legal.innerHTML = `© ${new Date().getFullYear()} MolAstria · <a href="${link('about/index.html')}">阿斯特赖亚科技（Morning Glory）旗下项目</a> · <span>由 Jiasheng Fu 运营；MolAstria 名称、徽标与吉祥物归 16513778 Canada Inc. 所有，保留所有权利；网站代码以 MIT 许可开源</span> · <a href="https://github.com/FelixJiashengFu/chem-research-molastria/blob/main/TRADEMARKS.md" target="_blank" rel="noopener noreferrer">品牌说明</a>`;
    const place = () => {
      if (document.body.matches('.radar-page, .atlas-page')) return;
      const foot = [...document.querySelectorAll('footer')].filter((f) => !f.closest('.cr-header, dialog, aside')).pop();
      // below the footer, not inside it: footers here are rows and grids of their own
      if (foot) foot.after(legal); else (document.querySelector('main') || document.body).append(legal);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', place, { once: true }); else place();
  }

  const saveOrder = (ids) => {
    const defaults = links.map(([id]) => id);
    try { if (ids.join() === defaults.join()) localStorage.removeItem(ORDER); else localStorage.setItem(ORDER, JSON.stringify(ids)); } catch { /* private mode */ }
    items.sort((a, b) => ids.indexOf(a.dataset.id) - ids.indexOf(b.dataset.id));
    fit();
  };

  // ── Arranging the modules: a long press on any of them without moving (or 显示 → 调整导航顺序) opens a glass panel where they are
  //    dragged, or moved with the arrow keys, into each person's order. Saved per browser; "恢复默认" goes back.
  const arrange = (() => {
    const t = (zh, e) => (en ? e : zh);
    const defaults = links.map(([id]) => id);
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    const label = (id) => { const l = links.find(([x]) => x === id)?.[2] ?? id; return en && window.ChemI18n?.t ? window.ChemI18n.t(l) : l; };
    let layer = null, grid = null, live = null, back = null, drag = null;
    const order = () => [...grid.children].map((el) => el.dataset.id);
    const save = saveOrder;
    // The other tiles glide to their new places (FLIP). Rect differences are turned into the tiles' own CSS pixels,
    // because page zoom scales getBoundingClientRect differently from transforms in Chrome and in WebKit.
    const flip = (mutate) => {
      const before = new Map([...grid.children].map((el) => [el, el.getBoundingClientRect()]));
      mutate();
      if (reduced()) return;
      for (const el of grid.children) {
        const a = before.get(el), b = el.getBoundingClientRect(), k = el.offsetWidth ? b.width / el.offsetWidth || 1 : 1;
        const dx = (a.left - b.left) / k, dy = (a.top - b.top) / k;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) continue;
        el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    };
    const say = (id) => {
      const ids = order(), n = ids.indexOf(id) + 1;
      live.textContent = t(`${label(id)}：第 ${n} 位，共 ${ids.length} 个`, `${label(id)}: position ${n} of ${ids.length}`);
    };
    const tile = (id, current) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cr-arr-tile';
      b.dataset.id = id;
      b.setAttribute('role', 'listitem');
      b.textContent = label(id);
      if (id === current) b.setAttribute('aria-current', 'page');
      return b;
    };
    function build() {
      layer = document.createElement('div');
      layer.className = 'cr-arrange';
      layer.hidden = true;
      layer.setAttribute('translate', 'no');
      layer.innerHTML = `<div class="cr-arr-glass" role="dialog" aria-modal="true" aria-labelledby="cr-arr-h">
        <div class="cr-arr-head"><b id="cr-arr-h">${t('调整导航顺序', 'Arrange the navigation')}</b><small>${t('拖动入口，排成你习惯的顺序；也可以用方向键。只保存在这台设备上。', 'Drag the modules into the order you like, or use the arrow keys. Saved on this device only.')}</small></div>
        <div class="cr-arr-grid" role="list" aria-label="${t('导航入口', 'Modules')}"></div>
        <p class="cr-arr-live" aria-live="polite"></p>
        <div class="cr-arr-foot"><small>${t('在顶栏上也能直接拖动入口换位置；按住一个入口不动再松开，会回到这里', 'You can also drag the modules right in the header; press and hold one, then let go, to come back here')}</small><button type="button" class="cr-arr-reset">${t('恢复默认', 'Reset')}</button><button type="button" class="cr-arr-done">${t('完成', 'Done')}</button></div></div>`;
      document.body.append(layer);
      grid = layer.querySelector('.cr-arr-grid');
      live = layer.querySelector('.cr-arr-live');
      layer.addEventListener('click', (e) => {
        if (e.target === layer || e.target.closest('.cr-arr-done')) close();
        else if (e.target.closest('.cr-arr-reset')) { flip(() => grid.append(...defaults.map((id) => grid.querySelector(`[data-id="${id}"]`)).filter(Boolean))); save(order()); live.textContent = t('已恢复默认顺序', 'Default order restored'); }
      });
      layer.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
        if (e.key === 'Tab') { // keep focus inside the panel
          const f = [...layer.querySelectorAll('button')], i = f.indexOf(document.activeElement);
          if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
          return;
        }
        const el = e.target.closest?.('.cr-arr-tile'), k = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1, Home: -999, End: 999 }[e.key];
        if (!el || !k) return;
        e.preventDefault();
        const kids = [...grid.children], i = kids.indexOf(el), j = Math.max(0, Math.min(kids.length - 1, i + k));
        if (i === j) return;
        flip(() => grid.insertBefore(el, j > i ? kids[j].nextSibling : kids[j]));
        el.focus();
        save(order());
        say(el.dataset.id);
      });
      // Dragging: the list holds the pointer; the tile under it says where the lifted one goes. After a swap that
      // tile is left alone until the pointer moves on, so tiles of different widths do not flip back and forth.
      grid.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('.cr-arr-tile');
        if (!el || e.button > 0) return;
        e.preventDefault();
        grid.setPointerCapture(e.pointerId);
        drag = { tile: el, id: e.pointerId, x: e.clientX, y: e.clientY, moved: false, last: null };
      });
      grid.addEventListener('pointermove', (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        if (!drag.moved) {
          if (Math.hypot(e.clientX - drag.x, e.clientY - drag.y) < 4) return;
          drag.moved = true;
          drag.tile.classList.add('lifted');
          layer.classList.add('dragging');
        }
        const over = document.elementFromPoint(e.clientX, e.clientY)?.closest?.('.cr-arr-tile');
        if (!over || over === drag.tile) { if (over) drag.last = null; return; }
        if (over === drag.last) return;
        const kids = [...grid.children], i = kids.indexOf(drag.tile), j = kids.indexOf(over);
        flip(() => grid.insertBefore(drag.tile, j > i ? over.nextSibling : over));
        drag.last = over;
      });
      const drop = (e) => {
        if (!drag || e.pointerId !== drag.id) return;
        const { tile: el, moved } = drag;
        drag = null;
        el.classList.remove('lifted');
        layer.classList.remove('dragging');
        if (moved) { save(order()); say(el.dataset.id); }
        el.focus({ preventScroll: true });
      };
      grid.addEventListener('pointerup', drop);
      grid.addEventListener('pointercancel', drop);
    }
    function open(id) {
      if (!layer) build();
      const current = nav.querySelector('.cr-links [aria-current]')?.dataset.id;
      grid.replaceChildren(...items.map((a) => tile(a.dataset.id, current)));
      back = document.activeElement;
      setMenu(false);
      layer.hidden = false;
      requestAnimationFrame(() => layer.classList.add('open'));
      (grid.querySelector(`[data-id="${id}"]`) || grid.firstElementChild).focus({ preventScroll: true });
    }
    function close() {
      layer.classList.remove('open');
      setTimeout(() => { layer.hidden = true; }, reduced() ? 0 : 200);
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    }
    return { open };
  })();

  // ── Dragging the modules right in the header. A mouse picks a module up as soon as it moves sideways; a finger (and a
  //    held mouse) lifts it after a short press, so the row and the page still scroll under a quick swipe. The lifted module
  //    turns to glass and follows the pointer, the others slide aside, and the new order is saved like the panel's.
  //    Releasing a lifted module without moving it opens the arrange panel (which also reaches modules in "更多").
  const HOLD = 420;
  let press = null, pressed = false;
  const cancelPress = () => { if (press) clearTimeout(press.timer); press = null; };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rowLinks = () => [...row.children].filter((el) => el.matches('a[data-id]:not(.cr-pro-link)') && el.offsetWidth);
  function lift(p) {
    const els = rowLinks(), i = els.indexOf(p.a);
    if (i < 0) return false;
    const rr = row.getBoundingClientRect(), k = row.offsetWidth ? rr.width / row.offsetWidth || 1 : 1;
    // Layout positions in the row's own CSS pixels (scroll included), taken once: transforms during the drag do not move them.
    const at = (x) => (x - rr.left) / k + row.scrollLeft;
    const slots = els.map((el) => { const r = el.getBoundingClientRect(); return { el, mid: (at(r.left) + at(r.right)) / 2 }; });
    const gap = parseFloat(getComputedStyle(row).columnGap) || 0;
    p.drag = { els, i, j: i, k, at, slots, start: p.x, scroll0: row.scrollLeft, shift: p.a.offsetWidth + gap, moved: false, x: p.x, raf: 0 };
    navDragging = true;
    pressed = true;
    nav.classList.add('cr-nav-sorting');
    p.a.classList.add('cr-lifted');
    try { nav.setPointerCapture(p.id); } catch { /* pointer already gone */ }
    navigator.vibrate?.(8);
    return true;
  }
  function follow(p, x) {
    const d = p.drag;
    d.x = x;
    const dx = (x - d.start) / d.k + (row.scrollLeft - d.scroll0);
    if (Math.abs(dx) > 3) d.moved = true;
    p.a.style.translate = `${dx}px 0`;
    const mid = d.slots[d.i].mid + dx;
    let j = 0;
    d.slots.forEach((s, m) => { if (m !== d.i && s.mid < mid) j++; });
    d.j = j;
    d.slots.forEach((s, m) => {
      if (m === d.i) return;
      const off = d.i < j && m > d.i && m <= j ? -d.shift : j < d.i && m >= j && m < d.i ? d.shift : 0;
      s.el.style.translate = off ? `${off}px 0` : '';
    });
  }
  // Phones: the row scrolls sideways, so a module held near either edge scrolls it along.
  function edgeScroll(p) {
    const d = p.drag;
    if (!d || row.scrollWidth <= row.clientWidth) return;
    const r = row.getBoundingClientRect(), edge = 36 * d.k;
    const v = d.x < r.left + edge ? -7 : d.x > r.right - edge ? 7 : 0;
    if (v) { row.scrollLeft += v; follow(p, d.x); }
    d.raf = requestAnimationFrame(() => edgeScroll(p));
  }
  function settle(p, keep) {
    const d = p.drag;
    cancelAnimationFrame(d.raf);
    navDragging = false;
    const before = new Map(d.els.map((el) => [el, el.getBoundingClientRect()]));
    for (const el of d.els) { el.style.transition = 'none'; el.style.translate = ''; }
    p.a.classList.remove('cr-lifted');
    nav.classList.remove('cr-nav-sorting');
    if (keep && d.j !== d.i) {
      const ids = items.map((a) => a.dataset.id), moved = ids.splice(ids.indexOf(p.a.dataset.id), 1)[0];
      const order = d.els.map((el) => el.dataset.id);
      order.splice(d.i, 1);
      // after the j modules now left of it: before the next one in the row, or right after the row's last
      ids.splice(d.j < order.length ? ids.indexOf(order[d.j]) : ids.indexOf(order[order.length - 1]) + 1, 0, moved);
      saveOrder(ids);
    }
    // Everything glides from where it was shown to its new place.
    for (const el of d.els) {
      void el.offsetWidth;
      el.style.transition = '';
      if (reducedMotion()) continue;
      const a = before.get(el), b = el.getBoundingClientRect(), dx = (a.left - b.left) / d.k;
      if (Math.abs(dx) > 0.5) el.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.25,1.1)' });
    }
  }
  nav.addEventListener('pointerdown', (e) => {
    pressed = false;
    if (press?.drag) return;
    cancelPress();
    const a = e.target.closest('.cr-links a[data-id]:not(.cr-pro-link)');
    if (!a || e.button > 0) return;
    const p = { a, id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse', inMenu: !!a.closest('.cr-more-menu') };
    p.timer = setTimeout(() => {
      // modules inside "更多" have no row to slide along: holding one opens the panel
      if (p.inMenu || !lift(p)) { press = null; pressed = true; navigator.vibrate?.(8); arrange.open(a.dataset.id); }
      else edgeScroll(p);
    }, HOLD);
    press = p;
  });
  nav.addEventListener('pointermove', (e) => {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    if (p.drag) { e.preventDefault(); follow(p, e.clientX); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.hypot(dx, dy) < 6) return;
    // a mouse dragging sideways picks the module up at once; anything else before the hold ends is a scroll or a slip
    if (!p.touch && !p.inMenu && Math.abs(dx) > Math.abs(dy) && lift(p)) { clearTimeout(p.timer); follow(p, e.clientX); edgeScroll(p); }
    else cancelPress();
  });
  const release = (e) => {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    clearTimeout(p.timer);
    press = null;
    if (!p.drag) return;
    const moved = p.drag.moved;
    settle(p, e.type === 'pointerup');
    if (!moved && e.type === 'pointerup') arrange.open(p.a.dataset.id);
  };
  nav.addEventListener('pointerup', release);
  nav.addEventListener('pointercancel', release);
  nav.addEventListener('lostpointercapture', (e) => { if (press?.drag && e.pointerId === press.id) release({ type: 'pointerup', pointerId: e.pointerId }); });
  // Links are not dragged out as URLs (that is what made a drag do nothing), and a lifted module keeps the page from scrolling.
  nav.addEventListener('dragstart', (e) => { if (e.target.closest?.('.cr-links a[data-id]')) e.preventDefault(); });
  nav.addEventListener('touchmove', (e) => { if (press?.drag) e.preventDefault(); }, { passive: false });
  // the click that ends a press or a drag must not also open the page
  nav.addEventListener('click', (e) => { if (pressed) { pressed = false; e.preventDefault(); e.stopPropagation(); } }, true);
  // touch screens open their own link menu on a long press
  nav.addEventListener('contextmenu', (e) => { if ((press?.touch || pressed) && e.target.closest('a[data-id]')) e.preventDefault(); });

  // 主题：未手动选择时跟随系统；点击后在浅色 / 深色之间切换并记住。
  const root = document.documentElement;
  const isDark = () => root.dataset.theme ? root.dataset.theme === 'dark' : matchMedia('(prefers-color-scheme: dark)').matches;
  const announce = () => document.dispatchEvent(new CustomEvent('chemhub:theme', { detail: { dark: isDark() } }));
  nav.querySelector('#cr-theme').addEventListener('click', () => {
    root.dataset.theme = isDark() ? 'light' : 'dark';
    try { localStorage.setItem('chemhub-theme', root.dataset.theme); } catch {}
    announce();
  });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', () => { if (!root.dataset.theme) announce(); });
  nav.querySelector('#cr-bg').addEventListener('click', (e) => window.ChemBackdrop?.toggle(e.currentTarget));

  // 显示设置：界面缩放（整个页面）、正文字号（<main> 里的内容）、字体。每页 <head> 的小脚本先套用保存的值，避免页面跳一下。
  // 桌面版用 WebView 自己的缩放（Rust 命令 set_zoom，排版和浏览器缩放一样重新流动）；网站和 iPad 主屏幕应用用 CSS zoom。
  const DISPLAY = {
    zoom: [0.8, 0.9, 1, 1.1, 1.25, 1.4, 1.5],
    text: [0.9, 1, 1.1, 1.2, 1.3, 1.4],
    fonts: [['', '默认', 'Default', 'Inter,"Segoe UI","PingFang SC","Hiragino Sans GB","Microsoft YaHei",sans-serif'], ['system', '系统字体', 'System', 'system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif'],
      ['serif', '宋体（衬线）', 'Serif', '"Songti SC","Noto Serif SC","Source Han Serif SC",STSong,SimSun,Georgia,serif'], ['kai', '楷体', 'Kaiti', '"Kaiti SC",STKaiti,KaiTi,"Kaiti TC",serif']],
  };
  const desktopApp = !!(window.__MOLASTRIA_DESKTOP__ && window.__TAURI_INTERNALS__);
  const homeScreenApp = matchMedia('(display-mode: standalone)').matches || navigator.standalone === true;
  const store = { get: (k) => { try { return localStorage.getItem(k); } catch { return null; } }, set: (k, v) => { try { if (v === null) localStorage.removeItem(k); else localStorage.setItem(k, v); } catch {} } };
  const display = () => ({ zoom: Number(store.get('molastria-zoom')) || 1, text: Number(store.get('molastria-text')) || 1, font: store.get('molastria-font') || '' });
  // CSS zoom does not change the width that media queries see, so the page keeps its wide layout in less room. Cap the combined
  // factor to what this window holds: at least 520 px of layout on tablets and desktops, 330 px on phones. The desktop app's own
  // zoom does change that width, so there only the reading size counts. Saved choices stay; the shown values are the capped ones.
  const roomFor = () => { const w = innerWidth; return w >= 760 ? w / 520 : w / 330; };
  const below = (key, v) => { const list = DISPLAY[key], i = list.findIndex((x) => Math.abs(x - v) < 1e-6); return i > 0 ? list[i - 1] : v; };
  function effective(d = display()) {
    let z = d.zoom, t = d.text;
    const room = roomFor(), factor = () => (desktopApp ? t : z * t);
    while (factor() > room + 1e-9 && t > 1) t = below('text', t);
    while (!desktopApp && factor() > room + 1e-9 && z > 1) z = below('zoom', z);
    return { zoom: z, text: t, capped: z !== d.zoom || t !== d.text };
  }
  function applyDisplay() {
    const d = display(), e = effective(d);
    if (desktopApp) { root.style.zoom = ''; window.__TAURI_INTERNALS__.invoke('set_zoom', { value: d.zoom }).catch(() => { root.style.zoom = e.zoom === 1 ? '' : String(e.zoom); }); }
    else root.style.zoom = e.zoom === 1 ? '' : String(e.zoom);
    if (e.text === 1) root.style.removeProperty('--cr-text-zoom'); else root.style.setProperty('--cr-text-zoom', String(e.text));
    if (d.font) root.dataset.font = d.font; else delete root.dataset.font;
    displayFrames(e);
  }
  // Pages that show a whole app in a frame (PreprintRadar, QChem Web; marked data-display-frame): the frame cancels the page's
  // CSS zoom and the app is scaled inside its own document, which shares the site's origin. Engines differ on a zoomed frame:
  // Chrome lays the app out at the smaller width, WebKit (iPad Safari) at the full width and then clips it, so the page's zoom
  // must not reach the frame. In the desktop app the WebView's own zoom already scales frames; only the reading size goes inside.
  // Embedded apps (radar, qchem) live in iframes marked data-display-frame. CSS zoom does not reach into a frame the
  // same way in every engine (Chrome passes it in; WebKit, so iPad Safari, lays the app out at full width and clips
  // it), so the frame cancels the page's zoom and is scaled with a transform: its viewport is its box divided by the
  // factor, which media queries inside the app also see. The frame sits at the top left of a positioned box.
  function displayFrames(e = effective()) {
    for (const f of document.querySelectorAll('iframe[data-display-frame]')) {
      const outer = desktopApp ? 1 : e.zoom, k = outer * e.text, s = f.style, on = k !== 1;
      s.zoom = outer === 1 ? '' : String(1 / outer);
      s.width = s.height = on ? `${100 / k}%` : '';
      s.transform = on ? `scale(${k})` : '';
      s.transformOrigin = on ? '0 0' : '';
    }
  }
  let resizing = 0;
  addEventListener('resize', () => { cancelAnimationFrame(resizing); resizing = requestAnimationFrame(() => { applyDisplay(); renderDisplay(); }); });
  const pct = (v) => `${Math.round(v * 100)}%`;
  let dispPanel = null;
  const dispBtn = nav.querySelector('#cr-disp');
  function setDisplay(key, value) {
    store.set(`molastria-${key}`, value === 1 || value === '' ? null : String(value));
    applyDisplay();
    renderDisplay();
    placeDisplay();
  }
  function step(key, dir) {
    const list = DISPLAY[key], cur = display()[key];
    let i = list.findIndex((v) => Math.abs(v - cur) < 1e-6);
    if (i < 0) i = list.indexOf(1);
    setDisplay(key, list[Math.max(0, Math.min(list.length - 1, i + dir))]);
  }
  function renderDisplay() {
    if (!dispPanel) return;
    const d = display(), e = effective(d);
    for (const key of ['zoom', 'text']) {
      const list = DISPLAY[key], i = list.findIndex((v) => Math.abs(v - d[key]) < 1e-6);
      const next = list[i + 1], wouldFit = next !== undefined && !effective({ ...d, [key]: next }).capped;
      dispPanel.querySelector(`[data-out=${key}]`).textContent = pct(e[key]);
      dispPanel.querySelector(`[data-step=${key}][data-dir="-1"]`).disabled = i === 0;
      dispPanel.querySelector(`[data-step=${key}][data-dir="1"]`).disabled = !wouldFit;
      dispPanel.querySelector(`input[data-range=${key}]`).value = String(Math.max(0, list.findIndex((v) => Math.abs(v - e[key]) < 1e-6)));
    }
    const note = dispPanel.querySelector('.cr-disp-note');
    note.hidden = !e.capped;
    note.textContent = en ? `This window is too narrow for ${pct(d.zoom)} × ${pct(d.text)}; showing the largest that fits. A wider window gets your full setting back.` : `窗口太窄，放不下 ${pct(d.zoom)} × ${pct(d.text)}，先按能放下的最大值显示；窗口变宽后自动恢复你的设置。`;
    for (const b of dispPanel.querySelectorAll('[data-font-id]')) b.setAttribute('aria-pressed', String(b.dataset.fontId === d.font));
    dispPanel.querySelector('.cr-disp-reset').disabled = d.zoom === 1 && d.text === 1 && !d.font;
  }
  function buildDisplay() {
    const t = (zh, e) => (en ? e : zh);
    const stepper = (key, label, hint) => `<div class="cr-disp-row"><div><b>${label}</b><small>${hint}</small></div>
      <div class="cr-disp-step"><button type="button" data-step="${key}" data-dir="-1" aria-label="${t('缩小', 'Smaller')} ${label}">−</button><output data-out="${key}" aria-live="polite"></output><button type="button" data-step="${key}" data-dir="1" aria-label="${t('放大', 'Larger')} ${label}">+</button></div>
      <input type="range" data-range="${key}" min="0" max="${DISPLAY[key].length - 1}" step="1" aria-label="${label}"></div>`;
    dispPanel = document.createElement('div');
    dispPanel.className = 'cr-disp';
    dispPanel.setAttribute('role', 'dialog');
    dispPanel.setAttribute('aria-label', t('显示设置', 'Display settings'));
    dispPanel.setAttribute('translate', 'no');
    dispPanel.innerHTML = `<div class="cr-disp-head"><b>${t('显示', 'Display')}</b><button type="button" class="cr-disp-x" aria-label="${t('关闭', 'Close')}">×</button></div>
      ${stepper('zoom', t('界面缩放', 'Interface scale'), t('整个页面，包括顶栏', 'The whole page, header included'))}
      ${stepper('text', t('正文字号', 'Reading text size'), t('页面正文与内容区', 'Page content and text'))}
      <p class="cr-disp-note" role="status" hidden></p>
      <div class="cr-disp-fonts" role="group" aria-label="${t('字体', 'Typeface')}"><b>${t('字体', 'Typeface')}</b>
        ${DISPLAY.fonts.map(([id, zh, e, stack]) => `<button type="button" data-font-id="${id}" aria-pressed="false"><span style='font-family:${stack}'>${t(zh, e)}</span><i style='font-family:${stack}'>Aa 计算化学</i></button>`).join('')}</div>
      <div class="cr-disp-row cr-disp-arr-row"><div><b>${t('导航顺序', 'Navigation order')}</b><small>${t('把顶栏的入口排成你习惯的顺序；也可以长按任一入口', 'Put the header modules in your order; or press and hold any module')}</small></div><button type="button" class="cr-disp-arr">${t('调整', 'Arrange')}</button></div>
      <div class="cr-disp-foot">${desktopApp || homeScreenApp ? `<small>${t('快捷键：Ctrl / ⌘ 加 = − 0 调整界面缩放', 'Shortcuts: Ctrl / ⌘ with = − 0 change the interface scale')}</small>` : `<small>${t('设置保存在这台设备上，所有页面通用', 'Saved on this device for every page')}</small>`}<button type="button" class="cr-disp-reset">${t('恢复默认', 'Reset')}</button></div>`;
    document.body.append(dispPanel);
    dispPanel.addEventListener('click', (e) => {
      const s = e.target.closest('[data-step]'), f = e.target.closest('[data-font-id]');
      if (s) step(s.dataset.step, Number(s.dataset.dir));
      if (f) setDisplay('font', f.dataset.fontId);
      if (e.target.closest('.cr-disp-reset')) { for (const k of ['zoom', 'text', 'font']) store.set(`molastria-${k}`, null); applyDisplay(); renderDisplay(); }
      if (e.target.closest('.cr-disp-x')) closeDisplay(true);
      if (e.target.closest('.cr-disp-arr')) { closeDisplay(); arrange.open(); }
    });
    for (const r of dispPanel.querySelectorAll('input[data-range]')) r.addEventListener('input', () => setDisplay(r.dataset.range, DISPLAY[r.dataset.range][Number(r.value)]));
    document.addEventListener('pointerdown', (e) => { if (dispPanel.dataset.open === 'true' && !dispPanel.contains(e.target) && !dispBtn.contains(e.target)) closeDisplay(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && dispPanel.dataset.open === 'true') closeDisplay(true); });
    addEventListener('resize', placeDisplay);
  }
  function placeDisplay() {
    if (!dispPanel || dispPanel.dataset.open !== 'true') return;
    const r = dispBtn.getBoundingClientRect(), z = parseFloat(root.style.zoom) || 1;
    dispPanel.style.top = `${Math.round(r.bottom / z + 8)}px`;
    dispPanel.style.right = `${Math.max(8, Math.round(innerWidth / z - r.right / z))}px`;
    // Chrome multiplies the 100vh in the panel's max-height by the page zoom, so at 150 % it ran past the window:
    // shrink it to what is left below the button (measured, so it holds whatever the engine does with vh).
    dispPanel.style.maxHeight = '';
    const pr = dispPanel.getBoundingClientRect();
    if (pr.height && pr.bottom > innerHeight - 8) dispPanel.style.maxHeight = `${Math.max(160, Math.floor((dispPanel.offsetHeight * (innerHeight - 8 - pr.top)) / pr.height))}px`;
  }
  function openDisplay() {
    if (!dispPanel) buildDisplay();
    window.ChemBackdrop?.close?.();
    dispPanel.dataset.open = 'true';
    dispBtn.setAttribute('aria-expanded', 'true');
    renderDisplay();
    placeDisplay();
    dispPanel.querySelector('[data-step]:not(:disabled)')?.focus();
  }
  function closeDisplay(refocus) {
    if (!dispPanel) return;
    dispPanel.dataset.open = 'false';
    dispBtn.setAttribute('aria-expanded', 'false');
    if (refocus) dispBtn.focus();
  }
  dispBtn.addEventListener('click', () => (dispPanel?.dataset.open === 'true' ? closeDisplay() : openDisplay()));
  // In the desktop app and the home-screen app the browser's own zoom keys are missing: Ctrl / ⌘ with = − 0 change the scale.
  if (desktopApp || homeScreenApp) {
    document.addEventListener('keydown', (e) => {
      if (!(e.ctrlKey || e.metaKey) || e.altKey) return;
      if (e.key === '=' || e.key === '+') { e.preventDefault(); step('zoom', 1); }
      else if (e.key === '-' || e.key === '_') { e.preventDefault(); step('zoom', -1); }
      else if (e.key === '0') { e.preventDefault(); setDisplay('zoom', 1); }
    });
  }
  applyDisplay();
  window.MolAstriaDisplay = { open: openDisplay, close: closeDisplay, set: setDisplay, get: display };
  // Language: remembered per browser; the page reloads so every module renders once in the chosen language. What the
  // reader was looking at survives the reload: the address (embedded apps keep their view in it), the scroll position,
  // and the tabs, filters and search boxes on the page, which a reload would otherwise put back to their defaults.
  const RESTORE = 'molastria-lang-restore';
  const scope = () => document.querySelector('main') || document.body;
  const keyOf = (el) => {
    const attr = el.id ? ['id', el.id] : [...el.attributes].find((a) => a.name.startsWith('data-') && a.name !== 'data-display-frame')?.name;
    const sel = Array.isArray(attr) ? `#${CSS.escape(attr[1])}` : attr ? `${el.tagName.toLowerCase()}[${attr}="${CSS.escape(el.getAttribute(attr))}"]` : null;
    if (!sel) return null;
    return [sel, [...scope().querySelectorAll(sel)].indexOf(el)];
  };
  const find = ([sel, n]) => { try { return scope().querySelectorAll(sel)[n] || null; } catch { return null; } };
  const mine = (el) => !el.closest('.cr-header, .cr-arrange, [data-no-restore]');
  function snapshot() {
    const s = scope(), state = { url: location.href, y: scrollY, toggles: [], fields: [] };
    for (const el of s.querySelectorAll('[role=tab][aria-selected=true], [aria-pressed]')) {
      if (!mine(el)) continue;
      const k = keyOf(el);
      if (k) state.toggles.push({ k, pressed: el.getAttribute('aria-pressed') });
    }
    for (const el of s.querySelectorAll('input, select, textarea')) {
      if (!mine(el) || !el.id) continue;
      if (el.tagName === 'INPUT' && !/^(text|search|number|range|url)$/.test(el.type)) continue;
      const changed = el.tagName === 'SELECT' ? el.value !== ([...el.options].find((o) => o.defaultSelected) || el.options[0])?.value : el.value !== el.defaultValue;
      if (changed && el.value.length < 4000) state.fields.push({ k: keyOf(el), v: el.value });
    }
    return state;
  }
  function restore() {
    let state = null;
    try { state = JSON.parse(sessionStorage.getItem(RESTORE) || 'null'); sessionStorage.removeItem(RESTORE); } catch { return; }
    if (!state || state.url !== location.href) return;
    let toggles = state.toggles, fields = state.fields, tries = 0;
    const apply = () => {
      toggles = toggles.filter((t) => {
        const el = find(t.k);
        if (!el) return true;
        const on = t.pressed === null ? el.getAttribute('aria-selected') === 'true' : el.getAttribute('aria-pressed') === t.pressed;
        if (!on) el.click();
        return false;
      });
      fields = fields.filter((f) => {
        const el = find(f.k);
        if (!el) return true;
        if (el.tagName === 'SELECT' && ![...el.options].some((o) => o.value === f.v)) return true; // options still loading
        if (el.value !== f.v) { el.value = f.v; el.dispatchEvent(new Event('input', { bubbles: true })); el.dispatchEvent(new Event('change', { bubbles: true })); }
        return false;
      });
      scrollTo({ top: state.y, behavior: 'instant' });
      if ((toggles.length || fields.length || document.documentElement.scrollHeight < state.y + innerHeight) && ++tries < 8) setTimeout(apply, 250 * tries);
    };
    if ('scrollRestoration' in history) history.scrollRestoration = 'manual';
    const go = () => requestAnimationFrame(apply);
    if (document.readyState === 'complete') go(); else addEventListener('load', go, { once: true });
  }
  restore();
  nav.querySelector('#cr-lang').addEventListener('click', () => {
    const next = en ? 'zh' : 'en';
    try { localStorage.setItem('chemhub-lang', next); } catch {}
    const loc = window.__CHEM_LOCATION__ ? null : new URL(location.href);
    const dropLang = loc && loc.searchParams.has('lang');
    if (dropLang) loc.searchParams.delete('lang');
    try { const s = snapshot(); if (dropLang) s.url = loc.href; sessionStorage.setItem(RESTORE, JSON.stringify(s)); } catch { /* storage off: plain reload */ }
    document.dispatchEvent(new CustomEvent('molastria:lang-switch', { detail: { lang: next } }));
    if (dropLang) location.replace(loc); else location.reload();
  });

  // AI 助手：首次点击时再加载 ai/ai.js，平时不增加页面体积。
  const aiButton = nav.querySelector('#cr-ai');
  let loading = null;
  const addScript = (path) => new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = link(path);
    s.onload = resolve;
    s.onerror = () => reject(new Error('AI 模块加载失败'));
    document.head.append(s);
  });
  const loadAI = () => {
    if (window.ChemAI) return Promise.resolve(window.ChemAI);
    if (!loading) loading = (window.CHEMHUB_AI_CONFIG ? Promise.resolve() : addScript('ai/config.js'))
      .then(() => window.ChemAI || addScript('ai/ai.js'))
      .then(() => window.ChemAI)
      .catch((e) => { loading = null; throw e; });
    return loading;
  };
  const refreshDot = () => {
    let ready = false;
    try { const s = JSON.parse(localStorage.getItem('chemhub-ai') || 'null'); ready = !!(s && (s.provider === 'proxy' || s.keys?.[s.provider])); } catch {}
    if (!ready) ready = !!readAccount()?.pro;
    if (!ready) try { ready = !!sessionStorage.getItem('chemhub-ai-key'); } catch {}
    if (!ready && window.CHEMHUB_AI_CONFIG?.proxy) ready = true;
    aiButton.dataset.ready = String(ready);
    aiButton.title = ready ? 'AI 助手（已配置）' : 'AI 助手：先在设置里填入 DeepSeek 或 Muse 的 API key';
  };
  refreshDot();
  document.addEventListener('chemhub:ai-config', refreshDot);
  const paintPro = () => {
    nav.querySelectorAll('.cr-pro, .cr-pro-link').forEach((a) => { a.href = proHref(); });
    nav.querySelector('.cr-pro').title = readAccount()?.pro ? '我的 Pro 账号' : 'MolAstria Pro 与桌面版下载';
    refreshDot();
  };
  document.addEventListener('molastria:account', paintPro);
  // Re-check the subscription once per browser session, so lapsed plans and this month's quota stay current.
  try {
    if (readAccount() && !sessionStorage.getItem('molastria-account-checked') && !window.__CHEM_LOCATION__) {
      sessionStorage.setItem('molastria-account-checked', '1');
      (window.MOLASTRIA_PAY ? Promise.resolve() : addScript('pay/config.js'))
        .then(() => window.MolAstriaAccount || addScript('pay/account.js'))
        .then(() => window.MolAstriaAccount.refresh())
        .catch(() => {});
    }
  } catch {}
  aiButton.addEventListener('click', () => loadAI().then((ai) => ai.openDrawer()).catch((e) => alert(e.message)));
  window.ChemHub = Object.assign(window.ChemHub || {}, { link, loadAI, isDark });

  const measure = () => root.style.setProperty('--cr-nav-height', `${nav.offsetHeight}px`);
  measure();
  new ResizeObserver(measure).observe(nav);

  // Floating card, bottom-left, on the web pages only: not in the desktop app, not on the download page itself, not on
  // phones, and not when the site already runs as a home-screen app. Computers get "download the desktop app" (shared-nav.css
  // also hides that one on narrow or touch-only screens); iPads and other tablets get "添加到主屏幕", which links to
  // the download page's home-screen steps. iPadOS Safari reports itself as a Mac: its touch screen tells it apart.
  // × folds the card into a round icon, remembered per browser; the icon unfolds it again.
  const here = (window.__CHEM_LOCATION__ || location).pathname || '';
  const ua = navigator.userAgent;
  const tablet = /iPad/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1) || (/Android/.test(ua) && !/Mobile/.test(ua))
    || (matchMedia('(hover:none) and (pointer:coarse)').matches && Math.min(screen.width, screen.height) >= 600 && !/iPhone|iPod|Mobile/.test(ua));
  const standalone = navigator.standalone === true || matchMedia('(display-mode: standalone)').matches;
  if (!window.__MOLASTRIA_DESKTOP__ && !window.__TAURI_INTERNALS__ && !standalone && !/\/download\/(index\.html)?$/.test(here) && (tablet || !/Android|iPhone|iPad|iPod|Mobile/i.test(ua))) {
    const FOLD = 'molastria-dl-folded';
    const offline = location.protocol === 'file:' || !!window.__CHEM_LOCATION__; // disk copy or single-file build
    const arrow = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 4v11M7 10.5l5 5 5-5M5 19.5h14"/></svg>`;
    const plus = (size) => `<svg width="${size}" height="${size}" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><rect x="4" y="4" width="16" height="16" rx="4.5"/><path d="M12 8.5v7M8.5 12h7"/></svg>`;
    const icon = tablet ? plus : arrow, to = tablet ? '#home-screen' : '';
    const dl = document.createElement('aside');
    dl.className = 'cr-dl';
    if (tablet) dl.dataset.variant = 'home';
    dl.setAttribute('aria-label', tablet ? '添加到主屏幕' : '桌面版下载');
    dl.innerHTML = `<a class="cr-dl-card" href="${offline ? `https://molastria.com/download/${to}` : link(`download/index.html${to}`)}"${offline ? ' target="_blank" rel="noopener"' : ''}><span class="cr-dl-ic">${icon(18)}</span><span class="cr-dl-tx"><b>${tablet ? '添加到主屏幕' : '下载桌面版'}</b><small>${tablet ? '全屏使用 · 离线可读' : /Mac/.test(ua) ? 'macOS · Windows' : 'Windows · macOS'}</small></span></a>`
      + `<button type="button" class="cr-dl-x" aria-label="${tablet ? '收起添加到主屏幕卡片' : '收起下载卡片'}" title="收起"><svg width="12" height="12" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" aria-hidden="true"><path d="m3 3 6 6M9 3 3 9"/></svg></button>`
      + `<button type="button" class="cr-dl-fab" aria-label="${tablet ? '展开添加到主屏幕卡片' : '展开桌面版下载'}" title="${tablet ? '添加到主屏幕' : '下载桌面版'}">${icon(19)}</button>`;
    const fold = (on, focus) => {
      dl.dataset.folded = String(on);
      try { if (on) localStorage.setItem(FOLD, '1'); else localStorage.removeItem(FOLD); } catch {}
      if (focus) dl.querySelector(on ? '.cr-dl-fab' : '.cr-dl-card').focus();
    };
    try { dl.dataset.folded = String(localStorage.getItem(FOLD) === '1'); } catch { dl.dataset.folded = 'false'; }
    dl.querySelector('.cr-dl-x').addEventListener('click', () => fold(true, true));
    dl.querySelector('.cr-dl-fab').addEventListener('click', () => fold(false, true));
    document.body.append(dl);
    // Keep clear of the page: start right of a fixed or sticky left column (atlas sidebar, handbook contents), stay
    // hidden where the corner holds an embedded app or another pinned element (radar, qchem), and give scrolling
    // pages room at the end so their footer can scroll above the card.
    const space = document.createElement('div');
    space.className = 'cr-dl-space';
    space.setAttribute('aria-hidden', 'true');
    const pinned = (el) => {
      if (el.closest('.cr-bg, .cr-header')) return null;
      for (; el && el !== document.body && el !== root; el = el.parentElement) if (/fixed|sticky/.test(getComputedStyle(el).position)) return el;
      return null;
    };
    const under = (x, y) => document.elementsFromPoint(Math.max(0, Math.min(x, innerWidth - 1)), Math.max(0, Math.min(y, innerHeight - 1))).filter((el) => !dl.contains(el));
    const place = () => {
      if (getComputedStyle(dl).display === 'none') { space.remove(); return; }
      let left = 18;
      for (const x of [8, 40, 120]) for (const el of under(x, innerHeight - 40).slice(0, 3)) {
        const r = pinned(el)?.getBoundingClientRect(); // a column: near the left edge, narrow, tall
        if (r && r.left < 160 && r.width < innerWidth * 0.45 && r.height > innerHeight * 0.3) left = Math.max(left, Math.round(r.right + 18));
      }
      dl.style.setProperty('--cr-dl-left', `${left}px`);
      const b = dl.getBoundingClientRect();
      const blocked = [0.12, 0.5, 0.88].some((f) => under(b.left + b.width * f, b.top + b.height / 2).some((el) => el.tagName === 'IFRAME' || pinned(el)));
      dl.toggleAttribute('data-blocked', blocked);
      if (!blocked && getComputedStyle(document.body).display === 'block' && root.scrollHeight > innerHeight + 4) document.body.append(space); else space.remove();
    };
    let wait = 0;
    const later = () => { clearTimeout(wait); wait = setTimeout(place, 200); };
    addEventListener('load', () => { place(); setTimeout(place, 1200); });
    new ResizeObserver(later).observe(document.body); // pages that render their columns after load
    addEventListener('resize', later);
    addEventListener('scroll', later, { passive: true });
    document.addEventListener('chemhub:i18n', later);
  }

  // Website only: sw.js keeps visited pages readable offline and makes the site installable (home screen on iPad,
  // iPhone, Android). Not registered in the desktop app (tauri: on macOS, http://tauri.localhost on Windows), the
  // single-file build, a disk copy, or a local preview on localhost / 127.0.0.1: the browser tests (tools/e2e) mock
  // same-origin files there, which a service worker would bypass. SW = false is the page half of the kill switch
  // (docs/RUNBOOK.md, with KILL in sw.js): it removes the worker and its caches instead of registering it.
  const SW = true;
  const sw = navigator.serviceWorker;
  if (sw && window.isSecureContext && /^https?:$/.test(location.protocol) && !window.__CHEM_LOCATION__ && !window.__MOLASTRIA_DESKTOP__
    && !window.__TAURI_INTERNALS__ && !window.__TAURI__ && !/(^|\.)localhost$|^127\.|^\[::1\]$/.test(location.hostname)) {
    addEventListener('load', () => {
      if (!SW) {
        sw.getRegistrations().then((rs) => rs.forEach((r) => r.unregister())).catch(() => {});
        caches.keys().then((ks) => ks.forEach((k) => { if (k.startsWith('molastria-')) caches.delete(k); })).catch(() => {});
        return;
      }
      // On the first visit this page loaded before the worker existed: tell it what to keep, so it also opens offline.
      const first = !sw.controller;
      sw.register(link('sw.js')).then(() => sw.ready).then((r) => {
        if (first) r.active?.postMessage({ cache: [location.href, ...performance.getEntriesByType('resource').map((e) => e.name)] });
      }).catch(() => {});
    });
  }

  // Desktop app only: offer the newer version published on GitHub Releases. The app checks the signed feed
  // once per launch (cached for the session); "稍后" hides the prompt for that version for three days.
  const ipc = window.__TAURI_INTERNALS__;
  if (window.__MOLASTRIA_DESKTOP__ && ipc) {
    const SEEN = 'molastria-update', SNOOZE = 'molastria-update-snooze';
    const read = (area, key) => { try { return JSON.parse(area.getItem(key) || 'null'); } catch { return null; } };
    const write = (area, key, v) => { try { area.setItem(key, JSON.stringify(v)); } catch {} };
    const esc = (v) => String(v).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
    const offer = (u) => {
      const snooze = read(localStorage, SNOOZE);
      if (snooze && snooze.version === u.version && snooze.until > Date.now()) return;
      const box = document.createElement('div');
      box.className = 'cr-update';
      box.setAttribute('role', 'dialog');
      box.setAttribute('aria-label', '软件更新');
      box.innerHTML = `<b>MolAstria 有新版本 v${esc(u.version)}</b>`
        + `<p><span>当前 v${esc(u.currentVersion)}</span> · <a href="https://github.com/FelixJiashengFu/chem-research-molastria/releases/tag/desktop-v${esc(u.version)}">更新内容</a></p>`
        + '<p>更新后应用会自动重启，设置都会保留。</p><p class="cr-update-msg" role="status"></p>'
        + '<div class="cr-update-actions"><button type="button" class="cr-update-later">稍后</button><button type="button" class="cr-update-go">立即更新</button></div>';
      document.body.append(box);
      const msg = box.querySelector('.cr-update-msg'), go = box.querySelector('.cr-update-go'), later = box.querySelector('.cr-update-later');
      later.addEventListener('click', () => { write(localStorage, SNOOZE, { version: u.version, until: Date.now() + 3 * 864e5 }); box.remove(); });
      go.addEventListener('click', () => {
        go.disabled = later.disabled = true;
        go.textContent = '正在下载…';
        msg.textContent = '';
        const timer = setInterval(() => ipc.invoke('update_progress').then(([done, total]) => {
          if (total) go.textContent = done >= total ? '正在安装…' : `正在下载 ${Math.floor((done / total) * 100)}%`;
        }).catch(() => {}), 300);
        ipc.invoke('install_update').catch((e) => {
          clearInterval(timer);
          go.disabled = later.disabled = false;
          go.textContent = '重试';
          const why = /signature/i.test(e) ? '安装包签名校验失败' : /network|connect|dns|timed? ?out|request|status/i.test(e) ? '网络连接失败' : esc(e);
          msg.innerHTML = `<span>更新没有完成：${why}</span><br><a href="https://molastria.com/download/">到下载页手动安装</a>`;
        });
      });
    };
    const known = read(sessionStorage, SEEN);
    if (known) { if (known.version) offer(known); }
    else ipc.invoke('check_update').then((u) => { write(sessionStorage, SEEN, u || {}); if (u) offer(u); }).catch(() => {});
  }
})();
