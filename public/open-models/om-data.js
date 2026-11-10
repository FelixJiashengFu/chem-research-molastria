/* 开放模型馆 · Open Model Hall：各家公司开放给科研的化学、材料与生物分子 AI 模型、数据集和工具。
   每家公司一个展馆（Meta 的展馆是现有的 /meta/ 页，带识图和 UMA 脚本两个工具；其余展馆由 om.js 按这里的数据画出来）。
   内容中英两版；许可证照 GitHub 仓库识别的结果写（2026-11-10 用 GitHub 搜索接口逐个核对），模型参数另有条款的单独写明；
   论文逐条在 arXiv 接口或 OpenAlex 按 DOI 核对过标题和年份（tools/open-models-test.mjs 查格式，tools/open-models-refs.mjs 联网复核）。
   字段：
   orgs[].id         展馆的目录名（public/open-models/<id>/），Meta 用 path 指向 ../meta/
   orgs[].repo       “最近的版本”读哪个 GitHub 仓库的 releases
   items[].kind      model 原子模型与机器学习势 · gen 生成与设计 · bio 生物分子结构 · qm 电子结构与 DFT · data 数据集 · tool 工具与平台
   items[].use       open 宽松许可可商用 · copyleft 开源但有传染性条款 · nc 仅限非商业 / 需申请 · service 在线服务或商业平台
   items[].links     [标签, 地址]；标签是中英两版的键（paper、code、docs、data、site、weights、demo） */
