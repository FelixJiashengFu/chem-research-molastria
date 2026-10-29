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
    ['atlas', 'atlas/index.html#guide', '中文讲解与数据库'],
    ['hub', 'hub/index.html', '论文与社区'],
    ['radar', 'radar/index.html', '预印本雷达', true],
    ['lab', 'lab/index.html', 'AI 实验室'],
    ['train', 'train/index.html', '训练 Agent', true],
    ['agent', 'atlas/index.html#agent', 'Agent 工程']
  ];
  // MolAstria mark: a benzene ring on an electron orbit, with a four-point star. Monochrome, inverts with the theme.
  const mark = '<svg class="cr-mark" viewBox="0 0 40 40" aria-hidden="true"><rect class="m-tile" width="40" height="40" rx="9"/><ellipse class="m-hair" cx="19" cy="21" rx="15" ry="5.6" transform="rotate(-28 19 21)"/><path class="m-line" d="M19 11.2 27.5 16.1v9.8L19 30.8l-8.5-4.9v-9.8Z"/><circle class="m-thin" cx="19" cy="21" r="4.9"/><circle class="m-dot" cx="5.7" cy="26" r="1.3"/><path class="m-star" d="M30.6 5.2c.45 2.9 1.5 3.95 4.4 4.4-2.9.45-3.95 1.5-4.4 4.4-.45-2.9-1.5-3.95-4.4-4.4 2.9-.45 3.95-1.5 4.4-4.4Z"/><circle class="m-dot" cx="35" cy="17.5" r=".7"/></svg>';
  const palette = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.2.2-2.4 1.5-2.4H17a4 4 0 0 0 4-4C21 7 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/></svg>';
  const moon = '<svg class="cr-theme-dark" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
  const sun = '<svg class="cr-theme-light" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
  const spark = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z"/><path d="M19 15.5c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z"/></svg>';

  // Pro account summary cached by pay/account.js; signed-in Pro users go straight to their account page.
  const readAccount = () => { try { return localStorage.getItem('molastria-session') ? JSON.parse(localStorage.getItem('molastria-account') || 'null') : null; } catch { return null; } };
  const proHref = () => link(readAccount()?.pro ? 'pro/account.html' : 'pro/index.html');

  const nav = document.createElement('header');
  nav.className = 'cr-header';
  const en = document.documentElement.lang === 'en';
  nav.innerHTML = `<a class="cr-brand" href="${link('index.html')}" aria-label="MolAstria">${mark}<span><span class="cr-word">Mol<i>Astria</i></span><small>计算化学研究导航</small></span></a>`
    + `<nav class="cr-links" aria-label="全站导航">${links.map(([id, path, label, fresh]) => `<a href="${link(path)}" data-id="${id}">${label}${fresh ? '<span class="cr-new">新</span>' : ''}</a>`).join('')}<a class="cr-pro-link" href="${proHref()}" data-id="pro">Pro</a></nav>`
    + `<div class="cr-tools"><a class="cr-pro" href="${proHref()}" title="${readAccount()?.pro ? '我的 Pro 账号' : 'MolAstria Pro 与桌面版下载'}"><span>Pro</span></a><button class="cr-icon-btn cr-lang" type="button" id="cr-lang" lang="${en ? 'zh-CN' : 'en'}" aria-label="${en ? '切换到中文' : 'Switch to English'}" title="${en ? '切换到中文' : 'Switch to English'}" translate="no">${en ? '中' : 'EN'}</button>`
    + `<button class="cr-icon-btn" type="button" id="cr-bg" aria-label="更换背景" title="更换背景" aria-haspopup="dialog" aria-expanded="false">${palette}</button>`
    + `<button class="cr-icon-btn" type="button" id="cr-theme" aria-label="切换浅色 / 深色">${moon}${sun}</button>`
    + `<button class="cr-ai-btn" type="button" id="cr-ai" aria-haspopup="dialog">${spark}<span class="cr-label">AI 助手</span><span class="cr-dot" aria-hidden="true"></span></button></div>`;
  document.body.prepend(nav);

  const markCurrent = () => {
    const hash = (window.__CHEM_LOCATION__ || location).hash || '';
    const active = section === 'atlas' && hash.startsWith('#agent') ? 'agent' : section;
    nav.querySelectorAll('.cr-links a').forEach((a) => {
      if (a.dataset.id === active) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current');
    });
  };
  markCurrent();
  window.addEventListener('hashchange', markCurrent);
  // On phones the link row scrolls sideways: bring the current section into view.
  const row = nav.querySelector('.cr-links'), current = row.querySelector('[aria-current]');
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
