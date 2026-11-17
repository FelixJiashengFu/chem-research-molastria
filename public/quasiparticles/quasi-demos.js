'use strict';
// 准粒子（/quasiparticles/）的十三个演示。数学都在 quasi-models.js（纯函数，tools/quasi-test.mjs 测）。quasi.js 用 window.MOLASTRIA_QUASI_DEMOS(K, DEMOS) 把它们登记进去。
// 写法同声子馆的 phonons/phonon-demos.js：title，kind，intro，sel，ctl，chk，btn，state，autoplay，fps + tick(s)，changed，figs，note，draw(s, 图, 颜色) 返回读数。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。
window.MOLASTRIA_QUASI_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_QUASI_MODELS;
  const { L, fix, fmt, plot, fit, lin, font, pct } = K;
  const PI = Math.PI;

  // ── 1a. 谱函数 ────────────────────────────────────────────────
  DEMOS.spectral = {
    title: L('谱函数：一个尖峰就是一个准粒子', 'The spectral function: a sharp peak is a quasiparticle'), kind: 'toy',
    intro: L('往一个多体系统里加进一个电子（或打进一个激发），问它的能量是多少，得到的不是一个数，而是一条分布：谱函数 A(ω)。如果分布里有一个又高又窄的峰，这个激发就像一个有确定能量的粒子，只是“穿了衣服”：峰下的面积 Z 是它还像原来那个裸粒子的程度，峰宽 Γ 是它的衰减率，寿命 ħ/Γ。剩下的 1 − Z 散在宽宽的“非相干”背景里。峰宽比峰的能量小得多（Γ ≪ E），说准粒子才有意义。', 'Add an electron (or kick in an excitation) to a many-body system and ask its energy: the answer is not a number but a distribution, the spectral function A(ω). If the distribution has a tall, narrow peak, the excitation behaves like a particle of definite energy, only “dressed”: the area Z under the peak measures how much it still resembles the bare particle, and the width Γ is its decay rate, with lifetime ħ/Γ. The remaining 1 − Z is spread over a broad “incoherent” background. Quasiparticles only make sense when the peak is much narrower than its energy (Γ ≪ E).'),
    ctl: [['Z', L('准粒子权重 Z', 'Quasiparticle weight Z'), 0.05, 1, 0.01, 0.7, (v) => v.toFixed(2)], ['G', L('峰宽 Γ（单位：峰的能量 E）', 'Width Γ (in units of the peak energy E)'), 0.005, 1.2, 0.005, 0.05, (v) => v.toFixed(3)]],
    btn: [[L('好的准粒子', 'A good quasiparticle'), { Z: 0.8, G: 0.03 }], [L('衣服很重', 'Heavily dressed'), { Z: 0.25, G: 0.05 }], [L('寿命太短：不再是准粒子', 'Too short-lived: no longer a quasiparticle'), { Z: 0.7, G: 0.9 }]],
    figs: [[0.5, L('谱函数 A(ω)。金色是准粒子峰，灰色是非相干背景；两者面积之和是 1。', 'Spectral function A(ω). Gold is the quasiparticle peak, grey the incoherent background; their areas add up to 1.')], [0.4, L('加进去以后“还在原来那个态里”的振幅 |G(t)|：准粒子部分按 e^{−Γt} 慢慢衰减，背景很快散掉。', 'The amplitude |G(t)| of “still being in the state we created”: the quasiparticle part decays slowly as e^{−Γt}, the background disperses quickly.')]],
    note: L('A(ω) = Z·Γ/π/[(ω − E)² + Γ²] + (1 − Z)·高斯（中心 3E、宽 1.5E），E = 1。真实的谱函数由 ARPES、隧道谱等测出（第十二章），非相干部分的形状因材料而异，这里只是示意；准粒子峰的洛伦兹形状和 Z、Γ 的意义是一般的。', 'A(ω) = Z·Γ/π/[(ω − E)² + Γ²] + (1 − Z)·Gaussian (centre 3E, width 1.5E), with E = 1. Real spectral functions are measured by ARPES, tunnelling and so on (chapter 12), and the shape of the incoherent part varies from material to material; it is only schematic here. The Lorentzian quasiparticle peak and the meaning of Z and Γ are general.'),
    draw(s, [a, b], c) {
      const p = { E: 1, G: s.G, Z: s.Z, Ei: 3, W: 1.5 }, xs = lin(-2, 7, 700);
      const qp = xs.map((w) => s.Z * M.lorentz(w, 1, s.G)), inc = xs.map((w) => M.spectral(w, p) - s.Z * M.lorentz(w, 1, s.G));
      plot(a, { x: [-2, 7], y: [0, Math.min(Math.max(...qp, ...inc) * 1.1, 12)], xl: L('ω（单位 E）', 'ω (units of E)'), yl: 'A(ω)', series: [{ xs, ys: inc, color: c.muted, fill: true, alpha: 0.35, label: L('非相干', 'incoherent') }, { xs, ys: qp, color: c.gold, width: 2.2, label: L('准粒子', 'quasiparticle') }], marks: [{ x: 1, color: c.line }] });
      const ts = lin(0, 40, 400);
      plot(b, { x: [0, 40], y: [0, 1.05], xl: L('时间 t（单位 ħ/E）', 'time t (units of ħ/E)'), yl: '|G(t)|', series: [{ xs: ts, ys: ts.map((t) => M.survival(t, p)), color: c.accent, width: 2 }, { xs: ts, ys: ts.map((t) => s.Z * Math.exp(-s.G * t)), color: c.gold, dash: [5, 4], label: 'Z e^{−Γt}' }] });
      const q = s.G / 1;
      return [[L('寿命 ħ/Γ', 'Lifetime ħ/Γ'), `${fix(1 / s.G, 1)} ħ/E`], [L('振荡周期内衰减多少', 'Decay per oscillation period'), pct(1 - Math.exp(-2 * PI * q), 1)], [L('Γ / E', 'Γ / E'), fix(q, 3), true], [L('判断', 'Verdict'), q < 0.1 ? L('好的准粒子', 'a good quasiparticle') : q < 0.5 ? L('勉强算', 'marginal') : L('不是准粒子', 'not a quasiparticle')]];
    },
  };

  // ── 1b. 准粒子的能量尺度 ───────────────────────────────────────
  const ZOO = [
    ['phonon', L('声子', 'Phonons'), 1e-3, 0.2, L('晶格振动；最高约 0.2 eV（金刚石、含氢化合物）', 'lattice vibrations; up to about 0.2 eV (diamond, hydrides)'), 'phonons'],
    ['magnon', L('磁振子', 'Magnons'), 1e-4, 0.3, L('自旋波；最高可到几百 meV（铜氧化物的反铁磁体）', 'spin waves; up to a few hundred meV (cuprate antiferromagnets)'), 'magnons'],
    ['exciton', L('激子结合能', 'Exciton binding'), 1e-3, 1, L('GaAs 约 4 meV，Cu₂O 约 0.1 eV，单层 WS₂ 约 0.3 eV，分子晶体可到 1 eV', 'about 4 meV in GaAs, 0.1 eV in Cu₂O, 0.3 eV in monolayer WS₂, up to 1 eV in molecular crystals'), 'excitons'],
    ['polaron', L('极化子结合能', 'Polaron binding'), 3e-3, 1, L('弱耦合的 GaAs 只有约 2 meV，小极化子可到 1 eV 量级', 'only about 2 meV in weakly coupled GaAs; small polarons reach the order of 1 eV'), 'polarons'],
    ['plasmon', L('等离激元', 'Plasmons'), 1e-2, 20, L('掺杂半导体在红外，金属的体等离激元 5–20 eV', 'infrared in doped semiconductors; 5–20 eV for bulk plasmons in metals'), 'plasmons'],
    ['polariton', L('极化激元的 Rabi 劈裂', 'Polariton Rabi splitting'), 1e-3, 1, L('无机半导体微腔几到几十 meV，有机材料可到 1 eV', 'a few to tens of meV in inorganic microcavities, up to 1 eV in organics'), 'polaritons'],
    ['gap', L('超导能隙 2Δ', 'Superconducting gap 2Δ'), 1e-4, 0.1, L('铝约 0.34 meV，铅约 2.7 meV，铜氧化物几十 meV', 'about 0.34 meV for aluminium, 2.7 meV for lead, tens of meV for cuprates'), 'cooper'],
  ];
  DEMOS.zoo = {
    title: L('准粒子的能量尺度', 'Energy scales of quasiparticles'), kind: 'data',
    intro: L('不同的准粒子活在不同的能量范围里，这决定了用什么去测它们，也决定了多高的温度会把它们“烧掉”。横轴是对数的能量，从 0.1 meV 到 20 eV；竖线是你选的温度对应的 k_BT。条的位置是常见材料的典型数量级（不是严格的边界）。', 'Different quasiparticles live in different energy ranges, which decides what can measure them and what temperature “burns them away”. The horizontal axis is energy on a log scale, from 0.1 meV to 20 eV; the vertical line is k_BT at the temperature you choose. The bars give typical orders of magnitude in common materials (not strict limits).'),
    ctl: [['lT', L('温度 log₁₀ T（K）', 'Temperature log₁₀ T (K)'), -1, 4, 0.05, Math.log10(300), (v) => `T = ${fmt(10 ** v, 3)} K`]],
    btn: [[L('液氦 4.2 K', 'Liquid helium, 4.2 K'), { lT: Math.log10(4.2) }], [L('室温', 'Room temperature'), { lT: Math.log10(300) }], [L('太阳表面 5800 K', 'Sun’s surface, 5800 K'), { lT: Math.log10(5800) }]],
    figs: [[0.62, L('每一条是一类准粒子的典型能量范围；竖线是 k_BT。绿：整段高于 k_BT，热激发很少；金：k_BT 落在范围里；红：整段低于 k_BT，热涨落盖过了它。', 'Each bar is the typical energy range of one kind of quasiparticle; the vertical line is k_BT. Green: the whole range above k_BT, little thermal excitation; gold: k_BT falls inside the range; red: the whole range below k_BT, swamped by thermal fluctuations.')]],
    note: L('范围取自各章引用的文献和常见教科书数值，只表示数量级：金属的体等离激元（铝约 15 eV）、单层 WS₂ 激子约 0.32 eV、GaAs 激子约 4 meV、铝的 2Δ 约 0.34 meV、铅约 2.7 meV。k_BT = 0.08617 meV/K × T。', 'Ranges come from the references of each chapter and common textbook values, and indicate orders of magnitude only: bulk plasmons in metals (about 15 eV in aluminium), the exciton in monolayer WS₂ about 0.32 eV, GaAs excitons about 4 meV, 2Δ about 0.34 meV for aluminium and 2.7 meV for lead. k_BT = 0.08617 meV/K × T.'),
    draw(s, [cv], c) {
      const kT = 8.617333e-5 * 10 ** s.lT, n = ZOO.length;
      plot(cv, { logx: true, x: [-4, Math.log10(20)], y: [0, n], xl: L('能量（eV）', 'energy (eV)'), yt: [], xt: [-4, -3, -2, -1, 0, 1], marks: [{ x: kT, color: c.danger }],
        after: ({ ctx, X, Y }) => {
          ZOO.forEach(([, name, lo, hi], i) => {
            const y = Y(n - i - 0.5), st = kT > hi ? 2 : kT >= lo ? 1 : 0;
            ctx.fillStyle = [c.accent, c.gold, c.danger][st]; ctx.globalAlpha = 0.85; ctx.fillRect(X(lo), y - 7, X(hi) - X(lo), 14); ctx.globalAlpha = 1;
            ctx.fillStyle = c.ink; ctx.font = font(12); ctx.textAlign = X(lo) > 160 ? 'right' : 'left'; ctx.textBaseline = 'middle';
            ctx.fillText(name, X(lo) > 160 ? X(lo) - 6 : X(hi) + 6, y);
          });
        } });
      const part = ZOO.filter(([, , lo, hi]) => kT >= lo && kT <= hi).length, all = ZOO.filter(([, , , hi]) => kT > hi).length;
      return [[L('k_BT', 'k_BT'), kT < 0.1 ? `${fix(kT * 1000, 3)} meV` : `${fix(kT, 3)} eV`, true], [L('整段都低于 k_BT（红）', 'Entire range below k_BT (red)'), `${all} / ${n}`], [L('k_BT 落在范围里（金）', 'k_BT inside the range (gold)'), `${part} / ${n}`]];
    },
  };

  // ── 2. 声子数不守恒 ─────────────────────────────────────────────
  DEMOS.count = {
    title: L('声子的个数随温度变：准粒子不守恒', 'The number of phonons changes with temperature: quasiparticles are not conserved'), kind: 'exact',
    intro: L('电子的个数是守恒的，声子不是：温度一升，晶体里就“凭空”多出声子，降温它们又消失。Debye 模型里每个原子平均的声子数在低温按 T³ 增长，高温按 T 增长，和光子气体一样。这就是声子的化学势为零的意思。', 'The number of electrons is conserved; the number of phonons is not. Raise the temperature and phonons appear “from nowhere”; cool down and they vanish. In the Debye model the mean number of phonons per atom grows as T³ at low temperature and as T at high temperature, just like a photon gas. That is what it means for phonons to have zero chemical potential.'),
    sel: [['mat', L('元素（Debye 温度）', 'Element (Debye temperature)'), [['105', L('铅 Θ_D = 105 K', 'Lead Θ_D = 105 K')], ['343', L('铜 Θ_D = 343 K', 'Copper Θ_D = 343 K')], ['2230', L('金刚石 Θ_D = 2230 K', 'Diamond Θ_D = 2230 K')]], '343']],
    ctl: [['T', L('温度 T', 'Temperature T'), 1, 2000, 1, 300, (v) => `${v} K`]],
    figs: [[0.55, L('每个原子平均的声子数（对数坐标）。虚线是低温的 T³ 和高温的 T 两个极限。', 'Mean number of phonons per atom (log scales). Dashed lines are the low-temperature T³ and high-temperature T limits.')]],
    note: L('n/N = 9(T/Θ_D)³ ∫₀^{Θ_D/T} x²/(eˣ − 1) dx。低温极限 18ζ(3)(T/Θ_D)³ ≈ 21.6 (T/Θ_D)³；高温极限 4.5 T/Θ_D − 1.5 + …。Debye 温度取自 Kittel 的表。声子馆的“热容”一章讲同一个模型。', 'n/N = 9(T/Θ_D)³ ∫₀^{Θ_D/T} x²/(eˣ − 1) dx. Low-temperature limit 18ζ(3)(T/Θ_D)³ ≈ 21.6 (T/Θ_D)³; high-temperature limit 4.5 T/Θ_D − 1.5 + …. Debye temperatures from Kittel’s table. The phonon hall’s heat-capacity chapter uses the same model.'),
    draw(s, [cv], c) {
      const th = Number(s.mat), Ts = Array.from({ length: 160 }, (_, i) => 10 ** (0 + (i / 159) * 3.5)), n = Ts.map((T) => M.phononNumber(T, th));
      plot(cv, { logx: true, logy: true, x: [0, 3.5], y: [-6, 2], xl: 'T (K)', yl: L('声子数 / 原子', 'phonons / atom'), series: [{ xs: Ts, ys: n, color: c.accent, width: 2.2 }, { xs: Ts.filter((T) => T < th / 3), ys: Ts.filter((T) => T < th / 3).map((T) => M.phononNumberLow(T, th)), color: c.muted, dash: [5, 4], label: 'T³' }, { xs: Ts.filter((T) => T > th / 2), ys: Ts.filter((T) => T > th / 2).map((T) => 4.5 * (T / th)), color: c.gold, dash: [5, 4], label: 'T' }], marks: [{ x: s.T, color: c.danger }, { x: th, color: c.line }] });
      const v = M.phononNumber(s.T, th);
      return [[L('每个原子的声子数', 'Phonons per atom'), fmt(v, 3), true], [L('每立方厘米（按铜的原子密度 8.5×10²² cm⁻³）', 'Per cm³ (at copper’s atom density 8.5×10²² cm⁻³)'), `${fmt(v * 8.49e22, 3)} cm⁻³`], [L('T / Θ_D', 'T / Θ_D'), fix(s.T / th, 3)]];
    },
  };

  // ── 3. 空穴 ────────────────────────────────────────────────────
  DEMOS.band = {
    title: L('空穴：几乎满的能带里，缺掉的那几个电子就是带正电的粒子', 'Holes: in a nearly full band, the few missing electrons act as positive particles'), kind: 'exact',
    intro: L('一维紧束缚能带 E(k) = −2t cos ka。填进电子（金点），再加一个电场：所有电子的 k 一起平移 Δk。算一算电流：把所有电子的速度加起来，和“只把空着的那几个态的速度加起来、当成带正电的粒子”结果完全一样，因为满带不导电。能带顶上的曲率是负的，电子在那里的有效质量是负的；换成空穴，电荷和质量都变成正的。', 'A one-dimensional tight-binding band E(k) = −2t cos ka. Fill in electrons (gold dots) and apply an electric field: every electron’s k shifts by Δk together. Now compute the current: summing the velocities of all the electrons gives exactly the same answer as summing over only the few empty states and treating them as positively charged particles, because a full band carries no current. Near the top of the band the curvature is negative and electrons there have negative effective mass; as holes, both charge and mass become positive.'),
    ctl: [['nu', L('填充比例（电子数 / 态数）', 'Filling (electrons / states)'), 0, 1, 0.025, 0.9, (v) => pct(v, 1)], ['dk', L('电场造成的 Δk', 'Δk produced by the field'), -0.6, 0.6, 0.01, 0.25, (v) => `${v.toFixed(2)} π/a`]],
    btn: [[L('几乎空：电子', 'Nearly empty: electrons'), { nu: 0.1 }], [L('半满', 'Half full'), { nu: 0.5 }], [L('几乎满：空穴', 'Nearly full: holes'), { nu: 0.9 }], [L('全满：不导电', 'Full: no current'), { nu: 1 }]],
    figs: [[0.55, L('能带 E(k)（单位 t），金点是电子，空心圈是空着的态；整体平移了 Δk。', 'Band E(k) in units of t; gold dots are electrons, open circles empty states; everything shifted by Δk.')], [0.35, L('有效质量 m*(k) = ħ²/(d²E/dk²)（单位 ħ²/2ta²）：带底是正的，带顶是负的。', 'Effective mass m*(k) = ħ²/(d²E/dk²) (units of ħ²/2ta²): positive at the bottom, negative at the top.')]],
    note: L('40 个 k 点，周期边界，ħ = a = e = 1。电子的电流 J = −Σ_占据 v(k + Δk)，空穴的电流 J = +Σ_空 v(k + Δk)；因为 Σ_全部 v = 0，两者严格相等。真实的半导体里空穴的能带是三维的、常常不止一支（重空穴、轻空穴），回旋共振能分别测出它们的有效质量。', '40 k points, periodic boundary, ħ = a = e = 1. Electron current J = −Σ_occupied v(k + Δk); hole current J = +Σ_empty v(k + Δk); since Σ_all v = 0 the two are exactly equal. In real semiconductors hole bands are three-dimensional and often come in more than one branch (heavy and light holes), whose effective masses cyclotron resonance can measure separately.'),
    draw(s, [a, b], c) {
      const N = 40, dk = s.dk * PI, r = M.tbCurrent(N, s.nu, dk), ks = lin(-PI, PI, 300);
      const occ = r.ks.filter((_, i) => r.full.has(i)).map((k) => k + dk), emp = r.ks.filter((_, i) => !r.full.has(i)).map((k) => k + dk);
      const wrap = (k) => ((k + PI) % (2 * PI) + 2 * PI) % (2 * PI) - PI;
      plot(a, { x: [-PI, PI], y: [-2.4, 2.6], xl: 'k', yl: 'E / t', xt: [-PI, 0, PI], xf: (t) => (t === 0 ? '0' : t > 0 ? 'π/a' : '−π/a'), series: [{ xs: ks, ys: ks.map((k) => M.tbE(k)), color: c.muted, width: 1.6 }, { xs: emp.map(wrap), ys: emp.map((k) => M.tbE(k)), dots: 3.5, color: c.line }, { xs: occ.map(wrap), ys: occ.map((k) => M.tbE(k)), dots: 4, color: c.gold }] });
      const mk = ks.map((k) => Math.max(-6, Math.min(6, 2 * M.tbMass(k)))); // 以 ħ²/(2ta²) 为单位
      plot(b, { x: [-PI, PI], y: [-6, 6], xl: 'k', yl: 'm*', xt: [-PI, -PI / 2, 0, PI / 2, PI], xf: (t) => (t === 0 ? '0' : `${t < 0 ? '−' : ''}${Math.abs(t) > 2 ? 'π' : 'π/2'}`), series: [{ xs: ks, ys: mk, color: c.accent, width: 2 }], hmarks: [{ y: 0, color: c.line }] });
      return [[L('电子数 / 空着的态数', 'Electrons / empty states'), `${r.occ} / ${N - r.occ}`], [L('按电子算的电流', 'Current counting electrons'), fix(r.electrons, 6)], [L('按空穴算的电流', 'Current counting holes'), fix(r.holes, 6), true], [L('带顶的有效质量（电子）', 'Effective mass at the top (electron)'), `${fix(2 * M.tbMass(PI), 2)} ħ²/(2ta²)`]];
    },
  };

  // ── 4. 费米液体 ────────────────────────────────────────────────
  DEMOS.fermi = {
    title: L('费米液体：越靠近费米面，准粒子活得越久', 'Fermi liquid: the closer to the Fermi surface, the longer quasiparticles live'), kind: 'toy',
    intro: L('相互作用很强的电子气，为什么还能当成几乎自由的粒子？Landau 的回答：费米面附近的激发，衰减率按 Γ ∝ ε² + (πk_BT)² 变小，比它的能量 ε 小得更快，所以越靠近费米面，峰越尖、准粒子越好。动量分布 n(k) 在 k_F 处仍然有一个跳变，大小是 Z。对照“边缘费米液体”（Γ ∝ |ε|），Γ/ε 不再趋于零，准粒子的说法就站不住了。', 'Why can a strongly interacting electron gas still be treated as almost free particles? Landau’s answer: excitations near the Fermi surface decay at a rate Γ ∝ ε² + (πk_BT)², which shrinks faster than their energy ε, so the closer to the Fermi surface, the sharper the peak and the better the quasiparticle. The momentum distribution n(k) still jumps at k_F, by Z. Compare a “marginal Fermi liquid” (Γ ∝ |ε|): Γ/ε no longer goes to zero, and the quasiparticle picture fails.'),
    sel: [['kind', L('衰减率', 'Decay rate'), [['fl', L('费米液体 Γ = a[ε² + (πT)²]', 'Fermi liquid Γ = a[ε² + (πT)²]')], ['mfl', L('边缘费米液体 Γ = a′ max(|ε|, πT)', 'Marginal Fermi liquid Γ = a′ max(|ε|, πT)')]], 'fl']],
    ctl: [['T', L('温度 k_BT（单位 E_F）', 'Temperature k_BT (units of E_F)'), 0, 0.05, 0.001, 0.005, (v) => v.toFixed(3)], ['Z', L('跳变 Z', 'Jump Z'), 0.2, 1, 0.01, 0.6, (v) => v.toFixed(2)]],
    figs: [[0.5, L('几个 k 上的谱函数 A(k, ω)（ε_k = v(k − k_F)）：靠近费米面（ω = 0）的峰窄，远离的宽。', 'Spectral functions A(k, ω) at several k (ε_k = v(k − k_F)): narrow near the Fermi level (ω = 0), broad further away.')], [0.38, L('Γ/|ε|：费米液体里它在费米面处趋于零（T = 0 时）。', 'Γ/|ε|: in a Fermi liquid it vanishes at the Fermi surface (at T = 0).')], [0.32, L('动量分布 n(k)：跳变 Z 是费米液体的标志（示意）。', 'Momentum distribution n(k): the jump Z is the hallmark of a Fermi liquid (schematic).')]],
    note: L('能量以费米能 E_F 为单位，a = 2、a′ = 0.4（为了画图选的数）。谱函数 A = (Z/π)Γ/[(ω − ε_k)² + Γ²]。n(k) 用跳变 Z 加一个光滑台阶画，真实的形状要算多体理论。费米液体的电阻 ρ = ρ₀ + AT² 也来自同一个 ε² 规律；重费米子的 A 和热容系数 γ 满足 Kadowaki–Woods 关系 A/γ² ≈ 1.0×10⁻⁵ μΩ·cm (mol·K/mJ)²。', 'Energies in units of the Fermi energy E_F; a = 2 and a′ = 0.4 (chosen for plotting). Spectral function A = (Z/π)Γ/[(ω − ε_k)² + Γ²]. n(k) is drawn as the jump Z plus a smooth step; the real shape needs many-body theory. A Fermi liquid’s resistivity ρ = ρ₀ + AT² comes from the same ε² law; in heavy fermions A and the heat-capacity coefficient γ obey the Kadowaki–Woods relation A/γ² ≈ 1.0×10⁻⁵ μΩ·cm (mol·K/mJ)².'),
    draw(s, [a, b, d], c) {
      const G = (e) => (s.kind === 'fl' ? M.flGamma(e, s.T, 2) : M.mflGamma(e, s.T, 0.4)) + 1e-4, ws = lin(-0.6, 0.6, 600), eks = [-0.4, -0.2, -0.1, -0.05, 0.05, 0.1, 0.2, 0.4];
      const ser = eks.map((e, i) => ({ xs: ws, ys: ws.map((w) => (s.Z / PI) * G(e) / ((w - e) ** 2 + G(e) ** 2)), color: i % 2 ? c.accent : c.gold, width: 1.6 }));
      plot(a, { x: [-0.6, 0.6], y: [0, Math.min(40, (s.Z / PI) / G(0.05) * 1.1)], xl: 'ω / E_F', yl: 'A(k, ω)', series: ser, marks: [{ x: 0, color: c.line }] });
      const es = lin(0.002, 0.6, 300);
      plot(b, { x: [0, 0.6], y: [0, 1.2], xl: '|ε| / E_F', yl: 'Γ / |ε|', series: [{ xs: es, ys: es.map((e) => Math.min(1.2, G(e) / e)), color: c.accent, width: 2 }], hbands: [{ y0: 0, y1: 0.1, color: c.ok, alpha: 0.1 }] });
      const ks = lin(-2, 2, 400);
      plot(d, { x: [-2, 2], y: [0, 1.05], xl: '(k − k_F) / k_F·…', yl: 'n(k)', series: [{ xs: ks, ys: ks.map((k) => M.nk(k, s.Z)), color: c.accent, width: 2 }] });
      return [[L('ε = 0.05 E_F 处的 Γ/ε', 'Γ/ε at ε = 0.05 E_F'), fix(G(0.05) / 0.05, 3), true], [L('ε = 0.4 E_F 处的 Γ/ε', 'Γ/ε at ε = 0.4 E_F'), fix(G(0.4) / 0.4, 3)], [L('k_F 处的跳变', 'Jump at k_F'), fix(s.Z, 2)]];
    },
  };

  // ── 5. 磁振子 ──────────────────────────────────────────────────
  DEMOS.magnon = {
    title: L('自旋波：每个自旋绕着磁化方向转，相位一格一格推后', 'Spin waves: each spin precesses about the magnetisation, the phase lagging site by site'), kind: 'exact',
    intro: L('铁磁体的基态里所有自旋朝上。翻转一个自旋要花能量，但让这一点点“翻转”分摊到所有自旋上、每个只倾斜一点、绕着竖直方向转动，花的能量少得多：这就是自旋波，量子化以后叫磁振子。铁磁体的磁振子长波时 ħω ∝ k²（像有质量的粒子），反铁磁体的是 ħω ∝ |k|（像声子）。对自旋 1/2 的链，单个磁振子的色散可以精确算出，和公式一模一样。', 'In a ferromagnet’s ground state every spin points up. Flipping one spin costs energy, but spreading that bit of “flip” over all the spins, each tilted slightly and precessing about the vertical, costs far less: a spin wave, whose quantum is the magnon. Ferromagnetic magnons have ħω ∝ k² at long wavelength (like a massive particle); antiferromagnetic ones have ħω ∝ |k| (like phonons). For a spin-1/2 chain the one-magnon dispersion can be computed exactly and matches the formula precisely.'),
    sel: [['kind', L('磁体', 'Magnet'), [['fm', L('铁磁', 'Ferromagnet')], ['afm', L('反铁磁', 'Antiferromagnet')]], 'fm']],
    ctl: [['n', L('波矢 k = 2πn/N（N = 16）', 'Wavevector k = 2πn/N (N = 16)'), 0, 8, 1, 2, String]],
    state: () => ({ t: 0 }), autoplay: true, fps: 30, tick(s) { s.t += 0.06; },
    figs: [[0.34, L('一排自旋（侧视，箭头是自旋的方向，倾斜画得夸张了）。', 'A row of spins (side view; arrows show spin direction, tilt exaggerated).')], [0.48, L('色散 ħω(k)，单位 J。点是 16 格点自旋 1/2 链的单磁振子精确对角化（只对铁磁）。', 'Dispersion ħω(k) in units of J. Dots are exact diagonalisation of the one-magnon sector of a 16-site spin-1/2 chain (ferromagnet only).')]],
    note: L('H = −J Σ S_i·S_{i+1}，自旋 S = 1/2，周期边界。铁磁 ħω = 2JS(1 − cos ka)，是精确的（单磁振子态是这个哈密顿量的严格本征态）；反铁磁 ħω = 2JS|sin ka| 来自线性自旋波理论（Holstein–Primakoff 展开的最低阶），对自旋 1/2 的链真实的激发是“旋子”，色散的形状相同但大一个 π/2 的因子。三维铁磁体里磁振子把磁化强度按 Bloch 的 T^{3/2} 定律压低。', 'H = −J Σ S_i·S_{i+1} with spin S = 1/2 and periodic boundaries. The ferromagnetic ħω = 2JS(1 − cos ka) is exact (one-magnon states are exact eigenstates of this Hamiltonian); the antiferromagnetic ħω = 2JS|sin ka| comes from linear spin-wave theory (lowest order of the Holstein–Primakoff expansion), and for a spin-1/2 chain the true excitations are “spinons”, with the same shape of dispersion but larger by a factor π/2. In a three-dimensional ferromagnet magnons reduce the magnetisation following Bloch’s T^{3/2} law.'),
    draw(s, [a, b], c) {
      const N = 16, k = (2 * PI * s.n) / N, w = s.kind === 'fm' ? M.magnonFM(k) : M.magnonAFM(k), { ctx, w: W, h } = fit(a), dx = (W - 30) / N, ym = h * 0.5, len = h * 0.7, tilt = 0.45;
      for (let j = 0; j < N; j++) {
        const x = 15 + (j + 0.5) * dx, ph = k * j - w * s.t * 3, up = s.kind === 'afm' && j % 2 ? -1 : 1;
        const sx = Math.sin(tilt) * Math.cos(ph) * dx * 0.9, sy = Math.cos(tilt) * up * len / 2;
        K.arrow(ctx, x - sx / 2, ym + sy, x + sx / 2, ym - sy, up < 0 ? c.danger : c.accent, 2.2);
        ctx.fillStyle = c.ink2; ctx.beginPath(); ctx.arc(x, ym, 2.5, 0, 2 * PI); ctx.fill();
      }
      const ks = lin(-PI, PI, 400), pts = [];
      if (s.kind === 'fm') {
        const ex = M.oneMagnonExact(N).slice().sort((x, y) => x - y), exK = Array.from({ length: N }, (_, i) => (2 * PI * (i - N / 2 + 1)) / N), ord = exK.map((_, i) => i).sort((i, j) => (1 - Math.cos(exK[i])) - (1 - Math.cos(exK[j])));
        ord.forEach((i, r) => pts.push([exK[i], ex[r]]));
      }
      plot(b, { x: [-PI, PI], y: [0, s.kind === 'fm' ? 2.2 : 1.15], xl: 'k', yl: 'ħω / J', xt: [-PI, 0, PI], xf: (t) => (t === 0 ? '0' : t > 0 ? 'π/a' : '−π/a'), series: [{ xs: ks, ys: ks.map((kk) => (s.kind === 'fm' ? M.magnonFM(kk) : M.magnonAFM(kk))), color: c.accent, width: 2.2 }, ...(pts.length ? [{ pts, dots: 4, color: c.ink2, label: L('精确对角化', 'exact diagonalisation') }] : [])], marks: [{ x: k, y: w, color: c.gold }] });
      const lowT = M.blochDeficit(0.1, 1, 0.5);
      return [[L('k', 'k'), `${fix(k / PI, 3)} π/a`], [L('ħω', 'ħω'), `${fix(w, 4)} J`, true], [L('长波行为', 'Long-wave behaviour'), s.kind === 'fm' ? 'ħω ≈ JS k²a²' : 'ħω ≈ 2JS |k|a'], [L('三维铁磁体 k_BT = 0.1J 时磁化减少', '3D ferromagnet: magnetisation loss at k_BT = 0.1J'), pct(lowT, 2)]];
    },
  };

  // ── 6. 激子 ────────────────────────────────────────────────────
  DEMOS.exciton = {
    title: L('激子：带隙下面的一串氢原子谱线', 'Excitons: a hydrogen-like series of lines below the band gap'), kind: 'exact',
    intro: L('光把一个电子从价带打到导带，留下一个空穴。两者带相反的电荷，会像氢原子一样束缚在一起：这就是激子（Wannier 激子）。它的“里德伯能量”是 13.6 eV × μ/ε²，玻尔半径是 0.053 nm × ε/μ，μ 是电子和空穴的约化质量，ε 是介电常数。于是吸收谱在带隙下面出现一串 n = 1, 2, 3… 的谱线，越往上越密，最后接上连续谱，连续谱本身也被库仑吸引抬高了（Sommerfeld 因子）。', 'Light lifts an electron from the valence to the conduction band, leaving a hole. With opposite charges, the two bind like a hydrogen atom: an exciton (Wannier exciton). Its “Rydberg energy” is 13.6 eV × μ/ε² and its Bohr radius 0.053 nm × ε/μ, with μ the electron–hole reduced mass and ε the dielectric constant. So the absorption spectrum shows a series of lines n = 1, 2, 3… below the gap, crowding together towards it and merging into the continuum, which is itself raised by the Coulomb attraction (the Sommerfeld factor).'),
    ctl: [['mu', L('约化质量 μ / m_e', 'Reduced mass μ / m_e'), 0.02, 1, 0.005, 0.059, (v) => v.toFixed(3)], ['eps', L('介电常数 ε', 'Dielectric constant ε'), 2, 20, 0.1, 12.9, (v) => v.toFixed(1)], ['G', L('谱线展宽 Γ / Ry*', 'Line broadening Γ / Ry*'), 0.005, 0.3, 0.005, 0.03, (v) => v.toFixed(3)]],
    chk: [['coul', L('电子和空穴之间有库仑吸引', 'Coulomb attraction between electron and hole'), true]],
    btn: [[L('GaAs 一样的参数', 'GaAs-like parameters'), { mu: 0.059, eps: 12.9 }], [L('Cu₂O 一样的参数', 'Cu₂O-like parameters'), { mu: 0.366, eps: 7.5 }], [L('介电常数小、质量大', 'Small ε, large mass'), { mu: 0.5, eps: 4 }]],
    figs: [[0.55, L('吸收谱（Elliott 公式），横轴以 Ry* 为单位、带隙在 0。虚线是没有库仑吸引时的 √E 吸收边。', 'Absorption (Elliott formula), horizontal axis in units of Ry* with the gap at 0. The dashed curve is the √E edge without Coulomb attraction.')]],
    note: L('三维氢原子模型，只有 s 态（光学允许的偶极跃迁）可见，第 n 条线强度 ∝ 1/n³。Elliott 公式：α ∝ Σ (4π/n³) Ry^{3/2} δ(E − E_g + Ry/n²) + θ(E − E_g) π e^{πx}/sinh(πx) Ry^{1/2}，x = √(Ry/(E − E_g))。GaAs 的参数（m_e = 0.067、重空穴约 0.5、ε = 12.9）给出约 4.8 meV，实测约 4.2 meV；Cu₂O 的黄色系列其实是 p 激子（n 从 2 开始），实测里德伯能量约 92 meV、能看到 n = 25，这里只拿参数比较大小。单层材料里屏蔽随距离变，谱线不是氢原子式的。', 'Three-dimensional hydrogen model; only s states (the optically allowed dipole transitions) are visible, with line n having strength ∝ 1/n³. Elliott formula: α ∝ Σ (4π/n³) Ry^{3/2} δ(E − E_g + Ry/n²) + θ(E − E_g) π e^{πx}/sinh(πx) Ry^{1/2}, x = √(Ry/(E − E_g)). GaAs parameters (m_e = 0.067, heavy hole about 0.5, ε = 12.9) give about 4.8 meV against a measured 4.2 meV; the yellow series of Cu₂O is really p excitons (n from 2), with a measured Rydberg energy of about 92 meV and lines up to n = 25, and is used here only to compare sizes. In monolayers the screening varies with distance and the series is not hydrogen-like.'),
    draw(s, [cv], c) {
      const Ry = M.excitonRy(s.mu, s.eps), a = M.excitonA(s.mu, s.eps), xs = lin(-1.3, 3, 700), G = s.G;
      const ys = xs.map((E) => (s.coul ? M.elliott(E, 0, 1, G, 40) : 0)), free = xs.map((E) => (E > 0 ? Math.sqrt(E) : 0));
      plot(cv, { x: [-1.3, 3], y: [0, Math.min(Math.max(...ys, 3) * 1.05, 40)], xl: L('(E − E_g) / Ry*', '(E − E_g) / Ry*'), yl: L('吸收（任意单位）', 'absorption (arb.)'), series: [...(s.coul ? [{ xs, ys, color: c.accent, width: 1.8, fill: true, alpha: 0.2 }] : []), { xs, ys: free, color: c.muted, dash: [5, 4], label: L('没有库仑', 'no Coulomb') }], marks: [1, 2, 3].map((n) => ({ x: -1 / (n * n), color: c.line })) });
      return [[L('激子里德伯能量 Ry*', 'Exciton Rydberg Ry*'), `${fix(Ry, 2)} meV`, true], [L('激子玻尔半径 a*', 'Exciton Bohr radius a*'), `${fix(a, 2)} nm`], [L('n = 1, 2, 3 在带隙下', 'n = 1, 2, 3 below the gap'), `${fix(Ry, 2)}, ${fix(Ry / 4, 2)}, ${fix(Ry / 9, 2)} meV`], [L('室温 k_BT / Ry*', 'Room-temperature k_BT / Ry*'), fix(25.85 / Ry, 2)]];
    },
  };

  // ── 7. 极化子 ──────────────────────────────────────────────────
  DEMOS.polaron = {
    title: L('极化子：电子拖着一团晶格畸变走，Feynman 的变分解', 'Polarons: an electron dragging a cloud of lattice distortion, Feynman’s variational solution'), kind: 'exact',
    intro: L('离子晶体里，一个慢电子会把周围的正离子拉近、负离子推远，自己陷在这团极化里，变重、能量变低：这就是极化子。Fröhlich 模型里只有一个无量纲的耦合常数 α。α 小时可以微扰（能量 −αħω、质量 1 + α/6），α 大时电子把自己“挖”进一个坑里（Pekar 的强耦合）。Feynman 1955 年用路径积分写出一个对所有 α 都不坏的变分上界，这里当场把它最小化。', 'In an ionic crystal a slow electron pulls nearby positive ions closer and pushes negative ones away, trapping itself in the resulting polarisation, heavier and lower in energy: a polaron. The Fröhlich model has a single dimensionless coupling constant α. For small α perturbation theory works (energy −αħω, mass 1 + α/6); for large α the electron digs itself a pit (Pekar’s strong coupling). In 1955 Feynman used path integrals to write a variational upper bound that is good for every α, minimised here on the spot.'),
    ctl: [['a', L('耦合常数 α', 'Coupling constant α'), 0.02, 12, 0.02, 3, (v) => v.toFixed(2)]],
    btn: [[L('GaAs（α ≈ 0.068）', 'GaAs (α ≈ 0.068)'), { a: 0.068 }], [L('AgBr（α ≈ 1.5）', 'AgBr (α ≈ 1.5)'), { a: 1.53 }], [L('KCl（α ≈ 3.4）', 'KCl (α ≈ 3.4)'), { a: 3.44 }], [L('强耦合 α = 10', 'Strong coupling α = 10'), { a: 10 }]],
    figs: [[0.5, L('基态能量 E/ħω_LO。实线是 Feynman 变分；虚线是微扰（弱耦合）和 Pekar（强耦合）两个极限。', 'Ground-state energy E/ħω_LO. Solid: Feynman’s variational result; dashed: the perturbative (weak) and Pekar (strong) limits.')], [0.4, L('Feynman 的有效质量 m*/m（对数坐标）。', 'Feynman’s effective mass m*/m (log scale).')]],
    note: L('单位 ħ = ω_LO = m = 1。Feynman：E = 3(v − w)²/4v − (αv/√π) ∫₀^∞ e^{−τ} [w²τ + (v² − w²)(1 − e^{−vτ})/v]^{−1/2} dτ，对 v、w 取最小（Nelder–Mead）；有效质量 m*/m = 1 + (αv³/3√π) ∫₀^∞ e^{−τ} τ² [·]^{−3/2} dτ。α = 5 时得 E = −5.4401，和文献的表一致。微扰：−α − 0.0159α²；Pekar：−0.1085α²。材料的 α 是文献里的常见值（GaAs 0.068，AgBr 约 1.5，KCl 约 3.4），只用来定位。Fröhlich 模型只描述“大极化子”；小极化子（电子局域在一个格点上）要用别的模型。', 'Units ħ = ω_LO = m = 1. Feynman: E = 3(v − w)²/4v − (αv/√π) ∫₀^∞ e^{−τ} [w²τ + (v² − w²)(1 − e^{−vτ})/v]^{−1/2} dτ, minimised over v and w (Nelder–Mead); effective mass m*/m = 1 + (αv³/3√π) ∫₀^∞ e^{−τ} τ² [·]^{−3/2} dτ. At α = 5 this gives E = −5.4401, matching published tables. Perturbative: −α − 0.0159α²; Pekar: −0.1085α². Material values of α are common literature figures (GaAs 0.068, AgBr about 1.5, KCl about 3.4), for orientation only. The Fröhlich model describes only “large polarons”; small polarons (an electron localised on one site) need other models.'),
    draw(s, [a, b], c) {
      if (!DEMOS.polaron.cache) { const as = lin(0.05, 12, 60); DEMOS.polaron.cache = { as, F: as.map((x) => M.feynman(x)) }; }
      const { as, F } = DEMOS.polaron.cache, cur = M.feynman(s.a);
      plot(a, { x: [0, 12], y: [-17, 0.5], xl: 'α', yl: 'E / ħω_LO', series: [{ xs: as, ys: F.map((f) => f.E), color: c.accent, width: 2.4, label: 'Feynman' }, { xs: as.filter((x) => x < 6), ys: as.filter((x) => x < 6).map(M.polaronWeak), color: c.muted, dash: [5, 4], label: L('微扰', 'perturbative') }, { xs: as.filter((x) => x > 4), ys: as.filter((x) => x > 4).map(M.polaronStrong), color: c.gold, dash: [5, 4], label: 'Pekar' }], marks: [{ x: s.a, y: cur.E, color: c.danger }] });
      plot(b, { logy: true, x: [0, 12], y: [0, 3.5], xl: 'α', yl: 'm*/m', series: [{ xs: as, ys: F.map((f) => f.mass), color: c.accent, width: 2.2 }, { xs: as.filter((x) => x < 3), ys: as.filter((x) => x < 3).map((x) => 1 + x / 6), color: c.muted, dash: [5, 4], label: '1 + α/6' }], marks: [{ x: s.a, y: cur.mass, color: c.danger }] });
      return [[L('能量 E', 'Energy E'), `${fix(cur.E, 4)} ħω_LO`, true], [L('有效质量 m*/m', 'Effective mass m*/m'), fix(cur.mass, 3)], [L('变分参数 v, w', 'Variational parameters v, w'), `${fix(cur.v, 3)}, ${fix(cur.w, 3)}`], [L('GaAs：ħω_LO = 36 meV 时的结合能', 'GaAs: binding energy for ħω_LO = 36 meV'), s.a < 0.1 ? `${fix(-cur.E * 36, 2)} meV` : '—']];
    },
  };

  // ── 8. 等离激元 ────────────────────────────────────────────────
  DEMOS.plasmon = {
    title: L('等离激元：电子海整体的振荡，金属为什么反光', 'Plasmons: the electron sea oscillating as a whole, and why metals shine'), kind: 'exact',
    intro: L('把金属里的电子海整体推一下，正离子的背景把它拉回来，于是整片电子以等离子体频率 ω_p = √(ne²/ε₀m) 振荡。它的量子是体等离激元。频率低于 ω_p 的光进不去，几乎全部反射，这就是金属光泽；高于 ω_p 金属变透明（碱金属在紫外透明）。快电子穿过薄膜时一份一份地损失 ħω_p 的能量，最早就是这样看到它的。表面和小颗粒上的等离激元频率更低，是纳米光学的主角。', 'Push a metal’s electron sea as a whole and the positive ionic background pulls it back, so the whole sea oscillates at the plasma frequency ω_p = √(ne²/ε₀m). Its quantum is the bulk plasmon. Light below ω_p cannot enter and is almost totally reflected, which is metallic lustre; above ω_p the metal turns transparent (alkali metals are transparent in the ultraviolet). Fast electrons crossing a thin film lose energy in portions of ħω_p, which is how it was first seen. Plasmons on surfaces and small particles have lower frequencies and star in nanophotonics.'),
    ctl: [['ln', L('电子密度 log₁₀ n（cm⁻³）', 'Electron density log₁₀ n (cm⁻³)'), 17, 23.5, 0.01, Math.log10(18.1e22), (v) => `n = ${fmt(10 ** v, 3)} cm⁻³`], ['m', L('有效质量 m*/m_e', 'Effective mass m*/m_e'), 0.03, 2, 0.001, 1, (v) => v.toFixed(3)], ['einf', L('背景介电常数 ε∞', 'Background dielectric constant ε∞'), 1, 15, 0.1, 1, (v) => v.toFixed(1)], ['g', L('阻尼 γ / ω_p', 'Damping γ / ω_p'), 0.005, 0.3, 0.005, 0.03, (v) => v.toFixed(3)]],
    btn: [[L('铝', 'Aluminium'), { ln: Math.log10(18.1e22), m: 1, einf: 1 }], [L('钠', 'Sodium'), { ln: Math.log10(2.65e22), m: 1, einf: 1 }], [L('银（ε∞ ≈ 5 来自 d 电子）', 'Silver (ε∞ ≈ 5 from d electrons)'), { ln: Math.log10(5.86e22), m: 1, einf: 5 }], [L('掺杂的 GaAs（10¹⁹ cm⁻³）', 'Doped GaAs (10¹⁹ cm⁻³)'), { ln: 19, m: 0.067, einf: 10.9 }]],
    figs: [[0.5, L('反射率 R(ω)：ω_p/√ε∞ 以下几乎全反射。', 'Reflectance R(ω): nearly total below ω_p/√ε∞.')], [0.42, L('能量损失函数 −Im(1/ε)：电子能量损失谱的峰就在 ε = 0 处，即体等离激元。', 'Loss function −Im(1/ε): the electron energy-loss peak sits where ε = 0, the bulk plasmon.')]],
    note: L('Drude 模型 ε(ω) = ε∞ − ω_p²/(ω² + iγω)，ω_p² = ne²/(ε₀m*)。自由电子密度：铝 18.1、钠 2.65、银 5.86（×10²² cm⁻³，Kittel/Ashcroft–Mermin 的表）。铝的实测体等离激元约 15 eV、钠约 5.7 eV；银的 d 电子让 ε∞ 约为 4–5，屏蔽后约 3.8 eV，这里用 ε∞ = 5 示意。表面等离激元在 ε = −1（ω_p/√(ε∞+1)），真空中小球的偶极等离激元在 ε = −2（ω_p/√(ε∞+2)）。', 'Drude model ε(ω) = ε∞ − ω_p²/(ω² + iγω), ω_p² = ne²/(ε₀m*). Free-electron densities: aluminium 18.1, sodium 2.65, silver 5.86 (×10²² cm⁻³, tables of Kittel and Ashcroft–Mermin). The measured bulk plasmon is about 15 eV in aluminium and 5.7 eV in sodium; silver’s d electrons give ε∞ around 4–5, screening it to about 3.8 eV, shown here with ε∞ = 5. The surface plasmon sits at ε = −1 (ω_p/√(ε∞+1)) and the dipole plasmon of a small sphere in vacuum at ε = −2 (ω_p/√(ε∞+2)).'),
    draw(s, [a, b], c) {
      const wp = M.plasmaEV(10 ** s.ln, s.m), g = s.g * wp, top = (2.2 * wp) / Math.sqrt(s.einf), ws = lin(top / 600, top, 600), eps = ws.map((w) => M.drude(w, wp, g, s.einf));
      const sc = wp / Math.sqrt(s.einf), ssp = wp / Math.sqrt(s.einf + 1), sph = wp / Math.sqrt(s.einf + 2);
      const unit = wp < 0.5 ? [1000, 'meV'] : [1, 'eV'];
      const X = ws.map((w) => w * unit[0]);
      plot(a, { x: [0, top * unit[0]], y: [0, 1.05], xl: `ħω (${unit[1]})`, yl: 'R', series: [{ xs: X, ys: eps.map(M.reflect), color: c.accent, width: 2.2 }], marks: [{ x: sc * unit[0], color: c.gold }, { x: ssp * unit[0], color: c.muted }, { x: sph * unit[0], color: c.danger }] });
      const lf = eps.map(M.lossFn);
      plot(b, { x: [0, top * unit[0]], y: [0, Math.max(...lf) * 1.1], xl: `ħω (${unit[1]})`, yl: '−Im(1/ε)', series: [{ xs: X, ys: lf, color: c.accent, width: 2, fill: true, alpha: 0.2 }], marks: [{ x: sc * unit[0], color: c.gold }] });
      const f = (v) => `${fix(v * unit[0], 3)} ${unit[1]}`;
      return [[L('ħω_p（裸）', 'ħω_p (bare)'), f(wp)], [L('体等离激元 ω_p/√ε∞', 'Bulk plasmon ω_p/√ε∞'), f(sc), true], [L('表面等离激元 ω_p/√(ε∞+1)', 'Surface plasmon ω_p/√(ε∞+1)'), f(ssp)], [L('小球的偶极等离激元 ω_p/√(ε∞+2)', 'Small-sphere dipole plasmon ω_p/√(ε∞+2)'), f(sph)], [L('对应的光波长', 'Matching light wavelength'), `${fix(1239.84 / sc, 0)} nm`]];
    },
  };

  // ── 9. 极化激元 ────────────────────────────────────────────────
  DEMOS.polariton = {
    title: L('极化激元：光和物质的激发强耦合，两条线互相推开', 'Polaritons: light strongly coupled to a material excitation, two lines pushing each other apart'), kind: 'exact',
    intro: L('光子和一个物质里的激发（激子、光学声子）能量相同、又耦合得足够强时，它们不再各自存在，而是混成两支新的模式，在原来交叉的地方推开一个间隙（反交叉）。混合出来的准粒子一半是光、一半是物质，叫极化激元。半导体微腔里的激子极化激元质量只有电子的万分之一左右，能在几开甚至室温下凝聚；离子晶体里光和横光学声子耦合成声子极化激元，黄昆 1951 年写出了它的方程。', 'When a photon and an excitation of a material (an exciton, an optical phonon) have the same energy and couple strongly enough, they stop existing separately and mix into two new modes that push apart where they used to cross (an anticrossing). The mixed quasiparticle, half light and half matter, is a polariton. Exciton-polaritons in semiconductor microcavities weigh about a ten-thousandth of an electron and can condense at a few kelvin or even room temperature; in ionic crystals light and transverse optical phonons combine into phonon-polaritons, whose equation Huang Kun wrote down in 1951.'),
    sel: [['kind', L('哪一种', 'Which kind'), [['cav', L('微腔激子极化激元', 'Microcavity exciton-polariton')], ['ph', L('声子极化激元（GaAs 的参数）', 'Phonon-polariton (GaAs parameters)')]], 'cav']],
    ctl: [['Om', L('Rabi 劈裂 ħΩ（meV，微腔）', 'Rabi splitting ħΩ (meV, microcavity)'), 0, 40, 0.5, 10, (v) => v.toFixed(1)], ['det', L('失谐 E_c(0) − E_x（meV，微腔）', 'Detuning E_c(0) − E_x (meV, microcavity)'), -30, 30, 0.5, -5, (v) => v.toFixed(1)]],
    btn: [[L('没有耦合', 'No coupling'), { Om: 0 }], [L('零失谐', 'Zero detuning'), { det: 0 }]],
    figs: [[0.6, L('色散。虚线是不耦合的光子和激子（或横光学声子），实线是两支极化激元（读数给出 k = 0 处下支里激子的比例）。', 'Dispersion. Dashed: uncoupled photon and exciton (or TO phonon); solid: the two polariton branches (the readout gives the exciton fraction of the lower branch at k = 0).')]],
    note: L('微腔：E_x = 1.6 eV，光子 E_c(k) = √(E_c(0)² + (ħck/n)²)，n = 3.5；两个耦合振子 E± = (E_c + E_x)/2 ± √((E_c − E_x)²/4 + (ħΩ/2)²)，下支的激子比例是 Hopfield 系数 |X|²。实际的 Rabi 劈裂在 GaAs 量子阱微腔里是几 meV，CdTe、GaN、有机材料里更大。声子极化激元：c²k² = ω² ε(ω)，ε(ω) = ε∞(ω_L² − ω²)/(ω_T² − ω²)，GaAs 的 ω_T = 268、ω_L = 292 cm⁻¹、ε∞ = 10.9（Lyddane–Sachs–Teller 给出 ε(0) = 12.9）。', 'Microcavity: E_x = 1.6 eV, photon E_c(k) = √(E_c(0)² + (ħck/n)²) with n = 3.5; two coupled oscillators E± = (E_c + E_x)/2 ± √((E_c − E_x)²/4 + (ħΩ/2)²), the lower branch’s exciton fraction being the Hopfield coefficient |X|². Actual Rabi splittings are a few meV in GaAs quantum-well microcavities and larger in CdTe, GaN and organic materials. Phonon-polariton: c²k² = ω² ε(ω), ε(ω) = ε∞(ω_L² − ω²)/(ω_T² − ω²), with GaAs values ω_T = 268, ω_L = 292 cm⁻¹, ε∞ = 10.9 (Lyddane–Sachs–Teller gives ε(0) = 12.9).'),
    draw(s, [cv], c) {
      if (s.kind === 'ph') {
        const wT = 268, wL = 292, ei = 10.9, ks = lin(0, 1800, 400), br = ks.map((k) => M.phononPolariton(k, wT, wL, ei));
        plot(cv, { x: [0, 1800], y: [0, 450], xl: L('ck/2π（cm⁻¹）', 'ck/2π (cm⁻¹)'), yl: 'ω (cm⁻¹)', series: [{ xs: ks, ys: ks, color: c.muted, dash: [5, 4], label: L('真空中的光', 'light in vacuum') }, { xs: ks, ys: ks.map((k) => k / Math.sqrt(ei)), color: c.muted, dash: [2, 3], label: 'ck/√ε∞' }, { xs: ks, ys: br.map((b) => b[0]), color: c.accent, width: 2.2 }, { xs: ks, ys: br.map((b) => b[1]), color: c.gold, width: 2.2 }], hbands: [{ y0: wT, y1: wL, color: c.danger, alpha: 0.08 }], hmarks: [{ y: wT, color: c.line }, { y: wL, color: c.line }] });
        return [[L('ω_T / ω_L', 'ω_T / ω_L'), '268 / 292 cm⁻¹'], [L('ε(0)（LST）', 'ε(0) (LST)'), fix(M.lst(wT, wL, ei), 2), true], [L('ω_T 和 ω_L 之间', 'Between ω_T and ω_L'), L('没有传播的模式：剩余射线带', 'no propagating mode: the reststrahlen band')]];
      }
      const Ex = 1.6, E0 = Ex + s.det / 1000, Om = s.Om / 1000, ks = lin(-4, 4, 400), Ec = ks.map((k) => M.cavityE(k, E0)), P = Ec.map((e) => M.polariton(e, Ex, Om));
      const lo = P.map((p, i) => [ks[i], (p.lo - Ex) * 1000]), up = P.map((p, i) => [ks[i], (p.up - Ex) * 1000]);
      const allY = [...lo, ...up].map((q) => q[1]).concat(Ec.map((e) => (e - Ex) * 1000), [0]), yLo = Math.min(...allY), yHi = Math.max(...allY), padY = Math.max(3, (yHi - yLo) * 0.1);
      plot(cv, { x: [-4, 4], y: [yLo - padY, yHi + padY], xl: L('面内波矢 k（μm⁻¹）', 'in-plane wavevector k (μm⁻¹)'), yl: L('E − E_x（meV）', 'E − E_x (meV)'), series: [{ xs: ks, ys: Ec.map((e) => (e - Ex) * 1000), color: c.muted, dash: [5, 4], label: L('腔光子', 'cavity photon') }, { xs: ks, ys: ks.map(() => 0), color: c.muted, dash: [2, 3], label: L('激子', 'exciton') }, { pts: lo, color: c.accent, width: 2.4, label: L('下极化激元', 'lower polariton') }, { pts: up, color: c.gold, width: 2.4, label: L('上极化激元', 'upper polariton') }] });
      const p0 = M.polariton(E0, Ex, Om), h = 0.05, e1 = M.polariton(M.cavityE(h, E0), Ex, Om).lo, curv = (2 * (e1 - p0.lo)) / (h * h); // eV·μm²
      const mLP = HB2 / curv; // ħ²/m* = d²E/dk²，以 m_e 为单位
      return [[L('k = 0 处的劈裂', 'Splitting at k = 0'), `${fix((p0.up - p0.lo) * 1000, 2)} meV`, true], [L('下支的激子比例 |X|²（k = 0）', 'Exciton fraction |X|² of the lower branch (k = 0)'), pct(p0.Xlo, 1)], [L('下极化激元的有效质量', 'Lower-polariton effective mass'), Om || s.det < 0 ? `${fmt(mLP, 3)} m_e` : '—'], [L('腔光子的质量', 'Cavity photon mass'), `${fmt(M.cavityMass(E0), 3)} m_e`]];
    },
  };
  const HB2 = (0.1973269804 ** 2) / 510998.95; // ħ²/m_e = (ħc)²/(m_ec²) = 7.62×10⁻⁸ eV·μm²

  // ── 10. BCS ────────────────────────────────────────────────────
  DEMOS.bcs = {
    title: L('BCS：能隙方程、Bogoliubov 准粒子和隧道谱', 'BCS: the gap equation, Bogoliubov quasiparticles and the tunnelling spectrum'), kind: 'exact',
    intro: L('费米面附近两个电子只要有一点点净吸引（来自声子），就会结成库珀对。所有的对凝聚在同一个量子态里，单粒子激发就被一个能隙 Δ 推开：激发出来的是 Bogoliubov 准粒子，一部分是电子、一部分是空穴，能量 E = √(ξ² + Δ²)。Δ 随温度降低从零长起来，零温时 2Δ(0) = 3.53 k_BT_c，这是弱耦合 BCS 理论的普适预言。隧道谱上看到的就是这个能隙和两边的尖峰。', 'If two electrons near the Fermi surface feel even a slight net attraction (from phonons), they bind into a Cooper pair. All the pairs condense into one quantum state, and single-particle excitations are pushed up by a gap Δ: what gets excited is a Bogoliubov quasiparticle, part electron and part hole, with energy E = √(ξ² + Δ²). Δ grows from zero as the temperature falls below T_c, with 2Δ(0) = 3.53 k_BT_c at zero temperature, the universal prediction of weak-coupling BCS theory. Tunnelling spectra show exactly this gap and the sharp peaks at its edges.'),
    ctl: [['lam', L('耦合 λ = N(0)V', 'Coupling λ = N(0)V'), 0.15, 0.5, 0.005, 0.25, (v) => v.toFixed(3)], ['t', L('温度 T / T_c', 'Temperature T / T_c'), 0, 1.2, 0.01, 0.3, (v) => v.toFixed(2)]],
    btn: [[L('弱耦合', 'Weak coupling'), { lam: 0.2 }], [L('接近 T_c', 'Close to T_c'), { t: 0.95 }]],
    figs: [[0.42, L('Δ(T)/Δ(0)：解 BCS 能隙方程得到（虚线是 T_c 附近的 1.74√(1 − T/T_c)）。', 'Δ(T)/Δ(0) from solving the BCS gap equation (dashed: 1.74√(1 − T/T_c) near T_c).')], [0.42, L('Bogoliubov 准粒子：E(ξ)（实线）和它的电子成分 u²（金色）、空穴成分 v²（虚线）。', 'Bogoliubov quasiparticle: E(ξ) (solid) and its electron part u² (gold) and hole part v² (dashed).')], [0.38, L('超导体的态密度 N(E)/N(0)：隧道谱测的就是它（加了一点展宽）。', 'Superconducting density of states N(E)/N(0), which tunnelling measures (with slight broadening).')]],
    note: L('能量以 Debye 能量 ħω_D 为单位，k_B = 1。能隙方程 1/λ = ∫₀^{ω_D} tanh(E/2T)/E dξ，E = √(ξ² + Δ²)，用对分法解；T = 0 时 Δ = ω_D/sinh(1/λ)。弱耦合极限给出 2Δ(0)/k_BT_c = 2π/e^γ = 3.528。实测铝约 3.4、锡约 3.5，铅、汞这类强耦合超导体约 4.3–4.6，需要 Eliashberg 理论。态密度画法用 Dynes 展宽 Re[(E + iΓ)/√((E + iΓ)² − Δ²)]，Γ = 0.02Δ。', 'Energies in units of the Debye energy ħω_D, k_B = 1. Gap equation 1/λ = ∫₀^{ω_D} tanh(E/2T)/E dξ, E = √(ξ² + Δ²), solved by bisection; at T = 0, Δ = ω_D/sinh(1/λ). The weak-coupling limit gives 2Δ(0)/k_BT_c = 2π/e^γ = 3.528. Measured values are about 3.4 for aluminium and 3.5 for tin; strong-coupling superconductors such as lead and mercury reach about 4.3–4.6 and need Eliashberg theory. The density of states uses Dynes broadening Re[(E + iΓ)/√((E + iΓ)² − Δ²)] with Γ = 0.02Δ.'),
    draw(s, [a, b, d], c) {
      const key = s.lam.toFixed(3);
      if (DEMOS.bcs.key !== key) { const tc = M.tcBCS(s.lam, 1), d0 = M.gap0(s.lam, 1), ts = lin(0, 1, 50); DEMOS.bcs.key = key; DEMOS.bcs.cache = { tc, d0, ts, ds: ts.map((t) => (t >= 1 ? 0 : M.gapT(t * tc, s.lam, 1) / d0)) }; }
      const { tc, d0, ts, ds } = DEMOS.bcs.cache, Dt = s.t >= 1 ? 0 : M.gapT(s.t * tc, s.lam, 1);
      const near = lin(0.7, 1, 40);
      plot(a, { x: [0, 1.2], y: [0, 1.1], xl: 'T / T_c', yl: 'Δ / Δ(0)', series: [{ xs: [...ts, 1.2], ys: [...ds, 0], color: c.accent, width: 2.2 }, { xs: near, ys: near.map((t) => 1.74 * Math.sqrt(1 - t)), color: c.muted, dash: [5, 4] }], marks: [{ x: s.t, y: Dt / d0, color: c.gold }] });
      const D = Dt || 1e-9, xs = lin(-4 * d0, 4 * d0, 300), bg = xs.map((x) => M.bogoliubov(x, D));
      plot(b, { x: [-4, 4], y: [0, 4.2], xl: 'ξ / Δ(0)', yl: 'E / Δ(0), u², v²', series: [{ xs: xs.map((x) => x / d0), ys: bg.map((g) => g.E / d0), color: c.accent, width: 2.2 }, { xs: xs.map((x) => x / d0), ys: xs.map((x) => Math.abs(x) / d0), color: c.muted, dash: [2, 3], label: L('正常态 |ξ|', 'normal state |ξ|') }, { xs: xs.map((x) => x / d0), ys: bg.map((g) => g.u2), color: c.gold, width: 1.8, label: 'u²' }, { xs: xs.map((x) => x / d0), ys: bg.map((g) => g.v2), color: c.gold, dash: [5, 4], label: 'v²' }] });
      const Es = lin(-4 * d0, 4 * d0, 500);
      plot(d, { x: [-4, 4], y: [0, 4], xl: 'E / Δ(0)', yl: 'N(E)/N(0)', series: [{ xs: Es.map((e) => e / d0), ys: Es.map((e) => Math.min(4, Dt ? M.bcsDOS(e, Dt, 0.02 * d0) : 1)), color: c.accent, width: 2, fill: true, alpha: 0.18 }] });
      return [[L('Δ(0)', 'Δ(0)'), `${fmt(d0, 4)} ħω_D`], [L('k_BT_c', 'k_BT_c'), `${fmt(tc, 4)} ħω_D`], [L('2Δ(0) / k_BT_c', '2Δ(0) / k_BT_c'), fix((2 * d0) / tc, 3), true], [L('现在的 Δ(T)/Δ(0)', 'Current Δ(T)/Δ(0)'), fix(Dt / d0, 3)]];
    },
  };

  // ── 11. Kitaev 链 ──────────────────────────────────────────────
  DEMOS.kitaev = {
    title: L('Kitaev 链：链的两端各藏着半个电子', 'The Kitaev chain: half an electron hidden at each end'), kind: 'exact',
    intro: L('一条一维的 p 波超导链。化学势 |μ| < 2t 时它处在拓扑相：能谱中间出现两个几乎正好为零的能级，对应的模式一个在左端、一个在右端，各是“半个费米子”（Majorana 零能模）。两个合起来才是一个普通的费米子态，信息分散在两端，局部的噪声碰不到它，这正是拓扑量子计算想要的。|μ| > 2t 时零能模消失，链是普通的超导体。链越长，两个零能模的能量越接近零（指数地）。', 'A one-dimensional p-wave superconducting chain. For chemical potential |μ| < 2t it is in a topological phase: two levels appear in the middle of the spectrum, almost exactly at zero, with one mode at the left end and one at the right, each “half a fermion” (Majorana zero modes). Only together do they make an ordinary fermionic state, its information split between the ends where local noise cannot reach it, which is just what topological quantum computing wants. For |μ| > 2t the zero modes disappear and the chain is an ordinary superconductor. The longer the chain, the closer the two zero modes are to zero (exponentially).'),
    ctl: [['mu', L('化学势 μ / t', 'Chemical potential μ / t'), -3.5, 3.5, 0.05, 1, (v) => v.toFixed(2)], ['D', L('配对 Δ / t', 'Pairing Δ / t'), 0.1, 1.5, 0.05, 0.6, (v) => v.toFixed(2)], ['N', L('格点数 N', 'Sites N'), 6, 60, 1, 24, String]],
    btn: [[L('“甜点” μ = 0、Δ = t', '“Sweet spot” μ = 0, Δ = t'), { mu: 0, D: 1 }], [L('拓扑相', 'Topological phase'), { mu: 1 }], [L('普通相', 'Trivial phase'), { mu: 2.8 }]],
    figs: [[0.5, L('开边界链的 BdG 能谱随 μ 变（灰），竖线是现在的 μ；金点是最靠近零的两个能级。', 'BdG spectrum of the open chain versus μ (grey); the vertical line is the current μ; gold dots are the two levels closest to zero.')], [0.36, L('最靠近零的那个模式在每个格点上的权重：拓扑相里贴在两端。', 'Weight on each site of the mode closest to zero: stuck to the two ends in the topological phase.')]],
    note: L('H = −μ Σ_j (c†_j c_j − ½) − t Σ_j (c†_j c_{j+1} + h.c.) + Δ Σ_j (c_j c_{j+1} + h.c.)，开边界，Bogoliubov–de Gennes 矩阵 2N × 2N，用 Jacobi 方法求全部本征值。体能谱 E(k) = ±√((2t cos k + μ)² + 4Δ² sin² k)，在 μ = ±2t 处关闭能隙：这就是拓扑相变。在 μ = 0、Δ = t 的“甜点”上零能模正好为零、完全局域在两端的格点上。真实的实验（超导体–半导体纳米线、磁性原子链）是否看到了 Majorana 零能模，至今有争议。', 'H = −μ Σ_j (c†_j c_j − ½) − t Σ_j (c†_j c_{j+1} + h.c.) + Δ Σ_j (c_j c_{j+1} + h.c.), open boundaries, a 2N × 2N Bogoliubov–de Gennes matrix whose eigenvalues are all found by the Jacobi method. The bulk spectrum E(k) = ±√((2t cos k + μ)² + 4Δ² sin² k) closes its gap at μ = ±2t: the topological phase transition. At the “sweet spot” μ = 0, Δ = t the zero modes are exactly zero and fully localised on the end sites. Whether real experiments (superconductor–semiconductor nanowires, chains of magnetic atoms) have seen Majorana zero modes remains disputed.'),
    draw(s, [a, b], c) {
      const key = `${s.D}|${s.N}`;
      if (DEMOS.kitaev.key !== key) { const mus = lin(-3.5, 3.5, 71); DEMOS.kitaev.key = key; DEMOS.kitaev.cache = { mus, E: mus.map((m) => M.kitaevSpectrum(s.N, m, 1, s.D).values) }; }
      const { mus, E } = DEMOS.kitaev.cache, pts = [];
      mus.forEach((m, i) => E[i].forEach((e) => { if (Math.abs(e) < 4) pts.push([m, e]); }));
      const cur = M.kitaevSpectrum(s.N, s.mu, 1, s.D), mid = s.N - 1, zs = [cur.values[mid], cur.values[mid + 1]];
      plot(a, { x: [-3.5, 3.5], y: [-3.5, 3.5], xl: 'μ / t', yl: 'E / t', series: [{ pts, dots: 1.3, color: c.muted }, { pts: zs.map((z) => [s.mu, z]), dots: 4.5, color: c.gold }], marks: [{ x: s.mu, color: c.danger }], bands: [{ x0: -2, x1: 2, color: c.gold, alpha: 0.07 }] });
      const wgt = M.modeWeight(cur.vectors[mid + 1], s.N), js = Array.from({ length: s.N }, (_, i) => i + 1);
      plot(b, { x: [0.5, s.N + 0.5], y: [0, Math.max(...wgt) * 1.15], xl: L('格点', 'site'), yl: L('权重', 'weight'), series: [{ xs: js, ys: wgt, bars: 0.8, color: c.accent, alpha: 0.8 }] });
      const topo = Math.abs(s.mu) < 2, gap = Math.min(...lin(0, PI, 200).map((k) => M.kitaevBulk(k, s.mu, 1, s.D)));
      return [[L('相', 'Phase'), topo ? L('拓扑相（有 Majorana 零能模）', 'topological (Majorana zero modes)') : L('普通相', 'trivial'), true], [L('最靠近零的能级 |E|', 'Level closest to zero |E|'), `${fmt(Math.abs(zs[1]), 3)} t`], [L('体能隙', 'Bulk gap'), `${fix(gap, 3)} t`], [L('两端格点上的权重', 'Weight on the two end sites'), pct(wgt[0] + wgt[s.N - 1], 1)]];
    },
  };

  // ── 12. ARPES ─────────────────────────────────────────────────
  DEMOS.arpes = {
    title: L('ARPES：直接看到准粒子的能带，和声子在上面留下的“扭折”', 'ARPES: seeing the quasiparticle band directly, and the “kink” phonons leave on it'), kind: 'exact',
    intro: L('角分辨光电子能谱把电子从样品里打出来，测它的能量和出射角，就得到 A(k, ω) 在费米面以下的那一半：一张能量对动量的“照片”。电子和一个能量为 ħω_E 的声子耦合时，在 ħω_E 以内能带变平（速度除以 1 + λ）、峰变尖，在 ħω_E 以外又回到原来的斜率、峰变宽：中间留下一个扭折。从扭折的位置和斜率比就能读出声子的能量和耦合常数 λ。', 'Angle-resolved photoemission knocks electrons out of a sample and measures their energy and exit angle, giving the half of A(k, ω) below the Fermi level: an energy-versus-momentum “photograph”. When electrons couple to a phonon of energy ħω_E, the band flattens within ħω_E (velocity divided by 1 + λ) and the peak sharpens, while beyond ħω_E it returns to the original slope and broadens: a kink is left between. The kink’s position and the ratio of slopes read off the phonon energy and the coupling constant λ.'),
    ctl: [['lam', L('电子–声子耦合 λ', 'Electron–phonon coupling λ'), 0, 1.5, 0.01, 0.6, (v) => v.toFixed(2)], ['wE', L('声子能量 ħω_E（meV）', 'Phonon energy ħω_E (meV)'), 10, 100, 1, 60, String], ['G0', L('杂质展宽 Γ₀（meV）', 'Impurity broadening Γ₀ (meV)'), 2, 40, 1, 8, String]],
    btn: [[L('没有耦合', 'No coupling'), { lam: 0 }], [L('强耦合', 'Strong coupling'), { lam: 1.2 }]],
    figs: [[0.62, L('A(k, ω)·f(ω)：ARPES 看到的强度（越亮越强）。灰虚线是裸能带，金线是谱峰的位置。', 'A(k, ω)·f(ω): the intensity ARPES sees (brighter = stronger). The grey dashed line is the bare band, the gold line the peak position.')]],
    note: L('线性裸能带 ε_k = v k（v = 1 eV·Å），一个 Einstein 声子，T = 0：Re Σ(ω) = −(λω_E/2) ln|(ω_E + ω)/(ω_E − ω)|，Im Σ = −(πλω_E/2) θ(|ω| − ω_E) − Γ₀；A = −Im Σ/π/[(ω − ε_k − Re Σ)² + Im Σ²]，乘上 T = 0 的费米函数（只有 ω < 0）。没有算仪器分辨率和矩阵元。金线在 ħω_E 附近的 S 形回弯来自单一频率声子在 Re Σ 里的对数奇点，真实材料的声子谱有宽度，会把它抹平。真实材料里扭折常常不止一个来源（声子、磁激发），解读要小心。', 'Linear bare band ε_k = v k (v = 1 eV·Å), one Einstein phonon, T = 0: Re Σ(ω) = −(λω_E/2) ln|(ω_E + ω)/(ω_E − ω)|, Im Σ = −(πλω_E/2) θ(|ω| − ω_E) − Γ₀; A = −Im Σ/π/[(ω − ε_k − Re Σ)² + Im Σ²], multiplied by the T = 0 Fermi function (ω < 0 only). Instrument resolution and matrix elements are left out. The S-shaped back-bend of the gold line near ħω_E comes from the logarithmic singularity in Re Σ of a single-frequency phonon; the finite width of real phonon spectra smooths it out. In real materials a kink often has more than one possible origin (phonons, magnetic excitations), so interpretation needs care.'),
    draw(s, [cv], c) {
      const p = { v: 1, lam: s.lam, wE: s.wE / 1000, G0: s.G0 / 1000 }, ws = lin(-0.25, 0.03, 140), kk = lin(-0.3, 0.08, 160);
      plot(cv, { x: [-0.3, 0.08], y: [-250, 30], xt: [-0.3, -0.2, -0.1, 0], xf: (t) => (t === 0 ? '0' : String(t).replace('-', '−')), xl: 'k − k_F (Å⁻¹)', yl: L('ω（meV）', 'ω (meV)'), series: [{ xs: kk, ys: kk.map((k) => k * 1000), color: c.muted, dash: [5, 4], label: L('裸能带', 'bare band') }],
        after: ({ ctx, X, Y }) => {
          const A = ws.map((w) => kk.map((k) => (w < 0 ? M.arpesA(k, w, p) : 0))), mx = Math.max(...A.flat()) || 1;
          const dx = (X(kk[1]) - X(kk[0])) + 0.6, dy = Math.abs(Y(ws[1] * 1000) - Y(ws[0] * 1000)) + 0.6;
          ctx.save(); ctx.globalCompositeOperation = 'source-over';
          ws.forEach((w, i) => kk.forEach((k, j) => { const v = (A[i][j] / mx) ** 0.7; if (v < 0.04) return; ctx.globalAlpha = Math.min(1, v); ctx.fillStyle = c.accent; ctx.fillRect(X(k) - dx / 2, Y(w * 1000) - dy / 2, dx, dy); }));
          ctx.globalAlpha = 1; ctx.strokeStyle = c.gold; ctx.lineWidth = 1.8; ctx.beginPath();
          lin(-0.25, -0.0005, 300).forEach((w, i) => { const k = M.arpesPeak(w, p); if (i) ctx.lineTo(X(k), Y(w * 1000)); else ctx.moveTo(X(k), Y(w * 1000)); }); ctx.stroke();
          ctx.strokeStyle = c.danger; ctx.setLineDash([3, 3]); ctx.beginPath(); ctx.moveTo(X(-0.3), Y(-s.wE)); ctx.lineTo(X(0.08), Y(-s.wE)); ctx.stroke(); ctx.setLineDash([]); ctx.restore();
        } });
      return [[L('费米面附近的速度 / 裸速度', 'Velocity near E_F / bare velocity'), fix(1 / (1 + s.lam), 3), true], [L('读出的 λ（= 斜率比 − 1）', 'λ read off (= slope ratio − 1)'), fix(s.lam, 2)], [L('扭折的位置', 'Kink position'), `${s.wE} meV`], [L('扭折以下的额外展宽 πλω_E/2', 'Extra broadening below the kink πλω_E/2'), `${fix((PI * s.lam * s.wE) / 2, 1)} meV`]];
    },
  };
};