window.MOLASTRIA_OM = {
  checked: '2026-11-10',
  kinds: {
    model: { zh: '原子模型', en: 'Atomistic model' },
    gen: { zh: '生成与设计', en: 'Generation & design' },
    bio: { zh: '生物分子', en: 'Biomolecules' },
    qm: { zh: '电子结构', en: 'Electronic structure' },
    data: { zh: '数据集', en: 'Dataset' },
    tool: { zh: '工具与平台', en: 'Tools & platforms' },
  },
  uses: {
    open: { zh: '宽松许可，可商用', en: 'Permissive, commercial use OK' },
    copyleft: { zh: '开源，带传染性条款', en: 'Open source, copyleft' },
    nc: { zh: '仅限非商业或需申请', en: 'Non-commercial or on request' },
    service: { zh: '在线服务 / 商业平台', en: 'Hosted service / commercial' },
  },
  linkNames: {
    paper: { zh: '论文', en: 'Paper' }, code: { zh: '代码', en: 'Code' }, docs: { zh: '文档', en: 'Docs' }, data: { zh: '数据', en: 'Data' },
    site: { zh: '官网', en: 'Website' }, weights: { zh: '模型参数', en: 'Weights' }, demo: { zh: '在线体验', en: 'Try it' },
  },
  // 按任务找模型：馆里各家能做同一件事的条目放在一起比较
  tasks: [
    { zh: '分子与材料的通用机器学习势', en: 'Universal machine-learning potentials', items: ['meta:uma', 'microsoft:mattersim', 'orbital:orb-v3', 'dp:dpa3', 'rowan:egret-1'] },
    { zh: '设计新的无机晶体', en: 'Designing new inorganic crystals', items: ['microsoft:mattergen', 'deepmind:gnome'] },
    { zh: '蛋白质与复合物结构预测', en: 'Protein and complex structure prediction', items: ['deepmind:alphafold3', 'bytedance:protenix', 'chai:chai-1', 'baidu:helixfold3', 'dp:uni-fold'] },
    { zh: '蛋白质构象系综与动力学', en: 'Protein ensembles and dynamics', items: ['microsoft:bioemu', 'microsoft:ai2bmd'] },
    { zh: '学出来的交换相关泛函与神经网络波函数', en: 'Learned XC functionals and neural wavefunctions', items: ['microsoft:skala', 'deepmind:dm21', 'deepmind:ferminet'] },
    { zh: '小分子表示与性质预测', en: 'Small-molecule representations and properties', items: ['dp:uni-mol', 'ibm:molformer'] },
    { zh: '反应预测与逆合成', en: 'Reaction prediction and retrosynthesis', items: ['ibm:rxn'] },
    { zh: '把模拟搬到 GPU 上', en: 'Moving simulation onto GPUs', items: ['nvidia:alchemi', 'nvidia:nvmolkit', 'nvidia:cuequivariance', 'dp:uni-dock'] },
  ],
  orgs: [
    {
      id: 'meta', path: '../meta/index.html', repo: 'facebookresearch/fairchem', country: { zh: '美国', en: 'USA' },
      name: { zh: 'Meta', en: 'Meta' }, lab: 'FAIR Chemistry',
      glyph: 'UMA · OMol25',
      blurb: {
        zh: 'FAIR Chemistry 的 UMA 通用原子模型和 OMol25、OMat24、Open Catalyst 系列数据集，加上 Muse 系列语言模型。本站接入最深的一家：有 Muse 识图、UMA 脚本生成器和在线模型。',
        en: 'FAIR Chemistry\'s UMA universal atomistic models and the OMol25, OMat24 and Open Catalyst datasets, plus the Muse language models. The most deeply integrated lab on this site: Muse image-to-structure, a UMA script generator and online models.',
      },
      tools: true,
      items: [
        { id: 'uma', kind: 'model', use: 'nc', year: '2025', name: 'UMA', desc: { zh: '一个模型覆盖分子、材料、催化、MOF 和分子晶体，用任务头切换。本站模型接口在线可用。', en: 'One model for molecules, materials, catalysis, MOFs and molecular crystals, switched by task heads. Available online in this site\'s Model API.' }, lic: { zh: 'FAIR Chemistry License，需在 Hugging Face 申请', en: 'FAIR Chemistry License, request on Hugging Face' }, links: [['paper', 'https://arxiv.org/abs/2506.23971'], ['weights', 'https://huggingface.co/facebook/UMA']], used: true },
        { id: 'omol25', kind: 'data', use: 'open', year: '2025', name: 'OMol25', desc: { zh: '超过 1 亿次 ωB97M-V/def2-TZVPD 计算，83 种元素，含溶剂、电荷与自旋。', en: 'Over 100 million ωB97M-V/def2-TZVPD calculations across 83 elements, with solvents, charges and spins.' }, lic: 'CC BY 4.0', links: [['paper', 'https://arxiv.org/abs/2505.08762']], used: true },
        { id: 'fairchem', kind: 'tool', use: 'open', year: '', name: 'fairchem', desc: { zh: 'FAIR Chemistry 的代码库：ASE 计算器、训练和多 GPU 推理。', en: 'FAIR Chemistry\'s code base: ASE calculators, training and multi-GPU inference.' }, lic: 'MIT', links: [['code', 'https://github.com/facebookresearch/fairchem']], used: true },
      ],
    },
    {
      id: 'deepmind', repo: 'google-deepmind/alphafold3', country: { zh: '英国 · 美国', en: 'UK · USA' },
      name: { zh: 'Google DeepMind', en: 'Google DeepMind' }, lab: 'Google DeepMind Science',
      glyph: 'AF3 · GNoME',
      blurb: {
        zh: 'AlphaFold 把蛋白质结构预测变成了日常工具；GNoME 预测了 220 万个新晶体；FermiNet 和 DM21 把深度学习带进了电子结构。代码大多是 Apache 2.0，AlphaFold 3 的模型参数要单独申请、只限非商业用途。',
        en: 'AlphaFold turned protein structure prediction into an everyday tool; GNoME predicted 2.2 million new crystals; FermiNet and DM21 brought deep learning into electronic structure. Most code is Apache 2.0; AlphaFold 3 weights are requested separately and limited to non-commercial use.',
      },
      lead: {
        zh: 'Google DeepMind 的科学团队做的是“大问题上的单一突破”：一个模型解决一个领域的核心难题，然后公开代码和预测结果。对化学研究者最有用的是三条线：生物分子结构（AlphaFold 2、3 和 2 亿条结构的数据库）、材料发现（GNoME）和电子结构（FermiNet、Psiformer、DM21）。',
        en: 'Google DeepMind\'s science team aims for single breakthroughs on big problems: one model for the core problem of a field, then open code and predictions. Three lines matter most to chemists: biomolecular structure (AlphaFold 2 and 3, and a database of 200 million structures), materials discovery (GNoME) and electronic structure (FermiNet, Psiformer, DM21).',
      },
      facts: [[{ zh: '2 亿+', en: '200M+' }, { zh: 'AlphaFold 数据库的蛋白质结构预测', en: 'protein structure predictions in the AlphaFold DB' }], [{ zh: '220 万', en: '2.2M' }, { zh: 'GNoME 预测的新晶体，其中约 38 万个稳定', en: 'new crystals predicted by GNoME, about 380,000 of them stable' }], ['2024', { zh: 'AlphaFold 获诺贝尔化学奖', en: 'Nobel Prize in Chemistry for AlphaFold' }]],
      site: [
        { zh: '讲解手册里的蛋白质结构与机器学习章节', en: 'The handbook chapters on protein structure and machine learning', href: '../../manual/index.html' },
        { zh: '量子生物学展馆的结构馆（PDB 结构 3D 查看）', en: 'The structure gallery in the Quantum Biology pavilion (3D PDB viewer)', href: '../../quantum/biology/index.html' },
      ],
      items: [
        { id: 'alphafold2', kind: 'bio', use: 'open', year: '2021', name: 'AlphaFold 2', desc: { zh: '从序列预测单链蛋白质结构，CASP14 上达到实验精度。代码和模型参数都开放。', en: 'Predicts single-chain protein structures from sequence, at experimental accuracy in CASP14. Code and weights are open.' }, lic: { zh: '代码 Apache 2.0；模型参数 CC BY 4.0', en: 'Code Apache 2.0; weights CC BY 4.0' }, links: [['paper', 'https://doi.org/10.1038/s41586-021-03819-2'], ['code', 'https://github.com/google-deepmind/alphafold']] },
        { id: 'alphafold3', kind: 'bio', use: 'nc', year: '2024', name: 'AlphaFold 3', desc: { zh: '扩散模型，一起预测蛋白质、核酸、小分子配体、离子和修饰残基组成的复合物。网页版 AlphaFold Server 可直接提交。', en: 'A diffusion model that predicts complexes of proteins, nucleic acids, small-molecule ligands, ions and modified residues together. AlphaFold Server takes jobs in the browser.' }, lic: { zh: '代码 Apache 2.0；模型参数向 Google DeepMind 申请，仅限非商业', en: 'Code Apache 2.0; weights on request from Google DeepMind, non-commercial only' }, links: [['paper', 'https://doi.org/10.1038/s41586-024-07487-w'], ['code', 'https://github.com/google-deepmind/alphafold3'], ['demo', 'https://alphafoldserver.com/']] },
        { id: 'afdb', kind: 'data', use: 'open', year: '2021', name: 'AlphaFold Protein Structure Database', desc: { zh: '和 EMBL-EBI 合办，2 亿多条预测结构，可按 UniProt 编号直接下载。', en: 'Run with EMBL-EBI: over 200 million predicted structures, downloadable by UniProt accession.' }, lic: 'CC BY 4.0', links: [['paper', 'https://doi.org/10.1093/nar/gkab1061'], ['data', 'https://alphafold.ebi.ac.uk/']] },
        { id: 'gnome', kind: 'gen', use: 'open', year: '2023', name: 'GNoME', desc: { zh: '图网络加主动学习筛选晶体，找到 220 万个低于当时凸包的新结构，其中约 38 万个在最终凸包上（稳定）。稳定结构公开下载。', en: 'Graph networks with active learning screened crystals and predicted 2.2 million new ones, about 380,000 of them on the convex hull. The stable structures are downloadable.' }, lic: { zh: '代码 Apache 2.0；数据条款见仓库', en: 'Code Apache 2.0; data terms in the repository' }, links: [['paper', 'https://doi.org/10.1038/s41586-023-06735-9'], ['code', 'https://github.com/google-deepmind/materials_discovery']] },
        { id: 'alphamissense', kind: 'bio', use: 'open', year: '2023', name: 'AlphaMissense', desc: { zh: '给人类蛋白质组里 7100 万个可能的错义突变打致病性分数。仓库已归档，预测结果仍可下载。', en: 'Scores the pathogenicity of 71 million possible missense variants in the human proteome. The repository is archived; the predictions remain downloadable.' }, lic: { zh: '代码 Apache 2.0；预测结果条款见仓库', en: 'Code Apache 2.0; prediction terms in the repository' }, links: [['paper', 'https://doi.org/10.1126/science.adg7492'], ['code', 'https://github.com/google-deepmind/alphamissense']] },
        { id: 'ferminet', kind: 'qm', use: 'open', year: '2020', name: 'FermiNet · Psiformer', desc: { zh: '用神经网络表示多电子波函数，再做变分蒙特卡罗，小分子上接近 CCSD(T) 或更好。Psiformer 把网络换成自注意力。', en: 'Neural networks as many-electron wavefunctions, optimised by variational Monte Carlo; near or beyond CCSD(T) for small molecules. Psiformer swaps the network for self-attention.' }, lic: 'Apache 2.0', links: [['paper', 'https://doi.org/10.1103/PhysRevResearch.2.033429'], ['paper', 'https://arxiv.org/abs/2211.13672'], ['code', 'https://github.com/google-deepmind/ferminet']] },
        { id: 'dm21', kind: 'qm', use: 'open', year: '2021', name: 'DM21', desc: { zh: '神经网络交换相关泛函，训练时加入分数电荷和分数自旋约束，减小离域误差；有 PySCF 接口。', en: 'A neural-network exchange–correlation functional trained with fractional-charge and fractional-spin constraints to reduce delocalisation error; ships a PySCF interface.' }, lic: 'Apache 2.0', links: [['paper', 'https://doi.org/10.1126/science.abj6511'], ['code', 'https://github.com/google-deepmind/deepmind-research/tree/master/density_functional_approximation_dm21']] },
      ],
    },
    {
      id: 'microsoft', repo: 'microsoft/mattergen', country: { zh: '美国 · 英国 · 中国', en: 'USA · UK · China' },
      name: { zh: '微软', en: 'Microsoft' }, lab: 'Microsoft Research AI for Science',
      glyph: 'MatterGen · Skala',
      blurb: {
        zh: '材料生成（MatterGen）、通用原子模型（MatterSim）、深度学习交换相关泛函（Skala）、蛋白质系综（BioEmu）：AI for Science 实验室几乎每一条都用 MIT 许可开源。',
        en: 'Materials generation (MatterGen), a universal atomistic model (MatterSim), a deep-learned XC functional (Skala), protein ensembles (BioEmu): nearly everything from the AI for Science lab is open under MIT.',
      },
      lead: {
        zh: '微软研究院 AI for Science 的路线是“从第一性原理数据学起，覆盖整条模拟链”：生成候选材料（MatterGen），用原子模型快速评估（MatterSim），用学出来的泛函做 DFT（Skala），再到蛋白质的动力学（AI2BMD、BioEmu）。几乎全部以 MIT 许可开源，商用也没有障碍，这在大公司里很少见。',
        en: 'Microsoft Research AI for Science learns from first-principles data and covers the whole simulation chain: generate candidate materials (MatterGen), screen them with an atomistic model (MatterSim), run DFT with a learned functional (Skala), and go on to protein dynamics (AI2BMD, BioEmu). Almost all of it is MIT-licensed, commercial use included, which is rare for a large company.',
      },
      facts: [['MIT', { zh: '主要模型的许可证', en: 'licence of the main models' }], ['2025', { zh: 'MatterGen 发表于 Nature', en: 'MatterGen published in Nature' }], ['2.8', { zh: 'Skala 在 GMTKN55 上的误差（kcal/mol），成本是半局域泛函的量级', en: 'Skala\'s GMTKN55 error (kcal/mol) at semi-local cost' }]],
      site: [
        { zh: '模型接口：用 UMA、MACE 对照 MatterSim 一类模型的结果', en: 'Model API: compare UMA and MACE with MatterSim-class results', href: '../../models/index.html' },
        { zh: '科学大模型里的 NatureLM（微软的科学语言模型）', en: 'NatureLM (Microsoft\'s science language model) in Science LLMs', href: '../../scimodels/index.html' },
      ],
      items: [
        { id: 'mattergen', kind: 'gen', use: 'open', year: '2025', name: 'MatterGen', desc: { zh: '扩散模型直接生成稳定的无机晶体，可以按化学组成、对称性、磁性、带隙等条件引导。', en: 'A diffusion model that generates stable inorganic crystals directly, steerable by chemistry, symmetry, magnetism, band gap and more.' }, lic: 'MIT', links: [['paper', 'https://doi.org/10.1038/s41586-025-08628-5'], ['code', 'https://github.com/microsoft/mattergen']] },
        { id: 'mattersim', kind: 'model', use: 'open', year: '2024', name: 'MatterSim', desc: { zh: '跨元素、温度和压力的原子模型（0–5000 K，最高 1000 GPa），pip 安装后作为 ASE 计算器用。', en: 'An atomistic model across elements, temperatures and pressures (0–5000 K, up to 1000 GPa); pip install and use as an ASE calculator.' }, lic: 'MIT', links: [['paper', 'https://arxiv.org/abs/2405.04967'], ['code', 'https://github.com/microsoft/mattersim']] },
        { id: 'skala', kind: 'qm', use: 'open', year: '2025', name: 'Skala', desc: { zh: '深度学习的交换相关泛函，从数据里学非局域的电子结构表示：在主族化学基准 GMTKN55 上误差 2.8 kcal/mol，好过主流杂化泛函，计算成本仍是半局域泛函的量级。', en: 'A deep-learned exchange–correlation functional that learns non-local electronic-structure features from data: 2.8 kcal/mol on the GMTKN55 main-group benchmark, better than leading hybrids, at the cost of semi-local DFT.' }, lic: 'MIT', links: [['paper', 'https://arxiv.org/abs/2506.14665'], ['code', 'https://github.com/microsoft/skala']] },
        { id: 'bioemu', kind: 'bio', use: 'open', year: '2025', name: 'BioEmu', desc: { zh: '生成蛋白质的平衡构象系综，单张 GPU 上每小时上千个结构，用来代替一部分长时间分子动力学。', en: 'Generates equilibrium ensembles of protein conformations, thousands of structures per GPU-hour, replacing some long molecular dynamics.' }, lic: { zh: 'MIT（原仓库已归档，见仓库说明的新位置）', en: 'MIT (original repository archived; see its README for the new home)' }, links: [['paper', 'https://doi.org/10.1126/science.adv9817'], ['code', 'https://github.com/microsoft/bioemu']] },
        { id: 'ai2bmd', kind: 'bio', use: 'open', year: '2024', name: 'AI2BMD', desc: { zh: '把蛋白质切成片段，用在 DFT 数据上训练的势做全原子分子动力学，精度接近从头算。', en: 'Fragments proteins and runs all-atom molecular dynamics with a potential trained on DFT data, at near ab initio accuracy.' }, lic: { zh: 'MIT（仓库已归档）', en: 'MIT (repository archived)' }, links: [['paper', 'https://doi.org/10.1038/s41586-024-08127-z'], ['code', 'https://github.com/microsoft/AI2BMD']] },
        { id: 'tamgen', kind: 'gen', use: 'open', year: '2024', name: 'TamGen', desc: { zh: '按靶点口袋生成候选药物分子的化学语言模型，论文里的抗结核化合物经过了实验验证。', en: 'A chemical language model that generates drug candidates for a target pocket; anti-tuberculosis compounds from the paper were tested experimentally.' }, lic: 'MIT', links: [['paper', 'https://doi.org/10.1038/s41467-024-53632-4'], ['code', 'https://github.com/microsoft/TamGen']] },
        { id: 'graphormer', kind: 'model', use: 'open', year: '2021', name: 'Graphormer', desc: { zh: '把 Transformer 用到分子图上，OGB-LSC 量子化学赛道的冠军方案，后来的很多分子 Transformer 都从它出发。', en: 'Transformers on molecular graphs; won the OGB-LSC quantum chemistry track and seeded many later molecular Transformers.' }, lic: 'MIT', links: [['paper', 'https://arxiv.org/abs/2106.05234'], ['code', 'https://github.com/microsoft/Graphormer']] },
        { id: 'aurora', kind: 'tool', use: 'open', year: '2025', name: 'Aurora', desc: { zh: '地球系统基础模型，包括空气质量（大气化学）预报。和化学的关系是大气污染物，放在这里供参考。', en: 'An Earth-system foundation model that includes air-quality (atmospheric chemistry) forecasts. Listed for its pollutant chemistry.' }, lic: { zh: '代码 MIT；模型参数条款见仓库', en: 'Code MIT; weight terms in the repository' }, links: [['paper', 'https://doi.org/10.1038/s41586-025-09005-y'], ['code', 'https://github.com/microsoft/aurora']] },
      ],
    },
    {
      id: 'nvidia', repo: 'NVIDIA/nvalchemi-toolkit', country: { zh: '美国', en: 'USA' },
      name: { zh: '英伟达', en: 'NVIDIA' }, lab: 'NVIDIA ALCHEMI · BioNeMo',
      glyph: 'ALCHEMI · cuEq',
      blurb: {
        zh: '不太做“一个明星模型”，而是把别人的模型跑得更快：ALCHEMI 批量做几何优化，cuEquivariance 加速 MACE 一类的等变网络，nvMolKit 把 RDKit 常用操作搬到 GPU，BioNeMo 管药物发现。',
        en: 'Less about one star model, more about making everyone\'s models faster: ALCHEMI batches geometry optimisation, cuEquivariance speeds up equivariant networks such as MACE, nvMolKit moves common RDKit operations to the GPU, and BioNeMo covers drug discovery.',
      },
      lead: {
        zh: '英伟达在化学上的角色是“底座”：自己的模型不多，但大部分开源原子模型在它的库上跑得更快。对研究者来说，最实用的是三样东西：ALCHEMI 工具包（几千个结构一起做弛豫）、cuEquivariance（等变张量积的 CUDA 内核，MACE 等已经接入）和 nvMolKit（GPU 上的指纹、相似度和构象生成）。药物发现那边是 BioNeMo 平台和一组 NIM 微服务。',
        en: 'In chemistry NVIDIA plays the role of the foundation: few models of its own, but most open atomistic models run faster on its libraries. Three things matter most to researchers: the ALCHEMI toolkit (relax thousands of structures at once), cuEquivariance (CUDA kernels for equivariant tensor products, already used by MACE and others) and nvMolKit (fingerprints, similarity and conformers on the GPU). For drug discovery there is the BioNeMo platform and a set of NIM microservices.',
      },
      facts: [['GPU', { zh: '把现有模型和化学信息学操作加速', en: 'acceleration for existing models and cheminformatics' }], ['Apache 2.0', { zh: 'ALCHEMI 工具包、Warp、CUDA-Q 的许可证', en: 'licence of the ALCHEMI toolkit, Warp and CUDA-Q' }], ['NIM', { zh: '按容器部署的推理微服务（商业）', en: 'containerised inference microservices (commercial)' }]],
      site: [
        { zh: '量子嘉年华 · 量子算法：CUDA-Q 一类工具在做什么', en: 'Quantum Carnival · Algorithms: what tools like CUDA-Q are for', href: '../../quantum/algorithms/index.html' },
        { zh: '开源代码台：给 GPU 程序生成输入', en: 'Code Desk: inputs for GPU-ready programs', href: '../../code/index.html' },
      ],
      items: [
        { id: 'alchemi', kind: 'tool', use: 'open', year: '2025', name: 'ALCHEMI Toolkit', desc: { zh: '在 GPU 上批量运行机器学习势的几何优化和分子动力学，支持多种开源原子模型。另有商业的 ALCHEMI NIM。', en: 'Batched geometry optimisation and molecular dynamics with machine-learning potentials on GPUs, supporting several open atomistic models. A commercial ALCHEMI NIM also exists.' }, lic: 'Apache 2.0', links: [['code', 'https://github.com/NVIDIA/nvalchemi-toolkit']] },
        { id: 'cuequivariance', kind: 'tool', use: 'open', year: '2024', name: 'cuEquivariance', desc: { zh: '等变神经网络（球谐张量积）的 CUDA 加速库，MACE 等模型可以直接调用，训练和推理都更快。', en: 'CUDA acceleration for equivariant networks (spherical-harmonic tensor products); MACE and other models call it directly for faster training and inference.' }, lic: { zh: '许可证见仓库（GitHub 未识别）', en: 'Licence in the repository (not detected by GitHub)' }, links: [['code', 'https://github.com/NVIDIA/cuEquivariance']] },
        { id: 'nvmolkit', kind: 'tool', use: 'open', year: '2025', name: 'nvMolKit', desc: { zh: 'GPU 上的化学信息学：分子指纹、相似度、构象生成和力场优化，接口和 RDKit 对齐，适合百万级分子库。', en: 'Cheminformatics on the GPU: fingerprints, similarity, conformer generation and force-field optimisation with RDKit-like interfaces, for libraries of millions of molecules.' }, lic: { zh: '许可证见仓库（GitHub 未识别）', en: 'Licence in the repository (not detected by GitHub)' }, links: [['code', 'https://github.com/NVIDIA-BioNeMo/nvMolKit']] },
        { id: 'genmol', kind: 'gen', use: 'service', year: '2025', name: 'GenMol', desc: { zh: '离散扩散的分子生成模型，一个模型做从头设计、片段连接、骨架修饰和先导物优化，以 NIM 提供。', en: 'A discrete-diffusion molecule generator: de novo design, fragment linking, scaffold decoration and lead optimisation in one model, offered as a NIM.' }, lic: { zh: 'NVIDIA NIM 条款', en: 'NVIDIA NIM terms' }, links: [['paper', 'https://arxiv.org/abs/2501.06158'], ['site', 'https://www.nvidia.com/en-us/clara/bionemo/']] },
        { id: 'laproteina', kind: 'bio', use: 'nc', year: '2025', name: 'La-Proteina', desc: { zh: '部分隐变量的流匹配模型，同时生成蛋白质的序列和全原子结构。', en: 'A partially latent flow-matching model that generates protein sequence and all-atom structure together.' }, lic: { zh: '许可证见仓库（GitHub 未识别）', en: 'Licence in the repository (not detected by GitHub)' }, links: [['paper', 'https://arxiv.org/abs/2507.09466'], ['code', 'https://github.com/NVIDIA-BioNeMo/la-proteina']] },
        { id: 'warp', kind: 'tool', use: 'open', year: '2022', name: 'Warp', desc: { zh: '用 Python 写 GPU 内核的框架，可微分，适合自己写模拟（粒子、网格、分子动力学的小实验）。', en: 'Write GPU kernels in Python, differentiably; good for home-made simulations (particles, grids, small MD experiments).' }, lic: 'Apache 2.0', links: [['code', 'https://github.com/NVIDIA/warp']] },
        { id: 'cudaq', kind: 'qm', use: 'open', year: '2023', name: 'CUDA-Q', desc: { zh: '量子–经典混合编程平台，在 GPU 上模拟量子线路，常用于 VQE 一类的量子化学算法研究。', en: 'A hybrid quantum–classical programming platform that simulates circuits on GPUs, often used for VQE-style quantum chemistry research.' }, lic: 'Apache 2.0', links: [['code', 'https://github.com/NVIDIA/cuda-quantum']] },
        { id: 'physicsnemo', kind: 'tool', use: 'open', year: '2023', name: 'PhysicsNeMo', desc: { zh: '物理 AI 框架（原 Modulus）：神经算子、物理信息网络，用于流体、传热等连续介质问题。', en: 'A physics-AI framework (formerly Modulus): neural operators and physics-informed networks for fluids, heat transfer and other continuum problems.' }, lic: 'Apache 2.0', links: [['code', 'https://github.com/NVIDIA/physicsnemo']] },
      ],
    },
    {
      id: 'dp', repo: 'deepmodeling/deepmd-kit', country: { zh: '中国', en: 'China' },
      name: { zh: '深势科技', en: 'DP Technology' }, lab: { zh: '深势科技 · DeepModeling 社区', en: 'DP Technology · DeepModeling community' },
      glyph: 'DeePMD · DPA',
      blurb: {
        zh: 'DeePMD-kit 和 DP-GEN 让“深度势能分子动力学”成为常用方法，DPA 系列是大原子模型，Uni-Mol 是三维分子表示，Uni-Dock 是 GPU 对接。和北京科学智能研究院、DeepModeling 开源社区一起维护。',
        en: 'DeePMD-kit and DP-GEN made Deep Potential molecular dynamics a standard method; the DPA series are large atomic models, Uni-Mol is a 3D molecular representation, and Uni-Dock does GPU docking. Maintained with the AI for Science Institute (Beijing) and the DeepModeling open-source community.',
      },
      lead: {
        zh: '国内 AI for Science 开源生态的中心之一。DeePMD-kit（深度势能）和 DP-GEN（并发学习自动生成训练集）是许多材料和水、电解液模拟论文的标准工具；DPA-2、DPA-3 走“大原子模型”路线，预训练后在下游体系上微调；Uni-Mol 系列做三维分子表示，Uni-Dock 把对接搬到 GPU 上。DeePMD-kit 一类是 LGPL，商用时只要不改库本身一般可以链接使用，改了要按 LGPL 开源。',
        en: 'One of the hubs of the open AI-for-Science ecosystem in China. DeePMD-kit (Deep Potential) and DP-GEN (concurrent learning that builds training sets automatically) are standard tools in many materials, water and electrolyte simulation papers; DPA-2 and DPA-3 follow the large-atomic-model route, pre-trained and then fine-tuned for a system; the Uni-Mol series learns 3D molecular representations, and Uni-Dock moves docking onto GPUs. DeePMD-kit and friends are LGPL: linking an unmodified library is usually fine for commercial use, while changes to the library must be released under the LGPL.',
      },
      facts: [['LGPL-3.0', { zh: 'DeePMD-kit、DP-GEN、ABACUS 的许可证', en: 'licence of DeePMD-kit, DP-GEN and ABACUS' }], ['DPA-3', { zh: '面向大原子模型的图网络（2025）', en: 'a graph network for large atomic models (2025)' }], ['GPU', { zh: 'Uni-Dock 让超大规模虚拟筛选可行', en: 'Uni-Dock makes ultra-large virtual screening feasible' }]],
      site: [
        { zh: '开源代码台：查 DeePMD-kit 等软件的许可与漏洞', en: 'Code Desk: check licences and advisories of DeePMD-kit and others', href: '../../code/index.html' },
        { zh: '数据库目录里的机器学习势条目', en: 'Machine-learning potentials in the catalogue', href: '../../atlas/index.html#resources' },
      ],
      items: [
        { id: 'deepmd', kind: 'model', use: 'copyleft', year: '2018', name: 'DeePMD-kit', desc: { zh: '深度势能模型的训练和推理，接 LAMMPS、GROMACS、ASE 等做分子动力学，v2 起支持多种模型和多后端。', en: 'Training and inference for Deep Potential models, plugged into LAMMPS, GROMACS, ASE and others for MD; v2 adds more models and back ends.' }, lic: 'LGPL-3.0', links: [['paper', 'https://doi.org/10.1016/j.cpc.2018.03.016'], ['paper', 'https://doi.org/10.1063/5.0155600'], ['code', 'https://github.com/deepmodeling/deepmd-kit']] },
        { id: 'dpgen', kind: 'tool', use: 'copyleft', year: '2020', name: 'DP-GEN', desc: { zh: '并发学习：探索、挑出模型不确定的结构、做 DFT 标注，循环生成可靠的训练集。', en: 'Concurrent learning: explore, pick structures the models disagree on, label them with DFT, and loop until the training set is reliable.' }, lic: 'LGPL-3.0', links: [['paper', 'https://doi.org/10.1016/j.cpc.2020.107206'], ['code', 'https://github.com/deepmodeling/dpgen']] },
        { id: 'dpa2', kind: 'model', use: 'copyleft', year: '2024', name: 'DPA-2', desc: { zh: '多任务预训练的大原子模型，在不同 DFT 设置的数据上一起训练，下游微调需要的数据少。', en: 'A large atomic model pre-trained on many tasks with different DFT settings; fine-tuning needs little data.' }, lic: { zh: 'LGPL-3.0（随 DeePMD-kit 发布）', en: 'LGPL-3.0 (ships with DeePMD-kit)' }, links: [['paper', 'https://doi.org/10.1038/s41524-024-01493-2'], ['code', 'https://github.com/deepmodeling/deepmd-kit']] },
        { id: 'dpa3', kind: 'model', use: 'copyleft', year: '2025', name: 'DPA-3', desc: { zh: '基于线图的图网络，为大原子模型的规模定律设计；OpenLAM 项目发布预训练参数。', en: 'A line-graph network designed for scaling large atomic models; pre-trained weights are published by the OpenLAM project.' }, lic: { zh: 'LGPL-3.0（DeePMD-kit）；OpenLAM 为 LGPL-2.1', en: 'LGPL-3.0 (DeePMD-kit); OpenLAM is LGPL-2.1' }, links: [['paper', 'https://arxiv.org/abs/2506.01686'], ['code', 'https://github.com/deepmodeling/openlam']] },
        { id: 'uni-mol', kind: 'model', use: 'open', year: '2022', name: 'Uni-Mol · Uni-Mol2', desc: { zh: '三维分子表示学习，用于性质预测、构象生成和口袋–配体任务；Uni-Mol2 把预训练扩到十亿参数。', en: '3D molecular representation learning for property prediction, conformers and pocket–ligand tasks; Uni-Mol2 scales pre-training to a billion parameters.' }, lic: 'MIT', links: [['paper', 'https://doi.org/10.26434/chemrxiv-2022-jjm0j'], ['paper', 'https://arxiv.org/abs/2406.14969'], ['code', 'https://github.com/deepmodeling/Uni-Mol']] },
        { id: 'uni-dock', kind: 'tool', use: 'open', year: '2023', name: 'Uni-Dock', desc: { zh: 'GPU 加速的分子对接，比 CPU 上的 AutoDock Vina 快上千倍，用于上亿分子的虚拟筛选。', en: 'GPU-accelerated docking, over a thousand times faster than AutoDock Vina on CPUs, for virtual screens of hundreds of millions of molecules.' }, lic: 'Apache 2.0', links: [['paper', 'https://doi.org/10.1021/acs.jctc.2c01145'], ['code', 'https://github.com/dptech-corp/Uni-Dock']] },
        { id: 'uni-fold', kind: 'bio', use: 'open', year: '2022', name: 'Uni-Fold', desc: { zh: '可训练的 AlphaFold 复现（PyTorch），支持多聚体和对称复合物。', en: 'A trainable AlphaFold reimplementation in PyTorch, with multimers and symmetric complexes.' }, lic: 'Apache 2.0', links: [['code', 'https://github.com/dptech-corp/Uni-Fold']] },
        { id: 'abacus', kind: 'qm', use: 'copyleft', year: '', name: 'ABACUS', desc: { zh: '国产开源第一性原理软件，平面波和数值原子轨道两种基组，常用来给深度势能生成 DFT 数据。', en: 'An open first-principles code from China with plane-wave and numerical atomic-orbital bases, often used to label data for Deep Potentials.' }, lic: 'LGPL-3.0', links: [['code', 'https://github.com/deepmodeling/abacus-develop']] },
        { id: 'bohrium', kind: 'tool', use: 'service', year: '', name: 'Bohrium', desc: { zh: '深势科技的科研云平台：算力、Notebook 和上面这些软件的现成环境，按用量收费。', en: 'DP Technology\'s research cloud: compute, notebooks and ready-made environments for the software above, pay as you go.' }, lic: { zh: '商业服务', en: 'Commercial service' }, links: [['site', 'https://bohrium.dp.tech/']] },
      ],
    },
    {
      id: 'bytedance', repo: 'bytedance/Protenix', country: { zh: '中国', en: 'China' },
      name: { zh: '字节跳动', en: 'ByteDance' }, lab: 'ByteDance Seed',
      glyph: 'Protenix · ByteFF',
      blurb: {
        zh: 'Protenix 是可训练的 AlphaFold 3 开源复现（Apache 2.0，可商用）；ByteFF 用机器学习给分子力学力场定参数；BAMBOO 是电解液的机器学习力场；DPLM 是蛋白质扩散语言模型。',
        en: 'Protenix is a trainable open reproduction of AlphaFold 3 (Apache 2.0, commercial use allowed); ByteFF parametrises molecular-mechanics force fields with machine learning; BAMBOO is a machine-learning force field for electrolytes; DPLM is a diffusion language model for proteins.',
      },
      lead: {
        zh: '字节跳动 Seed 的 AI for Science 团队在生物分子和电池材料上各有一条线。最值得知道的是 Protenix：完整复现 AlphaFold 3 的训练与推理，代码和参数都是 Apache 2.0，所以在需要商用或自己再训练时，它常被拿来代替 AlphaFold 3。力场方面，ByteFF 用图网络从大量量子化学数据里给 Amber 形式的力场定参数，BAMBOO 专门做锂电池电解液。',
        en: 'ByteDance Seed\'s AI for Science team has one line in biomolecules and one in battery materials. Protenix is the one to know: a full reproduction of AlphaFold 3 training and inference with code and weights under Apache 2.0, so it is often used instead of AlphaFold 3 when commercial use or retraining is needed. For force fields, ByteFF uses a graph network trained on lots of quantum chemistry to parametrise an Amber-style force field, and BAMBOO targets lithium-battery electrolytes.',
      },
      facts: [['Apache 2.0', { zh: 'Protenix 的代码和模型参数', en: 'Protenix code and weights' }], ['AF3', { zh: 'Protenix 复现的架构', en: 'the architecture Protenix reproduces' }], ['GPL-2.0', { zh: 'BAMBOO 的许可证（仓库已归档）', en: 'BAMBOO licence (repository archived)' }]],
      site: [
        { zh: '量子生物学展馆：酶与蛋白质里的量子效应', en: 'Quantum Biology pavilion: quantum effects in enzymes and proteins', href: '../../quantum/biology/index.html' },
        { zh: 'AI 实验室：电解液分子的筛选流程', en: 'AI Lab: a screening workflow for electrolyte molecules', href: '../../lab/index.html' },
      ],
      items: [
        { id: 'protenix', kind: 'bio', use: 'open', year: '2025', name: 'Protenix', desc: { zh: 'AlphaFold 3 的完整可训练复现，预测蛋白质、核酸和配体复合物，提供训练代码、数据流程和模型参数。', en: 'A complete, trainable AlphaFold 3 reproduction for complexes of proteins, nucleic acids and ligands, with training code, data pipeline and weights.' }, lic: 'Apache 2.0', links: [['paper', 'https://doi.org/10.1101/2025.01.08.631967'], ['code', 'https://github.com/bytedance/Protenix']] },
        { id: 'byteff', kind: 'model', use: 'open', year: '2024', name: 'ByteFF', desc: { zh: '图神经网络在大量 DFT 数据上训练，给类药分子预测 Amber 形式的键、角、二面角和非键参数。', en: 'A graph network trained on a large DFT set that predicts Amber-style bond, angle, torsion and non-bonded parameters for drug-like molecules.' }, lic: { zh: 'Apache 2.0（仓库已归档）', en: 'Apache 2.0 (repository archived)' }, links: [['paper', 'https://arxiv.org/abs/2408.12817'], ['code', 'https://github.com/bytedance/byteff']] },
        { id: 'bamboo', kind: 'model', use: 'copyleft', year: '2025', name: 'BAMBOO', desc: { zh: '电解液的机器学习力场框架，用实验密度等数据校准，预测粘度、电导率等宏观性质。', en: 'A machine-learning force-field framework for liquid electrolytes, aligned to experimental densities and used to predict viscosity, conductivity and other bulk properties.' }, lic: { zh: 'GPL-2.0（仓库已归档）', en: 'GPL-2.0 (repository archived)' }, links: [['paper', 'https://doi.org/10.1038/s42256-025-01009-7'], ['code', 'https://github.com/bytedance/bamboo']] },
        { id: 'dplm', kind: 'bio', use: 'open', year: '2024', name: 'DPLM', desc: { zh: '扩散蛋白质语言模型，既能生成序列，也能做表示学习和条件设计。', en: 'A diffusion protein language model for sequence generation, representation learning and conditional design.' }, lic: { zh: 'Apache 2.0（仓库已归档）', en: 'Apache 2.0 (repository archived)' }, links: [['paper', 'https://arxiv.org/abs/2402.18567'], ['code', 'https://github.com/bytedance/dplm']] },
      ],
    },
    {
      id: 'ibm', repo: 'GT4SD/gt4sd-core', country: { zh: '美国 · 瑞士', en: 'USA · Switzerland' },
      name: { zh: 'IBM', en: 'IBM' }, lab: 'IBM Research',
      glyph: 'RXN · MoLFormer',
      blurb: {
        zh: 'RXN for Chemistry 是最早面向化学家的在线反应预测与逆合成服务；MoLFormer 是在十亿级 SMILES 上预训练的化学语言模型；GT4SD 把各家生成模型装进一个工具箱。',
        en: 'RXN for Chemistry was one of the first online reaction-prediction and retrosynthesis services for chemists; MoLFormer is a chemical language model pre-trained on a billion SMILES; GT4SD packs many generative models into one toolkit.',
      },
      lead: {
        zh: 'IBM 苏黎世研究院和纽约的团队较早把语言模型用到化学上：Molecular Transformer 把反应预测当成“翻译”，RXN for Chemistry 是它的在线服务，还能把反应步骤转成实验操作；MoLFormer 在十亿级分子上预训练，用于性质预测；GT4SD 是和多所高校合作的生成模型工具箱（MIT 许可）。',
        en: 'IBM Research in Zurich and New York were early to apply language models to chemistry: Molecular Transformer treats reaction prediction as translation, RXN for Chemistry serves it online and can turn reactions into lab procedures; MoLFormer is pre-trained on a billion molecules for property prediction; GT4SD is a generative-model toolkit built with several universities (MIT licence).',
      },
      facts: [['2019', { zh: 'Molecular Transformer 发表', en: 'Molecular Transformer published' }], [{ zh: '11 亿', en: '1.1B' }, { zh: 'MoLFormer 预训练用的分子数', en: 'molecules used to pre-train MoLFormer' }], ['MIT', { zh: 'GT4SD 与 rxn4chemistry 的许可证', en: 'licence of GT4SD and rxn4chemistry' }]],
      site: [
        { zh: '讲解手册：化学信息学与反应预测', en: 'Handbook: cheminformatics and reaction prediction', href: '../../manual/index.html' },
        { zh: '科学大模型：更多化学语言模型和价格', en: 'Science LLMs: more chemical language models and prices', href: '../../scimodels/index.html' },
      ],
      items: [
        { id: 'rxn', kind: 'tool', use: 'service', year: '2019', name: 'RXN for Chemistry', desc: { zh: '在线的正向反应预测、逆合成规划和“反应转实验步骤”，背后是 Molecular Transformer 一系模型；有免费额度，Python 包 rxn4chemistry 调用接口。', en: 'Online forward reaction prediction, retrosynthesis planning and reaction-to-procedure, built on the Molecular Transformer line; has a free tier, with the rxn4chemistry Python package for the API.' }, lic: { zh: '在线服务；rxn4chemistry 为 MIT', en: 'Hosted service; rxn4chemistry is MIT' }, links: [['paper', 'https://doi.org/10.1021/acscentsci.9b00576'], ['site', 'https://rxn.app.accelerate.science/'], ['code', 'https://github.com/rxn4chemistry/rxn4chemistry']] },
        { id: 'molformer', kind: 'model', use: 'open', year: '2022', name: 'MoLFormer', desc: { zh: '线性注意力的 Transformer，在 11 亿个分子的 SMILES 上自监督预训练，微调后做性质预测。', en: 'A linear-attention Transformer pre-trained self-supervised on SMILES of 1.1 billion molecules, fine-tuned for property prediction.' }, lic: 'Apache 2.0', links: [['paper', 'https://doi.org/10.1038/s42256-022-00580-7'], ['code', 'https://github.com/IBM/molformer']] },
        { id: 'gt4sd', kind: 'gen', use: 'open', year: '2023', name: 'GT4SD', desc: { zh: '科学发现的生成模型工具箱：分子、材料、蛋白质的生成模型统一接口，可以直接推理或再训练。', en: 'Generative Toolkit for Scientific Discovery: one interface to generative models for molecules, materials and proteins, for inference or retraining.' }, lic: 'MIT', links: [['paper', 'https://doi.org/10.1038/s41524-023-01028-1'], ['code', 'https://github.com/GT4SD/gt4sd-core']] },
        { id: 'fm4m', kind: 'model', use: 'open', year: '2024', name: 'FM4M', desc: { zh: '材料与分子的基础模型合集（SMILES、SELFIES、分子图等多种表示），可以组合成多视图模型。', en: 'A family of foundation models for materials and molecules over several representations (SMILES, SELFIES, graphs), combinable into multi-view models.' }, lic: { zh: 'Apache 2.0（仓库已归档）', en: 'Apache 2.0 (repository archived)' }, links: [['code', 'https://github.com/IBM/materials']] },
      ],
    },
    {
      id: 'baidu', repo: 'PaddlePaddle/PaddleHelix', country: { zh: '中国', en: 'China' },
      name: { zh: '百度', en: 'Baidu' }, lab: { zh: '百度螺旋桨 PaddleHelix', en: 'Baidu PaddleHelix' },
      glyph: 'HelixFold3',
      blurb: {
        zh: '飞桨上的生物计算平台 PaddleHelix，核心是 HelixFold 系列结构预测模型；HelixFold3 复现了 AlphaFold 3 一类的复合物预测，有在线服务。',
        en: 'PaddleHelix, the biocomputing platform on PaddlePaddle, centres on the HelixFold structure-prediction models; HelixFold3 reproduces AlphaFold 3-style complex prediction and has an online service.',
      },
      lead: {
        zh: '百度的螺旋桨 PaddleHelix 把药物研发和蛋白质结构的模型放在飞桨（PaddlePaddle）框架上。HelixFold3 预测蛋白质、核酸和小分子的复合物，技术报告里和 AlphaFold 3 做了对比；PaddleHelix 仓库里还有分子性质预测和药物–靶点相互作用的模型。仓库的许可证 GitHub 没有识别，使用前请看仓库里各个模型的说明。',
        en: 'Baidu\'s PaddleHelix puts drug-discovery and protein-structure models on the PaddlePaddle framework. HelixFold3 predicts complexes of proteins, nucleic acids and small molecules, compared with AlphaFold 3 in its technical report; the PaddleHelix repository also has molecular property and drug–target interaction models. GitHub does not detect the repository\'s licence, so read each model\'s notes before use.',
      },
      facts: [['HelixFold3', { zh: '生物分子复合物结构预测', en: 'biomolecular complex structure prediction' }], ['PaddlePaddle', { zh: '飞桨深度学习框架', en: 'deep learning framework' }]],
      site: [{ zh: '量子生物学展馆的结构馆', en: 'The structure gallery in the Quantum Biology pavilion', href: '../../quantum/biology/index.html' }],
      items: [
        { id: 'helixfold3', kind: 'bio', use: 'nc', year: '2024', name: 'HelixFold3', desc: { zh: '预测蛋白质、核酸、配体组成的复合物结构；开源推理代码，另有在线服务。', en: 'Predicts structures of complexes of proteins, nucleic acids and ligands; open inference code plus an online service.' }, lic: { zh: '条款见仓库（GitHub 未识别）', en: 'Terms in the repository (not detected by GitHub)' }, links: [['paper', 'https://arxiv.org/abs/2408.16975'], ['code', 'https://github.com/PaddlePaddle/PaddleHelix']] },
        { id: 'paddlehelix', kind: 'tool', use: 'nc', year: '', name: 'PaddleHelix', desc: { zh: '生物计算工具集：分子表示与性质预测、药物–靶点相互作用、蛋白质结构，基于飞桨。', en: 'A biocomputing toolkit on PaddlePaddle: molecular representation and properties, drug–target interaction and protein structure.' }, lic: { zh: '条款见仓库（GitHub 未识别）', en: 'Terms in the repository (not detected by GitHub)' }, links: [['code', 'https://github.com/PaddlePaddle/PaddleHelix']] },
      ],
    },
    {
      id: 'orbital', repo: 'orbital-materials/orb-models', country: { zh: '英国 · 美国', en: 'UK · USA' },
      name: { zh: 'Orbital Materials', en: 'Orbital Materials' }, lab: 'Orbital Materials',
      glyph: 'Orb-v3',
      blurb: {
        zh: '一家做材料的初创公司，开源了 Orb 系列通用机器学习势（Apache 2.0）：速度快、可以商用，在 Matbench Discovery 等基准上表现靠前。',
        en: 'A materials start-up that open-sourced the Orb universal machine-learning potentials (Apache 2.0): fast, commercial use allowed, and near the top of benchmarks such as Matbench Discovery.',
      },
      lead: {
        zh: 'Orbital Materials 用自己的模型设计吸附剂和催化剂，同时把 Orb 原子模型开源。Orb-v3 提供不同精度和速度的几个版本（保守力或直接预测力、不同的邻居数），论文报告延迟降低十倍以上、内存降低八倍以上，pip 安装后作为 ASE 计算器用。和 UMA 相比，它的许可更宽松（Apache 2.0，模型参数也开放下载），适合需要商用的项目。',
        en: 'Orbital Materials designs sorbents and catalysts with its own models and open-sources the Orb atomistic models. Orb-v3 comes in several speed–accuracy variants (conservative or direct forces, different neighbour limits); the paper reports over 10× lower latency and over 8× lower memory; pip install and use as an ASE calculator. Compared with UMA its licence is more permissive (Apache 2.0, weights downloadable too), which suits commercial projects.',
      },
      facts: [['Apache 2.0', { zh: '代码和模型参数', en: 'code and weights' }], ['10×', { zh: 'Orb-v3 论文报告的延迟降低', en: 'latency reduction reported for Orb-v3' }]],
      site: [{ zh: '模型接口：和 UMA、MACE 的结果对照', en: 'Model API: compare with UMA and MACE results', href: '../../models/index.html' }],
      items: [
        { id: 'orb-v3', kind: 'model', use: 'open', year: '2025', name: 'Orb-v3', desc: { zh: '通用原子间势，有保守与直接预测力两类、多种邻居上限的版本，面向大规模模拟。', en: 'Universal interatomic potentials in conservative and direct-force variants with several neighbour limits, built for large-scale simulation.' }, lic: 'Apache 2.0', links: [['paper', 'https://arxiv.org/abs/2504.06231'], ['code', 'https://github.com/orbital-materials/orb-models']] },
        { id: 'orb-v2', kind: 'model', use: 'open', year: '2024', name: 'Orb · Orb-v2', desc: { zh: '第一代 Orb：不强制等变、靠数据增强学旋转不变性，用速度换来很大的模拟规模。', en: 'The first Orb models: no built-in equivariance, rotation invariance learned through augmentation, trading strictness for speed and scale.' }, lic: 'Apache 2.0', links: [['paper', 'https://arxiv.org/abs/2410.22570'], ['code', 'https://github.com/orbital-materials/orb-models']] },
      ],
    },
    {
      id: 'chai', repo: 'chaidiscovery/chai-lab', country: { zh: '美国', en: 'USA' },
      name: { zh: 'Chai Discovery', en: 'Chai Discovery' }, lab: 'Chai Discovery',
      glyph: 'Chai-1',
      blurb: {
        zh: '做 AI 药物发现的初创公司，Chai-1 是多模态生物分子结构预测模型，可以只给单条序列运行，网页版免费（论文说明包括商业药物研发）。',
        en: 'An AI drug-discovery start-up; Chai-1 is a multimodal biomolecular structure model that can run from a single sequence; its web app is free (including, per the paper, for commercial drug discovery).',
      },
      lead: {
        zh: 'Chai-1 和 AlphaFold 3 做同一件事：预测蛋白质、小分子、核酸和修饰组成的复合物。它可以不依赖多序列比对（MSA）运行，还能接受实验约束（比如交联或口袋残基）。论文发布时，模型参数和推理代码限非商业使用，网页版可免费用于包括商业药物研发在内的用途；GitHub 仓库现在标的是 Apache 2.0，商用前以仓库里当前的许可文件为准。',
        en: 'Chai-1 does what AlphaFold 3 does: predicts complexes of proteins, small molecules, nucleic acids and modifications. It can run without multiple sequence alignments and accepts experimental restraints (such as cross-links or pocket residues). At release the weights and inference code were for non-commercial use, while the web app was free for any use including commercial drug discovery; the GitHub repository now shows Apache 2.0, so check its current licence file before commercial use.',
      },
      facts: [[{ zh: '单序列', en: 'Single sequence' }, { zh: '不用 MSA 也能运行，保留大部分精度', en: 'runs without an MSA, keeping most of its accuracy' }], [{ zh: '约束', en: 'Restraints' }, { zh: '可以加入实验约束，提升两位数百分点', en: 'experimental restraints add double-digit points' }]],
      site: [{ zh: '量子生物学展馆的结构馆', en: 'The structure gallery in the Quantum Biology pavilion', href: '../../quantum/biology/index.html' }],
      items: [
        { id: 'chai-1', kind: 'bio', use: 'nc', year: '2024', name: 'Chai-1', desc: { zh: '多模态复合物结构预测，支持单序列模式和实验约束；有网页版可以直接提交。', en: 'Multimodal complex structure prediction with single-sequence mode and experimental restraints; a web app takes jobs directly.' }, lic: { zh: '仓库 Apache 2.0（GitHub 识别）；论文发布时参数限非商业，商用前看仓库', en: 'Repository Apache 2.0 (as detected by GitHub); weights were non-commercial at release, check before commercial use' }, links: [['paper', 'https://doi.org/10.1101/2024.10.10.615955'], ['code', 'https://github.com/chaidiscovery/chai-lab'], ['demo', 'https://lab.chaidiscovery.com/']] },
      ],
    },
    {
      id: 'rowan', repo: 'rowansci/egret-public', country: { zh: '美国', en: 'USA' },
      name: { zh: 'Rowan', en: 'Rowan' }, lab: 'Rowan Scientific',
      glyph: 'Egret-1',
      blurb: {
        zh: '计算化学云平台 Rowan 开源了 Egret-1 系列神经网络势（MIT），针对生物有机分子；本站 AI 实验室的第一层筛选就是在 Rowan 云端跑 UMA。',
        en: 'The computational-chemistry cloud Rowan open-sourced the Egret-1 neural network potentials (MIT) for bioorganic molecules; the first screening tier of this site\'s AI Lab runs UMA on Rowan\'s cloud.',
      },
      lead: {
        zh: 'Rowan 是一个面向化学家的计算平台：在网页里提交构象搜索、pKa、能垒、溶解度等计算，背后混合使用 DFT、半经验方法和机器学习势。它开源的 Egret-1 系列是基于 MACE 架构的大型预训练神经网络势，面向主族、有机和生物分子化学；论文报告在二面角扫描、构象排序和几何优化上达到或超过常用量子化学方法，速度快几个数量级。',
        en: 'Rowan is a computing platform for chemists: submit conformer searches, pKa, barriers, solubility and more in the browser, run by a mix of DFT, semi-empirical methods and machine-learning potentials. Its open Egret-1 models are large pre-trained neural network potentials on the MACE architecture for main-group, organic and biomolecular chemistry; the paper reports matching or beating routine quantum-chemical methods on torsion scans, conformer ranking and geometry optimisation at orders-of-magnitude lower cost.',
      },
      facts: [['MIT', { zh: 'Egret-1 的许可证', en: 'Egret-1 licence' }], [{ zh: 'AI 实验室', en: 'AI Lab' }, { zh: '本站在用 Rowan 云端的 UMA', en: 'this site uses UMA on Rowan\'s cloud' }]],
      site: [{ zh: 'AI 实验室：第一层用 Rowan 上的 UMA 筛选', en: 'AI Lab: tier 1 screens with UMA on Rowan', href: '../../lab/index.html#method' }],
      items: [
        { id: 'egret-1', kind: 'model', use: 'open', year: '2025', name: 'Egret-1', desc: { zh: '基于 MACE 架构的预训练神经网络势，面向主族、有机和生物分子体系，有几个不同的版本。', en: 'Pre-trained neural network potentials on the MACE architecture for main-group, organic and biomolecular systems, in several variants.' }, lic: 'MIT', links: [['paper', 'https://arxiv.org/abs/2504.20955'], ['code', 'https://github.com/rowansci/egret-public']] },
        { id: 'rowan', kind: 'tool', use: 'service', year: '', name: 'Rowan', desc: { zh: '网页里的计算化学工作台，有免费额度；构象、pKa、反应能垒、光谱等工作流，也有 Python API。', en: 'A computational-chemistry workbench in the browser with a free tier: workflows for conformers, pKa, barriers, spectra and more, plus a Python API.' }, lic: { zh: '商业服务', en: 'Commercial service' }, links: [['site', 'https://rowansci.com/']], used: true },
      ],
    },
  ],
};
