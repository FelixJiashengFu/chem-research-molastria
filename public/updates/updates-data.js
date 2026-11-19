/* 最近更新（updates/）的内容：新栏目和新功能，最新的在最前面。
   每条：id、date（发布当天，美东时间 YYYY-MM-DD）、path（从站点根写起）、group（顶栏的分组，决定图标底色）、icon（updates.js 的 ICONS）、
   zh / en 是标题，note 是一行说明 [中文, English]，more 是点“更多”后的几句 [中文, English]。
   读章进度：store 是那个栏目在本机存读过的章的键（{ seen: [章 id…] }），chapters 是总章数；只算其中几章时写 need: [章 id…]。
   没有 store 的条目，打开过那一页就算看过。
   加一条：写在 items 最前面，同时把 shared-nav.js 的 UPDATES_LATEST 改成这一条的 date（tools/updates-test.mjs 核对两边一致）。 */
window.MOLASTRIA_UPDATES = {
  items: [
    {
      id: 'quacc', date: '2026-11-19', path: 'code/index.html#p-quacc', group: 'make', icon: 'atoms',
      zh: '开源代码台 · quacc 流水线', en: 'Code Desk · quacc pipelines',
      note: ['一次交一批分子：优化、频率、表面能，用 quacc 的配方', 'Hand in a batch of molecules: relax, frequencies, surface energies, with quacc recipes'],
      more: ['quacc（BSD 3-Clause，Andrew Rosen）是一套把计算写成作业和流程的 Python 库。代码台的新标签能选配方和免费引擎（GFN2-xTB、Psi4、EMT），一次最多 8 个分子交给在线服务，也能拿到一段在自己电脑上跑的脚本。ORCA 只写脚本，不在线跑（学术许可）。',
        'quacc (BSD 3-Clause, Andrew Rosen) is a Python library that writes calculations as jobs and flows. The new Code Desk tab picks a recipe and a free engine (GFN2-xTB, Psi4, EMT), sends up to 8 molecules to the online service, or gives you a script to run on your own computer. ORCA is script-only, never run online (academic licence).'],
    },
    {
      id: 'extract', date: '2026-11-19', path: 'extract/index.html', group: 'make', icon: 'extract',
      zh: '文献信息抽取', en: 'Literature Extractor',
      note: ['一组 AI 智能体从反应图读出反应、条件和产率', 'A team of AI agents reads reactions, conditions and yields from a figure'],
      more: ['照 ChemEAGLE（arXiv:2507.20230）的分工重写：规划先看图，再分别读反应式、分子、底物表、条件和图注；R 基团由规则代入枚举，SMILES 用 RDKit 核对，每条反应打分。表格能改，导出 JSON 和 CSV；“看示范”不用 AI。',
        'Rebuilt after ChemEAGLE (arXiv:2507.20230): a planner looks at the figure, then agents read the scheme, molecules, scope table, conditions and caption; R groups are filled by rule, SMILES checked with RDKit, every reaction scored. Edit the table, export JSON or CSV; the demo needs no AI.'],
    },
    {
      id: 'om-sensetime', date: '2026-11-18', path: 'open-models/sensetime/index.html', group: 'models', icon: 'loop',
      zh: '开放模型馆 · 商汤科技', en: 'Open Model Hall · SenseTime',
      note: ['第十三个展馆：能装进自己电脑的 SenseNova-Loop-9B', 'Pavilion 13: SenseNova-Loop-9B, small enough for your own computer'],
      more: ['9B 参数、能看图的循环层语言模型（同一组层算两遍），Apache 2.0 许可，4 位量化后约 4.9 GB。展馆里有一段照模型卡核对过的“怎么用”：下载、加载、读图、长上下文，适合给计算化学当本地助手。',
        'A 9B looped-layer language model that also reads images (the same layers run twice), Apache 2.0, about 4.9 GB at 4-bit. The pavilion has a how-to checked against the model card: download, load, read an image, long context. A good local assistant for computational chemistry.'],
    },
    {
      id: 'home-curl', date: '2026-11-17', path: 'index.html#hero-stage', group: 'find', icon: 'page',
      zh: '首页图册：像翻书一样卷页', en: 'Home figure book: pages that curl',
      note: ['十二页现算的图，手指或鼠标拖着翻，纸会弯', 'Twelve live figures; drag a page with a finger or mouse and the paper bends'],
      more: ['首页右侧的栏目图版换成了卷页翻书：纸不拉伸，拉住的点一直在手指下，背面和底下一页有光影。松手按进度和速度翻完或落回；一次翻页 1.8 秒，九秒自动翻一页。',
        'The figure book on the home page now turns like a real page: the paper never stretches, the point you hold stays under your finger, and the back and the page below are shaded. Let go and it finishes or falls back by how far and how fast you pulled; a turn takes 1.8 s, and it turns by itself every nine seconds.'],
    },
    {
      id: 'chmd11', date: '2026-11-17', path: 'spectra/index.html#sp-practice', group: 'explore', icon: 'nmr',
      zh: '谱图馆练习题：三道核磁解谱', en: 'Spectra Hall practice: three NMR problems',
      note: ['CHMD11 课前练习，带提示和折叠的解析', 'CHMD11 pre-class practice, with hints and folded solutions'],
      more: ['谱图按原题峰位重画，结构式由 RDKit 生成。先看提示再看解析；第二题的三自旋体系按精确解拟合过。',
        'Spectra redrawn from the original peak positions, structures drawn by RDKit. Hints first, then the solution; the three-spin system in problem 2 is fitted exactly.'],
    },
    {
      id: 'md', date: '2026-11-17', path: 'md/index.html', group: 'explore', icon: 'md', store: 'molastria-md', chapters: 10,
      zh: '分子动力学与自由能', en: 'Molecular Dynamics & Free Energy',
      note: ['十章、十二个现算的演示，从积分器到马尔可夫模型', 'Ten chapters and twelve live demos, from integrators to Markov models'],
      more: ['Verlet 的影子能量、七种恒温器、FEP/BAR/TI、伞形采样和 WHAM、元动力学、Jarzynski 拉伸、马尔可夫态模型对照精确本征值，最后讲误差棒怎么算。78 篇文献按 DOI 核对过。',
        'Shadow energy of Verlet, seven thermostats, FEP/BAR/TI, umbrella sampling with WHAM, metadynamics, Jarzynski pulling and a Markov state model checked against exact eigenvalues, ending with honest error bars. 78 references checked by DOI.'],
    },
    {
      id: 'tensor', date: '2026-11-17', path: 'tensor/index.html', group: 'explore', icon: 'tensor', store: 'molastria-tensor', chapters: 10,
      zh: '张量网络与强关联', en: 'Tensor Networks & Strong Correlation',
      note: ['十章，浏览器里真跑的 DMRG', 'Ten chapters, with a real DMRG running in your browser'],
      more: ['从纠缠和面积律讲到 MPS、DMRG、时间演化和二维，再到量子化学 DMRG、CASSCF 对照和 FeMoco。十四个演示，DMRG 的误差对照自由费米子精确解；95 篇文献。',
        'From entanglement and the area law to MPS, DMRG, time evolution and two dimensions, then quantum-chemistry DMRG, the CASSCF comparison and FeMoco. Fourteen demos; the DMRG error is checked against exact free fermions. 95 references.'],
    },
    {
      id: 'photochem', date: '2026-11-17', path: 'photochem/index.html', group: 'explore', icon: 'light', store: 'molastria-photochem', chapters: 11,
      zh: '光化学与激发态', en: 'Photochemistry & Excited States',
      note: ['十一章、十五个演示，从 Jablonski 图到飞秒化学', 'Eleven chapters and fifteen demos, from the Jablonski diagram to femtochemistry'],
      more: ['Franck–Condon、Kasha 规则和能隙律、Förster 能量转移、锥形交叉和 Landau–Zener、Marcus 倒置区、TADF、光催化和瞬态吸收。72 篇文献按 DOI 核对过。',
        'Franck–Condon, Kasha’s rule and the energy-gap law, Förster transfer, conical intersections and Landau–Zener, the Marcus inverted region, TADF, photocatalysis and transient absorption. 72 references checked by DOI.'],
    },
    {
      id: 'em', date: '2026-11-17', path: 'em/index.html', group: 'explore', icon: 'field', store: 'molastria-em', chapters: 12,
      zh: '电磁学与介电', en: 'Electromagnetism & Dielectrics',
      note: ['十二章，从麦克斯韦方程到溶剂化模型和 Ewald 求和', 'Twelve chapters, from Maxwell’s equations to solvation models and Ewald sums'],
      more: ['多极展开、Onsager–Kirkwood、PCM 和 COSMO、介电弛豫和 Kramers–Kronig、磁性和磁滞、辐射和散射，最后是计算电磁学。十五个现算的演示，55 篇文献。',
        'Multipoles, Onsager–Kirkwood, PCM and COSMO, dielectric relaxation and Kramers–Kronig, magnetism and hysteresis, radiation and scattering, and computational electromagnetics. Fifteen live demos, 55 references.'],
    },
    {
      id: 'chemml', date: '2026-11-17', path: 'chem-ml/index.html', group: 'models', icon: 'graph', store: 'molastria-chemml', chapters: 10,
      zh: '化学机器学习', en: 'Chemical Machine Learning',
      note: ['十章、十七个演示：表示、高斯过程、贝叶斯优化、评估的陷阱', 'Ten chapters, seventeen demos: representations, Gaussian processes, Bayesian optimisation, evaluation traps'],
      more: ['自己写的 SMILES 读法和 ECFP、消息传递网络、主动学习、生成模型和自驱实验室；“评估的陷阱”一章能亲手看到数据泄漏和骨架划分的差别。64 篇文献。',
        'Hand-written SMILES parsing and ECFP, message passing, active learning, generative models and self-driving labs; the evaluation chapter lets you watch leakage and scaffold splits change the score. 64 references.'],
    },
    {
      id: 'reaction', date: '2026-11-17', path: 'reaction/index.html', group: 'explore', icon: 'barrier', store: 'molastria-reaction', chapters: 8,
      zh: '反应动力学与过渡态', en: 'Reaction Kinetics & Transition States',
      note: ['八章、十三个演示：势能面、NEB、过渡态理论、隧穿', 'Eight chapters, thirteen demos: energy surfaces, NEB, transition-state theory, tunnelling'],
      more: ['在 Müller–Brown 势上找驻点、跑 CI-NEB 和 IRC；Eyring 公式、RRKM、Eckart 隧穿、动力学同位素效应、微观动力学和能量跨度模型。54 篇文献。',
        'Find stationary points on the Müller–Brown surface and run CI-NEB and IRC; then Eyring, RRKM, Eckart tunnelling, kinetic isotope effects, microkinetics and the energetic span model. 54 references.'],
    },
    {
      id: 'dft', date: '2026-11-17', path: 'dft/index.html', group: 'explore', icon: 'density', store: 'molastria-dft', chapters: 10,
      zh: '密度泛函理论', en: 'Density Functional Theory',
      note: ['十章，从 Hohenberg–Kohn 到 TDDFT，十二个现算的演示', 'Ten chapters from Hohenberg–Kohn to TDDFT, twelve live demos'],
      more: ['Hubbard 二聚体的精确解和密度反演、一维 Kohn–Sham 自洽场（线性混合对 DIIS）、Jacob 阶梯、离域误差和分数电子数、色散校正、k 点和固体，最后讲怎么选泛函。70 篇文献。',
        'The exact Hubbard dimer and density inversion, a 1-D Kohn–Sham SCF (linear mixing against DIIS), Jacob’s ladder, delocalisation error and fractional charges, dispersion, k-points and solids, and how to choose a functional. 70 references.'],
    },
    {
      id: 'macro-rg', date: '2026-11-17', path: 'macro/index.html#c-critical', group: 'explore', icon: 'spins', store: 'molastria-macro', need: ['critical'],
      zh: '热、统计与流体 · 第四章', en: 'Heat, Statistics & Flow · chapter 4',
      note: ['新的一章：相变与重整化群', 'A new chapter: phase transitions and the renormalisation group'],
      more: ['Ising 模型的 Metropolis 和 Wolff、Landau 自由能、Kadanoff 块自旋、Migdal–Kadanoff 递推、临界指数和标度关系，一直讲到共形自举。',
        'The Ising model with Metropolis and Wolff, Landau free energy, Kadanoff block spins, the Migdal–Kadanoff recursion, critical exponents and scaling relations, all the way to the conformal bootstrap.'],
    },
    {
      id: 'group', date: '2026-11-17', path: 'group-theory/index.html', group: 'explore', icon: 'symmetry', store: 'molastria-group', chapters: 12,
      zh: '群论', en: 'Group Theory',
      note: ['十二章，可点的点群判定流程图，贴 XYZ 就能判点群', 'Twelve chapters, a clickable point-group flowchart, and point groups from pasted XYZ'],
      more: ['从什么是群讲到特征标表、分子轨道、振动选择定则、配位场、空间群、李群、能带和对称性破缺。贴一段 XYZ 坐标，在容差内找对称元素、判点群，还能给出对称化以后的坐标。',
        'From what a group is to character tables, molecular orbitals, vibrational selection rules, ligand fields, space groups, Lie groups, bands and symmetry breaking. Paste XYZ coordinates to find the symmetry elements within a tolerance, get the point group and copy symmetrised coordinates.'],
    },
    {
      id: 'quasi', date: '2026-11-16', path: 'quasiparticles/index.html', group: 'explore', icon: 'wave', store: 'molastria-quasi', chapters: 12,
      zh: '准粒子和声子馆', en: 'Quasiparticles & the Phonon Hall',
      note: ['声子、激子、极化子、库珀对、任意子……十二章，外加九章的声子馆', 'Phonons, excitons, polarons, Cooper pairs, anyons… twelve chapters, plus a nine-chapter phonon hall'],
      more: ['十三个现算的演示：谱函数、单磁振子精确对角化、Feynman 极化子、BCS 能隙方程、Kitaev 链的零能模。声子馆从一维链讲到热导率和机器学习势。',
        'Thirteen live demos: spectral functions, exact single-magnon diagonalisation, the Feynman polaron, the BCS gap equation, Kitaev-chain zero modes. The phonon hall runs from the 1-D chain to thermal conductivity and machine-learned potentials.'],
    },
    {
      id: 'nequip', date: '2026-11-16', path: 'nequip/index.html', group: 'models', icon: 'atoms', store: 'molastria-nequip', chapters: 8,
      zh: 'NequIP', en: 'NequIP',
      note: ['等变神经网络原子间势，八章、十个演示', 'Equivariant neural interatomic potentials, eight chapters and ten demos'],
      more: ['球谐函数、Wigner D、CG 系数和张量积一步步搭起来，再看 NequIP 的结构、为什么力是保守的，以及论文的数据效率和 Allegro、MACE。演示全部按论文公式自己写。',
        'Spherical harmonics, Wigner D, Clebsch–Gordan coefficients and tensor products built step by step, then the NequIP architecture, why its forces are conservative, the paper’s data efficiency, Allegro and MACE. Every demo is written from the paper’s equations.'],
    },
    {
      id: 'optics', date: '2026-11-16', path: 'optics/index.html', group: 'explore', icon: 'lens', store: 'molastria-optics', chapters: 8,
      zh: '光学', en: 'Optics',
      note: ['八章，从惠更斯的波场水槽到 X 射线衍射和阿贝成像', 'Eight chapters, from Huygens’ ripple tank to X-ray diffraction and Abbe imaging'],
      more: ['干涉和相干性、衍射、光栅与光谱仪、粉末和单晶衍射、偏振和菲涅耳公式、精确光线追迹、傅里叶光学。十二个演示，46 篇文献。',
        'Interference and coherence, diffraction, gratings and spectrometers, powder and single-crystal diffraction, polarisation and the Fresnel equations, exact ray tracing, Fourier optics. Twelve demos, 46 references.'],
    },
    {
      id: 'om-shlab', date: '2026-11-16', path: 'open-models/shlab/index.html', group: 'models', icon: 'crystal',
      zh: '开放模型馆 · 上海人工智能实验室', en: 'Open Model Hall · Shanghai AI Lab',
      note: ['第十二个展馆：会读分子和晶体的 Sage-S2.1-Flash', 'Pavilion 12: Sage-S2.1-Flash, which reads molecules and crystals'],
      more: ['书生 S2.1 Flash 是 320B 总参数、激活 18B 的科学多模态模型，能读分子图、晶体结构和蛋白质结构，代码和参数都是 MIT 许可。展馆里还收了 Intern-S2 和 Intern-S1。',
        'Sage-S2.1-Flash is a scientific multimodal model with 320B total and 18B active parameters that reads molecular graphs, crystal structures and protein structures; code and weights are MIT-licensed. Intern-S2 and Intern-S1 are in the pavilion too.'],
    },
  ],
};
