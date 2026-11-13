'use strict';
// 谱图馆 · 原子光谱一族。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'aes', fam: 'atom', core: true, abbr: 'AES · FES', name: T(`原子发射光谱与焰色`, `Atomic emission and flame colours`),
      one: T(`把样品加热到几千度，分子拆成自由原子，原子里的电子被激发后跳回低能级，放出波长固定的光。每种元素有自己的一组谱线，像条形码。钠盐让火焰变黄、铜盐让它变绿，就是这回事；1860 年本生和基尔霍夫用分光镜看火焰，由此发现了铯和铷。`, `Heat a sample to a few thousand kelvin and molecules break into free atoms, whose excited electrons fall back to lower levels and emit light of fixed wavelengths. Each element has its own set of lines, like a barcode. Sodium salts colouring a flame yellow and copper salts green are exactly this; in 1860 Bunsen and Kirchhoff looked at flames through a spectroscope and discovered caesium and rubidium.`),
      how: [
        T(`自由原子的能级是分立的，跃迁的谱线极窄（约 0.001–0.005 nm），所以一种元素的线和另一种的几乎不会重合。氢原子最简单：谱线的波数是 ν̃ = R_H·(1/n₁² − 1/n₂²)，R_H = 109 677.58 cm⁻¹。落到 n₁ = 2 的是可见区的 Balmer 系：Hα 656.28 nm（红）、Hβ 486.13 nm（青）、Hγ 434.05 nm（蓝）、Hδ 410.17 nm（紫）；落到 n₁ = 1 的 Lyman 系在真空紫外（Lyα 121.57 nm），落到 n₁ = 3 的 Paschen 系在近红外。`, `Free atoms have discrete levels and extremely narrow lines (about 0.001–0.005 nm), so the lines of one element almost never coincide with those of another. Hydrogen is the simplest case: the wavenumbers of its lines are ν̃ = R_H·(1/n₁² − 1/n₂²), with R_H = 109 677.58 cm⁻¹. Transitions down to n₁ = 2 form the visible Balmer series: Hα 656.28 nm (red), Hβ 486.13 nm (cyan), Hγ 434.05 nm (blue), Hδ 410.17 nm (violet); the Lyman series to n₁ = 1 lies in the vacuum ultraviolet (Lyα 121.57 nm) and the Paschen series to n₁ = 3 in the near infrared.`),
        T(`发射强度正比于处在激发态的原子数，后者由 Boltzmann 分布决定：N*/N₀ = (g*/g₀)·exp(−ΔE / kT)。在 2500 K 的火焰里，钠原子只有约万分之 1.7 处在 3p 激发态；温度升高 10 K，这个比例增加约 4 %。所以发射法对温度极其敏感，也只有激发能低的碱金属和碱土金属能在火焰里发出足够强的光。要测别的元素，得用更热的激发源：电弧、电火花，或 6000–10000 K 的电感耦合等离子体。`, `Emission intensity is proportional to the number of excited atoms, which follows the Boltzmann distribution: N*/N₀ = (g*/g₀)·exp(−ΔE / kT). In a flame at 2500 K only about 1.7 sodium atoms in ten thousand are in the 3p excited state, and a 10 K rise increases this by about 4 %. Emission is therefore extremely sensitive to temperature, and only the easily excited alkali and alkaline-earth metals emit strongly in a flame. Other elements need a hotter source: an arc, a spark, or an inductively coupled plasma at 6000–10000 K.`),
        T(`火焰的颜色不全来自原子线。钠的黄色是 589.0 和 589.6 nm 的一对 D 线，锂的红色是 670.8 nm，钾的两条线在 766.5 和 769.9 nm（已经接近红外，人眼看到的淡紫色还有 404.4 nm 的贡献）。但钙的砖红、锶的洋红、钡的黄绿和铜的绿色主要来自火焰里生成的 CaOH、SrOH、BaOH、CuCl 这些小分子的谱带。烟花的颜色就是照这个配的。`, `Flame colours do not all come from atomic lines. The yellow of sodium is the pair of D lines at 589.0 and 589.6 nm, the red of lithium is 670.8 nm, and potassium has two lines at 766.5 and 769.9 nm (almost infrared; the pale violet seen by eye owes something to 404.4 nm as well). But the brick red of calcium, the crimson of strontium, the yellow-green of barium and the green of copper come mainly from bands of small molecules formed in the flame: CaOH, SrOH, BaOH and CuCl. Firework colours are formulated accordingly.`),
      ],
      axes: T(`横轴是波长（nm），纵轴是发射强度。谱是一条条分立的细线，不是宽带。`, `Wavelength (nm) against emission intensity. The spectrum is a set of discrete narrow lines, not broad bands.`),
      tells: [
        T(`样品里有哪些元素（看有没有它的特征线），各有多少（线的强度）。`, `Which elements a sample contains (whether their lines appear) and how much of each (line intensity).`),
        T(`火焰光度法：血清、肥料、水泥和水里的钠、钾、锂、钙，仪器简单便宜。`, `Flame photometry: sodium, potassium, lithium and calcium in serum, fertiliser, cement and water, with simple and inexpensive instruments.`),
        T(`恒星和星云的元素组成、温度和径向速度（谱线的多普勒位移），都是从原子线读出来的。`, `The elemental composition, temperature and radial velocity (the Doppler shift of the lines) of stars and nebulae are all read from atomic lines.`),
      ],
      sample: T(`溶液吸进雾化器喷入火焰。焰色试验用干净的铂丝或镍铬丝蘸一点样品。`, `Solutions are aspirated through a nebuliser into the flame. For a flame test a clean platinum or nichrome wire picks up a little sample.`),
      nums: [
        [T(`氢的 Balmer 线（空气中）`, `Balmer lines of hydrogen (in air)`), T(`656.28，486.13，434.05，410.17 nm`, `656.28, 486.13, 434.05, 410.17 nm`)],
        [T(`钠 D 线`, `Sodium D lines`), T(`588.995 和 589.592 nm（3p ²P₃/₂,₁/₂ → 3s ²S₁/₂）`, `588.995 and 589.592 nm (3p ²P₃/₂,₁/₂ → 3s ²S₁/₂)`)],
        [T(`火焰温度`, `Flame temperatures`), T(`空气–丙烷约 1900 °C，空气–乙炔约 2300 °C，N₂O–乙炔约 2700 °C`, `Air–propane about 1900 °C, air–acetylene about 2300 °C, N₂O–acetylene about 2700 °C`)],
        [T(`2500 K 时钠的激发态比例`, `Excited fraction of sodium at 2500 K`), T(`约 1.7 × 10⁻⁴`, `About 1.7 × 10⁻⁴`)],
      ],
      read: [
        T(`认元素至少要对上两三条特征线，位置和相对强度都要合理。只有一条线对上，很可能是别的元素的线恰好在附近。`, `Identify an element by at least two or three characteristic lines, with sensible positions and relative intensities. A single matching line may well belong to another element that happens to lie nearby.`),
        T(`最灵敏的线通常是从第一激发态回到基态的共振线（钠 589.0，钙 422.7，铜 324.8 nm）。`, `The most sensitive line is usually the resonance line from the first excited state to the ground state (sodium 589.0, calcium 422.7, copper 324.8 nm).`),
      ],
      traps: [
        T(`钠无处不在：手指、玻璃、灰尘里的一点钠就能把火焰染黄，盖住别的颜色。看钾的焰色要隔着蓝色钴玻璃把钠的黄光滤掉。`, `Sodium is everywhere: a trace from fingers, glass or dust colours a flame yellow and masks everything else. Potassium is viewed through blue cobalt glass to filter the sodium light out.`),
        T(`浓度高时谱线中心被火焰外层较冷的原子重新吸收（自吸），校准曲线向下弯，线形中间还会凹下去（自蚀）。`, `At high concentration the line centre is reabsorbed by cooler atoms in the outer flame (self-absorption): the calibration curve bends over, and the line profile may even dip in the middle (self-reversal).`),
        T(`在热的火焰里，钾、铯这样容易电离的元素有一部分变成离子，原子线变弱；样品里有另一种易电离元素时，它提供的电子又把电离压回去，信号反而升高（电离干扰）。`, `In a hot flame easily ionised elements such as potassium and caesium are partly ionised and their atomic lines weaken; another easily ionised element in the sample supplies electrons that suppress this ionisation and raises the signal (ionisation interference).`),
      ],
      figs: [
        { gen: 'hydrogen', cap: T(`由 Rydberg 公式算出（R_H = 109 677.58 cm⁻¹，已含约化质量；可见区换算成空气中的波长）：氢原子的 Lyman、Balmer、Paschen 三个线系。每个线系的线越来越密，收敛到系限（Balmer 系限 364.6 nm）。公式不含精细结构，算出的波长和实测值相差约 0.01 nm。`, `From the Rydberg formula (R_H = 109 677.58 cm⁻¹, reduced mass included; visible lines converted to wavelengths in air): the Lyman, Balmer and Paschen series of hydrogen. The lines of each series crowd together towards the series limit (364.6 nm for Balmer). The formula omits fine structure, and its wavelengths differ from measured ones by about 0.01 nm.`) },
        { gen: 'flame', args: { on: ['Na', 'Li', 'K'] }, cap: T(`由文献的谱线波长画出：勾选元素，看它在可见区的主要原子线落在哪种颜色上。钙、锶、钡、铜的焰色主要来自分子谱带（图上用宽带表示，位置是近似的）。线的高度只是示意，不代表强度。`, `Drawn from literature wavelengths: tick elements to see on which colours their main visible atomic lines fall. The flame colours of calcium, strontium, barium and copper come mainly from molecular bands (shown as broad bands at approximate positions). Line heights are illustrative, not intensities.`) },
      ],
      table: 'atomic-lines',
      see: [['#m-icpoes', T(`电感耦合等离子体发射光谱`, `ICP optical emission`)], ['#m-rovib', T(`分子的转振光谱`, `Rovibrational spectra of molecules`)]],
      refs: ['kirchhoff1860', 'balmer1885'],
    },
    {
      id: 'aas', fam: 'atom', core: true, abbr: 'AAS · GFAAS · CV-AAS', name: T(`原子吸收光谱`, `Atomic absorption spectroscopy`),
      one: T(`火焰里的原子绝大多数处在基态，它们会吸收自己那条共振线的光。让某种元素的灯发出的光穿过火焰，测它被吸收了多少，就知道样品里这种元素的浓度。一次测一种元素，但选择性极好、仪器不贵，是测金属含量用得最广的方法之一。`, `Nearly all atoms in a flame are in the ground state and absorb light at their own resonance line. Pass the light of a lamp of the element through the flame, measure how much is absorbed, and the concentration of that element follows. One element at a time, but with excellent selectivity and modest cost, it is among the most widely used ways of measuring metals.`),
      how: [
        T(`光源是空心阴极灯：阴极用待测元素做成，放电时溅射出来的原子发出这种元素自己的谱线，线宽只有约 0.001 nm。火焰里原子的吸收线因为多普勒效应和碰撞展宽到约 0.003 nm，比灯的发射线宽，所以灯的光正好落在吸收线的中心，Beer 定律成立。Alan Walsh 在 1955 年指出这一点，原子吸收才变得实用。吸收用的是基态原子，数量是激发态的上万倍，受温度波动的影响也比发射小得多。`, `The source is a hollow-cathode lamp: its cathode is made of the element to be measured, and atoms sputtered in the discharge emit the element's own lines, only about 0.001 nm wide. Absorption lines of atoms in the flame are broadened by the Doppler effect and collisions to about 0.003 nm, wider than the lamp line, so the lamp light falls right at the centre of the absorption line and Beer's law holds. Alan Walsh pointed this out in 1955 and made atomic absorption practical. Absorption uses ground-state atoms, ten thousand times more numerous than excited ones and far less affected by temperature fluctuations than emission.`),
        T(`三种原子化方式。火焰（空气–乙炔约 2300 °C；难熔的铝、硅、钛、钒用 N₂O–乙炔约 2700 °C）：快，精密度好（约 1 %），检出限在 mg/L 到几十 μg/L。石墨炉：把 5–50 μL 样品滴进石墨管，按程序升温，依次干燥（约 110 °C）、灰化（几百到一千多度，烧掉基体）、原子化（2000–2700 °C，1–3 秒内全部气化），原子在管里停留的时间长，检出限比火焰低 100–1000 倍，到 μg/L 以下。化学蒸气发生：汞用 SnCl₂ 还原成汞蒸气，在室温下测 253.7 nm 的吸收（冷蒸气法）；砷、硒、锑用 NaBH₄ 变成气态氢化物再加热分解。`, `There are three ways to atomise. A flame (air–acetylene at about 2300 °C; N₂O–acetylene at about 2700 °C for the refractory aluminium, silicon, titanium and vanadium): fast, precise (about 1 %), with detection limits from mg/L to tens of μg/L. A graphite furnace: 5–50 μL of sample is placed in a graphite tube and heated by programme, drying (about 110 °C), ashing (a few hundred to over a thousand degrees, to burn off the matrix) and atomising (2000–2700 °C, everything vaporised within 1–3 seconds); atoms stay in the tube longer, and detection limits are 100–1000 times lower than with a flame, below μg/L. Chemical vapour generation: mercury is reduced with SnCl₂ to mercury vapour and measured at 253.7 nm at room temperature (cold vapour); arsenic, selenium and antimony are converted with NaBH₄ to gaseous hydrides and then decomposed by heating.`),
        T(`背景校正。基体里的分子吸收和颗粒散射会叠在原子吸收上，石墨炉里尤其严重。氘灯法：交替用空心阴极灯（测原子吸收加背景）和连续光源氘灯（几乎只测背景）测量，两者相减。Zeeman 法：加磁场把吸收线劈开并移开，用偏振区分，直接在分析线的波长上测背景，更准确。`, `Background correction. Molecular absorption and scattering by particles from the matrix add to the atomic absorption, particularly in the furnace. The deuterium method alternates the hollow-cathode lamp (atomic absorption plus background) with a continuum deuterium lamp (almost only background) and subtracts. The Zeeman method applies a magnetic field that splits and shifts the absorption line and uses polarisation to measure the background at the analytical wavelength itself, which is more accurate.`),
      ],
      axes: T(`不扫谱，只在一条线上测吸光度。结果是校准曲线：横轴浓度，纵轴吸光度。石墨炉的信号是一个随时间变化的峰，取峰面积。`, `No spectrum is scanned; absorbance is measured at a single line. The result is a calibration curve of absorbance against concentration. The furnace signal is a transient peak whose area is taken.`),
      tells: [
        T(`水、土壤、食品、血液里的铅、镉、铜、锌、铁、锰、铬、镍等金属的含量。`, `The content of lead, cadmium, copper, zinc, iron, manganese, chromium, nickel and other metals in water, soil, food and blood.`),
        T(`痕量的汞（冷蒸气法，ng/L 级）、砷和硒（氢化物法）。`, `Traces of mercury (cold vapour, at ng/L) and of arsenic and selenium (hydride generation).`),
      ],
      sample: T(`溶液。固体先用酸消解（硝酸，必要时加盐酸、氢氟酸或过氧化氢，常用微波消解）。火焰法每次吸进几毫升，石墨炉只要几十微升。`, `Solutions. Solids are first digested in acid (nitric, with hydrochloric, hydrofluoric acid or hydrogen peroxide as needed, commonly in a microwave). The flame consumes a few millilitres per reading, the furnace only tens of microlitres.`),
      nums: [
        [T(`常用分析线`, `Common analytical lines`), T(`Cu 324.8，Pb 283.3，Cd 228.8，Zn 213.9，Fe 248.3，Ca 422.7，Mg 285.2，Hg 253.7 nm`, `Cu 324.8, Pb 283.3, Cd 228.8, Zn 213.9, Fe 248.3, Ca 422.7, Mg 285.2, Hg 253.7 nm`)],
        [T(`线性范围`, `Linear range`), T(`吸光度约 0.5 以下；浓度约 2–3 个数量级`, `Up to an absorbance of about 0.5; about 2–3 orders of magnitude in concentration`)],
        [T(`特征浓度`, `Characteristic concentration`), T(`产生 1 % 吸收（A = 0.0044）的浓度`, `The concentration giving 1 % absorption (A = 0.0044)`)],
      ],
      read: [
        T(`看校准曲线是不是直线、过不过原点，空白有多高。吸光度超过约 0.5 就开始弯，样品要稀释到线性范围内再测。`, `Check that the calibration is linear, whether it passes through the origin, and how high the blank is. Above an absorbance of about 0.5 it curves; samples are diluted into the linear range.`),
        T(`基体复杂时用标准加入法：往几份样品里加不同量的标准，把直线外推到横轴，截距就是样品里的浓度。`, `With a complex matrix use standard addition: spike several aliquots of the sample with different amounts of standard and extrapolate the line to the abscissa, where the intercept is the concentration in the sample.`),
      ],
      traps: [
        T(`化学干扰：磷酸根和钙在火焰里生成难挥发的磷酸钙，钙的信号下降。加镧或锶盐（释放剂）把磷酸根抢走，或者改用更热的 N₂O–乙炔火焰。`, `Chemical interference: phosphate and calcium form involatile calcium phosphate in the flame and the calcium signal falls. Adding a lanthanum or strontium salt (a releasing agent) to take up the phosphate, or using the hotter N₂O–acetylene flame, cures it.`),
        T(`石墨炉里氯化物等基体会让待测元素在灰化阶段提前挥发跑掉。加基体改进剂（钯和硝酸镁，或磷酸二氢铵）把它稳定到更高的温度。`, `In the furnace, chloride and other matrices let the analyte escape during ashing. A matrix modifier (palladium with magnesium nitrate, or ammonium dihydrogen phosphate) stabilises it to a higher temperature.`),
        T(`原子吸收只给出元素的总量，不分价态和化学形态。要分三价砷和五价砷、无机汞和甲基汞，得先用色谱分开。`, `Atomic absorption gives the total amount of an element, not its oxidation state or chemical form. Separating arsenic(III) from arsenic(V), or inorganic mercury from methylmercury, needs chromatography first.`),
      ],
      figs: [
        { sketch: { x: [324.740, 324.768], xl: T(`波长（nm）`, `wavelength (nm)`), yl: T(`相对强度（示意）`, `relative intensity (schematic)`), sets: [
          { label: T(`火焰里铜原子的吸收线（约 0.004 nm 宽）`, `absorption line of copper atoms in the flame (about 0.004 nm wide)`), peaks: [[324.754, 0.75, 0.004]] },
          { label: T(`空心阴极灯的发射线（约 0.001 nm 宽）`, `emission line of the hollow-cathode lamp (about 0.001 nm wide)`), alt: true, peaks: [[324.754, 1, 0.001]] }] },
          cap: T(`示意：铜的 324.754 nm 共振线。灯的发射线比火焰里的吸收线窄得多，整条线都落在吸收最强的中心，所以吸光度和浓度成正比。单色器的通带（约 0.2–0.7 nm）比这张图的整个横轴宽几十倍，它只负责把别的线挡在外面。线宽是典型值。`, `Schematic: the 324.754 nm resonance line of copper. The lamp line is far narrower than the absorption line in the flame and lies wholly at its centre, where absorption is strongest, so absorbance is proportional to concentration. The bandpass of the monochromator (about 0.2–0.7 nm) is tens of times wider than the whole axis of this figure and only keeps other lines out. Line widths are typical values.`) },
        { gen: 'bars', args: { log: true, unit: 'μg/L', xl: T(`检出限（μg/L，对数刻度）`, `detection limit (μg/L, log scale)`), rows: [[T(`火焰原子吸收`, `Flame AAS`), 1, 100], [T(`ICP 发射光谱`, `ICP-OES`), 0.1, 10], [T(`石墨炉原子吸收`, `Graphite-furnace AAS`), 0.01, 1], [T(`ICP 质谱`, `ICP-MS`), 0.0001, 0.01]] }, cap: T(`文献里的典型数量级：四种元素分析方法对大多数金属的检出限。具体数值随元素、基体和仪器相差很大。`, `Typical orders of magnitude from the literature: detection limits of four elemental techniques for most metals. Actual values vary widely with element, matrix and instrument.`) },
      ],
      see: [['#m-icpms', T(`电感耦合等离子体质谱`, `ICP mass spectrometry`)], ['#m-icpoes', T(`电感耦合等离子体发射光谱`, `ICP optical emission`)]],
      refs: ['walsh1955'],
    },
    {
      id: 'icpoes', fam: 'atom', core: true, abbr: 'ICP-OES · ICP-AES', name: T(`电感耦合等离子体发射光谱`, `Inductively coupled plasma optical emission spectroscopy`),
      one: T(`把样品溶液喷进一团 6000–10000 K 的氩等离子体，几乎所有元素都被原子化、电离并激发，各自发出特征谱线。一次进样同时测几十种元素，线性范围跨五六个数量级，是多元素定量分析的主力。`, `Spray a sample solution into an argon plasma at 6000–10000 K and nearly every element is atomised, ionised and excited, each emitting its characteristic lines. Dozens of elements are measured from one aspiration over a linear range of five to six orders of magnitude; it is the workhorse of multi-element quantification.`),
      how: [
        T(`等离子体炬管是三层同心石英管，外面绕着射频线圈（27 或 40 MHz，1–1.5 kW）。氩气被高压火花点燃后，电子在高频磁场里来回加速，不断撞击氩原子使它电离，形成自持的等离子体。样品气溶胶从中心管穿过它的中心通道，在约 2 毫秒里依次脱溶剂、气化、原子化、电离和激发。因为温度高、停留时间长、气氛是惰性的，火焰里那些化学干扰基本消失，难熔元素也能测。`, `The torch is three concentric quartz tubes inside a radio-frequency coil (27 or 40 MHz, 1–1.5 kW). Once a spark seeds the argon with electrons, the oscillating magnetic field accelerates them, they ionise more argon atoms by collision, and a self-sustaining plasma forms. The sample aerosol passes through its central channel and within about 2 milliseconds is desolvated, vaporised, atomised, ionised and excited. The high temperature, long residence time and inert atmosphere remove most of the chemical interferences of flames, and refractory elements can be measured.`),
        T(`在这个温度下大多数金属主要以一价离子存在，所以最强的线往往是离子线（记作 II，如 Mg II 279.553 nm），原子线记作 I（Mg I 285.213 nm）。分光用中阶梯光栅加棱镜做交叉色散，把 165–900 nm 的光谱折叠成二维图样投在面阵探测器上，所有谱线同时记录。每种元素有很多条线，可以挑一条没有干扰、灵敏度合适的。`, `At this temperature most metals exist mainly as singly charged ions, so the strongest lines are often ionic (written II, as in Mg II 279.553 nm), atomic lines being written I (Mg I 285.213 nm). An echelle grating with a prism as cross-disperser folds the spectrum from 165 to 900 nm into a two-dimensional pattern on an array detector, and all lines are recorded at once. Each element has many lines from which one free of interference and of suitable sensitivity is chosen.`),
        T(`观测方式有两种。轴向（沿着中心通道看）：光程长，检出限低约 5–10 倍，但基体效应和易电离元素的干扰更大。径向（从侧面看）：稳健，适合高盐、高浓度样品。Mg II 280.270 nm 和 Mg I 285.213 nm 的强度比常用来检查等离子体够不够“稳健”：比值在 8 以上时，基体对信号的影响小。`, `The plasma is viewed in two ways. Axially (along the central channel): a longer path and detection limits about 5–10 times lower, but stronger matrix effects and interference from easily ionised elements. Radially (from the side): robust, suited to salty and concentrated samples. The intensity ratio of Mg II 280.270 nm to Mg I 285.213 nm is a common check of plasma robustness: above 8, matrix effects on the signal are small.`),
      ],
      axes: T(`横轴是波长（nm），纵轴是发射强度（计数）。日常工作中看的是每条分析线附近零点几纳米的小窗口，以及由峰强度得到的校准曲线。`, `Wavelength (nm) against emission intensity (counts). Routine work looks at a window of a few tenths of a nanometre around each analytical line, and at calibration curves of peak intensity.`),
      tells: [
        T(`水、土壤、矿石、合金、电池材料、催化剂、食品里几十种元素的含量，从主量到 μg/L 级。`, `The content of dozens of elements in water, soil, ores, alloys, battery materials, catalysts and food, from major components down to μg/L.`),
        T(`材料的化学计量比：合成出来的 LiNi₀.₈Co₀.₁Mn₀.₁O₂ 里锂、镍、钴、锰的实际比例是多少。`, `The stoichiometry of materials: the actual ratio of lithium, nickel, cobalt and manganese in a synthesised LiNi₀.₈Co₀.₁Mn₀.₁O₂.`),
        T(`非金属里的硫、磷、硼、硅也能测；卤素、碳、氮、氧基本不行。`, `Among the non-metals sulfur, phosphorus, boron and silicon are measurable; halogens, carbon, nitrogen and oxygen essentially are not.`),
      ],
      sample: T(`溶液，通常是 1–5 % 的硝酸介质，溶解的固体总量最好低于约 1 %（否则堵雾化器和炬管）。固体先酸消解或碱熔。每个样品约需 2–5 mL，测量 1–3 分钟。`, `Solutions, usually in 1–5 % nitric acid, with total dissolved solids preferably below about 1 % (otherwise nebuliser and torch clog). Solids are digested in acid or fused first. Each sample takes about 2–5 mL and 1–3 minutes.`),
      nums: [
        [T(`等离子体`, `Plasma`), T(`6000–10000 K；氩气 12–18 L/min；射频功率 1.0–1.5 kW`, `6000–10000 K; argon 12–18 L/min; RF power 1.0–1.5 kW`)],
        [T(`检出限`, `Detection limits`), T(`多数元素 0.1–10 μg/L`, `0.1–10 μg/L for most elements`)],
        [T(`线性范围`, `Linear range`), T(`5–6 个数量级`, `5–6 orders of magnitude`)],
        [T(`常用分析线`, `Common analytical lines`), T(`Ca II 393.366，Mg II 279.553，Fe II 238.204，Cu I 324.754，Zn I 213.857，Pb II 220.353，Cd II 214.439 nm`, `Ca II 393.366, Mg II 279.553, Fe II 238.204, Cu I 324.754, Zn I 213.857, Pb II 220.353, Cd II 214.439 nm`)],
      ],
      read: [
        T(`每种元素至少看两条线，两条线算出的浓度应当一致；不一致说明其中一条有光谱干扰。`, `Look at two or more lines for each element; the concentrations they give should agree, and disagreement means spectral interference on one of them.`),
        T(`看分析线窗口里的峰形：峰的一侧有肩膀，或者背景一边高一边低，都要换线或者做干扰校正。`, `Inspect the peak shape in the analytical window: a shoulder on one side, or a background that slopes, calls for another line or an interference correction.`),
      ],
      traps: [
        T(`光谱干扰是主要问题：铁、钴、镍、钨、稀土这些元素有成千上万条线，样品里含量一高，就会压在别的元素的分析线上或抬高背景。`, `Spectral interference is the main problem: iron, cobalt, nickel, tungsten and the rare earths have thousands of lines, and at high concentration they fall on the analytical lines of other elements or raise the background.`),
        T(`样品和标准溶液的酸度、含盐量不同会改变雾化效率和等离子体状态，信号偏差可达百分之十几。用基体匹配的标准，或者加内标（常用钇 371.029 nm）校正。`, `Differences in acidity and salt content between samples and standards change nebulisation efficiency and plasma conditions, biasing signals by ten per cent or more. Matrix-matched standards or an internal standard (commonly yttrium at 371.029 nm) correct for it.`),
        T(`它测的是溶液里的元素总量。消解不完全（硅酸盐不加氢氟酸、难溶氧化物）时，没溶出来的那部分就测不到。`, `It measures the total element in solution. With incomplete digestion (silicates without hydrofluoric acid, refractory oxides) the undissolved part goes unmeasured.`),
      ],
      figs: [
        { gen: 'icplines', args: { on: ['Mg', 'Ca', 'Cu', 'Zn'] }, cap: T(`由文献的谱线波长画出：勾选元素，看它常用的分析线在 180–800 nm 的什么位置（I 是原子线，II 是一价离子线）。线的高度只是示意。真实的谱上每种元素还有许多较弱的线，这里只画了最常用的几条。`, `Drawn from literature wavelengths: tick elements to see where their usual analytical lines lie between 180 and 800 nm (I for atomic lines, II for lines of the singly charged ion). Heights are illustrative. Real spectra show many weaker lines of each element; only the commonest are drawn.`) },
      ],
      table: 'atomic-lines',
      see: [['#m-icpms', T(`电感耦合等离子体质谱：检出限再低三个数量级`, `ICP mass spectrometry: detection limits three orders lower`)], ['#m-aas', T(`原子吸收光谱`, `Atomic absorption spectroscopy`)]],
      refs: ['fassel1978'],
    },
    {
      id: 'libs', fam: 'atom', abbr: 'LIBS', name: T(`激光诱导击穿光谱`, `Laser-induced breakdown spectroscopy`),
      one: T(`把一束纳秒脉冲激光聚焦到样品表面，烧蚀下来的一点点物质变成上万度的等离子体，冷却时发出各元素的原子线。不用制样，一秒钟出结果，隔着几米远也能测，固体、液体、气体都行。好奇号火星车上的 ChemCam 就是用它在 7 米外分析岩石。`, `Focus a nanosecond laser pulse on a surface and the speck of ablated material becomes a plasma at over ten thousand kelvin that emits the atomic lines of its elements as it cools. No sample preparation, a result within a second, measurement from metres away, on solids, liquids or gases. ChemCam on the Curiosity rover analyses rocks this way from 7 metres.`),
      how: [
        T(`聚焦后的辐照度超过约 1 GW/cm² 时，材料被击穿，几纳克到几微克的物质被烧蚀并电离。等离子体最初的几百纳秒里温度极高，发出很强的连续背景（轫致辐射和复合辐射），谱线很宽；之后它膨胀冷却，连续背景衰减得比原子线快。所以探测器要延迟约 1 μs 再打开（门控），才能得到背景低、线尖的谱。`, `Above an irradiance of about 1 GW/cm² at the focus the material breaks down, and nanograms to micrograms are ablated and ionised. For the first few hundred nanoseconds the plasma is extremely hot and emits a strong continuum (bremsstrahlung and recombination) with broad lines; as it expands and cools the continuum decays faster than the atomic lines. The detector is therefore gated to open after a delay of about 1 μs, giving a spectrum with low background and sharp lines.`),
        T(`它能测包括氢、锂、铍、硼、碳在内的所有元素，这些轻元素正是 X 射线荧光测不了的。每个脉冲只烧掉微米量级的一小点，几乎不损伤样品；在同一点连续打，可以一层层往下做深度剖析；逐点扫描就是元素分布图。`, `It detects every element including hydrogen, lithium, beryllium, boron and carbon, the light elements that X-ray fluorescence cannot handle. Each pulse removes a spot only micrometres across and hardly damages the sample; repeated pulses at one spot profile in depth layer by layer, and scanning point by point gives element maps.`),
        T(`定量比较难。烧蚀量和等离子体的温度随样品的硬度、颜色、表面状态变化（基体效应很强），脉冲之间的波动有 5–20 %。常用的办法是用成分相近的标样建立校准，用基体元素的线做内标，对许多次脉冲取平均，或者用多变量统计模型。`, `Quantification is difficult. The ablated mass and plasma temperature depend on the hardness, colour and surface condition of the sample (strong matrix effects), and pulses fluctuate by 5–20 %. Common remedies are calibration with standards of similar composition, a line of a matrix element as internal standard, averaging over many pulses, or multivariate models.`),
      ],
      axes: T(`横轴是波长（常见范围 200–900 nm），纵轴是发射强度。`, `Wavelength (commonly 200–900 nm) against emission intensity.`),
      tells: [
        T(`废金属分拣（铝合金牌号）、钢水成分的在线监测、矿石品位。`, `Scrap sorting (aluminium alloy grades), on-line monitoring of molten steel, ore grades.`),
        T(`锂电池材料里的锂、钢里的碳、核设施里的远距离测量。`, `Lithium in battery materials, carbon in steel, stand-off measurements in nuclear facilities.`),
        T(`文物、颜料的微损分析；行星表面岩石和土壤的成分。`, `Minimally invasive analysis of artefacts and pigments; the composition of rocks and soils on planetary surfaces.`),
      ],
      sample: T(`任何状态，不用制样。先打几个脉冲把表面的污染和氧化层清掉，再开始记录。`, `Any state, without preparation. A few cleaning pulses remove surface contamination and oxide before recording.`),
      nums: [
        [T(`典型激光`, `Typical laser`), T(`Nd:YAG 1064 nm，5–10 ns，10–100 mJ`, `Nd:YAG at 1064 nm, 5–10 ns, 10–100 mJ`)],
        [T(`检出限`, `Detection limits`), T(`约 1–100 mg/kg（ppm）`, `About 1–100 mg/kg (ppm)`)],
        [T(`精密度`, `Precision`), T(`5–20 %（相对标准偏差）`, `5–20 % (relative standard deviation)`)],
        [T(`门延迟`, `Gate delay`), T(`约 0.5–2 μs`, `About 0.5–2 μs`)],
      ],
      read: [
        T(`和原子发射一样对谱线表认元素；离子线（II）和原子线（I）的强度比反映等离子体的温度。`, `Identify elements from line tables as in atomic emission; the ratio of ionic (II) to atomic (I) line intensities reflects the plasma temperature.`),
      ],
      traps: [
        T(`强的共振线（如钠 589 nm、铝 396 nm）在主量元素上严重自吸，定量要选较弱的非共振线。`, `Strong resonance lines (sodium 589 nm, aluminium 396 nm) of major elements are heavily self-absorbed; weaker non-resonant lines are used for quantification.`),
        T(`在空气里测，谱上会有氮、氧、氢（水汽）的线和 CN 分子带，不要把它们算成样品的成分。`, `Measured in air, spectra contain lines of nitrogen, oxygen and hydrogen (from moisture) and CN bands, which must not be attributed to the sample.`),
      ],
      figs: [
        { sketch: { x: [270, 410], xl: T(`波长（nm）`, `wavelength (nm)`), yl: T(`发射强度（示意）`, `emission intensity (schematic)`), peaks: [[279.55, 0.5, 0.35, T(`Mg II`, `Mg II`)], [280.27, 0.3, 0.35], [285.21, 0.35, 0.35, T(`Mg I`, `Mg I`)], [288.16, 0.22, 0.35, T(`Si I`, `Si I`)], [308.22, 0.55, 0.35, T(`Al I`, `Al I`)], [309.27, 0.7, 0.35], [324.75, 0.3, 0.35, T(`Cu I`, `Cu I`)], [327.40, 0.18, 0.35], [394.40, 0.8, 0.4, T(`Al I`, `Al I`)], [396.15, 1, 0.4], [403.08, 0.15, 0.4, T(`Mn I`, `Mn I`)]] },
          cap: T(`示意：铝合金的激光诱导击穿光谱。谱线位置取文献值（Al I 308.22、309.27、394.40、396.15；Mg II 279.55、280.27；Mg I 285.21；Si I 288.16；Cu I 324.75、327.40；Mn I 403.08 nm），高度是示意的。合金牌号就是靠镁、硅、铜、锰的线相对铝线的强弱来区分。`, `Schematic: a laser-induced breakdown spectrum of an aluminium alloy. Line positions are literature values (Al I 308.22, 309.27, 394.40, 396.15; Mg II 279.55, 280.27; Mg I 285.21; Si I 288.16; Cu I 324.75, 327.40; Mn I 403.08 nm); heights are illustrative. Alloy grades are told apart by the strengths of the magnesium, silicon, copper and manganese lines relative to aluminium.`) },
      ],
      see: [['#m-xrf', T(`X 射线荧光`, `X-ray fluorescence`)], ['#m-aes', T(`原子发射光谱`, `Atomic emission`)]],
      refs: ['hahn2012'],
    },
  );
})();
