'use strict';
// AI 蛋白质设计（/protein-design/）的十二个演示。数学都在 pd-models.js（纯函数，tools/pd-test.mjs 测）。
// pd.js 用 window.MOLASTRIA_PD_DEMOS(K, DEMOS) 把它们登记进去。写法和世界模型（../world-models/wm-demos.js）一样：
// title，kind，intro，sel 下拉 [键, 名字, [[值, 名字]…], 初值]，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，chk 开关 [键, 名字, 初值]，
// btn 预设 [名字, { 键: 值 }]，act 动作，state，figs [[高宽比 | 'html', 图注]]，note，draw(s, 图, 颜色) 返回读数 [[名字, 值, 是否加粗]]。
// 算得慢的结果按参数缓存在 s._c 里（memo）。这里不画任何真实蛋白质的结构，所有图形都是公式现算出来的玩具模型。
window.MOLASTRIA_PD_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_PD_MODELS;
  const { L, fix, fmt, pct, plot, cells, fit, lin, font, esc, table, css } = K;
  const memo = (s, slot, key, make) => { s._c ||= {}; if (!s._c[slot] || s._c[slot].key !== key) s._c[slot] = { key, v: make() }; return s._c[slot].v; };
  const pow10 = (lg) => { const e = Math.floor(lg), m = 10 ** (lg - e); return `${m.toFixed(2)} × 10^${e}`; };
  const big = (lg) => (lg < 6 ? fmt(10 ** lg) : pow10(lg));
  const AA = 'ARNDCQEGHILKMFPSTWYV';

  // ── 1. 序列空间有多大：为什么必须有生成模型 ─────────────────────────────
  DEMOS.seqspace = {
    title: L('序列空间有多大：把全部可能的序列都试一遍是不可能的', 'How big is sequence space: trying every sequence is impossible'),
    kind: 'exact',
    intro: L('一条 N 个残基的链有 20^N 条序列。N = 100 就是 10^130 条，比可观测宇宙里的原子数（约 10^80）还多五十个数量级。所以蛋白质设计不可能靠穷举，只能靠两件事：一是把搜索限制在一个“球”里（从一条已知序列出发，最多改 d 个位置，这就是定向进化和深度突变扫描做的事），二是学一个分布，直接从里面抽样（这就是生成模型做的事）。拖动滑杆看三个数字：全部序列、半径 d 的球里有多少条、一个 10^L 条的文库能覆盖这个球的多大一块。', 'A chain of N residues has 20^N sequences. At N = 100 that is 10^130 — fifty orders of magnitude more than the number of atoms in the observable universe (about 10^80). So protein design can never be exhaustive. Only two things work: restricting the search to a “ball” (start from a known sequence and change at most d positions, which is what directed evolution and deep mutational scanning do), or learning a distribution and sampling from it (which is what generative models do). Drag the sliders and watch three numbers: all sequences, how many live in the ball of radius d, and what fraction of that ball a library of 10^L members can cover.'),
    ctl: [['N', L('链长 N', 'Chain length N'), 10, 300, 1, 100, String], ['d', L('最多改几个位置 d', 'At most d positions changed'), 1, 20, 1, 5, String], ['lib', L('文库大小（10 的几次方）', 'Library size (power of ten)'), 3, 14, 1, 9, (v) => `10^${v}`], ['pOK', L('随机序列能折叠的比例（猜）', 'Guessed fraction of random sequences that fold'), -12, -2, 0.5, -8, (v) => `10^${v}`]],
    btn: [[L('一个小结构域', 'A small domain'), { N: 100, d: 5, lib: 9 }], [L('一段肽', 'A peptide'), { N: 16, d: 16, lib: 9 }], [L('一个抗体的可变区', 'An antibody variable region'), { N: 240, d: 10, lib: 11 }]],
    figs: [[0.42, L('以某条序列为中心、半径 d 的球里有多少条序列（对数坐标）；金色竖线是现在的 d，虚线是文库大小。', 'How many sequences lie in a ball of radius d around some sequence (log scale); the gold line is the current d, the dashed line is the library size.')], ['html', L('三个数量级的对照。', 'Three orders of magnitude side by side.')]],
    note: L('壳层 = C(N, d)·19^d（选 d 个位置，每个换成另外 19 种之一），球 = 各层相加，恒等式 Σ_d C(N, d)·19^d = 20^N 可以用来检验。“能折叠的比例”是个粗估：随机序列里能稳定折叠的比例没有公认的数值，这里只是让你看量级，不要当实测结果。覆盖率算的是文库 ÷ 球，大于 1 时按 1 算。', 'A shell is C(N, d)·19^d (choose d positions, each mutated to one of the other 19); the ball is the sum of shells, and the identity Σ_d C(N, d)·19^d = 20^N is a useful check. The “fraction that folds” is a crude guess: there is no agreed number for how many random sequences fold stably, so read it as an order of magnitude only, not a measurement. Coverage is library ÷ ball, capped at 1.'),
    draw(s, [bv, tv]) {
      const c = css();
      const ds = lin(1, Math.min(20, s.N), Math.min(20, s.N));
      const ball = ds.map((d) => M.log10Ball(s.N, Math.round(d))), shell = ds.map((d) => M.log10Shell(s.N, Math.round(d)));
      const top = Math.max(M.log10Seqs(s.N), ...ball) * 1.05;
      plot(bv, { x: [1, Math.max(2, Math.min(20, s.N))], y: [0, top], xl: L('改动的位置数 d', 'positions changed d'), yl: L('序列数（10 的几次方）', 'sequences (powers of ten)'),
        series: [{ xs: ds, ys: ball, color: c.accent, width: 2.4, label: L('球（≤ d 个改动）', 'ball (≤ d changes)') }, { xs: ds, ys: shell, color: c.info, width: 2, label: L('壳层（正好 d 个）', 'shell (exactly d)') }],
        hmarks: [{ y: s.lib, color: c.muted }, { y: M.log10Seqs(s.N), color: c.gold }], marks: [{ x: s.d, y: M.log10Ball(s.N, s.d), color: c.gold }] });
      const cov = Math.min(1, 10 ** (s.lib - M.log10Ball(s.N, s.d)));
      tv.innerHTML = table([L('数量', 'Quantity'), L('有多少', 'How many'), L('对比', 'For comparison')], [
        [L(`全部序列 20^${s.N}`, `all sequences 20^${s.N}`), `10^${fix(M.log10Seqs(s.N), 1)}`, L('可观测宇宙的原子数 ≈ 10^80', 'atoms in the observable universe ≈ 10^80')],
        [L(`半径 ${s.d} 的球`, `ball of radius ${s.d}`), `10^${fix(M.log10Ball(s.N, s.d), 1)}`, L(`文库 10^${s.lib} 覆盖 ${pct(cov)}`, `a 10^${s.lib} library covers ${pct(cov)}`)],
        [L('“能折叠”的序列（粗估）', '“foldable” sequences (crude guess)'), `10^${fix(M.log10Folding(s.N, 10 ** s.pOK), 1)}`, L('仍然远多于做得出来的数量', 'still far more than anyone can make')],
      ]);
      return [[L('全部序列', 'All sequences'), `10^${fix(M.log10Seqs(s.N), 1)}`, true],
        [L(`半径 ${s.d} 的球`, `Ball of radius ${s.d}`), `10^${fix(M.log10Ball(s.N, s.d), 1)}`],
        [L('文库能覆盖球的多少', 'Fraction of the ball a library covers'), cov > 0.999 ? L('全部', 'all of it') : pct(cov), true],
        [L('检验：Σ 壳层 = 20^N', 'Check: Σ shells = 20^N'), Math.abs(M.log10Ball(s.N, s.N) - M.log10Seqs(s.N)) < 1e-6 ? L('对得上', 'holds') : L('不对', 'fails')]];
    },
  };

  // ── 2. HP 格子模型：折叠容易，设计难 ──────────────────────────────────
  const HPSEQS = [['HPPHPPHPPH', L('交替的疏水', 'alternating hydrophobic')], ['HHPPHPPHHP', L('两段疏水', 'two hydrophobic patches')], ['HPHPHPHPHP', L('严格交替', 'strictly alternating')], ['HHHHPPPPPP', L('一头全疏水', 'one hydrophobic end')]];
  DEMOS.hp = {
    title: L('HP 格子模型：折叠容易，设计难', 'The HP lattice model: folding is easy, design is hard'),
    kind: 'exact',
    intro: L('把蛋白质简化到不能再简化：正方格子上的一条链，每个单体只有疏水（H）和亲水（P）两种，两个不相邻的 H 挨在一起就得 −1 的能量。链长 N 时所有构象可以穷举，所以“这条序列折叠成什么”有精确答案：能量最低的构象。这个玩具解释了两件真事。一是折叠问题（给序列找结构）在这里是可解的；二是反过来的设计问题要难得多——把全部 2^N 条序列过一遍，只有很少一部分有唯一的基态，而少数几个构象却被大量序列折叠出来（“可设计性”高的结构）。天然蛋白质的折叠种类少，很可能就是这个道理。', 'Simplify a protein as far as it will go: a chain on a square lattice where each monomer is only hydrophobic (H) or polar (P), and two non-adjacent H monomers touching gain energy −1. For a given length every conformation can be enumerated, so “what does this sequence fold into” has an exact answer: the lowest-energy conformation. This toy explains two real things. First, the folding problem (structure from sequence) is solvable here. Second, the inverse design problem is much harder — run all 2^N sequences and only a small fraction has a unique ground state, while a few conformations are folded into by a great many sequences (structures with high “designability”). That is very likely why natural proteins use so few folds.'),
    sel: [['seq', L('序列', 'Sequence'), HPSEQS.map(([v, n]) => [v, `${v} — ${n}`]), 'HHPPHPPHHP']],
    ctl: [['N', L('穷举的链长 N（右图）', 'Chain length N for the census (right)'), 8, 14, 1, 12, String]],
    act: [[L('换一条随机序列', 'A random sequence'), (s) => { s.seed = (s.seed || 1) + 1; s.seq = Array.from({ length: 10 }, () => (Math.sin((s.seed * 97 + Math.random() * 1e4) * 1.1) > 0 ? 'H' : 'P')).join(''); }]],
    state: () => ({ seed: 1 }),
    figs: [[0.6, L('左边这条序列的基态构象（金色是疏水单体，虚线是 H–H 接触）。基态不唯一时画其中一个。', 'The ground-state conformation of the chosen sequence (gold = hydrophobic, dashed lines are H–H contacts). If the ground state is degenerate, one of them is drawn.')], [0.42, L('长度 N 的全部序列里，每个构象被多少条序列唯一地折叠出来（从多到少排序）。', 'Across all sequences of length N, how many sequences fold uniquely into each conformation (sorted).')]],
    note: L('Lau 和 Dill 1989 年的 HP 模型。构象是正方格子上的自回避行走，去掉旋转和镜像（第一步朝 +x、第一个转弯朝 +y）；接触要求 |i − j| > 2 且格点相邻。长度 12 时有 15 037 个构象（未去对称的自回避行走数 120 292 是 OEIS A001411 的一项）。“可设计性”这个概念来自 Li、Helling、Tang 和 Wingreen 1996 年在 Science 上的工作（他们用的是三维 3 × 3 × 3 的紧致格子）。真实的蛋白质当然不住在格子上，这里要的只是那个结论的形状。', 'The HP model of Lau and Dill (1989). Conformations are self-avoiding walks on a square lattice with rotations and mirrors removed (first step along +x, first turn towards +y); a contact needs |i − j| > 2 and lattice adjacency. At length 12 there are 15,037 conformations (the unreduced self-avoiding walk count, 120,292, is a term of OEIS A001411). “Designability” comes from Li, Helling, Tang and Wingreen, Science 1996 (they used a compact 3 × 3 × 3 cubic lattice). Real proteins of course do not live on a lattice; what carries over is the shape of the conclusion.'),
    draw(s, [fv, dv]) {
      const c = css(), seq = (s.seq || '').replace(/[^HP]/g, '') || 'HHPPHPPHHP';
      const n = seq.length, STS = memo(s, 'st', String(n), () => M.hpStructures(n));
      let mask = 0; for (let i = 0; i < n; i++) if (seq[i] === 'H') mask |= 1 << i;
      const f = M.hpFold(mask, STS), st = STS[Math.max(0, f.at)];
      const { ctx, w, h } = fit(fv), xs = st.w.x, ys = st.w.y;
      const lo = [Math.min(...xs), Math.min(...ys)], hi = [Math.max(...xs), Math.max(...ys)];
      const cell = Math.min((w - 40) / (hi[0] - lo[0] + 1), (h - 40) / (hi[1] - lo[1] + 1));
      const px = (i) => (w - cell * (hi[0] - lo[0])) / 2 + (xs[i] - lo[0]) * cell, py = (i) => (h + cell * (hi[1] - lo[1])) / 2 - (ys[i] - lo[1]) * cell;
      ctx.strokeStyle = c.ink2; ctx.lineWidth = 2.5; ctx.beginPath();
      for (let i = 0; i < n; i++) (i ? ctx.lineTo(px(i), py(i)) : ctx.moveTo(px(i), py(i)));
      ctx.stroke();
      ctx.setLineDash([3, 3]); ctx.strokeStyle = c.gold; ctx.lineWidth = 2;
      for (const [i, j] of st.contacts) if (seq[i] === 'H' && seq[j] === 'H') { ctx.beginPath(); ctx.moveTo(px(i), py(i)); ctx.lineTo(px(j), py(j)); ctx.stroke(); }
      ctx.setLineDash([]);
      ctx.font = font(Math.max(10, cell * 0.42), 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      for (let i = 0; i < n; i++) { ctx.fillStyle = seq[i] === 'H' ? c.gold : c.surface; ctx.beginPath(); ctx.arc(px(i), py(i), cell * 0.3, 0, 2 * Math.PI); ctx.fill(); ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.4; ctx.stroke(); ctx.fillStyle = seq[i] === 'H' ? '#1a1206' : c.ink; ctx.fillText(seq[i], px(i), py(i)); }
      ctx.textBaseline = 'alphabetic';
      const D = memo(s, 'des', String(s.N), () => M.hpDesignability(s.N));
      const sorted = [...D.count].sort((a, b) => b - a), shown = sorted.slice(0, 80);
      plot(dv, { x: [0, Math.max(10, shown.length)], y: [0, Math.max(2, sorted[0] * 1.1)], xl: L('构象（按可设计性排序）', 'conformation (sorted by designability)'), yl: L('唯一折叠它的序列数', 'sequences folding into it'),
        series: [{ xs: shown.map((_, i) => i), ys: shown, color: c.accent, bars: 0.9, base: 0 }] });
      return [[L('这条序列的基态能量', 'Ground-state energy of this sequence'), `${f.E}`],
        [L('基态唯一吗', 'Is the ground state unique'), f.deg === 1 ? L('唯一（设计得出来）', 'unique (designable)') : L(`${f.deg} 个同样低的构象`, `${f.deg} conformations tie`), true],
        [L(`长度 ${s.N}：构象数 / 序列数`, `Length ${s.N}: conformations / sequences`), `${fmt(D.STS.length)} / ${fmt(D.total)}`],
        [L('有唯一基态的序列比例', 'Fraction of sequences with a unique ground state'), pct(D.uniqueFrac), true],
        [L('最“好设计”的那个构象被多少条序列折叠出来', 'The most designable conformation is folded into by'), L(`${D.maxCount} 条`, `${D.maxCount} sequences`)]];
    },
  };

  // ── 3. 疏水矩：七肽重复为什么能搭出螺旋束 ──────────────────────────────
  const SEQKINDS = [['coil', L('七肽重复（螺旋束）', 'Heptad repeat (coiled coil)')], ['sheet', L('交替（β 链）', 'Alternating (β strand)')], ['tm', L('全疏水（跨膜螺旋）', 'All hydrophobic (TM helix)')], ['rand', L('随机', 'Random')]];
  DEMOS.bundle = {
    title: L('疏水矩：为什么七肽重复能搭出螺旋束', 'The hydrophobic moment: why a heptad repeat makes a coiled coil'),
    kind: 'exact',
    intro: L('二十世纪的蛋白质设计有一条简单得惊人的规则：α 螺旋每个残基转 100°，七个残基转 700° ≈ 两圈，所以“每隔 3、4 个残基放一个疏水残基”（七肽重复 abcdefg 的 a 和 d 位）会让疏水残基排在螺旋的同一侧，几条这样的螺旋就能把疏水面贴在一起，形成螺旋束。把这件事量化的是 Eisenberg 的疏水矩：把每个残基的疏水值当成一个指向它在螺旋上方位角的向量，加起来再除以链长。横坐标扫过“每残基转多少度”，七肽重复的曲线在 102.9°（= 720°/7）附近顶起来，正好是 α 螺旋；交替序列在 180° 顶起来，那是 β 折叠。', 'Twentieth-century protein design had one startlingly simple rule: an α helix turns 100° per residue, so seven residues turn 700° ≈ two full turns, and therefore placing a hydrophobic residue every 3 or 4 positions (the a and d positions of the heptad abcdefg) puts them all on one side of the helix; several such helices can glue their hydrophobic faces together into a bundle. Eisenberg’s hydrophobic moment quantifies this: treat each residue’s hydrophobicity as a vector pointing at its azimuth on the helix, add them up and divide by the length. Sweep the x-axis over “degrees per residue” and the heptad curve peaks near 102.9° (= 720°/7), which is the α helix; the alternating sequence peaks at 180°, which is the β sheet.'),
    sel: [['kind', L('序列', 'Sequence'), SEQKINDS, 'coil']],
    ctl: [['n', L('链长', 'Length'), 14, 42, 1, 28, String], ['deg', L('轮盘上每残基转多少度', 'Degrees per residue on the wheel'), 60, 200, 0.1, 100, (v) => `${v.toFixed(1)}°`]],
    btn: [[L('α 螺旋 100°', 'α helix 100°'), { deg: 100 }], [L('七肽重复的最佳 102.9°', 'heptad optimum 102.9°'), { deg: 102.9 }], [L('β 链 180°', 'β strand 180°'), { deg: 180 }]],
    act: [[L('换一条随机序列', 'A new random sequence'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.42, L('疏水矩 μ 随“每残基转角”变化；金线是现在的角度，虚线是 α 螺旋的 100°。', 'The hydrophobic moment μ against degrees per residue; the gold line is the current angle, the dashed line is 100° for an α helix.')], [0.62, L('螺旋轮盘：每个残基按现在的角度排在圆周上，红色是疏水、蓝色是亲水，箭头是疏水矩的方向。', 'Helical wheel: residues placed around the circle at the current angle, red hydrophobic, blue polar, the arrow is the hydrophobic moment.')]],
    note: L('疏水标度是 Eisenberg 等 1984 年的归一化共识标度；μ(δ) = |Σ Hᵢ exp(i·δ·i)| / N。序列是按规则生成的玩具序列（a、d 位从 LIVFM 里取，其余从 EKQRSD 里取），不是任何真实蛋白质。真实的螺旋束设计还要管螺旋之间的交错角、堆积方式（knobs-into-holes）和盐桥，这里只演示周期性这一件事。', 'The hydrophobicity scale is the normalised consensus scale of Eisenberg et al. (1984); μ(δ) = |Σ Hᵢ exp(i·δ·i)| / N. Sequences are rule-generated toys (a and d positions drawn from LIVFM, the rest from EKQRSD), not any real protein. Real coiled-coil design also has to handle crossing angles, knobs-into-holes packing and salt bridges; this demo shows only the periodicity.'),
    draw(s, [cv, wv]) {
      const c = css(), seq = memo(s, 'q', `${s.kind}|${s.n}|${s.seed}`, () => M.makeSeq(s.kind, s.n, s.seed));
      const H = M.hydro(seq), degs = lin(60, 200, 561), mu = M.momentCurve(H, degs), best = M.bestAngle(H);
      plot(cv, { x: [60, 200], y: [0, Math.max(...mu) * 1.15], xl: L('每残基转角 δ', 'degrees per residue δ'), yl: 'μ',
        series: [{ xs: degs, ys: mu, color: c.accent, width: 2.4 }], marks: [{ x: s.deg, y: M.hydroMoment(H, s.deg), color: c.gold }, { x: 100, color: c.muted }] });
      const { ctx, w, h } = fit(wv), R = Math.min(w, h) * 0.36, cx = w / 2, cy = h / 2;
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.beginPath(); ctx.arc(cx, cy, R, 0, 2 * Math.PI); ctx.stroke();
      ctx.font = font(11, 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      let vx = 0, vy = 0;
      [...seq].forEach((a, i) => {
        const th = ((s.deg * i - 90) * Math.PI) / 180, rr = R * (1 - 0.055 * Math.floor((s.deg * i) / 360));
        const x = cx + rr * Math.cos(th), y = cy + rr * Math.sin(th);
        vx += H[i] * Math.cos(th); vy += H[i] * Math.sin(th);
        ctx.fillStyle = H[i] > 0 ? c.danger : c.info; ctx.globalAlpha = 0.18 + 0.5 * Math.min(1, Math.abs(H[i]) / 1.4);
        ctx.beginPath(); ctx.arc(x, y, Math.max(8, R * 0.1), 0, 2 * Math.PI); ctx.fill(); ctx.globalAlpha = 1;
        ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = c.ink; ctx.fillText(a, x, y);
      });
      ctx.textBaseline = 'alphabetic';
      const vn = Math.hypot(vx, vy) / seq.length, sc = (R * 0.8 * vn) / Math.max(1e-9, vn);
      if (vn > 1e-6) { K.arrow(ctx, cx, cy, cx + (vx / seq.length / Math.max(vn, 1e-9)) * sc, cy + (vy / seq.length / Math.max(vn, 1e-9)) * sc, c.gold, 3); }
      return [[L('这个角度下的疏水矩 μ', 'Hydrophobic moment μ at this angle'), fix(M.hydroMoment(H, s.deg), 3)],
        [L('μ 最大的角度', 'Angle where μ is largest'), `${fix(best.deg, 1)}° (μ = ${fix(best.mu, 3)})`, true],
        [L('α 螺旋 100° 的 μ / β 链 180° 的 μ', 'μ at 100° (α) / at 180° (β)'), `${fix(M.hydroMoment(H, 100), 3)} / ${fix(M.hydroMoment(H, 180), 3)}`],
        [L('七肽重复的理想角度 720°/7', 'Heptad optimum 720°/7'), '102.9°'],
        [L('序列', 'Sequence'), seq]];
    },
  };

  // ── 4. 相关不等于接触：DCA 为什么要求逆 ────────────────────────────────
  const TOPOS = [['hairpin', L('β 发夹（梯子状的接触）', 'β hairpin (ladder of contacts)')], ['helix', L('螺旋（i, i+4）', 'Helix (i, i+4)')], ['two', L('两个长程接触', 'Two long-range contacts')]];
  const topoContacts = (kind, Lc) => {
    if (kind === 'helix') { const o = []; for (let i = 0; i + 4 < Lc; i++) o.push([i, i + 4]); return o; }
    if (kind === 'two') return [[2, Lc - 3], [4, Lc - 5]];
    const o = []; for (let k = 0; k < 4; k++) o.push([2 + k, Lc - 3 - k]); return o;
  };
  DEMOS.msa = {
    title: L('相关不等于接触：协同进化为什么要把矩阵求逆', 'Correlation is not contact: why coevolution has to invert the matrix'),
    kind: 'exact',
    intro: L('蛋白质语言模型能从序列猜出结构，根源是一件生物学事实：两个在空间上接触的位置必须一起变（一个变大，另一个得变小），这叫协同进化。但直接看“哪两列相关”会被骗：如果 i 和 j 接触、j 和 k 接触，那么 i 和 k 也会相关，哪怕它们离得很远。这就是传递效应。解决办法在数学上很干净：真实的耦合是精度矩阵（协方差的逆）里的非零项，所以把观测到的协方差求逆，间接的相关就自己消失了——这正是 DCA（直接耦合分析）。这里用一个高斯图模型，耦合只放在真实接触上，所以“对不对”有精确答案。', 'Protein language models can guess structure from sequence because of one biological fact: two positions that touch in space must change together (one gets bigger, the other must get smaller), which is coevolution. But reading off “which two columns correlate” is misleading: if i touches j and j touches k, then i and k correlate too, however far apart they are. That is transitivity. The fix is mathematically clean: the true couplings are the nonzero entries of the precision matrix (the inverse covariance), so inverting the observed covariance makes the indirect correlations vanish by themselves — which is exactly DCA (direct coupling analysis). Here the couplings of a Gaussian graphical model sit only on the true contacts, so “right or wrong” has an exact answer.'),
    sel: [['topo', L('接触的拓扑', 'Contact topology'), TOPOS, 'hairpin']],
    ctl: [['Lc', L('位置数', 'Positions'), 10, 20, 1, 16, String], ['w', L('耦合强度', 'Coupling strength'), 0.15, 0.48, 0.01, 0.4, (v) => v.toFixed(2)], ['lgn', L('看过多少条同源序列', 'Homologous sequences seen'), 1.3, 4, 0.1, 2.6, (v) => fmt(Math.round(10 ** v))]],
    btn: [[L('序列很多', 'Plenty of sequences'), { lgn: 4 }], [L('序列很少（孤儿蛋白）', 'Few sequences (an orphan protein)'), { lgn: 1.6 }]],
    act: [[L('换一批序列', 'Resample the sequences'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.34, L('左：真实的接触图。中：相关矩阵（绝对值）。右：精度矩阵（绝对值）。都是精确计算，不是抽样。', 'Left: the true contact map. Middle: the correlation matrix (absolute value). Right: the precision matrix (absolute value). All exact, not sampled.')], [0.34, L('同一组矩阵，但只用抽到的有限条序列估计出来。序列少的时候求逆会放大噪声。', 'The same matrices estimated from a finite number of sampled sequences. With few sequences, inverting amplifies noise.')]],
    note: L('高斯图模型：精度矩阵 J = I + Σ_接触 w·(eᵢ − eⱼ)(eᵢ − eⱼ)ᵀ，协方差 Σ = J⁻¹。精确的 J 在非接触的位置上正好是 0，而 Σ 处处非零——这就是传递效应。估计用有限样本的协方差加一点收缩（对角线上加 10 %），再求逆。真实的 DCA 处理的是 21 种符号的离散分布（伪似然或平均场近似），还要给序列加权去掉冗余，但“求逆去掉间接相关”这一步是同一件事。真实的蛋白质语言模型（ESM 一类）不显式算这个矩阵，而是把这种统计吃进了参数里。', 'Gaussian graphical model: precision matrix J = I + Σ_contacts w·(eᵢ − eⱼ)(eᵢ − eⱼ)ᵀ, covariance Σ = J⁻¹. The exact J is identically zero at non-contacts while Σ is nonzero everywhere — that is transitivity. Estimation uses the finite-sample covariance with a little shrinkage (10 % added on the diagonal) before inverting. Real DCA works with discrete distributions over 21 symbols (pseudo-likelihood or mean field) and reweights sequences to remove redundancy, but “invert to remove indirect correlation” is the same step. Real protein language models (the ESM family) never form this matrix explicitly; they absorb the statistics into their parameters.'),
    draw(s, [ev, sv]) {
      const c = css(), Lc = s.Lc, far = topoContacts(s.topo, Lc), cs = [...M.CHAIN(Lc), ...far];
      const D = memo(s, 'g', `${Lc}|${s.topo}|${s.w}`, () => { const g = M.gmModel(Lc, cs, s.w); return { g, C: M.toCorr(g.S), P: M.inv(g.S) }; });
      const n = Math.round(10 ** s.lgn), smp = memo(s, 's', `${Lc}|${s.topo}|${s.w}|${n}|${s.seed}`, () => M.gmSample(D.g, n, s.seed, 0.1));
      const set = new Set(cs.map(([i, j]) => `${Math.min(i, j)}-${Math.max(i, j)}`));
      const panels = (cv, mats) => {
        const gap = 10, { ctx, w, h } = fit(cv), side = Math.min((w - 2 * gap) / 3, h);
        mats.forEach((Mx, k) => {
          const off = k * (side + gap) + (w - 3 * side - 2 * gap) / 2;
          const mx = Math.max(...Mx.flatMap((r, i) => r.map((v, j) => (i === j ? 0 : Math.abs(v))))) || 1;
          for (let i = 0; i < Lc; i++) for (let j = 0; j < Lc; j++) {
            const v = i === j ? 0 : Math.abs(Mx[i][j]) / mx;
            ctx.fillStyle = c.accent; ctx.globalAlpha = Math.min(1, v ** 0.55);
            ctx.fillRect(off + (j * side) / Lc, (i * side) / Lc, side / Lc + 0.6, side / Lc + 0.6);
          }
          ctx.globalAlpha = 1; ctx.strokeStyle = c.line; ctx.strokeRect(off, 0, side, side);
          ctx.strokeStyle = c.gold; ctx.lineWidth = 1.2;
          for (const [i, j] of far) { ctx.strokeRect(off + (j * side) / Lc, (i * side) / Lc, side / Lc, side / Lc); ctx.strokeRect(off + (i * side) / Lc, (j * side) / Lc, side / Lc, side / Lc); }
        });
      };
      const truth = Array.from({ length: Lc }, (_, i) => Array.from({ length: Lc }, (_, j) => (set.has(`${Math.min(i, j)}-${Math.max(i, j)}`) ? 1 : 0)));
      panels(ev, [truth, D.C, D.P]);
      panels(sv, [truth, M.toCorr(smp.C), smp.Jhat]);
      const ec = M.pairAuc(D.C, cs, 2), ep = M.pairAuc(D.P, cs, 2);
      const sc = M.pairAuc(M.toCorr(smp.C), cs, 2), sp = M.pairAuc(smp.Jhat, cs, 2);
      return [[L('精确：相关矩阵在“非接触”处最大的假信号', 'Exact: largest false signal of the correlation matrix'), fix(ec.maxNeg, 4)],
        [L('精确：精度矩阵在“非接触”处最大的假信号', 'Exact: largest false signal of the precision matrix'), ep.maxNeg < 1e-12 ? L('0（机器精度）', '0 (machine precision)') : fmt(ep.maxNeg), true],
        [L(`${fmt(n)} 条序列：相关 / 精度 的 AUC`, `${fmt(n)} sequences: AUC of correlation / precision`), `${fix(sc.auc, 3)} / ${fix(sp.auc, 3)}`, true],
        [L('真实接触数（含链上相邻）', 'True contacts (chain neighbours included)'), `${cs.length}`],
        [L('序列少的时候', 'When sequences are few'), n < 200 ? L('求逆放大噪声，两种都不灵', 'inverting amplifies noise; neither works') : L('两种都认得出接触', 'both recover the contacts')]];
    },
  };

  // ── 5. 逆折叠：给骨架写序列 ───────────────────────────────────────────
  DEMOS.mpnn = {
    title: L('逆折叠：给定骨架写序列，为什么“回收率”不等于“设计得好”', 'Inverse folding: writing a sequence for a backbone, and why “recovery” is not “good design”'),
    kind: 'toy',
    intro: L('ProteinMPNN 这类逆折叠模型做的事：固定骨架，对每个位置给出 20 种残基的概率。衡量它们最常用的数字是“序列回收率”——模型给的最可能残基和天然序列一致的比例。这个演示把环境简化成一个数：埋藏度（这个位置在格子上有几个邻居）。温度 T 控制分布的宽窄：T 很低时模型每个位置都只敢给一个答案，回收率高但抽出来的序列几乎都一样；T 高时多样性大，回收率低。真实的教训是一样的：回收率高不代表设计成功（天然序列不是唯一的答案），回收率低也不代表失败。真正算数的是湿实验里表达、折叠、有功能的比例。', 'What inverse-folding models like ProteinMPNN do: fix the backbone and give, for each position, a probability over the 20 residues. The number most often quoted for them is “sequence recovery” — how often the model’s most likely residue matches the native one. This demo compresses the environment into a single number: burial (how many lattice neighbours the position has). Temperature T sets the width of the distribution: at low T the model commits to one answer per position, recovery is high but sampled sequences are nearly identical; at high T diversity is large and recovery drops. The real lesson is the same: high recovery does not mean the design works (the native sequence is not the only answer), and low recovery does not mean it failed. What counts is the fraction that expresses, folds and functions in the wet lab.'),
    ctl: [['T', L('采样温度 T', 'Sampling temperature T'), 0.1, 2, 0.05, 0.6, (v) => v.toFixed(2)], ['beta', L('模型有多看重埋藏度', 'How much the model weighs burial'), 0.5, 4, 0.1, 2.2, (v) => v.toFixed(1)], ['ns', L('抽几条序列', 'Sequences sampled'), 2, 40, 1, 12, String]],
    btn: [[L('低温（保守）', 'Low temperature (conservative)'), { T: 0.15 }], [L('常用的 T = 0.1 ~ 0.3', 'The usual T = 0.1–0.3'), { T: 0.25 }], [L('高温（多样）', 'High temperature (diverse)'), { T: 1.5 }]],
    act: [[L('换一个骨架', 'Another backbone'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.4, L('每个位置的埋藏度（柱子）和模型在这个位置上的熵（线，单位 bit）。埋得深的位置熵低——模型知道那里只能放疏水残基。', 'Burial at each position (bars) and the model’s entropy there (line, in bits). Deeply buried positions have low entropy — the model knows only hydrophobic residues fit.')], ['html', L('抽出来的几条序列（第一行是“天然”序列，匹配的位置加粗）。', 'The sampled sequences (the first row is the “native” one; matching positions are bold).')]],
    note: L('玩具模型：位置 i 的环境只用埋藏度 bᵢ（格子上非相邻的邻居数，0–2）概括，p(a | b) ∝ exp(β·H(a)·(b − 1)/T)，H 是 Eisenberg 疏水值。“天然”序列是同一个模型在 T = 0.35 下抽的一条，所以回收率的上限不是 100 %，这也符合真实情况。期望回收率有解析解 Σᵢ pᵢ(天然残基)，不用抽样。真实的 ProteinMPNN 看的是完整的三维环境（邻居的距离和方向）、自回归地写序列，并且在 CATH 测试集上的回收率约为 50 %；这里的数字不要和它比。', 'A toy model: the environment of position i is only its burial bᵢ (number of non-adjacent lattice neighbours, 0–2), with p(a | b) ∝ exp(β·H(a)·(b − 1)/T) where H is the Eisenberg value. The “native” sequence is one draw from the same model at T = 0.35, so recovery cannot reach 100 % — which is also true of the real thing. Expected recovery has the closed form Σᵢ pᵢ(native), so no sampling is needed. Real ProteinMPNN sees the full three-dimensional environment (neighbour distances and orientations), writes the sequence autoregressively, and recovers about 50 % on CATH test sets; do not compare the numbers here with that.'),
    draw(s, [bv, tv]) {
      const c = css();
      const w = memo(s, 'w', String(s.seed), () => { const all = M.sawWalks(16, true); return all[Math.floor((s.seed * 7919) % all.length)]; });
      const b = M.burialOf(w), nat = M.ifNative(b, 11);
      const st = M.ifStats(b, nat, { T: s.T, beta: s.beta });
      const R = M.rng(s.seed * 31 + Math.round(s.T * 100));
      const draws = Array.from({ length: s.ns }, () => M.ifSample(st.ps, R));
      const idx = b.map((_, i) => i);
      plot(bv, { x: [-0.5, b.length - 0.5], y: [0, 4.4], xl: L('位置', 'position'), yl: L('埋藏度 / 熵 (bit)', 'burial / entropy (bits)'),
        series: [{ xs: idx, ys: b, color: c.accent, bars: 0.7, base: 0, alpha: 0.4, label: L('埋藏度', 'burial') }, { xs: idx, ys: st.ps.map((p) => M.entropyBits ? M.entropyBits(p) : 0), color: c.gold, width: 2.2, dots: 3, line: true, label: L('熵', 'entropy') }] });
      const row = (seq, isNat) => seq.map((a, i) => (!isNat && a === nat[i] ? `<b>${AA[a]}</b>` : AA[a])).join('');
      tv.innerHTML = `<div class="chm-wrap"><table class="chm-table"><thead><tr><th>${esc(L('序列', 'Sequence'))}</th><th>${esc(L('和天然一致', 'Identity to native'))}</th></tr></thead><tbody>`
        + `<tr class="is-on"><td class="pd-seq">${row(nat, true)}</td><td class="num">${esc(L('天然', 'native'))}</td></tr>`
        + draws.map((d) => `<tr><td class="pd-seq">${row(d, false)}</td><td class="num">${pct(d.filter((a, i) => a === nat[i]).length / d.length)}</td></tr>`).join('')
        + '</tbody></table></div>';
      const uniq = new Set(draws.map((d) => d.join(','))).size;
      const pair = draws.length > 1 ? (() => { let s2 = 0, m = 0; for (let i = 0; i < draws.length; i++) for (let j = i + 1; j < draws.length; j++) { m++; s2 += draws[i].filter((a, k) => a === draws[j][k]).length / draws[i].length; } return s2 / m; })() : 1;
      return [[L('期望回收率（解析）', 'Expected recovery (closed form)'), pct(st.expect), true],
        [L('取最大值的回收率', 'Recovery if you take the argmax'), pct(st.argmax)],
        [L('平均每个位置的熵', 'Mean entropy per position'), L(`${fix(st.bits, 2)} bit`, `${fix(st.bits, 2)} bits`)],
        [L('这些设计彼此之间的一致度', 'Identity among the designs themselves'), pct(pair), true],
        [L('抽到几条不同的序列', 'Distinct sequences drawn'), `${uniq} / ${draws.length}`]];
    },
  };

  // ── 6. 扩散生成骨架 ──────────────────────────────────────────────────
  DEMOS.diff = {
    title: L('扩散模型怎么生成骨架，以及“固定一个 motif”是什么意思', 'How a diffusion model generates a backbone, and what “fixing a motif” means'),
    kind: 'exact',
    intro: L('RFdiffusion 一类模型的做法：先把真实结构一步步加噪声直到变成纯噪声，再学会把这个过程倒过来走。这里把“结构”换成平面上 n 个点的链，先验是一个弹性网络（相邻三点的二阶差分要小，所以链是光滑的），这样最优去噪器有闭式解，反向扩散抽出来的样本精确服从先验——你看到的不是近似，是精确的采样。两个开关值得玩：一是“每一步只用后验均值”，那样生成的链会过度光滑、方差偏小，这正是真实扩散模型被抱怨“设计太平均”的数学来源；二是“固定 motif”，把几个点按住不动，剩下的从条件分布里长出来，这就是 motif scaffolding。', 'What models like RFdiffusion do: add noise to real structures step by step until nothing is left, then learn to run that process backwards. Here a “structure” is a chain of n points in the plane and the prior is an elastic network (second differences of three consecutive points must be small, so chains are smooth). The optimal denoiser then has a closed form and reverse diffusion samples the prior exactly — what you see is not an approximation, it is exact sampling. Two switches are worth playing with. First, “use only the posterior mean at every step”: the chains come out over-smooth with too little variance, which is the mathematical origin of the complaint that diffusion designs look too average. Second, “fix a motif”: hold a few points still and let the rest grow from the conditional distribution — that is motif scaffolding.'),
    chk: [['mean', L('每一步只用后验均值（不抽样）', 'Use only the posterior mean at each step'), false], ['motif', L('固定两头的 motif', 'Fix a motif at both ends'), false], ['iso', L('扔掉先验（当成互不相关的噪声）', 'Throw the prior away (treat as independent noise)'), false]],
    ctl: [['n', L('残基数', 'Residues'), 10, 22, 1, 16, String], ['steps', L('反向扩散的步数', 'Reverse diffusion steps'), 4, 40, 1, 20, String], ['ns', L('画几条', 'Chains drawn'), 1, 8, 1, 4, String]],
    btn: [[L('正常采样', 'Normal sampling'), { mean: false, motif: false, iso: false }], [L('只用均值（过度光滑）', 'Mean only (over-smooth)'), { mean: true, motif: false }], [L('固定 motif', 'Fix a motif'), { motif: true, mean: false }]],
    act: [[L('再抽一次', 'Draw again'), (s) => { s.seed = (s.seed || 1) + 7; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.52, L('生成出来的链（金色的点是被按住的 motif）；灰色是先验的均值。', 'The generated chains (gold points are the fixed motif); grey is the prior mean.')], [0.4, L('一条链在反向扩散过程中的样子：从纯噪声到成形（颜色由浅到深）。', 'One chain during reverse diffusion, from pure noise to a shape (light to dark).')]],
    note: L('先验是 N(μ, J⁻¹)，J = a·I + c·DᵀD（D 是二阶差分矩阵），μ 是一条理想螺旋在平面上的投影。噪声表 ᾱ(t) = cos²(πt/2T)（Nichol 和 Dhariwal 的余弦表）。高斯先验下 E[x₀ | x_t] 有闭式解，后验协方差也有，所以“每一步从后验抽样”给出的样本精确服从先验（样本协方差和先验的相对偏差只是抽样噪声，按 1/√样本数 缩小）；“只用后验均值”会系统性地把方差吃掉。固定 motif 后其余坐标的条件分布也是精确的高斯。真实的 RFdiffusion 在 SE(3) 上扩散刚体坐标系，要管手性、碰撞和二级结构，但“学会倒着走”“按住一部分”这两件事是一样的。', 'The prior is N(μ, J⁻¹) with J = a·I + c·DᵀD (D the second-difference matrix) and μ the planar projection of an ideal helix. The noise schedule is ᾱ(t) = cos²(πt/2T) (the cosine schedule of Nichol and Dhariwal). For a Gaussian prior both E[x₀ | x_t] and the posterior covariance are closed-form, so “sample from the posterior at every step” produces samples that follow the prior exactly (the relative deviation of the sample covariance is only sampling noise, shrinking as 1/√samples); “posterior mean only” systematically eats the variance. With a motif fixed, the conditional distribution of the remaining coordinates is again an exact Gaussian. Real RFdiffusion diffuses rigid-body frames on SE(3) and must handle chirality, clashes and secondary structure, but “learn to run it backwards” and “hold part of it still” are the same two ideas.'),
    draw(s, [gv, pv]) {
      const c = css(), P = memo(s, 'p', String(s.n), () => M.backbonePrior(s.n));
      const fixed = s.motif ? [[0, P.mu[0]], [1, P.mu[1]], [2 * s.n - 2, P.mu[2 * s.n - 2]], [2 * s.n - 1, P.mu[2 * s.n - 1]]] : null;
      const opt = { steps: s.steps, Tn: s.steps, iso: s.iso, fixed, sample: !s.mean };
      const runs = memo(s, 'r', `${s.n}|${s.steps}|${s.ns}|${s.seed}|${s.mean}|${s.motif}|${s.iso}`, () => Array.from({ length: s.ns }, (_, k) => M.reverseDiffusion(P, { ...opt, seed: s.seed + k })));
      const pts = (x) => Array.from({ length: s.n }, (_, i) => [x[2 * i], x[2 * i + 1]]);
      const all = runs.flatMap((r) => pts(r.x)).concat(pts(P.mu));
      const mx = Math.max(...all.flatMap(([a, b2]) => [Math.abs(a), Math.abs(b2)])) * 1.15;
      const pal = [c.accent, c.info, c.violet || c.gold, c.danger, c.gold, c.ink2, c.accent, c.info];
      plot(gv, { x: [-mx, mx], y: [-mx, mx], eq: true, xt: [], yt: [],
        series: [{ pts: pts(P.mu), color: c.muted, width: 1.6, dash: [4, 3], label: L('先验的均值', 'prior mean') },
          ...runs.map((r, k) => ({ pts: pts(r.x), color: pal[k % pal.length], width: 2.2, dots: 2.6, line: true }))],
        after: ({ ctx, X, Y }) => { if (!fixed) return; ctx.fillStyle = c.gold; for (let i = 0; i < s.n; i++) if (i === 0 || i === s.n - 1) { ctx.beginPath(); ctx.arc(X(P.mu[2 * i]), Y(P.mu[2 * i + 1]), 6, 0, 2 * Math.PI); ctx.fill(); } } });
      const path = runs[0].path, keep = path.filter((_, i) => i % Math.max(1, Math.round(path.length / 6)) === 0 || i === path.length - 1);
      plot(pv, { x: [-mx * 1.3, mx * 1.3], y: [-mx * 1.3, mx * 1.3], eq: true, xt: [], yt: [],
        series: keep.map((x, k) => ({ pts: pts(x), color: c.accent, alpha: 0.18 + (0.82 * k) / Math.max(1, keep.length - 1), width: k === keep.length - 1 ? 2.4 : 1.4 })) });
      const cov = memo(s, 'c', `${s.n}|${s.steps}|${s.mean}|${s.iso}`, () => {
        const xs = Array.from({ length: 120 }, (_, k) => M.reverseDiffusion(P, { ...opt, fixed: null, seed: 5000 + k }).x);
        const sc = M.sampleCov(xs), tr = (A) => A.reduce((t, r, i) => t + r[i], 0);
        return { rel: M.relFrob(sc.C, P.S), ratio: tr(sc.C) / tr(P.S) };
      });
      const bs = M.bondStats(runs[0].x);
      return [[L('相邻残基间距的不均匀度', 'Roughness of the spacing between neighbours'), pct(bs.rough)],
        [L('120 条样本的方差 ÷ 先验的方差', 'Variance of 120 samples ÷ prior variance'), fix(cov.ratio, 3), true],
        [L('样本协方差和先验的相对偏差', 'Relative deviation of the sample covariance'), fix(cov.rel, 3)],
        [L('采样方式', 'Sampling mode'), s.mean ? L('只用后验均值：方差被吃掉了', 'posterior mean only: variance is eaten') : L('每一步从后验抽样：精确', 'sample the posterior each step: exact')],
        [L('motif 被按住了吗', 'Is the motif held'), fixed ? L('是，其余按条件分布生长', 'yes; the rest grows from the conditional') : L('没有', 'no')]];
    },
  };

  // ── 7. 亲和力：K_D、ΔG 和“提高一百倍”要多少 kcal/mol ──────────────────
  DEMOS.kd = {
    title: L('亲和力的算术：K_D、ΔG 和“强一百倍”到底是多少', 'The arithmetic of affinity: K_D, ΔG, and what “a hundredfold tighter” really costs'),
    kind: 'exact',
    intro: L('读设计蛋白质的论文，绕不开 K_D 和 ΔG 的换算。两件事值得记住。第一，结合自由能和 K_D 是对数关系：ΔG° = RT ln K_D，室温下每差一个数量级只有 1.36 kcal/mol——也就是说，一个氢键或一个甲基的得失就能改变十倍的亲和力，这既是设计有希望的原因，也是预测很难的原因。第二，“结合得多紧”和“有没有用”是两回事：占据率由浓度和 K_D 共同决定，细胞里的浓度常常在 nM 到 µM 之间，所以 pM 的亲和力未必比 nM 更有用。拖动滑杆，看这三条曲线。', 'Reading papers on designed proteins means converting between K_D and ΔG all the time. Two things are worth remembering. First, binding free energy is logarithmic in K_D: ΔG° = RT ln K_D, and at room temperature one order of magnitude is only 1.36 kcal/mol — so gaining or losing a single hydrogen bond or methyl group can change affinity tenfold, which is both why design can work and why prediction is hard. Second, “how tightly it binds” and “whether it does anything” are different questions: occupancy depends on concentration as well as K_D, and concentrations in a cell are often nM to µM, so picomolar affinity is not necessarily more useful than nanomolar. Drag the sliders and watch the three curves.'),
    ctl: [['lkd', L('K_D', 'K_D'), -12, -3, 0.1, -9, (v) => `10^${fix(v, 1)} M`], ['lc', L('靶点或配体的浓度', 'Concentration of the target or ligand'), -11, -4, 0.1, -8, (v) => `10^${fix(v, 1)} M`], ['fold', L('设计改进了多少倍', 'Improvement factor of the design'), 1, 1000, 1, 100, (v) => `${v}×`], ['T', L('温度', 'Temperature'), 277, 323, 1, 298, (v) => `${v} K`]],
    btn: [[L('典型的第一代设计（µM）', 'A typical first-round design (µM)'), { lkd: -6 }], [L('优化过的 binder（nM）', 'An optimised binder (nM)'), { lkd: -9 }], [L('抗体级别（pM）', 'Antibody-grade (pM)'), { lkd: -11 }]],
    figs: [[0.42, L('占据率随浓度变化（金线是现在的 K_D，蓝线是改进后的）；竖线是现在的浓度。', 'Occupancy against concentration (gold is the current K_D, blue the improved one); the vertical line is the current concentration.')], ['html', L('换算表。', 'Conversion table.')]],
    note: L('ΔG° = RT ln K_D（K_D 以 mol/L 计，标准态 1 mol/L），R = 1.987 cal/(mol·K)。298.15 K 下 RT ln 10 = 1.3642 kcal/mol，所以“一个数量级 ≈ 1.36 kcal/mol”。占据率 = c / (c + K_D) 是最简单的单位点结合模型（没有协同、没有竞争、配体不耗尽）。要把抑制常数 Kᵢ 和实测的 IC₅₀ 联系起来，还要 Cheng–Prusoff 关系 IC₅₀ = Kᵢ(1 + [S]/K_m)，表里也列了。设计文章里报的亲和力取决于测法（SPR、BLI、荧光滴定），不同方法之间差两三倍是常事。', 'ΔG° = RT ln K_D (with K_D in mol/L and a 1 mol/L standard state), R = 1.987 cal/(mol·K). At 298.15 K, RT ln 10 = 1.3642 kcal/mol, which is where “one order of magnitude ≈ 1.36 kcal/mol” comes from. Occupancy = c / (c + K_D) is the simplest single-site model (no cooperativity, no competition, no ligand depletion). Relating an inhibition constant Kᵢ to a measured IC₅₀ needs the Cheng–Prusoff relation IC₅₀ = Kᵢ(1 + [S]/K_m), also tabulated. Affinities quoted in design papers depend on the method (SPR, BLI, fluorescence titration), and two- to threefold differences between methods are routine.'),
    draw(s, [ov, tv]) {
      const c = css(), kd = 10 ** s.lkd, kd2 = kd / s.fold, conc = 10 ** s.lc, T = s.T;
      const xs = lin(-13, -3, 201), f1 = xs.map((v) => M.occupancy(10 ** v, kd)), f2 = xs.map((v) => M.occupancy(10 ** v, kd2));
      plot(ov, { x: [-13, -3], y: [0, 1.02], xl: L('浓度 log₁₀(c / M)', 'concentration log₁₀(c / M)'), yl: L('占据率', 'occupancy'),
        series: [{ xs, ys: f1, color: c.gold, width: 2.4, label: L('设计前', 'before') }, { xs, ys: f2, color: c.info, width: 2.4, label: L(`强 ${s.fold} 倍`, `${s.fold}× tighter`) }],
        marks: [{ x: s.lc, y: M.occupancy(conc, kd), color: c.accent }], hmarks: [{ y: 0.5, color: c.muted }] });
      tv.innerHTML = table([L('量', 'Quantity'), L('设计前', 'Before'), L('设计后', 'After')], [
        ['K_D', `${fmt(kd * 1e9)} nM`, `${fmt(kd2 * 1e9)} nM`],
        [L('ΔG° (kcal/mol)', 'ΔG° (kcal/mol)'), fix(M.kdToDG(kd, T), 2), fix(M.kdToDG(kd2, T), 2)],
        [L('这个浓度下的占据率', 'Occupancy at this concentration'), pct(M.occupancy(conc, kd)), pct(M.occupancy(conc, kd2))],
        [L('IC₅₀（[S] = K_m 时，Cheng–Prusoff）', 'IC₅₀ (at [S] = K_m, Cheng–Prusoff)'), `${fmt(M.chengPrusoff(kd, 1, 1) * 1e9)} nM`, `${fmt(M.chengPrusoff(kd2, 1, 1) * 1e9)} nM`],
      ]);
      return [[L('一个数量级值多少自由能', 'What one order of magnitude is worth'), `${fix(M.kcalPerDecade(T), 4)} kcal/mol`, true],
        [L(`强 ${s.fold} 倍需要`, `${s.fold}× tighter costs`), `${fix(M.ddGForFold(s.fold, T), 2)} kcal/mol`, true],
        [L('设计前 / 后的占据率', 'Occupancy before / after'), `${pct(M.occupancy(conc, kd))} → ${pct(M.occupancy(conc, kd2))}`],
        [L('占据率到 50 % 需要的浓度', 'Concentration for 50 % occupancy'), `${fmt(kd * 1e9)} nM`],
        [L('一个氢键大约值', 'A hydrogen bond is worth roughly'), L('0.5–2 kcal/mol，也就是 2–20 倍', '0.5–2 kcal/mol, i.e. 2–20×')]];
    },
  };

  // ── 8. 酶：ΔΔG‡ 和速率 ───────────────────────────────────────────────
  DEMOS.kcat = {
    title: L('为什么从头设计的酶总是很慢：ΔΔG‡ 和速率的指数关系', 'Why de novo enzymes are slow: the exponential link between ΔΔG‡ and rate'),
    kind: 'exact',
    intro: L('从头设计的酶和天然酶的差距常常被写成“慢了四个数量级”。换算成能量只有 5.5 kcal/mol——比一个氢键多一点。过渡态理论说速率 ∝ exp(−ΔG‡/RT)，所以每 1.36 kcal/mol 就是十倍。这个指数关系是两面的：它解释了为什么天然酶能快十几个数量级（把过渡态稳定住 20 kcal/mol 就够了），也解释了为什么设计很难（算错 2 kcal/mol 就差一百倍，而今天的打分函数误差正好是这个量级）。拖动滑杆看 k_cat、垒高和与天然酶的差距怎么互相换算，并看定向进化的几轮改进叠起来是多少。', 'The gap between a de novo enzyme and a natural one is often written as “four orders of magnitude slower”. In energy that is only 5.5 kcal/mol — a little more than one hydrogen bond. Transition-state theory says the rate ∝ exp(−ΔG‡/RT), so every 1.36 kcal/mol is a factor of ten. The exponential cuts both ways: it explains how natural enzymes reach accelerations of ten-plus orders of magnitude (stabilise the transition state by 20 kcal/mol and you are there), and why design is hard (be wrong by 2 kcal/mol and you are off by a hundredfold — which is exactly the error of today’s scoring functions). Drag the sliders to convert between k_cat, barrier height and the gap to a natural enzyme, and see what a few rounds of directed evolution add up to.'),
    ctl: [['dG', L('过渡态的垒 ΔG‡', 'Barrier ΔG‡'), 10, 26, 0.1, 20, (v) => `${fix(v, 1)} kcal/mol`], ['ddG', L('设计让垒降低了', 'The design lowers the barrier by'), 0, 12, 0.1, 6, (v) => `${fix(v, 1)} kcal/mol`], ['rounds', L('定向进化做了几轮', 'Rounds of directed evolution'), 0, 8, 1, 4, String], ['per', L('每轮平均改进', 'Average gain per round'), 0.3, 2.5, 0.1, 1, (v) => `${fix(v, 1)} kcal/mol`], ['T', L('温度', 'Temperature'), 277, 333, 1, 298, (v) => `${v} K`]],
    btn: [[L('没有催化的反应', 'The uncatalysed reaction'), { dG: 24, ddG: 0 }], [L('第一代设计', 'A first-generation design'), { dG: 24, ddG: 6 }], [L('天然酶的水平', 'Natural-enzyme level'), { dG: 24, ddG: 16 }]],
    figs: [[0.42, L('速率随垒高变化（对数坐标）；金点是现在的垒，蓝点是设计后的，灰点是定向进化之后的。', 'Rate against barrier height (log scale); gold is the current barrier, blue after design, grey after directed evolution.')], ['html', L('换算表。', 'Conversion table.')]],
    note: L('过渡态理论（Eyring）：k = (k_B T / h)·exp(−ΔG‡/RT)，前因子 k_B T / h 在 298 K 下是 6.2 × 10^12 s⁻¹。这里只算单分子的速率常数，真实的 k_cat 还要除掉结合和产物释放这些步骤，而且常常不是化学步控速，所以这张表只用来换算量级。每 1.3642 kcal/mol 正好一个数量级（298.15 K）。“每轮改进叠加”按能量相加算，真实的定向进化里突变之间有上位效应，往往叠不满。', 'Transition-state (Eyring) theory: k = (k_B T / h)·exp(−ΔG‡/RT), with the prefactor k_B T / h = 6.2 × 10^12 s⁻¹ at 298 K. Only the unimolecular rate constant is computed here; a real k_cat also contains binding and product release, and the chemical step is often not rate-limiting, so read the table for orders of magnitude only. One decade is exactly 1.3642 kcal/mol at 298.15 K. “Rounds add up” simply sums energies; in real directed evolution mutations are epistatic and rarely add in full.'),
    draw(s, [rv, tv]) {
      const c = css(), T = s.T, after = s.dG - s.ddG, evo = after - M.stack(Array.from({ length: s.rounds }, () => s.per), 1);
      const xs = lin(8, 28, 201), ys = xs.map((v) => Math.log10(M.eyring(v, T)));
      plot(rv, { x: [8, 28], y: [Math.min(...ys), Math.max(...ys)], xl: L('ΔG‡ (kcal/mol)', 'ΔG‡ (kcal/mol)'), yl: L('log₁₀(k / s⁻¹)', 'log₁₀(k / s⁻¹)'),
        series: [{ xs, ys, color: c.accent, width: 2.4 }],
        marks: [{ x: s.dG, y: Math.log10(M.eyring(s.dG, T)), color: c.gold }, { x: after, y: Math.log10(M.eyring(after, T)), color: c.info }, { x: evo, y: Math.log10(M.eyring(evo, T)), color: c.muted }] });
      const k = (v) => M.eyring(v, T);
      tv.innerHTML = table([L('阶段', 'Stage'), L('ΔG‡ (kcal/mol)', 'ΔG‡ (kcal/mol)'), L('速率 (s⁻¹)', 'Rate (s⁻¹)'), L('比上一行快', 'Faster than the row above')], [
        [L('没有催化', 'Uncatalysed'), fix(s.dG, 1), fmt(k(s.dG)), '—'],
        [L('设计出来的', 'Designed'), fix(after, 1), fmt(k(after)), `${fmt(k(after) / k(s.dG))}×`],
        [L(`定向进化 ${s.rounds} 轮后`, `After ${s.rounds} rounds of evolution`), fix(evo, 1), fmt(k(evo)), `${fmt(k(evo) / k(after))}×`],
      ]);
      return [[L('一个数量级的速率 = 多少能量', 'One decade of rate equals'), `${fix(M.kcalPerDecade(T), 4)} kcal/mol`, true],
        [L('设计带来的加速', 'Acceleration from the design'), `${fmt(M.rateRatio(s.ddG, T))}×`, true],
        [L('打分函数错 2 kcal/mol 相当于', 'A 2 kcal/mol scoring error is'), `${fmt(M.rateRatio(2, T))}×`],
        [L('定向进化又拿到', 'Directed evolution adds'), `${fmt(M.rateRatio(s.rounds * s.per, T))}×`],
        [L('还差天然酶多少', 'Still short of a natural enzyme by'), `${fix(Math.max(0, evo - 8), 1)} kcal/mol`]];
    },
  };

  // ── 9. 筛选的贝叶斯：为什么“过滤器”决定命中率 ──────────────────────────
  DEMOS.screen = {
    title: L('命中率的贝叶斯算术：为什么过滤器比生成器更决定成败', 'The Bayesian arithmetic of hit rates: why the filter decides more than the generator'),
    kind: 'exact',
    intro: L('“我们设计了 96 个，有 8 个能结合”——这个 8 % 是从哪里来的？它几乎不取决于生成模型有多好，而取决于三件事：先验命中率（随便设计一个能成的概率）、过滤器的分辨力（能把成的和不成的分开多少，用 d′ 表示）和阈值卡在哪。这个演示把这三件事放在一起算：先验 1 %、过滤器 AUC 0.92（相当于 d′ = 2）、只留分数前 7 % 的设计，命中率就能到 9 %——富集了九倍，但远不是“模型会设计蛋白质了”。把过滤器调好一点，命中率立刻翻倍；把先验调低十倍，又回去了。2026 年的几篇报告里，真正变强的往往正是这个过滤器（结构预测和亲和力预测模型）。', '“We designed 96 and 8 of them bound” — where does that 8 % come from? It barely depends on how good the generator is. It depends on three things: the prior hit rate (the chance that a design works at all), the resolving power of the filter (how well it separates winners from losers, written d′) and where the threshold sits. This demo puts the three together: a 1 % prior, a filter with AUC 0.92 (that is d′ = 2) and keeping only the top 7 % of scores gives a 9 % hit rate — a ninefold enrichment, but a long way from “the model can design proteins”. Improve the filter a little and the hit rate doubles; lower the prior tenfold and it is back where it started. In several 2026 reports what actually got stronger was exactly this filter (structure and affinity prediction).'),
    ctl: [['lp', L('先验命中率', 'Prior hit rate'), -4, -0.5, 0.1, -2, (v) => pct(10 ** v)], ['auc', L('过滤器的 AUC', 'AUC of the filter'), 0.55, 0.99, 0.01, 0.92, (v) => v.toFixed(2)], ['t', L('阈值（卡得多严）', 'Threshold (how strict)'), -1, 4, 0.1, 1.5, (v) => fix(v, 1)], ['made', L('实验里做几个', 'Designs taken to the bench'), 8, 384, 8, 96, String]],
    btn: [[L('2023 年的典型数字', 'Typical of 2023'), { lp: -2.3, auc: 0.85, t: 2 }], [L('过滤器变强', 'A stronger filter'), { lp: -2.3, auc: 0.96, t: 2 }], [L('先验变好（靶点好做）', 'A better prior (an easy target)'), { lp: -1.2, auc: 0.9, t: 1.5 }]],
    figs: [[0.42, L('两堆设计的分数分布（蓝=不结合，金=结合，面积按先验缩放），竖线是阈值。', 'Score distributions of the two populations (blue = non-binders, gold = binders, areas scaled by the prior); the vertical line is the threshold.')], ['html', L('一次实验的账。', 'The books for one experiment.')]],
    note: L('信号检测模型：能结合的设计分数 ~ N(d′, 1)，不能的 ~ N(0, 1)，所以 AUC = Φ(d′/√2)，d′ = √2·Φ⁻¹(AUC)。命中率（阳性预测值）= 先验·灵敏度 / (先验·灵敏度 + (1 − 先验)·误报率)。“至少拿到一个”的数量按几何分布算：n = ⌈ln 0.05 / ln(1 − 命中率)⌉（95 % 的把握）。真实的筛选是多层的（结构预测、界面打分、亲和力预测），各层不独立，见“分层筛查”那个演示。这个模型解释不了的东西也要说清楚：它假设分数的分布是正态且等方差，真实分数常常有长尾。', 'A signal-detection model: binders score ~ N(d′, 1) and non-binders ~ N(0, 1), so AUC = Φ(d′/√2) and d′ = √2·Φ⁻¹(AUC). The hit rate (positive predictive value) is prior·sensitivity / (prior·sensitivity + (1 − prior)·false-positive rate). The number needed for “at least one hit” follows the geometric distribution: n = ⌈ln 0.05 / ln(1 − hit rate)⌉ for 95 % confidence. Real screening is layered (structure prediction, interface scoring, affinity prediction) and the layers are not independent — see the layered-screening demo. What this model cannot capture should be said too: it assumes normal, equal-variance scores, while real scores often have long tails.'),
    draw(s, [dv, tv]) {
      const c = css(), prior = 10 ** s.lp, dp = M.dprimeFromAuc(s.auc);
      const f = M.funnel({ prior, dprime: dp, t: s.t, made: s.made });
      const xs = lin(-4, 7, 221), g = (x, m) => Math.exp(-0.5 * (x - m) ** 2) / Math.sqrt(2 * Math.PI);
      const neg = xs.map((x) => (1 - prior) * g(x, 0)), pos = xs.map((x) => prior * g(x, dp));
      const sc = Math.max(...pos) || 1;
      plot(dv, { x: [-4, 7], y: [0, Math.max(...neg) * 1.1], xl: L('过滤器给的分数', 'score from the filter'), yl: L('密度', 'density'), yt: [],
        series: [{ xs, ys: neg, color: c.info, width: 2, fill: true, label: L('不结合', 'non-binders') }, { xs, ys: pos.map((v) => (v / sc) * Math.max(...neg) * 0.45), color: c.gold, width: 2.2, fill: true, label: L('能结合（已放大）', 'binders (scaled up)') }],
        marks: [{ x: s.t, color: c.danger }] });
      tv.innerHTML = table([L('一步', 'Step'), L('数', 'Number')], [
        [L('生成并打分的设计', 'Designs generated and scored'), fmt(Math.round(s.made / Math.max(f.keptFrac, 1e-9)))],
        [L('过了阈值的', 'Passing the threshold'), fmt(s.made)],
        [L('其中真的能结合', 'Of those, real binders'), fix(f.hits, 1)],
        [L('不过滤直接做同样多个', 'Same number with no filter at all'), fix(s.made * prior, 2)],
        [L('95 % 把握拿到一个要做几个', 'Designs needed for 95 % confidence of one hit'), Number.isFinite(f.needed) ? `${f.needed}` : '—'],
      ]);
      return [[L('过滤器的 d′', 'd′ of the filter'), fix(dp, 2)],
        [L('实验里的命中率', 'Hit rate at the bench'), pct(f.ppv), true],
        [L('比不过滤富集了', 'Enrichment over no filter'), `${fmt(f.enrich)}×`, true],
        [L('留下的比例', 'Fraction kept'), pct(f.keptFrac)],
        [L('做 ' + s.made + ' 个预期拿到', `Expected hits from ${s.made}`), fix(f.hits, 1)]];
    },
  };

  // ── 10. 定向进化 vs 模型引导 ──────────────────────────────────────────
  DEMOS.evo = {
    title: L('同样的实验预算：定向进化、随机试和模型引导哪个好', 'The same budget of experiments: directed evolution, random search, or model-guided'),
    kind: 'experiment',
    intro: L('实验是有限的。假设你能测 100 条序列，怎么花？定向进化的做法是爬山：测当前最好那条的全部单点突变，走到最好的一个，再来一轮——简单、可靠，但会卡在局部极大。模型引导的做法是：先随机测几十条，拟合一个替代模型（这里是带两位点交互项的岭回归），用它预测全部序列，只去测预测最好的那十几条,再更新模型。在这个 NK 适应度面上（位置之间有上位效应，局部极大有几十个），模型引导通常赢，因为它能跳。但把崎岖程度调到最大，替代模型就学不出东西了，爬山反而更稳——这正是“什么时候该相信模型”的实验版。', 'Experiments are finite. Suppose you can measure 100 sequences; how do you spend them? Directed evolution climbs: measure every single mutant of the current best, move to the best one, repeat — simple, reliable, and it gets stuck on local maxima. Model-guided design instead measures a few dozen at random, fits a surrogate (here ridge regression with pairwise terms), predicts all sequences, and spends the next batch only on the top predictions before updating the model. On this NK landscape (positions interact epistatically and there are dozens of local maxima) the model-guided strategy usually wins, because it can jump. But turn the ruggedness up to the maximum and the surrogate learns nothing, so hill-climbing becomes the safer bet — the experimental version of “when should you trust the model”.'),
    ctl: [['Lp', L('位置数', 'Positions'), 10, 14, 1, 14, String], ['Kk', L('崎岖程度 K（每个位置和几个邻居耦合）', 'Ruggedness K (neighbours each position couples to)'), 0, 6, 1, 3, String], ['budget', L('能测几条序列', 'Sequences you can measure'), 40, 200, 10, 100, String]],
    chk: [['pair', L('模型带两位点交互项', 'Surrogate includes pairwise terms'), true]],
    btn: [[L('平滑（K = 0）', 'Smooth (K = 0)'), { Kk: 0 }], [L('有上位效应（K = 3）', 'Epistatic (K = 3)'), { Kk: 3 }], [L('很崎岖（K = 6）', 'Very rugged (K = 6)'), { Kk: 6 }]],
    act: [[L('换一个适应度面', 'Another landscape'), (s) => { s.seed = (s.seed || 1) + 1; }]],
    state: () => ({ seed: 1 }),
    figs: [[0.45, L('三种策略找到的最好适应度随测量次数变化；灰色虚线是穷举出来的全局最优。', 'Best fitness found against the number of measurements; the dashed grey line is the global optimum found by enumeration.')], ['html', L('花完预算的结果。', 'Where each strategy ends up.')]],
    note: L('Kauffman 的 NK 模型：每个位置的贡献由它自己和后面 K 个位置决定，表里的值是均匀随机数，适应度是全部贡献的平均。位置只有两种残基，所以 2^L 条序列可以穷举，全局最优和局部极大的个数都是精确的。定向进化这里用确定性的爬山（每轮 L 次测量，三个随机起点里取最好），真实的实验还有文库构建偏差和测量噪声。模型引导用 kriging believer 式的批量选择（不估不确定度，只挑预测最好的），真实的做法会用高斯过程的置信上界或汤普森采样。', 'Kauffman’s NK model: each position’s contribution depends on itself and the next K positions, table values are uniform random numbers, and fitness is the mean contribution. With two residues per position all 2^L sequences can be enumerated, so the global optimum and the number of local maxima are exact. Directed evolution is deterministic hill-climbing here (L measurements per round, best of three random starts); real experiments also have library-construction bias and measurement noise. The model-guided strategy picks batches kriging-believer style (no uncertainty estimate, just the top predictions); real campaigns would use a Gaussian-process upper confidence bound or Thompson sampling.'),
    draw(s, [cv, tv]) {
      const c = css();
      const D = memo(s, 'l', `${s.Lp}|${s.Kk}|${s.seed}|${s.budget}|${s.pair}`, () => {
        const land = M.nkLandscape(s.Lp, s.Kk, s.seed);
        const starts = [0, Math.floor((1 << s.Lp) / 3), Math.floor((2 * (1 << s.Lp)) / 3)];
        const evos = starts.map((st) => M.evoWalk(land, { start: st, budget: Math.floor(s.budget / 3) }));
        const ev = evos.reduce((a, b) => (b.best > a.best ? b : a));
        const n0 = Math.min(Math.round(s.budget * 0.4), s.budget - 10), m = Math.max(5, Math.round((s.budget - n0) / 4));
        return { land, ev, evos, mg: M.modelGuided(land, { n0, m, rounds: 4, pair: s.pair, seed: s.seed }), rs: M.randomSearch(land, { budget: s.budget, seed: s.seed + 99 }), n0, m };
      });
      const { land, ev, mg, rs } = D;
      const curve = (q) => ({ xs: q.curve.map((p) => p.n), ys: q.curve.map((p) => p.f) });
      const lo = Math.min(...[ev, mg, rs].flatMap((q) => q.curve.map((p) => p.f))) - 0.01;
      plot(cv, { x: [0, s.budget], y: [lo, land.bestF + 0.01], xl: L('测过多少条序列', 'sequences measured'), yl: L('找到的最好适应度', 'best fitness found'),
        series: [{ ...curve(ev), color: c.accent, width: 2.4, dots: 3, line: true, label: L('定向进化（爬山）', 'directed evolution') },
          { ...curve(mg), color: c.info, width: 2.4, dots: 3, line: true, label: L('模型引导', 'model-guided') },
          { ...curve(rs), color: c.muted, width: 2, label: L('随机试', 'random search') }],
        hmarks: [{ y: land.bestF, color: c.gold }] });
      const gap = (q) => pct((land.bestF - q.best) / land.bestF);
      tv.innerHTML = table([L('策略', 'Strategy'), L('最好的适应度', 'Best fitness'), L('离全局最优', 'Gap to the optimum'), L('怎么花的预算', 'How the budget was spent')], [
        [L('定向进化', 'Directed evolution'), fix(ev.best, 4), gap(ev), L(`每轮 ${s.Lp} 条，三个起点`, `${s.Lp} per round, three starts`)],
        [L('模型引导', 'Model-guided'), fix(mg.best, 4), gap(mg), L(`先随机 ${D.n0} 条，再 4 批各 ${D.m} 条`, `${D.n0} random, then 4 batches of ${D.m}`)],
        [L('随机试', 'Random search'), fix(rs.best, 4), gap(rs), L(`${s.budget} 条随机`, `${s.budget} random`)],
      ]);
      const win = [[L('定向进化', 'directed evolution'), ev.best], [L('模型引导', 'model-guided'), mg.best], [L('随机试', 'random search'), rs.best]].sort((a, b) => b[1] - a[1])[0][0];
      return [[L('全局最优（穷举出来的）', 'Global optimum (by enumeration)'), fix(land.bestF, 4)],
        [L('这个面上有多少个局部极大', 'Local maxima on this landscape'), fmt(land.local), true],
        [L('这一局谁赢', 'Winner this time'), win, true],
        [L('定向进化卡住了吗', 'Did hill-climbing get stuck'), ev.stuck ? L('卡在局部极大', 'yes, on a local maximum') : L('走到了全局最优', 'no, it reached the optimum')],
        [L('可能的序列总数', 'Total sequences possible'), fmt(2 ** s.Lp)]];
    },
  };

  // ── 11. 分层筛查：为什么一层不够 ──────────────────────────────────────
  DEMOS.layers = {
    title: L('分层筛查的算术：为什么一道关卡不够，以及相关失效会吃掉多少', 'The arithmetic of layered screening: why one gate is not enough, and what correlated failure eats'),
    kind: 'exact',
    intro: L('合成生物学的生物安全不是靠一道关卡，而是靠几道独立的关卡叠起来：合成公司筛查订单的序列、云实验室核对客户身份、模型提供方做自己的检查、期刊和基金会要求说明。这个演示只做一件事：把“几道关卡”的算术算清楚。如果每道关卡独立，总漏检率是各自漏检率的乘积，三道 90 % 的关卡合起来漏掉 0.1 %；但如果它们都依赖同一个序列数据库，一条绕过那个数据库的序列会同时骗过三道——这时总的灵敏度就塌回最好的那一道。这个差别（0.1 % 对 10 %）是生物安全文献里最常被引用的一条定量结论，也是“多样性比数量重要”的理由。', 'Biosecurity in synthetic biology does not rest on one gate but on several independent ones stacked up: synthesis companies screen ordered sequences, cloud labs verify customer identity, model providers run their own checks, journals and funders ask for justification. This demo does one thing: get the arithmetic of “several gates” right. If the gates are independent, the overall miss rate is the product of the individual ones, and three gates at 90 % each miss only 0.1 %; but if they all lean on the same sequence database, anything that slips past that database fools all three at once — and the overall sensitivity collapses back to the best single gate. That difference (0.1 % versus 10 %) is the most-quoted quantitative conclusion in the biosecurity literature, and the reason diversity of checks matters more than their number.'),
    ctl: [['a', L('第一道：合成订单筛查', 'Gate 1: synthesis order screening'), 0.5, 0.995, 0.005, 0.9, pct], ['b', L('第二道：客户与机构核验', 'Gate 2: customer and institution checks'), 0.5, 0.995, 0.005, 0.85, pct], ['c', L('第三道：模型提供方的检查', 'Gate 3: the model provider’s own checks'), 0.5, 0.995, 0.005, 0.8, pct], ['n', L('一年有多少次请求（示意）', 'Requests per year (illustrative)'), 3, 7, 1, 6, (v) => `10^${v}`]],
    chk: [['corr', L('三道关卡依赖同一个数据库（相关失效）', 'All three lean on the same database (correlated failure)'), false]],
    btn: [[L('三道都很强', 'Three strong gates'), { a: 0.95, b: 0.95, c: 0.95, corr: false }], [L('相关失效', 'Correlated failure'), { a: 0.95, b: 0.95, c: 0.95, corr: true }], [L('只有一道', 'Only one gate'), { a: 0.9, b: 0, c: 0, corr: false }]],
    figs: [[0.42, L('总体灵敏度随“再加一道关卡”变化：独立（实线）和完全相关（虚线）。', 'Overall sensitivity as gates are added: independent (solid) and fully correlated (dashed).')], ['html', L('每一道关卡再提高一个百分点，总体能少漏多少（边际收益）。', 'What one more percentage point at each gate buys in misses avoided (marginal value).')]],
    note: L('独立假设下总体灵敏度 = 1 − Π(1 − sᵢ)；完全相关时 = max sᵢ。真实世界在两者之间，而且各道关卡的灵敏度本身没有公开的实测值，这里的数字是你自己拖出来的假设，不是任何机构的实际表现。请求数只是用来把漏检率换成一个好理解的数字。这个演示不涉及任何绕过筛查的方法，也不涉及任何具体的危险序列：它只算概率。相关的公开框架有国际基因合成联盟（IGSC）的统一筛查协议、美国 2023 年的行政命令和 2024 年的 OSTP 合成核酸筛查框架。', 'Under independence the overall sensitivity is 1 − Π(1 − sᵢ); under full correlation it is max sᵢ. Reality lies between, and the individual sensitivities have no published measured values — the numbers here are assumptions you dragged in, not any organisation’s actual performance. The request count only turns a miss rate into something easier to picture. This demo involves no method of evading screening and no specific hazardous sequence: it computes probabilities only. Relevant public frameworks include the International Gene Synthesis Consortium’s Harmonized Screening Protocol, the 2023 US executive order and the 2024 OSTP framework for synthetic nucleic acid screening.'),
    draw(s, [sv, tv]) {
      const c = css(), sens = [s.a, s.b, s.c].filter((v) => v > 0);
      const seq = sens.map((_, k) => M.layered(sens.slice(0, k + 1)));
      const xs = seq.map((_, k) => k + 1);
      plot(sv, { x: [1, Math.max(2, sens.length)], y: [0.4, 1.005], xl: L('几道关卡', 'number of gates'), yl: L('总体灵敏度', 'overall sensitivity'),
        series: [{ xs, ys: seq.map((q) => q.indep), color: c.accent, width: 2.4, dots: 4, line: true, label: L('独立', 'independent') },
          { xs, ys: seq.map((q) => q.correlated), color: c.danger, width: 2.2, dash: [5, 4], dots: 4, line: true, label: L('完全相关', 'fully correlated') }] });
      const now = M.layered(sens), eff = s.corr ? now.correlated : now.indep;
      tv.innerHTML = table([L('关卡', 'Gate'), L('灵敏度', 'Sensitivity'), L('再提高 1 个百分点，总体少漏', 'One more point here avoids')], [
        [L('合成订单筛查', 'Synthesis order screening'), pct(s.a), s.corr ? L('没有改善（相关失效）', 'nothing (correlated failure)') : fmt(M.marginal(sens, 0) * 10 ** s.n) + L(' 次 / 年', ' per year')],
        [L('客户与机构核验', 'Customer and institution checks'), pct(s.b), s.corr ? L('没有改善（相关失效）', 'nothing (correlated failure)') : fmt(M.marginal(sens, 1) * 10 ** s.n) + L(' 次 / 年', ' per year')],
        [L('模型提供方的检查', 'The model provider’s own checks'), pct(s.c), s.corr ? L('没有改善（相关失效）', 'nothing (correlated failure)') : fmt(M.marginal(sens, Math.min(2, sens.length - 1)) * 10 ** s.n) + L(' 次 / 年', ' per year')],
      ]);
      return [[L('独立时的总体灵敏度', 'Overall sensitivity if independent'), pct(now.indep), true],
        [L('完全相关时', 'If fully correlated'), pct(now.correlated), true],
        [L('最弱的一道', 'The weakest gate'), pct(now.weakest)],
        [L(`10^${s.n} 次请求里漏掉`, `Misses out of 10^${s.n} requests`), fmt(M.missPerMillion(eff, 10 ** s.n))],
        [L('差别', 'The difference'), `${fmt(M.missPerMillion(now.correlated, 10 ** s.n) / Math.max(1e-9, M.missPerMillion(now.indep, 10 ** s.n)))}×`]];
    },
  };

  // ── 12. 稳定性：ΔΔG 和熔解温度 ───────────────────────────────────────
  DEMOS.stab = {
    title: L('为什么设计出来的蛋白质常常“太稳定”：ΔΔG 和熔解温度', 'Why designed proteins are often “too stable”: ΔΔG and the melting temperature'),
    kind: 'exact',
    intro: L('从头设计的蛋白质有一个出名的特点：往往比天然的同类稳定得多，熔解温度常常在 90 °C 以上，有的在沸水里都不变性。原因不神秘——设计的时候就是在挑“折叠得最稳”的序列，而天然蛋白质要在稳定性、柔性、可降解性和功能之间折中。这个演示用最简单的两态折叠模型，把 ΔΔG（设计多出来的稳定性）换算成熔解温度的变化，并显示一个常被忽略的事实：ΔΔG 到 T_m 的换算系数大约是 1 °C 每 0.3 kcal/mol，所以“稳定 3 kcal/mol”听起来不多，其实是十几度。另外看“叠加打折”那个滑杆：真实的稳定化突变叠起来总是打折（上位效应），这是蛋白质工程里最可靠的经验之一。', 'De novo designed proteins are famous for one thing: they are often far more stable than their natural counterparts, with melting temperatures above 90 °C and some that survive boiling. The reason is no mystery — design selects for the sequence that folds most stably, while natural proteins compromise between stability, flexibility, degradability and function. This demo uses the simplest two-state folding model to convert ΔΔG (the extra stability of a design) into a shift in melting temperature, and shows a fact that is easy to miss: the conversion is roughly 1 °C per 0.3 kcal/mol, so “3 kcal/mol more stable” sounds small but is more than ten degrees. Then try the “diminishing returns” slider: real stabilising mutations always add up to less than their sum (epistasis), one of the most reliable rules of thumb in protein engineering.'),
    ctl: [['Tm', L('出发点的熔解温度', 'Starting melting temperature'), 300, 360, 1, 330, (v) => `${v} K (${fix(v - 273.15, 0)} °C)`], ['dHm', L('折叠的焓 ΔH_m', 'Enthalpy of folding ΔH_m'), 40, 160, 5, 90, (v) => `${v} kcal/mol`], ['nmut', L('叠了几个稳定化突变', 'Stabilising mutations stacked'), 1, 10, 1, 4, String], ['each', L('每个单独测是多少', 'Each one alone is worth'), 0.2, 2, 0.1, 0.8, (v) => `${fix(v, 1)} kcal/mol`], ['addf', L('叠加的打折（上位效应）', 'Diminishing returns (epistasis)'), 0.4, 1, 0.05, 0.8, (v) => `×${fix(v, 2)}`]],
    btn: [[L('一个天然的小结构域', 'A natural small domain'), { Tm: 330, dHm: 90 }], [L('一个从头设计的', 'A de novo design'), { Tm: 360, dHm: 110 }], [L('理想叠加（没有上位效应）', 'Ideal additivity (no epistasis)'), { addf: 1 }]],
    figs: [[0.42, L('折叠比例随温度变化：灰线是出发点，金线是叠上稳定化突变以后的。', 'Folded fraction against temperature: grey is the starting point, gold after the stabilising mutations.')], ['html', L('一个一个叠上去。', 'Stacking them one at a time.')]],
    note: L('两态折叠，Gibbs–Helmholtz：ΔG_unfold(T) = ΔH_m(1 − T/T_m) − ΔC_p[(T_m − T) + T ln(T/T_m)]，ΔC_p = 1.5 kcal/(mol·K)。折叠比例 = 1/(1 + exp(−ΔG/RT))，T_m 处正好一半。小 ΔΔG 时 ΔT_m ≈ ΔΔG·T_m/ΔH_m（表里同时给了精确解和这个近似），所以 T_m 越高、ΔH_m 越大，同样的 ΔΔG 换来的度数越少。叠加按 ΔΔG_total = Σ ΔΔGᵢ·折扣^i 算，这只是一个最粗的上位效应模型；真实的稳定化突变可以互相抵消，也可以协同。真实的测量用差示扫描量热或圆二色，而且不少设计蛋白质其实是不可逆变性的，两态模型只是近似。', 'Two-state folding, Gibbs–Helmholtz: ΔG_unfold(T) = ΔH_m(1 − T/T_m) − ΔC_p[(T_m − T) + T ln(T/T_m)] with ΔC_p = 1.5 kcal/(mol·K). The folded fraction is 1/(1 + exp(−ΔG/RT)), exactly one half at T_m. For small ΔΔG, ΔT_m ≈ ΔΔG·T_m/ΔH_m (the table gives both the exact value and this approximation), so the higher T_m and the larger ΔH_m, the fewer degrees the same ΔΔG buys. Stacking uses ΔΔG_total = Σ ΔΔGᵢ·discount^i, the crudest possible epistasis model; real stabilising mutations can cancel or act synergistically. Real measurements use differential scanning calorimetry or circular dichroism, and many designed proteins in fact unfold irreversibly, so two-state is only an approximation.'),
    draw(s, [fv, tv]) {
      const c = css(), p = { Tm: s.Tm, dHm: s.dHm, dCp: 1.5 };
      const dd = M.stack(Array.from({ length: s.nmut }, () => s.each), s.addf);
      const sh = M.tmShift(dd, p), Ts = lin(280, 390, 221);
      plot(fv, { x: [280, 390], y: [0, 1.02], xl: L('温度 / K', 'temperature / K'), yl: L('折叠的比例', 'folded fraction'),
        series: [{ xs: Ts, ys: Ts.map((T) => M.foldedFrac(T, p)), color: c.muted, width: 2.2, label: L('出发点', 'starting point') },
          { xs: Ts, ys: Ts.map((T) => M.foldedFrac(T, { ...p, Tm: sh.Tm })), color: c.gold, width: 2.4, label: L('叠了突变以后', 'after the mutations') }],
        marks: [{ x: s.Tm, y: 0.5, color: c.muted }, { x: sh.Tm, y: 0.5, color: c.gold }], hmarks: [{ y: 0.5, color: c.line }] });
      const rows = Array.from({ length: s.nmut }, (_, k) => {
        const d = M.stack(Array.from({ length: k + 1 }, () => s.each), s.addf), q = M.tmShift(d, p);
        return [`${k + 1}`, fix(d, 2), fix(q.Tm - 273.15, 1), `+${fix(q.dTm, 1)}`, `+${fix(k + 1 === 1 ? q.dTm : q.dTm - M.tmShift(M.stack(Array.from({ length: k }, () => s.each), s.addf), p).dTm, 2)}`];
      });
      tv.innerHTML = table([L('叠到第几个', 'Mutations'), L('累计 ΔΔG (kcal/mol)', 'Cumulative ΔΔG (kcal/mol)'), L('T_m (°C)', 'T_m (°C)'), L('比出发点高', 'Above the start'), L('这一个带来的', 'Added by this one')], rows);
      return [[L('累计的 ΔΔG', 'Cumulative ΔΔG'), `${fix(dd, 2)} kcal/mol（${L('理想叠加是', 'ideal additivity would give')} ${fix(s.nmut * s.each, 2)}）`, true],
        [L('新的熔解温度', 'New melting temperature'), `${fix(sh.Tm - 273.15, 1)} °C`, true],
        [L('升高了', 'Shift'), `${fix(sh.dTm, 1)} K（${L('近似式给', 'the approximation gives')} ${fix(sh.approx, 1)}）`],
        [L('每 kcal/mol 换来多少度', 'Degrees per kcal/mol'), `${fix(sh.dTm / Math.max(1e-9, dd), 2)} K`],
        [L('37 °C 下折叠的比例', 'Folded fraction at 37 °C'), pct(M.foldedFrac(310.15, { ...p, Tm: sh.Tm }))]];
    },
  };
};
