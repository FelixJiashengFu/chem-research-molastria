'use strict';
// 谱图馆 · 电子光谱一族（紫外-可见、荧光、圆二色、瞬态吸收、漫反射）。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'uvvis', fam: 'elec', core: true, abbr: 'UV-Vis', name: T(`紫外-可见吸收光谱`, `Ultraviolet–visible absorption spectroscopy`),
      one: T(`190–800 nm 的光把电子从占据轨道激发到空轨道。吸收带的位置反映共轭体系的大小和金属离子的 d 轨道分裂，吸光度正比于浓度，是用得最多的定量方法。`, `Light of 190–800 nm promotes electrons from occupied to empty orbitals. Band positions reflect the size of a conjugated system or the d-orbital splitting of a metal ion, and absorbance is proportional to concentration, which makes this the most widely used quantitative method.`),
      how: [
        T(`朗伯–比尔定律：A = −log₁₀(I/I₀) = ε·c·l。ε 是摩尔吸光系数（L mol⁻¹ cm⁻¹），c 是浓度，l 是光程。ε 的大小由跃迁是否“允许”决定：π→π* 是 10⁴–10⁵，n→π*（羰基约 280 nm）只有 10–100，八面体配合物的 d–d 跃迁 1–100，电荷转移跃迁 10³–10⁵（高锰酸根 525 nm 处约 2400）。`, `The Beer–Lambert law: A = −log₁₀(I/I₀) = ε·c·l, with ε the molar absorption coefficient (L mol⁻¹ cm⁻¹), c the concentration and l the path length. The size of ε depends on how allowed the transition is: 10⁴–10⁵ for π→π*, only 10–100 for n→π* (carbonyls near 280 nm), 1–100 for d–d transitions of octahedral complexes and 10³–10⁵ for charge transfer (about 2400 for permanganate at 525 nm).`),
        T(`共轭越长，HOMO 和 LUMO 的间隔越小，吸收越向长波移动：乙烯 162 nm，丁二烯 217 nm，己三烯 258 nm，β-胡萝卜素（11 个共轭双键）450 nm，已经进入可见区，所以是橙色的。看到的颜色是被吸收颜色的补色。`, `The longer the conjugation, the smaller the HOMO–LUMO gap and the longer the wavelength: ethylene 162 nm, butadiene 217 nm, hexatriene 258 nm, and β-carotene with eleven conjugated double bonds 450 nm, inside the visible, hence orange. The colour seen is the complement of the colour absorbed.`),
        T(`溶液里的吸收带很宽（几十纳米），因为一个电子跃迁上叠着许多振动能级，再被溶剂涨落抹平。苯在 255 nm 的带是少数还能看到振动精细结构的例子（间隔约 920 cm⁻¹）。溶剂极性会移动谱带：n→π* 在极性溶剂里蓝移，电荷转移带（如对硝基苯胺）强烈红移。`, `Bands in solution are broad (tens of nanometres) because each electronic transition carries many vibrational levels smeared by solvent fluctuations. The 255 nm band of benzene is one of the few that still shows vibrational fine structure (spacing about 920 cm⁻¹). Solvent polarity shifts bands: n→π* moves to the blue in polar solvents, charge-transfer bands (as in p-nitroaniline) strongly to the red.`),
      ],
      axes: T(`横轴是波长 λ（nm），纵轴是吸光度 A 或摩尔吸光系数 ε。报告一个带要给 λ_max 和 ε_max，并注明溶剂。`, `Wavelength λ (nm) against absorbance A or molar absorption coefficient ε. A band is reported by its λ_max and ε_max, with the solvent stated.`),
      tells: [
        T(`浓度：蛋白质（280 nm）、核酸（260 nm，A₂₆₀ = 1 约等于 50 μg/mL 双链 DNA）、NADH（340 nm，ε = 6220）、酶活测定、溶出度、水质指标。`, `Concentration: proteins (280 nm), nucleic acids (260 nm; A₂₆₀ = 1 is about 50 μg/mL of double-stranded DNA), NADH (340 nm, ε = 6220), enzyme assays, dissolution testing, water-quality indices.`),
        T(`有没有共轭体系、芳环、羰基，以及共轭有多长（Woodward–Fieser 规则）。`, `Whether a conjugated system, aromatic ring or carbonyl is present, and how long the conjugation is (the Woodward–Fieser rules).`),
        T(`配合物的配位场分裂 Δ、电荷转移带、氧化态。`, `Ligand-field splitting Δ, charge-transfer bands and oxidation states of complexes.`),
        T(`反应动力学和平衡：跟踪吸光度随时间的变化；等吸收点说明只有两个物种在互变。`, `Kinetics and equilibria: follow absorbance in time; an isosbestic point shows that only two species interconvert.`),
      ],
      sample: T(`稀溶液（10⁻⁶–10⁻⁴ mol/L）装在 1 cm 石英比色皿里；玻璃和塑料皿只能用到约 320 nm 以上。溶剂在测量波长要透明：水和乙腈可到 190 nm，甲醇 205，二氯甲烷 233，氯仿 245，丙酮 330 nm 以上才能用。`, `A dilute solution (10⁻⁶–10⁻⁴ mol/L) in a 1 cm quartz cuvette; glass and plastic only work above about 320 nm. The solvent must be transparent at the wavelength: water and acetonitrile down to 190 nm, methanol 205, dichloromethane 233, chloroform 245, acetone only above 330 nm.`),
      nums: [
        [T(`范围`, `Range`), T(`190–800 nm（带近红外的仪器到 3300 nm）`, `190–800 nm (to 3300 nm on UV-Vis-NIR instruments)`)],
        [T(`吸光度最准的区间`, `Most accurate absorbance window`), T(`0.1–1.0`, `0.1–1.0`)],
        [T(`检出限`, `Detection limit`), T(`ε 为 10⁴–10⁵ 时约 10⁻⁷–10⁻⁶ mol/L`, `About 10⁻⁷–10⁻⁶ mol/L for ε of 10⁴–10⁵`)],
        [T(`1 eV 对应`, `1 eV corresponds to`), T(`1239.8 nm；400–700 nm 是 3.10–1.77 eV`, `1239.8 nm; 400–700 nm is 3.10–1.77 eV`)],
      ],
      read: [
        T(`先看最长波长的带在哪里、ε 多大：ε 上万的是 π→π* 或电荷转移，ε 几十的弱带是 n→π* 或 d–d。`, `Look first at the longest-wavelength band and its ε: tens of thousands means π→π* or charge transfer, a weak band of a few tens means n→π* or d–d.`),
        T(`做定量前先扫全谱找到 λ_max，在峰顶测量：那里斜率为零，波长稍有偏差也不影响吸光度。`, `Before quantifying, scan the full spectrum to find λ_max and measure at the peak, where the slope is zero and a small wavelength error does not change the absorbance.`),
        T(`做一条标准曲线（至少 5 个浓度）并检查线性，不要只靠文献的 ε。`, `Build a calibration curve (at least five concentrations) and check linearity rather than relying on a literature ε.`),
      ],
      traps: [
        T(`吸光度超过 2 以后，透过的光不到 1 %，杂散光让读数偏低，标准曲线向下弯。把样品稀释，或换短光程的皿。`, `Above an absorbance of 2 less than 1 % of the light gets through, stray light makes readings low and the calibration curve bends over. Dilute the sample or use a shorter path.`),
        T(`浑浊的样品散射光，表观吸光度随波长变短单调升高，不是真的吸收。`, `Turbid samples scatter, giving an apparent absorbance that rises steadily towards short wavelength without being real absorption.`),
        T(`计算的垂直激发能和实验的 λ_max 不是同一个量：TDDFT 的误差通常 0.2–0.5 eV，换一个泛函结果就不同（下图可以切换）。`, `A computed vertical excitation energy is not the same quantity as an experimental λ_max: TDDFT errors are typically 0.2–0.5 eV and change with the functional (switch it in the figure below).`),
      ],
      figs: [
        { uv: 'benzene', pick: ['ethylene', 'butadiene', 'hexatriene', 'octatetraene', 'benzene', 'naphthalene', 'anthracene', 'formaldehyde', 'acetone', 'pyridine', 'pna', 'azobenzene', 'caffeine'],
          cap: T(`用含时密度泛函理论（TDDFT）算出的垂直激发：棒是每个单重激发态的位置和振子强度，曲线是展宽 0.4 eV 后的包络。孤立分子、没有振动结构、没有溶剂。灰色刻度是文献里的实验吸收峰。多烯和并苯两个系列里可以看到共轭变长时吸收向长波移动。`, `Vertical excitations from time-dependent density functional theory (TDDFT): sticks mark each singlet excited state and its oscillator strength, and the curve is their envelope after 0.4 eV broadening. Isolated molecule, no vibrational structure, no solvent. Grey ticks are experimental absorption maxima from the literature. The polyene and acene series show the absorption moving to longer wavelength as conjugation grows.`) },
        { gen: 'beer', cap: T(`由公式算出：有 0.1 % 杂散光时表观吸光度对真实吸光度的偏离。A = 2 处低了约 2 %，A = 3 处已经低了约 10 %。`, `From the formula: how apparent absorbance departs from true absorbance with 0.1 % stray light. At A = 2 it reads about 2 % low, at A = 3 already about 10 %.`) },
      ],
      table: 'uv-chromophores', see: [['#lab-uv', T(`动手实验室：共轭长度和吸收波长`, `Hands-on lab: conjugation length and absorption wavelength`)]],
      refs: ['woodward1941', 'mayerhofer2020', 'yanai2004'],
    },
    {
      id: 'fluor', fam: 'elec', core: true, abbr: 'FL · PL', name: T(`荧光与磷光光谱`, `Fluorescence and phosphorescence spectroscopy`),
      one: T(`分子吸收光后在纳秒内从最低单重激发态发光回到基态（荧光），或经系间窜越到三重态后在微秒到秒的时间里发光（磷光）。在暗背景上测发光，灵敏度比吸收高三个数量级以上。`, `After absorbing light a molecule emits from its lowest excited singlet state within nanoseconds (fluorescence), or crosses to a triplet state and emits over microseconds to seconds (phosphorescence). Measuring light against a dark background is three or more orders of magnitude more sensitive than absorption.`),
      how: [
        T(`Jablonski 图概括了全过程：吸收（约 10⁻¹⁵ s）把分子送到 S₁ 或更高的 Sₙ 的某个振动能级；振动弛豫和内转换在约 10⁻¹² s 内让它落到 S₁ 的最低振动能级（Kasha 规则：发光几乎总是从这里出发）；然后是荧光（10⁻⁹–10⁻⁷ s）、无辐射失活，或者系间窜越到 T₁ 再发磷光。`, `The Jablonski diagram summarises it: absorption (about 10⁻¹⁵ s) lifts the molecule to a vibrational level of S₁ or a higher Sₙ; vibrational relaxation and internal conversion bring it within about 10⁻¹² s to the lowest vibrational level of S₁ (Kasha's rule: emission nearly always starts there); then come fluorescence (10⁻⁹–10⁻⁷ s), non-radiative decay, or intersystem crossing to T₁ followed by phosphorescence.`),
        T(`因为激发态先丢掉了一部分能量，发射总在吸收的长波一侧，两者峰位之差叫 Stokes 位移。发射谱常常是吸收谱最长波带的镜像（基态和激发态的振动间隔相近）。发射谱的形状不随激发波长变化，这是判断样品里是否只有一种发光物种的依据。`, `Because the excited state first loses some energy, emission always lies to the red of absorption; the difference between the maxima is the Stokes shift. The emission spectrum is often the mirror image of the longest-wavelength absorption band (vibrational spacings in the ground and excited states are similar). Its shape does not depend on the excitation wavelength, which is the test for a single emitting species.`),
        T(`量子产率 Φ = 发出的光子数 / 吸收的光子数 = k_r / (k_r + k_nr)，寿命 τ = 1 / (k_r + k_nr)。猝灭剂（O₂、I⁻、丙烯酰胺）按 Stern–Volmer 关系降低强度：F₀/F = 1 + K_SV[Q]。Förster 共振能量转移（FRET）的效率按 1/(1 + (r/R₀)⁶) 随距离变化，R₀ 一般 2–6 nm，被叫作“分子尺”。`, `The quantum yield Φ = photons emitted / photons absorbed = k_r / (k_r + k_nr) and the lifetime τ = 1 / (k_r + k_nr). Quenchers (O₂, I⁻, acrylamide) lower the intensity by the Stern–Volmer relation F₀/F = 1 + K_SV[Q]. Förster resonance energy transfer (FRET) has an efficiency 1/(1 + (r/R₀)⁶), with R₀ typically 2–6 nm, and serves as a molecular ruler.`),
      ],
      axes: T(`发射谱：固定激发波长，横轴是发射波长，纵轴是强度。激发谱：固定发射波长扫激发波长，形状应当和吸收谱一致。三维的激发–发射矩阵（EEM）用于水里溶解有机质的指纹。`, `Emission spectrum: fixed excitation wavelength, emission wavelength against intensity. Excitation spectrum: fixed emission wavelength while scanning excitation; it should match the absorption spectrum. Three-dimensional excitation–emission matrices (EEM) fingerprint dissolved organic matter in water.`),
      tells: [
        T(`痕量定量：多环芳烃、维生素、黄曲霉毒素、荧光标记的生物分子，可到 10⁻⁹–10⁻¹² mol/L，极限是单分子。`, `Trace quantification: polycyclic aromatics, vitamins, aflatoxins and fluorescently labelled biomolecules, down to 10⁻⁹–10⁻¹² mol/L and ultimately single molecules.`),
        T(`微环境：色氨酸的发射峰从埋在蛋白内部的约 330 nm 移到暴露在水里的约 350 nm，可以跟踪蛋白质去折叠。`, `Microenvironment: tryptophan emission moves from about 330 nm when buried inside a protein to about 350 nm when exposed to water, tracking unfolding.`),
        T(`距离（FRET）、转动扩散和结合（荧光各向异性）、离子浓度和 pH（荧光探针）。`, `Distances (FRET), rotational diffusion and binding (fluorescence anisotropy), ion concentrations and pH (fluorescent probes).`),
        T(`材料的发光效率、带隙和缺陷态（光致发光）。`, `Emission efficiency, band gap and defect states of materials (photoluminescence).`),
      ],
      sample: T(`四面透光的石英皿，直角几何（在 90° 方向收光）。溶液在激发波长的吸光度要低于 0.05–0.1，否则内滤效应使强度不再正比于浓度。测磷光通常要除氧或冷到 77 K。`, `A quartz cuvette clear on all four sides, with right-angle geometry (emission collected at 90°). Absorbance at the excitation wavelength should stay below 0.05–0.1, or the inner-filter effect breaks the proportionality to concentration. Phosphorescence usually needs deoxygenation or cooling to 77 K.`),
      nums: [
        [T(`荧光寿命`, `Fluorescence lifetimes`), T(`0.1–20 ns（荧光素约 4.0 ns）`, `0.1–20 ns (about 4.0 ns for fluorescein)`)],
        [T(`磷光寿命`, `Phosphorescence lifetimes`), T(`10⁻⁶–10 s`, `10⁻⁶–10 s`)],
        [T(`量子产率标准`, `Quantum-yield standards`), T(`硫酸奎宁在 0.1 mol/L HClO₄ 中 Φ = 0.60；荧光素在 0.1 mol/L NaOH 中约 0.9`, `Quinine sulfate in 0.1 mol/L HClO₄, Φ = 0.60; fluorescein in 0.1 mol/L NaOH, about 0.9`)],
        [T(`色氨酸`, `Tryptophan`), T(`激发 280–295 nm，发射 330–350 nm`, `Excitation 280–295 nm, emission 330–350 nm`)],
      ],
      read: [
        T(`先认出不是荧光的峰：激发波长处的 Rayleigh 散射、它的二级衍射（2λ_ex 处），以及溶剂的拉曼峰（水的拉曼峰在激发线红移约 3400 cm⁻¹ 处：350 nm 激发时在 397 nm）。换激发波长，拉曼峰跟着走，荧光峰不动。`, `First recognise what is not fluorescence: Rayleigh scatter at the excitation wavelength, its second order at 2λ_ex, and the Raman band of the solvent (for water about 3400 cm⁻¹ to the red of the excitation line: at 397 nm for 350 nm excitation). Change the excitation wavelength: the Raman band follows, the fluorescence stays.`),
        T(`比较不同仪器的谱要先做发射校正（检测器和光栅的灵敏度随波长变化）。`, `Comparing spectra between instruments requires emission correction (detector and grating sensitivity vary with wavelength).`),
        T(`相对法测量子产率：Φ = Φ_ref · (F/F_ref) · (A_ref/A) · (n²/n_ref²)，样品和标准在同一激发波长、吸光度都低于 0.05。`, `Relative quantum yields: Φ = Φ_ref · (F/F_ref) · (A_ref/A) · (n²/n_ref²), with sample and standard at the same excitation wavelength and both absorbances below 0.05.`),
      ],
      traps: [
        T(`浓度高了强度反而下降：内滤效应（激发光在到达皿中心之前就被吸收了）和自吸收（发射光被样品重新吸收，短波一侧被削掉）。`, `Intensity falls at high concentration: the inner-filter effect (excitation light is absorbed before reaching the centre of the cell) and self-absorption (emitted light is reabsorbed, cutting the short-wavelength edge).`),
        T(`光漂白：染料在强光下不可逆地分解，信号随时间下降。`, `Photobleaching: dyes decompose irreversibly under strong light and the signal drifts down.`),
        T(`硫酸奎宁在 0.5 mol/L H₂SO₄ 里的老标准值 0.546 随温度变化明显，IUPAC 2011 年的技术报告改为推荐高氯酸溶液。`, `The old standard value of 0.546 for quinine sulfate in 0.5 mol/L H₂SO₄ depends noticeably on temperature; the 2011 IUPAC technical report recommends the perchloric acid solution instead.`),
      ],
      figs: [
        { gen: 'jablonski', cap: T(`示意：Jablonski 图。直线箭头是辐射跃迁（吸收、荧光、磷光），波浪箭头是无辐射过程（振动弛豫、内转换、系间窜越）；右边标的是各过程的典型时间尺度。`, `Schematic: a Jablonski diagram. Straight arrows are radiative transitions (absorption, fluorescence, phosphorescence) and wavy arrows non-radiative processes (vibrational relaxation, internal conversion, intersystem crossing), with typical timescales.`) },
        { sketch: { x: [300, 500], xl: T(`波长（nm）`, `wavelength (nm)`), yl: T(`归一化强度（示意）`, `normalised intensity (schematic)`), sets: [
          { label: T(`吸收`, `absorption`), peaks: [[375, 0.95, 7, T(`0–0`, `0–0`)], [356, 1, 8], [339, 0.62, 8], [323, 0.3, 8]] },
          { label: T(`荧光`, `fluorescence`), alt: true, peaks: [[380, 0.9, 8, T(`0–0`, `0–0`)], [401, 1, 10], [425, 0.6, 11], [451, 0.24, 12]] }] },
          cap: T(`示意：蒽在环己烷里的吸收和荧光（镜像关系）。峰位取文献通行值（吸收 323、339、356、375 nm；荧光 380、401、425、451 nm，振动间隔约 1400 cm⁻¹），带形和相对高度是示意的。`, `Schematic: absorption and fluorescence of anthracene in cyclohexane (the mirror-image rule). Peak positions are the commonly quoted values (absorption 323, 339, 356, 375 nm; fluorescence 380, 401, 425, 451 nm; vibrational spacing about 1400 cm⁻¹); shapes and relative heights are illustrative.`) },
      ],
      refs: ['stokes1852', 'kasha1950', 'brouwer2011'],
    },
    {
      id: 'lifetime', fam: 'elec', abbr: 'TCSPC · FLIM', name: T(`时间分辨荧光`, `Time-resolved fluorescence`),
      one: T(`测激发态活多久，而不只是发多少光。寿命不依赖浓度和光强，是比强度更可靠的量。主流方法是时间相关单光子计数（TCSPC）。`, `Measure how long the excited state lives rather than how much light it emits. The lifetime does not depend on concentration or excitation intensity, which makes it more robust than intensity. The standard method is time-correlated single-photon counting (TCSPC).`),
      how: [
        T(`TCSPC：皮秒脉冲激光以 MHz 的频率反复激发样品，把发射光衰减到每 20–100 个脉冲才检测到一个光子，记下这个光子相对激光脉冲的到达时间。上百万次以后，到达时间的直方图就是荧光衰减曲线 I(t) = Σ aᵢ exp(−t/τᵢ)。光子计数服从 Poisson 统计，每个通道的噪声是 √N，所以拟合的好坏有明确的判据（约化 χ² 接近 1，残差随机）。`, `TCSPC: a picosecond laser excites the sample repeatedly at MHz rates, and the emission is attenuated until only one photon is detected per 20–100 pulses; the arrival time of that photon relative to the laser pulse is recorded. After millions of events the histogram of arrival times is the decay I(t) = Σ aᵢ exp(−t/τᵢ). Photon counts are Poisson-distributed with √N noise per channel, so fit quality has a clear criterion (reduced χ² near 1, random residuals).`),
        T(`测到的曲线是真实衰减和仪器响应函数（IRF，激光脉宽加检测器的时间抖动，几十到几百皮秒）的卷积；拟合时要把模型和实测的 IRF 重新卷积。IRF 用散射体（稀的胶体硅）在激发波长处测。`, `The measured curve is the true decay convolved with the instrument response function (IRF: laser pulse width plus detector timing jitter, tens to hundreds of picoseconds); the fit reconvolves the model with a measured IRF, recorded from a scatterer (dilute colloidal silica) at the excitation wavelength.`),
        T(`荧光寿命成像（FLIM）在显微镜的每个像素测一条衰减，用寿命而不是强度做对比度，可以不受探针浓度影响地读出 pH、粘度、离子浓度和 FRET 效率（E = 1 − τ_DA/τ_D）。`, `Fluorescence lifetime imaging (FLIM) records a decay in every pixel of a microscope image and uses lifetime rather than intensity as contrast, reading out pH, viscosity, ion concentration and FRET efficiency (E = 1 − τ_DA/τ_D) independently of probe concentration.`),
      ],
      axes: T(`横轴是时间（ns），纵轴是光子计数，用对数刻度：单指数衰减是一条直线，斜率是 −1/τ。`, `Time (ns) against photon counts on a logarithmic scale: a single-exponential decay is a straight line of slope −1/τ.`),
      tells: [
        T(`区分动态猝灭（寿命变短）和静态猝灭（寿命不变，只有强度下降）。`, `Dynamic quenching (the lifetime shortens) against static quenching (the lifetime is unchanged while intensity drops).`),
        T(`混合物里发射谱重叠但寿命不同的组分；蛋白质里色氨酸所处的不同构象。`, `Components with overlapping emission spectra but different lifetimes; different conformations around tryptophan in a protein.`),
        T(`时间分辨各向异性给出分子的转动相关时间，也就是大小和柔性。`, `Time-resolved anisotropy gives the rotational correlation time, hence size and flexibility.`),
      ],
      sample: T(`和稳态荧光一样的稀溶液；计数率不要超过激光重复频率的 1–5 %，否则“堆积效应”会使曲线向短时间歪。`, `The same dilute solutions as steady-state fluorescence; keep the count rate below 1–5 % of the laser repetition rate or pile-up skews the curve towards short times.`),
      nums: [
        [T(`时间分辨率`, `Time resolution`), T(`IRF 约 30–200 ps；重新卷积后可分辨 IRF 的十分之一左右`, `IRF about 30–200 ps; about a tenth of the IRF after reconvolution`)],
        [T(`峰值计数`, `Peak counts`), T(`通常累积到 10⁴`, `Usually collected to 10⁴`)],
      ],
      read: [
        T(`先用单指数拟合，残差有系统性的起伏再加第二个指数；指数个数不要多于数据能支持的。`, `Fit one exponential first and add a second only if the residuals show systematic structure; do not use more exponentials than the data support.`),
        T(`多指数衰减的平均寿命要说明是哪一种：振幅加权 ⟨τ⟩ = Σaᵢτᵢ / Σaᵢ 还是强度加权 Σaᵢτᵢ² / Σaᵢτᵢ。`, `For multi-exponential decays say which mean lifetime is meant: amplitude-weighted ⟨τ⟩ = Σaᵢτᵢ / Σaᵢ or intensity-weighted Σaᵢτᵢ² / Σaᵢτᵢ.`),
      ],
      traps: [
        T(`偏振效应：转动得慢的大分子要在“魔角”（54.7°）下检测，否则转动会混进衰减曲线。`, `Polarisation: slowly rotating large molecules must be detected at the magic angle (54.7°), or rotation leaks into the decay.`),
      ],
      figs: [
        { gen: 'decay', cap: T(`模型计算：两条荧光衰减（τ = 1 ns 和 4 ns）和仪器响应（高斯型，半高宽约 0.24 ns）卷积后的样子，对数纵轴。单指数衰减在对数图上是直线。`, `Model calculation: two fluorescence decays (τ = 1 ns and 4 ns) convolved with a Gaussian instrument response (about 0.24 ns FWHM), on a logarithmic axis. A single-exponential decay is a straight line on this plot.`) },
      ],
      refs: ['brouwer2011', 'kasha1950'],
    },
    {
      id: 'cd', fam: 'elec', core: true, abbr: 'CD · ORD', name: T(`圆二色光谱`, `Circular dichroism spectroscopy`),
      one: T(`手性分子对左、右圆偏振光的吸收略有不同。远紫外区（190–250 nm）的圆二色谱由肽键的排列方式决定，是测蛋白质二级结构最快的办法。`, `A chiral molecule absorbs left and right circularly polarised light slightly differently. In the far ultraviolet (190–250 nm) the circular dichroism is set by the arrangement of peptide bonds, giving the quickest measure of protein secondary structure.`),
      how: [
        T(`CD 信号是 Δε = ε_L − ε_R，只在有吸收的地方不为零；仪器习惯用椭圆度 θ（毫度，mdeg）表示，换算成和浓度无关的平均残基摩尔椭圆度 [θ] = θ·M_MRW / (10·l·c)，其中 l 用 cm、c 用 mg/mL、M_MRW 是平均残基质量（约 110–115）。两者的关系是 [θ] = 3298·Δε。`, `The CD signal is Δε = ε_L − ε_R and is non-zero only where the sample absorbs; instruments report ellipticity θ in millidegrees, converted to the concentration-independent mean residue ellipticity [θ] = θ·M_MRW / (10·l·c), with l in cm, c in mg/mL and M_MRW the mean residue mass (about 110–115). The two are related by [θ] = 3298·Δε.`),
        T(`肽键在 190 nm 附近有 π→π* 跃迁、220 nm 附近有 n→π* 跃迁。α 螺旋里相邻肽键的跃迁偶极规则排列，发生激子耦合，给出 208 和 222 nm 两个负峰和 193 nm 的正峰；β 折叠是 217 nm 附近的单个负峰和 195 nm 的正峰；无规卷曲在 198 nm 附近有一个强的负峰。把实测的谱拆成这些基谱的线性组合，就得到各种二级结构的比例。`, `The peptide bond has a π→π* transition near 190 nm and an n→π* transition near 220 nm. In an α-helix the regularly arranged transition dipoles of neighbouring peptide bonds couple excitonically, giving negative bands at 208 and 222 nm and a positive band at 193 nm; a β-sheet gives a single negative band near 217 nm and a positive one at 195 nm; a random coil has a strong negative band near 198 nm. Decomposing a measured spectrum into these basis spectra yields the fraction of each secondary structure.`),
        T(`近紫外区（250–320 nm）的信号来自芳香侧链和二硫键所处的不对称环境，是三级结构的指纹。旋光色散（ORD）测的是旋光度随波长的变化，和 CD 通过 Kramers–Kronig 关系互相换算；钠 D 线（589 nm）处的比旋光度 [α]_D 就是 ORD 上的一个点。`, `Near-ultraviolet signals (250–320 nm) come from aromatic side chains and disulfides in asymmetric surroundings and fingerprint the tertiary structure. Optical rotatory dispersion (ORD) records optical rotation against wavelength and is linked to CD by the Kramers–Kronig relations; the specific rotation [α]_D at the sodium D line (589 nm) is one point on the ORD curve.`),
      ],
      axes: T(`横轴是波长（nm），纵轴是椭圆度（mdeg）、[θ]（deg cm² dmol⁻¹）或 Δε，有正有负。`, `Wavelength (nm) against ellipticity (mdeg), [θ] (deg cm² dmol⁻¹) or Δε, with both signs.`),
      tells: [
        T(`蛋白质的二级结构比例，以及表达纯化出来的蛋白是否折叠正确、突变体和野生型是否一样。`, `Secondary-structure content of a protein; whether a purified protein is folded correctly and whether a mutant matches the wild type.`),
        T(`热稳定性：在 222 nm 跟踪信号随温度的变化得到熔解温度 T_m。`, `Thermal stability: following the signal at 222 nm against temperature gives the melting temperature T_m.`),
        T(`核酸构象（B 型、A 型、Z 型、G-四链体各有特征谱）；小分子的绝对构型（电子圆二色 ECD 和 TDDFT 计算比较）。`, `Nucleic-acid conformation (B, A, Z forms and G-quadruplexes have characteristic spectra); absolute configuration of small molecules (electronic CD compared with TDDFT).`),
      ],
      sample: T(`蛋白质 0.1–0.2 mg/mL 装在 1 mm 石英皿里，或 1 mg/mL 装在 0.1 mm 皿里。缓冲液在 200 nm 以下必须透明：用磷酸盐或硼酸盐配 NaF，避开氯离子、咪唑、DTT 和高浓度 Tris。`, `Protein at 0.1–0.2 mg/mL in a 1 mm quartz cell, or 1 mg/mL in a 0.1 mm cell. The buffer must be transparent below 200 nm: phosphate or borate with NaF, avoiding chloride, imidazole, DTT and concentrated Tris.`),
      nums: [
        [T(`α 螺旋的特征`, `Signature of an α-helix`), T(`负峰 208、222 nm，正峰 193 nm；[θ]₂₂₂ 约 −36000 deg cm² dmol⁻¹`, `Negative at 208 and 222 nm, positive at 193 nm; [θ]₂₂₂ about −36000 deg cm² dmol⁻¹`)],
        [T(`β 折叠`, `β-sheet`), T(`负峰约 217 nm，正峰约 195 nm`, `Negative near 217 nm, positive near 195 nm`)],
        [T(`无规卷曲`, `Random coil`), T(`负峰约 198 nm`, `Negative near 198 nm`)],
        [T(`ΔA / A`, `ΔA / A`), T(`10⁻²–10⁻⁴`, `10⁻²–10⁻⁴`)],
      ],
      read: [
        T(`看 208 和 222 nm 是否有两个负峰（螺旋），或者只有 217 nm 附近一个（折叠），或者最小值在 200 nm 以下（无序）。`, `Look for two negative bands at 208 and 222 nm (helix), a single one near 217 nm (sheet), or a minimum below 200 nm (disorder).`),
        T(`同时看高压（HT）曲线：检测器电压超过约 600–700 V 说明样品加缓冲液吸收太强，那一段的 CD 数据不可信。`, `Watch the high-tension (HT) trace too: a detector voltage above about 600–700 V means sample plus buffer absorb too strongly and the CD in that range cannot be trusted.`),
      ],
      traps: [
        T(`[θ] 的准确度取决于浓度的准确度；二级结构的拟合结果对浓度误差很敏感，浓度应该用 280 nm 吸光度或氨基酸分析测定，而不是 Bradford 法。`, `The accuracy of [θ] is the accuracy of the concentration; secondary-structure fits are very sensitive to it, so determine concentration from absorbance at 280 nm or amino-acid analysis rather than a Bradford assay.`),
        T(`CD 给的是整个样品的平均值，分不清“一半分子全是螺旋”和“每个分子一半是螺旋”。`, `CD averages over the whole sample and cannot tell "half the molecules fully helical" from "every molecule half helical".`),
      ],
      figs: [
        { sketch: { x: [185, 250], xl: T(`波长（nm）`, `wavelength (nm)`), yl: T(`[θ]（10³ deg cm² dmol⁻¹）`, `[θ] (10³ deg cm² dmol⁻¹)`), zero: true, yt: true, sets: [
          { label: T(`α 螺旋`, `α-helix`), peaks: [[191.5, 78, 9], [207.5, -30, 9], [222, -35.7, 13]] },
          { label: T(`β 折叠`, `β-sheet`), alt: true, peaks: [[195, 31.9, 11], [217, -18.4, 17]] },
          { label: T(`无规卷曲`, `random coil`), dash: true, peaks: [[197, -41.9, 11], [217, 4.6, 14]] }] },
          cap: T(`示意：三种二级结构在远紫外区的圆二色谱。极值的位置和大小取自 Greenfield 和 Fasman 1969 年用聚赖氨酸测的数据（α 螺旋 [θ]₂₂₂ = −35700，β 折叠 [θ]₂₁₇ = −18400，无规卷曲 [θ]₁₉₇ = −41900 deg cm² dmol⁻¹），曲线是用几个高斯带拼出来的示意。`, `Schematic: far-ultraviolet circular dichroism of three secondary structures. Positions and magnitudes of the extrema follow the poly-L-lysine data of Greenfield and Fasman (1969): [θ]₂₂₂ = −35700 for the α-helix, [θ]₂₁₇ = −18400 for the β-sheet and [θ]₁₉₇ = −41900 deg cm² dmol⁻¹ for the random coil; the curves are assembled from a few Gaussian bands.`) },
      ],
      refs: ['greenfield1969', 'greenfield2006', 'kelly2005'],
    },
    {
      id: 'ta', fam: 'elec', abbr: 'TA · pump–probe', name: T(`瞬态吸收光谱`, `Transient absorption spectroscopy`),
      one: T(`一束飞秒“泵浦”脉冲把分子激发，延迟一段时间后一束白光“探测”脉冲测这时的吸收谱。逐步改变延迟，就把激发态从飞秒到纳秒的演化拍成了电影，不发光的状态也看得见。`, `A femtosecond pump pulse excites the molecules and, after a delay, a white-light probe pulse records the absorption spectrum at that instant. Stepping the delay films the evolution of the excited state from femtoseconds to nanoseconds, including states that do not emit.`),
      how: [
        T(`测的是有泵浦和没有泵浦时吸光度之差 ΔA(λ, t)。它由三部分叠加：基态漂白（基态分子变少，在基态吸收处 ΔA < 0）、受激发射（探测光诱导激发态发光，在荧光波长处 ΔA < 0）、激发态吸收（激发态自己吸收探测光，ΔA > 0）。产物或三重态的吸收也是正信号。`, `The observable is the difference in absorbance with and without the pump, ΔA(λ, t), a sum of three parts: ground-state bleach (fewer ground-state molecules, ΔA < 0 where the ground state absorbs), stimulated emission (the probe induces emission from the excited state, ΔA < 0 at fluorescence wavelengths), and excited-state absorption (the excited state absorbs the probe, ΔA > 0). Absorption by products or triplets is positive too.`),
        T(`时间延迟靠光程差来实现：光走 0.3 mm 需要 1 ps，所以把一面反射镜移动 0.15 mm 就把延迟改了 1 ps（光来回两次）。时间分辨率由脉冲宽度决定，不受电子学速度限制；探测用的白光是把一小部分飞秒光聚焦进蓝宝石或 CaF₂ 产生的超连续谱。`, `The delay is set by path length: light needs 1 ps to travel 0.3 mm, so moving a mirror 0.15 mm changes the delay by 1 ps (the light travels there and back). Time resolution is set by the pulse width, not by electronics; the white-light probe is a supercontinuum generated by focusing part of the femtosecond beam into sapphire or CaF₂.`),
        T(`数据是一张二维的图（波长 × 时间）。全局分析假设每个波长的动力学都由同一组时间常数描述，拟合得到每个时间常数对应的谱（衰减关联谱，DAS）；再给定一个反应模型（A → B → C）就得到每个物种自己的谱（SAS）。`, `The data form a two-dimensional map (wavelength × time). Global analysis assumes the kinetics at every wavelength share one set of time constants and extracts the spectrum associated with each (decay-associated spectra, DAS); a kinetic model (A → B → C) then yields the spectrum of each species (SAS).`),
      ],
      axes: T(`两种看法：固定延迟的 ΔA 对波长（瞬态谱），或固定波长的 ΔA 对延迟时间（动力学曲线，时间轴常用对数）。`, `Two views: ΔA against wavelength at fixed delay (transient spectra), or ΔA against delay at fixed wavelength (kinetic traces, often on a logarithmic time axis).`),
      tells: [
        T(`光化学和光物理的每一步有多快：内转换、系间窜越、电荷分离、能量转移、异构化。`, `How fast each photochemical and photophysical step is: internal conversion, intersystem crossing, charge separation, energy transfer, isomerisation.`),
        T(`太阳能电池材料里载流子的产生、分离和复合；光催化剂里电荷到达表面的效率。`, `Carrier generation, separation and recombination in solar-cell materials; how efficiently charges reach the surface of a photocatalyst.`),
        T(`光合作用天线里的能量传递路径、视觉过程里视黄醛的异构化（约 200 fs）。`, `Energy-transfer pathways in photosynthetic antennae; isomerisation of retinal in vision (about 200 fs).`),
      ],
      sample: T(`1–2 mm 光程、在泵浦波长吸光度 0.3–0.6 的溶液，流动或搅拌以免同一处被反复照射；薄膜直接测。`, `A solution of 1–2 mm path with absorbance 0.3–0.6 at the pump wavelength, flowed or stirred so that the same volume is not hit repeatedly; films are measured directly.`),
      nums: [
        [T(`时间分辨率`, `Time resolution`), T(`约 50–200 fs`, `About 50–200 fs`)],
        [T(`可测的 ΔA`, `Measurable ΔA`), T(`10⁻⁵–10⁻⁴`, `10⁻⁵–10⁻⁴`)],
        [T(`延迟范围`, `Delay range`), T(`机械延迟线到约 8 ns；电子同步的纳秒激光闪光光解接着覆盖到秒`, `Mechanical delay lines to about 8 ns; electronically synchronised nanosecond flash photolysis continues to seconds`)],
      ],
      read: [
        T(`先在最早的延迟处认出漂白（和稳态吸收谱对照）和受激发射（和荧光谱对照），剩下的正信号是激发态吸收。`, `At the earliest delays identify the bleach (compare with the steady-state absorption) and the stimulated emission (compare with the fluorescence); the remaining positive signal is excited-state absorption.`),
        T(`漂白恢复得比激发态吸收衰减得慢，说明激发态去了别的地方（三重态、产物）而不是直接回基态。`, `A bleach that recovers more slowly than the excited-state absorption decays means the excited state went somewhere else (a triplet, a product) rather than straight back to the ground state.`),
      ],
      traps: [
        T(`时间零点附近有相干假象（交叉相位调制、溶剂的受激拉曼），不是样品的动力学；白光有啁啾，不同波长的时间零点不同，要先校正。`, `Around time zero coherent artefacts appear (cross-phase modulation, stimulated Raman of the solvent) that are not sample dynamics; the white light is chirped, so time zero differs with wavelength and must be corrected first.`),
        T(`泵浦太强会一次激发多个激子，出现激子–激子湮灭这种在弱光下不存在的快过程。要做功率依赖实验确认信号和泵浦能量成正比。`, `Too strong a pump creates several excitons at once and adds exciton–exciton annihilation, a fast channel absent at low light. Check with a power series that the signal is linear in pump energy.`),
      ],
      figs: [
        { gen: 'kinetics', cap: T(`模型计算：A → B → 基态的两步动力学（τ₁ = 2 ps，τ₂ = 150 ps），卷上 150 fs 的仪器响应。A 的激发态吸收先出现后衰减，B 的吸收随之长出再消失，基态漂白直到 B 回到基态才恢复。对数时间轴。`, `Model calculation: two-step kinetics A → B → ground state (τ₁ = 2 ps, τ₂ = 150 ps) convolved with a 150 fs instrument response. The excited-state absorption of A appears and decays, that of B grows in and then vanishes, and the ground-state bleach recovers only when B returns. Logarithmic time axis.`) },
      ],
      refs: ['berera2009', 'zewail2000'],
    },
    {
      id: 'drs', fam: 'elec', abbr: 'DRS · Tauc', name: T(`固体漫反射光谱与带隙`, `Diffuse reflectance of solids and band gaps`),
      one: T(`粉末和薄膜不透明，改测漫反射。从吸收边的位置可以得到半导体的光学带隙：这是光催化和太阳能材料论文里最常见的一张图。`, `Powders and films are opaque, so diffuse reflection is measured instead. The position of the absorption edge gives the optical band gap of a semiconductor: the most common figure in papers on photocatalysts and solar materials.`),
      how: [
        T(`积分球收集粉末向各个方向反射的光，得到反射率 R（相对 BaSO₄ 或 PTFE 白板）。Kubelka–Munk 函数 F(R) = (1 − R)² / 2R = K/S 把它换算成正比于吸收系数的量（假设散射系数 S 不随波长变）。`, `An integrating sphere collects light reflected by the powder in all directions, giving the reflectance R (relative to a BaSO₄ or PTFE white standard). The Kubelka–Munk function F(R) = (1 − R)² / 2R = K/S converts it to a quantity proportional to the absorption coefficient (assuming the scattering coefficient S does not vary with wavelength).`),
        T(`Tauc 作图：吸收边附近 (αhν)^(1/n) = A(hν − E_g)。直接允许跃迁取 n = 1/2（纵轴是 (αhν)²），间接允许跃迁取 n = 2（纵轴是 (αhν)^½）。把线性段外推到和基线相交，交点的横坐标就是 E_g。带隙和吸收边波长的换算是 E_g(eV) = 1239.8 / λ(nm)。`, `The Tauc plot: near the edge (αhν)^(1/n) = A(hν − E_g). Direct allowed transitions take n = 1/2 (plot (αhν)²), indirect allowed ones n = 2 (plot (αhν)^½). Extrapolating the linear part to its intersection with the baseline gives E_g. Gap and edge wavelength are related by E_g(eV) = 1239.8 / λ(nm).`),
        T(`常见的数值：锐钛矿 TiO₂ 约 3.2 eV（间接，吸收边约 387 nm，所以只吸收紫外），金红石约 3.0 eV，ZnO 约 3.3 eV（直接），CdS 约 2.4 eV（黄色），g-C₃N₄ 约 2.7 eV，Si 1.12 eV（间接）。`, `Common values: anatase TiO₂ about 3.2 eV (indirect, edge near 387 nm, hence ultraviolet only), rutile about 3.0 eV, ZnO about 3.3 eV (direct), CdS about 2.4 eV (yellow), g-C₃N₄ about 2.7 eV, Si 1.12 eV (indirect).`),
      ],
      axes: T(`原始数据：波长对反射率 R（%）。Tauc 图：光子能量 hν（eV）对 (F(R)·hν)² 或 (F(R)·hν)^½。`, `Raw data: wavelength against reflectance R (%). Tauc plot: photon energy hν (eV) against (F(R)·hν)² or (F(R)·hν)^½.`),
      tells: [
        T(`半导体的光学带隙、掺杂和缺陷引入的带尾吸收、量子点尺寸变小时带隙的蓝移。`, `Optical band gap of semiconductors, tail absorption from dopants and defects, the blue shift of the gap as quantum dots shrink.`),
        T(`颜料和涂层的颜色坐标；负载型催化剂里金属离子的配位状态（d–d 带和电荷转移带）。`, `Colour coordinates of pigments and coatings; coordination of metal ions in supported catalysts (d–d and charge-transfer bands).`),
      ],
      sample: T(`把粉末压进样品槽，表面压平；强吸收的样品用 BaSO₄ 稀释。`, `Powder pressed flat into a holder; strongly absorbing samples diluted with BaSO₄.`),
      nums: [
        [T(`可见光（400–700 nm）对应`, `Visible light (400–700 nm) corresponds to`), T(`3.10–1.77 eV`, `3.10–1.77 eV`)],
        [T(`外推带隙的典型不确定度`, `Typical uncertainty of an extrapolated gap`), T(`±0.05–0.1 eV`, `±0.05–0.1 eV`)],
      ],
      read: [
        T(`先确定材料是直接带隙还是间接带隙（查文献或看能带计算），再选指数；两种都画、哪条更直就用哪条的做法不可靠。`, `Decide first whether the material has a direct or an indirect gap (from the literature or a band-structure calculation) and then choose the exponent; plotting both and picking the straighter line is unreliable.`),
        T(`外推线应该和吸收边以下的基线（而不是横轴）相交，尤其是有带尾吸收或有第二组分的样品。`, `The extrapolation should meet the baseline below the edge, not the abscissa, especially for samples with tail absorption or a second component.`),
      ],
      traps: [
        T(`Tauc 方法原本是为非晶半导体提出的；对有激子吸收峰的材料（钙钛矿、二维材料、量子点）、分子和 MOF，硬套 Tauc 图会给出错误的带隙。`, `The Tauc method was devised for amorphous semiconductors; forcing it on materials with excitonic peaks (perovskites, two-dimensional materials, quantum dots), on molecules or on MOFs gives wrong gaps.`),
        T(`光学带隙不等于电化学或光电子能谱测的 HOMO–LUMO 间隔，差一个激子结合能。`, `The optical gap is not the HOMO–LUMO gap from electrochemistry or photoelectron spectroscopy; they differ by the exciton binding energy.`),
      ],
      figs: [
        { gen: 'tauc', cap: T(`模型计算：直接带隙 3.30 eV 的半导体的 Tauc 图。吸收系数按 α ∝ √(hν − E_g) / hν 生成，加了一点带尾；(αhν)² 的线性段外推到基线，交点就是带隙。`, `Model calculation: the Tauc plot of a semiconductor with a direct gap of 3.30 eV. The absorption coefficient follows α ∝ √(hν − E_g) / hν with a small tail added; extrapolating the linear part of (αhν)² to the baseline gives the gap.`) },
      ],
      refs: ['mayerhofer2020'],
    },
  );
})();
