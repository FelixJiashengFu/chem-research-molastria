'use strict';
// 声子（/quasiparticles/phonons/）的十一个演示。数学都在 phonon-models.js（纯函数，tools/phonon-test.mjs 测）。phonon.js 用 window.MOLASTRIA_PHONON_DEMOS(K, DEMOS) 把它们登记进去。
// 每个演示：title，kind，intro，sel 下拉 [键, 名字, [[值, 名字]…], 初值]，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，chk 开关 [键, 名字, 初值]，
// btn 预设 [名字, { 键: 值 }]，act 动作，state，autoplay，fps + tick(s)，changed(s, 键)，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 返回读数 [[名字, 值, 是否加粗]]。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。K 是 phonon.js 给的画图工具。
window.MOLASTRIA_PHONON_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_PHONON_MODELS;
  const { L, fix, fmt, plot, fit, lin, font } = K;
  const PI = Math.PI;
  const piF = (t) => (t === 0 ? '0' : `${t < 0 ? '−' : ''}${Math.abs(t) === 1 ? '' : String(Math.abs(t))}π/a`);

  // 画一排原子：xs 是平衡位置（屏幕坐标），us 是位移（屏幕像素），cols 是颜色，rs 是半径
  function atoms(ctx, xs, y, us, cols, rs, c, springs = true) {
    if (springs) { ctx.strokeStyle = c.line; ctx.lineWidth = 1.6; ctx.beginPath(); xs.forEach((x, i) => { const X = x + us[i]; if (i) ctx.lineTo(X, y); else ctx.moveTo(X, y); }); ctx.stroke(); }
    xs.forEach((x, i) => { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(x + us[i], y, rs[i], 0, 2 * PI); ctx.fill(); });
  }

  // ── 1. 一维单原子链 ───────────────────────────────────────────
  DEMOS.chain = {
    title: L('一维原子链：一个波矢、一个频率，色散关系从哪里来', 'A one-dimensional chain: one wavevector, one frequency, and where the dispersion relation comes from'), kind: 'exact',
    intro: L('N 个质量相同的原子用弹簧连成一圈（周期边界）。选一个波矢 q，所有原子按同一个频率 ω(q) 振动、相位沿链依次推后：这就是一个简正模。下面的色散曲线上，点是这个 N 原子链真正允许的 N 个 q。打开“q 加一个倒格矢”，你会看到一条波长短得多的正弦波穿过同样的原子位置：原子之间没有东西，q 和 q + 2π/a 是同一个振动，所以只需要看第一布里渊区。', 'N identical atoms joined by springs into a ring (periodic boundary). Pick a wavevector q and every atom oscillates at the same frequency ω(q), with its phase lagging steadily along the chain: that is a normal mode. On the dispersion curve below, the dots are the N values of q that this N-atom chain actually allows. Switch on “add a reciprocal-lattice vector to q” and a much shorter sine wave passes through exactly the same atomic positions: there is nothing between the atoms, so q and q + 2π/a are the same vibration and only the first Brillouin zone matters.'),
    ctl: [['n', L('模式编号 n（q = 2πn / Na）', 'Mode number n (q = 2πn / Na)'), -10, 10, 1, 3, (v) => String(v).replace('-', '−')], ['N', L('原子数 N', 'Number of atoms N'), 6, 40, 2, 20, String], ['k2', L('次近邻弹簧 K₂ / K₁', 'Second-neighbour spring K₂ / K₁'), 0, 0.5, 0.01, 0, (v) => v.toFixed(2)]],
    chk: [['alias', L('q 加一个倒格矢 2π/a', 'Add a reciprocal-lattice vector 2π/a to q'), false]],
    btn: [[L('最长的波（n = 1）', 'Longest wave (n = 1)'), { n: 1 }], [L('布里渊区边界（n = N/2）', 'Zone boundary (n = N/2)'), { n: 99 }], [L('有次近邻', 'With second neighbours'), { k2: 0.25 }]],
    state: () => ({ t: 0 }), autoplay: true, fps: 30,
    changed(s) { s.n = Math.max(-s.N / 2 + 1, Math.min(s.N / 2, s.n)); },
    tick(s) { s.t += 0.05; },
    figs: [[0.3, L('原子的位移（放大画在竖直方向上，真实的位移沿着链）。', 'Atomic displacements (drawn vertically for clarity; the real displacement is along the chain).')], [0.5, L('色散 ω(q)，单位 √(K₁/m)。点是 N 原子链允许的 q；金点是现在这个模式。', 'Dispersion ω(q) in units of √(K₁/m). Dots are the q allowed for the N-atom chain; the gold dot is the current mode.')]],
    note: L('m = K₁ = a = 1。方程 m ü_j = K₁(u_{j+1} + u_{j−1} − 2u_j) + K₂(u_{j+2} + u_{j−2} − 2u_j) 代入 u_j = A e^{i(qja − ωt)} 就得到 ω² = (4/m)[K₁ sin²(qa/2) + K₂ sin²(qa)]。位移为了看得见画成横向的，这条链里的振动其实是纵波。周期边界让 q 只能取 2π/(Na) 的整数倍，N 趋于无穷时这些点连成曲线。', 'm = K₁ = a = 1. Substituting u_j = A e^{i(qja − ωt)} into m ü_j = K₁(u_{j+1} + u_{j−1} − 2u_j) + K₂(u_{j+2} + u_{j−2} − 2u_j) gives ω² = (4/m)[K₁ sin²(qa/2) + K₂ sin²(qa)]. The displacements are drawn sideways so they can be seen; in this chain the vibration is actually longitudinal. The periodic boundary allows only integer multiples of 2π/(Na); as N grows these points merge into a curve.'),
    draw(s, [cv, dv], c) {
      const n = Math.max(-s.N / 2 + 1, Math.min(s.N / 2, s.n)), q = (2 * PI * n) / s.N, w = M.chainW(q, 1, 1, s.k2), { ctx, w: W, h } = fit(cv);
      const pad = 18, dx = (W - 2 * pad) / (s.N - 1), xs = Array.from({ length: s.N }, (_, j) => pad + j * dx), amp = h * 0.28, y0 = h / 2;
      const us = xs.map((_, j) => amp * Math.cos(q * j - w * s.t));
      ctx.strokeStyle = c.line; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pad, y0); ctx.lineTo(W - pad, y0); ctx.stroke(); ctx.setLineDash([]);
      // 连续的波：q 和 q + 2π/a
      const wave = (qq, col, dash) => { ctx.strokeStyle = col; ctx.lineWidth = 1.4; ctx.setLineDash(dash); ctx.beginPath(); for (let i = 0; i <= 400; i++) { const x = (i / 400) * (s.N - 1), X = pad + x * dx, Y = y0 - amp * Math.cos(qq * x - w * s.t); if (i) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); } ctx.stroke(); ctx.setLineDash([]); };
      wave(q, c.accent, []);
      if (s.alias) wave(q + 2 * PI, c.danger, [4, 3]);
      xs.forEach((x, j) => { ctx.fillStyle = c.ink2; ctx.beginPath(); ctx.arc(x, y0 - us[j], Math.max(3, Math.min(7, dx * 0.28)), 0, 2 * PI); ctx.fill(); });
      const qs = lin(-PI, PI, 300), allowed = M.chainQs(s.N), wm = Math.max(...qs.map((x) => M.chainW(x, 1, 1, s.k2)));
      const ser = [{ xs: qs, ys: qs.map((x) => M.chainW(x, 1, 1, s.k2)), color: c.accent, width: 2.2 }, { xs: allowed, ys: allowed.map((x) => M.chainW(x, 1, 1, s.k2)), dots: 3, color: c.ink2 }, { xs: qs, ys: qs.map((x) => Math.abs(x)), color: c.muted, dash: [4, 4], label: L('ω = v_s|q|（长波极限）', 'ω = v_s|q| (long-wave limit)') }];
      if (s.alias) ser.push({ xs: qs.map((x) => x + 2 * PI), ys: qs.map((x) => M.chainW(x, 1, 1, s.k2)), color: c.danger, dash: [4, 3] });
      plot(dv, { x: s.alias ? [-PI, 3 * PI] : [-PI, PI], y: [0, wm * 1.15], xl: 'q', yl: 'ω', xt: s.alias ? [-PI, 0, PI, 2 * PI, 3 * PI] : [-PI, -PI / 2, 0, PI / 2, PI], xf: (t) => piF(Math.round((t / PI) * 2) / 2), series: ser, marks: [{ x: q, y: w, color: c.gold }, ...(s.alias ? [{ x: q + 2 * PI, y: w, color: c.danger }] : [])], bands: s.alias ? [{ x0: -PI, x1: PI, color: c.gold, alpha: 0.08 }] : [] });
      const vg = M.chainVg(q, 1, 1, s.k2), vs = Math.sqrt(1 + 4 * s.k2);
      return [[L('波矢 q', 'Wavevector q'), `${fix(q / PI, 3)} π/a`], [L('波长 λ = 2π/|q|', 'Wavelength λ = 2π/|q|'), n ? `${fix((2 * PI) / Math.abs(q), 2)} a` : '∞'], [L('频率 ω(q)', 'Frequency ω(q)'), fix(w, 4), true], [L('群速度 dω/dq', 'Group velocity dω/dq'), fix(vg, 4)], [L('声速（q → 0）', 'Sound speed (q → 0)'), fix(vs, 4)], [L('模式总数', 'Number of modes'), `${s.N}（${L('一个原子一个', 'one per atom')}）`]];
    },
  };

  // ── 2. 双原子链 ──────────────────────────────────────────────
  DEMOS.diatomic = {
    title: L('双原子链：声学支、光学支和中间的带隙', 'The diatomic chain: acoustic branch, optical branch and the gap between'), kind: 'exact',
    intro: L('一个原胞里有两个原子（质量 m₁、m₂），胞内和胞间的弹簧可以不一样硬。色散裂成两支：下面的声学支在 q → 0 时频率趋于零，两个原子同向一起走，就是声波；上面的光学支在 q = 0 时两个原子反向振动、原胞的质心不动，若两个原子带相反的电荷，这种振动会和光耦合。看两支在布里渊区边界处的频率怎样由两个质量分别决定，以及质量和弹簧都相同时带隙为什么消失。', 'Two atoms per cell (masses m₁ and m₂), with possibly different springs inside and between cells. The dispersion splits into two branches. The lower acoustic branch goes to zero frequency as q → 0, with both atoms moving together: that is sound. On the upper optical branch at q = 0 the two atoms move against each other while the centre of mass stays put; if they carry opposite charges this vibration couples to light. Watch how the zone-boundary frequencies are set by each mass separately, and why the gap vanishes when masses and springs are both equal.'),
    sel: [['br', L('看哪一支', 'Which branch'), [['0', L('声学支', 'Acoustic')], ['1', L('光学支', 'Optical')]], '1']],
    ctl: [['mr', L('质量比 m₂ / m₁', 'Mass ratio m₂ / m₁'), 1, 6, 0.05, 2.5, (v) => v.toFixed(2)], ['kr', L('胞间弹簧 K₂ / K₁', 'Inter-cell spring K₂ / K₁'), 0.2, 1, 0.01, 1, (v) => v.toFixed(2)], ['q', L('波矢 q', 'Wavevector q'), -1, 1, 0.01, 0.15, (v) => `${v.toFixed(2)} π/a`]],
    btn: [[L('等质量等弹簧：没有带隙', 'Equal masses and springs: no gap'), { mr: 1, kr: 1 }], [L('NaCl 的质量比（35.45 / 22.99）', 'Mass ratio of NaCl (35.45 / 22.99)'), { mr: 35.45 / 22.99, kr: 1 }], [L('只差弹簧（像二聚化的链）', 'Springs differ only (like a dimerised chain)'), { mr: 1, kr: 0.5 }]],
    state: () => ({ t: 0 }), autoplay: true, fps: 30, tick(s) { s.t += 0.05; },
    figs: [[0.28, L('8 个原胞的位移（同样画成竖直的）。浅色是 m₁，深色是 m₂，大小按质量。', 'Displacements over 8 cells (again drawn vertically). Light is m₁, dark is m₂, sized by mass.')], [0.5, L('两支色散（单位 √(K₁/m₁)）。阴影是带隙：这些频率的振动在晶体里传不开。', 'The two branches (units √(K₁/m₁)). The shaded band is the gap: vibrations at these frequencies cannot propagate in the crystal.')]],
    note: L('m₁ = K₁ = a = 1。动力学矩阵是 2 × 2 的厄米矩阵，本征值由解析公式给出，本征向量换回真实位移 u = e/√m。等质量、等弹簧时原胞其实可以减半，“光学支”就是单原子链在 q 和 q ± 2π/a 处的那一段折了进来，所以带隙为零。NaCl 那一档只借它的质量比：真实的 NaCl 是三维的离子晶体，长程库仑力让纵光学支和横光学支分开（第六章）。', 'm₁ = K₁ = a = 1. The dynamical matrix is a 2 × 2 Hermitian matrix with closed-form eigenvalues; its eigenvectors are turned back into real displacements u = e/√m. With equal masses and springs the cell can really be halved, and the “optical branch” is just the stretch of the monatomic chain at q ± 2π/a folded back in, so the gap is zero. The NaCl preset borrows only the mass ratio: real NaCl is a three-dimensional ionic crystal in which long-range Coulomb forces split the longitudinal and transverse optical branches (chapter 6).'),
    draw(s, [cv, dv], c) {
      const q = s.q * PI, m2 = s.mr, D = M.diatomic(q, 1, s.kr, 1, m2), br = Number(s.br), w = D.w[br], u = D.u[br], { ctx, w: W, h } = fit(cv);
      const cells = 8, pad = 16, dx = (W - 2 * pad) / (2 * cells - 1), y0 = h / 2, amp = h * 0.3 / Math.max(Math.hypot(...u[0]), Math.hypot(...u[1]));
      const xs = [], us = [], cols = [], rs = [];
      for (let n = 0; n < cells; n++) for (let b = 0; b < 2; b++) { const ph = q * n - w * s.t, [re, im] = u[b]; xs.push(pad + (2 * n + b) * dx); us.push(-amp * (re * Math.cos(ph) - im * Math.sin(ph))); cols.push(b ? c.accent : c.gold); rs.push(b ? 4 + 2.2 * Math.cbrt(m2) : 5); }
      ctx.save(); ctx.translate(0, y0);
      ctx.strokeStyle = c.line; ctx.setLineDash([3, 4]); ctx.beginPath(); ctx.moveTo(pad, 0); ctx.lineTo(W - pad, 0); ctx.stroke(); ctx.setLineDash([]);
      xs.forEach((x, i) => { ctx.fillStyle = cols[i]; ctx.beginPath(); ctx.arc(x, us[i], rs[i], 0, 2 * PI); ctx.fill(); });
      ctx.restore();
      const qs = lin(-PI, PI, 300), ac = qs.map((x) => M.diatomic(x, 1, s.kr, 1, m2).w[0]), op = qs.map((x) => M.diatomic(x, 1, s.kr, 1, m2).w[1]);
      const edge = M.diatomic(PI, 1, s.kr, 1, m2).w, top = Math.max(...op) * 1.12, gap = edge[1] - edge[0];
      plot(dv, { x: [-PI, PI], y: [0, top], xl: 'q', yl: 'ω', xt: [-PI, -PI / 2, 0, PI / 2, PI], xf: (t) => piF(Math.round((t / PI) * 2) / 2), series: [{ xs: qs, ys: ac, color: c.info, width: 2.2, label: L('声学支', 'acoustic') }, { xs: qs, ys: op, color: c.danger, width: 2.2, label: L('光学支', 'optical') }], hbands: gap > 1e-6 ? [{ y0: edge[0], y1: edge[1], color: c.gold, alpha: 0.15 }] : [], marks: [{ x: q, y: w, color: c.gold }] });
      const ratio = Math.hypot(...u[1]) / Math.hypot(...u[0]), same = u[0][0] * u[1][0] + u[0][1] * u[1][1] >= 0;
      return [[L('这一支的频率', 'Frequency of this branch'), fix(w, 4), true], [L('振幅比 |u₂| / |u₁|，方向', 'Amplitude ratio |u₂| / |u₁|, direction'), `${fix(ratio, 3)}，${same ? L('同向', 'in phase') : L('反向', 'opposite')}`], [L('边界处：声学 / 光学', 'At the zone boundary: acoustic / optical'), `${fix(edge[0], 4)} / ${fix(edge[1], 4)}`], [L('带隙宽度', 'Gap width'), fix(gap, 4)], [L('q = 0 的光学频率', 'Optical frequency at q = 0'), fix(M.diatomic(0, 1, s.kr, 1, m2).w[1], 4)]];
    },
  };

  // ── 3. 二维格子和布里渊区 ─────────────────────────────────────
  DEMOS.bz = {
    title: L('二维晶格：布里渊区、高对称路径、纵波和横波', 'A two-dimensional lattice: the Brillouin zone, a high-symmetry path, longitudinal and transverse waves'), kind: 'exact',
    intro: L('正方格子或三角格子，原子之间是中心力的弹簧（最近邻 K₁、次近邻 K₂）。左边是倒空间里的第一布里渊区和常用的高对称路径，右边是沿这条路径的两支色散，颜色表示偏振：越蓝越接近纵波（原子沿波的方向动），越红越接近横波。拖动“路径上的位置”看一个 k 点。把正方格子的 K₂ 调到 0：沿 Γ–X 的横波频率变成零，只有最近邻的中心力撑不住剪切。', 'A square or triangular lattice with central-force springs between atoms (nearest neighbours K₁, second neighbours K₂). On the left is the first Brillouin zone in reciprocal space with the usual high-symmetry path; on the right are the two branches along that path, coloured by polarisation: bluer is closer to longitudinal (atoms move along the wave), redder closer to transverse. Drag “position along the path” to look at one k point. Set K₂ to 0 on the square lattice: the transverse frequency along Γ–X drops to zero, because nearest-neighbour central forces alone cannot resist shear.'),
    sel: [['lat', L('晶格', 'Lattice'), [['square', L('正方格子', 'Square lattice')], ['triangle', L('三角格子', 'Triangular lattice')]], 'square']],
    ctl: [['k2', L('次近邻 K₂ / K₁', 'Second neighbours K₂ / K₁'), 0, 1, 0.01, 0.5, (v) => v.toFixed(2)], ['p', L('路径上的位置', 'Position along the path'), 0, 1, 0.005, 0.2, (v) => `${(100 * v).toFixed(0)} %`]],
    btn: [[L('K₂ = 0（只有最近邻）', 'K₂ = 0 (nearest neighbours only)'), { k2: 0 }], [L('三角格子', 'Triangular lattice'), { lat: 'triangle', k2: 0 }]],
    figs: [[0.9, L('第一布里渊区（Wigner–Seitz 原胞）和高对称路径，金点是现在的 k。', 'The first Brillouin zone (Wigner–Seitz cell) and the high-symmetry path; the gold dot is the current k.')], [0.6, L('沿路径的色散（单位 √(K₁/m)），蓝 = 纵波，红 = 横波。', 'Dispersion along the path (units √(K₁/m)); blue = longitudinal, red = transverse.')]],
    note: L('最近邻距离 a = 1。动力学矩阵 D(k) = (1/m) Σ_R K_R (1 − cos k·R) R̂R̂ᵀ 是 2 × 2 实对称矩阵，本征向量和 k 的夹角给出“纵波成分”。真实的二维材料（石墨烯等）一个原胞有两个原子、还有面外的弯曲振动，比这里多出光学支和一支 ω ∝ q² 的弯曲支。', 'Nearest-neighbour distance a = 1. The dynamical matrix D(k) = (1/m) Σ_R K_R (1 − cos k·R) R̂R̂ᵀ is a 2 × 2 real symmetric matrix; the angle between its eigenvectors and k gives the “longitudinal fraction”. Real two-dimensional materials (graphene and the like) have two atoms per cell and out-of-plane bending, adding optical branches and a flexural branch with ω ∝ q².'),
    draw(s, [zv, dv], c) {
      const B = M.band2d(s.lat, 1, s.k2, 1, 260), cur = B.pts[Math.min(B.pts.length - 1, Math.round(s.p * (B.pts.length - 1)))], poly = M.bzPolygon(s.lat), P = M.LAT2D[s.lat].path;
      const R = (4 * PI) / 3 * 1.18;
      plot(zv, { x: [-R, R], y: [-R, R], eq: true, xl: 'k_x', yt: [], xt: [], series: [{ pts: [...poly, poly[0]], color: c.ink2, width: 1.6 }, { pts: P.map((x) => x[1]), color: c.gold, width: 2.2 }], marks: [], after: ({ ctx, X, Y }) => { for (const [nm, k] of P) { ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(X(k[0]), Y(k[1]), 3.5, 0, 2 * PI); ctx.fill(); ctx.font = font(13, 700); ctx.fillText(nm, X(k[0]) + 6, Y(k[1]) - 6); } ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(X(cur.k[0]), Y(cur.k[1]), 6, 0, 2 * PI); ctx.fill(); } });
      const top = Math.max(...B.pts.map((p) => p.w[1])) * 1.1;
      plot(dv, { x: [0, B.len], y: [0, top], yl: 'ω', xt: B.labels.map((x) => x[0]), xf: (t) => (B.labels.find((x) => Math.abs(x[0] - t) < 1e-9) || ['', ''])[1], series: [], marks: [{ x: cur.s, color: c.gold }], after: ({ ctx, X, Y }) => { for (let b = 0; b < 2; b++) for (let i = 1; i < B.pts.length; i++) { const p = B.pts[i], o = B.pts[i - 1], f = p.L[b]; ctx.strokeStyle = `color-mix(in srgb, ${c.info} ${Math.round(100 * f)}%, ${c.danger})`; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.moveTo(X(o.s), Y(o.w[b])); ctx.lineTo(X(p.s), Y(p.w[b])); ctx.stroke(); } for (let b = 0; b < 2; b++) { ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(X(cur.s), Y(cur.w[b]), 4.5, 0, 2 * PI); ctx.fill(); } } });
      const v = M.sound2d(s.lat, 1, s.k2, 1, 0);
      return [[L('k', 'k'), `(${fix(cur.k[0] / PI, 3)}, ${fix(cur.k[1] / PI, 3)}) π/a`], [L('两支的频率', 'The two frequencies'), `${fix(cur.w[0], 3)} / ${fix(cur.w[1], 3)}`, true], [L('纵波成分', 'Longitudinal fraction'), `${fix(100 * cur.L[0] ** 2, 0)} % / ${fix(100 * cur.L[1] ** 2, 0)} %`], [L('沿 x 方向的声速：横 / 纵', 'Sound speeds along x: transverse / longitudinal'), `${fix(v[0], 3)} / ${fix(v[1], 3)}`]];
    },
  };

  // ── 4. 态密度 ──────────────────────────────────────────────────
  let DOSCACHE = {};
  DEMOS.dos = {
    title: L('态密度：把布里渊区里所有的模式按频率数一遍', 'The density of states: counting every mode in the Brillouin zone by frequency'), kind: 'exact',
    intro: L('在布里渊区里均匀地撒很多 k 点，把每个点上每一支的频率都放进直方图，就得到声子态密度 g(ω)：单位频率间隔里有多少个模式。一维链的态密度在最高频率处发散（那里色散变平、群速度为零）；三维面心立方模型在低频处是 ω²（Debye 的假设），在高频处出现几个尖角：那是色散曲面上的鞍点和极大值，叫范霍夫奇点。虚线是低频行为相同的 Debye 模型。', 'Scatter many k points evenly over the Brillouin zone and put every frequency of every branch into a histogram: that is the phonon density of states g(ω), the number of modes per unit frequency interval. The one-dimensional chain’s DOS diverges at the top frequency (where the dispersion flattens and the group velocity vanishes); the three-dimensional fcc model goes as ω² at low frequency (Debye’s assumption) and shows several kinks higher up: saddle points and maxima of the dispersion surfaces, called van Hove singularities. The dashed curve is the Debye model with the same low-frequency behaviour.'),
    sel: [['dim', L('模型', 'Model'), [['1', L('一维单原子链', '1D monatomic chain')], ['2', L('二维正方格子（K₂ = K₁/2）', '2D square lattice (K₂ = K₁/2)')], ['3', L('三维面心立方（最近邻中心力）', '3D fcc (nearest-neighbour central forces)')]], '3']],
    ctl: [['bins', L('直方图的格数', 'Histogram bins'), 30, 160, 10, 90, String]],
    chk: [['deb', L('画 Debye 模型', 'Show the Debye model'), true]],
    figs: [[0.58, L('g(ω)，归一成 ∫g dω = 每个原子的支数（1、2、3）。频率单位 √(K/m)。', 'g(ω), normalised to ∫g dω = branches per atom (1, 2, 3). Frequency in units of √(K/m).')]],
    note: L('一维撒 4000 个点；二维 220 × 220；三维在倒格子原胞上撒 28³ 个 Monkhorst–Pack 点，每点 3 个频率，共约 6.6 万个。直方图在最低的几格噪声大，因为那里的模式太少；Debye 线用的是从长波声速直接算出的 ω² 系数，不是拟合的。真实铜、铝的态密度要用中子散射测出的力常数或第一性原理计算，形状和这个最近邻模型相似但不一样。', 'In 1D 4000 points; in 2D 220 × 220; in 3D 28³ Monkhorst–Pack points over the reciprocal primitive cell, 3 frequencies each, about 66 000 in all. The lowest bins are noisy because there are few modes there; the Debye line uses the ω² coefficient computed directly from the long-wave sound speeds, not a fit. The real DOS of copper or aluminium needs force constants measured by neutron scattering or computed from first principles; its shape resembles this nearest-neighbour model but is not the same.'),
    draw(s, [cv], c) {
      const dim = Number(s.dim), key = `${dim}`;
      if (!DOSCACHE[key]) DOSCACHE[key] = dim === 1 ? M.chainFreqs(4000) : dim === 2 ? M.squareFreqs(220, 1, 0.5) : M.fccFreqs(28);
      const fr = DOSCACHE[key];
      let wmax = 0; for (const w of fr) if (w > wmax) wmax = w;
      const H = M.histogram(fr, s.bins, wmax * 1.0001, dim), ys = Array.from(H.g);
      let top = Math.max(...ys.slice(Math.floor(s.bins * 0.1))) * 1.15;
      const ser = [{ xs: H.ws, ys, bars: H.dw, color: c.accent, alpha: 0.75 }];
      let wD = 0, extra = [];
      if (dim === 1) { const xs = lin(0, wmax * 0.999, 300); ser.push({ xs, ys: xs.map((w) => M.chainDos(w, wmax)), color: c.ink2, width: 1.8, label: L('解析：(2/π)/√(ω_max² − ω²)', 'exact: (2/π)/√(ω_max² − ω²)') }); wD = PI; if (s.deb) ser.push({ xs: [0, wD, wD], ys: [1 / wD, 1 / wD, 0], color: c.gold, dash: [6, 4], label: 'Debye' }); top = Math.max(top, 1.3); }
      if (dim === 3) { const cc = M.fccLowCoef(); wD = M.debyeFromCoef(cc); if (s.deb) { const xs = lin(0, wD, 200); ser.push({ xs: [...xs, wD], ys: [...xs.map((w) => cc * w * w), 0], color: c.gold, dash: [6, 4], label: `Debye（ω_D = ${fix(wD, 3)}）` }); } top = Math.max(top, (cc * wD * wD) * 1.05); extra = [[L('低频系数 g ≈ cω²：c', 'Low-frequency coefficient g ≈ cω²: c'), fix(cc, 4)]]; }
      plot(cv, { x: [0, Math.max(wmax, wD) * 1.05], y: [0, top], xl: 'ω', yl: 'g(ω)', series: ser });
      const I = ys.reduce((a, g) => a + g * H.dw, 0);
      return [[L('∫ g dω', '∫ g dω'), fix(I, 6), true], [L('最高频率 ω_max', 'Highest frequency ω_max'), fix(wmax, 4)], ...(wD ? [[L('Debye 截止频率 ω_D', 'Debye cutoff ω_D'), fix(wD, 4)]] : []), ...extra, [L('采样的频率个数', 'Frequencies sampled'), fr.length.toLocaleString(L('zh-CN', 'en'))]];
    },
  };

  // ── 5. 热容 ────────────────────────────────────────────────────
  let FCC28 = null;
  DEMOS.cv = {
    title: L('热容：Dulong–Petit、Einstein、Debye 和真正的态密度', 'Heat capacity: Dulong–Petit, Einstein, Debye and a real density of states'), kind: 'exact',
    intro: L('经典的均分定理说每摩尔原子的热容是 3R ≈ 24.94 J/(mol·K)（Dulong–Petit 定律），低温下实验却掉到零。Einstein 1907 年让所有原子以同一个频率量子化地振动，解释了下降，但掉得太快（指数式）；Debye 1912 年把晶体当成有截止频率的弹性体，得到低温的 T³ 定律。选一个元素看它的 Debye 温度，再对照三维面心立方模型的真实态密度算出的热容。下面的图是实验家常用的 C/T 对 T²：Debye 模型在低温是一条过原点的直线。', 'The classical equipartition theorem gives 3R ≈ 24.94 J/(mol·K) per mole of atoms (the Dulong–Petit law), yet experiments fall to zero at low temperature. In 1907 Einstein let every atom vibrate, quantised, at one frequency, which explained the fall but made it too fast (exponential); in 1912 Debye treated the crystal as an elastic body with a cutoff frequency and found the low-temperature T³ law. Pick an element to see its Debye temperature, then compare with the heat capacity computed from the true DOS of the three-dimensional fcc model. The lower plot is the one experimenters use, C/T against T²: the Debye model is a straight line through the origin at low temperature.'),
    sel: [['mat', L('元素（Debye 温度）', 'Element (Debye temperature)'), Object.entries(M.DEBYE).map(([k, v]) => [k, `${k === 'C' ? L('金刚石', 'Diamond') : k}  Θ_D = ${v} K`]), 'Cu']],
    ctl: [['T', L('温度 T', 'Temperature T'), 1, 1500, 1, 300, (v) => `${v} K`]],
    chk: [['ein', L('画 Einstein 模型（Θ_E = √(3/5) Θ_D）', 'Show the Einstein model (Θ_E = √(3/5) Θ_D)'), true], ['fcc', L('画面心立方模型的真实态密度', 'Show the fcc model’s true DOS'), true]],
    figs: [[0.56, L('C / 3R 随温度（对数横轴）。竖线是现在的温度。', 'C / 3R against temperature (log axis). The vertical line is the current temperature.')], [0.42, L('低温：C/T 对 T²（单位 mJ/(mol·K²) 和 K²），到 T = Θ_D/15 为止。', 'Low temperature: C/T against T² (mJ/(mol·K²) and K²), up to T = Θ_D/15.')]],
    note: L('Debye 温度取自 Kittel《固体物理导论》（第 8 版）第 5 章的表，是由低温热容定出的数值，在不同温度下拟合会有出入。Einstein 温度取 √(3/5) Θ_D，这样两个模型在高温展开里的 ⟨ω²⟩ 一样。面心立方模型的频率按“低频声速和 Debye 模型相同”标定（同一个 T³ 系数）。这里只算晶格的热容：金属在几 K 以下还有正比于 T 的电子热容，C/T 对 T² 的直线因此有截距 γ。', 'Debye temperatures are from the table in chapter 5 of Kittel’s Introduction to Solid State Physics (8th ed.), fixed from low-temperature heat capacities; fits at other temperatures differ somewhat. The Einstein temperature is √(3/5) Θ_D, so that the two models share ⟨ω²⟩ in the high-temperature expansion. The fcc model’s frequencies are scaled so its low-frequency sound speeds match the Debye model (the same T³ coefficient). Only the lattice heat capacity is computed: below a few kelvin, metals also have an electronic heat capacity proportional to T, which gives the C/T against T² line an intercept γ.'),
    draw(s, [cv, lv], c) {
      const th = M.DEBYE[s.mat] || 343, thE = Math.sqrt(3 / 5) * th, Ts = lin(0, Math.log10(3000), 160).map((x) => 10 ** x);
      FCC28 ||= M.fccFreqs(20);
      const hw = th / M.debyeFromCoef(M.fccLowCoef()); // ħω/k_B = hw · ω（K）
      const ser = [{ xs: Ts, ys: Ts.map((T) => M.debyeC(T, th) / 3), color: c.accent, width: 2.4, label: 'Debye' }];
      if (s.ein) ser.push({ xs: Ts, ys: Ts.map((T) => M.einsteinC(T, thE) / 3), color: c.warn, dash: [6, 4], label: 'Einstein' });
      if (s.fcc) ser.push({ xs: Ts, ys: Ts.map((T) => M.cvFromFreqs(FCC28, T, hw, 3) / 3), color: c.violet, dash: [2, 3], width: 2, label: L('fcc 态密度', 'fcc DOS') });
      plot(cv, { x: [0, Math.log10(3000)], y: [0, 1.08], logx: true, xl: 'T (K)', yl: 'C / 3R', series: ser, hmarks: [{ y: 1, color: c.muted }], marks: [{ x: s.T, y: M.debyeC(s.T, th) / 3, color: c.gold }] });
      const Tl = lin(0.5, th / 15, 60), R = M.R_GAS;
      plot(lv, { x: [0, (th / 15) ** 2], y: [0, (1000 * R * M.debyeT3(th / 15, th)) / (th / 15) * 1.15], xl: 'T² (K²)', yl: 'C/T', series: [{ xs: Tl.map((T) => T * T), ys: Tl.map((T) => (1000 * R * M.debyeC(T, th)) / T), color: c.accent, width: 2.2, label: 'Debye' }, { xs: Tl.map((T) => T * T), ys: Tl.map((T) => (1000 * R * M.debyeT3(T, th)) / T), color: c.muted, dash: [4, 4], label: L('T³ 定律', 'T³ law') }, ...(s.ein ? [{ xs: Tl.map((T) => T * T), ys: Tl.map((T) => (1000 * R * M.einsteinC(T, thE)) / T), color: c.warn, dash: [6, 4], label: 'Einstein' }] : [])] });
      const C = R * M.debyeC(s.T, th);
      return [[L('Debye 热容', 'Debye heat capacity'), `${fix(C, 2)} J/(mol·K)`, true], [L('占 Dulong–Petit 的', 'Fraction of Dulong–Petit'), `${fix((100 * C) / (3 * R), 1)} %`], [L('Einstein 热容', 'Einstein heat capacity'), `${fix(R * M.einsteinC(s.T, thE), 2)} J/(mol·K)`], [L('fcc 态密度的热容', 'Heat capacity from the fcc DOS'), `${fix(R * M.cvFromFreqs(FCC28, s.T, hw, 3), 2)} J/(mol·K)`], [L('T³ 定律的系数 β = 12π⁴R / 5Θ_D³', 'T³-law coefficient β = 12π⁴R / 5Θ_D³'), `${fmt((1000 * 12 * PI ** 4 * R) / 5 / th ** 3)} mJ/(mol·K⁴)`]];
    },
  };

  // ── 6. 中子散射 ────────────────────────────────────────────────
  DEMOS.scatter = {
    title: L('非弹性中子散射：能量和动量都守恒，一次扫描就能读出一个声子', 'Inelastic neutron scattering: energy and momentum both conserved, so one scan reads off one phonon'), kind: 'exact',
    intro: L('热中子的能量（几十 meV）和声子相当，波长（约 1–2 Å）和原子间距相当，所以一个中子在晶体里产生或吸收一个声子时，能量和动量的变化都量得出来。上图是 (Q, ħω) 平面：曲线是一个面心立方晶体沿 [100] 方向的色散（纵波实线、横波虚线），阴影是固定入射能量时中子在运动学上能到达的区域。在竖线所在的 Q 做“定 Q 扫描”，下面的谱里就在 ±ħω(q) 处出现峰：正的是中子产生声子，负的是吸收一个热激发出来的声子。', 'Thermal neutrons have energies (tens of meV) comparable to phonons and wavelengths (about 1–2 Å) comparable to interatomic spacings, so when a neutron creates or absorbs a phonon in a crystal, both its energy change and momentum change are measurable. The upper plot is the (Q, ħω) plane: the curves are the dispersion of an fcc crystal along [100] (longitudinal solid, transverse dashed), and the shading is the region a neutron of fixed incident energy can reach kinematically. A “constant-Q scan” at the vertical line puts peaks in the lower spectrum at ±ħω(q): positive when the neutron creates a phonon, negative when it absorbs one that was thermally excited.'),
    ctl: [['Ei', L('入射能量 E_i', 'Incident energy E_i'), 10, 120, 1, 60, (v) => `${v} meV`], ['h', L('Q = (h, 0, 0)，以 2π/a 为单位', 'Q = (h, 0, 0) in units of 2π/a'), 0.05, 3, 0.01, 1.6, (v) => v.toFixed(2)], ['T', L('样品温度', 'Sample temperature'), 10, 600, 5, 300, (v) => `${v} K`], ['Em', L('色散的最高能量（模型标定）', 'Top energy of the dispersion (model scale)'), 10, 80, 1, 40, (v) => `${v} meV`]],
    btn: [[L('冷样品（20 K）', 'Cold sample (20 K)'), { T: 20 }], [L('布里渊区边界 X（h = 1）', 'Zone boundary X (h = 1)'), { h: 1 }], [L('入射能量太低', 'Incident energy too low'), { Ei: 15, h: 1.6 }]],
    figs: [[0.56, L('(Q, ħω) 平面。阴影：E_i 下运动学允许的区域；竖线：扫描的 Q。纵坐标正 = 中子损失能量。', 'The (Q, ħω) plane. Shading: kinematically allowed region at E_i; vertical line: the scanned Q. Positive ordinate = neutron loses energy.')], [0.44, L('定 Q 扫描的强度（展宽 1.5 meV），只看形状。', 'Intensity of the constant-Q scan (1.5 meV broadening), shape only.')]],
    note: L('晶格常数取铝的 a = 4.05 Å；色散用第四章的最近邻中心力面心立方模型，按“最高能量”标定，不是铝的真实色散（Stedman 和 Nilsson 1966 测过铝的）。E = ħ²k²/2m_n = 2.0721 meV·Å² × k²。单声子强度取 |Q·e|²/ω × (n + 1) 或 × n，没有算 Debye–Waller 因子、分辨率和多声子。面心立方的 (100) 衍射是禁戒的，(200) 才是倒格点，所以 h 在 0、2 附近是布里渊区中心，h = 1 是边界 X。Q 沿 [100] 时横波的偏振垂直于 Q，|Q·e|² = 0，这种几何看不到它：要看横波，得把 Q 换到别的倒格点附近。', 'The lattice constant is aluminium’s, a = 4.05 Å; the dispersion is the nearest-neighbour central-force fcc model of chapter 4, scaled by the “top energy”, not aluminium’s true dispersion (Stedman and Nilsson measured that in 1966). E = ħ²k²/2m_n = 2.0721 meV·Å² × k². The one-phonon intensity is |Q·e|²/ω × (n + 1) or × n, without the Debye–Waller factor, resolution or multiphonon terms. The fcc (100) reflection is forbidden and (200) is the reciprocal-lattice point, so h near 0 or 2 is the zone centre and h = 1 the boundary X. With Q along [100] the transverse polarisation is perpendicular to Q, |Q·e|² = 0, and this geometry cannot see it: to see transverse modes, Q must be moved near another reciprocal-lattice point.'),
    draw(s, [mv, sv], c) {
      const a = 4.05, G = (2 * PI) / a, hs = lin(0, 3, 241), disp = (h) => { const hr = h - 2 * Math.round(h / 2); return M.fccAlong(Math.abs(hr)).map((m) => m.w * s.Em); };
      const L0 = hs.map((h) => disp(h)[2]), T0 = hs.map((h) => disp(h)[0]), Ebox = s.Em * 1.6;
      plot(mv, { x: [0, 3], y: [-Ebox, Ebox], xl: L('Q（h，单位 2π/a）', 'Q (h, units of 2π/a)'), yl: L('ħω（meV）', 'ħω (meV)'), series: [{ xs: hs, ys: L0, color: c.accent, width: 2.2, label: L('纵波（看得见）', 'longitudinal (visible)') }, { xs: hs, ys: L0.map((v) => -v), color: c.accent, width: 1.2, alpha: 0.5 }, { xs: hs, ys: T0, color: c.violet, dash: [5, 4], label: L('横波（|Q·e| = 0）', 'transverse (|Q·e| = 0)') }, { xs: hs, ys: T0.map((v) => -v), color: c.violet, dash: [5, 4], alpha: 0.5 }], hmarks: [{ y: 0, color: c.line, dash: [] }], marks: [{ x: s.h, color: c.gold }], after: ({ ctx, X, Y }) => { ctx.globalAlpha = 0.13; ctx.fillStyle = c.gold; const n = 90; for (let i = 0; i < n; i++) { const E1 = -Ebox + (2 * Ebox * i) / n, E2 = E1 + (2 * Ebox) / n, r = M.qRange(s.Ei, (E1 + E2) / 2); if (!r) continue; ctx.fillRect(X(r[0] / G), Y(E2), X(Math.min(3.2, r[1] / G)) - X(r[0] / G), Y(E1) - Y(E2)); } ctx.globalAlpha = 1; } });
      const hr = s.h - 2 * Math.round(s.h / 2), modes = M.fccAlong(Math.abs(hr)), Q = s.h * G, es = lin(-Ebox, Ebox, 500), gam = 1.5, kT = s.T / M.MEV.K;
      const lines = [];
      for (const m of modes) { const E = m.w * s.Em; if (E < 0.05) continue; const qe = m.e[0] ** 2 * Q * Q, n = M.bose(E / kT); for (const [E0, wt] of [[E, (qe / E) * (n + 1)], [-E, (qe / E) * n]]) { const ok = M.qRange(s.Ei, E0); if (ok && Q >= ok[0] && Q <= ok[1]) lines.push([E0, wt]); } }
      const I = es.map((e) => lines.reduce((acc, [E0, wt]) => acc + wt * M.lorentz(e, E0, gam), 0)), top = Math.max(1e-9, ...I) * 1.15;
      plot(sv, { x: [-Ebox, Ebox], y: [0, top], yt: [], xl: L('ħω（meV）：负 = 中子得到能量', 'ħω (meV): negative = neutron gains energy'), series: [{ xs: es, ys: I, color: c.accent, width: 2, fill: true }], marks: [{ x: 0, color: c.line }] });
      const EL = modes[2].w * s.Em, ki = M.kOfE(s.Ei), th2 = M.scatAngle(s.Ei, EL, Q), ratio = Math.exp(-EL / kT);
      return [[L('入射中子 k_i、波长', 'Incident neutron k_i, wavelength'), `${fix(ki, 3)} Å⁻¹, ${fix(M.lambdaOfE(s.Ei), 3)} Å`], [L('约化波矢 q（离最近的布里渊区中心）', 'Reduced wavevector q (from the nearest zone centre)'), `${fix(Math.abs(hr), 3)} × 2π/a`], [L('纵波 ħω', 'Longitudinal ħω'), `${fix(EL, 2)} meV = ${fix(EL * M.MEV.thz, 2)} THz = ${fix(EL * M.MEV.cm, 0)} cm⁻¹`, true], [L('产生这个声子要的散射角 2θ', 'Scattering angle 2θ to create it'), Number.isFinite(th2) ? `${fix((th2 * 180) / PI, 1)}°` : L('够不着（换高的 E_i）', 'out of reach (raise E_i)')], [L('吸收 / 产生的强度比 e^{−ħω/kT}', 'Absorb / create intensity ratio e^{−ħω/kT}'), fix(ratio, 4)]];
    },
  };

  // ── 7. 拉曼 ────────────────────────────────────────────────────
  const RAMAN = { Si: 520, C: 1332, G: 1582 };
  DEMOS.raman = {
    title: L('拉曼散射：只看到 q ≈ 0，斯托克斯和反斯托克斯的强度比是一支温度计', 'Raman scattering: it sees only q ≈ 0, and the Stokes to anti-Stokes ratio is a thermometer'), kind: 'exact',
    intro: L('激光的光子在晶体里散射，能量少一份声子（斯托克斯线）或多一份声子（反斯托克斯线）。可见光的波矢比布里渊区小两三个数量级，动量守恒只允许布里渊区中心附近的声子参与，所以拉曼谱上看到的是 Γ 点的光学声子。反斯托克斯线要先有一个热激发的声子，强度正比于 n；斯托克斯线正比于 n + 1。两者之比只取决于温度，拉曼因此可以测样品局部的温度。', 'A laser photon scatters in the crystal, losing one phonon of energy (the Stokes line) or gaining one (the anti-Stokes line). Visible light’s wavevector is two to three orders of magnitude smaller than the Brillouin zone, so momentum conservation lets only phonons near the zone centre take part: a Raman spectrum shows optical phonons at Γ. The anti-Stokes line needs a thermally excited phonon to begin with and scales as n; the Stokes line scales as n + 1. Their ratio depends only on temperature, so Raman can measure a sample’s local temperature.'),
    sel: [['mat', L('谱线', 'Line'), [['Si', L('硅的光学声子（约 520 cm⁻¹）', 'Silicon optical phonon (about 520 cm⁻¹)')], ['C', L('金刚石（约 1332 cm⁻¹）', 'Diamond (about 1332 cm⁻¹)')], ['G', L('石墨烯的 G 峰（约 1582 cm⁻¹）', 'Graphene G peak (about 1582 cm⁻¹)')]], 'Si'], ['laser', L('激光', 'Laser'), [['532', '532 nm'], ['633', '633 nm'], ['785', '785 nm']], '532']],
    ctl: [['T', L('温度', 'Temperature'), 10, 1000, 5, 300, (v) => `${v} K`]],
    chk: [['ph', L('探测器数光子（ν³，而不是功率的 ν⁴）', 'Detector counts photons (ν³ rather than power ν⁴)'), false]],
    btn: [[L('液氮温度 77 K', 'Liquid nitrogen, 77 K'), { T: 77 }], [L('室温', 'Room temperature'), { T: 295 }], [L('激光加热到 600 K', 'Laser-heated to 600 K'), { T: 600 }]],
    figs: [[0.5, L('拉曼谱：横轴是拉曼位移（正 = 斯托克斯），中间的瑞利线截掉了。线宽只是为了好看。', 'Raman spectrum: the axis is the Raman shift (positive = Stokes); the Rayleigh line in the middle is clipped. Line widths are cosmetic.')]],
    note: L('强度比 I_aS/I_S = [(ν_L + ν)/(ν_L − ν)]⁴ exp(−hcν/k_BT)，ν⁴ 是散射功率的频率因子，数光子的 CCD 改成 ν³。这里没有算两条线在样品里吸收不同、探测器在两个波长的效率不同：真正用拉曼测温要先标定这些。峰位是常见的室温值，峰位本身也随温度移动（非谐性，第七章；Hart 等人 1970 量过硅的）。读数里的 q_light 是背散射时光传给晶格的最大波矢 4π/λ（真空中，再乘折射率），和硅的布里渊区边界 π/a（a = 5.431 Å）相比。', 'Intensity ratio I_aS/I_S = [(ν_L + ν)/(ν_L − ν)]⁴ exp(−hcν/k_BT); ν⁴ is the frequency factor for scattered power, replaced by ν³ for photon-counting CCDs. Not included: different absorption of the two lines in the sample and different detector efficiency at the two wavelengths, which real Raman thermometry must calibrate. Peak positions are common room-temperature values; the peaks themselves also shift with temperature (anharmonicity, chapter 7; Hart et al. 1970 measured silicon’s). The q_light in the readout is the largest wavevector light can hand the lattice in backscattering, 4π/λ (in vacuum, multiply by the refractive index), compared with silicon’s zone boundary π/a (a = 5.431 Å).'),
    draw(s, [cv], c) {
      const nu = RAMAN[s.mat], laser = 1e7 / Number(s.laser), pw = s.ph ? 3 : 4, r = M.ramanRatio(nu, s.T, laser, pw), n = M.bose((M.HC_K * nu) / s.T);
      const X = nu * 1.35, xs = lin(-X, X, 700), g = nu * 0.012, I = xs.map((x) => M.lorentz(x, nu, g) + r * M.lorentz(x, -nu, g));
      const peak = M.lorentz(nu, nu, g);
      plot(cv, { x: [-X, X], y: [0, peak * 1.15], yt: [], xl: L('拉曼位移（cm⁻¹）', 'Raman shift (cm⁻¹)'), series: [{ xs, ys: I, color: c.accent, width: 2, fill: true }], marks: [{ x: 0, color: c.muted }], texts: [{ x: nu, y: peak, s: L('斯托克斯', 'Stokes'), align: 'center', dy: -6 }, { x: -nu, y: r * peak, s: L('反斯托克斯', 'anti-Stokes'), align: 'center', dy: -6 }] });
      const qfrac = (4 * PI) / (Number(s.laser) * 10) / (PI / 5.431);
      return [[L('反斯托克斯 / 斯托克斯', 'Anti-Stokes / Stokes'), fix(r, 4), true], [L('由这个比反推的温度', 'Temperature recovered from the ratio'), `${fix(M.ramanTemp(nu, r, laser, pw), 1)} K`], [L('声子的占据数 n', 'Phonon occupation n'), fix(n, 4)], [L('声子能量', 'Phonon energy'), `${fix(nu / M.MEV.cm, 1)} meV（${fix(nu * M.HC_K, 0)} K）`], [L('q_light / (π/a)，硅，真空中', 'q_light / (π/a), silicon, in vacuum'), `${fix(100 * qfrac, 2)} %`]];
    },
  };

  // ── 8. 准谐近似和热膨胀 ────────────────────────────────────────
  DEMOS.qha = {
    title: L('准谐近似：频率随体积变，晶体就会热胀冷缩', 'The quasi-harmonic approximation: when frequencies depend on volume, the crystal expands on heating'), kind: 'exact',
    intro: L('严格的谐振子晶体不会热膨胀：振动再剧烈，平均位置也不动。准谐近似保留谐振子，但让频率随体积变化，ω ∝ V^−γ（γ 叫 Grüneisen 参数）。每个温度下，自由能 F(V, T) = 静态能 + 振动自由能，取最小值的体积就是平衡体积。γ > 0（多数材料）时，升温让大体积一侧的振动自由能更低，晶体膨胀；γ < 0 时反过来，这就是 ZrW₂O₈ 一类负热膨胀材料的机理之一。读数里把数值求出的膨胀系数和 Grüneisen 关系 α = γC_V/(B_T V) 对照。', 'A strictly harmonic crystal does not expand on heating: however hard it vibrates, the average positions stay put. The quasi-harmonic approximation keeps the oscillators harmonic but lets their frequencies depend on volume, ω ∝ V^−γ (γ is the Grüneisen parameter). At each temperature the free energy F(V, T) = static energy + vibrational free energy, and the volume at its minimum is the equilibrium volume. For γ > 0 (most materials) heating lowers the vibrational free energy on the large-volume side and the crystal expands; for γ < 0 the opposite happens, one of the mechanisms behind negative-thermal-expansion materials such as ZrW₂O₈. The readout compares the numerically found expansion coefficient with the Grüneisen relation α = γC_V/(B_T V).'),
    ctl: [['g', L('Grüneisen 参数 γ', 'Grüneisen parameter γ'), -1.5, 3, 0.05, 2, (v) => v.toFixed(2)], ['B', L('静态刚度 B V₀（单位 ħω₀）', 'Static stiffness B V₀ (units of ħω₀)'), 20, 400, 5, 120, String], ['T', L('温度 T（单位 ħω₀/k_B）', 'Temperature T (units of ħω₀/k_B)'), 0.02, 3, 0.01, 1, (v) => v.toFixed(2)]],
    chk: [['zp', L('算上零点能', 'Include zero-point energy'), true]],
    btn: [[L('γ = 0：不膨胀', 'γ = 0: no expansion'), { g: 0 }], [L('负热膨胀 γ = −1', 'Negative expansion γ = −1'), { g: -1 }]],
    figs: [[0.52, L('几个温度下的 F(V) − F_min，点是最小值。', 'F(V) − F_min at several temperatures; the dots are the minima.')], [0.42, L('平衡体积 V/V₀ 随温度（实线）；虚线是 Grüneisen 关系积分出来的。', 'Equilibrium volume V/V₀ against temperature (solid); dashed is the Grüneisen relation integrated.')]],
    note: L('一个原子 3 个同样的振子（Einstein 式），ω = ω₀ (V/V₀)^−γ，静态能 ½BV₀(V/V₀ − 1)²。F 的最小值用黄金分割求，α 用中心差分。Grüneisen 关系在这个模型里是严格的：所有模式的 γ 相同时 α = γC_V/(B_T V)，B_T 是包含振动部分的等温体模量。真实材料每个声子有自己的 γ，而且准谐近似在接近熔点时失效（声子之间的相互作用变得重要，第七章）。', 'Three identical oscillators per atom (Einstein-like), ω = ω₀ (V/V₀)^−γ, static energy ½BV₀(V/V₀ − 1)². The minimum of F is found by golden-section search and α by central differences. The Grüneisen relation is exact in this model: when all modes share one γ, α = γC_V/(B_T V), with B_T the isothermal bulk modulus including the vibrational part. In real materials each phonon has its own γ, and the quasi-harmonic approximation fails near melting (phonon–phonon interactions become important; chapter 7).'),
    draw(s, [fv, vv], c) {
      const Ts = [0.02, 0.5, 1, 2, 3], cols = [c.info, c.accent, c.gold, c.warn, c.danger], vs = lin(0.8, 1.35, 200);
      const ser = [], marks = [];
      Ts.forEach((T, i) => { const v0 = M.qhaVolume(T, s.g, s.B, s.zp), F0 = M.qhaF(v0, T, s.g, s.B, s.zp); ser.push({ xs: vs, ys: vs.map((v) => M.qhaF(v, T, s.g, s.B, s.zp) - F0), color: cols[i], width: 1.8, label: `T = ${T}` }); marks.push({ x: v0, y: 0, color: cols[i] }); });
      plot(fv, { x: [0.8, 1.35], y: [-0.3, 3], xl: 'V / V₀', yl: 'F − F_min', series: ser, marks: [], after: ({ ctx, X, Y }) => { for (const m of marks) { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 4, 0, 2 * PI); ctx.fill(); } } });
      const tg = lin(0.02, 3, 80), vT = tg.map((T) => M.qhaVolume(T, s.g, s.B, s.zp));
      // Grüneisen 关系逐步积分：dv/dT = v α = γ C / (v F_vv)
      const Fvv = (v, T) => { const h = 1e-4; return (M.qhaF(v + h, T, s.g, s.B, s.zp) - 2 * M.qhaF(v, T, s.g, s.B, s.zp) + M.qhaF(v - h, T, s.g, s.B, s.zp)) / (h * h); };
      const Cv = (v, T) => 3 * M.einsteinTerm(v ** -s.g / T);
      const vg = [vT[0]]; for (let i = 1; i < tg.length; i++) { const v = vg[i - 1], T = (tg[i] + tg[i - 1]) / 2; vg.push(v + ((s.g * Cv(v, T)) / (v * Fvv(v, T))) * (tg[i] - tg[i - 1])); }
      const lo = Math.min(...vT, ...vg), hi = Math.max(...vT, ...vg), pad = Math.max(0.002, (hi - lo) * 0.15);
      plot(vv, { x: [0, 3], y: [lo - pad, hi + pad], xl: 'T', yl: 'V / V₀', series: [{ xs: tg, ys: vT, color: c.accent, width: 2.4, label: L('F 的最小值', 'minimum of F') }, { xs: tg, ys: vg, color: c.gold, dash: [5, 4], width: 2, label: L('Grüneisen 关系', 'Grüneisen relation') }], marks: [{ x: s.T, y: M.qhaVolume(s.T, s.g, s.B, s.zp), color: c.gold }] });
      const v = M.qhaVolume(s.T, s.g, s.B, s.zp), dT = 1e-3, alpha = (M.qhaVolume(s.T + dT, s.g, s.B, s.zp) - M.qhaVolume(Math.max(1e-3, s.T - dT), s.g, s.B, s.zp)) / (s.T + dT - Math.max(1e-3, s.T - dT)) / v, est = (s.g * Cv(v, s.T)) / (v * v * Fvv(v, s.T));
      return [[L('平衡体积 V/V₀', 'Equilibrium volume V/V₀'), fix(v, 5), true], [L('零点能带来的膨胀（T → 0）', 'Expansion from zero-point energy (T → 0)'), `${fix(100 * (M.qhaVolume(0.005, s.g, s.B, true) - 1), 3)} %`], [L('膨胀系数 α（数值求导）', 'Expansion coefficient α (numerical)'), fmt(alpha, 4)], [L('Grüneisen 关系 γC_V/(B_T V)', 'Grüneisen relation γC_V/(B_T V)'), fmt(est, 4)]];
    },
  };

  // ── 9. FPU 链 ─────────────────────────────────────────────────
  const FPU = { harm: [0, 0, 1], alpha: [0.25, 0, 1], beta: [0, 1, 8] };
  const fpuFresh = (s) => { const [, , E] = FPU[s.model]; const st = M.fpuInit(32, E * s.e, 1); return { st, E0: M.fpuEnergy(st, FPU[s.model][0], FPU[s.model][1]), hist: [], t: 0 }; };
  DEMOS.fpu = {
    title: L('Fermi–Pasta–Ulam–Tsingou：非谐的链会不会把能量平分给所有模式', 'Fermi–Pasta–Ulam–Tsingou: does an anharmonic chain share its energy among all modes?'), kind: 'toy',
    intro: L('1953 年在 Los Alamos 的 MANIAC 计算机上，Fermi、Pasta、Ulam 和 Tsingou 想看非谐的原子链怎样“热化”：把全部能量放进最低的一个简正模，期待它慢慢平分给所有模式。结果能量只在前几个模式之间来回，过一段时间几乎全部回到第一个模式。这里是同样的 32 个原子、两端固定的链。谐振子链（α = β = 0）里简正模之间完全不交换能量；α 链会出现那个著名的“回归”；能量大的 β 链则更快地走向均分。', 'In 1953, on the MANIAC computer at Los Alamos, Fermi, Pasta, Ulam and Tsingou set out to watch an anharmonic chain of atoms “thermalise”: put all the energy into the lowest normal mode and expect it to spread evenly over all modes. Instead the energy sloshed among the first few modes and after a while came almost entirely back to the first. Here is the same 32-atom chain with fixed ends. In the harmonic chain (α = β = 0) the normal modes do not exchange energy at all; the α chain shows the famous recurrence; and the β chain at high energy heads for equipartition faster.'),
    sel: [['model', L('链', 'Chain'), [['harm', L('谐振子（α = β = 0）', 'Harmonic (α = β = 0)')], ['alpha', L('α 链，α = 0.25（原论文的设定）', 'α chain, α = 0.25 (the original setting)')], ['beta', L('β 链，β = 1，能量大', 'β chain, β = 1, high energy')]], 'alpha']],
    ctl: [['e', L('初始能量的倍数', 'Multiple of the initial energy'), 0.25, 3, 0.05, 1, (v) => `× ${v.toFixed(2)}`]],
    act: [[L('重新开始', 'Restart'), (s) => Object.assign(s, fpuFresh(s))]],
    state: () => ({ model: 'alpha', e: 1, ...fpuFresh({ model: 'alpha', e: 1 }) }), autoplay: true, fps: 20,
    changed(s, k) { if (k === 'model' || k === 'e' || !s.st) Object.assign(s, fpuFresh(s)); },
    tick(s) {
      const [al, be] = FPU[s.model];
      M.fpuStep(s.st, 0.1, 400, al, be);
      const m = M.fpuModes(s.st, 5);
      s.hist.push([s.st.t, ...m.map((x) => x / s.E0)]);
      if (s.hist.length > 700) s.hist.shift();
      return s.st.t < 4e5;
    },
    figs: [[0.3, L('32 个原子的位移 u_j（两端固定）。', 'Displacements u_j of the 32 atoms (ends fixed).')], [0.5, L('前五个简正模的能量占总能量的比例，横轴以第一个模式的周期 T₁ 为单位。', 'Energy fraction in the first five normal modes; time in units of the first mode’s period T₁.')]],
    note: L('m = K = 1，N = 32，速度 Verlet，Δt = 0.1。势 V = Σ[½Δ² + (α/3)Δ³ + (β/4)Δ⁴]。第一个模式的周期 T₁ = 2π/ω₁ ≈ 66。α 链的初始能量是 1（单位 K·a²），β 链是 8，滑块可以整体放大。回归在 α 链上大约一百多个 T₁ 时出现，但不会百分之百回到起点；能量再大、时间再长，链最终还是会热化，这在 FPU 以后几十年里才慢慢弄清楚（和 KAM 定理、孤子都有关，Berman 和 Izrailev 2005 年有综述）。', 'm = K = 1, N = 32, velocity Verlet, Δt = 0.1. Potential V = Σ[½Δ² + (α/3)Δ³ + (β/4)Δ⁴]. The first mode’s period is T₁ = 2π/ω₁ ≈ 66. The α chain starts with energy 1 (units K·a²), the β chain with 8; the slider scales both. On the α chain the recurrence comes after somewhat more than a hundred T₁, never returning fully to the start; with more energy or longer times the chain does eventually thermalise, which took decades after FPU to understand (it involves the KAM theorem and solitons; Berman and Izrailev reviewed it in 2005).'),
    draw(s, [cv, ev], c) {
      if (!s.st) Object.assign(s, fpuFresh(s));
      const { ctx, w, h } = fit(cv), N = s.st.N, dx = (w - 30) / (N + 1);
      let mx = 1e-9; for (let j = 1; j <= N; j++) mx = Math.max(mx, Math.abs(s.st.u[j]));
      const sc = (h * 0.38) / Math.max(mx, s.mx0 || mx); s.mx0 = Math.max(s.mx0 || 0, mx);
      ctx.strokeStyle = c.line; ctx.beginPath(); ctx.moveTo(15, h / 2); ctx.lineTo(w - 15, h / 2); ctx.stroke();
      ctx.strokeStyle = c.accent; ctx.lineWidth = 1.6; ctx.beginPath(); for (let j = 0; j <= N + 1; j++) { const X = 15 + j * dx, Y = h / 2 - s.st.u[j] * sc; if (j) ctx.lineTo(X, Y); else ctx.moveTo(X, Y); } ctx.stroke();
      for (let j = 0; j <= N + 1; j++) { ctx.fillStyle = j === 0 || j === N + 1 ? c.muted : c.ink2; ctx.beginPath(); ctx.arc(15 + j * dx, h / 2 - s.st.u[j] * sc, 3.6, 0, 2 * PI); ctx.fill(); }
      const T1 = (2 * PI) / M.fpuW(1, N), H = s.hist, t = H.map((q) => q[0] / T1), cols = [c.accent, c.gold, c.violet, c.info, c.danger];
      plot(ev, { x: [t[0] ?? 0, Math.max((t[0] ?? 0) + 5, t[t.length - 1] ?? 5)], y: [0, 1.05], xl: 't / T₁', yl: 'E_k / E', series: [0, 1, 2, 3, 4].map((k) => ({ xs: t, ys: H.map((q) => q[k + 1]), color: cols[k], width: k ? 1.5 : 2.2, label: `k = ${k + 1}` })) });
      const last = H[H.length - 1], [al, be] = FPU[s.model], drift = (M.fpuEnergy(s.st, al, be) - s.E0) / s.E0;
      return [[L('时间', 'Time'), `${fix(s.st.t / T1, 1)} T₁`], [L('第一个模式的能量', 'Energy in the first mode'), `${fix(100 * (last ? last[1] : 1), 1)} %`, true], [L('前五个模式合计', 'First five modes together'), `${fix(100 * (last ? last.slice(1).reduce((a, b) => a + b, 0) : 1), 1)} %`], [L('总能量的相对漂移', 'Relative drift of total energy'), fmt(drift)]];
    },
  };

  // ── 10. 热导率 ─────────────────────────────────────────────────
  DEMOS.kappa = {
    title: L('晶格热导率：边界、杂质和倒逆过程各管一段温度', 'Lattice thermal conductivity: boundaries, impurities and umklapp each rule a range of temperature'), kind: 'toy',
    intro: L('动理论说热导率 κ = ⅓ C v ℓ：热容、声速和声子平均自由程的乘积。低温时声子很少互相碰撞，自由程由样品的大小决定，κ ∝ C ∝ T³；高温时声子之间的倒逆（umklapp）过程越来越多，自由程变短，κ ∝ 1/T；中间有一个峰。点缺陷（同位素、杂质、合金）专门散射高频声子，把峰压低。拖动三个散射强度，看曲线怎样变。', 'Kinetic theory gives κ = ⅓ C v ℓ: heat capacity times sound speed times phonon mean free path. At low temperature phonons rarely collide, the mean free path is set by the sample size, and κ ∝ C ∝ T³; at high temperature umklapp processes between phonons multiply, the free path shrinks, and κ ∝ 1/T; in between lies a peak. Point defects (isotopes, impurities, alloying) scatter high-frequency phonons in particular and press the peak down. Drag the three scattering strengths and watch the curve change.'),
    ctl: [['lb', L('边界散射 log₁₀ b（样品越小越大）', 'Boundary scattering log₁₀ b (smaller sample = larger)'), -5, -1, 0.1, -3, (v) => v.toFixed(1)], ['la', L('点缺陷 log₁₀ A', 'Point defects log₁₀ A'), -4, 1, 0.1, -4, (v) => (v <= -3.95 ? L('无', 'none') : v.toFixed(1))], ['u', L('倒逆过程的强度 B', 'Umklapp strength B'), 0.2, 5, 0.1, 1, (v) => v.toFixed(1)]],
    btn: [[L('大块的纯晶体', 'Large pure crystal'), { lb: -4, la: -4, u: 1 }], [L('纳米线（边界强）', 'Nanowire (strong boundaries)'), { lb: -1.5, la: -4, u: 1 }], [L('合金（点缺陷强）', 'Alloy (strong point defects)'), { lb: -4, la: 0.5, u: 1 }]],
    figs: [[0.6, L('κ(T)（双对数，任意单位），横轴是 T/Θ_D。灰线是 T³ 和 1/T 的参考斜率。', 'κ(T) (log–log, arbitrary units) against T/Θ_D. Grey lines are reference slopes T³ and 1/T.')]],
    note: L('Debye 模型加单一弛豫时间：τ⁻¹ = b + A y⁴ + B y² t e^{−1/(3t)}，y = ħω/k_BΘ_D，t = T/Θ_D；κ ∝ t³ ∫₀^{1/t} x⁴eˣ/(eˣ−1)² τ dx。这是 Callaway 1959 年那类模型的最简形式，没有区分动量守恒的正常过程和倒逆过程（Callaway 正是为了这个加了修正），也没有区分纵波和横波。参数是无量纲的，只用来看形状；真实材料的热导率要用第一性原理的三声子散射解玻尔兹曼方程（第八章）。', 'Debye model with a single relaxation time: τ⁻¹ = b + A y⁴ + B y² t e^{−1/(3t)}, y = ħω/k_BΘ_D, t = T/Θ_D; κ ∝ t³ ∫₀^{1/t} x⁴eˣ/(eˣ−1)² τ dx. This is the barest form of the kind of model Callaway proposed in 1959, without separating momentum-conserving normal processes from umklapp (the very correction Callaway added) or longitudinal from transverse modes. Parameters are dimensionless and only show shapes; real thermal conductivities need first-principles three-phonon scattering fed into the Boltzmann equation (chapter 8).'),
    draw(s, [cv], c) {
      const p = { b: 10 ** s.lb, a: s.la <= -3.95 ? 0 : 10 ** s.la, u: s.u }, ts = lin(Math.log10(0.003), Math.log10(5), 140).map((x) => 10 ** x), ks = ts.map((t) => M.kappa(t, p));
      let ip = 0; ks.forEach((k, i) => { if (k > ks[ip]) ip = i; });
      const ylo = Math.floor(Math.log10(Math.min(...ks))), yhi = Math.ceil(Math.log10(Math.max(...ks)) + 0.2);
      const t0 = ts[0], k0 = ks[0], t9 = ts[ts.length - 1], k9 = ks[ks.length - 1];
      plot(cv, { x: [Math.log10(0.003), Math.log10(5)], y: [ylo, yhi], logx: true, logy: true, xl: 'T / Θ_D', yl: 'κ', series: [{ xs: ts, ys: ks, color: c.accent, width: 2.6 }, { xs: [t0, t0 * 10], ys: [k0, k0 * 1000], color: c.muted, dash: [4, 4], label: 'T³' }, { xs: [t9 / 10, t9], ys: [k9 * 10, k9], color: c.muted, dash: [2, 3], label: '1/T' }], marks: [{ x: ts[ip], y: ks[ip], color: c.gold }] });
      const sl = (t) => Math.log(M.kappa(t * 1.1, p) / M.kappa(t / 1.1, p)) / Math.log(1.21);
      return [[L('峰的位置 T/Θ_D', 'Peak at T/Θ_D'), fix(ts[ip], 3), true], [L('最低温处的斜率 d ln κ / d ln T', 'Slope d ln κ / d ln T at the lowest T'), fix(sl(0.004), 2)], [L('T = 3Θ_D 处的斜率', 'Slope at T = 3Θ_D'), fix(sl(3), 2)], [L('峰值 / 300 K 附近（T = 0.7Θ_D）', 'Peak / near 300 K (T = 0.7Θ_D)'), fix(ks[ip] / M.kappa(0.7, p), 1)]];
    },
  };

  // ── 11. 冻结声子 ───────────────────────────────────────────────
  DEMOS.frozen = {
    title: L('冻结声子：挪一个原子、算一次力，从超胞里得到整条色散', 'Frozen phonons: move one atom, compute the forces once, and get the whole dispersion from a supercell'), kind: 'exact',
    intro: L('phonopy 一类程序的做法：在一个 N 个原胞的超胞里把一个原子挪动一小段 h，算出所有原子受的力，力除以 h 就是力常数；再做傅里叶变换，就得到任意 q 的频率。超胞里只有 q = 2πn/(Na) 这些点是准确的（金点），之间是插值；力常数伸得比半个超胞远时（尾巴的范围 λ 大），插值会出错。h 太大会混进非谐项，力有噪声时 h 太小又会把噪声放大：机器学习势和 DFT 的力都有误差，所以 h 要折中。把晶格常数拉大到拐点以外，边界处的频率平方变成负数，画成负的“虚频”：链想要两两配对，结构不稳定。', 'How programs such as phonopy work: in a supercell of N primitive cells, move one atom by a small h, compute the forces on all atoms, and force divided by h gives the force constants; a Fourier transform then gives frequencies at any q. In the supercell only q = 2πn/(Na) are exact (the gold points), with interpolation between; when the force constants reach further than half the supercell (a long tail λ) the interpolation goes wrong. Too large an h mixes in anharmonic terms, while too small an h with noisy forces amplifies the noise: forces from machine-learned potentials and DFT both have errors, so h is a compromise. Stretch the lattice beyond the inflection point and the squared frequency at the zone boundary turns negative, drawn as a negative “imaginary frequency”: the chain wants to pair up, and the structure is unstable.'),
    ctl: [['lam', L('排斥尾巴的范围 λ（越大越长程）', 'Range λ of the repulsive tail (larger = longer range)'), 0.2, 2.5, 0.05, 0.5, (v) => v.toFixed(2)], ['a', L('晶格常数 a / rₑ', 'Lattice constant a / rₑ'), 0.9, 1.7, 0.01, 1, (v) => v.toFixed(2)], ['N', L('超胞里的原胞数 N', 'Primitive cells in the supercell N'), 2, 16, 1, 4, String], ['lh', L('位移 log₁₀ h', 'Displacement log₁₀ h'), -3, -0.5, 0.05, -2, (v) => `h = ${fmt(10 ** v, 2)}`], ['noise', L('力的噪声 σ_F', 'Force noise σ_F'), 0, 0.05, 0.001, 0, (v) => v.toFixed(3)]],
    btn: [[L('phonopy 的默认位移 0.01', 'phonopy-like displacement 0.01'), { lh: -2 }], [L('拉过拐点：不稳定', 'Stretched past the inflection: unstable'), { a: 1.55, lam: 0.3 }], [L('长程：超胞不够大', 'Long range: supercell too small'), { lam: 2, N: 3, a: 1 }], [L('有噪声又挪得太少', 'Noisy forces, tiny displacement'), { noise: 0.01, lh: -3 }]],
    figs: [[0.6, L('色散：灰色是解析的谐振结果，彩色是从超胞力常数插值的，金点是超胞里准确的 q。负值表示虚频。', 'Dispersion: grey is the exact harmonic result, colour is interpolated from the supercell force constants, gold points are the q exact in the supercell. Negative values are imaginary frequencies.')]],
    note: L('一维链，m = 1。最近邻的键是 Morse 势（阱深 1，平衡距离 rₑ = 1，α = 2），再加一条排斥的指数尾巴 2λ² e^{−(r−1)/λ}，它的二阶导数处处为正，只用来调力常数伸多远（只靠减小 Morse 的 α 不行：那样远处的 φ″ 是负的，长波自己就不稳定了）。势在 r = 5.537 截断并把力平移到零；超胞计入所有周期像。力常数 Φ(j) = −∂F_j/∂u₀，ω²(q) = Σ_j Φ(j) cos(q x_j)，x_j 取最近的周期像。链有反演对称，−h 那一次的力可以由 +h 的力反过来得到，所以只要一次力计算，结果和中心差分完全一样；没有这种对称时要 ±h 各算一次。噪声是在每个力分量上加独立的高斯噪声，模拟机器学习势或没收敛的 DFT。', 'One-dimensional chain, m = 1. The nearest-neighbour bond is a Morse potential (well depth 1, equilibrium distance rₑ = 1, α = 2), plus a repulsive exponential tail 2λ² e^{−(r−1)/λ} whose second derivative is positive everywhere and serves only to set how far the force constants reach (lowering the Morse α will not do: its distant φ″ is negative and the long waves become unstable by themselves). The potential is truncated at r = 5.537 with the force shifted to zero; all periodic images are included. Force constants Φ(j) = −∂F_j/∂u₀, ω²(q) = Σ_j Φ(j) cos(q x_j), x_j the nearest periodic image. The chain has inversion symmetry, so the forces for −h follow from those for +h: one force calculation suffices and gives exactly the central-difference result; without such symmetry ±h need one calculation each. The noise is independent Gaussian noise on each force component, standing in for a machine-learned potential or unconverged DFT.'),
    draw(s, [cv], c) {
      const h = 10 ** s.lh, Phi = M.fdConstants(s.N, s.a, h, s.lam, { central: true, noise: s.noise, seed: 3 }), qs = lin(0, PI / s.a, 200);
      const ex = qs.map((q) => M.signedW(M.pairW2(q, s.a, s.lam))), fd = qs.map((q) => M.signedW(M.fdW2(q, Phi, s.a)));
      const com = Array.from({ length: Math.floor(s.N / 2) + 1 }, (_, n) => (2 * PI * n) / (s.N * s.a));
      const lo = Math.min(0, ...ex, ...fd), hi = Math.max(...ex, ...fd, 0.5);
      plot(cv, { x: [0, PI / s.a], y: [lo - 0.1 * (hi - lo), hi * 1.12], xl: 'q', yl: L('ω（负 = 虚频）', 'ω (negative = imaginary)'), xt: [0, PI / (2 * s.a), PI / s.a], xf: (t) => (t === 0 ? 'Γ' : t > PI / s.a - 1e-9 ? 'π/a' : 'π/2a'), series: [{ xs: qs, ys: ex, color: c.muted, width: 4, alpha: 0.55, label: L('解析', 'exact') }, { xs: qs, ys: fd, color: c.accent, width: 2, label: L('超胞插值', 'supercell interpolation') }, { xs: com, ys: com.map((q) => M.signedW(M.fdW2(q, Phi, s.a))), dots: 4.5, color: c.gold }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const err = Math.max(...qs.map((q, i) => Math.abs(fd[i] - ex[i]))), cerr = Math.max(...com.map((q) => Math.abs(M.signedW(M.fdW2(q, Phi, s.a)) - M.signedW(M.pairW2(q, s.a, s.lam))))), w2b = M.pairW2(PI / s.a, s.a, s.lam);
      return [[L('整条曲线的最大误差', 'Largest error along the curve'), fmt(err, 3), true], [L('准确点上的误差', 'Error at the exact points'), fmt(cerr, 3)], [L('力的计算次数', 'Force calculations'), L('1（反演对称省掉 −h）', '1 (inversion symmetry saves −h)')], [L('超胞长度 / 势的截断', 'Supercell length / cutoff'), `${fix(s.N * s.a, 2)} / 5.54`], [L('边界处 ω²', 'ω² at the zone boundary'), w2b < 0 ? `${fix(w2b, 3)}（${L('虚频：不稳定', 'imaginary: unstable')}）` : fix(w2b, 3)], [L('最近邻的拐点 a / rₑ', 'Nearest-neighbour inflection a / rₑ'), (Number.isFinite(M.inflection(s.lam)) ? fix(M.inflection(s.lam), 3) : L('没有（尾巴撑住了）', 'none (the tail holds it up)'))]];
    },
  };
};
