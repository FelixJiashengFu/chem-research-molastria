const r = String.raw;
export default {
  id: 'practice', level: 'frontier', demos: ['grid'],
  title: ['实际计算：格点、选泛函和前沿', 'In practice: grids, choosing a functional, and the frontier'],
  summary: ['真正跑一个 DFT 计算时，还有几件书上常常略过的事：交换关联能是在格点上数值积分的，格点不够会让能量和几何出错；几百个泛函里怎么挑，要看大型基准；以及这个领域正在争论什么：新泛函是不是离精确泛函越来越远，用机器学习从分数电荷条件里学出来的泛函走到了哪一步。', 'Running a real DFT calculation involves a few things textbooks often skip: the exchange–correlation energy is integrated numerically on a grid, and too coarse a grid spoils energies and geometries; choosing among hundreds of functionals should rest on large benchmarks; and the field is debating whether new functionals are drifting away from the exact one, and how far functionals machine-learned from fractional-charge conditions have come.'],
  body: [
    [r`除了 LDA 交换这种特例，交换关联能的被积函数没有解析积分。分子程序在每个原子周围放一套**径向 × 角度**的格点（角度部分常用 Lebedev 格点），再把它们拼起来。问题是几套格点会重叠：一个空间点同时属于两个原子的格点。Becke 1988 年的办法是给每一点一组光滑的**分割权重** $w_A(\mathbf r)$，加起来等于 1，在原子 A 附近接近 1；积分就拆成以各原子为中心、各自很好积的几块 [@becke1988grid]。今天几乎所有分子 DFT 程序都用它或它的变体，例如 PySCF [@sun2018]。`,
     r`Apart from special cases such as LDA exchange, the exchange–correlation integrand has no analytic integral. Molecular codes place a **radial × angular** grid around each atom (the angular part usually a Lebedev grid) and stitch them together. The catch is overlap: a point in space belongs to two atoms’ grids at once. Becke’s 1988 solution gives every point a set of smooth **partition weights** $w_A(\mathbf r)$ that sum to one and are close to one near atom A; the integral splits into atom-centred pieces, each easy to integrate [@becke1988grid]. Almost every molecular DFT code today uses it or a variant, PySCF for example [@sun2018].`],
    { demo: 'grid' },
    [r`格点误差在实践里有三个常见表现：meta-GGA（尤其是 SCAN，{{ch:ladder}}）对格点很敏感，粗格点会让势能面出现小的振荡；振动频率里的低频模式会因为格点打破了旋转不变性而偏移；以及 {{ch:basis}} 那样的“收敛要自己测”，格点也要测。一般的建议是用程序的“细”或“很细”格点做最终结果，尤其是 meta-GGA 和频率计算。`,
     r`Grid error shows up in practice in three common ways: meta-GGAs (SCAN especially, {{ch:ladder}}) are grid-sensitive, and coarse grids put small wiggles into potential energy surfaces; low-frequency vibrational modes shift because the grid breaks rotational invariance; and, as in {{ch:basis}}, convergence must be tested, grids included. The usual advice is to use the code’s “fine” or “ultrafine” grid for final results, especially for meta-GGAs and frequency calculations.`],
    { h: ['怎么选泛函：看大型基准', 'Choosing a functional: look at large benchmarks'] },
    [r`经验性的选择应该基于大型基准，而不是习惯。Goerigk、Grimme 等人 2017 年的 **GMTKN55** 有 55 个子集、约 1500 个相对能量，覆盖主族热化学、反应能垒、非共价相互作用；他们用它评估了两百多种泛函和色散修正的组合 [@goerigk2017]。同年 Mardirossian 和 Head-Gordon 在近 5000 个数据点上比较了约 200 个泛函 [@mardirossian2017]。两边的结论大体一致：每一级阶梯都有好的选择，加色散修正几乎总是更好，B3LYP 没有色散修正时并不突出。`,
     r`Empirical choices should rest on large benchmarks, not habit. **GMTKN55** by Goerigk, Grimme and co-workers (2017) has 55 subsets and about 1500 relative energies covering main-group thermochemistry, barrier heights and non-covalent interactions; they used it to assess more than two hundred functional and dispersion-correction combinations [@goerigk2017]. In the same year Mardirossian and Head-Gordon compared about 200 functionals on nearly 5000 data points [@mardirossian2017]. The two broadly agree: every rung has good options, adding a dispersion correction almost always helps, and B3LYP without dispersion is unremarkable.`],
    { table: { head: [['用途', 'Task'], ['常见的稳妥选择', 'Common safe choices'], ['注意', 'Caveats']], rows: [
      [['有机分子的结构', 'Organic geometries'], ['r²SCAN-3c、PBE0-D4、B3LYP-D3(BJ)', 'r²SCAN-3c, PBE0-D4, B3LYP-D3(BJ)'], ['基组至少三 ζ（复合方法除外）', 'At least triple-ζ (except composite methods)']],
      [['反应能和能垒', 'Reaction energies and barriers'], ['ωB97X-V、ωB97M-V、双杂化（如 DSD 系列）', 'ωB97X-V, ωB97M-V, double hybrids (e.g. DSD family)'], ['GGA 的能垒常偏低（{{ch:errors}}）', 'GGA barriers are often too low ({{ch:errors}})']],
      [['非共价相互作用', 'Non-covalent interactions'], ['任何好泛函 + D3(BJ)/D4，或带 VV10 的泛函', 'Any good functional + D3(BJ)/D4, or a VV10 functional'], ['不要重复加色散（{{ch:disp}}）', 'Don’t add dispersion twice ({{ch:disp}})']],
      [['固体结构', 'Solid structures'], ['PBEsol、r²SCAN', 'PBEsol, r²SCAN'], ['层状材料加色散', 'Add dispersion for layered materials']],
      [['带隙', 'Band gaps'], ['HSE06，或者 GW', 'HSE06, or GW'], ['不要用 PBE 的带隙（{{ch:solids}}）', 'Don’t use PBE gaps ({{ch:solids}})']],
      [['激发态', 'Excited states'], ['长程校正杂化泛函的 TDDFT', 'TDDFT with a range-separated hybrid'], ['电荷转移、双激发（{{ch:tddft}}）', 'Charge transfer, double excitations ({{ch:tddft}})']],
    ], cap: ['编者按基准文献整理的起点，不是规定；自己的体系最好拿更高级的方法（如 CCSD(T)）抽查几个点。', 'An editor’s starting point distilled from the benchmark literature, not a rule; spot-check a few points of your own system against a higher-level method such as CCSD(T).'] } },
    { h: ['前沿：我们离精确泛函是更近还是更远', 'The frontier: closer to the exact functional, or further?'] },
    [r`2017 年 Medvedev 等人在《科学》上指出：从 2000 年前后开始，新泛函的能量越来越准，但原子的**电子密度**反而越来越差，说明有些泛函是靠拟合“走偏”了 [@medvedev2017]。这篇文章引起了不少反驳：密度误差的度量方式、所选的高度电离原子是否有代表性，都有争议。它至少提醒了一件事：能量准不等于泛函“对”。`,
     r`In 2017 Medvedev and co-workers argued in *Science* that since around 2000 new functionals have grown more accurate in energy but worse in atomic **electron densities**, suggesting that some had “strayed” through fitting [@medvedev2017]. The paper drew several rebuttals: how density error is measured, and whether highly ionised atoms are representative, are both disputed. At the least it is a reminder that accurate energies do not make a functional “right”.`],
    [r`另一条路是让机器学习直接学泛函，但加上精确条件。DeepMind 2021 年的 **DM21** 是一个神经网络局部杂化泛函，训练数据里专门加入了分数电荷和分数自旋体系，要它满足 {{ch:errors}} 的分段直线和平顶条件 [@kirkpatrick2021]。它在 $\mathrm{H}_2^+$ 拉开、电荷离域这类老问题上表现很好；代价是贵、在一些自洽场计算里难收敛、对训练集以外的体系（如过渡金属）还没有定论。这是一个活跃的方向。`,
     r`Another route is to machine-learn the functional directly, but with exact conditions built in. DeepMind’s 2021 **DM21** is a neural-network local hybrid whose training data deliberately includes fractional-charge and fractional-spin systems, so that it obeys the piecewise-linearity and flat-plane conditions of {{ch:errors}} [@kirkpatrick2021]. It does very well on old problems such as stretched $\mathrm{H}_2^+$ and charge delocalisation; the costs are expense, difficult SCF convergence in some cases, and no verdict yet for systems outside its training set (transition metals, for example). This is an active direction.`],
  ],
  points: [
    [['Becke 分割', 'Becke partitioning'], ['把多中心积分拆成单中心积分；今天的标准做法。', 'Splits a multicentre integral into single-centre ones; standard practice today.'], 'tested'],
    [['格点敏感', 'Grid sensitivity'], ['meta-GGA 和低频振动对格点敏感，最终结果用细格点。', 'Meta-GGAs and low frequencies are grid-sensitive; use fine grids for final results.'], 'tested'],
    [['基准驱动的选择', 'Benchmark-driven choice'], ['GMTKN55 等大型基准：加色散几乎总更好。', 'Large benchmarks such as GMTKN55: adding dispersion almost always helps.'], 'tested'],
    [['密度在变差吗', 'Are densities getting worse?'], ['Medvedev 2017 的结论和度量方式都有争议。', 'Both the conclusion and the metric of Medvedev 2017 are disputed.'], 'disputed'],
    [['学出来的泛函', 'Learned functionals'], ['DM21 修好了分数电荷问题，普适性仍在检验。', 'DM21 fixes fractional-charge problems; its generality is still being tested.'], 'frontier'],
  ],
  math: [
    [r`E_{xc} = \int f(\mathbf r)\,d^3r = \sum_A \int w_A(\mathbf r) f(\mathbf r)\,d^3r \approx \sum_A\sum_{g} W_{Ag}\,w_A(\mathbf r_{Ag})\,f(\mathbf r_{Ag})`, ['Becke 分割：每个原子一套格点，权重 w_A 加起来是 1。', 'Becke partitioning: one grid per atom, weights w_A summing to one.']],
    [r`w_A(\mathbf r) = \frac{P_A(\mathbf r)}{\sum_B P_B(\mathbf r)}, \qquad P_A = \prod_{B \ne A} s(\mu_{AB}), \quad \mu_{AB} = \frac{r_A - r_B}{R_{AB}}`, ['权重由“细胞函数” s 拼成，s 是迭代三次的光滑阶梯。', 'Weights are built from “cell functions” s, smooth steps iterated three times.']],
    [r`r = \frac{1 + x}{1 - x}, \qquad x \in (-1, 1)`, ['Becke 的径向映射：把 Gauss–Chebyshev 点映到 (0, ∞)，越靠近原子核越密。', 'Becke’s radial map: sends Gauss–Chebyshev points to (0, ∞), densest near the nucleus.']],
  ],
  example: {
    q: [r`氢原子的 LSDA 交换能精确值 −0.26804 Hartree。只用 8 个和 12 个径向点时，误差各是多少 kcal/mol？H₂ 里如果不做 Becke 分割，只用一个原子的格点（20 个径向点），电子数积出来差多少？`, r`The exact LSDA exchange energy of hydrogen is −0.26804 hartree. With only 8 and 12 radial points, what are the errors in kcal/mol? In H₂, without Becke partitioning and using one atom’s grid only (20 radial points), how far off is the integrated electron number?`],
    steps: [
      [r`演示的读数：8 点误差 $5.2\times10^{-4}$ Hartree $= 0.32$ kcal/mol；12 点 $1.5\times10^{-5}$ Hartree $= 0.009$ kcal/mol；20 点已经是 $5\times10^{-8}$。`, r`From the demo: 8 points give an error of $5.2\times10^{-4}$ hartree $= 0.32$ kcal/mol; 12 points $1.5\times10^{-5}$ hartree $= 0.009$ kcal/mol; 20 points are already at $5\times10^{-8}$.`],
      [r`H₂ 只用一个原子的格点：20 个径向点时 $\int n - 2 \approx -9\times10^{-4}$，再加点也停在这附近；Becke 分割后是 $3.5\times10^{-6}$，而且继续下降。`, r`H₂ with one atom’s grid: at 20 radial points $\int n - 2 \approx -9\times10^{-4}$, and more points barely help; with Becke partitioning it is $3.5\times10^{-6}$ and keeps falling.`],
    ],
    a: [r`球对称的单原子，十几个径向点就够；多原子分子的难点在于另一个原子核附近的尖峰，单中心格点在那里太稀，加径向点也补不回来。Becke 分割让每个尖峰都落在自己的格点中心，所以误差能继续指数下降。`, r`For a spherical single atom a dozen radial points suffice; the difficulty in a molecule is the cusp at the other nucleus, where a single-centre grid is too sparse and extra radial points do not help. Becke partitioning puts every cusp at the centre of its own grid, so the error keeps falling exponentially.`],
  },
};
