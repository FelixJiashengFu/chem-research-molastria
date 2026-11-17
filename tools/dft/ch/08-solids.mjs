const r = String.raw;
export default {
  id: 'solids', level: 'tested', demos: ['eos'],
  title: ['固体：状态方程、带隙和高通量', 'Solids: equations of state, band gaps and high throughput'],
  summary: ['DFT 在材料科学里最常做的事：算几个体积下的能量，拟合状态方程，读出晶格常数和体模量；算能带和带隙；把同样的流程自动跑在几十万个化合物上。这一章讲 Birch–Murnaghan 拟合、各级泛函对晶格常数和带隙的典型误差、屏蔽杂化泛函 HSE，以及 15 个程序对 71 种单质晶体的“可重复性”测试。', 'What DFT does most often in materials science: compute energies at a few volumes, fit an equation of state and read off the lattice constant and bulk modulus; compute band structures and gaps; run the same workflow automatically over hundreds of thousands of compounds. This chapter covers the Birch–Murnaghan fit, typical errors of each rung for lattice constants and gaps, the screened hybrid HSE, and the “reproducibility” test of 15 codes on 71 elemental crystals.'],
  body: [
    [r`固体的平衡体积 $V_0$ 是 $E(V)$ 的极小，体模量 $B_0 = V\,d^2E/dV^2$ 是极小处的曲率，$B_0' = dB/dP$ 描述它随压力怎样变硬。Murnaghan 1944 年假设 $B$ 随压力线性增大，得到一个简单的解析式 [@murnaghan1944]；Birch 1947 年从有限应变展开出发，得到今天最常用的**三阶 Birch–Murnaghan** 状态方程 [@birch1947]。在 $V_0$ 附近 ±6% 取五到七个体积点算能量，再拟合，就得到三个数。`,
     r`A solid’s equilibrium volume $V_0$ is the minimum of $E(V)$, the bulk modulus $B_0 = V\,d^2E/dV^2$ is the curvature there, and $B_0' = dB/dP$ says how quickly it stiffens under pressure. Murnaghan in 1944 assumed $B$ grows linearly with pressure and obtained a simple closed form [@murnaghan1944]; Birch in 1947 started from a finite-strain expansion and arrived at today’s most common **third-order Birch–Murnaghan** equation of state [@birch1947]. Compute energies at five to seven volumes within about ±6% of $V_0$, fit, and the three numbers drop out.`],
    [r`三阶 BM 的能量恰好是 $x = V^{-2/3}$ 的三次多项式，所以拟合是线性最小二乘，不需要猜初值。演示用“接近实验值的示意参数”造出能量点，可以加噪声，看噪声和取点范围怎样影响 $B_0'$：$V_0$ 最稳，$B_0$ 次之，$B_0'$ 对噪声最敏感，取点范围太窄时几乎定不下来。`,
     r`The third-order BM energy is exactly a cubic polynomial in $x = V^{-2/3}$, so the fit is linear least squares with no starting guess needed. The demo builds energy points from “illustrative parameters near experiment” and lets you add noise to see how noise and the range of points affect $B_0'$: $V_0$ is the most robust, $B_0$ next, and $B_0'$ is the most sensitive to noise and is barely determined when the range is too narrow.`],
    { demo: 'eos' },
    { h: ['各级泛函的典型误差', 'Typical errors by rung'] },
    { table: { head: [['泛函', 'Functional'], ['晶格常数', 'Lattice constant'], ['体模量', 'Bulk modulus'], ['带隙', 'Band gap']], rows: [
      [['LDA', 'LDA'], ['偏小约 1%', 'about 1% too small'], ['偏大', 'too large'], ['严重偏小', 'far too small']],
      [['PBE', 'PBE'], ['偏大约 1%', 'about 1% too large'], ['偏小', 'too small'], ['严重偏小（硅约 0.6 eV，实验 1.17 eV）', 'far too small (Si about 0.6 eV vs 1.17 eV measured)']],
      [['PBEsol', 'PBEsol'], ['接近实验', 'close to experiment'], ['接近实验', 'close to experiment'], ['和 PBE 差不多', 'similar to PBE']],
      [['SCAN / r²SCAN', 'SCAN / r²SCAN'], ['接近实验', 'close to experiment'], ['接近实验', 'close to experiment'], ['比 PBE 稍好', 'slightly better than PBE']],
      [['HSE06', 'HSE06'], ['接近实验', 'close to experiment'], ['接近实验', 'close to experiment'], ['sp 半导体大多接近实验', 'close to experiment for most sp semiconductors']],
    ], cap: ['定性的趋势，具体数字随材料变化；离子性强、有局域 d/f 电子的材料要另外看。', 'Qualitative trends; actual numbers vary by material. Strongly ionic materials and those with localised d/f electrons need separate checks.'] } },
    [r`带隙偏小的原因在 {{ch:errors}}：半局域泛函没有导数不连续，又有离域误差。全局杂化在固体里很贵，而且金属里长程的精确交换会出问题。Heyd、Scuseria 和 Ernzerhof 2003 年的 **HSE** 只在**短程**混入 25% 精确交换，长程用 PBE [@hse2003]，屏蔽长度约 5 Å（$\omega = 0.11\ \mathrm{bohr^{-1}}$，即 HSE06）。它让 sp 半导体的带隙大多接近实验，而且对金属也能用 [@heyd2005]，是今天算固体带隙最常用的泛函之一。`,
     r`The reason gaps come out too small is in {{ch:errors}}: semilocal functionals have no derivative discontinuity and suffer from delocalisation error. Global hybrids are expensive in solids, and long-range exact exchange misbehaves in metals. The **HSE** functional of Heyd, Scuseria and Ernzerhof (2003) mixes 25% exact exchange only at **short range** and uses PBE at long range [@hse2003], with a screening length of about 5 Å ($\omega = 0.11\ \mathrm{bohr^{-1}}$, i.e. HSE06). It brings most sp-semiconductor gaps close to experiment and still works for metals [@heyd2005], and is one of today’s most common functionals for band gaps in solids.`],
    { h: ['程序之间算得一样吗', 'Do different codes agree?'] },
    [r`赝势和数值细节会不会让不同程序给出不同结果？2016 年 Lejaeghere 等 69 位作者用 15 个程序、40 种方法（全电子、PAW、超软和模守恒赝势）算了 71 种单质晶体的 PBE 状态方程，用一个“Δ 值”量两两之间的差别 [@lejaeghere2016]。结论是：最新的全电子程序和精心生成的赝势之间，平均差别约 1 meV/原子，和不同实验之间的差别相当；而老的赝势库差得多。所以“PBE 的晶格常数”是一个定义清楚的数，泛函的误差远大于程序之间的误差。`,
     r`Do pseudopotentials and numerical details make different codes disagree? In 2016 Lejaeghere and 68 co-authors computed PBE equations of state for 71 elemental crystals with 15 codes and 40 methods (all-electron, PAW, ultrasoft and norm-conserving), measuring pairwise differences with a “Δ value” [@lejaeghere2016]. The finding: between the latest all-electron codes and carefully generated pseudopotentials the average difference is about 1 meV/atom, comparable to the spread between experiments, while older pseudopotential libraries differ much more. So “the PBE lattice constant” is a well-defined number, and functional error dwarfs code-to-code differences.`],
    [r`这种一致性是**高通量计算**的前提。Materials Project 用统一的设置（PBE，必要时 +U）自动算了十几万种已知和假想的化合物：结构、形成能、相图、带结构、弹性常数，公开给所有人查 [@jain2013]。后来的 AFLOW、OQMD、NOMAD 等数据库也是同样的思路；它们又成了机器学习势（[[nequip/|NequIP]]）和材料基础模型的训练数据。`,
     r`This agreement is what makes **high-throughput computation** possible. The Materials Project automatically computed more than a hundred thousand known and hypothetical compounds with uniform settings (PBE, +U where needed): structures, formation energies, phase diagrams, band structures, elastic constants, all open for anyone to query [@jain2013]. Later databases such as AFLOW, OQMD and NOMAD follow the same idea, and they in turn became training data for machine-learned potentials ([[nequip/|NequIP]]) and materials foundation models.`],
  ],
  points: [
    [['三阶 Birch–Murnaghan', 'Third-order Birch–Murnaghan'], ['E 是 V^(−2/3) 的三次式；线性拟合就行。', 'E is a cubic in V^(−2/3); a linear fit is enough.'], 'proved'],
    [['LDA 偏小、PBE 偏大', 'LDA too small, PBE too large'], ['晶格常数约 ±1%；PBEsol 改回梯度展开的系数，接近实验。', 'Lattice constants are off by about ±1%; PBEsol restores the gradient-expansion coefficient and comes close to experiment.'], 'tested'],
    [['HSE06 的带隙', 'HSE06 band gaps'], ['sp 半导体大多接近实验；强关联氧化物要另外看。', 'Close to experiment for most sp semiconductors; strongly correlated oxides need separate care.'], 'tested'],
    [['Δ 测试', 'The Δ test'], ['新的程序之间差约 1 meV/原子；泛函误差远大于程序差别。', 'Modern codes agree to about 1 meV/atom; functional error far exceeds code differences.'], 'tested'],
    [['数据库的泛函', 'Functional choice in databases'], ['大多数数据库用 PBE(+U)，继承了它的系统误差。', 'Most databases use PBE(+U) and inherit its systematic errors.'], 'approx'],
  ],
  math: [
    [r`E(V) = E_0 + \frac{9V_0B_0}{16}\Big\{\big[(V_0/V)^{2/3} - 1\big]^3 B_0' + \big[(V_0/V)^{2/3} - 1\big]^2\big[6 - 4(V_0/V)^{2/3}\big]\Big\}`, ['三阶 Birch–Murnaghan 状态方程（能量形式）。', 'The third-order Birch–Murnaghan equation of state (energy form).']],
    [r`P(V) = \frac{3B_0}{2}\Big[\Big(\frac{V_0}{V}\Big)^{7/3} - \Big(\frac{V_0}{V}\Big)^{5/3}\Big]\Big\{1 + \frac34\,(B_0' - 4)\Big[\Big(\frac{V_0}{V}\Big)^{2/3} - 1\Big]\Big\}`, ['同一个状态方程的压力形式。', 'The pressure form of the same equation of state.']],
    [r`E_{xc}^{\mathrm{HSE}} = \tfrac14 E_x^{\mathrm{HF,SR}}(\omega) + \tfrac34 E_x^{\mathrm{PBE,SR}}(\omega) + E_x^{\mathrm{PBE,LR}}(\omega) + E_c^{\mathrm{PBE}}`, ['HSE：只在短程（SR）混入 1/4 的精确交换。', 'HSE: one quarter exact exchange at short range (SR) only.']],
    [r`\Delta = \sqrt{\frac{1}{\Delta V}\int_{0.94V_0}^{1.06V_0}\big[E_1(V) - E_2(V)\big]^2\,dV}`, ['Δ 值：两条状态方程在 ±6% 体积范围里的均方根差（各自以极小为零点）。', 'The Δ value: the rms difference between two equations of state over ±6% in volume (each with its minimum set to zero).']],
  ],
  example: {
    q: [r`硅：V₀ = 20.02 Å³/原子，B₀ = 98 GPa，B₀′ = 4.2。压缩 10%（V = 0.9 V₀）要多大压力？只用 B₀ 的线性估计是多少？`, r`Silicon: V₀ = 20.02 Å³/atom, B₀ = 98 GPa, B₀′ = 4.2. What pressure compresses it by 10% (V = 0.9 V₀)? What does a linear estimate using only B₀ give?`],
    steps: [
      [r`$(V_0/V) = 1.1111$：$(V_0/V)^{7/3} = 1.2785$，$(V_0/V)^{5/3} = 1.1918$，方括号是 $0.0867$。`, r`$(V_0/V) = 1.1111$: $(V_0/V)^{7/3} = 1.2785$ and $(V_0/V)^{5/3} = 1.1918$, so the first bracket is $0.0867$.`],
      [r`$(V_0/V)^{2/3} - 1 = 0.0728$，花括号 $= 1 + 0.75 \times 0.2 \times 0.0728 = 1.0109$。$P = 1.5 \times 98 \times 0.0867 \times 1.0109 = 12.9$ GPa。`, r`$(V_0/V)^{2/3} - 1 = 0.0728$, so the brace is $1 + 0.75 \times 0.2 \times 0.0728 = 1.0109$. $P = 1.5 \times 98 \times 0.0867 \times 1.0109 = 12.9$ GPa.`],
    ],
    a: [r`约 12.9 GPa；线性估计 $B_0 \times 0.1 = 9.8$ GPa 低了约四分之一，因为固体越压越硬。把 B₀′ 从 4.2 换成 4，压力只变成 12.7 GPa：这个范围里 B₀′ 的影响不大，这也是它难拟合的原因。（实际上硅在约 11 GPa 已经相变成 β-锡结构。）`, r`About 12.9 GPa; the linear estimate $B_0 \times 0.1 = 9.8$ GPa is about a quarter too low, because solids stiffen as they are compressed. Changing B₀′ from 4.2 to 4 only moves the pressure to 12.7 GPa: in this range B₀′ matters little, which is exactly why it is hard to fit. (In reality silicon transforms to the β-tin structure at about 11 GPa.)`],
  },
};
