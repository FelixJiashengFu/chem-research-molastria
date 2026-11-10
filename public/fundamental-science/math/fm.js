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
      <div class="fq" data-fq="MOLASTRIA_FM_QUIZ" data-fq-item="${s.id}" data-fq-store="molastria-fm-quiz"></div>
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

  // ── 概率论的交互演示：大数定律与中心极限定理 ──────────────────────────
  // 只放在“概率论与随机过程”的详解里（插在教材与视频之前）；面板打开、滚到眼前时才开始计算。数学在 fm-prob.js。
  (() => {
    const PB = window.MOLASTRIA_FM_PROB, host = $('#m-pr');
    if (!PB || !host) return;
    const DISTS = [['coin', '硬币（正面记 1）', 'Coin (heads = 1)'], ['die', '公平骰子', 'Fair die'], ['loaded', '灌铅骰子（一半是 6）', 'Loaded die (6 half the time)'], ['exp', '指数分布（λ = 1）', 'Exponential (λ = 1)']];
    const NS = [1, 2, 3, 4, 5, 8, 10, 15, 20, 30, 50, 100];
    const opts = (sel) => DISTS.map(([k, zh, e]) => `<option value="${k}"${k === sel ? ' selected' : ''}>${esc(en ? e : zh)}</option>`).join('');
    const slider = (id, zh, e, min, max, step, value) => `<label>${L(zh, e)}<span><input type="range" id="${id}" min="${min}" max="${max}" step="${step}" value="${value}"><output id="${id}-v" translate="no"></output></span></label>`;
    const demo = (n, id, zh, e, intro, controls, notes) => `<article class="fs-demo" id="${id}" aria-labelledby="${id}-h">
        <header><p class="fs-demo-n">${L(`演示 ${n}`, `Demo ${n}`)}</p><h3 id="${id}-h">${L(zh, e)}</h3><p class="muted">${intro}</p></header>
        <div class="fs-demo-body"><div class="fs-controls">${controls}</div><figure class="fs-figure"><canvas id="${id}-cv" width="720" height="360" role="img"></canvas><figcaption id="${id}-cap"></figcaption></figure></div>
        <details class="fs-notes"><summary>${L('模型说明与局限', 'About the model and its limits')}</summary><p>${notes}</p></details>
      </article>`;
    const lab = document.createElement('section');
    lab.className = 'fm-prob'; lab.id = 'fm-prob';
    lab.setAttribute('aria-labelledby', 'fm-prob-h');
    lab.innerHTML = `<h4 id="fm-prob-h">${L('交互演示：大数定律与中心极限定理', 'Interactive: the law of large numbers and the central limit theorem')}</h4>
      <p class="fm-prob-note">${L('两个演示都在浏览器里现算，随机数带种子，同样的操作得到同样的图。', 'Both demos compute live in your browser with a seeded random generator, so the same steps give the same picture.')}</p>`
      + demo(1, 'fm-lln', '大数定律：累计平均值收敛到期望', 'Law of large numbers: the running mean settles on the expectation',
        L('每次抽一个数，记下到目前为止的平均值 x̄ₙ。大数定律说 x̄ₙ 几乎必然收敛到期望 μ；中心极限定理进一步说偏差约为 σ/√n，所以阴影带 μ ± 1.96σ/√n 按 1/√n 收窄。横轴是对数刻度。',
          'Draw one value at a time and track the running mean x̄ₙ. The law of large numbers says x̄ₙ converges almost surely to the expectation μ; the central limit theorem adds that the deviation is about σ/√n, so the shaded band μ ± 1.96σ/√n narrows like 1/√n. The horizontal axis is logarithmic.'),
        `<label>${L('分布', 'Distribution')}<select id="fm-lln-d" translate="no">${opts('die')}</select></label>
         ${slider('fm-lln-n', '抽样次数 N', 'Number of draws N', 0, 4, 0.01, 3)}
         <div class="fs-btns"><button type="button" class="button primary" id="fm-lln-play">${L('从头播放', 'Play from the start')}</button><button type="button" class="button" id="fm-lln-new">${L('换一串（新种子）', 'New sequence (new seed)')}</button></div>
         <dl class="fs-readout" id="fm-lln-read" aria-live="polite"></dl>`,
        L('随机数来自带种子的 mulberry32 生成器，读数里写着种子；拖动 N 时，较短的路径就是较长路径的开头。阴影带是逐点的 95% 区间：对每个固定的 n，x̄ₙ 落在带内的概率约为 95%（n 小时是近似），但整条路径迟早会越出带子。重对数律说偏差最大能到 σ√(2 ln ln n / n)，最终比任何固定倍数的 σ/√n 都宽。',
          'The random numbers come from a seeded mulberry32 generator, and the seed is shown in the readout; as you drag N, a shorter path is the start of the longer one. The band is a pointwise 95% interval: for each fixed n, x̄ₙ lies inside with probability about 95% (approximately, for small n), yet the whole path leaves the band again and again. The law of the iterated logarithm says the deviation reaches σ√(2 ln ln n / n), which eventually exceeds any fixed multiple of σ/√n.'))
      + demo(2, 'fm-clt', '中心极限定理：样本均值的分布', 'Central limit theorem: the distribution of sample means',
        L('从一个偏斜的分布里抽 n 个数求平均，重复上千次，把这些样本均值画成直方图。只要方差有限，n 变大时直方图都趋向均值 μ、标准差 σ/√n 的正态分布（曲线），偏度按 γ/√n 消失。n = 1 时直方图就是原来的分布。',
          'Draw n values from a skewed distribution and average them; repeat a thousand times and plot the sample means as a histogram. Whenever the variance is finite, the histogram approaches the normal curve with mean μ and standard deviation σ/√n as n grows, and the skewness fades like γ/√n. At n = 1 the histogram is the original distribution.'),
        `<label>${L('分布', 'Distribution')}<select id="fm-clt-d" translate="no">${opts('exp')}</select></label>
         ${slider('fm-clt-n', '每组的样本量 n', 'Sample size per group n', 0, NS.length - 1, 1, 0)}
         <div class="fs-btns"><button type="button" class="button primary" id="fm-clt-go">${L('再抽 1000 组', 'Draw 1000 samples')}</button><button type="button" class="button" id="fm-clt-reset">${L('清空重来', 'Clear and restart')}</button></div>
         <dl class="fs-readout" id="fm-clt-read" aria-live="polite"></dl>`,
        L('直方图按密度归一（总面积为 1），离散分布的箱子对齐样本均值能取的格点 k/n，所以可以直接和正态曲线比较；落在画面范围之外的少数样本单独计数。换分布或 n 会用同一个种子从头抽，所以同样的点击顺序得到同样的直方图。收敛有多快由 Berry–Esseen 定理给出：分布函数的误差上界正比于 E|X − μ|³ / (σ³√n)，所以偏斜的指数分布比公平骰子收敛得慢。',
          'The histogram is normalised as a density (total area 1), and for discrete distributions the bins line up with the lattice k/n of possible sample means, so it can be compared directly with the normal curve; the few samples outside the plotted range are counted separately. Changing the distribution or n restarts from the same seed, so the same clicks give the same histogram. How fast it converges is the Berry–Esseen theorem: the error in the distribution function is bounded by a constant times E|X − μ|³ / (σ³√n), which is why the skewed exponential converges more slowly than a fair die.'));
    for (const el of lab.querySelectorAll('select')) el.setAttribute('translate', 'no');
    host.insertBefore(lab, host.querySelector('.fm-res'));
    const q = (s) => lab.querySelector(s);

    // 画图工具：颜色每次从 CSS 变量读，深浅主题都对
    const css = () => { const s = getComputedStyle(document.documentElement), g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), line: g('--line'), gold: g('--gold'), info: g('--info'), violet: g('--violet'), accent: g('--accent-text') }; };
    const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
    const sup = (s) => String(s).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
    const fmt = (v, d = 3) => (!Number.isFinite(v) ? '—' : Math.abs(v) >= 1e5 || (Math.abs(v) < 1e-3 && v !== 0) ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, x) => ` × 10${sup(`${s}${x}`)}`) : Number(v.toPrecision(d)).toString());
    const fit = (cv) => {
      const ratio = Number(cv.dataset.ratio || (cv.dataset.ratio = cv.height / cv.width));
      const w = Math.max(240, cv.clientWidth || 0), h = Math.round(w * (w < 520 ? Math.max(ratio, 0.78) : ratio)), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext('2d'); ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      return { ctx, w, h };
    };
    const frame = (cv, o) => {
      const { ctx, w, h } = fit(cv), c = css();
      // 图例放在图的上方，窄屏上自动换行
      ctx.font = font(11.5);
      const rows = [[]]; let lx = 50;
      for (const it of o.legend(c)) { const wd = 32 + ctx.measureText(it[0]).width; if (lx + wd > w - 6 && rows[rows.length - 1].length) { rows.push([]); lx = 50; } rows[rows.length - 1].push([it, lx]); lx += wd; }
      const pad = { l: 46, r: 12, t: 12 + rows.length * 17, b: 34 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b;
      rows.forEach((r, i) => { for (const [[label, color, dash], x] of r) { const y = 13 + i * 17; ctx.strokeStyle = color; ctx.lineWidth = 2.2; ctx.setLineDash(dash || []); ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18, y); ctx.stroke(); ctx.setLineDash([]); ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(label, x + 22, y + 4); } });
      const X = (v) => pad.l + ((o.xs ? o.xs(v) : v) - o.x0) / (o.x1 - o.x0) * W, Y = (v) => pad.t + H - (v - o.y0) / (o.y1 - o.y0) * H;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
      for (const t of o.xt) { ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), pad.t + H); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(o.xf ? o.xf(t) : fmt(t), X(t), pad.t + H + 15); }
      for (const t of o.yt) { ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(pad.l + W, Y(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(fmt(t), pad.l - 6, Y(t) + 4); }
      ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + H); ctx.lineTo(pad.l + W, pad.t + H); ctx.stroke();
      ctx.fillStyle = c.ink2; ctx.textAlign = 'center'; ctx.fillText(o.xl, pad.l + W / 2, h - 4);
      const clip = (fn) => { ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip(); fn(); ctx.restore(); };
      return { ctx, c, X, Y, pad, W, H, clip };
    };
    const ticks = (a, b, n = 5) => { const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(10))); return out; };
    const readout = (el, rows) => { el.innerHTML = rows.map(([zh, e, v, big, raw]) => `<dt>${L(zh, e)}</dt><dd${big ? ' class="fs-big"' : ''} translate="no"${raw == null ? '' : ` data-v="${raw}"`}>${v}</dd>`).join(''); };
    const label = (k) => { const d = DISTS.find((x) => x[0] === k); return en ? d[2] : d[1]; };

    // 演示 1：大数定律
    const lln = { seed: 2026, key: '', path: null, anim: 0 };
    const llnN = () => Math.round(10 ** Number(q('#fm-lln-n').value));
    const drawLln = (quiet = false) => {
      const k = q('#fm-lln-d').value, d = PB.DISTS[k], { mean, sd } = PB.moments(d), [a, b] = PB.support(d), N = llnN();
      if (lln.key !== `${k}|${lln.seed}`) { lln.path = PB.runningMean(d, 10000, lln.seed); lln.key = `${k}|${lln.seed}`; }
      q('#fm-lln-n-v').textContent = `N = ${N}`;
      const y0 = Math.max(a, mean - 2.4 * sd), y1 = Math.min(b, mean + 2.4 * sd), x1 = Math.max(1, Math.log10(N));
      const cv = q('#fm-lln-cv'), f = frame(cv, { x0: 0, x1, xs: (v) => Math.log10(v), y0, y1, xt: [1, 10, 100, 1000, 10000].filter((t) => Math.log10(t) <= x1 + 1e-9), xf: (t) => (t >= 1000 ? `${t / 1000}k` : String(t)), yt: ticks(y0, y1, 5), xl: en ? 'number of draws n (log scale)' : '抽样次数 n（对数刻度）',
        legend: (c) => [[en ? 'running mean x̄ₙ' : '累计平均 x̄ₙ', c.gold], [en ? 'μ' : '期望 μ', c.ink2, [5, 4]], ['μ ± 1.96σ/√n', c.info]] });
      const { ctx, c, X, Y } = f;
      f.clip(() => {
        ctx.beginPath();
        for (let n = 1; n <= N; n = n < 50 ? n + 1 : Math.ceil(n * 1.02)) ctx.lineTo(X(n), Y(Math.min(y1 + 1, mean + PB.band(d, n))));
        for (let n = N; n >= 1; n = n > 50 ? Math.floor(n / 1.02) : n - 1) ctx.lineTo(X(n), Y(Math.max(y0 - 1, mean - PB.band(d, n))));
        ctx.closePath(); ctx.fillStyle = c.info; ctx.globalAlpha = 0.16; ctx.fill(); ctx.globalAlpha = 1;
        ctx.setLineDash([5, 4]); ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X(1), Y(mean)); ctx.lineTo(X(N), Y(mean)); ctx.stroke(); ctx.setLineDash([]);
        ctx.strokeStyle = c.gold; ctx.lineWidth = 1.8; ctx.beginPath();
        let last = -1;
        for (let n = 1; n <= N; n++) { const px = X(n); if (px - last < 0.4 && n !== N) continue; last = px; ctx.lineTo(px, Y(lln.path[n - 1])); }
        ctx.stroke();
      });
      if (quiet) return; // 播放途中只画图，读数和说明在停下时再写，免得读屏软件一直播报
      const xN = lln.path[N - 1], half = PB.band(d, N), inside = Math.abs(xN - mean) <= half;
      readout(q('#fm-lln-read'), [['种子', 'Seed', String(lln.seed)], ['N 次后的平均 x̄', 'Mean after N draws x̄', fmt(xN, 5), true, xN], ['期望 μ', 'Expectation μ', fmt(mean, 5)],
        ['偏差 |x̄ − μ|', 'Deviation |x̄ − μ|', fmt(Math.abs(xN - mean), 3)], ['95% 带的半宽 1.96σ/√N', '95% half-width 1.96σ/√N', fmt(half, 3), false, half],
        ['此刻在带内', 'Inside the band now', inside ? (en ? 'yes' : '是') : (en ? 'no' : '否')]]);
      const cap = en ? `${label(k)}: running mean of the first ${N} draws (seed ${lln.seed}); after N draws it is ${fmt(xN, 4)} against μ = ${fmt(mean, 4)}.` : `${label(k)}：前 ${N} 次的累计平均（种子 ${lln.seed}）；N 次之后是 ${fmt(xN, 4)}，期望 μ = ${fmt(mean, 4)}。`;
      q('#fm-lln-cap').innerHTML = C(esc(cap)); cv.setAttribute('aria-label', cap);
    };
    const stopLln = () => { cancelAnimationFrame(lln.anim); lln.anim = 0; };
    const playLln = () => {
      stopLln();
      const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches, slider = q('#fm-lln-n');
      if (reduce) { slider.value = 4; drawLln(); return; }
      const t0 = performance.now();
      const step = (t) => {
        if (host.hidden || document.hidden) { stopLln(); drawLln(); return; }
        const u = Math.min(1, (t - t0) / 4000); slider.value = (u * 4).toFixed(2); drawLln(u < 1);
        lln.anim = u < 1 ? requestAnimationFrame(step) : 0;
      };
      slider.value = 0; lln.anim = requestAnimationFrame(step);
    };
    q('#fm-lln-d').addEventListener('change', () => { stopLln(); drawLln(); });
    q('#fm-lln-n').addEventListener('input', () => { stopLln(); drawLln(); });
    q('#fm-lln-play').addEventListener('click', playLln);
    q('#fm-lln-new').addEventListener('click', () => { stopLln(); lln.seed++; drawLln(); });

    // 演示 2：中心极限定理
    const clt = { seed: 7, rand: null, means: [], key: '' };
    const cltReset = () => { clt.rand = PB.rng(clt.seed); clt.means = []; clt.key = `${q('#fm-clt-d').value}|${q('#fm-clt-n').value}`; };
    const cltDraw = (count) => { const d = PB.DISTS[q('#fm-clt-d').value], n = NS[Number(q('#fm-clt-n').value)]; if (clt.means.length < 200000) clt.means.push(...PB.sampleMeans(d, n, count, clt.rand)); };
    const drawClt = () => {
      const k = q('#fm-clt-d').value, n = NS[Number(q('#fm-clt-n').value)], d = PB.DISTS[k], { mean, sd, skew } = PB.moments(d), se = sd / Math.sqrt(n);
      if (clt.key !== `${k}|${q('#fm-clt-n').value}` || !clt.rand) { cltReset(); cltDraw(1000); }
      q('#fm-clt-n-v').textContent = `n = ${n}`;
      const { lo, hi, bins } = PB.binsFor(d, n), hst = PB.histogram(clt.means, lo, hi, bins), total = clt.means.length;
      const dens = hst.counts.map((c) => c / (total * hst.width)), peak = PB.normalPdf(mean, mean, se), y1 = Math.max(peak, ...dens) * 1.12;
      const cv = q('#fm-clt-cv'), f = frame(cv, { x0: lo, x1: hi, y0: 0, y1, xt: ticks(lo, hi, 6), yt: ticks(0, y1, 4), xl: en ? 'sample mean x̄ (bars: density of the sample means)' : '样本均值 x̄（柱：样本均值的密度）',
        legend: (c) => [[en ? `${total} sample means` : `${total} 个样本均值`, c.gold], [en ? 'normal N(μ, σ²/n)' : '正态 N(μ, σ²/n)', c.info], [en ? 'μ' : '期望 μ', c.ink2, [5, 4]]] });
      const { ctx, c, X, Y } = f;
      f.clip(() => {
        ctx.fillStyle = c.gold; ctx.globalAlpha = 0.55;
        dens.forEach((v, j) => { const xa = X(lo + j * hst.width), xb = X(lo + (j + 1) * hst.width); ctx.fillRect(xa + 0.5, Y(v), Math.max(1, xb - xa - 1), Y(0) - Y(v)); });
        ctx.globalAlpha = 1; ctx.strokeStyle = c.info; ctx.lineWidth = 2.2; ctx.beginPath();
        for (let i = 0; i <= 300; i++) { const x = lo + (hi - lo) * i / 300; ctx.lineTo(X(x), Y(PB.normalPdf(x, mean, se))); }
        ctx.stroke();
        ctx.setLineDash([5, 4]); ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(mean), Y(0)); ctx.lineTo(X(mean), Y(y1)); ctx.stroke(); ctx.setLineDash([]);
      });
      const s = PB.summary(clt.means), out = hst.under + hst.over;
      readout(q('#fm-clt-read'), [['种子 · 已抽组数', 'Seed · groups drawn', `${clt.seed} · ${total}`, false, total], ['样本均值的平均', 'Mean of the means', `${fmt(s.mean, 4)}  (μ = ${fmt(mean, 4)})`],
        ['样本均值的标准差', 'SD of the means', `${fmt(s.sd, 3)}  (σ/√n = ${fmt(se, 3)})`, true, s.sd / se], ['样本均值的偏度', 'Skewness of the means', `${fmt(s.skew, 2)}  (γ/√n = ${fmt(skew / Math.sqrt(n), 2)})`],
        ...(out ? [['画面范围之外', 'Outside the plotted range', String(out)]] : [])]);
      const cap = en ? `${label(k)}, n = ${n}: histogram of ${total} sample means against the normal density with mean ${fmt(mean, 3)} and standard deviation ${fmt(se, 3)}.` : `${label(k)}，n = ${n}：${total} 个样本均值的直方图，对照均值 ${fmt(mean, 3)}、标准差 ${fmt(se, 3)} 的正态密度。`;
      q('#fm-clt-cap').innerHTML = C(esc(cap)); cv.setAttribute('aria-label', cap);
    };
    q('#fm-clt-d').addEventListener('change', drawClt);
    q('#fm-clt-n').addEventListener('input', drawClt);
    q('#fm-clt-go').addEventListener('click', () => { if (!clt.rand) drawClt(); cltDraw(1000); drawClt(); });
    q('#fm-clt-reset').addEventListener('click', () => { cltReset(); cltDraw(1000); drawClt(); });

    // 只在面板打开、演示进入视野时画；之后随窗口大小和主题重画
    let started = false, pending = 0;
    const redraw = () => { if (!started || host.hidden) return; cancelAnimationFrame(pending); pending = requestAnimationFrame(() => { drawLln(); drawClt(); }); };
    const start = () => { if (started || host.hidden) return; started = true; drawLln(); drawClt(); };
    if ('IntersectionObserver' in window) new IntersectionObserver((es) => { if (es.some((e) => e.isIntersecting)) { if (started) redraw(); else start(); } }).observe(lab);
    else start();
    let rt = 0; window.addEventListener('resize', () => { clearTimeout(rt); rt = setTimeout(redraw, 150); });
    new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redraw);
    document.addEventListener('visibilitychange', () => { if (document.hidden) stopLln(); });
  })();

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
