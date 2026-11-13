'use strict';
// 前沿 AI 数学 · 演示 17–29（生成的统一数学）。写法见 aim-demos-a.js 开头的说明。
(window.MOLASTRIA_AIM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, pct, plot, heat, lin, box, row, esc } = K;
  const f2 = (v) => v.toFixed(2), int = (v) => String(Math.round(v));
  const draws = (n, seed) => { const r = M.rng(seed); return Array.from({ length: n }, () => M.gauss(r)); };

  // ── 17 三条路线 ─────────────────────────────────────────────────────────
  D['17'] = {
    title: ['同一个联合分布，三种写法', 'One joint distribution, three ways to write it'],
    ctl: [['p1', ['p(x₁ = 1)', 'p(x₁ = 1)'], 0.02, 0.98, 0.01, 0.6, f2], ['p0', ['p(x₂ = 1 | x₁ = 0)', 'p(x₂ = 1 | x₁ = 0)'], 0.02, 0.98, 0.01, 0.2, f2], ['p11', ['p(x₂ = 1 | x₁ = 1)', 'p(x₂ = 1 | x₁ = 1)'], 0.02, 0.98, 0.01, 0.9, f2]],
    figs: [['html', ['', '']], [0.42, ['两个二值变量的联合概率表，由链式法则 p(x₁)p(x₂|x₁) 得到。四格之和恒为 1。', 'The joint table of two binary variables, obtained from the chain rule p(x₁)p(x₂|x₁). The four cells always sum to 1.']]],
    note: ['上面三行是示意。下面的小例子把前两条路线放在同一张表里：按顺序看，它是自回归分解 p(x₁)p(x₂|x₁)；把 x₁ 当成看不见的潜变量 z，x₂ 的分布就是对 z 求和的边缘分布 p(x₂) = Σ_z p(z)p(x₂|z)，两个变量时能直接算，高维连续的 z 就积不出来了，这正是 VAE 要用变分下界的原因。第三条路线（运输）在主题 20–28 有各自的演示。', 'The three rows on top are a sketch. The small example below puts the first two routes in one table: read in order, it is the autoregressive factorisation p(x₁)p(x₂|x₁); treat x₁ as an unseen latent z, and the distribution of x₂ is the marginal p(x₂) = Σ_z p(z)p(x₂|z), which can be summed for two values but not integrated for a high-dimensional continuous z; that is why a VAE needs a variational bound. The third route, transport, has its own demos in topics 20–28.'],
    draw(s, f) {
      f[0].innerHTML = `<p class="aim-flow-h">${L('自回归：把联合概率逐项分解', 'Autoregression: factorise the joint term by term')}</p>${row(box('p(x₁)'), box('p(x₂ | x₁)'), box('p(x₃ | x₁, x₂)'), box('…'), box('p(x)', L('精确似然', 'exact likelihood'), 'is-accent'))}
        <p class="aim-flow-h">${L('潜变量：先抽 z，再生成 x', 'Latent variables: draw z, then generate x')}</p>${row(box('z ~ p(z)'), box('p_θ(x | z)', L('解码器', 'decoder')), box('p_θ(x) = ∫ p_θ(x|z) p(z) dz', L('一般积不出来', 'usually intractable'), 'is-gold'))}
        <p class="aim-flow-h">${L('运输：把简单分布搬到数据分布', 'Transport: carry a simple distribution to the data')}</p>${row(box(L('噪声 x₀', 'Noise x₀'), 'N(0, I)'), box(L('ODE 或 SDE', 'ODE or SDE'), L('速度场 / score', 'velocity field / score')), box(L('数据 x₁', 'Data x₁'), L('概率路径 pₜ', 'probability path pₜ'), 'is-accent'))}`;
      const J = [[(1 - s.p1) * (1 - s.p0), (1 - s.p1) * s.p0], [s.p1 * (1 - s.p11), s.p1 * s.p11]];
      heat(f[1], J, { rows: ['x₁ = 0', 'x₁ = 1'], cols: ['x₂ = 0', 'x₂ = 1'], max: 1, fmt: (v) => v.toFixed(3) });
      const m2 = J[0][1] + J[1][1];
      return [[['四格之和', 'Sum of the four cells'], fmt(J.flat().reduce((a, b) => a + b, 0), 6)], [['边缘 p(x₂ = 1) = Σ p(x₁)p(x₂|x₁)', 'Marginal p(x₂ = 1) = Σ p(x₁)p(x₂|x₁)'], fmt(m2, 4), 1], [['序列 (1, 1) 的对数似然', 'Log-likelihood of the sequence (1, 1)'], fmt(Math.log(s.p1) + Math.log(s.p11), 4)], [['后验 p(x₁ = 1 | x₂ = 1)', 'Posterior p(x₁ = 1 | x₂ = 1)'], fmt(J[1][1] / m2, 4)]];
    },
  };

  // ── 18 VAE ──────────────────────────────────────────────────────────────
  D['18'] = {
    title: ['编码器给出的 q(z|x) 离先验多远', 'How far the encoder’s q(z|x) is from the prior'],
    ctl: [['mu', ['q 的均值 μ', 'Mean μ of q'], -3, 3, 0.05, 1, f2], ['sd', ['q 的标准差 σ', 'Standard deviation σ of q'], 0.1, 3, 0.01, 0.6, f2], ['eps', ['抽到的噪声 ε', 'Noise drawn, ε'], -3, 3, 0.05, 0.5, f2]],
    btn: [[['和先验重合', 'Equal to the prior'], { mu: 0, sd: 1 }], [['后验坍缩的样子', 'What collapse looks like'], { mu: 0.02, sd: 0.98 }], [['很窄的 q', 'A very narrow q'], { mu: 1.5, sd: 0.15 }]],
    figs: [[0.46, ['先验 N(0,1)（虚线）和 q = N(μ, σ²)。金色的点是重参数化得到的样本 z = μ + σε。', 'The prior N(0,1) (dashed) and q = N(μ, σ²). The gold point is the reparametrised sample z = μ + σε.']], [0.38, ['固定 μ 时 KL 随 σ 的变化：最小点总在 σ = 1。', 'KL against σ at fixed μ: the minimum is always at σ = 1.']]],
    note: ['一维的情形：KL(q‖p) = ½(μ² + σ² − 1 − log σ²)（附录 C）。读数里的“数值积分”是把 q·log(q/p) 直接积出来，用来核对闭式。重参数化把随机性放进 ε，z 对 μ 和 σ 的导数分别是 1 和 ε，所以梯度可以穿过采样。KL 降到接近 0 时 q 不再携带 x 的信息，这就是后验坍缩。', 'The one-dimensional case: KL(q‖p) = ½(μ² + σ² − 1 − log σ²) (Appendix C). The numerical integral in the read-out integrates q·log(q/p) directly as a check on the closed form. Reparametrisation puts the randomness into ε; the derivatives of z with respect to μ and σ are 1 and ε, so gradients pass through sampling. When the KL falls close to 0, q carries no information about x, which is posterior collapse.'],
    draw(s, f, c) {
      const xs = lin(-5, 5, 401), z = s.mu + s.sd * s.eps, q = xs.map((x) => M.normalPdf(x, s.mu, s.sd));
      plot(f[0], { x: [-5, 5], y: [0, Math.min(3, Math.max(0.45, Math.max(...q) * 1.1))], xl: 'z', yl: L('密度', 'density'), series: [{ xs, ys: xs.map((x) => M.normalPdf(x)), color: c.muted, dash: [5, 4], label: 'p(z)' }, { xs, ys: q, color: c.accent, fill: true, label: 'q(z|x)' }], marks: [{ x: z, y: M.normalPdf(z, s.mu, s.sd), color: c.gold }] });
      const sds = lin(0.1, 3, 200), kl = M.gaussKL(s.mu, s.sd);
      plot(f[1], { x: [0, 3], y: [0, Math.max(1, M.gaussKL(s.mu, 0.1))], xl: 'σ', yl: 'KL', series: [{ xs: sds, ys: sds.map((v) => M.gaussKL(s.mu, v)), color: c.accent }], marks: [{ x: s.sd, y: kl, color: c.gold }] });
      return [[['KL：闭式', 'KL: closed form'], fmt(kl, 6), 1], [['KL：数值积分', 'KL: numerical integral'], fmt(M.gaussKLnumeric(s.mu, s.sd), 6)], [['样本 z = μ + σε', 'Sample z = μ + σε'], fmt(z, 4), 1], [['∂z/∂μ，∂z/∂σ', '∂z/∂μ, ∂z/∂σ'], `1, ${fmt(s.eps)}`]];
    },
  };

  // ── 19 离散扩散 ─────────────────────────────────────────────────────────
  const TOK = { zh: ['扩散', '模型', '把', '一句', '话', '里', '的', '词', '随机', '遮住', '，', '再', '学会', '把', '它们', '还原'], en: ['A', 'diffusion', 'model', 'hides', 'the', 'words', 'of', 'a', 'sentence', 'at', 'random', 'and', 'learns', 'to', 'restore', 'them'] };
  D['19'] = {
    title: ['掩码扩散：遮住，再一轮一轮还原', 'Masked diffusion: hide, then restore round by round'],
    ctl: [['t', ['加噪：掩码概率 t', 'Corruption: masking probability t'], 0, 1, 0.01, 0.5, f2], ['rv', ['生成：已经还原了几个词', 'Generation: tokens restored so far'], 0, 16, 1, 6, int]],
    play: 't',
    figs: [['html', ['', '']], ['html', ['', '']]],
    note: ['上面一行是前向过程：每个词独立地以概率 t 变成掩码 [M]（用的是同一组固定的均匀随机数，所以 t 增大时被遮的词只增不减）。下面一行是生成的示意：从全掩码出发，每一轮定下几个位置；这里还原的顺序是固定种子的随机顺序，真实模型按预测的置信度选位置。这个演示没有模型，“还原”出的就是原句，只展示过程。权重 1/t 是这一种时间参数化下连续时间目标的权重 [20]，不是所有掩码重建损失都对应同一个似然下界。', 'The upper row is the forward process: each token independently becomes the mask [M] with probability t (the same fixed uniform numbers are reused, so the masked set only grows with t). The lower row sketches generation: start fully masked and fix a few positions per round; the order here is a random order with a fixed seed, whereas real models pick positions by predicted confidence. There is no model in this demo; what is “restored” is the original sentence, to show the process only. The weight 1/t is that of a continuous-time objective under this parametrisation of time [20]; not every mask-reconstruction loss corresponds to the same likelihood bound.'],
    draw(s, f) {
      const tok = K.en ? TOK.en : TOK.zh, mask = M.maskTokens(16, s.t), order = M.unmaskOrder(16), shown = new Set(order.slice(0, s.rv));
      const chips = (hide, fresh) => `<div class="aim-tokens">${tok.map((w, i) => (hide(i) ? '<span class="is-mask">[M]</span>' : `<span${fresh?.(i) ? ' class="is-new"' : ''}>${esc(w)}</span>`)).join('')}</div>`;
      f[0].innerHTML = `<p class="aim-flow-h">${L(`前向：t = ${s.t.toFixed(2)}`, `Forward: t = ${s.t.toFixed(2)}`)}</p>${chips((i) => mask[i])}`;
      f[1].innerHTML = `<p class="aim-flow-h">${L(`生成：还原了 ${s.rv} / 16`, `Generation: ${s.rv} of 16 restored`)}</p>${chips((i) => !shown.has(i), (i) => s.rv > 0 && order[s.rv - 1] === i)}`;
      const n = mask.filter(Boolean).length;
      return [[['被遮的词数', 'Tokens masked'], `${n} / 16`, 1], [['期望值 16t', 'Expected value 16t'], fmt(16 * s.t)], [['这一时刻的损失权重 1/t', 'Loss weight at this time, 1/t'], s.t > 0 ? fmt(1 / s.t) : '∞'], [['生成时还剩的掩码', 'Masks left in generation'], String(16 - s.rv)]];
    },
  };

  // ── 20 DDPM ─────────────────────────────────────────────────────────────
  const AB = M.alphaBar(), BLOB = M.twoBlobs(360);
  D['20'] = {
    title: ['加噪有闭式：直接跳到任意一步', 'Noising in closed form: jump straight to any step'],
    ctl: [['t', ['时间步 t（共 1000 步）', 'Time step t (of 1000)'], 0, 1000, 1, 250, int]],
    play: 't',
    btn: [[['t = 0：数据', 't = 0: data'], { t: 0 }], [['t = 250', 't = 250'], { t: 250 }], [['t = 1000：噪声', 't = 1000: noise'], { t: 1000 }]],
    figs: [[0.6, ['两团二维样本按 xₜ = √ᾱₜ·x₀ + √(1−ᾱₜ)·ε 加噪。每个点用的 ε 固定不变，所以拖动滑块看到的是同一批点。', 'Two blobs of two-dimensional samples noised by xₜ = √ᾱₜ·x₀ + √(1−ᾱₜ)·ε. Each point keeps its own fixed ε, so the slider moves the same set of points.']], [0.36, ['信号系数 √ᾱₜ 和噪声系数 √(1−ᾱₜ) 随 t 的变化（线性 β 日程，从 10⁻⁴ 到 0.02）。', 'The signal coefficient √ᾱₜ and the noise coefficient √(1−ᾱₜ) against t (linear β schedule from 10⁻⁴ to 0.02).']]],
    note: ['日程是 DDPM 原文 [17] 的线性 β（10⁻⁴ 到 0.02，1000 步），ᾱₜ 是 (1−βₛ) 的连乘。两个系数的平方和恒为 1。终点 ᾱ_T ≈ 4×10⁻⁵，足够接近 0，所以 x_T 近似标准高斯；如果日程让 ᾱ_T 不够小，终点就带着残留的信号。演示只有前向过程，去噪需要学出来的网络。', 'The schedule is the linear β of the original DDPM paper [17] (10⁻⁴ to 0.02 over 1000 steps), and ᾱₜ is the running product of (1−βₛ). The squares of the two coefficients always sum to 1. At the end ᾱ_T ≈ 4×10⁻⁵, close enough to 0 for x_T to be nearly standard Gaussian; a schedule that leaves ᾱ_T too large keeps residual signal at the end. Only the forward process is shown; denoising needs a learned network.'],
    draw(s, f, c) {
      const t = Math.round(s.t), ab = AB[t], pts = M.noised(BLOB.x0, BLOB.eps, ab);
      plot(f[0], { x: [-4.2, 4.2], y: [-3, 3], eq: true, series: [{ pts: pts.filter((_, i) => i % 2 === 0), color: c.accent, dots: 2.4, alpha: 0.75 }, { pts: pts.filter((_, i) => i % 2 === 1), color: c.gold, dots: 2.4, alpha: 0.75 }] });
      const ts = lin(0, 1000, 201).map(Math.round);
      plot(f[1], { x: [0, 1000], y: [0, 1.05], xl: 't', series: [{ xs: ts, ys: ts.map((u) => Math.sqrt(AB[u])), color: c.accent, label: '√ᾱₜ' }, { xs: ts, ys: ts.map((u) => Math.sqrt(1 - AB[u])), color: c.gold, label: '√(1−ᾱₜ)' }], marks: [{ x: t, color: c.muted }] });
      return [[['ᾱₜ', 'ᾱₜ'], fmt(ab, 4), 1], [['信号系数 √ᾱₜ', 'Signal coefficient √ᾱₜ'], fmt(Math.sqrt(ab), 4)], [['噪声系数 √(1−ᾱₜ)', 'Noise coefficient √(1−ᾱₜ)'], fmt(Math.sqrt(1 - ab), 4)], [['信噪比 ᾱₜ/(1−ᾱₜ)', 'Signal-to-noise ratio ᾱₜ/(1−ᾱₜ)'], t ? fmt(ab / (1 - ab)) : '∞']];
    },
  };

  // ── 21 Score ────────────────────────────────────────────────────────────
  D['21'] = {
    title: ['双峰密度的 score，和它给出的去噪结果', 'The score of a bimodal density, and the denoiser it gives'],
    ctl: [['m', ['两个峰离中心多远', 'Distance of the modes from the centre'], 0.5, 3, 0.05, 1.5, f2], ['sg', ['加的噪声 σ', 'Noise added, σ'], 0, 3, 0.02, 0.5, f2], ['x', ['探针的位置 x', 'Probe position x'], -5, 5, 0.05, 0.6, f2]],
    btn: [[['没有噪声', 'No noise'], { sg: 0 }], [['噪声很大', 'Heavy noise'], { sg: 2.5 }], [['探针放在两峰中间', 'Probe midway between the modes'], { x: 0 }]],
    figs: [[0.36, ['加噪后的密度 pσ(x)。', 'The noised density pσ(x).']], [0.36, ['score = ∂ₓ log pσ(x)：正值指向右，负值指向左。两峰中间那个零点是不稳定的低密度点。', 'score = ∂ₓ log pσ(x): positive points right, negative points left. The zero between the modes is an unstable point of low density.']], [0.42, ['最优去噪 E[x₀ | x]（实线）。虚线是 y = x。', 'The optimal denoiser E[x₀ | x] (solid). The dashed line is y = x.']]],
    note: ['x₀ 是两个标准差 0.5 的高斯等权混合，x = x₀ + σε，所以密度、score 和后验均值都有闭式（附录 D）。读数里把“直接算的后验均值”和“Tweedie 公式 x + σ²·score”放在一起对照，两者应当相等。探针放在 x = 0 时 score 为 0，去噪结果也是 0：它是两个峰的平均，本身并不是一个像样的样本，这就是“条件均值不等于还原出原始样本”。', 'x₀ is an equal mixture of two Gaussians of standard deviation 0.5 and x = x₀ + σε, so the density, the score and the posterior mean all have closed forms (Appendix D). The read-out puts the directly computed posterior mean next to Tweedie’s formula x + σ²·score; the two should agree. With the probe at x = 0 the score is 0 and the denoised value is 0 as well: it is the average of the two modes and not a plausible sample, which is the sense in which a conditional mean does not restore the original sample.'],
    draw(s, f, c) {
      const xs = lin(-5, 5, 401), g = xs.map((x) => M.gmm(x, s.m, 0.5, 1, s.sg)), at = M.gmm(s.x, s.m, 0.5, 1, s.sg);
      plot(f[0], { x: [-5, 5], y: [0, Math.max(...g.map((v) => v.p)) * 1.1], xl: 'x', yt: [], series: [{ xs, ys: g.map((v) => v.p), color: c.accent, fill: true }], marks: [{ x: s.x, y: at.p, color: c.gold }] });
      const sm = Math.min(12, Math.max(1, ...g.map((v) => Math.abs(v.score))));
      plot(f[1], { x: [-5, 5], y: [-sm, sm], xl: 'x', yl: 'score', series: [{ xs, ys: g.map((v) => v.score), color: c.accent }], hmarks: [{ y: 0, color: c.faint }], marks: [{ x: s.x, y: at.score, color: c.gold }] });
      plot(f[2], { x: [-5, 5], y: [-3.6, 3.6], xl: 'x', yl: 'E[x₀ | x]', series: [{ xs, ys: g.map((v) => v.denoise), color: c.accent }, { xs: [-5, 5], ys: [-5, 5], color: c.faint, dash: [4, 4], width: 1.2 }], hmarks: [{ y: s.m, color: c.line }, { y: -s.m, color: c.line }], marks: [{ x: s.x, y: at.denoise, color: c.gold }] });
      return [[['探针处的 score', 'Score at the probe'], fmt(at.score, 4), 1], [['E[x₀ | x]：直接算', 'E[x₀ | x]: computed directly'], fmt(at.denoise, 5), 1], [['x + σ²·score（Tweedie）', 'x + σ²·score (Tweedie)'], fmt(s.x + s.sg * s.sg * at.score, 5)], [['属于右峰的后验概率', 'Posterior probability of the right mode'], pct(at.w2)]];
    },
  };

  // ── 22 SDE 与概率流 ODE ─────────────────────────────────────────────────
  D['22'] = {
    title: ['同样的边缘分布，两种完全不同的路径', 'The same marginals, two entirely different kinds of path'],
    ctl: [['th', ['回复强度 θ', 'Mean reversion θ'], 0.1, 2, 0.05, 0.9, f2], ['g', ['扩散系数 g', 'Diffusion coefficient g'], 0.1, 1.5, 0.05, 0.8, f2]],
    chk: [['rev', ['上图改成反向 SDE（从 t = T 走回 0）', 'Show the reverse SDE in the upper figure (from t = T back to 0)'], false]],
    btn: [[['讲义的设定 θ = 0.9，g = 0.8', 'The notes’ setting θ = 0.9, g = 0.8'], { th: 0.9, g: 0.8 }], [['噪声更大', 'More noise'], { th: 0.5, g: 1.4 }]],
    act: [[['换一组随机数', 'New random numbers'], (s) => { s.seed = (s.seed || 20261112) + 1; }]],
    figs: [[0.46, ['SDE 的 40 条样本路径（Euler–Maruyama，400 步）。金色虚线是理论的 ±2 个标准差。', 'Forty sample paths of the SDE (Euler–Maruyama, 400 steps). The gold dashed lines are the theoretical ±2 standard deviations.']], [0.46, ['概率流 ODE 从同样的起点出发的 40 条路径：光滑、互不相交，但每个时刻的分布和上图一样。', 'Forty paths of the probability flow ODE from the same starting points: smooth and never crossing, yet with the same distribution as above at every time.']]],
    note: ['过程是 OU：dX = −θX dt + g dW，X₀ ~ N(0,1)，方差 v(t) 有闭式，所以 score = −x/v(t) 是精确的。概率流 ODE 的速度是 f − ½g²·score，这里解出来就是 x(t) = x₀√(v(t)/v₀)。反向 SDE 用正时钟 τ = T − t 写成 dX = [θX + g²·score]dτ + g dW，从 N(0, v(T)) 出发走回去，终点的方差应当回到 1。读数里的样本方差只有 40 条路径，会有抽样误差；score 在这里是精确的，真实模型里它是学出来的，SDE 和 ODE 就不再保证给出同一个分布。', 'The process is OU: dX = −θX dt + g dW with X₀ ~ N(0,1); the variance v(t) is known in closed form, so the score −x/v(t) is exact. The probability flow ODE has velocity f − ½g²·score, which here solves to x(t) = x₀√(v(t)/v₀). The reverse SDE, written with the forward-running clock τ = T − t as dX = [θX + g²·score]dτ + g dW, starts from N(0, v(T)) and walks back; its final variance should return to 1. The sample variances in the read-out come from only 40 paths and carry sampling error; the score is exact here, whereas in a real model it is learned and the SDE and ODE are no longer guaranteed to give the same distribution.'],
    draw(s, f, c) {
      const T = 3, n = 40, steps = 400, seed = s.seed || 20261112, ts = lin(0, T, steps + 1), band = ts.map((t) => 2 * Math.sqrt(M.ouVar(t, s.th, s.g)));
      const fwd = M.ouPaths(n, steps, T, s.th, s.g, seed), paths = s.rev ? M.ouReverse(n, steps, T, s.th, s.g, seed) : fwd;
      const bandSeries = (b, xs) => [{ xs, ys: b, color: c.gold, dash: [5, 4], width: 1.4, label: '±2√v(t)' }, { xs, ys: b.map((v) => -v), color: c.gold, dash: [5, 4], width: 1.4 }];
      const tr = s.rev ? [...ts].reverse() : ts;
      plot(f[0], { x: [0, T], y: [-3.2, 3.2], xl: s.rev ? L('t（反向过程从右往左走）', 't (the reverse process runs right to left)') : 't', yl: 'x', series: [...paths.map((p) => ({ xs: tr, ys: p, color: c.accent, width: 1, alpha: 0.45 })), ...bandSeries(band, ts)] });
      const starts = fwd.map((p) => p[0]);
      plot(f[1], { x: [0, T], y: [-3.2, 3.2], xl: 't', yl: 'x', series: [...starts.map((x0) => ({ xs: ts, ys: ts.map((t) => M.ouFlow(x0, t, s.th, s.g)), color: c.info, width: 1, alpha: 0.6 })), ...bandSeries(band, ts)] });
      const v = (arr) => { const m = arr.reduce((a, b) => a + b, 0) / arr.length; return arr.reduce((a, b) => a + (b - m) ** 2, 0) / arr.length; };
      const vT = M.ouVar(T, s.th, s.g);
      return [[['理论方差 v(T)', 'Theoretical variance v(T)'], fmt(vT, 4), 1], [['平稳方差 g²/(2θ)', 'Stationary variance g²/(2θ)'], fmt((s.g * s.g) / (2 * s.th), 4)], [[s.rev ? '反向 SDE 终点（t = 0）的样本方差，应约为 1' : 'SDE 终点的样本方差', s.rev ? 'Sample variance at the end of the reverse SDE (t = 0), should be about 1' : 'Sample variance at the end of the SDE'], fmt(v(paths.map((p) => p.at(-1))), 3)], [['ODE 终点的样本方差', 'Sample variance at the end of the ODE'], fmt(v(starts.map((x0) => M.ouFlow(x0, T, s.th, s.g))), 3)], [['ODE 的 score 系数 / SDE 反向的系数', 'Score coefficient: ODE / reverse SDE'], '½g² / g²']];
    },
  };

  // ── 23 连续性方程与 CNF ─────────────────────────────────────────────────
  D['23'] = {
    title: ['速度场搬粒子，散度改密度', 'The velocity field moves particles; the divergence changes the density'],
    ctl: [['lam', ['速度场 v(x) = −λx 的 λ', 'λ in the velocity field v(x) = −λx'], -0.8, 2, 0.05, 0.8, f2], ['t', ['时间 t', 'Time t'], 0, 2, 0.01, 1, f2]],
    play: 't',
    btn: [[['收缩 λ = 0.8', 'Contracting, λ = 0.8'], { lam: 0.8 }], [['膨胀 λ = −0.5', 'Expanding, λ = −0.5'], { lam: -0.5 }]],
    figs: [[0.42, ['t = 0 的密度（虚线）、时刻 t 的密度（实线）和 15 个粒子的位置（竖线）。', 'The density at t = 0 (dashed), at time t (solid), and the positions of 15 particles (sticks).']], [0.38, ['沿着从 x₀ = 1 出发的轨迹，log p 随时间的变化：斜率恒为 −∇·v = λ。金色的点是把时刻 t 的密度直接代进去算的。', 'log p along the trajectory from x₀ = 1 against time: the slope is always −∇·v = λ. The gold point evaluates the density at time t directly.']]],
    note: ['一维线性场 v = −λx 的流是 Xₜ = e^{−λt}X₀，N(0,1) 被搬成 N(0, e^{−2λt})，全部都有闭式。散度 ∇·v = −λ 是常数，所以沿轨迹 d log p/dt = λ：粒子挤到一起（λ > 0）时密度按 e^{λt} 升高。高维里散度是 Jacobian 的迹，直接算要 d 次反向传播，Hutchinson 估计用随机探针 εᵀJε 来近似，代价是估计方差。', 'The flow of the one-dimensional linear field v = −λx is Xₜ = e^{−λt}X₀, carrying N(0,1) to N(0, e^{−2λt}), all in closed form. The divergence ∇·v = −λ is constant, so d log p/dt = λ along a trajectory: when particles are squeezed together (λ > 0) the density rises as e^{λt}. In high dimension the divergence is the trace of the Jacobian, costing d backward passes; the Hutchinson estimator approximates it with random probes εᵀJε at the price of estimator variance.'],
    draw(s, f, c) {
      const w = Math.max(4, 3.2 * Math.exp(-s.lam * s.t)), xs = lin(-w, w, 401), p0 = lin(-2.1, 2.1, 15), k = Math.exp(-s.lam * s.t);
      const top = Math.max(0.45, M.contractDensity(0, s.t, s.lam) * 1.1);
      plot(f[0], { x: [-w, w], y: [0, top], xl: 'x', yl: L('密度', 'density'), series: [{ xs, ys: xs.map((x) => M.normalPdf(x)), color: c.muted, dash: [5, 4], label: 'p₀' }, { xs, ys: xs.map((x) => M.contractDensity(x, s.t, s.lam)), color: c.accent, fill: true, label: 'pₜ' }, { xs: p0.map((x) => x * k), ys: p0.map(() => top * 0.08), color: c.gold, sticks: true, width: 2, label: L('粒子', 'particles') }] });
      const ts = lin(0, 2, 101), lp = (t) => M.contractLogP(1, t, s.lam), direct = Math.log(M.contractDensity(k, s.t, s.lam));
      const ys = ts.map(lp), lo = Math.min(...ys, direct) - 0.3, hi = Math.max(...ys, direct) + 0.3;
      plot(f[1], { x: [0, 2], y: [lo, hi], xl: 't', yl: 'log pₜ(Xₜ)', series: [{ xs: ts, ys, color: c.accent, label: L('沿轨迹积分 −∇·v', 'integrating −∇·v along the path') }], marks: [{ x: s.t, y: direct, color: c.gold }] });
      return [[['散度 ∇·v', 'Divergence ∇·v'], fmt(-s.lam)], [['时刻 t 的标准差 e^{−λt}', 'Standard deviation at t, e^{−λt}'], fmt(k, 4), 1], [['log p：沿轨迹积分', 'log p: integrated along the path'], fmt(lp(s.t), 6)], [['log p：直接代入密度', 'log p: density evaluated directly'], fmt(direct, 6)]];
    },
  };

  // ── 24 流匹配 ───────────────────────────────────────────────────────────
  const FZ0 = draws(300, 24001), FZ1 = draws(300, 24002).map((z) => 2 + 0.5 * z);
  D['24'] = {
    title: ['成对的直线相互交叉，回归出来的速度场不交叉', 'The paired straight lines cross; the regressed velocity field does not'],
    ctl: [['t', ['时间 t', 'Time t'], 0, 0.99, 0.01, 0.5, f2]],
    play: 't',
    figs: [[0.46, ['训练用的 40 条直线：x₀ ~ N(0,1) 和 x₁ ~ N(2, 0.25) 独立配对。竖线是当前的 t。', 'Forty training lines: x₀ ~ N(0,1) and x₁ ~ N(2, 0.25) paired independently. The vertical line marks the current t.']], [0.46, ['同一时刻 300 对样本的（位置 Xₜ，速度 U = X₁ − X₀）。金线是条件期望 v*(x, t) = E[U | Xₜ = x]，也就是回归的最优解。', 'Position Xₜ against velocity U = X₁ − X₀ for 300 pairs at the same moment. The gold line is the conditional expectation v*(x, t) = E[U | Xₜ = x], the optimum of the regression.']], [0.46, ['沿着 v* 积分得到的轨迹（解析解），从上图同样的 40 个起点出发：互不相交，而且是弯的。', 'Trajectories obtained by integrating v* (in closed form) from the same 40 starting points: they never cross, and they are curved.']]],
    note: ['同一个位置和时间可以来自很多对端点，它们的速度各不相同（中间那张图上竖直方向的散布）。平方损失回归把这些速度平均成条件期望，网络只需要看当前位置和时间。这里端点是独立的高斯，所以 v* 有闭式（主题 25）；读数里把 300 对样本做最小二乘得到的斜率和解析斜率放在一起，差别来自有限样本。训练时不需要解 ODE，采样时仍然要沿学到的场积分。', 'One position and time can come from many pairs of endpoints, each with a different velocity (the vertical spread in the middle figure). Squared-error regression averages those velocities into the conditional expectation, and the network needs only the current position and time. The endpoints here are independent Gaussians, so v* has a closed form (topic 25); the read-out places the least-squares slope from the 300 pairs next to the analytic slope, and the gap is the finite sample. Training needs no ODE solve; sampling still integrates along the learned field.'],
    draw(s, f, c) {
      const t = s.t, n = 40;
      plot(f[0], { x: [0, 1], y: [-3, 3.6], xl: 't', yl: 'x', series: FZ0.slice(0, n).map((x0, i) => ({ xs: [0, 1], ys: [x0, FZ1[i]], color: c.accent, width: 1, alpha: 0.5 })), marks: [{ x: t, color: c.gold }] });
      const xt = FZ0.map((x0, i) => (1 - t) * x0 + t * FZ1[i]), u = FZ0.map((x0, i) => FZ1[i] - x0);
      const mx = xt.reduce((a, b) => a + b, 0) / 300, mu = u.reduce((a, b) => a + b, 0) / 300, sxx = xt.reduce((a, b) => a + (b - mx) ** 2, 0), sxu = xt.reduce((a, b, i) => a + (b - mx) * (u[i] - mu), 0);
      const slope = (-(1 - t) + 0.25 * t) / M.flowVar(t);
      plot(f[1], { x: [-3, 3.6], y: [-2.5, 6.5], xl: 'Xₜ', yl: 'U', series: [{ pts: xt.map((x, i) => [x, u[i]]), color: c.accent, dots: 2, alpha: 0.55, label: L('样本对', 'sample pairs') }, { xs: [-3, 3.6], ys: [M.flowVelocity(-3, t), M.flowVelocity(3.6, t)], color: c.gold, width: 2.4, label: 'v*(x, t)' }] });
      const ts = lin(0, 1, 101);
      plot(f[2], { x: [0, 1], y: [-3, 3.6], xl: 't', yl: 'x', series: FZ0.slice(0, n).map((z) => ({ xs: ts, ys: ts.map((q) => M.flowExact(z, q)), color: c.info, width: 1, alpha: 0.6 })), marks: [{ x: t, color: c.gold }] });
      return [[['解析斜率 ∂v*/∂x', 'Analytic slope ∂v*/∂x'], fmt(slope, 4), 1], [['300 对样本的最小二乘斜率', 'Least-squares slope from 300 pairs'], fmt(sxu / sxx, 4)], [['Xₜ 的方差：理论 / 样本', 'Variance of Xₜ: theory / sample'], `${fmt(M.flowVar(t), 4)} / ${fmt(sxx / 300, 4)}`], [['条件速度的平均 E[U]', 'Mean conditional velocity E[U]'], fmt(mu, 3)]];
    },
  };

  // ── 25 高斯流 ───────────────────────────────────────────────────────────
  D['25'] = {
    title: ['先收缩过头，再膨胀回来', 'Contracting too far, then expanding back'],
    ctl: [['t', ['时间 t', 'Time t'], 0, 1, 0.01, 0.8, f2], ['z', ['跟踪的粒子：起点 z', 'Tracked particle: start z'], -2.5, 2.5, 0.05, 1, f2]],
    play: 't',
    figs: [[0.42, ['Xₜ 的标准差：独立耦合（实线）在 t = 0.8 降到约 0.447 再回升；最优传输的位移插值（虚线）单调地从 1 降到 0.5。', 'The standard deviation of Xₜ: under the independent coupling (solid) it dips to about 0.447 at t = 0.8 and rises again; the displacement interpolation of optimal transport (dashed) falls monotonically from 1 to 0.5.']], [0.5, ['粒子轨迹：边缘 ODE 的解 2t + √aₜ·z（实线，弯的）和最优传输的直线 2t + (1 − 0.5t)z（虚线）。金色是跟踪的那一个。', 'Particle trajectories: the marginal ODE solution 2t + √aₜ·z (solid, curved) and the straight lines of optimal transport 2t + (1 − 0.5t)z (dashed). The tracked one is gold.']]],
    note: ['全部是解析结果：X₀ ~ N(0,1)、X₁ ~ N(2, 0.25) 独立，线性插值，aₜ = (1−t)² + 0.25t²。对 t 求导可得最小点在 t = 1/(1+0.25) = 0.8，最小标准差 √0.2 ≈ 0.447，小于终点的 0.5。两种耦合的端点分布完全一样，区别只在中间怎么走：独立耦合的训练路径是直的，但回归出来的边缘 ODE 轨迹是弯的。', 'Everything is analytic: X₀ ~ N(0,1) and X₁ ~ N(2, 0.25) independent, linear interpolation, aₜ = (1−t)² + 0.25t². Differentiating in t puts the minimum at t = 1/(1+0.25) = 0.8 with standard deviation √0.2 ≈ 0.447, below the final 0.5. The two couplings share exactly the same endpoint distributions and differ only in between: the training paths of the independent coupling are straight, yet the regressed marginal ODE trajectories are curved.'],
    draw(s, f, c) {
      const ts = lin(0, 1, 201), mn = M.flowMinStd();
      plot(f[0], { x: [0, 1], y: [0, 1.05], xl: 't', yl: L('标准差', 'standard deviation'), series: [{ xs: ts, ys: ts.map((t) => Math.sqrt(M.flowVar(t))), color: c.accent, label: L('独立耦合 √aₜ', 'independent coupling √aₜ') }, { xs: ts, ys: ts.map((t) => 1 - 0.5 * t), color: c.info, dash: [5, 4], label: L('最优传输 1 − 0.5t', 'optimal transport 1 − 0.5t') }], marks: [{ x: mn.t, y: mn.sd, color: c.danger }, { x: s.t, y: Math.sqrt(M.flowVar(s.t)), color: c.gold }] });
      const zs = [-2, -1, 0, 1, 2];
      plot(f[1], { x: [0, 1], y: [-2.6, 3.4], xl: 't', yl: 'x', series: [...zs.flatMap((z) => [{ xs: ts, ys: ts.map((t) => M.flowExact(z, t)), color: c.accent, width: 1.3, alpha: 0.7 }, { xs: [0, 1], ys: [z, M.flowOT(z, 1)], color: c.info, dash: [4, 4], width: 1.1, alpha: 0.7 }]), { xs: ts, ys: ts.map((t) => M.flowExact(s.z, t)), color: c.gold, width: 2.6, label: L('跟踪的粒子', 'tracked particle') }], marks: [{ x: s.t, y: M.flowExact(s.z, s.t), color: c.gold }] });
      const x = M.flowExact(s.z, s.t);
      return [[['aₜ 和标准差', 'aₜ and the standard deviation'], `${fmt(M.flowVar(s.t), 4)}，${fmt(Math.sqrt(M.flowVar(s.t)), 4)}`.replace('，', K.en ? ', ' : '，'), 1], [['最小标准差（在 t = 0.8）', 'Minimum standard deviation (at t = 0.8)'], fmt(mn.sd, 4)], [['粒子位置 x(t)', 'Particle position x(t)'], fmt(x, 4)], [['那里的速度 v*(x, t)', 'Velocity there, v*(x, t)'], s.t < 1 || M.flowVar(1) > 0 ? fmt(M.flowVelocity(x, s.t), 4) : '—'], [['终点 2 + 0.5z', 'Endpoint 2 + 0.5z'], fmt(2 + 0.5 * s.z, 4)]];
    },
  };

  // ── 26 最优传输与 Sinkhorn ──────────────────────────────────────────────
  D['26'] = {
    title: ['同样的两堆点，怎么配对代价最小', 'The same two sets of points: which pairing costs least'],
    ctl: [['le', ['熵正则 ε', 'Entropic regularisation ε'], -2, 0.7, 0.02, -0.7, (v) => fmt(10 ** v)]],
    act: [[['换一种随机配对', 'Another random pairing'], (s) => { s.seed = (s.seed || 3) + 1; }]],
    figs: [[0.42, ['上排是 8 个源点（N(0,1) 的样本），下排是 8 个目标点（N(2, 0.25) 的样本）。灰线是随机配对，深色线是按大小顺序配对。', 'Top row: 8 source points (samples of N(0,1)); bottom row: 8 target points (samples of N(2, 0.25)). Grey lines are a random pairing, dark lines the pairing by sorted order.']], [0.62, ['Sinkhorn 算出的耦合 π（乘了 8，每行和为 1）。行和列都按从小到大排好：ε 小时它贴近对角线，ε 大时糊成一片。', 'The coupling π computed by Sinkhorn (multiplied by 8 so each row sums to 1). Rows and columns are sorted: for small ε it hugs the diagonal, for large ε it blurs.']]],
    note: ['一维、平方代价下，按大小顺序配对就是最优传输（单调映射），所以它的代价可以当作基准。Sinkhorn 在对数域里迭代 500 次（避免 ε 小时下溢）。熵正则的耦合不是一一配对，它的传输代价总不低于最优值，ε → 0 时逼近。8 个点是固定种子抽的；小批量里做 OT 配对，得到的是这一批的最优，不保证是整个数据分布的最优传输。', 'In one dimension with squared cost, pairing by sorted order is the optimal transport (a monotone map), so its cost serves as the baseline. Sinkhorn runs 500 iterations in the log domain (to avoid underflow for small ε). An entropic coupling is not a one-to-one pairing; its transport cost is never below the optimum and approaches it as ε → 0. The 8 points come from a fixed seed; OT pairing within a mini-batch is optimal for that batch and not necessarily the optimal transport of the whole data distribution.'],
    draw(s, f, c) {
      const xs = draws(8, 26001).sort((a, b) => a - b), ys = draws(8, 26002).map((z) => 2 + 0.5 * z).sort((a, b) => a - b), eps = 10 ** s.le;
      const r = M.rng(s.seed || 3), perm = [0, 1, 2, 3, 4, 5, 6, 7];
      for (let i = 7; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [perm[i], perm[j]] = [perm[j], perm[i]]; }
      const sorted = M.sortedPerm(xs, ys);
      plot(f[0], { x: [-2.8, 3.6], y: [-0.25, 1.25], xl: 'x', yt: [], series: [...xs.map((x, i) => ({ xs: [x, ys[perm[i]]], ys: [1, 0], color: c.faint, width: 1.2 })), ...xs.map((x, i) => ({ xs: [x, ys[sorted[i]]], ys: [1, 0], color: c.accent, width: 1.8 })), { pts: xs.map((x) => [x, 1]), color: c.gold, dots: 5, label: L('源', 'source') }, { pts: ys.map((y) => [y, 0]), color: c.info, dots: 5, label: L('目标', 'target') }] });
      const sk = M.sinkhornOT(xs, ys, eps), P = sk.P.map((rw) => rw.map((v) => v * 8));
      heat(f[1], P, { max: 1, num: false, xl: L('目标点（从小到大）', 'target points (sorted)') });
      const opt = M.pairCost(xs, ys, sorted);
      return [[['随机配对的平均代价', 'Mean cost of the random pairing'], fmt(M.pairCost(xs, ys, perm), 4)], [['按顺序配对（最优）', 'Sorted pairing (optimal)'], fmt(opt, 4), 1], [['Sinkhorn 耦合的传输代价', 'Transport cost of the Sinkhorn coupling'], fmt(sk.cost, 4), 1], [['比最优多出', 'Excess over the optimum'], fmt(sk.cost - opt, 3)], [['行和、列和的最大偏差', 'Largest deviation of row and column sums'], fmt(M.marginResidual(P), 2)]];
    },
  };

  // ── 27 数值求解器 ───────────────────────────────────────────────────────
  D['27'] = {
    title: ['速度场完全正确时，步数还剩多少误差', 'With an exact velocity field, how much error the step count leaves'],
    ctl: [['ln', ['步数 n', 'Steps n'], 1, 7, 1, 2, (v) => String(2 ** v)], ['z', ['初值 z', 'Initial value z'], -2.5, 2.5, 0.05, 1, f2]],
    btn: [[['n = 4', 'n = 4'], { ln: 2 }], [['n = 16', 'n = 16'], { ln: 4 }], [['n = 128', 'n = 128'], { ln: 7 }]],
    figs: [[0.46, ['主题 25 的高斯速度场上的三条轨迹：精确解、Euler、Heun。', 'Three trajectories on the Gaussian velocity field of topic 25: exact, Euler, Heun.']], [0.46, ['终点误差随步数的变化（双对数）。Euler 的斜率约 −1，Heun 约 −2。', 'Endpoint error against the number of steps (log–log). Euler has slope about −1, Heun about −2.']], ['html', ['', '']]],
    note: ['速度场是解析的 v*(x, t)，所以这里只有离散化误差，没有模型误差。下面的表是讲义的核验记录（z = 1）和本页当场重算的值，逐位对照。Heun 每步要算两次速度场，比较时应当按 NFE（网络调用次数）而不是按步数：n 步 Heun 的花费等于 2n 步 Euler。端点奇异、动力学刚性或模型误差占主导时，高阶方法的理论阶数不一定体现为更好的样本。', 'The velocity field is the analytic v*(x, t), so only discretisation error is present, not model error. The table below sets the notes’ record (z = 1) against values recomputed on this page, digit for digit. Heun evaluates the field twice per step, so comparisons should use NFE (network evaluations) and not steps: n Heun steps cost as much as 2n Euler steps. With singular endpoints, stiff dynamics or dominant model error, the theoretical order of a higher-order method need not show up as better samples.'],
    draw(s, f, c) {
      const n = 2 ** s.ln, v = (x, t) => M.flowVelocity(x, t), ts = lin(0, 1, 201), tk = lin(0, 1, n + 1), eu = M.euler(v, s.z, n), he = M.heun(v, s.z, n), ex = M.flowExact(s.z, 1);
      const all = [...eu, ...he, ...ts.map((t) => M.flowExact(s.z, t))];
      plot(f[0], { x: [0, 1], y: [Math.min(...all) - 0.2, Math.max(...all) + 0.2], xl: 't', yl: 'x', series: [{ xs: ts, ys: ts.map((t) => M.flowExact(s.z, t)), color: c.muted, width: 2.6, label: L('精确解', 'exact') }, { xs: tk, ys: eu, color: c.danger, dots: n <= 32 ? 2.5 : 0.01, line: true, width: 1.5, label: 'Euler' }, { xs: tk, ys: he, color: c.accent, dots: n <= 32 ? 2.5 : 0.01, line: true, width: 1.5, label: 'Heun' }] });
      const er = M.flowErrors(s.z, [2, 4, 8, 16, 32, 64, 128]), lx = er.map((e) => Math.log2(e.n)), lg = (q) => Math.log10(Math.max(1e-16, q));
      plot(f[1], { x: [0.5, 7.5], y: [-9, 0.5], xl: L('步数 n', 'steps n'), yl: L('终点误差', 'endpoint error'), xt: [1, 2, 3, 4, 5, 6, 7], xf: (t) => String(2 ** t), yt: [-8, -6, -4, -2, 0], yf: K.pow, series: [{ xs: lx, ys: er.map((e) => lg(e.euler)), color: c.danger, dots: 3, line: true, label: 'Euler' }, { xs: lx, ys: er.map((e) => lg(e.heun)), color: c.accent, dots: 3, line: true, label: 'Heun' }], marks: [{ x: s.ln, color: c.gold }] });
      const mine = M.flowErrors(1), e3 = (q) => q.toExponential(3);
      f[2].innerHTML = `<table class="aim-table"><caption>${L('z = 1 时的终点误差：讲义的记录和本页重算', 'Endpoint errors at z = 1: the notes’ record and this page’s recomputation')}</caption><thead><tr><th>n</th><th>Euler · ${L('讲义', 'notes')}</th><th>Euler · ${L('本页', 'here')}</th><th>Heun · ${L('讲义', 'notes')}</th><th>Heun · ${L('本页', 'here')}</th></tr></thead><tbody>${M.RECORD.flow.map(([k, a, b], i) => `<tr><td>${k}</td><td>${e3(a)}</td><td>${e3(mine[i].euler)}</td><td>${e3(b)}</td><td>${e3(mine[i].heun)}</td></tr>`).join('')}</tbody></table>`;
      const cur = M.flowErrors(s.z, [n, 2 * n])[0], nxt = M.flowErrors(s.z, [2 * n])[0];
      return [[['精确终点 2 + 0.5z', 'Exact endpoint 2 + 0.5z'], fmt(ex, 5)], [[`Euler 误差（NFE = ${n}）`, `Euler error (NFE = ${n})`], fmt(cur.euler, 4), 1], [[`Heun 误差（NFE = ${2 * n}）`, `Heun error (NFE = ${2 * n})`], fmt(cur.heun, 4), 1], [['步数加倍，Euler 误差缩小', 'Doubling the steps shrinks Euler’s error by'], `${fmt(cur.euler / nxt.euler)}×`], [['步数加倍，Heun 误差缩小', 'Doubling the steps shrinks Heun’s error by'], `${fmt(cur.heun / nxt.heun)}×`]];
    },
  };

  // ── 28 一致性与 MeanFlow ────────────────────────────────────────────────
  D['28'] = {
    title: ['割线是平均速度，切线是瞬时速度', 'The secant is the average velocity, the tangent the instantaneous one'],
    ctl: [['r', ['起点时间 r', 'Start time r'], 0, 1.8, 0.01, 0.2, f2], ['t', ['终点时间 t', 'End time t'], 0.05, 2, 0.01, 1.4, f2]],
    btn: [[['大跨度', 'A long span'], { r: 0.1, t: 1.8 }], [['t → r', 't → r'], { r: 1, t: 1.05 }]],
    figs: [[0.56, ['指数轨迹 z(τ) = 0.5e^τ（速度场 v = z）。金色割线的斜率是区间 [r, t] 的平均速度 u；红色虚线是 t 处的切线，斜率是瞬时速度 v。', 'The exponential trajectory z(τ) = 0.5e^τ (velocity field v = z). The slope of the gold secant is the average velocity u over [r, t]; the red dashed line is the tangent at t, whose slope is the instantaneous velocity v.']]],
    note: ['用指数轨迹只是因为它算得出来，不是说生成模型的动力学都是指数的。平均速度 u = (zₜ − zᵣ)/(t − r)，一步回跳 zᵣ = zₜ − (t − r)u 是精确的；如果错把瞬时速度当平均速度用，跨度越大错得越多。读数里的“恒等式残差”是 u − [v − (t − r)(∂ₜu + ∂_zu·v)]，用中心差分算导数，应当只剩差分误差（约 10⁻¹⁰）：这就是 MeanFlow [19] 构造训练目标用的恒等式（附录 G）。t ≤ r 时演示把 t 推到 r 之后。', 'An exponential trajectory is used only because it can be computed, not because generative dynamics are exponential. The average velocity is u = (zₜ − zᵣ)/(t − r), and the one-step jump back zᵣ = zₜ − (t − r)u is exact; mistaking the instantaneous velocity for the average errs more the longer the span. The identity residual in the read-out is u − [v − (t − r)(∂ₜu + ∂_zu·v)] with derivatives by central differences, and should leave only differencing error (about 10⁻¹⁰): this is the identity from which MeanFlow [19] builds its training target (Appendix G). If t ≤ r the demo moves t just past r.'],
    draw(s, f, c) {
      const r = s.r, t = Math.max(s.t, r + 0.02), z = (q) => 0.5 * Math.exp(q), zt = z(t), zr = z(r), u = M.meanVelocity(zt, r, t), ts = lin(0, 2, 201);
      s.t = t;
      plot(f[0], { x: [0, 2], y: [0, 4], xl: 'τ', yl: 'z', series: [{ xs: ts, ys: ts.map(z), color: c.accent, width: 2.4, label: 'z(τ)' }, { xs: [r, t], ys: [zr, zt], color: c.gold, width: 2.4, label: L('割线：平均速度 u', 'secant: average velocity u') }, { xs: [0, 2], ys: [zt + zt * (0 - t), zt + zt * (2 - t)], color: c.danger, dash: [5, 4], width: 1.5, label: L('切线：瞬时速度 v', 'tangent: instantaneous velocity v') }, { pts: [[r, zr], [t, zt]], color: c.gold, dots: 5 }, { pts: [[r, zt - (t - r) * zt]], color: c.danger, dots: 4 }] });
      return [[['平均速度 u', 'Average velocity u'], fmt(u, 5), 1], [['瞬时速度 v(zₜ, t)', 'Instantaneous velocity v(zₜ, t)'], fmt(zt, 5), 1], [['真正的 zᵣ', 'True zᵣ'], fmt(zr, 5)], [['用 u 一步回跳', 'One jump back with u'], fmt(zt - (t - r) * u, 5)], [['用 v 一步回跳（错的）', 'One jump back with v (wrong)'], fmt(zt - (t - r) * zt, 5)], [['恒等式残差', 'Residual of the identity'], fmt(Math.abs(M.meanFlowResidual(0.5, r, t)), 2)]];
    },
  };

  // ── 29 条件生成与逆问题 ─────────────────────────────────────────────────
  D['29'] = {
    title: ['引导越强，样本越集中', 'The stronger the guidance, the more concentrated the samples'],
    ctl: [['w', ['引导强度 w', 'Guidance strength w'], 0, 5, 0.05, 1, f2], ['y', ['下图：观测值 y', 'Lower figure: observation y'], -3, 3, 0.05, 1.5, f2], ['sn', ['下图：观测噪声', 'Lower figure: observation noise'], 0.1, 3, 0.05, 0.6, f2]],
    btn: [[['w = 0：无条件', 'w = 0: unconditional'], { w: 0 }], [['w = 1：普通条件', 'w = 1: plain conditional'], { w: 1 }], [['w = 4', 'w = 4'], { w: 4 }]],
    figs: [[0.42, ['无条件分布 p(x)（虚线，双峰）、条件分布 p(x|c)（细线）和倾斜分布 p(x|c)ʷp(x)¹⁻ʷ（填充）。', 'The unconditional p(x) (dashed, bimodal), the conditional p(x|c) (thin) and the tilted p(x|c)ʷp(x)¹⁻ʷ (filled).']], [0.42, ['一个线性高斯逆问题：先验 N(0,1)、似然 N(y; x, 噪声²) 和后验。', 'A linear Gaussian inverse problem: the prior N(0,1), the likelihood N(y; x, noise²) and the posterior.']]],
    note: ['上图是固定一个时刻、score 精确时的结论：w·s_cond + (1−w)·s_uncond 是 p(x|c)ʷp(x)¹⁻ʷ 的对数梯度。w > 1 时分布变窄、往条件一侧挤，标准差下降就是“多样性降低”。跨时间采样之后，最终分布并不自动等于某个简单的幂分布。下图的逆问题先验和似然都是高斯，后验有闭式；把干净数据的似然梯度直接用在带噪状态上通常只是近似。', 'The upper figure is the statement for one fixed time with exact scores: w·s_cond + (1−w)·s_uncond is the log-gradient of p(x|c)ʷp(x)¹⁻ʷ. For w > 1 the distribution narrows and is pushed to the conditional side; the falling standard deviation is the loss of diversity. After sampling across times, the final distribution is not automatically some simple power distribution. In the inverse problem below, prior and likelihood are both Gaussian and the posterior is closed-form; using the likelihood gradient of clean data on a noisy state is usually only an approximation.'],
    draw(s, f, c) {
      const xs = lin(-5, 5, 501), pc = xs.map((x) => M.normalPdf(x, 1.5, 0.8)), pu = xs.map((x, i) => 0.5 * M.normalPdf(x, -1.5, 0.8) + 0.5 * pc[i]), tl = M.tilted(xs, s.w);
      const mean = M.trapz(xs, xs.map((x, i) => x * tl[i])), sd = Math.sqrt(M.trapz(xs, xs.map((x, i) => (x - mean) ** 2 * tl[i])));
      plot(f[0], { x: [-5, 5], y: [0, Math.max(0.55, Math.max(...tl) * 1.08)], xl: 'x', yl: L('密度', 'density'), series: [{ xs, ys: pu, color: c.muted, dash: [5, 4], label: 'p(x)' }, { xs, ys: pc, color: c.info, width: 1.4, label: 'p(x|c)' }, { xs, ys: tl, color: c.accent, fill: true, label: L(`倾斜，w = ${s.w.toFixed(2)}`, `tilted, w = ${s.w.toFixed(2)}`) }] });
      const po = M.gaussPosterior(0, 1, s.y, s.sn);
      plot(f[1], { x: [-5, 5], y: [0, Math.max(0.6, M.normalPdf(0, 0, po.sd) * 1.08)], xl: 'x', yl: L('密度', 'density'), series: [{ xs, ys: xs.map((x) => M.normalPdf(x)), color: c.muted, dash: [5, 4], label: L('先验', 'prior') }, { xs, ys: xs.map((x) => M.normalPdf(s.y, x, s.sn)), color: c.gold, width: 1.5, label: L('似然', 'likelihood') }, { xs, ys: xs.map((x) => M.normalPdf(x, po.mean, po.sd)), color: c.accent, fill: true, label: L('后验', 'posterior') }] });
      return [[['倾斜分布的均值', 'Mean of the tilted distribution'], fmt(mean, 4), 1], [['倾斜分布的标准差', 'Standard deviation of the tilted distribution'], fmt(sd, 4), 1], [['条件分布本身的标准差', 'Standard deviation of the conditional itself'], '0.8'], [['逆问题：后验均值', 'Inverse problem: posterior mean'], fmt(po.mean, 4)], [['逆问题：后验标准差', 'Inverse problem: posterior sd'], fmt(po.sd, 4)]];
    },
  };
});
