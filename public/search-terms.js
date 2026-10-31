/* 搜索用的中英术语表：目录里中文和英文条目混在一起，搜“电解液”也应该找到 electrolyte。
   统一搜索（app.js）和 AI 助手的目录检索（ai/ai.js）共用。每组里的词互为同义；要加词直接加在这里。
   Public API: MolAstriaTerms.{tokens(), matchesToken(), groupsIn(), has()} */
(() => {
  'use strict';
  const GROUPS = [
    // 方法
    ['密度泛函', 'dft', 'density functional'],
    ['含时密度泛函', 'td-dft', 'tddft', 'time-dependent density functional'],
    ['从头算', 'ab initio'],
    ['第一性原理', 'first-principles', 'first principles'],
    ['量子化学', 'quantum chemistry', 'quantum chemical', 'quantum-chemical'],
    ['耦合簇', 'coupled cluster', 'coupled-cluster', 'ccsd'],
    ['多参考', 'multireference', 'multi-reference', 'casscf', 'caspt2', 'nevpt2'],
    ['半经验', 'semiempirical', 'semi-empirical', 'xtb'],
    ['分子动力学', 'molecular dynamics', 'md simulation', 'aimd'],
    ['蒙特卡洛', '蒙特卡罗', 'monte carlo'],
    ['增强采样', 'enhanced sampling', 'metadynamics', '元动力学'],
    ['自由能', 'free energy', 'free-energy'],
    ['力场', 'force field', 'force-field'],
    ['粗粒化', 'coarse-grained', 'coarse grained'],
    ['qm/mm', '量子力学/分子力学'],
    ['机器学习', 'machine learning', 'machine-learning', 'deep learning', '深度学习', 'neural network', '神经网络'],
    ['机器学习势', 'machine learning potential', 'machine-learning potential', 'interatomic potential', 'mlip', '势函数'],
    ['大语言模型', '大模型', 'large language model', 'llm'],
    ['基组', 'basis set'],
    ['泛函', 'exchange-correlation functional', 'hybrid functional'],
    ['色散校正', 'dispersion correction', 'd3', 'd4'],
    ['溶剂化', '溶剂效应', 'solvation', 'implicit solvent', 'continuum solvent'],
    ['分子对接', '对接', 'docking'],
    ['虚拟筛选', 'virtual screening', 'high-throughput screening', '高通量筛选'],
    // 性质与分析
    ['过渡态', 'transition state', 'irc', '反应路径', 'reaction path'],
    ['反应机理', '反应机制', 'reaction mechanism'],
    ['势能面', 'potential energy surface', 'pes'],
    ['激发态', 'excited state', 'excited-state'],
    ['电子结构', 'electronic structure'],
    ['能带', 'band structure', 'band gap', '带隙'],
    ['静电势', 'electrostatic potential', 'esp'],
    ['原子电荷', '电荷布居', 'atomic charge', 'partial charge', 'population analysis'],
    ['电荷转移', 'charge transfer'],
    ['弱相互作用', '非共价相互作用', 'non-covalent', 'noncovalent', 'nci'],
    ['氢键', 'hydrogen bond'],
    ['振动', '频率分析', 'vibrational', 'frequency analysis'],
    ['光谱', '谱图', 'spectroscopy', 'spectra'],
    ['红外', 'infrared'],
    ['拉曼', 'raman'],
    ['核磁', 'nmr', 'chemical shift', '化学位移'],
    ['紫外可见', 'uv-vis', 'uv/vis'],
    ['电离能', 'ionization potential', 'ionization energy'],
    ['电子亲和能', 'electron affinity'],
    ['氧化还原', 'redox'],
    ['电极电位', '还原电位', 'electrode potential', 'redox potential', 'reduction potential'],
    ['热力学', 'thermodynamic'],
    ['动力学常数', '反应速率', 'rate constant', 'kinetics'],
    ['构象', 'conformer', 'conformation'],
    ['吸附', 'adsorption'],
    ['表面', 'surface'],
    // 体系与方向
    ['电解液', '电解质', 'electrolyte'],
    ['锂电池', '锂电', '锂离子', 'lithium', 'li-ion', 'battery', 'batteries', '电池'],
    ['电化学', 'electrochemical', 'electrochemistry'],
    ['电催化', 'electrocatalysis', 'electrocatalyst'],
    ['催化', 'catalysis', 'catalyst', 'catalytic'],
    ['光催化', 'photocatalysis', 'photocatalyst'],
    ['光化学', 'photochemistry', 'photochemical'],
    ['有机合成', 'organic synthesis'],
    ['溶剂', 'solvent'],
    ['聚合物', '高分子', 'polymer'],
    ['金属有机框架', 'mof', 'metal-organic framework'],
    ['纳米', 'nano'],
    ['二维材料', '2d material', 'two-dimensional material'],
    ['晶体', 'crystal', 'crystallographic'],
    ['材料', 'materials'],
    ['蛋白质', '蛋白', 'protein'],
    ['酶', 'enzyme'],
    ['药物', 'drug'],
    ['小分子', 'small molecule'],
    ['碳环', 'cyclo[18]carbon', 'cyclocarbon'],
    ['金属配合物', '配合物', 'metal complex', 'coordination complex'],
    // 工作和资源
    ['教程', '入门', 'tutorial', 'guide'],
    ['安装', '编译', 'install', 'installation', 'compile'],
    ['报错', '错误', 'error', 'troubleshooting'],
    ['开源', 'open source', 'open-source', 'github'],
    ['数据库', 'database'],
    ['数据集', 'dataset'],
    ['软件', 'software'],
    ['可视化', 'visualization', 'visualisation'],
    ['综述', 'review'],
    ['预印本', 'preprint'],
    ['招聘', '职位', 'job', 'postdoc', '博士后'],
    ['会议', 'conference'],
    ['超算', '集群', 'hpc', 'high-performance computing'],
    ['智能体', 'ai agent', 'ai agents']
  ].map((g) => g.map((t) => t.toLowerCase()));

  const byTerm = new Map();
  for (const g of GROUPS) for (const t of g) if (!byTerm.has(t)) byTerm.set(t, g);
  const phrases = [...byTerm.keys()].filter((t) => /\s/.test(t)).sort((a, b) => b.length - a.length);

  // Short Latin terms need word boundaries: "md" must not match "cmd", or "esp" match "especially".
  const boundary = new Map();
  function has(text, term) {
    if (!/^[a-z0-9]{1,4}$/.test(term)) return text.includes(term);
    if (!boundary.has(term)) boundary.set(term, new RegExp(`(^|[^a-z0-9])${term}($|[^a-z0-9])`));
    return boundary.get(term).test(text);
  }
  /** Splits a query on spaces, keeping known phrases such as "molecular dynamics" whole. */
  function tokens(query) {
    let rest = String(query || '').toLowerCase();
    const out = [];
    for (const p of phrases) if (rest.includes(p)) { out.push(p); rest = rest.split(p).join(' '); }
    return [...out, ...rest.split(/\s+/).filter(Boolean)];
  }
  /** True when the text contains this token or, for a known term, any of its synonyms. */
  function matchesToken(text, token) {
    if (text.includes(token)) return true;
    const g = byTerm.get(token);
    return !!g && g.some((t) => t !== token && has(text, t));
  }
  /** The term groups mentioned anywhere in a query, for natural questions like “锂电池电解液用什么溶剂”. */
  function groupsIn(query) {
    const q = String(query || '').toLowerCase();
    return GROUPS.filter((g) => g.some((t) => has(q, t)));
  }
  window.MolAstriaTerms = { tokens, matchesToken, groupsIn, has };
})();
