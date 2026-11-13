'use strict';
// 谱图馆 · 其他方法：转动光谱、光散射、γ 能谱、元素分析、气体吸附、量热与结合、旋光、中子。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'microwave', fam: 'other', abbr: 'MW · FTMW · CP-FTMW', name: T(`微波（转动）光谱`, `Microwave (rotational) spectroscopy`),
      one: T(`气相分子的转动是量子化的，转动能级之间的跃迁落在微波和毫米波区。谱线的位置只由分子的转动惯量决定，也就是由原子的质量和它们的空间位置决定，所以它给出的是所有谱学方法里最精确的气相分子结构。星际空间里的两百多种分子，绝大多数是靠转动谱线认出来的。`, `Rotation of gas-phase molecules is quantised, and transitions between rotational levels fall in the microwave and millimetre-wave region. Line positions depend only on the moments of inertia, that is, on atomic masses and their positions in space, so the method yields the most precise gas-phase molecular structures of any spectroscopy. Most of the more than two hundred molecules known in interstellar space were identified by their rotational lines.`),
      how: [
        T(`线形分子的转动能级是 E_J = hB·J(J+1)，转动常数 B = h / (8π²I)，I 是转动惯量。选律 ΔJ = ±1，所以谱线在 2B(J+1) 处，等间隔排列，间隔 2B。一氧化碳的 J = 0 → 1 在 115.271 GHz（波长 2.6 mm），由此得到的键长是 1.128 Å。非线形分子有三个转动常数 A、B、C，谱要复杂得多，但每一种分子、每一种构象、每一种同位素取代物都有自己独一无二的一套谱线。`, `A linear molecule has rotational levels E_J = hB·J(J+1), with rotational constant B = h / (8π²I) and I the moment of inertia. The selection rule ΔJ = ±1 puts lines at 2B(J+1), equally spaced by 2B. The J = 0 → 1 line of carbon monoxide lies at 115.271 GHz (a wavelength of 2.6 mm), which gives a bond length of 1.128 Å. Non-linear molecules have three rotational constants, A, B and C, and far more complicated spectra, but every molecule, every conformer and every isotopologue has a unique set of lines of its own.`),
        T(`分子必须有永久偶极矩才有纯转动谱，强度正比于偶极矩的平方。所以 CO、H₂O、HCN 有，N₂、CO₂、CH₄、苯没有。把分子里的原子逐个换成同位素（常常直接用天然丰度的 ¹³C），转动惯量跟着变，由此可以逐个算出每个原子在分子里的坐标（Kraitchman 方程），键长准到 0.001 Å。加电场时谱线分裂（Stark 效应），由此测出偶极矩。`, `A molecule needs a permanent dipole moment to have a pure rotational spectrum, with intensity proportional to the square of the dipole. CO, H₂O and HCN qualify; N₂, CO₂, CH₄ and benzene do not. Substituting the atoms one at a time by isotopes (often simply ¹³C at natural abundance) changes the moments of inertia, from which the coordinates of each atom follow (Kraitchman's equations), with bond lengths good to 0.001 Å. An electric field splits the lines (the Stark effect), which gives the dipole moment.`),
        T(`现代的仪器是啁啾脉冲傅里叶变换微波谱仪：一个微秒长的扫频微波脉冲一次激发十几吉赫宽的所有跃迁，然后记录分子自由感应衰减的信号，做傅里叶变换（和脉冲核磁共振是一个思路）。样品经超声射流膨胀冷到约 2 K，分子都落在最低的几个转动能级，谱线只有几千赫宽。复杂混合物不用分离，各组分各有各的谱线；利用三波混频还能区分对映体。`, `The modern instrument is the chirped-pulse Fourier-transform microwave spectrometer: a microsecond frequency-swept pulse excites every transition across more than ten gigahertz at once, and the free induction decay of the molecules is then recorded and Fourier-transformed (the idea of pulsed NMR). A supersonic expansion cools the sample to about 2 K, where molecules occupy only the lowest rotational levels and lines are a few kilohertz wide. Complex mixtures need no separation, since each component has its own lines, and three-wave mixing even distinguishes enantiomers.`),
      ],
      axes: T(`横轴是频率（GHz 或 MHz），纵轴是强度。谱线极窄，一张宽带谱上可以有上千条分得开的线。`, `Frequency (GHz or MHz) against intensity. Lines are extremely narrow, and a broadband spectrum can hold over a thousand resolved lines.`),
      tells: [
        T(`气相分子精确的键长、键角和构象；弱结合的复合物（水合物、氢键二聚体）的结构。`, `Precise bond lengths, angles and conformations of gas-phase molecules; the structures of weakly bound complexes (hydrates, hydrogen-bonded dimers).`),
        T(`偶极矩、核四极耦合常数、内转动势垒。`, `Dipole moments, nuclear quadrupole coupling constants, barriers to internal rotation.`),
        T(`星际云、彗星和行星大气里有哪些分子；地球大气里痕量气体的遥感。`, `Which molecules are present in interstellar clouds, comets and planetary atmospheres; remote sensing of trace gases in Earth's atmosphere.`),
      ],
      sample: T(`气体，或者能加热气化的液体和固体（难挥发的用激光烧蚀），和氖或氩混合后经脉冲喷嘴膨胀进真空腔。每次脉冲只消耗纳摩尔量级的样品。`, `A gas, or a liquid or solid that can be vaporised by heating (laser ablation for involatile ones), mixed with neon or argon and expanded through a pulsed nozzle into a vacuum chamber. Each pulse consumes nanomoles of sample.`),
      nums: [
        [T(`CO 的 J = 0 → 1`, `J = 0 → 1 of CO`), T(`115.271 GHz（B₀ = 57.636 GHz）`, `115.271 GHz (B₀ = 57.636 GHz)`)],
        [T(`氨的反演跃迁`, `Inversion transition of ammonia`), T(`约 23.87 GHz（波长 1.25 cm），1934 年测到，第一条微波谱线，后来是第一台微波激射器的工作跃迁`, `About 23.87 GHz (a wavelength of 1.25 cm); measured in 1934 as the first microwave line and later the working transition of the first maser`)],
        [T(`啁啾脉冲谱仪的带宽`, `Bandwidth of a chirped-pulse spectrometer`), T(`一次 10 GHz 以上`, `More than 10 GHz in one shot`)],
        [T(`星际和星周分子`, `Interstellar and circumstellar molecules`), T(`截至 2021 年的普查有 241 种`, `241 species in the 2021 census`)],
      ],
      read: [
        T(`先找有规律的线系：线形和对称陀螺分子的线近似等间隔（间隔 2B）。然后用量子化学算出的转动常数做初值去拟合，实测和计算的转动常数通常相差不到 1 %，足以分清不同的构象。`, `Look for regular series first: lines of linear and symmetric-top molecules are nearly equally spaced (by 2B). Then fit starting from quantum-chemically computed rotational constants; measured and computed constants usually agree within 1 %, enough to tell conformers apart.`),
      ],
      traps: [
        T(`没有偶极矩的分子完全看不见，偶极矩小的分子信号很弱：谱上线的强弱不直接等于含量的多少。`, `Molecules without a dipole moment are invisible and those with small dipoles weak: line strengths do not translate directly into abundance.`),
        T(`射流里只看到冷却后剩下的最稳定的几种构象，能垒低的高能构象在膨胀过程中已经弛豫掉了。`, `A jet shows only the few most stable conformers that survive cooling; higher-energy conformers behind low barriers relax away during the expansion.`),
      ],
      figs: [
        { gen: 'rotational', args: { mol: '12C16O', unit: 'GHz' }, cap: T(`由实测光谱常数算出：一氧化碳的纯转动线。J = 0 → 1 在 115.271 GHz，1 → 2 在 230.538 GHz，2 → 3 在 345.796 GHz；这三条线是射电天文观测分子云最常用的。温度越低，最强的线越靠近低 J。`, `From measured constants: the pure rotational lines of carbon monoxide. J = 0 → 1 lies at 115.271 GHz, 1 → 2 at 230.538 GHz and 2 → 3 at 345.796 GHz, the three lines most used by radio astronomy to observe molecular clouds. The lower the temperature, the lower the J of the strongest line.`) },
      ],
      see: [['#m-rovib', T(`转振光谱：红外里的转动结构`, `Rovibrational spectra: rotational structure in the infrared`)], ['#lab-rovib', T(`动手实验室：双原子分子`, `Hands-on lab: diatomic molecules`)]],
      refs: ['cleeton1934', 'brown2008', 'patterson2013', 'mcguire2022'],
    },
    {
      id: 'dls', fam: 'other', abbr: 'DLS · ELS · ζ', name: T(`动态光散射与 Zeta 电位`, `Dynamic light scattering and zeta potential`),
      one: T(`溶液里的颗粒做布朗运动，小的跑得快，大的跑得慢。用激光照它们，散射光的强度会因为颗粒位置的变化而闪烁；闪烁得越快，颗粒越小。从闪烁的时间尺度算出扩散系数，再用 Stokes–Einstein 方程换算成流体力学直径。一分钟出结果，1 nm 到几微米都能测。`, `Particles in solution undergo Brownian motion, small ones quickly and large ones slowly. Under laser illumination the scattered intensity flickers as the particles move, and the faster the flicker, the smaller the particles. The time scale of the flicker gives the diffusion coefficient, which the Stokes–Einstein equation converts to a hydrodynamic diameter. A result takes a minute, for sizes from 1 nm to a few micrometres.`),
      how: [
        T(`仪器计算散射光强度的自相关函数：g₂(τ) = ⟨I(t)·I(t+τ)⟩ / ⟨I⟩²。对大小均一的颗粒，它按指数衰减：g₂(τ) = 1 + β·exp(−2Γτ)，衰减率 Γ = D·q²，散射矢量 q = (4πn / λ)·sin(θ/2)。扩散系数 D 再由 Stokes–Einstein 方程换成流体力学半径：R_h = k_BT / (6πηD)。半径 50 nm 的颗粒在 25 °C 的水里 D = 4.9 × 10⁻¹² m²/s，用 633 nm 激光在 173° 测，自相关函数的衰减时间约 0.15 毫秒。`, `The instrument computes the autocorrelation function of the scattered intensity, g₂(τ) = ⟨I(t)·I(t+τ)⟩ / ⟨I⟩². For particles of one size it decays exponentially: g₂(τ) = 1 + β·exp(−2Γτ), with decay rate Γ = D·q² and scattering vector q = (4πn / λ)·sin(θ/2). The Stokes–Einstein equation converts the diffusion coefficient D to a hydrodynamic radius, R_h = k_BT / (6πηD). A particle of 50 nm radius in water at 25 °C has D = 4.9 × 10⁻¹² m²/s and, measured at 173° with a 633 nm laser, an autocorrelation decay time of about 0.15 milliseconds.`),
        T(`样品有粒径分布时，自相关函数是许多指数的叠加。累积量法把 ln[g₂ − 1] 展开成 τ 的多项式：一次项给出按散射强度加权的平均粒径（Z 均粒径），二次项给出多分散指数 PDI。PDI 小于 0.1 可以看作单分散，大于 0.5 说明分布很宽，这时 Z 均粒径已经没有多少意义。把自相关函数反演成粒径分布是一个病态问题，结果依赖算法，两个峰至少要差 3–5 倍才分得开。`, `For a distribution of sizes the autocorrelation function is a sum of many exponentials. The cumulant method expands ln[g₂ − 1] as a polynomial in τ: the linear term gives the intensity-weighted mean size (the Z-average) and the quadratic term the polydispersity index, PDI. A PDI below 0.1 counts as monodisperse; above 0.5 the distribution is so broad that the Z-average means little. Inverting the autocorrelation function into a size distribution is an ill-posed problem whose result depends on the algorithm, and two populations must differ by a factor of at least 3–5 to be resolved.`),
        T(`电泳光散射测 Zeta 电位：加上电场，带电颗粒泳动，散射光发生多普勒频移，由此得到电泳迁移率，再换算成滑动面上的电位 ζ。|ζ| 大于约 30 mV 时颗粒之间的静电排斥足以让胶体稳定；接近零时容易聚集。ζ 随 pH 变化，穿过零的那一点是等电点。`, `Electrophoretic light scattering measures zeta potential: in an applied field charged particles migrate, the scattered light is Doppler-shifted, the shift gives the electrophoretic mobility, and that converts to the potential ζ at the slipping plane. With |ζ| above about 30 mV, electrostatic repulsion keeps a colloid stable; near zero it aggregates readily. ζ varies with pH and crosses zero at the isoelectric point.`),
      ],
      axes: T(`原始数据：延迟时间 τ（对数）对自相关函数。结果：粒径（nm，对数）对强度百分比的分布图，加上 Z 均粒径和 PDI 两个数。`, `Raw data: delay time τ (logarithmic) against the autocorrelation function. Result: a distribution of intensity percentage against size (nm, logarithmic), together with two numbers, Z-average and PDI.`),
      tells: [
        T(`纳米颗粒、脂质体、胶束、聚合物、蛋白质在溶液里的流体力学尺寸，以及有没有聚集。`, `Hydrodynamic sizes of nanoparticles, liposomes, micelles, polymers and proteins in solution, and whether they aggregate.`),
        T(`胶体稳定性（Zeta 电位）、等电点、表面修饰是否成功（修饰前后 ζ 的变化）。`, `Colloidal stability (zeta potential), isoelectric point, and the success of surface modification (the change in ζ on modification).`),
      ],
      sample: T(`透明的稀溶液或分散液，约 1 mL（微量池几十微升）。必须先过滤或离心除掉灰尘。浓度要低到没有多重散射、颗粒之间没有相互作用。要知道溶剂的粘度和折射率。`, `A clear dilute solution or dispersion of about 1 mL (tens of microlitres in a micro-cell). Dust must be removed by filtration or centrifugation. The concentration must be low enough to avoid multiple scattering and interparticle interaction. Solvent viscosity and refractive index must be known.`),
      nums: [
        [T(`Stokes–Einstein`, `Stokes–Einstein`), T(`R_h = k_BT / (6πηD)`, `R_h = k_BT / (6πηD)`)],
        [T(`散射强度`, `Scattered intensity`), T(`正比于半径的六次方（Rayleigh 散射）`, `Proportional to the sixth power of the radius (Rayleigh scattering)`)],
        [T(`多分散指数`, `Polydispersity index`), T(`< 0.1 单分散；0.1–0.3 中等；> 0.5 很宽`, `< 0.1 monodisperse; 0.1–0.3 moderate; > 0.5 very broad`)],
        [T(`胶体稳定的经验界限`, `Rule of thumb for colloidal stability`), T(`|ζ| > 30 mV`, `|ζ| > 30 mV`)],
      ],
      read: [
        T(`先看自相关函数本身：衰减平滑、基线回到 1，数据才可信；尾巴上的抖动或二次衰减说明有灰尘或大的聚集体。`, `Look at the autocorrelation function itself first: only a smooth decay returning to a baseline of 1 is trustworthy; noise in the tail or a second decay means dust or large aggregates.`),
        T(`报告 Z 均粒径和 PDI，并说明分布是按强度、体积还是数量加权的。`, `Report Z-average and PDI, and state whether a distribution is weighted by intensity, volume or number.`),
      ],
      traps: [
        T(`散射强度正比于半径的六次方：一个 100 nm 的颗粒的散射抵得上一百万个 10 nm 的颗粒。极少量的聚集体或灰尘就能主导结果，强度分布图上的“大颗粒峰”在数量上可能微不足道。`, `Scattered intensity scales with the sixth power of the radius: one 100 nm particle scatters like a million 10 nm ones. Traces of aggregates or dust can dominate the result, and a "large-particle peak" in the intensity distribution may be negligible by number.`),
        T(`流体力学直径包括颗粒表面的配体和带着一起运动的溶剂层，所以总比电镜下看到的核的尺寸大。它还假设颗粒是球；棒状、片状颗粒得到的是一个等效值。`, `The hydrodynamic diameter includes surface ligands and the solvent layer dragged along, and so always exceeds the core size seen by electron microscopy. It assumes a sphere as well; rods and plates give an equivalent value only.`),
        T(`Zeta 电位不是表面电位，它强烈依赖 pH 和离子强度；不写明介质的 ζ 值没有意义。`, `Zeta potential is not surface potential and depends strongly on pH and ionic strength; a ζ value without its medium is meaningless.`),
      ],
      figs: [
        { gen: 'dls', cap: T(`由 Stokes–Einstein 方程算出：水里（25 °C，633 nm，173°）单分散颗粒的自相关函数。拖动半径，曲线沿对数时间轴平移：半径大十倍，衰减慢十倍。再加入少量大颗粒，看它们怎样在长时间一侧拖出一条尾巴，并把按强度加权的平均粒径拉大。`, `From the Stokes–Einstein equation: the autocorrelation function of monodisperse particles in water (25 °C, 633 nm, 173°). Vary the radius and the curve slides along the logarithmic time axis: ten times the radius, ten times slower decay. Add a small fraction of large particles and see the tail they produce at long times and how they inflate the intensity-weighted mean size.`) },
      ],
      see: [['#m-saxs', T(`小角 X 射线散射`, `Small-angle X-ray scattering`)], ['#m-sec', T(`体积排阻色谱`, `Size-exclusion chromatography`)]],
      refs: ['stetefeld2016'],
    },
    {
      id: 'gamma', fam: 'other', abbr: 'γ · NAA', name: T(`γ 能谱与中子活化分析`, `Gamma-ray spectroscopy and neutron activation analysis`),
      one: T(`放射性原子核衰变后放出能量确定的 γ 光子，每种核素有自己的一组能量。用探测器把每个光子的能量量出来并统计成谱，就能认出样品里有哪些放射性核素、各有多少。环境放射性监测、核医学、核安保都靠它；先用中子把稳定元素变成放射性的再测，就是灵敏度极高的中子活化分析。`, `After radioactive decay a nucleus emits γ photons of definite energy, a set characteristic of each nuclide. Measuring the energy of every photon and histogramming them identifies the radionuclides in a sample and their amounts. Environmental monitoring, nuclear medicine and nuclear security rely on it; activating stable elements with neutrons first makes it neutron activation analysis, of extreme sensitivity.`),
      how: [
        T(`γ 光子在探测器里通过三种方式损失能量。光电效应：全部能量交给一个电子，贡献谱上的全能峰（光电峰），这是用来认核素的峰。Compton 散射：光子只把一部分能量交给电子就跑出探测器，留下的能量从零连续分布到一个上限，叫 Compton 边：E_边 = E·2ε / (1 + 2ε)，ε = E / 511 keV。电子对效应：能量超过 1022 keV 的光子变成一对正负电子，正电子湮没时放出两个 511 keV 的光子，跑掉一个或两个，就在全能峰下方 511 和 1022 keV 处出现逃逸峰。`, `A γ photon loses energy in the detector in three ways. Photoelectric absorption: all its energy goes to one electron, giving the full-energy peak (photopeak) by which nuclides are identified. Compton scattering: the photon gives up part of its energy to an electron and escapes, leaving a continuous distribution from zero up to a limit, the Compton edge, E_edge = E·2ε / (1 + 2ε) with ε = E / 511 keV. Pair production: a photon above 1022 keV becomes an electron–positron pair, the positron annihilates into two photons of 511 keV, and if one or both escape, escape peaks appear 511 and 1022 keV below the full-energy peak.`),
        T(`铯-137 是最常用的例子：它（经过钡-137m）发出 661.7 keV 的 γ 射线。谱上除了 662 keV 的全能峰，还有 477 keV 的 Compton 边、它下面的连续平台、184 keV 附近的反散射峰（光子先在探测器周围的材料上散射了 180° 再进来）和 32 keV 的钡 K 系 X 射线。`, `Caesium-137 is the commonest example: it emits (through barium-137m) a γ ray of 661.7 keV. Besides the full-energy peak at 662 keV the spectrum shows the Compton edge at 477 keV, the continuum below it, a backscatter peak near 184 keV (photons scattered through 180° in surrounding material before entering) and barium K X-rays at 32 keV.`),
        T(`两类探测器。碘化钠闪烁体：效率高、便宜、室温工作，但分辨率只有约 7 %（662 keV 处的峰宽约 45 keV），相邻的峰分不开。高纯锗半导体：分辨率约 0.2 %（峰宽 1–2 keV），几十种核素的上百条线都能分开，但要用液氮或电制冷降到约 77 K。中子活化分析：把样品放进反应堆照射，稳定核俘获中子变成放射性核，测它们衰变时的 γ 射线；不破坏样品，几十种元素同时测，许多元素的检出限到 ng/g 以下。`, `There are two kinds of detector. Sodium iodide scintillators: efficient, inexpensive and operating at room temperature, but with a resolution of only about 7 % (a peak about 45 keV wide at 662 keV), unable to separate neighbouring peaks. High-purity germanium semiconductors: a resolution of about 0.2 % (peaks 1–2 keV wide) that separates hundreds of lines from dozens of nuclides, but requiring cooling to about 77 K with liquid nitrogen or a cryocooler. Neutron activation analysis: the sample is irradiated in a reactor, stable nuclei capture neutrons and become radioactive, and the γ rays of their decay are measured; non-destructive, with dozens of elements at once and detection limits below ng/g for many.`),
      ],
      axes: T(`横轴是光子能量（keV），纵轴是计数（常用对数）。`, `Photon energy (keV) against counts (often logarithmic).`),
      tells: [
        T(`样品里有哪些放射性核素、活度多少：土壤和食品里的铯-137、铯-134、碘-131，建材里的镭、钍、钾-40。`, `Which radionuclides a sample contains and their activities: caesium-137, caesium-134 and iodine-131 in soil and food; radium, thorium and potassium-40 in building materials.`),
        T(`沉积物的年代（铅-210、铯-137 定年）；核材料的同位素组成；考古和地质样品里几十种痕量元素（中子活化）。`, `Sediment ages (lead-210 and caesium-137 dating); the isotopic composition of nuclear material; dozens of trace elements in archaeological and geological samples (neutron activation).`),
      ],
      sample: T(`任何状态，不用化学处理，装在形状固定的容器里（几何条件要和效率刻度时一样）。探测器放在铅室里屏蔽本底。低活度样品要测几小时到几天。`, `Any state, without chemical treatment, in a container of fixed geometry (identical to that of the efficiency calibration). The detector sits inside a lead shield against background. Low-activity samples are counted for hours to days.`),
      nums: [
        [T(`铯-137`, `Caesium-137`), T(`661.7 keV；半衰期 30.1 年；Compton 边 477.3 keV，反散射峰 184.3 keV`, `661.7 keV; half-life 30.1 years; Compton edge 477.3 keV, backscatter peak 184.3 keV`)],
        [T(`钴-60`, `Cobalt-60`), T(`1173.2 和 1332.5 keV；半衰期 5.27 年`, `1173.2 and 1332.5 keV; half-life 5.27 years`)],
        [T(`钾-40（天然本底）`, `Potassium-40 (natural background)`), T(`1460.8 keV；半衰期 12.5 亿年`, `1460.8 keV; half-life 1.25 billion years`)],
        [T(`正电子湮没`, `Positron annihilation`), T(`511.0 keV`, `511.0 keV`)],
        [T(`分辨率（662 keV）`, `Resolution (at 662 keV)`), T(`碘化钠约 7 %，高纯锗约 0.2 %`, `About 7 % for sodium iodide, about 0.2 % for high-purity germanium`)],
      ],
      read: [
        T(`只有全能峰用来认核素和定量。先把 Compton 边、反散射峰、逃逸峰、和峰（两个光子同时到达）、屏蔽铅的 X 射线（72–88 keV）这些“仪器造出来的”特征认出来，别把它们当成核素。`, `Only full-energy peaks identify and quantify nuclides. First recognise the features made by the instrument (Compton edges, backscatter peaks, escape peaks, sum peaks from two photons arriving together, lead X-rays at 72–88 keV from the shield) so as not to mistake them for nuclides.`),
        T(`一种核素常有几条线，它们的强度比是固定的；每条线都要对上才算认准。`, `A nuclide often has several lines of fixed intensity ratios; all must match for a firm identification.`),
      ],
      traps: [
        T(`峰面积到活度的换算依赖探测效率，而效率随能量、样品形状、密度和到探测器的距离变化。效率刻度必须用和样品同样几何、相近密度的标准源。`, `Converting peak area to activity depends on detection efficiency, which varies with energy, sample shape, density and distance from the detector. Efficiency must be calibrated with standards of the same geometry and similar density.`),
        T(`本底里永远有钾-40 和铀、钍衰变系的线。弱的样品要减去同样时间测的空白本底。`, `The background always contains lines of potassium-40 and of the uranium and thorium decay series. Weak samples need subtraction of a blank counted for the same time.`),
      ],
      figs: [
        { gen: 'gamma', cap: T(`模型计算：铯-137 的 γ 能谱。全能峰在 661.7 keV；Compton 连续谱的形状按 Klein–Nishina 公式算出，上限是 477.3 keV 的 Compton 边；184 keV 附近的反散射峰和 32 keV 的钡 X 射线的高度是示意的。切换探测器：碘化钠的分辨率约 7 %，高纯锗约 0.2 %，同一个源看上去完全不同。`, `Model calculation: the γ spectrum of caesium-137. The full-energy peak lies at 661.7 keV; the Compton continuum follows the Klein–Nishina formula up to the Compton edge at 477.3 keV; the heights of the backscatter peak near 184 keV and of the barium X-rays at 32 keV are illustrative. Switch detectors: about 7 % resolution for sodium iodide and 0.2 % for high-purity germanium make the same source look entirely different.`) },
      ],
      see: [['#m-xrf', T(`X 射线荧光`, `X-ray fluorescence`)], ['#m-mossbauer', T(`穆斯堡尔谱：无反冲的 γ 共振吸收`, `Mössbauer spectroscopy: recoil-free γ resonance absorption`)]],
      refs: ['compton1923', 'klein1929'],
    },
    {
      id: 'chn', fam: 'other', core: true, abbr: 'CHNS · EA', name: T(`元素分析（燃烧法）`, `Elemental analysis by combustion`),
      one: T(`把一两毫克样品在纯氧里瞬间烧尽，碳变成 CO₂、氢变成 H₂O、氮变成 N₂、硫变成 SO₂，分开后逐个测量，算出样品里碳、氢、氮、硫的质量百分数。它不告诉你结构，但它是对整批样品纯度最直接的检验：实测值和按分子式算出的值相差在 0.4 个百分点以内，是化学期刊对新化合物的传统要求。`, `One or two milligrams of sample are burnt instantly in pure oxygen: carbon becomes CO₂, hydrogen H₂O, nitrogen N₂ and sulfur SO₂, which are separated and measured one by one to give the mass percentages of carbon, hydrogen, nitrogen and sulfur. It says nothing about structure, but it is the most direct test of the purity of the bulk sample: agreement within 0.4 percentage points between found and calculated values is the traditional requirement of chemistry journals for new compounds.`),
      how: [
        T(`样品包在锡箔小舟里，落进约 1000 °C 的燃烧管，同时通入一股氧气；锡的燃烧放热把局部温度瞬间推到约 1800 °C，保证完全燃烧。生成的气体由氦气带着，先经过氧化催化剂，再经过约 650 °C 的铜，把氮氧化物还原成 N₂、把多余的氧吸收掉。最后 N₂、CO₂、H₂O、SO₂ 经气相色谱柱分开，用热导检测器测量。仪器每天用纯度已知的标准物（常用乙酰苯胺：C 71.09 %，H 6.71 %，N 10.36 %）标定。`, `The sample, wrapped in a tin capsule, drops into a combustion tube at about 1000 °C together with a pulse of oxygen; the exothermic burning of tin raises the local temperature briefly to about 1800 °C and ensures complete combustion. Carried by helium, the gases pass an oxidation catalyst and then copper at about 650 °C, which reduces nitrogen oxides to N₂ and removes excess oxygen. Finally N₂, CO₂, H₂O and SO₂ are separated on a gas chromatography column and measured by thermal conductivity. The instrument is calibrated daily with a standard of known purity (commonly acetanilide: C 71.09 %, H 6.71 %, N 10.36 %).`),
        T(`理论值由分子式算：某元素的质量百分数 = 原子数 × 原子量 / 摩尔质量 × 100。咖啡因 C₈H₁₀N₄O₂（摩尔质量 194.19）：C 49.48 %，H 5.19 %，N 28.85 %。氧通常不直接测，用差减得到；要直接测的话，把样品在约 1100 °C 的碳上热解，氧全部变成 CO 再测。`, `Calculated values follow from the formula: mass percentage of an element = number of atoms × atomic mass / molar mass × 100. For caffeine, C₈H₁₀N₄O₂ (molar mass 194.19): C 49.48 %, H 5.19 %, N 28.85 %. Oxygen is usually obtained by difference; to measure it directly the sample is pyrolysed over carbon at about 1100 °C, which converts all oxygen to CO.`),
      ],
      axes: T(`结果不是一张谱，是三四个数：C、H、N（、S）的质量百分数，和理论值并排列出。`, `The result is not a spectrum but three or four numbers: the mass percentages of C, H, N (and S), listed beside the calculated values.`),
      tells: [
        T(`整批样品的组成和分子式是否相符，也就是纯不纯。核磁和质谱看不见的无机盐、硅胶、水，在这里都会让碳的百分数偏低。`, `Whether the composition of the bulk sample matches the formula, that is, whether it is pure. Inorganic salts, silica gel and water, invisible to NMR and mass spectrometry, all lower the carbon percentage here.`),
        T(`配合物、MOF、聚合物、煤和生物质的碳氢氮含量；土壤的有机碳和总氮；蛋白质含量（Dumas 定氮法）。`, `Carbon, hydrogen and nitrogen contents of complexes, MOFs, polymers, coal and biomass; organic carbon and total nitrogen of soil; protein content (the Dumas nitrogen method).`),
      ],
      sample: T(`1–3 mg，用微量天平称到 0.001 mg。样品必须均匀、彻底干燥：这么小的称样量，一点残留溶剂就足以让结果超差。对空气敏感的样品要在手套箱里封进锡舟。`, `1–3 mg weighed to 0.001 mg on a microbalance. The sample must be homogeneous and thoroughly dry: at this scale a little residual solvent puts the result out of tolerance. Air-sensitive samples are sealed into tin capsules in a glovebox.`),
      nums: [
        [T(`期刊的传统要求`, `Traditional journal requirement`), T(`实测值与理论值相差不超过 ±0.4 个百分点`, `Found within ±0.4 percentage points of calculated`)],
        [T(`乙酰苯胺（标定）`, `Acetanilide (calibration)`), T(`C 71.09 %，H 6.71 %，N 10.36 %`, `C 71.09 %, H 6.71 %, N 10.36 %`)],
        [T(`咖啡因 C₈H₁₀N₄O₂`, `Caffeine, C₈H₁₀N₄O₂`), T(`C 49.48 %，H 5.19 %，N 28.85 %`, `C 49.48 %, H 5.19 %, N 28.85 %`)],
      ],
      read: [
        T(`三个数都要在容差之内。只有碳偏低、氢正常或偏高，通常是含水或含溶剂；三个都按比例偏低，是混进了不含 C、H、N 的东西（无机盐、硅胶）。`, `All three numbers must be within tolerance. Low carbon with normal or high hydrogen usually means water or solvent; all three low in proportion means something free of C, H and N has been mixed in (inorganic salts, silica gel).`),
      ],
      traps: [
        T(`往分子式里加“0.5 H₂O”或“0.3 CH₂Cl₂”去凑实测值，只有在别的证据（核磁上的溶剂峰、热重的失重台阶、晶体结构）也支持时才成立；否则只是在调参数。`, `Adding "0.5 H₂O" or "0.3 CH₂Cl₂" to the formula to match the found values is legitimate only when other evidence (solvent signals in NMR, a thermogravimetric step, a crystal structure) supports it; otherwise it is parameter fitting.`),
        T(`±0.4 % 这条线本身也受到质疑：2022 年的一项国际比对把同一批纯化合物送到多家独立的分析实验室，返回结果的波动超出了这个容差。一次超差不一定是样品不纯，一次合格也不是纯度的证明。`, `The ±0.4 % criterion is itself questioned: an international study in 2022 sent the same pure compounds to several independent service laboratories and found variation beyond this tolerance. One result out of tolerance does not prove impurity, and one within it does not prove purity.`),
        T(`含氟、含磷、含硼的化合物和一些金属配合物燃烧不完全，生成稳定的碳化物、碳酸盐或氟化物，碳的结果系统偏低；要加 V₂O₅ 或 WO₃ 助燃。`, `Compounds of fluorine, phosphorus and boron and some metal complexes burn incompletely, forming stable carbides, carbonates or fluorides, and carbon reads systematically low; V₂O₅ or WO₃ is added as combustion aid.`),
      ],
      figs: [
        { gen: 'chn', args: { formula: 'C8H10N4O2' }, cap: T(`由原子量算出：输入分子式，得到 C、H、N（以及 O、S 等）的理论质量百分数；再填入实测值，看每个元素是否落在 ±0.4 个百分点之内。试试给咖啡因加上 0.5 个水，看三个数各移动多少。`, `From atomic masses: enter a formula to get the calculated mass percentages of C, H and N (and O, S and so on); then enter found values to see whether each element lies within ±0.4 percentage points. Try adding half a water to caffeine and see how far each number moves.`) },
      ],
      see: [['#m-isotope', T(`同位素分布与精确质量：分子式的另一条证据`, `Isotope patterns and exact mass: another line of evidence for a formula`)], ['#m-tga', T(`热重分析：含多少溶剂和水`, `Thermogravimetry: how much solvent and water`)]],
      refs: ['kuveke2022'],
    },
    {
      id: 'bet', fam: 'other', core: true, abbr: 'BET · BJH', name: T(`气体吸附：比表面积与孔径`, `Gas adsorption: surface area and pore size`),
      one: T(`在液氮温度下让氮气一点点吸附到样品上，记下每个压力下吸附了多少，得到一条吸附等温线。从它的低压段算出比表面积（BET 法），从毛细凝聚的位置算出孔径分布。多孔材料（活性炭、沸石、MOF、催化剂载体）的“身份证”就是这条线。`, `At the temperature of liquid nitrogen, nitrogen is adsorbed on the sample step by step and the amount taken up at each pressure recorded, giving an adsorption isotherm. Its low-pressure part yields the specific surface area (the BET method) and the position of capillary condensation the pore-size distribution. For porous materials (activated carbon, zeolites, MOFs, catalyst supports) this curve is the identity card.`),
      how: [
        T(`BET 理论把 Langmuir 的单层吸附推广到多层：第一层以较大的吸附热吸附在表面上，以后各层的吸附热等于液化热。线性形式是 (p/p₀) / [v·(1 − p/p₀)] = 1/(v_m·c) + [(c − 1)/(v_m·c)]·(p/p₀)。在 p/p₀ = 0.05–0.30 之间把左边对 p/p₀ 作图，由斜率和截距得到单层吸附量 v_m 和常数 c。每个氮分子占 0.162 nm²，所以比表面积 S（m²/g）= 4.353 × v_m（cm³ STP/g）。`, `BET theory extends Langmuir's monolayer to multilayers: the first layer adsorbs on the surface with a larger heat of adsorption, and all further layers with the heat of liquefaction. The linear form is (p/p₀) / [v·(1 − p/p₀)] = 1/(v_m·c) + [(c − 1)/(v_m·c)]·(p/p₀). Plotting the left side against p/p₀ between 0.05 and 0.30 gives the monolayer capacity v_m and the constant c from slope and intercept. Each nitrogen molecule occupies 0.162 nm², so the specific surface area is S (m²/g) = 4.353 × v_m (cm³ STP/g).`),
        T(`等温线的形状说明孔的类型（IUPAC 分六类）。I 型：极低压下就急剧上升然后变平，是微孔（小于 2 nm）被填满。II 型：无孔或大孔材料上的多层吸附。IV 型：中孔（2–50 nm）材料，中压段有一个毛细凝聚的台阶，脱附线和吸附线不重合，形成滞后环。孔越窄，凝聚发生的压力越低（Kelvin 方程），BJH 法据此由等温线算出中孔的孔径分布；微孔要用密度泛函理论（NLDFT）的模型。`, `The shape of the isotherm indicates the kind of pores (six IUPAC types). Type I: a steep rise at very low pressure followed by a plateau, the filling of micropores (below 2 nm). Type II: multilayer adsorption on non-porous or macroporous material. Type IV: mesoporous material (2–50 nm), with a step of capillary condensation at intermediate pressure and a hysteresis loop where desorption and adsorption branches differ. The narrower the pore, the lower the pressure of condensation (the Kelvin equation), from which the BJH method computes a mesopore size distribution; micropores need density-functional (NLDFT) models.`),
      ],
      axes: T(`横轴是相对压力 p/p₀（0–1），纵轴是吸附量（cm³ STP/g）。吸附线和脱附线都要画出来。`, `Relative pressure p/p₀ (0–1) against amount adsorbed (cm³ STP/g), with both adsorption and desorption branches shown.`),
      tells: [
        T(`比表面积、总孔体积、微孔体积、孔径分布；孔是狭缝、圆柱还是墨水瓶形（滞后环的形状）。`, `Specific surface area, total pore volume, micropore volume and pore-size distribution; whether pores are slits, cylinders or ink-bottles (from the shape of the hysteresis loop).`),
        T(`MOF 活化得彻不彻底、孔道塌没塌；催化剂烧结、积碳前后表面积的变化。`, `Whether a MOF is fully activated or has collapsed; changes of surface area on sintering or coking of a catalyst.`),
      ],
      sample: T(`50–200 mg（表面积小的要更多），先在真空或流动气体中加热脱气几小时，把孔里的水和溶剂赶干净。脱气温度要低于样品的分解或塌陷温度。一条完整的等温线要测几小时到一天。`, `50–200 mg (more for low surface areas), first degassed by heating for hours under vacuum or flowing gas to clear water and solvent from the pores. The degassing temperature must stay below that of decomposition or collapse. A full isotherm takes hours to a day.`),
      nums: [
        [T(`氮分子的截面积（77 K）`, `Cross-section of the nitrogen molecule (77 K)`), T(`0.162 nm²；S = 4.353 × v_m`, `0.162 nm²; S = 4.353 × v_m`)],
        [T(`BET 的线性范围`, `Linear BET range`), T(`p/p₀ = 0.05–0.30（微孔材料要更低）`, `p/p₀ = 0.05–0.30 (lower for microporous materials)`)],
        [T(`孔的分类`, `Pore classes`), T(`微孔 < 2 nm，中孔 2–50 nm，大孔 > 50 nm`, `Micropores < 2 nm, mesopores 2–50 nm, macropores > 50 nm`)],
        [T(`典型的比表面积`, `Typical surface areas`), T(`硅胶 300–800，沸石 400–900，活性炭 500–3000，MOF 1000–7000 m²/g`, `Silica gel 300–800, zeolites 400–900, activated carbon 500–3000, MOFs 1000–7000 m²/g`)],
      ],
      read: [
        T(`先看等温线属于哪一型，再决定用什么模型；不要一上来就读软件给的“BET 表面积”和“平均孔径”。`, `Decide the type of isotherm first and then the model; do not start from the "BET surface area" and "average pore diameter" the software prints.`),
        T(`BET 图的线性区要满足 Rouquerol 判据：c 是正数，v·(1 − p/p₀) 在所选范围内随 p/p₀ 单调上升，算出的单层点落在所选范围之内。`, `The linear range of a BET plot must meet the Rouquerol criteria: a positive c, v·(1 − p/p₀) increasing monotonically with p/p₀ over the range chosen, and the computed monolayer point lying within that range.`),
      ],
      traps: [
        T(`微孔材料上的“BET 表面积”不是真正的几何表面积：微孔是被整个填满的，不是一层层盖上去的。这个数只能当作一个约定俗成的比较指标，而且选的压力范围不同，同一条等温线可以算出相差百分之几十的值。`, `The "BET surface area" of a microporous material is not a true geometric area: micropores are filled as a volume, not covered layer by layer. The number serves as a conventional figure of comparison only, and different choices of pressure range give values differing by tens of per cent from one isotherm.`),
        T(`氮气的脱附线在 p/p₀ ≈ 0.42 处常常突然闭合，那是液氮在孔里的张力极限造成的，和孔径无关。用脱附线做 BJH 会在 3.8 nm 左右算出一个并不存在的尖峰。`, `The nitrogen desorption branch often closes abruptly near p/p₀ ≈ 0.42, a consequence of the tensile-strength limit of the condensed liquid and unrelated to pore size. BJH analysis of the desorption branch then yields a spurious sharp peak near 3.8 nm.`),
        T(`脱气不够，孔被残留溶剂占着，表面积偏低；脱气太狠，骨架塌了，表面积也偏低。`, `Insufficient degassing leaves pores occupied by solvent and the area low; excessive degassing collapses the framework and the area is low again.`),
      ],
      figs: [
        { gen: 'bet', cap: T(`由 BET 方程算出：多层吸附等温线和它的线性 BET 图。拖动常数 c 和单层吸附量 v_m：c 越大（表面和氮的作用越强），低压处的“膝盖”越尖，单层点越清楚；c 小于约 20 时膝盖消失，单层吸附量就定不准了。BET 方程本身不含毛细凝聚，所以这里没有滞后环。`, `From the BET equation: a multilayer adsorption isotherm and its linear BET plot. Vary the constant c and the monolayer capacity v_m: the larger c (the stronger the interaction of surface and nitrogen), the sharper the knee at low pressure and the clearer the monolayer point; below c of about 20 the knee disappears and the monolayer capacity becomes ill-defined. The BET equation contains no capillary condensation, so there is no hysteresis loop here.`) },
      ],
      see: [['#m-tpd', T(`程序升温脱附：表面位点的强度`, `Temperature-programmed desorption: strength of surface sites`)], ['#m-pxrd', T(`粉末衍射：骨架是否完好`, `Powder diffraction: whether the framework is intact`)]],
      refs: ['brunauer1938', 'barrett1951', 'thommes2015'],
    },
    {
      id: 'itc', fam: 'other', abbr: 'ITC', name: T(`等温滴定量热`, `Isothermal titration calorimetry`),
      one: T(`把配体一滴滴加进装着蛋白质（或任何结合伙伴）的小池里，直接测每一滴放出或吸收的热量。一次实验同时得到结合常数、结合焓和结合的化学计量比，由此算出自由能和熵。它不需要标记、不需要固定，是测溶液里结合热力学最直接的方法。`, `A ligand is injected drop by drop into a small cell holding a protein (or any binding partner) and the heat released or absorbed by each injection is measured directly. One experiment yields the binding constant, the enthalpy of binding and the stoichiometry at once, from which free energy and entropy follow. Needing neither labels nor immobilisation, it is the most direct way to measure the thermodynamics of binding in solution.`),
      how: [
        T(`样品池和参比池保持在同一温度，仪器记录为了维持两池温差为零所需的加热功率。每注射一次，功率曲线上出现一个尖峰，峰面积就是这一滴的热量。开始时池里的结合位点很多，注入的配体几乎全部结合，热量大；随着位点被占满，热量越来越小，最后只剩稀释热。把每一滴的热量对配体与蛋白质的摩尔比作图，得到一条 S 形曲线：台阶的高度是结合焓 ΔH，拐点的位置是化学计量比 n，拐点处的陡度由结合常数 K_a 决定。`, `Sample and reference cells are held at the same temperature, and the instrument records the heating power needed to keep their difference at zero. Each injection gives a spike in the power trace whose area is the heat of that injection. At first binding sites abound, nearly all injected ligand binds and the heat is large; as sites fill, the heat falls until only the heat of dilution remains. Plotting heat per injection against the molar ratio of ligand to protein gives a sigmoid: the height of the step is the enthalpy of binding ΔH, the position of the inflection the stoichiometry n, and its steepness is set by the binding constant K_a.`),
        T(`其余的热力学量由此算出：ΔG = −RT·ln K_a = ΔH − TΔS。解离常数 1 μmol/L 对应 ΔG = −34.2 kJ/mol（25 °C），每强十倍多 5.7 kJ/mol。曲线的形状由无量纲的 c 值决定：c = n·[M]·K_a（[M] 是池里大分子的浓度）。c 在 10–500 之间时曲线是好看的 S 形，三个参数都能定准；c 太小曲线成了一条缓坡，n 和 ΔH 定不出来；c 太大曲线成了直角台阶，只能给出 K_a 的下限。`, `The remaining thermodynamic quantities follow from ΔG = −RT·ln K_a = ΔH − TΔS. A dissociation constant of 1 μmol/L corresponds to ΔG = −34.2 kJ/mol (25 °C), with a further 5.7 kJ/mol for each tenfold tighter. The shape of the curve is governed by the dimensionless c value, c = n·[M]·K_a ([M] being the macromolecule concentration in the cell). For c between 10 and 500 the curve is a well-formed sigmoid and all three parameters are defined; with c too small it is a shallow slope and n and ΔH are undetermined; with c too large it is a rectangular step that gives only a lower limit for K_a.`),
      ],
      axes: T(`上图：时间对加热功率（μcal/s 或 μW），一排尖峰。下图：摩尔比对每摩尔注入物的热量（kJ/mol 或 kcal/mol），加上拟合曲线。`, `Upper panel: time against heating power (μcal/s or μW), a row of spikes. Lower panel: molar ratio against heat per mole of injectant (kJ/mol or kcal/mol), with the fitted curve.`),
      tells: [
        T(`蛋白质与小分子、蛋白质与蛋白质、主体与客体、金属与配体的结合常数（K_d 从约 10 nmol/L 到 100 μmol/L）、化学计量比和焓熵分解。`, `Binding constants (K_d from about 10 nmol/L to 100 μmol/L), stoichiometry and the enthalpy–entropy breakdown for protein–small molecule, protein–protein, host–guest and metal–ligand binding.`),
        T(`药物优化时一个取代基的改动是通过焓（更好的氢键）还是熵（疏水效应、构象限制）起作用。`, `Whether a substituent change in drug optimisation acts through enthalpy (better hydrogen bonds) or entropy (hydrophobic effect, conformational restriction).`),
      ],
      sample: T(`池里约 200 μL、10–50 μmol/L 的大分子，针里约 40 μL、浓度高十倍左右的配体，典型地注射 19 次，每次 2 μL。两边的缓冲液必须完全相同（最好用同一份透析液），浓度要量准。`, `About 200 μL of macromolecule at 10–50 μmol/L in the cell and about 40 μL of ligand at roughly ten times that concentration in the syringe, typically 19 injections of 2 μL. The buffers on both sides must be identical (preferably the same dialysate), and concentrations accurately known.`),
      nums: [
        [T(`ΔG 与 K_d（25 °C）`, `ΔG and K_d (25 °C)`), T(`1 μmol/L 对应 −34.2 kJ/mol；1 nmol/L 对应 −51.4 kJ/mol`, `1 μmol/L is −34.2 kJ/mol; 1 nmol/L is −51.4 kJ/mol`)],
        [T(`合适的 c 值`, `Suitable c values`), T(`10–500`, `10–500`)],
        [T(`可检测的最小热量`, `Smallest detectable heat`), T(`约 0.1 μJ`, `About 0.1 μJ`)],
      ],
      read: [
        T(`先看原始的功率曲线：每个峰是否回到基线，最后几滴的热量是否已经小而恒定（那是稀释热，要扣掉）。`, `Inspect the raw power trace first: whether each peak returns to baseline and whether the last few injections are small and constant (the heat of dilution, to be subtracted).`),
        T(`n 明显偏离整数（比如 0.7），最常见的原因是浓度不准或者一部分蛋白质没有活性，不是什么新的结合模式。`, `An n clearly off an integer (0.7, say) most often means inaccurate concentrations or partly inactive protein, not a new binding mode.`),
      ],
      traps: [
        T(`缓冲液不匹配（哪怕 pH 差 0.05，或者 DMSO 含量差 0.1 %）产生的稀释热就能盖过结合热。`, `Buffer mismatch (even 0.05 in pH, or 0.1 % in DMSO content) produces heats of dilution that swamp the heat of binding.`),
        T(`结合如果伴随质子的得失，测到的焓里包含缓冲液的电离焓，换一种缓冲液数值就变。要在两三种电离焓不同的缓冲液里各测一次，才能把真正的结合焓分出来。`, `If binding is coupled to uptake or release of protons, the measured enthalpy includes the ionisation enthalpy of the buffer and changes with the buffer. Measurements in two or three buffers of different ionisation enthalpy are needed to isolate the true enthalpy of binding.`),
        T(`焓和熵是从同一条曲线上拆出来的，误差强相关（焓熵补偿在很大程度上是这种相关造成的假象）。对焓熵分解的解读要比对 ΔG 的谨慎得多。`, `Enthalpy and entropy are extracted from the same curve with strongly correlated errors (much apparent enthalpy–entropy compensation is an artefact of this correlation). The breakdown deserves far more caution than ΔG itself.`),
      ],
      figs: [
        { gen: 'itc', cap: T(`由一比一结合模型算出：每次注射的热量对摩尔比（池里 20 μmol/L，针里 200 μmol/L，19 次注射）。拖动解离常数：K_d = 1 μmol/L 时 c = 20，是一条清楚的 S 形；K_d 调到 100 μmol/L（c = 0.2）曲线变成缓坡，调到 1 nmol/L（c = 20 000）变成直角台阶。结合焓只改变台阶的高度。`, `From the one-to-one binding model: heat per injection against molar ratio (20 μmol/L in the cell, 200 μmol/L in the syringe, 19 injections). Vary the dissociation constant: at K_d = 1 μmol/L, c = 20 and the sigmoid is clear; at 100 μmol/L (c = 0.2) it becomes a shallow slope, and at 1 nmol/L (c = 20 000) a rectangular step. The enthalpy of binding changes only the height of the step.`) },
      ],
      see: [['#m-spr', T(`表面等离子体共振：结合的动力学`, `Surface plasmon resonance: the kinetics of binding`)], ['#m-dsc', T(`差示扫描量热`, `Differential scanning calorimetry`)]],
      refs: ['wiseman1989'],
    },
    {
      id: 'spr', fam: 'other', abbr: 'SPR · BLI', name: T(`表面等离子体共振`, `Surface plasmon resonance`),
      one: T(`把一种分子固定在金膜表面，让它的结合伙伴流过去，实时测量金膜表面折射率的变化。有分子结合上来信号就上升，换成缓冲液信号就下降。从上升和下降的快慢直接得到结合速率常数和解离速率常数，两者之比就是亲和力。不需要标记，是药物筛选和抗体表征的标准方法。`, `One molecule is immobilised on a gold film, its binding partner flows past, and the change of refractive index at the gold surface is measured in real time. The signal rises as molecules bind and falls when buffer replaces them. The rates of rise and fall give the association and dissociation rate constants directly, and their ratio the affinity. Label-free, it is a standard method of drug screening and antibody characterisation.`),
      how: [
        T(`偏振光在棱镜和约 50 nm 厚的金膜的界面上全反射时，在某个特定的入射角，光的能量被耦合给金膜表面自由电子的集体振荡（表面等离激元），反射光强度出现一个尖锐的极小。这个共振角对金膜外侧约 200 nm 以内的折射率极其敏感：表面上结合了分子，折射率增大，共振角移动。仪器把角度的移动换成响应单位 RU：1 RU 对应折射率变化约 10⁻⁶，对蛋白质来说约相当于 1 pg/mm²。`, `When polarised light is totally reflected at the interface of a prism and a gold film about 50 nm thick, at one particular angle of incidence its energy couples to the collective oscillation of the free electrons at the gold surface (the surface plasmon) and the reflected intensity shows a sharp minimum. This resonance angle is extremely sensitive to refractive index within about 200 nm of the outer side of the film: bound molecules raise the index and shift the angle. The instrument converts the shift to response units, RU: 1 RU corresponds to a change of about 10⁻⁶ in refractive index, about 1 pg/mm² of protein.`),
        T(`传感图分三段。结合段：让浓度为 C 的分析物流过，R(t) = R_eq·[1 − exp(−(k_a·C + k_d)·t)]，平衡值 R_eq = R_max·C / (C + K_D)。解离段：换成缓冲液，R(t) = R₀·exp(−k_d·t)。再生段：用酸或高盐把剩下的分析物洗掉，表面恢复原状。在五个左右的浓度下各测一条，用同一组 k_a、k_d 同时拟合全部曲线，K_D = k_d / k_a。`, `A sensorgram has three phases. Association: analyte at concentration C flows past, with R(t) = R_eq·[1 − exp(−(k_a·C + k_d)·t)] and equilibrium value R_eq = R_max·C / (C + K_D). Dissociation: buffer replaces analyte, with R(t) = R₀·exp(−k_d·t). Regeneration: acid or high salt strips remaining analyte and restores the surface. Curves at about five concentrations are fitted together with a single k_a and k_d, and K_D = k_d / k_a.`),
      ],
      axes: T(`横轴是时间（s），纵轴是响应（RU）。几个浓度的曲线叠在一张图上。`, `Time (s) against response (RU), with curves at several concentrations overlaid.`),
      tells: [
        T(`抗体与抗原、药物与靶蛋白、蛋白质与蛋白质的 k_a、k_d 和 K_D（从 mmol/L 到 pmol/L）。亲和力相同的两个药物，解离慢的那个在靶点上停留更久。`, `k_a, k_d and K_D (from mmol/L to pmol/L) for antibody–antigen, drug–target and protein–protein pairs. Of two drugs with equal affinity, the one that dissociates more slowly stays longer on its target.`),
        T(`样品里有活性的分析物的浓度；两个抗体是否结合同一个表位；片段筛选。`, `The concentration of active analyte in a sample; whether two antibodies share an epitope; fragment screening.`),
      ],
      sample: T(`配体通过氨基偶联、生物素–链霉亲和素或标签捕获固定在芯片上；分析物溶在运行缓冲液里，每个浓度约 100–200 μL。一定要有参比通道（没有配体的表面）用来扣除本体折射率变化和非特异吸附。`, `The ligand is immobilised on the chip by amine coupling, biotin–streptavidin or tag capture; the analyte is dissolved in running buffer, about 100–200 μL per concentration. A reference channel (a surface without ligand) is essential for subtracting bulk refractive-index changes and non-specific adsorption.`),
      nums: [
        [T(`响应单位`, `Response unit`), T(`1 RU ≈ 1 pg/mm²（蛋白质）`, `1 RU ≈ 1 pg/mm² (protein)`)],
        [T(`可测的速率常数`, `Measurable rate constants`), T(`k_a 10³–10⁷ L/(mol·s)；k_d 10⁻⁵–1 s⁻¹`, `k_a 10³–10⁷ L/(mol·s); k_d 10⁻⁵–1 s⁻¹`)],
        [T(`消逝场的探测深度`, `Depth probed by the evanescent field`), T(`约 200 nm`, `About 200 nm`)],
      ],
      read: [
        T(`看曲线的形状：结合段应当是向平衡值弯过去的指数曲线，解离段是单指数衰减。结合段一开始就是直线、和浓度成正比，是传质受限的迹象。`, `Look at the shapes: association should be an exponential bending towards equilibrium, dissociation a single-exponential decay. An association phase that starts as a straight line proportional to concentration signals mass-transport limitation.`),
        T(`拟合的残差应当随机分布在零附近；如果只有用“两态模型”或“异质配体模型”才拟合得上，先怀疑实验（表面不均一、分析物聚集），再考虑机理。`, `Residuals of the fit should scatter randomly about zero; if only a "two-state" or "heterogeneous ligand" model fits, suspect the experiment (surface heterogeneity, analyte aggregation) before the mechanism.`),
      ],
      traps: [
        T(`传质限制：结合很快、表面配体密度又高时，分析物来不及从溶液扩散到表面，测到的“k_a”其实是扩散速率；解离时刚脱下来的分子又结合回去，“k_d”也偏小。对策是降低固定量、提高流速。`, `Mass-transport limitation: with fast binding and a dense surface, analyte cannot diffuse to the surface quickly enough and the measured "k_a" is really a diffusion rate; on dissociation, released molecules rebind and "k_d" comes out low too. The cure is lower immobilisation levels and higher flow rates.`),
        T(`被固定的那个分子可能因为偶联位置不当而失去活性或者取向杂乱；测到的亲和力和溶液里的（比如等温滴定量热的结果）不一定相同。`, `The immobilised molecule may lose activity or be randomly oriented through an unfortunate coupling site; the affinity measured need not equal that in solution (from isothermal titration calorimetry, for instance).`),
      ],
      figs: [
        { gen: 'spr', cap: T(`由一比一结合模型算出：五个浓度（每次翻三倍）下的传感图，前 120 秒结合，之后解离。拖动 k_a 和 k_d：k_a 决定曲线上升得多快，k_d 决定换成缓冲液后掉得多快；两组 K_D 相同而速率不同的参数给出平衡值相同、形状完全不同的曲线。`, `From the one-to-one binding model: sensorgrams at five concentrations (each three times the last), association for the first 120 seconds, dissociation thereafter. Vary k_a and k_d: k_a sets how fast the curves rise, k_d how fast they fall once buffer returns; two parameter sets of equal K_D and different rates give the same equilibrium levels and entirely different shapes.`) },
      ],
      see: [['#m-itc', T(`等温滴定量热：结合的热力学`, `Isothermal titration calorimetry: the thermodynamics of binding`)]],
      refs: ['liedberg1983'],
    },
    {
      id: 'polarimetry', fam: 'other', abbr: '[α] · ORD', name: T(`旋光与旋光色散`, `Polarimetry and optical rotatory dispersion`),
      one: T(`手性分子的溶液会让平面偏振光的偏振面转过一个角度，一对对映体转的角度相等、方向相反。测这个角度是最古老、最便宜的手性表征方法；测它怎样随波长变化（旋光色散），在吸收带附近会看到和圆二色谱对应的 Cotton 效应。`, `A solution of chiral molecules rotates the plane of plane-polarised light, and two enantiomers rotate it by equal angles in opposite directions. Measuring this angle is the oldest and cheapest way to characterise chirality; measuring how it varies with wavelength (optical rotatory dispersion) reveals, near an absorption band, the Cotton effect that corresponds to circular dichroism.`),
      how: [
        T(`平面偏振光可以看成左旋和右旋圆偏振光的叠加。手性介质对这两种光的折射率略有不同（圆双折射），两者出来时有了相位差，合成的偏振面就转过了一个角度 α。α 正比于光程和浓度，所以定义比旋光度：[α] = α / (l·c)，l 是样品管长度，单位分米；c 是浓度，单位 g/mL（文献里常写成 [α] = 100α / (l·c)，c 用 g/100 mL）。习惯上用钠 D 线（589 nm）在 20 或 25 °C 测，写作 [α]_D²⁰，同时要注明溶剂和浓度。蔗糖在水里的 [α]_D²⁰ = +66.5°：10 g/100 mL 的溶液装在 1 dm 的管里，旋光是 +6.65°。`, `Plane-polarised light can be regarded as the superposition of left and right circularly polarised light. A chiral medium has slightly different refractive indices for the two (circular birefringence), they emerge with a phase difference, and the resultant plane has turned through an angle α. Since α is proportional to path length and concentration, the specific rotation is defined as [α] = α / (l·c), with the tube length l in decimetres and the concentration c in g/mL (often written [α] = 100α / (l·c) with c in g/100 mL). By custom it is measured at the sodium D line (589 nm) at 20 or 25 °C and written [α]_D²⁰, with solvent and concentration stated. Sucrose in water has [α]_D²⁰ = +66.5°: a solution of 10 g/100 mL in a 1 dm tube rotates by +6.65°.`),
        T(`光学纯度 = [α]实测 / [α]纯对映体 × 100 %，在理想情况下等于对映体过量 ee。旋光随波长变短而增大；在发色团的吸收带附近，旋光先升到极大、急剧穿过零、再到极小（或者反过来），这就是 Cotton 效应，它和圆二色谱是同一个现象的两面，可以通过 Kramers–Kronig 关系互相换算。`, `Optical purity = [α]observed / [α]pure enantiomer × 100 %, ideally equal to the enantiomeric excess, ee. Rotation grows towards shorter wavelengths; near the absorption band of a chromophore it rises to a maximum, passes steeply through zero and reaches a minimum (or the reverse). This Cotton effect is the other face of circular dichroism, the two being interconvertible through the Kramers–Kronig relations.`),
      ],
      axes: T(`旋光度是一个数（度）。旋光色散：波长（nm）对比旋光度或摩尔旋光度。`, `Optical rotation is a single number (degrees). Optical rotatory dispersion: wavelength (nm) against specific or molar rotation.`),
      tells: [
        T(`样品是不是手性的、是哪一个对映体（和文献值比符号）、光学纯度大致多少。`, `Whether a sample is chiral, which enantiomer it is (sign against the literature), and roughly its optical purity.`),
        T(`糖的浓度（制糖工业的标准方法）；葡萄糖变旋、蔗糖水解转化这类反应的进程。`, `Sugar concentration (the standard method of the sugar industry); the progress of reactions such as the mutarotation of glucose and the inversion of sucrose.`),
      ],
      sample: T(`几毫克到几十毫克溶在 1–2 mL 溶剂里，装进 1 dm 的样品管，不能有气泡和悬浮物。`, `A few to tens of milligrams in 1–2 mL of solvent in a 1 dm tube, free of bubbles and suspended matter.`),
      nums: [
        [T(`蔗糖（水）`, `Sucrose (water)`), T(`[α]_D²⁰ = +66.5°`, `[α]_D²⁰ = +66.5°`)],
        [T(`D-葡萄糖（水）`, `D-Glucose (water)`), T(`α 型 +112°，β 型 +18.7°，平衡混合物 +52.7°`, `α anomer +112°, β anomer +18.7°, equilibrium mixture +52.7°`)],
        [T(`D-果糖（水）`, `D-Fructose (water)`), T(`−92°；所以蔗糖水解后旋光由右变左（“转化糖”）`, `−92°; hence the rotation changes from right to left when sucrose is hydrolysed ("invert sugar")`)],
        [T(`香芹酮`, `Carvone`), T(`(R)-(−) 约 −61°（留兰香味），(S)-(+) 约 +61°（葛缕子味）`, `(R)-(−) about −61° (spearmint), (S)-(+) about +61° (caraway)`)],
      ],
      read: [
        T(`报告时写全：[α]_D²⁵ = +23.5（c 1.0，CHCl₃）。只有符号和数值、没有浓度和溶剂的比旋光度不能和文献比。`, `Report in full: [α]_D²⁵ = +23.5 (c 1.0, CHCl₃). A specific rotation with sign and value but without concentration and solvent cannot be compared with the literature.`),
      ],
      traps: [
        T(`旋光的符号（+ / −）和构型的标记（R / S、D / L）之间没有固定关系，不能由一个推出另一个。`, `The sign of rotation (+ / −) bears no fixed relation to the configurational descriptor (R / S, D / L); neither can be deduced from the other.`),
        T(`比旋光度随溶剂、浓度、温度变化，有时连符号都会变；数值小的化合物里，一点点旋光很大的手性杂质就能把结果带偏。用旋光定 ee 远不如手性色谱可靠。`, `Specific rotation changes with solvent, concentration and temperature, sometimes even in sign; for compounds of small rotation a trace of a strongly rotating chiral impurity distorts the result. Rotation is far less reliable than chiral chromatography for determining ee.`),
        T(`光学纯度和 ee 并不总是相等：对映体之间有缔合时，旋光和组成不成线性（Horeau 效应）。`, `Optical purity and ee are not always equal: when enantiomers associate, rotation is not linear in composition (the Horeau effect).`),
      ],
      figs: [
        { sketch: { x: [240, 400], xl: T(`波长（nm）`, `wavelength (nm)`), yl: T(`摩尔旋光度（示意）`, `molar rotation (schematic)`), zero: true, peaks: [[312, 1, 26, T(`峰`, `peak`)], [278, -1, 26, T(`谷`, `trough`)]] },
          cap: T(`示意：一个正的 Cotton 效应。在发色团的吸收带（这里约 295 nm，酮羰基的 n → π* 跃迁）附近，旋光在长波一侧出现峰、短波一侧出现谷，中间穿过零；对映体的曲线上下翻转。形状是示意的。`, `Schematic: a positive Cotton effect. Near the absorption band of the chromophore (here about 295 nm, the n → π* transition of a ketone carbonyl) the rotation shows a peak on the long-wavelength side and a trough on the short-wavelength side, crossing zero between; the curve of the enantiomer is inverted. The shape is illustrative.`) },
      ],
      see: [['#m-cd', T(`圆二色谱`, `Circular dichroism`)], ['#m-chiral', T(`手性色谱：定 ee 的可靠方法`, `Chiral chromatography: the reliable way to determine ee`)], ['#m-vcd', T(`振动圆二色谱：定绝对构型`, `Vibrational circular dichroism: absolute configuration`)]],
      refs: ['polavarapu2002'],
    },
    {
      id: 'ins', fam: 'other', abbr: 'INS · QENS', name: T(`非弹性中子散射`, `Inelastic neutron scattering`),
      one: T(`让中子打在样品上，测它们损失了多少能量，这些能量正好交给了分子振动和晶格振动。它是没有选律的振动光谱：红外和拉曼都看不见的模式它也能看见，而且对氢的运动格外敏感。算出来的谱和实测谱可以直接比较，是检验计算的理想实验。`, `Neutrons strike the sample and the energy they lose, which has gone into molecular and lattice vibrations, is measured. It is vibrational spectroscopy without selection rules: modes invisible to both infrared and Raman appear, and it is exceptionally sensitive to the motion of hydrogen. Calculated and measured spectra can be compared directly, which makes it an ideal test of computation.`),
      how: [
        T(`中子被原子核散射，不涉及偶极矩或极化率，所以所有的振动模式都是允许的。一个模式的强度正比于各个原子的散射截面乘以它在这个模式里的振幅的平方。氢的散射截面（约 82 靶恩）比几乎所有别的元素大十倍以上，氢又最轻、振幅最大，所以谱几乎完全由氢的运动决定。把一部分氢换成氘（截面只有 7.6 靶恩），对应的峰就消失，用来做归属。`, `Neutrons scatter from nuclei, with no involvement of dipole moment or polarisability, so every vibrational mode is allowed. The intensity of a mode is proportional to the scattering cross-section of each atom times the square of its amplitude in that mode. The cross-section of hydrogen (about 82 barn) exceeds that of almost every other element more than tenfold, and hydrogen, being lightest, moves most, so the spectrum is governed almost wholly by hydrogen motion. Replacing some hydrogens by deuterium (only 7.6 barn) removes the corresponding peaks, which serves for assignment.`),
        T(`因为强度只取决于原子的位移，不需要算偶极矩导数或极化率导数，所以由量子化学或晶格动力学计算得到的简正模式可以直接、定量地换算成一张谱，连泛频和组合频都能算。中子的穿透力很强，可以穿过不锈钢的反应池，看催化剂在高压气氛下表面上的含氢物种，或者金属氢化物里的氢。能量分辨更高的准弹性中子散射（QENS）看的是皮秒到纳秒的扩散和转动。`, `Since intensity depends only on atomic displacements and needs no dipole or polarisability derivatives, the normal modes from a quantum-chemical or lattice-dynamics calculation convert directly and quantitatively into a spectrum, overtones and combinations included. Neutrons penetrate deeply, passing through stainless-steel reaction cells to observe hydrogenous species on catalysts under high gas pressure, or hydrogen in metal hydrides. Quasi-elastic neutron scattering (QENS), at higher energy resolution, observes diffusion and rotation on picosecond to nanosecond time scales.`),
      ],
      axes: T(`横轴是能量转移（meV 或 cm⁻¹，1 meV = 8.066 cm⁻¹），纵轴是散射强度 S(Q, ω)。`, `Energy transfer (meV or cm⁻¹; 1 meV = 8.066 cm⁻¹) against scattered intensity S(Q, ω).`),
      tells: [
        T(`催化剂表面的氢物种、吸附的烃类碎片；储氢材料和金属氢化物里氢的位置和成键。`, `Hydrogen species and adsorbed hydrocarbon fragments on catalyst surfaces; the sites and bonding of hydrogen in storage materials and metal hydrides.`),
        T(`红外、拉曼都禁阻的模式，以及低频的扭转、晶格振动（0–400 cm⁻¹）；氢键体系的振动。`, `Modes forbidden in both infrared and Raman, and low-frequency torsions and lattice vibrations (0–400 cm⁻¹); the vibrations of hydrogen-bonded systems.`),
        T(`吸附在孔道里的氢分子的转动跃迁，由此判断吸附位点的强弱。`, `Rotational transitions of hydrogen molecules adsorbed in pores, which indicate the strength of the adsorption sites.`),
      ],
      sample: T(`要到散裂中子源或反应堆申请机时。样品量大（几克；含氢多的可以少到几百毫克），装在铝罐里，冷到 20 K 以下以减小热运动造成的展宽。`, `Beam time at a spallation source or reactor must be applied for. Samples are large (grams; a few hundred milligrams if rich in hydrogen), held in aluminium cans and cooled below 20 K to reduce thermal broadening.`),
      nums: [
        [T(`能量换算`, `Energy conversion`), T(`1 meV = 8.066 cm⁻¹ = 0.2418 THz`, `1 meV = 8.066 cm⁻¹ = 0.2418 THz`)],
        [T(`氢分子的转动跃迁（J = 0 → 1）`, `Rotational transition of molecular hydrogen (J = 0 → 1)`), T(`14.7 meV（自由转子）`, `14.7 meV (free rotor)`)],
        [T(`总散射截面`, `Total scattering cross-sections`), T(`H 82.0，D 7.64，C 5.55，O 4.23 靶恩`, `H 82.0, D 7.64, C 5.55, O 4.23 barn`)],
      ],
      read: [
        T(`和计算谱叠在一起比：位置和强度都对得上的归属才可靠。强度弱的模式不是“禁阻”，而是氢在里面动得少。`, `Overlay a calculated spectrum: an assignment is reliable when both positions and intensities match. A weak mode is not "forbidden"; hydrogen simply moves little in it.`),
      ],
      traps: [
        T(`分辨率（约为能量转移的 1–2 %）比红外和拉曼差，2000 cm⁻¹ 以上的峰又宽又弱，C–H、O–H 伸缩区的信息量不如光学光谱。`, `Resolution (about 1–2 % of the energy transfer) is poorer than in infrared and Raman, and peaks above 2000 cm⁻¹ are broad and weak; the C–H and O–H stretching regions are less informative than in optical spectra.`),
        T(`全世界只有十来台这样的谱仪，一次实验从申请到测量常要等半年以上。`, `Only about a dozen such spectrometers exist in the world, and an experiment often waits more than half a year from proposal to measurement.`),
      ],
      figs: [
        { gen: 'bars', args: { unit: 'barn', xl: T(`中子总散射截面（靶恩）`, `total neutron scattering cross-section (barn)`), rows: [[T(`H`, `H`), 82.02, 82.02], [T(`D`, `D`), 7.64, 7.64], [T(`C`, `C`), 5.55, 5.55], [T(`N`, `N`), 11.51, 11.51], [T(`O`, `O`), 4.23, 4.23], [T(`Al`, `Al`), 1.50, 1.50], [T(`Si`, `Si`), 2.17, 2.17], [T(`V`, `V`), 5.10, 5.10], [T(`Fe`, `Fe`), 11.62, 11.62], [T(`Pd`, `Pd`), 4.48, 4.48]] },
          cap: T(`文献数值：几种元素的中子总散射截面。氢远远高出其他元素，所以非弹性中子散射的谱主要是氢的运动；铝的截面小，适合做样品容器。`, `Literature values: total neutron scattering cross-sections of some elements. Hydrogen far exceeds the rest, so inelastic neutron spectra show mainly hydrogen motion; aluminium, with a small cross-section, suits sample containers.`) },
      ],
      see: [['#m-ir', T(`红外光谱`, `Infrared spectroscopy`)], ['#m-raman', T(`拉曼光谱`, `Raman spectroscopy`)], ['#m-ednd', T(`中子衍射`, `Neutron diffraction`)]],
      refs: ['parker2011'],
    },
  );
})();
