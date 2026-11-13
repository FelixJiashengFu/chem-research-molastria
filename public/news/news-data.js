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
  };

  const refs = [
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
