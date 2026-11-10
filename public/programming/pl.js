/* 编程语言教学区：页面全由 pl-data.js 画出来。内容中英两版，按站点语言取用，标 translate="no"，不走 i18n.js 的词典。
   地址 #lang-<id> 滚到一种语言的卡片，#code-<id> 打开“同一道题”里那种语言的代码。Python 的代码可以用 viewer/pyrun.js 在浏览器里运行。 */
(() => {
  const D = window.MOLASTRIA_PL;
  const main = document.getElementById('pl');
  if (!D || !main) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const T = (zh, e) => (en ? e : zh);
  const tx = (v) => (v && typeof v === 'object' && !Array.isArray(v) ? (en ? v.en : v.zh) ?? v.zh : v ?? '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safe = (u) => (/^(https:\/\/|\.\.\/|#)/.test(u) ? u : '#');
  const byId = Object.fromEntries(D.langs.map((l) => [l.id, l]));
  const snippets = D.langs.flatMap((l) => l.snippets.map((s, i) => ({ ...s, owner: l, key: l.snippets.length > 1 ? `${l.id}-${i}` : l.id })));
  const tested = D.langs.filter((l) => l.snippets.some((s) => s.tested)).length;
  const untested = snippets.filter((s) => !s.tested);
  const chip = (id) => (byId[id] ? `<a class="pl-chip" href="#lang-${id}">${esc(byId[id].name)}</a>` : '');
  const ext = (href, text) => `<a href="${esc(safe(href))}" target="_blank" rel="noopener">${esc(text)}<i class="ico-ext" aria-hidden="true"></i></a>`;

  const hero = `<header class="pl-hero">
    <div><p class="eyebrow">${T('学习 · 编程语言', 'LEARN · PROGRAMMING')}</p>
    <h1>${T('计算物理与化学<br>要用的编程语言', 'Programming languages for<br>computational physics and chemistry')}</h1>
    <p class="lead">${T('从 Python 和 Fortran 到 MPI、CUDA 和量子线路：每种语言在这一行里干什么、哪些常用程序用它写、先学什么。所有语言都写同一道题，可以并排比较，大部分代码已经在本机跑过。', 'From Python and Fortran to MPI, CUDA and quantum circuits: what each language does in this field, which well-known codes use it, and what to learn first. Every language solves the same small problem so you can compare them side by side, and most of the code has been run.')}</p>
    <p class="actions"><a class="button primary" href="#pl-path">${T('看学习路线', 'See the learning path')}</a><a class="button" href="#pl-code">${T('同一道题的写法', 'One problem, every language')}</a></p></div>
    <dl class="pl-facts"><div><dt>${D.langs.length}</dt><dd>${T('种语言和工具链', 'languages and toolchains')}</dd></div><div><dt>${tested}</dt><dd>${T('种语言的代码已在本机跑通', 'with code run here')}</dd></div><div><dt>${D.paths.length}</dt><dd>${T('个研究方向的推荐组合', 'research directions mapped')}</dd></div><div><dt>−3.000000</dt><dd>${T('每段代码都该打印的答案', 'what every program prints')}</dd></div></dl>
  </header>`;

  const path = `<section class="pl-sec" id="pl-path" aria-labelledby="pl-path-h"><h2 id="pl-path-h">${T('学习路线', 'A learning path')}</h2>
    <p class="pl-sub">${T('不必全学。大多数人按下面的顺序学到第 2 步，之后看自己的方向再往下。', 'You do not need all of them. Most people go to step 2 in this order, then continue as their field requires.')}</p>
    <ol class="pl-stages">${D.stages.map((s) => `<li><b>${esc(tx(s))}</b><p>${esc(tx(s.note))}</p><p class="pl-chips">${s.langs.map(chip).join('')}${s.link ? ext(en ? s.link[3] : s.link[2], en ? s.link[1] : s.link[0]) : ''}</p></li>`).join('')}</ol></section>`;

  const dirs = `<section class="pl-sec" id="pl-dirs" aria-labelledby="pl-dirs-h"><h2 id="pl-dirs-h">${T('按方向选语言', 'Pick by research direction')}</h2>
    <div class="pl-dir-grid">${D.paths.map((p) => `<article class="pl-dir"><h3>${esc(tx(p))}</h3><p>${esc(tx(p.note))}</p><p class="pl-chips">${p.langs.map(chip).join('')}</p></article>`).join('')}</div></section>`;

  const tiers = Object.keys(D.tiers);
  const card = (l) => `<article class="pl-card" id="lang-${l.id}" data-tier="${l.tier}">
    <header><span class="pl-glyph" aria-hidden="true">${esc(l.glyph)}</span><div><h3>${esc(l.name)}</h3><p class="pl-meta">${esc(tx(D.tiers[l.tier]))} · ${l.year}${l.snippets.some((s) => s.tested) ? ` · <span class="pl-ok">${T('代码已在本机跑通', 'code run here')}</span>` : ` · <span class="pl-warn">${T('代码未在本机运行', 'code not run here')}</span>`}</p></div></header>
    <p>${esc(tx(l.role))}</p>
    <p class="pl-used"><span>${T('常见于', 'Found in')}</span>${l.used.map((u) => `<em>${esc(tx(u))}</em>`).join('')}</p>
    <dl class="pl-pc"><div><dt>${T('长处', 'Strengths')}</dt><dd>${esc(tx(l.good))}</dd></div><div><dt>${T('留意', 'Watch out')}</dt><dd>${esc(tx(l.watch))}</dd></div></dl>
    <details><summary>${T('从哪里开始', 'Where to start')}</summary><ol>${tx(l.start).map((s) => `<li>${esc(s)}</li>`).join('')}</ol></details>
    <p class="pl-links">${l.links.map(([z, e, h]) => ext(h, en ? e : z)).join('')}<a class="pl-tocode" href="#code-${l.id}">${T('看它的代码', 'See its code')}<i class="ico-down" aria-hidden="true"></i></a></p>
  </article>`;
  const langs = `<section class="pl-sec" id="pl-langs" aria-labelledby="pl-langs-h"><h2 id="pl-langs-h">${T('全部语言', 'All languages')}</h2>
    <div class="pl-filter" role="toolbar" aria-label="${T('按类别筛选', 'Filter by group')}"><button type="button" data-tier="" aria-pressed="true">${T('全部', 'All')} <small>${D.langs.length}</small></button>${tiers.map((t) => `<button type="button" data-tier="${t}" aria-pressed="false" title="${esc(tx(D.tiers[t].hint))}">${esc(tx(D.tiers[t]))} <small>${D.langs.filter((l) => l.tier === t).length}</small></button>`).join('')}
    <label class="pl-search"><span class="sr-only">${T('搜索', 'Search')}</span><input type="search" placeholder="${T('搜索语言或程序，如 VASP、GPU…', 'Search a language or code, e.g. VASP, GPU…')}" autocomplete="off"></label></div>
    <div class="pl-grid">${D.langs.map(card).join('')}</div><p class="pl-empty" hidden>${T('没有找到。换个词试试。', 'Nothing found. Try another word.')}</p></section>`;

  const label = (s) => (s.title ? tx(s.title) : s.owner.name);
  const tab = (s) => `<button type="button" role="tab" id="tab-${s.key}" data-key="${s.key}" aria-selected="false" aria-controls="pl-panel" tabindex="-1">${esc(label(s))}${s.tested ? '' : '<sup>*</sup>'}</button>`;
  const code = `<section class="pl-sec" id="pl-code" aria-labelledby="pl-code-h"><h2 id="pl-code-h">${T('同一道题，每种语言写一遍', 'One problem, every language')}</h2>
    <p class="pl-sub">${esc(tx(D.task))}</p>
    <div class="pl-tabs" role="tablist" aria-label="${T('语言', 'Languages')}">${snippets.map(tab).join('')}</div>
    <div class="pl-panel" id="pl-panel" role="tabpanel" tabindex="0"></div>
    <p class="pl-fine">* ${T('没有在本机运行：', 'Not run here: ')}${untested.map((s) => esc(label(s))).join(T('、', ', '))}${T('（这里没有对应的编译器、显卡或许可证）。其余代码在 ', ' (no compiler, GPU or licence available). The rest were run on ')}${esc(D.checked)}${T(' 用写出的命令跑过，打印的结果和页面上一致。', ' with the commands shown and printed what the page says.')}</p></section>`;

  const ex = `<section class="pl-sec" id="pl-ex" aria-labelledby="pl-ex-h"><h2 id="pl-ex-h">${T('接着练', 'Keep practising')}</h2>
    <ol class="pl-ex">${D.exercises.map((e) => `<li>${esc(tx(e))}</li>`).join('')}</ol>
    <p class="pl-sub">${T('想要有人一步一步带着学，可以去', 'For step-by-step guidance, try the')} <a href="../learn/index.html">${T('研习台', 'Study Desk')}</a>${T('；理论背景在', '; the theory is in the')} <a href="../manual/index.html">${T('讲解手册', 'Manual')}</a>${T('，现成的输入文件生成器在', ', and ready-made input generators are in the')} <a href="../code/index.html">${T('开源代码台', 'Code Desk')}</a>${T('。', '.')}</p></section>`;

  main.innerHTML = `<div translate="no" lang="${lang}">${hero}${path}${dirs}${langs}${code}${ex}</div>`;

  // ── 筛选
  const grid = main.querySelector('.pl-grid');
  const empty = main.querySelector('.pl-empty');
  const st = { tier: '', q: '' };
  const hay = Object.fromEntries(D.langs.map((l) => [l.id, [l.name, l.role.zh, l.role.en, ...l.used.flatMap((u) => (typeof u === 'string' ? [u] : [u.zh, u.en])), tx(D.tiers[l.tier])].join(' ').toLowerCase()]));
  const apply = () => {
    let n = 0;
    grid.querySelectorAll('.pl-card').forEach((c) => {
      const id = c.id.slice(5);
      const show = (!st.tier || c.dataset.tier === st.tier) && (!st.q || hay[id].includes(st.q));
      c.hidden = !show;
      n += show;
    });
    empty.hidden = n > 0;
  };
  main.querySelectorAll('.pl-filter button').forEach((b) => b.addEventListener('click', () => {
    st.tier = b.dataset.tier;
    main.querySelectorAll('.pl-filter button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    apply();
  }));
  main.querySelector('.pl-search input').addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(); apply(); });

  // ── 代码标签
  const panel = document.getElementById('pl-panel');
  const tabs = [...main.querySelectorAll('.pl-tabs [role=tab]')];
  let runner = null;
  function show(key, focus) {
    const s = snippets.find((x) => x.key === key) || snippets[0];
    tabs.forEach((t) => { const on = t.dataset.key === s.key; t.setAttribute('aria-selected', String(on)); t.tabIndex = on ? 0 : -1; if (on && focus) t.focus(); });
    panel.setAttribute('aria-labelledby', `tab-${s.key}`);
    if (runner) { try { runner.destroy(); } catch { /* 已经结束 */ } runner = null; }
    const py = s.file.endsWith('.py');
    panel.innerHTML = `<div class="pl-panel-head"><span class="pl-file">${esc(s.file)}</span>${s.tested ? `<span class="pl-badge ok">${T('已在本机跑通', 'Run here')}</span>` : `<span class="pl-badge warn">${T('未在本机运行', 'Not run here')}</span>`}<a class="pl-tocard" href="#lang-${s.owner.id}">${T('关于 ', 'About ')}${esc(s.owner.name)}</a><button type="button" class="button small pl-copy">${T('复制', 'Copy')}</button>${py ? `<button type="button" class="button small primary pl-run">${T('在浏览器里运行', 'Run in the browser')}</button>` : ''}</div>
      <pre class="pl-pre" translate="no"><code>${esc(s.code)}</code></pre>
      <p class="pl-cmd"><span>${T('运行', 'Run')}</span><code>${esc(s.run)}</code></p><div class="pl-runbox" hidden></div>`;
    panel.querySelector('.pl-copy').addEventListener('click', async (e) => {
      const b = e.currentTarget;
      try { await navigator.clipboard.writeText(s.code); b.textContent = T('已复制', 'Copied'); } catch { b.textContent = T('请手动选中复制', 'Select and copy manually'); }
      setTimeout(() => { b.textContent = T('复制', 'Copy'); }, 1600);
    });
    const run = panel.querySelector('.pl-run');
    if (run) run.addEventListener('click', () => {
      if (!window.MolAstriaPy) return;
      const box = panel.querySelector('.pl-runbox');
      box.hidden = false;
      panel.querySelector('.pl-pre').hidden = true;
      run.remove();
      const pk = /import numpy/.test(s.code) ? ['numpy'] : /import sympy/.test(s.code) ? ['sympy'] : [];
      runner = window.MolAstriaPy.mount(box, { code: s.code, packages: pk, name: s.file, lang: en ? 'en' : 'zh' });
      runner.run();
    });
    return s;
  }
  tabs.forEach((t, i) => {
    t.addEventListener('click', () => show(t.dataset.key));
    t.addEventListener('keydown', (e) => {
      const d = { ArrowRight: 1, ArrowLeft: -1, Home: -i, End: tabs.length - 1 - i }[e.key];
      if (d === undefined) return;
      e.preventDefault();
      show(tabs[(i + d + tabs.length) % tabs.length].dataset.key, true);
    });
  });
  const fromHash = () => {
    const m = location.hash.match(/^#(code|lang)-([\w-]+)$/);
    if (!m) return false;
    if (m[1] === 'code') {
      const key = snippets.some((s) => s.key === m[2]) ? m[2] : snippets.find((s) => s.owner.id === m[2])?.key;
      if (!key) return false;
      show(key);
      document.getElementById('pl-code').scrollIntoView({ block: 'start' });
      return true;
    }
    const c = document.getElementById(`lang-${m[2]}`);
    if (!c) return false;
    if (c.hidden) { st.tier = ''; st.q = ''; main.querySelector('.pl-search input').value = ''; main.querySelectorAll('.pl-filter button').forEach((x) => x.setAttribute('aria-pressed', String(!x.dataset.tier))); apply(); }
    c.scrollIntoView({ block: 'start' });
    c.classList.add('pl-flash');
    setTimeout(() => c.classList.remove('pl-flash'), 1400);
    return true;
  };
  window.addEventListener('hashchange', fromHash);
  if (!fromHash()) show(snippets[0].key);
})();
