'use strict';
// 谱图馆 · 色谱与分离一族。保留指数、保留时间和质谱来自 MassBank 的实测记录；色谱峰形是模型，图注里逐张说明。
(() => {
  const T = (zh, en) => ({ zh, en });
  const EMPA = ['ei-ethane', 'ei-sf6', 'ei-cos', 'ei-propane', 'ei-cfc12', 'ei-hfc134a', 'ei-halon1211', 'ei-ch3br', 'ei-cfc11', 'ei-isopentane', 'ei-ch3i', 'ei-dcm', 'ei-hexane', 'ei-chloroform', 'ei-ccl4', 'ei-tce', 'ei-ch2br2', 'ei-heptane', 'ei-pce', 'ei-acetaldehyde', 'ei-benzene', 'ei-fluorobenzene', 'ei-toluene', 'ei-chlorobenzene', 'ei-decane'];
  const LCSB = ['esi-cotinine', 'esi-theobromine', 'esi-theophylline', 'esi-caffeine-30', 'esi-propranolol', 'esi-reserpine', 'esi-carbamazepine', 'esi-atrazine', 'esi-warfarin', 'esi-diclofenac', 'esi-ibuprofen', 'esi-progesterone'];
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'gc', fam: 'sep', core: true, abbr: 'GC', name: T(`气相色谱`, `Gas chromatography`),
      one: T(`把混合物气化后用载气吹过一根几十米长、内壁涂着薄薄一层固定液的毛细管。各组分在气相和固定液之间来回分配，沸点低、和固定液作用弱的先出来。它是挥发性有机物分离能力最强的方法，一根柱子能分开几百个峰。`, `A vaporised mixture is swept by a carrier gas through a capillary tens of metres long whose wall carries a thin film of stationary liquid. Components partition back and forth between gas and film, and those of lower boiling point and weaker interaction emerge first. It is the most powerful separation for volatile organics: one column resolves hundreds of peaks.`),
      how: [
        T(`保留时间 t_R 由两部分组成：不被保留的物质通过柱子的时间 t_M（死时间），加上在固定相里停留的时间。保留因子 k = (t_R − t_M) / t_M 是组分在固定相和流动相里的量之比。两个峰的选择性 α = k₂ / k₁。温度每升高约 20–30 °C，k 大约减半，所以用程序升温：从 40 °C 升到 300 °C，让沸点相差很大的组分都在合适的时间出峰，后面的峰也不会变宽。`, `The retention time t_R has two parts: the time an unretained substance takes to pass the column, t_M (the dead time), plus the time spent in the stationary phase. The retention factor k = (t_R − t_M) / t_M is the ratio of the amounts of a component in the stationary and mobile phases, and the selectivity of two peaks is α = k₂ / k₁. Raising the temperature by about 20–30 °C roughly halves k, hence temperature programming: ramping from 40 °C to 300 °C lets components of very different boiling point all elute in reasonable time without the late peaks broadening.`),
        T(`柱效用理论塔板数表示：N = 5.54 (t_R / w½)²，w½ 是半高宽。一根 30 m 的毛细管柱有十万块以上的塔板。塔板高度 H = L / N 随载气线速度 u 的变化由 van Deemter 方程描述：H = A + B/u + C·u。B 项是分子沿柱子方向的扩散（流得越慢越严重），C 项是组分来不及在两相之间平衡（流得越快越严重），两者之间有一个最佳流速。空心毛细管柱没有填料，A 项为零（Golay 方程）。`, `Column efficiency is expressed as the number of theoretical plates: N = 5.54 (t_R / w½)², with w½ the width at half height. A 30 m capillary has more than a hundred thousand plates. The plate height H = L / N depends on the linear velocity u of the carrier gas through the van Deemter equation H = A + B/u + C·u. The B term is diffusion along the column (worse at low flow) and the C term the failure of the solute to equilibrate between the phases (worse at high flow); between them lies an optimum velocity. Open-tubular columns have no packing, so the A term vanishes (the Golay equation).`),
        T(`两个相邻的峰分得开不开，用分离度衡量：R_s = 2 (t₂ − t₁) / (w₁ + w₂)，1.5 以上算基线分离。它由三个因素决定（Purnell 方程）：R_s = (√N / 4) · ((α − 1) / α) · (k / (1 + k))。把柱子加长一倍，R_s 只提高到 1.41 倍；把 α 从 1.05 提高到 1.10，R_s 几乎翻倍。所以分不开时首先换固定相（改 α），而不是换更长的柱子。`, `Whether two neighbouring peaks are separated is measured by the resolution R_s = 2 (t₂ − t₁) / (w₁ + w₂), with 1.5 or more counting as baseline separation. Three factors determine it (the Purnell equation): R_s = (√N / 4) · ((α − 1) / α) · (k / (1 + k)). Doubling the column length raises R_s only 1.41-fold; raising α from 1.05 to 1.10 nearly doubles it. When peaks will not separate, change the stationary phase (and with it α) before reaching for a longer column.`),
        T(`保留时间随柱长、流速、升温程序变化，换一台仪器就不一样。Kováts 保留指数把它换算成相对于正构烷烃的位置：碳数为 n 的正构烷烃的指数规定为 100n，其他化合物按保留时间内插（等温时对调整保留时间取对数内插，线性程序升温时直接线性内插）。同一种固定相上的保留指数在不同实验室之间可以重复到几个单位，是质谱之外的第二个鉴定依据。`, `Retention times change with column length, flow and temperature programme, and differ between instruments. The Kováts retention index converts them to a position relative to the n-alkanes: an n-alkane with n carbons is assigned 100n and other compounds are interpolated (logarithmically in adjusted retention time under isothermal conditions, linearly under a linear temperature programme). On a given stationary phase, indices reproduce between laboratories to within a few units and provide a second line of identification beside the mass spectrum.`),
      ],
      axes: T(`横轴是保留时间（分钟），纵轴是检测器响应。峰的位置用来定性，峰面积用来定量。`, `Retention time (minutes) against detector response. Peak position identifies; peak area quantifies.`),
      tells: [
        T(`混合物里有多少种挥发性组分，各占多少：溶剂残留、精油和香料、石油馏分、脂肪酸甲酯、环境空气里的挥发性有机物。`, `How many volatile components a mixture has and how much of each: residual solvents, essential oils and flavours, petroleum fractions, fatty acid methyl esters, volatile organics in ambient air.`),
        T(`纯度和反应进程：产物和原料的峰面积比。`, `Purity and reaction progress: the area ratio of product to starting material.`),
        T(`对映体过量（用环糊精手性柱）。`, `Enantiomeric excess (on cyclodextrin chiral columns).`),
      ],
      sample: T(`能气化而不分解（沸点大致在 400 °C 以下）的化合物，溶在挥发性溶剂里进 1 μL，多数时候分流掉 90–99 %。极性强的要先衍生化。不用溶剂的进样方式有顶空、固相微萃取和热脱附。`, `Compounds that vaporise without decomposing (boiling roughly below 400 °C), 1 μL of a solution in a volatile solvent, usually with 90–99 % split away. Strongly polar compounds are derivatised first. Solvent-free alternatives are headspace sampling, solid-phase microextraction and thermal desorption.`),
      nums: [
        [T(`常用毛细管柱`, `Typical capillary column`), T(`30 m × 0.25 mm，液膜 0.25 μm`, `30 m × 0.25 mm, 0.25 μm film`)],
        [T(`塔板数`, `Plate number`), T(`每米约 3000–5000`, `About 3000–5000 per metre`)],
        [T(`氢火焰离子化检测器（FID）`, `Flame ionisation detector (FID)`), T(`对含碳化合物响应，线性范围 10⁷，检出限约每秒 1 pg 碳`, `Responds to carbon compounds; linear over 10⁷; detects about 1 pg of carbon per second`)],
        [T(`电子俘获检测器（ECD）`, `Electron capture detector (ECD)`), T(`对含卤素化合物可到飞克级`, `Femtograms for halogenated compounds`)],
        [T(`基线分离`, `Baseline separation`), T(`R_s ≥ 1.5`, `R_s ≥ 1.5`)],
      ],
      read: [
        T(`先确认溶剂峰和死时间，再看有多少个峰、是否对称。前伸的峰（前沿平缓）多半是进样量过载，拖尾的峰多半是柱子或衬管有活性位点吸附了极性化合物。`, `Identify the solvent peak and the dead time, then count the peaks and check their symmetry. A fronting peak usually means overloading; a tailing peak usually means active sites in the column or liner adsorbing polar compounds.`),
        T(`定性靠和标准品比保留时间（最好在两种极性不同的柱子上都对得上）或保留指数；定量用内标法，校正进样体积的波动。`, `Identify by matching retention times with standards (preferably on two columns of different polarity) or retention indices; quantify with an internal standard, which corrects for variation in injected volume.`),
      ],
      traps: [
        T(`保留时间相同不等于是同一种化合物：一根柱子上几百个可能的位置，对几十万种挥发物来说远远不够。`, `Equal retention time does not mean the same compound: a few hundred available positions on a column cannot be unique among hundreds of thousands of volatile compounds.`),
        T(`FID 的峰面积百分比不是质量百分比，更不是摩尔百分比：响应大致正比于碳原子数，含氧、含卤的碳响应低（甲酸、CCl₄ 几乎没有响应）。`, `FID area percent is not mass percent, still less mole percent: response is roughly proportional to the number of carbons, and carbons bound to oxygen or halogen respond weakly (formic acid and CCl₄ give almost nothing).`),
        T(`进样口的高温会让热不稳定的化合物分解，谱图上看到的可能是分解产物。`, `The hot inlet decomposes thermally labile compounds, and the chromatogram may show the decomposition products instead.`),
      ],
      figs: [
        { gen: 'ritable', args: { ids: EMPA }, cap: T(`实测（MassBank，Empa 的记录）：25 种挥发性化合物在同一根 GasPro 多孔层键合硅胶柱（60 m × 0.32 mm）上的保留指数。正构烷烃（乙烷 200、丙烷 300、己烷 600、庚烷 700、癸烷 1000）是刻度。保留指数和固定相有关：这根吸附型的柱子上苯是 727、甲苯 852，而在常用的非极性聚硅氧烷柱上它们大约是 650 和 760。`, `Measured (MassBank, records from Empa): retention indices of 25 volatile compounds on one GasPro bonded-silica PLOT column (60 m × 0.32 mm). The n-alkanes (ethane 200, propane 300, hexane 600, heptane 700, decane 1000) are the ruler. Indices depend on the stationary phase: on this adsorption column benzene is 727 and toluene 852, whereas on the usual non-polar polysiloxane columns they are near 650 and 760.`) },
        { gen: 'vandeemter', args: { mode: 'gc' }, cap: T(`示意：三种载气的 van Deemter 曲线（参数按 0.25 mm 柱典型的最佳线速度选取：氮气约 13、氦气约 25、氢气约 40 cm/s）。氮气的最低塔板高度最小，但最佳流速低、偏离后效率掉得快；氢气的曲线最平，可以开得很快而不损失多少柱效。`, `Schematic: van Deemter curves of three carrier gases (parameters chosen to give the typical optimum velocities of a 0.25 mm column: about 13 cm/s for nitrogen, 25 for helium, 40 for hydrogen). Nitrogen reaches the lowest plate height but at a low velocity and loses efficiency quickly away from it; hydrogen has the flattest curve and can be run fast with little loss.`) },
        { gen: 'resolution', cap: T(`由 Purnell 方程算出：调塔板数 N、选择性 α 和保留因子 k，看两个等高的高斯峰分得怎么样。`, `From the Purnell equation: vary the plate number N, the selectivity α and the retention factor k and watch two equal Gaussian peaks separate.`) },
      ],
      see: [['#m-gcms', T(`气相色谱–质谱联用`, `Gas chromatography–mass spectrometry`)], ['#lab-chrom', T(`动手实验室：分离度`, `Hands-on lab: resolution`)]],
      refs: ['james1952', 'vandeemter1956', 'kovats1958', 'vandendool1963', 'arthur1990'],
    },
    {
      id: 'gcms', fam: 'sep', core: true, abbr: 'GC-MS', name: T(`气相色谱–质谱联用`, `Gas chromatography–mass spectrometry`),
      one: T(`气相色谱把混合物分成一个个纯组分，质谱每秒几次到几十次地给流出物拍“快照”。每个色谱峰都带着一张质谱，可以到谱库里检索；重叠的峰可以靠各自特有的离子分开。它是鉴定挥发性未知物的标准方法。`, `Gas chromatography splits a mixture into pure components and the mass spectrometer takes snapshots of the effluent several to tens of times a second. Every chromatographic peak carries a mass spectrum that can be searched against a library, and overlapping peaks can be separated by ions unique to each. It is the standard way to identify volatile unknowns.`),
      how: [
        T(`毛细管柱的出口经过一段加热的传输线直接伸进质谱的电子电离源。载气（氦气，约 1 mL/min）被真空泵抽走。四极杆质谱每秒扫几遍 m/z 35–550；飞行时间质谱每秒可以采几十到几百张谱。数据是一个三维的数据块：时间 × m/z × 强度。`, `The outlet of the capillary passes through a heated transfer line straight into the electron ionisation source. The carrier gas (helium, about 1 mL/min) is pumped away. A quadrupole scans m/z 35–550 several times a second; a time-of-flight analyser records tens to hundreds of spectra a second. The data form a three-dimensional block: time × m/z × intensity.`),
        T(`从这个数据块可以切出三种图。总离子流色谱图（TIC）：每一时刻所有离子强度之和，样子像普通的色谱图。提取离子色谱图（EIC）：只画某一个 m/z 的强度随时间的变化，只有含这个离子的化合物才出峰。某一时刻的质谱：扣掉峰两侧的背景后拿去检索谱库。`, `Three kinds of plot can be cut from this block. The total ion chromatogram (TIC): the sum of all ion intensities at each moment, which looks like an ordinary chromatogram. An extracted ion chromatogram (EIC): the intensity of one m/z against time, in which only compounds giving that ion appear. And the mass spectrum at one moment, which, after subtracting the background on either side of the peak, goes to the library search.`),
        T(`做痕量定量时不扫全谱，只盯着每个目标物的两三个特征离子（选择离子监测，SIM），每个离子的采集时间长了几十倍，灵敏度提高一到两个数量级。三重四极杆的 MRM 再把选择性提高一级，是食品农残和二噁英检测的常规做法。`, `For trace quantification the instrument does not scan but dwells on two or three characteristic ions of each target (selected ion monitoring, SIM), spending tens of times longer on each ion and gaining one to two orders of magnitude in sensitivity. MRM on a triple quadrupole adds another level of selectivity and is routine for pesticide residues in food and for dioxins.`),
      ],
      axes: T(`色谱图：保留时间对离子流强度。质谱图：m/z 对相对丰度。两种图要一起看。`, `Chromatogram: retention time against ion current. Mass spectrum: m/z against relative abundance. The two are read together.`),
      tells: [
        T(`未知挥发物是什么：谱库检索加保留指数。法医毒物、纵火残留、香精成分、代谢物（衍生化后）、环境污染物。`, `What an unknown volatile is: library search plus retention index. Forensic toxicology, arson residues, fragrance composition, metabolites (after derivatisation), environmental pollutants.`),
        T(`色谱上没分开的两个组分各有多少（用各自的特征离子）。`, `How much of each of two components that the column failed to separate (using an ion characteristic of each).`),
        T(`复杂基质里 ppb 到 ppt 级的目标物（SIM、MRM）。`, `Targets at ppb to ppt levels in complex matrices (SIM, MRM).`),
      ],
      sample: T(`和气相色谱相同。全扫描进样纳克级，SIM 皮克级。柱流失（固定液分解出的环硅氧烷，m/z 73、207、281）和隔垫、邻苯二甲酸酯（m/z 149）是常见的背景。`, `As for gas chromatography. Nanograms on column for full scan, picograms for SIM. Column bleed (cyclic siloxanes from the stationary phase: m/z 73, 207, 281), septum bleed and phthalates (m/z 149) are the usual background.`),
      nums: [
        [T(`扫描速度`, `Scan rate`), T(`四极杆每秒 2–20 张谱，每个色谱峰要 10 个点以上`, `2–20 spectra per second on a quadrupole; at least 10 points across each peak`)],
        [T(`鉴定的依据`, `Basis of an identification`), T(`谱库匹配、保留指数、最好再加标准品`, `Library match, retention index and, ideally, an authentic standard`)],
        [T(`定量离子与定性离子的比值`, `Quantifier-to-qualifier ion ratio`), T(`一般要求和标准品相差不超过 ±20–30 %`, `Usually required within ±20–30 % of the standard`)],
      ],
      read: [
        T(`先看总离子流图上有多少个峰，再逐个点开看质谱。峰前沿、峰顶、峰后沿三处的质谱应该一样；不一样说明这个“峰”里藏着不止一种化合物。`, `Count the peaks in the total ion chromatogram, then open the mass spectrum of each. Spectra at the front, top and tail of a peak should be the same; if they differ, the "peak" hides more than one compound.`),
        T(`怀疑有某类化合物时直接画它的特征离子：m/z 91 找烷基苯，57 找烷烃，149 找邻苯二甲酸酯，74 找脂肪酸甲酯。`, `To look for a class of compounds, draw its characteristic ion: m/z 91 for alkylbenzenes, 57 for alkanes, 149 for phthalates, 74 for fatty acid methyl esters.`),
        T(`谱库检索结果排第一的不一定对：看匹配度是不是明显高过第二名，保留指数对不对得上，同位素峰和分子离子合不合理。`, `The top library hit is not necessarily right: check that its score clearly exceeds the second hit, that the retention index agrees, and that isotope pattern and molecular ion make sense.`),
      ],
      traps: [
        T(`总离子流图上的峰面积不能直接比含量：不同化合物电离后总离子产额不同。`, `Peak areas in the total ion chromatogram do not compare amounts directly: total ion yields differ between compounds.`),
        T(`四极杆扫描时峰顶前后浓度在变，低质量端和高质量端采于不同时刻，谱会“倾斜”；取峰顶附近几张谱的平均可以减轻。`, `While a quadrupole scans, the concentration changes across the peak, so low and high masses are sampled at different moments and the spectrum is skewed; averaging a few spectra around the apex reduces this.`),
      ],
      figs: [
        { gen: 'gcms', args: { ids: EMPA }, cap: T(`由实测数据重建：把 25 种化合物放在一起的 GC-MS。横轴是实测的保留指数（MassBank，Empa，GasPro 柱），点一个峰看到的是那个化合物实测的电子电离质谱；每个化合物取等量，色谱峰形（高斯）和峰宽是模型，不是实测的色谱图。甲苯（852）和氯苯（853）在这根柱子上完全重叠：总离子流图上是一个峰，画 m/z 91 和 m/z 112 两条提取离子色谱图就把它们分开了。`, `Reconstructed from measured data: a GC-MS run of the 25 compounds together. The abscissa is the measured retention index (MassBank, Empa, GasPro column), and clicking a peak shows the measured electron ionisation spectrum of that compound; equal amounts are assumed, and the peak shape (Gaussian) and width are a model, not a measured chromatogram. Toluene (852) and chlorobenzene (853) coincide on this column: one peak in the total ion chromatogram, but the extracted ion chromatograms of m/z 91 and m/z 112 pull them apart.`) },
      ],
      see: [['#m-ei', T(`电子电离质谱：怎样读一张质谱`, `Electron ionisation: how to read a mass spectrum`)]],
      refs: ['guillevic2021', 'horai2010', 'mclafferty1959', 'vandendool1963'],
    },
    {
      id: 'hplc', fam: 'sep', core: true, abbr: 'HPLC · UHPLC', name: T(`高效液相色谱`, `High-performance liquid chromatography`),
      one: T(`用高压泵把液体流动相压过填满几微米颗粒的柱子。不要求样品能气化，所以适用面比气相色谱宽得多：药物、天然产物、肽、糖、离子。制药行业的含量、有关物质和溶出度测定几乎都靠它。`, `A high-pressure pump forces a liquid mobile phase through a column packed with particles a few micrometres across. The sample need not vaporise, so the scope is far wider than that of gas chromatography: drugs, natural products, peptides, sugars, ions. Assay, related substances and dissolution testing in the pharmaceutical industry nearly all rest on it.`),
      how: [
        T(`最常用的是反相色谱：固定相是键合了十八烷基链（C18）的硅胶，流动相是水和乙腈或甲醇的混合物。疏水的化合物在 C18 上停留得久，亲水的先出来。有机溶剂的比例 φ 越高，洗脱越快：log k ≈ log k_w − S·φ，小分子的 S 约为 4，也就是有机相每增加 10 %，k 减到原来的约 40 %。梯度洗脱在一次运行中把 φ 从 5 % 升到 95 %，让极性相差很大的组分都得到合适的保留。`, `Reversed-phase chromatography is the workhorse: the stationary phase is silica bonded with octadecyl chains (C18) and the mobile phase a mixture of water with acetonitrile or methanol. Hydrophobic compounds linger on the C18, hydrophilic ones elute first. The higher the organic fraction φ, the faster the elution: log k ≈ log k_w − S·φ, with S about 4 for small molecules, so every additional 10 % of organic solvent cuts k to about 40 %. Gradient elution raises φ from 5 % to 95 % within a run, giving suitable retention to components of very different polarity.`),
        T(`可电离的化合物的保留受 pH 控制：酸在 pH 低于 pKa 时是中性的，保留强；碱则相反。所以流动相要加缓冲液或 0.1 % 的甲酸、三氟乙酸，把 pH 固定在离 pKa 两个单位以外的地方，峰形才对称、保留才稳定。普通硅胶基质的柱子只能在 pH 2–8 之间用。`, `Retention of ionisable compounds is governed by pH: an acid is neutral and strongly retained below its pKa, a base the reverse. The mobile phase therefore carries a buffer or 0.1 % formic or trifluoroacetic acid, fixing the pH at least two units from the pKa so that peaks are symmetric and retention stable. Ordinary silica-based columns tolerate only pH 2–8.`),
        T(`颗粒越小，柱效越高：最小塔板高度约为颗粒直径的两倍，而且 van Deemter 曲线右边变平，可以用更高的流速。代价是压力和颗粒直径的平方成反比。把颗粒从 5 μm 降到 1.7 μm（UHPLC），同样长度的柱子塔板数是三倍，压力要到 1000 bar 以上。`, `The smaller the particles, the higher the efficiency: the minimum plate height is about twice the particle diameter, and the right-hand side of the van Deemter curve flattens, allowing higher flow. The price is a pressure inversely proportional to the square of the particle diameter. Going from 5 μm to 1.7 μm particles (UHPLC) triples the plate number of a column of the same length and takes the pressure beyond 1000 bar.`),
        T(`其他分离模式换的是固定相和保留机理：正相（硅胶，非极性流动相）、亲水作用色谱（HILIC，极性固定相配高比例乙腈，保留糖、氨基酸这些在 C18 上不保留的极性分子）、离子交换、体积排阻、手性、亲和。检测器最常用的是紫外（二极管阵列可以给每个峰一张紫外光谱），没有紫外吸收的用示差折光、蒸发光散射、电雾式检测器或质谱。`, `Other modes change the stationary phase and the retention mechanism: normal phase (silica, non-polar eluent), hydrophilic interaction chromatography (HILIC: a polar stationary phase with a high fraction of acetonitrile, retaining polar molecules such as sugars and amino acids that do not stick to C18), ion exchange, size exclusion, chiral and affinity. The usual detector is ultraviolet absorbance (a diode array gives each peak a UV spectrum); compounds without a chromophore need refractive index, evaporative light scattering, charged aerosol detection or mass spectrometry.`),
      ],
      axes: T(`横轴是保留时间（分钟），纵轴是检测器信号（紫外检测是 mAU，千分之一吸光度）。`, `Retention time (minutes) against detector signal (mAU, thousandths of an absorbance unit, for UV detection).`),
      tells: [
        T(`含量和纯度：主成分多少，每个杂质占多少（药典方法通常要求报告 0.05 % 以上的杂质）。`, `Assay and purity: how much main component, and how much of each impurity (pharmacopoeial methods typically report impurities above 0.05 %).`),
        T(`稳定性（降解产物随时间的增长）、溶出度、反应监测、制备纯化。`, `Stability (degradation products growing with time), dissolution, reaction monitoring, preparative purification.`),
        T(`疏水性：反相保留和 log P 相关。`, `Hydrophobicity: reversed-phase retention correlates with log P.`),
      ],
      sample: T(`溶在和起始流动相相近的溶剂里，过 0.22 μm 滤膜，进样 1–20 μL。用比流动相强得多的溶剂溶样会让早出的峰变形或分叉。`, `Dissolved in a solvent close to the initial mobile phase, filtered through 0.22 μm, 1–20 μL injected. A sample solvent much stronger than the mobile phase distorts or splits early peaks.`),
      nums: [
        [T(`常规柱`, `Conventional column`), T(`150 × 4.6 mm，5 μm，1 mL/min，约 100–200 bar`, `150 × 4.6 mm, 5 μm, 1 mL/min, about 100–200 bar`)],
        [T(`UHPLC 柱`, `UHPLC column`), T(`50–100 × 2.1 mm，1.7 μm，0.3–0.6 mL/min，600–1200 bar`, `50–100 × 2.1 mm, 1.7 μm, 0.3–0.6 mL/min, 600–1200 bar`)],
        [T(`合适的保留`, `Suitable retention`), T(`k 在 1–10 之间`, `k between 1 and 10`)],
        [T(`检出限和定量限（ICH Q2）`, `Detection and quantification limits (ICH Q2)`), T(`3.3 σ/S 和 10 σ/S（σ 是响应的标准偏差，S 是标准曲线斜率）`, `3.3 σ/S and 10 σ/S (σ the standard deviation of the response, S the calibration slope)`)],
        [T(`紫外截止波长`, `UV cut-offs`), T(`乙腈 190 nm，甲醇 205 nm，0.1 % 三氟乙酸约 210 nm`, `Acetonitrile 190 nm, methanol 205 nm, 0.1 % trifluoroacetic acid about 210 nm`)],
      ],
      read: [
        T(`先看系统适用性：主峰的塔板数、拖尾因子（一般要求不超过 2）、和相邻峰的分离度、重复进样的峰面积相对标准偏差。这些不合格，后面的数字都不可信。`, `Check system suitability first: plate number of the main peak, tailing factor (usually no more than 2), resolution from its neighbour, and the relative standard deviation of area over replicate injections. If these fail, the numbers that follow cannot be trusted.`),
        T(`用二极管阵列看峰纯度：一个峰前、中、后三处的紫外光谱应当重合。`, `Use the diode array to check peak purity: UV spectra at the front, middle and tail of a peak should coincide.`),
        T(`“面积归一化法”得到的纯度只在所有组分的吸光系数相近时才有意义。`, `Purity by area normalisation is meaningful only when all components have similar absorption coefficients.`),
      ],
      traps: [
        T(`看不见的不等于没有：没有紫外吸收的杂质（无机盐、糖、脂肪族化合物）、不被保留而混在溶剂峰里的、粘在柱子上不出来的，紫外检测器都报告不了。“HPLC 纯度 99 %”只是说在这个波长、这个方法下看到的峰里主峰占 99 %。`, `Unseen is not absent: impurities without UV absorption (inorganic salts, sugars, aliphatics), those unretained in the solvent front and those stuck on the column go unreported by a UV detector. "99 % pure by HPLC" only says the main peak makes up 99 % of what was seen at this wavelength by this method.`),
        T(`梯度方法从一台仪器转到另一台时，保留时间会因为“延迟体积”（从混合器到柱头的体积）不同而整体移动。`, `When a gradient method moves between instruments, retention times shift as a whole because the dwell volume (from mixer to column head) differs.`),
      ],
      figs: [
        { gen: 'lcms', args: { ids: LCSB, mode: 'uv' }, cap: T(`由实测保留时间重建：12 种药物和农药在同一个反相梯度方法下的出峰顺序（MassBank，LCSB 的记录：Acquity BEH C18 柱，1.7 μm，2.1 × 150 mm；水相比例 90 % 保持 2 分钟，到 15 分钟降为 0）。保留时间是实测的，峰形、峰宽和峰高是模型。极性最大的可替宁 2.48 分钟就出来了，最疏水的孕酮要到 18.76 分钟。茶碱和可可碱是异构体，保留时间差了 1.8 分钟。`, `Reconstructed from measured retention times: the elution order of 12 drugs and pesticides under one reversed-phase gradient method (MassBank, records from LCSB: Acquity BEH C18, 1.7 μm, 2.1 × 150 mm; 90 % aqueous for 2 minutes, falling to 0 at 15 minutes). Retention times are measured; peak shapes, widths and heights are a model. The most polar compound, cotinine, elutes at 2.48 minutes and the most hydrophobic, progesterone, at 18.76 minutes. Theophylline and theobromine are isomers 1.8 minutes apart.`) },
        { gen: 'vandeemter', args: { mode: 'lc' }, cap: T(`模型计算（约化 van Deemter 方程 h = 1 + 2/ν + 0.08ν，扩散系数 10⁻⁹ m²/s）：5、3、1.7 μm 三种颗粒的塔板高度随线速度的变化。颗粒越小，最低点越低、越靠右，曲线右边也越平。`, `Model calculation (reduced van Deemter equation h = 1 + 2/ν + 0.08ν, diffusion coefficient 10⁻⁹ m²/s): plate height against linear velocity for particles of 5, 3 and 1.7 μm. Smaller particles put the minimum lower and further right and flatten the right-hand branch.`) },
        { gen: 'resolution', cap: T(`由 Purnell 方程算出：塔板数、选择性和保留因子怎样决定分离度。`, `From the Purnell equation: how plate number, selectivity and retention factor set the resolution.`) },
      ],
      see: [['#m-lcms', T(`液相色谱–质谱联用`, `Liquid chromatography–mass spectrometry`)], ['#m-uvvis', T(`紫外-可见吸收光谱`, `UV–visible absorption spectroscopy`)]],
      refs: ['martin1941', 'vandeemter1956', 'mazzeo2005', 'alpert1990', 'elapavalore2023'],
    },
    {
      id: 'lcms', fam: 'sep', core: true, abbr: 'LC-MS · LC-MS/MS', name: T(`液相色谱–质谱联用`, `Liquid chromatography–mass spectrometry`),
      one: T(`液相色谱分离，电喷雾把流出液里的分子变成离子，质谱给出每个峰的质量，串联质谱再给出碎片。保留时间、精确质量、同位素峰形和二级谱四样证据合在一起，是今天鉴定和定量不挥发化合物的主力：从血药浓度、农药残留到代谢组和蛋白质组。`, `Liquid chromatography separates, electrospray turns the molecules in the effluent into ions, the mass spectrometer gives the mass of every peak and tandem mass spectrometry its fragments. Retention time, exact mass, isotope pattern and MS/MS spectrum together make it the mainstay for identifying and quantifying involatile compounds, from drug levels in blood and pesticide residues to metabolomics and proteomics.`),
      how: [
        T(`和 GC-MS 一样，数据是时间 × m/z × 强度的数据块，可以切出总离子流图、基峰色谱图和提取离子色谱图（EIC）。高分辨质谱上 EIC 的质量窗口可以窄到 ±5 ppm，背景里质量相近的离子基本被挡在外面，所以即使总离子流图上乱成一片，目标物的 EIC 上也常常只有一个干净的峰。`, `As in GC-MS, the data form a block of time × m/z × intensity from which total ion, base peak and extracted ion chromatograms (EIC) are cut. On a high-resolution instrument the EIC window can be as narrow as ±5 ppm, shutting out nearly all background ions of similar mass, so that even when the total ion chromatogram is a thicket the EIC of a target often shows one clean peak.`),
        T(`流动相必须能挥发干净：用甲酸、乙酸、甲酸铵、乙酸铵，不用磷酸盐。正离子模式加 0.1 % 甲酸帮助质子化，负离子模式用少量氨水或乙酸铵。色谱在这里有两个作用：把异构体分开（质谱分不开它们），以及把分析物和会抑制电离的基质成分错开。`, `The mobile phase must evaporate without residue: formic acid, acetic acid, ammonium formate or acetate, never phosphate. Positive mode uses 0.1 % formic acid to aid protonation, negative mode a little ammonia or ammonium acetate. Chromatography does two jobs here: it separates isomers (which the mass spectrometer cannot) and moves the analyte away from matrix components that would suppress its ionisation.`),
        T(`目标物定量用三重四极杆的多反应监测（MRM）：第一个四极杆只让母离子通过，碰撞池里打碎，第三个四极杆只让一个特定的子离子通过。两道质量筛选加上保留时间，选择性极高，血浆里每毫升皮克级的药物也能测。每个分析物配一个稳定同位素标记的内标（把几个 H 换成 D，或 ¹²C 换成 ¹³C），它和分析物同时出峰、受到同样的离子抑制，两者的峰面积比就不受基质影响。`, `Targets are quantified by multiple reaction monitoring (MRM) on a triple quadrupole: the first quadrupole passes only the precursor, the collision cell fragments it, and the third passes only one chosen product ion. Two mass filters plus retention time give very high selectivity, enough for picograms of drug per millilitre of plasma. Each analyte gets a stable-isotope-labelled internal standard (several H replaced by D, or ¹²C by ¹³C) that co-elutes and suffers the same ion suppression, so the area ratio of the two is immune to the matrix.`),
        T(`非靶向分析（代谢组学、环境筛查）先全扫描找出所有“特征”（一个 m/z 和一个保留时间），再自动挑离子做二级谱。鉴定的把握分五级：1 级是用标准品在同一方法下核对了保留时间和二级谱；2 级是二级谱和谱库吻合；3 级是有几个候选结构；4 级只确定了分子式；5 级只有一个精确质量。`, `Untargeted analysis (metabolomics, environmental screening) first scans everything to find all "features" (an m/z at a retention time) and then picks ions automatically for MS/MS. Identification confidence comes in five levels: level 1 means confirmed against a reference standard for retention time and MS/MS under the same method; level 2 an MS/MS match to a library; level 3 a few candidate structures; level 4 a formula only; level 5 an exact mass only.`),
      ],
      axes: T(`色谱图：保留时间对离子强度（总离子流、某个 m/z 或某一对 MRM 离子）。每个保留时间下有一张质谱，每个被选中的母离子还有一张二级谱。`, `Chromatograms: retention time against ion intensity (total, one m/z or one MRM transition). Behind each retention time lies a mass spectrum and, for each selected precursor, an MS/MS spectrum.`),
      tells: [
        T(`生物样品里药物和代谢物的浓度（药代动力学、治疗药物监测、新生儿筛查、兴奋剂检测）。`, `Concentrations of drugs and metabolites in biological samples (pharmacokinetics, therapeutic drug monitoring, newborn screening, doping control).`),
        T(`食品和环境里几百种农药、兽药、毒素、全氟化合物的多残留同时测定。`, `Simultaneous determination of hundreds of pesticides, veterinary drugs, toxins and perfluorinated compounds in food and the environment.`),
        T(`反应混合物和杂质里未知物的分子式和结构线索；合成产物的快速确认。`, `Formulas and structural clues for unknowns in reaction mixtures and impurity profiles; quick confirmation of synthetic products.`),
        T(`代谢组、脂质组、蛋白质组的整体变化。`, `Global changes in metabolome, lipidome and proteome.`),
      ],
      sample: T(`生物样品先除蛋白（加三倍体积乙腈沉淀）或做固相萃取；食品用 QuEChERS 提取。进样 1–10 μL，柱上的量是皮克到纳克。`, `Biological samples are first deproteinised (precipitation with three volumes of acetonitrile) or cleaned up by solid-phase extraction; food is extracted by QuEChERS. 1–10 μL is injected, picograms to nanograms on column.`),
      nums: [
        [T(`三重四极杆 MRM 的定量下限`, `Lower limit of quantification by triple-quadrupole MRM`), T(`血浆里常见 1–100 pg/mL`, `Commonly 1–100 pg/mL in plasma`)],
        [T(`线性范围`, `Linear range`), T(`3–4 个数量级`, `3–4 orders of magnitude`)],
        [T(`高分辨 EIC 的质量窗口`, `Mass window of a high-resolution EIC`), T(`±5 ppm（m/z 300 处是 ±0.0015）`, `±5 ppm (±0.0015 at m/z 300)`)],
        [T(`生物分析方法验证的准确度要求`, `Accuracy required in bioanalytical validation`), T(`±15 %，定量下限处 ±20 %`, `±15 %, and ±20 % at the lower limit of quantification`)],
      ],
      read: [
        T(`对每个峰依次核对四件事：保留时间和标准品一致；精确质量在几个 ppm 之内；同位素峰形和分子式吻合；二级谱的主要碎片对得上。`, `For each peak check four things in turn: the retention time matches the standard; the exact mass is within a few ppm; the isotope pattern fits the formula; the main MS/MS fragments agree.`),
        T(`同一个保留时间下一起出现的离子往往属于同一个化合物：[M+H]⁺、[M+Na]⁺、[M+NH₄]⁺、[2M+H]⁺、丢水的源内碎片。把它们归成一组，不要当成几种化合物。`, `Ions appearing together at one retention time usually belong to one compound: [M+H]⁺, [M+Na]⁺, [M+NH₄]⁺, [2M+H]⁺, in-source fragments after loss of water. Group them rather than counting several compounds.`),
        T(`定量时看内标的峰面积在各个样品之间稳不稳；某个样品的内标突然掉了一半，说明那里有离子抑制或前处理出了问题。`, `In quantification, watch whether the internal-standard area stays steady across samples; a sudden halving in one sample signals ion suppression or a preparation failure there.`),
      ],
      traps: [
        T(`基质效应是 LC-MS 定量的头号问题：一起流出的磷脂和盐可以把信号压掉一大半，而色谱图看上去毫无异常。检验办法是柱后持续注入分析物，同时进一针空白基质，看基线在哪里凹下去。`, `Matrix effects are the foremost problem of LC-MS quantification: co-eluting phospholipids and salts can remove most of the signal while the chromatogram looks perfectly normal. The test is to infuse the analyte continuously after the column while injecting blank matrix and to see where the baseline dips.`),
        T(`不同化合物的响应可以差上千倍，峰面积不能跨化合物比较；没有标准品就只能半定量。`, `Responses differ a thousand-fold between compounds, so areas cannot be compared across compounds; without a standard the result is semi-quantitative at best.`),
        T(`氘代内标可能比分析物稍早一点出峰（氘同位素效应），在抑制变化剧烈的区域两者受到的影响就不完全一样；¹³C、¹⁵N 标记的内标没有这个问题。`, `A deuterated internal standard may elute slightly earlier than the analyte (the deuterium isotope effect), so in a region of rapidly changing suppression the two are not affected identically; ¹³C- and ¹⁵N-labelled standards avoid this.`),
      ],
      figs: [
        { gen: 'lcms', args: { ids: LCSB, mode: 'ms' }, cap: T(`由实测数据重建：12 种化合物的 LC-MS。保留时间、母离子的精确质量和二级质谱都取自 MassBank（LCSB，Orbitrap，同一个色谱方法），点一个峰看到的是实测的二级谱；色谱峰形和峰高是模型，各化合物取等响应。双氯芬酸（18.60 分钟）、布洛芬（18.73 分钟）和孕酮（18.76 分钟）在色谱上挤在一起，但它们的 m/z 分别是 296.0240、205.1234（负离子）和 315.2319，各自的提取离子色谱图互不干扰。茶碱和可可碱的 m/z 都是 181.0720，只能靠保留时间（10.15 和 8.35 分钟）和二级谱来分。`, `Reconstructed from measured data: an LC-MS run of 12 compounds. Retention times, exact precursor masses and MS/MS spectra come from MassBank (LCSB, Orbitrap, one chromatographic method), and clicking a peak shows the measured MS/MS spectrum; peak shapes and heights are a model with equal response assumed. Diclofenac (18.60 min), ibuprofen (18.73 min) and progesterone (18.76 min) crowd together on the column, but their m/z values are 296.0240, 205.1234 (negative mode) and 315.2319, so their extracted ion chromatograms do not interfere. Theophylline and theobromine share m/z 181.0720 and are told apart only by retention time (10.15 and 8.35 min) and MS/MS.`) },
        { gen: 'suppression', cap: T(`示意：柱后注入实验。分析物以恒定速度注入，本来应该是一条平的基线；进一针空白血浆提取液后，基线在死时间附近（盐）和梯度后段（磷脂）明显下凹，这两段就是离子抑制区，分析物的保留时间应当避开。`, `Schematic: a post-column infusion experiment. The analyte is infused at a constant rate and should give a flat baseline; after injection of blank plasma extract the baseline dips near the dead time (salts) and late in the gradient (phospholipids). These are the zones of ion suppression that the retention time of the analyte should avoid.`) },
      ],
      see: [['#m-esi', T(`电喷雾电离质谱`, `Electrospray ionisation mass spectrometry`)], ['#m-msms', T(`串联质谱`, `Tandem mass spectrometry`)]],
      refs: ['fenn1989', 'taylor2005', 'schymanski2014', 'elapavalore2023', 'horai2010'],
    },
    {
      id: 'sec', fam: 'sep', abbr: 'SEC · GPC', name: T(`体积排阻色谱`, `Size-exclusion chromatography`),
      one: T(`柱子里填满多孔的颗粒。大分子进不了孔，绕着颗粒走，先出来；小分子钻进孔里，路程长，后出来。分离只看分子在溶液里的尺寸。它给出聚合物的分子量分布，也用来看蛋白质有没有聚集。`, `The column is packed with porous particles. Large molecules cannot enter the pores, pass around the particles and elute first; small ones explore the pores, travel further and elute later. Separation depends only on molecular size in solution. It gives the molar-mass distribution of polymers and shows whether proteins have aggregated.`),
      how: [
        T(`理想的体积排阻色谱里样品和填料之间没有任何吸附作用，所有分子都在一个固定的体积窗口里流出：最早是完全进不了孔的（排阻极限，流出体积等于颗粒之间的空隙体积 V₀），最晚是能进所有孔的小分子（全渗透极限，V₀ + V_p）。在这两者之间，流出体积和分子量的对数近似成直线。用聚合物表征的人习惯叫它凝胶渗透色谱（GPC）。`, `In ideal size-exclusion chromatography the sample does not adsorb on the packing at all, and every molecule elutes within a fixed volume window: first those wholly excluded from the pores (the exclusion limit, at the interstitial volume V₀), last the small molecules that enter every pore (total permeation, V₀ + V_p). Between the two, elution volume is roughly linear in the logarithm of molar mass. Polymer chemists call the method gel permeation chromatography (GPC).`),
        T(`用一系列分子量已知、分布很窄的标准品（聚苯乙烯最常用）做校正曲线，再把样品色谱图上每一片的流出体积换算成分子量 M_i，高度换算成质量 w_i，求出数均分子量 M_n = Σw_i / Σ(w_i/M_i)、重均分子量 M_w = Σw_iM_i / Σw_i 和分散度 Đ = M_w / M_n。活性聚合得到的 Đ 接近 1.05，自由基聚合 1.5–2，逐步聚合约为 2。`, `A calibration curve is built from narrow standards of known molar mass (polystyrene most often), each slice of the sample chromatogram is converted from elution volume to molar mass M_i and from height to mass w_i, and the averages follow: the number average M_n = Σw_i / Σ(w_i/M_i), the weight average M_w = Σw_iM_i / Σw_i and the dispersity Đ = M_w / M_n. Living polymerisations give Đ near 1.05, radical polymerisations 1.5–2, step-growth polymerisations about 2.`),
        T(`柱子真正分的是流体力学体积，不是分子量。同样分子量的不同聚合物在溶液里的线团大小不同，所以用聚苯乙烯标样得到的只是“相对于聚苯乙烯的分子量”。两种补救：普适校正（流体力学体积正比于特性粘数和分子量的乘积 [η]M，对所有柔性链聚合物是同一条校正曲线，需要加粘度检测器）；或者加多角度光散射检测器，不靠校正曲线，直接测每一片的绝对分子量。`, `The column actually sorts by hydrodynamic volume, not molar mass. Different polymers of the same molar mass form coils of different size in solution, so polystyrene calibration yields only a "polystyrene-equivalent" molar mass. Two remedies exist: universal calibration (hydrodynamic volume is proportional to the product of intrinsic viscosity and molar mass, [η]M, giving one curve for all flexible polymers, with a viscometer added); or a multi-angle light-scattering detector, which measures the absolute molar mass of each slice without any calibration curve.`),
      ],
      axes: T(`横轴是流出体积或时间（大分子在左边），纵轴是示差折光检测器的信号，正比于质量浓度。换算之后画成分子量分布：横轴 log M，纵轴 dw / d log M。`, `Elution volume or time (large molecules on the left) against the refractive-index signal, which is proportional to mass concentration. After conversion it becomes a molar-mass distribution: log M against dw / d log M.`),
      tells: [
        T(`聚合物的 M_n、M_w、Đ，分布是单峰还是双峰，有没有残留单体或低聚物。`, `M_n, M_w and Đ of a polymer, whether the distribution is unimodal or bimodal, and whether residual monomer or oligomers remain.`),
        T(`聚合反应的进程和可控程度（分子量是否随转化率线性增长、分布是否保持窄）。`, `The progress and control of a polymerisation (whether molar mass grows linearly with conversion and the distribution stays narrow).`),
        T(`蛋白质药物里的聚集体和片段：抗体药的放行检测项目。`, `Aggregates and fragments in protein drugs: a release test for antibody therapeutics.`),
      ],
      sample: T(`1–5 mg/mL 的溶液，过滤后进 50–100 μL。溶剂要能完全溶解聚合物并屏蔽它和填料的作用：四氢呋喃最常用，极性聚合物用加了溴化锂的 DMF，水溶性聚合物和蛋白质用含盐的缓冲液。`, `A solution of 1–5 mg/mL, filtered, 50–100 μL injected. The solvent must dissolve the polymer fully and screen its interaction with the packing: tetrahydrofuran most often, DMF with lithium bromide for polar polymers, salt-containing buffers for water-soluble polymers and proteins.`),
      nums: [
        [T(`分离范围`, `Separation range`), T(`取决于孔径，一套柱子通常覆盖 10²–10⁷ g/mol`, `Depends on pore size; a column set usually covers 10²–10⁷ g/mol`)],
        [T(`流出体积的重复性要求`, `Required repeatability of elution volume`), T(`流速差 1 % 可以使分子量差 10–20 %`, `A 1 % error in flow can shift molar mass by 10–20 %`)],
        [T(`Mark–Houwink 方程`, `Mark–Houwink equation`), T(`[η] = K·Mᵃ，柔性链在良溶剂里 a ≈ 0.7`, `[η] = K·Mᵃ, with a ≈ 0.7 for flexible chains in good solvents`)],
      ],
      read: [
        T(`先看峰是不是落在柱子的线性分离范围里：贴着排阻极限出来的尖峰不是窄分布，而是分子太大、柱子分不开。`, `Check first that the peak lies within the linear range of the column: a sharp peak at the exclusion limit is not a narrow distribution but molecules too large for the column to sort.`),
        T(`报告分子量时一定写明校正方式：“相对聚苯乙烯，THF，40 °C”，或“多角度光散射，dn/dc = …”。`, `Always state the calibration with a molar mass: "against polystyrene, THF, 40 °C", or "multi-angle light scattering, dn/dc = …".`),
      ],
      traps: [
        T(`聚苯乙烯当量分子量可以和真实值差一倍以上：刚性链（共轭聚合物）被高估，支化的和紧凑的聚合物被低估。`, `Polystyrene-equivalent molar masses can be off by a factor of two or more: rigid chains (conjugated polymers) are overestimated, branched and compact polymers underestimated.`),
        T(`样品和填料之间只要有吸附或静电作用，流出就会延后，算出来的分子量偏小，甚至晚于全渗透极限出峰。`, `Any adsorption or electrostatic interaction with the packing delays elution, making the calculated molar mass too small, sometimes with peaks even after total permeation.`),
      ],
      figs: [
        { gen: 'sec', cap: T(`模型计算：两个数均分子量都是 50000、分散度分别为 1.05 和 2.0 的聚合物（Schulz–Zimm 分布）在同一条线性校正曲线（log M 对流出体积）下的色谱图。大分子先出；宽分布的样品峰宽得多，并向低分子量一侧拖尾。`, `Model calculation: chromatograms of two polymers with the same number-average molar mass of 50000 and dispersities of 1.05 and 2.0 (Schulz–Zimm distributions) on one linear calibration curve (log M against elution volume). Large molecules elute first; the broad sample gives a much wider peak tailing to low molar mass.`) },
      ],
      refs: ['moore1964'],
    },
    {
      id: 'ic', fam: 'sep', abbr: 'IC', name: T(`离子色谱`, `Ion chromatography`),
      one: T(`用离子交换柱分离无机阴离子、阳离子和有机酸，用电导检测。一次进样十几分钟测完氟、氯、亚硝酸根、溴、硝酸根、磷酸根、硫酸根，是水质分析的标准方法。`, `Inorganic anions, cations and organic acids are separated on an ion-exchange column and detected by conductivity. One injection gives fluoride, chloride, nitrite, bromide, nitrate, phosphate and sulfate in a little over ten minutes; it is the standard method of water analysis.`),
      how: [
        T(`阴离子交换柱的填料表面带固定的季铵正电荷，流动相是氢氧化钾或碳酸钠 / 碳酸氢钠溶液。样品里的阴离子和流动相里的 OH⁻ 或 CO₃²⁻ 竞争填料上的位置：电荷少、水合半径大的离子（F⁻）结合弱，先出来；电荷多的（SO₄²⁻、PO₄³⁻）后出来。阳离子交换柱则带磺酸或羧酸基团，用甲磺酸做流动相，依次洗脱 Li⁺、Na⁺、NH₄⁺、K⁺、Mg²⁺、Ca²⁺。`, `The packing of an anion-exchange column carries fixed positive quaternary ammonium groups, and the eluent is potassium hydroxide or sodium carbonate / bicarbonate. Sample anions compete with OH⁻ or CO₃²⁻ of the eluent for sites on the packing: ions of low charge and large hydrated radius (F⁻) bind weakly and elute first; those of higher charge (SO₄²⁻, PO₄³⁻) elute later. Cation-exchange columns carry sulfonate or carboxylate groups and, with methanesulfonic acid as eluent, release Li⁺, Na⁺, NH₄⁺, K⁺, Mg²⁺, Ca²⁺ in turn.`),
        T(`关键的发明是抑制器（Small、Stevens 和 Bauman，1975）。流动相本身是强电解质，电导很高，直接检测的话样品离子的信号淹没在背景里。抑制器在柱后把流动相的阳离子换成 H⁺：KOH 变成水，背景电导降到接近零；同时样品里的盐变成相应的酸（KCl 变成 HCl），而 H⁺ 的摩尔电导是 K⁺ 的近五倍，信号反而增强了。`, `The key invention was the suppressor (Small, Stevens and Bauman, 1975). The eluent is itself a strong electrolyte of high conductivity that would bury the signal of sample ions. After the column, the suppressor exchanges the eluent cation for H⁺: KOH becomes water and the background conductivity falls to nearly zero, while sample salts become the corresponding acids (KCl becomes HCl); since the molar conductivity of H⁺ is nearly five times that of K⁺, the signal actually grows.`),
      ],
      axes: T(`横轴是保留时间（分钟），纵轴是电导（μS）。`, `Retention time (minutes) against conductivity (μS).`),
      tells: [
        T(`饮用水、地表水、废水里的常见阴阳离子和消毒副产物（溴酸根、亚氯酸根、氯酸根）。`, `Common anions and cations in drinking, surface and waste water, and disinfection by-products (bromate, chlorite, chlorate).`),
        T(`药物的反离子和杂质离子、电镀液、电池电解液、高纯水里的痕量离子。`, `Counter-ions and ionic impurities of drugs, plating baths, battery electrolytes, trace ions in ultrapure water.`),
        T(`糖和氨基酸（高 pH 阴离子交换配脉冲安培检测）。`, `Sugars and amino acids (high-pH anion exchange with pulsed amperometric detection).`),
      ],
      sample: T(`水溶液过 0.22 μm 滤膜后直接进样 10–25 μL；高盐、含有机物多的样品要先稀释或过前处理小柱。`, `Aqueous solutions filtered through 0.22 μm and injected directly, 10–25 μL; samples high in salt or organics are first diluted or passed through a clean-up cartridge.`),
      nums: [
        [T(`检出限`, `Detection limits`), T(`抑制电导检测约 1–10 μg/L`, `About 1–10 μg/L with suppressed conductivity`)],
        [T(`极限摩尔电导（25 °C）`, `Limiting molar conductivities (25 °C)`), T(`H⁺ 350，OH⁻ 198，K⁺ 74，Cl⁻ 76 S cm² mol⁻¹`, `H⁺ 350, OH⁻ 198, K⁺ 74, Cl⁻ 76 S cm² mol⁻¹`)],
      ],
      read: [
        T(`靠和标准溶液比保留时间来认峰；氟离子前面常有一个“水负峰”，氟、乙酸根、甲酸根几个早出的峰容易互相重叠。`, `Peaks are identified by retention time against standard solutions; a negative "water dip" often precedes fluoride, and the early peaks of fluoride, acetate and formate overlap easily.`),
      ],
      traps: [
        T(`一个离子浓度特别高（海水里的氯离子）会让它后面的小峰（亚硝酸根、溴离子）被盖住或移位。`, `One ion at very high concentration (chloride in sea water) covers or displaces the small peaks after it (nitrite, bromide).`),
        T(`磷酸根的保留对流动相 pH 很敏感：pH 变了，它的电荷数就变了。`, `Phosphate retention is very sensitive to eluent pH, because its charge changes with it.`),
      ],
      figs: [
        { sketch: { x: [0, 16], xl: T(`保留时间（分钟）`, `retention time (minutes)`), yl: T(`电导（示意）`, `conductivity (schematic)`), peaks: [[2.6, 0.55, 0.22, T(`F⁻`, `F⁻`)], [3.9, 1, 0.26, T(`Cl⁻`, `Cl⁻`)], [4.8, 0.5, 0.3, T(`NO₂⁻`, `NO₂⁻`)], [6.4, 0.42, 0.36, T(`Br⁻`, `Br⁻`)], [7.5, 0.6, 0.4, T(`NO₃⁻`, `NO₃⁻`)], [10.6, 0.38, 0.55, T(`PO₄³⁻`, `PO₄³⁻`)], [12.9, 0.7, 0.6, T(`SO₄²⁻`, `SO₄²⁻`)]] },
          cap: T(`示意：七种常见阴离子在碳酸盐流动相下的典型出峰顺序。顺序是文献里通行的，具体的保留时间、峰高和峰宽随柱子和条件变化，这里是示意的。`, `Schematic: the typical elution order of seven common anions with a carbonate eluent. The order is the one generally reported; actual retention times, heights and widths depend on column and conditions and are illustrative here.`) },
      ],
      refs: ['small1975'],
    },
    {
      id: 'ce', fam: 'sep', abbr: 'CE', name: T(`毛细管电泳`, `Capillary electrophoresis`),
      one: T(`在一根内径几十微米、充满缓冲液的石英毛细管两端加上几万伏电压，离子按电荷和大小以不同的速度迁移。它没有固定相，柱效可达几十万到上百万塔板，每次只用几纳升样品。人类基因组的测序用的就是毛细管阵列电泳。`, `Tens of kilovolts are applied across a fused-silica capillary a few tens of micrometres wide filled with buffer, and ions migrate at speeds set by their charge and size. With no stationary phase, efficiencies reach hundreds of thousands to a million plates, and each run consumes a few nanolitres of sample. The human genome was sequenced by capillary array electrophoresis.`),
      how: [
        T(`离子在电场里的迁移速度 v = μ_ep·E，电泳淌度 μ_ep = q / (6πηr)，电荷越多、个头越小跑得越快。同时还有电渗流：pH 大于约 3 时毛细管内壁的硅羟基电离带负电，吸引一层带正电的缓冲液离子，电场拖着这层离子连同整管溶液一起流向负极。电渗流通常比离子自己的电泳快，所以正离子、中性分子、负离子都朝负极走，依次经过检测窗口。`, `An ion moves in the field at v = μ_ep·E with electrophoretic mobility μ_ep = q / (6πηr): more charge and smaller size mean faster. On top of this comes electroosmotic flow: above about pH 3 the silanols of the capillary wall ionise and carry negative charge, attracting a layer of buffer cations which the field drags, together with the whole column of liquid, towards the cathode. Electroosmotic flow usually outruns the ions' own electrophoresis, so cations, neutrals and anions all travel to the cathode and pass the detection window in that order.`),
        T(`电渗流是由管壁带动的，整个截面上流速一样（塞状流），不像压力驱动的流动那样中间快两边慢，所以没有那一份展宽。剩下的展宽主要来自纵向扩散，塔板数 N = μ·V / 2D：电压越高、分子扩散越慢（越大），柱效越高。这和色谱正相反，所以毛细管电泳特别适合 DNA、蛋白质这类大分子。电压的上限由焦耳热决定：毛细管细，散热好，才能加到 30 kV。`, `Electroosmotic flow is driven from the wall and has the same velocity across the whole section (plug flow), unlike pressure-driven flow, which is faster in the middle; that source of broadening is absent. What remains is mainly longitudinal diffusion, with a plate number N = μ·V / 2D: the higher the voltage and the slower the diffusion (the larger the molecule), the better the efficiency. This is the opposite of chromatography and makes the method well suited to DNA and proteins. Joule heating limits the voltage: only because the thin capillary sheds heat well can 30 kV be applied.`),
        T(`几种模式：毛细管区带电泳（按荷质比分离离子）；胶束电动色谱（加入十二烷基硫酸钠胶束，中性分子按在胶束里的分配分离）；毛细管凝胶电泳（管里充筛分聚合物，DNA 片段和 SDS–蛋白质复合物按大小分离）；毛细管等电聚焦（按等电点分离蛋白质）。`, `Several modes exist: capillary zone electrophoresis (ions by charge-to-size ratio); micellar electrokinetic chromatography (sodium dodecyl sulfate micelles added, neutrals separated by partitioning into them); capillary gel electrophoresis (a sieving polymer in the capillary sorts DNA fragments and SDS–protein complexes by size); and capillary isoelectric focusing (proteins by isoelectric point).`),
      ],
      axes: T(`电泳图：横轴是迁移时间（分钟），纵轴是紫外吸收或激光诱导荧光信号。`, `An electropherogram: migration time (minutes) against ultraviolet absorbance or laser-induced fluorescence.`),
      tells: [
        T(`DNA 片段长度（Sanger 测序、法医 STR 分型）。`, `Lengths of DNA fragments (Sanger sequencing, forensic STR typing).`),
        T(`抗体药的电荷异质性、片段和糖型（CE-SDS、cIEF 是放行检测项目）。`, `Charge variants, fragments and glycoforms of antibody drugs (CE-SDS and cIEF are release tests).`),
        T(`手性药物的对映体纯度（缓冲液里加环糊精）、无机离子、小分子的 pKa。`, `Enantiomeric purity of chiral drugs (cyclodextrins in the buffer), inorganic ions, pKa values of small molecules.`),
      ],
      sample: T(`几纳升进样（压力或电动进样），样品总共只需要几微升。`, `A few nanolitres injected (by pressure or electrokinetically) from a few microlitres of sample.`),
      nums: [
        [T(`毛细管`, `Capillary`), T(`内径 25–75 μm，长 30–100 cm`, `25–75 μm inner diameter, 30–100 cm long`)],
        [T(`电压`, `Voltage`), T(`10–30 kV`, `10–30 kV`)],
        [T(`塔板数`, `Plate number`), T(`10⁵–10⁶`, `10⁵–10⁶`)],
      ],
      read: [
        T(`加一个中性标记物（丙酮、二甲亚砜）标出电渗流的时间：它前面是正离子，后面是负离子。`, `Add a neutral marker (acetone, dimethyl sulfoxide) to mark the electroosmotic flow: cations come before it, anions after.`),
      ],
      traps: [
        T(`迁移时间的重复性比色谱差：管壁稍有吸附，电渗流就变。定性要用相对迁移时间或淌度，定量要用内标并把峰面积除以迁移时间。`, `Migration times repeat less well than chromatographic retention: slight adsorption on the wall changes the electroosmotic flow. Identify by relative migration time or mobility, and quantify with an internal standard, dividing areas by migration time.`),
        T(`紫外检测的光程只有毛细管的内径（几十微米），浓度检出限比 HPLC 差一到两个数量级。`, `The optical path for UV detection is only the capillary diameter (tens of micrometres), so concentration detection limits are one to two orders of magnitude worse than in HPLC.`),
      ],
      figs: [
        { sketch: { x: [0, 12], xl: T(`迁移时间（分钟）`, `migration time (minutes)`), yl: T(`吸光度（示意）`, `absorbance (schematic)`), peaks: [[3.1, 0.7, 0.07, T(`正离子`, `cation`)], [3.6, 0.5, 0.07], [5.0, 0.45, 0.09, T(`中性分子（电渗流）`, `neutrals (electroosmotic flow)`)], [7.4, 0.8, 0.12, T(`负离子`, `anion`)], [9.2, 0.55, 0.15]] },
          cap: T(`示意：毛细管区带电泳图。检测端在负极一侧：正离子最先到，中性分子随电渗流一起到，负离子逆着电场、被电渗流带着最后到。峰很窄是塞状流的结果。`, `Schematic: a capillary zone electropherogram with detection at the cathode end. Cations arrive first, neutrals with the electroosmotic flow, and anions, moving against the field but carried by the flow, last. The narrow peaks are a consequence of plug flow.`) },
      ],
      refs: ['jorgenson1981'],
    },
    {
      id: 'chiral', fam: 'sep', abbr: 'chiral HPLC · SFC', name: T(`手性色谱与超临界流体色谱`, `Chiral chromatography and supercritical fluid chromatography`),
      one: T(`一对对映体的物理性质完全相同，普通色谱柱分不开。手性固定相和两个对映体形成稳定性不同的瞬时复合物，于是它们的保留时间不同。两个峰的面积比直接给出对映体过量（ee），这是不对称合成论文里报告 ee 的标准依据。`, `Enantiomers have identical physical properties and do not separate on ordinary columns. A chiral stationary phase forms transient complexes of different stability with the two enantiomers, giving them different retention times. The area ratio of the two peaks gives the enantiomeric excess (ee) directly, the standard evidence for ee in papers on asymmetric synthesis.`),
      how: [
        T(`用得最多的手性固定相是涂敷或键合在硅胶上的多糖衍生物：纤维素或直链淀粉的三（3,5-二甲基苯基氨基甲酸酯）。多糖的螺旋沟槽里排着氨基甲酸酯的 N–H 和 C=O（氢键）和芳环（π–π 作用），一个对映体的三个基团能同时对上，另一个只能对上两个，结合能相差一点点。ΔΔG 只要约 0.24 kJ/mol（室温下 α = 1.10）就足够在高效的柱子上基线分离。其他类型有环糊精（多用于气相色谱）、大环糖肽、Pirkle 型小分子和蛋白质。`, `The most widely used chiral stationary phases are polysaccharide derivatives coated on or bonded to silica: the tris(3,5-dimethylphenylcarbamate) of cellulose or amylose. The helical grooves of the polysaccharide are lined with carbamate N–H and C=O groups (hydrogen bonding) and aromatic rings (π–π interactions); three groups of one enantiomer can engage at once, only two of the other, and the binding energies differ slightly. A ΔΔG of about 0.24 kJ/mol (α = 1.10 at room temperature) suffices for baseline separation on an efficient column. Other types are cyclodextrins (mostly in gas chromatography), macrocyclic glycopeptides, Pirkle-type small molecules and proteins.`),
        T(`ee = (A_主 − A_次) / (A_主 + A_次) × 100 %。两个对映体的紫外吸收完全相同，所以峰面积比就是摩尔比，不需要校正因子。哪个峰是 R、哪个是 S 不能从色谱图上看出来，要用已知构型的样品比对，或者接圆二色、旋光检测器。`, `ee = (A_major − A_minor) / (A_major + A_minor) × 100 %. The two enantiomers absorb ultraviolet light identically, so the area ratio is the mole ratio with no response factor. Which peak is R and which S cannot be read from the chromatogram; a sample of known configuration, or a circular dichroism or polarimetric detector, is needed.`),
        T(`超临界流体色谱（SFC）用超临界二氧化碳（临界点 31.0 °C、73.8 bar）加 5–40 % 的甲醇做流动相。它的粘度只有液体的十分之一左右，扩散快，所以可以用三到五倍于 HPLC 的流速而不损失柱效，分析时间从二十分钟缩短到几分钟。减压后二氧化碳自己挥发掉，制备分离后只需蒸掉少量甲醇。制药行业的手性分离和制备现在以 SFC 为主。`, `Supercritical fluid chromatography (SFC) uses supercritical carbon dioxide (critical point 31.0 °C, 73.8 bar) with 5–40 % methanol as the mobile phase. Its viscosity is about a tenth that of a liquid and diffusion is fast, so flow rates three to five times those of HPLC cost no efficiency and analysis times fall from twenty minutes to a few. On depressurisation the carbon dioxide leaves by itself, and after a preparative run only a little methanol needs evaporating. Chiral analysis and purification in the pharmaceutical industry now run mainly on SFC.`),
      ],
      axes: T(`和 HPLC 一样：保留时间对紫外信号。一对对映体是两个峰。`, `As for HPLC: retention time against UV signal, with two peaks for a pair of enantiomers.`),
      tells: [
        T(`对映体过量和对映体比例；手性药物里对映体杂质的含量（通常要求控制到 0.1 % 的水平）。`, `Enantiomeric excess and enantiomer ratio; the level of the enantiomeric impurity in a chiral drug (typically controlled at the 0.1 % level).`),
        T(`制备规模上拿到两个纯的对映体。`, `Both pure enantiomers on a preparative scale.`),
      ],
      sample: T(`约 1 mg/mL 的溶液，正相条件下常用正己烷 / 异丙醇做流动相。一定要先进外消旋体，证明这个方法能把两个对映体分开，并确定两个峰的位置。`, `A solution of about 1 mg/mL; under normal-phase conditions the eluent is commonly hexane / isopropanol. The racemate must be injected first to prove the method separates the enantiomers and to locate both peaks.`),
      nums: [
        [T(`室温下 α = 1.10 对应的 ΔΔG`, `ΔΔG for α = 1.10 at room temperature`), T(`RT ln α ≈ 0.24 kJ/mol`, `RT ln α ≈ 0.24 kJ/mol`)],
        [T(`CO₂ 的临界点`, `Critical point of CO₂`), T(`31.0 °C，73.8 bar`, `31.0 °C, 73.8 bar`)],
        [T(`99 % ee`, `99 % ee`), T(`对映体比例 99.5 : 0.5`, `An enantiomer ratio of 99.5 : 0.5`)],
      ],
      read: [
        T(`外消旋体的两个峰面积应该是 50:50；不是的话，说明有别的杂质和其中一个峰重叠，或者检测波长下有干扰。`, `The racemate should give two peaks of 50:50 area; if not, an impurity overlaps one of them or something interferes at the detection wavelength.`),
        T(`ee 很高时，小峰骑在大峰的尾巴上最难积分准。让小的那个对映体先出峰（换柱子或换成相反构型的固定相）会准得多。`, `At very high ee the small peak rides on the tail of the large one and is hard to integrate. Having the minor enantiomer elute first (another column, or the stationary phase of opposite configuration) is far more accurate.`),
      ],
      traps: [
        T(`只进了产物、看到一个峰，不能说 ee > 99 %：也许这根柱子根本分不开这对对映体。没有外消旋体对照的 ee 数据不成立。`, `Injecting only the product and seeing one peak does not show ee > 99 %: the column may simply not separate that pair. An ee without a racemate control does not stand.`),
        T(`由比旋光度算出的“光学纯度”和色谱测的 ee 可以不一致：旋光度受浓度、溶剂、温度和痕量高旋光杂质的影响很大。`, `"Optical purity" from specific rotation may disagree with chromatographic ee: rotation is strongly affected by concentration, solvent, temperature and traces of highly rotating impurities.`),
      ],
      figs: [
        { gen: 'chiral', cap: T(`模型计算：一对对映体在手性柱上的色谱图（两个高斯峰，α = 1.2）。拖动 ee 看两个峰的面积比怎样变化：ee 90 % 时小峰还清楚可见，99 % 时它只有大峰的 0.5 %。`, `Model calculation: the chromatogram of a pair of enantiomers on a chiral column (two Gaussian peaks, α = 1.2). Drag the ee to see the area ratio change: at 90 % ee the minor peak is plainly visible, at 99 % it is only 0.5 % of the major one.`) },
      ],
      refs: ['okamoto1998'],
    },
    {
      id: 'tlc', fam: 'sep', abbr: 'TLC', name: T(`薄层色谱`, `Thin-layer chromatography`),
      one: T(`在一块涂了硅胶的板子底端点上样品，把板子立在浅浅一层溶剂里，溶剂靠毛细作用往上爬，把各组分带到不同的高度。五分钟出结果，几乎没有成本，是有机合成实验室里用得最多的分析方法：反应完没完，柱层析用什么溶剂，都先点一块板。`, `A sample is spotted near the bottom of a plate coated with silica gel and the plate stood in a shallow layer of solvent, which climbs by capillary action and carries each component to a different height. With an answer in five minutes at almost no cost, it is the most used analytical method in the synthetic laboratory: whether a reaction is finished and which solvent to use for a column are both settled on a plate first.`),
      how: [
        T(`硅胶表面是极性的硅羟基，极性越强的化合物被吸得越牢，走得越慢；展开剂的极性越强，把化合物从硅胶上顶下来的能力越强，所有的点都走得更远。比移值 R_f = 斑点走的距离 / 溶剂前沿走的距离，在 0 和 1 之间。调展开剂的配比（最常用的是石油醚或己烷配乙酸乙酯）让目标化合物的 R_f 落在 0.2–0.4，这个配比就可以直接搬到硅胶柱上去。`, `The surface of silica gel consists of polar silanols: the more polar a compound, the more firmly it is held and the more slowly it moves; the more polar the eluent, the better it displaces compounds from the silica and the further every spot travels. The retardation factor R_f = distance moved by the spot / distance moved by the solvent front lies between 0 and 1. The solvent ratio (most often petroleum ether or hexane with ethyl acetate) is tuned until the target has an R_f of 0.2–0.4, and that mixture transfers directly to a silica column.`),
        T(`大多数化合物没有颜色，要显色。商品板里掺了在 254 nm 下发绿色荧光的指示剂，有紫外吸收的化合物挡住激发光，显出暗斑。没有紫外吸收的用显色剂：高锰酸钾（能被氧化的基团，黄斑紫底）、茚三酮（胺和氨基酸，紫色）、磷钼酸和茴香醛（通用，加热后显色）、碘蒸气（多数有机物，棕色）。`, `Most compounds are colourless and must be visualised. Commercial plates contain an indicator that fluoresces green at 254 nm, and compounds absorbing ultraviolet light block the excitation and show as dark spots. Those without UV absorption need a stain: potassium permanganate (oxidisable groups, yellow on purple), ninhydrin (amines and amino acids, purple), phosphomolybdic acid and anisaldehyde (general, after heating), iodine vapour (most organics, brown).`),
      ],
      axes: T(`一块板：下面是点样线，上面是溶剂前沿，每个样品一条泳道，每个组分一个斑点。`, `A plate: the baseline at the bottom, the solvent front at the top, one lane per sample and one spot per component.`),
      tells: [
        T(`反应进行到哪里了：原料点消失没有，出了几个新点。`, `How far a reaction has gone: whether the starting-material spot has disappeared and how many new spots have appeared.`),
        T(`柱层析用什么溶剂、哪些馏分含有产物、产物纯不纯（只有一个点是必要条件，不是充分条件）。`, `Which solvent to use for a column, which fractions contain the product, and whether the product is pure (a single spot is necessary, not sufficient).`),
        T(`中药材和食品添加剂的指纹鉴别（高效薄层色谱配扫描定量，药典收录）。`, `Fingerprint identification of herbal drugs and food additives (high-performance TLC with densitometry, as in the pharmacopoeias).`),
      ],
      sample: T(`用毛细管点 1–2 mm 的小点，浓度约 1 %。点太浓会拖尾。`, `Spots of 1–2 mm applied with a capillary from a solution of about 1 %. Overloaded spots streak.`),
      nums: [
        [T(`适合上柱的 R_f`, `R_f suitable for a column`), T(`0.2–0.4`, `0.2–0.4`)],
        [T(`R_f 和柱体积的关系`, `R_f and column volumes`), T(`化合物大约在 1 / R_f 个柱体积时流出`, `A compound elutes after about 1 / R_f column volumes`)],
        [T(`荧光指示剂`, `Fluorescent indicator`), T(`F₂₅₄：254 nm 激发`, `F₂₅₄: excited at 254 nm`)],
      ],
      read: [
        T(`监测反应时点三条道：原料、原料加反应液的混合点、反应液。混合点那一道能看出产物和原料是真的分开了，还是 R_f 恰好相近。`, `To monitor a reaction use three lanes: starting material, a co-spot of starting material and reaction mixture, and the reaction mixture. The co-spot shows whether product and starting material are truly separate or merely close in R_f.`),
        T(`胺在硅胶上拖尾，展开剂里加 1 % 三乙胺；羧酸拖尾，加 1 % 乙酸。`, `Amines streak on silica: add 1 % triethylamine to the eluent; carboxylic acids streak: add 1 % acetic acid.`),
      ],
      traps: [
        T(`R_f 的重复性不好：受硅胶活度、空气湿度、展开缸是否饱和、点样量影响。比较两个样品一定要点在同一块板上。`, `R_f values reproduce poorly: silica activity, humidity, chamber saturation and loading all matter. Two samples are compared only on the same plate.`),
        T(`只有一个点不等于纯：两个化合物可能在这个展开剂里 R_f 相同，换一种溶剂体系再看；不显色的杂质也看不见。`, `One spot does not mean pure: two compounds may share an R_f in this eluent, so check in another solvent system; impurities that do not stain stay invisible.`),
      ],
      figs: [
        { gen: 'tlc', cap: T(`示意：监测反应的一块薄层板。左道是原料（R_f 0.55），中间是混合点，右道是反应液：产物极性更大，R_f 0.30，原料点已经很淡，另有一个停在原点附近的副产物。`, `Schematic: a TLC plate monitoring a reaction. Left lane, starting material (R_f 0.55); middle, the co-spot; right, the reaction mixture: the more polar product at R_f 0.30, only a faint spot of starting material left, and a by-product near the baseline.`) },
      ],
      refs: ['martin1941'],
    },
    {
      id: 'twodlc', fam: 'sep', abbr: 'GC×GC · LC×LC', name: T(`全二维色谱`, `Comprehensive two-dimensional chromatography`),
      one: T(`一根柱子最多分开几百个峰，而柴油、烟草烟气、代谢组里有上万种成分。全二维色谱把第一根柱子的流出物每隔几秒切一段，送到分离机理不同的第二根柱子上再分一次，峰容量变成两根柱子的乘积。`, `One column resolves a few hundred peaks at most, while diesel, tobacco smoke or a metabolome contains more than ten thousand components. Comprehensive two-dimensional chromatography cuts the effluent of the first column into slices every few seconds and separates each again on a second column with a different mechanism, multiplying the peak capacities of the two.`),
      how: [
        T(`GC×GC：第一根是常规的非极性长柱（按沸点分），第二根是 1–2 m 长的极性短柱（按极性分）。两根柱子之间的调制器每 2–8 秒把第一根柱子流出的东西用冷喷气冻住、聚成一个窄带，再突然加热释放到第二根柱子上，在下一个周期开始之前完成快速分离。第二维的峰只有 0.1–0.5 秒宽，所以需要采集很快的检测器（FID 或飞行时间质谱）。聚焦还使峰高提高几倍到几十倍。`, `GC×GC: the first column is a conventional long non-polar one (sorting by boiling point), the second a polar column only 1–2 m long (sorting by polarity). Between them a modulator traps the effluent of the first column every 2–8 seconds with a cold jet, focuses it into a narrow band and releases it by sudden heating onto the second column, where a fast separation finishes before the next cycle begins. Second-dimension peaks are only 0.1–0.5 s wide, calling for a fast detector (FID or time-of-flight mass spectrometry). The focusing also raises peak heights several- to tens-fold.`),
        T(`数据画成二维的等高线图：横轴是第一维保留时间，纵轴是第二维保留时间。同一类化合物在图上排成有规律的条带（同系物沿着一条斜线，烷烃、环烷烃、单环芳烃、双环芳烃各占一条带），所以不用逐个鉴定也能做“族组成分析”。`, `The data are drawn as a two-dimensional contour plot: first-dimension retention time across, second-dimension up. Compounds of one class fall into ordered bands (homologues along a slanting line; alkanes, cycloalkanes, mono-aromatics and di-aromatics each in a band of their own), allowing group-type analysis without identifying every peak.`),
        T(`LC×LC 的思路相同：常见的组合是亲水作用色谱 × 反相、离子交换 × 反相。两维的分离机理越不相关（越“正交”），峰在二维平面上铺得越开。难点在于第一维的流动相对第二维来说可能是很强的洗脱溶剂，要靠稀释或捕集柱解决。`, `LC×LC follows the same idea, commonly pairing hydrophilic interaction with reversed phase, or ion exchange with reversed phase. The less correlated (the more orthogonal) the two mechanisms, the more evenly peaks spread over the plane. The difficulty is that the first-dimension eluent may be a strong solvent for the second dimension, handled by dilution or trapping columns.`),
      ],
      axes: T(`二维图：第一维保留时间（分钟）× 第二维保留时间（秒），颜色表示强度。`, `A two-dimensional map: first-dimension retention time (minutes) × second-dimension retention time (seconds), with colour for intensity.`),
      tells: [
        T(`石油产品的详细烃组成；食品香气、烟气、环境样品里的痕量成分。`, `Detailed hydrocarbon composition of petroleum products; trace components in food aroma, smoke and environmental samples.`),
        T(`被一维色谱上的大峰盖住的小峰；复杂样品之间的差异。`, `Small peaks hidden under large ones in one-dimensional chromatography; differences between complex samples.`),
      ],
      sample: T(`和一维的 GC 或 LC 相同。`, `As for one-dimensional GC or LC.`),
      nums: [
        [T(`峰容量`, `Peak capacity`), T(`理想情况是两维的乘积：500 × 20 = 10000`, `Ideally the product of the two dimensions: 500 × 20 = 10000`)],
        [T(`调制周期`, `Modulation period`), T(`GC×GC 2–8 s，LC×LC 20–60 s`, `2–8 s in GC×GC, 20–60 s in LC×LC`)],
        [T(`每个一维峰应被切的次数`, `Slices per first-dimension peak`), T(`至少 3–4 次`, `At least 3–4`)],
      ],
      read: [
        T(`先认出各类化合物的条带，再看条带里的同系物序列；偏离条带的孤立斑点往往是值得注意的东西。`, `Recognise the bands of each compound class, then the homologous series within them; isolated spots off the bands are often the interesting ones.`),
      ],
      traps: [
        T(`第二维保留太强的化合物在一个调制周期里出不来，会“卷绕”到下一个周期，出现在图上错误的高度。`, `Compounds retained too strongly in the second dimension fail to elute within one modulation period and wrap around into the next, appearing at the wrong height.`),
      ],
      figs: [
        { gen: 'gcxgc', cap: T(`示意：一张 GC×GC 图的结构（第一维非极性柱，第二维极性柱）。正构烷烃在最下面排成一行，往上依次是环烷烃、单环芳烃、双环芳烃的条带；每条带里碳数从左到右增加。斑点位置是示意的。`, `Schematic: the structure of a GC×GC plot (non-polar first column, polar second column). n-Alkanes line up along the bottom, with bands of cycloalkanes, mono-aromatics and di-aromatics above them; within each band carbon number increases from left to right. Spot positions are illustrative.`) },
      ],
      refs: ['liu1991'],
    },
  );
})();
