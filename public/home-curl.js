/* The page curl of the book of figures on the home page: the page bends round like paper, shows its back, throws a
   shadow on the page beneath, follows a finger or the mouse, and on release either finishes the turn or falls back.
   The geometry is in home-curl-models.js (pure, tested); this file
   - copies the plate as it looks now onto a bitmap (the figure canvas, the text character by character at the
     places the browser laid it out, the rules, the arrow icons and the two round buttons), so the paper that curls is
     the page itself, not a stand-in;
   - draws that bitmap on a mesh in WebGL (one canvas laid over the plate; it takes no pointer events), with the
     light on the roll and a shadow on the page underneath;
   - runs the gestures and the animations, and asks home-hero.js (the host) to change the live page.
   No WebGL: window.MolAstriaCurl returns null and home-hero.js keeps its simple leaf.
   Host: { turn(dir, to) → undo() (to: the plate to show, by default the next one in that direction), allowed() → bool, reduce() → bool, hold(on) }. */
(() => {
  'use strict';
  const C = window.MOLASTRIA_CURL;
  if (!C) return;
  const ICONS = { // the paths of the arrow icons in shared-nav.css (viewBox 16)
    ext: ['M3.7 12.3 11.9 4.1', 'M5.6 3.7h6.7v6.7'], right: ['M2.6 8h10.4', 'M8.9 3.6 13.3 8l-4.4 4.4'],
    left: ['M13.4 8H3', 'M7.1 3.6 2.7 8l4.4 4.4'], up: ['M8 13.4V3', 'M3.6 7.1 8 2.7l4.4 4.4'], down: ['M8 2.6V13', 'M3.6 8.9 8 13.3l4.4-4.4'],
  };
  const VS = `attribute vec4 a_p;attribute vec2 a_uv;uniform vec2 u_size;varying vec2 v_uv;varying float v_nz;varying vec2 v_xy;
void main(){v_uv=a_uv;v_nz=a_p.w;v_xy=a_p.xy;gl_Position=vec4(a_p.x/u_size.x*2.0-1.0,1.0-a_p.y/u_size.y*2.0,-a_p.z/(4.0*u_size.x),1.0);}`;
  const FS = `precision mediump float;uniform sampler2D u_tex;uniform vec3 u_back;uniform float u_mode;varying vec2 v_uv;varying float v_nz;
void main(){vec4 c=texture2D(u_tex,v_uv);if(c.a<0.01)discard;vec3 rgb=c.rgb/c.a;
if(u_mode>0.5){gl_FragColor=c;return;}
if(gl_FrontFacing){float k=mix(0.58,1.0,v_nz)+0.10*exp(-pow((v_nz-0.6)/0.16,2.0));gl_FragColor=vec4(rgb*k*c.a,c.a);}
else{float b=-v_nz;vec3 p=mix(u_back,rgb,0.16);float k=mix(0.72,0.97,b)+0.06*exp(-pow((b-0.5)/0.2,2.0));gl_FragColor=vec4(p*k*c.a,c.a);}}`;
  // The shadow on the page beneath: darkest along the foot of the roll, fading over a hand's width.
  const SFS = `precision mediump float;uniform vec4 u_fold;uniform float u_r;uniform float u_dark;varying vec2 v_xy;
void main(){float d=(v_xy.x-u_fold.x)*u_fold.z+(v_xy.y-u_fold.y)*u_fold.w-u_r*0.75;if(d<0.0)discard;float w=26.0+u_r*2.6;
float a=u_dark*pow(1.0-clamp(d/w,0.0,1.0),1.7);gl_FragColor=vec4(0.0,0.0,0.0,a);}`;

  function compile(gl, vs, fs) {
    const p = gl.createProgram();
    for (const [type, src] of [[gl.VERTEX_SHADER, vs], [gl.FRAGMENT_SHADER, fs]]) {
      const s = gl.createShader(type); gl.shaderSource(s, src); gl.compileShader(s);
      if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) throw new Error(gl.getShaderInfoLog(s));
      gl.attachShader(p, s);
    }
    gl.linkProgram(p); if (!gl.getProgramParameter(p, gl.LINK_STATUS)) throw new Error(gl.getProgramInfoLog(p));
    return p;
  }
  const rgbOf = (css) => { const m = css.match(/[\d.]+/g) || [0, 0, 0]; return [+m[0] / 255, +m[1] / 255, +m[2] / 255]; };

  window.MolAstriaCurl = function (plate, host) {
    const cv = document.createElement('canvas');
    cv.className = 'st-curl'; cv.setAttribute('aria-hidden', 'true'); cv.hidden = true;
    let gl;
    try { gl = cv.getContext('webgl', { alpha: true, premultipliedAlpha: true, antialias: true, depth: true }); } catch { gl = null; }
    if (!gl) return null;
    let prog, shade;
    try { prog = compile(gl, VS, FS); shade = compile(gl, VS, SFS); } catch (e) { console.error(e); return null; }
    plate.append(cv);
    let lost = false;
    cv.addEventListener('webglcontextlost', (e) => { e.preventDefault(); lost = true; cv.hidden = true; });

    const COLS = 56, ROWS = 44, G0 = C.grid(COLS, ROWS), flatG = C.grid(1, 1);
    const buf = { pos: gl.createBuffer(), uv: gl.createBuffer(), idx: gl.createBuffer(), fpos: gl.createBuffer(), fuv: gl.createBuffer(), fidx: gl.createBuffer() };
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.uv); gl.bufferData(gl.ARRAY_BUFFER, G0.uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, G0.idx, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ARRAY_BUFFER, buf.fuv); gl.bufferData(gl.ARRAY_BUFFER, flatG.uv, gl.STATIC_DRAW);
    gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.fidx); gl.bufferData(gl.ELEMENT_ARRAY_BUFFER, flatG.idx, gl.STATIC_DRAW);
    const verts = new Float32Array(G0.uv.length * 2), fverts = new Float32Array(16);
    const tex = { top: gl.createTexture(), under: gl.createTexture() };
    const loc = (p) => ({ p: gl.getAttribLocation(p, 'a_p'), uv: gl.getAttribLocation(p, 'a_uv'), size: gl.getUniformLocation(p, 'u_size') });
    const L1 = { ...loc(prog), tex: gl.getUniformLocation(prog, 'u_tex'), back: gl.getUniformLocation(prog, 'u_back'), mode: gl.getUniformLocation(prog, 'u_mode') };
    const L2 = { ...loc(shade), fold: gl.getUniformLocation(shade, 'u_fold'), r: gl.getUniformLocation(shade, 'u_r'), dark: gl.getUniformLocation(shade, 'u_dark') };

    // ── the page as a bitmap ──
    let W = 0, H = 0, dpr = 1, back = [1, 1, 1], dark = 0.3;
    function measure() {
      W = plate.offsetWidth; H = plate.offsetHeight;
      dpr = Math.min(2, devicePixelRatio || 1);
      const bw = Math.round(W * dpr), bh = Math.round(H * dpr);
      if (cv.width !== bw || cv.height !== bh) { cv.width = bw; cv.height = bh; }
    }
    function snap() {
      const pr = plate.getBoundingClientRect(), s = pr.width / W || 1;
      const c = document.createElement('canvas'); c.width = Math.round(W * dpr); c.height = Math.round(H * dpr);
      const x = c.getContext('2d'); x.scale(dpr / s, dpr / s);
      const at = (r) => [r.left - pr.left, r.top - pr.top, r.width, r.height];
      const page = plate.querySelector('.st-page'), ps = getComputedStyle(page);
      const rad = parseFloat(getComputedStyle(plate).borderTopLeftRadius) * s || 0;
      x.beginPath(); if (x.roundRect) x.roundRect(0, 0, pr.width, pr.height, rad); else x.rect(0, 0, pr.width, pr.height); x.clip();
      x.fillStyle = ps.backgroundColor; x.fillRect(0, 0, pr.width, pr.height);
      back = rgbOf(ps.backgroundColor); dark = (back[0] + back[1] + back[2]) / 3 < 0.4 ? 0.7 : 0.42;
      const els = [page, ...page.querySelectorAll('*')];
      for (const el of els) { // the rules (borders that are straight lines)
        if (el.closest('button')) continue;
        const st = getComputedStyle(el); if (st.visibility === 'hidden' || st.display === 'none') continue;
        const [l, t, w, h] = at(el.getBoundingClientRect());
        for (const [side, rect] of [['Top', (b) => [l, t, w, b]], ['Bottom', (b) => [l, t + h - b, w, b]], ['Left', (b) => [l, t, b, h]], ['Right', (b) => [l + w - b, t, b, h]]]) {
          const b = parseFloat(st[`border${side}Width`]) * s; if (!b || st[`border${side}Style`] === 'none') continue;
          x.fillStyle = st[`border${side}Color`]; x.fillRect(...rect(b));
        }
        if (el.tagName === 'CANVAS' && el.width) { const [l2, t2, w2, h2] = at(el.getBoundingClientRect()); try { x.drawImage(el, l2, t2, w2, h2); } catch { /* an empty canvas */ } }
      }
      for (const b of plate.querySelectorAll('.st-nav button')) { // the round buttons
        const st = getComputedStyle(b), [l, t, w, h] = at(b.getBoundingClientRect()), bw = parseFloat(st.borderTopWidth) * s;
        x.beginPath(); x.arc(l + w / 2, t + h / 2, w / 2 - bw / 2, 0, Math.PI * 2);
        x.fillStyle = st.backgroundColor; x.fill(); if (bw) { x.lineWidth = bw; x.strokeStyle = st.borderTopColor; x.stroke(); }
      }
      // The words, one character at a time where the browser put it (so wrapping, letter spacing and fonts match).
      const range = document.createRange(), fonts = new Map();
      for (const root of [page, plate.querySelector('.st-nav')]) {
        if (!root) continue;
        const walk = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          const el = n.parentElement, st = getComputedStyle(el);
          if (st.visibility === 'hidden' || !n.data.trim()) continue;
          const font = `${st.fontStyle} ${st.fontWeight} ${parseFloat(st.fontSize) * s}px ${st.fontFamily}`;
          x.font = font; x.fillStyle = st.color; x.textBaseline = 'alphabetic';
          if (!fonts.has(font)) { const m = x.measureText('国Hg'); fonts.set(font, m.fontBoundingBoxAscent ?? m.actualBoundingBoxAscent ?? parseFloat(st.fontSize) * s * 0.8); }
          const asc = fonts.get(font);
          let i = 0;
          for (const ch of n.data) {
            const j = i + ch.length;
            if (ch.trim()) { range.setStart(n, i); range.setEnd(n, j); const r = range.getClientRects()[0]; if (r && r.width) x.fillText(ch, r.left - pr.left, r.top - pr.top + asc); }
            i = j;
          }
        }
      }
      for (const ic of plate.querySelectorAll('.st-page .ico-ext, .st-nav .ico-ext')) { // the arrows
        const st = getComputedStyle(ic), [l, t, w, h] = at(ic.getBoundingClientRect());
        if (!w) continue;
        const kind = ['right', 'left', 'up', 'down'].find((k) => ic.classList.contains('ico-' + k)) || 'ext';
        const metal = st.getPropertyValue('--metal').trim();
        x.save(); x.translate(l, t); x.scale(w / 16, h / 16);
        x.strokeStyle = /^(#|rgb|hsl|color)/.test(metal) ? metal : st.color; x.lineWidth = 2.1; x.lineCap = 'round'; x.lineJoin = 'round';
        for (const d of ICONS[kind]) x.stroke(new Path2D(d));
        x.restore();
      }
      return c;
    }
    function upload(t, c) {
      gl.bindTexture(gl.TEXTURE_2D, t);
      gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, true);
      gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, c);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
      gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE); gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
    }

    // ── one frame: the page beneath (turning back), its shadow, the curling page ──
    let under = false;
    function bind(L, pos, uv) {
      gl.bindBuffer(gl.ARRAY_BUFFER, pos); gl.enableVertexAttribArray(L.p); gl.vertexAttribPointer(L.p, 4, gl.FLOAT, false, 0, 0);
      if (L.uv >= 0) { gl.bindBuffer(gl.ARRAY_BUFFER, uv); gl.enableVertexAttribArray(L.uv); gl.vertexAttribPointer(L.uv, 2, gl.FLOAT, false, 0, 0); }
    }
    function flat() { fverts.set([0, 0, 0, 1, W, 0, 0, 1, 0, H, 0, 1, W, H, 0, 1]); gl.bindBuffer(gl.ARRAY_BUFFER, buf.fpos); gl.bufferData(gl.ARRAY_BUFFER, fverts, gl.DYNAMIC_DRAW); }
    function draw(G, F) {
      if (lost) return;
      const f = C.fold(G, F, W);
      gl.viewport(0, 0, cv.width, cv.height);
      gl.clearColor(0, 0, 0, 0); gl.clearDepth(1); gl.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT);
      gl.enable(gl.BLEND); gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA); gl.disable(gl.CULL_FACE); gl.frontFace(gl.CW);
      flat();
      gl.disable(gl.DEPTH_TEST);
      if (under) { // turning back: the page we are leaving lies beneath
        gl.useProgram(prog); gl.uniform2f(L1.size, W, H); gl.uniform1f(L1.mode, 1);
        gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.under); gl.uniform1i(L1.tex, 0);
        bind(L1, buf.fpos, buf.fuv); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.fidx); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
      if (f) {
        gl.useProgram(shade); gl.uniform2f(L2.size, W, H); gl.uniform4f(L2.fold, f.lx, f.ly, f.nx, f.ny); gl.uniform1f(L2.r, f.R);
        gl.uniform1f(L2.dark, dark * Math.min(1, (1 - C.progress(G, F, W)) * 4));
        bind(L2, buf.fpos, buf.fuv); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.fidx); gl.drawElements(gl.TRIANGLES, 6, gl.UNSIGNED_SHORT, 0);
      }
      gl.enable(gl.DEPTH_TEST); gl.depthFunc(gl.LEQUAL);
      C.mesh(f, G0.uv, W, H, verts);
      gl.useProgram(prog); gl.uniform2f(L1.size, W, H); gl.uniform1f(L1.mode, 0); gl.uniform3f(L1.back, ...back);
      gl.activeTexture(gl.TEXTURE0); gl.bindTexture(gl.TEXTURE_2D, tex.top); gl.uniform1i(L1.tex, 0);
      gl.bindBuffer(gl.ARRAY_BUFFER, buf.pos); gl.bufferData(gl.ARRAY_BUFFER, verts, gl.DYNAMIC_DRAW);
      bind(L1, buf.pos, buf.uv); gl.bindBuffer(gl.ELEMENT_ARRAY_BUFFER, buf.idx); gl.drawElements(gl.TRIANGLES, G0.idx.length, gl.UNSIGNED_SHORT, 0);
    }

    // ── turns ──
    // A turn: dir 1 forward (the page we leave curls away over the spine, the new one is live beneath it), −1 back
    // (the previous page comes over from beyond the spine and lies down on the one we leave).
    let T = null; // { dir, G, F, undo, anim }
    function begin(dir, to) {
      measure();
      const old = snap();
      const undo = host.turn(dir, to);
      if (dir > 0) { upload(tex.top, old); under = false; } else { upload(tex.under, old); upload(tex.top, snap()); under = true; }
      cv.hidden = false; plate.classList.add('is-curling');
      T = { dir, undo, G: [W, H * 0.88], F: null, anim: 0 };
      return T;
    }
    function end(keep) {
      if (!T) return;
      cancelAnimationFrame(T.anim);
      const t = T; T = null;
      if (!keep) t.undo();
      cv.hidden = true; plate.classList.remove('is-curling'); host.hold(false);
    }
    // Animate the pulled point from where it is to `to`, then finish (keep the new page) or fall back.
    function glide(to, keep, ms, easing) {
      const t = T, from = t.F.slice(), G = t.G, t0 = performance.now();
      cancelAnimationFrame(t.anim);
      const step = (now) => {
        if (T !== t) return;
        const u = Math.min(1, (now - t0) / ms), e = easing(u);
        t.F = [from[0] + (to[0] - from[0]) * e, from[1] + (to[1] - from[1]) * e]; draw(G, t.F);
        if (u < 1) t.anim = requestAnimationFrame(step); else end(keep);
      };
      t.anim = requestAnimationFrame(step);
    }
    const outCubic = (u) => 1 - Math.pow(1 - u, 3);
    const inOut = (u) => (u < 0.5 ? 4 * u * u * u : 1 - Math.pow(-2 * u + 2, 3) / 2);

    // A turn played on its own (arrows, keys, the timer, the belt).
    function play(dir, to) {
      if (T) end(true); // a turn under way finishes at once
      if (lost) { host.turn(dir, to); return; }
      const t = begin(dir, to), MS = 1050, t0 = performance.now();
      const step = (now) => {
        if (T !== t) return;
        const u = Math.min(1, (now - t0) / MS), e = inOut(u), p = C.path(dir > 0 ? e : 1 - e, W, H);
        t.G = p.G; t.F = p.F; draw(t.G, t.F);
        if (u < 1) t.anim = requestAnimationFrame(step); else end(true);
      };
      const p0 = C.path(dir > 0 ? 0 : 1, W, H); t.G = p0.G; t.F = p0.F; draw(t.G, t.F);
      t.anim = requestAnimationFrame(step);
    }

    // ── the hand ──
    let D = null; // { id, x0, y0, last: [[t, x]], dir }
    const local = (e) => { const r = plate.getBoundingClientRect(), s = r.width / plate.offsetWidth || 1; return [(e.clientX - r.left) / s, (e.clientY - r.top) / s]; };
    let swallow = false;
    plate.addEventListener('pointerdown', (e) => {
      if (D || !e.isPrimary || e.button > 0 || e.target.closest('.st-nav') || !host.allowed()) return;
      const [x, y] = local(e);
      D = { id: e.pointerId, x0: x, y0: y, dir: 0, trail: [[e.timeStamp, x]] };
      if (e.pointerType === 'mouse' && !e.target.closest('a')) e.preventDefault(); // no text selection while pulling
    });
    plate.addEventListener('pointermove', (e) => {
      if (!D || e.pointerId !== D.id) return;
      const [x, y] = local(e);
      D.trail.push([e.timeStamp, x]); while (D.trail.length > 2 && e.timeStamp - D.trail[0][0] > 90) D.trail.shift();
      if (!D.dir) {
        const dx = x - D.x0, dy = y - D.y0;
        if (Math.abs(dx) < 8 || Math.abs(dx) < Math.abs(dy) * 1.1) { if (Math.abs(dy) > 12) D = null; return; }
        D.dir = dx < 0 ? 1 : -1; D.x0 = x; D.y0 = y;
        try { plate.setPointerCapture(e.pointerId); } catch { /* fine */ }
        swallow = true; host.hold(true);
        if (T) end(true);
        if (host.reduce() || lost) return; // no curl: the page changes when the hand lets go
        begin(D.dir);
      }
      if (!T) return;
      const p = C.pull(D.dir, W, H, D.x0, D.y0, x, y); T.G = p.G; T.F = p.F; draw(T.G, T.F);
    });
    function release(e, cancelled) {
      if (!D || e.pointerId !== D.id) return;
      const d = D; D = null;
      setTimeout(() => { swallow = false; }, 60);
      if (!d.dir) return;
      const tr = d.trail, v = tr.length > 1 ? (tr[tr.length - 1][1] - tr[0][1]) / Math.max(16, tr[tr.length - 1][0] - tr[0][0]) : 0;
      const vd = -v * d.dir; // speed in the direction of the turn
      if (!T) { // reduced motion (or no WebGL): the swipe just changes the page
        const moved = (tr[tr.length - 1][1] - d.x0) * -d.dir;
        if (!cancelled && (moved > 40 || vd > 0.35)) host.turn(d.dir); host.hold(false); return;
      }
      const p = d.dir > 0 ? C.progress(T.G, T.F, W) : 1 - C.progress(T.G, T.F, W);
      const go = !cancelled && C.settle(p, vd), out = d.dir > 0 ? go : !go;
      const target = out ? C.gone(T.G) : T.G.slice(), left = go ? 1 - p : p;
      glide(target, go, 180 + 520 * Math.min(1, left), outCubic);
    }
    plate.addEventListener('pointerup', (e) => release(e, false));
    plate.addEventListener('pointercancel', (e) => release(e, true));
    plate.addEventListener('click', (e) => { if (swallow) { e.preventDefault(); e.stopPropagation(); swallow = false; } }, true);
    plate.addEventListener('dragstart', (e) => e.preventDefault());

    return { play, busy: () => !!T, finish: () => end(true) };
  };
})();
