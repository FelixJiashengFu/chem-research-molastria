'use strict';
// 前沿 AI 数学 · 演示 30–44 和附录 K、L（决策与推理、学习理论与科学 AI、前沿与综合）。写法见 aim-demos-a.js 开头的说明。
(window.MOLASTRIA_AIM_DEMOS ||= []).push((K, D) => {
  const { M, L, tx, fmt, pct, plot, heat, lin, box, row, esc, href, label, byId } = K;
  const f2 = (v) => v.toFixed(2), int = (v) => String(Math.round(v));
  const tlink = (id) => `<a href="${href(id)}" data-open="${id}">${esc(`${label(id)} · ${tx(byId[id].title)}`)}</a>`;

  // ── 30 MDP 与 Bellman 递推 ──────────────────────────────────────────────
  D['30'] = {
    title: ['一条 8 格的链：价值从终点一格一格传回来', 'A chain of 8 states: value propagates back from the goal one state at a time'],
    ctl: [['k', ['Bellman 备份的轮数', 'Sweeps of Bellman backups'], 0, 40, 1, 4, int], ['gam', ['折扣 γ', 'Discount γ'], 0.5, 0.99, 0.01, 0.9, f2], ['slip', ['走反的概率', 'Probability of slipping'], 0, 0.45, 0.01, 0.1, f2]],
    play: 'k',
    figs: [[0.4, ['每个状态的价值 V(s)。最右边是终点（到达得 1 分并结束）；每格的动作是向左或向右。', 'The value V(s) of each state. The rightmost state is the goal (reaching it pays 1 and ends the episode); the action in each state is left or right.']], [0.38, ['相邻两轮价值的最大变化（对数纵轴）和压缩界 γᵏ（虚线）。', 'The largest change in value between consecutive sweeps (logarithmic axis) and the contraction bound γᵏ (dashed).']]],
    note: ['这是一个能写全的小 MDP：状态 1–8，动作左 / 右，以“走反的概率”滑向相反方向，到达第 8 格得 1 分并终止，其余奖励为 0。每一轮对所有状态做一次最优 Bellman 备份 V(s) ← maxₐ E[r + γV(s′)]。γ < 1、奖励有界时这个算子是 γ-压缩，所以变化量被 γᵏ 压住。把“状态”换成当前前缀、“动作”换成下一个 token，就是语言生成的那个特例；真实任务的状态空间大到不能这样列表。', 'A small MDP that can be written out in full: states 1–8, actions left / right, a slip to the opposite direction with the given probability, a reward of 1 and termination on reaching state 8, and zero reward elsewhere. Each sweep applies one optimal Bellman backup V(s) ← maxₐ E[r + γV(s′)] to every state. With γ < 1 and bounded rewards the operator is a γ-contraction, so the change is bounded by γᵏ. Replace the state by the current prefix and the action by the next token and this is the special case of language generation; real tasks have state spaces far too large to tabulate.'],
    draw(s, f, c) {
      const k = Math.round(s.k), r = M.valueIteration(8, s.gam, Math.max(k, 1), s.slip), V = r.hist[k], xs = V.map((_, i) => i + 1), pol = M.chainBackup(V, s.gam, s.slip).policy;
      plot(f[0], { x: [0.3, 8.7], y: [0, 1.12], xt: xs, xl: L('状态', 'state'), yl: 'V', series: [{ xs: xs.slice(0, 7), ys: V.slice(0, 7), color: c.accent, bars: 0.7 }, { xs: [8], ys: [1], color: c.gold, bars: 0.7, alpha: 0.5 }], texts: [...V.slice(0, 7).map((v, i) => ({ x: i + 1, y: v, s: `${v.toFixed(2)} ${k ? (pol[i] ? '›' : '‹') : ''}`, align: 'center', dy: -6 })), { x: 8, y: 1, s: L('终点', 'goal'), align: 'center', dy: -6, color: c.gold }] });
      const all = M.valueIteration(8, s.gam, 40, s.slip).gaps, lg = (v) => Math.log10(Math.max(1e-16, v)), ks = all.map((_, i) => i + 1);
      plot(f[1], { x: [0, 40], y: [-8, 0.5], xl: L('轮数 k', 'sweep k'), yl: 'max |Vₖ − Vₖ₋₁|', yt: [-8, -6, -4, -2, 0], yf: K.pow, series: [{ xs: ks, ys: all.map(lg), color: c.accent, label: L('实际变化', 'actual change') }, { xs: ks, ys: ks.map((q) => (q - 1) * Math.log10(s.gam)), color: c.gold, dash: [5, 4], label: 'γᵏ⁻¹' }], marks: k ? [{ x: k, color: c.muted }] : [] });
      return [[['起点 V(1)', 'Value at the start, V(1)'], fmt(V[0], 4), 1], [['这一轮的最大变化', 'Largest change in this sweep'], k ? fmt(all[k - 1], 3) : '—'], [['收敛后的 V(1)', 'V(1) at convergence'], fmt(M.valueIteration(8, s.gam, 400, s.slip).V[0], 4)], [['价值已经传到第几格', 'Leftmost state the value has reached'], String(V.findIndex((v) => v > 0) + 1 || '—')]];
    },
  };

  // ── 31 策略梯度与基线 ───────────────────────────────────────────────────
  D['31'] = {
    title: ['基线不改期望，只改方差', 'A baseline leaves the expectation alone and changes only the variance'],
    ctl: [['p', ['选动作 1 的概率 p', 'Probability p of action 1'], 0.05, 0.95, 0.01, 0.3, f2], ['b', ['基线 b', 'Baseline b'], -0.5, 1.5, 0.01, 0, f2], ['G', ['附录 H：组的大小 G', 'Appendix H: group size G'], 2, 10, 1, 4, int]],
    btn: [[['没有基线', 'No baseline'], { b: 0 }], [['最优基线 b = 1 − p', 'Optimal baseline b = 1 − p'], { p: 0.3, b: 0.7 }], [['讲义的例子 p = 0.3，G = 4', 'The notes’ example, p = 0.3, G = 4'], { p: 0.3, G: 4 }]],
    figs: [[0.42, ['单样本梯度估计 (a − p)(r − b) 的方差随基线 b 的变化。期望（读数第一行）不随 b 变。', 'The variance of the single-sample gradient estimate (a − p)(r − b) against the baseline b. The expectation (first row of the read-out) does not depend on b.']], [0.4, ['附录 H：三种估计量的期望。用含自身的组均值当基线，期望被缩成 (1 − 1/G) 倍；留一法基线恢复无偏。', 'Appendix H: the expectations of three estimators. A group mean that includes the sample itself as baseline shrinks the expectation by (1 − 1/G); a leave-one-out baseline restores unbiasedness.']]],
    note: ['伯努利 bandit：动作 a ∈ {0, 1}，选 1 的概率 p = σ(θ)，奖励 r = a，所以 J = p，真梯度 dJ/dθ = p(1 − p)，score 是 a − p。全部是精确枚举，没有抽样。这个特例里最优的常数基线是 1 − p，它让方差降到 0；一般情形下基线只能降低方差，不能消掉。下图对 G 个独立动作枚举全部 2^G 种组合：p = 0.3、G = 4 时含自身的组均值给出 0.1575 = 0.75 × 0.21，和讲义的核验记录一致。再除以随机的组标准差（GRPO 的做法）之后，就不再只差一个常数了。', 'A Bernoulli bandit: action a ∈ {0, 1}, with probability p = σ(θ) of choosing 1 and reward r = a, so J = p, the true gradient is dJ/dθ = p(1 − p) and the score is a − p. Everything is exact enumeration with no sampling. In this special case the optimal constant baseline is 1 − p and brings the variance to 0; in general a baseline can only lower the variance, not remove it. The lower figure enumerates all 2^G combinations of G independent actions: at p = 0.3 and G = 4 the self-including group mean gives 0.1575 = 0.75 × 0.21, in agreement with the notes’ record. After a further division by the random group standard deviation (as GRPO does), the difference is no longer just a constant.'],
    draw(s, f, c) {
      const st = M.banditStats(s.p, s.b), bs = lin(-0.5, 1.5, 201), vs = bs.map((b) => M.banditStats(s.p, b).variance);
      plot(f[0], { x: [-0.5, 1.5], y: [0, Math.max(...vs) * 1.08], xl: L('基线 b', 'baseline b'), yl: L('方差', 'variance'), series: [{ xs: bs, ys: vs, color: c.accent }], marks: [{ x: st.bestBaseline, y: 0, color: c.ok }, { x: s.b, y: st.variance, color: c.gold }] });
      const g = [st.trueGrad, M.groupMeanGradient(s.p, s.G), M.groupMeanGradient(s.p, s.G, true)];
      plot(f[1], { x: [0.4, 3.6], y: [0, 0.28], xt: [1, 2, 3], xf: (t) => [L('真梯度', 'true gradient'), L('含自身的组均值', 'group mean incl. self'), L('留一法', 'leave-one-out')][t - 1], series: [{ xs: [1, 3], ys: [g[0], g[2]], color: c.accent, bars: 0.6 }, { xs: [2], ys: [g[1]], color: c.danger, bars: 0.6 }], texts: g.map((v, i) => ({ x: i + 1, y: v, s: v.toFixed(4), align: 'center', dy: -6 })), hmarks: [{ y: g[0], color: c.gold }] });
      return [[['估计量的期望（= 真梯度 p(1−p)）', 'Expectation of the estimator (= true gradient p(1−p))'], `${fmt(st.mean, 5)} = ${fmt(st.trueGrad, 5)}`, 1], [['估计量的方差', 'Variance of the estimator'], fmt(st.variance, 4), 1], [['最优常数基线 1 − p', 'Optimal constant baseline 1 − p'], fmt(st.bestBaseline)], [[`含自身的组均值：(1 − 1/${s.G})·p(1−p)`, `Group mean incl. self: (1 − 1/${s.G})·p(1−p)`], fmt(g[1], 5)], [['留一法基线', 'Leave-one-out baseline'], fmt(g[2], 5)]];
    },
  };

  // ── 32 PPO、GRPO ────────────────────────────────────────────────────────
  D['32'] = {
    title: ['裁剪的代理目标，和一组回答的相对优势', 'The clipped surrogate, and the relative advantages within a group of answers'],
    ctl: [['eps', ['裁剪半径 ε', 'Clipping radius ε'], 0.05, 0.5, 0.01, 0.2, f2], ['A', ['上图：这个样本的优势 A', 'Upper figure: advantage A of this sample'], -2, 2, 0.05, 1, f2]],
    chk: [['r0', ['回答 1 答对', 'Answer 1 correct'], true], ['r1', ['回答 2 答对', 'Answer 2 correct'], true], ['r2', ['回答 3 答对', 'Answer 3 correct'], false], ['r3', ['回答 4 答对', 'Answer 4 correct'], false]],
    btn: [[['优势为正', 'Positive advantage'], { A: 1 }], [['优势为负', 'Negative advantage'], { A: -1 }], [['全组都答对', 'The whole group correct'], { r0: true, r1: true, r2: true, r3: true }]],
    figs: [[0.42, ['单个样本的代理目标随概率比 ρ = π_新/π_旧 的变化：未裁剪的 ρA（虚线）和 PPO 的 min(ρA, clip(ρ)A)（实线）。', 'The surrogate objective of one sample against the probability ratio ρ = π_new/π_old: the unclipped ρA (dashed) and PPO’s min(ρA, clip(ρ)A) (solid).']], [0.38, ['四个回答的组内优势 (rᵢ − 均值)/标准差（总体标准差）。', 'Within-group advantages (rᵢ − mean)/std of four answers (population standard deviation).']]],
    note: ['上图：优势为正时，概率比超过 1 + ε 之后目标不再增加，所以没有动力把这个动作的概率推得更高；优势为负时，概率比低于 1 − ε 之后同样被截平。裁剪限制的是每个样本对目标的贡献，并不保证新旧策略的 KL 有严格上界。下图是讲义里可以手算的例子：奖励 [1, 1, 0, 0] 给出优势 [1, 1, −1, −1]；全组奖励相同时优势全为 0，这组样本不提供区分好坏的信号。这只是 GRPO [24] 优势的核心，完整算法还有 token 级的概率比、长度归一化和 KL 惩罚。', 'Upper figure: with a positive advantage the objective stops growing once the ratio exceeds 1 + ε, so nothing pushes the probability of that action higher; with a negative advantage it is flattened likewise below 1 − ε. Clipping limits each sample’s contribution to the objective and does not guarantee a strict bound on the KL between old and new policies. The lower figure is the hand-computable example of the notes: rewards [1, 1, 0, 0] give advantages [1, 1, −1, −1]; when the whole group has the same reward the advantages are all 0 and the group offers no signal telling good from bad. This is only the core of GRPO’s advantage [24]; the full algorithm also has token-level ratios, length normalisation and a KL penalty.'],
    draw(s, f, c) {
      const rs = lin(0, 2, 201), cl = rs.map((r) => M.ppoClip(r, s.A, s.eps)), lim = Math.max(0.5, Math.abs(s.A) * 2.05);
      plot(f[0], { x: [0, 2], y: [-lim, lim], xl: 'ρ', yl: L('代理目标', 'surrogate'), series: [{ xs: rs, ys: rs.map((r) => r * s.A), color: c.muted, dash: [5, 4], label: 'ρA' }, { xs: rs, ys: cl, color: c.accent, width: 2.6, label: L('裁剪后', 'clipped') }], marks: [{ x: 1 - s.eps, color: c.gold }, { x: 1 + s.eps, color: c.gold }], hmarks: [{ y: 0, color: c.faint }] });
      const rw = [s.r0, s.r1, s.r2, s.r3].map(Number), adv = M.groupAdvantage(rw), mean = rw.reduce((a, b) => a + b, 0) / 4, sd = Math.sqrt(rw.reduce((a, b) => a + (b - mean) ** 2, 0) / 4);
      plot(f[1], { x: [0.4, 4.6], y: [-2, 2], xt: [1, 2, 3, 4], xf: (t) => `${L('回答', 'answer')} ${t}`, yl: 'Aᵢ', series: [{ xs: [1, 2, 3, 4].filter((_, i) => adv[i] >= 0), ys: adv.filter((v) => v >= 0), color: c.accent, bars: 0.6 }, { xs: [1, 2, 3, 4].filter((_, i) => adv[i] < 0), ys: adv.filter((v) => v < 0), color: c.danger, bars: 0.6 }], hmarks: [{ y: 0, color: c.muted }] });
      return [[['裁剪区间', 'Clipping interval'], `[${fmt(1 - s.eps)}, ${fmt(1 + s.eps)}]`], [['奖励', 'Rewards'], `[${rw.join(', ')}]`], [['组均值 / 总体标准差', 'Group mean / population std'], `${fmt(mean)} / ${fmt(sd)}`], [['组内优势', 'Group advantages'], sd === 0 ? L('全为 0：这一组没有信号', 'all 0: no signal from this group') : `[${adv.map((v) => fmt(v)).join(', ')}]`, 1]];
    },
  };

  // ── 33 KL 正则控制与 DPO ────────────────────────────────────────────────
  const REF = [0.5, 0.3, 0.2];
  D['33'] = {
    title: ['指数倾斜：奖励和参考策略怎么折中', 'Exponential tilting: the trade between reward and reference policy'],
    ctl: [['beta', ['KL 的权重 β', 'Weight β on the KL'], 0.1, 5, 0.05, 1, f2], ['r1', ['回答 A 的奖励', 'Reward of answer A'], -2, 2, 0.05, 0, f2], ['r2', ['回答 B 的奖励', 'Reward of answer B'], -2, 2, 0.05, 1, f2], ['r3', ['回答 C 的奖励', 'Reward of answer C'], -2, 2, 0.05, -1, f2]],
    btn: [[['β 很小：几乎只看奖励', 'Small β: reward dominates'], { beta: 0.15 }], [['β 很大：贴着参考策略', 'Large β: stay with the reference'], { beta: 5 }]],
    figs: [[0.4, ['三个回答上的参考策略 π_ref = (0.5, 0.3, 0.2)（灰）和最优策略 π* ∝ π_ref·e^{r/β}（深色）。', 'The reference policy π_ref = (0.5, 0.3, 0.2) over three answers (grey) and the optimal policy π* ∝ π_ref·e^{r/β} (dark).']], [0.4, ['DPO 对单个偏好对的损失 −log σ(m)，m 是 β 乘以赢家与输家的“策略对数比之差”。金点：把 π* 代进去、取 B 赢 A 时的值。', 'The DPO loss −log σ(m) of one preference pair, where m is β times the difference of policy log-ratios between winner and loser. Gold point: the value with π* substituted and B preferred to A.']]],
    note: ['上图是解析的最优策略（附录 I）。读数里核对了两件事：π* 的正则化目标值不低于参考策略本身的目标值（它是全局最优）；以及 β·[log(π*(B)/π_ref(B)) − log(π*(A)/π_ref(A))] 正好等于奖励差 r_B − r_A，配分函数消掉了。这就是 DPO [26] 把奖励差换成策略对数比的那一步。它依赖 KL 正则目标、Bradley–Terry 偏好模型和“策略已经是最优”这三个前提；有限的偏好数据下，这只是一个拟合目标。', 'The upper figure is the optimal policy in closed form (Appendix I). The read-out checks two things: the regularised objective of π* is no lower than that of the reference policy itself (it is the global optimum); and β·[log(π*(B)/π_ref(B)) − log(π*(A)/π_ref(A))] equals the reward difference r_B − r_A exactly, the partition function cancelling. That is the step by which DPO [26] replaces reward differences with policy log-ratios. It rests on three premises: the KL-regularised objective, the Bradley–Terry preference model, and the policy being optimal; with finite preference data it is only a fitting objective.'],
    draw(s, f, c) {
      const rw = [s.r1, s.r2, s.r3], pi = M.tiltPolicy(REF, rw, s.beta), xs = [1, 2, 3];
      plot(f[0], { x: [0.4, 3.6], y: [0, 1.05], xt: xs, xf: (t) => 'ABC'[t - 1], yl: L('概率', 'probability'), series: [{ xs: xs.map((x) => x - 0.2), ys: REF, color: c.faint, bars: 0.36, label: 'π_ref' }, { xs: xs.map((x) => x + 0.2), ys: pi, color: c.accent, bars: 0.36, label: 'π*' }], texts: pi.map((v, i) => ({ x: i + 1.2, y: v, s: v.toFixed(3), align: 'center', dy: -6 })) });
      const margin = s.beta * (Math.log(pi[1] / REF[1]) - Math.log(pi[0] / REF[0])), ms = lin(-6, 6, 201);
      plot(f[1], { x: [-6, 6], y: [0, 6.2], xl: 'm', yl: L('损失', 'loss'), series: [{ xs: ms, ys: ms.map(M.dpoLoss), color: c.accent }], marks: [{ x: Math.max(-6, Math.min(6, margin)), y: M.dpoLoss(margin), color: c.gold }] });
      return [[['KL(π* ‖ π_ref)', 'KL(π* ‖ π_ref)'], fmt(M.klDiscrete(pi, REF), 4), 1], [['目标值：π* / π_ref', 'Objective: π* / π_ref'], `${fmt(M.regObjective(pi, REF, rw, s.beta), 4)} / ${fmt(M.regObjective(REF, REF, rw, s.beta), 4)}`], [['奖励差 r_B − r_A', 'Reward difference r_B − r_A'], fmt(s.r2 - s.r1, 6)], [['β × 策略对数比之差', 'β × difference of policy log-ratios'], fmt(margin, 6), 1], [['这一对的 DPO 损失', 'DPO loss of this pair'], fmt(M.dpoLoss(margin), 4)]];
    },
  };

  // ── 34 测试时计算 ───────────────────────────────────────────────────────
  D['34'] = {
    title: ['多试几次能涨多少，什么时候涨不动', 'How much more attempts help, and when they stop helping'],
    ctl: [['p', ['单次成功率 p', 'Success rate of one attempt, p'], 0.01, 0.6, 0.01, 0.2, f2], ['k', ['候选数 k', 'Candidates k'], 1, 64, 1, 8, int], ['cf', ['整题“共同失败”的概率', 'Probability of a common failure'], 0, 0.9, 0.01, 0.6, f2], ['C', ['下图：两道题的总预算', 'Lower figure: total budget for two problems'], 1, 30, 0.5, 8, (v) => v.toFixed(1)]],
    btn: [[['讲义的例子 p = 0.2，k = 8', 'The notes’ example p = 0.2, k = 8'], { p: 0.2, k: 8, cf: 0.6 }], [['错误互相独立', 'Independent errors'], { cf: 0 }]],
    figs: [[0.42, ['至少一次成功的概率随 k 的变化：各次独立（实线）和“有共同失败模式”（虚线）。两条曲线的单次成功率相同。', 'The probability of at least one success against k: independent attempts (solid) and attempts sharing a common failure mode (dashed). Both curves have the same single-attempt success rate.']], [0.4, ['两道题（一易一难）分预算：总效用随分给容易题的预算的变化，金点是最优分法。', 'Splitting a budget between two problems (one easy, one hard): total utility against the share given to the easy one; the gold point is the best split.']]],
    note: ['上图是两个精确的教学概率模型，不是任何模型的实测曲线。独立模型：1 − (1 − p)ᵏ，p = 0.2、k = 8 时约 0.832。相关模型：以概率 c 整道题所有候选一起失败（共同的知识缺口），否则各次以 p/(1 − c) 独立成功，所以单次成功率还是 p，但上限被压在 1 − c。两条线都假设“只要有一个候选对了就能认出来”，实际还要看验证器。下图的效用 Uᵢ(c) = 1 − e^{−c/τᵢ} 是人为设定的凹函数（τ = 1.5 和 6）：最优分配让两道题的边际收益相等，而不是平分。', 'The upper figure shows two exact teaching models, not a measured curve of any model. Independent: 1 − (1 − p)ᵏ, about 0.832 at p = 0.2 and k = 8. Correlated: with probability c all candidates for the problem fail together (a shared gap in knowledge), otherwise each succeeds independently with p/(1 − c); the single-attempt rate is still p, but the ceiling is 1 − c. Both curves assume that a correct candidate is recognised whenever there is one; in practice that depends on the verifier. The utility Uᵢ(c) = 1 − e^{−c/τᵢ} below is a concave function set by hand (τ = 1.5 and 6): the best allocation equalises the marginal gains of the two problems and is not an even split.'],
    draw(s, f, c) {
      const cf = Math.min(s.cf, 1 - s.p - 1e-9), ks = lin(1, 64, 64), ind = M.passAtK(s.p, s.k), cor = M.passCorrelated(s.p, s.k, cf);
      plot(f[0], { x: [1, 64], y: [0, 1.05], xl: 'k', yl: 'pass@k', series: [{ xs: ks, ys: ks.map((k) => M.passAtK(s.p, k)), color: c.accent, label: L('独立', 'independent') }, { xs: ks, ys: ks.map((k) => M.passCorrelated(s.p, k, cf)), color: c.danger, dash: [5, 4], label: L('有共同失败', 'common failure') }], hmarks: [{ y: 1 - cf, color: c.faint }], marks: [{ x: s.k, y: ind, color: c.gold }] });
      const cs = lin(0, s.C, 201), U = (q) => M.utility(q, 1, 1.5) + M.utility(s.C - q, 1, 6), best = M.bestSplit(s.C, 1, 1.5, 1, 6);
      plot(f[1], { x: [0, s.C], y: [0, 2.05], xl: L('分给容易题的预算', 'budget given to the easy problem'), yl: L('总效用', 'total utility'), series: [{ xs: cs, ys: cs.map(U), color: c.accent }], marks: [{ x: best.c1, y: best.total, color: c.gold }, { x: s.C / 2, y: U(s.C / 2), color: c.muted }] });
      return [[[`pass@${s.k}：独立`, `pass@${s.k}: independent`], fmt(ind, 4), 1], [[`pass@${s.k}：有共同失败`, `pass@${s.k}: common failure`], fmt(cor, 4), 1], [['相关模型的上限 1 − c', 'Ceiling of the correlated model, 1 − c'], fmt(1 - cf)], [['最优分法：容易题 / 难题', 'Best split: easy / hard'], `${fmt(best.c1)} / ${fmt(s.C - best.c1)}`], [['总效用：最优 / 平分', 'Total utility: best / even split'], `${fmt(best.total, 4)} / ${fmt(U(s.C / 2), 4)}`]];
    },
  };

  // ── 35 缩放律 ───────────────────────────────────────────────────────────
  D['35'] = {
    title: ['固定算力，模型和数据各该多大', 'With compute fixed, how big the model and the data should be'],
    ctl: [['lc', ['算力预算 C', 'Compute budget C'], 0, 8, 0.1, 2, (v) => fmt(10 ** v)], ['al', ['模型项的指数 α', 'Exponent α of the model term'], 0.2, 0.8, 0.01, 0.5, f2], ['be', ['数据项的指数 β', 'Exponent β of the data term'], 0.2, 0.8, 0.01, 0.5, f2]],
    btn: [[['讲义左图：α = β = 0.5', 'The notes’ left panel: α = β = 0.5'], { al: 0.5, be: 0.5, lc: 2 }], [['讲义右图：α = 0.6，β = 0.4', 'The notes’ right panel: α = 0.6, β = 0.4'], { al: 0.6, be: 0.4 }]],
    figs: [[0.42, ['预算 C = kND 固定时，损失随模型规模 N 的变化（a = b = k = 1，L∞ = 0）。太小欠拟合，太大则数据不够，金点是解析的最优 N*。', 'Loss against model size N at fixed budget C = kND (a = b = k = 1, L∞ = 0). Too small underfits, too large starves the data; the gold point is the analytic optimum N*.']], [0.4, ['最优的 N* 和 D* 随预算的变化（双对数）：斜率分别是 β/(α+β) 和 α/(α+β)。', 'The optimal N* and D* against the budget (log–log): the slopes are β/(α+β) and α/(α+β).']]],
    note: ['损失模型 L = L∞ + aN^{−α} + bD^{−β} 和系数都是教学设定；推导在附录 J。α = β 时 N* 和 D* 都按 √C 增长，C = 100 时 N* = D* = 10。真实的缩放律 [32] 是在特定训练体系、特定范围内拟合出来的经验关系：指数和常数会随数据质量、架构、优化器改变，外推到拟合范围之外需要另外的证据。这里也没有算推理成本。', 'The loss model L = L∞ + aN^{−α} + bD^{−β} and its coefficients are teaching choices; the derivation is in Appendix J. With α = β both N* and D* grow as √C, and at C = 100, N* = D* = 10. Real scaling laws [32] are empirical relations fitted within a particular training regime and range: exponents and constants change with data quality, architecture and optimiser, and extrapolation beyond the fitted range needs separate evidence. Inference cost is not counted here.'],
    draw(s, f, c) {
      const o = { Linf: 0, a: 1, b: 1, k: 1, alpha: s.al, beta: s.be }, C = 10 ** s.lc, opt = M.scalingOpt(C, o), ln = lin(Math.log10(opt.N) - 2.5, Math.log10(opt.N) + 2.5, 201), ys = ln.map((q) => Math.log10(M.scalingLoss(10 ** q, C, o)));
      const y0 = Math.log10(opt.loss);
      plot(f[0], { x: [ln[0], ln.at(-1)], y: [y0 - 0.15, y0 + 1.3], xl: 'log₁₀ N', yl: 'log₁₀ L', series: [{ xs: ln, ys, color: c.accent }], marks: [{ x: Math.log10(opt.N), y: y0, color: c.gold }] });
      const lcs = lin(0, 8, 81), on = lcs.map((q) => Math.log10(M.scalingOpt(10 ** q, o).N)), od = lcs.map((q) => Math.log10(M.scalingOpt(10 ** q, o).D));
      plot(f[1], { x: [0, 8], y: [Math.min(0, ...on, ...od), Math.max(...on, ...od) * 1.05 + 0.2], xl: 'log₁₀ C', series: [{ xs: lcs, ys: on, color: c.accent, label: 'log₁₀ N*' }, { xs: lcs, ys: od, color: c.info, dash: [5, 4], label: 'log₁₀ D*' }], marks: [{ x: s.lc, color: c.gold }] });
      return [[['最优模型规模 N*', 'Optimal model size N*'], fmt(opt.N, 4), 1], [['最优数据量 D*', 'Optimal data D*'], fmt(opt.D, 4), 1], [['那里的损失', 'Loss there'], fmt(opt.loss, 4)], [['N* ∝ C 的幂 β/(α+β)', 'N* ∝ C to the power β/(α+β)'], fmt(s.be / (s.al + s.be), 3)], [['D* ∝ C 的幂 α/(α+β)', 'D* ∝ C to the power α/(α+β)'], fmt(s.al / (s.al + s.be), 3)]];
    },
  };

  // ── 36 泛化、双下降与 NTK ───────────────────────────────────────────────
  const DD_P = [2, 4, 6, 8, 10, 12, 14, 16, 17, 18, 19, 20, 21, 22, 23, 24, 26, 28, 30, 34, 38, 42, 46, 50, 55, 60];
  D['36'] = {
    title: ['真算一条双下降曲线', 'A double-descent curve, actually computed'],
    ctl: [['noise', ['标签噪声', 'Label noise'], 0, 1, 0.02, 0.5, f2], ['lr', ['岭正则 λ', 'Ridge λ'], -9, 0, 0.1, -9, (v) => (v <= -8.95 ? L('无', 'none') : fmt(10 ** v))], ['len', ['下图：RBF 核的长度尺度', 'Lower figure: RBF length scale'], 0.5, 6, 0.1, 2, (v) => v.toFixed(1)]],
    btn: [[['没有噪声', 'No noise'], { noise: 0 }], [['加一点岭正则', 'A little ridge'], { lr: -1 }], [['不正则', 'No ridge'], { lr: -9 }]],
    figs: [[0.5, ['测试均方误差随所用特征数 p 的变化（对数纵轴）：20 个训练样本，60 个真实特征，对 20 次随机试验取平均。竖线是插值阈值 p = n。', 'Test mean squared error against the number of features used, p (logarithmic axis): 20 training samples, 60 true features, averaged over 20 random trials. The vertical line is the interpolation threshold p = n.']], [0.5, ['一个 RBF 核矩阵 K(i, j) = exp(−(i−j)²/2ℓ²)。它是“固定核”的例子，不是从真实网络量出来的 NTK。', 'An RBF kernel matrix K(i, j) = exp(−(i−j)²/2ℓ²). It illustrates a fixed kernel and is not an NTK measured on a real network.']]],
    note: ['讲义的图是手画的示意，这里换成了真算的实验：y = xᵀw* + 噪声，x 有 60 个独立高斯分量，模型只用前 p 个做最小二乘；p > n 时取最小范数的插值解。p 接近 n 时矩阵接近奇异，对噪声的拟合被极度放大，测试误差出现尖峰；p 继续增大，最小范数解的误差又降下来。岭正则把尖峰压平。这只是线性模型上的一个例子，不代表每种网络、数据和训练方式都有同形的曲线。种子固定，同样的设置每次结果一样。', 'The figure in the notes is a hand-drawn schematic; here it is replaced by an experiment that is actually computed: y = xᵀw* + noise, where x has 60 independent Gaussian components and the model uses only the first p in a least-squares fit, taking the minimum-norm interpolant when p > n. Near p = n the matrix is nearly singular, the fit to noise is hugely amplified and the test error spikes; as p grows further the error of the minimum-norm solution comes down again. Ridge regularisation flattens the spike. This is one example on a linear model and does not imply that every network, data set and training method shows a curve of the same shape. The seed is fixed, so the same settings always give the same result.'],
    draw(s, f, c) {
      const ridge = s.lr <= -8.95 ? 0 : 10 ** s.lr, key = `${s.noise}|${ridge}`;
      if (s.key !== key) { s.key = key; s.err = M.doubleDescent(20, 60, DD_P, s.noise, ridge, 20); }
      const ys = s.err.map((v) => Math.log10(v)), lo = Math.floor(Math.min(...ys) - 0.2), hi = Math.ceil(Math.max(...ys) + 0.1);
      plot(f[0], { x: [0, 62], y: [lo, hi], xl: L('特征数 p', 'features p'), yl: L('测试误差', 'test error'), yt: Array.from({ length: hi - lo + 1 }, (_, i) => lo + i), yf: K.pow, series: [{ xs: DD_P, ys, color: c.accent, dots: 3, line: true }], marks: [{ x: 20, color: c.gold }] });
      heat(f[1], M.rbf(12, s.len), { max: 1, num: false });
      const iMin = s.err.indexOf(Math.min(...s.err)), under = s.err.slice(0, DD_P.indexOf(20)), over = s.err.slice(DD_P.indexOf(20) + 1);
      return [[['p = n = 20 处的误差', 'Error at p = n = 20'], fmt(s.err[DD_P.indexOf(20)], 3), 1], [['欠参数一侧的最小误差', 'Smallest error on the under-parametrised side'], `${fmt(Math.min(...under), 3)}（p = ${DD_P[under.indexOf(Math.min(...under))]}）`.replace('（', ' (').replace('）', ')')], [['过参数一侧的最小误差', 'Smallest error on the over-parametrised side'], `${fmt(Math.min(...over), 3)} (p = ${DD_P[DD_P.indexOf(20) + 1 + over.indexOf(Math.min(...over))]})`], [['全程最小', 'Overall minimum'], `p = ${DD_P[iMin]}`], [['只有噪声的下限', 'Floor set by noise alone'], fmt(s.noise ** 2, 3)]];
    },
  };

  // ── 37 校准与保形预测 ───────────────────────────────────────────────────
  D['37'] = {
    title: ['分割保形：数一数覆盖率', 'Split conformal prediction: count the coverage'],
    ctl: [['al', ['允许的漏报率 α', 'Miscoverage level α'], 0.02, 0.4, 0.01, 0.1, f2], ['n', ['校准集大小 n', 'Calibration set size n'], 5, 200, 1, 50, int], ['noise', ['数据噪声', 'Data noise'], 0.05, 0.6, 0.01, 0.25, f2]],
    act: [[['换一个校准集', 'Draw another calibration set'], (s) => { s.seed = (s.seed || 20261112) + 1; }]],
    btn: [[['很小的校准集 n = 9', 'A tiny calibration set, n = 9'], { n: 9, al: 0.1 }], [['n = 200', 'n = 200'], { n: 200 }]],
    figs: [[0.5, ['固定的（不完美的）预测模型（实线）、真实函数（虚线）、校准点和宽度为 ±q̂ 的预测带。', 'A fixed (imperfect) predictor (solid), the true function (dashed), the calibration points and the prediction band of half-width q̂.']], [0.4, ['把“抽校准集 → 定阈值 → 在 200 个新点上数覆盖率”重复 300 次得到的覆盖率直方图。金线是 1 − α。', 'Histogram of coverage over 300 repetitions of drawing a calibration set, fixing the threshold and counting coverage on 200 new points. The gold line is 1 − α.']]],
    note: ['讲义的图是概念示意，这里是真跑的模拟。分数取 |y − 预测|，阈值 q̂ 是 n 个校准分数里第 ⌈(n+1)(1−α)⌉ 小的；这个秩超过 n 时阈值取 +∞（试试 n = 9、α = 0.05）。保证是边缘的：对校准集和新样本一起取平均，覆盖率不低于 1 − α，平均值恰好是 ⌈(n+1)(1−α)⌉/(n+1)。它不是说每一个校准集都达到 1 − α（直方图有宽度，n 越小越宽），也不是说每个具体的 x 处都达到。模型在这里故意是不完美的：保证不依赖模型好坏，模型差只会让预测带变宽。', 'The figure in the notes is conceptual; this is a simulation that is actually run. The score is |y − prediction| and the threshold q̂ is the ⌈(n+1)(1−α)⌉-th smallest of the n calibration scores, taken as +∞ when that rank exceeds n (try n = 9 with α = 0.05). The guarantee is marginal: averaged over calibration set and new sample together, coverage is at least 1 − α, with mean exactly ⌈(n+1)(1−α)⌉/(n+1). It does not say that every calibration set reaches 1 − α (the histogram has width, more so for small n), nor that it holds at each particular x. The model is deliberately imperfect here: the guarantee does not depend on model quality, and a poor model only widens the band.'],
    draw(s, f, c) {
      const seed = s.seed || 20261112, tr = M.conformalTrial(s.n, s.al, s.noise, seed), xs = lin(-2, 2, 161), q = Number.isFinite(tr.q) ? tr.q : 3;
      plot(f[0], { x: [-2, 2], y: [-2.4, 2.4], xl: 'x', yl: 'y', series: [{ xs, ys: xs.map((x) => tr.model(x) + q), color: c.gold, width: 1.2 }, { xs, ys: xs.map((x) => tr.model(x) - q), color: c.gold, width: 1.2, label: L('预测带 ±q̂', 'band ±q̂') }, { xs, ys: xs.map(tr.truth), color: c.muted, dash: [5, 4], label: L('真实函数', 'truth') }, { xs, ys: xs.map(tr.model), color: c.accent, label: L('模型', 'model') }, { pts: tr.cal, color: c.info, dots: 2.5, alpha: 0.8, label: L('校准点', 'calibration') }] });
      const key = `${s.n}|${s.al}|${s.noise}`;
      if (s.key !== key) { s.key = key; s.cov = M.conformalCoverage(s.n, s.al, s.noise); }
      const h = M.histogram(s.cov, 0.5, 1.0001, 40), hx = h.map((_, i) => 0.5 + ((i + 0.5) * 0.5) / 40), mean = s.cov.reduce((a, b) => a + b, 0) / s.cov.length;
      plot(f[1], { x: [0.5, 1], y: [0, Math.max(...h) * 1.1], xl: L('覆盖率', 'coverage'), yt: [], series: [{ xs: hx, ys: h, color: c.accent, bars: 0.5 / 40, alpha: 0.8 }], marks: [{ x: 1 - s.al, color: c.gold }, { x: mean, color: c.info }] });
      const rank = Math.ceil((s.n + 1) * (1 - s.al));
      return [[['阈值 q̂', 'Threshold q̂'], Number.isFinite(tr.q) ? fmt(tr.q, 4) : '+∞', 1], [['用到的秩 ⌈(n+1)(1−α)⌉ / n', 'Rank used ⌈(n+1)(1−α)⌉ / n'], `${rank} / ${s.n}`], [['这一个校准集的覆盖率', 'Coverage with this calibration set'], pct(tr.covered)], [['300 次的平均覆盖率', 'Mean coverage over 300 runs'], pct(mean, 2), 1], [['理论平均值', 'Theoretical mean'], pct(Math.min(1, rank / (s.n + 1)), 2)], [['目标 1 − α', 'Target 1 − α'], pct(1 - s.al)]];
    },
  };

  // ── 38 因果 ─────────────────────────────────────────────────────────────
  D['38'] = {
    title: ['看到的差别和干预出来的差别', 'The difference you observe and the difference you cause'],
    ctl: [['pz', ['混杂因素出现的概率 P(Z = 1)', 'Probability of the confounder, P(Z = 1)'], 0.05, 0.95, 0.01, 0.5, f2], ['cc', ['Z 对 X 的影响（Z → X）', 'Effect of Z on X (Z → X)'], 0, 3, 0.05, 1.5, f2], ['ef', ['X 对 Y 的真实因果效应', 'True causal effect of X on Y'], -0.2, 0.4, 0.01, 0.2, f2], ['cf', ['Z 对 Y 的影响（Z → Y）', 'Effect of Z on Y (Z → Y)'], 0, 0.4, 0.01, 0.3, f2]],
    btn: [[['没有混杂', 'No confounding'], { cc: 0 }], [['X 其实没用', 'X in fact does nothing'], { ef: 0, cc: 2, cf: 0.4 }], [['讲义式的例子', 'A typical example'], { pz: 0.5, cc: 1.5, ef: 0.2, cf: 0.3 }]],
    figs: [[0.42, ['因果图：Z 同时影响 X 和 Y，X 也影响 Y。箭头粗细对应滑块设的强度；do(X) 把指向 X 的那条箭头（虚线）切断。', 'The causal graph: Z affects both X and Y, and X also affects Y. Arrow widths follow the sliders; do(X) cuts the arrow into X (dashed).']], [0.4, ['观察到的差 P(Y|X=1) − P(Y|X=0) 和干预的差 P(Y|do(X=1)) − P(Y|do(X=0))。', 'The observed difference P(Y|X=1) − P(Y|X=0) and the interventional difference P(Y|do(X=1)) − P(Y|do(X=0)).']]],
    note: ['三个二值变量的结构因果模型，全部精确枚举：P(X=1|Z) = σ(−c + 2cZ)，P(Y=1|X,Z) = 0.2 + 效应·X + 混杂·Z。观察条件 X = 1 的人群里 Z = 1 的比例更高，所以观察到的差里混进了 Z 的贡献；干预用 Z 的总体分布去平均（后门调整），得到的正好是真实效应。“X 其实没用”那个预设里，观察到的差仍然是正的。这里能调整是因为 Z 被观测到了，而且图是已知的；真实问题里这两条都是需要辩护的假设。', 'A structural causal model of three binary variables, enumerated exactly: P(X=1|Z) = σ(−c + 2cZ) and P(Y=1|X,Z) = 0.2 + effect·X + confounding·Z. Among those observed with X = 1 the share with Z = 1 is higher, so the observed difference includes a contribution of Z; the intervention averages over the population distribution of Z (back-door adjustment) and returns exactly the true effect. In the preset where X does nothing, the observed difference is still positive. Adjustment works here because Z is observed and the graph is known; in real problems both are assumptions that need defending.'],
    draw(s, f, c) {
      const r = M.scm(s.pz, s.cc, s.ef, s.cf);
      const { ctx, w, h } = K.fit(f[0]);
      const P = { Z: [w / 2, h * 0.2], X: [w * 0.2, h * 0.76], Y: [w * 0.8, h * 0.76] }, R = Math.min(26, w / 14);
      const edge = (a, b, col, wd, dash) => { const dx = P[b][0] - P[a][0], dy = P[b][1] - P[a][1], len = Math.hypot(dx, dy), ux = dx / len, uy = dy / len; ctx.setLineDash(dash || []); K.arrow(ctx, P[a][0] + ux * (R + 3), P[a][1] + uy * (R + 3), P[b][0] - ux * (R + 5), P[b][1] - uy * (R + 5), col, wd); ctx.setLineDash([]); };
      edge('Z', 'X', s.cc ? c.danger : c.faint, 1 + s.cc * 1.3, [6, 5]); edge('Z', 'Y', s.cf ? c.danger : c.faint, 1 + s.cf * 9); edge('X', 'Y', s.ef ? c.accent : c.faint, 1 + Math.abs(s.ef) * 9);
      for (const [k, sub] of [['Z', L('混杂', 'confounder')], ['X', L('处理', 'treatment')], ['Y', L('结果', 'outcome')]]) { ctx.beginPath(); ctx.arc(P[k][0], P[k][1], R, 0, 2 * Math.PI); ctx.fillStyle = c.surface; ctx.fill(); ctx.strokeStyle = k === 'Z' ? c.danger : c.accent; ctx.lineWidth = 2; ctx.stroke(); ctx.fillStyle = c.ink; ctx.font = K.font(15, 700); ctx.textAlign = 'center'; ctx.fillText(k, P[k][0], P[k][1] + 5); ctx.font = K.font(11); ctx.fillStyle = c.muted; ctx.fillText(sub, P[k][0], P[k][1] + (k === 'Z' ? -R - 6 : R + 15)); }
      const lim = Math.max(0.5, Math.abs(r.observed) * 1.2, Math.abs(r.causal) * 1.2);
      plot(f[1], { x: [0.4, 2.6], y: [Math.min(-0.1, -lim * (r.observed < 0 || r.causal < 0 ? 1 : 0.2)), lim], xt: [1, 2], xf: (t) => [L('观察到的差', 'observed difference'), L('干预的差（真实效应）', 'interventional (true effect)')][t - 1], series: [{ xs: [1], ys: [r.observed], color: c.danger, bars: 0.6 }, { xs: [2], ys: [r.causal], color: c.accent, bars: 0.6 }], texts: [{ x: 1, y: Math.max(0, r.observed), s: r.observed.toFixed(3), align: 'center', dy: -6 }, { x: 2, y: Math.max(0, r.causal), s: r.causal.toFixed(3), align: 'center', dy: -6 }], hmarks: [{ y: 0, color: c.muted }] });
      return [[['P(Y | X=1)，P(Y | X=0)', 'P(Y | X=1), P(Y | X=0)'], `${fmt(r.pY_x1)}, ${fmt(r.pY_x0)}`], [['观察到的差', 'Observed difference'], fmt(r.observed, 4), 1], [['P(Y | do(X=1))，P(Y | do(X=0))', 'P(Y | do(X=1)), P(Y | do(X=0))'], `${fmt(r.pY_do1)}, ${fmt(r.pY_do0)}`], [['干预的差', 'Interventional difference'], fmt(r.causal, 4), 1], [['混杂带来的偏差', 'Bias from confounding'], fmt(r.observed - r.causal, 4)]];
    },
  };

  // ── 39 群、等变性与分子模型 ─────────────────────────────────────────────
  const MOL = [[0, 0], [1.25, 0.15], [-0.55, 1.05], [-0.75, -0.95], [1.7, 1.2]];
  D['39'] = {
    title: ['把分子转一下：能量不变，力跟着转', 'Rotate the molecule: the energy stays, the forces rotate with it'],
    ctl: [['an', ['旋转角度', 'Rotation angle'], 0, 360, 1, 40, (v) => `${Math.round(v)}°`]],
    chk: [['rf', ['先做一次镜面反射', 'Apply a mirror reflection first'], false]],
    play: 'an',
    figs: [[0.6, ['五个“原子”和成对势 E = Σ ½(rᵢⱼ − 1)² 给出的力（箭头）。', 'Five “atoms” and the forces (arrows) from the pair potential E = Σ ½(rᵢⱼ − 1)².']], [0.6, ['整体旋转（再平移）之后重新算出的力。浅色是原来的位置。', 'The forces recomputed after rotating (and translating) the whole set. The pale points are the original positions.']]],
    note: ['势能只依赖原子间的距离，所以对旋转、平移和反射都不变，力 F = −∇E 是等变的：F(RX + t) = R·F(X)。读数里的“等变误差”是把变换后重新算的力和“先算力再旋转”逐个相减的最大值，应当只剩舍入误差（约 10⁻¹⁶）。这个势只是为了演示对称性，不是任何真实分子的势能面。反射也保持这个势不变（它是 E(3) 不变的）；需要区分手性的任务就不能只用距离做特征。', 'The potential depends only on interatomic distances and is therefore invariant under rotations, translations and reflections; the force F = −∇E is equivariant, F(RX + t) = R·F(X). The equivariance error in the read-out is the largest difference between forces recomputed after the transformation and forces computed first and rotated afterwards; only rounding error should remain (about 10⁻¹⁶). The potential serves only to show the symmetry and is no real molecular energy surface. Reflections leave it invariant too (it is E(3)-invariant); a task that must tell chirality apart cannot rely on distances alone.'],
    draw(s, f, c) {
      const a = (s.an * Math.PI) / 180, X2 = M.transformPoints(MOL, a, s.rf, [0.5, -0.2]), e1 = M.pairEnergy(MOL), e2 = M.pairEnergy(X2);
      const draw = (cv, X, F, ghost) => plot(cv, { x: [-3.4, 3.8], y: [-2.6, 2.6], eq: true, xt: [], yt: [], series: [...(ghost ? [{ pts: ghost, color: c.faint, dots: 4, alpha: 0.6 }] : []), ...X.flatMap((p, i) => X.slice(i + 1).map((q) => ({ xs: [p[0], q[0]], ys: [p[1], q[1]], color: c.line, width: 1 }))), { pts: X, color: c.accent, dots: 7 }, { pts: [X[0]], color: c.gold, dots: 7 }],
        arrows: X.map((p, i) => ({ from: p, to: [p[0] + 1.6 * F[i][0], p[1] + 1.6 * F[i][1]], color: c.danger, width: 2 })) });
      draw(f[0], MOL, e1.F); draw(f[1], X2, e2.F, MOL);
      const dist = (X) => Math.hypot(X[0][0] - X[1][0], X[0][1] - X[1][1]);
      return [[['能量：变换前 / 后', 'Energy: before / after'], `${fmt(e1.E, 6)} / ${fmt(e2.E, 6)}`, 1], [['等变误差 max‖F(RX+t) − R·F(X)‖', 'Equivariance error max‖F(RX+t) − R·F(X)‖'], fmt(M.equivarianceError(MOL, a, s.rf), 2), 1], [['原子 1–2 的距离：前 / 后', 'Distance of atoms 1–2: before / after'], `${fmt(dist(MOL), 5)} / ${fmt(dist(X2), 5)}`], [['合力（应为 0）', 'Net force (should be 0)'], fmt(Math.hypot(e2.F.reduce((q, v) => q + v[0], 0), e2.F.reduce((q, v) => q + v[1], 0)), 2)]];
    },
  };

  // ── 40 神经算子、Fourier 与 PDE ─────────────────────────────────────────
  D['40'] = {
    title: ['只留低频：留下什么，丢了什么', 'Keeping only low frequencies: what stays and what is lost'],
    ctl: [['keep', ['保留的最高模式数', 'Highest mode kept'], 0, 24, 1, 4, int], ['hi', ['信号里高频成分的大小', 'Size of the high-frequency content'], 0, 1, 0.01, 0.35, f2], ['a', ['下图：系数 a', 'Lower figure: coefficient a'], 0.4, 4, 0.05, 1, f2]],
    btn: [[['只留 1 个模式', 'Keep 1 mode'], { keep: 1 }], [['留到 9', 'Keep up to 9'], { keep: 9 }], [['留到 17', 'Keep up to 17'], { keep: 17 }]],
    figs: [[0.42, ['原信号 sin x + h·sin 9x + ½h·sin(17x + 0.6)（细线）和截断到前 k 个 Fourier 模式后的重建（粗线）。', 'The signal sin x + h·sin 9x + ½h·sin(17x + 0.6) (thin) and its reconstruction from the first k Fourier modes (thick).']], [0.4, ['一个能解析求解的 PDE 族：−a·u″ = sin(πx)，u(0) = u(1) = 0。灰线是几个不同的 a，深色是当前的 a。“系数 a ↦ 解 u”就是一个解算子。', 'A family of PDEs solvable in closed form: −a·u″ = sin(πx) with u(0) = u(1) = 0. Grey lines are several values of a, the dark line the current one. The map “coefficient a ↦ solution u” is a solution operator.']]],
    note: ['上图是真做的离散 Fourier 截断（128 个采样点）：模式 9 和 17 没被保留时，对应的细节完全丢失，保留之后误差骤降，这就是 Fourier 层“低频截断提供压缩，但不能凭空恢复高频细节”。下图的解是 u = sin(πx)/(aπ²)；读数里用差分把它代回方程核对残差。这两张图都不是训练出来的神经算子的结果：学一个解函数（固定 a）、学解算子（a 变）和学数值求解器，是三件相关但不同的事，评估时还要看边界条件、守恒量和参考解本身的误差。', 'The upper figure is a discrete Fourier truncation that is actually carried out (128 sample points): while modes 9 and 17 are not kept, their detail is lost entirely, and once they are kept the error drops sharply; this is the sense in which low-frequency truncation in a Fourier layer compresses but cannot conjure up high-frequency detail. The solution below is u = sin(πx)/(aπ²); the read-out substitutes it back into the equation by finite differences to check the residual. Neither figure is the output of a trained neural operator: learning one solution function (fixed a), learning the solution operator (varying a) and learning a numerical solver are three related but different tasks, and evaluation must also consider boundary conditions, conserved quantities and the error of the reference solution itself.'],
    draw(s, f, c) {
      const n = 128, xs = Array.from({ length: n }, (_, i) => (2 * Math.PI * i) / n), ys = xs.map((x) => M.signal(x, s.hi)), tr = M.fourierTruncate(ys, s.keep);
      plot(f[0], { x: [0, 2 * Math.PI], y: [-2.2, 2.2], xl: 'x', xt: [0, Math.PI, 2 * Math.PI], xf: (t) => (t === 0 ? '0' : t > 4 ? '2π' : 'π'), series: [{ xs, ys, color: c.muted, width: 1.2, label: L('原信号', 'signal') }, { xs, ys: tr, color: c.accent, width: 2.4, label: L(`前 ${s.keep} 个模式`, `first ${s.keep} modes`) }] });
      const ux = lin(0, 1, 101);
      plot(f[1], { x: [0, 1], y: [0, 0.27], xl: 'x', yl: 'u(x)', series: [...[0.5, 1, 2, 4].map((a) => ({ xs: ux, ys: ux.map((x) => M.poisson(x, a)), color: c.faint, width: 1.2 })), { xs: ux, ys: ux.map((x) => M.poisson(x, s.a)), color: c.accent, width: 2.6, label: `a = ${s.a.toFixed(2)}` }] });
      const h = 1e-3, res = Math.max(...[0.2, 0.4, 0.6, 0.8].map((x) => Math.abs((-s.a * (M.poisson(x + h, s.a) - 2 * M.poisson(x, s.a) + M.poisson(x - h, s.a))) / (h * h) - Math.sin(Math.PI * x))));
      return [[['重建的均方根误差', 'RMS error of the reconstruction'], fmt(M.rms(ys, tr), 4), 1], [['保留的系数个数 / 采样点数', 'Coefficients kept / sample points'], `${2 * s.keep + 1} / ${n}`], [['解的最大值 1/(aπ²)', 'Maximum of the solution, 1/(aπ²)'], fmt(M.poisson(0.5, s.a), 4)], [['把解代回方程的残差', 'Residual on substituting back'], fmt(res, 2)]];
    },
  };

  // ── 41 能量、Langevin 与自由能 ──────────────────────────────────────────
  D['41'] = {
    title: ['双阱能量：温度决定能不能翻过去', 'A double well: the temperature decides whether the barrier is crossed'],
    ctl: [['T', ['温度 T', 'Temperature T'], 0.05, 2, 0.01, 0.3, f2], ['ls', ['Langevin 步数', 'Langevin steps'], 1, 3.5, 0.05, 2.6, (v) => String(Math.round(10 ** v))], ['h', ['步长 h', 'Step size h'], 0.001, 0.08, 0.001, 0.01, (v) => v.toFixed(3)]],
    btn: [[['冷：困在左边', 'Cold: stuck on the left'], { T: 0.08, ls: 2.6 }], [['热：很快混合', 'Hot: mixes quickly'], { T: 1, ls: 2.6 }], [['步长太大', 'Step too large'], { h: 0.08, T: 0.3 }]],
    figs: [[0.4, ['能量 E(x) = (x² − 1)²（虚线，右轴未画，按比例缩放）和 Gibbs 密度 p ∝ e^{−E/T}（在 [−2.5, 2.5] 上归一化）。', 'The energy E(x) = (x² − 1)² (dashed, rescaled) and the Gibbs density p ∝ e^{−E/T} (normalised on [−2.5, 2.5]).']], [0.42, ['500 条 Langevin 链全部从左阱 x = −1 出发，走完这么多步后的位置直方图，和 Gibbs 密度（曲线）对照。', 'Histogram of the positions of 500 Langevin chains, all started in the left well at x = −1, after this many steps, against the Gibbs density (curve).']]],
    note: ['离散 Langevin：x ← x − h·E′(x) + √(2Th)·ξ，固定种子。平衡时左右两个阱各占一半质量；温度低或步数少时链还没翻过势垒，右阱的质量明显少于 0.5，这就是“混合缓慢”。步长大了离散化偏差变大，甚至不稳定。读数最后两行核对自由能的变分意义：F(q) = E_q[E] − T·H(q) 在 q 取 Gibbs 分布时最小，等于 −T log Z；换成只盖住一个阱的高斯，F 更大，差值正好是 T·KL(q‖p)。密度在有限区间上归一化，不是无限域上的精确配分函数。', 'Discrete Langevin: x ← x − h·E′(x) + √(2Th)·ξ with a fixed seed. At equilibrium each well holds half the mass; at low temperature or with few steps the chains have not crossed the barrier and the right well holds visibly less than 0.5, which is slow mixing. A large step increases discretisation bias and can become unstable. The last two rows check the variational meaning of free energy: F(q) = E_q[E] − T·H(q) is smallest when q is the Gibbs distribution, where it equals −T log Z; for a Gaussian covering one well only, F is larger, the gap being exactly T·KL(q‖p). The density is normalised on a finite interval and is not the exact partition function on the infinite domain.'],
    draw(s, f, c) {
      const xs = lin(-2.5, 2.5, 501), p = M.gibbs(xs, s.T), top = Math.max(...p) * 1.12, steps = Math.round(10 ** s.ls);
      plot(f[0], { x: [-2.5, 2.5], y: [0, top], xl: 'x', yt: [], series: [{ xs, ys: xs.map((x) => Math.min(top, (M.wellEnergy(x) / 4) * top)), color: c.muted, dash: [5, 4], label: 'E(x)' }, { xs, ys: p, color: c.accent, fill: true, label: 'p(x)' }] });
      const sm = M.langevin(500, steps, s.T, s.h).map((v) => (Number.isFinite(v) ? v : 99)), hs = M.histogram(sm, -2.5, 2.5, 50), hx = hs.map((_, i) => -2.5 + (i + 0.5) * 0.1);
      plot(f[1], { x: [-2.5, 2.5], y: [0, Math.max(top, ...hs) * 1.05], xl: 'x', yt: [], series: [{ xs: hx, ys: hs, color: c.info, bars: 0.1, alpha: 0.7, label: L('Langevin 样本', 'Langevin samples') }, { xs, ys: p, color: c.accent, label: 'p(x)' }] });
      const right = sm.filter((v) => v > 0 && v < 50).length / sm.length, lost = sm.filter((v) => Math.abs(v) > 2.5).length;
      const Z = M.trapz(xs, xs.map((x) => Math.exp(-M.wellEnergy(x) / s.T))), raw = xs.map((x) => M.normalPdf(x, -1, 0.3)), zq = M.trapz(xs, raw), q = raw.map((v) => v / zq);
      return [[['右阱里的样本比例（平衡时 0.5）', 'Share of samples in the right well (0.5 at equilibrium)'], fmt(right, 3), 1], [['跑出 [−2.5, 2.5] 的链', 'Chains that left [−2.5, 2.5]'], String(lost)], [['势垒高度 / 温度', 'Barrier height / temperature'], fmt(1 / s.T)], [['F(Gibbs) = −T log Z', 'F(Gibbs) = −T log Z'], `${fmt(M.freeEnergy(xs, p, s.T), 5)} = ${fmt(-s.T * Math.log(Z), 5)}`], [['F(只盖住左阱的高斯)', 'F(a Gaussian over the left well only)'], fmt(M.freeEnergy(xs, q, s.T), 5)]];
    },
  };

  // ── 42 误差不止一种 ─────────────────────────────────────────────────────
  D['42'] = {
    title: ['速度场差一点，轨迹最多差多少', 'If the velocity field is slightly off, how far the trajectory can drift'],
    ctl: [['Lc', ['速度场的 Lipschitz 常数 L', 'Lipschitz constant L of the field'], 0, 4, 0.05, 1.5, f2], ['e0', ['初始误差 e(0)', 'Initial error e(0)'], 0, 0.2, 0.005, 0.02, (v) => v.toFixed(3)], ['dl', ['速度误差的上界 δ', 'Bound δ on the velocity error'], 0, 0.3, 0.005, 0.05, (v) => v.toFixed(3)]],
    figs: [['html', ['', '']], [0.46, ['轨迹误差随时间的变化。虚线：Grönwall 上界。红线：膨胀的场 ẋ = Lx，上界恰好取到。蓝线：一个非线性的例子（真场 L·sin x，学到的场多了 δ·cos 3x）。绿线：收缩的场 ẋ = −Lx，远低于上界。', 'Trajectory error against time. Dashed: the Grönwall bound. Red: the expanding field ẋ = Lx, which attains the bound exactly. Blue: a nonlinear example (true field L·sin x, learned field with an extra δ·cos 3x). Green: the contracting field ẋ = −Lx, far below the bound.']]],
    note: ['上面的框是讲义的误差分类（原创示意，不是论文 [40] 的定理）。下面的公式来自附录 J：ė ≤ L·e + δ 积分得到 e(t) ≤ e^{Lt}e(0) + δ(e^{Lt} − 1)/L。四条线都满足同一组假设（L-Lipschitz，速度误差不超过 δ），实际误差却可以差出几个数量级：上界是最坏情形，由膨胀的线性场取到；收缩的场会把误差压到 δ/L 附近。所以读一个稳定性定理时，要看它对场做了什么假设，常数 e^{L} 在 L 大时可能大到没有实际意义。', 'The boxes on top are the notes’ classification of errors (an original sketch, not a theorem of paper [40]). The formula below comes from Appendix J: integrating ė ≤ L·e + δ gives e(t) ≤ e^{Lt}e(0) + δ(e^{Lt} − 1)/L. All four curves satisfy the same assumptions (L-Lipschitz, velocity error at most δ), yet the actual errors can differ by orders of magnitude: the bound is the worst case, attained by an expanding linear field, while a contracting field pushes the error towards δ/L. So when reading a stability theorem, check what it assumes about the field; the constant e^{L} can be too large to mean anything when L is large.'],
    draw(s, f, c) {
      f[0].innerHTML = `${row.plain(box(L('逼近误差', 'Approximation error'), L('函数类里最好的也有差距', 'even the best in the class is off')), box(L('统计误差', 'Statistical error'), L('数据是有限的', 'the data are finite')), box(L('优化误差', 'Optimisation error'), L('训练只走了有限步', 'training took finitely many steps')), box(L('离散化误差', 'Discretisation error'), L('采样只积了有限步', 'sampling integrated finitely many steps')), box(L('尾部误差', 'Tail error'), L('截断与无界区域', 'truncation and unbounded regions')))}
        <p class="aim-flow-h">${L('它们经过流的稳定性（下图）一起变成样本的误差。', 'Together they turn into sample error through the stability of the flow (below).')}</p>`;
      const ts = lin(0, 1, 201), bd = ts.map((t) => M.gronwall(t, s.Lc, s.e0, s.dl)), con = ts.map((t) => M.gronwall(t, -s.Lc, s.e0, s.dl)), ex = M.gronwallExample(s.Lc, s.e0, s.dl, 200);
      plot(f[1], { x: [0, 1], y: [0, Math.max(0.02, bd.at(-1)) * 1.08], xl: 't', yl: 'e(t)', series: [{ xs: ts, ys: bd, color: c.danger, width: 2.2, label: L('膨胀场（取到上界）', 'expanding field (attains the bound)') }, { xs: ts, ys: bd, color: c.gold, dash: [6, 5], width: 2.4, label: L('Grönwall 上界', 'Grönwall bound') }, { xs: ts, ys: ex, color: c.info, label: L('非线性例子', 'nonlinear example') }, { xs: ts, ys: con, color: c.ok, label: L('收缩场', 'contracting field') }] });
      return [[['上界 e(1)', 'Bound on e(1)'], fmt(bd.at(-1), 4), 1], [['放大因子 e^L', 'Amplification factor e^L'], fmt(Math.exp(s.Lc), 4)], [['非线性例子的 e(1)', 'e(1) of the nonlinear example'], fmt(ex.at(-1), 4)], [['收缩场的 e(1)', 'e(1) of the contracting field'], fmt(con.at(-1), 4)], [['上界 / 收缩场', 'Bound / contracting field'], con.at(-1) > 0 ? `${fmt(bd.at(-1) / con.at(-1))}×` : '—']];
    },
  };

  // ── 43 五条主线 ─────────────────────────────────────────────────────────
  D['43'] = {
    title: ['五条主线，各连到哪些主题', 'The five threads and the topics each one connects'],
    figs: [['html', ['', '']]],
    draw(s, f) {
      f[0].innerHTML = `<div class="aim-threadmap">${K.D.threads.map((t) => `<div class="aim-threadrow">${row(box(tx(t.name), '', 'is-gold'), box(tx(t.mid)), box(tx(t.out), '', 'is-accent'))}<p>${t.topics.map(tlink).join('')}</p></div>`).join('')}</div>
        <p class="aim-flow-h">${L('箭头表示联系，不表示算法严格等价。点任何一个主题跳过去。', 'Arrows mean a connection, not strict equivalence of algorithms. Click any topic to go there.')}</p>`;
      return [];
    },
  };

  // ── 44 一次研究级阅读 ───────────────────────────────────────────────────
  const PAPERS = [
    { name: ['DDPM（主题 20）', 'DDPM (topic 20)'], id: '20', o: [['x ∈ Rᵈ，时间步 t = 0…T', 'x ∈ Rᵈ, time steps t = 0…T'], ['q(xₜ|x₀) = N(√ᾱₜx₀, (1−ᾱₜ)I)；t=0 是数据', 'q(xₜ|x₀) = N(√ᾱₜx₀, (1−ᾱₜ)I); t=0 is data'], ['噪声预测网络 ε_θ(xₜ, t)', 'the noise-prediction network ε_θ(xₜ, t)'], ['E‖ε − ε_θ(xₜ, t)‖²（简化损失，改了时间权重）', 'E‖ε − ε_θ(xₜ, t)‖² (simplified loss, time weighting changed)'], ['随机抽 t 和 ε 做回归；采样时逐步去噪', 'regress on random t and ε; denoise step by step when sampling'], ['严格版本是变分下界；简化损失不等于完整 ELBO', 'the strict version is a variational bound; the simplified loss is not the full ELBO']] },
    { name: ['DPO（主题 33）', 'DPO (topic 33)'], id: '33', o: [['提示 x，回答 y 的离散集合', 'prompts x and a discrete set of answers y'], ['参考策略 π_ref(y|x)；偏好对 (y_w, y_l) 的数据分布', 'the reference policy π_ref(y|x); the data distribution of preference pairs (y_w, y_l)'], ['策略 π_θ(y|x)', 'the policy π_θ(y|x)'], ['−E log σ(β·对数比之差)', '−E log σ(β · difference of log-ratios)'], ['在偏好数据上做监督训练，不采样、不显式学奖励', 'supervised training on preference data, with no sampling and no explicit reward model'], ['等价性依赖 KL 正则目标、Bradley–Terry 模型和理想最优策略', 'the equivalence relies on the KL-regularised objective, the Bradley–Terry model and an ideal optimal policy']] },
    { name: ['流匹配（主题 24）', 'Flow matching (topic 24)'], id: '24', o: [['x ∈ Rᵈ，t ∈ [0, 1]；t=0 是噪声', 'x ∈ Rᵈ, t ∈ [0, 1]; t=0 is noise'], ['端点耦合 (X₀, X₁) 和插值路径 Xₜ', 'the coupling (X₀, X₁) of endpoints and the interpolation path Xₜ'], ['速度场 v_θ(x, t)', 'the velocity field v_θ(x, t)'], ['E‖v_θ(Xₜ, t) − (X₁ − X₀)‖²', 'E‖v_θ(Xₜ, t) − (X₁ − X₀)‖²'], ['训练不解 ODE；采样时沿学到的场积分', 'training solves no ODE; sampling integrates along the learned field'], ['最优解是条件期望，边缘路径正确；有限网络和离散求解另有误差', 'the optimum is the conditional expectation and reproduces the marginal path; finite networks and discrete solvers add their own errors']] },
  ];
  D['44'] = {
    title: ['把一篇论文压缩成六个对象', 'Compress a paper into six objects'],
    state: { i: 0 },
    act: PAPERS.map((p, i) => [p.name, (s) => { s.i = i; }]),
    figs: [['html', ['', '']]],
    note: ['三个例子是编者按讲义对应主题的内容填的，用来示范这张表怎么用；它们是对那几个主题的概括，不是对原论文的逐条复述。页面下方“读一篇前沿论文的清单”里有三轮检查的完整勾选表。', 'The three examples were filled in by the editor from the corresponding topics of the notes, to show how the table is used; they summarise those topics and do not restate the original papers line by line. The full tick-list of the three rounds is under “A checklist for reading a frontier paper” further down the page.'],
    stack: true,
    draw(s, f) {
      const p = PAPERS[s.i];
      f[0].innerHTML = `<table class="aim-table aim-six"><caption>${esc(tx(p.name))}</caption><tbody>${K.D.reading.objects.map((o, i) => `<tr><th scope="row"><span>${i + 1}</span>${esc(tx(o))}</th><td>${esc(tx(p.o[i]))}</td></tr>`).join('')}</tbody></table><p class="aim-flow-h">${tlink(p.id)}</p>`;
      return [[['最小可解例子', 'Smallest solvable example'], [L('两团高斯加噪（主题 20 的演示）', 'two noised Gaussian blobs (demo of topic 20)'), L('三个回答的解析最优策略（主题 33）', 'the closed-form optimal policy over three answers (topic 33)'), L('一维高斯流（主题 25）', 'the one-dimensional Gaussian flow (topic 25)')][s.i]]];
    },
  };

  // ── 附录 K：三个可复现的数值检查 ────────────────────────────────────────
  D.K = {
    kind: 'numeric',
    title: ['当场重跑讲义的数值核验', 'Re-running the notes’ numerical checks on the spot'],
    state: { seed: 37, n: 0 },
    act: [[['换一个种子重跑', 'Re-run with another seed'], (s) => { s.seed += 1; s.n += 1; }]],
    figs: [['html', ['', '']]],
    stack: true,
    note: ['“本页”一栏是你的浏览器刚刚算出来的。Euler / Heun 的误差表、组均值的 0.1575 和高斯流的导数检查不依赖随机数，应当和讲义逐位一致。注意力梯度和 Sinkhorn 两项依赖随机矩阵：讲义用的是 NumPy 的随机数序列（种子 37 和 20261112），浏览器里的发生器不同，生成不出同一组矩阵，所以数字不一样；能对照的是结论（相对误差很小、残差在舍入误差量级、谱范数是 1）。数值检查能抓住实现和代数错误，不是一般定理的证明。', 'The column “this page” was computed by your browser just now. The table of Euler / Heun errors, the group mean of 0.1575 and the derivative check of the Gaussian flow involve no random numbers and should agree with the notes digit for digit. The attention gradient and the Sinkhorn check depend on random matrices: the notes used NumPy’s random sequence (seeds 37 and 20261112), the browser’s generator is different and cannot produce the same matrices, so the digits differ; what can be compared is the conclusion (a tiny relative error, a residual at rounding level, a spectral norm of 1). Numerical checks catch errors of implementation and algebra; they do not prove general theorems.'],
    draw(s, f) {
      const R = M.RECORD, at = M.attnGradCheck(s.seed), P = M.sinkhornNormalize(M.positiveMatrix(6, 20261112 + s.n), 2000), fe = M.flowErrors(1), e3 = (v) => v.toExponential(3);
      const same = (a, b) => e3(a) === e3(b), okFlow = R.flow.every(([, a, b], i) => same(a, fe[i].euler) && same(b, fe[i].heun));
      const gm = M.groupMeanGradient(0.3, 4), loo = M.groupMeanGradient(0.3, 4, true), gap = M.flowDerivativeGap(), res = M.marginResidual(P), spec = M.specNorm(P, 400);
      const yes = `<b class="aim-ok">${L('一致', 'agrees')}</b>`, concl = `<b class="aim-ok">${L('结论一致', 'same conclusion')}</b>`, no = `<b class="aim-bad">${L('不一致', 'differs')}</b>`;
      const rowsHtml = [
        [L('注意力：解析方向导数', 'Attention: analytic directional derivative'), at.analytic.toFixed(10), R.attn.analytic.toFixed(10), L('随机矩阵不同', 'different random matrices')],
        [L('注意力：中心差分', 'Attention: central difference'), at.numeric.toFixed(10), R.attn.numeric.toFixed(10), ''],
        [L('注意力：相对误差', 'Attention: relative error'), e3(at.rel), e3(R.attn.rel), at.rel < 1e-6 ? concl : no],
        [L('Sinkhorn：行列和的最大偏差', 'Sinkhorn: largest deviation of row and column sums'), e3(res), e3(R.sinkhorn.residual), res < 1e-12 ? concl : no],
        [L('Sinkhorn：谱范数', 'Sinkhorn: spectral norm'), spec.toFixed(12), R.sinkhorn.spec.toFixed(12), Math.abs(spec - 1) < 1e-9 ? concl : no],
        [L('高斯流：轨迹导数 − 速度场（最大）', 'Gaussian flow: derivative of the path − velocity (max)'), e3(gap), e3(R.flowDeriv), gap < 1e-8 ? concl : no],
        [L('组均值基线的期望（p = 0.3，G = 4）', 'Expectation with the group-mean baseline (p = 0.3, G = 4)'), gm.toFixed(4), R.groupMean.toFixed(4), Math.abs(gm - R.groupMean) < 5e-5 ? yes : no],
        [L('留一法基线的期望（应为 0.21）', 'Expectation with the leave-one-out baseline (should be 0.21)'), loo.toFixed(4), '0.2100', Math.abs(loo - 0.21) < 5e-5 ? yes : no],
        ...R.flow.map(([n, a, b], i) => [L(`高斯流 n = ${n}：Euler / Heun 终点误差`, `Gaussian flow n = ${n}: Euler / Heun endpoint error`), `${e3(fe[i].euler)} / ${e3(fe[i].heun)}`, `${e3(a)} / ${e3(b)}`, same(a, fe[i].euler) && same(b, fe[i].heun) ? yes : no]),
      ];
      f[0].innerHTML = `<table class="aim-table aim-checks"><thead><tr><th>${L('检查', 'Check')}</th><th>${L('本页（刚算的）', 'This page (just computed)')}</th><th>${L('讲义的记录', 'The notes’ record')}</th><th></th></tr></thead><tbody>${rowsHtml.map((r) => `<tr><td>${esc(r[0])}</td><td>${r[1]}</td><td>${r[2]}</td><td>${r[3]}</td></tr>`).join('')}</tbody></table>`;
      return [[['注意力检查用的种子', 'Seed of the attention check'], String(s.seed)], [['误差表 12 个数', 'The 12 numbers of the error table'], okFlow ? L('逐位一致', 'agree digit for digit') : L('有不一致', 'some differ'), 1]];
    },
  };

  // ── 附录 L：学习路线 ────────────────────────────────────────────────────
  const STAGES = [[['阶段 1：优化与表征', 'Stage 1: optimisation and representation'], ['02', '04', '06', '11', '08', 'A', 'B']], [['阶段 2：生成与决策', 'Stage 2: generation and decision'], ['21', 'D', '23', '24', 'F', '25', '22', 'E', '33', 'I', '31', 'H']], [['阶段 3：研究问题', 'Stage 3: research questions'], ['26', '27', '09', '32', '42', 'K']]];
  D.L = {
    kind: 'construct',
    title: ['按依赖顺序走：每个阶段去哪几页动手', 'In order of dependency: where to get your hands dirty at each stage'],
    figs: [['html', ['', '']]],
    draw(s, f) {
      f[0].innerHTML = `<div class="aim-threadmap">${STAGES.map(([h, ids]) => `<div class="aim-threadrow"><p class="aim-flow-h">${esc(tx(h))}</p><p>${ids.map(tlink).join('')}</p></div>`).join('')}</div>
        <p class="aim-flow-h">${L('每个阶段留下一个推导、一张图和一个反例。并不要求先读完所有数学才开始做实验。', 'Leave one derivation, one figure and one counter-example behind at each stage. There is no need to finish all the mathematics before starting experiments.')}</p>`;
      return [];
    },
  };
});
