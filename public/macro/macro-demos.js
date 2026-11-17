'use strict';
// 热、统计与流体（/macro/）的十个演示：Kac 环、Q2R、有限能级的热容、HPP 格子气、格子 Boltzmann 的涡街；第四章的 Ising 热浴、Landau 自由能、块自旋、重整化群流、临界指数。
// 数学都在 macro-models.js（纯函数，tools/macro-test.mjs 测）。macro.js 用 window.MOLASTRIA_MACRO_DEMOS(K, DEMOS) 把它们登记进去。
// 每个演示：title，kind，intro，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，btn 预设，act 动作，state，fps + tick(s)（返回 false 就停），
// changed(s, 键)，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 画图并返回读数 [[名字, 值, 是否加粗]]。K 是 macro.js 给的画图工具。
window.MOLASTRIA_MACRO_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_MACRO_MODELS;
  const { L, fix, fmt, plot, cells, fit, lin, tx, esc } = K;
  const deg = Math.PI / 180;
  const sg = (v, d = 3) => (v >= 0 ? '+' : '−') + Math.abs(v).toFixed(d);
  // ── Kac 环 ──────────────────────────────────────────────────
  const kacReset = (s) => { const a = M.kacInit(s.N, s.mu, s.seed * 13 + s.N); s.c = a.c; s.mk = a.mk; s.m = a.mk.reduce((x, y) => x + y, 0); s.t = 0; s.back = false; s.hist = [1]; };
  DEMOS.kac = {
    title: L('Kac 环：可逆的规则，照样“趋向平衡”', 'The Kac ring: a reversible rule that still “approaches equilibrium”'), kind: 'exact',
    intro: L('N 个球排成一圈，开始全是白的。每一拍所有球顺时针挪一格；圈上有些边做了记号，球越过记号就变色。规则完全确定、完全可逆。Boltzmann 式的论证（假设“下一拍要过记号的球里，黑白比例和全体一样”）给出黑白之差按 (1 − 2μ)^t 衰减。', 'N balls on a ring, all white to begin with. At every tick each ball moves one place clockwise; some edges are marked, and a ball crossing a mark changes colour. The rule is fully deterministic and fully reversible. A Boltzmann-style argument (assume that the balls about to cross a mark have the same colour ratio as all balls) predicts that the white-minus-black difference decays as (1 − 2μ)^t.'),
    ctl: [['N', L('球数 N', 'Balls N'), 50, 2000, 50, 500, (v) => String(v)], ['mu', L('记号的比例 μ', 'Fraction of marked edges μ'), 0.005, 0.3, 0.005, 0.03, (v) => v.toFixed(3)], ['seed', L('换一种记号的摆法', 'Another placement of marks'), 1, 40, 1, 3, (v) => `#${v}`]],
    btn: [[L('大环，记号少', 'Large ring, few marks'), { N: 2000, mu: 0.01 }], [L('小环', 'Small ring'), { N: 50, mu: 0.1 }], [L('记号多', 'Many marks'), { N: 500, mu: 0.2 }]],
    act: [[L('掉头往回跑', 'Run backwards'), (s) => { s.back = !s.back; }], [L('重新开始', 'Restart'), (s) => kacReset(s)]],
    fps: 20,
    tick(s) { const k = Math.max(1, Math.round(s.N / 150)); for (let i = 0; i < k; i++) { if (s.back && s.t === 0) { s.back = false; return false; } s.c = M.kacStep(s.c, s.mk, s.back); s.t += s.back ? -1 : 1; s.hist.push(M.kacDelta(s.c)); if (!s.back && s.t >= 2 * s.N) return false; } },
    changed(s) { kacReset(s); },
    figs: [[0.1, L('现在的一圈球（摊平了画）：白和黑。', 'The ring as it is now (drawn flat): white and black.')], [0.5, L('黑白之差 Δ =（白 − 黑）/ N 随已经走过的拍数的变化。实线是这个环真正走出来的，虚线是 Boltzmann 式论证的预言。横轴是“已经走过的拍数”，掉头之后继续往右画。', 'The difference Δ = (white − black) / N against the number of ticks elapsed. Solid: what this ring actually does. Dashed: the Boltzmann-style prediction. The axis counts elapsed ticks, so after turning round the curve continues to the right.')], [0.4, L('粗粒化的熵（每个球，以 k 为单位）：只知道黑白比例时，有多少种摆法与它相容。上限是 ln 2。', 'The coarse-grained entropy (per ball, in units of k): how many arrangements are compatible with the colour ratio alone. Its ceiling is ln 2.')]],
    note: L('这个模型是 Mark Kac 1959 年提出的。它把三件事放在一张图上：(1) 微观状态的数目从来没有变过，细粒度的熵恒为零；(2) 只看黑白比例时，熵几乎总是在涨，和 Boltzmann 的预言吻合；(3) 掉头就精确地原路返回；走满 N 拍时每个球都越过了全部 m 个记号，Δ 精确等于 (−1)^m，走满 2N 拍一定回到全白。细粒度的熵是 0，因为始终只有一个微观状态。Boltzmann 的假设不是定理：它对绝大多数记号摆法、在远小于 N 的时间里成立。', 'The model is due to Mark Kac (1959). It puts three facts on one graph: (1) the number of microstates never changes, so the fine-grained entropy is identically zero; (2) looking at the colour ratio alone, entropy almost always grows, in line with Boltzmann’s prediction; (3) turning round retraces the path exactly; after N ticks every ball has crossed all m marks, so Δ is exactly (−1)^m, and after 2N ticks the ring is certainly all white again. The fine-grained entropy is 0 because there is always exactly one microstate. Boltzmann’s assumption is not a theorem: it holds for the overwhelming majority of mark placements and for times much shorter than N.'),
    draw(s, [strip, cv, cv2], c) {
      cells(strip, [s.c], (v) => (v > 0 ? c.surface : c.ink));
      const n = s.hist.length, xs = Array.from({ length: n }, (_, i) => i), xmax = Math.max(60, Math.min(2.05 * s.N, Math.max(n * 1.15, 6 / s.mu)));
      const bx = lin(0, xmax, 240), d = s.hist[n - 1];
      plot(cv, { x: [0, xmax], y: [-1.05, 1.05], xl: L('已经走过的拍数', 'ticks elapsed'), yl: 'Δ', hmarks: [{ y: 0, color: c.muted }],
        series: [{ xs: bx, ys: bx.map((x) => (1 - 2 * s.mu) ** x), color: c.gold, dash: [5, 4], label: '(1 − 2μ)^t' }, { xs, ys: s.hist, color: c.accent, width: 1.8, label: L('这个环', 'this ring') }] });
      plot(cv2, { x: [0, xmax], y: [0, 0.75], xl: L('已经走过的拍数', 'ticks elapsed'), yl: 'S / Nk', hmarks: [{ y: Math.LN2, color: c.gold }], texts: [{ x: xmax, y: Math.LN2, s: 'ln 2', align: 'right', dy: 14, color: c.gold }],
        series: [{ xs, ys: s.hist.map(M.mixEntropy), color: c.accent, width: 1.8 }] });
      return [[L('时刻 t', 'Time t'), String(s.t), 1], ['Δ', sg(d)], [L('Boltzmann 预言', 'Boltzmann prediction'), sg((1 - 2 * s.mu) ** s.t)], [L('记号数 m', 'Marks m'), String(s.m)], [L('走满 N 拍时的 Δ', 'Δ after N ticks'), L(`${s.m % 2 ? '−1' : '+1'}（精确）`, `${s.m % 2 ? '−1' : '+1'} (exactly)`)], [L('细粒度的熵', 'Fine-grained entropy'), '0'], [L('方向', 'Direction'), s.back ? L('正在往回跑', 'running backwards') : L('向前', 'forwards')]];
    },
  };

  // ── Q2R ───────────────────────────────────────────────────────────
  const QL = 64; let QC = null;
  const q2rCurve = () => { if (!QC) { const b = Array.from({ length: 160 }, (_, i) => M.ISING.betaC + 10 ** (-12 + 12.42 * (i / 159))); QC = { u: [...b.map(M.isingU).reverse(), M.ISING.uC], m: [...b.map(M.isingM).reverse(), 0] }; } return QC; };
  const q2rReset = (s) => { s.s = M.q2rInit(QL, s.f, s.seed * 17 + 5); s.e = M.q2rEnergy(s.s, QL) / (QL * QL); s.t = 0; s.back = false; s.hist = [M.q2rMag(s.s)]; };
  DEMOS.q2r = {
    title: L('Q2R：一个确定、可逆、能量精确守恒的 Ising 自动机', 'Q2R: a deterministic, reversible Ising automaton with exactly conserved energy'), kind: 'exact',
    intro: L('64 × 64 的格子，每格一个自旋（上或下）。规则只有一句：四个邻居里恰好两上两下时，这个自旋翻转，否则不动。这样翻转不改变能量，所以能量一拍都不变；棋盘的黑格和白格轮流更新，所以可逆。没有随机数，没有温度。问题是：它自己会不会走到统计力学说的平衡态？', 'A 64 × 64 grid with one spin (up or down) per cell. The rule is one sentence: a spin flips when exactly two of its four neighbours are up, and otherwise stays. Such a flip costs no energy, so the energy never changes; the two colours of the checkerboard are updated in turn, so the rule is reversible. There are no random numbers and no temperature. The question: does it find the equilibrium state of statistical mechanics by itself?'),
    ctl: [['f', L('开始时翻下来的比例', 'Fraction flipped down at the start'), 0.01, 0.5, 0.01, 0.3, (v) => v.toFixed(2)], ['seed', L('换一个初态', 'Another initial state'), 1, 40, 1, 2, (v) => `#${v}`]],
    btn: [[L('高能量（无序相）', 'High energy (disordered phase)'), { f: 0.3 }], [L('临界能量上方一点', 'Just above the critical energy'), { f: 0.1 }], [L('低能量（冻住了）', 'Low energy (frozen)'), { f: 0.03 }]],
    act: [[L('掉头往回跑', 'Run backwards'), (s) => { s.back = !s.back; }], [L('重新开始', 'Restart'), (s) => q2rReset(s)]],
    fps: 15,
    tick(s) { for (let i = 0; i < 2; i++) { if (s.back && s.t === 0) { s.back = false; return false; } M.q2rStep(s.s, QL, s.back); s.t += s.back ? -1 : 1; s.hist.push(M.q2rMag(s.s)); if (s.hist.length > 4000) s.hist.shift(); } },
    changed(s) { q2rReset(s); },
    figs: [[1, L('格子：深色是向下的自旋。', 'The lattice: dark cells are down spins.')], [0.45, L('磁化强度 m =（上 − 下）/ 总数 随已经走过的拍数的变化。', 'Magnetisation m = (up − down) / total against ticks elapsed.')], [0.6, L('曲线是二维 Ising 模型的精确解（能量来自 Onsager 1944，磁化来自 Yang 1952）：无限大格子在平衡时，每格能量 u 对应的自发磁化 |m|。点是这个自动机现在的位置（u 不会动，只有 |m| 在动）。', 'The curve is the exact solution of the two-dimensional Ising model (energy from Onsager 1944, magnetisation from Yang 1952): the spontaneous magnetisation |m| of the infinite lattice in equilibrium at energy u per site. The dot is where this automaton is now (u cannot move; only |m| does).')]],
    note: L('这条规则由 Vichniac 1984 年提出，Pomeau 给出了它的守恒量。高能量时磁化很快掉到零附近，和平衡态一致。临界能量附近弛豫极慢。低能量时它根本不动：孤立的反向自旋四个邻居全朝上，永远不满足翻转条件，系统被冻在一个远离平衡的状态。这是一个老实的提醒：确定、可逆、守恒，并不保证各态历经；“等概率”是统计力学的一条假设，要靠动力学足够混乱来支撑。', 'The rule was proposed by Vichniac in 1984, and Pomeau gave its invariant. At high energy the magnetisation falls quickly to near zero, as in equilibrium. Near the critical energy relaxation is extremely slow. At low energy nothing moves at all: an isolated reversed spin has four up neighbours and never meets the flipping condition, so the system is frozen far from equilibrium. An honest reminder: deterministic, reversible and conservative does not guarantee ergodic; “equal a priori probability” is an assumption of statistical mechanics that has to be earned by sufficiently chaotic dynamics.'),
    draw(s, [lat, cv, cv2], c) {
      const rows = []; for (let y = 0; y < QL; y++) rows.push(s.s.subarray(y * QL, (y + 1) * QL));
      cells(lat, rows, (v) => (v < 0 ? c.ink : null));
      const n = s.hist.length, m = s.hist[n - 1], xs = Array.from({ length: n }, (_, i) => i), eq = M.isingMofU(s.e);
      plot(cv, { x: [0, Math.max(200, n * 1.1)], y: [-1.05, 1.05], xl: L('已经走过的拍数（最近 4000 拍）', 'ticks elapsed (latest 4000)'), yl: 'm', hmarks: [{ y: 0, color: c.muted }, ...(eq ? [{ y: eq, color: c.gold }] : [])], series: [{ xs, ys: s.hist, color: c.accent, width: 1.6 }] });
      plot(cv2, { x: [-2, 0], y: [0, 1.05], xl: L('每格能量 u / J', 'energy per site u / J'), yl: '|m|', xt: [-2, -1.5, -1, -0.5, 0],
        series: [{ xs: q2rCurve().u, ys: q2rCurve().m, color: c.gold, width: 2, label: L('精确解（平衡）', 'exact solution (equilibrium)') }, { xs: [M.ISING.uC, 0], ys: [0, 0], color: c.gold, width: 2 }],
        marks: [{ x: s.e, y: Math.abs(m), color: c.accent }], texts: [{ x: M.ISING.uC, y: 0.08, s: 'u_c = −√2', align: 'left', dx: 6, color: c.muted }] });
      return [[L('每格能量 u / J', 'Energy per site u / J'), fix(s.e, 4), 1], [L('时刻 t', 'Time t'), String(s.t)], [L('磁化 m', 'Magnetisation m'), sg(m)], [L('这个能量下平衡的 |m|', 'Equilibrium |m| at this energy'), fix(eq, 3)], [L('相', 'Phase'), s.e > M.ISING.uC ? L('u > u_c：平衡时无序', 'u > u_c: disordered in equilibrium') : L('u < u_c：平衡时有序', 'u < u_c: ordered in equilibrium')], [L('方向', 'Direction'), s.back ? L('正在往回跑', 'running backwards') : L('向前', 'forwards')]];
    },
  };


  // ── 有限条能级放进热浴 ─────────────────────────────────────────────────
  DEMOS.levels = {
    title: L('把有限条能级放进热浴：从两条能级到 Planck 公式', 'Finitely many levels in a heat bath: from two levels to Planck’s formula'), kind: 'exact',
    intro: L('一个系统有 N 条等间隔的能级 E_k = kω（k = 0 … N − 1）。按 Boltzmann 权重 e^{−E/kT} 给它们分配概率，就能算平均能量和热容。能级数趋于无穷时，结果是 Planck 的振子公式；N = 2 是二能级系统。', 'A system has N equally spaced levels E_k = kω (k = 0 … N − 1). Weighting them by the Boltzmann factor e^{−E/kT} gives the mean energy and the heat capacity. As the number of levels goes to infinity the result is Planck’s oscillator formula; N = 2 is the two-level system.'),
    ctl: [['N', L('能级数 N', 'Levels N'), 2, 60, 1, 8, (v) => String(v)], ['x', L('温度 kT / ω', 'Temperature kT / ω'), 0.05, 40, 0.05, 2, (v) => v.toFixed(2)]],
    btn: [[L('二能级', 'Two levels'), { N: 2, x: 1 }], [L('八条能级', 'Eight levels'), { N: 8, x: 2 }], [L('六十条能级', 'Sixty levels'), { N: 60, x: 5 }]],
    figs: [[0.5, L('平均能量随温度的变化：N 条能级、Planck 振子（N → ∞）和经典的能量均分 kT。', 'Mean energy against temperature: N levels, Planck’s oscillator (N → ∞) and classical equipartition kT.')], [0.42, L('热容。能级有上限，温度高了以后再也吸不进热（Schottky 型的峰）。', 'Heat capacity. The spectrum has a top, so at high temperature no more heat can be absorbed (a Schottky-type peak).')], [0.36, L('各条能级上的概率。', 'Occupation probabilities of the levels.')]],
    note: L('平均能量是两项之差：第一项是 Planck 公式，第二项是能级有限的修正，N 越大修正越小。N = 2 时热容在 kT ≈ 0.417 ω 处有一个约 0.439 k 的峰，这就是 Schottky 反常，在顺磁盐和固体缺陷的低温比热里能测到。真实的分子振动不是等间隔的（非谐性让能级越往上越密），这里只是最简单的模型。', 'The mean energy is a difference of two terms: the first is Planck’s formula and the second the correction for finitely many levels, smaller the larger N. For N = 2 the heat capacity peaks at about 0.439 k near kT ≈ 0.417 ω: the Schottky anomaly, measured in the low-temperature specific heat of paramagnetic salts and of defects in solids. Real molecular vibrations are not equally spaced (anharmonicity crowds the levels together higher up); this is only the simplest model.'),
    draw(s, [cv, cv2, cv3], c) {
      const N = s.N, xs = lin(0.02, 40, 400), xm = Math.min(40, Math.max(4, 1.6 * N)), cur = M.levelsThermal(N, s.x), osc = M.levelsThermal(Infinity, s.x), xv = xs.filter((x) => x <= xm);
      plot(cv, { x: [0, xm], y: [0, Math.max(2, 0.62 * N)], xl: 'kT / ω', yl: '⟨E⟩ / ω', hmarks: [{ y: (N - 1) / 2, color: c.muted }], texts: [{ x: xm, y: (N - 1) / 2, s: L('(N − 1)/2：全部能级等概率', '(N − 1)/2: all levels equally likely'), align: 'right', dy: -6, color: c.muted }],
        series: [{ xs: xv, ys: xv.map((x) => x), color: c.muted, dash: [2, 4], label: L('经典 kT', 'classical kT') }, { xs: xv, ys: xv.map((x) => M.levelsThermal(Infinity, x).E), color: c.gold, dash: [5, 4], label: L('Planck 振子', 'Planck oscillator') }, { xs: xv, ys: xv.map((x) => M.levelsThermal(N, x).E), color: c.accent, width: 2, label: L(`${N} 条能级`, `${N} levels`) }], marks: [{ x: Math.min(s.x, xm), y: cur.E, color: c.accent }] });
      plot(cv2, { x: [0, xm], y: [0, 1.1], xl: 'kT / ω', yl: 'C / k', series: [{ xs: xv, ys: xv.map((x) => M.levelsThermal(Infinity, x).C), color: c.gold, dash: [5, 4] }, { xs: xv, ys: xv.map((x) => M.levelsThermal(N, x).C), color: c.accent, width: 2 }], marks: [{ x: Math.min(s.x, xm), y: cur.C, color: c.accent }] });
      const w = Array.from({ length: N }, (_, k) => Math.exp(-k / s.x)), Z = w.reduce((a, b) => a + b, 0);
      plot(cv3, { x: [-0.6, N - 0.4], y: [0, Math.max(0.2, (w[0] / Z) * 1.1)], xl: L('能级 k', 'level k'), yl: L('概率', 'probability'), series: [{ xs: w.map((_, k) => k), ys: w.map((v) => v / Z), bars: 0.7, color: c.accent }] });
      return [['⟨E⟩ / ω', fix(cur.E, 3), 1], [L('Planck 振子（N → ∞）', 'Planck oscillator (N → ∞)'), fix(osc.E, 3)], [L('热容 C / k', 'Heat capacity C / k'), fix(cur.C, 3)], [L('高温极限 (N − 1)/2', 'High-temperature limit (N − 1)/2'), fix((N - 1) / 2, 1)], [L('基态的概率', 'Ground-state probability'), fix(w[0] / Z, 3)]];
    },
  };
  // ── HPP 格子气 ───────────────────────────────────────────────
  const heat = (cv, rows, paint) => { const { ctx, w, h } = fit(cv), m = rows.length, n = rows[0].length, cw = w / n, chh = h / m; for (let j = 0; j < m; j++) { const y0 = Math.round(j * chh), y1 = Math.round((j + 1) * chh); for (let i = 0; i < n; i++) { const p = paint(rows[j][i], j, i); if (!p) continue; const x0 = Math.round(i * cw); ctx.globalAlpha = Math.max(0, Math.min(1, p[1])); ctx.fillStyle = p[0]; ctx.fillRect(x0, y0, Math.round((i + 1) * cw) - x0, y1 - y0); } } ctx.globalAlpha = 1; return { ctx, w, h }; };
  const HL = 192, HB = 4;
  const hppReset = (s) => { s.c = M.hppInit(HL, s.rho, s.seed * 11 + 3, { r: 18, rho: 0.95 }); s.t = 0; s.back = false; s.tot = M.hppTotals(s.c, HL); };
  DEMOS.lgas = {
    title: L('HPP 格子气：四个比特的“分子”，和它为什么不够圆', 'The HPP lattice gas: four-bit “molecules”, and why they are not round enough'), kind: 'exact',
    intro: L('192 × 192 的方格子，每个格点最多有四个粒子，各朝东、南、西、北。每一拍：迎面相撞的一对粒子（格点上没有别人时）一起转 90°，然后所有粒子前进一格。粒子数和动量精确守恒，规则精确可逆。中间放一团密的气体，看它怎样把压力传出去。', 'A 192 × 192 square lattice with at most four particles per site, heading east, south, west and north. At each tick a head-on pair alone on a site turns by 90°, then every particle advances one site. Particle number and momentum are conserved exactly and the rule is exactly reversible. A dense blob sits in the middle: watch how it passes its pressure on.'),
    ctl: [['rho', L('背景密度（每个方向）', 'Background density (per direction)'), 0.02, 0.5, 0.01, 0.12, (v) => v.toFixed(2)], ['seed', L('换一个初态', 'Another initial state'), 1, 40, 1, 1, (v) => `#${v}`]],
    act: [[L('掉头往回跑', 'Run backwards'), (s) => { s.back = !s.back; }], [L('重新开始', 'Restart'), (s) => hppReset(s)]],
    fps: 20,
    tick(s) { if (s.back && s.t === 0) { s.back = false; return false; } s.c = M.hppStep(s.c, HL, s.back); s.t += s.back ? -1 : 1; },
    changed(s) { hppReset(s); },
    figs: [[1, L('粗粒化的密度：每 4 × 4 个格点取平均。颜色越深，粒子越多。', 'Coarse-grained density: averages over 4 × 4 sites. Darker means more particles.')], [0.42, L('为什么方格子不行：把格子的几个速度方向 c_i 在任意方向 n 上的投影取四次方再求和。六角格子（FHP）得到常数，方格子（HPP）随方向起伏。粘性应力正好由这个四阶量决定。', 'Why the square lattice fails: project the lattice velocities c_i on an arbitrary direction n, raise to the fourth power and sum. The hexagonal lattice (FHP) gives a constant; the square lattice (HPP) varies with direction. Viscous stress is governed by exactly this fourth-rank quantity.')]],
    note: L('波前不是一个均匀的圆：沿坐标轴的四个方向又浓又快，沿对角线的方向又淡又钝。这就是 HPP 的毛病：它的宏观方程不是各向同性的。它还有多余的守恒量：每一行的东西向动量、每一列的南北向动量各自守恒（测试里逐行核对过），真实流体没有这种东西。1986 年 Frisch、Hasslacher 和 Pomeau 换成六角格子，这两个毛病都消失了。可逆这一条则是真的：放一会儿再掉头，那团气体会精确地聚回去。格子是首尾相接的，波大约 140 拍之后会从对面绕回来。', 'The wave front is not a uniform circle: along the four axis directions it is dense and fast, along the diagonals faint and blunt. That is the defect of HPP, whose macroscopic equations are not isotropic. It also has spurious invariants: the east–west momentum of every row and the north–south momentum of every column are conserved separately (checked row by row in the tests), which no real fluid does. In 1986 Frisch, Hasslacher and Pomeau moved to the hexagonal lattice and both defects disappeared. Reversibility, on the other hand, is real: let it run and turn round, and the blob reassembles exactly. The lattice wraps round, so after about 140 ticks the wave comes back from the other side.'),
    draw(s, [cv, cv2], c) {
      heat(cv, M.hppCoarse(s.c, HL, HB), (v) => [c.accent, v / 4 * 1.15]);
      const th = lin(0, 180, 181);
      plot(cv2, { x: [0, 180], y: [0.5, 1.5], xl: L('方向 n 的角度（度）', 'angle of the direction n (degrees)'), yl: L('Σ(c·n)⁴ ÷ 平均值', 'Σ(c·n)⁴ ÷ its mean'), xt: [0, 45, 90, 135, 180],
        series: [{ xs: th, ys: th.map((a) => M.latticeQuartic(4, a * deg) / 1.5), color: c.gold, width: 2, label: L('方格子（HPP，4 个方向）', 'square (HPP, 4 directions)') }, { xs: th, ys: th.map((a) => M.latticeQuartic(6, a * deg) / 2.25), color: c.accent, width: 2, label: L('六角格子（FHP，6 个方向）', 'hexagonal (FHP, 6 directions)') }] });
      const now = M.hppTotals(s.c, HL);
      return [[L('时刻 t', 'Time t'), String(s.t), 1], [L('粒子数', 'Particles'), `${now.n}${now.n === s.tot.n ? L('（没变）', ' (unchanged)') : ''}`], [L('总动量 (x, y)', 'Total momentum (x, y)'), `(${now.px}, ${now.py})`], [L('方向', 'Direction'), s.back ? L('正在往回跑', 'running backwards') : L('向前', 'forwards')]];
    },
  };

  // ── 格子 Boltzmann：绕圆盘的流动 ───────────────────────────
  const BX = 160, BY = 64, BU = 0.1;
  const lbReset = (s) => { s.S = M.lbInit(BX, BY, { u0: BU, open: 'x', bar: M.lbDisc(BX, BY, 36, BY / 2 + 1, s.r), u: (x, y) => [BU, 0.02 * Math.exp(-((x - 50) ** 2 + (y - 30) ** 2) / 40)] }); s.probe = []; };
  const lbPeriod = (p) => { const mean = p.reduce((a, b) => a + b, 0) / (p.length || 1), z = []; for (let i = 1; i < p.length; i++) if (p[i - 1] - mean < 0 && p[i] - mean >= 0) z.push(i); const amp = p.length ? Math.max(...p) - Math.min(...p) : 0; return z.length >= 3 && amp > 0.004 ? (z[z.length - 1] - z[0]) / (z.length - 1) : 0; };
  DEMOS.lbm = {
    title: L('格子 Boltzmann：圆柱后面的涡街', 'Lattice Boltzmann: the vortex street behind a cylinder'), kind: 'exact',
    intro: L('160 × 64 的格子，每个格点存 9 个数：朝 9 个方向走的粒子的“平均数目”。每一拍两件事：向局域平衡分布松弛一点（碰撞），然后各自沿自己的方向挪一格（迁移）。没有任何地方写着 Navier–Stokes 方程，但宏观上出来的就是它。风从左边吹来，中间有一个圆盘；上下两边是连通的。', 'A 160 × 64 grid with nine numbers per site: the “mean populations” of particles heading in nine directions. Two things happen at each tick: relax a little towards the local equilibrium (collision), then move one site along your own direction (streaming). The Navier–Stokes equation is written nowhere, yet that is what comes out macroscopically. Wind blows from the left; a disc sits in the stream; top and bottom wrap round.'),
    ctl: [['nu', L('粘度 ν（格子单位）', 'Viscosity ν (lattice units)'), 0.01, 0.1, 0.001, 0.011, (v) => v.toFixed(3)], ['r', L('圆盘半径（格）', 'Disc radius (cells)'), 3, 8, 1, 5, (v) => String(v)]],
    btn: [[L('Re ≈ 20：稳定的尾迹', 'Re ≈ 20: steady wake'), { nu: 0.055, r: 5 }], [L('Re ≈ 55：刚开始摆', 'Re ≈ 55: onset of shedding'), { nu: 0.02, r: 5 }], [L('Re ≈ 100：涡街', 'Re ≈ 100: vortex street'), { nu: 0.011, r: 5 }]],
    act: [[L('重新开始', 'Restart'), (s) => lbReset(s)]],
    fps: 15,
    tick(s) { const tau = 3 * s.nu + 0.5; for (let i = 0; i < 12; i++) { M.lbStep(s.S, tau); if (s.S.t % 10 === 0) { s.probe.push(s.S.uy[(BY / 2) * BX + 80]); if (s.probe.length > 600) s.probe.shift(); } } },
    changed(s, k) { if (k !== 'nu' || !s.S) lbReset(s); else s.probe = []; },
    figs: [[BY / BX, L('涡量（流体微团转得多快）：红色逆时针，蓝色顺时针。', 'Vorticity (how fast a fluid element spins): red anticlockwise, blue clockwise.')], [0.36, L('圆盘下游一点处的横向速度。它开始规则地摆动，就是涡在交替脱落。', 'The cross-stream velocity at a point downstream of the disc. When it starts to swing regularly, vortices are being shed alternately.')]],
    note: L('粘度不是输入给方程的，它来自松弛时间：ν = (τ − ½)/3。测试里用一个剪切波的衰减核对过这个公式，三个 τ 值都在 1 % 以内。Re 大约过 47 之后稳定的尾迹失稳，变成 Kármán 涡街，这是 Navier–Stokes 方程的性质，格子并不知道。开始时在圆盘后面加了一小股横向的风，否则完全对称的初态只能等舍入误差来打破对称。这张格子很粗、风洞很窄、流速是声速的 17 %，所以脱落频率（Strouhal 数）只能和教科书值（Re = 100 时约 0.17）比个大概。', 'Viscosity is not an input to an equation here; it comes from the relaxation time: ν = (τ − ½)/3. The tests check this formula against the decay of a shear wave, within 1 % for three values of τ. Beyond Re ≈ 47 the steady wake becomes unstable and turns into a Kármán vortex street: a property of the Navier–Stokes equation that the lattice knows nothing about. A small sideways gust is added behind the disc at the start; otherwise a perfectly symmetric initial state would have to wait for rounding errors to break the symmetry. This grid is coarse, the tunnel narrow and the wind 17 % of the speed of sound, so the shedding frequency (Strouhal number) can be compared with the textbook value (about 0.17 at Re = 100) only roughly.'),
    draw(s, [cv, cv2], c) {
      const S = M.lbMoments(s.S), w = M.lbCurl(S), rows = [];
      for (let y = 0; y < BY; y++) rows.push(y);
      heat(cv, rows.map((y) => w.subarray(y * BX, (y + 1) * BX)), (v, j, i) => (S.bar[j * BX + i] ? [c.ink2, 1] : Math.abs(v) < 0.002 ? null : [v < 0 ? c.danger : c.info, Math.abs(v) * 28]));
      const n = s.probe.length;
      plot(cv2, { x: [0, Math.max(100, n)], y: [-0.09, 0.09], xl: L('时间（每点 10 拍，最近 6000 拍）', 'time (10 ticks per point, latest 6000)'), yl: L('横向速度', 'cross-stream velocity'), hmarks: [{ y: 0, color: c.muted }], series: [{ xs: s.probe.map((_, i) => i), ys: s.probe, color: c.accent, width: 1.6 }] });
      const per = lbPeriod(s.probe) * 10, D = 2 * s.r + 1;
      return [[L('Reynolds 数 UD/ν', 'Reynolds number UD/ν'), fix((BU * D) / s.nu, 0), 1], [L('松弛时间 τ = 3ν + ½', 'Relaxation time τ = 3ν + ½'), fix(3 * s.nu + 0.5, 3)], [L('时刻 t', 'Time t'), String(S.t)], [L('脱落周期', 'Shedding period'), per ? L(`约 ${Math.round(per)} 拍`, `about ${Math.round(per)} ticks`) : L('还没有周期性的摆动', 'no periodic swing yet')], [L('Strouhal 数 fD/U', 'Strouhal number fD/U'), per ? fix(D / (per * BU), 2) : '—']];
    },
  };
  // ── 第四章：带热浴的 Ising 模型（Metropolis / Wolff） ─────────────────────
  const TC = 2 / Math.log(1 + Math.SQRT2);
  const isReset = (s, cold) => { s.L = Number(s.Lsel); s.s = M.isingInit(s.L, cold ?? s.T < TC, s.seed++ * 7 + 1); s.r = s.r || M.rng(20261117); s.hist = []; isStats(s); };
  const isStats = (s) => { s.age = 0; s.n = 0; s.am = 0; s.m2 = 0; s.m4 = 0; s.u = 0; s.work = 0; s.done = 0; };
  let isCurve = null;
  const isExactCurve = () => isCurve || (isCurve = (() => { const T = lin(0.6, 4, 340); return { T, m: T.map((t) => M.isingExactT(t).m) }; })());
  DEMOS.ising = {
    title: L('Ising 模型放进热浴：有序、临界和无序', 'The Ising model in a heat bath: ordered, critical and disordered'), kind: 'mc',
    intro: L('和第二章的 Q2R 一样是 Ising 模型，这一次接上了热浴：每一步按 Boltzmann 权重掷骰子决定翻不翻（Metropolis），或者整团一起翻（Wolff）。拖动温度，看磁化在 T_c ≈ 2.269 J/k 附近从有到无；“扫描温度”从高温一路降下来，逐点量平均的 |m|，和 Onsager–Yang 的精确曲线比。', 'The same Ising model as Q2R in chapter 2, this time connected to a heat bath: at each step a die weighted by the Boltzmann factor decides whether to flip (Metropolis), or a whole cluster flips at once (Wolff). Drag the temperature and watch the magnetisation disappear near T_c ≈ 2.269 J/k; “Scan temperature” comes down from high temperature, measures the mean |m| point by point and compares it with the exact Onsager–Yang curve.'),
    sel: [['Lsel', L('格子', 'Lattice'), [[32, '32 × 32'], [64, '64 × 64'], [128, '128 × 128']], 64], ['alg', L('怎样更新', 'Update rule'), [['metro', L('Metropolis：一次试翻一个', 'Metropolis: one spin at a time')], ['wolff', L('Wolff：整团翻转', 'Wolff: flip a whole cluster')]], 'metro']],
    ctl: [['T', L('温度 kT / J', 'Temperature kT / J'), 1, 4, 0.01, 2.0, (v) => v.toFixed(2)]],
    btn: [[L('T = 1.5：有序', 'T = 1.5: ordered'), { T: 1.5 }], [L('T = 2.27：临界', 'T = 2.27: critical'), { T: 2.27 }], [L('T = 3.0：无序', 'T = 3.0: disordered'), { T: 3 }]],
    act: [[L('扫描温度（3.5 → 1.5）', 'Scan temperature (3.5 → 1.5)'), (s) => { s.scan = true; s.pts = []; s.T = 3.5; isReset(s, false); }], [L('从全无序重新开始', 'Restart from random')], [L('从全朝上重新开始', 'Restart all up')]].map((a, i) => (i === 1 ? [a[0], (s) => { s.scan = false; isReset(s, false); }] : i === 2 ? [a[0], (s) => { s.scan = false; isReset(s, true); }] : a)),
    state: () => ({ seed: 1, pts: [], scan: false }),
    fps: 15,
    tick(s) {
      const N = s.L * s.L;
      if (s.alg === 'wolff') { let f = 0; while (f < N) { const c = M.wolffStep(s.s, s.L, s.T, s.r); f += c; s.work += c; s.done++; } }
      else for (let k = 0; k < 2; k++) s.done += M.metropolisSweep(s.s, s.L, s.T, 0, s.r), s.work += N;
      const m = M.q2rMag(s.s); s.hist.push(m); if (s.hist.length > 600) s.hist.shift(); s.age++;
      if (s.age > 25) { const a = Math.abs(m); s.n++; s.am += a; s.m2 += a * a; s.m4 += a ** 4; s.u += M.q2rEnergy(s.s, s.L) / N; }
      if (s.scan && s.n >= 50) { s.pts.push([s.T, s.am / s.n, s.L * s.L * (s.m2 / s.n - (s.am / s.n) ** 2) / s.T]); if (s.T <= 1.51) { s.scan = false; return false; } s.T = Math.round((s.T - 0.1) * 100) / 100; isStats(s); }
    },
    changed(s, k) { if (k !== 'alg') s.scan = false; if (!s.s || k === 'Lsel' || k === '') isReset(s); else isStats(s); },
    figs: [[1, L('格子：深色是向下的自旋。', 'The lattice: dark cells are down spins.')], [0.4, L('磁化 m 随时间（最近 600 步）。临界点附近它大幅度地来回漂。', 'Magnetisation m against time (latest 600 steps). Near the critical point it wanders up and down in large swings.')], [0.6, L('金线是无穷大格子的精确解 |m|(T)。点是扫描时这个有限格子量出来的平均 |m|；有限的格子在 T_c 以上也有一点磁化，格子越大，台阶越陡。', 'Gold: the exact |m|(T) of the infinite lattice. Dots: the mean |m| this finite lattice measures during a scan; a finite lattice keeps some magnetisation above T_c, and the larger the lattice, the steeper the step.')]],
    note: L('这里的随机数只决定“走哪条路”，平衡态由 Boltzmann 权重决定，所以两种更新方法给出同样的平均值（测试里在 T = 2.0 对过精确解）。差别在速度：临界点附近关联长度变大，Metropolis 一次只翻一个自旋，要很久才能把一大片翻过来（临界慢化，弛豫时间约按 L^z、z ≈ 2.2 增长）；Wolff 按 p = 1 − e^{−2J/kT} 把同号的邻居连成一团，整团翻转，临界慢化几乎消失。格子是有限的，所以 T_c 附近的 |m| 和 χ 都被“抹圆”了；从不同大小的格子外推到无穷大，就是有限尺寸标度。磁化率 χ 和 Binder 累积量 U 是从这一温度下的样本算的，样本少的时候误差很大。', 'The random numbers here only choose the path; the equilibrium state is fixed by the Boltzmann weights, so both update rules give the same averages (the tests compare them with the exact solution at T = 2.0). They differ in speed: near the critical point the correlation length grows, and Metropolis, flipping one spin at a time, takes a very long time to turn over a large patch (critical slowing down: the relaxation time grows roughly as L^z with z ≈ 2.2); Wolff joins like neighbours into a cluster with probability p = 1 − e^{−2J/kT} and flips the whole cluster, and the slowing down nearly disappears. The lattice is finite, so |m| and χ are rounded off near T_c; extrapolating from lattices of several sizes to infinity is finite-size scaling. The susceptibility χ and the Binder cumulant U are computed from the samples at this temperature and are very noisy while there are few of them.'),
    draw(s, [lat, cv, cv2], c) {
      const L0 = s.L, rows = []; for (let y = 0; y < L0; y++) rows.push(s.s.subarray(y * L0, (y + 1) * L0));
      cells(lat, rows, (v) => (v < 0 ? c.ink : c.surface));
      plot(cv, { x: [0, 600], y: [-1.05, 1.05], xl: L('步数（最近 600 步）', 'steps (latest 600)'), yl: 'm', hmarks: [{ y: 0, color: c.muted }], series: [{ xs: s.hist.map((_, i) => i), ys: s.hist, color: c.accent, width: 1.5 }] });
      const E = isExactCurve(), pts = s.pts || [];
      plot(cv2, { x: [1, 4], y: [0, 1.05], xl: 'kT / J', yl: '⟨|m|⟩', marks: [{ x: s.T, color: c.accent }], texts: [{ x: TC, y: 1.0, s: 'T_c', dx: 4, color: c.muted }],
        series: [{ xs: E.T, ys: E.m, color: c.gold, width: 2, label: L('精确解（无穷大格子）', 'exact (infinite lattice)') }, { xs: [TC, TC], ys: [0, 1.05], color: c.muted, dash: [2, 4] }, { pts: pts.map((p) => [p[0], p[1]]), color: c.accent, dots: 3.5, label: L(`扫描（${L0} × ${L0}）`, `scan (${L0} × ${L0})`) }] });
      const n = s.n, am = n ? s.am / n : NaN, ex = M.isingExactT(s.T);
      return [[L('温度 kT / J', 'Temperature kT / J'), fix(s.T, 2), 1], [L('⟨|m|⟩（这个格子）', '⟨|m|⟩ (this lattice)'), n ? `${fix(am, 3)}<small> · ${n} ${L('个样本', 'samples')}</small>` : L('在平衡…', 'equilibrating…')], [L('精确的 |m|（无穷大格子）', 'Exact |m| (infinite lattice)'), fix(ex.m, 3)],
        [L('每格能量 ⟨u⟩ / J', 'Energy per site ⟨u⟩ / J'), n ? fix(s.u / n, 3) : '—'], [L('精确的 u / J', 'Exact u / J'), fix(ex.u, 3)], [L('磁化率 χ', 'Susceptibility χ'), n > 5 ? fix((L0 * L0 * (s.m2 / n - am * am)) / s.T, 1) : '—'], ['Binder U', n > 5 ? fix(M.binder(s.m2 / n, s.m4 / n), 3) : '—'],
        [s.alg === 'wolff' ? L('平均团簇大小', 'Mean cluster size') : L('接受率', 'Acceptance rate'), s.work ? (s.alg === 'wolff' ? fix(s.work / s.done, 0) : `${fix((100 * s.done) / s.work, 1)} %`) : '—'], ...(s.scan ? [[L('扫描中', 'Scanning'), L(`已量 ${pts.length} 个温度`, `${pts.length} temperatures measured`)]] : [])];
    },
  };

  // ── Landau 理论和平均场 ──────────────────────────────────────────
  const LD = { second: { b: 0.5, c: 0 }, first: { b: -1, c: 1 } };
  DEMOS.landau = {
    title: L('Landau 自由能：二级相变和一级相变', 'The Landau free energy: continuous and first-order transitions'), kind: 'exact',
    intro: L('Landau 把自由能写成序参量 m 的多项式 f(m) = t m² + b m⁴ + c m⁶ − h m，t = T/T_c − 1。b > 0 时 t 过零，极小值从 m = 0 连续地分开，是二级（连续）相变；b < 0、c > 0 时极小值在 t₁ = b²/4c 处跳过去，是一级相变。下面一张图把平均场的 m(T) 和二维 Ising 的精确解放在一起，看临界指数 β 差多少。', 'Landau writes the free energy as a polynomial in the order parameter m, f(m) = t m² + b m⁴ + c m⁶ − h m with t = T/T_c − 1. For b > 0 the minimum splits continuously from m = 0 as t crosses zero: a continuous (second-order) transition. For b < 0, c > 0 the minimum jumps at t₁ = b²/4c: a first-order transition. The lower plot puts mean-field m(T) next to the exact solution of the 2D Ising model to show how much the critical exponent β differs.'),
    sel: [['kind', L('哪一种', 'Which kind'), [['second', L('二级：b = ½, c = 0', 'Continuous: b = ½, c = 0')], ['first', L('一级：b = −1, c = 1', 'First-order: b = −1, c = 1')]], 'second']],
    ctl: [['t', L('约化温度 t = T/T_c − 1', 'Reduced temperature t = T/T_c − 1'), -0.6, 0.6, 0.005, -0.2, (v) => v.toFixed(3)], ['h', L('外场 h', 'Field h'), -0.1, 0.1, 0.002, 0, (v) => v.toFixed(3)]],
    btn: [[L('t = −0.2', 't = −0.2'), { t: -0.2, h: 0 }], [L('正好在 T_c', 'Exactly at T_c'), { t: 0, h: 0 }], [L('一级：两个极小值等高', 'First-order: two equal minima'), { kind: 'first', t: 0.25, h: 0 }]],
    figs: [[0.5, L('f(m)。金点是全局最小，也就是平衡态。', 'f(m). The gold dot is the global minimum, i.e. the equilibrium state.')], [0.5, L('序参量随温度：这里的 Landau 模型、Weiss 平均场（自洽方程 m = tanh(T_c m / T)）、二维 Ising 的精确解。横轴都以各自的 T_c 为单位。', 'Order parameter against temperature: this Landau model, the Weiss mean field (self-consistent equation m = tanh(T_c m / T)) and the exact 2D Ising solution, each with temperature in units of its own T_c.')], [0.5, L('双对数坐标下的 m 对 |t|：直线的斜率就是 β。平均场是 ½，二维 Ising 是 ⅛。', 'm against |t| on log–log axes: the slope of each line is β. Mean field gives ½, the 2D Ising model ⅛.')]],
    note: L('Landau 理论的前提是自由能在 m = 0 附近可以展开，而且 m 在空间里处处一样，涨落被忽略了。它在四维以上是对的，在三维、二维给出错的临界指数：平均场的 β = ½，三维 Ising 是 0.326，二维是 ⅛。错在哪里，以及怎样改，正是重整化群要回答的。一级相变的跃变温度 t₁ = b²/4c、跃变量 m₁² = −b/2c 是两个极小值等高的条件，测试里核对过；真实系统会在 t₁ 附近过冷或过热，停在亚稳的那个极小值里。', 'Landau theory assumes that the free energy can be expanded about m = 0 and that m is the same everywhere in space: fluctuations are ignored. It is right above four dimensions and gives the wrong critical exponents in three and two: mean field has β = ½, the 3D Ising model 0.326 and the 2D one ⅛. What goes wrong and how to fix it is exactly what the renormalisation group answers. The first-order jump temperature t₁ = b²/4c and jump m₁² = −b/2c follow from the two minima being equally deep and are checked in the tests; a real system supercools or superheats near t₁ and stays in the metastable minimum.'),
    draw(s, [cv, cv2, cv3], c) {
      const { b, c: c6 } = LD[s.kind], ms = lin(-1.6, 1.6, 321), eq = M.landauMin(s.t, b, c6, s.h, 1.6), fs = ms.map((m) => M.landauF(m, s.t, b, c6, s.h));
      const lo = Math.min(...fs), hi = Math.max(lo + 0.05, Math.min(Math.max(...fs), lo + (s.kind === 'first' ? 0.6 : 1.2)));
      plot(cv, { x: [-1.6, 1.6], y: [lo - 0.04 * (hi - lo), hi], xl: L('序参量 m', 'order parameter m'), yl: 'f(m)', hmarks: [{ y: 0, color: c.muted }], series: [{ xs: ms, ys: fs, color: c.accent, width: 2 }], marks: [{ x: eq.m, y: eq.f, color: c.gold }] });
      const Ts = lin(0.3, 1.6, 261), lm = (T) => Math.abs(M.landauMin(T - 1, b, c6, 0, 1.6).m);
      plot(cv2, { x: [0.3, 1.6], y: [0, 1.4], xl: 'T / T_c', yl: '|m|', marks: [{ x: 1 + s.t, y: Math.abs(eq.m), color: c.gold }],
        series: [{ xs: Ts, ys: Ts.map(lm), color: c.accent, width: 2, label: 'Landau' }, { xs: Ts, ys: Ts.map((T) => M.meanFieldM(T, 1, 0)), color: c.info, width: 2, dash: [5, 4], label: L('Weiss 平均场', 'Weiss mean field') }, { xs: Ts, ys: Ts.map((T) => M.isingExactT(T * TC).m), color: c.gold, width: 2, label: L('二维 Ising 精确解', '2D Ising, exact') }] });
      const lt = lin(-4, -0.3, 120), tt = lt.map((x) => 10 ** x);
      plot(cv3, { x: [-4, -0.3], y: [-2.2, 0.1], logx: true, logy: true, xl: '|t| = 1 − T/T_c', yl: '|m|',
        series: [{ xs: tt, ys: tt.map((t) => M.meanFieldM(1 - t, 1, 0)), color: c.info, width: 2, label: L('平均场：斜率 ½', 'mean field: slope ½') }, { xs: tt, ys: tt.map((t) => M.isingExactT((1 - t) * TC).m), color: c.gold, width: 2, label: L('二维 Ising：斜率 ⅛', '2D Ising: slope ⅛') }] });
      const rows = [[L('平衡的 m', 'Equilibrium m'), fix(eq.m, 4), 1], ['f_min', fix(eq.f, 4)]];
      if (s.kind === 'second') rows.push([L('解析：m² = −t / 2b', 'Analytic: m² = −t / 2b'), s.t < 0 && !s.h ? fix(Math.sqrt(-s.t / (2 * b)), 4) : '—']);
      else { const f1 = M.landauFirst(b, c6); rows.push([L('跃变温度 t₁ = b²/4c', 'Jump at t₁ = b²/4c'), fix(f1.t1, 3)], [L('跃变量 m₁', 'Jump size m₁'), fix(f1.m1, 3)]); }
      rows.push([L('临界指数 β', 'Exponent β'), L('平均场 ½ · 二维 ⅛ · 三维 0.326', 'mean field ½ · 2D ⅛ · 3D 0.326')]);
      return rows;
    },
  };

  // ── Kadanoff 块自旋 ───────────────────────────────────────────────
  const BL = 81;
  const kOfCorr = (cr) => { if (!(cr > 0)) return 0; if (cr >= 0.999) return Infinity; let lo = 1e-4, hi = 6; for (let i = 0; i < 60; i++) { const mid = (lo + hi) / 2; if (-M.isingU(mid) / 2 < cr) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  const bsReset = (s) => { s.s = M.isingInit(BL, false, 33 + (s.seed = (s.seed || 0) + 1)); s.r = s.r || M.rng(77); s.n = 0; s.acc = [0, 0, 0, 0].map(() => ({ m: 0, c: 0 })); s.age = 0; };
  DEMOS.blockspin = {
    title: L('Kadanoff 的块自旋：把格子看粗，耦合往哪里走', 'Kadanoff’s block spins: coarsen the lattice and see where the coupling goes'), kind: 'mc',
    intro: L('81 × 81 的 Ising 格子在热浴里平衡（Wolff 加 Metropolis）。每 3 × 3 一块按多数票合成一个“块自旋”，得到 27 × 27；再做一次得到 9 × 9，再一次 3 × 3。每一层量一下相邻块的关联，换算成“看起来像多大耦合 K 的 Ising 模型”：这就是一条实测的重整化群流。', 'An 81 × 81 Ising lattice equilibrates in a heat bath (Wolff plus Metropolis). Each 3 × 3 block votes by majority to become one “block spin”, giving 27 × 27; again gives 9 × 9, and once more 3 × 3. At each level the correlation of neighbouring blocks is measured and converted into “which coupling K an Ising model would need to look like this”: a measured renormalisation-group flow.'),
    ctl: [['T', L('温度 kT / J', 'Temperature kT / J'), 1.5, 3.5, 0.01, 2.27, (v) => v.toFixed(2)]],
    btn: [[L('T = 2.0：低于 T_c', 'T = 2.0: below T_c'), { T: 2 }], [L('T = 2.27：临界', 'T = 2.27: critical'), { T: 2.27 }], [L('T = 2.7：高于 T_c', 'T = 2.7: above T_c'), { T: 2.7 }]],
    act: [[L('重新开始', 'Restart'), (s) => bsReset(s)]],
    state: () => ({}),
    fps: 12,
    tick(s) {
      let f = 0; while (f < BL * BL / 2) f += M.wolffStep(s.s, BL, s.T, s.r); M.metropolisSweep(s.s, BL, s.T, 0, s.r); s.age++;
      if (s.age > 15) { let x = s.s, Lx = BL; s.n++; for (let k = 0; k < 4; k++) { s.acc[k].m += Math.abs(M.q2rMag(x)); s.acc[k].c += M.bondCorr(x, Lx); if (k < 3) { x = M.blockSpin(x, Lx, 3); Lx /= 3; } } }
    },
    changed(s, k) { if (!s.s || k === '') bsReset(s); else { s.n = 0; s.age = 0; s.acc = [0, 0, 0, 0].map(() => ({ m: 0, c: 0 })); } },
    figs: [[1, L('左上起依次是：原来的 81 × 81，块自旋 27 × 27、9 × 9、3 × 3。深色是向下。', 'From top left: the original 81 × 81, then block spins at 27 × 27, 9 × 9 and 3 × 3. Dark is down.')], [0.5, L('每一层“看起来的耦合” K_eff（由相邻块的平均关联反推，用无穷大格子的精确关系）。K_c = 0.4407 是临界耦合；高于它往有序（K → ∞）跑，低于它往无序（K → 0）跑。', 'The apparent coupling K_eff at each level (inferred from the mean correlation of neighbouring blocks via the exact infinite-lattice relation). K_c = 0.4407 is the critical coupling; above it the flow runs towards order (K → ∞), below it towards disorder (K → 0).')]],
    note: L('多数票规则不是精确的重整化变换：块和块之间除了近邻耦合还会长出次近邻、四自旋等耦合，这里只用近邻关联换算一个 K，是一种粗略的读法；3 × 3 那一层只有九个块，涨落很大。所以临界点上 K_eff 不会精确地停住，但方向的分叉在 T_c 两边非常清楚：低于 T_c 每看粗一次就更有序，高于 T_c 每看粗一次就更无序。这正是 Kadanoff 1966 年的图像，Wilson 1971 年把它做成了能算指数的理论。', 'The majority rule is not an exact renormalisation transformation: besides nearest-neighbour couplings, the blocks acquire next-nearest, four-spin and other couplings, and converting only the nearest-neighbour correlation into one K is a rough reading; the 3 × 3 level has only nine blocks and fluctuates strongly. So K_eff does not stand exactly still at the critical point, but the forking of the flow on either side of T_c is very clear: below T_c each coarsening looks more ordered, above T_c more disordered. This is Kadanoff’s 1966 picture, which Wilson turned in 1971 into a theory that computes exponents.'),
    draw(s, [cv, cv2], c) {
      const { ctx, w, h } = fit(cv), gap = 12, side = Math.min((h - gap) / 2, (w - gap) / 2), ox = (w - 2 * side - gap) / 2; let x = s.s, Lx = BL;
      for (let k = 0; k < 4; k++) { const x0 = ox + (k % 2) * (side + gap), y0 = Math.floor(k / 2) * (side + gap), cw = side / Lx; ctx.fillStyle = c.surface; ctx.fillRect(x0, y0, side, side); ctx.fillStyle = c.ink; for (let j = 0; j < Lx; j++) for (let i = 0; i < Lx; i++) if (x[j * Lx + i] < 0) ctx.fillRect(x0 + Math.floor(i * cw), y0 + Math.floor(j * cw), Math.ceil(cw), Math.ceil(cw)); ctx.strokeStyle = c.line; ctx.strokeRect(x0 + 0.5, y0 + 0.5, side - 1, side - 1); if (k < 3) { x = M.blockSpin(x, Lx, 3); Lx /= 3; } }
      const Ks = s.n ? s.acc.map((a) => kOfCorr(a.c / s.n)) : [], shown = Ks.map((k) => Math.min(k, 1.2));
      plot(cv2, { x: [-0.3, 3.3], y: [0, 1.2], xt: [0, 1, 2, 3], xf: (t) => ['81²', '27²', '9²', '3²'][t] || '', xl: L('看粗几次', 'coarsening steps'), yl: 'K_eff', hmarks: [{ y: M.ISING.betaC, color: c.gold }], texts: [{ x: -0.3, y: M.ISING.betaC, s: 'K_c = 0.4407', align: 'left', dx: 4, dy: 16, color: c.gold }],
        series: s.n ? [{ xs: [0, 1, 2, 3], ys: shown, color: c.accent, width: 2, dots: 4, line: true }] : [] });
      return [[L('温度 kT / J，K = J/kT', 'Temperature kT / J, K = J/kT'), `${fix(s.T, 2)} · K = ${fix(1 / s.T, 4)}`, 1], [L('样本', 'Samples'), String(s.n)], ...['81²', '27²', '9²', '3²'].map((lab, k) => [L(`${lab}：K_eff，⟨|m|⟩`, `${lab}: K_eff, ⟨|m|⟩`), s.n ? `${Ks[k] === Infinity ? '∞' : fix(Ks[k], 3)} · ${fix(s.acc[k].m / s.n, 2)}` : '—'])];
    },
  };

  // ── 一维抽取和 Migdal–Kadanoff 的重整化群流 ─────────────────────────
  const RG = { '1d': { b: 2, d: 1, Kc: null, nu: null }, mk2: { b: 2, d: 2, Kc: M.ISING.betaC, nu: 1 }, mk3: { b: 2, d: 3, Kc: 0.221654626, nu: 0.62997 } };
  DEMOS.rgflow = {
    title: L('重整化群流：一维精确，二维、三维近似', 'Renormalisation-group flow: exact in one dimension, approximate in two and three'), kind: 'approx',
    intro: L('一维 Ising 链每隔一个自旋求和掉，剩下的链还是 Ising 链，耦合变成 tanh K′ = tanh² K：这是一个精确的重整化变换。Migdal 和 Kadanoff 把它推广到 d 维：先把键挪到一起（K → 2^{d−1} K），再做一维的抽取。拖动起点 K₀，看迭代往哪里走；d ≥ 2 时中间有一个不稳定的不动点 K*，它就是近似的临界点。', 'Sum out every other spin of a 1D Ising chain and what remains is again an Ising chain with tanh K′ = tanh² K: an exact renormalisation transformation. Migdal and Kadanoff generalised it to d dimensions: first move bonds together (K → 2^{d−1} K), then decimate as in one dimension. Drag the starting point K₀ and watch where the iteration goes; for d ≥ 2 there is an unstable fixed point K* in between, the approximate critical point.'),
    sel: [['model', L('模型', 'Model'), [['1d', L('一维链（精确）', '1D chain (exact)')], ['mk2', L('二维 Migdal–Kadanoff', '2D Migdal–Kadanoff')], ['mk3', L('三维 Migdal–Kadanoff', '3D Migdal–Kadanoff')]], 'mk2']],
    ctl: [['K0', L('起点 K₀ = J/kT', 'Start K₀ = J/kT'), 0.02, 1.2, 0.005, 0.33, (v) => v.toFixed(3)]],
    btn: [[L('二维，K* 下方一点', '2D, just below K*'), { model: 'mk2', K0: 0.29 }], [L('二维，K* 上方一点', '2D, just above K*'), { model: 'mk2', K0: 0.32 }], [L('一维，强耦合也会流走', '1D: even strong coupling flows away'), { model: '1d', K0: 1.2 }]],
    figs: [[0.62, L('蛛网图：K′ = R(K)（蓝）和对角线 K′ = K（灰）的交点是不动点。折线是从 K₀ 出发的迭代。', 'Cobweb: fixed points are where K′ = R(K) (blue) meets the diagonal K′ = K (grey). The zigzag is the iteration from K₀.')], [0.3, L('同一串迭代画在 K 轴上。金线是精确的临界耦合（二维 0.4407，三维 0.2217），和近似的 K* 比一比。', 'The same iterates on the K axis. Gold: the exact critical coupling (0.4407 in 2D, 0.2217 in 3D), to compare with the approximate K*.')]],
    note: L('一维的抽取是精确的：关联长度 ξ = −1/ln tanh K 每抽取一次精确地减半（测试里核对过），任何有限温度下 K 都流向 0，所以一维 Ising 链没有相变，这是 Ising 1925 年博士论文的结论。Migdal–Kadanoff 是一个有名的近似：二维给出 K* ≈ 0.305、ν ≈ 1.34（精确是 0.4407 和 1），三维给出 K* ≈ 0.065、ν ≈ 1.06（Monte Carlo 和共形自举给出 0.2217 和 0.630）。它把相变“有没有”和流的形状讲对了，数字不准。ν 来自不动点处的斜率 λ = dK′/dK：ν = ln b / ln λ。', 'Decimation in one dimension is exact: the correlation length ξ = −1/ln tanh K halves exactly at each step (checked in the tests), K flows to 0 at any finite temperature, and so the 1D Ising chain has no phase transition: the conclusion of Ising’s 1925 thesis. Migdal–Kadanoff is a famous approximation: in 2D it gives K* ≈ 0.305 and ν ≈ 1.34 (exact: 0.4407 and 1); in 3D K* ≈ 0.065 and ν ≈ 1.06 (Monte Carlo and the conformal bootstrap give 0.2217 and 0.630). It gets right whether there is a transition and the shape of the flow, not the numbers. ν comes from the slope λ = dK′/dK at the fixed point: ν = ln b / ln λ.'),
    draw(s, [cv, cv2], c) {
      const R = RG[s.model], Ks = lin(0, 1.2, 241), map = Ks.map((K) => Math.min(2, M.mkMap(K, R.b, R.d))), orb = M.mkOrbit(s.K0, R.b, R.d, 14), fx = M.mkFixed(R.b, R.d);
      const web = [[orb[0], 0]]; for (let i = 0; i + 1 < orb.length && Number.isFinite(orb[i + 1]); i++) { web.push([orb[i], orb[i + 1]], [orb[i + 1], orb[i + 1]]); }
      plot(cv, { x: [0, 1.2], y: [0, 1.2], eq: true, xl: 'K', yl: "K′ = R(K)", series: [{ xs: [0, 1.2], ys: [0, 1.2], color: c.muted, dash: [3, 4] }, { xs: Ks, ys: map, color: c.info, width: 2.2, label: R.d === 1 ? 'tanh K′ = tanh² K' : `tanh K′ = tanh²(${2 ** (R.d - 1)}K)` }, { pts: web, color: c.accent, width: 1.4 }], marks: fx ? [{ x: fx.K, y: fx.K, color: c.gold }] : [] });
      const fin = orb.filter(Number.isFinite);
      plot(cv2, { x: [0, 1.2], y: [-1, 1], yt: [], xl: 'K', series: [{ pts: fin.map((k) => [Math.min(k, 1.2), 0]), color: c.accent, dots: 4 }], hmarks: [{ y: 0, color: c.line, dash: [] }],
        marks: [...(R.Kc ? [{ x: R.Kc, color: c.gold }] : []), ...(fx ? [{ x: fx.K, color: c.info }] : [])], arrows: fin.slice(0, 8).map((k, i) => (i + 1 < fin.length ? { from: [Math.min(k, 1.2), 0.45], to: [Math.min(fin[i + 1], 1.2), 0.45], color: c.accent, width: 1.4 } : null)).filter(Boolean) });
      const end = orb[orb.length - 1], where = !Number.isFinite(end) || end > 2 ? L('K → ∞（有序）', 'K → ∞ (ordered)') : end < 1e-3 ? L('K → 0（无序）', 'K → 0 (disordered)') : L('还在不动点附近', 'near the fixed point');
      const rows = [[L('流向', 'Flows to'), where, 1], [L('迭代', 'Iterates'), orb.slice(0, 5).map((k) => (Number.isFinite(k) ? fix(k, 2) : '∞')).join(' → ')]];
      if (fx) rows.push([L('不动点 K*', 'Fixed point K*'), fix(fx.K, 4)], [L('精确的 K_c', 'Exact K_c'), fix(R.Kc, 4)], [L('斜率 λ', 'Slope λ'), fix(fx.lam, 4)], [L('ν = ln 2 / ln λ', 'ν = ln 2 / ln λ'), `${fix(fx.nu, 3)}（${L('精确', 'exact')} ${fix(R.nu, 3)}）`]);
      else rows.push([L('关联长度 ξ → ξ′', 'Correlation length ξ → ξ′'), `${fmt(M.chainXi(s.K0))} → ${fmt(M.chainXi(M.mkMap(s.K0, 2, 1)))}${L('（正好一半）', ' (exactly half)')}`], [L('非平凡不动点', 'Nontrivial fixed point'), L('没有', 'none')]);
      return rows;
    },
  };

  // ── 临界指数和标度关系 ─────────────────────────────────────────────
  const BOOT = { ds: 0.5181489, de: 1.412625 };
  const EXP = {
    mf: { d: 3, e: { alpha: 0, beta: 0.5, gamma: 1, delta: 3, nu: 0.5, eta: 0 }, name: L('平均场（Landau）', 'Mean field (Landau)'), src: L('解析；d ≥ 4 时正确', 'analytic; correct for d ≥ 4') },
    i2: { d: 2, e: M.fromNuEta(1, 0.25, 2), name: L('二维 Ising', '2D Ising'), src: L('精确（Onsager、Yang；共形场论）', 'exact (Onsager, Yang; conformal field theory)') },
    i3: { d: 3, e: M.fromNuEta(1 / (3 - BOOT.de), 2 * BOOT.ds - 1, 3), name: L('三维 Ising', '3D Ising'), src: L('共形自举 Δσ = 0.5181489、Δε = 1.412625（Kos 等 2016）', 'conformal bootstrap Δσ = 0.5181489, Δε = 1.412625 (Kos et al. 2016)') },
    xy: { d: 3, e: M.fromNuEta(0.67175, 0.038176, 3), name: L('三维 XY（超流氦）', '3D XY (superfluid helium)'), src: L('共形自举 ν = 0.67175、η = 0.038176（Chester 等 2020）', 'conformal bootstrap ν = 0.67175, η = 0.038176 (Chester et al. 2020)') },
    he: { d: 3, e: M.fromNuEta(0.7112, 0.0375, 3), name: L('三维 Heisenberg', '3D Heisenberg'), src: L('Monte Carlo 加高温展开 ν = 0.7112、η = 0.0375（Campostrini 等 2002）', 'Monte Carlo plus high-temperature series ν = 0.7112, η = 0.0375 (Campostrini et al. 2002)') },
    eps: { d: 3, e: (() => { const q = M.epsExp(1, 1); return { ...q, alpha: 2 - 3 * q.nu, delta: 1 + q.gamma / q.beta }; })(), name: L('ε 展开第一阶（Ising，ε = 1）', 'ε expansion, first order (Ising, ε = 1)'), src: L('Wilson & Fisher 1972 的一阶公式；α、δ 由标度关系补上', 'first-order formulas of Wilson & Fisher 1972; α and δ filled in by scaling relations') },
  };
  DEMOS.exponents = {
    title: L('临界指数：六个数，两个就够', 'Critical exponents: six numbers, two are enough'), kind: 'lit',
    intro: L('α（比热）、β（序参量）、γ（磁化率）、δ（临界等温线）、ν（关联长度）、η（临界点上的关联函数）。标度关系把它们连起来：知道 ν 和 η，加上维数 d，其余四个都算得出来。选一个普适类，看四条标度关系是否成立。', 'α (specific heat), β (order parameter), γ (susceptibility), δ (critical isotherm), ν (correlation length), η (correlations at the critical point). Scaling relations tie them together: given ν, η and the dimension d, the other four follow. Choose a universality class and check whether the four relations hold.'),
    sel: [['cls', L('普适类', 'Universality class'), Object.entries(EXP).map(([k, v]) => [k, v.name]), 'i3']],
    figs: [['html', ''], [0.5, L('序参量 m ∝ |t|^β 在各普适类里的样子（只画幂律，前面的系数都取 1）。β 越小，m 在 T_c 下方升得越陡。', 'What the order parameter m ∝ |t|^β looks like in each class (pure power laws, prefactors set to 1). The smaller β, the more steeply m rises below T_c.')]],
    note: L('普适性的意思是：只要维数、序参量的分量数（Ising 是 1，XY 是 2，Heisenberg 是 3）和相互作用的力程相同，临界指数就相同，与格子、材料、甚至是不是磁体都无关。二氧化碳和氙的气液临界点属于三维 Ising 类（密度差就是序参量），单轴磁体也是。平均场的四条标度关系里，Josephson 关系 dν = 2 − α 只在 d = 4 成立，这就是“平均场在四维以下失效”的一个直接的标志。超流氦是三维 XY 类：Lipa 等人 1992 年在绕地球飞行的航天飞机上把比热量到离 T_λ 2 纳开以内，2003 年的修订分析给出 α = −0.0127 ± 0.0003；共形自举由 ν 算出 α = 2 − 3ν = −0.0153 ± 0.0003，两者差了约 8 个标准差，至今没有公认的解释。', 'Universality means that the critical exponents depend only on the dimension, the number of components of the order parameter (1 for Ising, 2 for XY, 3 for Heisenberg) and the range of the interaction, not on the lattice, the material, or even whether it is a magnet. The liquid–gas critical points of carbon dioxide and xenon belong to the 3D Ising class (the density difference is the order parameter), as do uniaxial magnets. Of the four scaling relations, mean field satisfies Josephson’s dν = 2 − α only at d = 4: a direct sign that mean field fails below four dimensions. Superfluid helium is in the 3D XY class: Lipa and co-workers measured its specific heat in Earth orbit on the Space Shuttle in 1992, to within 2 nK of T_λ, and their revised analysis of 2003 gives α = −0.0127 ± 0.0003; the conformal bootstrap gives α = 2 − 3ν = −0.0153 ± 0.0003 from ν, a difference of about 8 standard deviations that still has no accepted explanation.'),
    draw(s, [box, cv], c) {
      const keys = Object.keys(EXP), on = keys.indexOf(s.cls), X = EXP[s.cls], d = X.d, f4 = (v) => (Math.abs(v) < 5e-5 ? '0' : fix(v, 4));
      box.innerHTML = K.table([L('普适类', 'Class'), 'd', 'α', 'β', 'γ', 'δ', 'ν', 'η'], keys.map((k) => { const e = EXP[k].e; return [tx(EXP[k].name), String(EXP[k].d), f4(e.alpha), f4(e.beta), f4(e.gamma), f4(e.delta), f4(e.nu), f4(e.eta)]; }), on) + `<p class="muted">${esc(tx(X.src))}</p>`;
      const ts = lin(0, 1, 201);
      plot(cv, { x: [0, 1], y: [0, 1.05], xl: '|t| = 1 − T/T_c', yl: 'm ∝ |t|^β', series: keys.map((k) => ({ xs: ts, ys: ts.map((t) => t ** EXP[k].e.beta), color: k === s.cls ? c.accent : c.muted, width: k === s.cls ? 2.6 : 1, alpha: k === s.cls ? 1 : 0.6, label: k === s.cls ? `β = ${fix(EXP[k].e.beta, 3)}` : '' })) });
      const ch = M.scalingChecks(X.e, d), ok = (v) => `${f4(v)}${Math.abs(v) < 5e-4 ? ' ✓' : ''}`;
      const rows = [[X.name, L(`d = ${d}`, `d = ${d}`), 1], [L('Rushbrooke：α + 2β + γ − 2', 'Rushbrooke: α + 2β + γ − 2'), ok(ch.rushbrooke)], [L('Widom：γ − β(δ − 1)', 'Widom: γ − β(δ − 1)'), ok(ch.widom)], [L('Fisher：γ − ν(2 − η)', 'Fisher: γ − ν(2 − η)'), ok(ch.fisher)], [L('Josephson：dν − (2 − α)', 'Josephson: dν − (2 − α)'), ok(ch.josephson)]];
      if (s.cls === 'mf') rows.push([L('换成 d = 4', 'With d = 4 instead'), `${f4(M.scalingChecks(X.e, 4).josephson)} ✓`]);
      if (s.cls === 'xy') rows.push([L('超流氦的实测 α（Lipa 等 2003）', 'Measured α in helium (Lipa et al. 2003)'), '−0.0127 ± 0.0003']);
      return rows;
    },
  };
};
