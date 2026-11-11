/* Home hero (home-hero.css has the look and the whole idea). This script:
   - draws the gold thread from the search bar to the hub, the orbits and the edges into svg.hero-web, and turns the
     six chips slowly round the hub on a tilted ring (transform only; one requestAnimationFrame loop that stops when
     the map is off screen, the tab is hidden, or the visitor asked for reduced motion);
   - shows the numbers of the current search: app.js sends { q, type, total, types } with the molastria:results event
     (and leaves the latest in window.MOLASTRIA_RESULTS, because it may run before or after this file);
   - a chip sets the catalogue's 类型 filter (again: clears it) and jumps to the list; a quick keyword fills the bar;
   - counts the four figures under the hero up when they come into view.
   Sizes are read in layout pixels (rect / k below), so the drawing also fits under the site's own zoom setting. */
(() => {
  'use strict';
  const hero = document.getElementById('hero'), map = document.getElementById('hero-map');
  if (!hero || !map) return;
  const NS = 'http://www.w3.org/2000/svg', TAU = Math.PI * 2;
  const web = hero.querySelector('.hero-web'), hub = map.querySelector('.nm-hub'), hubN = document.getElementById('hero-total');
  const nodes = [...map.querySelectorAll('.nm-node')], N = nodes.length;
  const form = document.getElementById('intro-search'), input = document.getElementById('intro-q');
  const reduce = matchMedia('(prefers-reduced-motion: reduce)');
  const fmt = (n) => Math.round(n).toLocaleString('zh-CN');
  const svg = (name, cls) => { const e = document.createElementNS(NS, name); e.setAttribute('class', cls); web.append(e); return e; };

  // Back to front: thread, orbits, the hexagon of the logo round the hub, edges, electrons, the spark of a search.
  const thread = svg('path', 'hw-thread'), run = svg('path', 'hw-run'); run.setAttribute('pathLength', '1');
  const ring = svg('ellipse', 'hw-ring'), outer = svg('ellipse', 'hw-orbit'), inner = svg('ellipse', 'hw-orbit'), hex = svg('path', 'hw-hex');
  const edges = nodes.map(() => ({ line: svg('path', 'hw-edge'), flow: svg('path', 'hw-flow') }));
  const elIn = svg('circle', 'hw-el'), elOut = svg('circle', 'hw-el hw-el-gold'), spark = svg('circle', 'hw-spark');
  elIn.setAttribute('r', 2.6); elOut.setAttribute('r', 2.2); spark.setAttribute('r', 4);

  const TILT = -10 * Math.PI / 180, cT = Math.cos(TILT), sT = Math.sin(TILT);
  const IN = -28 * Math.PI / 180, OUT = 16 * Math.PI / 180; // the logo's orbit, and a wide one the other way
  const BASE = TAU / 110; // one turn of the ring in 110 s
  const start = nodes.map((n) => (parseFloat(n.style.getPropertyValue('--a')) || 0) * Math.PI / 180);
  let G = null, theta = 0, omega = BASE, want = BASE, boost = 0, last = 0, raf = 0, seen = true;
  let mx = 0, my = 0, px = 0, py = 0, sparkAt = 0, hot = -1;

  function measure() {
    const h = hero.getBoundingClientRect(), m = map.getBoundingClientRect();
    if (!h.width || !m.width) { G = null; return; }
    const k = h.width / hero.offsetWidth || 1; // visual px per layout px (the site's zoom setting)
    const W = m.width / k, H = m.height / k, ox = (m.left - h.left) / k, oy = (m.top - h.top) / k;
    const pill = Math.max(...nodes.map((n) => n.offsetWidth)), R = hub.offsetWidth / 2;
    const rx = Math.max(70, Math.min(W * 0.41, W / 2 - pill / 2 + 4)), ry = Math.min(H * 0.342, rx * 0.66);
    const cx = ox + W / 2, cy = oy + H / 2;
    G = { W, H, cx, cy, R, rx, ry, k, hw: h.width, hh: h.height };
    const ell = (e, a, b, rot) => { e.setAttribute('cx', cx); e.setAttribute('cy', cy); e.setAttribute('rx', a); e.setAttribute('ry', b); e.setAttribute('transform', `rotate(${rot} ${cx} ${cy})`); };
    G.in = [R * 1.78, R * 0.62]; G.out = [Math.min(W / 2 - 4, rx * 1.17), Math.min(H / 2 - 4, ry * 1.42)];
    ell(ring, rx, ry, -10); ell(inner, G.in[0], G.in[1], -28); ell(outer, G.out[0], G.out[1], 16);
    const hr = R * 1.42;
    hex.setAttribute('d', 'M' + [0, 1, 2, 3, 4, 5].map((i) => `${(cx + hr * Math.sin(i * TAU / 6)).toFixed(1)} ${(cy - hr * Math.cos(i * TAU / 6)).toFixed(1)}`).join('L') + 'Z');
    // The thread only where the bar and the map sit side by side.
    const f = form.getBoundingClientRect(), x0 = (f.right - h.left) / k, y0 = (f.top + f.height / 2 - h.top) / k, dx = cx - R - x0;
    G.thread = dx > 60;
    const d = G.thread ? `M${x0.toFixed(1)} ${y0.toFixed(1)}C${(x0 + dx * 0.5).toFixed(1)} ${y0.toFixed(1)} ${(cx - R - dx * 0.55).toFixed(1)} ${cy.toFixed(1)} ${(cx - R * 1.04).toFixed(1)} ${cy.toFixed(1)}` : '';
    thread.setAttribute('d', d); run.setAttribute('d', d);
    G.len = G.thread ? thread.getTotalLength() : 0;
    thread.style.display = run.style.display = G.thread ? '' : 'none';
  }

  function place(now) {
    if (!G) return;
    const { cx, cy, R, rx, ry } = G;
    nodes.forEach((n, i) => {
      const a = start[i] + theta, c = Math.cos(a), s = Math.sin(a), depth = (s + 1) / 2; // 1 = nearest (lowest on the ring)
      const x = rx * c * cT - ry * s * sT + px * (3 + 9 * depth), y = rx * c * sT + ry * s * cT + py * (2 + 6 * depth);
      n.style.transform = `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) scale(${(0.9 + 0.13 * depth).toFixed(3)})`;
      n.style.setProperty('--o', (0.72 + 0.28 * depth).toFixed(2));
      const len = Math.hypot(x, y) || 1, ux = x / len, uy = y / len, bend = 0.13 * len * (i % 2 ? 1 : -1);
      const sx = cx + ux * R * 1.05, sy = cy + uy * R * 1.05, ex = cx + x, ey = cy + y;
      const d = `M${sx.toFixed(1)} ${sy.toFixed(1)}Q${((sx + ex) / 2 - uy * bend).toFixed(1)} ${((sy + ey) / 2 + ux * bend).toFixed(1)} ${ex.toFixed(1)} ${ey.toFixed(1)}`;
      edges[i].line.setAttribute('d', d); edges[i].flow.setAttribute('d', d);
      edges[i].line.style.opacity = edges[i].flow.style.opacity = (0.45 + 0.55 * depth).toFixed(2);
    });
    const t = now / 1000;
    const dot = (e, [a, b], rot, ang) => { const x = a * Math.cos(ang), y = b * Math.sin(ang); e.setAttribute('cx', (cx + x * Math.cos(rot) - y * Math.sin(rot)).toFixed(1)); e.setAttribute('cy', (cy + x * Math.sin(rot) + y * Math.cos(rot)).toFixed(1)); };
    dot(elIn, G.in, IN, t * TAU / 6.5); dot(elOut, G.out, OUT, -t * TAU / 23 + 1);
    if (sparkAt) {
      const u = (now - sparkAt) / 620;
      if (u >= 1 || !G.thread) { sparkAt = 0; spark.style.opacity = 0; ripple(); }
      else { const p = thread.getPointAtLength(G.len * (1 - Math.pow(1 - u, 3))); spark.setAttribute('cx', p.x.toFixed(1)); spark.setAttribute('cy', p.y.toFixed(1)); spark.style.opacity = Math.min(1, u * 6); }
    }
  }
  function frame(now) {
    const dt = Math.min(64, now - (last || now)) / 1000; last = now;
    omega += (want - omega) * Math.min(1, dt * 3.5); theta += (omega + boost) * dt; boost *= Math.exp(-dt * 2.4);
    px += (mx - px) * Math.min(1, dt * 5); py += (my - py) * Math.min(1, dt * 5);
    place(now);
    raf = requestAnimationFrame(frame);
  }
  const still = () => { cancelAnimationFrame(raf); raf = 0; last = 0; };
  function sync() { // run only while it can be seen and motion is welcome
    const go = seen && !document.hidden && !reduce.matches;
    if (go && !raf) raf = requestAnimationFrame(frame);
    else if (!go && raf) still();
    if (!go) { sparkAt = 0; spark.style.opacity = 0; place(performance.now()); }
  }
  function ripple() { hub.classList.remove('is-pulse'); void hub.offsetWidth; hub.classList.add('is-pulse'); boost = 0.55; }
  // A search travels: bar -> thread -> hub -> ring.
  function pulse() { if (reduce.matches || !raf) return; if (G && G.thread) sparkAt = performance.now(); else ripple(); }

  measure(); map.classList.add('is-live'); web.classList.add('is-live'); place(performance.now());
  if ('ResizeObserver' in window) { const ro = new ResizeObserver(() => { measure(); if (!raf) place(performance.now()); }); for (const e of [hero, map, form, ...nodes]) ro.observe(e); }
  else addEventListener('resize', () => { measure(); place(performance.now()); });
  if ('IntersectionObserver' in window) new IntersectionObserver((es) => { seen = es[es.length - 1].isIntersecting; sync(); }, { rootMargin: '80px' }).observe(map);
  // The copy rises into place (home-hero.css, entrance.css): measure again where it has landed.
  let again = 0;
  const remeasure = () => { cancelAnimationFrame(again); again = requestAnimationFrame(() => { measure(); if (!raf) place(performance.now()); }); };
  hero.addEventListener('animationend', (e) => { if (e.target.parentNode === form.parentNode.parentNode || e.target.classList.contains('field-note') || e.target.classList.contains('note-cap')) remeasure(); });
  addEventListener('load', remeasure);
  document.addEventListener('visibilitychange', sync);
  reduce.addEventListener?.('change', sync);
  sync();

  // The pointer: the light under the hero follows it, the chips lean a little; over the map the ring holds still.
  if (matchMedia('(hover:hover) and (pointer:fine)').matches) {
    let queued = false, ev = null;
    hero.addEventListener('pointermove', (e) => {
      ev = e; if (queued) return; queued = true;
      requestAnimationFrame(() => {
        queued = false; if (!G) return;
        const h = hero.getBoundingClientRect(), x = (ev.clientX - h.left) / h.width, y = (ev.clientY - h.top) / h.height;
        hero.style.setProperty('--hx', (x * 100).toFixed(1) + '%'); hero.style.setProperty('--hy', (y * 100).toFixed(1) + '%');
        mx = x * 2 - 1; my = y * 2 - 1;
      });
    });
    hero.addEventListener('pointerleave', () => { mx = my = 0; hero.style.removeProperty('--hx'); hero.style.removeProperty('--hy'); });
  }
  const hold = (on) => { want = on ? 0 : BASE; };
  map.addEventListener('pointerenter', () => hold(true)); map.addEventListener('pointerleave', () => { hold(false); heat(-1); });
  map.addEventListener('focusin', () => hold(true)); map.addEventListener('focusout', () => { hold(false); heat(-1); });
  function heat(i) { if (i === hot) return; for (const [j, e] of edges.entries()) { e.line.classList.toggle('is-hot', j === i); e.flow.classList.toggle('is-hot', j === i); } hot = i; }
  nodes.forEach((n, i) => { n.addEventListener('pointerenter', () => heat(i)); n.addEventListener('focus', () => heat(i)); n.addEventListener('pointerleave', () => heat(-1)); });

  // Numbers. A number that was not on screen yet counts up; one the visitor already saw just changes.
  const rolling = new WeakMap();
  function roll(el, to, ms = 650) {
    const from = +el.dataset.n || 0; el.dataset.n = to;
    cancelAnimationFrame(rolling.get(el));
    if (reduce.matches || from === to || document.hidden) { el.textContent = fmt(to); return; }
    const t0 = performance.now();
    const step = (now) => { const u = Math.min(1, (now - t0) / ms), v = from + (to - from) * (1 - Math.pow(1 - u, 4)); el.textContent = fmt(v); if (u < 1) rolling.set(el, requestAnimationFrame(step)); };
    rolling.set(el, requestAnimationFrame(step));
  }
  let lastQ = null;
  function results(d) {
    if (!d) return;
    const first = lastQ === null;
    roll(hubN, d.total, first ? 1100 : 650);
    for (const n of nodes) {
      const v = d.types[n.dataset.type] || 0, b = n.querySelector('b');
      if (!first && +b.dataset.n !== v) { n.classList.remove('is-tick'); void n.offsetWidth; n.classList.add('is-tick'); }
      roll(b, v, first ? 1100 : 650);
      n.classList.toggle('is-empty', !v);
      n.setAttribute('aria-pressed', String(d.type === n.dataset.type));
    }
    if (!first && d.q !== lastQ) pulse();
    lastQ = d.q;
  }
  addEventListener('molastria:results', (e) => results(e.detail));
  results(window.MOLASTRIA_RESULTS);

  // A chip filters the catalogue to its type through the 类型 select that app.js already listens to.
  const jump = () => document.getElementById('catalog')?.scrollIntoView({ block: 'start' });
  map.addEventListener('click', (e) => {
    const n = e.target.closest('.nm-node'), sel = document.getElementById('type');
    if (!n || !sel) return;
    sel.value = n.getAttribute('aria-pressed') === 'true' ? '' : n.dataset.type;
    sel.dispatchEvent(new Event('change', { bubbles: true }));
    jump();
  });
  // A quick keyword: app.js runs the search (its [data-query] handler); here the bar shows the word.
  hero.querySelector('.hero-try')?.addEventListener('click', (e) => { const b = e.target.closest('[data-query]'); if (b && input) input.value = b.dataset.query; });

  // The four figures count up once, when they first come into view. If they were already on screen for a while
  // (a slow connection: the script arrives late), they stay as they are: nobody wants a number to restart.
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
    // After app.js has written the real figures (it runs right after this file).
    addEventListener('DOMContentLoaded', () => figures.forEach((f) => io.observe(f)));
  }
})();
