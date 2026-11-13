'use strict';
// 谱图馆 · 电化学一族。
(() => {
  const T = (zh, en) => ({ zh, en });
  (window.MOLASTRIA_SPECTRA_METHODS ||= []).push(
    {
      id: 'cv', fam: 'echem', core: true, abbr: 'CV', name: T(`循环伏安法`, `Cyclic voltammetry`),
      one: T(`把电极电位匀速扫过去再扫回来，记下电流怎样变化。一对氧化还原峰的位置给出式量电位，两个峰的间距和高度之比说明电子转移快不快、生成的物种稳不稳定。它是电化学里的“全谱扫描”，研究一个新分子的氧化还原性质通常从它开始。`, `Sweep the electrode potential at a constant rate out and back and record the current. The position of a pair of redox peaks gives the formal potential; their separation and height ratio show how fast electron transfer is and whether the product is stable. It is the survey scan of electrochemistry, and the usual first look at the redox behaviour of a new molecule.`),
      how: [
        T(`三电极体系：工作电极（玻碳、铂或金的圆盘，直径 1–3 mm）上发生要研究的反应，它的电位相对参比电极来控制，电流从对电极流过。溶液里加 0.1 mol/L 的支持电解质，让离子导电而待测分子只靠扩散到达电极。电位往正方向扫，表面的还原态被氧化，电流上升；电极附近的还原态很快耗尽，要靠越来越厚的扩散层供应，电流又落下来，于是出现一个峰。往回扫时，刚生成的氧化态被还原，出现方向相反的峰。`, `Three electrodes: the reaction of interest takes place at the working electrode (a glassy-carbon, platinum or gold disc of 1–3 mm), whose potential is controlled against a reference electrode while current flows through a counter electrode. A supporting electrolyte at 0.1 mol/L carries the ionic current so that the analyte reaches the electrode by diffusion alone. Sweeping positive oxidises the reduced form at the surface and the current rises; the reduced form near the electrode is soon depleted and has to be supplied through an ever thicker diffusion layer, the current falls again, and a peak results. On the return sweep the oxidised form just produced is reduced, giving a peak in the opposite direction.`),
        T(`电子转移足够快（可逆）时，电极表面始终满足 Nernst 方程，有四个判据：一、两个峰的间距 ΔE_p 约为 57/n mV（25 °C），不随扫描速率变化；二、两个峰电流之比为 1；三、峰电流正比于扫描速率的平方根；四、两个峰电位的平均值就是式量电位 E½。峰电流由 Randles–Ševčík 方程给出：i_p = 0.4463·nFAC·(nFvD/RT)^½，25 °C 时是 2.69 × 10⁵·n^(3/2)·A·D^(1/2)·C·v^(1/2)（A 用 cm²，D 用 cm²/s，C 用 mol/cm³，v 用 V/s）。`, `With fast (reversible) electron transfer the surface obeys the Nernst equation throughout, and four criteria hold: first, the peak separation ΔE_p is about 57/n mV (25 °C), independent of scan rate; second, the ratio of the two peak currents is 1; third, peak current is proportional to the square root of scan rate; fourth, the mean of the two peak potentials is the formal potential E½. Peak current follows the Randles–Ševčík equation, i_p = 0.4463·nFAC·(nFvD/RT)^½, which at 25 °C is 2.69 × 10⁵·n^(3/2)·A·D^(1/2)·C·v^(1/2) (A in cm², D in cm²/s, C in mol/cm³, v in V/s).`),
        T(`偏离这些判据就是信息。电子转移慢（准可逆）：ΔE_p 大于 57 mV，而且扫得越快越大，由此可以用 Nicholson 的方法求标准速率常数 k⁰。生成物不稳定（电子转移后跟着化学反应，EC 机理）：回扫的峰变小甚至消失，扫快一点它又回来，由此可以估计后续反应的速率。吸附在电极表面的物种：峰是对称的钟形，两峰重合（ΔE_p = 0），峰电流正比于扫描速率本身而不是它的平方根。`, `Departures from these criteria are information. Slow (quasi-reversible) electron transfer: ΔE_p exceeds 57 mV and grows with scan rate, from which Nicholson's method gives the standard rate constant k⁰. An unstable product (a chemical reaction following electron transfer, the EC mechanism): the return peak shrinks or vanishes and comes back at faster scan rates, which gauges the rate of the follow-up reaction. A species adsorbed on the electrode: symmetric bell-shaped peaks that coincide (ΔE_p = 0), with peak current proportional to scan rate itself, not to its square root.`),
      ],
      axes: T(`横轴是电位（V，必须写明相对哪个参比），纵轴是电流（A 或 μA）。有两种画法：IUPAC 惯例是正电位向右、氧化电流为正；美国（极谱）惯例正好相反，负电位向右、还原电流为正。读图之前先看清是哪一种。`, `Potential (V, always against a stated reference) against current (A or μA). There are two plotting conventions: under IUPAC, positive potentials are to the right and oxidation current is positive; the US (polarographic) convention is the opposite, with negative potentials to the right and reduction current positive. Find out which is used before reading a figure.`),
      tells: [
        T(`分子的氧化和还原电位，有几步、每步几个电子、是否可逆。`, `The oxidation and reduction potentials of a molecule, the number of steps, electrons per step and reversibility.`),
        T(`催化剂、电池材料、有机半导体的能级（由起始氧化和还原电位估算 HOMO 和 LUMO）。`, `Energy levels of catalysts, battery materials and organic semiconductors (HOMO and LUMO estimated from onset potentials).`),
        T(`扩散系数、电子转移速率常数、偶联化学反应的机理，以及电催化的起始电位。`, `Diffusion coefficients, electron-transfer rate constants, mechanisms of coupled chemical reactions, and onset potentials of electrocatalysis.`),
      ],
      sample: T(`约 1 mmol/L 的待测物，溶在含 0.1 mol/L 支持电解质的溶剂里（有机体系常用乙腈或二氯甲烷加 [NBu₄][PF₆]），5–10 mL。测前通氮气或氩气约 10 分钟除氧，电极用氧化铝粉抛光。最后加一点二茂铁做内标。`, `About 1 mmol/L of analyte in a solvent with 0.1 mol/L supporting electrolyte (acetonitrile or dichloromethane with [NBu₄][PF₆] for organic systems), 5–10 mL. Purge with nitrogen or argon for about 10 minutes to remove oxygen and polish the electrode with alumina. Finally add a little ferrocene as internal standard.`),
      nums: [
        [T(`可逆的峰间距（25 °C）`, `Reversible peak separation (25 °C)`), T(`约 57/n mV（和回扫电位略有关系，常写作 59/n mV）`, `About 57/n mV (slightly dependent on the switching potential; often written 59/n mV)`)],
        [T(`峰电位与 E½ 的距离`, `Peak potential relative to E½`), T(`28.5/n mV`, `28.5/n mV`)],
        [T(`参比电极（相对标准氢电极）`, `Reference electrodes (against SHE)`), T(`饱和甘汞 +0.241 V，Ag/AgCl（饱和 KCl）+0.197 V`, `Saturated calomel +0.241 V, Ag/AgCl (saturated KCl) +0.197 V`)],
        [T(`二茂铁（Fc⁺/Fc）`, `Ferrocene (Fc⁺/Fc)`), T(`乙腈 / [NBu₄][PF₆] 中约 +0.40 V（相对饱和甘汞）`, `About +0.40 V against SCE in acetonitrile / [NBu₄][PF₆]`)],
        [T(`一个算例`, `A worked example`), T(`n = 1，3 mm 圆盘（0.071 cm²），1 mmol/L，D = 10⁻⁵ cm²/s，0.1 V/s：i_p ≈ 19 μA`, `n = 1, a 3 mm disc (0.071 cm²), 1 mmol/L, D = 10⁻⁵ cm²/s, 0.1 V/s: i_p ≈ 19 μA`)],
      ],
      read: [
        T(`先找出成对的峰，读 E½ = (E_pa + E_pc) / 2 和 ΔE_p。再换几个扫描速率：ΔE_p 变不变？峰电流对 v^½ 是不是直线？回扫峰和正扫峰的比值变不变？`, `Find the paired peaks first and read E½ = (E_pa + E_pc) / 2 and ΔE_p. Then change the scan rate: does ΔE_p change? Is peak current linear in v^½? Does the ratio of return to forward peak change?`),
        T(`回扫峰的电流要从正扫电流衰减的延长线量起，不是从零电流线量起。`, `The return peak current is measured from the extrapolated decay of the forward current, not from zero current.`),
        T(`在非水溶剂里，电位一律换算成相对 Fc⁺/Fc 来报告；不同实验室的银丝准参比可以差零点几伏。`, `In non-aqueous solvents report potentials against Fc⁺/Fc; silver-wire pseudo-references differ between laboratories by tenths of a volt.`),
      ],
      traps: [
        T(`溶液电阻没有补偿（iR 降）会把两个峰拉开，看上去和电子转移慢一模一样。判断办法：降低浓度或换小电极，电流变小后峰间距缩回去，那就是 iR 降。`, `Uncompensated solution resistance (iR drop) pulls the peaks apart exactly as slow electron transfer does. The test: lower the concentration or use a smaller electrode; if the separation shrinks as the current falls, it was iR drop.`),
        T(`“电化学可逆”说的是电子转移相对扫描速率够快，不等于“化学可逆”（产物稳定、能变回去）。两者要分开说。`, `"Electrochemically reversible" means that electron transfer is fast relative to the scan rate; it is not the same as "chemically reversible" (a stable product that can be converted back). The two must be stated separately.`),
        T(`由氧化电位估算 HOMO 能级时，Fc⁺/Fc 相对真空的能量文献里有 4.8 eV 和 5.1 eV 两种取法，差 0.3 eV。比较不同论文的 HOMO 值之前，先看它们用的是哪个数。`, `In estimating HOMO energies from oxidation potentials, the literature places Fc⁺/Fc at either 4.8 eV or 5.1 eV below vacuum, a difference of 0.3 eV. Check which was used before comparing HOMO values between papers.`),
      ],
      figs: [
        { gen: 'cv', cap: T(`由扩散方程数值求解算出（可逆单电子对，电极表面满足 Nernst 方程；n = 1，0.071 cm² 圆盘，1 mmol/L，D = 10⁻⁵ cm²/s，IUPAC 画法）。五条曲线的扫描速率依次翻倍：峰电流按 v^½ 增长，峰电位不动，峰间距保持在约 58 mV。`, `From numerical solution of the diffusion equation (a reversible one-electron couple with a Nernstian surface; n = 1, a 0.071 cm² disc, 1 mmol/L, D = 10⁻⁵ cm²/s, IUPAC plotting). Scan rate doubles from each of the five curves to the next: peak currents grow as v^½, peak potentials stay put, and the separation remains at about 58 mV.`) },
      ],
      table: 'ref-electrodes',
      see: [['#lab-cv', T(`动手实验室：循环伏安`, `Hands-on lab: cyclic voltammetry`)], ['#m-rde', T(`旋转圆盘电极与 Tafel 分析`, `Rotating-disc electrode and Tafel analysis`)]],
      refs: ['nicholson1964', 'nicholson1965', 'elgrishi2018', 'connelly1996'],
    },
    {
      id: 'rde', fam: 'echem', abbr: 'LSV · RDE · Tafel', name: T(`线性扫描、旋转圆盘电极与 Tafel 分析`, `Linear sweep voltammetry, rotating-disc electrode and Tafel analysis`),
      one: T(`电催化研究的标准做法。让圆盘电极匀速旋转，把反应物以确定的速率送到表面，慢慢扫描电位，得到一条从动力学控制过渡到扩散极限的 S 形曲线。由它读出起始电位、达到某个电流密度需要的过电位、Tafel 斜率和转移的电子数。`, `The standard practice of electrocatalysis. A disc electrode spinning at constant speed delivers reactant to its surface at a defined rate, and a slow potential sweep gives an S-shaped curve running from kinetic control to the diffusion limit. From it come the onset potential, the overpotential needed for a given current density, the Tafel slope and the number of electrons transferred.`),
      how: [
        T(`旋转的圆盘把溶液沿轴向吸过来再甩出去，在表面形成厚度均匀、只由转速决定的扩散层。极限电流由 Levich 方程给出：i_L = 0.620·nFA·D^(2/3)·ω^(1/2)·ν^(−1/6)·C，ω 是角速度（rad/s），ν 是溶液的运动粘度。实测电流里动力学和传质是串联的：1/i = 1/i_k + 1/i_L（Koutecký–Levich 方程）。在几个转速下测，把 1/i 对 ω^(−1/2) 作图，斜率给出电子数 n，截距给出不受传质影响的动力学电流 i_k。`, `The spinning disc draws solution towards it along the axis and flings it outward, creating a diffusion layer of uniform thickness set by rotation rate alone. The limiting current follows the Levich equation, i_L = 0.620·nFA·D^(2/3)·ω^(1/2)·ν^(−1/6)·C, with ω the angular velocity (rad/s) and ν the kinematic viscosity. In the measured current kinetics and mass transport act in series: 1/i = 1/i_k + 1/i_L (the Koutecký–Levich equation). Measuring at several rotation rates and plotting 1/i against ω^(−1/2) gives the electron number n from the slope and the transport-free kinetic current i_k from the intercept.`),
        T(`氧还原是最常见的例子：氧气可以得 4 个电子直接变成水，也可以只得 2 个电子变成过氧化氢。在氧气饱和的 0.1 mol/L KOH 里（C = 1.2 × 10⁻⁶ mol/cm³，D = 1.9 × 10⁻⁵ cm²/s，ν = 0.01 cm²/s），1600 转/分时四电子过程的极限电流密度约为 5.7 mA/cm²，两电子过程只有一半。旋转环盘电极在圆盘外面再套一个铂环，把甩出来的过氧化氢氧化掉，由环电流直接量出两电子路径占多少。`, `Oxygen reduction is the commonest example: oxygen may take four electrons directly to water, or only two to hydrogen peroxide. In oxygen-saturated 0.1 mol/L KOH (C = 1.2 × 10⁻⁶ mol/cm³, D = 1.9 × 10⁻⁵ cm²/s, ν = 0.01 cm²/s) the limiting current density of the four-electron process at 1600 rpm is about 5.7 mA/cm², and that of the two-electron process half as much. A rotating ring-disc electrode adds a platinum ring around the disc that oxidises the peroxide flung outward, and the ring current measures the share of the two-electron path directly.`),
        T(`Tafel 分析：在过电位较大、传质还没成为限制的区间，η = a + b·log j。Tafel 斜率 b = 2.303RT / (αF)，传递系数 α = 0.5 时是 118 mV/dec。它的大小和决速步有关：析氢反应里，Volmer 步（质子放电）决速对应约 120 mV/dec，Heyrovský 步约 40 mV/dec，Tafel 步（两个吸附氢结合）约 30 mV/dec。把直线外推到 η = 0 得到交换电流密度 j₀。`, `Tafel analysis: where the overpotential is substantial and mass transport not yet limiting, η = a + b·log j. The Tafel slope is b = 2.303RT / (αF), 118 mV/dec for a transfer coefficient α = 0.5. Its value relates to the rate-determining step: in hydrogen evolution a rate-determining Volmer step (proton discharge) gives about 120 mV/dec, a Heyrovský step about 40 mV/dec and a Tafel step (combination of two adsorbed hydrogens) about 30 mV/dec. Extrapolation of the line to η = 0 gives the exchange current density j₀.`),
      ],
      axes: T(`横轴是电位（V，电催化里通常换算成相对可逆氢电极 RHE），纵轴是电流密度（mA/cm²）。Tafel 图：log j 对过电位 η。`, `Potential (V, in electrocatalysis usually converted to the reversible hydrogen electrode, RHE) against current density (mA/cm²). The Tafel plot: log j against overpotential η.`),
      tells: [
        T(`催化剂的活性：起始电位、半波电位（氧还原）、达到 10 mA/cm² 的过电位（析氢、析氧）。`, `Catalyst activity: onset potential, half-wave potential (oxygen reduction), overpotential at 10 mA/cm² (hydrogen and oxygen evolution).`),
        T(`反应走几电子路径、决速步可能是哪一步（Tafel 斜率）、本征活性（交换电流密度、按活性面积归一的电流）。`, `The electron pathway, the likely rate-determining step (Tafel slope) and intrinsic activity (exchange current density, current normalised to active area).`),
      ],
      sample: T(`催化剂粉末分散成墨水（加 Nafion 做粘结剂），滴在直径 3–5 mm 的玻碳圆盘上晾干，负载量 0.1–0.5 mg/cm²。扫描速率 5–10 mV/s，气体饱和的电解液。`, `Catalyst powder dispersed as an ink (with Nafion as binder), dropped on a glassy-carbon disc of 3–5 mm and dried, at a loading of 0.1–0.5 mg/cm². Scan rates of 5–10 mV/s in gas-saturated electrolyte.`),
      nums: [
        [T(`换算到可逆氢电极`, `Conversion to RHE`), T(`E(RHE) = E(Ag/AgCl) + 0.197 + 0.0591·pH（25 °C，饱和 KCl）`, `E(RHE) = E(Ag/AgCl) + 0.197 + 0.0591·pH (25 °C, saturated KCl)`)],
        [T(`平衡电位`, `Equilibrium potentials`), T(`析氢 0 V，氧还原和析氧 1.229 V（相对 RHE）`, `Hydrogen evolution 0 V; oxygen reduction and evolution 1.229 V (against RHE)`)],
        [T(`四电子氧还原的极限电流`, `Limiting current of four-electron oxygen reduction`), T(`1600 转/分、0.1 mol/L KOH 中约 5.7 mA/cm²`, `About 5.7 mA/cm² at 1600 rpm in 0.1 mol/L KOH`)],
        [T(`Tafel 斜率（25 °C）`, `Tafel slopes (25 °C)`), T(`2.303RT/F = 59.2 mV；α = 0.5 时 118 mV/dec`, `2.303RT/F = 59.2 mV; 118 mV/dec for α = 0.5`)],
      ],
      read: [
        T(`先看极限电流平台到没到理论值：明显偏低说明催化剂膜没铺满或者电子数小于 4。`, `Check first whether the limiting-current plateau reaches its theoretical value: a clearly lower one means incomplete film coverage or fewer than four electrons.`),
        T(`Tafel 斜率要从扣除 iR 降、扣除传质影响（用 i_k）之后的数据里取，而且直线段至少要跨一个数量级的电流。`, `Take Tafel slopes from data corrected for iR drop and for mass transport (using i_k), over a linear region spanning at least one decade of current.`),
      ],
      traps: [
        T(`不做 iR 补偿，大电流处的过电位被高估，Tafel 斜率偏大；补偿过头又会把曲线“扶直”得不合理。报告里要写补偿了多少（通常 85–100 %）和电阻值。`, `Without iR compensation overpotentials at high current are overestimated and Tafel slopes inflated; overcompensation straightens curves unphysically. Report how much was compensated (usually 85–100 %) and the resistance.`),
        T(`按几何面积归一的电流密度分不清“催化剂本身好”和“表面积大”。比较本征活性要按电化学活性面积或活性位点数归一。`, `Current density normalised to geometric area cannot separate a better catalyst from a larger surface. Intrinsic activity must be normalised to electrochemically active area or to the number of active sites.`),
        T(`用铂做对电极测非贵金属的析氢催化剂时，铂会溶解并沉积到工作电极上，活性“越测越好”。这类实验要用石墨棒做对电极。`, `With a platinum counter electrode in tests of non-precious hydrogen-evolution catalysts, platinum dissolves and deposits on the working electrode, and activity "improves with cycling". A graphite rod should serve as counter electrode in such experiments.`),
      ],
      figs: [
        { gen: 'rde', cap: T(`由 Levich 和 Koutecký–Levich 方程算出：氧气饱和的 0.1 mol/L KOH 里氧还原的极化曲线（动力学电流用 Butler–Volmer 式，转速 400、900、1600、2500 转/分）。切换电子数 n = 4 和 n = 2，极限电流差一倍；改变交换电流密度，曲线沿电位轴平移而平台高度不变。右边是 Koutecký–Levich 图。`, `From the Levich and Koutecký–Levich equations: polarisation curves of oxygen reduction in oxygen-saturated 0.1 mol/L KOH (kinetic current from a Butler–Volmer expression; 400, 900, 1600 and 2500 rpm). Switch the electron number between n = 4 and n = 2 and the limiting current halves; change the exchange current density and the curves shift along the potential axis without changing the plateau. The Koutecký–Levich plot is on the right.`) },
      ],
      see: [['#m-cv', T(`循环伏安法`, `Cyclic voltammetry`)], ['#m-eis', T(`电化学阻抗谱`, `Electrochemical impedance spectroscopy`)]],
      refs: ['elgrishi2018', 'mccrory2013'],
    },
    {
      id: 'eis', fam: 'echem', core: true, abbr: 'EIS', name: T(`电化学阻抗谱`, `Electrochemical impedance spectroscopy`),
      one: T(`在电极上叠加一个很小的正弦电压，从十万赫兹扫到毫赫兹，测电流的幅度和相位，得到每个频率下的阻抗。电极上快慢不同的过程（溶液导电、界面充电、电子转移、扩散）各自在不同的频率段露面，于是一张谱就能把它们分开。`, `A very small sinusoidal voltage is superimposed on the electrode and swept from a hundred kilohertz to millihertz while the amplitude and phase of the current are measured, giving the impedance at each frequency. Processes of different speed at the electrode (ionic conduction, interfacial charging, electron transfer, diffusion) show up in different frequency ranges, so one spectrum separates them.`),
      how: [
        T(`阻抗是复数：Z = Z′ + jZ″。纯电阻的阻抗是 R，和频率无关；电容的阻抗是 1/(jωC)，频率越低越大，电流超前电压 90°。最简单的电极模型是 Randles 等效电路：溶液电阻 R_s，串联一个并联组合，组合的一支是双电层电容 C_dl，另一支是电荷转移电阻 R_ct 加上代表扩散的 Warburg 阻抗 Z_W = σ·ω^(−1/2)·(1 − j)。`, `Impedance is complex: Z = Z′ + jZ″. A pure resistor has impedance R at all frequencies; a capacitor has 1/(jωC), growing as frequency falls, with current leading voltage by 90°. The simplest electrode model is the Randles equivalent circuit: the solution resistance R_s in series with a parallel combination of the double-layer capacitance C_dl on one branch and, on the other, the charge-transfer resistance R_ct plus a Warburg impedance for diffusion, Z_W = σ·ω^(−1/2)·(1 − j).`),
        T(`Nyquist 图把 −Z″ 对 Z′ 画出来，每个点是一个频率，高频在左。Randles 电路给出一个半圆加一条 45° 的斜线：半圆的左端点是 R_s，直径是 R_ct，半圆顶点的角频率满足 ω = 1/(R_ct·C_dl)；低频的斜线是扩散。电荷转移电阻和交换电流的关系是 R_ct = RT / (nF·i₀)，所以半圆越小，电极反应越快。`, `A Nyquist plot shows −Z″ against Z′, one point per frequency, high frequencies on the left. The Randles circuit gives a semicircle followed by a line at 45°: the left end of the semicircle is R_s, its diameter is R_ct, and the angular frequency at its apex satisfies ω = 1/(R_ct·C_dl); the low-frequency line is diffusion. The charge-transfer resistance relates to the exchange current by R_ct = RT / (nF·i₀), so a smaller semicircle means a faster electrode reaction.`),
        T(`真实电极的半圆常常是压扁的，因为表面粗糙、不均匀。这时把电容换成常相位元件（CPE）：Z = 1 / [Q·(jω)^α]，α 在 0.8–1 之间，α = 1 就是理想电容。数据在拟合之前要先过 Kramers–Kronig 检验，确认体系在测量期间是线性的、稳定的。`, `The semicircle of a real electrode is often depressed, because the surface is rough and inhomogeneous. The capacitor is then replaced by a constant-phase element (CPE), Z = 1 / [Q·(jω)^α], with α between 0.8 and 1 and α = 1 an ideal capacitor. Before fitting, data should pass a Kramers–Kronig test confirming that the system was linear and stable during the measurement.`),
      ],
      axes: T(`Nyquist 图：Z′（Ω）对 −Z″（Ω），两个轴的刻度必须相等，半圆才是圆的。Bode 图：log 频率对 log |Z| 和相位角。`, `Nyquist plot: Z′ (Ω) against −Z″ (Ω), on axes of equal scale so that a semicircle looks circular. Bode plot: log frequency against log |Z| and phase angle.`),
      tells: [
        T(`电池：欧姆内阻、界面膜（SEI）电阻、电荷转移电阻、固相扩散，以及它们怎样随循环和荷电状态变化。`, `Batteries: ohmic resistance, interphase (SEI) resistance, charge-transfer resistance and solid-state diffusion, and how they change with cycling and state of charge.`),
        T(`腐蚀：极化电阻（腐蚀速率与它成反比）、涂层的完好程度。`, `Corrosion: polarisation resistance (to which corrosion rate is inversely proportional) and the integrity of coatings.`),
        T(`电解质和固态电解质的离子电导率；电催化剂的电荷转移电阻；生物传感器表面的结合。`, `Ionic conductivity of electrolytes and solid electrolytes; charge-transfer resistance of electrocatalysts; binding at biosensor surfaces.`),
      ],
      sample: T(`三电极或两电极电池，先在选定的直流电位（常用开路电位）下稳定下来。交流幅度 5–10 mV，频率 100 kHz–10 mHz，每十倍频程 8–10 个点。频率越低测得越久，10 mHz 一个点就要几分钟。`, `A three- or two-electrode cell, first stabilised at the chosen d.c. potential (often open circuit). An a.c. amplitude of 5–10 mV from 100 kHz to 10 mHz with 8–10 points per decade. The lower the frequency, the longer it takes: one point at 10 mHz needs minutes.`),
      nums: [
        [T(`交流幅度`, `A.c. amplitude`), T(`5–10 mV（保证响应是线性的）`, `5–10 mV (to keep the response linear)`)],
        [T(`双电层电容`, `Double-layer capacitance`), T(`光滑电极约 10–40 μF/cm²`, `About 10–40 μF/cm² on smooth electrodes`)],
        [T(`一个算例`, `A worked example`), T(`R_ct = 100 Ω、C_dl = 20 μF 时半圆顶点在 80 Hz`, `With R_ct = 100 Ω and C_dl = 20 μF the apex of the semicircle is at 80 Hz`)],
      ],
      read: [
        T(`从高频往低频读：最左边和实轴的交点是欧姆电阻；每个半圆是一个“电阻并联电容”的过程，直径是它的电阻；最右边的斜线是扩散（45°）或者电容行为（接近 90° 的竖线，离子进不去的阻塞电极）。`, `Read from high to low frequency: the leftmost intercept with the real axis is the ohmic resistance; each semicircle is a "resistor in parallel with a capacitor" process whose diameter is its resistance; the final line is diffusion (45°) or capacitive behaviour (nearly vertical, a blocking electrode that ions cannot enter).`),
        T(`Nyquist 图上看不出频率，所以要在几个点上标出频率，或者同时给出 Bode 图。`, `Frequency is invisible on a Nyquist plot, so mark it at several points or show the Bode plot as well.`),
      ],
      traps: [
        T(`等效电路不是唯一的：不同的电路可以给出一模一样的阻抗谱，元件多了什么数据都能拟合。每个元件都要有物理上的依据，并且用它随电位、温度、浓度的变化来验证。`, `Equivalent circuits are not unique: different circuits can give identical spectra, and with enough elements any data can be fitted. Each element needs a physical justification, verified through its dependence on potential, temperature and concentration.`),
        T(`体系在测量过程中变了（电池自放电、电极腐蚀、温度漂移），低频数据就不可信。测完再回头重测一个高频点，看它是不是还在原处。`, `If the system changes during the measurement (battery self-discharge, electrode corrosion, temperature drift) the low-frequency data cannot be trusted. Remeasure a high-frequency point at the end to see whether it is still where it was.`),
        T(`高频处出现在实轴下方的“感抗”尾巴通常来自导线和仪器，不是电极过程。`, `An inductive tail below the real axis at high frequency usually comes from cables and instrument, not from an electrode process.`),
      ],
      figs: [
        { gen: 'nyquist', cap: T(`由 Randles 等效电路算出：Nyquist 图（100 kHz–10 mHz）。拖动溶液电阻、电荷转移电阻、双电层电容和 Warburg 系数：R_s 把整个图左右平移，R_ct 决定半圆的直径，C_dl 不改变形状只改变每个点的频率，Warburg 系数决定低频斜线从哪里接上来。`, `From the Randles equivalent circuit: a Nyquist plot (100 kHz–10 mHz). Vary solution resistance, charge-transfer resistance, double-layer capacitance and Warburg coefficient: R_s shifts the whole plot sideways, R_ct sets the diameter of the semicircle, C_dl leaves the shape alone and changes only the frequency of each point, and the Warburg coefficient sets where the low-frequency line takes over.`) },
      ],
      see: [['#m-cv', T(`循环伏安法`, `Cyclic voltammetry`)]],
      refs: ['randles1947', 'lazanas2023'],
    },
    {
      id: 'potentiometry', fam: 'echem', abbr: 'pH · ISE', name: T(`电位法、pH 与电位滴定`, `Potentiometry, pH and potentiometric titration`),
      one: T(`不通电流，只测指示电极和参比电极之间的电压。这个电压随被测离子活度的对数变化：一价离子每变十倍，电位变 59.16 mV。pH 计就是这样工作的；把它接到滴定管上，就得到滴定曲线。`, `No current flows; only the voltage between an indicator and a reference electrode is measured. That voltage varies with the logarithm of the activity of the ion measured: 59.16 mV for each tenfold change of a singly charged ion. A pH meter works this way, and attached to a burette it records titration curves.`),
      how: [
        T(`Nernst 方程：E = E° + (RT / nF)·ln a = E° + (59.16 mV / n)·log a（25 °C）。pH 玻璃电极的薄玻璃膜两侧氢离子活度不同时产生膜电位，在 pH 1–12 之间响应接近理论斜率。离子选择性电极把玻璃膜换成对某种离子有选择性的膜：氟电极用 LaF₃ 单晶，钾电极用含缬氨霉素的聚合物膜，钙电极用含离子载体的膜。`, `The Nernst equation: E = E° + (RT / nF)·ln a = E° + (59.16 mV / n)·log a (25 °C). A pH glass electrode develops a membrane potential when hydrogen-ion activity differs across its thin glass membrane, with a nearly theoretical slope between pH 1 and 12. An ion-selective electrode replaces the glass with a membrane selective for some ion: a LaF₃ single crystal for fluoride, a polymer membrane containing valinomycin for potassium, an ionophore membrane for calcium.`),
        T(`电极响应的是活度不是浓度，而且没有哪个电极只认一种离子。Nikolsky–Eisenman 方程描述干扰：E = 常数 + (RT / z_i F)·ln[a_i + Σ K_ij·a_j^(z_i/z_j)]，选择性系数 K_ij 越小，离子 j 的干扰越小。实际测量时往标准和样品里都加同样的离子强度调节剂，让活度系数相同，这样电位就直接和浓度的对数成线性。`, `An electrode responds to activity, not concentration, and none responds to a single ion alone. The Nikolsky–Eisenman equation describes interference: E = constant + (RT / z_i F)·ln[a_i + Σ K_ij·a_j^(z_i/z_j)], where a smaller selectivity coefficient K_ij means less interference from ion j. In practice the same ionic-strength adjuster is added to standards and samples so that activity coefficients are equal and potential is linear in the logarithm of concentration.`),
        T(`电位滴定：每加一点滴定剂读一次电位或 pH，等当点是曲线最陡的地方（一阶导数的极大值）。用 0.1 mol/L 的 NaOH 滴定 25 mL 0.1 mol/L 的醋酸：起点 pH 2.88；滴到一半时 pH = pK_a = 4.76，缓冲能力最强；等当点 pH 8.73，偏碱性，因为生成的醋酸根会水解。所以指示剂要选酚酞而不是甲基橙。`, `Potentiometric titration: potential or pH is read after each addition of titrant, and the equivalence point is where the curve is steepest (the maximum of the first derivative). Titrating 25 mL of 0.1 mol/L acetic acid with 0.1 mol/L NaOH: the starting pH is 2.88; at half-titration pH = pK_a = 4.76, where buffering is strongest; the equivalence point lies at pH 8.73, on the basic side because the acetate formed hydrolyses. The indicator of choice is therefore phenolphthalein, not methyl orange.`),
      ],
      axes: T(`直接电位法：log 浓度对电位（mV），是一条直线。滴定曲线：滴定剂体积（mL）对 pH 或电位。`, `Direct potentiometry: log concentration against potential (mV), a straight line. Titration curve: volume of titrant (mL) against pH or potential.`),
      tells: [
        T(`pH；水里的氟、氯、硝酸根、铵、钾、钠、钙（血气分析仪里的电解质项目就是离子选择性电极）。`, `pH; fluoride, chloride, nitrate, ammonium, potassium, sodium and calcium in water (the electrolyte panel of a blood-gas analyser consists of ion-selective electrodes).`),
        T(`酸、碱的浓度和 pK_a；氧化还原滴定、沉淀滴定、络合滴定的终点，有颜色或浑浊的溶液也能测。`, `Concentrations and pK_a values of acids and bases; end points of redox, precipitation and complexometric titrations, in coloured or turbid solutions too.`),
      ],
      sample: T(`水溶液，几毫升到几十毫升。pH 电极用两到三种标准缓冲液（如 pH 4.01、7.00、10.01）标定，标定和测量要在同一温度下进行。`, `Aqueous solutions of a few to tens of millilitres. A pH electrode is calibrated with two or three standard buffers (pH 4.01, 7.00, 10.01, for instance), at the temperature of the measurement.`),
      nums: [
        [T(`Nernst 斜率（25 °C）`, `Nernstian slope (25 °C)`), T(`一价离子 59.16 mV/十倍，二价离子 29.58 mV/十倍`, `59.16 mV per decade for singly charged ions, 29.58 for doubly charged`)],
        [T(`1 mV 的误差相当于`, `An error of 1 mV corresponds to`), T(`一价离子浓度差约 4 %，二价离子约 8 %`, `About 4 % in concentration for a singly charged ion, about 8 % for a doubly charged one`)],
        [T(`醋酸（0.1 mol/L）被 NaOH 滴定`, `Acetic acid (0.1 mol/L) titrated with NaOH`), T(`起点 pH 2.88，半等当点 4.76，等当点 8.73`, `Initial pH 2.88, half-equivalence 4.76, equivalence 8.73`)],
      ],
      read: [
        T(`滴定曲线上，平缓的一段是缓冲区，它的中点给出 pK_a；陡峭的一段是等当点，突跃越大终点越准。多元酸有几个可以分开滴定的质子就有几个突跃（相邻的 pK_a 至少要差 3–4）。`, `On a titration curve the flat stretch is the buffer region, whose midpoint gives pK_a; the steep stretch is the equivalence point, and the larger the jump the more precise the end point. A polyprotic acid shows as many jumps as it has separately titratable protons (adjacent pK_a values must differ by at least 3–4).`),
      ],
      traps: [
        T(`玻璃电极在 pH 12 以上读数偏低（钠差：它开始响应钠离子），在强酸里读数偏高（酸差）。`, `Above pH 12 a glass electrode reads low (the sodium or alkaline error, as it begins to respond to sodium ions), and in strong acid it reads high (the acid error).`),
        T(`直接电位法的精度有限：电位读数差 1 mV，浓度就差 4 %，而液接电位的漂移就有这么大。要更准就用电位滴定或标准加入法。`, `Direct potentiometry has limited precision: 1 mV in potential is 4 % in concentration, and drift of the liquid-junction potential is of that size. For better accuracy use potentiometric titration or standard addition.`),
        T(`氟电极要把 pH 控制在 5–5.5：酸性太强氟离子变成 HF 不响应，碱性太强氢氧根干扰；同时要加柠檬酸盐把铝、铁络合掉，把氟释放出来。`, `A fluoride electrode needs pH 5–5.5: in stronger acid fluoride becomes HF and does not respond, and in base hydroxide interferes; citrate is added as well to complex aluminium and iron and release the fluoride.`),
      ],
      figs: [
        { gen: 'titration', cap: T(`由电荷平衡方程算出：用强碱滴定一元弱酸的曲线（下面的细线是一阶导数）。拖动 pK_a 和浓度：酸越弱，起点越高、等当点的突跃越小；pK_a 超过约 9、或者浓度太稀时，突跃小到找不准终点。`, `From the charge-balance equation: the titration of a weak monoprotic acid with strong base (the thin line below is the first derivative). Vary pK_a and concentration: the weaker the acid, the higher the starting point and the smaller the jump at equivalence; with pK_a above about 9, or at high dilution, the jump becomes too small to locate the end point.`) },
      ],
      see: [['#m-cv', T(`循环伏安法`, `Cyclic voltammetry`)]],
      refs: ['bakker1997'],
    },
    {
      id: 'pulsevolt', fam: 'echem', abbr: 'DPV · SWV · ASV', name: T(`脉冲伏安与溶出伏安`, `Pulse and stripping voltammetry`),
      one: T(`循环伏安的电流里混着给双电层充电的电流，测不了很稀的溶液。脉冲伏安法利用充电电流衰减得比反应电流快这一点，在每个电位脉冲的末尾采样，把检出限压到 10⁻⁸ mol/L。溶出伏安法再加一步预富集，先把金属离子电沉积到电极上再溶出来，检出限到 10⁻¹⁰ mol/L 以下，是最灵敏也最便宜的痕量金属分析方法之一。`, `The current in cyclic voltammetry includes that of charging the double layer, which rules out very dilute solutions. Pulse voltammetry exploits the faster decay of charging current compared with reaction current: sampling at the end of each potential pulse pushes detection limits to 10⁻⁸ mol/L. Stripping voltammetry adds preconcentration, electrodepositing metal ions on the electrode and then dissolving them off, reaching below 10⁻¹⁰ mol/L; it is among the most sensitive and least expensive methods of trace-metal analysis.`),
      how: [
        T(`加上一个电位阶跃之后，充电电流按 exp(−t / R_s·C_dl) 指数衰减，几毫秒就没了；反应（法拉第）电流按 t^(−1/2) 衰减，慢得多。差分脉冲伏安（DPV）：在缓慢上升的阶梯电位上叠加 25–50 mV 的小脉冲，在脉冲前和脉冲末各采一次电流，取差值对电位作图，得到一个峰。峰高正比于浓度，峰电位接近 E½，可逆体系的半峰宽约 90/n mV。方波伏安（SWV）用正反两个方向的脉冲，取两者之差，更快也更灵敏，几秒钟扫完一条曲线。`, `After a potential step the charging current decays exponentially as exp(−t / R_s·C_dl) and is gone within milliseconds; the reaction (faradaic) current decays as t^(−1/2), far more slowly. Differential pulse voltammetry (DPV) superimposes small pulses of 25–50 mV on a slowly rising staircase, samples the current just before and at the end of each pulse and plots the difference against potential, giving a peak. Peak height is proportional to concentration, peak potential close to E½, and the width at half height about 90/n mV for a reversible system. Square-wave voltammetry (SWV) uses forward and reverse pulses and takes their difference; faster and more sensitive, it completes a scan in seconds.`),
        T(`阳极溶出伏安（ASV）分两步。富集：把电极保持在足够负的电位（如 −1.2 V）并搅拌 1–5 分钟，溶液里的金属离子被还原，沉积在电极上（传统用汞膜，形成汞齐；现在多用无毒的铋膜）。溶出：停止搅拌，往正方向扫描，各种金属依次被氧化溶出，各出一个峰。富集把大体积溶液里的金属浓缩到电极表面极小的体积里，信号放大了几百到上千倍。`, `Anodic stripping voltammetry (ASV) has two steps. Deposition: the electrode is held at a sufficiently negative potential (say −1.2 V) with stirring for 1–5 minutes, and metal ions are reduced onto it (traditionally into a mercury film as an amalgam, nowadays often onto non-toxic bismuth films). Stripping: stirring stops, the potential is swept positive, and each metal is oxidised off in turn with its own peak. Deposition concentrates the metal of a large volume of solution into the tiny volume at the electrode surface, amplifying the signal several hundred- to a thousandfold.`),
      ],
      axes: T(`横轴是电位（V），纵轴是差分电流（μA 或 nA）。谱上是一个个峰，不是循环伏安那样的波。`, `Potential (V) against differential current (μA or nA). The trace consists of peaks, not waves as in cyclic voltammetry.`),
      tells: [
        T(`水里痕量的铅、镉、锌、铜、砷、汞，现场用便携式仪器和一次性丝网印刷电极就能测。`, `Traces of lead, cadmium, zinc, copper, arsenic and mercury in water, measurable in the field with portable instruments and disposable screen-printed electrodes.`),
        T(`药物、神经递质（多巴胺）、抗氧化剂等有电活性的有机物；电化学生物传感器的读出。`, `Electroactive organics such as drugs, neurotransmitters (dopamine) and antioxidants; the readout of electrochemical biosensors.`),
        T(`金属的形态：溶出伏安只响应游离的和不稳定络合的金属离子，和总量的差别反映了络合程度。`, `Metal speciation: stripping voltammetry responds only to free and labile metal ions, and the difference from the total reflects complexation.`),
      ],
      sample: T(`水样加支持电解质或缓冲液（如 pH 4.5 的醋酸缓冲液），10–20 mL，除氧。定量通常用标准加入法。`, `A water sample with supporting electrolyte or buffer (acetate at pH 4.5, for example), 10–20 mL, deoxygenated. Quantification is usually by standard addition.`),
      nums: [
        [T(`检出限`, `Detection limits`), T(`DPV / SWV 约 10⁻⁸ mol/L；溶出伏安 10⁻¹⁰–10⁻¹¹ mol/L`, `About 10⁻⁸ mol/L for DPV / SWV; 10⁻¹⁰–10⁻¹¹ mol/L for stripping`)],
        [T(`脉冲幅度`, `Pulse amplitude`), T(`25–50 mV`, `25–50 mV`)],
        [T(`可逆体系的半峰宽（DPV）`, `Width at half height, reversible system (DPV)`), T(`约 90/n mV`, `About 90/n mV`)],
      ],
      read: [
        T(`峰电位认物种（和标准比），峰高或峰面积定量。相邻的峰至少要隔开约 100 mV 才能各自定量。`, `Peak potential identifies the species (against standards); peak height or area quantifies it. Neighbouring peaks need about 100 mV between them to be quantified separately.`),
      ],
      traps: [
        T(`金属之间会在电极上生成金属间化合物（最典型的是铜和锌），使锌的峰变小、铜的峰变形。加镓把铜“占住”，或者分开测。`, `Metals form intermetallic compounds on the electrode (copper with zinc most notoriously), shrinking the zinc peak and distorting the copper peak. Adding gallium to tie up copper, or separate determinations, avoid this.`),
        T(`表面活性物质和天然有机物会吸附在电极上，压低甚至抹掉溶出峰。实际水样常要先用紫外光消解。`, `Surfactants and natural organic matter adsorb on the electrode and depress or erase stripping peaks. Real water samples often need ultraviolet digestion first.`),
      ],
      figs: [
        { sketch: { x: [-1.3, 0.2], xl: T(`电位（V，相对 Ag/AgCl）`, `potential (V, against Ag/AgCl)`), yl: T(`溶出电流（示意）`, `stripping current (schematic)`), peaks: [[-1.0, 0.75, 0.07, T(`Zn`, `Zn`)], [-0.6, 0.6, 0.06, T(`Cd`, `Cd`)], [-0.4, 1, 0.06, T(`Pb`, `Pb`)], [-0.05, 0.5, 0.08, T(`Cu`, `Cu`)]] },
          cap: T(`示意：醋酸缓冲液里四种金属的阳极溶出伏安图。峰电位是汞膜电极上的典型值（锌约 −1.0 V，镉约 −0.6 V，铅约 −0.4 V，铜约 −0.05 V），随电极材料和介质变化；峰高是示意的。`, `Schematic: an anodic stripping voltammogram of four metals in acetate buffer. Peak potentials are typical of a mercury-film electrode (zinc about −1.0 V, cadmium about −0.6 V, lead about −0.4 V, copper about −0.05 V) and vary with electrode material and medium; heights are illustrative.`) },
      ],
      see: [['#m-aas', T(`原子吸收光谱`, `Atomic absorption spectroscopy`)], ['#m-icpms', T(`电感耦合等离子体质谱`, `ICP mass spectrometry`)]],
      refs: ['osteryoung1985'],
    },
  );
})();
