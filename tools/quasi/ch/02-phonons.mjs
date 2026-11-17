const r = String.raw;
export default {
  id: 'phonons', level: 'proved', demos: ['count'],
  title: ['声子：最早、最干净的准粒子', 'Phonons: the first and cleanest quasiparticle'],
  summary: ['晶格振动按量子力学一份一份地数，一份就是一个声子。它是“集体激发”这类准粒子的原型：玻色子，数目不守恒，带晶体动量而不是机械动量，热容、热导、热膨胀都由它决定。这一章是概览，详细的内容（九章、十一个演示）在声子馆。', 'Count the lattice vibrations in quantum-mechanical portions and each portion is a phonon. It is the prototype of the “collective excitation” kind of quasiparticle: a boson whose number is not conserved, carrying crystal momentum rather than mechanical momentum, and responsible for heat capacity, thermal conduction and thermal expansion. This chapter is an overview; the details (nine chapters, eleven demos) are in the Phonon hall.'],
  body: [
    [r`晶体里的原子被化学键拴在格点附近。小振幅时势能是位移的二次型，振动分解成互不耦合的**简正模**，每个模有确定的波矢 $\mathbf q$ 和频率 $\omega_s(\mathbf q)$。每个简正模是一个谐振子，量子化以后能量只能是 $\hbar\omega(n + \tfrac12)$。把 $n$ 读作“这个模里有 $n$ 个声子”，振动的晶体就变成了一团声子气。`,
     r`Atoms in a crystal are tied to their lattice sites by chemical bonds. At small amplitude the potential energy is quadratic in the displacements and the vibration splits into uncoupled **normal modes**, each with a definite wavevector $\mathbf q$ and frequency $\omega_s(\mathbf q)$. Each normal mode is a harmonic oscillator whose energy, once quantised, can only be $\hbar\omega(n + \tfrac12)$. Read $n$ as “this mode holds $n$ phonons”, and the vibrating crystal becomes a gas of phonons.`],
    { math: r`H = \sum_{\mathbf q, s}\hbar\omega_s(\mathbf q)\Bigl(a^\dagger_{\mathbf q s}a_{\mathbf q s} + \tfrac12\Bigr), \qquad \langle n_{\mathbf q s}\rangle = \frac{1}{e^{\hbar\omega_s(\mathbf q)/k_BT} - 1}` },
    [r`这是最干净的准粒子：在谐振近似里它**严格**没有相互作用、寿命无穷长，准粒子的说法是一个定理而不是近似。真实晶体的势能里有三次、四次项，声子之间会碰撞、衰减，寿命有限，这正是热阻和热膨胀的来源。`,
     r`This is the cleanest quasiparticle: in the harmonic approximation it is **exactly** non-interacting with infinite lifetime, so the quasiparticle picture is a theorem rather than an approximation. In real crystals the potential has cubic and quartic terms, phonons collide and decay with finite lifetimes, and this is precisely the origin of thermal resistance and thermal expansion.`],
    { h: ['准粒子的三个特征', 'Three hallmarks of a quasiparticle'] },
    { list: [
      [r`**数目不守恒。** 温度升高，声子“凭空”产生；它们的化学势为零。下面的演示数一数每个原子平均有多少个声子。`, r`**No conserved number.** Raise the temperature and phonons appear “from nowhere”; their chemical potential is zero. The demo below counts the mean number of phonons per atom.`],
      [r`**晶体动量。** 声子带 $\hbar\mathbf q$，但 $\mathbf q$ 只定义到差一个倒格矢，也不是原子的总机械动量。碰撞里它守恒到一个倒格矢；“倒逆过程”正是热阻的来源。`, r`**Crystal momentum.** A phonon carries $\hbar\mathbf q$, but $\mathbf q$ is defined only up to a reciprocal-lattice vector and is not the atoms’ total mechanical momentum. It is conserved in collisions up to a reciprocal-lattice vector; “umklapp processes” are the source of thermal resistance.`],
      [r`**只在材料里存在。** 晶体熔化或者原子被拿走，声子就不存在了。它的“粒子性”是 $10^{23}$ 个原子一起动的方式。`, r`**Exists only in the material.** Melt the crystal or remove the atoms and the phonon is gone. Its “particle-ness” is a way for $10^{23}$ atoms to move together.`],
    ] },
    { demo: 'count' },
    { h: ['从 Einstein 到中子', 'From Einstein to neutrons'] },
    [r`声子的故事在准粒子里最早。1907 年 Einstein 把 Planck 的量子用到固体的振动上，第一次解释了热容在低温下的下降 [@einstein1907]；1912 年 Debye 用连续介质的声波代替单一频率，得到低温热容的 $T^3$ 定律 [@debye1912]。“声子”这个名字是 1930 年代照着“光子”造的。四十多年以后，Brockhouse 用中子非弹性散射直接测出了铝的声子色散 [@brockhouse1955]：一个中子进来，放出或吸收一个声子，能量和动量的变化就是声子的 $\omega$ 和 $\mathbf q$。准粒子从此不只是理论上方便的说法，而是可以一个模式一个模式测出来的东西。`,
     r`Phonons have the oldest story among quasiparticles. In 1907 Einstein applied Planck’s quanta to the vibrations of a solid and explained for the first time why the heat capacity falls at low temperature [@einstein1907]; in 1912 Debye replaced the single frequency with continuum sound waves and obtained the $T^3$ law of low-temperature heat capacity [@debye1912]. The name “phonon” was coined in the 1930s on the model of “photon”. More than forty years later, Brockhouse measured the phonon dispersion of aluminium directly by inelastic neutron scattering [@brockhouse1955]: a neutron comes in, emits or absorbs one phonon, and its change in energy and momentum gives the phonon’s $\omega$ and $\mathbf q$. From then on quasiparticles were not just a convenient theoretical language but something measurable mode by mode.`],
    [r`声子还是别的准粒子的“衣服”：电子拖着晶格畸变成为极化子（{{ch:polarons}}），交换声子让电子配成 Cooper 对（{{ch:cooper}}），光和光学声子混成声子极化激元（{{ch:polaritons}}），ARPES 能带上的扭折也常常是声子留下的（{{ch:measure}}）。`,
     r`Phonons are also the “clothing” of other quasiparticles: an electron dragging a lattice distortion becomes a polaron ({{ch:polarons}}), exchanging phonons pairs electrons into Cooper pairs ({{ch:cooper}}), light and optical phonons mix into phonon-polaritons ({{ch:polaritons}}), and kinks in ARPES bands are often left by phonons ({{ch:measure}}).`],
    { note: [r`**详细内容在[[quasiparticles/phonons/|声子馆]]。** 九章：一维原子链、双原子链和光学支、三维晶体和布里渊区、量子化和态密度、热容、怎样测声子（中子、X 射线、拉曼）、非谐性和热膨胀、热导率、从第一性原理和机器学习势算声子；十一个当场计算的演示，53 篇按 DOI 核对过的文献。`, r`**The details are in the [[quasiparticles/phonons/|Phonon hall]].** Nine chapters: the one-dimensional chain, the diatomic chain and optical branches, three-dimensional crystals and the Brillouin zone, quantisation and the density of states, heat capacity, how phonons are measured (neutrons, X-rays, Raman), anharmonicity and thermal expansion, thermal conductivity, and computing phonons from first principles and machine-learned potentials; eleven live demos and 53 DOI-checked references.`], kind: 'info' },
  ],
  points: [
    [['每个简正模一个谐振子', 'One oscillator per normal mode'], ['谐振晶体的哈密顿量严格分解成谐振子之和，激发数就是声子数。', 'The harmonic crystal’s Hamiltonian splits exactly into oscillators, and excitation numbers are phonon numbers.'], 'proved'],
    [['玻色子、化学势为零', 'Bosons with zero chemical potential'], ['平衡时 ⟨n⟩ 是 μ = 0 的 Bose–Einstein 分布；声子数随温度变。', 'In equilibrium ⟨n⟩ is the Bose–Einstein distribution with μ = 0; the phonon number changes with temperature.'], 'proved'],
    [['寿命来自非谐性', 'Lifetimes come from anharmonicity'], ['三次、四次项让声子碰撞和衰减，带来热阻和热膨胀。', 'Cubic and quartic terms make phonons collide and decay, giving thermal resistance and thermal expansion.'], 'tested'],
    [['可以一个模式一个模式测', 'Measurable mode by mode'], ['中子非弹性散射直接测出 ω(q)；后来又有非弹性 X 射线散射和拉曼。', 'Inelastic neutron scattering measures ω(q) directly; inelastic X-ray scattering and Raman followed.'], 'tested'],
  ],
  math: [
    [r`\frac{n}{N} = 9\Bigl(\frac{T}{\Theta_D}\Bigr)^3\int_0^{\Theta_D/T}\frac{x^2\,dx}{e^x - 1} \;\xrightarrow{T \ll \Theta_D}\; 18\zeta(3)\Bigl(\frac{T}{\Theta_D}\Bigr)^3`, ['Debye 模型里每个原子的声子数。', 'Phonons per atom in the Debye model.']],
    [r`\hbar\mathbf q \equiv \hbar\mathbf q + \hbar\mathbf G`, ['晶体动量只定义到一个倒格矢。', 'Crystal momentum is defined only up to a reciprocal-lattice vector.']],
    [r`E_f - E_i = \mp\hbar\omega_s(\mathbf q), \qquad \mathbf k_i - \mathbf k_f = \pm\mathbf q + \mathbf G`, ['中子放出（上号）或吸收（下号）一个声子时的守恒律。', 'Conservation laws when a neutron emits (upper sign) or absorbs (lower sign) one phonon.']],
  ],
  example: {
    q: [r`铜的 Debye 温度约 343 K，原子密度 $8.5\times10^{22}$ cm⁻³。在 10 K，每立方厘米里大约有多少个热声子？`, r`Copper has a Debye temperature of about 343 K and an atom density of $8.5\times10^{22}$ cm⁻³. Roughly how many thermal phonons are there per cubic centimetre at 10 K?`],
    steps: [
      [r`$T/\Theta_D = 10/343 = 0.0292$，处在低温极限，$n/N \approx 18\zeta(3)(T/\Theta_D)^3 = 21.6\times(0.0292)^3 = 5.4\times10^{-4}$。`, r`$T/\Theta_D = 10/343 = 0.0292$, deep in the low-temperature limit, so $n/N \approx 18\zeta(3)(T/\Theta_D)^3 = 21.6\times(0.0292)^3 = 5.4\times10^{-4}$.`],
      [r`乘上原子密度：$5.4\times10^{-4}\times8.5\times10^{22} = 4.6\times10^{19}$ cm⁻³。`, r`Multiply by the atom density: $5.4\times10^{-4}\times8.5\times10^{22} = 4.6\times10^{19}$ cm⁻³.`],
    ],
    a: [r`约 $5\times10^{19}$ 个每立方厘米，是每两千个原子一个。到室温，每个原子平均就有两个多声子了（演示里选铜、拉到 300 K 看看）。`, r`About $5\times10^{19}$ per cubic centimetre, one for every two thousand atoms. By room temperature there are more than two phonons per atom on average (pick copper in the demo and slide to 300 K).`],
  },
};
