'use strict';
// 密度泛函理论（/dft/）的十二个演示。数学都在 dft-models.js（纯函数，tools/dft-test.mjs 测）。dft.js 用 window.MOLASTRIA_DFT_DEMOS(K, DEMOS) 把它们登记进去。
// 写法同群论的 gt-demos.js：title，kind，intro，sel，ctl，chk，btn，act，state，changed，figs，note，draw(s, 图, 颜色) 返回读数。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。'html' 图里的内容也只用这里的固定文字和算出来的数字拼。
window.MOLASTRIA_DFT_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_DFT_MODELS;
  const { L, fix, fmt, plot, lin, esc } = K;
  const EV = M.HARTREE_EV;
  const lg = (v) => Math.log10(Math.max(Math.abs(v), 1e-16));
  const memo = (fn) => { let key = null, val; return (...a) => { const k = JSON.stringify(a); if (k !== key) { key = k; val = fn(...a); } return val; }; };
  const sci = (v, d = 2) => fmt(v, d);

  // ── 1. Thomas–Fermi 原子 ───────────────────────────────────────────
  DEMOS.tf = {
    title: L('只用密度的第一次尝试：Thomas–Fermi 原子', 'The first density-only attempt: the Thomas–Fermi atom'), kind: 'data',
    intro: L('1927 年的 Thomas–Fermi 模型把原子里的电子当成局部均匀的电子气，总能量只依赖密度，结果是 E = −0.7687 Z^{7/3}。它对重原子的“量级”是对的，对轻原子错得很多，而且永远解释不了化学键（Teller 1962）。加上 Scott 修正（最内层电子）和 Schwinger 的交换项，大 Z 展开越来越准。灰点是非相对论的“精确”总能量。', 'The 1927 Thomas–Fermi model treats the electrons of an atom as a locally uniform electron gas, so the total energy depends on the density alone; the result is E = −0.7687 Z^{7/3}. It gets the order of magnitude right for heavy atoms, is badly off for light ones, and can never explain a chemical bond (Teller 1962). Adding the Scott correction (for the innermost electrons) and Schwinger’s exchange term makes the large-Z expansion steadily better. Grey dots are non-relativistic “exact” total energies.'),
    ctl: [['z', L('原子序数 Z', 'Atomic number Z'), 1, 18, 1, 10, (v) => `${v} · ${M.ATOMS[v - 1][0]}`]],
    figs: [[0.5, L('相对误差 E_近似 / E_精确 − 1（%）。', 'Relative error E_approx / E_exact − 1 (%).')], [0.42, L('总能量的绝对值（Hartree，对数轴）。', 'Magnitude of the total energy (hartree, log axis).')]],
    note: L('E_TF = −0.768745 Z^{7/3}；Scott 修正 +Z²/2；Schwinger 的交换修正 −0.2699 Z^{5/3}（单位都是 Hartree）。“精确”值：H 是解析解，He 来自高精度变分计算，Li 到 Ar 取 Chakravorty 等（1993）的估计。这些都不含相对论效应，对 Ar 来说相对论修正约 −1.8 Hartree，这里不管。', 'E_TF = −0.768745 Z^{7/3}; the Scott correction +Z²/2; Schwinger’s exchange correction −0.2699 Z^{5/3} (all in hartree). “Exact” values: H is analytic, He comes from high-precision variational work, Li to Ar are the estimates of Chakravorty et al. (1993). None includes relativity; for Ar the relativistic correction is about −1.8 hartree and is ignored here.'),
    draw(s, [cv, cv2], c) {
      const A = M.ATOMS, Zs = A.map((a) => a[1]), err = (k) => A.map((a) => 100 * (M.tfEnergy(a[1], k) / a[2] - 1));
      plot(cv, { x: [0.5, 18.5], y: [-10, 80], xl: 'Z', yl: '%', xt: [1, 2, 4, 6, 8, 10, 12, 14, 16, 18], series: [
        { xs: Zs, ys: err(1), color: c.danger, dots: 3.5, line: true, label: 'TF' },
        { xs: Zs, ys: err(2), color: c.gold, dots: 3.5, line: true, label: 'TF + Scott' },
        { xs: Zs, ys: err(3), color: c.ok, dots: 3.5, line: true, label: 'TF + Scott + Schwinger' }],
        hmarks: [{ y: 0, color: c.ink2, dash: [] }], marks: [{ x: s.z, color: c.line }] });
      const zz = lin(1, 18, 120);
      plot(cv2, { x: [0, 1.3], y: [-0.5, 3], logx: true, logy: true, xl: 'Z', yl: '|E| (Eh)', series: [
        { xs: zz, ys: zz.map((z) => -M.tfEnergy(z, 1)), color: c.danger, label: 'TF' },
        { xs: zz, ys: zz.map((z) => -M.tfEnergy(z, 3)), color: c.ok, dash: [5, 4], label: 'TF + Scott + Schwinger' },
        { xs: Zs, ys: A.map((a) => -a[2]), color: c.ink2, dots: 3.5, label: L('精确', 'Exact') }] });
      const a = A[s.z - 1];
      return [[L('精确（非相对论）', 'Exact (non-relativistic)'), `${fix(a[2], 4)} Eh`, true], ['TF', `${fix(M.tfEnergy(s.z, 1), 3)} Eh (${fix(100 * (M.tfEnergy(s.z, 1) / a[2] - 1), 1)} %)`], ['+ Scott', `${fix(M.tfEnergy(s.z, 2), 3)} Eh (${fix(100 * (M.tfEnergy(s.z, 2) / a[2] - 1), 1)} %)`], ['+ Schwinger', `${fix(M.tfEnergy(s.z, 3), 3)} Eh (${fix(100 * (M.tfEnergy(s.z, 3) / a[2] - 1), 2)} %)`]];
    },
  };

  // ── 2. Hubbard 二聚体：密度和势一一对应 ─────────────────────────────
  const dimerCurves = memo((U) => {
    const dns = lin(-1.96, 1.96, 61);
    return { dns, F: dns.map((d) => M.dimerInvert(d, U).F), Ts: dns.map((d) => M.dimerTs(d)) };
  });
  DEMOS.dimer = {
    title: L('Hohenberg–Kohn 定理的最小例子：两个格点、两个电子', 'The smallest Hohenberg–Kohn example: two sites, two electrons'), kind: 'exact',
    intro: L('两个格点之间电子可以跳（跳跃 t = ½），同一格点上两个电子互相排斥 U，两格点的势差是 Δv。这个问题能精确对角化。左图说明：给定 U，势差 Δv 和占据差 Δn 是一一对应的（曲线单调），所以知道密度就知道势，这正是 Hohenberg–Kohn 定理。再问：什么样的“没有相互作用”的电子能给出同一个 Δn？它们要感受到另一个势差 Δv_s，多出来的 Δv_Hxc = Δv_s − Δv 就是 Hartree–交换–关联势。右图是普适泛函 F[n]，以及它的动能部分 T_s。', 'Electrons can hop between two sites (hopping t = ½), two electrons on the same site repel with U, and the sites differ in potential by Δv. The problem can be diagonalised exactly. The left plot shows that, for a given U, the potential difference Δv and the occupation difference Δn determine each other (the curve is monotonic): know the density and you know the potential, which is the Hohenberg–Kohn theorem. Then ask which non-interacting electrons give the same Δn: they must feel a different potential difference Δv_s, and the extra Δv_Hxc = Δv_s − Δv is the Hartree–exchange–correlation potential. The right plot is the universal functional F[n] and its kinetic part T_s.'),
    ctl: [['dv', L('势差 Δv', 'Potential difference Δv'), -4, 4, 0.05, 1, (v) => fix(v, 2)], ['u', L('排斥 U', 'Repulsion U'), 0, 8, 0.1, 2, (v) => fix(v, 1)]],
    btn: [[L('没有相互作用 U = 0', 'No interaction U = 0'), { u: 0 }], [L('强关联 U = 8', 'Strongly correlated U = 8'), { u: 8, dv: 2 }]],
    figs: [[0.55, L('占据差 Δn = n₂ − n₁ 随势差 Δv：金色是有相互作用的精确解，绿色虚线是没有相互作用的电子。', 'Occupation difference Δn = n₂ − n₁ against Δv: gold is the exact interacting solution, green dashes non-interacting electrons.')], [0.5, L('普适泛函 F(Δn)、Kohn–Sham 动能 T_s(Δn) 和它们的差 E_Hxc（单位 = 跳跃能 t 的 2 倍）。', 'The universal functional F(Δn), the Kohn–Sham kinetic energy T_s(Δn) and their difference E_Hxc (in units of 2t).')]],
    note: L('t = ½，能量单位是 2t。精确解：在自旋单态的三维空间里对角化 3 × 3 的哈密顿量。Kohn–Sham 势差有解析式 Δv_s = −2tΔn/√(4 − Δn²)。F 用 Levy–Lieb 的定义 F = E − ΣvᵢNᵢ，对每个 Δn 先二分求出产生它的 Δv。这个模型来自 Carrascal 等的综述（2015）。', 't = ½ and energies are in units of 2t. The exact solution diagonalises the 3 × 3 Hamiltonian in the singlet sector. The Kohn–Sham potential difference is analytic: Δv_s = −2tΔn/√(4 − Δn²). F follows the Levy–Lieb definition F = E − ΣvᵢNᵢ, with the Δv producing each Δn found by bisection. The model follows the review by Carrascal et al. (2015).'),
    draw(s, [cv, cv2], c) {
      const vs = lin(-4, 4, 161), r = M.dimer(s.dv, s.u), dvs = M.dimerVs(r.dn), cur = dimerCurves(s.u);
      plot(cv, { x: [-4, 4], y: [-2.05, 2.05], xl: 'Δv', yl: 'Δn', series: [
        { xs: vs, ys: vs.map((v) => M.dimer(v, s.u).dn), color: c.gold, width: 2.6, label: `U = ${fix(s.u, 1)}` },
        { xs: vs, ys: vs.map((v) => M.dimerDnS(v)), color: c.ok, dash: [6, 4], label: 'U = 0 (KS)' }],
        marks: [{ x: s.dv, y: r.dn, color: c.danger }, { x: dvs, y: r.dn, color: c.ok }], hmarks: [{ y: r.dn, color: c.line }] });
      const all = [...cur.F, ...cur.Ts, ...cur.F.map((f, i) => f - cur.Ts[i])];
      plot(cv2, { x: [-2, 2], y: [Math.min(...all) - 0.1, Math.max(...all) + 0.1], xl: 'Δn', yl: L('能量', 'Energy'), series: [
        { xs: cur.dns, ys: cur.F, color: c.gold, width: 2.4, label: 'F' }, { xs: cur.dns, ys: cur.Ts, color: c.ok, dash: [6, 4], label: 'T_s' },
        { xs: cur.dns, ys: cur.F.map((f, i) => f - cur.Ts[i]), color: c.info, label: 'E_Hxc = F − T_s' }], marks: [{ x: r.dn, color: c.danger }] });
      return [[L('基态能量 E₀', 'Ground-state energy E₀'), fix(r.E, 4)], [L('占据差 Δn', 'Occupation difference Δn'), fix(r.dn, 4), true], [L('KS 势差 Δv_s', 'KS potential difference Δv_s'), fix(dvs, 4)], [L('Δv_Hxc = Δv_s − Δv', 'Δv_Hxc = Δv_s − Δv'), fix(dvs - s.dv, 4)], [L('激发能隙', 'Excitation gap'), fix(r.gap, 4)]];
    },
  };

  // ── 3. 一维 Kohn–Sham 自洽 ────────────────────────────────────────
  const SYS = { he: [2, 2], be: [4, 4], c: [6, 6] };
  const runKS = memo((sys, xc, mix, alpha) => { const [Z, N] = SYS[sys]; return M.ks1d({ Z, N, xc: N > 2 && xc === 'x2' ? 'lda' : xc, mix, alpha, L: N > 2 ? 12 : 10, maxIt: 150 }); });
  DEMOS.scf = {
    title: L('Kohn–Sham 自洽：猜一个密度，解方程，再混合', 'Kohn–Sham self-consistency: guess a density, solve, mix'), kind: 'toy',
    intro: L('一维“原子”：电子感受软库仑势 −Z/√(x² + 1)，电子之间也是软库仑排斥。从没有相互作用的密度出发，每一步用当前密度算出 Hartree 势和交换势，解一次 Kohn–Sham 方程，得到新的密度，再按比例 α 混合进去。α 太大，密度会来回振荡、迟迟不收敛；Pulay 的 DIIS 用最近几步的残差外推，几乎总是快得多。两个电子时，“精确交换”就是 v_x = −v_H/2，这一步和 Hartree–Fock 完全一样。', 'A one-dimensional “atom”: electrons feel a soft-Coulomb potential −Z/√(x² + 1) and repel each other through the same soft Coulomb law. Starting from the non-interacting density, each step builds the Hartree and exchange potentials from the current density, solves the Kohn–Sham equation once, gets a new density and mixes in a fraction α of it. Make α too large and the density sloshes back and forth and converges slowly or not at all; Pulay’s DIIS extrapolates from the residuals of the last few steps and is almost always far faster. With two electrons, “exact exchange” is simply v_x = −v_H/2, identical to Hartree–Fock.'),
    sel: [['sys', L('体系', 'System'), [['he', L('Z = 2，两个电子（像 He）', 'Z = 2, two electrons (He-like)')], ['be', L('Z = 4，四个电子', 'Z = 4, four electrons')], ['c', L('Z = 6，六个电子', 'Z = 6, six electrons')]], 'he'],
      ['xc', L('电子间相互作用', 'Electron–electron terms'), [['x2', L('Hartree + 精确交换（只适用于两个电子）', 'Hartree + exact exchange (two electrons only)')], ['lda', L('Hartree + 局域交换（玩具 LDA）', 'Hartree + local exchange (toy LDA)')], ['h', L('只有 Hartree（自相互作用最严重）', 'Hartree only (worst self-interaction)')], ['none', L('没有相互作用', 'No interaction')]], 'x2'],
      ['mix', L('混合方法', 'Mixing'), [['linear', L('线性混合', 'Linear mixing')], ['diis', 'Pulay DIIS']], 'linear']],
    ctl: [['alpha', L('混合比例 α', 'Mixing fraction α'), 0.05, 1, 0.05, 0.3, (v) => fix(v, 2)]],
    btn: [[L('α = 1，只有 Hartree（振荡）', 'α = 1, Hartree only (oscillates)'), { xc: 'h', alpha: 1, mix: 'linear' }], [L('同样的设置换成 DIIS', 'Same, with DIIS'), { xc: 'h', alpha: 1, mix: 'diis' }]],
    figs: [[0.55, L('密度 n(x)（金色）、Kohn–Sham 有效势 v_s(x)（灰）和占据轨道（虚线）。', 'Density n(x) (gold), the Kohn–Sham effective potential v_s(x) (grey) and occupied orbitals (dashed).')], [0.42, L('每一步的密度残差 ‖n_out − n_in‖（对数轴）；低于 10⁻⁸ 算收敛。', 'Density residual ‖n_out − n_in‖ at each step (log axis); below 10⁻⁸ counts as converged.')]],
    note: L('161 个格点，x 从 −10 到 10（四个以上电子时 −12 到 12），动能用三点差分，本征值用 Sturm 序列二分、本征矢用反迭代。局域交换照搬三维 LDA 的公式 −(3/4)(3/π)^{1/3}n^{4/3}，在一维里没有理论依据，只是为了让多电子的例子能跑；真实程序还会用 Kerker 预处理、Broyden 混合等手段。最多算 150 步。', '161 grid points from x = −10 to 10 (−12 to 12 for more than two electrons), three-point finite differences for the kinetic energy, Sturm-sequence bisection for eigenvalues and inverse iteration for eigenvectors. The local exchange copies the 3D LDA formula −(3/4)(3/π)^{1/3}n^{4/3}, which has no theoretical basis in 1D and only lets the many-electron examples run; real programs also use Kerker preconditioning, Broyden mixing and so on. At most 150 steps.'),
    draw(s, [cv, cv2], c) {
      const r = runKS(s.sys, s.xc, s.mix, s.alpha), vs = r.x.map((_, i) => r.vext[i] + r.vh[i] + r.vx[i]);
      const nmax = Math.max(...r.n), sc = 1 / Math.max(nmax, 1e-9);
      const vmin = Math.min(...vs);
      plot(cv, { x: [-8, 8], y: [-1.15, 1.15], xl: 'x (bohr)', yt: [], series: [
        { xs: r.x, ys: vs.map((v) => v / Math.abs(vmin)), color: c.muted, width: 1.6, label: 'v_s / |v_s|max' },
        ...r.orbs.map((o, k) => ({ xs: r.x, ys: o.map((v) => v / Math.max(...o.map(Math.abs))), color: [c.info, c.violet || c.accent, c.ok][k % 3], dash: [5, 4], width: 1.4 })),
        { xs: r.x, ys: r.n.map((v) => v * sc), color: c.gold, width: 2.6, fill: true, label: 'n(x) / n_max' }] });
      const its = r.hist.map((_, i) => i + 1);
      plot(cv2, { x: [0, Math.max(10, r.hist.length + 1)], y: [-10, 1], logy: true, xl: L('迭代步', 'Iteration'), yl: '‖Δn‖', series: [{ xs: its, ys: r.hist, color: r.converged ? c.ok : c.danger, dots: 2.5, line: true }], hmarks: [{ y: 1e-8, color: c.line }] });
      const real = SYS[s.sys][1] > 2 && s.xc === 'x2';
      return [[L('结果', 'Result'), r.converged ? L(`${r.iters} 步收敛`, `converged in ${r.iters} steps`) : L(`${r.iters} 步还没收敛`, `not converged after ${r.iters} steps`), true],
        [L('总能量 E', 'Total energy E'), `${fix(r.E, 6)} Eh`], [L('最高占据轨道 ε_HOMO', 'Highest occupied ε_HOMO'), `${fix(r.eps[r.orbs.length - 1], 4)} Eh`],
        ['T_s / E_ext / E_H / E_x', `${fix(r.Ts, 3)} / ${fix(r.Eext, 3)} / ${fix(r.EH, 3)} / ${fix(r.Ex, 3)}`],
        ...(real ? [[L('注意', 'Note'), L('精确交换的写法只对两个电子成立，这里改用了局域交换', 'the exact-exchange shortcut holds only for two electrons; local exchange is used instead')]] : [])];
    },
  };

  // ── 4. 交换增强因子 ───────────────────────────────────────────────
  const FXS = [['lda', 'LDA'], ['ge', L('梯度展开', 'Gradient expansion')], ['b88', 'B88'], ['pbe', 'PBE'], ['revpbe', 'revPBE'], ['pbesol', 'PBEsol']];
  const hEx = memo(() => Object.fromEntries(FXS.map(([k]) => [k, M.hydrogenEx(M.FX[k])])));
  DEMOS.enh = {
    title: L('泛函的形状：交换增强因子 F_x(s)', 'The shape of a functional: the exchange enhancement factor F_x(s)'), kind: 'exact',
    intro: L('GGA 的交换能写成 E_x = ∫ e_x^LDA(n) F_x(s) d³r，s = |∇n|/(2k_F n) 是无量纲的约化梯度：密度变化得越陡，s 越大。整个泛函就是一条曲线 F_x(s)。LDA 是一条水平线 F = 1；梯度展开在 s 小时对，s 大时一直往上冲；PBE 把它在 1.804 处封顶（局部的 Lieb–Oxford 界）；B88 用一个参数拟合了惰性气体原子的交换能。右边的表用这些曲线算出氢原子的交换能，精确值是 −5/16 = −0.3125 Hartree。', 'A GGA writes the exchange energy as E_x = ∫ e_x^LDA(n) F_x(s) d³r, where s = |∇n|/(2k_F n) is a dimensionless reduced gradient: the steeper the density changes, the larger s. The whole functional is one curve F_x(s). LDA is the flat line F = 1; the gradient expansion is right at small s and shoots upward at large s; PBE caps it at 1.804 (the local Lieb–Oxford bound); B88 fits one parameter to the exchange energies of the noble-gas atoms. The table on the right uses these curves to compute the exchange energy of the hydrogen atom, whose exact value is −5/16 = −0.3125 hartree.'),
    ctl: [['s', L('约化梯度 s', 'Reduced gradient s'), 0, 3, 0.02, 1, (v) => fix(v, 2)]],
    figs: [[0.6, L('六种交换增强因子；灰色虚线是 PBE 遵守的局部 Lieb–Oxford 界 1.804。', 'Six exchange enhancement factors; the grey dashes are the local Lieb–Oxford bound 1.804 that PBE respects.')], ['html', L('氢原子的交换能（Hartree）。精确值 −0.3125；H 原子只有一个电子，交换必须正好抵消 Hartree 自相互作用。', 'Exchange energy of the hydrogen atom (hartree). Exact −0.3125; hydrogen has one electron, so exchange must cancel its Hartree self-interaction exactly.')]],
    note: L('PBE：κ = 0.804、μ = 0.21951；revPBE 把 κ 改成 1.245；PBEsol 把 μ 改回梯度展开的 10/81；B88 的 β = 0.0042。氢原子的密度 e^{−2r}/π 是完全自旋极化的，交换能按自旋标度关系计算，径向积分用 400 个 Gauss–Chebyshev 点。', 'PBE: κ = 0.804, μ = 0.21951; revPBE changes κ to 1.245; PBEsol sets μ back to the gradient-expansion value 10/81; B88 has β = 0.0042. Hydrogen’s density e^{−2r}/π is fully spin-polarised, so the exchange energy uses the spin-scaling relation; the radial integral uses 400 Gauss–Chebyshev points.'),
    draw(s, [cv, box], c) {
      const ss = lin(0, 3, 200), cols = { lda: c.ink2, ge: c.muted, b88: c.info, pbe: c.gold, revpbe: c.danger, pbesol: c.ok };
      plot(cv, { x: [0, 3], y: [0.9, 2.3], xl: 's', yl: 'F_x(s)', series: FXS.map(([k, name]) => ({ xs: ss, ys: ss.map((v) => M.FX[k](v)), color: cols[k], width: k === 'pbe' ? 2.8 : 2, dash: k === 'ge' ? [6, 4] : [], label: name })), hmarks: [{ y: 1.804, color: c.muted }], marks: [{ x: s.s, color: c.line }] });
      const E = hEx();
      box.innerHTML = `<div class="chm-wrap"><table class="chm-table dft-tight"><thead><tr><th>${esc(L('泛函', 'Functional'))}</th><th>E_x</th><th>${esc(L('误差', 'Error'))}</th></tr></thead><tbody>${FXS.map(([k, n]) => `<tr><td>${esc(n)}</td><td class="num">${fix(E[k], 4)}</td><td class="num">${fix(100 * (E[k] / -0.3125 - 1), 1)} %</td></tr>`).join('')}<tr><td>${esc(L('精确', 'Exact'))}</td><td class="num">−0.3125</td><td class="num">0</td></tr></tbody></table></div>`;
      return FXS.map(([k, n]) => [`F_x(${fix(s.s, 2)}) · ${n}`, fix(M.FX[k](s.s), 4), k === 'pbe']);
    },
  };

  // ── 5. 均匀电子气 ──────────────────────────────────────────────────
  DEMOS.ueg = {
    title: L('LDA 的地基：均匀电子气', 'The foundation of LDA: the uniform electron gas'), kind: 'exact',
    intro: L('LDA 假设每一点的交换关联能等于同样密度的均匀电子气。均匀电子气的密度用 Wigner–Seitz 半径 r_s 表示（每个电子占一个半径 r_s 的球）。交换能有解析式 −0.4582/r_s；关联能没有，Ceperley 和 Alder 1980 年用量子蒙特卡洛算了出来，Perdew–Wang 1992 把结果拟合成一个公式，现在几乎所有程序都用它或者类似的拟合。拖动 r_s 看看金属里的电子大概在哪：铝 2.07，钠 3.93，铯 5.62。', 'LDA assumes that the exchange–correlation energy at each point equals that of a uniform electron gas of the same density. The gas’s density is expressed by the Wigner–Seitz radius r_s (each electron owns a sphere of radius r_s). Exchange has an analytic formula, −0.4582/r_s; correlation does not, and Ceperley and Alder computed it with quantum Monte Carlo in 1980. Perdew and Wang fitted the results with a formula in 1992, and almost every program uses it or a similar fit. Drag r_s to see where the electrons in metals sit: aluminium 2.07, sodium 3.93, caesium 5.62.'),
    ctl: [['rs', L('r_s（bohr）', 'r_s (bohr)'), 0.5, 12, 0.05, 2.07, (v) => fix(v, 2)]],
    btn: [['Al', { rs: 2.07 }], ['Cu', { rs: 2.67 }], ['Na', { rs: 3.93 }], ['K', { rs: 4.86 }], ['Cs', { rs: 5.62 }]],
    figs: [[0.55, L('每个电子的交换能 ε_x 和关联能 ε_c（Hartree）；实线是不极化，虚线是完全极化。', 'Exchange ε_x and correlation ε_c per electron (hartree); solid unpolarised, dashed fully polarised.')]],
    note: L('PW92 的参数取自原文的表 I（不极化和完全极化两组），中间的自旋极化用插值公式，这里没画。金属的 r_s 是自由电子模型的数值（Ashcroft 和 Mermin 的表 1.1）。', 'PW92 parameters are from Table I of the paper (unpolarised and fully polarised); intermediate polarisation uses an interpolation formula not drawn here. The metals’ r_s are free-electron values (Table 1.1 of Ashcroft and Mermin).'),
    draw(s, [cv], c) {
      const rr = lin(0.5, 12, 200);
      plot(cv, { x: [0, 12], y: [-0.95, 0.02], xl: 'r_s (bohr)', yl: 'ε (Eh)', series: [
        { xs: rr, ys: rr.map((r) => M.ueX(r)), color: c.info, width: 2.4, label: 'ε_x' }, { xs: rr, ys: rr.map((r) => M.ueX(r, 1)), color: c.info, dash: [5, 4] },
        { xs: rr, ys: rr.map((r) => M.pw92(r)), color: c.gold, width: 2.4, label: 'ε_c (PW92)' }, { xs: rr, ys: rr.map((r) => M.pw92(r, 1)), color: c.gold, dash: [5, 4] }],
        marks: [{ x: s.rs, y: M.pw92(s.rs), color: c.danger }] });
      const n = 3 / (4 * Math.PI * s.rs ** 3), kf = Math.cbrt(3 * Math.PI * Math.PI * n);
      return [['ε_x', `${fix(M.ueX(s.rs), 4)} Eh`], ['ε_c (PW92)', `${fix(M.pw92(s.rs), 4)} Eh`, true], [L('ε_c / ε_x', 'ε_c / ε_x'), fix(M.pw92(s.rs) / M.ueX(s.rs), 3)], [L('密度 n', 'Density n'), `${sci(n, 3)} a₀⁻³`], ['k_F', `${fix(kf, 3)} a₀⁻¹`], [L('Fermi 能 k_F²/2', 'Fermi energy k_F²/2'), `${fix((kf * kf * EV) / 2, 2)} eV`]];
    },
  };

  // ── 6. 分数电子数 ─────────────────────────────────────────────────
  const ATOMIP = { H: [13.598, 0.754], C: [11.260, 1.262], O: [13.618, 1.461], F: [17.423, 3.401], Na: [5.139, 0.548], Cl: [12.968, 3.613] };
  DEMOS.frac = {
    title: L('E(N) 应该是直线：离域误差和带隙问题', 'E(N) should be straight: delocalisation error and the band-gap problem'), kind: 'toy',
    intro: L('允许电子数 N 取分数时，精确的能量在两个整数之间是直线，在整数处折一下（Perdew–Parr–Levy–Balduz 1982）。直线的斜率分别是 −I（电离能）和 −A（电子亲和能），所以最高占据轨道的能量应该正好等于 −I。常用的近似泛函（LDA、GGA）把这条线压弯成下凸的：分数电荷被算得太稳定，电子喜欢摊开，这叫离域误差；Hartree–Fock 正好相反，是上凸的。弯曲也把折角抹平，于是 Kohn–Sham 的“带隙”比真实的基本能隙 I − A 小。', 'If the electron number N may be fractional, the exact energy is a straight line between integers with a kink at each integer (Perdew–Parr–Levy–Balduz 1982). The slopes are −I (ionisation energy) and −A (electron affinity), so the highest occupied orbital energy should equal −I exactly. Common approximate functionals (LDA, GGA) bend the line convex: fractional charges come out too stable and electrons like to spread, which is called delocalisation error; Hartree–Fock does the opposite and bends it concave. The bending also smooths the kink, so the Kohn–Sham “gap” comes out smaller than the true fundamental gap I − A.'),
    sel: [['atom', L('原子（实验的 I、A）', 'Atom (experimental I, A)'), Object.keys(ATOMIP).map((k) => [k, k]), 'C']],
    ctl: [['b', L('弯曲 b（eV）', 'Curvature b (eV)'), -3, 3, 0.05, 1.5, (v) => fix(v, 2)]],
    btn: [[L('精确（直线）', 'Exact (straight)'), { b: 0 }], [L('像 GGA（下凸）', 'GGA-like (convex)'), { b: 2 }], [L('像 Hartree–Fock（上凸）', 'HF-like (concave)'), { b: -2 }]],
    figs: [[0.55, L('E(N) − E(N₀)（eV）：灰色直线是精确的，金色是近似泛函。', 'E(N) − E(N₀) (eV): the grey straight lines are exact, gold the approximate functional.')], [0.42, L('斜率 dE/dN：精确的斜率在 N₀ 处从 −I 跳到 −A（导数不连续），弯曲让跳变变小。', 'The slope dE/dN: the exact slope jumps from −I to −A at N₀ (the derivative discontinuity); curvature shrinks the jump.')]],
    note: L('玩具模型：E = E_直线 + b δ(δ − 1)，δ 是 N 的小数部分。真实泛函的弯曲大小不同，而且一般在两边不一样。I 和 A 是 NIST 的实验值（eV）。轨道能 = 边上的斜率（Janak 定理）。', 'Toy model: E = E_line + b δ(δ − 1), with δ the fractional part of N. Real functionals bend by different amounts, usually differently on the two sides. I and A are NIST experimental values (eV). Orbital energies are the slopes at the edges (Janak’s theorem).'),
    draw(s, [cv, cv2], c) {
      const [I, A] = ATOMIP[s.atom], Ns = lin(-1, 1, 401), sl = M.fracSlopes(I, A, s.b);
      const ex = Ns.map((N) => M.fracE(N, I, A, 0)), ap = Ns.map((N) => M.fracE(N, I, A, s.b));
      plot(cv, { x: [-1, 1], y: [Math.min(...ex, ...ap) - 0.6, Math.max(...ex, ...ap) + 0.6], xl: 'N − N₀', yl: 'ΔE (eV)', xt: [-1, -0.5, 0, 0.5, 1], series: [{ xs: Ns, ys: ex, color: c.ink2, width: 2, label: L('精确', 'Exact') }, { xs: Ns, ys: ap, color: c.gold, width: 2.6, label: L('近似', 'Approximate') }] });
      const d = (N, b) => (M.fracE(N + 1e-4, I, A, b) - M.fracE(N - 1e-4, I, A, b)) / 2e-4, Nd = lin(-0.995, 0.995, 400);
      plot(cv2, { x: [-1, 1], y: [-I - 4, -A + 4], xl: 'N − N₀', yl: 'dE/dN (eV)', xt: [-1, -0.5, 0, 0.5, 1], series: [{ xs: Nd, ys: Nd.map((N) => (Math.abs(N) < 0.003 ? NaN : d(N, 0))), color: c.ink2, width: 2 }, { xs: Nd, ys: Nd.map((N) => (Math.abs(N) < 0.003 ? NaN : d(N, s.b))), color: c.gold, width: 2.6 }], hmarks: [{ y: -I, color: c.danger }, { y: -A, color: c.info }] });
      return [['I / A', `${fix(I, 3)} / ${fix(A, 3)} eV`], ['ε_HOMO', `${fix(sl.homo, 2)} eV ${L('（应为', '(should be')} ${fix(-I, 2)}）`], ['ε_LUMO', `${fix(sl.lumo, 2)} eV`], [L('基本能隙 I − A', 'Fundamental gap I − A'), `${fix(sl.gapExact, 2)} eV`], [L('近似的能隙 ε_LUMO − ε_HOMO', 'Approximate gap ε_LUMO − ε_HOMO'), `${fix(sl.gapApprox, 2)} eV`, true], [L('N₀ ± ½ 处的误差', 'Error at N₀ ± ½'), `${fix(-s.b / 4, 2)} eV`]];
    },
  };

  // ── 7. 色散校正 ────────────────────────────────────────────────────
  const REP = memo(() => M.toyRepulsion((R) => M.dispBJ8(R, M.AR.C6, M.AR.R0, M.AR.a1, M.AR.a2, 1)));
  DEMOS.disp = {
    title: L('半局域泛函看不见色散：给它补上 −C₆/R⁶', 'Semilocal functionals miss dispersion: add −C₆/R⁶'), kind: 'toy',
    intro: L('两个氩原子之间几乎只有色散吸引（瞬时偶极–诱导偶极），它来自相距很远的两团电子之间的关联，而 LDA 和 GGA 只看每一点附近的密度，看不见它。灰线是一条只有排斥的“半局域泛函”曲线：没有极小，氩二聚体不结合。补上 −C₆/R⁶ 就有了极小，但 R 小的地方它会发散，所以要乘一个阻尼函数：零阻尼（D3 的原始形式）在短程把色散压到零，Becke–Johnson 阻尼让它趋于一个常数。', 'Between two argon atoms there is almost nothing but dispersion (instantaneous dipole–induced dipole), which comes from correlation between two distant electron clouds; LDA and GGA only look at the density near each point and cannot see it. The grey curve is a purely repulsive “semilocal functional”: no minimum, so the argon dimer does not bind. Adding −C₆/R⁶ creates a minimum, but it diverges at small R, so it is multiplied by a damping function: zero damping (the original D3 form) drives dispersion to zero at short range, while Becke–Johnson damping lets it level off to a constant.'),
    ctl: [['s8', L('C₈ 项的比例 s₈', 'Weight of the C₈ term s₈'), 0, 1.5, 0.05, 1, (v) => fix(v, 2)], ['a2', L('BJ 阻尼半径 a₂（Å）', 'BJ damping radius a₂ (Å)'), 0.5, 3, 0.05, 1.6, (v) => fix(v, 2)]],
    chk: [['zero', L('也画零阻尼（只有 C₆）', 'Also show zero damping (C₆ only)'), true]],
    figs: [[0.6, L('Ar₂ 的相互作用能（kcal/mol）。红点是实验的平衡距离和结合能。', 'Ar₂ interaction energy (kcal/mol). The red dot is the experimental equilibrium distance and binding energy.')], [0.42, L('只看色散项本身：裸的 −C₆/R⁶ 在短程发散，阻尼把它收住。', 'The dispersion term alone: bare −C₆/R⁶ diverges at short range and damping tames it.')]],
    note: L('C₆(Ar–Ar) = 64.3 a.u.；C₈ 按 D3 的约定取 C₆R₀²，R₀ = 1.9 Å，BJ 的 a₁ = 0.43。排斥曲线 A e^{−bR} 是这里自己定的：A、b 选成让默认设置（s₈ = 1，a₂ = 1.6 Å）的极小正好落在实验值 Re = 3.757 Å、De = 99.55 cm⁻¹ 上。所以“默认设置和实验一致”是搭出来的；有意义的是改变 s₈、a₂ 和阻尼方式之后曲线怎样变。真实的 D3、D4 的 C₆ 随化学环境变化，还有三体项。', 'C₆(Ar–Ar) = 64.3 a.u.; C₈ follows the D3 convention C₆R₀² with R₀ = 1.9 Å, and BJ a₁ = 0.43. The repulsive curve A e^{−bR} is our own choice: A and b are set so that the default settings (s₈ = 1, a₂ = 1.6 Å) put the minimum exactly at the experimental Re = 3.757 Å, De = 99.55 cm⁻¹. So “the default agrees with experiment” is built in; what is meaningful is how the curve changes as you vary s₈, a₂ and the damping. Real D3 and D4 make C₆ depend on the chemical environment and add three-body terms.'),
    draw(s, [cv, cv2], c) {
      const rep = REP(), Rs = lin(2.8, 8, 300), A = M.AR, E0 = (R) => rep.A * Math.exp(-rep.b * R);
      const bj = (R) => E0(R) + M.dispBJ8(R, A.C6, A.R0, A.a1, s.a2, s.s8), z = (R) => E0(R) + M.dispZero(R, A.C6, 3.4, 1.1);
      const m = M.curveMin(bj, 3, 6.5), mz = M.curveMin(z, 3, 6.5);
      plot(cv, { x: [2.8, 8], y: [-0.5, 0.4], xl: 'R (Å)', yl: 'E (kcal/mol)', series: [
        { xs: Rs, ys: Rs.map(E0), color: c.muted, width: 2, label: L('只有排斥', 'Repulsion only') },
        { xs: Rs, ys: Rs.map(bj), color: c.gold, width: 2.6, label: 'D3(BJ)-like' },
        ...(s.zero ? [{ xs: Rs, ys: Rs.map(z), color: c.info, dash: [6, 4], label: L('零阻尼', 'Zero damping') }] : [])],
        hmarks: [{ y: 0, color: c.line, dash: [] }], marks: [{ x: A.Re, y: -A.De, color: c.danger }] });
      const Rd = lin(1.5, 8, 300);
      plot(cv2, { x: [1.5, 8], y: [-2.5, 0.1], xl: 'R (Å)', yl: 'E_disp', series: [
        { xs: Rd, ys: Rd.map((R) => Math.max(-50, M.dispBare(R, A.C6))), color: c.danger, label: '−C₆/R⁶' },
        { xs: Rd, ys: Rd.map((R) => M.dispBJ8(R, A.C6, A.R0, A.a1, s.a2, s.s8)), color: c.gold, width: 2.4, label: 'BJ' },
        { xs: Rd, ys: Rd.map((R) => M.dispZero(R, A.C6, 3.4, 1.1)), color: c.info, dash: [6, 4], label: L('零阻尼', 'Zero') }] });
      return [[L('实验', 'Experiment'), `Re = ${fix(A.Re, 3)} Å · De = ${fix(A.De, 3)} kcal/mol`], ['D3(BJ)-like', `Re = ${fix(m.R, 3)} Å · De = ${fix(-m.E, 3)} kcal/mol`, true], ...(s.zero ? [[L('零阻尼', 'Zero damping'), `Re = ${fix(mz.R, 3)} Å · De = ${fix(-mz.E, 3)} kcal/mol`]] : []), [L('只有排斥', 'Repulsion only'), L('没有极小（不结合）', 'no minimum (unbound)')]];
    },
  };

  // ── 8. 平面波截断 ─────────────────────────────────────────────────
  const SIG = { hard: 0.1, mid: 0.25, soft: 0.5 };
  const pwRef = memo((sg) => M.pwE0(0, 70, { sigma: sg }));
  const pwCurve = memo((sg) => { const ms = Array.from({ length: 30 }, (_, i) => i + 1), ref = pwRef(sg); return ms.map((m) => [M.pwCutoff(m), Math.max(1e-15, M.pwE0(0, m, { sigma: sg }) - ref)]); });
  DEMOS.pwcut = {
    title: L('平面波：截断能和“硬”的势', 'Plane waves: the cutoff energy and “hard” potentials'), kind: 'exact',
    intro: L('周期晶体里的波函数可以用平面波 e^{iGx} 展开，只保留动能低于截断能 E_cut 的那些。基组越大，能量越低（变分原理），而且单调收敛。势越“尖”（原子核附近），需要的平面波越多：这就是为什么平面波程序要用赝势或 PAW 把核附近的尖峰抹平。三种宽度的高斯阱，从“硬”到“软”，比较它们的收敛速度。', 'Wavefunctions in a periodic crystal can be expanded in plane waves e^{iGx}, keeping only those whose kinetic energy is below a cutoff E_cut. The bigger the basis, the lower the energy (the variational principle), and the convergence is monotonic. The sharper the potential (near a nucleus), the more plane waves it needs, which is why plane-wave programs use pseudopotentials or PAW to smooth out the spike near the nucleus. Compare how three Gaussian wells, from “hard” to “soft”, converge.'),
    sel: [['sg', L('势的宽度', 'Width of the well'), [['hard', L('硬：σ = 0.1 bohr', 'Hard: σ = 0.1 bohr')], ['mid', L('中：σ = 0.25 bohr', 'Medium: σ = 0.25 bohr')], ['soft', L('软（像赝势）：σ = 0.5 bohr', 'Soft (pseudopotential-like): σ = 0.5 bohr')]], 'hard']],
    ctl: [['m', L('平面波 |m| ≤', 'Plane waves |m| ≤'), 1, 30, 1, 4, (v) => `${v} (${2 * v + 1} PW)`]],
    figs: [[0.5, L('两个晶胞里的势 V(x)（灰）和当前基组给出的基态波函数（金）。', 'The potential V(x) over two cells (grey) and the ground state from the current basis (gold).')], [0.45, L('能量误差 E(E_cut) − E(∞) 对截断能（Hartree，双对数轴）；实心点是当前的选择。', 'Energy error E(E_cut) − E(∞) against cutoff (hartree, log–log); the filled dot is the current choice.')]],
    note: L('一维晶格，晶格常数 4 bohr，每个格点一个深 2 Hartree 的高斯阱，只算 Γ 点（k = 0）的最低本征值。“精确”值用 141 个平面波。一维里势的傅里叶系数衰减得像 e^{−G²σ²/2}；三维里真实的库仑势 −Z/r 只按 1/G² 衰减，比这里的“硬”还要难收敛得多。', 'A 1D lattice with spacing 4 bohr and a Gaussian well 2 hartree deep at each site; only the lowest eigenvalue at Γ (k = 0). The “exact” value uses 141 plane waves. In 1D the potential’s Fourier coefficients decay like e^{−G²σ²/2}; the real 3D Coulomb potential −Z/r decays only as 1/G² and converges far more slowly than even the “hard” case here.'),
    draw(s, [cv, cv2], c) {
      const sg = SIG[s.sg], xs = lin(-4, 4, 400), V = xs.map((x) => [-4, 0, 4].reduce((acc, x0) => acc - 2 * Math.exp(-((x - x0) ** 2) / (2 * sg * sg)), 0)), psi = M.pwPsi(s.m, { sigma: sg }, xs);
      plot(cv, { x: [-4, 4], y: [-2.2, 1.4], xl: 'x (bohr)', yt: [], series: [{ xs, ys: V, color: c.muted, width: 1.8, label: 'V(x)' }, { xs, ys: psi.map((v) => 0.9 * v), color: c.gold, width: 2.4, label: 'ψ₀(x)' }] });
      const curves = Object.entries(SIG).map(([k, v]) => [k, pwCurve(v)]), cols = { hard: c.danger, mid: c.info, soft: c.ok }, cur = pwCurve(sg)[s.m - 1];
      plot(cv2, { x: [-1, Math.log10(M.pwCutoff(30)) + 0.1], y: [-14, 0.5], logx: true, logy: true, xl: 'E_cut (Eh)', yl: 'ΔE (Eh)', series: [...curves.map(([k, pts]) => ({ pts, color: cols[k], dots: 2.5, line: true, width: k === s.sg ? 2.6 : 1.4, label: k === 'hard' ? L('硬', 'hard') : k === 'mid' ? L('中', 'medium') : L('软', 'soft') })), { pts: [cur], color: c.gold, dots: 6 }] });
      const E = M.pwE0(0, s.m, { sigma: sg });
      return [[L('平面波个数', 'Number of plane waves'), `${2 * s.m + 1}`], ['E_cut', `${fix(M.pwCutoff(s.m), 2)} Eh = ${fix(2 * M.pwCutoff(s.m), 2)} Ry`], [L('基态能量', 'Ground-state energy'), `${fix(E, 8)} Eh`], [L('误差', 'Error'), `${sci(E - pwRef(sg), 2)} Eh`, true]];
    },
  };

  // ── 9. k 点 ────────────────────────────────────────────────────────
  DEMOS.kpts = {
    title: L('k 点：绝缘体收敛得快，金属收敛得慢', 'k-points: insulators converge fast, metals slowly'), kind: 'exact',
    intro: L('晶体的总能量要对布里渊区里所有 k 求平均，程序只能取有限个 k 点（Monkhorst–Pack 网格）。绝缘体的被占带是光滑的周期函数，误差随 k 点数指数下降；金属的费米面把被占区域切出一个台阶，误差下降得慢，而且忽上忽下。给占据数加一点“展宽”（这里用 Fermi–Dirac 分布）能让金属收敛得快，代价是收敛到一个略有偏差的值。', 'A crystal’s total energy is an average over every k in the Brillouin zone, and programs can only take a finite set of k-points (a Monkhorst–Pack grid). In an insulator the occupied bands are smooth periodic functions and the error falls exponentially with the number of k-points; in a metal the Fermi surface cuts a step into the occupied region, so the error falls slowly and jumps up and down. Adding some “smearing” to the occupations (Fermi–Dirac here) helps a metal converge faster, at the price of converging to a slightly biased value.'),
    sel: [['kind', L('材料', 'Material'), [['metal', L('金属：单带半满', 'Metal: half-filled single band')], ['insulator', L('绝缘体：二聚化的链，下带全满', 'Insulator: dimerised chain, lower band full')]], 'metal']],
    ctl: [['nk', L('k 点数', 'Number of k-points'), 1, 64, 1, 8, (v) => String(v)], ['sm', L('展宽 σ（t）', 'Smearing σ (t)'), 0, 0.3, 0.01, 0, (v) => fix(v, 2)]],
    figs: [[0.5, L('能带和取到的 k 点（点）；阴影是被占的部分。', 'The band(s) and the sampled k-points (dots); shading marks what is occupied.')], [0.45, L('每个格点带能的误差对 k 点数（双对数轴）。', 'Error in band energy per site against the number of k-points (log–log).')]],
    note: L('一维紧束缚：金属 ε(k) = −2t cos k，精确的带能 −4t/π；绝缘体是交替跳跃 t₁ = 1、t₂ = 0.6 的链，“精确”值用两万个点的积分。展宽时化学势由电子–空穴对称固定在 0。三维里四面体法和 Methfessel–Paxton 展宽是常用的替代办法。', '1D tight binding: the metal has ε(k) = −2t cos k with exact band energy −4t/π; the insulator alternates hoppings t₁ = 1 and t₂ = 0.6, with the “exact” value from a 20 000-point integral. With smearing, particle–hole symmetry fixes the chemical potential at 0. In 3D the tetrahedron method and Methfessel–Paxton smearing are common alternatives.'),
    draw(s, [cv, cv2], c) {
      const ks = lin(-Math.PI, Math.PI, 300), mp = Array.from({ length: s.nk }, (_, j) => ((2 * (j + 1) - s.nk - 1) * Math.PI) / s.nk);
      const met = s.kind === 'metal', band = (k) => (met ? -2 * Math.cos(k) : -Math.hypot(1 + 0.6 * Math.cos(k), 0.6 * Math.sin(k)));
      const up = (k) => Math.hypot(1 + 0.6 * Math.cos(k), 0.6 * Math.sin(k));
      plot(cv, { x: [-Math.PI, Math.PI], y: [-2.3, 2.3], xl: 'k', yl: 'ε / t', xt: [-3, -2, -1, 0, 1, 2, 3], series: [
        { xs: ks, ys: ks.map((k) => (met ? (band(k) < 0 ? band(k) : NaN) : band(k))), color: c.gold, width: 0.1, fill: true, alpha: 0.9 },
        { xs: ks, ys: ks.map(band), color: c.accent, width: 2.4 }, ...(met ? [] : [{ xs: ks, ys: ks.map(up), color: c.muted, width: 2 }]),
        { xs: mp, ys: mp.map(band), color: c.danger, dots: 4 }], hmarks: [{ y: 0, color: c.line }] });
      const ex = M.bandExact(s.kind), ns = Array.from({ length: 64 }, (_, i) => i + 1);
      plot(cv2, { x: [0, Math.log10(64) + 0.05], y: [-15, 0.5], logx: true, logy: true, xl: L('k 点数', 'k-points'), yl: '|ΔE|', series: [
        { pts: ns.map((n) => [n, Math.max(1e-15, Math.abs(M.bandEnergy(s.kind, n, s.sm) - ex))]), color: met ? c.danger : c.ok, dots: 2.2, line: true },
        { pts: [[s.nk, Math.max(1e-15, Math.abs(M.bandEnergy(s.kind, s.nk, s.sm) - ex))]], color: c.gold, dots: 6 }] });
      const E = M.bandEnergy(s.kind, s.nk, s.sm);
      return [[L('带能（每个格点）', 'Band energy per site'), `${fix(E, 8)} t`], [L('精确值', 'Exact'), `${fix(ex, 8)} t`], [L('误差', 'Error'), `${sci(E - ex, 2)} t`, true]];
    },
  };

  // ── 10. 状态方程 ──────────────────────────────────────────────────
  const MAT = { si: ['Si', 20.02, 98, 4.2], al: ['Al', 16.6, 76, 4.7], cu: ['Cu', 11.81, 140, 5.0], c: [L('金刚石', 'Diamond'), 5.67, 443, 3.7] };
  DEMOS.eos = {
    title: L('从 E(V) 读出体积模量：Birch–Murnaghan 状态方程', 'Reading the bulk modulus from E(V): the Birch–Murnaghan equation of state'), kind: 'toy',
    intro: L('固体计算最常见的第一步：在平衡体积附近取七个体积，每个算一次总能量，用状态方程拟合，读出平衡体积 V₀、体积模量 B₀ 和它对压力的导数 B₀′。三阶 Birch–Murnaghan 方程恰好是 V^{−2/3} 的三次多项式，所以拟合只是线性最小二乘。这里的“计算”是真实曲线加上一点随机噪声（模拟不够严的 k 点或截断），看看噪声多大时 B₀′ 先坏掉。', 'The most common first step in a solid-state calculation: take seven volumes around equilibrium, compute a total energy for each, fit an equation of state and read off the equilibrium volume V₀, bulk modulus B₀ and its pressure derivative B₀′. The third-order Birch–Murnaghan equation is exactly a cubic polynomial in V^{−2/3}, so the fit is plain linear least squares. The “calculations” here are the true curve plus a little random noise (mimicking loose k-points or cutoffs); see how much noise it takes before B₀′ falls apart.'),
    sel: [['mat', L('材料（接近实验值的示意参数）', 'Material (illustrative, near experiment)'), Object.keys(MAT).map((k) => [k, MAT[k][0]]), 'si']],
    ctl: [['noise', L('噪声（meV/原子）', 'Noise (meV/atom)'), 0, 10, 0.1, 1, (v) => fix(v, 1)], ['span', L('体积范围 ±%', 'Volume range ±%'), 2, 15, 0.5, 6, (v) => fix(v, 1)]],
    act: [[L('换一组噪声', 'New noise'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: { seed: 1 },
    figs: [[0.5, L('E(V)：点是“计算”，金线是拟合，灰虚线是真实曲线。', 'E(V): dots are the “calculations”, gold the fit, grey dashes the true curve.')], [0.42, L('由拟合得到的压力 P(V) = −dE/dV（GPa）。', 'Pressure P(V) = −dE/dV from the fit (GPa).')]],
    note: L('每原子的 V₀（Å³）、B₀（GPa）、B₀′ 是接近实验值的示意参数，不是某一篇论文的数字。真实的 PBE 一般把晶格常数算大约 1%，B₀ 算小；LDA 相反。噪声是可重复的伪随机高斯噪声。', 'V₀ per atom (Å³), B₀ (GPa) and B₀′ are illustrative values near experiment, not numbers from any single paper. Real PBE typically overestimates lattice constants by about 1% and underestimates B₀; LDA does the opposite. The noise is reproducible pseudo-random Gaussian noise.'),
    draw(s, [cv, cv2], c) {
      const [, V0, B0, Bp] = MAT[s.mat], r = M.rng(s.seed * 7919 + 13), Vs = lin(V0 * (1 - s.span / 100), V0 * (1 + s.span / 100), 7);
      const Es = Vs.map((v) => M.bmE(v, V0, B0, Bp) + (s.noise / 1000) * M.gauss(r)), f = M.bmFit(Vs, Es), vv = lin(V0 * 0.8, V0 * 1.2, 200);
      const E = vv.map((v) => M.bmE(v, V0, B0, Bp));
      plot(cv, { x: [V0 * 0.8, V0 * 1.2], y: [Math.min(...Es, 0) - 0.01, Math.max(...E.filter((_, i) => vv[i] >= Vs[0] * 0.97 && vv[i] <= Vs[6] * 1.03)) * 1.3 + 0.01], xl: 'V (Å³/atom)', yl: 'E (eV)', series: [{ xs: vv, ys: E, color: c.muted, dash: [5, 4] }, ...(f ? [{ xs: vv, ys: vv.map(f.E), color: c.gold, width: 2.4 }] : []), { xs: Vs, ys: Es, color: c.danger, dots: 4.5 }] });
      const dE = (v) => (f ? -(f.E(v * 1.0005) - f.E(v * 0.9995)) / (v * 0.001) * M.GPA : NaN);
      plot(cv2, { x: [V0 * 0.8, V0 * 1.2], y: [-B0 * 0.25, B0 * 0.45], xl: 'V (Å³/atom)', yl: 'P (GPa)', series: [{ xs: vv, ys: vv.map((v) => M.bmP(v, V0, B0, Bp)), color: c.muted, dash: [5, 4] }, { xs: vv, ys: vv.map(dE), color: c.gold, width: 2.4 }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      if (!f) return [[L('拟合', 'Fit'), L('失败', 'failed')]];
      return [['V₀', `${fix(f.V0, 3)} Å³ (${L('真', 'true')} ${fix(V0, 2)})`], ['B₀', `${fix(f.B0, 1)} GPa (${L('真', 'true')} ${B0})`, true], ['B₀′', `${fix(f.Bp, 2)} (${L('真', 'true')} ${fix(Bp, 1)})`]];
    },
  };

  // ── 11. TDDFT：两能级模型和电荷转移 ─────────────────────────────────
  DEMOS.casida = {
    title: L('线性响应 TDDFT：激发能从轨道能差移开多少', 'Linear-response TDDFT: how far excitations move from orbital gaps'), kind: 'toy',
    intro: L('左图：只有一个占据轨道和一个空轨道时，Casida 方程化成一个公式。单态激发被 Hartree 项（2K_H）推高，三态只受交换关联核影响，所以三态比单态低；Tamm–Dancoff 近似丢掉退激发，结果略高。右图：给体和受体相距 R 时的电荷转移激发。真实的能量应该是 IP − EA − 1/R（分开的正负电荷互相吸引）。半局域泛函里两个轨道不重叠，核函数的贡献是零，激发能就是轨道能差：既太低，又不随 R 变化。长程混入精确交换（如 CAM-B3LYP、ωB97X）才把 −1/R 找回来。', 'Left: with one occupied and one empty orbital, Casida’s equation reduces to a single formula. The singlet is pushed up by the Hartree term (2K_H); the triplet feels only the exchange–correlation kernel and lies lower; the Tamm–Dancoff approximation drops de-excitations and comes out slightly higher. Right: a charge-transfer excitation between a donor and an acceptor a distance R apart. The true energy should be IP − EA − 1/R (the separated charges attract). In a semilocal functional the two orbitals do not overlap, the kernel contributes nothing, and the excitation energy is just the orbital gap: too low, and independent of R. Only long-range exact exchange (CAM-B3LYP, ωB97X and the like) restores the −1/R.'),
    ctl: [['d', L('轨道能差 Δε（eV）', 'Orbital gap Δε (eV)'), 1, 10, 0.1, 5, (v) => fix(v, 1)], ['kh', L('Hartree 耦合 K_H（eV）', 'Hartree coupling K_H (eV)'), 0, 1.5, 0.02, 0.5, (v) => fix(v, 2)], ['kx', L('交换关联核 K_xc↑↑（eV）', 'XC kernel K_xc↑↑ (eV)'), -1.5, 0, 0.02, -0.4, (v) => fix(v, 2)], ['alpha', L('长程精确交换比例 α', 'Long-range exact exchange α'), 0, 1, 0.05, 0, (v) => fix(v, 2)]],
    btn: [[L('半局域（α = 0）', 'Semilocal (α = 0)'), { alpha: 0 }], [L('长程校正（α = 1）', 'Range-separated (α = 1)'), { alpha: 1 }]],
    figs: [[0.55, L('能级：Δε、单态和三态激发（实线是完整的 Casida，虚线是 Tamm–Dancoff）。', 'Levels: Δε and the singlet and triplet excitations (solid full Casida, dashed Tamm–Dancoff).')], [0.5, L('电荷转移激发能对给受体距离 R（eV）：灰色是精确的渐近形式，金色是当前的泛函。', 'Charge-transfer excitation against donor–acceptor distance R (eV): grey is the exact asymptotic form, gold the current functional.')]],
    note: L('两能级模型：K_xc↑↓ 取 K_xc↑↑ 的一半（只为了让单态和三态分开），单位都是 eV。电荷转移部分是玩具：IP = 9 eV、EA = 1 eV，半局域泛函的轨道能差比 IP − EA 低 3 eV，混入 α 的长程交换时这个误差按 (1 − α) 缩小，同时加回 −α/R。真实分子的数字见 Dreuw 等（2003）。', 'Two-level model: K_xc↑↓ is taken as half of K_xc↑↑ (only to separate singlet and triplet), all in eV. The charge-transfer part is a toy: IP = 9 eV, EA = 1 eV, the semilocal orbital gap is 3 eV below IP − EA, and mixing in a fraction α of long-range exchange shrinks that error by (1 − α) while restoring −α/R. For real molecules see Dreuw et al. (2003).'),
    draw(s, [cv, cv2], c) {
      const r = M.casida(s.d, s.kh, s.kx, s.kx / 2), top = Math.max(s.d, r.S, r.TDA_S) + 1, bot = Math.min(s.d, r.T, r.TDA_T) - 1;
      const lvl = (x0, x1, y, color, dash) => ({ xs: [x0, x1], ys: [y, y], color, width: 3, dash });
      plot(cv, { x: [0, 3], y: [Math.max(0, bot), top], xt: [], yl: 'eV', series: [lvl(0.2, 0.9, s.d, c.ink2), lvl(1.1, 1.8, r.S, c.gold), lvl(1.1, 1.8, r.TDA_S, c.gold, [5, 4]), lvl(2.1, 2.8, r.T, c.info), lvl(2.1, 2.8, r.TDA_T, c.info, [5, 4])],
        texts: [{ s: 'Δε', x: 0.55, y: s.d, dy: -8, align: 'center' }, { s: L('单态', 'Singlet'), x: 1.45, y: Math.max(r.S, r.TDA_S), dy: -8, align: 'center' }, { s: L('三态', 'Triplet'), x: 2.45, y: Math.min(r.T, r.TDA_T), dy: 16, align: 'center' }] });
      const Rs = lin(3, 20, 200), ct = Rs.map((R) => M.ctEnergy(R, 9, 1, 3, s.alpha));
      plot(cv2, { x: [3, 20], y: [3.5, 8.5], xl: 'R (Å)', yl: 'ω_CT (eV)', series: [{ xs: Rs, ys: ct.map((q) => q.exact), color: c.muted, width: 2.2, label: 'IP − EA − 1/R' }, { xs: Rs, ys: ct.map((q) => q.dfa), color: c.gold, width: 2.6, label: `α = ${fix(s.alpha, 2)}` }] });
      const at = M.ctEnergy(10, 9, 1, 3, s.alpha);
      return [[L('单态 ω_S', 'Singlet ω_S'), `${fix(r.S, 3)} eV (TDA ${fix(r.TDA_S, 3)})`, true], [L('三态 ω_T', 'Triplet ω_T'), `${fix(r.T, 3)} eV (TDA ${fix(r.TDA_T, 3)})`], [L('单态—三态分裂', 'Singlet–triplet splitting'), `${fix(r.S - r.T, 3)} eV`], [L('R = 10 Å 的电荷转移', 'Charge transfer at R = 10 Å'), `${fix(at.dfa, 2)} eV (${L('应为', 'should be')} ${fix(at.exact, 2)})`]];
    },
  };

  // ── 12. 积分格点 ──────────────────────────────────────────────────
  const hCurve = memo(() => Array.from({ length: 30 }, (_, i) => { const n = 2 * i + 4, r = M.hAtomGrid(n); return [n, Math.abs(r.errN), Math.abs(r.errEx)]; }));
  const h2Curve = memo((nth) => [4, 6, 8, 10, 14, 18, 24, 30, 40].map((n) => [n, Math.abs(M.h2Grid(n, nth, false).err), Math.abs(M.h2Grid(n, nth, true).err)]));
  DEMOS.grid = {
    title: L('交换关联能要在格点上数值积分', 'The exchange–correlation energy is integrated numerically on a grid'), kind: 'exact',
    intro: L('交换关联泛函一般没有解析积分，程序在每个原子周围放一套径向 × 角度的格点，把被积函数逐点加起来。氢原子是球对称的，只需要径向格点：误差随点数指数下降。分子里两个原子的格点会重叠，Becke 1988 年的办法是给空间每一点一个“属于哪个原子”的光滑权重，把积分拆成几个原子各自的积分。关掉它，只用一个原子的格点去积 H₂ 的密度，误差会大几个数量级。', 'Exchange–correlation functionals rarely have analytic integrals, so programs place a radial × angular grid around every atom and add up the integrand point by point. The hydrogen atom is spherical and needs only radial points; the error falls exponentially with their number. In a molecule the atoms’ grids overlap; Becke’s 1988 solution gives every point in space a smooth weight saying which atom it “belongs” to, splitting the integral into atomic pieces. Turn it off and integrate the density of H₂ with one atom’s grid alone, and the error grows by orders of magnitude.'),
    sel: [['sys', L('体系', 'System'), [['h', L('氢原子（只要径向）', 'Hydrogen atom (radial only)')], ['h2', L('H₂，R = 1.4 bohr', 'H₂, R = 1.4 bohr')]], 'h']],
    ctl: [['nr', L('径向点数', 'Radial points'), 4, 40, 1, 12, (v) => String(v)], ['nth', L('角度：θ 方向点数（H₂）', 'Angular: θ points (H₂)'), 4, 20, 1, 10, (v) => `${v} × ${2 * v}`]],
    chk: [['becke', L('Becke 分割（H₂）', 'Becke partitioning (H₂)'), true]],
    figs: [[0.5, L('积分误差对径向点数（对数轴）。', 'Integration error against the number of radial points (log axis).')], [0.42, L('径向点的位置（Becke 映射，越靠近原子核越密）和被积函数 4πr²n(r)。', 'Where the radial points go (Becke’s mapping, denser near the nucleus) and the integrand 4πr²n(r).')]],
    note: L('径向：Gauss–Chebyshev（第二类）加映射 r = (1 + x)/(1 − x)；角度：θ 方向 Gauss–Legendre、φ 方向等距，没有用 Lebedev 格点。Becke 权重用三次迭代的多项式。氢原子 LSDA 交换能的精确值 −(3/4)(6/π)^{1/3}(27/64)π^{−1/3} ≈ −0.2680 Hartree。', 'Radial: Gauss–Chebyshev (second kind) with the map r = (1 + x)/(1 − x); angular: Gauss–Legendre in θ and equal spacing in φ, not Lebedev grids. Becke weights use the polynomial iterated three times. The exact LSDA exchange energy of hydrogen is −(3/4)(6/π)^{1/3}(27/64)π^{−1/3} ≈ −0.2680 hartree.'),
    draw(s, [cv, cv2], c) {
      let rows;
      if (s.sys === 'h') {
        const cur = hCurve(), r = M.hAtomGrid(s.nr);
        plot(cv, { x: [0, 64], y: [-15, 0.5], logy: true, xl: L('径向点数', 'Radial points'), yl: L('|误差|', '|error|'), series: [{ pts: cur.map((p) => [p[0], Math.max(1e-15, p[1])]), color: c.info, dots: 2.5, line: true, label: '∫n − 1' }, { pts: cur.map((p) => [p[0], Math.max(1e-15, p[2])]), color: c.gold, dots: 2.5, line: true, label: 'E_x^LSDA' }], marks: [{ x: s.nr, color: c.danger }] });
        rows = [['∫n d³r', fix(r.N, 12)], [L('LSDA 交换能', 'LSDA exchange'), `${fix(r.Ex, 10)} Eh`], [L('交换能误差', 'Exchange error'), `${sci(r.errEx, 2)} Eh`, true]];
      } else {
        const cur = h2Curve(s.nth), r = M.h2Grid(s.nr, s.nth, s.becke);
        plot(cv, { x: [0, 42], y: [-12, 0.5], logy: true, xl: L('径向点数', 'Radial points'), yl: '|∫n − 2|', series: [{ pts: cur.map((p) => [p[0], Math.max(1e-15, p[1])]), color: c.danger, dots: 2.5, line: true, label: L('只用一个原子的格点', 'One atom’s grid only') }, { pts: cur.map((p) => [p[0], Math.max(1e-15, p[2])]), color: c.ok, dots: 2.5, line: true, label: L('Becke 分割', 'Becke partitioning') }], marks: [{ x: s.nr, color: c.gold }] });
        rows = [['∫n d³r', fix(r.N, 9)], [L('误差', 'Error'), sci(r.err, 2), true], [L('格点数', 'Grid points'), String(r.pts)]];
      }
      const g = M.radialGrid(s.nr, 1).filter((p) => p[0] < 8), rr = lin(0, 8, 200);
      plot(cv2, { x: [0, 8], y: [0, 1.15], xl: 'r (bohr)', yt: [], series: [{ xs: rr, ys: rr.map((r) => 4 * r * r * Math.exp(-2 * r) / 0.5413), color: c.gold, width: 2.2, fill: true, label: '4πr²n(r)' }, { xs: g.map((p) => p[0]), ys: g.map(() => 0.05), color: c.danger, sticks: true, width: 1.5 }] });
      return rows;
    },
  };
};
