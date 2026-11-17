'use strict';
// 分子动力学与自由能（/md/）的十二个演示。数学都在 md-models.js（纯函数，tools/md-test.mjs 测）。md.js 用 window.MOLASTRIA_MD_DEMOS(K, DEMOS) 把它们登记进去。
// 每个演示：title，kind，intro，sel 下拉 [键, 名字, [[值, 名字]…], 初值]，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，chk 开关 [键, 名字, 初值]，
// btn 预设 [名字, { 键: 值 }]，act 动作，state，autoplay，fps + tick(s)，changed(s, 键)，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 返回读数 [[名字, 值, 是否加粗]]。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。K 是 md.js 给的画图工具。
// 算得慢的结果按参数缓存在 s._cache 里，拖滑块时只有参数真的变了才重算。
window.MOLASTRIA_MD_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_MD_MODELS;
  const { L, fix, fmt, plot, fit, lin, font } = K;
  const cached = (s, key, make) => { s._cache ||= {}; if (s._cache.key !== key) { s._cache = { key, v: make() }; } return s._cache.v; };
  const bars = (hist, color, alpha = 0.55, label) => ({ xs: hist.x, ys: hist.p, bars: hist.x[1] - hist.x[0], color, alpha, base: 0, label });
  const lg = (v) => Math.log10(v);

  // ── 1. 盒子里的 Lennard-Jones 流体 ─────────────────────────────────────
  const N_BOX = 100;
  const boxFresh = (s) => { s.b = M.ljBox(N_BOX, s.rho, s.T, s.seed || 1); s.E0 = (M.ljKinetic(s.b) + s.b.U) / N_BOX; s.msd = [[0, 0]]; s.Th = []; };
  DEMOS.box = {
    title: L('盒子里的一百个原子：从牛顿方程到温度、压强和扩散系数', 'A hundred atoms in a box: from Newton’s equations to temperature, pressure and diffusion'), kind: 'toy',
    intro: L('二维的 Lennard-Jones 流体，周期边界（从右边出去的原子从左边进来）。每一帧算几十步速度 Verlet，从轨迹里现场统计三样东西：动能给出温度，维里给出压强，原子离开起点的均方位移随时间线性增长，斜率就是扩散系数。下面的径向分布函数 g(r) 告诉你，离一个原子 r 远的地方找到另一个原子的概率比完全随机时高多少：第一个峰就是“第一配位层”。把密度调高，液体会变得更有结构、扩散变慢。', 'A two-dimensional Lennard-Jones fluid with periodic boundaries (an atom leaving on the right comes back on the left). Each frame runs a few dozen velocity Verlet steps, and three things are counted from the trajectory on the spot: the kinetic energy gives the temperature, the virial gives the pressure, and the mean squared displacement of the atoms from where they started grows linearly in time with a slope set by the diffusion coefficient. The radial distribution function g(r) below says how much more likely it is to find another atom a distance r away than at random: its first peak is the “first coordination shell”. Raise the density and the liquid becomes more structured and diffuses more slowly.'),
    sel: [['th', L('系综', 'Ensemble'), [['langevin', L('NVT（Langevin 恒温）', 'NVT (Langevin thermostat)')], ['nve', L('NVE（不加恒温器）', 'NVE (no thermostat)')]], 'langevin']],
    ctl: [['rho', L('数密度 ρσ²', 'Number density ρσ²'), 0.2, 0.85, 0.01, 0.6, (v) => v.toFixed(2)], ['T', L('温度 kT/ε', 'Temperature kT/ε'), 0.4, 2, 0.05, 1, (v) => v.toFixed(2)], ['dt', L('时间步 Δt', 'Time step Δt'), 0.001, 0.012, 0.001, 0.005, (v) => v.toFixed(3)]],
    btn: [[L('稀薄的气体', 'Dilute gas'), { rho: 0.2, T: 1.5 }], [L('稠密的液体', 'Dense liquid'), { rho: 0.75, T: 0.8 }], [L('冷了会结晶', 'Cold: crystallises'), { rho: 0.85, T: 0.45 }]],
    act: [[L('重新开始', 'Restart'), (s) => { s.seed = (s.seed || 1) + 1; boxFresh(s); }]],
    state: () => ({ seed: 1 }), autoplay: true, fps: 20,
    changed(s, k) { if (!s.b || k === 'rho' || k === '' || (k === 'T' && s.th === 'nve') || k === 'th') boxFresh(s); else if (k === 'T') s.b.T = s.T; },
    tick(s) {
      M.ljRun(s.b, s.dt, 20, s.th); M.ljSampleGr(s.b);
      s.msd.push([s.b.t, M.ljMSD(s.b)]); if (s.msd.length > 600) s.msd.splice(1, 1);
      s.Th.push(M.ljTemp(s.b)); if (s.Th.length > 200) s.Th.shift();
      return Number.isFinite(s.b.U);
    },
    figs: [[0.62, L('盒子（周期边界）。颜色越亮，原子跑得越快。', 'The box (periodic boundaries). Brighter atoms are moving faster.')], [0.42, L('径向分布函数 g(r)。g = 1 是完全随机。', 'Radial distribution function g(r). g = 1 is completely random.')], [0.42, L('均方位移 ⟨|r(t) − r(0)|²⟩；虚线是 4Dt 的拟合（二维）。', 'Mean squared displacement ⟨|r(t) − r(0)|²⟩; the dashed line is a 4Dt fit (two dimensions).')]],
    note: L('约化单位：ε = σ = m = 1，时间单位 σ√(m/ε)（对氩约 2.2 ps）。势在 2.5σ 处截断并平移。100 个原子，起点是方格子加一点扰动。温度用 kT = K/(N − 1)（质心的两个自由度去掉）。NVE 下温度会自己变：原子从格子“融化”时动能和势能互相转换。扩散系数按 MSD 后半段的斜率除以 4 估计，时间短时误差大。真实的液体是三维的，二维流体的扩散有长时间尾巴（理论上严格的二维扩散系数甚至发散），这里只当作演示。', 'Reduced units: ε = σ = m = 1, time unit σ√(m/ε) (about 2.2 ps for argon). The potential is truncated and shifted at 2.5σ. 100 atoms start on a square lattice with a small perturbation. Temperature is kT = K/(N − 1) (removing the two centre-of-mass degrees of freedom). In NVE the temperature drifts on its own as the lattice “melts” and kinetic and potential energy are exchanged. The diffusion coefficient is the slope of the second half of the MSD divided by 4; it is inaccurate for short runs. Real liquids are three-dimensional; two-dimensional fluids have long-time tails in diffusion (strictly, the 2D diffusion coefficient even diverges), so this is a demonstration only.'),
    draw(s, [bv, gv, mv], c) {
      const b = s.b, { ctx, w, h } = fit(bv), side = Math.min(w - 20, h - 20), ox = (w - side) / 2, oy = (h - side) / 2, sc = side / b.L;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.strokeRect(ox, oy, side, side);
      const v2 = []; for (let i = 0; i < b.N; i++) v2.push(b.v[2 * i] ** 2 + b.v[2 * i + 1] ** 2);
      const vmax = Math.max(1e-9, ...v2);
      for (let i = 0; i < b.N; i++) {
        ctx.globalAlpha = 0.35 + 0.65 * Math.min(1, v2[i] / vmax); ctx.fillStyle = c.accent;
        ctx.beginPath(); ctx.arc(ox + b.x[2 * i] * sc, oy + side - b.x[2 * i + 1] * sc, Math.max(2, 0.5 * sc * 0.95), 0, 2 * Math.PI); ctx.fill();
      }
      ctx.globalAlpha = 1;
      const g = M.ljGr(b), gmax = Math.max(2, ...g.map((q) => q.g)) * 1.1;
      plot(gv, { x: [0, 3], y: [0, gmax], xl: 'r / σ', yl: 'g(r)', series: [{ xs: g.map((q) => q.r), ys: g.map((q) => q.g), color: c.accent, width: 2.2 }], hmarks: [{ y: 1, color: c.muted }] });
      const ms = s.msd, half = ms.slice(Math.floor(ms.length / 2));
      let D = NaN;
      if (half.length > 5) { const mt = M.mean(half.map((q) => q[0])), mm = M.mean(half.map((q) => q[1])); let sxy = 0, sxx = 0; for (const [t, m] of half) { sxy += (t - mt) * (m - mm); sxx += (t - mt) ** 2; } D = sxy / sxx / 4; }
      const tmax = Math.max(1, ms[ms.length - 1][0]), mmax = Math.max(0.5, ...ms.map((q) => q[1])) * 1.1;
      plot(mv, { x: [0, tmax], y: [0, mmax], xl: L('时间 t', 'time t'), yl: 'MSD / σ²', series: [{ pts: ms, color: c.gold, width: 2.2 }, ...(Number.isFinite(D) ? [{ xs: [0, tmax], ys: [0, 4 * D * tmax], color: c.muted, dash: [5, 4] }] : [])] });
      const peak = g.reduce((a, q) => (q.g > a.g ? q : a), { g: 0, r: 0 });
      return [[L('温度 kT/ε（目标 / 现在）', 'Temperature kT/ε (target / now)'), `${fix(s.T, 2)} / ${fix(M.mean(s.Th.length ? s.Th : [M.ljTemp(b)]), 3)}`], [L('压强 Pσ²/ε（维里）', 'Pressure Pσ²/ε (virial)'), fix(M.ljPressure(b), 3)], [L('每个原子的总能量变化', 'Change of total energy per atom'), fmt((M.ljKinetic(b) + b.U) / b.N - s.E0)], [L('扩散系数 D', 'Diffusion coefficient D'), Number.isFinite(D) && b.t > 2 ? fmt(Math.max(0, D)) : L('跑一会儿再看', 'let it run a while'), true], [L('g(r) 第一个峰', 'First peak of g(r)'), `r = ${fix(peak.r, 2)} σ，g = ${fix(peak.g, 2)}`], [L('模拟时间', 'Simulated time'), fix(b.t, 1)]];
    },
  };

  // ── 2. 积分器 ────────────────────────────────────────────────────────
  const METH = [['euler', L('显式欧拉', 'Explicit Euler')], ['symp', L('辛欧拉', 'Symplectic Euler')], ['verlet', L('速度 Verlet', 'Velocity Verlet')], ['rk4', 'RK4']];
  DEMOS.integ = {
    title: L('积分器：为什么分子动力学用 Verlet，而不是更“准”的 RK4', 'Integrators: why molecular dynamics uses Verlet rather than the “more accurate” RK4'), kind: 'exact',
    intro: L('同一个谐振子（或单摆），用四种方法各走同样的时间。显式欧拉的能量指数式增长，轨道向外盘旋；RK4 每一步误差很小，但能量单调地漏掉，跑得越久偏得越远；辛欧拉和速度 Verlet 每一步的误差更大，能量却只在一个窄带里来回晃，永远不漂：它们精确地守恒着一个和真实能量只差 O(Δt²) 的“影子能量”。分子动力学要跑几百万步，要的正是后一种性质。把 Δt 拉过 2，看 Verlet 怎样突然失稳。', 'The same harmonic oscillator (or pendulum) integrated for the same time by four methods. Explicit Euler’s energy grows exponentially and the orbit spirals outwards; RK4 has a tiny error per step, but its energy leaks away steadily and drifts further the longer it runs; symplectic Euler and velocity Verlet have larger errors per step, yet their energy only wobbles in a narrow band and never drifts: they exactly conserve a “shadow energy” that differs from the true energy by O(Δt²). Molecular dynamics runs for millions of steps, and that is exactly the property it needs. Push Δt past 2 to see Verlet suddenly become unstable.'),
    sel: [['sys', L('体系', 'System'), [['harm', L('谐振子 H = p²/2 + x²/2', 'Harmonic oscillator H = p²/2 + x²/2')], ['pend', L('单摆 H = p²/2 + 1 − cos x', 'Pendulum H = p²/2 + 1 − cos x')]], 'harm']],
    ctl: [['h', L('时间步 Δt（周期是 2π ≈ 6.28）', 'Time step Δt (the period is 2π ≈ 6.28)'), 0.02, 2.2, 0.01, 0.3, (v) => v.toFixed(2)], ['T', L('总时间', 'Total time'), 10, 400, 10, 100, String], ['x0', L('初始位移 x₀', 'Initial displacement x₀'), 0.3, 3, 0.05, 1, (v) => v.toFixed(2)]],
    chk: [['euler', L('画显式欧拉', 'Show explicit Euler'), true]],
    btn: [[L('Δt = 0.1', 'Δt = 0.1'), { h: 0.1 }], [L('Δt = 1.9（快失稳）', 'Δt = 1.9 (nearly unstable)'), { h: 1.9, sys: 'harm' }], [L('单摆，接近翻过顶', 'Pendulum near the top'), { sys: 'pend', x0: 2.9, h: 0.2 }]],
    figs: [[0.62, L('相空间 (x, p)：真实的轨道是闭合的曲线。', 'Phase space (x, p): true orbits are closed curves.')], [0.42, L('能量误差 E(t) − E(0)。', 'Energy error E(t) − E(0).')]],
    note: L('力 F = −x（谐振子）或 −sin x（单摆），m = 1。速度 Verlet：p ← p + ½ΔtF，x ← x + Δt p，p ← p + ½ΔtF；每步算一次力（上一步末尾的力可以留着用）。RK4 每步算四次力，所以同样的计算量它只能走四分之一的步数。谐振子的影子能量 H̃ = p²/2 + (1 − Δt²/4)x²/2 是速度 Verlet 的一个精确守恒量（在整数步上），读数里可以看到它守恒到机器精度。Δt ≥ 2 时 Verlet 对谐振子不稳定：分子里最快的振动（如 C–H 伸缩，周期约 11 fs）因此限制了时间步，通常取 0.5–2 fs。', 'Force F = −x (oscillator) or −sin x (pendulum), m = 1. Velocity Verlet: p ← p + ½ΔtF, x ← x + Δt p, p ← p + ½ΔtF; one force evaluation per step (the force at the end of a step is reused). RK4 needs four force evaluations per step, so for the same cost it can take only a quarter as many steps. The oscillator’s shadow energy H̃ = p²/2 + (1 − Δt²/4)x²/2 is an exact conserved quantity of velocity Verlet (at whole steps); the readout shows it conserved to machine precision. For Δt ≥ 2, Verlet is unstable for the oscillator: the fastest vibration in a molecule (C–H stretching, period about 11 fs) therefore limits the time step, typically 0.5–2 fs.'),
    draw(s, [pv, ev], c) {
      const n = Math.min(40000, Math.round(s.T / s.h)), cols = { euler: c.danger, symp: c.info, verlet: c.accent, rk4: c.violet }, R = {};
      for (const [m] of METH) if (m !== 'euler' || s.euler) R[m] = M.integrate(m, s.sys, s.x0, 0, s.h, n);
      const E0 = M.energy(s.sys, s.x0, 0), lim = s.sys === 'pend' ? Math.max(Math.PI, s.x0 * 1.3) : Math.max(1.5, s.x0 * 1.6);
      const thin = (a) => { const k = Math.max(1, Math.floor(a.length / 3000)); return a.filter((_, i) => i % k === 0); };
      const exact = lin(0, 2 * Math.PI, 200);
      plot(pv, { x: [-lim, lim], y: [-lim, lim], eq: true, xl: 'x', yl: 'p', series: [...(s.sys === 'harm' ? [{ xs: exact.map((t) => s.x0 * Math.cos(t)), ys: exact.map((t) => s.x0 * Math.sin(t)), color: c.muted, width: 4, alpha: 0.35 }] : []), ...Object.entries(R).map(([m, r]) => ({ pts: thin(r.xs.map((x, i) => [x, r.ps[i]])), color: cols[m], width: 1.4, label: METH.find((q) => q[0] === m)[1] }))] });
      const errs = Object.fromEntries(Object.entries(R).map(([m, r]) => [m, r.E.map((e) => e - E0)]));
      const span = Math.max(1e-6, ...Object.entries(errs).filter(([m]) => m !== 'euler').flatMap(([, e]) => e.map(Math.abs).filter(Number.isFinite))) * 1.3;
      plot(ev, { x: [0, s.T], y: [-span, span], xl: L('时间', 'time'), yl: 'ΔE', series: Object.entries(errs).map(([m, e]) => ({ pts: thin(e.map((v, i) => [i * s.h, v])), color: cols[m], width: 1.6 })), hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const maxErr = (m) => (R[m] ? (R[m].xs.length < n + 1 ? L('发散了', 'diverged') : fmt(Math.max(...errs[m].map(Math.abs)))) : '—');
      const out = [[L('最大 |ΔE|：显式欧拉', 'Max |ΔE|: explicit Euler'), maxErr('euler')], [L('最大 |ΔE|：辛欧拉', 'Max |ΔE|: symplectic Euler'), maxErr('symp')], [L('最大 |ΔE|：速度 Verlet', 'Max |ΔE|: velocity Verlet'), maxErr('verlet'), true], [L('最大 |ΔE|：RK4（每步 4 次力）', 'Max |ΔE|: RK4 (4 forces per step)'), maxErr('rk4')]];
      if (s.sys === 'harm') {
        const v = R.verlet, H0 = M.shadowHarm(v.xs[0], v.ps[0], s.h), Hn = M.shadowHarm(v.xs[v.xs.length - 1], v.ps[v.ps.length - 1], s.h);
        out.push([L('Verlet 的影子能量 H̃ 变了', 'Change of Verlet’s shadow energy H̃'), v.xs.length < n + 1 ? '—' : fmt(Math.abs(Hn - H0))]);
        out.push([L('Verlet 的数值周期 / 真实周期', 'Verlet’s numerical period / true period'), s.h < 2 ? fix(1 / (M.verletOmega(s.h)), 4) : L('Δt ≥ 2：不稳定', 'Δt ≥ 2: unstable')]);
      }
      return out;
    },
  };

  // ── 3. 恒温器 ────────────────────────────────────────────────────────
  const THERMO = [['none', L('不加（NVE）', 'None (NVE)')], ['berendsen', 'Berendsen'], ['csvr', L('随机速度重标（Bussi）', 'Velocity rescaling (Bussi)')], ['nh', 'Nosé–Hoover'], ['nhc', L('Nosé–Hoover 链（M = 3）', 'Nosé–Hoover chain (M = 3)')], ['langevin', 'Langevin（BAOAB）'], ['andersen', 'Andersen']];
  const thFresh = (s) => { s.st = M.thermoState(s.sys, s.N, s.seed || 1); s.xs = []; s.ps = []; s.Ks = []; };
  DEMOS.thermo = {
    title: L('恒温器：平均温度对了，分布不一定对', 'Thermostats: the right average temperature does not mean the right distribution'), kind: 'exact',
    intro: L('所有恒温器都能把平均温度拉到目标值，区别在涨落。正则系综（NVT）要求每个速度服从麦克斯韦分布、总动能服从一个确定的 Γ 分布。选“一个谐振子”看 Nosé–Hoover 的老问题：它把相空间里的点限制在一个环面上，坐标的分布不对，加成一条链才好；Berendsen 在只有一个自由度时完全失控。选“自由粒子”看全局恒温器的局限：Berendsen 把动能的涨落压成零；只做整体缩放的恒温器（包括 Bussi 的方法）不会改变速度分布的形状，这一步要靠粒子之间的碰撞，而自由粒子之间没有碰撞；Langevin 和 Andersen 逐个粒子加随机力，才把分布本身也调对。', 'Every thermostat pulls the average temperature to the target; they differ in the fluctuations. The canonical ensemble (NVT) requires each velocity to follow a Maxwell distribution and the total kinetic energy a definite Γ distribution. Pick “one harmonic oscillator” to see the classic problem of Nosé–Hoover: it confines the phase-space point to a torus, so the coordinate distribution is wrong, and a chain fixes it; Berendsen runs completely out of control with a single degree of freedom. Pick “free particles” to see the limits of global thermostats: Berendsen squeezes the kinetic-energy fluctuations to zero; thermostats that only rescale all velocities together (including Bussi’s) cannot change the shape of the velocity distribution, which needs collisions between particles, and free particles never collide; Langevin and Andersen add random forces particle by particle and get the distribution itself right.'),
    sel: [['sys', L('体系', 'System'), [['osc', L('一个谐振子', 'One harmonic oscillator')], ['gas', L('N 个自由粒子（一维）', 'N free particles (1D)')]], 'osc'], ['th', L('恒温器', 'Thermostat'), THERMO, 'nh']],
    ctl: [['N', L('粒子数 N（自由粒子）', 'Particles N (free particles)'), 2, 64, 1, 16, String], ['tc', L('耦合时间 τ', 'Coupling time τ'), 0.2, 5, 0.1, 1, (v) => v.toFixed(1)]],
    btn: [[L('谐振子 + Nosé–Hoover', 'Oscillator + Nosé–Hoover'), { sys: 'osc', th: 'nh' }], [L('谐振子 + 链', 'Oscillator + chain'), { sys: 'osc', th: 'nhc' }], [L('自由粒子 + Berendsen', 'Free particles + Berendsen'), { sys: 'gas', th: 'berendsen' }], [L('自由粒子 + Langevin', 'Free particles + Langevin'), { sys: 'gas', th: 'langevin' }]],
    act: [[L('清空统计', 'Clear the statistics'), (s) => { s.seed = (s.seed || 1) + 1; thFresh(s); }]],
    state: () => ({ seed: 1 }), autoplay: true, fps: 15,
    changed(s, k) { if (!s.st || ['', 'sys', 'th', 'N', 'tc'].includes(k)) thFresh(s); },
    tick(s) {
      const o = { tau: s.tc, Q: s.tc * s.tc, gamma: 1 / s.tc, nu: 1 / s.tc };
      for (let i = 0; i < 40; i++) { M.thermoRun(s.st, s.th, 0.05, 5, o); s.xs.push(s.st.x[0]); s.ps.push(...s.st.p); s.Ks.push(M.kin(s.st.p)); }
      const cap = 20000; if (s.Ks.length > cap) { s.Ks.splice(0, s.Ks.length - cap); s.xs.splice(0, s.xs.length - cap); s.ps.splice(0, s.ps.length - cap * s.st.N); }
      return true;
    },
    figs: [[0.6, L('谐振子：相空间 (x, p) 里走过的点，灰色圆圈是 kT 的等能线。自由粒子：所有速度的直方图，灰线是麦克斯韦分布。', 'Oscillator: points visited in phase space (x, p); the grey circle is the contour at energy kT. Free particles: histogram of all velocities; the grey line is the Maxwell distribution.')], [0.42, L('总动能 K 的直方图；灰线是正则系综的 Γ(N/2) 分布。', 'Histogram of the total kinetic energy K; the grey line is the canonical Γ(N/2) distribution.')]],
    note: L('约化单位，kT 目标 = 1，Δt = 0.05，每帧 200 步。耦合时间 τ 对各方法的含义：Berendsen 和 Bussi 的 τ；Nosé–Hoover 的热浴质量 Q = τ²；Langevin 的摩擦 γ = 1/τ；Andersen 的碰撞频率 ν = 1/τ。Nosé–Hoover 和链的积分用 Martyna 等人的分裂写法。谐振子从 x = 1、p = 0 出发；自由粒子每个都从 |p| = 0.7（方向随机）出发，所以全局缩放下速度分布一直是两条尖峰。真实的分子体系里粒子之间有碰撞，全局恒温器也能给出正确的分布；但 Berendsen 的动能涨落仍然偏小，所以现在只建议在平衡前期用它。', 'Reduced units, target kT = 1, Δt = 0.05, 200 steps per frame. What the coupling time τ means for each method: Berendsen’s and Bussi’s τ; Nosé–Hoover’s bath mass Q = τ²; Langevin friction γ = 1/τ; Andersen collision frequency ν = 1/τ. Nosé–Hoover and the chain are integrated with the splitting of Martyna and co-workers. The oscillator starts at x = 1, p = 0; every free particle starts at |p| = 0.7 (random sign), so under global rescaling the velocity distribution stays two sharp spikes. In real molecular systems the particles collide and global thermostats also give the correct distribution, but Berendsen’s kinetic-energy fluctuations remain too small, which is why it is now recommended only for early equilibration.'),
    draw(s, [pv, kv], c) {
      const osc = s.sys === 'osc', N = s.st.N;
      if (osc) {
        const k = Math.max(1, Math.floor(s.xs.length / 4000)), pts = []; for (let i = 0; i < s.xs.length; i += k) pts.push([s.xs[i], s.ps[i]]);
        const ring = lin(0, 2 * Math.PI, 120);
        plot(pv, { x: [-4, 4], y: [-4, 4], eq: true, xl: 'x', yl: 'p', series: [{ pts, dots: 1.3, color: c.accent, alpha: 0.5 }, { xs: ring.map((t) => Math.SQRT2 * Math.cos(t)), ys: ring.map((t) => Math.SQRT2 * Math.sin(t)), color: c.muted, width: 1.5 }] });
      } else {
        const hp = M.histogram(s.ps.length ? s.ps : [0], -4, 4, 60), xs = lin(-4, 4, 200);
        plot(pv, { x: [-4, 4], y: [0, Math.max(0.6, ...hp.p) * 1.1], xl: L('速度 p', 'velocity p'), yl: L('概率密度', 'density'), series: [bars(hp, c.accent), { xs, ys: xs.map((p) => Math.exp(-p * p / 2) / Math.sqrt(2 * Math.PI)), color: c.muted, width: 2 }] });
      }
      const kmax = Math.max(3, N * 1.8), hk = M.histogram(s.Ks.length ? s.Ks : [0], 0, kmax, 50), ks = lin(0.001, kmax, 200), pk = ks.map((x) => M.kinPdf(x, N));
      plot(kv, { x: [0, kmax], y: [0, Math.min(3, Math.max(...pk.filter(Number.isFinite), ...hk.p) * 1.1)], xl: L('总动能 K / kT', 'total kinetic energy K / kT'), yl: L('概率密度', 'density'), series: [bars(hk, c.gold), { xs: ks, ys: pk, color: c.muted, width: 2 }] });
      const p2 = s.ps.length ? M.mean(s.ps.map((p) => p * p)) : NaN, p4 = s.ps.length ? M.mean(s.ps.map((p) => p ** 4)) / (3 * p2 * p2) : NaN, vk = s.Ks.length > 10 ? M.variance(s.Ks) / (N / 2) : NaN;
      const out = [[L('⟨p²⟩（应为 1）', '⟨p²⟩ (should be 1)'), fix(p2, 3)], [L('⟨p⁴⟩ / 3⟨p²⟩²（高斯分布为 1）', '⟨p⁴⟩ / 3⟨p²⟩² (1 for a Gaussian)'), fix(p4, 3), true], [L('动能涨落 Var(K) / (N/2)（应为 1）', 'Kinetic-energy fluctuation Var(K) / (N/2) (should be 1)'), fix(vk, 3), true]];
      if (osc) out.push([L('⟨x²⟩（应为 1）', '⟨x²⟩ (should be 1)'), s.xs.length ? fix(M.mean(s.xs.map((x) => x * x)), 3) : '—']);
      out.push([L('样本数', 'Samples'), String(s.Ks.length)]);
      return out;
    },
  };

  // ── 4. 对势和截断 ──────────────────────────────────────────────────────
  DEMOS.pair = {
    title: L('非键作用：Lennard-Jones 势、截断半径和长程的库仑力', 'Non-bonded interactions: the Lennard-Jones potential, cutoffs and long-range Coulomb forces'), kind: 'exact',
    intro: L('力场里算得最多的是非键作用：每对原子一个 Lennard-Jones 项和一个库仑项。LJ 衰减得快（r⁻⁶），在 r_c 处截掉只丢一点能量，可以用解析的长程修正补回来；但直接截掉会让能量在 r_c 处跳一下，平移以后力还会跳，所以程序里有几种不同的截断方式。库仑能只按 1/r 衰减，截断球外面的贡献根本不小，这就是为什么带电体系要用 Ewald 求和或 PME。', 'Most of the work in a force field is the non-bonded interactions: a Lennard-Jones term and a Coulomb term for every pair of atoms. LJ decays fast (r⁻⁶), so cutting it at r_c loses little energy, which an analytic long-range correction can restore; but a bare cut makes the energy jump at r_c, and shifting the energy still leaves the force jumping, so programs offer several ways to cut. The Coulomb energy decays only as 1/r, the contribution from outside the cutoff sphere is far from small, and that is why charged systems need Ewald summation or PME.'),
    sel: [['mode', L('截断方式', 'Cutoff scheme'), [['cut', L('直接截断', 'Plain truncation')], ['shift', L('能量平移', 'Shifted potential')], ['sf', L('能量和力都平移', 'Shifted force')]], 'cut']],
    ctl: [['rc', L('截断半径 r_c / σ', 'Cutoff r_c / σ'), 1.5, 4, 0.05, 2.5, (v) => v.toFixed(2)], ['rho', L('液体密度 ρσ³（算长程修正）', 'Liquid density ρσ³ (for the tail correction)'), 0.1, 1, 0.01, 0.8, (v) => v.toFixed(2)]],
    btn: [[L('常用：r_c = 2.5σ', 'Common: r_c = 2.5σ'), { rc: 2.5 }], [L('太短：r_c = 1.5σ', 'Too short: r_c = 1.5σ'), { rc: 1.5 }]],
    figs: [[0.5, L('V(r)：灰色虚线是完整的 LJ 势，彩色是截断后的。', 'V(r): the grey dashed line is the full LJ potential, colour the truncated one.')], [0.42, L('力 F(r) = −dV/dr，放大看 r_c 附近。', 'Force F(r) = −dV/dr, magnified near r_c.')], [0.38, L('两种作用随距离衰减得多快：|V(r)| / |V(σ)|，对数坐标。', 'How fast the two interactions decay: |V(r)| / |V(σ)|, logarithmic scale.')]],
    note: L('约化单位 ε = σ = 1。长程修正按三维均匀流体算：U_tail/N = (8/3)πρ[(1/3)(σ/r_c)⁹ − (σ/r_c)³]（g(r) 在 r_c 外取 1）。液氩的 ρσ³ 约 0.8。库仑项按 1/r 画，只为比较衰减速度；真实体系里正负电荷相互抵消一部分，但截断仍然会造成明显的假象（离子分布、介电性质），所以现在几乎总是用 PME。', 'Reduced units ε = σ = 1. The tail correction assumes a uniform three-dimensional fluid: U_tail/N = (8/3)πρ[(1/3)(σ/r_c)⁹ − (σ/r_c)³] (taking g(r) = 1 beyond r_c). Liquid argon has ρσ³ ≈ 0.8. The Coulomb term is drawn as 1/r to compare decay rates only; in real systems positive and negative charges partly cancel, but cutting still causes clear artefacts (ion distributions, dielectric properties), which is why PME is now almost always used.'),
    draw(s, [vv, fv, dv], c) {
      const rs = lin(0.92, 4.2, 500), Vc = rs.map((r) => M.ljCut(r, s.rc, s.mode)), Vf = rs.map((r) => M.lj(r));
      plot(vv, { x: [0.9, 4.2], y: [-1.2, 1.2], xl: 'r / σ', yl: 'V / ε', series: [{ xs: rs, ys: Vf, color: c.muted, dash: [5, 4] }, { xs: rs, ys: Vc, color: c.accent, width: 2.4 }], marks: [{ x: s.rc, color: c.gold }, { x: 2 ** (1 / 6), y: -1, color: c.muted }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const Fc = rs.map((r) => M.ljCutF(r, s.rc, s.mode)), Ff = rs.map((r) => M.ljF(r)), fl = Math.max(0.05, Math.abs(M.ljF(s.rc)) * 3);
      plot(fv, { x: [Math.max(0.9, s.rc - 1.2), Math.min(4.2, s.rc + 0.8)], y: [-fl, fl], xl: 'r / σ', yl: 'F', series: [{ xs: rs, ys: Ff, color: c.muted, dash: [5, 4] }, { xs: rs, ys: Fc, color: c.accent, width: 2.4 }], marks: [{ x: s.rc, color: c.gold }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const ds = lin(1, 20, 200);
      plot(dv, { x: [1, 20], y: [-7, 0.2], logy: true, xl: 'r / σ', series: [{ xs: ds, ys: ds.map((r) => 1 / r), color: c.danger, width: 2.2, label: L('库仑 1/r', 'Coulomb 1/r') }, { xs: ds, ys: ds.map((r) => Math.abs(M.lj(r)) / 1), color: c.accent, width: 2.2, label: 'LJ ∝ r⁻⁶' }], marks: [{ x: s.rc, color: c.gold }] });
      const jumpE = s.mode === 'cut' ? M.lj(s.rc) : 0, jumpF = s.mode === 'sf' ? 0 : M.ljF(s.rc), tail = M.ljTail(s.rho, s.rc);
      return [[L('势阱最低点', 'Bottom of the well'), `r = 2^{1/6}σ = ${fix(2 ** (1 / 6), 4)}σ，V = −ε`], [L('能量在 r_c 处的跳变', 'Energy jump at r_c'), fmt(jumpE)], [L('力在 r_c 处的跳变', 'Force jump at r_c'), fmt(jumpF)], [L('长程修正 U_tail/N（ε）', 'Tail correction U_tail/N (ε)'), fix(tail, 4), true], [L('r_c 处还剩：LJ / 库仑（相对 r = σ）', 'Left at r_c: LJ / Coulomb (relative to r = σ)'), `${fmt(Math.abs(M.lj(s.rc)))} / ${fmt(1 / s.rc)}`]];
    },
  };

  // ── 5. 丁烷的二面角 ────────────────────────────────────────────────────
  DEMOS.torsion = {
    title: L('二面角项：丁烷的反式和旁式各占多少', 'The dihedral term: how much butane is trans and how much gauche'), kind: 'exact',
    intro: L('力场里的二面角项描述绕单键转动的能量。这里用 Ryckaert 和 Bellemans 1975 年为丁烷 C–C–C–C 二面角写的势（GROMACS 至今还带着这种函数形式）：180° 是反式，最低；±60° 附近是两个旁式，高约 3 kJ/mol；0° 是重叠的顺式，最高。概率 P(φ) ∝ exp(−V/RT)：调温度，看两种构象的比例怎样变。', 'The dihedral term of a force field describes the energy of rotating about a single bond. This is the potential Ryckaert and Bellemans wrote in 1975 for butane’s C–C–C–C dihedral (GROMACS still offers this functional form): 180° is trans and lowest; near ±60° are the two gauche minima, about 3 kJ/mol higher; 0° is the eclipsed cis form and highest. The probability is P(φ) ∝ exp(−V/RT): change the temperature and watch the ratio of the two conformers.'),
    ctl: [['T', L('温度 T', 'Temperature T'), 100, 800, 5, 298, (v) => `${v} K`]],
    btn: [[L('室温 298 K', 'Room temperature 298 K'), { T: 298 }], [L('沸点 272.7 K', 'Boiling point 272.7 K'), { T: 273 }], [L('600 K', '600 K'), { T: 600 }]],
    figs: [[0.48, L('二面角势 V(φ)（kJ/mol），φ = 180° 是反式。', 'Dihedral potential V(φ) (kJ/mol); φ = 180° is trans.')], [0.42, L('构象的概率密度 P(φ)，金色是反式的范围（120°–240°）。', 'Probability density of conformations P(φ); gold marks the trans range (120°–240°).')]],
    note: L('V(φ) = Σ Cₙ cosⁿψ，ψ = φ − 180°，C₀ … C₅ = 9.28、12.16、−13.12、−3.06、26.24、−31.5 kJ/mol（Ryckaert–Bellemans 1975，单位按 GROMACS 手册换算）。只有二面角这一项：真实的丁烷还有 1–4 非键作用、键角的弹性和溶剂的影响。实验（气相）给出的旁式比反式高约 2.8–3.8 kJ/mol，取决于测量方法；这个势在设计时就对准了这个范围。', 'V(φ) = Σ Cₙ cosⁿψ, ψ = φ − 180°, with C₀ … C₅ = 9.28, 12.16, −13.12, −3.06, 26.24, −31.5 kJ/mol (Ryckaert–Bellemans 1975, units as in the GROMACS manual). Only the dihedral term is included: real butane also has 1–4 non-bonded interactions, angle flexibility and solvent effects. Experiments (gas phase) put gauche about 2.8–3.8 kJ/mol above trans depending on the method; this potential was designed to fall in that range.'),
    draw(s, [vv, pv], c) {
      const ph = lin(0, 360, 721), V = ph.map(M.torsion), RT = M.R_KJ * s.T, w = V.map((v) => Math.exp(-v / RT)), Z = w.reduce((a, b) => a + b, 0) * 0.5, P = w.map((v) => v / Z);
      const g = M.argmin(M.torsion, 30, 100), barrier = M.torsion(M.argmin((x) => -M.torsion(x), 90, 150));
      plot(vv, { x: [0, 360], y: [0, 50], xt: [0, 60, 120, 180, 240, 300, 360], xf: (t) => `${t}°`, xl: 'φ', yl: 'V (kJ/mol)', series: [{ xs: ph, ys: V, color: c.accent, width: 2.4 }], hmarks: [{ y: RT, color: c.gold }], texts: [{ x: 352, y: RT, s: `RT = ${fix(RT, 2)}`, color: c.gold, align: 'right', dy: -4 }] });
      plot(pv, { x: [0, 360], y: [0, Math.max(...P) * 1.15], xt: [0, 60, 120, 180, 240, 300, 360], xf: (t) => `${t}°`, xl: 'φ', series: [{ xs: ph, ys: P, color: c.accent, width: 2.2, fill: true }], bands: [{ x0: 120, x1: 240, color: c.gold, alpha: 0.12 }] });
      const pop = M.torsionPopulations(s.T);
      return [[L('旁式最低点', 'Gauche minimum'), `φ = ${fix(g, 1)}°，V = ${fix(M.torsion(g), 2)} kJ/mol`], [L('旁式 → 反式的垒（约 120°）', 'Gauche → trans barrier (near 120°)'), `${fix(barrier, 2)} kJ/mol`], [L('顺式（0°）', 'Cis (0°)'), `${fix(M.torsion(0), 1)} kJ/mol`], [L('反式的比例', 'Trans fraction'), `${fix(100 * pop.trans, 1)} %`, true], [L('两个旁式合计', 'Both gauche together'), `${fix(100 * pop.gauche, 1)} %`]];
    },
  };

  // ── 6. 自由能微扰和 BAR ─────────────────────────────────────────────────
  DEMOS.fep = {
    title: L('自由能微扰：只从一边看，为什么常常算不准', 'Free-energy perturbation: why looking from one side is often wrong'), kind: 'exact',
    intro: L('两个态：0 是一个软的谐振子，1 是一个更硬、中心移开 d 的谐振子。精确答案 ΔF = ½ ln(k₁/k₀) 已知。Zwanzig 公式 ΔF = −ln⟨e^{−ΔU}⟩₀ 只用态 0 的样本，但平均值被很少出现的、ΔU 很小的样本主导：如果态 0 很少走到态 1 重要的地方，估计就有偏。反过来从态 1 估计更糟。Bennett 接受率（BAR）同时用两边的样本，在重叠区里取最优的权重，误差小得多。上图里，两个直方图的重叠就是一切。', 'Two states: 0 is a soft harmonic oscillator, 1 a stiffer one whose centre is shifted by d. The exact answer ΔF = ½ ln(k₁/k₀) is known. Zwanzig’s formula ΔF = −ln⟨e^{−ΔU}⟩₀ uses only samples from state 0, but the average is dominated by rare samples with small ΔU: if state 0 seldom visits the places that matter for state 1, the estimate is biased. Estimating from state 1 instead is worse. The Bennett acceptance ratio (BAR) uses samples from both sides with optimal weights in the overlap region and has much smaller errors. In the top figure, the overlap between the two histograms is everything.'),
    ctl: [['lk', L('k₁ / k₀', 'k₁ / k₀'), 0, 1.6, 0.05, 0.6, (v) => fix(10 ** v, 2)], ['d', L('中心移开 d（单位 1/√k₀）', 'Centre shift d (units of 1/√k₀)'), 0, 3, 0.05, 1, (v) => v.toFixed(2)], ['ln', L('每边的样本数', 'Samples on each side'), 1, 4.3, 0.1, 3, (v) => String(Math.round(10 ** v))]],
    btn: [[L('重叠很好', 'Good overlap'), { lk: 0.1, d: 0.3 }], [L('重叠很差', 'Poor overlap'), { lk: 1.3, d: 2.5 }]],
    act: [[L('重新抽样', 'Draw new samples'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.5, L('ΔU = U₁ − U₀ 的分布：蓝色是从态 0 抽的样本，红色是从态 1 抽的。虚线是 P₀(ΔU)·e^{ΔF − ΔU}，按定理它应该和红色重合。', 'Distribution of ΔU = U₁ − U₀: blue from samples of state 0, red from state 1. The dashed line is P₀(ΔU)·e^{ΔF − ΔU}, which by the theorem should coincide with red.')], [0.42, L('估计值随样本数的变化（对数横轴），灰线是精确值。', 'Estimates against the number of samples (logarithmic axis); the grey line is the exact value.')]],
    note: L('kT = 1。态 0：U₀ = k₀x²/2（k₀ = 1）；态 1：U₁ = k₁(x − d)²/2。两边都直接从精确的高斯分布里抽独立样本，所以这里看到的误差全部来自统计和重叠，不来自采样不充分（真实模拟里还要加上相关性）。精确 ΔF = ½ ln(k₁/k₀) 和 d 无关：移开中心不改变配分函数，但会让重叠变差。', 'kT = 1. State 0: U₀ = k₀x²/2 (k₀ = 1); state 1: U₁ = k₁(x − d)²/2. Independent samples are drawn directly from the exact Gaussians on both sides, so all errors seen here come from statistics and overlap, not from inadequate sampling (real simulations add correlations on top). The exact ΔF = ½ ln(k₁/k₀) does not depend on d: moving the centre does not change the partition function, but it does spoil the overlap.'),
    draw(s, [hv, cv], c) {
      const k1 = 10 ** s.lk, n = Math.round(10 ** s.ln), exact = M.harmDF(1, k1);
      const data = cached(s, `${s.lk}|${s.d}|${n}|${s.seed}`, () => { const r = M.rng(s.seed * 7919); const A = M.fepSample(1, 0, n, r), B = M.fepSample(k1, s.d, n, r); return { w0: A.map((x) => M.dU(x, 1, k1, s.d)), w1: B.map((x) => M.dU(x, 1, k1, s.d)) }; });
      const all = [...data.w0, ...data.w1].sort((a, b) => a - b), lo = all[Math.floor(all.length * 0.005)], hi = all[Math.floor(all.length * 0.995)], pad = 0.1 * (hi - lo + 1e-9);
      const h0 = M.histogram(data.w0, lo - pad, hi + pad, 50), h1 = M.histogram(data.w1, lo - pad, hi + pad, 50);
      const pred = h0.p.map((p, i) => p * Math.exp(exact - h0.x[i]));
      plot(hv, { x: [lo - pad, hi + pad], y: [0, Math.max(...h0.p, ...h1.p) * 1.15], xl: 'ΔU / kT', series: [bars(h0, c.info, 0.5, L('从态 0', 'from state 0')), bars(h1, c.danger, 0.5, L('从态 1', 'from state 1')), { xs: h0.x, ys: pred, color: c.ink2, dash: [4, 3], width: 1.6 }], marks: [{ x: exact, color: c.gold }] });
      const ns = []; for (let m = 10; m <= n; m = Math.ceil(m * 1.4)) ns.push(m); if (ns[ns.length - 1] !== n) ns.push(n);
      const est = ns.map((m) => { const a = data.w0.slice(0, m), b = data.w1.slice(0, m); return [M.fepForward(a), M.fepReverse(b), M.bar(a, b)]; });
      const vals = est.flat().filter(Number.isFinite), ylo = Math.min(exact - 0.5, ...vals), yhi = Math.max(exact + 0.5, ...vals);
      plot(cv, { x: [1, Math.max(1.3, lg(n))], y: [Math.max(ylo, exact - 6), Math.min(yhi, exact + 6)], logx: true, xl: L('样本数', 'samples'), yl: 'ΔF', series: [{ xs: ns, ys: est.map((e) => e[0]), color: c.info, width: 2, label: L('正向 FEP', 'forward FEP') }, { xs: ns, ys: est.map((e) => e[1]), color: c.danger, width: 2, label: L('反向 FEP', 'reverse FEP') }, { xs: ns, ys: est.map((e) => e[2]), color: c.accent, width: 2.4, label: 'BAR' }], hmarks: [{ y: exact, color: c.muted, dash: [] }] });
      const last = est[est.length - 1];
      return [[L('精确 ΔF / kT', 'Exact ΔF / kT'), fix(exact, 4), true], [L('正向 FEP（从态 0）', 'Forward FEP (from state 0)'), fix(last[0], 4)], [L('反向 FEP（从态 1）', 'Reverse FEP (from state 1)'), fix(last[1], 4)], ['BAR', fix(last[2], 4), true], [L('ΔU 的标准差（> 2 kT 时 FEP 就危险了）', 'Std. dev. of ΔU (FEP gets risky above 2 kT)'), fix(Math.sqrt(M.variance(data.w0)), 2)]];
    },
  };

  // ── 7. 热力学积分 ───────────────────────────────────────────────────────
  DEMOS.ti = {
    title: L('热力学积分：把 ΔF 拆成一串 λ 窗口，以及为什么要“软核”', 'Thermodynamic integration: splitting ΔF into λ windows, and why “soft cores” are needed'), kind: 'exact',
    intro: L('沿一条路径 U(λ) = (1 − λ)U₀ + λU₁ 从态 0 走到态 1，ΔF = ∫⟨∂U/∂λ⟩_λ dλ。每个 λ 窗口单独跑一段模拟，算出被积函数，再数值积分。被积函数越弯，需要的窗口越多。下图是另一件事：让一个原子“凭空消失”时，如果 LJ 项直接乘 λ，在 λ 接近 0 时别的原子可以压到它身上，r⁻¹² 让被积函数发散；Beutler 等人的软核写法把奇点抹平了。', 'Walk from state 0 to state 1 along the path U(λ) = (1 − λ)U₀ + λU₁; then ΔF = ∫⟨∂U/∂λ⟩_λ dλ. Each λ window is simulated on its own to get the integrand, which is then integrated numerically. The more curved the integrand, the more windows are needed. The lower figure shows something else: when an atom is made to “vanish”, multiplying its LJ term by λ lets other atoms sit on top of it as λ approaches 0, and r⁻¹² makes the integrand diverge; the soft-core form of Beutler and co-workers smooths the singularity away.'),
    ctl: [['lk', L('k₁ / k₀', 'k₁ / k₀'), 0, 2, 0.05, 1, (v) => fix(10 ** v, 1)], ['d', L('中心移开 d', 'Centre shift d'), 0, 3, 0.05, 1, (v) => v.toFixed(2)], ['nw', L('λ 窗口数', 'λ windows'), 2, 21, 1, 5, String], ['lm', L('每个窗口的样本数', 'Samples per window'), 1, 4, 0.1, 2.5, (v) => String(Math.round(10 ** v))], ['sc', L('软核参数 α（下图）', 'Soft-core α (lower figure)'), 0, 1, 0.05, 0.5, (v) => v.toFixed(2)]],
    chk: [['noise', L('被积函数用有限样本估计（有统计误差）', 'Estimate the integrand from finite samples (with noise)'), true]],
    btn: [[L('5 个窗口', '5 windows'), { nw: 5 }], [L('11 个窗口', '11 windows'), { nw: 11 }], [L('k₁ = 100k₀：被积函数很弯', 'k₁ = 100k₀: a very curved integrand'), { lk: 2, d: 0.5 }]],
    act: [[L('重新抽样', 'Draw new samples'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.5, L('被积函数 ⟨∂U/∂λ⟩_λ：灰线是解析的，点是每个窗口的估计，阴影是梯形法积出来的面积。', 'Integrand ⟨∂U/∂λ⟩_λ: the grey line is analytic, dots are each window’s estimate and the shading is the area from the trapezoidal rule.')], [0.42, L('一对原子的 LJ 能量，λ = 0.1、0.3、0.6、1：虚线直接乘 λ，实线是软核。', 'LJ energy of a pair of atoms at λ = 0.1, 0.3, 0.6, 1: dashed lines multiply by λ, solid lines are soft-core.')]],
    note: L('kT = 1，k₀ = 1。线性混合的两个谐振子仍是谐振子，所以每个 λ 的样本可以直接从精确的高斯分布里抽，被积函数也有解析式；积分的精确值等于 ½ ln(k₁/k₀)。软核：V = 4ελ[1/(α(1 − λ) + (r/σ)⁶)² − 1/(α(1 − λ) + (r/σ)⁶)]，α = 0 时退回直接乘 λ。真实的炼金术计算一般先关掉电荷、再关 LJ，每段 10–20 个窗口。', 'kT = 1, k₀ = 1. A linear mix of two harmonic oscillators is again a harmonic oscillator, so samples at each λ can be drawn directly from the exact Gaussian, and the integrand has a closed form; the exact integral is ½ ln(k₁/k₀). Soft core: V = 4ελ[1/(α(1 − λ) + (r/σ)⁶)² − 1/(α(1 − λ) + (r/σ)⁶)]; α = 0 falls back to multiplying by λ. Real alchemical calculations usually switch off the charges first and then the LJ terms, with 10–20 windows per stage.'),
    draw(s, [iv, sv], c) {
      const k1 = 10 ** s.lk, m = Math.round(10 ** s.lm), exact = M.harmDF(1, k1);
      const t = cached(s, `${s.lk}|${s.d}|${s.nw}|${m}|${s.noise}|${s.seed}`, () => M.tiTrapezoid(s.nw, 1, k1, s.d, s.noise ? m : 0, M.rng(s.seed * 104729)));
      const ls = lin(0, 1, 201), y = ls.map((l) => M.tiIntegrand(l, 1, k1, s.d)), all = [...y, ...t.ys], ylo = Math.min(...all), yhi = Math.max(...all), pd = 0.08 * (yhi - ylo + 1e-9);
      plot(iv, { x: [0, 1], y: [ylo - pd, yhi + pd], xl: 'λ', yl: '⟨∂U/∂λ⟩', series: [{ xs: t.ls, ys: t.ys, color: c.accent, fill: true, width: 1.6 }, { xs: ls, ys: y, color: c.muted, width: 2.4 }, { xs: t.ls, ys: t.ys, dots: 4.5, color: c.gold }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const rs = lin(0.02, 2.5, 400), lams = [0.1, 0.3, 0.6, 1], cols = [c.info, c.violet, c.warn, c.accent];
      plot(sv, { x: [0, 2.5], y: [-1.2, 6], xl: 'r / σ', yl: 'V / ε', series: lams.flatMap((l, i) => [{ xs: rs, ys: rs.map((r) => M.softcore(r, l, 0)), color: cols[i], dash: [4, 3], width: 1.4 }, { xs: rs, ys: rs.map((r) => M.softcore(r, l, s.sc)), color: cols[i], width: 2.2, label: `λ = ${l}` }]), hmarks: [{ y: 0, color: c.line, dash: [] }] });
      return [[L('精确 ΔF / kT', 'Exact ΔF / kT'), fix(exact, 4), true], [L(`梯形法（${s.nw} 个窗口）`, `Trapezoid (${s.nw} windows)`), fix(t.dF, 4), true], [L('误差', 'Error'), fmt(t.dF - exact)], [L('总样本数', 'Total samples'), s.noise ? String(s.nw * m) : L('不用样本（解析被积函数）', 'none (analytic integrand)')], [L('λ = 0.1 时 r = 0.3σ 处的能量：直接 / 软核', 'Energy at r = 0.3σ, λ = 0.1: linear / soft-core'), `${fmt(M.softcore(0.3, 0.1, 0))} / ${fmt(M.softcore(0.3, 0.1, s.sc))}`]];
    },
  };

  // ── 8. 伞形采样和 WHAM ─────────────────────────────────────────────────
  DEMOS.umbrella = {
    title: L('伞形采样和 WHAM：用一排弹簧把粒子钉在垒顶上，再把直方图拼起来', 'Umbrella sampling and WHAM: pinning a particle on the barrier with a row of springs, then stitching the histograms'), kind: 'exact',
    intro: L('一个过阻尼的粒子在双阱里：垒高几个 kT，直接模拟时它几乎从不越过垒顶，所以垒顶的概率根本测不准。伞形采样在反应坐标上放一排“窗口”，每个窗口加一根弹簧 k(x − cᵢ)²/2，把粒子拉到原本很少去的地方。每个窗口单独跑一段，得到一个有偏的直方图；WHAM 自洽地求出每个窗口的偏移 fᵢ，把所有直方图拼成一条无偏的自由能曲线。窗口太少、弹簧太硬时，相邻窗口的直方图不重叠，拼接就会出错。', 'An overdamped particle in a double well: with a barrier of several kT, a direct simulation almost never crosses the top, so the probability there cannot be measured. Umbrella sampling puts a row of “windows” along the reaction coordinate, each with a spring k(x − cᵢ)²/2 that pulls the particle where it seldom goes. Each window is run on its own and gives a biased histogram; WHAM solves self-consistently for each window’s offset fᵢ and stitches all histograms into one unbiased free-energy curve. With too few windows or springs that are too stiff, neighbouring histograms do not overlap and the stitching fails.'),
    ctl: [['h', L('垒高 h（kT）', 'Barrier h (kT)'), 2, 10, 0.5, 5, (v) => v.toFixed(1)], ['k', L('弹簧劲度 k', 'Spring constant k'), 5, 200, 1, 40, String], ['nw', L('窗口数', 'Windows'), 3, 30, 1, 14, String], ['ln', L('每个窗口的步数', 'Steps per window'), 2.7, 4.5, 0.05, 4, (v) => String(Math.round(10 ** v))]],
    btn: [[L('合适的设置', 'Sensible settings'), { k: 40, nw: 14, ln: 4 }], [L('窗口太少', 'Too few windows'), { k: 120, nw: 5 }], [L('弹簧太软', 'Springs too soft'), { k: 6, nw: 14 }]],
    act: [[L('重新跑一遍', 'Run again'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.42, L('每个窗口的直方图（颜色按窗口），虚线是窗口中心。', 'Histogram of each window (coloured by window); dashed lines mark the window centres.')], [0.48, L('WHAM 拼出来的自由能（金色）和真实的 F(x) = h(x² − 1)²（灰色）。', 'Free energy stitched by WHAM (gold) and the true F(x) = h(x² − 1)² (grey).')]],
    note: L('kT = 1，扩散系数 D = 1，过阻尼 Langevin（Euler–Maruyama，Δt = 5 × 10⁻⁴），每个窗口先平衡 200 步，然后每 2 步记一个样本，反应坐标的范围 −1.6 到 1.6，WHAM 用 60 个格子、收敛到 10⁻⁸。误差有两个来源：统计（样本少、而且前后相关）和时间步（Δt 有限时采到的分布略宽）。真实体系里反应坐标要自己选，选得不好时，坐标以外的慢变量（比如溶剂、侧链）会让每个窗口都平衡不了。', 'kT = 1, diffusion coefficient D = 1, overdamped Langevin (Euler–Maruyama, Δt = 5 × 10⁻⁴); each window first equilibrates for 200 steps, then a sample is taken every 2 steps; the reaction coordinate runs from −1.6 to 1.6; WHAM uses 60 bins and converges to 10⁻⁸. Errors come from statistics (few samples, correlated in time) and from the time step (a finite Δt samples a slightly broader distribution). In real systems the reaction coordinate has to be chosen by hand, and when it is chosen badly, slow variables outside it (solvent, side chains) keep each window from equilibrating.'),
    draw(s, [hv, fv], c) {
      const n = Math.round(10 ** s.ln);
      const R = cached(s, `${s.h}|${s.k}|${s.nw}|${n}|${s.seed}`, () => { const u = M.umbrellaRun({ h: s.h, k: s.k, nWin: s.nw, n, dt: 5e-4, seed: s.seed * 31 }); return { u, w: M.wham(u.centres, u.samples, u.k, -1.6, 1.6) }; });
      const pal = [c.info, c.accent, c.violet, c.warn, c.danger, c.gold];
      const hs = R.u.samples.map((x) => M.histogram(x, -1.8, 1.8, 90)), top = Math.max(...hs.flatMap((q) => q.p));
      plot(hv, { x: [-1.8, 1.8], y: [0, top * 1.1], xl: L('反应坐标 x', 'reaction coordinate x'), series: hs.map((q, i) => ({ xs: q.x, ys: q.p, color: pal[i % pal.length], width: 1.6, fill: true })), marks: R.u.centres.map((x) => ({ x, color: c.line })) });
      const xs = lin(-1.6, 1.6, 200), tru = xs.map((x) => M.pot.dw(x, s.h));
      plot(fv, { x: [-1.6, 1.6], y: [-0.5, Math.max(s.h + 2, 4)], xl: 'x', yl: 'F / kT', series: [{ xs, ys: tru, color: c.muted, width: 3, alpha: 0.6 }, { xs: R.w.x, ys: R.w.F, color: c.gold, width: 2.4, dots: 2.5, line: true }] });
      const i0 = R.w.x.findIndex((x) => x > 0), Fb = R.w.F[i0 - 1] !== undefined ? 0.5 * (R.w.F[i0 - 1] + R.w.F[i0]) : NaN;
      const errs = R.w.x.map((x, i) => R.w.F[i] - M.pot.dw(x, s.h)).filter(Number.isFinite), m0 = M.mean(errs), rms = Math.sqrt(M.mean(errs.map((e) => (e - m0) ** 2)));
      const empty = R.w.F.filter((v) => !Number.isFinite(v)).length;
      return [[L('垒高：真实 / WHAM', 'Barrier: true / WHAM'), `${fix(s.h, 2)} / ${fix(Fb, 2)}`, true], [L('整条曲线的均方根误差', 'RMS error over the curve'), `${fix(rms, 3)} kT`], [L('WHAM 迭代次数', 'WHAM iterations'), String(R.w.it)], [L('没有样本的格子', 'Bins with no samples'), String(empty)], [L('总步数', 'Total steps'), fmt(s.nw * (n + 200))]];
    },
  };

  // ── 9. 元动力学 ────────────────────────────────────────────────────────
  const mdFresh = (s) => { s.m = M.metadState(s.seed || 1); s.hist = []; };
  DEMOS.metad = {
    title: L('元动力学：往走过的地方倒沙子，把阱填平', 'Metadynamics: pouring sand where you have been until the wells are filled'), kind: 'exact',
    intro: L('粒子在双阱（或三阱）里，垒高好几个 kT，平时被困在一个阱里。元动力学每隔一段时间就在粒子当前所在的位置放一个小高斯“沙堆”：去过的地方越来越高，粒子被逼着去新的地方，直到所有阱被填平、它在整个坐标上自由地走。这时累积的偏置正好是自由能的负值。well-tempered 版本让沙堆越堆越小，偏置平稳收敛到自由能的一部分（乘一个已知的系数）。', 'A particle in a double (or triple) well with barriers of several kT is normally trapped in one well. Metadynamics drops a small Gaussian “pile of sand” at the particle’s current position every so often: places already visited rise, the particle is pushed somewhere new, and once all the wells are filled it roams the whole coordinate freely. The accumulated bias is then exactly the negative of the free energy. The well-tempered version makes the piles ever smaller, and the bias converges smoothly to a known fraction of the free energy.'),
    sel: [['shape', L('势', 'Potential'), [['dw', L('双阱', 'Double well')], ['tw', L('三阱', 'Triple well')]], 'dw']],
    ctl: [['h', L('垒高 h（kT）', 'Barrier h (kT)'), 3, 10, 0.5, 6, (v) => v.toFixed(1)], ['w', L('每个高斯的高度 w（kT）', 'Gaussian height w (kT)'), 0.02, 0.5, 0.01, 0.12, (v) => v.toFixed(2)], ['sig', L('高斯宽度 σ', 'Gaussian width σ'), 0.05, 0.4, 0.01, 0.15, (v) => v.toFixed(2)], ['wt', L('well-tempered 的 ΔT（0 = 普通元动力学）', 'Well-tempered ΔT (0 = plain metadynamics)'), 0, 20, 0.5, 0, (v) => (v ? `${v.toFixed(1)} kT` : L('关', 'off'))]],
    chk: [['on', L('打开偏置', 'Bias on'), true]],
    btn: [[L('普通元动力学', 'Plain metadynamics'), { wt: 0, w: 0.12 }], [L('well-tempered，ΔT = 6', 'Well-tempered, ΔT = 6'), { wt: 6, w: 0.3 }], [L('沙堆太大', 'Piles too big'), { wt: 0, w: 0.5, sig: 0.3 }]],
    act: [[L('重新开始', 'Restart'), (s) => { s.seed = (s.seed || 1) + 1; mdFresh(s); }]],
    state: () => ({ seed: 1 }), autoplay: true, fps: 20,
    changed(s, k) { if (!s.m || ['', 'shape', 'h', 'sig', 'wt'].includes(k)) mdFresh(s); },
    tick(s) {
      M.metadRun(s.m, 400, { shape: s.shape, h: s.h, w: s.w, sigma: s.sig, stride: 100, wt: s.wt, on: s.on });
      s.hist.push([s.m.t, s.m.x]); if (s.hist.length > 700) s.hist.shift();
      return s.m.t < 4000;
    },
    figs: [[0.55, L('灰色是真实的 F(x)，金色是 F + 偏置（粒子实际感受到的），蓝色是 −偏置（对自由能的估计）。圆点是粒子。', 'Grey is the true F(x), gold is F + bias (what the particle actually feels), blue is −bias (the estimate of the free energy). The dot is the particle.')], [0.36, L('粒子的位置 x(t)：被填平以后它在阱之间来回跳。', 'The particle’s position x(t): once the wells are filled it hops between them.')]],
    note: L('kT = 1，D = 1，过阻尼 Langevin，Δt = 2 × 10⁻³，每 100 步放一个高斯，每帧 400 步。双阱 F = h(x² − 1)²；三阱 F = 2h·x²(x² − 1.5)²，三个阱一样深，垒高都是 h。well-tempered 时高斯的高度乘 exp(−V(x)/ΔT)，自由能的估计是 −(1 + kT/ΔT)·V。普通元动力学的偏置不会收敛，只会在真值附近波动，误差和 w 有关；高斯越大，填得越快，越粗糙。真实应用里最难的一步是选集体变量（CV）：漏掉一个慢变量，元动力学就会在它上面“迟滞”。', 'kT = 1, D = 1, overdamped Langevin, Δt = 2 × 10⁻³, one Gaussian every 100 steps, 400 steps per frame. Double well F = h(x² − 1)²; triple well F = 2h·x²(x² − 1.5)², three equally deep wells with barriers h. In well-tempered mode each Gaussian’s height is multiplied by exp(−V(x)/ΔT), and the free-energy estimate is −(1 + kT/ΔT)·V. Plain metadynamics does not converge: the bias fluctuates around the true answer with an error that depends on w; bigger Gaussians fill faster and more roughly. In real applications the hardest step is choosing the collective variables (CVs): miss one slow variable and metadynamics shows hysteresis along it.'),
    draw(s, [fv, tv], c) {
      const m = s.m, F0 = (x) => (s.shape === 'dw' ? M.pot.dw(x, s.h) : M.pot.tw(x, s.h)), est = M.metadF(m, s.wt), xs = est.x;
      const Fx = xs.map(F0), tot = xs.map((x, i) => Fx[i] + m.V[i]), estF = est.F, emin = Math.min(...estF.filter((_, i) => Math.abs(xs[i]) < 1.8));
      const top = Math.max(s.h * 2, ...tot.filter((_, i) => Math.abs(xs[i]) < 1.8)) + 1;
      plot(fv, { x: [-2, 2], y: [-0.5, Math.min(top, s.h * 4)], xl: L('集体变量 x', 'collective variable x'), yl: 'kT', series: [{ xs, ys: Fx, color: c.muted, width: 3, alpha: 0.6 }, { xs, ys: tot, color: c.gold, width: 2 }, { xs, ys: estF.map((v) => v - emin), color: c.info, width: 2, dash: [5, 3] }], marks: [{ x: m.x, y: F0(m.x) + M.biasAt(m, m.x)[0], color: c.accent }] });
      const H = s.hist.length ? s.hist : [[0, m.x]];
      plot(tv, { x: [H[0][0], Math.max(H[0][0] + 1, H[H.length - 1][0])], y: [-2, 2], xl: L('时间', 'time'), yl: 'x', series: [{ pts: H, color: c.accent, width: 1.6 }] });
      const at = (x) => { const i = Math.round((x - M.MG.lo) / ((M.MG.hi - M.MG.lo) / (M.MG.n - 1))); return estF[i]; };
      const barrier = s.shape === 'dw' ? at(0) - Math.min(at(-1), at(1)) : at(Math.sqrt(0.5)) - Math.min(at(0), at(Math.sqrt(1.5)));
      return [[L('时间', 'Time'), fix(m.t, 1)], [L('放下的高斯', 'Gaussians deposited'), String(m.hills)], [L('越过垒顶的次数', 'Barrier crossings'), String(m.cross)], [L('第一次越过的时刻', 'Time of the first crossing'), Number.isFinite(m.firstCross) ? fix(m.firstCross, 1) : '—'], [L('垒高：真实 / 由偏置估计', 'Barrier: true / from the bias'), `${fix(s.h, 1)} / ${m.hills > 20 ? fix(barrier, 2) : '—'}`, true]];
    },
  };

  // ── 10. Jarzynski 和 Crooks ─────────────────────────────────────────────
  DEMOS.jarz = {
    title: L('Jarzynski 等式：拉得再快，e^{−W} 的平均也知道 ΔF', 'The Jarzynski equality: however fast you pull, the average of e^{−W} knows ΔF'), kind: 'exact',
    intro: L('一个光阱（劲度 κ 的弹簧）把粒子从双阱的一边拖到另一边，用时 τ。拉得快，耗散多，每次做的功 W 都比 ΔF 大一截，⟨W⟩ ≥ ΔF 就是第二定律。但 Jarzynski 等式 ⟨e^{−W/kT}⟩ = e^{−ΔF/kT} 精确成立，和拉得多快无关：少数“幸运”的、W 比 ΔF 还小的轨迹，恰好补上了差额。问题在于拉得越快，这样的轨迹越罕见，有限次实验的估计就越偏。打开反向拉，看 Crooks 定理：正向的 P(W) 和反向的 P(−W) 正好在 W = ΔF 处相交。', 'An optical trap (a spring of stiffness κ) drags a particle from one side of a double well to the other in a time τ. Pulled fast, it dissipates more, every work value W overshoots ΔF, and ⟨W⟩ ≥ ΔF is the second law. Yet the Jarzynski equality ⟨e^{−W/kT}⟩ = e^{−ΔF/kT} holds exactly, however fast the pulling: the few “lucky” trajectories with W below ΔF make up the difference. The catch is that the faster the pull, the rarer such trajectories, and the more biased an estimate from a finite number of experiments. Switch on reverse pulling to see the Crooks theorem: the forward P(W) and the reverse P(−W) cross exactly at W = ΔF.'),
    ctl: [['lt', L('拉的时间 τ', 'Pulling time τ'), -1, 1, 0.05, 0, (v) => fix(10 ** v, 2)], ['n', L('轨迹数', 'Trajectories'), 20, 1000, 10, 200, String], ['h', L('双阱的垒高 h（kT）', 'Double-well barrier h (kT)'), 0, 5, 0.25, 3, (v) => v.toFixed(2)], ['kap', L('光阱劲度 κ', 'Trap stiffness κ'), 2, 12, 0.5, 6, (v) => v.toFixed(1)]],
    chk: [['rev', L('也做反向拉（Crooks）', 'Pull in reverse too (Crooks)'), true]],
    btn: [[L('拉得慢：τ = 10', 'Slow: τ = 10'), { lt: 1 }], [L('拉得快：τ = 0.1', 'Fast: τ = 0.1'), { lt: -1 }]],
    act: [[L('重新做一批', 'Run a new batch'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.5, L('功的分布：蓝色是正向（λ 从 −1 到 1.5），红色是反向的 −W。金线是精确的 ΔF。', 'Work distributions: blue is forward (λ from −1 to 1.5), red is minus the reverse work. The gold line is the exact ΔF.')], [0.42, L('估计值随轨迹数的变化：Jarzynski（蓝）、二阶累积量（紫）、⟨W⟩（灰），金线是精确的 ΔF。', 'Estimates against the number of trajectories: Jarzynski (blue), second cumulant (purple), ⟨W⟩ (grey); the gold line is the exact ΔF.')]],
    note: L('kT = 1，D = 1，过阻尼 Langevin，Δt = 2 × 10⁻³。H(x, λ) = h(x² − 1)² + κ(x − λ)²/2，λ 匀速从 −1 变到 1.5（反向时从 1.5 回到 −1）。初始构型从起点 λ 的玻尔兹曼分布精确抽取，这是等式成立的前提。精确 ΔF = −ln[Z(1.5)/Z(−1)] 在 8001 个格点上数值积分。二阶累积量估计 ⟨W⟩ − Var(W)/2 只在功的分布是高斯时精确。BAR 用在正反两组功上（Shirts 等人 2003）通常比单边估计好得多。', 'kT = 1, D = 1, overdamped Langevin, Δt = 2 × 10⁻³. H(x, λ) = h(x² − 1)² + κ(x − λ)²/2, with λ moved at constant speed from −1 to 1.5 (from 1.5 back to −1 in reverse). Initial configurations are drawn exactly from the Boltzmann distribution at the starting λ, which the equality requires. The exact ΔF = −ln[Z(1.5)/Z(−1)] is integrated numerically on 8001 grid points. The second-cumulant estimate ⟨W⟩ − Var(W)/2 is exact only for Gaussian work distributions. BAR applied to the forward and reverse work values (Shirts and co-workers 2003) is usually much better than either one-sided estimate.'),
    draw(s, [hv, cv], c) {
      const tau = 10 ** s.lt, dF = cached(s, `dF|${s.h}|${s.kap}`, () => M.jarzDF(-1, 1.5, s.h, s.kap));
      const R = (s._r && s._r.key === `${s.lt}|${s.n}|${s.h}|${s.kap}|${s.rev}|${s.seed}`) ? s._r : (s._r = { key: `${s.lt}|${s.n}|${s.h}|${s.kap}|${s.rev}|${s.seed}`, F: M.jarzRun({ h: s.h, kap: s.kap, l0: -1, l1: 1.5, tau, n: s.n, seed: s.seed * 13 }), B: s.rev ? M.jarzRun({ h: s.h, kap: s.kap, l0: 1.5, l1: -1, tau, n: s.n, seed: s.seed * 17 + 5 }).map((w) => -w) : [] });
      const all = [...R.F, ...R.B, dF], lo = Math.min(...all), hi = Math.max(...all), pd = 0.08 * (hi - lo + 1e-9);
      const hF = M.histogram(R.F, lo - pd, hi + pd, 45), ser = [bars(hF, c.info, 0.5, L('正向 W', 'forward W'))];
      if (R.B.length) ser.push(bars(M.histogram(R.B, lo - pd, hi + pd, 45), c.danger, 0.45, L('反向 −W', 'reverse −W')));
      plot(hv, { x: [lo - pd, hi + pd], y: [0, Math.max(...hF.p, ...(R.B.length ? M.histogram(R.B, lo - pd, hi + pd, 45).p : [0])) * 1.15], xl: 'W / kT', series: ser, marks: [{ x: dF, color: c.gold }] });
      const ns = []; for (let m = 5; m <= s.n; m = Math.ceil(m * 1.25)) ns.push(m); if (ns[ns.length - 1] !== s.n) ns.push(s.n);
      const je = ns.map((m) => M.jarzEstimate(R.F.slice(0, m))), cu = ns.map((m) => (m > 2 ? M.cumulantEstimate(R.F.slice(0, m)) : NaN)), mw = ns.map((m) => M.mean(R.F.slice(0, m)));
      const ys = [...je, ...cu, ...mw, dF].filter(Number.isFinite);
      plot(cv, { x: [lg(5), lg(Math.max(6, s.n))], y: [Math.min(...ys) - 0.3, Math.max(...ys) + 0.3], logx: true, xl: L('轨迹数', 'trajectories'), yl: 'ΔF / kT', series: [{ xs: ns, ys: mw, color: c.muted, width: 1.8 }, { xs: ns, ys: cu, color: c.violet, width: 1.8 }, { xs: ns, ys: je, color: c.info, width: 2.4 }], hmarks: [{ y: dF, color: c.gold, dash: [] }] });
      const below = R.F.filter((w) => w < dF).length / R.F.length;
      const out = [[L('精确 ΔF / kT', 'Exact ΔF / kT'), fix(dF, 3), true], [L('⟨W⟩（第二定律：≥ ΔF）', '⟨W⟩ (second law: ≥ ΔF)'), fix(M.mean(R.F), 3)], [L('Jarzynski 估计', 'Jarzynski estimate'), fix(M.jarzEstimate(R.F), 3), true], [L('二阶累积量估计', 'Second-cumulant estimate'), fix(M.cumulantEstimate(R.F), 3)], [L('W < ΔF 的轨迹（“违反”第二定律）', 'Trajectories with W < ΔF (“violating” the second law)'), `${fix(100 * below, 1)} %`]];
      if (R.B.length) out.push([L('正反两组功的 BAR', 'BAR on forward and reverse work'), fix(M.bar(R.F, R.B), 3)]);
      return out;
    },
  };

  // ── 11. 马尔可夫态模型 ──────────────────────────────────────────────────
  DEMOS.msm = {
    title: L('马尔可夫态模型：把一条长轨迹切成几个态，读出最慢的时间尺度', 'Markov state models: cutting a long trajectory into a few states and reading off the slowest timescales'), kind: 'exact',
    intro: L('一个粒子在四个阱之间扩散：阱两两成对，对内的垒低，对和对之间的垒高。把坐标切成几个“态”，数一数在滞后时间 τ 内从态 i 跳到态 j 的次数，就得到转移矩阵；它的本征值给出隐含时间尺度 t = −τ / ln λ。只要态切得好、τ 足够长，最慢的时间尺度就不随 τ 变，和精确的答案对得上。把态的边界切到阱底，看隐含时间尺度怎样在短 τ 时严重偏低：这就是“马尔可夫性”不成立的样子。', 'A particle diffuses among four wells that come in pairs: low barriers inside a pair, high barriers between pairs. Cut the coordinate into a few “states”, count the jumps from state i to state j within a lag time τ, and you have the transition matrix; its eigenvalues give the implied timescales t = −τ / ln λ. If the states are cut well and τ is long enough, the slowest timescale stops changing with τ and agrees with the exact answer. Put the state boundaries at the bottoms of the wells and watch the implied timescales come out far too short at small τ: that is what a failure of the Markov property looks like.'),
    sel: [['nS', L('态的个数', 'Number of states'), [['2', '2'], ['4', '4'], ['8', '8'], ['16', '16']], '4'], ['off', L('态的边界', 'State boundaries'), [['0', L('在垒顶（好）', 'On the barrier tops (good)')], ['0.5', L('在阱底（坏）', 'In the well bottoms (bad)')]], '0']],
    ctl: [['h', L('对内的垒高 h（kT）', 'Barrier inside a pair h (kT)'), 1, 3, 0.25, 2, (v) => v.toFixed(2)], ['H', L('对之间多出来的垒 H（kT）', 'Extra barrier between pairs H (kT)'), 0, 4, 0.25, 3, (v) => v.toFixed(2)], ['ltau', L('滞后时间 τ', 'Lag time τ'), -1.7, 0.7, 0.05, -0.3, (v) => fix(10 ** v, 3)], ['T', L('轨迹长度', 'Trajectory length'), 500, 6000, 250, 3000, String]],
    btn: [[L('好的态', 'Good states'), { nS: '4', off: '0' }], [L('坏的态', 'Bad states'), { nS: '4', off: '0.5' }], [L('只分两个态', 'Only two states'), { nS: '2', off: '0' }]],
    act: [[L('换一条轨迹', 'New trajectory'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.42, L('势 U(x)（灰）、态的边界（竖线）；柱子是 MSM 给的平稳分布，金线是玻尔兹曼分布（换算到每个态）。', 'Potential U(x) (grey) and state boundaries (vertical lines); bars are the MSM’s stationary distribution, the gold line the Boltzmann distribution (per state).')], [0.5, L('隐含时间尺度随滞后时间 τ 的变化（对数坐标）：蓝色是最慢的过程，紫色是第二慢的；虚线是精确值，竖线是你选的 τ。灰色区域里 t < τ，那里的数不可信。', 'Implied timescales against lag time τ (log scales): blue is the slowest process, purple the second; dashed lines are exact values and the vertical line is your τ. In the grey region t < τ and the numbers cannot be trusted.')]],
    note: L('kT = 1，D = 1，过阻尼 Langevin（Δt = 4 × 10⁻³），周期边界 [0, 4)，每 5 步存一帧。U = (h/2)(1 + cos 2πx) + (H/2)(1 − cos πx) + ½(1 + cos(πx/2))。转移计数做了对称化（最简单的可逆估计），所以转移矩阵的本征值都是实数。精确的弛豫时间来自把 Smoluchowski 方程放在 120 个格点上求本征值。真实的蛋白质轨迹要先用 TICA 或 VAMPnets 找出慢变量，再聚类成几百到几千个微观态；态的数目、滞后时间的选择都要像这里一样检查。', 'kT = 1, D = 1, overdamped Langevin (Δt = 4 × 10⁻³), periodic boundary on [0, 4), one frame saved every 5 steps. U = (h/2)(1 + cos 2πx) + (H/2)(1 − cos πx) + ½(1 + cos(πx/2)). Transition counts are symmetrised (the simplest reversible estimate), so the eigenvalues of the transition matrix are real. The exact relaxation times come from the eigenvalues of the Smoluchowski equation on 120 grid points. Real protein trajectories first need TICA or VAMPnets to find the slow variables and are then clustered into hundreds or thousands of microstates; the number of states and the lag time must be checked just as here.'),
    draw(s, [uv, tv], c) {
      const nS = Number(s.nS), off = Number(s.off);
      const ex = cached(s, `ex|${s.h}|${s.H}`, () => M.msmExact(s.h, s.H));
      const tr = (s._t && s._t.key === `${s.h}|${s.H}|${s.T}|${s.seed}`) ? s._t : (s._t = { key: `${s.h}|${s.H}|${s.T}|${s.seed}`, v: M.msmTraj({ h: s.h, H: s.H, T: s.T, seed: s.seed * 3 }) });
      const traj = tr.v, d = (s._d && s._d.key === `${tr.key}|${nS}|${off}`) ? s._d : (s._d = { key: `${tr.key}|${nS}|${off}`, v: M.discretize(traj.x, nS, off) });
      const tau = 10 ** s.ltau, lagOf = (t) => Math.max(1, Math.round(t / traj.dt));
      const taus = lin(-1.7, 0.7, 25).map((v) => 10 ** v), its = taus.map((t) => { const e = M.msmEstimate(d.v, nS, lagOf(t)); return e ? [M.impliedTimescale(e.values[1], lagOf(t) * traj.dt), nS > 2 ? M.impliedTimescale(e.values[2], lagOf(t) * traj.dt) : NaN] : [NaN, NaN]; });
      const est = M.msmEstimate(d.v, nS, lagOf(tau));
      const xs = lin(0, 4, 300), U = xs.map((x) => M.msmU(x, s.h, s.H)), Umax = Math.max(...U);
      const w = 4 / nS, edges = Array.from({ length: nS }, (_, i) => ((i + off) * w) % 4);
      const boltz = Array.from({ length: nS }, (_, i) => { let z = 0; for (let k = 0; k < ex.pi.length; k++) { const x = ((k + 0.5) * 4) / ex.pi.length, u = ((((x / 4) * nS - off) % nS) + nS) % nS; if (Math.floor(u) === i) z += ex.pi[k]; } return z; });
      const centre = (i) => (((i + 0.5 + off) * w) % 4);
      const pmax = Math.max(...boltz, ...(est ? est.pi : [0]));
      plot(uv, { x: [0, 4], y: [0, Umax * 1.1], xl: 'x', yl: 'U / kT', series: [{ xs, ys: U, color: c.muted, width: 2.6 }, ...(est ? [{ xs: est.pi.map((_, i) => centre(i)), ys: est.pi.map((p) => (p / pmax) * Umax * 0.9), bars: w * 0.8, color: c.accent, alpha: 0.35, base: 0 }] : []), { xs: boltz.map((_, i) => centre(i)), ys: boltz.map((p) => (p / pmax) * Umax * 0.9), dots: 4, color: c.gold }], marks: edges.map((x) => ({ x, color: c.line })) });
      const ys = [...its.flat(), ex.times[0], ex.times[1]].filter((v) => Number.isFinite(v) && v > 0);
      const ylo = Math.min(-1.8, ...ys.map(lg)) - 0.1, yhi = Math.max(...ys.map(lg)) + 0.3;
      plot(tv, { x: [-1.7, 0.7], y: [ylo, yhi], logx: true, logy: true, xl: L('滞后时间 τ', 'lag time τ'), yl: L('隐含时间尺度', 'implied timescale'), series: [{ xs: taus, ys: taus, color: c.muted, fill: true, alpha: 0.25, width: 1 }, { xs: taus, ys: its.map((q) => q[0]), color: c.info, width: 2.4, dots: 3, line: true }, ...(nS > 2 ? [{ xs: taus, ys: its.map((q) => q[1]), color: c.violet, width: 2, dots: 3, line: true }] : []), { xs: [taus[0], taus[taus.length - 1]], ys: [ex.times[0], ex.times[0]], color: c.info, dash: [5, 4], width: 1.4 }, ...(nS > 2 ? [{ xs: [taus[0], taus[taus.length - 1]], ys: [ex.times[1], ex.times[1]], color: c.violet, dash: [5, 4], width: 1.4 }] : [])], marks: [{ x: s.ltau, color: c.gold }] });
      const t1 = est ? M.impliedTimescale(est.values[1], lagOf(tau) * traj.dt) : NaN, t2 = est && nS > 2 ? M.impliedTimescale(est.values[2], lagOf(tau) * traj.dt) : NaN;
      return [[L('最慢的过程：精确 / MSM', 'Slowest process: exact / MSM'), `${fix(ex.times[0], 2)} / ${fix(t1, 2)}`, true], [L('第二慢：精确 / MSM', 'Second slowest: exact / MSM'), `${fix(ex.times[1], 3)} / ${nS > 2 ? fix(t2, 3) : '—'}`], [L('τ 下的转移数', 'Transitions counted at τ'), fmt(d.v.length - lagOf(tau))], [L('最慢过程在这条轨迹里大约发生了', 'The slowest process happens in this trajectory about'), L(`${fix(s.T / ex.times[0], 0)} 次`, `${fix(s.T / ex.times[0], 0)} times`)]];
    },
  };

  // ── 12. 误差估计 ───────────────────────────────────────────────────────
  DEMOS.blocks = {
    title: L('误差棒：前后相关的数据，不能当成独立样本', 'Error bars: correlated data are not independent samples'), kind: 'exact',
    intro: L('分子动力学的每一帧都和上一帧很像。如果把 n 帧当成 n 个独立样本，均值的误差会被严重低估。分块平均（Flyvbjerg–Petersen）把相邻的数据两两平均、一次次把块变大：块比相关时间长以后，块与块之间近似独立，估计出来的标准误就停在一个平台上，那才是真正的误差。这里的数据是一个相关时间已知的 AR(1) 过程，可以和精确答案比。', 'Every frame of a molecular dynamics run looks a lot like the one before. Treat n frames as n independent samples and the error of the mean is badly underestimated. Block averaging (Flyvbjerg–Petersen) averages neighbouring data in pairs, making the blocks bigger and bigger: once blocks are longer than the correlation time, they are nearly independent and the estimated standard error levels off on a plateau, which is the real error. The data here are an AR(1) process with a known correlation time, so the result can be compared with the exact answer.'),
    ctl: [['lt', L('相关时间 τ（步）', 'Correlation time τ (steps)'), 0, 2.5, 0.05, 1.3, (v) => fix(10 ** v, 1)], ['ln', L('数据点数 n = 2^k', 'Data points n = 2^k'), 10, 18, 1, 15, (v) => `2^${v} = ${2 ** v}`]],
    btn: [[L('几乎不相关', 'Almost uncorrelated'), { lt: 0 }], [L('τ = 100 步', 'τ = 100 steps'), { lt: 2 }], [L('数据太短', 'Too little data'), { lt: 2.3, ln: 11 }]],
    act: [[L('换一组数据', 'New data'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.36, L('时间序列的前 2000 个点。', 'The first 2000 points of the time series.')], [0.46, L('分块以后的标准误（带误差棒）随块长的变化；红线是天真的 σ/√n，金线是精确值。', 'Standard error after blocking (with error bars) against block length; red is the naive σ/√n, gold is the exact value.')]],
    note: L('x_t = φx_{t−1} + √(1 − φ²)ξ_t，φ = e^{−1/τ}，方差为 1。n 很大时均值的精确标准误是 √[(1 + φ)/((1 − φ)n)] ≈ √(2τ/n)，也就是有效样本数约 n/(2τ)。积分自相关时间按自相关函数求和到第一次变负为止。块太长时剩下的块太少，估计本身的误差变大（误差棒变长）。平衡前的那一段也要扔掉：Chodera 2016 给了一个自动判断从哪里开始算的方法。', 'x_t = φx_{t−1} + √(1 − φ²)ξ_t with φ = e^{−1/τ} and unit variance. For large n the exact standard error of the mean is √[(1 + φ)/((1 − φ)n)] ≈ √(2τ/n), i.e. about n/(2τ) effective samples. The integrated autocorrelation time sums the autocorrelation function until it first turns negative. With very long blocks too few remain, and the estimate itself becomes noisy (longer error bars). The part before equilibration must also be discarded: Chodera 2016 gives an automatic way to decide where to start.'),
    draw(s, [xv, bv], c) {
      const tau = 10 ** s.lt, n = 2 ** s.ln;
      const R = cached(s, `${s.lt}|${s.ln}|${s.seed}`, () => { const x = M.ar1(n, tau, s.seed * 101); return { x, b: M.blocking(x), ti: M.tauInt(x), sd: Math.sqrt(M.variance(Array.from(x))), m: M.mean(Array.from(x)) }; });
      const show = Array.from(R.x.slice(0, 2000));
      plot(xv, { x: [0, show.length], y: [-4, 4], xl: L('步', 'step'), series: [{ xs: show.map((_, i) => i), ys: show, color: c.accent, width: 1 }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const exact = M.ar1Error(n, tau), naive = R.sd / Math.sqrt(n), ks = R.b.map((q) => Math.log2(q.size));
      const top = Math.max(exact, ...R.b.map((q) => q.se + q.err)) * 1.25;
      plot(bv, { x: [-0.3, Math.max(1, ks[ks.length - 1] + 0.3)], y: [0, top], xt: ks.filter((k) => k % 2 === 0), xf: (t) => `2^${t}`, xl: L('块长（步）', 'block length (steps)'), yl: L('均值的标准误', 'std. error of the mean'), series: [{ xs: ks, ys: R.b.map((q) => q.se), dots: 4, color: c.accent, line: true, width: 2 }], hmarks: [{ y: exact, color: c.gold, dash: [] }, { y: naive, color: c.danger }], after: ({ ctx, X, Y }) => { ctx.strokeStyle = c.accent; ctx.lineWidth = 1.2; R.b.forEach((q, i) => { ctx.beginPath(); ctx.moveTo(X(ks[i]), Y(q.se - q.err)); ctx.lineTo(X(ks[i]), Y(q.se + q.err)); ctx.stroke(); }); } });
      const plateau = R.b.filter((q) => q.size >= 4 * tau && q.n >= 32).map((q) => q.se), pl = plateau.length ? M.mean(plateau) : NaN;
      return [[L('天真的 σ/√n', 'Naive σ/√n'), fmt(naive)], [L('分块的平台', 'Blocking plateau'), Number.isFinite(pl) ? fmt(pl) : L('数据不够长，没有平台', 'too little data for a plateau'), true], [L('精确的标准误', 'Exact standard error'), fmt(exact), true], [L('积分自相关时间 τ_int', 'Integrated autocorrelation time τ_int'), fix(R.ti, 1)], [L('有效样本数 n / 2τ_int', 'Effective samples n / 2τ_int'), fmt(n / (2 * R.ti))]];
    },
  };
};
