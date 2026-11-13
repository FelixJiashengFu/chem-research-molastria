'use strict';
// 前沿 AI 数学 · 演示 01–16（数学语言、优化几何、序列与表征）。
// 每个演示：title 标题，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，chk 开关，btn 预设，act 动作按钮，
// figs 图 [高宽比 | 'html', 图注]，note 模型说明，draw(s, 图, 颜色) 画图并返回读数 [[名字, 值, 是否加粗]]。
// 文字都是 [中文, 英文]；数学全在 aim-models.js。
(window.MOLASTRIA_AIM_DEMOS ||= []).push((K, D) => {
  const { M, L, fmt, pct, plot, heat, lin, box, row } = K;
  const deg = (v) => `${Math.round(v)}°`, f2 = (v) => v.toFixed(2), int = (v) => String(Math.round(v));
  const rad = (d) => (d * Math.PI) / 180;

  // ── 01 表征：线性变换与马氏距离 ─────────────────────────────────────────
  const CLOUD = M.cloud(70), PA = [0, -0.4], PB = [0, 0.4], PC = [1.6, -0.4];
  D['01'] = {
    title: ['同一组点，换一把尺子', 'The same points, a different ruler'],
    ctl: [['sx', ['横向缩放', 'Scale along x'], 0.2, 3, 0.05, 1, f2], ['sy', ['纵向缩放', 'Scale along y'], 0, 5, 0.05, 1, f2], ['sh', ['剪切', 'Shear'], -1.5, 1.5, 0.05, 0, f2], ['an', ['旋转', 'Rotation'], -90, 90, 1, 0, deg]],
    btn: [[['恒等变换', 'Identity'], { sx: 1, sy: 1, sh: 0, an: 0 }], [['放大弱方向', 'Amplify the weak direction'], { sx: 0.6, sy: 4, sh: 0, an: 0 }], [['压平一个方向', 'Flatten one direction'], { sx: 1, sy: 0, sh: 0, an: 0 }]],
    figs: [[0.6, ['原始坐标：A、B 在纵向只差一点，A、C 在横向差得远。', 'Original coordinates: A and B differ slightly along y; A and C differ a lot along x.']], [0.6, ['经过 x↦Lx 之后的坐标。在这里量普通的欧氏距离，就是原空间里的马氏距离（M = LᵀL）。', 'Coordinates after x↦Lx. Ordinary Euclidean distance here is the Mahalanobis distance of the original space (M = LᵀL).']]],
    note: ['点云是固定种子生成的二维高斯样本，三个标出的点是人为选的。纵向缩放拉到 0 时 M 只是半正定：A 和 B 的距离变成 0，这就是“不同的点可能距离为零”。真实的表征空间是高维、非线性的，这里只演示“度量由变换决定”这一件事。', 'The cloud is a two-dimensional Gaussian sample with a fixed seed; the three marked points are chosen by hand. With the y-scale at 0, M is only positive semidefinite: the distance between A and B becomes 0, which is the statement that distinct points can be at distance zero. Real representation spaces are high-dimensional and nonlinear; this shows only that the metric is decided by the map.'],
    draw(s, f, c) {
      const Lm = M.linearMap(s.sx, s.sy, s.sh, rad(s.an)), map = (p) => M.matvec(Lm, p);
      const marks = (pts) => [{ pts: [pts[0]], color: c.gold, dots: 6 }, { pts: [pts[1]], color: c.info, dots: 6 }, { pts: [pts[2]], color: c.danger, dots: 6 }];
      const lab = (pts) => [{ x: pts[0][0], y: pts[0][1], s: 'A', dx: 8, dy: 4 }, { x: pts[1][0], y: pts[1][1], s: 'B', dx: 8, dy: 4 }, { x: pts[2][0], y: pts[2][1], s: 'C', dx: 8, dy: 4 }];
      plot(f[0], { x: [-4.5, 4.5], y: [-2.6, 2.6], eq: true, series: [{ pts: CLOUD, color: c.accent, dots: 2.5, alpha: 0.6 }, ...marks([PA, PB, PC])], texts: lab([PA, PB, PC]) });
      const mapped = CLOUD.map(map), P3 = [PA, PB, PC].map(map), r = Math.max(4.5, ...mapped.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]) * 1.6)));
      plot(f[1], { x: [-r, r], y: [-r * 0.6, r * 0.6], eq: true, series: [{ pts: mapped, color: c.accent, dots: 2.5, alpha: 0.6 }, ...marks(P3)], texts: lab(P3) });
      const det = Lm[0][0] * Lm[1][1] - Lm[0][1] * Lm[1][0];
      return [[['欧氏距离 A–B / A–C', 'Euclidean A–B / A–C'], `${fmt(M.norm([PA[0] - PB[0], PA[1] - PB[1]]))} / ${fmt(M.norm([PA[0] - PC[0], PA[1] - PC[1]]))}`],
        [['马氏距离 A–B', 'Mahalanobis A–B'], fmt(M.mahalanobis(PA, PB, Lm)), 1], [['马氏距离 A–C', 'Mahalanobis A–C'], fmt(M.mahalanobis(PA, PC, Lm)), 1],
        [['cos(B, C)：变换前 / 后', 'cos(B, C): before / after'], `${fmt(M.cosine(PB, PC))} / ${det === 0 && M.norm(map(PB)) === 0 ? '—' : fmt(M.cosine(map(PB), map(PC)))}`],
        [['det L', 'det L'], `${fmt(det)}${Math.abs(det) < 1e-9 ? L('（M 只是半正定）', ' (M only semidefinite)') : ''}`]];
    },
  };

  // ── 02 SVD、低秩与 LoRA ─────────────────────────────────────────────────
  D['02'] = {
    title: ['留下前 r 个奇异值，丢掉了多少', 'Keep the top r singular values: what is lost'],
    ctl: [['decay', ['奇异值衰减的快慢', 'How fast the singular values decay'], 1, 20, 0.5, 5, (v) => v.toFixed(1)], ['r', ['保留的秩 r', 'Rank kept, r'], 1, 32, 1, 4, int], ['dim', ['LoRA：矩阵边长 m = n', 'LoRA: matrix side m = n'], 8, 13, 1, 12, (v) => String(2 ** v)], ['lr', ['LoRA：秩', 'LoRA: rank'], 1, 64, 1, 16, int]],
    btn: [[['讲义的例子：4096，r = 16', 'The notes’ example: 4096, r = 16'], { dim: 12, lr: 16 }], [['平坦的谱', 'A flat spectrum'], { decay: 20 }], [['陡峭的谱', 'A steep spectrum'], { decay: 2 }]],
    figs: [[0.42, ['一个 32×32 矩阵的奇异值 σᵢ = e^{−i/衰减}（教学设定）。深色是保留的，浅色是截掉的。', 'Singular values σᵢ = e^{−i/decay} of a 32×32 matrix (a teaching choice). Dark bars are kept, pale ones truncated.']], [0.42, ['保留的能量 Σᵢ≤ᵣσᵢ² / Σσᵢ² 随 r 的变化；1 减去它就是相对 Frobenius 误差的平方。', 'Energy kept, Σᵢ≤ᵣσᵢ² / Σσᵢ², against r; one minus this is the squared relative Frobenius error.']]],
    note: ['上半部分是截断 SVD（Eckart–Young：它是给定秩下 Frobenius 误差最小的近似）。下半部分的 LoRA 是另一回事：它冻结 W，只训练低秩更新 BA，可训练参数占 r(m+n)/(mn)。谱的形状是人为设的指数衰减，真实权重和梯度的谱要看具体模型。', 'The upper part is truncated SVD (Eckart–Young: the best approximation of a given rank in Frobenius error). LoRA in the lower part is something else: it freezes W and trains only a low-rank update BA, whose trainable share is r(m+n)/(mn). The exponential spectrum is set by hand; the spectra of real weights and gradients depend on the model.'],
    draw(s, f, c) {
      const sig = M.spectrum(32, s.decay), idx = sig.map((_, i) => i + 1), kept = M.energyKept(sig, s.r);
      plot(f[0], { x: [0, 33], y: [0, 1.05], xl: 'i', yl: 'σᵢ', series: [{ xs: idx.slice(0, s.r), ys: sig.slice(0, s.r), color: c.accent, bars: 0.8, label: L('保留', 'kept') }, { xs: idx.slice(s.r), ys: sig.slice(s.r), color: c.faint, bars: 0.8, alpha: 0.6, label: L('截掉', 'truncated') }] });
      plot(f[1], { x: [0, 33], y: [0, 1.05], xl: 'r', yl: L('保留的能量', 'energy kept'), series: [{ xs: idx, ys: idx.map((r) => M.energyKept(sig, r)), color: c.accent }], marks: [{ x: s.r, y: kept, color: c.gold }] });
      const m = 2 ** s.dim;
      return [[['保留的能量', 'Energy kept'], pct(kept, 2), 1], [['相对 Frobenius 误差', 'Relative Frobenius error'], fmt(Math.sqrt(Math.max(0, 1 - kept)))], [['谱范数误差 σᵣ₊₁/σ₁', 'Spectral error σᵣ₊₁/σ₁'], s.r < 32 ? fmt(sig[s.r]) : '0'],
        [[`LoRA：${m}×${m}，r = ${s.lr}`, `LoRA: ${m}×${m}, r = ${s.lr}`], pct(M.loraFraction(m, m, s.lr), 5), 1], [['可训练参数 / 全部', 'Trainable / all'], `${(s.lr * 2 * m).toLocaleString('en-US')} / ${(m * m).toLocaleString('en-US')}`]];
    },
  };

  // ── 03 反向传播 ─────────────────────────────────────────────────────────
  D['03'] = {
    title: ['一个三步的小网络：前向存状态，反向拉回敏感性', 'A three-step network: store states forward, pull sensitivities back'],
    ctl: [['x', ['输入 x', 'Input x'], -2, 2, 0.05, 1, f2], ['w1', ['w₁', 'w₁'], -2, 2, 0.05, 0.8, f2], ['w2', ['w₂', 'w₂'], -2, 2, 0.05, 1.5, f2], ['tg', ['目标值', 'Target'], -2, 2, 0.05, 0.5, f2]],
    figs: [['html', ['', '']], [0.45, ['损失随 w₁ 的变化（其余固定）。金色直线是反向传播算出的切线：斜率就是 ∂L/∂w₁。', 'The loss as a function of w₁ (others fixed). The gold line is the tangent computed by backpropagation: its slope is ∂L/∂w₁.']]],
    note: ['网络是 y = w₂·tanh(w₁x)，L = ½(y − 目标)²。上排是前向值，下排是伴随量（上横线）：每一步用局部导数的转置把后一步的伴随拉回来，一次反向遍历同时得到两个参数的梯度。右边的“有限差分”是把参数各扰动 10⁻⁵ 重算两次损失得到的，只用来核对。', 'The network is y = w₂·tanh(w₁x) with L = ½(y − target)². The upper row holds forward values, the lower row adjoints (bars): each step pulls the next adjoint back through the transpose of its local derivative, and one backward sweep yields both parameter gradients. The finite differences perturb each parameter by 10⁻⁵ and recompute the loss twice; they are only a check.'],
    draw(s, f, c) {
      const r = M.tinyNet(s.x, s.w1, s.w2, s.tg), fd = M.tinyNetFD(s.x, s.w1, s.w2, s.tg);
      f[0].innerHTML = `<p class="aim-flow-h">${L('前向', 'Forward')}</p>${row(box('x', fmt(s.x)), box('z = w₁x', fmt(r.z)), box('h = tanh z', fmt(r.h)), box('y = w₂h', fmt(r.y)), box('L', fmt(r.L), 'is-gold'))}
        <p class="aim-flow-h">${L('反向（伴随量）', 'Backward (adjoints)')}</p>${row.back(box('x̄ = w₁z̄', fmt(r.gx)), box('z̄ = (1−h²)h̄', fmt(r.zb)), box('h̄ = w₂ȳ', fmt(r.hb)), box('ȳ = y − ' + L('目标', 'target'), fmt(r.yb)), box('L̄', '1', 'is-gold'))}
        <p class="aim-flow-h">${L('参数梯度', 'Parameter gradients')}</p>${row.plain(box('∂L/∂w₁ = x·z̄', fmt(r.gw1, 5), 'is-accent'), box('∂L/∂w₂ = h·ȳ', fmt(r.gw2, 5), 'is-accent'))}`;
      const ws = lin(-2, 2, 161), Ls = ws.map((w) => M.tinyNet(s.x, w, s.w2, s.tg).L), top = Math.max(0.2, ...Ls) * 1.08;
      plot(f[1], { x: [-2, 2], y: [0, top], xl: 'w₁', yl: 'L', series: [{ xs: ws, ys: Ls, color: c.accent, label: 'L(w₁)' }, { xs: [-2, 2], ys: [r.L + r.gw1 * (-2 - s.w1), r.L + r.gw1 * (2 - s.w1)], color: c.gold, dash: [5, 4], width: 1.5, label: L('切线', 'tangent') }], marks: [{ x: s.w1, y: r.L, color: c.gold }] });
      return [[['∂L/∂w₁：反向传播', '∂L/∂w₁: backprop'], fmt(r.gw1, 6), 1], [['∂L/∂w₁：有限差分', '∂L/∂w₁: finite difference'], fmt(fd.gw1, 6)], [['∂L/∂w₂：反向传播', '∂L/∂w₂: backprop'], fmt(r.gw2, 6), 1], [['∂L/∂w₂：有限差分', '∂L/∂w₂: finite difference'], fmt(fd.gw2, 6)], [['两者最大差', 'Largest difference'], fmt(Math.max(Math.abs(r.gw1 - fd.gw1), Math.abs(r.gw2 - fd.gw2)), 2)]];
    },
  };

  // ── 04 概率：Beta–Bernoulli ─────────────────────────────────────────────
  D['04'] = {
    title: ['先验、数据和后验：抛硬币的贝叶斯更新', 'Prior, data and posterior: Bayesian updating of a coin'],
    ctl: [['a', ['先验 Beta(a, b)：a', 'Prior Beta(a, b): a'], 0.5, 12, 0.5, 2, (v) => v.toFixed(1)], ['b', ['先验：b', 'Prior: b'], 0.5, 12, 0.5, 2, (v) => v.toFixed(1)], ['k', ['观察到的正面', 'Heads observed'], 0, 60, 1, 7, int], ['m', ['观察到的反面', 'Tails observed'], 0, 60, 1, 3, int]],
    btn: [[['没有数据', 'No data'], { k: 0, m: 0 }], [['数据很多', 'Lots of data'], { k: 42, m: 18 }], [['很强的先验', 'A strong prior'], { a: 12, b: 12 }]],
    figs: [[0.5, ['先验（虚线）和后验（实线）。竖线是最大似然估计 k/n。', 'Prior (dashed) and posterior (solid). The vertical line is the maximum-likelihood estimate k/n.']]],
    note: ['Beta 先验配伯努利似然，后验还是 Beta：Beta(a+k, b+m)，所以这张图是精确的解析结果。后验均值 (a+k)/(a+b+n) 介于先验均值和 k/n 之间；数据越多，后验越窄，标准差大致按 1/√n 缩小，对应主题里 Var(X̄ₙ) = σ²/n。', 'A Beta prior with a Bernoulli likelihood gives a Beta posterior, Beta(a+k, b+m), so the picture is an exact analytic result. The posterior mean (a+k)/(a+b+n) lies between the prior mean and k/n; with more data the posterior narrows, its standard deviation shrinking roughly as 1/√n, which is the topic’s Var(X̄ₙ) = σ²/n.'],
    draw(s, f, c) {
      const xs = lin(0.001, 0.999, 400), a2 = s.a + s.k, b2 = s.b + s.m, n = s.k + s.m;
      const pr = xs.map((x) => M.betaPdf(x, s.a, s.b)), po = xs.map((x) => M.betaPdf(x, a2, b2)), top = Math.min(14, Math.max(...po, ...pr.slice(20, 380)) * 1.1);
      plot(f[0], { x: [0, 1], y: [0, top], xl: 'θ', yl: L('密度', 'density'), series: [{ xs, ys: pr, color: c.muted, dash: [5, 4], label: L('先验', 'prior') }, { xs, ys: po, color: c.accent, fill: true, label: L('后验', 'posterior') }], marks: n ? [{ x: s.k / n, color: c.gold }] : [] });
      return [[['先验均值', 'Prior mean'], fmt(M.betaMean(s.a, s.b))], [['最大似然 k/n', 'Maximum likelihood k/n'], n ? fmt(s.k / n) : '—'], [['后验均值', 'Posterior mean'], fmt(M.betaMean(a2, b2)), 1], [['后验标准差', 'Posterior sd'], fmt(M.betaSd(a2, b2))], [['先验标准差', 'Prior sd'], fmt(M.betaSd(s.a, s.b))]];
    },
  };

  // ── 05 KL 的两个方向 ────────────────────────────────────────────────────
  D['05'] = {
    title: ['用一个高斯去拟合双峰分布：KL 的方向决定结果', 'Fitting a bimodal target with one Gaussian: the direction of KL decides'],
    ctl: [['mu', ['q 的均值', 'Mean of q'], -4, 4, 0.05, 0, f2], ['sd', ['q 的标准差', 'Standard deviation of q'], 0.2, 4, 0.01, 2.09, f2], ['sep', ['p 的两个峰离中心多远', 'Distance of p’s modes from the centre'], 0.5, 3, 0.05, 2, f2]],
    act: [[['最小化 KL(p‖q)', 'Minimise KL(p‖q)'], (s) => { const r = M.forwardFit(s.sep); s.mu = r.mu; s.sd = Math.min(4, r.sd); }], [['最小化 KL(q‖p)', 'Minimise KL(q‖p)'], (s) => { const r = M.reverseFit(s.sep, 0.6, s.mu < 0 ? -1 : 1); s.mu = r.mu; s.sd = r.sd; }]],
    figs: [[0.5, ['目标 p（两个标准差 0.6 的高斯等权混合）和候选 q。', 'The target p (an equal mixture of two Gaussians of standard deviation 0.6) and the candidate q.']]],
    note: ['KL(p‖q) 在 p 有质量而 q 很小的地方受重罚，所以最小化它的高斯会盖住两个峰（矩匹配，解析解）；KL(q‖p) 在 q 有质量而 p 很小的地方受重罚，所以它缩到一个峰里（这里用坐标搜索求的数值解，从 q 当前所在的一侧出发）。两个积分都是在 [−12, 12] 上数值算的。', 'KL(p‖q) is penalised heavily where p has mass and q is tiny, so its Gaussian minimiser covers both modes (moment matching, in closed form); KL(q‖p) is penalised where q has mass and p is tiny, so it shrinks into one mode (found here numerically by coordinate search, starting on the side where q currently sits). Both integrals are computed numerically on [−12, 12].'],
    draw(s, f, c) {
      const xs = lin(-6, 6, 481), p = xs.map((x) => M.bimodal(x, s.sep)), q = xs.map((x) => M.normalPdf(x, s.mu, s.sd)), k = M.klPair(s.mu, s.sd, s.sep);
      plot(f[0], { x: [-6, 6], y: [0, Math.max(0.75, Math.min(2.1, Math.max(...q) * 1.08))], xl: 'x', yl: L('密度', 'density'), series: [{ xs, ys: p, color: c.accent, fill: true, label: 'p' }, { xs, ys: q, color: c.gold, width: 2.4, label: 'q' }] });
      return [[['KL(p‖q)（盖住质量）', 'KL(p‖q) (mass-covering)'], fmt(k.forward, 4), 1], [['KL(q‖p)（找一个峰）', 'KL(q‖p) (mode-seeking)'], fmt(k.reverse, 4), 1], [['熵 H(p)', 'Entropy H(p)'], fmt(k.entropy, 4)], [['交叉熵 H(p, q) = H(p) + KL(p‖q)', 'Cross-entropy H(p, q) = H(p) + KL(p‖q)'], fmt(k.cross, 4)]];
    },
  };

  // ── 06 高维：薄壳与点积 ─────────────────────────────────────────────────
  D['06'] = {
    title: ['维数一高，样本都挤在一层薄壳上', 'In high dimension the samples crowd into a thin shell'],
    ctl: [['ld', ['维数 d', 'Dimension d'], 0, 10, 1, 6, (v) => String(2 ** v)]],
    btn: [[['d = 2', 'd = 2'], { ld: 1 }], [['d = 64', 'd = 64'], { ld: 6 }], [['d = 1024', 'd = 1024'], { ld: 10 }]],
    figs: [[0.42, ['2000 个标准高斯样本的 ‖X‖/√d 的直方图。曲线是大 d 近似 N(1, 1/(2d))。', 'Histogram of ‖X‖/√d for 2000 standard Gaussian samples. The curve is the large-d approximation N(1, 1/(2d)).']], [0.42, ['两个独立高斯向量的点积除以 √d 之后的直方图，和标准正态密度（曲线）对照。', 'Histogram of the dot product of two independent Gaussian vectors after dividing by √d, against the standard normal density (curve).']]],
    note: ['样本是浏览器里用固定种子现抽的（每个维数 2000 个）。‖X‖² 的均值是 d、方差是 2d，所以半径集中在 √d 附近、相对宽度按 1/√(2d) 缩小；点积 qᵀk 的方差是 d，不缩放的话 softmax 会随维数变尖，这就是注意力里除以 √d 的理由。这些是独立、零均值、单位方差分量下的结论，训练后的表征不一定满足。', 'Samples are drawn in the browser with a fixed seed (2000 per dimension). ‖X‖² has mean d and variance 2d, so the radius concentrates near √d with relative width shrinking as 1/√(2d); the dot product qᵀk has variance d, and without scaling the softmax would sharpen with dimension, which is why attention divides by √d. These hold for independent, zero-mean, unit-variance components; trained representations need not satisfy that.'],
    draw(s, f, c) {
      const d = 2 ** s.ld, r = M.shellSamples(d, 2000), bins = 60, hs = M.histogram(r, 0, 2.4, bins), xs = hs.map((_, i) => ((i + 0.5) * 2.4) / bins), sdT = M.shellSd(d);
      const cx = lin(0, 2.4, 300), top = Math.max(...hs, 1) * 1.1;
      plot(f[0], { x: [0, 2.4], y: [0, top], xl: '‖X‖ / √d', yt: [], series: [{ xs, ys: hs, color: c.accent, bars: 2.4 / bins, alpha: 0.75, label: L('样本', 'samples') }, { xs: cx, ys: cx.map((x) => Math.min(top * 2, M.normalPdf(x, 1, sdT))), color: c.gold, label: 'N(1, 1/(2d))' }] });
      const dots = M.dotSamples(d, 2000), sc = dots.map((v) => v / Math.sqrt(d)), h2 = M.histogram(sc, -4, 4, 50), x2 = h2.map((_, i) => -4 + ((i + 0.5) * 8) / 50), c2 = lin(-4, 4, 200);
      plot(f[1], { x: [-4, 4], y: [0, 0.55], xl: 'qᵀk / √d', yt: [], series: [{ xs: x2, ys: h2, color: c.info, bars: 8 / 50, alpha: 0.7, label: L('样本', 'samples') }, { xs: c2, ys: c2.map((x) => M.normalPdf(x)), color: c.gold, label: 'N(0, 1)' }] });
      return [[['‖X‖/√d 的标准差：样本', 'sd of ‖X‖/√d: sample'], fmt(M.sd(r)), 1], [['大 d 近似 1/√(2d)', 'Large-d value 1/√(2d)'], fmt(sdT)], [['qᵀk 的标准差：样本', 'sd of qᵀk: sample'], fmt(M.sd(dots)), 1], [['理论值 √d', 'Theory √d'], fmt(Math.sqrt(d))], [['缩放后 qᵀk/√d 的标准差', 'sd of qᵀk/√d after scaling'], fmt(M.sd(sc))]];
    },
  };

  // ── 07 曲率、预条件与 Adam ──────────────────────────────────────────────
  D['07'] = {
    title: ['狭长山谷里的三种走法', 'Three ways down a narrow valley'],
    ctl: [['kap', ['条件数 κ', 'Condition number κ'], 1, 100, 1, 25, int], ['eta', ['学习率 η', 'Learning rate η'], 0.005, 0.25, 0.005, 0.07, (v) => v.toFixed(3)], ['mom', ['动量（只对梯度下降）', 'Momentum (gradient descent only)'], 0, 0.95, 0.05, 0, f2], ['n', ['步数', 'Steps'], 5, 120, 1, 40, int]],
    btn: [[['刚好稳定', 'Just stable'], { kap: 25, eta: 0.07, mom: 0 }], [['超过 2/κ：发散', 'Beyond 2/κ: divergence'], { kap: 25, eta: 0.085, mom: 0 }], [['加动量', 'With momentum'], { kap: 25, eta: 0.03, mom: 0.8 }], [['各向同性 κ = 1', 'Isotropic, κ = 1'], { kap: 1, eta: 0.07, mom: 0 }]],
    figs: [[0.56, ['损失 L = ½(θ₁² + κθ₂²) 的等高线和三条轨迹，起点 (−2.5, 1)。', 'Contours of the loss L = ½(θ₁² + κθ₂²) and three trajectories from (−2.5, 1).']], [0.4, ['损失随步数的变化（对数纵轴）。', 'Loss against step (logarithmic vertical axis).']]],
    note: ['二次损失上梯度下降在 η < 2/κ 时才稳定：陡的方向来回震荡，平的方向走得慢。“理想预条件”用 Hessian 的逆乘梯度（这里就是牛顿法，步长 η 改为 0.5），两个方向同速收缩。Adam 用梯度的二阶矩逐坐标缩放，前几步每个坐标都大约走 η，所以它不受 κ 影响，但也不是曲率的逆。真实的损失不是二次的，这些结论只在局部近似成立。', 'On a quadratic loss gradient descent is stable only for η < 2/κ: it oscillates along the steep direction and crawls along the flat one. The ideal preconditioner multiplies the gradient by the inverse Hessian (Newton’s method here, with step 0.5) and contracts both directions at the same rate. Adam rescales each coordinate by the second moment of the gradient, moving about η per coordinate in the first steps, so κ does not affect it; but that is not the inverse curvature. Real losses are not quadratic, and these statements hold only as local approximations.'],
    draw(s, f, c) {
      const st = [-2.5, 1], gd = M.gdPath(st, s.eta, s.kap, s.n, s.mom), pc = M.precondPath(st, 0.5, s.n), ad = M.adamPath(st, s.eta, s.kap, s.n);
      plot(f[0], { x: [-3, 3], y: [-1.6, 1.6], xl: 'θ₁', yl: 'θ₂', series: [{ pts: gd, color: c.danger, dots: 2.5, line: true, width: 1.5, label: L('梯度下降', 'gradient descent') }, { pts: pc, color: c.gold, dots: 2.5, line: true, width: 1.5, label: L('理想预条件', 'ideal preconditioner') }, { pts: ad, color: c.info, dots: 2, line: true, width: 1.5, label: 'Adam' }],
        after: ({ ctx, X, Y, c: cc }) => { ctx.strokeStyle = cc.line; ctx.lineWidth = 1; for (const lv of [0.1, 0.5, 1.5, 3.2]) { ctx.beginPath(); for (let k = 0; k <= 80; k++) { const a = (2 * Math.PI * k) / 80, x = Math.sqrt(2 * lv) * Math.cos(a), y = Math.sqrt((2 * lv) / s.kap) * Math.sin(a); if (k) ctx.lineTo(X(x), Y(y)); else ctx.moveTo(X(x), Y(y)); } ctx.stroke(); } } });
      const ll = (path) => path.map((p) => Math.max(-12, Math.log10(Math.max(1e-300, M.quadLoss(p, s.kap))))), it = (path) => path.map((_, i) => i);
      const a = ll(gd), b = ll(pc), d = ll(ad), hi = Math.min(8, Math.max(2, ...a));
      plot(f[1], { x: [0, s.n], y: [-12, hi], xl: L('步数', 'step'), yl: 'L', yt: [-12, -9, -6, -3, 0, 3, 6].filter((t) => t <= hi), yf: K.pow, series: [{ xs: it(gd), ys: a, color: c.danger }, { xs: it(pc), ys: b, color: c.gold }, { xs: it(ad), ys: d, color: c.info }] });
      const end = (p) => fmt(M.quadLoss(p.at(-1), s.kap), 3);
      return [[['稳定条件 η < 2/κ', 'Stability: η < 2/κ'], `${fmt(s.eta)} ${s.eta < 2 / s.kap ? '<' : '≥'} ${fmt(2 / s.kap)}`, 1], [['梯度下降：最后的损失', 'Gradient descent: final loss'], gd.length <= s.n ? L('发散', 'diverged') : end(gd)], [['理想预条件：最后的损失', 'Ideal preconditioner: final loss'], end(pc)], [['Adam：最后的损失', 'Adam: final loss'], end(ad)]];
    },
  };

  // ── 08 Fisher 几何与自然梯度 ────────────────────────────────────────────
  D['08'] = {
    title: ['同样大的 KL 预算，往哪走降得最多', 'With the same KL budget, which step descends most'],
    ctl: [['a', ['Fisher 的大特征值', 'Larger Fisher eigenvalue'], 0.3, 6, 0.1, 4, (v) => v.toFixed(1)], ['b', ['Fisher 的小特征值', 'Smaller Fisher eigenvalue'], 0.1, 6, 0.1, 0.5, (v) => v.toFixed(1)], ['an', ['Fisher 主轴的方向', 'Orientation of the Fisher axes'], 0, 180, 1, 30, deg], ['ga', ['梯度 g 的方向', 'Direction of the gradient g'], 0, 360, 1, 60, deg], ['del', ['KL 预算 δ', 'KL budget δ'], 0.05, 1, 0.01, 0.3, f2], ['p', ['下图：伯努利参数 p', 'Lower figure: Bernoulli parameter p'], 0.05, 0.95, 0.01, 0.3, f2]],
    btn: [[['F = I：两者重合', 'F = I: the two coincide'], { a: 1, b: 1 }], [['很扁的椭圆', 'A very flat ellipse'], { a: 6, b: 0.2 }]],
    figs: [[0.62, ['椭圆是 ½ΔᵀFΔ = δ（局部的等 KL 线）。灰色箭头是 −g 方向走到椭圆上的一步，金色箭头是自然梯度步 Δ*。虚线是损失线性近似 gᵀΔ 的等值线，越往 −g 一侧越低。', 'The ellipse is ½ΔᵀFΔ = δ (the local level set of KL). The grey arrow is a step along −g that reaches the ellipse; the gold arrow is the natural-gradient step Δ*. Dashed lines are level sets of the linearised loss gᵀΔ, lower towards −g.']], [0.4, ['附录 A 的检验：伯努利分布的精确 KL(p‖p+Δ) 和二阶近似 ½FΔ²，F = 1/(p(1−p))。', 'A check of Appendix A: the exact KL(p‖p+Δ) of a Bernoulli distribution and its second-order approximation ½FΔ², with F = 1/(p(1−p)).']]],
    note: ['上图的 Fisher 矩阵是人为设定的正定矩阵，只演示局部几何：在 ½ΔᵀFΔ ≤ δ 的约束下让 gᵀΔ 最小，解是 Δ* = −√(2δ/gᵀF⁻¹g)·F⁻¹g（附录 A）。读数里的“gᵀΔ”越负越好，自然梯度步总不比同一椭圆上的最速下降步差。TRPO 用的就是这类 KL 信赖域。二阶近似只在 Δ 小的时候准，下图可以看到它在哪里开始偏离。', 'The Fisher matrix of the upper figure is a positive-definite matrix set by hand, showing only the local geometry: minimising gᵀΔ subject to ½ΔᵀFΔ ≤ δ gives Δ* = −√(2δ/gᵀF⁻¹g)·F⁻¹g (Appendix A). In the read-out a more negative gᵀΔ is better, and the natural step is never worse than the steepest-descent step on the same ellipse. TRPO uses this kind of KL trust region. The second-order approximation is accurate only for small Δ; the lower figure shows where it starts to drift.'],
    draw(s, f, c) {
      const F = M.fisher2(s.a, s.b, rad(s.an)), g = [Math.cos(rad(s.ga)), Math.sin(rad(s.ga))], nat = M.naturalStep(F, g, s.del);
      const sdScale = Math.sqrt((2 * s.del) / M.quadForm(F, g)), sd = [-sdScale * g[0], -sdScale * g[1]];
      const ell = Array.from({ length: 121 }, (_, i) => { const t = (2 * Math.PI * i) / 120, u = [Math.cos(t), Math.sin(t)], k = Math.sqrt((2 * s.del) / M.quadForm(F, u)); return [k * u[0], k * u[1]]; });
      const R = Math.max(1.2, ...ell.map((p) => Math.max(Math.abs(p[0]), Math.abs(p[1]) * 1.5))) * 1.12;
      plot(f[0], { x: [-R, R], y: [-R * 0.62, R * 0.62], eq: true, series: [{ pts: ell, color: c.accent, fill: true, label: '½ΔᵀFΔ = δ' }],
        arrows: [{ from: [0, 0], to: sd, color: c.muted, width: 2.2 }, { from: [0, 0], to: nat, color: c.gold, width: 2.6 }],
        texts: [{ x: sd[0], y: sd[1], s: '−g', color: c.muted, dx: 6, dy: -6 }, { x: nat[0], y: nat[1], s: 'Δ*', color: c.gold, dx: 6, dy: 12 }],
        after: ({ ctx, X, Y, c: cc }) => { ctx.strokeStyle = cc.faint; ctx.setLineDash([3, 5]); ctx.lineWidth = 1; for (const lv of [-2, -1, 0, 1, 2]) { const q = lv * R * 0.4, px = q * g[0], py = q * g[1]; ctx.beginPath(); ctx.moveTo(X(px - 4 * R * g[1]), Y(py + 4 * R * g[0])); ctx.lineTo(X(px + 4 * R * g[1]), Y(py - 4 * R * g[0])); ctx.stroke(); } ctx.setLineDash([]); } });
      const dot = (u) => g[0] * u[0] + g[1] * u[1], ang = (Math.acos(Math.max(-1, Math.min(1, (sd[0] * nat[0] + sd[1] * nat[1]) / (M.norm(sd) * M.norm(nat))))) * 180) / Math.PI;
      const Fp = 1 / (s.p * (1 - s.p)), lim = Math.min(s.p, 1 - s.p) * 0.95, ds = lin(-lim, lim, 201);
      plot(f[1], { x: [-lim, lim], y: [0, Math.min(0.5, M.bernKL(s.p, s.p + lim) * 1.05)], xl: 'Δ', yl: 'KL', series: [{ xs: ds, ys: ds.map((d) => M.bernKL(s.p, s.p + d)), color: c.accent, label: L('精确 KL', 'exact KL') }, { xs: ds, ys: ds.map((d) => 0.5 * Fp * d * d), color: c.gold, dash: [5, 4], label: '½FΔ²' }] });
      return [[['½Δ*ᵀFΔ*（应等于 δ）', '½Δ*ᵀFΔ* (should equal δ)'], fmt(0.5 * M.quadForm(F, nat), 5)], [['gᵀΔ：自然梯度步', 'gᵀΔ: natural step'], fmt(dot(nat), 4), 1], [['gᵀΔ：最速下降步', 'gᵀΔ: steepest-descent step'], fmt(dot(sd), 4), 1], [['两个方向的夹角', 'Angle between the two'], `${ang.toFixed(1)}°`], [['伯努利的 F = 1/(p(1−p))', 'Bernoulli F = 1/(p(1−p))'], fmt(Fp)]];
    },
  };

  // ── 09 Muon：把奇异值都推到 1 ───────────────────────────────────────────
  D['09'] = {
    title: ['正交化更新：奇异值被逐步推向 1', 'Orthogonalising an update: singular values pushed towards 1'],
    ctl: [['decay', ['动量矩阵的奇异值衰减', 'Decay of the momentum’s singular values'], 0.5, 10, 0.1, 3, (v) => v.toFixed(1)], ['it', ['Newton–Schulz 迭代次数', 'Newton–Schulz iterations'], 0, 14, 1, 5, int]],
    btn: [[['不迭代', 'No iteration'], { it: 0 }], [['5 次', '5 iterations'], { it: 5 }], [['很小的奇异值', 'Tiny singular values'], { decay: 1.2, it: 5 }]],
    figs: [[0.42, ['12 个奇异值：归一化后的原值（灰）和迭代后的值（深色）。极因子 UVᵀ 对应全部为 1（金线）。', 'Twelve singular values: the normalised originals (grey) and the values after iteration (dark). The polar factor UVᵀ corresponds to all ones (gold line).']], [0.42, ['迭代把每个奇异值 s 映到哪里：横轴是迭代前，纵轴是迭代后。', 'Where the iteration sends each singular value s: before on the horizontal axis, after on the vertical.']]],
    note: ['这里用的是经典的三次 Newton–Schulz 迭代 X ← 1.5X − 0.5XXᵀX，它对每个奇异值做 s ← 1.5s − 0.5s³，不需要显式做 SVD。实际 Muon 实现用的是系数另行调过的多项式，本页没有核对那组系数，所以没有照搬。看“很小的奇异值”这个预设：小奇异值收敛得慢；而一旦迭代够多，原本几乎没有信号的方向也被放大到 1，这正是附录 L 里“Muon 对秩亏梯度是否放大噪声”那个研究问题。谱是人为设定的。', 'This is the classical cubic Newton–Schulz iteration X ← 1.5X − 0.5XXᵀX, which acts on each singular value as s ← 1.5s − 0.5s³ with no explicit SVD. Actual Muon implementations use a polynomial with separately tuned coefficients; they were not checked for this page and are not reproduced. Try the preset with tiny singular values: small ones converge slowly, and once there are enough iterations, directions that carried almost no signal are amplified to 1 as well, which is the research question of Appendix L on whether Muon amplifies noise for rank-deficient gradients. The spectrum is set by hand.'],
    draw(s, f, c) {
      const sig = M.spectrum(12, s.decay), s0 = M.newtonSchulz(sig, 0), s1 = M.newtonSchulz(sig, s.it), idx = sig.map((_, i) => i + 1);
      plot(f[0], { x: [0, 13], y: [0, 1.15], xl: 'i', yl: 'σᵢ', series: [{ xs: idx.map((i) => i - 0.2), ys: s0, color: c.faint, bars: 0.38, label: L('迭代前', 'before') }, { xs: idx.map((i) => i + 0.2), ys: s1, color: c.accent, bars: 0.38, label: L('迭代后', 'after') }], hmarks: [{ y: 1, color: c.gold }] });
      const xs = lin(0, 1, 201);
      plot(f[1], { x: [0, 1], y: [0, 1.1], xl: L('迭代前的 s', 's before'), yl: L('迭代后', 'after'), series: [{ xs, ys: xs.map((x) => M.newtonSchulz([1, x], s.it)[1]), color: c.accent, label: L(`${s.it} 次迭代`, `${s.it} iterations`) }, { xs: [0, 1], ys: [0, 1], color: c.faint, dash: [4, 4], width: 1.2, label: L('不变', 'identity') }, { pts: s0.map((v, i) => [v, s1[i]]), color: c.gold, dots: 3.5 }] });
      return [[['迭代后最小 / 最大奇异值', 'Smallest / largest after'], `${fmt(Math.min(...s1))} / ${fmt(Math.max(...s1))}`, 1], [['离正交还差 max|1 − s|', 'Distance from orthogonal, max|1 − s|'], fmt(Math.max(...s1.map((v) => Math.abs(1 - v))))], [['核范数 ‖M‖* = ⟨M, UVᵀ⟩（归一化后）', 'Nuclear norm ‖M‖* = ⟨M, UVᵀ⟩ (normalised)'], fmt(M.nuclear(s0))], [['最小奇异值被放大的倍数', 'Amplification of the smallest'], `${fmt(Math.min(...s1) / Math.min(...s0))}×`]];
    },
  };

  // ── 10 Transformer 的数学骨架 ───────────────────────────────────────────
  D['10'] = {
    title: ['一层 Transformer 里，张量是什么形状', 'What shape the tensors have inside one Transformer layer'],
    ctl: [['T', ['序列长度 n', 'Sequence length n'], 4, 64, 4, 16, int], ['d', ['宽度 d', 'Width d'], 64, 1024, 64, 256, int], ['h', ['注意力头数', 'Attention heads'], 1, 16, 1, 8, int], ['Ly', ['层数', 'Layers'], 1, 48, 1, 12, int]],
    figs: [['html', ['', '']]],
    note: ['这是 pre-norm 解码器层的教学示意：H = X + Attn(Norm(X))，Y = H + MLP(Norm(H))，MLP 的中间宽度取 4d。参数量只数了 W_Q、W_K、W_V、输出投影和 MLP 的两个矩阵（偏置、归一化和词表另算），实际模型的 MLP 倍数、是否共享、是否带门控各不相同。注意力分数是 n×n 的，所以这一项随序列长度按平方增长。', 'A teaching sketch of a pre-norm decoder layer: H = X + Attn(Norm(X)), Y = H + MLP(Norm(H)), with an MLP hidden width of 4d. The parameter count covers only W_Q, W_K, W_V, the output projection and the two MLP matrices (biases, normalisation and the vocabulary are extra); real models differ in the MLP ratio, in sharing and in gating. Attention scores are n×n, so that term grows quadratically with sequence length.'],
    draw(s, f) {
      const ok = s.d % s.h === 0, dh = s.d / s.h, sh = (...a) => a.join(' × ');
      f[0].innerHTML = `${row(box(L('输入 X', 'Input X'), sh(s.T, s.d)), box('Norm', sh(s.T, s.d)), box('Q, K, V', `${s.h} × ${sh(s.T, ok ? dh : dh.toFixed(1))}`), box(L('分数 QKᵀ/√dₖ + 掩码', 'Scores QKᵀ/√dₖ + mask'), `${s.h} × ${sh(s.T, s.T)}`, 'is-gold'), box('softmax · V', sh(s.T, s.d)), box('H = X + Attn', sh(s.T, s.d), 'is-accent'))}
        ${row(box('H', sh(s.T, s.d)), box('Norm', sh(s.T, s.d)), box('MLP ↑', sh(s.T, 4 * s.d)), box('MLP ↓', sh(s.T, s.d)), box('Y = H + MLP', sh(s.T, s.d), 'is-accent'))}
        <p class="aim-flow-h">${L(`这样的层叠 ${s.Ly} 次；残差那条线从头到尾形状不变。`, `Such a layer is stacked ${s.Ly} times; the residual stream keeps its shape throughout.`)}</p>`;
      const att = 4 * s.d * s.d, mlp = 8 * s.d * s.d;
      return [[['每个头的宽度 dₖ = d/h', 'Width per head dₖ = d/h'], ok ? String(dh) : L(`${dh.toFixed(2)}（d 应能被头数整除）`, `${dh.toFixed(2)} (d should be divisible by h)`), 1], [['注意力分数的个数 h·n²', 'Attention scores, h·n²'], (s.h * s.T * s.T).toLocaleString('en-US')], [['每层注意力参数 4d²', 'Attention parameters per layer, 4d²'], att.toLocaleString('en-US')], [['每层 MLP 参数 8d²', 'MLP parameters per layer, 8d²'], mlp.toLocaleString('en-US')], [['全部层合计', 'All layers together'], fmt((att + mlp) * s.Ly, 4), 1]];
    },
  };

  // ── 11 注意力 ───────────────────────────────────────────────────────────
  const KEYS = [[1, 0], [0, 1], [1, 1]], VALS = [[1, 0], [0, 2], [1, 1]];
  const CAUSAL = Array.from({ length: 6 }, (_, i) => Array.from({ length: 6 }, (_, j) => 1.2 * Math.cos(0.9 * (i - j)) + (j === 0 ? 0.6 : 0) - 0.15 * Math.abs(i - j)));
  D['11'] = {
    title: ['一行注意力：分数、权重、输出', 'One row of attention: scores, weights, output'],
    ctl: [['qa', ['查询 q 的方向', 'Direction of the query q'], 0, 360, 1, 0, deg], ['ql', ['查询 q 的长度', 'Length of the query q'], 0.1, 6, 0.1, 1, (v) => v.toFixed(1)]],
    chk: [['mask', ['屏蔽第 3 个键（掩码 −∞）', 'Mask the third key (mask −∞)'], false]],
    btn: [[['讲义的例子 q = (1, 0)', 'The notes’ example, q = (1, 0)'], { qa: 0, ql: 1, mask: false }], [['把 q 拉长：权重变尖', 'Lengthen q: sharper weights'], { qa: 0, ql: 5 }]],
    act: [[['核对附录 B 的反向式', 'Check the backward pass of Appendix B'], (s) => { s.seed = (s.seed || 36) + 1; s.check = M.attnGradCheck(s.seed); }]],
    figs: [[0.5, ['查询 q（金色）和三个键 k₁ = (1,0)、k₂ = (0,1)、k₃ = (1,1)。分数是点积除以 √2。', 'The query q (gold) and three keys k₁ = (1,0), k₂ = (0,1), k₃ = (1,1). Scores are dot products divided by √2.']], [0.36, ['softmax 之后的权重。输出是值向量 (1,0)、(0,2)、(1,1) 按这些权重的加权平均。', 'The weights after softmax. The output is the average of the values (1,0), (0,2), (1,1) under these weights.']], [0.5, ['因果掩码下的权重矩阵（6 个位置，logits 是人为指定的）：每一行只能看自己和左边，行和为 1。', 'A weight matrix under a causal mask (6 positions, logits chosen by hand): each row sees only itself and positions to its left, and sums to 1.']]],
    note: ['上面两张图是精确计算：默认值就是讲义里的手算例子，权重约 (0.401, 0.198, 0.401)，输出约 (0.802, 0.797)。把 q 拉长相当于降低温度。因果矩阵的 logits 是教学设定，不是从真实模型里读出来的。“核对附录 B”会随机生成 4×3 的 Q、K、V 和上游梯度，用附录 B 的矩阵反向式算方向导数，再和中心差分比较；每点一次换一个种子。', 'The upper two figures are exact: the defaults are the hand-computed example of the notes, with weights about (0.401, 0.198, 0.401) and output about (0.802, 0.797). Lengthening q acts like lowering the temperature. The logits of the causal matrix are a teaching choice, not read from a real model. The check button draws random 4×3 matrices Q, K, V and an upstream gradient, computes a directional derivative with the matrix backward pass of Appendix B and compares it with central differences; each click uses a new seed.'],
    draw(s, f, c) {
      const q = [s.ql * Math.cos(rad(s.qa)), s.ql * Math.sin(rad(s.qa))], r = M.attention(q, KEYS, VALS, Math.SQRT2, s.mask ? [true, true, false] : null);
      const R = Math.max(1.6, s.ql * 1.1);
      plot(f[0], { x: [-R, R], y: [-R * 0.4, R * 0.7], eq: true, arrows: [...KEYS.map((k, j) => ({ from: [0, 0], to: k, color: s.mask && j === 2 ? c.faint : c.accent, width: 2 })), { from: [0, 0], to: q, color: c.gold, width: 2.6 }],
        texts: [...KEYS.map((k, j) => ({ x: k[0], y: k[1], s: `k${'₁₂₃'[j]}`, color: c.accent, dx: 6, dy: -6 })), { x: q[0], y: q[1], s: 'q', color: c.gold, dx: 6, dy: 12 }, { x: r.out[0], y: r.out[1], s: 'o', color: c.danger, dx: 8, dy: 4 }], series: [{ pts: [r.out], color: c.danger, dots: 5, label: L('输出 o（值的加权平均）', 'output o (weighted mean of values)') }] });
      plot(f[1], { x: [0.4, 3.6], y: [0, 1], xt: [1, 2, 3], xf: (t) => `k${'₁₂₃'[t - 1]}`, yl: L('权重', 'weight'), series: [{ xs: [1, 2, 3], ys: r.weights, color: c.accent, bars: 0.6 }], texts: r.weights.map((w, j) => ({ x: j + 1, y: w, s: w.toFixed(3), align: 'center', dy: -6 })) });
      heat(f[2], M.causalWeights(CAUSAL), { rows: [1, 2, 3, 4, 5, 6].map((i) => `t=${i}`), cols: [1, 2, 3, 4, 5, 6].map(String), max: 1, mask: (i, j) => j > i, xl: L('被看的位置', 'position attended to') });
      const J = M.softmaxJacobian(r.weights), rows = [[['缩放后的分数', 'Scaled scores'], `(${r.scores.map((v) => (v === -Infinity ? '−∞' : v.toFixed(3))).join(', ')})`], [['权重', 'Weights'], `(${r.weights.map((v) => v.toFixed(3)).join(', ')})`, 1], [['输出', 'Output'], `(${r.out.map((v) => v.toFixed(3)).join(', ')})`, 1], [['Jacobian 每行之和（应为 0）', 'Row sums of the Jacobian (should be 0)'], fmt(Math.max(...J.map((rw) => Math.abs(rw.reduce((a, b) => a + b, 0)))), 2)]];
      if (s.check) rows.push([[`附录 B：解析（种子 ${s.seed}）`, `Appendix B: analytic (seed ${s.seed})`], s.check.analytic.toFixed(10)], [['中心差分', 'Central difference'], s.check.numeric.toFixed(10)], [['相对误差', 'Relative error'], fmt(s.check.rel, 3), 1]);
      return rows;
    },
  };

  // ── 12 RoPE ─────────────────────────────────────────────────────────────
  const RQ = [1, 0.3], RK = [0.6, 0.9];
  D['12'] = {
    title: ['旋转位置编码：点积只看相对位置', 'Rotary position embedding: the dot product sees only relative position'],
    ctl: [['m', ['查询的位置 m', 'Position of the query, m'], 0, 30, 1, 3, int], ['n', ['键的位置 n', 'Position of the key, n'], 0, 30, 1, 7, int], ['w', ['角频率 ω', 'Angular frequency ω'], 0.02, 1, 0.01, 0.3, f2], ['sh', ['两个位置一起平移', 'Shift both positions together'], 0, 30, 1, 0, int]],
    figs: [[0.5, ['q 和 k（细线）各自按自己的位置转一个角度，得到 q_m 和 k_n（粗箭头）。一起平移时两个箭头同转，夹角不变。', 'q and k (thin lines) are each rotated by an angle set by their own position, giving q_m and k_n (thick arrows). Shifting both rotates the two arrows together and keeps the angle between them.']], [0.4, ['点积随相对位置 n − m 的变化；金色的点是当前的相对位置。', 'The dot product against relative position n − m; the gold point is the current offset.']]],
    note: ['这里只画了一个二维平面、一个频率。实际的 RoPE 把 d 维向量拆成 d/2 个平面，每个平面用不同的频率。读数里的两个数应该相等到舍入误差：q_mᵀk_n = qᵀR((n−m)ω)k，这是旋转矩阵 R(a)ᵀR(b) = R(b−a) 的直接结果。它是位置进入注意力的一种方式，不保证模型能外推到训练时没见过的长度。', 'Only one two-dimensional plane and one frequency are drawn. Real RoPE splits a d-dimensional vector into d/2 planes, each with its own frequency. The two numbers in the read-out should agree to rounding error: q_mᵀk_n = qᵀR((n−m)ω)k, a direct consequence of R(a)ᵀR(b) = R(b−a). It is one way for position to enter attention, and does not guarantee extrapolation to lengths unseen in training.'],
    draw(s, f, c) {
      const m = s.m + s.sh, n = s.n + s.sh, qm = M.matvec(M.rot2(m * s.w), RQ), kn = M.matvec(M.rot2(n * s.w), RK);
      plot(f[0], { x: [-1.5, 1.5], y: [-1.25, 1.25], eq: true, arrows: [{ from: [0, 0], to: RQ, color: c.faint, width: 1.2 }, { from: [0, 0], to: RK, color: c.faint, width: 1.2 }, { from: [0, 0], to: qm, color: c.gold, width: 2.6 }, { from: [0, 0], to: kn, color: c.accent, width: 2.6 }],
        texts: [{ x: qm[0], y: qm[1], s: 'q_m', color: c.gold, dx: 6, dy: -6 }, { x: kn[0], y: kn[1], s: 'k_n', color: c.accent, dx: 6, dy: 12 }] });
      const rel = lin(-30, 30, 241), a = M.ropeDot(RQ, RK, m, n, s.w), b = M.ropeRel(RQ, RK, s.n - s.m, s.w);
      plot(f[1], { x: [-30, 30], y: [-1.3, 1.3], xl: 'n − m', yl: 'q_mᵀk_n', series: [{ xs: rel, ys: rel.map((r) => M.ropeRel(RQ, RK, r, s.w)), color: c.accent }], marks: [{ x: s.n - s.m, y: b, color: c.gold }] });
      return [[['位置 m、n', 'Positions m, n'], `${m}, ${n}`], [['q_mᵀk_n（先各自旋转再点积）', 'q_mᵀk_n (rotate each, then dot)'], a.toFixed(12), 1], [['qᵀR((n−m)ω)k（只用相对位置）', 'qᵀR((n−m)ω)k (relative position only)'], b.toFixed(12), 1], [['两者之差', 'Difference'], fmt(Math.abs(a - b), 2)]];
    },
  };

  // ── 13 残差、谱稳定性与 mHC ─────────────────────────────────────────────
  const POS = M.positiveMatrix(5), V0 = [1, -0.6, 0.8, 0.3, -1.1];
  D['13'] = {
    title: ['双随机混合不放大信号；略大于 1 的增益会', 'Doubly stochastic mixing does not amplify; a gain slightly above 1 does'],
    ctl: [['it', ['Sinkhorn 迭代次数', 'Sinkhorn iterations'], 0, 40, 1, 20, int], ['ly', ['连乘的层数', 'Layers multiplied'], 1, 80, 1, 40, int], ['gain', ['对照：每层增益', 'Comparison: gain per layer'], 0.9, 1.2, 0.01, 1.1, f2]],
    btn: [[['不归一化', 'No normalisation'], { it: 0 }], [['归一化 20 次', '20 normalisations'], { it: 20 }]],
    figs: [[0.5, ['一个 5×5 正矩阵交替做行、列归一化之后的 P。迭代够多时每行、每列的和都是 1。', 'A 5×5 positive matrix P after alternating row and column normalisation. With enough iterations every row and column sums to 1.']], [0.42, ['同一个向量反复乘以 P（深色）和反复乘以“增益·I”（金色）之后的范数，对数纵轴。', 'The norm of one vector after repeated multiplication by P (dark) and by gain·I (gold); logarithmic vertical axis.']]],
    note: ['正矩阵是固定种子生成的。双随机矩阵（非负、行和列和都是 1）的谱范数不超过 1，所以连乘多少层范数都不会增大；每层只放大 10% 的线性映射，40 层之后就是 1.1⁴⁰ ≈ 45 倍。迭代次数为 0 时 P 就是原始正矩阵，谱范数大于 1，范数会爆炸。这只说明这一个线性混合不扩张：非线性分支和依赖输入的部分仍然可能放大信号，mHC [10] 是近期预印本。', 'The positive matrix comes from a fixed seed. A doubly stochastic matrix (non-negative, all row and column sums equal to 1) has spectral norm at most 1, so no number of layers increases the norm; a linear map that amplifies by just 10% per layer gives 1.1⁴⁰ ≈ 45 after 40 layers. With zero iterations P is the raw positive matrix, whose spectral norm exceeds 1, and the norm explodes. This shows only that this one linear mixing is non-expansive: nonlinear branches and input-dependent parts can still amplify, and mHC [10] is a recent preprint.'],
    draw(s, f, c) {
      const P = s.it ? M.sinkhornNormalize(POS, s.it) : POS, np = M.repeatNorms(P, V0, s.ly).map((v) => Math.log10(v / M.norm(V0))), ng = Array.from({ length: s.ly + 1 }, (_, i) => i * Math.log10(s.gain));
      heat(f[0], P, { rows: [1, 2, 3, 4, 5].map((i) => `${L('行', 'row')} ${i}`), max: Math.max(...P.flat()), fmt: (v) => v.toFixed(2) });
      const lo = Math.min(-1, ...np, ...ng), hi = Math.max(1, ...np.map((v) => Math.min(v, 12)), ...ng);
      plot(f[1], { x: [0, s.ly], y: [lo, hi], xl: L('层数', 'layers'), yl: '‖x_l‖ / ‖x₀‖', yf: (t) => (Number.isInteger(t) ? K.pow(t) : ''), series: [{ xs: np.map((_, i) => i), ys: np, color: c.accent, label: L('乘以 P', 'multiply by P') }, { xs: ng.map((_, i) => i), ys: ng, color: c.gold, label: L(`增益 ${s.gain.toFixed(2)}`, `gain ${s.gain.toFixed(2)}`) }], hmarks: [{ y: 0, color: c.faint }] });
      return [[['行和、列和离 1 最远', 'Largest deviation of a row or column sum from 1'], fmt(M.marginResidual(P), 3), 1], [['P 的谱范数', 'Spectral norm of P'], M.specNorm(P).toFixed(6), 1], [[`乘 ${s.ly} 层后的范数比`, `Norm ratio after ${s.ly} layers`], fmt(10 ** np.at(-1))], [[`增益 ${s.gain.toFixed(2)} 的 ${s.ly} 次方`, `Gain ${s.gain.toFixed(2)} to the power ${s.ly}`], fmt(s.gain ** s.ly)]];
    },
  };

  // ── 14 状态空间模型 ─────────────────────────────────────────────────────
  const SSM_X = [0, 1, 0, 0, 0, 0, 0, 0, 0.6, 0.6, 0.6, 0.6, 0, 0, 0, 0, 0, 0, 0, 0];
  D['14'] = {
    title: ['一个标量状态：递推就是一个下三角的卷积核', 'One scalar state: the recursion is a lower-triangular kernel'],
    ctl: [['a', ['状态保留系数 a', 'State retention a'], 0, 0.99, 0.01, 0.8, f2], ['tau', ['下面换算：连续时间常数 τ', 'Conversion below: continuous time constant τ'], 0.2, 20, 0.1, 4.5, (v) => v.toFixed(1)]],
    btn: [[['记得短 a = 0.3', 'Short memory, a = 0.3'], { a: 0.3 }], [['记得长 a = 0.95', 'Long memory, a = 0.95'], { a: 0.95 }]],
    figs: [[0.5, ['展开递推得到的核 a^{t−s}（s ≤ t）：第 t 行是时刻 t 的输出对过去各个输入的权重。', 'The kernel a^{t−s} (s ≤ t) obtained by unrolling the recursion: row t holds the weights of past inputs in the output at time t.']], [0.4, ['输入（柱：一个脉冲和一段常值）和状态 hₜ = a·hₜ₋₁ + xₜ（线）。', 'Input (bars: an impulse and a constant stretch) and the state hₜ = a·hₜ₋₁ + xₜ (line).']]],
    note: ['这是 A、B、C 都取常数标量的最简单情形：yₜ = Σ_{s≤t} a^{t−s}xₛ，对应主题公式里连乘的那一项。计算是线性时间、常数状态；选择性状态空间模型（如 Mamba）让 A、B 依赖输入，核不再是固定的指数。零阶保持把连续系统 ḣ = −h/τ + x 在步长 1 上离散化，得到 a = e^{−1/τ}。它和注意力的对偶关系 [11] 需要更多结构，这里没有演示。', 'The simplest case, with constant scalar A, B and C: yₜ = Σ_{s≤t} a^{t−s}xₛ, which is the product term of the topic’s formula. Computation is linear in time with constant state; selective state-space models such as Mamba let A and B depend on the input, so the kernel is no longer a fixed exponential. Zero-order hold discretises the continuous system ḣ = −h/τ + x with step 1 into a = e^{−1/τ}. The duality with attention [11] needs more structure and is not shown.'],
    draw(s, f, c) {
      heat(f[0], M.ssmKernel(s.a, 10), { rows: Array.from({ length: 10 }, (_, i) => `t=${i + 1}`), cols: Array.from({ length: 10 }, (_, i) => String(i + 1)), max: 1, mask: (i, j) => j > i, num: false, xl: L('输入的时刻 s', 'input time s') });
      const h = M.ssmRun(s.a, SSM_X), ts = SSM_X.map((_, i) => i + 1);
      plot(f[1], { x: [0, 21], y: [0, Math.max(1.2, ...h) * 1.08], xl: 't', series: [{ xs: ts, ys: SSM_X, color: c.faint, bars: 0.7, label: 'xₜ' }, { xs: ts, ys: h, color: c.accent, dots: 3, line: true, label: 'hₜ' }] });
      const z = M.zoh(-1 / s.tau, 1, 1);
      return [[['半衰期（步）', 'Half-life (steps)'], s.a > 0 ? fmt(Math.log(0.5) / Math.log(s.a)) : '0', 1], [['常值输入的稳态增益 1/(1−a)', 'Steady-state gain for constant input, 1/(1−a)'], fmt(1 / (1 - s.a))], [[`零阶保持：τ = ${s.tau.toFixed(1)} 对应 a`, `Zero-order hold: τ = ${s.tau.toFixed(1)} gives a`], fmt(z.Ab, 4)], [['对应的输入系数 B̄', 'Matching input coefficient B̄'], fmt(z.Bb, 4)]];
    },
  };

  // ── 15 MoE ──────────────────────────────────────────────────────────────
  D['15'] = {
    title: ['top-k 路由：每个 token 只叫醒几个专家', 'Top-k routing: each token wakes only a few experts'],
    ctl: [['E', ['专家数', 'Experts'], 4, 12, 1, 8, int], ['k', ['每个 token 选几个', 'Experts per token, k'], 1, 4, 1, 2, int], ['skew', ['路由的偏好有多不均', 'How uneven the router’s preference is'], 0, 3, 0.1, 1.5, (v) => v.toFixed(1)], ['bal', ['负载均衡的力度', 'Strength of load balancing'], 0, 0.3, 0.01, 0, f2]],
    btn: [[['不均衡', 'No balancing'], { bal: 0 }], [['加均衡', 'With balancing'], { bal: 0.15 }]],
    figs: [[0.6, ['24 个 token（行）在各个专家（列）上的门控权重：每行只有 k 个非零，和为 1。', 'Gating weights of 24 tokens (rows) over the experts (columns): each row has only k non-zeros, summing to 1.']], [0.36, ['每个专家接到多少 token。金线是完全均衡时的负载。', 'How many tokens each expert receives. The gold line is the load under perfect balance.']]],
    note: ['路由的 logits 是“固定偏好 + 高斯噪声”，固定种子；偏好越不均，少数专家越忙，其余的闲着（训练时得不到梯度）。这里的“负载均衡”是一个示意：已经接了很多 token 的专家，logit 被按比例压低。真实系统用辅助损失或偏置项来做 [12]，细节不同。每个 token 只激活 k/E 的专家参数，所以“总参数量”和“每个 token 用到的参数量”要分开报。', 'Router logits are a fixed preference plus Gaussian noise, with a fixed seed; the more uneven the preference, the busier a few experts are while the rest idle (and receive no gradient in training). The load balancing here is a sketch: experts that already hold many tokens have their logit lowered in proportion. Real systems use auxiliary losses or bias terms [12], and the details differ. Each token activates only k/E of the expert parameters, so total parameters and parameters used per token must be reported separately.'],
    draw(s, f, c) {
      const k = Math.min(s.k, s.E), r = M.moeRoute(24, s.E, k, s.skew, s.bal);
      heat(f[0], r.route, { cols: Array.from({ length: s.E }, (_, i) => `E${i + 1}`), max: 1, num: false });
      const xs = r.load.map((_, i) => i + 1);
      plot(f[1], { x: [0.3, s.E + 0.7], y: [0, Math.max(...r.load, r.mean) * 1.15], xt: xs, xf: (t) => `E${t}`, yl: L('token 数', 'tokens'), series: [{ xs, ys: r.load, color: c.accent, bars: 0.7 }], hmarks: [{ y: r.mean, color: c.gold }] });
      return [[['最忙的专家 / 平均负载', 'Busiest expert / mean load'], `${fmt(Math.max(...r.load) / r.mean)}×`, 1], [['没接到 token 的专家', 'Experts with no tokens'], String(r.load.filter((v) => v === 0).length)], [['每个 token 激活的专家参数', 'Expert parameters active per token'], pct(k / s.E)], [['平均负载 24k/E', 'Mean load 24k/E'], fmt(r.mean)]];
    },
  };

  // ── 16 多模态对比学习 ───────────────────────────────────────────────────
  D['16'] = {
    title: ['InfoNCE：温度决定这批样本里谁算难例', 'InfoNCE: the temperature decides which negatives count'],
    ctl: [['tau', ['温度 τ', 'Temperature τ'], 0.02, 1, 0.01, 0.1, f2], ['noise', ['图文配对的噪声', 'Noise in the image–text pairing'], 0, 2, 0.05, 0.6, f2]],
    btn: [[['τ 很小', 'Tiny τ'], { tau: 0.03 }], [['τ = 1', 'τ = 1'], { tau: 1 }], [['完美配对', 'Perfect pairs'], { noise: 0 }]],
    figs: [[0.62, ['一批 6 对样本的 softmax 概率 pᵢⱼ：第 i 行是图像 i 对各条文本的分布，对角线（金色）是正确的配对。', 'Softmax probabilities pᵢⱼ for a batch of 6 pairs: row i is the distribution of image i over the texts, and the diagonal (gold) is the correct pairing.']]],
    note: ['嵌入是 8 维单位向量，文本嵌入 = 图像嵌入加高斯噪声再归一化（固定种子），相似度是余弦。损失是图像→文本一个方向的平均；CLIP [13] 用的是两个方向的对称版本。对 sᵢⱼ 的梯度是 (pᵢⱼ − 1[i=j])/τ：温度越低，分布越尖，梯度集中在最像的几个负例上，同时整体放大 1/τ 倍。批里其他样本被当作负例，其中可能混有语义上其实匹配的“假负例”。', 'Embeddings are 8-dimensional unit vectors; a text embedding is the image embedding plus Gaussian noise, renormalised (fixed seed), and similarity is the cosine. The loss averages the image-to-text direction only; CLIP [13] uses the symmetric version. The gradient with respect to sᵢⱼ is (pᵢⱼ − 1[i=j])/τ: a lower temperature sharpens the distribution, concentrates the gradient on the most similar negatives and scales everything by 1/τ. Other samples in the batch serve as negatives, and some may be false negatives that in fact match.'],
    draw(s, f, c) {
      const e = M.pairEmbeddings(6, 8, s.noise), r = M.infoNCE(e.img, e.txt, s.tau);
      heat(f[0], r.P, { rows: [1, 2, 3, 4, 5, 6].map((i) => `${L('图', 'img')} ${i}`), cols: [1, 2, 3, 4, 5, 6].map((i) => `${L('文', 'txt')} ${i}`), max: 1, diag: true });
      const diag = r.P.map((rw, i) => rw[i]), off = r.sim.flatMap((rw, i) => rw.filter((_, j) => j !== i));
      return [[['InfoNCE 损失', 'InfoNCE loss'], fmt(r.loss, 4), 1], [['瞎猜时的损失 log 6', 'Loss at chance, log 6'], fmt(Math.log(6), 4)], [['正确配对的平均概率', 'Mean probability of the correct pair'], pct(diag.reduce((a, b) => a + b, 0) / 6)], [['正例 / 最像的负例的余弦', 'Cosine: positives / closest negative'], `${fmt(r.sim.reduce((a, rw, i) => a + rw[i], 0) / 6)} / ${fmt(Math.max(...off))}`], [['梯度的整体倍数 1/τ', 'Overall gradient scale 1/τ'], fmt(1 / s.tau)]];
    },
  };
});
