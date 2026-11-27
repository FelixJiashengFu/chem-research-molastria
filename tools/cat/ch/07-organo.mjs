// 第七章：有机小分子催化。演示 ee（对映选择性和 ΔΔG‡ 的换算）。
export default {
  id: 'organo',
  title: ['不用金属也不用蛋白质：有机小分子催化', 'Neither metal nor protein: organocatalysis'],
  summary: ['2000 年两篇文章让“一个小小的有机分子就能做高选择性催化”成了独立的领域：脯氨酸催化的醛缩反应和咪唑啉酮催化的 Diels–Alder。这一章讲它靠什么工作（共价活化和氢键活化）、对映选择性和能量差怎么换算（99 % ee 只要 3.1 kcal/mol），以及为什么同一个硝基羟醛反应既能在笼里做也能用小分子做，给了这一栏一个难得的横向对照。', 'In 2000 two papers made “a small organic molecule can catalyse with high selectivity” a field of its own: proline-catalysed aldol and imidazolidinone-catalysed Diels–Alder. This chapter covers what makes it work — covalent and hydrogen-bonding activation — how enantioselectivity converts into an energy difference (99 % ee needs only 3.1 kcal/mol), and why the same nitro-aldol reaction can be run in a cage or by a small molecule, which gives this section a rare side-by-side comparison.'],
  level: 'proved',
  demos: ['ee'],
  body: [
    ['前面几章都在造或者借一个大分子。但催化不一定需要大：2000 年 List、Lerner 和 Barbas 报告脯氨酸——一个最便宜的天然氨基酸——能催化直接的不对称醛缩反应 [@list2000]；同一年 MacMillan 组报告手性咪唑啉酮催化不对称 Diels–Alder [@ahrendt2000]。这两篇把一个零散的现象变成了方法论，2021 年的诺贝尔化学奖给的就是这件事。', 'The previous chapters built or borrowed a macromolecule. But catalysis need not be large. In 2000 List, Lerner and Barbas reported that proline — the cheapest of natural amino acids — catalyses direct asymmetric aldol reactions [@list2000], and the same year the MacMillan group reported chiral imidazolidinones catalysing asymmetric Diels–Alder reactions [@ahrendt2000]. Together they turned a scattered phenomenon into a methodology, and that is what the 2021 Nobel Prize in Chemistry recognised.'],
    { h: ['两种活化方式', 'Two modes of activation'] },
    { steps: [
      ['**共价活化。** 催化剂和底物先形成共价中间体，把底物的电子结构改掉。脯氨酸和酮形成烯胺（抬高 HOMO，更亲核），和醛形成亚胺离子（压低 LUMO，更亲电）。手性来自催化剂自己的骨架，过渡态里羧酸还顺手给一个氢键把亲电体定住 [@list2000]。', '**Covalent activation.** The catalyst forms a covalent intermediate with the substrate and rewrites its electronic structure. Proline forms an enamine with a ketone (raising the HOMO, more nucleophilic) and an iminium with an aldehyde (lowering the LUMO, more electrophilic). Chirality comes from the catalyst’s own framework, and in the transition state its carboxylic acid also hydrogen-bonds the electrophile into place [@list2000].'],
      ['**非共价活化。** 催化剂只靠氢键、离子对或者别的弱相互作用抓住底物，不形成共价键。硫脲、方酸酰胺、手性膦酸都是这一类。Knowles 和 Jacobsen 的综述把它和酶的做法并排讲：两者都在用一群不强的相互作用凑出一个有方向性的口袋 [@knowles2010]。', '**Non-covalent activation.** The catalyst holds the substrate with hydrogen bonds, ion pairs or other weak interactions, forming no covalent bond. Thioureas, squaramides and chiral phosphoric acids belong here. The Knowles–Jacobsen review sets this beside what enzymes do: both assemble a directional pocket out of a set of individually weak interactions [@knowles2010].'],
    ] },
    ['值得特意点出来的是：**这一栏开头那篇笼催化论文做的硝基羟醛（Henry）反应，正好也是有机小分子催化的经典底物** [@henry2011]。这给了我们一个在人工催化剂里不常有的东西——同一个反应、几条完全不同的技术路线，可以直接比。比的时候要注意分母和条件：小分子催化剂通常用 5–20 mol%，笼用 1–10 mol%，而天然酶用 $10^{-4}$ mol% 也嫌多。', 'Worth pointing out explicitly: **the nitro-aldol (Henry) reaction of the cage paper that opens this section is also a classic organocatalytic substrate** [@henry2011]. That gives us something rare among artificial catalysts — one reaction, several entirely different technologies, directly comparable. When comparing, mind the denominator and the conditions: small-molecule catalysts typically run at 5–20 mol%, cages at 1–10 mol%, while a natural enzyme finds $10^{-4}$ mol% generous.'],
    { h: ['对映选择性其实是一个很小的能量差', 'Enantioselectivity is a very small energy difference'] },
    ['有机催化的核心指标是对映体过量（ee）。它和两条路径的过渡态能量差 $\\Delta\\Delta G^\\ddagger$ 是一一对应的，而这个换算的结果常常让人意外：', 'The headline number in organocatalysis is enantiomeric excess, and it maps one-to-one onto the transition-state energy difference between the two pathways. The conversion is regularly surprising:'],
    { table: {
      head: [['ee', 'ee'], ['对映体比 (er)', 'Ratio (er)'], ['$\\Delta\\Delta G^\\ddagger$ (298 K)', '$\\Delta\\Delta G^\\ddagger$ (298 K)']],
      rows: [
        [['50 %', '50 %'], ['75 : 25', '75 : 25'], ['0.65 kcal/mol', '0.65 kcal/mol']],
        [['90 %', '90 %'], ['95 : 5', '95 : 5'], ['1.74 kcal/mol', '1.74 kcal/mol']],
        [['99 %', '99 %'], ['99.5 : 0.5', '99.5 : 0.5'], ['3.14 kcal/mol', '3.14 kcal/mol']],
        [['99.9 %', '99.9 %'], ['99.95 : 0.05', '99.95 : 0.05'], ['4.50 kcal/mol', '4.50 kcal/mol']],
      ],
      cap: ['99 % ee 只需要 3.1 kcal/mol，比一个氢键还少。所以“做到 99 % ee”本质上是“把一个弱相互作用的方向控制住”。', '99 % ee needs only 3.1 kcal/mol, less than one hydrogen bond. Reaching 99 % ee is therefore essentially controlling the direction of one weak interaction.'],
    } },
    { demo: 'ee' },
    ['这张表有三个实用推论。第一，**从 90 % 到 99 % 比从 50 % 到 90 % 难**：前者要多 1.4 kcal/mol，后者只要多 1.1 kcal/mol，而在已经优化过的体系里，后面每 0.1 kcal/mol 都很贵。第二，**选择性对温度敏感**：$\\Delta\\Delta G^\\ddagger$ 固定时降温会提高 ee，所以很多有机催化反应在 $-20$ 到 $-78$ °C 做；反过来，一篇报告室温 99 % ee 的文章，含的信息量比低温 99 % ee 大得多。第三，**ee 不能用来比催化剂的“好坏”**：它只测两条路的差，不测反应快不快，一个又慢又选择性好的催化剂在 ee 上看起来完美。', 'The table has three practical corollaries. First, **going from 90 % to 99 % is harder than from 50 % to 90 %**: the former needs 1.4 kcal/mol more, the latter only 1.1, and in an already-optimised system every further 0.1 kcal/mol is expensive. Second, **selectivity is temperature-sensitive**: at fixed $\\Delta\\Delta G^\\ddagger$, cooling raises the ee, which is why many organocatalytic reactions are run at $-20$ to $-78$ °C; conversely a paper reporting 99 % ee at room temperature carries much more information than one at low temperature. Third, **ee cannot rank catalysts by quality**: it measures the difference between two paths, not how fast either is, so a slow but selective catalyst looks perfect on ee.'],
    { note: ['看到 ee 的时候一定要看测法。手性 HPLC 或 GC 的基线和积分决定了 99 % 和 99.5 % 的区别，而这个区别在能量上是 0.4 kcal/mol。另外 ee 和产率是两件独立的事：产率 20 %、ee 99 % 的反应可能只是把容易反应的那一半消耗掉了。', 'Whenever you see an ee, check how it was measured. The baseline and integration of a chiral HPLC or GC trace decide between 99 % and 99.5 %, a difference of 0.4 kcal/mol in energy. And ee and yield are independent: 20 % yield at 99 % ee may mean only the easy half of the material reacted.'], kind: 'warn' },
    { h: ['有机催化在这一栏里的位置', 'Where organocatalysis sits in this section'] },
    ['它是这一栏里**唯一已经大规模用在工业上的均相人工催化剂**（沸石是多相的，见 {{ch:mof}}）：手性胺和手性酸催化的反应已经进了药物生产。它便宜、不怕水和空气、没有金属残留的问题（这对药物很要紧）。它的短板也很清楚：用量高（mol% 级）、底物范围窄、$k_{\\mathrm{cat}}$ 比酶低好几个数量级。', 'It is the **only homogeneous artificial catalyst in this section already used at industrial scale** (zeolites are heterogeneous; see {{ch:mof}}): chiral amine and chiral acid catalysis has entered pharmaceutical manufacture. It is cheap, tolerates water and air, and leaves no metal residue, which matters for drugs. Its weaknesses are equally clear: high loadings at the mol% level, narrow substrate scope, and a $k_{\\mathrm{cat}}$ orders of magnitude below an enzyme.'],
    ['这一点也提示了这一栏的一个贯穿主题：**人工催化剂的竞争力不在“比酶快”，而在“能做酶做不了的反应、在酶活不下去的条件里做”**。有机催化在甲苯里、在 $-78$ °C、在强酸条件下都能工作，这是蛋白质做不到的。', 'It also points at a theme running through this section: **artificial catalysts do not compete by being faster than enzymes, but by running reactions enzymes cannot and in conditions enzymes cannot survive**. Organocatalysis works in toluene, at $-78$ °C and under strong acid, where no protein would.'],
  ],
  points: [
    [['2000 年两篇文章开了这个领域', 'Two papers in 2000 opened the field'], ['脯氨酸催化的直接不对称醛缩 [@list2000] 和咪唑啉酮催化的 Diels–Alder [@ahrendt2000]。', 'Proline-catalysed direct asymmetric aldol [@list2000] and imidazolidinone-catalysed Diels–Alder [@ahrendt2000].'], 'history'],
    [['共价活化改电子结构，非共价活化只定位置', 'Covalent activation rewires electrons; non-covalent only positions'], ['烯胺抬高 HOMO、亚胺离子压低 LUMO；硫脲一类靠一群弱相互作用凑出方向性 [@knowles2010]。', 'Enamines raise the HOMO and iminiums lower the LUMO; thioureas and the like assemble directionality from several weak interactions [@knowles2010].'], 'proved'],
    [['99 % ee 只要 3.1 kcal/mol', '99 % ee needs only 3.1 kcal/mol'], ['比一个氢键还少，所以对映选择性本质上是控制一个弱相互作用的方向。', 'Less than one hydrogen bond, so enantioselectivity is really the control of one weak interaction’s direction.'], 'proved'],
    [['从 90 % 提到 99 % 比从 50 % 提到 90 % 难', 'From 90 % to 99 % is harder than from 50 % to 90 %'], ['前者要多 1.4 kcal/mol，后者 1.1 kcal/mol，而优化到后期每 0.1 kcal/mol 都很贵。', 'The former needs 1.4 kcal/mol more against 1.1, and late in an optimisation every 0.1 kcal/mol is expensive.'], 'proved'],
    [['降温提高 ee，所以要看反应温度', 'Cooling raises ee, so read the temperature'], ['室温下的 99 % ee 比 $-78$ °C 下的 99 % ee 说明的问题大得多。', '99 % ee at room temperature says far more than 99 % ee at $-78$ °C.'], 'proved'],
    [['硝基羟醛反应是少见的横向对照', 'The nitro-aldol is a rare common benchmark'], ['同一个反应既是笼催化那篇的底物 [@bickerton2026]，也是有机催化的经典底物 [@henry2011]。', 'The same reaction is the substrate of the cage paper [@bickerton2026] and a classic organocatalytic one [@henry2011].'], 'tested'],
    [['用量降不下来是这条路最硬的限制', 'Loading is the hardest limit of this route'], ['mol% 级的用量意味着 TON 只有几十，和酶差五六个数量级。', 'A loading at the mol% level means turnover numbers in the tens, five or six orders below an enzyme.'], 'open'],
  ],
  math: [
    ['\\mathrm{ee} = \\frac{[R] - [S]}{[R] + [S]}, \\qquad \\mathrm{er} = \\frac{1 + \\mathrm{ee}}{1 - \\mathrm{ee}}', ['对映体过量和对映体比。两者讲同一件事，文献里都在用。', 'Enantiomeric excess and enantiomeric ratio: the same information, and both appear in the literature.']],
    ['\\Delta\\Delta G^{\\ddagger} = RT \\ln \\frac{1 + \\mathrm{ee}}{1 - \\mathrm{ee}}', ['选择性换成能量差。298 K 时 99 % ee 对应 3.14 kcal/mol。', 'Selectivity as an energy difference: at 298 K, 99 % ee is 3.14 kcal/mol.']],
    ['\\mathrm{ee}(T) = \\tanh\\!\\left(\\frac{\\Delta\\Delta G^{\\ddagger}}{2RT}\\right)', ['反过来：固定 $\\Delta\\Delta G^\\ddagger$ 时 ee 随温度的变化，降温单调提高 ee。', 'The reverse: how ee varies with temperature at fixed $\\Delta\\Delta G^\\ddagger$, rising monotonically as it cools.']],
  ],
  example: {
    q: ['一个有机催化反应在 25 °C 给 88 % ee。要做到 96 % ee，降温到几度就够了？（假设 $\\Delta\\Delta G^\\ddagger$ 不随温度变）', 'An organocatalytic reaction gives 88 % ee at 25 °C. How cold must it be run to reach 96 % ee, assuming $\\Delta\\Delta G^\\ddagger$ does not change with temperature?'],
    steps: [
      ['先从 88 % ee 反推能量差：$\\mathrm{er} = 1.88/0.12 = 15.67$，$\\Delta\\Delta G^\\ddagger = 0.5922 \\times \\ln 15.67 = 1.63$ kcal/mol。', 'Back out the energy difference from 88 % ee: $\\mathrm{er} = 1.88/0.12 = 15.67$ and $\\Delta\\Delta G^\\ddagger = 0.5922 \\times \\ln 15.67 = 1.63$ kcal/mol.'],
      ['96 % ee 要求 $\\mathrm{er} = 1.96/0.04 = 49$，即 $RT \\ln 49 = 1.63$，于是 $RT = 1.63/3.892 = 0.419$ kcal/mol。', '96 % ee demands $\\mathrm{er} = 1.96/0.04 = 49$, so $RT \\ln 49 = 1.63$ and $RT = 1.63/3.892 = 0.419$ kcal/mol.'],
      ['$T = 0.419/0.0019872 = 211$ K $= -62$ °C。', '$T = 0.419/0.0019872 = 211$ K, or $-62$ °C.'],
    ],
    a: ['**要降到约 $-62$ °C。** 这解释了为什么有机催化的文献里到处是干冰浴。但也要留个心眼：这个算法假定 $\\Delta\\Delta G^\\ddagger$ 不随温度变，也就是假定选择性全部来自焓。真实体系里常常有熵的贡献（两条路的过渡态松紧不同），这时会出现等选择温度，低于它降温反而让 ee 变差。判断办法是测几个温度做 Eyring 图——[[reaction/#c-tst|反应动力学栏目讲了怎么拟合]]。', '**About $-62$ °C**, which explains why the organocatalysis literature is full of dry-ice baths. But keep one reservation: this arithmetic assumes $\\Delta\\Delta G^\\ddagger$ is temperature-independent, that is, that selectivity is purely enthalpic. Real systems often have an entropic contribution, because the two transition states differ in tightness, and then there is an isoselective temperature below which cooling makes the ee worse. The test is to measure several temperatures and make an Eyring plot — [[reaction/#c-tst|the reaction kinetics section covers the fitting]].'],
  },
  refs: ['list2000', 'ahrendt2000', 'knowles2010', 'henry2011'],
};
