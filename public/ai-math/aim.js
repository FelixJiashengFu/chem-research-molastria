'use strict';
// 前沿 AI 数学：把 aim-data.js（骨架）和 aim-topics.js（44 个主题与附录 A–L 的正文）画成页面，并驱动每个主题的交互演示。
// 演示的定义在 aim-demos-a/b/c.js（控件、图、读数），数学在 aim-models.js；这里是页面、阅读器和画图工具。
// 这一页的文字全部自带中英两版（按 <html lang> 取），<main> 标了 translate="no"，不走 i18n.js 的词典。
// 地址：#t-07 打开主题 07，#a-B 打开附录 B，#ref-<id> 跳到文献。本机只存读过哪些主题（molastria-aim）。
(() => {
  const D = window.MOLASTRIA_AIM, MATH = window.MOLASTRIA_AIM_MATH || {}, M = window.MOLASTRIA_AIM_MODELS;
  if (!D || !M || !D.topics.length) return;
  const en = document.documentElement.lang === 'en';
  if (en) document.title = 'Frontier AI Mathematics · MolAstria';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (Array.isArray(t) ? t[en ? 1 : 0] : en ? t.en : t.zh) : '');
  const L = (zh, e) => (en ? e : zh);
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;

  const items = [...D.topics, ...D.appendices];
  const byId = Object.fromEntries(items.map((t) => [t.id, t]));
  const isTopic = (id) => /^\d/.test(id);
  const href = (id) => `#${isTopic(id) ? 't' : 'a'}-${id}`;
  const label = (id) => (isTopic(id) ? id : L(`附录 ${id}`, `Appendix ${id}`));
  const partById = Object.fromEntries(D.parts.map((p) => [p.id, p]));
  const refByN = Object.fromEntries(D.refs.filter((r) => r.n).map((r) => [r.n, r]));
  const kind = (k) => `<span class="fs-st" data-s="${k}">${esc(tx(D.kinds[k]))}</span>`;
  const formula = (key) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(D.math[key]?.[0] || '')}</pre>`);
  // 正文里的 [15,16] 连到文献，“附录 H”连到附录
  const linkify = (s) => esc(s)
    .replace(/\[(\d+(?:\s*,\s*\d+)*)\]/g, (_, list) => `[${list.split(',').map((n) => { const r = refByN[Number(n)]; return r ? `<a href="#ref-${r.id}" data-ref="${r.id}">${Number(n)}</a>` : n.trim(); }).join(', ')}]`)
    .replace(/(附录 |Appendix )([A-L])(?![A-Za-z])/g, (_, w, id) => `<a href="#a-${id}" data-open="${id}">${w}${id}</a>`);

  // ── 读过的主题（只存在本机） ────────────────────────────────────────────
  const KEY = 'molastria-aim';
  let seen = [];
  try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); if (Array.isArray(v.seen)) seen = v.seen.filter((id) => byId[id]); } catch { /* 读不到就当没读过 */ }
  const markSeen = (id) => {
    if (seen.includes(id)) return;
    seen.push(id);
    try { localStorage.setItem(KEY, JSON.stringify({ seen })); } catch { /* 存不了也不影响阅读 */ }
    try { window.MolAstriaActivity?.('read'); } catch { /* 学习记录是可选的 */ }
    document.querySelector(`.aim-card[data-open="${id}"]`)?.classList.add('is-seen');
    progress();
  };
  const progress = () => { const el = $('#aim-progress'); if (el) el.textContent = L(`已读 ${seen.length} / ${items.length}`, `${seen.length} of ${items.length} read`); };

  // ── 首屏 ────────────────────────────────────────────────────────────────
  $('#aim-h1').innerHTML = en ? 'Frontier AI Mathematics' : '前沿 AI 数学<span class="fs-h1-en" lang="en">Frontier AI Mathematics</span>';
  $('#aim-question').innerHTML = esc(tx(D.hero.question)) + (en ? '' : `<span class="fs-q-en" lang="en">${esc(D.hero.question.en)}</span>`);
  $('#aim-lead').textContent = tx(D.hero.lead);
  $('#aim-honest').textContent = tx(D.hero.honesty);
  $('#aim-legend').innerHTML = Object.keys(D.kinds).map((k) => `<li>${kind(k)}<span>${esc(tx(D.kindsLong[k]))}</span></li>`).join('');
  const JUMP = [['aim-map', '44 个主题', 'The 44 topics', 1], ['aim-reader', '开始读', 'Start reading'], ['aim-threads', '五条主线', 'Five threads'], ['aim-quiz', '自测', 'Self-test'], ['aim-audit', '核对说明', 'What was checked'], ['aim-library', '参考资料', 'References']];
  $('#aim-jump').innerHTML = JUMP.map(([id, zh, e, primary]) => `<a class="button${primary ? ' primary' : ''}" href="#${id}">${L(zh, e)}${primary ? ' <i class="ico-ext ico-down" aria-hidden="true"></i>' : ''}</a>`).join('');
  const H = { 'aim-how-h': ['怎么用这一栏', 'How to use this section'], 'aim-map-h': ['七个部分，44 个主题', 'Seven parts, 44 topics'], 'aim-reader-h': ['阅读与演示', 'Read and experiment'], 'aim-threads-h': ['五条贯穿全书的主线', 'Five threads through the course'], 'aim-reading-h': ['读一篇前沿论文的清单', 'A checklist for reading a frontier paper'], 'aim-quiz-h': ['十题自测', 'Ten self-test questions'], 'aim-audit-h': ['核对说明', 'What was checked, and what was not'], 'aim-library-h': ['参考资料', 'References'], 'aim-notation-h': ['先统一符号', 'Notation first'] };
  for (const [id, t] of Object.entries(H)) { const el = $(`#${id}`); if (el) el.textContent = tx(t); }
  const NOTE = {
    'aim-map-note': ['每张卡片是一个主题：点开后有讲解、公式和一个可以动手调的演示。标签说明演示的身份。读过的主题会打上记号（只记在这台设备上）。', 'Each card is one topic: open it for the explanation, the formulas and a demo you can adjust. The label says what kind of demo it is. Topics you have opened are ticked (remembered on this device only).'],
    'aim-threads-note': ['把新方法翻译回少数几个可以检验的数学对象。箭头表示联系，不表示算法严格等价。', 'Translate a new method back into a few testable mathematical objects. Arrows mean a connection, not strict equivalence of algorithms.'],
    'aim-reading-note': ['把每篇新论文压缩成六个对象，再过三轮检查。勾选只在这一页有效，刷新就清空。', 'Compress each new paper into six objects, then go through three rounds of checks. The ticks live only on this page and clear on reload.'],
    'aim-quiz-note': ['先自己答，再点开看讲义的答案；每题连到讲它的主题。', 'Answer first, then open the notes’ answer; each question links to the topic that covers it.'],
    'aim-audit-note': [`核对日期 ${D.checked}。下面分三栏：核对过的、没能核对的、和讲义不一样的地方。`, `Checked on ${D.checked}. Three lists follow: what was verified, what could not be verified, and where this page departs from the notes.`],
    'aim-library-note': ['讲义的 40 项参考资料，外加编者补充的 3 项。优先原始论文和作者教程；近期预印本单独标出，它们还没有经过长期复现。', 'The 40 references of the notes plus 3 added by the editor. Original papers and authors’ tutorials come first; recent preprints are marked, as they have not yet stood the test of long-term replication.'],
  };
  for (const [id, t] of Object.entries(NOTE)) { const el = $(`#${id}`); if (el) el.textContent = tx(t); }
  $('#aim-skip').textContent = L('跳到 44 个主题', 'Skip to the 44 topics');

  // ── 使用说明与符号 ──────────────────────────────────────────────────────
  $('#aim-how').innerHTML = D.howto.map(([h, p]) => `<article class="aim-how"><h3>${esc(tx(h))}</h3><p>${esc(tx(p))}</p></article>`).join('');
  $('#aim-notation').innerHTML = D.notation.map(([sym, text]) => `<div><dt>${esc(typeof sym === 'string' ? sym : tx(sym))}</dt><dd>${esc(tx(text))}</dd></div>`).join('');

  // ── 主题地图 ────────────────────────────────────────────────────────────
  const card = (t) => `<a class="aim-card${seen.includes(t.id) ? ' is-seen' : ''}" href="${href(t.id)}" data-open="${t.id}"><span class="aim-card-n">${t.id}</span><span class="aim-card-t">${esc(tx(t.title))}</span>${kind(t.kind)}</a>`;
  $('#aim-parts').innerHTML = D.parts.map((p) => `<section class="aim-part" id="part-${p.id}"><header><span class="aim-part-n">${p.num}</span><div><h3>${esc(tx(p.title))}</h3><p>${esc(tx(p.text))}</p></div></header>
    <div class="aim-cards">${items.filter((t) => t.part === p.id).map(card).join('')}</div></section>`).join('');
  progress();

  // ── 画图工具 ────────────────────────────────────────────────────────────
  const css = () => { const s = getComputedStyle(document.documentElement), g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent-text'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), ok: g('--ok'), danger: g('--danger'), paper: g('--paper'), surface: g('--surface'), violet: g('--violet') }; };
  function fit(cv) {
    const ratio = Number(cv.dataset.ratio), w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth), h = Math.round(w * Math.max(ratio, w < 420 ? Math.min(0.72, ratio * 1.35) : 0)), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  const sup = (s) => String(s).replace(/[-0-9]/g, (ch) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(ch)]);
  const fmt = (v, d = 3) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 1e5 || Math.abs(v) < 1e-3 ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`).replace('-', '−') : String(Number(v.toPrecision(d))).replace('-', '−'));
  const pct = (v, d = 1) => `${(100 * v).toFixed(d)} %`;
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  const ticks = (a, b, n = 5) => { if (!(b > a)) return [a]; const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m - 1e-9) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(12))); return out; };
  const pow = (t) => (t === 0 ? '1' : `10${sup(t)}`);

  // 一张坐标图。o：x/y 范围，xl/yl 轴名，xt/yt 刻度（不给就自动），xf/yf 刻度写法，eq 等比例，
  // series：{ xs, ys | pts, color, width, dash, label, fill, sticks, dots, bars }，marks 竖线，hmarks 横线，arrows 箭头，texts 文字，after(g) 自己接着画
  function plot(cv, o) {
    const { ctx, w, h } = fit(cv), c = css();
    let [x0, x1] = o.x, [y0, y1] = o.y;
    const noY = o.yt && !o.yt.length, pad = { l: noY ? 14 : 48, r: 12, t: 26, b: o.xl ? 36 : 22 }, W = w - pad.l - pad.r, Hh = h - pad.t - pad.b;
    if (o.eq) { const sx = (x1 - x0) / W, sy = (y1 - y0) / Hh; if (sx > sy) { const m = (y0 + y1) / 2, half = (sx * Hh) / 2; y0 = m - half; y1 = m + half; } else { const m = (x0 + x1) / 2, half = (sy * W) / 2; x0 = m - half; x1 = m + half; } }
    const X = (v) => pad.l + ((v - x0) / (x1 - x0)) * W, Y = (v) => pad.t + Hh - ((v - y0) / (y1 - y0)) * Hh;
    const xt = o.xt || ticks(x0, x1, w < 420 ? 4 : 6), yt = o.yt || ticks(y0, y1, 5), xf = o.xf || ((t) => String(t).replace('-', '−')), yf = o.yf || ((t) => String(t).replace('-', '−'));
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
    let lastX = -1e9;
    for (const t of xt) { if (t < x0 - 1e-9 || t > x1 + 1e-9) continue; ctx.beginPath(); ctx.moveTo(X(t), pad.t); ctx.lineTo(X(t), pad.t + Hh); ctx.stroke(); const lab = String(xf(t)), wd = ctx.measureText(lab).width; if (Math.abs(X(t) - lastX) > wd + 6) { ctx.textAlign = X(t) + wd / 2 > w - 2 ? 'right' : 'center'; ctx.fillText(lab, X(t), pad.t + Hh + 14); lastX = X(t); } }
    for (const t of yt) { if (t < y0 - 1e-9 || t > y1 + 1e-9) continue; ctx.beginPath(); ctx.moveTo(pad.l, Y(t)); ctx.lineTo(pad.l + W, Y(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(yf(t), pad.l - 6, Y(t) + 4); }
    ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + Hh); ctx.lineTo(pad.l + W, pad.t + Hh); ctx.stroke();
    ctx.fillStyle = c.ink2; ctx.textAlign = 'center';
    if (o.xl) ctx.fillText(o.xl, pad.l + W / 2, h - 5);
    if (o.yl && !noY) { ctx.save(); ctx.translate(11, pad.t + Hh / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yl, 0, 0); ctx.restore(); }
    ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, Hh); ctx.clip();
    const base = Math.min(Math.max(0, y0), y1);
    for (const s of o.series || []) {
      const xs = s.pts ? s.pts.map((p) => p[0]) : s.xs, ys = s.pts ? s.pts.map((p) => p[1]) : s.ys;
      ctx.globalAlpha = s.alpha ?? 1;
      if (s.bars) { ctx.fillStyle = s.color; xs.forEach((x, i) => { const a = X(x - s.bars / 2), b = X(x + s.bars / 2), t = Y(ys[i]), z = Y(base); ctx.fillRect(a, Math.min(t, z), Math.max(1, b - a - 1), Math.abs(z - t)); }); ctx.globalAlpha = 1; continue; }
      if (s.sticks) { ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; xs.forEach((x, i) => { ctx.beginPath(); ctx.moveTo(X(x), Y(base)); ctx.lineTo(X(x), Y(ys[i])); ctx.stroke(); }); ctx.globalAlpha = 1; continue; }
      if (s.dots) { ctx.fillStyle = s.color; xs.forEach((x, i) => { if (!Number.isFinite(ys[i])) return; ctx.beginPath(); ctx.arc(X(x), Y(ys[i]), s.dots, 0, 2 * Math.PI); ctx.fill(); }); ctx.globalAlpha = 1; if (!s.line) continue; }
      ctx.beginPath();
      let pen = false;
      xs.forEach((x, i) => { const y = ys[i]; if (!Number.isFinite(y)) { pen = false; return; } if (pen) ctx.lineTo(X(x), Y(y)); else { ctx.moveTo(X(x), Y(y)); pen = true; } });
      if (s.fill) { ctx.lineTo(X(xs[xs.length - 1]), Y(base)); ctx.lineTo(X(xs[0]), Y(base)); ctx.closePath(); ctx.globalAlpha = 0.2; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = s.alpha ?? 1; }
      ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
    }
    for (const m of o.hmarks || []) { ctx.strokeStyle = m.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, Y(m.y)); ctx.lineTo(pad.l + W, Y(m.y)); ctx.stroke(); ctx.setLineDash([]); }
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
      if (lx + wd > w - 4 && lx > pad.l) { if (ly > 14) break; lx = pad.l; ly = 14; break; }
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
  // 热图：矩阵的每个格子按数值上色，格子够大时写上数字
  function heat(cv, A, o = {}) {
    const { ctx, w, h } = fit(cv), c = css(), rows = A.length, cols = A[0].length;
    const pad = { l: o.rows ? 46 : 10, r: 10, t: o.cols ? 22 : 10, b: o.xl ? 24 : 10 }, cw = (w - pad.l - pad.r) / cols, ch = (h - pad.t - pad.b) / rows;
    const max = o.max ?? Math.max(1e-12, ...A.flat().map(Math.abs)), color = o.color || c.accent;
    ctx.font = font(Math.max(9, Math.min(12, cw / 3.6)));
    for (let i = 0; i < rows; i++) for (let j = 0; j < cols; j++) {
      const v = A[i][j], x = pad.l + j * cw, y = pad.t + i * ch;
      ctx.globalAlpha = Math.min(1, Math.abs(v) / max) * 0.85; ctx.fillStyle = v < 0 ? c.danger : o.diag && i === j ? c.gold : color; ctx.fillRect(x + 1, y + 1, cw - 2, ch - 2); ctx.globalAlpha = 1;
      ctx.strokeStyle = c.line; ctx.strokeRect(x + 0.5, y + 0.5, cw - 1, ch - 1);
      if (o.mask?.(i, j)) { ctx.strokeStyle = c.faint; ctx.beginPath(); ctx.moveTo(x + 4, y + 4); ctx.lineTo(x + cw - 4, y + ch - 4); ctx.stroke(); } else if (cw > 30 && ch > 16 && o.num !== false) { ctx.fillStyle = Math.abs(v) / max > 0.55 ? c.paper : c.ink; ctx.textAlign = 'center'; ctx.fillText((o.fmt || ((q) => q.toFixed(2)))(v), x + cw / 2, y + ch / 2 + 4); }
    }
    ctx.fillStyle = c.muted; ctx.font = font(11);
    if (o.rows) { ctx.textAlign = 'right'; o.rows.forEach((r, i) => ctx.fillText(r, pad.l - 6, pad.t + (i + 0.5) * ch + 4)); }
    if (o.cols) { ctx.textAlign = 'center'; o.cols.forEach((r, j) => ctx.fillText(r, pad.l + (j + 0.5) * cw, 14)); }
    if (o.xl) { ctx.textAlign = 'center'; ctx.fillStyle = c.ink2; ctx.fillText(o.xl, pad.l + (w - pad.l - pad.r) / 2, h - 6); }
  }

  // ── 演示 ────────────────────────────────────────────────────────────────
  const DEMOS = {};
  // 示意图用的小方框和一行流程（HTML，不是画布：文字能换行、能被读屏读到）
  const box = (t, sub, cls = '') => `<div class="aim-box${cls ? ` ${cls}` : ''}"><b>${esc(t)}</b>${sub !== undefined && sub !== '' ? `<span>${esc(sub)}</span>` : ''}</div>`;
  const mkRow = (sep) => (...cells) => `<div class="aim-flow">${cells.join(sep)}</div>`;
  const row = mkRow('<i class="ico-ext ico-right aim-arr" aria-hidden="true"></i>');
  row.back = mkRow('<i class="ico-ext ico-left aim-arr" aria-hidden="true"></i>');
  row.plain = mkRow('');
  const K = { M, en, L, tx, esc, fmt, pct, plot, heat, fit, arrow, css, font, ticks, pow, sup, href, label, byId, box, row, lin: M.linspace, D };
  for (const reg of window.MOLASTRIA_AIM_DEMOS || []) reg(K, DEMOS);
  let live = [], playing = null;
  const stopPlay = () => { if (playing) { cancelAnimationFrame(playing.raf); playing.btn.setAttribute('aria-pressed', 'false'); playing.btn.textContent = L('播放', 'Play'); playing = null; } };

  function demoHTML(id, n) {
    const d = DEMOS[id];
    if (!d) return '';
    const u = `d${n}`;
    const ctl = (d.ctl || []).map(([k, lab, min, max, step, v]) => `<label>${esc(tx(lab))}<span><input type="range" data-k="${k}" id="${u}-${k}" min="${min}" max="${max}" step="${step}" value="${v}"><output for="${u}-${k}"></output></span></label>`).join('');
    const chk = (d.chk || []).map(([k, lab, v]) => `<label class="aim-check"><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}><span>${esc(tx(lab))}</span></label>`).join('');
    const btn = [...(d.btn || []).map(([lab], i) => `<button type="button" class="button" data-preset="${i}">${esc(tx(lab))}</button>`), ...(d.act || []).map(([lab], i) => `<button type="button" class="button" data-act="${i}">${esc(tx(lab))}</button>`), d.play ? `<button type="button" class="button" data-play aria-pressed="false">${L('播放', 'Play')}</button>` : ''].join('');
    const figs = (d.figs || []).map(([ratio, cap], i) => (ratio === 'html' ? `<div class="aim-html" data-fig="${i}"></div>` : `<figure class="fs-figure"><canvas data-fig="${i}" data-ratio="${ratio}" width="720" height="${Math.round(720 * ratio)}" role="img" aria-label="${esc(tx(cap))}"></canvas><figcaption>${esc(tx(cap))}</figcaption></figure>`)).join('');
    const wide = !ctl && !chk && !btn && !d.rows;
    return `<article class="fs-demo aim-demo" data-demo="${id}" data-u="${u}">
      <header><p class="fs-demo-n">${L('演示', 'Demo')} · ${kind(d.kind || byId[id]?.kind || 'construct')}</p><h4>${esc(tx(d.title))}</h4>${d.intro ? `<p class="muted">${esc(tx(d.intro))}</p>` : ''}</header>
      <div class="fs-demo-body${wide ? ' aim-wide' : d.stack ? ' aim-stack' : ''}">${wide ? '' : `<div class="fs-controls">${ctl}${chk}${btn ? `<div class="fs-btns">${btn}</div>` : ''}<dl class="fs-readout" aria-live="polite"></dl></div>`}<div class="aim-figs">${figs}</div></div>
      ${d.note ? `<details class="fs-notes"><summary>${L('模型说明与局限', 'About the model and its limits')}</summary><p>${esc(tx(d.note))}</p></details>` : ''}
    </article>`;
  }
  function mountDemo(root) {
    const id = root.dataset.demo, d = DEMOS[id], s = { ...(d.state || {}) };
    for (const [k, , , , , v] of d.ctl || []) s[k] = v;
    for (const [k, , v] of d.chk || []) s[k] = !!v;
    const figs = [...root.querySelectorAll('[data-fig]')], read = root.querySelector('.fs-readout');
    const draw = () => {
      for (const [k, , , , , , f] of d.ctl || []) { const inp = root.querySelector(`input[data-k="${k}"]`); inp.value = s[k]; inp.nextElementSibling.textContent = f ? f(s[k]) : fmt(s[k]); }
      for (const [k] of d.chk || []) root.querySelector(`input[type=checkbox][data-k="${k}"]`).checked = s[k];
      const rows = d.draw(s, figs, css()) || [];
      if (read) { read.innerHTML = rows.map(([k, v, big]) => `<dt>${esc(tx(k))}</dt><dd${big ? ' class="fs-big"' : ''}>${v}</dd>`).join(''); read.hidden = !rows.length; }
    };
    let q = 0;
    const later = () => { cancelAnimationFrame(q); q = requestAnimationFrame(draw); };
    root.addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; s[k] = e.target.type === 'checkbox' ? e.target.checked : Number(e.target.value); if (playing && e.isTrusted) stopPlay(); later(); });
    root.addEventListener('click', (e) => {
      const b = e.target.closest('button');
      if (!b || !root.contains(b)) return;
      if (b.dataset.preset) { stopPlay(); Object.assign(s, d.btn[b.dataset.preset][1]); draw(); }
      else if (b.dataset.act) { stopPlay(); d.act[b.dataset.act][1](s); draw(); }
      else if ('play' in b.dataset) {
        if (playing) { stopPlay(); return; }
        const [, , min, max] = d.ctl.find((cc) => cc[0] === d.play), t0 = performance.now(), dur = reduced() ? 1 : 4200;
        if (s[d.play] >= max - 1e-9) s[d.play] = min;
        const from = s[d.play];
        b.setAttribute('aria-pressed', 'true'); b.textContent = L('暂停', 'Pause');
        const tick = (now) => { const f = Math.min(1, (now - t0) / dur); s[d.play] = from + (max - from) * f; draw(); if (f < 1 && playing) playing.raf = requestAnimationFrame(tick); else stopPlay(); };
        playing = { btn: b, raf: requestAnimationFrame(tick) };
      }
    });
    draw();
    return later;
  }

  // ── 阅读器 ──────────────────────────────────────────────────────────────
  const order = items.map((t) => t.id);
  const sel = $('#aim-select');
  sel.setAttribute('aria-label', L('选择主题', 'Choose a topic'));
  sel.innerHTML = D.parts.map((p) => `<optgroup label="${esc(`${p.num} · ${tx(p.title)}`)}">${items.filter((t) => t.part === p.id).map((t) => `<option value="${t.id}">${esc(`${label(t.id)} · ${tx(t.title)}`)}</option>`).join('')}</optgroup>`).join('');
  let current = null;
  function open(id, { scroll = false, push = true, auto = false } = {}) {
    const t = byId[id];
    if (!t) return false;
    stopPlay();
    current = id;
    const i = order.indexOf(id), prev = order[i - 1], next = order[i + 1], p = partById[t.part];
    const demoIds = isTopic(id) ? [id] : [t.demo, t.demo2].filter((x) => x && DEMOS[x]);
    const borrowed = !isTopic(id) && demoIds.some(isTopic);
    $('#aim-panel').innerHTML = `<article class="aim-topic" lang="${lang}">
      <header class="aim-topic-head"><p class="aim-crumb"><span>${p.num} · ${esc(tx(p.title))}</span><span>${isTopic(id) ? `${L('主题', 'Topic')} ${id} / 44` : label(id)}</span></p>
        <h3 id="aim-topic-h" tabindex="-1">${isTopic(id) ? `<span class="aim-topic-n">${id}</span>` : `<span class="aim-topic-n">${id}</span>`}${esc(tx(t.title))}</h3>
        <p class="aim-lead">${linkify(tx(t.lead))}</p></header>
      ${borrowed ? `<p class="aim-borrow">${demoIds.filter(isTopic).map((x) => L(`下面的演示来自主题 ${x}「${tx(byId[x].title)}」，这篇附录推导的就是它背后的公式。`, `The demo below is that of topic ${x}, “${tx(byId[x].title)}”; this appendix derives the formulas behind it.`)).join(' ')}</p>` : ''}
      ${demoIds.map((x, n) => demoHTML(x, n)).join('')}
      <h4 class="fs-sub-h">${L('核心公式', 'Key formulas')}</h4>
      <div class="fs-formulas">${t.math.map((k) => `<figure>${formula(k)}</figure>`).join('')}</div>
      <div class="aim-secs">${t.secs.map((s) => `<section><h4>${esc(tx(s.h))}</h4><p>${linkify(tx(s.p))}</p></section>`).join('')}</div>
      <p class="aim-take"><b>${L('带走一句话', 'One sentence to take away')}</b>${linkify(tx(t.take))}</p>
      <p class="aim-src"><b>${L('来源', 'Sources')}</b>${linkify(tx(t.src))}</p>
      <nav class="aim-pager" aria-label="${L('上一个和下一个主题', 'Previous and next topic')}">
        ${prev ? `<a class="button" href="${href(prev)}" data-open="${prev}"><i class="ico-ext ico-left" aria-hidden="true"></i> ${esc(`${label(prev)} · ${tx(byId[prev].title)}`)}</a>` : '<span></span>'}
        ${next ? `<a class="button primary" href="${href(next)}" data-open="${next}">${esc(`${label(next)} · ${tx(byId[next].title)}`)} <i class="ico-ext ico-right" aria-hidden="true"></i></a>` : '<span></span>'}
      </nav></article>`;
    sel.value = id;
    live = [...$('#aim-panel').querySelectorAll('.aim-demo')].map(mountDemo);
    if (push) history.replaceState(null, '', href(id));
    if (!auto) markSeen(id);
    if (scroll) $('#aim-reader').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
    return true;
  }
  sel.addEventListener('change', () => open(sel.value));
  $('#aim-prev').addEventListener('click', () => { const i = order.indexOf(current); if (i > 0) open(order[i - 1]); });
  $('#aim-next').addEventListener('click', () => { const i = order.indexOf(current); if (i < order.length - 1) open(order[i + 1]); });
  $('#aim-prev').setAttribute('aria-label', L('上一个主题', 'Previous topic'));
  $('#aim-next').setAttribute('aria-label', L('下一个主题', 'Next topic'));
  document.addEventListener('click', (e) => {
    const a = e.target.closest('a[data-open]');
    if (a) { e.preventDefault(); open(a.dataset.open, { scroll: true }); return; }
    const r = e.target.closest('a[data-ref]');
    if (r) { e.preventDefault(); showRef(r.dataset.ref); }
  });
  const redraw = () => { for (const f of live) f(); };
  if ('ResizeObserver' in window) { let w0 = 0; new ResizeObserver(() => { const w = $('#aim-panel').clientWidth; if (w !== w0) { w0 = w; redraw(); } }).observe($('#aim-panel')); }
  new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redraw);

  // ── 五条主线、阅读清单、自测 ────────────────────────────────────────────
  const tlink = (id) => `<a href="${href(id)}" data-open="${id}">${esc(`${label(id)} · ${tx(byId[id].title)}`)}</a>`;
  $('#aim-threads-list').innerHTML = D.threads.map((t) => `<li class="aim-thread"><div class="aim-thread-flow"><b>${esc(tx(t.name))}</b><i class="ico-ext ico-right" aria-hidden="true"></i><span>${esc(tx(t.mid))}</span><i class="ico-ext ico-right" aria-hidden="true"></i><span>${esc(tx(t.out))}</span></div><p>${t.topics.map(tlink).join('')}</p></li>`).join('');
  $('#aim-objects').innerHTML = D.reading.objects.map((o, i) => `<li><span>${i + 1}</span>${esc(tx(o))}</li>`).join('');
  $('#aim-rounds').innerHTML = D.reading.rounds.map(([h, list], i) => `<section class="aim-round"><h3><span>${L(`第 ${i + 1} 轮`, `Round ${i + 1}`)}</span>${esc(tx(h))}</h3>${list.map((x) => `<label class="aim-check"><input type="checkbox"><span>${esc(tx(x))}</span></label>`).join('')}</section>`).join('');
  const tally = () => { const all = document.querySelectorAll('#aim-rounds input'), on = document.querySelectorAll('#aim-rounds input:checked'); $('#aim-tally').textContent = L(`已勾 ${on.length} / ${all.length} 项`, `${on.length} of ${all.length} ticked`); };
  $('#aim-rounds').addEventListener('change', tally); tally();
  $('#aim-quiz-list').innerHTML = D.quiz.map(([q, a, id], i) => `<details><summary>${i + 1}. ${esc(tx(q))}</summary><p>${linkify(tx(a))} ${tlink(id)}</p></details>`).join('');

  // ── 核对说明 ────────────────────────────────────────────────────────────
  const AUD = [['done', '核对过的', 'Verified'], ['notDone', '没能核对的', 'Not verified'], ['changed', '和讲义不一样的地方', 'Where this page departs from the notes']];
  $('#aim-audit-body').innerHTML = AUD.map(([k, zh, e]) => `<section class="aim-audit" data-k="${k}"><h3>${L(zh, e)}</h3><ul>${D.audit[k].map((x) => `<li>${linkify(tx(x))}</li>`).join('')}</ul></section>`).join('');

  // ── 参考资料 ────────────────────────────────────────────────────────────
  const cited = {};
  for (const t of items) for (const m of `${t.src.zh} ${t.lead.zh} ${t.secs.map((s) => s.p.zh).join(' ')}`.matchAll(/\[(\d+(?:\s*,\s*\d+)*)\]/g)) for (const n of m[1].split(',')) (cited[Number(n)] ||= new Set()).add(t.id);
  const SRC = { arxiv: ['arXiv 已核对', 'checked on arXiv', 'analytic'], doi: ['DOI 已核对', 'DOI checked', 'analytic'], web: ['没能联网核对', 'not checked online', 'construct'] };
  const refLink = (r) => (r.arxiv ? `https://arxiv.org/abs/${r.arxiv}` : r.doi ? `https://doi.org/${r.doi}` : r.url);
  const filt = $('#aim-ref-filter');
  filt.innerHTML = `<button type="button" class="fs-chip" data-part="" aria-pressed="true">${L('全部', 'All')}</button>` + D.parts.filter((p) => D.refs.some((r) => r.part === p.id)).map((p) => `<button type="button" class="fs-chip" data-part="${p.id}" aria-pressed="false">${esc(tx(p.title))}</button>`).join('') + `<button type="button" class="fs-chip" data-part="preprint" aria-pressed="false">${L('近期预印本', 'Recent preprints')}</button>`;
  function renderRefs(part) {
    const list = D.refs.filter((r) => !part || (part === 'preprint' ? r.preprint : r.part === part));
    $('#aim-refs').innerHTML = list.map((r) => `<li class="fs-ref" id="ref-${r.id}"><span>${r.n ? `<b class="aim-ref-n">[${r.n}]</b> ` : ''}${esc(r.authors)} (${r.year}). <a class="fs-ref-title" href="${esc(refLink(r))}" target="_blank" rel="noopener noreferrer">${esc(r.title)} <i class="ico-ext" aria-hidden="true"></i></a>${r.venue ? `. <i>${esc(r.venue)}</i>` : ''}${r.arxiv ? `. arXiv:${r.arxiv}` : ''}.</span>
      <div class="fs-ref-meta"><span class="fs-st" data-s="${SRC[r.src][2]}">${L(SRC[r.src][0], SRC[r.src][1])}</span>${r.preprint ? `<span class="fs-st" data-s="numeric">${L('近期预印本', 'recent preprint')}</span>` : ''}${r.extra ? `<span class="fs-st" data-s="extra">${L('编者补充', 'added by the editor')}</span>` : ''}<span>${esc(tx(r.note))}</span></div>
      ${cited[r.n] ? `<p class="aim-ref-used">${L('用到它的主题：', 'Used in: ')}${[...cited[r.n]].map((id) => `<a href="${href(id)}" data-open="${id}">${label(id)}</a>`).join(' · ')}</p>` : ''}</li>`).join('');
    $('#aim-ref-count').textContent = L(`共 ${list.length} 项`, `${list.length} items`);
  }
  filt.addEventListener('click', (e) => { const b = e.target.closest('.fs-chip'); if (!b) return; for (const ch of filt.children) ch.setAttribute('aria-pressed', ch === b); renderRefs(b.dataset.part); });
  renderRefs('');
  function showRef(id) {
    if (!document.getElementById(`ref-${id}`)) { for (const ch of filt.children) ch.setAttribute('aria-pressed', ch.dataset.part === ''); renderRefs(''); }
    const el = document.getElementById(`ref-${id}`);
    if (!el) return;
    history.replaceState(null, '', `#ref-${id}`);
    el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
    el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800);
  }

  // ── 地址 ────────────────────────────────────────────────────────────────
  function route(first) {
    const m = location.hash.match(/^#([ta])-([0-9A-L]{1,2})$/);
    if (m && byId[m[2]]) { open(m[2], { push: false }); setTimeout(() => $('#aim-reader').scrollIntoView({ block: 'start' }), 80); return; }
    const r = location.hash.match(/^#ref-(.+)$/);
    if (r) setTimeout(() => showRef(r[1]), 80);
  }
  window.addEventListener('hashchange', () => route(false));
  route(true);
  if (!current) open('01', { push: false, auto: true });
  window.MOLASTRIA_AIM_READY = true;
})();
