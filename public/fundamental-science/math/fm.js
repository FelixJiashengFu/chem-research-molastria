'use strict';
// 数学基础与探索：把 fm-data.js 画成页面（梯队、学科关系图、学习路线、学科详解、Hall 导读、起步自测、书目与视频库）。
// 内容是中英两版，按站点语言取用，标 translate="no"；页面上的固定文字也在这里成对写出，所以英文页不依赖词典。
// 地址：#m-<学科> 打开对应的详解。自测勾选存在 localStorage 的 molastria-fm-progress，路线选择存在 molastria-fm-track。
(() => {
  const D = window.MOLASTRIA_FM, MATH = window.MOLASTRIA_FM_MATH || {};
  if (!D) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  // 正文里的 x^{…}、S^{-1/2}、E_h、f_n 之类写成上下标
  const rich = (s) => esc(s)
    .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/\^([A-Za-z0-9])/g, '<sup>$1</sup>')
    .replace(/([\p{L}0-9])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/gu, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(esc(en ? e : zh));
  const R = (t, tag = 'span', cls = '') => C(rich(tx(t)), tag, cls);
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };

  const S = Object.fromEntries(D.subjects.map((s) => [s.id, s]));
  const B = Object.fromEntries(D.books.map((b) => [b.id, b]));
  const V = Object.fromEntries(D.videos.map((v) => [v.id, v]));
  const TG = Object.fromEntries(D.targets.map((t) => [t.id, t]));
  const tierOf = (id) => D.tiers.find((t) => t.id === S[id].tier);
  const short = {
    la: ['线性代数', 'Linear algebra'], fa: ['泛函分析', 'Functional analysis'], gr: ['群论与表示', 'Groups & reps'],
    dg: ['微分几何', 'Geometry & topology'], pr: ['概率与随机', 'Probability'], na: ['数值分析', 'Numerical analysis'],
    var: ['变分与优化', 'Variational methods'], oa: ['算子代数', 'Operator algebras'], tn: ['张量网络', 'Tensor networks'], mt: ['测度论', 'Measure theory'],
    qm: ['量子力学基础', 'QM foundations'], qc: ['量子化学', 'Quantum chemistry'],
  };
  const sn = (id) => (en ? short[id][1] : short[id][0]);
  const chip = (id) => (S[id] ? `<a class="fm-chip" data-tier="${S[id].tier}" href="#m-${id}" data-open="${id}" translate="no" lang="${lang}">${esc(sn(id))}</a>` : `<span class="fm-chip fm-chip-target" translate="no" lang="${lang}">${esc(sn(id))}</span>`);
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  const progress = new Set(store.get('molastria-fm-progress', []));
  const saveProgress = () => store.set('molastria-fm-progress', [...progress]);

  if (en) document.title = 'Mathematical Foundations & Exploration · MolAstria';

  // ── 首屏 ──────────────────────────────────────────────────────────────
  $('#fm-crumbs').innerHTML = `<a href="../index.html">${L('进一步基础科学发现', 'Advancing Fundamental Science')}</a><span aria-hidden="true">/</span>${L('数学基础与探索', 'Mathematical Foundations & Exploration')}`;
  $('#fm-quote').innerHTML = C(esc(tx(D.hero.quote))) + (en ? '' : `<span class="fs-q-en" lang="en" translate="no">${esc(D.hero.quote.en)}</span>`);
  $('#fm-lead').innerHTML = C(esc(tx(D.hero.lead)));
  $('#fm-honest').innerHTML = C(esc(tx(D.hero.honesty)));
  const freeN = D.books.filter((b) => b.free).length;
  $('#fm-stats').innerHTML = [
    [D.subjects.length, '门学科', 'subjects'], [D.books.length, '本教材与论文', 'books & papers'], [freeN, '本可合法免费阅读', 'free to read legally'],
    [D.videos.length, '门视频课与资源', 'video courses & resources'], [D.relations.length, '条学科关系', 'cross-subject links'],
  ].map(([n, zh, e]) => `<div><dt translate="no">${n}</dt><dd>${L(zh, e)}</dd></div>`).join('');
  $('#fm-jump').innerHTML = [
    ['#fm-map', '学科关系图', 'Map of relations', true], ['#fm-path', '学习路线', 'Study tracks'], ['#fm-subjects', '十门学科详解', 'The ten subjects'],
    ['#fm-hall', 'Hall 导读', 'Reading Hall'], ['#fm-start', '从哪里开始', 'Where to start'], ['#fm-library', '书目与视频', 'Books & videos'],
  ].map(([h, zh, e, p]) => `<a class="button${p ? ' primary' : ''}" href="${h}">${L(zh, e)}</a>`).join('');

  // ── 三个梯队 ──────────────────────────────────────────────────────────
  $('#fm-tiers-h').innerHTML = L('三个梯队', 'Three tiers');
  $('#fm-tiers-note').innerHTML = L('梯队是优先级，不是先后顺序：第一梯队的三门要尽早开始，后两个梯队按你的研究方向选。点学科名直接打开详解。', 'Tiers are priorities, not a strict order: start the three in tier 1 early, then choose from the other two by research direction. Click a subject to open its page.');
  $('#fm-tier-grid').innerHTML = D.tiers.map((t) => `<article class="fm-tier" data-tier="${t.id}">
      <p class="fm-tier-n">${R(t.name)}</p><h3>${R(t.tag)}</h3><p>${R(t.desc)}</p>
      <ul>${D.subjects.filter((s) => s.tier === t.id).map((s) => `<li><a href="#m-${s.id}" data-open="${s.id}"><span class="fm-glyph" aria-hidden="true">${esc(s.glyph)}</span>${R(s.name)}</a>${C(rich(tx(s.tagline)), 'small')}</li>`).join('')}</ul>
    </article>`).join('');

  // ── 学科关系图 ────────────────────────────────────────────────────────
  $('#fm-map-h').innerHTML = L('学科之间的关系', 'How the subjects connect');
  $('#fm-map-note').innerHTML = L('箭头从“提供工具的学科”指向“用到它的学科”，最右边是两个目标。点一个节点，右侧列出它建立在什么之上、又通向哪里，每条关系都写明具体用到了什么。', 'Arrows run from the subject that supplies a tool to the one that uses it; the two goals sit on the right. Click a node to list what it rests on and what it leads to, with the concrete tool behind each link.');
  const POS = { la: [150, 100], fa: [150, 330], gr: [150, 540], mt: [292, 215], pr: [432, 100], na: [432, 330], dg: [432, 540], oa: [692, 100], var: [692, 300], tn: [692, 500], qm: [900, 200], qc: [900, 440] };
  const W = 184, H = 46, TW = 156;
  const edgePath = (a, b) => {
    const [x1, y1] = POS[a], [x2, y2] = POS[b];
    if (Math.abs(x1 - x2) < 10) { const x = x1 - W / 2, k = 46; return `M${x} ${y1}C${x - k} ${y1} ${x - k} ${y2} ${x} ${y2}`; }
    if (Math.abs(y1 - y2) > 60 && Math.abs(x1 - x2) < 200) { const sy = y1 < y2 ? 1 : -1; return `M${x1} ${y1 + sy * H / 2}C${x1} ${(y1 + y2) / 2} ${x2} ${(y1 + y2) / 2} ${x2} ${y2 - sy * H / 2}`; }
    const dir = x2 > x1 ? 1 : -1, sx = x1 + dir * W / 2, ex = x2 - dir * (TG[b] ? TW / 2 : W / 2), dx = (ex - sx) / 2;
    return `M${sx} ${y1}C${sx + dx} ${y1} ${ex - dx} ${y2} ${ex} ${y2}`;
  };
  const svg = $('#fm-graph');
  svg.setAttribute('aria-label', en ? 'Map of relations between the subjects' : '学科关系图');
  const nodeSvg = (id) => {
    const [x, y] = POS[id], t = TG[id], s = S[id];
    if (t) return `<g class="fm-node fm-target" data-id="${id}" tabindex="0" role="button" aria-label="${esc(sn(id))}"><rect x="${x - TW / 2}" y="${y - 34}" width="${TW}" height="68" rx="12"/><text x="${x}" y="${y + 5}" text-anchor="middle" translate="no">${esc(sn(id))}</text></g>`;
    return `<g class="fm-node" data-id="${id}" data-tier="${s.tier}" tabindex="0" role="button" aria-label="${esc(sn(id))}"><rect x="${x - W / 2}" y="${y - H / 2}" width="${W}" height="${H}" rx="9"/><circle cx="${x - W / 2 + 22}" cy="${y}" r="14"/><text class="fm-node-g" x="${x - W / 2 + 22}" y="${y + 4.5}" text-anchor="middle" translate="no">${esc(s.glyph)}</text><text x="${x - W / 2 + 44}" y="${y + 4.5}" translate="no">${esc(sn(id))}</text></g>`;
  };
  svg.innerHTML = `<defs><marker id="fm-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>`
    + D.tiers.map((t, i) => `<text class="fm-col-label" x="${[150, 432, 692][i]}" y="30" text-anchor="middle" translate="no">${esc(tx(t.name))} · ${esc(tx(t.tag))}</text>`).join('')
    + `<text class="fm-col-label" x="900" y="30" text-anchor="middle" translate="no">${esc(en ? 'Goals' : '目标')}</text>`
    + `<g class="fm-edges">${D.relations.map(([a, b], i) => `<path class="fm-edge" data-a="${a}" data-b="${b}" data-i="${i}" d="${edgePath(a, b)}" marker-end="url(#fm-arrow)"><title>${esc(sn(a))} → ${esc(sn(b))}: ${esc(tx(D.relations[i][2]))}</title></path>`).join('')}</g>`
    + Object.keys(POS).map(nodeSvg).join('');
  const panel = $('#fm-map-panel');
  const relLine = ([a, b, t], side) => `<li>${chip(side === 'in' ? a : b)}${R(t, 'p')}</li>`;
  const showNode = (id) => {
    for (const g of svg.querySelectorAll('.fm-node')) g.classList.toggle('on', g.dataset.id === id);
    for (const p of svg.querySelectorAll('.fm-edge')) { const hit = p.dataset.a === id || p.dataset.b === id; p.classList.toggle('on', !!id && hit); p.classList.toggle('dim', !!id && !hit); }
    svg.classList.toggle('focused', !!id);
    if (!id) { panel.innerHTML = `<p class="fm-panel-k">${L('怎么读这张图', 'How to read the map')}</p>${D.targets.map((t) => `<h3>${R(t.name)}</h3>${R(t.desc, 'p')}`).join('')}<p class="muted">${L('点任意一个学科节点，看它和其他学科的具体联系。', 'Click any subject node to see its concrete links to the others.')}</p>`; return; }
    const ins = D.relations.filter((r) => r[1] === id), outs = D.relations.filter((r) => r[0] === id);
    const head = S[id] ? `<p class="fm-panel-k" data-tier="${S[id].tier}">${R(tierOf(id).name)} · ${R(tierOf(id).tag)}</p><h3>${R(S[id].name)}</h3>${R(S[id].tagline, 'p')}` : `<p class="fm-panel-k">${L('目标', 'Goal')}</p><h3>${R(TG[id].name)}</h3>${R(TG[id].desc, 'p')}`;
    panel.innerHTML = head
      + (ins.length ? `<h4>${S[id] ? L('建立在这些之上', 'Rests on') : L('用到的数学', 'Mathematics it uses')}</h4><ul class="fm-rel">${ins.map((r) => relLine(r, 'in')).join('')}</ul>` : '')
      + (outs.length ? `<h4>${L('通向', 'Leads to')}</h4><ul class="fm-rel">${outs.map((r) => relLine(r, 'out')).join('')}</ul>` : '')
      + (S[id] ? `<p><a class="button primary" href="#m-${id}" data-open="${id}">${L('打开这门学科的详解', 'Open this subject')} <i class="ico-ext ico-down" aria-hidden="true"></i></a></p>` : '');
  };
  let picked = null;
  svg.addEventListener('click', (e) => { const g = e.target.closest('.fm-node'); picked = g && g.dataset.id !== picked ? g.dataset.id : null; showNode(picked); });
  svg.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.fm-node')) { e.preventDefault(); picked = e.target.closest('.fm-node').dataset.id; showNode(picked); } });
  svg.addEventListener('mouseover', (e) => { const g = e.target.closest('.fm-node'); if (g && !picked) showNode(g.dataset.id); });
  svg.addEventListener('mouseleave', () => { if (!picked) showNode(null); });
  showNode(null);
  $('#fm-rel-sum').innerHTML = L(`全部 ${D.relations.length} 条关系（文字版）`, `All ${D.relations.length} links (as text)`);
  $('#fm-rel-list').innerHTML = D.relations.map(([a, b, t]) => `<li>${chip(a)}<span class="fm-arrow" aria-hidden="true">→</span>${chip(b)}${R(t, 'p')}</li>`).join('');

  // ── 学习路线 ──────────────────────────────────────────────────────────
  $('#fm-path-h').innerHTML = L('两条学习路线', 'Two study tracks');
  $('#fm-path-note').innerHTML = L('周数按每周 8–10 小时估计。数值分析和编程练习建议从第一天就穿插进行，不要等到“理论学完”。', 'Weeks assume 8–10 hours a week. Start numerical analysis and programming exercises from day one instead of waiting until "the theory is done".');
  let track = store.get('molastria-fm-track', 'chem');
  if (!D.tracks.some((t) => t.id === track)) track = 'chem';
  const tabs = $('#fm-track-tabs');
  const drawTrack = () => {
    tabs.innerHTML = D.tracks.map((t) => `<button type="button" role="tab" class="fm-track-tab" data-track="${t.id}" aria-selected="${t.id === track}">${R(t.name)}</button>`).join('');
    const t = D.tracks.find((x) => x.id === track);
    let start = 0;
    const span = (w) => { const [a, b] = String(w).split('–').map(Number); return b ? (a + b) / 2 : a; };
    const total = t.phases.reduce((n, p) => n + span(p.weeks), 0);
    $('#fm-track').innerHTML = `<p class="fm-track-desc">${R(t.desc)}</p><div class="fm-bar" aria-hidden="true">${t.phases.map((p, i) => { const w = span(p.weeks) / total * 100; const el = `<span style="left:${start / total * 100}%;width:${w}%" data-k="${i % 2}">${esc(tx(p.name))}</span>`; start += span(p.weeks); return el; }).join('')}</div>
      <ol class="fm-phases">${t.phases.map((p) => `<li><div class="fm-phase-h"><b translate="no" lang="${lang}">${esc(tx(p.name))}</b><span class="fm-weeks">${L(`${p.weeks} 周`, `${p.weeks} weeks`)}</span></div>${p.subjects.length ? `<div class="fm-chips">${p.subjects.map(chip).join('')}</div>` : ''}${R(p.goal, 'p')}</li>`).join('')}</ol>`;
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-track]'); if (!b) return; track = b.dataset.track; store.set('molastria-fm-track', track); drawTrack(); drawStart(); });
  drawTrack();

  // ── 学科详解 ──────────────────────────────────────────────────────────
  $('#fm-subjects-h').innerHTML = L('十门学科详解', 'The ten subjects in detail');
  $('#fm-side').innerHTML = D.tiers.map((t) => `<div class="fm-side-g" data-tier="${t.id}"><p>${R(t.name)} · ${R(t.tag)}</p>${D.subjects.filter((s) => s.tier === t.id).map((s) => `<button type="button" class="fm-side-b" data-sub="${s.id}" aria-controls="m-${s.id}"><span class="fm-glyph" aria-hidden="true">${esc(s.glyph)}</span>${R(s.name)}<span class="fm-side-p" data-p="${s.id}"></span></button>`).join('')}</div>`).join('');
  const bookCard = (b) => {
    const zh = b.role === 'zh', l = zh ? 'zh-CN' : 'en';
    const links = [b.doi ? `<a href="https://doi.org/${esc(b.doi)}" target="_blank" rel="noopener noreferrer" translate="no">DOI ${esc(b.doi)} ${ext}</a>` : '', b.url ? `<a href="${esc(b.url)}" target="_blank" rel="noopener noreferrer">${b.free ? L('免费阅读', 'Read free') : L('主页', 'Website')} ${ext}</a>` : ''].filter(Boolean).join('');
    return `<li class="fm-book" data-role="${b.role}">
      <div class="fm-tags"><span class="fm-tag" data-role="${b.role}">${R(D.roles[b.role])}</span><span class="fm-tag">${R(D.levels[b.level])}</span>${b.free ? `<span class="fm-tag fm-free">${L('合法免费', 'Free & legal')}</span>` : ''}</div>
      <p class="fm-cite" translate="no" lang="${l}"><b class="fm-title">${esc(b.title)}</b>${b.ed ? ` <span class="fm-ed" lang="${lang}">${esc(tx(b.ed))}</span>` : ''}<br><span class="fm-au">${esc(b.authors)}</span> · ${esc(b.pub)}${b.year ? ` · ${esc(b.year)}` : ''}</p>
      ${R(b.note, 'p', 'fm-note')}${links ? `<p class="fm-links">${links}</p>` : ''}</li>`;
  };
  const plat = { yt: 'YouTube', bili: en ? 'Bilibili' : '哔哩哔哩', ocw: 'MIT OpenCourseWare', web: en ? 'Website' : '网站' };
  const videoCard = (v) => `<li class="fm-video" data-p="${v.p}">
      <div class="fm-tags"><span class="fm-tag fm-plat" data-p="${v.p}" translate="no">${esc(plat[v.p])}</span><span class="fm-tag">${R(D.levels[v.level])}</span><span class="fm-tag">${v.lang === 'zh' ? L('中文', 'Chinese') : L('英文', 'English')}</span>${v.parts ? `<span class="fm-tag">${L(`共 ${v.parts} 集`, `${v.parts} parts`)}</span>` : ''}${v.official ? '' : `<span class="fm-tag fm-re">${L('转载', 'Reupload')}</span>`}</div>
      <p class="fm-cite"><a class="fm-title" href="${esc(v.url)}" target="_blank" rel="noopener noreferrer" translate="no" lang="${v.lang === 'zh' || /[㐀-鿿]/.test(v.title) ? 'zh-CN' : 'en'}">${esc(v.title)} ${ext}</a><br><span class="fm-au" translate="no">${esc(v.by)}</span>${v.original ? ` · <a href="${esc(v.original)}" target="_blank" rel="noopener noreferrer">${L('原始频道', 'Original channel')} ${ext}</a>` : ''}</p>
      ${R(v.note, 'p', 'fm-note')}</li>`;
  const rels = (id, side) => D.relations.filter((r) => (side === 'in' ? r[1] === id : r[0] === id));
  $('#fm-panels').innerHTML = D.subjects.map((s, i) => `<article class="fm-panel" id="m-${s.id}" data-tier="${s.tier}" tabindex="-1"${i ? ' hidden' : ''}>
      <header class="fm-sub-h"><span class="fm-big-glyph" aria-hidden="true">${esc(s.glyph)}</span><div>
        <p class="fm-panel-k" data-tier="${s.tier}">${R(tierOf(s.id).name)} · ${R(tierOf(s.id).tag)} · ${L(`约 ${s.weeks} 周`, `about ${s.weeks} weeks`)}</p>
        <h3>${R(s.name)}</h3>${R(s.tagline, 'p', 'fm-tagline')}</div></header>
      <p class="fm-study"><a class="button" href="../../learn/index.html#goal=fm:${s.id}">${L('用研习台学这门学科', 'Study this in the Study Desk')} <i class="ico-ext ico-right" aria-hidden="true"></i></a></p>
      <div class="fm-cols"><div class="fm-col-main">
        <h4>${L('讲解', 'Explanation')}</h4><div class="fs-prose">${s.explain.map((p) => R(p, 'p')).join('')}</div>
        <h4>${L('关键公式', 'Key formulas')}</h4>${s.formulas.map(formula).join('')}
        <h4>${L('在量子化学里出现在哪里', 'Where it shows up in quantum chemistry')}</h4><ul class="fm-bul">${s.inQC.map((t) => R(t, 'li')).join('')}</ul>
        <h4>${L('动手练习', 'Hands-on exercise')}</h4><div class="fm-practice"><p class="fm-practice-t">${R(s.practice.title)}</p>${R(s.practice.body, 'p')}
          <div class="fm-code"><button type="button" class="button fm-copy" data-copy="${s.id}">${L('复制代码', 'Copy code')}</button><pre translate="no"><code>${esc(s.practice.code)}</code></pre></div></div>
        <h4>${L('常见误区', 'Common pitfalls')}</h4><ul class="fm-bul fm-pit">${s.pitfalls.map((t) => R(t, 'li')).join('')}</ul>
      </div><aside class="fm-col-side">
        <h4>${L('分周大纲', 'Week-by-week outline')}</h4><ol class="fm-outline">${s.outline.map(([t, w]) => `<li><span class="fm-wk">${L(`第 ${w} 周`, `Wk ${w}`)}</span>${R(t)}</li>`).join('')}</ol>
        ${rels(s.id, 'in').length ? `<h4>${L('建立在这些之上', 'Rests on')}</h4><div class="fm-chips">${rels(s.id, 'in').map((r) => chip(r[0])).join('')}</div>` : ''}
        <h4>${L('通向', 'Leads to')}</h4><div class="fm-chips">${rels(s.id, 'out').map((r) => chip(r[1])).join('')}</div>
        <h4>${L('过关自测', 'Self-check')}</h4><ul class="fm-checks">${s.checks.map((t, k) => `<li><label><input type="checkbox" data-check="${s.id}:${k}"${progress.has(`${s.id}:${k}`) ? ' checked' : ''}>${R(t)}</label></li>`).join('')}</ul>
      </aside></div>
      <div class="fm-res"><div><h4>${L('教材与文献', 'Textbooks & papers')}</h4><ul class="fm-cards">${s.books.map((id) => bookCard(B[id])).join('')}</ul></div>
        <div><h4>${L('视频与在线课程', 'Videos & online courses')}</h4>${s.videos.length ? `<ul class="fm-cards">${s.videos.map((id) => videoCard(V[id])).join('')}</ul>` : `<p class="muted">${L('这一门没有我们核对过、值得推荐的完整视频课；建议直接读上面的书，Landsman 的书免费开放。', 'We found no complete video course for this subject that we could verify and recommend; read the books above directly. Landsman\'s book is open access.')}</p>`}</div></div>
    </article>`).join('');
  const side = $('#fm-side');
  const selectSubject = (id, { scroll = false } = {}) => {
    if (!S[id]) return false;
    for (const p of document.querySelectorAll('.fm-panel')) p.hidden = p.id !== `m-${id}`;
    for (const b of side.querySelectorAll('.fm-side-b')) b.setAttribute('aria-current', String(b.dataset.sub === id));
    if (scroll) $('#fm-subjects').scrollIntoView({ behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth', block: 'start' });
    return true;
  };
  side.addEventListener('click', (e) => { const b = e.target.closest('.fm-side-b'); if (!b) return; selectSubject(b.dataset.sub); history.replaceState(null, '', `#m-${b.dataset.sub}`); });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-open]'); if (!a) return;
    e.preventDefault(); selectSubject(a.dataset.open, { scroll: true }); history.replaceState(null, '', `#m-${a.dataset.open}`);
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.fm-copy'); if (!b) return;
    try { await navigator.clipboard.writeText(S[b.dataset.copy].practice.code); b.innerHTML = L('已复制', 'Copied'); } catch { b.innerHTML = L('请手动选中复制', 'Select and copy by hand'); }
    setTimeout(() => { b.innerHTML = L('复制代码', 'Copy code'); }, 1600);
  });

  // ── Hall 导读 ─────────────────────────────────────────────────────────
  $('#fm-hall-h').innerHTML = L('Hall《Quantum Theory for Mathematicians》逐章导读', 'A chapter guide to Hall, Quantum Theory for Mathematicians');
  $('#fm-hall-note').innerHTML = L('这本书（Springer GTM 267，2013）把第一梯队的三门串在量子力学上，是这个方向最好的起点。下表把每一组章节对应到上面的学科：读到哪一章卡住，就回到对应学科补。', 'This book (Springer GTM 267, 2013) ties the three tier-1 subjects to quantum mechanics and is the best starting point for this direction. The table maps each group of chapters to the subjects above: when a chapter stalls you, go back to that subject.');
  $('#fm-hall-list').innerHTML = D.hall.map((h) => `<li><span class="fm-ch" translate="no">${en ? 'Ch.' : '第'} ${esc(h.ch)}${en ? '' : ' 章'}</span><div><p class="fm-hall-t">${R(h.title)}</p>${R(h.note, 'p', 'muted')}</div><div class="fm-chips">${h.subj.map(chip).join('')}</div></li>`).join('');

  // ── 从哪里开始：自测汇总 ──────────────────────────────────────────────
  $('#fm-start-h').innerHTML = L('从哪里开始', 'Where to start');
  $('#fm-start-note').innerHTML = L('在每门学科的“过关自测”里勾选你已经能做到的事，这里会按你选的路线建议下一步。勾选只保存在这台设备的浏览器里。', 'Tick what you can already do in each subject\'s self-check; this box then suggests your next step on the chosen track. Ticks are stored only in this browser.');
  const pct = (id) => { const n = S[id].checks.length; let k = 0; for (let i = 0; i < n; i++) if (progress.has(`${id}:${i}`)) k++; return k / n; };
  const drawStart = () => {
    const t = D.tracks.find((x) => x.id === track);
    const order = [...new Set(t.phases.flatMap((p) => p.subjects))];
    const next = order.find((id) => pct(id) < 0.75);
    $('#fm-start-box').innerHTML = `<div class="fm-next">${next
      ? `<p class="fm-panel-k">${R(t.name)}</p><h3>${L('建议下一步', 'Suggested next step')}：${R(S[next].name)}</h3>${R(S[next].tagline, 'p')}<p><a class="button primary" href="#m-${next}" data-open="${next}">${L('打开这门学科', 'Open this subject')} <i class="ico-ext ico-down" aria-hidden="true"></i></a> <button type="button" class="button" id="fm-reset">${L('清除全部勾选', 'Clear all ticks')}</button></p>`
      : `<h3>${L('这条路线上的自测都已过关', 'Every self-check on this track is done')}</h3><p>${L('可以开始读母栏目里的研究文献，或者换另一条路线。', 'Start on the research literature in the parent section, or switch to the other track.')}</p><p><button type="button" class="button" id="fm-reset">${L('清除全部勾选', 'Clear all ticks')}</button></p>`}</div>
      <ul class="fm-meters">${order.map((id) => `<li><a href="#m-${id}" data-open="${id}" translate="no" lang="${lang}">${esc(sn(id))}</a><span class="fm-meter" data-tier="${S[id].tier}"><i style="width:${Math.round(pct(id) * 100)}%"></i></span><span class="fm-meter-n" translate="no">${Math.round(pct(id) * S[id].checks.length)}/${S[id].checks.length}</span></li>`).join('')}</ul>`;
    for (const el of document.querySelectorAll('.fm-side-p')) { const p = pct(el.dataset.p); el.style.setProperty('--p', p); el.title = `${Math.round(p * 100)}%`; }
  };
  document.addEventListener('change', (e) => {
    const c = e.target.closest('input[data-check]'); if (!c) return;
    if (c.checked) progress.add(c.dataset.check); else progress.delete(c.dataset.check);
    saveProgress(); drawStart();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#fm-reset')) return;
    progress.clear(); saveProgress();
    for (const c of document.querySelectorAll('input[data-check]')) c.checked = false;
    drawStart();
  });
  drawStart();

  // ── 书目与视频库 ──────────────────────────────────────────────────────
  $('#fm-library-h').innerHTML = L('书目与视频', 'Books & videos');
  $('#fm-lib-note').innerHTML = L(`全部 ${D.books.length} 本教材与论文、${D.videos.length} 门视频课与资源，${D.checked} 核对。有 DOI 的条目在 Crossref 核对过书名、作者、出版社与年份；中文教材请以出版社最新版为准；标“转载”的视频不是作者或课程方上传。`, `All ${D.books.length} books and papers and ${D.videos.length} video courses and resources, checked on ${D.checked}. Entries with a DOI were checked against Crossref for title, authors, publisher and year; for Chinese textbooks use the publisher's latest edition; videos marked "Reupload" were not uploaded by the author or course.`);
  $('#fm-lib-filters').innerHTML = `<label>${L('学科', 'Subject')}<select id="fm-f-sub"><option value="">${esc(en ? 'All subjects' : '全部学科')}</option>${D.subjects.map((s) => `<option value="${s.id}">${esc(tx(s.name))}</option>`).join('')}</select></label>
    <label>${L('类型', 'Type')}<select id="fm-f-type"><option value="">${esc(en ? 'All types' : '全部类型')}</option><option value="book">${esc(en ? 'Books' : '教材')}</option><option value="paper">${esc(en ? 'Papers & reviews' : '论文与综述')}</option><option value="video">${esc(en ? 'Videos & courses' : '视频与课程')}</option></select></label>
    <label class="fm-f-check"><input type="checkbox" id="fm-f-free">${L('只看可免费阅读 / 观看', 'Free to read or watch only')}</label>`;
  for (const el of document.querySelectorAll('#fm-lib-filters select')) el.setAttribute('translate', 'no');
  const subjOfVideo = Object.fromEntries(D.videos.map((v) => [v.id, D.subjects.filter((s) => s.videos.includes(v.id)).map((s) => s.id)]));
  const drawLib = () => {
    const sub = $('#fm-f-sub').value, type = $('#fm-f-type').value, free = $('#fm-f-free').checked;
    const books = type === 'video' ? [] : D.books.filter((b) => (!sub || b.subj === sub || S[sub]?.books.includes(b.id)) && (!type || (type === 'paper') === (b.role === 'paper')) && (!free || b.free));
    const vids = type && type !== 'video' ? [] : D.videos.filter((v) => (!sub || subjOfVideo[v.id].includes(sub)));
    $('#fm-lib-count').innerHTML = L(`共 ${books.length} 本书与论文、${vids.length} 门视频课`, `${books.length} books & papers, ${vids.length} video courses`);
    const groups = D.subjects.map((s) => [s, books.filter((b) => b.subj === s.id)]).filter(([, l]) => l.length);
    $('#fm-lib').innerHTML = groups.map(([s, l]) => `<div class="fm-lib-g"><h3>${chip(s.id)}</h3><ul class="fm-cards">${l.map(bookCard).join('')}</ul></div>`).join('')
      + (vids.length ? `<div class="fm-lib-g"><h3>${L('视频与在线课程', 'Videos & online courses')}</h3><ul class="fm-cards">${vids.map(videoCard).join('')}</ul></div>` : '');
  };
  $('#fm-lib-filters').addEventListener('change', drawLib);
  drawLib();

  $('#fm-foot').innerHTML = `<strong>${L('MolAstria · 数学基础与探索', 'MolAstria · Mathematical Foundations & Exploration')}</strong>
    <p>${L('讲解、大纲和练习由 MolAstria 编写；书目与视频只收录核对过、真实存在的条目，不代表作者或平台认可本站。', 'Explanations, outlines and exercises are written by MolAstria; the lists contain only entries we checked and that exist, and imply no endorsement by authors or platforms.')}</p>
    <p><a href="../index.html">${L('返回进一步基础科学发现', 'Back to Advancing Fundamental Science')}</a> · <a href="../index.html#fs-lab">${L('交互式理论实验室', 'Interactive theory lab')}</a> · <a href="../../qchem/index.html#lab">${L('浏览器里的量子化学计算器', 'Quantum chemistry calculator in the browser')}</a> · <a href="#fm-h1">${L('回到顶部', 'Back to top')} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p>`;

  // ── 地址 ──────────────────────────────────────────────────────────────
  const fromHash = () => { const h = location.hash.slice(1); if (h.startsWith('m-') && selectSubject(h.slice(2))) setTimeout(() => $('#fm-subjects').scrollIntoView({ block: 'start' }), 60); };
  window.addEventListener('hashchange', fromHash);
  selectSubject(D.subjects[0].id);
  fromHash();
})();
