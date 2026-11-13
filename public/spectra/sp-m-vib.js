'use strict';
// 谱图馆 · 振动光谱一族的方法条目。写法见 sp-data.js 开头的说明：每条是中英两版，图（figs）标明来历。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'ir', fam: 'vib', core: true, abbr: 'FTIR', name: T(`红外吸收光谱`, `Infrared absorption spectroscopy`),
      one: T(`分子吸收中红外光（4000–400 cm⁻¹）激发振动；每种官能团在固定的波数范围吸收，整张谱是分子的“指纹”。`, `Molecules absorb mid-infrared light (4000–400 cm⁻¹) by exciting vibrations; each functional group absorbs in its own range and the whole spectrum is a fingerprint of the molecule.`),
      how: [
        T(`化学键像弹簧：两个原子的折合质量 μ 越小、键的力常数 k 越大，振动频率越高，ν̃ = (1/2πc)·√(k/μ)。所以 X–H 伸缩在 2800–3700 cm⁻¹，三键在 2100–2260，双键在 1500–1800，单键和弯曲振动落在 1500 cm⁻¹ 以下的“指纹区”。N 个原子的非线形分子有 3N − 6 个简正振动（线形分子 3N − 5）。`, `A bond behaves like a spring: the smaller the reduced mass μ of the two atoms and the larger the force constant k, the higher the frequency, ν̃ = (1/2πc)·√(k/μ). That puts X–H stretches at 2800–3700 cm⁻¹, triple bonds at 2100–2260, double bonds at 1500–1800, and single-bond stretches and bends below 1500 cm⁻¹ in the fingerprint region. A non-linear molecule of N atoms has 3N − 6 normal modes (3N − 5 if linear).`),
        T(`只有让分子偶极矩发生变化的振动才吸收红外光，吸收强度正比于 |∂μ/∂Q|²。因此极性键（C=O、O–H、C–F）的峰强，对称的非极性振动（N₂、O₂ 的伸缩，CO₂ 的对称伸缩）在红外里看不到，要用拉曼。`, `Only vibrations that change the dipole moment absorb, with intensity proportional to |∂μ/∂Q|². Polar bonds (C=O, O–H, C–F) therefore give strong bands, while symmetric non-polar motions (the stretch of N₂ or O₂, the symmetric stretch of CO₂) are invisible in the infrared and need Raman.`),
        T(`今天的仪器几乎都是傅里叶变换型（FTIR）：迈克尔逊干涉仪让所有波长同时到达检测器，记录干涉图再做傅里叶变换。相比老式的光栅扫描，它一次测全谱（多路复用优势）、光通量大、波数由 He–Ne 激光定标，一张 4 cm⁻¹ 分辨率的谱几秒钟就能测完。`, `Nearly every instrument today is a Fourier-transform spectrometer (FTIR): a Michelson interferometer sends all wavelengths to the detector at once, and the recorded interferogram is Fourier-transformed. Compared with a scanning grating it measures the whole spectrum together (the multiplex advantage), passes more light, takes its wavenumber scale from a He–Ne laser, and delivers a 4 cm⁻¹ spectrum in seconds.`),
      ],
      axes: T(`横轴是波数 ν̃（cm⁻¹），习惯上从左到右由高到低（4000 → 400）；纵轴是透过率 T（%，峰朝下）或吸光度 A = −log₁₀T（峰朝上，和浓度成正比）。`, `The x axis is wavenumber ν̃ (cm⁻¹), by convention running from high to low (4000 → 400); the y axis is transmittance T (%, bands point down) or absorbance A = −log₁₀T (bands point up, proportional to concentration).`),
      tells: [
        T(`有哪些官能团：羰基、羟基、氨基、腈基、硝基等各有特征峰。`, `Which functional groups are present: carbonyl, hydroxyl, amine, nitrile, nitro and so on each have characteristic bands.`),
        T(`同一个官能团所处的环境：C=O 的位置能区分酯（约 1740）、酮（约 1715）、酰胺（约 1650–1690）和羧酸二聚体（约 1710）；共轭、成环和氢键都会移动它。`, `The environment of a group: the C=O position separates esters (about 1740), ketones (about 1715), amides (about 1650–1690) and carboxylic-acid dimers (about 1710); conjugation, ring strain and hydrogen bonding all shift it.`),
        T(`是不是同一种物质：把指纹区和标准谱逐峰对照，是药典里鉴别原料药的法定方法。`, `Identity: comparing the fingerprint region band by band with a reference spectrum is the pharmacopoeial identity test for drug substances.`),
        T(`定量：吸光度服从朗伯–比尔定律，可测气体浓度、聚合物里的添加剂、反应进度。`, `Quantity: absorbance follows the Beer–Lambert law, which is used for gas concentrations, additives in polymers and reaction progress.`),
      ],
      sample: T(`固体：KBr 压片（约 1 mg 样品加 100 mg KBr）、石蜡油糊、或直接压在 ATR 晶体上；液体：夹在两片盐片之间的薄膜或固定光程的液体池；气体：10 cm 到几十米光程的气体池。水和玻璃强烈吸收红外，窗片用 KBr、NaCl、CaF₂ 或 ZnSe。`, `Solids: a KBr pellet (about 1 mg of sample in 100 mg KBr), a Nujol mull, or simply pressed on an ATR crystal; liquids: a film between two salt plates or a fixed-path cell; gases: cells from 10 cm to tens of metres. Water and glass absorb strongly, so windows are KBr, NaCl, CaF₂ or ZnSe.`),
      nums: [
        [T(`常用范围`, `Usual range`), T(`4000–400 cm⁻¹（2.5–25 μm）`, `4000–400 cm⁻¹ (2.5–25 μm)`)],
        [T(`常规分辨率`, `Routine resolution`), T(`凝聚相 4 cm⁻¹；气体 0.5 cm⁻¹ 或更细`, `4 cm⁻¹ for condensed phases; 0.5 cm⁻¹ or finer for gases`)],
        [T(`样品量`, `Sample needed`), T(`ATR 约 1 mg 或一滴；显微红外到约 10 μm 的颗粒`, `About 1 mg or one drop on ATR; particles down to about 10 μm under a microscope`)],
        [T(`测一张谱`, `Time per spectrum`), T(`16 次扫描约 20 秒`, `About 20 s for 16 scans`)],
      ],
      read: [
        T(`先看 1500 cm⁻¹ 以上：3200–3600 有没有宽的 O–H / N–H，3000 两侧的 C–H（高于 3000 是 sp²/sp，低于 3000 是 sp³），2100–2260 的三键，1650–1800 的 C=O。`, `Start above 1500 cm⁻¹: a broad O–H / N–H at 3200–3600, the C–H stretches on either side of 3000 (above 3000 means sp²/sp, below means sp³), triple bonds at 2100–2260, C=O at 1650–1800.`),
        T(`再用指纹区确认：C–O 伸缩（1000–1300）、芳环的面外弯曲（690–900，可判断取代类型）、NO₂ 的两个强峰（约 1530 和 1350）。`, `Then confirm in the fingerprint region: C–O stretches (1000–1300), aromatic out-of-plane bends (690–900, which report the substitution pattern), the two strong NO₂ bands (about 1530 and 1350).`),
        T(`没有峰也是信息：1700 附近干净说明没有羰基。`, `Absence is information too: a clean window near 1700 rules out a carbonyl.`),
        T(`不要试图归属每一个峰。指纹区有大量耦合振动和合频，通常只用来比对。`, `Do not try to assign every band. The fingerprint region is full of coupled modes and combinations and is normally used for matching only.`),
      ],
      traps: [
        T(`空气里的水汽（3500–3900 和 1300–2000 的密集细线）和 CO₂（2349 的双峰、667）没扣干净，会被误当成样品的峰。`, `Uncompensated atmospheric water vapour (dense fine lines at 3500–3900 and 1300–2000) and CO₂ (the doublet at 2349, and 667) are easily mistaken for sample bands.`),
        T(`KBr 吸潮会带来 3400 和 1640 的水峰；样品压得太厚，强峰“顶到底”，峰形和相对强度都失真。`, `Damp KBr adds water bands at 3400 and 1640; a pellet that is too thick saturates the strong bands and distorts shapes and relative intensities.`),
        T(`ATR 谱和透射谱不一样：低波数的峰相对更强，强峰还会向低波数移几个 cm⁻¹。和透射标准谱比对前要做 ATR 校正。`, `ATR and transmission spectra differ: low-wavenumber bands are relatively stronger and strong bands shift a few cm⁻¹ to lower wavenumber. Apply an ATR correction before comparing with a transmission library.`),
        T(`计算的谐振频率系统性偏高 3–5 %（没有非谐性），和实验比较前要乘校正因子；下面的图里两者都标出来了。`, `Computed harmonic frequencies are systematically 3–5 % too high (no anharmonicity) and must be scaled before comparison with experiment; the figure below shows both.`),
      ],
      figs: [
        { vib: 'ethanol', mode: 'ir', pick: ['water', 'co2', 'methane', 'ammonia', 'formaldehyde', 'methanol', 'ethanol', 'acetaldehyde', 'acetone', 'aceticacid', 'ethylacetate', 'acetamide', 'acetonitrile', 'benzene', 'toluene', 'phenol', 'benzaldehyde', 'chloroform', 'dcm', 'ccl4', 'caffeine'],
          cap: T(`用密度泛函理论算出的气相红外谱（B3LYP，孤立分子，谐振近似，棒展宽成 12 cm⁻¹ 的洛伦兹线）。换一个分子看官能团的峰怎样出现和消失；灰色刻度是文献里的气相实验基频。凝聚相里氢键会把 O–H 伸缩拉宽并移到 3200–3400 cm⁻¹，这是孤立分子的计算里没有的。`, `Gas-phase infrared spectra from density functional theory (B3LYP, isolated molecule, harmonic approximation, sticks broadened to 12 cm⁻¹ Lorentzians). Switch molecules to watch group bands appear and vanish; the grey ticks are experimental gas-phase fundamentals from the literature. In condensed phases hydrogen bonding broadens the O–H stretch and moves it to 3200–3400 cm⁻¹, which an isolated-molecule calculation does not contain.`) },
      ],
      table: 'ir-groups', see: [['code/#ir', T(`代码台的红外工具：把你自己的频率计算输出画成谱`, `The Code Desk IR tool: plot your own frequency calculation`)], ['#lab-vib', T(`动手实验室：红外和拉曼对照`, `Hands-on lab: infrared against Raman`)]],
      refs: ['griffiths1983', 'stephens1994', 'scott1996', 'kesharwani2015'],
    },
    {
      id: 'irsampling', fam: 'vib', abbr: 'ATR · DRIFTS · IRRAS', name: T(`红外的采样方式`, `Infrared sampling techniques`),
      one: T(`同一台 FTIR 换不同的附件：透射、衰减全反射（ATR）、漫反射（DRIFTS）、镜面反射和掠角反射（IRRAS）。测的都是振动吸收，但谱的样子不完全相同。`, `One FTIR, different accessories: transmission, attenuated total reflection (ATR), diffuse reflection (DRIFTS), specular and grazing-angle reflection (IRRAS). All measure vibrational absorption, yet the spectra do not look identical.`),
      how: [
        T(`ATR：红外光在高折射率晶体（金刚石 n = 2.4、ZnSe 2.4、Ge 4.0）内全反射，在界面外形成只伸出零点几到几微米的倏逝波，样品紧贴晶体就吸收它。穿透深度 d_p = λ / (2π n₁ √(sin²θ − (n₂/n₁)²))，和波长成正比，所以低波数的峰相对变强。几乎不用制样，是现在最常用的方式。`, `ATR: infrared light is totally reflected inside a high-index crystal (diamond n = 2.4, ZnSe 2.4, Ge 4.0), leaving an evanescent wave that reaches only a fraction of a micrometre to a few micrometres outside; a sample pressed against the crystal absorbs it. The penetration depth d_p = λ / (2π n₁ √(sin²θ − (n₂/n₁)²)) grows with wavelength, so low-wavenumber bands look relatively stronger. It needs almost no preparation and is now the default.`),
        T(`漫反射（DRIFTS）：粉末把光向各个方向散射，收集漫反射光。强度用 Kubelka–Munk 函数 F(R) = (1 − R)² / 2R 换算后才近似正比于浓度。适合催化剂粉末、土壤和原位反应池。`, `Diffuse reflection (DRIFTS): a powder scatters light in all directions and the diffusely reflected part is collected. Intensities become roughly proportional to concentration only after the Kubelka–Munk transform F(R) = (1 − R)² / 2R. It suits catalyst powders, soils and in-situ reaction cells.`),
        T(`掠角反射（IRRAS、PM-IRRAS）：光以约 80° 入射到金属表面，只有垂直于表面的偶极分量被增强（表面选律），可以测单分子层并判断分子取向。`, `Grazing-angle reflection (IRRAS, PM-IRRAS): light strikes a metal at about 80°, and only the dipole component normal to the surface is enhanced (the surface selection rule), so a single monolayer can be measured and its orientation deduced.`),
      ],
      axes: T(`和普通红外一样是波数对吸光度；ATR 的纵轴常标“ATR 单位”，漫反射标反射率或 Kubelka–Munk 单位。`, `As in ordinary IR, wavenumber against absorbance; ATR spectra are often plotted in "ATR units" and diffuse reflection in reflectance or Kubelka–Munk units.`),
      tells: [
        T(`ATR：固体、膏体、水溶液的常规鉴别；水的吸收因为光程只有约 1 μm 而不饱和，可以直接测水溶液里的溶质。`, `ATR: routine identification of solids, pastes and aqueous solutions; because the path is only about 1 μm, water does not saturate and solutes in water can be measured directly.`),
        T(`DRIFTS：催化剂表面吸附物种（如 CO 在金属上的线式和桥式吸附）随温度和气氛的变化。`, `DRIFTS: adsorbed species on catalysts (such as linear and bridged CO on metals) as temperature and atmosphere change.`),
        T(`IRRAS：自组装单层、电极表面物种的取向和覆盖度。`, `IRRAS: orientation and coverage of self-assembled monolayers and species on electrodes.`),
      ],
      sample: T(`ATR 要求样品和晶体紧密接触，硬的固体靠压头压紧；锗晶体的穿透最浅，适合强吸收的炭黑填充橡胶。漫反射一般把样品用 KBr 稀释到 1–5 %。`, `ATR needs intimate contact, so hard solids are clamped; germanium penetrates least and suits strongly absorbing carbon-filled rubber. For diffuse reflection the sample is usually diluted to 1–5 % in KBr.`),
      nums: [
        [T(`ATR 穿透深度（金刚石，45°，样品 n = 1.5）`, `ATR penetration depth (diamond, 45°, sample n = 1.5)`), T(`1000 cm⁻¹ 处约 2.0 μm；3000 cm⁻¹ 处约 0.67 μm`, `About 2.0 μm at 1000 cm⁻¹; about 0.67 μm at 3000 cm⁻¹`)],
        [T(`IRRAS 灵敏度`, `IRRAS sensitivity`), T(`不到一个单分子层`, `Less than one monolayer`)],
      ],
      read: [
        T(`ATR 谱按波数乘一个因子（或用仪器的“ATR 校正”）后再和透射谱库比。`, `Scale an ATR spectrum by wavenumber (or use the instrument's ATR correction) before matching it against a transmission library.`),
        T(`漫反射谱里强峰可能出现“倒峰”或导数形的畸变（Reststrahlen 带），是镜面反射混进来了，稀释样品可以减轻。`, `Strong bands in diffuse reflection can invert or take derivative shapes (Reststrahlen bands) when specular reflection leaks in; diluting the sample reduces it.`),
      ],
      traps: [
        T(`金刚石晶体自身在 1900–2300 cm⁻¹ 有吸收，这一段的噪声大。`, `Diamond itself absorbs at 1900–2300 cm⁻¹, so that window is noisy.`),
        T(`接触不好时整张 ATR 谱都弱，而且高波数一侧弱得更多，不要当成样品浓度低。`, `Poor contact weakens the whole ATR spectrum, the high-wavenumber side most of all; do not read it as a dilute sample.`),
      ],
      figs: [
        { xy: 'ir-nitrocellulose', rev: true, xl: T(`波数（cm⁻¹）`, `wavenumber (cm⁻¹)`), yl: T(`半球反射率`, `hemispherical reflectance`),
          marks: [[1650, T(`NO₂ 反对称伸缩`, `NO₂ asym. stretch`)], [1280, T(`NO₂ 对称伸缩`, `NO₂ sym. stretch`)], [840, T(`O–N 伸缩`, `O–N stretch`)], [3450, T(`残余 O–H`, `residual O–H`)]],
          cap: T(`实测：硝化纤维素固体的漫反射红外谱（积分球，4 cm⁻¹）。纵轴是反射率，所以吸收带是向下的谷；硝酸酯基的两个强带在约 1650 和 1280 cm⁻¹，强吸收处可以看到反射谱特有的畸变。`, `Measured: the diffuse-reflectance infrared spectrum of solid nitrocellulose (integrating sphere, 4 cm⁻¹). The axis is reflectance, so absorption bands are dips; the two strong nitrate-ester bands lie near 1650 and 1280 cm⁻¹, and the distortions typical of reflection spectra show where absorption is strongest.`) },
        { gen: 'atrDepth', cap: T(`由公式算出：ATR 的穿透深度随波数的变化（45° 入射，样品折射率 1.5）。金刚石和 ZnSe 的折射率几乎一样；锗的折射率高，穿透浅得多。`, `From the formula: ATR penetration depth against wavenumber (45° incidence, sample index 1.5). Diamond and ZnSe have nearly the same index; germanium, with its higher index, penetrates far less.`) },
      ],
      refs: ['harrick1960', 'fahrenfort1961', 'griffiths1983'],
    },
    {
      id: 'rovib', fam: 'vib', core: true, abbr: 'Gas-phase IR', name: T(`气相转振光谱`, `Gas-phase rovibrational spectroscopy`),
      one: T(`气体分子振动的同时还在转动，一个振动带分裂成几十条等间距的细线（P 支和 R 支），从线的间距可以直接算出键长。`, `A gas molecule rotates while it vibrates, so one vibrational band splits into dozens of nearly equally spaced lines (the P and R branches) whose spacing gives the bond length directly.`),
      how: [
        T(`双原子分子的能级是 E(v, J) = ω_e(v+½) − ω_e x_e(v+½)² + B_v J(J+1) − D J²(J+1)²，其中 B_v = B_e − α_e(v+½)。红外跃迁要求 Δv = +1、ΔJ = ±1：ΔJ = +1 的线在带心高波数一侧（R 支），ΔJ = −1 的在低波数一侧（P 支），带心 ν₀ 处没有线（ΔJ = 0 被禁阻）。相邻线的间距约 2B。`, `The levels of a diatomic molecule are E(v, J) = ω_e(v+½) − ω_e x_e(v+½)² + B_v J(J+1) − D J²(J+1)², with B_v = B_e − α_e(v+½). Infrared transitions need Δv = +1 and ΔJ = ±1: lines with ΔJ = +1 lie above the band origin (R branch), those with ΔJ = −1 below it (P branch), and there is a gap at the origin ν₀ (ΔJ = 0 is forbidden). Neighbouring lines are about 2B apart.`),
        T(`每条线的强度由下能级的布居决定：(2J+1)·exp(−BJ(J+1)hc/kT)，先升后降，最强的线在 J ≈ √(kT/2hcB) − ½ 附近，所以支的轮廓就是一支温度计。振动激发态的 B 略小（键变长），R 支的线越往外越密，P 支越往外越疏。`, `Line intensities follow the lower-state populations, (2J+1)·exp(−BJ(J+1)hc/kT), which rise and then fall with a maximum near J ≈ √(kT/2hcB) − ½, so the branch envelope is a thermometer. Because B is slightly smaller in the excited vibrational state (the bond is longer), R-branch lines crowd together going outward and P-branch lines spread apart.`),
        T(`氯有两种同位素（³⁵Cl 75.76 %、³⁷Cl 24.24 %），H³⁷Cl 的折合质量稍大，每条线都在 H³⁵Cl 低波数一侧约 2 cm⁻¹ 处有一个强度为三分之一的伴线。这张谱是物理化学实验课的经典。`, `Chlorine has two isotopes (³⁵Cl 75.76 %, ³⁷Cl 24.24 %); H³⁷Cl has a slightly larger reduced mass, so each line has a companion one third as strong about 2 cm⁻¹ to lower wavenumber. This spectrum is a classic of the physical-chemistry teaching lab.`),
      ],
      axes: T(`横轴是波数（cm⁻¹），纵轴是吸光度。分辨率要优于线间距（HCl 约 20 cm⁻¹，CO 约 3.8 cm⁻¹）才能看到分立的线；压力展宽在 1 atm 下约 0.1–0.2 cm⁻¹。`, `Wavenumber (cm⁻¹) against absorbance. The resolution must beat the line spacing (about 20 cm⁻¹ for HCl, 3.8 cm⁻¹ for CO) to see separate lines; pressure broadening at 1 atm is about 0.1–0.2 cm⁻¹.`),
      tells: [
        T(`转动常数 B → 转动惯量 → 键长（HCl 的 r_e = 1.2746 Å）。`, `The rotational constant B → moment of inertia → bond length (r_e = 1.2746 Å for HCl).`),
        T(`带心和泛频 → 谐振频率 ω_e、非谐性 ω_e x_e、力常数和解离能的估计。`, `The origin and overtones → harmonic frequency ω_e, anharmonicity ω_e x_e, the force constant and an estimate of the dissociation energy.`),
        T(`气体的温度和浓度：大气遥感、燃烧诊断、温室气体监测都是在数这些线。`, `Gas temperature and concentration: atmospheric remote sensing, combustion diagnostics and greenhouse-gas monitoring all count these lines.`),
      ],
      sample: T(`10 cm 气体池充几十到几百托的气体即可；痕量气体用多次反射池（White 池、Herriott 池）把光程延长到几十米，或用可调谐激光和腔衰荡。`, `A 10 cm cell with tens to hundreds of torr of gas is enough; trace gases use multipass cells (White, Herriott) that stretch the path to tens of metres, or tunable lasers and cavity ring-down.`),
      nums: [
        [T(`H³⁵Cl 带心 ν₀`, `H³⁵Cl band origin ν₀`), T(`2885.98 cm⁻¹（由常数算出）`, `2885.98 cm⁻¹ (from the constants)`)],
        [T(`R(0) 和 P(1)`, `R(0) and P(1)`), T(`2906.24 和 2865.10 cm⁻¹`, `2906.24 and 2865.10 cm⁻¹`)],
        [T(`CO 带心`, `CO band origin`), T(`2143.27 cm⁻¹`, `2143.27 cm⁻¹`)],
        [T(`腔衰荡检出限`, `Cavity ring-down detection limit`), T(`ppb 到 ppt 量级`, `ppb to ppt levels`)],
      ],
      read: [
        T(`找到中间的缺口，就是带心。右边是 R(0)、R(1)…，左边是 P(1)、P(2)…。`, `Find the central gap: that is the origin. To the right are R(0), R(1)…; to the left P(1), P(2)….`),
        T(`用组合差求常数：R(J−1) − P(J+1) = 4B₀(J+½) 只含下态，R(J) − P(J) = 4B₁(J+½) 只含上态。`, `Use combination differences: R(J−1) − P(J+1) = 4B₀(J+½) involves only the lower state and R(J) − P(J) = 4B₁(J+½) only the upper.`),
        T(`线形多原子分子的弯曲振动（如 CO₂ 的 667 cm⁻¹）还有一个强的 Q 支（ΔJ = 0）立在带心。`, `Bending modes of linear polyatomic molecules (such as CO₂ at 667 cm⁻¹) also show a strong Q branch (ΔJ = 0) standing at the origin.`),
      ],
      traps: [
        T(`分辨率不够时只看到两个鼓包（P、R 支的包络），中间一个凹陷：液相和低分辨率的气相谱就是这样。`, `At low resolution only two humps (the P and R envelopes) with a dip between them remain, as in low-resolution gas spectra.`),
        T(`强线容易饱和，朗伯–比尔定律在仪器分辨率比线宽差时不再线性。`, `Strong lines saturate easily, and the Beer–Lambert law stops being linear when the instrument resolution is worse than the linewidth.`),
      ],
      figs: [
        { gen: 'rovib', args: { mol: 'HCl', T: 296 }, cap: T(`由实测光谱常数算出：HCl 基频带在 296 K 的转振线（常数取自 Huber 和 Herzberg 的汇编；H³⁷Cl 的常数按折合质量换算，强度按 24.24 % 的丰度）。动手实验室里可以改温度、换成 DCl 或 CO。`, `Computed from measured spectroscopic constants: the rovibrational lines of the HCl fundamental at 296 K (constants from the Huber and Herzberg compilation; those of H³⁷Cl scaled by reduced mass, intensities weighted by its 24.24 % abundance). In the lab below you can change the temperature or switch to DCl or CO.`) },
      ],
      see: [['#lab-rovib', T(`动手实验室：转振谱`, `Hands-on lab: rovibrational spectrum`)]], refs: ['griffiths1983'],
    },
    {
      id: 'nir', fam: 'vib', abbr: 'NIR', name: T(`近红外光谱`, `Near-infrared spectroscopy`),
      one: T(`12500–4000 cm⁻¹（800–2500 nm）里是 X–H 振动的泛频和合频：峰又宽又弱又重叠，却能穿透几毫米的样品，配合化学计量学成了工业在线分析的主力。`, `Between 12500 and 4000 cm⁻¹ (800–2500 nm) lie the overtones and combinations of X–H vibrations: broad, weak and overlapping, yet able to pass through millimetres of sample, which with chemometrics makes NIR the workhorse of industrial on-line analysis.`),
      how: [
        T(`谐振子只允许 Δv = ±1。真实的键是非谐的，Δv = 2、3 的泛频也有一点强度，但每高一阶要弱 10–100 倍；位置略低于基频的整数倍：ν̃(0→v) = v·ω_e − v(v+1)·ω_e x_e。只有 C–H、N–H、O–H 这些非谐性大、基频高的振动的泛频落在近红外。`, `A harmonic oscillator allows only Δv = ±1. Real bonds are anharmonic, so overtones with Δv = 2, 3 gain a little intensity, each order 10–100 times weaker than the last, and they lie slightly below integer multiples of the fundamental: ν̃(0→v) = v·ω_e − v(v+1)·ω_e x_e. Only the strongly anharmonic, high-frequency C–H, N–H and O–H vibrations have overtones in the near infrared.`),
        T(`吸收弱反而是优点：光程可以用毫米到厘米，样品不用稀释，光纤（石英）能传这个波段，探头可以直接插进反应釜或隔着玻璃瓶测。`, `Weak absorption is the advantage: path lengths of millimetres to centimetres work, samples need no dilution, quartz fibres carry this band, and probes go straight into reactors or measure through a glass vial.`),
        T(`因为峰重叠严重，定量靠多元校正：用几十到几百个已知样品建立偏最小二乘（PLS）模型，再去预测未知样品的含水量、蛋白质、辛烷值等。模型只在建模样品覆盖的范围内可靠。`, `Because the bands overlap badly, quantification rests on multivariate calibration: a partial-least-squares (PLS) model is built from tens to hundreds of known samples and then predicts moisture, protein, octane number and the like in unknowns. The model is reliable only within the range its calibration samples cover.`),
      ],
      axes: T(`横轴常用波长（nm），也有用波数的；纵轴是 log(1/R)（漫反射）或吸光度。常先做一阶或二阶导数、标准正态变换（SNV）来去掉散射造成的基线。`, `The x axis is usually wavelength (nm), sometimes wavenumber; the y axis is log(1/R) for diffuse reflection or absorbance. First or second derivatives and the standard normal variate (SNV) transform are routinely applied to remove scatter baselines.`),
      tells: [
        T(`粮食和饲料的水分、蛋白质、脂肪、淀粉（几秒钟，不破坏样品）。`, `Moisture, protein, fat and starch in grain and feed (seconds, non-destructive).`),
        T(`制药：原料进厂鉴别、混合均匀度、片剂含量、冻干残留水分。`, `Pharmaceuticals: raw-material identification, blend uniformity, tablet content, residual moisture after freeze-drying.`),
        T(`石化：汽油辛烷值、聚合物的羟值和共聚组成。`, `Petrochemicals: octane number of gasoline, hydroxyl number and copolymer composition of polymers.`),
      ],
      sample: T(`不需要制样：粉末、颗粒、整片药、液体都直接测，漫反射或透射。`, `No preparation: powders, granules, whole tablets and liquids are measured as they are, in diffuse reflection or transmission.`),
      nums: [
        [T(`液态水的主要谱带`, `Main bands of liquid water`), T(`约 1940 nm（ν₂+ν₃ 合频，5155 cm⁻¹）、1450 nm（O–H 一级泛频，6900 cm⁻¹）、1190 nm、970 nm`, `About 1940 nm (ν₂+ν₃ combination, 5155 cm⁻¹), 1450 nm (first O–H overtone, 6900 cm⁻¹), 1190 nm, 970 nm`)],
        [T(`C–H 一级泛频`, `First C–H overtone`), T(`约 1650–1800 nm`, `About 1650–1800 nm`)],
        [T(`典型检出限`, `Typical detection limit`), T(`约 0.1 %（质量分数），不适合痕量分析`, `About 0.1 % by mass; not a trace technique`)],
      ],
      read: [
        T(`近红外谱一般不逐峰归属，而是整段进模型；看模型的交叉验证误差（RMSECV）和预测误差（RMSEP）来判断好坏。`, `NIR spectra are rarely assigned band by band; whole regions go into a model, judged by its cross-validation error (RMSECV) and prediction error (RMSEP).`),
        T(`水的 1940 nm 带最强，样品含水量变化往往主导整张谱。`, `The 1940 nm water band is the strongest, and changes in moisture often dominate the whole spectrum.`),
      ],
      traps: [
        T(`模型外推不可信：换了原料产地、粒度或温度，都可能要重新校正。`, `Models do not extrapolate: a new raw-material source, particle size or temperature may all need recalibration.`),
        T(`粒度和装填松紧改变散射，会被误当成成分的变化。`, `Particle size and packing change scattering, which is easily mistaken for a change in composition.`),
      ],
      figs: [
        { gen: 'overtones', cap: T(`由实测光谱常数算出：HCl 的基频、一级和二级泛频的位置（2885.98、5667.98、8346.78 cm⁻¹）。如果是谐振子，泛频应在虚线处（基频的 2 倍、3 倍）；差值就是非谐性。棒的高度只是示意每高一阶弱几十倍。`, `From measured constants: the fundamental, first and second overtones of HCl (2885.98, 5667.98, 8346.78 cm⁻¹). For a harmonic oscillator the overtones would sit at the dashed lines (twice and three times the fundamental); the gap is the anharmonicity. Stick heights only illustrate that each order is tens of times weaker.`) },
        { sketch: { x: [800, 2500], xl: T(`波长（nm）`, `wavelength (nm)`), yl: T(`吸光度（示意）`, `absorbance (schematic)`), peaks: [[970, 0.03, 60, T(`2ν₁+ν₃`, `2ν₁+ν₃`)], [1190, 0.07, 70, T(`ν₁+ν₂+ν₃`, `ν₁+ν₂+ν₃`)], [1450, 0.42, 110, T(`O–H 一级泛频`, `first O–H overtone`)], [1940, 1, 120, T(`ν₂+ν₃ 合频`, `ν₂+ν₃ combination`)]], rise: [2300, 2500, 1.6] },
          cap: T(`示意：液态水的近红外吸收带。带的位置是文献里的通行数值（970、1190、1450、1940 nm），带形和相对高度是示意的；2500 nm 以外是 O–H 基频的强吸收。`, `Schematic: the near-infrared absorption bands of liquid water. Positions are the commonly quoted values (970, 1190, 1450, 1940 nm); shapes and relative heights are illustrative. Beyond 2500 nm lies the strong O–H fundamental.`) },
      ],
      refs: ['pasquini2018'],
    },
    {
      id: 'raman', fam: 'vib', core: true, abbr: 'Raman', name: T(`拉曼光谱`, `Raman spectroscopy`),
      one: T(`单色激光照在样品上，约一千万分之一的光子和分子振动交换能量后以不同的频率散射出来；频率的改变量就是振动频率。`, `A monochromatic laser strikes the sample and about one photon in ten million exchanges energy with a molecular vibration and scatters at a different frequency; the shift is the vibrational frequency.`),
      how: [
        T(`入射光的电场使分子的电子云感生出一个振荡偶极 μ = αE。如果振动改变了极化率 α，散射光里除了原频率（Rayleigh 散射），还有 ν₀ − ν_vib（Stokes）和 ν₀ + ν_vib（反 Stokes）两个边带。散射强度正比于 (∂α/∂Q)² 和 ν⁴。`, `The field of the incident light induces an oscillating dipole μ = αE in the electron cloud. If a vibration modulates the polarisability α, the scattered light carries, besides the original frequency (Rayleigh scattering), sidebands at ν₀ − ν_vib (Stokes) and ν₀ + ν_vib (anti-Stokes). The scattered intensity goes as (∂α/∂Q)² and ν⁴.`),
        T(`选律和红外互补：红外看偶极矩的变化，拉曼看极化率的变化。有对称中心的分子里一个振动不可能同时出现在两种谱里（互斥规则），CO₂、苯、乙烯都是例子。非极性的骨架振动（C=C、C≡C、S–S、芳环呼吸）在拉曼里强，极性基团（C=O、O–H）在红外里强。`, `The selection rule complements the infrared: IR sees a change in dipole moment, Raman a change in polarisability. In a molecule with a centre of symmetry no vibration appears in both (mutual exclusion), as in CO₂, benzene and ethylene. Non-polar skeletal motions (C=C, C≡C, S–S, ring breathing) are strong in Raman; polar groups (C=O, O–H) are strong in IR.`),
        T(`水的拉曼散射很弱，玻璃也几乎没有信号，所以拉曼可以直接测水溶液、隔着玻璃瓶和塑料袋测。最大的敌人是荧光：哪怕 ppm 级的荧光杂质，发出的光也比拉曼强几个数量级。换成 785 或 1064 nm 的近红外激光可以避开大部分荧光，代价是 ν⁴ 因子使信号变弱。`, `Water is a very weak Raman scatterer and glass gives almost no signal, so Raman works on aqueous solutions and through vials and plastic bags. The main enemy is fluorescence: even ppm of a fluorescent impurity outshines Raman scattering by orders of magnitude. Moving to 785 or 1064 nm excitation avoids most fluorescence at the cost of a weaker signal through the ν⁴ factor.`),
      ],
      axes: T(`横轴是拉曼位移 Δν̃ = 1/λ₀ − 1/λ_s（cm⁻¹），和激光波长无关；纵轴是散射强度（计数）。位移为 0 处是被滤掉的 Rayleigh 线。`, `The x axis is the Raman shift Δν̃ = 1/λ₀ − 1/λ_s (cm⁻¹), independent of the laser wavelength; the y axis is scattered intensity (counts). At zero shift sits the filtered-out Rayleigh line.`),
      tells: [
        T(`和红外互补的官能团和骨架信息；低至 10–200 cm⁻¹ 的晶格振动能区分药物的多晶型。`, `Functional-group and skeletal information complementary to IR; lattice modes down to 10–200 cm⁻¹ distinguish polymorphs of a drug.`),
        T(`碳材料：石墨烯和碳纳米管的 G 带（约 1580）、D 带（约 1350）和 2D 带给出层数和缺陷密度。`, `Carbon materials: the G band (about 1580), D band (about 1350) and 2D band of graphene and nanotubes give layer number and defect density.`),
        T(`显微拉曼的空间分辨率约 1 μm，可以做成分成像、鉴别微塑料和颜料。`, `Raman microscopy resolves about 1 μm, enabling chemical imaging and identification of microplastics and pigments.`),
        T(`偏振测量：退偏比 ρ < 0.75 的是全对称振动。`, `Polarisation measurements: bands with depolarisation ratio ρ < 0.75 are totally symmetric.`),
      ],
      sample: T(`固体、液体、气体都不用制样。激光功率要控制（显微下几毫瓦就可能烧坏深色样品）。`, `Solids, liquids and gases need no preparation. Laser power must be controlled (a few milliwatts under a microscope can burn dark samples).`),
      nums: [
        [T(`常用激光`, `Common lasers`), T(`532、633、785、1064 nm`, `532, 633, 785, 1064 nm`)],
        [T(`范围`, `Range`), T(`约 50–4000 cm⁻¹（低波数附件可到 5–10 cm⁻¹）`, `About 50–4000 cm⁻¹ (5–10 cm⁻¹ with low-frequency filters)`)],
        [T(`非共振拉曼散射截面`, `Non-resonant Raman cross-section`), T(`约 10⁻³⁰ cm² 每个分子每球面度，比红外吸收小十个数量级左右`, `About 10⁻³⁰ cm² per molecule per steradian, roughly ten orders of magnitude below IR absorption`)],
        [T(`反 Stokes / Stokes（1000 cm⁻¹，室温，532 nm）`, `Anti-Stokes / Stokes (1000 cm⁻¹, room temperature, 532 nm)`), T(`约 0.01`, `About 0.01`)],
      ],
      read: [
        T(`和红外一样先看特征区：2800–3100 的 C–H，2100–2250 的 C≡C / C≡N，1600 附近的 C=C 和芳环，1000 附近单取代苯的环呼吸（很尖很强）。`, `As in IR, start with the group region: C–H at 2800–3100, C≡C / C≡N at 2100–2250, C=C and aromatic rings near 1600, and the sharp, strong ring breathing of monosubstituted benzenes near 1000.`),
        T(`对称伸缩通常是最强、最尖的峰：CCl₄ 的 459、苯的 992、SO₄²⁻ 的 981、NO₃⁻ 的 1050 cm⁻¹。`, `Symmetric stretches are usually the strongest and sharpest: 459 for CCl₄, 992 for benzene, 981 for SO₄²⁻, 1050 cm⁻¹ for NO₃⁻.`),
        T(`聚乙烯的谱（下图）是聚合物拉曼的范例：C–C 骨架伸缩 1063 和 1130，CH₂ 扭转 1296，CH₂ 弯曲 1418–1460，C–H 伸缩 2848 和 2882。`, `The polyethylene spectrum below is a model polymer case: C–C skeletal stretches at 1063 and 1130, CH₂ twist at 1296, CH₂ bends at 1418–1460, C–H stretches at 2848 and 2882.`),
      ],
      traps: [
        T(`抬高的弯曲基线是荧光，不是拉曼信号；宇宙射线会在 CCD 上打出只有一两个像素宽的尖刺。`, `A raised, curved baseline is fluorescence, not Raman signal; cosmic rays leave spikes one or two pixels wide on the CCD.`),
        T(`激光加热会使样品相变、分解或者让峰位移动；先用低功率试。`, `Laser heating can cause phase changes or decomposition, or shift bands; start at low power.`),
        T(`不同仪器的相对强度不能直接比：光栅、检测器和激光波长都影响强度响应。`, `Relative intensities from different instruments are not directly comparable: grating, detector and laser wavelength all shape the response.`),
      ],
      figs: [
        { xy: 'raman-hdpe', xl: T(`拉曼位移（cm⁻¹）`, `Raman shift (cm⁻¹)`), yl: T(`强度（计数）`, `intensity (counts)`),
          marks: [[1063, T(`C–C 伸缩`, `C–C stretch`)], [1130, T(`C–C 伸缩`, `C–C stretch`)], [1296, T(`CH₂ 扭转`, `CH₂ twist`)], [1440, T(`CH₂ 弯曲`, `CH₂ bend`)], [2848, T(`C–H 对称伸缩`, `C–H sym. stretch`)], [2882, T(`C–H 反对称伸缩`, `C–H asym. stretch`)]],
          cap: T(`实测：高密度聚乙烯（HDPE）的拉曼谱，Horiba Scientific 提供，随 OpenSpecy 以 CC BY 4.0 发布。`, `Measured: the Raman spectrum of high-density polyethylene (HDPE), provided by Horiba Scientific and distributed with OpenSpecy under CC BY 4.0.`) },
        { vib: 'ccl4', mode: 'raman', pick: ['ccl4', 'benzene', 'co2', 'methane', 'water', 'ethanol', 'acetone', 'acetonitrile', 'chloroform', 'dcm', 'methanol', 'ethylene', 'acetylene', 'n2', 'o2', 'h2'],
          cap: T(`用密度泛函理论算出的拉曼谱（B3LYP/def2-TZVPD，极化率对简正坐标的导数用有限差分求出；强度按 532 nm 激发、298 K 换算）。灰色刻度是文献里的实验基频。`, `Raman spectra from density functional theory (B3LYP/def2-TZVPD, polarisability derivatives along normal modes by finite differences; intensities converted for 532 nm excitation at 298 K). Grey ticks are experimental fundamentals from the literature.`) },
      ],
      table: 'raman-bands', see: [['#lab-vib', T(`动手实验室：红外和拉曼对照`, `Hands-on lab: infrared against Raman`)]],
      refs: ['raman1928', 'cowger2021', 'rappoport2010'],
    },
    {
      id: 'sers', fam: 'vib', abbr: 'SERS · RR · TERS · CARS/SRS', name: T(`增强与非线性拉曼`, `Enhanced and nonlinear Raman`),
      one: T(`普通拉曼太弱。让激光和电子跃迁共振（共振拉曼）、把分子放到粗糙的金银表面（SERS）或针尖下（TERS）、或者用两束激光相干地驱动振动（CARS、SRS），可以把信号提高几个到十几个数量级。`, `Ordinary Raman scattering is feeble. Tuning the laser into an electronic transition (resonance Raman), placing molecules on rough gold or silver (SERS) or under a tip (TERS), or driving the vibration coherently with two lasers (CARS, SRS) raises the signal by several to more than ten orders of magnitude.`),
      how: [
        T(`表面增强拉曼（SERS）：金银纳米结构里的自由电子被光驱动发生局域表面等离激元共振，在颗粒间的缝隙（热点）里把电场增强 10–1000 倍。入射和散射两步都被增强，拉曼信号近似按 |E|⁴ 放大，平均增强因子 10⁴–10⁶，个别热点可到 10¹⁰ 以上，足以看到单个分子。另有一部分来自分子和金属之间的电荷转移（化学增强，约 10–100 倍）。`, `Surface-enhanced Raman scattering (SERS): light drives the free electrons of gold or silver nanostructures into localised surface-plasmon resonance, which concentrates the field 10–1000-fold in the gaps between particles (hot spots). Both the incident and the scattered step are enhanced, so the Raman signal scales roughly as |E|⁴: average enhancement factors are 10⁴–10⁶ and individual hot spots exceed 10¹⁰, enough to see single molecules. A further contribution comes from charge transfer between molecule and metal (chemical enhancement, about 10–100-fold).`),
        T(`共振拉曼：激光波长落在分子的电子吸收带里时，和这个电子跃迁耦合的振动被选择性增强 10³–10⁶ 倍。可以在一大堆蛋白质里只看血红素或视黄醛的振动。`, `Resonance Raman: when the laser falls inside an electronic absorption band, the vibrations coupled to that transition are selectively enhanced 10³–10⁶-fold. The haem or retinal chromophore can be observed inside a protein that is otherwise silent.`),
        T(`相干拉曼（CARS、SRS）：泵浦光和 Stokes 光的频率差等于振动频率时，样品里所有分子同相振动，信号强到可以视频速率成像，用于无标记的活细胞脂质和药物成像。SRS 的信号和浓度成正比，没有 CARS 的非共振背景。`, `Coherent Raman (CARS, SRS): when the difference between pump and Stokes frequencies matches a vibration, all molecules oscillate in phase and the signal supports video-rate imaging, used for label-free imaging of lipids and drugs in living cells. SRS is linear in concentration and free of the non-resonant background of CARS.`),
        T(`针尖增强拉曼（TERS）：把一个金或银的针尖当作单个热点扫过表面，空间分辨率到几纳米，极端条件下看到了单个分子内部的振动分布。`, `Tip-enhanced Raman (TERS): a gold or silver tip acts as a single hot spot scanned across a surface, giving a few nanometres of resolution and, under extreme conditions, the vibrational pattern inside a single molecule.`),
      ],
      axes: T(`和普通拉曼相同：拉曼位移对强度。SERS 里峰的相对强度和位置都可能因为吸附取向和表面选律而改变。`, `As in ordinary Raman: shift against intensity. In SERS both relative intensities and positions can change with adsorption geometry and the surface selection rules.`),
      tells: [
        T(`痕量检测：农药残留、毒品、爆炸物、水里的污染物，便携式仪器可到 ppb 级。`, `Trace detection: pesticide residues, drugs, explosives and water pollutants, down to ppb with portable instruments.`),
        T(`生物分子的发色团结构（共振拉曼）和无标记成像（SRS）。`, `Chromophore structure in biomolecules (resonance Raman) and label-free imaging (SRS).`),
        T(`电极表面和催化剂表面的吸附物种（电化学原位 SERS）。`, `Adsorbates on electrodes and catalysts (in-situ electrochemical SERS).`),
      ],
      sample: T(`SERS 需要基底：金或银的胶体、纳米结构芯片或粗糙化的电极，分子要吸附在表面 1–2 nm 以内。`, `SERS needs a substrate: gold or silver colloid, a nanostructured chip or a roughened electrode, with the molecule adsorbed within 1–2 nm of the surface.`),
      nums: [
        [T(`SERS 平均增强因子`, `Average SERS enhancement`), T(`10⁴–10⁶；单个热点 10⁸–10¹⁰ 以上`, `10⁴–10⁶; 10⁸–10¹⁰ or more in single hot spots`)],
        [T(`共振拉曼增强`, `Resonance Raman enhancement`), T(`10³–10⁶`, `10³–10⁶`)],
        [T(`TERS 空间分辨率`, `TERS spatial resolution`), T(`约 1–20 nm`, `About 1–20 nm`)],
      ],
      read: [
        T(`先确认是分析物的峰而不是柠檬酸根、表面活性剂等基底上本来就有的东西：测一张空白基底。`, `First confirm that a band belongs to the analyte and not to citrate, surfactant or whatever already sits on the substrate: record a blank.`),
        T(`SERS 定量要用内标（同位素标记的分析物最好），因为热点的增强因子相差几个数量级。`, `Quantitative SERS needs an internal standard (ideally an isotopologue of the analyte), because hot-spot enhancements differ by orders of magnitude.`),
      ],
      traps: [
        T(`重现性是 SERS 的老问题：不同批次的基底、胶体的聚集程度都会让信号相差几倍。`, `Reproducibility is the old problem of SERS: substrate batches and the degree of colloid aggregation change the signal several-fold.`),
        T(`强激光下分子会在热点里发生光化学反应（对巯基苯胺变成偶氮物就是著名的例子），谱里出现的“新峰”不一定是原来的分子。`, `Under intense light molecules react photochemically in hot spots (p-aminothiophenol turning into an azo compound is the famous case), so "new bands" do not always belong to the original molecule.`),
      ],
      figs: [
        { gen: 'crossSections', cap: T(`示意：一个分子和光作用的各种过程的截面大小（数量级，取自综述里通行的典型值）。普通拉曼比荧光弱十几个数量级，这就是各种增强手段存在的理由。`, `Schematic: the size of the cross-section, per molecule, for different light–matter processes (orders of magnitude, typical values quoted in reviews). Ordinary Raman is more than ten orders of magnitude weaker than fluorescence, which is why the enhancement schemes exist.`) },
      ],
      refs: ['fleischmann1974', 'jeanmaire1977', 'nie1997'],
    },
    {
      id: 'thz', fam: 'vib', abbr: 'Far-IR · THz-TDS', name: T(`远红外与太赫兹光谱`, `Far-infrared and terahertz spectroscopy`),
      one: T(`400 cm⁻¹ 以下（太赫兹区 0.1–10 THz，即 3–333 cm⁻¹）是重原子的伸缩、晶格振动、分子间氢键的整体运动和气体的纯转动跃迁。`, `Below 400 cm⁻¹ (the terahertz range 0.1–10 THz, or 3–333 cm⁻¹) lie stretches of heavy atoms, lattice vibrations, collective motions of hydrogen-bonded networks and pure rotational transitions of gases.`),
      how: [
        T(`这个波段夹在电子学（微波）和光学（红外）之间，过去缺少好的光源和检测器，被叫作“太赫兹空隙”。太赫兹时域光谱（THz-TDS）用飞秒激光打在光电导天线或非线性晶体上产生约 1 ps 的太赫兹脉冲，再用另一束飞秒光采样它的电场随时间的变化；傅里叶变换同时得到振幅和相位，于是折射率和吸收系数可以一次测出，不需要 Kramers–Kronig 变换。`, `This band sits between electronics (microwaves) and optics (infrared) and long lacked good sources and detectors, hence the "terahertz gap". Terahertz time-domain spectroscopy (THz-TDS) generates pulses about 1 ps long by firing a femtosecond laser at a photoconductive antenna or nonlinear crystal and samples their electric field in time with a second femtosecond beam; the Fourier transform yields amplitude and phase together, so refractive index and absorption coefficient come out at once without a Kramers–Kronig transform.`),
        T(`分子晶体在这里的吸收峰来自整个分子在晶格里的平动和摆动，对晶型极其敏感：同一种药物的不同多晶型、水合物和共晶的太赫兹谱完全不同。太赫兹光能穿透纸、塑料、陶瓷和衣物，但被水强烈吸收，被金属反射。`, `Absorption peaks of molecular crystals here come from whole molecules translating and librating in the lattice and are extremely sensitive to crystal form: polymorphs, hydrates and cocrystals of one drug have entirely different terahertz spectra. Terahertz light passes through paper, plastics, ceramics and clothing but is strongly absorbed by water and reflected by metals.`),
        T(`气体的纯转动谱也落在这里：HCl 的 J = 0 → 1 在 20.88 cm⁻¹（0.626 THz），往上每条线间隔约 2B。`, `Pure rotational spectra of light gases fall here too: J = 0 → 1 of HCl lies at 20.88 cm⁻¹ (0.626 THz), with further lines about 2B apart.`),
      ],
      axes: T(`横轴用 THz 或 cm⁻¹（1 THz = 33.36 cm⁻¹），纵轴是吸收系数（cm⁻¹）或折射率。`, `The x axis is in THz or cm⁻¹ (1 THz = 33.36 cm⁻¹); the y axis is absorption coefficient (cm⁻¹) or refractive index.`),
      tells: [
        T(`药物多晶型和结晶度；片剂包衣的厚度（太赫兹脉冲在每个界面反射一次）。`, `Polymorphism and crystallinity of drugs; coating thickness of tablets (a terahertz pulse reflects at each interface).`),
        T(`半导体里自由载流子的浓度和迁移率（不用接电极）。`, `Carrier density and mobility in semiconductors (without contacts).`),
        T(`金属–配体伸缩（M–Cl、M–S 在 200–400 cm⁻¹）、氢键网络的动力学。`, `Metal–ligand stretches (M–Cl, M–S at 200–400 cm⁻¹) and the dynamics of hydrogen-bond networks.`),
      ],
      sample: T(`固体常和聚乙烯粉（在太赫兹区透明）混合压片；光路要用干燥空气或氮气吹扫，因为水汽在这里有密集的转动线。`, `Solids are usually pressed with polyethylene powder (transparent in the terahertz range); the beam path is purged with dry air or nitrogen because water vapour has dense rotational lines here.`),
      nums: [
        [T(`THz-TDS 常用范围`, `Usual THz-TDS range`), T(`0.1–4 THz（3–130 cm⁻¹）`, `0.1–4 THz (3–130 cm⁻¹)`)],
        [T(`光子能量（1 THz）`, `Photon energy (1 THz)`), T(`4.14 meV，比室温的 kT（25.7 meV）还小`, `4.14 meV, less than kT at room temperature (25.7 meV)`)],
      ],
      read: [
        T(`晶体的峰尖，非晶的谱是一条随频率单调上升、没有特征的曲线：看有没有峰就能判断结晶与否。`, `Crystals give sharp peaks, amorphous solids a featureless monotonic rise: the presence of peaks alone tells crystalline from amorphous.`),
        T(`归属要靠固体的周期性 DFT 计算，孤立分子的计算在这个波段没有意义。`, `Assignment needs periodic solid-state DFT; an isolated-molecule calculation is meaningless in this range.`),
      ],
      traps: [
        T(`压片里的颗粒尺寸接近波长时散射会造成倾斜的基线；片子两个面之间的多次反射会给谱加上周期性的波纹（标准具效应）。`, `Particles comparable to the wavelength scatter and tilt the baseline; multiple reflections between the faces of a pellet add periodic ripples (the etalon effect).`),
      ],
      figs: [
        { gen: 'rotational', args: { mol: 'H35Cl', unit: 'cm' }, cap: T(`由实测光谱常数算出：HCl 的纯转动线（296 K）。J = 0 → 1 在 20.88 cm⁻¹，相邻线间隔约 2B₀ ≈ 20.9 cm⁻¹，离心畸变使间隔向高 J 略微变小。`, `From measured constants: the pure rotational lines of HCl at 296 K. J = 0 → 1 lies at 20.88 cm⁻¹ and the lines are about 2B₀ ≈ 20.9 cm⁻¹ apart, the spacing shrinking slightly at high J through centrifugal distortion.`) },
      ],
      refs: ['jepsen2011'],
    },
    {
      id: 'vcd', fam: 'vib', abbr: 'VCD · ROA', name: T(`振动圆二色与拉曼光学活性`, `Vibrational circular dichroism and Raman optical activity`),
      one: T(`手性分子对左、右圆偏振红外光的吸收有万分之一左右的差别（VCD），拉曼散射也有类似的差别（ROA）。一对对映体的谱大小相等、符号相反，和计算比较就能定出绝对构型，不需要单晶。`, `A chiral molecule absorbs left and right circularly polarised infrared light differently by about one part in ten thousand (VCD), and its Raman scattering shows a similar difference (ROA). Enantiomers give equal and opposite spectra, and comparison with calculation assigns the absolute configuration without a single crystal.`),
      how: [
        T(`VCD 的信号 ΔA = A_L − A_R 正比于转动强度 R = Im(μ·m)，即振动的电偶极跃迁矩和磁偶极跃迁矩的标量积。普通红外只取决于 |μ|²，两个对映体相同；R 在镜面反演下变号。比值 ΔA/A 只有 10⁻⁴–10⁻⁵，所以要用光弹调制器以几十 kHz 切换圆偏振方向并锁相检测，一张谱要累加一到几个小时。`, `The VCD signal ΔA = A_L − A_R is proportional to the rotational strength R = Im(μ·m), the scalar product of the electric and magnetic dipole transition moments of the vibration. Ordinary IR depends on |μ|² alone and is the same for both enantiomers; R changes sign on reflection. The ratio ΔA/A is only 10⁻⁴–10⁻⁵, so a photoelastic modulator switches the circular polarisation at tens of kHz with lock-in detection, and a spectrum takes one to several hours of averaging.`),
        T(`定绝对构型的流程：对一个指定的构型（比如 R）做构象搜索，用 DFT 算每个构象的红外和 VCD，按玻尔兹曼权重平均，再和实验比。符号一致就是 R，全部相反就是 S。因为一张 VCD 谱有几十个带正负号的峰，判断的把握比只有一个数的旋光度大得多。`, `Assigning absolute configuration: for a chosen configuration (say R) run a conformer search, compute IR and VCD for each conformer with DFT, Boltzmann-average, and compare with experiment. Matching signs mean R, all-opposite means S. With dozens of signed bands in one VCD spectrum the assignment is far more secure than the single number of an optical rotation.`),
        T(`拉曼光学活性（ROA）测的是左右圆偏振光的拉曼散射强度差，在水溶液里可用，对蛋白质和糖的骨架构象特别敏感。`, `Raman optical activity (ROA) measures the difference in Raman scattering of left and right circularly polarised light; it works in water and is especially sensitive to the backbone conformation of proteins and sugars.`),
      ],
      axes: T(`横轴是波数，纵轴是 ΔA（或 Δε），有正有负；通常和同一样品的普通红外谱上下对齐画。`, `Wavenumber against ΔA (or Δε), positive and negative; usually plotted aligned above the ordinary IR spectrum of the same sample.`),
      tells: [
        T(`溶液里手性分子的绝对构型（药物研发里常用，FDA 接受）。`, `Absolute configuration of chiral molecules in solution (routine in drug development and accepted by the FDA).`),
        T(`对映体过量（信号和 ee 成正比）和溶液里的优势构象。`, `Enantiomeric excess (the signal is proportional to ee) and the dominant conformers in solution.`),
      ],
      sample: T(`5–10 mg 样品溶在 100–150 μL 氘代溶剂（CDCl₃、DMSO-d₆）里，浓度约 0.05–0.2 mol/L，BaF₂ 池，光程约 100 μm。`, `5–10 mg of sample in 100–150 μL of deuterated solvent (CDCl₃, DMSO-d₆) at about 0.05–0.2 mol/L, in a BaF₂ cell of about 100 μm path.`),
      nums: [
        [T(`ΔA / A`, `ΔA / A`), T(`10⁻⁴–10⁻⁵`, `10⁻⁴–10⁻⁵`)],
        [T(`常用范围`, `Usual range`), T(`2000–900 cm⁻¹`, `2000–900 cm⁻¹`)],
      ],
      read: [
        T(`先确认计算的普通红外谱和实验对得上（峰位和相对强度），再比 VCD 的符号；红外都对不上，VCD 的比较没有意义。`, `First check that the computed ordinary IR spectrum matches experiment (positions and relative intensities), then compare VCD signs; if the IR does not match, comparing VCD is pointless.`),
        T(`最好同时测对映体或外消旋体来扣基线：真实的 VCD 信号在对映体之间严格镜像。`, `Ideally measure the enantiomer or the racemate for the baseline: a real VCD signal is an exact mirror image between enantiomers.`),
      ],
      traps: [
        T(`柔性分子有很多构象，漏掉一个重要构象就可能得到错误的符号；氢键二聚（羧酸）和溶剂配位也要算进去。`, `Flexible molecules have many conformers and missing an important one can flip signs; hydrogen-bonded dimers (carboxylic acids) and solvent coordination must be included.`),
      ],
      figs: [
        { sketch: { x: [1800, 1000], rev: true, xl: T(`波数（cm⁻¹）`, `wavenumber (cm⁻¹)`), yl: T(`ΔA（示意）`, `ΔA (schematic)`), zero: true, sets: [
          { label: T(`(R)-对映体`, `(R)-enantiomer`), peaks: [[1735, 0.9, 16], [1460, -0.35, 14], [1375, 0.55, 12], [1240, -1, 18], [1150, 0.7, 16], [1060, -0.45, 14]] },
          { label: T(`(S)-对映体`, `(S)-enantiomer`), dash: true, peaks: [[1735, -0.9, 16], [1460, 0.35, 14], [1375, -0.55, 12], [1240, 1, 18], [1150, -0.7, 16], [1060, 0.45, 14]] }] },
          cap: T(`示意图，不是某个真实分子的数据：一对对映体的 VCD 谱互为镜像。普通红外谱（没有画）两者完全相同。`, `A schematic, not data for any real molecule: the VCD spectra of two enantiomers are mirror images. Their ordinary IR spectra (not drawn) are identical.`) },
      ],
      refs: ['holzwarth1974', 'barron1973', 'stephens1994'],
    },
    {
      id: 'twodir', fam: 'vib', abbr: '2D-IR · pump–probe', name: T(`二维红外与超快振动光谱`, `Two-dimensional infrared and ultrafast vibrational spectroscopy`),
      one: T(`用飞秒红外脉冲序列把一张红外谱展开成二维：对角线上是普通的吸收峰，非对角的交叉峰说明两个振动互相耦合或者正在互相转化，时间分辨率不到一皮秒。`, `A sequence of femtosecond infrared pulses spreads an IR spectrum into two dimensions: the diagonal carries the ordinary absorption bands, and off-diagonal cross-peaks show that two vibrations are coupled or interconverting, with sub-picosecond time resolution.`),
      how: [
        T(`思路和二维核磁一样。先用一对泵浦脉冲给每个振动打上“频率标签”（激发频率 ω₁），等一段时间 T_w，再用探测脉冲读出这时它在哪个频率吸收（探测频率 ω₃）。如果振动 A 被激发后振动 B 的吸收发生了变化，(ω_A, ω_B) 处就出现交叉峰。`, `The idea is that of two-dimensional NMR. A pair of pump pulses labels each vibration with its excitation frequency ω₁; after a waiting time T_w a probe pulse reads out where it absorbs now (the detection frequency ω₃). If exciting vibration A changes the absorption of vibration B, a cross-peak appears at (ω_A, ω_B).`),
        T(`每个峰都是一对：v = 0→1 的漂白（一种符号）和 v = 1→2 的激发态吸收（相反符号），后者沿探测轴向低波数错开一个非谐性（酰胺 I 带约 16 cm⁻¹）。对角峰沿对角线拉长说明存在不均匀分布；随着 T_w 增大峰变圆的速度，就是分子环境涨落的速度（谱扩散）。`, `Each peak is a pair: the v = 0→1 bleach (one sign) and the v = 1→2 excited-state absorption (opposite sign), the latter displaced along the detection axis by the anharmonicity (about 16 cm⁻¹ for the amide I band). A diagonal peak stretched along the diagonal signals inhomogeneous broadening; how fast it becomes round as T_w grows is how fast the environment fluctuates (spectral diffusion).`),
        T(`红外的时间尺度比核磁快九个数量级，所以能看到皮秒内就平均掉的东西：水分子氢键的断裂和重组（约 1–2 ps）、肽链折叠的中间态、溶质和溶剂的络合交换。`, `The infrared timescale is nine orders of magnitude faster than NMR, so it catches what averages out within picoseconds: the breaking and reforming of water hydrogen bonds (about 1–2 ps), intermediates in peptide folding, exchange between solute–solvent complexes.`),
      ],
      axes: T(`横轴是激发（泵浦）频率 ω₁，纵轴是探测频率 ω₃（两家画法相反的都有），等高线的颜色表示吸收变化的正负。`, `One axis is the excitation (pump) frequency ω₁ and the other the detection frequency ω₃ (both conventions exist); contour colours give the sign of the absorption change.`),
      tells: [
        T(`蛋白质二级结构和它的变化：酰胺 I 带（1600–1700 cm⁻¹）里 α 螺旋、β 折叠各有特征的交叉峰图样。`, `Protein secondary structure and its changes: within the amide I band (1600–1700 cm⁻¹), α-helices and β-sheets have characteristic cross-peak patterns.`),
        T(`皮秒尺度的化学交换、氢键动力学、振动能量在分子内的流动。`, `Chemical exchange on picosecond timescales, hydrogen-bond dynamics and the flow of vibrational energy within a molecule.`),
      ],
      sample: T(`几十微米厚的液膜夹在 CaF₂ 窗片之间，吸光度约 0.1–0.5；研究水溶液里的蛋白质要用 D₂O，把水的弯曲振动（1645 cm⁻¹）移开。`, `A film tens of micrometres thick between CaF₂ windows with absorbance about 0.1–0.5; proteins are studied in D₂O to move the water bend (1645 cm⁻¹) out of the way.`),
      nums: [
        [T(`时间分辨率`, `Time resolution`), T(`约 50–100 fs`, `About 50–100 fs`)],
        [T(`可用的等待时间`, `Usable waiting times`), T(`受振动寿命限制，一般几皮秒到几十皮秒`, `Limited by the vibrational lifetime, typically a few to tens of picoseconds`)],
      ],
      read: [
        T(`先沿对角线找出和一维谱对应的峰，再看哪些成对的位置上有交叉峰。`, `Find the diagonal peaks that correspond to the one-dimensional spectrum, then see which pairs are joined by cross-peaks.`),
        T(`T_w = 0 时就有的交叉峰是耦合（结构信息）；随 T_w 长出来的交叉峰是交换或能量转移（动力学信息）。`, `Cross-peaks present at T_w = 0 report coupling (structure); those that grow with T_w report exchange or energy transfer (dynamics).`),
      ],
      traps: [
        T(`泵浦光散射进检测器会在对角线上留下假信号，要靠相位循环或斩波去掉。`, `Pump light scattered into the detector leaves artefacts on the diagonal that must be removed by phase cycling or chopping.`),
      ],
      figs: [
        { gen: 'twoD', args: { xl: T(`激发频率 ω₁（cm⁻¹）`, `excitation frequency ω₁ (cm⁻¹)`), yl: T(`探测频率 ω₃（cm⁻¹）`, `detection frequency ω₃ (cm⁻¹)`), range: [1580, 1720], peaks: [[1620, 1620, 1, 16], [1680, 1680, 0.8, 16], [1620, 1680, 0.35, 16], [1680, 1620, 0.35, 16]], anh: 16, diag: true },
          cap: T(`示意图：两个互相耦合的振动的二维红外谱。实线圈是漂白（0→1），虚线圈是激发态吸收（1→2），沿探测轴向低波数错开一个非谐性；非对角位置的交叉峰说明两个振动有耦合。`, `A schematic two-dimensional infrared spectrum of two coupled vibrations. Solid contours are the bleach (0→1), dashed ones the excited-state absorption (1→2) displaced to lower detection frequency by the anharmonicity; the off-diagonal cross-peaks show that the two vibrations are coupled.`) },
      ],
      refs: ['hamm1998', 'zewail2000'],
    },
    {
      id: 'sfg', fam: 'vib', abbr: 'SFG-VS', name: T(`和频振动光谱`, `Sum-frequency generation vibrational spectroscopy`),
      one: T(`一束可见光和一束可调的红外光在界面上重合，产生频率等于两者之和的光。这个二阶非线性过程在有反演对称性的体相里被禁阻，所以信号只来自界面上那一两层分子。`, `A visible beam and a tunable infrared beam overlap at an interface and generate light at the sum of their frequencies. This second-order nonlinear process is forbidden in a centrosymmetric bulk, so the signal comes only from the one or two molecular layers at the interface.`),
      how: [
        T(`和频信号的强度正比于 |χ⁽²⁾|²，二阶极化率 χ⁽²⁾ 是界面上所有分子的超极化率按取向求和。体相的液体和气体里分子取向随机，求和为零；界面打破了对称，分子有净取向，才有信号。当红外频率和某个振动共振时 χ⁽²⁾ 变大，扫描红外频率就得到界面分子的振动谱。一个振动要同时有红外活性和拉曼活性才能出现在和频谱里。`, `The sum-frequency intensity is proportional to |χ⁽²⁾|², where the second-order susceptibility χ⁽²⁾ is the sum of molecular hyperpolarisabilities over all orientations. In a bulk liquid or gas orientations are random and the sum vanishes; the interface breaks the symmetry, molecules acquire a net orientation, and a signal appears. χ⁽²⁾ grows when the infrared frequency hits a vibration, so scanning the infrared gives the vibrational spectrum of the interfacial molecules. A mode must be both IR- and Raman-active to appear.`),
        T(`改变三束光的偏振组合（ssp、ppp、sps）可以定出分子基团相对界面法线的取向角。相位敏感（外差）检测进一步给出 χ⁽²⁾ 的符号，也就是基团朝上还是朝下。`, `Changing the polarisation combination of the three beams (ssp, ppp, sps) gives the orientation of groups relative to the surface normal. Phase-sensitive (heterodyne) detection adds the sign of χ⁽²⁾, that is, whether a group points up or down.`),
        T(`最著名的结果是水的表面：在约 3700 cm⁻¹ 有一个尖峰，来自伸向气相、没有形成氢键的“自由 O–H”，表面水分子里有五分之一以上带着这样一个 O–H；3200–3500 cm⁻¹ 的宽带来自形成氢键的 O–H。`, `The best-known result is the surface of water: a sharp peak near 3700 cm⁻¹ from "free O–H" groups that dangle into the vapour without a hydrogen bond, carried by more than a fifth of the surface molecules, and a broad band at 3200–3500 cm⁻¹ from hydrogen-bonded O–H.`),
      ],
      axes: T(`横轴是红外波数，纵轴是和频信号强度（任意单位）或 Im χ⁽²⁾（外差检测，有正负）。`, `Infrared wavenumber against sum-frequency intensity (arbitrary units) or Im χ⁽²⁾ (heterodyne detection, signed).`),
      tells: [
        T(`气–液、液–液、固–液界面上分子的种类、取向和有序程度，包括被埋在里面、别的表面技术够不着的界面。`, `Identity, orientation and ordering of molecules at gas–liquid, liquid–liquid and solid–liquid interfaces, including buried interfaces that other surface techniques cannot reach.`),
        T(`表面活性剂和脂质单层的链有序度、电极和催化剂表面在工作状态下的吸附物种。`, `Chain ordering in surfactant and lipid monolayers; adsorbates on electrodes and catalysts under working conditions.`),
      ],
      sample: T(`任何光能到达的界面；需要皮秒或飞秒激光系统，不是常规仪器。`, `Any interface the beams can reach; it needs a picosecond or femtosecond laser system and is not a routine instrument.`),
      nums: [
        [T(`探测深度`, `Probing depth`), T(`对称性被打破的那一层，通常约 1 nm`, `The layer where symmetry is broken, typically about 1 nm`)],
        [T(`水表面自由 O–H`, `Free O–H at the water surface`), T(`约 3700 cm⁻¹`, `About 3700 cm⁻¹`)],
      ],
      read: [
        T(`峰的有无首先反映有序程度：全反式的烷基链只有末端 CH₃ 的峰（约 2875 cm⁻¹），出现 CH₂ 的峰（约 2850 cm⁻¹）说明链里有了扭曲构象。`, `Whether a band appears reflects ordering first: an all-trans alkyl chain shows only terminal CH₃ bands (about 2875 cm⁻¹), and a CH₂ band (about 2850 cm⁻¹) signals gauche defects.`),
      ],
      traps: [
        T(`强度谱 |χ⁽²⁾|² 里共振项和非共振背景会相互干涉，峰形可能变成凹陷或不对称，不能直接当成吸收谱来读峰位。`, `In the intensity spectrum |χ⁽²⁾|² resonant terms interfere with the non-resonant background, turning peaks into dips or asymmetric shapes; positions cannot be read as if it were an absorption spectrum.`),
      ],
      figs: [
        { sketch: { x: [3000, 3800], xl: T(`红外波数（cm⁻¹）`, `infrared wavenumber (cm⁻¹)`), yl: T(`和频强度（示意）`, `SFG intensity (schematic)`), peaks: [[3200, 0.55, 190], [3420, 0.75, 220], [3700, 1, 28, T(`自由 O–H`, `free O–H`)]] },
          cap: T(`示意：水–空气界面的和频振动谱（ssp 偏振）。尖峰在约 3700 cm⁻¹，是伸向气相的自由 O–H；宽带是氢键网络里的 O–H。峰位取文献通行值，峰形是示意的。`, `Schematic: the sum-frequency spectrum of the water–air interface (ssp polarisation). The sharp peak near 3700 cm⁻¹ is the free O–H pointing into the vapour; the broad band is hydrogen-bonded O–H. Positions follow the literature; shapes are illustrative.`) },
      ],
      refs: ['shen1989'],
    },
    {
      id: 'nanoir', fam: 'vib', abbr: 'IR microscopy · AFM-IR · s-SNOM · O-PTIR', name: T(`显微红外与纳米红外`, `Infrared microscopy and nano-infrared`),
      one: T(`把红外光谱和显微镜结合起来做化学成像。普通显微红外受衍射限制只能分辨几微米；用原子力显微镜的针尖或一束可见光去“读”红外吸收，可以到 10–500 nm。`, `Infrared spectroscopy combined with a microscope gives chemical images. Conventional IR microscopy is diffraction-limited to a few micrometres; reading the infrared absorption with an atomic-force-microscope tip or a visible probe beam reaches 10–500 nm.`),
      how: [
        T(`显微 FTIR：用反射式物镜把红外光聚到样品上，逐点扫描或用焦平面阵列检测器一次成像。衍射极限约 λ/2NA，在 1000 cm⁻¹（10 μm）处是好几微米；同步辐射光源亮度高，可以把光阑关到衍射极限还有足够信号。`, `FTIR microscopy: reflective objectives focus the infrared onto the sample, which is mapped point by point or imaged at once with a focal-plane-array detector. The diffraction limit of about λ/2NA is several micrometres at 1000 cm⁻¹ (10 μm); a synchrotron source is bright enough to close the aperture to that limit and still have signal.`),
        T(`AFM-IR（光热诱导共振）：可调谐的脉冲红外激光照在样品上，吸收了光的地方受热膨胀，把压在上面的 AFM 悬臂“踢”一下；悬臂的振幅对波数作图就是局部的红外吸收谱，和普通透射谱可以直接比。分辨率由针尖决定，约 10–50 nm。`, `AFM-IR (photothermal induced resonance): a tunable pulsed infrared laser illuminates the sample, the absorbing region heats and expands, and the expansion kicks an AFM cantilever resting on it; cantilever amplitude against wavenumber is the local absorption spectrum, directly comparable with ordinary transmission spectra. Resolution is set by the tip, about 10–50 nm.`),
        T(`散射型近场光学显微镜（s-SNOM）：金属针尖把红外光集中在尖端并把近场散射到远场，用干涉法同时测振幅和相位。光学光热红外（O-PTIR）：用一束可见激光探测红外吸收引起的折射率和体积变化，分辨率由可见光决定（约 500 nm），不接触样品，还能同时测拉曼。`, `Scattering-type near-field microscopy (s-SNOM): a metallic tip concentrates the infrared at its apex and scatters the near field to the far field, with amplitude and phase measured interferometrically. Optical photothermal infrared (O-PTIR): a visible laser senses the refractive-index and volume change caused by infrared absorption, so the resolution is that of visible light (about 500 nm), without contact and with simultaneous Raman.`),
      ],
      axes: T(`成像：x、y 是位置，颜色是某个波数的吸收强度（或两个带的比值）；点谱：波数对光热信号或近场振幅 / 相位。`, `Images: x and y are position and colour is the absorption at a chosen wavenumber (or the ratio of two bands); point spectra: wavenumber against photothermal signal or near-field amplitude / phase.`),
      tells: [
        T(`多层薄膜、共混聚合物里每一相是什么；单个细胞、组织切片的蛋白质、脂质、核酸分布。`, `What each phase is in multilayer films and polymer blends; the distribution of protein, lipid and nucleic acid in single cells and tissue sections.`),
        T(`微塑料、文物颜料、电子器件上污染物的鉴别。`, `Identification of microplastics, pigments in artworks and contaminants on electronic devices.`),
        T(`单根淀粉样纤维的二级结构、二维材料里的等离激元和声子极化激元（s-SNOM）。`, `Secondary structure of a single amyloid fibril; plasmon and phonon polaritons in two-dimensional materials (s-SNOM).`),
      ],
      sample: T(`透射要 5–10 μm 厚的切片放在 CaF₂ 或 BaF₂ 上；AFM-IR 要平整的薄样品（最好 100–1000 nm），放在 ZnSe 棱镜或金膜上。`, `Transmission needs 5–10 μm sections on CaF₂ or BaF₂; AFM-IR needs flat thin samples (ideally 100–1000 nm) on a ZnSe prism or a gold film.`),
      nums: [
        [T(`远场衍射极限（1000 cm⁻¹）`, `Far-field diffraction limit (1000 cm⁻¹)`), T(`约 5–10 μm`, `About 5–10 μm`)],
        [T(`O-PTIR`, `O-PTIR`), T(`约 0.5 μm`, `About 0.5 μm`)],
        [T(`AFM-IR、s-SNOM`, `AFM-IR, s-SNOM`), T(`约 10–50 nm`, `About 10–50 nm`)],
      ],
      read: [
        T(`成像时用两个带的强度比（比如酰胺 I 带对脂质的酯羰基）而不是单个带的绝对强度，以消除厚度的影响。`, `For images use the ratio of two bands (say amide I to the lipid ester carbonyl) rather than the absolute intensity of one, to remove the effect of thickness.`),
      ],
      traps: [
        T(`细胞和颗粒的尺寸和波长相当，Mie 散射会让基线起伏、峰位偏移，要用专门的散射校正。`, `Cells and particles are comparable in size to the wavelength, and Mie scattering distorts baselines and shifts bands; a dedicated scattering correction is needed.`),
        T(`AFM-IR 的信号还和样品的热膨胀系数、力学性质有关，定量比较要谨慎。`, `AFM-IR signals also depend on thermal expansion and mechanical properties of the sample, so quantitative comparison needs care.`),
      ],
      figs: [
        { gen: 'bars', args: { log: true, unit: 'nm', xl: T(`空间分辨率（nm，对数刻度）`, `spatial resolution (nm, log scale)`), rows: [[T(`显微 FTIR（衍射极限，1000 cm⁻¹）`, `FTIR microscopy (diffraction limit, 1000 cm⁻¹)`), 5000, 10000], [T(`ATR 成像（Ge 晶体）`, `ATR imaging (Ge crystal)`), 1500, 4000], [T(`O-PTIR`, `O-PTIR`), 400, 600], [T(`AFM-IR`, `AFM-IR`), 10, 50], [T(`s-SNOM`, `s-SNOM`), 10, 30], [T(`TERS（拉曼）`, `TERS (Raman)`), 1, 20]] },
          cap: T(`示意：几种红外成像方式能达到的空间分辨率（典型范围，取自综述和仪器文献的通行数值）。`, `Schematic: spatial resolution reached by several infrared imaging modes (typical ranges as commonly quoted in reviews and instrument literature).`) },
      ],
      refs: ['dazzi2005', 'griffiths1983'],
    },
  );
})();
