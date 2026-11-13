'use strict';
// 谱图馆 · 热分析一族。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'tga', fam: 'thermal', core: true, abbr: 'TGA · DTG · TGA-MS', name: T(`热重分析`, `Thermogravimetric analysis`),
      one: T(`把几毫克样品放在一台灵敏的天平上，按程序升温，记下质量怎样随温度变化。失去结晶水、分解、烧掉有机物，每一步都是曲线上的一个台阶，台阶的高度就是这一步失去的质量分数。`, `A few milligrams of sample sit on a sensitive balance while the temperature is raised by programme and the mass is recorded. Loss of water of crystallisation, decomposition and burning off of organics each appear as a step in the curve, whose height is the mass fraction lost in that step.`),
      how: [
        T(`台阶的高度可以和化学计量直接对照。一水合草酸钙 CaC₂O₄·H₂O（摩尔质量 146.11）是经典的标样，在惰性气氛里分三步：约 100–200 °C 失去一分子水，剩 87.67 %（CaC₂O₄）；约 400–500 °C 失去一分子 CO，剩 68.50 %（CaCO₃）；约 650–800 °C 失去一分子 CO₂，剩 38.38 %（CaO）。实测的台阶和这三个数对得上，就说明仪器和样品都没问题。`, `Step heights can be compared directly with stoichiometry. Calcium oxalate monohydrate, CaC₂O₄·H₂O (molar mass 146.11), is the classic standard and decomposes in three steps under inert gas: at about 100–200 °C it loses one water, leaving 87.67 % (CaC₂O₄); at about 400–500 °C one CO, leaving 68.50 % (CaCO₃); at about 650–800 °C one CO₂, leaving 38.38 % (CaO). Measured steps that match these three numbers show that instrument and sample are in order.`),
        T(`质量对温度求导得到微商热重曲线（DTG），每个台阶变成一个峰：峰顶是失重最快的温度，挨得很近的两步在 DTG 上更容易分开。气氛决定发生什么反应：氮气里是热分解，空气或氧气里有机物和碳被烧掉。常用的办法是先在氮气里升到 600 °C（挥发分和聚合物分解），再切换成空气（烧掉炭黑），最后剩下的是无机填料或灰分。`, `Differentiating mass with respect to temperature gives the derivative curve (DTG), in which each step becomes a peak: its maximum is the temperature of fastest loss, and closely spaced steps separate more clearly. The atmosphere decides the chemistry: thermal decomposition under nitrogen, combustion of organics and carbon in air or oxygen. A common routine heats to 600 °C under nitrogen (volatiles and polymer decompose), then switches to air (carbon black burns), and what remains is inorganic filler or ash.`),
        T(`热重只知道“轻了多少”，不知道“跑掉的是什么”。把逸出的气体通进质谱（TGA-MS）或红外气体池（TGA-FTIR），就能在每个台阶上直接看到 m/z 18（水）、28（CO）、44（CO₂），把失重和具体的反应对上号。`, `Thermogravimetry knows how much mass was lost, not what left. Leading the evolved gas into a mass spectrometer (TGA-MS) or an infrared gas cell (TGA-FTIR) shows m/z 18 (water), 28 (CO) and 44 (CO₂) at each step and ties the loss to a specific reaction.`),
      ],
      axes: T(`横轴是温度（°C），纵轴是剩余质量（%）。DTG 的纵轴是失重速率（%/°C 或 %/min）。`, `Temperature (°C) against remaining mass (%). The DTG ordinate is the rate of loss (%/°C or %/min).`),
      tells: [
        T(`含多少水或溶剂、多少有机配体、多少无机残留：水合物的结晶水数目、MOF 的溶剂含量、纳米颗粒表面配体的包覆量、复合材料的填料含量。`, `How much water or solvent, organic ligand and inorganic residue: the number of waters in a hydrate, solvent content of a MOF, ligand coverage on nanoparticles, filler content of a composite.`),
        T(`热稳定性：从哪个温度开始分解（常报告失重 5 % 的温度 T_d5）。`, `Thermal stability: where decomposition begins (commonly reported as the temperature of 5 % loss, T_d5).`),
        T(`分解动力学：用几个不同的升温速率测，按等转化率法求活化能，或者按 Kissinger 法由峰温随升温速率的移动来求。`, `Decomposition kinetics: measurements at several heating rates give activation energies by isoconversional methods, or by the Kissinger method from the shift of the peak temperature with heating rate.`),
      ],
      sample: T(`5–20 mg，放在氧化铝或铂坩埚里，升温速率常用 10 °C/min，吹扫气 20–100 mL/min。样品量太大或升温太快会让台阶向高温移动、彼此糊在一起。`, `5–20 mg in an alumina or platinum crucible, commonly at 10 °C/min with 20–100 mL/min of purge gas. Too much sample or too fast a ramp shifts steps to higher temperature and smears them together.`),
      nums: [
        [T(`CaC₂O₄·H₂O 的三个平台`, `The three plateaus of CaC₂O₄·H₂O`), T(`87.67 %，68.50 %，38.38 %`, `87.67 %, 68.50 %, 38.38 %`)],
        [T(`CuSO₄·5H₂O 的失水`, `Dehydration of CuSO₄·5H₂O`), T(`分步失去 2 + 2 + 1 分子水，共 36.08 %`, `2 + 2 + 1 waters in steps, 36.08 % in all`)],
        [T(`天平灵敏度`, `Balance sensitivity`), T(`约 0.1 μg`, `About 0.1 μg`)],
        [T(`居里点温度标定`, `Curie-point temperature calibration`), T(`镍 358 °C`, `Nickel, 358 °C`)],
      ],
      read: [
        T(`对每个台阶量出失重百分数，换算成摩尔质量：失重 % × 样品的摩尔质量 / 100 = 这一步跑掉的质量（g/mol），再看它是几个 H₂O（18.02）、CO（28.01）、CO₂（44.01）还是别的。`, `Measure the percentage lost at each step and convert to molar mass: loss % × molar mass of the sample / 100 = the mass leaving per mole (g/mol), then see how many H₂O (18.02), CO (28.01), CO₂ (44.01) or other molecules that is.`),
        T(`台阶的起始温度用外推起始点（基线和台阶最陡处切线的交点）报告，比“肉眼看开始掉”稳定。`, `Report the onset as the extrapolated onset (where the baseline meets the tangent at the steepest part of the step), which is more reproducible than where the eye sees the curve begin to fall.`),
      ],
      traps: [
        T(`分解温度不是物质的常数。它随升温速率、样品量、坩埚形状、气氛和吹扫速率变化几十度；比较两个样品必须用同样的条件。`, `A decomposition temperature is not a constant of the substance. It moves by tens of degrees with heating rate, sample mass, crucible shape, atmosphere and purge rate; two samples can be compared only under the same conditions.`),
        T(`浮力效应：气体的密度随温度下降，空坩埚在升温时会“增重”几十微克。小的失重台阶要扣掉同样条件下的空白曲线。`, `Buoyancy: gas density falls with temperature and an empty crucible appears to gain tens of micrograms on heating. Small steps need subtraction of a blank run under the same conditions.`),
        T(`增重也是信息：金属在空气里氧化、样品吸附气体。不要默认曲线只会往下走。`, `Mass gain is information too: metals oxidising in air, samples adsorbing gas. Do not assume that the curve can only go down.`),
      ],
      figs: [
        { gen: 'tga', args: { presets: [
          { name: T(`一水合草酸钙 CaC₂O₄·H₂O`, `Calcium oxalate monohydrate, CaC₂O₄·H₂O`), formulas: ['CaC2O4H2O', 'CaC2O4', 'CaCO3', 'CaO'], temps: [170, 480, 740], widths: [70, 60, 90], lost: ['H₂O', 'CO', 'CO₂'] },
          { name: T(`五水合硫酸铜 CuSO₄·5H₂O`, `Copper sulfate pentahydrate, CuSO₄·5H₂O`), formulas: ['CuSO4H10O5', 'CuSO4H6O3', 'CuSO4H2O', 'CuSO4', 'CuO'], temps: [85, 115, 245, 760], widths: [30, 30, 50, 110], lost: ['2 H₂O', '2 H₂O', 'H₂O', 'SO₃'] },
          { name: T(`碳酸氢钠 NaHCO₃`, `Sodium hydrogencarbonate, NaHCO₃`), formulas: ['Na2H2C2O6', 'Na2CO3'], temps: [150], widths: [60], lost: ['H₂O + CO₂'] }] },
          cap: T(`台阶高度由化学式的摩尔质量算出（准确）；台阶的温度位置和宽度是文献里的典型值，只作示意，真实的位置随升温速率和气氛变化。下面的细线是微商曲线 DTG。`, `Step heights are calculated from the molar masses of the formulas (exact); the temperatures and widths of the steps are typical literature values for illustration, and real positions depend on heating rate and atmosphere. The thin line below is the derivative curve, DTG.`) },
      ],
      see: [['#m-dsc', T(`差示扫描量热`, `Differential scanning calorimetry`)], ['#m-ei', T(`质谱：逸出气体是什么`, `Mass spectrometry: what the evolved gas is`)]],
      refs: ['vyazovkin2011', 'kissinger1957'],
    },
    {
      id: 'dsc', fam: 'thermal', core: true, abbr: 'DSC · DTA', name: T(`差示扫描量热`, `Differential scanning calorimetry`),
      one: T(`让样品和一个空的参比坩埚按同样的程序升温，测两边的热流差。样品熔化、结晶、发生玻璃化转变或化学反应时要吸热或放热，曲线上就出现峰或台阶。峰的位置是转变温度，峰的面积是转变的焓。`, `Sample and an empty reference pan follow the same temperature programme while the difference in heat flow is measured. Melting, crystallisation, the glass transition or a chemical reaction absorbs or releases heat and appears as a peak or a step. Peak position is the transition temperature and peak area the enthalpy of transition.`),
      how: [
        T(`没有转变发生时，热流正比于样品的热容和升温速率：dq/dt = m·c_p·β。三类特征：一、玻璃化转变（T_g）是基线上的一个台阶，因为从玻璃态到橡胶态热容突然增大，没有潜热；二、熔融是吸热峰，峰面积除以样品质量是熔化焓；三、结晶、固化、氧化分解是放热峰。无定形的聚对苯二甲酸乙二醇酯（PET）在一次升温里三样都有：约 75–80 °C 的玻璃化台阶，约 130–150 °C 的冷结晶放热峰，约 250–255 °C 的熔融吸热峰。`, `With no transition in progress the heat flow is proportional to heat capacity and heating rate: dq/dt = m·c_p·β. Three kinds of feature: first, the glass transition (T_g) is a step in the baseline, because heat capacity rises abruptly from glass to rubber with no latent heat; second, melting is an endothermic peak whose area divided by the sample mass is the enthalpy of fusion; third, crystallisation, curing and oxidative decomposition are exothermic peaks. Amorphous poly(ethylene terephthalate) (PET) shows all three in one heating run: the glass-transition step at about 75–80 °C, the exothermic cold-crystallisation peak at about 130–150 °C and the endothermic melting peak at about 250–255 °C.`),
        T(`结晶度由熔化焓得到：X_c = (ΔH_m − ΔH_cc) / ΔH_m°，ΔH_cc 是升温过程中冷结晶放出的热，要扣掉；ΔH_m° 是 100 % 结晶的聚合物的熔化焓（PET 约 140 J/g，聚乙烯约 293 J/g）。纯度也能测：杂质使熔点降低、熔程变宽（van't Hoff 方程），对纯度高于约 98 % 的结晶化合物，由熔融峰的形状可以算出杂质的摩尔分数。`, `Crystallinity follows from the enthalpy of fusion: X_c = (ΔH_m − ΔH_cc) / ΔH_m°, where ΔH_cc, the heat released by cold crystallisation during heating, is subtracted and ΔH_m° is the enthalpy of fusion of the 100 % crystalline polymer (about 140 J/g for PET, 293 J/g for polyethylene). Purity is measurable too: impurities lower the melting point and broaden the melting range (the van't Hoff equation), and for crystalline compounds purer than about 98 % the shape of the melting peak gives the mole fraction of impurity.`),
        T(`温度和热量都要用标准物质标定：铟的熔点 156.60 °C、熔化焓约 28.6 J/g 是最常用的一个点。调制式 DSC 在线性升温上叠加一个小的正弦温度波动，把热流分成“可逆”（热容，如玻璃化转变）和“不可逆”（动力学过程，如焓松弛、冷结晶、固化）两部分，重叠在一起的转变就能分开。`, `Both temperature and heat are calibrated with reference materials: indium, melting at 156.60 °C with an enthalpy of fusion of about 28.6 J/g, is the commonest point. Modulated DSC superimposes a small sinusoidal temperature oscillation on the linear ramp and separates the heat flow into a reversing part (heat capacity, such as the glass transition) and a non-reversing part (kinetic processes such as enthalpy relaxation, cold crystallisation and curing), resolving overlapped transitions.`),
      ],
      axes: T(`横轴是温度（°C），纵轴是热流（W/g 或 mW）。吸热峰朝上还是朝下，不同厂家的习惯相反，图上必须标明“吸热向上”或“放热向上”。`, `Temperature (°C) against heat flow (W/g or mW). Whether endothermic peaks point up or down differs between manufacturers, and the figure must be marked "endo up" or "exo up".`),
      tells: [
        T(`熔点、熔化焓、玻璃化转变温度、结晶温度、结晶度；药物的晶型（不同晶型熔点不同）和无定形含量。`, `Melting point, enthalpy of fusion, glass-transition temperature, crystallisation temperature and crystallinity; polymorphs of drugs (which melt at different temperatures) and amorphous content.`),
        T(`热固性树脂的固化程度（残余固化放热）、氧化诱导期、比热容。`, `The degree of cure of thermosets (residual cure exotherm), oxidation induction time, specific heat capacity.`),
        T(`蛋白质的热变性温度（微量 DSC）、脂质膜的相变。`, `Thermal denaturation temperatures of proteins (microcalorimetric DSC), phase transitions of lipid membranes.`),
      ],
      sample: T(`3–10 mg，压在铝坩埚里，底部要和坩埚贴平。常用 10 °C/min、氮气。聚合物通常做“升温–降温–再升温”：第一次升温反映加工历史，第二次升温反映材料本身。`, `3–10 mg crimped in an aluminium pan, flat against its base. Commonly 10 °C/min under nitrogen. Polymers are usually run heat–cool–heat: the first heating reflects processing history, the second the material itself.`),
      nums: [
        [T(`铟（标定）`, `Indium (calibration)`), T(`156.60 °C，约 28.6 J/g`, `156.60 °C, about 28.6 J/g`)],
        [T(`水`, `Water`), T(`0.00 °C，334 J/g`, `0.00 °C, 334 J/g`)],
        [T(`几种聚合物的 T_g`, `T_g of some polymers`), T(`聚苯乙烯约 100 °C，PMMA 约 105 °C，聚碳酸酯约 147 °C`, `Polystyrene about 100 °C, PMMA about 105 °C, polycarbonate about 147 °C`)],
        [T(`几种聚合物的 T_m`, `T_m of some polymers`), T(`高密度聚乙烯约 135 °C，等规聚丙烯约 165 °C，尼龙 66 约 265 °C，PTFE 约 327 °C`, `HDPE about 135 °C, isotactic polypropylene about 165 °C, nylon 6,6 about 265 °C, PTFE about 327 °C`)],
      ],
      read: [
        T(`纯物质的熔点读外推起始温度（峰前沿切线和基线的交点），不读峰顶：峰顶温度随样品量和升温速率变化。聚合物熔程宽，习惯上报峰顶。`, `For a pure substance read the melting point as the extrapolated onset (where the tangent to the leading edge meets the baseline), not the peak maximum, which shifts with sample mass and heating rate. Polymers melt over a range and the peak maximum is conventionally reported.`),
        T(`T_g 取台阶的中点。玻璃化台阶上常叠着一个小的吸热峰（焓松弛），是样品在 T_g 以下放置老化留下的，不是熔融。`, `T_g is taken at the midpoint of the step. A small endothermic peak often sits on the step (enthalpy relaxation), left by ageing below T_g; it is not melting.`),
      ],
      traps: [
        T(`T_g 不是热力学转变温度，它随升温速率变化（升得越快测得越高，每 10 倍速率约差 3–5 °C），也随含水量明显下降。报告时要写速率和取点方法。`, `T_g is not a thermodynamic transition temperature: it depends on heating rate (the faster, the higher, by about 3–5 °C per decade) and falls markedly with water content. Rate and evaluation method must be reported.`),
        T(`伴有失重的过程（溶剂挥发、分解）在开口坩埚里表现为宽的吸热峰，容易被当成熔融。先看热重曲线，确认这个温度没有失重。`, `Processes with mass loss (solvent evaporation, decomposition) appear in an open pan as broad endotherms easily taken for melting. Check the thermogravimetric curve first to confirm that there is no loss at that temperature.`),
        T(`样品在升温过程中自己会变：熔融后重结晶成更稳定的晶型、边熔边分解。看到的双熔融峰不一定是两种晶型，可能是测量过程中生成的。换一个升温速率再测就能分辨。`, `Samples change during heating: melting followed by recrystallisation into a more stable form, or melting with decomposition. A double melting peak need not mean two polymorphs; it may form during the measurement, which a second run at another heating rate reveals.`),
      ],
      figs: [
        { gen: 'dsc', cap: T(`示意：淬冷的无定形 PET 的升温曲线（吸热向上）。玻璃化台阶约在 78 °C，冷结晶放热峰约在 135 °C，熔融吸热峰约在 252 °C。转变温度是文献里的典型值，曲线形状是示意的。拖动“原有结晶度”：结晶度越高，冷结晶峰越小，玻璃化台阶也越矮；熔融峰减去冷结晶峰的面积才是样品原有的结晶。`, `Schematic: the heating curve of quenched amorphous PET (endo up). The glass-transition step lies near 78 °C, the exothermic cold-crystallisation peak near 135 °C and the endothermic melting peak near 252 °C. Transition temperatures are typical literature values; the curve shape is illustrative. Vary the initial crystallinity: the higher it is, the smaller the cold-crystallisation peak and the lower the glass-transition step; the original crystallinity is the area of the melting peak less that of the cold-crystallisation peak.`) },
      ],
      see: [['#m-tga', T(`热重分析`, `Thermogravimetric analysis`)], ['#m-dma', T(`动态力学分析`, `Dynamic mechanical analysis`)], ['#m-pxrd', T(`粉末衍射：晶型和结晶度的另一种测法`, `Powder diffraction: another route to polymorph and crystallinity`)]],
      refs: ['watson1964', 'vyazovkin2011'],
    },
    {
      id: 'dma', fam: 'thermal', abbr: 'DMA · DMTA', name: T(`动态力学分析`, `Dynamic mechanical analysis`),
      one: T(`给样品加一个小的正弦形变，测它的应力响应：同相的部分是弹性（储能模量），落后 90° 的部分是粘性（损耗模量）。边升温边测，玻璃化转变时模量掉两三个数量级，损耗出现一个峰。它对玻璃化和次级转变的灵敏度比 DSC 高十到一百倍。`, `A small sinusoidal deformation is applied and the stress response measured: the in-phase part is elastic (the storage modulus), the part lagging by 90° viscous (the loss modulus). During a temperature ramp the modulus drops by two to three orders of magnitude at the glass transition and the loss shows a peak. It is ten to a hundred times more sensitive than DSC to the glass transition and to secondary transitions.`),
      how: [
        T(`应变 ε = ε₀·sin(ωt)，应力 σ = σ₀·sin(ωt + δ)。储能模量 E′ = (σ₀/ε₀)·cos δ，损耗模量 E″ = (σ₀/ε₀)·sin δ，损耗因子 tan δ = E″ / E′。理想弹性体 δ = 0，理想粘性流体 δ = 90°，聚合物介于两者之间（粘弹性）。无定形聚合物在玻璃态时 E′ 约 1–3 GPa；经过 T_g 降到橡胶平台的 1–10 MPa；没有交联的继续升温就流动，交联的保持平台，平台模量正比于交联密度（E′ ≈ 3νRT）。`, `Strain ε = ε₀·sin(ωt), stress σ = σ₀·sin(ωt + δ). The storage modulus is E′ = (σ₀/ε₀)·cos δ, the loss modulus E″ = (σ₀/ε₀)·sin δ and the loss factor tan δ = E″ / E′. An ideal elastic solid has δ = 0, an ideal viscous liquid δ = 90°, and polymers lie between (viscoelasticity). An amorphous polymer has E′ of about 1–3 GPa in the glass; through T_g it falls to a rubbery plateau of 1–10 MPa; uncrosslinked material then flows on further heating, while crosslinked material keeps the plateau, whose modulus is proportional to crosslink density (E′ ≈ 3νRT).`),
        T(`转变是一个松弛过程：链段运动的特征时间 τ 随温度升高急剧缩短，当 ωτ ≈ 1 时损耗最大。所以测量频率越高，转变出现的温度越高（每 10 倍频率约高 5–8 °C）。时间–温度等效原理把不同温度下测的频率扫描曲线沿对数频率轴平移，拼成一条跨十几个数量级的主曲线；平移因子在 T_g 以上遵守 WLF 方程：log a_T = −C₁(T − T_g) / (C₂ + T − T_g)，“普适”常数 C₁ = 17.44，C₂ = 51.6 K。`, `A transition is a relaxation: the characteristic time τ of segmental motion shortens steeply with temperature, and loss peaks where ωτ ≈ 1. The higher the measuring frequency, therefore, the higher the temperature at which the transition appears (about 5–8 °C per decade). Time–temperature superposition shifts frequency sweeps measured at different temperatures along the logarithmic frequency axis into a master curve spanning more than ten decades; above T_g the shift factor follows the WLF equation, log a_T = −C₁(T − T_g) / (C₂ + T − T_g), with the "universal" constants C₁ = 17.44 and C₂ = 51.6 K.`),
      ],
      axes: T(`横轴是温度（°C），左边的纵轴是 E′ 和 E″（Pa，对数），右边是 tan δ。`, `Temperature (°C) against E′ and E″ (Pa, logarithmic) on the left and tan δ on the right.`),
      tells: [
        T(`玻璃化转变温度，以及 DSC 看不到的次级转变（β、γ 松弛：侧基转动、局部链段运动），它们和材料的低温韧性有关。`, `The glass-transition temperature, and secondary transitions invisible to DSC (β and γ relaxations: side-group rotation, local chain motion), which relate to low-temperature toughness.`),
        T(`材料在使用温度下有多硬、阻尼多大；交联密度；共混物是否相容（一个 T_g 还是两个）；固化过程。`, `Stiffness and damping at service temperature; crosslink density; whether a blend is miscible (one T_g or two); the course of curing.`),
      ],
      sample: T(`形状规则的条、膜或纤维（如 30 × 10 × 1 mm），尺寸要量准，因为模量是由力、位移和几何尺寸算出来的。常用 1 Hz、2–3 °C/min，应变要在线性粘弹区内（通常小于 0.1 %）。`, `A regular bar, film or fibre (say 30 × 10 × 1 mm) of accurately measured dimensions, since modulus is computed from force, displacement and geometry. Commonly 1 Hz and 2–3 °C/min, with strain within the linear viscoelastic region (usually below 0.1 %).`),
      nums: [
        [T(`玻璃态模量`, `Glassy modulus`), T(`约 1–3 GPa`, `About 1–3 GPa`)],
        [T(`橡胶平台模量`, `Rubbery plateau modulus`), T(`约 1–10 MPa`, `About 1–10 MPa`)],
        [T(`WLF 常数（以 T_g 为参考）`, `WLF constants (referred to T_g)`), T(`C₁ = 17.44，C₂ = 51.6 K`, `C₁ = 17.44, C₂ = 51.6 K`)],
      ],
      read: [
        T(`同一个转变有三种读法：E′ 开始下降的起始点（最低，对应材料开始变软）、E″ 的峰顶、tan δ 的峰顶（最高）。三者可以相差 10–25 °C，报告时必须说明用的哪一种和测量频率。`, `One transition can be read three ways: the onset of the fall in E′ (lowest, where the material begins to soften), the peak of E″ and the peak of tan δ (highest). They can differ by 10–25 °C, and a report must state which was used and the frequency.`),
      ],
      traps: [
        T(`DMA 的 T_g 和 DSC 的 T_g 不是同一个数：tan δ 峰通常比 DSC 中点高 10–20 °C。两种方法的数值不能直接比较。`, `The T_g from DMA is not the T_g from DSC: the tan δ peak is typically 10–20 °C above the DSC midpoint. Values from the two methods cannot be compared directly.`),
        T(`模量的绝对值依赖夹具和样品尺寸，不同夹具（拉伸、三点弯曲、单悬臂）之间可以差百分之几十；转变温度和 tan δ 可靠得多。`, `Absolute moduli depend on clamps and sample dimensions and can differ by tens of per cent between geometries (tension, three-point bending, single cantilever); transition temperatures and tan δ are far more reliable.`),
      ],
      figs: [
        { gen: 'dma', cap: T(`模型计算：一个松弛过程（Cole–Cole 型，松弛时间按 WLF 方程随温度变化）给出的 E′、E″ 和 tan δ。把频率从 0.1 Hz 调到 100 Hz，转变整体向高温移动。模型的 T_g 设在 100 °C，玻璃态模量 3 GPa，橡胶平台 3 MPa；它只有一个转变，真实的聚合物还有次级松弛和流动区。`, `Model calculation: E′, E″ and tan δ of a single relaxation (of Cole–Cole type, with a relaxation time that follows the WLF equation). Raise the frequency from 0.1 Hz to 100 Hz and the whole transition moves to higher temperature. The model has T_g at 100 °C, a glassy modulus of 3 GPa and a rubbery plateau of 3 MPa; it contains one transition only, whereas real polymers also show secondary relaxations and a flow region.`) },
      ],
      see: [['#m-dsc', T(`差示扫描量热`, `Differential scanning calorimetry`)]],
      refs: ['williams1955'],
    },
    {
      id: 'tpd', fam: 'thermal', abbr: 'TPD · TPR · TPO', name: T(`程序升温脱附与还原`, `Temperature-programmed desorption and reduction`),
      one: T(`催化剂表征的一组常规实验。程序升温脱附：先让探针分子吸附在表面，再匀速升温，看它们在什么温度脱下来，脱附温度反映吸附的强弱，峰面积反映位点的数量。程序升温还原：在稀的氢气里升温，看金属氧化物在什么温度被还原、消耗多少氢。`, `A family of routine experiments in catalyst characterisation. Temperature-programmed desorption: probe molecules are adsorbed on the surface, the temperature is ramped linearly, and the temperature at which they leave reflects adsorption strength while the peak area counts sites. Temperature-programmed reduction: heated in dilute hydrogen, a metal oxide shows at what temperature it is reduced and how much hydrogen it consumes.`),
      how: [
        T(`一级脱附的速率是 −dθ/dt = ν·θ·exp(−E_d / RT)。匀速升温（T = T₀ + βt）时，温度升高使速率常数增大，覆盖度 θ 却在减小，两者相乘得到一个峰。峰温 T_p 满足 E_d / (R·T_p²) = (ν/β)·exp(−E_d / RT_p)；Redhead 的近似式是 E_d ≈ R·T_p·[ln(ν·T_p / β) − 3.64]，取指前因子 ν = 10¹³ s⁻¹ 就能由一个峰温估出脱附活化能。一级脱附的峰不对称（高温侧陡），峰温不随初始覆盖度变化；二级脱附（解离吸附的原子重新结合，如 H₂、O₂）的峰对称，覆盖度越高峰温越低。`, `The rate of first-order desorption is −dθ/dt = ν·θ·exp(−E_d / RT). Under a linear ramp (T = T₀ + βt) the rate constant grows while the coverage θ shrinks, and their product is a peak. The peak temperature T_p satisfies E_d / (R·T_p²) = (ν/β)·exp(−E_d / RT_p); Redhead's approximation, E_d ≈ R·T_p·[ln(ν·T_p / β) − 3.64], estimates the desorption energy from one peak temperature given a pre-exponential factor ν = 10¹³ s⁻¹. A first-order peak is asymmetric (steep on the high-temperature side) and does not move with initial coverage; a second-order peak (recombination of dissociated atoms, as for H₂ and O₂) is symmetric and moves to lower temperature at higher coverage.`),
        T(`常用的探针：氨（NH₃-TPD）测固体酸的酸量和酸强度，脱附温度越高酸性越强，沸石上通常分成约 200 °C 以下的弱酸峰和 350–450 °C 的强酸峰；CO₂-TPD 测碱性位；H₂-TPD 和 CO 脉冲化学吸附测金属的分散度。检测器用热导池，更好的是质谱，因为它能分清脱下来的是什么。`, `Common probes: ammonia (NH₃-TPD) measures the amount and strength of acid sites, a higher desorption temperature meaning stronger acidity, usually divided on zeolites into a weak-acid peak below about 200 °C and a strong-acid peak at 350–450 °C; CO₂-TPD measures basic sites; H₂-TPD and CO pulse chemisorption measure metal dispersion. Detection is by thermal conductivity or, better, by mass spectrometry, which tells what is actually desorbing.`),
        T(`程序升温还原（H₂-TPR）：5–10 % H₂/Ar 流过样品，氢被消耗时热导信号出峰。峰的温度反映氧化物有多容易还原（CuO 约 200–300 °C，NiO 约 300–400 °C，Fe₂O₃ 分几步一直到 700 °C 以上），和载体的相互作用越强，还原温度越高。峰面积用已知量的 CuO 标定（CuO + H₂ → Cu + H₂O），得到耗氢量，由此算出金属的平均价态变化。`, `Temperature-programmed reduction (H₂-TPR): 5–10 % H₂ in argon flows over the sample, and consumption of hydrogen gives a thermal-conductivity peak. Its temperature shows how easily the oxide is reduced (CuO at about 200–300 °C, NiO at about 300–400 °C, Fe₂O₃ in several steps up to beyond 700 °C); the stronger the interaction with the support, the higher the reduction temperature. Peak area calibrated with a known amount of CuO (CuO + H₂ → Cu + H₂O) gives the hydrogen consumed and hence the average change in oxidation state.`),
      ],
      axes: T(`横轴是温度（°C 或 K），纵轴是检测器信号（脱附速率或耗氢速率）。`, `Temperature (°C or K) against detector signal (rate of desorption or of hydrogen consumption).`),
      tells: [
        T(`酸性位或碱性位有多少、强度怎样分布；金属的分散度和活性表面积。`, `The number of acid or basic sites and their strength distribution; metal dispersion and active surface area.`),
        T(`氧化物的可还原性、金属与载体的相互作用、双金属是否形成合金（还原峰合并）、催化剂该在什么温度下预还原。`, `Reducibility of oxides, metal–support interaction, alloy formation in bimetallics (merged reduction peaks), and the temperature at which a catalyst should be pre-reduced.`),
      ],
      sample: T(`50–200 mg 粉末装在石英 U 形管里。吸附前先在惰性气体里高温吹扫，把表面的水和杂质赶走；吸附后在较低温度吹扫掉物理吸附的部分，再开始升温（常用 10 °C/min）。`, `50–200 mg of powder in a quartz U-tube. Before adsorption the surface is purged hot in inert gas to remove water and impurities; after adsorption the physisorbed part is purged away at lower temperature, and then the ramp begins (commonly 10 °C/min).`),
      nums: [
        [T(`Redhead 公式`, `Redhead equation`), T(`E_d ≈ R·T_p·[ln(ν·T_p / β) − 3.64]（ν/β 在 10⁸–10¹³ K⁻¹ 之间）`, `E_d ≈ R·T_p·[ln(ν·T_p / β) − 3.64] (for ν/β between 10⁸ and 10¹³ K⁻¹)`)],
        [T(`一个算例`, `A worked example`), T(`ν = 10¹³ s⁻¹、β = 10 K/min、E_d = 100 kJ/mol 时 T_p ≈ 355 K`, `With ν = 10¹³ s⁻¹, β = 10 K/min and E_d = 100 kJ/mol, T_p ≈ 355 K`)],
      ],
      read: [
        T(`有几个峰就大致有几类位点；峰温高的结合强。用质谱检测时，同时跟踪几个 m/z，确认每个峰确实是探针分子而不是它的分解产物或残留的水。`, `The number of peaks is roughly the number of kinds of site; a higher peak temperature means stronger binding. With mass-spectrometric detection, follow several m/z values to confirm that each peak is the probe molecule and not a decomposition product or residual water.`),
      ],
      traps: [
        T(`多孔粉末上的峰温不只由脱附能决定：分子在孔道里反复吸附再脱附、扩散受限，都会把峰推向高温并拉宽；峰温还随载气流速和样品量变化。粉末 TPD 给出的“酸强度”只能在同样条件下做相对比较，Redhead 公式严格说只适用于超高真空里的单晶表面。`, `On porous powders the peak temperature is not set by desorption energy alone: readsorption within the pores and diffusion limitation push peaks to higher temperature and broaden them, and the peak moves with carrier flow and sample mass. "Acid strength" from powder TPD supports only relative comparison under identical conditions; strictly, the Redhead equation applies to single-crystal surfaces in ultra-high vacuum.`),
        T(`NH₃-TPD 分不清 Brønsted 酸和 Lewis 酸，要配合吡啶吸附红外。热导检测器分不清氨和水，高温处的“强酸峰”有时是脱羟基生成的水。`, `NH₃-TPD cannot tell Brønsted from Lewis acidity, which needs infrared spectroscopy of adsorbed pyridine. A thermal-conductivity detector cannot tell ammonia from water, and a "strong-acid peak" at high temperature is sometimes water from dehydroxylation.`),
      ],
      figs: [
        { gen: 'tpd', cap: T(`由速率方程数值积分算出：一级脱附和二级脱附的程序升温脱附峰（ν = 10¹³ s⁻¹）。拖动脱附活化能和升温速率，看峰怎样移动；改变初始覆盖度，一级峰的位置不动，二级峰随覆盖度增大移向低温。虚线标出 Redhead 公式给的峰温。`, `From numerical integration of the rate equation: temperature-programmed desorption peaks for first- and second-order kinetics (ν = 10¹³ s⁻¹). Vary desorption energy and heating rate to see the peak move; change the initial coverage and the first-order peak stays put, while the second-order peak moves to lower temperature at higher coverage. The dashed line marks the peak temperature from the Redhead equation.`) },
      ],
      see: [['#m-ir', T(`红外：吡啶吸附区分两类酸性位`, `Infrared: adsorbed pyridine separates the two kinds of acid site`)], ['#m-bet', T(`气体吸附：比表面积与孔径`, `Gas adsorption: surface area and pore size`)]],
      refs: ['redhead1962'],
    },
  );
})();
