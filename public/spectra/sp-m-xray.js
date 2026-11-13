'use strict';
// 谱图馆 · X 射线、电子与衍射一族。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'pxrd', fam: 'xray', core: true, abbr: 'PXRD', name: T(`粉末 X 射线衍射`, `Powder X-ray diffraction`),
      one: T(`X 射线的波长和原子间距相当，晶体里一层层平行的原子面像光栅一样把它衍射到特定的角度。粉末样品的衍射图上，峰的位置由晶胞决定，强度由原子在晶胞里的位置决定，宽度由晶粒大小决定。每种晶相有自己的一套峰，所以它是固体物相鉴定的第一选择。`, `X-ray wavelengths match interatomic distances, and the parallel planes of atoms in a crystal diffract them like a grating into specific angles. In a powder pattern the peak positions are set by the unit cell, the intensities by the positions of atoms within it and the widths by the crystallite size. Each crystalline phase has its own set of peaks, which makes this the first choice for identifying solid phases.`),
      how: [
        T(`Bragg 定律：nλ = 2d·sinθ。面间距为 d 的一族晶面只在满足这个条件的掠射角 θ 上有相长干涉。粉末里有取向各异的无数小晶粒，总有一些恰好处在衍射位置，所以让探测器扫过 2θ 就依次记下每一族晶面的峰。实验室最常用铜靶的 Kα 线，波长 1.5406 Å。立方晶系里 d = a / √(h² + k² + l²)，由峰位直接算出晶胞参数 a。`, `Bragg's law: nλ = 2d·sinθ. A family of planes of spacing d interferes constructively only at the glancing angle θ that satisfies it. A powder contains countless crystallites in all orientations, some always in diffracting position, so sweeping the detector through 2θ records a peak for each family of planes in turn. Laboratories mostly use the Kα line of copper, 1.5406 Å. In the cubic system d = a / √(h² + k² + l²), so peak positions give the cell parameter a directly.`),
        T(`峰的强度正比于结构因子模的平方：F_hkl = Σ f_j·exp[2πi(hx_j + ky_j + lz_j)]，对晶胞里所有原子求和，f_j 是原子散射因子（大致正比于电子数，随角度增大而下降）。晶胞里的原子排布会让某些峰完全抵消（系统消光）：面心立方只出现 h、k、l 全奇或全偶的峰，体心立方只出现 h + k + l 为偶数的峰。NaCl 的 (111) 峰来自 Na⁺ 和 Cl⁻ 散射因子之差，所以很弱；KCl 里 K⁺ 和 Cl⁻ 电子数相同，(111) 几乎完全消失，图样看上去像一个边长减半的简单立方。`, `Peak intensity is proportional to the squared modulus of the structure factor, F_hkl = Σ f_j·exp[2πi(hx_j + ky_j + lz_j)], summed over the atoms of the cell, with f_j the atomic scattering factor (roughly proportional to the number of electrons, falling with angle). The arrangement of atoms can cancel some peaks completely (systematic absences): a face-centred cubic lattice shows only peaks with h, k, l all odd or all even, a body-centred one only those with h + k + l even. The (111) peak of NaCl arises from the difference between the scattering factors of Na⁺ and Cl⁻ and is weak; in KCl, K⁺ and Cl⁻ have equal numbers of electrons, (111) nearly vanishes, and the pattern looks like a simple cubic cell of half the edge.`),
        T(`晶粒小于约 100 nm 时峰明显变宽。Scherrer 公式：晶粒尺寸 τ = Kλ / (β·cosθ)，β 是扣除仪器宽度后的半高宽（弧度），K 约 0.9。10 nm 的晶粒在 2θ = 40° 处的峰宽约 0.85°。微观应变也使峰变宽，但随角度的变化规律不同（正比于 tanθ），Williamson–Hall 作图可以把两者分开。Rietveld 精修用结构模型算出整张图去拟合实测图，同时得到晶胞参数、原子位置、各物相的质量分数和晶粒尺寸。`, `Crystallites below about 100 nm broaden the peaks visibly. The Scherrer equation gives the crystallite size τ = Kλ / (β·cosθ), with β the width at half maximum (in radians) after removing the instrumental width and K about 0.9. A 10 nm crystallite gives a peak about 0.85° wide at 2θ = 40°. Microstrain broadens peaks too, but with a different angular dependence (proportional to tanθ); a Williamson–Hall plot separates the two. Rietveld refinement computes the whole pattern from a structural model and fits it to the measurement, yielding cell parameters, atom positions, the mass fraction of each phase and crystallite size at once.`),
        T(`实验室的粉末衍射仪大多是 Bragg–Brentano 几何：X 射线管和探测器各在测角仪圆上转动，样品平面始终平分入射线和衍射线（θ–2θ 扫描），发散的光束在探测器处重新聚焦。光路上的发散狭缝限制照射面积，Soller 狭缝（一叠平行薄片）限制轴向发散、使低角度峰不那么不对称；铜靶的 Kβ 线（1.3922 Å）用镍滤片或单色器去掉，否则每个强峰旁边都会多出一个小峰。用面探测器或透射几何时，每族晶面的衍射是一个圆锥，在探测器上留下一圈 Debye–Scherrer 环：环是连续均匀的说明晶粒多而随机，断成斑点说明晶粒太大，某一段特别亮说明择优取向。`, `Most laboratory powder diffractometers use Bragg–Brentano geometry: tube and detector move on the goniometer circle while the sample surface always bisects the incident and diffracted beams (a θ–2θ scan), and the divergent beam refocuses at the detector. A divergence slit limits the irradiated area; Soller slits (a stack of thin parallel plates) limit axial divergence and make low-angle peaks less asymmetric; the Kβ line of a copper tube (1.3922 Å) is removed with a nickel filter or a monochromator, or every strong peak acquires a small extra neighbour. With an area detector or in transmission, each family of planes diffracts into a cone that leaves a Debye–Scherrer ring on the detector: a smooth, even ring means many randomly oriented crystallites, a spotty ring means the grains are too large, and a bright arc means preferred orientation.`),
      ],
      axes: T(`横轴是衍射角 2θ（度），纵轴是强度（计数）。换一种波长，峰的位置全都变，所以报告时要注明辐射；和波长无关的量是 d 或 Q = 4π sinθ / λ。`, `Diffraction angle 2θ (degrees) against intensity (counts). A different wavelength moves every peak, so the radiation must be stated; the wavelength-independent quantities are d and Q = 4π sinθ / λ.`),
      tells: [
        T(`样品是哪种晶相（和数据库比对）：锐钛矿还是金红石，是不是目标 MOF，药物是哪种晶型。`, `Which crystalline phase a sample is (by matching against a database): anatase or rutile, the intended MOF or not, which polymorph of a drug.`),
        T(`纯不纯：有没有杂相的峰（检出限约 1–5 %）；混合物里各相的比例。`, `Whether it is pure: peaks of impurity phases (detection limit about 1–5 %); the proportions of phases in a mixture.`),
        T(`晶胞参数（掺杂后晶格的膨胀收缩，Vegard 定律）、晶粒尺寸、结晶度、择优取向。`, `Cell parameters (lattice expansion or contraction on doping, Vegard's law), crystallite size, crystallinity, preferred orientation.`),
        T(`原位跟踪相变、电池电极的充放电、合成反应的进程。`, `In situ following of phase transitions, battery electrodes during cycling, the course of a synthesis.`),
      ],
      sample: T(`研细（小于约 10 μm）的粉末压平在样品槽里，约 0.1–1 g；样品少时铺在零背景的单晶硅片上。片状、针状的晶粒容易平躺，造成择优取向，要侧装或掺入无定形粉末。`, `A finely ground powder (below about 10 μm) pressed flat in a holder, about 0.1–1 g; small amounts are spread on a zero-background silicon wafer. Plate- or needle-shaped crystallites tend to lie flat and cause preferred orientation; side-loading or dilution with an amorphous powder helps.`),
      nums: [
        [T(`Cu Kα₁`, `Cu Kα₁`), T(`1.5406 Å（8.048 keV）；Kα₂ 1.5444 Å，强度约为一半`, `1.5406 Å (8.048 keV); Kα₂ 1.5444 Å at about half the intensity`)],
        [T(`Mo Kα₁`, `Mo Kα₁`), T(`0.7093 Å`, `0.7093 Å`)],
        [T(`硅标样（a = 5.4309 Å）`, `Silicon standard (a = 5.4309 Å)`), T(`(111) 28.44°，(220) 47.30°，(311) 56.12°`, `(111) 28.44°, (220) 47.30°, (311) 56.12°`)],
        [T(`NaCl（a = 5.6402 Å）`, `NaCl (a = 5.6402 Å)`), T(`(200) 31.70° 最强，(220) 45.45°，(111) 27.37° 很弱`, `(200) 31.70° strongest, (220) 45.45°, (111) 27.37° very weak`)],
        [T(`TiO₂`, `TiO₂`), T(`锐钛矿 (101) 25.3°，金红石 (110) 27.4°`, `Anatase (101) 25.3°, rutile (110) 27.4°`)],
      ],
      read: [
        T(`先和数据库或由晶体结构算出的图样比对最强的三到五个峰，位置和相对强度都要对上。`, `Match the three to five strongest peaks against a database or a pattern calculated from the crystal structure, in both position and relative intensity.`),
        T(`所有的峰都要有归属。多出来的峰是杂相；该有的峰没有，要么认错了相，要么是择优取向。`, `Every peak needs an assignment. Extra peaks mean an impurity phase; missing ones mean either the wrong phase or preferred orientation.`),
        T(`峰整体向低角度移动说明晶格膨胀，向高角度移动说明收缩；宽的鼓包（“馒头峰”）是无定形成分。`, `A shift of all peaks to lower angle indicates lattice expansion, to higher angle contraction; a broad hump is amorphous material.`),
      ],
      traps: [
        T(`没有峰不等于没有这种物质：无定形的、晶粒只有一两纳米的、含量低于 1–5 % 的都看不到。“XRD 显示纯相”只说明没有检出结晶的杂相。`, `No peaks does not mean no such substance: amorphous material, crystallites of a nanometre or two and phases below 1–5 % are invisible. "Phase-pure by XRD" only means that no crystalline impurity was detected.`),
        T(`Scherrer 公式给的是相干衍射区的尺寸，不是电镜下看到的颗粒尺寸（一个颗粒可以由许多晶粒组成），而且要先扣仪器展宽；晶粒大于 100 nm 时它已经不可靠。`, `The Scherrer equation gives the size of coherently diffracting domains, not the particle size seen by electron microscopy (a particle may contain many crystallites), and instrumental broadening must be removed first; above 100 nm it is no longer reliable.`),
        T(`含铁、钴、锰的样品在铜靶下会发出强烈的荧光：背景高、峰显得很弱。换钴靶或钼靶，或者用能分辨能量的探测器把荧光去掉。`, `Samples containing iron, cobalt or manganese fluoresce strongly under a copper tube: the background is high and the peaks look weak. Switch to a cobalt or molybdenum tube, or use an energy-discriminating detector to reject the fluorescence.`),
        T(`样品表面高于或低于测角仪的圆心会让所有峰一起偏移，掺一点硅粉做内标可以校正。`, `A sample surface above or below the goniometer axis shifts all peaks together; a little silicon powder as internal standard corrects it.`),
      ],
      figs: [
        { gen: 'pxrd', args: { pick: ['NaCl', 'KCl', 'MgO', 'CsCl', 'Si', 'C', 'ZnS', 'CaF2', 'Cu', 'Al', 'Au', 'Fe', 'W', 'TiO2'] }, cap: T(`由晶体结构算出（实测的晶胞参数和原子位置，Cu Kα₁，包括原子散射因子、多重性和 Lorentz–偏振因子，不含温度因子）。NaCl 的 (111) 只有最强峰的 8 %；换成 KCl，(111) 几乎没有了。拖动晶粒尺寸看 Scherrer 展宽。`, `Calculated from crystal structures (measured cell parameters and atom positions, Cu Kα₁, with atomic scattering factors, multiplicities and the Lorentz–polarisation factor, without thermal factors). The (111) peak of NaCl is only 8 % of the strongest; switch to KCl and it almost disappears. Vary the crystallite size to see Scherrer broadening.`) },
      ],
      see: [['#lab-xrd', T(`动手实验室：粉末衍射`, `Hands-on lab: powder diffraction`)]],
      refs: ['bragg1913', 'patterson1939', 'rietveld1969', 'ong2013'],
    },
    {
      id: 'scxrd', fam: 'xray', core: true, abbr: 'SCXRD', name: T(`单晶 X 射线衍射`, `Single-crystal X-ray diffraction`),
      one: T(`让一颗零点几毫米的单晶在 X 射线里转动，记下几千到几万个衍射点的强度，由此重建出晶胞里电子密度的三维分布。每个原子的位置、键长、键角、绝对构型都直接“看见”了。它是确定分子结构的最终依据。`, `A single crystal a fraction of a millimetre across is rotated in an X-ray beam, the intensities of thousands to tens of thousands of diffraction spots are recorded, and from them the three-dimensional electron density of the unit cell is reconstructed. The position of every atom, bond lengths, angles and absolute configuration are seen directly. It is the final arbiter of molecular structure.`),
      how: [
        T(`每个衍射点对应一组晶面 (hkl)，它的强度正比于结构因子模的平方 |F_hkl|²。电子密度是所有结构因子的傅里叶合成：ρ(x,y,z) = (1/V) Σ F_hkl·exp[−2πi(hx + ky + lz)]。麻烦在于实验只能测到 |F|，测不到它的相位，这就是“相位问题”。小分子晶体的数据多、原子少，直接法或对偶空间法靠强度之间的统计关系几秒钟就能把相位推出来；蛋白质用分子置换或反常散射。`, `Each spot corresponds to a set of planes (hkl), with an intensity proportional to the squared modulus of the structure factor, |F_hkl|². The electron density is the Fourier synthesis of all structure factors: ρ(x,y,z) = (1/V) Σ F_hkl·exp[−2πi(hx + ky + lz)]. The catch is that only |F| is measured, not its phase: the phase problem. For small molecules, with many data and few atoms, direct or dual-space methods derive the phases from statistical relations between intensities in seconds; proteins use molecular replacement or anomalous scattering.`),
        T(`有了初始模型就做最小二乘精修：调整每个原子的坐标和位移参数（描述热振动的椭球），让算出的 |F| 和实测的尽量一致。一致的程度用 R₁ = Σ||F_o| − |F_c|| / Σ|F_o| 表示，好的小分子结构在 5 % 以下。数据的分辨率（能测到的最小面间距）决定了细节看得多清楚：小分子通常到 0.84 Å 或更好，蛋白质多在 1.5–3 Å。`, `With an initial model comes least-squares refinement: the coordinates and displacement parameters (ellipsoids describing thermal motion) of every atom are adjusted until calculated |F| match the observed ones. Agreement is expressed as R₁ = Σ||F_o| − |F_c|| / Σ|F_o|, below 5 % for a good small-molecule structure. The resolution of the data (the smallest spacing measured) decides how much detail is visible: usually 0.84 Å or better for small molecules, mostly 1.5–3 Å for proteins.`),
        T(`手性分子的绝对构型靠反常散射确定：X 射线能量接近某种原子的吸收边时，(hkl) 和 (−h−k−l) 的强度不再相等。Flack 参数 x 接近 0（标准不确定度小于 0.1）说明模型的手性是对的，接近 1 说明反了。只含 C、H、N、O 的分子反常散射很弱，要用铜靶和高质量的数据。`, `The absolute configuration of a chiral molecule comes from anomalous scattering: near the absorption edge of an atom, the intensities of (hkl) and (−h−k−l) are no longer equal. A Flack parameter x near 0 (with a standard uncertainty below 0.1) means the handedness of the model is right, near 1 that it is inverted. Molecules of only C, H, N and O scatter anomalously very weakly and need copper radiation and data of high quality.`),
      ],
      axes: T(`原始数据是探测器上的衍射点图像。最后的结果不是一张谱，而是一个结构模型（CIF 文件）：晶胞、空间群、原子坐标和位移参数，通常画成热椭球图。`, `The raw data are images of diffraction spots on a detector. The final result is not a spectrum but a structural model (a CIF file): unit cell, space group, atomic coordinates and displacement parameters, usually drawn as a thermal-ellipsoid plot.`),
      tells: [
        T(`原子怎样连接、键长（精确到 0.001–0.005 Å）、键角、构象、绝对构型。`, `Connectivity, bond lengths (to 0.001–0.005 Å), angles, conformation, absolute configuration.`),
        T(`分子在晶体里怎样堆积：氢键、π 堆积、溶剂分子的位置；MOF 的孔道结构。`, `How molecules pack in the crystal: hydrogen bonds, π stacking, the positions of solvent molecules; the pore structure of MOFs.`),
        T(`蛋白质的三维结构，以及药物分子在靶点口袋里的结合方式。`, `Three-dimensional structures of proteins, and how a drug molecule binds in the pocket of its target.`),
      ],
      sample: T(`一颗没有裂纹、不是孪晶的单晶，边长 0.05–0.5 mm。挑出来粘在微环上，用 100 K 的冷氮气流冻住（减小热振动、防止溶剂跑掉）。长出合适的晶体往往是最难的一步。`, `One single crystal, uncracked and untwinned, 0.05–0.5 mm on an edge, mounted on a loop and held in a stream of nitrogen gas at 100 K (to reduce thermal motion and keep solvent in). Growing a suitable crystal is often the hardest step.`),
      nums: [
        [T(`小分子的分辨率要求`, `Resolution expected for small molecules`), T(`0.84 Å 或更好（sinθ/λ ≥ 0.6 Å⁻¹）`, `0.84 Å or better (sinθ/λ ≥ 0.6 Å⁻¹)`)],
        [T(`好的精修指标`, `Good refinement indicators`), T(`R₁ < 5 %，wR₂ < 15 %，拟合优度接近 1`, `R₁ < 5 %, wR₂ < 15 %, goodness of fit near 1`)],
        [T(`Flack 参数`, `Flack parameter`), T(`接近 0 且不确定度小于 0.1`, `Near 0 with an uncertainty below 0.1`)],
        [T(`剑桥结构数据库`, `Cambridge Structural Database`), T(`一百三十多万个有机和金属有机晶体结构`, `More than 1.3 million organic and metal-organic crystal structures`)],
      ],
      read: [
        T(`看结构之前先看质量指标：R₁、数据完整度、数据与参数之比（最好大于 10）、最大残余电子密度峰（轻原子结构应小于约 0.5 e/Å³），以及 checkCIF 报告里的 A 级和 B 级警告。`, `Before looking at the structure look at the quality indicators: R₁, completeness, the data-to-parameter ratio (preferably above 10), the largest residual density peak (below about 0.5 e/Å³ for light-atom structures) and the level A and B alerts of the checkCIF report.`),
        T(`热椭球应该大小相近、形状合理。特别大、特别扁或者“非正定”的椭球，说明那个原子的元素认错了，或者那里有无序。`, `Thermal ellipsoids should be of similar size and sensible shape. One that is very large, very flat or non-positive-definite signals a wrongly assigned element or disorder at that site.`),
      ],
      traps: [
        T(`X 射线被电子散射，所以氢原子（只有一个电子，而且被拉向成键方向）定位不准，X–H 键长看起来短约 0.1 Å；要准确的氢位置得用中子衍射。相邻的元素（C、N、O）电子数只差一个，单凭电子密度容易认错。`, `X-rays are scattered by electrons, so hydrogen atoms (one electron, drawn towards the bond) are poorly located and X–H bonds appear about 0.1 Å short; accurate hydrogen positions need neutron diffraction. Neighbouring elements (C, N, O) differ by one electron and are easily confused from density alone.`),
        T(`挑出来的那一颗晶体不一定代表整批样品。要用粉末衍射核对：整批粉末的衍射图应当和由单晶结构算出的图样一致。`, `The one crystal chosen need not represent the bulk. Check with powder diffraction: the pattern of the bulk powder should match the one calculated from the single-crystal structure.`),
        T(`晶体结构是时间和空间上的平均，而且是固态里的构象，溶液里可以不同。`, `A crystal structure is an average over time and space, and a solid-state conformation that may differ in solution.`),
      ],
      figs: [
        { gen: 'fourier1d', cap: T(`模型计算：一维“晶体”里三个原子的电子密度，用越来越多的衍射级次做傅里叶合成。只用最低的几级时原子糊成一片；级次越多（分辨率越高），峰越尖，轻原子也显出来。这就是“分辨率”的含义。`, `Model calculation: the electron density of three atoms in a one-dimensional "crystal", synthesised from more and more diffraction orders. With only the lowest few the atoms blur together; the more orders (the higher the resolution), the sharper the peaks, until the light atom appears as well. This is what resolution means.`) },
      ],
      refs: ['bragg1913', 'sheldrick2008', 'flack1983'],
    },
    {
      id: 'xps', fam: 'xray', core: true, abbr: 'XPS · ESCA', name: T(`X 射线光电子能谱`, `X-ray photoelectron spectroscopy`),
      one: T(`用能量已知的 X 射线把内层电子打出来，测它们的动能，算出结合能。每种元素有自己的一套结合能，同一元素处在不同化学态时结合能相差零点几到几个电子伏。出射的电子只能从最表面几纳米逃出来，所以它回答的是：表面有哪些元素，各是什么价态。`, `X-rays of known energy eject core electrons, whose kinetic energies are measured and converted to binding energies. Every element has its own set of binding energies, and one element in different chemical states differs by tenths of an electronvolt to a few electronvolts. The electrons escape only from the topmost few nanometres, so the questions answered are: which elements are at the surface, and in which chemical state.`),
      how: [
        T(`光电效应的能量关系：E_B = hν − E_k − φ，hν 是光子能量（铝 Kα 是 1486.6 eV），E_k 是测到的动能，φ 是谱仪的功函数。内层电子的结合能由原子核的电荷决定，是元素的指纹：C 1s 约 285 eV，N 1s 约 400，O 1s 约 531，Si 2p 约 100，Au 4f₇/₂ 是 84.0 eV。`, `The energy balance of the photoelectric effect is E_B = hν − E_k − φ, with hν the photon energy (1486.6 eV for aluminium Kα), E_k the measured kinetic energy and φ the work function of the spectrometer. Core binding energies are set by the nuclear charge and fingerprint the element: C 1s near 285 eV, N 1s near 400, O 1s near 531, Si 2p near 100, Au 4f₇/₂ at 84.0 eV.`),
        T(`化学位移：原子的价电子被电负性强的邻居拉走以后，内层电子感受到的核吸引变强，结合能升高。碳的 C 1s 从 C–C 的 284.8 eV 到 C–O 的约 286.5、C=O 的约 288、O–C=O 的约 289、CF₂ 的约 292 eV；硅从单质的 99.4 eV 到 SiO₂ 的 103.5 eV；钛的 2p₃/₂ 从金属的 454 eV 到 TiO₂ 的 458.6 eV。p、d、f 能级因为自旋–轨道耦合裂成双峰，面积比固定为 1:2、2:3、3:4。`, `The chemical shift: when electronegative neighbours draw valence electrons away, the core electrons feel a stronger nuclear attraction and their binding energy rises. C 1s goes from 284.8 eV for C–C to about 286.5 for C–O, 288 for C=O, 289 for O–C=O and 292 eV for CF₂; silicon from 99.4 eV in the element to 103.5 eV in SiO₂; Ti 2p₃/₂ from 454 eV in the metal to 458.6 eV in TiO₂. Spin–orbit coupling splits p, d and f levels into doublets with fixed area ratios of 1:2, 2:3 and 3:4.`),
        T(`表面灵敏来自电子的非弹性平均自由程：动能几百到一千多电子伏的电子在固体里平均只走 1–3 nm 就损失能量，所以 95 % 的信号来自约三个平均自由程（5–10 nm）以内。损失了能量的电子抬高了每个峰高结合能一侧的背景，定量前要扣掉（Shirley 背景）。峰面积除以灵敏度因子得到各元素的原子百分比。`, `Surface sensitivity comes from the inelastic mean free path: electrons with kinetic energies of a few hundred to a thousand electronvolts travel only 1–3 nm in a solid before losing energy, so 95 % of the signal originates within about three mean free paths (5–10 nm). Electrons that have lost energy raise the background on the high-binding-energy side of every peak, which is removed (a Shirley background) before quantification. Peak areas divided by sensitivity factors give atomic percentages.`),
      ],
      axes: T(`横轴是结合能（eV），按惯例从右到左增大；纵轴是每秒计数。全谱（0–1200 eV）看有哪些元素，高分辨窄扫看化学态。`, `Binding energy (eV), increasing from right to left by convention, against counts per second. A survey (0–1200 eV) shows which elements are present; high-resolution narrow scans show their chemical states.`),
      tells: [
        T(`表面 5–10 nm 内的元素组成（除氢、氦外的所有元素，检出限约 0.1 原子 %）。`, `Elemental composition of the top 5–10 nm (all elements but hydrogen and helium, down to about 0.1 atomic %).`),
        T(`化学态：催化剂上金属的价态、碳材料里的含氧和含氮基团、氧化层的厚度、聚合物表面改性的效果。`, `Chemical state: the oxidation state of metals on catalysts, oxygen- and nitrogen-containing groups in carbon materials, oxide layer thickness, the effect of surface modification of polymers.`),
        T(`成分随深度的变化（氩离子刻蚀剖析，或变角度测量）。`, `Composition against depth (argon-ion sputter profiling or angle-resolved measurement).`),
      ],
      sample: T(`固体，约 1 cm 见方，要耐超高真空（10⁻⁹ mbar）。表面要干净：手摸过、放在空气里的样品表面都有一层“外来碳”。粉末压在铟箔或导电胶带上。绝缘样品会带正电，要用低能电子中和。`, `A solid about 1 cm across that tolerates ultra-high vacuum (10⁻⁹ mbar). The surface must be clean: anything handled or kept in air carries a layer of adventitious carbon. Powders are pressed into indium foil or onto conductive tape. Insulators charge positively and are neutralised with low-energy electrons.`),
      nums: [
        [T(`Al Kα / Mg Kα`, `Al Kα / Mg Kα`), T(`1486.6 eV / 1253.6 eV`, `1486.6 eV / 1253.6 eV`)],
        [T(`能量标定`, `Energy calibration`), T(`Au 4f₇/₂ 84.0，Ag 3d₅/₂ 368.2，Cu 2p₃/₂ 932.6 eV`, `Au 4f₇/₂ 84.0, Ag 3d₅/₂ 368.2, Cu 2p₃/₂ 932.6 eV`)],
        [T(`取样深度`, `Sampling depth`), T(`约 5–10 nm（三个非弹性平均自由程）`, `About 5–10 nm (three inelastic mean free paths)`)],
        [T(`自旋–轨道分裂`, `Spin–orbit splittings`), T(`Si 2p 0.6，S 2p 1.2，Ti 2p 5.7，Ag 3d 6.0，Au 4f 3.7 eV`, `Si 2p 0.6, S 2p 1.2, Ti 2p 5.7, Ag 3d 6.0, Au 4f 3.7 eV`)],
      ],
      read: [
        T(`全谱：把每个峰对上元素，注意同一元素的所有强峰（包括俄歇峰）都应当出现。`, `Survey: assign every peak to an element, checking that all strong lines of each element (Auger lines included) are present.`),
        T(`窄扫分峰时守住物理约束：自旋–轨道双峰的间隔和面积比固定；同一种化学态的峰宽相近；分出来的每个组分都要有化学上的理由，并和其他元素的谱互相印证（C 1s 里分出了 C=O，O 1s 里就该有对应的量）。`, `In fitting narrow scans keep the physical constraints: fixed spacing and area ratio for spin–orbit doublets; similar widths for one kind of chemical state; a chemical reason for every component, cross-checked against the other elements (a C=O component in C 1s needs a matching amount in O 1s).`),
        T(`过渡金属的 2p 谱形状复杂（多重分裂、震激卫星峰），价态更可靠的判据常常是卫星峰：Cu²⁺ 在主峰高结合能一侧 6–10 eV 处有很强的卫星峰，Cu⁺ 和 Cu⁰ 没有。`, `The 2p spectra of transition metals have complex shapes (multiplet splitting, shake-up satellites), and satellites are often the more reliable sign of oxidation state: Cu²⁺ has strong satellites 6–10 eV above the main peak, Cu⁺ and Cu⁰ have none.`),
      ],
      traps: [
        T(`把外来碳的 C 1s 定在 284.8 eV 来校正荷电，是最普遍的做法，也是最大的误差来源：这个峰的真实位置随基底不同可以差 1 eV 以上。相差零点几个电子伏的“化学位移”不能只靠这种校正来论证。`, `Setting the C 1s of adventitious carbon to 284.8 eV to correct for charging is the commonest practice and the largest source of error: the true position of this peak varies by more than 1 eV with the substrate. A "chemical shift" of a few tenths of an electronvolt cannot rest on this correction alone.`),
        T(`X 射线和中和电子会还原样品：Cu²⁺、Ce⁴⁺、V⁵⁺ 在测量过程中被部分还原是常事。氩离子刻蚀更会打乱化学态（优先溅射氧，把氧化物还原）。`, `X-rays and neutralising electrons reduce the sample: partial reduction of Cu²⁺, Ce⁴⁺ and V⁵⁺ during measurement is routine. Argon-ion sputtering scrambles chemical states further (it removes oxygen preferentially and reduces oxides).`),
        T(`它只看表面几纳米，表面的组成和体相可以完全不同；Cu⁰ 和 Cu⁺ 的 2p 结合能几乎一样，要靠俄歇峰（俄歇参数）来分。`, `It sees only the top few nanometres, whose composition may differ entirely from the bulk; Cu⁰ and Cu⁺ have nearly the same 2p binding energy and are distinguished by the Auger line (the Auger parameter).`),
      ],
      figs: [
        { sketch: { x: [282, 294], rev: true, xl: T(`结合能（eV）`, `binding energy (eV)`), yl: T(`强度（示意）`, `intensity (schematic)`), sum: true, sets: [
          { label: T(`C–C / C–H（苯环）`, `C–C / C–H (ring)`), peaks: [[284.8, 1, 1.1]] },
          { label: T(`C–O`, `C–O`), alt: true, peaks: [[286.4, 0.33, 1.15]] },
          { label: T(`O–C=O`, `O–C=O`), dash: true, peaks: [[288.8, 0.33, 1.1]] },
          { label: T(`π–π* 卫星峰`, `π–π* satellite`), peaks: [[291.5, 0.05, 2.2]] }] },
          cap: T(`示意：聚对苯二甲酸乙二醇酯（PET）的 C 1s 谱。三种碳的结合能取文献通行值（苯环碳 284.8、C–O 约 286.4、O–C=O 约 288.8 eV），面积比按分子式是 3:1:1；线形、线宽和 291.5 eV 附近的 π–π* 卫星峰是示意的。`, `Schematic: the C 1s spectrum of poly(ethylene terephthalate) (PET). The binding energies of the three kinds of carbon are the generally quoted values (ring carbon 284.8, C–O about 286.4, O–C=O about 288.8 eV), with areas of 3:1:1 from the formula; line shapes, widths and the π–π* satellite near 291.5 eV are illustrative.`) },
        { sketch: { x: [0, 1100], rev: true, xl: T(`结合能（eV）`, `binding energy (eV)`), yl: T(`强度（示意）`, `intensity (schematic)`), rise: 0.45, peaks: [[458.6, 0.9, 9, T(`Ti 2p`, `Ti 2p`)], [464.3, 0.42, 9], [530, 1, 9, T(`O 1s`, `O 1s`)], [284.8, 0.22, 9, T(`C 1s`, `C 1s`)], [37, 0.18, 9, T(`Ti 3p`, `Ti 3p`)], [62, 0.1, 9, T(`Ti 3s`, `Ti 3s`)], [22, 0.1, 9, T(`O 2s`, `O 2s`)], [565, 0.14, 10, T(`Ti 2s`, `Ti 2s`)], [976, 0.3, 22, T(`O KLL`, `O KLL`)]] },
          cap: T(`示意：TiO₂ 的全谱。Ti 2p₃/₂ 在 458.6 eV，2p₁/₂ 在 464.3 eV（分裂 5.7 eV），O 1s 在 530 eV，表面还有外来碳的 C 1s。976 eV 附近的宽峰是氧的 KLL 俄歇电子（动能约 510 eV，用 Al Kα 时落在这里）。每个峰的高结合能一侧背景抬高，是非弹性散射造成的。峰高是示意的。`, `Schematic: a survey spectrum of TiO₂. Ti 2p₃/₂ at 458.6 eV and 2p₁/₂ at 464.3 eV (split by 5.7 eV), O 1s at 530 eV, and C 1s of adventitious carbon on the surface. The broad feature near 976 eV is the oxygen KLL Auger electron (kinetic energy about 510 eV, which lands here with Al Kα). The background steps up on the high-binding-energy side of each peak through inelastic scattering. Peak heights are illustrative.`) },
      ],
      table: 'xps-be',
      refs: ['siegbahn1982', 'shirley1972', 'seah1979', 'greczynski2020', 'major2020'],
    },
    {
      id: 'xrf', fam: 'xray', abbr: 'XRF · EDS · WDS', name: T(`X 射线荧光与能谱`, `X-ray fluorescence and energy-dispersive spectroscopy`),
      one: T(`把原子的内层电子打掉，外层电子跳下来填空位时放出特征 X 射线，能量只和元素有关。用 X 射线激发叫 X 射线荧光（XRF），不破坏样品，几分钟测出从钠到铀的含量；用电镜里的电子束激发叫能谱（EDS），给出微米尺度上的元素分布。`, `Knock out an inner electron of an atom, and an outer electron dropping into the hole emits a characteristic X-ray whose energy depends only on the element. Excited by X-rays this is X-ray fluorescence (XRF), which measures elements from sodium to uranium non-destructively in minutes; excited by the electron beam of a microscope it is energy-dispersive spectroscopy (EDS), which maps elements on the micrometre scale.`),
      how: [
        T(`K 层出现空位后，L 层电子跳下来放出 Kα 线，M 层电子跳下来放出 Kβ 线（强度约为 Kα 的七分之一）；重元素的 K 层太深，常用 L 系线。Moseley 定律：特征线的频率的平方根和原子序数成线性关系，√ν ∝ (Z − σ)。Kα 的能量大致是 10.2 eV × (Z − 1)²：铁（Z = 26）是 6.40 keV，铜（Z = 29）是 8.05 keV。这条定律在 1913 年第一次说明原子序数是一个实在的物理量。`, `A hole in the K shell is filled from the L shell with emission of the Kα line, or from the M shell with Kβ (about a seventh as intense); for heavy elements the K shell lies too deep and L lines are used. Moseley's law: the square root of the frequency of a characteristic line is linear in atomic number, √ν ∝ (Z − σ). The Kα energy is roughly 10.2 eV × (Z − 1)²: 6.40 keV for iron (Z = 26), 8.05 keV for copper (Z = 29). In 1913 this law first showed atomic number to be a real physical quantity.`),
        T(`空位也可以不发光而发射一个俄歇电子来填。发射 X 射线的概率（荧光产额）随原子序数上升：碳只有约 0.3 %，铁约 34 %，钼约 76 %。所以轻元素的 X 射线信号弱、能量低，容易被空气和窗口吸收，XRF 和 EDS 对它们都不灵敏。`, `The hole can also be filled without radiation, by emission of an Auger electron. The probability of X-ray emission (the fluorescence yield) rises with atomic number: only about 0.3 % for carbon, about 34 % for iron and 76 % for molybdenum. X-rays from light elements are therefore weak and soft, easily absorbed by air and windows, and neither XRF nor EDS is sensitive to them.`),
        T(`两种分光方式。能量色散（ED）：硅漂移探测器把每个光子的能量直接量出来，所有元素同时测，分辨率约 125–130 eV，手持式仪器和电镜能谱都是这种。波长色散（WD）：用分光晶体按 Bragg 定律把不同波长分开，分辨率 5–20 eV，峰重叠少、检出限低，但一次测一个元素。`, `There are two ways to disperse the radiation. Energy-dispersive (ED): a silicon drift detector measures the energy of each photon directly and all elements at once, with a resolution of about 125–130 eV; handheld instruments and EDS on electron microscopes work this way. Wavelength-dispersive (WD): an analysing crystal separates wavelengths by Bragg's law with a resolution of 5–20 eV, fewer overlaps and lower detection limits, but one element at a time.`),
      ],
      axes: T(`横轴是 X 射线能量（keV），纵轴是计数。每种元素一组峰（Kα、Kβ 或 Lα、Lβ）。`, `X-ray energy (keV) against counts, with a group of peaks (Kα, Kβ or Lα, Lβ) for each element.`),
      tells: [
        T(`合金牌号、矿石和水泥的成分、土壤和玩具里的铅、镉、汞、砷（RoHS 筛查）、文物和颜料的元素组成（不取样）。`, `Alloy grades, the composition of ores and cement, lead, cadmium, mercury and arsenic in soil and toys (RoHS screening), elements in artefacts and pigments (without sampling).`),
        T(`电镜下某个颗粒、某条晶界、某一层是什么成分；元素分布图（EDS 面扫）。`, `What a given particle, grain boundary or layer under the electron microscope is made of; element maps (EDS mapping).`),
      ],
      sample: T(`XRF：固体、粉末压片、熔融玻璃片或液体，基本不用前处理。EDS：电镜样品，要导电或镀膜。`, `XRF: solids, pressed powders, fused glass beads or liquids, with little or no preparation. EDS: electron microscopy specimens, conductive or coated.`),
      nums: [
        [T(`XRF 的检出限`, `XRF detection limits`), T(`约 1–100 ppm（中等和重元素）`, `About 1–100 ppm (medium and heavy elements)`)],
        [T(`EDS 的检出限`, `EDS detection limit`), T(`约 0.1 %（质量分数）`, `About 0.1 % by mass`)],
        [T(`块体样品 EDS 的空间分辨率`, `Spatial resolution of EDS on bulk samples`), T(`约 1 μm（电子在样品里散开的范围）`, `About 1 μm (the spread of the electrons inside the sample)`)],
        [T(`常见重叠`, `Common overlaps`), T(`S Kα 2.307、Mo Lα 2.293、Pb Mα 2.346 keV；Ti Kβ 4.932 和 V Kα 4.952 keV`, `S Kα 2.307, Mo Lα 2.293, Pb Mα 2.346 keV; Ti Kβ 4.932 and V Kα 4.952 keV`)],
      ],
      read: [
        T(`认元素要看一整组线：有 Kα 就应该有约七分之一高的 Kβ；有 Lα 就应该有 Lβ 和 Lγ。只对上一条线的归属不可靠。`, `Identify an element by its whole family of lines: with Kα there must be a Kβ about a seventh as tall; with Lα there must be Lβ and Lγ. An assignment resting on a single line is unreliable.`),
        T(`先把假峰排除：逃逸峰（主峰能量减 1.74 keV）、和峰（两个光子同时到达，能量相加）、X 光管靶材的散射线、空气里氩的 Kα（2.96 keV）。`, `Rule out artefacts first: escape peaks (1.74 keV below a main peak), sum peaks (two photons arriving together, energies added), scattered lines of the tube anode, and the Kα of argon in air (2.96 keV).`),
      ],
      traps: [
        T(`峰高不直接等于含量：基体里别的元素会吸收或增强分析线（基体效应），定量要用成分相近的标样或基本参数法校正。`, `Peak height is not content directly: other elements in the matrix absorb or enhance the analyte line (matrix effects), and quantification needs standards of similar composition or fundamental-parameter correction.`),
        T(`EDS 的谱上几乎总有碳和氧（污染、导电胶、空气里生成的氧化层），轻元素的定量很不可靠；信号来自约 1 μm³ 的体积，比电子束本身大得多，测纳米颗粒时周围的基底也在里面。`, `EDS spectra almost always show carbon and oxygen (contamination, conductive tape, native oxide), and light-element quantification is unreliable; the signal comes from a volume of about 1 μm³, far larger than the beam itself, so a nanoparticle is measured together with its surroundings.`),
      ],
      figs: [
        { gen: 'xrf', args: { pick: ['Ca', 'Ti', 'Cr', 'Mn', 'Fe', 'Ni', 'Cu', 'Zn', 'As', 'Br', 'Sr', 'Zr', 'Mo', 'Ag', 'Sn', 'W', 'Au', 'Hg', 'Pb'], on: ['Fe', 'Cr', 'Ni'] }, cap: T(`由文献的特征线能量画出：勾选元素看它们的 Kα、Kβ（或 Lα、Lβ）线落在哪里，峰宽按能量色散探测器的分辨率（5.9 keV 处 130 eV）展宽。默认的铁、铬、镍是不锈钢的三种主要元素。相对峰高只按 Kα : Kβ 的比例画，没有考虑含量、激发效率和吸收。`, `Drawn from literature line energies: tick elements to see where their Kα and Kβ (or Lα and Lβ) lines fall, broadened to the resolution of an energy-dispersive detector (130 eV at 5.9 keV). The default iron, chromium and nickel are the three main elements of stainless steel. Relative heights reflect only the Kα : Kβ ratio, not content, excitation efficiency or absorption.`) },
        { gen: 'moseley', cap: T(`由文献的 Kα₁ 能量画出：√E 对原子序数 Z 是一条直线（Moseley 定律）。直线是 E = 10.2 eV × (Z − 1)²。`, `Drawn from literature Kα₁ energies: √E against atomic number Z is a straight line (Moseley's law). The line is E = 10.2 eV × (Z − 1)².`) },
      ],
      table: 'xray-lines',
      refs: ['moseley1913'],
    },
    {
      id: 'xas', fam: 'xray', abbr: 'XANES · EXAFS', name: T(`X 射线吸收谱`, `X-ray absorption spectroscopy`),
      one: T(`扫描 X 射线的能量，经过某个元素内层电子的结合能时吸收突然跳升（吸收边）。边的位置和形状反映这个元素的价态和配位几何（XANES），边后面几百电子伏范围里的小振荡记录了它周围原子的种类、个数和距离（EXAFS）。它不要求样品结晶，溶液、非晶、表面上的单原子都能测。`, `Scan the X-ray energy through the binding energy of a core electron of some element and the absorption jumps (an absorption edge). The position and shape of the edge reflect the oxidation state and coordination geometry of that element (XANES), and small oscillations over the few hundred electronvolts beyond it record the kind, number and distance of its neighbours (EXAFS). No crystallinity is needed: solutions, glasses and single atoms on a surface all work.`),
      how: [
        T(`XANES（吸收边附近约 −20 到 +50 eV）：内层电子被激发到空的价轨道和低能连续态。价态每升高一价，边的位置大约向高能移动 1–3 eV（核对内层电子的吸引变强了）。K 边前面常有一个小的边前峰，是 1s → 3d 跃迁：它在中心对称的八面体配位里是禁阻的，很弱；在四面体配位里因为 3d 和 4p 混合而变强。所以边前峰的强度是配位对称性的指示。`, `XANES (about −20 to +50 eV around the edge): the core electron is promoted into empty valence orbitals and low-energy continuum states. Each unit increase in oxidation state shifts the edge by roughly 1–3 eV to higher energy (the nucleus holds the core electrons more tightly). A small pre-edge peak often precedes a K edge, the 1s → 3d transition: forbidden and weak in centrosymmetric octahedral coordination, it gains intensity in tetrahedral coordination through 3d–4p mixing. Pre-edge intensity thus indicates coordination symmetry.`),
        T(`EXAFS（边后约 50–1000 eV）：被打出来的光电子是一个从吸收原子向外传播的球面波，遇到邻近原子被散射回来，和出射波干涉。光子能量变化时光电子的波长跟着变，干涉在相长和相消之间交替，吸收系数就出现振荡。每一层近邻贡献一个正弦项：χ(k) = Σ N_j·S₀²·f_j(k) / (k·R_j²) · exp(−2k²σ_j²) · exp(−2R_j/λ) · sin(2kR_j + φ_j)，其中 k = 0.5123·√(E − E₀)（k 用 Å⁻¹，能量用 eV）。振荡的频率给出距离 R，振幅给出配位数 N，随 k 衰减的快慢给出无序度 σ²。`, `EXAFS (about 50–1000 eV beyond the edge): the ejected photoelectron is a spherical wave travelling outward from the absorbing atom; neighbouring atoms scatter it back, and it interferes with the outgoing wave. As the photon energy changes, so does the photoelectron wavelength, the interference alternates between constructive and destructive, and the absorption coefficient oscillates. Each shell of neighbours contributes a sine term: χ(k) = Σ N_j·S₀²·f_j(k) / (k·R_j²) · exp(−2k²σ_j²) · exp(−2R_j/λ) · sin(2kR_j + φ_j), with k = 0.5123·√(E − E₀) (k in Å⁻¹, energy in eV). The frequency of the oscillation gives the distance R, its amplitude the coordination number N, and its decay with k the disorder σ².`),
        T(`把 χ(k) 做傅里叶变换，得到一张类似径向分布的图，每一层近邻一个峰。因为有相移 φ，峰的位置比真实距离短约 0.3–0.5 Å，真实的距离要通过用理论散射振幅和相移（FEFF 程序）拟合得到。`, `The Fourier transform of χ(k) resembles a radial distribution with one peak per shell of neighbours. Because of the phase shift φ, peaks appear about 0.3–0.5 Å short of the true distances, which come from fitting with theoretical scattering amplitudes and phase shifts (the FEFF code).`),
      ],
      axes: T(`原始谱：横轴是光子能量（eV），纵轴是归一化的吸收系数。EXAFS：k（Å⁻¹）对 k²χ(k)，以及它的傅里叶变换 R（Å）对 |χ(R)|。`, `Raw spectrum: photon energy (eV) against normalised absorption. EXAFS: k (Å⁻¹) against k²χ(k), and its Fourier transform, R (Å) against |χ(R)|.`),
      tells: [
        T(`某个元素的平均价态（和标样比边位置，或做线性组合拟合）和配位对称性。`, `The average oxidation state of an element (edge position against standards, or linear combination fitting) and its coordination symmetry.`),
        T(`它周围是什么原子、有几个、多远（距离准到约 0.02 Å）。单原子催化剂的常用论据就是：有金属–氮（氧）的峰，没有金属–金属的峰。`, `Which atoms surround it, how many and how far away (distances to about 0.02 Å). The usual argument for a single-atom catalyst is exactly this: a metal–nitrogen (or oxygen) peak and no metal–metal peak.`),
        T(`催化剂、电池电极在工作状态下的变化（原位、工况实验）；环境和生物样品里痕量金属的化学形态。`, `Changes in catalysts and battery electrodes under working conditions (in situ and operando experiments); the chemical form of trace metals in environmental and biological samples.`),
      ],
      sample: T(`需要同步辐射光源。浓的样品压成薄片测透射（吸收边的跳高约为 1 最合适），稀的或负载型的样品测荧光。`, `A synchrotron source is required. Concentrated samples are pressed into thin pellets for transmission (an edge jump of about 1 is ideal); dilute or supported ones are measured in fluorescence.`),
      nums: [
        [T(`3d 金属的 K 边`, `K edges of the 3d metals`), T(`Ti 4966，Mn 6539，Fe 7112，Co 7709，Ni 8333，Cu 8979，Zn 9659 eV`, `Ti 4966, Mn 6539, Fe 7112, Co 7709, Ni 8333, Cu 8979, Zn 9659 eV`)],
        [T(`Pt 和 Au 的 L₃ 边`, `L₃ edges of Pt and Au`), T(`11564 和 11919 eV`, `11564 and 11919 eV`)],
        [T(`EXAFS 的精度`, `Precision of EXAFS`), T(`距离 ±0.02 Å，配位数 ±20 %`, `Distances ±0.02 Å, coordination numbers ±20 %`)],
      ],
      read: [
        T(`先看 XANES：和已知价态的标样叠在一起比边的位置、边前峰和白线（边后第一个强峰）的高度。`, `Start with XANES: overlay standards of known oxidation state and compare edge position, pre-edge peak and the height of the white line (the first strong peak beyond the edge).`),
        T(`看傅里叶变换图时记住横轴没有做相移校正：1.5 Å 附近的峰对应的是约 2.0 Å 的金属–氧或金属–氮键，2.2 Å 附近的峰对应约 2.5 Å 的金属–金属键。`, `Remember that the abscissa of the Fourier transform is not phase-corrected: a peak near 1.5 Å corresponds to a metal–oxygen or metal–nitrogen bond of about 2.0 Å, and one near 2.2 Å to a metal–metal bond of about 2.5 Å.`),
      ],
      traps: [
        T(`EXAFS 分不清原子序数相近的近邻（N 和 O、S 和 Cl），配位数的不确定度有 20 % 左右，而且和无序度强相关。“配位数 4.1”不能证明是四配位而不是五配位。`, `EXAFS cannot tell neighbours of similar atomic number apart (N from O, S from Cl), coordination numbers are uncertain by about 20 % and correlate strongly with disorder. A "coordination number of 4.1" does not prove four-coordination against five.`),
        T(`它给的是样品里所有该元素原子的平均。一半是单原子、一半是小团簇的混合物，谱上的金属–金属峰可以弱到被忽略。“没有金属–金属峰”不足以单独证明全是单原子，还要电镜等证据。`, `It averages over every atom of the element in the sample. In a mixture of half single atoms and half small clusters the metal–metal peak can be weak enough to overlook. "No metal–metal peak" alone does not prove that all atoms are isolated; microscopy and other evidence are needed.`),
      ],
      figs: [
        { gen: 'exafs', cap: T(`模型计算：单散射 EXAFS 方程给出的 k²χ(k) 和它的傅里叶变换（散射振幅和相移取简单的解析形式，不针对具体元素）。拖动距离、配位数和无序度：距离越长振荡越密，无序度越大高 k 处衰减越快。加上第二层近邻（金属–金属）可以看到两个峰。傅里叶变换的峰位比设定的距离短，这是相移造成的。`, `Model calculation: k²χ(k) from the single-scattering EXAFS equation and its Fourier transform (scattering amplitude and phase shift in simple analytic forms, for no particular element). Vary distance, coordination number and disorder: a longer distance gives denser oscillations, greater disorder a faster decay at high k. Add a second shell (metal–metal) to see two peaks. The peaks of the transform fall short of the set distances because of the phase shift.`) },
        { sketch: { x: [7100, 7180], xl: T(`光子能量（eV）`, `photon energy (eV)`), yl: T(`归一化吸收（示意）`, `normalised absorption (schematic)`), edge: true, sets: [
          { label: T(`Fe²⁺`, `Fe²⁺`), e0: 7120, white: 1.25, pre: [7112.5, 0.05] },
          { label: T(`Fe³⁺`, `Fe³⁺`), alt: true, e0: 7124, white: 1.4, pre: [7114.3, 0.08] }] },
          cap: T(`示意：铁 K 边 XANES。Fe³⁺ 的吸收边比 Fe²⁺ 高约 3–4 eV，边前峰（1s → 3d）也高约 1.5–2 eV。曲线形状是示意的，只表示移动的方向和大致幅度。`, `Schematic: iron K-edge XANES. The edge of Fe³⁺ lies about 3–4 eV above that of Fe²⁺, and the pre-edge peak (1s → 3d) about 1.5–2 eV higher. The curve shapes are illustrative and show only the direction and rough size of the shifts.`) },
      ],
      refs: ['sayers1971', 'rehr2000', 'ravel2005'],
    },
    {
      id: 'saxs', fam: 'xray', abbr: 'SAXS · SANS', name: T(`小角 X 射线散射`, `Small-angle X-ray scattering`),
      one: T(`衍射角越小，对应的尺度越大。在离直射光束只有零点几度的地方收集散射，看到的是 1–100 nm 的结构：纳米颗粒的大小和形状、溶液里蛋白质的外形、嵌段共聚物和介孔材料的有序排列。样品不需要结晶。`, `The smaller the scattering angle, the larger the length scale. Scattering collected within a fraction of a degree of the direct beam reveals structure of 1–100 nm: the size and shape of nanoparticles, the envelope of proteins in solution, the ordered arrays of block copolymers and mesoporous materials. No crystals are needed.`),
      how: [
        T(`散射矢量 q = 4π·sinθ / λ（2θ 是散射角），它对应的实空间尺度是 d = 2π / q。散射强度是颗粒里电子密度和周围介质之差（衬度）的傅里叶变换的平方。对彼此不相干的稀颗粒，I(q) 正比于单个颗粒的形状因子 P(q)。半径为 R 的均匀球：P(q) = [3(sin qR − qR·cos qR) / (qR)³]²，第一个极小值在 qR = 4.493。`, `The scattering vector is q = 4π·sinθ / λ (2θ the scattering angle), corresponding to a real-space scale d = 2π / q. The intensity is the square of the Fourier transform of the electron-density difference (contrast) between particle and medium. For dilute, non-interacting particles I(q) is proportional to the form factor P(q) of one particle. For a uniform sphere of radius R, P(q) = [3(sin qR − qR·cos qR) / (qR)³]², with its first minimum at qR = 4.493.`),
        T(`不用假设形状就能得到的两个量。Guinier 近似：在很小的 q（q·R_g < 1.3）处，I(q) = I(0)·exp(−q²R_g²/3)，ln I 对 q² 是直线，斜率给出回转半径 R_g（球的 R_g = √(3/5)·R）；I(0) 正比于分子量。Porod 定律：在大 q 处，有清晰界面的颗粒 I ∝ q⁻⁴，系数正比于总界面面积。把 I(q) 做傅里叶变换得到距离分布函数 P(r)，它降到零的地方是颗粒的最大尺寸 D_max。`, `Two quantities need no assumed shape. The Guinier approximation: at very small q (q·R_g < 1.3), I(q) = I(0)·exp(−q²R_g²/3), so ln I against q² is a straight line whose slope gives the radius of gyration R_g (for a sphere R_g = √(3/5)·R), and I(0) is proportional to molar mass. Porod's law: at large q, particles with sharp interfaces follow I ∝ q⁻⁴, with a coefficient proportional to the total interfacial area. The Fourier transform of I(q) is the pair distance distribution P(r), which falls to zero at the maximum dimension D_max of the particle.`),
        T(`有序排列的纳米结构给出 Bragg 峰，峰位之比指认相结构：层状相 1:2:3:4，六方柱状相 1:√3:2:√7，体心立方 1:√2:√3:2。小角中子散射（SANS）原理相同，但中子对氢和氘的散射能力差别极大，调节溶剂里 H₂O 和 D₂O 的比例可以让复合物里的某一个组分“隐身”，单独看另一个。`, `Ordered nanostructures give Bragg peaks whose position ratios identify the phase: lamellar 1:2:3:4, hexagonal cylinders 1:√3:2:√7, body-centred cubic 1:√2:√3:2. Small-angle neutron scattering (SANS) works the same way, but neutrons scatter very differently from hydrogen and deuterium, and adjusting the H₂O / D₂O ratio of the solvent makes one component of a complex invisible so that the other is seen alone.`),
      ],
      axes: T(`横轴是 q（Å⁻¹ 或 nm⁻¹），纵轴是散射强度 I(q)，两个轴通常都取对数。`, `q (Å⁻¹ or nm⁻¹) against scattered intensity I(q), usually both on logarithmic axes.`),
      tells: [
        T(`纳米颗粒、胶束、囊泡的平均尺寸、形状和尺寸分布（是对整个样品的统计平均，电镜只看到几百个）。`, `Mean size, shape and size distribution of nanoparticles, micelles and vesicles (a statistical average over the whole sample, where microscopy sees a few hundred).`),
        T(`蛋白质在溶液里的外形、是否聚集、是折叠的还是无序的（Kratky 图：q²I 对 q，折叠的是钟形峰，展开的一直上升）。`, `The solution shape of a protein, whether it is aggregated, folded or disordered (the Kratky plot of q²I against q: a bell-shaped peak when folded, a continuing rise when unfolded).`),
        T(`嵌段共聚物、液晶、介孔二氧化硅的相结构和周期；聚合物的片晶长周期。`, `Phase structure and period of block copolymers, liquid crystals and mesoporous silica; the long period of polymer lamellae.`),
      ],
      sample: T(`溶液装在 1–2 mm 的毛细管里（蛋白质 1–10 mg/mL，几十微升），粉末和薄膜直接测。一定要测一份完全相同的溶剂做本底扣除。`, `Solutions in capillaries of 1–2 mm (proteins at 1–10 mg/mL, tens of microlitres); powders and films directly. An identical solvent blank must be measured for subtraction.`),
      nums: [
        [T(`q 和尺度`, `q and length scale`), T(`d = 2π / q：q = 0.01 Å⁻¹ 对应 63 nm，q = 0.5 Å⁻¹ 对应 1.3 nm`, `d = 2π / q: q = 0.01 Å⁻¹ is 63 nm, q = 0.5 Å⁻¹ is 1.3 nm`)],
        [T(`Guinier 区`, `Guinier region`), T(`q·R_g < 1.3（球形颗粒）`, `q·R_g < 1.3 (globular particles)`)],
        [T(`球形状因子的第一个极小`, `First minimum of the sphere form factor`), T(`qR = 4.493`, `qR = 4.493`)],
      ],
      read: [
        T(`先看最小 q 处：Guinier 图是直线说明样品单分散、没有聚集；向上翘说明有聚集体，向下弯说明颗粒之间有排斥。`, `Look first at the lowest q: a straight Guinier plot means a monodisperse, non-aggregated sample; an upturn means aggregates, a downturn repulsion between particles.`),
        T(`形状因子的振荡越清楚，尺寸分布越窄；多分散的样品把极小值抹平。`, `The clearer the oscillations of the form factor, the narrower the size distribution; polydispersity smears out the minima.`),
      ],
      traps: [
        T(`一条一维的散射曲线可以被许多不同的三维形状拟合。从 SAXS 重建出来的“低分辨率外形”不是唯一解，要和其他信息（晶体结构、电镜）一起用。`, `A one-dimensional scattering curve can be fitted by many different three-dimensional shapes. A low-resolution envelope reconstructed from SAXS is not unique and must be used together with other information (crystal structures, microscopy).`),
        T(`少量大的聚集体就能主导小 q 处的信号（散射强度正比于体积的平方），使算出的 R_g 偏大很多。`, `A few large aggregates dominate the signal at low q (intensity scales with the square of the volume) and inflate R_g badly.`),
      ],
      figs: [
        { gen: 'saxs', cap: T(`由公式算出：均匀球的形状因子（对数坐标）。拖动半径和多分散度：半径越大，曲线整体向小 q 移动；多分散度越大，极小值越浅。虚线是 Guinier 近似，只在最左边一小段和精确曲线重合。`, `From the formula: the form factor of a uniform sphere (logarithmic axes). Vary radius and polydispersity: a larger radius moves the whole curve to lower q; greater polydispersity fills in the minima. The dashed line is the Guinier approximation, which matches the exact curve only at the far left.`) },
      ],
      refs: ['svergun2003'],
    },
    {
      id: 'upsaes', fam: 'xray', abbr: 'UPS · AES', name: T(`紫外光电子能谱与俄歇电子能谱`, `Ultraviolet photoelectron and Auger electron spectroscopy`),
      one: T(`两种和 XPS 同在一台仪器上的表面电子能谱。紫外光电子能谱用几十电子伏的光子打出价电子，直接测出价带、功函数和分子轨道的电离能；俄歇电子能谱测内层空位弛豫时放出的电子，用聚焦电子束激发可以做几十纳米分辨的表面元素成像。`, `Two surface electron spectroscopies that share an instrument with XPS. Ultraviolet photoelectron spectroscopy ejects valence electrons with photons of a few tens of electronvolts and measures the valence band, the work function and molecular orbital ionisation energies directly; Auger electron spectroscopy measures the electrons emitted when a core hole relaxes and, excited by a focused electron beam, maps surface elements at tens of nanometres.`),
      how: [
        T(`UPS 的光源是氦放电灯：He I 线 21.22 eV，He II 线 40.81 eV。光子能量低、线宽窄（几毫电子伏），所以价带的精细结构看得比 XPS 清楚得多。固体的谱有两个关键位置：低结合能一端的费米边（金属）或价带顶（半导体），和高结合能一端的二次电子截止边。功函数 Φ = hν − W，W 是从费米边到截止边的谱宽。对有机半导体，价带顶到真空能级的距离就是电离能（HOMO 的位置）。`, `The UPS source is a helium discharge lamp: He I at 21.22 eV and He II at 40.81 eV. The low photon energy and narrow linewidth (a few millielectronvolts) show valence-band fine structure far better than XPS. A solid-state spectrum has two key positions: the Fermi edge (metals) or valence-band maximum (semiconductors) at the low-binding-energy end, and the secondary-electron cutoff at the other. The work function is Φ = hν − W, with W the spectral width from Fermi edge to cutoff. For an organic semiconductor the distance from the valence-band maximum to the vacuum level is the ionisation energy (the HOMO position).`),
        T(`气相分子的 UPS 上，每一条谱带对应把电子从一个分子轨道里打出来（Koopmans 定理：电离能约等于轨道能量的负值），谱带上的振动精细结构还能看出这个轨道是成键、非键还是反键的。N₂ 的三条带在 15.58、16.93 和 18.75 eV。`, `In the UPS of gas-phase molecules each band corresponds to ejecting an electron from one molecular orbital (Koopmans' theorem: the ionisation energy is about the negative of the orbital energy), and its vibrational fine structure shows whether the orbital is bonding, non-bonding or antibonding. N₂ has three bands, at 15.58, 16.93 and 18.75 eV.`),
        T(`俄歇过程涉及三个电子：内层（如 K）出现空位，一个外层（L₁）电子跳下来，放出的能量交给另一个外层（L₂,₃）电子，把它打出去。俄歇电子的动能约为 E_K − E_L₁ − E_L₂,₃，只和元素有关，和用什么激发无关。轻元素的俄歇产额高（和 X 射线荧光正好互补）。俄歇峰的位置和形状也随化学态变化；把俄歇动能和光电子结合能相加得到“俄歇参数”，它不受荷电影响，是区分 Cu⁰、Cu⁺、Cu²⁺ 的可靠判据。`, `The Auger process involves three electrons: a core hole (say K) is filled by an outer electron (L₁), and the energy released ejects another outer electron (L₂,₃). The kinetic energy of the Auger electron, about E_K − E_L₁ − E_L₂,₃, depends only on the element, not on the means of excitation. Auger yields are high for light elements (complementing X-ray fluorescence). Auger peak positions and shapes vary with chemical state as well; adding the Auger kinetic energy to the photoelectron binding energy gives the Auger parameter, which is immune to charging and reliably separates Cu⁰, Cu⁺ and Cu²⁺.`),
      ],
      axes: T(`UPS：结合能（相对费米能级，eV）对强度。AES：电子动能（eV）对强度，电子束激发时常画成一阶导数 dN/dE。`, `UPS: binding energy (relative to the Fermi level, eV) against intensity. AES: electron kinetic energy (eV) against intensity, commonly as the first derivative dN/dE with electron-beam excitation.`),
      tells: [
        T(`功函数、价带顶、有机半导体的 HOMO 能级、界面的能级排列（做器件能带图的依据）。`, `Work function, valence-band maximum, HOMO level of organic semiconductors, energy-level alignment at interfaces (the basis of device band diagrams).`),
        T(`表面 1–3 nm 的元素组成和它的横向分布（扫描俄歇）、随深度的变化（俄歇深度剖析）。`, `Elemental composition of the top 1–3 nm, its lateral distribution (scanning Auger) and its variation with depth (Auger depth profiling).`),
      ],
      sample: T(`导电的固体，超高真空。UPS 的取样深度只有约 1 nm，表面必须在真空里原位清洁或制备。测功函数时要给样品加几伏负偏压，把截止边和谱仪自己的截止边分开。`, `Conductive solids in ultra-high vacuum. UPS samples only about 1 nm, so the surface must be cleaned or prepared in situ. For work-function measurements a negative bias of a few volts separates the sample cutoff from that of the spectrometer.`),
      nums: [
        [T(`He I / He II`, `He I / He II`), T(`21.22 eV / 40.81 eV`, `21.22 eV / 40.81 eV`)],
        [T(`功函数`, `Work functions`), T(`Au 约 5.1–5.3，Ag 约 4.3–4.7，ITO 约 4.4–4.8 eV（强烈依赖表面状态）`, `Au about 5.1–5.3, Ag about 4.3–4.7, ITO about 4.4–4.8 eV (strongly dependent on surface condition)`)],
        [T(`扫描俄歇的空间分辨率`, `Spatial resolution of scanning Auger`), T(`约 10 nm`, `About 10 nm`)],
      ],
      read: [
        T(`UPS：先在高结合能端找到截止边（取陡降沿的切线和基线的交点），再在低结合能端找到费米边或价带起始点，两者之差是 W。`, `UPS: locate the cutoff at the high-binding-energy end (the intersection of the tangent to the steep edge with the baseline), then the Fermi edge or valence-band onset at the low end; their separation is W.`),
      ],
      traps: [
        T(`功函数对表面污染极其敏感：金的表面在空气里放过，功函数可以从 5.3 eV 掉到 4.7 eV 以下。不同文献的数值差零点几个电子伏很常见。`, `Work functions are extremely sensitive to contamination: a gold surface exposed to air can drop from 5.3 eV to below 4.7 eV. Literature values commonly disagree by tenths of an electronvolt.`),
        T(`电子束激发的俄歇会损伤有机物和许多氧化物，也会让绝缘样品严重荷电。`, `Electron-excited Auger damages organics and many oxides and charges insulators severely.`),
      ],
      figs: [
        { sketch: { x: [-1, 18], rev: true, xl: T(`结合能（eV，相对费米能级）`, `binding energy (eV, relative to the Fermi level)`), yl: T(`强度（示意）`, `intensity (schematic)`), ups: { cutoff: 16.1, fermi: 0 }, peaks: [[2.7, 0.35, 0.9], [4.3, 0.5, 1.2], [6.2, 0.45, 1.3]] },
          cap: T(`示意：金的 He I 紫外光电子能谱。右端 0 eV 处是费米边，2–8 eV 是 5d 能带，左端 16.1 eV 处是二次电子截止边。谱宽 W = 16.1 eV，功函数 Φ = 21.22 − 16.1 = 5.1 eV。形状是示意的。`, `Schematic: the He I photoelectron spectrum of gold. The Fermi edge lies at 0 eV on the right, the 5d bands at 2–8 eV, and the secondary-electron cutoff at 16.1 eV on the left. The width W = 16.1 eV gives the work function Φ = 21.22 − 16.1 = 5.1 eV. The shape is illustrative.`) },
      ],
      refs: ['siegbahn1982', 'seah1979'],
    },
    {
      id: 'ednd', fam: 'xray', abbr: 'ED · MicroED · ND · PDF', name: T(`电子衍射、中子衍射与对分布函数`, `Electron diffraction, neutron diffraction and the pair distribution function`),
      one: T(`衍射不只用 X 射线。电子和物质的作用强上万倍，几百纳米的晶粒就能解出结构；中子被原子核散射，看得见氢、分得清相邻的元素、还能测出磁矩的排列；把布拉格峰之间的漫散射也算进来做傅里叶变换（对分布函数），连纳米颗粒和玻璃里的原子间距也能读出来。`, `Diffraction is not limited to X-rays. Electrons interact with matter ten thousand times more strongly, so crystals of a few hundred nanometres suffice for a structure; neutrons are scattered by nuclei, which makes hydrogen visible, separates neighbouring elements and reveals magnetic order; and Fourier-transforming the diffuse scattering between the Bragg peaks as well (the pair distribution function) reads interatomic distances even in nanoparticles and glasses.`),
      how: [
        T(`电子衍射：透射电镜里 200 kV 的电子波长只有 0.0251 Å，衍射角很小，一张图就记下倒易空间的一个截面。微晶电子衍射（MicroED，也叫三维电子衍射）让一颗几百纳米的晶粒在电子束里连续转动，像单晶 X 射线衍射那样收集数据、用同样的软件解结构。长不出大单晶的药物、天然产物、沸石、MOF 因此可以直接从粉末里解结构。代价是电子在晶体里会被多次散射（动力学效应），强度不那么“干净”，R₁ 通常在 15–25 %。`, `Electron diffraction: at 200 kV in a transmission electron microscope the wavelength is only 0.0251 Å, the angles are small and one pattern records a whole section of reciprocal space. Microcrystal electron diffraction (MicroED, or three-dimensional electron diffraction) rotates a crystal a few hundred nanometres across continuously in the beam, collecting data as in single-crystal X-ray diffraction and solving the structure with the same software. Drugs, natural products, zeolites and MOFs that will not grow large crystals are solved directly from powder. The price is multiple scattering within the crystal (dynamical effects), which makes intensities less clean; R₁ is typically 15–25 %.`),
        T(`中子衍射：中子的散射长度由原子核决定，随原子序数没有规律地变化。氘（6.67 fm）和碳（6.65 fm）、氧（5.80 fm）差不多，所以氢（氘）的位置能准确定出来；氢本身的散射长度是负的（−3.74 fm）。锰和铁、氮和氧这类 X 射线分不清的邻居，中子可以分得很清楚。中子有磁矩，会被未成对电子散射，磁结构（反铁磁的自旋怎么排）只能靠它测。缺点是要反应堆或散裂源，样品要大（克量级的粉末、立方毫米的单晶）。`, `Neutron diffraction: neutron scattering lengths are set by the nucleus and vary irregularly with atomic number. Deuterium (6.67 fm) is comparable to carbon (6.65 fm) and oxygen (5.80 fm), so hydrogen (as deuterium) positions are located accurately; hydrogen itself has a negative scattering length (−3.74 fm). Neighbours that X-rays cannot tell apart, such as manganese and iron or nitrogen and oxygen, are clearly distinguished. Neutrons carry a magnetic moment and scatter from unpaired electrons, so magnetic structures (how antiferromagnetic spins are arranged) can be measured only this way. The drawbacks are the need for a reactor or spallation source and large samples (grams of powder, cubic millimetres of crystal).`),
        T(`对分布函数（PDF）：普通的粉末衍射分析只用布拉格峰，那是长程有序的部分。把整条散射曲线（包括峰之间和峰下面的漫散射）归一化成结构函数 S(Q)，做傅里叶变换，得到 G(r)：在 r 处有峰，就说明有一对原子相距 r。它不要求周期性，所以纳米颗粒、无定形药物、玻璃、液体都能测。要求数据测到很高的 Q（25 Å⁻¹ 以上），所以用高能同步辐射或银靶、钼靶。`, `The pair distribution function (PDF): conventional powder analysis uses only the Bragg peaks, the long-range-ordered part. Normalising the whole scattering curve (including the diffuse scattering between and beneath the peaks) to the structure function S(Q) and Fourier-transforming it gives G(r): a peak at r means that pairs of atoms lie r apart. No periodicity is required, so nanoparticles, amorphous drugs, glasses and liquids can all be measured. The data must reach very high Q (beyond 25 Å⁻¹), hence high-energy synchrotron radiation or silver and molybdenum tubes.`),
      ],
      axes: T(`电子衍射和中子衍射的图与 X 射线衍射相同。PDF：横轴是原子间距 r（Å），纵轴是 G(r)。`, `Electron and neutron diffraction patterns look like X-ray ones. PDF: interatomic distance r (Å) against G(r).`),
      tells: [
        T(`只有亚微米晶粒的化合物的晶体结构（MicroED）；单个纳米颗粒的晶相和取向（选区电子衍射）。`, `Crystal structures of compounds available only as submicrometre crystals (MicroED); the phase and orientation of a single nanoparticle (selected-area electron diffraction).`),
        T(`氢原子和质子的准确位置（氢键、储氢材料、酶的质子化状态）；磁结构；电池材料里锂的位置。`, `Accurate positions of hydrogen atoms and protons (hydrogen bonds, hydrogen-storage materials, protonation states in enzymes); magnetic structures; lithium sites in battery materials.`),
        T(`无定形和纳米晶材料的局域结构：最近邻距离、配位数、有序能延伸多远。`, `Local structure of amorphous and nanocrystalline materials: nearest-neighbour distances, coordination numbers, how far order extends.`),
      ],
      sample: T(`MicroED：粉末直接撒在电镜载网上，冷冻条件下用极低的电子剂量。中子：克量级粉末装在钒罐里（钒几乎不产生相干散射），含氢样品最好氘代以减少非相干本底。PDF：粉末装在毛细管里。`, `MicroED: powder dusted onto a microscope grid and measured cold at very low electron dose. Neutrons: grams of powder in a vanadium can (vanadium gives almost no coherent scattering), with hydrogenous samples preferably deuterated to reduce the incoherent background. PDF: powder in a capillary.`),
      nums: [
        [T(`电子波长`, `Electron wavelengths`), T(`100 kV 0.0370 Å，200 kV 0.0251 Å，300 kV 0.0197 Å`, `0.0370 Å at 100 kV, 0.0251 Å at 200 kV, 0.0197 Å at 300 kV`)],
        [T(`热中子`, `Thermal neutrons`), T(`约 25 meV，波长约 1.8 Å`, `About 25 meV, wavelength about 1.8 Å`)],
        [T(`中子散射长度`, `Neutron scattering lengths`), T(`H −3.74，D 6.67，C 6.65，N 9.36，O 5.80 fm`, `H −3.74, D 6.67, C 6.65, N 9.36, O 5.80 fm`)],
        [T(`石英玻璃的头三个原子间距`, `First three distances in silica glass`), T(`Si–O 1.61，O–O 2.63，Si–Si 3.08 Å`, `Si–O 1.61, O–O 2.63, Si–Si 3.08 Å`)],
      ],
      read: [
        T(`PDF 从左往右读：第一个峰是最短的化学键，后面依次是次近邻。峰的位置是距离，面积正比于配位数，宽度反映无序。峰在多远处消失，就是结构相干的范围（纳米颗粒的尺寸）。`, `Read a PDF from left to right: the first peak is the shortest chemical bond, followed by next-nearest neighbours. Position is distance, area is proportional to coordination number, width reflects disorder. The distance at which peaks die out is the range of structural coherence (the size of a nanoparticle).`),
      ],
      traps: [
        T(`MicroED 的 R 因子高不代表结构错，但键长的精度和绝对构型的判断都不如 X 射线，轻重原子的散射差别也比 X 射线小。有机晶体很怕电子束，剂量稍大结构就坏了。`, `The high R factors of MicroED do not mean the structure is wrong, but bond-length precision and absolute-configuration assignment are poorer than with X-rays, and light and heavy atoms differ less in scattering. Organic crystals are beam-sensitive and are destroyed by a slightly higher dose.`),
        T(`PDF 上小 r 处（小于约 1 Å）的波纹是傅里叶变换截断造成的假峰，不是真的原子间距。`, `Ripples at small r in a PDF (below about 1 Å) are termination artefacts of the Fourier transform, not real distances.`),
      ],
      figs: [
        { sketch: { x: [0.8, 6], xl: T(`原子间距 r（Å）`, `interatomic distance r (Å)`), yl: T(`G(r)（示意）`, `G(r) (schematic)`), zero: true, peaks: [[1.61, 1, 0.13, T(`Si–O`, `Si–O`)], [2.63, 0.55, 0.2, T(`O–O`, `O–O`)], [3.08, 0.5, 0.22, T(`Si–Si`, `Si–Si`)], [4.1, 0.2, 0.5], [5.0, 0.15, 0.6]] },
          cap: T(`示意：石英玻璃的对分布函数。头三个峰的位置取文献值（Si–O 1.61 Å，O–O 2.63 Å，Si–Si 3.08 Å）；5 Å 以后峰很快变宽消失，说明没有长程有序。峰高、峰宽和 4 Å 以后的部分是示意的。`, `Schematic: the pair distribution function of silica glass. The first three peaks sit at literature values (Si–O 1.61 Å, O–O 2.63 Å, Si–Si 3.08 Å); beyond 5 Å the peaks broaden and vanish quickly, showing the absence of long-range order. Heights, widths and the region beyond 4 Å are illustrative.`) },
      ],
      refs: ['shi2013', 'rietveld1969', 'billinge2004', 'jones2018'],
    },
    {
      id: 'eels', fam: 'xray', abbr: 'EELS', name: T(`电子能量损失谱`, `Electron energy-loss spectroscopy`),
      one: T(`透射电镜里的高能电子穿过薄样品时，一部分把能量交给样品里的电子。测这些电子损失了多少能量，就知道那个位置有什么元素、是什么价态和成键方式。它和 X 射线吸收谱给出同一类信息，但空间分辨可以到单个原子柱。`, `Some of the fast electrons passing through a thin specimen in a transmission electron microscope give energy to electrons of the sample. Measuring how much they lost tells which elements are at that spot and in which oxidation and bonding state. The information is of the same kind as X-ray absorption, but with spatial resolution down to a single atomic column.`),
      how: [
        T(`谱分三段。零损失峰：没有损失能量的电子，最强，它的宽度就是能量分辨率（0.3–1 eV，加单色器后可到几毫电子伏）。低能损失区（到约 50 eV）：激发价电子的集体振荡（等离激元，铝在 15 eV，硅在 16.7 eV）和带间跃迁，可以读出带隙和介电函数。内层损失区（50 eV 以上）：把内层电子激发到空态，出现和 X 射线吸收边一一对应的电离边：碳 K 边 284 eV，氮 K 边 401 eV，氧 K 边 532 eV，钛 L₂,₃ 边 456 eV，铁 L₂,₃ 边 708 eV。`, `The spectrum has three parts. The zero-loss peak: electrons that lost no energy, the strongest feature, whose width is the energy resolution (0.3–1 eV, down to a few millielectronvolts with a monochromator). The low-loss region (to about 50 eV): collective oscillations of valence electrons (plasmons, at 15 eV in aluminium and 16.7 eV in silicon) and interband transitions, from which band gaps and dielectric functions are read. The core-loss region (above 50 eV): core electrons promoted to empty states give ionisation edges matching X-ray absorption edges one for one: carbon K at 284 eV, nitrogen K at 401 eV, oxygen K at 532 eV, titanium L₂,₃ at 456 eV, iron L₂,₃ at 708 eV.`),
        T(`电离边上的精细结构反映空态的分布，也就是成键。碳 K 边上 285 eV 的尖峰是 1s → π* 跃迁，只有 sp² 碳才有；292 eV 起的宽峰是 1s → σ*。两者的强度比给出 sp² 和 sp³ 的比例：石墨有很强的 π* 峰，金刚石没有。3d 过渡金属 L 边的两条“白线”（L₃ 和 L₂）的强度比和位置随价态变化，可以逐个原子柱地画出锰、铁、铈的价态分布。`, `Fine structure on an edge reflects the distribution of empty states, that is, bonding. On the carbon K edge the sharp peak at 285 eV is the 1s → π* transition, present only for sp² carbon; the broad feature from 292 eV is 1s → σ*. Their intensity ratio gives the sp² to sp³ ratio: graphite has a strong π* peak, diamond none. The intensity ratio and position of the two white lines (L₃ and L₂) on the L edges of 3d transition metals vary with oxidation state, allowing the valence of manganese, iron or cerium to be mapped column by column.`),
      ],
      axes: T(`横轴是能量损失（eV），纵轴是电子计数。强度随能量损失增大而急剧下降，所以常用对数纵轴或分段放大。`, `Energy loss (eV) against electron counts. Intensity falls steeply with energy loss, so a logarithmic axis or stepwise magnification is common.`),
      tells: [
        T(`纳米尺度甚至原子尺度上的元素分布，尤其是 EDS 不擅长的轻元素（锂、硼、碳、氮、氧）。`, `Element distribution on the nanometre or even atomic scale, especially of the light elements EDS handles poorly (lithium, boron, carbon, nitrogen, oxygen).`),
        T(`界面和缺陷处的价态与成键：氧化物界面上钛是三价还是四价，碳材料是 sp² 还是 sp³。`, `Valence and bonding at interfaces and defects: Ti³⁺ or Ti⁴⁺ at an oxide interface, sp² or sp³ carbon in a carbon material.`),
        T(`样品局部的厚度（t/λ = ln(I_总 / I_零损失)）、带隙、等离激元模式。`, `Local specimen thickness (t/λ = ln(I_total / I_zero-loss)), band gaps and plasmon modes.`),
      ],
      sample: T(`必须很薄：厚度最好小于电子的非弹性平均自由程的一半左右（约 50 nm 以下），否则多次散射把谱形弄糊。`, `It must be very thin: preferably below about half the inelastic mean free path of the electrons (under about 50 nm), or multiple scattering blurs the spectral shapes.`),
      nums: [
        [T(`常用电离边`, `Common ionisation edges`), T(`Li K 55，B K 188，C K 284，N K 401，O K 532，Fe L₃ 708 eV`, `Li K 55, B K 188, C K 284, N K 401, O K 532, Fe L₃ 708 eV`)],
        [T(`碳 K 边`, `Carbon K edge`), T(`π* 约 285 eV，σ* 约 292 eV`, `π* about 285 eV, σ* about 292 eV`)],
        [T(`能量分辨率`, `Energy resolution`), T(`冷场发射约 0.3 eV，单色器 5–10 meV`, `About 0.3 eV with cold field emission, 5–10 meV with a monochromator`)],
      ],
      read: [
        T(`电离边是台阶形的：从某个能量突然升起，然后缓慢衰减，骑在前面所有过程留下的幂函数背景上。定量要先在边前拟合背景（A·E⁻ʳ）并外推扣除。`, `An ionisation edge is step-like: a sudden rise at some energy followed by a slow decay, riding on the power-law background left by everything before it. Quantification first fits the background before the edge (A·E⁻ʳ) and extrapolates it for subtraction.`),
      ],
      traps: [
        T(`电子束会改变样品：打掉氧、还原金属离子、让有机物石墨化。看到的“三价钛”可能是电子束造成的。要做剂量系列确认谱不随照射时间变化。`, `The beam alters the sample: it removes oxygen, reduces metal ions and graphitises organics. An observed "Ti³⁺" may be beam-induced. A dose series must confirm that the spectrum does not change with exposure.`),
        T(`样品太厚时，内层电离边后面会叠上“电离加等离激元”的假峰，精细结构不可信。`, `In thick specimens core edges acquire spurious features from ionisation plus plasmon losses, and the fine structure cannot be trusted.`),
      ],
      figs: [
        { gen: 'eels', cap: T(`示意：薄碳膜的电子能量损失谱（对数纵轴）。0 eV 是零损失峰，约 25 eV 处是体等离激元，284 eV 起是碳的 K 边：285 eV 的 π* 尖峰和 292 eV 的 σ* 宽峰。背景按幂函数下降。数值是文献里的典型位置，强度是示意的。`, `Schematic: the electron energy-loss spectrum of a thin carbon film (logarithmic axis). The zero-loss peak at 0 eV, the bulk plasmon near 25 eV, and the carbon K edge from 284 eV with its sharp π* peak at 285 eV and broad σ* feature at 292 eV. The background falls as a power law. Positions are typical literature values; intensities are illustrative.`) },
      ],
      refs: ['egerton2009'],
    },
  );
})();
