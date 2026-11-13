'use strict';
// 谱图馆 · 磁共振与核谱学一族（核磁共振入口、电子顺磁共振、脉冲 EPR、穆斯堡尔谱、核四极共振）。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'nmr', fam: 'mag', core: true, abbr: 'NMR', name: T(`核磁共振波谱`, `Nuclear magnetic resonance spectroscopy`),
      one: T(`磁场里的原子核吸收射频波，共振频率随它周围的电子环境有百万分之几的差别。这些差别（化学位移）加上相邻核之间的耦合裂分，把分子里每一种氢、每一种碳是什么、和谁相邻都交代出来。它是有机结构鉴定里信息量最大的一张谱。本站有一个专门的核磁共振栏目，这里只放读谱要用的要点。`, `Nuclei in a magnetic field absorb radio waves at frequencies that differ by parts per million with their electronic surroundings. These differences (chemical shifts), together with the splitting caused by coupling between neighbouring nuclei, tell what every kind of hydrogen and carbon in a molecule is and what sits next to it. It is the most informative single spectrum in organic structure determination. This site has a whole zone on NMR; only the essentials for reading spectra are given here.`),
      how: [
        T(`自旋 ½ 的核（¹H、¹³C、¹⁵N、¹⁹F、³¹P）在磁场 B₀ 里有两个能级，间隔对应 Larmor 频率 ν = γB₀ / 2π：9.4 T 的磁场里 ¹H 是 400 MHz，¹³C 是 100.6 MHz。核外电子对磁场有屏蔽，不同化学环境里的核感受到的磁场略有不同。化学位移 δ = (ν − ν_参比) / ν_参比 × 10⁶，单位 ppm，以四甲基硅烷（TMS）为零点，和磁场强度无关。电负性原子、双键和芳环使质子去屏蔽，δ 变大。`, `Spin-½ nuclei (¹H, ¹³C, ¹⁵N, ¹⁹F, ³¹P) have two levels in a field B₀, separated by the Larmor frequency ν = γB₀ / 2π: in 9.4 T, 400 MHz for ¹H and 100.6 MHz for ¹³C. Electrons shield the nucleus, so nuclei in different chemical environments feel slightly different fields. The chemical shift δ = (ν − ν_ref) / ν_ref × 10⁶, in ppm from tetramethylsilane (TMS), is independent of field strength. Electronegative atoms, double bonds and aromatic rings deshield protons and raise δ.`),
        T(`相隔两三根键的核通过成键电子互相耦合（J 耦合，单位 Hz，不随磁场变）。一级近似下，n 个等价的相邻质子把峰裂成 n + 1 重，强度按二项式系数分布：乙基的 CH₃ 是三重峰（1:2:1），CH₂ 是四重峰（1:3:3:1）。¹H 谱的峰面积正比于质子数。¹³C 的天然丰度只有 1.1 %，常规谱对质子去耦，每种碳一条单线。`, `Nuclei two or three bonds apart couple through the bonding electrons (J coupling, in Hz, independent of field). To first order, n equivalent neighbouring protons split a signal into n + 1 lines with binomial intensities: in an ethyl group the CH₃ is a triplet (1:2:1) and the CH₂ a quartet (1:3:3:1). Areas in a ¹H spectrum are proportional to the number of protons. ¹³C is only 1.1 % abundant, and routine spectra are proton-decoupled, giving one line per kind of carbon.`),
        T(`二维谱把相关的核连起来：COSY 连接互相耦合的质子，HSQC 连接直接相连的 C–H，HMBC 连接相隔两三根键的 C 和 H，NOESY 连接空间上靠近（5 Å 以内）的质子。这四张谱加上一维的 ¹H 和 ¹³C，通常足以定出一个小分子的完整结构。`, `Two-dimensional spectra connect related nuclei: COSY links coupled protons, HSQC directly bonded C–H pairs, HMBC carbons and protons two or three bonds apart, and NOESY protons close in space (within 5 Å). These four, with one-dimensional ¹H and ¹³C spectra, usually suffice for the full structure of a small molecule.`),
      ],
      axes: T(`横轴是化学位移 δ（ppm），按惯例从右到左增大；纵轴是强度。`, `Chemical shift δ (ppm), increasing from right to left by convention, against intensity.`),
      tells: [
        T(`分子里有几种氢、几种碳，各有几个，各自连着什么。`, `How many kinds of hydrogen and carbon a molecule has, how many of each, and what each is attached to.`),
        T(`连接方式、相对构型、构象；混合物的组成和绝对含量（定量核磁共振，用内标）。`, `Connectivity, relative configuration and conformation; the composition and absolute content of mixtures (quantitative NMR, against an internal standard).`),
        T(`动力学过程（化学交换、分子运动）、分子间相互作用、蛋白质的三维结构。`, `Dynamic processes (chemical exchange, molecular motion), intermolecular interactions, three-dimensional structures of proteins.`),
      ],
      sample: T(`1–10 mg 样品溶在 0.6 mL 氘代溶剂里（CDCl₃、DMSO-d₆、D₂O），装在 5 mm 的样品管中。¹³C 谱需要更多样品或更长时间。`, `1–10 mg of sample in 0.6 mL of deuterated solvent (CDCl₃, DMSO-d₆, D₂O) in a 5 mm tube. ¹³C spectra need more sample or more time.`),
      nums: [
        [T(`¹H 的化学位移范围`, `¹H shift range`), T(`0–12 ppm`, `0–12 ppm`)],
        [T(`¹³C 的化学位移范围`, `¹³C shift range`), T(`0–220 ppm`, `0–220 ppm`)],
        [T(`邻位 ³J(H,H)`, `Vicinal ³J(H,H)`), T(`自由转动的烷基约 7 Hz；烯烃顺式 6–12，反式 12–18 Hz`, `About 7 Hz in freely rotating alkyl groups; 6–12 cis and 12–18 Hz trans in alkenes`)],
        [T(`CDCl₃ 的残余溶剂峰`, `Residual solvent peaks of CDCl₃`), T(`¹H 7.26 ppm，¹³C 77.16 ppm（三重峰）`, `¹H 7.26 ppm, ¹³C 77.16 ppm (a triplet)`)],
      ],
      read: [
        T(`¹H 谱读四样东西：有几组峰（几种氢）、位置（什么环境）、积分（各有几个）、裂分（邻居有几个氢）。`, `Read four things from a ¹H spectrum: the number of signals (kinds of hydrogen), their positions (environment), integrals (how many) and splitting (how many neighbouring hydrogens).`),
        T(`先把溶剂峰、水峰和常见杂质（乙酸乙酯、二氯甲烷、硅脂）认出来划掉。`, `First recognise and cross out the solvent peak, water and common impurities (ethyl acetate, dichloromethane, silicone grease).`),
      ],
      traps: [
        T(`n + 1 规则只在化学位移差远大于耦合常数时成立；两组峰靠近时出现“屋顶效应”和更复杂的图样，换更高的磁场会变简单。`, `The n + 1 rule holds only when the shift difference greatly exceeds the coupling constant; close signals show roofing and more complex patterns, which simplify at higher field.`),
        T(`OH 和 NH 的位置随浓度、温度、溶剂变化，常常是宽峰，也常常不和邻位氢耦合（交换太快）；加一滴 D₂O 摇一摇，它们就消失。`, `OH and NH signals move with concentration, temperature and solvent, are often broad and often show no coupling to neighbours (exchange is too fast); a drop of D₂O makes them vanish.`),
      ],
      figs: [
        { gen: 'nmr1h', args: { mhz: 400, mols: [
          { name: T(`乙醇`, `ethanol`), groups: [{ shift: 1.25, n: 3, J: [[7.0, 2]], label: 'CH₃' }, { shift: 3.72, n: 2, J: [[7.0, 3]], label: 'CH₂' }, { shift: 1.32, n: 1, J: [], label: 'OH' }] },
          { name: T(`乙酸乙酯`, `ethyl acetate`), groups: [{ shift: 1.26, n: 3, J: [[7.0, 2]], label: 'CH₃' }, { shift: 2.05, n: 3, J: [], label: 'CH₃CO' }, { shift: 4.12, n: 2, J: [[7.0, 3]], label: 'OCH₂' }] },
          { name: T(`乙醚`, `diethyl ether`), groups: [{ shift: 1.21, n: 6, J: [[7.0, 2]], label: 'CH₃' }, { shift: 3.48, n: 4, J: [[7.0, 3]], label: 'OCH₂' }] },
          { name: T(`异丙醇`, `2-propanol`), groups: [{ shift: 1.22, n: 6, J: [[6.0, 1]], label: 'CH₃' }, { shift: 4.04, n: 1, J: [[6.0, 6]], label: 'CH' }] },
          { name: T(`丙酮`, `acetone`), groups: [{ shift: 2.17, n: 6, J: [], label: 'CH₃' }] }] },
          cap: T(`由文献的化学位移和耦合常数按一级近似算出（400 MHz，CDCl₃；数值取自 Gottlieb 等 1997 年的常见溶剂位移表）。线形是洛伦兹型，线宽 1 Hz，峰面积正比于质子数。实测谱还会有溶剂峰、¹³C 卫星峰和二级效应。`, `Calculated to first order from literature chemical shifts and coupling constants (400 MHz, CDCl₃; values from the table of common solvent shifts by Gottlieb et al., 1997). Lorentzian lines 1 Hz wide, areas proportional to the number of protons. A measured spectrum would also show solvent peaks, ¹³C satellites and second-order effects.`) },
      ],
      table: 'nmr-shifts', see: [['nmr/', T(`核磁共振栏目：十一个部分的讲解和五个交互演示`, `The NMR zone: eleven parts and five interactive demos`)], ['nmr/#lab', T(`自旋体系模拟器（精确对角化，不限于一级近似）`, `Spin-system simulator (exact diagonalisation, beyond first order)`)]],
      refs: ['gottlieb1997', 'pauli2014'],
    },
    {
      id: 'epr', fam: 'mag', core: true, abbr: 'EPR · ESR', name: T(`电子顺磁共振波谱`, `Electron paramagnetic resonance spectroscopy`),
      one: T(`和核磁共振是同一个原理，只是翻转的是未成对电子的自旋。电子的磁矩比质子大 658 倍，所以用的是微波而不是射频。它只对有未成对电子的物种有信号：自由基、过渡金属离子、缺陷、三重态。这既是限制也是优点：复杂体系里只有这些物种“发光”。`, `The same principle as NMR, except that the spins flipped belong to unpaired electrons. The electron magnetic moment is 658 times that of the proton, so microwaves replace radio waves. Only species with unpaired electrons give a signal: radicals, transition-metal ions, defects, triplet states. This is both a limit and a strength: in a complex system only these species light up.`),
      how: [
        T(`共振条件 hν = g·μ_B·B。X 波段的谱仪把微波频率固定在约 9.5 GHz，扫描磁场，自由电子（g = 2.0023）在 339 mT 处共振。g 因子的作用相当于核磁共振里的化学位移：有机自由基的 g 很接近 2.0023，过渡金属离子因为轨道角动量的贡献可以偏离很多（Cu²⁺ 的 g∥ 约 2.2–2.4，高自旋 Fe³⁺ 在 g = 4.3 或 6 处出峰）。固体和冷冻溶液里 g 随分子取向变化，谱是所有取向叠加成的“粉末图样”。`, `The resonance condition is hν = g·μ_B·B. An X-band spectrometer fixes the microwave frequency near 9.5 GHz and sweeps the field; a free electron (g = 2.0023) resonates at 339 mT. The g factor plays the role of the chemical shift in NMR: organic radicals lie very close to 2.0023, while transition-metal ions deviate strongly through orbital angular momentum (g∥ about 2.2–2.4 for Cu²⁺; high-spin Fe³⁺ at g = 4.3 or 6). In solids and frozen solutions g depends on orientation, and the spectrum is a powder pattern summed over all orientations.`),
        T(`未成对电子和附近的磁性核耦合，叫超精细耦合。一个自旋为 I 的核把谱线裂成 2I + 1 条等高的线；n 个等价的 I = ½ 核给出 n + 1 条线，强度是二项式系数。甲基自由基是 1:3:3:1 的四重峰（a = 2.30 mT），苯自由基阴离子是 1:6:15:20:15:6:1 的七重峰（a = 0.375 mT），氮氧自由基被 ¹⁴N（I = 1）裂成等高的三重峰。超精细耦合常数正比于未成对电子在那个核上的自旋密度（McConnell 关系：a_H = Q·ρ，Q 约 −2.3 到 −2.8 mT），所以谱直接画出了单占轨道在分子上的分布。`, `The unpaired electron couples to nearby magnetic nuclei: the hyperfine coupling. A nucleus of spin I splits the line into 2I + 1 lines of equal height; n equivalent spin-½ nuclei give n + 1 lines with binomial intensities. The methyl radical is a 1:3:3:1 quartet (a = 2.30 mT), the benzene radical anion a 1:6:15:20:15:6:1 septet (a = 0.375 mT), and a nitroxide is split by ¹⁴N (I = 1) into three equal lines. The hyperfine constant is proportional to the spin density at that nucleus (the McConnell relation a_H = Q·ρ, with Q about −2.3 to −2.8 mT), so the spectrum maps the singly occupied orbital over the molecule.`),
        T(`连续波谱仪为了提高信噪比，给磁场加一个 100 kHz 的小幅调制，用锁相放大器检测，所以记录下来的是吸收线的一阶导数。读谱时，导数过零点的位置是峰的中心，正负两个极值之间的距离是线宽。`, `To gain signal-to-noise, a continuous-wave spectrometer adds a small 100 kHz modulation to the field and detects with a lock-in amplifier, so what is recorded is the first derivative of the absorption. The zero crossing of the derivative marks the line centre, and the distance between its two extrema the linewidth.`),
      ],
      axes: T(`横轴是磁场（mT 或 G，1 mT = 10 G），纵轴是吸收的一阶导数。位置换算成 g 值报告。`, `Magnetic field (mT or G; 1 mT = 10 G) against the first derivative of the absorption. Positions are reported as g values.`),
      tells: [
        T(`有没有自由基或顺磁中心，是什么，有多少（和已知浓度的标准品比双重积分）。`, `Whether a radical or paramagnetic centre is present, what it is and how much (by double integration against a standard of known concentration).`),
        T(`短寿命自由基的种类（自旋捕获：DMPO 捕到羟基自由基后给出 1:2:2:1 的四重峰，a_N = a_H = 1.49 mT）。`, `The identity of short-lived radicals (spin trapping: DMPO after capturing a hydroxyl radical gives a 1:2:2:1 quartet with a_N = a_H = 1.49 mT).`),
        T(`金属酶和催化剂里金属的氧化态、自旋态和配位几何（Cu²⁺、Fe³⁺、Mn²⁺、Mo⁵⁺、V⁴⁺）。`, `Oxidation state, spin state and coordination geometry of metals in enzymes and catalysts (Cu²⁺, Fe³⁺, Mn²⁺, Mo⁵⁺, V⁴⁺).`),
        T(`材料里的缺陷（氧空位、色心、悬挂键）；自旋标记的生物分子的运动快慢；辐照剂量（丙氨酸剂量计）。`, `Defects in materials (oxygen vacancies, colour centres, dangling bonds); the mobility of spin-labelled biomolecules; radiation dose (alanine dosimetry).`),
      ],
      sample: T(`固体粉末或溶液装在外径 4 mm 的石英管里。水吸收微波很厉害，水溶液要用毛细管或扁平池。过渡金属离子通常要冷冻到 77 K 或 10 K（弛豫太快，室温下线太宽）。想看到尖锐的超精细结构，溶液要除氧并稀到 0.1 mmol/L 左右。`, `Powders or solutions in quartz tubes of 4 mm outer diameter. Water absorbs microwaves strongly, so aqueous solutions go into capillaries or flat cells. Transition-metal ions usually need freezing to 77 K or 10 K (relaxation is too fast and lines too broad at room temperature). For sharp hyperfine structure solutions are deoxygenated and diluted to about 0.1 mmol/L.`),
      nums: [
        [T(`X 波段`, `X band`), T(`约 9.5 GHz，g = 2 处 339 mT`, `About 9.5 GHz, 339 mT at g = 2`)],
        [T(`Q 波段和 W 波段`, `Q band and W band`), T(`34 GHz（1.21 T）和 94 GHz（3.35 T）`, `34 GHz (1.21 T) and 94 GHz (3.35 T)`)],
        [T(`灵敏度`, `Sensitivity`), T(`约 10¹⁰–10¹¹ 个自旋`, `About 10¹⁰–10¹¹ spins`)],
        [T(`g 值标样 DPPH`, `g standard DPPH`), T(`g = 2.0036`, `g = 2.0036`)],
        [T(`氢原子的超精细耦合`, `Hyperfine coupling of the hydrogen atom`), T(`50.7 mT（1420 MHz）`, `50.7 mT (1420 MHz)`)],
      ],
      read: [
        T(`数线的条数和强度比，推断耦合的核：三条等高是一个 ¹⁴N，四条 1:3:3:1 是三个等价的氢，六条等高是 Mn²⁺（⁵⁵Mn，I = 5/2）。`, `Count lines and their intensity ratios to infer the coupled nuclei: three equal lines mean one ¹⁴N, four lines 1:3:3:1 three equivalent hydrogens, six equal lines Mn²⁺ (⁵⁵Mn, I = 5/2).`),
        T(`量相邻线的间隔得到超精细耦合常数，量中心位置算 g：g = hν / μ_B·B = 71.4477 × ν(GHz) / B(mT)。`, `Measure the line spacing for the hyperfine constant and the centre for g: g = hν / μ_B·B = 71.4477 × ν(GHz) / B(mT).`),
        T(`几组不等价的核时从最外面的线往里拆：最外侧两条线的间隔是最小的那个耦合常数，整个谱的总宽度是所有 n·a 之和。`, `With several inequivalent sets, work inwards from the outermost lines: the spacing of the two outermost lines is the smallest coupling constant, and the total width of the spectrum is the sum of all n·a.`),
      ],
      traps: [
        T(`调制幅度大于线宽、微波功率太高（饱和），都会把线形弄宽、弄变形，超精细结构就看不见了。`, `A modulation amplitude larger than the linewidth, or too much microwave power (saturation), broadens and distorts the lines until hyperfine structure disappears.`),
        T(`没有信号不等于没有顺磁物种：整数自旋的离子（高自旋 Fe²⁺、Ni²⁺）零场分裂太大，X 波段常常“看不见”；两个自由基强耦合成单重态也没有信号。`, `No signal does not mean no paramagnetic species: integer-spin ions (high-spin Fe²⁺, Ni²⁺) have zero-field splittings too large for X band and are often silent, and two radicals strongly coupled into a singlet give nothing.`),
        T(`自旋捕获检测到 DMPO–OH 不一定说明体系里有羟基自由基：超氧加合物会分解成它，DMPO 也可能被直接氧化后再和水反应。要做清除剂对照实验。`, `Detecting DMPO–OH in spin trapping does not prove hydroxyl radicals were present: the superoxide adduct decays to it, and DMPO can be oxidised directly and then react with water. Scavenger controls are needed.`),
      ],
      figs: [
        { gen: 'epr', args: { ghz: 9.5, presets: [
          { name: T(`甲基自由基 •CH₃`, `methyl radical •CH₃`), g: 2.0026, lw: 0.08, sets: [[3, 0.5, 2.30]] },
          { name: T(`苯自由基阴离子`, `benzene radical anion`), g: 2.0028, lw: 0.03, sets: [[6, 0.5, 0.375]] },
          { name: T(`萘自由基阴离子`, `naphthalene radical anion`), g: 2.0027, lw: 0.012, sets: [[4, 0.5, 0.495], [4, 0.5, 0.183]] },
          { name: T(`对苯半醌自由基阴离子`, `p-benzosemiquinone radical anion`), g: 2.0047, lw: 0.015, sets: [[4, 0.5, 0.237]] },
          { name: T(`氮氧自由基 TEMPO`, `nitroxide TEMPO`), g: 2.006, lw: 0.12, sets: [[1, 1, 1.6]] },
          { name: T(`DMPO–OH 加合物`, `DMPO–OH adduct`), g: 2.0057, lw: 0.1, sets: [[1, 1, 1.49], [1, 0.5, 1.49]] },
          { name: T(`水溶液中的 Mn²⁺`, `Mn²⁺ in water`), g: 2.001, lw: 1.6, sets: [[1, 2.5, 9.5]] },
          { name: T(`氢原子`, `hydrogen atom`), g: 2.0023, lw: 0.1, sets: [[1, 0.5, 50.7]] }] },
          cap: T(`由文献的 g 值和超精细耦合常数算出（X 波段 9.5 GHz，溶液里各向同性的谱，一阶导数，一级近似）。可以切换成吸收线看导数和吸收的关系。萘自由基阴离子有两组各四个等价的氢（0.495 和 0.183 mT），5 × 5 = 25 条线。`, `Calculated from literature g values and hyperfine constants (X band, 9.5 GHz; isotropic solution spectra, first derivative, first order). Switch to the absorption to see how it relates to the derivative. The naphthalene radical anion has two sets of four equivalent hydrogens (0.495 and 0.183 mT), giving 5 × 5 = 25 lines.`) },
      ],
      see: [['#lab-epr', T(`动手实验室：自己搭超精细结构`, `Hands-on lab: build a hyperfine pattern`)]],
      refs: ['stoll2006'],
    },
    {
      id: 'pulseepr', fam: 'mag', abbr: 'DEER · ENDOR · ESEEM', name: T(`脉冲 EPR：DEER 与 ENDOR`, `Pulse EPR: DEER and ENDOR`),
      one: T(`用纳秒级的微波脉冲代替连续照射，像脉冲核磁共振那样操纵电子自旋。最有用的两个实验：DEER 测两个自旋标记之间 1.5–8 nm 的距离，这正是蛋白质构象变化的尺度；ENDOR 把连续波谱里分不开的小超精细耦合测出来。`, `Nanosecond microwave pulses replace continuous irradiation and manipulate electron spins as pulsed NMR does nuclear spins. The two most useful experiments are DEER, which measures distances of 1.5–8 nm between two spin labels (the scale of protein conformational change), and ENDOR, which resolves small hyperfine couplings buried in continuous-wave spectra.`),
      how: [
        T(`两个未成对电子之间有磁偶极相互作用，频率 ν_dd = 52.04 MHz / r³（r 用 nm）乘以取向因子 (1 − 3cos²θ)。2 nm 时是 6.5 MHz，5 nm 时只有 0.42 MHz，埋在线宽里看不见。四脉冲 DEER（也叫 PELDOR）用一个频率的脉冲在 A 自旋上做出回波，在另一个频率用一个 π 脉冲翻转 B 自旋：B 一翻，A 感受到的局部磁场变了，回波的强度就随翻转时刻按 cos(ω_dd·t) 振荡。记录回波强度随时间的变化，扣掉分子间的背景衰减，反演（Tikhonov 正则化或神经网络）就得到距离分布。`, `Two unpaired electrons interact through magnetic dipolar coupling at a frequency ν_dd = 52.04 MHz / r³ (r in nm) times the orientation factor (1 − 3cos²θ): 6.5 MHz at 2 nm, only 0.42 MHz at 5 nm, hidden within the linewidth. Four-pulse DEER (also called PELDOR) forms an echo on the A spins with pulses at one frequency and flips the B spins with a π pulse at another: flipping B changes the local field at A, and the echo intensity oscillates as cos(ω_dd·t) with the timing of the flip. The echo is recorded against that time, the intermolecular background decay is removed, and inversion (Tikhonov regularisation or neural networks) yields the distance distribution.`),
        T(`做法是在蛋白质选定的两个位点上各突变出一个半胱氨酸，接上氮氧自旋标记（MTSL）。得到的不是一个距离，而是一个分布：窄说明结构刚性，宽或双峰说明有多种构象。它不需要结晶，对分子量没有上限，在膜蛋白和大复合物上尤其有用。`, `In practice a cysteine is introduced at each of two chosen sites of a protein and tagged with a nitroxide spin label (MTSL). The result is a distribution, not one distance: narrow means a rigid structure, broad or bimodal several conformations. It needs no crystals and has no upper mass limit, which makes it especially useful for membrane proteins and large complexes.`),
        T(`ENDOR（电子–核双共振）：把磁场固定在 EPR 线上，同时扫描射频。射频扫到核的共振频率 ν = |ν_n ± A/2| 时，EPR 信号的强度发生变化。这样用 EPR 的灵敏度得到了 NMR 的分辨率：每种核在自己的 Larmor 频率 ν_n 附近出一对线，间隔就是超精细耦合 A，不同元素互不干扰。ESEEM 和它的二维版本 HYSCORE 从回波衰减上的调制里读出弱耦合的核（¹⁴N、²H）。`, `ENDOR (electron–nuclear double resonance): the field is fixed on an EPR line while a radio frequency is swept. When it reaches a nuclear resonance, ν = |ν_n ± A/2|, the EPR intensity changes. NMR resolution is thus obtained with EPR sensitivity: each kind of nucleus gives a pair of lines around its own Larmor frequency ν_n, separated by the hyperfine coupling A, with no interference between elements. ESEEM and its two-dimensional version HYSCORE read weakly coupled nuclei (¹⁴N, ²H) from modulations of the echo decay.`),
      ],
      axes: T(`DEER：横轴是偶极演化时间（μs），纵轴是归一化的回波强度；处理后是距离（nm）对概率密度。ENDOR：横轴是射频频率（MHz）。`, `DEER: dipolar evolution time (μs) against normalised echo intensity, and after processing distance (nm) against probability density. ENDOR: radio frequency (MHz).`),
      tells: [
        T(`蛋白质、核酸里两个位点之间的距离和它的分布；结合配体前后的构象变化；寡聚体里有几个亚基。`, `The distance, and its distribution, between two sites in a protein or nucleic acid; conformational change on ligand binding; the number of subunits in an oligomer.`),
        T(`金属中心周围有哪些核、离得多远（ENDOR、HYSCORE）：酶活性中心里底物的结合方式。`, `Which nuclei surround a metal centre and how far away they are (ENDOR, HYSCORE): how a substrate binds in an enzyme active site.`),
      ],
      sample: T(`20–100 μmol/L 的自旋标记样品 10–40 μL，加甘油做冷冻保护剂，在 50 K（氮氧自由基）下测，多用 Q 波段。用氘代的溶剂和蛋白质可以把相位记忆时间延长几倍，测到更远的距离。`, `10–40 μL of spin-labelled sample at 20–100 μmol/L with glycerol as cryoprotectant, measured at 50 K (for nitroxides), mostly at Q band. Deuterated solvent and protein lengthen the phase memory time several-fold and extend the accessible distance.`),
      nums: [
        [T(`偶极频率`, `Dipolar frequency`), T(`52.04 MHz / r³（r 用 nm，g = 2.0023）`, `52.04 MHz / r³ (r in nm, g = 2.0023)`)],
        [T(`可测的距离`, `Accessible distances`), T(`约 1.5–8 nm，全氘代样品可到 10 nm 以上`, `About 1.5–8 nm, beyond 10 nm in fully deuterated samples`)],
        [T(`0.35 T 下 ¹H 的 Larmor 频率`, `¹H Larmor frequency at 0.35 T`), T(`14.9 MHz`, `14.9 MHz`)],
      ],
      read: [
        T(`时间域曲线上能看到清楚的振荡，说明距离分布窄；只是单调衰减，说明分布宽，这时反演出来的分布形状不大可靠，只有平均距离和宽度可信。`, `Clear oscillations in the time trace indicate a narrow distribution; a mere monotonic decay indicates a broad one, in which case the shape of the inverted distribution is unreliable and only the mean and width can be trusted.`),
        T(`能测到的最远距离由记录的时间长度决定：要可靠地得到距离 r，偶极演化时间至少要覆盖一个半振荡周期。`, `The longest reliable distance is set by the length of the trace: at least one and a half oscillation periods of the dipolar evolution must be covered.`),
      ],
      traps: [
        T(`测到的是两个标记上未成对电子之间的距离，不是蛋白质主链之间的距离：MTSL 的侧链长约 0.7 nm 而且柔软，解释时要用旋转异构体库来模拟标记的位置。`, `The distance measured is between the unpaired electrons on the two labels, not between backbone atoms: the MTSL side chain is about 0.7 nm long and flexible, and interpretation requires modelling the label positions with rotamer libraries.`),
        T(`背景扣得不对，会在距离分布的长距离一端造出假峰。`, `A wrong background correction creates spurious peaks at the long-distance end of the distribution.`),
      ],
      figs: [
        { gen: 'deer', cap: T(`模型计算：一对自旋的四脉冲 DEER 时间域信号。拖动平均距离和分布宽度：距离越短振荡越快（频率 52.04 MHz / r³），分布越宽振荡衰减得越快。调制深度取 0.3，没有加背景衰减和噪声。`, `Model calculation: the four-pulse DEER time trace of a spin pair. Vary the mean distance and the width of the distribution: the shorter the distance the faster the oscillation (frequency 52.04 MHz / r³), and the broader the distribution the faster it damps. Modulation depth 0.3; no background decay or noise.`) },
      ],
      refs: ['pannier2000', 'jeschke2012', 'feher1956', 'stoll2006'],
    },
    {
      id: 'mossbauer', fam: 'mag', abbr: 'Mössbauer', name: T(`穆斯堡尔谱`, `Mössbauer spectroscopy`),
      one: T(`固体里的原子核可以无反冲地发射和吸收 γ 射线，谱线窄到能分辨出核能级被化学环境移动的十亿分之几电子伏。对铁来说，它是判断价态、自旋态和磁性最直接的方法，样品里所有的铁无论以什么形式存在都看得见。`, `Nuclei in a solid can emit and absorb γ-rays without recoil, giving lines narrow enough to resolve shifts of nuclear levels by a few billionths of an electronvolt caused by the chemical environment. For iron it is the most direct probe of oxidation state, spin state and magnetism, and it sees all the iron in a sample whatever its form.`),
      how: [
        T(`放射源 ⁵⁷Co 衰变到 ⁵⁷Fe 的激发态，放出 14.41 keV 的 γ 光子。自由的原子核发射时会反冲，光子能量就不够再被另一个核吸收；但嵌在晶格里的核有一定的概率把反冲动量交给整块晶体，光子的能量丝毫不损失（Mössbauer，1958）。这条线的自然宽度只有 4.7 neV。为了扫描能量，让放射源相对样品以每秒几毫米的速度来回运动，用多普勒效应微调光子能量：1 mm/s 相当于 48.08 neV。`, `The source, ⁵⁷Co, decays to an excited state of ⁵⁷Fe that emits a 14.41 keV γ photon. A free nucleus recoils on emission, leaving the photon too little energy to be absorbed by another nucleus; but a nucleus held in a lattice has a certain probability of passing the recoil momentum to the whole crystal, so that the photon loses no energy at all (Mössbauer, 1958). The natural width of the line is only 4.7 neV. To scan energy the source is moved back and forth relative to the sample at a few millimetres per second, tuning the photon energy by the Doppler effect: 1 mm/s corresponds to 48.08 neV.`),
        T(`谱上读三个参数。同质异能位移 δ：原子核处 s 电子密度的量度，高自旋 Fe²⁺ 约 0.9–1.3 mm/s，高自旋 Fe³⁺ 约 0.3–0.5 mm/s（相对室温 α-Fe），直接区分价态。四极分裂 ΔE_Q：核周围电荷分布偏离立方对称时，谱线裂成双线；高自旋 Fe²⁺ 的第六个 d 电子使它特别大（1.5–3.5 mm/s），高自旋 Fe³⁺ 的 d⁵ 是球对称的，分裂小（0–1 mm/s）。磁超精细分裂：核处有磁场时裂成六线；α-Fe 室温下的内场是 33.0 T，最外面两条线相距 10.62 mm/s，这也是速度标定的标准。`, `Three parameters are read from a spectrum. The isomer shift δ measures the s-electron density at the nucleus: about 0.9–1.3 mm/s for high-spin Fe²⁺ and 0.3–0.5 mm/s for high-spin Fe³⁺ (relative to α-Fe at room temperature), separating oxidation states directly. The quadrupole splitting ΔE_Q: a charge distribution of less than cubic symmetry around the nucleus splits the line into a doublet; the sixth d electron of high-spin Fe²⁺ makes it especially large (1.5–3.5 mm/s), while the spherically symmetric d⁵ of high-spin Fe³⁺ gives a small splitting (0–1 mm/s). The magnetic hyperfine splitting: a magnetic field at the nucleus gives a sextet; the internal field of α-Fe at room temperature is 33.0 T, the outermost lines lie 10.62 mm/s apart, and this serves as the velocity calibration.`),
      ],
      axes: T(`横轴是多普勒速度（mm/s），纵轴是透过率；吸收是向下的谷。`, `Doppler velocity (mm/s) against transmission; absorptions are dips.`),
      tells: [
        T(`样品里的铁有几种、各占多少、各是什么价态和自旋态：铁氧化物矿物的鉴别、电池材料充放电时 Fe²⁺ / Fe³⁺ 的比例、Fe–N–C 单原子催化剂的活性位、铁蛋白和血红素酶的中间体。`, `How many kinds of iron a sample contains, how much of each, and in which oxidation and spin state: identification of iron oxide minerals, the Fe²⁺ / Fe³⁺ ratio of battery materials during cycling, the active sites of Fe–N–C single-atom catalysts, intermediates of iron proteins and haem enzymes.`),
        T(`磁有序温度、超顺磁纳米颗粒的阻塞行为、自旋交叉配合物的高低自旋比例。`, `Magnetic ordering temperatures, the blocking behaviour of superparamagnetic nanoparticles, the high-spin to low-spin ratio of spin-crossover complexes.`),
        T(`火星车上的微型穆斯堡尔谱仪在火星表面认出了黄钾铁矾和针铁矿，这是那里曾经有水的矿物学证据。`, `The miniature Mössbauer spectrometers on the Mars rovers identified jarosite and goethite on the surface, mineralogical evidence that water was once there.`),
      ],
      sample: T(`固体粉末，每平方厘米约 5–10 mg 铁（⁵⁷Fe 的天然丰度只有 2.12 %，含铁少的样品如蛋白质要用 ⁵⁷Fe 富集）。一张谱要采几小时到几天。只能测固体或冷冻溶液。`, `A powder with about 5–10 mg of iron per square centimetre (⁵⁷Fe is only 2.12 % abundant, and iron-poor samples such as proteins need ⁵⁷Fe enrichment). A spectrum takes hours to days. Only solids or frozen solutions can be measured.`),
      nums: [
        [T(`⁵⁷Fe 跃迁`, `The ⁵⁷Fe transition`), T(`14.41 keV，自然线宽 4.7 neV（0.097 mm/s；实测最窄约 0.19 mm/s）`, `14.41 keV, natural width 4.7 neV (0.097 mm/s; narrowest observed about 0.19 mm/s)`)],
        [T(`1 mm/s`, `1 mm/s`), T(`48.08 neV`, `48.08 neV`)],
        [T(`α-Fe 六线谱的位置`, `Sextet positions of α-Fe`), T(`±0.84、±3.08、±5.31 mm/s（33.0 T）`, `±0.84, ±3.08, ±5.31 mm/s (33.0 T)`)],
        [T(`其他常用核`, `Other common nuclei`), T(`¹¹⁹Sn、¹²¹Sb、¹⁵¹Eu、¹⁹⁷Au`, `¹¹⁹Sn, ¹²¹Sb, ¹⁵¹Eu, ¹⁹⁷Au`)],
      ],
      read: [
        T(`先数子谱：单线、双线还是六线，各有几套。再对每一套读 δ（重心的位置）、ΔE_Q（双线的间隔）和内场（六线最外两条的间隔）。`, `Count the subspectra first: singlets, doublets or sextets, and how many of each. For each read δ (the centroid), ΔE_Q (the doublet spacing) and the internal field (the spacing of the outermost sextet lines).`),
        T(`粉末样品的六线谱强度比是 3:2:1:1:2:3。各子谱的面积比近似等于各种铁的含量比（假设无反冲分数相同）。`, `A powder sextet has intensities 3:2:1:1:2:3. The area ratio of subspectra approximates the ratio of the iron species (assuming equal recoil-free fractions).`),
      ],
      traps: [
        T(`同质异能位移要注明参比物（α-Fe、硝普钠还是源的基体）和温度，不同参比之间差零点几个毫米每秒。`, `An isomer shift needs its reference (α-Fe, sodium nitroprusside or the source matrix) and temperature stated; references differ by several tenths of a millimetre per second.`),
        T(`宽的、重叠的谱可以用很多套参数拟合得一样好；子谱的个数应当有化学上的理由，而不是为了把残差压平。`, `Broad, overlapping spectra are fitted equally well by many parameter sets; the number of subspectra should have a chemical justification, not merely flatten the residual.`),
      ],
      figs: [
        { gen: 'mossbauer', args: { presets: [
          { name: T(`α-Fe（室温）`, `α-Fe (room temperature)`), B: 33.0, is: 0, qs: 0 },
          { name: T(`赤铁矿 α-Fe₂O₃（室温）`, `hematite α-Fe₂O₃ (room temperature)`), B: 51.75, is: 0.37, qs: -0.20 },
          { name: T(`FeSO₄·7H₂O（高自旋 Fe²⁺）`, `FeSO₄·7H₂O (high-spin Fe²⁺)`), B: 0, is: 1.27, qs: 3.20 },
          { name: T(`高自旋 Fe³⁺ 的典型双线`, `a typical high-spin Fe³⁺ doublet`), B: 0, is: 0.35, qs: 0.70 },
          { name: T(`硝普钠（低自旋 Fe²⁺）`, `sodium nitroprusside (low-spin Fe²⁺)`), B: 0, is: -0.257, qs: 1.705 },
          { name: T(`亚铁氰化钾（低自旋 Fe²⁺）`, `potassium ferrocyanide (low-spin Fe²⁺)`), B: 0, is: -0.04, qs: 0 }] },
          cap: T(`由文献的超精细参数算出（相对室温 α-Fe 的同质异能位移、四极分裂、内场；洛伦兹线，半高宽 0.25 mm/s）。α-Fe 的六条线由 ⁵⁷Fe 基态和激发态的核磁矩（0.0906 和 −0.1549 核磁子）算出。高自旋 Fe²⁺ 的双线位移大、分裂大，一眼就能和 Fe³⁺ 分开。`, `Calculated from literature hyperfine parameters (isomer shift relative to α-Fe at room temperature, quadrupole splitting, internal field; Lorentzian lines 0.25 mm/s wide). The six lines of α-Fe follow from the nuclear magnetic moments of the ground and excited states of ⁵⁷Fe (0.0906 and −0.1549 nuclear magnetons). The doublet of high-spin Fe²⁺, with its large shift and splitting, is told from Fe³⁺ at a glance.`) },
      ],
      refs: ['mossbauer1958', 'dyar2006'],
    },
    {
      id: 'nqr', fam: 'mag', abbr: 'NQR', name: T(`核四极共振`, `Nuclear quadrupole resonance`),
      one: T(`不用磁体的“核磁共振”。自旋大于 ½ 的核不是球形的，它的电四极矩和晶体里的电场梯度相互作用，在零磁场下就有能级分裂。共振频率是化合物和晶型的指纹，用于检测爆炸物和鉴别药物多晶型。`, `"NMR" without a magnet. A nucleus of spin above ½ is not spherical; its electric quadrupole moment interacts with the electric field gradient in a crystal and its levels are split even at zero magnetic field. The resonance frequency fingerprints compound and crystal form, and serves to detect explosives and to tell drug polymorphs apart.`),
      how: [
        T(`能级间隔由核四极耦合常数 e²qQ/h 决定：Q 是核的四极矩，q 是核所在位置的电场梯度，后者由化学键的性质决定。共价的 C–Cl 键里 ³⁵Cl（I = 3/2）的共振在 30–40 MHz；离子性越强，电场梯度越小，频率越低（Cl⁻ 离子处在立方对称的环境时为零）。¹⁴N（I = 1）的频率低得多，在 0.5–5 MHz。`, `The level spacing is set by the nuclear quadrupole coupling constant e²qQ/h, with Q the quadrupole moment of the nucleus and q the electric field gradient at its site, which reflects the nature of the chemical bond. ³⁵Cl (I = 3/2) in covalent C–Cl bonds resonates at 30–40 MHz; the more ionic the bond, the smaller the gradient and the lower the frequency (zero for a Cl⁻ ion in a cubic site). ¹⁴N (I = 1) resonates far lower, at 0.5–5 MHz.`),
        T(`电场梯度是晶体的性质，所以只有固体有 NQR 信号，液体里分子翻滚把它平均掉了。晶体里每一个晶体学上不等价的位置给出一条线，线很窄（千赫量级），同一化合物的不同晶型频率不同。频率随温度升高而下降（晶格振动把电场梯度平均掉一部分），因此可以当温度计用。`, `The field gradient is a property of the crystal, so only solids give NQR signals; tumbling averages it away in liquids. Every crystallographically inequivalent site gives one line, the lines are narrow (kilohertz), and polymorphs of one compound differ in frequency. Frequencies fall with rising temperature (lattice vibrations average away part of the gradient), which makes NQR usable as a thermometer.`),
      ],
      axes: T(`横轴是射频频率（MHz），纵轴是信号强度。`, `Radio frequency (MHz) against signal intensity.`),
      tells: [
        T(`含氮爆炸物（RDX、HMX、TNT）和毒品的非接触检测：¹⁴N 的频率组合对每种晶体是唯一的。`, `Contact-free detection of nitrogen-containing explosives (RDX, HMX, TNT) and narcotics: the set of ¹⁴N frequencies is unique to each crystal.`),
        T(`药物的晶型、化学键的离子性、晶体里不等价位置的数目、相变。`, `Drug polymorphs, bond ionicity, the number of inequivalent sites in a crystal, phase transitions.`),
      ],
      sample: T(`克量级的晶体粉末，不需要磁体。灵敏度低，尤其是低频的 ¹⁴N。`, `Grams of crystalline powder and no magnet. Sensitivity is low, especially for low-frequency ¹⁴N.`),
      nums: [
        [T(`³⁵Cl 和 ³⁷Cl 的频率比`, `Frequency ratio of ³⁵Cl to ³⁷Cl`), T(`1.2688（等于两种核四极矩之比）`, `1.2688 (the ratio of the two quadrupole moments)`)],
        [T(`对二氯苯的 ³⁵Cl 共振`, `³⁵Cl resonance of p-dichlorobenzene`), T(`室温约 34.3 MHz`, `About 34.3 MHz at room temperature`)],
        [T(`RDX 的 ¹⁴N 共振`, `¹⁴N resonances of RDX`), T(`室温约 3.41 和 5.19 MHz`, `About 3.41 and 5.19 MHz at room temperature`)],
      ],
      read: [
        T(`数线的条数得到不等价位置的数目；³⁵Cl 的每条线在频率除以 1.2688 的地方有一条 ³⁷Cl 的伴线，可以用来确认归属。`, `Count lines for the number of inequivalent sites; each ³⁵Cl line has a ³⁷Cl companion at the frequency divided by 1.2688, which confirms the assignment.`),
      ],
      traps: [
        T(`无定形和缺陷多的样品，电场梯度有一个分布，线宽到看不见。`, `In amorphous or highly defective samples the field gradient is distributed and the line broadens beyond detection.`),
      ],
      figs: [
        { sketch: { x: [24, 38], xl: T(`频率（MHz）`, `frequency (MHz)`), yl: T(`强度（示意）`, `intensity (schematic)`), peaks: [[34.27, 1, 0.08, T(`³⁵Cl`, `³⁵Cl`)], [27.01, 0.3, 0.08, T(`³⁷Cl`, `³⁷Cl`)]] },
          cap: T(`示意：对二氯苯的氯核四极共振。³⁵Cl 的线取文献值约 34.27 MHz；³⁷Cl 的线由四极矩之比 1.2688 算出，在 27.01 MHz。相对高度和线宽是示意的。`, `Schematic: chlorine NQR of p-dichlorobenzene. The ³⁵Cl line is placed at the literature value of about 34.27 MHz; the ³⁷Cl line follows from the quadrupole moment ratio of 1.2688, at 27.01 MHz. Relative heights and widths are illustrative.`) },
      ],
      refs: ['dehmelt1950'],
    },
  );
})();
