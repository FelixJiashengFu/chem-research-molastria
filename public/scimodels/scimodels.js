'use strict';
// 科学大模型：数据库第 17 类的 27 个模型（按子类分组，可筛选、搜索，每个模型可展开详情）和价格对比条形图。
// 数据在 scimodels-data.js，中英两版，按站点语言取用；界面文字写中文，由 i18n.js 翻译。
// 地址：#m-<slug> 打开该模型的详情。
(() => {
  const D = window.MOLASTRIA_SCIMODELS;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = (pair) => pair[en ? 1 : 0];
  const text = (t) => (t ? (en ? t.en : t.zh) : '');
  const groups = Object.fromEntries(D.groups.map(([id, zh, e]) => [id, [zh, e]]));
  const list = D.models;
  const nameOf = (m) => (en && m.nameEn ? m.nameEn : m.name);
  const ext = (link) => `<a href="${esc(link.url)}" target="_blank" rel="noopener noreferrer">${esc(text(link))}</a>`;
  const span = (t) => `<span translate="no" lang="${lang}">${esc(t)}</span>`;

  // ── 模型目录 ────────────────────────────────────────────────────────────
  const haystack = (m) => [m.name, m.nameEn, m.slug, `#${m.n}`, ...groups[m.group], ...m.access.flatMap((a) => D.access[a]),
    ...['org', 'what', 'special', 'input', 'output', 'size', 'licence'].flatMap((k) => (m[k] ? [m[k].zh, m[k].en] : []))].filter(Boolean).join(' ').toLowerCase();
  const index = new Map(list.map((m) => [m.slug, haystack(m)]));

  function card(m) {
    const facts = [
      ['特点', m.special], ['输入', m.input], ['输出', m.output], ['规模', m.size], ['许可证', m.licence],
      ['访问与费用', m.cost], ['已知限制', m.limits],
    ].filter(([, v]) => v);
    const hf = m.hf ? `<a href="${esc(m.hf)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(m.hf.replace('https://huggingface.co/', ''))}</a>${(m.hfMore || []).map(ext).join('')}`
      : '<span class="sm-none">没有 Hugging Face 页面</span>';
    const tryCell = m.try?.length ? m.try.map(ext).join('') : `<span class="sm-none">${span(text(m.tryNone))}</span>`;
    return `<article class="sm-card" id="m-${esc(m.slug)}" data-slug="${esc(m.slug)}">
  <h4><span translate="no" lang="${lang}">${esc(nameOf(m))}</span><span class="sm-num" title="数据库编号">#${m.n}</span></h4>
  <p class="sm-sub-line" translate="no" lang="${lang}"><span>${esc(text(m.org))}</span><span>${esc(text(m.year))}</span></p>
  <ul class="sm-tags" translate="no" lang="${lang}">${m.access.map((a) => `<li data-a="${a}">${esc(L(D.access[a]))}</li>`).join('')}</ul>
  <p class="sm-what" translate="no" lang="${lang}">${esc(text(m.what))}</p>
  <dl class="sm-links">
    <div><dt>Hugging Face</dt><dd>${hf}</dd></div>
    <div><dt>在线体验</dt><dd translate="no" lang="${lang}">${tryCell}</dd></div>
    <div><dt>发布原文</dt><dd translate="no" lang="${lang}">${m.announce.map(ext).join('')}</dd></div>
    ${m.code ? `<div><dt>官方代码</dt><dd><a href="${esc(m.code)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(m.code.replace('https://github.com/', 'github.com/'))}</a></dd></div>` : ''}
  </dl>
  <button type="button" class="sm-toggle" aria-expanded="false" aria-controls="md-${esc(m.slug)}">查看详情</button>
  <div class="sm-detail" id="md-${esc(m.slug)}" hidden>
    <dl class="sm-facts">${facts.map(([k, v]) => `<div><dt>${k}</dt><dd translate="no" lang="${lang}">${esc(text(v))}</dd></div>`).join('')}
      <div><dt>数据库条目</dt><dd><a href="../atlas/index.html#resources/${m.n}">数据库第 17 类 #${m.n}</a></dd></div>
    </dl>
    <p class="sm-checked">以上信息与链接核对于 ${esc(D.checked)}；模型、服务和价格会更新，使用前以官方页面为准。</p>
  </div>
</article>`;
  }

  const listEl = $('#sm-list');
  listEl.innerHTML = D.groups.map(([id]) => {
    const items = list.filter((m) => m.group === id);
    return items.length ? `<section class="sm-group" data-group="${esc(id)}" aria-labelledby="sm-g-${esc(id)}"><h3 id="sm-g-${esc(id)}"><span translate="no" lang="${lang}">${esc(L(groups[id]))}</span><span class="sm-group-n"></span></h3><div class="sm-cards">${items.map(card).join('')}</div></section>` : '';
  }).join('');

  const fill = (sel, entries) => { sel.insertAdjacentHTML('beforeend', entries.map(([v, label]) => `<option value="${esc(v)}" lang="${lang}">${esc(label)}</option>`).join('')); };
  fill($('#sm-group'), D.groups.map(([id]) => [id, L(groups[id])]));
  fill($('#sm-access'), Object.keys(D.access).filter((k) => list.some((m) => m.access.includes(k))).map((k) => [k, L(D.access[k])]));

  const controls = ['#sm-q', '#sm-group', '#sm-access'].map($);
  function applyFilters() {
    const [q, group, access] = controls.map((c) => c.value.trim());
    const words = q.toLowerCase().split(/\s+/).filter(Boolean);
    let shown = 0;
    for (const m of list) {
      const ok = (!group || m.group === group) && (!access || m.access.includes(access)) && words.every((w) => index.get(m.slug).includes(w));
      document.getElementById(`m-${m.slug}`).hidden = !ok;
      if (ok) shown++;
    }
    listEl.querySelectorAll('.sm-group').forEach((g) => {
      const n = g.querySelectorAll('.sm-card:not([hidden])').length;
      g.hidden = !n;
      g.querySelector('.sm-group-n').textContent = ` · ${n}`;
    });
    $('#sm-count').textContent = shown === list.length ? `共 ${list.length} 个模型` : `显示 ${shown} 个，共 ${list.length} 个模型`;
    $('#sm-empty').hidden = shown > 0;
    $('#sm-reset').hidden = !controls.some((c) => c.value);
  }
  const reset = () => { controls.forEach((c) => { c.value = ''; }); applyFilters(); };
  controls.forEach((c) => c.addEventListener(c.tagName === 'SELECT' ? 'change' : 'input', applyFilters));
  $('#sm-reset').addEventListener('click', reset);
  $('#sm-empty-reset').addEventListener('click', () => { reset(); controls[0].focus(); });
  $('#sm-meta').textContent = `收录 ${list.length} 个模型 · ${D.groups.length} 个子类 · 信息核对于 ${D.checked}`;

  function setOpen(article, open) {
    const btn = article.querySelector('.sm-toggle');
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '收起详情' : '查看详情';
    article.querySelector('.sm-detail').hidden = !open;
    article.classList.toggle('open', open);
  }
  listEl.addEventListener('click', (e) => {
    const btn = e.target.closest('.sm-toggle');
    if (!btn) return;
    const article = btn.closest('.sm-card');
    const open = btn.getAttribute('aria-expanded') !== 'true';
    setOpen(article, open);
    if (open) history.replaceState(null, '', `#m-${article.dataset.slug}`);
  });

  // ── 价格对比 ────────────────────────────────────────────────────────────
  // 对数刻度：0.1 美元和 50 美元要在同一张图里都看得清。条和刻度共用同一个换算，宽度留出右侧数值标签的位置。
  const P = D.prices, rate = P.rate.cny;
  const usd = (r, v) => (r.cur === 'CNY' ? v / rate : v);
  const LO = 0.05, HI = 100;
  const pos = (v) => ((Math.log10(Math.max(v, LO)) - Math.log10(LO)) / (Math.log10(HI) - Math.log10(LO))) * 100;
  const money = (v) => `$${v.toFixed(2)}`;
  const orig = (r) => (r.cur === 'CNY' ? `¥${r.in} / ¥${r.out}` : `$${r.in.toFixed(2)} / $${r.out.toFixed(2)}`);
  const tierName = { flagship: '旗舰', small: '小型' };
  const rows = [...P.rows.filter((r) => r.science), ...P.rows.filter((r) => !r.science)];
  const modelName = (r) => (en && r.modelEn ? r.modelEn : r.model);
  const ticks = [0.1, 0.3, 1, 3, 10, 30, 100];
  // A fixed 64 px is kept free on the right for the value label; px, not em, so bars, grid lines and tick labels
  // (different font sizes) share one scale. 0.3 / 3 / 30 are minor ticks, hidden on phones.
  const at = (p) => `calc((100% - 64px) * ${p.toFixed(2)} / 100)`;
  const minor = (t) => ([0.3, 3, 30].includes(t) ? ' class="minor"' : '');
  const grid = `<span class="sm-grid" aria-hidden="true">${ticks.map((t) => `<i${minor(t)} style="left:${at(pos(t))}"></i>`).join('')}</span>`;
  const bar = (kind, v) => `<span class="sm-barline"><span class="sm-bar ${kind}" style="width:${at(pos(v))}"></span><span class="sm-val">${money(v)}</span></span>`;
  $('#sm-chart').innerHTML = `<p class="sm-legend" aria-hidden="true"><span><i class="sm-key-in"></i>输入（每百万 token）</span><span><i class="sm-key-out"></i>输出（每百万 token）</span><span>底色标出的是科学模型</span></p>
  <div class="sm-rows" role="img" aria-label="价格条形图，数据见下方价格表">${rows.map((r, i) => `<div class="sm-row${r.science ? ' sci' : ''}${i && rows[i - 1].science && !r.science ? ' split' : ''}">
    <span class="sm-label"><b translate="no">${esc(modelName(r))}</b><small>${span(text(r.provider))}${r.tier ? ` · ${tierName[r.tier]}` : ' · 科学模型'}</small></span>
    <span class="sm-track">${grid}${bar('in', usd(r, r.in))}${bar('out', usd(r, r.out))}</span>
  </div>`).join('')}</div>
  <div class="sm-axis" aria-hidden="true"><span class="sm-axis-note">美元，对数刻度</span><span class="sm-ticks">${ticks.map((t) => `<span${minor(t)} style="left:${at(pos(t))}">$${t}</span>`).join('')}</span></div>`;

  const nSci = list.length, nPriced = new Set(rows.filter((r) => r.science).map((r) => r.slug)).size;
  $('#sm-price-intro').textContent = `每百万 token 的官方价格，输入和输出分开显示，核对日期 ${P.checked}。人民币价格按 1 美元 = ${rate} 元（${text(P.rate.label)}，${P.rate.date}）换算成美元，表格里同时给出原价。${nSci} 个科学模型中只有 ${nPriced} 个有公开的按 token 价格，其余列在下面。图用对数刻度，便于同时看清不到 1 美元和几十美元的价格。`;

  $('#sm-table').innerHTML = `<caption id="sm-table-cap">每百万 token 的官方价格（美元）；人民币价格按 1 美元 = ${rate} 元换算，原价见“原价”一列。核对日期 ${P.checked}，汇率出处：<a href="${esc(P.rate.src)}" target="_blank" rel="noopener noreferrer">中国外汇交易中心</a>。</caption>
  <thead><tr><th scope="col">模型</th><th scope="col">提供方</th><th scope="col">类别</th><th scope="col">输入</th><th scope="col">输出</th><th scope="col">原价（输入 / 输出）</th><th scope="col">说明</th><th scope="col">官方出处</th></tr></thead>
  <tbody>${rows.map((r) => `<tr${r.science ? ' class="sci"' : ''}><th scope="row" translate="no">${r.slug ? `<a href="#m-${esc(r.slug)}">${esc(modelName(r))}</a>` : esc(modelName(r))}</th><td>${span(text(r.provider))}</td><td class="nowrap">${r.tier ? tierName[r.tier] : '科学模型'}</td><td class="num">${money(usd(r, r.in))}</td><td class="num">${money(usd(r, r.out))}</td><td class="num" translate="no">${esc(orig(r))}</td><td>${span(text(r.note))}</td><td class="nowrap"><a href="${esc(r.src)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(new URL(r.src).hostname)}</a></td></tr>`).join('')}</tbody>`;

  // Science models without a public per-token price, grouped by how they can be used.
  const pricedSlugs = new Set(rows.map((r) => r.slug).filter(Boolean));
  const order = [
    ['register', '免费，需注册', '官方 API 注册后可用，测试期间每月有免费额度；没有公开的按 token 价格。'],
    ['free', '免费在线演示', '模型方提供免费的在线演示。'],
    ['weights', '只提供权重，需自行部署', '模型免费下载，算力自己准备。'],
    ['paper', '仅论文', '没有公开权重，也没有在线服务。'],
  ];
  const bucket = (m) => order.find(([k]) => m.access.includes(k))?.[0];
  $('#sm-unpriced').innerHTML = order.map(([k, title, note]) => {
    const ms = list.filter((m) => !pricedSlugs.has(m.slug) && bucket(m) === k);
    return ms.length ? `<section><h4>${title}<span class="sm-group-n"> · ${ms.length}</span></h4><p>${note}</p><ul>${ms.map((m) => `<li><a href="#m-${esc(m.slug)}" translate="no">${esc(nameOf(m))}</a></li>`).join('')}</ul></section>` : '';
  }).join('');

  // ── 地址 ──────────────────────────────────────────────────────────────────
  function readHash(scroll) {
    const id = decodeURIComponent((location.hash || '').slice(1));
    if (!id.startsWith('m-')) return;
    const article = document.getElementById(id);
    if (!article) return;
    if (article.hidden) reset();
    setOpen(article, true);
    if (scroll) article.scrollIntoView({ block: 'start' });
  }
  window.addEventListener('hashchange', () => readHash(true));
  applyFilters();
  readHash(true);
})();
