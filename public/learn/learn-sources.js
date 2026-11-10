/* 研习台 · 站内内容来源：把六个讲解栏目的数据文件（量子物理、数学基础、量子算法、量子计算机、量子生物学、基础科学）
   改写成“章节”，给研习台当作学习目标的依据（grounding）；外加一张站内交互演示的白名单，AI 只能从这里挑 id。
   数据文件用到时才加载（load），已经在页面上的就直接用。除了加载脚本，这里不碰 DOM。
   加演示：在 DEMOS 里加一条，path 写成相对站点根的地址；锚点必须是那个页面的代码真的会处理的（tools/learn-sources-test.mjs 会查）。
   加来源：在 SOURCES 里加一条，再在 ADAPT 里写同名的改写函数。 */
(function (root) {
  'use strict';

  const doc = root.document;
  // 站点根：优先用 shared-nav.js 的 ChemHub.link（单文件版、子目录部署都对），否则按这个脚本自己的位置（public/learn/）推
  const BASE = (() => {
    try { return new URL('../', (doc && doc.currentScript && doc.currentScript.src) || (root.location && root.location.href)).href; } catch { return ''; }
  })();
  const link = (path) => {
    try {
      if (root.ChemHub && typeof root.ChemHub.link === 'function') return root.ChemHub.link(path);
      return BASE ? new URL(path, BASE).href : path;
    } catch { return path; }
  };

  const T = (zh, en) => ({ zh, en });
  const pick = (t, lang) => (t == null ? '' : typeof t === 'string' ? t : (lang === 'en' ? t.en : t.zh) || t.zh || t.en || '');
  const clean = (s) => String(s || '').replace(/<[^>]*>/g, '').replace(/[ \t]+/g, ' ').trim();

  // ── 来源 ──────────────────────────────────────────────────────────────
  // page：栏目页（相对站点根）；script：数据文件；global：数据文件定义的全局变量；anchor：章节锚点的前缀
  const SOURCES = [
    { id: 'qp', label: T('量子物理（12 章）', 'Quantum physics (12 chapters)'), page: 'quantum/physics/index.html', script: 'quantum/physics/qp-data.js', global: 'MOLASTRIA_QP', anchor: 'c-' },
    { id: 'fm', label: T('数学基础（10 门）', 'Mathematical foundations (10 subjects)'), page: 'fundamental-science/math/index.html', script: 'fundamental-science/math/fm-data.js', global: 'MOLASTRIA_FM', anchor: 'm-' },
    { id: 'qa', label: T('量子算法（14 个）', 'Quantum algorithms (14)'), page: 'quantum/algorithms/index.html', script: 'quantum/algorithms/qa-data.js', global: 'MOLASTRIA_QA', anchor: 'a-' },
    { id: 'qc', label: T('量子计算机（7 个专题）', 'Quantum computers (7 topics)'), page: 'quantum/computing/index.html', script: 'quantum/computing/qc-data.js', global: 'MOLASTRIA_QC', anchor: 's-' },
    { id: 'qb', label: T('量子生物学（7 个方向）', 'Quantum biology (7 directions)'), page: 'quantum/biology/index.html', script: 'quantum/biology/qb-data.js', global: 'MOLASTRIA_QB', anchor: 's-' },
    { id: 'fs', label: T('基础科学（6 个专题）', 'Fundamental science (6 topics)'), page: 'fundamental-science/index.html', script: 'fundamental-science/fs-data.js', global: 'MOLASTRIA_FS', anchor: 's-' },
  ];
  const SRC = Object.fromEntries(SOURCES.map((s) => [s.id, s]));

  // ── 演示白名单 ────────────────────────────────────────────────────────
  // path 相对站点根。锚点：游乐场 #play-<游戏>（play.js 的 route），#lab 是计算器；量子物理 #d-<演示>（qp.js 生成的 id）；
  // 量子算法、量子计算机、量子生物学、基础科学的演示是 index.html 里写好的 id="demo-…"；物理疆界图是 #pr-map、#pr-cube。
  const D = (id, path, zh, en, dzh, den, keywords) => ({ id, path, label: T(zh, en), desc: T(dzh, den), keywords });
  const DEMOS = [
    D('play-box', 'qchem/index.html#play-box', '盒中粒子调颜色', 'Particle in a box: tune the colour',
      '把共轭分子的 π 电子当成盒中粒子，调链长和电子数，让分子吸收目标颜色的光。', 'Treat the π electrons of a conjugated molecule as a particle in a box; tune chain length and electron count to absorb a target colour.',
      ['盒中粒子', '共轭', '吸收', '颜色', 'HOMO', 'LUMO', 'particle in a box', 'conjugated', 'absorption', 'colour', 'color', 'polyene']),
    D('play-orbital', 'qchem/index.html#play-orbital', '猜轨道', 'Guess the orbital',
      '看氢原子波函数的截面图，数节点、看相位，说出是哪个轨道。', 'Read a slice of a hydrogen wavefunction, count nodes and phases, and name the orbital.',
      ['轨道', '节点', '节面', '氢原子', '波函数', '量子数', 'orbital', 'node', 'hydrogen', 'wavefunction', 'quantum number']),
    D('play-config', 'qchem/index.html#play-config', '电子排布', 'Electron configurations',
      '按构造原理、泡利原理和洪特规则把电子放进轨道，排出前 36 号元素的基态。', 'Fill orbitals with the Aufbau principle, Pauli exclusion and Hund’s rule for the first 36 elements.',
      ['电子排布', '构造原理', '泡利', '洪特', '周期表', 'configuration', 'aufbau', 'pauli', 'hund', 'periodic']),
    D('play-tunnel', 'qchem/index.html#play-tunnel', '量子隧穿闯关', 'Quantum tunnelling missions',
      '调势垒宽度、高度和粒子能量，让电子或质子按指定概率穿过去。', 'Tune barrier width, height and particle energy so an electron or proton gets through with a set probability.',
      ['隧穿', '势垒', '透射', '质子', 'tunnelling', 'tunneling', 'barrier', 'transmission', 'proton']),
    D('play-ring', 'qchem/index.html#play-ring', '芳香性判断', 'Aromatic or not',
      '数环上的 π 电子判断芳香或反芳香，再用 Frost 圆看 Hückel 能级怎么填。', 'Count π electrons to call a ring aromatic or antiaromatic, then fill Hückel levels on a Frost circle.',
      ['芳香', 'Hückel', '休克尔', 'Frost', '4n+2', 'aromatic', 'antiaromatic', 'huckel', 'pi electrons']),
    D('play-lines', 'qchem/index.html#play-lines', '氢原子光谱', 'Hydrogen spectral lines',
      '给一条谱线的波长，找出是哪两个能级之间的跃迁。', 'Given the wavelength of a line, find the two levels of the transition.',
      ['光谱', '谱线', 'Rydberg', '里德伯', 'Balmer', '巴尔末', '跃迁', 'spectrum', 'spectral line', 'transition', 'hydrogen']),
    D('play-sg', 'qchem/index.html#play-sg', 'Stern–Gerlach 自旋过滤', 'Stern–Gerlach spin filters',
      '串联磁场分析器：挡住全部原子的一对中间再插一个，反而能放过去四分之一。', 'Analysers in series: put a third between a blocking pair and a quarter of the atoms get through.',
      ['自旋', 'Stern', 'Gerlach', '测量', '投影', 'spin', 'measurement', 'projection', 'spin-1/2']),
    D('play-bell', 'qchem/index.html#play-bell', 'CHSH 贝尔游戏', 'The CHSH Bell game',
      '两个不能通信的玩家合作答题：经典策略最多赢 75%，共享纠缠光子能到约 85%。', 'Two players who cannot talk: classical strategies win at most 75%, shared entangled photons about 85%.',
      ['贝尔', 'Bell', 'CHSH', '纠缠', '非定域', 'entanglement', 'nonlocality', 'local hidden variables']),
    D('play-circuit', 'qchem/index.html#play-circuit', '量子电路拼图', 'Quantum circuit puzzles',
      '只给几种门，拼出指定的量子态，比如 Bell 态和三比特 GHZ 态。', 'Build target states such as a Bell state or a three-qubit GHZ state from a few allowed gates.',
      ['量子门', '电路', '线路', 'CNOT', 'Hadamard', 'Bell 态', 'GHZ', 'gate', 'circuit', 'qubit']),
    D('play-qec', 'qchem/index.html#play-qec', '纠错救援', 'Error-correction rescue',
      '三个物理比特守一个逻辑比特：只看两个奇偶校验结果，判断该翻哪一位。', 'Three physical qubits guard one logical qubit: read two parity checks and decide which bit to flip.',
      ['纠错', '重复码', '校验', '综合征', '逻辑比特', 'error correction', 'repetition code', 'syndrome', 'parity', 'logical qubit']),
    D('play-grover', 'qchem/index.html#play-grover', 'Grover 寻宝', 'Grover treasure hunt',
      '每迭代一次宝物的振幅涨一点，挑准时机测量，转过头概率又会掉下来。', 'Each iteration raises the marked amplitude; measure at the right moment, because overshooting lowers it again.',
      ['Grover', '搜索', '振幅放大', '迭代', 'search', 'amplitude amplification', 'oracle']),
    D('play-enaqt', 'qchem/index.html#play-enaqt', '噪声助推能量传递', 'Noise-assisted energy transfer',
      '激发能穿过色素网络送到反应中心；调环境退相干，看噪声何时帮忙何时添乱。', 'Excitation crosses a pigment network to a reaction centre; tune dephasing to see when noise helps or hurts.',
      ['能量传递', '退相干', '光合作用', '激子', 'FMO', 'ENAQT', 'energy transfer', 'dephasing', 'photosynthesis', 'exciton']),
    D('play-planck', 'qchem/index.html#play-planck', '普朗克单位工坊', 'Planck units workshop',
      '只用 ħ、c、G 拼出长度、时间、质量、能量等普朗克单位。', 'Combine ħ, c and G into Planck length, time, mass, energy and more.',
      ['普朗克', '量纲', '量纲分析', '基本常数', 'Planck', 'dimensional analysis', 'constants', 'units']),
    D('play-cube', 'qchem/index.html#play-cube', 'ħ-c-G 立方体分拣', 'Sorting on the ħ-c-G cube',
      '潮汐、GPS 校时、金的颜色、白矮星质量上限：解释它们要打开哪几个常数。', 'Tides, GPS timing, the colour of gold, the white-dwarf mass limit: which constants does each need?',
      ['相对论', '量子', '引力', '立方体', '适用范围', 'relativity', 'gravity', 'cube', 'regime', 'relativistic']),
    D('qchem-lab', 'qchem/index.html#lab', '浏览器里的量子化学计算器', 'Quantum chemistry calculator in the browser',
      '在浏览器里跑 HF/DFT、MP2、CCSD(T)、FCI、几何优化与振动频率，结果与 PySCF 对拍过。', 'Run HF/DFT, MP2, CCSD(T), FCI, geometry optimisation and frequencies in the browser, benchmarked against PySCF.',
      ['Hartree', 'Fock', 'HF', 'DFT', '密度泛函', 'MP2', 'CCSD', '耦合簇', 'FCI', '基组', '几何优化', '振动频率', 'basis set', 'coupled cluster', 'geometry', 'frequency', 'SCF']),
    D('qp-states', 'quantum/physics/index.html#d-states', '一维定态：能级与波函数', 'Stationary states in one dimension',
      '无限深势阱、谐振子等一维势里的能级和波函数。', 'Energy levels and wavefunctions in one-dimensional potentials such as the box and the harmonic oscillator.',
      ['定态', '能级', '本征态', '谐振子', '势阱', '薛定谔方程', 'stationary state', 'eigenstate', 'harmonic oscillator', 'potential well', 'Schrödinger']),
    D('qp-tunnel', 'quantum/physics/index.html#d-tunnel', '隧穿：透射率与波包', 'Tunnelling: transmission and a wave packet',
      '方势垒的透射率随能量变化，以及一个波包撞上势垒。', 'Transmission through a square barrier versus energy, and a wave packet hitting it.',
      ['隧穿', '波包', '透射率', '势垒', 'tunnelling', 'wave packet', 'transmission', 'barrier']),
    D('qp-sg', 'quantum/physics/index.html#d-sg', 'Stern–Gerlach 串联', 'Stern–Gerlach in series',
      '自旋 1/2 在不同方向上的连续测量与概率。', 'Successive measurements of a spin 1/2 along different axes and their probabilities.',
      ['自旋', '测量', '对易', 'Stern', 'Gerlach', 'spin', 'measurement', 'commutator', 'Pauli']),
    D('qp-bell', 'quantum/physics/index.html#d-bell', 'Bell 不等式：CHSH 实验', 'Bell’s inequality: a CHSH experiment',
      '纠缠光子对的关联随测量角度变化，CHSH 值能否超过 2。', 'Correlations of entangled photon pairs versus measurement angle, and whether CHSH exceeds 2.',
      ['Bell', '贝尔', 'CHSH', '纠缠', '关联', 'entanglement', 'correlation', 'Tsirelson']),
    D('qa-circuit', 'quantum/algorithms/index.html#demo-circuit', '量子线路模拟器', 'Quantum circuit simulator',
      '拖放量子门，看态矢量和测量概率怎么变（精确模拟）。', 'Place gates and watch the statevector and measurement probabilities (exact simulation).',
      ['线路', '电路', '态矢量', 'Deutsch', 'Jozsa', '量子傅里叶变换', 'QFT', 'circuit', 'statevector', 'gate', 'Fourier']),
    D('qa-grover', 'quantum/algorithms/index.html#demo-grover', 'Grover 搜索：成功率随迭代振荡', 'Grover search: success oscillates with iterations',
      '比特数和标记数改变时，最佳迭代次数与成功率。', 'How the best iteration count and success probability change with qubits and marked items.',
      ['Grover', '振幅放大', '迭代次数', '平方加速', 'amplitude amplification', 'quadratic speedup', 'iterations']),
    D('qa-qpe', 'quantum/algorithms/index.html#demo-qpe', '相位估计：读数的分布', 'Phase estimation: the distribution of readouts',
      '辅助比特数和相位决定读数分布的宽度与偏差。', 'How ancilla count and the phase shape the spread of readouts.',
      ['相位估计', 'QPE', '本征值', '基态能量', 'phase estimation', 'eigenvalue', 'ground-state energy']),
    D('qa-trotter', 'quantum/algorithms/index.html#demo-trotter', 'Trotter 误差：横场 Ising 链', 'Trotter error: a transverse-field Ising chain',
      '一阶与二阶 Trotter 分解的误差随步数下降的速度。', 'How first- and second-order Trotter errors fall with the number of steps.',
      ['Trotter', '哈密顿量模拟', '时间演化', 'Ising', 'Hamiltonian simulation', 'time evolution', 'product formula']),
    D('qa-vqe', 'quantum/algorithms/index.html#demo-vqe', '两比特 VQE：参数平移与测量噪声', 'Two-qubit VQE: parameter shifts and shot noise',
      '变分原理下的能量优化，以及有限测量次数带来的噪声。', 'Energy minimisation under the variational principle, with the noise of finite shots.',
      ['VQE', '变分', '参数平移', '测量噪声', 'variational', 'parameter shift', 'shot noise', 'ansatz']),
    D('qc-rabi', 'quantum/computing/index.html#demo-rabi', '驱动一个量子比特：Rabi 振荡与退相干', 'Driving a qubit: Rabi oscillations and decoherence',
      '驱动强度、失谐和 T₁、T₂ 怎样决定 Bloch 球上的轨迹。', 'How drive strength, detuning and T₁, T₂ shape the path on the Bloch sphere.',
      ['Rabi', 'Bloch', '退相干', 'T1', 'T2', '失谐', 'decoherence', 'detuning', 'qubit drive']),
    D('qc-budget', 'quantum/computing/index.html#demo-budget', '电路保真度预算：误差为什么会连乘', 'Circuit fidelity budget: why errors multiply',
      '门保真度和电路深度一起决定整条电路还剩多少保真度。', 'Gate fidelity and circuit depth together set what fidelity a whole circuit keeps.',
      ['保真度', '门误差', '电路深度', 'NISQ', 'fidelity', 'gate error', 'circuit depth', 'error budget']),
    D('qc-qec', 'quantum/computing/index.html#demo-qec', '量子纠错：码距、阈值与物理比特数', 'Quantum error correction: distance, threshold and qubit counts',
      '表面码的码距和物理错误率怎样决定逻辑错误率与所需比特数。', 'How surface-code distance and physical error rate set the logical error rate and qubit count.',
      ['纠错', '表面码', '阈值', '码距', '逻辑错误率', 'surface code', 'threshold', 'code distance', 'logical error', 'fault tolerance']),
    D('qb-enaqt', 'quantum/biology/index.html#demo-enaqt', 'FMO 复合物中的能量传递', 'Energy transfer in the FMO complex',
      '退相干强度改变能量送到反应中心的效率。', 'How dephasing strength changes how efficiently energy reaches the reaction centre.',
      ['FMO', '能量传递', '退相干', '光合作用', 'Lindblad', 'energy transfer', 'dephasing', 'photosynthesis', 'exciton']),
    D('qb-compass', 'quantum/biology/index.html#demo-compass', '自由基对罗盘', 'The radical-pair compass',
      '单重态产率随地磁场方向变化：候鸟磁感应的自由基对模型。', 'Singlet yield versus magnetic-field direction: the radical-pair model of bird magnetoreception.',
      ['自由基对', '磁感应', '单重态', '三重态', '超精细', '隐花色素', 'radical pair', 'magnetoreception', 'singlet', 'triplet', 'hyperfine', 'cryptochrome']),
    D('qb-kie', 'quantum/biology/index.html#demo-kie', '酶里的氢隧穿：同位素效应', 'Hydrogen tunnelling in enzymes: isotope effects',
      '动力学同位素效应和 Arrhenius 图怎样暴露隧穿。', 'How kinetic isotope effects and Arrhenius plots reveal tunnelling.',
      ['同位素效应', 'KIE', '氢隧穿', 'Arrhenius', '酶', '质子转移', 'isotope effect', 'hydrogen tunnelling', 'enzyme', 'proton transfer']),
    D('fs-grw', 'fundamental-science/index.html#demo-grw', '量子叠加与坍缩', 'Superposition and collapse',
      'GRW 自发坍缩模型里，叠加态随质量和时间怎样消失。', 'How superpositions disappear with mass and time in the GRW spontaneous-collapse model.',
      ['坍缩', '叠加', 'GRW', '测量问题', 'collapse', 'superposition', 'measurement problem']),
    D('fs-coherence', 'fundamental-science/index.html#demo-coherence', '分子量子相干', 'Molecular quantum coherence',
      '标准量子振荡和假设的附加退相干怎样区分。', 'Telling standard quantum oscillations apart from a hypothetical extra decoherence.',
      ['相干', '退相干', '干涉', '振荡', 'coherence', 'decoherence', 'interference', 'two-level']),
    D('fs-ci', 'fundamental-science/index.html#demo-ci', '圆锥交叉与 Berry 相位', 'Conical intersections and the Berry phase',
      '绕圆锥交叉走一圈，波函数拾取 π 的几何相位。', 'Going once around a conical intersection, the wavefunction picks up a geometric phase of π.',
      ['圆锥交叉', 'Berry', '几何相位', '非绝热', 'Born–Oppenheimer', 'conical intersection', 'geometric phase', 'nonadiabatic']),
    D('pr-map', 'physics-realms/index.html#pr-map', '物理疆界图', 'Map of physical theories',
      '理论与问题的关系网：哪个理论解释什么、在哪里失效、谁在什么极限下退化成谁。', 'A network of theories and problems: what each explains, where it fails, and which limits connect them.',
      ['理论', '适用范围', '极限', '经典极限', '有效理论', 'theory', 'limit', 'classical limit', 'effective theory', 'regime']),
    D('pr-cube', 'physics-realms/index.html#pr-cube', 'ħ-c-G 立方体', 'The ħ-c-G cube',
      '按 ħ、c、G 是否“打开”给物理理论分区。', 'Physical theories sorted by whether ħ, c and G are switched on.',
      ['立方体', '普朗克', '相对论', '量子引力', 'cube', 'Planck', 'relativity', 'quantum gravity']),
  ];
  for (const d of DEMOS) Object.defineProperty(d, 'href', { get() { return link(this.path); }, enumerable: true });
  const DEMO = Object.fromEntries(DEMOS.map((d) => [d.id, d]));

  // ── 改写：每个来源的数据 → 章节 ───────────────────────────────────────
  // 每章 { id, name:{zh,en}, blurb:{zh,en}, path, href, demos:[白名单 id], text(lang) }，text 是纯文本，按标题分段
  const writer = (lang) => {
    const out = [];
    const L = (zh, en) => (lang === 'en' ? en : zh);
    return {
      L,
      C: L('：', ': '),
      line(s) { const v = clean(s); if (v) out.push(v); },
      head(zh, en, items) {
        const list = (items || []).map((x) => clean(x)).filter(Boolean);
        if (!list.length) return;
        out.push('', `## ${L(zh, en)}`);
        for (const x of list) out.push(`- ${x}`);
      },
      done() { return out.join('\n').replace(/\n{3,}/g, '\n\n').trim(); },
    };
  };
  const latex = (math, key) => { const m = math && math[key]; return Array.isArray(m) ? m[0] : typeof m === 'string' ? m : ''; };
  const chapter = (src, id, name, blurb, demos, build) => ({
    id, name, blurb, demos: (demos || []).filter((d) => DEMO[d]),
    path: `${src.page}#${src.anchor}${id}`,
    get href() { return link(this.path); },
    text(lang) { const w = writer(lang === 'en' ? 'en' : 'zh'); build(w, lang === 'en' ? 'en' : 'zh'); return w.done(); },
  });

  const QP_DEMO = { d1: 'qp-states', d2: 'qp-tunnel', d3: 'qp-sg', d4: 'qp-bell' };
  const QA_DEMO = { circuit: 'qa-circuit', grover: 'qa-grover', qpe: 'qa-qpe', trotter: 'qa-trotter', vqe: 'qa-vqe' };
  const FM_DEMO = { na: ['qchem-lab'], var: ['qp-states', 'qa-vqe'], dg: ['fs-ci'] };
  const QC_DEMO = { qubit: ['qc-rabi', 'play-circuit'], sc: ['qc-rabi'], noise: ['qc-rabi', 'qc-budget'], qec: ['qc-qec', 'play-qec'], advantage: ['qc-budget'] };
  const QB_DEMO = { photo: ['qb-enaqt', 'play-enaqt'], compass: ['qb-compass'], tunnel: ['qb-kie', 'play-tunnel'], dna: ['qb-kie'] };
  const FS_DEMO = { qm: ['fs-grw'], qchem: ['qchem-lab'], geom: ['fs-ci'], beyond: ['fs-grw', 'fs-coherence'], tests: ['fs-coherence'] };

  // 量子物理、数学基础：讲解、大纲、公式、在化学里、误区、自测、练习
  const lecture = (src, D, list, chemKey, demosOf) => list.map((c) => chapter(src, c.id, c.name, c.tagline, demosOf(c),
    (w, lang) => {
      w.line(`# ${pick(c.name, lang)}`);
      w.line(pick(c.tagline, lang));
      w.head('讲解', 'Explanation', (c.explain || []).map((t) => pick(t, lang)));
      w.head('大纲', 'Outline', (c.outline || []).map((o) => (Array.isArray(o) ? `${pick(o[0], lang)}${o[1] ? w.L(`（第 ${o[1]} 周）`, ` (week ${o[1]})`) : ''}` : pick(o, lang))));
      w.head('关键公式（LaTeX 原文）', 'Key formulas (LaTeX source)', (c.formulas || []).map((k) => latex(D.math, k)));
      w.head(chemKey === 'inQC' ? '在量子化学里' : '在化学里', chemKey === 'inQC' ? 'In quantum chemistry' : 'In chemistry', (c[chemKey] || []).map((t) => pick(t, lang)));
      w.head('常见误区', 'Common pitfalls', (c.pitfalls || []).map((t) => pick(t, lang)));
      w.head('过关自测', 'Self-checks', (c.checks || []).map((t) => pick(t, lang)));
      if (c.practice) w.head('动手练习', 'Hands-on exercise', [`${pick(c.practice.title, lang)}${w.C}${pick(c.practice.body, lang)}`]);
    }));

  // 量子计算机、量子生物学、基础科学：导言、公式（带说明）、要点（带研究状态）、问答、证据账本
  const topical = (src, D, demoMap) => (D.sections || []).map((s) => chapter(src, s.id, s.title, s.intro, demoMap[s.id], (w, lang) => {
    const st = (k) => { const v = D.status && D.status[k] ? pick(D.status[k], lang) : k || ''; return v ? w.L(`（${v}）`, ` (${v})`) : ''; };
    w.line(`# ${pick(s.title, lang)}`);
    w.line(pick(s.intro, lang));
    w.head('公式', 'Formulas', (s.formulas || []).map((f) => (Array.isArray(f) ? `${pick(f[1], lang)}${latex(D.math, f[0]) ? ` [${latex(D.math, f[0])}]` : ''}` : latex(D.math, f))));
    w.head('要点', 'Key points', (s.topics || []).map((t) => (Array.isArray(t) ? `${pick(t[1], lang)}${st(t[0])}${w.C}${pick(t[2], lang)}` : pick(t, lang))));
    w.head('常见问题', 'Questions', (s.questions || []).map((q) => (Array.isArray(q) ? `${w.L('问', 'Q')}${w.C}${pick(q[0], lang)} ${w.L('答', 'A')}${w.C}${pick(q[1], lang)}` : pick(q, lang))));
    w.head('证据账本', 'Evidence ledger', (D.ledger || []).filter((l) => l.section === s.id).map((l) => `${pick(l.claim, lang)}${st(l.status)}${w.C}${pick(l.evidence, lang)} ${w.L('保留意见', 'Caveat')}${w.C}${pick(l.caveat, lang)}`));
    w.head('硬件路线', 'Hardware platforms', (D.platforms || []).filter((p) => p.section === s.id).map((p) => `${pick(p.name, lang)}${st(p.status)}${w.C}${pick(p.plus, lang)} ${pick(p.minus, lang)}`));
  }));

  const ADAPT = {
    qp: (src, D) => lecture(src, D, D.chapters || [], 'inChem', (c) => (c.demos || []).map((d) => QP_DEMO[d])),
    fm: (src, D) => lecture(src, D, D.subjects || [], 'inQC', (c) => FM_DEMO[c.id] || []),
    qa: (src, D) => (D.algos || []).map((a) => chapter(src, a.id, a.name, a.tagline, a.demo ? [QA_DEMO[a.demo.id]] : [], (w, lang) => {
      const ev = D.evidence && D.evidence[a.evidence];
      w.line(`# ${pick(a.name, lang)}`);
      w.line(pick(a.tagline, lang));
      w.head('概况', 'At a glance', [
        a.problem && `${w.L('问题', 'Problem')}${w.C}${pick(a.problem, lang)}`,
        a.qcost && `${w.L('量子代价', 'Quantum cost')}${w.C}${pick(a.qcost, lang)}`,
        a.ccost && `${w.L('经典代价', 'Classical cost')}${w.C}${pick(a.ccost, lang)}`,
        a.speedup && `${w.L('加速', 'Speed-up')}${w.C}${pick(a.speedup, lang)}`,
        ev && `${w.L('证据等级', 'Evidence level')}${w.C}${pick(ev, lang)}${ev.long ? ` — ${pick(ev.long, lang)}` : ''}`,
      ]);
      w.head('讲解', 'Explanation', (a.explain || []).map((t) => pick(t, lang)));
      w.head('关键公式（LaTeX 原文）', 'Key formulas (LaTeX source)', (a.formulas || []).map((k) => latex(D.math, k)));
      w.head('在化学里', 'In chemistry', (a.inChem || []).map((t) => pick(t, lang)));
      w.head('常见误区', 'Common pitfalls', (a.pitfalls || []).map((t) => pick(t, lang)));
      w.head('过关自测', 'Self-checks', (a.checks || []).map((t) => pick(t, lang)));
    })),
    qc: (src, D) => topical(src, D, QC_DEMO),
    qb: (src, D) => topical(src, D, QB_DEMO),
    fs: (src, D) => topical(src, D, FS_DEMO),
  };

  // ── 对外接口 ──────────────────────────────────────────────────────────
  const loading = {};
  // 报错带两种语言（zh / en）和 code，由页面按语言挑；message 是中文
  const fail = (code, zh, en) => Object.assign(new Error(zh), { code, zh, en });
  function load(sourceId) {
    const src = SRC[sourceId];
    if (!src) return Promise.reject(fail('unknown-source', `未知的内容来源：${sourceId}`, `Unknown content source: ${sourceId}`));
    if (root[src.global]) return Promise.resolve(root[src.global]);
    if (loading[sourceId]) return loading[sourceId];
    loading[sourceId] = new Promise((resolve, reject) => {
      if (!doc || !doc.createElement) { reject(fail('no-document', '无法加载站内内容', 'Site content cannot be loaded here')); return; }
      const el = doc.createElement('script');
      el.src = link(src.script);
      el.async = true;
      el.onload = () => (root[src.global] ? resolve(root[src.global]) : reject(fail('load-failed', `站内内容没有加载成功：${pick(src.label, 'zh')}`, `The site content did not load: ${pick(src.label, 'en')}`)));
      el.onerror = () => reject(fail('load-failed', `站内内容加载失败：${pick(src.label, 'zh')}`, `Could not load the site content: ${pick(src.label, 'en')} (check the connection and try again)`));
      (doc.head || doc.documentElement || doc.body).appendChild(el);
    }).catch((e) => { delete loading[sourceId]; throw e; });
    return loading[sourceId];
  }

  const cache = new Map();
  function chapters(sourceId, data) {
    const src = SRC[sourceId];
    const D = data || (src && root[src.global]);
    if (!src || !D) return [];
    if (cache.has(D) && cache.get(D).src === sourceId) return cache.get(D).list;
    const list = ADAPT[sourceId](src, D).filter((c) => c.id && c.name);
    cache.set(D, { src: sourceId, list });
    return list;
  }

  // 'qp:birth' → { source:'qp', chapter:'birth' }，不认识的返回 null
  function parseRef(ref) {
    const m = /^([a-z]{2}):([A-Za-z0-9_-]{1,40})$/.exec(String(ref || '').trim());
    return m && SRC[m[1]] ? { source: m[1], chapter: m[2] } : null;
  }

  // 按来源和 id 找一章（需要时先加载数据文件）
  async function find(sourceId, chapterId) {
    const D = await load(sourceId);
    return chapters(sourceId, D).find((c) => c.id === chapterId) || null;
  }

  // 按关键词给演示打分，挑出和一段文字最相关的 k 个（给提示词用，免得把整张白名单都塞进去）
  function matchDemos(text, k = 6, prefer = []) {
    const s = String(text || '').toLowerCase();
    const scored = DEMOS.map((d, i) => {
      let score = prefer.includes(d.id) ? 10 : 0;
      for (const kw of d.keywords) if (kw && s.includes(kw.toLowerCase())) score += kw.length >= 4 ? 2 : 1;
      return { d, score, i };
    }).filter((x) => x.score > 0);
    scored.sort((a, b) => b.score - a.score || a.i - b.i);
    return scored.slice(0, Math.max(0, k)).map((x) => x.d);
  }

  // 给提示词的演示清单：每行 “id: 名称 — 一句话”
  function demoCatalog(lang, list) {
    return (list || DEMOS).map((d) => `${d.id}: ${pick(d.label, lang)} — ${pick(d.desc, lang)}`).join('\n');
  }

  const API = {
    sources: SOURCES,
    demos: DEMOS,
    load,
    chapters,
    find,
    parseRef,
    demo: (id) => (Object.prototype.hasOwnProperty.call(DEMO, id) ? DEMO[id] : null),
    isDemo: (id) => Object.prototype.hasOwnProperty.call(DEMO, id),
    matchDemos,
    demoCatalog,
    link,
  };
  root.MOLASTRIA_LEARN_SOURCES = API;
  if (typeof module === 'object' && module.exports) module.exports = API;
})(typeof window !== 'undefined' ? window : globalThis);
