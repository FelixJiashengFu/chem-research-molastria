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
    ['lab', 'lab/index.html', 'AI 实验室', true],
    ['agent', 'atlas/index.html#agent', 'Agent 工程']
  ];
  const mark = '<svg class="cr-mark" viewBox="0 0 40 40" aria-hidden="true"><rect width="40" height="40" rx="7" fill="#204f3d"/><path d="M20 7.5 30.8 13.75v12.5L20 32.5 9.2 26.25v-12.5Z" fill="none" stroke="#d9e3b8" stroke-width="2.2" stroke-linejoin="round"/><path d="M20 7.5V20m0 0 10.8 6.25M20 20 9.2 26.25" stroke="#d9e3b8" stroke-width="1.4" opacity=".55"/><circle cx="20" cy="20" r="4.2" fill="#d6b06b"/></svg>';
  const moon = '<svg class="cr-theme-dark" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
  const sun = '<svg class="cr-theme-light" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
  const spark = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z"/><path d="M19 15.5c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z"/></svg>';

  const nav = document.createElement('header');
  nav.className = 'cr-header';
  nav.innerHTML = `<a class="cr-brand" href="${link('index.html')}">${mark}<span>ChemResearch <b>Hub</b><small>计算化学研究导航</small></span></a>`
    + `<nav class="cr-links" aria-label="全站导航">${links.map(([id, path, label, fresh]) => `<a href="${link(path)}" data-id="${id}">${label}${fresh ? '<span class="cr-new">新</span>' : ''}</a>`).join('')}</nav>`
    + `<div class="cr-tools"><button class="cr-icon-btn" type="button" id="cr-theme" aria-label="切换浅色 / 深色">${moon}${sun}</button>`
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
    if (!ready) try { ready = !!sessionStorage.getItem('chemhub-ai-key'); } catch {}
    if (!ready && window.CHEMHUB_AI_CONFIG?.proxy) ready = true;
    aiButton.dataset.ready = String(ready);
    aiButton.title = ready ? 'AI 助手（已配置）' : 'AI 助手：先在设置里填入 DeepSeek 或 Muse 的 API key';
  };
  refreshDot();
  document.addEventListener('chemhub:ai-config', refreshDot);
  aiButton.addEventListener('click', () => loadAI().then((ai) => ai.openDrawer()).catch((e) => alert(e.message)));
  window.ChemHub = Object.assign(window.ChemHub || {}, { link, loadAI, isDark });

  const measure = () => root.style.setProperty('--cr-nav-height', `${nav.offsetHeight}px`);
  measure();
  new ResizeObserver(measure).observe(nav);
})();
