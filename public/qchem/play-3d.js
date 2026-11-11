/* 游乐场 16–19：立体馆（价层电子对排布、手性 R/S、密勒晶面、Bloch 球）。数学在 play-3d-models.js（纯函数，tools/play-test.mjs 测）。
   这个文件只定义 window.MOLASTRIA_PLAY_3D(kit)：play.js 把画图、成绩和翻译工具传进来，返回的游戏共用标签、地址和成绩（molastria-play）。
   三维是手写的：canvas 2D 上做透视投影、按深度排序画球和棍，不依赖 WebGL 和外部库，桌面版、离线也能玩。
   拖空白处转动视角（鼠标或单指），Tab 选中画面后方向键也能转；16 里拖的是电子对，19 里点的是门。
   界面文字写中文，由 i18n.js 翻译；分子名、说明是中英两版的数据，按站点语言取用并标 translate="no"。 */
window.MOLASTRIA_PLAY_3D = (kit) => {
  'use strict';
  const M = window.MOLASTRIA_PLAY3D;
  if (!M) return {};
  const { $, $$, t, en, pick, say, noTr, fit, colors, font, toRGB, board, best, save, renderBest } = kit;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const rows = (dl, list) => dl.replaceChildren(...list.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]));
  const L2 = (pair) => (en ? pair[1] : pair[0]);
  const deg = (v) => `${Math.round(v)}°`;
  const starText = (n) => '★'.repeat(n) + '☆'.repeat(3 - n);
  const fitR = (cv, wide, narrow) => { cv.dataset.ratio = String(cv.clientWidth && cv.clientWidth < 520 ? narrow : wide); return fit(cv); };
  function levels(box, labels, onPick, done) {
    box.replaceChildren(...labels.map((label, i) => { const b = el('button', { type: 'button', onclick: () => onPick(i) }); b.append(label); return b; }));
    return (cur) => $$('button', box).forEach((b, i) => { b.setAttribute('aria-pressed', String(i === cur)); b.toggleAttribute('data-done', done(i)); });
  }

  // ── 颜色与画球 ──────────────────────────────────────────────────────
  const mix = (a, b, f) => a.map((x, i) => Math.round(x + (b[i] - x) * f));
  const rgbs = (a, alpha = 1) => `rgba(${a[0]},${a[1]},${a[2]},${alpha})`;
  // 元素颜色（接近通行的 CPK 配色，深浅主题都看得清；H 有描边）
  const ELEMENT = { H: [236, 240, 244], C: [96, 104, 116], N: [64, 112, 220], O: [222, 70, 60], F: [140, 206, 84], Cl: [52, 176, 92], Br: [168, 62, 46], S: [226, 190, 60], P: [236, 140, 50], B: [236, 160, 150], Xe: [90, 170, 190] };
  function ball(ctx, x, y, r, base, alpha = 1, edge = null) {
    if (r <= 0.5) return;
    const g = ctx.createRadialGradient(x - r * 0.38, y - r * 0.42, r * 0.08, x, y, r);
    g.addColorStop(0, rgbs(mix(base, [255, 255, 255], 0.6), alpha));
    g.addColorStop(0.5, rgbs(base, alpha));
    g.addColorStop(1, rgbs(mix(base, [0, 0, 0], 0.45), alpha));
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill();
    if (edge) { ctx.strokeStyle = edge; ctx.lineWidth = 1; ctx.stroke(); }
  }
  const lum = (c) => (0.299 * c[0] + 0.587 * c[1] + 0.114 * c[2]) / 255;
  function label(ctx, x, y, text, base, px) {
    ctx.font = font(px, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillStyle = lum(base) > 0.6 ? '#1b2228' : '#ffffff'; ctx.fillText(text, x, y + 0.5); ctx.textBaseline = 'alphabetic';
  }
  const seg = (ctx, a, b) => { ctx.beginPath(); ctx.moveTo(a.x, a.y); ctx.lineTo(b.x, b.y); ctx.stroke(); };

  // ── 共用的三维舞台：透视投影、拖动转视角、方向键 ────────────────────────
  // R 把世界坐标转到视图坐标（x 向右、y 向上、z 朝向观察者），相机在 z = D 处
  const BASE = [0, 1, 0, 0, 0, 1, 1, 0, 0]; // 世界 x 朝观察者、y 向右、z 向上（Bloch 球和晶胞的习惯画法）
  const view = (yaw, pitch) => M.mul(M.axisAngle([1, 0, 0], pitch), M.mul(M.axisAngle([0, 1, 0], yaw), BASE));
  function stage3d(cv, o) {
    const D = o.D || 7;
    let R = o.R0.slice(), geo = { w: 1, h: 1, cx: 0, cy: 0, S: 1 }, drag = null;
    const pts = new Map();
    const pos = (e) => { const b = cv.getBoundingClientRect(); return { x: ((e.clientX - b.left) * geo.w) / (b.width || 1), y: ((e.clientY - b.top) * geo.h) / (b.height || 1) }; };
    const api = {
      get R() { return R; }, set R(m) { R = m; },
      layout(w, h, cx = w / 2, cy = h / 2, room = Math.min(w, h)) { geo = { w, h, cx, cy, S: (room * 0.5) / (o.radius * 1.12) }; },
      get S() { return geo.S; },
      project(p) { const v = M.apply(R, p), f = D / (D - v[2]); return { x: geo.cx + v[0] * geo.S * f, y: geo.cy - v[1] * geo.S * f, z: v[2], f, s: geo.S * f }; },
      // 指针落在半径 rad 的球面上朝向观察者的那一点（世界坐标）；落在球外就取轮廓上的点
      toSphere(x, y, rad) {
        const X = (x - geo.cx) / geo.S, Y = -(y - geo.cy) / geo.S, d = M.unit([X, Y, -D]), c = [0, 0, D];
        const b = M.dot(c, d), disc = b * b - (D * D - rad * rad);
        let v;
        if (disc >= 0) v = M.add(c, M.scale(d, -b - Math.sqrt(disc)));
        else { const zr = (rad * rad) / D, rr = Math.sqrt(rad * rad - zr * zr), a = Math.atan2(Y, X); v = [rr * Math.cos(a), rr * Math.sin(a), zr]; }
        return M.applyT(R, v);
      },
      turn(dx, dy) { R = M.orthonormalize(M.mul(M.axisAngle([0, 1, 0], dx), M.mul(M.axisAngle([1, 0, 0], dy), R))); o.draw(); o.turned?.(); },
      reset() { R = o.R0.slice(); o.draw(); o.turned?.(); },
    };
    cv.addEventListener('pointerdown', (e) => {
      if (e.button > 0) return;
      const p = pos(e); pts.set(e.pointerId, p);
      try { cv.setPointerCapture(e.pointerId); } catch { /* synthetic pointer */ }
      if (pts.size > 1) { drag = null; return; }
      const h = o.pick?.(p.x, p.y);
      drag = h != null ? { h, moved: false } : { last: p };
      if (h != null) o.grab?.(h);
      cv.dataset.dragging = h != null ? 'handle' : 'turn';
      e.preventDefault();
    });
    cv.addEventListener('pointermove', (e) => {
      const p = pos(e);
      if (!pts.has(e.pointerId)) { if (o.pick) cv.style.cursor = o.pick(p.x, p.y) != null ? 'grab' : ''; return; }
      pts.set(e.pointerId, p);
      if (!drag) return;
      if ('h' in drag) { drag.moved = true; o.move(drag.h, p.x, p.y); return; }
      const dx = p.x - drag.last.x, dy = p.y - drag.last.y; drag.last = p;
      api.turn(dx * 0.011, dy * 0.011);
    });
    const end = (e) => {
      pts.delete(e.pointerId);
      if (drag && 'h' in drag) o.release(drag.h, drag.moved);
      drag = null; delete cv.dataset.dragging;
    };
    cv.addEventListener('pointerup', end); cv.addEventListener('pointercancel', end);
    cv.addEventListener('keydown', (e) => {
      const step = (e.shiftKey ? 30 : 10) * (Math.PI / 180);
      const d = { ArrowLeft: [-step, 0], ArrowRight: [step, 0], ArrowUp: [0, -step], ArrowDown: [0, step] }[e.key];
      if (d && !o.key?.(e)) { e.preventDefault(); api.turn(d[0], d[1]); }
    });
    return api;
  }
  // 线框球：赤道和两条经线，前半边实线、后半边淡
  function wireSphere(ctx, st, rad, c, alpha = 0.5) {
    const circles = [[[1, 0, 0], [0, 1, 0]], [[1, 0, 0], [0, 0, 1]], [[0, 1, 0], [0, 0, 1]]];
    ctx.lineWidth = 1;
    for (const [u, v] of circles) {
      let prev = null;
      for (let i = 0; i <= 72; i++) {
        const a = (i / 72) * 2 * Math.PI, p = st.project(M.scale(M.add(M.scale(u, Math.cos(a)), M.scale(v, Math.sin(a))), rad));
        if (prev) { ctx.strokeStyle = c.strong; ctx.globalAlpha = (p.z + prev.z > 0 ? 1 : 0.35) * alpha; seg(ctx, prev, p); }
        prev = p;
      }
    }
    ctx.globalAlpha = 1;
  }
  const games = {};

  // ── 16 价层电子对排布 ─────────────────────────────────────────────────
  games.vsepr = (() => {
    const cv = $('#vs-cv'), msg = $('#vs-msg'), read = $('#vs-read'), ask = $('#vs-ask'), choices = $('#vs-choices');
    const MOL = M.molecules;
    const SHAPE = { linear: '直线形', bent: 'V 形（角形）', 'trigonal-planar': '平面三角形', 'trigonal-pyramidal': '三角锥形', 't-shaped': 'T 形', tetrahedral: '正四面体形', seesaw: '跷跷板形', 'square-planar': '平面正方形', 'trigonal-bipyramidal': '三角双锥形', 'square-pyramidal': '四方锥形', octahedral: '正八面体形', irregular: '还不规整' };
    const LP_R = 0.74; // 孤对画在离中心近一点的地方
    let k = 0, m = MOL[0], K, P, drags = 0, demo = false, ready = false, named = false, wrong = 0, anim = 0, active = -1, st, mark;
    const got = () => best.vsepr || {};
    const radiusOf = (i) => (K[i] === 'L' ? LP_R : 1);
    function choose(i) {
      k = i; m = MOL[i]; K = M.kinds(m);
      $('#vs-task').textContent = m.L ? `${m.f}：中心原子 ${m.c} 周围有 ${m.B} 个成键电子对、${m.L} 个孤对。拖动它们，让电子对之间的推斥最小。`
        : `${m.f}：中心原子 ${m.c} 周围有 ${m.B} 个成键电子对，没有孤对。拖动它们，让电子对之间的推斥最小。`;
      mark(k); scatter();
    }
    function scatter() {
      cancelAnimationFrame(anim); P = M.scatter(m); drags = 0; demo = false; ready = false; named = false; wrong = 0; active = -1;
      ask.hidden = true; say(msg, '');
      update();
    }
    function update() {
      const E = M.energy(P, K), shape = M.shapeOf(P, K), B = P.filter((_, i) => K[i] === 'B'), A = [];
      for (let i = 0; i < B.length; i++) for (let j = i + 1; j < B.length; j++) A.push(Math.round(M.angle(B[i], B[j])));
      const count = {}; for (const a of A) count[a] = (count[a] || 0) + 1;
      const angles = Object.keys(count).map(Number).sort((a, b) => a - b).map((a) => (count[a] > 1 ? `${a}° × ${count[a]}` : `${a}°`)).join('，');
      rows(read, [
        [t('推斥能'), `${E.toFixed(3)}`],
        [t('比最低高'), `${Math.max(0, ((E - m.emin) / m.emin) * 100).toFixed(1)}%`],
        [t('键角'), angles || '—'],
        [t('原子排成'), t(SHAPE[shape])],
        [t('拖动次数'), String(drags)],
      ]);
      if (!ready && M.solved(m, P, K)) arrived();
      draw();
    }
    function arrived() {
      ready = true;
      ask.hidden = false;
      choices.replaceChildren(...M.shapes.map((s) => el('button', { type: 'button', className: 'play-choice', textContent: SHAPE[s], onclick: (e) => answer(s, e.currentTarget) })));
      say(msg, demo ? '这是自动放松的结果（不计分）。原子排成了什么形状？' : `排好了！用了 ${drags} 次拖动。原子排成了什么形状？`, 'ok');
    }
    function answer(s, btn) {
      if (named) return;
      if (s !== m.shape) { wrong++; btn.dataset.mark = 'wrong'; btn.disabled = true; say(msg, '不是这个。只看原子（不看孤对）的位置再想想。', 'bad'); return; }
      named = true; btn.dataset.mark = 'right';
      $$('button', choices).forEach((b) => { b.disabled = true; });
      if (demo) { say(msg, `对：${SHAPE[m.shape]}。这次用了自动放松，不计分；按“重新撒开”自己排一次。`, 'ok'); return; }
      const N = K.length, stars = Math.max(1, (drags <= N ? 3 : drags <= 2 * N ? 2 : 1) - wrong);
      const before = got()[m.id] || 0;
      if (stars > before) { best.vsepr = { ...got(), [m.id]: stars }; save(); renderBest(); mark(k); }
      say(msg, wrong ? `对：${SHAPE[m.shape]}。${starText(stars)}（拖动 ${drags} 次，认错 ${wrong} 次；不超过 ${N} 次拖动、一次认对就是三星）` : `对：${SHAPE[m.shape]}。${starText(stars)}（拖动 ${drags} 次；不超过 ${N} 次拖动就是三星）`, 'ok');
    }
    // 松手：只让这一个电子对在别的电子对推斥下滑到最舒服的位置
    function settle(i) {
      const from = P[i], to = M.relax(P, K, 500, [i])[i], t0 = performance.now(), dur = still() ? 0 : 260;
      const step = (now) => {
        const f = dur ? Math.min(1, (now - t0) / dur) : 1;
        P = P.slice(); P[i] = M.slerp(from, to, 1 - (1 - f) * (1 - f));
        if (f < 1) { draw(); anim = requestAnimationFrame(step); } else { active = -1; update(); }
      };
      anim = requestAnimationFrame(step);
    }
    function autoRelax() {
      if (ready) return;
      cancelAnimationFrame(anim); demo = true; active = -1;
      let n = 0;
      const step = () => {
        const before = M.energy(P, K);
        P = M.relax(P, K, still() ? 4000 : 25);
        n++;
        const done = still() || n > 160 || before - M.energy(P, K) < 1e-7;
        if (!done) { draw(); anim = requestAnimationFrame(step); return; }
        update();
        if (!ready) say(msg, `所有电子对一起放松，停在了一个局部最低点：推斥能比最低高 ${(((M.energy(P, K) - m.emin) / m.emin) * 100).toFixed(1)}%。孤对的位置不对，拖动孤对换个地方再试。`, 'bad');
      };
      anim = requestAnimationFrame(step);
    }
    function draw() {
      if (!st) return;
      const { ctx, w, h } = fitR(cv, 0.72, 1), c = colors();
      st.layout(w, h);
      const items = [], center = st.project([0, 0, 0]);
      wireSphere(ctx, st, 1, c, 0.45);
      const shown = [];
      P.forEach((p, i) => {
        const q = st.project(M.scale(p, radiusOf(i)));
        shown.push([Math.round(q.x), Math.round(q.y)]);
        if (K[i] === 'B') {
          const rl = m.x === 'H' ? 0.2 : 0.27, base = ELEMENT[m.x], r = rl * q.s, a = st.project(M.scale(p, 0.3)), z = st.project(M.scale(p, 1 - rl * 0.8));
          items.push({ z: q.z / 2, fn: () => { ctx.strokeStyle = c.muted; ctx.lineWidth = Math.max(2, 0.07 * q.s); ctx.lineCap = 'round'; seg(ctx, a, z); } });
          items.push({ z: q.z, fn: () => { ball(ctx, q.x, q.y, r, base, 1, i === active ? c.gold : m.x === 'H' ? c.strong : null); if (i === active) { ctx.lineWidth = 2.5; ctx.strokeStyle = c.gold; ctx.stroke(); } label(ctx, q.x, q.y, m.x, base, Math.max(9, r * 0.8)); } });
        } else {
          const vio = toRGB(getComputedStyle(document.documentElement).getPropertyValue('--violet').trim() || '#8a63d2'), r = 0.26 * q.s;
          items.push({ z: q.z, fn: () => {
            ball(ctx, q.x, q.y, r, vio, 0.62, i === active ? c.gold : null);
            if (i === active) { ctx.lineWidth = 2.5; ctx.strokeStyle = c.gold; ctx.stroke(); }
            const side = M.unit(M.cross(M.apply(st.R, p), [0, 0, 1])), dd = r * 0.32;
            ctx.fillStyle = '#ffffff'; for (const s of [-1, 1]) { ctx.beginPath(); ctx.arc(q.x + side[0] * dd * s, q.y - side[1] * dd * s, Math.max(1.6, r * 0.12), 0, 7); ctx.fill(); }
          } });
        }
      });
      const cBase = ELEMENT[m.c] || ELEMENT.C, cr = 0.34 * center.s;
      items.push({ z: 0, fn: () => ball(ctx, center.x, center.y, cr, cBase) });
      items.sort((a, b) => a.z - b.z).forEach((x) => x.fn());
      // 中心原子的字母画在最上面，除非有原子正挡在它前面
      const hidden = P.some((p, i) => { if (K[i] !== 'B') return false; const q = st.project(p); return q.z > 0 && Math.hypot(q.x - center.x, q.y - center.y) < (m.x === 'H' ? 0.2 : 0.27) * q.s + cr * 0.4; });
      if (!hidden) label(ctx, center.x, center.y, m.c, cBase, Math.max(10, cr * 0.75));
      cv.dataset.points = JSON.stringify(shown);
      // 图例
      ctx.font = font(11.5); ctx.textAlign = 'left'; ctx.fillStyle = c.muted;
      ctx.fillText(t('紫色：孤对电子；拖动球改位置，拖空白处转视角'), 10, h - 10);
    }
    return {
      init() {
        st = stage3d(cv, {
          R0: view(-0.5, 0.3), radius: 1.3, draw,
          pick(x, y) {
            let hit = null, bestZ = -Infinity;
            P.forEach((p, i) => { const q = st.project(M.scale(p, radiusOf(i))), r = 0.3 * q.s + 10; if ((q.x - x) ** 2 + (q.y - y) ** 2 < r * r && q.z > bestZ) { bestZ = q.z; hit = i; } });
            return hit;
          },
          grab(i) { if (ready) return; cancelAnimationFrame(anim); active = i; draw(); },
          move(i, x, y) { if (ready) return; P = P.slice(); P[i] = M.unit(st.toSphere(x, y, radiusOf(i))); update(); },
          release(i, moved) { if (ready) return; if (!moved) { active = -1; draw(); return; } drags++; settle(i); },
          key(e) { // 空格：选下一个电子对；有选中的时候 WASD 推它
            if (ready) return false;
            if (e.key === ' ' || e.key === 'Enter') { e.preventDefault(); active = (active + 1) % P.length; draw(); return true; }
            const d = { a: [-1, 0], d: [1, 0], w: [0, 1], s: [0, -1] }[e.key.toLowerCase()];
            if (d && active >= 0) {
              e.preventDefault();
              const right = M.applyT(st.R, [1, 0, 0]), up = M.applyT(st.R, [0, 1, 0]), a = 0.12;
              P = P.slice(); P[active] = M.unit(M.add(P[active], M.add(M.scale(right, d[0] * a), M.scale(up, d[1] * a)))); drags++; update(); return true;
            }
            return false;
          },
        });
        mark = levels($('#vs-levels'), MOL.map((x) => noTr('span', x.f)), choose, (i) => (got()[MOL[i].id] || 0) > 0);
        $('#vs-new').addEventListener('click', scatter);
        $('#vs-auto').addEventListener('click', autoRelax);
        $('#vs-view').addEventListener('click', () => st.reset());
        const first = MOL.findIndex((x) => !got()[x.id]);
        choose(first < 0 ? 0 : first);
      },
      draw,
      bestText: (v) => { const n = Object.values(v || {}).reduce((a, b) => a + b, 0); return n ? `已得 ${n} / ${MOL.length * 3} 颗星` : ''; },
    };
  })();

  // ── 17 手性 R/S ─────────────────────────────────────────────────────
  games.chiral = (() => {
    const cv = $('#ch-cv'), msg = $('#ch-msg'), read = $('#ch-read');
    const BOND = 1.25, AWAY = 30;
    let b, mol, want, P, done = false, showRank = true, st, lastMol = null;
    // 第 4 个基团离“正对着屏幕里面”差多少度
    const away = () => M.angle(M.apply(st.R, P[3]), [0, 0, -1]);
    function next() {
      mol = pick(M.chirals.filter((x) => x !== lastMol)); lastMol = mol; want = Math.random() < 0.5 ? 'R' : 'S';
      P = M.placeChiral(want);
      // 开局让最小的基团朝着观察者偏一点，不能一上来就朝后
      do st.R = M.randomRotation(); while (away() < 80);
      done = false;
      const box = $('#ch-case'); box.setAttribute('translate', 'no');
      box.replaceChildren(el('small', { textContent: en ? 'Stereocentre of' : '手性中心' }), el('b', { textContent: L2(mol.name) }),
        el('span', { textContent: (en ? 'Priority: ' : '优先级：') + mol.groups.map((g) => g[0]).join(' > ') }), el('span', { className: 'muted', textContent: L2(mol.why) }));
      $$('#ch-ans button').forEach((x) => { x.disabled = true; delete x.dataset.mark; });
      say(msg, '');
      turned();
    }
    function turned() {
      if (!st || !P) return;
      const a = away();
      cv.dataset.away = a.toFixed(1);
      rows(read, [[t('4 号基团离正后方'), deg(a)], [t('状态'), a <= AWAY ? t('朝后了：看 1 → 2 → 3 怎么转') : t(`还要再转（${AWAY}° 以内才能作答）`)]]);
      if (!done) $$('#ch-ans button').forEach((x) => { x.disabled = a > AWAY; });
    }
    function answer(x) {
      if (done) return;
      done = true;
      const right = x === want, btn = $(`#ch-ans [data-a="${x}"]`);
      btn.dataset.mark = right ? 'right' : 'wrong';
      $$('#ch-ans button').forEach((y) => { y.disabled = true; });
      right ? b.hit() : b.miss();
      msg.setAttribute('translate', 'no');
      const note = L2(mol.note[want]);
      say(msg, right ? (en ? `Right: ${want}. ${note}` : `对了：${want}。${note}`) : (en ? `It is ${want}: from 1 through 2 to 3 runs ${want === 'R' ? 'clockwise' : 'anticlockwise'}. ${note}` : `应该是 ${want}：1 → 2 → 3 是${want === 'R' ? '顺时针' : '逆时针'}。${note}`), right ? 'ok' : 'bad');
      draw();
    }
    function draw() {
      if (!st || !P) return;
      const { ctx, w, h } = fitR(cv, 0.72, 1), c = colors();
      st.layout(w, h);
      const center = st.project([0, 0, 0]), items = [];
      const Q = P.map((p) => st.project(M.scale(p, BOND)));
      mol.groups.forEach(([lab, elem, rad], i) => {
        const q = Q[i], base = ELEMENT[elem] || ELEMENT.C, r = rad * 0.62 * q.s, a = st.project(M.scale(P[i], 0.26)), z = st.project(M.scale(P[i], BOND - rad * 0.5));
        items.push({ z: q.z / 2, fn: () => { ctx.strokeStyle = c.muted; ctx.lineWidth = Math.max(2, 0.08 * q.s); ctx.lineCap = 'round'; seg(ctx, a, z); } });
        items.push({ z: q.z, fn: () => {
          ball(ctx, q.x, q.y, r, base, 1, elem === 'H' ? c.strong : null);
          label(ctx, q.x, q.y, lab, base, Math.max(9, Math.min(r * 0.62, 16)));
          if (showRank) {
            const bx = q.x + r * 0.78, by = q.y - r * 0.78;
            ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(bx, by, 9, 0, 7); ctx.fill();
            ctx.fillStyle = '#1b2228'; ctx.font = font(11, 800); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(String(i + 1), bx, by + 0.5); ctx.textBaseline = 'alphabetic';
          }
        } });
      });
      const cr = 0.3 * center.s;
      items.push({ z: 0, fn: () => ball(ctx, center.x, center.y, cr, ELEMENT.C) });
      items.sort((a, b2) => a.z - b2.z).forEach((x) => x.fn());
      if (!Q.some((q, i) => q.z > 0 && Math.hypot(q.x - center.x, q.y - center.y) < mol.groups[i][2] * 0.62 * q.s + cr * 0.4)) label(ctx, center.x, center.y, 'C*', ELEMENT.C, Math.max(9, cr * 0.6));
      // 作答以后画出 1 → 2 → 3 的转向
      if (done) {
        ctx.strokeStyle = c.gold; ctx.lineWidth = 2.5; ctx.setLineDash([6, 4]);
        ctx.beginPath(); for (let i = 0; i <= 2; i++) { const q = Q[i]; i ? ctx.lineTo(q.x, q.y) : ctx.moveTo(q.x, q.y); } ctx.stroke(); ctx.setLineDash([]);
        const a = Q[1], z = Q[2], ang = Math.atan2(z.y - a.y, z.x - a.x), tip = { x: a.x + (z.x - a.x) * 0.7, y: a.y + (z.y - a.y) * 0.7 };
        ctx.fillStyle = c.gold; ctx.beginPath(); ctx.moveTo(tip.x + 9 * Math.cos(ang), tip.y + 9 * Math.sin(ang)); ctx.lineTo(tip.x + 7 * Math.cos(ang + 2.4), tip.y + 7 * Math.sin(ang + 2.4)); ctx.lineTo(tip.x + 7 * Math.cos(ang - 2.4), tip.y + 7 * Math.sin(ang - 2.4)); ctx.fill();
      }
      ctx.font = font(11.5); ctx.textAlign = 'left'; ctx.fillStyle = c.muted;
      ctx.fillText(t('拖动画面转动分子；金色数字是 CIP 优先级'), 10, h - 10);
    }
    return {
      init() {
        b = board('chiral');
        st = stage3d(cv, { R0: M.ID, radius: 1.75, draw, turned });
        $$('#ch-ans button').forEach((x) => x.addEventListener('click', () => answer(x.dataset.a)));
        $('#ch-next').addEventListener('click', next);
        $('#ch-rank').addEventListener('click', (e) => { showRank = !showRank; e.currentTarget.setAttribute('aria-pressed', String(showRank)); draw(); });
        next();
      },
      draw,
    };
  })();

  // ── 18 密勒晶面 ─────────────────────────────────────────────────────
  games.miller = (() => {
    const cv = $('#mi-cv'), msg = $('#mi-msg'), read = $('#mi-read');
    let b, target, mine = [1, 0, 0], done = false, peeked = false, st, last = null, streak = 0;
    // 负指数课本上写成数字上加一横；很多字体画不好组合上划线，这里写成 −1，有负数时用空格隔开
    const bar = (v) => (v < 0 ? `−${-v}` : String(v));
    const name = (m) => `(${m.map(bar).join(m.some((v) => v < 0) ? ' ' : '')})`;
    const C = [0.5, 0.5, 0.5], shift = (p) => M.sub(p, C);
    function next() {
      const s = streak;
      const pool = s < 3 ? M.millerTiers[0] : s < 6 ? [...M.millerTiers[0], ...M.millerTiers[1]] : [...M.millerTiers[1], ...M.millerTiers[2]];
      do target = pick(pool); while (last && M.millerSame(target, last) && pool.length > 1);
      last = target; done = false; peeked = false; mine = [0, 0, 1];
      if (M.millerSame(mine, target)) mine = [1, 0, 0];
      say(msg, ''); sync();
    }
    function sync() {
      $$('#mi-steps output').forEach((o, i) => { o.textContent = bar(mine[i]); });
      const zero = !mine[0] && !mine[1] && !mine[2];
      const icept = mine.map((v) => (v ? (Math.abs(v) === 1 ? (v > 0 ? '1' : '−1') : (v > 0 ? '1/2' : '−1/2')) : '∞'));
      rows(read, [[t('你的晶面'), zero ? '—' : name(mine)], [t('截距 a, b, c'), zero ? '—' : icept.join(', ')], [t('面间距'), zero ? '—' : `d = a / √${mine.reduce((s, v) => s + v * v, 0)} ≈ ${M.dSpacing(...mine).toFixed(3)} a`]]);
      $('#mi-go').disabled = done || zero;
      draw();
    }
    function check() {
      if (done) return;
      if (M.millerSame(mine, target)) {
        done = true;
        if (peeked) say(msg, `对：${name(target)}。看过答案，这一题不计分。`, 'ok');
        else {
          b.hit(); streak++;
          const same = mine.every((x, i) => x === target[i]);
          say(msg, same ? `对了：${name(target)}。` : `对了：${name(target)}。你填的 ${name(mine)} 和它是同一族晶面。`, 'ok');
        }
      } else { b.miss(); streak = 0; say(msg, `还不对：${name(mine)} 是蓝色虚线的那张面。读一读金色面在三条轴上的截距，取倒数。`, 'bad'); }
      sync();
    }
    function polyOf(m) { const pl = M.millerPlane(...m); return M.cubeSection(pl.n, pl.d); }
    function draw() {
      if (!st || !target) return;
      const { ctx, w, h } = fitR(cv, 0.72, 1), c = colors();
      st.layout(w, h);
      const P = (p) => st.project(shift(p));
      // 晶胞的棱：先画后面的
      const edges = M.EDGES.map(([a, z]) => ({ a: P(a), z: P(z) }));
      ctx.lineWidth = 1.2; ctx.strokeStyle = c.strong;
      for (const e of edges) if (e.a.z + e.z.z < 0) { ctx.globalAlpha = 0.55; seg(ctx, e.a, e.z); }
      ctx.globalAlpha = 1;
      const fill = (poly, col, alpha, dash) => {
        if (poly.length < 3) return;
        const q = poly.map(P);
        ctx.beginPath(); q.forEach((p, i) => (i ? ctx.lineTo(p.x, p.y) : ctx.moveTo(p.x, p.y))); ctx.closePath();
        ctx.globalAlpha = alpha; ctx.fillStyle = col; ctx.fill(); ctx.globalAlpha = 1;
        ctx.setLineDash(dash || []); ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.stroke(); ctx.setLineDash([]);
      };
      fill(polyOf(target), c.gold, 0.35);
      if (mine.some((v) => v) && !(done && M.millerSame(mine, target))) fill(polyOf(mine), c.info, 0.12, [6, 4]);
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1.4;
      for (const e of edges) if (e.a.z + e.z.z >= 0) seg(ctx, e.a, e.z);
      // 轴、刻度和原点
      const O = P([0, 0, 0]);
      [['a', [1, 0, 0]], ['b', [0, 1, 0]], ['c', [0, 0, 1]]].forEach(([lab, v]) => {
        const end = P(M.scale(v, 1.28)), one = P(v), half = P(M.scale(v, 0.5));
        ctx.strokeStyle = c.accent; ctx.lineWidth = 2.4; seg(ctx, O, end);
        ctx.fillStyle = c.accent; ctx.font = font(14, 700); ctx.textAlign = 'center'; ctx.fillText(lab, end.x + (end.x - O.x) * 0.08, end.y + (end.y - O.y) * 0.08 + 5);
        ctx.fillStyle = c.ink2; ctx.font = font(10.5, 600);
        for (const [p, s] of [[half, '½'], [one, '1']]) { ctx.beginPath(); ctx.arc(p.x, p.y, 2.6, 0, 7); ctx.fill(); ctx.fillText(s, p.x + 9, p.y - 6); }
      });
      ctx.fillStyle = c.ink; ctx.font = font(12, 700); ctx.textAlign = 'right'; ctx.fillText('O', O.x - 6, O.y + 14);
      ctx.font = font(11.5); ctx.textAlign = 'left'; ctx.fillStyle = c.muted;
      ctx.fillText(t('金色：要认的晶面；蓝色虚线：你填的指数；拖动画面转动晶胞'), 10, h - 10);
    }
    return {
      init() {
        b = board('miller');
        st = stage3d(cv, { R0: view(-0.62, 0.32), radius: 1.05, draw });
        $$('#mi-steps [data-d]').forEach((x) => x.addEventListener('click', () => {
          if (done) return;
          const i = +x.dataset.i; mine = mine.slice(); mine[i] = Math.max(-2, Math.min(2, mine[i] + +x.dataset.d)); sync();
        }));
        $('#mi-go').addEventListener('click', check);
        $('#mi-next').addEventListener('click', next);
        $('#mi-show').addEventListener('click', () => { if (done) return; peeked = true; mine = target.slice(); say(msg, `答案是 ${name(target)}：截距是指数的倒数，指数为 0 的轴和这张面平行。按“检查”看它和金色面重合。`); sync(); });
        next();
      },
      draw,
    };
  })();

  // ── 19 Bloch 球导航 ─────────────────────────────────────────────────
  games.bloch = (() => {
    const cv = $('#bl-cv'), msg = $('#bl-msg'), read = $('#bl-read'), pal = $('#bl-gates');
    const LV = M.blochLevels, FREE = LV.length;
    const ALL = ['H', 'X', 'Y', 'Z', 'S', 'Sdg', 'T', 'Tdg', 'SX'];
    let k = 0, L = LV[0], v, seq = [], trail = [], spin = null, anim = 0, over = false, st, mark;
    const got = () => best.bloch || {};
    const stateName = (u) => {
      const names = [[[0, 0, 1], '|0⟩'], [[0, 0, -1], '|1⟩'], [[1, 0, 0], '|+⟩'], [[-1, 0, 0], '|−⟩'], [[0, 1, 0], '|+i⟩'], [[0, -1, 0], '|−i⟩']];
      return names.find(([p]) => M.near(p, u, 1e-6))?.[1] || '';
    };
    function choose(i) {
      k = i; L = LV[i] || null;
      const gates = L ? L.gates : ALL;
      pal.replaceChildren(...gates.map((g) => { const x = noTr('button', M.gateLabel[g]); x.type = 'button'; x.className = 'cir-gate'; x.dataset.g = g; x.addEventListener('click', () => apply(g)); return x; }));
      if (L) {
        const s = stateName(L.start) || '';
        $('#bl-task').textContent = `从 ${s} 出发，只用这几个门，把箭头转到金色的目标上。最少要 ${L.min} 个门：做到就是三星，多一个两星。`;
      } else $('#bl-task').textContent = '自由玩：九个门随便用，看每个门绕哪根轴转、转多少。';
      mark(k); reset();
    }
    function reset() { cancelAnimationFrame(anim); spin = null; v = (L ? L.start : [0, 0, 1]).slice(); seq = []; trail = [v]; over = false; say(msg, ''); status(); draw(); }
    function status() {
      const th = Math.acos(Math.max(-1, Math.min(1, v[2]))), ph = Math.atan2(v[1], v[0]), p0 = Math.cos(th / 2) ** 2;
      const nm = stateName(v);
      rows(read, [
        ['Bloch (x, y, z)', v.map((x) => (Math.abs(x) < 5e-4 ? 0 : x).toFixed(3).replace('-', '−')).join(', ')],
        ['θ, φ', `${deg((th * 180) / Math.PI)}, ${Math.abs(v[0]) + Math.abs(v[1]) < 1e-6 ? '—' : deg((ph * 180) / Math.PI).replace('-', '−')}`],
        [t('测得 0 的概率'), `${(p0 * 100).toFixed(1)}%${nm ? ` · ${nm}` : ''}`],
        [t('用了几个门'), seq.length ? `${seq.length}：${seq.map((g) => M.gateLabel[g]).join(' ')}` : '0'],
      ]);
      $('#bl-undo').disabled = !seq.length || !!spin;
      $$('button', pal).forEach((x) => { x.disabled = !!spin || over; });
    }
    function apply(g) {
      if (spin || over) return;
      const G = M.gates[g], from = v.slice(), to = M.applyGate(from, g), t0 = performance.now(), dur = still() ? 0 : 520;
      seq.push(g);
      spin = { g, axis: G.axis, f: 0 };
      const step = (now) => {
        const f = dur ? Math.min(1, (now - t0) / dur) : 1, e = f < 0.5 ? 2 * f * f : 1 - 2 * (1 - f) ** 2;
        v = f < 1 ? M.rotate(from, G.axis, G.angle * e) : to;
        trail.push(v); spin.f = f;
        if (f < 1) { draw(); anim = requestAnimationFrame(step); } else { spin = null; arrived(); status(); draw(); }
      };
      status();
      anim = requestAnimationFrame(step);
    }
    function arrived() {
      if (!L || !M.near(v, L.target, 1e-6)) return;
      over = true;
      const stars = M.blochStars(L, seq.length), before = got()[L.id] || 0;
      if (stars > before) { best.bloch = { ...got(), [L.id]: stars }; save(); renderBest(); mark(k); }
      say(msg, `到了！${starText(stars)}（用了 ${seq.length} 个门，最少 ${L.min} 个）`, 'ok');
    }
    function undo() {
      if (!seq.length || spin) return;
      seq.pop(); v = seq.reduce((u, g) => M.applyGate(u, g), (L ? L.start : [0, 0, 1]).slice()); trail = [v]; over = false; say(msg, ''); status(); draw();
    }
    function draw() {
      if (!st) return;
      const { ctx, w, h } = fitR(cv, 0.72, 1), c = colors();
      st.layout(w, h);
      const O = st.project([0, 0, 0]);
      // 球面淡底
      const rim = st.project([0, 0, 0]).s;
      ctx.fillStyle = c.paper; ctx.globalAlpha = 0.6; ctx.beginPath(); ctx.arc(O.x, O.y, rim * 1.0, 0, 7); ctx.fill(); ctx.globalAlpha = 1;
      wireSphere(ctx, st, 1, c, 0.7);
      // 坐标轴与六个基本态
      const marks = [[[0, 0, 1], '|0⟩'], [[0, 0, -1], '|1⟩'], [[1, 0, 0], '|+⟩'], [[-1, 0, 0], '|−⟩'], [[0, 1, 0], '|+i⟩'], [[0, -1, 0], '|−i⟩']];
      ctx.lineWidth = 1; ctx.strokeStyle = c.muted; ctx.setLineDash([3, 4]);
      for (const ax of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) seg(ctx, st.project(M.scale(ax, -1)), st.project(M.scale(ax, 1)));
      ctx.setLineDash([]);
      for (const [p, s] of marks) { const q = st.project(M.scale(p, 1.16)); ctx.fillStyle = q.z >= -0.2 ? c.ink2 : c.muted; ctx.font = font(12, 600); ctx.textAlign = 'center'; ctx.fillText(s, q.x, q.y + 4); }
      // 正在转的门：画出转轴
      if (spin) {
        const a = st.project(M.scale(spin.axis, -1.25)), z = st.project(M.scale(spin.axis, 1.25));
        ctx.strokeStyle = c.info; ctx.lineWidth = 2; seg(ctx, a, z);
        ctx.fillStyle = c.info; ctx.font = font(12, 700); ctx.textAlign = 'left'; ctx.fillText(`${M.gateLabel[spin.g]} ${t('的转轴')}`, z.x + 6, z.y);
      }
      // 走过的路
      if (trail.length > 1) {
        ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.globalAlpha = 0.55;
        let prev = st.project(trail[0]);
        for (let i = 1; i < trail.length; i++) { const q = st.project(trail[i]); seg(ctx, prev, q); prev = q; }
        ctx.globalAlpha = 1;
      }
      // 目标
      if (L) { const q = st.project(L.target); ctx.strokeStyle = c.gold; ctx.lineWidth = 3; ctx.globalAlpha = q.z < 0 ? 0.55 : 1; ctx.beginPath(); ctx.arc(q.x, q.y, 9, 0, 7); ctx.stroke(); ctx.beginPath(); ctx.arc(q.x, q.y, 3, 0, 7); ctx.fillStyle = c.gold; ctx.fill(); ctx.globalAlpha = 1; }
      // 态矢量
      const tip = st.project(v), acc = toRGB(c.accent);
      ctx.strokeStyle = c.accent; ctx.lineWidth = 3; seg(ctx, O, tip);
      ball(ctx, tip.x, tip.y, 0.07 * tip.s, acc);
      ball(ctx, O.x, O.y, 3, toRGB(c.ink2));
      cv.dataset.state = v.map((x) => x.toFixed(3)).join(',');
      ctx.font = font(11.5); ctx.textAlign = 'left'; ctx.fillStyle = c.muted;
      ctx.fillText(t('箭头是量子比特的态；金圈是目标；拖动画面转动球'), 10, h - 10);
    }
    return {
      init() {
        st = stage3d(cv, { R0: view(-0.55, 0.28), radius: 1.3, draw });
        mark = levels($('#bl-levels'), [...LV.map((x) => noTr('span', L2(x.name))), t('自由玩')], choose, (i) => i < FREE && (got()[LV[i].id] || 0) > 0);
        $('#bl-undo').addEventListener('click', undo);
        $('#bl-reset').addEventListener('click', reset);
        const first = LV.findIndex((x) => !got()[x.id]);
        choose(first < 0 ? 0 : first);
      },
      draw,
      bestText: (v2) => { const n = Object.values(v2 || {}).reduce((a, b2) => a + b2, 0); return n ? `已得 ${n} / ${LV.length * 3} 颗星` : ''; },
    };
  })();

  return games;
};
