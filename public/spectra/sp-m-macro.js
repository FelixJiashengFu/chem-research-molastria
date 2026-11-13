'use strict';
// 谱图馆 · 大分子与高分子：冷冻电镜、电子显微镜与能谱、蛋白质核磁、二维核磁、糖的核磁、³¹P 核磁、桑格测序、纤维衍射、凝胶电泳、
// 氢氘交换质谱、高分子的立构与支化、静态光散射、黏度法、分析超速离心、热迁移。对照的是 CHMD11（大分子与其他结构解析方法）讲义的范围。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'cryoem', fam: 'macro', core: true, abbr: 'cryo-EM · SPA', name: T(`冷冻电镜单颗粒分析`, `Single-particle cryo-electron microscopy`),
      one: T(`把蛋白质溶液在液态乙烷里速冻成一层玻璃态的冰，用透射电镜拍下几十万个随机朝向的分子的投影像，再在计算机里把它们分类、对齐、重建成三维的静电势图。不需要晶体，大复合物也能做到近原子分辨率。`, `A protein solution is plunged into liquid ethane and frozen into a thin film of vitreous ice; a transmission electron microscope records projection images of hundreds of thousands of molecules in random orientations, and the computer classifies, aligns and reconstructs them into a three-dimensional map of electrostatic potential. No crystal is needed, and large complexes reach near-atomic resolution.`),
      how: [
        T(`电子被样品里原子的静电势散射（X 射线被电子云散射），所以冷冻电镜的图是静电势图，带电的侧链和氢原子在图里的样子和 X 射线的电子密度图不完全一样。生物样品主要由轻原子组成，几乎不吸收电子，只改变电子波的相位（弱相位物体）。相位差在完美聚焦的像里看不出来，所以要故意欠焦 0.5–3 μm：物镜的欠焦和球差一起把相位变成振幅，效果由衬度传递函数 CTF(k) = −sin(πλΔf k² − ½πC_sλ³k⁴ + φ) 描述，k 是空间频率，λ 在 300 kV 时是 1.97 pm。`, `Electrons are scattered by the electrostatic potential of the atoms (X-rays by the electron cloud), so a cryo-EM map is a potential map, and charged side chains and hydrogens look somewhat different from an X-ray electron-density map. Biological samples are made of light atoms that hardly absorb electrons and only shift the phase of the electron wave (weak phase objects). A phase shift is invisible in a perfectly focused image, so the image is deliberately underfocused by 0.5–3 μm: defocus and spherical aberration of the objective together convert phase into amplitude, as described by the contrast transfer function CTF(k) = −sin(πλΔf k² − ½πC_sλ³k⁴ + φ), with k the spatial frequency and λ = 1.97 pm at 300 kV.`),
        T(`CTF 在某些频率上为零、在相邻两段之间变号，所以单张图在这些频率上完全没有信息，信息也被调制成一圈圈 Thon 环（图像功率谱里看得到）。处理时先估计每张图的欠焦量（CTFFIND 一类程序），把变号翻回来；换几个欠焦量拍，让零点落在不同位置，合起来就补齐了。电子剂量只能给每平方埃几十个电子，否则分子被打坏，所以单个颗粒的信噪比极低，要靠成千上万个颗粒平均。`, `The CTF is zero at certain frequencies and changes sign between them, so a single image carries no information at those frequencies and the rest is modulated into Thon rings (visible in the power spectrum). Processing first estimates each image's defocus (programs such as CTFFIND) and flips the signs back; images taken at several defoci place the zeros at different frequencies, and together they fill the gaps. The dose must stay at a few tens of electrons per square ångström or the molecules are destroyed, so each particle has a very low signal-to-noise ratio and only averaging over tens of thousands of particles gives a usable map.`),
        T(`流程：挑颗粒，二维分类（把朝向相同的颗粒平均成清楚的类平均像，丢掉坏颗粒），定每个颗粒的朝向，按中心切片定理（一个投影的傅里叶变换就是三维傅里叶变换过原点的一个平面）在傅里叶空间里把它们拼起来，三维分类分出不同的构象。分辨率用 Fourier 壳层相关（FSC）判断：数据随机分成两半各自重建，比较两个图在每个频率上的相关性，掉到 0.143 处的频率就是报告的分辨率。`, `The workflow: pick particles; classify them in 2D (average particles in the same orientation into clear class averages and discard bad ones); determine each particle's orientation; assemble them in Fourier space by the central-slice theorem (the Fourier transform of a projection is the plane through the origin of the 3D transform); and classify in 3D to separate conformations. Resolution is judged by the Fourier shell correlation (FSC): the data are split at random into two halves reconstructed independently, their correlation is computed shell by shell in frequency, and the frequency where it falls to 0.143 is the reported resolution.`),
      ],
      axes: T(`显微照片是二维的灰度像（像素对应样品上零点几到一埃）。功率谱：空间频率（Å⁻¹）对强度，看 Thon 环。FSC 曲线：空间频率（Å⁻¹，常同时标成分辨率 Å）对相关系数，从 1 往下掉。`, `Micrographs are 2D greyscale images (a pixel is a fraction of an ångström to one ångström on the sample). Power spectrum: spatial frequency (Å⁻¹) against intensity, showing Thon rings. FSC curve: spatial frequency (Å⁻¹, often labelled as resolution in Å) against correlation, falling from 1.`),
      tells: [
        T(`大蛋白、复合物、病毒、膜蛋白（在去垢剂或纳米盘里）的三维结构，不需要结晶。`, `The 3D structures of large proteins, complexes, viruses and membrane proteins (in detergent or nanodiscs), without crystallisation.`),
        T(`同一个样品里的几种构象：三维分类可以把不同的状态分开，这是晶体学做不到的。`, `Several conformations in one sample: 3D classification separates states, which crystallography cannot.`),
        T(`分辨率在 2–4 Å 时可以搭原子模型；局部分辨率常常不均匀，柔性的边缘比核心差。`, `At 2–4 Å an atomic model can be built; local resolution is often uneven, with flexible edges worse than the core.`),
      ],
      sample: T(`纯化的蛋白，约 0.1–5 mg/mL，3 μL 滴在带孔碳膜的铜或金载网上，吸掉多余液体后投入液态乙烷速冻（玻璃化，冰不能结晶）；冰要薄（几十纳米），颗粒要分散、朝向要多样。分子量太小（低于约 50 kDa）时颗粒衬度不够，难以对齐。`, `Purified protein at about 0.1–5 mg/mL; 3 μL on a holey-carbon copper or gold grid, blotted and plunged into liquid ethane (vitrification: the ice must not crystallise). The ice must be thin (tens of nanometres), the particles well dispersed and in varied orientations. Below about 50 kDa particles have too little contrast to be aligned.`),
      nums: [
        [T(`300 kV 电子的波长`, `Wavelength of 300 kV electrons`), T(`1.97 pm（相对论修正后；不修正是 2.24 pm）`, `1.97 pm (relativistic; 2.24 pm without the correction)`)],
        [T(`每张图的剂量`, `Dose per image`), T(`约 40–60 e⁻/Å²，分成几十帧记录，再校正漂移`, `About 40–60 e⁻/Å², recorded as tens of frames and motion-corrected`)],
        [T(`FSC 判据`, `FSC criterion`), T(`两个半图之间 0.143（Rosenthal 和 Henderson 2003）`, `0.143 between half-maps (Rosenthal and Henderson 2003)`)],
        [T(`颗粒数`, `Number of particles`), T(`常见十万到上百万个，最后用于重建的往往只有一部分`, `Typically 10⁵ to more than 10⁶, of which often only a fraction enters the final reconstruction`)],
      ],
      read: [
        T(`先看功率谱：Thon 环清楚、延伸到高频、是圆而不是椭圆（椭圆说明有像散），这张图才值得用。`, `Check the power spectrum first: Thon rings that are clear, reach high frequency and are circular rather than elliptical (ellipses mean astigmatism) mark an image worth using.`),
        T(`二维类平均像里应该看得到二级结构（螺旋的条纹）；全是模糊的圆斑说明颗粒太小、冰太厚或样品聚集。`, `2D class averages should show secondary structure (the stripes of helices); fuzzy blobs mean particles that are too small, ice that is too thick, or aggregation.`),
        T(`读 FSC 时看曲线是否平滑地掉到 0.143 以下，并看局部分辨率图；报告的整体分辨率不代表每个区域都一样好。`, `On the FSC curve check that it falls smoothly below 0.143, and look at the local-resolution map: the overall number does not mean every region is equally good.`),
      ],
      traps: [
        T(`取向偏好：颗粒在冰里都躺成同一个方向，傅里叶空间有一块缺失，图沿某个方向被拉长；分辨率数字看起来不错，图却是歪的。`, `Preferred orientation: if particles all lie the same way in the ice, part of Fourier space is missing and the map is stretched along one direction; the resolution number may look fine while the map is distorted.`),
        T(`过拟合：两半数据没有真正独立地处理（比如共用了一个高分辨率的初始模型），FSC 会虚高。`, `Overfitting: if the two halves are not processed truly independently (for example from a shared high-resolution starting model), the FSC is inflated.`),
        T(`空气–水界面会让部分蛋白变性；看到的“新构象”有时只是界面损伤。`, `The air–water interface denatures some proteins; an apparent "new conformation" is sometimes interface damage.`),
      ],
      figs: [
        { gen: 'ctf', cap: T(`由物理公式算出：300 kV、球差 2.7 mm、振幅衬度 7 % 时的衬度传递函数。拖动欠焦量，零点向低频移动、振荡变密；加大 B 因子，高频的信息被包络压掉。右侧给出前几个零点对应的分辨率。`, `Computed from the physics: the contrast transfer function at 300 kV with spherical aberration 2.7 mm and 7 % amplitude contrast. Increase the defocus and the zeros move to lower frequency and the oscillations crowd together; raise the B factor and the envelope suppresses high-frequency information. The readout lists the resolution of the first zeros.`) },
      ],
      see: [['#m-em', T(`电子显微镜与能谱`, `Electron microscopy and EDS`)], ['#m-scxrd', T(`单晶衍射与蛋白质晶体学`, `Single-crystal diffraction and protein crystallography`)], ['#m-saxs', T(`小角 X 射线散射：溶液里的整体形状`, `Small-angle X-ray scattering: overall shape in solution`)], ['#m-ednd', T(`电子衍射（MicroED）`, `Electron diffraction (MicroED)`)]],
      refs: ['kuhlbrandt2014', 'rosenthal2003', 'rohou2015'],
    },
    {
      id: 'em', fam: 'macro', abbr: 'SEM · TEM · STEM · EDS', name: T(`电子显微镜与能量色散 X 射线谱`, `Electron microscopy and energy-dispersive X-ray spectroscopy`),
      one: T(`电子的波长比可见光短十万倍，所以电子显微镜能看到纳米乃至原子尺度。扫描电镜（SEM）看表面形貌，透射电镜（TEM、STEM）看内部结构和晶格；电子打出的特征 X 射线（EDS）告诉你每一点是什么元素。`, `Electrons have wavelengths a hundred thousand times shorter than visible light, so electron microscopes resolve the nanometre and even the atomic scale. Scanning electron microscopy (SEM) shows surface topography, transmission microscopy (TEM, STEM) shows internal structure and lattices, and the characteristic X-rays excited by the beam (EDS) tell which element is where.`),
      how: [
        T(`德布罗意波长 λ = h / p。加速电压 V 下 λ = h / √(2m₀eV(1 + eV/2m₀c²))：10 kV 时 12.2 pm，100 kV 时 3.70 pm，300 kV 时 1.97 pm（这时电子速度已是光速的 78 %，相对论修正让波长比不修正时短 12 %）。实际分辨率不受波长限制，而受透镜的像差限制；像差校正器出现之后，TEM 和 STEM 能分辨小于 0.1 nm 的原子柱。`, `The de Broglie wavelength is λ = h / p. At accelerating voltage V, λ = h / √(2m₀eV(1 + eV/2m₀c²)): 12.2 pm at 10 kV, 3.70 pm at 100 kV and 1.97 pm at 300 kV (the electrons then move at 78 % of the speed of light, and the relativistic correction makes the wavelength 12 % shorter than without it). Practical resolution is limited not by wavelength but by lens aberrations; with aberration correctors TEM and STEM resolve atomic columns closer than 0.1 nm.`),
        T(`SEM 用聚焦的电子束（1–30 kV）在样品表面扫描，收集每一点出来的信号：二次电子（能量低于 50 eV，只来自表面几纳米，看形貌）、背散射电子（随原子序数变亮，看成分衬度）。TEM 让 80–300 kV 的电子穿过 100 nm 以下的薄样品成像或衍射；STEM 用会聚的细束扫描薄样品，高角环形暗场（HAADF）像的亮度约正比于 Z^1.7，重原子一眼可辨。`, `SEM scans a focused beam (1–30 kV) over the surface and collects signals from each point: secondary electrons (below 50 eV, from the top few nanometres; topography) and backscattered electrons (brighter for heavier atoms; compositional contrast). TEM sends 80–300 kV electrons through samples thinner than about 100 nm to form images or diffraction patterns; STEM scans a converged probe over a thin sample, and the high-angle annular dark-field (HAADF) image brightness scales roughly as Z^1.7, so heavy atoms stand out at a glance.`),
        T(`电子把内层电子打掉，外层电子填回时放出特征 X 射线（Kα、Kβ、Lα…），能量由 Moseley 定律决定，元素各不相同。硅漂移探测器按能量把每个光子记下来，就是 EDS 谱：特征峰叠在韧致辐射的连续背景上。探测器分辨率在 Mn Kα（5.9 keV）处约 125–130 eV，由电子学噪声和电荷产生的统计涨落（Fano 因子）决定，所以能量越高峰越宽。`, `The beam ejects inner-shell electrons, and as outer electrons fill the holes, characteristic X-rays (Kα, Kβ, Lα, …) are emitted at energies fixed by Moseley's law for each element. A silicon drift detector records the energy of each photon, giving the EDS spectrum: characteristic peaks on a bremsstrahlung continuum. Detector resolution is about 125–130 eV at Mn Kα (5.9 keV), set by electronic noise and the statistics of charge generation (the Fano factor), so peaks widen with energy.`),
      ],
      axes: T(`图像：两个方向的长度（nm 或 μm）。EDS：X 射线能量（keV）对计数。`, `Images: length in two directions (nm or μm). EDS: X-ray energy (keV) against counts.`),
      tells: [
        T(`颗粒的大小、形状、团聚，表面的形貌和断口，薄膜的厚度和层次。`, `Particle size, shape and aggregation; surface topography and fracture surfaces; film thickness and layering.`),
        T(`TEM：晶格条纹、缺陷、界面；选区电子衍射给出晶体结构。`, `TEM: lattice fringes, defects and interfaces; selected-area electron diffraction gives crystal structure.`),
        T(`EDS：微米到纳米区域里有哪些元素、大约多少，元素分布图。`, `EDS: which elements are present in a micrometre- to nanometre-sized region and roughly how much; element maps.`),
      ],
      sample: T(`SEM：干燥的固体，导电或镀一层几纳米的金、碳；也有低真空和环境 SEM。TEM：样品要薄到电子能穿过（离子减薄、聚焦离子束切片、超薄切片），粉末分散在带碳膜的铜网上。`, `SEM: dry solids, conductive or coated with a few nanometres of gold or carbon; low-vacuum and environmental SEM also exist. TEM: samples thin enough for electrons to pass (ion milling, focused-ion-beam lamellae, ultramicrotomy), or powders dispersed on carbon-coated copper grids.`),
      nums: [
        [T(`电子波长`, `Electron wavelength`), T(`10 kV 12.2 pm · 100 kV 3.70 pm · 200 kV 2.51 pm · 300 kV 1.97 pm`, `10 kV 12.2 pm · 100 kV 3.70 pm · 200 kV 2.51 pm · 300 kV 1.97 pm`)],
        [T(`EDS 探测器分辨率`, `EDS detector resolution`), T(`约 125–130 eV（Mn Kα）；波长色散谱仪（WDS）约 5–10 eV`, `About 125–130 eV (Mn Kα); wavelength-dispersive spectrometers (WDS) about 5–10 eV`)],
        [T(`EDS 检出限`, `EDS detection limit`), T(`约 0.1 wt%；轻元素（B、C、N、O）更差、定量也难`, `About 0.1 wt%; light elements (B, C, N, O) are worse and hard to quantify`)],
        [T(`SEM 中 EDS 的分析体积`, `Analysis volume of EDS in an SEM`), T(`约 1 μm³（电子在样品里散开，20 kV 时深约 1–2 μm）`, `About 1 μm³ (electrons spread in the sample; 1–2 μm deep at 20 kV)`)],
      ],
      read: [
        T(`看图像先看比例尺和成像信号（二次电子还是背散射电子），亮暗的含义完全不同。`, `For an image, check the scale bar and the signal (secondary or backscattered electrons) first: brightness means different things.`),
        T(`EDS 认峰从高能的 K 线开始，每个元素找齐 Kα、Kβ（重元素再找 L 线），再看低能区剩下的峰。`, `In EDS, identify peaks from the high-energy K lines down, finding Kα and Kβ (and L lines for heavy elements) for each element, then deal with what remains at low energy.`),
        T(`定量要用标样或无标样的 ZAF / φ(ρz) 修正，并报告误差；不平的表面和粉末的结果只能当半定量。`, `Quantification needs standards or standardless ZAF / φ(ρz) corrections, reported with uncertainties; results on rough surfaces and powders are semi-quantitative at best.`),
      ],
      traps: [
        T(`峰重叠：S Kα（2.31 keV）、Mo Lα（2.29）和 Pb Mα（2.35）在 EDS 里几乎分不开；Ti Kβ 和 V Kα、Mn Kβ 和 Fe Kα 也挨得很近。`, `Overlaps: S Kα (2.31 keV), Mo Lα (2.29) and Pb Mα (2.35) are nearly inseparable in EDS; Ti Kβ and V Kα, Mn Kβ and Fe Kα are also very close.`),
        T(`假峰：和峰（两个光子同时到达，2 × 主峰能量）、逃逸峰（主峰减 1.74 keV 的 Si Kα）、镀膜和样品台的元素。`, `Artefact peaks: sum peaks (two photons at once, twice the main energy), escape peaks (main peak minus the 1.74 keV of Si Kα), and elements from the coating and the stub.`),
        T(`电子束损伤和荷电：有机物、生物样品、电池材料会在束下变化；看到的结构可能是被束改出来的。`, `Beam damage and charging: organics, biological samples and battery materials change under the beam; what you see may have been made by the beam.`),
      ],
      figs: [
        { gen: 'eds', cap: T(`由特征 X 射线能量算出：20 kV 电子激发的 EDS 谱，韧致辐射背景用 Kramers 公式，峰宽按硅探测器的噪声加 Fano 统计（Mn Kα 处 129 eV）。选不同的样品，看哪些峰挤在一起分不开，再把分辨率调到 WDS 的水平对比。各峰的相对高度是示意的，不是定量结果。`, `Computed from characteristic X-ray energies: an EDS spectrum excited by 20 kV electrons, with a Kramers bremsstrahlung background and peak widths from detector noise plus Fano statistics (129 eV at Mn Kα). Switch samples to see which peaks merge, then set the resolution to WDS levels for comparison. Relative peak heights are schematic, not a quantitative result.`) },
        { gen: 'ewave', cap: T(`由常数算出：电子的德布罗意波长随加速电压的变化，实线含相对论修正，虚线不含。300 kV 时修正后的波长短 12 %。`, `From the constants: the de Broglie wavelength of electrons against accelerating voltage, with (solid) and without (dashed) the relativistic correction. At 300 kV the corrected wavelength is 12 % shorter.`) },
      ],
      see: [['#m-cryoem', T(`冷冻电镜单颗粒分析`, `Single-particle cryo-EM`)], ['#m-xrf', T(`X 射线荧光`, `X-ray fluorescence`)], ['#m-eels', T(`电子能量损失谱`, `Electron energy-loss spectroscopy`)], ['#t-xray-lines', T(`速查表：特征 X 射线`, `Table: characteristic X-rays`)]],
      refs: ['newbury2013', 'moseley1913'],
    },
    {
      id: 'bionmr', fam: 'macro', abbr: 'HSQC · HNCA · HNCACB · TROSY', name: T(`蛋白质核磁：指纹、三共振归属与 NOE`, `Protein NMR: fingerprints, triple-resonance assignment and NOEs`),
      one: T(`把蛋白质用 ¹³C、¹⁵N 标记，用三共振实验沿主链一个残基一个残基地“行走”，给每个原子核找到归属；再用 NOE 测出氢之间的距离，算出溶液里的三维结构。它还看得到动态、无序和配体结合。`, `Proteins labelled with ¹³C and ¹⁵N are assigned atom by atom by "walking" along the backbone with triple-resonance experiments; NOEs then give distances between hydrogens from which the 3D structure in solution is computed. NMR also sees dynamics, disorder and ligand binding.`),
      how: [
        T(`¹H–¹⁵N HSQC 是蛋白质的指纹：除了脯氨酸，每个残基的主链 N–H 给一个峰（侧链的 Asn、Gln、Trp 也有）。折叠好的蛋白峰散得很开（¹H 6–10 ppm），去折叠或固有无序的蛋白峰挤在 7.8–8.5 ppm 之间。加入配体时哪些峰移动，结合位点就在哪里（化学位移扰动）。`, `The ¹H–¹⁵N HSQC is the protein's fingerprint: every residue except proline gives one peak from its backbone N–H (side-chain Asn, Gln and Trp give extra peaks). A folded protein spreads its peaks widely (¹H 6–10 ppm); unfolded or intrinsically disordered proteins crowd them into 7.8–8.5 ppm. Peaks that move on adding a ligand mark the binding site (chemical-shift perturbation).`),
        T(`三共振实验把磁化从 H^N 传到 ¹⁵N，再传到 Cα、Cβ 或 C′，最后传回 H^N 记录。名字就是路线：括号里的核只经过、不记位移。HNCACB（CBCANH）从第 i 个残基的 N–H 同时看到自己和前一个残基的 Cα、Cβ；CBCA(CO)NH 走羰基中转，只看得到前一个。把每条带的“前一个”去和别的条带的“自己”配对，就把残基连成一串；Gly（Cα 约 45、没有 Cβ）、Ala（Cβ 约 19）、Ser 和 Thr（Cβ 高于 Cα）是把片段对到序列上的路标。`, `Triple-resonance experiments move magnetisation from H^N to ¹⁵N, on to Cα, Cβ or C′, and back to H^N for detection. The name is the route; nuclei in parentheses are passed through without recording their shifts. HNCACB (CBCANH) sees, from the N–H of residue i, the Cα and Cβ of both that residue and the previous one; CBCA(CO)NH relays through the carbonyl and sees only the previous one. Matching each strip's "previous" to another strip's "own" links residues into a chain; Gly (Cα about 45, no Cβ), Ala (Cβ about 19), Ser and Thr (Cβ above Cα) are the landmarks that place a fragment on the sequence.`),
        T(`有了归属，¹⁵N 或 ¹³C 编辑的 NOESY 给出相距约 5 Å 以内的氢对，NOE 强度约正比于 r⁻⁶；几千条距离约束加上二面角（由 Cα、Cβ 的二级位移和 J 耦合来）算出一组结构。分子越大翻滚越慢，T₂ 越短、峰越宽，常规方法约到 30–50 kDa；氘代加 TROSY（让偶极和化学位移各向异性两种弛豫互相抵消）把上限推到几百 kDa 的局部。观测配体的方法（饱和转移差谱 STD、WaterLOGSY）则不需要标记蛋白。`, `Once assigned, ¹⁵N- or ¹³C-edited NOESY gives hydrogen pairs within about 5 Å, with NOE intensity roughly proportional to r⁻⁶; thousands of distance restraints plus dihedral angles (from Cα/Cβ secondary shifts and J couplings) yield an ensemble of structures. Larger molecules tumble more slowly, so T₂ shortens and peaks broaden; conventional methods reach about 30–50 kDa, and deuteration plus TROSY (where dipolar and chemical-shift-anisotropy relaxation cancel) extends local studies to several hundred kDa. Ligand-observed methods (saturation transfer difference, STD; WaterLOGSY) need no labelled protein.`),
      ],
      axes: T(`HSQC：¹H 位移（ppm，横轴）对 ¹⁵N 位移（ppm，纵轴），一个峰一个 N–H。三维谱常画成“条带”：每条带取一个 N–H 的 ¹H、¹⁵N 位置，纵轴是 ¹³C 位移（ppm）。`, `HSQC: ¹H shift (ppm, horizontal) against ¹⁵N shift (ppm, vertical), one peak per N–H. 3D spectra are usually shown as "strips": each strip is cut at one N–H's ¹H and ¹⁵N position, with the ¹³C shift (ppm) vertical.`),
      tells: [
        T(`蛋白质是否折叠、是否聚集，突变或配体是否改变了结构（HSQC 一张图就看得出）。`, `Whether a protein is folded or aggregated, and whether a mutation or ligand changes its structure (one HSQC tells).`),
        T(`每个残基的二级结构（二级化学位移：螺旋里 Cα 偏高、Cβ 偏低，β 折叠相反）、动态（¹⁵N 弛豫）和溶液结构。`, `Per-residue secondary structure (secondary shifts: in helices Cα up and Cβ down, in strands the reverse), dynamics (¹⁵N relaxation) and the solution structure.`),
        T(`弱结合（μM 到 mM）的配体筛选和结合位点；固有无序蛋白的构象系综。`, `Screening of weak binders (μM to mM) and their sites; conformational ensembles of intrinsically disordered proteins.`),
      ],
      sample: T(`重组表达的蛋白，在含 ¹⁵NH₄Cl、¹³C 葡萄糖的基本培养基里长出来（均匀标记）；约 0.1–1 mM，250–500 μL，90 % H₂O / 10 % D₂O，pH 最好低于 7（酰胺氢和水交换慢些），盐浓度不要高。`, `Recombinant protein grown in minimal medium with ¹⁵NH₄Cl and ¹³C glucose (uniform labelling); about 0.1–1 mM in 250–500 μL of 90 % H₂O / 10 % D₂O, preferably below pH 7 (slower amide exchange with water) and at modest salt.`),
      nums: [
        [T(`主链位移（典型）`, `Backbone shifts (typical)`), T(`H^N 7–10 · ¹⁵N 105–135 · C′ 约 175 · Cα 45–65 · Cβ 15–45（Ser、Thr 60–70）ppm`, `H^N 7–10 · ¹⁵N 105–135 · C′ about 175 · Cα 45–65 · Cβ 15–45 (Ser, Thr 60–70) ppm`)],
        [T(`标量耦合（磁化传递用）`, `Scalar couplings used for transfer`), T(`¹J(NH) ≈ 92 Hz · ¹J(NCα) ≈ 11 Hz · ²J(NCα) ≈ 7 Hz · ¹J(NC′) ≈ 15 Hz · ¹J(CαCβ) ≈ 35 Hz`, `¹J(NH) ≈ 92 Hz · ¹J(NCα) ≈ 11 Hz · ²J(NCα) ≈ 7 Hz · ¹J(NC′) ≈ 15 Hz · ¹J(CαCβ) ≈ 35 Hz`)],
        [T(`翻滚相关时间`, `Rotational correlation time`), T(`水里 25 °C 约 0.5–0.6 ns/kDa：20 kDa 的蛋白约 10 ns`, `In water at 25 °C about 0.5–0.6 ns per kDa: about 10 ns for a 20 kDa protein`)],
        [T(`NOE 能测的距离`, `Distances seen by NOE`), T(`约 5 Å 以内（强度 ∝ r⁻⁶）`, `Within about 5 Å (intensity ∝ r⁻⁶)`)],
      ],
      read: [
        T(`先数 HSQC 的峰：大约应该等于残基数减去脯氨酸数（再加侧链 NH₂ 的成对峰）。少很多说明有交换展宽或聚集。`, `Count HSQC peaks first: roughly the number of residues minus prolines (plus paired side-chain NH₂ peaks). Far fewer means exchange broadening or aggregation.`),
        T(`归属时每条带先分清“自己”和“前一个”（HNCACB 里强的是自己，并且 Cα 和 Cβ 符号相反；CBCA(CO)NH 里只有前一个），再找匹配。`, `In assignment, first separate "own" from "previous" in each strip (in HNCACB the own peaks are stronger and Cα and Cβ have opposite signs; CBCA(CO)NH shows only the previous), then match.`),
        T(`连续几个残基的 Cα 比无规卷曲值高约 2–3 ppm，那一段是 α 螺旋；低约 1–2 ppm、Cβ 偏高，是 β 折叠。`, `Several consecutive residues with Cα 2–3 ppm above random-coil values form an α-helix; Cα 1–2 ppm below with Cβ raised marks a β-strand.`),
      ],
      traps: [
        T(`脯氨酸没有酰胺氢，自己没有条带，行走在那里中断；但下一个残基的条带里还能看到它的 Cα、Cβ。`, `Proline has no amide hydrogen and no strip of its own, so the walk breaks there; its Cα and Cβ still appear in the next residue's strip.`),
        T(`峰重叠和化学位移简并：大蛋白、无序蛋白里几条带的 Cα、Cβ 相差不到 0.2 ppm，配对不唯一，要再用 HN(CO)CA、HNCO 等交叉核对。`, `Overlap and degeneracy: in large or disordered proteins several strips have Cα and Cβ within 0.2 ppm of each other, so matches are not unique and must be cross-checked with HN(CO)CA, HNCO and others.`),
        T(`¹⁵N 在谱宽之外的峰会折叠（aliasing）到谱里，位置和符号都可能不对。`, `Peaks whose ¹⁵N shift lies outside the spectral width fold (alias) back in, with possibly wrong position and sign.`),
      ],
      figs: [
        { gen: 'strips', cap: T(`由无规卷曲位移算出：输入一段序列，按 Wishart 等（1995）的无规卷曲 Cα、Cβ 位移（加上螺旋或折叠的平均偏差）画出每个残基 N–H 的 HNCACB 和 CBCA(CO)NH 条带。实心是 Cα，空心是 Cβ（真实的 HNCACB 里两者符号相反），大的是这个残基自己的、小的是前一个残基的。虚线把每一条的“前一个”连到上一条的“自己”，就是顺序行走。真实谱里的位移还受邻近残基和三级结构影响，这里只是示意。`, `From random-coil shifts: type a sequence and the HNCACB and CBCA(CO)NH strips of each residue's N–H are drawn from the random-coil Cα and Cβ shifts of Wishart et al. (1995), plus average helix or strand offsets. Filled marks are Cα and open marks Cβ (in a real HNCACB the two have opposite signs); large marks are the residue's own, small ones the previous residue's. Dashed lines connecting each strip's "previous" to the "own" of the strip before are the sequential walk. Real shifts also depend on neighbours and tertiary structure; this is illustrative.`) },
      ],
      see: [['nmr/#s-bio', T(`核磁共振栏目：生物大分子一部分`, `The NMR zone: biomolecular NMR`)], ['#m-nmr2d', T(`二维核磁：COSY、TOCSY、HSQC、HMBC`, `2D NMR: COSY, TOCSY, HSQC, HMBC`)], ['#m-hdx', T(`氢氘交换质谱`, `Hydrogen–deuterium exchange MS`)], ['#m-cd', T(`圆二色谱：整体的二级结构`, `Circular dichroism: overall secondary structure`)]],
      refs: ['kay1990', 'grzesiek1992', 'wishart1995', 'pervushin1997', 'mayer1999'],
    },
    {
      id: 'nmr2d', fam: 'macro', core: true, abbr: 'COSY · TOCSY · HSQC · HMBC · NOESY · ROESY', name: T(`二维核磁`, `Two-dimensional NMR`),
      one: T(`在两个频率轴上展开的核磁谱：对角线上是一维谱，对角线外的交叉峰说明两个核之间有联系，可以是通过化学键（COSY、TOCSY、HSQC、HMBC），也可以是通过空间（NOESY、ROESY）。有机结构、天然产物、糖和多肽的归属都靠它。`, `NMR spread over two frequency axes: the diagonal holds the 1D spectrum, and off-diagonal cross peaks show that two nuclei are connected, either through bonds (COSY, TOCSY, HSQC, HMBC) or through space (NOESY, ROESY). Structure determination of organic compounds, natural products, sugars and peptides relies on it.`),
      how: [
        T(`二维实验有四段：准备、演化 t₁、混合、检测 t₂。在 t₁ 里核以自己的频率进动，混合时磁化传给和它有关系的核，在 t₂ 里以对方的频率被记录。把 t₁ 一步步加长重复实验，再对两个时间各做一次傅里叶变换，就得到 F₁–F₂ 两维的谱。Jeener 在 1971 年提出这个想法，Ernst 小组在 1976 年把它做成了实验。`, `A 2D experiment has four periods: preparation, evolution t₁, mixing and detection t₂. During t₁ a nucleus precesses at its own frequency; mixing passes the magnetisation to nuclei related to it, which are detected at their own frequencies during t₂. Repeating with t₁ incremented step by step and Fourier-transforming both times gives the F₁–F₂ spectrum. Jeener proposed the idea in 1971 and Ernst's group made it an experiment in 1976.`),
        T(`同核：COSY 的交叉峰连通相隔两三根键、有 J 耦合的氢；TOCSY 用各向同性混合把磁化传遍整个自旋体系，一个氨基酸残基、一个糖环里的所有氢在同一列；NOESY 和 ROESY 的交叉峰来自空间上 5 Å 以内的氢（ROESY 在中等分子量时 NOE 接近零也能用）。异核：HSQC 连接每个碳和直接连着的氢（¹J ≈ 125–170 Hz），HMBC 连接相隔两三根键的碳和氢（ⁿJ ≈ 2–10 Hz），能跨过季碳、羰基和杂原子。`, `Homonuclear: COSY cross peaks link hydrogens two or three bonds apart that share a J coupling; TOCSY spreads magnetisation through the whole spin system by isotropic mixing, so all hydrogens of one amino-acid residue or one sugar ring line up in one column; NOESY and ROESY cross peaks come from hydrogens within 5 Å in space (ROESY still works at intermediate molecular weights where the NOE passes through zero). Heteronuclear: HSQC links each carbon to the hydrogens directly bonded to it (¹J ≈ 125–170 Hz), and HMBC links carbons and hydrogens two or three bonds apart (ⁿJ ≈ 2–10 Hz), bridging quaternary carbons, carbonyls and heteroatoms.`),
      ],
      axes: T(`两个轴都是化学位移（ppm）。同核谱两轴都是 ¹H，左右对称；HSQC、HMBC 横轴是 ¹H、纵轴是 ¹³C。常用等高线画法，正负峰用不同颜色。`, `Both axes are chemical shift (ppm). Homonuclear spectra have ¹H on both axes and are symmetric about the diagonal; HSQC and HMBC have ¹H horizontally and ¹³C vertically. Usually drawn as contours, with positive and negative peaks in different colours.`),
      tells: [
        T(`谁和谁相连（COSY、TOCSY 拼出自旋体系，HSQC 把氢放到碳上，HMBC 把片段接起来）。`, `What is connected to what (COSY and TOCSY build spin systems, HSQC puts hydrogens on carbons, HMBC joins the fragments).`),
        T(`立体化学和构象（NOESY / ROESY 的距离，J 耦合的二面角）。`, `Stereochemistry and conformation (distances from NOESY / ROESY, dihedral angles from J couplings).`),
      ],
      sample: T(`同一维核磁：几毫克溶在 0.5–0.6 mL 氘代溶剂里；HMBC 和 ¹³C 检测要更多样品或更长时间。NOESY 前最好脱气（溶解的氧会加快弛豫）。`, `As for 1D NMR: a few milligrams in 0.5–0.6 mL of deuterated solvent; HMBC and ¹³C detection need more sample or more time. Degas before NOESY (dissolved oxygen speeds relaxation).`),
      nums: [
        [T(`HSQC 优化的耦合`, `Coupling optimised in HSQC`), T(`¹J(CH) 约 145 Hz（sp³ 约 125，芳香约 160，醛约 170）`, `¹J(CH) about 145 Hz (sp³ about 125, aromatic about 160, aldehyde about 170)`)],
        [T(`HMBC 优化的耦合`, `Coupling optimised in HMBC`), T(`ⁿJ(CH) 约 8 Hz（²J 和 ³J，偶尔 ⁴J）`, `ⁿJ(CH) about 8 Hz (²J and ³J, occasionally ⁴J)`)],
        [T(`NOESY 混合时间`, `NOESY mixing time`), T(`小分子 0.3–0.8 s，蛋白质 50–150 ms`, `0.3–0.8 s for small molecules, 50–150 ms for proteins`)],
      ],
      read: [
        T(`先在 HSQC 里把每个氢放到它的碳上（CH₂ 的两个氢常常位移不同），这一步把一维谱里重叠的峰分开。`, `Start by placing each hydrogen on its carbon in the HSQC (the two hydrogens of a CH₂ often differ); this separates peaks that overlap in 1D.`),
        T(`用 COSY 一步步连邻居，用 TOCSY 确认整个自旋体系；在季碳、羰基、杂原子处中断时，用 HMBC 跨过去。`, `Walk neighbour to neighbour with COSY and confirm whole spin systems with TOCSY; where they stop at quaternary carbons, carbonyls or heteroatoms, bridge with HMBC.`),
        T(`最后用 NOESY 或 ROESY 定相对构型和构象，并和 J 耦合给出的二面角对照。`, `Finally fix relative configuration and conformation with NOESY or ROESY and compare with dihedral angles from J couplings.`),
      ],
      traps: [
        T(`HMBC 里看不到交叉峰不能说明不相连：³J 在二面角接近 90° 时接近零；看到的也可能是 ⁴J。`, `A missing HMBC cross peak does not prove no connection: ³J nearly vanishes near 90° dihedrals, and a peak that is present may be ⁴J.`),
        T(`分子量 1–2 kDa 左右的分子在常见场强下 NOE 接近零，NOESY 一片空白；换 ROESY。ROESY 里又有 TOCSY 转移造成的假峰。`, `Molecules around 1–2 kDa have near-zero NOEs at common fields and give an empty NOESY; use ROESY, which in turn carries artefact peaks from TOCSY transfer.`),
        T(`t₁ 噪声：强峰（溶剂、甲基）所在的列会拉出一条竖直的噪声带，别当成交叉峰。`, `t₁ noise: the column of a strong peak (solvent, methyl) shows a vertical streak; do not read it as cross peaks.`),
      ],
      figs: [
        { gen: 'nmr2d', cap: T(`示意：乙酸乙酯 CH₃C(=O)OCH₂CH₃ 在三种二维实验里的交叉峰。位移用这个分子在 CDCl₃ 里的典型值（¹H 4.12、2.05、1.26；¹³C 171.1、60.4、21.0、14.2 ppm）。切换实验：COSY 只连乙基的 CH₂ 和 CH₃；HSQC 把三组氢放到各自的碳上；HMBC 让乙酰基的甲基和 OCH₂ 都连到 171 ppm 的羰基，证明酯键两边接在一起，这是 COSY 做不到的（羰基两边的氢之间没有可见的耦合）。峰形和强度是示意的。`, `Schematic: the cross peaks of ethyl acetate CH₃C(=O)OCH₂CH₃ in three 2D experiments, with typical shifts in CDCl₃ (¹H 4.12, 2.05, 1.26; ¹³C 171.1, 60.4, 21.0, 14.2 ppm). Switch experiments: COSY links only the ethyl CH₂ and CH₃; HSQC puts the three hydrogen groups on their carbons; HMBC links both the acetyl methyl and the OCH₂ to the carbonyl at 171 ppm, proving the two halves meet at the ester, which COSY cannot show (there is no visible coupling between hydrogens on either side of the carbonyl). Peak shapes and intensities are illustrative.`) },
      ],
      see: [['#m-nmr', T(`核磁共振波谱（一维）`, `NMR spectroscopy (1D)`)], ['#m-carbnmr', T(`糖的核磁`, `NMR of carbohydrates`)], ['#m-bionmr', T(`蛋白质核磁`, `Protein NMR`)], ['nmr/#s-multid', T(`核磁共振栏目：多维谱`, `The NMR zone: multidimensional NMR`)]],
      refs: ['aue1976', 'braunschweiler1983', 'bax1986', 'bothnerby1984'],
    },
    {
      id: 'carbnmr', fam: 'macro', abbr: '¹H · ³J · TOCSY · ROESY', name: T(`糖的核磁：异头构型、连接位置与分支`, `NMR of carbohydrates: anomeric configuration, linkage and branching`),
      one: T(`寡糖和多糖的单体质量相同、只是立体构型不同，质谱分不开；核磁可以定出每个单糖是什么、α 还是 β、接在邻居的哪个位置、在哪里分支。关键是异头氢：它的位移和它与 H-2 之间的耦合常数。`, `The monomers of oligo- and polysaccharides have equal masses and differ only in stereochemistry, so mass spectrometry cannot tell them apart; NMR determines which monosaccharide each residue is, whether it is α or β, which position of its neighbour it is attached to and where the chain branches. The key is the anomeric hydrogen: its shift and its coupling to H-2.`),
      how: [
        T(`单糖成环后 C-1 成为新的手性中心（异头碳），有 α、β 两种构型。异头氢 H-1 连着两个氧，位移在 4.4–5.5 ppm，远离其他环上氢（3.2–4.2 ppm）挤成的一团，所以一维谱里每个糖残基都有一个可以单独看的峰：α 的一般在 5 ppm 以上，β 的在 5 ppm 以下。`, `On ring closure C-1 becomes a new stereocentre (the anomeric carbon) with α and β configurations. The anomeric H-1 is attached to a carbon bearing two oxygens and resonates at 4.4–5.5 ppm, away from the crowd of other ring hydrogens (3.2–4.2 ppm), so each sugar residue gives one resolved peak in the 1D spectrum: α anomers usually above 5 ppm, β below.`),
        T(`更可靠的是 ³J(H1,H2)。邻位耦合随二面角变化（Karplus 关系）：两个氢都在直立键上、反式（约 180°）时 ³J 约 7–9 Hz，一个直立一个平伏（约 60°）时约 2–4 Hz。葡萄糖、半乳糖这类 H-2 在直立键上的糖，β 异头氢也在直立键上，所以 β 的 ³J 约 8 Hz、α 约 3.5 Hz。甘露糖的 H-2 在平伏键上，两种异头物的 ³J 都很小，要另用 ¹J(C1,H1)（α 约 170 Hz，β 约 160 Hz）。`, `More reliable is ³J(H1,H2). Vicinal coupling depends on the dihedral angle (the Karplus relation): two axial hydrogens anti to each other (about 180°) give ³J of about 7–9 Hz, an axial–equatorial pair (about 60°) about 2–4 Hz. In sugars with axial H-2 such as glucose and galactose, the β anomeric hydrogen is also axial, so β has ³J about 8 Hz and α about 3.5 Hz. Mannose has an equatorial H-2 and both anomers show small ³J; there ¹J(C1,H1) is used instead (α about 170 Hz, β about 160 Hz).`),
        T(`连接位置：TOCSY 从异头氢出发把同一个环上的氢全部找出来，COSY 一个一个排出顺序，这样认出每个残基；跨糖苷键的 ROESY（或 NOESY）交叉峰把 H-1 连到邻居的 H-x 上，HMBC 把 H-1 连到邻居的 C-x 上（³J 穿过糖苷氧）。被取代的碳的 ¹³C 位移会升高约 5–10 ppm，这也指出连接点。`, `Linkage: TOCSY from the anomeric hydrogen picks out all hydrogens of the same ring and COSY orders them one by one, identifying each residue; ROESY (or NOESY) cross peaks across the glycosidic bond connect H-1 to H-x of the neighbour, and HMBC connects H-1 to C-x of the neighbour (³J through the glycosidic oxygen). The ¹³C shift of a substituted carbon rises by about 5–10 ppm, another pointer to the linkage.`),
      ],
      axes: T(`一维 ¹H 谱：化学位移（ppm）对强度，看异头区（4.4–5.5 ppm）的双峰和它们的间距（Hz）。Karplus 曲线：二面角（度）对 ³J（Hz）。`, `1D ¹H spectrum: chemical shift (ppm) against intensity; read the doublets of the anomeric region (4.4–5.5 ppm) and their splitting (Hz). Karplus curve: dihedral angle (degrees) against ³J (Hz).`),
      tells: [
        T(`有几个糖残基（数异头氢），每个是 α 还是 β。`, `How many sugar residues there are (count anomeric hydrogens) and whether each is α or β.`),
        T(`每个残基是哪种单糖、接在邻居的哪个位置、哪里有分支；糖蛋白上糖链接在哪个残基上（和质谱一起）。`, `Which monosaccharide each residue is, which position of the neighbour it links to, and where branches are; on glycoproteins, which amino acid carries the glycan (together with mass spectrometry).`),
      ],
      sample: T(`几毫克溶在 D₂O 里（冻干两三次把可交换的 OH 换成 OD，让 HDO 峰变小）；HDO 峰在 25 °C 约 4.8 ppm，正好在异头区，要用预饱和压掉或换温度挪开。`, `A few milligrams in D₂O (lyophilised two or three times to exchange OH for OD and shrink the HDO peak); HDO sits at about 4.8 ppm at 25 °C, right in the anomeric region, and is suppressed by presaturation or moved by changing the temperature.`),
      nums: [
        [T(`D-葡萄糖在 D₂O 里`, `D-Glucose in D₂O`), T(`α-H1 约 5.22 ppm，³J 约 3.7 Hz；β-H1 约 4.64 ppm，³J 约 8.0 Hz；平衡时 α : β 约 36 : 64`, `α-H1 about 5.22 ppm, ³J about 3.7 Hz; β-H1 about 4.64 ppm, ³J about 8.0 Hz; at equilibrium α : β about 36 : 64`)],
        [T(`¹J(C1,H1)`, `¹J(C1,H1)`), T(`α（异头氢平伏）约 170 Hz，β（直立）约 160 Hz`, `α (equatorial anomeric H) about 170 Hz, β (axial) about 160 Hz`)],
        [T(`异头碳的 ¹³C 位移`, `¹³C shift of the anomeric carbon`), T(`约 90–110 ppm（α 常比 β 低几个 ppm）`, `About 90–110 ppm (α often a few ppm below β)`)],
      ],
      read: [
        T(`先数异头区的峰，再量每个峰的裂分：约 8 Hz 是 β（对葡萄糖型），约 3–4 Hz 是 α。`, `Count the anomeric peaks, then measure each splitting: about 8 Hz means β (for gluco-type sugars), about 3–4 Hz α.`),
        T(`对每个异头氢做 TOCSY 的一列，数出环上的氢、看耦合的大小，比对标准位移表认出单糖。`, `Take a TOCSY column from each anomeric hydrogen, count the ring hydrogens and their couplings, and identify the monosaccharide against reference shifts.`),
        T(`找跨糖苷键的 ROESY / HMBC 交叉峰定连接位置，再用 ¹³C 的取代位移核对。`, `Locate the linkage from ROESY / HMBC cross peaks across the glycosidic bond and check with ¹³C substitution shifts.`),
      ],
      traps: [
        T(`还原端的糖在溶液里会变旋，α、β 两种都在，同一个残基出现两组峰，别数成两个残基。`, `The reducing-end sugar mutarotates in solution, so both anomers are present and one residue shows two sets of peaks; do not count it twice.`),
        T(`Karplus 关系给的是趋势：³J 还受取代基的电负性和取向影响，系数随体系不同；不能把一个 ³J 精确换成一个二面角。`, `The Karplus relation gives a trend: ³J also depends on the electronegativity and orientation of substituents, and the coefficients vary by system; one ³J cannot be converted exactly into one dihedral angle.`),
      ],
      figs: [
        { gen: 'karplus', cap: T(`上：Karplus（1959）给出的 ³J(H,H) 随二面角的变化（0–90° 用 8.5cos²φ − 0.28，90–180° 用 9.5cos²φ − 0.28 Hz），标出糖环上直立–直立（约 180°）和直立–平伏（约 60°）两种情形。下：示意的 D-葡萄糖在 D₂O 里的异头区，位移、耦合常数和 α : β = 36 : 64 用文献里的典型值。拖动 α 的比例，看变旋怎样改变两个峰的面积。`, `Top: the dependence of ³J(H,H) on dihedral angle given by Karplus (1959) (8.5cos²φ − 0.28 Hz for 0–90°, 9.5cos²φ − 0.28 Hz for 90–180°), marking the axial–axial (about 180°) and axial–equatorial (about 60°) cases of a sugar ring. Bottom: a schematic anomeric region of D-glucose in D₂O, with typical literature shifts, couplings and α : β = 36 : 64. Drag the α fraction to see how mutarotation changes the two peak areas.`) },
      ],
      see: [['#m-nmr2d', T(`二维核磁`, `2D NMR`)], ['#m-polarimetry', T(`旋光：葡萄糖的变旋`, `Polarimetry: the mutarotation of glucose`)], ['#m-proteomics', T(`蛋白质组学（糖肽的质谱）`, `Proteomics (mass spectrometry of glycopeptides)`)]],
      refs: ['karplus1959', 'karplus1963', 'bothnerby1984'],
    },
    {
      id: 'p31', fam: 'macro', abbr: '³¹P NMR', name: T(`³¹P 核磁：磷酸酯、核苷酸与活体代谢`, `³¹P NMR: phosphate esters, nucleotides and metabolism in vivo`),
      one: T(`³¹P 的天然丰度是 100 %，自旋 ½，灵敏度约为 ¹H 的 7 %。磷在生物体里几乎只出现在磷酸基团里，所以 ³¹P 谱很干净：几个峰就能区分无机磷酸、磷酸单酯和二酯、ATP 的三个磷，还能从无机磷酸的位移读出细胞内的 pH。`, `³¹P has 100 % natural abundance, spin ½ and about 7 % of the sensitivity of ¹H. In living matter phosphorus occurs almost only in phosphate groups, so ³¹P spectra are clean: a few peaks distinguish inorganic phosphate, phosphate mono- and diesters and the three phosphorus atoms of ATP, and the shift of inorganic phosphate gives the intracellular pH.`),
      how: [
        T(`化学位移以 85 % H₃PO₄ 为零点（活体谱里常改用磷酸肌酸 PCr 为零点，两者差约 2.5 ppm）。磷酸单酯在 0–5 ppm，二酯（核酸骨架、磷脂）在 −1 到 1 ppm，焦磷酸键里的磷在 −5 到 −22 ppm。ATP 的三个磷相互耦合（²J(P,P) 约 19 Hz）：γ 和 α 是双峰，夹在中间的 β 是三重峰。`, `Shifts are referenced to 85 % H₃PO₄ (spectra in vivo often use phosphocreatine, PCr, as zero instead, about 2.5 ppm apart). Phosphate monoesters lie at 0–5 ppm, diesters (nucleic-acid backbone, phospholipids) at −1 to 1 ppm, and phosphorus in pyrophosphate bonds at −5 to −22 ppm. The three phosphorus atoms of ATP couple to each other (²J(P,P) about 19 Hz): γ and α are doublets, and β in the middle is a triplet.`),
        T(`无机磷酸在生理 pH 附近是 H₂PO₄⁻ 和 HPO₄²⁻ 的混合物，两者交换很快，只出一个峰，位置是两者位移的加权平均。所以 pH = pKa + log[(δ − δ_酸)/(δ_碱 − δ)]，用 Henderson–Hasselbalch 关系就能从峰位读出细胞内 pH。Hoult 等人 1974 年第一次用这个办法在离体肌肉里看到 ATP、PCr 和 Pi，这是磁共振波谱进入活体研究的开端。`, `Near physiological pH inorganic phosphate is a mixture of H₂PO₄⁻ and HPO₄²⁻ in fast exchange, giving one peak at the weighted average of their shifts. Hence pH = pKa + log[(δ − δ_acid)/(δ_base − δ)], and the Henderson–Hasselbalch relation turns the peak position into intracellular pH. Hoult and co-workers saw ATP, PCr and Pi in excised muscle this way in 1974, the start of magnetic resonance spectroscopy in living tissue.`),
      ],
      axes: T(`化学位移（ppm），常用 ¹H 去耦；强度按积分比较各种磷的含量（定量时要等足弛豫时间，并关掉 NOE）。`, `Chemical shift (ppm), usually ¹H-decoupled; integrals compare the amounts of each phosphorus species (for quantification wait long enough for relaxation and suppress the NOE).`),
      tells: [
        T(`磷化合物的种类：磷酸、膦、亚磷酸酯、磷酸酯、膦配体与金属的配位（有机和配位化学里非常常用）。`, `Which phosphorus compounds are present: phosphates, phosphines, phosphites, phosphate esters, phosphine ligands bound to metals (very common in organic and coordination chemistry).`),
        T(`生物样品：ATP、ADP、磷酸肌酸、无机磷酸的含量和细胞内 pH；核酸骨架的构象。`, `In biological samples: the amounts of ATP, ADP, phosphocreatine and inorganic phosphate, and the intracellular pH; backbone conformation of nucleic acids.`),
      ],
      sample: T(`溶液同 ¹H 核磁，浓度要高一些（毫摩尔级）；活体测量用表面线圈直接放在组织上。`, `Solutions as for ¹H NMR, at somewhat higher concentration (millimolar); measurements in vivo use a surface coil placed on the tissue.`),
      nums: [
        [T(`活体谱的典型位移（以 PCr 为 0）`, `Typical shifts in vivo (PCr = 0)`), T(`Pi 约 4.9 · PCr 0 · γ-ATP 约 −2.5 · α-ATP 约 −7.5 · β-ATP 约 −16 ppm`, `Pi about 4.9 · PCr 0 · γ-ATP about −2.5 · α-ATP about −7.5 · β-ATP about −16 ppm`)],
        [T(`ATP 的 P–P 耦合`, `P–P coupling in ATP`), T(`²J(P,P) 约 19 Hz`, `²J(P,P) about 19 Hz`)],
        [T(`三苯基膦`, `Triphenylphosphine`), T(`约 −6 ppm；氧化成三苯基氧膦后约 +29 ppm`, `About −6 ppm; about +29 ppm once oxidised to triphenylphosphine oxide`)],
      ],
      read: [
        T(`先确认参比（H₃PO₄ 还是 PCr），再按区域认峰：正的大位移是膦氧化物和磷酸单酯一类，负的大位移是焦磷酸和 ATP 的 β 位。`, `Confirm the reference (H₃PO₄ or PCr) first, then assign by region: large positive shifts are phosphine oxides and monoesters, large negative ones are pyrophosphates and the β position of ATP.`),
        T(`看裂分：P–P 耦合说明两个磷相连（焦磷酸键），没去耦的 P–H 耦合（几百 Hz）说明磷上直接连着氢。`, `Read the splittings: P–P coupling means two phosphorus atoms are linked (a pyrophosphate bond); undecoupled P–H couplings (hundreds of Hz) mean hydrogen sits directly on phosphorus.`),
      ],
      traps: [
        T(`ATP 的峰位随 pH 和 Mg²⁺ 浓度移动（β 位最明显）；用峰位定 pH 时要选无机磷酸，且参数随离子强度和温度变化。`, `ATP shifts move with pH and Mg²⁺ (most for β); for pH use inorganic phosphate, and its parameters depend on ionic strength and temperature.`),
        T(`去耦带来的 NOE 和不等的 T₁ 会让积分失真；定量要用反门控去耦和足够长的等待。`, `NOE from decoupling and unequal T₁ distort integrals; quantification needs inverse-gated decoupling and long enough delays.`),
      ],
      figs: [
        { gen: 'p31', cap: T(`示意：肌肉组织的 ³¹P 谱（以磷酸肌酸为 0 ppm），五个峰的位置和 ATP 的耦合（约 19 Hz）用常见的文献值；无机磷酸的位置由 pH 按 Henderson–Hasselbalch 关系算出（pKa 6.75，酸式 3.27 ppm，碱式 5.69 ppm，一组常用参数）。拖动 pH，只有 Pi 峰移动；ATP 的峰高随“能量状态”变化，Pi 和 PCr 此消彼长，相当于肌肉疲劳。`, `Schematic: a ³¹P spectrum of muscle (phosphocreatine at 0 ppm). The five peak positions and the ATP couplings (about 19 Hz) follow common literature values; the position of inorganic phosphate is computed from the pH by the Henderson–Hasselbalch relation (pKa 6.75, acid 3.27 ppm, base 5.69 ppm, a commonly used set). Drag the pH and only the Pi peak moves; the "energy state" slider trades PCr for Pi, as in muscle fatigue.`) },
      ],
      see: [['#m-nmr', T(`核磁共振波谱`, `NMR spectroscopy`)], ['#m-sanger', T(`核酸：桑格测序`, `Nucleic acids: Sanger sequencing`)], ['nmr/#s-mri', T(`核磁共振栏目：成像与活体波谱`, `The NMR zone: imaging and spectroscopy in vivo`)]],
      refs: ['hoult1974'],
    },
    {
      id: 'sanger', fam: 'macro', abbr: 'Sanger · CE', name: T(`桑格测序与毛细管电泳读序`, `Sanger sequencing read by capillary electrophoresis`),
      one: T(`让 DNA 聚合酶照着模板合成新链，混进少量带荧光标记的双脱氧核苷酸（ddNTP），链一接上它就终止。于是得到一套长度相差一个碱基、末端颜色代表末端碱基的片段；毛细管电泳按长度把它们排开，按颜色读出顺序。`, `DNA polymerase copies a template while a small amount of fluorescently labelled dideoxynucleotides (ddNTPs) is mixed in; whenever one is incorporated the chain stops. The result is a set of fragments differing by one base, each coloured by its terminal base; capillary electrophoresis sorts them by length and the colours give the sequence.`),
      how: [
        T(`ddNTP 的 3′ 位没有羟基，接上之后无法再连下一个核苷酸，链在这里终止（链终止法，Sanger 1977）。四种 ddNTP 各带一种荧光染料，一个反应管里就够了。终止是随机的，所以每个位置都有一部分链停下，产物覆盖从引物开始的每一个长度。`, `A ddNTP lacks the 3′ hydroxyl, so once incorporated no further nucleotide can be added and the chain terminates (the chain-termination method, Sanger 1977). With a different dye on each of the four ddNTPs, one reaction tube suffices. Termination is random, so at every position some chains stop and the products cover every length from the primer onwards.`),
        T(`产物在充满聚合物的毛细管里电泳：DNA 每个核苷酸带一个负电荷，荷质比几乎相同，自由溶液里跑得一样快；在聚合物网络里，短的片段钻得快。片段按长度依次经过激光检测窗口，记下四个颜色通道的荧光，就是电泳图（electropherogram），软件逐峰读出碱基并给出质量值（Phred 分数）。读出的是新合成链的序列，即模板的互补链。`, `The products are electrophoresed through a polymer-filled capillary. Each nucleotide of DNA carries one negative charge, so the charge-to-mass ratio is nearly constant and all fragments would run equally fast in free solution; in a polymer network short fragments thread through faster. Fragments pass the laser detection window in order of length, and the fluorescence in four colour channels is the electropherogram; software calls each peak as a base with a quality value (Phred score). What is read is the newly synthesised strand, the complement of the template.`),
      ],
      axes: T(`横轴是迁移时间（或换算成碱基位置），纵轴是四个颜色通道的荧光强度。`, `Horizontal: migration time (or base position); vertical: fluorescence in four colour channels.`),
      tells: [
        T(`一段 DNA（约 700–1000 个碱基）的序列：确认克隆、点突变、PCR 产物，是“金标准”的验证手段。`, `The sequence of a DNA stretch of about 700–1000 bases: verifying clones, point mutations and PCR products; the gold standard for confirmation.`),
        T(`杂合位点：同一位置出现两个高度相近的不同颜色的峰。`, `Heterozygous positions: two peaks of different colours and similar height at the same position.`),
      ],
      sample: T(`纯化的质粒或 PCR 产物（几十纳克）、一条引物；测序反应后去掉多余的染料和盐再上机。`, `Purified plasmid or PCR product (tens of nanograms) and one primer; after the sequencing reaction, excess dye and salt are removed before the run.`),
      nums: [
        [T(`读长`, `Read length`), T(`约 700–1000 个碱基；单个碱基的准确度 > 99.99 %（Phred 40 以上）`, `About 700–1000 bases; per-base accuracy above 99.99 % (Phred 40 and higher)`)],
        [T(`Phred 质量值`, `Phred quality`), T(`Q = −10 log₁₀ P（P 是读错的概率）：Q20 = 1 %，Q30 = 0.1 %`, `Q = −10 log₁₀ P (P is the error probability): Q20 = 1 %, Q30 = 0.1 %`)],
      ],
      read: [
        T(`开头约 20–40 个碱基峰挤在一起、读不准（引物附近），结尾的峰越来越宽、越来越矮；只信中间那一段。`, `The first 20–40 bases near the primer are crowded and unreliable, and towards the end peaks broaden and shrink; trust the middle.`),
        T(`每个位置应该只有一个高峰；两个峰叠在一起，要么是杂合，要么样品里混了两种模板。`, `Each position should have one tall peak; two overlapping peaks mean either a heterozygote or a mixture of templates.`),
      ],
      traps: [
        T(`染料团（未除净的游离染料）在约 70–90 个碱基处出一个宽大的峰，盖住那一段。`, `Dye blobs (unremoved free dye) give a broad peak around bases 70–90 and hide that stretch.`),
        T(`读出的是互补链：要和参考序列比较时，先确认用的是正向还是反向引物。`, `The read is the complementary strand: when comparing with a reference, first check whether the forward or reverse primer was used.`),
      ],
      figs: [
        { gen: 'sanger', cap: T(`示意：按输入的模板序列生成的四色电泳图。片段长度每多一个碱基晚到一点，峰随长度变宽、变矮；峰高的起伏用固定的伪随机数，模仿真实谱里不均匀的掺入。下方给出读出的序列（新合成链）和模板。颜色照常见的约定：A 绿、C 蓝、G 黑、T 红。`, `Schematic: a four-colour electropherogram generated from the template you type. Each additional base arrives a little later, and peaks broaden and shrink with length; peak heights vary by a fixed pseudo-random sequence, imitating uneven incorporation. The read (new strand) and the template are listed below. Colours follow the usual convention: A green, C blue, G black, T red.`) },
      ],
      see: [['#m-ce', T(`毛细管电泳`, `Capillary electrophoresis`)], ['#m-gel', T(`凝胶电泳`, `Gel electrophoresis`)], ['#m-fibre', T(`纤维衍射：DNA 的双螺旋`, `Fibre diffraction: the DNA double helix`)]],
      refs: ['sanger1977', 'smith1986'],
    },
    {
      id: 'fibre', fam: 'macro', abbr: 'Fibre XRD', name: T(`纤维衍射`, `Fibre diffraction`),
      one: T(`把长链分子拉成平行的纤维，用 X 射线照射，得到一组水平的“层线”。螺旋结构给出特有的 X 形图案：X 的张角给出螺旋的倾角，层线间距给出螺距，子午线上最远的反射给出相邻单元的间距。DNA 双螺旋就是这样被看出来的。`, `Long-chain molecules drawn into parallel fibres and illuminated with X-rays give a set of horizontal "layer lines". A helix produces a characteristic X-shaped pattern: the angle of the X gives the helix pitch angle, the layer-line spacing gives the pitch, and the farthest meridional reflection gives the spacing between successive units. This is how the DNA double helix was recognised.`),
      how: [
        T(`纤维里的分子沿轴平行，但绕轴的方向随机，所以衍射图相当于把单个分子的变换绕纤维轴转一圈平均。沿轴方向周期为 P（螺距）的结构，衍射只出现在 Z = l/P 的层线上（l 是整数）。Cochran、Crick 和 Vand（1952）算出：半径为 r 的连续螺旋，第 l 层线上的振幅正比于 Bessel 函数 J_l(2πRr)，R 是离子午线的距离。J_l 的第一个极大随 l 线性外移，于是一层层的强斑排成一个 X。`, `In a fibre the molecules are parallel along the axis but randomly rotated about it, so the pattern is the transform of one molecule averaged around the fibre axis. A structure of period P (the pitch) along the axis diffracts only on layer lines Z = l/P (l an integer). Cochran, Crick and Vand (1952) showed that for a continuous helix of radius r the amplitude on layer line l is proportional to the Bessel function J_l(2πRr), with R the distance from the meridian. The first maximum of J_l moves outwards in proportion to l, so the strong spots of successive layers line up in an X.`),
        T(`螺旋由一个个离散的单元组成（B-DNA 每圈 10 个碱基对，相邻间距 h = 3.4 Å），所以 X 形图案在 Z = 1/h 处重复，子午线上那个强反射（3.4 Å）就是碱基堆积的间距。两条链沿轴错开 3/8 螺距（大沟和小沟），两条链散射的光在第 4 层线上正好相消，所以 B-DNA 的图里第 4 层线消失，这是看出“两条链、错开不对称”的线索。Franklin 和 Gosling 1953 年拍的 B 型 DNA 照片（51 号照片）正是这样的图案。`, `A helix of discrete units (10 base pairs per turn in B-DNA, rise h = 3.4 Å) repeats the X pattern about Z = 1/h, and the strong meridional reflection at 3.4 Å is the base-stacking distance. The two strands are offset along the axis by 3/8 of the pitch (major and minor grooves), so their scattered waves cancel on the fourth layer line: the missing fourth layer in B-DNA is the clue to two strands with an asymmetric offset. Franklin and Gosling's 1953 photograph of B-form DNA (Photo 51) shows exactly this pattern.`),
      ],
      axes: T(`二维的衍射图：竖直方向（子午线）平行于纤维轴，水平方向（赤道）垂直于纤维轴；坐标是倒易空间的 R、Z（Å⁻¹）。`, `A 2D diffraction pattern: vertical (meridian) parallel to the fibre axis, horizontal (equator) perpendicular to it; coordinates are reciprocal-space R and Z (Å⁻¹).`),
      tells: [
        T(`螺旋的螺距、半径、每圈单元数，链的数目和相对位置。`, `Pitch, radius and units per turn of a helix, and the number and relative positions of the strands.`),
        T(`纤维状蛋白（α-角蛋白、胶原、淀粉样纤维的交叉 β 结构）和合成高分子纤维的分子排列和取向度。`, `Molecular arrangement and orientation in fibrous proteins (α-keratin, collagen, the cross-β structure of amyloid) and synthetic polymer fibres.`),
      ],
      sample: T(`拉伸取向的纤维或丝，控制湿度（DNA 的 A 型和 B 型随湿度转变）；用面探测器在平板上记录。`, `Drawn, oriented fibres or threads under controlled humidity (DNA switches between the A and B forms with humidity), recorded on an area detector.`),
      nums: [
        [T(`B-DNA`, `B-DNA`), T(`螺距 34 Å，每圈 10 个碱基对，碱基间距 3.4 Å，磷酸的半径约 10 Å`, `Pitch 34 Å, 10 base pairs per turn, rise 3.4 Å, phosphate radius about 10 Å`)],
        [T(`A-DNA`, `A-DNA`), T(`螺距约 28 Å，每圈约 11 个碱基对（较干燥时）`, `Pitch about 28 Å, about 11 base pairs per turn (at lower humidity)`)],
        [T(`α 螺旋`, `α-Helix`), T(`每圈 3.6 个残基，螺距 5.4 Å，每个残基上升 1.5 Å`, `3.6 residues per turn, pitch 5.4 Å, 1.5 Å rise per residue`)],
        [T(`交叉 β（淀粉样纤维）`, `Cross-β (amyloid)`), T(`子午线 4.7 Å（链间），赤道约 10 Å（片层间）`, `4.7 Å meridional (between strands), about 10 Å equatorial (between sheets)`)],
      ],
      read: [
        T(`量层线间距：Z₁ = 1/P 给出螺距。`, `Measure the layer-line spacing: Z₁ = 1/P gives the pitch.`),
        T(`找子午线上最远的强反射：它在 1/h 处，h 是每个单元沿轴的上升。P/h 就是每圈的单元数。`, `Find the farthest strong meridional reflection: it lies at 1/h, with h the rise per unit. P/h is the number of units per turn.`),
        T(`X 的半张角和螺旋的倾角相关；缺失的层线说明有多条链，按缺哪一层算出链之间的错开。`, `The half-angle of the X relates to the pitch angle of the helix; missing layer lines reveal multiple strands, and which one is missing gives their offset.`),
      ],
      traps: [
        T(`纤维取向不完全时斑点拉成弧，高层线的强度会被低估；定量比较前要做取向修正。`, `Imperfect orientation draws spots into arcs and underestimates high layer lines; correct for disorientation before quantitative comparison.`),
        T(`纤维图只给出绕轴平均的信息，一般不能像单晶衍射那样直接解出原子位置，要和模型的计算图比对。`, `A fibre pattern carries only cylindrically averaged information and usually cannot be solved for atomic positions directly as single-crystal data can; it is compared with patterns calculated from models.`),
      ],
      figs: [
        { gen: 'helix', cap: T(`由螺旋衍射理论算出（Cochran–Crick–Vand）：B-DNA 的纤维衍射图，螺距 34 Å、每圈 10 个单元、半径 10 Å，两条链沿轴错开 3/8 螺距。每条层线上的强度是 Bessel 函数的平方；只算了磷酸骨架（把每个碱基对当作一个点），没有乘原子散射因子和温度因子，所以高角的强度偏强。把错开改成 1/2，奇数层线全部消失；改成 0（单链），第 4 层线回来。`, `Computed from helical diffraction theory (Cochran–Crick–Vand): the fibre pattern of B-DNA with pitch 34 Å, 10 units per turn, radius 10 Å and the two strands offset by 3/8 of the pitch. Intensity on each layer line is a squared Bessel function; only the phosphate backbone is modelled (one point per base pair), without atomic scattering or temperature factors, so high-angle intensity is overstated. Set the offset to 1/2 and all odd layer lines vanish; set it to 0 (one strand) and the fourth layer returns.`) },
      ],
      see: [['#m-pxrd', T(`粉末衍射`, `Powder diffraction`)], ['#m-scxrd', T(`单晶衍射`, `Single-crystal diffraction`)], ['#m-saxs', T(`小角散射`, `Small-angle scattering`)]],
      refs: ['cochran1952', 'franklin1953', 'watson1953'],
    },
    {
      id: 'gel', fam: 'macro', abbr: 'SDS-PAGE · Agarose', name: T(`凝胶电泳`, `Gel electrophoresis`),
      one: T(`带电的大分子在凝胶里被电场拖着走，凝胶的网孔像筛子，小的跑得快、大的跑得慢。SDS-PAGE 用来看蛋白质的分子量和纯度，琼脂糖凝胶用来看 DNA 片段的大小。和一组已知大小的标准品比，就能估出未知样品的大小。`, `Charged macromolecules are pulled through a gel by an electric field; the gel's mesh acts as a sieve, so small molecules run fast and large ones slowly. SDS-PAGE shows the molecular weight and purity of proteins, agarose gels the size of DNA fragments. Comparing with a ladder of known sizes estimates the size of an unknown.`),
      how: [
        T(`SDS（十二烷基硫酸钠）把蛋白质变性并均匀地包上一层负电荷（约每克蛋白 1.4 g SDS），巯基乙醇或 DTT 打开二硫键；这样所有蛋白的荷质比接近，形状也都成了伸展的棒，迁移只取决于大小。Laemmli（1970）的不连续缓冲体系先在浓缩胶里把样品压成一条细带，再进入分离胶。DNA 本身每个核苷酸带一个负电荷，不用 SDS 就能按大小分开。`, `SDS (sodium dodecyl sulfate) denatures proteins and coats them evenly with negative charge (about 1.4 g SDS per gram of protein), while mercaptoethanol or DTT breaks disulfide bonds; all proteins then have similar charge-to-mass ratios and similar rod-like shapes, and migration depends only on size. Laemmli's (1970) discontinuous buffer system first stacks the sample into a thin band in the stacking gel before it enters the resolving gel. DNA carries one negative charge per nucleotide and separates by size without SDS.`),
        T(`在一定范围内，迁移距离和分子量的对数成直线：log M = a − b·Rf，Rf 是条带迁移距离与染料前沿距离之比。Weber 和 Osborn（1969）用四十种蛋白检验过，误差约 10 %。凝胶浓度决定可用范围：12 % 的聚丙烯酰胺适合约 15–100 kDa，1 % 琼脂糖适合约 0.5–10 kb 的 DNA。`, `Within a range, migration distance is linear in the logarithm of molecular weight: log M = a − b·Rf, with Rf the band distance divided by the dye-front distance. Weber and Osborn (1969) tested this with forty proteins and found errors of about 10 %. Gel concentration sets the useful range: 12 % polyacrylamide suits about 15–100 kDa, 1 % agarose about 0.5–10 kb of DNA.`),
      ],
      axes: T(`凝胶图：竖直方向是迁移距离（从加样孔往下），每一道是一个样品。校准图：Rf 对 log M。`, `Gel image: migration distance downwards from the well, one lane per sample. Calibration: Rf against log M.`),
      tells: [
        T(`蛋白质亚基的分子量（约 ±10 %）、纯度、是否降解；配合免疫印迹（Western blot）看特定蛋白。`, `Subunit molecular weights (about ±10 %), purity and degradation; with Western blotting, specific proteins.`),
        T(`DNA、RNA 片段的大小：PCR 产物、酶切结果、质粒的超螺旋和开环形式。`, `Sizes of DNA and RNA fragments: PCR products, restriction digests, supercoiled and nicked plasmid forms.`),
      ],
      sample: T(`蛋白：几微克，和含 SDS、还原剂、甘油、溴酚蓝的上样缓冲液混匀，煮沸几分钟。DNA：几十到几百纳克，加上样染料；染色用考马斯亮蓝、银染（蛋白）或核酸染料（DNA）。`, `Proteins: a few micrograms mixed with loading buffer containing SDS, reductant, glycerol and bromophenol blue, heated for a few minutes. DNA: tens to hundreds of nanograms with loading dye. Stain with Coomassie or silver (proteins) or a nucleic-acid dye (DNA).`),
      nums: [
        [T(`SDS 结合量`, `SDS binding`), T(`约 1.4 g SDS / g 蛋白`, `About 1.4 g SDS per g protein`)],
        [T(`分子量误差`, `Molecular-weight error`), T(`常规蛋白约 ±10 %；糖蛋白、膜蛋白、富含脯氨酸或带大量电荷的蛋白可以偏离 20 % 以上`, `About ±10 % for ordinary proteins; glycoproteins, membrane proteins and proline-rich or highly charged proteins can deviate by more than 20 %`)],
        [T(`检出限`, `Detection limit`), T(`考马斯亮蓝约 10–100 ng 一条带，银染约 1 ng`, `Coomassie about 10–100 ng per band, silver about 1 ng`)],
      ],
      read: [
        T(`用标准品的条带画 log M 对 Rf 的直线，只在标准品覆盖的范围内内插。`, `Plot log M against Rf for the ladder and interpolate only within its range.`),
        T(`还原和非还原两种条件对比：分子量减半说明是二硫键连着的二聚体。`, `Compare reducing and non-reducing conditions: a halved mass means a disulfide-linked dimer.`),
      ],
      traps: [
        T(`SDS-PAGE 给的是亚基的大小，不是天然蛋白的大小；寡聚状态要用尺寸排阻色谱、光散射或超速离心。`, `SDS-PAGE gives subunit size, not native size; oligomeric state needs size-exclusion chromatography, light scattering or ultracentrifugation.`),
        T(`“微笑”的条带（中间跑得快）来自凝胶受热不均；加样太多会拖尾、把相邻条带糊在一起。`, `"Smiling" bands (centre running faster) come from uneven heating; overloading causes tailing and merges neighbouring bands.`),
      ],
      figs: [
        { gen: 'gel', cap: T(`示意：一块 SDS-PAGE 胶，左边一道是十个已知分子量的标准品（250 到 10 kDa），迁移距离按半对数关系放置。拖动未知样品的 Rf，程序用标准品的最小二乘直线算出它的分子量；超出标准品范围时提示外推不可靠。`, `Schematic: an SDS-PAGE gel whose left lane holds ten markers of known mass (250 to 10 kDa), placed by the semi-logarithmic relation. Drag the Rf of the unknown and its mass is computed from the least-squares line through the markers; outside the ladder's range a warning says extrapolation is unreliable.`) },
      ],
      see: [['#m-ce', T(`毛细管电泳`, `Capillary electrophoresis`)], ['#m-sec', T(`尺寸排阻色谱：天然分子量`, `Size-exclusion chromatography: native size`)], ['#m-sanger', T(`桑格测序`, `Sanger sequencing`)]],
      refs: ['laemmli1970', 'weber1969'],
    },
    {
      id: 'hdx', fam: 'macro', abbr: 'HDX-MS', name: T(`氢氘交换质谱`, `Hydrogen–deuterium exchange mass spectrometry`),
      one: T(`把蛋白质放进重水，主链酰胺上的氢慢慢换成氘，蛋白每换一个氘就重约 1 Da。暴露在外、没有氢键的部位换得快，藏在内部或参与氢键的部位换得慢。酶切后看每段肽变重了多少，就知道哪里折叠紧、哪里柔性、配体结合后哪里被保护起来。`, `In heavy water the hydrogens of backbone amides slowly exchange for deuterium, and the protein gains about 1 Da per deuterium. Exposed, non-hydrogen-bonded sites exchange fast; buried or hydrogen-bonded sites slowly. Digesting the protein and measuring how much heavier each peptide has become shows where the fold is tight, where it is flexible, and where a ligand protects it.`),
      how: [
        T(`酰胺氢的交换由酸和碱催化，在 pH 2.5–3 附近最慢。没有结构保护时（无规卷曲），pH 7、25 °C 下交换速率常数是每秒一到十几次（具体随邻近残基变化，Bai 等 1993 年列出了修正表）；折叠的蛋白里，交换要等局部或整体的结构打开，速率被保护因子 PF 压低，PF 可以从 1 到 10⁸。`, `Amide hydrogen exchange is acid- and base-catalysed and slowest near pH 2.5–3. Without structural protection (random coil) the rate constant at pH 7 and 25 °C is about one to a few tens per second (depending on neighbouring residues; Bai and co-workers tabulated corrections in 1993). In a folded protein exchange must wait for local or global opening, and the rate is lowered by a protection factor PF ranging from 1 to 10⁸.`),
        T(`实验：在 D₂O 缓冲液里标记一段时间（几秒到几小时），然后加冷的酸性缓冲液猝灭（pH 2.5、0 °C，交换减慢约四到五个数量级），立刻用胃蛋白酶（酸性下有活性）酶切，快速液相分离后进质谱。每段肽的同位素包络整体右移，质心移动的量就是吸收的氘数。分析过程中会丢掉一部分氘（回交换，约 10–40 %），用全氘代的对照样品校正。`, `In the experiment the protein is labelled in D₂O buffer for a set time (seconds to hours), quenched with cold acidic buffer (pH 2.5, 0 °C, slowing exchange by four to five orders of magnitude), digested at once with pepsin (active at low pH), separated quickly by liquid chromatography and measured by mass spectrometry. The isotopic envelope of each peptide shifts to higher mass, and the shift of its centroid is the deuterium uptake. Some deuterium is lost during analysis (back-exchange, about 10–40 %), corrected with a fully deuterated control.`),
      ],
      axes: T(`质谱：m/z 对强度，看同位素包络的移动。摄取曲线：标记时间（对数轴）对吸收的氘数（Da）。差异图：沿序列的每段肽在有无配体时的氘摄取差。`, `Mass spectra: m/z against intensity, showing the shift of the envelope. Uptake curves: labelling time (log axis) against deuterium uptake (Da). Difference plots: uptake difference with and without ligand for each peptide along the sequence.`),
      tells: [
        T(`哪些区域是刚性的、哪些是柔性的；结合配体、抗体、伴侣蛋白时哪里被保护（表位作图）。`, `Which regions are rigid and which flexible; where binding of a ligand, antibody or partner protects the protein (epitope mapping).`),
        T(`构象变化和别构效应、蛋白药物的批次一致性；不受分子量限制，膜蛋白和大复合物也能做。`, `Conformational change and allostery, and batch comparability of protein drugs; no size limit, so membrane proteins and large complexes are possible.`),
      ],
      sample: T(`纯化的蛋白，几十皮摩尔一个时间点；缓冲液里不要有大量去垢剂和甘油（干扰液相和质谱）。`, `Purified protein, tens of picomoles per time point; avoid large amounts of detergent and glycerol in the buffer (they interfere with chromatography and MS).`),
      nums: [
        [T(`氘和氢的质量差`, `Deuterium–hydrogen mass difference`), T(`1.00628 Da`, `1.00628 Da`)],
        [T(`猝灭条件`, `Quench conditions`), T(`pH 2.5、0 °C，交换比 pH 7、25 °C 慢约 10⁴–10⁵ 倍`, `pH 2.5, 0 °C: exchange about 10⁴–10⁵ times slower than at pH 7, 25 °C`)],
        [T(`每段肽可观察的酰胺数`, `Observable amides per peptide`), T(`残基数减 2（N 端两个回交换太快）再减去脯氨酸数`, `Residues minus 2 (the first two back-exchange too fast) minus prolines`)],
      ],
      read: [
        T(`对每段肽画摄取曲线：几秒就饱和的是暴露的环区，几小时还没换完的是稳定的二级结构核心。`, `Plot uptake per peptide: saturation within seconds means exposed loops; incomplete exchange after hours means a stable core of secondary structure.`),
        T(`比较有无配体：摄取明显减少的肽段在结合界面或被别构稳定；要做重复实验并给出显著性检验（Masson 等 2019 的建议）。`, `Compare with and without ligand: peptides with clearly reduced uptake lie at the interface or are allosterically stabilised; use replicates and significance tests (the recommendations of Masson et al. 2019).`),
      ],
      traps: [
        T(`分辨率只到肽段：一段 10 个残基的肽变化了 2 Da，不知道是哪两个氢；重叠的肽段可以缩小范围，ETD 碎裂可以到单个残基，但 CID 会让氘在肽内乱跑（scrambling）。`, `Resolution is per peptide: a 10-residue peptide gaining 2 Da does not say which two hydrogens; overlapping peptides narrow it down and ETD fragmentation can reach single residues, whereas CID scrambles deuterium within the peptide.`),
        T(`摄取减少不一定是直接结合：别构的稳定化也会减少摄取；结论要和别的方法对照。`, `Reduced uptake is not necessarily direct contact: allosteric stabilisation reduces it too; cross-check with other methods.`),
      ],
      figs: [
        { gen: 'hdx', cap: T(`模型计算：一段肽（可以改序列）在重水里的氘摄取。每个可观察的酰胺按 k_int / PF 交换（k_int 取 3 s⁻¹，D₂O 占 90 %，回交换 25 %），左图是暴露、部分保护、强保护三种情形的摄取曲线，右图是所选时刻的同位素包络：天然同位素分布（由元素组成算出）和氘数的分布卷积。拖动时间看包络整体右移、变宽。`, `Model calculation: deuterium uptake of a peptide (edit the sequence) in heavy water. Each observable amide exchanges at k_int / PF (k_int = 3 s⁻¹, 90 % D₂O, 25 % back-exchange). Left: uptake curves for exposed, partly protected and strongly protected cases; right: the isotopic envelope at the chosen time, the natural isotope pattern (from the elemental formula) convolved with the distribution of deuterium count. Drag the time to see the envelope shift and broaden.`) },
      ],
      see: [['#m-proteomics', T(`蛋白质组学与肽段的鉴定`, `Proteomics and peptide identification`)], ['#m-esi', T(`电喷雾电离`, `Electrospray ionisation`)], ['#m-bionmr', T(`蛋白质核磁（单个残基的交换）`, `Protein NMR (exchange residue by residue)`)]],
      refs: ['bai1993', 'zhang1993', 'masson2019'],
    },
    {
      id: 'polychar', fam: 'macro', core: true, abbr: 'Tacticity · Branching · Ageing', name: T(`高分子的谱学表征：立构、支化与老化`, `Spectroscopic characterisation of polymers: tacticity, branching and ageing`),
      one: T(`合成高分子的“一级结构”由聚合方法决定，但同一种单体可以有不同的立构规整度、支化度和端基，材料性能差别很大。¹H 和 ¹³C 核磁按相邻单体的立体关系分出不同的峰，红外看官能团和氧化老化，配合分子量分布（GPC、MALDI）和热分析就得到完整的画像。`, `The "primary structure" of a synthetic polymer is set by how it was made, but one monomer can give different tacticities, degrees of branching and end groups, with very different properties. ¹H and ¹³C NMR split peaks according to the stereochemical relation of neighbouring units, infrared follows functional groups and oxidative ageing, and with molar-mass distributions (GPC, MALDI) and thermal analysis a complete picture emerges.`),
      how: [
        T(`乙烯基聚合物 –CH₂–CHX– 主链上每个 CHX 是一个立体中心。相邻两个单体的取代基在同侧叫内消旋（m），在两侧叫外消旋（r）。全同立构全是 m，间同立构全是 r，无规立构随机。按三元组（mm、mr、rr）或五元组看，峰的位置略有不同：聚甲基丙烯酸甲酯（PMMA）的 α-甲基 ¹H 在约 1.21（mm）、1.02（mr）、0.85（rr）ppm（CDCl₃）。Bovey 和 Tiers（1960）用这个方法第一次定量测出了立构规整度。`, `In a vinyl polymer –CH₂–CHX– each CHX is a stereocentre. Two neighbouring units with substituents on the same side form a meso (m) diad, on opposite sides a racemo (r) diad. Isotactic chains are all m, syndiotactic all r, atactic random. Peaks shift slightly with the triad (mm, mr, rr) or pentad: the α-methyl ¹H of poly(methyl methacrylate) (PMMA) appears at about 1.21 (mm), 1.02 (mr) and 0.85 (rr) ppm (CDCl₃). Bovey and Tiers (1960) measured tacticity quantitatively this way for the first time.`),
        T(`如果每次加成只看前一个单体（Bernoulli 统计），三元组的比例只由一个参数 P_m 决定：mm = P_m²，mr = 2P_m(1 − P_m)，rr = (1 − P_m)²。测出的比例和这个关系对得上，说明链增长没有“记忆”；对不上（比如 4·mm·rr / mr² 明显偏离 1），要用一阶 Markov 等更复杂的模型。自由基聚合的 PMMA 偏间同（P_m 约 0.2–0.25），阴离子聚合在某些条件下可以得到高度全同的 PMMA。在间同的两个 m 二元组里，CH₂ 上的两个氢不等价（非对映异位），会裂成一个 AB 四重峰；r 二元组里两个氢等价，是单峰。`, `If each addition depends only on the previous unit (Bernoulli statistics), triad fractions are set by one parameter P_m: mm = P_m², mr = 2P_m(1 − P_m), rr = (1 − P_m)². Measured fractions that fit this relation mean chain growth has no "memory"; misfits (for example 4·mm·rr / mr² clearly away from 1) call for first-order Markov or more elaborate models. Free-radical PMMA is syndiotactic-rich (P_m about 0.2–0.25), while anionic polymerisation can give highly isotactic PMMA under some conditions. In an m diad the two hydrogens of the CH₂ are inequivalent (diastereotopic) and form an AB quartet; in an r diad they are equivalent and give a singlet.`),
        T(`支化：低密度聚乙烯（LDPE）在自由基聚合中“回咬”形成短支链（主要是丁基），线性低密度聚乙烯（LLDPE）的支链来自共聚单体（丁烯、己烯、辛烯）。¹³C 核磁里支化点的次甲基碳、支链上的 α、β、γ 碳和链端碳各有位置（主链 CH₂ 在 30.0 ppm），按峰面积算出每 1000 个碳有几个支链（Randall 1989 的综述）。老化：聚烯烃光氧化后在 1715 cm⁻¹ 附近出现羰基吸收、3400 cm⁻¹ 附近出现羟基吸收，羰基吸收和参比峰（如 PE 的 1465 cm⁻¹）之比就是“羰基指数”。`, `Branching: low-density polyethylene (LDPE) forms short branches (mainly butyl) by backbiting during free-radical polymerisation; the branches of linear low-density polyethylene (LLDPE) come from comonomers (butene, hexene, octene). In ¹³C NMR the methine carbon at the branch point, the α, β, γ carbons along the branch and chain-end carbons each have their own positions (main-chain CH₂ at 30.0 ppm), and peak areas give branches per 1000 carbons (reviewed by Randall 1989). Ageing: photo-oxidised polyolefins develop a carbonyl band near 1715 cm⁻¹ and a hydroxyl band near 3400 cm⁻¹; the ratio of the carbonyl band to a reference band (such as PE's 1465 cm⁻¹) is the "carbonyl index".`),
      ],
      axes: T(`核磁：化学位移（ppm）对强度，在一个基团的峰里看细分的立构峰。红外：波数（cm⁻¹）对吸光度。`, `NMR: chemical shift (ppm) against intensity, reading the stereosequence fine structure within one group's peak. IR: wavenumber (cm⁻¹) against absorbance.`),
      tells: [
        T(`立构规整度（P_m、三元组和五元组比例）、聚合机理是否符合 Bernoulli 统计。`, `Tacticity (P_m, triad and pentad fractions) and whether the polymerisation follows Bernoulli statistics.`),
        T(`支化的种类和数量、共聚组成和序列分布、端基（结合 MALDI 定数均分子量）。`, `Type and number of branches, copolymer composition and sequence distribution, end groups (with MALDI, number-average molar mass).`),
        T(`官能团、添加剂、老化程度；微塑料的种类鉴定（红外或拉曼与谱库比对）。`, `Functional groups, additives and degree of ageing; identification of microplastics (IR or Raman against libraries).`),
      ],
      sample: T(`核磁：聚合物溶在氘代溶剂里（聚烯烃要在高温下溶在氘代四氯乙烷或邻二氯苯里，约 120 °C），浓度比小分子高；定量 ¹³C 要长等待时间。红外：薄膜、ATR 直接压在表面，或 KBr 压片。`, `NMR: the polymer dissolved in deuterated solvent (polyolefins need deuterated tetrachloroethane or o-dichlorobenzene at about 120 °C), at higher concentration than small molecules; quantitative ¹³C needs long delays. IR: films, ATR directly on the surface, or KBr discs.`),
      nums: [
        [T(`PMMA α-甲基的 ¹H（CDCl₃）`, `PMMA α-methyl ¹H (CDCl₃)`), T(`mm 约 1.21 · mr 约 1.02 · rr 约 0.85 ppm`, `mm about 1.21 · mr about 1.02 · rr about 0.85 ppm`)],
        [T(`自由基 PMMA`, `Free-radical PMMA`), T(`P_m 约 0.2–0.25（偏间同），rr 约 0.6`, `P_m about 0.2–0.25 (syndiotactic-rich), rr about 0.6`)],
        [T(`聚乙烯 ¹³C`, `Polyethylene ¹³C`), T(`主链 CH₂ 30.0 ppm；LDPE 每 1000 个碳约 10–30 个短支链`, `Main-chain CH₂ 30.0 ppm; LDPE about 10–30 short branches per 1000 carbons`)],
        [T(`老化的红外吸收`, `IR bands of ageing`), T(`羰基约 1715 cm⁻¹（酮、酸），1735 cm⁻¹（酯）；羟基约 3400 cm⁻¹`, `Carbonyl about 1715 cm⁻¹ (ketones, acids), 1735 cm⁻¹ (esters); hydroxyl about 3400 cm⁻¹`)],
      ],
      read: [
        T(`在立构敏感的峰（PMMA 的 α-甲基，聚丙烯的甲基 ¹³C）上积分各个三元组或五元组。`, `Integrate the triads or pentads in a tacticity-sensitive peak (PMMA α-methyl, polypropylene methyl ¹³C).`),
        T(`由 mm 和 rr 算 P_m，再用 P_m 预测 mr，看是否和实测一致；一致说明 Bernoulli 统计成立。`, `Compute P_m from mm and rr, predict mr from P_m and compare with the measurement; agreement supports Bernoulli statistics.`),
      ],
      traps: [
        T(`同一个基团在不同溶剂、温度下的立构峰位置会移动，甚至交换顺序；要和同一条件下的文献对照。`, `Stereosequence peak positions move with solvent and temperature, sometimes changing order; compare with literature under the same conditions.`),
        T(`¹³C 定量时，支链末端和主链碳的 T₁ 差别很大，等待时间不够会低估支化。`, `In quantitative ¹³C, branch-end and main-chain carbons have very different T₁; too short a delay underestimates branching.`),
      ],
      figs: [
        { gen: 'tacticity', cap: T(`模型计算（Bernoulli 统计）加示意的峰位：拖动 P_m，三元组比例 mm = P_m²、mr = 2P_m(1 − P_m)、rr = (1 − P_m)² 随之变化，下方是 PMMA α-甲基 ¹H 峰的示意谱（峰位用 CDCl₃ 里的典型值，峰宽是示意的）。三个预设对应自由基（约 0.22）、无规（0.5）和全同（0.95）的 PMMA。`, `Model (Bernoulli statistics) with schematic peak positions: drag P_m and the triad fractions mm = P_m², mr = 2P_m(1 − P_m), rr = (1 − P_m)² follow; below is a schematic PMMA α-methyl ¹H spectrum (typical positions in CDCl₃, illustrative widths). The three presets correspond to free-radical (about 0.22), atactic (0.5) and isotactic (0.95) PMMA.`) },
        { xy: 'raman-hdpe', xl: T(`拉曼位移（cm⁻¹）`, `Raman shift (cm⁻¹)`), yl: T(`强度（计数）`, `intensity (counts)`), cap: T(`实测：高密度聚乙烯的拉曼谱（OpenSpecy 谱库，CC BY 4.0）。1060 和 1130 cm⁻¹ 是全反式链段的 C–C 伸缩，1295 cm⁻¹ 是 CH₂ 扭曲，1440–1460 cm⁻¹ 是 CH₂ 弯曲，2850–2880 cm⁻¹ 是 C–H 伸缩；1418 cm⁻¹ 的肩峰只出现在正交晶相里，可以用来估结晶度。`, `Measured: the Raman spectrum of high-density polyethylene (OpenSpecy library, CC BY 4.0). The bands at 1060 and 1130 cm⁻¹ are C–C stretches of all-trans segments, 1295 cm⁻¹ the CH₂ twist, 1440–1460 cm⁻¹ the CH₂ bends and 2850–2880 cm⁻¹ the C–H stretches; the shoulder at 1418 cm⁻¹ appears only in the orthorhombic crystalline phase and can be used to estimate crystallinity.`) },
      ],
      see: [['#m-sec', T(`凝胶渗透色谱：分子量分布`, `Gel permeation chromatography: molar-mass distribution`)], ['#m-maldi', T(`MALDI：重复单元和端基`, `MALDI: repeat units and end groups`)], ['#m-dsc', T(`差示扫描量热：玻璃化转变和结晶`, `DSC: glass transition and crystallisation`)], ['#m-mals', T(`静态光散射`, `Static light scattering`)], ['#m-visc', T(`黏度法`, `Viscometry`)]],
      refs: ['bovey1960', 'randall1989'],
    },
    {
      id: 'mals', fam: 'macro', abbr: 'SLS · MALS · Zimm', name: T(`静态光散射与多角度光散射`, `Static and multi-angle light scattering`),
      one: T(`大分子溶液散射的光比溶剂多，多出来的部分正比于分子量和浓度；散射随角度的变化给出分子的尺寸（回转半径），随浓度的变化给出分子和溶剂之间的相互作用（第二维里系数）。不需要任何标准品，是测绝对分子量的方法。`, `A macromolecular solution scatters more light than the solvent, and the excess is proportional to molar mass and concentration; its angle dependence gives the size of the molecule (radius of gyration) and its concentration dependence the interaction between molecules and solvent (second virial coefficient). No standards are needed: it is an absolute method for molar mass.`),
      how: [
        T(`Zimm（1948）的方程：Kc / R_θ = (1/M_w)(1 + q²R_g²/3) + 2A₂c。R_θ 是扣除溶剂后的 Rayleigh 比，c 是质量浓度，q = (4πn₀/λ)·sin(θ/2) 是散射矢量，光学常数 K = 4π²n₀²(dn/dc)² / (N_A λ⁴)，要事先知道折光指数增量 dn/dc。把几个浓度、几个角度的数据画在 Kc/R 对 sin²(θ/2) + k·c 的图上（Zimm 图），同时外推到 θ → 0 和 c → 0：截距是 1/M_w，零浓度线的斜率给出 R_g，零角度线的斜率给出 A₂。`, `Zimm's (1948) equation: Kc / R_θ = (1/M_w)(1 + q²R_g²/3) + 2A₂c. R_θ is the excess Rayleigh ratio, c the mass concentration, q = (4πn₀/λ)·sin(θ/2) the scattering vector, and K = 4π²n₀²(dn/dc)² / (N_A λ⁴) an optical constant requiring the refractive-index increment dn/dc. Data at several concentrations and angles plotted as Kc/R against sin²(θ/2) + k·c (the Zimm plot) are extrapolated simultaneously to θ → 0 and c → 0: the intercept is 1/M_w, the slope of the zero-concentration line gives R_g, and the slope of the zero-angle line gives A₂.`),
        T(`现在最常见的用法是接在尺寸排阻色谱（SEC）后面：多角度检测器（MALS）同时在十几个角度测量，示差折光检测器给出每一刻的浓度，于是每个流出体积都有一个绝对的 M_w，不依赖柱子的校准曲线。这样测出的分子量对支化高分子、蛋白质复合物都可靠（SEC 的校准只对和标准品形状相同的分子有效）。`, `The commonest use today is downstream of size-exclusion chromatography (SEC): a multi-angle detector (MALS) measures at a dozen or more angles while a refractive-index detector gives the concentration at each moment, so every elution slice has an absolute M_w independent of column calibration. This is reliable for branched polymers and protein complexes alike (SEC calibration holds only for molecules shaped like the standards).`),
      ],
      axes: T(`Zimm 图：横轴 sin²(θ/2) + k·c（k 是为了把各浓度的数据排开选的常数），纵轴 Kc/R_θ（mol/g）。SEC-MALS：流出体积对摩尔质量和浓度信号。`, `Zimm plot: horizontal sin²(θ/2) + k·c (k a constant chosen to spread the concentrations), vertical Kc/R_θ (mol/g). SEC-MALS: elution volume against molar mass and concentration signal.`),
      tells: [
        T(`绝对的重均分子量 M_w，蛋白质的寡聚状态（单体、二聚体、聚集体）。`, `Absolute weight-average molar mass M_w; the oligomeric state of proteins (monomer, dimer, aggregate).`),
        T(`回转半径 R_g（大于约 10 nm 时才测得准），第二维里系数 A₂（溶剂好坏、蛋白溶液的聚集倾向）。`, `Radius of gyration R_g (measurable when above about 10 nm) and second virial coefficient A₂ (solvent quality, aggregation propensity of protein solutions).`),
      ],
      sample: T(`过滤除尘（0.02–0.2 μm），几个浓度（批量法）或注入 SEC；dn/dc 要已知（蛋白在水里约 0.185 mL/g，聚苯乙烯在四氢呋喃里约 0.185 mL/g）或自己测。`, `Filtered dust-free (0.02–0.2 μm), at several concentrations (batch mode) or injected into SEC; dn/dc must be known (about 0.185 mL/g for proteins in water and for polystyrene in tetrahydrofuran) or measured.`),
      nums: [
        [T(`可测分子量`, `Measurable molar mass`), T(`约 10³ 到 10⁹ g/mol`, `About 10³ to 10⁹ g/mol`)],
        [T(`R_g 下限`, `Lower limit of R_g`), T(`约 10 nm（λ = 658 nm 时，更小的分子角度依赖太弱）`, `About 10 nm (at λ = 658 nm smaller molecules have too little angular dependence)`)],
        [T(`dn/dc 的影响`, `Effect of dn/dc`), T(`M 正比于 1/(dn/dc)²：dn/dc 错 5 %，M 错约 10 %`, `M scales as 1/(dn/dc)²: a 5 % error in dn/dc gives about 10 % in M`)],
      ],
      read: [
        T(`先看零浓度和零角度两条外推线是否直、是否交在同一个截距；弯曲说明有聚集或尘埃。`, `Check that the zero-concentration and zero-angle extrapolations are straight and meet at the same intercept; curvature means aggregates or dust.`),
        T(`从截距读 M_w，从两条斜率读 R_g 和 A₂；A₂ > 0 是良溶剂，A₂ ≈ 0 是 θ 状态，A₂ < 0 倾向聚集。`, `Read M_w from the intercept and R_g and A₂ from the slopes; A₂ > 0 means a good solvent, A₂ ≈ 0 θ conditions, A₂ < 0 a tendency to aggregate.`),
      ],
      traps: [
        T(`灰尘和少量聚集体在小角度散射极强，会把 M_w 和 R_g 都拉高；样品一定要过滤或离心。`, `Dust and traces of aggregate scatter strongly at low angles and inflate both M_w and R_g; samples must be filtered or centrifuged.`),
        T(`对多分散样品，批量法得到的是重均 M_w 和 z 均 R_g，不是数均；要分布就接 SEC。`, `For polydisperse samples batch mode gives the weight-average M_w and z-average R_g, not number averages; for distributions, couple to SEC.`),
      ],
      figs: [
        { gen: 'zimm', cap: T(`模型计算：按 Zimm 方程生成的四个浓度、九个角度的数据（加了 0.3 % 的固定伪随机误差），再用最小二乘拟合出 M_w、R_g 和 A₂。拖动三个参数生成新的“样品”，看 Zimm 图的网格怎样变形：分子量决定截距，回转半径决定沿角度的斜率，A₂ 决定沿浓度的斜率。光学条件按聚苯乙烯在甲苯里（n₀ 1.496，λ 658 nm）取。`, `Model calculation: data at four concentrations and nine angles generated from the Zimm equation (with a fixed 0.3 % pseudo-random error), then fitted by least squares for M_w, R_g and A₂. Drag the three parameters to create a new "sample" and watch the Zimm grid change: molar mass sets the intercept, radius of gyration the slope along angle, A₂ the slope along concentration. Optics as for polystyrene in toluene (n₀ 1.496, λ 658 nm).`) },
      ],
      see: [['#m-dls', T(`动态光散射：流体力学半径`, `Dynamic light scattering: hydrodynamic radius`)], ['#m-sec', T(`尺寸排阻色谱`, `Size-exclusion chromatography`)], ['#m-saxs', T(`小角 X 射线散射（同一套方程，更短的波长）`, `Small-angle X-ray scattering (the same equations at shorter wavelength)`)]],
      refs: ['zimm1948', 'wyatt1993'],
    },
    {
      id: 'visc', fam: 'macro', abbr: '[η] · Mark–Houwink', name: T(`黏度法`, `Dilute-solution viscometry`),
      one: T(`高分子让溶液变稠，稠多少取决于每个分子在溶液里占的体积。测几种浓度下溶液流过毛细管的时间，外推到零浓度得到特性黏数 [η]，再用 Mark–Houwink 关系换成分子量。设备只是一支玻璃黏度计和一个恒温槽，是最便宜的分子量测定方法。`, `Polymers thicken solutions, and by how much depends on the volume each molecule occupies. Timing the flow of solutions of several concentrations through a capillary and extrapolating to zero concentration gives the intrinsic viscosity [η], which the Mark–Houwink relation turns into a molar mass. The equipment is a glass viscometer and a thermostat: the cheapest way to a molar mass.`),
      how: [
        T(`相对黏度 η_r = t / t₀（溶液和溶剂的流出时间之比，稀溶液里密度差可忽略），比黏度 η_sp = η_r − 1。Huggins（1942）：η_sp / c = [η] + k_H[η]²c；Kraemer：ln η_r / c = [η] − k_K[η]²c。两条线外推到 c = 0 交于同一点 [η]，单位 mL/g。良溶剂里 k_H 约 0.3–0.4，k_H + k_K ≈ 0.5 可以用来检查数据。`, `Relative viscosity η_r = t / t₀ (ratio of solution and solvent flow times; density differences are negligible in dilute solution), specific viscosity η_sp = η_r − 1. Huggins (1942): η_sp / c = [η] + k_H[η]²c; Kraemer: ln η_r / c = [η] − k_K[η]²c. Both lines extrapolate to the same intercept [η] at c = 0, in mL/g. In good solvents k_H is about 0.3–0.4, and k_H + k_K ≈ 0.5 is a check on the data.`),
        T(`Mark–Houwink 关系 [η] = K·M^a：a 反映分子的形状和溶剂，θ 溶剂里无规线团 a = 0.5，良溶剂里 0.6–0.8，刚性棒接近 1.8，致密球 0。K 和 a 对每一对“高分子 + 溶剂 + 温度”要用已知分子量的样品标定（手册里有表），得到的是黏均分子量 M_v，介于 M_n 和 M_w 之间，靠近 M_w。`, `The Mark–Houwink relation [η] = K·M^a: a reflects shape and solvent, being 0.5 for random coils in a θ solvent, 0.6–0.8 in good solvents, near 1.8 for rigid rods and 0 for compact spheres. K and a must be calibrated with samples of known mass for each polymer–solvent–temperature combination (handbooks tabulate them); the result is the viscosity-average M_v, between M_n and M_w and close to M_w.`),
      ],
      axes: T(`横轴是浓度 c（g/mL），纵轴是 η_sp/c 和 ln η_r/c（mL/g），两条直线外推到 c = 0。`, `Horizontal: concentration c (g/mL); vertical: η_sp/c and ln η_r/c (mL/g), two lines extrapolated to c = 0.`),
      tells: [
        T(`黏均分子量（有 K、a 时），分子在溶液里的大小和形状、溶剂的好坏。`, `Viscosity-average molar mass (given K and a), the size and shape of molecules in solution, solvent quality.`),
        T(`在 SEC 里接黏度检测器做“普适校准”：[η]·M 正比于流体力学体积，不同高分子可以共用一条校准线。`, `With a viscosity detector on SEC, "universal calibration": [η]·M is proportional to hydrodynamic volume, so different polymers share one calibration line.`),
      ],
      sample: T(`几毫克到几十毫克的高分子配成约 0.1–1 g/dL 的系列浓度，过滤；Ubbelohde 黏度计放在 ±0.02 °C 的恒温槽里，溶剂流出时间最好超过 100 s。`, `Milligrams to tens of milligrams of polymer made into a series of about 0.1–1 g/dL, filtered; an Ubbelohde viscometer in a bath held to ±0.02 °C, with solvent flow times preferably above 100 s.`),
      nums: [
        [T(`Mark–Houwink 指数 a`, `Mark–Houwink exponent a`), T(`θ 溶剂 0.5 · 良溶剂 0.6–0.8 · 刚性棒约 1.8 · 致密球 0`, `θ solvent 0.5 · good solvent 0.6–0.8 · rigid rod about 1.8 · compact sphere 0`)],
        [T(`Huggins 常数`, `Huggins constant`), T(`良溶剂约 0.3–0.4，θ 溶剂约 0.5–0.8`, `About 0.3–0.4 in good solvents, 0.5–0.8 in θ solvents`)],
        [T(`合适的浓度`, `Suitable concentrations`), T(`η_r 在约 1.1–2 之间（太稀误差大，太浓偏离直线）`, `η_r between about 1.1 and 2 (too dilute is imprecise, too concentrated curves)`)],
      ],
      read: [
        T(`把 Huggins 和 Kraemer 两条线画在同一张图上，确认它们交于纵轴上的同一点。`, `Plot the Huggins and Kraemer lines together and check they meet at the same intercept.`),
        T(`用对应体系的 K、a 换算 M_v；没有现成参数时只能说“[η] 变大了”，不要硬算分子量。`, `Convert to M_v with K and a for that system; without them, report only that [η] increased rather than force a molar mass.`),
      ],
      traps: [
        T(`聚电解质在低盐溶液里 η_sp/c 随稀释反而上升（链因电荷排斥伸展），不能直接外推；要加盐压住静电作用。`, `Polyelectrolytes in low salt show η_sp/c rising on dilution (chains stretch by charge repulsion) and cannot be extrapolated directly; add salt to screen the charges.`),
        T(`K、a 只在标定它们的分子量范围和同样的支化程度下有效；支化高分子同样分子量的 [η] 更小。`, `K and a hold only over the molar-mass range and degree of branching used to calibrate them; branched polymers of equal mass have smaller [η].`),
      ],
      figs: [
        { gen: 'visc', cap: T(`模型计算：按 Huggins 关系生成五个浓度的相对黏度，画出 Huggins 和 Kraemer 两条线并外推到零浓度。K、a 是示例参数（K = 0.011 mL/g，a = 0.725，良溶剂里柔性链的典型量级），不对应某个具体体系；换算出的 M_v 只用来演示方法。`, `Model calculation: relative viscosities at five concentrations generated from the Huggins relation, with the Huggins and Kraemer lines extrapolated to zero concentration. K and a are example values (K = 0.011 mL/g, a = 0.725, typical magnitudes for a flexible chain in a good solvent), not a specific system; the resulting M_v only demonstrates the method.`) },
      ],
      see: [['#m-mals', T(`光散射：绝对分子量`, `Light scattering: absolute molar mass`)], ['#m-sec', T(`尺寸排阻色谱与普适校准`, `Size-exclusion chromatography and universal calibration`)], ['#m-dma', T(`动态力学分析：熔体和固体的黏弹性`, `Dynamic mechanical analysis: viscoelasticity of melts and solids`)]],
      refs: ['huggins1942'],
    },
    {
      id: 'auc', fam: 'macro', abbr: 'AUC · SV · SE', name: T(`分析超速离心`, `Analytical ultracentrifugation`),
      one: T(`把溶液以每分钟几万转离心，用光学系统实时看分子沉下去的过程。沉降速度给出沉降系数，结合扩散系数用 Svedberg 方程算出分子量；也能直接在溶液里看到单体、二聚体和聚集体各占多少。这是测溶液里大分子分子量和寡聚状态的一手方法。`, `A solution spun at tens of thousands of revolutions per minute is watched optically as the molecules sediment. The sedimentation rate gives the sedimentation coefficient, and with the diffusion coefficient the Svedberg equation gives the molar mass; monomers, dimers and aggregates can be seen and quantified directly in solution. It is a first-principles method for the mass and oligomeric state of macromolecules in solution.`),
      how: [
        T(`离心场里一个分子受到的离心力、浮力和摩擦力平衡时，沉降速度和离心加速度之比是常数，就是沉降系数 s = v / ω²r，单位 Svedberg（1 S = 10⁻¹³ s）。分子量越大、越致密，s 越大；同时分子还在扩散，扩散系数 D = RT / (N_A f)。两者合起来消掉未知的摩擦系数 f：M = sRT / [D(1 − v̄ρ)]（Svedberg 方程），v̄ 是偏微比容（蛋白约 0.73 mL/g），ρ 是溶液密度。`, `When centrifugal force, buoyancy and friction on a molecule balance, the ratio of sedimentation velocity to centrifugal acceleration is constant: the sedimentation coefficient s = v / ω²r, in Svedberg units (1 S = 10⁻¹³ s). Larger, more compact molecules have larger s; meanwhile they diffuse with D = RT / (N_A f). Combining the two eliminates the unknown friction coefficient f: M = sRT / [D(1 − v̄ρ)] (the Svedberg equation), with v̄ the partial specific volume (about 0.73 mL/g for proteins) and ρ the solution density.`),
        T(`沉降速度（SV）实验：开始时浓度均匀，离心后弯月面附近的溶质被清空，形成一个向外移动的界面，界面的位置按 r_b = r_m·exp(ω²st) 外移，宽度随扩散变宽，平台浓度因径向稀释下降。每隔几分钟扫描一次吸光度或干涉条纹，用 Lamm 方程拟合全部扫描（SEDFIT 的 c(s) 分布，Schuck 2000），得到沉降系数的分布。沉降平衡（SE）实验转速较低，等沉降和扩散平衡后浓度沿半径呈指数分布，直接给出分子量，和形状无关。`, `Sedimentation velocity (SV): starting from uniform concentration, the solute clears from the meniscus and forms a boundary that moves outwards as r_b = r_m·exp(ω²st), broadening by diffusion, while the plateau concentration falls by radial dilution. Absorbance or interference scans every few minutes are fitted with the Lamm equation (the c(s) distribution of SEDFIT, Schuck 2000) to give a distribution of sedimentation coefficients. Sedimentation equilibrium (SE) at lower speed waits until sedimentation and diffusion balance; the concentration then varies exponentially with radius and gives the molar mass directly, independent of shape.`),
      ],
      axes: T(`扫描：半径（cm）对吸光度或干涉条纹；每条曲线是一个时刻。c(s) 分布：沉降系数（S）对浓度。`, `Scans: radius (cm) against absorbance or interference fringes, one curve per time. c(s) distribution: sedimentation coefficient (S) against concentration.`),
      tells: [
        T(`溶液里的寡聚状态和各组分比例、聚集体含量（抗体药物的质控常用）。`, `Oligomeric state and proportions of species in solution, and aggregate content (common in quality control of antibody drugs).`),
        T(`分子量（Svedberg 方程或沉降平衡）、形状（由 s 和分子量算出的摩擦比 f/f₀）、相互作用的平衡常数。`, `Molar mass (Svedberg equation or sedimentation equilibrium), shape (frictional ratio f/f₀ from s and mass) and equilibrium constants of interactions.`),
      ],
      sample: T(`约 400 μL，吸光度 0.1–1（280 nm），和参比缓冲液装在双扇形样品池里；缓冲液的密度和黏度要知道（可以由组成算出）。`, `About 400 μL at an absorbance of 0.1–1 (280 nm), loaded in a double-sector cell with reference buffer; the buffer's density and viscosity must be known (they can be computed from composition).`),
      nums: [
        [T(`牛血清白蛋白（BSA）`, `Bovine serum albumin (BSA)`), T(`s₂₀,w 约 4.3 S，D 约 5.9 × 10⁻⁷ cm²/s，v̄ 0.734 mL/g → M 约 66 kg/mol`, `s₂₀,w about 4.3 S, D about 5.9 × 10⁻⁷ cm²/s, v̄ 0.734 mL/g → M about 66 kg/mol`)],
        [T(`转速和加速度`, `Speed and acceleration`), T(`50 000 rpm、半径 6.5 cm 处约 18 万 g`, `50 000 rpm at 6.5 cm radius is about 180 000 g`)],
        [T(`常见沉降系数`, `Typical sedimentation coefficients`), T(`溶菌酶约 1.9 S · IgG 约 6.5–7 S · 核糖体 70S · 大肠杆菌核糖体亚基 30S、50S`, `Lysozyme about 1.9 S · IgG about 6.5–7 S · ribosome 70S · E. coli subunits 30S and 50S`)],
      ],
      read: [
        T(`看界面是否清楚、是否只有一个：多个台阶说明有多个组分；拟合得到的 c(s) 里每个峰是一个组分。`, `Check whether the boundary is sharp and single: several steps mean several species; each peak of the fitted c(s) is one species.`),
        T(`把 s 换成标准条件（20 °C 的水，s₂₀,w）再和文献比较。`, `Convert s to standard conditions (water at 20 °C, s₂₀,w) before comparing with the literature.`),
      ],
      traps: [
        T(`s 依赖浓度（分子间的流体力学相互作用让 s 随浓度降低）和非理想性；要外推到零浓度。`, `s depends on concentration (hydrodynamic interactions lower it as concentration rises) and on non-ideality; extrapolate to zero concentration.`),
        T(`v̄ 的误差被 (1 − v̄ρ) 放大约三倍：v̄ 错 1 %，分子量错约 3 %；糖蛋白和膜蛋白–去垢剂复合物的 v̄ 要单独算。`, `Errors in v̄ are amplified about threefold by (1 − v̄ρ): 1 % in v̄ gives about 3 % in mass; glycoproteins and membrane-protein–detergent complexes need their own v̄.`),
      ],
      figs: [
        { gen: 'auc', cap: T(`模型计算（近似的 Faxén 解）：牛血清白蛋白在 50 000 rpm 下的沉降速度扫描，每 20 分钟一条。界面位置按 r_m·exp(ω²st) 外移，宽度由扩散给出，平台按径向稀释降低。拖动 s 和 D 看界面走多快、散多宽，右侧用 Svedberg 方程算出分子量；预设的 s、D 是 BSA 的近似文献值。这个近似忽略了弯月面和池底附近的边界效应，不是 Lamm 方程的完整数值解。`, `Model calculation (approximate Faxén solution): sedimentation-velocity scans of bovine serum albumin at 50 000 rpm, one every 20 minutes. The boundary moves as r_m·exp(ω²st), broadens by diffusion, and the plateau falls by radial dilution. Drag s and D to see how fast the boundary moves and how wide it spreads; the readout applies the Svedberg equation. The preset s and D are approximate literature values for BSA. The approximation ignores edge effects near the meniscus and the cell bottom; it is not a full numerical solution of the Lamm equation.`) },
      ],
      see: [['#m-dls', T(`动态光散射：扩散系数`, `Dynamic light scattering: diffusion coefficient`)], ['#m-mals', T(`光散射`, `Light scattering`)], ['#m-sec', T(`尺寸排阻色谱`, `Size-exclusion chromatography`)]],
      refs: ['lebowitz2002', 'schuck2000'],
    },
    {
      id: 'dsf', fam: 'macro', abbr: 'DSF · nanoDSF · TSA', name: T(`热迁移分析（差示扫描荧光）`, `Thermal shift assay (differential scanning fluorimetry)`),
      one: T(`一边升温一边看蛋白质的荧光：疏水染料在蛋白去折叠、疏水核心暴露时荧光变强（或者直接看色氨酸荧光的变化），曲线中点就是熔点 Tm。结合了配体的蛋白更稳定，Tm 升高几度。在 PCR 仪里一次能测几百个样品，是药物筛选和缓冲液优化的常用方法。`, `Protein fluorescence is followed while heating: a hydrophobic dye brightens as the protein unfolds and exposes its core (or the intrinsic tryptophan fluorescence changes), and the midpoint is the melting temperature Tm. Ligand-bound protein is more stable and its Tm rises by a few degrees. A real-time PCR instrument measures hundreds of samples at once, making it a standard tool for ligand screening and buffer optimisation.`),
      how: [
        T(`两态模型：天然态 N 和去折叠态 U 平衡，ΔG_u(T) = ΔH_m(1 − T/T_m) + ΔC_p[T − T_m − T·ln(T/T_m)]，去折叠的比例 f_u = K/(1 + K)，K = exp(−ΔG_u/RT)。ΔH_m 越大，转变越陡。荧光信号是两态信号按 f_u 的加权和，加上两条随温度漂移的基线；对温度求导，峰顶就是 Tm。`, `Two-state model: native N and unfolded U are in equilibrium with ΔG_u(T) = ΔH_m(1 − T/T_m) + ΔC_p[T − T_m − T·ln(T/T_m)], the unfolded fraction f_u = K/(1 + K) and K = exp(−ΔG_u/RT). Larger ΔH_m means a steeper transition. The fluorescence is the f_u-weighted sum of the two states' signals plus two temperature-dependent baselines; its derivative peaks at Tm.`),
        T(`配体只和天然态结合时，天然态被稳定：ΔG_u 增加 RT·ln(1 + [L]/K_d)，曲线整体右移。ΔTm 大致随 ln(1 + [L]/K_d) 增加，所以 Tm 的移动能用来排序配体，但要换算成结合常数需要知道 ΔH 和 ΔC_p（Niesen 等 2007 给了做法）。纳米 DSF（nanoDSF）看色氨酸在 330 和 350 nm 两处荧光之比，不需要染料。`, `If a ligand binds only the native state it stabilises it: ΔG_u gains RT·ln(1 + [L]/K_d) and the curve shifts right. ΔTm grows roughly with ln(1 + [L]/K_d), so Tm shifts can rank ligands, but converting them to binding constants needs ΔH and ΔC_p (Niesen and co-workers described how in 2007). nanoDSF follows the ratio of tryptophan fluorescence at 330 and 350 nm and needs no dye.`),
      ],
      axes: T(`横轴是温度（°C），纵轴是荧光强度（或 350/330 比值）和它对温度的一阶导数。`, `Horizontal: temperature (°C); vertical: fluorescence (or the 350/330 ratio) and its first derivative.`),
      tells: [
        T(`蛋白质的热稳定性 Tm；哪些缓冲液、pH、添加剂让它更稳定（结晶和储存前的筛选）。`, `Thermal stability Tm, and which buffers, pH values and additives stabilise the protein (screening before crystallisation and storage).`),
        T(`配体是否结合（ΔTm 为正）；高通量地从几百个化合物里找出结合的。`, `Whether a ligand binds (positive ΔTm); high-throughput finding of binders among hundreds of compounds.`),
      ],
      sample: T(`每孔约 1–5 μM 蛋白、几微升到二十微升，加 SYPRO Orange 之类的染料（nanoDSF 不用），每分钟升温约 1 °C。`, `About 1–5 μM protein in a few to twenty microlitres per well with a dye such as SYPRO Orange (none for nanoDSF), heated at about 1 °C per minute.`),
      nums: [
        [T(`常见的 Tm`, `Typical Tm`), T(`多数可溶蛋白 40–80 °C`, `40–80 °C for most soluble proteins`)],
        [T(`有意义的 ΔTm`, `Meaningful ΔTm`), T(`一般要大于约 1–2 °C（重复实验的标准差约 0.2–0.5 °C）`, `Usually more than about 1–2 °C (replicate standard deviations about 0.2–0.5 °C)`)],
        [T(`两态模型的示例参数`, `Example two-state parameters`), T(`ΔH_m 400 kJ/mol，ΔC_p 8 kJ/(mol·K)：一个约 15 kDa 的小蛋白的量级`, `ΔH_m 400 kJ/mol, ΔC_p 8 kJ/(mol·K): the magnitude for a small protein of about 15 kDa`)],
      ],
      read: [
        T(`对每条曲线求导找峰顶，读 Tm；和不加配体的对照比，算 ΔTm。`, `Differentiate each curve, read Tm at the peak, and compute ΔTm against the ligand-free control.`),
        T(`看曲线形状：起始荧光就很高说明蛋白已部分去折叠或聚集；多个台阶说明有多个结构域分别去折叠。`, `Check the shape: high starting fluorescence means partly unfolded or aggregated protein; several steps mean domains unfolding separately.`),
      ],
      traps: [
        T(`去折叠后常常接着聚集，染料荧光在高温侧下降，这不是可逆的两态平衡；从这种曲线算 ΔH 不可靠。`, `Unfolding is often followed by aggregation and the dye signal falls at high temperature; this is not a reversible two-state equilibrium, and ΔH from such curves is unreliable.`),
        T(`有的配体本身有荧光或和染料作用，会给出假阳性；也有的配体结合去折叠态，让 Tm 降低。`, `Some ligands fluoresce or interact with the dye and give false positives; others bind the unfolded state and lower Tm.`),
      ],
      figs: [
        { gen: 'melt', cap: T(`模型计算（两态去折叠）：ΔH_m 400 kJ/mol、ΔC_p 8 kJ/(mol·K)、不加配体时 Tm = 55 °C。加入只和天然态结合的配体（K_d 和浓度可调），曲线右移，右侧给出新的 Tm 和 ΔTm。下图是荧光对温度的导数，峰顶就是 Tm。基线斜率和信号大小是示意的。`, `Model calculation (two-state unfolding): ΔH_m 400 kJ/mol, ΔC_p 8 kJ/(mol·K), Tm = 55 °C without ligand. Adding a ligand that binds only the native state (adjustable K_d and concentration) shifts the curve right; the readout gives the new Tm and ΔTm. Below, the derivative of fluorescence with temperature peaks at Tm. Baseline slopes and signal sizes are illustrative.`) },
      ],
      see: [['#m-dsc', T(`差示扫描量热（直接测 ΔH）`, `Differential scanning calorimetry (measures ΔH directly)`)], ['#m-itc', T(`等温滴定量热`, `Isothermal titration calorimetry`)], ['#m-fluor', T(`荧光光谱`, `Fluorescence spectroscopy`)], ['#m-cd', T(`圆二色谱的热变性曲线`, `Thermal melts by circular dichroism`)]],
      refs: ['pantoliano2001', 'niesen2007'],
    },
  );
})();
