const r = String.raw;
export default {
  id: 'dynamics', level: 'tested', demos: ['quench'],
  title: ['时间演化：纠缠增长是真正的墙', 'Time evolution: entanglement growth is the real wall'],
  summary: ['MPS 也能做实时演化：TEBD 把演化算符拆成一层层的两格点门，TDVP 把薛定谔方程投影到固定 χ 的 MPS 流形上。可是淬火之后纠缠按时间线性增长，所以需要的 χ 按时间指数增长。这一章讲这些方法、Lieb–Robinson 光锥和纠缠增长的物理图像，以及它们给出的能算多久的上限。', 'MPS can also be evolved in real time: TEBD splits the evolution operator into layers of two-site gates, and TDVP projects the Schrödinger equation onto the manifold of fixed-χ MPS. But after a quench entanglement grows linearly in time, so the required χ grows exponentially in time. This chapter covers these methods, the Lieb–Robinson light cone and the physical picture of entanglement growth, and the limit they set on how long one can compute.'],
  body: [
    [r`Vidal 2004 年提出**时间演化块消减**（TEBD）：把最近邻哈密顿量分成奇数键和偶数键两组，各组内部的项互相对易，所以 $e^{-iH\delta t}$ 可以用 Trotter–Suzuki 分解写成交替的两层两格点门。每作用一个门，相邻两个格点的纠缠可能变大，就做一次 SVD、留 $\chi$ 个奇异值 [@vidal2004]。同年，White 和 Feiguin [@white2004]、Daley 等人 [@daley2004] 把同样的想法放进了 DMRG 的程序里，叫含时 DMRG。`,
     r`In 2004 Vidal introduced **time-evolving block decimation** (TEBD): split a nearest-neighbour Hamiltonian into odd and even bonds; terms within each group commute, so $e^{-iH\delta t}$ can be written with a Trotter–Suzuki decomposition as alternating layers of two-site gates. Each gate may increase the entanglement between two neighbouring sites, so it is followed by an SVD keeping $\chi$ singular values [@vidal2004]. The same year White and Feiguin [@white2004] and Daley et al. [@daley2004] built the same idea into DMRG codes, under the name time-dependent DMRG.`],
    { math: r`e^{-iH\delta t} = e^{-iH_\text{odd}\delta t/2}\,e^{-iH_\text{even}\delta t}\,e^{-iH_\text{odd}\delta t/2} + O(\delta t^3)`, cap: ['二阶 Trotter–Suzuki 分解；每个指数是一层互不重叠的两格点门。', 'The second-order Trotter–Suzuki decomposition; each exponential is a layer of non-overlapping two-site gates.'] },
    [r`另一条路是**含时变分原理**（TDVP）：键维 $\chi$ 的 MPS 构成一个弯曲的流形，把 $i\partial_t|\psi\rangle = H|\psi\rangle$ 的右边正交投影到这个流形的切空间上 [@haegeman2011]。这样演化自动保持范数和能量，也能处理长程相互作用（TEBD 要先把它们拆成近邻门）。2016 年 Haegeman 等人把它写成了和 DMRG 一样一格点一格点扫的形式 [@haegeman2016]。`,
     r`The other route is the **time-dependent variational principle** (TDVP): MPS of bond dimension $\chi$ form a curved manifold, and the right-hand side of $i\partial_t|\psi\rangle = H|\psi\rangle$ is projected orthogonally onto its tangent space [@haegeman2011]. This conserves norm and energy automatically and handles long-range interactions (which TEBD must first break into neighbouring gates). In 2016 Haegeman et al. recast it as a site-by-site sweep, just like DMRG [@haegeman2016].`],
    { h: ['光锥', 'The light cone'] },
    [r`非相对论的量子格子模型没有光速，可是 Lieb 和 Robinson 1972 年证明，相互作用是局域的、有界的时候，信息传播有一个最大速度 $v_\text{LR}$：在光锥 $|x| > v_\text{LR}t$ 之外，算符的对易子按指数小 [@lieb1972]。这给纠缠增长定了上限：一段时间 $t$ 里，切口两边只能多出 $O(v_\text{LR}t)$ 的纠缠。`,
     r`Non-relativistic lattice models have no speed of light, yet Lieb and Robinson proved in 1972 that when interactions are local and bounded there is a maximum speed of information $v_\text{LR}$: outside the light cone $|x| > v_\text{LR}t$ commutators of operators are exponentially small [@lieb1972]. This caps entanglement growth: in a time $t$, at most $O(v_\text{LR}t)$ of extra entanglement can build up across a cut.`],
    { h: ['淬火之后，纠缠线性地长', 'After a quench, entanglement grows linearly'] },
    [r`Calabrese 和 Cardy 给了一个简单的图像：一次全局淬火在每个地方都放出一对纠缠的准粒子，它们朝相反方向飞。时刻 $t$ 时，跨过切口的准粒子对数正比于 $2vt$，所以纠缠熵 $S(t)\propto t$，直到 $vt$ 达到子系统的大小才饱和到体积律 [@calabrese2005]。对随机线路这样没有准粒子的系统，纠缠的增长同样是线性的，Nahum、Ruhman、Vijay 和 Haah 用一个表面增长的模型描述了它的涨落 [@nahum2017]。`,
     r`Calabrese and Cardy gave a simple picture: a global quench releases an entangled pair of quasiparticles everywhere, flying in opposite directions. At time $t$ the number of pairs straddling the cut is proportional to $2vt$, so the entanglement entropy grows as $S(t)\propto t$ until $vt$ reaches the subsystem size and it saturates at a volume law [@calabrese2005]. In systems without quasiparticles, such as random circuits, entanglement also grows linearly; Nahum, Ruhman, Vijay and Haah described its fluctuations with a surface-growth model [@nahum2017].`],
    { demo: 'quench' },
    [r`后果很直接：键维 $\chi$ 的 MPS 最多装 $\ln\chi$ 的纠缠，$S(t)$ 线性增长就意味着 $\chi$ 要按 $e^{S(t)}$ 指数增长。所以 MPS 能把淬火后的动力学算得很准，但只能算到有限的时间；之后误差会突然变大。这不是程序写得不好，是纠缠本身的限制。`,
     r`The consequence is immediate: an MPS of bond dimension $\chi$ holds at most $\ln\chi$ of entanglement, so linear growth of $S(t)$ means $\chi$ must grow exponentially as $e^{S(t)}$. MPS therefore compute post-quench dynamics very accurately, but only up to a finite time, after which the error rises abruptly. This is not a matter of poor coding; it is the entanglement itself.`],
    { note: ['**有办法绕开吗？** 局部的观测量（比如一个格点的磁化）往往在纠缠饱和之后很快趋于平衡值，只需要算到不长的时间；有限温度和谱函数可以用纯化、Chebyshev 展开等技巧；对线性响应，有些情况下在 Heisenberg 绘景里演化算符比演化态纠缠更少。这些都是活跃的研究方向，没有一种普遍适用。', '**Is there a way round it?** Local observables (the magnetisation on one site, say) often relax to equilibrium values soon after entanglement saturates, so short times can be enough; finite temperatures and spectral functions can use purification, Chebyshev expansions and similar tricks; for linear response, evolving operators in the Heisenberg picture sometimes builds up less entanglement than evolving states. All of these are active research directions, and none applies universally.'], kind: 'info' },
  ],
  points: [
    [['TEBD 和含时 DMRG', 'TEBD and time-dependent DMRG'], ['Trotter 分解成两格点门，每个门后 SVD 截断。', 'Trotter-decompose into two-site gates and truncate with an SVD after each gate.'], 'tested'],
    [['TDVP', 'TDVP'], ['把薛定谔方程投影到固定 χ 的 MPS 流形上，保范数和能量。', 'Project the Schrödinger equation onto the fixed-χ MPS manifold, conserving norm and energy.'], 'proved'],
    [['Lieb–Robinson 界', 'The Lieb–Robinson bound'], ['局域相互作用下信息传播有最大速度。', 'With local interactions, information spreads at a bounded speed.'], 'proved'],
    [['淬火后纠缠线性增长', 'Linear entanglement growth after a quench'], ['准粒子图像（Calabrese–Cardy）对可积系统精确，对一般系统是经验规律。', 'The quasiparticle picture (Calabrese–Cardy) is exact for integrable systems and empirical in general.'], 'tested'],
    [['能算的时间有上限', 'Reachable times are bounded'], ['χ ~ e^{S(t)}，所以经典 MPS 模拟只能到有限的时间。', 'χ ~ e^{S(t)}, so classical MPS simulations reach only finite times.'], 'tested'],
    [['长时间动力学的经典算法', 'Classical algorithms for long-time dynamics'], ['对一般的相互作用系统，有没有高效的经典方法算长时间的局部观测量，还不清楚。', 'Whether there is an efficient classical method for long-time local observables in generic interacting systems is unknown.'], 'open'],
  ],
  math: [
    [r`\|[A(t), B]\| \le c\,\|A\|\,\|B\|\,e^{-(d - v_\text{LR}t)/\xi}`, ['Lieb–Robinson 界：A、B 相距 d。', 'The Lieb–Robinson bound for A and B a distance d apart.']],
    [r`S_A(t) \simeq \begin{cases} 2 s\,v t, & 2vt < \ell \\ s\,\ell, & 2vt > \ell\end{cases}`, ['准粒子图像：s 是每对准粒子带的纠缠，ℓ 是子系统长度（按单侧切口简化）。', 'The quasiparticle picture: s is the entanglement carried per pair and ℓ the subsystem length (simplified to a single cut).']],
    [r`i\frac{d}{dt}|\psi(A)\rangle = P_{T_{|\psi\rangle}}\,H|\psi(A)\rangle`, ['TDVP：把 H|ψ⟩ 投影到 MPS 流形的切空间。', 'TDVP: project H|ψ⟩ onto the tangent space of the MPS manifold.']],
  ],
  example: {
    q: [r`64 个格点的自由费米子链从 Néel 态淬火。$t = 10$（单位 $\hbar$ 除以跳跃积分）时半链纠缠熵是 $8.94$ nat。要准确表示这时的态，MPS 至少要多大的键维？`, r`A 64-site free-fermion chain is quenched from the Néel state. At $t = 10$ (in units of $\hbar$ over the hopping) the half-chain entanglement entropy is $8.94$ nat. What bond dimension must an MPS have at least to represent the state accurately?`],
    steps: [
      [r`MPS 能装的纠缠不超过 $\ln\chi$，所以 $\chi \ge e^{S} = e^{8.94} \approx 7\,600$。`, r`An MPS holds at most $\ln\chi$ of entanglement, so $\chi \ge e^{S} = e^{8.94} \approx 7\,600$.`],
      [r`$t = 2$ 时 $S = 1.85$，$t = 4$ 时 $3.62$：每单位时间大约加 $0.89$ nat，也就是 $\chi$ 每单位时间乘约 $e^{0.89}\approx 2.4$。`, r`At $t = 2$, $S = 1.85$, and at $t = 4$, $3.62$: about $0.89$ nat per unit time, so $\chi$ multiplies by about $e^{0.89}\approx 2.4$ per unit time.`],
    ],
    a: [r`至少约 $7\,600$。64 个格点的链在 $t\approx 16$ 之后被链长截住，纠缠不再长；换成 128 个格点，$t = 20$ 时 $S = 17.8$，就要 $\chi\approx e^{17.8}\approx 5\times10^{7}$，远超今天的计算机。演示里拖时间滑杆可以读到同样的数。`, r`At least about $7\,600$. The 64-site chain is cut off by its length after $t\approx 16$ and stops gaining entanglement; on a 128-site chain $S = 17.8$ at $t = 20$, which needs $\chi\approx e^{17.8}\approx 5\times10^{7}$, far beyond today’s computers. Drag the time slider in the demo to read the same numbers.`],
  },
};
