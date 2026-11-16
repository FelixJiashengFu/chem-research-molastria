'use strict';
// 光学（/optics/）的十二个演示。数学都在 optics-models.js（纯函数，tools/optics-test.mjs 测）。optics.js 用 window.MOLASTRIA_OPTICS_DEMOS(K, DEMOS) 把它们登记进去。
// 每个演示：title，kind，intro，sel 下拉 [键, 名字, [[值, 名字]…], 初值]，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，chk 开关 [键, 名字, 初值]，
// btn 预设 [名字, { 键: 值 }]，act 动作，state，autoplay，fps + tick(s)，changed(s, 键)，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 返回读数 [[名字, 值, 是否加粗]]。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。K 是 optics.js 给的画图工具。
// 第一个演示“波场水槽”的玩法来自站长 Fe 给的“波的衍射原理与交互动画”页面（单缝、双缝、光栅、挡板、接收屏光强、矢量相干图），代码按这个站的写法重写。
window.MOLASTRIA_OPTICS_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_OPTICS_MODELS;
  const { L, fix, fmt, plot, fit, lin, arrow, font } = K;
  const deg = Math.PI / 180;
  const rgb = (a) => `rgb(${a[0]},${a[1]},${a[2]})`;
  // 把任意 CSS 颜色换成 [r, g, b]（画像素图时要用）；第一次用到才建画布，生成脚本在没有 document 的环境里也能登记演示
  let probeCtx = null;
  const rgbOf = (col) => { probeCtx ||= document.createElement('canvas').getContext('2d'); probeCtx.fillStyle = '#000'; probeCtx.fillStyle = col || '#000'; const v = probeCtx.fillStyle; if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)); const m = v.match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };
  const swatch = (c) => `<span class="opt-swatch" style="background:${rgb(c)}"></span>`;
  // 在一张 plot 图上，把指针的横坐标换成数据坐标（plot 的左右边距是 50 和 12 像素）
  const pointerX = (cv, e, x0, x1) => { const r = cv.getBoundingClientRect(), px = e.clientX - r.left; return x0 + ((px - 50) / Math.max(1, r.width - 62)) * (x1 - x0); };
  // 一串首尾相接的小箭头（矢量图），最后画合成的那一支
  function phasorChain(cv, list, c, o = {}) {
    const { ctx, w, h } = fit(cv);
    let x = 0, y = 0, mnx = 0, mxx = 0, mny = 0, mxy = 0;
    for (const [a, b] of list) { x += a; y += b; mnx = Math.min(mnx, x); mxx = Math.max(mxx, x); mny = Math.min(mny, y); mxy = Math.max(mxy, y); }
    const span = Math.max(mxx - mnx, mxy - mny, o.min || 1e-9), sc = (Math.min(w, h) - 36) / span, ox = w / 2 - ((mnx + mxx) / 2) * sc, oy = h / 2 + ((mny + mxy) / 2) * sc;
    ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(8, oy); ctx.lineTo(w - 8, oy); ctx.moveTo(ox, 8); ctx.lineTo(ox, h - 8); ctx.stroke();
    x = 0; y = 0;
    const col = o.color || c.accent;
    for (const [a, b] of list) { const X0 = ox + x * sc, Y0 = oy - y * sc; x += a; y += b; arrow(ctx, X0, Y0, ox + x * sc, oy - y * sc, col, 1.4); }
    arrow(ctx, ox, oy, ox + x * sc, oy - y * sc, c.gold, 2.6);
    ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'left'; ctx.fillText(o.label || '', 10, 16);
    return Math.hypot(x, y);
  }

  // ── 1. 波场水槽 ───────────────────────────────────────────────
  const TK = { x0: -3, x1: 14, y1: 7, nx: 172, ny: 141 };
  let TC = null;
  const tank = (s) => {
    const key = [s.mode, s.lam, s.a, s.d, s.N].join('|');
    if (TC?.key === key) return TC;
    const lam = s.lam / 1000, o = { mode: s.mode, a: s.a, d: s.d, N: s.N, extent: 3 * TK.y1 };
    const src = M.tankSources(o, lam, s.mode === 'obstacle' ? 4 : 6), grid = M.tankGrid(src, lam, TK.x1, TK.y1, TK.nx, TK.ny);
    const scr = Float64Array.from({ length: TK.ny }, (_, j) => { const p = j * TK.nx + TK.nx - 1; return grid.re[p] ** 2 + grid.im[p] ** 2; });
    TC = { key, lam, o, src, grid, scr };
    return TC;
  };
  let TI = null; // 像素缓冲
  DEMOS.tank = {
    title: L('波场水槽：惠更斯子波怎样叠出衍射和干涉', 'Wave tank: how Huygens wavelets add up to diffraction and interference'), kind: 'exact', autoplay: true,
    intro: L('平面波从左边射到一道屏上。按惠更斯–菲涅耳原理，屏上每个透光的点都当作一个新的波源（金色小点），右边的波场就是这些子波逐点相加：这里真的把几十到几百个子波的复振幅加起来，不是贴图。右边那条是接收屏。点或拖动下面的“接收屏光强”图，可以选一个位置，看那一点上各个子波的“矢量图”怎样首尾相接。', 'A plane wave arrives from the left at a screen. By the Huygens–Fresnel principle every open point of the screen acts as a new source (the small gold dots), and the field on the right is the sum of these wavelets point by point: the complex amplitudes of tens to hundreds of wavelets really are added here, nothing is a stock picture. The strip on the right is the observation screen. Click or drag in the “intensity on the screen” plot below to pick a point and see how the wavelets add head to tail in the phasor diagram.'),
    sel: [['mode', L('开口', 'Opening'), [['single', L('单缝', 'Single slit')], ['double', L('双缝', 'Double slit')], ['grating', L('多缝光栅', 'Multi-slit grating')], ['obstacle', L('挡板（泊松亮斑）', 'Obstacle (Poisson spot)')]], 'single']],
    ctl: [['lam', L('波长 λ', 'Wavelength λ'), 400, 700, 2, 532, (v) => `${v} nm`], ['a', L('缝宽 a（挡板时是挡板宽）', 'Slit width a (obstacle width)'), 0.3, 5, 0.05, 1.8, (v) => `${v.toFixed(2)} μm`], ['d', L('缝距 d', 'Slit spacing d'), 1, 6, 0.05, 3.2, (v) => `${v.toFixed(2)} μm`], ['N', L('缝数 N', 'Number of slits N'), 2, 12, 1, 5, (v) => String(v)]],
    chk: [['inten', L('看光强 |U|²（不看瞬时波）', 'Show intensity |U|² instead of the instantaneous wave'), false], ['lens', L('接收屏放到透镜焦面（夫琅禾费，远场）', 'Put the screen in a lens’s focal plane (Fraunhofer, far field)'), false], ['dots', L('标出惠更斯子波源', 'Mark the Huygens sources'), true], ['geo', L('几何光学的阴影边界', 'Shadow edges of geometric optics'), true]],
    btn: [[L('窄缝：几乎是圆形波', 'Narrow slit: almost circular waves'), { mode: 'single', a: 0.4 }], [L('宽缝：几何阴影加边缘条纹', 'Wide slit: geometric shadow plus edge fringes'), { mode: 'single', a: 5 }], [L('杨氏双缝', 'Young’s double slit'), { mode: 'double', a: 0.6, d: 3.2 }], [L('缺级：d = 2a', 'Missing orders: d = 2a'), { mode: 'double', a: 1.6, d: 3.2, lens: true }], [L('八缝光栅', 'Eight-slit grating'), { mode: 'grating', N: 8, a: 0.6, d: 1.6 }], [L('泊松亮斑', 'Poisson spot'), { mode: 'obstacle', a: 3 }]],
    state: () => ({ ph: 0, probe: 0.18, probeY: 2.4 }),
    fps: 30,
    tick(s) { s.ph += 0.22; },
    changed(s, k) { if (k === 'mode' || k === '') { if (s.mode === 'obstacle' && s.lens) s.lens = false; } },
    figs: [[0.83, L('波场（左边是入射的平面波，x = 0 处是屏，右边缘是接收屏）。横轴 −3 到 14 μm，纵轴 ±7 μm。', 'The field (incident plane wave on the left, the screen at x = 0, the observation screen at the right edge). Horizontal axis −3 to 14 μm, vertical ±7 μm.')], [0.42, L('接收屏光强 I(y)（实线，最大值记 1）。不放透镜时虚线是同一组缝的远场公式，二者的差别就是菲涅耳（近场）衍射。点或拖动这张图选位置。', 'Intensity on the screen I(y) (solid, maximum set to 1). Without the lens the dashed curve is the far-field formula for the same slits; the difference between them is Fresnel (near-field) diffraction. Click or drag this plot to choose a point.')], [0.62, L('矢量相干图：选中那一点上，各段子波的复振幅（细箭头）首尾相接，金色是合振幅。', 'Phasor diagram: at the chosen point the complex amplitudes of the wavelets (thin arrows) are added head to tail; gold is the resultant.')]],
    note: L('这是二维的标量波（相当于无限长的缝），用的是 Kirchhoff 的近似：屏上开口处的场就是入射波，挡住的地方是零，再乘倾斜因子 (1 + cos θ)/2。它忽略了屏边缘附近真实的电磁边界条件（缝宽接近波长时有几成的误差），也没有画屏左边的反射波。挡板一项只把屏算到 ±21 μm，再往外当作挡住，所以远处会有一点截断的条纹。远场公式只给缝和光栅：挡板的远场按 Babinet 原理和同样宽的单缝一样（只差中央一点）。', 'This is a two-dimensional scalar wave (equivalent to infinitely long slits) in Kirchhoff’s approximation: in the openings the field is the incident wave, behind the screen it is zero, times the obliquity factor (1 + cos θ)/2. It ignores the true electromagnetic boundary conditions near the edges (errors of tens of per cent when the slit is about a wavelength wide) and does not draw the wave reflected to the left. For the obstacle the screen is computed out to ±21 μm and treated as opaque beyond, so there are faint truncation fringes far out. The far-field formula is given for slits and gratings only: by Babinet’s principle the far field of an obstacle is that of a slit of the same width, apart from the very centre.'),
    draw(s, [cv, pv, phv], c) {
      const T = tank(s), { grid, src, lam } = T, { ctx, w, h } = fit(cv);
      const ncol = Math.round((TK.nx * (TK.x1 - TK.x0)) / TK.x1), off = ncol - TK.nx;
      if (!TI || TI.w !== ncol) { const oc = document.createElement('canvas'); oc.width = ncol; oc.height = TK.ny; TI = { w: ncol, oc, ox: oc.getContext('2d') }; TI.img = TI.ox.createImageData(ncol, TK.ny); }
      const bg = rgbOf(c.surface), wave = M.monoRGB(s.lam), ink = rgbOf(c.ink), D = TI.img.data, cw = Math.cos(s.ph), sw = Math.sin(s.ph), k = (2 * Math.PI) / lam;
      for (let j = 0; j < TK.ny; j++) for (let col = 0; col < ncol; col++) {
        let v;
        if (col < off) { const x = TK.x0 + (col / off) * -TK.x0; v = s.inten ? 1 : Math.cos(k * x - s.ph); } else { const p = j * TK.nx + (col - off), re = grid.re[p], im = grid.im[p]; v = s.inten ? re * re + im * im : re * cw + im * sw; }
        let r, g, b;
        if (s.inten) { const t = 1 - Math.exp(-v / 0.7); r = bg[0] + (wave[0] - bg[0]) * t; g = bg[1] + (wave[1] - bg[1]) * t; b = bg[2] + (wave[2] - bg[2]) * t; }
        else { const t = Math.max(-1, Math.min(1, v / 1.2)); const up = Math.max(t, 0), dn = Math.max(-t, 0) * 0.45; r = bg[0] + (wave[0] - bg[0]) * up + (ink[0] - bg[0]) * dn; g = bg[1] + (wave[1] - bg[1]) * up + (ink[1] - bg[1]) * dn; b = bg[2] + (wave[2] - bg[2]) * up + (ink[2] - bg[2]) * dn; }
        const q = 4 * (j * ncol + col); D[q] = r; D[q + 1] = g; D[q + 2] = b; D[q + 3] = 255;
      }
      TI.ox.putImageData(TI.img, 0, 0);
      ctx.imageSmoothingEnabled = true; ctx.drawImage(TI.oc, 0, 0, w, h);
      const X = (x) => ((x - TK.x0) / (TK.x1 - TK.x0)) * w, Y = (y) => h / 2 - (y / TK.y1) * (h / 2);
      // 屏
      const open = M.apertures(T.o).map(([a, b]) => [Math.max(a, -TK.y1), Math.min(b, TK.y1)]).filter(([a, b]) => b > a).sort((p, q) => p[0] - q[0]);
      ctx.fillStyle = c.ink; let yPrev = -TK.y1;
      for (const [a, b] of [...open, [TK.y1, TK.y1]]) { if (a > yPrev) ctx.fillRect(X(0) - 2, Y(a), 4, Y(yPrev) - Y(a)); yPrev = b; }
      if (s.mode === 'obstacle') { ctx.fillRect(X(0) - 2, Y(s.a / 2), 4, Y(-s.a / 2) - Y(s.a / 2)); }
      if (s.dots) { ctx.fillStyle = c.gold; const every = Math.max(1, Math.round(src.y.length / 80)); for (let j = 0; j < src.y.length; j += every) { if (Math.abs(src.y[j]) > TK.y1) continue; ctx.beginPath(); ctx.arc(X(0), Y(src.y[j]), 1.8, 0, 2 * Math.PI); ctx.fill(); } }
      if (s.geo) { ctx.strokeStyle = c.muted; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; for (const [a, b] of open) for (const y of [a, b]) { if (Math.abs(y) >= TK.y1 - 1e-6) continue; ctx.beginPath(); ctx.moveTo(X(0), Y(y)); ctx.lineTo(w, Y(y)); ctx.stroke(); } ctx.setLineDash([]); }
      // 接收屏上的光强条
      const imax = Math.max(...T.scr, 1e-9);
      for (let j = 0; j < TK.ny; j++) { const t = Math.sqrt(T.scr[j] / imax); ctx.fillStyle = `rgba(${wave[0]},${wave[1]},${wave[2]},${t.toFixed(3)})`; ctx.fillRect(w - 9, (j / TK.ny) * h, 9, h / TK.ny + 1); }
      // 选中的点
      const sNear = (y) => y / Math.hypot(y, TK.x1);
      const py = s.lens ? Math.max(-TK.y1, Math.min(TK.y1, (s.probe / Math.sqrt(1 - Math.min(0.99, s.probe ** 2))) * TK.x1)) : s.probeY;
      ctx.strokeStyle = c.gold; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.beginPath(); ctx.moveTo(X(0), Y(0)); ctx.lineTo(w - 9, Y(py)); ctx.stroke(); ctx.setLineDash([]);
      ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(w - 9, Y(py), 4, 0, 2 * Math.PI); ctx.fill();
      // 接收屏光强图
      const nSlit = s.mode === 'single' ? 1 : s.mode === 'double' ? 2 : s.N, ys = lin(-TK.y1, TK.y1, TK.ny);
      let probeI, phs, label, delta;
      if (s.lens) {
        const ss = lin(-1, 1, 1201), I = ss.map((x) => M.farI(T.o, lam, x)), env = ss.map((x) => M.slitI(s.a, lam, x));
        probeI = M.farI(T.o, lam, s.probe);
        plot(pv, { x: [-1, 1], y: [0, 1.08], xl: 'sin θ', yl: 'I', series: [...(nSlit > 1 ? [{ xs: ss, ys: env, color: c.muted, dash: [4, 4], width: 1.2, label: L('单缝包络', 'single-slit envelope') }] : []), { xs: ss, ys: I, color: rgb(wave), width: 1.8, label: L('远场', 'far field') }], marks: [{ x: s.probe, y: probeI, color: c.gold }] });
        phs = M.phasorsFar(src, lam, s.probe, nSlit > 1 ? 12 * nSlit : 36);
        delta = (nSlit > 1 ? s.d : s.a) * s.probe / lam;
        label = `sin θ = ${fix(s.probe, 3)}`;
      } else {
        const I = Array.from(T.scr, (v) => v / imax), far = ys.map((y) => M.farI(T.o, lam, sNear(y)));
        const j = Math.round(((s.probeY + TK.y1) / (2 * TK.y1)) * (TK.ny - 1)); probeI = I[Math.max(0, Math.min(TK.ny - 1, j))];
        plot(pv, { x: [-TK.y1, TK.y1], y: [0, 1.08], xl: L('接收屏上的位置 y（μm）', 'position y on the screen (μm)'), yl: 'I', series: [...(s.mode !== 'obstacle' ? [{ xs: ys, ys: far, color: c.muted, dash: [4, 4], width: 1.2, label: L('远场公式', 'far-field formula') }] : []), { xs: ys, ys: I, color: rgb(wave), width: 1.8, label: L(`x = ${TK.x1} μm 处`, `at x = ${TK.x1} μm`) }], marks: [{ x: s.probeY, y: probeI, color: c.gold }] });
        phs = M.phasors(src, lam, TK.x1, s.probeY, s.mode === 'obstacle' ? 60 : nSlit > 1 ? 12 * nSlit : 36);
        const r = (y0) => Math.hypot(TK.x1, s.probeY - y0);
        delta = s.mode === 'single' || s.mode === 'obstacle' ? (r(-s.a / 2) - r(s.a / 2)) / lam : (r(-s.d / 2) - r(s.d / 2)) / lam;
        label = `y = ${fix(s.probeY, 2)} μm`;
      }
      pv.classList.add('opt-point');
      pv.onpointerdown = pv.onpointermove = (e) => { if (e.type === 'pointermove' && !e.buttons) return; if (s.lens) s.probe = Math.max(-1, Math.min(1, pointerX(pv, e, -1, 1))); else s.probeY = Math.max(-TK.y1, Math.min(TK.y1, pointerX(pv, e, -TK.y1, TK.y1))); s.redraw?.(); };
      phasorChain(phv, phs, c, { label, color: rgb(wave) });
      // 读数
      const out = [];
      const sinMin = lam / s.a;
      if (s.mode === 'single') out.push([L('第一暗纹 sin θ = λ/a', 'First dark fringe sin θ = λ/a'), sinMin < 1 ? fix(sinMin, 3) : L('没有（a < λ）', 'none (a < λ)'), 1]);
      if (s.mode === 'double' || s.mode === 'grating') { out.push([L('条纹（主极大）间隔 Δsin θ = λ/d', 'Fringe (principal-maximum) spacing Δsin θ = λ/d'), fix(lam / s.d, 3), 1]); out.push([L('能出现的级次 |m| ≤ d/λ', 'Orders present |m| ≤ d/λ'), String(Math.floor(s.d / lam))]); const r = s.d / s.a; if (Math.abs(r - Math.round(r)) < 0.03 && Math.round(r) >= 2) out.push([L('缺级', 'Missing orders'), L(`m = ±${Math.round(r)}、±${2 * Math.round(r)}…（d/a = ${Math.round(r)}）`, `m = ±${Math.round(r)}, ±${2 * Math.round(r)}… (d/a = ${Math.round(r)})`)]); }
      if (s.mode === 'grating') out.push([L('两个主极大之间', 'Between principal maxima'), L(`${s.N - 1} 个暗纹、${s.N - 2} 个次极大`, `${s.N - 1} minima, ${s.N - 2} subsidiary maxima`)]);
      if (s.mode === 'obstacle') { const j0 = Math.round((TK.ny - 1) / 2), ref = T.scr[j0]; out.push([L('挡板正后方（几何阴影中心）的光强', 'Intensity right behind the obstacle (centre of the geometric shadow)'), L(`入射光的 ${fix(ref, 2)} 倍`, `${fix(ref, 2)} × the incident intensity`), 1]); }
      out.push([L('菲涅耳数 N_F = (a/2)²/(λx)', 'Fresnel number N_F = (a/2)²/(λx)'), fix(M.fresnelNumber(s.a, lam, TK.x1), 3)]);
      out.push([L('选中点的光程差', 'Path difference at the chosen point'), `${fix(delta, 2)} λ`]);
      out.push([L('选中点的光强', 'Intensity at the chosen point'), fix(probeI, 3)]);
      return out;
    },
  };

  // ── 2. 薄膜的颜色 ─────────────────────────────────────────────
  const FILMS = { soap: [1, 1.333, 1, L('肥皂膜（水，两边是空气）', 'Soap film (water, air on both sides)')], oil: [1, 1.47, 1.333, L('水面上的油膜', 'Oil film on water')], mgf2: [1, 1.38, 1.52, L('玻璃上的 MgF₂ 增透膜', 'MgF₂ antireflection coating on glass')], tio2: [1, 2.4, 1.52, L('玻璃上的 TiO₂ 高反膜', 'TiO₂ high-reflector layer on glass')] };
  const stripCache = new Map();
  const filmStrip = (key, th) => { const id = `${key}|${th}`; if (!stripCache.has(id)) { const [n0, n1, n2] = FILMS[key]; stripCache.set(id, Array.from({ length: 301 }, (_, i) => M.spectrumColor((nm) => M.filmR(n0, n1, n2, i * 5, nm, th * deg)).rgb)); } return stripCache.get(id); };
  DEMOS.film = {
    title: L('薄膜干涉：肥皂泡和增透膜的颜色', 'Thin-film interference: the colours of soap bubbles and antireflection coatings'), kind: 'exact',
    intro: L('一层厚度和波长相当的透明膜，上下两个表面各反射一部分光，两束反射光干涉。哪种颜色相长、哪种相消取决于膜的光学厚度 n·d·cos θ。这里把每个波长的反射率按多次反射全部相干叠加算出来，再按人眼的配色函数换成颜色。', 'A transparent film about a wavelength thick reflects some light from each of its two surfaces, and the two reflections interfere. Which colours add and which cancel depends on the optical thickness n·d·cos θ. Here the reflectance at every wavelength is computed with all multiple reflections added coherently, then turned into a colour with the colour-matching functions of the eye.'),
    sel: [['film', L('膜', 'Film'), Object.entries(FILMS).map(([k, v]) => [k, v[3]]), 'soap']],
    ctl: [['d', L('膜厚 d', 'Thickness d'), 0, 1500, 5, 300, (v) => `${v} nm`], ['th', L('入射角', 'Angle of incidence'), 0, 70, 1, 0, (v) => `${v}°`]],
    btn: [[L('四分之一波长增透膜', 'Quarter-wave antireflection coating'), { film: 'mgf2', d: 100, th: 0 }], [L('快要破的肥皂膜（很薄，发黑）', 'A soap film about to burst (very thin, black)'), { film: 'soap', d: 10, th: 0 }], [L('肥皂泡的品红色', 'The magenta of a soap bubble'), { film: 'soap', d: 400, th: 0 }]],
    figs: [[0.12, L('膜厚从 0 到 1500 nm 的颜色（像一片竖着的肥皂膜从上到下慢慢变厚）；竖线是现在的厚度。', 'The colour for thicknesses from 0 to 1500 nm (like a vertical soap film thickening from top to bottom); the line marks the present thickness.')], [0.5, L('反射率随波长的变化。底下的色带是各个波长本来的颜色。', 'Reflectance against wavelength. The band underneath shows the colour of each wavelength.')]],
    note: L('折射率当作和波长无关的实数（没有色散、没有吸收），照明当作 6500 K 的黑体，颜色按 CIE 1931 配色函数的解析拟合（Wyman、Sloan 和 Shirley 2013）换成 sRGB；屏幕显示的颜色只能近似，饱和的颜色会超出 sRGB 色域。斜入射时取 s 和 p 偏振的平均。', 'Refractive indices are taken as real and independent of wavelength (no dispersion or absorption), the illumination as a 6500 K blackbody, and colours are converted to sRGB with the analytic fit of the CIE 1931 colour-matching functions (Wyman, Sloan and Shirley 2013); the colours on screen are approximate and saturated ones fall outside the sRGB gamut. At oblique incidence s and p polarisations are averaged.'),
    draw(s, [sv, cv], c) {
      const [n0, n1, n2] = FILMS[s.film], strip = filmStrip(s.film, s.th);
      const { ctx, w, h } = fit(sv);
      strip.forEach((col, i) => { ctx.fillStyle = rgb(col); ctx.fillRect((i / 301) * w, 0, w / 301 + 1, h); });
      const xd = (s.d / 1500) * w; ctx.strokeStyle = c.ink; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(xd, 0); ctx.lineTo(xd, h); ctx.stroke();
      const ls = lin(380, 780, 201), R = ls.map((nm) => M.filmR(n0, n1, n2, s.d, nm, s.th * deg)), bare = M.filmR(n0, n2, n2, 0, 550, s.th * deg), top = Math.max(0.12, ...R) * 1.15;
      plot(cv, { x: [380, 780], y: [0, top], xl: L('波长（nm）', 'wavelength (nm)'), yl: 'R', series: [{ xs: ls, ys: R, color: c.accent, width: 2, label: L('有膜', 'with film') }, { xs: [380, 780], ys: [bare, bare], color: c.muted, dash: [4, 4], width: 1.2, label: L('没有膜', 'no film') }],
        after: ({ ctx: g, X, Y }) => { for (let nm = 380; nm < 780; nm += 4) { g.fillStyle = rgb(M.monoRGB(nm)); g.fillRect(X(nm), Y(0) - 6, X(nm + 4) - X(nm) + 1, 6); } } });
      const col = M.spectrumColor((nm) => M.filmR(n0, n1, n2, s.d, nm, s.th * deg));
      const qw = 550 / (4 * n1);
      return [[L('看到的颜色', 'Colour seen'), `${swatch(col.rgb)} ${L('亮度', 'brightness')} ${fix(100 * col.Y, 1)} %`, 1], [L('550 nm 处的反射率', 'Reflectance at 550 nm'), `${fix(100 * M.filmR(n0, n1, n2, s.d, 550, s.th * deg), 2)} %`], [L('没有膜时', 'Without the film'), `${fix(100 * bare, 2)} %`], [L('550 nm 的四分之一波长厚度 λ/(4n)', 'Quarter-wave thickness for 550 nm, λ/(4n)'), `${fix(qw, 1)} nm`], [L('两表面反射的相位差（550 nm）', 'Phase difference of the two reflections (550 nm)'), `${fix((2 * n1 * s.d * Math.cos(Math.asin(Math.sin(s.th * deg) / n1))) / 550, 2)} λ ${n1 > n0 && n1 > n2 ? L('＋半波损失', '+ half-wave loss') : ''}`]];
    },
  };

  // ── 3. 迈克耳孙干涉仪与相干长度 ─────────────────────────────────
  const SOURCES = { hene: [[[632.8, 0.0015, 1]], L('氦氖激光（单纵模）', 'He–Ne laser (single longitudinal mode)'), 2e5], na: [[[588.995, 0.012, 2], [589.592, 0.012, 1]], L('钠灯 D 双线（强度约 2 : 1）', 'Sodium lamp D doublet (intensities about 2 : 1)'), 3000], hg: [[[546.074, 0.02, 1]], L('汞灯绿线 546 nm', 'Mercury green line, 546 nm'), 15000], led: [[[525, 35, 1]], L('绿色 LED', 'Green LED'), 30], white: [[[560, 250, 1]], L('白光（当作一个很宽的高斯谱）', 'White light (treated as one very broad Gaussian)'), 4] };
  const envelope = (lines, D) => { let re = 0, im = 0, W = 0; for (const [l0, fw, a] of lines) { const sig = 1e3 / l0, sd = (1e3 * fw) / (l0 * l0) / 2.3548200450309493, g = a * Math.exp(-2 * Math.PI * Math.PI * sd * sd * D * D); re += g * Math.cos(2 * Math.PI * sig * D); im += g * Math.sin(2 * Math.PI * sig * D); W += a; } return Math.hypot(re, im) / W; };
  DEMOS.michelson = {
    title: L('迈克耳孙干涉仪：条纹能拉多远，就是光源的相干长度', 'Michelson interferometer: how far the fringes last is the coherence length of the source'), kind: 'exact',
    intro: L('一束光分成两路，走过不同的路程再合起来。移动一面镜子，光程差 Δ 改变一个波长，探测器上的光强就亮暗一次。光源的谱越窄，条纹在越大的 Δ 上还看得见。钠灯有两条靠得很近的谱线，条纹的清晰度会周期性地消失又出现（拍）。把条纹随 Δ 的变化做傅里叶变换就得到光谱，这就是傅里叶变换红外光谱仪的原理。', 'A beam is split in two, the halves travel different distances and are recombined. Move one mirror so that the path difference Δ changes by one wavelength and the detector goes bright and dark once. The narrower the spectrum of the source, the larger the Δ at which fringes are still visible. A sodium lamp has two close lines, so the fringe visibility periodically disappears and returns (beats). Fourier-transforming the fringes as a function of Δ gives the spectrum: that is how a Fourier-transform infrared spectrometer works.'),
    sel: [['src', L('光源', 'Source'), Object.entries(SOURCES).map(([k, v]) => [k, v[1]]), 'na']],
    ctl: [['pos', L('光程差 Δ 选在右图横轴的哪里（平方刻度）', 'Where Δ sits on the right-hand axis (square-law slider)'), 0, 1000, 1, 300, (v) => `${(((v / 1000) ** 2) * 100).toFixed(1)} %`]],
    figs: [[0.32, L('探测器上的光强随光程差的变化（选中位置附近 ±3 μm）。', 'Intensity at the detector against path difference (±3 μm around the chosen position).')], [0.4, L('条纹的可见度（包络）随光程差的变化；竖线是选中的位置。', 'Fringe visibility (the envelope) against path difference; the line marks the chosen position.')], [0.32, L('光源的光谱。', 'The spectrum of the source.')]],
    note: L('每条谱线当作高斯线型；可见度按两路等强、准直的光束计算。真实的激光要看它是不是单纵模，几个纵模时条纹也会拍；白光的谱远不是高斯，这里只说明“谱越宽、相干长度越短”。', 'Each line is taken as Gaussian; visibility assumes two equal, collimated beams. A real laser’s behaviour depends on whether it runs on a single longitudinal mode; several modes also produce beats. White light is far from Gaussian; it only illustrates “the broader the spectrum, the shorter the coherence length”.'),
    draw(s, [fv, ev, sv], c) {
      const [lines, , Dmax] = SOURCES[s.src], Dc = Dmax * (s.pos / 1000) ** 2;
      const xs = lin(Dc - 3, Dc + 3, 600), I = xs.map((D) => M.interferogram(lines, D));
      plot(fv, { x: [Dc - 3, Dc + 3], y: [0, 2.05], xl: L('光程差 Δ（μm）', 'path difference Δ (μm)'), yl: 'I', xf: (t) => fix(t, Dc > 100 ? 0 : 1), series: [{ xs, ys: I, color: rgb(M.monoRGB(lines[0][0])), width: 1.6 }] });
      const es = lin(0, Dmax, 900), V = es.map((D) => envelope(lines, D));
      const unit = Dmax >= 2000 ? 1000 : 1;
      plot(ev, { x: [0, Dmax / unit], y: [0, 1.05], xl: unit > 1 ? L('光程差 Δ（mm）', 'path difference Δ (mm)') : L('光程差 Δ（μm）', 'path difference Δ (μm)'), yl: L('可见度', 'visibility'), series: [{ xs: es.map((x) => x / unit), ys: V, color: c.accent, width: 1.8 }], marks: [{ x: Dc / unit, y: envelope(lines, Dc), color: c.gold }] });
      const lo = Math.min(...lines.map((l) => l[0] - 4 * l[1] - 0.6)), hi = Math.max(...lines.map((l) => l[0] + 4 * l[1] + 0.6)), ls = lin(Math.max(350, lo), Math.min(800, hi), 800);
      const S = ls.map((nm) => lines.reduce((t, [l0, fw, a]) => t + a * Math.exp(-4 * Math.LN2 * ((nm - l0) / fw) ** 2), 0));
      plot(sv, { x: [ls[0], ls[ls.length - 1]], y: [0, Math.max(...S) * 1.1], xl: L('波长（nm）', 'wavelength (nm)'), yt: [], series: [{ xs: ls, ys: S, color: c.gold, width: 1.6, fill: true }] });
      const out = [[L('光程差 Δ', 'Path difference Δ'), Dc >= 1000 ? `${fix(Dc / 1000, 3)} mm` : `${fix(Dc, 1)} μm`, 1], [L('条纹可见度', 'Fringe visibility'), fix(envelope(lines, Dc), 3), 1], [L('相干长度 λ²/Δλ', 'Coherence length λ²/Δλ'), lines.map(([l0, fw]) => { const lc = M.coherenceLength(l0, fw); return lc >= 1000 ? `${fmt(lc / 1000, 3)} mm` : `${fmt(lc, 3)} μm`; }).join('，')]];
      if (lines.length === 2) { const per = 1 / Math.abs(1e3 / lines[0][0] - 1e3 / lines[1][0]); out.push([L('拍的周期 1/(σ₁ − σ₂)', 'Beat period 1/(σ₁ − σ₂)'), L(`光程差 ${fix(per / 1000, 3)} mm（镜子移动 ${fix(per / 2000, 3)} mm）`, `${fix(per / 1000, 3)} mm of path (mirror moves ${fix(per / 2000, 3)} mm)`)]); out.push([L('可见度最低处', 'Lowest visibility'), fix((2 - 1) / (2 + 1), 3)]); }
      return out;
    },
  };

  // ── 4. 从菲涅耳到夫琅禾费 ───────────────────────────────────────
  DEMOS.fresnel = {
    title: L('从菲涅耳到夫琅禾费：同一条缝，离得越远图样越像傅里叶变换', 'From Fresnel to Fraunhofer: the same slit looks more like its Fourier transform the farther away you are'), kind: 'exact',
    intro: L('一条宽 a 的缝（或一道直边）被平行光照亮，在距离 z 的屏上看光强。靠得近时（菲涅耳数大）几乎就是几何阴影，只是边上有条纹；离得远时（菲涅耳数远小于 1）变成单缝的 sinc² 图样。这里用菲涅耳积分精确地算傍轴的衍射积分。', 'A slit of width a (or a straight edge) is lit by parallel light and the intensity is viewed on a screen at distance z. Close up (large Fresnel number) one sees almost the geometric shadow with fringes at its edges; far away (Fresnel number well below 1) it becomes the sinc² pattern of a single slit. The paraxial diffraction integral is evaluated exactly with Fresnel integrals.'),
    sel: [['geom', L('物体', 'Object'), [['slit', L('单缝', 'Slit')], ['edge', L('直边（半边挡住）', 'Straight edge (half blocked)')]], 'slit']],
    ctl: [['a', L('缝宽 a', 'Slit width a'), 0.05, 2, 0.01, 0.5, (v) => `${v.toFixed(2)} mm`], ['lam', L('波长 λ', 'Wavelength λ'), 400, 700, 5, 633, (v) => `${v} nm`], ['lz', L('到屏的距离 z（对数刻度）', 'Distance z to the screen (log scale)'), 1, 4.3, 0.01, 2.3, (v) => { const z = 10 ** v; return z >= 1000 ? `${(z / 1000).toFixed(2)} m` : `${z.toFixed(0)} mm`; }]],
    btn: [[L('近场：N_F ≈ 10', 'Near field: N_F ≈ 10'), { geom: 'slit', a: 1, lam: 633, lz: Math.log10(0.25 / (633e-6 * 10)) }], [L('N_F ≈ 1', 'N_F ≈ 1'), { geom: 'slit', a: 1, lam: 633, lz: Math.log10(0.25 / 633e-6) }], [L('远场：N_F ≈ 0.05', 'Far field: N_F ≈ 0.05'), { geom: 'slit', a: 0.5, lam: 633, lz: Math.log10(0.0625 / (633e-6 * 0.05)) }], [L('直边', 'Straight edge'), { geom: 'edge', lz: 3 }]],
    figs: [[0.1, L('屏上看到的样子。', 'What the screen looks like.')], [0.5, L('屏上的光强（以没有遮挡时为 1）。虚线是夫琅禾费公式，灰色阶梯是几何光学的阴影。', 'Intensity on the screen (1 = unobstructed). Dashed: the Fraunhofer formula; grey step: the geometric shadow.')]],
    note: L('傍轴（Fresnel）近似下的标量衍射，一维（缝在另一个方向上无限长）。缝宽远大于波长、离屏远大于缝宽时这个近似很好。', 'Scalar diffraction in the paraxial (Fresnel) approximation, one-dimensional (the slit is infinitely long in the other direction). The approximation is very good when the slit is much wider than the wavelength and the screen is much farther than the slit width.'),
    draw(s, [sv, cv], c) {
      const lam = s.lam * 1e-6, z = 10 ** s.lz, edge = s.geom === 'edge', a = s.a;
      const half = edge ? Math.max(1.5, 4 * Math.sqrt(lam * z)) : Math.max(1.2 * a, (2.6 * lam * z) / a, 0.6 * a + 4 * Math.sqrt(lam * z));
      const xs = lin(-half, half, 801), I = xs.map((x) => M.fresnelSlit(x, a, lam, z, edge));
      const NF = M.fresnelNumber(a, lam, z), top = Math.max(1.5, ...I) * 1.05;
      const far = edge ? [] : xs.map((x) => ((a * a) / (lam * z)) * M.sinc((Math.PI * a * x) / (lam * z)) ** 2);
      const geo = xs.map((x) => (edge ? (x > 0 ? 1 : 0) : Math.abs(x) <= a / 2 ? 1 : 0));
      const col = M.monoRGB(s.lam), { ctx, w, h } = fit(sv);
      xs.forEach((x, i) => { const t = Math.min(1, Math.sqrt(I[i] / top) * 1.3); ctx.fillStyle = `rgba(${col[0]},${col[1]},${col[2]},${t.toFixed(3)})`; ctx.fillRect((i / 801) * w, 0, w / 801 + 1, h); });
      plot(cv, { x: [-half, half], y: [0, top], xl: L('屏上的位置 x（mm）', 'position x on the screen (mm)'), yl: 'I', series: [{ xs, ys: geo, color: c.muted, width: 1, alpha: 0.7, label: L('几何阴影', 'geometric shadow') }, ...(edge ? [] : [{ xs, ys: far, color: c.gold, dash: [5, 4], width: 1.4, label: L('夫琅禾费', 'Fraunhofer') }]), { xs, ys: I, color: rgb(col), width: 2, label: L('菲涅耳（精确）', 'Fresnel (exact)') }] });
      const regime = NF > 3 ? L('近场：接近几何阴影', 'near field: close to the geometric shadow') : NF > 0.3 ? L('菲涅耳区：两边都不像', 'Fresnel region: like neither limit') : L('远场：夫琅禾费图样', 'far field: Fraunhofer pattern');
      const out = [[L('距离 z', 'Distance z'), z >= 1000 ? `${fix(z / 1000, 2)} m` : `${fix(z, 0)} mm`, 1], [L('菲涅耳数 N_F', 'Fresnel number N_F'), edge ? '—' : fmt(NF, 3), 1], [L('属于', 'Regime'), edge ? L('直边：边缘处的光强永远是 1/4', 'straight edge: the intensity at the edge is always 1/4') : regime]];
      if (!edge) out.push([L('夫琅禾费的中央亮纹全宽 2λz/a', 'Fraunhofer central-maximum width 2λz/a'), `${fmt((2 * lam * z) / a, 3)} mm`]);
      out.push([L('几何边界上的光强', 'Intensity at the geometric edge'), fix(M.fresnelSlit(edge ? 0 : a / 2, a, lam, z, edge), 3)]);
      return out;
    },
  };

  // ── 5. 艾里斑和瑞利判据 ─────────────────────────────────────────
  let AT = null;
  const airy = (v) => { if (!AT) { AT = new Float64Array(8001); for (let i = 0; i <= 8000; i++) AT[i] = M.airyI(i * 0.005); } const x = Math.abs(v) / 0.005; if (x >= 8000) return 0; const i = Math.floor(x), f = x - i; return AT[i] * (1 - f) + AT[i + 1] * f; };
  let AI = null;
  DEMOS.airy = {
    title: L('艾里斑与瑞利判据：两颗星什么时候分得开', 'The Airy disc and the Rayleigh criterion: when two stars can be told apart'), kind: 'exact',
    intro: L('圆形透镜或望远镜的口径有限，一个点光源的像不是点，而是一个艾里斑：中央亮斑外面一圈圈暗环和亮环。两个点靠得太近，两个斑就连成一团。瑞利的约定：一个斑的中心落在另一个的第一暗环上，算刚好分得开，这时两峰之间的谷大约是峰高的 73.5 %。', 'A round lens or telescope has a finite aperture, so the image of a point source is not a point but an Airy disc: a bright core surrounded by dark and bright rings. If two points are too close the two discs merge. Rayleigh’s convention: they are just resolved when the centre of one falls on the first dark ring of the other; the dip between the peaks is then about 73.5 % of the peak height.'),
    ctl: [['sep', L('两点的间距（以瑞利距离为单位）', 'Separation (in units of the Rayleigh distance)'), 0.3, 2.5, 0.01, 1, (v) => `${v.toFixed(2)} ×`], ['D', L('口径 D（算角分辨率用）', 'Aperture D (for the angular resolution)'), 2, 10000, 1, 2400, (v) => (v >= 1000 ? `${(v / 1000).toFixed(2)} m` : `${v} mm`)], ['lam', L('波长 λ', 'Wavelength λ'), 400, 700, 5, 550, (v) => `${v} nm`]],
    chk: [['log', L('对数亮度（看得见外圈）', 'Logarithmic brightness (shows the outer rings)'), false]],
    btn: [[L('人眼（瞳孔 3 mm）', 'Human eye (3 mm pupil)'), { D: 3 }], [L('哈勃望远镜（2.4 m）', 'Hubble telescope (2.4 m)'), { D: 2400 }], [L('刚好分开', 'Just resolved'), { sep: 1 }], [L('分不开', 'Not resolved'), { sep: 0.75 }]],
    figs: [[0.5, L('两个等亮的点光源的像（非相干叠加）。', 'The image of two equally bright point sources (incoherent sum).')], [0.42, L('沿两点连线的光强：两条虚线是各自的艾里图样，实线是总和。', 'Intensity along the line through both points: the dashed curves are the individual Airy patterns, the solid curve their sum.')]],
    note: L('理想、无像差的圆孔，单色光，两个点光源互不相干（星光就是这样）；相干的两点（比如显微镜里同一束激光照亮的两个点）规律不同。“分得开”是个约定：信噪比高时用反卷积可以做得更好，信噪比低时更差。', 'An ideal, aberration-free round aperture, monochromatic light, and two mutually incoherent points (as stars are); two coherent points (say, two spots lit by the same laser in a microscope) behave differently. “Resolved” is a convention: with a high signal-to-noise ratio deconvolution can do better, and with a low one worse.'),
    draw(s, [iv, pv], c) {
      const sep = s.sep * M.AIRY_ZERO, { ctx, w, h } = fit(iv), nx = 200, ny = Math.round((nx * h) / w), R = 9;
      if (!AI || AI.nx !== nx || AI.ny !== ny) { const oc = document.createElement('canvas'); oc.width = nx; oc.height = ny; AI = { nx, ny, oc, ox: oc.getContext('2d') }; AI.img = AI.ox.createImageData(nx, ny); }
      const col = M.monoRGB(s.lam), bg = rgbOf(c.surface), Dd = AI.img.data;
      for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
        const x = ((i - nx / 2) / nx) * 2 * R * (w / h > 1 ? 1 : 1), y = ((j - ny / 2) / nx) * 2 * R, v = airy(Math.hypot(x - sep / 2, y)) + airy(Math.hypot(x + sep / 2, y));
        const t = s.log ? Math.max(0, 1 + Math.log10(v + 1e-9) / 3.5) : Math.min(1, v);
        const q = 4 * (j * nx + i); Dd[q] = bg[0] + (col[0] - bg[0]) * t; Dd[q + 1] = bg[1] + (col[1] - bg[1]) * t; Dd[q + 2] = bg[2] + (col[2] - bg[2]) * t; Dd[q + 3] = 255;
      }
      AI.ox.putImageData(AI.img, 0, 0); ctx.imageSmoothingEnabled = true; ctx.drawImage(AI.oc, 0, 0, w, h);
      const vs = lin(-R, R, 801), a1 = vs.map((v) => airy(v - sep / 2)), a2 = vs.map((v) => airy(v + sep / 2)), sum = vs.map((v, i) => a1[i] + a2[i]);
      const peak = Math.max(...sum), mid = airy(sep / 2) * 2, dip = mid / peak;
      plot(pv, { x: [-R, R], y: s.log ? [-3.5, 0.4] : [0, Math.max(1.1, peak * 1.05)], logy: s.log, xl: 'v = π D sin θ / λ', yl: 'I', series: [{ xs: vs, ys: a1, color: c.muted, dash: [4, 4], width: 1.2 }, { xs: vs, ys: a2, color: c.muted, dash: [4, 4], width: 1.2 }, { xs: vs, ys: sum, color: rgb(col), width: 2 }], marks: [{ x: 0, y: s.log ? mid : mid, color: c.gold }] });
      const th = (1.22 * s.lam * 1e-9) / (s.D * 1e-3), arcsec = (th * 180 * 3600) / Math.PI;
      return [[L('谷 / 峰', 'Dip / peak'), dip < 0.999 ? `${fix(100 * dip, 1)} %` : L('没有谷：分不开', 'no dip: not resolved'), 1], [L('瑞利极限 θ = 1.22 λ/D', 'Rayleigh limit θ = 1.22 λ/D'), arcsec >= 1 ? `${fmt(arcsec, 3)}″` : `${fmt(arcsec * 1000, 3)} mas`], [L('现在的两点间距', 'Present separation'), arcsec * s.sep >= 1 ? `${fmt(arcsec * s.sep, 3)}″` : `${fmt(arcsec * s.sep * 1000, 3)} mas`], [L('艾里斑里集中的能量', 'Energy in the central disc'), '83.8 %']];
    },
  };

  // ── 6. 光栅光谱仪 ─────────────────────────────────────────────
  const LINES = { na: [[[588.995, 2], [589.592, 1]], L('钠 D 双线', 'Sodium D doublet'), 589.29, 1.6], hg: [[[404.656, 0.6], [435.833, 1], [546.074, 1], [576.96, 0.5], [579.066, 0.5]], L('汞灯（含黄双线 577/579）', 'Mercury lamp (with the yellow doublet 577/579)'), 578, 4], h: [[[656.28, 1], [486.13, 0.5], [434.05, 0.3], [410.17, 0.2]], L('氢的巴耳末线 Hα–Hδ', 'Hydrogen Balmer lines Hα–Hδ'), 656.28, 1.5] };
  DEMOS.grating = {
    title: L('光栅光谱仪：缝越多，谱线越细', 'The grating spectrometer: the more slits, the sharper the lines'), kind: 'exact',
    intro: L('光栅是成千上万条等间距的缝。各条缝来的光在 d sin θ = mλ 的方向上全部同相，形成很亮很细的主极大；不同波长落在不同角度上，这就是光谱。缝数 N 决定谱线有多细：第 m 级能分开的最小波长差是 λ/(mN)。把 N 调小，看钠的两条 D 线什么时候并成一条。', 'A grating is thousands of equally spaced slits. Light from all of them is in phase in the directions d sin θ = mλ, giving very bright, very narrow principal maxima; different wavelengths land at different angles, which is a spectrum. The number of slits N sets how narrow the lines are: in order m the smallest resolvable wavelength difference is λ/(mN). Reduce N and watch when the two sodium D lines merge.'),
    sel: [['src', L('光源', 'Source'), Object.entries(LINES).map(([k, v]) => [k, v[1]]), 'na'], ['view', L('看', 'View'), [['zoom', L('放大第 m 级的那一段', 'Zoom into order m')], ['full', L('全部级次', 'All orders')]], 'zoom']],
    ctl: [['g', L('刻线密度', 'Groove density'), 100, 1800, 50, 600, (v) => `${v} /mm`], ['logN', L('被照亮的缝数 N（对数刻度）', 'Illuminated slits N (log scale)'), 1, 4, 0.02, 3, (v) => String(Math.round(10 ** v))], ['m', L('级次 m', 'Order m'), 1, 3, 1, 1, (v) => String(v)], ['duty', L('缝宽 / 周期', 'Slit width / period'), 0.1, 0.9, 0.05, 0.5, (v) => v.toFixed(2)]],
    btn: [[L('N = 500：钠双线刚好分不开', 'N = 500: sodium doublet just unresolved'), { src: 'na', view: 'zoom', logN: Math.log10(500), m: 1 }], [L('N = 2000：清楚地分开', 'N = 2000: clearly resolved'), { src: 'na', view: 'zoom', logN: Math.log10(2000), m: 1 }], [L('换到第 2 级', 'Go to order 2'), { m: 2 }]],
    figs: [[0.45, L('探测器上的光强（按各条谱线的颜色画）。放大时横轴换算成波长。', 'Intensity at the detector (drawn in the colour of each line). When zoomed the axis is converted to wavelength.')]],
    note: L('夫琅禾费近似、平面波正入射、等宽的矩形缝，没有考虑闪耀和实际刻线的误差。谱线本身当作无限窄；真实谱仪里狭缝宽度、像差和探测器像素也会把谱线展宽。', 'Fraunhofer approximation, a plane wave at normal incidence, rectangular slits of equal width; blaze and ruling errors are not included. The lines themselves are taken as infinitely narrow; in a real spectrometer the entrance slit, aberrations and detector pixels broaden them too.'),
    draw(s, [cv], c) {
      const [lines, , lc, hw] = LINES[s.src], d = 1e6 / s.g, N = Math.round(10 ** s.logN), a = s.duty * d, out = [];
      if (s.view === 'full') {
        const series = [];
        for (const [l, A] of lines) { const xs = [], ys = []; for (let m = -Math.floor(d / l); m <= Math.floor(d / l); m++) { const sn = (m * l) / d; xs.push(sn); ys.push(A * M.slitI(a, l, sn)); } series.push({ xs, ys, sticks: true, width: 2.4, color: rgb(M.monoRGB(l)) }); }
        plot(cv, { x: [-1, 1], y: [0, 2.2], xl: 'sin θ', yl: 'I', series });
      } else {
        const sl = lin(lc - hw, lc + hw, 1400), sn = sl.map((l) => (s.m * l) / d);
        if (Math.max(...sn) >= 1) { plot(cv, { x: [lc - hw, lc + hw], y: [0, 1], xl: L('波长（nm）', 'wavelength (nm)'), texts: [{ x: lc, y: 0.5, s: L('这一级不存在（mλ > d）', 'this order does not exist (mλ > d)'), align: 'center' }] }); }
        else {
          const series = lines.filter(([l]) => l > lc - hw * 1.5 && l < lc + hw * 1.5).map(([l, A]) => ({ xs: sl, ys: sn.map((x) => A * M.multiI(N, a, d, l, x)), color: rgb(M.monoRGB(l)), width: 1.6, fill: true }));
          const tot = sl.map((_, i) => series.reduce((t, q) => t + q.ys[i], 0));
          plot(cv, { x: [lc - hw, lc + hw], y: [0, Math.max(...tot, 1e-6) * 1.12], xl: L(`第 ${s.m} 级处的波长刻度（nm）`, `wavelength scale in order ${s.m} (nm)`), yl: 'I', series: [...series, { xs: sl, ys: tot, color: c.ink, width: 1.2, label: L('总和', 'sum') }] });
        }
      }
      const R = M.resolvingPower(s.m, N), th = M.gratingAngle(d, lc, s.m);
      out.push([L('分辨本领 R = mN', 'Resolving power R = mN'), String(R), 1], [L('能分开的最小波长差 λ/R', 'Smallest resolvable Δλ = λ/R'), `${fmt(lc / R, 3)} nm`, 1]);
      if (s.src === 'na') out.push([L('分开钠双线（0.597 nm）需要', 'To resolve the sodium doublet (0.597 nm)'), L(`N ≥ ${Math.ceil(589.29 / 0.597 / s.m)}`, `N ≥ ${Math.ceil(589.29 / 0.597 / s.m)}`)], [L('现在', 'Now'), lc / R <= 0.597 ? L('分得开', 'resolved') : L('分不开', 'not resolved')]);
      out.push([L(`第 ${s.m} 级的衍射角`, `Diffraction angle, order ${s.m}`), Number.isFinite(th) ? `${fix(th / deg, 2)}°` : L('不存在', 'does not exist')], [L('最高级次', 'Highest order'), String(Math.floor(d / lc))], [L('角色散 dθ/dλ', 'Angular dispersion dθ/dλ'), Number.isFinite(th) ? `${fmt((s.m / (d * Math.cos(th))) * (180 / Math.PI) * 60, 3)}′ / nm` : '—']);
      return out;
    },
  };

  // ── 7. 布拉格：一层层原子面的反射怎样叠起来 ───────────────────────
  DEMOS.bragg = {
    title: L('布拉格反射：N 层原子面的子波什么时候同相', 'Bragg reflection: when the wavelets from N planes of atoms are in phase'), kind: 'exact',
    intro: L('X 射线照到晶体上，每一层原子面都反射一点点。相邻两层反射的光程差是 2d sin θ。只有它正好是波长的整数倍时，N 层的小箭头才排成一条直线、合成一支长箭头；稍微偏离，箭头就卷成一个圈，几乎抵消。层数越多，峰越尖。这是站长的衍射动画里“晶体布拉格衍射”那一页的意思。', 'X-rays strike a crystal and each plane of atoms reflects a little. The path difference between reflections from neighbouring planes is 2d sin θ. Only when it is a whole number of wavelengths do the N small arrows line up into one long resultant; slightly off, the arrows curl into a circle and almost cancel. The more planes, the sharper the peak. This is the “Bragg diffraction in crystals” page of the site owner’s diffraction animation.'),
    ctl: [['th', L('掠射角 θ', 'Glancing angle θ'), 1, 89, 0.05, 22.65, (v) => `${v.toFixed(2)}°`], ['dsp', L('晶面间距 d', 'Plane spacing d'), 1, 5, 0.01, 2, (v) => `${v.toFixed(2)} Å`], ['lam', L('波长 λ', 'Wavelength λ'), 0.5, 2.5, 0.001, 1.5406, (v) => `${v.toFixed(3)} Å`], ['N', L('层数 N', 'Number of planes N'), 2, 40, 1, 8, (v) => String(v)]],
    btn: [[L('对准第一级', 'Tune to first order'), { th: -1 }], [L('稍微偏一点', 'Slightly off'), { th: -2 }], [L('铜靶 Kα', 'Copper Kα'), { lam: 1.5406 }], [L('钼靶 Kα', 'Molybdenum Kα'), { lam: 0.7107 }]],
    changed(s) { const b = Math.asin(Math.min(1, s.lam / (2 * s.dsp))) / deg; if (s.th === -1) s.th = Number(b.toFixed(2)); if (s.th === -2) s.th = Number((b + 0.8 * (Math.asin(Math.min(1, s.lam / (2 * s.dsp * Math.cos(b * deg) * s.N))) / deg)).toFixed(2)); },
    figs: [[0.42, L('反射强度 |Σ|²/N² 随掠射角的变化；竖线是现在的角度。', 'Reflected intensity |Σ|²/N² against glancing angle; the line marks the present angle.')], [0.55, L('示意图：入射线和反射线，相邻两层的光程差（金色）是 2d sin θ。', 'Sketch: incident and reflected rays; the extra path between neighbouring planes (gold) is 2d sin θ.')], [0.55, L('矢量图：每层一支箭头。', 'Phasor diagram: one arrow per plane.')]],
    note: L('运动学近似：每层只反射一点点，不计多次反射和吸收（动力学衍射在完美的大晶体里会改变峰形）。层当作完全一样的散射体，不涉及层内原子怎样排（那是结构因子，见粉末衍射演示）。', 'Kinematic approximation: each plane reflects only a little, multiple reflections and absorption are ignored (dynamical diffraction changes the peak shape in large perfect crystals). The planes are treated as identical scatterers; how atoms sit within a plane (the structure factor) is in the powder-diffraction demo.'),
    draw(s, [pv, gv, fv], c) {
      const ths = lin(2, 89.5, 1500), I = ths.map((t) => M.braggLayers(s.N, s.dsp, s.lam, t * deg)), now = M.braggLayers(s.N, s.dsp, s.lam, s.th * deg);
      const peaks = []; for (let m = 1; m * s.lam <= 2 * s.dsp; m++) peaks.push(Math.asin((m * s.lam) / (2 * s.dsp)) / deg);
      plot(pv, { x: [2, 90], y: [0, 1.08], xl: L('掠射角 θ（度）', 'glancing angle θ (degrees)'), yl: 'I', series: [{ xs: ths, ys: I, color: c.accent, width: 1.6 }], marks: [{ x: s.th, y: now, color: c.gold }] });
      // 示意图
      const { ctx, w, h } = fit(gv), nl = Math.min(6, s.N), gap = Math.min(24, (h * 0.5) / nl), y0 = h - (nl - 0.5) * gap - 6, th = s.th * deg, cx = w / 2;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1;
      for (let i = 0; i < nl; i++) { const y = y0 + i * gap; ctx.beginPath(); ctx.moveTo(18, y); ctx.lineTo(w - 18, y); ctx.stroke(); ctx.fillStyle = c.ink2; for (let x = 24; x < w - 18; x += 22) { ctx.beginPath(); ctx.arc(x, y, 2.6, 0, 2 * Math.PI); ctx.fill(); } }
      const dx = Math.cos(th), dy = Math.sin(th), len = Math.min(w * 0.42, 220, (y0 - 22) / Math.max(dy, 0.01));
      for (let i = 0; i < 2; i++) { const y = y0 + i * gap, col = i ? c.accent : c.info || c.accent; arrow(ctx, cx - len * dx, y - len * dy, cx, y, col, 1.8); arrow(ctx, cx, y, cx + len * dx, y - len * dy, col, 1.8); }
      ctx.strokeStyle = c.gold; ctx.lineWidth = 3; const x1 = cx - gap * Math.sin(th) * Math.cos(th) * 1, y1p = y0 + gap * Math.sin(th) ** 2;
      ctx.beginPath(); ctx.moveTo(x1, y1p); ctx.lineTo(cx, y0 + gap); ctx.lineTo(cx + (cx - x1), y1p); ctx.stroke();
      ctx.fillStyle = c.ink; ctx.font = font(12, 600); ctx.textAlign = 'left'; ctx.fillText(`d = ${s.dsp.toFixed(2)} Å`, 22, y0 + gap / 2 + 4); ctx.fillText(`θ = ${s.th.toFixed(2)}°`, cx + 10, y0 - 8);
      const mag = phasorChain(fv, M.braggPhasors(s.N, s.dsp, s.lam, th), c, { label: `2d sin θ / λ = ${fix((2 * s.dsp * Math.sin(th)) / s.lam, 3)}`, min: 0.3 });
      return [[L('2d sin θ / λ', '2d sin θ / λ'), fix((2 * s.dsp * Math.sin(th)) / s.lam, 3), 1], [L('反射强度 |Σ|²/N²', 'Reflected intensity |Σ|²/N²'), fix(mag * mag, 3), 1], [L('布拉格角 θ_m', 'Bragg angles θ_m'), peaks.length ? peaks.map((t, i) => `${i + 1}: ${fix(t, 2)}°`).join('，') : L('没有（λ > 2d）', 'none (λ > 2d)')], [L('峰的半宽（第一级，约）', 'Peak half-width (first order, approx.)'), peaks.length ? `${fix(((0.443 * s.lam) / (s.N * s.dsp * Math.cos(peaks[0] * deg))) / deg, 3)}°` : '—']];
    },
  };

  // ── 8. 粉末 X 射线衍射 ────────────────────────────────────────
  const XNAMES = { Cu: L('铜（面心立方）', 'Copper (fcc)'), Al: L('铝（面心立方）', 'Aluminium (fcc)'), Fe: L('α-铁（体心立方）', 'α-Iron (bcc)'), W: L('钨（体心立方）', 'Tungsten (bcc)'), Si: L('硅（金刚石结构）', 'Silicon (diamond)'), C: L('金刚石', 'Diamond'), NaCl: L('氯化钠（岩盐）', 'Sodium chloride (rock salt)'), KCl: L('氯化钾（岩盐）', 'Potassium chloride (rock salt)'), CsCl: L('氯化铯', 'Caesium chloride') };
  const RULE = { fcc: L('面心：h、k、l 全奇或全偶才出现', 'fcc: h, k, l all odd or all even'), bcc: L('体心：h + k + l 为偶数才出现', 'bcc: h + k + l even'), diamond: L('金刚石：面心的规则，再去掉 h + k + l = 4n + 2', 'diamond: the fcc rule, minus h + k + l = 4n + 2'), rocksalt: L('岩盐：面心的规则；全奇的峰 ∝ (f₊ − f₋)²，全偶的 ∝ (f₊ + f₋)²', 'rock salt: the fcc rule; all-odd peaks ∝ (f₊ − f₋)², all-even ∝ (f₊ + f₋)²'), cscl: L('简单立方：全部出现；h + k + l 为奇数的峰 ∝ (f_Cs − f_Cl)²', 'simple cubic: all present; h + k + l odd peaks ∝ (f_Cs − f_Cl)²') };
  const XLAM = { cu: [1.5406, L('铜靶 Kα₁（1.5406 Å）', 'Cu Kα₁ (1.5406 Å)')], mo: [0.70932, L('钼靶 Kα₁（0.7093 Å）', 'Mo Kα₁ (0.7093 Å)')], co: [1.78897, L('钴靶 Kα₁（1.7890 Å）', 'Co Kα₁ (1.7890 Å)')] };
  DEMOS.powder = {
    title: L('粉末 X 射线衍射：峰的位置说晶胞，峰的强度说原子怎样排', 'Powder X-ray diffraction: peak positions give the cell, intensities give the arrangement'), kind: 'exact',
    intro: L('粉末里的小晶粒朝向各异，每族晶面 (hkl) 总有一些晶粒处在布拉格角上，所以探测器扫过 2θ 时依次记下一个个峰。立方晶系里 d = a/√(h² + k² + l²)。哪些峰出现、多强，由晶胞里原子的位置（结构因子）决定。试一下氯化钾：K⁺ 和 Cl⁻ 都有 18 个电子，全奇的峰几乎消失，图样看起来像简单立方。', 'The small grains of a powder point every which way, so for each family of planes (hkl) some grains sit at the Bragg angle and the detector records one peak after another as it sweeps 2θ. For a cubic cell d = a/√(h² + k² + l²). Which peaks appear, and how strongly, depends on where the atoms sit in the cell (the structure factor). Try potassium chloride: K⁺ and Cl⁻ both have 18 electrons, the all-odd peaks nearly vanish and the pattern looks simple cubic.'),
    sel: [['cr', L('晶体', 'Crystal'), Object.entries(XNAMES).map(([k, v]) => [k, v]), 'Cu'], ['src', L('X 射线', 'X-rays'), Object.entries(XLAM).map(([k, v]) => [k, v[1]]), 'cu']],
    ctl: [['logL', L('晶粒大小（对数刻度）', 'Crystallite size (log scale)'), 0.6, 2.5, 0.01, 1.7, (v) => `${(10 ** v).toFixed(0)} nm`]],
    chk: [['lab', L('标出 hkl', 'Label hkl'), true]],
    btn: [[L('NaCl 和 KCl 对比：先 NaCl', 'Compare NaCl and KCl: NaCl first'), { cr: 'NaCl' }], [L('再 KCl', 'then KCl'), { cr: 'KCl' }], [L('纳米晶（5 nm）：峰变宽', 'Nanocrystals (5 nm): broad peaks'), { logL: Math.log10(5) }]],
    figs: [[0.5, L('计算的粉末衍射图（最高的峰记 100；峰下的面积正比于峰表里的强度 I）。', 'Computed powder pattern (tallest peak = 100; the area under each peak is proportional to its intensity I in the table).')], ['html', L('峰表', 'Peak table')]],
    note: L('强度 = 多重度 × |F|² × 洛伦兹–偏振因子 × Debye–Waller 因子；原子散射因子用谱图馆同一张表里的系数（Cromer–Mann 式，来自 pymatgen）。没有计入反常散射、样品吸收和择优取向，所以相对强度和 ICDD 卡片可能差几成，高角度的峰往往算得偏强（峰位是准的）。峰形是高斯：宽度由 Scherrer 公式（K = 0.9）和 0.08° 的仪器展宽合成。', 'Intensity = multiplicity × |F|² × Lorentz–polarisation factor × Debye–Waller factor; atomic scattering factors use the coefficients from the same table as the Spectra Hall (Cromer–Mann form, from pymatgen). Anomalous scattering, absorption and preferred orientation are not included, so relative intensities can differ from ICDD cards by tens of per cent, with high-angle peaks often computed too strong (peak positions are accurate). Peaks are Gaussian, with a width combining the Scherrer formula (K = 0.9) and 0.08° of instrumental broadening.'),
    draw(s, [cv, tv], c) {
      const cr = M.CRYSTALS[s.cr], lam = XLAM[s.src][0], P = M.powderPeaks(cr, lam, 120), Lnm = 10 ** s.logL;
      const xs = lin(10, 120, 2200), ys = xs.map(() => 0);
      for (const p of P) { const fw = Math.hypot(M.scherrer(Lnm, lam, p.tt), 0.08), sg = fw / 2.3548; for (let i = 0; i < xs.length; i++) { const z = (xs[i] - p.tt) / sg; if (Math.abs(z) < 6) ys[i] += (p.I * Math.exp(-0.5 * z * z) * 0.08) / fw; } }
      const ymax = Math.max(...ys, 1e-9); for (let i = 0; i < ys.length; i++) ys[i] *= 100 / ymax; const hk = 100 / ymax, top = 115;
      plot(cv, { x: [10, 120], y: [0, top], xl: L('2θ（度）', '2θ (degrees)'), yl: L('强度', 'intensity'), series: [{ xs, ys, color: c.accent, width: 1.4, fill: true }], texts: s.lab ? P.filter((p) => p.tt <= 120 && p.I > 0.5).map((p) => ({ x: p.tt, y: Math.min(top * 0.93, (hk * p.I * 0.08) / Math.hypot(M.scherrer(Lnm, lam, p.tt), 0.08) + top * 0.04), s: p.hkl.join(''), align: 'center', color: c.ink2 })) : [] });
      tv.innerHTML = `<table class="opt-peaks"><thead><tr><th>hkl</th><th>d (Å)</th><th>2θ (°)</th><th>${L('多重度', 'mult.')}</th><th>I</th></tr></thead><tbody>${P.slice(0, 10).map((p) => `<tr${p.I < 1 ? ' class="is-weak"' : ''}><td>${p.hkl.join('')}</td><td>${p.d.toFixed(4)}</td><td>${p.tt.toFixed(2)}</td><td>${p.mult}</td><td>${p.I.toFixed(1)}</td></tr>`).join('')}</tbody></table>`;
      const best = P.reduce((a, b) => (b.I > a.I ? b : a));
      return [[L('晶胞参数 a', 'Lattice parameter a'), `${cr.a} Å`, 1], [L('最强峰', 'Strongest peak'), `(${best.hkl.join('')}) 2θ = ${fix(best.tt, 2)}°`, 1], [L('消光规则', 'Extinction rule'), RULE[cr.type]], [L('第一个峰的 Scherrer 宽度', 'Scherrer width of the first peak'), `${fix(M.scherrer(Lnm, lam, P[0].tt), 3)}°`]];
    },
  };

  // ── 9. 菲涅耳公式：反射、布儒斯特角、全反射 ───────────────────────
  const PAIRS = { ag: [1, 1.5, L('空气 → 玻璃（n = 1.5）', 'Air → glass (n = 1.5)')], aw: [1, 1.333, L('空气 → 水', 'Air → water')], ad: [1, 2.417, L('空气 → 金刚石', 'Air → diamond')], ga: [1.5, 1, L('玻璃 → 空气（会全反射）', 'Glass → air (total internal reflection)')], wa: [1.333, 1, L('水 → 空气', 'Water → air')] };
  DEMOS.reflect = {
    title: L('菲涅耳公式：反射有多少，为什么偏振太阳镜能挡掉水面的反光', 'Fresnel’s equations: how much is reflected, and why polarised sunglasses cut glare from water'), kind: 'exact',
    intro: L('光射到两种介质的界面上，一部分反射、一部分折射。反射了多少取决于入射角和偏振：电场垂直于入射面的 s 分量，和在入射面里的 p 分量。在布儒斯特角上 p 分量一点也不反射，反射光全是 s 偏振的（水平的）；从光密射向光疏，超过临界角就全反射。', 'Light meeting the boundary between two media is partly reflected and partly refracted. How much is reflected depends on the angle and the polarisation: the s component, with the electric field perpendicular to the plane of incidence, and the p component, in that plane. At Brewster’s angle none of the p component is reflected, so the reflection is purely s-polarised (horizontal); going from a denser to a rarer medium, beyond the critical angle everything is reflected.'),
    sel: [['pair', L('界面', 'Interface'), Object.entries(PAIRS).map(([k, v]) => [k, v[2]]), 'ag']],
    ctl: [['th', L('入射角 θ', 'Angle of incidence θ'), 0, 89.5, 0.1, 30, (v) => `${v.toFixed(1)}°`]],
    btn: [[L('布儒斯特角', 'Brewster’s angle'), { th: -1 }], [L('临界角外一点', 'Just past the critical angle'), { pair: 'ga', th: 43 }], [L('正入射', 'Normal incidence'), { th: 0 }]],
    changed(s) { if (s.th === -1) { const [n1, n2] = PAIRS[s.pair]; s.th = Number((M.brewster(n1, n2) / deg).toFixed(1)); } },
    figs: [[0.55, L('光路：线的粗细和不透明度按功率画。', 'Ray picture: line width and opacity follow the power.')], [0.5, L('s、p 偏振和自然光的反射率随入射角的变化。', 'Reflectance of s, p and unpolarised light against the angle of incidence.')]],
    note: L('两种介质都是无吸收、各向同性、非磁性的，折射率不随波长变。金属和吸收介质要用复折射率，规律不同。', 'Both media are non-absorbing, isotropic and non-magnetic, with wavelength-independent indices. Metals and absorbing media need complex indices and behave differently.'),
    draw(s, [rv, cv], c) {
      const [n1, n2] = PAIRS[s.pair], th = s.th * deg, F = M.fresnel(n1, n2, th), R = (F.Rs + F.Rp) / 2, { ctx, w, h } = fit(rv), cx = w / 2, cy = h / 2, Lr = Math.min(w, h) * 0.45;
      ctx.fillStyle = c.line; ctx.globalAlpha = n2 > n1 ? 0.5 : 0.2; ctx.fillRect(0, cy, w, h - cy); ctx.globalAlpha = n1 > n2 ? 0.5 : 0.2; ctx.fillRect(0, 0, w, cy); ctx.globalAlpha = 1;
      ctx.strokeStyle = c.ink2; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(cx, 8); ctx.lineTo(cx, h - 8); ctx.stroke(); ctx.setLineDash([]);
      const ray = (x0, y0, x1, y1, p) => { ctx.globalAlpha = 0.25 + 0.75 * Math.min(1, p * 1.2); arrow(ctx, x0, y0, x1, y1, c.accent, 1 + 5 * p); ctx.globalAlpha = 1; };
      ray(cx - Lr * Math.sin(th), cy - Lr * Math.cos(th), cx, cy, 1);
      ray(cx, cy, cx + Lr * Math.sin(th), cy - Lr * Math.cos(th), R);
      if (!F.tir) ray(cx, cy, cx + Lr * Math.sin(F.tt), cy + Lr * Math.cos(F.tt), 1 - R);
      ctx.fillStyle = c.ink; ctx.font = font(12, 600); ctx.textAlign = 'left'; ctx.fillText(`n₁ = ${n1}`, 10, 18); ctx.fillText(`n₂ = ${n2}`, 10, h - 10);
      const ts = lin(0, 89.9, 600), Fs = ts.map((t) => M.fresnel(n1, n2, t * deg));
      const thB = M.brewster(n1, n2) / deg, thC = M.critical(n1, n2) / deg;
      plot(cv, { x: [0, 90], y: [0, 1.04], xl: L('入射角（度）', 'angle of incidence (degrees)'), yl: 'R', series: [{ xs: ts, ys: Fs.map((f) => f.Rs), color: c.accent, width: 1.8, label: 's' }, { xs: ts, ys: Fs.map((f) => f.Rp), color: c.gold, width: 1.8, label: 'p' }, { xs: ts, ys: Fs.map((f) => (f.Rs + f.Rp) / 2), color: c.muted, dash: [4, 4], width: 1.2, label: L('自然光', 'unpolarised') }], marks: [{ x: s.th, y: R, color: c.ink }, { x: thB, color: c.ok }, ...(Number.isFinite(thC) ? [{ x: thC, color: c.danger }] : [])] });
      return [[L('反射率 R_s / R_p', 'Reflectance R_s / R_p'), `${fix(100 * F.Rs, 2)} % / ${fix(100 * F.Rp, 2)} %`, 1], [L('折射角', 'Angle of refraction'), F.tir ? L('全反射', 'total internal reflection') : `${fix(F.tt / deg, 2)}°`], [L('布儒斯特角 arctan(n₂/n₁)', 'Brewster’s angle arctan(n₂/n₁)'), `${fix(thB, 2)}°`], [L('临界角 arcsin(n₂/n₁)', 'Critical angle arcsin(n₂/n₁)'), Number.isFinite(thC) ? `${fix(thC, 2)}°` : L('没有（n₁ < n₂）', 'none (n₁ < n₂)')], [L('反射光的偏振度', 'Degree of polarisation of the reflection'), F.Rs + F.Rp > 0 ? fix(Math.abs(F.Rs - F.Rp) / (F.Rs + F.Rp), 3) : '—']];
    },
  };

  // ── 10. 偏振片和波片（Jones 矩阵）───────────────────────────────
  const INPUTS = { unpol: [null, L('自然光（非偏振）', 'Unpolarised light')], h: [[[1, 0], [0, 0]], L('水平线偏振', 'Horizontal linear')], v: [[[0, 0], [1, 0]], L('竖直线偏振', 'Vertical linear')], d: [[[Math.SQRT1_2, 0], [Math.SQRT1_2, 0]], L('45° 线偏振', '45° linear')], ccw: [[[Math.SQRT1_2, 0], [0, Math.SQRT1_2]], L('圆偏振（迎着光看逆时针转）', 'Circular (anticlockwise, facing the beam)')] };
  const ELS = [['none', L('（空）', '(empty)')], ['pol', L('偏振片', 'Polariser')], ['qwp', L('四分之一波片', 'Quarter-wave plate')], ['hwp', L('半波片', 'Half-wave plate')]];
  const describe = (st) => {
    if (!st || st.unpol) return L('非偏振', 'unpolarised');
    const e = M.ellipse(st.v); if (e.S0 < 1e-9) return L('没有光', 'no light');
    const r = Math.abs(Math.tan(e.chi));
    if (r < 0.02) return L(`线偏振，${fix(((e.psi / deg) + 180) % 180, 1)}°`, `linear, ${fix(((e.psi / deg) + 180) % 180, 1)}°`);
    const dir = e.S3 > 0 ? L('逆时针', 'anticlockwise') : L('顺时针', 'clockwise');
    return r > 0.98 ? L(`圆偏振，迎着光看${dir}转`, `circular, ${dir} facing the beam`) : L(`椭圆偏振（短轴/长轴 ${fix(r, 2)}，${dir}），长轴 ${fix(((e.psi / deg) + 180) % 180, 1)}°`, `elliptical (axis ratio ${fix(r, 2)}, ${dir}), major axis ${fix(((e.psi / deg) + 180) % 180, 1)}°`);
  };
  DEMOS.jones = {
    title: L('偏振片和波片：用 Jones 矩阵一片一片地算', 'Polarisers and wave plates: one element at a time with Jones matrices'), kind: 'exact',
    intro: L('偏振光的状态用一个两分量的复数矢量（Jones 矢量）表示，每个光学元件是一个 2 × 2 矩阵。两片正交的偏振片之间什么都不放，光全挡住；中间插一片 45° 的偏振片，反而有八分之一的光透过来。四分之一波片把 45° 的线偏振变成圆偏振，半波片把线偏振转过两倍的角度。', 'The polarisation state is a two-component complex vector (the Jones vector) and every optical element is a 2 × 2 matrix. Two crossed polarisers with nothing between them block all light; slip a third polariser at 45° between them and one eighth gets through. A quarter-wave plate turns 45° linear polarisation into circular, and a half-wave plate rotates linear polarisation by twice its angle.'),
    sel: [['inp', L('入射光', 'Input'), Object.entries(INPUTS).map(([k, v]) => [k, v[1]]), 'unpol'], ['e1', L('第 1 片', 'Element 1'), ELS, 'pol'], ['e2', L('第 2 片', 'Element 2'), ELS, 'pol'], ['e3', L('第 3 片', 'Element 3'), ELS, 'pol']],
    ctl: [['a1', L('第 1 片的轴', 'Axis of element 1'), 0, 180, 0.5, 0, (v) => `${v}°`], ['a2', L('第 2 片的轴', 'Axis of element 2'), 0, 180, 0.5, 45, (v) => `${v}°`], ['a3', L('第 3 片的轴', 'Axis of element 3'), 0, 180, 0.5, 90, (v) => `${v}°`]],
    btn: [[L('三片偏振片：0°、45°、90°', 'Three polarisers: 0°, 45°, 90°'), { inp: 'unpol', e1: 'pol', a1: 0, e2: 'pol', a2: 45, e3: 'pol', a3: 90 }], [L('两片正交', 'Two crossed'), { inp: 'unpol', e1: 'pol', a1: 0, e2: 'none', e3: 'pol', a3: 90 }], [L('线偏振 → 圆偏振', 'Linear → circular'), { inp: 'h', e1: 'qwp', a1: 45, e2: 'none', e3: 'none' }], [L('半波片转偏振', 'Half-wave plate rotates'), { inp: 'h', e1: 'hwp', a1: 22.5, e2: 'none', e3: 'none' }]],
    figs: [[0.3, L('每一步之后的电场轨迹（迎着光看；x 向右，y 向上）。圆点是起点，箭头是转向，大小按振幅画。', 'The path of the electric field after each step (facing the beam; x right, y up). The dot marks the start, the arrow the sense of rotation; size follows the amplitude.')]],
    note: L('理想元件：偏振片完全吸收一个方向，波片没有损耗、延迟和波长无关。自然光当作两个正交偏振的非相干等量混合，通过第一片偏振片后变成线偏振、强度减半。', 'Ideal elements: polarisers absorb one direction completely, wave plates are lossless with wavelength-independent retardance. Unpolarised light is an incoherent equal mixture of two orthogonal polarisations; after the first polariser it becomes linear with half the intensity.'),
    draw(s, [cv], c) {
      let st = INPUTS[s.inp][0] ? { v: INPUTS[s.inp][0] } : { unpol: true, I: 1 };
      const stages = [st];
      for (const [e, a] of [[s.e1, s.a1], [s.e2, s.a2], [s.e3, s.a3]]) {
        if (e === 'none') { stages.push(st); continue; }
        const t = a * deg;
        if (st.unpol) st = e === 'pol' ? { v: M.apply(M.polarizer(t), [[Math.cos(t) * Math.SQRT1_2, 0], [Math.sin(t) * Math.SQRT1_2, 0]]) } : st;
        else st = { v: M.apply(e === 'pol' ? M.polarizer(t) : M.waveplate(t, e === 'qwp' ? Math.PI / 2 : Math.PI), st.v) };
        stages.push(st);
      }
      const { ctx, w, h } = fit(cv), n = stages.length, pw = w / n, r = Math.min(pw, h) * 0.36;
      stages.forEach((q, i) => {
        const cx = pw * (i + 0.5), cy = h / 2;
        ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(cx - r - 6, cy); ctx.lineTo(cx + r + 6, cy); ctx.moveTo(cx, cy - r - 6); ctx.lineTo(cx, cy + r + 6); ctx.stroke();
        ctx.fillStyle = c.muted; ctx.font = font(11); ctx.textAlign = 'center'; ctx.fillText(i ? L(`第 ${i} 片后`, `after ${i}`) : L('入射', 'input'), cx, 14);
        if (q.unpol) { ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6; for (let k = 0; k < 4; k++) { const a = (k * Math.PI) / 4, rr = r * 0.7; arrow(ctx, cx, cy, cx + rr * Math.cos(a), cy - rr * Math.sin(a), c.accent, 1.4); arrow(ctx, cx, cy, cx - rr * Math.cos(a), cy + rr * Math.sin(a), c.accent, 1.4); } return; }
        const [ex, ey] = q.v, pts = [];
        for (let k = 0; k <= 72; k++) { const t = (k / 72) * 2 * Math.PI, x = ex[0] * Math.cos(t) + ex[1] * Math.sin(t), y = ey[0] * Math.cos(t) + ey[1] * Math.sin(t); pts.push([cx + x * r * 1.35, cy - y * r * 1.35]); }
        ctx.strokeStyle = c.accent; ctx.lineWidth = 2; ctx.beginPath(); pts.forEach(([x, y], k) => (k ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
        if (M.intensity(q.v) > 1e-6) { arrow(ctx, pts[8][0], pts[8][1], pts[11][0], pts[11][1], c.gold, 2); ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(pts[0][0], pts[0][1], 3.5, 0, 2 * Math.PI); ctx.fill(); }
      });
      const I = st.unpol ? 1 : M.intensity(st.v);
      return [[L('透过的光强（以入射为 1）', 'Transmitted intensity (input = 1)'), `${fix(I, 4)}${Math.abs(I - 0.125) < 1e-6 ? '（1/8）' : Math.abs(I - 0.5) < 1e-6 ? '（1/2）' : ''}`, 1], [L('出射光', 'Output'), describe(st), 1]];
    },
  };

  // ── 11. 光线追迹：一块真实的透镜 ────────────────────────────────
  const LENS = (k, n) => ({ sphere: [{ z: 0, R: 50, n }], pcx: [{ z: 0, R: 50, n, ap: 21 }, { z: 8, R: Infinity, n: 1 }], pcxr: [{ z: 0, R: Infinity, n }, { z: 8, R: -50, n: 1, ap: 21 }], bicx: [{ z: 0, R: 100, n, ap: 21 }, { z: 8, R: -100, n: 1, ap: 21 }] }[k]);
  const LNAMES = [['pcx', L('平凸透镜，凸面朝着平行光', 'Plano-convex, curved side towards the parallel beam')], ['pcxr', L('平凸透镜，平面朝着平行光', 'Plano-convex, flat side towards the parallel beam')], ['bicx', L('双凸透镜（同样焦距）', 'Biconvex (same focal length)')], ['sphere', L('单个折射球面（光停在玻璃里）', 'A single refracting sphere (the light stays in glass)')]];
  DEMOS.lens = {
    title: L('光线追迹：一块真实的球面透镜为什么聚不到一个点', 'Ray tracing: why a real spherical lens does not focus to a single point'), kind: 'exact',
    intro: L('几何光学是波长趋于零的极限：光沿光线走，在界面上按斯涅尔定律 n₁ sin θ₁ = n₂ sin θ₂ 折射。这里对每条平行光线逐面精确地用斯涅尔定律，不做“角度很小”的近似。离光轴越远的光线聚得越近，这就是球差。同一块平凸透镜，把凸面朝向平行光，球差小好几倍。', 'Geometric optics is the limit of vanishing wavelength: light follows rays and refracts at each surface by Snell’s law n₁ sin θ₁ = n₂ sin θ₂. Here every parallel ray is traced exactly through each surface with Snell’s law, with no small-angle approximation. Rays farther from the axis focus closer: that is spherical aberration. Turn the same plano-convex lens so its curved side faces the parallel beam and the aberration drops several-fold.'),
    sel: [['sys', L('透镜', 'Lens'), LNAMES, 'pcx']],
    ctl: [['n', L('折射率 n', 'Refractive index n'), 1.4, 1.9, 0.001, 1.5168, (v) => v.toFixed(4)], ['hmax', L('光束半径', 'Beam radius'), 2, 20, 0.5, 15, (v) => `${v} mm`], ['nr', L('光线数', 'Number of rays'), 5, 31, 2, 15, (v) => String(v)]],
    btn: [[L('凸面朝光', 'Curved side to the beam'), { sys: 'pcx' }], [L('平面朝光', 'Flat side to the beam'), { sys: 'pcxr' }], [L('细光束（傍轴）', 'Thin beam (paraxial)'), { hmax: 3 }]],
    figs: [[0.5, L('光路（mm）：金色竖线是傍轴焦点。', 'Ray paths (mm): the gold line is the paraxial focus.')], [0.42, L('纵向球差：每条光线和光轴的交点比傍轴焦点近了多少。', 'Longitudinal spherical aberration: how much closer than the paraxial focus each ray crosses the axis.')]],
    note: L('子午面里的光线，单色（不计色差），球面，曲率半径 50 mm（双凸是 100 mm）、中心厚 8 mm；焦距约 100 mm（n = 1.5 时）。傍轴焦点用一条离轴 0.001 mm 的光线追出来。', 'Meridional rays, monochromatic (no chromatic aberration), spherical surfaces of radius 50 mm (100 mm for the biconvex), 8 mm centre thickness; focal length about 100 mm at n = 1.5. The paraxial focus is found with a ray 0.001 mm off axis.'),
    draw(s, [rv, av], c) {
      const S = LENS(s.sys, s.n), f0 = M.trace(S, 1e-3).zf, hs = lin(-s.hmax, s.hmax, s.nr), zEnd = Math.min(Math.max(f0 * 1.15, 60), 400);
      const tr = hs.map((h) => M.trace(S, h, 1, -20));
      plot(rv, { x: [-20, zEnd], y: [-24, 24], eq: false, xl: 'z (mm)', yl: 'y (mm)', series: [],
        after: ({ ctx, X, Y }) => {
          // 透镜轮廓
          ctx.fillStyle = c.info || c.accent; ctx.globalAlpha = 0.12; ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.2;
          const sag = (sf, y) => (Number.isFinite(sf.R) ? sf.z + sf.R - Math.sign(sf.R) * Math.sqrt(Math.max(0, sf.R * sf.R - y * y)) : sf.z);
          if (S.length > 1) { ctx.beginPath(); for (let y = -21; y <= 21; y += 0.5) ctx.lineTo(X(sag(S[0], y)), Y(y)); for (let y = 21; y >= -21; y -= 0.5) ctx.lineTo(X(sag(S[1], y)), Y(y)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; ctx.stroke(); }
          else { ctx.beginPath(); for (let y = -21; y <= 21; y += 0.5) ctx.lineTo(X(sag(S[0], y)), Y(y)); ctx.lineTo(X(zEnd), Y(21)); ctx.lineTo(X(zEnd), Y(-21)); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; }
          ctx.globalAlpha = 1; ctx.lineWidth = 1.1; ctx.strokeStyle = c.accent;
          for (const t of tr) { ctx.beginPath(); t.pts.forEach(([z, y], i) => (i ? ctx.lineTo(X(z), Y(y)) : ctx.moveTo(X(z), Y(y)))); if (t.dir) { const [dz, dy] = t.dir, [z, y] = t.pts[t.pts.length - 1], k = (zEnd - z) / dz; ctx.lineTo(X(zEnd), Y(y + k * dy)); } ctx.stroke(); }
          ctx.strokeStyle = c.gold; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(X(f0), Y(-24)); ctx.lineTo(X(f0), Y(24)); ctx.stroke();
          ctx.strokeStyle = c.line; ctx.setLineDash([4, 4]); ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(X(-20), Y(0)); ctx.lineTo(X(zEnd), Y(0)); ctx.stroke(); ctx.setLineDash([]);
        } });
      const hh = lin(0.2, s.hmax, 60), lsa = hh.map((h) => M.trace(S, h).zf - f0);
      plot(av, { x: [0, s.hmax], y: [Math.min(-0.5, ...lsa.filter(Number.isFinite)) * 1.1, 0.2], xl: L('光线高度 h（mm）', 'ray height h (mm)'), yl: 'Δz (mm)', series: [{ xs: hh, ys: lsa, color: c.accent, width: 2 }] });
      const edge = M.trace(S, s.hmax).zf - f0, other = s.sys === 'pcx' || s.sys === 'pcxr' ? LENS(s.sys === 'pcx' ? 'pcxr' : 'pcx', s.n) : null, oe = other ? M.trace(other, s.hmax).zf - M.trace(other, 1e-3).zf : NaN;
      const out = [[L('傍轴焦点（从第一面顶点量）', 'Paraxial focus (from the first vertex)'), `${fix(f0, 2)} mm`, 1], [L('边缘光线的纵向球差', 'Longitudinal aberration of the marginal ray'), Number.isFinite(edge) ? `${fix(edge, 3)} mm` : L('光线出不去（全反射）', 'the ray does not get out (total internal reflection)'), 1]];
      if (s.sys !== 'sphere') out.push([L('磨镜者公式（薄透镜）', 'Lensmaker’s formula (thin lens)'), `${fix(s.sys === 'bicx' ? M.lensmaker(s.n, 100, -100) : M.lensmaker(s.n, 50, Infinity), 2)} mm`]);
      else out.push([L('单个球面的傍轴焦点 nR/(n − 1)', 'Paraxial focus of one surface nR/(n − 1)'), `${fix((s.n * 50) / (s.n - 1), 2)} mm`]);
      if (other && Number.isFinite(oe) && Number.isFinite(edge)) out.push([L('同一块透镜翻过来时', 'Same lens turned round'), `${fix(oe, 3)} mm（${fix(oe / edge, 2)} ×）`]);
      return out;
    },
  };

  // ── 12. 阿贝成像与相衬（4f 系统）────────────────────────────────
  DEMOS.abbe = {
    title: L('阿贝成像：物镜接住了哪些衍射级，像里就只有哪些细节', 'Abbe imaging: the image contains only the detail whose diffraction orders the objective catches'), kind: 'exact',
    intro: L('相干光照亮一个物体，物镜后焦面上出现的正好是物的傅里叶变换（各个衍射级）；像是从这些衍射级重新合成的。物镜的数值孔径 NA 只让 |空间频率| ≤ NA/λ 的部分通过。一个周期 p 的光栅，±1 级进不去，像里就只剩一片均匀的亮。透明的“相位物”（比如活细胞）在普通显微镜里几乎看不见；Zernike 在零级上加四分之一波的相位，它就显出来了。', 'Coherent light illuminates an object; the back focal plane of the objective holds exactly the Fourier transform of the object (its diffraction orders), and the image is re-synthesised from them. The objective’s numerical aperture NA passes only spatial frequencies with |f| ≤ NA/λ. For a grating of period p, if the ±1 orders do not get in, the image is a uniform glow. A transparent “phase object” such as a living cell is almost invisible in an ordinary microscope; Zernike’s quarter-wave shift of the zero order makes it visible.'),
    sel: [['obj', L('物', 'Object'), [['amp', L('振幅光栅（黑白条纹）', 'Amplitude grating (black and white bars)')], ['phase', L('相位光栅（透明，厚薄交替）', 'Phase grating (transparent, alternately thick and thin)')], ['cell', L('一个透明的“细胞”', 'A transparent “cell”')]], 'amp']],
    ctl: [['p', L('周期 p（细胞时是大小）', 'Period p (size, for the cell)'), 0.5, 8, 0.05, 2, (v) => `${v.toFixed(2)} μm`], ['na', L('数值孔径 NA', 'Numerical aperture NA'), 0.05, 1.4, 0.01, 0.4, (v) => v.toFixed(2)], ['lam', L('波长 λ', 'Wavelength λ'), 400, 700, 5, 550, (v) => `${v} nm`], ['phi', L('相位物的相位差', 'Phase step of the phase object'), 0.05, 3.14, 0.01, 0.5, (v) => `${v.toFixed(2)} rad`]],
    chk: [['zer', L('Zernike 相衬（零级移 π/2）', 'Zernike phase contrast (shift the zero order by π/2)'), false], ['dark', L('暗场（挡住零级）', 'Dark field (block the zero order)'), false]],
    btn: [[L('±1 级刚好进得去', '±1 orders just get in'), { obj: 'amp', p: 1.4, na: 0.4, lam: 550 }], [L('±1 级进不去', '±1 orders miss'), { obj: 'amp', p: 1.2, na: 0.4, lam: 550 }], [L('透明细胞：普通照明', 'Transparent cell: plain'), { obj: 'cell', p: 2, phi: 0.5, zer: false, dark: false, na: 0.6 }], [L('透明细胞：相衬', 'Transparent cell: phase contrast'), { obj: 'cell', p: 2, phi: 0.5, zer: true, dark: false, na: 0.6 }]],
    changed(s, k) { if (k === 'zer' && s.zer) s.dark = false; if (k === 'dark' && s.dark) s.zer = false; },
    figs: [[0.3, L('物：振幅透过率（实线）和相位 / π（虚线）。', 'Object: amplitude transmittance (solid) and phase / π (dashed).')], [0.34, L('物镜后焦面上的衍射级（振幅，对数刻度）；阴影外的被光阑挡掉。', 'Diffraction orders in the back focal plane (amplitude, log scale); those outside the shaded band are blocked by the stop.')], [0.3, L('像的光强。', 'Image intensity.')]],
    note: L('一维、相干照明、正入射，标量，像按放大率 1 画。512 个采样点，光栅取整 16 个周期；细胞是 6p 宽的一段均匀相位。真实的相衬显微镜用环形照明和环形相位板，原理相同。', 'One-dimensional, coherent, normal incidence, scalar, image drawn at unit magnification. 512 samples; gratings span exactly 16 periods; the cell is a uniform phase step 6p wide. Real phase-contrast microscopes use annular illumination and an annular phase ring; the principle is the same.'),
    draw(s, [ov, fv, iv], c) {
      const lam = s.lam / 1000, R = M.fourier4f({ kind: s.obj, p: s.p, phi: s.phi, lam, na: s.na, zernike: s.zer, dark: s.dark, L: 80 }), n = R.img.length, xs = Array.from({ length: n }, (_, i) => (i - n / 2) * R.dx);
      const x0 = xs[0], x1 = xs[n - 1];
      plot(ov, { x: [x0, x1], y: [-0.1, 1.15], xl: 'x (μm)', series: [{ xs, ys: Array.from(R.obj.re, (r, i) => Math.hypot(r, R.obj.im[i])), color: c.accent, width: 1.6 }, { xs, ys: Array.from(R.obj.re, (r, i) => Math.atan2(R.obj.im[i], r) / Math.PI), color: c.gold, width: 1.4, dash: [4, 3] }] });
      const order = Array.from({ length: n }, (_, k) => k).sort((a, b) => R.fx[a] - R.fx[b]), fmax = Math.min(Math.max(R.cut * 2.2, 3 / s.p), Math.abs(R.fx[n / 2]));
      const fxs = order.map((k) => R.fx[k]), amp = order.map((k) => Math.log10(R.spec[k] + 1e-6));
      plot(fv, { x: [-fmax, fmax], y: [-4, 0.2], logy: false, xl: L('空间频率 f（1/μm）', 'spatial frequency f (1/μm)'), yt: [-4, -3, -2, -1, 0], yf: (t) => (t === 0 ? '1' : `10${String(t).replace('-', '⁻').replace(/\d/g, (d) => '⁰¹²³⁴⁵⁶⁷⁸⁹'[d])}`), bands: [{ x0: -R.cut, x1: R.cut, color: c.ok, alpha: 0.14 }], series: [{ xs: fxs, ys: amp, color: c.accent, width: 1.6, sticks: s.obj !== 'cell', base: -4 }] });
      const top = Math.max(1.2, ...R.img) * 1.05;
      plot(iv, { x: [x0, x1], y: [0, top], xl: 'x (μm)', yl: 'I', series: [{ xs, ys: Array.from(R.img), color: c.accent, width: 1.8, fill: true }] });
      const mx = Math.max(...R.img), mn = Math.min(...R.img), con = mx + mn > 0 ? (mx - mn) / (mx + mn) : 0, lim = M.abbeLimit(lam, s.na);
      const out = [[L('截止频率 NA/λ', 'Cut-off frequency NA/λ'), `${fix(R.cut, 3)} / μm`], [L('阿贝极限 λ/NA（相干、正入射）', 'Abbe limit λ/NA (coherent, normal incidence)'), `${fix(lim, 3)} μm`, 1], [L('像的对比度 (I_max − I_min)/(I_max + I_min)', 'Image contrast (I_max − I_min)/(I_max + I_min)'), fix(con, 3), 1]];
      if (s.obj !== 'cell') out.push([L('通过的衍射级', 'Orders passed'), (() => { const m = Math.floor(R.cut * s.p + 1e-9); return m < 1 ? L('只有零级：像里看不到条纹', 'zero order only: no fringes in the image') : `0, ±1${m > 1 ? ` … ±${m}` : ''}`; })()]);
      return out;
    },
  };
};
