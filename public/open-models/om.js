/* 开放模型馆：母栏目页（body 没有 data-org）和各家公司的展馆页（body[data-org]），都由 om-data.js 画出来。
   Meta 的展馆是现成的 /meta/ 页，它只用这里的 crumbs() 和 switcher() 两段（body[data-om-host=meta]）。
   内容中英两版，按站点语言取用，标 translate="no"，不走 i18n.js 的词典。 */
(() => {
  const D = window.MOLASTRIA_OM;
  if (!D) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const tx = (v) => (v && typeof v === 'object' ? (en ? v.en : v.zh) ?? v.zh : v ?? '');
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const T = (zh, e) => (en ? e : zh);
  const host = document.body.dataset.omHost; // 'meta' on the Meta page
  const orgId = document.body.dataset.org || host || '';
  const org = D.orgs.find((o) => o.id === orgId);
  // paths from this page back to public/: the hall is /open-models/, a pavilion /open-models/<id>/, the Meta page /meta/
  const up = host ? '../' : orgId ? '../../' : '../';
  const rel = (o) => up + (o.path ? 'meta/index.html' : `open-models/${o.id}/index.html`);
  const hubHref = `${up}open-models/index.html`;
  const C = (html, tag = 'span', cls = '', extra = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}"${extra}>${html}</${tag}>`;
  const safeUrl = (u) => (/^(https:\/\/|\.\.\/|#)/.test(u) ? u : '#');
  const linkName = (k) => tx(D.linkNames[k]) || k;
  const ext = (u) => /^https:/.test(u);
  const itemLinks = (it) => it.links.map(([k, u]) => `<a href="${esc(safeUrl(u))}"${ext(u) ? ' target="_blank" rel="noopener"' : ''}>${esc(linkName(k))}</a>`).join('');
  const lic = (it) => tx(it.lic);
  const card = (it, o) => `<article class="mx-item om-item" data-kind="${esc(it.kind)}" data-use="${esc(it.use)}" data-org="${esc(o.id)}" data-key="${esc(o.id)}:${esc(it.id)}" translate="no" lang="${lang}">
    <p class="mx-meta"><span class="mx-tag">${esc(tx(D.kinds[it.kind]))}</span>${it.year ? esc(it.year) : ''}${!orgId || host ? `<a class="om-org" href="${esc(rel(o))}">${esc(tx(o.name))}</a>` : ''}${it.used ? `<span class="mx-tag used">${T('本站在用', 'Used here')}</span>` : ''}</p>
    <h3>${esc(it.name)}</h3><p>${esc(tx(it.desc))}</p>
    <p class="mx-lic"><span class="om-use" data-use="${esc(it.use)}">${esc(tx(D.uses[it.use]))}</span> · ${esc(lic(it))}</p>
    <p class="mx-links">${itemLinks(it)}</p></article>`;

  // ── 位置和展馆切换（展馆页和 Meta 页都有）
  function crumbs(el) {
    if (!el || !org) return;
    el.innerHTML = `<a href="${hubHref}" translate="no">${T('开放模型馆', 'Open Model Hall')}</a><span aria-hidden="true">·</span>${C(esc(tx(org.name)))}`;
  }
  function switcher(el) {
    if (!el) return;
    el.innerHTML = `<h2>${C(T('馆里的其他展馆', 'Other pavilions in the hall'))}</h2><ul class="om-switch-list">${D.orgs.map((o) => `<li><a href="${esc(rel(o))}"${o.id === orgId ? ' aria-current="page"' : ''} translate="no" lang="${lang}"><b>${esc(tx(o.name))}</b><small>${esc(o.glyph)}</small></a></li>`).join('')}<li><a class="om-switch-hub" href="${hubHref}" translate="no" lang="${lang}"><b>${T('回到开放模型馆', 'Back to the hall')}</b><small>${T('按任务比较各家模型', 'Compare by task')}</small></a></li></ul>`;
  }
  crumbs(document.getElementById('om-crumbs'));
  switcher(document.getElementById('om-switch'));
  if (host) return;

  const $ = (id) => document.getElementById(id);
  const main = $('om');

  // ── 筛选：类型、使用条件、搜索
  function filters(items, pool) {
    const kinds = [...new Set(items.map((i) => i.kind))];
    const uses = [...new Set(items.map((i) => i.use))];
    const box = document.createElement('div');
    box.className = 'om-filters';
    box.setAttribute('translate', 'no');
    box.innerHTML = `<div class="mx-filter" role="toolbar" aria-label="${T('按类型筛选', 'Filter by kind')}"><button type="button" data-kind="" aria-pressed="true">${T('全部', 'All')}</button>${kinds.map((k) => `<button type="button" data-kind="${k}" aria-pressed="false">${esc(tx(D.kinds[k]))}</button>`).join('')}</div>
      <div class="mx-filter om-uses" role="toolbar" aria-label="${T('按使用条件筛选', 'Filter by terms')}"><button type="button" data-use="" aria-pressed="true">${T('任何许可', 'Any terms')}</button>${uses.map((u) => `<button type="button" data-use="${u}" aria-pressed="false">${esc(tx(D.uses[u]))}</button>`).join('')}
      <label class="mx-search"><span class="sr-only">${T('搜索', 'Search')}</span><input type="search" placeholder="${T('搜索名称、方法、体系…', 'Search names, methods, systems…')}" autocomplete="off"></label></div>`;
    const st = { kind: '', use: '', q: '' };
    const empty = pool.parentElement.querySelector('.mx-empty');
    const apply = () => {
      let n = 0;
      pool.querySelectorAll('.om-item').forEach((el) => {
        const ok = (!st.kind || el.dataset.kind === st.kind) && (!st.use || el.dataset.use === st.use) && (!st.q || el.textContent.toLowerCase().includes(st.q));
        el.hidden = !ok; if (ok) n++;
      });
      if (empty) empty.hidden = n > 0;
    };
    box.addEventListener('click', (e) => {
      const b = e.target.closest('button'); if (!b) return;
      const key = 'kind' in b.dataset ? 'kind' : 'use';
      st[key] = b.dataset[key];
      b.parentElement.querySelectorAll(`button[data-${key}]`).forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
      apply();
    });
    box.querySelector('input').addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(); apply(); });
    return box;
  }

  // ── 最近的版本（GitHub releases；一小时内不重复请求）
  async function releases(el, repo) {
    if (!el || !repo) return;
    const key = `molastria-om-rel:${repo}`;
    let rows = null;
    try { const c = JSON.parse(sessionStorage.getItem(key) || 'null'); if (c && Date.now() - c.t < 3600e3) rows = c.rows; } catch { /* private mode */ }
    if (!rows) {
      try {
        const ctl = new AbortController(); setTimeout(() => ctl.abort(), 8000);
        const r = await fetch(`https://api.github.com/repos/${repo}/releases?per_page=5`, { signal: ctl.signal, headers: { Accept: 'application/vnd.github+json' } });
        const j = r.ok ? await r.json() : [];
        rows = (Array.isArray(j) ? j : []).slice(0, 5).map((x) => ({ name: String(x.name || x.tag_name || ''), url: String(x.html_url || ''), date: String(x.published_at || '').slice(0, 10) }));
        try { sessionStorage.setItem(key, JSON.stringify({ t: Date.now(), rows })); } catch { /* private mode */ }
      } catch { rows = []; }
    }
    const home = `https://github.com/${repo}/releases`;
    el.innerHTML = rows.length
      ? rows.map((x) => `<li><a href="${esc(/^https:\/\/github\.com\//.test(x.url) ? x.url : home)}" target="_blank" rel="noopener" translate="no">${esc(x.name)}</a><span>${esc(x.date)}</span></li>`).join('')
      : `<li><span>${T('暂时读不到 GitHub 的版本列表（这个仓库可能不发 release）。', 'Could not read releases from GitHub (the repository may not publish any).')}</span><a href="${esc(home)}" target="_blank" rel="noopener">${T('去 GitHub 看', 'Open on GitHub')} <i class="ico-ext" aria-hidden="true"></i></a></li>`;
  }

  const fine = `<p class="om-fine">${C(T(`许可证按 GitHub 仓库识别的结果写（${D.checked} 核对），模型参数另有条款的单独标出；论文在 arXiv 或 OpenAlex 核对过。名称和商标归各自的公司所有，MolAstria 与这些公司没有隶属关系。用于商业项目前，请读各项目自己的许可文件。`, `Licences are as detected on each GitHub repository (checked ${D.checked}), with separate weight terms noted; papers were checked on arXiv or OpenAlex. Names and trademarks belong to their companies; MolAstria is not affiliated with any of them. Read each project's own licence before commercial use.`))}</p>`;

  if (org) {
    // ── 一家公司的展馆
    document.title = `${tx(org.name)} · ${T('开放模型馆', 'Open Model Hall')} · MolAstria`;
    const facts = (org.facts || []).map(([n, l]) => `<div><strong translate="no">${esc(tx(n))}</strong>${C(esc(tx(l)))}</div>`).join('');
    main.innerHTML = `<section class="mx-hero om-hero">
      <div><nav class="om-crumbs" id="om-crumbs" aria-label="${T('位置', 'Location')}"></nav>
        <p class="eyebrow" translate="no">OPEN MODEL HALL · ${esc(String(tx(org.lab)).toUpperCase())}</p>
        <h1>${C(esc(tx(org.name)))}<span class="om-h1-sub" translate="no">${esc(tx(org.lab))} · ${esc(tx(org.country))}</span></h1>
        ${C(esc(tx(org.lead)), 'p', 'lead')}
        <div class="actions"><a class="button primary" href="#om-open">${T('浏览模型与数据', 'Browse models and data')} <i class="ico-ext ico-down" aria-hidden="true"></i></a><a class="button" href="#om-live">${T('最近的版本', 'Latest releases')}</a><a class="button ghost" href="${hubHref}#om-tasks">${T('按任务和其他家比较', 'Compare with other labs by task')}</a></div>
      </div>
      <figure class="mx-stack"><figcaption>${C(T(`在 MolAstria 里接着用`, 'Carry on in MolAstria'))}</figcaption><ol>${(org.site || []).map((s) => `<li><span class="mx-k" translate="no">MolAstria</span>${C(esc(tx(s)), 'b')}<a href="${esc(safeUrl(s.href))}">${T('打开', 'Open')} <i class="ico-ext ico-right" aria-hidden="true"></i></a></li>`).join('')}</ol></figure>
    </section>
    ${facts ? `<section class="mx-facts om-facts" aria-label="${T('关键数字', 'Key numbers')}">${facts}<div><strong translate="no">${org.items.length}</strong>${C(T('本馆收录的模型、数据集与工具', 'models, datasets and tools in this pavilion'))}</div></section>` : ''}
    <section id="om-open" class="mx-open" aria-labelledby="om-open-h">
      <div class="mx-head"><p class="eyebrow" translate="no">MODELS · DATA · TOOLS</p><h2 id="om-open-h">${C(T(`${tx(org.name)} 开放的模型、数据与工具`, `Open models, data and tools from ${tx(org.name)}`))}</h2>${C(T('每张卡片写了能做什么、使用条件，以及论文和代码的原始出处。', 'Each card says what it does, the terms of use, and links the original paper and code.'), 'p', 'muted')}</div>
      <div class="mx-grid" id="om-grid">${org.items.map((it) => card(it, org)).join('')}</div>
      <p class="mx-empty" hidden>${C(T('没有匹配的条目，换个关键词试试。', 'Nothing matches; try another word.'))}</p>
    </section>
    <section class="mx-live" id="om-live" aria-labelledby="om-live-h"><div><p class="eyebrow" translate="no">LIVE · GITHUB</p><h2 id="om-live-h">${C(T('最近的版本', 'Latest releases'))}</h2>${C(T(`打开页面时从 GitHub 读取 ${org.repo}，一小时内不重复请求。`, `Read from GitHub (${org.repo}) when the page opens, at most once an hour.`), 'p', 'muted small')}</div><ul class="mx-releases" id="om-rel"><li class="muted">${T('正在读取…', 'Loading…')}</li></ul></section>
    <section class="om-switch" id="om-switch" aria-label="${T('其他展馆', 'Other pavilions')}"></section>
    <footer class="mx-foot"><strong translate="no">MolAstria · ${T('开放模型馆', 'Open Model Hall')} · ${esc(tx(org.name))}</strong>${fine}</footer>`;
    const grid = $('om-grid');
    if (org.items.length > 3) grid.before(filters(org.items, grid));
    crumbs($('om-crumbs'));
    switcher($('om-switch'));
    releases($('om-rel'), org.repo);
    return;
  }

  // ── 母栏目页
  const all = D.orgs.flatMap((o) => o.items.map((it) => ({ it, o })));
  const byKey = new Map(all.map((x) => [`${x.o.id}:${x.it.id}`, x]));
  const permissive = all.filter((x) => x.it.use === 'open').length;
  main.innerHTML = `<section class="om-top">
      <p class="eyebrow" translate="no">MOLASTRIA · OPEN MODEL HALL</p>
      <h1>${C(T('开放模型馆', 'Open Model Hall'))}<span class="om-h1-sub" translate="no">${T('Open Model Hall', '开放模型馆')}</span></h1>
      ${C(T(`各家公司开放给科研的化学、材料与生物分子 AI：原子模型、生成模型、结构预测、学出来的泛函、数据集和 GPU 工具。每家一个展馆，Meta 的展馆还带两个能直接上手的工具。`, 'Chemistry, materials and biomolecular AI that companies have opened up for research: atomistic models, generative models, structure prediction, learned functionals, datasets and GPU tools. One pavilion per company; the Meta pavilion also has two hands-on tools.'), 'p', 'lead')}
      <div class="actions"><a class="button primary" href="#om-orgs">${T('逛展馆', 'Visit the pavilions')} <i class="ico-ext ico-down" aria-hidden="true"></i></a><a class="button" href="#om-tasks">${T('按任务找模型', 'Find a model by task')}</a><a class="button" href="#om-all">${T('全部条目', 'Every entry')}</a></div>
    </section>
    <section class="mx-facts om-facts" aria-label="${T('关键数字', 'Key numbers')}"><div><strong>${D.orgs.length}</strong>${C(T('家公司的展馆', 'company pavilions'))}</div><div><strong>${all.length}</strong>${C(T('个模型、数据集与工具', 'models, datasets and tools'))}</div><div><strong>${permissive}</strong>${C(T('个是宽松许可、可以商用', 'under permissive, commercial-friendly terms'))}</div><div><strong translate="no">${esc(D.checked)}</strong>${C(T('许可证和论文的核对日期', 'date licences and papers were checked'))}</div></section>
    <section id="om-orgs" class="om-orgs" aria-labelledby="om-orgs-h">
      <div class="mx-head"><p class="eyebrow" translate="no">PAVILIONS</p><h2 id="om-orgs-h">${C(T('展馆', 'Pavilions'))}</h2></div>
      <div class="om-org-grid">${D.orgs.map((o) => `<a class="om-org-card" href="${esc(rel(o))}" data-org="${esc(o.id)}" translate="no" lang="${lang}"><span class="om-glyph">${esc(o.glyph)}</span><b>${esc(tx(o.name))}</b><small class="om-lab">${esc(tx(o.lab))} · ${esc(tx(o.country))}</small><span class="om-blurb">${esc(tx(o.blurb))}</span><span class="om-count">${o.tools ? T('含两个在线工具 · ', 'Two hands-on tools · ') : ''}${T(`${o.items.length} 个条目`, `${o.items.length} entries`)}${o.path ? T(' · 本馆详见独立页面', ' · full page') : ''} <i class="ico-ext ico-right" aria-hidden="true"></i></span></a>`).join('')}</div>
    </section>
    <section id="om-tasks" class="om-tasks" aria-labelledby="om-tasks-h">
      <div class="mx-head"><p class="eyebrow" translate="no">BY TASK</p><h2 id="om-tasks-h">${C(T('按任务找模型', 'Find a model by task'))}</h2>${C(T('同一件事，各家都有自己的做法。先看使用条件：要商用的项目，优先选宽松许可的。', 'Several labs tackle the same job. Check the terms first: for commercial work, prefer permissive licences.'), 'p', 'muted')}</div>
      <div class="om-task-grid">${D.tasks.map((t) => `<div class="om-task">${C(esc(tx(t)), 'h3')}<ul>${t.items.map((k) => { const x = byKey.get(k); if (!x) return ''; return `<li translate="no" lang="${lang}"><a href="${esc(rel(x.o))}">${esc(x.it.name)}</a><small>${esc(tx(x.o.name))}</small><span class="om-use" data-use="${esc(x.it.use)}" title="${esc(lic(x.it))}">${esc(tx(D.uses[x.it.use]))}</span></li>`; }).join('')}</ul></div>`).join('')}</div>
    </section>
    <section id="om-all" class="mx-open" aria-labelledby="om-all-h">
      <div class="mx-head"><p class="eyebrow" translate="no">EVERY ENTRY</p><h2 id="om-all-h">${C(T('全部条目', 'Every entry'))}</h2>${C(T('可以按类型和使用条件组合筛选。', 'Combine kind and terms filters.'), 'p', 'muted')}</div>
      <div class="mx-grid" id="om-grid">${all.map(({ it, o }) => card(it, o)).join('')}</div>
      <p class="mx-empty" hidden>${C(T('没有匹配的条目，换个关键词试试。', 'Nothing matches; try another word.'))}</p>
    </section>
    <section class="om-also" aria-labelledby="om-also-h"><h2 id="om-also-h">${C(T('相关栏目', 'Related sections'))}</h2><ul>
      <li><a href="../industry/index.html">${C(T('AI 化学企业图谱：八十多家做 AI 化学、材料、模拟软件和自驱实验室的公司', 'AI Chemistry Companies: eighty-plus companies in AI chemistry, materials, simulation and self-driving labs'))}</a></li>
      <li><a href="../scimodels/index.html">${C(T('科学大模型：用科学文献训练的语言模型，附价格对比', 'Science LLMs: language models trained on science, with prices'))}</a></li>
      <li><a href="../models/index.html">${C(T('模型接口：在线跑 UMA、MACE、ANI-2x 等 15 个原子模型', 'Model API: run 15 atomistic models online, including UMA, MACE and ANI-2x'))}</a></li>
      <li><a href="../train/index.html">${C(T('训练 Agent：用开放模型当老师训练自己的小模型', 'Train an Agent: use open models as teachers for your own small model'))}</a></li></ul></section>
    <footer class="mx-foot"><strong translate="no">MolAstria · ${T('开放模型馆', 'Open Model Hall')}</strong>${fine}</footer>`;
  const grid = $('om-grid');
  grid.before(filters(all.map((x) => x.it), grid));
})();
