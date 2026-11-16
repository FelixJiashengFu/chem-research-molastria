'use strict';
// NequIP（/nequip/）的十个演示。数学都在 nequip-models.js（纯函数，tools/nequip-test.mjs 测）。nequip.js 用 window.MOLASTRIA_NEQUIP_DEMOS(K, DEMOS) 把它们登记进去。
// 每个演示：title，kind，intro，sel 下拉 [键, 名字, [[值, 名字]…], 初值]，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，chk 开关 [键, 名字, 初值]，
// btn 预设 [名字, { 键: 值 }]，act 动作，state，autoplay，fps + tick(s)，changed(s, 键)，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 返回读数 [[名字, 值, 是否加粗]]。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。K 是 nequip.js 给的画图工具。
window.MOLASTRIA_NEQUIP_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_NEQUIP_MODELS;
  const { L, fix, fmt, plot, fit, lin, arrow, font, esc } = K;
  const deg = Math.PI / 180;
  let probeCtx = null;
  const rgbOf = (col) => { probeCtx ||= document.createElement('canvas').getContext('2d'); probeCtx.fillStyle = '#000'; probeCtx.fillStyle = col || '#000'; const v = probeCtx.fillStyle; if (v[0] === '#') return [1, 3, 5].map((i) => parseInt(v.slice(i, i + 2), 16)); const m = v.match(/[\d.]+/g) || [0, 0, 0]; return m.slice(0, 3).map(Number); };
  const mix = (a, b, t) => [0, 1, 2].map((i) => a[i] + (b[i] - a[i]) * t);
  // 正交投影：先转一个固定的观察角度，返回屏幕坐标和深度
  const VIEW = M.matMul(M.Rx(-62 * deg), M.Rz(-28 * deg));
  const project = (p, sc, cx, cy) => { const q = M.matVec(VIEW, p); return [cx + q[0] * sc, cy - q[1] * sc, q[2]]; };
  const atomCol = (z, c) => ({ C: c.ink2, O: c.danger, H: c.muted, Li: c.violet, N: c.info }[z] || c.accent);

  // ── 1. 一根键的势能曲线 ───────────────────────────────────────
  DEMOS.pes = {
    title: L('一根键：固定形式的力场在哪里失效', 'One bond: where a fixed-form force field fails'), kind: 'toy',
    intro: L('实线是“真实”的势能曲线（这里用 Morse 势代替量子化学的结果），虚线是经典力场常用的谐振子（只取平衡点附近的曲率）和多加一个三次项的展开。拉动探针，看键拉长以后两者差多远：谐振子永远不会断键，而机器学习势要做的，就是不预先规定函数形式、直接从量子化学数据学出整条曲线。', 'The solid line is the “true” potential-energy curve (a Morse potential stands in for quantum-chemistry results); the dashed ones are the harmonic oscillator that classical force fields use (only the curvature at the minimum) and the expansion with a cubic term added. Move the probe to see how far apart they drift once the bond is stretched: a harmonic spring never breaks, and the point of a machine-learning potential is to learn the whole curve from quantum-chemistry data without prescribing its functional form.'),
    ctl: [['a', L('Morse 参数 a（越大越“窄”）', 'Morse parameter a (larger = narrower)'), 0.8, 2.5, 0.05, 1.5, (v) => v.toFixed(2)], ['r', L('探针位置 r / rₑ', 'Probe position r / rₑ'), 0.75, 3.5, 0.01, 1.6, (v) => v.toFixed(2)]],
    chk: [['cub', L('画三次项展开', 'Show the cubic expansion'), true]],
    figs: [[0.56, L('势能 V(r)，以 Morse 势的阱深 D 为单位，横轴是 r / rₑ。', 'Potential energy V(r) in units of the Morse well depth D; the horizontal axis is r / rₑ.')], [0.4, L('力 F = −dV/dr（同样的单位）。经典谐振子的力随拉伸线性增长，真实的力在拐点以后衰减到零。', 'Force F = −dV/dr (same units). The harmonic force grows linearly with stretching; the true force fades to zero beyond the inflection point.')]],
    note: L('约化单位：阱深 D = 1，平衡键长 rₑ = 1。Morse 势只是一个方便的“真实曲线”，不是任何一个具体分子的拟合。谐振子的力常数取 k = 2Da²，即 Morse 势在平衡点的二阶导数。真实的经典力场（如 AMBER、CHARMM）还有角度、二面角和非键项，但键项通常就是谐振子，所以不能描述断键和成键。', 'Reduced units: well depth D = 1, equilibrium bond length rₑ = 1. The Morse potential is just a convenient “true curve”, not a fit to any particular molecule. The harmonic force constant is k = 2Da², the second derivative of the Morse potential at the minimum. Real classical force fields (AMBER, CHARMM, …) also have angle, dihedral and non-bonded terms, but the bond term is usually harmonic, so they cannot describe bonds breaking or forming.'),
    draw(s, [cv, fv], c) {
      const D = 1, re = 1, xs = lin(0.7, 3.5, 300);
      const ser = [{ xs, ys: xs.map((r) => M.morse(r, D, s.a, re)), color: c.accent, width: 2.4, label: L('Morse（“真实”）', 'Morse (“true”)') }, { xs, ys: xs.map((r) => M.harmonic(r, D, s.a, re)), color: c.warn, dash: [6, 4], label: L('谐振子', 'Harmonic') }];
      if (s.cub) ser.push({ xs, ys: xs.map((r) => M.cubic(r, D, s.a, re)), color: c.violet, dash: [2, 3], label: L('加三次项', 'With cubic term') });
      const em = M.morse(s.r, D, s.a, re), eh = M.harmonic(s.r, D, s.a, re);
      plot(cv, { x: [0.7, 3.5], y: [-0.4, 2], xl: 'r / rₑ', yl: 'V / D', series: ser, hmarks: [{ y: 1, color: c.muted }], marks: [{ x: s.r, y: em, color: c.gold }], texts: [{ x: 3.45, y: 1.06, s: L('解离能 D', 'dissociation D'), color: c.muted, align: 'right', dy: -2 }] });
      const fm = M.morseF(s.r, D, s.a, re), fh = -2 * D * s.a * s.a * (s.r - re);
      plot(fv, { x: [0.7, 3.5], y: [-3, 3], xl: 'r / rₑ', yl: 'F', series: [{ xs, ys: xs.map((r) => M.morseF(r, D, s.a, re)), color: c.accent, width: 2.4 }, { xs, ys: xs.map((r) => -2 * D * s.a * s.a * (r - re)), color: c.warn, dash: [6, 4] }], hmarks: [{ y: 0, color: c.line, dash: [] }], marks: [{ x: s.r, y: fm, color: c.gold }] });
      return [[L('Morse 势 V(r)', 'Morse V(r)'), fix(em, 3)], [L('谐振子 V(r)', 'Harmonic V(r)'), fix(eh, 3)], [L('谐振子的误差', 'Harmonic error'), `${fix(eh - em, 3)} D`, true], [L('力：Morse / 谐振子', 'Force: Morse / harmonic'), `${fix(fm, 3)} / ${fix(fh, 3)}`], [L('拐点（力最大）在', 'Inflection (largest force) at'), `r / rₑ = ${fix(1 + Math.log(2) / s.a, 3)}`]];
    },
  };

  // ── 2. 等变：转一转分子，看输出跟不跟着转 ─────────────────────
  DEMOS.equiv = {
    title: L('等变的检查：把分子转一下，向量输出跟着转吗', 'Checking equivariance: rotate the molecule — do the vector outputs rotate with it?'), kind: 'exact',
    intro: L('每个原子上画一支箭头，是一个模型给这个原子算出的向量（就像力）。实线箭头是先转分子、再算 f(Rx)；虚线是先算、再把结果转过去 R f(x)。等变的模型两者完全重合；“不等变”的那个模型在同样的和外面多乘了一个固定矩阵，相当于网络对 x、y、z 方向有偏好，转了以后两种箭头就分开了。能量是标量，转多少都不变。', 'Each atom carries an arrow, the vector a model computes for it (think of a force). Solid arrows: rotate the molecule first, then compute f(Rx). Dashed arrows: compute first, then rotate the result, R f(x). For an equivariant model the two coincide exactly; the “non-equivariant” model multiplies the same sum by a fixed matrix, as if the network preferred the x, y and z directions, so after a rotation the two sets of arrows separate. The energy is a scalar and does not change however you rotate.'),
    sel: [['model', L('模型', 'Model'), [['eq', L('等变：v_i = Σ φ(r_ij)(r_j − r_i)', 'Equivariant: v_i = Σ φ(r_ij)(r_j − r_i)')], ['bad', L('不等变：同样的和再乘固定矩阵 A', 'Not equivariant: the same sum times a fixed matrix A')]], 'eq']],
    ctl: [['a', L('绕 z 轴转', 'Rotate about z'), 0, 360, 1, 50, (v) => `${v}°`], ['b', L('绕 y 轴转', 'Rotate about y'), 0, 180, 1, 30, (v) => `${v}°`], ['g', L('再绕 z 轴转', 'Then about z again'), 0, 360, 1, 0, (v) => `${v}°`]],
    btn: [[L('不转（R = 1）', 'No rotation (R = 1)'), { a: 0, b: 0, g: 0 }], [L('转 90°', 'Rotate by 90°'), { a: 90, b: 0, g: 0 }], [L('随便转', 'Any rotation'), { a: 137, b: 71, g: 222 }]],
    figs: [[0.7, L('分子（形状接近甲醇）的正交投影；灰色小字是原子。实线 f(Rx)，虚线 R f(x)。', 'Orthographic projection of the molecule (shaped roughly like methanol). Solid: f(Rx); dashed: R f(x).')]],
    note: L('这里的向量模型只有一条“l = 1 的消息”：邻居的相对位置乘一个只看距离的权重再加起来。NequIP 的每一层都由这种操作组成（再加上更高阶的球谐函数和张量积），所以整个网络是等变的；论文里的力是能量对坐标求导得来的，自动等变。不等变的模型是故意做坏的：真实的“不等变”网络常见于直接把坐标喂进多层感知机，它要靠数据增强（把训练数据随机转很多次）才能近似学会旋转对称。', 'The vector model here is a single “l = 1 message”: the neighbours’ relative positions weighted by a function of distance only, then summed. Every NequIP layer is built from operations of this kind (plus higher spherical harmonics and tensor products), so the whole network is equivariant; in the paper the forces are derivatives of the energy with respect to the coordinates, and so are automatically equivariant. The non-equivariant model is deliberately broken: real non-equivariant networks typically feed raw coordinates into a multilayer perceptron and only learn rotational symmetry approximately through data augmentation (rotating the training data many times at random).'),
    draw(s, [cv], c) {
      const R = M.euler(s.a * deg, s.b * deg, s.g * deg), pos = M.centred(M.MOL.pos), model = s.model === 'eq' ? M.vecModel : M.badModel;
      const rp = pos.map((p) => M.matVec(R, p)), fa = model(rp), fb = model(pos).map((v) => M.matVec(R, v));
      const { ctx, w, h } = fit(cv), sc = Math.min(w, h) / 4.4, cx = w / 2, cy = h / 2;
      const order = rp.map((p, i) => [project(p, sc, cx, cy)[2], i]).sort((x, y) => x[0] - y[0]);
      // 键（距离 < 1.6 Å 的连线）
      ctx.strokeStyle = c.line; ctx.lineWidth = 3;
      for (let i = 0; i < rp.length; i++) for (let j = i + 1; j < rp.length; j++) if (M.norm(M.sub(rp[i], rp[j])) < 1.6) { const a = project(rp[i], sc, cx, cy), b = project(rp[j], sc, cx, cy); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      for (const [, i] of order) {
        const p = project(rp[i], sc, cx, cy), z = M.MOL.z[i];
        ctx.fillStyle = atomCol(z, c); ctx.beginPath(); ctx.arc(p[0], p[1], z === 'H' ? 7 : 11, 0, 2 * Math.PI); ctx.fill();
        ctx.fillStyle = c.paper; ctx.font = font(10, 700); ctx.textAlign = 'center'; ctx.fillText(z, p[0], p[1] + 3.5);
      }
      const k = 0.9;
      rp.forEach((p, i) => {
        const a = project(p, sc, cx, cy), ta = project([p[0] + k * fa[i][0], p[1] + k * fa[i][1], p[2] + k * fa[i][2]], sc, cx, cy), tb = project([p[0] + k * fb[i][0], p[1] + k * fb[i][1], p[2] + k * fb[i][2]], sc, cx, cy);
        ctx.setLineDash([5, 4]); arrow(ctx, a[0], a[1], tb[0], tb[1], c.muted, 1.6); ctx.setLineDash([]);
        arrow(ctx, a[0], a[1], ta[0], ta[1], s.model === 'eq' ? c.gold : c.danger, 2.2);
      });
      const err = M.equivError(model, pos, R), E0 = M.pairEnergy(pos), E1 = M.pairEnergy(rp);
      return [[L('‖f(Rx) − R f(x)‖ / ‖f(x)‖', '‖f(Rx) − R f(x)‖ / ‖f(x)‖'), err < 1e-12 ? `${fmt(err)}（${L('浮点舍入', 'round-off')}）` : fmt(err), true], [L('能量 E(x)', 'Energy E(x)'), fix(E0, 6)], [L('能量 E(Rx)', 'Energy E(Rx)'), fix(E1, 6)], [L('另一个模型的误差', 'The other model’s error'), fmt(M.equivError(s.model === 'eq' ? M.badModel : M.vecModel, pos, R))]];
    },
  };

  // ── 3. 球谐函数和 Wigner D ─────────────────────────────────────
  const SHN = 132;
  let SHI = null;
  DEMOS.sh = {
    title: L('球谐函数：一个阶 l 的特征就是 2l + 1 个系数', 'Spherical harmonics: a feature of order l is 2l + 1 coefficients'), kind: 'exact',
    intro: L('选一个实球谐函数 Y_lm，画在球面上（金色为正，红色为负，越深绝对值越大）。转动它以后，函数还是同一个形状，但在原来的 2l + 1 个基函数上的系数会重新混合：这就是 Wigner D 矩阵在做的事。右边的柱子是转动后的系数，它们的平方和永远是 1，而且 l 不同的系数从来不会混到一起。NequIP 里每个原子的每个特征通道，就是这样一组会跟着旋转混合的系数。', 'Pick a real spherical harmonic Y_lm and draw it on the sphere (gold positive, red negative, darker = larger magnitude). Rotating it keeps the shape, but its coefficients on the original 2l + 1 basis functions mix: that is what the Wigner D matrix does. The bars on the right are the coefficients after the rotation; their squares always add up to 1, and coefficients of different l never mix. Every feature channel of every atom in NequIP is a set of coefficients that mixes like this under rotation.'),
    sel: [['l', L('阶 l', 'Order l'), [['0', 'l = 0（' + L('标量', 'scalar') + '）'], ['1', 'l = 1（' + L('向量', 'vector') + '）'], ['2', 'l = 2'], ['3', 'l = 3']], '2']],
    ctl: [['m', L('分量 m', 'Component m'), -3, 3, 1, 0, (v) => String(v).replace('-', '−')], ['a', L('绕 z 轴转', 'Rotate about z'), 0, 360, 1, 0, (v) => `${v}°`], ['b', L('绕 y 轴转', 'Rotate about y'), 0, 180, 1, 40, (v) => `${v}°`]],
    btn: [[L('不转', 'No rotation'), { a: 0, b: 0 }], [L('l = 1, m = 0（p_z 形）', 'l = 1, m = 0 (p_z-like)'), { l: '1', m: 0 }], [L('l = 2, m = 0（d_z² 形）', 'l = 2, m = 0 (d_z²-like)'), { l: '2', m: 0 }]],
    changed(s) { const l = Number(s.l); s.m = Math.max(-l, Math.min(l, s.m)); },
    figs: [[0.62, L('球面上的 Y_lm(R⁻¹n)，从斜上方看。', 'Y_lm(R⁻¹n) on the sphere, seen obliquely from above.')], [0.42, L('转动后在原来 2l + 1 个基函数上的系数 c′ = D(R) c（转动前只有第 m 个是 1）。', 'Coefficients on the original 2l + 1 basis functions after rotation, c′ = D(R) c (before rotation only the m-th is 1).')]],
    note: L('实球谐函数按正交归一化（∫Y² dΩ = 1，不带 Condon–Shortley 相位），D 矩阵由 D_mm′ = ∫Y_lm(n) Y_lm′(R⁻¹n) dΩ 用 Gauss–Legendre 求积精确算出。e3nn 和 NequIP 用的球谐函数归一化方式和基的顺序可能不同（常差一个常数），但变换规律一样。l = 1 的三个分量正比于 (y, z, x)，所以它的 D 矩阵就是普通的转动矩阵换个顺序。', 'Real spherical harmonics are orthonormal (∫Y² dΩ = 1, no Condon–Shortley phase); D is computed exactly from D_mm′ = ∫Y_lm(n) Y_lm′(R⁻¹n) dΩ with Gauss–Legendre quadrature. e3nn and NequIP may use a different normalisation and ordering (often differing by a constant), but the transformation law is the same. The three l = 1 components are proportional to (y, z, x), so their D matrix is the ordinary rotation matrix with the axes reordered.'),
    draw(s, [cv, bv], c) {
      const l = Number(s.l), m = Math.max(-l, Math.min(l, s.m)), R = M.euler(s.a * deg, s.b * deg, 0), Rt = M.transpose(R), Vt = M.transpose(VIEW);
      const { ctx, w, h } = fit(cv);
      if (!SHI) { const oc = document.createElement('canvas'); oc.width = SHN; oc.height = SHN; SHI = { oc, ox: oc.getContext('2d') }; SHI.img = SHI.ox.createImageData(SHN, SHN); }
      const bg = rgbOf(c.surface), pos = rgbOf(c.gold), neg = rgbOf(c.danger), D = SHI.img.data, vmax = Math.sqrt((2 * l + 1) / (4 * Math.PI)) * (l ? 1.25 : 1);
      for (let j = 0; j < SHN; j++) for (let i = 0; i < SHN; i++) {
        const u = (2 * i) / (SHN - 1) - 1, v = 1 - (2 * j) / (SHN - 1), q = 4 * (j * SHN + i), r2 = u * u + v * v;
        if (r2 > 1) { D[q + 3] = 0; continue; }
        const nv = [u, v, Math.sqrt(1 - r2)], nw = M.matVec(Vt, nv), val = M.realSH(l, m, ...M.matVec(Rt, nw)), t = Math.min(1, Math.abs(val) / vmax) ** 0.8, shade = 0.55 + 0.45 * nv[2];
        const col = mix(bg, val >= 0 ? pos : neg, t).map((x) => x * shade + bg[0] * 0 * (1 - shade));
        D[q] = col[0]; D[q + 1] = col[1]; D[q + 2] = col[2]; D[q + 3] = 255;
      }
      SHI.ox.putImageData(SHI.img, 0, 0);
      const sz = Math.min(w, h) - 16, x0 = (w - sz) / 2, y0 = (h - sz) / 2;
      ctx.imageSmoothingEnabled = true; ctx.drawImage(SHI.oc, x0, y0, sz, sz);
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(w / 2, h / 2, sz / 2, 0, 2 * Math.PI); ctx.stroke();
      // 转过的 z 轴
      const zt = M.matVec(VIEW, M.matVec(R, [0, 0, 1]));
      arrow(ctx, w / 2, h / 2, w / 2 + zt[0] * sz * 0.62, h / 2 - zt[1] * sz * 0.62, c.ink2, 1.6);
      ctx.fillStyle = c.ink2; ctx.font = font(11, 600); ctx.fillText(L('转过的 z', 'rotated z'), w / 2 + zt[0] * sz * 0.64 + 4, h / 2 - zt[1] * sz * 0.64);
      const Dm = M.wignerD(l, R), cvec = Dm.map((row) => row[m + l]), ms = cvec.map((_, i) => i - l);
      plot(bv, { x: [-l - 0.8, l + 0.8], y: [-1.05, 1.05], xl: 'm′', yt: [-1, -0.5, 0, 0.5, 1], xt: ms, xf: (t) => String(t).replace('-', '−'), series: [{ xs: ms, ys: cvec, bars: 0.6, color: c.accent, base: 0 }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const sum = cvec.reduce((x, y) => x + y * y, 0);
      return [[L('系数个数 2l + 1', 'Number of coefficients 2l + 1'), String(2 * l + 1)], [L('转动后 Σ c′²', 'Σ c′² after rotation'), fix(sum, 12), true], [L('宇称 (−1)^l', 'Parity (−1)^l'), l % 2 ? L('奇（o）：反演变号', 'odd (o): flips under inversion') : L('偶（e）：反演不变', 'even (e): unchanged under inversion')], [L('不为零的 c′', 'Non-zero c′'), String(cvec.filter((x) => Math.abs(x) > 1e-9).length)]];
    },
  };

  // ── 4. 张量积 ───────────────────────────────────────────────────
  DEMOS.tp = {
    title: L('张量积：l₁ ⊗ l₂ 能合成哪些阶，以及 1 ⊗ 1 就是点积和叉积', 'Tensor products: which orders l₁ ⊗ l₂ can make, and why 1 ⊗ 1 is the dot and cross product'), kind: 'exact',
    intro: L('上半部分：设定特征的最高阶和滤波器（球谐函数）的最高阶，按论文的两条选择规则，|l_i − l_f| ≤ l_o ≤ l_i + l_f 和 p_o = p_i p_f，列出所有允许的“路径”。下半部分：两个普通向量 x、y（都是 1o）经 Clebsch–Gordan 系数合成 0e、1e、2e 三个输出，你会看到它们正是点积、叉积和一个对称无迹的矩阵。', 'Top: set the highest order of the features and of the filter (spherical harmonics), and every allowed “path” is listed by the paper’s two selection rules, |l_i − l_f| ≤ l_o ≤ l_i + l_f and p_o = p_i p_f. Bottom: two ordinary vectors x and y (both 1o) are combined by Clebsch–Gordan coefficients into outputs 0e, 1e and 2e, which turn out to be the dot product, the cross product and a symmetric traceless matrix.'),
    sel: [['par', L('特征的宇称', 'Feature parities'), [['both', L('偶、奇各一份（论文的设定）', 'Both even and odd (as in the paper)')], ['natural', L('只留 (−1)^l', 'Only (−1)^l')]], 'both']],
    ctl: [['lmax', L('特征最高阶 l_max', 'Feature l_max'), 0, 3, 1, 1, String], ['lf', L('滤波器最高阶', 'Filter l_max'), 0, 3, 1, 1, String], ['t1', L('x 的方向', 'Direction of x'), 0, 360, 1, 20, (v) => `${v}°`], ['t2', L('y 的方向', 'Direction of y'), 0, 360, 1, 80, (v) => `${v}°`], ['e2', L('y 抬起的角度', 'Elevation of y'), -80, 80, 1, 30, (v) => `${v}°`]],
    btn: [[L('NequIP 论文的 l = 1', 'The paper’s l = 1'), { lmax: 1, lf: 1, par: 'both' }], [L('l = 3（MD-17 用的）', 'l = 3 (used for MD-17)'), { lmax: 3, lf: 3, par: 'both' }], [L('只有标量（像 SchNet）', 'Scalars only (SchNet-like)'), { lmax: 0, lf: 0, par: 'natural' }], [L('x ∥ y', 'x ∥ y'), { t1: 40, t2: 40, e2: 0 }]],
    figs: [['html', ''], [0.5, L('x（蓝）、y（紫）和 1 ⊗ 1 → 1e 给出的向量（金），从斜上方看。金色的箭头总是垂直于 x 和 y。', 'x (blue), y (purple) and the vector from 1 ⊗ 1 → 1e (gold), seen obliquely. The gold arrow is always perpendicular to x and y.')]],
    note: L('CG 系数由 Racah 公式算复数基下的值，再换到实球谐的基，整体归一成 Σ C² = 2L + 1；输出和点积、叉积之间的比例（如 −1/√3、1/√2）取决于归一化约定，e3nn 的常数可能不同。路径只按选择规则数，真实的 NequIP 实现里第一层的输入只有标量（原子种类的嵌入），而且每条路径的权重来自径向网络。', 'CG coefficients are computed with the Racah formula in the complex basis, transformed to real spherical harmonics and normalised to Σ C² = 2L + 1; the ratios between the outputs and the dot or cross products (−1/√3, 1/√2) depend on the normalisation convention, and e3nn’s constants may differ. Paths are counted by the selection rules only; in the real NequIP implementation the first layer’s input is scalars only (the embedding of the species), and the weight of each path comes from the radial network.'),
    draw(s, [hv, cv], c) {
      const ins = M.featureIrreps(s.lmax, s.par), paths = M.tpPaths(ins, s.lf, s.lmax, s.par === 'both');
      const byOut = {};
      for (const p of paths) (byOut[M.irrepName(p.lo, p.po)] ||= []).push(`${M.irrepName(p.li, p.pi)} ⊗ ${M.irrepName(p.lf, p.pf)}`);
      const outs = Object.keys(byOut).sort((a, b) => parseInt(a, 10) - parseInt(b, 10) || (a.endsWith('e') ? -1 : 1));
      hv.innerHTML = `<table class="nq-peaks"><thead><tr><th>${esc(L('输出', 'Output'))}</th><th>${esc(L('来自哪些路径', 'From which paths'))}</th><th>${esc(L('条数', 'Count'))}</th></tr></thead><tbody>${outs.map((o) => `<tr><td>${o}</td><td>${byOut[o].join(L('，', ', '))}</td><td>${byOut[o].length}</td></tr>`).join('')}</tbody></table>`;
      const x = [Math.cos(s.t1 * deg), Math.sin(s.t1 * deg), 0], y = [Math.cos(s.t2 * deg) * Math.cos(s.e2 * deg), Math.sin(s.t2 * deg) * Math.cos(s.e2 * deg), Math.sin(s.e2 * deg)];
      const o0 = M.tensorProduct(1, M.toL1(x), 1, M.toL1(y), 0)[0], o1 = M.fromL1(M.tensorProduct(1, M.toL1(x), 1, M.toL1(y), 1)), o2 = M.tensorProduct(1, M.toL1(x), 1, M.toL1(y), 2);
      const { ctx, w, h } = fit(cv), sc = Math.min(w, h) / 2.8, cx = w / 2, cy = h / 2 + 10;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1;
      for (const ax of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) { const a = project(ax.map((v) => -v * 1.1), sc, cx, cy), b = project(ax.map((v) => v * 1.1), sc, cx, cy); ctx.beginPath(); ctx.moveTo(a[0], a[1]); ctx.lineTo(b[0], b[1]); ctx.stroke(); }
      const o = project([0, 0, 0], sc, cx, cy), draw3 = (v, col, k = 1) => { const p = project(v.map((q) => q * k), sc, cx, cy); arrow(ctx, o[0], o[1], p[0], p[1], col, 2.4); };
      draw3(x, c.info); draw3(y, c.violet); draw3(o1, c.gold, Math.SQRT2);
      const cr = M.cross(x, y), dt = M.dot(x, y);
      return [[L('路径总数', 'Total paths'), String(paths.length), true], [L('输出的不可约表示', 'Output irreps'), outs.join(' + ') || '—'], ['1o ⊗ 1o → 0e', Math.abs(dt) > 1e-6 ? `${fix(o0, 4)} = ${fix(o0 / dt, 4)} × (x·y)` : `${fix(Math.abs(o0) < 5e-5 ? 0 : o0, 4)}${L('（x ⊥ y，点积为零）', ' (x ⊥ y, zero dot product)')}`], ['1o ⊗ 1o → 1e', Math.hypot(...cr) > 1e-9 ? `${fix(Math.hypot(...o1) / Math.hypot(...cr), 4)} × |x × y|` : L('0（x ∥ y 时叉积为零）', '0 (the cross product vanishes for x ∥ y)')], ['1o ⊗ 1o → 2e', `|·| = ${fix(Math.hypot(...o2), 4)}`]];
    },
  };

  // ── 5. 径向基和包络 ─────────────────────────────────────────────
  DEMOS.radial = {
    title: L('径向基：Bessel 函数乘一个让它在截断处平滑归零的包络', 'The radial basis: Bessel functions times an envelope that brings them smoothly to zero at the cutoff'), kind: 'exact',
    intro: L('NequIP 把两个原子的距离 r 先展开成 N_b 个 Bessel 函数 B_n(r)，再送进一个小的多层感知机得到滤波器的径向部分。每个 B_n 在 r_c 处本身是零，但它的斜率不是零：原子从截断球外进来时力会突然跳一下。乘上包络 u(r/r_c) 以后，函数值、一阶和二阶导数在 r_c 处都是零。关掉包络比较一下。', 'NequIP first expands the distance r between two atoms in N_b Bessel functions B_n(r), then feeds them to a small multilayer perceptron to get the radial part of the filter. Each B_n is itself zero at r_c, but its slope is not: an atom entering the cutoff sphere would make the force jump. Multiplied by the envelope u(r/r_c), the value and the first and second derivatives all vanish at r_c. Switch the envelope off to compare.'),
    ctl: [['rc', L('截断半径 r_c', 'Cutoff r_c'), 3, 7, 0.1, 4, (v) => `${v.toFixed(1)} Å`], ['nb', L('画出前几个 B_n', 'Show the first n of B_n'), 1, 8, 1, 4, String], ['p', L('包络的 p', 'Envelope p'), 2, 10, 1, 6, String]],
    chk: [['env', L('乘包络 u(r/r_c)', 'Multiply by the envelope u(r/r_c)'), true]],
    btn: [[L('论文：r_c = 4 Å，p = 6', 'Paper: r_c = 4 Å, p = 6'), { rc: 4, p: 6, env: true }], [L('周期体系：r_c = 5 Å', 'Periodic systems: r_c = 5 Å'), { rc: 5, p: 6 }]],
    figs: [[0.55, L('B_n(r)·u(r/r_c)，n = 1 … N（论文里 N_b = 8）。竖线是 r_c。', 'B_n(r)·u(r/r_c), n = 1 … N (the paper uses N_b = 8). The vertical line is r_c.')], [0.4, L('包络 u(x) 和它的一阶、二阶导数（除以 10），x = r / r_c。', 'The envelope u(x) and its first and second derivatives (divided by 10), x = r / r_c.')]],
    note: L('公式照论文式 (6)：B_n(r) = (2/r_c)·sin(nπr/r_c)/r，训练时 nπ 也会被优化，这里固定在初值。包络是 DimeNet 提出的多项式，论文用 p = 6。论文表 VII 的截断半径：分子 4.0 Å，水和冰 6.0 Å，甲酸在铜上、Li₄P₂O₇ 和 LiPS 5.0 Å，Cheng 等人的水 4.5 Å。', 'The formula follows equation (6) of the paper: B_n(r) = (2/r_c)·sin(nπr/r_c)/r; nπ is also optimised during training, fixed here at its initial value. The envelope is the polynomial introduced in DimeNet, with p = 6 in the paper. Cutoffs from the paper’s Table VII: 4.0 Å for molecules, 6.0 Å for water and ice, 5.0 Å for formate on copper, Li₄P₂O₇ and LiPS, 4.5 Å for the water data of Cheng et al.'),
    draw(s, [cv, ev], c) {
      const xs = lin(0.05, 7.5, 400), cols = [c.accent, c.gold, c.violet, c.info, c.warn, c.ok, c.danger, c.ink2];
      const f = (n, r) => (r >= s.rc ? 0 : M.bessel(n, r, s.rc) * (s.env ? M.envelope(r / s.rc, s.p) : 1));
      const ser = Array.from({ length: s.nb }, (_, k) => ({ xs, ys: xs.map((r) => f(k + 1, r)), color: cols[k % cols.length], width: 1.8, label: k < 4 ? `n = ${k + 1}` : '' }));
      const ymax = Math.max(0.3, ...ser.flatMap((q) => q.ys.map(Math.abs))) * 1.05;
      plot(cv, { x: [0, 7.5], y: [-ymax, ymax], xl: L('距离 r（Å）', 'distance r (Å)'), series: ser, marks: [{ x: s.rc, color: c.danger }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const us = lin(0, 1, 200);
      plot(ev, { x: [0, 1.05], y: [-1.6, 1.1], xl: 'x = r / r_c', series: [{ xs: us, ys: us.map((x) => M.envelope(x, s.p)), color: c.accent, width: 2.2, label: 'u' }, { xs: us, ys: us.map((x) => M.envelopeD(x, s.p) / 10), color: c.gold, dash: [6, 4], label: 'u′ / 10' }, { xs: us, ys: us.map((x) => M.envelopeD2(x, s.p) / 10), color: c.violet, dash: [2, 3], label: 'u″ / 10' }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const h = 1e-5, slope = (f(1, s.rc - h) - f(1, s.rc - 2 * h)) / h;
      return [[L('B₁ 在 r_c 处的斜率', 'Slope of B₁ at r_c'), fmt(slope), true], [L('u(1), u′(1), u″(1)', 'u(1), u′(1), u″(1)'), [M.envelope(1 - 1e-12, s.p), M.envelopeD(1 - 1e-12, s.p), M.envelopeD2(1 - 1e-12, s.p)].map((v) => fix(Math.abs(v) < 1e-6 ? 0 : v, 3)).join(', ')], [L('B₁ 的第一个零点', 'First zero of B₁'), `r = r_c = ${fix(s.rc, 1)} Å`]];
    },
  };

  // ── 6. 近邻图和感受野 ───────────────────────────────────────────
  const PTS = { pts: null };
  const pts = () => (PTS.pts ||= M.scatter(32, 18, 2.4, 7));
  DEMOS.graph = {
    title: L('近邻图：截断半径、层数和感受野', 'The neighbour graph: cutoff, layers and receptive field'), kind: 'exact',
    intro: L('一张二维的“液体快照”（原子之间不近于 2.4 Å）。每个原子只和 r_c 以内的原子连边。消息传递每一层把信息沿边传一步，所以 T 层以后，中心原子的能量依赖到 T 步以内的所有原子，最远可到 T × r_c。Allegro 是“严格局域”的：不管多少层，感受野都只有 r_c 那一圈，这让它可以把大体系切开放到很多块 GPU 上算。点图上任意一个原子当中心。', 'A two-dimensional “liquid snapshot” (atoms no closer than 2.4 Å). Each atom is linked only to atoms within r_c. Each message-passing layer moves information one step along the edges, so after T layers the central atom’s energy depends on every atom within T steps, as far as T × r_c away. Allegro is “strictly local”: however many layers, its receptive field is just the r_c sphere, which lets a large system be cut up and spread over many GPUs. Click any atom to make it the centre.'),
    ctl: [['rc', L('截断半径 r_c', 'Cutoff r_c'), 2.5, 6, 0.1, 4, (v) => `${v.toFixed(1)} Å`], ['T', L('层数 T', 'Layers T'), 1, 6, 1, 3, String]],
    chk: [['allegro', L('严格局域（Allegro 的做法）', 'Strictly local (as in Allegro)'), false]],
    state: () => ({ c: -1 }),
    figs: [[0.58, L('颜色是离中心几步：金色是中心，越深越近，灰色是感受野以外。圆是 r_c。点任意原子换中心。', 'Colour shows how many steps from the centre: gold is the centre, darker is closer, grey is outside the receptive field. The circle is r_c. Click any atom to change the centre.')]],
    note: L('二维的点只是为了画得清楚，读数里的“三维估计”按真实的数密度算：液态水约 0.100 个原子 / Å³（1.0 g/cm³），半径 r 的球里平均有 (4/3)πr³ρ 个原子。论文对分子用 5 个相互作用块、对周期体系用 6 个，NequIP 官方教程配置写 4 层并说 3–5 层最好。消息传递的感受野“按图走”，并不等于整个 T·r_c 球都参与。', 'The points are two-dimensional only for clarity; the “3D estimate” in the readout uses a real number density: liquid water has about 0.100 atoms / Å³ (1.0 g/cm³), and a sphere of radius r holds on average (4/3)πr³ρ atoms. The paper uses 5 interaction blocks for molecules and 6 for periodic systems; the official NequIP tutorial config uses 4 layers and says 3–5 work best. The message-passing receptive field follows the graph, so not every atom of the T·r_c sphere necessarily takes part.'),
    draw(s, [cv], c) {
      const P = pts(), nb = M.neighbours(P, s.rc);
      if (s.c < 0) { let best = 0, bd = 1e9; P.forEach((p, i) => { const d = Math.hypot(p[0] - 16, p[1] - 9); if (d < bd) { bd = d; best = i; } }); s.c = best; }
      const hop = M.hops(nb, s.c, s.allegro ? 1 : s.T), { ctx, w, h } = fit(cv), sc = Math.min(w / 32, h / 18), ox = (w - 32 * sc) / 2, oy = (h - 18 * sc) / 2;
      const X = (p) => ox + p[0] * sc, Y = (p) => oy + p[1] * sc;
      cv.onpointerdown = (e) => { const r = cv.getBoundingClientRect(), px = ((e.clientX - r.left) / r.width) * w, py = ((e.clientY - r.top) / r.height) * h; let best = s.c, bd = 1e9; P.forEach((p, i) => { const d = Math.hypot(X(p) - px, Y(p) - py); if (d < bd) { bd = d; best = i; } }); s.c = best; s.redraw(); };
      cv.classList.add('nq-point');
      ctx.strokeStyle = c.line; ctx.lineWidth = 1;
      for (let i = 0; i < P.length; i++) for (const j of nb[i]) if (j > i && hop.has(i) && hop.has(j)) { ctx.beginPath(); ctx.moveTo(X(P[i]), Y(P[i])); ctx.lineTo(X(P[j]), Y(P[j])); ctx.stroke(); }
      const T = s.allegro ? 1 : s.T, acc = rgbOf(c.accent), bg = rgbOf(c.surface);
      P.forEach((p, i) => { const k = hop.get(i); ctx.fillStyle = k === undefined ? c.faint || c.line : k === 0 ? c.gold : `rgb(${mix(acc, bg, (k - 1) / (T + 0.5)).map(Math.round).join(',')})`; ctx.beginPath(); ctx.arc(X(p), Y(p), k === 0 ? 6 : 4.2, 0, 2 * Math.PI); ctx.fill(); });
      ctx.strokeStyle = c.gold; ctx.setLineDash([5, 4]); ctx.beginPath(); ctx.arc(X(P[s.c]), Y(P[s.c]), s.rc * sc, 0, 2 * Math.PI); ctx.stroke(); ctx.setLineDash([]);
      let far = 0; for (const j of hop.keys()) far = Math.max(far, Math.hypot(P[j][0] - P[s.c][0], P[j][1] - P[s.c][1]));
      const rho = M.DENSITY.water;
      return [[L('中心的近邻数', 'Neighbours of the centre'), String(nb[s.c].length)], [L('感受野里的原子', 'Atoms in the receptive field'), String(hop.size - 1), true], [L('最远的一个', 'Farthest one'), `${fix(far, 1)} Å（T·r_c = ${fix(T * s.rc, 1)} Å）`], [L('三维估计（液态水）：r_c 内', '3D estimate (liquid water): within r_c'), `≈ ${Math.round(M.sphereN(rho, s.rc) - 1)}`], [L('三维估计：T·r_c 内', '3D estimate: within T·r_c'), `≈ ${fmt(M.sphereN(rho, T * s.rc) - 1)}`]];
    },
  };

  // ── 7. 保守的力和不保守的力 ─────────────────────────────────────
  const fresh = () => ({ a: M.cluster(0.05, 3), b: M.cluster(0.05, 3), E0: 0, hist: [] });
  DEMOS.nve = {
    title: L('能量守恒：力是能量的梯度，和“直接预测力”有什么不同', 'Energy conservation: forces as the gradient of an energy versus “predicting forces directly”'), kind: 'toy',
    intro: L('两份一模一样的 7 原子 Lennard-Jones 团簇，用同样的速度 Verlet 积分。蓝色用保守的力 F = −∇E（NequIP 的做法）；红色在力上加了一点“旋度”：成对的、垂直于连线的小力，它不是任何能量的梯度。只要有这一点点，绕一圈做的功就不为零，总能量会一直漂，团簇越转越快、越来越热。', 'Two identical seven-atom Lennard-Jones clusters integrated with the same velocity Verlet scheme. Blue uses conservative forces F = −∇E (NequIP’s approach); red adds a little “curl” to the forces: pairwise forces perpendicular to the bond, which are not the gradient of any energy. With even this much, the work around a closed loop is not zero, the total energy keeps drifting, and the cluster spins and heats up.'),
    ctl: [['eps', L('不保守的部分 ε', 'Non-conservative part ε'), 0, 0.5, 0.01, 0.15, (v) => v.toFixed(2)], ['dt', L('时间步 Δt', 'Time step Δt'), 0.002, 0.012, 0.001, 0.005, (v) => v.toFixed(3)]],
    act: [[L('重新开始', 'Restart'), (s) => Object.assign(s, fresh())]],
    btn: [[L('ε = 0：两边一样', 'ε = 0: both the same'), { eps: 0 }], [L('ε = 0.3', 'ε = 0.3'), { eps: 0.3 }]],
    state: fresh, autoplay: true, fps: 20,
    changed(s, k) { if (k === 'eps' || k === 'dt') Object.assign(s, fresh()); },
    tick(s) {
      if (!s.hist.length) s.E0 = M.ljEnergy(s.a.x) + M.kinetic(s.a.v);
      M.verlet(s.a, s.dt, 20, 0); M.verlet(s.b, s.dt, 20, s.eps);
      s.hist.push([s.a.t, M.ljEnergy(s.a.x) + M.kinetic(s.a.v) - s.E0, M.ljEnergy(s.b.x) + M.kinetic(s.b.v) - s.E0]);
      if (s.hist.length > 400) s.hist.shift();
      const big = s.b.x.some((v) => Math.abs(v) > 30) || !Number.isFinite(s.b.x[0]);
      return !big;
    },
    figs: [[0.5, L('左：保守的力；右：带一点旋度的力。', 'Left: conservative forces; right: forces with a little curl.')], [0.42, L('总能量的变化 E(t) − E(0)（约化单位）。', 'Change of total energy E(t) − E(0) (reduced units).')]],
    note: L('约化单位 ε = σ = m = 1，势在 2.5σ 处截断并平移。不保守的那一项 ε(1 − r/2.5)² 乘上垂直于连线的单位向量，每一对大小相等、方向相反，所以总动量守恒，但角动量和能量都不守恒。真实的直接预测力的模型误差没有这么规整；Fu 等人 2023 和 Bigi 等人 2024 的基准测试研究过这种误差对长时间分子动力学的影响。', 'Reduced units ε = σ = m = 1; the potential is truncated and shifted at 2.5σ. The non-conservative term ε(1 − r/2.5)² times the unit vector perpendicular to the bond is equal and opposite for each pair, so total momentum is conserved but angular momentum and energy are not. Real direct-force models have less tidy errors; the benchmarks of Fu et al. 2023 and Bigi et al. 2024 study the effect of such errors on long molecular dynamics.'),
    draw(s, [cv, ev], c) {
      const { ctx, w, h } = fit(cv), sc = Math.min(w / 2, h) / 6;
      for (const [st, x0, col] of [[s.a, w / 4, c.info], [s.b, (3 * w) / 4, c.danger]]) {
        ctx.fillStyle = col;
        for (let i = 0; i < st.x.length / 2; i++) { const X = x0 + st.x[2 * i] * sc, Y = h / 2 - st.x[2 * i + 1] * sc; if (X < -20 || X > w + 20) continue; ctx.beginPath(); ctx.arc(X, Y, 0.5 * sc, 0, 2 * Math.PI); ctx.fill(); }
      }
      ctx.strokeStyle = c.line; ctx.beginPath(); ctx.moveTo(w / 2, 8); ctx.lineTo(w / 2, h - 8); ctx.stroke();
      const H = s.hist, t = H.map((q) => q[0]), ya = H.map((q) => q[1]), yb = H.map((q) => q[2]), lim = Math.max(0.02, ...yb.map(Math.abs), ...ya.map(Math.abs)) * 1.1;
      plot(ev, { x: [t[0] ?? 0, Math.max((t[0] ?? 0) + 1, t[t.length - 1] ?? 1)], y: [-lim, lim], xl: L('时间（约化单位）', 'time (reduced units)'), series: [{ xs: t, ys: ya, color: c.info, width: 2, label: L('保守', 'conservative') }, { xs: t, ys: yb, color: c.danger, width: 2, label: L('有旋度', 'with curl') }], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      const x0 = M.cluster(0.05, 3).x;
      return [[L('保守：ΔE', 'Conservative: ΔE'), fmt(ya[ya.length - 1] ?? 0)], [L('有旋度：ΔE', 'With curl: ΔE'), fmt(yb[yb.length - 1] ?? 0), true], [L('绕 0.05σ 小方框一圈的功（保守 / 有旋度）', 'Work round a 0.05σ square loop (conservative / curl)'), `${fmt(M.loopWork(x0, 1, 0.05, 0))} / ${fmt(M.loopWork(x0, 1, 0.05, s.eps))}`]];
    },
  };

  // ── 8. 论文里的数字 ─────────────────────────────────────────────
  const MOLS = Object.keys(M.PAPER.rmd17);
  DEMOS.curve = {
    title: L('论文里的数字：l 的作用、训练集大小和 1000 倍的数据差', 'The paper’s numbers: the effect of l, training-set size and a 1000-fold data gap'), kind: 'data',
    intro: L('三组数都原样取自 Batzner 等人论文的表格。“LiPS 学习曲线”把四个训练集大小的误差画在对数坐标上，并当场拟合幂律 ε ∝ N^b；“revised MD-17”是同样 1000 个构型时 l = 0 到 3 的力误差（和其他方法对比）；“水和冰”是 NequIP 用 133 个结构对 DeepMD 用 133 500 个结构。', 'All three sets of numbers come straight from the tables of Batzner et al. “LiPS learning curve” plots the errors at four training-set sizes on log axes and fits a power law ε ∝ N^b on the spot; “revised MD-17” shows force errors for l = 0 to 3 at the same 1000 configurations (with other methods for comparison); “water and ice” compares NequIP trained on 133 structures with DeepMD trained on 133 500.'),
    sel: [['view', L('看哪一组', 'Which set'), [['lips', L('LiPS 学习曲线（表 VI）', 'LiPS learning curve (Table VI)')], ['rmd17', L('revised MD-17（表 II）', 'revised MD-17 (Table II)')], ['water', L('水和冰（表 IV）', 'Water and ice (Table IV)')]], 'lips'], ['mol', L('分子（MD-17）', 'Molecule (MD-17)'), MOLS.map((m) => [m, m]), 'Aspirin']],
    figs: [[0.56, L('点击上面的下拉切换。', 'Use the menus above to switch.')]],
    note: L('数字来自论文 arXiv 第 3 版（2021 年 12 月）。表 VI 的单位：能量 meV/atom、力 meV/Å；表 II：能量 meV、力 meV/Å（平均绝对误差）；表 IV 是力的均方根误差，NequIP 那一列是只用力训练的模型 a（λ_E = 0）。幂律只用四个点拟合，斜率只是这一组数据的描述，不是一般规律。不同方法的误差还和训练细节、数据划分有关，论文和后来的工作都提醒过：只看测试集误差不足以判断分子动力学是否稳定。', 'Numbers are from arXiv version 3 of the paper (December 2021). Units in Table VI: energy meV/atom, force meV/Å; Table II: energy meV, force meV/Å (mean absolute errors); Table IV gives force root-mean-square errors, and the NequIP column is model a, trained on forces only (λ_E = 0). The power law is fitted to just four points, so the slope describes this data set, not a general law. Errors of different methods also depend on training details and data splits; the paper and later work both warn that test-set errors alone do not tell you whether molecular dynamics will be stable.'),
    draw(s, [cv], c) {
      const P = M.PAPER;
      if (s.view === 'lips') {
        const fitF = M.powerFit(P.lips.N, P.lips.Fmae), fitE = M.powerFit(P.lips.N, P.lips.Emae), xs = lin(Math.log10(7), Math.log10(4000), 50).map((v) => 10 ** v);
        plot(cv, { x: [Math.log10(6), Math.log10(5000)], y: [Math.log10(0.05), Math.log10(300)], logx: true, logy: true, xl: L('训练集大小 N（个结构）', 'training-set size N (structures)'), series: [{ xs: P.lips.N, ys: P.lips.Fmae, dots: 5, color: c.accent, label: L('力 MAE（meV/Å）', 'force MAE (meV/Å)') }, { xs, ys: xs.map((n) => fitF.a * n ** fitF.b), color: c.accent, dash: [5, 4] }, { xs: P.lips.N, ys: P.lips.Emae, dots: 5, color: c.gold, label: L('能量 MAE（meV/atom）', 'energy MAE (meV/atom)') }, { xs, ys: xs.map((n) => fitE.a * n ** fitE.b), color: c.gold, dash: [5, 4] }] });
        return [[L('力误差的斜率 b', 'Slope b of the force error'), fix(fitF.b, 3), true], [L('能量误差的斜率 b', 'Slope b of the energy error'), fix(fitE.b, 3)], [L('N = 2500 时力 MAE', 'Force MAE at N = 2500'), '4.9 meV/Å'], [L('Li 扩散系数：NequIP / AIMD', 'Li diffusivity: NequIP / AIMD'), `1.25 / 1.37 × 10⁻⁵ cm²/s（${L('差', 'off by')} ${fix((100 * (P.lipsDiffusion.aimd - P.lipsDiffusion.nequip)) / P.lipsDiffusion.aimd, 0)} %）`]];
      }
      if (s.view === 'rmd17') {
        const d = P.rmd17[s.mol] || P.rmd17.Aspirin, k = MOLS.indexOf(s.mol), others = Object.entries(P.rmd17Others);
        const cols = [c.muted, c.info, c.violet, c.accent], top = Math.max(...d.F, ...others.map(([, v]) => v[k])) * 1.15;
        plot(cv, { x: [-0.7, 7.7], y: [0, top], yl: L('力 MAE（meV/Å）', 'force MAE (meV/Å)'), xt: [0, 1, 2, 3, 4.5, 5.5, 6.5, 7.5].slice(0, 4 + others.length), xf: (t) => ({ 0: 'l=0', 1: 'l=1', 2: 'l=2', 3: 'l=3', 4.5: others[0][0], 5.5: others[1][0], 6.5: others[2][0], 7.5: others[3][0] }[t] || ''), series: [...d.F.map((v, i) => ({ xs: [i], ys: [v], bars: 0.7, color: cols[i], base: 0 })), { xs: others.map((_, i) => 4.5 + i), ys: others.map(([, v]) => v[k]), bars: 0.6, color: c.line, base: 0 }], texts: d.F.map((v, i) => ({ x: i, y: v, s: String(v), align: 'center', dy: -4 })) });
        return [[L('l = 0 → 1 力误差缩小到', 'Force error l = 0 → 1 shrinks to'), `${fix((100 * d.F[1]) / d.F[0], 0)} %`, true], [L('l = 1 → 3 再缩小到', 'Then l = 1 → 3 shrinks to'), `${fix((100 * d.F[3]) / d.F[1], 0)} %`], [L('能量 MAE（l = 3）', 'Energy MAE (l = 3)'), `${d.E[3]} meV`]];
      }
      const W = P.water, xs = W.parts.map((_, i) => i);
      plot(cv, { x: [-0.6, 3.6], y: [0, 50], yl: L('力 RMSE（meV/Å）', 'force RMSE (meV/Å)'), xt: xs, xf: (t) => W.parts[t] || '', series: [{ xs: xs.map((x) => x - 0.18), ys: W.nequip, bars: 0.34, color: c.accent, base: 0, label: L('NequIP，133 个结构', 'NequIP, 133 structures') }, { xs: xs.map((x) => x + 0.18), ys: W.deepmd, bars: 0.34, color: c.muted, base: 0, label: L('DeepMD，133 500 个结构', 'DeepMD, 133 500 structures') }] });
      return [[L('训练数据之比', 'Ratio of training data'), `${W.nDeepmd / W.nNequip | 0} : 1`, true], [L('液态水的力 RMSE', 'Liquid-water force RMSE'), `12.5 vs 40.4 meV/Å`], [L('注意', 'Note'), L('能量误差 DeepMD 更低（只用力训练的模型 a 不报能量）', 'DeepMD has lower energy errors (model a, trained on forces only, reports none)')]];
    },
  };

  // ── 9. 一维高斯过程：力的标签有多值钱 ──────────────────────────
  DEMOS.gpfit = {
    title: L('力的标签有多值钱：只用能量拟合，还是能量加力一起拟合', 'What force labels are worth: fitting energies only, or energies and forces together'), kind: 'toy',
    intro: L('用高斯过程拟合一维的 Morse 曲线。每个训练点只给能量时，一个结构只有 1 个标签；把力也给它，就多了一个导数的标签。三维里一个 N 原子的结构有 1 个能量和 3N 个力分量，论文因此说 M 个结构一共提供 M(3N + 1) 个标签，这是机器学习势用很少的结构就能训练的一个原因。', 'A Gaussian process fits a one-dimensional Morse curve. Given energies only, each training point is a single label; give it the force too and there is one more, a derivative label. In three dimensions a structure of N atoms has 1 energy and 3N force components, which is why the paper says M structures provide M(3N + 1) labels altogether, one reason machine-learning potentials can be trained on few structures.'),
    ctl: [['n', L('训练点数', 'Training points'), 2, 10, 1, 4, String], ['ell', L('核的长度尺度 ℓ', 'Kernel length scale ℓ'), 0.15, 0.8, 0.01, 0.35, (v) => v.toFixed(2)]],
    chk: [['forces', L('训练时也用力', 'Use forces in training too'), true]],
    btn: [[L('3 个点', '3 points'), { n: 3 }], [L('6 个点', '6 points'), { n: 6 }]],
    figs: [[0.52, L('能量：灰色是真实的 Morse 曲线，彩色是拟合，点是训练数据。', 'Energy: grey is the true Morse curve, colour is the fit, dots are training data.')], [0.36, L('力：同一个拟合求导得到的力。', 'Force: the force obtained by differentiating the same fit.')]],
    note: L('这不是 NequIP：只是一个带导数观测的高斯过程（RBF 核，固定超参数），用来单独看“力的标签”这一件事。NequIP 训练时的损失函数是能量误差的平方乘 λ_E 加力误差的平方乘 λ_F，论文的默认比例是 1 : N²（N 是原子数）。训练点等间距地放在 r / rₑ = 0.75 到 2.8 之间。', 'This is not NequIP: just a Gaussian process with derivative observations (RBF kernel, fixed hyperparameters) to look at “force labels” in isolation. NequIP’s training loss is λ_E times the squared energy error plus λ_F times the squared force error, with a default ratio of 1 : N² (N the number of atoms) in the paper. Training points are spaced evenly between r / rₑ = 0.75 and 2.8.'),
    draw(s, [cv, fv], c) {
      const V = (r) => M.morse(r, 1, 1.5, 1), F = (r) => M.morseF(r, 1, 1.5, 1), tr = lin(0.75, 2.8, s.n).map((x) => ({ x, E: V(x), F: F(x) })), xs = lin(0.72, 3, 220);
      const pred = (f) => M.gpFit(tr, xs, { ell: s.ell, forces: f }), p1 = pred(s.forces), rm = (p, k, g) => Math.sqrt(p.reduce((a, q) => a + (q[k] - g(q.x)) ** 2, 0) / p.length);
      const pE = pred(false), pEF = pred(true), col = s.forces ? c.accent : c.warn;
      plot(cv, { x: [0.72, 3], y: [-0.3, 2.2], xl: 'r / rₑ', yl: 'V / D', series: [{ xs, ys: xs.map(V), color: c.muted, width: 3, alpha: 0.6 }, { xs, ys: p1.map((q) => q.E), color: col, width: 2 }, { xs: tr.map((q) => q.x), ys: tr.map((q) => q.E), dots: 4.5, color: c.gold }] });
      plot(fv, { x: [0.72, 3], y: [-2, 3], xl: 'r / rₑ', yl: 'F', series: [{ xs, ys: xs.map(F), color: c.muted, width: 3, alpha: 0.6 }, { xs, ys: p1.map((q) => q.F), color: col, width: 2 }, ...(s.forces ? [{ xs: tr.map((q) => q.x), ys: tr.map((q) => q.F), dots: 4.5, color: c.gold }] : [])], hmarks: [{ y: 0, color: c.line, dash: [] }] });
      return [[L('标签数', 'Labels'), String(s.forces ? 2 * s.n : s.n)], [L('能量 RMSE：只用能量 / 加上力', 'Energy RMSE: energies only / with forces'), `${fix(rm(pE, 'E', V), 4)} / ${fix(rm(pEF, 'E', V), 4)}`, true], [L('力 RMSE：只用能量 / 加上力', 'Force RMSE: energies only / with forces'), `${fix(rm(pE, 'F', F), 3)} / ${fix(rm(pEF, 'F', F), 3)}`]];
    },
  };

  // ── 10. 代价估计 ────────────────────────────────────────────────
  DEMOS.cost = {
    title: L('开工前算一算：近邻数、边数、路径数和损失权重', 'Before you start: neighbours, edges, paths and loss weights'), kind: 'exact',
    intro: L('选体系和设置，这里按公式算出训练和模拟时最常关心的几个数：每个原子的近邻数（随 r_c³ 增长，代价也是），整个结构的边数（随原子数线性增长），消息传递的感受野有多大，每层张量积有多少条路径，以及一个结构提供多少个标签、论文默认的力权重是多少。', 'Choose a system and settings, and the numbers that matter most for training and simulation are computed from formulas: neighbours per atom (growing as r_c³, and so does the cost), edges in the whole structure (linear in the number of atoms), the size of the message-passing receptive field, the number of tensor-product paths per layer, and how many labels one structure provides and the paper’s default force weight.'),
    sel: [['sys', L('体系', 'System'), [['water', L('液态水（0.100 原子/Å³）', 'Liquid water (0.100 atoms/Å³)')], ['si', L('晶体硅（0.050 原子/Å³）', 'Crystalline silicon (0.050 atoms/Å³)')], ['cu', L('铜（0.085 原子/Å³）', 'Copper (0.085 atoms/Å³)')]], 'water'], ['par', L('特征的宇称', 'Feature parities'), [['both', L('偶、奇各一份', 'Both even and odd')], ['natural', L('只留 (−1)^l', 'Only (−1)^l')]], 'both']],
    ctl: [['rc', L('截断半径 r_c', 'Cutoff r_c'), 3, 7, 0.1, 5, (v) => `${v.toFixed(1)} Å`], ['T', L('层数', 'Layers'), 1, 6, 1, 4, String], ['lmax', 'l_max', 0, 3, 1, 1, String], ['lgN', L('每个结构的原子数', 'Atoms per structure'), 1, 6, 0.1, 2.3, (v) => String(Math.round(10 ** v))]],
    btn: [[L('官方教程的设置', 'Official tutorial settings'), { rc: 5, T: 4, lmax: 1 }], [L('论文的 LiPS（83 个原子）', 'The paper’s LiPS (83 atoms)'), { rc: 5, T: 6, lmax: 2, lgN: Math.log10(83) }]],
    figs: [[0.45, L('每个原子的近邻数随 r_c 的变化（三维，按数密度算）。', 'Neighbours per atom versus r_c (three dimensions, from the number density).')]],
    note: L('数密度由常见数据算出：水 1.0 g/cm³、硅的晶格常数 5.431 Å（金刚石结构）、铜 3.615 Å（面心立方）。近邻数是 (4/3)πr_c³ρ − 1 的平均值，晶体里真实的近邻数是一壳一壳跳的。路径按张量积的选择规则数，滤波器的最高阶取 l_max。λ_F = N² 是论文写的默认比例（λ_E = 1），NequIP 现在的版本用配置文件自己设权重。官方教程配置：cutoff_radius 5.0、num_layers 4、l_max 1、num_features 32。', 'Number densities come from common data: water 1.0 g/cm³, silicon lattice constant 5.431 Å (diamond structure), copper 3.615 Å (fcc). The neighbour count is the average (4/3)πr_c³ρ − 1; in a crystal the true count jumps shell by shell. Paths are counted by the selection rules with filter order up to l_max. λ_F = N² is the default ratio given in the paper (with λ_E = 1); current NequIP versions set the weights in the config file. Official tutorial config: cutoff_radius 5.0, num_layers 4, l_max 1, num_features 32.'),
    draw(s, [cv], c) {
      const rho = M.DENSITY[s.sys], N = Math.round(10 ** s.lgN), nb = M.sphereN(rho, s.rc) - 1, paths = M.tpPaths(M.featureIrreps(s.lmax, s.par), s.lmax, s.lmax, s.par === 'both').length;
      const rs = lin(2, 8, 100);
      plot(cv, { x: [2, 8], y: [0, M.sphereN(M.DENSITY.water, 8)], xl: 'r_c (Å)', yl: L('近邻数', 'neighbours'), series: [{ xs: rs, ys: rs.map((r) => M.sphereN(rho, r) - 1), color: c.accent, width: 2.2 }], marks: [{ x: s.rc, y: nb, color: c.gold }] });
      return [[L('每个原子的近邻数', 'Neighbours per atom'), `≈ ${fix(nb, 1)}`, true], [L('整个结构的边数（有向）', 'Edges in the structure (directed)'), `≈ ${fmt(N * nb)}`], [L('感受野半径 T·r_c 内的原子', 'Atoms within the receptive radius T·r_c'), `≈ ${fmt(M.sphereN(rho, s.T * s.rc) - 1)}`], [L('每层的张量积路径', 'Tensor-product paths per layer'), String(paths)], [L('每个结构的标签 3N + 1', 'Labels per structure 3N + 1'), fmt(3 * N + 1)], [L('论文默认的力权重 λ_F（λ_E = 1）', 'Paper’s default force weight λ_F (λ_E = 1)'), fmt(N * N)]];
    },
  };
};
