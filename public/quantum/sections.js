/* 量子嘉年华 · Quantum Carnival：母栏目页上的四张栏目卡片。
   四个子栏目各自开发、各自合并，所以每个栏目占一个独立的块（块之间隔空行），各自的 PR 只改自己那一块，git 能干净合并。
   live: false 时卡片显示“即将上线”、不出链接；子栏目合并时把自己块里的 live 改成 true。
   字段：id、path（相对 public/quantum/）、glyph（卡片角上的符号，不翻译）、title / blurb（中英两版）、topics（几个关键词，中英两版）。 */
window.MOLASTRIA_QUANTUM_SECTIONS = [

  {
    id: 'physics', path: 'physics/index.html', live: true,
    glyph: 'ψ ħ ⟨Â⟩ |↑⟩',
    title: { zh: '量子物理', en: 'Quantum Physics' },
    blurb: {
      zh: '从黑体辐射到无漏洞 Bell 实验：薛定谔方程、算符与测量、角动量与自旋、近似方法、全同粒子、纠缠与退相干，再到量子场、凝聚态和量子光学。每一章有讲解、公式、动手练习和核对过的教材与课程，配可交互的演示。',
      en: 'From blackbody radiation to loophole-free Bell tests: the Schrödinger equation, operators and measurement, angular momentum and spin, approximation methods, identical particles, entanglement and decoherence, then quantum fields, condensed matter and quantum optics. Every chapter has an explanation, formulas, exercises and checked textbooks and courses, with interactive demos.',
    },
    topics: { zh: ['薛定谔方程', '测量', '自旋', '纠缠', 'Bell 不等式'], en: ['Schrödinger equation', 'Measurement', 'Spin', 'Entanglement', 'Bell inequalities'] },
  },

  {
    id: 'computing', path: 'computing/index.html', live: false,
    glyph: '|0⟩ |1⟩ T₁ T₂ d=7',
    title: { zh: '量子计算机', en: 'Quantum Computers' },
    blurb: {
      zh: '量子计算机是怎样造出来的：超导、离子阱、中性原子、光子、自旋和拓扑六条硬件路线，量子比特的物理与噪声，纠错与容错架构，以及“量子优势”这几年的真实进展和争议。',
      en: 'How quantum computers are actually built: six hardware routes (superconducting, trapped ions, neutral atoms, photons, spins, topological), the physics and noise of qubits, error correction and fault-tolerant architecture, and what the "quantum advantage" claims of recent years did and did not show.',
    },
    topics: { zh: ['硬件路线', '噪声', '纠错', '量子优势'], en: ['Hardware routes', 'Noise', 'Error correction', 'Quantum advantage'] },
  },

  {
    id: 'algorithms', path: 'algorithms/index.html', live: false,
    glyph: 'H CNOT QFT ⟨H⟩',
    title: { zh: '量子算法', en: 'Quantum Algorithms' },
    blurb: {
      zh: '从电路模型到 Shor、Grover、哈密顿量模拟与 VQE，配可运行的量子电路模拟器。',
      en: 'From the circuit model to Shor, Grover, Hamiltonian simulation and VQE, with a quantum circuit simulator you can run.',
    },
    topics: { zh: ['电路模型', 'Shor', 'Grover', '哈密顿量模拟', 'VQE'], en: ['Circuit model', 'Shor', 'Grover', 'Hamiltonian simulation', 'VQE'] },
  },

  {
    id: 'biology', path: 'biology/index.html', live: true,
    glyph: 'FMO ⇌ •• H/D',
    title: { zh: '量子生物学', en: 'Quantum Biology' },
    blurb: {
      zh: '生命里有没有真正“量子”的环节：光合作用的能量传递、候鸟的自由基对磁罗盘、酶里的氢隧穿、DNA 突变与嗅觉，每条结论都标明证据强度。配三个交互演示和 56 篇核对过的文献。',
      en: 'Where life might be genuinely quantum: energy transfer in photosynthesis, the radical-pair compass of migratory birds, hydrogen tunnelling in enzymes, DNA mutations and smell, each claim labelled by strength of evidence. With three interactive demos and 56 checked references.',
    },
    topics: { zh: ['能量传递', '自由基对罗盘', '氢隧穿', '证据账本'], en: ['Energy transfer', 'Radical-pair compass', 'H tunnelling', 'Evidence ledger'] },
  },

];
