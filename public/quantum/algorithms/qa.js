'use strict';
// 量子算法：把 qa-data.js 画成页面（三层、关系图、加速账本、实验室五个演示、算法详解、资源估算、学习路线、自测、文献与视频），
// 演示的数学在 qa-models.js，这里只负责控件和画图。内容是中英两版，按站点语言取用并标 translate="no"，英文页不依赖词典。
// 地址：#a-<算法> 打开对应的详解，#ref-<id> 跳到文献。自测勾选存在 molastria-qa-progress，路线存在 molastria-qa-track，
// 模拟器里的线路存在 molastria-qa-circuit。
(() => {
  const D = window.MOLASTRIA_QA, MATH = window.MOLASTRIA_QA_MATH || {}, M = window.MOLASTRIA_QA_MODELS;
  if (!D || !M) return;
  const VID = window.MOLASTRIA_VIDEOS?.items || [];
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  // 正文里的 x^{…}、λ_j 之类写成上下标
  const rich = (s) => esc(s)
    .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/\^([A-Za-z0-9])/g, '<sup>$1</sup>')
    .replace(/([\p{L}0-9])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/gu, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(esc(en ? e : zh));
  const R = (t, tag = 'span', cls = '') => C(rich(tx(t)), tag, cls);
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  const store = { get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } }, set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } } };
  const smooth = () => (matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth');

  const A = Object.fromEntries(D.algos.map((a) => [a.id, a]));
  const AP = Object.fromEntries(D.apps.map((a) => [a.id, a]));
  const REF = Object.fromEntries(D.refs.map((r) => [r.id, r]));
  const tierOf = (id) => D.tiers.find((t) => t.id === A[id].tier);
  const short = {
    query: ['线路与查询', 'Circuits & queries'], qft: ['量子傅里叶变换', 'Quantum Fourier'], qpe: ['相位估计', 'Phase estimation'], aa: ['振幅放大', 'Amplitude amp.'], qsvt: ['块编码与 QSVT', 'Block enc. & QSVT'],
    shor: ['Shor 算法', 'Shor'], hamsim: ['哈密顿量模拟', 'Ham. simulation'], hhl: ['线性方程组', 'Linear systems'], walk: ['量子行走', 'Quantum walks'],
    mapping: ['费米子映射', 'Fermion mappings'], chemqpe: ['化学基态能量', 'Chemical energies'], vqe: ['VQE', 'VQE'], qaoa: ['QAOA', 'QAOA'], mitig: ['误差缓解', 'Error mitigation'],
    crypto: ['密码分析', 'Cryptanalysis'], search: ['搜索与优化', 'Search & optim.'], chem: ['化学与材料', 'Chemistry'], linalg: ['线性代数与 ML', 'Linear alg. & ML'], physics: ['物理模拟', 'Physics sim.'],
  };
  const sn = (id) => (en ? short[id][1] : short[id][0]);
  const chip = (id) => (A[id] ? `<a class="fm-chip" data-tier="${A[id].tier}" href="#a-${id}" data-open="${id}" translate="no" lang="${lang}">${esc(sn(id))}</a>` : `<span class="fm-chip fm-chip-target" translate="no" lang="${lang}">${esc(sn(id))}</span>`);
  const ev = (e) => `<span class="qa-ev" data-e="${e}" translate="no" lang="${lang}" title="${esc(tx(D.evidence[e].long))}">${esc(tx(D.evidence[e]))}</span>`;
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  const lastName = (s) => s.trim().split(/\s+/).pop();
  const shortRef = (r) => { const au = r.authors.split(',').map((x) => x.trim()); const first = au[0].replace(/ et al\.?$/, ''); return `${/^Google/.test(first) ? 'Google' : lastName(first)}${au.length === 2 ? ` & ${lastName(au[1])}` : au.length > 2 || / et al/.test(r.authors) ? ' et al.' : ''} ${r.year}`; };
  const cite = (ids) => (ids?.length ? `<p class="fs-cite">${ids.map((id) => `<a href="#ref-${id}" data-ref="${id}" translate="no">${esc(shortRef(REF[id]))}</a>`).join(' · ')}</p>` : '');
  const progress = new Set(store.get('molastria-qa-progress', []));
  const saveProgress = () => store.set('molastria-qa-progress', [...progress]);

  if (en) {
    document.title = 'Quantum Algorithms · MolAstria';
    $('#qa-h1').innerHTML = '<span translate="no" lang="en">Quantum Algorithms</span>';
    document.querySelector('.skip').textContent = 'Skip to the interactive lab';
    $('#qa-crumbs').setAttribute('aria-label', 'Location');
    $('#qa-jump').setAttribute('aria-label', 'On this page');
  }

  // ── 首屏 ──────────────────────────────────────────────────────────────
  $('#qa-crumbs').innerHTML = `<a href="../index.html">${L('量子嘉年华', 'Quantum Carnival')}</a><span aria-hidden="true">/</span>${L('量子算法', 'Quantum Algorithms')}`;
  $('#qa-quote').innerHTML = C(esc(tx(D.hero.quote))) + (en ? '' : `<span class="fs-q-en" lang="en" translate="no">${esc(D.hero.quote.en)}</span>`);
  $('#qa-lead').innerHTML = C(esc(tx(D.hero.lead)));
  $('#qa-honest').innerHTML = C(esc(tx(D.hero.honesty)));
  const freeN = D.refs.filter((r) => r.free).length;
  $('#qa-stats').innerHTML = [
    [D.algos.length, '个算法与方法', 'algorithms & methods'], [5, '个浏览器里的演示', 'demos in the browser'], [D.refs.length, '篇核对过的文献', 'checked references'],
    [freeN, '篇可合法免费阅读', 'free to read legally'], [D.estimates.length, '份资源估算', 'resource estimates'],
  ].map(([n, zh, e]) => `<div><dt translate="no">${n}</dt><dd>${L(zh, e)}</dd></div>`).join('');
  $('#qa-jump').innerHTML = [
    ['#qa-lab', '交互实验室', 'Interactive lab', true], ['#qa-ledger', '加速账本', 'Speedup ledger'], ['#qa-map', '算法关系图', 'Map of algorithms'],
    ['#qa-algos', '十四个算法详解', 'The fourteen algorithms'], ['#qa-resources', '化学资源估算', 'Chemistry resource estimates'], ['#qa-path', '学习路线', 'Study tracks'], ['#qa-library', '文献与视频', 'Papers & videos'],
  ].map(([h, zh, e, p]) => `<a class="button${p ? ' primary' : ''}" href="${h}">${L(zh, e)}</a>`).join('');

  // ── 三层 ──────────────────────────────────────────────────────────────
  $('#qa-layers-h').innerHTML = L('三层结构', 'Three layers');
  $('#qa-layers-note').innerHTML = L('这里只讲逻辑层：假设量子比特已经纠错、门是完美的。量子比特怎样造、噪声从哪里来、纠错要多少物理比特，见量子计算机展馆；叠加、测量和纠缠的物理本身，见量子物理展馆。', 'This section covers only the logical layer: assume error-corrected qubits and perfect gates. How qubits are built, where noise comes from and how many physical qubits error correction needs are in the Quantum Computers pavilion; the physics of superposition, measurement and entanglement is in the Quantum Physics pavilion.')
    + ` <a href="../computing/index.html">${L('量子计算机', 'Quantum Computers')}</a> · <a href="../physics/index.html">${L('量子物理', 'Quantum Physics')}</a>`;
  $('#qa-tier-grid').innerHTML = D.tiers.map((t) => `<article class="fm-tier" data-tier="${t.id}">
      <p class="fm-tier-n">${R(t.name)}</p><h3>${R(t.tag)}</h3><p>${R(t.desc)}</p>
      <ul>${D.algos.filter((a) => a.tier === t.id).map((a) => `<li><a href="#a-${a.id}" data-open="${a.id}"><span class="fm-glyph" aria-hidden="true">${esc(a.glyph)}</span>${R(a.name)}</a>${C(rich(tx(a.tagline)), 'small')}</li>`).join('')}</ul>
    </article>`).join('');

  // ── 关系图 ────────────────────────────────────────────────────────────
  $('#qa-map-h').innerHTML = L('算法之间的关系', 'How the algorithms connect');
  $('#qa-map-note').innerHTML = L('箭头从“提供工具的一方”指向“用到它的一方”，最右边是应用方向。点一个节点，右侧列出它用到什么、又被谁用到，每条关系都写明具体用到了哪一步。', 'Arrows run from the piece that supplies a tool to the one that uses it; application areas sit on the right. Click a node to list what it uses and what uses it, with the concrete step behind each link.');
  const COLX = [110, 360, 610, 870], ROWS = { 1: [90, 200, 310, 420, 530], 2: [120, 250, 380, 510], 3: [90, 200, 310, 420, 530] };
  const POS = {};
  for (const t of [1, 2, 3]) D.algos.filter((a) => a.tier === t).forEach((a, i) => { POS[a.id] = [COLX[t - 1], ROWS[t][i]]; });
  const appOrder = ['crypto', 'chem', 'physics', 'linalg', 'search'];
  appOrder.forEach((id, i) => { POS[id] = [COLX[3], 90 + i * 110]; });
  const W = 180, H = 46, TW = 170;
  const halfW = (id) => (AP[id] ? TW / 2 : W / 2);
  const edgePath = (a, b) => {
    const [x1, y1] = POS[a], [x2, y2] = POS[b];
    if (Math.abs(x1 - x2) < 10) { const x = x1 + W / 2, k = 40; return `M${x} ${y1}C${x + k} ${y1} ${x + k} ${y2} ${x} ${y2}`; }
    const dir = x2 > x1 ? 1 : -1, sx = x1 + dir * halfW(a), ex = x2 - dir * halfW(b), dx = (ex - sx) / 2;
    return `M${sx} ${y1}C${sx + dx} ${y1} ${ex - dx} ${y2} ${ex} ${y2}`;
  };
  const svg = $('#qa-graph');
  svg.setAttribute('aria-label', en ? 'Map of relations between the algorithms' : '算法关系图');
  const nodeSvg = (id) => {
    const [x, y] = POS[id];
    if (AP[id]) return `<g class="fm-node fm-app" data-id="${id}" tabindex="0" role="button" aria-label="${esc(sn(id))}"><rect x="${x - TW / 2}" y="${y - 26}" width="${TW}" height="52" rx="12"/><text x="${x}" y="${y + 5}" text-anchor="middle" translate="no">${esc(sn(id))}</text></g>`;
    const a = A[id], g = a.glyph.length > 3 ? a.glyph.slice(0, 3) : a.glyph;
    return `<g class="fm-node" data-id="${id}" data-tier="${a.tier}" tabindex="0" role="button" aria-label="${esc(sn(id))}"><rect x="${x - W / 2}" y="${y - H / 2}" width="${W}" height="${H}" rx="9"/><circle cx="${x - W / 2 + 22}" cy="${y}" r="15"/><text class="fm-node-g" x="${x - W / 2 + 22}" y="${y + 4.5}" text-anchor="middle" translate="no">${esc(g)}</text><text x="${x - W / 2 + 44}" y="${y + 4.5}" translate="no">${esc(sn(id))}</text></g>`;
  };
  svg.innerHTML = `<defs><marker id="qa-arrow" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse"><path d="M0 0L10 5L0 10z"/></marker></defs>`
    + D.tiers.map((t, i) => `<text class="fm-col-label" x="${COLX[i]}" y="34" text-anchor="middle" translate="no">${esc(tx(t.name))} · ${esc(tx(t.tag))}</text>`).join('')
    + `<text class="fm-col-label" x="${COLX[3]}" y="34" text-anchor="middle" translate="no">${esc(en ? 'Applications' : '应用方向')}</text>`
    + `<g class="fm-edges">${D.relations.map(([a, b, t], i) => `<path class="fm-edge" data-a="${a}" data-b="${b}" data-i="${i}" d="${edgePath(a, b)}" marker-end="url(#qa-arrow)"><title>${esc(sn(a))} → ${esc(sn(b))}: ${esc(tx(t))}</title></path>`).join('')}</g>`
    + Object.keys(POS).map(nodeSvg).join('');
  const panel = $('#qa-map-panel');
  const relLine = ([a, b, t], side) => `<li>${chip(side === 'in' ? a : b)}${R(t, 'p')}</li>`;
  const showNode = (id) => {
    for (const g of svg.querySelectorAll('.fm-node')) g.classList.toggle('on', g.dataset.id === id);
    for (const p of svg.querySelectorAll('.fm-edge')) { const hit = p.dataset.a === id || p.dataset.b === id; p.classList.toggle('on', !!id && hit); p.classList.toggle('dim', !!id && !hit); }
    svg.classList.toggle('focused', !!id);
    if (!id) { panel.innerHTML = `<p class="fm-panel-k">${L('怎么读这张图', 'How to read the map')}</p><p>${L('左边三列是三层算法，右边是应用方向。相位估计和块编码是现代量子算法的两根主梁：Shor、化学能量计算、线性方程组和哈密顿量模拟，都至少经过其中一根。', 'The three left columns are the three layers; application areas are on the right. Phase estimation and block encodings are the two main beams of modern quantum algorithms: Shor, chemical energies, linear systems and Hamiltonian simulation all rest on at least one of them.')}</p><p class="muted">${L('点任意一个节点，看它和其他算法的具体联系。', 'Click any node to see its concrete links to the others.')}</p>`; return; }
    const ins = D.relations.filter((r) => r[1] === id), outs = D.relations.filter((r) => r[0] === id);
    const head = A[id] ? `<p class="fm-panel-k" data-tier="${A[id].tier}">${R(tierOf(id).name)} · ${R(tierOf(id).tag)}</p><h3>${R(A[id].name)}</h3><p>${ev(A[id].evidence)}</p>${R(A[id].tagline, 'p')}` : `<p class="fm-panel-k">${L('应用方向', 'Application')}</p><h3>${R(AP[id].name)}</h3>${R(AP[id].desc, 'p')}`;
    panel.innerHTML = head
      + (ins.length ? `<h4>${L('用到', 'Uses')}</h4><ul class="fm-rel">${ins.map((r) => relLine(r, 'in')).join('')}</ul>` : '')
      + (outs.length ? `<h4>${L('被用于', 'Used by')}</h4><ul class="fm-rel">${outs.map((r) => relLine(r, 'out')).join('')}</ul>` : '')
      + (A[id] ? `<p><a class="button primary" href="#a-${id}" data-open="${id}">${L('打开这个算法的详解', 'Open this algorithm')} <i class="ico-ext ico-down" aria-hidden="true"></i></a></p>` : '');
  };
  let picked = null;
  svg.addEventListener('click', (e) => { const g = e.target.closest('.fm-node'); picked = g && g.dataset.id !== picked ? g.dataset.id : null; showNode(picked); });
  svg.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && e.target.closest('.fm-node')) { e.preventDefault(); picked = e.target.closest('.fm-node').dataset.id; showNode(picked); } });
  svg.addEventListener('mouseover', (e) => { const g = e.target.closest('.fm-node'); if (g && !picked) showNode(g.dataset.id); });
  svg.addEventListener('mouseleave', () => { if (!picked) showNode(null); });
  showNode(null);
  $('#qa-rel-sum').innerHTML = L(`全部 ${D.relations.length} 条关系（文字版）`, `All ${D.relations.length} links (as text)`);
  $('#qa-rel-list').innerHTML = D.relations.map(([a, b, t]) => `<li>${chip(a)}<span class="fm-arrow" aria-hidden="true">→</span>${chip(b)}${R(t, 'p')}</li>`).join('');

  // ── 加速账本 ──────────────────────────────────────────────────────────
  $('#qa-ledger-h').innerHTML = L('加速账本', 'The speedup ledger');
  $('#qa-ledger-note').innerHTML = L('每一行都回答四个问题：解决什么问题、量子要花多少、经典最好的方法要花多少、这个差距有多可靠。“经典最好”指已知最好的算法，不是证明过的下界。', 'Every row answers four questions: what problem, what the quantum cost is, what the best classical method costs, and how firm the gap is. “Best classical” means the best known algorithm, not a proven lower bound.');
  $('#qa-legend').innerHTML = Object.keys(D.evidence).map((e) => `<li>${ev(e)}${R(D.evidence[e].long)}</li>`).join('');
  let evFilter = '';
  const ledgerFilter = $('#qa-ledger-filter');
  ledgerFilter.setAttribute('aria-label', en ? 'Filter by evidence level' : '按证据等级筛选');
  const drawLedger = () => {
    ledgerFilter.innerHTML = [['', en ? 'All' : '全部'], ...Object.keys(D.evidence).map((e) => [e, tx(D.evidence[e])])].map(([k, t]) => `<button type="button" class="fs-chip" data-ev="${k}" aria-pressed="${evFilter === k}" translate="no" lang="${lang}">${esc(t)}${k ? ` (${D.algos.filter((a) => a.evidence === k).length})` : ''}</button>`).join('');
    const rows = D.algos.filter((a) => !evFilter || a.evidence === evFilter);
    $('#qa-ledger-table').innerHTML = `<thead><tr>${[['算法', 'Algorithm'], ['问题', 'Problem'], ['量子代价', 'Quantum cost'], ['已知最好的经典方法', 'Best known classical'], ['加速与前提', 'Speedup and caveats'], ['证据', 'Evidence']].map(([z, e]) => `<th scope="col">${L(z, e)}</th>`).join('')}</tr></thead>
      <tbody>${rows.map((a) => `<tr data-tier="${a.tier}"><td><a href="#a-${a.id}" data-open="${a.id}"><span class="fm-glyph" aria-hidden="true">${esc(a.glyph.length > 3 ? a.glyph.slice(0, 3) : a.glyph)}</span>${R(a.name)}</a></td><td>${R(a.problem)}</td><td class="qa-mono">${R(a.qcost)}</td><td class="qa-mono">${R(a.ccost)}</td><td class="qa-speed">${R(a.speedup)}</td><td>${ev(a.evidence)}</td></tr>`).join('')}</tbody>`;
  };
  ledgerFilter.addEventListener('click', (e) => { const b = e.target.closest('[data-ev]'); if (!b) return; evFilter = b.dataset.ev; drawLedger(); });
  drawLedger();

  // ── 画图工具 ──────────────────────────────────────────────────────────
  const css = () => { const s = getComputedStyle(document.documentElement); const g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), line: g('--line'), accent: g('--accent-text'), accentFill: g('--accent'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), ok: g('--ok'), violet: g('--violet'), paper: g('--paper') }; };
  function fit(cv) {
    const ratio = cv.dataset.ratio ? Number(cv.dataset.ratio) : (cv.dataset.ratio = cv.height / cv.width, cv.height / cv.width);
    const w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth), h = Math.round(w * ratio), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  const sup = (s) => String(s).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
  const fmt = (v, d = 3) => (v === 0 ? '0' : Math.abs(v) >= 1e5 || Math.abs(v) < 1e-3 ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`) : Number(v.toPrecision(d)).toLocaleString(en ? 'en' : 'zh-CN'));
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  // 坐标轴 + 曲线；logX / logY 时 x0…y1 为 log10 值
  function plot(cv, o) {
    const { ctx, w, h } = fit(cv), c = css();
    const pad = { l: 54, r: 14, t: 16, b: 36 }, PW = w - pad.l - pad.r, PH = h - pad.t - pad.b;
    const tX = (v) => (o.logX ? Math.log10(v) : v), tY = (v) => (o.logY ? Math.log10(Math.max(v, 1e-300)) : v);
    const X = (v) => pad.l + ((tX(v) - o.x0) / (o.x1 - o.x0)) * PW, Y = (v) => pad.t + PH - ((tY(v) - o.y0) / (o.y1 - o.y0)) * PH;
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
    for (const t of o.xt) { const x = X(t); ctx.beginPath(); ctx.moveTo(x, pad.t); ctx.lineTo(x, pad.t + PH); ctx.stroke(); ctx.textAlign = 'center'; ctx.fillText(o.xf(t), x, pad.t + PH + 15); }
    for (const t of o.yt) { const y = Y(t); ctx.beginPath(); ctx.moveTo(pad.l, y); ctx.lineTo(pad.l + PW, y); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(o.yf(t), pad.l - 6, y + 4); }
    ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + PH); ctx.lineTo(pad.l + PW, pad.t + PH); ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = 'center'; ctx.fillText(o.xl, pad.l + PW / 2, h - 4);
    ctx.save(); ctx.translate(12, pad.t + PH / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yl, 0, 0); ctx.restore();
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, PW, PH); ctx.clip();
    for (const b of o.bars || []) { ctx.fillStyle = b.color; const bw = Math.max(1, (PW / b.n) * 0.8); ctx.fillRect(X(b.x) - bw / 2, Y(b.y), bw, Y(o.logY ? 10 ** o.y0 : o.y0) - Y(b.y)); }
    for (const s of o.series || []) {
      ctx.beginPath();
      s.xs.forEach((x, i) => (i ? ctx.lineTo(X(x), Y(s.ys[i])) : ctx.moveTo(X(x), Y(s.ys[i]))));
      ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.stroke(); ctx.setLineDash([]);
      if (s.dots) { ctx.fillStyle = s.color; s.xs.forEach((x, i) => { ctx.beginPath(); ctx.arc(X(x), Y(s.ys[i]), s.dots, 0, 2 * Math.PI); ctx.fill(); }); }
    }
    for (const m of o.hmarks || []) { ctx.strokeStyle = m.color; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(pad.l, Y(m.y)); ctx.lineTo(pad.l + PW, Y(m.y)); ctx.stroke(); ctx.setLineDash([]); if (m.label) { ctx.fillStyle = m.color; ctx.textAlign = 'right'; ctx.font = font(11, 600); ctx.fillText(m.label, pad.l + PW - 4, Y(m.y) - 5); } }
    for (const m of o.marks || []) { ctx.strokeStyle = m.color; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(X(m.x), pad.t); ctx.lineTo(X(m.x), pad.t + PH); ctx.stroke(); ctx.setLineDash([]); }
    for (const p of o.points || []) { ctx.fillStyle = p.color; ctx.strokeStyle = c.paper; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(p.x), Y(p.y), p.r || 5, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); }
    ctx.restore();
    let lx = pad.l + 8;
    ctx.font = font(11.5);
    for (const s of [...(o.series || []), ...(o.legend || [])].filter((s) => s.label)) {
      ctx.strokeStyle = s.color; ctx.lineWidth = 2.4; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx, pad.t + 9); ctx.lineTo(lx + 18, pad.t + 9); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(s.label, lx + 22, pad.t + 13);
      lx += 30 + ctx.measureText(s.label).width;
    }
  }
  const ticks = (a, b, n = 5) => { const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(10))); return out; };
  const readout = (el, rows) => { el.innerHTML = rows.map(([k, v, big]) => `<dt>${C(rich(en ? k[1] : k[0]))}</dt><dd${big ? ' class="fs-big"' : ''} translate="no">${v}</dd>`).join(''); };
  const bind = (ids, fn) => { for (const id of ids) $(`#${id}`).addEventListener('input', fn); };
  const demoHead = (p, n, zh, e, izh, ien) => { $(`#${p}-n`).textContent = en ? `Demo ${n}` : `演示 ${n}`; $(`#${p}-h`).innerHTML = L(zh, e); $(`#${p}-intro`).innerHTML = C(rich(en ? ien : izh)); };
  const lab = (id, zh, e) => { $(`#${id}`).innerHTML = L(zh, e); };

  $('#qa-lab-h').innerHTML = L('交互实验室', 'Interactive lab');
  $('#qa-lab-note').innerHTML = L('五个演示都是精确的态矢量计算，在你的浏览器里完成，不连服务器。数值没有噪声，也不是真机结果；演示 5 的 VQE 可以手动加上测量次数带来的统计噪声。', 'All five demos are exact statevector calculations done in your browser, with no server. The numbers are noiseless and not hardware results; in demo 5 you can add the statistical noise of a finite number of shots.');

  // ── 演示 1：量子线路模拟器 ────────────────────────────────────────────
  demoHead('c', 1, '量子线路模拟器', 'Quantum circuit simulator',
    '选一个门再点格子放上去，再点一次就删掉。同一列里的 • 控制这一列所有其他的门（所以 • 加 X 是 CNOT，两个 • 加 X 是 Toffoli）；一列里放两个 × 就交换这两个比特。Rx、Ry、Rz 是带角度的旋转门，角度在右边的框里填（以 π 为单位）；M 在中途测量这个比特，之后控制在它上面的门就是按测量结果的经典控制。点左边的 |0⟩ 可以把初态改成 |1⟩；拖动“看第几列之后”可以一列一列地看态怎么变。最多 5 个比特、12 列。',
    'Pick a gate, then click a cell to place it; click again to remove it. A • controls every other gate in its column (so • plus X is a CNOT, two • plus X is a Toffoli); two × in one column swap those qubits. Rx, Ry and Rz are rotations by the angle in the box (in units of π); M measures that qubit mid-circuit, and later gates controlled on it are classically controlled by the outcome. Click |0⟩ on the left to start that qubit in |1⟩; drag “after column” to step through the circuit. Up to 5 qubits and 12 columns.');
  const COLS = 12, MAXQ = 5;
  const GLAB = { H: 'H', X: 'X', Y: 'Y', Z: 'Z', S: 'S', Sdg: 'S†', T: 'T', Tdg: 'T†', '•': '•', x: '×', M: 'M', Rx: 'Rx', Ry: 'Ry', Rz: 'Rz' };
  // 角度（以 π 为单位）写成 π/2、−π/4、0.35π 这样
  const turnsLabel = (t) => { const f = [[1, 'π'], [-1, '−π'], [0.5, 'π/2'], [-0.5, '−π/2'], [0.25, 'π/4'], [-0.25, '−π/4'], [2, '2π'], [-2, '−2π'], [1.5, '3π/2'], [-1.5, '−3π/2'], [0.75, '3π/4'], [-0.75, '−3π/4']].find(([v]) => Math.abs(v - t) < 1e-9); return f ? f[1] : `${String(t).replace('-', '−')}π`; };
  const glab = (g) => { const p = M.parseGate(g); return !p ? '' : p.turns === undefined ? GLAB[p.name] : `${p.name}(${turnsLabel(p.turns)})`; };
  const saved = store.get('molastria-qa-circuit', null);
  const circ = { n: 2, init: 0, grid: [], tool: 'H', samples: null, step: COLS, turns: 0.5 };
  const emptyGrid = (n) => Array.from({ length: COLS }, () => new Array(n).fill(''));
  const loadPreset = (k) => { const p = M.presets[k]; circ.n = p.n; circ.init = p.init || 0; circ.grid = emptyGrid(p.n); p.grid.forEach((col, i) => { circ.grid[i] = col.slice(); }); circ.samples = null; };
  if (saved && saved.n >= 1 && saved.n <= MAXQ && Array.isArray(saved.grid) && saved.grid.length === COLS && saved.grid.every((c) => Array.isArray(c) && c.length === saved.n && c.every((g) => g === '' || M.parseGate(g)))) Object.assign(circ, { n: saved.n, init: saved.init | 0, grid: saved.grid });
  else loadPreset('bell');
  const saveCirc = () => store.set('molastria-qa-circuit', { n: circ.n, init: circ.init, grid: circ.grid });
  const presetNames = { teleport: ['量子隐形传态（中途测量 + 经典控制）', 'Teleportation (mid-circuit measurement + classical control)'], measure: ['测量打断干涉：H · M · H', 'Measurement breaks interference: H · M · H'], rotation: ['单比特旋转 Rx(π/2)', 'Single-qubit rotation Rx(π/2)'], bell: ['Bell 态', 'Bell state'], ghz: ['GHZ 态（3 比特）', 'GHZ state (3 qubits)'], kickback: ['相位回踢', 'Phase kickback'], dj: ['Deutsch–Jozsa（平衡函数）', 'Deutsch–Jozsa (balanced)'], bv: ['Bernstein–Vazirani（s = 101）', 'Bernstein–Vazirani (s = 101)'], grover: ['两比特 Grover（找 |11⟩）', 'Two-qubit Grover (find |11⟩)'], qft: ['三比特 QFT 作用在 |001⟩', 'Three-qubit QFT on |001⟩'] };
  $('#c-palette').setAttribute('aria-label', en ? 'Gates' : '门');
  const palTitle = (g) => (g === '•' ? (en ? 'Control' : '控制') : g === 'x' ? (en ? 'Swap' : '交换') : g === 'M' ? (en ? 'Measure (Z basis)' : '测量（Z 基）') : g === 'erase' ? (en ? 'Eraser' : '橡皮') : M.ROT.includes(g) ? (en ? `${g}(θ): rotation by the angle in the box` : `${g}(θ)：按右边框里的角度旋转`) : g);
  $('#c-palette').innerHTML = [...M.GRID_GATES, ...M.ROT, 'erase'].map((g) => `<button type="button" class="qa-pal" data-g="${g}" aria-pressed="${circ.tool === g}" translate="no" title="${esc(palTitle(g))}">${g === 'erase' ? esc(en ? 'Erase' : '橡皮') : esc(GLAB[g])}</button>`).join('')
    + `<label class="qa-angle" title="${esc(en ? 'Rotation angle in units of π' : '旋转角，以 π 为单位')}"><span translate="no">θ =</span><input type="number" id="c-angle" value="0.5" min="-2" max="2" step="0.05" inputmode="decimal" aria-label="${esc(en ? 'Rotation angle θ in units of π' : '旋转角 θ（以 π 为单位）')}"><span translate="no">π</span></label>`;
  $('#c-btns').innerHTML = `<label class="qa-sel"><span class="sr">${L('预设', 'Preset')}</span><select id="c-preset" translate="no"><option value="">${esc(en ? 'Load a preset…' : '载入预设线路…')}</option>${Object.keys(presetNames).map((k) => `<option value="${k}">${esc(en ? presetNames[k][1] : presetNames[k][0])}</option>`).join('')}</select></label>
    <button type="button" class="button" id="c-minus" aria-label="${esc(en ? 'Remove a qubit' : '减少一个比特')}">− ${L('比特', 'qubit')}</button><button type="button" class="button" id="c-plus" aria-label="${esc(en ? 'Add a qubit' : '增加一个比特')}">+ ${L('比特', 'qubit')}</button>
    <button type="button" class="button" id="c-sample">${L('测量 1000 次', 'Measure 1000 times')}</button><button type="button" class="button" id="c-clear">${L('清空', 'Clear')}</button>`;
  const phaseIcon = (re, im, c) => { const a = Math.atan2(im, re); return `<svg width="14" height="14" viewBox="-7 -7 14 14" aria-hidden="true"><circle r="6" fill="none" stroke="${c.line}"/><line x1="0" y1="0" x2="${(6 * Math.cos(a)).toFixed(2)}" y2="${(-6 * Math.sin(a)).toFixed(2)}" stroke="${c.accent}" stroke-width="1.8"/></svg>`; };
  // Bloch 球侧视：圆是 x–z 平面（上 |0⟩，下 |1⟩，右 +x），箭头是 (x, z)，小圆点的大小和颜色表示 y 分量
  const blochSvg = (q, [x, y, z], c) => {
    const R = 34, len = Math.hypot(x, y, z);
    return `<figure class="qa-bl"><svg viewBox="-44 -44 88 88" width="88" height="88" role="img" aria-label="${esc(en ? `Qubit ${q}: x ${x.toFixed(2)}, y ${y.toFixed(2)}, z ${z.toFixed(2)}` : `比特 ${q}：x ${x.toFixed(2)}，y ${y.toFixed(2)}，z ${z.toFixed(2)}`)}">
      <circle r="${R}" fill="none" stroke="${c.line}"/><ellipse rx="${R}" ry="${R * 0.28}" fill="none" stroke="${c.line}" stroke-dasharray="3 3"/>
      <text x="0" y="-${R + 3}" text-anchor="middle" font-size="9" fill="${c.muted}">|0⟩</text><text x="0" y="${R + 10}" text-anchor="middle" font-size="9" fill="${c.muted}">|1⟩</text>
      ${len > 1e-6 ? `<line x1="0" y1="0" x2="${(R * x).toFixed(2)}" y2="${(-R * z).toFixed(2)}" stroke="${c.accent}" stroke-width="2.4" stroke-linecap="round"/><circle cx="${(R * x).toFixed(2)}" cy="${(-R * z).toFixed(2)}" r="${(2.5 + 2.5 * Math.abs(y)).toFixed(2)}" fill="${y >= 0 ? c.gold : c.violet}"/>` : `<circle r="2.5" fill="${c.muted}"/>`}
    </svg><figcaption translate="no">q${q} · |r| ${len.toFixed(2)}</figcaption></figure>`;
  };
  const drawCircuit = () => {
    const { n, grid } = circ, g = $('#c-grid');
    g.style.setProperty('--cols', COLS);
    const issues = grid.map(M.columnIssue);
    let html = '';
    for (let q = 0; q < n; q++) {
      const b = (circ.init >> (n - 1 - q)) & 1;
      html += `<div class="qa-q" style="grid-row:${q + 1};grid-column:1"><span translate="no">q${q}</span><button type="button" class="qa-init" data-init="${q}" aria-label="${esc(en ? `Initial state of qubit ${q}: |${b}⟩` : `比特 ${q} 的初态：|${b}⟩`)}" translate="no">|${b}⟩</button></div>`;
      for (let c = 0; c < COLS; c++) {
        const col = grid[c], v = col[q], used = col.map((x, i) => (x ? i : -1)).filter((i) => i >= 0);
        const link = col.some((x) => x === '•' || x === 'x') && used.length > 1;
        const lo = Math.min(...used), hi = Math.max(...used);
        const up = link && q > lo && q <= hi, down = link && q >= lo && q < hi;
        const rot = M.parseGate(v)?.turns !== undefined;
        const inner = !v ? '<span class="qa-g qa-g-empty"></span>' : v === '•' ? '<span class="qa-g qa-g-ctl"></span>' : v === 'x' ? '<span class="qa-g qa-g-swap">×</span>' : v === 'M' ? '<span class="qa-g qa-g-m"><svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 17a8 8 0 0 1 16 0" fill="none" stroke="currentColor" stroke-width="1.8"/><path d="M12 17 17 8" stroke="currentColor" stroke-width="1.8"/></svg></span>' : rot ? `<span class="qa-g qa-g-rot"><b>${esc(M.parseGate(v).name)}</b><small>${esc(turnsLabel(M.parseGate(v).turns))}</small></span>` : `<span class="qa-g">${esc(GLAB[v])}</span>`;
        html += `<button type="button" class="qa-cell${issues[c] ? ' qa-colbad' : ''}${c >= circ.step ? ' qa-after' : ''}" style="grid-row:${q + 1};grid-column:${c + 2}" data-q="${q}" data-c="${c}"${up ? ' data-up' : ''}${down ? ' data-down' : ''} aria-label="${esc(en ? `Qubit ${q}, column ${c + 1}: ${v ? glab(v) : 'empty'}` : `比特 ${q}，第 ${c + 1} 列：${v ? glab(v) : '空'}`)}" translate="no">${inner}</button>`;
      }
      html += `<div class="qa-tail" style="grid-row:${q + 1};grid-column:${COLS + 2}"></div>`;
    }
    g.innerHTML = html;
    const bad = issues.map((x, i) => [x, i]).filter(([x]) => x);
    const why = (x) => (x === 'swap' ? (en ? 'a swap needs exactly two ×' : '交换要正好两个 ×') : x === 'measure' ? (en ? 'put measurements and controls in different columns' : '测量和控制点要放在不同的列') : (en ? 'a control needs a gate to act on' : '控制点要有作用的门'));
    $('#c-issue').innerHTML = bad.length ? C(esc(bad.map(([x, i]) => (en ? `Column ${i + 1}: ${why(x)} (ignored)` : `第 ${i + 1} 列：${why(x)}（这一列被忽略）`)).join(en ? '; ' : '；'))) : '';
    // 模拟到第 step 列之后：中途测量让态变成几个分支（系综），只有一个分支时才有确定的相位
    const ens = M.runGridEnsemble(n, grid, circ.init, circ.step, (i) => !!issues[i]);
    const pure = ens.length === 1, s = ens[0].s;
    const p = M.ensembleProbs(ens), c = css(), N = 1 << n;
    $('#c-step-o').textContent = circ.step >= COLS ? (en ? 'end of circuit' : '整条线路之后') : circ.step === 0 ? (en ? 'initial state' : '初态') : (en ? `after column ${circ.step}` : `第 ${circ.step} 列之后`);
    $('#c-bloch').innerHTML = [...Array(n).keys()].map((q) => blochSvg(q, M.bloch(ens, q), c)).join('');
    const shown = [...Array(N).keys()];
    const counts = circ.samples;
    $('#c-bars').innerHTML = shown.map((k) => `<div class="qa-bar"${p[k] < 1e-12 ? ' data-zero' : ''}><code>|${M.label(n, k)}⟩</code><span class="qa-track"><i style="width:${(p[k] * 100).toFixed(2)}%"></i>${counts ? `<b style="width:${(counts[k] / 10).toFixed(1)}%"></b>` : ''}</span><span class="qa-p">${(p[k] * 100).toFixed(1)}%</span><span class="qa-ph">${pure && p[k] > 1e-12 ? `${phaseIcon(s.re[k], s.im[k], c)}${Math.round(Math.atan2(s.im[k], s.re[k]) / Math.PI * 180)}°` : ''}</span></div>`).join('');
    $('#c-cap').innerHTML = `${L('每个基矢的测量概率；圆里的指针是振幅的相位（0° 向右）。', 'Probability of each basis state; the dial shows the phase of the amplitude (0° points right).')}${pure ? '' : ` ${L(`中途测量把态分成了 ${ens.length} 个分支，概率是各分支的加权和，没有单一的相位。`, `Mid-circuit measurement split the state into ${ens.length} branches; probabilities are their weighted sum and there is no single phase.`)}`}${counts ? ` ${L('金色细条：1000 次模拟测量的频率（整条线路）。', 'Gold strip: frequencies from 1000 simulated measurements (whole circuit).')}` : ''}`;
    const nz = p.filter((v) => v > 1e-12).length, best = p.indexOf(Math.max(...p));
    const gates = grid.reduce((t, col, i) => t + (issues[i] ? 0 : col.filter((x) => x && x !== '•').length - (col.filter((x) => x === 'x').length === 2 ? 1 : 0)), 0);
    // 比特 0 约化态的纯度 Tr ρ² = (1 + |r|²)/2，r 是它的 Bloch 向量
    let purity = null;
    if (n >= 2 || !pure) { const r = M.bloch(ens, 0); purity = (1 + r[0] ** 2 + r[1] ** 2 + r[2] ** 2) / 2; }
    readout($('#c-read'), [
      [['比特数', 'Qubits'], n], [['门数（不计控制点）', 'Gates (controls not counted)'], gates],
      [['非零振幅的基矢', 'Basis states with non-zero amplitude'], `${nz} / ${N}`],
      [['最可能的读数', 'Most likely outcome'], `|${M.label(n, best)}⟩ · ${(p[best] * 100).toFixed(1)}%`, true],
      ...(purity !== null ? [[['比特 0 约化态的纯度 Tr ρ²', 'Purity Tr ρ² of qubit 0'], `${purity.toFixed(3)}${purity < 0.999 ? (pure ? (en ? ' (entangled)' : '（与其余比特纠缠）') : (en ? ' (mixed: entanglement or measurement)' : '（混态：纠缠或测量造成）')) : ''}`]] : []),
      ...(pure ? [] : [[['测量分支数', 'Measurement branches'], ens.length]]),
      [['归一化（总概率）', 'Norm (total probability)'], p.reduce((a, b) => a + b, 0).toFixed(12)],
    ]);
    $('#c-minus').disabled = n <= 1; $('#c-plus').disabled = n >= MAXQ;
    for (const b of document.querySelectorAll('.qa-pal')) b.setAttribute('aria-pressed', String(b.dataset.g === circ.tool));
  };
  $('#c-palette').addEventListener('click', (e) => { const b = e.target.closest('.qa-pal'); if (!b) return; circ.tool = b.dataset.g; drawCircuit(); });
  $('#c-grid').addEventListener('click', (e) => {
    const ini = e.target.closest('[data-init]');
    if (ini) { circ.init ^= 1 << (circ.n - 1 - +ini.dataset.init); circ.samples = null; saveCirc(); drawCircuit(); return; }
    const cell = e.target.closest('.qa-cell'); if (!cell) return;
    const q = +cell.dataset.q, c = +cell.dataset.c, cur = circ.grid[c][q];
    const put = M.ROT.includes(circ.tool) ? M.rotGate(circ.tool, circ.turns) : circ.tool;
    circ.grid[c][q] = circ.tool === 'erase' || cur === put ? '' : put;
    circ.samples = null; saveCirc(); drawCircuit();
    document.querySelector(`.qa-cell[data-q="${q}"][data-c="${c}"]`)?.focus();
  });
  $('#c-preset').addEventListener('change', (e) => { if (!e.target.value) return; loadPreset(e.target.value); e.target.value = ''; saveCirc(); drawCircuit(); });
  $('#c-plus').addEventListener('click', () => { if (circ.n >= MAXQ) return; circ.n++; circ.init <<= 1; circ.grid = circ.grid.map((col) => [...col, '']); circ.samples = null; saveCirc(); drawCircuit(); });
  $('#c-minus').addEventListener('click', () => { if (circ.n <= 1) return; circ.n--; circ.init >>= 1; circ.grid = circ.grid.map((col) => col.slice(0, circ.n)); circ.samples = null; saveCirc(); drawCircuit(); });
  $('#c-clear').addEventListener('click', () => { circ.grid = emptyGrid(circ.n); circ.init = 0; circ.samples = null; saveCirc(); drawCircuit(); });
  $('#c-sample').addEventListener('click', () => {
    const issues = circ.grid.map(M.columnIssue);
    const p = M.ensembleProbs(M.runGridEnsemble(circ.n, circ.grid, circ.init, COLS, (i) => !!issues[i])), counts = new Array(p.length).fill(0);
    for (let i = 0; i < 1000; i++) counts[M.sample(p, Math.random())]++;
    circ.samples = counts; drawCircuit();
  });
  $('#c-angle').addEventListener('input', (e) => { const t = Number(e.target.value); if (Number.isFinite(t) && Math.abs(t) <= 2) { circ.turns = t; if (!M.ROT.includes(circ.tool)) { circ.tool = 'Ry'; drawCircuit(); } } });
  $('#c-step-l').innerHTML = L('看第几列之后的态', 'Show the state after column');
  $('#c-step').max = String(COLS); $('#c-step').value = String(COLS);
  $('#c-step').addEventListener('input', (e) => { circ.step = Math.max(0, Math.min(COLS, Number(e.target.value) || 0)); drawCircuit(); });
  $('#c-bloch-cap').innerHTML = L('每个比特的 Bloch 球（侧视 x–z 平面，点是 y 分量）。箭头缩短说明这个比特单独看是混态：它和别的比特纠缠了，或者被测量过。', 'Bloch sphere of each qubit (side view in the x–z plane; the dot is the y component). A shorter arrow means the qubit on its own is mixed: entangled with others, or measured.');
  $('#c-more').innerHTML = L('这个模拟器是怎么算的', 'How this simulator works');
  $('#c-notes').innerHTML = L('态矢量有 2ⁿ 个复数振幅，每个单比特门只更新成对的振幅（受控门只更新控制比特为 1 的那些对），所以 5 个比特只有 32 个振幅，计算是即时的。每多一个比特，内存翻一倍：这正是经典模拟量子线路的根本困难，大约 50 个比特就超出任何超级计算机的内存。中途测量会把态分成几个分支，每个分支按测量结果的概率加权，所以模拟器带着一小组态矢量往下算；每个比特的 Bloch 向量来自它在各分支上平均的约化密度矩阵。逐列查看和 Bloch 球的做法借鉴开源模拟器 Quirk（Craig Gidney，Apache-2.0），代码是另写的。', 'The statevector has 2ⁿ complex amplitudes; each single-qubit gate updates amplitudes in pairs (a controlled gate only the pairs whose controls are 1), so 5 qubits mean just 32 amplitudes and the calculation is instant. Every extra qubit doubles the memory: that is the basic difficulty of simulating quantum circuits classically, and around 50 qubits exceed the memory of any supercomputer. A mid-circuit measurement splits the state into branches weighted by the outcome probabilities, so the simulator carries a small ensemble of statevectors; a qubit’s Bloch vector comes from its reduced density matrix averaged over the branches. The live per-column view and the Bloch spheres follow the open-source Quirk simulator (Craig Gidney, Apache-2.0); this code is written separately.');
  drawCircuit();

  // ── 演示 2：Grover ────────────────────────────────────────────────────
  demoHead('g', 2, 'Grover 搜索：成功率随迭代次数振荡', 'Grover search: success oscillates with the number of iterations',
    '在 N = 2ⁿ 个元素里有 M 个被标记。每次迭代把态向标记子空间转 2θ（sin θ = √(M/N)），所以成功率是 sin²((2k+1)θ)：先升后降。点“用最佳次数”跳到 k* = ⌊π/4θ⌋。',
    'Among N = 2ⁿ items, M are marked. Each iteration turns the state 2θ toward the marked subspace (sin θ = √(M/N)), so success is sin²((2k+1)θ): it rises, then falls. “Use the best k” jumps to k* = ⌊π/4θ⌋.');
  lab('g-qubits-l', '比特数 n（N = 2ⁿ）', 'Qubits n (N = 2ⁿ)'); lab('g-m-l', '标记项个数 M', 'Marked items M'); lab('g-k-l', '迭代次数 k', 'Iterations k');
  $('#g-best').innerHTML = L('用最佳次数', 'Use the best k');
  const gState = () => {
    const n = +$('#g-qubits').value, N = 2 ** n, mMax = Math.min(16, N - 1), m = Math.min(+$('#g-m').value, mMax);
    $('#g-m').max = mMax; if (+$('#g-m').value > mMax) $('#g-m').value = mMax;
    const best = M.groverBest(N, m), kMax = Math.max(4, Math.min(2000, Math.ceil(best * 2.6) + 2));
    $('#g-k').max = kMax; if (+$('#g-k').value > kMax) $('#g-k').value = kMax;
    return { n, N, m, k: +$('#g-k').value, best, kMax };
  };
  const gDraw = () => {
    const { n, N, m, k, best, kMax } = gState(), c = css();
    $('#g-qubits-v').textContent = `${n} · N = ${fmt(N)}`; $('#g-m-v').textContent = m; $('#g-k-v').textContent = k;
    const step = Math.max(1, Math.ceil(kMax / 400)), ks = []; for (let i = 0; i <= kMax; i += step) ks.push(i);
    plot($('#g-canvas'), { x0: 0, x1: kMax, y0: 0, y1: 1.05, xt: ticks(0, kMax, 6), yt: [0, 0.25, 0.5, 0.75, 1], xf: (t) => t, yf: (t) => t.toFixed(2), xl: en ? 'Grover iterations k' : 'Grover 迭代次数 k', yl: en ? 'success probability' : '成功概率',
      series: [{ xs: ks, ys: ks.map((i) => M.groverP(N, m, i)), color: c.accent, width: 2, label: en ? 'quantum: sin²((2k+1)θ)' : '量子：sin²((2k+1)θ)', dots: kMax <= 60 ? 2.5 : 0 },
        { xs: ks, ys: ks.map((i) => Math.min(1, (i * m) / N)), color: c.muted, dash: [5, 4], width: 1.6, label: en ? 'classical, k random checks (about kM/N)' : '经典随机抽查 k 次（约 kM/N）' }],
      marks: [{ x: best, color: c.gold }], points: [{ x: k, y: M.groverP(N, m, k), color: c.gold, r: 6 }] });
    $('#g-canvas').setAttribute('aria-label', en ? `Success probability against iterations; best k = ${best}` : `成功概率随迭代次数的变化；最佳 k = ${best}`);
    $('#g-cap').innerHTML = L('金色竖线是最佳迭代次数 k*，金点是当前的 k。灰色虚线是经典算法随机抽查 k 个元素时的成功率（N 很大时近似为 kM/N）。', 'The gold line is the best number of iterations k*, the gold dot the current k. The dashed grey line is the success of a classical algorithm checking k random items (about kM/N for large N).');
    // 振幅条：最多画 64 个元素，标记项放在固定位置
    const amp = M.groverAmps(N, m, k), show = Math.min(N, 64), markedAt = new Set(Array.from({ length: Math.min(m, show) }, (_, i) => Math.floor(((i + 0.5) * show) / Math.min(m, show))));
    const { ctx, w, h } = fit($('#g-amp')), top = 14, base = h / 2 + 6, scale = (h / 2 - top) / Math.max(Math.abs(amp.marked), Math.abs(amp.unmarked), 1e-9);
    ctx.strokeStyle = c.line; ctx.beginPath(); ctx.moveTo(10, base); ctx.lineTo(w - 10, base); ctx.stroke();
    const bw = (w - 20) / show;
    for (let i = 0; i < show; i++) { const a = markedAt.has(i) ? amp.marked : amp.unmarked; ctx.fillStyle = markedAt.has(i) ? c.gold : c.accentFill; ctx.fillRect(10 + i * bw + bw * 0.12, a >= 0 ? base - a * scale : base, bw * 0.76, Math.abs(a) * scale); }
    ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'left'; ctx.fillText(en ? `amplitudes${N > 64 ? ` (first 64 of ${fmt(N)} items)` : ''}` : `振幅${N > 64 ? `（只画 ${fmt(N)} 个元素里的 64 个）` : ''}`, 12, 12);
    $('#g-amp').setAttribute('aria-label', en ? `Marked amplitude ${amp.marked.toFixed(3)}, others ${amp.unmarked.toFixed(4)}` : `标记项振幅 ${amp.marked.toFixed(3)}，其余 ${amp.unmarked.toFixed(4)}`);
    $('#g-amp-cap').innerHTML = L('金色是被标记的元素，绿色是其余元素。振幅都是实数：标记项每次迭代长高一点，其余的一起变矮。', 'Gold bars are marked items, green the rest. All amplitudes are real: marked ones grow a little each iteration while the rest shrink together.');
    const pBest = M.groverP(N, m, best), cq = M.classicalQueries(N, m);
    readout($('#g-read'), [
      [['转角 θ', 'Angle θ'], `${(M.groverTheta(N, m) * 180 / Math.PI).toPrecision(3)}°`],
      [['当前成功率', 'Success now'], `${(M.groverP(N, m, k) * 100).toFixed(2)}%`, true],
      [['最佳 k* 与成功率', 'Best k* and its success'], `${fmt(best)} · ${(pBest * 100).toFixed(2)}%`],
      [['经典平均查询次数 (N+1)/(M+1)', 'Classical mean queries (N+1)/(M+1)'], fmt(cq)],
      [['查询次数之比', 'Ratio of queries'], best ? `${fmt(cq / best)}×` : '—'],
    ]);
  };
  bind(['g-qubits', 'g-m', 'g-k'], gDraw);
  $('#g-best').addEventListener('click', () => { const { best } = gState(); $('#g-k').value = best; gDraw(); });

  // ── 演示 3：相位估计 ─────────────────────────────────────────────────
  demoHead('p', 3, '相位估计：读数的分布', 'Phase estimation: the distribution of readouts',
    'U 的本征相位是 φ，用 t 个计数比特。φ 恰好是 t 位二进制小数时读数是确定的；否则概率集中在最近的两个格点，落在最近格点的概率不低于 4/π² ≈ 40.5%。每多一个比特，精度翻倍，U 的调用次数也翻倍。',
    'U has eigenphase φ and we use t counting qubits. If φ is exactly a t-bit fraction the readout is certain; otherwise probability concentrates on the two nearest grid points, with at least 4/π² ≈ 40.5% on the nearest. Each extra qubit doubles both the precision and the number of calls to U.');
  lab('p-phi-l', '本征相位 φ', 'Eigenphase φ'); lab('p-t-l', '计数比特 t', 'Counting qubits t');
  const pDraw = () => {
    const phi = +$('#p-phi').value, t = +$('#p-t').value, T = 2 ** t, c = css();
    $('#p-phi-v').textContent = phi.toFixed(3); $('#p-t-v').textContent = `${t} · ${T}`;
    const dist = M.qpeDist(t, phi), near = M.qpeNearest(t, phi), m = dist.indexOf(Math.max(...dist));
    const nb = (near.m + (phi * T - near.m > 0 ? 1 : T - 1)) % T;
    plot($('#p-canvas'), { x0: -0.5 / T, x1: 1 - 0.5 / T, y0: 0, y1: 1.05, xt: [0, 0.25, 0.5, 0.75], yt: [0, 0.25, 0.5, 0.75, 1], xf: (v) => v.toFixed(2), yf: (v) => v.toFixed(2), xl: en ? 'readout m / 2^t' : '读数 m / 2^t', yl: en ? 'probability' : '概率',
      bars: dist.map((p, i) => ({ x: i / T, y: p, n: T, color: i === near.m ? c.gold : c.accentFill })), marks: [{ x: phi, color: c.ink2 }], legend: [{ label: en ? 'true φ' : '真实的 φ', color: c.ink2, dash: [4, 4] }] });
    $('#p-canvas').setAttribute('aria-label', en ? `Readout distribution for φ = ${phi}, t = ${t}; nearest outcome probability ${(near.p * 100).toFixed(1)}%` : `φ = ${phi}、t = ${t} 时的读数分布；最近格点的概率 ${(near.p * 100).toFixed(1)}%`);
    $('#p-cap').innerHTML = L('柱子是每个读数 m 的概率，金色是离 φ 最近的格点，虚线是真实的 φ。', 'Bars are the probability of each readout m; gold marks the grid point nearest to φ; the dashed line is the true φ.');
    readout($('#p-read'), [
      [['最近的格点 m/2^t', 'Nearest grid point m/2^t'], `${near.m}/${T} = ${(near.m / T).toFixed(4)}`],
      [['落在最近格点的概率', 'Probability of the nearest'], `${(near.p * 100).toFixed(1)}%`, true],
      [['落在相邻两个格点之一', 'On one of the two nearest'], `${((near.p + (nb === near.m ? 0 : dist[nb])) * 100).toFixed(1)}%`],
      [['最可能读数的误差', 'Error of the likeliest readout'], fmt(Math.abs(Math.min(Math.abs(phi - m / T), 1 - Math.abs(phi - m / T))))],
      [['受控 U 的调用次数 2^t − 1', 'Controlled-U calls 2^t − 1'], fmt(T - 1)],
    ]);
  };
  bind(['p-phi', 'p-t'], pDraw);

  // ── 演示 4：Trotter 误差 ──────────────────────────────────────────────
  demoHead('t', 4, 'Trotter 误差：横场 Ising 链', 'Trotter error: a transverse-field Ising chain',
    'H = −J Σ Z_i Z_{i+1} − h Σ X_i（J = 1，开边界），初态 |0…0⟩。把 e^{−iHt} 切成 r 步：一阶公式误差约按 1/r 下降，二阶对称公式按 1/r²。h = 0 时两部分对易，误差为零。',
    'H = −J Σ Z_i Z_{i+1} − h Σ X_i (J = 1, open chain), starting from |0…0⟩. Split e^{−iHt} into r steps: the first-order formula’s error falls roughly as 1/r, the symmetric second-order one as 1/r². At h = 0 the two parts commute and the error vanishes.');
  lab('t-spins-l', '自旋数 n', 'Spins n'); lab('t-h-l', '横场 h', 'Transverse field h'); lab('t-time-l', '演化时间 t', 'Evolution time t'); lab('t-r-l', '步数 r', 'Steps r');
  let tCache = null;
  const R_LIST = [1, 2, 3, 4, 6, 8, 12, 16, 24, 32, 48, 64, 96, 128, 192, 256, 384, 512];
  const tDraw = () => {
    const n = +$('#t-spins').value, h = +$('#t-hx').value, time = +$('#t-time').value, r = +$('#t-r').value, c = css();
    $('#t-spins-v').textContent = `${n} · ${2 ** n}${en ? ' amps' : ' 个振幅'}`; $('#t-hx-v').textContent = h.toFixed(2); $('#t-time-v').textContent = time.toFixed(1); $('#t-r-v').textContent = r;
    const key = `${n}|${h}|${time}`;
    if (!tCache || tCache.key !== key) tCache = { key, curve: M.trotterCurve(n, 1, h, time, R_LIST) };
    const here = M.trotterCurve(n, 1, h, time, [r])[0];
    const floor = 1e-13, cur = tCache.curve, ys = (k) => cur.map((p) => Math.max(p[k], floor));
    const all = [...ys('e1'), ...ys('e2'), here.e1, here.e2].filter((v) => v > floor);
    const ymax = Math.min(2, Math.max(...all, 1e-6)), ymin = Math.max(floor, Math.min(...all, 1));
    const y0 = Math.floor(Math.log10(ymin)), y1 = Math.ceil(Math.log10(ymax)) + 0.1;
    const yt = []; for (let e = y0; e <= Math.floor(y1); e += Math.max(1, Math.ceil((y1 - y0) / 6))) yt.push(10 ** e);
    plot($('#t-canvas'), { logX: true, logY: true, x0: 0, x1: Math.log10(512), y0, y1, xt: [1, 10, 100], yt, xf: (v) => String(v), yf: (v) => `10${sup(Math.round(Math.log10(v)))}`, xl: en ? 'Trotter steps r (log scale)' : 'Trotter 步数 r（对数坐标）', yl: en ? 'state error ‖ψ_exact − ψ_Trotter‖' : '态误差 ‖ψ精确 − ψTrotter‖',
      series: [{ xs: R_LIST, ys: ys('e1'), color: c.warn, width: 2, dots: 2.5, label: en ? '1st order' : '一阶' }, { xs: R_LIST, ys: ys('e2'), color: c.accent, width: 2, dots: 2.5, label: en ? '2nd order' : '二阶' }],
      marks: [{ x: r, color: c.gold }], points: [{ x: r, y: Math.max(here.e1, floor), color: c.warn }, { x: r, y: Math.max(here.e2, floor), color: c.accent }] });
    $('#t-canvas').setAttribute('aria-label', en ? `Trotter error against steps; at r = ${r}: first order ${here.e1.toExponential(2)}, second order ${here.e2.toExponential(2)}` : `Trotter 误差随步数的变化；r = ${r} 时一阶 ${here.e1.toExponential(2)}，二阶 ${here.e2.toExponential(2)}`);
    $('#t-cap').innerHTML = L('双对数坐标：直线的斜率就是误差的阶。一阶斜率 −1，二阶斜率 −2；r 很小时误差饱和在 2 附近（态已经完全不对了）。', 'Log–log axes: the slope is the order of the error. First order slopes at −1, second order at −2; for very small r the error saturates near 2 (the state is completely wrong).');
    // 达到 10⁻³ 需要的步数：在曲线上找第一个满足的点，再按幂律细化
    const need = (k, p) => { if (h === 0) return 1; const i = cur.findIndex((q) => q[k] < 1e-3); if (i < 0) { const last = cur.at(-1); return Math.ceil(last.r * (last[k] / 1e-3) ** (1 / p)); } if (i === 0) return 1; const a = cur[i - 1]; return Math.ceil(a.r * (a[k] / 1e-3) ** (1 / p)); };
    const n1 = need('e1', 1), n2 = need('e2', 2);
    readout($('#t-read'), [
      [['一阶误差', '1st-order error'], fmt(here.e1)], [['二阶误差', '2nd-order error'], fmt(here.e2), true],
      [['误差 < 10⁻³ 约需步数（一阶 / 二阶）', 'Steps for error < 10⁻³ (1st / 2nd)'], `${fmt(n1)} / ${fmt(n2)}`],
      [['对应的旋转门数（一阶 / 二阶）', 'Rotation gates (1st / 2nd)'], `${fmt(M.trotterGates(n, n1, 1))} / ${fmt(M.trotterGates(n, n2, 2))}`],
    ]);
  };
  bind(['t-spins', 't-hx', 't-time', 't-r'], tDraw);

  // ── 演示 5：VQE ───────────────────────────────────────────────────────
  demoHead('v', 5, '两比特 VQE：参数平移与测量噪声', 'Two-qubit VQE: parameter shifts and shot noise',
    '一个玩具模型（不是分子）：H = −Z₀Z₁ − h(X₀ + X₁)。拟设是 Ry ⊗ Ry → CNOT → Ry ⊗ Ry，共 4 个参数。每一步用参数平移法则（每个参数测两次能量）求梯度，做梯度下降。选有限的测量次数，就能看到统计噪声怎样让能量在精确值附近抖动。',
    'A toy model (not a molecule): H = −Z₀Z₁ − h(X₀ + X₁). The ansatz is Ry ⊗ Ry → CNOT → Ry ⊗ Ry with 4 parameters. Each step gets the gradient by the parameter-shift rule (two energy evaluations per parameter) and takes a gradient-descent step. Choose a finite number of shots to see statistical noise make the energy jitter around the exact value.');
  lab('v-h-l', '横场 h', 'Transverse field h'); lab('v-lr-l', '学习率', 'Learning rate'); lab('v-shots-l', '每项的测量次数', 'Shots per term');
  $('#v-shots').options[0].textContent = en ? 'Exact (no shot noise)' : '精确期望值（无测量噪声）';
  $('#v-run').innerHTML = L('重新优化', 'Optimise again'); $('#v-seed').innerHTML = L('换一个随机起点', 'New random start');
  let vSeed = 7, vStart = [0.4, -0.3, 0.2, 0.1];
  const vDraw = () => {
    const h = +$('#v-hx').value, lr = +$('#v-lr').value, shots = +$('#v-shots').value, c = css();
    $('#v-hx-v').textContent = h.toFixed(2); $('#v-lr-v').textContent = lr.toFixed(2);
    const res = M.vqeRun({ h, lr, shots, seed: vSeed, steps: 80, start: vStart });
    const es = res.trace.map((p) => p.e), lo = Math.min(res.exact, ...es), hi = Math.max(...es, -1 + 0.05);
    const pad = (hi - lo) * 0.08 || 0.1;
    plot($('#v-canvas'), { x0: 0, x1: 80, y0: lo - pad, y1: hi + pad, xt: ticks(0, 80, 8), yt: ticks(lo - pad, hi + pad, 5), xf: (v) => v, yf: (v) => v.toFixed(2), xl: en ? 'optimisation step' : '优化步数', yl: en ? 'energy E(θ)' : '能量 E(θ)',
      series: [{ xs: res.trace.map((p) => p.k), ys: es, color: c.accent, width: 2, label: en ? 'VQE energy (exact evaluation of the current θ)' : 'VQE 能量（对当前 θ 精确计算）' }],
      hmarks: [{ y: res.exact, color: c.gold, label: en ? `exact ground state ${res.exact.toFixed(4)}` : `精确基态 ${res.exact.toFixed(4)}` }, { y: -1, color: c.muted, label: en ? 'product state −1 (h → 0 limit)' : '直积态 −1（h → 0 时）' }] });
    $('#v-canvas').setAttribute('aria-label', en ? `VQE energy over 80 steps, final ${es.at(-1).toFixed(4)}, exact ${res.exact.toFixed(4)}` : `80 步 VQE 能量，最后 ${es.at(-1).toFixed(4)}，精确值 ${res.exact.toFixed(4)}`);
    $('#v-cap').innerHTML = L('曲线画的是每一步参数下的精确能量，所以它永远不会低于金色的精确基态（变分原理）；有测量噪声时，是梯度带噪声，路径就会抖。', 'The curve shows the exact energy at each step’s parameters, so it never drops below the gold ground-state line (the variational principle); with shot noise it is the gradient that is noisy, so the path jitters.');
    readout($('#v-read'), [
      [['最后的能量', 'Final energy'], es.at(-1).toFixed(5), true], [['精确基态 −√(1+4h²)', 'Exact ground state −√(1+4h²)'], res.exact.toFixed(5)],
      [['误差', 'Error'], fmt(es.at(-1) - res.exact)],
      shots ? [['线路运行次数', 'Circuit executions'], fmt(res.evals)] : [['能量计算次数', 'Energy evaluations'], fmt(res.evals)],
      [['最后的参数 θ', 'Final parameters θ'], res.theta.map((v) => v.toFixed(2)).join(', ')],
    ]);
  };
  bind(['v-hx', 'v-lr'], vDraw);
  $('#v-shots').addEventListener('change', vDraw);
  $('#v-run').addEventListener('click', () => { vSeed++; vDraw(); });
  $('#v-seed').addEventListener('click', () => { const rnd = M.rng(Date.now() % 1e9); vStart = [0, 0, 0, 0].map(() => (rnd() - 0.5) * 2 * Math.PI); vSeed++; vDraw(); });

  // ── 算法详解 ──────────────────────────────────────────────────────────
  $('#qa-algos-h').innerHTML = L(`${D.algos.length} 个算法详解`, `The ${D.algos.length} algorithms in detail`);
  $('#qa-side').innerHTML = D.tiers.map((t) => `<div class="fm-side-g" data-tier="${t.id}"><p>${R(t.name)} · ${R(t.tag)}</p>${D.algos.filter((a) => a.tier === t.id).map((a) => `<button type="button" class="fm-side-b" data-sub="${a.id}" aria-controls="a-${a.id}"><span class="fm-glyph" aria-hidden="true">${esc(a.glyph.length > 3 ? a.glyph.slice(0, 3) : a.glyph)}</span>${R(a.name)}<span class="fm-side-p" data-p="${a.id}"></span></button>`).join('')}</div>`).join('');
  const refCard = (r) => {
    const links = [r.doi ? `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener noreferrer" translate="no">DOI ${esc(r.doi)} ${ext}</a>` : '', r.arxiv ? `<a href="https://arxiv.org/abs/${esc(r.arxiv)}" target="_blank" rel="noopener noreferrer" translate="no">arXiv:${esc(r.arxiv)} ${ext}</a>` : '', r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${L('网站', 'Website')} ${ext}</a>` : ''].filter(Boolean).join('');
    return `<li class="fm-book fs-ref" id="ref-${r.id}" data-role="${r.kind === 'paper' ? 'paper' : r.kind === 'book' ? 'main' : 'chem'}">
      <div class="fm-tags"><span class="fm-tag">${R(D.kinds[r.kind])}</span>${r.free ? `<span class="fm-tag fm-free">${L('合法免费', 'Free & legal')}</span>` : ''}</div>
      <p class="fm-cite" translate="no" lang="en"><b class="fm-title">${esc(r.title)}</b><br><span class="fm-au">${esc(r.authors)}</span> · ${esc(r.venue)}${r.vol ? ` ${esc(r.vol)}` : ''}${r.pages ? `, ${esc(r.pages)}` : ''} · ${r.year}</p>
      ${R(r.note, 'p', 'fm-note')}${links ? `<p class="fm-links">${links}</p>` : ''}</li>`;
  };
  const plat = { yt: 'YouTube', bili: en ? 'Bilibili' : '哔哩哔哩' };
  const vidUrl = (v) => (v.p === 'bili' ? `https://www.bilibili.com/video/${v.id}/` : v.k === 'playlist' ? `https://www.youtube.com/playlist?list=${v.id}` : `https://www.youtube.com/watch?v=${v.id}`);
  const VBY = Object.fromEntries(VID.map((v) => [v.id, v]));
  const videos = D.videos.map(([id, algos]) => VBY[id] && { v: VBY[id], algos }).filter(Boolean);
  const levels = { intro: ['入门', 'Intro'], intermediate: ['进阶', 'Intermediate'], advanced: ['深入', 'Advanced'] };
  const videoCard = ({ v }) => `<li class="fm-video" data-p="${v.p}">
      <div class="fm-tags"><span class="fm-tag fm-plat" data-p="${v.p}" translate="no">${esc(plat[v.p])}</span><span class="fm-tag">${L(...levels[v.level] || ['', ''])}</span><span class="fm-tag">${v.lang === 'zh' ? L('中文', 'Chinese') : L('英文', 'English')}</span>${v.parts ? `<span class="fm-tag">${L(`共 ${v.parts} 集`, `${v.parts} parts`)}</span>` : v.duration ? `<span class="fm-tag" translate="no">${esc(v.duration)}</span>` : ''}</div>
      <p class="fm-cite"><a class="fm-title" href="${esc(vidUrl(v))}" target="_blank" rel="noopener noreferrer" translate="no" lang="${v.lang === 'zh' ? 'zh-CN' : 'en'}">${esc(v.title)} ${ext}</a><br><span class="fm-au" translate="no">${esc(v.channel)}</span> · <a href="../../videos/index.html#v-${esc(v.id)}">${L('在本站教学视频里看', 'Watch in the site’s video library')}</a></p>
      ${R(v.note, 'p', 'fm-note')}</li>`;
  const rels = (id, side) => D.relations.filter((r) => (side === 'in' ? r[1] === id : r[0] === id));
  const demoLink = (a) => {
    if (!a.demo) return '';
    if (a.demo.id === 'shor') return `<h4>${L('动手：Shor 的经典部分', 'Try it: the classical part of Shor')}</h4><div class="qa-shor" data-shor><div class="qa-shor-row"><label>N<input type="number" min="15" max="99999" value="21" data-shor-n></label><label>a<input type="number" min="2" max="99998" value="2" data-shor-a></label><button type="button" class="button primary" data-shor-go>${L('求阶并分解', 'Find the order and factor')}</button></div><ol data-shor-out></ol><p class="muted">${L('阶 r 在这里是经典地逐个试出来的（时间随 N 指数增长）；量子计算机做的正是这一步，用相位估计在多项式时间内找到 r。', 'Here the order r is found classically by trial (time exponential in the bits of N); this is exactly the step a quantum computer does in polynomial time with phase estimation.')}</p></div>`;
    const label = { circuit: ['在模拟器里打开这条线路', 'Open this circuit in the simulator'], grover: ['打开演示 2：Grover', 'Open demo 2: Grover'], qpe: ['打开演示 3：相位估计', 'Open demo 3: phase estimation'], trotter: ['打开演示 4：Trotter 误差', 'Open demo 4: Trotter error'], vqe: ['打开演示 5：VQE', 'Open demo 5: VQE'] }[a.demo.id];
    return `<p class="qa-demo-go"><a class="button primary" href="#demo-${a.demo.id}" data-demo="${a.demo.id}"${a.demo.preset ? ` data-preset="${a.demo.preset}"` : ''}>${L(...label)} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p>`;
  };
  $('#qa-panels').innerHTML = D.algos.map((a, i) => `<article class="fm-panel" id="a-${a.id}" data-tier="${a.tier}" tabindex="-1"${i ? ' hidden' : ''}>
      <header class="fm-sub-h"><span class="fm-big-glyph" aria-hidden="true">${esc(a.glyph.length > 3 ? a.glyph.slice(0, 3) : a.glyph)}</span><div>
        <p class="fm-panel-k" data-tier="${a.tier}">${R(tierOf(a.id).name)} · ${R(tierOf(a.id).tag)} · <span translate="no">${esc(a.year)}</span></p>
        <h3>${R(a.name)}</h3>${R(a.tagline, 'p', 'fm-tagline')}<p>${ev(a.evidence)}</p></div></header>
      <div class="fm-cols"><div class="fm-col-main">
        <h4>${L('讲解', 'Explanation')}</h4><div class="fs-prose">${a.explain.map((p) => R(p, 'p')).join('')}</div>
        <h4>${L('关键公式', 'Key formulas')}</h4>${a.formulas.map(formula).join('')}
        <h4>${L('和化学的关系', 'Where chemistry comes in')}</h4><ul class="fm-bul">${a.inChem.map((t) => R(t, 'li')).join('')}</ul>
        ${a.practice ? `<h4>${L('动手练习', 'Hands-on exercise')}</h4><div class="fm-practice"><p class="fm-practice-t">${R(a.practice.title)}</p>${R(a.practice.body, 'p')}<div class="fm-code"><button type="button" class="button fm-copy" data-copy="${a.id}">${L('复制代码', 'Copy code')}</button><pre translate="no"><code>${esc(a.practice.code)}</code></pre></div></div>` : ''}
        ${demoLink(a)}
        <h4>${L('常见误区', 'Common pitfalls')}</h4><ul class="fm-bul fm-pit">${a.pitfalls.map((t) => R(t, 'li')).join('')}</ul>
      </div><aside class="fm-col-side">
        <h4>${L('账本', 'Ledger')}</h4><dl class="qa-facts"><dt>${L('问题', 'Problem')}</dt><dd>${R(a.problem)}</dd><dt>${L('量子代价', 'Quantum cost')}</dt><dd class="qa-mono">${R(a.qcost)}</dd><dt>${L('已知最好的经典方法', 'Best known classical')}</dt><dd class="qa-mono">${R(a.ccost)}</dd><dt>${L('加速与前提', 'Speedup and caveats')}</dt><dd>${R(a.speedup)}</dd></dl>
        ${rels(a.id, 'in').length ? `<h4>${L('用到', 'Uses')}</h4><div class="fm-chips">${rels(a.id, 'in').map((r) => chip(r[0])).join('')}</div>` : ''}
        ${rels(a.id, 'out').length ? `<h4>${L('被用于', 'Used by')}</h4><div class="fm-chips">${rels(a.id, 'out').map((r) => chip(r[1])).join('')}</div>` : ''}
        <h4>${L('过关自测', 'Self-check')}</h4><ul class="fm-checks">${a.checks.map((t, k) => `<li><label><input type="checkbox" data-check="${a.id}:${k}"${progress.has(`${a.id}:${k}`) ? ' checked' : ''}>${R(t)}</label></li>`).join('')}</ul>
      </aside></div>
      <div class="fm-res"><div><h4>${L('文献', 'Papers')}</h4>${cite(a.refs)}</div>
        ${videos.some((x) => x.algos.includes(a.id)) ? `<div><h4>${L('视频', 'Videos')}</h4><ul class="fm-cards">${videos.filter((x) => x.algos.includes(a.id)).slice(0, 3).map(videoCard).join('')}</ul></div>` : ''}</div>
    </article>`).join('');
  const side = $('#qa-side');
  const selectAlgo = (id, { scroll = false } = {}) => {
    if (!A[id]) return false;
    for (const p of document.querySelectorAll('#qa-panels .fm-panel')) p.hidden = p.id !== `a-${id}`;
    for (const b of side.querySelectorAll('.fm-side-b')) b.setAttribute('aria-current', String(b.dataset.sub === id));
    if (scroll) $('#qa-algos').scrollIntoView({ behavior: smooth(), block: 'start' });
    return true;
  };
  side.addEventListener('click', (e) => { const b = e.target.closest('.fm-side-b'); if (!b) return; selectAlgo(b.dataset.sub); history.replaceState(null, '', `#a-${b.dataset.sub}`); });
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-open]');
    if (a) { e.preventDefault(); selectAlgo(a.dataset.open, { scroll: true }); history.replaceState(null, '', `#a-${a.dataset.open}`); return; }
    const d = e.target.closest('a[data-demo]');
    if (d) { e.preventDefault(); if (d.dataset.preset) { loadPreset(d.dataset.preset); saveCirc(); drawCircuit(); } $(`#demo-${d.dataset.demo}`).scrollIntoView({ behavior: smooth(), block: 'start' }); return; }
    const r = e.target.closest('a[data-ref]');
    if (r) { e.preventDefault(); showRef(r.dataset.ref); return; }
  });
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('.fm-copy'); if (!b) return;
    try { await navigator.clipboard.writeText(A[b.dataset.copy].practice.code); b.innerHTML = L('已复制', 'Copied'); } catch { b.innerHTML = L('请手动选中复制', 'Select and copy by hand'); }
    setTimeout(() => { b.innerHTML = L('复制代码', 'Copy code'); }, 1600);
  });
  // Shor 的经典部分
  const shorRun = (box) => {
    const N = Math.round(+box.querySelector('[data-shor-n]').value), a = Math.round(+box.querySelector('[data-shor-a]').value), out = box.querySelector('[data-shor-out]');
    const li = (h) => `<li>${C(h)}</li>`;
    if (!(N >= 15 && N <= 99999) || !(a >= 2 && a < N)) { out.innerHTML = li(esc(en ? 'Choose 15 ≤ N ≤ 99999 and 2 ≤ a < N.' : '请取 15 ≤ N ≤ 99999、2 ≤ a < N。')); return; }
    if (N % 2 === 0) { out.innerHTML = li(`${esc(en ? 'N is even: 2 is a factor, no quantum computer needed.' : 'N 是偶数：2 就是因子，用不到量子计算机。')}`); return; }
    for (let b = 2; b <= Math.log2(N); b++) { const root = Math.round(N ** (1 / b)); if (root ** b === N) { out.innerHTML = li(esc(en ? `N = ${root}^${b} is a perfect power; classical root-taking finds it.` : `N = ${root}^${b} 是完全幂，经典地开方就能分解。`)); return; } }
    const r = M.shorClassical(N, a), steps = [];
    if (r.lucky) { steps.push(`gcd(${a}, ${N}) = <b>${r.lucky}</b>`); steps.push(`<span class="qa-ok">${esc(en ? 'Lucky: a already shares a factor with N.' : '运气好：a 本身就和 N 有公因子。')}</span> ${N} = ${r.factors[0]} × ${r.factors[1]}`); }
    else {
      steps.push(`gcd(${a}, ${N}) = 1`);
      steps.push(`${esc(en ? 'order' : '阶')} r = <b>${r.r}</b>${en ? '' : ''}：${a}<sup>${r.r}</sup> ≡ 1 (mod ${N})`);
      if (r.fail === 'odd') steps.push(`<span class="qa-no">${esc(en ? 'r is odd: pick another a.' : 'r 是奇数：换一个 a 再试。')}</span>`);
      else if (r.fail === 'minus1') steps.push(`${a}<sup>${r.r / 2}</sup> ≡ −1 (mod ${N}) · <span class="qa-no">${esc(en ? 'gives only trivial factors: pick another a.' : '只能得到平凡因子：换一个 a 再试。')}</span>`);
      else { steps.push(`${a}<sup>${r.r / 2}</sup> mod ${N} = <b>${r.h}</b>`); steps.push(`gcd(${r.h} − 1, ${N}) = ${M.gcd(r.h - 1, N)}, gcd(${r.h} + 1, ${N}) = ${M.gcd(r.h + 1, N)}`); steps.push(r.factors ? `<span class="qa-ok">${N} = ${r.factors[0]} × ${N / r.factors[0]}</span>` : `<span class="qa-no">${esc(en ? 'no non-trivial factor: pick another a.' : '没有得到非平凡因子：换一个 a。')}</span>`); }
    }
    out.innerHTML = steps.map(li).join('');
  };
  document.addEventListener('click', (e) => { const b = e.target.closest('[data-shor-go]'); if (b) shorRun(b.closest('[data-shor]')); });
  for (const box of document.querySelectorAll('[data-shor]')) shorRun(box);

  // ── 资源估算 ──────────────────────────────────────────────────────────
  $('#qa-resources-h').innerHTML = L('化学资源估算：要多少比特、多少天', 'Chemistry resource estimates: how many qubits, how many days');
  $('#qa-resources-note').innerHTML = L('表里的数字都摘自原文摘要或结论。“物理比特、天数”取决于硬件假设（错误率、表面码周期），逻辑比特怎样换算成物理比特见量子计算机展馆的纠错部分。最后两行是 RSA，作为同一套估算方法的参照。', 'Every number here is taken from the paper’s abstract or conclusions. Physical qubits and days depend on hardware assumptions (error rate, surface-code cycle); for how logical qubits translate into physical ones, see the error-correction part of the Quantum Computers pavilion. The last two rows are RSA, as a reference for the same estimation methods.')
    + ` <a href="../computing/index.html#qc-qec">${L('量子计算机 · 纠错', 'Quantum Computers · error correction')}</a>`;
  $('#qa-est-table').innerHTML = `<thead><tr>${[['体系', 'System'], ['方法', 'Method'], ['结果', 'Result'], ['硬件假设', 'Hardware assumptions'], ['文献', 'Paper']].map(([z, e]) => `<th scope="col">${L(z, e)}</th>`).join('')}</tr></thead>
    <tbody>${D.estimates.map((x) => `<tr><td>${R(x.target)}</td><td>${R(x.method)}</td><td>${R(x.result)}</td><td>${R(x.assume)}</td><td>${cite(x.refs)}</td></tr>`).join('')}</tbody>`;

  // ── 学习路线 ──────────────────────────────────────────────────────────
  $('#qa-path-h').innerHTML = L('两条学习路线', 'Two study tracks');
  $('#qa-path-note').innerHTML = L('周数按每周 6–8 小时估计。数学前置（线性代数、张量积、概率）见数学基础与探索子栏目。', 'Weeks assume 6–8 hours a week. For the mathematical prerequisites (linear algebra, tensor products, probability) see the Mathematical Foundations module.')
    + ` <a href="../../fundamental-science/math/index.html#m-la">${L('数学基础 · 线性代数', 'Mathematics · linear algebra')}</a>`;
  let track = store.get('molastria-qa-track', 'chem');
  if (!D.tracks.some((t) => t.id === track)) track = 'chem';
  const tabs = $('#qa-track-tabs');
  const drawTrack = () => {
    tabs.innerHTML = D.tracks.map((t) => `<button type="button" role="tab" class="fm-track-tab" data-track="${t.id}" aria-selected="${t.id === track}">${R(t.name)}</button>`).join('');
    const t = D.tracks.find((x) => x.id === track);
    let start = 0;
    const span = (w) => { const [a, b] = String(w).split('–').map(Number); return b ? (a + b) / 2 : a; };
    const total = t.phases.reduce((n, p) => n + span(p.weeks), 0);
    $('#qa-track').innerHTML = `<p class="fm-track-desc">${R(t.desc)}</p><div class="fm-bar" aria-hidden="true">${t.phases.map((p, i) => { const w = span(p.weeks) / total * 100; const el = `<span style="left:${start / total * 100}%;width:${w}%" data-k="${i % 2}">${esc(tx(p.name))}</span>`; start += span(p.weeks); return el; }).join('')}</div>
      <ol class="fm-phases">${t.phases.map((p) => `<li><div class="fm-phase-h"><b translate="no" lang="${lang}">${esc(tx(p.name))}</b><span class="fm-weeks">${L(`${p.weeks} 周`, `${p.weeks} weeks`)}</span></div><div class="fm-chips">${p.algos.map(chip).join('')}</div>${R(p.goal, 'p')}</li>`).join('')}</ol>`;
  };
  tabs.addEventListener('click', (e) => { const b = e.target.closest('[data-track]'); if (!b) return; track = b.dataset.track; store.set('molastria-qa-track', track); drawTrack(); drawStart(); });
  drawTrack();

  // ── 从哪里开始 ────────────────────────────────────────────────────────
  $('#qa-start-h').innerHTML = L('从哪里开始', 'Where to start');
  $('#qa-start-note').innerHTML = L('在每个算法的“过关自测”里勾选你已经能做到的事，这里会按你选的路线建议下一步。勾选只保存在这台设备的浏览器里。', 'Tick what you can already do in each algorithm’s self-check; this box then suggests your next step on the chosen track. Ticks are stored only in this browser.');
  const pct = (id) => { const n = A[id].checks.length; let k = 0; for (let i = 0; i < n; i++) if (progress.has(`${id}:${i}`)) k++; return k / n; };
  const drawStart = () => {
    const t = D.tracks.find((x) => x.id === track);
    const order = [...new Set(t.phases.flatMap((p) => p.algos))];
    const next = order.find((id) => pct(id) < 0.67);
    $('#qa-start-box').innerHTML = `<div class="fm-next">${next
      ? `<p class="fm-panel-k">${R(t.name)}</p><h3>${L('建议下一步', 'Suggested next step')}：${R(A[next].name)}</h3>${R(A[next].tagline, 'p')}<p><a class="button primary" href="#a-${next}" data-open="${next}">${L('打开这个算法', 'Open this algorithm')} <i class="ico-ext ico-down" aria-hidden="true"></i></a> <button type="button" class="button" id="qa-reset">${L('清除全部勾选', 'Clear all ticks')}</button></p>`
      : `<h3>${L('这条路线上的自测都已过关', 'Every self-check on this track is done')}</h3><p>${L('可以开始读 Dalzell 等的综述和资源估算论文，或者换另一条路线。', 'Move on to the Dalzell et al. survey and the resource-estimate papers, or switch tracks.')}</p><p><button type="button" class="button" id="qa-reset">${L('清除全部勾选', 'Clear all ticks')}</button></p>`}</div>
      <ul class="fm-meters">${order.map((id) => `<li data-tier="${A[id].tier}"><a href="#a-${id}" data-open="${id}" translate="no" lang="${lang}">${esc(sn(id))}</a><span class="fm-meter" data-tier="${A[id].tier}"><i style="width:${Math.round(pct(id) * 100)}%"></i></span><span class="fm-meter-n" translate="no">${Math.round(pct(id) * A[id].checks.length)}/${A[id].checks.length}</span></li>`).join('')}</ul>`;
    for (const el of document.querySelectorAll('#qa-side .fm-side-p')) { const p = pct(el.dataset.p); el.style.setProperty('--p', p); el.title = `${Math.round(p * 100)}%`; }
  };
  document.addEventListener('change', (e) => {
    const c = e.target.closest('input[data-check]'); if (!c) return;
    if (c.checked) progress.add(c.dataset.check); else progress.delete(c.dataset.check);
    saveProgress(); drawStart();
  });
  document.addEventListener('click', (e) => {
    if (!e.target.closest('#qa-reset')) return;
    progress.clear(); saveProgress();
    for (const c of document.querySelectorAll('input[data-check]')) c.checked = false;
    drawStart();
  });
  drawStart();

  // ── 文献与视频 ────────────────────────────────────────────────────────
  $('#qa-library-h').innerHTML = L('文献与视频', 'Papers & videos');
  $('#qa-lib-note').innerHTML = L(`全部 ${D.refs.length} 篇文献与讲义、${videos.length} 个视频课程，${D.checked} 核对：有 DOI 的条目在 OpenAlex（Crossref 的数据）上核对了题名、第一作者、年份和卷号，arXiv 条目在 arXiv 接口上核对；“合法免费”指开放获取或作者放在 arXiv 上的版本。视频来自本站教学视频栏目，那里已逐条核对标题和频道。`, `All ${D.refs.length} papers and notes and ${videos.length} video courses, checked on ${D.checked}: entries with a DOI were checked on OpenAlex (Crossref’s data) for title, first author, year and volume; arXiv entries against the arXiv API. “Free & legal” means open access or the authors’ arXiv version. Videos come from the site’s video library, where titles and channels were checked one by one.`)
    + ` <a href="../../videos/index.html#t-quantum">${L('教学视频 · 量子计算与量子化学', 'Teaching videos · quantum computing for chemistry')}</a>`;
  $('#qa-lib-filters').innerHTML = `<label>${L('算法', 'Algorithm')}<select id="qa-f-algo"><option value="">${esc(en ? 'All algorithms' : '全部算法')}</option>${D.algos.map((a) => `<option value="${a.id}">${esc(tx(a.name))}</option>`).join('')}</select></label>
    <label>${L('类型', 'Type')}<select id="qa-f-kind"><option value="">${esc(en ? 'All types' : '全部类型')}</option>${Object.keys(D.kinds).map((k) => `<option value="${k}">${esc(tx(D.kinds[k]))}</option>`).join('')}<option value="video">${esc(en ? 'Videos' : '视频')}</option></select></label>
    <label class="fm-f-check"><input type="checkbox" id="qa-f-free">${L('只看可免费阅读 / 观看', 'Free to read or watch only')}</label>`;
  for (const el of document.querySelectorAll('#qa-lib-filters select')) el.setAttribute('translate', 'no');
  const drawLib = () => {
    const al = $('#qa-f-algo').value, kind = $('#qa-f-kind').value, free = $('#qa-f-free').checked;
    const refs = kind === 'video' ? [] : D.refs.filter((r) => (!al || r.algos.includes(al)) && (!kind || r.kind === kind) && (!free || r.free));
    const vids = kind && kind !== 'video' ? [] : videos.filter((x) => !al || x.algos.includes(al));
    $('#qa-lib-count').innerHTML = L(`共 ${refs.length} 篇文献与讲义、${vids.length} 个视频`, `${refs.length} papers & notes, ${vids.length} videos`);
    const groups = Object.keys(D.kinds).map((k) => [k, refs.filter((r) => r.kind === k)]).filter(([, l]) => l.length);
    $('#qa-lib').innerHTML = groups.map(([k, l]) => `<div class="fm-lib-g"><h3>${R(D.kinds[k])}</h3><ul class="fm-cards">${l.map(refCard).join('')}</ul></div>`).join('')
      + (vids.length ? `<div class="fm-lib-g"><h3>${L('视频与课程', 'Videos & courses')}</h3><ul class="fm-cards">${vids.map(videoCard).join('')}</ul></div>` : '');
  };
  $('#qa-lib-filters').addEventListener('change', drawLib);
  drawLib();
  const showRef = (id) => {
    if (!document.getElementById(`ref-${id}`)) { $('#qa-f-algo').value = ''; $('#qa-f-kind').value = ''; $('#qa-f-free').checked = false; drawLib(); }
    const el = document.getElementById(`ref-${id}`); if (!el) return;
    el.scrollIntoView({ behavior: smooth(), block: 'center' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800);
    history.replaceState(null, '', `#ref-${id}`);
  };

  $('#qa-foot').innerHTML = `<strong>${L('MolAstria · 量子算法', 'MolAstria · Quantum Algorithms')}</strong>
    <p>${L('讲解、练习和演示由 MolAstria 编写，演示数值是本站代码的精确模拟，不是真机结果；文献只收录核对过、真实存在的条目，不代表作者认可本站。', 'Explanations, exercises and demos are written by MolAstria; demo numbers are exact simulations by this site’s code, not hardware results. The library lists only entries we checked and that exist, and implies no endorsement by their authors.')}</p>
    <p><a href="../index.html">${L('返回量子嘉年华', 'Back to the Quantum Carnival')}</a> · <a href="../physics/index.html">${L('量子物理', 'Quantum Physics')}</a> · <a href="../computing/index.html">${L('量子计算机', 'Quantum Computers')}</a> · <a href="../biology/index.html">${L('量子生物学', 'Quantum Biology')}</a> · <a href="../../fundamental-science/math/index.html">${L('数学基础与探索', 'Mathematical Foundations')}</a> · <a href="../../qchem/index.html#lab">${L('浏览器里的量子化学计算器', 'Quantum chemistry calculator in the browser')}</a> · <a href="#qa-h1">${L('回到顶部', 'Back to top')} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p>`;

  // ── 重画与地址 ────────────────────────────────────────────────────────
  const drawAll = () => { gDraw(); pDraw(); tDraw(); vDraw(); };
  drawAll();
  let pending = 0;
  const later = () => { cancelAnimationFrame(pending); pending = requestAnimationFrame(drawAll); };
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(later); for (const id of ['g-canvas', 'p-canvas', 't-canvas', 'v-canvas']) ro.observe($(`#${id}`)); }
  new MutationObserver(later).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', later);
  const fromHash = () => {
    const h = location.hash.slice(1);
    if (h.startsWith('a-') && selectAlgo(h.slice(2))) setTimeout(() => $('#qa-algos').scrollIntoView({ block: 'start' }), 60);
    else if (h.startsWith('ref-')) setTimeout(() => showRef(h.slice(4)), 60);
  };
  window.addEventListener('hashchange', fromHash);
  selectAlgo(D.algos[0].id);
  fromHash();
})();
