'use strict';
// 化学学科馆 13 · 核化学的三个演示：半经验质量公式、母体–子体衰变（发生器）、放射性碳测年和污染。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, plot } = K;
  const SYM = 'H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn Fr Ra Ac Th Pa U Np Pu Am Cm Bk Cf Es Fm Md No Lr Rf Db Sg Bh Hs Mt Ds Rg Cn Nh Fl Mc Lv Ts Og'.split(' ');
  const sym = (Z) => SYM[Z - 1] || `Z${Z}`;
  // 给定 A，在连续解附近找结合能最大的整数 Z（这样配对项也算进去：A = 56 时是 Fe 而不是 Mn）
  const bestZ = (A) => { const z = Math.round(M.zStable(A)); let best = z, bb = -Infinity; for (let k = Math.max(1, z - 3); k <= Math.min(A - 1, z + 3); k++) { const v = M.semf(k, A).B; if (v > bb) { bb = v; best = k; } } return best; };

  // ── 半经验质量公式 ──────────────────────────────────────────────────────
  // 实测比结合能（MeV/核子，按 AME2020 常引值，编者录入）：[Z, A, B/A]
  const EXP = [[2, 4, 7.074], [6, 12, 7.680], [8, 16, 7.976], [20, 40, 8.551], [26, 56, 8.790], [28, 62, 8.795], [50, 120, 8.505], [82, 208, 7.868], [92, 238, 7.570]];
  D.semf = {
    kind: 'model',
    title: ['液滴模型：半经验质量公式', 'The liquid-drop model: the semi-empirical mass formula'],
    intro: ['选质量数 A，再把质子数从最稳定的值往两边挪，看结合能的五项各贡献多少。左图是沿 β 稳定线的比结合能，点是实测值。', 'Choose a mass number A, then move the proton number away from its most stable value to see what each of the five terms contributes. The left plot is binding energy per nucleon along the line of beta stability, with measured values as dots.'],
    ctl: [['A', ['质量数 A', 'Mass number A'], 4, 260, 1, 56, (v) => String(v)], ['dZ', ['质子数偏离最稳定值', 'Proton number off the most stable value'], -10, 10, 1, 0, (v) => (v > 0 ? `+${v}` : String(v))]],
    btn: [[['⁴He', '⁴He'], { A: 4, dZ: 0 }], [['⁵⁶Fe', '⁵⁶Fe'], { A: 56, dZ: 0 }], [['²⁰⁸Pb', '²⁰⁸Pb'], { A: 208, dZ: 0 }], [['²³⁸U', '²³⁸U'], { A: 238, dZ: 0 }], [['A = 238，多 4 个质子', 'A = 238 with 4 extra protons'], { A: 238, dZ: 4 }]],
    figs: [[0.6, ['比结合能对质量数：彩色线是液滴模型沿最稳定的 Z，点是实测值，金点是当前的核。', 'Binding energy per nucleon against mass number: the coloured line is the liquid-drop model along the most stable Z, dots are measured values, and the gold dot is the current nucleus.']], [0.6, ['当前核的五项（每个核子，MeV）：体积项为正，其余是扣减。', 'The five terms for the current nucleus (per nucleon, MeV): the volume term is positive, the rest are deductions.']]],
    note: ['系数用常引的一组（a_V 15.75、a_S 17.8、a_C 0.711、a_A 23.7、a_P 11.18 MeV），由编者录入；不同教科书的拟合值略有差别。实测比结合能按 AME2020 原子质量评估的常引值录入，未逐条复核。液滴模型对 A ≳ 30 的核误差约百分之一，对很轻的核（尤其 ⁴He）和幻数附近偏差较大，因为它没有壳层效应。最稳定的 Z 是在 ∂B/∂Z = 0 的解附近、连配对项一起比较后结合能最大的整数，它只是 β 稳定线的近似；曲线在小 A 处的锯齿来自配对项（偶偶核多、奇奇核少）。', 'The coefficients are one commonly quoted set (a_V 15.75, a_S 17.8, a_C 0.711, a_A 23.7, a_P 11.18 MeV), typed by the editor; textbook fits differ slightly. Measured values are commonly quoted AME2020 atomic-mass-evaluation numbers, not rechecked. The liquid-drop model is good to about one per cent for A ≳ 30 but poorer for very light nuclei (especially ⁴He) and near magic numbers, because it has no shell effects. The most stable Z is the integer near the solution of ∂B/∂Z = 0 with the largest binding energy once the pairing term is included; it only approximates the line of beta stability, and the zigzag of the curve at small A comes from pairing (even–even nuclei gain, odd–odd lose).'],
    draw(s, f, c) {
      const z0 = bestZ(s.A), Z = Math.max(1, Math.min(s.A - 1, z0 + s.dZ)), r = M.semf(Z, s.A);
      const As = []; for (let a = 4; a <= 260; a++) As.push(a);
      const ba = As.map((a) => M.semf(bestZ(a), a).BA);
      plot(f[0], { x: [0, 262], y: [5, 9.2], xl: 'A', yl: 'B/A / MeV', series: [{ xs: As, ys: ba, color: c.accent, width: 2.2, label: L('液滴模型', 'liquid drop') }, { pts: EXP.map(([, a, v]) => [a, v]), color: c.ink2, dots: 4, line: false, label: L('实测', 'measured') }], marks: [{ x: s.A, y: r.BA, color: c.gold }] });
      const names = [L('体积', 'volume'), L('表面', 'surface'), L('库仑', 'Coulomb'), L('不对称', 'asymmetry'), L('配对', 'pairing')], v = r.terms.map((t) => t / s.A);
      plot(f[1], { x: [0.4, 5.6], y: [Math.min(-8, ...v) - 0.5, 17], xt: [1, 2, 3, 4, 5], xf: (t) => names[t - 1] || '', yl: 'MeV', hmarks: [{ y: 0, color: c.faint, dash: [] }], series: v.map((t, i) => ({ xs: [i + 1], ys: [t], color: i ? c.danger : c.accent, bars: 0.55, base: 0 })) });
      const ex = EXP.find(([z, a]) => z === Z && a === s.A);
      return [[['原子核', 'Nucleus'], `${s.A}${sym(Z)}（Z = ${Z}，N = ${s.A - Z}）`, 1], [['结合能 B', 'Binding B'], `${fix(r.B, 1)} MeV`], [['比结合能', 'B per nucleon'], `${fix(r.BA, 3)} MeV`, 1], [['实测', 'Measured'], ex ? `${fix(ex[2], 3)} MeV` : '—'], [['最稳定的 Z', 'Most stable Z'], `${z0}（${sym(z0)}）`]];
    },
  };

  // ── 母体 → 子体：发生器和平衡 ───────────────────────────────────────────
  // [名字, 母体半衰期, 子体半衰期, 分支比, 时间单位, 窗口长度]，半衰期按常引值录入（单位同时间单位）
  const PAIRS = {
    motc: [['⁹⁹Mo → ⁹⁹ᵐTc（暂时平衡）', '⁹⁹Mo → ⁹⁹ᵐTc (transient equilibrium)'], 65.94, 6.0067, 0.876, ['小时', 'h'], 120],
    gega: [['⁶⁸Ge → ⁶⁸Ga（长期平衡）', '⁶⁸Ge → ⁶⁸Ga (secular equilibrium)'], 270.9 * 24, 67.71 / 60, 1, ['小时', 'h'], 10],
    sry: [['⁹⁰Sr → ⁹⁰Y（长期平衡）', '⁹⁰Sr → ⁹⁰Y (secular equilibrium)'], 28.8 * 365.25 * 24, 64.0, 1, ['小时', 'h'], 500],
    rarn: [['²²⁶Ra → ²²²Rn（长期平衡）', '²²⁶Ra → ²²²Rn (secular equilibrium)'], 1600 * 365.25, 3.82, 1, ['天', 'd'], 30],
    none: [['子体更长寿（示意：1 → 5）', 'Longer-lived daughter (illustrative: 1 → 5)'], 1, 5, 1, ['单位', 'units'], 20],
  };
  D.bateman = {
    kind: 'exact',
    title: ['母体和子体：发生器和放射性平衡', 'Parent and daughter: generators and radioactive equilibrium'],
    intro: ['开始时只有母体。选一对核素，看子体的活度怎样长起来、追上母体并跟着它衰减；拖动时间看任一时刻两者的比值。子体比母体长寿时就没有平衡。', 'Start with parent only. Pick a pair to watch the daughter’s activity grow, catch up with the parent and then decay alongside it; drag the time to read their ratio at any moment. If the daughter outlives the parent there is no equilibrium.'],
    sel: [['p', ['母体 → 子体', 'Parent → daughter'], Object.entries(PAIRS).map(([k, v]) => [k, v[0]]), 'motc']],
    ctl: [['t', ['经过的时间（占窗口的比例）', 'Elapsed time (fraction of the window)'], 0, 1, 0.005, 0.19, (v) => `${fix(v * 100, 1)} %`]],
    chk: [['lg', ['对数纵轴', 'Log vertical axis'], false]],
    figs: [[0.6, ['活度（以母体初始活度为 1）对时间。蓝线母体，红线子体，金线是当前时刻。', 'Activity (parent initial activity = 1) against time. Blue: parent; red: daughter; gold: the current time.']]],
    note: ['按 Bateman 方程的两核素解析解计算，子体开始时为零（刚洗脱完的发生器）。⁹⁹Mo 只有约 88 % 衰变到 ⁹⁹ᵐTc，其余直接到 ⁹⁹Tc 基态，所以平衡时 ⁹⁹ᵐTc 的活度略低于母体（比值 b·λ₂/(λ₂ − λ₁) ≈ 0.96）。长期平衡时子体活度等于母体活度；“子体更长寿”的例子里母体先衰变完，子体再按自己的半衰期衰减，不会出现平衡。半衰期和分支比是常引值，由编者录入，未逐条复核。', 'Computed from the two-nuclide analytical solution of the Bateman equations, with no daughter at the start (a freshly eluted generator). Only about 88 % of ⁹⁹Mo decays to ⁹⁹ᵐTc, the rest going straight to the ⁹⁹Tc ground state, so at equilibrium ⁹⁹ᵐTc activity is slightly below the parent’s (ratio b·λ₂/(λ₂ − λ₁) ≈ 0.96). In secular equilibrium the daughter’s activity equals the parent’s; in the “longer-lived daughter” example the parent decays away first and the daughter then decays with its own half-life, with no equilibrium. Half-lives and the branching ratio are commonly quoted values typed by the editor and not rechecked.'],
    draw(s, f, c) {
      const [, h1, h2, b, un, W] = PAIRS[s.p], l1 = Math.LN2 / h1, l2 = Math.LN2 / h2, ts = K.lin(0, W, 401), t = s.t * W;
      const A = ts.map((x) => M.bateman2(x, l1, l2, b)), [a1, a2] = M.bateman2(t, l1, l2, b);
      const tmax = Math.log(l2 / l1) / (l2 - l1);
      const yl = L('相对活度', 'relative activity');
      if (s.lg) plot(f[0], { x: [0, W], y: [-3, 0.3], logy: true, xl: `t / ${L(un[0], un[1])}`, yl, series: [{ xs: ts, ys: A.map((q) => q[0]), color: c.info, width: 2.4, label: L('母体', 'parent') }, { xs: ts, ys: A.map((q) => q[1]), color: c.danger, width: 2.4, label: L('子体', 'daughter') }], marks: [{ x: t, color: c.gold }] });
      else plot(f[0], { x: [0, W], y: [0, 1.08], xl: `t / ${L(un[0], un[1])}`, yl, series: [{ xs: ts, ys: A.map((q) => q[0]), color: c.info, width: 2.4, label: L('母体', 'parent') }, { xs: ts, ys: A.map((q) => q[1]), color: c.danger, width: 2.4, label: L('子体', 'daughter') }], marks: [{ x: t, color: c.gold }] });
      const eq = l2 > l1 ? (b * l2) / (l2 - l1) : null;
      const kind = !eq ? L('没有平衡', 'no equilibrium') : h1 / h2 > 100 ? L('长期平衡', 'secular') : L('暂时平衡', 'transient');
      const tf = (x) => `${fmt(x, 3)} ${L(un[0], un[1])}`;
      return [[['时间', 'Time'], tf(t)], [['母体活度', 'Parent'], fix(a1, 4)], [['子体活度', 'Daughter'], fix(a2, 4), 1], [['子体 / 母体', 'Ratio'], a1 > 1e-12 ? fix(a2 / a1, 3) : '—', 1], [['子体峰值时刻', 'Daughter peak'], tf(tmax)], [['平衡比值', 'Equilibrium ratio'], eq ? fix(eq, 3) : '—'], [['类型', 'Type'], kind]];
    },
  };

  // ── 放射性碳测年 ────────────────────────────────────────────────────────
  D.c14 = {
    kind: 'exact',
    title: ['碳-14 测年：年龄和污染', 'Radiocarbon dating: ages and contamination'],
    intro: ['输入样品的碳-14 比例（相对现代标准），得到常规年龄；再加一点现代碳的污染，看越老的样品被“拉年轻”得越厉害。', 'Enter the sample’s carbon-14 level (relative to the modern standard) to get its conventional age, then add a little modern-carbon contamination and see how much older samples are pulled younger.'],
    ctl: [['pm', ['碳-14 比例（现代碳的百分数）', 'Carbon-14 level (per cent modern carbon)'], 0.2, 100, 0.1, 25, (v) => `${fix(v, 1)} pMC`], ['cn', ['现代碳污染', 'Modern-carbon contamination'], 0, 5, 0.1, 0, (v) => `${fix(v, 1)} %`]],
    btn: [[['两个半衰期左右', 'About two half-lives'], { pm: 25, cn: 0 }], [['约 3 万年', 'About 30 000 years'], { pm: 2.4, cn: 0 }], [['同上，1 % 污染', 'Same, 1 % contamination'], { pm: 2.4, cn: 1 }], [['接近测年极限', 'Near the limit'], { pm: 0.3, cn: 0 }]],
    figs: [[0.55, ['碳-14 比例对年龄：彩色线用 Libby 半衰期 5568 年（常规年龄），灰色虚线用 5730 年。', 'Carbon-14 level against age: the coloured line uses Libby’s 5568-year half-life (conventional ages), the grey dashed line 5730 years.']], [0.55, ['表观年龄对真实的常规年龄（当前污染比例）。灰色对角线是没有污染。', 'Apparent age against true conventional age (at the current contamination). The grey diagonal is no contamination.']]],
    note: ['常规年龄 t = −8033 ln F（F 是相对现代标准的比例，8033 = 5568/ln 2），这是放射性碳界的约定；用 5730 年的半衰期会长约 3 %。两者都还要用 IntCal20 等校正曲线换成日历年龄，这里没有做校正 [@reimer2020]。污染模型：测得的比例 = (1 − c)·F + c·1，即混进比例为 c 的现代碳；没有考虑同位素分馏校正（δ¹³C）和样品前处理。', 'The conventional age t = −8033 ln F (F relative to the modern standard; 8033 = 5568/ln 2) is the radiocarbon community’s convention; the 5730-year half-life gives ages about 3 % longer. Both still need a calibration curve such as IntCal20 to become calendar ages, which is not done here [@reimer2020]. Contamination model: measured fraction = (1 − c)·F + c·1, i.e. a fraction c of modern carbon mixed in; isotopic-fractionation correction (δ¹³C) and sample pretreatment are not modelled.'],
    draw(s, f, c) {
      const F = s.pm / 100, cc = s.cn / 100, ages = K.lin(0, 60000, 241);
      plot(f[0], { x: [0, 60000], y: [0, 105], xl: L('年龄 / 年', 'age / years'), yl: 'pMC', xf: (t) => (t ? `${t / 1000}k` : '0'), series: [{ xs: ages, ys: ages.map((a) => 100 * Math.exp(-a / 8033)), color: c.accent, width: 2.4, label: '5568' }, { xs: ages, ys: ages.map((a) => 100 * 2 ** (-a / 5730)), color: c.faint, width: 1.4, dash: [5, 4], label: '5730' }], marks: [{ x: M.c14Age(F), y: s.pm, color: c.gold }] });
      const app = (a) => M.c14Age((1 - cc) * Math.exp(-a / 8033) + cc);
      plot(f[1], { x: [0, 60000], y: [0, 60000], xl: L('真实年龄 / 年', 'true age / years'), yl: L('表观年龄 / 年', 'apparent age / years'), xf: (t) => (t ? `${t / 1000}k` : '0'), yf: (t) => (t ? `${t / 1000}k` : '0'), series: [{ xs: [0, 60000], ys: [0, 60000], color: c.faint, width: 1.2, dash: [4, 4] }, { xs: ages, ys: ages.map(app), color: c.danger, width: 2.4 }], marks: [{ x: M.c14Age(F), y: app(M.c14Age(F)), color: c.gold }] });
      const t = M.c14Age(F), tm = (1 - cc) * F + cc, ta = M.c14Age(tm);
      const yr = (v) => `${fmt(Math.round(v), 5)} ${L('年', 'yr')}`;
      return [[['常规年龄', 'Conventional age'], yr(t), 1], [['按 5730 年', 'With 5730 yr'], yr(M.c14Age(F, 5730))], [['半衰期数', 'Half-lives'], fix(Math.log2(1 / F), 2)], [['测得的比例', 'Measured level'], `${fix(tm * 100, 2)} pMC`], [['表观年龄', 'Apparent age'], yr(ta), 1], [['偏年轻', 'Too young by'], yr(t - ta)]];
    },
  };
});
