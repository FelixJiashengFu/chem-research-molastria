'use strict';
// 电磁学与介电（/em/）的十五个演示。数学都在 em-models.js（纯函数，tools/em-test.mjs 测）。em.js 用 window.MOLASTRIA_EM_DEMOS(K, DEMOS) 把它们登记进去。
// 写法同准粒子的 quasiparticles/quasi-demos.js：title，kind，intro，sel，ctl，chk，btn，act，state，autoplay，fps + tick(s)，changed，figs，note，draw(s, 图, 颜色) 返回读数。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。
window.MOLASTRIA_EM_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_EM_MODELS;
  const { L, fix, fmt, plot, lin, font, pct } = K;
  const PI = Math.PI, C = M.C;

  // 在坐标图里铺一层色块：f(x, y) 的正值用 cPos、负值用 cNeg，透明度按 |f|/vmax
  function heat(g, xr, yr, nx, ny, f, cPos, cNeg, vmax, alpha = 0.75) {
    const { ctx, X, Y } = g, dx = (xr[1] - xr[0]) / nx, dy = (yr[1] - yr[0]) / ny;
    for (let j = 0; j < ny; j++) for (let i = 0; i < nx; i++) {
      const x = xr[0] + (i + 0.5) * dx, y = yr[0] + (j + 0.5) * dy, v = f(x, y);
      if (!Number.isFinite(v) || v === 0) continue;
      ctx.globalAlpha = alpha * Math.min(1, Math.abs(v) / vmax); ctx.fillStyle = v > 0 ? cPos : cNeg;
      const x0 = X(x - dx / 2), x1 = X(x + dx / 2), y0 = Y(y + dy / 2), y1 = Y(y - dy / 2);
      ctx.fillRect(Math.floor(x0), Math.floor(y0), Math.ceil(x1 - x0) + 1, Math.ceil(y1 - y0) + 1);
    }
    ctx.globalAlpha = 1;
  }
  // 等值线（简化的 marching squares）：G[j][i] 是 (xs[i], ys[j]) 上的值
  function contour(g, xs, ys, G, levels, color, width = 1) {
    const { ctx, X, Y } = g;
    ctx.strokeStyle = color; ctx.lineWidth = width; ctx.beginPath();
    for (let j = 0; j < ys.length - 1; j++) for (let i = 0; i < xs.length - 1; i++) {
      const v = [G[j][i], G[j][i + 1], G[j + 1][i + 1], G[j + 1][i]];
      if (v.some((q) => !Number.isFinite(q))) continue;
      const lo = Math.min(...v), hi = Math.max(...v);
      const P = [[xs[i], ys[j]], [xs[i + 1], ys[j]], [xs[i + 1], ys[j + 1]], [xs[i], ys[j + 1]]];
      for (const lv of levels) {
        if (lv < lo || lv > hi) continue;
        const pts = [];
        for (let e = 0; e < 4; e++) { const a = v[e], b = v[(e + 1) % 4]; if ((a < lv) !== (b < lv)) { const t = (lv - a) / (b - a), p = P[e], q = P[(e + 1) % 4]; pts.push([p[0] + t * (q[0] - p[0]), p[1] + t * (q[1] - p[1])]); } }
        for (let k = 0; k + 1 < pts.length; k += 2) { ctx.moveTo(X(pts[k][0]), Y(pts[k][1])); ctx.lineTo(X(pts[k + 1][0]), Y(pts[k + 1][1])); }
      }
    }
    ctx.stroke();
  }
  const grid = (xs, ys, f) => ys.map((y) => xs.map((x) => f(x, y)));
  const dot = (g, x, y, r, color, label) => { const { ctx, X, Y } = g; ctx.fillStyle = color; ctx.beginPath(); ctx.arc(X(x), Y(y), r, 0, 2 * PI); ctx.fill(); if (label) { ctx.fillStyle = '#fff'; ctx.font = font(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle'; ctx.fillText(label, X(x), Y(y) + 0.5); ctx.textBaseline = 'alphabetic'; } };
  const sgn = (q) => (q > 0 ? '+' : q < 0 ? '−' : '');

  // ── 1. 场线和高斯定律 ─────────────────────────────────────────────
  DEMOS.fieldlines = {
    title: L('点电荷的电场线：叠加原理和高斯定律', 'Field lines of point charges: superposition and Gauss’s law'), kind: 'exact',
    intro: L('库仑定律加叠加原理就是全部的静电学。左边固定一个 +1 的电荷，右边那个的电荷和距离可以调。场线从正电荷出发、到负电荷结束，条数正比于电荷量；场线疏密就是场强。底色是电势（红正蓝负）。读数里的电通量是在电荷周围一个小球面上数值积分出来的，不管别的电荷怎么摆，它都等于球里的电荷：这就是高斯定律。', 'Coulomb’s law plus superposition is all of electrostatics. A charge of +1 sits on the left; the charge and distance of the one on the right can be changed. Field lines start on positive charges and end on negative ones, their number proportional to the charge; their density is the field strength. The background is the potential (red positive, blue negative). The flux in the readout is integrated numerically over a small sphere round a charge, and however the other charges are placed it equals the charge inside: that is Gauss’s law.'),
    sel: [['cfg', L('电荷的摆法', 'Arrangement'), [['two', L('两个电荷', 'Two charges')], ['quad', L('四极子（正方形 + − + −）', 'Quadrupole (square + − + −)')], ['line', L('一排三个（+ −2 +）：线形四极子', 'Three in a row (+ −2 +): linear quadrupole')]], 'two']],
    ctl: [['q2', L('右边电荷 q₂', 'Right charge q₂'), -3, 3, 0.5, -1, (v) => `${v > 0 ? '+' : v < 0 ? '−' : ''}${Math.abs(v)}`], ['d', L('两电荷的距离', 'Separation'), 0.6, 2.6, 0.1, 1.6, (v) => v.toFixed(1)]],
    chk: [['map', L('显示电势', 'Show the potential'), true]],
    btn: [[L('电偶极子', 'Dipole'), { cfg: 'two', q2: -1 }], [L('同号电荷', 'Like charges'), { cfg: 'two', q2: 1 }], [L('+1 和 −2', '+1 and −2'), { cfg: 'two', q2: -2 }]],
    figs: [[0.66, L('电场线（RK4 沿场方向积分）和电势。场线条数按每单位电荷 12 条。', 'Field lines (integrated along the field with RK4) and the potential. Twelve lines per unit charge.')]],
    note: L('三维点电荷的库仑场在 z = 0 平面上的切面，单位取 k = 1。场线从每个正电荷均匀地发出 12|q| 条；总电荷为负时再从负电荷逆着场发出一些（那些线从无穷远来）。二维图上的场线疏密只是近似地表示场强：真正和场强成正比的是三维里的线密度。电通量用 80 × 160 个点在半径 0.35 的球面上积分。', 'A z = 0 slice through the three-dimensional Coulomb field of point charges, in units with k = 1. Each positive charge emits 12|q| evenly spaced lines; when the total charge is negative some more are drawn backwards from the negative charges (those lines come in from infinity). The line density on a 2D picture only approximates the field strength: what is strictly proportional is the line density in 3D. The flux is integrated on a sphere of radius 0.35 with 80 × 160 points.'),
    draw(s, [cv], c) {
      const d = s.d, ch = s.cfg === 'quad' ? [{ x: -d / 2, y: -d / 2, q: 1 }, { x: d / 2, y: -d / 2, q: -1 }, { x: d / 2, y: d / 2, q: 1 }, { x: -d / 2, y: d / 2, q: -1 }]
        : s.cfg === 'line' ? [{ x: -d, y: 0, q: 1 }, { x: 0, y: 0, q: -2 }, { x: d, y: 0, q: 1 }] : [{ x: -d / 2, y: 0, q: 1 }, { x: d / 2, y: 0, q: s.q2 }].filter((x) => x.q !== 0);
      const tot = ch.reduce((a, b) => a + b.q, 0), box = 3;
      const lines = [];
      for (const q of ch) {
        const n = Math.round(12 * Math.abs(q.q)), dir = q.q > 0 ? 1 : -1;
        if (dir < 0 && tot >= 0) continue;
        for (let k = 0; k < n; k++) { const a = ((k + 0.5) / n) * 2 * PI; lines.push(M.traceLine(ch, q.x + 0.06 * Math.cos(a), q.y + 0.06 * Math.sin(a), dir, 0.025, 700, box)); }
      }
      plot(cv, { x: [-box, box], y: [-2, 2], eq: true, xt: [], yt: [], after: (g) => {
        if (s.map) heat(g, [-box, box], [-2.2, 2.2], 120, 90, (x, y) => M.potential3(ch, x, y), c.danger, c.info, 2.5, 0.45);
        const { ctx, X, Y } = g; ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.2; ctx.globalAlpha = 0.9;
        for (const pts of lines) { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(X(x), Y(y)) : ctx.moveTo(X(x), Y(y)))); ctx.stroke(); }
        ctx.globalAlpha = 1;
        for (const q of ch) dot(g, q.x, q.y, 9, q.q > 0 ? c.danger : c.info, sgn(q.q));
      } });
      const flux = M.fluxSphere(ch, ch[0].x, ch[0].y, 0, 0.35, 80) / (4 * PI);
      let neutral = '—';
      if (s.cfg === 'two' && ch.length === 2 && s.q2 !== -1) {
        // 轴上 E = 0 的点：解 1/(x + d/2)² · sign + q₂/(x − d/2)² · sign = 0，二分
        const E = (x) => M.field3(ch, x, 0)[0];
        const scan = lin(-box, box, 1201); for (let i = 1; i < scan.length; i++) { const a = scan[i - 1], b = scan[i]; if (ch.some((q) => Math.abs(q.x - a) < 0.02 || Math.abs(q.x - b) < 0.02 || (q.x > a && q.x < b))) continue; if (E(a) * E(b) < 0) { let lo = a, hi = b; for (let k = 0; k < 50; k++) { const m = (lo + hi) / 2; if (E(lo) * E(m) <= 0) hi = m; else lo = m; } neutral = `x = ${fix((lo + hi) / 2, 3)}`; break; } }
      }
      return [[L('左边电荷周围球面的通量 Φ/4π', 'Flux Φ/4π through a sphere round the left charge'), fix(flux, 4), true], [L('球里的电荷', 'Charge inside the sphere'), fix(ch[0].q, 0)], [L('总电荷', 'Total charge'), fix(tot, 1)], [L('轴上场强为零的点', 'Point of zero field on the axis'), neutral]];
    },
  };

  // ── 2. 拉普拉斯方程的迭代解 ──────────────────────────────────────
  DEMOS.laplace = {
    title: L('解拉普拉斯方程：松弛法和它的收敛速度', 'Solving Laplace’s equation: relaxation and how fast it converges'), kind: 'exact',
    intro: L('一个正方形盒子，上边接 1 V，另外三边接地，里面没有电荷，电势满足 ∇²V = 0。离散成格子以后，这个方程就是“每个格点的值等于四个邻居的平均”。从全零开始反复做这个平均，电势会慢慢“渗”进盒子里。中心点的值有一个漂亮的精确答案：四条边各接 1 V 时整个盒子都是 1 V，由叠加原理，只接一条边时中心正好是 1/4。看三种方法要扫多少遍才到。', 'A square box with its top edge at 1 V and the other three grounded, with no charge inside, so the potential obeys ∇²V = 0. On a grid this equation says “each point equals the average of its four neighbours”. Start from zero and repeat the averaging, and the potential slowly “soaks” into the box. The centre has a neat exact answer: with all four edges at 1 V the whole box is at 1 V, so by superposition one edge alone gives exactly 1/4 at the centre. See how many sweeps each method needs to get there.'),
    sel: [['meth', L('方法', 'Method'), [['jacobi', 'Jacobi'], ['gs', 'Gauss–Seidel'], ['sor', L('超松弛 SOR（最优 ω）', 'SOR (optimal ω)')]], 'gs'], ['n', L('格点数（每边）', 'Grid points per side'), [['21', '21'], ['41', '41'], ['61', '61']], '41']],
    act: [[L('重新开始', 'Restart'), (s) => { s.st = null; }]],
    fps: 15,
    tick(s) { const per = s.meth === 'jacobi' ? 6 : 3; for (let i = 0; i < per; i++) { const r = M.laplaceSweep(s.st, s.meth === 'sor' ? M.sorOmega(s.st.n) : 1, s.meth === 'jacobi'); s.hist.push(r); if (r < 1e-10) return false; } return s.st.it < 6000; },
    changed(s, k) { if (k === 'meth' || k === 'n' || !s.st) s.st = null; },
    figs: [[0.82, L('电势 V(x, y)（颜色）和等势线（0.05 V 一条）。', 'Potential V(x, y) (colour) and equipotentials every 0.05 V.')], [0.42, L('每一遍扫过后电势最大的改变量（对数坐标）。改变量小于 10⁻¹⁰ 就停。', 'Largest change of the potential in each sweep (log scale). It stops once the change is below 10⁻¹⁰.')]],
    note: L('五点差分 V_ij = (V_i±1,j + V_i,j±1)/4。Jacobi 用上一遍的值，Gauss–Seidel 随算随用，SOR 把每一步的改动放大 ω = 2/(1 + sin(π/(n − 1))) 倍。对 n × n 的格子，Jacobi 和 Gauss–Seidel 要扫 ~n² 遍才收敛，SOR 只要 ~n 遍。解析解是 Fourier 级数 V = Σ_{k 奇} (4/kπ) sin(kπx) sinh(kπy)/sinh(kπ)；两个上角取 0.5 V。', 'Five-point stencil V_ij = (V_i±1,j + V_i,j±1)/4. Jacobi uses the previous sweep’s values, Gauss–Seidel uses new values as soon as they are computed, and SOR multiplies each update by ω = 2/(1 + sin(π/(n − 1))). On an n × n grid Jacobi and Gauss–Seidel need ~n² sweeps to converge, SOR only ~n. The analytic solution is the Fourier series V = Σ_{k odd} (4/kπ) sin(kπx) sinh(kπy)/sinh(kπ); the two top corners are set to 0.5 V.'),
    draw(s, [a, b], c) {
      if (!s.st) { s.st = M.laplaceInit(Number(s.n)); s.hist = []; }
      const { n, V } = s.st, xs = lin(0, 1, n);
      plot(a, { x: [0, 1], y: [0, 1], eq: true, xl: 'x', yl: 'y', after: (g) => {
        heat(g, [0, 1], [0, 1], n, n, (x, y) => V[Math.min(n - 1, Math.round(y * (n - 1)))][Math.min(n - 1, Math.round(x * (n - 1)))], c.gold, c.info, 1, 0.8);
        contour(g, xs, xs, V, lin(0.05, 0.95, 19), c.ink2, 1);
        dot(g, 0.5, 0.5, 4, c.danger);
      } });
      const h = s.hist.length ? s.hist : [1];
      plot(b, { logy: true, x: [0, Math.max(50, h.length)], y: [-10, 0], xl: L('扫的遍数', 'sweeps'), yl: L('最大改变', 'max change'), series: [{ xs: h.map((_, i) => i + 1), ys: h, color: c.accent, width: 2 }] });
      const mid = V[(n - 1) / 2][(n - 1) / 2], q = Math.round(0.25 * (n - 1)), num = V[n - 1 - q][q], ana = M.boxAnalytic(q / (n - 1), (n - 1 - q) / (n - 1));
      return [[L('已扫遍数', 'Sweeps so far'), String(s.st.it)], [L('中心电势（精确值 0.25）', 'Centre potential (exact 0.25)'), fix(mid, 5), true], [L('(¼, ¾) 处：格子 / 级数', 'At (¼, ¾): grid / series'), `${fix(num, 4)} / ${fix(ana, 4)}`], [L('最近一遍的最大改变', 'Last sweep’s largest change'), fmt(h[h.length - 1], 2)]];
    },
  };

  // ── 3. 多极展开 ─────────────────────────────────────────────────
  const MOLS = { water: L('水（TIP3P 电荷）', 'Water (TIP3P charges)'), co2: L('二氧化碳（EPM2 电荷）', 'Carbon dioxide (EPM2 charges)'), methane: L('甲烷（OPLS 式电荷）', 'Methane (OPLS-style charges)') };
  DEMOS.multipole = {
    title: L('多极展开：离得越远，越只剩最低的那一阶', 'The multipole expansion: the further away, the more only the lowest order survives'), kind: 'exact',
    intro: L('一个分子的电势在远处可以按 1/r、1/r²、1/r³…展开：单极（总电荷）、偶极、四极、八极。中性分子没有单极项；水有偶极，所以远处像 1/r²；CO₂ 对称，偶极为零，第一项是四极（1/r³）；甲烷是正四面体，偶极和四极都为零，第一项是八极（1/r⁴）。哪一阶第一个不为零，是对称性决定的。截到第 L 阶，误差按 1/r^{L+2} 下降。', 'Far away, a molecule’s potential can be expanded in 1/r, 1/r², 1/r³…: monopole (total charge), dipole, quadrupole, octupole. A neutral molecule has no monopole; water has a dipole, so far away it looks like 1/r²; CO₂ is symmetric, its dipole vanishes and the first term is the quadrupole (1/r³); methane is a regular tetrahedron with no dipole or quadrupole, so the first term is the octupole (1/r⁴). Which order is the first non-zero one is decided by symmetry. Truncated at order L, the error falls off as 1/r^{L+2}.'),
    sel: [['mol', L('分子', 'Molecule'), Object.entries(MOLS), 'water']],
    ctl: [['L', L('截到第 L 阶', 'Truncate at order L'), 0, 4, 1, 1, (v) => ['0 · ' + L('单极', 'monopole'), '1 · ' + L('偶极', 'dipole'), '2 · ' + L('四极', 'quadrupole'), '3 · ' + L('八极', 'octupole'), '4 · ' + L('十六极', 'hexadecapole')][v]], ['th', L('方向 θ（与 z 轴的夹角）', 'Direction θ (angle from the z axis)'), 0, 180, 5, 35, (v) => `${v}°`]],
    figs: [[0.55, L('截断误差 |V − V_L| / max|V|（双对数）。实线是选中的 L，虚线是其他阶；斜率是 −(L + 2)。', 'Truncation error |V − V_L| / max|V| (log–log). Solid: the chosen L; dashed: other orders. The slope is −(L + 2).')], [0.42, L('沿选定方向的电势：精确（黑）和截断（金）。', 'Potential along the chosen direction: exact (black) and truncated (gold).')]],
    note: L('点电荷模型：TIP3P 水（O −0.834 e、H +0.417 e，O–H 0.9572 Å，104.52°）[Jorgensen 1983]，EPM2 二氧化碳（C +0.6512 e，C–O 1.149 Å）[Harris & Yung 1995]，甲烷取 C −0.24 e、H +0.06 e、C–H 1.09 Å。原点放在 O 或 C 上：对有偶极的水，四极矩的数值和原点的选法有关。势的单位是 e/(4πε₀·Å)，r 用 Å。用 Legendre 多项式 Σ q r_iˡ P_l(cos γ)/r^{l+1} 展开，没有用球谐函数的张量写法，两者等价。', 'Point-charge models: TIP3P water (O −0.834 e, H +0.417 e, O–H 0.9572 Å, 104.52°) [Jorgensen 1983], EPM2 carbon dioxide (C +0.6512 e, C–O 1.149 Å) [Harris & Yung 1995], and methane with C −0.24 e, H +0.06 e, C–H 1.09 Å. The origin is on O or C; for water, which has a dipole, the quadrupole moment depends on the choice of origin. Potentials in e/(4πε₀·Å), r in Å. The expansion uses Legendre polynomials Σ q r_iˡ P_l(cos γ)/r^{l+1} rather than the spherical-tensor form; the two are equivalent.'),
    draw(s, [a, b], c) {
      const Q = M.MOLECULES[s.mol], th = (s.th * PI) / 180, dir = [Math.sin(th) * 0.6, Math.sin(th) * 0.8, Math.cos(th)];
      const rs = Array.from({ length: 80 }, (_, i) => 10 ** (0.35 + (i / 79) * 1.5)), P = (r) => dir.map((u) => u * r);
      const vmax = Math.max(...rs.map((r) => Math.abs(M.exactV(Q, P(r))))) || 1;
      const series = [0, 1, 2, 3, 4].map((Lk) => ({ xs: rs, ys: rs.map((r) => Math.abs(M.exactV(Q, P(r)) - M.multipoleV(Q, P(r), Lk)) / vmax), color: Lk === s.L ? c.gold : c.muted, width: Lk === s.L ? 2.4 : 1, dash: Lk === s.L ? [] : [4, 4], label: Lk === s.L ? `L = ${Lk}` : undefined }));
      plot(a, { logx: true, logy: true, x: [0.35, 1.85], y: [-9, 0.5], xl: 'r (Å)', yl: L('相对误差', 'relative error'), series });
      const r2 = lin(1.6, 8, 160);
      plot(b, { x: [1.6, 8], y: (() => { const v = r2.map((r) => M.exactV(Q, P(r))), lo = Math.min(...v, 0), hi = Math.max(...v, 0); return [lo - 0.1 * (hi - lo + 1e-9), hi + 0.1 * (hi - lo + 1e-9)]; })(), xl: 'r (Å)', yl: 'V', series: [{ xs: r2, ys: r2.map((r) => M.exactV(Q, P(r))), color: c.ink, width: 2, label: L('精确', 'exact') }, { xs: r2, ys: r2.map((r) => M.multipoleV(Q, P(r), s.L)), color: c.gold, width: 2, dash: [6, 4], label: `L = ${s.L}` }] });
      const mo = M.moments(Q), th2 = mo.Th[2][2] * mo.eA2toB, lead = Math.abs(mo.q) > 1e-9 ? 0 : mo.muD > 1e-6 ? 1 : Math.abs(th2) > 1e-6 || Math.abs(mo.Th[0][0]) > 1e-9 ? 2 : 3;
      const e5 = Math.abs(M.exactV(Q, P(5)) - M.multipoleV(Q, P(5), s.L)) / Math.abs(M.exactV(Q, P(5)) || 1);
      return [[L('偶极矩', 'Dipole moment'), `${fix(mo.muD, 3)} D`, true], [L('四极矩 Θ_zz', 'Quadrupole Θ_zz'), `${fix(th2, 2)} B`], [L('第一个不为零的阶', 'First non-zero order'), ['0 · ' + L('单极', 'monopole'), '1 · ' + L('偶极', 'dipole'), '2 · ' + L('四极', 'quadrupole'), '3 · ' + L('八极', 'octupole')][lead]], [L('r = 5 Å 处的相对误差', 'Relative error at r = 5 Å'), pct(e5, 2)]];
    },
  };

  // ── 4. 极性分子和介电常数 ───────────────────────────────────────
  const GASN = { h2o: 'H₂O', nh3: 'NH₃', hcl: 'HCl', co: 'CO', ch4: 'CH₄' };
  const LIQN = { water: L('水', 'water'), methanol: L('甲醇', 'methanol'), dmso: 'DMSO', acetonitrile: L('乙腈', 'acetonitrile'), acetone: L('丙酮', 'acetone'), chloroform: L('氯仿', 'chloroform') };
  DEMOS.polar = {
    title: L('从分子到介电常数：Debye、Clausius–Mossotti 和 Onsager', 'From molecules to the dielectric constant: Debye, Clausius–Mossotti and Onsager'), kind: 'exact',
    intro: L('一个分子在电场里有两种响应：电子云被拉歪（极化率 α，几乎不随温度变），已有的偶极转向电场（取向，和 μ²/3kT 成正比，越冷越强）。气体里分子互不干扰，Debye 把两者加起来，摩尔极化对 1/T 画是一条直线：截距给 α，斜率给 μ²。液体难得多：直接把同样的公式搬过去（Clausius–Mossotti），水会“极化灾难”、ε 发散。Onsager 1936 年用空腔里的反应场修正，得到有限的 ε，但对水只有约 29；剩下的差距要靠分子间的取向关联（Kirkwood 的 g 因子）。', 'A molecule responds to a field in two ways: its electron cloud distorts (polarisability α, nearly independent of temperature) and any permanent dipole turns towards the field (orientation, proportional to μ²/3kT, stronger when colder). In a gas the molecules do not disturb each other; Debye added the two, so the molar polarisation plotted against 1/T is a straight line whose intercept gives α and slope gives μ². Liquids are much harder: carrying the same formula over (Clausius–Mossotti), water suffers a “polarisation catastrophe” and ε diverges. In 1936 Onsager corrected it with the reaction field in a cavity and got a finite ε, but only about 29 for water; the rest of the gap needs orientational correlations between molecules (Kirkwood’s g factor).'),
    sel: [['gas', L('气体', 'Gas'), Object.entries(GASN), 'h2o'], ['liq', L('液体（25 °C）', 'Liquid (25 °C)'), Object.entries(LIQN), 'water']],
    ctl: [['T', L('气体的温度', 'Gas temperature'), 200, 700, 5, 373, (v) => `${v} K`]],
    figs: [[0.5, L('Debye 图：摩尔极化 P_m 对 1000/T。直线的截距是电子极化，斜率正比于 μ²。CH₄ 没有偶极，是水平线。', 'Debye plot: molar polarisation P_m against 1000/T. The intercept is the electronic polarisation and the slope is proportional to μ². CH₄ has no dipole and gives a horizontal line.')], [0.45, L('选中液体的 ε：Onsager 方程乘上 Kirkwood 因子 g 以后随 g 怎样变；横虚线是实验值。', 'ε of the chosen liquid from Onsager’s equation multiplied by Kirkwood’s factor g, as g varies; the dashed line is experiment.')]],
    note: L('P_m = (4π/3)N_A[α′ + μ²/(4πε₀·3k_BT)]，α′ 是极化率体积（Å³）。气体的 α′ 和 μ 是常见的文献值（CRC 手册一类），水的 μ = 1.855 D [Dyke & Muenter 1973]。液体：Onsager 方程 (ε − n²)(2ε + n²)/[ε(n² + 2)²] = gNμ²/(9ε₀k_BT)，N 由密度和摩尔质量算，n 是钠 D 线的折射率，μ 用气相值，实验的 ε 是 25 °C 的常见值。真实液体里分子还会被周围的场极化，偶极比气相大，这里没有算进去：所以“需要的 g”同时吸收了取向关联和极化增强。', 'P_m = (4π/3)N_A[α′ + μ²/(4πε₀·3k_BT)], with α′ the polarisability volume (Å³). Gas-phase α′ and μ are common literature values (CRC Handbook and the like); for water μ = 1.855 D [Dyke & Muenter 1973]. Liquids: Onsager’s equation (ε − n²)(2ε + n²)/[ε(n² + 2)²] = gNμ²/(9ε₀k_BT), with N from the density and molar mass, n the sodium-D refractive index, μ the gas-phase value and ε a common 25 °C value. In a real liquid molecules are further polarised by their surroundings and their dipoles exceed the gas-phase value; that is not included, so the “g needed” absorbs both orientational correlation and this enhancement.'),
    draw(s, [a, b], c) {
      const iT = lin(1000 / 700, 1000 / 200, 60);
      const series = Object.keys(GASN).map((k) => ({ xs: iT, ys: iT.map((x) => M.molarPol(M.GASES[k].alpha, M.GASES[k].mu, 1000 / x)), color: k === s.gas ? c.gold : c.muted, width: k === s.gas ? 2.6 : 1.2, label: GASN[k] }));
      plot(a, { x: [iT[0], iT[iT.length - 1]], y: [0, 160], xl: '1000/T (K⁻¹)', yl: 'P_m (cm³/mol)', series, marks: [{ x: 1000 / s.T, color: c.danger }] });
      const Lq = M.LIQUIDS[s.liq], N = M.liquidDensity(Lq), gs = lin(0.3, 4, 80);
      const epsOn = M.onsager(N, Lq.mu, Lq.T, Lq.n ** 2), gNeed = M.kirkwoodG(N, Lq.mu, Lq.T, Lq.n ** 2, Lq.eps);
      plot(b, { x: [0.3, 4], y: [0, Math.max(100, Lq.eps * 1.4)], xl: L('Kirkwood 因子 g', 'Kirkwood factor g'), yl: 'ε', series: [{ xs: gs, ys: gs.map((g) => M.onsager(N, Lq.mu, Lq.T, Lq.n ** 2, g)), color: c.accent, width: 2.2 }], hmarks: [{ y: Lq.eps, color: c.danger }], marks: [{ x: 1, color: c.line, y: epsOn }, { x: gNeed, color: c.gold, y: Lq.eps }] });
      const G = M.GASES[s.gas], ov = M.orientVol(G.mu, s.T), cm = M.clausius(N, 1.0 * (Lq.n ** 2 - 1) / (Lq.n ** 2 + 2) / (N * (4 * PI / 3) * 1e-30) + M.orientVol(Lq.mu, Lq.T));
      return [[L(`${GASN[s.gas]} 在 ${s.T} K：取向 / 电子极化率体积`, `${GASN[s.gas]} at ${s.T} K: orientational / electronic polarisability volume`), `${fix(ov, 2)} / ${fix(G.alpha, 2)} Å³`],
        [L(`${LIQN[s.liq]}：Clausius–Mossotti（加取向项）`, `${LIQN[s.liq]}: Clausius–Mossotti (with orientation)`), Number.isFinite(cm) && cm > 0 ? fix(cm, 1) : L('发散（极化灾难）', 'diverges (polarisation catastrophe)')],
        [L('Onsager（g = 1）/ 实验', 'Onsager (g = 1) / experiment'), `${fix(epsOn, 1)} / ${fix(Lq.eps, 1)}`, true], [L('要符合实验需要的 g', 'g needed to match experiment'), fix(gNeed, 2)]];
    },
  };

  // ── 5a. Born 模型 ───────────────────────────────────────────────
  DEMOS.born = {
    title: L('Born 模型：一个带电球放进介电常数为 ε 的溶剂', 'The Born model: a charged sphere put into a solvent of dielectric constant ε'), kind: 'data',
    intro: L('最简单的溶剂化模型：离子是半径 r 的带电导体球，溶剂是介电常数为 ε 的连续介质。把它从真空搬进溶剂，静电能降低 ΔG = −(q²/8πε₀r)(1 − 1/ε)。这个公式没有可调参数，唯一要定的是 r。用晶体里的离子半径，算出来的水合自由能普遍太负（小阳离子差得最多）；Latimer、Pitzer 和 Slansky 1939 年发现给阳离子半径加 0.85 Å、阴离子加 0.10 Å 就和实验相当一致。这“有效半径”就是今天 PCM、SMD 里原子半径要拟合的原因。', 'The simplest solvation model: an ion is a charged conducting sphere of radius r, the solvent a continuum of dielectric constant ε. Moving it from vacuum into the solvent lowers its electrostatic energy by ΔG = −(q²/8πε₀r)(1 − 1/ε). The formula has no adjustable parameter; only r must be chosen. With crystal ionic radii the hydration free energies come out too negative across the board (small cations worst); in 1939 Latimer, Pitzer and Slansky found that adding 0.85 Å to cation radii and 0.10 Å to anion radii brings it into good agreement with experiment. This “effective radius” is why atomic radii are still fitted in PCM and SMD today.'),
    sel: [['rad', L('半径', 'Radii'), [['pauling', L('Pauling 晶体半径', 'Pauling crystal radii')], ['lps', L('Latimer–Pitzer–Slansky：阳离子 +0.85 Å，阴离子 +0.10 Å', 'Latimer–Pitzer–Slansky: cations +0.85 Å, anions +0.10 Å')]], 'pauling']],
    ctl: [['eps', L('溶剂的介电常数 ε', 'Solvent dielectric constant ε'), 1.5, 100, 0.5, 78.5, (v) => v.toFixed(1)]],
    btn: [[L('水 78.5', 'water 78.5'), { eps: 78.5 }], [L('甲醇 32.7', 'methanol 32.7'), { eps: 32.7 }], [L('二氯甲烷 8.9', 'dichloromethane 8.9'), { eps: 8.9 }]],
    figs: [[0.55, L('九种离子的水合自由能：圆点是实验（Marcus 1991），方块是 Born 模型（用选中的半径和 ε）。', 'Hydration free energies of nine ions: dots are experiment (Marcus 1991), squares the Born model (with the chosen radii and ε).')]],
    note: L('ΔG = −694.7 z²(1 − 1/ε)/r kJ mol⁻¹（r 用 Å）。实验值是 Marcus（1991）的标准水合 Gibbs 自由能，基于质子水合自由能 −1056 kJ mol⁻¹ 的绝对标度；换一个质子标度，阳离子和阴离子的值会朝相反方向平移。实验值都是水里的，换 ε 只改变 Born 那一列，用来看 1 − 1/ε 有多不敏感：ε 从 30 到 80，能量只变约 2 %。', 'ΔG = −694.7 z²(1 − 1/ε)/r kJ mol⁻¹ (r in Å). Experimental values are Marcus’s (1991) standard Gibbs energies of hydration on the absolute scale based on −1056 kJ mol⁻¹ for the proton; a different proton scale shifts cations and anions in opposite directions. The experimental values are all for water; changing ε only changes the Born column, to show how insensitive 1 − 1/ε is: from ε = 30 to 80 the energy changes by only about 2 %.'),
    draw(s, [cv], c) {
      const rows = M.IONS.map(([name, z, r, exp]) => { const reff = s.rad === 'lps' ? r + (z > 0 ? 0.85 : 0.1) : r; return { name, z, exp, born: M.bornKJ(z, reff, s.eps), r: reff }; });
      const n = rows.length;
      plot(cv, { x: [-0.5, n - 0.5], y: [-1250, 0], xt: [], yl: L('ΔG_hyd（kJ/mol）', 'ΔG_hyd (kJ/mol)'), after: ({ ctx, X, Y }) => {
        rows.forEach((q, i) => {
          ctx.strokeStyle = c.line; ctx.beginPath(); ctx.moveTo(X(i), Y(q.exp)); ctx.lineTo(X(i), Y(Math.max(-1250, q.born))); ctx.stroke();
          ctx.fillStyle = c.ink; ctx.beginPath(); ctx.arc(X(i), Y(q.exp), 5, 0, 2 * PI); ctx.fill();
          ctx.fillStyle = c.gold; const y = Y(Math.max(-1250, q.born)); ctx.fillRect(X(i) - 5, y - 5, 10, 10);
          ctx.fillStyle = c.ink2; ctx.font = font(12, 600); ctx.textAlign = 'center'; ctx.fillText(q.name, X(i), Y(-40));
        });
      } });
      const mae = rows.reduce((t, q) => t + Math.abs(q.born - q.exp), 0) / n, na = rows[1], cl = rows[6];
      return [[L('平均绝对误差', 'Mean absolute error'), `${fix(mae, 0)} kJ/mol`, true], [L('Na⁺：Born / 实验', 'Na⁺: Born / experiment'), `${fix(na.born, 0)} / ${na.exp}`], [L('Cl⁻：Born / 实验', 'Cl⁻: Born / experiment'), `${fix(cl.born, 0)} / ${cl.exp}`], [L('因子 1 − 1/ε', 'Factor 1 − 1/ε'), fix(1 - 1 / s.eps, 4)]];
    },
  };

  // ── 5b. COSMO 对照 Kirkwood 的精确解 ─────────────────────────────
  DEMOS.cosmo = {
    title: L('COSMO 怎么算溶剂化：表面电荷和精确解的对照', 'How COSMO computes solvation: surface charges checked against the exact solution'), kind: 'exact',
    intro: L('PCM 和 COSMO 这类连续介质模型把分子放进一个空腔，溶剂的极化化成空腔表面上的一层电荷。COSMO 的窍门是先假装溶剂是导体（ε = ∞，表面电荷由“表面电势为零”这一个条件唯一确定，方程最简单），再整体乘上 f(ε) = (ε − 1)/(ε + x)。球形空腔里放一个偏离中心的点电荷有 Kirkwood 1934 年的精确级数解，正好用来检验：表面撒的点越多，导体极限越准；有限 ε 时，x = 0.5 和 x = 0 哪个更好取决于电荷离中心多远。', 'Continuum models such as PCM and COSMO put the molecule in a cavity and turn the solvent’s polarisation into a layer of charge on the cavity surface. COSMO’s trick is to pretend first that the solvent is a conductor (ε = ∞: the surface charge is fixed uniquely by the single condition that the surface potential vanishes, the simplest equations), then scale everything by f(ε) = (ε − 1)/(ε + x). An off-centre point charge in a spherical cavity has Kirkwood’s 1934 exact series solution, ideal for checking: the more surface points, the more accurate the conductor limit; for finite ε, whether x = 0.5 or x = 0 is better depends on how far the charge is from the centre.'),
    sel: [['xk', L('比例因子 f(ε)', 'Scaling factor f(ε)'), [['0.5', L('COSMO：(ε − 1)/(ε + ½)', 'COSMO: (ε − 1)/(ε + ½)')], ['0', L('C-PCM：(ε − 1)/ε', 'C-PCM: (ε − 1)/ε')]], '0.5']],
    ctl: [['d', L('电荷离球心 d/a', 'Charge offset d/a'), 0, 0.8, 0.05, 0.4, (v) => v.toFixed(2)], ['eps', L('溶剂 ε', 'Solvent ε'), 1.5, 100, 0.5, 78.5, (v) => v.toFixed(1)], ['N', L('表面点数', 'Surface points'), 60, 600, 20, 240, (v) => String(v)]],
    chk: [['cond', L('导体极限（ε = ∞）', 'Conductor limit (ε = ∞)'), false]],
    btn: [[L('水，电荷在中心', 'water, charge at the centre'), { d: 0, eps: 78.5, cond: false }], [L('非极性溶剂 ε = 2', 'non-polar solvent ε = 2'), { eps: 2, cond: false, d: 0.6 }]],
    figs: [[0.5, L('溶剂化能 W（单位 q²/4πε₀a）随电荷位置的变化：实线是 Kirkwood 的精确解，金点是 COSMO（当前的点数）。', 'Solvation energy W (units of q²/4πε₀a) against the charge position: the line is Kirkwood’s exact solution, gold dots are COSMO (current number of points).')], [0.62, L('球面上的诱导电荷（侧视，z 轴向上，点的大小和颜色深浅表示电荷密度）。电荷在 +z 一边时，那一边的负电荷最密。', 'Induced charge on the sphere (side view, z up; dot size and depth of colour show the charge density). With the charge towards +z, negative charge crowds on that side.')]],
    note: L('Kirkwood（1934）：W = (q²/8πε₀a) Σ_l (l + 1)(1 − ε)/[(l + 1)ε + l] (d/a)^{2l}，l = 0 那一项就是 Born。COSMO：Fibonacci 格子撒 N 个点，每块面积 4πa²/N，A_ij = 1/|r_i − r_j|，对角元 1.07√(4π/面积)（Klamt & Schüürmann 1993），解 Aq* = −Φ（Cholesky），q = f(ε)q*，W = ½Σq_iΦ_i。f 里的 x = ½ 正好让偶极项（l = 1）精确，x = 0 让单极项（l = 0）精确。真实的 COSMO、PCM 用原子球拼成的空腔，还要处理逃出空腔的电子密度。', 'Kirkwood (1934): W = (q²/8πε₀a) Σ_l (l + 1)(1 − ε)/[(l + 1)ε + l] (d/a)^{2l}; the l = 0 term is Born. COSMO: N points on a Fibonacci lattice, each of area 4πa²/N, A_ij = 1/|r_i − r_j|, diagonal 1.07√(4π/area) (Klamt & Schüürmann 1993), solve Aq* = −Φ (Cholesky), q = f(ε)q*, W = ½Σq_iΦ_i. The x = ½ in f makes the dipole term (l = 1) exact, x = 0 the monopole term (l = 0). Real COSMO and PCM use cavities built from atomic spheres and must also deal with electron density escaping the cavity.'),
    draw(s, [a, b], c) {
      const eps = s.cond ? Infinity : s.eps, xk = Number(s.xk), ds = lin(0, 0.8, 81), ex = (d) => (s.cond ? -0.5 / (1 - d * d) : M.kirkwood(d, eps));
      const pts = [0, 0.2, 0.4, 0.6, 0.8].map((d) => [d, M.cosmo(d, eps, s.N, xk).W]);
      const ys = ds.map(ex);
      plot(a, { x: [0, 0.8], y: [Math.min(...ys, ...pts.map((p) => p[1])) * 1.08, 0], xl: 'd/a', yl: 'W', series: [{ xs: ds, ys, color: c.ink, width: 2, label: 'Kirkwood' }, { pts, color: c.gold, dots: 5, label: 'COSMO' }], marks: [{ x: s.d, color: c.danger }] });
      const r = M.cosmo(s.d, eps, s.N, xk), qmax = Math.max(...r.qs.map(Math.abs));
      plot(b, { x: [-1.25, 1.25], y: [-1.15, 1.15], eq: true, xt: [], yt: [], after: (g) => {
        const { ctx, X, Y } = g;
        ctx.strokeStyle = c.line; ctx.beginPath(); ctx.arc(X(0), Y(0), X(1) - X(0), 0, 2 * PI); ctx.stroke();
        const order = r.pts.map((p, i) => i).sort((i, j) => r.pts[i][1] - r.pts[j][1]); // 远的先画
        for (const i of order) { const [x, y, z] = r.pts[i], q = r.qs[i]; ctx.globalAlpha = 0.25 + 0.6 * (y + 1) / 2; ctx.fillStyle = q < 0 ? c.info : c.danger; ctx.beginPath(); ctx.arc(X(x), Y(z), 1.5 + 5 * Math.abs(q) / qmax, 0, 2 * PI); ctx.fill(); }
        ctx.globalAlpha = 1; dot(g, 0, s.d, 7, c.danger, '+');
      } });
      const w = ex(s.d), kj = (C.bornKJ * 2) / 2; // a = 2 Å：q²/(4πε₀a) = 1389.35/2 kJ/mol
      return [[L('精确（Kirkwood）', 'Exact (Kirkwood)'), fix(w, 4)], [L('COSMO', 'COSMO'), fix(r.W, 4), true], [L('相对误差', 'Relative error'), pct((r.W - w) / w, 2)], [L('表面总电荷 / 应有的 −(1 − 1/ε)q', 'Total surface charge / expected −(1 − 1/ε)q'), `${fix(r.total, 3)} / ${fix(s.cond ? -1 : -(1 - 1 / eps), 3)}`], [L('若 a = 2 Å、q = +e：精确的 W', 'If a = 2 Å and q = +e: exact W'), `${fix(w * kj, 0)} kJ/mol`]];
    },
  };

  // ── 6. Debye 弛豫和微波加热 ─────────────────────────────────────
  DEMOS.debye = {
    title: L('水的介电弛豫：Debye 峰、Cole–Cole 圆和微波炉', 'Dielectric relaxation of water: the Debye peak, the Cole–Cole circle and the microwave oven'), kind: 'exact',
    intro: L('交变电场里，水分子的偶极要转向才能跟上。频率远低于 1/τ 时跟得上，ε′ ≈ 78；远高于时来不及转，ε′ 掉到约 5；两者之间偶极落后于电场，能量变成热，这就是 ε″ 的峰，在 25 °C 的水里约 19 GHz。微波炉用 2.45 GHz，在峰的低频一侧：吸收足够强，又不会强到只加热表面一薄层。Debye 模型给出半圆形的 Cole–Cole 图；真实材料的峰常常更宽，Cole–Cole、Cole–Davidson 和 Havriliak–Negami 用一两个指数描述这种展宽。', 'In an alternating field, water’s dipoles must rotate to keep up. Far below 1/τ they manage, and ε′ ≈ 78; far above they cannot turn in time and ε′ drops to about 5; in between the dipoles lag the field, energy turns into heat, and that is the peak in ε″, at about 19 GHz in water at 25 °C. Microwave ovens use 2.45 GHz, on the low-frequency side of the peak: absorption is strong enough, but not so strong that only a thin surface layer is heated. The Debye model gives a semicircular Cole–Cole plot; real materials often have broader peaks, which the Cole–Cole, Cole–Davidson and Havriliak–Negami forms describe with one or two exponents.'),
    sel: [['m', L('弛豫的形式', 'Relaxation form'), [['d', 'Debye'], ['cc', 'Cole–Cole'], ['cd', 'Cole–Davidson'], ['hn', 'Havriliak–Negami']], 'd']],
    ctl: [['t', L('水温', 'Water temperature'), 0, 100, 1, 25, (v) => `${v} °C`], ['al', L('Cole–Cole 指数 α', 'Cole–Cole exponent α'), 0, 0.5, 0.01, 0.15, (v) => v.toFixed(2)], ['be', L('Cole–Davidson 指数 β', 'Cole–Davidson exponent β'), 0.3, 1, 0.01, 0.6, (v) => v.toFixed(2)]],
    figs: [[0.52, L('ε′（实线）和 ε″（金色）对频率。竖线是微波炉的 2.45 GHz。', 'ε′ (line) and ε″ (gold) against frequency. The vertical line is the microwave oven’s 2.45 GHz.')], [0.5, L('Cole–Cole 图：ε″ 对 ε′。Debye 是一个正半圆，展宽的弛豫把它压扁或者拉歪。', 'Cole–Cole plot: ε″ against ε′. Debye is a perfect semicircle; broadened relaxations flatten or skew it.')]],
    note: L('ε(ω) = ε∞ + (ε_s − ε∞)/[1 + (iωτ)^{1−α}]^β，ε∞ = 5.2。ε_s(t) 用 Malmberg & Maryott（1956）的多项式，τ 取 25 °C 的 8.27 ps（Kaatze 1989），其他温度按 Debye–Stokes–Einstein 的 τ ∝ η/T 推（粘度用 Vogel 式），0 °C 得到约 17.8 ps，和 Buchner 等（1999）测的 17.7 ps 接近。真实的水在 ~400 GHz 还有一个小的快弛豫，这里合并进 ε∞。选 Debye 以外的形式时，α、β 是演示用的，不是水的参数。加热功率 = ωε₀ε″E²，按 1 kV/cm 的有效场、比热 4.18 J/(g·K) 换成升温速率；穿透深度是功率降到 1/e 的距离。', 'ε(ω) = ε∞ + (ε_s − ε∞)/[1 + (iωτ)^{1−α}]^β with ε∞ = 5.2. ε_s(t) from Malmberg & Maryott’s (1956) polynomial; τ = 8.27 ps at 25 °C (Kaatze 1989), scaled to other temperatures by the Debye–Stokes–Einstein τ ∝ η/T (viscosity from Vogel’s equation), giving about 17.8 ps at 0 °C, close to the 17.7 ps measured by Buchner et al. (1999). Real water has a small fast relaxation near 400 GHz, merged into ε∞ here. For forms other than Debye, α and β are for demonstration and are not water’s parameters. Heating power = ωε₀ε″E², converted to a heating rate for an rms field of 1 kV/cm and a specific heat of 4.18 J/(g·K); the penetration depth is the distance over which the power falls to 1/e.'),
    draw(s, [a, b], c) {
      const eS = M.waterEpsS(s.t), eI = 5.2, tau = M.waterTau(s.t), al = s.m === 'cc' || s.m === 'hn' ? s.al : 0, be = s.m === 'cd' || s.m === 'hn' ? s.be : 1;
      const ef = (f) => M.hn(2 * PI * f, eS, eI, tau, al, be), lf = lin(7, 13, 300), es = lf.map((x) => ef(10 ** x));
      plot(a, { logx: true, x: [7, 13], y: [0, 95], xl: L('频率（Hz）', 'frequency (Hz)'), yl: 'ε', series: [{ xs: lf.map((x) => 10 ** x), ys: es.map((e) => e.re), color: c.accent, width: 2.2, label: 'ε′' }, { xs: lf.map((x) => 10 ** x), ys: es.map((e) => e.im), color: c.gold, width: 2.2, label: 'ε″' }], marks: [{ x: 2.45e9, color: c.danger }] });
      plot(b, { x: [0, 95], y: [0, 45], eq: true, xl: 'ε′', yl: 'ε″', series: [{ xs: es.map((e) => e.re), ys: es.map((e) => e.im), color: c.accent, width: 2.2 }], after: (g) => { const e = ef(2.45e9); dot(g, e.re, e.im, 5, c.danger); } });
      const e = ef(2.45e9), P = M.heatPower(2.45e9, e.im, 1e5), fp = (() => { let best = 0, bi = 0; es.forEach((q, i) => { if (q.im > best) { best = q.im; bi = i; } }); return 10 ** lf[bi]; })();
      return [[L('静态 ε_s', 'Static ε_s'), fix(eS, 1)], [L('弛豫时间 τ', 'Relaxation time τ'), `${fix(tau * 1e12, 2)} ps`], [L('ε″ 峰的频率', 'Frequency of the ε″ peak'), `${fix(fp / 1e9, 1)} GHz`, true], [L('2.45 GHz 处 ε′ / ε″', 'ε′ / ε″ at 2.45 GHz'), `${fix(e.re, 1)} / ${fix(e.im, 2)}`], [L('2.45 GHz 的功率穿透深度', 'Power penetration depth at 2.45 GHz'), `${fix(M.penetration(2.45e9, e) * 100, 2)} cm`], [L('1 kV/cm 下的升温速率', 'Heating rate at 1 kV/cm'), `${fix(P / 4.18e6, 2)} K/s`]];
    },
  };

  // ── 7. 全频的介电函数 ──────────────────────────────────────────
  DEMOS.spectrum = {
    title: L('从直流到紫外：介电函数的三级台阶和 Kramers–Kronig', 'From DC to ultraviolet: the three steps of the dielectric function and Kramers–Kronig'), kind: 'toy',
    intro: L('一种极性材料的 ε′ 随频率升高一级一级往下掉：微波区偶极来不及转（取向极化消失），红外区离子来不及振（离子极化消失），紫外区电子也跟不上（只剩真空的 1）。每掉一级，ε″ 就有一个吸收峰。实部和虚部不是独立的：因果性（响应不能早于刺激）要求它们满足 Kramers–Kronig 关系，知道全部的吸收就能算出折射。打开开关，用数值积分从 ε″ 重建 ε′。', 'The ε′ of a polar material drops step by step as the frequency rises: in the microwave the dipoles cannot turn in time (orientational polarisation disappears), in the infrared the ions cannot vibrate in time (ionic polarisation disappears), in the ultraviolet even the electrons cannot follow (leaving only the vacuum’s 1). Each step comes with an absorption peak in ε″. The real and imaginary parts are not independent: causality (no response before the stimulus) forces them to obey the Kramers–Kronig relations, so knowing all the absorption determines the refraction. Turn on the switch to rebuild ε′ from ε″ by numerical integration.'),
    ctl: [['lt', L('取向弛豫时间 log₁₀ τ（s）', 'Orientational relaxation time log₁₀ τ (s)'), -12, -6, 0.1, -11, (v) => `τ = ${fmt(10 ** v, 2)} s`], ['dOr', L('取向的贡献 Δε_or', 'Orientational strength Δε_or'), 0, 80, 1, 40, (v) => String(v)], ['dIon', L('离子的贡献 Δε_ion', 'Ionic strength Δε_ion'), 0, 10, 0.1, 3, (v) => v.toFixed(1)], ['dEl', L('电子的贡献 Δε_el', 'Electronic strength Δε_el'), 0, 4, 0.05, 1.2, (v) => v.toFixed(2)]],
    chk: [['kk', L('用 Kramers–Kronig 从 ε″ 重建 ε′', 'Rebuild ε′ from ε″ with Kramers–Kronig'), true]],
    figs: [[0.6, L('ε′（实线）和 ε″（金色，对数坐标在右侧的读法相同）。圆点是 KK 重建的 ε′。色带标出微波、红外和紫外。', 'ε′ (line) and ε″ (gold). Dots are ε′ rebuilt by KK. Shaded bands mark the microwave, infrared and ultraviolet.')]],
    note: L('ε(ω) = 1 + Debye(Δε_or, τ) + Lorentz(Δε_ion, ν = 5 THz, γ = 0.1ω₀) + Lorentz(Δε_el, ν = 2 PHz, γ = 0.1ω₀)，Lorentz 项是 Δε ω₀²/(ω₀² − ω² + iγω)（ε = ε′ − iε″ 的约定）。参数是示意的，不对应某种具体材料（真实材料的红外和紫外区有很多条峰）。KK：ε′(ω) − 1 = (2/π) P∫₀^∞ ω′ε″(ω′)/(ω′² − ω²) dω′，在 10²–10¹⁸ rad/s 的对数格点上积分，主值用对称格点处理。', 'ε(ω) = 1 + Debye(Δε_or, τ) + Lorentz(Δε_ion, ν = 5 THz, γ = 0.1ω₀) + Lorentz(Δε_el, ν = 2 PHz, γ = 0.1ω₀), the Lorentz term being Δε ω₀²/(ω₀² − ω² + iγω) (convention ε = ε′ − iε″). The parameters are schematic and do not correspond to a particular material (real materials have many peaks in the infrared and ultraviolet). KK: ε′(ω) − 1 = (2/π) P∫₀^∞ ω′ε″(ω′)/(ω′² − ω²) dω′, integrated on a logarithmic grid over 10²–10¹⁸ rad/s, with the principal value handled by a symmetric grid.'),
    draw(s, [cv], c) {
      const p = { dOr: s.dOr, tau: 10 ** s.lt, dIon: s.dIon, wIon: 2 * PI * 5e12, gIon: 0.1 * 2 * PI * 5e12, dEl: s.dEl, wEl: 2 * PI * 2e15, gEl: 0.1 * 2 * PI * 2e15 };
      const lf = lin(3, 17, 420), e = lf.map((x) => M.fullSpectrum(2 * PI * 10 ** x, p));
      const top = 1 + s.dOr + s.dIon + s.dEl, yHi = Math.max(5, top * 1.1);
      const series = [{ xs: lf.map((x) => 10 ** x), ys: e.map((q) => q.re), color: c.accent, width: 2.2, label: 'ε′' }, { xs: lf.map((x) => 10 ** x), ys: e.map((q) => q.im), color: c.gold, width: 2, label: 'ε″' }];
      let kkErr = 0;
      if (s.kk) {
        const im = (w) => M.fullSpectrum(w, p).im, fs = lin(4, 16.5, 26).map((x) => 10 ** x), ys = fs.map((f) => 1 + M.kkReal(im, 2 * PI * f, 2, 18, 9000));
        fs.forEach((f, i) => { kkErr = Math.max(kkErr, Math.abs(ys[i] - M.fullSpectrum(2 * PI * f, p).re)); });
        series.push({ xs: fs, ys, color: c.danger, dots: 3.5, label: 'KK' });
      }
      plot(cv, { logx: true, x: [3, 17], y: [Math.min(0, ...e.map((q) => q.re)) - 0.5, yHi], xl: L('频率（Hz）', 'frequency (Hz)'), yl: 'ε', series, bands: [{ x0: 3e8, x1: 3e11, color: c.info, alpha: 0.08 }, { x0: 3e11, x1: 4e14, color: c.danger, alpha: 0.06 }, { x0: 7.5e14, x1: 3e16, color: c.violet || c.info, alpha: 0.08 }] });
      return [[L('静态介电常数 ε(0)', 'Static dielectric constant ε(0)'), fix(top, 2), true], [L('红外以上、可见光的 ε∞', 'ε∞ above the infrared (visible)'), fix(1 + s.dEl, 2)], [L('可见光折射率 n ≈ √ε∞', 'Visible refractive index n ≈ √ε∞'), fix(Math.sqrt(1 + s.dEl), 3)], ...(s.kk ? [[L('KK 重建的最大偏差', 'Largest deviation of the KK rebuild'), fmt(kkErr, 2)]] : [])];
    },
  };

  // ── 8. 亥姆霍兹线圈 ─────────────────────────────────────────────
  DEMOS.helmholtz = {
    title: L('亥姆霍兹线圈：两个圆线圈拼出均匀的磁场', 'Helmholtz coils: two circular loops make a uniform field'), kind: 'exact',
    intro: L('一个圆线圈中心的磁场随离开中心而下降。把两个同样的线圈同轴放置，两边的下降可以互相抵消：间距恰好等于半径时，中心处 B 的一阶和二阶导数都为零（一阶由对称性自动为零），场在一大片区域里几乎均匀。这是核磁共振、电子自旋共振和抵消地磁场常用的布置。把一个线圈的电流反过来（反亥姆霍兹），中心的场为零而梯度最大：磁光阱就用它困住冷原子。', 'The field of a circular loop falls off away from its centre. Place two identical loops on a common axis and the fall-offs can cancel: with a spacing exactly equal to the radius both the first and second derivatives of B vanish at the centre (the first by symmetry alone), and the field is nearly uniform over a large region. This is the standard arrangement for NMR, ESR and cancelling the Earth’s field. Reverse the current in one loop (anti-Helmholtz) and the field at the centre is zero while its gradient is largest: magneto-optical traps use it to hold cold atoms.'),
    ctl: [['d', L('线圈间距 d/R', 'Coil spacing d/R'), 0.2, 2.5, 0.01, 1, (v) => v.toFixed(2)]],
    chk: [['anti', L('反亥姆霍兹（电流相反）', 'Anti-Helmholtz (opposite currents)'), false]],
    btn: [[L('亥姆霍兹 d = R', 'Helmholtz d = R'), { d: 1, anti: false }], [L('梯度最线性 d = √3 R', 'Most linear gradient d = √3 R'), { d: Math.sqrt(3), anti: true }]],
    figs: [[0.62, L('ρ–z 截面里 |B| 的大小（颜色）和方向（箭头）。黑点是线圈导线的截面。', '|B| in the ρ–z plane (colour) and its direction (arrows). Black dots are the coil wires in cross-section.')], [0.4, L('轴上的 B_z（亥姆霍兹时除以中心值）。虚线是单个线圈。', 'B_z on the axis (divided by the centre value for Helmholtz). Dashed: a single loop.')]],
    note: L('Biot–Savart 定律数值积分（每个线圈分成 120 段），轴上用解析式 μ₀NIR²/[2(R² + z²)^{3/2}] 检查。读数按 R = 10 cm、每个线圈 100 匝、1 A 算；亥姆霍兹中心的解析值 (4/5)^{3/2}μ₀NI/R。线圈当成没有粗细的细圆环。', 'Numerical Biot–Savart integration (each loop cut into 120 segments), checked on the axis against the analytic μ₀NIR²/[2(R² + z²)^{3/2}]. Readouts are for R = 10 cm, 100 turns per coil and 1 A; the analytic Helmholtz centre field is (4/5)^{3/2}μ₀NI/R. The coils are treated as infinitely thin rings.'),
    draw(s, [a, b], c) {
      const d = s.d, anti = s.anti, R = 1;
      const nx = 46, nz = 36, xr = [-1.6, 1.6], zr = [-1.6, 1.6];
      const ref = anti ? Math.abs(M.pairField(0, 0.5, d, R, true, 1, 1, 60)[1]) * 2 : Math.abs(M.pairAxis(0, d, R));
      plot(a, { x: zr, y: [-1.3, 1.3], eq: true, xl: 'z/R', yl: 'ρ/R', after: (g) => {
        const { ctx, X, Y } = g, cache = [];
        heat(g, zr, [-1.3, 1.3], nx, nz, (z, rho) => { const [br, bz] = M.pairField(Math.abs(rho), z, d, R, anti, 1, 1, 60), m = Math.hypot(br, bz); cache.push([z, rho, br * Math.sign(rho || 1), bz, m]); return m; }, c.gold, c.gold, ref * 1.6, 0.8);
        ctx.strokeStyle = c.ink2; ctx.lineWidth = 1;
        cache.forEach(([z, rho, br, bz, m], i) => { if (i % 3 || m < 1e-12) return; const len = 9, ux = bz / m, uy = br / m; const x0 = X(z), y0 = Y(rho); ctx.beginPath(); ctx.moveTo(x0 - (ux * len) / 2, y0 + (uy * len) / 2); ctx.lineTo(x0 + (ux * len) / 2, y0 - (uy * len) / 2); ctx.stroke(); ctx.beginPath(); ctx.arc(x0 + (ux * len) / 2, y0 - (uy * len) / 2, 1.4, 0, 2 * PI); ctx.fillStyle = c.ink2; ctx.fill(); });
        for (const z of [-d / 2, d / 2]) for (const r of [-1, 1]) dot(g, z, r, 5, c.ink);
      } });
      const zs = lin(-1.6, 1.6, 200), Bc = M.pairAxis(0, d, R, anti) || 1, norm = anti ? M.pairAxis(0.5, d, R, true) : Bc;
      plot(b, { x: [-1.6, 1.6], y: anti ? [-1.6, 1.6] : [0, 1.3], xl: 'z/R', yl: anti ? L('B_z / B_z(0.5R)', 'B_z / B_z(0.5R)') : 'B_z / B_z(0)', series: [{ xs: zs, ys: zs.map((z) => M.pairAxis(z, d, R, anti) / norm), color: c.accent, width: 2.2 }, { xs: zs, ys: zs.map((z) => M.loopAxis(z, -d / 2, R) / norm), color: c.muted, dash: [4, 4] }], marks: [{ x: -d / 2, color: c.line }, { x: d / 2, color: c.line }] });
      const Rm = 0.1, N = 100, Bcen = M.pairAxis(0, d * Rm, Rm, anti, 1, N), unif = Math.abs(M.pairAxis(0.1, d, R, false) / M.pairAxis(0, d, R, false) - 1), grad = (M.pairAxis(0.001 * Rm, d * Rm, Rm, true, 1, N) - M.pairAxis(-0.001 * Rm, d * Rm, Rm, true, 1, N)) / (0.002 * Rm);
      return anti ? [[L('中心的场', 'Field at the centre'), `${fix(Bcen * 1e3, 4)} mT`], [L('中心的梯度 dB_z/dz', 'Gradient dB_z/dz at the centre'), `${fix(grad, 3)} T/m = ${fix(grad * 100, 1)} G/cm`, true]]
        : [[L('中心的场（R = 10 cm、100 匝、1 A）', 'Centre field (R = 10 cm, 100 turns, 1 A)'), `${fix(Bcen * 1e3, 4)} mT`, true], [L('亥姆霍兹的解析值', 'Analytic Helmholtz value'), `${fix(M.helmholtzCentre(Rm, 1, N) * 1e3, 4)} mT`], [L('离中心 0.1R 处的相对变化', 'Relative change at 0.1R from the centre'), pct(unif, 4)]];
    },
  };

  // ── 9a. 顺磁：Brillouin 函数 ────────────────────────────────────
  const IONSP = [['1.5', 'Cr³⁺ (J = 3/2)'], ['2.5', 'Fe³⁺ (J = 5/2)'], ['3.5', 'Gd³⁺ (J = 7/2)'], ['0.5', L('自由电子自旋（J = 1/2）', 'free electron spin (J = 1/2)')]];
  DEMOS.brillouin = {
    title: L('顺磁性：量子化的磁矩在磁场和热运动之间', 'Paramagnetism: quantised moments caught between field and thermal motion'), kind: 'exact',
    intro: L('一个总角动量为 J 的离子，磁矩在磁场方向上只能取 2J + 1 个值。磁场想把它们排齐，热运动想把它们打乱，平均磁矩只取决于 B/T 这一个组合，由 Brillouin 函数描述。弱场时是 Curie 定律 M ∝ B/T，强场下饱和到 gJ μ_B。Henry 1952 年把 Cr³⁺、Fe³⁺、Gd³⁺ 盐冷到 1.3–4.2 K、加到 5 T，三组数据各自精确落在 J = 3/2、5/2、7/2 的曲线上：这是空间量子化最干净的宏观证据之一。', 'For an ion of total angular momentum J, the magnetic moment along the field can take only 2J + 1 values. The field tries to line them up, thermal motion tries to scramble them, and the mean moment depends only on the combination B/T, given by the Brillouin function. At weak field this is Curie’s law M ∝ B/T; at strong field it saturates at gJ μ_B. In 1952 Henry cooled salts of Cr³⁺, Fe³⁺ and Gd³⁺ to 1.3–4.2 K in fields up to 5 T, and each data set fell precisely on the J = 3/2, 5/2, 7/2 curve: one of the cleanest macroscopic proofs of space quantisation.'),
    sel: [['J', L('离子', 'Ion'), IONSP, '3.5']],
    ctl: [['B', L('磁场 B', 'Field B'), 0, 10, 0.1, 5, (v) => `${v.toFixed(1)} T`], ['T', L('温度 T', 'Temperature T'), 1, 300, 0.5, 2, (v) => `${v} K`]],
    chk: [['cl', L('对照经典的 Langevin（同样的饱和磁矩）', 'Compare the classical Langevin curve (same saturation moment)'), true]],
    figs: [[0.55, L('每个离子的平均磁矩（μ_B）对 B/T，g = 2。竖线是当前的 B/T。', 'Mean moment per ion (μ_B) against B/T with g = 2. The vertical line is the current B/T.')]],
    note: L('⟨μ_z⟩ = gJμ_B B_J(x)，x = gμ_BJB/(k_BT)，B_J(x) = [(2J+1)/2J] coth[(2J+1)x/2J] − (1/2J) coth(x/2J)。三种离子都是 L = 0 的 S 态（或轨道角动量被晶场淬灭），g ≈ 2。经典的 Langevin 函数 L(x) = coth x − 1/x 是 J → ∞ 的极限，它在同样的 x 下饱和得更慢。摩尔 Curie 常数 C = 0.12505 p_eff² cm³·K/mol（高斯单位），p_eff = g√(J(J+1))。', '⟨μ_z⟩ = gJμ_B B_J(x), x = gμ_BJB/(k_BT), B_J(x) = [(2J+1)/2J] coth[(2J+1)x/2J] − (1/2J) coth(x/2J). All three ions are L = 0 S states (or have orbital angular momentum quenched by the crystal field), so g ≈ 2. The classical Langevin function L(x) = coth x − 1/x is the J → ∞ limit and saturates more slowly at the same x. The molar Curie constant is C = 0.12505 p_eff² cm³·K/mol (Gaussian units), with p_eff = g√(J(J+1)).'),
    draw(s, [cv], c) {
      const xs = lin(0, 4, 200), J = Number(s.J);
      const series = IONSP.map(([j, name]) => ({ xs, ys: xs.map((bt) => M.paraMoment(Number(j), 2, bt, 1)), color: j === s.J ? c.gold : c.muted, width: j === s.J ? 2.6 : 1.2, label: name }));
      if (s.cl) series.push({ xs, ys: xs.map((bt) => 2 * J * M.langevin((2 * C.muB * J * bt) / C.kB)), color: c.info, dash: [5, 4], width: 1.6, label: 'Langevin' });
      plot(cv, { x: [0, 4], y: [0, 7.5], xl: L('B/T（T/K）', 'B/T (T/K)'), yl: L('⟨μ⟩ / μ_B', '⟨μ⟩ / μ_B'), series, marks: [{ x: Math.min(4, s.B / s.T), color: c.danger }] });
      const mu = M.paraMoment(J, 2, s.B, s.T), p = M.pEff(J, 2);
      return [[L('平均磁矩', 'Mean moment'), `${fix(mu, 3)} μ_B`, true], [L('占饱和值 gJ 的', 'Fraction of saturation gJ'), pct(mu / (2 * J), 1)], [L('有效磁矩 p_eff = g√(J(J+1))', 'Effective moment p_eff = g√(J(J+1))'), `${fix(p, 2)} μ_B`], [L('摩尔 Curie 常数', 'Molar Curie constant'), `${fix(0.12505 * p * p, 2)} cm³·K/mol`]];
    },
  };

  // ── 9b. 铁磁：Weiss 平均场 ──────────────────────────────────────
  DEMOS.weiss = {
    title: L('铁磁性的平均场：自洽方程的图解', 'Mean-field ferromagnetism: the self-consistency equation solved graphically'), kind: 'exact',
    intro: L('Weiss 1907 年假设每个磁矩除了外场，还感到一个正比于整体磁化的“分子场”。于是磁化 m 要满足自洽方程 m = B_J(3J/(J+1)·m·T_c/T)：右边是一条 S 形曲线，左边是直线 y = m。温度高于 T_c 时曲线在原点的斜率小于 1，只有 m = 0 一个交点；低于 T_c 时出现非零的交点，自发磁化就出现了。平均场在 T_c 附近给出 m ∝ (T_c − T)^{1/2}，真实三维铁磁体的指数约 0.33–0.37；分子场的来源要等到 Heisenberg 1928 年用量子力学的交换作用来解释。', 'In 1907 Weiss assumed that each moment feels, besides the applied field, a “molecular field” proportional to the overall magnetisation. The magnetisation m must then satisfy m = B_J(3J/(J+1)·m·T_c/T): the right side is an S-shaped curve and the left the straight line y = m. Above T_c the curve’s slope at the origin is below 1 and m = 0 is the only crossing; below T_c a non-zero crossing appears and spontaneous magnetisation is born. Mean-field theory gives m ∝ (T_c − T)^{1/2} near T_c, whereas real 3D ferromagnets have exponents of about 0.33–0.37; the origin of the molecular field had to wait for Heisenberg’s quantum-mechanical exchange in 1928.'),
    sel: [['J', 'J', [['0.5', '1/2'], ['1', '1'], ['3.5', '7/2']], '0.5']],
    ctl: [['t', L('温度 T/T_c', 'Temperature T/T_c'), 0.05, 1.6, 0.01, 0.8, (v) => v.toFixed(2)], ['h', L('外场（以分子场为单位）', 'Applied field (units of the molecular field)'), 0, 0.1, 0.002, 0, (v) => v.toFixed(3)]],
    figs: [[0.5, L('图解：直线 y = m 和曲线 y = B_J(…)，交点就是自洽的磁化。', 'Graphical solution: the line y = m and the curve y = B_J(…); the crossing is the self-consistent magnetisation.')], [0.48, L('自发磁化 m(T)（实线）和 1/χ（金色，T > T_c 时是直线：Curie–Weiss 定律）。虚线是临界附近的 √(1 − T/T_c) 近似。', 'Spontaneous magnetisation m(T) (line) and 1/χ (gold, a straight line above T_c: the Curie–Weiss law). Dashed: the near-critical √(1 − T/T_c) approximation.')]],
    note: L('平均场：m = B_J[3J(m + h)/((J + 1)t)]，h 是外场与分子场之比。不动点迭代从 m = 1 开始，取得到的稳定解。T > T_c 时 χ = ∂m/∂h ∝ 1/(T − T_c)（Curie–Weiss）。临界附近 m² ≈ (10/3)(J + 1)²/[(J + 1)² + J²]·(1 − t)。读数里的温度按铁的 T_c = 1043 K 换算。平均场忽略了涨落，所以在 T_c 附近定量地不对，二维时更会错到根本（Mermin–Wagner 定理说二维海森堡模型没有有限温度的自发磁化）。', 'Mean field: m = B_J[3J(m + h)/((J + 1)t)], h being the ratio of applied to molecular field. Fixed-point iteration from m = 1 gives the stable solution. Above T_c, χ = ∂m/∂h ∝ 1/(T − T_c) (Curie–Weiss). Near T_c, m² ≈ (10/3)(J + 1)²/[(J + 1)² + J²]·(1 − t). Temperatures in the readout use iron’s T_c = 1043 K. Mean-field theory ignores fluctuations, so it is quantitatively wrong near T_c, and in two dimensions it is wrong at the root (the Mermin–Wagner theorem says the 2D Heisenberg model has no spontaneous magnetisation at finite temperature).'),
    draw(s, [a, b], c) {
      const J = Number(s.J), ms = lin(0, 1.1, 200), m0 = M.weiss(J, s.t, s.h);
      plot(a, { x: [0, 1.1], y: [0, 1.1], eq: true, xl: 'm', yl: 'y', series: [{ xs: ms, ys: ms, color: c.muted, width: 1.6, label: 'y = m' }, { xs: ms, ys: ms.map((m) => M.brillouin(J, ((3 * J) / (J + 1)) * (m + s.h) / s.t)), color: c.gold, width: 2.4, label: 'B_J' }], marks: [{ x: m0, y: m0, color: c.danger }] });
      const ts = lin(0.02, 1.6, 160), mt = ts.map((t) => M.weiss(J, t, 0)), chiInv = ts.map((t) => (t > 1.001 ? (t - 1) : NaN));
      plot(b, { x: [0, 1.6], y: [0, 1.05], xl: 'T/T_c', yl: 'm', series: [{ xs: ts, ys: mt, color: c.accent, width: 2.2, label: 'm(T)' }, { xs: ts.filter((t) => t > 0.7 && t < 1), ys: ts.filter((t) => t > 0.7 && t < 1).map((t) => M.weissCritical(J, t)), color: c.muted, dash: [4, 4] }, { xs: ts, ys: chiInv, color: c.gold, width: 2, label: '1/χ (a.u.)' }], marks: [{ x: s.t, color: c.danger, y: m0 }] });
      return [[L('自洽的磁化 m', 'Self-consistent magnetisation m'), fix(m0, 4), true], [L('按铁（T_c = 1043 K）换成温度', 'As a temperature for iron (T_c = 1043 K)'), `${fix(s.t * 1043, 0)} K`], [L('临界近似 √(…(1 − T/T_c))', 'Critical approximation √(…(1 − T/T_c))'), s.t < 1 ? fix(M.weissCritical(J, s.t), 4) : '—'], [L('状态', 'Phase'), s.t < 1 ? L('铁磁（有自发磁化）', 'ferromagnetic (spontaneous magnetisation)') : s.h > 0 ? L('顺磁（只有外场诱导的磁化）', 'paramagnetic (field-induced only)') : L('顺磁', 'paramagnetic')]];
    },
  };

  // ── 9c. 磁滞：Stoner–Wohlfarth ──────────────────────────────────
  DEMOS.hysteresis = {
    title: L('磁滞回线从哪里来：一个单畴颗粒的 Stoner–Wohlfarth 模型', 'Where hysteresis comes from: the Stoner–Wohlfarth model of a single-domain particle'), kind: 'exact',
    intro: L('一个小到只有一个磁畴的磁性颗粒，磁化有一个“易轴”：沿易轴的两个方向能量最低。外场沿某个角度 ψ 加上去再反过来，磁化先留在原来那个能谷里，直到能谷消失才突然翻过去：这个翻转场就是回线的“台阶”。沿易轴加场（ψ = 0）得到方形回线，翻转场等于各向异性场 H_K；垂直易轴（ψ = 90°）没有磁滞。翻转场随角度的变化画出来是一条星形线（astroid），硬盘写头和磁性存储都要算它。', 'A magnetic particle so small that it is a single domain has an “easy axis”: the two directions along it have the lowest energy. Apply a field at an angle ψ and then reverse it, and the magnetisation stays in its original valley until the valley disappears, then flips suddenly: that switching field is the step in the loop. A field along the easy axis (ψ = 0) gives a square loop whose switching field equals the anisotropy field H_K; perpendicular to it (ψ = 90°) there is no hysteresis. The switching field against angle traces an astroid, which hard-disk write heads and magnetic memories must reckon with.'),
    ctl: [['psi', L('场和易轴的夹角 ψ', 'Angle ψ between field and easy axis'), 0, 90, 1, 30, (v) => `${v}°`]],
    btn: [[L('沿易轴 0°', 'along the easy axis 0°'), { psi: 0 }], ['45°', { psi: 45 }], [L('垂直易轴 90°', 'perpendicular 90°'), { psi: 90 }]],
    figs: [[0.6, L('磁化在场方向的投影 m 对 h = H/H_K。从 +2 扫到 −2（蓝）再扫回来（金）。', 'Magnetisation projected on the field, m, against h = H/H_K. Swept from +2 to −2 (blue) and back (gold).')], [0.6, L('翻转场的星形线：场的端点越过这条线，原来的能谷就消失。虚线是当前 ψ 的扫场路径。', 'The switching astroid: once the field tip crosses it, the original valley disappears. The dashed line is the sweep path at the current ψ.')]],
    note: L('能量密度 E/(2K) = ½ sin²θ − h cos(θ − ψ)，θ 是磁化和易轴的夹角，h = μ₀HM_s/2K。每一步用 Newton 法从上一步的 θ 出发找局部极小。翻转场 h_sw = 1/(cos^{2/3}ψ + sin^{2/3}ψ)^{3/2}；ψ ≤ 45° 时矫顽场等于翻转场，ψ > 45° 时磁化在翻转之前就转过零，矫顽场 = ½ sin 2ψ。读数里的实物按 hcp 钴的典型值（K₁ ≈ 4.5 × 10⁵ J/m³、M_s ≈ 1.44 × 10⁶ A/m）换算。真实的磁体有很多畴、畴壁会移动，矫顽场远小于 H_K（Brown 佯谬）。', 'Energy density E/(2K) = ½ sin²θ − h cos(θ − ψ), with θ the angle between magnetisation and easy axis and h = μ₀HM_s/2K. Each step finds the local minimum by Newton’s method starting from the previous θ. Switching field h_sw = 1/(cos^{2/3}ψ + sin^{2/3}ψ)^{3/2}; for ψ ≤ 45° the coercive field equals it, for ψ > 45° the magnetisation passes through zero before switching and the coercive field is ½ sin 2ψ. The material in the readout uses typical values for hcp cobalt (K₁ ≈ 4.5 × 10⁵ J/m³, M_s ≈ 1.44 × 10⁶ A/m). Real magnets have many domains whose walls move, so coercive fields are far below H_K (Brown’s paradox).'),
    draw(s, [a, b], c) {
      const psi = (s.psi * PI) / 180, loop = M.swLoop(psi, 500);
      plot(a, { x: [-2, 2], y: [-1.15, 1.15], xl: 'h = H/H_K', yl: 'm', series: [{ pts: loop.down, color: c.info, width: 2.4 }, { pts: loop.up, color: c.gold, width: 2.4, dash: [6, 3] }], hmarks: [{ y: 0, color: c.line }], marks: [{ x: 0, color: c.line }] });
      const as = lin(0, 2 * PI, 400);
      plot(b, { x: [-1.3, 1.3], y: [-1.3, 1.3], eq: true, xl: L('h（沿易轴）', 'h (along easy axis)'), yl: L('h（垂直易轴）', 'h (perpendicular)'), series: [{ xs: as.map((t) => Math.cos(t) ** 3), ys: as.map((t) => Math.sin(t) ** 3), color: c.accent, width: 2.2 }, { xs: [-1.3 * Math.cos(psi), 1.3 * Math.cos(psi)], ys: [-1.3 * Math.sin(psi), 1.3 * Math.sin(psi)], color: c.danger, dash: [5, 4], width: 1.4 }] });
      const hsw = M.swSwitch(psi), hc = M.swCoercive(loop), HK = (2 * 4.5e5) / 1.44e6; // μ₀H_K = 2K/M_s（T）
      return [[L('翻转场 h_sw', 'Switching field h_sw'), fix(hsw, 3), true], [L('矫顽场 h_c', 'Coercive field h_c'), fix(hc, 3)], [L('剩磁 m_r = cos ψ', 'Remanence m_r = cos ψ'), fix(Math.cos(psi), 3)], [L('换成钴颗粒的 μ₀H_c', 'μ₀H_c for a cobalt particle'), `${fix(hc * HK, 3)} T`]];
    },
  };

  // ── 10. 偶极辐射 ────────────────────────────────────────────────
  DEMOS.dipole = {
    title: L('振荡的偶极子怎样把光甩出去', 'How an oscillating dipole throws off light'), kind: 'exact',
    intro: L('一个上下振荡的电偶极子（天线、被光驱动的分子、原子里的电子）。靠近它（r ≪ λ/2π）的场基本是静电偶极场，跟着偶极来回变；远处（r ≫ λ）电场线闭合成一个个圈，脱离偶极以光速向外跑：这就是辐射。远场强度 ∝ sin²θ，沿振荡方向不发射。辐射功率 ∝ ω⁴，所以短波散射得多得多：天是蓝的、夕阳是红的。演示画的是电场线（某个函数的等值线），自己会动。', 'An electric dipole oscillating up and down (an antenna, a molecule driven by light, an electron in an atom). Close to it (r ≪ λ/2π) the field is essentially the static dipole field, following the dipole back and forth; far away (r ≫ λ) the field lines close into loops that detach and race outwards at the speed of light: that is radiation. The far-field intensity goes as sin²θ, with no emission along the axis of oscillation. The radiated power goes as ω⁴, so short waves scatter far more: that is why the sky is blue and sunsets red. The demo draws the electric field lines (level curves of a certain function) and animates itself.'),
    ctl: [['span', L('画面半宽（波长）', 'Half-width of view (wavelengths)'), 0.5, 3, 0.1, 1.5, (v) => `${v.toFixed(1)} λ`], ['lam', L('光的波长（读数用）', 'Wavelength of light (for the readout)'), 380, 780, 5, 450, (v) => `${v} nm`]],
    chk: [['near', L('标出近场区 r = λ/2π', 'Mark the near zone r = λ/2π'), true]],
    autoplay: true, fps: 18, state: { ph: 0 },
    tick(s) { s.ph = (s.ph + 0.22) % (2 * PI); },
    figs: [[0.82, L('xz 平面里的电场线，偶极在中心沿 z 振荡。', 'Electric field lines in the xz plane; the dipole sits at the centre oscillating along z.')], [0.42, L('远场的角分布 sin²θ（极坐标）。', 'Far-field angular distribution sin²θ (polar plot).')]],
    note: L('赫兹偶极子 p(t) = p₀ cos ωt 的精确场（近场、感应场和辐射场都在里面）。子午面内电场线是 ψ = sin²θ[sin(kr − ωt) + cos(kr − ωt)/(kr)] 的等值线；测试里逐点验证了 E·∇ψ = 0。时间平均功率 P = ω⁴p₀²/(12πε₀c³)（Larmor）。经典的辐射寿命 τ = 6πε₀m_ec³/(e²ω²) 是一个被弹簧拴着的电子把能量辐射掉所需的时间；钠 D 线算出来约 16 ns，和实测的 3p 寿命（约 16 ns）同一量级，这是巧合也是提示：量子力学里对应的是振子强度。', 'Exact fields of a Hertzian dipole p(t) = p₀ cos ωt (near, induction and radiation fields all included). In the meridian plane the electric field lines are level curves of ψ = sin²θ[sin(kr − ωt) + cos(kr − ωt)/(kr)]; the tests check E·∇ψ = 0 point by point. Time-averaged power P = ω⁴p₀²/(12πε₀c³) (Larmor). The classical radiative lifetime τ = 6πε₀m_ec³/(e²ω²) is the time an electron on a spring takes to radiate its energy away; for the sodium D line it comes out at about 16 ns, the same order as the measured 3p lifetime (about 16 ns). That is partly coincidence and partly a hint: in quantum mechanics the corresponding quantity is the oscillator strength.'),
    draw(s, [a, b], c) {
      const W = s.span * 2 * PI, n = 150, xs = lin(-W, W, n), zs = lin(-W * 0.8, W * 0.8, Math.round(n * 0.8));
      const G = grid(xs, zs, (x, z) => (Math.hypot(x, z) < 0.25 ? NaN : M.dipolePsi(x, z, s.ph)));
      plot(a, { x: [-W, W], y: [-W * 0.8, W * 0.8], eq: true, xt: [], yt: [], after: (g) => {
        heat(g, [-W, W], [-W * 0.8, W * 0.8], 90, 72, (x, z) => { const r = Math.hypot(x, z); return r < 0.25 ? 0 : M.dipolePsi(x, z, s.ph); }, c.danger, c.info, 1.2, 0.28);
        contour(g, xs, zs, G, lin(-1.6, 1.6, 17).filter((v) => Math.abs(v) > 1e-9), c.ink2, 1.1);
        const { ctx, X, Y } = g;
        if (s.near) { ctx.strokeStyle = c.gold; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.arc(X(0), Y(0), X(1) - X(0), 0, 2 * PI); ctx.stroke(); ctx.setLineDash([]); }
        const pz = Math.cos(s.ph) * 0.9; ctx.strokeStyle = c.ink; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(X(0), Y(-pz)); ctx.lineTo(X(0), Y(pz)); ctx.stroke();
        dot(g, 0, pz, 4, c.danger); dot(g, 0, -pz, 4, c.info);
      } });
      const ang = lin(0, 2 * PI, 241);
      plot(b, { x: [-1.2, 1.2], y: [-1.1, 1.1], eq: true, xt: [], yt: [], series: [{ xs: ang.map((t) => Math.sin(t) ** 2 * Math.sin(t)), ys: ang.map((t) => Math.sin(t) ** 2 * Math.cos(t)), color: c.gold, width: 2.2, fill: false }], arrows: [{ from: [0, -0.4], to: [0, 0.4], color: c.ink }] });
      const lam = s.lam * 1e-9, w = (2 * PI * C.c) / lam, tau = (6 * PI * C.eps0 * C.me * C.c ** 3) / (C.e ** 2 * w * w), P = M.larmor(C.e * 1e-10, w);
      return [[L('近场半径 λ/2π', 'Near-zone radius λ/2π'), `${fix(s.lam / (2 * PI), 1)} nm`], [L('相对 700 nm 红光的散射强度', 'Scattering relative to 700 nm red light'), `${fix((700 / s.lam) ** 4, 2)} ×`, true], [L('经典辐射寿命', 'Classical radiative lifetime'), `${fix(tau * 1e9, 1)} ns`], [L('振幅 1 Å 的电子辐射功率', 'Power radiated by an electron with 1 Å amplitude'), `${fmt(P, 3)} W`]];
    },
  };

  // ── 11. Drude 振子和色散力 ──────────────────────────────────────
  const ATOMS = { He: [0.205, 24.587, 1.46], Ne: [0.3956, 21.565, 6.38], Ar: [1.6411, 15.760, 64.3], Kr: [2.4844, 14.0, 129.6], Xe: [4.044, 12.13, 285.9] };
  DEMOS.london = {
    title: L('色散力：两个量子振子的零点能', 'Dispersion forces: the zero-point energy of two quantum oscillators'), kind: 'exact',
    intro: L('两个中性、没有偶极的原子为什么相吸？London 1930 年的模型：把每个原子的电子云当成一个三维谐振子（Drude 振子）。单独一个时，基态的偶极平均为零，但在零点涨落；两个靠近时，涨落的偶极通过偶极–偶极作用耦合起来，六个简正频率一半升高一半降低，零点能的总和降低了。这个降低在远处正好是 −C₆/R⁶：范德华吸引是一个纯量子的电磁效应。DFT 的 D3、MBD 色散修正，都是这个图像的精细版。', 'Why do two neutral atoms without dipoles attract? London’s 1930 model treats each atom’s electron cloud as a three-dimensional harmonic oscillator (a Drude oscillator). On its own its ground-state dipole averages to zero but fluctuates at zero point; bring two together and the fluctuating dipoles couple through the dipole–dipole interaction, half of the six normal frequencies rise and half fall, and the total zero-point energy goes down. At large distance the lowering is exactly −C₆/R⁶: van der Waals attraction is a purely quantum electromagnetic effect. The D3 and MBD dispersion corrections of DFT are refined versions of this picture.'),
    sel: [['at', L('原子（London 公式的读数）', 'Atom (for the London-formula readout)'), Object.keys(ATOMS).map((k) => [k, k]), 'Ar']],
    ctl: [['R', L('距离 R / α′^{1/3}', 'Distance R / α′^{1/3}'), 1.3, 6, 0.01, 2, (v) => v.toFixed(2)]],
    figs: [[0.55, L('零点能的降低 −ΔE（单位 ħω₀）对 R（双对数）。实线是六个简正模的精确结果，虚线是 −(3/4)/R⁶。R³ = 2α′ 处 z 方向的一个模频率变成零：“极化灾难”。', 'Lowering of the zero-point energy −ΔE (units of ħω₀) against R (log–log). Solid: the exact result from the six normal modes; dashed: −(3/4)/R⁶. At R³ = 2α′ one z mode reaches zero frequency: the “polarisation catastrophe”.')], [0.4, L('当前 R 下六个简正频率（单位 ω₀）：两个 x、两个 y、两个 z。', 'The six normal frequencies at the current R (units of ω₀): two x, two y, two z.')]],
    note: L('哈密顿量：两个各向同性振子加偶极–偶极作用 (q²/4πε₀R³)(x₁x₂ + y₁y₂ − 2z₁z₂)，是二次型，可以精确对角化：ω² = ω₀²(1 ± κ)（x、y）、ω₀²(1 ± 2κ)（z），κ = α′/R³。展开到最低阶 ΔE = −(3/4)ħω₀α′²/R⁶。London 公式把 ħω₀ 换成电离能 I：C₆ ≈ (3/4)Iα′²。读数的极化率体积、电离能是常见值，参考 C₆（原子单位）是文献里常用的精确值（约数）。距离再大到 ~λ/2π 时要考虑推迟效应，变成 Casimir–Polder 的 1/R⁷。', 'Hamiltonian: two isotropic oscillators plus the dipole–dipole interaction (q²/4πε₀R³)(x₁x₂ + y₁y₂ − 2z₁z₂). It is quadratic and can be diagonalised exactly: ω² = ω₀²(1 ± κ) (x, y) and ω₀²(1 ± 2κ) (z), with κ = α′/R³. To lowest order ΔE = −(3/4)ħω₀α′²/R⁶. London’s formula replaces ħω₀ by the ionisation energy I: C₆ ≈ (3/4)Iα′². The polarisability volumes and ionisation energies in the readout are common values, and the reference C₆ (atomic units) are commonly used accurate values (rounded). At still larger distances, around λ/2π, retardation must be included and the law becomes Casimir–Polder’s 1/R⁷.'),
    draw(s, [a, b], c) {
      const Rs = lin(Math.log10(1.27), Math.log10(6), 150).map((x) => 10 ** x);
      plot(a, { logx: true, logy: true, x: [Math.log10(1.25), Math.log10(6)], y: [-5, 0.3], xl: 'R / α′^{1/3}', yl: '−ΔE / ħω₀', series: [{ xs: Rs, ys: Rs.map((R) => -M.drudePair(R)), color: c.accent, width: 2.4, label: L('精确', 'exact') }, { xs: Rs, ys: Rs.map((R) => 0.75 / R ** 6), color: c.gold, dash: [5, 4], width: 2, label: '(3/4)/R⁶' }], marks: [{ x: s.R, color: c.danger }, { x: 2 ** (1 / 3), color: c.line }] });
      const k = 1 / s.R ** 3, ws = [1 + k, 1 - k, 1 + k, 1 - k, 1 + 2 * k, 1 - 2 * k].map((v) => (v > 0 ? Math.sqrt(v) : 0));
      plot(b, { x: [-0.5, 5.5], y: [0, 1.5], xt: [], yl: 'ω / ω₀', series: [{ xs: [0, 1, 2, 3, 4, 5], ys: ws, color: c.gold, bars: 0.6, base: 0 }], hmarks: [{ y: 1, color: c.line }], texts: ['x+', 'x−', 'y+', 'y−', 'z+', 'z−'].map((t, i) => ({ s: t, x: i, y: 1.42, align: 'center', color: c.ink2 })) });
      const [al, I, ref] = ATOMS[s.at], c6 = M.c6eVA6toAU(0.75 * I * al * al), dE = M.drudePair(s.R);
      return [[L('零点能的降低（精确）', 'Zero-point lowering (exact)'), Number.isFinite(dE) ? `${fmt(-dE, 3)} ħω₀` : L('极化灾难', 'polarisation catastrophe'), true], [L('与 (3/4)/R⁶ 之比', 'Ratio to (3/4)/R⁶'), Number.isFinite(dE) ? fix(-dE / (0.75 / s.R ** 6), 3) : '—'], [L(`${s.at}：London 公式的 C₆ / 参考值`, `${s.at}: London-formula C₆ / reference`), `${fix(c6, 1)} / ${ref} a.u.`], [L('London 公式的偏差', 'Error of the London formula'), pct(c6 / ref - 1, 0)]];
    },
  };

  // ── 12. Ewald 求和 ──────────────────────────────────────────────
  DEMOS.ewald = {
    title: L('Ewald 求和：一个条件收敛的级数怎样算对', 'Ewald summation: how to sum a conditionally convergent series correctly'), kind: 'exact',
    intro: L('NaCl 晶体里一个离子的静电能要对无穷多个 ±1/r 求和。正负项交替，按球壳一层层加，部分和来回振荡、根本不收敛；按立方体加并且把面、棱、角上的离子按 1/2、1/4、1/8 算（Evjen 1932），很快收敛。Ewald 1921 年的办法更一般：给每个离子套一团反号的高斯电荷，实空间里剩下的短程部分很快衰减，补回来的高斯在倒空间里求和也很快收敛。分裂参数 α 决定两边各算多少，但总和与 α 无关：这正是分子动力学里 PME 的基础。', 'The electrostatic energy of an ion in a NaCl crystal is a sum of infinitely many ±1/r terms. The signs alternate; added shell by shell in spheres, the partial sums oscillate and never converge; added in cubes, counting ions on faces, edges and corners as 1/2, 1/4 and 1/8 (Evjen 1932), they converge quickly. Ewald’s 1921 method is more general: wrap each ion in a Gaussian cloud of opposite charge, so what is left in real space is short-ranged and decays fast, and the Gaussians added back sum quickly in reciprocal space. The splitting parameter α decides how much each side computes, but the total does not depend on α: this is the basis of PME in molecular dynamics.'),
    ctl: [['al', L('分裂参数 α（单位 1/a）', 'Splitting parameter α (units of 1/a)'), 1, 6, 0.1, 2.5, (v) => v.toFixed(1)], ['nk', L('倒空间截断 |n| ≤', 'Reciprocal cut-off |n| ≤'), 1, 7, 1, 4, (v) => String(v)], ['nr', L('实空间截断（晶胞层数）', 'Real-space cut-off (cell shells)'), 1, 3, 1, 2, (v) => String(v)]],
    figs: [[0.5, L('Madelung 常数的三部分随 α 的变化：实空间（蓝）、倒空间（金）、自能修正（灰），总和（粗线）。截断不够时总和才会跟着 α 漂。', 'The three parts of the Madelung constant against α: real space (blue), reciprocal space (gold), self-energy correction (grey) and the total (thick). Only with insufficient cut-offs does the total drift with α.')], [0.45, L('直接求和：球形截断（振荡，不收敛）和 Evjen 的立方体截断（收敛）。横虚线是 1.747565。', 'Direct sums: spherical cut-off (oscillates, never converges) and Evjen’s cubic cut-off (converges). The dashed line is 1.747565.')]],
    note: L('立方晶胞边长 a，8 个离子，最近邻距离 r₀ = a/2。E = ½ΣΣ′ q_iq_j erfc(αr)/r + (2π/V)Σ_{k≠0} e^{−k²/4α²}|S(k)|²/k² − (α/√π)Σq_i²（导电边界，晶胞总电荷为零，没有表面项），Madelung 常数 M = −E·r₀/4。erfc 用 Numerical Recipes 的 Chebyshev 近似（相对误差 < 1.2 × 10⁻⁷）。直接求和以一个 Na⁺ 为中心，单位是 q²/(4πε₀r₀)。', 'Cubic cell of side a with 8 ions, nearest-neighbour distance r₀ = a/2. E = ½ΣΣ′ q_iq_j erfc(αr)/r + (2π/V)Σ_{k≠0} e^{−k²/4α²}|S(k)|²/k² − (α/√π)Σq_i² (tin-foil boundary; the cell is neutral, so there is no surface term), and the Madelung constant is M = −E·r₀/4. erfc uses the Numerical Recipes Chebyshev approximation (relative error < 1.2 × 10⁻⁷). Direct sums are centred on one Na⁺, in units of q²/(4πε₀r₀).'),
    draw(s, [a, b], c) {
      const as = lin(1, 6, 26), parts = as.map((x) => M.ewald(x, s.nr, s.nk));
      plot(a, { x: [1, 6], y: [-4, 5], xl: L('α（1/a）', 'α (1/a)'), yl: L('对 M 的贡献', 'contribution to M'), series: [{ xs: as, ys: parts.map((p) => -p.Er / 8), color: c.info, width: 1.8, label: L('实空间', 'real') }, { xs: as, ys: parts.map((p) => -p.Ek / 8), color: c.gold, width: 1.8, label: L('倒空间', 'reciprocal') }, { xs: as, ys: parts.map((p) => -p.Es / 8), color: c.muted, width: 1.8, label: L('自能', 'self') }, { xs: as, ys: parts.map((p) => p.M), color: c.ink, width: 3, label: 'M' }], marks: [{ x: s.al, color: c.danger }] });
      const ns = Array.from({ length: 12 }, (_, i) => i + 1);
      plot(b, { x: [1, 12], y: [-8, 11], xl: L('截断 n（r₀ 为单位）', 'cut-off n (units of r₀)'), yl: L('部分和', 'partial sum'), series: [{ xs: ns, ys: ns.map(M.madelungSphere), color: c.danger, dots: 3.5, line: true, width: 1.4, label: L('球形', 'sphere') }, { xs: ns, ys: ns.map(M.madelungEvjen), color: c.accent, dots: 3.5, line: true, width: 1.8, label: 'Evjen' }], hmarks: [{ y: 1.747565, color: c.gold }] });
      const e = M.ewald(s.al, s.nr, s.nk);
      return [[L('Madelung 常数 M', 'Madelung constant M'), fix(e.M, 6), true], [L('与 1.747565 之差', 'Difference from 1.747565'), fmt(e.M - 1.747565, 2)], [L('实空间 / 倒空间 / 自能', 'Real / reciprocal / self'), `${fix(-e.Er / 8, 3)} / ${fix(-e.Ek / 8, 3)} / ${fix(-e.Es / 8, 3)}`], [L('NaCl 的 Madelung 能（r₀ = 2.82 Å）', 'NaCl Madelung energy (r₀ = 2.82 Å)'), `${fix((-e.M * C.bornKJ * 2) / 2.82, 0)} kJ/mol`]];
    },
  };
};
