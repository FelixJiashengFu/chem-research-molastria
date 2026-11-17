const r = String.raw;
export default {
  id: 'higher', level: 'frontier', demos: ['area2d'],
  title: ['二维和更高维：PEPS、MERA 和柱面 DMRG', 'Two dimensions and beyond: PEPS, MERA and cylinder DMRG'],
  summary: ['二维的面积律说纠缠和切口的长度成正比，所以把二维格子排成一条链来用 MPS 时，χ 随宽度指数增长。这一章讲柱面上的 DMRG 能做到什么（以及笼目反铁磁和 Hubbard 模型条纹相这两个著名的结论），为二维设计的 PEPS 和它的收缩难题，以及处理临界态的 MERA。', 'The area law in two dimensions says entanglement is proportional to the length of the cut, so when a 2D lattice is laid out as a chain for an MPS, χ grows exponentially with the width. This chapter covers what DMRG on cylinders can do (and two famous results: the kagome antiferromagnet and stripes in the Hubbard model), PEPS designed for two dimensions and their contraction problem, and MERA for critical states.'],
  body: [
    [r`二维 DMRG 的标准做法是把格子卷成一个周长 $W$ 的柱面，沿长度方向用“蛇形”把格点排成一条链。中间的切口长 $W$，面积律给出 $S \approx \alpha W$，所以 MPS 至少要 $\chi \sim e^{\alpha W}$：宽度每加一列，$\chi$ 就乘一个固定的倍数。下面的演示用有能隙的自由费米子把这件事算出来：每加一列，纠缠熵多约 0.29 nat，$\chi$ 乘 1.33。相互作用的自旋模型的倍数通常更大。`,
     r`The standard way to do 2D DMRG is to wrap the lattice into a cylinder of circumference $W$ and snake through the sites along its length to form a chain. The middle cut has length $W$; the area law gives $S \approx \alpha W$, so the MPS needs at least $\chi \sim e^{\alpha W}$: each extra column of width multiplies $\chi$ by a fixed factor. The demo below computes this for gapped free fermions: each extra column adds about 0.29 nat of entanglement and multiplies $\chi$ by 1.33. For interacting spin models the factor is usually larger.`],
    { demo: 'area2d' },
    [r`尽管如此，柱面 DMRG 在 2010 年代成了研究二维强关联问题最可靠的工具之一，宽度到 6–12 个格点，$\chi$ 到上万 [@stoudenmire2012]。两个代表性的结果：`,
     r`Even so, cylinder DMRG became one of the most reliable tools for 2D strongly correlated problems in the 2010s, with widths of 6–12 sites and $\chi$ in the tens of thousands [@stoudenmire2012]. Two representative results:`],
    { list: [
      [r`**笼目反铁磁。** Yan、Huse 和 White 在周长到 12 的柱面上算了笼目格子的 Heisenberg 反铁磁，发现基态是有能隙的自旋液体，没有任何磁序和价键序 [@yan2011]。后来更大的计算和别的方法对它是有能隙的 $\mathbb Z_2$ 自旋液体还是无能隙的 Dirac 自旋液体有不同结论，至今没有定论。`, r`**The kagome antiferromagnet.** Yan, Huse and White studied the kagome-lattice Heisenberg antiferromagnet on cylinders of circumference up to 12 and found a gapped spin-liquid ground state with no magnetic or valence-bond order [@yan2011]. Later, larger calculations and other methods disagree on whether it is a gapped $\mathbb Z_2$ spin liquid or a gapless Dirac spin liquid; the question is still open.`],
      [r`**Hubbard 模型的条纹。** 二维 Hubbard 模型掺杂到 1/8 附近的基态是什么，是高温超导理论的核心问题。Zheng 等人把 DMRG、辅助场量子蒙特卡罗、密度矩阵嵌入和 iPEPS 放在一起比较，几种方法一致给出了条纹序：自旋和电荷的密度波 [@zheng2017]。此前 Simons 合作组已经把十几种方法放在同一组参数上做过基准比较 [@leblanc2015]。`, r`**Stripes in the Hubbard model.** What the ground state of the 2D Hubbard model is near 1/8 doping is a central question for theories of high-temperature superconductivity. Zheng et al. compared DMRG, auxiliary-field quantum Monte Carlo, density-matrix embedding and iPEPS, and the methods agreed on stripe order: spin and charge density waves [@zheng2017]. Earlier, the Simons collaboration had benchmarked more than a dozen methods on a common set of parameters [@leblanc2015].`],
    ] },
    { h: ['PEPS：为二维设计的张量网络', 'PEPS: a tensor network designed for two dimensions'] },
    [r`**投影纠缠对态**（PEPS）在每个格点放一个张量，它有一条物理腿和 $z$ 条虚拟腿（方格子 $z = 4$），每条虚拟腿连向一个邻居 [@verstraete2004peps]。切口切断的虚拟腿数正比于切口长度，每条最多带 $\ln\chi$ 的纠缠，所以 PEPS 天生满足二维的面积律，参数个数是 $N d\chi^4$，随 $N$ 线性。Jordan 等人把它推广到无穷大的平移不变格子（iPEPS）[@jordan2008]。`,
     r`A **projected entangled-pair state** (PEPS) places on each site a tensor with one physical leg and $z$ virtual legs ($z = 4$ on the square lattice), each connected to a neighbour [@verstraete2004peps]. The number of virtual legs a cut severs is proportional to its length, and each carries at most $\ln\chi$ of entanglement, so PEPS satisfy the 2D area law by construction, with $N d\chi^4$ parameters, linear in $N$. Jordan et al. extended them to infinite, translation-invariant lattices (iPEPS) [@jordan2008].`],
    [r`代价在收缩：MPS 的期望值能一列一列地精确算，PEPS 不行。Schuch、Wolf、Verstraete 和 Cirac 证明，精确收缩一般的 PEPS 是 #P 难的 [@schuch2007]。实际计算都用近似收缩：边界 MPS、角转移矩阵、Levin 和 Nave 的张量重整化群 [@levin2007]，它们带来第二个需要控制的截断参数。这也是 PEPS 的程序比 DMRG 难写、难调得多的原因。`,
     r`The price is contraction: MPS expectation values can be computed exactly column by column, PEPS cannot. Schuch, Wolf, Verstraete and Cirac proved that exactly contracting a general PEPS is #P-hard [@schuch2007]. Practical calculations use approximate contraction, such as boundary MPS, corner transfer matrices or Levin and Nave’s tensor renormalisation group [@levin2007], which brings a second truncation parameter to control. That is why PEPS codes are much harder to write and tune than DMRG.`],
    { h: ['MERA：给临界态的网络', 'MERA: a network for critical states'] },
    [r`临界态的纠缠按对数增长，关联按幂律衰减，有限 $\chi$ 的 MPS 都只能近似。Vidal 的**多尺度纠缠重整化拟设**（MERA）在层层粗粒化之间插入“解纠缠器”，网络本身就有尺度不变的结构，可以精确写出对数的纠缠和幂律的关联 [@vidal2007]。`,
     r`Critical states have logarithmic entanglement and power-law correlations, which any finite-$\chi$ MPS can only approximate. Vidal’s **multiscale entanglement renormalisation ansatz** (MERA) inserts “disentanglers” between successive coarse-graining layers; the network itself is scale invariant and can represent logarithmic entanglement and power-law correlations exactly [@vidal2007].`],
    { h: ['费米面破坏面积律', 'Fermi surfaces break the area law'] },
    [r`有 Fermi 面的金属是面积律的著名例外：Wolf 和 Gioev–Klich 2006 年分别证明，自由费米子的纠缠熵是 $S\propto L^{d-1}\ln L$，比面积律多一个对数因子 [@wolf2006, gioev2006]。演示里的蓝线就是这种金属（有限尺寸下对数不太明显）。这让二维和三维的金属对任何张量网络都更难。`,
     r`Metals with a Fermi surface are the famous exception to the area law: Wolf, and Gioev and Klich, proved independently in 2006 that free fermions have entanglement entropy $S\propto L^{d-1}\ln L$, an extra logarithmic factor beyond the area law [@wolf2006, gioev2006]. The blue curve in the demo is such a metal (on finite sizes the logarithm is not very visible). This makes 2D and 3D metals harder for every tensor network.`],
  ],
  points: [
    [['柱面 DMRG 的 χ 随宽度指数增长', 'Cylinder DMRG: χ grows exponentially with width'], ['面积律 S ∝ W 直接给出 χ ≳ e^{αW}。', 'The area law S ∝ W directly gives χ ≳ e^{αW}.'], 'proved'],
    [['Hubbard 模型 1/8 掺杂的条纹', 'Stripes in the Hubbard model at 1/8 doping'], ['多种方法一致（Zheng 等 2017）；纯 Hubbard 模型里有没有超导，仍在争论。', 'Several methods agree (Zheng et al. 2017); whether the pure Hubbard model superconducts is still debated.'], 'frontier'],
    [['笼目反铁磁的基态', 'The kagome antiferromagnet’s ground state'], ['有能隙的 ℤ₂ 自旋液体还是无能隙的 Dirac 自旋液体，结论不一。', 'Gapped ℤ₂ spin liquid or gapless Dirac spin liquid: the conclusions differ.'], 'disputed'],
    [['PEPS 满足二维面积律', 'PEPS satisfy the 2D area law'], ['参数随 N 线性，但精确收缩一般是 #P 难的。', 'Parameters are linear in N, but exact contraction is #P-hard in general.'], 'proved'],
    [['MERA', 'MERA'], ['尺度不变的网络，自然表示临界态的对数纠缠。', 'A scale-invariant network that naturally represents the logarithmic entanglement of critical states.'], 'proved'],
    [['金属：S ∝ L^{d−1} ln L', 'Metals: S ∝ L^{d−1} ln L'], ['自由费米子已证明；相互作用的 Fermi 液体被普遍认为相同。', 'Proved for free fermions; widely believed to hold for interacting Fermi liquids.'], 'proved'],
  ],
  math: [
    [r`S(W) \approx \alpha W \;\Rightarrow\; \chi_\text{MPS} \gtrsim e^{\alpha W}`, ['柱面上的面积律和 MPS 键维的下限。', 'The area law on a cylinder and the lower bound on the MPS bond dimension.']],
    [r`|\psi\rangle = \sum_{\{s\}} \mathcal C\!\left[\prod_{i} A^{[i]\,s_i}_{l_i r_i u_i d_i}\right]|s_1 s_2\cdots s_N\rangle`, ['PEPS：𝒞 表示把相邻张量相同的虚拟腿收缩掉。', 'PEPS: 𝒞 denotes contracting the shared virtual legs of neighbouring tensors.']],
    [r`S_A \propto L^{d-1}\ln L \quad (\text{Fermi surface}), \qquad S_A \propto L^{d-1} \quad (\text{gapped})`, ['费米面对面积律的对数修正。', 'The logarithmic correction a Fermi surface makes to the area law.']],
  ],
  example: {
    q: [r`演示里有能隙（$m = 0.6$）的自由费米子，宽度 2 时 $S = 0.72$，每加一列多 $0.289$。照这个速度，宽度 32 的柱面要多大的 $\chi$？`, r`In the demo’s gapped free fermions ($m = 0.6$), $S = 0.72$ at width 2 and each extra column adds $0.289$. At that rate, what $\chi$ would a width-32 cylinder need?`],
    steps: [
      [r`$S(32) \approx 0.72 + 0.289\times 30 = 9.4$ nat。`, r`$S(32) \approx 0.72 + 0.289\times 30 = 9.4$ nat.`],
      [r`$\chi \ge e^{9.4} \approx 1.2\times10^4$；这只是下限，实际要几倍。`, r`$\chi \ge e^{9.4} \approx 1.2\times10^4$; that is only a lower bound, and in practice several times more is needed.`],
    ],
    a: [r`至少约一万二。这还是最容易的情形（无相互作用、能隙不小）；相互作用的自旋模型每列的 $\Delta S$ 往往更大，这就是柱面 DMRG 停在宽度 6–12 的原因。`, r`At least about twelve thousand. And this is the easiest case (no interactions, a sizeable gap); interacting spin models usually add more $\Delta S$ per column, which is why cylinder DMRG stops at widths of 6–12.`],
  },
};
