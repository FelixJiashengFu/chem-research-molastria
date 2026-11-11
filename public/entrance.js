/* Home entrance: the parts CSS cannot do (see entrance.css for the timeline and the fallback without this script).
   - the sky: twinkling stars and constellations shaped like molecules, drawn line by line on a canvas (2D, no library)
   - the electron's ride along the orbit before it settles where the logo has it
   - skipping: any tap, click, key or wheel
   - the exit: the sheet closes into the header's brand mark while the drawn mark flies onto it
   The clock is the overlay's own CSS animation, so this script and the stylesheet never drift apart.
   Test hooks: html[data-entrance-state] is "playing", then "done"; window.MOLASTRIA_ENTRANCE.skip(). */
(() => {
  const root = document.documentElement, ent = document.getElementById('entrance');
  const mode = root.dataset.entrance;
  if (!ent || !mode) return;
  if (matchMedia('(prefers-reduced-motion: reduce)').matches) { ent.remove(); root.dataset.entranceState = 'done'; return; }
  const K = mode === 'brief' ? 0.34 : 1, OUT = 3500 * K;
  const t0 = performance.now();
  const own = (() => { try { return ent.getAnimations().find((a) => a.animationName === 'ent-gone'); } catch (e) { return null; } })();
  const now = () => { const c = own && own.currentTime; return typeof c === 'number' ? c : performance.now() - t0; };
  const clamp = (x) => Math.max(0, Math.min(1, x));
  const ease = (x) => 1 - Math.pow(1 - x, 3);
  root.dataset.entranceState = 'playing';
  try { if (/[?&]intro=1/.test(location.search)) history.replaceState(null, '', location.pathname + location.search.replace(/([?&])intro=1(&|$)/, (m, a, b) => (b ? a : '')) + location.hash); } catch (e) {}

  // ---- the electron: once and a quarter round the orbit, slowing into its place ----
  const el = ent.querySelector('.ent-el');
  const A = -28 * Math.PI / 180, CA = Math.cos(A), SA = Math.sin(A), REST = 3.4809;
  const electron = (t) => {
    if (!el) return;
    const p = ease(clamp((t - 900 * K) / (1150 * K))), th = REST - (1 - p) * Math.PI * 2.5;
    const x = 15 * Math.cos(th), y = 5.6 * Math.sin(th);
    el.setAttribute('cx', (19 + x * CA - y * SA).toFixed(3));
    el.setAttribute('cy', (21 + x * SA + y * CA).toFixed(3));
  };

  // ---- the sky ----
  const cv = ent.querySelector('.ent-sky'), g = cv && cv.getContext && cv.getContext('2d');
  const css = getComputedStyle(ent), STAR = css.getPropertyValue('--ent-star').trim() || '255,245,208', LINE = css.getPropertyValue('--ent-line').trim() || '190,214,196', SKY = +css.getPropertyValue('--ent-sky-a') || 1;
  let seed = 20261111;
  const rnd = () => { seed = (seed * 1664525 + 1013904223) >>> 0; return seed / 4294967296; };
  const hex = (cx, cy) => Array.from({ length: 6 }, (_, i) => { const a = (30 + 60 * i) * Math.PI / 180; return [cx + Math.cos(a), cy + Math.sin(a)]; });
  const graph = (pts, extra = []) => { // unique points, edges between ring neighbours, plus extra [point, point] bonds
    const P = [], E = [], id = (p) => { let i = P.findIndex((q) => Math.hypot(q[0] - p[0], q[1] - p[1]) < 0.01); if (i < 0) i = P.push(p) - 1; return i; };
    const bond = (a, b) => { const i = id(a), j = id(b); if (!E.some((e) => (e[0] === i && e[1] === j) || (e[0] === j && e[1] === i))) E.push([i, j]); };
    for (const ring of pts) ring.forEach((p, i) => bond(p, ring[(i + 1) % ring.length]));
    for (const [a, b] of extra) bond(a, b);
    return { P, E };
  };
  const h0 = hex(0, 0), hl = hex(-0.866, 0), hr = hex(0.866, 0);
  const SHAPES = {
    toluene: graph([h0], [[h0[5], [1.732, -1]]]),
    naphthalene: graph([hl, hr]),
    water: graph([], [[[-0.82, 0.32], [0, -0.3]], [[0, -0.3], [0.82, 0.32]]]),
    chain: graph([], [[[-1.73, 0.25], [-0.87, -0.25]], [[-0.87, -0.25], [0, 0.25]], [[0, 0.25], [0.87, -0.25]], [[0.87, -0.25], [1.73, 0.25]]]),
    phenol: graph([h0], [[h0[1], [0, 2]], [h0[4], [0, -2]]]),
  };
  // where each constellation sits (fractions of the sheet), away from the centre column that holds the logo
  const WIDE = [['toluene', 0.13, 0.2, 0.4], ['chain', 0.85, 0.15, -0.25], ['naphthalene', 0.11, 0.8, 0.2], ['phenol', 0.88, 0.74, 0.5], ['water', 0.71, 0.9, -0.1], ['water', 0.3, 0.1, 0.3]];
  const NARROW = [['toluene', 0.2, 0.11, 0.4], ['chain', 0.78, 0.2, -0.3], ['naphthalene', 0.24, 0.84, 0.2], ['water', 0.8, 0.8, -0.1]];
  let W = 0, H = 0, stars = [], sets = [], mx = 0, my = 0, px = 0, py = 0;
  const layout = () => {
    if (!g) return;
    const r = cv.getBoundingClientRect(), dpr = Math.min(2, window.devicePixelRatio || 1);
    W = cv.clientWidth || r.width; H = cv.clientHeight || r.height;
    cv.width = Math.round(W * dpr); cv.height = Math.round(H * dpr);
    g.setTransform(dpr, 0, 0, dpr, 0, 0);
    seed = 20261111;
    const n = Math.round(Math.min(190, Math.max(60, W * H / 7000)));
    stars = Array.from({ length: n }, () => ({ x: rnd() * W, y: rnd() * H, r: 0.5 + rnd() * rnd() * 1.7, f: 0.6 + rnd() * 2.2, ph: rnd() * 6.283, b: 0.35 + rnd() * 0.65, d: 0.3 + rnd() * 0.9 }));
    const u = Math.max(22, Math.min(46, Math.min(W, H) * 0.052));
    sets = (W < 640 ? NARROW : WIDE).map(([name, fx, fy, rot], i) => {
      const s = SHAPES[name], c = Math.cos(rot), sn = Math.sin(rot);
      return { P: s.P.map(([x, y]) => [fx * W + (x * c - y * sn) * u, fy * H + (x * sn + y * c) * u]), E: s.E, at: (250 + i * 230) * K, d: 0.55 };
    });
  };
  const sky = (t) => {
    if (!g || !W) return;
    px += (mx - px) * 0.06; py += (my - py) * 0.06;
    g.clearRect(0, 0, W, H);
    const fade = clamp(t / (800 * K));
    for (const s of stars) {
      g.globalAlpha = SKY * fade * s.b * (0.55 + 0.45 * Math.sin(t / 1000 * s.f + s.ph));
      g.fillStyle = `rgb(${STAR})`;
      g.beginPath(); g.arc(s.x + px * s.d * 10, s.y + py * s.d * 10, s.r, 0, 6.283); g.fill();
    }
    g.lineCap = 'round'; g.lineWidth = 1;
    for (const c of sets) {
      const q = clamp((t - c.at) / (1500 * K)) * c.E.length;
      if (q <= 0) continue;
      const ox = px * c.d * 10, oy = py * c.d * 10;
      g.strokeStyle = `rgb(${LINE})`; g.globalAlpha = 0.3 * SKY + 0.08;
      g.beginPath();
      c.E.forEach(([i, j], k) => { const f = clamp(q - k); if (f <= 0) return; const a = c.P[i], b = c.P[j]; g.moveTo(a[0] + ox, a[1] + oy); g.lineTo(a[0] + ox + (b[0] - a[0]) * f, a[1] + oy + (b[1] - a[1]) * f); });
      g.stroke();
      g.fillStyle = `rgb(${STAR})`;
      const seen = new Set();
      c.E.forEach(([i, j], k) => { if (q > k) seen.add(i); if (q >= k + 1) seen.add(j); });
      for (const i of seen) { g.globalAlpha = 0.75 * SKY + 0.1; g.beginPath(); g.arc(c.P[i][0] + ox, c.P[i][1] + oy, 1.7, 0, 6.283); g.fill(); }
    }
    // one shooting star as the gold star of the logo lands
    const sp = (t - 1900 * K) / (750 * K);
    if (sp > 0 && sp < 1 && K === 1) {
      const x = W * 0.62 + sp * W * 0.2, y = H * 0.1 + sp * H * 0.13, len = 90;
      const grad = g.createLinearGradient(x - len, y - len * 0.6, x, y);
      grad.addColorStop(0, `rgba(${STAR},0)`); grad.addColorStop(1, `rgba(${STAR},1)`);
      g.globalAlpha = Math.sin(sp * Math.PI) * (0.5 + 0.4 * SKY); g.strokeStyle = grad; g.lineWidth = 1.4;
      g.beginPath(); g.moveTo(x - len, y - len * 0.6); g.lineTo(x, y); g.stroke();
    }
    g.globalAlpha = 1;
  };
  layout();
  const onResize = () => layout();
  const onMove = (e) => { mx = (e.clientX / innerWidth - 0.5) * -2; my = (e.clientY / innerHeight - 0.5) * -2; };
  addEventListener('resize', onResize);
  addEventListener('pointermove', onMove, { passive: true });

  // ---- leaving ----
  let leaving = false, gone = false, raf = 0;
  const cleanup = () => {
    if (gone) return; gone = true;
    cancelAnimationFrame(raf);
    removeEventListener('resize', onResize); removeEventListener('pointermove', onMove);
    removeEventListener('keydown', onKey, true); removeEventListener('wheel', onSkip, true);
    ent.remove();
    root.dataset.entranceState = 'done';
    dispatchEvent(new CustomEvent('molastria:entrance-done'));
  };
  const exit = (fast) => {
    if (leaving) return; leaving = true;
    root.style.setProperty('--ent-out', Math.max(0, Math.round(now())) + 'ms'); // the hero starts rising now
    if (!ent.animate) return cleanup();
    const D = fast ? 520 : 820, EASE = 'cubic-bezier(.65,0,.2,1)';
    const mark = ent.querySelector('.ent-mark'), bg = ent.querySelector('.ent-bg'), target = document.querySelector('.cr-header .cr-mark');
    for (const x of ent.querySelectorAll('.ent-word,.ent-tag,.ent-zh,.ent-foot')) x.animate([{ opacity: 1, transform: 'none' }, { opacity: 0, transform: 'translateY(-12px)' }], { duration: D * 0.42, easing: 'ease-in', fill: 'forwards' });
    const from = mark.getBoundingClientRect(), to = target && target.getBoundingClientRect(), box = ent.getBoundingClientRect();
    let last;
    if (to && to.width > 4 && from.width > 4) {
      // Under CSS zoom on <html>, rectangles are in screen pixels and transforms in the zoomed element's own pixels.
      const z = from.width / (mark.clientWidth || mark.width.baseVal.value || from.width) || 1;
      const dx = (to.left + to.width / 2 - from.left - from.width / 2) / z, dy = (to.top + to.height / 2 - from.top - from.height / 2) / z, s = to.width / from.width;
      const cx = (to.left + to.width / 2 - box.left) / z, cy = (to.top + to.height / 2 - box.top) / z, R = Math.hypot(box.width, box.height) / z;
      mark.animate([{ transform: 'none' }, { transform: `translate(${dx * 0.42}px,${dy * 0.62}px) scale(${1 + (s - 1) * 0.5}) rotate(-7deg)`, offset: 0.5 }, { transform: `translate(${dx}px,${dy}px) scale(${s})` }], { duration: D, easing: EASE, fill: 'forwards' });
      mark.querySelector('.ent-a').animate([{ opacity: 1 }, { opacity: 1, offset: 0.3 }, { opacity: 0, offset: 0.85 }, { opacity: 0 }], { duration: D, fill: 'forwards' });
      mark.querySelector('.ent-b').animate([{ opacity: 0 }, { opacity: 0, offset: 0.3 }, { opacity: 1, offset: 0.85 }, { opacity: 1 }], { duration: D, fill: 'forwards' });
      last = bg.animate([{ clipPath: `circle(${R}px at ${cx}px ${cy}px)` }, { clipPath: `circle(${Math.max(8, to.width * 0.3 / z)}px at ${cx}px ${cy}px)`, opacity: 1, offset: 0.92 }, { clipPath: `circle(0px at ${cx}px ${cy}px)`, opacity: 0 }], { duration: D, easing: EASE, fill: 'forwards' });
      last.finished.then(() => { try { target.animate([{ transform: 'scale(1)' }, { transform: 'scale(1.14)' }, { transform: 'scale(1)' }], { duration: 460, easing: 'cubic-bezier(.3,.7,.3,1)' }); } catch (e) {} }).catch(() => {});
    } else {
      last = ent.animate([{ opacity: 1 }, { opacity: 0 }], { duration: D * 0.7, easing: 'ease', fill: 'forwards' });
    }
    ent.style.pointerEvents = 'none';
    last.finished.then(cleanup, cleanup);
    setTimeout(cleanup, D + 400);
  };
  const onSkip = () => exit(true);
  const onKey = (e) => { if (!/^(Shift|Control|Alt|Meta|CapsLock)$/.test(e.key)) exit(true); };
  ent.addEventListener('pointerdown', onSkip);
  addEventListener('keydown', onKey, true);
  addEventListener('wheel', onSkip, { capture: true, passive: true });

  const frame = () => {
    if (gone) return;
    const t = now();
    electron(t); sky(t);
    // leave on time, but not before the header exists to land on (it is drawn by shared-nav.js); never wait past 1.5 s more
    if (!leaving && t >= OUT && (document.querySelector('.cr-header .cr-mark') || t >= OUT + 1500)) exit(false);
    raf = requestAnimationFrame(frame);
  };
  raf = requestAnimationFrame(frame);
  // a hidden tab gets no frames: finish quietly so the page is ready when the visitor comes back
  document.addEventListener('visibilitychange', () => { if (document.hidden && !gone) cleanup(); });
  window.MOLASTRIA_ENTRANCE = { skip: () => exit(true), mode };
})();
