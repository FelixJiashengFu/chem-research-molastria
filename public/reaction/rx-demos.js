'use strict';
// 反应动力学与过渡态（/reaction/）的十三个演示。数学都在 rx-models.js（纯函数，tools/reaction-test.mjs 测）。rx.js 用 window.MOLASTRIA_RXN_DEMOS(K, DEMOS) 把它们登记进去。
// 每个演示：title，kind，intro，sel 下拉 [键, 名字, [[值, 名字]…], 初值]，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，chk 开关 [键, 名字, 初值]，
// btn 预设 [名字, { 键: 值 }]，act 动作，state，autoplay，fps + tick(s)，changed(s, 键)，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 返回读数 [[名字, 值, 是否加粗]]。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。K 是 rx.js 给的画图工具。
window.MOLASTRIA_RXN_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_RXN_MODELS;
  const { L, fix, fmt, plot, fit, lin, arrow, font, esc } = K;
  let probe = null;
  const rgbOf = (col) => { probe ||= document.createElement('canvas').getContext('2d'); probe.fillStyle = '#000'; probe.fillStyle = col || '#000'; const v = probe.fillStyle; if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)); const m = v.match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };
  const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
  const minus = (s) => String(s).replace(/-/g, '−');
  const kj = (v, d = 1) => `${fix(v, d)} kJ/mol`;
  const sci = (v) => `${fmt(v, 3)}`;
  // 秒换成人能读的时间
  const human = (t) => {
    if (!Number.isFinite(t)) return '∞';
    const u = [[3.156e7 * 1e9, L('十亿年', 'billion years')], [3.156e7, L('年', 'years')], [86400, L('天', 'days')], [3600, L('小时', 'hours')], [60, L('分钟', 'minutes')], [1, L('秒', 's')], [1e-3, 'ms'], [1e-6, 'µs'], [1e-9, 'ns'], [1e-12, 'ps']];
    for (const [s, n] of u) if (t >= s) return `${fmt(t / s, 3)} ${n}`;
    return `${fmt(t * 1e15, 3)} fs`;
  };

  // ── Müller–Brown 势能面：底图（带颜色分层，看起来像等高线）、坐标换算 ───────────
  const BOX = { x0: -1.5, x1: 1.2, y0: -0.25, y1: 2.0 };
  let SURF = null;
  function surface(cv, c) {
    const { ctx, w, h } = fit(cv), pad = 6, W = w - 2 * pad, Hh = h - 2 * pad;
    const sx = W / (BOX.x1 - BOX.x0), sy = Hh / (BOX.y1 - BOX.y0), sc = Math.min(sx, sy), ox = pad + (W - sc * (BOX.x1 - BOX.x0)) / 2, oy = pad + (Hh - sc * (BOX.y1 - BOX.y0)) / 2;
    const X = (x) => ox + (x - BOX.x0) * sc, Y = (y) => oy + (BOX.y1 - y) * sc, inv = (px, py) => [BOX.x0 + (px - ox) / sc, BOX.y1 - (py - oy) / sc];
    const key = `${c.accent}|${c.surface}|${c.gold}|${c.danger}`;
    if (!SURF || SURF.key !== key) {
      const N = 180, Ny = Math.round((N * (BOX.y1 - BOX.y0)) / (BOX.x1 - BOX.x0)), oc = document.createElement('canvas'); oc.width = N; oc.height = Ny;
      const ox2 = oc.getContext('2d'), img = ox2.createImageData(N, Ny), lo = rgbOf(c.accent), hi = rgbOf(c.surface), top = rgbOf(c.danger);
      for (let j = 0; j < Ny; j++) for (let i = 0; i < N; i++) {
        const x = BOX.x0 + ((i + 0.5) * (BOX.x1 - BOX.x0)) / N, y = BOX.y1 - ((j + 0.5) * (BOX.y1 - BOX.y0)) / Ny, v = M.mb(x, y), q = 4 * (j * N + i);
        const t = Math.max(0, Math.min(1, (v + 150) / 200)), band = Math.floor(t * 20), shade = band % 2 ? 0.94 : 1;
        const col = v > 50 ? mix(hi, top, Math.min(1, (v - 50) / 300) * 0.35) : mix(lo, hi, 0.18 + 0.82 * (band / 20));
        img.data[q] = col[0] * shade; img.data[q + 1] = col[1] * shade; img.data[q + 2] = col[2] * shade; img.data[q + 3] = 255;
      }
      ox2.putImageData(img, 0, 0); SURF = { key, oc };
    }
    ctx.imageSmoothingEnabled = true;
    ctx.drawImage(SURF.oc, X(BOX.x0), Y(BOX.y1), (BOX.x1 - BOX.x0) * sc, (BOX.y1 - BOX.y0) * sc);
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.strokeRect(X(BOX.x0), Y(BOX.y1), (BOX.x1 - BOX.x0) * sc, (BOX.y1 - BOX.y0) * sc);
    // 坐标刻度
    ctx.fillStyle = c.ink2; ctx.font = font(10);
    for (const x of [-1, -0.5, 0, 0.5, 1]) { ctx.textAlign = 'center'; ctx.fillText(minus(x), X(x), Y(BOX.y0) - 4); }
    for (const y of [0, 0.5, 1, 1.5]) { ctx.textAlign = 'left'; ctx.fillText(minus(y), X(BOX.x0) + 4, Y(y) + 3); }
    return { ctx, w, h, X, Y, inv, sc };
  }
  const markPoints = (g, c) => {
    for (const p of M.MB_POINTS) {
      const x = g.X(p.x), y = g.Y(p.y);
      g.ctx.fillStyle = p.kind === 'ts' ? c.gold : c.paper; g.ctx.strokeStyle = c.ink; g.ctx.lineWidth = 1.4;
      g.ctx.beginPath();
      if (p.kind === 'ts') { g.ctx.moveTo(x, y - 6); g.ctx.lineTo(x + 6, y); g.ctx.lineTo(x, y + 6); g.ctx.lineTo(x - 6, y); g.ctx.closePath(); } else g.ctx.arc(x, y, 5, 0, 2 * Math.PI);
      g.ctx.fill(); g.ctx.stroke();
      g.ctx.fillStyle = c.ink; g.ctx.font = font(11, 700); g.ctx.textAlign = 'left'; g.ctx.fillText(p.id, x + 8, y - 6);
    }
  };
  const pointer = (cv, g, s, fn) => { cv.onpointerdown = (e) => { const r = cv.getBoundingClientRect(), [x, y] = g.inv(((e.clientX - r.left) / r.width) * g.w, ((e.clientY - r.top) / r.height) * g.h); if (x >= BOX.x0 && x <= BOX.x1 && y >= BOX.y0 && y <= BOX.y1) { fn(x, y); s.redraw(); } }; cv.classList.add('nq-point'); };
  const pname = (st) => { const hit = M.MB_POINTS.find((p) => Math.hypot(p.x - st.x, p.y - st.y) < 0.01); return hit ? hit.id : '—'; };

  // ── 1. 势能面和驻点 ─────────────────────────────────────────────
  DEMOS.pes = {
    title: L('Müller–Brown 势能面：点一下，找最近的驻点', 'The Müller–Brown surface: click to find the nearest stationary point'), kind: 'exact',
    intro: L('颜色越深能量越低，一圈圈色带就像等高线。圆点是三个极小点（MA、MB、MC），菱形是两个鞍点（S1、S2）。在图上点一下（或者拖滑块），从那里出发做两件事：沿负梯度一路下山（白线），以及用 Newton 法找梯度为零的点（金色圈）。看 Newton 法落到哪个驻点，再看那里 Hessian 的两个本征值：两个都为正是极小，一正一负是过渡态。', 'Darker means lower energy, and the colour bands work like contour lines. Dots are the three minima (MA, MB, MC), diamonds the two saddles (S1, S2). Click on the map (or use the sliders) to do two things from there: walk downhill along the negative gradient (white line), and use Newton’s method to find a point of zero gradient (gold ring). See which stationary point Newton lands on, and look at the two Hessian eigenvalues there: both positive is a minimum, one of each sign a transition state.'),
    ctl: [['x', 'x', -1.5, 1.2, 0.005, -0.75, (v) => minus(v.toFixed(3))], ['y', 'y', -0.25, 2, 0.005, 0.75, (v) => minus(v.toFixed(3))]],
    chk: [['path', L('画下山的路径', 'Draw the downhill path'), true]],
    btn: [[L('S1 附近', 'Near S1'), { x: -0.75, y: 0.75 }], [L('S2 附近', 'Near S2'), { x: 0.25, y: 0.33 }], [L('两个谷之间的山脊', 'On a ridge between valleys'), { x: -0.2, y: 0.95 }], [L('MA 附近', 'Near MA'), { x: -0.45, y: 1.3 }]],
    figs: [[0.82, L('Müller–Brown 势（Müller & Brown 1979 的四个高斯项），横轴 x、纵轴 y，单位随意。', 'The Müller–Brown potential (the four Gaussian terms of Müller & Brown 1979); x across, y up, arbitrary units.')]],
    note: L('势能面是二维的模型势，不是某个真实分子的。Newton 法每一步解 H Δq = −∇V，步长限制在 0.05 以内；它找到的是离起点“最近的”驻点，这个“最近”由 Hessian 的形状决定，不一定是直线距离最近的那个。下山路径用 RK4 积分 dx/ds = −∇V/|∇V|。五个驻点的坐标和能量照论文，测试里核对 Newton 法从附近出发都能落回它们。', 'The surface is a two-dimensional model potential, not a real molecule. Each Newton step solves H Δq = −∇V, with steps capped at 0.05; it finds the stationary point “nearest” the start in a sense set by the Hessian, not necessarily the closest in straight-line distance. The downhill path integrates dx/ds = −∇V/|∇V| with RK4. The coordinates and energies of the five stationary points follow the paper, and the tests check that Newton’s method returns to each from nearby.'),
    draw(s, [cv], c) {
      const g = surface(cv, c), { ctx } = g;
      if (s.path) { const p = M.descend(s.x, s.y, 0.006, 3000, 0.5); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2.2; ctx.beginPath(); p.forEach((q, i) => (i ? ctx.lineTo(g.X(q[0]), g.Y(q[1])) : ctx.moveTo(g.X(q[0]), g.Y(q[1])))); ctx.stroke(); }
      markPoints(g, c);
      const st = M.stationary(s.x, s.y), a = M.mbAll(s.x, s.y), e = M.eig2(a.h).vals;
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(g.X(st.x), g.Y(st.y), 10, 0, 2 * Math.PI); ctx.stroke();
      ctx.fillStyle = c.danger; ctx.beginPath(); ctx.arc(g.X(s.x), g.Y(s.y), 4.5, 0, 2 * Math.PI); ctx.fill();
      // 负梯度方向的小箭头
      const gn = Math.hypot(a.g[0], a.g[1]) || 1; arrow(ctx, g.X(s.x), g.Y(s.y), g.X(s.x) - (a.g[0] / gn) * 26, g.Y(s.y) + (a.g[1] / gn) * 26, c.danger, 2);
      pointer(cv, g, s, (x, y) => { s.x = Math.round(x * 200) / 200; s.y = Math.round(y * 200) / 200; });
      const kind = st.grad > 1e-6 ? L('没收敛', 'not converged') : st.index === 0 ? L('极小点', 'minimum') : st.index === 1 ? L('一阶鞍点（过渡态）', 'first-order saddle (transition state)') : L('极大点', 'maximum');
      return [[L('起点的能量 V', 'Energy V at the start'), fix(a.v, 2)], [L('起点的 |∇V|', '|∇V| at the start'), fix(gn, 1)], [L('起点 Hessian 的本征值', 'Hessian eigenvalues at the start'), `${minus(fix(e[0], 0))}, ${minus(fix(e[1], 0))}`], [L('Newton 法落到', 'Newton lands on'), `${pname(st)} · ${kind}`, true], [L('那里的坐标和能量', 'Its coordinates and energy'), `(${minus(fix(st.x, 3))}, ${minus(fix(st.y, 3))}) · V = ${minus(fix(st.v, 2))}`], [L('那里 Hessian 的本征值', 'Hessian eigenvalues there'), `${minus(fix(st.eig[0], 0))}, ${minus(fix(st.eig[1], 0))}`]];
    },
  };

  // ── 2. Hammond、BEP、Marcus ─────────────────────────────────────
  DEMOS.hammond = {
    title: L('势垒与反应能：两条抛物线里的 Hammond、BEP 和 Marcus', 'Barriers and reaction energies: Hammond, BEP and Marcus in two parabolas'), kind: 'exact',
    intro: L('反应物（蓝）和产物（紫）各是一条同样弯的抛物线，交点就是过渡态（金点）。拖动反应自由能 ΔG°：反应越放热，交点越往左移、越像反应物（Hammond），势垒越低（BEP）；放热超过重组能 λ 以后，势垒反而又升高（Marcus 反转区）。第二张图把势垒画成 ΔG° 的函数，金色虚线是当前位置的切线，它的斜率就是 BEP 的 α。', 'Reactants (blue) and products (purple) are two parabolas of the same curvature, and their crossing is the transition state (gold dot). Drag the reaction free energy ΔG°: the more exothermic, the further left the crossing moves, the more reactant-like it is (Hammond), and the lower the barrier (BEP); once the exothermicity exceeds the reorganisation energy λ, the barrier rises again (the Marcus inverted region). The second plot shows the barrier as a function of ΔG°; the dashed gold line is the tangent at the current point, whose slope is the BEP α.'),
    ctl: [['lam', L('重组能 λ（kJ/mol）', 'Reorganisation energy λ (kJ/mol)'), 20, 300, 5, 100, (v) => String(v)], ['dg', L('反应自由能 ΔG°（kJ/mol）', 'Reaction free energy ΔG° (kJ/mol)'), -300, 100, 1, -20, (v) => minus(v)]],
    btn: [[L('热中性', 'Thermoneutral'), { dg: 0 }], [L('无势垒（ΔG° = −λ）', 'Barrierless (ΔG° = −λ)'), { dg: -100, lam: 100 }], [L('反转区', 'Inverted region'), { dg: -150, lam: 100 }]],
    figs: [[0.56, L('沿反应坐标 x 的两条自由能抛物线：V_R = λx²，V_P = λ(x − 1)² + ΔG°。', 'Two free-energy parabolas along the reaction coordinate x: V_R = λx², V_P = λ(x − 1)² + ΔG°.')], [0.46, L('势垒 ΔG‡ 随 ΔG° 的变化（Marcus 曲线），阴影是反转区 −ΔG° > λ。', 'The barrier ΔG‡ against ΔG° (the Marcus curve); the shaded band is the inverted region −ΔG° > λ.')]],
    note: L('两条抛物线的曲率相同时，交点和势垒都有解析式：x‡ = ½ + ΔG°/(2λ)，ΔG‡ = (λ + ΔG°)²/(4λ)。它是 Marcus 电子转移理论的骨架；用在原子转移反应上只是一个定性的模型，真实的势能面不是抛物线，BEP 的斜率要从一族反应里拟合。反转区里交点跑到了反应物抛物线的左边（x‡ < 0）。', 'With equal curvatures, the crossing and barrier have closed forms: x‡ = ½ + ΔG°/(2λ) and ΔG‡ = (λ + ΔG°)²/(4λ). This is the skeleton of Marcus electron-transfer theory; for atom-transfer reactions it is only a qualitative model, real surfaces are not parabolas, and the BEP slope has to be fitted within a family of reactions. In the inverted region the crossing moves to the left of the reactant parabola’s minimum (x‡ < 0).'),
    draw(s, [cv, bv], c) {
      const xs = lin(-0.8, 1.8, 300), xt = M.crossing(s.lam, s.dg), bar = M.marcusBarrier(s.lam, s.dg);
      const ymax = Math.max(80, bar * 1.6, s.lam * 0.6), ymin = Math.min(-10, s.dg - 20);
      plot(cv, { x: [-0.8, 1.8], y: [ymin, ymax], xl: L('反应坐标 x', 'reaction coordinate x'), yl: 'G / kJ mol⁻¹', series: [{ xs, ys: xs.map((x) => M.parabolas(s.lam, s.dg, x)[0]), color: c.info, width: 2.4, label: L('反应物', 'reactants') }, { xs, ys: xs.map((x) => M.parabolas(s.lam, s.dg, x)[1]), color: c.violet, width: 2.4, label: L('产物', 'products') }], marks: [{ x: xt, y: bar, color: c.gold }], hmarks: [{ y: 0, color: c.line }] });
      const gs = lin(-300, 100, 300);
      plot(bv, { x: [-300, 100], y: [0, Math.max(60, M.marcusBarrier(s.lam, 100) * 1.05)], xl: 'ΔG° / kJ mol⁻¹', yl: 'ΔG‡', bands: [{ x0: -300, x1: -s.lam, color: c.warn, alpha: 0.1 }], series: [{ xs: gs, ys: gs.map((g) => M.marcusBarrier(s.lam, g)), color: c.accent, width: 2.4 }, { xs: [s.dg - 80, s.dg + 80], ys: [bar - 80 * xt, bar + 80 * xt], color: c.gold, dash: [6, 4] }], marks: [{ x: s.dg, y: bar, color: c.gold }] });
      const region = s.dg > -s.lam ? L('正常区', 'normal region') : s.dg === -s.lam ? L('无势垒', 'barrierless') : L('反转区', 'inverted region');
      return [[L('势垒 ΔG‡', 'Barrier ΔG‡'), kj(bar, 2), true], [L('过渡态位置 x‡', 'Transition-state position x‡'), minus(fix(xt, 3))], [L('BEP 斜率 α = dΔG‡/dΔG°', 'BEP slope α = dΔG‡/dΔG°'), minus(fix(M.leffler(s.lam, s.dg), 3))], [L('Hammond', 'Hammond'), xt < 0.5 ? L('偏早，像反应物', 'early, reactant-like') : xt > 0.5 ? L('偏晚，像产物', 'late, product-like') : L('正中间', 'halfway')], [L('区域', 'Region'), region], [L('25 °C 下的 Eyring 速率', 'Eyring rate at 25 °C'), `${sci(M.eyring(bar, 298.15))} s⁻¹`]];
    },
  };

  // ── 3. NEB 和爬坡像 ─────────────────────────────────────────────
  const MA = M.MB_POINTS[0], MBp = M.MB_POINTS[1], S1 = M.MB_POINTS[3];
  const nebFresh = (n) => ({ st: { img: M.nebInit([MA.x, MA.y], [MBp.x, MBp.y], n) }, it: 0, f: null });
  DEMOS.neb = {
    title: L('微动弹性带：一串像落到最小能量路径上，爬坡像爬上鞍点', 'The nudged elastic band: a chain of images settles on the minimum energy path, and the climbing image climbs to the saddle'), kind: 'exact',
    intro: L('起点是从 MA 到 MB 的一条直线，穿过一片高能区。按“播放”让链一步步优化：真实力的垂直分量把它推进山谷，弹簧力让像沿路径保持等距。链大致收敛以后打开“爬坡像”：能量最高的那个像不再受弹簧拉，沿路径往上爬，最后停在鞍点 S1 上。读数里的“离 S1 的距离”会降到 10⁻⁴ 以下。', 'The start is a straight line from MA to MB, cutting through a high-energy region. Press Play to optimise the chain step by step: the perpendicular part of the true force pushes it into the valley and the springs keep the images evenly spaced along the path. Once the chain is roughly converged, switch on the climbing image: the highest image is freed from its springs, climbs along the path and comes to rest on saddle S1. The readout “distance to S1” drops below 10⁻⁴.'),
    sel: [['n', L('像的个数（含两端）', 'Images (including the ends)'), [['9', '9'], ['13', '13'], ['19', '19']], '13']],
    ctl: [['k', L('弹簧常数 k', 'Spring constant k'), 50, 1500, 50, 300, String]],
    chk: [['ci', L('爬坡像', 'Climbing image'), false]],
    act: [[L('重新开始', 'Restart'), (s) => { Object.assign(s, nebFresh(Number(s.n))); }], [L('直接跑 3000 步', 'Run 3000 steps at once'), (s) => { s.f = M.nebRun(s.st, 3000, { k: s.k, climb: s.ci }); s.it += 3000; }]],
    state: () => nebFresh(13), fps: 20,
    tick(s) { s.f = M.nebRun(s.st, 25, { k: s.k, climb: s.ci }); s.it += 25; return !(s.f.fmax < 1e-3 && s.it > 200); },
    changed(s, k) { if (k === 'n') Object.assign(s, nebFresh(Number(s.n))); },
    figs: [[0.82, L('Müller–Brown 势上的像（金色是能量最高的那个），灰线是从 S1 出发的 IRC，也就是真正的最小能量路径的一段。', 'Images on the Müller–Brown surface (gold marks the highest); the grey line is the IRC from S1, a stretch of the true minimum energy path.')], [0.42, L('各个像的能量（按编号），虚线是 S1 的能量。', 'Energy of each image (by index); the dashed line is the energy of S1.')]],
    note: L('切线用 Henkelman 和 Jónsson 2000 年的“改进的切线”；优化器是 quick-min（速度只保留沿力的分量），时间步 0.002，每步最多移动 0.02。爬坡像在所有像里能量最高的那个上，过程中可能换人。直线起点会让链先穿过 MC 附近，所以收敛后的路径经过中间体 MC，最高点在 S1；S2 两侧的像也会落到路径上，但不是最高点。这里没有质量加权，单位随意。', 'Tangents use the “improved tangent” of Henkelman and Jónsson 2000; the optimiser is quick-min (velocities keep only their component along the force) with time step 0.002 and at most 0.02 per move. The climbing image is whichever image is currently highest, which can change along the way. Starting from a straight line takes the chain past MC, so the converged path runs through the intermediate MC with its highest point at S1; images either side of S2 also settle onto the path, but S2 is not the highest point. No mass-weighting; arbitrary units.'),
    draw(s, [cv, ev], c) {
      const g = surface(cv, c), { ctx } = g;
      if (!s.irc) s.irc = M.irc(M.stationary(S1.x, S1.y));
      ctx.strokeStyle = c.ink2; ctx.globalAlpha = 0.6; ctx.lineWidth = 1.6; ctx.setLineDash([4, 3]); ctx.beginPath(); s.irc.forEach((p, i) => (i ? ctx.lineTo(g.X(p.x), g.Y(p.y)) : ctx.moveTo(g.X(p.x), g.Y(p.y)))); ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      markPoints(g, c);
      const img = s.st.img, f = s.f || M.nebForces(img, { k: s.k, climb: s.ci });
      ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.beginPath(); img.forEach((p, i) => (i ? ctx.lineTo(g.X(p[0]), g.Y(p[1])) : ctx.moveTo(g.X(p[0]), g.Y(p[1])))); ctx.stroke();
      img.forEach((p, i) => { ctx.fillStyle = i === f.top ? c.gold : i === 0 || i === img.length - 1 ? c.ink : c.paper; ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(g.X(p[0]), g.Y(p[1]), i === f.top ? 6 : 4.2, 0, 2 * Math.PI); ctx.fill(); ctx.stroke(); });
      const idx = img.map((_, i) => i);
      plot(ev, { x: [0, img.length - 1], y: [-160, Math.max(0, Math.min(400, Math.max(...f.E) + 20))], xl: L('像的编号', 'image index'), yl: 'V', xt: idx.filter((i) => img.length < 15 || i % 2 === 0), series: [{ xs: idx, ys: f.E, color: c.accent, width: 2.2, dots: 3.5, line: true }], hmarks: [{ y: S1.v, color: c.gold }], marks: [{ x: f.top, y: f.E[f.top], color: c.gold }] });
      const top = img[f.top], d = Math.hypot(top[0] - S1.x - 0.0000, top[1] - S1.y);
      const exact = M.stationary(S1.x, S1.y), dd = Math.hypot(top[0] - exact.x, top[1] - exact.y);
      void d;
      return [[L('已经走了', 'Steps so far'), String(s.it)], [L('最大的垂直力', 'Largest perpendicular force'), fmt(f.fmax, 3)], [L('最高的像', 'Highest image'), `#${f.top} · (${minus(fix(top[0], 4))}, ${minus(fix(top[1], 4))})`], [L('它的能量（S1 是 −40.665）', 'Its energy (S1 is −40.665)'), minus(fix(f.E[f.top], 3)), true], [L('离 S1 的距离', 'Distance to S1'), fmt(dd, 3)], [L('爬坡像', 'Climbing image'), s.ci ? L('开', 'on') : L('关（最高的像只是近似）', 'off (the highest image is only approximate)')]];
    },
  };

  // ── 4. IRC ──────────────────────────────────────────────────────
  DEMOS.irc = {
    title: L('IRC：从鞍点往两边下山，看它连着哪两个极小', 'IRC: walk downhill both ways from a saddle and see which minima it connects'), kind: 'exact',
    intro: L('选一个鞍点。程序先在那里算 Hessian，沿负本征值的本征向量（虚频的方向）往两边各推一小步，然后沿最速下降一直走到极小。第一张图是路径，第二张图是沿路径的能量，横轴是从鞍点量起的弧长 s。读数给出两边分别落到哪个极小、正向和逆向的势垒。', 'Pick a saddle. The program computes the Hessian there, pushes a small step each way along the eigenvector of the negative eigenvalue (the imaginary mode) and then follows steepest descent all the way to a minimum. The first plot is the path, the bottom one the energy along it against the arc length s measured from the saddle. The readouts give which minimum each side reaches and the forward and reverse barriers.'),
    sel: [['ts', L('鞍点', 'Saddle'), [['S1', 'S1'], ['S2', 'S2']], 'S1']],
    ctl: [['push', L('第一步推多远', 'Size of the first push'), 0.002, 0.05, 0.001, 0.01, (v) => v.toFixed(3)]],
    figs: [[0.82, L('IRC 路径（金色）；菱形是出发的鞍点。', 'The IRC path (gold); the diamond is the starting saddle.')], [0.42, L('沿 IRC 的能量剖面 V(s)。', 'The energy profile V(s) along the IRC.')]],
    note: L('这里的质量都取 1，所以 IRC 就是普通坐标里的最速下降路径；真实分子要先换成质量加权坐标。积分用 RK4，每步弧长 0.004，到梯度小于 0.5 或者能量开始上升时停。第一步推多远基本不影响结果，只要它比路径的弯曲尺度小。', 'All masses are 1 here, so the IRC is the steepest-descent path in ordinary coordinates; for real molecules one first changes to mass-weighted coordinates. Integration is RK4 with arc-length steps of 0.004, stopping when the gradient falls below 0.5 or the energy starts to rise. The size of the first push hardly matters as long as it is small compared with the path’s curvature.'),
    draw(s, [cv, ev], c) {
      const p0 = M.MB_POINTS.find((p) => p.id === s.ts), ts = M.stationary(p0.x, p0.y), path = M.irc(ts, s.push);
      const g = surface(cv, c), { ctx } = g;
      ctx.strokeStyle = c.gold; ctx.lineWidth = 3; ctx.beginPath(); path.forEach((p, i) => (i ? ctx.lineTo(g.X(p.x), g.Y(p.y)) : ctx.moveTo(g.X(p.x), g.Y(p.y)))); ctx.stroke();
      markPoints(g, c);
      const a = path[0], b = path[path.length - 1], ea = M.stationary(a.x, a.y), eb = M.stationary(b.x, b.y);
      plot(ev, { x: [a.s, b.s], y: [Math.min(a.v, b.v) - 10, ts.v + 15], xl: L('弧长 s', 'arc length s'), yl: 'V', series: [{ xs: path.map((p) => p.s), ys: path.map((p) => p.v), color: c.accent, width: 2.4 }], marks: [{ x: 0, y: ts.v, color: c.gold }], hmarks: [{ y: ts.v, color: c.gold }] });
      const ev2 = M.eig2(M.mbAll(ts.x, ts.y).h).vals;
      return [[L('鞍点', 'Saddle'), `${s.ts} · V = ${minus(fix(ts.v, 3))}`], [L('Hessian 的本征值', 'Hessian eigenvalues'), `${minus(fix(ev2[0], 1))}, ${minus(fix(ev2[1], 1))}`], [L('一侧落到', 'One side ends at'), `${pname(ea)} (V = ${minus(fix(ea.v, 2))})`, true], [L('另一侧落到', 'The other ends at'), `${pname(eb)} (V = ${minus(fix(eb.v, 2))})`, true], [L('两侧的势垒', 'Barriers from each side'), `${fix(ts.v - ea.v, 2)} / ${fix(ts.v - eb.v, 2)}`], [L('路径总长', 'Total path length'), fix(b.s - a.s, 3)]];
    },
  };

  // ── 5. Eyring 公式 ──────────────────────────────────────────────
  DEMOS.eyring = {
    title: L('Eyring 公式：势垒、温度和半衰期', 'The Eyring equation: barrier, temperature and half-life'), kind: 'exact',
    intro: L('调活化焓 ΔH‡、活化熵 ΔS‡ 和温度，看一级反应的速率常数和半衰期。第一张图是 25 °C 下 log₁₀k 和 ΔG‡ 的直线关系：每 5.71 kJ/mol 一个数量级，灰色的横带标出“一秒到一天”这段实验室最常见的时间尺度。第二张图是当前这组活化参数下速率常数随温度的变化。', 'Adjust the activation enthalpy ΔH‡, the activation entropy ΔS‡ and the temperature to see the first-order rate constant and half-life. The first plot is the straight line of log₁₀k against ΔG‡ at 25 °C, one decade per 5.71 kJ/mol; the grey band marks “a second to a day”, the most common laboratory timescales. The second plot shows how the rate constant changes with temperature for the current activation parameters.'),
    ctl: [['dh', L('活化焓 ΔH‡（kJ/mol）', 'Activation enthalpy ΔH‡ (kJ/mol)'), 10, 180, 1, 80, String], ['ds', L('活化熵 ΔS‡（J mol⁻¹ K⁻¹）', 'Activation entropy ΔS‡ (J mol⁻¹ K⁻¹)'), -150, 100, 1, -20, (v) => minus(v)], ['t', L('温度 T（K）', 'Temperature T (K)'), 150, 800, 1, 298, String]],
    chk: [['tun', L('乘一个透射系数 κ = 0.5（回头）', 'Multiply by a transmission coefficient κ = 0.5 (recrossing)'), false]],
    btn: [[L('一秒一次（25 °C）', 'Once a second (25 °C)'), { dh: 73.9, ds: 0, t: 298 }], [L('半衰期一小时', 'One-hour half-life'), { dh: 94.2, ds: 0, t: 298 }], [L('例题', 'Worked example'), { dh: 79.4, ds: -49.3, t: 298 }]],
    figs: [[0.5, L('25 °C 下 log₁₀k 随 ΔG‡ 的变化（κ = 1）；金点是当前的 ΔG‡（按 25 °C 算）。', 'log₁₀k against ΔG‡ at 25 °C (κ = 1); the gold dot is the current ΔG‡ (evaluated at 25 °C).')], [0.46, L('当前活化参数下 log₁₀k 随温度的变化。', 'log₁₀k against temperature for the current activation parameters.')]],
    note: L('一级反应，k = κ (k_BT/h) exp(ΔS‡/R) exp(−ΔH‡/RT)，假设 ΔH‡ 和 ΔS‡ 不随温度变（实际上会因活化热容而略变）。双分子反应的 k 要带上浓度的单位，ΔG‡ 也要注明标准态。Arrhenius 参数按单分子的换算 Ea = ΔH‡ + RT、A = e (k_BT/h) e^{ΔS‡/R}。', 'First order, k = κ (k_BT/h) exp(ΔS‡/R) exp(−ΔH‡/RT), assuming ΔH‡ and ΔS‡ are independent of temperature (in reality they drift slightly through the heat capacity of activation). For bimolecular reactions k carries concentration units and ΔG‡ needs a stated standard state. Arrhenius parameters use the unimolecular conversion Ea = ΔH‡ + RT, A = e (k_BT/h) e^{ΔS‡/R}.'),
    draw(s, [cv, tv], c) {
      const kap = s.tun ? 0.5 : 1, dG = s.dh - (s.t * s.ds) / 1000, k = M.eyringHS(s.dh, s.ds, s.t, kap), g25 = s.dh - (298.15 * s.ds) / 1000;
      const gs = lin(20, 160, 200);
      plot(cv, { x: [20, 160], y: [-16, 13], xl: 'ΔG‡ / kJ mol⁻¹ (25 °C)', yl: 'log₁₀ (k / s⁻¹)', hbands: [{ y0: Math.log10(Math.LN2 / 86400), y1: Math.log10(Math.LN2), color: c.muted, alpha: 0.13 }], series: [{ xs: gs, ys: gs.map((g) => Math.log10(M.eyring(g, 298.15))), color: c.accent, width: 2.4 }], marks: [{ x: Math.min(160, Math.max(20, g25)), y: Math.log10(M.eyring(g25, 298.15)), color: c.gold }] });
      const ts = lin(150, 800, 200);
      plot(tv, { x: [150, 800], y: [-16, 13], xl: 'T / K', yl: 'log₁₀ (k / s⁻¹)', series: [{ xs: ts, ys: ts.map((T) => Math.log10(M.eyringHS(s.dh, s.ds, T, kap))), color: c.violet, width: 2.4 }], marks: [{ x: s.t, y: Math.log10(k), color: c.gold }] });
      const ar = M.arrheniusOf(s.dh, s.ds, s.t);
      return [[L('ΔG‡（当前温度）', 'ΔG‡ (current temperature)'), kj(dG, 2)], [L('k_BT/h', 'k_BT/h'), `${sci(M.kTh(s.t))} s⁻¹`], [L('速率常数 k', 'Rate constant k'), `${sci(k)} s⁻¹`, true], [L('半衰期 ln2 / k', 'Half-life ln2 / k'), human(M.halfLife(k)), true], [L('Arrhenius：Ea、A', 'Arrhenius: Ea, A'), `${fix(ar.Ea, 1)} kJ/mol · ${sci(ar.A * kap)} s⁻¹`], [L('温度升高 10 K，k 变成', 'Raise T by 10 K and k becomes'), `× ${fix(M.eyringHS(s.dh, s.ds, s.t + 10, kap) / k, 2)}`]];
    },
  };

  // ── 6. Eyring 图和误差 ──────────────────────────────────────────
  DEMOS.plot = {
    title: L('Eyring 图：从变温数据拟合活化参数，看 ΔS‡ 的误差有多大', 'The Eyring plot: fit activation parameters to variable-temperature data and see how uncertain ΔS‡ is'), kind: 'toy',
    intro: L('程序按你设的“真值” ΔH‡、ΔS‡ 生成几组带噪声的速率常数（像真实的实验一样，每个 ln k 有几个百分点的误差），然后做 Eyring 图的最小二乘拟合。第二张图是同样条件下重做 60 次“实验”得到的 (ΔH‡, ΔS‡)：它们排成一条斜线，这就是假的“焓–熵补偿”。把温度范围拉宽，斜线会变短。', 'The program generates a few noisy rate constants from your “true” ΔH‡ and ΔS‡ (like a real experiment, each ln k carries a few per cent of error) and fits the Eyring plot by least squares. The second plot shows the (ΔH‡, ΔS‡) obtained by repeating the “experiment” 60 times under the same conditions: they line up along a slope, which is the spurious “enthalpy–entropy compensation”. Widen the temperature range and the line shortens.'),
    ctl: [['dh', L('真值 ΔH‡（kJ/mol）', 'True ΔH‡ (kJ/mol)'), 40, 140, 1, 80, String], ['ds', L('真值 ΔS‡（J mol⁻¹ K⁻¹）', 'True ΔS‡ (J mol⁻¹ K⁻¹)'), -120, 60, 1, -20, (v) => minus(v)], ['t0', L('最低温度（K）', 'Lowest temperature (K)'), 260, 360, 1, 290, String], ['span', L('温度范围（K）', 'Temperature range (K)'), 10, 120, 1, 40, String], ['n', L('温度点数', 'Number of temperatures'), 3, 12, 1, 6, String], ['noise', L('ln k 的误差（%）', 'Error in ln k (%)'), 0, 20, 0.5, 5, (v) => `${v} %`], ['seed', L('随机种子', 'Random seed'), 1, 50, 1, 7, String]],
    figs: [[0.52, L('Eyring 图：ln(k/T) 对 1000/T，点是“测量”，线是最小二乘拟合。', 'Eyring plot: ln(k/T) against 1000/T; points are “measurements”, the line is the least-squares fit.')], [0.48, L('重做 60 次实验拟合出的 (ΔH‡, ΔS‡)；金色十字是真值。', '(ΔH‡, ΔS‡) fitted from 60 repeated experiments; the gold cross is the true value.')]],
    note: L('这是合成的数据，不是真实的测量。噪声加在 ln k 上（相对误差），温度点等间距。拟合的标准误按普通最小二乘的公式算；ΔH‡ 和 ΔS‡ 估计值的相关系数接近 +1（读数里给出），是因为截距要外推到 1/T = 0。“温度范围”越窄，外推越远，相关越强。', 'Synthetic data, not real measurements. Noise is added to ln k (a relative error) and the temperatures are evenly spaced. Standard errors follow the ordinary least-squares formulas; the correlation between the ΔH‡ and ΔS‡ estimates is close to +1 (given in the readouts) because the intercept must be extrapolated to 1/T = 0. The narrower the temperature range, the longer the extrapolation and the stronger the correlation.'),
    draw(s, [cv, sv], c) {
      const d = M.fakeKinetics(s.dh, s.ds, s.t0, s.t0 + s.span, s.n, s.noise / 100, s.seed), f = M.eyringFit(d.Ts, d.ks), ar = M.arrheniusFit(d.Ts, d.ks);
      const xs = d.Ts.map((T) => 1000 / T), ys = d.ks.map((k, i) => Math.log(k / d.Ts[i])), xa = Math.min(...xs), xb = Math.max(...xs), pad = (xb - xa) * 0.12 + 0.01;
      const line = (x) => f.fit.a + f.fit.b * (x / 1000);
      const ylo = Math.min(...ys, line(xb + pad)) - 0.5, yhi = Math.max(...ys, line(xa - pad)) + 0.5;
      plot(cv, { x: [xa - pad, xb + pad], y: [ylo, yhi], xl: '1000 / T (K⁻¹)', yl: 'ln(k/T)', series: [{ xs: [xa - pad, xb + pad], ys: [line(xa - pad), line(xb + pad)], color: c.accent, width: 2 }, { xs, ys, color: c.gold, dots: 4.5 }] });
      const pts = [];
      for (let i = 0; i < 60; i++) { const e = M.fakeKinetics(s.dh, s.ds, s.t0, s.t0 + s.span, s.n, s.noise / 100, 1000 + s.seed * 97 + i), g = M.eyringFit(e.Ts, e.ks); pts.push([g.dH, g.dS]); }
      const hs = pts.map((p) => p[0]), ss = pts.map((p) => p[1]), hw = Math.max(4, ...hs.map((h) => Math.abs(h - s.dh))) * 1.15, sw = Math.max(12, ...ss.map((v) => Math.abs(v - s.ds))) * 1.15;
      plot(sv, { x: [s.dh - hw, s.dh + hw], y: [s.ds - sw, s.ds + sw], xl: 'ΔH‡ / kJ mol⁻¹', yl: 'ΔS‡ / J mol⁻¹ K⁻¹', series: [{ pts, color: c.violet, dots: 3 }], after: ({ ctx, X, Y }) => { ctx.strokeStyle = c.gold; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.moveTo(X(s.dh) - 8, Y(s.ds)); ctx.lineTo(X(s.dh) + 8, Y(s.ds)); ctx.moveTo(X(s.dh), Y(s.ds) - 8); ctx.lineTo(X(s.dh), Y(s.ds) + 8); ctx.stroke(); } });
      return [[L('拟合的 ΔH‡', 'Fitted ΔH‡'), `${fix(f.dH, 1)} ± ${fix(f.sH, 1)} kJ/mol`, true], [L('拟合的 ΔS‡', 'Fitted ΔS‡'), `${minus(fix(f.dS, 1))} ± ${fix(f.sS, 1)} J mol⁻¹ K⁻¹`, true], [L('两者估计值的相关系数', 'Correlation of the two estimates'), Number.isFinite(f.corr) ? minus(fix(f.corr, 4)) : '—'], [L('外推距离（1/T 到 0）÷ 数据范围', 'Extrapolation (1/T to 0) ÷ data range'), `${fix(Math.min(...xs) / (xb - xa), 0)} ×`], [L('Arrhenius 拟合的 Ea', 'Arrhenius Ea'), kj(ar.Ea, 1)], [L('Ea − ΔH‡（应约为 RT̄）', 'Ea − ΔH‡ (should be ≈ RT̄)'), kj(ar.Ea - f.dH, 2)]];
    },
  };

  // ── 7. RRKM 的 k(E) ─────────────────────────────────────────────
  const tsSets = { tight: M.TOY.tsFreqs, loose: M.TOY.tsFreqs.map((f) => (f < 1200 ? f * 0.55 : f)) };
  let RRKM = null;
  const rrkmFor = (E0, kind) => { const key = `${E0}|${kind}`; if (!RRKM || RRKM.key !== key) RRKM = { key, r: M.rrkm({ freqs: M.TOY.freqs, tsFreqs: tsSets[kind], E0, emax: 80000, grain: 10 }) }; return RRKM.r; };
  DEMOS.rrkm = {
    title: L('RRKM：数状态，得到能量为 E 的分子的分解速率', 'RRKM: count states to get the decay rate of molecules with energy E'), kind: 'toy',
    intro: L('一个有 9 个振动模式的“玩具分子”和它的过渡态（少一个模式，几个模式变软）。第一张图是反应物的态密度 ρ(E) 和过渡态的状态总数 N‡(E − E₀)，都用 Beyer–Swinehart 算法当场数出来（对数坐标）。第二张图是 RRKM 的 k(E) = N‡/(hρ) 和经典 RRK 的对比。选“松的过渡态”，几个低频模式更软，N‡ 更大，k(E) 整体上升：熵对微正则速率的作用。', 'A “toy molecule” with 9 vibrational modes and its transition state (one mode fewer, several modes softer). The first plot shows the reactant density of states ρ(E) and the transition state’s total number of states N‡(E − E₀), both counted live with the Beyer–Swinehart algorithm (log scale). The second plot compares RRKM’s k(E) = N‡/(hρ) with classical RRK. Choose the “loose transition state” and the low-frequency modes soften, N‡ grows and k(E) rises throughout: entropy at work in the microcanonical rate.'),
    sel: [['ts', L('过渡态', 'Transition state'), [['tight', L('紧的（只有反应坐标那个模式消失）', 'Tight (only the reaction-coordinate mode is gone)')], ['loose', L('松的（低频模式再软 45 %）', 'Loose (low-frequency modes 45 % softer)')]], 'tight']],
    ctl: [['e0', L('阈能 E₀（cm⁻¹）', 'Threshold E₀ (cm⁻¹)'), 8000, 40000, 500, 20000, (v) => `${v} (${fix(v * M.KJ_PER_CM, 0)} kJ/mol)`], ['probe', L('看哪个能量（E − E₀，cm⁻¹）', 'Energy to read (E − E₀, cm⁻¹)'), 100, 30000, 100, 5000, String]],
    figs: [[0.46, L('log₁₀ 状态数：反应物的态密度 ρ(E)（每 cm⁻¹）和过渡态的累积状态数 N‡(E − E₀)。', 'log₁₀ of state counts: the reactant density of states ρ(E) (per cm⁻¹) and the transition state’s cumulative count N‡(E − E₀).')], [0.46, L('log₁₀ k(E)：RRKM（实线）和经典 RRK（虚线）。', 'log₁₀ k(E): RRKM (solid) and classical RRK (dashed).')]],
    note: L('玩具分子的频率（cm⁻¹）：3000、2950、1500、1450、1200、1000、900、600、400；紧的过渡态去掉 1000 cm⁻¹ 那个（变成反应坐标），其余变成 3000、2950、1450、1400、1100、800、500、300。这不是任何真实分子的数据。能量分格 10 cm⁻¹，态密度做 250 cm⁻¹ 的滑动平均（否则频率的公约数会让一半的格子是空的），反应路径简并度 σ = 1，没有转动。经典 RRK 用 k = c (Πν/Πν‡)((E − E₀)/E)^(s−1)，能量从零点能算起。', 'Toy-molecule frequencies (cm⁻¹): 3000, 2950, 1500, 1450, 1200, 1000, 900, 600, 400; the tight transition state removes the 1000 cm⁻¹ mode (it becomes the reaction coordinate) and has 3000, 2950, 1450, 1400, 1100, 800, 500, 300. Not data for any real molecule. Energy bins are 10 cm⁻¹, the density of states is smoothed over 250 cm⁻¹ (otherwise the frequencies’ common divisor leaves half the bins empty), the path degeneracy is σ = 1 and rotations are ignored. Classical RRK uses k = c (Πν/Πν‡)((E − E₀)/E)^(s−1) with energies measured from the zero-point level.'),
    draw(s, [dv, kv], c) {
      const r = rrkmFor(s.e0, s.ts), g = r.grain, E = r.E, j0 = Math.round(s.e0 / g), step = 20;
      const xs = [], lr = [], ln = [], lk = [], lc = [];
      for (let j = 1; j < E.length; j += step) { xs.push(E[j]); lr.push(Math.log10(r.rho[j] / g)); ln.push(j >= j0 ? Math.log10(r.Nts[j - j0]) : NaN); lk.push(r.k[j] > 0 ? Math.log10(r.k[j]) : NaN); const kc = M.rrkClassical(M.TOY.freqs, tsSets[s.ts], s.e0, E[j]); lc.push(kc > 0 ? Math.log10(kc) : NaN); }
      plot(dv, { x: [0, 80000], y: [-4, 16], xl: 'E / cm⁻¹', yl: 'log₁₀', series: [{ xs, ys: lr, color: c.accent, width: 2.2, label: 'ρ(E)' }, { xs, ys: ln, color: c.violet, width: 2.2, label: 'N‡(E − E₀)' }], marks: [{ x: s.e0, color: c.gold }] });
      const ep = Math.min(80000 - g, s.e0 + s.probe), jp = Math.round(ep / g), kp = r.k[jp], kcp = M.rrkClassical(M.TOY.freqs, tsSets[s.ts], s.e0, ep);
      plot(kv, { x: [0, 80000], y: [0, 14], xl: 'E / cm⁻¹', yl: 'log₁₀ (k / s⁻¹)', series: [{ xs, ys: lk, color: c.accent, width: 2.4, label: 'RRKM' }, { xs, ys: lc, color: c.warn, width: 2, dash: [6, 4], label: L('经典 RRK', 'classical RRK') }], marks: [{ x: ep, y: kp > 0 ? Math.log10(kp) : undefined, color: c.gold }] });
      return [[L('E', 'E'), `${ep} cm⁻¹ = ${fix(ep * M.KJ_PER_CM, 0)} kJ/mol`], [L('反应物态密度 ρ(E)', 'Reactant density ρ(E)'), `${sci(r.rho[jp] / g)} / cm⁻¹`], [L('过渡态状态数 N‡', 'Transition-state count N‡'), sci(r.Nts[jp - j0])], [L('RRKM k(E)', 'RRKM k(E)'), `${sci(kp)} s⁻¹`, true], [L('寿命 1/k', 'Lifetime 1/k'), human(1 / kp)], [L('经典 RRK / RRKM', 'Classical RRK / RRKM'), fmt(kcp / kp, 3)]];
    },
  };

  // ── 8. 下降曲线 ─────────────────────────────────────────────────
  DEMOS.falloff = {
    title: L('压力下降曲线：强碰撞 RRKM 比 Lindemann 宽多少', 'Fall-off curves: how much broader strong-collision RRKM is than Lindemann'), kind: 'toy',
    intro: L('同一个玩具分子（E₀ = 20 000 cm⁻¹），在不同压力下的热速率常数。高压一端两条线都趋于 k∞（等于第三章的谐振子过渡态理论），低压一端都趋于 k₀[M]。中间，用同样两个极限的 Lindemann 式（虚线）比把 k(E) 对能量分布平均的强碰撞 RRKM（实线）陡得多：真实的下降曲线更宽，就是因为 k(E) 不是一个常数。“碰撞效率”β 小于 1 是粗略地模拟弱碰撞。', 'The thermal rate constant of the same toy molecule (E₀ = 20 000 cm⁻¹) at different pressures. At the high-pressure end both lines tend to k∞ (equal to the harmonic transition state theory of chapter 3); at the low-pressure end both tend to k₀[M]. In between, the Lindemann form with the same two limits (dashed) is much steeper than strong-collision RRKM (solid), which averages k(E) over the energy distribution: real fall-off curves are broader precisely because k(E) is not a constant. A “collision efficiency” β below 1 crudely mimics weak collisions.'),
    ctl: [['t', L('温度 T（K）', 'Temperature T (K)'), 600, 1600, 10, 1000, String], ['beta', L('碰撞效率 β', 'Collision efficiency β'), 0.05, 1, 0.05, 1, (v) => v.toFixed(2)]],
    figs: [[0.56, L('log₁₀ k_uni 对 log₁₀ p（Pa）。实线：强碰撞 RRKM；虚线：Lindemann；点线：k∞ 和 k₀[M] 两个极限。', 'log₁₀ k_uni against log₁₀ p (Pa). Solid: strong-collision RRKM; dashed: Lindemann; dotted: the k∞ and k₀[M] limits.')]],
    note: L('碰撞频率 ω = β k_c [M]，k_c = 2 × 10⁻¹⁰ cm³ s⁻¹（气体动理学的量级），[M] = p/(k_BT)。强碰撞：每次碰撞直接回到玻尔兹曼分布。真实碰撞一次只转移几百到几千 cm⁻¹，用 β 缩放 ω 只是最粗的办法；准确的做法是主方程。玩具分子同 RRKM 演示，不是真实分子。', 'Collision frequency ω = β k_c [M] with k_c = 2 × 10⁻¹⁰ cm³ s⁻¹ (gas-kinetic order of magnitude) and [M] = p/(k_BT). Strong collisions return the molecule straight to the Boltzmann distribution. Real collisions transfer only a few hundred to a few thousand cm⁻¹, and scaling ω by β is the crudest fix; the proper treatment is a master equation. The toy molecule is the same as in the RRKM demo, not a real molecule.'),
    draw(s, [cv], c) {
      const r = rrkmFor(20000, 'tight'), lps = lin(-1, 9, 41), ks = [], kl = [];
      let kinf = 0, k0p = 0;
      for (const lp of lps) { const om = M.collisionRate(10 ** lp, s.t, s.beta), f = M.falloff(r, s.t, om); kinf = f.kinf; if (lp === lps[0]) k0p = f.k0 / 10 ** lp; ks.push(Math.log10(f.k)); kl.push(Math.log10(M.lindemann(f.kinf, f.k0))); }
      const lk = Math.log10(kinf), half = Math.log10(kinf / k0p), tst = M.tstHarmonic(M.TOY, s.t);
      const fH = M.falloff(r, s.t, M.collisionRate(10 ** half, s.t, s.beta));
      plot(cv, { x: [-1, 9], y: [lk - 10, lk + 1], xl: 'log₁₀ (p / Pa)', yl: 'log₁₀ (k / s⁻¹)', series: [{ xs: lps, ys: ks, color: c.accent, width: 2.6, label: L('强碰撞 RRKM', 'strong-collision RRKM') }, { xs: lps, ys: kl, color: c.warn, width: 2, dash: [6, 4], label: 'Lindemann' }, { xs: lps, ys: lps.map(() => lk), color: c.muted, dash: [2, 3], width: 1.4 }, { xs: lps, ys: lps.map((lp) => Math.log10(k0p) + lp), color: c.muted, dash: [2, 3], width: 1.4 }], marks: [{ x: half, color: c.gold }, { x: 5.0057, color: c.line }], texts: [{ x: 5.0057, y: lk + 0.6, s: '1 atm', color: c.muted, dx: 4 }] });
      return [[L('高压极限 k∞（RRKM 平均）', 'High-pressure limit k∞ (RRKM average)'), `${sci(kinf)} s⁻¹`], [L('谐振子 TST（第三章）', 'Harmonic TST (chapter 3)'), `${sci(tst)} s⁻¹`], [L('低压极限 k₀[M] / p', 'Low-pressure limit k₀[M] / p'), `${sci(k0p)} s⁻¹ Pa⁻¹`], [L('转折压力 p½（k₀[M] = k∞）', 'Centre pressure p½ (k₀[M] = k∞)'), `${sci(10 ** half)} Pa`], [L('在 p½ 处 k / k∞', 'k / k∞ at p½'), `${fix(fH.k / kinf, 3)}（Lindemann 0.5）`, true], [L('1 atm 下 k / k∞', 'k / k∞ at 1 atm'), fix(M.falloff(r, s.t, M.collisionRate(101325, s.t, s.beta)).k / kinf, 3)]];
    },
  };

  // ── 9. Eckart 隧穿 ──────────────────────────────────────────────
  DEMOS.eckart = {
    title: L('隧穿：Eckart 势垒的透射概率和热平均的 κ(T)', 'Tunnelling: transmission through an Eckart barrier and the thermal κ(T)'), kind: 'exact',
    intro: L('第一张图是透射概率 P(E)：经典的是一个台阶（能量够了才过去），量子的 Eckart 曲线在势垒以下就开始上升、在势垒以上还没到 1。白点是直接数值求解 Schrödinger 方程得到的，和解析公式重合。第二张图把 P(E) 对玻尔兹曼分布积分得到 κ(T)，并和 Wigner、Bell 两个近似比：高温时三者一致，低于交叉温度 T_c 以后 Wigner 太小、Bell 发散。', 'The first plot is the transmission probability P(E): classically a step (through only with enough energy), while the quantum Eckart curve starts rising below the barrier and has not reached 1 above it. White dots come from solving the Schrödinger equation numerically and sit on the analytic formula. The second plot integrates P(E) over the Boltzmann distribution to get κ(T) and compares it with the Wigner and Bell approximations: all three agree at high temperature, while below the crossover temperature T_c Wigner is too small and Bell diverges.'),
    ctl: [['v1', L('势垒（从反应物一侧）V₁（kJ/mol）', 'Barrier from the reactant side V₁ (kJ/mol)'), 5, 120, 1, 40, String], ['v2', L('势垒（从产物一侧）V₂（kJ/mol）', 'Barrier from the product side V₂ (kJ/mol)'), 5, 160, 1, 60, String], ['nu', L('虚频 ν‡（cm⁻¹）', 'Imaginary frequency ν‡ (cm⁻¹)'), 200, 2500, 10, 1500, (v) => `${v}i`], ['t', L('温度 T（K）', 'Temperature T (K)'), 100, 800, 5, 300, String]],
    chk: [['num', L('数值解 Schrödinger 方程核对', 'Check with a numerical Schrödinger solution'), true]],
    btn: [[L('例题：1500i，300 K', 'Worked example: 1500i, 300 K'), { nu: 1500, t: 300 }], [L('重原子：300i', 'Heavy atom: 300i'), { nu: 300, t: 300 }], [L('低温：150 K', 'Low temperature: 150 K'), { t: 150 }]],
    figs: [[0.5, L('透射概率 P(E)，横轴是 E / V₁。实线：Eckart；虚线：经典台阶；白点：数值解。', 'Transmission probability P(E) against E / V₁. Solid: Eckart; dashed: classical step; white dots: numerical solution.')], [0.5, L('log₁₀ κ(T)：Eckart（实线）、Wigner（虚线）、Bell（点线）；竖线是 T_c 和当前温度。', 'log₁₀ κ(T): Eckart (solid), Wigner (dashed), Bell (dotted); vertical lines mark T_c and the current temperature.')]],
    note: L('一维 Eckart 势 V(x) = A y/(1+y) + B y/(1+y)²，y = e^{x/L}；A、B 由 V₁、V₂ 定，宽度 L 由势垒顶的曲率等于 −mω‡² 定（ħω‡ = hcν‡）。透射概率用 Eckart 1930 年的解析式；数值核对是从右往左用 RK4 积分 Schrödinger 方程（两万步），读出入射波的振幅。κ(T) = βe^{βV₁}∫P(E)e^{−βE}dE。只有一个维度：没有“切角”，也没有零点能沿路径的变化，所以只是一个修正因子的估计。', 'One-dimensional Eckart potential V(x) = A y/(1+y) + B y/(1+y)², y = e^{x/L}; A and B follow from V₁ and V₂, and the width L from requiring the barrier-top curvature to be −mω‡² (ħω‡ = hcν‡). The transmission probability is Eckart’s 1930 closed form; the numerical check integrates the Schrödinger equation from right to left with RK4 (twenty thousand steps) and reads off the incoming amplitude. κ(T) = βe^{βV₁}∫P(E)e^{−βE}dE. One dimension only: no corner cutting and no change of zero-point energy along the path, so this is an estimate of the correction factor.'),
    draw(s, [pv, kv], c) {
      const unit = s.nu * M.KJ_PER_CM, V1 = s.v1 / unit, V2 = s.v2 / unit, ek = M.eckart(V1, V2), u = M.uOf(s.nu, s.t), Tc = (M.HCK * s.nu) / (2 * Math.PI);
      const es = lin(0.02, 2, 240);
      const pts = [];
      if (s.num) for (const e of [0.6, 0.8, 0.9, 1, 1.1, 1.3]) { const E = e * V1; if (E > Math.max(0, ek.A)) pts.push([e, M.transmitNumeric(ek.V, E, ek.A, -30 * ek.L - 6, 30 * ek.L + 6, 12000)]); }
      plot(pv, { x: [0, 2], y: [0, 1.05], xl: 'E / V₁', yl: 'P(E)', series: [{ xs: [0, 1, 1, 2], ys: [0, 0, 1, 1], color: c.muted, dash: [5, 4], width: 1.6, label: L('经典', 'classical') }, { xs: es, ys: es.map((e) => ek.P(e * V1)), color: c.accent, width: 2.6, label: 'Eckart' }, ...(pts.length ? [{ pts, color: c.paper, dots: 4 }] : [])], after: ({ ctx, X, Y }) => { ctx.strokeStyle = c.ink; ctx.lineWidth = 1.2; for (const [x, y] of pts) { ctx.beginPath(); ctx.arc(X(x), Y(y), 4, 0, 2 * Math.PI); ctx.stroke(); } } });
      const Ts = lin(100, 800, 50), kE = Ts.map((T) => Math.log10(M.kappaEckart(V1, V2, M.uOf(s.nu, T), 2000))), kW = Ts.map((T) => Math.log10(M.kappaWigner(M.uOf(s.nu, T)))), kB = Ts.map((T) => { const v = M.kappaBell(M.uOf(s.nu, T)); return v > 0 && Number.isFinite(v) ? Math.log10(v) : NaN; });
      const top = Math.min(8, Math.max(1, ...kE.filter(Number.isFinite)) + 0.3);
      plot(kv, { x: [100, 800], y: [0, top], xl: 'T / K', yl: 'log₁₀ κ', series: [{ xs: Ts, ys: kE, color: c.accent, width: 2.6, label: 'Eckart' }, { xs: Ts, ys: kW, color: c.warn, dash: [6, 4], width: 2, label: 'Wigner' }, { xs: Ts, ys: kB, color: c.violet, dash: [2, 3], width: 2, label: 'Bell' }], marks: [{ x: Tc, color: c.danger }, { x: s.t, color: c.gold }] });
      const kap = M.kappaEckart(V1, V2, u), kb = M.kappaBell(u);
      return [[L('u = hcν‡ / k_BT', 'u = hcν‡ / k_BT'), fix(u, 3)], [L('交叉温度 T_c', 'Crossover temperature T_c'), `${fix(Tc, 0)} K`], [L('V₁ 以 ħω‡ 为单位', 'V₁ in units of ħω‡'), fix(V1, 2)], [L('Eckart κ(T)', 'Eckart κ(T)'), fmt(kap, 4), true], [L('Wigner 1 + u²/24', 'Wigner 1 + u²/24'), fmt(M.kappaWigner(u), 4)], [L('Bell (u/2)/sin(u/2)', 'Bell (u/2)/sin(u/2)'), Number.isFinite(kb) ? fmt(kb, 4) : L('发散（u ≥ 2π）', 'diverges (u ≥ 2π)')], [L('P(E = V₁)（经典是 ½ 的台阶边）', 'P(E = V₁) (the edge of the classical step)'), fix(ek.P(V1), 4)]];
    },
  };

  // ── 10. 同位素效应 ──────────────────────────────────────────────
  DEMOS.kie = {
    title: L('动力学同位素效应：零点能、过渡态的对称性和隧穿', 'Kinetic isotope effects: zero-point energy, transition-state symmetry and tunnelling'), kind: 'exact',
    intro: L('X–H 伸缩振动在过渡态里变成反应坐标，它的零点能就丢了。H 的零点能比 D 高，所以 H 的有效势垒更低。拖动“过渡态里残留的比例”模拟不对称的过渡态（Westheimer 效应），打开隧穿看同位素效应怎样随温度降低而迅速增大。图是 k_H/k_D 随温度的变化，灰色横线是 7。', 'The X–H stretch becomes the reaction coordinate at the transition state, so its zero-point energy is lost. H has more zero-point energy than D, so its effective barrier is lower. Drag “fraction surviving in the transition state” to model an asymmetric transition state (the Westheimer effect), and switch on tunnelling to see the isotope effect grow quickly as the temperature drops. The plot shows k_H/k_D against temperature; the grey line marks 7.'),
    sel: [['heavy', L('和 H 相连的原子', 'Atom bonded to H'), [['C', 'C'], ['N', 'N'], ['O', 'O']], 'C'], ['iso', L('换成', 'Replace H by'), [['D', 'D'], ['T', 'T']], 'D']],
    ctl: [['nu', L('X–H 伸缩频率（cm⁻¹）', 'X–H stretch frequency (cm⁻¹)'), 2000, 3800, 10, 2900, String], ['frac', L('过渡态里残留的比例', 'Fraction surviving in the transition state'), 0, 0.8, 0.01, 0, (v) => `${Math.round(v * 100)} %`], ['t', L('温度 T（K）', 'Temperature T (K)'), 150, 600, 1, 298, String], ['imag', L('H 转移的虚频（cm⁻¹）', 'Imaginary frequency of H transfer (cm⁻¹)'), 500, 2000, 10, 1200, (v) => `${v}i`]],
    chk: [['tun', L('加 Wigner 隧穿修正', 'Add the Wigner tunnelling correction'), false]],
    btn: [[L('例题：C–H 2900，对称', 'Worked example: C–H 2900, symmetric'), { nu: 2900, frac: 0, t: 298, heavy: 'C', iso: 'D', tun: false }], [L('不对称：残留 30 %', 'Asymmetric: 30 % surviving'), { frac: 0.3 }], [L('O–H 3600', 'O–H 3600'), { heavy: 'O', nu: 3600 }]],
    figs: [[0.52, L('k_H/k_D（或 k_H/k_T）随温度的变化：实线只有零点能，虚线再乘 Wigner 隧穿修正之比。', 'k_H/k_D (or k_H/k_T) against temperature: solid from zero-point energy only, dashed with the ratio of Wigner tunnelling corrections.')]],
    note: L('只考虑一根伸缩振动（双原子近似 ν ∝ 1/√μ），忽略弯曲振动、转动和平动的贡献，也忽略虚频之比，所以是半经典模型里最简化的那个。隧穿用 Wigner 修正（虚频按 √μ 换算），它在低温下明显偏小：真实的隧穿可以让同位素效应到几十甚至上百。Swain–Schaad 指数 ln(k_H/k_T)/ln(k_H/k_D) 在只有零点能时与频率和温度无关。', 'Only one stretching vibration is included (diatomic approximation ν ∝ 1/√μ), ignoring bends, rotations, translations and the ratio of imaginary frequencies, so this is the simplest semiclassical model. Tunnelling uses the Wigner correction (imaginary frequency scaled by √μ), which is clearly too small at low temperature: real tunnelling can push isotope effects to tens or even hundreds. With zero-point energy alone the Swain–Schaad exponent ln(k_H/k_T)/ln(k_H/k_D) is independent of frequency and temperature.'),
    draw(s, [cv], c) {
      const o = { nu: s.nu, heavy: s.heavy, iso: s.iso, tsFrac: s.frac, imag: s.imag };
      const Ts = lin(150, 600, 120), a = Ts.map((T) => M.kie({ ...o, T }).kie), b = Ts.map((T) => M.kie({ ...o, T, tunnel: true }).kie);
      const ymax = Math.max(10, ...(s.tun ? b : a).filter((v) => v < 200)) * 1.08;
      plot(cv, { x: [150, 600], y: [1, Math.min(200, ymax)], xl: 'T / K', yl: `k_H / k_${s.iso}`, hmarks: [{ y: 7, color: c.muted }], series: [{ xs: Ts, ys: a, color: c.accent, width: 2.6, label: L('零点能', 'zero-point') }, ...(s.tun ? [{ xs: Ts, ys: b, color: c.violet, dash: [6, 4], width: 2.2, label: L('+ Wigner 隧穿', '+ Wigner tunnelling') }] : [])], marks: [{ x: s.t, y: M.kie({ ...o, T: s.t, tunnel: s.tun }).kie, color: c.gold }] });
      const r = M.kie({ ...o, T: s.t, tunnel: s.tun }), d = M.kie({ ...o, iso: 'D', T: s.t }), t = M.kie({ ...o, iso: 'T', T: s.t });
      return [[L(`X–${s.iso} 频率`, `X–${s.iso} frequency`), `${fix(r.nuI, 0)} cm⁻¹`], [L('丢掉的零点能之差', 'Difference in lost zero-point energy'), `${fix(r.dzpe, 0)} cm⁻¹ = ${fix(r.dzpeKJ, 2)} kJ/mol`], [`k_H / k_${s.iso}`, fix(r.kie, 2), true], [L('其中隧穿贡献', 'Of which tunnelling'), s.tun ? `× ${fix(r.tun, 3)}` : '—'], [L('Swain–Schaad 指数', 'Swain–Schaad exponent'), fix(Math.log(t.kie) / Math.log(d.kie), 3)], [L('Swain–Schaad（重原子质量 → ∞）', 'Swain–Schaad (heavy atom → ∞)'), '1.442']];
    },
  };

  // ── 能量剖面图：一串状态画成横线，用虚线连起来 ─────────────────
  function profile(cv, states, c, o = {}) {
    const n = states.length, vs = states.map((p) => p.G), lo = Math.min(...vs, o.lo ?? 0) - 12, hi = Math.max(...vs, o.hi ?? 0) + 14;
    plot(cv, { x: [0, n], y: [lo, hi], xl: o.xl || L('反应进程', 'reaction progress'), yl: 'G / kJ mol⁻¹', xt: [], series: [], hmarks: [{ y: 0, color: c.line }], after: ({ ctx, X, Y }) => {
      states.forEach((p, i) => {
        const x0 = X(i + 0.15), x1 = X(i + 0.85), y = Y(p.G);
        if (i) { const q = states[i - 1]; ctx.strokeStyle = c.muted; ctx.setLineDash([3, 3]); ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(X(i - 0.15), Y(q.G)); ctx.lineTo(x0, y); ctx.stroke(); ctx.setLineDash([]); }
        ctx.strokeStyle = p.color || (p.ts ? c.warn : c.accent); ctx.lineWidth = p.bold ? 4.5 : 3; ctx.beginPath(); ctx.moveTo(x0, y); ctx.lineTo(x1, y); ctx.stroke();
        ctx.fillStyle = c.ink; ctx.font = font(10.5, p.bold ? 700 : 500); ctx.textAlign = 'center'; ctx.fillText(p.label, (x0 + x1) / 2, y - 6);
        ctx.fillStyle = c.muted; ctx.font = font(10); ctx.fillText(minus(fix(p.G, 0)), (x0 + x1) / 2, y + 13);
      });
      if (o.after) o.after({ ctx, X, Y });
    } });
  }

  // ── 11. 表面上的微观动力学 ──────────────────────────────────────
  const surfP = (s) => ({ GA: s.ga, GB: s.gb, T1: Math.max(0, s.ga) + 10, T2: s.t2, T3: Math.max(s.gb, s.dgr) + 10, dGr: s.dgr, pA: 10 ** s.lpa, pB: 0.01, temp: s.t });
  DEMOS.micro = {
    title: L('微观动力学：A 吸附、变成 B、脱附，解出覆盖度、TOF 和速率控制度', 'Microkinetics: A adsorbs, turns into B and desorbs; solve for coverages, TOF and degrees of rate control'), kind: 'toy',
    intro: L('第一张图是能量剖面（相对于 A(g) + 空位）。拖动 A* 和 B* 的自由能、中间那一步的过渡态、温度和 A 的分压，程序每次都精确解一遍稳态方程。下面的表给出三种表面物种的覆盖度，以及每个状态的速率控制度 X：过渡态的 X 加起来是 1，中间体（含空位）的加起来是 −1。把 A* 调得很稳定，看它怎样占满表面、X 接近 −1。', 'The first plot is the energy profile (relative to A(g) + empty site). Drag the free energies of A* and B*, the transition state of the middle step, the temperature and the partial pressure of A; each time the steady-state equations are solved exactly. The table gives the coverages of the three surface species and every state’s degree of rate control X: the transition states’ X sum to 1 and the intermediates’ (including the empty site) to −1. Make A* very stable and watch it fill the surface as its X approaches −1.'),
    ctl: [['ga', L('G(A*)（kJ/mol）', 'G(A*) (kJ/mol)'), -80, 20, 1, -30, (v) => minus(v)], ['gb', L('G(B*)（kJ/mol）', 'G(B*) (kJ/mol)'), -80, 20, 1, -40, (v) => minus(v)], ['t2', L('A* → B* 的过渡态（kJ/mol）', 'Transition state A* → B* (kJ/mol)'), 0, 120, 1, 60, String], ['dgr', L('ΔGr°（A → B，kJ/mol）', 'ΔGr° (A → B, kJ/mol)'), -60, 0, 1, -20, (v) => minus(v)], ['t', L('温度 T（K）', 'Temperature T (K)'), 300, 800, 5, 500, String], ['lpa', L('log₁₀ p_A（bar）', 'log₁₀ p_A (bar)'), -4, 2, 0.1, 0, (v) => minus(v.toFixed(1))]],
    btn: [[L('例题：A* 毒化', 'Worked example: A* poisons'), { ga: -30, gb: -40, t2: 60, dgr: -20, t: 500, lpa: 0 }], [L('结合变弱', 'Weaker binding'), { ga: -10 }], [L('B* 太稳定', 'B* too stable'), { ga: -10, gb: -70 }]],
    figs: [[0.5, L('能量剖面：A(g) + * → TS1 → A* → TS2 → B* → TS3 → B(g) + *；吸附和脱附的过渡态比两端高 10 kJ/mol。', 'Energy profile: A(g) + * → TS1 → A* → TS2 → B* → TS3 → B(g) + *; the adsorption and desorption transition states sit 10 kJ/mol above the higher end.')], ['html', '']],
    note: L('所有速率常数都按 Eyring 公式从剖面算（κ = 1），吸附的正向乘 p_A，B 的再吸附乘 p_B = 0.01 bar。分压的作用相当于把 A(g) + * 这个状态挪动 −RT ln p_A。这是一个玩具模型：只有一种位点，没有吸附物之间的相互作用，吸附的熵损失也没有单独处理。稳态方程是线性的，用 Gauss 消元精确求解；速率控制度用有限差分。', 'All rate constants come from the profile through the Eyring equation (κ = 1); the forward adsorption is multiplied by p_A and re-adsorption of B by p_B = 0.01 bar. A partial pressure acts like shifting the A(g) + * state by −RT ln p_A. This is a toy model: one kind of site, no adsorbate–adsorbate interactions, no separate treatment of the entropy lost on adsorption. The steady-state equations are linear and are solved exactly by Gaussian elimination; degrees of rate control use finite differences.'),
    draw(s, [cv, hv], c) {
      const p = surfP(s), r = M.surface(p), x = M.surfaceDRC(p);
      const st = [{ label: 'A(g)+*', G: 0 }, { label: 'TS1', G: p.T1, ts: true }, { label: 'A*', G: p.GA }, { label: 'TS2', G: p.T2, ts: true, bold: x.T2 > 0.5 }, { label: 'B*', G: p.GB }, { label: 'TS3', G: p.T3, ts: true }, { label: 'B(g)+*', G: p.dGr }];
      profile(cv, st, c);
      const row = (name, th, X) => `<tr><td>${esc(name)}</td><td>${th === null ? '' : fix(th, 4)}</td><td>${minus(fix(Math.abs(X) < 5e-4 ? 0 : X, 3))}</td></tr>`;
      hv.innerHTML = `<table class="nq-peaks"><thead><tr><th>${esc(L('状态', 'State'))}</th><th>${esc(L('覆盖度 θ', 'Coverage θ'))}</th><th>${esc(L('速率控制度 X', 'Degree of rate control X'))}</th></tr></thead><tbody>${row(L('空位 *', 'Empty site *'), r.theta.free, x.Gfree)}${row('A*', r.theta.A, x.GA)}${row('B*', r.theta.B, x.GB)}${row('TS1', null, x.T1)}${row('TS2', null, x.T2)}${row('TS3', null, x.T3)}</tbody></table>`;
      return [[L('转化频率 TOF', 'Turnover frequency TOF'), `${sci(r.tof)} s⁻¹`, true], [L('过渡态的 X 之和', 'Sum of transition-state X'), fix(x.T1 + x.T2 + x.T3, 4)], [L('中间体（含空位）的 X 之和', 'Sum of intermediate X (incl. empty site)'), minus(fix(x.GA + x.GB + x.Gfree, 4))], [L('最多的表面物种', 'Most abundant surface species'), r.theta.A > r.theta.B && r.theta.A > r.theta.free ? 'A*' : r.theta.B > r.theta.free ? 'B*' : L('空位', 'empty sites')]];
    },
  };

  // ── 12. 火山图 ──────────────────────────────────────────────────
  DEMOS.volcano = {
    title: L('Sabatier 火山：结合太强太弱都不好', 'The Sabatier volcano: binding neither too strong nor too weak'), kind: 'toy',
    intro: L('横轴是“描述符”：A 在催化剂上的结合自由能 ΔE = G(A*)。B* 的能量按线性标度关系 G(B*) = γΔE + δ 跟着变，A* → B* 的势垒按 BEP 关系 Ea = α(G(B*) − G(A*)) + E₀。对每个 ΔE 解一遍微观动力学，就得到一张 TOF 的火山图。左边结合太强，表面被占满；右边结合太弱，A 吸附不上或活化不了。', 'The horizontal axis is the “descriptor”: the binding free energy of A on the catalyst, ΔE = G(A*). The energy of B* follows the linear scaling relation G(B*) = γΔE + δ, and the A* → B* barrier follows the BEP relation Ea = α(G(B*) − G(A*)) + E₀. Solving the microkinetics at every ΔE gives a volcano plot of the TOF. On the left binding is too strong and the surface clogs; on the right it is too weak and A fails to adsorb or activate.'),
    ctl: [['alpha', L('BEP 斜率 α', 'BEP slope α'), 0, 1, 0.05, 0.5, (v) => v.toFixed(2)], ['e0', L('BEP 截距 E₀（kJ/mol）', 'BEP intercept E₀ (kJ/mol)'), 20, 120, 1, 70, String], ['gamma', L('标度斜率 γ', 'Scaling slope γ'), 0.3, 1.5, 0.05, 1, (v) => v.toFixed(2)], ['t', L('温度 T（K）', 'Temperature T (K)'), 300, 800, 5, 500, String]],
    figs: [[0.5, L('log₁₀ TOF 对描述符 ΔE；金色竖线是最优的 ΔE。', 'log₁₀ TOF against the descriptor ΔE; the gold line marks the optimal ΔE.')], [0.42, L('稳态覆盖度：空位（灰）、A*（蓝）、B*（紫）。', 'Steady-state coverages: empty sites (grey), A* (blue), B* (purple).')]],
    note: L('标度关系的截距 δ = −20 kJ/mol，ΔGr° = −40 kJ/mol，p_A = 1 bar，p_B = 0.01 bar，吸附和脱附的过渡态比两端高 10 kJ/mol。BEP 给出的势垒不低于 0 和这一步的吸热量。这是一个为了看清火山怎样形成而搭的玩具模型；真实的火山图用 DFT 算出的标度关系和 BEP 关系，常有两个描述符。', 'Scaling intercept δ = −20 kJ/mol, ΔGr° = −40 kJ/mol, p_A = 1 bar, p_B = 0.01 bar, and adsorption and desorption transition states 10 kJ/mol above the higher end. The BEP barrier is never below zero or below the step’s endothermicity. A toy model built to show how the volcano forms; real volcano plots use DFT-derived scaling and BEP relations, often with two descriptors.'),
    draw(s, [cv, ov], c) {
      const es = lin(-140, 40, 181), o = { alpha: s.alpha, E0: s.e0, gamma: s.gamma, temp: s.t };
      const pts = es.map((e) => M.volcanoPoint(e, o)), lt = pts.map((p) => Math.log10(p.tof));
      let bi = 0; lt.forEach((v, i) => { if (v > lt[bi]) bi = i; });
      plot(cv, { x: [-140, 40], y: [Math.max(-20, Math.min(...lt)) - 0.5, lt[bi] + 1], xl: 'ΔE = G(A*) / kJ mol⁻¹', yl: 'log₁₀ TOF', series: [{ xs: es, ys: lt, color: c.accent, width: 2.6 }], marks: [{ x: es[bi], y: lt[bi], color: c.gold }] });
      plot(ov, { x: [-140, 40], y: [0, 1], xl: 'ΔE / kJ mol⁻¹', yl: 'θ', series: [{ xs: es, ys: pts.map((p) => p.theta.free), color: c.muted, width: 2, label: '*' }, { xs: es, ys: pts.map((p) => p.theta.A), color: c.info, width: 2.2, label: 'A*' }, { xs: es, ys: pts.map((p) => p.theta.B), color: c.violet, width: 2.2, label: 'B*' }], marks: [{ x: es[bi], color: c.gold }] });
      const b = pts[bi];
      return [[L('最优的 ΔE', 'Optimal ΔE'), kj(es[bi], 0), true], [L('火山顶的 TOF', 'TOF at the top'), `${sci(b.tof)} s⁻¹`, true], [L('顶点处 A*→B* 的势垒', 'A*→B* barrier at the top'), kj(b.T2 - b.GA, 1)], [L('左端（ΔE = −140）的 TOF', 'TOF at the left end (ΔE = −140)'), `${sci(pts[0].tof)} s⁻¹`], [L('右端（ΔE = +40）的 TOF', 'TOF at the right end (ΔE = +40)'), `${sci(pts[pts.length - 1].tof)} s⁻¹`]];
    },
  };

  // ── 13. 能量跨度模型 ────────────────────────────────────────────
  DEMOS.span = {
    title: L('能量跨度模型：找出 TDTS 和 TDI，和精确稳态逐位对照', 'The energetic span model: find the TDTS and TDI, and compare digit by digit with the exact steady state'), kind: 'exact',
    intro: L('一个三步的催化循环：中间体 I₀（定为 0）、I₁、I₂ 和过渡态 T₀、T₁、T₂，转一圈放出 ΔGr。图里画了两圈，金色的是决定 TOF 的过渡态（TDTS），蓝色粗线是决定 TOF 的中间体（TDI），竖箭头是能量跨度 δE。读数同时给出 Kozuch–Shaik 公式的 TOF 和直接解稳态方程的 TOF，它们应该完全相等；最后一行是“只看单步最高势垒”的估计，常常差几个数量级。', 'A three-step catalytic cycle: intermediates I₀ (set to 0), I₁, I₂ and transition states T₀, T₁, T₂, releasing ΔGr per turnover. Two turnovers are drawn; gold marks the TOF-determining transition state (TDTS), the thick blue bar the TOF-determining intermediate (TDI), and the vertical arrow the energetic span δE. The readouts give both the TOF from the Kozuch–Shaik formula and from solving the steady-state equations directly, which should be identical; the last line is the estimate from “the highest single-step barrier”, often off by orders of magnitude.'),
    ctl: [['i1', 'I₁', -60, 40, 1, -30, (v) => minus(v)], ['i2', 'I₂', -60, 40, 1, -10, (v) => minus(v)], ['t0', 'T₀', 0, 120, 1, 50, String], ['t1', 'T₁', -40, 120, 1, 25, (v) => minus(v)], ['t2', 'T₂', -40, 120, 1, 45, (v) => minus(v)], ['dgr', 'ΔGr', -100, -1, 1, -40, (v) => minus(v)], ['t', L('温度 T（K）', 'Temperature T (K)'), 250, 500, 1, 298, String]],
    btn: [[L('陷阱中间体（例题）', 'Trap intermediate (worked example)'), { i1: -30, i2: -10, t0: 50, t1: 25, t2: 45, dgr: -40, t: 298 }], [L('TDTS 在 TDI 之前', 'TDTS before TDI'), { i1: 5, i2: -30, t0: 70, t1: 40, t2: 20, dgr: -20, t: 298 }], [L('接近平衡', 'Near equilibrium'), { dgr: -2 }]],
    changed(s) { s.t1 = Math.max(s.t1, s.i1, s.i2); s.t0 = Math.max(s.t0, 0, s.i1); s.t2 = Math.max(s.t2, s.i2, s.dgr); },
    figs: [[0.5, L('两圈的能量剖面。T 在两个相邻中间体之间；第二圈的能量都低 |ΔGr|。', 'The energy profile over two turnovers. Each T sits between two neighbouring intermediates; the second turnover is lower by |ΔGr|.')], ['html', '']],
    note: L('能量是自由能（kJ/mol），浓度效应假定已经并进剖面。速率常数按 Eyring 公式（κ = 1）。“精确稳态”是把三个中间体的分数当未知数、解线性方程组；能量跨度公式里 T_i 排在 I_j 之后（i ≥ j）的项减去 ΔGr。过渡态的能量不能低于它两边的中间体，程序会自动抬高。TOF 控制度用有限差分。', 'Energies are free energies (kJ/mol), with concentration effects assumed folded into the profile. Rate constants use the Eyring equation (κ = 1). The “exact steady state” treats the fractions of the three intermediates as unknowns and solves the linear equations; in the energetic span formula, terms with T_i after I_j (i ≥ j) subtract ΔGr. A transition state cannot lie below the intermediates on either side, so the program raises it automatically. Degrees of TOF control use finite differences.'),
    draw(s, [cv, hv], c) {
      const I = [0, s.i1, s.i2], T = [s.t0, s.t1, s.t2], g = s.dgr, es = M.energeticSpan(I, T, g, s.t), ex = M.cycleTOF(I, T, g, s.t), X = M.tofControl(I, T, g, s.t);
      const states = [];
      for (let k = 0; k < 2; k++) for (let i = 0; i < 3; i++) {
        states.push({ label: `I${'₀₁₂'[i]}`, G: I[i] + k * g, bold: i === es.tdi && k === 0, color: i === es.tdi && k === 0 ? c.info : undefined });
        states.push({ label: `T${'₀₁₂'[i]}`, G: T[i] + k * g, ts: true, color: i === es.tdts && k === (es.tdts < es.tdi ? 1 : 0) ? c.gold : undefined, bold: i === es.tdts && k === (es.tdts < es.tdi ? 1 : 0) });
      }
      states.push({ label: 'I₀', G: 2 * g });
      const xi = 2 * es.tdi, xt = 2 * es.tdts + 1 + (es.tdts < es.tdi ? 6 : 0);
      profile(cv, states, c, { after: ({ ctx, X: XX, Y }) => { const x = XX((xi + xt) / 2 + 0.5); arrow(ctx, x, Y(I[es.tdi]), x, Y(T[es.tdts] + (es.tdts < es.tdi ? g : 0)), c.gold, 2); ctx.fillStyle = c.gold; ctx.font = font(11, 700); ctx.textAlign = 'left'; ctx.fillText(`δE = ${fix(es.dE, 1)}`, x + 6, Y((I[es.tdi] + T[es.tdts] + (es.tdts < es.tdi ? g : 0)) / 2)); } });
      const row = (n, v) => `<tr><td>${n}</td><td>${minus(fix(Math.abs(v) < 5e-4 ? 0 : v, 3))}</td></tr>`;
      hv.innerHTML = `<table class="nq-peaks"><thead><tr><th>${esc(L('状态', 'State'))}</th><th>${esc(L('TOF 控制度 X', 'Degree of TOF control X'))}</th></tr></thead><tbody>${['₀', '₁', '₂'].map((d, i) => row(`I${d}`, X.XI[i])).join('')}${['₀', '₁', '₂'].map((d, i) => row(`T${d}`, X.XT[i])).join('')}</tbody></table>`;
      const naive = Math.max(...T.map((t, i) => t - I[i]), ...T.map((t, i) => t - (i < 2 ? I[i + 1] : I[0] + g)).map(() => -Infinity));
      const naiveTOF = M.kTh(s.t) * Math.exp((-naive * 1000) / (M.R * s.t));
      return [[L('TDTS / TDI', 'TDTS / TDI'), `T${'₀₁₂'[es.tdts]} / I${'₀₁₂'[es.tdi]} · ${es.tdts < es.tdi ? L('TDTS 在前，加 ΔGr', 'TDTS first, add ΔGr') : L('TDTS 在后', 'TDTS after')}`], [L('能量跨度 δE', 'Energetic span δE'), kj(es.dE, 1), true], [L('TOF（能量跨度公式）', 'TOF (energetic span formula)'), `${sci(es.tof)} s⁻¹`, true], [L('TOF（精确稳态）', 'TOF (exact steady state)'), `${sci(ex.tof)} s⁻¹`], [L('两者相对差', 'Relative difference'), fmt(Math.abs(es.tof - ex.tof) / Math.abs(ex.tof), 2)], [L('近似 (k_BT/h)·exp(−δE/RT)', 'Approximation (k_BT/h)·exp(−δE/RT)'), `${sci(es.approx)} s⁻¹`], [L('“最高单步势垒”的估计', '“Highest single-step barrier” estimate'), `${kj(naive, 0)} → ${sci(naiveTOF)} s⁻¹`]];
    },
  };
};
