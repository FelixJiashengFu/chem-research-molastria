const r = String.raw;
export default {
  id: 'reduce', level: 'proved', demos: ['reduce'],
  title: ['约化公式和投影算符：把一组东西按对称性拆开', 'The reduction formula and projection operators: sorting a set of objects by symmetry'],
  summary: ['有了特征标表，任何一组键、轨道或位移都能在三步之内按对称性分类：数出每个类的特征标，用约化公式算出每个不可约表示出现几次，再用投影算符造出对称性匹配的线性组合（SALC）。这一章用甲烷的四根键、氨的三个氢、苯的 π 体系和八面体的六根键演示这套流程。', 'With a character table, any set of bonds, orbitals or displacements can be sorted by symmetry in three steps: count the character for each class, use the reduction formula to find how often each irrep occurs, then build symmetry-adapted linear combinations (SALCs) with projection operators. This chapter runs the procedure on methane’s four bonds, ammonia’s three hydrogens, benzene’s π system and an octahedron’s six bonds.'],
  body: [
    [r`第三章的正交关系有一个直接的用处：如果一个可约表示 $\Gamma$ 拆成 $\Gamma = \sum_i n_i\,\Gamma^{(i)}$，那么 $\Gamma$ 的特征标和第 $i$ 行特征标的内积正好是 $n_i$。这就是**约化公式**：`,
     r`The orthogonality relations of chapter 3 have an immediate use: if a reducible representation splits as $\Gamma = \sum_i n_i\,\Gamma^{(i)}$, the inner product of $\Gamma$’s characters with row $i$ is exactly $n_i$. This is the **reduction formula**:`],
    { math: r`n_i = \frac{1}{h}\sum_{\text{classes } c} g_c\;\chi^{\Gamma}(c)\;\chi^{(i)}(c)^*`, cap: ['h 是群的阶，g_c 是类 c 的元素个数。', 'h is the order of the group and g_c the number of elements in class c.'] },
    [r`用法总是三步。**第一步，数特征标。** 对每个类挑一个操作，看这组对象变成什么。规则很简单：被移到别处的对象贡献 0，留在原地的贡献它自己变成了自己的几倍（不动的键或 s 轨道贡献 1，被翻过来的 $p_z$ 贡献 −1，不动的原子的三个位移贡献 $\mathrm{tr}\,R$）。**第二步，套公式。** 每个 $n_i$ 必须是非负整数，这是数错没有的检验。**第三步，核对维数**：$\sum_i n_i d_i$ 等于对象的个数。`,
     r`The use is always three steps. **Step one: count characters.** For each class pick one operation and see what it does to the set. The rule is simple: objects moved elsewhere contribute 0; objects left in place contribute the multiple of themselves they turn into (an unmoved bond or s orbital gives 1, a $p_z$ turned upside down gives −1, the three displacements of an unmoved atom give $\mathrm{tr}\,R$). **Step two: apply the formula.** Every $n_i$ must be a non-negative integer, a built-in check on the counting. **Step three: check dimensions**: $\sum_i n_i d_i$ equals the number of objects.`],
    { demo: 'reduce' },
    { h: ['甲烷：为什么是“sp³”', 'Methane: why “sp³”'] },
    [r`甲烷四根 C–H 键在 $T_d$ 里的特征标：$E$ 下四根都不动（4）；$C_3$ 只留下轴上那一根（1）；$C_2$ 和 $S_4$ 一根也不留（0）；$\sigma_d$ 留下面内的两根（2）。约化得 $\Gamma_\sigma = A_1 + T_2$。查表：$A_1$ 对应碳的 2s，$T_2$ 对应 $(x, y, z)$，也就是三个 2p。所以四根等价的键需要碳贡献 s + 三个 p：这是“sp³ 杂化”在群论里的说法。它也说明了甲烷的光电子能谱为什么有**两个**价层带（$a_1$ 和 $t_2$），而不是四根等价键暗示的一个。`,
     r`The characters of methane’s four C–H bonds in $T_d$: under $E$ all four stay (4); $C_3$ keeps only the bond on its axis (1); $C_2$ and $S_4$ keep none (0); $\sigma_d$ keeps the two in the plane (2). Reduction gives $\Gamma_\sigma = A_1 + T_2$. From the table, $A_1$ matches carbon’s 2s and $T_2$ matches $(x, y, z)$, the three 2p orbitals. So four equivalent bonds need s plus three p from carbon: that is “sp³ hybridisation” in the language of groups. It also explains why methane’s photoelectron spectrum has **two** valence bands ($a_1$ and $t_2$), not the single one four equivalent bonds might suggest.`],
    { h: ['投影算符：造出对称性匹配的组合', 'Projection operators: building symmetry-adapted combinations'] },
    [r`约化告诉你“有几个”，**投影算符**告诉你“长什么样”。对任意一个对象 $\phi$（比如第一个 H 的 1s），把每个操作作用在它上面，乘上第 $i$ 个不可约表示的特征标再加起来，得到的就是按 $\Gamma^{(i)}$ 变换的组合（不为零的话）：`,
     r`Reduction tells you “how many”; the **projection operator** tells you “what they look like”. Take any one object $\phi$ (say the 1s of the first H), apply every operation to it, multiply by the character of irrep $i$ and add: the result transforms as $\Gamma^{(i)}$ (if it is not zero):`],
    { math: r`\hat P^{(i)}\phi = \frac{d_i}{h}\sum_{g\in G}\chi^{(i)}(g)^*\;\hat g\,\phi` },
    [r`对氨的三个 H 1s（$\Gamma = A_1 + E$）：$A_1$ 投影给出 $\tfrac{1}{\sqrt3}(s_1 + s_2 + s_3)$；$E$ 投影给出 $\tfrac{1}{\sqrt6}(2s_1 - s_2 - s_3)$，再从 $s_2$ 出发投影、和前一个正交化，得到另一半 $\tfrac{1}{\sqrt2}(s_2 - s_3)$。这些**对称性匹配线性组合**（SALC）只能和氮上同一对称性的轨道混合：$A_1$ 的和 N 2s、2p_z 混，$E$ 的和 N 2p_x、2p_y 混。久期行列式因此分成小块，3 × 3 甚至更大的问题被拆成几个 1 × 1、2 × 2 的问题。量子化学程序里的“对称性”选项做的就是这件事。`,
     r`For ammonia’s three H 1s orbitals ($\Gamma = A_1 + E$): projecting onto $A_1$ gives $\tfrac{1}{\sqrt3}(s_1 + s_2 + s_3)$; projecting onto $E$ gives $\tfrac{1}{\sqrt6}(2s_1 - s_2 - s_3)$, and projecting from $s_2$ then orthogonalising gives the other half, $\tfrac{1}{\sqrt2}(s_2 - s_3)$. These **symmetry-adapted linear combinations** (SALCs) can mix only with nitrogen orbitals of the same symmetry: the $A_1$ one with N 2s and 2p_z, the $E$ pair with N 2p_x and 2p_y. The secular determinant therefore falls into small blocks, and a 3 × 3 or larger problem becomes a few 1 × 1 and 2 × 2 ones. The “symmetry” option in quantum-chemistry programs does exactly this.`],
    { note: [r`**一个常用的捷径。** 对一维不可约表示，投影只要对“每个类挑一个”操作做就够了吗？不行，必须对群的**全部**元素求和（同一类的不同操作把 $\phi$ 送到不同的地方）。演示里的特征标表格只列出每个类的总和 $g_c\,\chi\,\chi_i$，投影时要把类拆开。`, r`**A common shortcut, and its limit.** For projection, is one operation per class enough? No: you must sum over **every** element of the group (different operations in one class send $\phi$ to different places). The demo’s table shows only the class totals $g_c\,\chi\,\chi_i$; for projection the classes have to be taken apart.`], kind: 'warn' },
  ],
  points: [
    [['约化公式', 'The reduction formula'], ['nᵢ 是 Γ 和第 i 行特征标的内积；必须是非负整数。', 'nᵢ is the inner product of Γ with row i; it must be a non-negative integer.'], 'proved'],
    [['只有不动的才贡献', 'Only what stays put contributes'], ['被移走的对象贡献 0；留下的贡献它被乘的因子（1、−1、tr R……）。', 'Objects moved away contribute 0; those left contribute the factor they are multiplied by (1, −1, tr R, …).'], 'proved'],
    [['投影算符', 'Projection operators'], ['P̂⁽ⁱ⁾φ 对全部元素求和，给出按 Γ⁽ⁱ⁾ 变换的组合。', 'P̂⁽ⁱ⁾φ sums over all elements and gives a combination transforming as Γ⁽ⁱ⁾.'], 'proved'],
    [['久期行列式分块', 'Block-diagonal secular equations'], ['不同不可约表示之间的哈密顿矩阵元为零，大问题拆成小块。', 'Hamiltonian matrix elements between different irreps vanish, so a big problem splits into small blocks.'], 'proved'],
  ],
  math: [
    [r`n_i = \frac{1}{h}\sum_c g_c\,\chi^{\Gamma}(c)\,\chi^{(i)}(c)^*, \qquad \sum_i n_i\,d_i = \dim\Gamma`, ['约化公式和维数核对。', 'The reduction formula and the dimension check.']],
    [r`\hat P^{(i)} = \frac{d_i}{h}\sum_g \chi^{(i)}(g)^*\,\hat g, \qquad \hat P^{(i)}\hat P^{(j)} = \delta_{ij}\hat P^{(i)}`, ['投影算符是幂等、互相正交的。', 'Projection operators are idempotent and mutually orthogonal.']],
    [r`\langle \psi^{(i)} | \hat H | \psi^{(j)} \rangle = 0 \quad (i \ne j)`, ['H 是全对称的，所以只连接同一对称性的态。', 'H is totally symmetric, so it connects only states of the same symmetry.']],
  ],
  example: {
    q: [r`八面体 $\mathrm{SF_6}$ 的六根 S–F σ 键在 $O_h$ 里构成什么表示？硫需要哪些轨道和它们成键？（类：$E, 8C_3, 6C_2, 6C_4, 3C_2{=}C_4^2, i, 6S_4, 8S_6, 3\sigma_h, 6\sigma_d$）`, r`What representation do the six S–F σ bonds of octahedral $\mathrm{SF_6}$ form in $O_h$, and which sulfur orbitals can bond with them? (Classes: $E, 8C_3, 6C_2, 6C_4, 3C_2{=}C_4^2, i, 6S_4, 8S_6, 3\sigma_h, 6\sigma_d$.)`],
    steps: [
      [r`数不动的键：$E$ 6，$C_3$ 0，$C_2$ 0，$C_4$ 2（轴上两根），$C_4^2$ 2，$i$ 0，$S_4$ 0，$S_6$ 0，$\sigma_h$ 4（面内四根），$\sigma_d$ 2。`, r`Count unmoved bonds: $E$ 6, $C_3$ 0, $C_2$ 0, $C_4$ 2 (the two on the axis), $C_4^2$ 2, $i$ 0, $S_4$ 0, $S_6$ 0, $\sigma_h$ 4 (the four in the plane), $\sigma_d$ 2.`],
      [r`约化：$n(A_{1g}) = (6 + 12 + 6 + 12 + 12)/48 = 1$；同样算得 $n(E_g) = 1$，$n(T_{1u}) = 1$，其余为 0。维数核对 $1 + 2 + 3 = 6$。`, r`Reduce: $n(A_{1g}) = (6 + 12 + 6 + 12 + 12)/48 = 1$; likewise $n(E_g) = 1$, $n(T_{1u}) = 1$, the rest 0. Dimension check: $1 + 2 + 3 = 6$.`],
      [r`查表：$A_{1g}$ 是 s，$T_{1u}$ 是 $(x, y, z)$ 即 p，$E_g$ 是 $(z^2, x^2-y^2)$ 即两个 d。`, r`From the table: $A_{1g}$ is s, $T_{1u}$ is $(x, y, z)$, i.e. p, and $E_g$ is $(z^2, x^2-y^2)$, i.e. two d orbitals.`],
    ],
    a: [r`$\Gamma_\sigma = A_{1g} + E_g + T_{1u}$，对称性允许 s + p³ + d²（“sp³d²”）。但计算表明硫的 3d 参与得很少，SF₆ 的成键主要靠离子性和多中心键；群论只说“可以”，不说“有多少”。`, r`$\Gamma_\sigma = A_{1g} + E_g + T_{1u}$, so symmetry allows s + p³ + d² (“sp³d²”). Calculations show, however, that sulfur’s 3d orbitals contribute little, and SF₆ is held together mainly by ionic and multicentre bonding: group theory says what is allowed, not how much.`],
  },
};
