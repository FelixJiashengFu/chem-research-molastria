/* 游乐场 15：二维波包画墙（展区二 · 量子物理）。数学在 play-wave2d-models.js（tools/play-test.mjs 测）。
   这个文件只定义 window.MOLASTRIA_PLAY_WAVE(kit)：play.js 把画图、成绩和翻译工具传进来（和 07–14 一样），
   返回的游戏共用标签、地址和成绩（molastria-play 的 wave 键：{ 关卡 id: 星数 }）。界面文字写中文，由 i18n.js 翻译。
   每帧按测得的每步耗时决定走几步（一帧最多约 12 ms 计算），慢的设备只是放得慢一些；减少动态效果时直接算完再画。 */
window.MOLASTRIA_PLAY_WAVE = (kit) => {
  'use strict';
  const W = window.MOLASTRIA_WAVE2D;
  if (!W) return {};
  const { $, $$, t, say, fit, colors, font, pct, best, save, renderBest, toRGB } = kit;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const rows = (dl, list) => dl.replaceChildren(...list.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]));
  const N = W.N, LV = W.levels, A = W.ABSORB;
  const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);

  const cv = $('#wv-cv'), msg = $('#wv-msg'), read = $('#wv-read'), goBtn = $('#wv-go'), demoBtn = $('#wv-demo'), phaseBtn = $('#wv-phase');
  const TEXT = [
    '固定的墙上有一道 32 格宽的口子，金色虚线是屏。在口子里画墙，把它分成两条（或更多）缝，让屏上出现至少 3 条亮纹；5 条两星，7 条三星。最多改 60 格。',
    '一道 6 格厚的势垒（红色）挡在路上，高度是波包动能的两倍，现在几乎什么都穿不过去。最右一列擦不掉，其余可以擦，最多擦 200 格。让至少 20% 的概率穿过去；30% 两星，34% 三星。',
    '波包向右飞，绿框是目标。用不超过 70 格墙把它送进框里：结束前（t = 110）框里的概率至少有一刻达到 30%；45% 两星，55% 三星。',
    '自由玩：随便画墙，不限格数，看波包怎样反射、衍射、干涉。',
  ];
  const LABEL = ['穿过缝的概率', '穿过势垒的概率', '框里的概率', '画面里还剩'];
  const LESSON = [
    '两条缝出来的波在屏上叠加，程差是波长的整数倍处变亮，差半个波长处相消；缝距越大，条纹越密。',
    '势垒每厚一格，穿过去的概率大约降为原来的七分之一：隧穿概率随厚度指数衰减。',
    '墙对波包像一面镜子：入射角等于反射角。斜线是一格一格的台阶，比波长细，所以还算光滑。',
  ];
  const HINT = [
    '提示：两条缝的中心离得越远，条纹越密、屏上能数到的越多；缝要窄一些，亮纹才分得开。',
    '提示：擦掉波包正前方那几十行，只留最右一列。势垒越薄，穿过去的越多。',
    '提示：在波包前方画一条从左下到右上的 45° 斜线，镜子要比波包宽。',
  ];

  let k = 0, L = LV[0], base, cells, edits = 0, tool = 'draw', phase = false, demo = false, over = false;
  let run = null, start = null, startMax = 1, playing = false, anim = 0, hist = [], msPer = 2, carry = 0, lastT = 0, lastRead = 0, stroke = null, geo = null;
  let cursor = { x: 64, y: 64 }, focused = false, wallsDirty = true, imgDirty = true, mark;
  const off = el('canvas', { width: N, height: N }), octx = off.getContext('2d'), img = octx.createImageData(N, N);
  const wallCv = el('canvas', { width: N, height: N }), wctx = wallCv.getContext('2d'), wimg = wctx.createImageData(N, N);
  const got = () => best.wave || {};
  const total = () => Object.values(got()).reduce((a, b) => a + b, 0);
  const busy = () => playing;
  const shown = () => (run ? run.s : start);

  // ── 颜色：密度 paper → info → gold（平方根压缩）；相位 0 金、+π/2 绿、π 蓝、−π/2 紫 ──
  let pal = null;
  const cssVar = (n) => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  function palette() {
    const c = colors(), vio = cssVar('--violet'), red = cssVar('--danger');
    const key = [c.paper, c.info, c.gold, c.ok, vio, red, c.ink2].join();
    if (pal && pal.key === key) return pal;
    const [p, i, g, o, v] = [c.paper, c.info, c.gold, c.ok, vio].map(toRGB), lut = new Uint8ClampedArray(256 * 3);
    const mix = (a, b, f) => a.map((x, j) => x + (b[j] - x) * f);
    for (let n = 0; n < 256; n++) { const f = n / 255, col = f < 0.5 ? mix(p, i, f * 2) : mix(i, g, f * 2 - 1); lut.set(col.map(Math.round), n * 3); }
    // 墙：紫色是玩家画的，正文色是固定的，红色是势垒（能擦的半透明）
    pal = { key, lut, paper: p, ring: [g, o, i, v], red, wall: { [W.PAINT]: v, [W.LOCK]: toRGB(c.ink2), [W.BARRIER]: toRGB(red), [W.BARRIER_LOCK]: toRGB(red) } };
    wallsDirty = imgDirty = true;
    return pal;
  }
  function paintImage() {
    const s = shown(), P = palette(), d = img.data, { re, im } = s;
    let mx = 0;
    for (let i = 0; i < re.length; i++) { const v = re[i] * re[i] + im[i] * im[i]; if (v > mx) mx = v; }
    const scale = Math.max(mx, 0.03 * startMax);
    for (let i = 0, j = 0; i < re.length; i++, j += 4) {
      const v = Math.min(1, Math.sqrt((re[i] * re[i] + im[i] * im[i]) / scale));
      if (phase) {
        const q = ((Math.atan2(im[i], re[i]) / (Math.PI / 2)) % 4 + 4) % 4, a = Math.floor(q), f = q - a, ca = P.ring[a], cb = P.ring[(a + 1) % 4];
        for (let n = 0; n < 3; n++) d[j + n] = P.paper[n] + (ca[n] + (cb[n] - ca[n]) * f - P.paper[n]) * v;
      } else { const n = Math.round(v * 255) * 3; d[j] = P.lut[n]; d[j + 1] = P.lut[n + 1]; d[j + 2] = P.lut[n + 2]; }
      d[j + 3] = 255;
    }
    octx.putImageData(img, 0, 0);
    imgDirty = false;
  }
  function paintWalls() {
    const P = palette(), d = wimg.data;
    for (let i = 0, j = 0; i < cells.length; i++, j += 4) {
      const v = cells[i], col = P.wall[v];
      if (!col) { d[j + 3] = 0; continue; }
      d[j] = col[0]; d[j + 1] = col[1]; d[j + 2] = col[2]; d[j + 3] = v === W.BARRIER ? 170 : 255;
    }
    wctx.putImageData(wimg, 0, 0);
    wallsDirty = false;
  }

  // ── 画面 ────────────────────────────────────────────────────────────
  function draw() {
    if (!cells) return;
    const narrow = !!cv.clientWidth && cv.clientWidth < 520;
    cv.dataset.ratio = narrow ? '1.4' : '0.68';
    const { ctx, w, h } = fit(cv), c = colors();
    palette();
    if (imgDirty) paintImage();
    if (wallsDirty) paintWalls();
    const G = narrow ? w : Math.min(h, w * 0.68), cs = G / N;
    geo = { G, cs, w, h };
    ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, G, G);
    ctx.imageSmoothingEnabled = false; ctx.drawImage(wallCv, 0, 0, G, G);
    ctx.strokeStyle = c.strong; ctx.lineWidth = 1; ctx.strokeRect(0.5, 0.5, G - 1, G - 1);
    // 吸收边界
    ctx.strokeStyle = c.muted; ctx.globalAlpha = 0.55; ctx.setLineDash([3, 4]); ctx.strokeRect(A * cs, A * cs, (N - 2 * A) * cs, (N - 2 * A) * cs); ctx.setLineDash([]); ctx.globalAlpha = 1;
    const g = L.goal;
    ctx.font = font(11, 600);
    if (g.type === 'fringes') {
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2; ctx.setLineDash([5, 4]);
      for (const x of g.screen) { ctx.beginPath(); ctx.moveTo(x * cs, A * cs); ctx.lineTo(x * cs, (N - A) * cs); ctx.stroke(); }
      ctx.setLineDash([]); ctx.fillStyle = c.gold; ctx.textAlign = 'center'; ctx.fillText(t('屏'), ((g.screen[0] + g.screen[1]) / 2) * cs, A * cs - 3);
    } else if (g.type === 'box') {
      const [x0, y0, x1, y1] = g.region;
      ctx.strokeStyle = c.ok; ctx.lineWidth = 2; ctx.setLineDash([6, 4]); ctx.strokeRect(x0 * cs, y0 * cs, (x1 - x0) * cs, (y1 - y0) * cs); ctx.setLineDash([]);
      ctx.fillStyle = c.ok; ctx.textAlign = 'left'; ctx.fillText(t('目标'), x0 * cs + 4, y1 * cs - 5);
    } else if (g.type === 'past') {
      ctx.fillStyle = pal.red; ctx.textAlign = 'left'; ctx.fillText('V = 2E', g.region[0] * cs + 4, A * cs + 13);
    }
    if (focused) { ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.strokeRect((cursor.x - 1) * cs, (cursor.y - 1) * cs, W.BRUSH * cs, W.BRUSH * cs); }
    // 时间
    const s = shown();
    ctx.font = font(12, 600); ctx.textAlign = 'left'; ctx.lineWidth = 3; ctx.strokeStyle = c.paper; ctx.fillStyle = c.ink;
    const label = `t = ${s.t.toFixed(1)}`;
    ctx.strokeText(label, 6, 16); ctx.fillText(label, 6, 16);
    plot(ctx, c, narrow ? { x: 40, y: G + 26, w: w - 52, h: h - G - 52, narrow } : { x: G + 52, y: 26, w: w - G - 62, h: G - 56, narrow });
  }
  // 右边（手机上是下面）的小图：双缝画屏上的累积强度，其余画目标概率随时间的变化
  function plot(ctx, c, r) {
    ctx.strokeStyle = c.strong; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
    const g = L.goal;
    if (g.type === 'fringes') {
      const I = run?.screen, f = I ? W.fringes(I, g.rows[0], g.rows[1]) : { count: 0, peaks: [] };
      const top = I ? Math.max(...I.subarray(g.rows[0], g.rows[1])) || 1 : 1;
      // 宽屏：纵轴是屏上的 y，与网格对齐；手机：横轴是 y
      const pos = (y, v) => (r.narrow ? [r.x + ((y + 0.5) / N) * r.w, r.y + r.h - (v / top) * r.h] : [r.x + (v / top) * r.w, ((y + 0.5) / N) * geo.G]);
      ctx.beginPath();
      if (r.narrow) { ctx.moveTo(r.x, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); } else { ctx.moveTo(r.x, 0); ctx.lineTo(r.x, geo.G); }
      ctx.stroke();
      if (I) {
        ctx.strokeStyle = c.gold; ctx.lineWidth = 1.8; ctx.beginPath();
        for (let y = g.rows[0]; y < g.rows[1]; y++) { const [px, py] = pos(y, I[y]); y === g.rows[0] ? ctx.moveTo(px, py) : ctx.lineTo(px, py); }
        ctx.stroke();
        ctx.fillStyle = c.ink;
        for (const y of f.peaks) { const [px, py] = pos(y, I[y]); ctx.beginPath(); ctx.arc(px, py, 3.5, 0, 7); ctx.fill(); }
      }
      ctx.fillStyle = c.ink2; ctx.font = font(11.5, 600); ctx.textAlign = 'left';
      ctx.fillText(t(`屏上的累积强度 · 亮纹 ${f.count} 条`), r.narrow ? r.x : r.x - 40, r.narrow ? r.y - 10 : 16);
      return;
    }
    const T = L.steps * L.dt, list = run ? hist : [], vmax = g.type === 'none' ? 1 : Math.max(0.6, ...list.map((p) => p[1] * 1.1));
    const X = (tt) => r.x + (tt / T) * r.w, Y = (v) => r.y + r.h - (v / vmax) * r.h;
    ctx.beginPath(); ctx.moveTo(r.x, r.y); ctx.lineTo(r.x, r.y + r.h); ctx.lineTo(r.x + r.w, r.y + r.h); ctx.stroke();
    ctx.textAlign = 'right'; ctx.fillText(`${Math.round(vmax * 100)}%`, r.x - 4, r.y + 4); ctx.fillText('0', r.x - 4, r.y + r.h + 4);
    ctx.textAlign = 'center'; ctx.fillText('0', r.x, r.y + r.h + 15); ctx.fillText(`t = ${T}`, r.x + r.w - 10, r.y + r.h + 15);
    L.stars.forEach((s, i) => {
      ctx.strokeStyle = c.line; ctx.setLineDash([4, 3]); ctx.beginPath(); ctx.moveTo(r.x, Y(s)); ctx.lineTo(r.x + r.w, Y(s)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.gold; ctx.textAlign = 'left'; ctx.font = font(10); ctx.fillText('★'.repeat(i + 1), r.x + 3, Y(s) - 3);
    });
    if (list.length > 1) {
      ctx.strokeStyle = g.type === 'box' ? c.ok : g.type === 'past' ? pal.red : c.info; ctx.lineWidth = 2; ctx.beginPath();
      list.forEach(([tt, v], i) => (i ? ctx.lineTo(X(tt), Y(v)) : ctx.moveTo(X(tt), Y(v))));
      ctx.stroke();
    }
    ctx.fillStyle = c.ink2; ctx.font = font(11.5, 600); ctx.textAlign = 'left';
    ctx.fillText(t(LABEL[k]), r.narrow ? r.x : r.x - 40, r.y - 10);
  }

  // ── 读数 ────────────────────────────────────────────────────────────
  function status() {
    const s = shown(), T = L.steps * L.dt, list = [['时间', `t = ${s.t.toFixed(1)} / ${T}`]];
    list.push(['墙格', Number.isFinite(L.budget) ? `已用 ${edits} / ${L.budget}` : `已用 ${edits}（不限）`]);
    list.push([LABEL[k], pct(run ? run.now() : L.goal.type === 'none' ? 1 : 0)]);
    if (L.goal.type === 'fringes') list.push(['屏上的亮纹（条）', String(run ? run.value() : 0)]);
    if (L.goal.type === 'box') list.push(['框里最高', pct(run ? run.value() : 0)]);
    if (L.stars.length) list.push(['成绩', `${starText(run && run.done() ? run.result().stars : 0)}（最佳 ${starText(got()[L.id] || 0)}）`]);
    rows(read, list);
    $('[data-score="wave"]').textContent = `共得 ${total()} / 9 颗星`;
  }
  const desc = (v) => (L.goal.type === 'fringes' ? `屏上数到 ${v} 条亮纹` : L.goal.type === 'past' ? `穿过势垒的概率 ${pct(v)}` : `框里的概率最高 ${pct(v)}`);

  // ── 运行 ────────────────────────────────────────────────────────────
  function setGo() { goBtn.textContent = playing ? '暂停' : run && !run.done() && run.s.steps ? '继续' : '运行'; }
  function stop() { playing = false; cancelAnimationFrame(anim); setGo(); }
  function rewind() { stop(); run = null; hist = []; imgDirty = true; }
  function go() {
    if (playing) { stop(); status(); draw(); return; }
    if (!run || run.done()) { run = W.runner(L, cells); hist = [[0, run.now()]]; imgDirty = true; }
    playing = true; carry = 0; lastT = 0; setGo();
    if (!still()) say(msg, '');
    else say(msg, '计算中…');
    anim = requestAnimationFrame(tick);
  }
  function tick(now) {
    if (!playing) return;
    const fast = still(), frame = lastT ? Math.min(100, now - lastT) : 16;
    lastT = now;
    carry = Math.min(carry + (90 * frame) / 1000, 6); // 目标约每秒 90 步
    const cap = fast ? Math.max(1, Math.floor(30 / msPer)) : Math.max(1, Math.floor(12 / msPer));
    const n = fast ? cap : Math.min(cap, Math.max(1, Math.floor(carry)));
    carry = Math.max(0, carry - n);
    const t0 = performance.now();
    let did = 0;
    for (; did < n && !run.done(); did++) { run.advance(1); hist.push([run.s.t, run.now()]); }
    if (did) { msPer = 0.8 * msPer + (0.2 * (performance.now() - t0)) / did; cv.dataset.msPerStep = msPer.toFixed(2); }
    imgDirty = true;
    if (!fast) draw();
    if (run.done()) { finish(); return; }
    if (now - lastRead > 1000) { lastRead = now; status(); }
    anim = requestAnimationFrame(tick);
  }
  function finish() {
    stop();
    const res = run.result(), st = res.stars;
    if (L.goal.type === 'none') say(msg, `跑完了。画面里还剩 ${pct(W.norm(run.s))}，其余都被四周的吸收边界吸收了。`);
    else if (demo) say(msg, `示范解法：${desc(res.value)}，${starText(st)}。看过示范的布局不计分，按“清空墙”自己画一个。`, 'ok');
    else if (st) {
      if (st > (got()[L.id] || 0)) { best.wave = { ...got(), [L.id]: st }; save(); renderBest(); mark(k); }
      say(msg, `过关！${desc(res.value)}，得 ${starText(st)}。${LESSON[k]}`, 'ok');
    } else say(msg, `${desc(res.value)}，还没过关。${HINT[k]}`, 'bad');
    imgDirty = true; status(); draw();
  }

  // ── 画墙 ────────────────────────────────────────────────────────────
  // (cx, cy) 是格点（格子的角），笔刷盖住它周围的 2×2 格
  function brush(cx, cy) {
    const v = tool === 'draw' ? W.PAINT : W.EMPTY;
    for (let y = cy - 1; y < cy + 1; y++) for (let x = cx - 1; x < cx + 1; x++) {
      if (x < 0 || y < 0 || x >= N || y >= N) continue;
      const i = y * N + x, was = cells[i];
      if (was === v || !W.editable(was)) continue;
      const d = (v !== base[i]) - (was !== base[i]);
      if (d > 0 && edits >= L.budget) { over = true; continue; }
      cells[i] = v; edits += d; wallsDirty = true;
    }
  }
  function line(a, b) { const n = Math.max(Math.abs(b.x - a.x), Math.abs(b.y - a.y), 1); for (let i = 0; i <= n; i++) brush(Math.round(a.x + ((b.x - a.x) * i) / n), Math.round(a.y + ((b.y - a.y) * i) / n)); }
  function edited() {
    const had = !!run;
    if (had) rewind();
    if (over) say(msg, `预算用完了：这一关最多改 ${L.budget} 格。擦掉一些再画。`, 'bad');
    else if (demo) say(msg, '这还是示范的布局，改了也不计分；按“清空墙”从头画。');
    else say(msg, had ? '墙改了，波包回到了起点。' : '');
    over = false; status(); draw();
  }
  function corner(e) {
    if (!geo) return null;
    const r = cv.getBoundingClientRect(), x = ((e.clientX - r.left) / r.width) * geo.w, y = ((e.clientY - r.top) / r.height) * geo.h;
    if (x < 0 || y < 0 || x > geo.G || y > geo.G) return null;
    return { x: Math.max(1, Math.min(N - 1, Math.round(x / geo.cs))), y: Math.max(1, Math.min(N - 1, Math.round(y / geo.cs))) };
  }
  function blocked() { if (!busy()) return false; say(msg, '波包正在飞：先按“暂停”，再改墙（改了以后从头开始）。'); return true; }
  function setTool(v) { tool = v; $$('#wv-tool button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.tool === v))); }

  // ── 关卡 ────────────────────────────────────────────────────────────
  function choose(i) {
    rewind();
    k = i; L = LV[i]; base = W.layout(L); cells = base.slice(); edits = 0; demo = false; wallsDirty = true;
    start = W.gaussian({ nx: N, ny: N, re: new Float64Array(N * N), im: new Float64Array(N * N), gone: new Float64Array(N * N) }, L.packet);
    startMax = 0; for (let j = 0; j < start.re.length; j++) startMax = Math.max(startMax, start.re[j] ** 2 + start.im[j] ** 2);
    $('#wv-task').textContent = TEXT[i];
    demoBtn.disabled = !L.stars.length;
    setTool(L.goal.type === 'past' ? 'erase' : 'draw');
    mark(i); say(msg, ''); status(); draw();
  }
  function levels(box, labels) {
    box.replaceChildren(...labels.map((label, i) => el('button', { type: 'button', textContent: label, onclick: () => choose(i) })));
    return (cur) => $$('button', box).forEach((b, i) => { b.setAttribute('aria-pressed', String(i === cur)); b.toggleAttribute('data-done', (got()[LV[i].id] || 0) > 0); });
  }

  return {
    wave: {
      init() {
        mark = levels($('#wv-levels'), ['第 1 关', '第 2 关', '第 3 关', '自由玩']);
        $$('#wv-tool button').forEach((b) => b.addEventListener('click', () => setTool(b.dataset.tool)));
        goBtn.addEventListener('click', go);
        $('#wv-reset').addEventListener('click', () => { rewind(); say(msg, '波包回到了起点，墙都还在。'); status(); draw(); });
        $('#wv-clear').addEventListener('click', () => { rewind(); cells = base.slice(); edits = 0; demo = false; wallsDirty = true; say(msg, '墙清空了，回到这一关的初始布局。'); status(); draw(); });
        demoBtn.addEventListener('click', () => {
          rewind(); cells = W.refCells(L); edits = W.edits(L, cells); demo = true; wallsDirty = true;
          say(msg, '这是一份示范解法，按“运行”看看。看过示范的布局不计分。'); status(); draw();
        });
        phaseBtn.addEventListener('click', () => { phase = !phase; phaseBtn.setAttribute('aria-pressed', String(phase)); imgDirty = true; draw(); });
        cv.addEventListener('pointerdown', (e) => {
          const p = corner(e);
          if (!p || blocked()) return;
          e.preventDefault(); cv.setPointerCapture(e.pointerId);
          stroke = p; brush(p.x, p.y); draw();
        });
        cv.addEventListener('pointermove', (e) => { if (!stroke) return; const p = corner(e); if (!p) return; line(stroke, p); stroke = p; draw(); });
        const end = () => { if (!stroke) return; stroke = null; edited(); };
        cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
        cv.addEventListener('focus', () => { focused = true; draw(); });
        cv.addEventListener('blur', () => { focused = false; draw(); });
        cv.addEventListener('keydown', (e) => {
          const d = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] }[e.key], n = e.shiftKey ? 4 : 1;
          if (d) { e.preventDefault(); cursor = { x: Math.max(1, Math.min(N - 1, cursor.x + d[0] * n)), y: Math.max(1, Math.min(N - 1, cursor.y + d[1] * n)) }; draw(); return; }
          if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); if (blocked()) return; brush(cursor.x, cursor.y); edited(); }
        });
        const first = LV.findIndex((x) => x.stars.length && !got()[x.id]);
        choose(first < 0 ? 0 : first);
      },
      draw, hide() { if (playing) { stop(); status(); } },
      bestText: (v) => { const n = Object.values(v || {}).reduce((a, b) => a + b, 0); return n ? `已得 ${n} / 9 颗星` : ''; },
    },
  };
};
