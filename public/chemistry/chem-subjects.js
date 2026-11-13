/* 化学学科馆：十五个展馆的名单。总入口页（index.html）和每个展馆页都读它：卡片、展馆之间的切换、学科关系图。
   每个展馆自己的内容在 <id>/data.js（讲解、公式、例题、时间线、自测、文献），演示在 <id>/demos.js，演示的数学在 chem-models.js。
   chapters / demos / refs 三个数字由 tools/chemistry-test.mjs 核对，和各展馆的 data.js 对不上就报错。
   文字自带中英两版（[中文, 英文]），页面标 translate="no"，不走 i18n.js 的词典。 */
(() => {
  'use strict';
  window.MOLASTRIA_CHEM_SUBJECTS = {
    groups: [
      { id: 'core', title: ['四大基础化学', 'The four core branches'], text: ['大学化学系的四门主干课：物质有哪些、怎样变化、为什么这样变、怎样测出来。', 'The four backbone courses of a chemistry degree: what substances there are, how they change, why, and how we measure them.'] },
      { id: 'theory', title: ['结构、计算与电子', 'Structure, computation and electrons'], text: ['把化学还原到原子、电子和对称性：结构怎样测定、能量怎样计算、电子怎样在金属和电极之间转移。', 'Chemistry reduced to atoms, electrons and symmetry: how structures are determined, energies computed, and electrons moved between metals and electrodes.'] },
      { id: 'matter', title: ['大分子、生命与材料', 'Macromolecules, life and materials'], text: ['从长链分子、生物分子到功能材料和药物：化学怎样造出有用的东西。', 'From long-chain molecules and biomolecules to functional materials and medicines: how chemistry makes useful things.'] },
      { id: 'world', title: ['环境、原子核与工程', 'Environment, nucleus and industry'], text: ['化学在地球系统、原子核尺度和工厂尺度上的样子。', 'Chemistry at the scale of the Earth system, of the nucleus, and of the plant.'] },
    ],
    // [id, 编号, 组, 中文名, 英文名, 一句话（中、英）, 章数, 演示数, 文献数, 相关展馆]
    subjects: [
      ['inorganic', '01', 'core', '无机化学', 'Inorganic Chemistry', ['周期律、化学键、酸碱与氧化还原、离子晶体和元素化学', 'Periodicity, bonding, acids and redox, ionic solids and the chemistry of the elements'], 8, 3, 18, ['coordination', 'structural', 'materials', 'nuclear']],
      ['organic', '02', 'core', '有机化学', 'Organic Chemistry', ['结构与立体化学、反应机理、羰基与芳香化学、周环反应和现代合成', 'Structure and stereochemistry, mechanisms, carbonyl and aromatic chemistry, pericyclic reactions and modern synthesis'], 8, 4, 23, ['medicinal', 'polymer', 'computational', 'biochem']],
      ['physical', '03', 'core', '物理化学', 'Physical Chemistry', ['气体、热力学、平衡、溶液、动力学、统计热力学和表面', 'Gases, thermodynamics, equilibria, solutions, kinetics, statistical thermodynamics and surfaces'], 8, 4, 16, ['computational', 'electrochem', 'chemeng', 'structural']],
      ['analytical', '04', 'core', '分析化学', 'Analytical Chemistry', ['误差与统计、滴定、络合与沉淀、校准、色谱和化学计量学', 'Errors and statistics, titrations, complexation and precipitation, calibration, chromatography and chemometrics'], 8, 4, 16, ['electrochem', 'environmental', 'physical', 'biochem']],
      ['structural', '05', 'theory', '结构化学', 'Structural Chemistry', ['原子与分子轨道、分子对称性、晶体学、衍射和结构测定', 'Atomic and molecular orbitals, molecular symmetry, crystallography, diffraction and structure determination'], 7, 4, 15, ['inorganic', 'computational', 'materials', 'physical']],
      ['computational', '06', 'theory', '量子与计算化学', 'Quantum & Computational Chemistry', ['Hartree–Fock、电子相关、密度泛函、分子动力学和机器学习势', 'Hartree–Fock, electron correlation, density functionals, molecular dynamics and machine-learned potentials'], 7, 3, 18, ['physical', 'structural', 'organic', 'materials']],
      ['coordination', '07', 'theory', '配位与金属有机化学', 'Coordination & Organometallic Chemistry', ['配体场、电子光谱与磁性、反应机理、18 电子规则和均相催化', 'Ligand fields, spectra and magnetism, mechanisms, the 18-electron rule and homogeneous catalysis'], 8, 3, 17, ['inorganic', 'organic', 'biochem', 'materials']],
      ['electrochem', '08', 'theory', '电化学', 'Electrochemistry', ['电极电势、电解质溶液、电极动力学、电分析、腐蚀、电池和电催化', 'Electrode potentials, electrolytes, electrode kinetics, electroanalysis, corrosion, batteries and electrocatalysis'], 8, 3, 16, ['physical', 'materials', 'analytical', 'chemeng']],
      ['polymer', '09', 'matter', '高分子化学', 'Polymer Chemistry', ['分子量分布、逐步与链式聚合、可控聚合、共聚、链构象和聚合物物理', 'Molar-mass distributions, step and chain growth, controlled polymerisation, copolymers, chain conformation and polymer physics'], 8, 4, 16, ['organic', 'materials', 'chemeng', 'biochem']],
      ['biochem', '10', 'matter', '生物化学', 'Biochemistry', ['蛋白质结构与折叠、酶动力学、协同结合、生物能学、核酸和化学生物学', 'Protein structure and folding, enzyme kinetics, cooperative binding, bioenergetics, nucleic acids and chemical biology'], 8, 4, 17, ['medicinal', 'organic', 'polymer', 'coordination']],
      ['materials', '11', 'matter', '材料化学', 'Materials Chemistry', ['晶体缺陷、能带、半导体、合成方法、纳米材料、多孔材料和能源材料', 'Defects, bands, semiconductors, synthesis, nanomaterials, porous frameworks and energy materials'], 8, 3, 16, ['inorganic', 'structural', 'electrochem', 'polymer']],
      ['medicinal', '12', 'matter', '药物化学', 'Medicinal Chemistry', ['药物发现流程、结合与构效关系、类药性、药代动力学和新的药物形式', 'The discovery pipeline, binding and structure–activity relationships, drug-likeness, pharmacokinetics and new modalities'], 8, 3, 15, ['organic', 'biochem', 'computational', 'analytical']],
      ['environmental', '13', 'world', '环境化学', 'Environmental Chemistry', ['臭氧层、对流层污染、温室效应、水的碳酸盐体系、污染物归趋和绿色化学', 'The ozone layer, tropospheric pollution, the greenhouse effect, the carbonate system, fate of pollutants and green chemistry'], 8, 4, 16, ['analytical', 'physical', 'chemeng', 'nuclear']],
      ['nuclear', '14', 'world', '核化学与放射化学', 'Nuclear & Radiochemistry', ['结合能、衰变与衰变链、核反应、燃料循环、同位素应用和超重元素', 'Binding energy, decay and decay chains, nuclear reactions, the fuel cycle, isotope applications and superheavy elements'], 8, 3, 16, ['inorganic', 'physical', 'environmental', 'medicinal']],
      ['chemeng', '15', 'world', '化学工程', 'Chemical Engineering', ['物料与能量衡算、传递、反应器、分离、相平衡、过程控制与安全', 'Mass and energy balances, transport, reactors, separations, phase equilibria, control and safety'], 8, 3, 13, ['physical', 'polymer', 'environmental', 'electrochem']],
    ],
    levels: {
      core: [['基础', 'Foundation'], ['本科主干课程里的内容，教材之间说法一致。', 'Taught in every undergraduate course; textbooks agree.']],
      adv: [['进阶', 'Advanced'], ['研究生课程或专门方向的内容，需要前面几章作基础。', 'Graduate-level or specialist material that builds on the earlier chapters.']],
      frontier: [['前沿', 'Frontier'], ['近十几年的研究方向，进展快，结论还在更新。', 'Research directions of the last decade or so; moving fast, conclusions still changing.']],
    },
    // 演示的身份：解析或精确计算 / 用实测常数算 / 教学模型
    demoKinds: {
      exact: [['精确计算', 'Exact calculation'], ['在浏览器里精确求解模型方程（解析解或数值解到收敛）。', 'The model equations are solved exactly in the browser (closed form, or numerically to convergence).']],
      data: [['实测常数', 'Measured constants'], ['用文献或手册里的实测常数代入公式算出。', 'Measured constants from the literature or handbooks, put through the formulas.']],
      model: [['教学模型', 'Teaching model'], ['为说明一个道理而简化的模型，数值是示意的。', 'A model simplified to make one point; the numbers are illustrative.']],
    },
  };
})();
