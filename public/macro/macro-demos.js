'use strict';
// 热、统计与流体（/macro/）的五个演示：Kac 环、Q2R、有限能级的热容、HPP 格子气、格子 Boltzmann 的涡街。
// 数学都在 macro-models.js（纯函数，tools/macro-test.mjs 测）。macro.js 用 window.MOLASTRIA_MACRO_DEMOS(K, DEMOS) 把它们登记进去。
// 每个演示：title，kind，intro，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，btn 预设，act 动作，state，fps + tick(s)（返回 false 就停），
// changed(s, 键)，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 画图并返回读数 [[名字, 值, 是否加粗]]。K 是 macro.js 给的画图工具。
window.MOLASTRIA_MACRO_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_MACRO_MODELS;
  const { L, fix, plot, cells, fit, lin } = K;
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
};
