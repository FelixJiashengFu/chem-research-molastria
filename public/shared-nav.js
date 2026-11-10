/* Shared header for every module: navigation, light/dark switch and the AI assistant entry.
   Paths work on disk, under any hosting subdirectory, and inside the single-file build. */
(() => {
  const script = document.currentScript;
  const base = window.__CHEM_LINK__ ? new URL(window.__CHEM_LINK__('')) : new URL('.', script.src);
  const link = (path) => String(new URL(path, base));
  const section = document.body.dataset.section || 'search';
  // ── 全站导航（2026-11-10 改版）：二十多个栏目分成五组，每组一个按钮，点开是一块大菜单（每个栏目一句说明，大的栏目带子展馆）；
  //    窄屏（iPad 竖屏、手机）只留一个“栏目”按钮，打开后五组从上到下排开。菜单顶部能搜索栏目，Ctrl / ⌘ + K 在任何页面直接打开。
  //    常用的栏目可以“固定到顶栏”：固定的入口直接显示在分组按钮后面（放不下就只留在菜单里），能在顶栏上拖动换位，存 molastria-nav-pins。
  //    文字自带中英两版（translate="no"），不经过 i18n.js。
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const GROUPS = [
    { id: 'find', zh: '发现', en: 'Discover', hint: ['找资源、读新论文、看研究版图', 'Find resources, new papers and the research landscape'], items: [
      ['search', 'index.html', '统一搜索', 'Search', '一次搜遍目录、讲解手册和收藏夹', 'One search across the catalogue, handbook and saved items', 0, 'search 搜索 home 首页 收藏'],
      ['atlas', 'atlas/index.html#resources', '数据库', 'Databases', '按类别浏览数据库与研究资源', 'Browse databases and research resources by category', 0, 'database catalogue 目录'],
      ['network', 'hub/network.html', '网状查询', 'Network', '资源、方法和概念之间的关系网', 'How resources, methods and concepts connect', 0, 'graph 关系 network'],
      ['research', 'research-atlas/index.html', '研究图谱', 'Research Atlas', '中美大学的数理化研究网络与产业地图', 'Maths, physics and chemistry research networks of US and Chinese universities', 1, 'university 大学 map'],
      ['radar', 'radar/index.html', '预印本雷达', 'Preprint Radar', '28 个预印本来源的新论文', 'New papers from 28 preprint servers', 0, 'arxiv chemrxiv preprint'],
      ['digest', 'digest/index.html', '每周精选', 'Weekly Picks', '每周值得读的计算化学论文和点评', 'Computational chemistry papers worth reading each week, with notes', 1, 'weekly digest newsletter'],
      ['hub', 'hub/index.html', '论文与社区', 'Papers & Community', '论文快照、论坛和社区讨论', 'Paper snapshots, forums and community threads', 0, 'forum community papers'],
    ] },
    { id: 'learn', zh: '学习', en: 'Learn', hint: ['从讲解、视频到 AI 家教和小游戏', 'From explainers and videos to an AI tutor and games'], items: [
      ['manual', 'manual/index.html', '讲解手册', 'Handbook', '20 章中英双语的计算化学讲解', '20 bilingual chapters on computational chemistry', 0, 'handbook guide 手册'],
      ['videos', 'videos/index.html', '教学视频', 'Videos', 'YouTube 和哔哩哔哩上的课程与教程', 'Courses and tutorials on YouTube and Bilibili', 1, 'video youtube bilibili course'],
      ['programming', 'programming/index.html', '编程语言', 'Programming', '计算物理与化学要用的编程语言，从入门到并行', 'The programming languages of computational physics and chemistry, from basics to parallel', 1, 'python fortran c++ julia code language 编程 语言'],
      ['learn', 'learn/index.html', '研习台', 'Study Desk', 'AI 家教：先摸底、画路线、一步一检', 'An AI tutor: probe, plan, then teach step by step', 1, 'tutor ai 家教'],
      ['review', 'review/index.html', '复习卡片', 'Flashcards', '间隔重复复习术语和学过的知识点', 'Spaced repetition for terms and what you learned', 1, 'anki flashcard fsrs'],
      ['qchem', 'qchem/index.html', '游乐场', 'Playground', '十五个量子小游戏和浏览器里的量子化学计算器', 'Fifteen quantum games and a quantum chemistry calculator in the browser', 1, 'game 游戏 calculator'],
    ] },
    { id: 'explore', zh: '探索', en: 'Explore', hint: ['量子世界与基础科学的前沿', 'Quantum science and the frontiers of fundamental science'], items: [
      ['quantum', 'quantum/index.html', '量子嘉年华', 'Quantum Carnival', '四个展馆：量子物理、计算机、算法、生物学', 'Four pavilions: quantum physics, computers, algorithms and biology', 1, 'quantum 量子', [['量子物理', 'Quantum physics', 'quantum/physics/index.html'], ['量子计算机', 'Quantum computers', 'quantum/computing/index.html'], ['量子算法', 'Quantum algorithms', 'quantum/algorithms/index.html'], ['量子生物学', 'Quantum biology', 'quantum/biology/index.html']]],
      ['fundamental', 'fundamental-science/index.html', '进一步基础科学发现', 'Fundamental Science', '尚未解决的基础问题，每条标明研究状态', 'Open fundamental questions, each with its research status', 1, 'fundamental science physics', [['数学基础与探索', 'Mathematical foundations', 'fundamental-science/math/index.html']]],
      ['realms', 'physics-realms/index.html', '物理疆界图', 'Physics Realms', '42 个物理理论和它们之间的关系图', '42 physical theories and how they connect', 1, 'physics map theory'],
      ['vision', 'vision/index.html', '愿景：工业革命2.5', 'Vision: Industrial Revolution 2.5', '站长的文章，和 MolAstria 接下来能做什么', 'The operator’s essay, and what MolAstria can do next', 1, 'vision 愿景 essay manhattan 曼哈顿 roadmap 路线图 future'],
    ] },
    { id: 'models', zh: '模型与 AI', en: 'Models & AI', hint: ['科学模型、在线计算和 AI 研究流程', 'Science models, online computing and AI research workflows'], items: [
      ['openmodels', 'open-models/index.html', '开放模型馆', 'Open Model Hall', 'Meta、DeepMind、微软、英伟达等 11 家公司的开放科学模型', 'Open science models from Meta, DeepMind, Microsoft, NVIDIA and 7 more', 1, 'meta uma omol25 deepmind alphafold microsoft mattergen nvidia 深势 字节 open models', [['Meta', 'Meta', 'meta/index.html'], ['Google DeepMind', 'Google DeepMind', 'open-models/deepmind/index.html'], ['微软', 'Microsoft', 'open-models/microsoft/index.html'], ['英伟达', 'NVIDIA', 'open-models/nvidia/index.html'], ['深势科技', 'DP Technology', 'open-models/dp/index.html'], ['全部 11 家', 'All 11 labs', 'open-models/index.html#om-orgs']]],
      ['scimodels', 'scimodels/index.html', '科学大模型', 'Science LLMs', '27 个科学语言模型和价格对比', '27 science language models and a price comparison', 1, 'llm language model price 价格'],
      ['models', 'models/index.html', '模型接口', 'Model API', '在线跑 15 个机器学习势：优化、频率、光谱', 'Run 15 machine-learning potentials online: optimisation, frequencies, spectra', 1, 'uma mace ani api compute 计算'],
      ['lab', 'lab/index.html', 'AI 实验室', 'AI Lab', 'AI 化学家提出分子、计算来验证的闭环演示', 'An AI chemist proposes molecules and computation checks them', 0, 'lab muse electrolyte'],
      ['train', 'train/index.html', '训练 Agent', 'Train an Agent', '用开放模型当老师训练自己的小模型', 'Train your own small model with open teachers', 1, 'train finetune distill'],
      ['agent', 'atlas/index.html#agent', 'Agent 工程', 'Agent Engineering', '计算化学 MCP 服务器和 Agent 的做法', 'An MCP server for computational chemistry and agent patterns', 0, 'mcp agent chemdb'],
    ] },
    { id: 'make', zh: '工具', en: 'Tools', hint: ['写输入、投稿、接数据、装桌面版', 'Write inputs, publish, use the data, get the app'], items: [
      ['code', 'code/index.html', '开源代码台', 'Code Desk', '计算化学程序的输入生成、输出解读与软件体检', 'Input generation, output reading and health checks for chemistry codes', 1, 'pyscf orca gaussian xtb input 输入'],
      ['journals', 'journals/index.html', '期刊发表', 'Journals', '期刊选择与投稿指导', 'Choosing a journal and submitting', 0, 'journal submit 投稿'],
      ['api', 'api/index.html', '开放数据接口', 'Open Data API', '程序可读的数据集、JS / Python 库与计算接口', 'Machine-readable datasets, JS / Python clients and the compute API', 1, 'api json openapi python'],
      ['download', 'download/index.html', '桌面版', 'Desktop App', 'Windows 和 macOS 应用，可在本机跑 UMA', 'Windows and macOS app that can run UMA locally', 0, 'desktop download windows mac app 下载'],
    ] },
  ];
  // Each person's own order of the five groups and of the buttons on the right (dragged in the header, saved per browser).
  // Unknown or missing ids fall back to the default order, so a new group or button simply appears at its usual place.
  const GORDER = 'molastria-nav-groups', TORDER = 'molastria-nav-tools';
  const readOrder = (k) => { try { const v = JSON.parse(localStorage.getItem(k) || 'null'); return Array.isArray(v) ? v.map(String) : []; } catch { return []; } };
  const ordered = (ids, saved) => [...saved.filter((id, i) => ids.includes(id) && saved.indexOf(id) === i), ...ids.filter((id) => !saved.includes(id))];
  const writeOrder = (k, ids, def) => { try { if (ids.join() === def.join()) localStorage.removeItem(k); else localStorage.setItem(k, JSON.stringify(ids)); } catch { /* private mode */ } };
  const GROUP_IDS = GROUPS.map((g) => g.id);
  { const o = ordered(GROUP_IDS, readOrder(GORDER)); GROUPS.sort((a, b) => o.indexOf(a.id) - o.indexOf(b.id)); }
  const ITEMS = GROUPS.flatMap((g) => g.items.map(([id, path, zh, e, dz, de, fresh, kw, subs]) => ({ id, path, zh, en: e, dz, de, fresh, kw, subs: subs || [], group: g.id })));
  const byId = new Map(ITEMS.map((x) => [x.id, x]));
  const name = (x) => (en ? x.en : x.zh);
  // the item a page belongs to: its data-section, with a few pages that share one
  const sectionItem = { meta: 'openmodels', pro: section === 'pro' && /\/download\//.test(location.pathname) ? 'download' : '' };
  // Pinned modules (each person's own, saved per browser). Old saved orders (molastria-nav-order) do not carry over: the bar is new.
  const PINS = 'molastria-nav-pins';
  const readPins = () => { try { const v = JSON.parse(localStorage.getItem(PINS) || '[]'); return Array.isArray(v) ? v.filter((id) => byId.has(id)) : []; } catch { return []; } };
  let pins = readPins();
  const savePins = (ids) => { pins = ids.filter((id, i) => byId.has(id) && ids.indexOf(id) === i); try { if (pins.length) localStorage.setItem(PINS, JSON.stringify(pins)); else localStorage.removeItem(PINS); } catch { /* private mode */ } };

  // MolAstria mark: a benzene ring on an electron orbit, with a four-point star. Monochrome, inverts with the theme.
  const mark = '<svg class="cr-mark" viewBox="0 0 40 40" aria-hidden="true"><rect class="m-tile" width="40" height="40" rx="9"/><ellipse class="m-hair" cx="19" cy="21" rx="15" ry="5.6" transform="rotate(-28 19 21)"/><path class="m-line" d="M19 11.2 27.5 16.1v9.8L19 30.8l-8.5-4.9v-9.8Z"/><circle class="m-thin" cx="19" cy="21" r="4.9"/><circle class="m-dot" cx="5.7" cy="26" r="1.3"/><path class="m-star" d="M30.6 5.2c.45 2.9 1.5 3.95 4.4 4.4-2.9.45-3.95 1.5-4.4 4.4-.45-2.9-1.5-3.95-4.4-4.4 2.9-.45 3.95-1.5 4.4-4.4Z"/><circle class="m-dot" cx="35" cy="17.5" r=".7"/></svg>';
  const palette = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3a9 9 0 1 0 0 18c1.1 0 1.6-.9 1.2-1.8-.5-1.2.2-2.4 1.5-2.4H17a4 4 0 0 0 4-4C21 7 17 3 12 3Z"/><circle cx="7.5" cy="11" r="1.1"/><circle cx="10.5" cy="7" r="1.1"/><circle cx="15" cy="7.5" r="1.1"/></svg>';
  const moon = '<svg class="cr-theme-dark" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5Z"/></svg>';
  const sun = '<svg class="cr-theme-light" width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" aria-hidden="true"><circle cx="12" cy="12" r="4"/><path d="M12 2.5v2.2M12 19.3v2.2M4.6 4.6l1.6 1.6M17.8 17.8l1.6 1.6M2.5 12h2.2M19.3 12h2.2M4.6 19.4l1.6-1.6M17.8 6.2l1.6-1.6"/></svg>';
  const spark = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" aria-hidden="true"><path d="M12 3c.6 4.4 2.6 6.4 7 7-4.4.6-6.4 2.6-7 7-.6-4.4-2.6-6.4-7-7 4.4-.6 6.4-2.6 7-7Z"/><path d="M19 15.5c.25 1.6.9 2.25 2.5 2.5-1.6.25-2.25.9-2.5 2.5-.25-1.6-.9-2.25-2.5-2.5 1.6-.25 2.25-.9 2.5-2.5Z"/></svg>';
  const textSize = '<svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M3 5.5h10M8 5.5v13M13.5 11h7.5M17.25 11v7.5"/></svg>';
  const chevron = '<svg width="10" height="10" viewBox="0 0 10 10" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="m2 3.5 3 3 3-3"/></svg>';
  const lens = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6.5"/><path d="m15.5 15.5 5 5"/></svg>';
  const grid4 = '<svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linejoin="round" aria-hidden="true"><rect x="3.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="3.5" width="7" height="7" rx="1.6"/><rect x="3.5" y="13.5" width="7" height="7" rx="1.6"/><rect x="13.5" y="13.5" width="7" height="7" rx="1.6"/></svg>';
  const person = '<svg width="17" height="17" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.9 4.1-5.8 7.5-5.8s6.3 1.9 7.5 5.8"/></svg>';
  const pinIcon = '<svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.9" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M9 4h6l-1 6 3 3H7l3-3-1-6Z"/><path d="M12 16v4.5"/></svg>';
  // one small line drawing per group, shown in the menu rail and on the narrow-screen sections
  const GLYPH = {
    find: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10.5" cy="10.5" r="6"/><path d="m15 15 5 5M8 10.5h5"/></svg>',
    learn: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M3.5 6.5c3-1.5 5.8-1.5 8.5.5 2.7-2 5.5-2 8.5-.5v11c-3-1.5-5.8-1.5-8.5.5-2.7-2-5.5-2-8.5-.5Z"/><path d="M12 7v11"/></svg>',
    explore: '<svg viewBox="0 0 24 24" aria-hidden="true"><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/><circle cx="12" cy="12" r="1.2"/></svg>',
    models: '<svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="6" cy="7" r="2"/><circle cx="18" cy="7" r="2"/><circle cx="12" cy="17" r="2"/><path d="M8 7h8M7 8.8l4 6.4M17 8.8l-4 6.4"/></svg>',
    make: '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m8.5 8-4 4 4 4M15.5 8l4 4-4 4M13.5 5l-3 14"/></svg>',
  };

  // Pro account summary cached by pay/account.js; signed-in Pro users go straight to their account page.
  const readAccount = () => { try { return localStorage.getItem('molastria-session') ? JSON.parse(localStorage.getItem('molastria-account') || 'null') : null; } catch { return null; } };

  // The buttons on the right, by id; drawn in each person's saved order. The account button replaces the old "Pro" pill: it
  // reads "登录 / Sign in" until someone signs in, then shows their initial; it opens a small glass panel (see "Account" below).
  const TOOLS = {
    jump: `<button class="cr-icon-btn cr-jump" type="button" id="cr-jump" data-tool="jump" aria-label="${L('搜索栏目', 'Search sections')}" title="${L('搜索栏目（Ctrl / ⌘ + K）', 'Search sections (Ctrl / ⌘ + K)')}" aria-haspopup="dialog" aria-controls="cr-mega">${lens}</button>`,
    acct: `<button class="cr-acct" type="button" id="cr-acct" data-tool="acct" aria-haspopup="dialog" aria-expanded="false" aria-controls="cr-acct-pop"></button>`,
    lang: `<button class="cr-icon-btn cr-lang" type="button" id="cr-lang" data-tool="lang" translate="no" lang="${en ? 'zh-CN' : 'en'}" aria-label="${en ? '切换到中文' : 'Switch to English'}" title="${en ? '切换到中文' : 'Switch to English'}">${en ? '中' : 'EN'}</button>`,
    disp: `<button class="cr-icon-btn" type="button" id="cr-disp" data-tool="disp" translate="no" aria-label="${en ? 'Display: scale, text size and typeface' : '显示设置：缩放、字号与字体'}" title="${en ? 'Display' : '显示设置'}" aria-haspopup="dialog" aria-expanded="false">${textSize}</button>`,
    bg: `<button class="cr-icon-btn" type="button" id="cr-bg" data-tool="bg" aria-label="${L('更换背景', 'Change background')}" title="${L('更换背景', 'Change background')}" aria-haspopup="dialog" aria-expanded="false">${palette}</button>`,
    theme: `<button class="cr-icon-btn" type="button" id="cr-theme" data-tool="theme" aria-label="${L('切换浅色 / 深色', 'Toggle light / dark')}" title="${L('切换浅色 / 深色', 'Toggle light / dark')}">${moon}${sun}</button>`,
    ai: `<button class="cr-ai-btn" type="button" id="cr-ai" data-tool="ai" aria-haspopup="dialog">${spark}<span class="cr-label">${L('AI 助手', 'AI assistant')}</span><span class="cr-dot" aria-hidden="true"></span></button>`,
  };
  const TOOL_IDS = Object.keys(TOOLS);
  const toolOrder = ordered(TOOL_IDS, readOrder(TORDER));

  const nav = document.createElement('header');
  nav.className = 'cr-header';
  const fresh = (x) => (x.fresh ? `<span class="cr-new">${L('新', 'New')}</span>` : '');
  const pinA = (x) => `<a class="cr-pin" href="${link(x.path)}" data-id="${x.id}" draggable="false">${name(x)}</a>`;
  const cell = (x) => `<div class="cr-cell" data-id="${x.id}"><a class="cr-item" href="${link(x.path)}" data-id="${x.id}"><span class="cr-item-t">${name(x)}${fresh(x)}</span><span class="cr-item-d">${en ? x.de : x.dz}</span></a>`
    + `<button type="button" class="cr-pin-t" data-pin="${x.id}" aria-pressed="false" aria-label="${L(`固定“${x.zh}”到顶栏`, `Pin ${x.en} to the header`)}" title="${L('固定到顶栏', 'Pin to the header')}">${pinIcon}</button>`
    + (x.subs.length ? `<div class="cr-subs">${x.subs.map(([zh, e, p]) => `<a href="${link(p)}" data-sub="${x.id}">${en ? e : zh}</a>`).join('')}</div>` : '') + '</div>';
  nav.innerHTML = `<a class="cr-brand" href="${link('index.html')}" aria-label="MolAstria">${mark}<span><span class="cr-word">Mol<i>Astria</i></span><small>计算化学研究导航</small></span></a>`
    + `<nav class="cr-links" aria-label="${L('全站导航', 'Site navigation')}" translate="no">`
    + `<button class="cr-menu-btn" type="button" aria-expanded="false" aria-controls="cr-mega" hidden>${grid4}<span>${L('栏目', 'Sections')}</span><b class="cr-where"></b></button>`
    + `<span class="cr-grps">${GROUPS.map((g) => `<button class="cr-grp-btn" type="button" data-group="${g.id}" aria-expanded="false" aria-controls="cr-mega">${en ? g.en : g.zh}${chevron}</button>`).join('')}</span>`
    + `<span class="cr-pins">${pins.map((id) => pinA(byId.get(id))).join('')}</span></nav>`
    + `<div class="cr-mega" id="cr-mega" hidden translate="no" role="dialog" aria-label="${L('全部栏目', 'All sections')}">`
    + `<div class="cr-mega-head"><label class="cr-find">${lens}<span class="cr-sr">${L('搜索栏目', 'Search sections')}</span><input type="text" role="searchbox" inputmode="search" placeholder="${L('搜索栏目，比如“量子”“AlphaFold”“Python”', 'Search sections, e.g. “quantum”, “AlphaFold”, “Python”')}" autocomplete="off" spellcheck="false" enterkeyhint="go"></label><kbd class="cr-kbd"${['search', 'atlas'].includes(section) ? ' hidden' : ''}>${/Mac|iPhone|iPad/.test(navigator.platform) ? '⌘' : 'Ctrl'} K</kbd><button type="button" class="cr-mega-x" aria-label="${L('关闭', 'Close')}">×</button></div>`
    + `<div class="cr-mega-pins" hidden><b>${L('常用', 'Pinned')}</b><span></span><button type="button" class="cr-pins-edit">${L('整理', 'Arrange')}</button></div>`
    + `<div class="cr-mega-body"><div class="cr-rail" role="tablist" aria-label="${L('分组', 'Groups')}">${GROUPS.map((g) => `<button type="button" role="tab" data-rail="${g.id}" aria-selected="false"><i class="cr-glyph">${GLYPH[g.id]}</i><span><b>${en ? g.en : g.zh}</b><small>${L(...g.hint)}</small></span></button>`).join('')}</div>`
    + `<div class="cr-sections">${GROUPS.map((g) => `<section class="cr-sec" data-group="${g.id}" aria-label="${en ? g.en : g.zh}"><h3><i class="cr-glyph">${GLYPH[g.id]}</i>${en ? g.en : g.zh}<small>${L(...g.hint)}</small></h3><div class="cr-cells">${ITEMS.filter((x) => x.group === g.id).map(cell).join('')}</div></section>`).join('')}`
    + `<p class="cr-none" hidden>${L('没有找到这个栏目。可以换个说法，或者到“统一搜索”里搜资源。', 'No section matches. Try other words, or search resources in Search.')}</p></div></div>`
    + `<div class="cr-mega-foot"><small>${L('点栏目旁边的图钉把它固定到顶栏；顶栏上的分组和按钮按住就能拖动换位；方向键选择，回车打开，Esc 关闭', 'Pin a section to the header with its pin; hold and drag the groups and buttons in the header to reorder them; arrows to move, Enter to open, Esc to close')}</small></div></div>`
    + `<div class="cr-tools">${toolOrder.map((k) => TOOLS[k]).join('')}</div>`
    + `<div class="cr-acct-pop" id="cr-acct-pop" hidden translate="no" role="dialog" aria-label="${L('账号', 'Account')}"></div>`;
  document.body.prepend(nav);

  const row = nav.querySelector('.cr-links'), pinBox = row.querySelector('.cr-pins'), menuBtn = row.querySelector('.cr-menu-btn');
  const grpBox = row.querySelector('.cr-grps'), toolBox = nav.querySelector('.cr-tools');
  const grpBtns = [...row.querySelectorAll('.cr-grp-btn')];
  const mega = nav.querySelector('.cr-mega'), findIn = mega.querySelector('.cr-find input'), sections = mega.querySelector('.cr-sections');
  const jumpBtn = nav.querySelector('#cr-jump');
  let items = [...pinBox.children]; // the pinned links in the bar
  const currentId = () => {
    const hash = (window.__CHEM_LOCATION__ || location).hash || '';
    if (section === 'atlas' && hash.startsWith('#agent')) return 'agent';
    return sectionItem[section] || section;
  };
  const markCurrent = () => {
    const id = currentId(), x = byId.get(id);
    nav.querySelectorAll('a[data-id]').forEach((a) => { if (a.dataset.id === id) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); });
    grpBtns.forEach((b) => b.toggleAttribute('data-current', !!x && x.group === b.dataset.group));
    mega.querySelectorAll('[data-rail]').forEach((b) => b.toggleAttribute('data-current', !!x && x.group === b.dataset.rail));
    const g = x && GROUPS.find((y) => y.id === x.group);
    menuBtn.querySelector('.cr-where').textContent = x ? `${en ? g.en : g.zh} · ${name(x)}` : '';
  };
  const markPins = () => {
    mega.querySelectorAll('.cr-pin-t').forEach((b) => { const on = pins.includes(b.dataset.pin); b.setAttribute('aria-pressed', String(on)); b.title = on ? L('从顶栏取下', 'Unpin from the header') : L('固定到顶栏', 'Pin to the header'); });
    const box = mega.querySelector('.cr-mega-pins');
    box.hidden = !pins.length;
    box.querySelector('span').innerHTML = pins.map((id) => pinA(byId.get(id))).join('');
  };
  const renderPins = () => {
    pinBox.innerHTML = pins.map((id) => pinA(byId.get(id))).join('');
    items = [...pinBox.children];
    markPins();
    fit();
  };
  const saveOrder = (ids) => { savePins(ids); renderPins(); };

  // ── Bar or compact. The bar shows the five group buttons and as many pinned links as fit; when even the groups do not fit
  //    (iPad portrait, phones, large interface scale) a single "栏目" button opens every group at once.
  const phone = matchMedia('(max-width:760px)');
  let compact = false;
  const fits = () => row.scrollWidth <= row.clientWidth + 0.5;
  let navDragging = false; // while a pinned link is lifted the row keeps its layout
  const fit = () => {
    if (navDragging) return;
    const was = compact;
    items.forEach((a) => { a.hidden = false; });
    menuBtn.hidden = true;
    grpBtns.forEach((b) => { b.hidden = false; });
    compact = phone.matches;
    if (!compact) {
      for (let i = items.length - 1; i >= 0 && !fits(); i--) items[i].hidden = true;
      compact = !fits();
    }
    if (compact) {
      grpBtns.forEach((b) => { b.hidden = true; });
      menuBtn.hidden = false;
      items.forEach((a) => { a.hidden = !phone.matches; });
    }
    nav.classList.toggle('cr-compact', compact);
    if (was !== compact && !mega.hidden) openMenu(compact ? null : activeGroup());
    markCurrent();
  };

  // ── The menu
  let active = '', opener = null, hoverTimer = 0;
  const activeGroup = () => active || byId.get(currentId())?.group || GROUPS[0].id;
  const showGroup = (g) => {
    active = g;
    mega.querySelectorAll('[data-rail]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.rail === g)));
    mega.querySelectorAll('.cr-sec').forEach((s) => s.toggleAttribute('data-active', s.dataset.group === g));
    grpBtns.forEach((b) => b.setAttribute('aria-expanded', String(!mega.hidden && !compact && b.dataset.group === g)));
  };
  function place() {
    const z = parseFloat(root.style.zoom) || 1, r = nav.getBoundingClientRect();
    // what is left of the window under the header, in the header's own CSS pixels (CSS zoom scales the rect, not the box)
    mega.style.maxHeight = `${Math.max(240, Math.floor((innerHeight - r.bottom) / z) - (phone.matches ? 0 : 16))}px`;
  }
  function openMenu(g, opts = {}) {
    closeAcct();
    mega.hidden = false;
    mega.classList.toggle('cr-all', compact || !!findIn.value.trim());
    nav.classList.add('cr-menu-open');
    showGroup(g || activeGroup());
    menuBtn.setAttribute('aria-expanded', String(compact));
    jumpBtn.setAttribute('aria-expanded', 'true');
    markPins();
    place();
    requestAnimationFrame(() => mega.classList.add('open'));
    if (opts.search) findIn.focus({ preventScroll: true });
    else if (opts.focus) (mega.querySelector(`.cr-sec[data-group="${active}"] .cr-item`) || findIn).focus({ preventScroll: true });
    if (compact && !opts.search) { const cur = mega.querySelector('.cr-item[aria-current]'); cur?.scrollIntoView({ block: 'center' }); }
  }
  function closeMenu(focusBack) {
    if (mega.hidden) return;
    mega.classList.remove('open');
    mega.hidden = true;
    nav.classList.remove('cr-menu-open');
    grpBtns.forEach((b) => b.setAttribute('aria-expanded', 'false'));
    menuBtn.setAttribute('aria-expanded', 'false');
    jumpBtn.setAttribute('aria-expanded', 'false');
    if (findIn.value) { findIn.value = ''; filter(); }
    if (focusBack && opener && document.contains(opener)) opener.focus({ preventScroll: true });
  }
  const isOpen = () => !mega.hidden;
  grpBtns.forEach((b) => {
    b.addEventListener('click', () => {
      opener = b;
      if (isOpen() && active === b.dataset.group && !findIn.value) closeMenu(); else { findIn.value = ''; filter(); openMenu(b.dataset.group); }
    });
    b.addEventListener('keydown', (e) => { if (e.key === 'ArrowDown') { e.preventDefault(); opener = b; openMenu(b.dataset.group, { focus: true }); } });
    // with a mouse, moving across the group buttons while the menu is open switches the group (a short delay keeps diagonal moves from flickering)
    b.addEventListener('pointerenter', (e) => {
      if (e.pointerType !== 'mouse' || !isOpen() || compact || findIn.value) return;
      clearTimeout(hoverTimer);
      hoverTimer = setTimeout(() => { opener = b; showGroup(b.dataset.group); }, 90);
    });
    b.addEventListener('pointerleave', () => clearTimeout(hoverTimer));
  });
  mega.querySelectorAll('[data-rail]').forEach((b) => {
    b.addEventListener('click', () => showGroup(b.dataset.rail));
    b.addEventListener('pointerenter', (e) => { if (e.pointerType === 'mouse') showGroup(b.dataset.rail); });
  });
  menuBtn.addEventListener('click', () => { opener = menuBtn; if (isOpen()) closeMenu(); else openMenu(null); });
  jumpBtn.addEventListener('click', () => { opener = jumpBtn; if (isOpen() && document.activeElement === findIn) closeMenu(); else openMenu(compact ? null : activeGroup(), { search: true }); });
  mega.querySelector('.cr-mega-x').addEventListener('click', () => closeMenu(true));
  mega.addEventListener('click', (e) => {
    const t = e.target.closest('.cr-pin-t');
    if (t) {
      e.preventDefault();
      const id = t.dataset.pin;
      saveOrder(pins.includes(id) ? pins.filter((x) => x !== id) : [...pins, id]);
      return;
    }
    if (e.target.closest('.cr-pins-edit')) { closeMenu(); arrange.open(); return; }
    if (e.target.closest('a[href]')) closeMenu();
  });
  document.addEventListener('pointerdown', (e) => { if (isOpen() && !nav.contains(e.target)) closeMenu(); });
  nav.addEventListener('focusout', (e) => { if (isOpen() && e.relatedTarget && !nav.contains(e.relatedTarget)) closeMenu(); });
  // Ctrl / ⌘ + K opens the menu with the search field focused. Pages with a search of their own (统一搜索, 数据库) already use
  // the shortcut for it; their handlers sit on document and run first, so here (on window) a handled key is left alone.
  window.addEventListener('keydown', (e) => {
    // Escape closes the menu wherever focus is (hovering another group can hide the link that had focus)
    if (e.key === 'Escape' && isOpen() && !e.defaultPrevented) { closeMenu(true); return; }
    if (e.key === 'Escape' && !acctPop.hidden && !e.defaultPrevented) { closeAcct(true); return; }
    if (e.defaultPrevented && !isOpen()) return;
    if ((e.metaKey || e.ctrlKey) && !e.altKey && (e.key === 'k' || e.key === 'K')) { e.preventDefault(); opener = document.activeElement; if (isOpen() && document.activeElement === findIn) closeMenu(true); else openMenu(compact ? null : activeGroup(), { search: true }); }
  });
  // Search: every section, its description, keywords and sub-pages; letters and pinyin-free Chinese both work by substring.
  const norm = (s) => String(s).toLowerCase().replace(/\s+/g, ' ').trim();
  const hay = new Map(ITEMS.map((x) => [x.id, norm([x.zh, x.en, x.dz, x.de, x.kw, ...x.subs.flat()].join(' '))]));
  function filter() {
    const q = norm(findIn.value), words = q ? q.split(' ') : [];
    let n = 0;
    mega.querySelectorAll('.cr-cell').forEach((c) => { const ok = !words.length || words.every((w) => hay.get(c.dataset.id).includes(w)); c.hidden = !ok; if (ok) n++; });
    mega.querySelectorAll('.cr-sec').forEach((s) => { s.hidden = !!words.length && !s.querySelector('.cr-cell:not([hidden])'); });
    mega.querySelector('.cr-none').hidden = n > 0;
    mega.classList.toggle('cr-all', compact || !!words.length);
    mega.classList.toggle('cr-searching', !!words.length);
    mega.querySelectorAll('.cr-item.cr-hit').forEach((a) => a.classList.remove('cr-hit'));
    if (words.length) mega.querySelector('.cr-cell:not([hidden]) .cr-item')?.classList.add('cr-hit');
  }
  findIn.addEventListener('input', filter);
  const visibleLinks = () => [...mega.querySelectorAll('.cr-item, .cr-subs a, .cr-mega-pins a')].filter((a) => a.offsetParent);
  mega.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeMenu(true); return; }
    if (e.target === findIn && e.key === 'Enter') { const hit = mega.querySelector('.cr-item.cr-hit') || visibleLinks()[0]; if (hit) { e.preventDefault(); hit.click(); } return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = visibleLinks(), i = list.indexOf(document.activeElement);
    if (!list.length) return;
    e.preventDefault();
    const j = e.target === findIn ? (e.key === 'ArrowDown' ? 0 : list.length - 1) : Math.max(-1, Math.min(list.length - 1, i + (e.key === 'ArrowDown' ? 1 : -1)));
    (j < 0 ? findIn : list[j]).focus({ preventScroll: false });
  });
  addEventListener('resize', () => { if (isOpen()) place(); });

  fit();
  markPins();
  // Re-fit when the row's width changes and when web fonts finish loading.
  new ResizeObserver(fit).observe(row);
  document.addEventListener('chemhub:i18n', fit);
  document.fonts?.ready.then(fit);
  window.addEventListener('hashchange', markCurrent);
  // On phones the pinned links scroll sideways: bring the current one into view.
  const current = pinBox.querySelector('[aria-current]');
  if (current && pinBox.scrollWidth > pinBox.clientWidth) pinBox.scrollLeft = Math.max(0, current.offsetLeft - (pinBox.clientWidth - current.offsetWidth) / 2);

  // ── Brand notice (TRADEMARKS.md): one line under the page's footer, or after its content. Full-screen app pages skip it.
  {
    const legal = document.createElement('p');
    legal.className = 'cr-legal';
    legal.innerHTML = `© ${new Date().getFullYear()} MolAstria · <a href="${link('about/index.html')}">阿斯特赖亚科技（Morning Glory）旗下项目</a> · <a href="${link('vision/index.html')}">愿景：工业革命2.5</a> · <span>由 Jiasheng Fu 运营；MolAstria 名称、徽标与吉祥物归 16513778 Canada Inc. 所有，保留所有权利；网站代码以 MIT 许可开源</span> · <a href="https://github.com/FelixJiashengFu/chem-research-molastria/blob/main/TRADEMARKS.md" target="_blank" rel="noopener noreferrer">品牌说明</a> · <a href="${link('api/index.html')}">开放数据接口</a>`;
    const placeLegal = () => {
      if (document.body.classList.contains('radar-page')) return;
      const foot = [...document.querySelectorAll('footer')].filter((f) => !f.closest('.cr-header, dialog, aside')).pop();
      // below the footer, not inside it: footers here are rows and grids of their own
      if (foot) foot.after(legal); else (document.querySelector('main') || document.body).append(legal);
    };
    if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', placeLegal, { once: true }); else placeLegal();
  }

  // ── Arranging the pinned links: a glass panel (from the menu's "整理", 显示 → 常用入口, or a long press on a pinned link)
  //    where the pinned ones are dragged, or moved with the arrow keys, into each person's order, and any section can be pinned
  //    or unpinned. Saved per browser; "清空" unpins everything.
  const arrange = (() => {
    const t = L;
    const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
    let layer = null, grid = null, pool = null, live = null, back = null, drag = null;
    const order = () => [...grid.children].map((el) => el.dataset.id);
    // The other tiles glide to their new places (FLIP). Rect differences are turned into the tiles' own CSS pixels,
    // because page zoom scales getBoundingClientRect differently from transforms in Chrome and in WebKit.
    const flip = (mutate) => {
      const before = new Map([...grid.children].map((el) => [el, el.getBoundingClientRect()]));
      mutate();
      if (reduced()) return;
      for (const el of grid.children) {
        const a = before.get(el); if (!a) continue;
        const b = el.getBoundingClientRect(), k = el.offsetWidth ? b.width / el.offsetWidth || 1 : 1;
        const dx = (a.left - b.left) / k, dy = (a.top - b.top) / k;
        if (Math.abs(dx) + Math.abs(dy) < 0.5) continue;
        el.animate([{ translate: `${dx}px ${dy}px` }, { translate: '0 0' }], { duration: 280, easing: 'cubic-bezier(.2,.8,.2,1)' });
      }
    };
    const say = (id) => {
      const ids = order(), n = ids.indexOf(id) + 1;
      live.textContent = t(`${byId.get(id).zh}：第 ${n} 位，共 ${ids.length} 个`, `${byId.get(id).en}: position ${n} of ${ids.length}`);
    };
    const tile = (id, current) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'cr-arr-tile';
      b.dataset.id = id;
      b.setAttribute('role', 'listitem');
      b.innerHTML = `${name(byId.get(id))}<span class="cr-arr-x" aria-hidden="true">×</span>`;
      b.setAttribute('aria-label', t(`${byId.get(id).zh}（按 Delete 取下）`, `${byId.get(id).en} (Delete to unpin)`));
      if (id === current) b.setAttribute('aria-current', 'page');
      return b;
    };
    const fillPool = () => {
      pool.innerHTML = GROUPS.map((g) => `<div class="cr-arr-group"><b>${en ? g.en : g.zh}</b>${g.items.map(([id]) => `<button type="button" class="cr-arr-chip" data-add="${id}" aria-pressed="${pins.includes(id)}">${name(byId.get(id))}</button>`).join('')}</div>`).join('');
    };
    const sync = () => { saveOrder(order()); fillPool(); };
    function build() {
      layer = document.createElement('div');
      layer.className = 'cr-arrange';
      layer.hidden = true;
      layer.setAttribute('translate', 'no');
      layer.innerHTML = `<div class="cr-arr-glass" role="dialog" aria-modal="true" aria-labelledby="cr-arr-h">
        <div class="cr-arr-head"><b id="cr-arr-h">${t('顶栏上的常用入口', 'Pinned in the header')}</b><small>${t('固定的栏目直接显示在顶栏上。拖动排成你习惯的顺序，也可以用方向键；点 × 或按 Delete 取下。只保存在这台设备上。', 'Pinned sections show right in the header. Drag them into your order, or use the arrow keys; × or Delete unpins. Saved on this device only.')}</small></div>
        <div class="cr-arr-grid" role="list" aria-label="${t('已固定', 'Pinned')}"></div>
        <p class="cr-arr-empty">${t('还没有固定任何栏目。从下面选几个常用的：', 'Nothing pinned yet. Pick a few you use often:')}</p>
        <div class="cr-arr-pool"></div>
        <p class="cr-arr-live" aria-live="polite"></p>
        <div class="cr-arr-foot"><small>${t('顶栏上的入口、五个分组和右边的按钮都能按住直接拖动换位', 'Pinned links, the five groups and the buttons on the right can all be held and dragged right in the header')}</small><button type="button" class="cr-arr-order">${t('分组和按钮恢复默认顺序', 'Default order for groups and buttons')}</button><button type="button" class="cr-arr-reset">${t('清空', 'Clear')}</button><button type="button" class="cr-arr-done">${t('完成', 'Done')}</button></div></div>`;
      document.body.append(layer);
      grid = layer.querySelector('.cr-arr-grid');
      pool = layer.querySelector('.cr-arr-pool');
      live = layer.querySelector('.cr-arr-live');
      layer.addEventListener('click', (e) => {
        if (e.target === layer || e.target.closest('.cr-arr-done')) { close(); return; }
        if (e.target.closest('.cr-arr-order')) { applyGroups([]); applyTools([]); fit(); live.textContent = t('分组和按钮已恢复默认顺序', 'Groups and buttons are back in the default order'); return; }
        if (e.target.closest('.cr-arr-reset')) { grid.replaceChildren(); sync(); live.textContent = t('已全部取下', 'Everything unpinned'); return; }
        const add = e.target.closest('[data-add]');
        if (add) {
          const id = add.dataset.add, el = grid.querySelector(`[data-id="${id}"]`);
          flip(() => { if (el) el.remove(); else grid.append(tile(id)); });
          sync();
          return;
        }
        const x = e.target.closest('.cr-arr-x');
        if (x) { const el = x.closest('.cr-arr-tile'); flip(() => el.remove()); sync(); }
      });
      layer.addEventListener('keydown', (e) => {
        if (e.key === 'Escape') { e.stopPropagation(); close(); return; }
        if (e.key === 'Tab') { // keep focus inside the panel
          const f = [...layer.querySelectorAll('button')], i = f.indexOf(document.activeElement);
          if (e.shiftKey ? i <= 0 : i === f.length - 1) { e.preventDefault(); f[e.shiftKey ? f.length - 1 : 0].focus(); }
          return;
        }
        const el = e.target.closest?.('.cr-arr-tile');
        if (el && (e.key === 'Delete' || e.key === 'Backspace')) { e.preventDefault(); const next = el.nextElementSibling || el.previousElementSibling; flip(() => el.remove()); sync(); (next || pool.querySelector('button')).focus(); return; }
        const k = { ArrowLeft: -1, ArrowUp: -1, ArrowRight: 1, ArrowDown: 1, Home: -999, End: 999 }[e.key];
        if (!el || !k) return;
        e.preventDefault();
        const kids = [...grid.children], i = kids.indexOf(el), j = Math.max(0, Math.min(kids.length - 1, i + k));
        if (i === j) return;
        flip(() => grid.insertBefore(el, j > i ? kids[j].nextSibling : kids[j]));
        el.focus();
        sync();
        say(el.dataset.id);
      });
      // Dragging: the list holds the pointer; the tile under it says where the lifted one goes. After a swap that
      // tile is left alone until the pointer moves on, so tiles of different widths do not flip back and forth.
      grid.addEventListener('pointerdown', (e) => {
        const el = e.target.closest('.cr-arr-tile');
        if (!el || e.button > 0 || e.target.closest('.cr-arr-x')) return;
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
        if (moved) { sync(); say(el.dataset.id); }
        el.focus({ preventScroll: true });
      };
      grid.addEventListener('pointerup', drop);
      grid.addEventListener('pointercancel', drop);
    }
    function open(id) {
      if (!layer) build();
      const cur = currentId();
      grid.replaceChildren(...pins.map((p) => tile(p, cur)));
      fillPool();
      back = document.activeElement;
      closeMenu();
      layer.hidden = false;
      requestAnimationFrame(() => layer.classList.add('open'));
      (grid.querySelector(`[data-id="${id}"]`) || grid.firstElementChild || pool.querySelector('button')).focus({ preventScroll: true });
    }
    function close() {
      layer.classList.remove('open');
      setTimeout(() => { layer.hidden = true; }, reduced() ? 0 : 200);
      if (back && document.contains(back)) back.focus({ preventScroll: true });
    }
    return { open };
  })();

  // ── Dragging in the header: the pinned links, the five group buttons and the buttons on the right each reorder within their
  //    own row. A mouse picks an item up as soon as it moves sideways; a finger (and a held mouse) lifts it after a short press,
  //    so the row and the page still scroll under a quick swipe. The lifted item turns into a drop of liquid glass that follows
  //    the pointer and stretches with its speed, the others slide aside, and on release it settles with a small wobble.
  //    Orders are saved per browser (molastria-nav-pins, molastria-nav-groups, molastria-nav-tools). Alt + Shift + ←/→ moves a
  //    focused group or button from the keyboard. Releasing a lifted pinned link without moving it opens the arrange panel.
  const HOLD = 420;
  const applyGroups = (ids) => {
    const o = ordered(GROUP_IDS, ids);
    GROUPS.sort((x, y) => o.indexOf(x.id) - o.indexOf(y.id));
    const by = (box, sel, key) => { const els = [...box.querySelectorAll(sel)]; o.forEach((id) => { const el = els.find((e) => e.dataset[key] === id); if (el) box.append(el); }); };
    by(grpBox, ':scope > .cr-grp-btn', 'group');
    by(mega.querySelector('.cr-rail'), ':scope > [data-rail]', 'rail');
    const secs = mega.querySelector('.cr-sections'), none = secs.querySelector('.cr-none');
    by(secs, ':scope > .cr-sec', 'group');
    secs.append(none);
    writeOrder(GORDER, o, GROUP_IDS);
  };
  const applyTools = (ids) => {
    const o = ordered(TOOL_IDS, ids);
    o.forEach((id) => { const el = toolBox.querySelector(`:scope > [data-tool="${id}"]`); if (el) toolBox.append(el); });
    writeOrder(TORDER, o, TOOL_IDS);
  };
  const SORTS = {
    pins: { box: pinBox, sel: 'a[data-id]', key: 'id', save: (ids) => saveOrder(ids) },
    groups: { box: grpBox, sel: '.cr-grp-btn', key: 'group', save: applyGroups },
    tools: { box: toolBox, sel: '[data-tool]', key: 'tool', save: applyTools },
  };
  const sortOf = (el) => (el.closest('.cr-pins') ? 'pins' : el.closest('.cr-grps') ? 'groups' : 'tools');
  const SORTABLE = '.cr-pins a[data-id], .cr-grps .cr-grp-btn, .cr-tools > [data-tool]';
  let press = null, pressed = false;
  const cancelPress = () => { if (press) clearTimeout(press.timer); press = null; };
  const reducedMotion = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const rowItems = (S) => [...S.box.children].filter((el) => el.matches(S.sel) && el.offsetWidth);
  function lift(p) {
    const S = SORTS[p.kind], box = S.box, els = rowItems(S), i = els.indexOf(p.a);
    if (i < 0) return false;
    closeMenu();
    closeAcct();
    const rr = box.getBoundingClientRect(), k = box.offsetWidth ? rr.width / box.offsetWidth || 1 : 1;
    // Layout positions in the row's own CSS pixels (scroll included), taken once: transforms during the drag do not move them.
    const at = (x) => (x - rr.left) / k + box.scrollLeft;
    const slots = els.map((el) => { const r = el.getBoundingClientRect(); return { el, mid: (at(r.left) + at(r.right)) / 2 }; });
    const gap = parseFloat(getComputedStyle(box).columnGap) || 0;
    p.drag = { S, box, els, i, j: i, k, slots, start: p.x, scroll0: box.scrollLeft, shift: p.a.offsetWidth + gap, moved: false, x: p.x, raf: 0, v: 0, t: performance.now() };
    navDragging = true;
    pressed = true;
    nav.classList.add('cr-nav-sorting');
    p.a.classList.add('cr-lifted');
    try { nav.setPointerCapture(p.id); } catch { /* pointer already gone */ }
    navigator.vibrate?.(8);
    return true;
  }
  function follow(p, x) {
    const d = p.drag, now = performance.now();
    // speed in px per ms, smoothed: the glass stretches along the motion and squeezes across it, like a drop being pulled
    const v = (x - d.x) / Math.max(8, now - d.t);
    d.v = d.v * 0.6 + v * 0.4;
    d.x = x;
    d.t = now;
    const dx = (x - d.start) / d.k + (d.box.scrollLeft - d.scroll0);
    if (Math.abs(dx) > 3) d.moved = true;
    p.a.style.translate = `${dx}px 0`;
    stretch(p);
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
  function stretch(p) {
    if (reducedMotion()) return;
    const s = Math.min(0.16, Math.abs(p.drag.v) * 0.09);
    p.a.style.scale = `${(1.1 + s).toFixed(3)} ${(1.1 - s * 0.55).toFixed(3)}`;
  }
  // While lifted: the stretch relaxes when the pointer rests, and on phones a link held near either edge of the pinned row
  // scrolls it along.
  function tick(p) {
    const d = p.drag;
    if (!d) return;
    if (performance.now() - d.t > 40) { d.v *= 0.8; stretch(p); }
    const box = d.box;
    if (box.scrollWidth > box.clientWidth) {
      const r = box.getBoundingClientRect(), edge = 36 * d.k;
      const v = d.x < r.left + edge ? -7 : d.x > r.right - edge ? 7 : 0;
      if (v) { box.scrollLeft += v; const t = d.t; follow(p, d.x); d.t = t; }
    }
    d.raf = requestAnimationFrame(() => tick(p));
  }
  function settle(p, keep) {
    const d = p.drag, S = d.S;
    cancelAnimationFrame(d.raf);
    navDragging = false;
    const before = new Map(d.els.map((el) => [el.dataset[S.key], el.getBoundingClientRect()]));
    for (const el of d.els) { el.style.transition = 'none'; el.style.translate = ''; }
    p.a.style.scale = '';
    p.a.classList.remove('cr-lifted');
    nav.classList.remove('cr-nav-sorting');
    if (keep && d.j !== d.i) {
      const ids = [...d.box.children].filter((el) => el.matches(S.sel)).map((el) => el.dataset[S.key]);
      const id = p.a.dataset[S.key];
      ids.splice(ids.indexOf(id), 1);
      const order = d.els.map((el) => el.dataset[S.key]);
      order.splice(d.i, 1);
      // after the j items now left of it: before the next one in the row, or right after the row's last
      ids.splice(d.j < order.length ? ids.indexOf(order[d.j]) : ids.indexOf(order[order.length - 1]) + 1, 0, id);
      S.save(ids);
      if (S !== SORTS.pins) fit();
    }
    // Everything glides from where it was shown to its new place; the dropped one lands with a small wobble.
    for (const el of rowItems(S)) {
      void el.offsetWidth;
      el.style.transition = '';
      if (reducedMotion()) continue;
      const a = before.get(el.dataset[S.key]); if (!a) continue;
      const b = el.getBoundingClientRect(), dx = (a.left - b.left) / d.k;
      if (el === p.a) el.animate([{ translate: `${dx}px 0`, scale: '1.1' }, { translate: '0 0', scale: '.95 1.04', offset: 0.55 }, { scale: '1.02 .99', offset: 0.8 }, { translate: '0 0', scale: '1' }], { duration: 460, easing: 'cubic-bezier(.2,.8,.25,1)' });
      else if (Math.abs(dx) > 0.5) el.animate([{ translate: `${dx}px 0` }, { translate: '0 0' }], { duration: 320, easing: 'cubic-bezier(.2,.9,.25,1.1)' });
    }
  }
  nav.addEventListener('pointerdown', (e) => {
    pressed = false;
    if (press?.drag) return;
    cancelPress();
    const a = e.target.closest(SORTABLE);
    if (!a || e.button > 0) return;
    const p = { a, kind: sortOf(a), id: e.pointerId, x: e.clientX, y: e.clientY, touch: e.pointerType !== 'mouse' };
    p.timer = setTimeout(() => {
      if (lift(p)) { tick(p); return; }
      press = null;
      if (p.kind === 'pins') { pressed = true; navigator.vibrate?.(8); arrange.open(a.dataset.id); }
    }, HOLD);
    press = p;
  });
  nav.addEventListener('pointermove', (e) => {
    const p = press;
    if (!p || e.pointerId !== p.id) return;
    if (p.drag) { e.preventDefault(); follow(p, e.clientX); return; }
    const dx = e.clientX - p.x, dy = e.clientY - p.y;
    if (Math.hypot(dx, dy) < 6) return;
    // a mouse dragging sideways picks the item up at once; anything else before the hold ends is a scroll or a slip
    if (!p.touch && Math.abs(dx) > Math.abs(dy) && lift(p)) { clearTimeout(p.timer); follow(p, e.clientX); tick(p); }
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
    if (!moved && e.type === 'pointerup' && p.kind === 'pins') arrange.open(p.a.dataset.id);
  };
  nav.addEventListener('pointerup', release);
  nav.addEventListener('pointercancel', release);
  nav.addEventListener('lostpointercapture', (e) => { if (press?.drag && e.pointerId === press.id) release({ type: 'pointerup', pointerId: e.pointerId }); });
  // Links are not dragged out as URLs (that is what made a drag do nothing), and a lifted item keeps the page from scrolling.
  nav.addEventListener('dragstart', (e) => { if (e.target.closest?.(SORTABLE)) e.preventDefault(); });
  nav.addEventListener('touchmove', (e) => { if (press?.drag) e.preventDefault(); }, { passive: false });
  // the click that ends a press or a drag must not also open the page or the button
  nav.addEventListener('click', (e) => { if (pressed) { pressed = false; e.preventDefault(); e.stopPropagation(); } }, true);
  // touch screens open their own link menu on a long press
  nav.addEventListener('contextmenu', (e) => { if ((press?.touch || pressed) && e.target.closest(SORTABLE)) e.preventDefault(); });
  // keyboard: Alt + Shift + ← / → moves a focused group or right-hand button one place
  nav.addEventListener('keydown', (e) => {
    if (!e.altKey || !e.shiftKey || (e.key !== 'ArrowLeft' && e.key !== 'ArrowRight')) return;
    const a = e.target.closest?.('.cr-grps .cr-grp-btn, .cr-tools > [data-tool]');
    if (!a) return;
    e.preventDefault();
    const S = SORTS[sortOf(a)], ids = [...S.box.children].filter((el) => el.matches(S.sel)).map((el) => el.dataset[S.key]);
    const id = a.dataset[S.key], i = ids.indexOf(id), j = Math.max(0, Math.min(ids.length - 1, i + (e.key === 'ArrowLeft' ? -1 : 1)));
    if (i === j) return;
    ids.splice(i, 1); ids.splice(j, 0, id);
    S.save(ids);
    fit();
    a.focus();
  });


  // ── Account. One button in place of the old "Pro" pill: "登录 / Sign in" until someone signs in, then their initial (a gold
  //    ring for Pro, VIP and lab plans). It opens a small glass panel with everything the Pro pill and the account page lead
  //    to: signing in, the plan and this period's AI allowance, API keys, the weekly picks, Pro, the desktop app, and signing out.
  //    Everything comes from the cached summary (molastria-account); nothing is fetched to draw it.
  const acctBtn = nav.querySelector('#cr-acct'), acctPop = nav.querySelector('#cr-acct-pop');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const planOf = (a) => {
    // the same reading as the account page: a grant without a billing cycle is a VIP card or the site admin's own access
    const gifted = !!a.grant && a.role === 'pro' && !a.cycle;
    const kind = gifted ? (a.grant.source === 'admin' ? 'admin' : 'vip') : ['pro', 'owner', 'member'].includes(a.role) && a.pro ? a.role : 'free';
    return { kind, label: { pro: 'Pro', owner: L('课题组', 'Lab'), member: L('课题组成员', 'Lab member'), free: L('免费账号', 'Free account'), vip: 'VIP', admin: L('站长', 'Admin') }[kind] };
  };
  const apRow = (href, icon, title, sub, attrs = '') => `<a class="cr-ap-row" href="${link(href)}"${attrs}><i aria-hidden="true">${icon}</i><span><b>${title}</b>${sub ? `<small>${sub}</small>` : ''}</span></a>`;
  const IC = {
    key: '<svg viewBox="0 0 24 24"><circle cx="8" cy="15" r="4"/><path d="m11 12 8.5-8.5M16 7l2.5 2.5M14 9l2 2"/></svg>',
    star: '<svg viewBox="0 0 24 24"><path d="M12 3.5c.7 4.6 2.9 6.8 7.5 7.5-4.6.7-6.8 2.9-7.5 7.5-.7-4.6-2.9-6.8-7.5-7.5 4.6-.7 6.8-2.9 7.5-7.5Z"/></svg>',
    mail: '<svg viewBox="0 0 24 24"><rect x="3.5" y="5.5" width="17" height="13" rx="2.5"/><path d="m4.5 7 7.5 6 7.5-6"/></svg>',
    app: '<svg viewBox="0 0 24 24"><rect x="3.5" y="4.5" width="17" height="12" rx="2"/><path d="M9 20h6M12 16.5V20"/></svg>',
    user: '<svg viewBox="0 0 24 24"><circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20c1.2-3.9 4.1-5.8 7.5-5.8s6.3 1.9 7.5 5.8"/></svg>',
    card: '<svg viewBox="0 0 24 24"><rect x="3" y="6" width="18" height="12" rx="2.5"/><path d="M3 10h18M7 14.5h4"/></svg>',
    shield: '<svg viewBox="0 0 24 24"><path d="M12 3.5 19 6v5.5c0 4.2-2.9 7.6-7 9-4.1-1.4-7-4.8-7-9V6Z"/><path d="m9 12 2.2 2.2L15.5 10"/></svg>',
  };
  function paintAcct() {
    const a = readAccount();
    const p = a && planOf(a);
    acctBtn.dataset.state = !a ? 'out' : p.kind === 'free' ? 'free' : 'pro';
    if (!a) {
      acctBtn.innerHTML = `${person}<span class="cr-acct-t">${L('登录', 'Sign in')}</span>`;
      acctBtn.setAttribute('aria-label', L('登录、Pro 与桌面版', 'Sign in, Pro and the desktop app'));
      acctBtn.title = L('登录、Pro 与桌面版', 'Sign in, Pro and the desktop app');
    } else {
      const initial = (String(a.email || '?').trim()[0] || '?').toUpperCase();
      acctBtn.innerHTML = `<span class="cr-avatar" aria-hidden="true">${esc(initial)}</span>${p.kind === 'free' ? '' : `<span class="cr-acct-tag">${esc(p.kind === 'owner' || p.kind === 'member' ? 'Pro' : p.label)}</span>`}`;
      acctBtn.setAttribute('aria-label', L(`我的账号：${a.email}（${p.label}）`, `My account: ${a.email} (${p.label})`));
      acctBtn.title = `${a.email} · ${p.label}`;
    }
    if (!acctPop.hidden) fillAcct();
  }
  function fillAcct() {
    const a = readAccount();
    if (!a) {
      acctPop.innerHTML = `<div class="cr-ap-head"><span class="cr-avatar cr-ghost" aria-hidden="true">${person}</span><div><b>${L('登录 MolAstria', 'Sign in to MolAstria')}</b><small>${L('邮箱收一个 6 位验证码就能登录，不需要密码。所有内容不登录也能看。', 'A 6-digit code by email, no password. Everything on the site works without an account too.')}</small></div></div>`
        + `<a class="cr-ap-go" href="${link('pro/account.html')}">${L('用邮箱登录', 'Sign in with email')}</a>`
        + `<div class="cr-ap-list">${apRow('pro/index.html', IC.star, L('Pro 支持者', 'Pro supporter'), L('支持 MolAstria，AI 托管额度和在线模型次数更多', 'Support MolAstria and get more hosted AI and online-model runs'))}`
        + apRow('api/index.html', IC.key, L('开放数据接口与计算接口', 'Open data and compute API'), L('登录后可以生成自己的 API key', 'Sign in to create your own API keys'))
        + apRow('digest/index.html', IC.mail, L('每周精选', 'Weekly Picks'), L('登录后可以订阅邮件', 'Sign in to get it by email'))
        + apRow('download/index.html', IC.app, L('桌面版', 'Desktop app'), L('Windows 和 macOS，可在本机跑 UMA', 'Windows and macOS, runs UMA locally'))
        + `</div><div class="cr-ap-foot"><a href="${link('pro/account.html#vip')}">${L('我有 VIP 卡', 'I have a VIP card')}</a><a href="${link('pro/terms.html')}">${L('条款', 'Terms')}</a><a href="${link('pro/privacy.html')}">${L('隐私', 'Privacy')}</a></div>`;
      return;
    }
    const p = planOf(a), u = a.usage;
    const meter = u && u.limit > 0 ? (() => {
      const pct = Math.max(0, Math.min(100, Math.round((u.asks / u.limit) * 100)));
      return `<div class="cr-ap-meter"><span>${L('AI 托管额度', 'Hosted AI')}<b>${u.asks} / ${u.limit}</b><small>${u.period === 'day' ? L('24 小时内', 'last 24 h') : L('本月', 'this month')}</small></span><i role="meter" aria-label="${L('已用 AI 托管额度', 'Hosted AI used')}" aria-valuemin="0" aria-valuemax="${u.limit}" aria-valuenow="${u.asks}"><em style="width:${pct}%"></em></i></div>`;
    })() : '';
    const gifted = p.kind === 'vip' || p.kind === 'admin';
    acctPop.innerHTML = `<div class="cr-ap-head"><span class="cr-avatar" data-plan="${p.kind}" aria-hidden="true">${esc((String(a.email || '?').trim()[0] || '?').toUpperCase())}</span><div><b class="cr-ap-mail">${esc(a.email)}</b><small><span class="cr-ap-plan" data-plan="${p.kind}">${esc(p.label)}</span>${a.status === 'past_due' ? ` <span class="cr-ap-warn">${L('付款未成功', 'Payment failed')}</span>` : ''}</small></div></div>`
      + meter
      + `<div class="cr-ap-list">${apRow('pro/account.html', IC.user, L('我的账号', 'My account'), L('套餐、额度、课题组成员', 'Plan, allowance, lab members'))}`
      + apRow('pro/account.html#keys-card', IC.key, 'API key', L('给程序用的计算接口，今天的用量', 'For the compute API, with today’s usage'))
      + apRow('pro/account.html#digest-card', IC.mail, L('每周精选', 'Weekly Picks'), L('订阅邮件或发一份到邮箱', 'Subscribe, or send one to your inbox'))
      + (a.admin ? apRow('pro/account.html#admin-card', IC.shield, L('站长：VIP 卡', 'Admin: VIP cards'), L('发卡、收回、生成本期精选', 'Issue and revoke cards, build the digest')) : '')
      + (a.pro && !gifted && a.role !== 'member' ? apRow('pro/account.html#manage', IC.card, L('订阅与付款', 'Subscription and billing'), L('管理订阅、付款方式与发票', 'Manage the plan, card and invoices'))
        : a.pro ? '' : apRow('pro/index.html', IC.star, L('成为 Pro 支持者', 'Become a Pro supporter'), L('AI 托管额度和在线模型次数更多', 'More hosted AI and online-model runs')))
      + apRow('download/index.html', IC.app, L('桌面版', 'Desktop app'), L('Windows 和 macOS', 'Windows and macOS'))
      + `</div><div class="cr-ap-foot"><button type="button" class="cr-ap-out">${L('退出登录', 'Sign out')}</button><a href="${link('pro/index.html')}">${L('价格与条款', 'Pricing and terms')}</a></div>`;
  }
  function placeAcct() {
    if (phone.matches) { acctPop.style.left = ''; acctPop.style.right = ''; return; }
    // under the button, right edges aligned, kept inside the header (CSS zoom scales the rects, not the box)
    const z = nav.offsetWidth ? nav.getBoundingClientRect().width / nav.offsetWidth || 1 : 1;
    const nr = nav.getBoundingClientRect(), br = acctBtn.getBoundingClientRect();
    acctPop.style.right = `${Math.max(10, (nr.right - br.right) / z)}px`;
    acctPop.style.left = 'auto';
  }
  function openAcct() {
    if (!acctPop.hidden) return;
    closeMenu();
    fillAcct();
    acctPop.hidden = false;
    placeAcct();
    acctBtn.setAttribute('aria-expanded', 'true');
    requestAnimationFrame(() => acctPop.classList.add('open'));
    acctPop.querySelector('a, button')?.focus({ preventScroll: true });
  }
  function closeAcct(focusBack) {
    if (!acctPop || acctPop.hidden) return;
    acctPop.classList.remove('open');
    acctPop.hidden = true;
    acctBtn.setAttribute('aria-expanded', 'false');
    if (focusBack) acctBtn.focus({ preventScroll: true });
  }
  // Phones have no room for one more button in the first row: there the account button sits at the end of the second row,
  // opposite 栏目 (where the Pro link used to be), and goes back to its saved place among the buttons on wider screens.
  const homeAcct = () => {
    if (phone.matches) { if (acctBtn.parentNode !== row) row.append(acctBtn); return; }
    if (acctBtn.parentNode === toolBox) return;
    const o = ordered(TOOL_IDS, readOrder(TORDER)), after = o.slice(o.indexOf('acct') + 1);
    toolBox.insertBefore(acctBtn, after.map((id) => toolBox.querySelector(`:scope > [data-tool="${id}"]`)).find(Boolean) || null);
  };
  homeAcct();
  phone.addEventListener?.('change', () => { closeAcct(); homeAcct(); });
  acctBtn.addEventListener('click', () => { if (acctPop.hidden) openAcct(); else closeAcct(); });
  acctPop.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') { e.preventDefault(); e.stopPropagation(); closeAcct(true); return; }
    if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
    const list = [...acctPop.querySelectorAll('a, button')], i = list.indexOf(document.activeElement);
    e.preventDefault();
    list[(i + (e.key === 'ArrowDown' ? 1 : -1) + list.length) % list.length]?.focus();
  });
  acctPop.addEventListener('click', (e) => {
    if (e.target.closest('.cr-ap-out')) {
      e.preventDefault();
      closeAcct(true);
      // the account page has its own sign-out, which also clears what it shows
      const own = document.getElementById('signout');
      if (own && !own.closest('[hidden]')) { own.click(); return; }
      (window.MOLASTRIA_PAY ? Promise.resolve() : addScript('pay/config.js'))
        .then(() => window.MolAstriaAccount || addScript('pay/account.js'))
        .then(() => window.MolAstriaAccount.signOut())
        .catch(() => { try { localStorage.removeItem('molastria-session'); localStorage.removeItem('molastria-account'); } catch {} document.dispatchEvent(new CustomEvent('molastria:account', { detail: null })); });
      return;
    }
    if (e.target.closest('a[href]')) closeAcct();
  });
  document.addEventListener('pointerdown', (e) => { if (!acctPop.hidden && !acctPop.contains(e.target) && !acctBtn.contains(e.target)) closeAcct(); });
  nav.addEventListener('focusout', (e) => { if (!acctPop.hidden && e.relatedTarget && !acctPop.contains(e.relatedTarget) && e.relatedTarget !== acctBtn) closeAcct(); });
  addEventListener('resize', () => { if (!acctPop.hidden) placeAcct(); });
  // another tab signing in or out
  addEventListener('storage', (e) => { if (e.key === 'molastria-account' || e.key === 'molastria-session') { paintAcct(); refreshDot(); } });
  paintAcct();

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
      <div class="cr-disp-row cr-disp-arr-row"><div><b>${t('常用入口', 'Pinned sections')}</b><small>${t('把常用的栏目固定到顶栏，并排好顺序', 'Pin the sections you use to the header and order them')}</small></div><button type="button" class="cr-disp-arr">${t('调整', 'Arrange')}</button></div>
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
  document.addEventListener('molastria:account', () => { paintAcct(); refreshDot(); });
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
