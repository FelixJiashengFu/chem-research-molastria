'use strict';
// 化学学科馆 · 展馆页：把 <id>/data.js（讲解、公式、例题、时间线、自测、教材、文献）画成页面，并驱动 <id>/demos.js 里的演示。
// 写法照前沿 AI 数学（ai-math/aim.js）：一次读一章，演示嵌在章里；演示的数学在 ../chem-models.js。
// 文字全部自带中英两版（[中文, 英文]，按 <html lang> 取），每个 section 标 translate="no"，不走 i18n.js 的词典（页脚照常翻译）。
// 正文里的 [@id] 连到文献，[[地址|文字]] 连到站内别的栏目（地址相对网站根目录），{{ch:id}} 连到本馆的一章。
// 地址：#c-<章> 打开一章，#ref-<id> 跳到文献，#quiz 自测。本机存 molastria-chem（读过的章、答对的题），只在这台设备上。
(() => {
  const D = window.MOLASTRIA_CHEM, S = window.MOLASTRIA_CHEM_SUBJECTS, MATH = window.MOLASTRIA_CHEM_MATH || {}, M = window.MOLASTRIA_CHEM_MODELS;
  if (!D || !S || !M || !D.chapters?.length) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (Array.isArray(t) ? t[en ? 1 : 0] : typeof t === 'string' ? t : en ? t.en : t.zh) : '');
  const L = (zh, e) => (en ? e : zh);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const ROOT = '../../';
  const SUB = S.subjects.map(([id, num, group, zh, e, line, chapters, demos, refs, rel]) => ({ id, num, group, zh, en: e, line, chapters, demos, refs, rel }));
  const me = SUB.find((s) => s.id === D.id);
  if (!me) return;
  const name = (s) => (en ? s.en : s.zh);
  if (en) document.title = `${me.en} · Chemistry Disciplines · MolAstria`;

  const chById = Object.fromEntries(D.chapters.map((c, i) => [c.id, { ...c, n: String(i + 1).padStart(2, '0') }]));
  const order = D.chapters.map((c) => c.id);
  const refById = Object.fromEntries(D.refs.map((r) => [r.id, r]));
  const lvl = (k) => `<span class="fs-st" data-s="${k}">${esc(tx(S.levels[k][0]))}</span>`;
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  const surname = (a) => a.trim().replace(/ et al\..*/, '').split(' ').pop();
  const shortRef = (r) => {
    const list = r.authors.replace(/ et al\..*/, '').split(','), many = list.length > 2 || /et al/.test(r.authors);
    return `${surname(list[0])}${many ? ' et al.' : list.length === 2 ? ` & ${surname(list[1])}` : ''} ${r.year}`;
  };
  const site = (path) => (/^https?:/.test(path) ? path : ROOT + path);
  // 正文标记：[@a,b] 文献，[[地址|文字]] 站内链接，{{ch:id}} 本馆一章，x^{…} 上标，x_{…} 下标
  const rich = (s) => esc(s)
    .replace(/\[@([\w-]+(?:\s*,\s*[\w-]+)*)\]/g, (_, list) => `<span class="chm-cites">[${list.split(',').map((id) => id.trim()).filter((id) => refById[id]).map((id) => `<a href="#ref-${id}" data-ref="${id}">${esc(shortRef(refById[id]))}</a>`).join('; ')}]</span>`)
    .replace(/\[\[([^|\]]+)\|([^\]]+)\]\]/g, (_, p, t) => `<a href="${esc(site(p.replace(/&amp;/g, '&')))}">${t}</a>`)
    .replace(/\{\{ch:([\w-]+)\}\}/g, (_, id) => (chById[id] ? `<a href="#c-${id}" data-open="${id}">${chById[id].n} · ${esc(tx(chById[id].title))}</a>` : ''))
    .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/_\{([^}]*)\}/g, '<sub>$1</sub>');
  const cite = (ids) => (ids?.length ? `<p class="fs-cite">${ids.filter((id) => refById[id]).map((id) => `<a href="#ref-${id}" data-ref="${id}">${esc(shortRef(refById[id]))}</a>`).join(' · ')}</p>` : '');

  // ── 本机记录：读过的章、答对的题 ────────────────────────────────────────
  const KEY = 'molastria-chem';
  const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
  const save = (fn) => { try { const v = load(); const mine = v[D.id] && typeof v[D.id] === 'object' ? v[D.id] : {}; fn(mine); v[D.id] = mine; localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 存不了也不影响阅读 */ } };
  const mine = () => { const v = load()[D.id]; return v && typeof v === 'object' ? v : {}; };
  let seen = (Array.isArray(mine().seen) ? mine().seen : []).filter((id) => chById[id]);
  const markSeen = (id) => {
    if (seen.includes(id)) return;
    seen.push(id);
    save((m) => { m.seen = seen.slice(); });
    try { window.MolAstriaActivity?.('read'); } catch { /* 学习记录是可选的 */ }
    document.querySelector(`.chm-ch[data-open="${id}"]`)?.classList.add('is-seen');
    progress();
  };
  const progress = () => { const el = $('#chm-progress'); if (el) el.textContent = L(`已读 ${seen.length} / ${order.length} 章`, `${seen.length} of ${order.length} chapters read`); };

  // ── 首屏 ────────────────────────────────────────────────────────────────
  const idx = SUB.indexOf(me);
  $('#chm-switch').innerHTML = `<a href="../index.html">${L('全部展馆', 'All halls')}</a>` + SUB.map((s) => `<a href="../${s.id}/index.html"${s === me ? ' aria-current="page"' : ''}><b>${s.num}</b>${esc(name(s))}</a>`).join('');
  $('#chm-switch').setAttribute('aria-label', L('十五个展馆', 'The fifteen halls'));
  $('#chm-eyebrow').textContent = `MOLASTRIA · CHEMISTRY DISCIPLINES · ${me.num}`;
  $('#chm-h1').innerHTML = en ? esc(me.en) : `${esc(me.zh)}<span class="fs-h1-en" lang="en">${esc(me.en)}</span>`;
  $('#chm-question').innerHTML = esc(tx(D.hero.question)) + (en ? '' : `<span class="fs-q-en" lang="en">${esc(D.hero.question[1])}</span>`);
  $('#chm-lead').innerHTML = rich(tx(D.hero.lead));
  $('#chm-scope').innerHTML = `<b>${L('本馆讲什么、站里别处讲什么', 'What this hall covers, and what lives elsewhere on the site')}</b><br>${rich(tx(D.hero.scope))}`;
  $('#chm-legend').innerHTML = Object.keys(S.levels).map((k) => `<li>${lvl(k)}<span>${esc(tx(S.levels[k][1]))}</span></li>`).join('');
  const nDemos = D.chapters.reduce((n, c) => n + (c.demos?.length || 0), 0);
  const JUMP = [['chm-map', L(`${order.length} 章`, `${order.length} chapters`), 1], ['chm-reader', L('开始读', 'Start reading')], ['chm-labs', L(`${nDemos} 个演示`, `${nDemos} demos`)], ['chm-history', L('发展时间线', 'Timeline')], ['chm-quiz', L('自测', 'Self-test')], ['chm-path', L('教材与路线', 'Books and path')], ['chm-library', L('文献', 'References')]];
  $('#chm-jump').innerHTML = JUMP.map(([id, t, primary]) => `<a class="button${primary ? ' primary' : ''}" href="#${id}">${t}${primary ? ' <i class="ico-ext ico-down" aria-hidden="true"></i>' : ''}</a>`).join('');
  const H = {
    'chm-map-h': [`${order.length} 章`, `${order.length} chapters`], 'chm-reader-h': ['阅读与演示', 'Read and experiment'], 'chm-labs-h': ['全部演示', 'All demos'], 'chm-history-h': ['发展时间线', 'Timeline'],
    'chm-quiz-h': ['自测', 'Self-test'], 'chm-path-h': ['教材与学习路线', 'Textbooks and a study path'], 'chm-open-h': ['还没解决的问题', 'Open questions'], 'chm-library-h': ['参考文献', 'References'], 'chm-more-h': ['接着逛', 'Keep exploring'],
  };
  for (const [id, t] of Object.entries(H)) { const el = $(`#${id}`); if (el) el.textContent = tx(t); }
  const NOTE = {
    'chm-map-note': ['每张卡片是一章：讲解、要点、核心公式、一道带数字的例题，大多数章还配一个能动手调的演示。标签说明内容的层次。读过的章会打上记号（只记在这台设备上）。', 'Each card is a chapter: explanation, key points, formulas, a worked example with numbers, and in most chapters a demo you can adjust. The label gives the level. Chapters you have opened are ticked (on this device only).'],
    'chm-labs-note': ['每个演示都在浏览器里当场计算，不是预先画好的动画。点一个就打开它所在的那一章。', 'Every demo is computed live in the browser, not a pre-drawn animation. Click one to open the chapter it belongs to.'],
    'chm-history-note': ['每一项尽量连到原始论文；年份是论文发表的年份。', 'Each item links to the original paper where possible; years are publication years.'],
    'chm-quiz-note': ['先自己选，再看解析。答对的题记在这台设备上。', 'Choose first, then read the explanation. Correct answers are remembered on this device.'],
    'chm-path-note': ['教材按从入门到进阶排列；书名和作者照出版方的写法，版次以最新版为准。站内的相关栏目放在最后。', 'Textbooks run from introductory to advanced; titles and authors follow the publishers, use the latest edition. Related sections of this site come last.'],
    'chm-library-note': [`共 ${D.refs.length} 篇。每一篇都在 ${D.checked} 按 DOI 在 OpenAlex（数据来自 Crossref）查过，题目、第一作者、年份和卷号逐项对照（node tools/chemistry-refs.mjs 重查）。`, `${D.refs.length} references. Each was looked up by its DOI in OpenAlex (which draws on Crossref) on ${D.checked}, comparing title, first author, year and volume (rerun with node tools/chemistry-refs.mjs).`],
  };
  for (const [id, t] of Object.entries(NOTE)) { const el = $(`#${id}`); if (el) el.textContent = tx(t); }
  $('#chm-skip').textContent = L('跳到各章', 'Skip to the chapters');

  // ── 章节地图 ────────────────────────────────────────────────────────────
  $('#chm-chapters').innerHTML = order.map((id) => { const c = chById[id]; return `<a class="chm-ch${seen.includes(id) ? ' is-seen' : ''}" href="#c-${id}" data-open="${id}"><span class="chm-ch-n">${c.n}</span><span class="chm-ch-t">${esc(tx(c.title))}</span><span class="chm-ch-s">${esc(tx(c.summary))}</span>${lvl(c.level)}</a>`; }).join('');
  progress();

  // ── 画图工具 ────────────────────────────────────────────────────────────
  const css = () => { const s = getComputedStyle(document.documentElement), g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent-text'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), ok: g('--ok'), danger: g('--danger'), paper: g('--paper'), surface: g('--surface'), violet: g('--violet') }; };
  function fit(cv) {
    const ratio = Number(cv.dataset.ratio), w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth), h = Math.round(w * Math.max(ratio, w < 420 ? Math.min(0.75, ratio * 1.35) : 0)), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  const sup = (s) => String(s).replace(/[-0-9]/g, (ch) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(ch)]);
  const fmt = (v, d = 3) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 1e5 || Math.abs(v) < 1e-3 ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`).replace('-', '−') : String(Number(v.toPrecision(d))).replace('-', '−'));
  const fix = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '—');
  const pct = (v, d = 1) => `${(100 * v).toFixed(d)} %`;
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  const ticks = (a, b, n = 5) => { if (!(b > a)) return [a]; const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m - 1e-9) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(12))); return out; };
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

  // 一张坐标图。o：x/y 范围，xl/yl 轴名，xt/yt 刻度（不给就自动），xf/yf 刻度写法，logx/logy 对数轴（范围写指数），
  // series：{ xs, ys | pts, color, width, dash, label, fill, sticks, dots, bars, line }，marks 竖线，hmarks 横线，arrows 箭头，texts 文字，bands 竖条（{ x0, x1, color }），after(g) 自己接着画
  function plot(cv, o) {
    const { ctx, w, h } = fit(cv), c = css();
    let [x0, x1] = o.x, [y0, y1] = o.y;
    const noY = o.yt && !o.yt.length, pad = { l: noY ? 14 : 50, r: 12, t: 26, b: o.xl ? 36 : 22 }, W = w - pad.l - pad.r, Hh = h - pad.t - pad.b;
    if (o.eq) { const sx = (x1 - x0) / W, sy = (y1 - y0) / Hh; if (sx > sy) { const m = (y0 + y1) / 2, half = (sx * Hh) / 2; y0 = m - half; y1 = m + half; } else { const m = (x0 + x1) / 2, half = (sy * W) / 2; x0 = m - half; x1 = m + half; } }
    const tX = o.logx ? (v) => Math.log10(v) : (v) => v, tY = o.logy ? (v) => Math.log10(v) : (v) => v;
    const X = (v) => pad.l + ((tX(v) - x0) / (x1 - x0)) * W, Y = (v) => pad.t + Hh - ((tY(v) - y0) / (y1 - y0)) * Hh;
    const Xr = (t) => pad.l + ((t - x0) / (x1 - x0)) * W, Yr = (t) => pad.t + Hh - ((t - y0) / (y1 - y0)) * Hh;
    const xt = o.xt || (o.logx ? ticks(Math.ceil(x0), Math.floor(x1), 8).filter(Number.isInteger) : ticks(x0, x1, w < 420 ? 4 : 6)), yt = o.yt || (o.logy ? ticks(Math.ceil(y0), Math.floor(y1), 6).filter(Number.isInteger) : ticks(y0, y1, 5));
    const pw = (t) => (t === 0 ? '1' : `10${sup(t)}`);
    const xf = o.xf || (o.logx ? pw : (t) => String(t).replace('-', '−')), yf = o.yf || (o.logy ? pw : (t) => String(t).replace('-', '−'));
    for (const b of o.bands || []) { ctx.globalAlpha = b.alpha ?? 0.12; ctx.fillStyle = b.color; const a = X(b.x0), z = X(b.x1); ctx.fillRect(Math.min(a, z), pad.t, Math.abs(z - a), Hh); ctx.globalAlpha = 1; }
    for (const b of o.hbands || []) { ctx.globalAlpha = b.alpha ?? 0.12; ctx.fillStyle = b.color; const a = Y(b.y0), z = Y(b.y1); ctx.fillRect(pad.l, Math.min(a, z), W, Math.abs(z - a)); ctx.globalAlpha = 1; }
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
    let lastX = -1e9;
    for (const t of xt) { if (t < x0 - 1e-9 || t > x1 + 1e-9) continue; ctx.beginPath(); ctx.moveTo(Xr(t), pad.t); ctx.lineTo(Xr(t), pad.t + Hh); ctx.stroke(); const lab = String(xf(t)), wd = ctx.measureText(lab).width; if (Math.abs(Xr(t) - lastX) > wd + 6) { ctx.textAlign = Xr(t) + wd / 2 > w - 2 ? 'right' : 'center'; ctx.fillText(lab, Xr(t), pad.t + Hh + 14); lastX = Xr(t); } }
    for (const t of yt) { if (t < y0 - 1e-9 || t > y1 + 1e-9) continue; ctx.beginPath(); ctx.moveTo(pad.l, Yr(t)); ctx.lineTo(pad.l + W, Yr(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(yf(t), pad.l - 6, Yr(t) + 4); }
    ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + Hh); ctx.lineTo(pad.l + W, pad.t + Hh); ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = 'center';
    if (o.xl) ctx.fillText(o.xl, pad.l + W / 2, h - 5);
    if (o.yl && !noY) { ctx.save(); ctx.translate(11, pad.t + Hh / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yl, 0, 0); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, Hh); ctx.clip();
    const base = o.logy ? 10 ** y0 : Math.min(Math.max(0, y0), y1);
    for (const s of o.series || []) {
      const xs = s.pts ? s.pts.map((p) => p[0]) : s.xs, ys = s.pts ? s.pts.map((p) => p[1]) : s.ys;
      ctx.globalAlpha = s.alpha ?? 1;
      if (s.bars) { ctx.fillStyle = s.color; xs.forEach((x, i) => { const a = X(x - s.bars / 2), b = X(x + s.bars / 2), t = Y(ys[i]), z = Y(s.base ?? base); ctx.fillRect(a, Math.min(t, z), Math.max(1, b - a - 1), Math.abs(z - t)); }); ctx.globalAlpha = 1; continue; }
      if (s.sticks) { ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; xs.forEach((x, i) => { ctx.beginPath(); ctx.moveTo(X(x), Y(s.base ?? base)); ctx.lineTo(X(x), Y(ys[i])); ctx.stroke(); }); ctx.globalAlpha = 1; continue; }
      if (s.dots) { ctx.fillStyle = s.color; xs.forEach((x, i) => { if (!Number.isFinite(ys[i])) return; ctx.beginPath(); ctx.arc(X(x), Y(ys[i]), s.dots, 0, 2 * Math.PI); ctx.fill(); }); ctx.globalAlpha = 1; if (!s.line) continue; }
      ctx.beginPath();
      let pen = false;
      xs.forEach((x, i) => { const y = ys[i]; if (!Number.isFinite(y) || (o.logy && y <= 0)) { pen = false; return; } if (pen) ctx.lineTo(X(x), Y(y)); else { ctx.moveTo(X(x), Y(y)); pen = true; } });
      if (s.fill) { ctx.lineTo(X(xs[xs.length - 1]), Y(base)); ctx.lineTo(X(xs[0]), Y(base)); ctx.closePath(); ctx.globalAlpha = 0.2; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = s.alpha ?? 1; }
      ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    for (const m of o.hmarks || []) { ctx.strokeStyle = m.color; ctx.setLineDash(m.dash || [4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, Y(m.y)); ctx.lineTo(pad.l + W, Y(m.y)); ctx.stroke(); ctx.setLineDash([]); }
    for (const m of o.marks || []) {
      ctx.strokeStyle = m.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(m.x), pad.t); ctx.lineTo(X(m.x), pad.t + Hh); ctx.stroke(); ctx.setLineDash([]);
      if (m.y !== undefined && Number.isFinite(m.y)) { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 4.5, 0, 2 * Math.PI); ctx.fill(); }
    }
    for (const a of o.arrows || []) arrow(ctx, X(a.from[0]), Y(a.from[1]), X(a.to[0]), Y(a.to[1]), a.color, a.width || 2);
    ctx.font = font(11, 600);
    for (const t of o.texts || []) { ctx.fillStyle = t.color || c.ink; ctx.textAlign = t.align || 'left'; ctx.fillText(t.s, X(t.x) + (t.dx || 0), Y(t.y) + (t.dy || 0)); }
    if (o.after) o.after({ ctx, X, Y, w, h, c, pad, W, H: Hh });
    ctx.restore();
    let lx = pad.l, ly = 14;
    ctx.font = font(11);
    for (const s of (o.series || []).filter((q) => q.label)) {
      const wd = 26 + ctx.measureText(s.label).width;
      if (lx + wd > w - 4 && lx > pad.l) break;
      if (s.dots && !s.line) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(lx + 8, ly - 4, 3.5, 0, 2 * Math.PI); ctx.fill(); } else if (s.bars) { ctx.fillStyle = s.color; ctx.fillRect(lx + 2, ly - 9, 12, 9); } else { ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx, ly - 4); ctx.lineTo(lx + 16, ly - 4); ctx.stroke(); ctx.setLineDash([]); }
      ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(s.label, lx + 20, ly);
      lx += wd + 8;
    }
  }
  function arrow(ctx, x0, y0, x1, y1, color, width = 2) {
    const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0), hd = Math.min(8, len * 0.45);
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
    if (len < 2) return;
    ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(a - 0.45), y1 - hd * Math.sin(a - 0.45)); ctx.lineTo(x1 - hd * Math.cos(a + 0.45), y1 - hd * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
  }
  // 能级图：levels 是 [{ e, label, n（简并度）, fill（电子数）, color }]，按列 col 排开
  function levels(cv, o) {
    const { ctx, w, h } = fit(cv), c = css();
    const pad = { l: o.yl ? 50 : 14, r: 12, t: 22, b: o.xl ? 30 : 14 }, W = w - pad.l - pad.r, Hh = h - pad.t - pad.b;
    const [y0, y1] = o.y, Y = (v) => pad.t + Hh - ((v - y0) / (y1 - y0)) * Hh, cols = o.cols || 1, cw = W / cols;
    ctx.font = font(11); ctx.strokeStyle = c.line; ctx.fillStyle = c.muted; ctx.lineWidth = 1;
    if (o.yl) { for (const t of ticks(y0, y1, 5)) { ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(pad.l + W, Y(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(String(t).replace('-', '−'), pad.l - 6, Y(t) + 4); } ctx.save(); ctx.translate(11, pad.t + Hh / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillStyle = c.ink2; ctx.fillText(o.yl, 0, 0); ctx.restore(); }
    (o.heads || []).forEach((t, i) => { ctx.fillStyle = c.ink2; ctx.textAlign = 'center'; ctx.font = font(11.5, 600); ctx.fillText(t, pad.l + cw * (i + 0.5), h - 8); });
    for (const lv of o.levels) {
      const n = lv.n || 1, cx = pad.l + cw * ((lv.col || 0) + 0.5), seg = Math.min(34, (cw * 0.7) / n - 6), y = Y(lv.e), total = n * seg + (n - 1) * 6;
      for (let k = 0; k < n; k++) {
        const xa = cx - total / 2 + k * (seg + 6);
        ctx.strokeStyle = lv.color || c.ink; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(xa, y); ctx.lineTo(xa + seg, y); ctx.stroke();
        const filled = lv.spins ? lv.spins[k] : 0;
        ctx.fillStyle = c.gold; ctx.strokeStyle = c.gold; ctx.lineWidth = 1.6;
        const up = (xx) => { ctx.beginPath(); ctx.moveTo(xx, y - 3); ctx.lineTo(xx, y - 17); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xx, y - 19); ctx.lineTo(xx - 3.5, y - 13); ctx.lineTo(xx + 3.5, y - 13); ctx.closePath(); ctx.fill(); };
        const dn = (xx) => { ctx.beginPath(); ctx.moveTo(xx, y - 19); ctx.lineTo(xx, y - 5); ctx.stroke(); ctx.beginPath(); ctx.moveTo(xx, y - 2); ctx.lineTo(xx - 3.5, y - 8); ctx.lineTo(xx + 3.5, y - 8); ctx.closePath(); ctx.fill(); };
        if (filled >= 1) up(xa + seg * (filled === 2 ? 0.33 : 0.5));
        if (filled === 2) dn(xa + seg * 0.67);
      }
      if (lv.label) { ctx.fillStyle = c.ink2; ctx.font = font(11); ctx.textAlign = 'left'; ctx.fillText(lv.label, cx + total / 2 + 6, y + 4); }
    }
    for (const ln of o.links || []) { ctx.strokeStyle = c.faint; ctx.setLineDash([3, 3]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l + cw * (ln.from[0] + 0.5) + ln.dx0, Y(ln.from[1])); ctx.lineTo(pad.l + cw * (ln.to[0] + 0.5) + ln.dx1, Y(ln.to[1])); ctx.stroke(); ctx.setLineDash([]); }
  }
  const box = (t, sub, cls = '') => `<div class="chm-box${cls ? ` ${cls}` : ''}"><b>${esc(t)}</b>${sub !== undefined && sub !== '' ? `<span>${esc(sub)}</span>` : ''}</div>`;
  const flow = (...cells) => `<div class="chm-flow">${cells.join('<i class="ico-ext ico-right chm-arr" aria-hidden="true"></i>')}</div>`;
  const table = (head, rows, on = -1) => `<div class="chm-wrap"><table class="chm-table"><thead><tr>${head.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === on ? ' class="is-on"' : ''}>${r.map((x) => (typeof x === 'number' ? `<td class="num">${esc(fmt(x))}</td>` : `<td${/^[−+\-\d.,\s×⁰¹²³⁴⁵⁶⁷⁸⁹⁻%]+$/.test(String(x)) ? ' class="num"' : ''}>${esc(x)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;

  // ── 演示 ────────────────────────────────────────────────────────────────
  // 每个演示：title 标题，kind（exact / data / model），intro 一句话，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，
  // sel 下拉 [键, 名字, [[值, 名字]…], 初值]，chk 开关 [键, 名字, 初值]，btn 预设 [名字, { 键: 值 }]，act 动作 [名字, (s) => …]，
  // figs 图 [高宽比 | 'html', 图注]，stack 控件放到图上面，note 模型说明，draw(s, 图, 颜色) 画图并返回读数 [[名字, 值, 是否加粗]]。
  const DEMOS = {};
  const K = { M, en, L, tx, esc, fmt, fix, pct, plot, levels, fit, arrow, css, font, ticks, lin, sup, box, flow, table, D };
  for (const reg of window.MOLASTRIA_CHEM_DEMOS || []) reg(K, DEMOS);
  let live = [];

  function demoHTML(id, n) {
    const d = DEMOS[id];
    if (!d) return '';
    const u = `d${n}`;
    const ctl = (d.ctl || []).map(([k, lab, min, max, step, v]) => `<label>${esc(tx(lab))}<span><input type="range" data-k="${k}" id="${u}-${k}" min="${min}" max="${max}" step="${step}" value="${v}"><output for="${u}-${k}"></output></span></label>`).join('');
    const sel = (d.sel || []).map(([k, lab, opts, v]) => `<label>${esc(tx(lab))}<span><select data-k="${k}">${opts.map(([val, t]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(tx(t))}</option>`).join('')}</select></span></label>`).join('');
    const chk = (d.chk || []).map(([k, lab, v]) => `<label class="chm-check"><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}><span>${esc(tx(lab))}</span></label>`).join('');
    const btn = [...(d.btn || []).map(([lab], i) => `<button type="button" class="button" data-preset="${i}">${esc(tx(lab))}</button>`), ...(d.act || []).map(([lab], i) => `<button type="button" class="button" data-act="${i}">${esc(tx(lab))}</button>`)].join('');
    const figs = (d.figs || []).map(([ratio, cap], i) => (ratio === 'html' ? `<div class="chm-html" data-fig="${i}"></div>` : `<figure class="fs-figure"><canvas data-fig="${i}" data-ratio="${ratio}" width="720" height="${Math.round(720 * ratio)}" role="img" aria-label="${esc(tx(cap))}"></canvas><figcaption>${esc(tx(cap))}</figcaption></figure>`)).join('');
    const kind = S.demoKinds[d.kind || 'model'];
    return `<article class="fs-demo chm-demo" data-demo="${id}" id="demo-${id}">
      <header><p class="fs-demo-n">${L('演示', 'Demo')}<span class="fs-st" data-s="${d.kind || 'model'}" title="${esc(tx(kind[1]))}">${esc(tx(kind[0]))}</span></p><h4>${esc(tx(d.title))}</h4>${d.intro ? `<p class="muted">${esc(tx(d.intro))}</p>` : ''}</header>
      <div class="fs-demo-body${d.stack ? ' chm-stack' : ''}"><div class="fs-controls">${sel}${ctl}${chk}${btn ? `<div class="fs-btns">${btn}</div>` : ''}<dl class="fs-readout" aria-live="polite"></dl></div><div class="chm-figs">${figs}</div></div>
      ${d.note ? `<details class="fs-notes"><summary>${L('模型说明与局限', 'About the model and its limits')}</summary><p>${rich(tx(d.note))}</p></details>` : ''}
    </article>`;
  }
  function mountDemo(root) {
    const id = root.dataset.demo, d = DEMOS[id], s = { ...(d.state || {}) };
    for (const [k, , , , , v] of d.ctl || []) s[k] = v;
    for (const [k, , , v] of d.sel || []) s[k] = String(v);
    for (const [k, , v] of d.chk || []) s[k] = !!v;
    const figs = [...root.querySelectorAll('[data-fig]')], read = root.querySelector('.fs-readout');
    const draw = () => {
      for (const [k, , , , , , f] of d.ctl || []) { const inp = root.querySelector(`input[data-k="${k}"]`); inp.value = s[k]; inp.nextElementSibling.textContent = f ? f(s[k]) : fmt(s[k]); }
      for (const [k] of d.sel || []) root.querySelector(`select[data-k="${k}"]`).value = s[k];
      for (const [k] of d.chk || []) root.querySelector(`input[type=checkbox][data-k="${k}"]`).checked = s[k];
      let rows = [];
      try { rows = d.draw(s, figs, css()) || []; } catch (err) { console.error(`[chemistry] demo ${id}`, err); }
      if (read) { read.innerHTML = rows.map(([k, v, big]) => `<dt>${esc(tx(k))}</dt><dd${big ? ' class="fs-big"' : ''}>${v}</dd>`).join(''); read.hidden = !rows.length; }
    };
    let q = 0;
    const later = () => { cancelAnimationFrame(q); q = requestAnimationFrame(draw); };
    root.addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; s[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.tagName === 'SELECT' ? e.target.value : Number(e.target.value); later(); });
    root.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' && e.target.dataset.k) { s[e.target.dataset.k] = e.target.value; later(); } });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.dataset.preset) { Object.assign(s, d.btn[b.dataset.preset][1]); draw(); }
      else if (b.dataset.act) { d.act[b.dataset.act][1](s); draw(); }
    });
    draw();
    return later;
  }

  // ── 阅读器 ──────────────────────────────────────────────────────────────
  const selEl = $('#chm-select');
  selEl.setAttribute('aria-label', L('选择一章', 'Choose a chapter'));
  selEl.innerHTML = order.map((id) => `<option value="${id}">${esc(`${chById[id].n} · ${tx(chById[id].title)}`)}</option>`).join('');
  let current = null;
  function open(id, { scroll = false, push = true, auto = false } = {}) {
    const c = Object.hasOwn(chById, id) ? chById[id] : null;
    if (!c) return false;
    id = c.id;
    current = id;
    const i = order.indexOf(id), prev = order[i - 1], next = order[i + 1];
    const ex = c.example;
    $('#chm-panel').innerHTML = `<article class="chm-topic" lang="${lang}">
      <header class="chm-topic-head"><p class="chm-crumb"><span>${me.num} · ${esc(name(me))}</span><span>${L(`第 ${c.n} 章 / 共 ${order.length} 章`, `Chapter ${c.n} of ${order.length}`)}</span></p>
        <h3 id="chm-topic-h" tabindex="-1"><span class="chm-topic-n">${c.n}</span>${esc(tx(c.title))} ${lvl(c.level)}</h3></header>
      <div class="chm-prose">${c.body.map((p) => `<p>${rich(tx(p))}</p>`).join('')}</div>
      ${c.points?.length ? `<h4 class="fs-sub-h">${L('要点', 'Key points')}</h4><ul class="chm-points">${c.points.map(([h, p, refs]) => `<li><h5>${esc(tx(h))}</h5><p>${rich(tx(p))}</p>${/\[@/.test(p[0]) ? '' : cite(refs)}</li>`).join('')}</ul>` : ''}
      ${c.math?.length ? `<h4 class="fs-sub-h">${L('核心公式', 'Key formulas')}</h4><div class="fs-formulas">${c.math.map(([k, cap]) => `<figure>${formula(k)}${cap ? `<figcaption>${rich(tx(cap))}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
      ${(c.demos || []).map((x, n) => demoHTML(x, n)).join('')}
      ${ex ? `<div class="chm-example"><b>${L('例题', 'Worked example')}</b><p>${rich(tx(ex.q))}</p><details${auto ? '' : ''}><summary>${L('看解答', 'Show the solution')}</summary><ol>${ex.steps.map((st) => `<li>${rich(tx(st))}</li>`).join('')}</ol><p class="chm-answer">${rich(tx(ex.a))}</p></details></div>` : ''}
      ${c.site?.length ? `<h4 class="fs-sub-h">${L('站内延伸', 'Elsewhere on MolAstria')}</h4><ul class="chm-site">${c.site.map(([p, t]) => `<li><a href="${esc(site(p))}">${esc(tx(t))} <i class="ico-ext ico-right" aria-hidden="true"></i></a></li>`).join('')}</ul>` : ''}
      ${c.refs?.length ? `<h4 class="fs-sub-h">${L('本章文献', 'References for this chapter')}</h4>${cite(c.refs)}` : ''}
      <nav class="chm-pager" aria-label="${L('上一章和下一章', 'Previous and next chapter')}">
        ${prev ? `<a class="button" href="#c-${prev}" data-open="${prev}"><i class="ico-ext ico-left" aria-hidden="true"></i> ${esc(`${chById[prev].n} · ${tx(chById[prev].title)}`)}</a>` : '<span></span>'}
        ${next ? `<a class="button primary" href="#c-${next}" data-open="${next}">${esc(`${chById[next].n} · ${tx(chById[next].title)}`)} <i class="ico-ext ico-right" aria-hidden="true"></i></a>` : '<span></span>'}
      </nav></article>`;
    selEl.value = id;
    live = [...$('#chm-panel').querySelectorAll('.chm-demo')].map(mountDemo);
    if (push) history.replaceState(null, '', `#c-${id}`);
    if (!auto) markSeen(id);
    if (scroll) $('#chm-reader').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    return true;
  }
  selEl.addEventListener('change', () => open(selEl.value));
  $('#chm-prev').addEventListener('click', () => { const i = order.indexOf(current); if (i > 0) open(order[i - 1]); });
  $('#chm-next').addEventListener('click', () => { const i = order.indexOf(current); if (i < order.length - 1) open(order[i + 1]); });
  $('#chm-prev').setAttribute('aria-label', L('上一章', 'Previous chapter'));
  $('#chm-next').setAttribute('aria-label', L('下一章', 'Next chapter'));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-open]');
    if (a) { e.preventDefault(); open(a.dataset.open, { scroll: true }); if (a.dataset.demo) setTimeout(() => document.getElementById(`demo-${a.dataset.demo}`)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }), 60); return; }
    const r = e.target.closest('a[data-ref]');
    if (r) { e.preventDefault(); showRef(r.dataset.ref); }
  });
  const redraw = () => { for (const f of live) f(); };
  if ('ResizeObserver' in window) { let w0 = 0; new ResizeObserver(() => { const w = $('#chm-panel').clientWidth; if (w !== w0) { w0 = w; redraw(); } }).observe($('#chm-panel')); }
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redraw);

  // ── 全部演示 ────────────────────────────────────────────────────────────
  $('#chm-demo-list').innerHTML = order.flatMap((id) => (chById[id].demos || []).filter((x) => DEMOS[x]).map((x) => `<li><a href="#c-${id}" data-open="${id}" data-demo="${x}">${esc(tx(DEMOS[x].title))}<small>${chById[id].n} · ${esc(tx(chById[id].title))}</small></a></li>`)).join('');

  // ── 时间线 ──────────────────────────────────────────────────────────────
  $('#chm-timeline').innerHTML = D.milestones.map((m) => `<li><span class="chm-year">${esc(m.year)}</span><div><p>${rich(tx(m.text))}</p>${cite(m.refs)}</div></li>`).join('');

  // ── 自测 ────────────────────────────────────────────────────────────────
  let right = new Set((Array.isArray(mine().quiz) ? mine().quiz : []).filter((i) => Number.isInteger(i) && i < D.quiz.length));
  const score = () => { $('#chm-score').textContent = L(`答对过 ${right.size} / ${D.quiz.length} 题`, `${right.size} of ${D.quiz.length} answered correctly`); };
  $('#chm-quiz-list').innerHTML = D.quiz.map((q, i) => `<div class="chm-q" data-q="${i}"><p><b>${i + 1}</b>${rich(tx(q.q))}</p>
    <fieldset class="chm-opts"><legend class="chm-sr">${L(`第 ${i + 1} 题的选项`, `Options for question ${i + 1}`)}</legend>${q.opts.map((o, j) => `<label><input type="radio" name="q${i}" value="${j}"><span>${rich(tx(o))}</span></label>`).join('')}</fieldset>
    <p class="chm-why" hidden></p></div>`).join('');
  $('#chm-quiz-list').addEventListener('change', (e) => {
    const box_ = e.target.closest('.chm-q');
    if (!box_ || e.target.type !== 'radio') return;
    const i = Number(box_.dataset.q), q = D.quiz[i], pick = Number(e.target.value), ok = pick === q.a;
    for (const lab of box_.querySelectorAll('label')) { const v = Number(lab.querySelector('input').value); lab.classList.toggle('is-right', v === q.a); lab.classList.toggle('is-wrong', v === pick && !ok); }
    const why = box_.querySelector('.chm-why');
    why.hidden = false;
    why.innerHTML = `<b>${ok ? L('答对了。', 'Correct.') : L('不对。', 'Not quite.')}</b> ${rich(tx(q.why))}${q.ch && chById[q.ch] ? ` ${L('详见', 'See')} {{ch}}`.replace('{{ch}}', `<a href="#c-${q.ch}" data-open="${q.ch}">${chById[q.ch].n} · ${esc(tx(chById[q.ch].title))}</a>`) : ''}`;
    if (ok && !right.has(i)) { right.add(i); save((m) => { m.quiz = [...right]; }); try { window.MolAstriaActivity?.('quiz'); } catch { /* 可选 */ } score(); }
  });
  score();

  // ── 教材、学习路线、开放问题 ────────────────────────────────────────────
  $('#chm-books').innerHTML = D.books.map((b) => `<li><b>${esc(b.title)}</b><i>${esc(b.authors)}</i><br>${rich(tx(b.note))}</li>`).join('');
  $('#chm-path-site').innerHTML = (D.siteLinks || []).map(([p, t]) => `<li><a href="${esc(site(p))}">${esc(tx(t))} <i class="ico-ext ico-right" aria-hidden="true"></i></a></li>`).join('');
  $('#chm-open-list').innerHTML = (D.open || []).map(([q, ch]) => `<li>${rich(tx(q))}${ch && chById[ch] ? `<span class="chm-open-meta"><a href="#c-${ch}" data-open="${ch}">${chById[ch].n} · ${esc(tx(chById[ch].title))}</a></span>` : ''}</li>`).join('');

  // ── 文献 ────────────────────────────────────────────────────────────────
  const citedIn = {};
  const scan = (s, ch) => { for (const m of String(s || '').matchAll(/\[@([\w-]+(?:\s*,\s*[\w-]+)*)\]/g)) for (const id of m[1].split(',')) (citedIn[id.trim()] ||= new Set()).add(ch); };
  for (const c of D.chapters) {
    for (const id of c.refs || []) (citedIn[id] ||= new Set()).add(c.id);
    for (const p of c.body) scan(p[0], c.id);
    for (const [, p, refs] of c.points || []) { scan(p[0], c.id); for (const id of refs || []) (citedIn[id] ||= new Set()).add(c.id); }
  }
  const filt = $('#chm-ref-filter');
  filt.innerHTML = `<button type="button" class="fs-chip" data-ch="" aria-pressed="true">${L('全部', 'All')}</button>` + order.filter((id) => Object.values(citedIn).some((set) => set.has(id))).map((id) => `<button type="button" class="fs-chip" data-ch="${id}" aria-pressed="false">${chById[id].n} · ${esc(tx(chById[id].title))}</button>`).join('');
  function renderRefs(ch) {
    const list = D.refs.filter((r) => !ch || citedIn[r.id]?.has(ch)).sort((a, b) => a.year - b.year || a.id.localeCompare(b.id));
    $('#chm-refs').innerHTML = list.map((r) => `<li class="fs-ref" id="ref-${r.id}"><span>${esc(r.authors)} (${r.year}). <span class="fs-ref-title">${esc(r.title)}</span>. <i>${esc(r.journal)}</i>${r.vol ? ` ${esc(r.vol)}` : ''}${r.pages ? `, ${esc(r.pages)}` : ''}.</span>
      <div class="fs-ref-meta"><a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener noreferrer">doi:${esc(r.doi)} <i class="ico-ext" aria-hidden="true"></i></a>${citedIn[r.id] ? `<span>${L('用于', 'Used in')} ${order.filter((id) => citedIn[r.id].has(id)).map((id) => `<a href="#c-${id}" data-open="${id}">${chById[id].n}</a>`).join(', ')}</span>` : ''}${r.note ? `<span>${esc(tx(r.note))}</span>` : ''}</div></li>`).join('');
    $('#chm-ref-count').textContent = L(`显示 ${list.length} / ${D.refs.length} 篇`, `${list.length} of ${D.refs.length}`);
  }
  filt.addEventListener('click', (e) => { const b = e.target.closest('.fs-chip'); if (!b) return; for (const x of filt.children) x.setAttribute('aria-pressed', x === b); renderRefs(b.dataset.ch); });
  renderRefs('');
  function showRef(id) {
    if (!document.getElementById(`ref-${id}`)) { for (const x of filt.children) x.setAttribute('aria-pressed', x.dataset.ch === ''); renderRefs(''); }
    const el = document.getElementById(`ref-${id}`);
    if (!el) return;
    history.replaceState(null, '', `#ref-${id}`);
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800);
  }

  // ── 接着逛 ──────────────────────────────────────────────────────────────
  const prevS = SUB[(idx - 1 + SUB.length) % SUB.length], nextS = SUB[(idx + 1) % SUB.length];
  const rel = me.rel.map((id) => SUB.find((s) => s.id === id)).filter(Boolean);
  $('#chm-more-body').innerHTML = `<div class="chm-cards">${rel.map((s) => `<a class="chm-card" href="../${s.id}/index.html"><span class="chm-card-n">${s.num}</span><h4>${esc(name(s))}</h4><p>${esc(tx(s.line))}</p></a>`).join('')}</div>
    <nav class="chm-pager" aria-label="${L('上一个和下一个展馆', 'Previous and next hall')}"><a class="button" href="../${prevS.id}/index.html"><i class="ico-ext ico-left" aria-hidden="true"></i> ${prevS.num} · ${esc(name(prevS))}</a><a class="button" href="../index.html">${L('十五个展馆', 'All fifteen halls')}</a><a class="button primary" href="../${nextS.id}/index.html">${nextS.num} · ${esc(name(nextS))} <i class="ico-ext ico-right" aria-hidden="true"></i></a></nav>`;

  // ── 地址 ────────────────────────────────────────────────────────────────
  function route() {
    const m = location.hash.match(/^#c-([\w-]+)$/);
    if (m && chById[m[1]]) { open(m[1], { push: false }); setTimeout(() => $('#chm-reader').scrollIntoView({ block: 'start' }), 80); return; }
    const r = location.hash.match(/^#ref-([\w-]+)$/);
    if (r) setTimeout(() => showRef(r[1]), 80);
  }
  window.addEventListener('hashchange', route);
  route();
  if (!current) open(order[0], { push: false, auto: true });
  window.MOLASTRIA_CHEM_READY = true;
})();
