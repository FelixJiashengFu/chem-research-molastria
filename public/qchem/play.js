/* 游乐场：标签切换、01–06 六个小游戏（07–14 在 play-quantum.js，15 在 play-wave2d.js，16–19 立体馆在 play-3d.js），以及量子化学计算器 QChem Web（iframe，第一次打开那个标签时才加载）。
   物理在 play-models.js（纯函数，tools/play-test.mjs 测）。界面文字写中文，由 i18n.js 翻译；元素名、环名、谱系名
   按站点语言取用并标 translate="no"；画在 canvas 上的文字用 ChemI18n.t 翻译，词典到了以后重画。成绩存在 molastria-play。 */
(() => {
  'use strict';
  const P = window.MOLASTRIA_PLAY;
  if (!P) return;
  const root = document.documentElement, en = root.lang === 'en';
  const $ = (s, r = document) => r.querySelector(s), $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const t = (s) => (window.ChemI18n ? window.ChemI18n.t(s) : s);
  const rnd = (n) => Math.floor(Math.random() * n), pick = (a) => a[rnd(a.length)];
  const shuffle = (a) => { const b = [...a]; for (let i = b.length - 1; i > 0; i--) { const j = rnd(i + 1); [b[i], b[j]] = [b[j], b[i]]; } return b; };
  const sup = (s) => String(s).replace(/[-0-9]/g, (c) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(c)]);
  const sci = (v, d = 2) => { const e = Math.floor(Math.log10(Math.abs(v))); return `${(v / 10 ** e).toFixed(d - 1)} × 10${sup(e)}`; };
  const pct = (v) => { const p = v * 100; if (p === 0) return '0%'; if (p < 0.01) return `${sci(p)}%`; return `${p >= 99 ? p.toFixed(2) : Number(p.toPrecision(3))}%`; };
  const say = (el, text, tone = '') => { el.textContent = text; el.dataset.tone = tone; };
  const noTr = (tag, text) => { const e = document.createElement(tag); e.setAttribute('translate', 'no'); e.textContent = text; return e; };

  // ── 成绩 ──────────────────────────────────────────────────────────────
  const KEY = 'molastria-play';
  let best = {};
  try { best = JSON.parse(localStorage.getItem(KEY)) || {}; } catch { best = {}; }
  const save = () => { window.MolAstriaActivity?.('play'); try { localStorage.setItem(KEY, JSON.stringify(best)); } catch { /* private mode */ } };
  function renderBest() {
    for (const el of $$('[data-best]')) {
      const id = el.dataset.best, v = best[id];
      el.textContent = games[id]?.bestText ? games[id].bestText(v) : id === 'tunnel' ? (v?.length ? `已过 ${v.length} / ${MISSIONS.length} 关` : '')
        : id === 'box' ? (v ? `已调出 ${v} 种颜色` : '')
        : v ? `最佳连续答对 ${v} 题` : '';
    }
  }
  function board(id) {
    const el = $(`[data-score="${id}"]`);
    let streak = 0;
    const show = () => { el.textContent = `连续答对 ${streak} · 最佳 ${best[id] || 0}`; };
    show();
    return {
      hit() { streak++; if (streak > (best[id] || 0)) { best[id] = streak; save(); renderBest(); } show(); },
      miss() { streak = 0; show(); },
    };
  }

  // ── 画图工具 ──────────────────────────────────────────────────────────
  const colors = () => { const s = getComputedStyle(root), g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), line: g('--line'), strong: g('--line-strong'), paper: g('--paper'), surface: g('--surface'), accent: g('--accent-text'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), ok: g('--ok') }; };
  function fit(cv) {
    if (!cv.dataset.ratio) cv.dataset.ratio = String(cv.height / cv.width);
    const w = Math.max(220, cv.clientWidth || 600), h = Math.round(w * Number(cv.dataset.ratio)), dpr = Math.min(2, window.devicePixelRatio || 1);
    if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
    const ctx = cv.getContext('2d');
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, w, h);
    return { ctx, w, h };
  }
  const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  const toRGB = (() => {
    let k = null;
    return (col) => {
      if (!k) { const c = document.createElement('canvas'); c.width = c.height = 1; k = c.getContext('2d', { willReadFrequently: true }); }
      k.clearRect(0, 0, 1, 1); k.fillStyle = '#000'; k.fillStyle = col; k.fillRect(0, 0, 1, 1);
      return [...k.getImageData(0, 0, 1, 1).data.slice(0, 3)];
    };
  })();
  // vertical arrow from y0 to y1 (the head at y1)
  function arrow(ctx, x, y0, y1, color, width = 1.6, head = 4.5) {
    const d = y1 < y0 ? 1 : -1;
    ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
    ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y1 + d * head * 1.4); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(x, y1); ctx.lineTo(x - head * 0.85, y1 + d * head * 1.7); ctx.lineTo(x + head * 0.85, y1 + d * head * 1.7); ctx.closePath(); ctx.fill();
  }
  const spin = (ctx, x, y, up, color) => (up ? arrow(ctx, x, y + 9, y - 9, color, 1.5, 3.5) : arrow(ctx, x, y - 9, y + 9, color, 1.5, 3.5));
  const visible = (nm) => nm >= 380 && nm <= 780;

  const games = {};

  // ── 01 盒中粒子调颜色 ────────────────────────────────────────────────
  games.box = (() => {
    const n = $('#box-n'), l = $('#box-l'), cv = $('#box-cv'), msg = $('#box-msg'), score = $('[data-score="box"]');
    let target = 0, solved = false, hinted = false, wins = 0, ready = false;
    const swatch = (el, nm) => { el.style.background = visible(nm) ? rgb(P.wavelengthRGB(nm)) : ''; };
    const showScore = () => { score.textContent = `本次已调出 ${wins} 种 · 累计 ${best.box || 0} 种`; };
    function newTarget() {
      do target = 430 + rnd(251); while (Math.abs(P.boxLambda(+l.value, +n.value) - target) <= 20);
      solved = false; hinted = false;
      swatch($('#box-target'), target);
      $('#box-target-v').textContent = '？';
      say(msg, '');
      update();
    }
    function update() {
      const N = +n.value, L = +l.value, lam = P.boxLambda(L, N);
      $('#box-n-v').textContent = String(N);
      $('#box-l-v').textContent = `${L.toFixed(2)} nm`;
      swatch($('#box-mine'), lam);
      $('#box-mine-v').textContent = lam < 380 ? `${Math.round(lam)} nm（紫外）` : lam > 780 ? `${Math.round(lam)} nm（红外）` : `${Math.round(lam)} nm`;
      $('#box-seen').style.background = visible(lam) ? rgb(P.seenColour(lam)) : '';
      if (!solved && Math.abs(lam - target) <= 8) {
        solved = true;
        $('#box-target-v').textContent = `${target} nm`;
        if (hinted) say(msg, `调出来了：吸收 ${Math.round(lam)} nm，目标 ${target} nm。看过提示，这次不计分。`, 'ok');
        else { wins++; best.box = (best.box || 0) + 1; save(); renderBest(); say(msg, `成功！吸收 ${Math.round(lam)} nm，目标 ${target} nm。`, 'ok'); }
      } else if (!solved) {
        say(msg, lam > target ? '吸收的波长太长（偏红）：缩短盒子，或增加 π 电子数。' : '吸收的波长太短（偏蓝）：加长盒子，或减少 π 电子数。');
      }
      showScore();
      draw();
    }
    function draw() {
      if (!ready) return;
      const { ctx, w, h } = fit(cv), c = colors();
      const N = +n.value, L = +l.value, homo = N / 2, top = homo + 2, lo = Math.max(1, homo - 3), lam = P.boxLambda(L, N);
      const E = (k) => P.boxLevel(k, L);
      const pad = { l: 70, r: w < 420 ? 64 : 120, t: 18, b: 26 }, H = h - pad.t - pad.b;
      const e0 = E(lo) - (E(lo + 1) - E(lo)) * 0.5, e1 = E(top) + (E(top) - E(top - 1)) * 0.25;
      const Y = (e) => pad.t + H - ((e - e0) / (e1 - e0)) * H, x0 = pad.l, x1 = w - pad.r, cx = x0 + (x1 - x0) * 0.36;
      ctx.font = font(11); ctx.fillStyle = c.muted;
      ctx.save(); ctx.translate(13, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.textAlign = 'center'; ctx.fillText(t('能量 (eV)'), 0, 0); ctx.restore();
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x0 - 10, pad.t); ctx.lineTo(x0 - 10, pad.t + H); ctx.stroke();
      if (lo > 1) { ctx.textAlign = 'left'; ctx.fillText(t(`更低的 ${lo - 1} 个能级也已填满`), x0, h - 6); }
      for (let k = lo; k <= top; k++) {
        const y = Y(E(k)), frontier = k === homo || k === homo + 1;
        ctx.strokeStyle = frontier ? c.ink : c.strong; ctx.lineWidth = frontier ? 2 : 1.2;
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'right'; ctx.fillText(E(k).toFixed(2), x0 - 16, y + 4);
        ctx.textAlign = 'left'; ctx.fillText(`n = ${k}`, x1 + 8, y + 4);
        if (frontier && w >= 420) { ctx.fillStyle = c.ink2; ctx.font = font(11, 600); ctx.fillText(k === homo ? 'HOMO' : 'LUMO', x1 + 54, y + 4); }
        if (k <= homo) { spin(ctx, cx - 9, y, true, c.gold); spin(ctx, cx + 9, y, false, c.gold); }
      }
      const yh = Y(E(homo)), yl = Y(E(homo + 1)), ax = x0 + (x1 - x0) * 0.72, col = visible(lam) ? rgb(P.wavelengthRGB(lam)) : c.muted;
      arrow(ctx, ax, yh - 3, yl + 3, col, 3, 6);
      ctx.fillStyle = c.ink; ctx.font = font(12, 600); ctx.textAlign = 'left';
      ctx.fillText(`hν · ${Math.round(lam)} nm`, ax + 10, (yh + yl) / 2 + 4);
    }
    return {
      init() {
        n.addEventListener('input', update); l.addEventListener('input', update);
        $('#box-new').addEventListener('click', newTarget);
        $('#box-hint').addEventListener('click', () => { if (solved) return; hinted = true; $('#box-target-v').textContent = `${target} nm`; });
        ready = true; newTarget();
      },
      draw,
    };
  })();

  // ── 02 猜轨道 ───────────────────────────────────────────────────────
  games.orbital = (() => {
    const cv = $('#orb-cv'), box = $('#orb-choices'), msg = $('#orb-msg');
    let b, cur = null, done = false, img = null;
    function ask() {
      const prev = cur;
      cur = pick(P.orbitals.filter((o) => o !== prev));
      // distractors: two that share n or l with the answer, then any
      const others = shuffle(P.orbitals.filter((o) => o !== cur)), near = others.filter((o) => o.n === cur.n || o.l === cur.l).slice(0, 2);
      const opts = shuffle([cur, ...near, ...others.filter((o) => !near.includes(o)).slice(0, 3 - near.length)]);
      box.replaceChildren(...opts.map((o) => {
        const bt = noTr('button', P.orbitalLabel[o.id]);
        bt.type = 'button'; bt.className = 'play-choice'; bt.dataset.id = o.id;
        bt.addEventListener('click', () => answer(bt));
        return bt;
      }));
      done = false; img = null; say(msg, ''); draw();
    }
    function answer(bt) {
      if (done) return;
      done = true;
      const right = bt.dataset.id === cur.id, nd = P.nodes(cur), name = P.orbitalLabel[cur.id];
      for (const x of $$('.play-choice', box)) { x.disabled = true; if (x.dataset.id === cur.id) x.dataset.mark = 'right'; }
      if (!right) bt.dataset.mark = 'wrong';
      if (right) { b.hit(); say(msg, `答对了！${name}：径向节点 ${nd.radial} 个，角向节点 ${nd.angular} 个。`, 'ok'); }
      else { b.miss(); say(msg, `不对，这是 ${name}：径向节点 ${nd.radial} 个，角向节点 ${nd.angular} 个。`, 'bad'); }
    }
    function render(o) {
      const S = 200, data = new Float32Array(S * S);
      let max = 0;
      for (let j = 0; j < S; j++) for (let i = 0; i < S; i++) {
        const x = (((i + 0.5) / S) * 2 - 1) * o.extent, z = (1 - ((j + 0.5) / S) * 2) * o.extent, v = P.psi(o, x, z);
        data[j * S + i] = v; if (v * v > max) max = v * v;
      }
      return { S, data, max };
    }
    function draw() {
      if (!cur) return;
      const { ctx, w, h } = fit(cv), c = colors();
      img = img || render(cur);
      const { S, data, max } = img, bg = toRGB(c.paper), pos = toRGB(c.gold), neg = toRGB(c.info);
      const off = document.createElement('canvas'); off.width = off.height = S;
      const octx = off.getContext('2d'), id = octx.createImageData(S, S);
      for (let p = 0; p < S * S; p++) {
        const v = data[p], s = Math.pow((v * v) / max, 0.35), col = v >= 0 ? pos : neg;
        for (let k = 0; k < 3; k++) id.data[p * 4 + k] = bg[k] + (col[k] - bg[k]) * s;
        id.data[p * 4 + 3] = 255;
      }
      octx.putImageData(id, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(off, 0, 0, w, h);
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.setLineDash([3, 4]);
      ctx.beginPath(); ctx.moveTo(w / 2, 0); ctx.lineTo(w / 2, h); ctx.moveTo(0, h / 2); ctx.lineTo(w, h / 2); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.muted; ctx.font = font(12, 600); ctx.textAlign = 'left'; ctx.fillText('x', w - 16, h / 2 - 6); ctx.fillText('z', w / 2 + 6, 14);
      const bar = cur.extent > 15 ? 10 : 2, px = (bar / (2 * cur.extent)) * w;
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(12, h - 14); ctx.lineTo(12 + px, h - 14); ctx.stroke();
      ctx.fillStyle = c.ink2; ctx.font = font(11); ctx.fillText(`${bar} a₀`, 12, h - 20);
    }
    return { init() { b = board('orbital'); $('#orb-next').addEventListener('click', ask); ask(); }, draw };
  })();

  // ── 03 电子排布 ─────────────────────────────────────────────────────
  games.config = (() => {
    const grid = $('#cfg-grid'), msg = $('#cfg-msg');
    let b, Z = 0, boxes = {}, tainted = false;
    const cfgText = (occ) => P.subshells.filter(([s]) => occ[s]).map(([s]) => s + sup(occ[s])).join(' ');
    function paint() {
      let placed = 0;
      for (const [s] of P.subshells) {
        const btns = $$(`[data-s="${s}"] .cfg-box`, grid);
        boxes[s].forEach((v, i) => {
          placed += v;
          btns[i].replaceChildren(...Array.from({ length: v }, (_, k) => { const a = document.createElement('i'); if (k) a.className = 'down'; return a; }));
          btns[i].setAttribute('aria-label', `${s} 轨道 ${i + 1}：${v} 个电子`);
        });
      }
      $('#cfg-count').textContent = `已放 ${placed} / ${Z} 个电子`;
    }
    function build() {
      grid.replaceChildren(...P.subshells.map(([s, cap]) => {
        const row = document.createElement('div'); row.className = 'cfg-row'; row.dataset.s = s;
        const lab = noTr('b', s), wrap = document.createElement('div'); wrap.className = 'cfg-boxes';
        for (let i = 0; i < cap / 2; i++) {
          const bt = document.createElement('button'); bt.type = 'button'; bt.className = 'cfg-box';
          bt.addEventListener('click', () => { boxes[s][i] = (boxes[s][i] + 1) % 3; paint(); });
          wrap.append(bt);
        }
        row.append(lab, wrap);
        return row;
      }));
    }
    const clear = () => { for (const [s, cap] of P.subshells) boxes[s] = Array(cap / 2).fill(0); };
    function next() {
      const prev = Z;
      do Z = 1 + rnd(36); while (Z === prev);
      const [sym, zh, enName] = P.elements[Z], el = $('#cfg-el');
      el.setAttribute('translate', 'no');
      el.replaceChildren(Object.assign(document.createElement('sub'), { textContent: String(Z) }), Object.assign(document.createElement('b'), { textContent: sym }), Object.assign(document.createElement('span'), { textContent: en ? enName : zh }));
      tainted = false; clear(); say(msg, ''); paint();
    }
    function check() {
      const r = P.checkConfig(Z, boxes), sym = P.elements[Z][0];
      if (r.ok) {
        if (!tainted) b.hit();
        say(msg, `正确！${sym}：${cfgText(P.config(Z))}`, 'ok');
        return;
      }
      if (!tainted) { tainted = true; b.miss(); }
      if (r.rule === 'count') say(msg, `电子数不对：放了 ${r.total} 个，${sym} 有 ${Z} 个电子。`, 'bad');
      else if (r.rule === 'hund') say(msg, `${r.subshell} 亚层不符合洪特规则：先在每个轨道各放一个自旋平行的电子，再成对。`, 'bad');
      else {
        const [s, got, want] = r.problems[0], only43 = r.problems.every(([x]) => x === '4s' || x === '3d');
        say(msg, !only43 ? `${s} 亚层应该有 ${want} 个电子，你放了 ${got} 个。按 1s 2s 2p 3s 3p 4s 3d 4p 的顺序填。`
          : Z === 24 ? '铬是例外：实验测得的基态是 [Ar] 3d⁵4s¹，不是 3d⁴4s²。'
          : Z === 29 ? '铜是例外：实验测得的基态是 [Ar] 3d¹⁰4s¹，不是 3d⁹4s²。'
          : `${s} 亚层应该有 ${want} 个电子，你放了 ${got} 个。按 1s 2s 2p 3s 3p 4s 3d 4p 的顺序填。`, 'bad');
      }
    }
    function reveal() {
      const occ = P.config(Z);
      for (const [s, cap] of P.subshells) { // Hund: singles first, then pairs
        const m = cap / 2, k = occ[s];
        boxes[s] = Array.from({ length: m }, (_, i) => (k <= m ? (i < k ? 1 : 0) : i < k - m ? 2 : 1));
      }
      if (!tainted) { tainted = true; b.miss(); }
      paint(); say(msg, `答案：${cfgText(occ)}`);
    }
    return {
      init() {
        b = board('config'); build();
        $('#cfg-check').addEventListener('click', check);
        $('#cfg-clear').addEventListener('click', () => { clear(); paint(); say(msg, ''); });
        $('#cfg-show').addEventListener('click', reveal);
        $('#cfg-new').addEventListener('click', next);
        next();
      },
      draw() {},
    };
  })();

  // ── 04 量子隧穿闯关 ─────────────────────────────────────────────────
  const MISSIONS = [
    { p: 'e', E: 0.5, V: 1, a: 0.2, free: 'a', range: [0.05, 1.5, 0.01], goal: [0.09, 0.11], text: '电子的能量是 0.5 eV，势垒高 1 eV。调势垒宽度，让 9% 到 11% 的电子穿过去。' },
    { p: 'e', E: 0.5, V: 2, a: 0.2, free: 'E', range: [0.05, 1.99, 0.01], goal: [0.5, 0.6], text: '势垒高 2 eV、宽 0.2 nm，电子的能量始终低于势垒。调能量，让透射率落在 50% 到 60%。' },
    { p: 'p', E: 0.5, V: 1, a: 0.05, free: 'a', range: [0.005, 0.1, 0.001], goal: [0.01, 1], text: '换成质子，能量和势垒高度与第 1 关相同。质子比电子重 1836 倍：势垒要窄到多少，才有 1% 以上的质子穿过去？' },
    { p: 'e', E: 1.6, V: 1, a: 1, free: 'E', range: [1.01, 3, 0.001], goal: [0.999, 1.0001], text: '能量高过势垒，电子也可能被弹回来。势垒高 1 eV、宽 1 nm：找一个能量，让透射率超过 99.9%（共振透射）。' },
  ];
  games.tunnel = (() => {
    const sE = $('#tun-e'), sV = $('#tun-v'), sA = $('#tun-a'), cv = $('#tun-cv'), msg = $('#tun-msg'), read = $('#tun-read');
    const FREE = { E: [0.05, 3, 0.01, 0.8], V: [0.1, 3, 0.01, 1], a: [0.01, 1.5, 0.01, 0.3] };
    let mode = 0, particle = 'e', res = null, anim = 0, shots = null;
    const mass = () => (particle === 'p' ? P.const.mp : P.const.me);
    const setRange = (s, [min, max, step], v) => { s.min = min; s.max = max; s.step = step; s.value = v; };
    function choose(m) {
      mode = m; cancelAnimationFrame(anim); shots = null;
      $$('#tun-missions button').forEach((x, i) => x.setAttribute('aria-pressed', String(i === m)));
      const M = MISSIONS[m];
      if (M) {
        particle = M.p;
        setRange(sE, M.free === 'E' ? M.range : FREE.E, M.E);
        setRange(sV, FREE.V, M.V);
        setRange(sA, M.free === 'a' ? M.range : FREE.a, M.a);
        sE.disabled = M.free !== 'E'; sV.disabled = true; sA.disabled = M.free !== 'a';
        $('#tun-task').textContent = M.text;
      } else {
        setRange(sE, FREE.E, FREE.E[3]); setRange(sV, FREE.V, FREE.V[3]); setRange(sA, FREE.a, FREE.a[3]);
        sE.disabled = sV.disabled = sA.disabled = false;
        $('#tun-task').textContent = '自由玩：随便调三个参数，换成质子试试，再发射一批粒子看看。';
      }
      $$('#tun-particle button').forEach((x) => { x.setAttribute('aria-pressed', String(x.dataset.p === particle)); x.disabled = !!M; });
      update();
    }
    const goalText = (g) => (g[1] >= 1 ? `≥ ${pct(g[0])}` : `${pct(g[0])} – ${pct(g[1])}`);
    function update() {
      cancelAnimationFrame(anim); shots = null;
      const E = +sE.value, V = +sV.value, a = +sA.value, M = MISSIONS[mode];
      $('#tun-e-v').textContent = `${E.toFixed(M?.free === 'E' && M.range[2] < 0.01 ? 3 : 2)} eV`;
      $('#tun-v-v').textContent = `${V.toFixed(2)} eV`;
      $('#tun-a-v').textContent = `${a < 0.1 ? a.toFixed(3) : a.toFixed(2)} nm`;
      res = P.barrier(E, V, a, mass());
      const lamDB = ((2 * Math.PI) / res.k) * 1e9;
      const rows = [['透射概率 T', pct(res.T)], ['反射概率 R', pct(res.R)], ['德布罗意波长', `${lamDB.toPrecision(3)} nm`]];
      if (E < V) rows.push(['势垒里的衰减长度 1/κ', `${((P.const.hbar / Math.sqrt(2 * mass() * (V - E) * P.const.eV)) * 1e9).toPrecision(3)} nm`]);
      read.replaceChildren(...rows.flatMap(([k, v]) => [Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v })]));
      if (M) {
        const won = res.T >= M.goal[0] && res.T <= M.goal[1];
        if (won) {
          best.tunnel = [...new Set([...(best.tunnel || []), mode])].sort();
          save(); renderBest(); markDone();
          say(msg, `过关！透射率 ${pct(res.T)}。`, 'ok');
        } else say(msg, `透射率 ${pct(res.T)}，目标 ${goalText(M.goal)}。`);
      } else say(msg, `透射率 ${pct(res.T)}，反射率 ${pct(res.R)}。`);
      draw();
    }
    const markDone = () => $$('#tun-missions button').forEach((x, i) => x.toggleAttribute('data-done', (best.tunnel || []).includes(i)));
    function view() {
      const a = +sA.value, lamDB = ((2 * Math.PI) / res.k) * 1e9, L = Math.max(1.2 * a, 1.6 * lamDB);
      return { x0: -L, x1: a + L, a };
    }
    function draw() {
      if (!res) return;
      const { ctx, w, h } = fit(cv), c = colors(), E = +sE.value, V = +sV.value, { x0, x1, a } = view();
      const pad = { l: 46, r: 14, t: 16 }, bandH = Math.max(46, h * 0.16), plotB = h - bandH - 34, W = w - pad.l - pad.r, H = plotB - pad.t;
      const X = (x) => pad.l + ((x - x0) / (x1 - x0)) * W;
      const xs = Array.from({ length: 600 }, (_, i) => x0 + ((x1 - x0) * i) / 599);
      const d = xs.map((x) => { const z = res.psi(x); return z.re * z.re + z.im * z.im; });
      const dmax = Math.max(...d), top = Math.max(V, E) * 1.55, Y = (e) => pad.t + H - (e / top) * H, s = (0.3 * top) / dmax;
      // axes
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, plotB); ctx.lineTo(w - pad.r, plotB); ctx.stroke();
      ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'center';
      const step = niceStep((x1 - x0) / 5);
      for (let v = Math.ceil(x0 / step) * step; v <= x1 + 1e-9; v += step) { ctx.fillText(fmtTick(v), X(v), plotB + 14); }
      ctx.fillText('x (nm)', pad.l + W / 2, plotB + 28);
      ctx.save(); ctx.translate(12, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(t('能量 (eV)'), 0, 0); ctx.restore();
      // barrier
      ctx.fillStyle = c.strong; ctx.globalAlpha = 0.55; ctx.fillRect(X(0), Y(V), X(a) - X(0), plotB - Y(V)); ctx.globalAlpha = 1;
      ctx.fillStyle = c.ink2; ctx.textAlign = 'left'; ctx.font = font(11, 600);
      ctx.fillText(`V₀ = ${V.toFixed(2)} eV`, Math.min(X(a) + 6, w - pad.r - 90), Y(V) + 13);
      // energy line
      ctx.strokeStyle = c.accent; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(pad.l, Y(E)); ctx.lineTo(w - pad.r, Y(E)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.accent; ctx.fillText(`E = ${E.toFixed(+sE.step < 0.01 ? 3 : 2)} eV`, pad.l + 6, Y(E) - 6);
      // |ψ|² riding on the energy line
      ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip();
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2; ctx.beginPath();
      xs.forEach((x, i) => { const yy = Y(E) - (d[i] * s / top) * H; if (i) ctx.lineTo(X(x), yy); else ctx.moveTo(X(x), yy); });
      ctx.stroke(); ctx.restore();
      ctx.fillStyle = c.gold; ctx.font = font(11, 600); ctx.textAlign = 'right'; ctx.fillText('|ψ|²', w - pad.r - 4, Math.max(pad.t + 10, Y(E) - (d[d.length - 1] * s / top) * H - 6));
      // particle band
      const by = plotB + 40, bh = bandH - 8;
      ctx.fillStyle = c.paper; ctx.fillRect(pad.l, by, W, bh);
      ctx.fillStyle = c.strong; ctx.globalAlpha = 0.5; ctx.fillRect(X(0), by, Math.max(2, X(a) - X(0)), bh); ctx.globalAlpha = 1;
      if (shots) {
        for (const q of shots.list) if (q.x !== null) { ctx.fillStyle = q.pass ? c.ok : c.warn; ctx.beginPath(); ctx.arc(pad.l + q.x * W, by + q.y * bh, 3.2, 0, 7); ctx.fill(); }
        ctx.fillStyle = c.ink2; ctx.font = font(11, 600);
        ctx.textAlign = 'left'; ctx.fillText(t(`弹回 ${shots.back}`), pad.l + 4, by - 4);
        ctx.textAlign = 'right'; ctx.fillText(t(`穿过 ${shots.through}`), w - pad.r - 4, by - 4);
      }
    }
    const niceStep = (r) => { const p = 10 ** Math.floor(Math.log10(r)), m = r / p; return (m < 1.5 ? 1 : m < 3.5 ? 2 : m < 7.5 ? 5 : 10) * p; };
    const fmtTick = (v) => (Math.abs(v) < 1e-9 ? '0' : Number(v.toPrecision(3)).toString());
    function fire() {
      cancelAnimationFrame(anim);
      const { x0, x1 } = view(), left = (0 - x0) / (x1 - x0), T = res.T;
      shots = { through: 0, back: 0, list: Array.from({ length: 60 }, (_, i) => ({ x: null, y: 0.12 + 0.76 * Math.random(), t0: i * 22, pass: Math.random() < T, out: false })) };
      const t0 = performance.now(), speed = 0.00055;
      const tick = (now) => {
        let live = 0;
        for (const q of shots.list) {
          if (q.out) continue;
          const tt = now - t0 - q.t0;
          if (tt < 0) { live++; continue; }
          let x = tt * speed;
          if (x >= left && !q.pass) x = left - (x - left); // bounced
          if (x < 0 || x > 1) { q.out = true; q.x = null; if (q.pass) shots.through++; else shots.back++; continue; }
          q.x = x; live++;
        }
        draw();
        if (live) anim = requestAnimationFrame(tick);
        else say(msg, `穿过 ${shots.through} 个，弹回 ${shots.back} 个（理论透射率 ${pct(T)}）。`);
      };
      anim = requestAnimationFrame(tick);
    }
    return {
      init() {
        const box = $('#tun-missions');
        box.replaceChildren(...MISSIONS.map((_, i) => { const bt = document.createElement('button'); bt.type = 'button'; bt.textContent = `第 ${i + 1} 关`; bt.addEventListener('click', () => choose(i)); return bt; }),
          Object.assign(document.createElement('button'), { type: 'button', textContent: '自由玩', onclick: () => choose(MISSIONS.length) }));
        for (const s of [sE, sV, sA]) s.addEventListener('input', update);
        $$('#tun-particle button').forEach((x) => x.addEventListener('click', () => { particle = x.dataset.p; $$('#tun-particle button').forEach((y) => y.setAttribute('aria-pressed', String(y === x))); update(); }));
        $('#tun-fire').addEventListener('click', fire);
        markDone();
        const firstOpen = MISSIONS.findIndex((_, i) => !(best.tunnel || []).includes(i));
        choose(firstOpen < 0 ? MISSIONS.length : firstOpen);
      },
      draw,
      hide() { cancelAnimationFrame(anim); },
    };
  })();

  // ── 05 芳香性判断 ───────────────────────────────────────────────────
  games.ring = (() => {
    const cv = $('#ring-cv'), msg = $('#ring-msg'), read = $('#ring-read');
    let b, cur = null, done = false;
    const qText = (q) => (q === 0 ? '0' : `${q > 0 ? '+' : '−'}${Math.abs(q)}`);
    function ask() {
      const prev = cur;
      cur = pick(P.rings.filter((r) => r !== prev));
      const task = $('#ring-task');
      task.replaceChildren(noTr('b', en ? cur.en : cur.zh), document.createElement('br'), document.createTextNode(`${cur.N} 元环，电荷 ${qText(cur.charge)}。假设环是平面的，它是芳香的还是反芳香的？`));
      done = false; read.replaceChildren(); say(msg, '');
      for (const x of $$('.play-choice', $('#ring-choices'))) { x.disabled = false; delete x.dataset.mark; }
      draw();
    }
    function answer(bt) {
      if (done) return;
      done = true;
      const ne = P.ringElectrons(cur), kind = P.huckelRule(ne), right = bt.dataset.a === kind, n = Math.floor(ne / 4);
      for (const x of $$('.play-choice', $('#ring-choices'))) { x.disabled = true; if (x.dataset.a === kind) x.dataset.mark = 'right'; }
      if (!right) bt.dataset.mark = 'wrong';
      if (right) b.hit(); else b.miss();
      say(msg, kind === 'aromatic'
        ? (right ? `答对了！${ne} 个 π 电子 = 4×${n} + 2，芳香。` : `不对。${ne} 个 π 电子 = 4×${n} + 2，是芳香的。`)
        : (right ? `答对了！${ne} 个 π 电子 = 4×${n}，反芳香。` : `不对。${ne} 个 π 电子 = 4×${n}，是反芳香的。`), right ? 'ok' : 'bad');
      const f = P.huckelFill(cur.N, ne), beta = (v, d = 3) => { const a = Number(Math.abs(v).toFixed(d)); return a === 1 ? 'β' : a + 'β'; };
      const rows = [['π 电子数', String(ne)], ['π 电子能量', ne + 'α ' + (f.energy < 0 ? '−' : '+') + ' ' + beta(f.energy)], ['离域能', Math.abs(f.delocalization) < 1e-9 ? '0' : (f.delocalization < 0 ? '−' : '') + beta(f.delocalization)], ['电子结构', f.open ? '开壳层（Hückel 理论里不稳定）' : '闭壳层']];
      if (cur.N === 8 && cur.charge === 0) rows.push(['真实分子', '澡盆形，不共轭，实际上是非芳香的']);
      if (cur.N === 4 && cur.charge === 0) rows.push(['真实分子', '扭成长方形，仍然极不稳定']);
      read.replaceChildren(...rows.flatMap(([k, v]) => [Object.assign(document.createElement('dt'), { textContent: k }), Object.assign(document.createElement('dd'), { textContent: v })]));
      draw();
    }
    function draw() {
      if (!cur) return;
      const { ctx, w, h } = fit(cv), c = colors(), N = cur.N;
      // left: the ring
      const r = Math.min(w * 0.17, h * 0.3), cx = w * 0.23, cy = h * 0.47;
      ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath();
      for (let k = 0; k <= N; k++) { const th = -Math.PI / 2 + (2 * Math.PI * k) / N, x = cx + r * Math.cos(th), y = cy + r * Math.sin(th); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      ctx.fillStyle = c.ink;
      for (let k = 0; k < N; k++) { const th = -Math.PI / 2 + (2 * Math.PI * k) / N; ctx.beginPath(); ctx.arc(cx + r * Math.cos(th), cy + r * Math.sin(th), 3.5, 0, 7); ctx.fill(); }
      if (done) { ctx.strokeStyle = c.gold; ctx.setLineDash([4, 4]); ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(cx, cy, r * 0.62, 0, 7); ctx.stroke(); ctx.setLineDash([]); }
      if (cur.charge) { ctx.fillStyle = c.ink; ctx.font = font(Math.round(r * 0.42), 600); ctx.textAlign = 'center'; ctx.fillText(`${Math.abs(cur.charge) > 1 ? Math.abs(cur.charge) : ''}${cur.charge > 0 ? '+' : '−'}`, cx, cy + r * 0.15); }
      ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'center'; ctx.fillText(t(`${N} 元环`), cx, cy + r + 26);
      // right: Frost circle
      const R = Math.min(w * 0.2, h * 0.36), fx = w * 0.66, fy = h * 0.48;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(fx, fy, R, 0, 7); ctx.stroke();
      ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(fx - R - 18, fy); ctx.lineTo(fx + R + 18, fy); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'left'; ctx.fillText('α', fx + R + 22, fy + 4);
      const verts = Array.from({ length: N }, (_, k) => ({ c: 2 * Math.cos((2 * Math.PI * k) / N), x: fx + R * Math.sin((2 * Math.PI * k) / N), y: fy + R * Math.cos((2 * Math.PI * k) / N) })).sort((p, q) => q.c - p.c);
      ctx.strokeStyle = c.strong; ctx.beginPath(); // inscribed polygon, vertex down
      for (let k = 0; k <= N; k++) { const a = (2 * Math.PI * k) / N, x = fx + R * Math.sin(a), y = fy + R * Math.cos(a); if (k) ctx.lineTo(x, y); else ctx.moveTo(x, y); }
      ctx.stroke();
      const occ = done ? P.huckelFill(N, P.ringElectrons(cur)).occ : null, labelled = new Set();
      verts.forEach((v, i) => {
        ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(v.x - 16, v.y); ctx.lineTo(v.x + 16, v.y); ctx.stroke();
        const key = v.c.toFixed(3);
        if (!labelled.has(key) && Math.abs(v.c) > 1e-9) {
          labelled.add(key);
          ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'left';
          const a = Number(Math.abs(v.c).toFixed(2));
          ctx.fillText('α ' + (v.c > 0 ? '+' : '−') + ' ' + (a === 1 ? '' : a) + 'β', fx + R + 22, v.y + 4);
        }
        if (occ && occ[i]) { spin(ctx, v.x - (occ[i] === 2 ? 5 : 0), v.y, true, c.gold); if (occ[i] === 2) spin(ctx, v.x + 5, v.y, false, c.gold); }
      });
      ctx.fillStyle = c.muted; ctx.textAlign = 'center'; ctx.fillText(t('能量（β 为负，越往下越稳定）'), fx, h - 8);
    }
    return {
      init() { b = board('ring'); for (const x of $$('.play-choice', $('#ring-choices'))) x.addEventListener('click', () => answer(x)); $('#ring-next').addEventListener('click', ask); ask(); },
      draw,
    };
  })();

  // ── 06 氢原子光谱 ───────────────────────────────────────────────────
  games.lines = (() => {
    const cv = $('#ln-cv'), msg = $('#ln-msg'), up = $('#ln-up'), low = $('#ln-low'), emit = $('#ln-emit');
    let b, target = null, tries = 0, solved = false, sel = { up: 0, low: 0 }, shots = [];
    const seriesName = (nl) => { const s = P.series[nl]; return en ? `${s[1]} series` : s[0]; };
    function pickBtns() {
      for (const x of $$('button', up)) x.setAttribute('aria-pressed', String(+x.dataset.n === sel.up));
      for (const x of $$('button', low)) { const n = +x.dataset.n; x.disabled = !!sel.up && n >= sel.up; x.setAttribute('aria-pressed', String(n === sel.low)); }
      emit.disabled = !(sel.up && sel.low && sel.low < sel.up) || solved;
    }
    function next() {
      if (target && !solved) b.miss();
      const prev = target;
      do { const nl = 1 + rnd(3), nu = nl + 1 + rnd(7 - nl); target = { nl, nu, lam: P.lineNm(nu, nl) }; } while (prev && prev.nu === target.nu && prev.nl === target.nl);
      tries = 0; solved = false; shots = []; sel = { up: 0, low: 0 };
      const region = target.lam < 380 ? '位于紫外区，眼睛看不见' : target.lam <= 780 ? '位于可见光区' : '位于红外区，眼睛看不见';
      $('#ln-task').replaceChildren(document.createTextNode(`目标谱线：λ = ${target.lam.toFixed(2)} nm`), document.createElement('br'), Object.assign(document.createElement('span'), { textContent: region }));
      say(msg, ''); pickBtns(); draw();
    }
    function fireLine() {
      const nu = sel.up, nl = sel.low, lam = P.lineNm(nu, nl);
      tries++; shots.push({ nu, nl, lam });
      if (nu === target.nu && nl === target.nl) {
        solved = true;
        if (tries <= 3) b.hit(); else b.miss();
        msg.dataset.tone = 'ok';
        msg.replaceChildren(Object.assign(document.createElement('span'), { textContent: `找到了！${nu} → ${nl}，${seriesName(nl)}，${lam.toFixed(2)} nm。` }));
        if (tries > 3) msg.append(' ', Object.assign(document.createElement('span'), { textContent: '超过三次，这条不计分。' }));
      } else {
        if (tries === 3) b.miss();
        msg.dataset.tone = 'bad';
        msg.replaceChildren(Object.assign(document.createElement('span'), { textContent: `${nu} → ${nl} 发出 ${lam.toFixed(2)} nm（${seriesName(nl)}），不是这条。` }), ' ',
          Object.assign(document.createElement('span'), { textContent: lam > target.lam ? '波长太长，说明能量差太小。' : '波长太短，说明能量差太大。' }));
      }
      pickBtns(); draw();
    }
    // the level diagram is drawn against n^−0.55 (not linear in energy) so the upper levels stay apart
    function draw() {
      if (!target) return;
      const { ctx, w, h } = fit(cv), c = colors();
      const top = 16, specH = 66, ladB = h - specH - 54, x0 = 92, x1 = w - 84;
      const Y = (n) => (n === Infinity ? top : top + (ladB - top) * n ** -0.55);
      ctx.font = font(11);
      let lastY = Infinity;
      for (const n of [1, 2, 3, 4, 5, 6, 7, Infinity]) {
        const y = Y(n), room = n === Infinity || (lastY - y >= 12 && y - Y(Infinity) >= 12);
        if (room) lastY = y;
        ctx.strokeStyle = n === Infinity ? c.line : c.strong; ctx.lineWidth = n === Infinity ? 1 : 1.4;
        if (n === Infinity) ctx.setLineDash([4, 4]);
        ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke(); ctx.setLineDash([]);
        if (!room) continue;
        ctx.fillStyle = c.muted; ctx.textAlign = 'right'; ctx.fillText(n === Infinity ? 'n = ∞' : `n = ${n}`, x0 - 8, y + 4);
        ctx.textAlign = 'left'; ctx.fillText(n === Infinity ? '0 eV' : `${P.levelEV(n).toFixed(2).replace('-', '−')} eV`, x1 + 8, y + 4);
      }
      shots.slice(-10).forEach((s, i, arr) => {
        const x = x0 + 30 + ((x1 - x0 - 60) * (i + 0.5)) / Math.max(arr.length, 6), last = i === arr.length - 1;
        const col = visible(s.lam) ? rgb(P.wavelengthRGB(s.lam)) : c.ink2;
        ctx.globalAlpha = last ? 1 : 0.45; arrow(ctx, x, Y(s.nu), Y(s.nl), col, last ? 2.6 : 1.6, 5); ctx.globalAlpha = 1;
      });
      // spectrum, log scale 90–2000 nm
      const sy = h - specH - 22, L0 = Math.log(90), L1 = Math.log(2000), SX = (nm) => x0 + ((Math.log(nm) - L0) / (L1 - L0)) * (x1 - x0);
      ctx.fillStyle = c.paper; ctx.fillRect(x0, sy, x1 - x0, specH);
      for (let px = Math.floor(SX(380)); px <= SX(780); px++) { const nm = Math.exp(L0 + ((px - x0) / (x1 - x0)) * (L1 - L0)); ctx.fillStyle = rgb(P.wavelengthRGB(nm)); ctx.globalAlpha = 0.35; ctx.fillRect(px, sy, 1.5, specH); }
      ctx.globalAlpha = 1; ctx.strokeStyle = c.strong; ctx.lineWidth = 1; ctx.strokeRect(x0, sy, x1 - x0, specH);
      ctx.fillStyle = c.muted; ctx.textAlign = 'center'; ctx.font = font(11);
      ctx.fillText(t('紫外'), (SX(90) + SX(380)) / 2, sy + specH - 6); ctx.fillText(t('可见'), (SX(380) + SX(780)) / 2, sy + specH - 6); ctx.fillText(t('红外'), (SX(780) + SX(2000)) / 2, sy + specH - 6);
      for (const nm of [100, 200, 500, 1000, 2000]) ctx.fillText(String(nm), SX(nm), sy + specH + 14);
      ctx.textAlign = 'right'; ctx.fillText('nm', x0 - 8, sy + specH + 14);
      const tx = SX(target.lam);
      ctx.strokeStyle = c.gold; ctx.setLineDash([4, 3]); ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx, sy - 8); ctx.lineTo(tx, sy + specH); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.gold; ctx.font = font(11, 600); ctx.textAlign = 'center'; ctx.fillText(t('目标'), tx, sy - 11);
      shots.forEach((s, i) => { ctx.strokeStyle = visible(s.lam) ? rgb(P.wavelengthRGB(s.lam)) : c.ink; ctx.globalAlpha = i === shots.length - 1 ? 1 : 0.4; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(SX(s.lam), sy + 4); ctx.lineTo(SX(s.lam), sy + specH - 18); ctx.stroke(); });
      ctx.globalAlpha = 1;
    }
    return {
      init() {
        b = board('lines');
        up.replaceChildren(...[2, 3, 4, 5, 6, 7].map((n) => { const x = noTr('button', String(n)); x.type = 'button'; x.dataset.n = n; x.addEventListener('click', () => { sel.up = n; if (sel.low >= n) sel.low = 0; pickBtns(); }); return x; }));
        low.replaceChildren(...[1, 2, 3, 4, 5, 6].map((n) => { const x = noTr('button', String(n)); x.type = 'button'; x.dataset.n = n; x.addEventListener('click', () => { sel.low = n; pickBtns(); }); return x; }));
        emit.addEventListener('click', fireLine);
        $('#ln-next').addEventListener('click', next);
        next();
      },
      draw,
    };
  })();

  // 07–14 在 play-quantum.js、15 在 play-wave2d.js、16–19 在 play-3d.js：把画图、成绩和翻译工具交给它们，它们返回的游戏和这里的共用标签与地址
  const kit = { $, $$, t, en, rnd, pick, shuffle, say, noTr, fit, colors, font, rgb, toRGB, arrow, pct, sci, sup, board, best, save, renderBest };
  for (const more of [window.MOLASTRIA_PLAY_MORE, window.MOLASTRIA_PLAY_WAVE, window.MOLASTRIA_PLAY_3D]) if (more) Object.assign(games, more(kit));

  // ── 标签与地址 ──────────────────────────────────────────────────────
  const views = $$('.play-view'), tabs = $$('#play-tabs a'), frame = $('#qchem-frame'), lab = $('#play-lab'), started = new Set();
  let current = '';
  function show(view, inner) {
    const changed = view !== current;
    if (changed && games[current]?.hide) games[current].hide();
    current = view;
    document.body.dataset.view = view;
    lab.hidden = view !== 'lab';
    for (const v of views) v.hidden = v.dataset.view !== view;
    for (const a of tabs) {
      if (a.dataset.view !== view) { a.removeAttribute('aria-current'); continue; }
      a.setAttribute('aria-current', 'page');
      const strip = a.parentElement; // narrow screens: bring the open tab into the scrolled strip
      if (strip.scrollWidth > strip.clientWidth) strip.scrollLeft = a.offsetLeft - (strip.clientWidth - a.offsetWidth) / 2;
    }
    if (view === 'lab') {
      if (!frame.getAttribute('src')) frame.src = `app/index.html?embed=1&lang=${en ? 'en' : 'zh'}${inner ? `#${inner}` : ''}`;
      else if (inner) { try { frame.contentDocument.querySelector(`#tabs [data-v="${CSS.escape(inner)}"]`)?.click(); } catch { /* not loaded yet */ } }
    } else if (games[view]) {
      if (!started.has(view)) { started.add(view); games[view].init(); }
      games[view].draw();
    }
    if (changed && document.readyState === 'complete') scrollTo(0, 0);
  }
  function route() {
    const h = decodeURIComponent(location.hash.slice(1)).split('?')[0];
    if (h && document.getElementById(h)) return; // a jump inside the page (the skip link)
    if (!h || h === 'play') show('home');
    else if (h.startsWith('play-') && games[h.slice(5)]) show(h.slice(5));
    else show('lab', h === 'lab' ? '' : h); // other hashes belong to the calculator (#qd, …)
  }
  // The calculator's own tab (电子结构 / 量子计算 / 量子点 / 对拍) is mirrored in this page's address (#lab, #q, #qd, #bench),
  // so a reload (switching the language) or a shared link opens the same tab.
  frame.addEventListener('load', () => {
    try {
      frame.contentDocument.getElementById('tabs')?.addEventListener('click', (e) => {
        const v = e.target.closest('[data-v]')?.dataset.v;
        if (v && document.body.dataset.view === 'lab') history.replaceState(history.state, '', `${location.pathname}${location.search}#${v === 'es' ? 'lab' : v}`);
      });
    } catch { /* frame from another origin */ }
  });
  addEventListener('hashchange', route);
  renderBest();
  route();

  // redraw on resize, theme change and when the English dictionary arrives (canvas text)
  let raf = 0;
  const redraw = () => { cancelAnimationFrame(raf); raf = requestAnimationFrame(() => games[current]?.draw?.()); };
  addEventListener('resize', redraw);
  new MutationObserver(redraw).observe(root, { attributes: true, attributeFilter: ['data-theme', 'data-font', 'style'] });
  document.addEventListener('chemhub:i18n', redraw);
})();
