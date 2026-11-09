/* 游乐场 07–14：量子嘉年华分会场（自旋过滤、贝尔游戏、电路拼图、纠错救援、Grover 寻宝、噪声助推）与物理疆界（普朗克工坊、立方体分拣）。
   数学在 play-quantum-models.js（纯函数，tools/play-test.mjs 测）。这个文件只定义 window.MOLASTRIA_PLAY_MORE(kit)，
   由 play.js 把画图、成绩和翻译工具传进来，返回的游戏和 01–06 共用标签、地址和成绩（molastria-play）。
   界面文字写中文，由 i18n.js 翻译；立方体的现象说明是中英两版的数据，按站点语言取用并标 translate="no"。 */
window.MOLASTRIA_PLAY_MORE = (kit) => {
  'use strict';
  const Q = window.MOLASTRIA_PLAYQ;
  if (!Q) return {};
  const { $, $$, t, en, rnd, pick, say, noTr, fit, colors, font, pct, sci, sup, board, best, save, renderBest } = kit;
  const still = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const el = (tag, props = {}, kids = []) => { const e = Object.assign(document.createElement(tag), props); e.append(...kids); return e; };
  const rows = (dl, list) => dl.replaceChildren(...list.flatMap(([k, v]) => [el('dt', { textContent: k }), el('dd', { textContent: v })]));
  const deg = (v) => `${Number(v.toFixed(1))}°`;
  // 关卡按钮（和隧穿关卡同一套样式）；done(i) 决定打勾
  function levels(box, labels, onPick, done) {
    box.replaceChildren(...labels.map((label, i) => el('button', { type: 'button', textContent: label, onclick: () => onPick(i) })));
    const mark = (cur) => $$('button', box).forEach((b, i) => { b.setAttribute('aria-pressed', String(i === cur)); b.toggleAttribute('data-done', done(i)); });
    return mark;
  }
  const addTo = (key, v) => { best[key] = [...new Set([...(best[key] || []), v])]; save(); renderBest(); };
  const has = (key, v) => (best[key] || []).includes(v);
  // 在 maxW 宽度内换行（英文按词，中文按字）
  const wrap = (ctx, text, x, y, maxW, lh) => {
    const words = /\s/.test(text) ? text.split(/(\s+)/) : [...text];
    let line = '', yy = y;
    for (const w of words) { if (line && ctx.measureText(line + w).width > maxW) { ctx.fillText(line.trim(), x, yy); line = w.trimStart(); yy += lh; } else line += w; }
    if (line) ctx.fillText(line.trim(), x, yy);
  };
  // 手机上画布换成更高的比例，图不至于被压扁
  const fitR = (cv, wide, narrow) => { cv.dataset.ratio = String(cv.clientWidth && cv.clientWidth < 520 ? narrow : wide); return fit(cv); };
  const lineTo = (ctx, pts) => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke(); };
  const games = {};

  // ── 07 Stern–Gerlach 自旋过滤 ─────────────────────────────────────────
  games.sg = (() => {
    const cv = $('#sg-cv'), msg = $('#sg-msg'), read = $('#sg-read'), box = $('#sg-sliders'), L = Q.sgLevels;
    const TEXT = [
      '只有一个分析器。转动它，让 25% 的原子通过（23% 到 27% 之间）。',
      '最后一个分析器朝 −z（180°），单独放在 +z 原子后面会挡住全部原子。在中间插一个分析器，让至少 24% 的原子通过。',
      '还是要到达 −z，这次中间有三个分析器可以调。让至少 50% 的原子通过。',
      '自由玩：五个分析器随便转，看看透过率怎么变。',
    ];
    let mode = 0, angles = [], shots = null, anim = 0, mark;
    const fixedLast = () => (L[mode] ? L[mode].last : null);
    const chain = () => [0, ...angles, ...(fixedLast() == null ? [] : [fixedLast()])];
    function choose(m) {
      mode = m; cancelAnimationFrame(anim); shots = null;
      const M = L[m];
      angles = M ? Array(M.middle).fill(0) : [0, 45, 90, 135, 180];
      box.replaceChildren(...angles.map((v, i) => {
        const inp = el('input', { type: 'range', min: 0, max: 360, step: 5, value: v }), out = el('output');
        inp.setAttribute('aria-label', `分析器 ${i + 1} 的角度`);
        inp.addEventListener('input', () => { angles[i] = +inp.value; update(); });
        return el('label', {}, [`分析器 ${i + 1} 的角度`, el('span', {}, [inp, out])]);
      }));
      $('#sg-task').textContent = TEXT[m];
      mark(m); update();
    }
    function update() {
      cancelAnimationFrame(anim); shots = null;
      $$('output', box).forEach((o, i) => { o.textContent = `${angles[i]}°`; });
      const ch = chain(), p = Q.sgChain(ch), steps = ch.slice(1).map((a, i) => Q.sgStep(ch[i], a));
      rows(read, [['透过率', pct(p)], ['每一步', steps.map((s) => pct(s)).join(' × ')]]);
      const M = L[mode];
      if (M && p >= M.lo - 1e-12 && p <= M.hi + 1e-12) {
        addTo('sg', M.id); mark(mode);
        say(msg, mode === 1 ? `过关！透过率 ${pct(p)}。挡住一切的两个分析器之间多插一个，反而放过了原子：测量会改变状态。`
          : mode === 2 ? `过关！透过率 ${pct(p)}。分得越细，越接近 100%：每一步都只转一点点。` : `过关！透过率 ${pct(p)}。`, 'ok');
      } else say(msg, M ? `透过率 ${pct(p)}。` : `透过率 ${pct(p)}，最多五个分析器均匀分开是 ${pct(Q.sgEven(5))}。`);
      draw();
    }
    function geom(w, h) {
      const ch = chain(), n = ch.length - 1, x0 = 46, x1 = w - 56, gap = (x1 - x0) / (n + 1), cy = h * 0.42;
      return { ch, n, x0, x1, cy, xs: Array.from({ length: n }, (_, i) => x0 + gap * (i + 1)), bw: Math.min(58, gap * 0.62) };
    }
    function draw() {
      const { ctx, w, h } = fitR(cv, 0.5278, 0.8), c = colors(), g = geom(w, h);
      const inten = [1]; for (let i = 1; i <= g.n; i++) inten.push(inten[i - 1] * Q.sgStep(g.ch[i - 1], g.ch[i]));
      const thick = (v) => Math.max(v > 1e-6 ? 1.2 : 0, 16 * v);
      // 束
      ctx.lineCap = 'round';
      for (let i = 0; i <= g.n; i++) {
        const xa = i ? g.xs[i - 1] + g.bw / 2 : g.x0, xb = i < g.n ? g.xs[i] - g.bw / 2 : g.x1;
        if (inten[i] > 1e-6) { ctx.strokeStyle = c.gold; ctx.globalAlpha = 0.85; ctx.lineWidth = thick(inten[i]); lineTo(ctx, [[xa, g.cy], [xb, g.cy]]); ctx.globalAlpha = 1; }
        if (i) { // 被挡掉的 − 束
          const lost = inten[i - 1] - inten[i];
          if (lost > 1e-6) { ctx.strokeStyle = c.warn; ctx.globalAlpha = 0.45; ctx.lineWidth = thick(lost); lineTo(ctx, [[g.xs[i - 1] + g.bw / 2, g.cy + 10], [g.xs[i - 1] + g.bw / 2 + 26, g.cy + 62]]); ctx.globalAlpha = 1; }
        }
      }
      // 源和探测器
      ctx.fillStyle = c.ink2; ctx.font = font(11, 600); ctx.textAlign = 'center';
      ctx.fillRect(g.x0 - 30, g.cy - 16, 14, 32); ctx.fillText('+z', g.x0 - 23, g.cy - 24);
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1.5; ctx.strokeRect(g.x1, g.cy - 30, 14, 60);
      // 分析器
      g.xs.forEach((x, i) => {
        const a = g.ch[i + 1], fixed = fixedLast() != null && i === g.n - 1, top = g.cy - 44;
        ctx.fillStyle = c.surface; ctx.strokeStyle = fixed ? c.ink2 : c.strong; ctx.lineWidth = fixed ? 2 : 1.2;
        ctx.beginPath(); ctx.roundRect(x - g.bw / 2, top, g.bw, 88, 6); ctx.fill(); ctx.stroke();
        const r = Math.min(18, g.bw * 0.34), cy = g.cy;
        ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(x, cy, r, 0, 7); ctx.stroke();
        const th = (a * Math.PI) / 180, dx = Math.sin(th) * r, dy = -Math.cos(th) * r;
        ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 2;
        lineTo(ctx, [[x - dx * 0.8, cy - dy * 0.8], [x + dx, cy + dy]]);
        ctx.beginPath(); ctx.arc(x + dx, cy + dy, 3, 0, 7); ctx.fill();
        ctx.fillStyle = c.ink; ctx.font = font(11, 600); ctx.fillText(`${a}°`, x, top + 104);
        if (fixed) { ctx.fillStyle = c.muted; ctx.font = font(10); ctx.fillText(t('固定'), x, top - 6); }
      });
      // 读数
      ctx.textAlign = 'right'; ctx.fillStyle = c.ink; ctx.font = font(13, 600);
      ctx.fillText(pct(inten[g.n]), w - 8, g.cy + 50);
      if (shots) {
        for (const q of shots.list) if (q.x != null) { ctx.fillStyle = q.out < 0 ? c.ok : c.warn; ctx.beginPath(); ctx.arc(q.x, q.y, 2.6, 0, 7); ctx.fill(); }
        ctx.fillStyle = c.ink2; ctx.font = font(12, 600); ctx.textAlign = 'left';
        ctx.fillText(t(`到达探测器 ${shots.hit} / ${shots.list.length}`), 12, h - 14);
      }
    }
    function fire() {
      cancelAnimationFrame(anim);
      const ch = chain(), list = Array.from({ length: 200 }, (_, i) => {
        let out = -1;
        for (let s = 1; s < ch.length; s++) if (Math.random() >= Q.sgStep(ch[s - 1], ch[s])) { out = s - 1; break; }
        return { out, d: i * 7, dy: (Math.random() - 0.5) * 10, x: null, y: 0 };
      });
      shots = { list, hit: 0 };
      const finish = () => { shots.hit = list.filter((q) => q.out < 0).length; for (const q of list) q.x = null; draw(); say(msg, `${list.length} 个原子里有 ${shots.hit} 个到达探测器（理论 ${pct(Q.sgChain(ch))}）。`); };
      if (still()) { finish(); return; }
      const t0 = performance.now();
      const tick = (now) => {
        const { w, h } = { w: cv.clientWidth, h: cv.clientHeight }, g = geom(w, h), span = g.x1 - g.x0;
        let live = 0;
        for (const q of list) {
          const tt = now - t0 - q.d;
          if (tt < 0) { live++; q.x = null; continue; }
          let x = g.x0 + tt * 0.32, y = g.cy + q.dy * 0.5;
          if (q.out >= 0) { const xo = g.xs[q.out] + g.bw / 2; if (x > xo) { y = g.cy + 10 + (x - xo) * 2; x = xo + (x - xo) * 0.5; } if (y > h) { q.x = null; continue; } }
          else if (x > g.x1) { q.x = null; continue; }
          q.x = x; q.y = y; live++;
        }
        shots.hit = list.filter((q) => q.out < 0 && q.x == null && now - t0 - q.d > 0).length;
        draw();
        if (live && now - t0 < 4000 + span) anim = requestAnimationFrame(tick); else finish();
      };
      anim = requestAnimationFrame(tick);
    }
    return {
      init() {
        mark = levels($('#sg-levels'), ['第 1 关', '第 2 关', '第 3 关', '自由玩'], choose, (i) => i < L.length && has('sg', L[i].id));
        $('#sg-fire').addEventListener('click', fire);
        const first = L.findIndex((x) => !has('sg', x.id));
        choose(first < 0 ? L.length : first);
      },
      draw, hide() { cancelAnimationFrame(anim); },
      bestText: (v) => (v?.length ? `已过 ${v.length} / ${L.length} 关` : ''),
    };
  })();

  // ── 08 CHSH 贝尔游戏 ─────────────────────────────────────────────────
  games.bell = (() => {
    const cv = $('#bell-cv'), msg = $('#bell-msg'), read = $('#bell-read');
    const sl = ['a0', 'a1', 'b0', 'b1'].map((k) => $(`#bell-${k}`));
    const GOALS = [
      { id: 'c75', text: '经典策略赢到 75%', ok: (m, w) => m === 'c' && w >= 0.75 },
      { id: 'q80', text: '用纠缠光子赢过 80%：任何经典策略都做不到', ok: (m, w) => m === 'q' && w > 0.8 },
      { id: 'q85', text: '逼近量子上限：赢到 85.3% 以上', ok: (m, w) => m === 'q' && w >= 0.853 },
    ];
    let mode = 'c', cl = { a0: 0, a1: 1, b0: 0, b1: 1 }, last = null;
    const angles = () => sl.map((s) => +s.value);
    const win = () => (mode === 'c' ? Q.chshClassical([cl.a0, cl.a1], [cl.b0, cl.b1]) : (([a0, a1, b0, b1]) => Q.chshQuantum([a0, a1], [b0, b1]))(angles()));
    const caseWin = (x, y) => {
      if (mode === 'c') return (cl[`a${x}`] ^ cl[`b${y}`]) === (x & y) ? 1 : 0;
      const A = angles(), s = Q.pSame(A[x], A[2 + y]);
      return x & y ? 1 - s : s;
    };
    function setMode(m) {
      mode = m; last = null;
      $$('#bell-mode button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.m === m)));
      $('#bell-classical').hidden = m !== 'c'; $('#bell-quantum').hidden = m !== 'q';
      update();
    }
    function goals() {
      $('#bell-goals').replaceChildren(...GOALS.map((g) => { const li = el('li', { textContent: g.text }); li.toggleAttribute('data-done', has('bell', g.id)); return li; }));
    }
    function update() {
      sl.forEach((s) => { s.nextElementSibling.textContent = deg(+s.value); });
      $$('#bell-classical [data-k]').forEach((b) => { b.textContent = String(cl[b.dataset.k]); b.setAttribute('aria-label', `${b.previousElementSibling.textContent}：${cl[b.dataset.k]}`); });
      const w = win(), S = mode === 'q' ? (([a0, a1, b0, b1]) => Q.chshS([a0, a1], [b0, b1]))(angles()) : 8 * w - 4;
      const list = [['理论获胜率', pct(w)], ['CHSH 值 S', `${S.toFixed(3)}（经典 |S| ≤ 2）`]];
      if (last) list.push(['刚才 1000 轮', `赢 ${last.k} 轮（${pct(last.k / last.n)}）`]);
      rows(read, list);
      goals(); draw();
    }
    function play() {
      const n = 1000; let k = 0;
      for (let i = 0; i < n; i++) { const x = rnd(2), y = rnd(2); if (Math.random() < caseWin(x, y)) k++; }
      last = { n, k };
      const w = win(), hit = GOALS.filter((g) => g.ok(mode, w + 1e-12) && !has('bell', g.id));
      hit.forEach((g) => addTo('bell', g.id));
      if (hit.length) say(msg, `达成目标：${hit.map((g) => g.text).join('；')}。`, 'ok');
      else if (mode === 'c') say(msg, w >= 0.75 ? '这已经是经典策略的上限了。换成纠缠光子试试。' : '再调调：四道题里最多能保证答对三道。');
      else say(msg, w > 0.8 ? `赢了 ${pct(k / n)}，已经超过经典上限。` : '提示：让两人的角度两两相差 22.5°，只有 x = y = 1 那一对相差 67.5°。');
      update();
    }
    function draw() {
      const { ctx, w, h } = fitR(cv, 420 / 720, 1.25), c = colors(), narrow = w < 520;
      const L = { x: 16, y: 18, w: narrow ? w - 32 : w * 0.52, h: narrow ? h * 0.4 : h - 92 };
      ctx.font = font(11); ctx.textAlign = 'center';
      const cases = [[0, 0], [0, 1], [1, 0], [1, 1]], bw = L.w / 4;
      cases.forEach(([x, y], i) => {
        const v = caseWin(x, y), bx = L.x + i * bw + bw * 0.18, bh = L.h - 40, top = L.y + 4;
        ctx.fillStyle = c.paper; ctx.fillRect(bx, top, bw * 0.64, bh);
        ctx.fillStyle = v > 0.8 ? c.ok : v > 0.5 ? c.gold : c.warn; ctx.fillRect(bx, top + bh * (1 - v), bw * 0.64, bh * v);
        ctx.fillStyle = c.ink; ctx.font = font(12, 600); ctx.fillText(`${Math.round(v * 1000) / 10}%`, bx + bw * 0.32, top + bh * (1 - v) - 5 < top + 12 ? top + 14 : top + bh * (1 - v) - 5);
        ctx.fillStyle = c.ink2; ctx.font = font(11, 600); ctx.fillText(`x=${x}, y=${y}`, bx + bw * 0.32, top + bh + 15);
        ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.fillText(t(x & y ? '要不同' : '要相同'), bx + bw * 0.32, top + bh + 29);
      });
      // 角度盘
      if (mode === 'q') {
        const r = narrow ? Math.min(58, w * 0.17) : Math.min(108, w * 0.2), cx = narrow ? w / 2 : w * 0.78, cy = narrow ? L.y + L.h + r + 26 : h * 0.42, A = angles();
        ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, r, 0, 7); ctx.stroke();
        const ray = (a, col, dash, label) => {
          const th = (a * Math.PI) / 180, dx = Math.sin(th) * r, dy = -Math.cos(th) * r;
          ctx.strokeStyle = col; ctx.lineWidth = 2.2; ctx.setLineDash(dash); lineTo(ctx, [[cx - dx, cy - dy], [cx + dx, cy + dy]]); ctx.setLineDash([]);
          ctx.fillStyle = col; ctx.font = font(11, 600); ctx.textAlign = 'center'; ctx.fillText(label, cx + dx * 1.18, cy + dy * 1.18 + 4);
        };
        ray(A[0], c.gold, [], 'α₀'); ray(A[1], c.gold, [5, 4], 'α₁'); ray(A[2], c.info, [], 'β₀'); ray(A[3], c.info, [5, 4], 'β₁');
        ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.textAlign = 'center'; ctx.fillText(t('偏振方向（0° 竖直）'), cx, cy + r + 30);
      } else if (!narrow) {
        ctx.fillStyle = c.muted; ctx.font = font(12); ctx.textAlign = 'center';
        wrap(ctx, t('经典策略：每题要么必赢，要么必输'), w * 0.78, h * 0.36, w * 0.36, 18);
      }
      // 总获胜率
      const by = h - 46, bx0 = 16, bx1 = w - 16, X = (v) => bx0 + v * (bx1 - bx0), wv = win();
      ctx.fillStyle = c.paper; ctx.fillRect(bx0, by, bx1 - bx0, 16);
      ctx.fillStyle = wv > 0.75 + 1e-9 ? c.ok : c.gold; ctx.fillRect(bx0, by, Math.max(0, X(wv) - bx0), 16);
      ctx.strokeStyle = c.ink2; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2; lineTo(ctx, [[X(0.75), by - 6], [X(0.75), by + 22]]); ctx.setLineDash([]);
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2; lineTo(ctx, [[X(Q.tsirelson), by - 6], [X(Q.tsirelson), by + 22]]);
      ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.textAlign = 'center';
      ctx.fillText('0', bx0 + 4, by + 32); ctx.fillText(t('经典 75%'), X(0.75), by + 32); ctx.fillText(t('量子 85.4%'), X(Q.tsirelson), by - 10); ctx.fillText('100%', bx1 - 16, by + 32);
    }
    return {
      init() {
        $$('#bell-mode button').forEach((b) => b.addEventListener('click', () => setMode(b.dataset.m)));
        $$('#bell-classical [data-k]').forEach((b) => b.addEventListener('click', () => { cl[b.dataset.k] ^= 1; last = null; update(); }));
        sl.forEach((s) => s.addEventListener('input', () => { last = null; update(); }));
        $('#bell-play').addEventListener('click', play);
        setMode(has('bell', 'c75') ? 'q' : 'c');
      },
      draw,
      bestText: (v) => (v?.length ? `已达成 ${v.length} / ${GOALS.length} 个目标` : ''),
    };
  })();

  // ── 09 量子电路拼图 ─────────────────────────────────────────────────
  games.circuit = (() => {
    const cv = $('#cir-cv'), msg = $('#cir-msg'), pal = $('#cir-pal'), MAX = 12;
    let k = 0, gates = [], mark;
    const pz = () => Q.puzzles[k];
    const ketOf = (i, n) => `|${i.toString(2).padStart(n, '0')}⟩`;
    const solvedSet = () => best.circuit || {};
    function choose(i) {
      k = i; gates = [];
      const p = pz(), allow = p.allow.join(en ? ', ' : '、');
      $('#cir-task').replaceChildren(`第 ${i + 1} 题：${p.n} 个比特，从 `, noTr('b', ketOf(p.start || 0, p.n)), ' 出发，做出 ', noTr('b', p.ket), `。可用的门：${allow}。最少 ${p.par} 个门。`);
      pal.replaceChildren(...Q.moves(p.n, p.allow).map((m) => {
        const b = el('button', { type: 'button', className: 'cir-gate' });
        b.setAttribute('translate', 'no');
        if (m.g === 'CNOT') { b.append(`CNOT q${m.c} `, el('i', { className: 'ico-ext ico-right', ariaHidden: 'true' }), ` q${m.t}`); b.dataset.g = 'CNOT'; b.setAttribute('aria-label', `CNOT q${m.c} → q${m.t}`); }
        else { b.append(el('b', { textContent: m.g }), ` q${m.q}`); b.dataset.g = m.g; }
        b.addEventListener('click', () => { if (gates.length < MAX) { gates.push(m); update(); } });
        return b;
      }));
      mark(i); say(msg, ''); update();
    }
    function update() {
      const p = pz(), ok = gates.length && Q.solved(p, gates);
      $$('button', pal).forEach((b) => { b.disabled = gates.length >= MAX; });
      if (ok) {
        const prev = solvedSet()[p.id];
        if (!prev || gates.length < prev) { best.circuit = { ...solvedSet(), [p.id]: gates.length }; save(); renderBest(); }
        mark(k);
        say(msg, gates.length <= p.par ? `完成！用了 ${gates.length} 个门，正好是最少门数。` : `完成！用了 ${gates.length} 个门；最少只要 ${p.par} 个，再试试？`, 'ok');
      } else if (gates.length >= MAX) say(msg, `电路满了（最多 ${MAX} 个门）。撤销几个再试。`, 'bad');
      else say(msg, gates.length ? `保真度 ${pct(Q.fidelity(Q.run(p.n, gates, p.start || 0), p.target))}` : '');
      draw();
    }
    function draw() {
      const { ctx, w, h } = fitR(cv, 0.6389, 1.0), c = colors(), p = pz(), n = p.n, state = Q.run(n, gates, p.start || 0);
      // 电路
      const top = 22, wireGap = 34, x0 = 54, x1 = w - 16, colW = Math.min(52, (x1 - x0 - 10) / Math.max(6, gates.length + 1)), wy = (q) => top + 10 + q * wireGap;
      ctx.font = font(12, 600); ctx.textAlign = 'right';
      for (let q = 0; q < n; q++) {
        ctx.fillStyle = c.ink2; ctx.fillText(`q${q}`, x0 - 22, wy(q) + 4);
        ctx.fillStyle = c.muted; ctx.font = font(11); ctx.fillText(String(((p.start || 0) >> (n - 1 - q)) & 1), x0 - 6, wy(q) + 4); ctx.font = font(12, 600);
        ctx.strokeStyle = c.strong; ctx.lineWidth = 1.2; lineTo(ctx, [[x0, wy(q)], [x1, wy(q)]]);
      }
      gates.forEach((g, i) => {
        const x = x0 + colW * (i + 0.8);
        if (g.g === 'CNOT') {
          ctx.strokeStyle = c.accent; ctx.fillStyle = c.accent; ctx.lineWidth = 1.8;
          lineTo(ctx, [[x, wy(g.c)], [x, wy(g.t)]]);
          ctx.beginPath(); ctx.arc(x, wy(g.c), 4.5, 0, 7); ctx.fill();
          ctx.beginPath(); ctx.arc(x, wy(g.t), 10, 0, 7); ctx.stroke(); lineTo(ctx, [[x - 10, wy(g.t)], [x + 10, wy(g.t)]]); lineTo(ctx, [[x, wy(g.t) - 10], [x, wy(g.t) + 10]]);
        } else {
          const s = Math.min(26, colW * 0.8);
          ctx.fillStyle = c.surface; ctx.strokeStyle = c.gold; ctx.lineWidth = 1.6;
          ctx.beginPath(); ctx.roundRect(x - s / 2, wy(g.q) - s / 2, s, s, 4); ctx.fill(); ctx.stroke();
          ctx.fillStyle = c.ink; ctx.font = font(13, 700); ctx.textAlign = 'center'; ctx.fillText(g.g, x, wy(g.q) + 5);
        }
      });
      // 振幅
      const ay = top + n * wireGap + 34, ab = h - 34, H = ab - ay - 26, N = state.length, bw = (w - 32) / N;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; lineTo(ctx, [[16, ab], [w - 16, ab]]);
      state.forEach(([re, im], i) => {
        const m = Math.hypot(re, im), tm = Math.hypot(...p.target[i]), x = 16 + bw * i, cx = x + bw / 2, bwid = Math.min(46, bw * 0.56);
        const ph = Math.atan2(im, re), near = (a) => Math.abs(Math.atan2(Math.sin(ph - a), Math.cos(ph - a))) < 0.05;
        const col = m < 1e-9 ? c.line : near(0) ? c.gold : near(Math.PI) ? c.info : near(Math.PI / 2) ? c.ok : near(-Math.PI / 2) ? '#9b7be0' : c.accent;
        ctx.fillStyle = col; ctx.fillRect(cx - bwid / 2, ab - H * m, bwid, H * m);
        if (tm > 1e-9) { ctx.strokeStyle = c.ink2; ctx.setLineDash([4, 3]); ctx.lineWidth = 1.2; ctx.strokeRect(cx - bwid / 2 - 3, ab - H * tm, bwid + 6, H * tm); ctx.setLineDash([]); }
        if (m > 1e-9) { // 相位指针
          const r = 8, py = ab - H * m - 14;
          ctx.strokeStyle = c.muted; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, py, r, 0, 7); ctx.stroke();
          ctx.strokeStyle = col; ctx.lineWidth = 2; lineTo(ctx, [[cx, py], [cx + r * Math.cos(ph), py - r * Math.sin(ph)]]);
        }
        ctx.fillStyle = c.ink2; ctx.font = font(n === 3 ? 11 : 12, 600); ctx.textAlign = 'center'; ctx.fillText(ketOf(i, n), cx, ab + 16);
      });
    }
    return {
      init() {
        mark = levels($('#cir-levels'), Q.puzzles.map((_, i) => `第 ${i + 1} 题`), choose, (i) => !!solvedSet()[Q.puzzles[i].id]);
        $('#cir-undo').addEventListener('click', () => { gates.pop(); update(); });
        $('#cir-clear').addEventListener('click', () => { gates = []; update(); });
        const first = Q.puzzles.findIndex((x) => !solvedSet()[x.id]);
        choose(first < 0 ? 0 : first);
      },
      draw,
      bestText: (v) => { const n = Object.keys(v || {}).length; return n ? `已解 ${n} / ${Q.puzzles.length} 题` : ''; },
    };
  })();

  // ── 10 纠错救援 ─────────────────────────────────────────────────────
  games.qec = (() => {
    const cv = $('#qec-cv'), msg = $('#qec-msg'), read = $('#qec-read');
    let b, p = 0.15, round = null, me = { n: 0, fail: 0, raw: 0 }, auto = null;
    function setP(v) {
      p = v; me = { n: 0, fail: 0, raw: 0 }; auto = null;
      $$('#qec-p button').forEach((x) => x.setAttribute('aria-pressed', String(+x.dataset.p === p)));
      next();
    }
    function qubits(err, fix) {
      $('#qec-qubits').replaceChildren(...[0, 1, 2].map((i) => {
        const shown = err ? String(err[i] ^ (fix === i ? 1 : 0)) : '?';
        const d = el('span', { className: 'qec-q' }, [el('small', { textContent: `q${i}` }), el('b', { textContent: shown })]);
        if (err && err[i]) d.dataset.flip = '';
        if (fix === i) d.dataset.fix = '';
        d.setAttribute('translate', 'no');
        return d;
      }));
    }
    function next() {
      const err = [0, 1, 2].map(() => (Math.random() < p ? 1 : 0));
      round = { err, s: Q.syndrome(err), done: false };
      $('#qec-s1').toggleAttribute('data-on', !!round.s[0]); $('#qec-s2').toggleAttribute('data-on', !!round.s[1]);
      $$('#qec-choices .play-choice').forEach((x) => { x.disabled = false; delete x.dataset.mark; });
      qubits(null); say(msg, '看灯，选一个修法。'); stats(); draw();
    }
    function answer(bt) {
      if (round.done) return;
      round.done = true;
      const fix = +bt.dataset.fix, opt = Q.decode(round.s), fail = Q.logicalFail(round.err, fix), right = fix === opt;
      me.n++; me.fail += fail ? 1 : 0; me.raw += round.err[0];
      $$('#qec-choices .play-choice').forEach((x) => { x.disabled = true; if (+x.dataset.fix === opt) x.dataset.mark = 'right'; });
      if (!right) bt.dataset.mark = 'wrong';
      right ? b.hit() : b.miss();
      qubits(round.err, fix);
      const flips = round.err.reduce((s, v) => s + v, 0), optText = opt < 0 ? '不纠正' : `翻转 q${opt}`;
      if (right && !fail) say(msg, flips ? '修对了，逻辑比特保住了。' : '没有错误，不动就对了。', 'ok');
      else if (right) say(msg, `按灯的提示这是最可能的修法，但这一轮有 ${flips} 个比特翻转了，纠错失败。这就是逻辑错误率里 3p² 那一项。`, 'bad');
      else say(msg, `最可能的修法是${optText}。${fail ? '这一轮逻辑比特坏了。' : '这次运气好，逻辑比特没坏。'}`, 'bad');
      stats(); draw();
    }
    function runAuto() {
      let fail = 0, raw = 0;
      for (let i = 0; i < 1000; i++) { const e = [0, 1, 2].map(() => (Math.random() < p ? 1 : 0)); fail += Q.logicalFail(e, Q.decode(Q.syndrome(e))) ? 1 : 0; raw += e[0]; }
      auto = { n: 1000, fail, raw };
      say(msg, `解码器跑了 1000 轮：编码后逻辑错误 ${fail} 次，不编码的单个比特错 ${raw} 次（理论 ${Math.round(1000 * Q.pLogical(p))} 和 ${Math.round(1000 * p)}）。`);
      stats(); draw();
    }
    function stats() {
      const list = [['你玩的轮数', String(me.n)]];
      if (me.n) list.push(['编码后逻辑错误', String(me.fail)], ['不编码会错', String(me.raw)]);
      list.push(['理论逻辑错误率', `${pct(Q.pLogical(p))}（不编码 ${pct(p)}）`]);
      rows(read, list);
    }
    function draw() {
      const { ctx, w, h } = fitR(cv, 0.5833, 0.85), c = colors(), pad = { l: 50, r: 18, t: 18, b: 40 }, W = w - pad.l - pad.r, H = h - pad.t - pad.b, M = 0.6;
      const X = (v) => pad.l + (v / M) * W, Y = (v) => pad.t + H - (v / M) * H;
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1; lineTo(ctx, [[pad.l, pad.t], [pad.l, pad.t + H], [pad.l + W, pad.t + H]]);
      ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'center';
      for (let v = 0; v <= M + 1e-9; v += 0.1) { ctx.fillText(`${Math.round(v * 100)}%`, X(v), pad.t + H + 14); ctx.textAlign = 'right'; ctx.fillText(`${Math.round(v * 100)}%`, pad.l - 6, Y(v) + 4); ctx.textAlign = 'center'; }
      ctx.fillText(t('物理比特的翻转概率 p'), pad.l + W / 2, h - 6);
      ctx.save(); ctx.translate(12, pad.t + H / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(t('逻辑错误率'), 0, 0); ctx.restore();
      ctx.strokeStyle = c.muted; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.4; lineTo(ctx, [[X(0), Y(0)], [X(M), Y(M)]]); ctx.setLineDash([]);
      ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, H); ctx.clip();
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2.4; lineTo(ctx, Array.from({ length: 121 }, (_, i) => { const v = (M * i) / 120; return [X(v), Y(Q.pLogical(v))]; }));
      ctx.restore();
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; lineTo(ctx, [[X(0.5), pad.t], [X(0.5), pad.t + H]]);
      ctx.fillStyle = c.ink2; ctx.textAlign = 'left'; ctx.font = font(11, 600); ctx.fillText(t('门槛 p = 1/2'), X(0.5) + 4, pad.t + 12);
      ctx.strokeStyle = c.accent; ctx.setLineDash([2, 3]); lineTo(ctx, [[X(p), pad.t + H], [X(p), Y(p)]]); ctx.setLineDash([]);
      const dot = (s, col, label) => {
        if (!s || s.n < 5) return;
        const v = s.fail / s.n, e = Math.sqrt(Math.max(v * (1 - v), 1 / s.n) / s.n);
        ctx.strokeStyle = col; ctx.lineWidth = 1.4; lineTo(ctx, [[X(p), Y(Math.max(0, v - e))], [X(p), Y(Math.min(M, v + e))]]);
        ctx.fillStyle = col; ctx.beginPath(); ctx.arc(X(p), Y(v), 5, 0, 7); ctx.fill();
        ctx.fillStyle = c.ink; ctx.font = font(11, 600); ctx.textAlign = 'left'; ctx.fillText(label, X(p) + 9, Y(v) + 4);
      };
      dot(auto, c.info, t('解码器 1000 轮')); dot(me, c.ok, t('你'));
    }
    return {
      init() {
        b = board('qec');
        $$('#qec-p button').forEach((x) => x.addEventListener('click', () => setP(+x.dataset.p)));
        $$('#qec-choices .play-choice').forEach((x) => x.addEventListener('click', () => answer(x)));
        $('#qec-next').addEventListener('click', next); $('#qec-auto').addEventListener('click', runAuto);
        setP(0.15);
      },
      draw,
      bestText: (v) => (v ? `最佳连续修对 ${v} 轮` : ''),
    };
  })();

  // ── 11 Grover 寻宝 ──────────────────────────────────────────────────
  games.grover = (() => {
    const cv = $('#gr-cv'), msg = $('#gr-msg'), read = $('#gr-read');
    let b, N = 16, k = 0, marked = 0, result = null, mark;
    function reset(n = N) {
      N = n; k = 0; marked = rnd(N); result = null;
      mark(Q.groverSizes.indexOf(N));
      $('#gr-step').disabled = false; $('#gr-measure').disabled = false;
      say(msg, `宝物藏好了。现在是均匀叠加，每个盒子的概率都是 1/${N}。`);
      update();
    }
    function update() {
      const P = Q.groverP(N, k), list = [['盒子数 N', String(N)], ['已迭代', String(k)], ['测到宝物的概率', pct(P)], ['经典平均要开', `${(N + 1) / 2} 个盒子`]];
      if (result) list.push(['最佳迭代次数', `${Q.groverBest(N)}（${pct(Q.groverP(N, Q.groverBest(N)))}）`]);
      rows(read, list); draw();
    }
    function step() { if (result) return; k++; const P = Q.groverP(N, k), prev = Q.groverP(N, k - 1); if (P < prev) say(msg, `概率从 ${pct(prev)} 掉到了 ${pct(P)}：转过头了。`, 'bad'); else say(msg, `第 ${k} 次迭代：概率 ${pct(P)}。`); update(); }
    function measure() {
      if (result) return;
      const hit = Math.random() < Q.groverP(N, k);
      let box = marked; if (!hit) { box = rnd(N - 1); if (box >= marked) box++; }
      result = { box, hit };
      $('#gr-step').disabled = true; $('#gr-measure').disabled = true;
      const kb = Q.groverBest(N);
      if (hit) { b.hit(); say(msg, `找到了！迭代 ${k} 次、测量一次就打开了宝物所在的第 ${marked + 1} 号盒子。${k === kb ? '正好是最佳次数。' : `最佳是 ${kb} 次。`}`, 'ok'); }
      else { b.miss(); say(msg, `打开的是第 ${box + 1} 号盒子，空的。宝物在第 ${marked + 1} 号。迭代 ${k} 次时成功率 ${pct(Q.groverP(N, k))}，最佳是 ${kb} 次。`, 'bad'); }
      update();
    }
    function draw() {
      const { ctx, w, h } = fitR(cv, 0.6389, 1.05), c = colors(), [am, ao] = Q.groverAmps(N, k);
      const shown = Math.min(N, 64), slot = N > 64 ? marked % 64 : marked;
      const top = 16, H1 = h * 0.5, mid = top + H1 / 2, half = H1 / 2 - 8, x0 = 30, bw = (w - x0 - 12) / shown;
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1; lineTo(ctx, [[x0, mid], [w - 12, mid]]);
      ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.textAlign = 'right'; ctx.fillText('+1', x0 - 4, mid - half + 4); ctx.fillText('0', x0 - 4, mid + 4); ctx.fillText('−1', x0 - 4, mid + half + 4);
      for (let i = 0; i < shown; i++) {
        const a = i === slot ? am : ao, x = x0 + bw * i + bw * 0.12, hh = a * half;
        ctx.fillStyle = i === slot ? c.gold : c.ink2; ctx.globalAlpha = i === slot ? 1 : 0.6;
        ctx.fillRect(x, hh >= 0 ? mid - hh : mid, Math.max(1, bw * 0.76), Math.max(1, Math.abs(hh))); ctx.globalAlpha = 1;
        if (result && ((result.box < 64 && i === (N > 64 ? result.box % 64 : result.box) && (N <= 64 || result.box === marked || i !== slot)))) { ctx.strokeStyle = result.hit ? c.ok : c.warn; ctx.lineWidth = 2; ctx.strokeRect(x - 2, mid - half, bw * 0.76 + 4, half * 2); }
      }
      const mean = (am + (N - 1) * ao) / N;
      ctx.strokeStyle = c.accent; ctx.setLineDash([5, 4]); ctx.lineWidth = 1.2; lineTo(ctx, [[x0, mid - mean * half], [w - 12, mid - mean * half]]); ctx.setLineDash([]);
      ctx.fillStyle = c.ink; ctx.font = font(11.5, 600); ctx.textAlign = 'left';
      ctx.fillText(t(`宝物振幅 ${am.toFixed(3)} · 其余每个 ${ao.toFixed(4)}`), x0, top + 6);
      if (N > 64) { ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.textAlign = 'right'; ctx.fillText(t(`只画了 ${N} 个盒子中的 64 个`), w - 12, top + 6); }
      // P(k)
      const kb = Q.groverBest(N), kmax = Math.max(4, 2 * kb + 2, k + 1), py0 = top + H1 + 24, py1 = h - 26, px0 = x0, px1 = w - 12;
      const X = (v) => px0 + (v / kmax) * (px1 - px0), Y = (v) => py1 - v * (py1 - py0);
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1; lineTo(ctx, [[px0, py0], [px0, py1], [px1, py1]]);
      ctx.strokeStyle = c.muted; ctx.globalAlpha = 0.5; ctx.lineWidth = 1.4; lineTo(ctx, Array.from({ length: 241 }, (_, i) => { const v = (kmax * i) / 240; return [X(v), Y(Math.sin((2 * v + 1) * Q.groverTheta(N)) ** 2)]; })); ctx.globalAlpha = 1;
      for (let j = 0; j <= kmax; j++) { ctx.fillStyle = j === k ? c.gold : j < k ? c.ink2 : c.line; ctx.beginPath(); ctx.arc(X(j), Y(Q.groverP(N, j)), j === k ? 5 : 3, 0, 7); ctx.fill(); }
      ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.textAlign = 'center';
      const tick = Math.max(1, Math.ceil(kmax / 10));
      for (let j = 0; j <= kmax; j += tick) ctx.fillText(String(j), X(j), py1 + 14);
      ctx.textAlign = 'right'; ctx.fillText('100%', px0 - 4, py0 + 4); ctx.fillText('0', px0 - 4, py1 + 4);
      ctx.textAlign = 'left'; ctx.fillText(t('迭代次数 k'), px1 - 70, py1 - 6);
    }
    return {
      init() {
        b = board('grover');
        mark = levels($('#gr-sizes'), Q.groverSizes.map((n) => `N = ${n}`), (i) => reset(Q.groverSizes[i]), () => false);
        $('#gr-step').addEventListener('click', step); $('#gr-measure').addEventListener('click', measure); $('#gr-reset').addEventListener('click', () => reset());
        reset(16);
      },
      draw,
      bestText: (v) => (v ? `最佳连续找到 ${v} 次` : ''),
    };
  })();

  // ── 12 噪声助推能量传递 ─────────────────────────────────────────────
  games.enaqt = (() => {
    const cv = $('#en-cv'), msg = $('#en-msg'), read = $('#en-read'), sg = $('#en-g'), nets = Q.networks;
    const TEXT = [
      '三个能量相同的位点排成一条链。激发从最左边出发，在最右边被反应中心取走。找到让传递效率最高的退相干率（达到最高效率的 97% 就算过关）。',
      '这次三个位点的能量是 0、3、6（单位是耦合 J），像一级级台阶。完全相干时，能量差让激发很难走过去。',
      '两条路从起点通到终点，但其中一条路上的耦合是负的。完全相干时，两条路的波在终点相消。',
    ];
    const curves = {};
    let k = 0, probes = [], tries = 0, mark;
    const net = () => nets[k], curve = () => (curves[k] ||= Q.enaqtCurve(net()));
    const eff = (s) => curve()[s];
    const gText = (g) => (g === 0 ? '0（完全相干）' : `${g < 0.1 ? g.toFixed(3) : g < 10 ? g.toFixed(2) : g.toFixed(0)} J`);
    function choose(i) { k = i; probes = []; tries = 0; sg.value = nets[i].s0; $('#en-task').textContent = TEXT[i]; mark(i); say(msg, ''); update(); }
    function update() {
      const s = +sg.value, g = Q.gammaAt(s), r = Q.transfer(net().H, { ...Q.enaqtRates, gamma: g, trap: net().trap });
      $('#en-g-v').textContent = gText(g);
      rows(read, [['传递效率 η', pct(r.efficiency)], ['途中损失', pct(r.lost)], ['已记下', `${probes.length} 个点`]]);
      draw();
    }
    function probe() { const s = +sg.value; if (!probes.includes(s)) probes.push(s); update(); }
    function lock() {
      const s = +sg.value, c = curve(), mx = Math.max(...c), at = c.indexOf(mx), v = c[s];
      if (!probes.includes(s)) probes.push(s);
      if (v >= 0.97 * mx) {
        addTo('enaqt', net().id); mark(k);
        const g0 = c[0], lesson = k === 0 ? '这张网络里噪声只会拖慢传递，完全相干最好。' : k === 1 ? '噪声把每个位点的能级展宽，激发才能跨过能量台阶；最佳噪声和台阶高度同一量级。' : '噪声打乱了两条路之间的相位，相消干涉被打破，被锁住的激发放出来了。';
        say(msg, `过关！效率 ${pct(v)}。最高 ${pct(mx)}，在 γ ≈ ${gText(Q.gammaAt(at))}；没有噪声时是 ${pct(g0)}，噪声极大时降到 ${pct(c[120])}（量子芝诺效应把激发冻住了）。${lesson}`, 'ok');
      } else {
        tries++;
        say(msg, `效率 ${pct(v)}，还不是最好。${tries >= 2 ? (at > s ? '提示：试试更大的噪声。' : '提示：试试更小的噪声。') : '多记几个点，看看曲线的走势。'}`, 'bad');
      }
      update();
    }
    function draw() {
      const { ctx, w, h } = fitR(cv, 0.6389, 1.1), c = colors(), N = net(), n = N.H.length, done = has('enaqt', N.id);
      // 网络
      const top = 20, H1 = h * 0.38, gx0 = Math.max(60, w * 0.14), gx1 = w - Math.max(110, w * 0.2);
      const pos = N.pos.map(([x, y]) => [gx0 + (x / 2) * (gx1 - gx0), top + H1 / 2 + y * (H1 / 2.4)]);
      for (let a = 0; a < n; a++) for (let b2 = a + 1; b2 < n; b2++) {
        const J = N.H[a][b2]; if (!J) continue;
        ctx.strokeStyle = J < 0 ? c.warn : c.ink2; ctx.lineWidth = 2; ctx.setLineDash(J < 0 ? [6, 4] : []); lineTo(ctx, [pos[a], pos[b2]]); ctx.setLineDash([]);
        if (J < 0) { ctx.fillStyle = c.warn; ctx.font = font(11, 600); ctx.textAlign = 'center'; ctx.fillText('−J', (pos[a][0] + pos[b2][0]) / 2 + 12, (pos[a][1] + pos[b2][1]) / 2 + 4); }
      }
      pos.forEach(([x, y], i) => {
        ctx.fillStyle = i === 0 ? c.gold : c.surface; ctx.strokeStyle = i === N.trap ? c.ok : c.strong; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, 15, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = c.ink; ctx.font = font(12, 700); ctx.textAlign = 'center'; ctx.fillText(String(i + 1), x, y + 4);
        if (N.id === 'stairs') { ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.fillText(`E = ${N.H[i][i]} J`, x, y + 30); }
      });
      const [tx, ty] = pos[N.trap];
      ctx.strokeStyle = c.ok; ctx.fillStyle = c.ok; ctx.lineWidth = 2; lineTo(ctx, [[tx + 18, ty], [tx + 50, ty]]);
      ctx.beginPath(); ctx.moveTo(tx + 56, ty); ctx.lineTo(tx + 48, ty - 5); ctx.lineTo(tx + 48, ty + 5); ctx.fill();
      ctx.font = font(11, 600); ctx.textAlign = 'left'; ctx.fillText(t('反应中心'), tx + 60, ty + 4);
      ctx.fillStyle = c.gold; ctx.textAlign = 'center'; ctx.fillText(t('起点'), pos[0][0], pos[0][1] - 22);
      // η(γ)
      const px0 = 48, px1 = w - 14, py0 = top + H1 + 26, py1 = h - 30, gap = 22;
      const X = (s) => (s === 0 ? px0 : px0 + gap + ((s - 1) / 119) * (px1 - px0 - gap)), Y = (v) => py1 - v * (py1 - py0);
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1; lineTo(ctx, [[px0, py0], [px0, py1], [px1, py1]]);
      ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.textAlign = 'center';
      ctx.fillText('0', X(0), py1 + 14);
      for (let e = -2; e <= 3; e++) { const s = 1 + ((e + 2) / 5) * 119; ctx.fillText(`10${sup(e)}`, X(s), py1 + 14); }
      ctx.fillText(t('退相干率 γ（单位 J）'), (px0 + px1) / 2, h - 4);
      ctx.textAlign = 'right'; ctx.fillText('100%', px0 - 4, py0 + 4); ctx.fillText('0', px0 - 4, py1 + 4);
      if (done) { const cc = curve(); ctx.strokeStyle = c.gold; ctx.lineWidth = 2; lineTo(ctx, cc.slice(1).map((v, i) => [X(i + 1), Y(v)])); ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(X(0), Y(cc[0]), 3, 0, 7); ctx.fill(); }
      for (const s of probes) { ctx.fillStyle = c.info; ctx.beginPath(); ctx.arc(X(s), Y(eff(s)), 4, 0, 7); ctx.fill(); }
      const s = +sg.value; ctx.strokeStyle = c.accent; ctx.setLineDash([3, 3]); lineTo(ctx, [[X(s), py0], [X(s), py1]]); ctx.setLineDash([]);
      ctx.fillStyle = c.accent; ctx.beginPath(); ctx.arc(X(s), Y(eff(s)), 5.5, 0, 7); ctx.fill();
    }
    return {
      init() {
        mark = levels($('#en-nets'), ['整齐的链', '能量台阶', '菱形暗态'], choose, (i) => has('enaqt', nets[i].id));
        sg.addEventListener('input', update);
        $('#en-probe').addEventListener('click', probe); $('#en-lock').addEventListener('click', lock);
        const first = nets.findIndex((x) => !has('enaqt', x.id));
        choose(first < 0 ? 0 : first);
      },
      draw,
      bestText: (v) => (v?.length ? `已调好 ${v.length} / ${nets.length} 张网络` : ''),
    };
  })();

  // ── 13 普朗克单位工坊 ───────────────────────────────────────────────
  games.planck = (() => {
    const cv = $('#pl-cv'), msg = $('#pl-msg'), read = $('#pl-read'), T = Q.planckTargets;
    const NAME = { length: '长度', time: '时间', mass: '质量', energy: '能量', force: '力', power: '功率', density: '密度', momentum: '动量' };
    const FACT = {
      length: '普朗克长度 ℓ_P = √(ħG/c³) ≈ 1.616 × 10⁻³⁵ m，比质子半径小约 5 × 10¹⁹ 倍。',
      time: '普朗克时间 t_P = √(ħG/c⁵) ≈ 5.39 × 10⁻⁴⁴ s，就是光走过一个普朗克长度的时间。',
      mass: '普朗克质量 m_P = √(ħc/G) ≈ 2.18 × 10⁻⁸ kg，约 22 微克，是质子质量的 1.3 × 10¹⁹ 倍。',
      energy: '普朗克能量 E_P = √(ħc⁵/G) ≈ 1.96 × 10⁹ J ≈ 1.22 × 10¹⁹ GeV，和一箱 50 升汽油燃烧放出的热差不多，只是要集中在一个粒子身上。',
      force: 'c⁴/G ≈ 1.21 × 10⁴⁴ N：里面没有 ħ，是纯经典的组合，爱因斯坦场方程右边的系数就是 8πG/c⁴。',
      power: 'c⁵/G ≈ 3.63 × 10⁵² W：也没有 ħ。第一次探测到的双黑洞并合 GW150914，引力波的峰值功率约 3.6 × 10⁴⁹ W，是它的千分之一左右。',
      density: '普朗克密度 c⁵/(ħG²) ≈ 5.16 × 10⁹⁶ kg/m³，相当于把一个普朗克质量塞进边长一个普朗克长度的立方体。',
      momentum: '普朗克动量 √(ħc³/G) = m_P c ≈ 6.5 kg·m/s，和一个以 45 m/s 投出的棒球（0.145 kg）差不多。',
    };
    let k = 0, ex = [0, 0, 0], mark;
    const frac = (v) => (v === 0 ? '0' : `${v < 0 ? '−' : ''}${Number.isInteger(Math.abs(v)) ? Math.abs(v) : `${Math.abs(v) * 2}/2`}`);
    const pw = (v) => (Number.isInteger(v) ? sup(v) : `^(${frac(v)})`);
    const dimText = ([M, L, Tm]) => `M${pw(M)} L${pw(L)} T${pw(Tm)}`;
    const same = (a, b) => a.every((v, i) => Math.abs(v - b[i]) < 1e-9);
    function choose(i) { k = i; ex = [0, 0, 0]; $('#pl-task').textContent = `拼出一个${NAME[T[i].id]}（单位 ${T[i].unit}）：目标量纲 ${dimText(T[i].dim)}。`; mark(i); say(msg, ''); update(); }
    function steppers() {
      $('#pl-steps').replaceChildren(...['ħ', 'c', 'G'].map((s, i) => {
        const minus = el('button', { type: 'button', className: 'button', textContent: '−' }), plus = el('button', { type: 'button', className: 'button', textContent: '+' }), out = el('output');
        minus.setAttribute('aria-label', `${s} 的指数减 ½`); plus.setAttribute('aria-label', `${s} 的指数加 ½`);
        minus.addEventListener('click', () => { ex[i] = Math.max(-6, ex[i] - 0.5); update(); });
        plus.addEventListener('click', () => { ex[i] = Math.min(6, ex[i] + 0.5); update(); });
        const row = el('div', { className: 'pl-step' }, [el('b', { textContent: s }), el('span', { textContent: '的指数' }), minus, out, plus]);
        row.querySelector('b').setAttribute('translate', 'no');
        return row;
      }));
    }
    function update() {
      $$('#pl-steps output').forEach((o, i) => { o.textContent = frac(ex[i]); });
      const d = Q.dims(...ex), v = Q.value(...ex), target = T[k], ok = same(d, target.dim);
      const combo = ['ħ', 'c', 'G'].map((s, i) => (ex[i] ? (Number.isInteger(ex[i]) ? `${s}${sup(ex[i])}` : `${s}^(${frac(ex[i])})`) : '')).filter(Boolean).join(' ') || '1';
      rows(read, [['你的组合', combo], ['量纲', dimText(d)], ['数值（SI）', sci(v, 4)]]);
      if (ok) { addTo('planck', target.id); mark(k); say(msg, `拼出来了！${FACT[target.id]}`, 'ok'); }
      else say(msg, '');
      draw();
    }
    function draw() {
      const { ctx, w, h } = fitR(cv, 0.5556, 0.85), c = colors(), d = Q.dims(...ex), target = T[k].dim, x0 = 64, x1 = w - 24, R = 6;
      const X = (v) => x0 + ((Math.max(-R, Math.min(R, v)) + R) / (2 * R)) * (x1 - x0);
      ['M', 'L', 'T'].forEach((lab, i) => {
        const y = 52 + i * ((h - 150) / 2);
        ctx.strokeStyle = c.strong; ctx.lineWidth = 1.2; lineTo(ctx, [[x0, y], [x1, y]]);
        ctx.fillStyle = c.muted; ctx.font = font(10.5); ctx.textAlign = 'center';
        for (let v = -R; v <= R; v++) { lineTo(ctx, [[X(v), y - 4], [X(v), y + 4]]); if (v % 2 === 0) ctx.fillText(String(v).replace('-', '−'), X(v), y + 18); }
        ctx.fillStyle = c.ink; ctx.font = font(16, 700); ctx.textAlign = 'right'; ctx.fillText(lab, x0 - 18, y + 6);
        const hit = Math.abs(d[i] - target[i]) < 1e-9;
        ctx.strokeStyle = c.ink2; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(X(target[i]), y, 11, 0, 7); ctx.stroke();
        ctx.fillStyle = hit ? c.ok : c.gold; ctx.beginPath(); ctx.arc(X(d[i]), y, 7, 0, 7); ctx.fill();
        if (Math.abs(d[i]) > R) { ctx.fillStyle = c.warn; ctx.font = font(11, 600); ctx.textAlign = 'center'; ctx.fillText(frac(d[i]), X(d[i]), y - 14); }
      });
      // ħᵃ cᵇ Gᶜ，指数写小一号、抬高
      const parts = ['ħ', 'c', 'G'].map((s, i) => [s, frac(ex[i])]), big = font(26, 600), small = font(15, 600);
      let total = 0; for (const [s, e] of parts) { ctx.font = big; total += ctx.measureText(s).width + 4; ctx.font = small; total += ctx.measureText(e).width + 18; }
      let x = (w - total) / 2; const y = h - 28; ctx.textAlign = 'left';
      for (const [s, e] of parts) { ctx.fillStyle = c.ink; ctx.font = big; ctx.fillText(s, x, y); x += ctx.measureText(s).width + 4; ctx.fillStyle = e === '0' ? c.muted : c.accent; ctx.font = small; ctx.fillText(e, x, y - 13); x += ctx.measureText(e).width + 18; }
    }
    return {
      init() {
        steppers();
        mark = levels($('#pl-targets'), T.map((x) => NAME[x.id]), choose, (i) => has('planck', T[i].id));
        $('#pl-show').addEventListener('click', () => { ex = Q.solveDims(T[k].dim); update(); });
        const first = T.findIndex((x) => !has('planck', x.id));
        choose(first < 0 ? 0 : first);
      },
      draw,
      bestText: (v) => (v?.length ? `已拼出 ${v.length} / ${T.length} 个单位` : ''),
    };
  })();

  // ── 14 ħ-c-G 立方体分拣 ─────────────────────────────────────────────
  games.cube = (() => {
    const cv = $('#cube-cv'), msg = $('#cube-msg');
    const L2 = (zh, e) => (en ? e : zh);
    const CORNER = {
      newton: ['牛顿力学', 'Newtonian mechanics'], sr: ['狭义相对论', 'Special relativity'], newtongrav: ['牛顿引力', 'Newtonian gravity'], qm: ['量子力学', 'Quantum mechanics'],
      gr: ['广义相对论', 'General relativity'], sm: ['量子场论', 'Quantum field theory'], nqg: ['牛顿量子引力', 'Newtonian quantum gravity'], qg: ['量子引力（未建立）', 'Quantum gravity (not yet built)'],
    };
    const CASE = {
      billiard: ['两个台球相撞后各自的速度', 'The velocities of two billiard balls after they collide', '动量守恒和能量守恒就够了：速度远小于光速，台球之间的引力可以忽略，作用量比 ħ 大几十个数量级。', 'Conservation of momentum and energy is enough: the speeds are far below light speed, the gravity between the balls is negligible, and the action is dozens of orders of magnitude larger than ħ.'],
      tides: ['一天两次的海洋潮汐', 'Ocean tides, twice a day', '月球和太阳的引力在地球两侧的差把海水拉出两个隆起。牛顿引力就能解释，不需要相对论和量子。', 'The difference between the Moon’s and Sun’s pull on the two sides of the Earth raises two bulges of water. Newtonian gravity explains it; no relativity, no quanta.'],
      muon: ['宇宙射线里的 μ 子能飞到地面', 'Cosmic-ray muons reach the ground', 'μ 子的平均寿命只有 2.2 μs，不考虑相对论只能飞约 660 m；它们在约 15 km 高空产生，却大量到达地面，因为高速运动的钟变慢了。衰变本身属于弱相互作用，但“飞得到”只需要狭义相对论。', 'A muon lives 2.2 μs on average, which without relativity is enough for only about 660 m; they are made about 15 km up and still reach the ground in large numbers, because moving clocks run slow. The decay itself is the weak interaction, but getting there needs only special relativity.'],
      mercury: ['水星近日点每世纪多进动 43 角秒', 'Mercury’s perihelion advances an extra 43 arcseconds per century', '扣掉其他行星的摄动后，牛顿引力还差每世纪约 43″，广义相对论正好补上（爱因斯坦，1915）。', 'After the pulls of the other planets are subtracted, Newtonian gravity is still short by about 43″ per century; general relativity supplies exactly that (Einstein, 1915).'],
      gps: ['GPS 卫星上的原子钟每天要校正约 38 微秒', 'GPS satellite clocks are corrected by about 38 microseconds a day', '卫星跑得快，狭义相对论让钟每天慢约 7 μs；卫星离地球远、引力势高，广义相对论让钟每天快约 45 μs；合起来每天快约 38 μs。两个效应都要：1/c 和 G。', 'The satellites move fast, so special relativity slows their clocks by about 7 μs a day; they sit higher in Earth’s gravitational potential, so general relativity speeds them up by about 45 μs a day; the net is about 38 μs fast. Both effects are needed: 1/c and G.'],
      gw: ['LIGO 探测到双黑洞并合的引力波（2015）', 'LIGO detects gravitational waves from merging black holes (2015)', '引力波是时空本身的涟漪、以光速传播，是广义相对论的预言；牛顿引力是瞬时作用的，没有引力波。', 'Gravitational waves are ripples of spacetime itself travelling at light speed, a prediction of general relativity; Newtonian gravity acts instantly and has no waves.'],
      hydrogen: ['氢原子只发出几种特定颜色的光', 'Hydrogen glows only in a few particular colours', '能级 Eₙ = −13.6 eV / n² 来自非相对论的薛定谔方程。更细的精细结构才需要相对论（1/c），那是下一层的修正。', 'The levels Eₙ = −13.6 eV / n² come from the non-relativistic Schrödinger equation. Only the finer fine structure needs relativity (1/c), a next-order correction.'],
      stm: ['扫描隧道显微镜“看”到单个原子', 'A scanning tunnelling microscope “sees” single atoms', '针尖和样品之间隔着真空势垒，电子靠隧穿通过，电流随距离指数衰减，所以对原子级的起伏极其敏感。非相对论量子力学就够了。', 'Between tip and sample is a vacuum barrier; electrons cross it by tunnelling, and the current falls exponentially with distance, so it is extremely sensitive to atomic-scale bumps. Non-relativistic quantum mechanics is enough.'],
      annihilation: ['正电子和电子湮灭成两个 511 keV 光子（PET 成像）', 'An electron and a positron annihilate into two 511 keV photons (PET imaging)', '粒子的产生和湮灭要用量子场论：511 keV 就是电子的 mc²，要 1/c；光子是量子化的，要 ħ。', 'Creating and destroying particles takes quantum field theory: 511 keV is the electron’s mc², which needs 1/c; photons are quanta, which needs ħ.'],
      gold: ['金是黄色的，银却是银白色', 'Gold is yellow, while silver is silvery white', '金的原子序数大，1s 电子的速度约为光速的 58%。相对论效应让 6s 轨道收缩、5d 轨道升高，5d → 6s 的吸收移到蓝光附近，反射回来的光就偏黄。要用相对论性的量子化学（1/c 与 ħ）。', 'Gold’s nucleus is heavy, and its 1s electrons move at about 58% of light speed. Relativity contracts the 6s orbital and raises the 5d, moving the 5d → 6s absorption toward blue, so the reflected light looks yellow. It takes relativistic quantum chemistry (1/c and ħ).'],
      cow: ['中子干涉仪倾斜一个角度，干涉条纹就移动（COW 实验，1975）', 'Tilt a neutron interferometer and its fringes shift (the COW experiment, 1975)', 'Colella、Overhauser 和 Werner 让中子的两条路径处在不同高度，引力势能差给两路波函数带来相位差。同时用到引力（G，这里是地球的引力）和 ħ；中子很慢，不需要相对论。', 'Colella, Overhauser and Werner put the neutron’s two paths at different heights, and the difference in gravitational potential energy shifts the phase between them. It uses gravity (G, here Earth’s) and ħ; the neutrons are slow, so no relativity.'],
      qbounce: ['中子在镜面上方“弹跳”的高度是量子化的（Nesvizhevsky 等，2002）', 'Neutrons bouncing above a mirror have quantised heights (Nesvizhevsky et al., 2002)', '超冷中子落在水平镜面上，在地球引力场里形成分立的量子态，最低态的经典转折点高约 14 μm。引力加量子，不需要相对论。', 'Ultracold neutrons falling onto a horizontal mirror form discrete quantum states in Earth’s gravity; the lowest has its classical turning point about 14 μm up. Gravity plus quanta, no relativity.'],
      chandrasekhar: ['白矮星的质量有上限，约 1.4 个太阳质量', 'White dwarfs have a maximum mass, about 1.4 solar masses', '电子简并压（ħ）撑住引力（G）；质量越大电子越接近光速（1/c），压强变软、撑不住了。钱德拉塞卡极限 M_Ch ∝ (ħc/G)^{3/2} / m_H² 三个常数都要，但它不需要量子化的引力。', 'Electron degeneracy pressure (ħ) holds up against gravity (G); in heavier stars the electrons approach light speed (1/c), the pressure softens and gives way. The Chandrasekhar limit M_Ch ∝ (ħc/G)^{3/2} / m_H² needs all three constants, yet no quantised gravity.'],
      hawking: ['黑洞会因为霍金辐射慢慢蒸发（尚未观测到）', 'Black holes slowly evaporate by Hawking radiation (not yet observed)', '在弯曲时空（G 与 1/c）上做量子场论（ħ），温度 T = ħc³ / (8πGMk_B)。这是半经典计算，不是完整的量子引力。太阳质量黑洞的温度只有约 60 nK，远低于宇宙微波背景，所以至今没有观测到。', 'Quantum field theory (ħ) on curved spacetime (G and 1/c) gives the temperature T = ħc³ / (8πGMk_B). It is a semiclassical calculation, not full quantum gravity. A solar-mass black hole is only about 60 nK, far colder than the cosmic microwave background, so it has never been seen.'],
    };
    let b, cur = null, sel = [0, 0, 0], done = false;
    const key = (k) => k.join('');
    const cornerName = (k) => { const n = CORNER[Q.cubeName[key(k)]]; return L2(n[0], n[1]); };
    function ask() {
      cur = pick(Q.cubeCases.filter((x) => x !== cur)); sel = [0, 0, 0]; done = false;
      const [zh, e] = CASE[cur.id];
      const box = $('#cube-case'); box.setAttribute('translate', 'no');
      box.replaceChildren(el('small', { textContent: L2('现象', 'Phenomenon') }), el('b', { textContent: L2(zh, e) }));
      $('#cube-go').disabled = false; say(msg, ''); sync();
    }
    function sync() {
      $$('#cube-switches button').forEach((x) => { x.setAttribute('aria-pressed', String(!!sel[+x.dataset.i])); x.disabled = done; });
      draw();
    }
    function go() {
      if (done) return;
      done = true; $('#cube-go').disabled = true;
      const right = key(sel) === key(cur.k), note = L2(CASE[cur.id][2], CASE[cur.id][3]);
      right ? b.hit() : b.miss();
      const name = cornerName(cur.k);
      msg.setAttribute('translate', 'no');
      say(msg, right ? L2(`对了：${name}。${note}`, `Right: ${name}. ${note}`) : L2(`应该是：${name}。${note}`, `It is: ${name}. ${note}`), right ? 'ok' : 'bad');
      sync();
    }
    function draw() {
      const { ctx, w, h } = fitR(cv, 0.6389, 0.95), c = colors(), S = Math.min(w * (w < 480 ? 0.3 : 0.36), h * 0.5), ox = w * 0.5 - S * 0.75, oy = h * 0.5 + S * 0.62;
      const P = ([x, y, z]) => [ox + x * S + z * S * 0.5, oy - y * S - z * S * 0.38];
      const corners = []; for (let i = 0; i < 8; i++) corners.push([(i >> 2) & 1, (i >> 1) & 1, i & 1]);
      ctx.strokeStyle = c.strong; ctx.lineWidth = 1.2;
      for (const a of corners) for (let d = 0; d < 3; d++) if (!a[d]) { const b2 = a.slice(); b2[d] = 1; lineTo(ctx, [P(a), P(b2)]); }
      // 三条坐标棱
      const axes = [['1/c', [1, 0, 0]], ['G', [0, 1, 0]], ['ħ', [0, 0, 1]]];
      for (const [lab, v] of axes) { ctx.strokeStyle = c.accent; ctx.lineWidth = 2.6; lineTo(ctx, [P([0, 0, 0]), P(v)]); const [x, y] = P(v.map((q) => q * 0.5)); ctx.fillStyle = c.accent; ctx.font = font(13, 700); ctx.textAlign = 'center'; ctx.fillText(lab, x + (v[1] ? -16 : 0), y + (v[0] ? 18 : v[2] ? -8 : 0)); }
      for (const k of corners) {
        const [x, y] = P(k), isSel = key(k) === key(sel), isRight = done && key(k) === key(cur.k);
        ctx.fillStyle = isRight ? c.ok : isSel ? c.gold : c.surface; ctx.strokeStyle = isRight ? c.ok : isSel ? c.gold : c.strong; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(x, y, isSel || isRight ? 9 : 6, 0, 7); ctx.fill(); ctx.stroke();
        ctx.fillStyle = isSel || isRight ? c.ink : c.ink2; ctx.font = font(w < 480 ? 10 : 11.5, isSel || isRight ? 700 : 500);
        const right = k[0] || (k[2] && !k[0]); ctx.textAlign = k[0] ? 'left' : 'right';
        ctx.fillText(cornerName(k), x + (k[0] ? 14 : -14), y + (k[1] ? -8 : 16) * (right ? 1 : 1));
      }
    }
    return {
      init() {
        b = board('cube');
        $$('#cube-switches button').forEach((x) => x.addEventListener('click', () => { if (done) return; sel[+x.dataset.i] ^= 1; sync(); }));
        $('#cube-go').addEventListener('click', go); $('#cube-next').addEventListener('click', ask);
        ask();
      },
      draw,
    };
  })();

  return games;
};
