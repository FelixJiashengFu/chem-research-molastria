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
    ['atlas', 'atlas/index.html#resources', '数据库'],
    ['hub', 'hub/index.html', '论文与社区'],
    ['radar', 'radar/index.html', '预印本雷达'],
    ['journals', 'journals/index.html', '期刊发表'],
    ['scimodels', 'scimodels/index.html', '科学大模型', true],
    ['lab', 'lab/index.html', 'AI 实验室'],
    ['meta', 'meta/index.html', 'Meta', true],
    ['models', 'models/index.html', '模型接口', true],
    ['qchem', 'qchem/index.html', '量子化学', true],
    ['fundamental', 'fundamental-science/index.html', '进一步基础科学发现', true],
    ['train', 'train/index.html', '训练 Agent', true],
    ['agent', 'atlas/index.html#agent', 'Agent 工程']
  ];
  // MolAstria mark: a benzene ring on an electron orbit, with a four-point star. Monochrome, inverts with the theme.
  const mark = '<svg class="cr-mark" viewBox="0 0 40 40" aria-hidden="true"><rect class="m-tile" width="40" height="40" rx="9"/><ellipse class="m-hair" cx="19" cy="21" rx="15" ry="5.6" transform="rotate(-28 19 21)"/><path class="m-line" d="M19 11.2 27.5 16.1v9.8L19 30.8l-8.5-4.9v-9.8Z"/><circle class="m-thin" cx="19" cy="21" r="4.9"/><circle class="m-dot" cx="5.7" cy="26" r="1.3"/><path class="m-star" d="M30.6 5.2c.45 2.9 1.5 3.95 4.4 4.4-2.9.45-3.95 1.5-4.4 4.4-.45-2.9-1.5-3.95-4.4-4.4 2.9-.45 3.95-1.5 4.4-4.4Z"/><circle class="m-dot" cx="35" cy="17.5" r=".7"/></svg>';
  const palette = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.2.2-2.4 1.5-2.4H17a4 4 0 0 0 4-4C21 7 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/></svg>';
  const moon = '<svg class="cr-theme-dark" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
  const sun = '<svg class="cr-theme-light" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
  const spark = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z"/><path d="M19 15.5c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z"/></svg>';
  const chevron = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 3.5 3 3 3-3"/></svg>';

  // Pro account summary cached by pay/account.js; signed-in Pro users go straight to their account page.
  const readAccount = () => { try { return localStorage.getItem('molastria-session') ? JSON.parse(localStorage.getItem('molastria-account') || 'null') : null; } catch { return null; } };
  const proHref = () => link(readAccount()?.pro ? 'pro/account.html' : 'pro/index.html');

  const nav = document.createElement('header');
  nav.className = 'cr-header';
  const en = document.documentElement.lang === 'en';
  nav.innerHTML = `<a class="cr-brand" href="${link('index.html')}" aria-label="MolAstria">${mark}<span><span class="cr-word">Mol<i>Astria</i></span><small>计算化学研究导航</small></span></a>`
    + `<nav class="cr-links" aria-label="全站导航">${links.map(([id, path, label, fresh]) => `<a href="${link(path)}" data-id="${id}">${label}${fresh ? '<span class="cr-new">新</span>' : ''}</a>`).join('')}`
    + `<div class="cr-more" hidden><button class="cr-more-btn" type="button" aria-expanded="false" aria-controls="cr-more-menu">更多${chevron}</button><div class="cr-more-menu" id="cr-more-menu" hidden></div></div>`
    + `<a class="cr-pro-link" href="${proHref()}" data-id="pro">Pro</a></nav>`
    + `<div class="cr-tools"><a class="cr-pro" href="${proHref()}" title="${readAccount()?.pro ? '我的 Pro 账号' : 'MolAstria Pro 与桌面版下载'}"><span>Pro</span></a><button class="cr-icon-btn cr-lang" type="button" id="cr-lang" lang="${en ? 'zh-CN' : 'en'}" aria-label="${en ? '切换到中文' : 'Switch to English'}" title="${en ? '切换到中文' : 'Switch to English'}" translate="no">${en ? '中' : 'EN'}</button>`
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
  const fit = () => {
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
  // Language: remembered per browser; the page reloads so every module renders once in the chosen language.
  nav.querySelector('#cr-lang').addEventListener('click', () => {
    const next = en ? 'zh' : 'en';
    try { localStorage.setItem('chemhub-lang', next); } catch {}
    const loc = window.__CHEM_LOCATION__ ? null : new URL(location.href);
    if (loc && loc.searchParams.has('lang')) { loc.searchParams.delete('lang'); location.replace(loc); } else location.reload();
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
