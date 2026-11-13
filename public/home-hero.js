/* Home hero (home-hero.css has the look). The right half of the first screen is a book of figures, one per section of
   the site: each plate is a real plot (axes, ticks, a caption) computed here from the formulas in home-figs-models.js,
   with a question for a headline and a link into the section it comes from. This script:
   - draws the current figure on one canvas (a requestAnimationFrame loop that stops when the plate is off screen, the
     tab is hidden, or the visitor asked for reduced motion; then one still frame is drawn);
   - turns the page every DWELL seconds (the old page is copied onto a leaf that swings shut on the spine), or when a
     chip on the belt, the arrows, or ← → ask for another plate; the belt under the plate runs on its own (CSS);
   - fills the bar from a quick keyword, and counts the four figures under the hero up when they come into view.
   The words are written here in both languages (the plate is translate="no"): a figure's labels are drawn, not text.
   Colours come from the --st-* variables on .stage, so the plates follow the light and the dark theme. */
(() => {
  'use strict';
  const hero = document.getElementById('hero'), stage = document.getElementById('hero-stage'), M = window.MOLASTRIA_HOME_FIGS;
  const input = document.getElementById('intro-q');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const en = document.documentElement.lang === 'en', tx = (zh, e) => (en ? e : zh);
  const fmt = (n) => Math.round(n).toLocaleString('zh-CN');
  const TAU = Math.PI * 2, clamp = (x, a = 0, b = 1) => Math.min(b, Math.max(a, x)), ease = (x) => { x = clamp(x); return x * x * (3 - 2 * x); };
  const DWELL = 9;

  // A quick keyword: app.js runs the search (its [data-query] handler); here the bar shows the word.
  hero?.querySelector('.hero-try')?.addEventListener('click', (e) => { const b = e.target.closest('[data-query]'); if (b && input) input.value = b.dataset.query; });

  // The four figures under the hero count up once, when they first come into view. If they were already on screen
  // for a while (a slow connection: the script arrives late), they stay as they are.
  const rolling = new WeakMap();
  function roll(el, to, ms = 650) {
    const from = +el.dataset.n || 0; el.dataset.n = to;
    cancelAnimationFrame(rolling.get(el));
    if (reduce.matches || from === to || document.hidden) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (now) => { const u = Math.min(1, (now - t0) / ms), v = from + (to - from) * (1 - Math.pow(1 - u, 4)); el.textContent = fmt(v); if (u < 1) rolling.set(el, requestAnimationFrame(step)); };
    rolling.set(el, requestAnimationFrame(step));
  }
  const figures = [...document.querySelectorAll('.metrics strong')];
  if (figures.length && 'IntersectionObserver' in window && !reduce.matches) {
    const late = performance.now() > 1800;
    const io = new IntersectionObserver((es, o) => {
      for (const e of es) {
        if (!e.isIntersecting) { e.target.dataset.away = '1'; continue; }
        o.unobserve(e.target);
        const el = e.target, to = +el.textContent.replace(/[^\d]/g, '');
        if (!to || (late && !el.dataset.away)) continue;
        el.dataset.n = 0; roll(el, to, 1400);
      }
    }, { threshold: 0.6 });
    addEventListener('DOMContentLoaded', () => figures.forEach((f) => io.observe(f))); // after app.js has written the real figures
  }

  if (!stage || !M) return;
  const plate = document.getElementById('st-plate'), page = document.getElementById('st-page'), canvas = document.getElementById('st-fig'), g = canvas.getContext('2d');
  const $no = document.getElementById('st-no'), $of = document.getElementById('st-of'), $sec = document.getElementById('st-sec'), $q = document.getElementById('st-q'), $cap = document.getElementById('st-cap'), $go = document.getElementById('st-go'), foot = page.querySelector('.st-foot');
  const track = stage.querySelector('.st-track');

  // ── drawing kit ──
  let P = null, W = 600, H = 384, cache = new Map();
  const MONO = 'ui-monospace,"SFMono-Regular",Menlo,Consolas,"PingFang SC","Microsoft YaHei",monospace';
  const rgb = (hex) => { hex = hex.trim().replace('#', ''); return [0, 2, 4].map((i) => parseInt(hex.slice(i, i + 2), 16)); };
  function palette() {
    const s = getComputedStyle(stage), v = (n) => s.getPropertyValue(n).trim();
    P = { bg: v('--st-bg'), ink: v('--st-ink'), dim: v('--st-dim'), grid: v('--st-grid'), frame: v('--st-frame'), green: v('--st-green'), gold: v('--st-gold'), map: [0, 1, 2, 3, 4].map((i) => rgb(v('--st-m' + i))) };
    P.key = P.bg + P.ink; P.greenRgb = rgb(P.green).join(',');
  }
  const STOPS = [0, 0.2, 0.48, 0.76, 1];
  const colour = (x) => { x = clamp(x); let i = 1; while (x > STOPS[i]) i++; const u = (x - STOPS[i - 1]) / (STOPS[i] - STOPS[i - 1]), a = P.map[i - 1], b = P.map[i]; return [a[0] + (b[0] - a[0]) * u, a[1] + (b[1] - a[1]) * u, a[2] + (b[2] - a[2]) * u]; };
  const memo = (key, make) => { key += '|' + P.key; if (!cache.has(key)) cache.set(key, make()); return cache.get(key); };
  const text = (s, x, y, o = {}) => { g.font = `${o.w || 400} ${o.size || 10.5}px ${MONO}`; g.textAlign = o.align || 'left'; g.fillStyle = o.color || P.dim; g.fillText(s, x, y); };
  const vtext = (s, x, y, o = {}) => { g.save(); g.translate(x, y); g.rotate(-Math.PI / 2); text(s, 0, 0, { ...o, align: 'center' }); g.restore(); };
  const box = (l = 52, r = 16, t = 14, b = 40) => ({ x0: l, y0: t, x1: W - r, y1: H - b, w: W - r - l, h: H - b - t });
  const frame = (b) => { g.strokeStyle = P.frame; g.lineWidth = 1; g.strokeRect(Math.round(b.x0) + 0.5, Math.round(b.y0) + 0.5, Math.round(b.w), Math.round(b.h)); };
  const xticks = (b, ticks, X, label, f = String) => { for (const v of ticks) { const x = Math.round(X(v)); g.fillStyle = P.frame; g.fillRect(x, b.y1, 1, 5); text(f(v), x, b.y1 + 17, { align: 'center' }); } if (label) text(label, (b.x0 + b.x1) / 2, b.y1 + 33, { align: 'center' }); };
  const yticks = (b, ticks, Y, label, f = String) => { for (const v of ticks) { const y = Math.round(Y(v)); g.fillStyle = P.frame; g.fillRect(b.x0 - 5, y, 5, 1); text(f(v), b.x0 - 9, y + 3.5, { align: 'right' }); } if (label) vtext(label, 14, (b.y0 + b.y1) / 2); };
  const gridX = (b, ticks, X) => { g.fillStyle = P.grid; for (const v of ticks) g.fillRect(Math.round(X(v)), b.y0, 1, b.h); };
  const gridY = (b, ticks, Y) => { g.fillStyle = P.grid; for (const v of ticks) g.fillRect(b.x0, Math.round(Y(v)), b.w, 1); };
  const fillTo = (b) => { const gr = g.createLinearGradient(0, b.y0, 0, b.y1); gr.addColorStop(0, `rgba(${P.greenRgb},.7)`); gr.addColorStop(1, `rgba(${P.greenRgb},.05)`); return gr; };
  // A curve y(x) across the box, filled down to the baseline and stroked in ink.
  function curve(b, f, { fill = true, stroke = P.ink, width = 1.8, from = b.x0, to = b.x1, step = 1, base = b.y1 } = {}) {
    g.beginPath(); for (let x = from; x <= to; x += step) g[x === from ? 'moveTo' : 'lineTo'](x, f(x));
    if (fill) { g.save(); g.lineTo(to, base); g.lineTo(from, base); g.closePath(); g.fillStyle = fillTo(b); g.fill(); g.restore(); g.beginPath(); for (let x = from; x <= to; x += step) g[x === from ? 'moveTo' : 'lineTo'](x, f(x)); }
    g.strokeStyle = stroke; g.lineWidth = width; g.lineJoin = 'round'; g.stroke();
  }
  // A scalar field on a square, painted through the colour map (bands > 0: filled contours).
  const field = (key, N, f, bands = 0) => memo(key, () => {
    const c = document.createElement('canvas'); c.width = c.height = N; const x = c.getContext('2d'), img = x.createImageData(N, N), v = new Float32Array(N * N); let max = 0;
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) { const q = f((i + 0.5) / N * 2 - 1, 1 - (j + 0.5) / N * 2); v[j * N + i] = q; if (q > max) max = q; }
    for (let p = 0; p < N * N; p++) { let u = v[p] / max; if (bands) u = Math.min(1, Math.floor(u * bands + 0.35) / bands); const [r, gg, b] = colour(u); img.data[4 * p] = r; img.data[4 * p + 1] = gg; img.data[4 * p + 2] = b; img.data[4 * p + 3] = 255; }
    x.putImageData(img, 0, 0); return c;
  });
  // The square plot with a colour bar and a column of notes to its right: shared by the two density plates.
  function square(R, ticks, labels, bar) {
    const side = Math.min(H - 20 - 40, W - 52 - 136), b = { x0: 52, y0: 20, x1: 52 + side, y1: 20 + side, w: side, h: side };
    const X = (v) => b.x0 + (v + R) / (2 * R) * side, Y = (v) => b.y0 + (R - v) / (2 * R) * side, bx = b.x1 + 22;
    return {
      b, X, Y, nx: bx + 46,
      paint(img, alpha = 1) { g.save(); g.globalAlpha *= alpha; g.imageSmoothingQuality = 'high'; g.drawImage(img, b.x0, b.y0, side, side); g.restore(); },
      axes() {
        frame(b); xticks(b, ticks, X, labels[0]); yticks(b, ticks, Y, labels[1]);
        const bar_ = memo('bar', () => { const c = document.createElement('canvas'); c.width = 1; c.height = 256; const x = c.getContext('2d'); for (let i = 0; i < 256; i++) { const [r, gg, bb] = colour(1 - i / 255); x.fillStyle = `rgb(${r | 0},${gg | 0},${bb | 0})`; x.fillRect(0, i, 1, 1); } return c; });
        g.imageSmoothingEnabled = true; g.drawImage(bar_, bx, b.y0, 12, side); frame({ x0: bx, y0: b.y0, w: 12, h: side });
        text('max', bx + 6, b.y0 - 4, { align: 'center', size: 9.5 }); text('0', bx + 6, b.y1 + 13, { align: 'center', size: 9.5 }); vtext(bar, bx + 25, b.y0 + side / 2);
      },
    };
  }

  // ── the plates. draw(t): t = seconds since the page was turned to it; still: the moment shown without motion. ──
  const FIGS = [
    { id: 'ir', href: 'spectra/index.html', sec: ['谱图馆', 'Spectra Hall'], q: ['一张谱图，怎么读出一个分子？', 'How does one spectrum give a molecule away?'],
      cap: ['乙醇、丙酮、乙酸的红外谱：B3LYP/def2-SVPD 谐振频率（未标度），PySCF 计算。每个峰是一种键的振动。', 'Infrared spectra of ethanol, acetone and acetic acid: B3LYP/def2-SVPD harmonic frequencies (unscaled), computed with PySCF. Each band is one kind of bond vibrating.'],
      still: 2.6, draw(t) {
        const names = [['ethanol', '乙醇', 'ethanol'], ['acetone', '丙酮', 'acetone'], ['aceticacid', '乙酸', 'acetic acid']], k = Math.floor(t / 3) % 3, u = t % 3, mol = M.IR[names[k][0]];
        const b = box(), X = (nu) => b.x0 + (4000 - nu) / 3550 * b.w, top = Math.max(...mol.modes.map((m) => m[1])) * 1.02, Y = (a) => b.y1 - a / top * (b.h - 34);
        gridX(b, [3500, 3000, 2500, 2000, 1500, 1000], X);
        const scan = b.x0 + b.w * ease(u / 1.3), out = 1 - ease((u - 2.7) / 0.3);
        g.save(); g.globalAlpha = out; g.beginPath(); g.rect(b.x0, b.y0, scan - b.x0, b.h); g.clip();
        curve(b, (x) => Y(M.lorentz(mol.modes, 4000 - (x - b.x0) / b.w * 3550))); g.restore();
        if (u < 1.3) { g.fillStyle = P.gold; g.fillRect(scan, b.y0, 1.5, b.h); }
        g.save(); g.globalAlpha = out * ease((u - 1.2) / 0.4);
        for (const [nu, lab] of mol.bands) { const y = Math.min(...[-120, -90, -60, -30, -15, 0, 15, 30, 60, 90, 120].map((d) => Y(M.lorentz(mol.modes, nu + d)))) - 8; text(String(nu), X(nu), y - 13, { align: 'center', color: P.gold }); text(lab, X(nu), y, { align: 'center', color: P.ink }); }
        g.restore();
        g.save(); g.globalAlpha = out * ease(u / 0.4); text(tx(names[k][1], names[k][2]) + '  ' + mol.formula, X(3480), b.y0 + 18, { color: P.ink, size: 12 }); g.restore();
        frame(b); xticks(b, [4000, 3500, 3000, 2500, 2000, 1500, 1000, 500], X, tx('波数 / cm⁻¹', 'wavenumber / cm⁻¹')); vtext(tx('红外强度', 'IR intensity'), 14, (b.y0 + b.y1) / 2);
      } },
    { id: 'benzene', href: 'chemistry/organic/index.html', sec: ['化学学科馆 · 有机化学', 'Chemistry Halls · Organic'], q: ['苯环上的六个 π 电子，属于哪个碳？', 'Which carbon owns benzene’s six π electrons?'],
      cap: ['苯的三个占据 π 轨道和它们加起来的电子密度（Hückel 分子轨道，环平面上方 0.8 a₀）。加起来以后，六个碳一模一样。', 'Benzene’s three occupied π orbitals and the density they add up to (Hückel orbitals, 0.8 a₀ above the ring). Summed, all six carbons are alike.'],
      still: 7.6, draw(t) {
        const R = 5.4, s = square(R, [-4, -2, 0, 2, 4], ['x / a₀', 'y / a₀'], tx('密度', 'density')), k = Math.floor(t / 2.2) % 4, u = t % 2.2, z = 0.8;
        const img = (i) => field('bz' + i, 240, (x, y) => (i < 3 ? M.benzeneMO(i, x * R, y * R, z) ** 2 : M.benzeneDensity(x * R, y * R, z)), 9);
        s.paint(img((k + 3) % 4)); s.paint(img(k), ease(u / 0.6));
        g.strokeStyle = P.ink; g.globalAlpha = 0.55; g.lineWidth = 1.2; g.beginPath(); M.RING.forEach(([x, y], i) => g[i ? 'lineTo' : 'moveTo'](s.X(x), s.Y(y))); g.closePath(); g.stroke(); g.globalAlpha = 1;
        g.fillStyle = P.ink; for (const [x, y] of M.RING) { g.beginPath(); g.arc(s.X(x), s.Y(y), 2.4, 0, TAU); g.fill(); }
        s.axes();
        const rows = [['ψ₁', 'E = α + 2β'], ['ψ₂', 'E = α + β'], ['ψ₃', 'E = α + β'], ['ρ', '= 2 Σ |ψᵢ|²']];
        rows.forEach(([a, e], i) => { const y = s.b.y0 + 54 + i * 34, on = i === k; if (on) { g.fillStyle = P.gold; g.fillRect(s.nx - 9, y - 11, 3, 28); } text(a, s.nx, y, { color: on ? P.ink : P.dim, size: 13, w: on ? 700 : 400 }); text(e, s.nx, y + 14, { color: on ? P.ink : P.dim, size: 9.5 }); });
      } },
    { id: 'hydrogen', href: 'quantum/physics/index.html', sec: ['量子嘉年华 · 量子物理', 'Quantum Carnival · Physics'], q: ['电子不在轨道上，那它到底在哪？', 'If the electron is not on an orbit, where is it?'],
      cap: ['氢原子几个定态的波函数大小 |ψ|（xz 截面，m = 0），由解析式现算。越亮的地方，越容易找到电子。', 'The size of the wavefunction |ψ| for a few stationary states of hydrogen (xz section, m = 0), from the closed form. The brighter, the likelier the electron.'],
      still: 5, draw(t) {
        const S = [[1, 0, 6, '1s'], [2, 1, 14, '2p'], [3, 1, 24, '3p'], [3, 2, 20, '3d'], [4, 3, 32, '4f']], k = Math.floor(t / 1.8) % 5, u = t % 1.8, [n, l, R, name] = S[k];
        const tick = R <= 6 ? 2 : R <= 14 ? 5 : 10, ticks = []; for (let v = -Math.floor(R / tick) * tick; v <= R; v += tick) ticks.push(v);
        const s = square(R, ticks, ['x / a₀', 'z / a₀'], '|ψ|');
        const img = (i) => { const [n_, l_, R_] = S[i]; return field('h' + i, 220, (x, z) => { const r = Math.hypot(x, z) * R_ || 1e-9; return Math.abs(M.hydrogen(n_, l_, r, z * R_ / r)); }); };
        s.paint(img((k + 4) % 5)); s.paint(img(k), ease(u / 0.5)); s.axes();
        text(name, s.nx, s.b.y0 + 62, { color: P.ink, size: 20, w: 600 });
        text('n = ' + n, s.nx, s.b.y0 + 90, { color: P.ink, size: 12 }); text('l = ' + l, s.nx, s.b.y0 + 108, { color: P.ink, size: 12 }); text('m = 0', s.nx, s.b.y0 + 126, { color: P.ink, size: 12 });
        text('E = ' + M.hydrogenE(n).toFixed(2).replace('-', '−'), s.nx, s.b.y0 + 152, { size: 10.5 }); text('eV', s.nx + 26, s.b.y0 + 166, { size: 10.5 });
      } },
    { id: 'diffusion', href: 'ai-math/index.html', sec: ['前沿 AI 数学', 'Frontier AI Maths'], q: ['一团噪声，凭什么能变回有结构的数据？', 'How does pure noise find its way back to data?'],
      cap: ['500 个样本沿概率流 ODE 从高斯噪声走回数据分布（八个高斯），分数函数用解析式。扩散模型学的就是这个方向场。', '500 samples follow the probability-flow ODE from Gaussian noise back to the data (eight Gaussians), with the exact score. This field of directions is what a diffusion model learns.'],
      still: 8, draw(t) {
        const F = memo('flow', () => M.reverseFlow(500)), last = F.frames.length - 1, u = clamp((t - 0.7) / 4.8), fi = u * last, i0 = Math.floor(fi), i1 = Math.min(last, i0 + 1), w = fi - i0;
        const R = 3.6, side = Math.min(H - 20 - 40, W - 52 - 136), b = { x0: 52, y0: 20, x1: 52 + side, y1: 20 + side, w: side, h: side }, X = (v) => b.x0 + (v + R) / (2 * R) * side, Y = (v) => b.y0 + (R - v) / (2 * R) * side;
        gridX(b, [-2, 0, 2], X); gridY(b, [-2, 0, 2], Y);
        g.strokeStyle = P.gold; g.lineWidth = 1.2; for (const [mx, my] of M.MODES) { g.beginPath(); g.arc(X(mx), Y(my), 3 * M.S0 * side / (2 * R) + 3, 0, TAU); g.stroke(); }
        g.save(); g.beginPath(); g.rect(b.x0, b.y0, side, side); g.clip(); g.fillStyle = P.ink; g.globalAlpha = 0.82 * (1 - ease((t - 8.6) / 0.4));
        const A = F.frames[i0], B = F.frames[i1]; for (let i = 0; i < 500; i++) { g.beginPath(); g.arc(X(A[2 * i] + (B[2 * i] - A[2 * i]) * w), Y(A[2 * i + 1] + (B[2 * i + 1] - A[2 * i + 1]) * w), 1.5, 0, TAU); g.fill(); }
        g.restore(); frame(b); xticks(b, [-2, 0, 2], X, 'x₁'); yticks(b, [-2, 0, 2], Y, 'x₂');
        const tt = F.ts[i0] + (F.ts[i1] - F.ts[i0]) * w, a = M.alpha(tt), nx = b.x1 + 26, bw = Math.min(84, W - nx - 14);
        text('t = ' + tt.toFixed(2), nx, b.y0 + 30, { color: P.ink, size: 15, w: 600 });
        const bar = (y, lab, v, col) => { text(lab, nx, y, { size: 10 }); g.fillStyle = P.grid; g.fillRect(nx, y + 7, bw, 8); g.fillStyle = col; g.fillRect(nx, y + 7, bw * v, 8); };
        bar(b.y0 + 62, tx('信号 α', 'signal α'), a, P.green); bar(b.y0 + 104, tx('噪声 σ', 'noise σ'), Math.sqrt(1 - a * a), P.gold);
        text('N = 500', nx, b.y0 + 160); text(tx('○ 数据的八个峰', '○ the 8 modes'), nx, b.y0 + 178, { color: P.gold, size: 10 });
      } },
    { id: 'nmr', href: 'nmr/index.html', sec: ['核磁共振', 'NMR'], q: ['一段衰减的信号，怎么变成一张谱？', 'How does a fading signal become a spectrum?'],
      cap: ['乙醇的 ¹H 谱（60 MHz）。上面是采到的 FID，下面是它的傅里叶变换：采得越久，谱线越窄，三重峰和四重峰才分得开。', 'The ¹H spectrum of ethanol at 60 MHz. Above, the FID as it is acquired; below, its Fourier transform: the longer the acquisition, the narrower the lines, until the triplet and quartet resolve.'],
      still: 8, draw(t) {
        const TMAX = 1.5, tacq = TMAX * clamp(t / 6, 0.02, 1), b = box(), mid = b.y0 + b.h * 0.36, top = { x0: b.x0, y0: b.y0, x1: b.x1, y1: mid, w: b.w, h: mid - b.y0 };
        const Xt = (s) => b.x0 + s / TMAX * b.w, Yf = (v) => (b.y0 + mid) / 2 - v / 6.4 * (top.h / 2);
        g.strokeStyle = P.ink; g.lineWidth = 1; g.beginPath(); const xe = Xt(tacq); for (let x = b.x0; x <= xe; x += 0.4) g[x === b.x0 ? 'moveTo' : 'lineTo'](x, Yf(M.fid((x - b.x0) / b.w * TMAX))); g.stroke();
        if (tacq < TMAX) { g.fillStyle = P.gold; g.fillRect(xe, b.y0, 1.5, top.h); }
        text('FID', b.x0 + b.w * 0.5, b.y0 + 15, { color: P.ink }); text(tx('已采样 ', 'acquired ') + tacq.toFixed(2) + ' s', b.x0 + b.w * 0.5 + 30, b.y0 + 15, { color: P.gold });
        for (const s of [0.5, 1]) text(s.toFixed(1) + ' s', Xt(s), mid - 5, { align: 'center', size: 9.5 });
        const lo = 0.4, hi = 4.4, Xp = (ppm) => b.x0 + (hi - ppm) / (hi - lo) * b.w, full = 3 * 0.375 * M.T2 * 1.16, Ys = (v) => b.y1 - 8 - v / full * (b.y1 - mid - 30);
        gridX({ x0: b.x0, y0: mid, w: b.w, h: b.y1 - mid }, [4, 3, 2, 1], Xp);
        curve(b, (x) => Ys(M.absorption((hi - (x - b.x0) / b.w * (hi - lo) - M.CARRIER) * M.MHZ, tacq)), { step: 0.5, base: Ys(0), width: 1.6 });
        g.save(); g.globalAlpha = ease((t - 5.4) / 0.6); for (const [ppm, lab] of [[3.69, 'CH₂'], [2.61, 'OH'], [1.19, 'CH₃']]) text(lab, Xp(ppm), mid + 16, { align: 'center', color: P.ink }); g.restore();
        frame(b); g.fillStyle = P.frame; g.fillRect(b.x0, Math.round(mid), b.w, 1); xticks(b, [4, 3, 2, 1], Xp, tx('化学位移 / ppm', 'chemical shift / ppm'));
        vtext(tx('信号', 'signal'), 14, (b.y0 + mid) / 2); vtext(tx('吸收', 'absorption'), 14, (mid + b.y1) / 2);
      } },
    { id: 'slit', href: 'qchem/index.html', sec: ['游乐场', 'Playground'], q: ['一次只放一个电子，条纹从哪里来？', 'One electron at a time: where do the fringes come from?'],
      cap: ['电子一个一个落在屏上，每个落点都是随机的；落得多了，直方图贴上量子力学预言的 |ψ|²（金线）。', 'Electrons land on the screen one by one, each at a random spot; with enough of them the histogram settles onto the |ψ|² that quantum mechanics predicts (gold line).'],
      still: 8, draw(t) {
        const NMAX = 3500, SPAN = 7, BINS = 98, pts = memo('slit', () => M.landings(NMAX, SPAN)), n = Math.max(1, Math.round(NMAX * clamp(t / 7) ** 1.7));
        const b = box(), mid = b.y0 + b.h * 0.42, X = (u) => b.x0 + (u + SPAN) / (2 * SPAN) * b.w, bins = new Float32Array(BINS);
        g.fillStyle = P.ink; g.globalAlpha = 0.6; for (let i = 0; i < n; i++) { const u = pts[2 * i]; g.fillRect(X(u), b.y0 + 5 + pts[2 * i + 1] * (mid - b.y0 - 10), 1.3, 1.3); bins[Math.min(BINS - 1, Math.floor((u + SPAN) / (2 * SPAN) * BINS))]++; }
        g.globalAlpha = 1;
        const norm = memo('slitn', () => { let s = 0; for (let u = -SPAN; u < SPAN; u += 0.01) s += M.slit(u) * 0.01; return s; }), per = n * (2 * SPAN / BINS) / norm, hh = b.y1 - mid - 16, bw = b.w / BINS;
        g.fillStyle = P.green; for (let i = 0; i < BINS; i++) { const h = Math.min(1.18, bins[i] / per) * hh; g.fillRect(b.x0 + i * bw + 0.5, b.y1 - h, Math.max(1, bw - 1), h); }
        curve(b, (x) => b.y1 - M.slit((x - b.x0) / b.w * 2 * SPAN - SPAN) * hh, { fill: false, stroke: P.gold, width: 1.6, step: 0.5 });
        frame(b); g.fillStyle = P.frame; g.fillRect(b.x0, Math.round(mid), b.w, 1); xticks(b, [-6, -4, -2, 0, 2, 4, 6], X, tx('屏上位置 / 条纹间距', 'position on the screen / fringe spacing'));
        text('N = ' + n.toLocaleString('en-US'), b.x0 + 9, mid + 16, { color: P.ink }); text(tx('— 理论 |ψ|²', '— theory |ψ|²'), b.x0 + 9, mid + 30, { color: P.gold });
        vtext(tx('落点', 'hits'), 14, (b.y0 + mid) / 2); vtext(tx('计数', 'counts'), 14, (mid + b.y1) / 2);
      } },
    { id: 'grover', href: 'quantum/algorithms/index.html', sec: ['量子嘉年华 · 量子算法', 'Quantum Carnival · Algorithms'], q: ['在 32 个里找 1 个，量子计算机凭什么只查 4 次？', 'One in 32: why does a quantum computer need only 4 looks?'],
      cap: ['Grover 搜索：每一轮把概率从 31 个错的挪一点给对的那个，第 4 轮到 99.9%。再多转就过头了，概率反而掉下来。', 'Grover search: each round moves some probability from the 31 wrong items to the right one, reaching 99.9% at round 4. Go further and it overshoots: the probability falls again.'],
      still: 6.4, draw(t) {
        const N = 32, at = 20, kf = (t / 1.25) % 8, k0 = Math.floor(kf), w = ease((kf - k0) / 0.45), a = M.grover(N, Math.max(0, k0 - 1)), c = k0 === 0 ? M.grover(N, 0) : M.grover(N, k0), k = k0;
        const pm = (k0 === 0 ? c.marked : a.marked + (c.marked - a.marked) * w) ** 2, pr = (k0 === 0 ? c.rest : a.rest + (c.rest - a.rest) * w) ** 2;
        const b = box(), Y = (p) => b.y1 - p * (b.h - 22), bw = b.w / N;
        gridY(b, [0.25, 0.5, 0.75, 1], Y);
        for (let i = 0; i < N; i++) { const p = i === at ? pm : pr, h = b.y1 - Y(p); g.fillStyle = i === at ? P.gold : P.green; g.fillRect(b.x0 + i * bw + 1.5, b.y1 - Math.max(1, h), bw - 3, Math.max(1, h)); }
        frame(b); yticks(b, [0, 0.5, 1], Y, tx('测到它的概率', 'probability'), (v) => v.toFixed(1)); xticks(b, [1, 8, 16, 24, 32], (v) => b.x0 + (v - 0.5) * bw, tx('第几个条目', 'item'));
        text(tx('第 ', 'round ') + k + tx(' 轮', ''), b.x0 + 12, b.y0 + 22, { color: P.ink, size: 14, w: 600 }); text('P = ' + (pm * 100).toFixed(1) + '%', b.x0 + 12, b.y0 + 40, { color: P.gold, size: 12 });
        if (k > 4) text(tx('转过头了', 'overshoot'), b.x0 + 12, b.y0 + 56, { size: 10.5 });
      } },
    { id: 'clt', href: 'fundamental-science/math/index.html', sec: ['数学基础与探索', 'Mathematical Foundations'], q: ['每个数都是均匀乱取的，平均起来怎么成了钟形？', 'Every number is drawn flat at random. Why is their average a bell?'],
      cap: ['取 n 个均匀随机数求平均，重复 6,000 次画直方图。n = 1 是平的，n 到 12 已经贴上正态分布（金线）：中心极限定理。', 'Average n uniform random numbers, 6,000 times over, and plot the histogram. At n = 1 it is flat; by n = 12 it sits on the normal curve (gold): the central limit theorem.'],
      still: 8.6, draw(t) {
        const NS = [1, 2, 3, 6, 12], BINS = 48, LO = -3.6, HI = 3.6, COUNT = 6000, hist = (n) => memo('clt' + n, () => M.histogram(M.cltSamples(n, COUNT), LO, HI, BINS));
        const kf = (t / 1.8) % 5, k = Math.floor(kf), w = ease((kf - k) / 0.5), A = hist(NS[(k + 4) % 5]), B = hist(NS[k]);
        const b = box(), X = (z) => b.x0 + (z - LO) / (HI - LO) * b.w, dens = COUNT * (HI - LO) / BINS, Y = (d) => b.y1 - d / 0.62 * (b.h - 8), bw = b.w / BINS;
        gridY(b, [0.2, 0.4, 0.6], Y); g.fillStyle = P.green;
        for (let i = 0; i < BINS; i++) { const d = (A[i] + (B[i] - A[i]) * w) / dens, h = b.y1 - Y(d); g.fillRect(b.x0 + i * bw + 0.5, b.y1 - h, bw - 1, h); }
        curve(b, (x) => Y(M.normalPdf(LO + (x - b.x0) / b.w * (HI - LO))), { fill: false, stroke: P.gold, width: 1.8 });
        frame(b); xticks(b, [-3, -2, -1, 0, 1, 2, 3], X, tx('标准化后的平均值 / σ', 'standardised mean / σ')); yticks(b, [0, 0.2, 0.4, 0.6], Y, tx('概率密度', 'density'), (v) => v.toFixed(1));
        text('n = ' + NS[k], b.x0 + 12, b.y0 + 24, { color: P.ink, size: 15, w: 600 }); text(tx('— 正态分布', '— normal'), b.x0 + 12, b.y0 + 42, { color: P.gold });
      } },
    { id: 'chaos', href: 'physics-realms/index.html', sec: ['物理疆界图 · 混沌', 'Realms of Physics · Chaos'], q: ['一条一行的公式，怎么长出了混沌？', 'How does a one-line formula grow chaos?'],
      cap: ['逻辑斯蒂映射 x → r·x(1 − x) 反复迭代后停留的值。r 小的时候只有一个去处，然后一分为二、二分为四，过了 3.57 再也说不准。', 'Where the logistic map x → r·x(1 − x) settles after many iterations. For small r there is one resting value; then it splits in two, in four, and beyond 3.57 it can no longer be predicted.'],
      still: 8, draw(t) {
        const b = box(), R0 = 2.8, R1 = 4, X = (r) => b.x0 + (r - R0) / (R1 - R0) * b.w, Y = (x) => b.y1 - x * b.h, cols = Math.round(b.w), rows = Math.round(b.h);
        const img = memo(`bif${cols}x${rows}`, () => { const c = document.createElement('canvas'); c.width = cols * 2; c.height = rows * 2; const x = c.getContext('2d'); x.fillStyle = P.ink; x.globalAlpha = 0.34; for (let i = 0; i < cols * 2; i++) for (const v of M.logisticOrbit(R0 + (i + 0.5) / (cols * 2) * (R1 - R0), 400, 150)) x.fillRect(i, (1 - v) * rows * 2, 1, 1); return c; });
        const u = ease(t / 6.5), xe = b.x0 + b.w * u;
        gridY(b, [0.25, 0.5, 0.75], Y);
        g.save(); g.beginPath(); g.rect(b.x0, b.y0, xe - b.x0, b.h); g.clip(); g.drawImage(img, b.x0, b.y0, b.w, b.h); g.restore();
        if (u < 1) { g.fillStyle = P.gold; g.fillRect(xe, b.y0, 1.5, b.h); }
        const r = R0 + (R1 - R0) * u; text('r = ' + r.toFixed(2), b.x0 + 12, b.y0 + 24, { color: P.ink, size: 15, w: 600 });
        text(r < 3 ? tx('一个定点', 'one fixed point') : r < 3.449 ? tx('周期 2', 'period 2') : r < 3.544 ? tx('周期 4', 'period 4') : r < 3.5699 ? tx('周期 8、16、…', 'period 8, 16, …') : tx('混沌', 'chaos'), b.x0 + 12, b.y0 + 42, { color: P.gold });
        frame(b); xticks(b, [2.8, 3, 3.2, 3.4, 3.6, 3.8, 4], X, tx('参数 r', 'parameter r'), (v) => v.toFixed(1)); yticks(b, [0, 0.5, 1], Y, tx('x 最后停在哪', 'where x settles'), (v) => v.toFixed(1));
      } },
    { id: 'morse', href: 'manual/index.html', sec: ['讲解手册 · 势能面', 'Handbook · Potential Energy'], q: ['两个氢原子靠多近，才算成了键？', 'How close must two hydrogen atoms come to be bonded?'],
      cap: ['H₂ 的 Morse 势能曲线和 18 个振动能级（参数取自光谱常数 ωe、ωexe）。能级越往上越挤，挤到顶，键就断了。', 'The Morse potential of H₂ and its 18 vibrational levels (from the spectroscopic constants ωe, ωexe). The levels crowd together towards the top; at the top the bond breaks.'],
      still: 8, draw(t) {
        const b = box(), R0 = 0.25, R1 = 3.6, E1 = 5.6, X = (r) => b.x0 + (r - R0) / (R1 - R0) * b.w, Y = (e) => b.y1 - e / E1 * b.h, shown = clamp(Math.floor((t - 0.6) / 0.3) + 1, 0, M.H2.vmax + 1);
        gridY(b, [1, 2, 3, 4, 5], Y);
        g.fillStyle = P.gold; g.fillRect(b.x0, Math.round(Y(M.H2.De)), b.w, 1.5); text(tx('解离极限 Dₑ = ', 'dissociation Dₑ = ') + M.H2.De.toFixed(2) + ' eV', b.x1 - 8, Y(M.H2.De) - 7, { align: 'right', color: P.gold });
        for (let v = 0; v < shown; v++) { const E = M.morseLevel(v), [a, c] = M.morseTurn(E); g.fillStyle = P.green; g.fillRect(X(a), Math.round(Y(E)) - 1, Math.min(X(c), b.x1) - X(a), 2); }
        if (shown > 4) text('v = ' + (shown - 1), b.x1 - 8, Y(M.morseLevel(shown - 1)) + 13, { align: 'right', size: 9.5 });
        g.save(); g.beginPath(); g.rect(b.x0, b.y0, b.w, b.h); g.clip(); curve(b, (x) => Y(M.morse(R0 + (x - b.x0) / b.w * (R1 - R0))), { fill: false, width: 2.2, step: 0.5 }); g.restore();
        g.fillStyle = P.ink; g.fillRect(Math.round(X(M.H2.re)), b.y1 - 9, 1, 9); text('rₑ = 0.74 Å', X(M.H2.re) + 44, b.y1 - 7, { color: P.ink });
        frame(b); xticks(b, [0.5, 1, 1.5, 2, 2.5, 3, 3.5], X, tx('H–H 距离 / Å', 'H–H distance / Å'), (v) => v.toFixed(1)); yticks(b, [0, 1, 2, 3, 4, 5], Y, tx('能量 / eV', 'energy / eV'));
      } },
    { id: 'maxwell', href: 'chemistry/physical/index.html', sec: ['化学学科馆 · 物理化学', 'Chemistry Halls · Physical'], q: ['室温下，氮气分子跑得有多快？', 'How fast do nitrogen molecules fly at room temperature?'],
      cap: ['N₂ 的麦克斯韦–玻尔兹曼速率分布。300 K 时最常见的速率是 422 m/s，比声音还快；温度越高，分布越扁越宽。', 'The Maxwell–Boltzmann speed distribution of N₂. At 300 K the most common speed is 422 m/s, faster than sound; the hotter the gas, the flatter and wider the curve.'],
      still: 2.55, draw(t) {
        const ph = (t % 9) / 9, T = 100 * Math.pow(10, ph < 0.5 ? ease(ph * 2) : ease(2 - ph * 2)), b = box(), VM = 2000, X = (v) => b.x0 + v / VM * b.w, Y = (f) => b.y1 - f / 3.7e-3 * b.h;
        gridX(b, [500, 1000, 1500], X); gridY(b, [1e-3, 2e-3, 3e-3], Y);
        for (const T0 of [100, 300, 1000]) { curve(b, (x) => Y(M.maxwell((x - b.x0) / b.w * VM, T0)), { fill: false, stroke: P.frame, width: 1 }); const vp = M.vMostProbable(T0); text(T0 + ' K', X(vp) + (T0 === 100 ? 26 : 0), Y(M.maxwell(vp, T0)) - 6, { align: 'center', size: 9.5 }); }
        curve(b, (x) => Y(M.maxwell((x - b.x0) / b.w * VM, T)), { width: 2 });
        const vp = M.vMostProbable(T); g.fillStyle = P.gold; g.fillRect(Math.round(X(vp)), Y(M.maxwell(vp, T)), 1.5, b.y1 - Y(M.maxwell(vp, T)));
        text('T = ' + Math.round(T) + ' K', b.x1 - 12, b.y0 + 24, { align: 'right', color: P.ink, size: 15, w: 600 }); text(tx('最概然速率 ', 'most probable ') + Math.round(vp) + ' m/s', b.x1 - 12, b.y0 + 42, { align: 'right', color: P.gold });
        frame(b); xticks(b, [0, 500, 1000, 1500, 2000], X, tx('速率 / m·s⁻¹', 'speed / m·s⁻¹')); yticks(b, [0, 1e-3, 2e-3, 3e-3], Y, 'f(v) / 10⁻³ s·m⁻¹', (v) => String(Math.round(v * 1e3)));
      } },
    { id: 'chlorine', href: 'spectra/index.html', sec: ['谱图馆 · 质谱', 'Spectra Hall · Mass Spectrometry'], q: ['质谱里那一簇峰，怎么数出分子里有几个氯？', 'How does a cluster of peaks count the chlorines in a molecule?'],
      cap: ['氯有两种稳定同位素（³⁵Cl 75.76%，³⁷Cl 24.24%）。分子里有 n 个氯，峰簇的高度就是二项分布：一个氯 3 : 1，两个氯 9 : 6 : 1。', 'Chlorine has two stable isotopes (³⁵Cl 75.76%, ³⁷Cl 24.24%). With n chlorines the cluster follows the binomial distribution: 3 : 1 for one, 9 : 6 : 1 for two.'],
      still: 3.9, draw(t) {
        const kf = (t / 2.2) % 4, k = Math.floor(kf), w = ease((kf - k) / 0.5), A = M.chlorinePattern(((k + 3) % 4) + 1), B = M.chlorinePattern(k + 1), b = box(), slots = 5, sw = b.w / slots, Y = (v) => b.y1 - v * (b.h - 40);
        gridY(b, [0.25, 0.5, 0.75, 1], Y);
        for (let i = 0; i < slots; i++) { const a = A[i] ? A[i][1] : 0, c = B[i] ? B[i][1] : 0, v = a + (c - a) * w, x = b.x0 + (i + 0.5) * sw, bw = Math.min(26, sw * 0.3); if (v < 0.002) continue; g.fillStyle = i === 0 ? P.gold : P.green; g.fillRect(x - bw / 2, Y(v), bw, b.y1 - Y(v)); text((v * 100).toFixed(v > 0.0995 ? 0 : 1) + '%', x, Y(v) - 7, { align: 'center', color: P.ink }); }
        frame(b); yticks(b, [0, 0.5, 1], Y, tx('相对丰度 / %', 'relative abundance / %'), (v) => String(v * 100));
        xticks(b, [0, 1, 2, 3, 4], (i) => b.x0 + (i + 0.5) * sw, 'm/z', (i) => (i ? 'M+' + 2 * i : 'M'));
        text(tx('氯原子数 n = ', 'chlorines n = ') + (k + 1), b.x1 - 12, b.y0 + 24, { align: 'right', color: P.ink, size: 15, w: 600 }); text(['R–Cl', 'CH₂Cl₂', 'CHCl₃', 'CCl₄'][k], b.x1 - 12, b.y0 + 42, { align: 'right', color: P.gold });
      } },
  ];
  const N = FIGS.length, pad = (i) => String(i + 1).padStart(2, '0');

  // ── the page ──
  let cur = -1, t0 = 0, raf = 0, seen = true, held = false, timer = 0, dpr = 1;
  function size() {
    const w = canvas.clientWidth, h = canvas.clientHeight; if (!w || !h) return false;
    const k = w < 470 ? w / 470 : 1; dpr = Math.min(2.5, devicePixelRatio || 1); W = w / k; H = h / k;
    const bw = Math.round(w * dpr), bh = Math.round(h * dpr);
    if (canvas.width !== bw || canvas.height !== bh) { canvas.width = bw; canvas.height = bh; cache.clear(); }
    g.setTransform(dpr * k, 0, 0, dpr * k, 0, 0); return true;
  }
  function paint(now) {
    if (cur < 0 || !P) return;
    const f = FIGS[cur], t = reduce.matches ? f.still : (now - t0) / 1000;
    g.save(); g.setTransform(1, 0, 0, 1, 0, 0); g.fillStyle = P.bg; g.fillRect(0, 0, canvas.width, canvas.height); g.restore();
    g.globalAlpha = 1; g.textBaseline = 'alphabetic';
    try { f.draw(Math.max(0, t)); } catch (e) { console.error(e); }
  }
  const frame_ = (now) => { paint(now); raf = requestAnimationFrame(frame_); };
  function sync() { // run only while it can be seen and motion is welcome
    const go = seen && !document.hidden && !reduce.matches;
    if (go && !raf) raf = requestAnimationFrame(frame_); else if (!go && raf) { cancelAnimationFrame(raf); raf = 0; }
    if (!go) paint(performance.now());
    clearTimeout(timer); if (go && !held) timer = setTimeout(() => show(cur + 1, 1, true), Math.max(1200, DWELL * 1000 - (performance.now() - t0)));
  }
  function words(i) {
    const f = FIGS[i]; $no.textContent = 'FIG. ' + pad(i); $sec.textContent = tx(...f.sec); $q.textContent = tx(...f.q); $cap.textContent = tx(...f.cap);
    $go.href = f.href; $go.firstElementChild.textContent = tx('进入', 'Open ') + tx(...f.sec).split(' · ')[0]; canvas.setAttribute('aria-label', tx(...f.cap));
  }
  function show(i, dir = 1, auto = false) {
    i = (i % N + N) % N; if (i === cur) return;
    if (cur >= 0 && !reduce.matches && seen && !document.hidden && canvas.width) { // the old page becomes a leaf and turns
      plate.querySelectorAll('.st-leaf').forEach((l) => l.remove());
      const leaf = page.cloneNode(true), c2 = leaf.querySelector('canvas'); leaf.removeAttribute('id'); leaf.className = 'st-page st-leaf' + (dir < 0 ? ' is-back' : ''); leaf.setAttribute('aria-hidden', 'true'); leaf.inert = true;
      leaf.querySelectorAll('[id]').forEach((e) => e.removeAttribute('id'));
      c2.width = canvas.width; c2.height = canvas.height; c2.getContext('2d').drawImage(canvas, 0, 0);
      plate.append(leaf); leaf.addEventListener('animationend', () => leaf.remove()); setTimeout(() => leaf.remove(), 1400);
    }
    cur = i; t0 = performance.now(); words(i);
    for (const b of track.children) b.setAttribute('aria-pressed', String(+b.dataset.i === i));
    paint(t0); sync();
    if (!auto) stage.dataset.picked = '1';
  }
  // Every plate's words take the same room, so turning a page never moves the rest of the first screen.
  function level() {
    foot.style.minHeight = ''; let max = 0; const keep = cur;
    for (let i = 0; i < N; i++) { words(i); max = Math.max(max, foot.offsetHeight); }
    words(Math.max(0, keep)); foot.style.minHeight = max + 'px';
  }

  // The belt: every plate twice over, so the loop has no seam (the second run is hidden from assistive technology).
  $of.textContent = ' / ' + N;
  track.innerHTML = [0, 1].map((r) => FIGS.map((f, i) => `<button type="button" class="st-chip" data-i="${i}" aria-pressed="false"${r ? ' tabindex="-1" aria-hidden="true"' : ''}><b>${pad(i)}</b><span>${tx(...f.sec).split(' · ').pop()}</span></button>`).join('')).join('');
  track.style.setProperty('--st-n', N);
  track.addEventListener('click', (e) => { const b = e.target.closest('.st-chip'); if (b) show(+b.dataset.i, +b.dataset.i < cur ? -1 : 1); });
  document.getElementById('st-prev').addEventListener('click', () => show(cur - 1, -1));
  document.getElementById('st-next').addEventListener('click', () => show(cur + 1, 1));
  stage.addEventListener('keydown', (e) => { if (e.key === 'ArrowRight') show(cur + 1, 1); else if (e.key === 'ArrowLeft') show(cur - 1, -1); });
  canvas.addEventListener('click', () => { location.href = FIGS[cur].href; });
  const hold = (on) => { held = on; sync(); };
  plate.addEventListener('pointerenter', () => hold(true)); plate.addEventListener('pointerleave', () => hold(false));
  stage.addEventListener('focusin', () => hold(true)); stage.addEventListener('focusout', () => hold(false));

  palette(); size(); level(); stage.classList.add('is-live'); show(0, 1, true);
  let lastW = canvas.clientWidth;
  const resized = () => { if (!size()) return; if (canvas.clientWidth !== lastW) { lastW = canvas.clientWidth; level(); size(); } paint(performance.now()); };
  if ('ResizeObserver' in window) new ResizeObserver(resized).observe(canvas); else addEventListener('resize', resized);
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; sync(); }, { rootMargin: '60px' }).observe(plate);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener?.('change', sync);
  // The theme: repaint with the other palette.
  const themed = () => { palette(); cache.clear(); paint(performance.now()); };
  new MutationObserver(themed).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', themed);
  document.fonts?.ready.then(() => { level(); resized(); });
})();
