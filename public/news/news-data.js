'use strict';
// 化学与材料新闻（图解版）：全部内容，中英两版。新的一条加在 items 的最前面（新的在前）。
// 每条：一句话、白话讲清楚、一步步怎么做到的、关键数字（每个数字注明出处）、为什么重要、还没做到的、演示、站内相关、文献。
// 关键数字的 src：'paper'（论文原文）、'calc'（由论文给的常数算出，算法写在 note 里）、'press'（新闻稿）。
// 文献的 checked：怎么核对的（tools/news-refs.mjs 按 DOI 在 OpenAlex 重查）。
// 正文里 x_{…}、x^{…} 写成上下标。
window.MOLASTRIA_NEWS = (() => {
  const T = (zh, en) => ({ zh, en });

  const fields = {
    materials: T('材料化学', 'Materials chemistry'),
    physical: T('物理化学', 'Physical chemistry'),
    quantum: T('量子技术', 'Quantum technology'),
    spectroscopy: T('波谱', 'Spectroscopy'),
    catalysis: T('催化', 'Catalysis'),
    ml: T('机器学习', 'Machine learning'),
  };

  const refs = [
    { id: 'huo2026', authors: 'S. Huo, X.-M. Cao', year: 2026, title: 'Accelerating high-throughput catalyst screening by direct generation of equilibrium adsorption structures', journal: 'Nature Communications', vol: 'in press', pages: 'article in press', doi: '10.1038/s41467-026-79243-9', oa: true, checked: 'OpenAlex' },
    { id: 'mamun2019', authors: 'O. Mamun, K. T. Winther, J. R. Boes, T. Bligaard', year: 2019, title: 'High-throughput calculations of catalytic properties of bimetallic alloy surfaces', journal: 'Scientific Data', vol: '6', pages: '76', doi: '10.1038/s41597-019-0080-z', oa: true, checked: 'OpenAlex' },
    { id: 'boes2019', authors: 'J. R. Boes, O. Mamun, K. Winther, T. Bligaard', year: 2019, title: 'Graph Theory Approach to High-Throughput Surface Adsorption Structure Generation', journal: 'The Journal of Physical Chemistry A', vol: '123', pages: '2281–2285', doi: '10.1021/acs.jpca.9b00311', checked: 'OpenAlex' },
    { id: 'schutt2021', authors: 'K. T. Schütt, O. T. Unke, M. Gastegger', year: 2021, title: 'Equivariant message passing for the prediction of tensorial properties and molecular spectra', journal: 'Proceedings of the 38th International Conference on Machine Learning (PMLR 139)', vol: '139', pages: '9377–9388', doi: '10.48550/arXiv.2102.03150', checked: 'OpenAlex (arXiv record)' },
    { id: 'li2023bbdm', authors: 'B. Li, K. Xue, B. Liu, Y.-K. Lai', year: 2023, title: 'BBDM: Image-to-Image Translation with Brownian Bridge Diffusion Models', journal: 'IEEE/CVF Conference on Computer Vision and Pattern Recognition (CVPR)', vol: '2023', pages: '1952–1961', doi: '10.48550/arXiv.2205.07680', checked: 'OpenAlex (arXiv record)' },
    { id: 'wood2025', authors: 'B. M. Wood, M. Dzamba, X. Fu, M. Gao, M. Shuaibi, L. Barroso-Luque, K. Abdelmaqsoud, V. Gharakhanyan et al.', year: 2025, title: 'UMA: A Family of Universal Models for Atoms', journal: 'Advances in Neural Information Processing Systems (NeurIPS 2025)', vol: '38', pages: '143528–143564', doi: '10.48550/arXiv.2506.23971', checked: 'OpenAlex (arXiv record)' },
    { id: 'chanussot2021', authors: 'L. Chanussot, A. Das, S. Goyal, T. Lavril, M. Shuaibi, M. Riviere, K. Tran, J. Heras-Domingo et al.', year: 2021, title: 'Open Catalyst 2020 (OC20) Dataset and Community Challenges', journal: 'ACS Catalysis', vol: '11', pages: '6059–6072', doi: '10.1021/acscatal.0c04525', checked: 'OpenAlex' },
    { id: 'lan2023', authors: 'J. Lan, A. Palizhati, M. Shuaibi, B. M. Wood, B. Wander, A. Das, M. Uyttendaele, C. L. Zitnick, Z. W. Ulissi', year: 2023, title: 'AdsorbML: a leap in efficiency for adsorption energy calculations using generalizable machine learning potentials', journal: 'npj Computational Materials', vol: '9', pages: '172', doi: '10.1038/s41524-023-01121-5', oa: true, checked: 'OpenAlex' },
    { id: 'kulkarni2018', authors: 'A. Kulkarni, S. Siahrostami, A. Patel, J. K. Nørskov', year: 2018, title: 'Understanding Catalytic Activity Trends in the Oxygen Reduction Reaction', journal: 'Chemical Reviews', vol: '118', pages: '2302–2312', doi: '10.1021/acs.chemrev.7b00488', checked: 'OpenAlex' },
    { id: 'hamachi2026', authors: 'T. Hamachi, Y. Huang, H. J. Eckvahl, A. Carella, K. R. Peinkofer, R. M. Young, M. D. Krzyaniak, T. Ito, Y. Kurashige, R. Yabuki, M. R. Wasielewski, N. Yanai', year: 2026, title: 'Sublevel-selective electron spin hyperpolarization of triplet radical pairs in metal–organic frameworks', journal: 'Nature Communications', vol: '17', pages: '11489', doi: '10.1038/s41467-026-79262-6', oa: true, checked: 'Crossref' },
    { id: 'inoue2026', authors: 'M. Inoue, W. Ishii, T. W. Bradbury, H. Nagashima, A. Inglis, Y. Aoyama, Y. Nishiyama, M. Asada, T. Nakamura, K. Maeda, Y. Kobori, J. Clark, S. L. Bayliss, N. Yanai', year: 2026, title: 'Optically Addressable Spins in a Metal–Organic Framework', journal: 'Journal of the American Chemical Society', vol: '148', pages: '44541–44548', doi: '10.1021/jacs.6c12867', oa: true, checked: 'OpenAlex, Crossref' },
    { id: 'yamauchi2024', authors: 'A. Yamauchi, K. Tanaka, M. Fuki et al.', year: 2024, title: 'Room-temperature quantum coherence of entangled multiexcitons in a metal-organic framework', journal: 'Science Advances', vol: '10', pages: 'eadi3147', doi: '10.1126/sciadv.adi3147', checked: 'Crossref' },
    { id: 'bayliss2020', authors: 'S. L. Bayliss, D. W. Laorenza, P. J. Mintun, B. D. Kovos, D. E. Freedman, D. D. Awschalom', year: 2020, title: 'Optically addressable molecular spins for quantum information processing', journal: 'Science', vol: '370', pages: '1309–1312', doi: '10.1126/science.abb9352', checked: 'Crossref' },
    { id: 'wasielewski2020', authors: 'M. R. Wasielewski, M. D. E. Forbes, N. L. Frank et al.', year: 2020, title: 'Exploiting chemistry and molecular systems for quantum information science', journal: 'Nature Reviews Chemistry', vol: '4', pages: '490–504', doi: '10.1038/s41570-020-0200-5', checked: 'Crossref' },
    { id: 'furukawa2013', authors: 'H. Furukawa, K. E. Cordova, M. O’Keeffe, O. M. Yaghi', year: 2013, title: 'The chemistry and applications of metal-organic frameworks', journal: 'Science', vol: '341', pages: '1230444', doi: '10.1126/science.1230444', checked: 'Crossref' },
    { id: 'degen2017', authors: 'C. L. Degen, F. Reinhard, P. Cappellaro', year: 2017, title: 'Quantum sensing', journal: 'Reviews of Modern Physics', vol: '89', pages: '035002', doi: '10.1103/RevModPhys.89.035002', checked: 'Crossref' },
    { id: 'doherty2013', authors: 'M. W. Doherty, N. B. Manson, P. Delaney, F. Jelezko, J. Wrachtrup, L. C. L. Hollenberg', year: 2013, title: 'The nitrogen-vacancy colour centre in diamond', journal: 'Physics Reports', vol: '528', pages: '1–45', doi: '10.1016/j.physrep.2013.02.001', checked: 'Crossref' },
    { id: 'hore2016', authors: 'P. J. Hore, H. Mouritsen', year: 2016, title: 'The radical-pair mechanism of magnetoreception', journal: 'Annual Review of Biophysics', vol: '45', pages: '299–344', doi: '10.1146/annurev-biophys-032116-094545', checked: 'Crossref' },
  ];

  // 站内相关：[地址, 中文, 英文]
  const site = {
    wb: ['../workbench/index.html#crystal', '计算工作台 · 晶体与表面（切平板）', 'Workbench · Crystals & surfaces (cut slabs)'],
    micro: ['../reaction/index.html#c-micro', '反应动力学 · 微观动力学和火山图', 'Reaction kinetics · microkinetics and volcano plots'],
    volcano: ['../chemistry/electrochem/index.html#c-kinetics', '化学学科馆 · 电化学 · 电极动力学（火山图）', 'Chemistry Disciplines · Electrochemistry · electrode kinetics (volcano plots)'],
    wmmol: ['../world-models/index.html#c-molecular', '世界模型 · 分子和材料', 'World Models · molecules and materials'],
    nqpractice: ['../nequip/index.html#c-practice', 'NequIP · 训练部署与基础模型', 'NequIP · training, deployment and foundation models'],
    cmleval: ['../chem-ml/index.html#c-eval', '化学机器学习 · 评估的陷阱', 'Chemistry ML · evaluation pitfalls'],
    dftsolids: ['../dft/index.html#c-solids', '密度泛函理论 · 固体和高通量计算', 'DFT · solids and high-throughput calculations'],
    epr: ['../spectra/index.html#m-epr', '谱图馆 · 电子顺磁共振', 'Spectra Hall · EPR'],
    hyper: ['../nmr/index.html#s-hyper', '核磁共振 · 超极化', 'NMR · Hyperpolarisation'],
    qcomp: ['../quantum/computing/index.html', '量子嘉年华 · 量子计算机', 'Quantum Carnival · Quantum computers'],
    qbio: ['../quantum/biology/index.html', '量子嘉年华 · 量子生物学（自由基对与磁感应）', 'Quantum Carnival · Quantum biology (radical pairs and magnetoreception)'],
    qphys: ['../quantum/physics/index.html', '量子嘉年华 · 量子物理（自旋）', 'Quantum Carnival · Quantum physics (spin)'],
    code: ['../code/index.html', '开源代码台（写 PySCF / ORCA 输入）', 'Code Desk (write PySCF / ORCA inputs)'],
    porous: ['../chemistry/materials/index.html#c-porous', '化学学科馆 · 材料化学 · 多孔材料与金属有机框架', 'Chemistry Disciplines · Materials · porous materials and MOFs'],
    magnetism: ['../chemistry/coordination/index.html#c-magnetism', '化学学科馆 · 配位化学 · 磁性', 'Chemistry Disciplines · Coordination · magnetism'],
  };

  const items = [
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'dbcata-adsorption',
      date: '2026-11-22',
      fields: ['catalysis', 'ml', 'materials'],
      kicker: T('催化 · 生成模型 · 高通量筛选', 'Catalysis · generative models · high-throughput screening'),
      title: T('不学势能面，直接“画”出优化好的吸附结构', 'Skip the energy surface: draw the relaxed adsorption structure directly'),
      dek: T('上海交通大学的 DBCata 用一座带周期边界的“布朗桥”，把没优化的吸附初猜在不到 1 秒内变成接近 DFT 优化结果的结构。训练只要成对的结构，不要能量和力；在同一数据集的测试里，结构误差比通用机器学习势 UMA-OC20 优化出来的低约七成。',
        'DBCata, from Shanghai Jiao Tong University, uses a periodic "Brownian bridge" to turn an unrelaxed adsorption guess into a near-DFT-relaxed structure in under a second. It trains on structure pairs alone, with no energies or forces, and on a held-out test set from the same data its structural error is about 70% lower than structures relaxed with the universal ML potential UMA-OC20.'),
      paper: 'huo2026',
      press: [],
      code: ['https://github.com/Songze1019/DBCata', '代码：github.com/Songze1019/DBCata（GPL-3.0）', 'Code: github.com/Songze1019/DBCata (GPL-3.0)'],
      plain: [
        T('筛催化剂最常用的指标是吸附能：一个分子或原子在表面上粘得多紧。吸附能要算准，先得知道它在表面上究竟怎么待着——站在哪个位点、朝哪边歪、表面原子让开多少。这一步叫结构优化，用密度泛函理论（DFT）做，每走一步都要解一遍薛定谔方程的近似，从初猜开始常常要几十步。',
          'The workhorse number for screening catalysts is the adsorption energy: how tightly a molecule or atom sticks to a surface. To get it right you first need to know how the adsorbate actually sits there: which site, which way it tilts, how far the surface atoms give way. That step is a geometry optimisation with density functional theory (DFT); every step solves an approximate Schrödinger equation, and starting from a guess it often takes dozens of steps.'),
        T('省钱的办法是用机器学习势（MLIP）代替 DFT 去算力、做优化。问题在训练数据：这些势大多是用优化好的结构和近平衡的分子动力学训练的，而优化恰恰从一个离平衡很远的初猜出发。远处的力算不准，优化一开始就走偏，最后停在错误的极小里。',
          'The cheap route is to let a machine-learning interatomic potential (MLIP) compute the forces instead of DFT. The catch is the training data: such potentials are mostly trained on relaxed structures and near-equilibrium molecular dynamics, while an optimisation starts from a guess far from equilibrium. Forces out there are unreliable, the optimisation veers off at the start and ends in the wrong minimum.'),
        T('DBCata 换了个问题：不学整张势能面，只学“初猜 → 优化好的结构”这一对一的映射。它用的是扩散模型家族里的“布朗桥”：两端都被钉死，一端是初猜，一端是答案，中间加一点随机的抖动。训练时网络学会在桥上任意一处判断“离答案还差多少”；用的时候从初猜出发走 20 小步，就到了答案附近。',
          'DBCata changes the question. Instead of learning the whole energy surface it learns only the one-to-one map from guess to relaxed structure. The tool is a "Brownian bridge" from the diffusion-model family: both ends are pinned, one at the guess and one at the answer, with some random jitter in between. In training the network learns to tell, anywhere on the bridge, how far it still is from the answer; in use it walks from the guess to the answer in 20 small steps.'),
        T('表面是周期性的，这带来一个细节：一个原子在初猜里靠着晶胞右边，优化后可能出现在左边（其实只挪了一点，跨过了边界）。直接在两点之间连直线会让它横穿整个晶胞。作者改成“最近原子插值”，按最近的那个周期像走，下面的演示 2 画的就是这件事。',
          'Surfaces are periodic, which raises a detail: an atom sitting near the right edge of the cell in the guess may end up near the left edge after relaxation, having really moved only a little across the boundary. A straight line between the two points would drag it across the whole cell. The authors use "nearest-atom interpolation", which follows the nearest periodic image; Demo 2 below shows exactly this.'),
      ],
      steps: [
        { t: T('按规则摆初猜', 'Place guesses by rule'), text: T('用 CatKit 在表面上枚举高对称位点（顶位、桥位、三重和四重空位），把吸附物按硬球模型放上去。训练和使用都必须用同一种规则：模型只认识这种初猜。', 'CatKit enumerates high-symmetry surface sites (top, bridge, three- and four-fold hollow) and places the adsorbate with a hard-sphere rule. Training and use must follow the same rule: the model only knows guesses made this way.') },
        { t: T('配对训练', 'Train on pairs'), text: T('Catalysis-Hub 的 MamunHighT2019（双金属合金，BEEF-vdW 泛函）里取出 76,737 对（初猜，优化结果），清洗后 8 : 2 随机分成 58,943 对训练、14,728 对测试。一张 RTX 4090，12 小时内训完。', 'From MamunHighT2019 on Catalysis-Hub (bimetallic alloys, BEEF-vdW functional) they took 76,737 (guess, relaxed) pairs, cleaned them and split them 8 : 2 at random into 58,943 for training and 14,728 for testing. Training fits in 12 hours on one RTX 4090.') },
        { t: T('桥上去噪', 'Denoise along the bridge'), text: T('网络是等变图神经网络 PaiNN，截断 4.0 Å，每一步都按当前结构重建周期邻居图。它在桥上任一时刻预测 x_t − x_0（当前离答案还差多少），训练时桥分 100 步。', 'The network is the equivariant graph neural network PaiNN with a 4.0 Å cutoff, rebuilding the periodic neighbour graph from the current structure at every step. At any point on the bridge it predicts x_t − x_0, how far the current structure still is from the answer; training uses 100 bridge steps.') },
        { t: T('20 步生成', 'Generate in 20 steps'), text: T('生成时不加噪声，按常微分方程走 20 步，同一个初猜每次得到同一个结构。不到 1 秒一个结构。', 'Generation uses no noise and follows an ordinary differential equation for 20 steps, so the same guess always gives the same structure, in under a second.') },
        { t: T('挑出可疑的', 'Flag the suspicious ones'), text: T('四条化学规则（原子相撞、吸附物裂开、脱附、表面重构）加一个学出来的置信度分类器，挑出可疑的结构，只对它们补做 DFT 优化。', 'Four chemical rules (atoms colliding, the adsorbate breaking apart, desorbing, the surface reconstructing) plus a learned confidence classifier flag suspicious structures, and only those get a follow-up DFT optimisation.') },
        { t: T('用机器学习势算能量', 'Score with an ML potential'), text: T('生成的结构已经在极小附近，正是机器学习势可靠的地方，直接用 UMA-OC20 算吸附能。论文用这条路筛了 1,760 个 fcc 二元合金的氧还原活性。', 'The generated structures already sit near a minimum, exactly where ML potentials are reliable, so UMA-OC20 scores the adsorption energy directly. The paper used this route to screen 1,760 fcc binary alloys for oxygen reduction.') },
      ],
      numbers: [
        [T('结构误差 DMAE（测试集）', 'Structural error DMAE (test set)'), T('0.0352 Å（UMA-OC20 优化：0.1133 Å）', '0.0352 Å (UMA-OC20 relaxation: 0.1133 Å)'), 'paper', T('DMAE：两个结构里所有原子对距离之差的平均绝对值。', 'DMAE: mean absolute difference of all interatomic distances between two structures.')],
        [T('误差降低', 'Error reduction'), '68.9%', 'calc', T('1 − 0.0352/0.1133；论文写“约 70%”。', '1 − 0.0352/0.1133; the paper says "approximately 70%".')],
        [T('吸附能误差 ≤ 0.1 eV 的比例', 'Share with adsorption-energy error ≤ 0.1 eV'), T('0.91（UMA-OC20：0.68；加离群检测后 0.94）', '0.91 (UMA-OC20: 0.68; 0.94 with outlier detection)'), 'paper', T('在生成的结构上做 RPBE 单点，和 DFT 优化结构的结果比。', 'RPBE single points on the generated structures, compared with the DFT-relaxed ones.')],
        [T('初猜离答案远的 9,647 个', 'The 9,647 far-from-equilibrium guesses'), T('成功率 87.67% vs UMA 57.66%；能量 MAE 0.197 vs 1.607 eV', 'success 87.67% vs UMA 57.66%; energy MAE 0.197 vs 1.607 eV'), 'paper', T('“远”指初猜和 DFT 结果的 DMAE 超过 0.1 Å。', '"Far" means the guess is more than 0.1 Å DMAE from the DFT result.')],
        [T('后续 DFT 优化的步数', 'Follow-up DFT optimisation steps'), T('平均 65 步 → 15 步', '65 → 15 steps on average'), 'paper', T('从初猜出发 vs 从 DBCata 的结构出发，500 个结构的子集。', 'From the guess vs from the DBCata structure, on a 500-structure subset.')],
        [T('生成速度', 'Generation speed'), T('< 1 秒 / 结构，约为 DFT 的 4.0 × 10³ 倍', '< 1 s per structure, about 4.0 × 10³ times faster than DFT'), 'paper'],
        [T('离群检测要补的 DFT', 'DFT needed after outlier detection'), T('30,108 个离子步，约为全部用 DFT 的 3%', '30,108 ionic steps, about 3% of doing everything with DFT'), 'calc', T('30,108 / 约 1,000,000（论文表 1）。', '30,108 / about 1,000,000 (the paper’s Table 1).')],
        [T('氧还原筛选', 'Oxygen-reduction screen'), T('15,911 个初猜约 5 分钟；25 个候选表面', '15,911 guesses in about 5 minutes; 25 candidate surfaces'), 'paper'],
        [T('平均每个初猜', 'Per guess on average'), T('约 19 毫秒', 'about 19 ms'), 'calc', T('5 × 60 s / 15,911，应该是成批算的结果。', '5 × 60 s / 15,911; presumably batched.')],
      ],
      why: [
        T('机器学习势的弱点在远离平衡的地方，这正是结构优化的起点。DBCata 把这一段直接跳过，再把剩下的近平衡部分交给势或 DFT。', 'ML potentials are weakest far from equilibrium, which is exactly where an optimisation starts. DBCata jumps over that stretch and hands the near-equilibrium remainder to a potential or DFT.'),
        T('训练便宜：只要成对的结构，不要能量和力，一张消费级显卡半天。不同数据集的能量参考常常对不上（泛函、赝势、色散校正不同），优化好的结构却差别小得多，更容易合在一起用。', 'Cheap to train: structure pairs only, no energies or forces, half a day on one consumer GPU. Energies from different datasets often disagree (functionals, pseudopotentials, dispersion corrections), while relaxed structures differ much less, so they are easier to pool.'),
        T('它是一个可以插进任何筛选流程的前端：后面接 DFT 还是接机器学习势都行。', 'It is a front end that slots into any screening pipeline, followed by DFT or by an ML potential.'),
      ],
      limits: [
        T('只在训练分布里可靠：fcc 二元合金的 (111) 和 (110) 面、12 种小吸附物（H、C、CH、CH₂、CH₃、N、NH、O、OH、H₂O、S、SH）、三层小平板、按 CatKit 规则摆的初猜。作者自己也写明这限制了往更复杂体系推广。', 'Reliable only inside its training distribution: (111) and (110) facets of fcc binary alloys, 12 small adsorbates (H, C, CH, CH₂, CH₃, N, NH, O, OH, H₂O, S, SH), three-layer slabs, guesses placed by the CatKit rule. The authors themselves note this limits extension to more complex systems.'),
        T('和 UMA-OC20 的比较不完全对等：DBCata 在同一数据集的随机划分上训练和测试，UMA 是通用模型。作者用同一训练集微调了 UMA（DMAE 0.104–0.110 Å，成功率约 0.72），差距仍然很大；但正文没有按合金成分留出的测试。', 'The comparison with UMA-OC20 is not like for like: DBCata trains and tests on a random split of one dataset, while UMA is a general model. The authors also fine-tuned UMA on the same training set (DMAE 0.104–0.110 Å, success about 0.72) and the gap stays large, but the main text has no test that holds out alloy compositions.'),
        T('一个初猜只给一个结构，不探索别的吸附构型；最稳的位点靠前面枚举所有位点再比能量。', 'One guess gives one structure, with no exploration of other configurations; the most stable site comes from enumerating every site and comparing energies.'),
        T('氧还原的 25 个候选只用机器学习势算过 ΔE，没有零点能、溶剂化和电势的修正，正文也没有对它们做 DFT 复核；作者说明这只是初筛。', 'The 25 oxygen-reduction candidates were scored with ML-potential ΔE only, with no zero-point, solvation or potential corrections and no DFT re-check in the main text; the authors call it a preliminary screen.'),
      ],
      interp: T('演示 1 是一个二维玩具：一个吸附原子在周期表面上的位置，不是 DBCata 本身。“网络”换成了这批训练数据的最优去噪器（核回归），也就是真正的网络想逼近的那个函数；“机器学习势”是人为在远离极小处加了误差的势。它要说明的只是论文的论点：远处力不准时，力驱动的优化会走错，而学“初猜 → 答案”的映射不受这个影响，但只在训练过的那类初猜上可靠。', 'Demo 1 is a two-dimensional toy, the position of one adsorbed atom on a periodic surface, not DBCata itself. The "network" is replaced by the optimal denoiser of the training pairs (kernel regression), the function a real network tries to approximate, and the "ML potential" is the true one with an error added away from the minima. It only illustrates the paper’s argument: when far-field forces are wrong, force-driven optimisation goes astray, while learning the guess-to-answer map is not affected, though it is reliable only for the kind of guesses it was trained on.'),
      demos: ['bridge', 'pbc'],
      related: ['wb', 'micro', 'volcano', 'wmmol', 'nqpractice', 'cmleval', 'dftsolids'],
      refs: ['huo2026', 'mamun2019', 'boes2019', 'schutt2021', 'li2023bbdm', 'wood2025', 'chanussot2021', 'lan2023', 'kulkarni2018'],
    },
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'mof-radical-pairs',
      date: '2026-11-13',
      fields: ['materials', 'physical', 'quantum'],
      kicker: T('多孔晶体 · 自旋 · 量子传感', 'Porous crystals · spin · quantum sensing'),
      title: T('用光在多孔晶体里造出“排好队”的电子自旋对', 'Light makes neatly polarised electron-spin pairs inside a porous crystal'),
      dek: T('东京大学和西北大学的团队把会“传电子”的一对分子固定在金属有机框架（MOF）的孔壁上，打一束光，就得到了自旋几乎全挤在同一个能级上的自由基对。信号又尖又强，而且对孔里装的是什么溶剂很敏感——这是“量子鼻子”的第一步。',
        'Teams at the University of Tokyo and Northwestern fixed an electron-donating and an electron-accepting molecule side by side on the walls of a metal–organic framework (MOF). A flash of light creates radical pairs whose spins pile into a single sublevel. The signal is sharp and strong, and it responds to which solvent fills the pores: a first step towards a "quantum nose".'),
      paper: 'hamachi2026',
      press: [
        ['https://phys.org/news/2026-11-molecules-porous-crystals-potential-quantum.html', 'Phys.org，2026-11-13', 'Phys.org, 13 Nov 2026'],
        ['https://www.eurekalert.org/news-releases/1151404', 'EurekAlert!（东京大学新闻稿“One step toward building a quantum nose”）', 'EurekAlert! (University of Tokyo release, "One step toward building a quantum nose")'],
      ],
      plain: [
        T('电子除了带电，还像一个小磁针，这叫自旋。很多量子传感器（比如金刚石里的 NV 色心）就是靠“读”一个自旋的状态来感知周围的磁场、温度或分子。难处有两个：一是自旋的方向本来是乱的，信号很弱；二是传感器和要测的分子离得远，感觉不到。',
          'Besides its charge, an electron behaves like a tiny bar magnet: its spin. Many quantum sensors, such as nitrogen-vacancy centres in diamond, work by reading out the state of a spin to feel nearby magnetic fields, temperature or molecules. Two things make this hard. Spins normally point every which way, so the signal is weak, and the sensor usually sits far from the molecules it is meant to detect.'),
        T('金属有机框架（MOF）是用金属节点和有机“支架”搭成的多孔晶体，一克的内表面积可以有几千平方米。把会产生自旋的分子做成框架本身，要测的气体或溶剂分子就能钻进孔里，贴着自旋走过。',
          'Metal–organic frameworks (MOFs) are porous crystals built from metal nodes and organic struts; one gram can have an internal surface of several thousand square metres. If the spin-carrying molecules are part of the framework itself, gas or solvent molecules can wander through the pores right next to the spins.'),
        T('这项工作用的是锌卟啉做支架的 MOF，再把一种叫 DPNDI 的萘二酰亚胺分子“挂”到卟啉中心的锌上。卟啉吸光后把一个电子交给 DPNDI，两边各剩一个未成对电子，成了一个自由基对。因为两者在框架里被固定成一对一对、挨得很紧，生成的自由基对几乎都处在三重态里的同一个子能级 T₀ 上，这就是标题里的“子能级选择性超极化”。',
          'This work uses a MOF whose struts are zinc porphyrins, and attaches a naphthalene diimide called DPNDI to the zinc at the centre of each porphyrin. When the porphyrin absorbs light it hands one electron to DPNDI, leaving one unpaired electron on each side: a radical pair. Because the framework holds donor and acceptor in tight, fixed pairs, the radical pairs end up almost entirely in one sublevel of the triplet, T₀. That is the "sublevel-selective hyperpolarisation" of the title.'),
        T('“超极化”的意思是：自旋布居远远偏离热平衡，比靠低温和强磁场能得到的极化大得多，所以电子顺磁共振（EPR）信号又尖又强。作者还发现，换掉孔里的溶剂，自旋的弛豫时间就会跟着变——自旋“闻”到了客体分子。',
          '"Hyperpolarised" means the spin populations are pushed far from thermal equilibrium, much further than cold temperatures and strong magnets alone could manage, so the electron paramagnetic resonance (EPR) signal is sharp and intense. The authors also found that swapping the solvent inside the pores changes how fast the spins relax: the spins "smell" the guest molecules.'),
      ],
      steps: [
        { t: T('搭框架', 'Build the framework'), text: T('以锌卟啉 ZnTCPP 为支架的锆基 MOF。论文写明它的 X 射线粉末衍射像 MOF-525，但成分分析显示约一半卟啉支架缺失，更接近无序的 PCN-224。孔径约 1.9 nm。', 'A zirconium MOF with zinc porphyrin (ZnTCPP) struts. Its powder X-ray pattern looks like MOF-525, but composition analysis shows about half of the porphyrin struts are missing, so the paper describes it as a disordered PCN-224. Pores are about 1.9 nm wide.') },
        { t: T('挂上受体', 'Attach the acceptor'), text: T('合成后把 DPNDI 浸进去，它的吡啶氮配位到卟啉的锌上，夹在相邻卟啉之间。按 NMR，DPNDI 与 ZnTCPP 的比例是 42%（理论估计约 31%）；12 小时后吸附饱和。', 'DPNDI is soaked in after synthesis; its pyridine nitrogens bind to the porphyrin zinc, wedging it between neighbouring porphyrins. By NMR there is 42% DPNDI per ZnTCPP (a theoretical estimate gives about 31%); uptake saturates after 12 h.') },
        { t: T('打一束光', 'Flash of light'), text: T('卟啉吸收可见光进入激发单重态。供体和受体挨得紧，电子转移比卟啉自己的系间窜越快得多，于是激发态被“淬灭”成电荷分离态：卟啉正离子自由基 + DPNDI 负离子自由基。', 'The porphyrin absorbs visible light and enters its excited singlet state. Donor and acceptor are so close that electron transfer beats the porphyrin’s own intersystem crossing, so the excited state is quenched into a charge-separated state: a porphyrin radical cation plus a DPNDI radical anion.') },
        { t: T('自旋挑一个能级', 'The spins pick one sublevel'), text: T('自由基对生来是单重态。在强磁场里，单重态只能和三重态的 T₀ 混合（T₊ 和 T₋ 被塞曼能隔开了），所以流进三重态的布居几乎只落在 T₀。下面的演示 1 让你调这个混合。', 'The radical pair is born as a singlet. In a strong field the singlet can only mix with the T₀ level of the triplet (T₊ and T₋ are pushed away by the Zeeman energy), so the population that flows into the triplet lands almost entirely in T₀. Demo 1 below lets you tune this mixing.') },
        { t: T('用 EPR 读出来', 'Read it out with EPR'), text: T('时间分辨 EPR 看到一条又窄又强的信号，而且自旋–晶格弛豫时间长。只有 T₀ 有布居时，谱是一半发射、一半吸收的对称图样（演示 2）。', 'Time-resolved EPR shows a narrow, intense signal with a long spin–lattice relaxation time. With only T₀ populated the spectrum is a symmetric half-emission, half-absorption pattern (Demo 2).') },
        { t: T('换客体，看弛豫', 'Swap the guest, watch relaxation'), text: T('孔里换不同的溶剂，弛豫时间跟着变。这说明自旋能感到孔里装的是什么——作者把它称为通往“化学响应型自旋材料”的一条路。', 'Fill the pores with different solvents and the relaxation time changes. The spins can tell what is in the pores, which the authors describe as a route to chemically responsive spin materials.') },
      ],
      numbers: [
        [T('BET 比表面积（挂 DPNDI 前 / 后）', 'BET surface area (before / after DPNDI)'), '2670 / 1975 m² g⁻¹', 'paper', T('一克约等于 10 个双打网球场（每个约 261 m²）。', 'One gram is about ten doubles tennis courts (about 261 m² each).')],
        [T('孔径', 'Pore size'), '1.9 nm', 'paper'],
        [T('卟啉的锌化比例', 'Porphyrin zinc metallation'), '92%', 'paper'],
        [T('DPNDI 负载（相对 ZnTCPP）', 'DPNDI loading (per ZnTCPP)'), T('42%（NMR）；理论约 31%', '42% (NMR); about 31% in theory'), 'paper'],
        [T('溶液对照：电荷转移时间', 'Solution reference: charge transfer'), '26 ± 1 ps', 'paper', T('ZnTPP + DPNDI 在氯苯里，室温。', 'ZnTPP + DPNDI in chlorobenzene, room temperature.')],
        [T('溶液对照：卟啉的系间窜越', 'Solution reference: porphyrin ISC'), '1.9 ns', 'paper'],
        [T('电荷转移抢先的比例', 'Share that goes to charge transfer'), '98.7%', 'calc', T('k_{CT}/(k_{CT}+k_{ISC})，用上面两个溶液时间常数算出；框架里的数值没有单独核对。', 'k_{CT}/(k_{CT}+k_{ISC}) from the two solution time constants above; the in-framework values were not checked separately.')],
      ],
      why: [
        T('传感器和被测分子同在一个孔里：MOF 的孔把客体分子送到离自旋不到几个纳米的地方，这是外置传感器做不到的。', 'Sensor and target share the same pore: the MOF delivers guest molecules to within a few nanometres of the spins, which an external sensor cannot do.'),
        T('不用低温就有大极化：极化来自光化学反应本身（自旋选择性），不靠热平衡，所以原理上不需要极低温和超强磁场。', 'Big polarisation without deep cooling: it comes from the spin selectivity of the photochemistry, not from thermal equilibrium, so in principle it needs neither millikelvin temperatures nor huge magnets.'),
        T('化学可调：换支架、换受体、换金属节点，就能改自旋之间的距离和取向——这是分子量子材料相比固体缺陷的最大优势。', 'Chemically tunable: change the strut, the acceptor or the metal node and you change the distance and orientation between spins, the main advantage molecular quantum materials have over defects in solids.'),
      ],
      limits: [
        T('这是材料平台的演示，还不是传感器：论文展示了弛豫时间随溶剂变化，没有给出对某种分子的检测限。', 'This demonstrates a material platform, not yet a sensor: the paper shows relaxation changing with solvent but gives no detection limit for any molecule.'),
        T('测量在低温下做，用的是 EPR（微波读出）。这篇没有做光学读出；同一个团队一个月前的 JACS 论文才第一次在 MOF 里做到光学读出（见下一条）。', 'Measurements were done at cryogenic temperature with EPR (microwave readout). This paper does not read the spins optically; the same team’s JACS paper a month earlier was the first to do that in a MOF (next item).'),
        T('框架是无序的：约一半支架缺失、DPNDI 位置不完全均一。真正的器件需要更可控的结构。', 'The framework is disordered: about half the struts are missing and DPNDI sites are not perfectly uniform. A real device will need tighter structural control.'),
      ],
      interp: T('演示 1 用的“单重态只和 T₀ 混合”是自由基对化学的教科书图像，用来说明为什么只有 T₀ 被填上；论文对机理的具体分析（包括量子化学计算）请看原文。', 'Demo 1 uses the textbook radical-pair picture, in which the singlet mixes only with T₀, to show why only T₀ fills up; for the paper’s own mechanistic analysis, including its quantum-chemical calculations, read the original.'),
      demos: ['rp', 'epr'],
      related: ['porous', 'epr', 'hyper', 'qbio', 'qcomp'],
      refs: ['hamachi2026', 'inoue2026', 'yamauchi2024', 'wasielewski2020', 'furukawa2013', 'hore2016', 'degen2017'],
    },
    // ───────────────────────────────────────────────────────────────────────
    {
      id: 'mof-odmr',
      date: '2026-10-09',
      fields: ['materials', 'spectroscopy', 'quantum'],
      kicker: T('多孔晶体 · 光学读出 · 量子传感', 'Porous crystals · optical readout · quantum sensing'),
      title: T('第一次用光读出金属有机框架里的电子自旋', 'Electron spins in a metal–organic framework read out with light for the first time'),
      dek: T('东京大学、格拉斯哥大学、谢菲尔德大学等团队在铝–卟啉 MOF 里观察到光学探测磁共振（ODMR）：照光产生的三重态自旋，可以用它发出的近红外光来读。这是把 NV 色心那套“用光读自旋”搬进可设计多孔材料的第一步。',
        'Teams from Tokyo, Glasgow, Sheffield and elsewhere observed optically detected magnetic resonance (ODMR) in an aluminium–porphyrin MOF: triplet spins made by light can be read through the near-infrared light they emit. It is the first step in bringing the NV-centre trick of reading spins with light into designable porous materials.'),
      paper: 'inoue2026',
      press: [
        ['https://phys.org/news/2026-10-electron-porous-crystals-path-quantum.html', 'Phys.org，2026-10', 'Phys.org, Oct 2026'],
        ['https://www.gla.ac.uk/news/headline_1296117_en.html', '格拉斯哥大学新闻', 'University of Glasgow news'],
        ['https://sheffield.ac.uk/mps/news/research-breakthrough-could-enable-ultra-sensitive-quantum-chemical-sensors', '谢菲尔德大学新闻', 'University of Sheffield news'],
      ],
      plain: [
        T('读一个自旋最灵敏的办法之一是用光：自旋处在不同子能级时，分子发光的强弱不一样。加一个恰好匹配能级差的微波，布居被搬动，发光就变——这就是 ODMR。金刚石 NV 色心能在室温下探测单个自旋，靠的就是这个。',
          'One of the most sensitive ways to read a spin is with light: a molecule glows more or less brightly depending on which spin sublevel it is in. Apply microwaves that match a level spacing, the populations shift, and the glow changes. That is ODMR, and it is how NV centres in diamond detect single spins at room temperature.'),
        T('分子体系里早就有能光学读出的自旋（比如 2020 年的铬配合物分子比特），但还没人在 MOF 里做到过。这篇用的是 Al-PMOF：铝离子连着不含金属的卟啉 H₂TCPP，晶体结构用微晶电子衍射（microED）解出。',
          'Optically addressable molecular spins already existed (for example the 2020 chromium-complex molecular qubits), but nobody had done it in a MOF. This paper uses Al-PMOF: aluminium ions linked by metal-free porphyrin H₂TCPP, with the crystal structure solved by micro-electron diffraction (microED).'),
        T('卟啉吸收 532 nm 的光后经系间窜越变成三重态（两个未成对电子自旋平行，S = 1）。三重态在零场下就有三个能量不同的子能级，差值由零场分裂参数 D、E 决定。作者在 77 K、零磁场下看到三条 ODMR 线，正好对应 D + E、D − E 和 2E（下面的演示 1）。',
          'After absorbing 532 nm light the porphyrin crosses into its triplet state (two unpaired electrons with parallel spins, S = 1). Even at zero field the triplet has three sublevels at different energies, set by the zero-field splitting parameters D and E. At 77 K and zero field the authors see three ODMR lines, exactly at D + E, D − E and 2E (Demo 1 below).'),
      ],
      steps: [
        { t: T('框架', 'Framework'), text: T('Al(III) 与 H₂TCPP（四(4-羧基苯基)卟啉）组成的 Al-PMOF；microED 解出晶体结构。', 'Al-PMOF from Al(III) and H₂TCPP (tetrakis(4-carboxyphenyl)porphyrin); crystal structure solved by microED.') },
        { t: T('照光产生三重态', 'Light makes triplets'), text: T('532 nm 激发；荧光约 10 ns 内衰减，800 nm 以上的磷光一直延续到约 150 μs。改变激发强度（2 nJ 到 2 μJ）排除了三重态–三重态湮灭。', '532 nm excitation; fluorescence decays within about 10 ns, while phosphorescence beyond 800 nm persists to about 150 μs. Varying the excitation from 2 nJ to 2 μJ rules out triplet–triplet annihilation.') },
        { t: T('EPR 看三重态', 'EPR sees the triplet'), text: T('50 K 下的时间分辨 EPR 给出 |D| = 926 MHz、|E| = 121 MHz，子能级布居 Px:Py:Pz = 0.68:0.32:0。下面的演示 2 用这组数画出粉末谱。', 'Time-resolved EPR at 50 K gives |D| = 926 MHz and |E| = 121 MHz with sublevel populations Px:Py:Pz = 0.68:0.32:0. Demo 2 below draws the powder spectrum from these numbers.') },
        { t: T('相干时间', 'Coherence time'), text: T('Hahn 回波测得 T₂：激光脉冲 3.2 mJ 时 0.78 μs，降到 0.32 mJ 时 4.77 μs（50 K）。激光越弱，测得的相干时间越长。', 'Hahn echoes give T₂ = 0.78 μs at 3.2 mJ laser pulses and 4.77 μs at 0.32 mJ (50 K). The weaker the light, the longer the measured coherence.') },
        { t: T('光学读出', 'Optical readout'), text: T('77 K、零场下的连续波 ODMR 出现 300、770、1070 MHz 三条线，信号主要来自长波长的磷光。这是 MOF 里第一次光学读出自旋。', 'Continuous-wave ODMR at 77 K and zero field shows three lines at 300, 770 and 1070 MHz, mainly in the long-wavelength phosphorescence. It is the first optical spin readout in a MOF.') },
      ],
      numbers: [
        [T('零场分裂（EPR，50 K）', 'Zero-field splitting (EPR, 50 K)'), '|D| = 926 MHz，|E| = 121 MHz', 'paper', T('对照：H₂TPP 单体分散在聚苯乙烯里是 1117 / 223 MHz。', 'Reference: H₂TPP monomer in polystyrene, 1117 / 223 MHz.')],
        [T('零场 ODMR 三条线（77 K）', 'Zero-field ODMR lines (77 K)'), '300, 770, 1070 MHz', 'paper'],
        [T('由 ODMR 读出的 D、E', 'D and E from ODMR'), '920 MHz, 150 MHz', 'calc', T('D = (770 + 1070)/2，E = (1070 − 770)/2；第三条线应在 2E = 300 MHz，正好吻合。', 'D = (770 + 1070)/2, E = (1070 − 770)/2; the third line should sit at 2E = 300 MHz, and it does.')],
        [T('子能级布居 Px:Py:Pz', 'Sublevel populations Px:Py:Pz'), '0.68 : 0.32 : 0', 'paper'],
        [T('相干时间 T₂（50 K）', 'Coherence time T₂ (50 K)'), T('0.78 μs（3.2 mJ）/ 4.77 μs（0.32 mJ）', '0.78 μs (3.2 mJ) / 4.77 μs (0.32 mJ)'), 'paper'],
        [T('三重态极化寿命', 'Triplet polarisation lifetime'), T('41.4 μs（单体 20.0 μs）', '41.4 μs (monomer 20.0 μs)'), 'paper'],
        [T('EPR 谱的总宽度', 'Full width of the EPR spectrum'), '≈ 66 mT', 'calc', T('按 2|D|/γ 算，γ = 28.03 MHz/mT。', '2|D|/γ with γ = 28.03 MHz/mT.')],
      ],
      why: [
        T('把“用光读自旋”带进可设计的多孔材料：NV 色心灵敏，但金刚石不能按需改结构；MOF 可以。', 'Brings optical spin readout into designable porous materials: NV centres are sensitive, but diamond cannot be redesigned at will; a MOF can.'),
        T('光学读出比微波读出灵敏得多，原理上能做到很少的自旋甚至单个自旋。', 'Optical readout is far more sensitive than microwave detection and can in principle reach very few, even single, spins.'),
      ],
      limits: [
        T('ODMR 在 77 K、T₂ 在 50 K 测得，离室温传感还有距离。', 'ODMR was measured at 77 K and T₂ at 50 K; room-temperature sensing is still some way off.'),
        T('这是系综测量（大量三重态一起），不是单自旋。', 'These are ensemble measurements (many triplets at once), not single spins.'),
      ],
      demos: ['zf', 'epr'],
      related: ['porous', 'magnetism', 'epr', 'qphys', 'qcomp', 'code'],
      refs: ['inoue2026', 'bayliss2020', 'doherty2013', 'degen2017', 'wasielewski2020', 'furukawa2013'],
    },
  ];

  const demos = {
    bridge: {
      title: T('布朗桥 vs 力算错了的优化（二维玩具）', 'Brownian bridge vs optimisation with wrong forces (2D toy)'),
      intro: T('一个吸附原子在周期表面上的位置。紫点是初猜，灰色虚线是在真实势上最速下降（相当于 DFT 优化，终点就是答案），蓝线是在“机器学习势”上下降，金线和金点是布朗桥从初猜走到答案的 K 步。底色越浓能量越低：中间的空位最深，两个桥位是浅井，四角的顶位是鼓包。',
        'The position of one adsorbed atom on a periodic surface. The violet dot is the guess, the grey dashed line is steepest descent on the true potential (the DFT optimisation; its end is the answer), the blue line descends on the "ML potential", and the gold line and dots are the Brownian bridge walking from the guess to the answer in K steps. Stronger shading means lower energy: the hollow in the middle is deepest, the two bridge sites are shallow wells, and the corner top sites are bumps.'),
      formula: 'x_t = (1 − m_t) x_0 + m_t y + √δ_t ε,  δ_t = 2s(m_t − m_t²)',
      notes: T('势能 V 是三口周期排列的高斯井加顶位上的一个鼓包（单位任意，晶胞边长 1）。“机器学习势”在离最近极小 0.07 以内和 V 完全一样，0.19 以外叠上一个幅度 ε 的周期起伏，模仿“只在近平衡数据上训练”。训练数据是 N 对（初猜，真实势上弛豫的结果），初猜放在顶、桥、桥、空四个规则位点，加标准差 0.08 的偏移，随机数种子固定。去噪器是这批数据在桥上的经验分布的最优去噪器（核回归，核宽 0.035），不是训练出来的神经网络；采样用论文式 10 的确定性形式（σ_t = 0），差值一律取最小像。成功率在另外 100 个规则初猜和 100 个偏移加倍的初猜上算，终点离真实弛豫结果不到 0.03 算成功。没有能量、没有表面原子的运动、没有吸附物的取向，只有一个点在二维里走。',
        'V is three periodic Gaussian wells plus a bump on the top site (arbitrary units, cell length 1). The "ML potential" equals V within 0.07 of the nearest minimum and adds a periodic ripple of amplitude ε beyond 0.19, mimicking training on near-equilibrium data only. Training data are N pairs (guess, relaxed on the true potential), with guesses at the four rule sites top, bridge, bridge, hollow plus a 0.08 standard-deviation offset and a fixed random seed. The denoiser is the optimal denoiser of the empirical bridge distribution of these pairs (kernel regression, width 0.035), not a trained neural network; sampling uses the deterministic form of the paper’s Eq. 10 (σ_t = 0), with every difference taken as a minimum image. Success rates use another 100 rule-placed guesses and 100 guesses with twice the offset; an end point within 0.03 of the true relaxed result counts as a success. No energies, no moving surface atoms, no adsorbate orientation: just one point walking in two dimensions.'),
    },
    pbc: {
      title: T('周期边界上的插值：直线 vs 最近像', 'Interpolating across a periodic boundary: straight line vs nearest image'),
      intro: T('初猜里原子在晶胞右边，优化后出现在左边，其实只是跨过边界挪了一点。直接线性插值会让它横穿整个晶胞；最近原子插值按最近的周期像走（论文式 8）。拖动 m 看桥的中途原子在哪。',
        'In the guess the atom sits near the right edge of the cell; after relaxation it appears near the left edge, having really moved a little across the boundary. Plain linear interpolation drags it across the whole cell; nearest-atom interpolation follows the nearest periodic image (the paper’s Eq. 8). Drag m to see where the atom is halfway along the bridge.'),
      formula: 'x_t = x_0 + m_t (y − x_0 − L·round(L⁻¹(y − x_0)))',
      notes: T('一维，晶胞长度 L（默认 2.77 Å，大约是 Pt(111) 表面上两个相邻原子的距离）。坐标用分数坐标，画出相邻的两个周期像。论文里同样的修正也用在损失函数和反向一步的均值里（式 9–13）。', 'One dimension, cell length L (default 2.77 Å, roughly the nearest-neighbour distance on Pt(111)). Coordinates are fractional, and two neighbouring periodic images are drawn. The paper applies the same correction to the loss and to the mean of each reverse step (Eqs. 9–13).'),
    },
    rp: {
      title: T('自由基对：单重态怎样流进 T₀', 'Radical pair: how the singlet leaks into T₀'),
      intro: T('自由基对生来是单重态 S。Δg（两个自由基 g 值之差）和超精细场把 S 和三重态的 T₀ 混起来；交换作用 J 把两者的能量拉开、压低混合。在强磁场里 T₊、T₋ 离得太远，不参与。',
        'The radical pair is born as a singlet S. The g-value difference Δg and the hyperfine fields mix S with the T₀ level of the triplet, while the exchange coupling J pulls the two apart in energy and suppresses the mixing. In a strong field T₊ and T₋ are too far away to take part.'),
      formula: 'P_{T0}(t) = Q²/(J²+Q²) · sin²(2π√(J²+Q²) t)',
      notes: T('两能级模型：H = h[[J, Q], [Q, −J]]，Q = (Δg μ_B B_0/h + 超精细场)/2，超精细场取均值为零、宽度 σ 的高斯分布再平均；自由基对寿命 τ 按指数分布算平均产率。没有算 T₊、T₋，没有自旋弛豫，也没有偶极耦合和 g 各向异性。数值是教学用的典型量级，不是这篇论文的拟合参数。',
        'Two-level model: H = h[[J, Q], [Q, −J]], Q = (Δg μ_B B_0/h + hyperfine field)/2, with the hyperfine field averaged over a zero-mean Gaussian of width σ; the yield averages over an exponential pair lifetime τ. T₊ and T₋, spin relaxation, dipolar coupling and g anisotropy are left out. Parameter values are typical teaching magnitudes, not fits to this paper.'),
    },
    epr: {
      title: T('三重态的 EPR 粉末谱：两种极化图样', 'Triplet EPR powder spectrum: two polarisation patterns'),
      intro: T('同样是 S = 1 的三重态，布居怎么分配决定谱的样子。系间窜越（ISC）按分子的零场能级 Tx、Ty、Tz 分配布居；自由基对的路线只填 T₀。切换两种图样，看吸收（A，向上）和发射（E，向下）怎么排。',
        'For the same S = 1 triplet, how the population is shared decides what the spectrum looks like. Intersystem crossing (ISC) fills the molecular zero-field levels Tx, Ty, Tz; the radical-pair route fills only T₀. Switch between them to see how absorption (A, up) and emission (E, down) line up.'),
      formula: 'B_{res} = (ν ± X)/γ,  X = D(3n_z²−1)/2 + (3/2)E(n_x²−n_y²)',
      notes: T('X 波段 9.5 GHz，高场一阶微扰，1500 个取向的 Fibonacci 球面平均，高斯展宽；强度 ∝ 下能级布居 − 上能级布居。ISC 的高场布居由 p₀ = Σ P_i n_i²、p± = Σ P_i(1 − n_i²)/2 投影得到。没有超精细结构、g 各向异性和自旋弛豫。“Al-PMOF”预设用的是论文给的 D、E 和 Px:Py:Pz；“自由基对”预设的 D 由点偶极距离算出，只是示意。',
        'X-band at 9.5 GHz, first-order high-field theory, a 1500-orientation Fibonacci sphere average and Gaussian broadening; intensity ∝ lower-level minus upper-level population. ISC high-field populations come from p₀ = Σ P_i n_i², p± = Σ P_i(1 − n_i²)/2. No hyperfine structure, g anisotropy or relaxation. The "Al-PMOF" preset uses the paper’s D, E and Px:Py:Pz; the "radical pair" preset takes D from a point-dipole distance and is only illustrative.'),
    },
    zf: {
      title: T('零场下的三个能级和 ODMR 的三条线', 'Three zero-field levels and the three ODMR lines'),
      intro: T('三重态不加磁场也有三个能级：E_X = D/3 − E、E_Y = D/3 + E、E_Z = −2D/3。微波正好等于其中两能级之差时，发光强度变化，就看到一条 ODMR 线。再加一点磁场，能级开始弯曲、分开。',
        'A triplet has three levels even with no magnetic field: E_X = D/3 − E, E_Y = D/3 + E, E_Z = −2D/3. When the microwave frequency matches a gap between two of them, the emission changes and an ODMR line appears. Add a small field and the levels start to bend and separate.'),
      formula: 'ν = 2E,  D − E,  D + E',
      notes: T('能级图是在 |+1⟩、|0⟩、|−1⟩ 基里对 H = D(S_z² − 2/3) + E(S_x² − S_y²) + gμ_B B·S 做 3×3 精确对角化，磁场沿分子 z 轴或 x 轴，g = 2.0023。实际的 MOF 是粉末，ODMR 是所有取向的平均；这里只画单一取向。ODMR 的线形和强弱取决于各子能级的发光速率和布居，模型里没有算。',
        'The level diagram is an exact 3×3 diagonalisation of H = D(S_z² − 2/3) + E(S_x² − S_y²) + gμ_B B·S in the |+1⟩, |0⟩, |−1⟩ basis, with the field along the molecular z or x axis and g = 2.0023. The real MOF is a powder and its ODMR averages over orientations; only one orientation is drawn here. ODMR line shapes and intensities depend on each sublevel’s emission rate and population, which the model leaves out.'),
    },
  };

  return {
    hero: {
      title: T('化学与材料新闻', 'Chemistry & Materials News'),
      lead: T('挑最新的化学和材料研究，讲清楚做了什么、怎么做到的、还差什么，并配上能自己动手调的演示。每条都链接原始论文，DOI 逐条核对。', 'Recent chemistry and materials research, explained: what was done, how it worked and what is still missing, with demos you can adjust yourself. Every item links the original paper, with each DOI checked.'),
      honesty: T('新闻稿常把“第一步”写成“突破”。这里每个数字都标出处：论文原文、由论文常数算出，或新闻稿；演示是教学模型，写明假设。', 'Press releases often turn a first step into a breakthrough. Here every number says where it comes from: the paper itself, a calculation from the paper’s constants, or a press release. Demos are teaching models with their assumptions written out.'),
    },
    srcLabel: { paper: T('论文', 'Paper'), calc: T('算出', 'Computed'), press: T('新闻稿', 'Press') },
    fields, refs, site, items, demos,
  };
})();
