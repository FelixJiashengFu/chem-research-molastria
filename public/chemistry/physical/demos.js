'use strict';
// 化学学科馆 03 · 物理化学的五个演示：Maxwell–Boltzmann 速率分布、van der Waals 等温线、合成氨的平衡、连续反应、转动能级布居。数学在 ../chem-models.js。
(window.MOLASTRIA_CHEM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, fix, pct, plot, table } = K;

  // ── Maxwell–Boltzmann ───────────────────────────────────────────────────
  const GAS = { H2: [2.016, 'H₂'], He: [4.003, 'He'], H2O: [18.015, 'H₂O'], N2: [28.014, 'N₂'], O2: [31.998, 'O₂'], CO2: [44.009, 'CO₂'], Xe: [131.29, 'Xe'], UF6: [352.02, 'UF₆'] };
  D.maxwell = {
    kind: 'exact',
    title: ['气体分子有多快：Maxwell–Boltzmann 速率分布', 'How fast gas molecules move: the Maxwell–Boltzmann distribution'],
    intro: ['选两种气体、调温度，比较它们的速率分布和三种特征速率。', 'Pick two gases and a temperature to compare their speed distributions and three characteristic speeds.'],
    sel: [['g1', ['气体 1', 'Gas 1'], Object.entries(GAS).map(([k, v]) => [k, [v[1], v[1]]]), 'N2'], ['g2', ['气体 2', 'Gas 2'], Object.entries(GAS).map(([k, v]) => [k, [v[1], v[1]]]), 'He']],
    ctl: [['T', ['温度', 'Temperature'], 50, 2000, 10, 298, (v) => `${v} K`]],
    btn: [[['室温 N₂ 对 He', 'N₂ vs He at room temperature'], { g1: 'N2', g2: 'He', T: 298 }], [['铀浓缩：UF₆ 很慢', 'Uranium enrichment: slow UF₆'], { g1: 'UF6', g2: 'N2', T: 330 }], [['火焰温度 2000 K', 'Flame temperature, 2000 K'], { T: 2000 }]],
    figs: [[0.5, ['速率分布 f(v)。竖线是最可几、平均、方均根速率（只标气体 1）。', 'Speed distribution f(v). Vertical lines: most probable, mean and rms speeds (gas 1 only).']]],
    note: ['理想气体、经典力学的精确结果。摩尔质量用 IUPAC 标准原子量算出（编者录入）。它说明了为什么扩散和泄流的速率与 √M 成反比（Graham 定律），以及为什么 UF₆ 的两种同位素分子速率只差 0.4 %，气体扩散浓缩要串联上千级。', 'The exact result for an ideal gas in classical mechanics. Molar masses use IUPAC standard atomic weights (typed by the editor). It shows why diffusion and effusion rates go as 1/√M (Graham’s law), and why the two isotopic UF₆ molecules differ in speed by only 0.4 %, so gaseous-diffusion enrichment needs over a thousand stages in series.'],
    draw(s, f, c) {
      const m1 = GAS[s.g1][0] / 1000, m2 = GAS[s.g2][0] / 1000, sp1 = M.speeds(m1, s.T), sp2 = M.speeds(m2, s.T);
      const vmax = Math.max(sp1.rms, sp2.rms) * 2.6, vs = K.lin(0, vmax, 300), y1 = vs.map((v) => M.mb(v, m1, s.T) * 1000), y2 = vs.map((v) => M.mb(v, m2, s.T) * 1000);
      plot(f[0], { x: [0, vmax], y: [0, Math.max(...y1, ...y2) * 1.15], xl: 'v / m s⁻¹', yl: 'f(v) / 10⁻³ s m⁻¹', series: [{ xs: vs, ys: y1, color: c.accent, width: 2.4, fill: true, label: GAS[s.g1][1] }, { xs: vs, ys: y2, color: c.info, width: 2.4, label: GAS[s.g2][1] }], marks: [{ x: sp1.mp, color: c.gold }, { x: sp1.mean, color: c.muted }, { x: sp1.rms, color: c.danger }] });
      const r = (sp) => `${fix(sp.mp, 0)} / ${fix(sp.mean, 0)} / ${fix(sp.rms, 0)}`;
      return [[[`${GAS[s.g1][1]}：最可几 / 平均 / 方均根`, `${GAS[s.g1][1]}: most probable / mean / rms`], `${r(sp1)} m/s`, 1], [[`${GAS[s.g2][1]}：最可几 / 平均 / 方均根`, `${GAS[s.g2][1]}: most probable / mean / rms`], `${r(sp2)} m/s`], [['平均速率之比', 'Ratio of mean speeds'], `${fix(sp2.mean / sp1.mean, 3)} = √(M₁/M₂)`]];
    },
  };

  // ── van der Waals ───────────────────────────────────────────────────────
  // a（L² bar mol⁻²）、b（L/mol），CRC 手册常引的数值（编者录入）
  const VDW = { CO2: [3.640, 0.04267, 'CO₂'], N2: [1.370, 0.0387, 'N₂'], H2O: [5.536, 0.03049, 'H₂O'], He: [0.0346, 0.0238, 'He'], CH4: [2.283, 0.04278, 'CH₄'] };
  D.vdw = {
    kind: 'model',
    title: ['van der Waals 等温线和临界点', 'Van der Waals isotherms and the critical point'],
    intro: ['调温度，看等温线怎样在临界温度以下出现回弯（气液共存），以上变得单调。', 'Change the temperature to see the isotherm develop a loop below the critical temperature (gas–liquid coexistence) and turn monotonic above it.'],
    sel: [['gas', ['气体', 'Gas'], Object.entries(VDW).map(([k, v]) => [k, [v[2], v[2]]]), 'CO2']],
    ctl: [['t', ['温度 / 临界温度', 'Temperature / critical temperature'], 0.8, 1.4, 0.01, 0.92, (v) => `T = ${fix(v, 2)} T_c`]],
    btn: [[['临界温度', 'At T_c'], { t: 1 }], [['回弯明显', 'A clear loop'], { t: 0.85 }], [['超临界', 'Supercritical'], { t: 1.2 }]],
    figs: [[0.55, ['p 对 V_m。实线是 van der Waals，虚线是同温度的理想气体，金色点是临界点。', 'p against V_m. Solid: van der Waals; dashed: ideal gas at the same temperature; gold dot: the critical point.']]],
    note: ['van der Waals 方程定性正确、定量粗糙：它预言所有气体的临界压缩因子都是 0.375（实测约 0.23–0.31）。T < T_c 时曲线中间上升的一段（∂p/∂V > 0）力学上不稳定，真实体系在那里分成气液两相，压强沿一条 Maxwell 等面积线保持不变（这里没有画）。a、b 取自 CRC 手册常引的数值，由编者录入。', 'The van der Waals equation is qualitatively right and quantitatively rough: it predicts a critical compression factor of 0.375 for every gas (measured about 0.23–0.31). For T < T_c the rising middle section (∂p/∂V > 0) is mechanically unstable; a real system splits into gas and liquid there at a constant pressure given by Maxwell’s equal-area line (not drawn). a and b are commonly quoted CRC Handbook values typed in by the editor.'],
    draw(s, f, c) {
      const [a, b, nm] = VDW[s.gas], cr = M.vdwCrit(a, b), T = s.t * cr.Tc, Vs = K.lin(b * 1.25, cr.Vc * 8, 400), ps = Vs.map((V) => M.vdwP(V, T, a, b)), pid = Vs.map((V) => (M.Rbar * T) / V);
      plot(f[0], { x: [0, cr.Vc * 8], y: [0, cr.pc * 2.2], xl: 'V_m / L mol⁻¹', yl: 'p / bar', series: [{ xs: Vs, ys: pid, color: c.muted, dash: [5, 4], width: 1.4 }, { xs: Vs, ys: ps, color: c.accent, width: 2.4 }], marks: [{ x: cr.Vc, y: cr.pc, color: c.gold }] });
      let loop = false; for (let i = 1; i < ps.length; i++) if (ps[i] > ps[i - 1] + 1e-9) { loop = true; break; }
      return [[[`${nm} 的临界温度`, `Critical temperature of ${nm}`], `${fix(cr.Tc, 1)} K`, 1], [['临界压强', 'Critical pressure'], `${fix(cr.pc, 1)} bar`], [['临界摩尔体积 3b', 'Critical molar volume 3b'], `${fix(cr.Vc * 1000, 1)} cm³/mol`], [['当前温度', 'Current temperature'], `${fix(T, 1)} K`], [['等温线有回弯（两相区）', 'Isotherm has a loop (two-phase)'], loop ? L('有', 'yes') : L('没有', 'no'), 1]];
    },
  };

  // ── 合成氨 ──────────────────────────────────────────────────────────────
  D.haber = {
    kind: 'model',
    title: ['合成氨：温度和压强的拉锯', 'Ammonia synthesis: temperature against pressure'],
    intro: ['调温度和压强，看平衡常数和平衡时氨的摩尔分数（原料 N₂ : H₂ = 1 : 3）。', 'Set temperature and pressure to see the equilibrium constant and the equilibrium mole fraction of ammonia (feed N₂ : H₂ = 1 : 3).'],
    ctl: [['T', ['温度', 'Temperature'], 300, 1000, 5, 673, (v) => `${v} K（${v - 273} °C）`], ['p', ['总压', 'Total pressure'], 1, 400, 1, 200, (v) => `${v} bar`]],
    chk: [['cp', ['计入热容修正（ΔC_p = −45.5 J/(mol K)）', 'Include the heat-capacity correction (ΔC_p = −45.5 J/(mol K))'], true]],
    btn: [[['工业条件 400 °C、200 bar', 'Industrial: 400 °C, 200 bar'], { T: 673, p: 200 }], [['常压 400 °C', '1 bar, 400 °C'], { T: 673, p: 1 }], [['500 °C、300 bar', '500 °C, 300 bar'], { T: 773, p: 300 }]],
    figs: [[0.55, ['平衡时 NH₃ 的摩尔分数对温度，四条线是四个压强；金色点是当前条件。', 'Equilibrium NH₃ mole fraction against temperature at four pressures; the gold dot is the current condition.']]],
    note: ['理想气体；ΔH° = −92.2 kJ/mol、ΔS° = −198.1 J/(mol K)（298 K 标准值），打开热容修正时按 298 K 的 C_p 差值做 Kirchhoff 修正。这样算出的 K(400 °C) ≈ 1.6 × 10⁻⁴，与教科书常引的值一致；不修正会高估约 4 倍。高压下真实气体的逸度系数不等于 1，这里没算，所以 200 bar 以上的结果只能看趋势。热力学数据由编者录入，未逐条核对 NIST 表。', 'Ideal gases; ΔH° = −92.2 kJ/mol and ΔS° = −198.1 J/(mol K) (standard values at 298 K), with a Kirchhoff correction from the 298 K heat-capacity difference when the box is ticked. This gives K(400 °C) ≈ 1.6 × 10⁻⁴, matching the commonly quoted textbook value; without the correction K is about four times too high. Real-gas fugacity coefficients differ from 1 at high pressure and are not included, so results above 200 bar show trends only. Thermodynamic data were typed by the editor and not checked line by line against the NIST tables.'],
    draw(s, f, c) {
      const cp = s.cp ? -45.5 : 0, Ts = K.lin(450, 1000, 111), P = [1, 50, 200, 400], cols = [c.muted, c.info, c.accent, c.violet || c.danger];
      plot(f[0], { x: [450, 1000], y: [0, 100], xl: 'T / K', yl: L('NH₃ 摩尔分数 / %', 'NH₃ mole fraction / %'), series: P.map((p, i) => ({ xs: Ts, ys: Ts.map((t) => 100 * M.haber(t, p, cp).y), color: cols[i], width: 2, label: `${p} bar` })), marks: [{ x: s.T, y: 100 * M.haber(s.T, s.p, cp).y, color: c.gold }] });
      const h = M.haber(s.T, s.p, cp), dG = (-M.R * s.T * h.lnK) / 1000;
      return [[['ΔG°(T)', 'ΔG°(T)'], `${fix(dG, 1)} kJ/mol`], [['平衡常数 K', 'Equilibrium constant K'], fmt(h.K, 3), 1], [['N₂ 的转化率', 'N₂ conversion'], pct(h.xi)], [['平衡时 NH₃ 的摩尔分数', 'Equilibrium NH₃ mole fraction'], pct(h.y), 1]];
    },
  };

  // ── 连续反应 ────────────────────────────────────────────────────────────
  D.consecutive = {
    kind: 'exact',
    title: ['连续反应 A → B → C：中间体什么时候最多', 'Consecutive reactions A → B → C: when the intermediate peaks'],
    intro: ['调两个速率常数，看三种物质的浓度随时间变化和中间体的峰。', 'Set the two rate constants to see the three concentrations over time and the peak of the intermediate.'],
    ctl: [['lk1', ['k₁（对数）', 'k₁ (log scale)'], -2, 1, 0.05, 0, (v) => `${fmt(10 ** v, 3)} s⁻¹`], ['lk2', ['k₂（对数）', 'k₂ (log scale)'], -2, 1, 0.05, -0.5, (v) => `${fmt(10 ** v, 3)} s⁻¹`]],
    btn: [[['k₂ ≫ k₁：B 很少（稳态）', 'k₂ ≫ k₁: little B (steady state)'], { lk1: -1, lk2: 1 }], [['k₁ ≫ k₂：B 积累', 'k₁ ≫ k₂: B accumulates'], { lk1: 1, lk2: -1 }], [['k₁ = k₂', 'k₁ = k₂'], { lk1: 0, lk2: 0 }]],
    figs: [[0.5, ['[A]、[B]、[C] 对时间（[A]₀ = 1）。竖线是 B 的峰值时间。', '[A], [B] and [C] against time ([A]₀ = 1). The vertical line marks the peak of B.']]],
    note: ['两个一级步骤的精确解析解；k₁ = k₂ 时用极限形式 [B] = k t e^(−kt)。当 k₂ ≫ k₁ 时 [B] 一直很小且近似 k₁[A]/k₂，这就是稳态近似成立的条件；此时 C 的生成速率由第一步决定（决速步）。', 'The exact analytic solution for two first-order steps; for k₁ = k₂ the limiting form [B] = k t e^(−kt) is used. When k₂ ≫ k₁, [B] stays small and close to k₁[A]/k₂, the condition for the steady-state approximation; C then forms at the rate of the first step (the rate-limiting step).'],
    draw(s, f, c) {
      const k1 = 10 ** s.lk1, k2 = 10 ** s.lk2, tm = M.tmaxB(k1, k2), tEnd = Math.min(400, 6 / Math.min(k1, k2)), ts = K.lin(0, tEnd, 400), r = ts.map((t) => M.consecutive(k1, k2, t));
      plot(f[0], { x: [0, tEnd], y: [0, 1.05], xl: 't / s', yl: L('浓度', 'concentration'), series: [{ xs: ts, ys: r.map((x) => x.A), color: c.muted, width: 2, label: 'A' }, { xs: ts, ys: r.map((x) => x.B), color: c.gold, width: 2.6, label: 'B' }, { xs: ts, ys: r.map((x) => x.C), color: c.accent, width: 2, label: 'C' }], marks: [{ x: tm, y: M.consecutive(k1, k2, tm).B, color: c.gold }] });
      const ss = k1 / k2;
      return [[['B 的峰值时间', 'Peak time of B'], `${fmt(tm, 3)} s`, 1], [['[B] 的最大值', 'Maximum [B]'], fix(M.consecutive(k1, k2, tm).B, 3), 1], [['k₁/k₂', 'k₁/k₂'], fmt(ss, 3)], [['稳态近似可用吗', 'Steady state usable?'], ss < 0.1 ? L('可以（k₂ ≫ k₁）', 'yes (k₂ ≫ k₁)') : L('不太行', 'not really')]];
    },
  };

  // ── 转动能级布居 ────────────────────────────────────────────────────────
  // 转动常数 B̃（cm⁻¹），常用光谱数据（编者录入）；σ 对称数
  const ROT = { HCl: [10.59, 1, 'HCl'], CO: [1.931, 1, 'CO'], N2: [1.998, 2, 'N₂'], H2: [60.85, 2, 'H₂'], I2: [0.0374, 2, 'I₂'] };
  D.rotational = {
    kind: 'exact',
    title: ['转动能级的 Boltzmann 布居', 'Boltzmann populations of rotational levels'],
    intro: ['选一个双原子分子、调温度，看各转动能级的布居和配分函数。', 'Pick a diatomic and a temperature to see the populations of its rotational levels and the partition function.'],
    sel: [['m', ['分子', 'Molecule'], Object.entries(ROT).map(([k, v]) => [k, [`${v[2]}（B̃ = ${v[0]} cm⁻¹）`, `${v[2]} (B̃ = ${v[0]} cm⁻¹)`]]), 'HCl']],
    ctl: [['T', ['温度', 'Temperature'], 10, 1500, 5, 298, (v) => `${v} K`]],
    btn: [[['HCl 室温', 'HCl at room temperature'], { m: 'HCl', T: 298 }], [['CO 室温', 'CO at room temperature'], { m: 'CO', T: 298 }], [['H₂ 77 K', 'H₂ at 77 K'], { m: 'H2', T: 77 }]],
    figs: [[0.5, ['各 J 能级的布居比例（棒），金色是最多的一条；曲线是连续近似。', 'Population of each level J (bars), the most populated in gold; the curve is the continuous approximation.']]],
    note: ['刚性转子、Boltzmann 统计的精确求和。同核分子（N₂、H₂、I₂）的配分函数除以对称数 2，但真实的布居还有核自旋统计造成的奇偶交替（N₂ 偶 J : 奇 J = 2 : 1，H₂ 奇 : 偶 = 3 : 1），棒图没有画出这一点。转动常数由编者录入。', 'An exact sum over rigid-rotor levels with Boltzmann statistics. For homonuclear molecules (N₂, H₂, I₂) the partition function is divided by the symmetry number 2, but real populations also alternate between odd and even J because of nuclear-spin statistics (N₂ even : odd = 2 : 1, H₂ odd : even = 3 : 1), not shown in the bars. Rotational constants were typed by the editor.'],
    draw(s, f, c) {
      const [B, sig, nm] = ROT[s.m], Jcap = Math.min(400, Math.max(12, Math.ceil(4 * Math.sqrt(s.T / (M.c2 * B))))), r = M.rotPop(B, s.T, Jcap, sig);
      const Js = r.pops.map((_, J) => J), top = r.pops.indexOf(Math.max(...r.pops)), show = Math.min(Jcap, Math.max(10, Math.ceil(3 * (top + 2))));
      const cont = K.lin(0, show, 200).map((J) => ((2 * J + 1) * Math.exp((-M.c2 * B * J * (J + 1)) / s.T)) / (r.q * sig));
      plot(f[0], { x: [-0.8, show + 0.8], y: [0, Math.max(...r.pops) * 1.18], xl: 'J', yl: L('布居比例', 'fraction'), series: [{ xs: Js.slice(0, show + 1), ys: r.pops.slice(0, show + 1), color: c.accent, bars: 0.7 }, { xs: [top], ys: [r.pops[top]], color: c.gold, bars: 0.7 }, { xs: K.lin(0, show, 200), ys: cont, color: c.muted, width: 1.4, dash: [4, 3] }] });
      return [[[`${nm} 布居最多的能级`, `Most populated level of ${nm}`], `J = ${top}`, 1], [['公式估计 J_max', 'Formula estimate of J_max'], fix(M.Jmax(B, s.T), 2)], [['转动配分函数 q_rot', 'Rotational partition function q_rot'], fix(r.q, 2), 1], [['高温近似 k_BT/(σhcB̃)', 'High-T approximation k_BT/(σhcB̃)'], fix(s.T / (M.c2 * B * sig), 2)], [['J = 0 的比例', 'Fraction in J = 0'], pct(r.pops[0])]];
    },
  };
});
