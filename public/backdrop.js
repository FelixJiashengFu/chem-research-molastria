/* Artistic page backgrounds: procedural SVG / CSS layers behind every page, coloured from the site
   tokens so they follow light and dark mode. The choice, strength and motion are remembered per browser. */
(() => {
  'use strict';
  if (window.ChemBackdrop) return;
  const root = document.documentElement;
  const zh = () => root.lang !== 'en';
  const DEFAULT = 'stars'; // MolAstria: molecules among the stars
  const BGS = [
    { id: 'paper', zh: '素纸', en: 'Plain paper' },
    { id: 'grid', zh: '格物方格', en: 'Lab notebook' },
    { id: 'hex', zh: '苯环蜂巢', en: 'Benzene honeycomb' },
    { id: 'lattice', zh: '立方晶格', en: 'Crystal blocks' },
    { id: 'contour', zh: '势能面', en: 'Energy landscape' },
    { id: 'orbital', zh: '电子云', en: 'Electron clouds' },
    { id: 'stars', zh: '分子星图', en: 'Molecular constellations' },
    { id: 'ink', zh: '水墨山岚', en: 'Ink-wash mountains' },
    { id: 'aurora', zh: '极光', en: 'Aurora' },
    { id: 'rice', zh: '宣纸', en: 'Rice paper' },
    { id: 'spectrum', zh: '光谱', en: 'Spectral lines' }
  ];
  const store = {
    get: (k, d) => { try { return localStorage.getItem(k) ?? d; } catch { return d; } },
    set: (k, v) => { try { localStorage.setItem(k, v); } catch {} }
  };
  const rng = (seed) => () => { seed |= 0; seed = (seed + 0x6d2b79f5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const f1 = (v) => Math.round(v * 10) / 10;
  let uid = 0;
  const svg = (w, h, body, cls = '') => `<svg class="${cls}" viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" xmlns="http://www.w3.org/2000/svg">${body}</svg>`;

  // ── generators: (W, H, detail 0..1) → markup ─────────────────────────────
  function hex(W, H, d) {
    const id = `hx${++uid}`, k = d > 0.5 ? 1.1 : 0.7, r = rng(7);
    const s = 30 * k, w = Math.sqrt(3) * s;
    let marks = '';
    for (let j = -1; j * 1.5 * s < H + s; j++) for (let i = -1; i * w < W + w; i++) {
      const x = w / 2 + i * w - (Math.abs(j) % 2) * (w / 2), y = s + 1.5 * s * j, p = r();
      if (p < 0.07) marks += `<circle class="bg-ring" cx="${f1(x)}" cy="${f1(y)}" r="${f1(s * 0.48)}"/>`;
      else if (p < 0.1) marks += `<path class="bg-fill" d="M${f1(x)},${f1(y - s)}l${f1(w / 2)},${f1(s / 2)}v${f1(s)}l${f1(-w / 2)},${f1(s / 2)}l${f1(-w / 2)},${f1(-s / 2)}v${f1(-s)}z"/>`;
    }
    return svg(W, H, `<defs><pattern id="${id}" width="${f1(w)}" height="${f1(3 * s)}" patternUnits="userSpaceOnUse"><path class="bg-stroke" d="M0,${f1(s / 2)}L${f1(w / 2)},0L${f1(w)},${f1(s / 2)}V${f1(1.5 * s)}L${f1(w / 2)},${f1(2 * s)}L0,${f1(1.5 * s)}ZM${f1(w / 2)},${f1(2 * s)}V${f1(3 * s)}"/></pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/>${marks}`);
  }
  function lattice(W, H, d) {
    const id = `lt${++uid}`, s = d > 0.5 ? 34 : 22, w = Math.sqrt(3) * s;
    const cube = (cx, cy) => {
      const P = (x, y) => `${f1(cx + x)},${f1(cy + y)}`;
      const top = P(0, -s), ur = P(w / 2, -s / 2), lr = P(w / 2, s / 2), bot = P(0, s), ll = P(-w / 2, s / 2), ul = P(-w / 2, -s / 2), c = P(0, 0);
      return `<path class="bg-face1" d="M${ul}L${top}L${ur}L${c}Z"/><path class="bg-face2" d="M${ul}L${c}L${bot}L${ll}Z"/><path class="bg-face3" d="M${c}L${ur}L${lr}L${bot}Z"/>`;
    };
    const tile = [[w / 2, s], [0, 2.5 * s], [w, 2.5 * s], [0, -0.5 * s], [w, -0.5 * s]].map(([x, y]) => cube(x, y)).join('');
    return svg(W, H, `<defs><pattern id="${id}" width="${f1(w)}" height="${f1(3 * s)}" patternUnits="userSpaceOnUse">${tile}</pattern></defs><rect width="100%" height="100%" fill="url(#${id})"/>`);
  }
  /** Iso-lines of a two-well potential energy surface (marching squares), with the minimum-energy path. */
  function contour(W, H, d) {
    const nx = d > 0.5 ? 150 : 56, ny = Math.round(nx * H / W);
    const wells = [[0.2, 0.62, -1.1, 0.15], [0.76, 0.36, -0.9, 0.13], [0.52, 0.86, -0.5, 0.1], [0.47, 0.22, 0.55, 0.16], [0.92, 0.85, 0.35, 0.12]];
    const f = (x, y) => wells.reduce((s, [a, b, h, w]) => s + h * Math.exp(-(((x - a) * W / H) ** 2 + (y - b) ** 2) / (2 * w * w)), 0) + 0.08 * y;
    const g = [];
    for (let j = 0; j <= ny; j++) { g.push([]); for (let i = 0; i <= nx; i++) g[j].push(f(i / nx, j / ny)); }
    const flat = g.flat(), lo = Math.min(...flat), hi = Math.max(...flat);
    const levels = d > 0.5 ? 22 : 12;
    let paths = '';
    for (let L = 1; L < levels; L++) {
      const v = lo + (hi - lo) * (L / levels);
      let p = '';
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const a = g[j][i], b = g[j][i + 1], c = g[j + 1][i + 1], e = g[j + 1][i];
        const pts = [];
        const X = (k) => (k / nx) * W, Y = (k) => (k / ny) * H;
        if ((a < v) !== (b < v)) pts.push([X(i + (v - a) / (b - a)), Y(j)]);
        if ((b < v) !== (c < v)) pts.push([X(i + 1), Y(j + (v - b) / (c - b))]);
        if ((e < v) !== (c < v)) pts.push([X(i + (v - e) / (c - e)), Y(j + 1)]);
        if ((a < v) !== (e < v)) pts.push([X(i), Y(j + (v - a) / (e - a))]);
        if (pts.length >= 2) p += `M${f1(pts[0][0])},${f1(pts[0][1])}L${f1(pts[1][0])},${f1(pts[1][1])}`;
        if (pts.length === 4) p += `M${f1(pts[2][0])},${f1(pts[2][1])}L${f1(pts[3][0])},${f1(pts[3][1])}`;
      }
      if (p) paths += `<path class="${L % 4 === 0 ? 'bg-iso2' : 'bg-iso'}" d="${p}"/>`;
    }
    const m = (x, y) => `${f1(x * W)},${f1(y * H)}`;
    const mep = `<path class="bg-mep" d="M${m(0.2, 0.62)}C${m(0.36, 0.6)} ${m(0.42, 0.48)} ${m(0.5, 0.47)}S${m(0.66, 0.38)} ${m(0.76, 0.36)}"/>`;
    const dots = [[0.2, 0.62], [0.76, 0.36]].map(([x, y]) => `<circle class="bg-min" cx="${f1(x * W)}" cy="${f1(y * H)}" r="${d > 0.5 ? 5 : 3}"/>`).join('');
    return svg(W, H, paths + mep + dots + (d > 0.5 ? `<text class="bg-label" x="${f1(0.5 * W)}" y="${f1(0.47 * H - 12)}">‡</text>` : ''));
  }
  /** Monte Carlo samples of hydrogen-like orbitals in a plane, coloured by the sign of ψ. */
  function orbital(W, H, d) {
    const r = rng(42), n = d > 0.5 ? 1700 : 260, rad = d > 0.5 ? 1.25 : 1.6;
    const orbs = [
      { cx: 0.2, cy: 0.7, R: 0.24, psi: (x, y) => y * Math.exp(-Math.hypot(x, y) / 2), lim: 12 },
      { cx: 0.8, cy: 0.28, R: 0.26, psi: (x, y) => x * y * Math.exp(-Math.hypot(x, y) / 3), lim: 20 },
      { cx: 0.62, cy: 0.82, R: 0.2, psi: (x, y) => (2 * y * y - x * x) * Math.exp(-Math.hypot(x, y) / 3), lim: 22 }
    ];
    let out = '';
    for (const o of orbs) {
      let max = 0;
      for (let k = 0; k < 4000; k++) { const x = (r() * 2 - 1) * o.lim, y = (r() * 2 - 1) * o.lim; max = Math.max(max, o.psi(x, y) ** 2); }
      let pos = '', neg = '', got = 0, tries = 0;
      const S = o.R * Math.min(W, H) * 1.6 / o.lim;
      while (got < n && tries++ < n * 400) {
        const x = (r() * 2 - 1) * o.lim, y = (r() * 2 - 1) * o.lim, v = o.psi(x, y);
        if (r() * max > v * v) continue;
        got++;
        const px = f1(o.cx * W + x * S), py = f1(o.cy * H - y * S);
        if (v >= 0) pos += `M${px},${py}h0`; else neg += `M${px},${py}h0`;
      }
      out += `<path class="bg-psi-pos" stroke-width="${rad * 2}" d="${pos}"/><path class="bg-psi-neg" stroke-width="${rad * 2}" d="${neg}"/><circle class="bg-nucleus" cx="${f1(o.cx * W)}" cy="${f1(o.cy * H)}" r="${d > 0.5 ? 3 : 2}"/>`;
    }
    return svg(W, H, out);
  }
  /** Star field with a few molecules drawn as constellations (benzene, ethylene carbonate, water, methane). */
  function stars(W, H, d) {
    const r = rng(2026), n = d > 0.5 ? 320 : 70;
    let s = '';
    for (let i = 0; i < n; i++) {
      const big = r() < 0.08, tw = d > 0.5 && r() < 0.25;
      s += `<circle class="bg-star${tw ? ' tw' : ''}" cx="${f1(r() * W)}" cy="${f1(r() * H)}" r="${f1(big ? 1.6 + r() : 0.5 + r() * 0.9)}"${tw ? ` style="animation-delay:${f1(r() * 6)}s"` : ''}/>`;
    }
    const k = d > 0.5 ? 1 : 0.45;
    const ring = (n, R) => Array.from({ length: n }, (_, i) => [R * Math.cos((2 * Math.PI * i) / n - Math.PI / 2), R * Math.sin((2 * Math.PI * i) / n - Math.PI / 2)]);
    const mols = [
      { at: [0.07, 0.6], rot: 12, pts: ring(6, 62), bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 5], [5, 0]], inner: 34 },
      { at: [0.82, 0.62], rot: -18, pts: [...ring(5, 50), [0, -110], ], bonds: [[0, 1], [1, 2], [2, 3], [3, 4], [4, 0], [0, 5]] },
      { at: [0.5, 0.06], rot: 0, pts: [[0, 0], [-48, 36], [48, 36]], bonds: [[0, 1], [0, 2]] },
      { at: [0.34, 0.9], rot: 25, pts: [[0, 0], [0, -66], [62, 22], [-62, 22], [0, 48]], bonds: [[0, 1], [0, 2], [0, 3], [0, 4]] }
    ];
    let c = '';
    for (const m of mols) {
      const a = (m.rot * Math.PI) / 180, P = ([x, y]) => [m.at[0] * W + k * (x * Math.cos(a) - y * Math.sin(a)), m.at[1] * H + k * (x * Math.sin(a) + y * Math.cos(a))];
      const pts = m.pts.map(P);
      c += `<path class="bg-const" d="${m.bonds.map(([i, j]) => `M${f1(pts[i][0])},${f1(pts[i][1])}L${f1(pts[j][0])},${f1(pts[j][1])}`).join('')}"/>`;
      if (m.inner) c += `<circle class="bg-const" cx="${f1(m.at[0] * W)}" cy="${f1(m.at[1] * H)}" r="${f1(m.inner * k)}"/>`;
      c += pts.map(([x, y]) => `<circle class="bg-node" cx="${f1(x)}" cy="${f1(y)}" r="${d > 0.5 ? 2.6 : 1.6}"/>`).join('');
    }
    return svg(W, H, `<path class="bg-milky" d="M${-W * 0.1},${H * 0.95}Q${W * 0.45},${H * 0.35} ${W * 1.1},${H * 0.05}"/>${s}${c}`);
  }
  /** Ink-wash ridgelines by midpoint displacement, fading into mist, under a pale sun. */
  function ink(W, H, d) {
    const r = rng(9), id = `ink${++uid}`;
    const ridge = (base, rough, seedShift) => {
      const n = 65, ys = new Array(n).fill(0);
      ys[0] = base + (r() - 0.5) * rough; ys[n - 1] = base + (r() - 0.5) * rough;
      const split = (a, b, amp) => { if (b - a < 2) return; const m = (a + b) >> 1; ys[m] = (ys[a] + ys[b]) / 2 + (r() - 0.5) * amp; split(a, m, amp * 0.55); split(m, b, amp * 0.55); };
      split(0, n - 1, rough * 1.6 + seedShift);
      const pts = ys.map((y, i) => [(i / (n - 1)) * W, y * H]);
      let p = `M0,${H}L${f1(pts[0][0])},${f1(pts[0][1])}`;
      for (let i = 1; i < pts.length; i++) { const [x0, y0] = pts[i - 1], [x1, y1] = pts[i]; p += `Q${f1(x0)},${f1(y0)} ${f1((x0 + x1) / 2)},${f1((y0 + y1) / 2)}`; }
      return p + `L${W},${H}Z`;
    };
    const layers = [[0.5, 0.16, 0.05, 1], [0.6, 0.14, 0.03, 2], [0.72, 0.12, 0.02, 3], [0.84, 0.08, 0.01, 4]];
    const defs = layers.map(([, , , n]) => `<linearGradient id="${id}g${n}" x1="0" y1="0" x2="0" y2="1"><stop offset="0" class="bg-ink-top${n}"/><stop offset="1" class="bg-ink-bot"/></linearGradient>`).join('');
    const hills = layers.map(([base, rough, extra, n]) => `<path d="${ridge(base, rough, extra)}" fill="url(#${id}g${n})"/>`).join('');
    const birds = d > 0.5 ? [[0.66, 0.2], [0.69, 0.18], [0.71, 0.23], [0.64, 0.24]].map(([x, y], i) => `<path class="bg-bird" d="M${f1(x * W)},${f1(y * H)}q${7 - i},-6 ${14 - i},0q${7 - i},-6 ${14 - i},0"/>`).join('') : '';
    const seal = d > 0.5 ? `<g class="bg-seal" transform="translate(${f1(W - 120)} ${f1(H - 150)}) rotate(-4)"><rect width="58" height="58" rx="6"/><text x="29" y="27">格</text><text x="29" y="50">物</text></g>` : '';
    return svg(W, H, `<defs>${defs}</defs><circle class="bg-sun" cx="${f1(W * 0.76)}" cy="${f1(H * 0.2)}" r="${d > 0.5 ? 64 : 22}"/>${birds}${hills}<rect class="bg-mist" x="0" y="${f1(H * 0.62)}" width="${W}" height="${f1(H * 0.1)}"/>${seal}`);
  }
  function rice(W, H, d) {
    const id = `rc${++uid}`, r = rng(5);
    let fibers = '';
    for (let i = 0; i < (d > 0.5 ? 170 : 40); i++) {
      const x = r() * W, y = r() * H, len = 30 + r() * 110, a = r() * Math.PI;
      fibers += `M${f1(x)},${f1(y)}q${f1(Math.cos(a + 0.6) * len / 2)},${f1(Math.sin(a + 0.6) * len / 2)} ${f1(Math.cos(a) * len)},${f1(Math.sin(a) * len)}`;
    }
    const stain = (cx, cy, rx, cls) => `<ellipse class="${cls}" cx="${f1(cx * W)}" cy="${f1(cy * H)}" rx="${f1(rx * W)}" ry="${f1(rx * W * 0.7)}" filter="url(#${id}b)"/>`;
    const seal = d > 0.5 ? `<g class="bg-seal" transform="translate(${f1(W - 120)} ${f1(H - 150)}) rotate(3)"><rect width="58" height="58" rx="6"/><text x="29" y="27">书</text><text x="29" y="50">房</text></g>` : '';
    return svg(W, H, `<defs><filter id="${id}n" x="0" y="0" width="100%" height="100%"><feTurbulence type="fractalNoise" baseFrequency="${d > 0.5 ? 0.9 : 1.4}" numOctaves="3" seed="3"/><feColorMatrix type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 -2.2 1.25"/><feComposite in="SourceGraphic" operator="in"/></filter><filter id="${id}b" x="-50%" y="-50%" width="200%" height="200%"><feGaussianBlur stdDeviation="${d > 0.5 ? 60 : 18}"/></filter></defs>${stain(0.18, 0.2, 0.2, 'bg-stain1')}${stain(0.85, 0.75, 0.24, 'bg-stain2')}<rect class="bg-grain" width="100%" height="100%" filter="url(#${id}n)"/><path class="bg-fiber" d="${fibers}"/>${seal}`);
  }
  /** Solar absorption (Fraunhofer) lines on a faint spectrum at the top, hydrogen Balmer emission at the bottom. */
  function spectrum(W, H, d) {
    const x = (nm) => f1(((nm - 380) / (750 - 380)) * W);
    const band = d > 0.5 ? 180 : 70;
    const absorb = [393.4, 396.8, 430.8, 486.1, 516.7, 527, 589, 589.6, 656.3, 686.7, 718.5].map((nm, i) => `<rect class="bg-absorb" x="${x(nm)}" y="0" width="${i % 3 === 0 ? 3 : 1.6}" height="${band}"/>`).join('');
    const balmer = [[410.2, 275], [434, 255], [486.1, 190], [656.3, 2]].map(([nm, h]) => `<rect x="${x(nm)}" y="${H - band * 0.9}" width="${d > 0.5 ? 4 : 2}" height="${f1(band * 0.9)}" style="fill:hsl(${h} 85% 58%)" class="bg-emit"/>`).join('');
    const stops = [380, 420, 460, 500, 540, 580, 620, 660, 700, 750].map((nm) => { const h = nm < 440 ? 270 - (nm - 380) * 0.7 : nm < 490 ? 230 - (nm - 440) * 0.8 : nm < 580 ? 190 - (nm - 490) * 1.4 : Math.max(0, 64 - (nm - 580) * 0.5); return `<stop offset="${f1(((nm - 380) / 370) * 100)}%" stop-color="hsl(${f1(h)} 80% 60%)"/>`; }).join('');
    const id = `sp${++uid}`;
    return svg(W, H, `<defs><linearGradient id="${id}">${stops}</linearGradient><linearGradient id="${id}f" x1="0" y1="0" x2="0" y2="1"><stop offset="0" stop-color="#fff"/><stop offset="1" stop-color="#fff" stop-opacity="0"/></linearGradient><mask id="${id}m"><rect width="100%" height="${band}" fill="url(#${id}f)"/></mask></defs><rect class="bg-spec" width="100%" height="${band}" fill="url(#${id})" mask="url(#${id}m)"/>${absorb}${balmer}<line class="bg-axis" x1="0" x2="${W}" y1="${H - band * 0.9}" y2="${H - band * 0.9}"/>`);
  }
  const GEN = { hex, lattice, contour, orbital, stars, ink, rice, spectrum };
  const CSS_ONLY = new Set(['grid', 'aurora']);

  // ── layer ───────────────────────────────────────────────────────────────
  let layer = null;
  function render(id) {
    if (!layer) { layer = document.createElement('div'); layer.className = 'cr-bg'; layer.setAttribute('aria-hidden', 'true'); document.body.prepend(layer); }
    layer.dataset.kind = id;
    layer.innerHTML = id === 'paper' ? '' : CSS_ONLY.has(id) ? '<i class="b1"></i><i class="b2"></i>' : GEN[id](1600, 1000, 1);
  }
  function apply(id, persist = true) {
    if (!BGS.some((b) => b.id === id)) id = 'paper';
    root.dataset.bg = id;
    render(id);
    if (persist) store.set('chemhub-bg', id);
    picker?.querySelectorAll('[data-bg-id]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.bgId === id)));
  }
  function setStrength(v, persist = true) {
    const s = Math.min(1, Math.max(0.15, Number(v) || 0.7));
    root.style.setProperty('--bg-strength', String(s));
    if (persist) store.set('chemhub-bg-strength', String(s));
  }
  function setMotion(on, persist = true) {
    root.dataset.bgMotion = on ? 'on' : 'off';
    if (persist) store.set('chemhub-bg-motion', on ? 'on' : 'off');
  }

  // ── picker ──────────────────────────────────────────────────────────────
  let picker = null, anchor = null;
  function buildPicker() {
    picker = document.createElement('div');
    picker.className = 'cr-bgpick';
    picker.setAttribute('role', 'dialog');
    picker.setAttribute('aria-label', zh() ? '选择背景' : 'Choose a background');
    const current = root.dataset.bg || 'paper';
    picker.innerHTML = `<div class="cr-bgpick-head"><b>${zh() ? '背景' : 'Background'}</b><button type="button" class="cr-bgpick-x" aria-label="${zh() ? '关闭' : 'Close'}">×</button></div>
      <div class="cr-bgpick-grid">${BGS.map((b) => `<button type="button" data-bg-id="${b.id}" aria-pressed="${b.id === current}"><span class="cr-bg cr-bg-mini" data-kind="${b.id}">${b.id === 'paper' ? '' : CSS_ONLY.has(b.id) ? '<i class="b1"></i><i class="b2"></i>' : GEN[b.id](320, 200, 0)}</span><span class="cr-bgpick-name">${zh() ? b.zh : b.en}</span></button>`).join('')}</div>
      <label class="cr-bgpick-row">${zh() ? '浓淡' : 'Strength'}<input type="range" min="0.15" max="1" step="0.05" value="${getComputedStyle(root).getPropertyValue('--bg-strength').trim() || 0.7}"></label>
      <label class="cr-bgpick-row cr-bgpick-check"><input type="checkbox" ${root.dataset.bgMotion !== 'off' ? 'checked' : ''}>${zh() ? '动态效果（星光、极光、云雾）' : 'Motion (twinkle, aurora, mist)'}</label>`;
    document.body.append(picker);
    picker.addEventListener('click', (e) => {
      const b = e.target.closest('[data-bg-id]');
      if (b) apply(b.dataset.bgId);
      if (e.target.closest('.cr-bgpick-x')) close();
    });
    picker.querySelector('input[type=range]').addEventListener('input', (e) => setStrength(e.target.value));
    picker.querySelector('input[type=checkbox]').addEventListener('change', (e) => setMotion(e.target.checked));
    document.addEventListener('pointerdown', (e) => { if (picker.dataset.open === 'true' && !picker.contains(e.target) && !anchor?.contains(e.target)) close(); });
    document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && picker.dataset.open === 'true') { close(); anchor?.focus(); } });
  }
  function place() {
    if (!anchor || !picker) return;
    const r = anchor.getBoundingClientRect();
    picker.style.top = `${Math.round(r.bottom + 8)}px`;
    picker.style.right = `${Math.max(8, Math.round(innerWidth - r.right))}px`;
  }
  function open(btn) {
    anchor = btn || anchor;
    if (!picker) buildPicker();
    place();
    picker.dataset.open = 'true';
    anchor?.setAttribute('aria-expanded', 'true');
    picker.querySelector('[aria-pressed=true]')?.focus();
  }
  function close() { if (picker) picker.dataset.open = 'false'; anchor?.setAttribute('aria-expanded', 'false'); }
  addEventListener('resize', place);

  setStrength(store.get('chemhub-bg-strength', '0.7'), false);
  setMotion(store.get('chemhub-bg-motion', matchMedia('(prefers-reduced-motion: reduce)').matches ? 'off' : 'on') === 'on', false);
  apply(store.get('chemhub-bg', DEFAULT), false);
  window.ChemBackdrop = { list: BGS, apply, open, close, toggle: (btn) => (picker?.dataset.open === 'true' ? close() : open(btn)) };
})();
