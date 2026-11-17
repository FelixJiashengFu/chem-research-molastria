'use strict';
// 张量网络与强关联（/tensor/）的十四个演示。数学都在 tn-models.js（纯函数，tools/tensor-test.mjs 测）。tn.js 用 window.MOLASTRIA_TENSOR_DEMOS(K, DEMOS) 把它们登记进去。
// 写法同群论的 gt-demos.js：title，kind，intro，sel，ctl，chk，btn，act，state，autoplay，fps + tick(s)，changed，figs，note，draw(s, 图, 颜色) 返回读数。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。'html' 图里的内容也只用这里的固定文字和算出来的数字拼。
// 算得慢的东西（精确对角化、整条曲线）按参数缓存在这个文件里，拖滑块时只重画。
window.MOLASTRIA_TENSOR_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_TENSOR_MODELS;
  const { L, fix, fmt, plot, fit, lin, font, cells, sup, table } = K;
  const TAU = 2 * Math.PI, LN2 = Math.LN2, LOG2 = Math.log10(2);
  const memo = new Map();
  const cache = (key, f) => { if (!memo.has(key)) { if (memo.size > 60) memo.delete(memo.keys().next().value); memo.set(key, f()); } return memo.get(key); };
  const range = (a, b, step = 1) => { const out = []; for (let x = a; x <= b + 1e-9; x += step) out.push(Number(x.toFixed(10))); return out; };
  const pow10 = (t) => `10${sup(t)}`;
  const big = (log10v) => (log10v < 6 ? String(Math.round(10 ** log10v)).replace(/\B(?=(\d{3})+(?!\d))/g, ' ') : `${fix(10 ** (log10v - Math.floor(log10v)), 2)} × 10${sup(Math.floor(log10v))}`);
  const bytes = (log10b) => { const u = [[0, 'B'], [3, 'KB'], [6, 'MB'], [9, 'GB'], [12, 'TB'], [15, 'PB'], [18, 'EB']]; const [p, n] = u.filter(([q]) => log10b >= q).pop() || u[0]; return log10b > 21 ? `${big(log10b)} B` : `${fix(10 ** (log10b - p), log10b - p < 1 ? 2 : 1)} ${n}`; };
  const MEM_LAPTOP = Math.log10(16e9 / 8), MEM_PB = Math.log10(1e15 / 8); // 16 GB 和 1 PB 能放的双精度数个数

  // ── 第一章：指数墙 ──────────────────────────────────────────────────
  DEMOS.wall = {
    title: L('指数墙：精确地写下一个量子态要多少个数', 'The exponential wall: how many numbers it takes to write down a quantum state exactly'), kind: 'exact',
    intro: L('N 个自旋 ½ 的态要 2ᴺ 个振幅；N 个空间轨道里每个可以空、↑、↓ 或 ↑↓，是 4ᴺ；把 N 个电子放进 N 个轨道、自旋向上向下各一半（化学里的 CAS(N, N)），行列式个数是 C(N, N/2)²。拖动 N，看这些数什么时候超过一台笔记本、一整台超级计算机的内存。', 'A state of N spin-½s takes 2ᴺ amplitudes; with N spatial orbitals each can be empty, ↑, ↓ or ↑↓, giving 4ᴺ; putting N electrons in N orbitals, half spin-up and half spin-down (CAS(N, N) in chemistry), gives C(N, N/2)² determinants. Drag N and see when these numbers pass the memory of a laptop and of a whole supercomputer.'),
    ctl: [['n', L('格点或轨道数 N', 'Number of sites or orbitals N'), 2, 60, 1, 20, (v) => String(v)]],
    btn: [[L('16 个自旋', '16 spins'), { n: 16 }], [L('CAS(18, 18)', 'CAS(18, 18)'), { n: 18 }], [L('50 个量子比特', '50 qubits'), { n: 50 }]],
    figs: [[0.56, L('纵轴是数目的常用对数。两条横线：16 GB 的笔记本和 1 PB（10¹⁵ 字节）能放下的双精度数个数。', 'The vertical axis is the base-10 logarithm of the count. Horizontal lines: how many double-precision numbers fit in a 16 GB laptop and in 1 PB (10¹⁵ bytes).')]],
    note: L('都是精确计数，没有近似。存一个振幅按 8 字节（实数双精度）算；复数要加倍。CAS(N, N) 是总自旋投影为 0 的行列式数；按总自旋 S = 0 的组态函数（CSF）数要少一些（见第八章的演示），但同样是指数增长。矩阵乘积态那一行是 N 个格点、键维 χ = 1000 时的参数个数 2Nχ²（第三章），只随 N 线性增长。', 'All exact counts, no approximation. Each amplitude is taken as 8 bytes (a real double); complex numbers double it. CAS(N, N) counts determinants with zero total spin projection; the number of S = 0 configuration state functions is somewhat smaller (see the demo in chapter 8) but grows just as exponentially. The matrix-product-state line is the parameter count 2Nχ² of an N-site MPS with bond dimension χ = 1000 (chapter 3), which grows only linearly in N.'),
    draw(s, [cv], c) {
      const Ns = range(2, 60), spin = Ns.map((n) => n * LOG2), orb = Ns.map((n) => 2 * n * LOG2), cas = Ns.map((n) => M.log10dets(n, n)), mps = Ns.map((n) => Math.log10(2 * n * 1e6));
      plot(cv, { x: [2, 60], y: [0, 37], xl: 'N', yl: L('数目', 'count'), yf: pow10, yt: [0, 5, 10, 15, 20, 25, 30, 35],
        series: [{ xs: Ns, ys: orb, color: c.danger, width: 2.2, label: '4ᴺ' }, { xs: Ns, ys: spin, color: c.accent, width: 2.4, label: '2ᴺ' }, { xs: Ns, ys: cas, color: c.gold, width: 2.4, label: 'CAS(N, N)' }, { xs: Ns, ys: mps, color: c.ok, dash: [6, 4], width: 2, label: 'MPS, χ = 1000' }],
        hmarks: [{ y: MEM_LAPTOP, color: c.muted }, { y: MEM_PB, color: c.ink2 }], marks: [{ x: s.n, color: c.ink2 }],
        texts: [{ x: 3, y: MEM_LAPTOP + 0.6, s: '16 GB', color: c.muted }, { x: 3, y: MEM_PB + 0.6, s: '1 PB', color: c.ink2 }] });
      const n = s.n, ls = n * LOG2, lc = M.log10dets(n, n);
      return [[L('2ᴺ 个振幅', '2ᴺ amplitudes'), big(ls), true], [L('存一个态', 'One state takes'), bytes(ls + Math.log10(8))], [L('CAS(N, N) 行列式', 'CAS(N, N) determinants'), big(lc)], [L('存一个 CI 向量', 'One CI vector takes'), bytes(lc + Math.log10(8))], [L('MPS（χ = 1000）的参数', 'MPS parameters (χ = 1000)'), big(Math.log10(2 * n * 1e6))]];
    },
  };

  // ── 第一章：Hubbard 链 ─────────────────────────────────────────────
  const hubCurve = (n) => cache(`hub${n}`, () => { const Us = range(0, 12, n >= 8 ? 2 : 0.5); return { Us, ed: Us.map((U) => M.hubbardED(n, U)) }; });
  const hubMF = (n) => cache(`hubmf${n}`, () => { const Us = range(0, 12, 0.25); return { Us, mf: Us.map((U) => M.hubbardMF(n, U)) }; });
  DEMOS.hubbard = {
    title: L('平均场在哪里失败：半满的 Hubbard 链', 'Where mean field fails: the half-filled Hubbard chain'), kind: 'exact',
    intro: L('电子在一条链上跳（跳跃积分 t），两个电子挤在同一个格点上要付出 U。U = 0 时 Hartree–Fock（RHF）就是精确的；U 越大，电子越想彼此避开，一个行列式就越描述不了。蓝点是精确对角化，金线是 RHF，虚线是允许自旋上下分开的 UHF：它的能量好一些，代价是打破了自旋对称性。下图是“双占据”：两个电子在同一格点上的概率，RHF 永远是 ¼。', 'Electrons hop along a chain (hopping t) and pay U when two sit on the same site. At U = 0 Hartree–Fock (RHF) is exact; the larger U, the more the electrons avoid each other and the less a single determinant can describe them. Blue dots are exact diagonalisation, the gold line RHF, the dashed line UHF, which lets up and down spins separate: its energy is better, at the price of broken spin symmetry. Below is the “double occupancy”, the probability of finding two electrons on one site; RHF always says ¼.'),
    sel: [['n', L('格点数', 'Sites'), [['4', '4'], ['6', '6'], ['8', '8']], '6']],
    ctl: [['u', 'U / t', 0, 12, 0.25, 4, (v) => v.toFixed(2)]],
    btn: [[L('弱关联 U = 1', 'Weak, U = 1'), { u: 1 }], [L('U = 带宽 4', 'U = bandwidth 4'), { u: 4 }], [L('强关联 U = 10', 'Strong, U = 10'), { u: 10 }]],
    figs: [[0.55, L('每个格点的基态能量 E/N（单位 t）。', 'Ground-state energy per site E/N (units of t).')], [0.42, L('双占据 ⟨n↑n↓⟩：U 大时精确值趋于零，电子“各占一个格点”，这就是 Mott 绝缘体的雏形。', 'Double occupancy ⟨n↑n↓⟩: for large U the exact value goes to zero and electrons sit one per site, the germ of a Mott insulator.')]],
    note: L('开边界的链，半满（电子数 = 格点数），总 Sᶻ = 0。精确解用 Lanczos 对角化完整的多体哈密顿量（8 个格点时 4 900 维）。RHF 在二分格子半满时每个格点的密度正好是 ½，所以 E_RHF = E(U=0) + UN/4 是一条直线。UHF 从交错磁化出发自洽迭代；它低于 RHF 是因为自旋对称性破缺，在有限的链上这是近似的产物，精确基态仍然是单态。', 'Open chain, half filling (as many electrons as sites), total Sᶻ = 0. The exact answer diagonalises the full many-body Hamiltonian with Lanczos (4 900 states for 8 sites). For RHF at half filling on a bipartite lattice every site has density exactly ½, so E_RHF = E(U=0) + UN/4 is a straight line. UHF is iterated to self-consistency from a staggered magnetisation; that it beats RHF is due to broken spin symmetry, an artefact of the approximation on a finite chain: the exact ground state is still a singlet.'),
    draw(s, [cv, cv2], c) {
      const n = Number(s.n), cur = hubCurve(n), mf = hubMF(n), now = cache(`hubnow${n}_${s.u}`, () => M.hubbardED(n, s.u)), mfNow = M.hubbardMF(n, s.u);
      const yAll = [...cur.ed.map((x) => x.E / n), ...mf.mf.map((x) => x.rhf.E / n)];
      plot(cv, { x: [0, 12], y: [Math.min(...yAll) - 0.05, Math.min(1.2, Math.max(...yAll)) + 0.05], xl: 'U / t', yl: 'E / N',
        series: [{ xs: mf.Us, ys: mf.mf.map((x) => x.rhf.E / n), color: c.gold, width: 2.2, label: 'RHF' }, { xs: mf.Us, ys: mf.mf.map((x) => x.uhf.E / n), color: c.danger, dash: [6, 4], width: 2, label: 'UHF' }, { xs: cur.Us, ys: cur.ed.map((x) => x.E / n), color: c.accent, dots: 3.5, line: true, width: 2, label: L('精确', 'Exact') }],
        marks: [{ x: s.u, y: now.E / n, color: c.ink2 }] });
      plot(cv2, { x: [0, 12], y: [0, 0.27], xl: 'U / t', yl: '⟨n↑n↓⟩',
        series: [{ xs: mf.Us, ys: mf.mf.map(() => 0.25), color: c.gold, width: 2.2, label: 'RHF' }, { xs: mf.Us, ys: mf.mf.map((x) => x.uhf.D), color: c.danger, dash: [6, 4], width: 2, label: 'UHF' }, { xs: cur.Us, ys: cur.ed.map((x) => x.D), color: c.accent, dots: 3.5, line: true, width: 2, label: L('精确', 'Exact') }],
        marks: [{ x: s.u, y: now.D, color: c.ink2 }] });
      const ec = now.E - mfNow.rhf.E, share = Math.abs(ec) > 1e-9 ? (mfNow.rhf.E - mfNow.uhf.E) / -ec : NaN;
      return [[L('精确 E/N', 'Exact E/N'), fix(now.E / n, 4), true], ['RHF E/N', fix(mfNow.rhf.E / n, 4)], ['UHF E/N', fix(mfNow.uhf.E / n, 4)], [L('关联能 E − E_RHF（每格点）', 'Correlation energy E − E_RHF (per site)'), fix(ec / n, 4)], [L('UHF 找回的关联能', 'Share recovered by UHF'), Number.isFinite(share) ? `${fix(100 * share, 1)} %` : '—'], [L('双占据：精确 / UHF / RHF', 'Double occupancy: exact / UHF / RHF'), `${fix(now.D, 3)} / ${fix(mfNow.uhf.D, 3)} / 0.250`], [L('希尔伯特空间维数', 'Hilbert-space dimension'), String(now.dim)]];
    },
  };

  // ── 第二章：两个量子比特的施密特分解 ─────────────────────────────────
  DEMOS.schmidt = {
    title: L('施密特分解：两个量子比特之间有多少纠缠', 'The Schmidt decomposition: how much entanglement two qubits share'), kind: 'exact',
    intro: L('态 |ψ⟩ = cos θ |0⟩⊗|b₀⟩ + sin θ |1⟩⊗|b₁⟩，|b₀⟩、|b₁⟩ 是把 B 转过 α 角的基。把 2 × 2 的系数矩阵做奇异值分解，得到两个施密特值 λ₁ ≥ λ₂；纠缠熵 S = −Σ λ² ln λ²。θ = 0 是乘积态（S = 0），θ = 45° 是 Bell 态（S = ln 2，两个比特能有的最大值）。转 α 时系数矩阵在变，施密特值和熵却不变：纠缠不能靠只动一边来产生或消除。', 'The state |ψ⟩ = cos θ |0⟩⊗|b₀⟩ + sin θ |1⟩⊗|b₁⟩, where |b₀⟩, |b₁⟩ is B’s basis rotated by α. A singular-value decomposition of the 2 × 2 coefficient matrix gives two Schmidt values λ₁ ≥ λ₂; the entanglement entropy is S = −Σ λ² ln λ². θ = 0 is a product state (S = 0); θ = 45° is a Bell state (S = ln 2, the most two qubits can have). Turning α changes the coefficient matrix but not the Schmidt values or the entropy: entanglement cannot be created or removed by acting on one side alone.'),
    ctl: [['th', 'θ', 0, 90, 1, 30, (v) => `${v}°`], ['al', L('只转 B 的角度 α', 'Rotate B only by α'), 0, 180, 1, 0, (v) => `${v}°`]],
    btn: [[L('乘积态', 'Product state'), { th: 0 }], [L('Bell 态', 'Bell state'), { th: 45 }], [L('转一下 B', 'Rotate B'), { al: 60 }]],
    figs: [['html', ''], [0.42, L('纠缠熵随 θ 的变化；点是现在的态。虚线是 ln 2。', 'Entanglement entropy against θ; the dot is the current state. The dashed line is ln 2.')]],
    note: L('只用实数振幅，够看清施密特分解。共生纠缠度（concurrence）C = 2|ψ₀₀ψ₁₁ − ψ₀₁ψ₁₀| 是两比特纯态纠缠的另一种量法，和 S 一一对应。', 'Real amplitudes only, which is enough to see the Schmidt decomposition. The concurrence C = 2|ψ₀₀ψ₁₁ − ψ₀₁ψ₁₀| is another measure of two-qubit pure-state entanglement and is in one-to-one correspondence with S.'),
    draw(s, [box, cv], c) {
      const th = (s.th * Math.PI) / 180, al = (s.al * Math.PI) / 180, ca = Math.cos(al), sa = Math.sin(al);
      const P = [[Math.cos(th) * ca, Math.cos(th) * sa], [-Math.sin(th) * sa, Math.sin(th) * ca]], r = M.twoQubit(P[0][0], P[0][1], P[1][0], P[1][1]);
      const cell = (v) => `<td class="num">${fix(v, 3)}</td>`;
      box.innerHTML = `<table class="chm-table tn-coef"><thead><tr><th>ψ<sub>ab</sub></th><th>b = 0</th><th>b = 1</th></tr></thead><tbody><tr><th>a = 0</th>${cell(P[0][0])}${cell(P[0][1])}</tr><tr><th>a = 1</th>${cell(P[1][0])}${cell(P[1][1])}</tr></tbody></table>
        <p class="muted" style="text-align:center;margin:8px 0 0">${L('奇异值（施密特值）', 'Singular (Schmidt) values')}: λ₁ = ${fix(r.s[0], 4)}, λ₂ = ${fix(r.s[1], 4)}</p>`;
      const ts = lin(0, 90, 181), S = ts.map((t) => { const a = Math.cos((t * Math.PI) / 180) ** 2; return a <= 0 || a >= 1 ? 0 : -a * Math.log(a) - (1 - a) * Math.log(1 - a); });
      plot(cv, { x: [0, 90], y: [0, 0.8], xl: 'θ (°)', yl: 'S', series: [{ xs: ts, ys: S, color: c.accent, width: 2.4 }], hmarks: [{ y: LN2, color: c.gold }], marks: [{ x: s.th, y: r.S, color: c.danger }] });
      return [[L('纠缠熵 S', 'Entanglement entropy S'), `${fix(r.S, 4)} nat`, true], [L('以比特计', 'In bits'), fix(r.S / LN2, 4)], [L('共生纠缠度 C', 'Concurrence C'), fix(r.concurrence, 4)], [L('施密特秩', 'Schmidt rank'), r.s[1] > 1e-9 ? '2' : '1'], [L('结论', 'Verdict'), r.S < 1e-9 ? L('乘积态：没有纠缠', 'Product state: no entanglement') : r.S > LN2 - 1e-6 ? L('最大纠缠', 'Maximally entangled') : L('部分纠缠', 'Partly entangled')]];
    },
  };

  // ── 第二章：面积律和对数修正 ─────────────────────────────────────────
  const chainS = (N, d) => cache(`ch${N}_${d}`, () => M.chainEntropy(N, d));
  DEMOS.area = {
    title: L('面积律：有能隙的链纠缠饱和，临界的链按对数长', 'The area law: a gapped chain’s entanglement saturates, a critical one grows logarithmically'), kind: 'exact',
    intro: L('一条 N 个格点的自由费米子链（XX 链），键交替地强弱：1 + δ、1 − δ。把链切成长 l 和 N − l 两段，算左段的纠缠熵 S(l)。δ > 0 时有能隙，S(l) 很快饱和，不管 l 多长（一维的“面积”就是一个切口）；δ = 0 时没有能隙，是临界的，S(l) 按 (c/6) ln l 长，c = 1 是这个共形场论的中心荷。下图把横轴换成 Calabrese–Cardy 公式里的弦长对数，临界链变成一条斜率 c/6 的直线。', 'A free-fermion chain (the XX chain) of N sites with bonds alternately strong and weak: 1 + δ, 1 − δ. Cut it into pieces of length l and N − l and compute the entanglement entropy S(l) of the left piece. For δ > 0 there is a gap and S(l) saturates quickly, however long l is (in one dimension the “area” is a single cut); for δ = 0 there is no gap, the chain is critical and S(l) grows as (c/6) ln l, where c = 1 is the central charge of the conformal field theory. Below, the horizontal axis is the logarithm of the chord length from the Calabrese–Cardy formula, and the critical chain becomes a straight line of slope c/6.'),
    ctl: [['n', L('链长 N', 'Chain length N'), 32, 128, 8, 64, (v) => String(v)], ['d', L('二聚化 δ', 'Dimerisation δ'), 0, 0.6, 0.02, 0.2, (v) => v.toFixed(2)]],
    btn: [[L('临界 δ = 0', 'Critical δ = 0'), { d: 0 }], [L('小能隙 δ = 0.1', 'Small gap δ = 0.1'), { d: 0.1 }], [L('大能隙 δ = 0.5', 'Large gap δ = 0.5'), { d: 0.5 }]],
    figs: [[0.5, L('纠缠熵 S(l)：金色是当前的 δ，蓝色是临界链 δ = 0，虚线是拟合的 Calabrese–Cardy 曲线（只画偶数 l）。', 'Entanglement entropy S(l): gold is the current δ, blue the critical chain δ = 0, the dashed line the fitted Calabrese–Cardy curve (even l only).')], [0.42, L('临界链的 S 对 ln[(2N/π) sin(πl/N)]：直线的斜率是 c/6。', 'S of the critical chain against ln[(2N/π) sin(πl/N)]: the slope of the line is c/6.')]],
    note: L('自由费米子的基态是一个 Slater 行列式，任何一段的纠缠熵都可以从关联矩阵 C_ij = ⟨c†ᵢcⱼ⟩ 限制在这一段上的本征值 ν 精确算出：S = −Σ[ν ln ν + (1 − ν) ln(1 − ν)]（Peschel 2003）。所以能做到上百个格点。开边界的 XX 链有奇偶振荡，拟合只用偶数 l；N 有限时拟合出的 c 比 1 略大，N 越大越接近 1。', 'The ground state of free fermions is a Slater determinant, and the entanglement entropy of any block follows exactly from the eigenvalues ν of the correlation matrix C_ij = ⟨c†ᵢcⱼ⟩ restricted to the block: S = −Σ[ν ln ν + (1 − ν) ln(1 − ν)] (Peschel 2003). That is why hundreds of sites are possible. The open XX chain has even–odd oscillations, so the fit uses even l only; at finite N the fitted c is slightly above 1 and approaches 1 as N grows.'),
    draw(s, [cv, cv2], c) {
      const N = s.n, cur = chainS(N, s.d), crit = chainS(N, 0), fitc = M.fitCentral(N, crit.S), ls = range(1, N - 1), even = ls.filter((l) => l % 2 === 0 && l >= 2 && l <= N - 2);
      plot(cv, { x: [0, N], y: [0, Math.max(1.6, ...crit.S) + 0.15], xl: 'l', yl: 'S(l)',
        series: [{ xs: ls, ys: crit.S, color: c.accent, width: 1.6, label: 'δ = 0' }, { xs: even, ys: even.map((l) => (fitc.c / 6) * M.ccChord(N, l) + fitc.b), color: c.ink2, dash: [5, 4], width: 1.6, label: 'Calabrese–Cardy' }, ...(s.d > 0 ? [{ xs: ls, ys: cur.S, color: c.gold, width: 2.2, label: `δ = ${fix(s.d, 2)}` }] : [])] });
      const xs = even.map((l) => M.ccChord(N, l));
      plot(cv2, { x: [Math.min(...xs) - 0.1, Math.max(...xs) + 0.1], y: [Math.min(...even.map((l) => crit.S[l - 1])) - 0.05, Math.max(...even.map((l) => crit.S[l - 1])) + 0.05], xl: 'ln[(2N/π) sin(πl/N)]', yl: 'S',
        series: [{ xs, ys: even.map((l) => crit.S[l - 1]), color: c.accent, dots: 3 }, { xs, ys: xs.map((x) => (fitc.c / 6) * x + fitc.b), color: c.gold, width: 2 }] });
      const mid = cur.S[N / 2 - 1];
      return [[L('半链纠缠熵 S(N/2)', 'Half-chain entropy S(N/2)'), `${fix(mid, 3)} nat`, true], [L('至少要的键维 χ ≥ e^S', 'Bond dimension needed χ ≥ e^S'), fix(Math.exp(mid), 3)], [L('单粒子能隙', 'Single-particle gap'), fix(cur.gap, 4)], [L('临界链拟合的中心荷 c', 'Central charge c fitted from the critical chain'), fix(fitc.c, 3)], [L('行为', 'Behaviour'), s.d > 0 ? L('有能隙：S 饱和（面积律）', 'Gapped: S saturates (area law)') : L('临界：S ∝ (c/6) ln l', 'Critical: S ∝ (c/6) ln l')]];
    },
  };

  // ── 第三章：精确态截断成 MPS ──────────────────────────────────────────
  const CHIS = [1, 2, 4, 8, 16, 32, 64];
  const MODELS = { tc: { kind: 'tfim', g: 1 }, tp: { kind: 'tfim', g: 2 }, to: { kind: 'tfim', g: 0.6 }, hb: { kind: 'xxz', Delta: 1 } };
  const gsOf = (id, N) => cache(`gs${id}${N}`, () => { const m = M.spinModel({ ...MODELS[id], N }); const g = M.groundState(m); const full = M.mpsCompress(g.v, N, 1 << 20); return { m, psi: g.v, E: g.E, full, prof: full.bonds.map((b) => M.entropyOf(b.s)) }; });
  const truncs = (id, N) => cache(`tr${id}${N}`, () => CHIS.map((chi) => M.truncate(gsOf(id, N).m, gsOf(id, N).psi, chi)));
  DEMOS.trunc = {
    title: L('把精确的基态压成矩阵乘积态：χ 要多大', 'Compressing an exact ground state into a matrix product state: how large must χ be?'), kind: 'exact',
    intro: L('先用精确对角化求出一条自旋链的基态（12 个格点是 4 096 个振幅），再从左到右逐次做奇异值分解，每条键只留最大的 χ 个施密特值，得到一个键维 χ 的矩阵乘积态（MPS）。看三件事：中间那条键的施密特值掉得多快、截断后纠缠熵的分布、保真度和能量误差随 χ 怎样变。施密特值掉得快，少量参数就够；这正是 DMRG 能成功的原因。', 'First find the ground state of a spin chain by exact diagonalisation (12 sites is 4 096 amplitudes), then do successive singular-value decompositions from left to right, keeping only the χ largest Schmidt values on each bond: the result is a matrix product state (MPS) of bond dimension χ. Watch three things: how fast the Schmidt values on the middle bond fall, how the entanglement is distributed after truncation, and how the fidelity and the energy error change with χ. Fast-falling Schmidt values mean few parameters suffice; this is exactly why DMRG works.'),
    sel: [['m', L('模型', 'Model'), [['tc', L('横场 Ising，临界点 g = 1', 'Transverse-field Ising, critical g = 1')], ['tp', L('横场 Ising，顺磁 g = 2', 'Transverse-field Ising, paramagnet g = 2')], ['to', L('横场 Ising，有序 g = 0.6', 'Transverse-field Ising, ordered g = 0.6')], ['hb', L('Heisenberg 反铁磁链', 'Heisenberg antiferromagnet')]], 'tc']],
    ctl: [['n', L('格点数 N', 'Sites N'), 8, 14, 2, 12, (v) => String(v)], ['k', L('键维 χ', 'Bond dimension χ'), 0, 6, 1, 2, (v) => String(CHIS[v])]],
    figs: [[0.42, L('中间那条键的施密特值 λ²（对数轴，按大小排）。竖线左边的保留，右边的扔掉。', 'Schmidt values λ² on the middle bond (log scale, sorted). Those left of the line are kept, those to the right discarded.')], [0.42, L('每条键上的纠缠熵：蓝色是精确态，金色是截断后的 MPS。截断后 S 不会超过 ln χ（虚线）。', 'Entanglement entropy on each bond: blue for the exact state, gold for the truncated MPS. After truncation S cannot exceed ln χ (dashed).')], [0.42, L('误差随 χ：1 − 保真度和相对能量误差（对数轴）。', 'Error against χ: 1 − fidelity and relative energy error (log scale).')]],
    note: L('精确对角化用 Lanczos。逐次 SVD 是 Vidal（2003）和 Schollwöck（2011）综述里的标准做法：截断只在当前的键上最优，整体扔掉的权重大约是各键扔掉的权重之和。MPS 的参数个数按每个张量 χ_左 × 2 × χ_右 数。保真度 |⟨ψ_exact|ψ_MPS⟩|²。', 'Exact diagonalisation uses Lanczos. Successive SVD is the standard procedure of Vidal (2003) and the Schollwöck (2011) review: truncation is optimal for the current bond only, and the total discarded weight is roughly the sum of the weights discarded on each bond. MPS parameters are counted as χ_left × 2 × χ_right per tensor. Fidelity is |⟨ψ_exact|ψ_MPS⟩|².'),
    draw(s, [cv, cv2, cv3], c) {
      const N = s.n, G = gsOf(s.m, N), T = truncs(s.m, N), chi = CHIS[s.k], t = T[s.k];
      const mid = G.full.bonds[N / 2 - 1].s.map((x) => x * x).filter((p) => p > 1e-17), ks = mid.map((_, i) => i + 1);
      plot(cv, { x: [0.5, Math.min(mid.length, 64) + 0.5], y: [-17, 0.3], logy: true, xl: L('第几个施密特值', 'Index of the Schmidt value'), yl: 'λ²',
        series: [{ xs: ks, ys: mid, color: c.accent, bars: 0.8 }, { xs: ks.filter((k) => k <= chi), ys: mid.filter((_, i) => i < chi), color: c.gold, bars: 0.8 }], marks: [{ x: chi + 0.5, color: c.danger }] });
      const bs = range(1, N - 1);
      plot(cv2, { x: [0.5, N - 0.5], y: [0, Math.max(1, ...G.prof) * 1.15], xl: L('键（切口的位置）', 'Bond (position of the cut)'), yl: 'S',
        series: [{ xs: bs, ys: G.prof, color: c.accent, dots: 3.5, line: true, label: L('精确', 'Exact') }, { xs: bs, ys: t.prof, color: c.gold, dots: 3.5, line: true, label: `MPS χ = ${chi}` }], hmarks: [{ y: Math.log(chi), color: c.danger }] });
      const xs = CHIS.map((x) => Math.log2(x)), floor = (v) => Math.max(Math.abs(v), 1e-16);
      plot(cv3, { x: [-0.2, 6.2], y: [-16, 0.3], logy: true, xt: [0, 1, 2, 3, 4, 5, 6], xf: (v) => String(2 ** v), xl: 'χ', yl: L('误差', 'error'),
        series: [{ xs, ys: T.map((x) => floor(1 - x.fidelity)), color: c.accent, dots: 3.5, line: true, label: L('1 − 保真度', '1 − fidelity') }, { xs, ys: T.map((x) => floor(x.dE / x.E0)), color: c.gold, dots: 3.5, line: true, label: L('|ΔE/E|', '|ΔE/E|') }], marks: [{ x: Math.log2(chi), color: c.danger }] });
      return [[L('MPS 参数 / 精确振幅', 'MPS parameters / exact amplitudes'), `${t.params} / ${t.full}`, true], [L('保真度', 'Fidelity'), t.fidelity > 1 - 1e-12 ? '1 − ' + fmt(Math.max(1 - t.fidelity, 1e-16), 2) : fix(t.fidelity, 6)], [L('能量：MPS / 精确', 'Energy: MPS / exact'), `${fix(t.E, 8)} / ${fix(t.E0, 8)}`], [L('扔掉的权重（各键之和）', 'Discarded weight (sum over bonds)'), fmt(t.discarded, 3)], [L('精确态中间键的纠缠熵', 'Middle-bond entropy of the exact state'), `${fix(G.prof[N / 2 - 1], 4)} nat`]];
    },
  };

  // ── 第三章：AKLT 和随机 MPS 的关联长度 ─────────────────────────────────
  DEMOS.aklt = {
    title: L('有限的 χ，有限的关联长度：AKLT 态和随机 MPS', 'Finite χ, finite correlation length: the AKLT state and random MPS'), kind: 'exact',
    intro: L('一个无穷长、平移不变的 MPS，任何两点关联都由“转移矩阵” E = Σₛ Aˢ ⊗ Aˢ 的幂决定：C(r) ∝ (λ₂/λ₁)ʳ。所以只要 χ 有限，关联就按指数衰减，关联长度 ξ = −1/ln|λ₂/λ₁|。AKLT 态是自旋 1 链的一个精确 MPS（χ = 2）：⟨SᶻSᶻ⟩ = (4/3)(−1/3)ʳ，ξ = 1/ln 3；可它有一个不衰减的“弦序” −4/9，这是 Haldane 相的拓扑特征。换成随机 MPS，看 ξ 怎样随 χ 变。', 'For an infinite, translation-invariant MPS, every two-point correlation is set by powers of the transfer matrix E = Σₛ Aˢ ⊗ Aˢ: C(r) ∝ (λ₂/λ₁)ʳ. So as long as χ is finite, correlations decay exponentially, with correlation length ξ = −1/ln|λ₂/λ₁|. The AKLT state is an exact MPS (χ = 2) for a spin-1 chain: ⟨SᶻSᶻ⟩ = (4/3)(−1/3)ʳ and ξ = 1/ln 3; yet it has a non-decaying “string order” −4/9, the topological signature of the Haldane phase. Switch to a random MPS and see how ξ changes with χ.'),
    sel: [['k', L('哪个态', 'Which state'), [['aklt', L('AKLT（自旋 1，χ = 2）', 'AKLT (spin 1, χ = 2)')], ['rand', L('随机 MPS（自旋 ½）', 'Random MPS (spin ½)')]], 'aklt']],
    ctl: [['chi', L('随机 MPS 的 χ', 'χ of the random MPS'), 1, 8, 1, 4, (v) => String(v)], ['seed', L('随机种子', 'Random seed'), 1, 30, 1, 5, (v) => String(v)]],
    figs: [[0.5, L('|C(r)|（对数轴）。点是用转移矩阵逐项乘出来的，虚线是 |C(1)|·|λ₂|^{r−1}。AKLT 的弦序画成金色。', '|C(r)| (log scale). Dots are multiplied out term by term with the transfer matrix; the dashed line is |C(1)|·|λ₂|^{r−1}. AKLT’s string order is drawn in gold.')]],
    note: L('不动点（左、右主本征矩阵）用幂迭代求；|λ₂| 用把不动点投影掉之后的幂迭代的增长率估计。AKLT 用的是自旋 1 的 Sᶻ，弦序算符是 exp(iπΣSᶻ)；随机 MPS 用 Pauli Z，矩阵元在 [−1, 1] 均匀取，是实数。χ = 1 是乘积态，没有关联。', 'The fixed points (left and right dominant eigenmatrices) come from power iteration; |λ₂| is estimated from the growth rate of power iteration after projecting the fixed point out. AKLT uses the spin-1 Sᶻ and the string operator exp(iπΣSᶻ); the random MPS uses Pauli Z with real matrix elements drawn uniformly from [−1, 1]. χ = 1 is a product state with no correlation.'),
    draw(s, [cv], c) {
      const aklt = s.k === 'aklt', tr = cache(`tr_${s.k}_${s.chi}_${s.seed}`, () => M.transfer(aklt ? M.akltTensors() : M.randomTensors(s.chi, 2, s.seed)));
      const co = M.correlations(tr, aklt ? M.SZ1 : M.ZPAULI, 24), so = aklt ? M.correlations(tr, M.SZ1, 24, M.STRING1) : null;
      const rs = range(1, 24), floor = (v) => Math.max(Math.abs(v), 1e-17);
      const C1 = Math.abs(co.C[0]);
      plot(cv, { x: [0.5, 24.5], y: [-14, 0.5], logy: true, xl: 'r', yl: '|C(r)|',
        series: [...(tr.lam2 > 1e-12 && C1 > 1e-15 ? [{ xs: rs, ys: rs.map((r) => floor(C1 * tr.lam2 ** (r - 1))), color: c.ink2, dash: [5, 4], width: 1.4 }] : []), { xs: rs, ys: co.C.map(floor), color: c.accent, dots: 3.5, label: aklt ? '⟨SᶻSᶻ⟩' : '⟨ZZ⟩ − ⟨Z⟩²' }, ...(so ? [{ xs: rs, ys: so.C.map(floor), color: c.gold, dots: 3.5, line: true, label: L('弦序', 'string order') }] : [])] });
      return [[L('|λ₂/λ₁|', '|λ₂/λ₁|'), fix(tr.lam2, 5), true], [L('关联长度 ξ', 'Correlation length ξ'), tr.lam2 > 1e-12 ? fix(tr.xi, 4) : '0'], ...(aklt ? [[L('精确值 1/ln 3', 'Exact 1/ln 3'), fix(1 / Math.log(3), 4)], ['⟨Sᶻ₀Sᶻ₁⟩', `${fix(co.C[0], 5)}（${L('精确', 'exact')} −4/9 = −0.44444）`], [L('弦序（r = 10）', 'String order (r = 10)'), fix(so.C[9], 5)]] : [[L('键维', 'Bond dimension'), String(s.chi)]])];
    },
  };

  // ── 第四章：浏览器里真跑的 DMRG ─────────────────────────────────────
  const heisExact = (N) => cache(`hx${N}`, () => M.groundState(M.spinModel({ kind: 'xxz', N, Delta: 1 })).E);
  const exactRef = (s) => (s.m === 'tfim' ? M.tfimExact(s.n, 1, s.g).E : s.n <= 14 ? heisExact(s.n) : NaN);
  DEMOS.dmrg = {
    title: L('一个真的 DMRG：两格点扫描，看能量收敛到精确解', 'A real DMRG: two-site sweeps, converging onto the exact energy'), kind: 'exact',
    intro: L('这里在浏览器里跑的是完整的两格点 DMRG：哈密顿量写成矩阵乘积算符（MPO），每一步把相邻两个格点的张量合起来，用 Lanczos 求有效哈密顿量的最低本征态，再用 SVD 拆开、只留 χ 个施密特值，然后挪到下一对格点，从左扫到右、再扫回来。横场 Ising 链能变成自由费米子精确求解，所以能直接看到 DMRG 的误差掉到 10⁻¹⁰ 以下。金色方框是正在优化的两个格点，柱子是每条键上的纠缠熵。', 'What runs here in your browser is a complete two-site DMRG: the Hamiltonian is written as a matrix product operator (MPO); at each step the tensors of two neighbouring sites are merged, the lowest eigenstate of the effective Hamiltonian is found with Lanczos, an SVD splits it again keeping χ Schmidt values, and the window moves on to the next pair, sweeping left to right and back. The transverse-field Ising chain can be solved exactly as free fermions, so you can watch the DMRG error drop below 10⁻¹⁰. The gold box is the pair of sites being optimised; the bars are the entanglement entropy on each bond.'),
    sel: [['m', L('模型', 'Model'), [['tfim', L('横场 Ising（有精确解）', 'Transverse-field Ising (exactly solvable)')], ['heis', L('Heisenberg 反铁磁', 'Heisenberg antiferromagnet')]], 'tfim']],
    ctl: [['n', L('格点数 N', 'Sites N'), 8, 40, 2, 24, (v) => String(v)], ['g', L('横场 g（Ising）', 'Field g (Ising)'), 0.2, 2, 0.05, 1, (v) => v.toFixed(2)], ['chi', L('最大键维 χ', 'Maximum bond dimension χ'), 2, 32, 1, 12, (v) => String(v)]],
    chk: [['fast', L('快进（每帧 4 步）', 'Fast (4 steps per frame)'), false]],
    act: [[L('从随机态重新开始', 'Restart from a random state'), (s) => { s.st = null; }]],
    state: () => ({ st: null }), autoplay: true, fps: 12,
    changed(s) { s.st = null; },
    tick(s) {
      if (!s.st) return true;
      for (let k = 0; k < (s.fast ? 4 : 1); k++) M.dmrgStep(s.st);
      return s.st.sweep < 8;
    },
    figs: [[0.3, L('链：每个圆是一个格点，金框是这一步优化的两个格点，箭头是扫描方向；柱高是键上的纠缠熵，下面的数字是键维。', 'The chain: each circle is a site, the gold box the two sites optimised in this step, the arrow the sweep direction; bar heights are bond entropies and the numbers below are bond dimensions.')], [0.46, L('能量误差 E − E_精确（对数轴）随步数；竖线是每次扫回左端。', 'Energy error E − E_exact (log scale) against step; vertical lines mark each return to the left end.')]],
    note: L('MPO 的键维：Ising 是 3，Heisenberg 是 5。初始态是 χ = 2 的随机 MPS，扫描时键维长到设定的最大值。每一步 Lanczos 最多 12 次迭代、从上一步的 θ 出发。有精确参考时画误差：Ising 用 Jordan–Wigner 后的自由费米子（E₀ = −Σ 奇异值），Heisenberg 在 N ≤ 14 时用精确对角化；更长的 Heisenberg 链只画能量本身。DMRG 是变分的，能量只会从上面逼近（误差为负只会是 10⁻¹² 量级的舍入）。代码自己写，没有用任何 DMRG 程序库。', 'MPO bond dimension: 3 for Ising, 5 for Heisenberg. The initial state is a random MPS with χ = 2; the bond dimension grows to the chosen maximum during the sweeps. Each Lanczos call uses at most 12 iterations, starting from the previous θ. With an exact reference the error is plotted: Ising via Jordan–Wigner free fermions (E₀ = −Σ singular values), Heisenberg by exact diagonalisation for N ≤ 14; for longer Heisenberg chains only the energy is plotted. DMRG is variational, so the energy approaches from above (a negative error can only be round-off at the 10⁻¹² level). The code is written from scratch, without any DMRG library.'),
    draw(s, [cv, cv2], c) {
      if (!s.st) { s.st = M.dmrgInit({ kind: s.m, N: s.n, g: s.g, chi: s.chi, seed: 3 }); s.ref = exactRef(s); }
      const st = s.st, N = st.N, ref = s.ref;
      // 链
      const { ctx, w, h } = fit(cv), x0 = 18, dx = (w - 36) / (N - 1), yc = h * 0.62, r = Math.max(2.5, Math.min(7, dx * 0.32)), Smax = Math.max(Math.log(st.chi), 0.5);
      for (let i = 0; i < N - 1; i++) { const bh = (h * 0.42 * st.S[i]) / Smax; ctx.fillStyle = c.accent; ctx.globalAlpha = 0.55; ctx.fillRect(x0 + (i + 0.5) * dx - Math.max(1.5, dx * 0.18), yc - r - 4 - bh, Math.max(3, dx * 0.36), bh); ctx.globalAlpha = 1; }
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.moveTo(x0, yc); ctx.lineTo(x0 + (N - 1) * dx, yc); ctx.stroke();
      const p = st.pos;
      ctx.strokeStyle = c.gold; ctx.lineWidth = 2.5; ctx.strokeRect(x0 + p * dx - r - 4, yc - r - 4, dx + 2 * r + 8, 2 * r + 8);
      for (let i = 0; i < N; i++) { ctx.fillStyle = i === p || i === p + 1 ? c.gold : c.surface; ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.arc(x0 + i * dx, yc, r, 0, TAU); ctx.fill(); ctx.stroke(); }
      ctx.fillStyle = c.muted; ctx.font = font(10); ctx.textAlign = 'center';
      const every = Math.ceil(16 / dx);
      for (let i = 0; i < N - 1; i += every) ctx.fillText(String(st.chiB[i]), x0 + (i + 0.5) * dx, yc + r + 14);
      ctx.fillStyle = c.ink; ctx.font = font(12, 600); ctx.textAlign = 'left';
      ctx.fillText(st.dir > 0 ? L('扫描方向：向右 →', 'Sweeping right →') : L('扫描方向：← 向左', '← Sweeping left'), 8, 16);
      // 收敛
      const H = st.hist, xs = H.map((_, i) => i + 1), err = H.map((E) => Math.max(E - ref, 1e-15)), turns = []; for (let k = 1; k <= st.sweep; k++) turns.push({ x: k * 2 * (N - 1), color: c.line });
      if (Number.isFinite(ref)) plot(cv2, { x: [0, Math.max(4 * (N - 1), H.length + 1)], y: [-15, Math.max(1, Math.ceil(Math.log10(Math.max(...err, 1e-14))))], logy: true, xl: L('DMRG 步数', 'DMRG step'), yl: 'E − E₀', series: [{ xs, ys: err, color: c.accent, width: 2 }], marks: turns });
      else plot(cv2, { x: [0, Math.max(4 * (N - 1), H.length + 1)], y: H.length ? [Math.min(...H) - 0.02 * Math.abs(Math.min(...H)), Math.min(...H) + 0.3 * Math.abs(Math.min(...H)) + 0.5] : [-1, 0], xl: L('DMRG 步数', 'DMRG step'), yl: 'E', series: [{ xs, ys: H, color: c.accent, width: 2 }], marks: turns });
      const maxTr = Math.max(...st.trunc), E = st.E;
      return [[L('完成的来回扫描', 'Full sweeps done'), String(st.sweep), true], ['E', Number.isFinite(E) ? fix(E, 10) : '—'], [L('精确 E₀', 'Exact E₀'), Number.isFinite(ref) ? fix(ref, 10) : L('没有（N > 14）', 'none (N > 14)')], [L('误差', 'Error'), Number.isFinite(ref) && Number.isFinite(E) ? fmt(Math.max(E - ref, 0), 2) : '—'], [L('最大截断误差', 'Largest truncation error'), fmt(maxTr, 2)], [L('中间键的纠缠熵', 'Middle-bond entropy'), `${fix(st.S[Math.floor(N / 2) - 1], 4)} nat`], [L('实际用到的最大 χ', 'Largest χ actually used'), String(Math.max(...st.chiB))]];
    },
  };

  // ── 第五章：淬火后纠缠的线性增长 ───────────────────────────────────────
  const qSeries = (N) => cache(`q${N}`, () => M.quench(N, range(0, 40, 0.25)));
  DEMOS.quench = {
    title: L('淬火之后，纠缠按时间线性长：为什么长时间演化很难', 'After a quench entanglement grows linearly in time: why long-time evolution is hard'), kind: 'exact',
    intro: L('从 Néel 态（每隔一个格点放一个粒子，没有纠缠）出发，让粒子在 XX 链上自由跳。半条链的纠缠熵先按时间线性增长（准粒子对从各处出发、分别飞向切口两边），直到被有限的链长截住饱和。一个键维 χ 的 MPS 最多装 ln χ 的纠缠，所以要准确跟上，χ 必须随时间指数地长：图上的横线是 χ = 16、256、4 096、65 536 能装的上限。下图是每个格点上的粒子数随时间的演化（金色多、蓝色少）。', 'Start from the Néel state (a particle on every other site, no entanglement) and let the particles hop freely on the XX chain. The half-chain entanglement entropy first grows linearly in time (pairs of quasiparticles start everywhere and fly to the two sides of the cut) until the finite length of the chain stops it. An MPS of bond dimension χ can hold at most ln χ of entanglement, so to keep up accurately χ must grow exponentially in time: the horizontal lines show the ceilings for χ = 16, 256, 4 096 and 65 536. Below, the particle number on each site as time goes on (gold for more, blue for fewer).'),
    ctl: [['n', L('链长 N', 'Chain length N'), 32, 96, 16, 64, (v) => String(v)], ['t', L('时间 t（单位 ħ/跳跃积分）', 'Time t (units of ħ/hopping)'), 0, 40, 0.25, 0, (v) => v.toFixed(2)]],
    btn: [[L('从头放', 'From the start'), { t: 0 }], [L('t = 8', 't = 8'), { t: 8 }]],
    autoplay: true, fps: 10,
    tick(s) { s.t = Math.min(40, s.t + 0.25); return s.t < 40; },
    figs: [[0.48, L('半链纠缠熵 S(t)。点是当前时刻；虚线是 MPS 在几个 χ 下能装的上限 ln χ。', 'Half-chain entanglement entropy S(t). The dot is the current time; dashed lines are the ceilings ln χ an MPS can hold for several χ.')], [0.5, L('时空图：横轴是格点，纵轴是时间（往下走），颜色是粒子数偏离 ½ 的程度。', 'Space-time plot: sites across, time running downwards, colour showing how far the particle number is from ½.')]],
    note: L('自由费米子的高斯态在幺正演化下仍是高斯态，关联矩阵 C(t) = U C(0) U†，U = e^{−iht}；纠缠熵照第二章的公式从 C(t) 精确算出。时间单位是 ħ 除以跳跃积分；最大群速度是 2，所以信号以“光锥”传播（Lieb–Robinson 界）。有限的链上后来会有部分回复。对相互作用的系统也有同样的线性增长，只是不能这样精确算。', 'Gaussian states of free fermions stay Gaussian under unitary evolution: the correlation matrix is C(t) = U C(0) U†, U = e^{−iht}, and the entropy follows exactly from C(t) as in chapter 2. Time is in units of ħ over the hopping; the maximum group velocity is 2, so signals spread in a “light cone” (the Lieb–Robinson bound). On a finite chain there are partial revivals later on. Interacting systems show the same linear growth, but cannot be computed exactly this way.'),
    draw(s, [cv, cv2], c) {
      const N = s.n, Q = qSeries(N), idx = Math.min(Q.length - 1, Math.round(s.t / 0.25)), cur = Q[idx], ts = Q.map((q) => q.t);
      const chis = [16, 256, 4096, 65536];
      plot(cv, { x: [0, 40], y: [0, (N / 2) * LN2 * 1.05], xl: 't', yl: 'S(t)', series: [{ xs: ts.slice(0, idx + 1), ys: Q.slice(0, idx + 1).map((q) => q.S), color: c.accent, width: 2.4 }, { xs: ts, ys: Q.map((q) => q.S), color: c.accent, width: 1, alpha: 0.25 }],
        hmarks: chis.map((x) => ({ y: Math.log(x), color: c.gold })), marks: [{ x: cur.t, y: cur.S, color: c.danger }], texts: chis.map((x) => ({ x: 39.5, y: Math.log(x) + 0.25, s: `χ = ${x}`, color: c.gold, align: 'right' })) });
      const rows = Q.slice(0, idx + 1).map((q) => Array.from(q.dens));
      cells(cv2, rows, (v) => { const d = v - 0.5, a = Math.min(1, Math.abs(d) * 2); return d > 0 ? `rgba(230,160,40,${a.toFixed(3)})` : `rgba(70,110,230,${a.toFixed(3)})`; }, { rows: Q.length });
      const early = Q.filter((q) => q.t > 0.5 && q.t <= Math.max(1, N / 8)), rate = early.length > 1 ? (early[early.length - 1].S - early[0].S) / (early[early.length - 1].t - early[0].t) : NaN;
      return [[L('S(t)', 'S(t)'), `${fix(cur.S, 3)} nat`, true], [L('至少要的键维 e^S', 'Bond dimension needed e^S'), cur.S > 30 ? fmt(Math.exp(cur.S), 2) : String(Math.ceil(Math.exp(cur.S) - 1e-9))], [L('早期增长率 dS/dt', 'Early growth rate dS/dt'), fix(rate, 3)], [L('半条链能有的最大值 (N/2) ln 2', 'Maximum possible for half the chain (N/2) ln 2'), fix((N / 2) * LN2, 2)]];
    },
  };

  // ── 第六章：二维的面积律 ───────────────────────────────────────────
  const WS = [2, 3, 4, 5, 6, 7, 8];
  const s2d = (m) => cache(`s2d${m}`, () => WS.map((W) => M.halfEntropy2d(12, W, m)));
  DEMOS.area2d = {
    title: L('二维的面积律：切口越长，纠缠越多，MPS 的 χ 按指数涨', 'The area law in two dimensions: longer cuts carry more entanglement, and an MPS’s χ grows exponentially'), kind: 'exact',
    intro: L('一块 12 × W 的方格子上的自由费米子，从中间竖着切开，切口长 W。加一个交错势 ±m 就打开能隙（像离子晶体），S 和 W 成正比，这就是二维的面积律；m = 0 时是有 Fermi 面的金属，S 比面积律还多一个对数因子。把二维格子按“蛇形”排成一条链来用 MPS（二维 DMRG 就是这样做的），中间的切口要装下 S ∝ W 的纠缠，χ 至少 e^S：宽度每加一点，χ 就乘一个固定的倍数。这就是为什么二维要用 PEPS 这类张量网络。', 'Free fermions on a 12 × W square lattice, cut down the middle along a line of length W. A staggered potential ±m opens a gap (like an ionic crystal) and S is proportional to W: the area law in two dimensions. At m = 0 the system is a metal with a Fermi surface and S picks up an extra logarithmic factor. If the 2D lattice is laid out as a “snake” to use an MPS (which is how 2D DMRG is done), the middle cut must carry entanglement S ∝ W and χ is at least e^S: each extra unit of width multiplies χ by a fixed factor. This is why two dimensions call for tensor networks such as PEPS.'),
    ctl: [['w', L('宽度 W（切口长度）', 'Width W (length of the cut)'), 2, 8, 1, 6, (v) => String(v)], ['m', L('交错势 m（能隙）', 'Staggered potential m (gap)'), 0.2, 2, 0.05, 0.6, (v) => v.toFixed(2)]],
    figs: [[0.5, L('半边的纠缠熵 S 对切口长度 W：金色是当前的 m（有能隙），蓝色是金属（m → 0）。', 'Half-system entanglement entropy S against cut length W: gold is the current m (gapped), blue the metal (m → 0).')]],
    note: L('开边界，最近邻跳跃 1，半满；纠缠熵用关联矩阵精确算（第二章的方法）。“金属”一条用 m = 0.001，只是为了在半满时挑出唯一的基态。金属的 S ∝ W ln W 是 Gioev–Klich 和 Wolf 2006 年证明的；有限的格子上对数修正不太明显。e^S 只是 χ 的下限，实际做到同样精度通常要大好几倍。', 'Open boundaries, nearest-neighbour hopping 1, half filling; the entropy is computed exactly from the correlation matrix (the method of chapter 2). The “metal” curve uses m = 0.001, just to single out a unique ground state at half filling. The metal’s S ∝ W ln W was proved by Gioev and Klich and by Wolf in 2006; on finite lattices the logarithmic correction is not very visible. e^S is only a lower bound on χ; reaching a given accuracy usually takes several times more.'),
    draw(s, [cv], c) {
      const G = s2d(s.m), Mt = s2d(0.001), cur = G[WS.indexOf(s.w)], ys = G.map((x) => x.S), slope = (ys[ys.length - 1] - ys[0]) / (WS[WS.length - 1] - WS[0]);
      plot(cv, { x: [1.5, 8.5], y: [0, Math.max(...Mt.map((x) => x.S)) * 1.1], xl: 'W', yl: 'S', series: [{ xs: WS, ys: Mt.map((x) => x.S), color: c.accent, dots: 3.5, line: true, label: L('金属', 'metal') }, { xs: WS, ys, color: c.gold, dots: 3.5, line: true, label: `m = ${fix(s.m, 2)}` }], marks: [{ x: s.w, y: cur.S, color: c.danger }] });
      return [[L('纠缠熵 S', 'Entanglement entropy S'), `${fix(cur.S, 3)} nat`, true], [L('χ 的下限 e^S', 'Lower bound on χ, e^S'), fix(Math.exp(cur.S), 1)], [L('每加一列的 ΔS（有能隙）', 'ΔS per extra column (gapped)'), fix(slope, 3)], [L('也就是 χ 每列乘以', 'So χ multiplies per column by'), fix(Math.exp(slope), 2)], [L('单粒子能隙', 'Single-particle gap'), fix(cur.gap, 3)]];
    },
  };

  // ── 第七章：轨道（格点）排序和互信息 ──────────────────────────────────
  const ORD = { nat: L('原始编号', 'Original numbering'), fied: L('按互信息的 Fiedler 排序', 'Fiedler ordering from mutual information'), rev: L('打乱的顺序', 'A scrambled order') };
  const SCRAMBLE = [0, 6, 3, 9, 1, 7, 4, 10, 2, 8, 5, 11];
  const ordData = (gid) => cache(`ord${gid}`, () => {
    const gr = M.graph(gid), m = M.spinModel({ kind: 'graph', N: 12, bonds: gr.bonds }), gs = M.groundState(m), mi = M.mutualInfo(gs.v, 12), fied = M.fiedler(mi.I.map((r) => Array.from(r)));
    const perms = { nat: Array.from({ length: 12 }, (_, i) => i), fied, rev: SCRAMBLE };
    const cost = Object.fromEntries(Object.entries(perms).map(([k, p]) => [k, M.orderingCost(gs.v, 12, p)]));
    return { mi, perms, cost, E: gs.E };
  });
  DEMOS.order = {
    title: L('轨道怎么排成一条链：互信息和 Fiedler 排序', 'How to lay orbitals out as a chain: mutual information and Fiedler ordering'), kind: 'exact',
    intro: L('量子化学 DMRG 要先把分子轨道排成一维的顺序，同样的态，排得不好，切口要穿过很多纠缠，χ 就得很大。这里用 12 个自旋（代替轨道）在不同的图上耦合，精确求出基态，算出每两个格点之间的互信息 Iᵢⱼ（左图），再按 Iᵢⱼ 的图拉普拉斯矩阵的 Fiedler 向量排序：强关联的格点被排到一起。右图比较三种顺序下每个切口的纠缠熵；读数里是每个切口扔掉的权重 ≤ 10⁻⁶ 时需要的 χ。最后一种图“三个片段”最像一个由几块弱耦合的单元组成的分子。', 'Quantum-chemistry DMRG first has to put the molecular orbitals in a one-dimensional order. For the same state, a bad order makes cuts pass through a lot of entanglement and χ must be large. Here 12 spins (standing in for orbitals) are coupled on different graphs; the ground state is found exactly and the mutual information Iᵢⱼ between every pair is computed (left), then the sites are ordered by the Fiedler vector of the graph Laplacian of Iᵢⱼ, which brings strongly correlated sites together. The right panel compares the entropy across every cut for three orders; the readout gives the χ needed for a discarded weight ≤ 10⁻⁶ at each cut. The last graph, “three fragments”, is most like a molecule made of a few weakly coupled units.'),
    sel: [['g', L('耦合的图', 'Coupling graph'), [['clusters', L('三个片段（编号交错）', 'Three fragments (interleaved numbering)')], ['ladder', L('2 × 6 梯子', '2 × 6 ladder')], ['ring', L('12 个格点的环', 'Ring of 12 sites')], ['chain', L('链', 'Chain')]], 'clusters'], ['o', L('排序', 'Ordering'), [['nat', ORD.nat], ['fied', ORD.fied], ['rev', ORD.rev]], 'nat']],
    figs: [[0.5, L('互信息 Iᵢⱼ（按当前的顺序排；颜色越深越大）。好的顺序把深色集中在对角线附近。', 'Mutual information Iᵢⱼ (in the current order; darker means larger). A good order gathers the dark squares near the diagonal.')], [0.42, L('每个切口的纠缠熵：金色是当前顺序，蓝色是 Fiedler 排序。', 'Entanglement entropy at each cut: gold for the current order, blue for the Fiedler order.')]],
    note: L('各向同性 Heisenberg 耦合；几种图都是两边一样大的二分图，基态是唯一的单态。单格点的熵都是 ln 2（单态里每个自旋都完全混合），所以排序的信息全在 Iᵢⱼ 里。Fiedler 排序是 Barcza、Legeza 等 2011 年为量子化学 DMRG 提出的做法之一；真实计算里 Iᵢⱼ 来自一次便宜的预备 DMRG。环怎么排都至少要切两条键，所以 χ 总是比链大。', 'Isotropic Heisenberg couplings; every graph is bipartite with equal halves, so the ground state is a unique singlet. Every single-site entropy is ln 2 (each spin is fully mixed in a singlet), so all the ordering information is in Iᵢⱼ. Fiedler ordering is one of the methods proposed by Barcza, Legeza and co-workers in 2011 for quantum-chemistry DMRG; in real calculations Iᵢⱼ comes from a cheap preliminary DMRG. However a ring is ordered, every cut crosses at least two bonds, so χ is always larger than for a chain.'),
    draw(s, [cv, cv2], c) {
      const D = ordData(s.g), p = D.perms[s.o], I = D.mi.I, Imax = Math.max(1e-9, ...I.map((r) => Math.max(...r)));
      const { ctx, w, h } = fit(cv), side = Math.min(h - 26, w * 0.62), cs = side / 12, ox = (w - side) / 2 + 10, oy = 18;
      ctx.font = font(10); ctx.textAlign = 'center'; ctx.fillStyle = c.muted;
      for (let a = 0; a < 12; a++) {
        ctx.fillText(String(p[a]), ox + (a + 0.5) * cs, oy - 5); ctx.textAlign = 'right'; ctx.fillText(String(p[a]), ox - 4, oy + (a + 0.62) * cs); ctx.textAlign = 'center';
        for (let b = 0; b < 12; b++) { const v = a === b ? 0 : I[p[a]][p[b]] / Imax; ctx.fillStyle = c.accent; ctx.globalAlpha = a === b ? 0.06 : 0.05 + 0.95 * v; ctx.fillRect(ox + b * cs + 0.5, oy + a * cs + 0.5, cs - 1, cs - 1); ctx.globalAlpha = 1; }
      }
      const cuts = range(1, 11), C = D.cost[s.o], F = D.cost.fied;
      plot(cv2, { x: [0.5, 11.5], y: [0, Math.max(...D.cost.rev.prof, ...C.prof) * 1.15], xl: L('切口', 'Cut'), yl: 'S', series: [{ xs: cuts, ys: F.prof, color: c.accent, dots: 3.5, line: true, label: 'Fiedler' }, { xs: cuts, ys: C.prof, color: c.gold, dots: 3.5, line: true, label: ORD[s.o] }] });
      return [[L('当前顺序', 'Current order'), p.join(' ')], [L('最大切口熵', 'Largest cut entropy'), `${fix(C.maxS, 3)} nat`, true], [L('需要的 χ：当前顺序', 'χ needed: current order'), String(C.maxChi), true], [L('需要的 χ：原始 / Fiedler / 打乱', 'χ needed: original / Fiedler / scrambled'), `${D.cost.nat.maxChi} / ${F.maxChi} / ${D.cost.rev.maxChi}`], [L('基态能量', 'Ground-state energy'), fix(D.E, 6)]];
    },
  };

  // ── 第八章：H₂ 的最小模型和 CAS(2,2) ──────────────────────────────────
  DEMOS.dimer = {
    title: L('拉长一根化学键：RHF 失败、UHF 打破对称、CAS(2,2) 精确', 'Stretching a chemical bond: RHF fails, UHF breaks symmetry, CAS(2,2) is exact'), kind: 'exact',
    intro: L('两个电子、两个轨道：这是最小基组下的 H₂，也是两格点的 Hubbard 模型。拉长键时跳跃积分 t 变小，而两个电子挤在同一个原子上的代价 U 不变，所以横轴 t/U 从右往左就是“把键拉断”。RHF 把两个电子放进同一个成键轨道，必然带着 50 % 的离子成分（H⁺H⁻），解离时能量错得离谱；UHF 让两个自旋各占一个原子，能量对了，但不再是自旋本征态；把成键、反键两个轨道都放进活性空间的 CAS(2,2) 在这个模型里就是精确解。这就是“静态关联”。', 'Two electrons in two orbitals: H₂ in a minimal basis, and the two-site Hubbard model. Stretching the bond makes the hopping t smaller while the cost U of two electrons on one atom stays the same, so going from right to left along t/U is “breaking the bond”. RHF puts both electrons in the same bonding orbital and so always carries 50 % ionic character (H⁺H⁻): at dissociation its energy is badly wrong. UHF lets the two spins sit on different atoms; the energy comes out right but the state is no longer a spin eigenstate. CAS(2,2), with both the bonding and antibonding orbitals active, is exact for this model. This is “static correlation”.'),
    ctl: [['x', 't / U', 0.02, 1.5, 0.01, 0.3, (v) => v.toFixed(2)]],
    btn: [[L('平衡键长附近', 'Near equilibrium'), { x: 1.2 }], [L('UHF 开始分开（t/U = 1/2）', 'UHF starts to split (t/U = 1/2)'), { x: 0.5 }], [L('快要断了', 'Almost broken'), { x: 0.06 }]],
    figs: [[0.5, L('能量 E/U：精确（= CAS(2,2) = 全 CI）、RHF、UHF。', 'Energy E/U: exact (= CAS(2,2) = full CI), RHF and UHF.')], [0.42, L('精确态的自然轨道占据数，以及 UHF 的 ⟨S²⟩（单态应当是 0）。', 'Natural-orbital occupations of the exact state, and UHF’s ⟨S²⟩ (a singlet should have 0).')]],
    note: L('解析解：E_精确 = U/2 − √(4t² + U²/4)，E_RHF = −2t + U/2；t/U < 1/2 时 UHF 的两个空间轨道分开，E_UHF = −2t²/U，⟨S²⟩ = 1 − (2t/U)²。精确态 = a|σg²⟩ − b|σu²⟩，自然轨道占据数是 2a² 和 2b²：键拉断时都趋于 1，两个轨道一样重要，这时一个行列式（RHF）不可能好。真实的 H₂ 还要动态关联（更多的轨道），这里不含。', 'Analytic: E_exact = U/2 − √(4t² + U²/4), E_RHF = −2t + U/2; for t/U < 1/2 the two UHF spatial orbitals separate, E_UHF = −2t²/U and ⟨S²⟩ = 1 − (2t/U)². The exact state is a|σg²⟩ − b|σu²⟩ with natural-orbital occupations 2a² and 2b²: as the bond breaks both tend to 1, the two orbitals are equally important, and a single determinant (RHF) cannot be good. Real H₂ also needs dynamic correlation (more orbitals), which is not included here.'),
    draw(s, [cv, cv2], c) {
      const xs = lin(0.02, 1.5, 300), D = xs.map((x) => M.dimer(x, 1)), cur = M.dimer(s.x, 1);
      plot(cv, { x: [0, 1.5], y: [-3.2, 0.6], xl: 't / U', yl: 'E / U', series: [{ xs, ys: D.map((d) => d.rhf), color: c.gold, width: 2.2, label: 'RHF' }, { xs, ys: D.map((d) => d.uhf), color: c.danger, dash: [6, 4], width: 2, label: 'UHF' }, { xs, ys: D.map((d) => d.exact), color: c.accent, width: 2.4, label: L('精确 = CAS(2,2)', 'exact = CAS(2,2)') }], marks: [{ x: s.x, y: cur.exact, color: c.ink2 }, { x: 0.5, color: c.line }] });
      plot(cv2, { x: [0, 1.5], y: [0, 2.05], xl: 't / U', yl: L('占据数 / ⟨S²⟩', 'occupation / ⟨S²⟩'), series: [{ xs, ys: D.map((d) => d.nG), color: c.accent, width: 2.2, label: 'n(σg)' }, { xs, ys: D.map((d) => d.nU), color: c.gold, width: 2.2, label: 'n(σu)' }, { xs, ys: D.map((d) => d.s2uhf), color: c.danger, dash: [6, 4], width: 2, label: '⟨S²⟩ UHF' }], marks: [{ x: s.x, color: c.ink2 }] });
      return [[L('E/U：精确 / RHF / UHF', 'E/U: exact / RHF / UHF'), `${fix(cur.exact, 4)} / ${fix(cur.rhf, 4)} / ${fix(cur.uhf, 4)}`, true], [L('关联能 E − E_RHF', 'Correlation energy E − E_RHF'), fix(cur.exact - cur.rhf, 4)], [L('自然轨道占据 σg / σu', 'Natural occupations σg / σu'), `${fix(cur.nG, 3)} / ${fix(cur.nU, 3)}`], [L('离子成分：精确 / RHF', 'Ionic weight: exact / RHF'), `${fix(100 * cur.ionic, 1)} % / 50.0 %`], [L('UHF 的 ⟨S²⟩', 'UHF ⟨S²⟩'), fix(cur.s2uhf, 3)]];
    },
  };

  // ── 第八章：CASSCF 和 DMRG 能做多大的活性空间 ──────────────────────────
  const LIT = [ // 文献里的活性空间（轨道数，标签）；出处见第八、九章正文
    { n: 22, t: L('CASSCF (22e, 22o)', 'CASSCF (22e, 22o)'), ref: 'vogiatzis2017' },
    { n: 54, t: L('FeMoco (54e, 54o)', 'FeMoco (54e, 54o)'), ref: 'reiher2017' },
    { n: 76, t: L('FeMoco (113e, 76o)', 'FeMoco (113e, 76o)'), ref: 'li2019femoco' },
  ];
  DEMOS.cas = {
    title: L('活性空间能做多大：全 CI 的指数墙和 DMRG 的多项式', 'How large an active space can be: the full-CI wall and the DMRG polynomial'), kind: 'exact',
    intro: L('CASSCF 在活性空间里做全组态相互作用（CI），组态个数随轨道数指数增长，普通计算止步于十几到二十个轨道。DMRG 用 MPS 代替 CI 向量，存储是 k·4·χ²（k 个轨道、每个轨道 4 个状态），一次扫描的计算量大约 k³χ³ + k⁴χ²，只是多项式；代价是要选 χ，结果是近似的、要外推。拖动轨道数和 χ，对照文献里做过的几个活性空间。', 'CASSCF does full configuration interaction (CI) in the active space; the number of configurations grows exponentially with the number of orbitals, and ordinary calculations stop at a dozen to twenty or so orbitals. DMRG replaces the CI vector with an MPS: storage is k·4·χ² (k orbitals, 4 states each) and one sweep costs roughly k³χ³ + k⁴χ², only a polynomial; the price is choosing χ, and the result is approximate and needs extrapolation. Drag the number of orbitals and χ, and compare with active spaces done in the literature.'),
    ctl: [['n', L('活性轨道数 k（电子数取一样多）', 'Active orbitals k (as many electrons)'), 2, 100, 1, 22, (v) => String(v)], ['chi', L('DMRG 的键维 χ', 'DMRG bond dimension χ'), 250, 8000, 250, 2000, (v) => String(v)]],
    btn: [[L('(18e, 18o)', '(18e, 18o)'), { n: 18 }], [L('(22e, 22o)', '(22e, 22o)'), { n: 22 }], [L('FeMoco 的 (54e, 54o)', 'FeMoco (54e, 54o)'), { n: 54 }]],
    figs: [[0.56, L('数目的常用对数：行列式（总 Sᶻ = 0）、单态 CSF、MPS 的参数个数（当前 χ）。竖线是文献里的活性空间。', 'Base-10 logarithm of counts: determinants (total Sᶻ = 0), singlet CSFs and MPS parameters (current χ). Vertical lines are active spaces from the literature.')]],
    note: L('行列式个数 C(k, k/2)² 和 CSF 个数（Weyl–Paldus 公式）是精确计数。MPS 的参数 4kχ² 和每次扫描 k³χ³ + k⁴χ² 的量级是 Chan 和 Sharma（2011）综述里给的标度，前面的常数和实现有关，这里不算。竖线的出处：(22e, 22o) 是 Vogiatzis 等（2017）的并行 CASSCF；FeMoco 的 (54e, 54o) 是 Reiher 等（2017），(113e, 76o) 是 Li 等（2019）。电子数和轨道数不一样时这里按轨道数画。', 'Determinant counts C(k, k/2)² and CSF counts (the Weyl–Paldus formula) are exact. MPS parameters 4kχ² and the per-sweep cost k³χ³ + k⁴χ² are the scalings given in the Chan and Sharma (2011) review; their prefactors depend on the implementation and are not counted. Sources for the vertical lines: (22e, 22o) is the parallel CASSCF of Vogiatzis et al. (2017); FeMoco (54e, 54o) is Reiher et al. (2017) and (113e, 76o) is Li et al. (2019). Where electrons and orbitals differ, the line is drawn at the number of orbitals.'),
    draw(s, [cv], c) {
      const ks = range(2, 100, 2), dets = ks.map((k) => M.log10dets(k, k)), csf = ks.map((k) => M.log10csf(k, k, 0)), mps = ks.map((k) => Math.log10(4 * k * s.chi * s.chi));
      plot(cv, { x: [2, 100], y: [0, 60], xl: L('活性轨道数 k', 'Active orbitals k'), yl: L('数目', 'count'), yf: pow10, yt: [0, 10, 20, 30, 40, 50, 60],
        series: [{ xs: ks, ys: dets, color: c.danger, width: 2.4, label: L('行列式', 'determinants') }, { xs: ks, ys: csf, color: c.gold, width: 2, dash: [6, 4], label: 'CSF (S = 0)' }, { xs: ks, ys: mps, color: c.ok, width: 2.4, label: `MPS, χ = ${s.chi}` }],
        hmarks: [{ y: MEM_LAPTOP, color: c.muted }, { y: MEM_PB, color: c.ink2 }], marks: [...LIT.map((x) => ({ x: x.n, color: c.info })), { x: s.n, color: c.ink2 }],
        texts: [{ x: 3, y: MEM_LAPTOP + 1.2, s: '16 GB', color: c.muted }, { x: 3, y: MEM_PB + 1.2, s: '1 PB', color: c.ink2 }, ...LIT.map((x, i) => ({ x: x.n, y: 56 - 4 * i, s: x.t, color: c.info, dx: 4 }))] });
      const ld = M.log10dets(s.n, s.n), lc = M.log10csf(s.n, s.n, 0), lm = Math.log10(4 * s.n * s.chi * s.chi), cost = Math.log10(s.n ** 3 * s.chi ** 3 + s.n ** 4 * s.chi ** 2);
      return [[L('行列式', 'Determinants'), big(ld), true], [L('单态 CSF', 'Singlet CSFs'), big(lc)], [L('CI 向量要的内存', 'Memory for the CI vector'), bytes(ld + Math.log10(8))], [L('MPS 参数 / 内存', 'MPS parameters / memory'), `${big(lm)} / ${bytes(lm + Math.log10(8))}`], [L('每次扫描约多少次运算', 'Operations per sweep, roughly'), big(cost)]];
    },
  };

  // ── 第九章：交换耦合的铁簇有多少低能自旋态 ──────────────────────────────
  const CLUSTERS = { fe2: [5, 5], fe4: [5, 5, 4, 4], fe7: [5, 5, 5, 4, 4, 4, 4], fe8: [5, 5, 5, 5, 4, 4, 4, 4] };
  DEMOS.spins = {
    title: L('铁硫簇的“稠密”低能谱：自旋态多得数不过来', 'The “dense” low-energy spectrum of iron–sulfur clusters: more spin states than you can count'), kind: 'toy',
    intro: L('每个高自旋的铁离子带一个大自旋（Fe³⁺ 是 5/2，Fe²⁺ 是 2），它们通过硫桥反铁磁地耦合。即使只看自旋，态的数目也是 Π(2sᵢ + 1)：两个铁 36 个，四个铁 900 个，七个铁 135 000 个。这些自旋态按总自旋 S 组成很多多重态，挤在一个很窄的能量范围里；再加上电荷可以在铁之间挪（价态离域）、轨道也有几种占法，真实的低能谱比这还稠密得多。这就是为什么 FeMoco 这类簇要用 DMRG 这样的方法，而且结论常常是“有很多个几乎简并的态”。', 'Each high-spin iron ion carries a large spin (5/2 for Fe³⁺, 2 for Fe²⁺), and they couple antiferromagnetically through the sulfur bridges. Even counting spin alone, the number of states is Π(2sᵢ + 1): 36 for two irons, 900 for four, 135 000 for seven. These spin states form many multiplets labelled by total spin S, crowded into a narrow energy range; add charges hopping between irons (valence delocalisation) and several ways of filling the orbitals, and the real low-energy spectrum is denser still. That is why clusters like FeMoco call for methods such as DMRG, and why the conclusion is often “there are many nearly degenerate states”.'),
    sel: [['k', L('簇', 'Cluster'), [['fe2', L('[2Fe–2S]：两个 Fe³⁺', '[2Fe–2S]: two Fe³⁺')], ['fe4', L('[4Fe–4S]²⁺：两个 Fe³⁺ + 两个 Fe²⁺', '[4Fe–4S]²⁺: two Fe³⁺ + two Fe²⁺')], ['fe7', L('七个铁（FeMoco 的铁数，价态只是示意）', 'Seven irons (FeMoco’s iron count; valences only illustrative)')], ['fe8', L('八个铁（P 簇的铁数，示意）', 'Eight irons (the P-cluster’s count; illustrative)')]], 'fe4']],
    ctl: [['win', L('能量窗口（单位 J）', 'Energy window (units of J)'), 1, 40, 1, 10, (v) => `${v} J`]],
    figs: [[0.5, L('每个总自旋 S 的能量（Landé 间隔）和它有多少个多重态（柱高，对数轴）。金色是落在窗口里的。', 'The energy of each total spin S (Landé intervals) and how many multiplets it has (bar height, log scale). Gold ones fall inside the window.')]],
    note: L('玩具模型：所有铁两两等强地反铁磁耦合，H = J Σᵢ<ⱼ Sᵢ·Sⱼ，于是能量只依赖总自旋：E(S) = (J/2)[S(S + 1) − Σsᵢ(sᵢ + 1)]，同一个 S 的多重态完全简并。真实的簇里各对之间的 J 不同、还有双交换和自旋–轨道耦合，这些简并会分开，态更稠密。多重态的个数按角动量耦合精确计数。真实簇里价态（哪个铁是 Fe²⁺、哪个是 Fe³⁺）本身就是问题的一部分，这里只是示意。', 'Toy model: all irons are coupled antiferromagnetically with equal strength, H = J Σᵢ<ⱼ Sᵢ·Sⱼ, so the energy depends only on the total spin: E(S) = (J/2)[S(S + 1) − Σsᵢ(sᵢ + 1)], and multiplets with the same S are exactly degenerate. In a real cluster different pairs have different J, plus double exchange and spin–orbit coupling, which split these degeneracies and make the spectrum denser. Multiplet counts are exact from angular-momentum coupling. In real clusters the valences (which iron is Fe²⁺ and which Fe³⁺) are part of the problem; here they are only illustrative.'),
    draw(s, [cv], c) {
      const sp = CLUSTERS[s.k], R = M.spinLadder(sp, 1), lv = R.levels, maxE = Math.max(...lv.map((x) => x.dE));
      const inW = lv.filter((x) => x.dE <= s.win + 1e-9), states = inW.reduce((a, x) => a + x.mult * (2 * x.S + 1), 0);
      plot(cv, { x: [-0.5, Math.max(...lv.map((x) => x.S)) + 0.5], y: [-0.2, Math.log10(Math.max(...lv.map((x) => x.mult))) + 0.4], logy: true, xl: L('总自旋 S', 'Total spin S'), yl: L('多重态个数', 'multiplets'),
        series: [{ xs: lv.map((x) => x.S), ys: lv.map((x) => x.mult), color: c.accent, bars: 0.35, alpha: 0.6 }, { xs: inW.map((x) => x.S), ys: inW.map((x) => x.mult), color: c.gold, bars: 0.35 }],
        texts: lv.filter((_, i) => lv.length < 12 || i % 2 === 0).map((x) => ({ x: x.S, y: Math.log10(x.mult) + 0.08, s: `${fix(x.dE, 1)}J`, color: c.muted, align: 'center' })) });
      return [[L('自旋态总数 Π(2sᵢ + 1)', 'Total spin states Π(2sᵢ + 1)'), String(R.dim).replace(/\B(?=(\d{3})+(?!\d))/g, ' '), true], [L('多重态个数', 'Number of multiplets'), String(lv.reduce((a, x) => a + x.mult, 0))], [L('基态的总自旋', 'Ground-state total spin'), String(lv[0].S)], [L('窗口里的态数（含 2S + 1 重简并）', 'States in the window (counting 2S + 1)'), String(states)], [L('最高的能级', 'Highest level'), `${fix(maxE, 1)} J`]];
    },
  };

  // ── 第十章：随机量子线路和 MPS 模拟 ──────────────────────────────────
  const circ = (N, seed) => cache(`circ${N}_${seed}`, () => M.randomCircuit(N, 30, seed));
  DEMOS.circuit = {
    title: L('用 MPS 模拟量子线路：纠缠一长满，χ 就要 2^{N/2}', 'Simulating quantum circuits with MPS: once entanglement fills up, χ must reach 2^{N/2}'), kind: 'exact',
    intro: L('在 N 个量子比特上一层层地加随机的两比特门（砖墙排布）。每加两层，中间切口的纠缠就长一截，准确表示这个态所需的 MPS 键维 χ（这里定为每个切口扔掉的权重 ≤ 10⁻⁶）跟着翻倍，直到撞上 2^{N/2} 的上限：这时 MPS 就不比完整的态向量省了。纠缠低的线路（浅的、噪声大的、结构特殊的）能用张量网络高效模拟，这正是近年来很多“量子优越性”实验被经典模拟追上的原因。', 'Apply random two-qubit gates layer by layer (a brickwork pattern) to N qubits. Every two layers the entanglement across the middle cut grows by a step, and the MPS bond dimension χ needed to represent the state accurately (here: discarded weight ≤ 10⁻⁶ at the cut) doubles with it, until it hits the ceiling 2^{N/2}: from then on an MPS saves nothing over the full state vector. Circuits with little entanglement (shallow, noisy or specially structured) can be simulated efficiently with tensor networks, which is why classical simulations have caught up with many “quantum supremacy” experiments in recent years.'),
    ctl: [['n', L('量子比特数 N', 'Qubits N'), 8, 12, 2, 12, (v) => String(v)], ['d', L('线路深度（层数）', 'Circuit depth (layers)'), 0, 30, 1, 0, (v) => String(v)], ['seed', L('随机种子', 'Random seed'), 1, 20, 1, 1, (v) => String(v)]],
    autoplay: true, fps: 3,
    tick(s) { s.d = Math.min(30, s.d + 1); return s.d < 30; },
    btn: [[L('从头开始', 'From the start'), { d: 0 }]],
    figs: [[0.5, L('中间切口的纠缠熵（蓝）和需要的 χ（金，对数，右边的刻度用 log₂ χ 读）。虚线是 N/2 · ln 2，纠缠能有的最大值。', 'Entanglement across the middle cut (blue) and the χ needed (gold, read on a log₂ χ scale). The dashed line is N/2 · ln 2, the most entanglement possible.')]],
    note: L('门是随机的 4 × 4 实正交矩阵（随机对称矩阵的本征向量），态向量精确演化；每层之后对中间切口做 SVD。真实的量子处理器的门是复数的、有噪声，这里只是为了看纠缠怎样长。在中间切口上只有隔一层的门跨过它，所以纠缠每两层长一次。', 'Gates are random 4 × 4 real orthogonal matrices (eigenvectors of random symmetric matrices) and the state vector is evolved exactly; after each layer the middle cut is decomposed with an SVD. Real quantum processors have complex, noisy gates; this is only to see how entanglement grows. Only every other layer has a gate across the middle cut, so the entanglement grows every two layers.'),
    draw(s, [cv], c) {
      const C = circ(s.n, s.seed), cur = C[s.d], ds = C.map((x) => x.depth), Smax = (s.n / 2) * LN2, sc = Smax / (s.n / 2);
      plot(cv, { x: [0, 30], y: [0, Smax * 1.12], xl: L('深度', 'depth'), yl: 'S', series: [{ xs: ds, ys: C.map((x) => x.S), color: c.accent, width: 1, alpha: 0.25 }, { xs: ds.slice(0, s.d + 1), ys: C.slice(0, s.d + 1).map((x) => x.S), color: c.accent, width: 2.4, dots: 3, line: true, label: 'S' }, { xs: ds.slice(0, s.d + 1), ys: C.slice(0, s.d + 1).map((x) => Math.log2(x.chi) * sc), color: c.gold, width: 2, dash: [2, 3], label: 'log₂ χ' }], hmarks: [{ y: Smax, color: c.danger }], marks: [{ x: s.d, y: cur.S, color: c.danger }] });
      return [[L('中间切口的纠缠熵', 'Middle-cut entropy'), `${fix(cur.S, 3)} nat`, true], [L('需要的 χ', 'χ needed'), String(cur.chi), true], [L('上限 2^{N/2}', 'Ceiling 2^{N/2}'), String(2 ** (s.n / 2))], [L('MPS 参数（按每条键都是 χ 估）/ 态向量', 'MPS parameters (taking χ on every bond) / state vector'), `${2 * s.n * cur.chi * cur.chi} / ${2 ** s.n}`]];
    },
  };
};
