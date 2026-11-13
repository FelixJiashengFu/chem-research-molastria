'use strict';
// 谱图馆 · 画图和控件的小工具（sp-gens.js 和 spectra.js 都用它）。
// 图是 SVG，颜色全部走 shared-nav.css 的变量（在 spectra.css 里映射成 .sp-c0 … .sp-c5），所以换主题不用重画。
// 文字自带中英两版，按页面语言取用。
(() => {
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t == null ? '' : typeof t === 'object' ? (en ? t.en : t.zh) : String(t));
  const L = (zh, e) => (en ? e : zh);
  // 正文里的 x^{…}、pK_a、E_g 之类写成上下标
  const rich = (s) => esc(s).replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>').replace(/\^\(([^)]*)\)/g, '<sup>$1</sup>').replace(/\^([½α])/g, '<sup>$1</sup>').replace(/([A-Za-zΓγλΔσρΩωεΦκτνδημχθα])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/g, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const svgRich = (s) => esc(s).replace(/([A-Za-zΓγλΔσρΩωεΦκτνδημχθα])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/g, (_, a, b) => `${a}<tspan dy="3" font-size="82%">${b.replace(/[{}]/g, '')}</tspan><tspan dy="-3">​</tspan>`);
  // 分子式的数字写成下标（C8H10N4O2 → C₈H₁₀N₄O₂），末尾的电荷写成上标
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  const chem = (f) => String(f).replace(/([A-Za-z)\]])(\d+)/g, (_, a, n) => a + [...n].map((d) => SUB[d]).join('')).replace(/([+-]+)$/, (m) => (m.length > 1 ? `${m.length}` : '').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d]) + (m[0] === '+' ? '⁺' : '⁻'));

  const num = (v, d = 3) => {
    if (!Number.isFinite(v)) return '–';
    const a = Math.abs(v);
    if (a !== 0 && (a >= 1e5 || a < 1e-3)) { const e = Math.floor(Math.log10(a)), m = v / 10 ** e; return `${Math.abs(m - Math.round(m)) < 1e-9 && Math.abs(Math.round(m)) === 1 ? (m < 0 ? '−' : '') : `${+m.toFixed(2)} × `}10${String(e).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`; }
    return String(+v.toFixed(d)).replace('-', '−');
  };
  const fix = (v, d) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '–');

  function ticks(a, b, want = 6) {
    const span = Math.abs(b - a) || 1, raw = span / want, p = 10 ** Math.floor(Math.log10(raw)), f = raw / p;
    const step = (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p, lo = Math.min(a, b), hi = Math.max(a, b), out = [];
    for (let v = Math.ceil(lo / step - 1e-9) * step; v <= hi + step * 1e-9; v += step) out.push(Math.abs(v) < step * 1e-9 ? 0 : +v.toPrecision(12));
    return out;
  }
  function logTicks(a, b) {
    const out = [];
    for (let e = Math.ceil(Math.log10(Math.min(a, b)) - 1e-9); e <= Math.floor(Math.log10(Math.max(a, b)) + 1e-9); e++) out.push(10 ** e);
    return out;
  }
  const pow10 = (v) => { const e = Math.round(Math.log10(v)); return e >= -2 && e <= 3 ? String(+(10 ** e).toPrecision(3)) : `10${String(e).replace('-', '⁻').replace(/\d/g, (c) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[c])}`; };

  // 可见光波长 → 颜色（近似，只用来给谱线上色）
  function nmColor(nm) {
    let r = 0, g = 0, b = 0;
    if (nm >= 380 && nm < 440) { r = -(nm - 440) / 60; b = 1; } else if (nm < 490) { g = (nm - 440) / 50; b = 1; } else if (nm < 510) { g = 1; b = -(nm - 510) / 20; }
    else if (nm < 580) { r = (nm - 510) / 70; g = 1; } else if (nm < 645) { r = 1; g = -(nm - 645) / 65; } else if (nm <= 780) { r = 1; }
    const k = nm < 380 || nm > 780 ? 0 : nm < 420 ? 0.35 + (0.65 * (nm - 380)) / 40 : nm > 700 ? 0.35 + (0.65 * (780 - nm)) / 80 : 1;
    if (!k) return 'var(--muted)';
    return `rgb(${[r, g, b].map((v) => Math.round(255 * (v * k) ** 0.8)).join(' ')})`;
  }

  /**
   * 一张图。o: { x:[a,b], y:[a,b]?, rev, logx, logy, xl, yl, h, noy（不标纵轴数值）, xfmt, yfmt, zero（画 y = 0 线）,
   *   series:[{ xs, ys, c, dash, fill, w, label }], sticks:[{ x, y, c, label, tip, color, w, data }], pts:[{ x, y, c, label, r }],
   *   marks:[[x, text]], vlines:[{ x, label, c, dash }], hlines:[{ y, label, c, dash }], bands:[{ x0, x1, c, color, label, op }],
   *   texts:[{ x, y, t, anchor, c }], extra:(sx, sy, box) => svg 字符串, strip:(sx, box) => svg（画在横轴下面）}
   * 返回 { svg, meta }；meta 给悬停和点选用。
   */
  let clipId = 0;
  function plot(o) {
    const W = 720, H = o.h || 300, m = { l: o.noy ? 30 : 58, r: 16, t: o.legendTop === false ? 12 : 16, b: 42 + (o.strip ? 12 : 0) };
    const series = (o.series || []).filter((s) => s && s.xs && s.xs.length), sticks = o.sticks || [], pts = o.pts || [];
    let [x0, x1] = o.x || [Math.min(...series.flatMap((s) => [s.xs[0], s.xs[s.xs.length - 1]])), Math.max(...series.flatMap((s) => [s.xs[0], s.xs[s.xs.length - 1]]))];
    if (x0 > x1) [x0, x1] = [x1, x0];
    let y0, y1;
    if (o.y) [y0, y1] = o.y;
    else {
      let lo = Infinity, hi = -Infinity;
      for (const s of series) for (let i = 0; i < s.ys.length; i++) { const v = s.ys[i], x = s.xs[i]; if (x < x0 || x > x1 || !Number.isFinite(v) || (o.logy && v <= 0)) continue; if (v < lo) lo = v; if (v > hi) hi = v; }
      for (const s of [...sticks, ...pts]) { if (s.x < x0 || s.x > x1 || (o.logy && s.y <= 0)) continue; if (s.y > hi) hi = s.y; if (s.y < lo) lo = s.y; }
      if (!Number.isFinite(hi)) { lo = 0; hi = 1; }
      if (o.logy) { y0 = lo / 1.6; y1 = hi * 2.2; } else { if (lo > 0 || sticks.length) lo = Math.min(lo, 0); const pad = (hi - lo || 1) * (sticks.some((s) => s.label) || o.marks ? 0.2 : 0.08); y0 = lo < 0 ? lo - pad * 0.5 : 0; y1 = hi + pad; }
    }
    const fx = o.logx ? Math.log10 : (v) => v, fy = o.logy ? Math.log10 : (v) => v;
    const pw = W - m.l - m.r, ph = H - m.t - m.b, ax = fx(x0), bx = fx(x1), ay = fy(y0), by = fy(y1);
    const sx = (v) => { const u = (fx(v) - ax) / (bx - ax || 1); return m.l + pw * (o.rev ? 1 - u : u); };
    const sy = (v) => m.t + ph * (1 - (fy(Math.max(v, o.logy ? y0 : -Infinity)) - ay) / (by - ay || 1));
    const box = { l: m.l, r: W - m.r, t: m.t, b: H - m.b, w: pw, h: ph };
    const out = [];
    // 网格和刻度
    const xt = o.xticks || (o.logx ? logTicks(x0, x1) : ticks(x0, x1, 7)), yt = o.logy ? logTicks(y0, y1) : ticks(y0, y1, 5);
    const xf = o.xfmt || (o.logx ? pow10 : (v) => num(v, 4)), yf = o.yfmt || (o.logy ? pow10 : (v) => num(v, 4));
    for (const b of o.bands || []) { const a = sx(Math.max(Math.min(b.x0, x1), x0)), c = sx(Math.max(Math.min(b.x1, x1), x0)); out.push(`<rect x="${Math.min(a, c).toFixed(1)}" y="${box.t}" width="${Math.abs(c - a).toFixed(1)}" height="${box.h}" ${b.color ? `fill="${b.color}"` : `class="sp-band sp-c${b.c || 0}"`} opacity="${b.op ?? 0.14}"/>`); if (b.label) out.push(`<text class="sp-lbl" x="${((a + c) / 2).toFixed(1)}" y="${box.t + 12 + (b.row || 0) * 12}" text-anchor="middle">${svgRich(tx(b.label))}</text>`); }
    for (const v of xt) { const X = sx(v); if (X < box.l - 0.5 || X > box.r + 0.5) continue; out.push(`<line class="sp-grid" x1="${X.toFixed(1)}" x2="${X.toFixed(1)}" y1="${box.t}" y2="${box.b}"/><text class="sp-tick" x="${X.toFixed(1)}" y="${box.b + 15}" text-anchor="middle">${esc(xf(v))}</text>`); }
    if (!o.noy) for (const v of yt) { const Y = sy(v); if (Y < box.t - 0.5 || Y > box.b + 0.5) continue; out.push(`<line class="sp-grid" x1="${box.l}" x2="${box.r}" y1="${Y.toFixed(1)}" y2="${Y.toFixed(1)}"/><text class="sp-tick" x="${box.l - 6}" y="${(Y + 3.5).toFixed(1)}" text-anchor="end">${esc(yf(v))}</text>`); }
    out.push(`<rect class="sp-frame" x="${box.l}" y="${box.t}" width="${box.w}" height="${box.h}"/>`);
    if ((o.zero || y0 < 0) && !o.logy && y0 < 0 && y1 > 0) out.push(`<line class="sp-zero" x1="${box.l}" x2="${box.r}" y1="${sy(0).toFixed(1)}" y2="${sy(0).toFixed(1)}"/>`);
    if (o.xl) out.push(`<text class="sp-axis" x="${(box.l + box.w / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${svgRich(tx(o.xl))}</text>`);
    if (o.yl) out.push(`<text class="sp-axis" transform="translate(${o.noy ? 16 : 13} ${(box.t + box.h / 2).toFixed(1)}) rotate(-90)" text-anchor="middle">${svgRich(tx(o.yl))}</text>`);
    if (o.strip) out.push(o.strip(sx, box));
    const cid = `spclip${++clipId}`;
    out.push(`<clipPath id="${cid}"><rect x="${box.l - 1}" y="${box.t - 1}" width="${box.w + 2}" height="${box.h + 2}"/></clipPath><g clip-path="url(#${cid})">`);
    for (const l of o.hlines || []) { const Y = sy(l.y); out.push(`<line class="sp-vl sp-c${l.c ?? 5}" ${l.dash === false ? '' : 'stroke-dasharray="5 4"'} x1="${box.l}" x2="${box.r}" y1="${Y.toFixed(1)}" y2="${Y.toFixed(1)}"/>`); }
    for (const l of o.vlines || []) { if (l.x < x0 || l.x > x1) continue; const X = sx(l.x); out.push(`<line class="sp-vl sp-c${l.c ?? 1}" ${l.dash === false ? '' : 'stroke-dasharray="5 4"'} x1="${X.toFixed(1)}" x2="${X.toFixed(1)}" y1="${box.t}" y2="${box.b}"/>`); }
    series.forEach((s, i) => {
      const c = s.c ?? i; let d = '', pen = false;
      for (let k = 0; k < s.xs.length; k++) {
        const x = s.xs[k], y = s.ys[k];
        if (!Number.isFinite(y) || (o.logy && y <= 0) || (o.logx && x <= 0)) { pen = false; continue; }
        d += `${pen ? 'L' : 'M'}${sx(x).toFixed(1)} ${Math.max(-2000, Math.min(4000, sy(y))).toFixed(1)}`; pen = true;
      }
      if (s.fill && d) out.push(`<path class="sp-fill sp-c${c}" d="${d}L${sx(s.xs[s.xs.length - 1]).toFixed(1)} ${sy(o.logy ? y0 : 0).toFixed(1)}L${sx(s.xs[0]).toFixed(1)} ${sy(o.logy ? y0 : 0).toFixed(1)}Z"/>`);
      out.push(`<path class="sp-line sp-c${c}" ${s.dash ? 'stroke-dasharray="6 4"' : ''} ${s.w ? `stroke-width="${s.w}"` : ''} d="${d}"/>`);
    });
    const base = sy(o.logy ? y0 : Math.max(0, y0));
    for (const s of sticks) { if (s.x < x0 || s.x > x1) continue; const X = sx(s.x); out.push(`<line class="sp-stick sp-c${s.c ?? 0}${s.sel ? ' is-sel' : ''}" ${s.color ? `style="stroke:${s.color}"` : ''} ${s.w ? `stroke-width="${s.w}"` : ''} ${s.dash ? 'stroke-dasharray="3 3"' : ''} x1="${X.toFixed(1)}" x2="${X.toFixed(1)}" y1="${base.toFixed(1)}" y2="${sy(s.y).toFixed(1)}"/>`); }
    for (const p of pts) { if (p.x < x0 || p.x > x1) continue; out.push(`<circle class="sp-pt sp-c${p.c ?? 0}${p.open ? ' is-open' : ''}" cx="${sx(p.x).toFixed(1)}" cy="${sy(p.y).toFixed(1)}" r="${p.r || 3.2}"/>`); }
    if (o.extra) out.push(o.extra(sx, sy, box));
    out.push('</g>');
    // 标注：按横坐标排开，挤在一起的往上错一层
    const labels = [];
    for (const s of sticks) if (s.label && s.x >= x0 && s.x <= x1) labels.push({ X: sx(s.x), Y: sy(s.y) - 5, t: tx(s.label), c: s.c ?? 0 });
    for (const p of pts) if (p.label && p.x >= x0 && p.x <= x1) labels.push({ X: sx(p.x), Y: sy(p.y) - 8, t: tx(p.label), c: p.c ?? 0 });
    for (const [x, t, yv] of o.marks || []) {
      if (x < x0 || x > x1) continue;
      let top = yv;
      if (top == null) { top = -Infinity; const tol = Math.abs(x1 - x0) * 0.012; for (const s of series) for (let k = 0; k < s.xs.length; k++) if (Math.abs(s.xs[k] - x) <= tol && s.ys[k] > top) top = s.ys[k]; if (!Number.isFinite(top)) top = y1; }
      labels.push({ X: sx(x), Y: sy(top) - 7, t: tx(t), c: 5, tick: true });
    }
    for (const l of o.vlines || []) if (l.label && l.x >= x0 && l.x <= x1) labels.push({ X: sx(l.x), Y: box.t + 11, t: tx(l.label), c: l.c ?? 1, top: true });
    labels.sort((a, b) => a.X - b.X);
    const placed = [];
    for (const l of labels) {
      const w = [...l.t].reduce((a, ch) => a + (ch.charCodeAt(0) > 0x2e7f ? 11 : 6.2), 0);
      let Y = Math.max(box.t + 10, l.Y), tries = 0;
      const hit = () => placed.some((p) => Math.abs(p.X - l.X) < (p.w + w) / 2 + 3 && Math.abs(p.Y - Y) < 11);
      while (hit() && tries++ < 6) Y += l.top ? 11 : (Y - 11 > box.t + 8 ? -11 : 11);
      placed.push({ X: l.X, Y, w });
      const X = Math.max(box.l + w / 2 - 2, Math.min(box.r - w / 2 + 2, l.X));
      out.push(`<text class="sp-lbl sp-c${l.c}" x="${X.toFixed(1)}" y="${Y.toFixed(1)}" text-anchor="middle">${svgRich(l.t)}</text>`);
    }
    for (const t of o.texts || []) out.push(`<text class="sp-lbl sp-c${t.c ?? 5}" x="${sx(t.x).toFixed(1)}" y="${sy(t.y).toFixed(1)}" text-anchor="${t.anchor || 'middle'}">${svgRich(tx(t.t))}</text>`);
    const legend = series.filter((s) => s.label).map((s, i) => ({ c: s.c ?? series.indexOf(s), dash: s.dash, t: tx(s.label) })).concat((o.legend || []).map((l) => ({ c: l.c, dash: l.dash, t: tx(l.t), dot: l.dot })));
    const leg = legend.length ? `<ul class="sp-legend">${legend.map((l) => `<li><i class="sp-key sp-c${l.c}${l.dash ? ' is-dash' : ''}${l.dot ? ' is-dot' : ''}"></i>${rich(l.t)}</li>`).join('')}</ul>` : '';
    const svg = `<svg class="sp-plot" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tx(o.aria || o.yl || o.xl || ''))}" preserveAspectRatio="xMidYMid meet">${out.join('')}<line class="sp-cross" x1="0" x2="0" y1="${box.t}" y2="${box.b}" visibility="hidden"/><text class="sp-cur" x="${box.r - 4}" y="${box.t + 12}" text-anchor="end"></text></svg>${leg}`;
    const inv = (px) => { const u = (px - box.l) / box.w, v = ax + (bx - ax) * (o.rev ? 1 - u : u); return o.logx ? 10 ** v : v; };
    const invY = (py) => { const v = ay + (by - ay) * (1 - (py - box.t) / box.h); return o.logy ? 10 ** v : v; };
    return { svg, meta: { W, H, box, sx, sy, inv, invY, sticks: sticks.filter((s) => s.x >= x0 && s.x <= x1 && (s.tip || s.data || s.pick)), o } };
  }

  // 横向的条形图：rows [[名字, lo, hi]]，lo = hi 时画成从坐标起点到这个值的一条。
  function barChart(a) {
    const rows = a.rows, W = 720, rowH = 26, top = 8, left = 250, right = 70, H = top + rows.length * rowH + 40;
    const vals = rows.flatMap((r) => [r[1], r[2]]).concat(a.line || []);
    let lo = Math.min(...vals), hi = Math.max(...vals);
    if (a.log) { lo = 10 ** Math.floor(Math.log10(lo) - 0.01); hi = 10 ** Math.ceil(Math.log10(hi) + 0.01); } else { const pad = (hi - lo) * 0.08 || 1; lo = lo >= 0 && rows.every((r) => r[1] === r[2]) ? 0 : lo - pad; hi += pad; }
    const f = a.log ? Math.log10 : (v) => v, sx = (v) => left + ((W - left - right) * (f(v) - f(lo))) / (f(hi) - f(lo));
    const out = [];
    for (const v of a.log ? logTicks(lo, hi) : ticks(lo, hi, 6)) out.push(`<line class="sp-grid" x1="${sx(v).toFixed(1)}" x2="${sx(v).toFixed(1)}" y1="${top}" y2="${H - 40}"/><text class="sp-tick" x="${sx(v).toFixed(1)}" y="${H - 25}" text-anchor="middle">${esc(a.log ? pow10(v) : num(v, 3))}</text>`);
    rows.forEach((r, i) => {
      const y = top + i * rowH + 5, single = r[1] === r[2], x0 = single ? sx(lo) : sx(r[1]), x1 = sx(r[2]);
      out.push(`<text class="sp-rowl" x="${left - 8}" y="${y + 12}" text-anchor="end">${svgRich(tx(r[0]))}</text><rect class="sp-bar sp-c${single ? 0 : 1}" x="${Math.min(x0, x1).toFixed(1)}" y="${y}" width="${Math.max(2, Math.abs(x1 - x0)).toFixed(1)}" height="15" rx="2"/><text class="sp-lbl" x="${(x1 + 5).toFixed(1)}" y="${y + 12}">${esc(single ? num(r[1], 3) : `${num(r[1], 3)} – ${num(r[2], 3)}`)}</text>`);
    });
    for (const v of a.line || []) out.push(`<line class="sp-vl sp-c3" stroke-dasharray="5 4" x1="${sx(v).toFixed(1)}" x2="${sx(v).toFixed(1)}" y1="${top}" y2="${H - 40}"/>`);
    out.push(`<text class="sp-axis" x="${((left + W - right) / 2).toFixed(1)}" y="${H - 6}" text-anchor="middle">${svgRich(tx(a.xl))}</text>`);
    return `<svg class="sp-plot sp-bars" viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tx(a.xl))}">${out.join('')}</svg>`;
  }

  // ── 控件 ──────────────────────────────────────────────────────────────
  // 定义：{ k, type: 'range' | 'select' | 'seg' | 'checks' | 'check' | 'text' | 'num', label, … }；见各 gen 的写法。
  const ctl = {
    range: (k, label, min, max, step, v, fmt, extra) => ({ k, type: 'range', label, min, max, step, v, fmt, ...extra }),
    log: (k, label, min, max, v, fmt) => ({ k, type: 'range', label, min: Math.log10(min), max: Math.log10(max), step: 0.01, v: Math.log10(v), log: true, fmt }),
    select: (k, label, opts, v) => ({ k, type: 'select', label, opts, v: v ?? opts[0][0] }),
    seg: (k, label, opts, v) => ({ k, type: 'seg', label, opts, v: v ?? opts[0][0] }),
    checks: (k, label, opts, v) => ({ k, type: 'checks', label, opts, v: v || [] }),
    check: (k, label, v) => ({ k, type: 'check', label, v: !!v }),
    text: (k, label, v, ph) => ({ k, type: 'text', label, v, ph }),
    num: (k, label, v, step, ph) => ({ k, type: 'num', label, v, step, ph }),
  };
  let uid = 0;
  function controlHtml(c, id) {
    const lab = `<span class="sp-ctl-l">${rich(tx(c.label))}</span>`;
    if (c.type === 'range') return `<label class="sp-ctl-range">${lab}<span><input type="range" data-k="${c.k}" id="${id}" min="${c.min}" max="${c.max}" step="${c.step}" value="${c.v}"><output for="${id}"></output></span></label>`;
    if (c.type === 'select') return `<label class="sp-ctl-sel">${lab}<span><select data-k="${c.k}">${c.opts.map(([v, t]) => `<option value="${esc(v)}"${String(v) === String(c.v) ? ' selected' : ''}>${esc(tx(t))}</option>`).join('')}</select></span></label>`;
    if (c.type === 'seg') return `<div class="sp-ctl-seg" role="group" aria-label="${esc(tx(c.label))}">${c.label ? lab : ''}<span class="fs-btns">${c.opts.map(([v, t]) => `<button type="button" class="button" data-k="${c.k}" data-v="${esc(v)}" aria-pressed="${String(v) === String(c.v)}">${rich(tx(t))}</button>`).join('')}</span></div>`;
    if (c.type === 'checks') return `<div class="sp-ctl-seg sp-ctl-checks" role="group" aria-label="${esc(tx(c.label))}">${lab}<span class="fs-btns">${c.opts.map(([v, t]) => `<button type="button" class="button" data-k="${c.k}" data-v="${esc(v)}" data-multi aria-pressed="${c.v.includes(v)}">${rich(tx(t))}</button>`).join('')}</span></div>`;
    if (c.type === 'check') return `<label class="sp-ctl-check"><input type="checkbox" data-k="${c.k}"${c.v ? ' checked' : ''}> ${rich(tx(c.label))}</label>`;
    return `<label class="sp-ctl-text">${lab}<span><input type="${c.type === 'num' ? 'number' : 'text'}" data-k="${c.k}" value="${esc(c.v ?? '')}" ${c.step ? `step="${c.step}"` : ''} ${c.type === 'num' ? 'inputmode="decimal"' : 'spellcheck="false" autocapitalize="off" autocomplete="off"'} placeholder="${esc(tx(c.ph) || '')}"></span></label>`;
  }

  /**
   * 把一个“视图”装进 host。view: { ctl:[控件], draw(s, api) → { plots:[plot 的参数 | { html }], out:[[名字, 值]], html, note }, pick?(stick, s, api) }。
   * s 是当前的参数；api.set(patch) 改参数并重画。
   */
  function mount(host, view) {
    const s = {}, defs = view.ctl || [], id0 = `spc${++uid}`;
    for (const c of defs) s[c.k] = c.log ? 10 ** c.v : c.v;
    host.innerHTML = `${defs.length ? `<div class="sp-ctl fs-controls">${defs.map((c, i) => controlHtml(c, `${id0}-${i}`)).join('')}</div>` : ''}<div class="sp-plots"></div><dl class="fs-readout sp-out" aria-live="polite"></dl><div class="sp-extra"></div>`;
    const plotsEl = host.querySelector('.sp-plots'), outEl = host.querySelector('.sp-out'), extraEl = host.querySelector('.sp-extra');
    const sync = () => {
      for (const c of defs) {
        if (c.type === 'range') { const el = host.querySelector(`input[data-k="${c.k}"]`); el.value = c.log ? Math.log10(s[c.k]) : s[c.k]; el.nextElementSibling.textContent = c.fmt ? c.fmt(s[c.k], s) : num(s[c.k], 3); }
        else if (c.type === 'seg') for (const b of host.querySelectorAll(`button[data-k="${c.k}"]`)) b.setAttribute('aria-pressed', String(b.dataset.v) === String(s[c.k]));
        else if (c.type === 'checks') for (const b of host.querySelectorAll(`button[data-k="${c.k}"]`)) b.setAttribute('aria-pressed', s[c.k].includes(b.dataset.v));
        else if (c.type === 'select') host.querySelector(`select[data-k="${c.k}"]`).value = s[c.k];
        else if (c.type === 'check') host.querySelector(`input[data-k="${c.k}"]`).checked = !!s[c.k];
        else if (document.activeElement !== host.querySelector(`input[data-k="${c.k}"]`)) host.querySelector(`input[data-k="${c.k}"]`).value = s[c.k] ?? '';
        const wrap = host.querySelector(`[data-k="${c.k}"]`).closest('label, .sp-ctl-seg');
        if (c.show) wrap.hidden = !c.show(s);
      }
    };
    const api = { set(patch) { Object.assign(s, patch); redraw(); }, host };
    function redraw() {
      sync();
      let r;
      try { r = view.draw(s, api) || {}; } catch (err) { r = { out: [[L('没法画', 'Cannot draw'), String(err.message || err)]], error: true }; }
      const list = r.plots || [];
      while (plotsEl.children.length > list.length) plotsEl.lastElementChild.remove();
      list.forEach((p, i) => {
        let el = plotsEl.children[i];
        if (!el) { el = document.createElement('div'); el.className = 'sp-plot-host'; plotsEl.append(el); }
        if (p.html != null) { el.innerHTML = p.html; el._sp = null; } else { const g = plot(p); el.innerHTML = (p.title ? `<p class="sp-plot-t">${rich(tx(p.title))}</p>` : '') + g.svg; el._sp = g.meta; el._pick = view.pick ? (st) => view.pick(st, s, api) : null; }
      });
      if (!r.error || !plotsEl.children.length || r.plots) { /* keep */ }
      outEl.innerHTML = (r.out || []).map(([k, v]) => `<div><dt>${rich(tx(k))}</dt><dd>${typeof v === 'object' && v && v.html ? v.html : rich(tx(v))}</dd></div>`).join('');
      outEl.hidden = !(r.out || []).length;
      extraEl.innerHTML = (r.html || '') + (r.note ? `<p class="sp-note">${rich(tx(r.note))}</p>` : '');
    }
    host.addEventListener('input', (e) => {
      const el = e.target, c = defs.find((d) => d.k === el.dataset.k);
      if (!c) return;
      if (c.type === 'range') s[c.k] = c.log ? 10 ** +el.value : +el.value;
      else if (c.type === 'check') s[c.k] = el.checked;
      else if (c.type === 'select') s[c.k] = el.value;
      else if (c.type === 'num') s[c.k] = el.value === '' ? null : +el.value;
      else return; // 文本框等回车或失去焦点
      if (c.apply) Object.assign(s, c.apply(s[c.k], s) || {});
      redraw();
    });
    host.addEventListener('change', (e) => {
      const el = e.target, c = defs.find((d) => d.k === el.dataset.k);
      if (!c || c.type !== 'text') return;
      s[c.k] = el.value.trim(); if (c.apply) Object.assign(s, c.apply(s[c.k], s) || {}); redraw();
    });
    host.addEventListener('keydown', (e) => { if (e.key === 'Enter' && e.target.matches('input[type=text]')) e.target.dispatchEvent(new Event('change', { bubbles: true })); });
    host.addEventListener('click', (e) => {
      const b = e.target.closest('button[data-k]');
      if (!b || !host.contains(b)) return;
      const c = defs.find((d) => d.k === b.dataset.k);
      if (!c) return;
      if (c.type === 'checks') { const v = b.dataset.v, cur = s[c.k]; s[c.k] = cur.includes(v) ? cur.filter((x) => x !== v) : [...cur, v]; }
      else { const raw = b.dataset.v, hit = c.opts.find(([v]) => String(v) === raw); s[c.k] = hit ? hit[0] : raw; }
      if (c.apply) Object.assign(s, c.apply(s[c.k], s) || {});
      redraw();
    });
    redraw();
    return api;
  }

  // 悬停读数和点选：整页只挂一次
  const nearest = (meta, px) => { let best = null, d = 14; for (const st of meta.sticks) { const dd = Math.abs(meta.sx(st.x) - px); if (dd < d || (dd === d && best && st.y > best.y)) { d = dd; best = st; } } return best; };
  const local = (svg, e) => { const r = svg.getBoundingClientRect(), vb = svg.viewBox.baseVal; return { x: ((e.clientX - r.left) / r.width) * vb.width, y: ((e.clientY - r.top) / r.height) * vb.height }; };
  document.addEventListener('pointermove', (e) => {
    const svg = e.target.closest && e.target.closest('svg.sp-plot'), host = svg && svg.parentElement, meta = host && host._sp;
    if (!meta) return;
    const p = local(svg, e), cross = svg.querySelector('.sp-cross'), cur = svg.querySelector('.sp-cur');
    if (p.x < meta.box.l || p.x > meta.box.r || p.y < meta.box.t || p.y > meta.box.b) { cross.setAttribute('visibility', 'hidden'); cur.textContent = ''; return; }
    const st = nearest(meta, p.x), X = st ? meta.sx(st.x) : p.x;
    cross.setAttribute('x1', X); cross.setAttribute('x2', X); cross.setAttribute('visibility', 'visible');
    const o = meta.o, xf = o.curfmt || ((v) => num(v, Math.abs(meta.inv(meta.box.r) - meta.inv(meta.box.l)) < 5 ? 4 : 2));
    cur.textContent = st && st.tip ? tx(st.tip) : `${xf(meta.inv(p.x))}${o.noy ? '' : `, ${num(meta.invY(p.y), 3)}`}`;
    svg.style.cursor = st && host._pick ? 'pointer' : '';
  });
  document.addEventListener('pointerleave', (e) => { const svg = e.target.closest && e.target.closest('svg.sp-plot'); if (svg) { svg.querySelector('.sp-cross')?.setAttribute('visibility', 'hidden'); const c = svg.querySelector('.sp-cur'); if (c) c.textContent = ''; } }, true);
  document.addEventListener('click', (e) => {
    const svg = e.target.closest && e.target.closest('svg.sp-plot'), host = svg && svg.parentElement, meta = host && host._sp;
    if (!meta || !host._pick) return;
    const st = nearest(meta, local(svg, e).x);
    if (st) host._pick(st);
  });

  window.MOLASTRIA_SPECTRA_KIT = { en, lang, esc, tx, L, rich, svgRich, chem, num, fix, ticks, logTicks, pow10, nmColor, plot, barChart, ctl, mount };
})();
