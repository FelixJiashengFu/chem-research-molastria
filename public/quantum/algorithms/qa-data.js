/* 量子算法 · Quantum Algorithms：全部内容（中英两版）。qa.js 负责画成页面，qa-models.js 是交互演示的数学。
   公式写成 LaTeX（键 math），由 node tools/fundamental-math.mjs 转成 qa-math.js 里的 MathML。
   文献都在 OpenAlex（DOI）或 arXiv 接口上核对过题名、作者、年份与卷号（node tools/quantum-algorithms-refs.mjs）。
   分工：量子比特的物理实现、噪声、纠错与容错架构写在 ../computing/（量子计算机栏目）；这里只写逻辑层的算法。 */
window.MOLASTRIA_QA = {
  checked: '2026-11-09',

  hero: {
    quote: {
      zh: '自然不是经典的，见鬼，如果你想模拟自然，最好把模拟做成量子力学的。——费曼，1981 年的演讲（1982 年发表）',
      en: 'Nature isn’t classical, dammit, and if you want to make a simulation of nature, you’d better make it quantum mechanical. — Richard Feynman, 1981 lecture (published 1982)',
    },
    lead: {
      zh: '量子算法是写给“逻辑量子比特”的程序：只用叠加、干涉和纠缠，把答案的概率放大、把错误答案的概率抵消。这个栏目从线路模型讲起，经过量子傅里叶变换、相位估计、振幅放大和块编码这几块“积木”，到 Shor、Grover、哈密顿量模拟、HHL、量子行走，再落到化学家最关心的部分：费米子怎样变成量子比特、基态能量要多少资源、VQE 和 QAOA 在今天的设备上能做什么。每个算法都配了能在浏览器里运行的演示。',
      en: 'A quantum algorithm is a program for logical qubits: it uses only superposition, interference and entanglement to amplify the probability of the right answer and cancel the wrong ones. This section starts from the circuit model, builds the standard bricks (the quantum Fourier transform, phase estimation, amplitude amplification, block encodings), goes through Shor, Grover, Hamiltonian simulation, HHL and quantum walks, and lands on what chemists care about most: how fermions become qubits, what a ground-state energy costs, and what VQE and QAOA can and cannot do on today’s devices. Every algorithm comes with a demo that runs in your browser.',
    },
    honesty: {
      zh: '一个加速有多大，取决于拿什么经典算法来比。所以每个算法都标了证据等级：哪些加速有证明，哪些只在黑盒模型里成立，哪些依赖“能高效读入数据”之类的假设，哪些只是启发式。页面上的演示都是精确的态矢量模拟，数值由本站的代码算出，没有噪声，也不是在真机上跑的。',
      en: 'How large a speedup is depends on which classical algorithm you compare against, so every algorithm carries an evidence level: which speedups are proven, which hold only in the black-box model, which rest on assumptions such as fast data loading, and which are heuristics. The demos are exact, noiseless statevector simulations computed by this site’s code, not runs on real hardware.',
    },
  },

  // 加速的证据等级（账本和详解里都用）
  evidence: {
    proven: { zh: '有证明', en: 'Proven', long: { zh: '在明确的计算模型里证明了量子与经典的差距（例如查询次数的下界）。', en: 'A quantum–classical gap is proven in a stated model of computation (for example, a lower bound on queries).' } },
    oracle: { zh: '黑盒分离', en: 'Oracle separation', long: { zh: '只在“函数是黑盒、按调用次数计费”的模型里证明了指数差距；换成真实的函数，经典算法可能也很快。', en: 'An exponential gap is proven only when the function is a black box charged per call; for a concrete function a classical algorithm may also be fast.' } },
    believed: { zh: '强证据', en: 'Strong evidence', long: { zh: '比已知最好的经典算法快得多，并有复杂度理论的证据（如 BQP 完全），但经典下界没有证明。', en: 'Much faster than the best known classical algorithm, backed by complexity-theoretic evidence (such as BQP-completeness), but no classical lower bound is proven.' } },
    conditional: { zh: '有前提', en: 'Conditional', long: { zh: '加速要靠强假设：数据能高效载入、只要量子态形式的输出、条件数小、初态与目标态重叠大；部分情形已被“去量子化”。', en: 'The speedup needs strong assumptions: fast data loading, output wanted only as a quantum state, small condition number, a good initial overlap; some cases have been dequantized.' } },
    heuristic: { zh: '启发式', en: 'Heuristic', long: { zh: '没有加速的证明，靠数值和实验判断；对经典启发式算法的优势至今没有确立。', en: 'No proof of a speedup; judged by numerics and experiment; an advantage over classical heuristics has not been established.' } },
    subroutine: { zh: '子程序', en: 'Subroutine', long: { zh: '本身不解决问题，是其他算法里的积木；它的价值看用在哪里。', en: 'Not a solution by itself but a building block; its value depends on where it is used.' } },
  },

  tiers: [
    { id: 1, name: { zh: '第一层', en: 'Layer 1' }, tag: { zh: '线路模型与积木', en: 'Circuit model and bricks' }, desc: { zh: '几乎所有量子算法都由这五块拼成。先把它们学到能手算两三个比特的程度。', en: 'Almost every quantum algorithm is assembled from these five. Learn them until you can work two or three qubits by hand.' } },
    { id: 2, name: { zh: '第二层', en: 'Layer 2' }, tag: { zh: '容错时代的里程碑', en: 'Fault-tolerant milestones' }, desc: { zh: '有严格复杂度分析的经典算法：因数分解、哈密顿量模拟、线性方程组、量子行走。它们需要纠错后的逻辑量子比特。', en: 'The classics with rigorous complexity analyses: factoring, Hamiltonian simulation, linear systems, quantum walks. They need error-corrected logical qubits.' } },
    { id: 3, name: { zh: '第三层', en: 'Layer 3' }, tag: { zh: '化学与近期设备', en: 'Chemistry and near-term devices' }, desc: { zh: '量子化学怎样上量子计算机：编码、相位估计的资源账、变分算法、组合优化和误差缓解。', en: 'How quantum chemistry goes onto a quantum computer: encodings, the resource bill for phase estimation, variational algorithms, combinatorial optimisation and error mitigation.' } },
  ],

  // 关系图最右一列：应用方向
  apps: [
    { id: 'crypto', name: { zh: '密码分析', en: 'Cryptanalysis' }, desc: { zh: 'RSA 和椭圆曲线依赖的因数分解与离散对数。', en: 'Factoring and discrete logarithms behind RSA and elliptic curves.' } },
    { id: 'search', name: { zh: '搜索与优化', en: 'Search & optimisation' }, desc: { zh: '无结构搜索、约束满足、组合优化。', en: 'Unstructured search, constraint satisfaction, combinatorial optimisation.' } },
    { id: 'chem', name: { zh: '化学与材料', en: 'Chemistry & materials' }, desc: { zh: '分子与材料的电子结构、反应能垒、动力学。', en: 'Electronic structure, reaction barriers and dynamics of molecules and materials.' } },
    { id: 'linalg', name: { zh: '线性代数与机器学习', en: 'Linear algebra & ML' }, desc: { zh: '线性方程组、微分方程、推荐与分类。', en: 'Linear systems, differential equations, recommendation and classification.' } },
    { id: 'physics', name: { zh: '物理模拟', en: 'Physics simulation' }, desc: { zh: '自旋模型、晶格模型、量子动力学。', en: 'Spin models, lattice models, quantum dynamics.' } },
  ],

  // [提供工具的一方, 用到它的一方, 具体用到了什么]
  relations: [
    ['query', 'qft', { zh: 'Simon 算法的“找隐藏周期”结构，直接启发了 Shor 用 QFT 找周期。', en: 'Simon’s hidden-period structure directly inspired Shor’s use of the QFT to find periods.' }],
    ['qft', 'qpe', { zh: '相位估计最后一步是逆 QFT，把相位从振幅里读成二进制数。', en: 'The last step of phase estimation is an inverse QFT that turns a phase in the amplitudes into a binary number.' }],
    ['qpe', 'shor', { zh: 'Shor = 对“乘以 a 模 N”这个酉算符做相位估计，读出 s/r。', en: 'Shor is phase estimation on the unitary “multiply by a mod N”, reading out s/r.' }],
    ['qpe', 'chemqpe', { zh: '把 e^{−iHt} 当作 U 做相位估计，读出的相位就是能量。', en: 'Run phase estimation with U = e^{−iHt}; the phase read out is the energy.' }],
    ['qpe', 'hhl', { zh: 'HHL 先用相位估计把 A 的本征值写进寄存器，再做受控旋转求 1/λ。', en: 'HHL first writes A’s eigenvalues into a register with phase estimation, then a controlled rotation computes 1/λ.' }],
    ['aa', 'search', { zh: 'Grover 搜索就是振幅放大最简单的情形：二次加速。', en: 'Grover search is the simplest case of amplitude amplification: a quadratic speedup.' }],
    ['aa', 'hhl', { zh: 'HHL 的成功概率小，要用振幅放大补回来，这也是 κ 进入代价的原因之一。', en: 'HHL succeeds with small probability and needs amplitude amplification, one reason κ enters its cost.' }],
    ['aa', 'qsvt', { zh: '“固定点”和“遗忘式”振幅放大都可以写成 QSVT 的特例。', en: 'Fixed-point and oblivious amplitude amplification are special cases of QSVT.' }],
    ['qsvt', 'hamsim', { zh: '块编码 + 量子信号处理给出最优的哈密顿量模拟（qubitization）。', en: 'Block encodings plus quantum signal processing give optimal Hamiltonian simulation (qubitization).' }],
    ['qsvt', 'hhl', { zh: '用 QSVT 对块编码做 1/x 多项式变换，就是现代版的 HHL。', en: 'Applying a 1/x polynomial to a block encoding with QSVT is the modern form of HHL.' }],
    ['qsvt', 'chemqpe', { zh: '化学哈密顿量的块编码（双因子分解、THC）决定了相位估计的主要成本。', en: 'Block encodings of chemistry Hamiltonians (double factorisation, THC) set the main cost of phase estimation.' }],
    ['hamsim', 'chemqpe', { zh: '相位估计需要 e^{−iHt}，它由 Trotter 或 qubitization 实现。', en: 'Phase estimation needs e^{−iHt}, implemented by Trotter formulas or qubitization.' }],
    ['hamsim', 'physics', { zh: '模拟自旋和晶格模型的实时演化，是最早可能有用的容错应用之一。', en: 'Real-time dynamics of spin and lattice models is one of the earliest likely useful fault-tolerant applications.' }],
    ['mapping', 'chemqpe', { zh: '先把二次量子化的哈密顿量映射成 Pauli 串之和，才能谈相位估计。', en: 'The second-quantised Hamiltonian must be mapped to a sum of Pauli strings before phase estimation.' }],
    ['mapping', 'vqe', { zh: 'VQE 测的每一项都是映射后的 Pauli 串；映射决定测量和线路的开销。', en: 'Every term VQE measures is a mapped Pauli string; the mapping sets the measurement and circuit cost.' }],
    ['shor', 'crypto', { zh: '多项式时间分解大整数、求离散对数，威胁 RSA 和椭圆曲线密码。', en: 'Polynomial-time factoring and discrete logarithms threaten RSA and elliptic-curve cryptography.' }],
    ['chemqpe', 'chem', { zh: '容错量子计算在化学上的主线：强关联体系的基态与能垒。', en: 'The main fault-tolerant route into chemistry: ground states and barriers of strongly correlated systems.' }],
    ['vqe', 'chem', { zh: '近期设备上做分子能量的尝试，规模仍小于经典方法能处理的。', en: 'Attempts at molecular energies on near-term devices, still smaller than what classical methods handle.' }],
    ['qaoa', 'search', { zh: '交替作用“问题”与“混合”两种演化来近似求解组合优化。', en: 'Alternating “problem” and “mixer” evolutions to approximate combinatorial optimisation.' }],
    ['mitig', 'vqe', { zh: '外推、概率抵消等方法让短线路的期望值更接近无噪声结果，代价是更多测量。', en: 'Extrapolation and probabilistic cancellation bring short-circuit expectation values closer to noiseless ones at the cost of more shots.' }],
    ['mitig', 'qaoa', { zh: '同样适用于 QAOA 的能量估计。', en: 'Applies equally to QAOA energy estimates.' }],
    ['hhl', 'linalg', { zh: '量子线性代数与量子机器学习的出发点，也是“去量子化”争论的中心。', en: 'The starting point of quantum linear algebra and quantum ML, and the centre of the dequantization debate.' }],
    ['walk', 'search', { zh: '量子行走在图上搜索、判定元素是否互异等问题上给出多项式加速。', en: 'Quantum walks give polynomial speedups for search on graphs and related problems.' }],
    ['walk', 'qsvt', { zh: 'Szegedy 式量子行走的谱结构，正是 qubitization 背后的数学。', en: 'The spectral structure of Szegedy-type walks is the mathematics behind qubitization.' }],
  ],

  // 加速账本与详解共用的算法条目
  algos: [
    // ── 第一层 ─────────────────────────────────────────────────────────
    {
      id: 'query', tier: 1, glyph: '⊕', year: '1985–1994', evidence: 'oracle',
      name: { zh: '线路模型与查询算法', en: 'The circuit model and query algorithms' },
      tagline: { zh: 'Deutsch–Jozsa、Bernstein–Vazirani、Simon：干涉怎样“一次看完”一个函数。', en: 'Deutsch–Jozsa, Bernstein–Vazirani, Simon: how interference “sees” a whole function at once.' },
      problem: { zh: '判断黑盒函数的全局性质（常数还是平衡、隐藏的比特串或周期）', en: 'Decide a global property of a black-box function (constant or balanced, a hidden string or period)' },
      qcost: { zh: 'DJ、BV：1 次查询；Simon：O(n) 次', en: 'DJ, BV: 1 query; Simon: O(n)' },
      ccost: { zh: 'BV：n 次；Simon：约 2^{n/2} 次（随机算法也要）', en: 'BV: n queries; Simon: about 2^{n/2} (even randomised)' },
      speedup: { zh: 'Simon 是黑盒模型里的指数分离；DJ 的优势在允许小概率出错的经典随机算法面前几乎消失', en: 'Simon is an exponential oracle separation; DJ’s edge almost vanishes against classical randomised algorithms that may err with small probability' },
      explain: [
        { zh: '线路模型把计算写成一串作用在 n 个量子比特上的门：单比特门（H、X、Z、S、T 和任意旋转）加一种两比特纠缠门（CNOT）就足以近似任意酉变换。计算结束时测量，得到一个按 |振幅|² 分布的比特串。“量子并行”这个说法容易误导：态里同时有 2^n 个振幅，但一次测量只拿回 n 个比特，算法的全部技巧在于安排干涉，让想要的答案振幅变大。', en: 'The circuit model writes a computation as a sequence of gates on n qubits: single-qubit gates (H, X, Z, S, T and arbitrary rotations) plus one entangling two-qubit gate (CNOT) suffice to approximate any unitary. At the end you measure and get a bit string distributed by |amplitude|². “Quantum parallelism” is misleading: the state holds 2^n amplitudes, but a measurement returns only n bits, so the whole art is arranging interference so that the wanted answer’s amplitude grows.' },
        { zh: '查询算法把问题藏进一个黑盒 U_f|x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩，按调用次数计费。辅助比特放在 |−⟩ 时，调用一次只给 |x⟩ 乘上 (−1)^{f(x)}，这叫相位回踢。Deutsch–Jozsa 用 H^{⊗n} · 相位黑盒 · H^{⊗n}，全零读数的振幅正好是 (−1)^{f(x)} 的平均值：常数函数时为 ±1，平衡函数时为 0，一次查询就能确定地区分。Bernstein–Vazirani 用同一条线路读出 f(x) = s·x 里的隐藏串 s。', en: 'Query algorithms hide the problem in a black box U_f|x⟩|y⟩ = |x⟩|y ⊕ f(x)⟩ and charge per call. With the ancilla in |−⟩, one call just multiplies |x⟩ by (−1)^{f(x)}: phase kickback. Deutsch–Jozsa runs H^{⊗n}, the phase oracle, H^{⊗n}; the amplitude of the all-zero outcome is exactly the average of (−1)^{f(x)}, which is ±1 for a constant function and 0 for a balanced one, so one query decides with certainty. Bernstein–Vazirani uses the same circuit to read the hidden string s in f(x) = s·x.' },
        { zh: 'Simon 问题（f(x) = f(x ⊕ s)，求 s）是第一个连随机经典算法都要指数次查询、量子只要 O(n) 次的例子。它的结构“对群的隐藏子群做傅里叶采样”被 Shor 直接推广到整数，随后统一成隐藏子群问题。要记住这些都是黑盒分离：它们说明干涉的力量，不说明对哪个具体的函数有实用的加速。', en: 'Simon’s problem (f(x) = f(x ⊕ s), find s) was the first case where even randomised classical algorithms need exponentially many queries while a quantum one needs O(n). Its structure, Fourier sampling of a hidden subgroup, was generalised by Shor to the integers and later unified as the hidden subgroup problem. Keep in mind these are oracle separations: they show the power of interference, not a practical speedup for any particular function.' },
      ],
      formulas: ['dj', 'kickback'],
      inChem: [
        { zh: '相位回踢是后面所有“把能量写进相位”的算法（相位估计、Hadamard 测试）的核心技巧。', en: 'Phase kickback is the core trick behind every later algorithm that writes an energy into a phase (phase estimation, the Hadamard test).' },
        { zh: 'Hadamard 测试用一个辅助比特估计 Re⟨ψ|U|ψ⟩，是计算重叠和关联函数的常用工具。', en: 'The Hadamard test estimates Re⟨ψ|U|ψ⟩ with one ancilla and is a standard tool for overlaps and correlation functions.' },
      ],
      pitfalls: [
        { zh: '“同时计算所有输入”不等于能读出所有结果：测量只给 n 个比特。', en: '“Computing all inputs at once” does not mean you can read all results: a measurement gives n bits.' },
        { zh: 'DJ 对确定性经典算法是指数优势，但随机算法查询几次就能以高概率判断，所以它不是实用加速的例子。', en: 'DJ beats deterministic classical algorithms exponentially, but a randomised one decides with high probability after a few queries, so it is not an example of practical speedup.' },
      ],
      checks: [
        { zh: '能手算两比特 Deutsch–Jozsa 线路每一步的态。', en: 'I can work out the state after each step of the two-qubit Deutsch–Jozsa circuit by hand.' },
        { zh: '能解释为什么辅助比特要放在 |−⟩。', en: 'I can explain why the ancilla is prepared in |−⟩.' },
        { zh: '能说出黑盒分离和“对具体问题的加速”有什么区别。', en: 'I can state the difference between an oracle separation and a speedup for a concrete problem.' },
      ],
      demo: { id: 'circuit', preset: 'dj' },
      refs: ['deutsch1992', 'bv1997', 'simon1997', 'cleve1998', 'nielsen2010'],
    },
    {
      id: 'qft', tier: 1, glyph: 'F', year: '1994', evidence: 'subroutine',
      name: { zh: '量子傅里叶变换', en: 'The quantum Fourier transform' },
      tagline: { zh: 'O(n²) 个门完成 2^n 点的离散傅里叶变换，但结果藏在振幅里。', en: 'A 2^n-point discrete Fourier transform in O(n²) gates, with the result hidden in the amplitudes.' },
      problem: { zh: '对振幅做离散傅里叶变换（子程序）', en: 'Discrete Fourier transform of the amplitudes (a subroutine)' },
      qcost: { zh: 'O(n²) 个门，近似版 O(n log n)', en: 'O(n²) gates, O(n log n) approximately' },
      ccost: { zh: 'FFT：O(n·2^n) 次运算', en: 'FFT: O(n·2^n) operations' },
      speedup: { zh: '门数指数地少，但输出不能直接读，只在相位估计、周期查找里有用', en: 'Exponentially fewer gates, but the output cannot be read directly; useful only inside phase estimation and period finding' },
      explain: [
        { zh: 'QFT 把基矢 |j⟩ 变成 2^{−n/2} Σ_k e^{2πi jk/2^n}|k⟩。关键的观察是它可以写成 n 个单比特态的直积：第 l 个比特只带相位 e^{2πi 0.j_{n−l+1}…j_n}。于是线路就是每个比特一个 H，再跟若干受控相位门 R_k = diag(1, e^{2πi/2^k})，最后把比特顺序反过来，一共 n(n+1)/2 个门。', en: 'The QFT maps |j⟩ to 2^{−n/2} Σ_k e^{2πi jk/2^n}|k⟩. The key observation is that the result factorises into n single-qubit states: qubit l only carries the phase e^{2πi 0.j_{n−l+1}…j_n}. The circuit is therefore one H per qubit followed by controlled phase gates R_k = diag(1, e^{2πi/2^k}), then a reversal of the qubit order: n(n+1)/2 gates in all.' },
        { zh: '角度很小的 R_k（k 大于 log n 左右）对结果影响很小，可以直接丢掉，误差可控，这就是近似 QFT。逆 QFT 是相位估计的最后一步：它把“相位按二进制展开写在各个比特上”这种态变回计算基矢，于是测量直接读出相位的二进制数字。', en: 'The R_k with tiny angles (k beyond about log n) hardly matter and can be dropped with controlled error: the approximate QFT. The inverse QFT is the last step of phase estimation: it turns a state whose qubits carry the binary digits of a phase back into a computational basis state, so a measurement reads the phase digits directly.' },
        { zh: '别把 QFT 当作“更快的 FFT”。经典 FFT 给你全部 2^n 个系数；QFT 只把它们放进振幅，测量一次只能抽出一个下标。它真正的用处是在态已经有周期结构的时候，把周期变成尖峰，让一次测量就有很大概率落在有用的位置。', en: 'Do not read the QFT as a faster FFT. A classical FFT hands you all 2^n coefficients; the QFT only places them in amplitudes, and one measurement samples a single index. Its real use is when the state already has periodic structure: the QFT turns the period into sharp peaks so that one measurement lands somewhere useful with high probability.' },
      ],
      formulas: ['qft', 'qftprod'],
      inChem: [
        { zh: '相位估计（包括化学能量的相位估计）都以逆 QFT 收尾；也有只用一个辅助比特、逐位读相位的迭代版本，省掉整块 QFT。', en: 'Every phase estimation, including for chemical energies, ends with an inverse QFT; iterative versions read the phase one bit at a time with a single ancilla and skip the full QFT.' },
        { zh: '平面波基底下的化学和材料模拟在坐标和动量之间切换，也用到 QFT。', en: 'Plane-wave simulations of chemistry and materials switch between position and momentum with the QFT as well.' },
      ],
      pitfalls: [
        { zh: '线路末尾的比特反转经常被省略：省略时要在后续读数里把比特顺序倒过来。', en: 'The final bit reversal is often omitted; then the bit order must be reversed when reading results.' },
        { zh: 'QFT 不能加速“给我所有傅里叶系数”这类任务，因为读出需要指数次测量。', en: 'The QFT cannot speed up “give me all Fourier coefficients”, because reading them out would take exponentially many measurements.' },
      ],
      checks: [
        { zh: '能写出三比特 QFT 的完整线路，并解释每个受控相位的角度。', en: 'I can draw the full three-qubit QFT and explain each controlled-phase angle.' },
        { zh: '能证明 QFT 的输出是直积态。', en: 'I can prove that the QFT output is a product state.' },
        { zh: '能说出 QFT 和 FFT 在“得到什么”上的区别。', en: 'I can say how what you get from the QFT differs from what you get from an FFT.' },
      ],
      practice: {
        title: { zh: '用 numpy 验证 QFT 等于归一化的 DFT 矩阵', en: 'Check with numpy that the QFT equals the normalised DFT matrix' },
        body: { zh: '按“H + 受控相位 + 比特反转”的线路一个门一个门地乘出 3 比特 QFT 的矩阵，与 np.fft 给出的矩阵比较。注意 numpy 的 fft 用 e^{−2πi}，量子约定是 e^{+2πi}，所以对应 ifft 乘以 √N。', en: 'Multiply out the three-qubit QFT gate by gate (H, controlled phases, bit reversal) and compare with the matrix from np.fft. numpy’s fft uses e^{−2πi} while the quantum convention is e^{+2πi}, so the match is ifft times √N.' },
        code: `import numpy as np
n = 3; N = 2**n
I = np.eye(2); H = np.array([[1, 1], [1, -1]]) / np.sqrt(2)

def on(q, U):                      # U on qubit q (qubit 0 = most significant)
    out = np.array([[1.0]])
    for k in range(n):
        out = np.kron(out, U if k == q else I)
    return out

def cphase(c, t, phi):             # controlled phase between qubits c and t
    D = np.ones(N, complex)
    for i in range(N):
        if (i >> (n-1-c)) & 1 and (i >> (n-1-t)) & 1:
            D[i] = np.exp(1j * phi)
    return np.diag(D)

def swap(a, b):
    P = np.zeros((N, N))
    for i in range(N):
        ba, bb = (i >> (n-1-a)) & 1, (i >> (n-1-b)) & 1
        j = i & ~(1 << (n-1-a)) & ~(1 << (n-1-b)) | (bb << (n-1-a)) | (ba << (n-1-b))
        P[j, i] = 1
    return P

U = np.eye(N, dtype=complex)
for i in range(n):
    U = on(i, H) @ U
    for j in range(i + 1, n):
        U = cphase(j, i, 2*np.pi / 2**(j-i+1)) @ U
U = swap(0, n-1) @ U
F = np.fft.ifft(np.eye(N), axis=0) * np.sqrt(N)
print(np.allclose(U, F))           # True`,
      },
      demo: { id: 'circuit', preset: 'qft' },
      refs: ['shor1997', 'cleve1998', 'nielsen2010', 'dewolf2019'],
    },
    {
      id: 'qpe', tier: 1, glyph: 'φ', year: '1995', evidence: 'subroutine',
      name: { zh: '量子相位估计', en: 'Quantum phase estimation' },
      tagline: { zh: '把酉算符的本征值读成二进制数：Shor 和化学能量计算的共同核心。', en: 'Reads a unitary’s eigenvalue as a binary number: the shared core of Shor and of chemical energies.' },
      problem: { zh: '给定 U 和它的本征态（或与本征态有重叠的态），估计本征相位 φ', en: 'Given U and an eigenstate (or a state overlapping one), estimate the eigenphase φ' },
      qcost: { zh: '精度 ε 需要约 1/ε 次受控 U', en: 'About 1/ε controlled-U applications for precision ε' },
      ccost: { zh: '对角化：维数的多项式，即比特数的指数', en: 'Diagonalisation: polynomial in the dimension, exponential in qubits' },
      speedup: { zh: '对“能高效实现 U、能制备好初态”的问题是指数加速；难点常在初态', en: 'Exponential when U is efficient and a good initial state can be prepared; the hard part is often the initial state' },
      explain: [
        { zh: '设 U|u⟩ = e^{2πiφ}|u⟩。准备 t 个计数比特都在 |+⟩，让第 k 个计数比特控制 U^{2^k}。由于相位回踢，计数寄存器变成 2^{−t/2} Σ_j e^{2πi jφ}|j⟩，这正是 |2^tφ⟩ 的 QFT。做逆 QFT 再测量，就读出 φ 的前 t 位二进制数字。', en: 'Let U|u⟩ = e^{2πiφ}|u⟩. Put t counting qubits in |+⟩ and let counting qubit k control U^{2^k}. Through phase kickback the counting register becomes 2^{−t/2} Σ_j e^{2πi jφ}|j⟩, which is exactly the QFT of |2^tφ⟩. Apply the inverse QFT and measure: you read the first t binary digits of φ.' },
        { zh: '如果 φ 正好是 t 位二进制小数，读数是确定的；否则读数集中在最接近的两个格点上，落在最近格点的概率至少 4/π² ≈ 40.5%。精度 ε 需要总共约 1/ε 次 U 的作用，这是 Heisenberg 极限，比重复测量的 1/ε² 好一个平方。', en: 'If φ is exactly a t-bit fraction the outcome is certain; otherwise it concentrates on the two nearest grid points, with probability at least 4/π² ≈ 40.5% on the nearest one. Precision ε needs about 1/ε applications of U in total: the Heisenberg limit, a square better than the 1/ε² of repeated sampling.' },
        { zh: '如果输入不是本征态，而是叠加 Σ c_j|u_j⟩，相位估计以概率 |c_j|² 读出 φ_j 并把态投影到 |u_j⟩。这是相位估计能“制备”基态的原因，也是它最大的软肋：初态与目标态的重叠太小时，要重复很多次才碰得到。实际的化学计算多用只要一个辅助比特的迭代或 Bayesian 版本。', en: 'If the input is not an eigenstate but a superposition Σ c_j|u_j⟩, phase estimation reads φ_j with probability |c_j|² and projects onto |u_j⟩. That is why it can “prepare” a ground state and also its weakest point: with small overlap between the initial and target states you must repeat many times. Practical chemistry calculations favour iterative or Bayesian versions with a single ancilla.' },
      ],
      formulas: ['qpe', 'qpedist'],
      inChem: [
        { zh: 'U = e^{−iHt} 时，φ = −E t/2π：相位估计直接给出分子能量，误差只由 t 的位数和 e^{−iHt} 的实现误差决定。', en: 'With U = e^{−iHt}, φ = −Et/2π: phase estimation returns a molecular energy, with error set only by the number of bits and by how accurately e^{−iHt} is implemented.' },
        { zh: '初态通常取 Hartree–Fock 或一个小的 CASSCF/DMRG 波函数；强关联体系里它与真实基态的重叠可能很小。', en: 'The initial state is usually Hartree–Fock or a small CASSCF/DMRG wavefunction; in strongly correlated systems its overlap with the true ground state can be small.' },
      ],
      pitfalls: [
        { zh: '“相位估计给出精确的 FCI 能量”只在初态重叠足够大、e^{−iHt} 实现足够准时成立。', en: '“Phase estimation gives the exact FCI energy” holds only if the initial overlap is large enough and e^{−iHt} is implemented accurately.' },
        { zh: '相位有 2π 周期：t 选得太大时不同能量会混叠，要先知道能量的大致范围。', en: 'Phases are 2π-periodic: too large a t aliases different energies, so you need a rough energy range first.' },
      ],
      checks: [
        { zh: '能推导计数寄存器在逆 QFT 之前的态。', en: 'I can derive the counting register’s state just before the inverse QFT.' },
        { zh: '能解释 4/π² 这个下界是怎么来的。', en: 'I can explain where the 4/π² bound comes from.' },
        { zh: '能说明初态重叠怎样影响总的运行次数。', en: 'I can explain how the initial overlap affects the total number of runs.' },
      ],
      practice: {
        title: { zh: '相位估计的读数分布', en: 'The outcome distribution of phase estimation' },
        body: { zh: '对 φ = 0.3、t = 5，用公式算出全部 32 个读数的概率，验证它们加起来是 1，最可能的读数是 round(32·0.3) = 10。', en: 'For φ = 0.3 and t = 5, compute the probabilities of all 32 outcomes from the formula, check that they sum to 1 and that the most likely outcome is round(32·0.3) = 10.' },
        code: `import numpy as np
phi, t = 0.3, 5
T = 2**t
m = np.arange(T)
amp = np.exp(2j*np.pi*np.outer(np.arange(T), phi - m/T)).sum(axis=0) / T
p = np.abs(amp)**2
print(round(p.sum(), 12), p.argmax(), round(p.max(), 4))   # 1.0 10 0.5731`,
      },
      demo: { id: 'qpe' },
      refs: ['kitaev1995', 'cleve1998', 'abrams1999', 'nielsen2010'],
    },
    {
      id: 'aa', tier: 1, glyph: '√N', year: '1996', evidence: 'proven',
      name: { zh: '振幅放大与 Grover 搜索', en: 'Amplitude amplification and Grover search' },
      tagline: { zh: '在 N 个元素里找标记项只要约 (π/4)√N 次查询，而且不可能更少。', en: 'Finds a marked item among N in about (π/4)√N queries, and no algorithm can do better.' },
      problem: { zh: '无结构搜索；更一般地，把成功概率为 p 的过程放大到接近 1', en: 'Unstructured search; more generally, boosting a procedure that succeeds with probability p to near 1' },
      qcost: { zh: 'O(√(N/M)) 次查询；一般为 O(1/√p)', en: 'O(√(N/M)) queries; O(1/√p) in general' },
      ccost: { zh: 'O(N/M) 次查询', en: 'O(N/M) queries' },
      speedup: { zh: '二次加速，在查询模型里证明是最优的；扣除纠错开销后，实用优势要求问题非常大', en: 'Quadratic, proven optimal in the query model; after error-correction overheads a practical advantage needs very large instances' },
      explain: [
        { zh: '从均匀叠加出发，Grover 迭代由两次反射组成：先用黑盒把标记项的振幅取负，再做“关于平均值的反射” 2|s⟩⟨s| − I。两次反射的乘积是一个转动：在“标记态”和“未标记态”张成的平面里，每次把态向标记态转 2θ，其中 sin θ = √(M/N)。k 次之后成功概率是 sin²((2k+1)θ)。', en: 'Starting from the uniform superposition, a Grover iteration is two reflections: the oracle flips the sign of the marked amplitudes, then a reflection about the mean, 2|s⟩⟨s| − I. Their product is a rotation: in the plane spanned by the marked and unmarked states, each iteration turns the state 2θ toward the marked state, with sin θ = √(M/N). After k iterations the success probability is sin²((2k+1)θ).' },
        { zh: '所以最佳迭代次数约 (π/4)√(N/M)，转过头成功率反而下降，这和经典搜索“多查总不会更差”很不一样。Bennett、Bernstein、Brassard 和 Vazirani 证明了任何量子算法都需要 Ω(√N) 次查询，Grover 是最优的：量子计算机不能用穷举法指数加速地解决 NP 完全问题。', en: 'The best number of iterations is therefore about (π/4)√(N/M); going further lowers the success rate, unlike classical search where more queries never hurt. Bennett, Bernstein, Brassard and Vazirani proved that any quantum algorithm needs Ω(√N) queries, so Grover is optimal: a quantum computer cannot solve NP-complete problems exponentially faster by brute force.' },
        { zh: '振幅放大把这个想法推广到任意子程序：若子程序 A 成功的概率是 p，重复“A、反射、A⁻¹、反射”约 1/√p 次就能把成功率提到接近 1。振幅估计则用相位估计读出转角，把蒙特卡洛的误差从 1/√(样本数) 改进到 1/(调用次数)。这两件事是许多算法里的二次加速来源。', en: 'Amplitude amplification generalises the idea to any subroutine: if A succeeds with probability p, about 1/√p rounds of “A, reflect, A⁻¹, reflect” push success close to 1. Amplitude estimation reads the rotation angle with phase estimation and improves Monte Carlo error from 1/√(samples) to 1/(calls). These two are the source of the quadratic speedups in many algorithms.' },
      ],
      formulas: ['grover', 'groverk'],
      inChem: [
        { zh: '振幅估计可把期望值的测量从 1/ε² 次降到 1/ε 次，但需要相干的长线路，近期设备上做不到。', en: 'Amplitude estimation can cut the measurement of an expectation value from 1/ε² to 1/ε runs, but needs long coherent circuits that near-term devices cannot run.' },
        { zh: '在化学里直接用 Grover 搜索构型空间不现实：二次加速填不平纠错的常数开销。', en: 'Using Grover directly to search configuration space is unrealistic in chemistry: a quadratic speedup does not repay the constant overhead of error correction.' },
      ],
      pitfalls: [
        { zh: '不知道标记项个数 M 时，不能直接套 (π/4)√N；要用随机选 k 或量子计数先估 M。', en: 'When the number of marked items M is unknown you cannot just use (π/4)√N; choose k at random or estimate M by quantum counting first.' },
        { zh: 'Babbush 等（2021）估算：在可预见的容错硬件上，只有二次加速的算法很难胜过经典计算机，因为每次逻辑操作慢了好几个数量级。', en: 'Babbush et al. (2021) estimate that on foreseeable fault-tolerant hardware a merely quadratic speedup will struggle to beat classical computers, because each logical operation is several orders of magnitude slower.' },
      ],
      checks: [
        { zh: '能用二维平面里的转动解释 Grover 迭代。', en: 'I can explain the Grover iteration as a rotation in a plane.' },
        { zh: '能算出 N = 2^{20}、M = 1 时的最佳迭代次数。', en: 'I can compute the optimal number of iterations for N = 2^{20}, M = 1.' },
        { zh: '能说明为什么 Grover 不能让 NP 完全问题变成多项式时间。', en: 'I can explain why Grover does not make NP-complete problems polynomial-time.' },
      ],
      practice: {
        title: { zh: '模拟 Grover，画成功率随迭代的振荡', en: 'Simulate Grover and watch the success rate oscillate' },
        body: { zh: '直接对 2^8 维的实向量做“取负 + 关于平均值反射”，与 sin²((2k+1)θ) 比较；再看 k 超过最佳值后成功率怎样下降。', en: 'Act directly on a 2^8-dimensional real vector with “flip + reflect about the mean”, compare with sin²((2k+1)θ), and see how success falls once k passes the optimum.' },
        code: `import numpy as np
n, marked = 8, [37]
N = 2**n
psi = np.full(N, 1/np.sqrt(N))
theta = np.arcsin(np.sqrt(len(marked)/N))
for k in range(1, 26):
    psi[marked] *= -1
    psi = 2*psi.mean() - psi
    p = (psi[marked]**2).sum()
    assert abs(p - np.sin((2*k+1)*theta)**2) < 1e-12
    print(k, round(p, 4))           # peaks at k = 12 (0.9999), back down by k = 25`,
      },
      demo: { id: 'grover' },
      refs: ['grover1997', 'bbbv1997', 'brassard2002', 'montanaro2015', 'babbush2021'],
    },
    {
      id: 'qsvt', tier: 1, glyph: 'Σ', year: '2012–2019', evidence: 'subroutine',
      name: { zh: '块编码、LCU 与 QSVT', en: 'Block encodings, LCU and QSVT' },
      tagline: { zh: '把不是酉的矩阵塞进酉矩阵的一角，再对它的奇异值做多项式：现代量子算法的“统一语言”。', en: 'Put a non-unitary matrix in the corner of a unitary and apply polynomials to its singular values: the common language of modern quantum algorithms.' },
      problem: { zh: '对矩阵 A 实现 f(A)（指数、逆、符号函数、投影……）', en: 'Implement f(A) for a matrix A (exponential, inverse, sign function, projector …)' },
      qcost: { zh: '多项式次数 d 次调用块编码', en: 'd calls to the block encoding for a degree-d polynomial' },
      ccost: { zh: '视问题而定', en: 'Depends on the problem' },
      speedup: { zh: '本身是框架；它把搜索、相位估计、哈密顿量模拟和线性方程组写成同一种线路', en: 'A framework in itself; it writes search, phase estimation, Hamiltonian simulation and linear systems as the same kind of circuit' },
      explain: [
        { zh: '量子计算机只能做酉变换，可哈密顿量、系数矩阵都不是酉的。块编码的办法是找一个更大的酉矩阵 U，让 (⟨0|⊗I) U (|0⟩⊗I) = A/α：只要辅助比特读到 0，系统上就作用了 A/α。α 是归一化因子，决定后面的代价。LCU（酉算符的线性组合）是最常用的构造：若 H = Σ_j α_j U_j，用 PREPARE 把系数写进辅助寄存器、用 SELECT 按寄存器施加 U_j，就得到 α = Σ|α_j| 的块编码。', en: 'A quantum computer can only apply unitaries, yet Hamiltonians and coefficient matrices are not unitary. A block encoding is a larger unitary U with (⟨0|⊗I) U (|0⟩⊗I) = A/α: whenever the ancilla reads 0, A/α has acted on the system. The normalisation α sets the later cost. LCU (linear combination of unitaries) is the usual construction: if H = Σ_j α_j U_j, PREPARE writes the coefficients into an ancilla register and SELECT applies U_j controlled on it, giving a block encoding with α = Σ|α_j|.' },
        { zh: '量子信号处理（QSP）发现：在块编码和辅助比特上的单比特旋转之间交替，可以对 A 的每个本征值（一般是奇异值）施加几乎任意的有界多项式 P(x)，次数为 d 时只需 d 次调用。选 P 逼近 e^{−ixt} 就是哈密顿量模拟，逼近 1/x 就是解线性方程组，逼近阶跃函数就是投影到低能子空间或做振幅放大。', en: 'Quantum signal processing (QSP) shows that alternating the block encoding with single-qubit rotations on the ancilla applies an almost arbitrary bounded polynomial P(x) to each eigenvalue (in general, singular value) of A, using d calls for degree d. Choose P ≈ e^{−ixt} and you get Hamiltonian simulation; P ≈ 1/x solves linear systems; a step function projects onto a low-energy subspace or performs amplitude amplification.' },
        { zh: 'Gilyén、Su、Low 和 Wiebe（2019）把它推广成量子奇异值变换（QSVT），Martyn 等（2021）称之为量子算法的“大统一”。实际代价由两件事决定：块编码的 α 有多大、需要多高次的多项式。化学里大量研究都在降 α：双因子分解、张量超收缩（THC）都是为了让化学哈密顿量的块编码更“便宜”。', en: 'Gilyén, Su, Low and Wiebe (2019) generalised this to the quantum singular value transformation (QSVT), which Martyn et al. (2021) called a grand unification of quantum algorithms. The practical cost comes down to two numbers: how large α is and what polynomial degree is needed. Much chemistry research lowers α: double factorisation and tensor hypercontraction (THC) exist to make the block encoding of a chemistry Hamiltonian cheaper.' },
      ],
      formulas: ['blockenc', 'lcu'],
      inChem: [
        { zh: '化学哈密顿量的 α（系数的 1 范数，常记作 λ）直接乘进相位估计的总代价，是比较不同分解方法的主要指标。', en: 'The α of a chemistry Hamiltonian (the 1-norm of its coefficients, often written λ) multiplies the total cost of phase estimation and is the main figure for comparing factorisations.' },
        { zh: 'Lee 等（2021）用 THC 块编码把 FeMoco 的估算降到约四百万物理比特、不到四天（见资源估算表）。', en: 'Lee et al. (2021) used a THC block encoding to bring FeMoco down to about four million physical qubits and under four days (see the resource table).' },
      ],
      pitfalls: [
        { zh: '块编码“成功”需要辅助比特读到 0，概率是 ‖A|ψ⟩‖²/α²，不加振幅放大时可能很小。', en: 'A block encoding succeeds only when the ancilla reads 0, with probability ‖A|ψ⟩‖²/α², which can be small without amplitude amplification.' },
        { zh: '多项式次数受 α 和所需精度控制；α 大就意味着线路深。', en: 'The polynomial degree is controlled by α and the precision required; a large α means a deep circuit.' },
      ],
      checks: [
        { zh: '能为 H = aX + bZ 写出 LCU 块编码，并说明 α。', en: 'I can write an LCU block encoding of H = aX + bZ and state α.' },
        { zh: '能说出 QSVT 用哪种多项式实现哈密顿量模拟和线性方程组。', en: 'I can name the polynomials QSVT uses for Hamiltonian simulation and for linear systems.' },
        { zh: '能解释化学里为什么要降低 λ。', en: 'I can explain why chemists work to reduce λ.' },
      ],
      refs: ['childswiebe2012', 'berry2015', 'lowchuang2017', 'lowchuang2019', 'gilyen2019', 'martyn2021', 'lin2022'],
    },

    // ── 第二层 ─────────────────────────────────────────────────────────
    {
      id: 'shor', tier: 2, glyph: 'pq', year: '1994', evidence: 'believed',
      name: { zh: 'Shor 因数分解与离散对数', en: 'Shor’s factoring and discrete logarithms' },
      tagline: { zh: '把因数分解归结为求周期，再用相位估计找周期：多项式时间。', en: 'Reduces factoring to period finding and finds the period with phase estimation: polynomial time.' },
      problem: { zh: '分解 n 位整数 N；求有限群里的离散对数', en: 'Factor an n-bit integer N; compute discrete logarithms in finite groups' },
      qcost: { zh: 'O(n³) 个门（用快速乘法可更低）', en: 'O(n³) gates (lower with fast multiplication)' },
      ccost: { zh: '数域筛法：exp(O(n^{1/3}(log n)^{2/3}))', en: 'Number field sieve: exp(O(n^{1/3}(log n)^{2/3}))' },
      speedup: { zh: '相对已知最好的经典算法是超多项式加速；“经典没有快速算法”没有证明', en: 'Superpolynomial over the best known classical algorithm; that no fast classical algorithm exists is unproven' },
      explain: [
        { zh: '随机取与 N 互素的 a，函数 f(x) = a^x mod N 有周期 r（a 的阶）。若 r 是偶数且 a^{r/2} ≢ −1 (mod N)，那么 gcd(a^{r/2} ± 1, N) 就是 N 的非平凡因子。随机的 a 以至少一半的概率满足条件。这一步全是经典数论，量子计算机只负责最难的部分：找 r。', en: 'Pick a random a coprime to N. The function f(x) = a^x mod N has a period r (the order of a). If r is even and a^{r/2} ≢ −1 (mod N), then gcd(a^{r/2} ± 1, N) is a non-trivial factor of N. A random a works with probability at least one half. All of this is classical number theory; the quantum computer does only the hard part: finding r.' },
        { zh: '找周期就是对 U|y⟩ = |ay mod N⟩ 做相位估计。U 的本征值是 e^{2πi s/r}，从 |1⟩ 出发相当于所有 s 的均匀叠加，所以读出的是某个 s/r 的近似值；用连分数展开就能得到 r。线路里最贵的是受控的模幂运算 a^{2^k} mod N，它是可逆的整数算术，QFT 反而很便宜。', en: 'Period finding is phase estimation on U|y⟩ = |ay mod N⟩. U has eigenvalues e^{2πi s/r}, and |1⟩ is a uniform superposition over all s, so the readout approximates some s/r; a continued-fraction expansion recovers r. The expensive part of the circuit is the controlled modular exponentiation a^{2^k} mod N, which is reversible integer arithmetic; the QFT is cheap by comparison.' },
        { zh: '同样的结构解决离散对数，因此 RSA、Diffie–Hellman 和椭圆曲线密码都会被足够大的容错量子计算机攻破，这是“后量子密码”标准化的直接原因。资源估算一直在下降：Gidney 和 Ekerå（2021）估计分解 2048 位 RSA 约需 2000 万个噪声比特、8 小时；Gidney（2025，预印本）把比特数降到一百万以下、时间不到一周。两者都假设 10⁻³ 的物理门错误率和 1 微秒的表面码周期。', en: 'The same structure solves discrete logarithms, so RSA, Diffie–Hellman and elliptic-curve cryptography would all fall to a large enough fault-tolerant quantum computer, which is the direct reason for post-quantum cryptography standards. Resource estimates keep falling: Gidney and Ekerå (2021) estimated about 20 million noisy qubits and 8 hours for 2048-bit RSA; Gidney (2025, preprint) brought it under a million qubits and under a week. Both assume a 10⁻³ physical gate error rate and a 1 μs surface-code cycle.' },
      ],
      formulas: ['shor', 'shorgcd'],
      inChem: [
        { zh: '与化学没有直接关系，但“相位估计 + 经典后处理”的分工和化学能量计算完全一样。', en: 'Not chemistry, but the division of labour (phase estimation plus classical post-processing) is exactly the same as for chemical energies.' },
        { zh: 'Shor 的资源估算方法（表面码、魔术态工厂、时空体积）也被直接用于化学的资源估算。', en: 'The resource-estimation methods developed for Shor (surface code, magic-state factories, spacetime volume) are used directly for chemistry estimates.' },
      ],
      pitfalls: [
        { zh: '2001 年起实验“分解 15、21”的演示大多在线路里预先用了答案，不能当作算法规模的进展。', en: 'Most experimental “factorisations of 15 and 21” since 2001 built knowledge of the answer into the circuit and are not evidence of algorithmic scale.' },
        { zh: '因数分解不被认为是 NP 完全的；Shor 不意味着量子计算机能高效解 NP 完全问题。', en: 'Factoring is not believed to be NP-complete; Shor does not imply that quantum computers solve NP-complete problems efficiently.' },
      ],
      checks: [
        { zh: '能手算 N = 15、a = 7 的阶并得到因子。', en: 'I can compute the order for N = 15, a = 7 by hand and get the factors.' },
        { zh: '能解释读数 m/2^t 怎样经连分数给出 r。', en: 'I can explain how a readout m/2^t yields r through continued fractions.' },
        { zh: '能说出量子线路里最贵的部分是哪一块。', en: 'I can name the most expensive part of the quantum circuit.' },
      ],
      demo: { id: 'shor' },
      refs: ['shor1997', 'simon1997', 'gidney2021', 'gidney2025', 'nielsen2010'],
    },
    {
      id: 'hamsim', tier: 2, glyph: 'Uₜ', year: '1996–2019', evidence: 'believed',
      name: { zh: '哈密顿量模拟', en: 'Hamiltonian simulation' },
      tagline: { zh: '费曼最初的设想：在量子计算机上实现 e^{−iHt}。从 Trotter 公式到 qubitization。', en: 'Feynman’s original idea: implement e^{−iHt} on a quantum computer. From Trotter formulas to qubitization.' },
      problem: { zh: '对局域或稀疏的 H 实现 e^{−iHt}，误差 ε', en: 'Implement e^{−iHt} to error ε for a local or sparse H' },
      qcost: { zh: '最优：O(αt + log(1/ε)) 次调用块编码', en: 'Optimal: O(αt + log(1/ε)) block-encoding calls' },
      ccost: { zh: '一般情形：维数的指数（张量网络对低纠缠情形有效）', en: 'In general exponential in the qubit count (tensor networks work for low entanglement)' },
      speedup: { zh: '实时演化是 BQP 完全问题：如果它有高效的经典算法，所有量子算法都有', en: 'Real-time evolution is BQP-complete: an efficient classical algorithm for it would give one for every quantum algorithm' },
      explain: [
        { zh: 'Lloyd（1996）指出：若 H = Σ_j H_j 由许多只作用在几个比特上的项组成，每一项的 e^{−iH_jτ} 都容易实现，把它们依次作用、重复 r 次（Trotter–Suzuki 乘积公式），误差就随 r 减小。一阶公式的误差约为 t²Σ‖[H_j, H_k]‖/(2r)，二阶对称公式降到 O(t³/r²)。Childs 等（2021）证明了误差由对易子而不是各项范数控制，这使得乘积公式在实践中比旧的界好得多。', en: 'Lloyd (1996) observed that if H = Σ_j H_j consists of many terms each acting on a few qubits, every e^{−iH_jτ} is easy; apply them in turn and repeat r times (Trotter–Suzuki product formulas) and the error falls with r. The first-order error is about t²Σ‖[H_j, H_k]‖/(2r); the symmetric second-order formula brings it to O(t³/r²). Childs et al. (2021) proved that the error is governed by commutators rather than by the norms of the terms, which makes product formulas far better in practice than older bounds suggested.' },
        { zh: '乘积公式的代价对精度是多项式的 1/ε^{1/p}。LCU 截断泰勒级数（Berry 等 2015）首次把它降到 log(1/ε)；量子信号处理与 qubitization（Low 和 Chuang 2017、2019）达到 O(αt + log(1/ε)) 的最优形式。qDRIFT（Campbell 2019）按系数大小随机抽项，代价只依赖 λ = Σ|h_j| 而不依赖项数，适合项数极多的化学哈密顿量。', en: 'Product formulas cost a polynomial 1/ε^{1/p} in precision. LCU with a truncated Taylor series (Berry et al. 2015) first reduced this to log(1/ε); quantum signal processing and qubitization (Low and Chuang 2017, 2019) reach the optimal O(αt + log(1/ε)). qDRIFT (Campbell 2019) samples terms at random in proportion to their weights, so its cost depends on λ = Σ|h_j| rather than on the number of terms, which suits chemistry Hamiltonians with enormous numbers of terms.' },
        { zh: '选哪种方法没有统一答案：qubitization 渐近最优，但需要很多辅助比特和复杂的 PREPARE 线路；高阶 Trotter 公式不需要辅助比特，对局域晶格模型的常数往往更小。哈密顿量模拟本身也是目标：分子的量子动力学、核磁谱、晶格模型的淬火，都是可能先于基态能量出现实用优势的问题。', en: 'There is no single best method: qubitization is asymptotically optimal but needs many ancillas and an involved PREPARE circuit; high-order Trotter formulas need no ancillas and often have smaller constants for local lattice models. Simulation is also a goal in its own right: molecular quantum dynamics, NMR spectra and quenches of lattice models are candidates for practical advantage possibly earlier than ground-state energies.' },
      ],
      formulas: ['trotter1', 'trotter2', 'qubitization'],
      inChem: [
        { zh: '化学哈密顿量有 O(N⁴) 项，直接 Trotter 化代价很高；先做双因子分解或 THC 再模拟是主流做法。', en: 'A chemistry Hamiltonian has O(N⁴) terms, so naive Trotterisation is expensive; factorising first (double factorisation, THC) is the mainstream approach.' },
        { zh: '非绝热动力学、光谱和反应速率可直接从实时演化得到，这些对经典方法同样困难。', en: 'Non-adiabatic dynamics, spectra and rates follow directly from real-time evolution, and are equally hard classically.' },
      ],
      pitfalls: [
        { zh: '旧的 Trotter 误差界通常比实际误差大几个数量级；资源估算要用对易子界或数值实测。', en: 'Old Trotter error bounds often overestimate the real error by orders of magnitude; resource estimates should use commutator bounds or measured errors.' },
        { zh: '“模拟 t 时间”的代价至少与 t 成正比（不能快进），这是被证明了的下界。', en: 'Simulating for time t costs at least proportional to t (no fast-forwarding in general), a proven lower bound.' },
      ],
      checks: [
        { zh: '能推导一阶 Trotter 误差的主项。', en: 'I can derive the leading term of the first-order Trotter error.' },
        { zh: '能说出 qDRIFT 适合什么样的哈密顿量。', en: 'I can say which Hamiltonians qDRIFT suits.' },
        { zh: '能比较 Trotter 和 qubitization 在辅助比特与常数上的取舍。', en: 'I can compare Trotter and qubitization on ancillas and constants.' },
      ],
      practice: {
        title: { zh: '数值测一阶和二阶 Trotter 的误差阶', en: 'Measure the order of first- and second-order Trotter error' },
        body: { zh: '对 H = X + Z（单比特）用 scipy 的 expm 比较 (e^{−iXτ}e^{−iZτ})^r 与 e^{−iHt}，r 翻倍时误差应分别减半和变为四分之一。', en: 'For H = X + Z (one qubit), compare (e^{−iXτ}e^{−iZτ})^r with e^{−iHt} using scipy’s expm; doubling r should halve the first-order error and quarter the second-order error.' },
        code: `import numpy as np
from scipy.linalg import expm
X = np.array([[0, 1], [1, 0]]); Z = np.diag([1, -1])
t = 1.0; exact = expm(-1j*t*(X + Z))
for r in [10, 20, 40, 80]:
    tau = t / r
    S1 = np.linalg.matrix_power(expm(-1j*tau*X) @ expm(-1j*tau*Z), r)
    S2 = np.linalg.matrix_power(expm(-0.5j*tau*Z) @ expm(-1j*tau*X) @ expm(-0.5j*tau*Z), r)
    print(r, np.linalg.norm(S1 - exact, 2), np.linalg.norm(S2 - exact, 2))   # 1st order halves, 2nd order quarters`,
      },
      demo: { id: 'trotter' },
      refs: ['feynman1982', 'lloyd1996', 'berry2015', 'lowchuang2017', 'lowchuang2019', 'campbell2019', 'childs2021'],
    },
    {
      id: 'hhl', tier: 2, glyph: 'A⁻¹', year: '2009', evidence: 'conditional',
      name: { zh: '线性方程组（HHL）与量子机器学习的边界', en: 'Linear systems (HHL) and the limits of quantum machine learning' },
      tagline: { zh: '对数时间“解”方程组，但每个前提都要细读。', en: 'Solving linear systems in logarithmic time, if you read every condition in the fine print.' },
      problem: { zh: '给定稀疏、条件数为 κ 的 A 和 |b⟩，制备 |x⟩ ∝ A⁻¹|b⟩', en: 'Given a sparse A with condition number κ and |b⟩, prepare |x⟩ ∝ A⁻¹|b⟩' },
      qcost: { zh: '原始 HHL：Õ(log N · s²κ²/ε)；后续改进到对 κ 近线性', en: 'Original HHL: Õ(log N · s²κ²/ε); later improved to near-linear in κ' },
      ccost: { zh: '共轭梯度：O(N s κ log(1/ε))', en: 'Conjugate gradient: O(N s κ log(1/ε))' },
      speedup: { zh: '只有在数据能高效载入、只需要量子态形式的输出、κ 小时才是指数加速', en: 'Exponential only if data loads efficiently, the output is wanted as a quantum state and κ is small' },
      explain: [
        { zh: 'Harrow、Hassidim 和 Lloyd（2009）的算法：对 e^{iAt} 做相位估计，把 A 的本征值 λ_j 写进寄存器；按寄存器做受控旋转，以振幅 C/λ_j 标记辅助比特；再反算相位估计、测量辅助比特。成功时系统处于 Σ_j β_j λ_j⁻¹ |u_j⟩ ∝ A⁻¹|b⟩。代价对维数 N 只有对数依赖，这是它引起轰动的原因。', en: 'The algorithm of Harrow, Hassidim and Lloyd (2009): phase-estimate e^{iAt} to write A’s eigenvalues λ_j into a register; rotate an ancilla controlled on it with amplitude C/λ_j; uncompute the phase estimation and measure the ancilla. On success the system is in Σ_j β_j λ_j⁻¹ |u_j⟩ ∝ A⁻¹|b⟩. The cost depends only logarithmically on the dimension N, which is why it caused a stir.' },
        { zh: 'Aaronson（2015）列出了“细则”：|b⟩ 必须能快速制备（不能先花 O(N) 时间读入数据）；A 要稀疏且条件数小；输出是量子态，读出所有分量又要 O(N) 次测量，只有当你要的是 ⟨x|M|x⟩ 这类全局量时才有意义。去掉任何一条，指数优势就可能消失。', en: 'Aaronson (2015) spelled out the fine print: |b⟩ must be prepared quickly (you cannot spend O(N) time loading data); A must be sparse and well conditioned; the output is a quantum state, and reading all its entries costs O(N) measurements again, so it only makes sense when you want a global quantity such as ⟨x|M|x⟩. Drop any condition and the exponential advantage may disappear.' },
        { zh: '2018 年 Ewin Tang 证明：Kerenidis–Prakash 的量子推荐系统算法所依赖的“量子随机存取”假设，如果给经典算法同样的采样能力，经典算法也只慢多项式倍。这开启了一系列“去量子化”结果，使得许多低秩数据上的量子机器学习加速降为多项式。今天较可信的量子线性代数应用，是输入来自量子模拟本身（而不是经典数据）的问题。', en: 'In 2018 Ewin Tang showed that if a classical algorithm is given the same sampling access that the Kerenidis–Prakash quantum recommendation algorithm assumes, it is only polynomially slower. This opened a series of dequantization results that reduced many quantum machine-learning speedups on low-rank data to polynomial ones. The more credible uses of quantum linear algebra today are problems whose input comes from a quantum simulation rather than from classical data.' },
      ],
      formulas: ['hhl'],
      inChem: [
        { zh: '线性响应、格林函数和某些微分方程可以写成线性方程组，但输入大多是经典数据，需要逐一检查载入代价。', en: 'Linear response, Green’s functions and some differential equations can be written as linear systems, but their inputs are mostly classical data whose loading cost must be checked case by case.' },
      ],
      pitfalls: [
        { zh: '“HHL 指数加速”忽略了数据载入（QRAM 尚无可行的硬件）和读出。', en: '“HHL is exponentially faster” ignores data loading (there is no workable QRAM hardware) and readout.' },
        { zh: '很多量子机器学习论文与未经调优的经典基线比较；去量子化结果说明要和最好的经典随机算法比。', en: 'Many quantum ML papers compare against untuned classical baselines; dequantization shows the comparison must be with the best randomised classical algorithms.' },
      ],
      checks: [
        { zh: '能复述 Aaronson 列出的四条前提。', en: 'I can restate Aaronson’s four conditions.' },
        { zh: '能解释“去量子化”在说什么、没说什么。', en: 'I can explain what dequantization does and does not claim.' },
        { zh: '能举出一个输入来自量子模拟的线性代数问题。', en: 'I can give an example of a linear-algebra problem whose input comes from a quantum simulation.' },
      ],
      refs: ['hhl2009', 'aaronson2015', 'tang2019', 'martyn2021', 'dalzell2023'],
    },
    {
      id: 'walk', tier: 2, glyph: 'W', year: '2003', evidence: 'oracle',
      name: { zh: '量子行走', en: 'Quantum walks' },
      tagline: { zh: '经典随机游走的量子版本：扩散得更快，在某些图上有指数优势。', en: 'The quantum version of a random walk: it spreads faster, with exponential advantages on certain graphs.' },
      problem: { zh: '图上的搜索与穿越、元素互异等组合问题', en: 'Search and traversal on graphs, element distinctness and other combinatorial problems' },
      qcost: { zh: '视问题而定；粘合树：多项式', en: 'Problem-dependent; glued trees: polynomial' },
      ccost: { zh: '粘合树：任何经典算法都要指数次查询', en: 'Glued trees: any classical algorithm needs exponentially many queries' },
      speedup: { zh: '粘合树上是黑盒模型的指数分离；更常见的是多项式加速', en: 'An exponential oracle separation on glued trees; polynomial speedups are more common' },
      explain: [
        { zh: '连续时间量子行走就是用图的邻接矩阵（或拉普拉斯矩阵）当哈密顿量做演化：|ψ(t)⟩ = e^{−iAt}|入口⟩。经典随机游走扩散的距离按 √t 增长，量子行走在一维上按 t 增长（弹道式），因为不同路径的振幅会相干叠加。', en: 'A continuous-time quantum walk evolves with the graph’s adjacency (or Laplacian) matrix as the Hamiltonian: |ψ(t)⟩ = e^{−iAt}|entrance⟩. A classical random walk spreads a distance growing as √t; a quantum walk on a line spreads as t (ballistically), because amplitudes along different paths add coherently.' },
        { zh: 'Childs 等（2003）构造了“粘合树”：两棵二叉树的叶子随机相连。量子行走能在多项式时间从一个根走到另一个根，而任何经典算法都需要指数次查询。离散时间（Szegedy 式）量子行走则把马尔可夫链的混合时间开平方，是许多搜索加速的来源；它的谱结构也正是 qubitization 背后的数学。', en: 'Childs et al. (2003) built the “glued trees”: two binary trees whose leaves are joined at random. A quantum walk gets from one root to the other in polynomial time, while any classical algorithm needs exponentially many queries. Discrete-time (Szegedy-type) walks take the square root of a Markov chain’s mixing time and underlie many search speedups; their spectral structure is exactly the mathematics behind qubitization.' },
      ],
      formulas: ['walk'],
      inChem: [
        { zh: '激子与电荷在分子聚集体中的相干传输，在数学上就是一种连续时间量子行走（见量子生物学栏目的能量传递演示）。', en: 'Coherent exciton and charge transport in molecular aggregates is mathematically a continuous-time quantum walk (see the energy-transfer demo in the Quantum Biology section).' },
      ],
      pitfalls: [
        { zh: '“量子行走更快”不是普遍结论：有噪声或无序时会退回扩散甚至局域化。', en: '“Quantum walks are faster” is not universal: with noise or disorder they fall back to diffusion or even localise.' },
      ],
      checks: [
        { zh: '能写出连续时间量子行走的演化方程。', en: 'I can write the evolution equation of a continuous-time quantum walk.' },
        { zh: '能解释粘合树问题里经典算法为什么会迷路。', en: 'I can explain why classical algorithms get lost on the glued trees.' },
        { zh: '能说出量子行走与 qubitization 的联系。', en: 'I can state the connection between quantum walks and qubitization.' },
      ],
      refs: ['childs2003', 'montanaro2016', 'childsnotes', 'dewolf2019'],
    },

    // ── 第三层 ─────────────────────────────────────────────────────────
    {
      id: 'mapping', tier: 3, glyph: 'a†', year: '1928 / 2002', evidence: 'subroutine',
      name: { zh: '费米子到量子比特的映射', en: 'Mapping fermions to qubits' },
      tagline: { zh: 'Jordan–Wigner、Bravyi–Kitaev：把电子的反对易关系翻译成 Pauli 串。', en: 'Jordan–Wigner and Bravyi–Kitaev: translating the anticommutation of electrons into Pauli strings.' },
      problem: { zh: '把二次量子化的分子哈密顿量写成量子比特算符', en: 'Write the second-quantised molecular Hamiltonian as qubit operators' },
      qcost: { zh: 'N 个自旋轨道 → N 个量子比特；O(N⁴) 项', en: 'N spin orbitals → N qubits; O(N⁴) terms' },
      ccost: { zh: '（编码本身是经典预处理）', en: '(The encoding itself is classical preprocessing)' },
      speedup: { zh: '不是加速，而是决定后面线路深度和测量次数的“汇率”', en: 'Not a speedup but the exchange rate that sets later circuit depth and measurement counts' },
      explain: [
        { zh: '分子哈密顿量 H = Σ h_pq a_p†a_q + ½ Σ h_pqrs a_p†a_q†a_r a_s 的单、双电子积分来自 Hartree–Fock 计算。量子比特算符彼此对易，而费米子算符反对易，所以不能简单地把 a_j 换成 (X_j + iY_j)/2：要在前面补一串 Z 记录“我前面有几个电子”的奇偶性，这就是 Jordan–Wigner 变换。占据数直接存在比特上，直观，但一个跳跃项 a_p†a_q 会变成长度 O(N) 的 Pauli 串。', en: 'The molecular Hamiltonian H = Σ h_pq a_p†a_q + ½ Σ h_pqrs a_p†a_q†a_r a_s takes its one- and two-electron integrals from a Hartree–Fock calculation. Qubit operators commute while fermion operators anticommute, so you cannot just replace a_j with (X_j + iY_j)/2: a string of Z’s in front records the parity of the electrons before j. That is the Jordan–Wigner transformation. Occupations live directly on the qubits, which is intuitive, but a hopping term a_p†a_q becomes a Pauli string of length O(N).' },
        { zh: 'Bravyi–Kitaev 变换把“奇偶性”和“占据数”按二叉树分开存，使每个费米子算符只牵涉 O(log N) 个比特；奇偶编码则方便利用粒子数和自旋守恒去掉两个比特。实际计算还常用对称性约化（qubit tapering）和活性空间（只取前线附近的轨道），一个 STO-3G 的氢分子由此只剩 1 到 2 个比特。', en: 'The Bravyi–Kitaev transformation stores parities and occupations separately on a binary tree, so each fermion operator touches only O(log N) qubits; the parity encoding makes it easy to remove two qubits using particle-number and spin conservation. Practical calculations also use symmetry reduction (qubit tapering) and active spaces (only orbitals near the frontier), which takes a minimal-basis H₂ down to one or two qubits.' },
        { zh: '映射决定两件事：线路里每一项的 Pauli 权重（影响门数）和需要分组测量的项数（影响 VQE 的测量次数）。“N 个轨道只要 N 个比特”是量子计算处理化学的根本优势：经典的 FCI 需要随 N 指数增长的存储，量子态只需线性个比特。', en: 'The mapping decides two things: the Pauli weight of each term (gate count) and the number of terms to measure in groups (VQE measurement count). “N orbitals need only N qubits” is quantum computing’s fundamental advantage for chemistry: classical FCI needs storage exponential in N, a quantum state only a linear number of qubits.' },
      ],
      formulas: ['secondq', 'jw'],
      inChem: [
        { zh: '本站的讲解手册“二次量子化”一章与这里的映射直接衔接；数学基础子栏目的线性代数和张量网络是前置知识。', en: 'The second-quantisation chapter of the site’s handbook leads straight into these mappings; the linear algebra and tensor network subjects of the mathematics module are the prerequisites.' },
        { zh: 'OpenFermion、Qiskit Nature、PennyLane 等软件都能从 PySCF 的积分直接生成 Pauli 哈密顿量。', en: 'OpenFermion, Qiskit Nature and PennyLane all generate Pauli Hamiltonians directly from PySCF integrals.' },
      ],
      pitfalls: [
        { zh: '同一个分子在不同映射下 Pauli 项数相同，但权重和可并行测量的分组不同。', en: 'Different mappings give the same number of Pauli terms for a molecule but different weights and measurement groupings.' },
        { zh: '活性空间选得太小时，量子计算再准也只是一个小 CAS 的精确解，动态相关要另外补。', en: 'If the active space is too small, even an exact quantum solution is just an exact small CAS; dynamic correlation must be added separately.' },
      ],
      checks: [
        { zh: '能验证 Jordan–Wigner 后的 a_1 和 a_2 满足反对易关系。', en: 'I can verify that a_1 and a_2 after Jordan–Wigner anticommute.' },
        { zh: '能说出 Bravyi–Kitaev 为什么是 O(log N)。', en: 'I can explain why Bravyi–Kitaev is O(log N).' },
        { zh: '能估算 N 个自旋轨道的哈密顿量大约有多少项。', en: 'I can estimate roughly how many terms an N-spin-orbital Hamiltonian has.' },
      ],
      practice: {
        title: { zh: '亲手做一次 Jordan–Wigner', en: 'Do a Jordan–Wigner transformation by hand' },
        body: { zh: '用 numpy 为 4 个自旋轨道构造 a_j = Z⊗…⊗Z⊗(X+iY)/2⊗I⊗…，检查 {a_i, a_j†} = δ_ij 和 {a_i, a_j} = 0 对所有 i, j 成立。', en: 'Build a_j = Z⊗…⊗Z⊗(X+iY)/2⊗I⊗… for four spin orbitals with numpy and check {a_i, a_j†} = δ_ij and {a_i, a_j} = 0 for all i, j.' },
        code: `import numpy as np
from functools import reduce
I = np.eye(2); Z = np.diag([1, -1]); L = np.array([[0, 1], [0, 0]])   # (X+iY)/2 lowers |1> to |0>
n = 4
a = [reduce(np.kron, [Z]*j + [L] + [I]*(n-j-1)) for j in range(n)]
ok = all(np.allclose(a[i] @ a[j].conj().T + a[j].conj().T @ a[i], (i == j) * np.eye(2**n))
         and np.allclose(a[i] @ a[j] + a[j] @ a[i], 0) for i in range(n) for j in range(n))
print(ok)   # True`,
      },
      refs: ['jordan1928', 'bravyi2002', 'seeley2012', 'mcardle2020', 'cao2019'],
    },
    {
      id: 'chemqpe', tier: 3, glyph: 'E₀', year: '1999–2023', evidence: 'conditional',
      name: { zh: '化学基态能量：相位估计与资源估算', en: 'Chemical ground-state energies: phase estimation and resource estimates' },
      tagline: { zh: '容错量子计算在化学上的主线，以及“到底要多少比特、多少天”。', en: 'The main fault-tolerant route into chemistry, and the question of how many qubits and how many days.' },
      problem: { zh: '强关联分子（如过渡金属簇）的基态能量，化学精度 1.6 mHa', en: 'Ground-state energies of strongly correlated molecules (such as transition-metal clusters) to chemical accuracy, 1.6 mHa' },
      qcost: { zh: '约 λ/ε 次块编码调用 × 1/|⟨ψ₀|E₀⟩|² 次重复', en: 'About λ/ε block-encoding calls × 1/|⟨ψ₀|E₀⟩|² repetitions' },
      ccost: { zh: 'FCI：指数；DMRG、AFQMC、CCSD(T)：多项式但有各自的失效区', en: 'FCI: exponential; DMRG, AFQMC, CCSD(T): polynomial but each fails somewhere' },
      speedup: { zh: '对 FCI 是指数加速；对最好的经典启发式方法，Lee 等（2023）认为没有普遍的指数优势证据', en: 'Exponential against FCI; against the best classical heuristics, Lee et al. (2023) found no evidence of a generic exponential advantage' },
      explain: [
        { zh: '思路由 Abrams 和 Lloyd（1997、1999）提出，Aspuru-Guzik 等（2005）在经典模拟里演示：把分子哈密顿量映射到量子比特，用 e^{−iHt} 做相位估计，读出的相位就是能量。只要初态与基态重叠不太小，代价随轨道数多项式增长，而 FCI 是指数增长。', en: 'The idea came from Abrams and Lloyd (1997, 1999) and was demonstrated in classical simulation by Aspuru-Guzik et al. (2005): map the molecular Hamiltonian to qubits, run phase estimation with e^{−iHt}, and read the energy off the phase. As long as the initial state overlaps the ground state reasonably, the cost grows polynomially with the number of orbitals, while FCI grows exponentially.' },
        { zh: '资源估算把这个渐近结论变成具体的数字。Reiher 等（2017）以固氮酶的 FeMoco 为例，第一次给出包含纠错开销的完整估算；随后的块编码改进（Babbush 等 2018 的线性 T 门编码、von Burg 等 2021 的双因子分解、Lee 等 2021 的 THC）把成本降了几个数量级，Lee 等估计 FeMoco 约需四百万个物理比特、运行不到四天（假设 0.1% 门错误率、1 微秒周期）。Goings 等（2022）对细胞色素 P450 的分析认为，足够大的模型有可能落在量子优势一侧。', en: 'Resource estimates turn this asymptotic statement into numbers. Reiher et al. (2017) gave the first complete estimate including error-correction overhead, for the FeMoco cofactor of nitrogenase; later block-encoding improvements (the linear-T-complexity encoding of Babbush et al. 2018, the double factorisation of von Burg et al. 2021, the THC of Lee et al. 2021) cut the cost by orders of magnitude, and Lee et al. estimate about four million physical qubits and under four days for FeMoco (assuming 0.1% gate error and a 1 μs cycle). Goings et al. (2022) concluded for cytochrome P450 that large enough models may fall on the quantum-advantage side.' },
        { zh: '最大的问题是初态。Lee 等（2023）系统地检查后认为：让启发式制备的初态有足够重叠的那些物理特征，往往也正是让经典启发式方法（DMRG、耦合簇、量子蒙特卡洛）有效的特征，因此“对一般化学问题有指数优势”缺乏证据；多项式加速和特定难题上的优势仍有可能。这是一个仍在争论的问题，判断资源估算时要同时看经典方法在同一体系上能做到哪里。', en: 'The biggest issue is the initial state. After a systematic study, Lee et al. (2023) argued that the physical features that let a heuristically prepared state overlap well with the ground state are often the same ones that make classical heuristics (DMRG, coupled cluster, quantum Monte Carlo) work, so there is no evidence of an exponential advantage for generic chemistry; polynomial speedups and advantages on specific hard instances remain possible. The question is still debated; judge any resource estimate together with how far classical methods get on the same system.' },
      ],
      formulas: ['qpeenergy', 'chemcost'],
      inChem: [
        { zh: '候选体系多是多参考特征强的过渡金属体系：FeMoco、P450、钌催化剂、锰簇，以及材料里的强关联模型。', en: 'Candidate systems are mostly strongly multireference transition-metal systems: FeMoco, P450, ruthenium catalysts, manganese clusters, and strongly correlated models of materials.' },
        { zh: '容错量子计算最可能的角色是给活性空间做精确的“FCI 求解器”，再与经典方法组合补上动态相关。', en: 'The most likely role of fault-tolerant quantum computing is an exact “FCI solver” for an active space, combined with classical methods for dynamic correlation.' },
      ],
      pitfalls: [
        { zh: '资源估算里的“逻辑比特、T 门（或 Toffoli）数”和“物理比特、天数”是两层不同的数字，后者依赖硬件假设（见量子计算机栏目的纠错部分）。', en: 'Logical qubits and T (or Toffoli) counts are one layer of numbers; physical qubits and days are another that depends on hardware assumptions (see the error-correction part of the Quantum Computers section).' },
        { zh: '活性空间的 FCI 精确不等于实验精度：基组、溶剂、构象和动态相关的误差都还在。', en: 'An exact active-space FCI is not experimental accuracy: basis-set, solvent, conformer and dynamic-correlation errors remain.' },
      ],
      checks: [
        { zh: '能说出总代价公式里 λ、ε 和初态重叠各自的作用。', en: 'I can explain the roles of λ, ε and the initial overlap in the total cost.' },
        { zh: '能区分逻辑层和物理层的资源数字。', en: 'I can tell logical-layer from physical-layer resource numbers.' },
        { zh: '能用自己的话概括 Lee 等（2023）的论点。', en: 'I can summarise the argument of Lee et al. (2023) in my own words.' },
      ],
      demo: { id: 'qpe' },
      refs: ['abrams1997', 'abrams1999', 'aspuru2005', 'reiher2017', 'babbush2018', 'vonburg2021', 'lee2021', 'goings2022', 'lee2023', 'bauer2020'],
    },
    {
      id: 'vqe', tier: 3, glyph: '⟨H⟩', year: '2014', evidence: 'heuristic',
      name: { zh: '变分量子本征求解器（VQE）', en: 'The variational quantum eigensolver (VQE)' },
      tagline: { zh: '量子计算机只负责制备试探态、测期望值，参数交给经典优化器。', en: 'The quantum computer only prepares a trial state and measures expectation values; a classical optimiser tunes the parameters.' },
      problem: { zh: '用浅线路近似基态能量', en: 'Approximate a ground-state energy with shallow circuits' },
      qcost: { zh: '每次能量估计约 (Σ|c_j|)²/ε² 次测量 × 优化迭代次数', en: 'About (Σ|c_j|)²/ε² shots per energy estimate × optimisation steps' },
      ccost: { zh: '对已有规模的分子，经典方法更快更准', en: 'For molecules of the sizes run so far, classical methods are faster and more accurate' },
      speedup: { zh: '没有加速的证明；目前没有比经典方法更好的化学结果', en: 'No proof of a speedup; no chemistry result so far beats classical methods' },
      explain: [
        { zh: 'Peruzzo 等（2014）在光子芯片上提出 VQE：用参数化线路 U(θ) 制备 |ψ(θ)⟩，把 H 分成 Pauli 串之和逐项测量期望值，经典优化器调 θ 让 E(θ) 最小。由于变分原理，E(θ) ≥ E₀ 恒成立。它只需要短线路，不需要相位估计，因此成了 NISQ 时代最受关注的化学算法；McClean 等（2016）给出了它的理论框架。', en: 'Peruzzo et al. (2014) introduced VQE on a photonic chip: a parameterised circuit U(θ) prepares |ψ(θ)⟩, H is split into Pauli strings whose expectation values are measured term by term, and a classical optimiser tunes θ to minimise E(θ). The variational principle guarantees E(θ) ≥ E₀. It needs only short circuits and no phase estimation, so it became the most studied chemistry algorithm of the NISQ era; McClean et al. (2016) laid out its theory.' },
        { zh: '拟设有两类：化学启发的（如 UCCSD，物理上合理但线路深）和硬件高效的（Kandala 等 2017，交替单比特旋转与本地纠缠门，线路浅但缺乏物理结构）。梯度可以用参数平移法则精确地由两次能量测量算出。难点有三个：测量次数随精度按 1/ε² 增长，化学精度往往需要上百万次测量；随机初始化的深线路会遇到“贫瘠高原”，梯度随比特数指数地变小（McClean 等 2018）；噪声让能量系统性地偏高。', en: 'Ansätze come in two kinds: chemically inspired (such as UCCSD, physically sound but deep) and hardware-efficient (Kandala et al. 2017, alternating single-qubit rotations and native entangling gates; shallow but without physical structure). Gradients follow exactly from two energy measurements by the parameter-shift rule. There are three difficulties: shots grow as 1/ε², so chemical accuracy often needs millions; randomly initialised deep circuits hit barren plateaus where gradients shrink exponentially with qubit count (McClean et al. 2018); and noise biases the energy upward.' },
        { zh: '已经做过的 VQE 实验（HeH⁺、H₂、LiH、BeH₂、氢链的 Hartree–Fock 等）规模都在经典计算机能精确求解的范围内。它更像是检验硬件和误差缓解方法的基准，而不是今天能提供新化学结论的工具。混合方法（如 Huggins 等 2022 用量子计算机给辅助场量子蒙特卡洛去偏）是把量子设备当成经典方法的一个部件来用的尝试。', en: 'The VQE experiments done so far (HeH⁺, H₂, LiH, BeH₂, Hartree–Fock of hydrogen chains and so on) are all within reach of exact classical solution. VQE is better seen as a benchmark for hardware and error mitigation than as a tool that delivers new chemistry today. Hybrid methods, such as Huggins et al. (2022) using a quantum computer to unbias auxiliary-field quantum Monte Carlo, try to use the device as one component of a classical method.' },
      ],
      formulas: ['vqe', 'shift', 'shots'],
      inChem: [
        { zh: '演示 5 用一个两比特的横场 Ising 模型（不是分子）展示梯度下降、参数平移和测量噪声；把 h 设得很小时能看到平坦地形让收敛变慢。', en: 'Demo 5 uses a two-qubit transverse-field Ising model (not a molecule) to show gradient descent, parameter shifts and shot noise; a small h shows how a flat landscape slows convergence.' },
        { zh: '要在真分子上动手，可以用 PennyLane 或 Qiskit 的教程从 PySCF 积分构造 H₂ 的哈密顿量（见下方视频）。', en: 'To try real molecules, PennyLane and Qiskit tutorials build the H₂ Hamiltonian from PySCF integrals (see the videos below).' },
      ],
      pitfalls: [
        { zh: '“VQE 达到化学精度”的报道大多指在已知精确答案的小分子上、经过误差缓解后的结果。', en: 'Reports of “VQE reaching chemical accuracy” mostly concern small molecules with known exact answers, after error mitigation.' },
        { zh: '优化器在噪声下很容易停在局部极小；能量比 Hartree–Fock 还高的结果并不少见。', en: 'Under noise the optimiser easily stalls in local minima; energies above Hartree–Fock are not rare.' },
      ],
      checks: [
        { zh: '能推导 Ry 门的参数平移法则。', en: 'I can derive the parameter-shift rule for an Ry gate.' },
        { zh: '能估算达到 1 mHa 精度大约要多少次测量。', en: 'I can estimate roughly how many shots 1 mHa precision takes.' },
        { zh: '能解释贫瘠高原是什么、为什么出现。', en: 'I can explain what a barren plateau is and why it appears.' },
      ],
      practice: {
        title: { zh: '两比特 VQE：参数平移 + 梯度下降', en: 'Two-qubit VQE: parameter shifts and gradient descent' },
        body: { zh: '与页面上的演示 5 同一个模型。对 H = −Z₀Z₁ − h(X₀ + X₁) 用 Ry–CNOT–Ry 拟设，用参数平移求梯度，最后与精确基态能量 −√(1+4h²) 比较。', en: 'The same model as demo 5. For H = −Z₀Z₁ − h(X₀ + X₁) with an Ry–CNOT–Ry ansatz, compute gradients by parameter shifts and compare with the exact ground energy −√(1+4h²).' },
        code: `import numpy as np
I = np.eye(2); X = np.array([[0, 1], [1, 0]]); Z = np.diag([1.0, -1.0])
h = 0.6
H = -np.kron(Z, Z) - h * (np.kron(X, I) + np.kron(I, X))
Ry = lambda t: np.array([[np.cos(t/2), -np.sin(t/2)], [np.sin(t/2), np.cos(t/2)]])
CNOT = np.array([[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 0, 1], [0, 0, 1, 0]])
def energy(th):
    psi = np.kron(Ry(th[0]), Ry(th[1])) @ np.array([1.0, 0, 0, 0])
    psi = np.kron(Ry(th[2]), Ry(th[3])) @ (CNOT @ psi)
    return psi @ H @ psi
th = np.array([0.4, -0.3, 0.2, 0.1])
for step in range(200):
    g = np.array([(energy(th + np.pi/2*e) - energy(th - np.pi/2*e)) / 2 for e in np.eye(4)])
    th -= 0.3 * g
print(energy(th), -np.sqrt(1 + 4*h*h))   # both about -1.5620`,
      },
      demo: { id: 'vqe' },
      refs: ['peruzzo2014', 'mcclean2016', 'kandala2017', 'mcclean2018', 'google2020', 'huggins2022', 'preskill2018'],
    },
    {
      id: 'qaoa', tier: 3, glyph: 'γβ', year: '2014', evidence: 'heuristic',
      name: { zh: 'QAOA 与组合优化', en: 'QAOA and combinatorial optimisation' },
      tagline: { zh: '在“问题哈密顿量”和“混合哈密顿量”之间交替 p 次，近似求解 MaxCut 之类的问题。', en: 'Alternate p times between a problem Hamiltonian and a mixer to approximately solve problems such as MaxCut.' },
      problem: { zh: '组合优化（MaxCut、可满足性、调度）', en: 'Combinatorial optimisation (MaxCut, satisfiability, scheduling)' },
      qcost: { zh: '深度 O(p × 约束数)', en: 'Depth O(p × number of constraints)' },
      ccost: { zh: 'MaxCut：Goemans–Williamson 保证 0.878 的近似比', en: 'MaxCut: Goemans–Williamson guarantees a 0.878 approximation ratio' },
      speedup: { zh: '没有对最好的经典算法的优势证明；p = 1 在 3-正则图上保证 0.6924', en: 'No proven advantage over the best classical algorithms; p = 1 guarantees 0.6924 on 3-regular graphs' },
      explain: [
        { zh: 'Farhi、Goldstone 和 Gutmann（2014）提出：把目标函数写成对角的代价哈密顿量 C，从 |+⟩^{⊗n} 出发，交替作用 e^{−iγC} 和 e^{−iβB}（B = Σ X_j），共 p 轮，再调参数让 ⟨C⟩ 最大。p → ∞ 时它退化成绝热演化，必然找到最优解；有限 p 时是一个变分算法。', en: 'Farhi, Goldstone and Gutmann (2014): write the objective as a diagonal cost Hamiltonian C, start from |+⟩^{⊗n}, alternate e^{−iγC} and e^{−iβB} (B = Σ X_j) for p rounds, and tune the angles to maximise ⟨C⟩. As p → ∞ it becomes adiabatic evolution and must find the optimum; at finite p it is a variational algorithm.' },
        { zh: '原文证明 p = 1 时在 3-正则图的 MaxCut 上近似比至少 0.6924，低于经典的 Goemans–Williamson 算法（0.878）。Harrigan 等（2021）在超导芯片上运行 QAOA，发现对硬件原生图的结果随规模基本保持，而对需要大量交换门编译的非平面图，性能随问题变大明显下降。总体上，QAOA 对经典启发式算法的优势至今没有被确立。', en: 'The original paper proved an approximation ratio of at least 0.6924 for MaxCut on 3-regular graphs at p = 1, below the classical Goemans–Williamson algorithm (0.878). Harrigan et al. (2021) ran QAOA on a superconducting chip and found that results on hardware-native graphs held up with size, while for non-planar graphs that need many SWAP gates performance dropped clearly as the problems grew. Overall, an advantage of QAOA over classical heuristics has not been established.' },
      ],
      formulas: ['qaoa'],
      inChem: [
        { zh: '化学里的组合问题（构象搜索、分子对接打分）可以写成 QAOA 的形式，但目前没有证据比经典优化器好。', en: 'Combinatorial problems in chemistry (conformer search, docking scores) can be cast as QAOA, but there is no evidence it beats classical optimisers.' },
      ],
      pitfalls: [
        { zh: '把小规模 QAOA 的结果和随机猜测比，而不是和经典启发式算法比，会夸大它的效果。', en: 'Comparing small QAOA runs with random guessing rather than with classical heuristics exaggerates its performance.' },
        { zh: '量子退火是另一种做法（模拟绝热演化的专用硬件），不要和 QAOA 混为一谈。', en: 'Quantum annealing is a different approach (dedicated hardware emulating adiabatic evolution); do not conflate it with QAOA.' },
      ],
      checks: [
        { zh: '能写出 p = 1 的 QAOA 线路。', en: 'I can write the p = 1 QAOA circuit.' },
        { zh: '能解释 p → ∞ 时为什么回到绝热演化。', en: 'I can explain why p → ∞ recovers adiabatic evolution.' },
        { zh: '能说出 QAOA 应该和哪种经典算法比较。', en: 'I can say which classical algorithms QAOA should be compared against.' },
      ],
      refs: ['farhi2014', 'harrigan2021', 'preskill2018', 'hoefler2023'],
    },
    {
      id: 'mitig', tier: 3, glyph: 'ZNE', year: '2017', evidence: 'heuristic',
      name: { zh: '误差缓解', en: 'Error mitigation' },
      tagline: { zh: '不纠错，而是多跑几次、把噪声“外推掉”：代价随线路规模指数增长。', en: 'No error correction: run more and extrapolate the noise away, at a cost that grows exponentially with circuit size.' },
      problem: { zh: '在有噪声的设备上估计无噪声的期望值', en: 'Estimate noiseless expectation values on a noisy device' },
      qcost: { zh: '测量次数 × γ^{2·线路体积}（PEC）', en: 'Shots × γ^{2·circuit volume} (PEC)' },
      ccost: { zh: '同一线路的经典模拟（张量网络等）', en: 'Classical simulation of the same circuit (tensor networks and others)' },
      speedup: { zh: '不是加速，是把可信线路的规模往前推一点；不能替代纠错', en: 'Not a speedup but a way to push the trustworthy circuit size a little further; no substitute for error correction' },
      explain: [
        { zh: 'Temme、Bravyi 和 Gambetta（2017）提出两种方法。零噪声外推（ZNE）：故意把噪声放大到 λ = 1、1.5、2… 倍（拉长脉冲或插入互相抵消的门对），测期望值，再外推到 λ = 0。概率误差抵消（PEC）：先刻画噪声，把理想门写成一组可实现的含噪操作的“准概率”组合，随机抽样后加权平均，结果无偏，但方差按 γ² 每门放大。', en: 'Temme, Bravyi and Gambetta (2017) proposed two methods. Zero-noise extrapolation (ZNE): deliberately amplify noise by λ = 1, 1.5, 2… (stretch pulses or insert cancelling gate pairs), measure, and extrapolate to λ = 0. Probabilistic error cancellation (PEC): characterise the noise, write each ideal gate as a quasi-probability mixture of noisy operations, sample and reweight; the result is unbiased but the variance grows by γ² per gate.' },
        { zh: 'Kim 等（2023）在 127 个比特的设备上用 ZNE 得到二维横场 Ising 模型动力学的期望值，称之为“容错之前的实用性证据”；随后 Tindall 等（2024）等多个小组用张量网络在普通计算机上高效、准确地重现了这些结果。这个往复很好地说明了误差缓解的位置：它让结果可信，但不自动带来经典计算做不到的东西。', en: 'Kim et al. (2023) used ZNE on a 127-qubit device to obtain expectation values for the dynamics of a 2D transverse-field Ising model, calling it evidence of utility before fault tolerance; soon after, Tindall et al. (2024) and other groups reproduced the results efficiently and accurately with tensor networks on ordinary computers. The exchange shows where error mitigation sits: it makes results trustworthy but does not by itself deliver what classical computers cannot.' },
      ],
      formulas: ['zne'],
      inChem: [
        { zh: '几乎所有在真机上的 VQE 化学结果都用了某种误差缓解（读出校正、对称性验证、ZNE）。', en: 'Nearly every VQE chemistry result on real hardware uses some error mitigation (readout correction, symmetry verification, ZNE).' },
      ],
      pitfalls: [
        { zh: '外推模型（线性、指数、Richardson）的选择会改变结果，误差棒要包含模型误差。', en: 'The choice of extrapolation model (linear, exponential, Richardson) changes the result; error bars must include model error.' },
        { zh: '误差缓解的采样开销随门数指数增长，所以不能靠它扩展到容错算法需要的规模。', en: 'The sampling overhead grows exponentially with gate count, so mitigation cannot scale to the sizes fault-tolerant algorithms need.' },
      ],
      checks: [
        { zh: '能写出两点 Richardson 外推公式。', en: 'I can write the two-point Richardson extrapolation.' },
        { zh: '能解释 PEC 为什么无偏但方差大。', en: 'I can explain why PEC is unbiased but high-variance.' },
        { zh: '能复述 2023 年“实用性”实验与随后经典模拟的来回。', en: 'I can recount the 2023 utility experiment and the classical simulations that followed.' },
      ],
      refs: ['temme2017', 'kandala2019', 'kim2023', 'tindall2024', 'preskill2018'],
    },
  ],

  // 资源估算表：逻辑层与物理层的数字分开写；物理层取决于硬件假设（见 ../computing/#qc-qec）
  estimates: [
    { id: 'femoco17', target: { zh: '固氮酶 FeMoco 活性空间', en: 'Nitrogenase FeMoco active space' }, method: { zh: 'Trotter 化的相位估计', en: 'Trotterised phase estimation' }, result: { zh: '第一份包含纠错和门编译开销的完整估算；结论是“在合理时间内可以完成”', en: 'The first complete estimate including error-correction and compilation overhead; concluded it can be done in reasonable time' }, assume: { zh: '表面码', en: 'Surface code' }, refs: ['reiher2017'] },
    { id: 'femoco21', target: { zh: '同一个 FeMoco 哈密顿量', en: 'The same FeMoco Hamiltonian' }, method: { zh: 'THC 块编码 + qubitization', en: 'THC block encoding + qubitization' }, result: { zh: '约 400 万个物理比特，运行不到 4 天；作者称这是已知方法里容错资源最少的', en: 'About 4 million physical qubits and under 4 days; the authors report the lowest fault-tolerant resources of any known approach' }, assume: { zh: '物理门错误率 ≤ 0.1%，1 μs 周期', en: 'Physical gate error ≤ 0.1%, 1 μs cycle' }, refs: ['lee2021'] },
    { id: 'ru21', target: { zh: '钌催化剂把 CO₂ 转成甲醇的催化循环', en: 'A ruthenium catalyst’s cycle converting CO₂ to methanol' }, method: { zh: '双因子分解 + qubitization', en: 'Double factorisation + qubitization' }, result: { zh: '比此前最好的算法便宜一个数量级以上；讨论了加大活性空间以处理动态相关的困难', en: 'More than an order of magnitude cheaper than the best previous algorithms; discusses the difficulty of larger active spaces for dynamic correlation' }, assume: { zh: '表面码', en: 'Surface code' }, refs: ['vonburg2021'] },
    { id: 'p450', target: { zh: '细胞色素 P450 的催化循环模型', en: 'Models of the cytochrome P450 catalytic cycle' }, method: { zh: 'qubitization 相位估计，与 DMRG+NEVPT2、CCSD(T) 对照', en: 'Qubitized phase estimation, compared with DMRG+NEVPT2 and CCSD(T)' }, result: { zh: '经典与量子两边的估算都表明：足够大的模型有可能是量子优势问题', en: 'Both classical and quantum estimates suggest that large enough models may be a quantum-advantage problem' }, assume: { zh: '表面码，直接与 DMRG 运行时间比较', en: 'Surface code, compared directly with DMRG run times' }, refs: ['goings2022'] },
    { id: 'rsa21', target: { zh: '分解 2048 位 RSA（对照）', en: 'Factoring 2048-bit RSA (for comparison)' }, method: { zh: 'Shor + 多种算术优化', en: 'Shor with many arithmetic optimisations' }, result: { zh: '约 2000 万个噪声比特，8 小时', en: 'About 20 million noisy qubits, 8 hours' }, assume: { zh: '物理门错误率 10⁻³，1 μs 表面码周期，10 μs 反应时间，近邻连接', en: 'Physical gate error 10⁻³, 1 μs surface-code cycle, 10 μs reaction time, nearest-neighbour grid' }, refs: ['gidney2021'] },
    { id: 'rsa25', target: { zh: '分解 2048 位 RSA（2025 更新）', en: 'Factoring 2048-bit RSA (2025 update)' }, method: { zh: '近似剩余数算术、更紧凑的存储', en: 'Approximate residue arithmetic, denser storage' }, result: { zh: '不到一百万个噪声比特，不到一周（预印本）', en: 'Under a million noisy qubits, under a week (preprint)' }, assume: { zh: '与 2021 年相同的硬件假设', en: 'The same hardware assumptions as in 2021' }, refs: ['gidney2025'] },
  ],

  tracks: [
    {
      id: 'chem', name: { zh: '化学家路线', en: 'Chemist’s track' },
      desc: { zh: '面向会做 Hartree–Fock 和 CI、想知道量子计算对自己的研究意味着什么的人。数学只要线性代数。', en: 'For people who know Hartree–Fock and CI and want to know what quantum computing means for their research. Linear algebra is all the mathematics needed.' },
      phases: [
        { name: { zh: '线路模型', en: 'Circuit model' }, weeks: '2', algos: ['query'], goal: { zh: '会用演示 1 搭 Bell 态、相位回踢和 Deutsch–Jozsa，能手算两比特线路。', en: 'Build Bell states, phase kickback and Deutsch–Jozsa in demo 1 and work two-qubit circuits by hand.' } },
        { name: { zh: '相位估计', en: 'Phase estimation' }, weeks: '2', algos: ['qft', 'qpe'], goal: { zh: '理解“能量写进相位、相位读成二进制”，玩演示 3。', en: 'Understand “energy into a phase, phase into binary”; play with demo 3.' } },
        { name: { zh: '从分子到比特', en: 'From molecules to qubits' }, weeks: '2–3', algos: ['mapping', 'hamsim'], goal: { zh: '亲手做一次 Jordan–Wigner，用演示 4 体会 Trotter 误差。', en: 'Do a Jordan–Wigner transformation yourself and get a feel for Trotter error in demo 4.' } },
        { name: { zh: '近期与远期', en: 'Near and far term' }, weeks: '3', algos: ['vqe', 'mitig', 'chemqpe'], goal: { zh: '跑通两比特 VQE；读懂一份资源估算表，并能说出它的假设。', en: 'Get two-qubit VQE working; read a resource-estimate table and name its assumptions.' } },
      ],
    },
    {
      id: 'theory', name: { zh: '理论路线', en: 'Theory track' },
      desc: { zh: '面向想读懂算法论文、做算法研究的人。需要线性代数、概率和一点复杂度理论。', en: 'For people who want to read and write algorithms papers. Needs linear algebra, probability and some complexity theory.' },
      phases: [
        { name: { zh: '查询模型', en: 'Query model' }, weeks: '2', algos: ['query', 'aa'], goal: { zh: '掌握相位回踢、Grover 的几何图像和 BBBV 下界的思路。', en: 'Master phase kickback, the geometry of Grover and the idea of the BBBV lower bound.' } },
        { name: { zh: '傅里叶与周期', en: 'Fourier and periods' }, weeks: '3', algos: ['qft', 'qpe', 'shor'], goal: { zh: '完整推导 Shor，包括连分数和成功概率。', en: 'Derive Shor fully, including continued fractions and success probability.' } },
        { name: { zh: '矩阵函数', en: 'Matrix functions' }, weeks: '3–4', algos: ['qsvt', 'hamsim', 'hhl'], goal: { zh: '能用 QSVT 的语言重写哈密顿量模拟和 HHL，并说出 HHL 的全部前提。', en: 'Rewrite Hamiltonian simulation and HHL in QSVT language and state every condition of HHL.' } },
        { name: { zh: '边界与前沿', en: 'Limits and frontier' }, weeks: '2', algos: ['walk', 'chemqpe', 'qaoa'], goal: { zh: '读 Dalzell 等的综述，学会对一个“量子优势”说法做端到端的成本核算。', en: 'Read the Dalzell et al. survey and learn to do end-to-end costing of a quantum-advantage claim.' } },
      ],
    },
  ],

  kinds: {
    paper: { zh: '原始论文', en: 'Original paper' },
    review: { zh: '综述与评论', en: 'Review & perspective' },
    estimate: { zh: '资源估算', en: 'Resource estimate' },
    experiment: { zh: '实验', en: 'Experiment' },
    book: { zh: '教材与讲义', en: 'Textbook & notes' },
  },

  // 文献：doi 或 arxiv 至少一个；free 表示作者或出版社提供合法的免费全文（开放获取或 arXiv）
  refs: [
    { id: 'feynman1982', kind: 'paper', authors: 'R. P. Feynman', title: 'Simulating physics with computers', venue: 'Int. J. Theor. Phys.', vol: '21', pages: '467', year: 1982, doi: '10.1007/BF02650179', algos: ['hamsim'], note: { zh: '提出用量子系统模拟量子系统，本栏目开头那句话的出处。', en: 'Proposes simulating quantum systems with quantum systems; the source of the quote at the top of this page.' } },
    { id: 'deutsch1992', kind: 'paper', authors: 'D. Deutsch, R. Jozsa', title: 'Rapid solution of problems by quantum computation', venue: 'Proc. R. Soc. Lond. A', vol: '439', pages: '553', year: 1992, doi: '10.1098/rspa.1992.0167', algos: ['query'], note: { zh: 'Deutsch–Jozsa 算法：一次查询区分常数函数与平衡函数。', en: 'The Deutsch–Jozsa algorithm: one query separates constant from balanced functions.' } },
    { id: 'bv1997', kind: 'paper', authors: 'E. Bernstein, U. Vazirani', title: 'Quantum Complexity Theory', venue: 'SIAM J. Comput.', vol: '26', pages: '1411', year: 1997, doi: '10.1137/S0097539796300921', algos: ['query'], note: { zh: '定义了 BQP，并给出 Bernstein–Vazirani 问题。', en: 'Defines BQP and introduces the Bernstein–Vazirani problem.' } },
    { id: 'simon1997', kind: 'paper', authors: 'D. R. Simon', title: 'On the Power of Quantum Computation', venue: 'SIAM J. Comput.', vol: '26', pages: '1474', year: 1997, doi: '10.1137/S0097539796298637', algos: ['query', 'shor'], note: { zh: '第一个对随机经典算法也成立的指数查询分离，直接启发了 Shor。', en: 'The first exponential query separation that holds even against randomised classical algorithms; directly inspired Shor.' } },
    { id: 'shor1997', kind: 'paper', authors: 'P. W. Shor', title: 'Polynomial-Time Algorithms for Prime Factorization and Discrete Logarithms on a Quantum Computer', venue: 'SIAM J. Comput.', vol: '26', pages: '1484', year: 1997, doi: '10.1137/S0097539795293172', algos: ['shor', 'qft'], note: { zh: 'Shor 算法的期刊版（会议版 1994）。', en: 'The journal version of Shor’s algorithm (conference version 1994).' } },
    { id: 'bbbv1997', kind: 'paper', authors: 'C. H. Bennett, E. Bernstein, G. Brassard, U. Vazirani', title: 'Strengths and Weaknesses of Quantum Computing', venue: 'SIAM J. Comput.', vol: '26', pages: '1510', year: 1997, doi: '10.1137/S0097539796300933', algos: ['aa'], note: { zh: '证明无结构搜索需要 Ω(√N) 次查询：Grover 是最优的。', en: 'Proves that unstructured search needs Ω(√N) queries: Grover is optimal.' } },
    { id: 'grover1997', kind: 'paper', authors: 'L. K. Grover', title: 'Quantum Mechanics Helps in Searching for a Needle in a Haystack', venue: 'Phys. Rev. Lett.', vol: '79', pages: '325', year: 1997, doi: '10.1103/PhysRevLett.79.325', algos: ['aa'], note: { zh: 'Grover 搜索算法。', en: 'Grover’s search algorithm.' } },
    { id: 'kitaev1995', kind: 'paper', authors: 'A. Yu. Kitaev', title: 'Quantum measurements and the Abelian Stabilizer Problem', venue: 'arXiv', year: 1995, arxiv: 'quant-ph/9511026', free: true, algos: ['qpe'], note: { zh: '相位估计的起源之一，并用它解决阿贝尔稳定子问题（包括因数分解）。', en: 'One origin of phase estimation, used to solve the Abelian stabiliser problem (including factoring).' } },
    { id: 'cleve1998', kind: 'paper', authors: 'R. Cleve, A. Ekert, C. Macchiavello, M. Mosca', title: 'Quantum algorithms revisited', venue: 'Proc. R. Soc. Lond. A', vol: '454', pages: '339', year: 1998, doi: '10.1098/rspa.1998.0164', algos: ['qpe', 'qft', 'query'], note: { zh: '用相位估计把 Deutsch、Simon、Shor 等算法放进同一个框架，今天教科书的讲法由此而来。', en: 'Puts Deutsch, Simon, Shor and others into one phase-estimation framework; the way textbooks present them today.' } },
    { id: 'lloyd1996', kind: 'paper', authors: 'S. Lloyd', title: 'Universal Quantum Simulators', venue: 'Science', vol: '273', pages: '1073', year: 1996, doi: '10.1126/science.273.5278.1073', algos: ['hamsim'], note: { zh: '证明局域哈密顿量可以用乘积公式高效模拟。', en: 'Shows that local Hamiltonians can be simulated efficiently with product formulas.' } },
    { id: 'abrams1997', kind: 'paper', authors: 'D. S. Abrams, S. Lloyd', title: 'Simulation of Many-Body Fermi Systems on a Universal Quantum Computer', venue: 'Phys. Rev. Lett.', vol: '79', pages: '2586', year: 1997, doi: '10.1103/PhysRevLett.79.2586', algos: ['chemqpe', 'mapping'], note: { zh: '在量子计算机上模拟费米子多体系统。', en: 'Simulating many-body fermion systems on a quantum computer.' } },
    { id: 'abrams1999', kind: 'paper', authors: 'D. S. Abrams, S. Lloyd', title: 'Quantum Algorithm Providing Exponential Speed Increase for Finding Eigenvalues and Eigenvectors', venue: 'Phys. Rev. Lett.', vol: '83', pages: '5162', year: 1999, doi: '10.1103/PhysRevLett.83.5162', algos: ['qpe', 'chemqpe'], note: { zh: '用相位估计求哈密顿量的本征值，化学相位估计的直接起点。', en: 'Phase estimation for Hamiltonian eigenvalues; the direct starting point of chemical phase estimation.' } },
    { id: 'jordan1928', kind: 'paper', authors: 'P. Jordan, E. Wigner', title: 'Über das Paulische Äquivalenzverbot', venue: 'Z. Phys.', vol: '47', pages: '631', year: 1928, doi: '10.1007/BF01331938', algos: ['mapping'], note: { zh: 'Jordan–Wigner 变换的原始论文（德文）。', en: 'The original Jordan–Wigner paper (in German).' } },
    { id: 'bravyi2002', kind: 'paper', authors: 'S. B. Bravyi, A. Yu. Kitaev', title: 'Fermionic Quantum Computation', venue: 'Ann. Phys.', vol: '298', pages: '210', year: 2002, doi: '10.1006/aphy.2002.6254', algos: ['mapping'], note: { zh: 'Bravyi–Kitaev 编码：每个费米子算符只牵涉 O(log N) 个比特。', en: 'The Bravyi–Kitaev encoding: each fermion operator touches O(log N) qubits.' } },
    { id: 'seeley2012', kind: 'paper', authors: 'J. T. Seeley, M. J. Richard, P. J. Love', title: 'The Bravyi-Kitaev transformation for quantum computation of electronic structure', venue: 'J. Chem. Phys.', vol: '137', pages: '224109', year: 2012, doi: '10.1063/1.4768229', algos: ['mapping'], note: { zh: '把 Bravyi–Kitaev 变换写成化学家能直接用的形式，以 H₂ 为例。', en: 'Presents the Bravyi–Kitaev transformation in a form chemists can use, with H₂ as the example.' } },
    { id: 'aspuru2005', kind: 'paper', authors: 'A. Aspuru-Guzik, A. D. Dutoi, P. J. Love, M. Head-Gordon', title: 'Simulated Quantum Computation of Molecular Energies', venue: 'Science', vol: '309', pages: '1704', year: 2005, doi: '10.1126/science.1113479', algos: ['chemqpe'], note: { zh: '在经典模拟中演示用相位估计计算水和 LiH 的能量，量子计算化学的标志性起点。', en: 'Demonstrates phase-estimation energies for water and LiH in classical simulation; the landmark start of quantum computational chemistry.' } },
    { id: 'hhl2009', kind: 'paper', authors: 'A. W. Harrow, A. Hassidim, S. Lloyd', title: 'Quantum Algorithm for Linear Systems of Equations', venue: 'Phys. Rev. Lett.', vol: '103', pages: '150502', year: 2009, doi: '10.1103/PhysRevLett.103.150502', algos: ['hhl'], note: { zh: 'HHL 算法。', en: 'The HHL algorithm.' } },
    { id: 'childswiebe2012', kind: 'paper', authors: 'A. M. Childs, N. Wiebe', title: 'Hamiltonian Simulation Using Linear Combinations of Unitary Operations', venue: 'arXiv', year: 2012, arxiv: '1202.5822', free: true, algos: ['qsvt', 'hamsim'], note: { zh: 'LCU 方法的起点（期刊版发表在 Quantum Inf. Comput.）。', en: 'The origin of the LCU method (journal version in Quantum Inf. Comput.).' } },
    { id: 'berry2015', kind: 'paper', authors: 'D. W. Berry, A. M. Childs, R. Cleve, R. Kothari, R. D. Somma', title: 'Simulating Hamiltonian Dynamics with a Truncated Taylor Series', venue: 'Phys. Rev. Lett.', vol: '114', pages: '090502', year: 2015, doi: '10.1103/PhysRevLett.114.090502', algos: ['hamsim', 'qsvt'], note: { zh: '截断泰勒级数 + LCU：代价对精度只有对数依赖。', en: 'Truncated Taylor series with LCU: cost only logarithmic in the precision.' } },
    { id: 'lowchuang2017', kind: 'paper', authors: 'G. H. Low, I. L. Chuang', title: 'Optimal Hamiltonian Simulation by Quantum Signal Processing', venue: 'Phys. Rev. Lett.', vol: '118', pages: '010501', year: 2017, doi: '10.1103/PhysRevLett.118.010501', algos: ['hamsim', 'qsvt'], note: { zh: '量子信号处理，第一次达到最优的哈密顿量模拟代价。', en: 'Quantum signal processing; the first optimal Hamiltonian simulation cost.' } },
    { id: 'lowchuang2019', kind: 'paper', authors: 'G. H. Low, I. L. Chuang', title: 'Hamiltonian Simulation by Qubitization', venue: 'Quantum', vol: '3', pages: '163', year: 2019, doi: '10.22331/q-2019-07-12-163', free: true, algos: ['hamsim', 'qsvt'], note: { zh: 'Qubitization：从块编码直接得到最优模拟，化学资源估算的标准工具。', en: 'Qubitization: optimal simulation directly from a block encoding; the standard tool of chemistry resource estimates.' } },
    { id: 'gilyen2019', kind: 'paper', authors: 'A. Gilyén, Y. Su, G. H. Low, N. Wiebe', title: 'Quantum singular value transformation and beyond: exponential improvements for quantum matrix arithmetics', venue: 'STOC 2019', pages: '193', year: 2019, doi: '10.1145/3313276.3316366', algos: ['qsvt'], note: { zh: '量子奇异值变换（QSVT）。', en: 'The quantum singular value transformation (QSVT).' } },
    { id: 'martyn2021', kind: 'review', authors: 'J. M. Martyn, Z. M. Rossi, A. K. Tan, I. L. Chuang', title: 'Grand Unification of Quantum Algorithms', venue: 'PRX Quantum', vol: '2', pages: '040203', year: 2021, doi: '10.1103/PRXQuantum.2.040203', free: true, algos: ['qsvt', 'hhl', 'aa'], note: { zh: '用 QSVT 统一搜索、相位估计、模拟和线性方程组的教学性综述，开放获取。', en: 'A tutorial review unifying search, phase estimation, simulation and linear systems with QSVT; open access.' } },
    { id: 'campbell2019', kind: 'paper', authors: 'E. Campbell', title: 'Random Compiler for Fast Hamiltonian Simulation', venue: 'Phys. Rev. Lett.', vol: '123', pages: '070503', year: 2019, doi: '10.1103/PhysRevLett.123.070503', algos: ['hamsim'], note: { zh: 'qDRIFT：按系数随机抽项，代价与项数无关。', en: 'qDRIFT: random sampling of terms by weight, cost independent of the number of terms.' } },
    { id: 'childs2021', kind: 'paper', authors: 'A. M. Childs, Y. Su, M. C. Tran, N. Wiebe, S. Zhu', title: 'Theory of Trotter Error with Commutator Scaling', venue: 'Phys. Rev. X', vol: '11', pages: '011020', year: 2021, doi: '10.1103/PhysRevX.11.011020', free: true, algos: ['hamsim'], note: { zh: '证明 Trotter 误差由对易子控制，大幅收紧了误差界。', en: 'Proves that Trotter error is governed by commutators, greatly tightening the bounds.' } },
    { id: 'childs2003', kind: 'paper', authors: 'A. M. Childs, R. Cleve, E. Deotto, E. Farhi, S. Gutmann, D. A. Spielman', title: 'Exponential algorithmic speedup by a quantum walk', venue: 'STOC 2003', pages: '59', year: 2003, doi: '10.1145/780542.780552', algos: ['walk'], note: { zh: '粘合树问题：量子行走的指数加速。', en: 'The glued-trees problem: an exponential speedup by quantum walk.' } },
    { id: 'brassard2002', kind: 'paper', authors: 'G. Brassard, P. Høyer, M. Mosca, A. Tapp', title: 'Quantum amplitude amplification and estimation', venue: 'Contemp. Math.', vol: '305', pages: '53', year: 2002, doi: '10.1090/conm/305/05215', algos: ['aa'], note: { zh: '振幅放大和振幅估计的标准参考文献。', en: 'The standard reference for amplitude amplification and estimation.' } },
    { id: 'montanaro2015', kind: 'paper', authors: 'A. Montanaro', title: 'Quantum speedup of Monte Carlo methods', venue: 'Proc. R. Soc. A', vol: '471', pages: '20150301', year: 2015, doi: '10.1098/rspa.2015.0301', free: true, algos: ['aa'], note: { zh: '用振幅估计把蒙特卡洛方法加速到二次。', en: 'Quadratic speedup of Monte Carlo methods by amplitude estimation.' } },
    { id: 'tang2019', kind: 'paper', authors: 'E. Tang', title: 'A quantum-inspired classical algorithm for recommendation systems', venue: 'STOC 2019', pages: '217', year: 2019, doi: '10.1145/3313276.3316310', algos: ['hhl'], note: { zh: '去量子化：在同样的采样假设下，经典算法也能做推荐系统，只慢多项式倍。', en: 'Dequantization: with the same sampling assumptions a classical algorithm does recommendation systems only polynomially slower.' } },
    { id: 'peruzzo2014', kind: 'experiment', authors: 'A. Peruzzo, J. McClean, P. Shadbolt, M.-H. Yung, X.-Q. Zhou, P. J. Love, A. Aspuru-Guzik, J. L. O’Brien', title: 'A variational eigenvalue solver on a photonic quantum processor', venue: 'Nat. Commun.', vol: '5', pages: '4213', year: 2014, doi: '10.1038/ncomms5213', free: true, algos: ['vqe'], note: { zh: '提出 VQE，并在光子芯片上算了 HeH⁺。', en: 'Introduces VQE and runs HeH⁺ on a photonic chip.' } },
    { id: 'mcclean2016', kind: 'paper', authors: 'J. R. McClean, J. Romero, R. Babbush, A. Aspuru-Guzik', title: 'The theory of variational hybrid quantum-classical algorithms', venue: 'New J. Phys.', vol: '18', pages: '023023', year: 2016, doi: '10.1088/1367-2630/18/2/023023', free: true, algos: ['vqe'], note: { zh: '变分混合算法的理论框架，开放获取。', en: 'The theoretical framework of variational hybrid algorithms; open access.' } },
    { id: 'kandala2017', kind: 'experiment', authors: 'A. Kandala, A. Mezzacapo, K. Temme, M. Takita, M. Brink, J. M. Chow, J. M. Gambetta', title: 'Hardware-efficient variational quantum eigensolver for small molecules and quantum magnets', venue: 'Nature', vol: '549', pages: '242', year: 2017, doi: '10.1038/nature23879', algos: ['vqe'], note: { zh: '硬件高效拟设，在超导芯片上算到 BeH₂。', en: 'The hardware-efficient ansatz, up to BeH₂ on a superconducting chip.' } },
    { id: 'mcclean2018', kind: 'paper', authors: 'J. R. McClean, S. Boixo, V. N. Smelyanskiy, R. Babbush, H. Neven', title: 'Barren plateaus in quantum neural network training landscapes', venue: 'Nat. Commun.', vol: '9', pages: '4812', year: 2018, doi: '10.1038/s41467-018-07090-4', free: true, algos: ['vqe'], note: { zh: '贫瘠高原：随机深线路的梯度随比特数指数消失。', en: 'Barren plateaus: gradients of random deep circuits vanish exponentially with qubit count.' } },
    { id: 'farhi2014', kind: 'paper', authors: 'E. Farhi, J. Goldstone, S. Gutmann', title: 'A Quantum Approximate Optimization Algorithm', venue: 'arXiv', year: 2014, arxiv: '1411.4028', free: true, algos: ['qaoa'], note: { zh: 'QAOA 原始论文，含 p = 1 时 3-正则图 MaxCut 的 0.6924 保证。', en: 'The original QAOA paper, including the 0.6924 guarantee for MaxCut on 3-regular graphs at p = 1.' } },
    { id: 'harrigan2021', kind: 'experiment', authors: 'M. P. Harrigan et al.', title: 'Quantum approximate optimization of non-planar graph problems on a planar superconducting processor', venue: 'Nat. Phys.', vol: '17', pages: '332', year: 2021, doi: '10.1038/s41567-020-01105-y', algos: ['qaoa'], note: { zh: '在超导芯片上系统运行 QAOA，展示编译开销如何削弱性能。', en: 'Systematic QAOA runs on a superconducting chip, showing how compilation overhead erodes performance.' } },
    { id: 'temme2017', kind: 'paper', authors: 'K. Temme, S. Bravyi, J. M. Gambetta', title: 'Error Mitigation for Short-Depth Quantum Circuits', venue: 'Phys. Rev. Lett.', vol: '119', pages: '180509', year: 2017, doi: '10.1103/PhysRevLett.119.180509', algos: ['mitig'], note: { zh: '提出零噪声外推和概率误差抵消。', en: 'Introduces zero-noise extrapolation and probabilistic error cancellation.' } },
    { id: 'kandala2019', kind: 'experiment', authors: 'A. Kandala, K. Temme, A. D. Córcoles, A. Mezzacapo, J. M. Chow, J. M. Gambetta', title: 'Error mitigation extends the computational reach of a noisy quantum processor', venue: 'Nature', vol: '567', pages: '491', year: 2019, doi: '10.1038/s41586-019-1040-7', algos: ['mitig', 'vqe'], note: { zh: '在 VQE 上实验演示零噪声外推。', en: 'Experimental zero-noise extrapolation on VQE.' } },
    { id: 'kim2023', kind: 'experiment', authors: 'Y. Kim et al.', title: 'Evidence for the utility of quantum computing before fault tolerance', venue: 'Nature', vol: '618', pages: '500', year: 2023, doi: '10.1038/s41586-023-06096-3', free: true, algos: ['mitig'], note: { zh: '127 比特设备上的误差缓解实验。', en: 'Error-mitigated experiment on a 127-qubit device.' } },
    { id: 'tindall2024', kind: 'paper', authors: 'J. Tindall, M. Fishman, E. M. Stoudenmire, D. Sels', title: 'Efficient Tensor Network Simulation of IBM’s Eagle Kicked Ising Experiment', venue: 'PRX Quantum', vol: '5', pages: '010308', year: 2024, doi: '10.1103/PRXQuantum.5.010308', free: true, algos: ['mitig'], note: { zh: '用张量网络在经典计算机上高效重现 2023 年的实验。', en: 'Reproduces the 2023 experiment efficiently with tensor networks on a classical computer.' } },
    { id: 'google2020', kind: 'experiment', authors: 'Google AI Quantum and Collaborators', title: 'Hartree-Fock on a superconducting qubit quantum computer', venue: 'Science', vol: '369', pages: '1084', year: 2020, doi: '10.1126/science.abb9811', algos: ['vqe'], note: { zh: '12 比特上的 Hartree–Fock 计算（氢链与二氮烯异构化），配合误差缓解。', en: 'Hartree–Fock on 12 qubits (hydrogen chains and diazene isomerisation) with error mitigation.' } },
    { id: 'huggins2022', kind: 'experiment', authors: 'W. J. Huggins, B. O’Gorman, N. C. Rubin, D. R. Reichman, R. Babbush, J. Lee', title: 'Unbiasing fermionic quantum Monte Carlo with a quantum computer', venue: 'Nature', vol: '603', pages: '416', year: 2022, doi: '10.1038/s41586-021-04351-z', algos: ['vqe', 'chemqpe'], note: { zh: '用量子计算机提供的试探态给辅助场量子蒙特卡洛去偏，一种量子–经典混合思路。', en: 'Uses a quantum computer’s trial state to unbias auxiliary-field quantum Monte Carlo, a hybrid quantum–classical approach.' } },
    { id: 'reiher2017', kind: 'estimate', authors: 'M. Reiher, N. Wiebe, K. M. Svore, D. Wecker, M. Troyer', title: 'Elucidating reaction mechanisms on quantum computers', venue: 'Proc. Natl. Acad. Sci. USA', vol: '114', pages: '7555', year: 2017, doi: '10.1073/pnas.1619152114', free: true, algos: ['chemqpe'], note: { zh: '以固氮酶 FeMoco 为例的第一份完整资源估算。', en: 'The first complete resource estimate, for nitrogenase FeMoco.' } },
    { id: 'babbush2018', kind: 'estimate', authors: 'R. Babbush, C. Gidney, D. W. Berry, N. Wiebe, J. McClean, A. Paler, A. Fowler, H. Neven', title: 'Encoding Electronic Spectra in Quantum Circuits with Linear T Complexity', venue: 'Phys. Rev. X', vol: '8', pages: '041015', year: 2018, doi: '10.1103/PhysRevX.8.041015', free: true, algos: ['chemqpe', 'qsvt'], note: { zh: 'T 门数与轨道数成线性的化学哈密顿量编码。', en: 'An encoding of chemistry Hamiltonians whose T count is linear in the number of orbitals.' } },
    { id: 'vonburg2021', kind: 'estimate', authors: 'V. von Burg, G. H. Low, T. Häner, D. S. Steiger, M. Reiher, M. Roetteler, M. Troyer', title: 'Quantum computing enhanced computational catalysis', venue: 'Phys. Rev. Research', vol: '3', pages: '033055', year: 2021, doi: '10.1103/PhysRevResearch.3.033055', free: true, algos: ['chemqpe'], note: { zh: '双因子分解；以钌催化 CO₂ 制甲醇为例。', en: 'Double factorisation; a ruthenium catalyst turning CO₂ into methanol as the example.' } },
    { id: 'lee2021', kind: 'estimate', authors: 'J. Lee, D. W. Berry, C. Gidney, W. J. Huggins, J. R. McClean, N. Wiebe, R. Babbush', title: 'Even More Efficient Quantum Computations of Chemistry Through Tensor Hypercontraction', venue: 'PRX Quantum', vol: '2', pages: '030305', year: 2021, doi: '10.1103/PRXQuantum.2.030305', free: true, algos: ['chemqpe', 'qsvt'], note: { zh: 'THC 块编码；FeMoco 约四百万物理比特、不到四天。', en: 'THC block encoding; FeMoco in about four million physical qubits and under four days.' } },
    { id: 'goings2022', kind: 'estimate', authors: 'J. J. Goings, A. White, J. Lee, C. S. Tautermann, M. Degroote, C. Gidney, T. Shiozaki, R. Babbush, N. C. Rubin', title: 'Reliably assessing the electronic structure of cytochrome P450 on today’s classical computers and tomorrow’s quantum computers', venue: 'Proc. Natl. Acad. Sci. USA', vol: '119', pages: 'e2203533119', year: 2022, doi: '10.1073/pnas.2203533119', free: true, algos: ['chemqpe'], note: { zh: '把量子资源估算和经典计算的收敛性放在一起，划出可能的量子优势边界。', en: 'Pairs quantum resource estimates with the convergence of classical methods to locate a possible advantage boundary.' } },
    { id: 'lee2023', kind: 'review', authors: 'S. Lee, J. Lee, H. Zhai, Y. Tong, A. M. Dalzell, A. Kumar, P. Helms, J. Gray, Z.-H. Cui, W. Liu, M. Kastoryano, R. Babbush, J. Preskill, D. R. Reichman, E. T. Campbell, E. F. Valeev, L. Lin, G. K.-L. Chan', title: 'Evaluating the evidence for exponential quantum advantage in ground-state quantum chemistry', venue: 'Nat. Commun.', vol: '14', pages: '1952', year: 2023, doi: '10.1038/s41467-023-37587-6', free: true, algos: ['chemqpe'], note: { zh: '系统检查化学基态问题上指数优势的证据，结论是目前缺乏普遍的证据。必读。', en: 'A systematic look at the evidence for exponential advantage in ground-state chemistry, finding no generic evidence so far. Essential reading.' } },
    { id: 'gidney2021', kind: 'estimate', authors: 'C. Gidney, M. Ekerå', title: 'How to factor 2048 bit RSA integers in 8 hours using 20 million noisy qubits', venue: 'Quantum', vol: '5', pages: '433', year: 2021, doi: '10.22331/q-2021-04-15-433', free: true, algos: ['shor'], note: { zh: '2048 位 RSA 的完整资源估算。', en: 'A full resource estimate for 2048-bit RSA.' } },
    { id: 'gidney2025', kind: 'estimate', authors: 'C. Gidney', title: 'How to factor 2048 bit RSA integers with less than a million noisy qubits', venue: 'arXiv', year: 2025, arxiv: '2505.15917', free: true, algos: ['shor'], note: { zh: '把比特数降到一百万以下（预印本）。', en: 'Brings the qubit count under a million (preprint).' } },
    { id: 'babbush2021', kind: 'review', authors: 'R. Babbush, J. R. McClean, M. Newman, C. Gidney, S. Boixo, H. Neven', title: 'Focus beyond Quadratic Speedups for Error-Corrected Quantum Advantage', venue: 'PRX Quantum', vol: '2', pages: '010103', year: 2021, doi: '10.1103/PRXQuantum.2.010103', free: true, algos: ['aa'], note: { zh: '论证二次加速在早期容错硬件上很难带来实际优势。', en: 'Argues that quadratic speedups are unlikely to yield practical advantage on early fault-tolerant hardware.' } },
    { id: 'hoefler2023', kind: 'review', authors: 'T. Hoefler, T. Häner, M. Troyer', title: 'Disentangling Hype from Practicality: On Realistically Achieving Quantum Advantage', venue: 'Commun. ACM', vol: '66', pages: '82', year: 2023, doi: '10.1145/3571725', free: true, algos: ['qaoa', 'chemqpe'], note: { zh: '从计算机体系结构的角度评估哪些应用可能有实际优势：小数据、大计算的化学和材料问题最有希望。', en: 'Assesses from a computer-architecture viewpoint which applications might see real advantage: small-data, big-compute chemistry and materials problems look most promising.' } },
    { id: 'aaronson2015', kind: 'review', authors: 'S. Aaronson', title: 'Read the fine print', venue: 'Nat. Phys.', vol: '11', pages: '291', year: 2015, doi: '10.1038/nphys3272', algos: ['hhl'], note: { zh: '列出 HHL 类算法的全部前提。', en: 'Lists every condition behind HHL-type algorithms.' } },
    { id: 'preskill2018', kind: 'review', authors: 'J. Preskill', title: 'Quantum Computing in the NISQ era and beyond', venue: 'Quantum', vol: '2', pages: '79', year: 2018, doi: '10.22331/q-2018-08-06-79', free: true, algos: ['vqe', 'qaoa', 'mitig'], note: { zh: '提出“NISQ”一词，冷静评估含噪中等规模设备能做什么。', en: 'Coins “NISQ” and soberly assesses what noisy intermediate-scale devices can do.' } },
    { id: 'montanaro2016', kind: 'review', authors: 'A. Montanaro', title: 'Quantum algorithms: an overview', venue: 'npj Quantum Inf.', vol: '2', pages: '15023', year: 2016, doi: '10.1038/npjqi.2015.23', free: true, algos: ['query', 'aa', 'walk', 'hamsim'], note: { zh: '简洁的量子算法概览，开放获取，适合第一篇读。', en: 'A concise overview of quantum algorithms, open access; a good first read.' } },
    { id: 'cao2019', kind: 'review', authors: 'Y. Cao et al.', title: 'Quantum Chemistry in the Age of Quantum Computing', venue: 'Chem. Rev.', vol: '119', pages: '10856', year: 2019, doi: '10.1021/acs.chemrev.8b00803', algos: ['mapping', 'vqe', 'chemqpe'], note: { zh: '面向化学家的长篇综述。', en: 'A long review written for chemists.' } },
    { id: 'mcardle2020', kind: 'review', authors: 'S. McArdle, S. Endo, A. Aspuru-Guzik, S. C. Benjamin, X. Yuan', title: 'Quantum computational chemistry', venue: 'Rev. Mod. Phys.', vol: '92', pages: '015003', year: 2020, doi: '10.1103/RevModPhys.92.015003', algos: ['mapping', 'vqe', 'chemqpe', 'mitig'], note: { zh: '量子计算化学的全面综述，覆盖映射、VQE、相位估计和误差缓解。', en: 'A comprehensive review of quantum computational chemistry: mappings, VQE, phase estimation and error mitigation.' } },
    { id: 'bauer2020', kind: 'review', authors: 'B. Bauer, S. Bravyi, M. Motta, G. K.-L. Chan', title: 'Quantum Algorithms for Quantum Chemistry and Quantum Materials Science', venue: 'Chem. Rev.', vol: '120', pages: '12685', year: 2020, doi: '10.1021/acs.chemrev.9b00829', algos: ['chemqpe', 'hamsim'], note: { zh: '从经典方法的局限出发讨论量子算法能补什么。', en: 'Discusses what quantum algorithms can add, starting from the limits of classical methods.' } },
    { id: 'dalzell2023', kind: 'review', authors: 'A. M. Dalzell et al.', title: 'Quantum algorithms: A survey of applications and end-to-end complexities', venue: 'arXiv', year: 2023, arxiv: '2310.03011', free: true, algos: ['chemqpe', 'hhl', 'aa', 'qsvt'], note: { zh: '逐个应用做“端到端”成本核算的大型综述，判断任何优势说法的好参照。', en: 'A large survey that costs each application end to end; a good reference for judging any advantage claim.' } },
    { id: 'nielsen2010', kind: 'book', authors: 'M. A. Nielsen, I. L. Chuang', title: 'Quantum Computation and Quantum Information (10th Anniversary Edition)', venue: 'Cambridge University Press', year: 2010, doi: '10.1017/CBO9780511976667', algos: ['query', 'qft', 'qpe', 'aa', 'shor'], note: { zh: '标准教材，第 4–6 章是线路模型、QFT、相位估计、Shor 和 Grover。', en: 'The standard textbook; chapters 4–6 cover the circuit model, QFT, phase estimation, Shor and Grover.' } },
    { id: 'kitaev2002', kind: 'book', authors: 'A. Yu. Kitaev, A. H. Shen, M. N. Vyalyi', title: 'Classical and Quantum Computation', venue: 'American Mathematical Society (GSM 47)', year: 2002, doi: '10.1090/gsm/047', algos: ['qpe', 'query'], note: { zh: '数学化的薄教材，相位估计和 BQP 讲得严格。', en: 'A short, mathematical textbook with rigorous phase estimation and BQP.' } },
    { id: 'dewolf2019', kind: 'book', authors: 'R. de Wolf', title: 'Quantum Computing: Lecture Notes', venue: 'arXiv', year: 2019, arxiv: '1907.09415', free: true, algos: ['query', 'qft', 'aa', 'shor', 'walk', 'hamsim', 'hhl'], note: { zh: '阿姆斯特丹大学的硕士课程讲义，持续更新，前十章就是本栏目的主线。', en: 'Master’s-course notes from the University of Amsterdam, kept up to date; the first ten chapters follow this section’s main line.' } },
    { id: 'lin2022', kind: 'book', authors: 'L. Lin', title: 'Lecture Notes on Quantum Algorithms for Scientific Computation', venue: 'arXiv', year: 2022, arxiv: '2201.08309', free: true, algos: ['qsvt', 'qpe', 'hamsim', 'hhl'], note: { zh: '加州大学伯克利分校数学系研究生课讲义：相位估计、块编码、QSP 与 QSVT。', en: 'UC Berkeley graduate mathematics notes: phase estimation, block encodings, QSP and QSVT.' } },
    { id: 'childsnotes', kind: 'book', authors: 'A. M. Childs', title: 'Lecture Notes on Quantum Algorithms', venue: 'University of Maryland', year: 2022, url: 'https://www.cs.umd.edu/~amchilds/qa/', free: true, algos: ['query', 'qft', 'walk', 'hamsim', 'aa'], note: { zh: '马里兰大学的免费讲义，量子行走和哈密顿量模拟讲得尤其好。', en: 'Free notes from the University of Maryland, especially good on quantum walks and Hamiltonian simulation.' } },
    { id: 'zoo', kind: 'book', authors: 'S. Jordan', title: 'Quantum Algorithm Zoo', venue: 'Website', year: 2011, url: 'https://quantumalgorithmzoo.org/', free: true, algos: ['query', 'aa', 'shor', 'walk', 'hhl', 'hamsim'], note: { zh: '按问题分类、附原始文献的量子算法目录，持续更新。', en: 'A catalogue of quantum algorithms by problem, with original references, kept up to date.' } },
    { id: 'shorocw', kind: 'book', authors: 'P. Shor', title: '18.435J Quantum Computation (Fall 2003)', venue: 'MIT OpenCourseWare', year: 2003, url: 'https://ocw.mit.edu/courses/18-435j-quantum-computation-fall-2003/', free: true, algos: ['shor', 'qft', 'aa'], note: { zh: 'Shor 本人在 MIT 的课程讲义与作业。', en: 'Shor’s own MIT course notes and problem sets.' } },
  ],

  // 视频取自 ../../videos/videos-data.js（教学视频栏目已逐条核对），这里只列 id 和对应的算法
  videos: [
    ['PLOFEBzvs-VvrXTMy5Y2IqmSaUjfnhvBHR', ['query', 'qft', 'qpe', 'aa', 'mapping']],
    ['BV1oq4y1j7iZ', ['query', 'aa']],
    ['PLppkbh3UUiHC4pJwnLJalx2Oi5YhjlPbC', ['mapping', 'vqe']],
    ['PLOFEBzvs-Vvo5o97bYt8o1l8Ra1poMASQ', ['hamsim', 'vqe']],
    ['qiRtUUZ5s9s', ['vqe']],
    ['BV1Ab4y1R7wY', ['vqe']],
    ['BV1ih4y1M7ej', ['vqe']],
    ['BV1L4411y7ZP', ['vqe']],
    ['BV1TP411E7k1', ['mapping', 'vqe']],
    ['WuaoaknYDrk', ['hamsim', 'chemqpe']],
    ['PLvqjbKCkOZu8_aYhc8K4KJS_Xx9CzKyBd', ['chemqpe', 'vqe']],
    ['PLgKuh-lKre1025XhpsFXsZcUfABb9XPWj', ['chemqpe']],
    ['PLHyI3Fbmv0SfcpAXd1RwP3m2WExfemWeY', ['chemqpe', 'hamsim']],
  ],

  // 公式：[LaTeX, 是否行间]
  math: {
    dj: ['\\langle 0^n|\\,H^{\\otimes n}U_f H^{\\otimes n}\\,|0^n\\rangle=\\frac{1}{2^n}\\sum_{x\\in\\{0,1\\}^n}(-1)^{f(x)}', true],
    kickback: ['U_f\\,|x\\rangle|-\\rangle=(-1)^{f(x)}\\,|x\\rangle|-\\rangle,\\qquad |-\\rangle=\\tfrac{1}{\\sqrt2}(|0\\rangle-|1\\rangle)', true],
    qft: ['\\mathrm{QFT}\\,|j\\rangle=\\frac{1}{\\sqrt{2^n}}\\sum_{k=0}^{2^n-1}e^{2\\pi i\\,jk/2^n}\\,|k\\rangle', true],
    qftprod: ['\\mathrm{QFT}\\,|j_1\\cdots j_n\\rangle=\\bigotimes_{l=1}^{n}\\frac{|0\\rangle+e^{2\\pi i\\,0.j_{n-l+1}\\cdots j_n}|1\\rangle}{\\sqrt2}', true],
    qpe: ['\\frac{1}{\\sqrt{2^t}}\\sum_{j=0}^{2^t-1}e^{2\\pi i\\,j\\varphi}|j\\rangle\\;\\xrightarrow{\\ \\mathrm{QFT}^{-1}\\ }\\;\\approx|\\,2^t\\varphi\\,\\rangle', true],
    qpedist: ['P(m)=\\left|\\frac{1}{2^t}\\sum_{j=0}^{2^t-1}e^{2\\pi i\\,j(\\varphi-m/2^t)}\\right|^2=\\frac{\\sin^2(\\pi 2^t\\delta)}{4^t\\sin^2(\\pi\\delta)},\\quad \\delta=\\varphi-\\frac{m}{2^t}', true],
    grover: ['P_k=\\sin^2\\!\\big((2k+1)\\theta\\big),\\qquad \\sin\\theta=\\sqrt{M/N}', true],
    groverk: ['k^\\ast=\\left\\lfloor\\frac{\\pi}{4\\theta}\\right\\rfloor\\approx\\frac{\\pi}{4}\\sqrt{\\frac{N}{M}}', true],
    blockenc: ['U=\\begin{pmatrix}A/\\alpha & \\ast\\\\ \\ast & \\ast\\end{pmatrix},\\qquad (\\langle 0|\\otimes I)\\,U\\,(|0\\rangle\\otimes I)=A/\\alpha', true],
    lcu: ['H=\\sum_j \\alpha_j U_j,\\quad \\mathrm{PREP}|0\\rangle=\\sum_j\\sqrt{\\tfrac{\\alpha_j}{\\lambda}}\\,|j\\rangle,\\quad \\mathrm{SEL}=\\sum_j|j\\rangle\\langle j|\\otimes U_j,\\quad \\lambda=\\sum_j|\\alpha_j|', true],
    shor: ['f(x)=a^x \\bmod N,\\qquad f(x+r)=f(x),\\qquad U|y\\rangle=|ay \\bmod N\\rangle,\\quad U|u_s\\rangle=e^{2\\pi i s/r}|u_s\\rangle', true],
    shorgcd: ['a^r\\equiv 1\\pmod N\\;\\Rightarrow\\;(a^{r/2}-1)(a^{r/2}+1)\\equiv 0\\pmod N\\;\\Rightarrow\\;p=\\gcd(a^{r/2}\\pm1,\\,N)', true],
    trotter1: ['e^{-i(A+B)t}=\\big(e^{-iAt/r}e^{-iBt/r}\\big)^r+\\mathcal{O}\\!\\left(\\frac{t^2\\,\\|[A,B]\\|}{r}\\right)', true],
    trotter2: ['e^{-i(A+B)t}=\\big(e^{-iAt/2r}e^{-iBt/r}e^{-iAt/2r}\\big)^r+\\mathcal{O}\\!\\left(\\frac{t^3}{r^2}\\right)', true],
    qubitization: ['N_{\\mathrm{query}}=\\mathcal{O}\\!\\left(\\lambda t+\\log(1/\\varepsilon)\\right),\\qquad \\lambda=\\sum_j|h_j|', true],
    hhl: ['|b\\rangle=\\sum_j\\beta_j|u_j\\rangle\\;\\longrightarrow\\;\\sum_j\\beta_j|u_j\\rangle\\Big(\\tfrac{C}{\\lambda_j}|1\\rangle+\\sqrt{1-\\tfrac{C^2}{\\lambda_j^2}}\\,|0\\rangle\\Big)\\;\\xrightarrow{\\ 1\\ }\\;|x\\rangle\\propto A^{-1}|b\\rangle', true],
    walk: ['|\\psi(t)\\rangle=e^{-iAt}\\,|s\\rangle,\\qquad A_{uv}=1\\iff u\\sim v', true],
    secondq: ['\\hat H=\\sum_{pq}h_{pq}\\,a_p^\\dagger a_q+\\frac12\\sum_{pqrs}h_{pqrs}\\,a_p^\\dagger a_q^\\dagger a_r a_s', true],
    jw: ['a_j^\\dagger=\\Big(\\prod_{k<j}Z_k\\Big)\\frac{X_j-iY_j}{2},\\qquad \\{a_i,a_j^\\dagger\\}=\\delta_{ij},\\quad \\{a_i,a_j\\}=0', true],
    qpeenergy: ['U=e^{-i\\hat H t},\\quad U|E_k\\rangle=e^{-iE_k t}|E_k\\rangle,\\qquad P(E_0)=|\\langle\\psi_0|E_0\\rangle|^2', true],
    chemcost: ['N_{\\mathrm{BE}}\\;\\approx\\;\\frac{1}{|\\langle\\psi_0|E_0\\rangle|^2}\\times\\mathcal{O}\\!\\left(\\frac{\\lambda}{\\varepsilon}\\right),\\qquad \\varepsilon\\approx1.6\\ \\mathrm{mE_h}', true],
    vqe: ['E(\\boldsymbol\\theta)=\\langle\\psi(\\boldsymbol\\theta)|\\hat H|\\psi(\\boldsymbol\\theta)\\rangle=\\sum_j c_j\\langle P_j\\rangle\\;\\ge\\;E_0', true],
    shift: ['\\frac{\\partial E}{\\partial\\theta_k}=\\frac{E(\\boldsymbol\\theta+\\tfrac{\\pi}{2}\\mathbf e_k)-E(\\boldsymbol\\theta-\\tfrac{\\pi}{2}\\mathbf e_k)}{2}', true],
    shots: ['N_{\\text{shots}}\\;\\lesssim\\;\\frac{\\big(\\sum_j|c_j|\\big)^2}{\\varepsilon^2}', true],
    qaoa: ['|\\boldsymbol\\gamma,\\boldsymbol\\beta\\rangle=\\prod_{l=1}^{p}e^{-i\\beta_l B}\\,e^{-i\\gamma_l C}\\,|+\\rangle^{\\otimes n},\\qquad B=\\sum_j X_j', true],
    zne: ['E(0)\\approx\\frac{\\lambda_2E(\\lambda_1)-\\lambda_1E(\\lambda_2)}{\\lambda_2-\\lambda_1}', true],
  },
};
