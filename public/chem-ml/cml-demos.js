'use strict';
// 化学机器学习（/chem-ml/）的十七个演示。数学都在 cml-models.js（纯函数，tools/chemml-test.mjs 测）。cml.js 用 window.MOLASTRIA_CHEMML_DEMOS(K, DEMOS) 把它们登记进去。
// 写法同群论的 gt-demos.js：title，kind，intro，sel，ctl，chk，btn，act，state，autoplay，fps + tick(s)，changed，figs，note，draw(s, 图, 颜色) 返回读数。
// 读数的值按 HTML 放进页面，只放这里自己算出来的数字和固定的文字。'html' 图里的内容也只用这里的固定文字、算出来的数字和 esc() 过的用户输入拼。
// 耗时的数值实验（学习曲线、贝叶斯优化的多次重复、批量实验）按参数缓存，同样的参数只算一次。
window.MOLASTRIA_CHEMML_DEMOS = (K, DEMOS) => {
  const M = window.MOLASTRIA_CHEMML_MODELS;
  const { L, fix, fmt, plot, fit, lin, font, esc, cells } = K;
  const memo = new Map();
  const cache = (key, fn) => { if (!memo.has(key)) { if (memo.size > 60) memo.clear(); memo.set(key, fn()); } return memo.get(key); };
  const pct = (v) => `${(100 * v).toFixed(0)} %`;
  const range = M.range;
  // 画布坐标 → 数据坐标（和 plot() 的边距一致：左 50、右 12、上 26、下 36）
  const toData = (cv, e, x, y) => { const r = cv.getBoundingClientRect(), k = cv.clientWidth / r.width, px = (e.clientX - r.left) * k, py = (e.clientY - r.top) * k, W = cv.clientWidth - 62, H = cv.clientHeight - 62; return [x[0] + ((px - 50) / W) * (x[1] - x[0]), y[1] - ((py - 26) / H) * (y[1] - y[0])]; };

  // ── 画分子图（二维摆放，原子按元素着色，可高亮一组原子）──────────────
  const ECOL = { C: '#5c636a', N: '#4263eb', O: '#e03131', S: '#e0a800', P: '#f08c00', F: '#2b8a3e', Cl: '#2f9e44', Br: '#a5432a', I: '#7048e8', B: '#c2255c' };
  function drawMol(cv, mol, c, opt = {}) {
    const { ctx, w, h } = fit(cv);
    if (!mol || !mol.ok) { ctx.fillStyle = c.muted; ctx.font = font(13); ctx.textAlign = 'center'; ctx.fillText(L('读不通这个 SMILES', 'This SMILES could not be read'), w / 2, h / 2); return; }
    const P = opt.pos || M.layout2d(mol), xs = P.map((p) => p[0]), ys = P.map((p) => p[1]);
    const ext = Math.max(2, Math.max(...xs) - Math.min(...xs), Math.max(...ys) - Math.min(...ys)), k = Math.min(w, h * 1.4) / (ext + 1.6), ox = w / 2, oy = h / 2;
    const X = (p) => ox + p[0] * k, Y = (p) => oy + p[1] * k;
    ctx.lineCap = 'round';
    for (const b of mol.bonds) {
      const a = P[b.a], z = P[b.b], hi = opt.hiBonds?.has(b);
      ctx.strokeStyle = hi ? c.gold : c.ink2; ctx.lineWidth = hi ? 3.2 : 1.6;
      const dx = z[0] - a[0], dy = z[1] - a[1], d = Math.hypot(dx, dy) || 1, nx = (-dy / d) * 0.09 * k, ny = (dx / d) * 0.09 * k;
      const line = (o) => { ctx.beginPath(); ctx.moveTo(X(a) + o * nx, Y(a) + o * ny); ctx.lineTo(X(z) + o * nx, Y(z) + o * ny); ctx.stroke(); };
      if (b.order === 2) { line(-1); line(1); } else if (b.order === 3) { line(-1.4); line(0); line(1.4); } else if (b.order === 1.5) { line(0); ctx.setLineDash([3, 3]); line(1.5); ctx.setLineDash([]); } else line(0);
    }
    const r = Math.max(7, Math.min(13, k * 0.24));
    mol.atoms.forEach((a, i) => {
      const x = X(P[i]), y = Y(P[i]), col = opt.color ? opt.color(i) : null, hi = opt.hiAtoms?.has(i);
      ctx.fillStyle = col || c.paper; ctx.strokeStyle = hi ? c.gold : col ? col : c.line; ctx.lineWidth = hi ? 3 : 1.2;
      ctx.beginPath(); ctx.arc(x, y, r, 0, 2 * Math.PI); ctx.fill(); ctx.stroke();
      if (i === opt.centre) { ctx.strokeStyle = c.danger; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(x, y, r + 4, 0, 2 * Math.PI); ctx.stroke(); }
      ctx.fillStyle = col ? '#fff' : ECOL[a.el] || c.ink; ctx.font = font(Math.round(r * 1.05), 700); ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
      const lab = a.arom ? a.el.toLowerCase() : a.el; ctx.fillText(lab, x, y + 0.5);
      if (opt.numbers) { ctx.fillStyle = c.muted; ctx.font = font(10); ctx.fillText(String(i + 1), x + r + 5, y - r); }
      ctx.textBaseline = 'alphabetic';
    });
    if (opt.title) { ctx.fillStyle = c.ink2; ctx.font = font(12, 600); ctx.textAlign = 'left'; ctx.fillText(opt.title, 8, 16); }
  }
  // 在 'html' 图里放一个可以输入的 SMILES 框（只建一次，之后保留光标位置）
  function smilesBox(box, s, keys) {
    if (box.dataset.ready) return;
    box.dataset.ready = '1';
    box.innerHTML = `<div class="cml-inputs">${keys.map(([k, lab]) => `<label>${esc(lab)}<input type="text" spellcheck="false" autocomplete="off" data-sm="${k}" value="${esc(s[k])}"></label>`).join('')}</div>`;
    box.addEventListener('input', (e) => { const k = e.target.dataset.sm; if (!k) return; s[k] = e.target.value.slice(0, 120); s.redraw(); });
  }
  const syncBox = (box, s, keys) => { for (const [k] of keys) { const inp = box.querySelector(`[data-sm="${k}"]`); if (inp && inp.value !== s[k] && document.activeElement !== inp) inp.value = s[k]; } };
  const WHY = { empty: ['空的', 'empty'], token: ['有不认得的字符', 'contains an unknown character'], branch: ['括号不配对', 'unbalanced parentheses'], bond: ['键的写法不对', 'misplaced bond'], ring: ['环号不配对', 'ring closure mismatch'], 'ring-open': ['有没合上的环', 'an unclosed ring'], dangling: ['结尾多了键或括号', 'a dangling bond or bracket'], bracket: ['方括号原子写法不对', 'malformed bracket atom'], element: ['不认得的元素', 'unknown element'], valence: ['超过了常见的价', 'exceeds a usual valence'], kekule: ['芳香环写不成凯库勒式', 'the aromatic ring has no Kekulé form'], 'aromatic-chain': ['芳香原子不在环上', 'aromatic atom outside a ring'], dot: ['“.” 的位置不对', 'misplaced “.”'] };
  const why = (m) => (m.ok ? L('有效', 'valid') : `${L('无效：', 'invalid: ')}${L(...(WHY[m.why] || ['其他', 'other']))}`);

  // ── 1. 学习曲线 ─────────────────────────────────────────────────
  const SIZES = [8, 16, 32, 64, 128, 256];
  DEMOS.lc = {
    title: L('学习曲线：多一倍数据，误差少多少', 'Learning curves: how much does doubling the data buy you?'), kind: 'sim',
    intro: L('同一份玩具数据（二维描述符 → 一个光滑的“性质”加噪声），四种模型：只猜平均值、线性回归、k 近邻、核岭回归（就是高斯过程的均值，下一章讲）。在双对数坐标上，好的模型的误差随数据量 N 按幂律下降，直线的斜率就是“学得多快”；碰到噪声的地板后就平了。基线不能省：如果你的模型没有明显好过线性回归，复杂的网络多半是在拟合噪声。', 'One toy dataset (a 2D descriptor → a smooth “property” plus noise) and four models: always guess the mean, linear regression, k-nearest neighbours and kernel ridge regression (the mean of a Gaussian process, next chapter). On log–log axes a good model’s error falls as a power of the data size N, and the slope says how fast it learns; it flattens once it reaches the noise floor. Never skip the baselines: if your model is not clearly better than linear regression, a complicated network is probably fitting noise.'),
    ctl: [['noise', L('噪声（标准差）', 'Noise (std. dev.)'), 0, 0.2, 0.01, 0.05, (v) => v.toFixed(2)]],
    chk: [['lin', L('画线性回归', 'Show linear regression'), true], ['knn', L('画 k 近邻', 'Show k-NN'), true]],
    btn: [[L('没有噪声', 'No noise'), { noise: 0 }], [L('噪声大', 'Noisy'), { noise: 0.15 }]],
    figs: [[0.62, L('测试集上的平均绝对误差（MAE）对训练集大小 N，双对数坐标；每个点是 3 次随机抽样的平均。虚线是噪声的平均绝对值 σ√(2/π)，任何模型都低不过它。', 'Mean absolute error (MAE) on a test set against training-set size N, log–log; each point averages 3 random draws. The dashed line is the mean absolute noise σ√(2/π), which no model can beat.')]],
    note: L('真函数 f(x) = sin 3x₁ · cos 2x₂ + 0.6 exp(−|x − (0.7, 0.3)|²/0.05) + 0.5x₂；测试集 300 个点，不带噪声。k 近邻取 k = 5；核岭回归用高斯核，长度和正则化在一个小网格上按边际似然挑。斜率是对 N ≥ 32 的点做的直线拟合。这是玩具数据：真实化学数据集的斜率常常更平（描述符不完整、噪声不均匀）。', 'True function f(x) = sin 3x₁ · cos 2x₂ + 0.6 exp(−|x − (0.7, 0.3)|²/0.05) + 0.5x₂; 300 noise-free test points. k-NN uses k = 5; kernel ridge regression uses a Gaussian kernel with length scale and regularisation picked on a small grid by marginal likelihood. Slopes are straight-line fits to the points with N ≥ 32. These are toy data: real chemical datasets often give flatter slopes (incomplete descriptors, uneven noise).'),
    draw(s, [cv], c) {
      const nz = Math.round(s.noise * 100) / 100, opt = { noise: nz, seeds: 3, test: 300 };
      const C = cache(`lc${nz}`, () => Object.fromEntries(['mean', 'linear', 'knn', 'krr'].map((k) => [k, M.learningCurve(k, SIZES, opt)])));
      const floor = nz * Math.sqrt(2 / Math.PI), lx = SIZES, lg = (v) => Math.max(v, 1e-4);
      const ser = [{ xs: lx, ys: C.mean.map(lg), color: c.muted, width: 1.6, dots: 3, line: true, label: L('平均值', 'mean') }];
      if (s.lin) ser.push({ xs: lx, ys: C.linear.map(lg), color: c.info, dots: 3, line: true, label: L('线性', 'linear') });
      if (s.knn) ser.push({ xs: lx, ys: C.knn.map(lg), color: c.gold, dots: 3, line: true, label: 'k-NN' });
      ser.push({ xs: lx, ys: C.krr.map(lg), color: c.accent, width: 2.6, dots: 3.5, line: true, label: L('核岭回归', 'kernel ridge') });
      const all = Object.values(C).flat().map((v) => Math.log10(lg(v))), ylo = Math.min(...all, floor > 0 ? Math.log10(floor) : 0) - 0.15;
      plot(cv, { x: [Math.log10(6), Math.log10(320)], y: [ylo, Math.max(...all) + 0.12], logx: true, logy: true, xt: SIZES.map(Math.log10), xf: (t) => String(Math.round(10 ** t)), yt: [-3, -2.5, -2, -1.5, -1, -0.5, 0], yf: (t) => fmt(10 ** t, 2), xl: L('训练集大小 N', 'training-set size N'), yl: 'MAE', series: ser, hmarks: floor > 0 ? [{ y: lg(floor), color: c.danger }] : [] });
      const tail = (v) => M.loglogSlope(SIZES.slice(2), v.slice(2)).slope;
      return [[L('核岭回归的斜率', 'Kernel ridge slope'), fix(tail(C.krr), 2), true], [L('k 近邻的斜率', 'k-NN slope'), fix(tail(C.knn), 2)], [L('线性回归的斜率', 'Linear slope'), fix(tail(C.linear), 2)], [L('N = 256 时的 MAE（核岭 / 线性 / 平均）', 'MAE at N = 256 (kernel / linear / mean)'), `${fix(C.krr.at(-1), 3)} / ${fix(C.linear.at(-1), 3)} / ${fix(C.mean.at(-1), 3)}`], [L('噪声地板', 'Noise floor'), fix(floor, 3)]];
    },
  };

  // ── 2. 圆形指纹和相似度 ──────────────────────────────────────────
  const FPKEYS = [['a', L('分子 A 的 SMILES', 'SMILES of molecule A')], ['b', L('分子 B 的 SMILES', 'SMILES of molecule B')]];
  DEMOS.fp = {
    title: L('从 SMILES 到指纹：一个分子变成一串 0 和 1', 'From SMILES to fingerprint: a molecule becomes a string of 0s and 1s'), kind: 'exact',
    intro: L('在下面的框里写两个 SMILES（或者点预设）。程序先读成分子图（补上隐含氢、检查价态和芳香环），再按 ECFP 的做法给每个原子的“周围环境”编号：半径 0 是原子本身，半径 1 加上直接相连的原子，半径 2 再往外一圈……每个编号折进一个固定长度的位向量。两个分子共有的位越多，Tanimoto 相似度越高。同一个分子换一种写法（CCO 和 OCC），指纹完全相同。', 'Type two SMILES in the boxes below (or press a preset). The program reads each into a molecular graph (adding implicit hydrogens, checking valences and aromatic rings), then numbers every atom’s “neighbourhood” the ECFP way: radius 0 is the atom itself, radius 1 adds its bonded neighbours, radius 2 one more shell … Each number is folded into a fixed-length bit vector. The more bits two molecules share, the higher their Tanimoto similarity. The same molecule written differently (CCO and OCC) gives exactly the same fingerprint.'),
    state: { a: 'Oc1ccccc1', b: 'Nc1ccccc1' },
    ctl: [['r', L('半径', 'Radius'), 0, 3, 1, 2, (v) => String(v)], ['bits', L('位数（2 的幂）', 'Bits (power of 2)'), 5, 11, 1, 10, (v) => String(2 ** v)], ['atom', L('高亮 A 的第几个原子', 'Highlight atom of A'), 1, 30, 1, 1, (v) => String(v)]],
    btn: [[L('苯酚 / 苯胺', 'phenol / aniline'), { a: 'Oc1ccccc1', b: 'Nc1ccccc1' }], [L('同一个分子两种写法', 'same molecule, two spellings'), { a: 'CCO', b: 'OCC' }], [L('布洛芬 / 萘普生', 'ibuprofen / naproxen'), { a: 'CC(C)Cc1ccc(cc1)C(C)C(=O)O', b: 'COc1ccc2cc(ccc2c1)C(C)C(=O)O' }], [L('咖啡因 / 可可碱', 'caffeine / theobromine'), { a: 'Cn1cnc2c1c(=O)n(C)c(=O)n2C', b: 'Cn1cnc2c1c(=O)[nH]c(=O)n2C' }], [L('写错的', 'a broken one'), { a: 'c1cccc1', b: 'C1CC' }]],
    stack: true,
    figs: [['html', L('输入（最多 120 个字符）。读法认得常见的有机元素、方括号原子、电荷、分支和环号，不处理立体化学。', 'Input (up to 120 characters). The reader knows the common organic elements, bracket atoms, charges, branches and ring closures; stereochemistry is ignored.')], [0.46, L('分子 A：红圈是选中的原子，金色是它在这个半径内的环境（这一位就编码这块结构）。', 'Molecule A: the red ring marks the chosen atom and gold its environment within this radius (one bit encodes exactly this fragment).')], [0.46, L('分子 B。', 'Molecule B.')], [0.16, L('两个位向量：金色是只有 A 有的位，蓝色是只有 B 有的，绿色是共有的。', 'The two bit vectors: gold bits are only in A, blue only in B, green in both.')]],
    note: L('指纹的思路和 Rogers 与 Hahn 的 ECFP 一样（原子不变量 → 逐圈哈希 → 去掉覆盖同一组键的重复环境 → 折叠），但原子不变量的取法和哈希函数是这里自己定的，所以位的位置和 RDKit 的 Morgan 指纹不同，相似度的数值也会略有差别。读法会拒绝写不成凯库勒式的芳香环（c1cccc1）和超价（五价的碳）。', 'The fingerprint follows the idea of Rogers and Hahn’s ECFP (atom invariants → hash shell by shell → drop duplicate environments covering the same bonds → fold), but the atom invariants and hash function are our own, so bit positions differ from RDKit’s Morgan fingerprint and similarity values differ slightly. The reader rejects aromatic rings with no Kekulé form (c1cccc1) and hypervalence (five-valent carbon).'),
    draw(s, [box, cvA, cvB, cvBits], c) {
      smilesBox(box, s, FPKEYS); syncBox(box, s, FPKEYS);
      const A = M.parseSmiles(s.a), B = M.parseSmiles(s.b), nbits = 2 ** s.bits;
      let hiA = null, hb = null, centre = -1;
      if (A.ok) {
        centre = Math.min(s.atom, A.atoms.length) - 1;
        const sh = M.shell(A, centre, s.r); hiA = new Set(sh.keys());
        hb = new Set(A.bonds.filter((b) => sh.has(b.a) && sh.has(b.b) && Math.max(sh.get(b.a), sh.get(b.b)) <= s.r && Math.min(sh.get(b.a), sh.get(b.b)) < s.r));
      }
      drawMol(cvA, A, c, { hiAtoms: hiA, hiBonds: hb, centre, numbers: true, title: 'A' });
      drawMol(cvB, B, c, { title: 'B' });
      const fa = A.ok ? M.ecfp(A, s.r, nbits) : null, fb = B.ok ? M.ecfp(B, s.r, nbits) : null;
      const { ctx, w, h } = fit(cvBits);
      if (fa && fb) {
        const row = (y, set, other, col1) => { const cw = w / nbits; for (let i = 0; i < nbits; i++) { const on = set.has(i); if (!on) continue; ctx.fillStyle = other.has(i) ? c.ok : col1; ctx.fillRect(i * cw, y, Math.max(1, cw), h / 2 - 3); } };
        ctx.fillStyle = c.line; ctx.fillRect(0, h / 2 - 2, w, 1);
        row(0, fa.bits, fb.bits, c.gold); row(h / 2 + 1, fb.bits, fa.bits, c.info);
      }
      const shared = fa && fb ? [...fa.bits].filter((x) => fb.bits.has(x)).length : 0;
      const env = A.ok ? A.atoms[centre] : null;
      return [[L('A', 'A'), A.ok ? `${A.formula} · ${fix(A.mw, 2)} g/mol` : why(A)], [L('B', 'B'), B.ok ? `${B.formula} · ${fix(B.mw, 2)} g/mol` : why(B)], [L('Tanimoto 相似度', 'Tanimoto similarity'), fa && fb ? fix(M.tanimoto(fa.bits, fb.bits), 3) : '—', true], [L('置位数（A / B / 共有）', 'Bits set (A / B / shared)'), fa && fb ? `${fa.bits.size} / ${fb.bits.size} / ${shared}` : '—'], [L('选中的原子', 'Chosen atom'), env ? `${env.arom ? env.el.toLowerCase() : env.el}${centre + 1} · ${L('重原子邻居', 'heavy neighbours')} ${env.degree} · H ${env.h}${env.ring ? L(' · 在环上', ' · in a ring') : ''}` : '—'], [L('环境数（不折叠）', 'Environments (unfolded)'), fa ? String(fa.ids.size) : '—']];
    },
  };

  // ── 3. Coulomb 矩阵 ──────────────────────────────────────────────
  DEMOS.coulomb = {
    title: L('Coulomb 矩阵：把三维结构写成对换原子、转动分子都不变的数', 'The Coulomb matrix: turning a 3D structure into numbers unchanged by relabelling atoms or rotating the molecule'), kind: 'exact',
    intro: L('Rupp 等人 2012 年的表示：对角线是 ½Z^2.4（原子自己），非对角是核电荷之间的库仑排斥 ZᵢZⱼ/|Rᵢ − Rⱼ|。矩阵本身和原子的编号顺序有关：点“打乱原子编号”，矩阵的样子就变了。但它的本征值不变；转动分子，矩阵和本征值都不变（只用到距离）。按本征值排成的向量就是一个对置换、转动和平移都不变的分子表示。', 'The representation of Rupp et al. (2012): the diagonal is ½Z^2.4 (the atom on its own), off-diagonal entries are the Coulomb repulsions between nuclear charges ZᵢZⱼ/|Rᵢ − Rⱼ|. The matrix itself depends on how the atoms are numbered: press “Shuffle atom order” and it looks different. Its eigenvalues do not change; rotating the molecule changes neither the matrix nor the eigenvalues (only distances enter). The sorted eigenvalues form a molecular representation invariant to permutation, rotation and translation.'),
    sel: [['mol', L('分子', 'Molecule'), Object.entries(M.GEOMS).map(([k, g]) => [k, `${L(...g.name)}`]), 'ch2o']],
    ctl: [['rot', L('转动分子（度）', 'Rotate molecule (degrees)'), 0, 360, 5, 0, (v) => `${v}°`]],
    state: () => ({ perm: null, permSeed: 0 }),
    act: [[L('打乱原子编号', 'Shuffle atom order'), (s) => { s.permSeed++; const n = M.GEOMS[s.mol].atoms.length; s.perm = M.rng(s.permSeed * 37 + 1).shuffle(range(n)); }], [L('还原编号', 'Restore order'), (s) => { s.perm = null; }]],
    changed(s, k) { if (k === 'mol') s.perm = null; },
    figs: [[0.62, L('Coulomb 矩阵（原子单位，色深按 log₁₀ 取）。行和列的标签是当前的原子编号。', 'Coulomb matrix (atomic units, colour on a log₁₀ scale). Row and column labels follow the current atom order.')], ['html', L('本征值从大到小，和其他五个分子的距离（本征值向量补零到同样长度后的欧氏距离）。', 'Eigenvalues, largest first, and distances to the other five molecules (Euclidean distance between eigenvalue vectors padded with zeros to equal length).')]],
    note: L('几何是近似的实验几何（键长到 0.01 Å 左右），距离换算成玻尔再算。Coulomb 矩阵的本征值丢掉了一部分信息：不同的分子可以有相同的本征值谱，而且它对结构的微小变化不平滑。后来的表示（SOAP、对称函数、等变网络）都在补这两个缺点。', 'Geometries are approximate experimental ones (bond lengths to about 0.01 Å), converted to bohr. The eigenvalue spectrum throws information away: different molecules can share a spectrum, and it is not smooth under small structural changes. Later representations (SOAP, symmetry functions, equivariant networks) fix these two weaknesses.'),
    draw(s, [cv, box], c) {
      const G = M.GEOMS[s.mol], n = G.atoms.length, perm = s.perm && s.perm.length === n ? s.perm : range(n);
      const atoms = M.rotateAtoms(perm.map((i) => G.atoms[i]), (s.rot * Math.PI) / 180, (s.rot * Math.PI) / 360);
      const C = M.coulombMatrix(atoms), mx = Math.log10(Math.max(...C.flat()));
      const { ctx, w, h } = fit(cv), sz = Math.min(w - 40, h - 30) / n, ox = (w - sz * n) / 2 + 12, oy = 22;
      C.forEach((row, i) => row.forEach((v, j) => { const t = Math.max(0, Math.log10(Math.max(v, 1e-3)) / mx); ctx.globalAlpha = 0.15 + 0.85 * t; ctx.fillStyle = i === j ? c.gold : c.accent; ctx.fillRect(ox + j * sz + 1, oy + i * sz + 1, sz - 2, sz - 2); ctx.globalAlpha = 1; ctx.fillStyle = t > 0.6 ? '#fff' : c.ink; ctx.font = font(Math.min(13, sz / 4)); ctx.textAlign = 'center'; ctx.fillText(v >= 10 ? v.toFixed(1) : v.toFixed(2), ox + j * sz + sz / 2, oy + i * sz + sz / 2 + 4); }));
      ctx.fillStyle = c.ink2; ctx.font = font(12, 700);
      atoms.forEach((a, i) => { ctx.textAlign = 'center'; ctx.fillText(`${a[0]}${perm[i] + 1}`, ox + i * sz + sz / 2, oy - 6); ctx.textAlign = 'right'; ctx.fillText(`${a[0]}${perm[i] + 1}`, ox - 4, oy + i * sz + sz / 2 + 4); });
      const ev = M.cmEigen(atoms), ev0 = M.cmEigen(G.atoms), pad = Math.max(...Object.values(M.GEOMS).map((g) => g.atoms.length));
      const dist = Object.entries(M.GEOMS).filter(([k]) => k !== s.mol).map(([k, g]) => { const a = M.cmEigen(G.atoms, pad), b = M.cmEigen(g.atoms, pad); return [L(...g.name), Math.sqrt(M.sq(a, b))]; }).sort((x, y) => x[1] - y[1]);
      box.innerHTML = `<div class="chm-wrap"><table class="chm-table"><thead><tr><th>${esc(L('本征值', 'Eigenvalues'))}</th><th>${esc(L('最近的分子（距离）', 'Nearest molecules (distance)'))}</th></tr></thead><tbody><tr><td class="num">${ev.map((v) => esc(fix(v, 3))).join('<br>')}</td><td>${dist.map(([nm, d]) => `${esc(nm)} · ${esc(fix(d, 2))}`).join('<br>')}</td></tr></tbody></table></div>`;
      const C0 = M.coulombMatrix(G.atoms), dRaw = Math.sqrt(C.flat().reduce((t, v, i) => t + (v - C0.flat()[i]) ** 2, 0)), dEv = Math.sqrt(M.sq(ev, ev0));
      return [[L('矩阵和原编号时的差（Frobenius）', 'Matrix difference from original order (Frobenius)'), fix(dRaw, 3)], [L('本征值的差', 'Eigenvalue difference'), dEv < 1e-9 ? '< 10⁻⁹' : fmt(dEv), true], [L('最大的本征值', 'Largest eigenvalue'), fix(ev[0], 3)]];
    },
  };

  // ── 4. 核函数和先验 ──────────────────────────────────────────────
  const KERNELS = [['rbf', L('高斯核（RBF，无穷次可导）', 'Gaussian (RBF, infinitely differentiable)')], ['m52', 'Matérn 5/2'], ['m32', 'Matérn 3/2'], ['per', L('周期核', 'Periodic')], ['lin', L('线性核', 'Linear')]];
  DEMOS.prior = {
    title: L('核函数就是你对函数长什么样的假设', 'A kernel is your assumption about what the function looks like'), kind: 'exact',
    intro: L('高斯过程先验：在还没有任何数据时，从“所有可能的函数”里随便抽几条看看。核函数 k(x, x′) 决定两个点的函数值有多相关：长度 ℓ 越短，函数摆动得越快；Matérn 核比高斯核粗糙；周期核只会给出周期函数；线性核只给直线。挑核就是在说“我相信性质随描述符怎样变化”。', 'A Gaussian-process prior: before any data, draw a few functions at random from “all possible functions”. The kernel k(x, x′) sets how correlated the function values at two points are: the shorter the length scale ℓ, the faster the function wiggles; Matérn kernels are rougher than the Gaussian one; a periodic kernel gives only periodic functions; a linear kernel gives only straight lines. Choosing a kernel is saying “this is how I believe the property varies with the descriptor”.'),
    sel: [['type', L('核函数', 'Kernel'), KERNELS, 'rbf']],
    ctl: [['l', L('长度 ℓ', 'Length scale ℓ'), 0.03, 1, 0.01, 0.15, (v) => v.toFixed(2)], ['n', L('抽几条', 'Number of draws'), 1, 8, 1, 4, (v) => String(v)]],
    state: { seed: 1 },
    act: [[L('重新抽', 'Draw again'), (s) => { s.seed++; }]],
    figs: [[0.5, L('从先验里抽的函数（信号方差 1）。灰色带是 ±2 个标准差。', 'Functions drawn from the prior (signal variance 1). The grey band is ±2 standard deviations.')], [0.36, L('核函数 k(r) 随两点距离 r 的变化。', 'The kernel k(r) against the distance r between two points.')]],
    note: L('抽样的做法：在 160 个格点上算协方差矩阵 K，加 10⁻⁶ 的对角稳定项，做 Cholesky 分解 K = LLᵀ，再用 L 乘一个标准正态向量。周期核的周期取 0.5。线性核以 x = 0.5 为原点。', 'How the draws are made: compute the covariance matrix K on 160 grid points, add 10⁻⁶ to the diagonal for stability, factorise K = LLᵀ and multiply L by a vector of standard normals. The periodic kernel has period 0.5. The linear kernel is centred on x = 0.5.'),
    draw(s, [cv, cv2], c) {
      const xs = lin(0, 1, 160), K = { type: s.type, l: s.l, s2: 1, p: 0.5 }, S = M.gpSample(xs, K, s.n, s.seed);
      const cols = [c.accent, c.gold, c.info, c.danger, c.ok, c.violet || c.info, c.ink2, c.warn];
      const sd = xs.map((x) => 2 * Math.sqrt(M.kfun(K)([x], [x])));
      plot(cv, { x: [0, 1], y: [-3.2, 3.2], xl: 'x', yl: 'f(x)', series: [{ xs, ys: sd, color: c.muted, alpha: 0.35, width: 1, dash: [3, 3] }, { xs, ys: sd.map((v) => -v), color: c.muted, alpha: 0.35, width: 1, dash: [3, 3] }, ...S.map((ys, i) => ({ xs, ys, color: cols[i % cols.length], width: 1.8 }))] });
      const rs = lin(0, 1, 200), k = M.kfun(K);
      plot(cv2, { x: [0, 1], y: [s.type === 'lin' ? -0.5 / (s.l * s.l) * 0.3 : -0.05, s.type === 'lin' ? 0.3 / (s.l * s.l) : 1.05], xl: 'r', yl: 'k(r)', series: [{ xs: rs, ys: rs.map((r) => k([0.5], [0.5 + r])), color: c.accent, width: 2.4 }] });
      const rough = s.type === 'rbf' ? L('光滑（无穷次可导）', 'smooth (infinitely differentiable)') : s.type === 'm52' ? L('两次可导', 'twice differentiable') : s.type === 'm32' ? L('一次可导', 'once differentiable') : s.type === 'per' ? L('光滑、周期 0.5', 'smooth, period 0.5') : L('直线', 'straight lines');
      const cross = (ys) => ys.slice(1).filter((v, i) => Math.sign(v - ys[0] * 0) !== Math.sign(ys[i])).length;
      return [[L('样本函数的光滑程度', 'Smoothness of the draws'), rough, true], [L('平均每条穿过零的次数', 'Zero crossings per draw'), fix(M.mean(S.map(cross)), 1)], [L('k(ℓ) / k(0)', 'k(ℓ) / k(0)'), s.type === 'lin' ? '—' : fix(k([0], [s.l]) / k([0], [0]), 3)]];
    },
  };

  // ── 5. 高斯过程回归 ─────────────────────────────────────────────
  const GPX = [0, 1], GPY = [-2.2, 2.2];
  const GP_SETS = { few: [[0.08, 0.35], [0.3, 1.1], [0.52, -0.2], [0.85, -1]], many: M.data1(18, 0.08, 4), gap: M.data1(16, 0.08, 9).filter(([x]) => x < 0.35 || x > 0.75) };
  DEMOS.gp = {
    title: L('高斯过程回归：一个会说“我不知道”的模型', 'Gaussian-process regression: a model that can say “I don’t know”'), kind: 'exact',
    intro: L('在图上点一下就加一个数据点（再点它附近就删掉）。高斯过程给出的不只是一条曲线，还有每个位置的不确定度：离数据远的地方，灰带自动变宽。长度 ℓ 和噪声可以手调，也可以打开“按边际似然挑”：在一个网格上找让数据最“可信”的超参数（下图）。边际似然自动在“拟合得好”和“模型简单”之间取舍：ℓ 太短会过拟合，太长会欠拟合，两边的似然都低。', 'Click the plot to add a data point (click near one to remove it). A Gaussian process gives not just a curve but an uncertainty at every position: far from the data the grey band widens by itself. Set the length scale ℓ and noise by hand, or switch on “pick by marginal likelihood”, which searches a grid for the hyperparameters that make the data most “plausible” (lower plot). The marginal likelihood trades off “fits well” against “simple” automatically: too short an ℓ overfits, too long underfits, and both have low likelihood.'),
    ctl: [['l', L('长度 ℓ', 'Length scale ℓ'), 0.03, 1, 0.01, 0.15, (v) => v.toFixed(2)], ['noise', L('噪声标准差', 'Noise std. dev.'), 0.01, 0.5, 0.01, 0.08, (v) => v.toFixed(2)]],
    chk: [['auto', L('按边际似然挑 ℓ 和噪声', 'Pick ℓ and noise by marginal likelihood'), false], ['truth', L('画真函数（虚线）', 'Show the true function (dashed)'), true]],
    state: () => ({ pts: GP_SETS.many.map((p) => p.slice()) }),
    btn: [[L('18 个点', '18 points'), { pts: GP_SETS.many.map((p) => p.slice()) }], [L('中间有空缺', 'A gap in the middle'), { pts: GP_SETS.gap.map((p) => p.slice()) }], [L('只有 4 个点', 'Only 4 points'), { pts: GP_SETS.few.map((p) => p.slice()) }]],
    act: [[L('清空', 'Clear'), (s) => { s.pts = []; }]],
    figs: [[0.56, L('后验均值（绿）和 ±2σ 的区间（灰）。点图加点。', 'Posterior mean (green) and the ±2σ band (grey). Click to add points.')], [0.34, L('对数边际似然 log p(y | ℓ) 随 ℓ 的变化（噪声取当前值）；红点是现在用的 ℓ。', 'Log marginal likelihood log p(y | ℓ) against ℓ (noise at its current value); the red dot is the ℓ in use.')]],
    note: L('核是高斯核，信号方差 1，y 不做标准化（真函数的幅度约 1）。“按边际似然挑”是在 13 个 ℓ × 5 个噪声的网格上取最大，不是梯度优化。后验：μ(x) = kᵀ(K + σ²I)⁻¹y，σ²(x) = k(x, x) − kᵀ(K + σ²I)⁻¹k，用 Cholesky 分解算。灰带只包括函数本身的不确定度，不包括测量噪声。', 'Gaussian kernel, signal variance 1, y not standardised (the true function has amplitude about 1). “Pick by marginal likelihood” takes the maximum over a grid of 13 ℓ × 5 noise values, not gradient optimisation. Posterior: μ(x) = kᵀ(K + σ²I)⁻¹y, σ²(x) = k(x, x) − kᵀ(K + σ²I)⁻¹k, computed with a Cholesky factorisation. The grey band is the uncertainty of the function only, not of the measurement noise.'),
    draw(s, [cv, cv2], c) {
      cv.classList.add('cml-click');
      cv.onpointerdown = (e) => { const [x, y] = toData(cv, e, GPX, GPY); if (x < 0 || x > 1 || y < GPY[0] || y > GPY[1]) return; const near = s.pts.findIndex(([px, py]) => Math.abs(px - x) < 0.02 && Math.abs(py - y) < 0.15); if (near >= 0) s.pts.splice(near, 1); else if (s.pts.length < 60) s.pts.push([x, y]); s.redraw(); };
      let l = s.l, nz = s.noise;
      const X = s.pts.map(([x]) => [x]), Y = s.pts.map(([, y]) => y);
      if (s.auto && s.pts.length >= 2) { let best = -Infinity; for (const ll of M.L_GRID) for (const n2 of [0.01, 0.03, 0.08, 0.15, 0.3]) { const g = M.gpFit(X, Y, { type: 'rbf', l: ll, s2: 1 }, n2 * n2); if (g.lml > best) { best = g.lml; l = ll; nz = n2; } } }
      const g = M.gpFit(X, Y, { type: 'rbf', l, s2: 1 }, nz * nz), xs = lin(0, 1, 240), P = xs.map((x) => g.predict([x]));
      const mu = P.map((p) => p[0]), sd = P.map((p) => Math.sqrt(p[1]));
      plot(cv, { x: GPX, y: GPY, xl: 'x', yl: 'y', series: [
        { xs, ys: mu.map((m, i) => m + 2 * sd[i]), color: c.muted, width: 1, alpha: 0.6 }, { xs, ys: mu.map((m, i) => m - 2 * sd[i]), color: c.muted, width: 1, alpha: 0.6 },
        ...(s.truth ? [{ xs, ys: xs.map(M.truth1), color: c.ink2, dash: [5, 4], width: 1.4 }] : []),
        { xs, ys: mu, color: c.accent, width: 2.6 }, { xs: s.pts.map((p) => p[0]), ys: Y, dots: 4, color: c.gold }],
        after: ({ ctx, X: Xp, Y: Yp }) => { ctx.fillStyle = c.muted; ctx.globalAlpha = 0.16; ctx.beginPath(); xs.forEach((x, i) => (i ? ctx.lineTo(Xp(x), Yp(mu[i] + 2 * sd[i])) : ctx.moveTo(Xp(x), Yp(mu[i] + 2 * sd[i])))); for (let i = xs.length - 1; i >= 0; i--) ctx.lineTo(Xp(xs[i]), Yp(mu[i] - 2 * sd[i])); ctx.closePath(); ctx.fill(); ctx.globalAlpha = 1; } });
      const ls = lin(Math.log10(0.03), 0, 60).map((v) => 10 ** v), lm = s.pts.length ? ls.map((ll) => M.gpFit(X, Y, { type: 'rbf', l: ll, s2: 1 }, nz * nz).lml) : ls.map(() => 0);
      plot(cv2, { x: [Math.log10(0.03), 0], logx: true, xt: [-1.5, -1, -0.5, 0], xf: (t) => fix(10 ** t, 2), y: [Math.min(...lm) - 1, Math.max(...lm) + 1], xl: L('长度 ℓ', 'length scale ℓ'), yl: 'log p', series: [{ xs: ls, ys: lm, color: c.info, width: 2.2 }], marks: [{ x: l, y: g.lml, color: c.danger }] });
      const err = M.rmse(mu, xs.map(M.truth1));
      return [[L('数据点', 'Data points'), String(s.pts.length)], [L('用的 ℓ / 噪声', 'ℓ / noise in use'), `${fix(l, 2)} / ${fix(nz, 2)}`, true], [L('对数边际似然', 'Log marginal likelihood'), s.pts.length ? fix(g.lml, 2) : '—'], [L('均值和真函数的 RMS 差', 'RMS difference of mean from truth'), fix(err, 3)], [L('最大的 σ', 'Largest σ'), fix(Math.max(...sd), 3)]];
    },
  };

  // ── 6. 小神经网络 ───────────────────────────────────────────────
  const mlpReset = (s) => { const D = M.data1(s.n, s.noise, 21); s.train = D; s.P = M.mlpInit(s.H, s.seed); s.epoch = 0; s.hist = []; };
  DEMOS.mlp = {
    title: L('一层隐藏层的神经网络，看它一步步学', 'A one-hidden-layer neural network, learning step by step'), kind: 'sim',
    intro: L('网络 ŷ = Σⱼ vⱼ tanh(wⱼx + bⱼ) + c，H 个隐藏单元。按“播放”开始梯度下降（Adam），上图是拟合的曲线，下图是训练误差和测试误差。数据少、单元多的时候，训练误差一路往下，测试误差先降后升：这就是过拟合。加一点权重衰减 λ 或者停早一点，测试误差就好看得多。', 'The network ŷ = Σⱼ vⱼ tanh(wⱼx + bⱼ) + c with H hidden units. Press Play to start gradient descent (Adam); the top plot is the fitted curve, the bottom one the training and test errors. With few data and many units the training error keeps falling while the test error falls and then rises: that is overfitting. A little weight decay λ, or stopping earlier, makes the test error much better.'),
    ctl: [['H', L('隐藏单元 H', 'Hidden units H'), 1, 40, 1, 20, (v) => String(v)], ['n', L('训练点数', 'Training points'), 5, 60, 1, 12, (v) => String(v)], ['noise', L('噪声', 'Noise'), 0, 0.3, 0.01, 0.12, (v) => v.toFixed(2)], ['lam', L('权重衰减 log₁₀λ', 'Weight decay log₁₀λ'), -7, -1, 0.5, -7, (v) => (v <= -7 ? L('无', 'none') : `10${K.sup(v)}`)]],
    state: { seed: 3 }, fps: 12,
    act: [[L('重新初始化', 'Re-initialise'), (s) => { s.seed++; mlpReset(s); }]],
    changed(s, k) { if (!s.P || ['H', 'n', 'noise', ''].includes(k)) mlpReset(s); },
    tick(s) { const lam = s.lam <= -7 ? 0 : 10 ** s.lam, xs = s.train.map((p) => p[0]), ys = s.train.map((p) => p[1]); M.mlpStep(s.P, xs, ys, 0.02, lam, 25); s.epoch += 25; const test = lin(0, 1, 200); s.hist.push([s.epoch, M.mlpLossGrad(s.P, xs, ys, 0).loss, M.mean(test.map((x) => (M.mlpPredict(s.P, x) - M.truth1(x)) ** 2))]); return s.epoch < 6000; },
    figs: [[0.5, L('金点是训练数据，虚线是真函数，绿线是网络现在的输出。', 'Gold dots are the training data, the dashed line the true function, green the network’s current output.')], [0.36, L('均方误差（对数坐标）：实线是训练集，虚线是测试集（真函数上的 200 个点）。', 'Mean squared error (log scale): solid is training, dashed is test (200 points on the true function).')]],
    note: L('初始化：输入权重 ~ N(0, 3²)，偏置 ~ N(0, 1.5²)，输出权重 ~ N(0, 1/H)。梯度按反向传播的公式手写（测试里和数值差分对过），学习率 0.02，每帧 25 步，最多 6000 步。“测试误差”量的是网络和真函数的差，不含噪声，所以它能一直低到零。', 'Initialisation: input weights ~ N(0, 3²), biases ~ N(0, 1.5²), output weights ~ N(0, 1/H). Gradients are hand-written back-propagation (checked against finite differences in the tests), learning rate 0.02, 25 steps per frame, at most 6000 steps. The “test error” measures the difference from the true function, without noise, so it can in principle reach zero.'),
    draw(s, [cv, cv2], c) {
      if (!s.P) mlpReset(s);
      const xs = lin(0, 1, 200);
      plot(cv, { x: [0, 1], y: [-1.8, 1.8], xl: 'x', yl: 'y', series: [{ xs, ys: xs.map(M.truth1), color: c.ink2, dash: [5, 4], width: 1.4 }, { xs, ys: xs.map((x) => M.mlpPredict(s.P, x)), color: c.accent, width: 2.6 }, { xs: s.train.map((p) => p[0]), ys: s.train.map((p) => p[1]), dots: 4, color: c.gold }] });
      const H = s.hist, lg = (v) => Math.max(v, 1e-6);
      const best = H.length ? H.reduce((b, h) => (h[2] < b[2] ? h : b)) : null;
      plot(cv2, { x: [0, Math.max(500, H.length ? H.at(-1)[0] : 0)], y: [-4.2, 0.6], logy: true, xl: L('训练步数', 'training steps'), yl: 'MSE', series: H.length ? [{ xs: H.map((h) => h[0]), ys: H.map((h) => lg(h[1])), color: c.accent, width: 2.2, label: L('训练', 'train') }, { xs: H.map((h) => h[0]), ys: H.map((h) => lg(h[2])), color: c.danger, dash: [5, 4], width: 2.2, label: L('测试', 'test') }] : [], marks: best ? [{ x: best[0], y: lg(best[2]), color: c.gold }] : [] });
      const last = H.at(-1);
      return [[L('训练步数', 'Steps'), String(s.epoch)], [L('参数个数', 'Parameters'), String(3 * s.H + 1)], [L('训练 MSE', 'Train MSE'), last ? fmt(last[1]) : '—'], [L('测试 MSE', 'Test MSE'), last ? fmt(last[2]) : '—', true], [L('测试误差最低的那一步', 'Step with the lowest test error'), best ? `${best[0]} (${fmt(best[2])})` : '—']];
    },
  };

  // ── 7. 消息传递和 WL ────────────────────────────────────────────
  const PAIRS = { wl: ['C1CCC2CCCCC2C1', 'C1CCC(C1)C1CCCC1', L('十氢萘 / 联环戊烷', 'decalin / bicyclopentyl')], alc: ['CCCO', 'CC(C)O', L('正丙醇 / 异丙醇', 'propan-1-ol / propan-2-ol')], eth: ['CCO', 'COC', L('乙醇 / 甲醚', 'ethanol / dimethyl ether')], hex: ['C1CCCCC1', 'CC1CCCC1', L('环己烷 / 甲基环戊烷', 'cyclohexane / methylcyclopentane')], arom: ['Cc1ccccc1C', 'Cc1cccc(C)c1', L('邻二甲苯 / 间二甲苯', 'o-xylene / m-xylene')] };
  DEMOS.mpnn = {
    title: L('消息传递：每一轮多看一圈邻居', 'Message passing: one more shell of neighbours each round'), kind: 'exact',
    intro: L('图神经网络让每个原子反复收集邻居的信息：第 t 轮之后，一个原子的特征取决于离它 t 根键以内的所有原子（左图金色）。颜色是 Weisfeiler–Lehman 着色：两个原子颜色相同，任何（求和读出的）消息传递网络都给它们相同的特征。如果两个分子每一轮的颜色统计都一样，这类网络就永远分不开它们：十氢萘和联环戊烷就是这样一对，传多少轮都一样。', 'A graph neural network lets each atom repeatedly gather information from its neighbours: after round t, an atom’s features depend on every atom within t bonds (gold, left). The colours are the Weisfeiler–Lehman colouring: two atoms of the same colour get identical features from any message-passing network with sum readout. If two molecules have the same colour counts in every round, such networks can never tell them apart: decalin and bicyclopentyl are such a pair, however many rounds you pass.'),
    sel: [['pair', L('一对分子', 'Pair of molecules'), Object.entries(PAIRS).map(([k, p]) => [k, p[2]]), 'wl']],
    ctl: [['t', L('传递轮数 t', 'Rounds t'), 0, 5, 1, 2, (v) => String(v)], ['atom', L('看哪个原子的感受野（A）', 'Receptive field of atom (A)'), 1, 10, 1, 1, (v) => String(v)]],
    figs: [[0.5, L('分子 A。原子的颜色是第 t 轮的 WL 颜色（同色 = 网络分不开）；金圈是选中原子的感受野。', 'Molecule A. Atom colours are the WL colours after round t (same colour = indistinguishable to the network); gold rings mark the chosen atom’s receptive field.')], [0.5, L('分子 B，颜色和 A 用同一套。', 'Molecule B, coloured with the same palette as A.')]],
    note: L('WL 的初始颜色只用元素和重原子邻居数，每一轮把自己的颜色和邻居颜色的多重集一起哈希。读出向量来自一个固定随机权重的两层网络 h ← tanh(Wh + UΣh_邻居)，求和读出；它对原子编号的置换严格不变（测试里打乱编号核对过）。带三维坐标或环大小特征的网络（SchNet、DimeNet、NequIP）可以分开十氢萘和联环戊烷。', 'The initial WL colour uses only element and heavy-atom degree; each round hashes an atom’s colour together with the multiset of its neighbours’ colours. The readout vector comes from a two-layer network with fixed random weights, h ← tanh(Wh + UΣh_neighbours), with sum readout; it is exactly invariant under renumbering the atoms (checked in the tests by shuffling). Networks with 3D coordinates or ring-size features (SchNet, DimeNet, NequIP) can tell decalin from bicyclopentyl.'),
    draw(s, [cvA, cvB], c) {
      const [sa, sb] = PAIRS[s.pair], A = M.parseSmiles(sa), B = M.parseSmiles(sb);
      const wa = M.wl(A, s.t), wb = M.wl(B, s.t), pal = {}, palette = [c.accent, c.gold, c.info, c.danger, c.ok, c.violet || c.ink2, '#868e96', '#e8590c', '#0ca678', '#ae3ec9', '#1c7ed6', '#f59f00'];
      const colOf = (x) => (pal[x] ??= palette[Object.keys(pal).length % palette.length]);
      const centre = Math.min(s.atom, A.atoms.length) - 1, sh = M.shell(A, centre, s.t);
      drawMol(cvA, A, c, { color: (i) => colOf(wa.col[i]), hiAtoms: new Set(sh.keys()), centre, numbers: true, title: `A · ${sa}` });
      drawMol(cvB, B, c, { color: (i) => colOf(wb.col[i]), title: `B · ${sb}` });
      const same = wa.hist.map((h, i) => h === wb.hist[i]), ra = M.mpnnReadout(A, s.t), rb = M.mpnnReadout(B, s.t), d = Math.sqrt(M.sq(ra, rb));
      const firstDiff = same.indexOf(false);
      return [[L('第 t 轮的颜色统计', 'Colour counts after round t'), same[s.t] ? L('完全一样：网络分不开', 'identical: indistinguishable') : L('不一样：网络分得开', 'different: distinguishable'), true], [L('从第几轮起分得开', 'Distinguishable from round'), firstDiff < 0 ? L(`0–${s.t} 轮都分不开`, `not in rounds 0–${s.t}`) : String(firstDiff)], [L('读出向量的距离 ‖r_A − r_B‖', 'Readout distance ‖r_A − r_B‖'), d < 1e-9 ? '0' : fix(d, 4)], [L('感受野里的原子', 'Atoms in the receptive field'), `${sh.size} / ${A.atoms.length}`], [L('分子式', 'Formulas'), `${A.formula} · ${B.formula}`]];
    },
  };

  // ── 8. 一维贝叶斯优化 ───────────────────────────────────────────
  const STRATS = [['ei', L('期望改进 EI', 'Expected improvement (EI)')], ['ucb', L('置信上界 UCB', 'Upper confidence bound (UCB)')], ['pi', L('改进概率 PI', 'Probability of improvement (PI)')], ['greedy', L('贪心（只看均值）', 'Greedy (mean only)')], ['random', L('随机', 'Random')]];
  const F1MAX = M.maxOn(M.yield1, 1);
  const boInit = (s) => { s.xs = M.lhs(3, 1, s.seed).map((p) => p[0]); s.ys = s.xs.map(M.yield1); };
  DEMOS.bo = {
    title: L('贝叶斯优化：用尽量少的实验找到最高产率', 'Bayesian optimisation: the highest yield in as few experiments as possible'), kind: 'sim',
    intro: L('一个看不见的“产率随温度”曲线（虚线，可以关掉），一个宽的局部峰，一个窄的全局峰。每做一次实验（按“做下一个实验”或播放），程序用高斯过程拟合已有的点，算出采集函数（下图），在采集函数最大的地方做下一个实验。EI 和 UCB 同时看均值高的地方（利用）和不确定的地方（探索）；贪心只看均值，很容易困在局部峰上。', 'A hidden “yield versus temperature” curve (dashed, can be hidden), with a broad local peak and a narrow global one. For each experiment (press “Run the next experiment” or Play), the program fits a Gaussian process to the points so far, computes the acquisition function (lower plot), and runs the next experiment where it is largest. EI and UCB look both where the mean is high (exploitation) and where it is uncertain (exploration); greedy looks only at the mean and easily gets stuck on the local peak.'),
    sel: [['st', L('采集函数', 'Acquisition function'), STRATS, 'ei']],
    ctl: [['beta', L('UCB 的 β（探索的力度）', 'UCB β (exploration)'), 0, 5, 0.1, 2, (v) => v.toFixed(1)], ['xi', L('EI / PI 的 ξ', 'EI / PI ξ'), 0, 0.2, 0.005, 0.01, (v) => v.toFixed(3)], ['seed', L('起始点的随机种子', 'Seed for starting points'), 1, 20, 1, 1, (v) => String(v)]],
    chk: [['truth', L('画真曲线', 'Show the true curve'), true]],
    fps: 1.5,
    act: [[L('做下一个实验', 'Run the next experiment'), (s) => { const r = boNext(s); s.xs.push(r); s.ys.push(M.yield1(r)); }], [L('重新开始', 'Start again'), (s) => boInit(s)]],
    changed(s, k) { if (!s.xs || k === 'seed' || k === '') boInit(s); },
    tick(s) { if (s.xs.length >= 15) return false; const r = boNext(s); s.xs.push(r); s.ys.push(M.yield1(r)); return s.xs.length < 15; },
    figs: [[0.5, L('高斯过程的均值（绿）和 ±2σ；金点是做过的实验，旁边的数字是顺序；红线是下一个实验的位置。', 'GP mean (green) and ±2σ; gold dots are the experiments done, numbered in order; the red line is where the next experiment goes.')], [0.3, L('采集函数（已经缩放到 0–1）。', 'Acquisition function (rescaled to 0–1).')]],
    note: L('温度归一化到 [0, 1]。高斯过程用高斯核，每一步按边际似然重新挑长度（噪声固定为很小），y 先标准化。起始的 3 个点用拉丁超立方抽。“随机”在 [0, 1] 上均匀抽。这里的实验没有噪声；真实的产率有误差，噪声项要放开。', 'Temperature is normalised to [0, 1]. The GP uses a Gaussian kernel, re-picking its length scale by marginal likelihood at every step (noise fixed small), with y standardised. The 3 starting points are a Latin hypercube. “Random” samples uniformly on [0, 1]. The experiments here are noise-free; real yields have errors and the noise term must be freed.'),
    draw(s, [cv, cv2], c) {
      if (!s.xs) boInit(s);
      const st = s.st, par = st === 'ucb' ? s.beta : s.xi, grid = lin(0, 1, 201), R = M.boStep1(s.xs, s.ys, st, { grid, seed: s.seed, par });
      s.nextX = R.next;
      const mu = R.post.map((p) => p[0]), sd = R.post.map((p) => p[1]);
      plot(cv, { x: [0, 1], y: [-0.4, 1.3], xl: L('温度（归一化）', 'temperature (normalised)'), yl: L('产率', 'yield'), series: [
        { xs: grid, ys: mu.map((m, i) => m + 2 * sd[i]), color: c.muted, width: 1, alpha: 0.6 }, { xs: grid, ys: mu.map((m, i) => m - 2 * sd[i]), color: c.muted, width: 1, alpha: 0.6 },
        ...(s.truth ? [{ xs: grid, ys: grid.map(M.yield1), color: c.ink2, dash: [5, 4], width: 1.4 }] : []), { xs: grid, ys: mu, color: c.accent, width: 2.4 }, { xs: s.xs, ys: s.ys, dots: 4.5, color: c.gold }],
        marks: s.xs.length < 15 ? [{ x: R.next, color: c.danger }] : [], texts: s.xs.map((x, i) => ({ s: String(i + 1), x, y: s.ys[i], dx: 6, dy: -6, color: c.ink2 })) });
      const a = R.acq || grid.map(() => 1), amax = Math.max(...a) || 1;
      plot(cv2, { x: [0, 1], y: [0, 1.08], yt: [0, 0.5, 1], xl: L('温度（归一化）', 'temperature (normalised)'), series: [{ xs: grid, ys: a.map((v) => v / amax), color: c.info, width: 2.2, fill: true }], marks: s.xs.length < 15 ? [{ x: R.next, color: c.danger }] : [] });
      const best = Math.max(...s.ys), bi = s.ys.indexOf(best);
      return [[L('做过的实验', 'Experiments done'), `${s.xs.length} / 15`], [L('目前最好的产率', 'Best yield so far'), `${fix(best, 3)} @ ${fix(s.xs[bi], 3)}`, true], [L('真正的最高产率', 'True maximum'), `${fix(F1MAX, 3)} @ 0.74`], [L('差距（regret）', 'Gap (regret)'), fix(F1MAX - best, 3)], [L('下一个实验', 'Next experiment'), s.xs.length < 15 ? fix(R.next, 3) : L('预算用完', 'budget spent')]];
    },
  };
  function boNext(s) { return s.nextX ?? M.boStep1(s.xs, s.ys, s.st, { seed: s.seed, par: s.st === 'ucb' ? s.beta : s.xi }).next; }

  // ── 9. 重复很多次：哪种策略更快 ───────────────────────────────────
  DEMOS.regret = {
    title: L('同一个问题跑很多遍：哪种策略平均更快', 'Run the same problem many times: which strategy is faster on average?'), kind: 'sim',
    intro: L('一次运行的结果有很大的运气成分。这里把二维的“温度 × 浓度”产率曲面（宽的局部峰加窄的全局峰）用每种策略各跑若干次（起始点不同），画出“到第 n 个实验为止最好的产率”的中位数和四分位范围。随机搜索稳步慢慢变好；贪心经常卡在局部峰，β = 2 的 UCB 在这个曲面上也是（局部峰附近的 σ 太小，β 调到 4 左右会好些，调到 8 又探索过头）；EI 平均最快找到全局峰，但不是每次都赢。', 'One run is largely luck. Here the 2D “temperature × concentration” yield surface (a broad local peak plus a narrow global one) is optimised several times by each strategy (different starting points), plotting the median and interquartile range of “best yield up to the n-th experiment”. Random search improves slowly and steadily; greedy often sticks on the local peak, and so does UCB with β = 2 on this surface (σ near the local peak is too small; β around 4 does better, while 8 explores too much); EI finds the global peak fastest on average, but does not win every time.'),
    ctl: [['budget', L('实验预算', 'Experiment budget'), 10, 30, 1, 30, (v) => String(v)], ['reps', L('每种策略重复几次', 'Repeats per strategy'), 3, 10, 1, 8, (v) => String(v)]],
    chk: [['band', L('画四分位范围', 'Show interquartile range'), true]],
    figs: [[0.56, L('到第 n 个实验为止最好的产率（中位数）。虚线是全局最大值 0.92。', 'Best yield up to the n-th experiment (median). The dashed line is the global maximum, 0.92.')], [0.62, L('产率曲面（颜色越亮越高）和 EI 第一次运行做过的实验（数字是顺序）。', 'The yield surface (brighter is higher) and the experiments of EI’s first run (numbers give the order).')]],
    note: L('每次运行：4 个拉丁超立方起始点，之后按策略在 21 × 21 的格点上挑；高斯过程每一步按边际似然挑长度。UCB 的 β = 2，EI 的 ξ = 0.01。重复次数少的时候中位数会跳；算得慢的话把重复次数调小。', 'Each run: 4 Latin-hypercube starting points, then the strategy picks on a 21 × 21 grid; the GP re-picks its length scale by marginal likelihood at every step. UCB uses β = 2, EI ξ = 0.01. With few repeats the median jumps about; reduce the repeats if it is slow.'),
    draw(s, [cv, cv2], c) {
      const res = cache(`rg${s.budget},${s.reps}`, () => Object.fromEntries(['random', 'greedy', 'ucb', 'ei'].map((st) => [st, range(s.reps).map((r) => M.boRun(M.yield2, 2, st, { seed: r + 1, budget: s.budget, n0: 4 }))])));
      const fmax = cache('f2max', () => M.maxOn(M.yield2, 2)), ns = range(s.budget).map((i) => i + 1);
      const q = (arr, p) => { const v = arr.slice().sort((a, b) => a - b), k = (v.length - 1) * p, lo = Math.floor(k); return v[lo] + (v[Math.min(lo + 1, v.length - 1)] - v[lo]) * (k - lo); };
      const colors = { random: c.muted, greedy: c.info, ucb: c.gold, ei: c.accent }, names = { random: L('随机', 'random'), greedy: L('贪心', 'greedy'), ucb: 'UCB', ei: 'EI' };
      const series = [];
      for (const st of Object.keys(res)) {
        const H = res[st].map((r) => r.hist), med = ns.map((_, i) => q(H.map((h) => h[i]), 0.5));
        if (s.band) { series.push({ xs: ns, ys: ns.map((_, i) => q(H.map((h) => h[i]), 0.25)), color: colors[st], width: 1, alpha: 0.4, dash: [2, 3] }); series.push({ xs: ns, ys: ns.map((_, i) => q(H.map((h) => h[i]), 0.75)), color: colors[st], width: 1, alpha: 0.4, dash: [2, 3] }); }
        series.push({ xs: ns, ys: med, color: colors[st], width: st === 'ei' ? 2.8 : 2, label: names[st] });
      }
      plot(cv, { x: [1, s.budget], y: [0.2, 1], xl: L('实验次数 n', 'experiments n'), yl: L('最好的产率', 'best yield'), series, hmarks: [{ y: fmax, color: c.danger }] });
      const G = 60, rows = range(G).map((j) => range(G).map((i) => M.yield2([(i + 0.5) / G, 1 - (j + 0.5) / G])));
      const g = cells(cv2, rows, (v) => `color-mix(in srgb, ${c.gold} ${Math.round(Math.max(0, Math.min(1, v / fmax)) * 100)}%, ${c.paper})`);
      const run = res.ei[0], ctx = g.ctx;
      run.X.forEach((x, k) => { const px = x[0] * g.w, py = (1 - x[1]) * g.h; ctx.fillStyle = k < 4 ? c.info : c.accent; ctx.beginPath(); ctx.arc(px, py, 4.5, 0, 2 * Math.PI); ctx.fill(); ctx.fillStyle = c.ink; ctx.font = font(10, 600); ctx.textAlign = 'left'; ctx.fillText(String(k + 1), px + 6, py - 5); });
      ctx.fillStyle = c.ink2; ctx.font = font(11); ctx.textAlign = 'left'; ctx.fillText(L('温度 →', 'temperature →'), 6, g.h - 6); ctx.save(); ctx.translate(14, 70); ctx.rotate(-Math.PI / 2); ctx.fillText(L('浓度 →', 'concentration →'), 0, 0); ctx.restore();
      const fin = (st) => q(res[st].map((r) => fmax - r.hist.at(-1)), 0.5), hit = (st) => res[st].filter((r) => fmax - r.hist.at(-1) < 0.05).length;
      return Object.keys(res).reverse().map((st) => [`${names[st]}${L('：最后差距的中位数 · 找到全局峰的次数', ': median final gap · runs that found the global peak')}`, `${fix(fin(st), 3)} · ${hit(st)} / ${s.reps}`, st === 'ei']);
    },
  };

  // ── 10. 主动学习 ─────────────────────────────────────────────────
  const AL = [['random', L('随机挑', 'Random')], ['fixed', L('方差最大（长度固定 0.25）', 'Largest variance (length fixed at 0.25)')], ['var', L('方差最大（长度按数据调）', 'Largest variance (length tuned to the data)')]];
  DEMOS.active = {
    title: L('主动学习：下一次计算算哪个分子', 'Active learning: which molecule to compute next'), kind: 'sim',
    intro: L('一个“性质随描述符”的函数，大部分平缓，0.7 附近有一个陡的台阶（比如反应机理在那里改变）。我们有 200 个候选点，每“标注”一个（做一次 DFT 或实验）都很贵。随机挑要很多点才能把台阶描出来；挑模型最不确定的点（方差最大）要好得多，但前提是模型的长度会跟着数据调：长度固定时，方差只和点的位置有关，策略退化成均匀铺点。', 'A “property versus descriptor” function that is mostly gentle with a steep step near 0.7 (say where a reaction mechanism changes). There are 200 candidate points and each “label” (a DFT calculation or an experiment) is expensive. Random picking needs many points to trace the step; picking where the model is most uncertain (largest variance) does much better, but only if the model’s length scale adapts to the data: with a fixed length the variance depends only on where the points are, and the strategy degenerates into spreading points evenly.'),
    sel: [['st', L('挑点的策略（上图）', 'Picking strategy (top plot)'), AL, 'var']],
    ctl: [['budget', L('标注预算', 'Labelling budget'), 6, 40, 1, 20, (v) => String(v)], ['seed', L('随机种子', 'Random seed'), 1, 10, 1, 1, (v) => String(v)]],
    figs: [[0.5, L('模型（绿）和真函数（虚线）；金点是挑中的点，颜色越深越晚挑；灰色的竖线是候选池。', 'The model (green) and true function (dashed); gold dots are the chosen points, darker means later; grey ticks are the candidate pool.')], [0.42, L('测试误差（RMS）对标注数，三种策略各 5 次的平均（对数坐标）。', 'Test error (RMS) against labels, mean of 5 runs per strategy (log scale).')]],
    note: L('起始 4 个点随机挑；模型都是高斯过程，长度和噪声按边际似然在网格上挑。“方差最大（长度固定）”只在挑点的时候用一个长度固定为 0.25 的高斯过程。测试误差在 301 个等距点上算。委员会查询（几个模型分歧最大的点）是另一种常用的做法，这个例子里用自助抽样的委员会并不比随机好，所以没有放进来。', 'The first 4 points are random; all models are GPs with length and noise picked on a grid by marginal likelihood. “Largest variance (length fixed)” uses a GP with length fixed at 0.25 only for choosing points. The test error is computed on 301 equally spaced points. Query by committee (where several models disagree most) is another common approach; in this example a bootstrap committee did no better than random, so it is not shown.'),
    draw(s, [cv, cv2], c) {
      const run = cache(`al${s.st},${s.budget},${s.seed}`, () => M.activeRun(s.st, { budget: s.budget, seed: s.seed }));
      const xs = lin(0, 1, 240), mu = xs.map((x) => run.model.predict([x])[0]);
      const pool = (() => { const R = M.rng(s.seed * 31 + 5); return range(200).map(() => R()); })();
      plot(cv, { x: [0, 1], y: [-0.5, 1.6], xl: L('描述符', 'descriptor'), yl: L('性质', 'property'), series: [{ xs, ys: xs.map(M.step1), color: c.ink2, dash: [5, 4], width: 1.4 }, { xs, ys: mu, color: c.accent, width: 2.4 }],
        after: ({ ctx, X, Y }) => { ctx.strokeStyle = c.line; ctx.lineWidth = 1; for (const p of pool) { ctx.beginPath(); ctx.moveTo(X(p), Y(-0.5)); ctx.lineTo(X(p), Y(-0.42)); ctx.stroke(); } run.taken.forEach((x, k) => { ctx.globalAlpha = 0.35 + (0.65 * k) / run.taken.length; ctx.fillStyle = c.gold; ctx.beginPath(); ctx.arc(X(x), Y(M.step1(x)), 4.5, 0, 2 * Math.PI); ctx.fill(); }); ctx.globalAlpha = 1; } });
      const avg = cache(`alavg${s.budget}`, () => Object.fromEntries(AL.map(([st]) => { const runs = range(5).map((r) => M.activeRun(st, { budget: s.budget, seed: r + 1 }).curve); return [st, runs[0].map(([n], i) => [n, M.mean(runs.map((cv_) => cv_[i][1]))])]; })));
      const col = { random: c.muted, fixed: c.info, var: c.accent };
      const all = Object.values(avg).flat().map((p) => Math.log10(p[1]));
      plot(cv2, { x: [4, s.budget], y: [Math.min(...all) - 0.1, Math.max(...all) + 0.1], logy: true, yt: [-3, -2.5, -2, -1.5, -1, -0.5, 0], yf: (t) => fmt(10 ** t, 2), xl: L('标注数', 'labels'), yl: 'RMSE', series: AL.map(([st, nm]) => ({ xs: avg[st].map((p) => p[0]), ys: avg[st].map((p) => p[1]), color: col[st], width: st === s.st ? 2.8 : 1.8, label: nm.split('（')[0].split(' (')[0] + (st === 'fixed' ? L('（固定）', ' (fixed)') : st === 'var' ? L('（调）', ' (tuned)') : '') })) });
      const fin = (st) => avg[st].at(-1)[1], near = run.taken.filter((x) => Math.abs(x - 0.7) < 0.08).length;
      return [[L('这一次的测试误差', 'Test error of this run'), fix(run.curve.at(-1)[1], 4), true], [L('挑在台阶附近（0.62–0.78）的点', 'Points chosen near the step (0.62–0.78)'), `${near} / ${run.taken.length}`], [L('5 次平均：随机 / 固定 / 调', 'Mean of 5: random / fixed / tuned'), `${fix(fin('random'), 4)} / ${fix(fin('fixed'), 4)} / ${fix(fin('var'), 4)}`], [L('模型挑的长度', 'Length picked by the model'), fix(run.model.l, 3)]];
    },
  };

  // ── 11. n 元语言模型生成 SMILES ─────────────────────────────────
  DEMOS.ngram = {
    title: L('最简单的生成模型：会“写” SMILES 的 n 元模型', 'The simplest generative model: an n-gram that “writes” SMILES'), kind: 'sim',
    intro: L('把 174 个常见小分子的 SMILES 拆成记号（C、c、Cl、=、(、1……），统计“前 n − 1 个记号之后下一个是什么”，再按这个统计一个记号一个记号地写新字符串。n 小，写出来的东西常常读不通（括号、环号不配对）；n 大，几乎都有效，但大部分是在背训练集。生成模型的三个最基本的指标：有效率、唯一率、新颖率，就是在这个张力里取舍。RNN、Transformer 是把 n 做得很大、又不至于只会背的办法。', 'Split the SMILES of 174 common small molecules into tokens (C, c, Cl, =, (, 1, …), count “which token follows the previous n − 1 tokens”, and write new strings token by token from those counts. With small n the output often fails to parse (unmatched brackets or ring closures); with large n nearly everything is valid, but most of it is memorised training data. The three most basic metrics of a generative model, validity, uniqueness and novelty, trade off along exactly this tension. RNNs and Transformers are ways of making n very large without merely memorising.'),
    ctl: [['n', L('n（看前面几个记号 + 1）', 'n (context length + 1)'), 2, 8, 1, 4, (v) => String(v)], ['temp', L('温度', 'Temperature'), 0.3, 1.6, 0.05, 1, (v) => v.toFixed(2)], ['count', L('生成多少条', 'Strings to generate'), 50, 400, 50, 200, (v) => String(v)]],
    state: { seed: 1 },
    act: [[L('换一批', 'New batch'), (s) => { s.seed++; }]],
    figs: [['html', L('前 30 条。绿色：有效且训练集里没有；金色：有效但是训练集里的分子；灰色：读不通。', 'The first 30. Green: valid and not in the training set; gold: valid but a training molecule; grey: does not parse.')], [0.42, L('有效率、唯一率、新颖率随 n 的变化（当前温度，每个 n 生成 200 条）。', 'Validity, uniqueness and novelty against n (current temperature, 200 strings per n).')]],
    note: L('有效 = 能被本页的读法读通（价态、环、括号、凯库勒式都检查）。唯一 = 有效的里面互不相同的比例；新颖 = 唯一的里面不在训练集的比例。“是不是同一个分子”用分子式加半径 3 的指纹判断，这是近似：极少数不同的分子会被当成同一个。温度 T：按计数的 1/T 次方抽，T 小更保守。上下文没见过时退回更短的上下文。', 'Valid = parsed by this page’s reader (valences, rings, brackets and Kekulé forms are all checked). Unique = fraction of valid strings that are distinct; novel = fraction of unique ones absent from the training set. “Same molecule” is judged by formula plus a radius-3 fingerprint, an approximation: very rarely two different molecules are treated as one. Temperature T: sample proportional to count^(1/T); small T is more conservative. Unseen contexts back off to shorter ones.'),
    draw(s, [box, cv], c) {
      const E = M.ngramEval(s.n, s.count, s.temp, s.seed), train = new Set(M.CORPUS.map(M.molKeyOf));
      box.innerHTML = `<ol class="cml-gen">${E.samples.slice(0, 30).map(({ s: str, m }) => { const k = m.ok ? M.molKey(m) : '', cls = !m.ok ? 'bad' : train.has(k) ? 'old' : 'new'; return `<li class="is-${cls}"><code>${esc(str || '∅')}</code>${m.ok ? `<span>${esc(m.formula)}</span>` : ''}</li>`; }).join('')}</ol>`;
      const ns = [2, 3, 4, 5, 6, 7, 8], S = cache(`ng${s.temp}`, () => ns.map((n) => M.ngramEval(n, 200, s.temp, 1)));
      plot(cv, { x: [1.6, 8.4], y: [0, 1.05], xt: ns, xl: 'n', series: [{ xs: ns, ys: S.map((e) => e.validity), color: c.accent, width: 2.4, dots: 3.5, line: true, label: L('有效', 'valid') }, { xs: ns, ys: S.map((e) => e.uniqueness), color: c.info, width: 2, dots: 3, line: true, label: L('唯一', 'unique') }, { xs: ns, ys: S.map((e) => e.novelty), color: c.gold, width: 2, dots: 3, line: true, label: L('新颖', 'novel') }], marks: [{ x: s.n, color: c.danger }] });
      return [[L('有效率', 'Validity'), pct(E.validity), true], [L('唯一率', 'Uniqueness'), pct(E.uniqueness)], [L('新颖率', 'Novelty'), pct(E.novelty)], [L('有效、唯一而且新的分子', 'Valid, unique and new molecules'), `${E.nNovel} / ${s.count}`]];
    },
  };

  // ── 12. 代理模型被“钻空子” ───────────────────────────────────────
  const GH = (() => { const R = M.rng(5); return range(12).map(() => { const x = 0.2 + 0.4 * R(); return [x, M.proxyTruth(x) + 0.03 * R.normal()]; }); })();
  DEMOS.goodhart = {
    title: L('优化代理模型：模型说好的地方不一定真的好', 'Optimising a proxy: where the model says “great” may not be'), kind: 'toy',
    intro: L('生成模型和优化算法常常拿一个预测模型当“打分器”，然后去找分数最高的分子。问题是：打分器只在训练数据附近可信。这里 12 个数据点都在 0.2–0.6 之间，用多项式拟合；阶数高时，模型在数据外面翻上天，优化器就会挑那里（红星），真实的值却很差。只在“适用域”（离最近的数据不超过 δ）里优化（绿星），结果平庸但可靠。“当一个指标变成目标，它就不再是好指标”（Goodhart 定律）。', 'Generative models and optimisers often use a predictive model as the “scorer” and then hunt for the highest-scoring molecule. The catch: the scorer is trustworthy only near its training data. Here all 12 data points lie between 0.2 and 0.6 and are fitted with a polynomial; at high degree the model shoots up outside the data, the optimiser picks there (red star), and the true value is poor. Optimising only within the “applicability domain” (no further than δ from the nearest data point, green star) gives a modest but reliable result. “When a measure becomes a target, it ceases to be a good measure” (Goodhart’s law).'),
    ctl: [['deg', L('多项式阶数', 'Polynomial degree'), 1, 9, 1, 6, (v) => String(v)], ['delta', L('适用域 δ', 'Applicability domain δ'), 0, 0.3, 0.01, 0.05, (v) => v.toFixed(2)]],
    figs: [[0.56, L('虚线：真函数；绿线：代理模型；金点：数据；灰带：适用域。红星：在整个范围里优化代理模型；绿星：只在适用域里优化。', 'Dashed: true function; green: proxy model; gold: data; grey band: applicability domain. Red star: optimise the proxy over the whole range; green star: optimise within the domain only.')]],
    note: L('真函数 f(x) = exp(−((x − 0.45)/0.25)²) + 0.25x，在 [0, 1] 上的最大值在 x ≈ 0.52。数据有 0.03 的噪声。多项式用 (2x − 1) 的幂做基，带 10⁻⁶ 的岭正则。这是一个刻意简单的例子；在分子生成里同样的事表现为“分数很高但合成不了、或者根本不稳定的分子”。', 'True function f(x) = exp(−((x − 0.45)/0.25)²) + 0.25x, maximised on [0, 1] near x ≈ 0.52. The data carry noise 0.03. The polynomial uses powers of (2x − 1) with a 10⁻⁶ ridge penalty. This is a deliberately simple example; in molecule generation the same thing shows up as “molecules that score very high but cannot be made, or are not even stable”.'),
    draw(s, [cv], c) {
      const m = M.polyFit(GH.map((p) => p[0]), GH.map((p) => p[1]), s.deg), xs = lin(0, 1, 401), pr = xs.map((x) => m.predict([x]));
      const inDom = (x) => GH.some(([px]) => Math.abs(px - x) <= s.delta);
      let ia = 0, ib = -1; xs.forEach((x, i) => { if (pr[i] > pr[ia]) ia = i; if (inDom(x) && (ib < 0 || pr[i] > pr[ib])) ib = i; });
      const tmax = Math.max(...xs.map(M.proxyTruth)), lo = Math.min(0, ...xs.map(M.proxyTruth)) - 0.3, hi = Math.max(1.6, pr[ia] + 0.2) > 4 ? 4 : Math.max(1.6, pr[ia] + 0.2);
      const star = (ctx, x, y, col) => { ctx.fillStyle = col; ctx.beginPath(); for (let k = 0; k < 10; k++) { const r = k % 2 ? 4 : 10, a = -Math.PI / 2 + (k * Math.PI) / 5; ctx.lineTo(x + r * Math.cos(a), y + r * Math.sin(a)); } ctx.closePath(); ctx.fill(); };
      plot(cv, { x: [0, 1], y: [lo, hi], xl: 'x', yl: L('分数', 'score'), bands: GH.map(([px]) => ({ x0: px - s.delta, x1: px + s.delta, color: c.muted, alpha: 0.07 })), series: [{ xs, ys: xs.map(M.proxyTruth), color: c.ink2, dash: [5, 4], width: 1.6 }, { xs, ys: pr, color: c.accent, width: 2.4 }, { xs: GH.map((p) => p[0]), ys: GH.map((p) => p[1]), dots: 4, color: c.gold }],
        after: ({ ctx, X, Y }) => { star(ctx, X(xs[ia]), Y(Math.min(hi - 0.05, pr[ia])), c.danger); if (ib >= 0) star(ctx, X(xs[ib]), Y(pr[ib]), c.ok); } });
      return [[L('红星：模型预测 / 真实值', 'Red star: predicted / true'), `${fix(pr[ia], 2)} / ${fix(M.proxyTruth(xs[ia]), 2)} @ x = ${fix(xs[ia], 2)}`, true], [L('绿星：模型预测 / 真实值', 'Green star: predicted / true'), ib >= 0 ? `${fix(pr[ib], 2)} / ${fix(M.proxyTruth(xs[ib]), 2)} @ x = ${fix(xs[ib], 2)}` : '—'], [L('真实的最大值', 'True maximum'), fix(tmax, 2)]];
    },
  };

  // ── 13. Pareto 前沿 ─────────────────────────────────────────────
  DEMOS.pareto = {
    title: L('两个目标：产率高，又要绿色', 'Two objectives: high yield and green'), kind: 'toy',
    intro: L('真实的实验室要同时照顾好几个目标：产率、选择性、成本、能耗、安全。一般没有一个条件让所有目标都最好，只有一条 Pareto 前沿：在它上面，想让一个目标更好，就必须让另一个变差。点表示随机试过的条件，金色的是前沿。拖动权重 w，用加权和 w·产率 + (1 − w)·绿色程度 挑一个点：你会发现前沿上凹进去的那一段，无论 w 取多少都挑不到。这是多目标优化要用超体积等指标的原因。', 'A real laboratory juggles several objectives at once: yield, selectivity, cost, energy, safety. Usually no condition is best at all of them; there is only a Pareto front, along which improving one objective means worsening another. Dots are randomly tried conditions; gold ones form the front. Drag the weight w to pick a point with the weighted sum w·yield + (1 − w)·greenness: the dented part of the front is never picked, whatever w is. That is why multi-objective optimisation uses measures such as the hypervolume.'),
    ctl: [['n', L('试过的条件数', 'Conditions tried'), 10, 400, 10, 120, (v) => String(v)], ['w', L('权重 w（产率）', 'Weight w (yield)'), 0, 1, 0.01, 0.5, (v) => v.toFixed(2)]],
    state: { seed: 1 },
    act: [[L('换一批条件', 'New set of conditions'), (s) => { s.seed++; }]],
    figs: [[0.7, L('每个点是一个条件的两个目标值（都是越大越好）。金色：Pareto 前沿；红圈：加权和挑中的点；浅金色的面积是超体积（参照点是原点）。', 'Each dot is one condition’s two objective values (larger is better for both). Gold: the Pareto front; red ring: the weighted-sum pick; the light gold area is the hypervolume (reference point at the origin).')]],
    note: L('玩具反应：条件 x = (温度, 催化剂用量) 在 [0, 1]² 上均匀随机抽；产率 = 1 − exp(−3(0.25 + 0.9x₁)(0.3 + x₂)) − 0.15(x₁ − 0.8)²，绿色程度 = 1 − 0.55x₁² − 0.45x₂ − 0.18 sin²(3πx₁x₂)。“能被加权和挑到的前沿点”是把 w 从 0 扫到 1（201 个值）数出来的。', 'Toy reaction: conditions x = (temperature, catalyst loading) uniformly random on [0, 1]²; yield = 1 − exp(−3(0.25 + 0.9x₁)(0.3 + x₂)) − 0.15(x₁ − 0.8)², greenness = 1 − 0.55x₁² − 0.45x₂ − 0.18 sin²(3πx₁x₂). “Front points reachable by a weighted sum” are counted by sweeping w from 0 to 1 (201 values).'),
    draw(s, [cv], c) {
      const R = M.rng(s.seed * 101), P = range(s.n).map(() => M.objectives([R(), R()])), F = M.paretoIdx(P).sort((a, b) => P[a][0] - P[b][0]), pick = M.weightedPick(P, s.w);
      const reach = new Set(lin(0, 1, 201).map((w) => M.weightedPick(P, w)));
      plot(cv, { x: [0, 1.02], y: [0, 1.02], xl: L('产率', 'yield'), yl: L('绿色程度', 'greenness'), series: [{ xs: P.map((p) => p[0]), ys: P.map((p) => p[1]), dots: 2.6, color: c.muted }, { xs: F.map((i) => P[i][0]), ys: F.map((i) => P[i][1]), dots: 4.2, color: c.gold }],
        after: ({ ctx, X, Y }) => {
          ctx.fillStyle = c.gold; ctx.globalAlpha = 0.12; const desc = F.slice().sort((a, b) => P[b][0] - P[a][0]); let yPrev = 0; for (const i of desc) { if (P[i][1] > yPrev) { ctx.fillRect(X(0), Y(P[i][1]), X(P[i][0]) - X(0), Y(yPrev) - Y(P[i][1])); yPrev = P[i][1]; } } ctx.globalAlpha = 1;
          ctx.strokeStyle = c.gold; ctx.lineWidth = 1.4; ctx.beginPath(); F.forEach((i, k) => (k ? ctx.lineTo(X(P[i][0]), Y(P[i][1])) : ctx.moveTo(X(P[i][0]), Y(P[i][1])))); ctx.stroke();
          for (const i of F) if (!reach.has(i)) { ctx.strokeStyle = c.info; ctx.lineWidth = 1.4; ctx.beginPath(); ctx.arc(X(P[i][0]), Y(P[i][1]), 6.5, 0, 2 * Math.PI); ctx.stroke(); }
          ctx.strokeStyle = c.danger; ctx.lineWidth = 2.4; ctx.beginPath(); ctx.arc(X(P[pick][0]), Y(P[pick][1]), 8, 0, 2 * Math.PI); ctx.stroke();
        } });
      const onF = F.filter((i) => reach.has(i)).length;
      return [[L('前沿上的点', 'Points on the front'), String(F.length)], [L('能被加权和挑到的', 'Reachable by a weighted sum'), `${onF} / ${F.length}${F.length - onF ? L('（蓝圈是挑不到的）', ' (blue rings cannot be reached)') : ''}`, true], [L('超体积', 'Hypervolume'), fix(M.hypervolume(P), 4)], [L('挑中的点（产率, 绿色）', 'Pick (yield, greenness)'), `(${fix(P[pick][0], 3)}, ${fix(P[pick][1], 3)})`]];
    },
  };

  // ── 14. 批量实验 ─────────────────────────────────────────────────
  DEMOS.batch = {
    title: L('一次做几个实验：批量的代价和好处', 'Several experiments at once: the cost and benefit of batches'), kind: 'sim',
    intro: L('机器人平台常常一次并行做 4、8、96 个反应。一次挑一批，要在不知道这一批结果的情况下挑出彼此不重复的点：这里用 kriging believer，把刚挑中的点按模型的均值“假装测过”，再挑下一个。左图按“轮”数（实验室的时间）比，大批量快得多；右图按实验总数（试剂和成本）比。在光滑、单峰的问题上，批量通常要多花一些实验；在这个两个峰的曲面上，结果主要看有没有碰到窄的全局峰，一批里散开的点有时反而帮它跳出局部峰，所以按实验数比不一定吃亏。批量多大合适，取决于你缺的是时间还是材料。', 'Robotic platforms often run 4, 8 or 96 reactions in parallel. Choosing a batch means picking mutually distinct points without knowing the batch’s results: here by the kriging believer, which pretends each newly chosen point was measured at the model’s mean before choosing the next. Left: compared by rounds (laboratory time), large batches are much faster; right: compared by total experiments (reagents and cost). On smooth single-peaked problems batches usually cost somewhat more experiments; on this two-peaked surface the outcome mostly depends on whether the narrow global peak is hit, and the spread-out points of a batch sometimes help escape the local peak, so batches need not lose per experiment. The right batch size depends on whether you are short of time or of material.'),
    ctl: [['budget', L('实验总数', 'Total experiments'), 16, 32, 4, 32, (v) => String(v)], ['reps', L('每种重复几次', 'Repeats each'), 3, 8, 1, 8, (v) => String(v)]],
    figs: [[0.5, L('最好产率的中位数对“轮数”（一轮是一批实验并行做完）。', 'Median best yield against rounds (one round = one batch run in parallel).')], [0.5, L('最好产率的中位数对实验总数。', 'Median best yield against the total number of experiments.')]],
    note: L('问题同上一章的二维产率曲面，采集函数是 EI，4 个拉丁超立方起始点算第 0 轮。批量 q = 1、2、4、8。kriging believer 是最简单的批量方法之一，BoTorch 等库里还有按蒙特卡罗积分的 q-EI。', 'Same 2D yield surface as in the previous chapter, EI acquisition, the 4 Latin-hypercube starting points count as round 0. Batch sizes q = 1, 2, 4, 8. The kriging believer is one of the simplest batch methods; libraries such as BoTorch also offer Monte-Carlo q-EI.'),
    draw(s, [cv, cv2], c) {
      const qs = [1, 2, 4, 8], fmax = cache('f2max', () => M.maxOn(M.yield2, 2));
      const res = cache(`bt${s.budget},${s.reps}`, () => Object.fromEntries(qs.map((q) => [q, range(s.reps).map((r) => M.boRun(M.yield2, 2, 'ei', { seed: r + 1, budget: s.budget, n0: 4, q }).hist)])));
      const col = { 1: c.accent, 2: c.info, 4: c.gold, 8: c.danger }, med = (H, i) => M.median(H.map((h) => h[Math.min(i, h.length - 1)]));
      const byRound = qs.map((q) => { const rounds = Math.ceil((s.budget - 4) / q), xs = range(rounds + 1); return { q, xs, ys: xs.map((r) => med(res[q], Math.min(3 + r * q, s.budget - 1))) }; });
      plot(cv, { x: [0, s.budget - 4], y: [0.3, 1], xl: L('轮数', 'rounds'), yl: L('最好的产率', 'best yield'), series: byRound.map((b) => ({ xs: b.xs, ys: b.ys, color: col[b.q], width: 2.2, dots: 2.5, line: true, label: `q = ${b.q}` })), hmarks: [{ y: fmax, color: c.muted }] });
      const ns = range(s.budget).map((i) => i + 1);
      plot(cv2, { x: [1, s.budget], y: [0.3, 1], xl: L('实验总数', 'experiments'), yl: L('最好的产率', 'best yield'), series: qs.map((q) => ({ xs: ns, ys: ns.map((_, i) => med(res[q], i)), color: col[q], width: 2.2, label: `q = ${q}` })), hmarks: [{ y: fmax, color: c.muted }] });
      const roundsTo = (q, thr) => { const b = byRound.find((x) => x.q === q), k = b.ys.findIndex((v) => v >= thr); return k < 0 ? '—' : String(k); };
      const hits = (q) => res[q].filter((h) => fmax - h.at(-1) < 0.05).length;
      return qs.map((q) => [L(`q = ${q}：到 0.85 要几轮 · 找到全局峰的次数`, `q = ${q}: rounds to reach 0.85 · runs that found the global peak`), `${roundsTo(q, 0.85)} · ${hits(q)} / ${s.reps}`, q === 4]);
    },
  };

  // ── 15. 随机划分和骨架划分 ──────────────────────────────────────
  const SPL = [['random', L('随机划分', 'Random split')], ['scaffold', L('骨架划分', 'Scaffold split')], ['time', L('时间划分', 'Time split')]];
  DEMOS.split = {
    title: L('同一个模型，换一种划分，分数掉一半', 'Same model, different split, half the score'), kind: 'toy',
    intro: L('化学数据集里的分子常常一簇一簇的：同一个骨架上换几个取代基。随机划分时，测试集里的分子几乎都有“兄弟”在训练集里，模型只要会找最近的兄弟就能拿高分。骨架划分把整簇留作测试，问的是“没见过的骨架能不能预测”，这才接近真实的用法（你要预测的通常是新骨架）。时间划分（训练用早期的，测试用最近的）更严格，因为化学家的兴趣会随时间漂移。', 'Molecules in chemical datasets usually come in clusters: one scaffold with a few different substituents. Under a random split almost every test molecule has a “sibling” in the training set, and a model that merely finds its nearest sibling scores well. A scaffold split holds out whole clusters and asks “can unseen scaffolds be predicted?”, much closer to real use (what you want to predict is usually a new scaffold). A time split (train on early compounds, test on recent ones) is stricter still, because chemists’ interests drift over time.'),
    sel: [['how', L('上图显示哪种划分', 'Split shown in the top plot'), SPL, 'scaffold'], ['model', L('模型', 'Model'), [['knn', L('3 近邻', '3-nearest neighbours')], ['krr', L('核岭回归', 'Kernel ridge regression')]], 'knn']],
    ctl: [['offset', L('骨架自己的偏移（骨架效应）', 'Scaffold-specific offset (scaffold effect)'), 0, 0.6, 0.05, 0.35, (v) => v.toFixed(2)], ['spread', L('簇的大小', 'Cluster size'), 0.01, 0.12, 0.005, 0.035, (v) => v.toFixed(3)]],
    figs: [[0.62, L('描述符空间：每个点是一个分子，24 个骨架各 10 个。实心是训练集，空心圈是测试集。', 'Descriptor space: each dot a molecule, 10 for each of 24 scaffolds. Filled: training set; open rings: test set.')], [0.36, L('三种划分的测试 MAE，5 个随机种子的平均（竖线是最小到最大）。', 'Test MAE of the three splits, mean of 5 random seeds (bars span minimum to maximum).')]],
    note: L('性质 = 第一章的光滑函数 + 每个骨架一个正态分布的偏移（标准差就是滑杆的值）+ 0.05 的噪声。“时间”按骨架编号排序：后来的骨架整体是新的，所以和骨架划分接近。真实数据里骨架用 Bemis–Murcko 的方法从结构里切出来；这里直接造了簇。', 'Property = the smooth function of chapter 1 + a normally distributed offset per scaffold (its standard deviation is the slider value) + noise 0.05. “Time” orders by scaffold number: later scaffolds are entirely new, so it is close to the scaffold split. In real data, scaffolds are cut from structures by the Bemis–Murcko method; here clusters are generated directly.'),
    draw(s, [cv, cv2], c) {
      const opt = { offset: s.offset, spread: s.spread }, D = M.scaffoldData({ ...opt, seed: 1 }), R = M.splitScore(D, s.how, s.model, 1), test = new Set(R.S.test);
      const pal = [c.accent, c.gold, c.info, c.danger, c.ok, c.violet || c.ink2];
      plot(cv, { x: [-0.1, 1.1], y: [-0.1, 1.1], eq: true, xl: L('描述符 1', 'descriptor 1'), yl: L('描述符 2', 'descriptor 2'), series: [],
        after: ({ ctx, X, Y }) => { D.forEach((d, i) => { const col = pal[d.g % pal.length]; ctx.strokeStyle = col; ctx.fillStyle = col; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(X(d.x[0]), Y(d.x[1]), test.has(i) ? 4.5 : 3, 0, 2 * Math.PI); if (test.has(i)) ctx.stroke(); else ctx.fill(); }); } });
      const key = `sp${s.offset},${s.spread},${s.model}`;
      const stats = cache(key, () => SPL.map(([h]) => { const v = range(5).map((sd) => M.splitScore(M.scaffoldData({ ...opt, seed: sd + 1 }), h, s.model, sd + 1).mae); return [M.mean(v), Math.min(...v), Math.max(...v)]; }));
      const ymax = Math.max(...stats.map((x) => x[2])) * 1.15;
      plot(cv2, { x: [-0.6, 2.6], y: [0, ymax], xt: [0, 1, 2], xf: (i) => SPL[i]?.[1] || '', yl: 'MAE', series: [{ xs: [0, 1, 2], ys: stats.map((x) => x[0]), bars: 0.55, color: c.accent }],
        after: ({ ctx, X, Y }) => { ctx.strokeStyle = c.ink2; ctx.lineWidth = 1.5; stats.forEach(([, lo, hi], i) => { ctx.beginPath(); ctx.moveTo(X(i), Y(lo)); ctx.lineTo(X(i), Y(hi)); ctx.stroke(); }); } });
      return [[L('这一次的测试 MAE', 'Test MAE of this split'), fix(R.mae, 3), true], [L('测试分子到最近训练分子的平均距离', 'Mean distance from test to nearest training molecule'), fix(R.near, 3)], [L('5 次平均 MAE：随机 / 骨架 / 时间', 'Mean MAE of 5: random / scaffold / time'), stats.map((x) => fix(x[0], 3)).join(' / ')], [L('骨架划分比随机划分差几倍', 'Scaffold MAE ÷ random MAE'), fix(stats[1][0] / stats[0][0], 2)]];
    },
  };

  // ── 16. 特征筛选泄漏 ────────────────────────────────────────────
  DEMOS.leak = {
    title: L('纯噪声也能“预测”：特征筛选的泄漏', 'Predicting pure noise: leakage through feature selection'), kind: 'sim',
    intro: L('这份数据完全是随机数：n 个“分子”、p 个随机“描述符”、随机的“活性”。任何模型的真实 R² 都应该是 0 或更低。错误的做法：先用全部数据挑出和活性最相关的 k 个描述符，再做交叉验证；测试集已经参与了挑选，于是交叉验证报出一个漂亮的正 R²。正确的做法：在每一折里只用训练部分挑描述符，R² 立刻回到 0 以下。描述符越多、样本越少，假象越大。', 'These data are pure random numbers: n “molecules”, p random “descriptors” and a random “activity”. Any model’s true R² should be 0 or below. Wrong: first use all the data to pick the k descriptors most correlated with activity, then cross-validate; the test folds already took part in the selection, so cross-validation reports a handsome positive R². Right: within each fold select descriptors on the training part only, and R² drops straight back below 0. The more descriptors and the fewer samples, the bigger the illusion.'),
    ctl: [['p', L('描述符个数 p', 'Descriptors p'), 20, 2000, 20, 500, (v) => String(v)], ['n', L('样本数 n', 'Samples n'), 20, 120, 5, 40, (v) => String(v)], ['k', L('挑出几个 k', 'Selected k'), 1, 30, 1, 10, (v) => String(v)]],
    figs: [[0.46, L('10 个随机数据集上 5 折交叉验证的 R²：左边是先挑特征再验证（泄漏），右边是在每一折里挑（正确）。每个点是一个数据集，横线是平均值。', '5-fold cross-validated R² on 10 random datasets: left, features selected before validation (leaky); right, selected inside each fold (correct). Each dot is a dataset; the bar is the mean.')]],
    note: L('模型是带 λ = 1 的岭回归，特征按和活性的皮尔逊相关系数的绝对值挑。R² = 1 − Σ(y − ŷ)²/Σ(y − ȳ)²，用交叉验证的预测拼起来算。Ambroise 和 McLachlan 2002 年在基因表达数据里指出过同样的错误；化学里常见的变体是在全部数据上做标准化、去相关或者调超参数。', 'The model is ridge regression with λ = 1; features are ranked by the absolute Pearson correlation with activity. R² = 1 − Σ(y − ŷ)²/Σ(y − ȳ)², from the pooled cross-validated predictions. Ambroise and McLachlan pointed out the same error in gene-expression data in 2002; common chemical variants are scaling, decorrelating or tuning hyperparameters on the full data.'),
    draw(s, [cv], c) {
      const R = cache(`lk${s.p},${s.n},${s.k}`, () => range(10).map((sd) => M.leakage({ n: s.n, p: s.p, k: s.k, seed: sd + 1 })));
      const w = R.map((r) => r.wrong), r_ = R.map((r) => r.right), lo = Math.min(-1, ...r_, ...w), hi = Math.max(0.8, ...w);
      plot(cv, { x: [-0.6, 1.6], y: [Math.max(-3, lo - 0.1), hi + 0.1], xt: [0, 1], xf: (i) => [L('先挑后验（泄漏）', 'select first (leaky)'), L('每折里挑（正确）', 'select in each fold')][i] || '', yl: 'R²', series: [{ xs: w.map((_, i) => -0.15 + 0.03 * i), ys: w, dots: 4, color: c.danger }, { xs: r_.map((_, i) => 0.85 + 0.03 * i), ys: r_.map((v) => Math.max(-3, v)), dots: 4, color: c.accent }],
        hmarks: [{ y: 0, color: c.ink2 }], after: ({ ctx, X, Y }) => { ctx.lineWidth = 2.4; [[0, M.mean(w), c.danger], [1, M.mean(r_), c.accent]].forEach(([i, m, col]) => { ctx.strokeStyle = col; ctx.beginPath(); ctx.moveTo(X(i - 0.3), Y(Math.max(-3, m))); ctx.lineTo(X(i + 0.3), Y(Math.max(-3, m))); ctx.stroke(); }); } });
      return [[L('泄漏的 R²（平均）', 'Leaky R² (mean)'), fix(M.mean(w), 3), true], [L('正确的 R²（平均）', 'Correct R² (mean)'), fix(M.mean(r_), 3)], [L('泄漏的 R² > 0 的数据集', 'Datasets with leaky R² > 0'), `${w.filter((v) => v > 0).length} / 10`]];
    },
  };

  // ── 17. 不确定度校准 ─────────────────────────────────────────────
  DEMOS.calib = {
    title: L('模型说“误差 ±0.1”，可信吗：不确定度的校准', 'The model says “±0.1”: should you believe it? Calibrating uncertainty'), kind: 'sim',
    intro: L('主动学习、贝叶斯优化和“该不该做这个实验”都靠模型的误差棒。误差棒是对的，叫“校准”：说 68 % 的区间，应该真的有 68 % 的测试点落在里面。这里的数据从一个已知的高斯过程里抽（长度 0.12、噪声 0.1），再用你设的超参数拟合。长度设太长，模型过分自信，曲线掉到对角线下面；设对了，曲线贴着对角线。打开“按边际似然挑”，看看它能不能自己找回来。', 'Active learning, Bayesian optimisation and “should we run this experiment?” all rely on the model’s error bars. Error bars that are right are called “calibrated”: a 68 % interval should really contain 68 % of the test points. Here the data are drawn from a known Gaussian process (length 0.12, noise 0.1) and fitted with the hyperparameters you set. Too long a length scale makes the model over-confident and the curve sinks below the diagonal; the right one hugs the diagonal. Switch on “pick by marginal likelihood” and see whether it finds its way back.'),
    ctl: [['l', L('拟合用的长度 ℓ', 'Fitted length ℓ'), 0.02, 0.8, 0.01, 0.4, (v) => v.toFixed(2)], ['noise', L('拟合用的噪声', 'Fitted noise'), 0.01, 0.4, 0.01, 0.1, (v) => v.toFixed(2)], ['n', L('训练点数', 'Training points'), 8, 60, 1, 25, (v) => String(v)]],
    chk: [['auto', L('按边际似然挑超参数', 'Pick hyperparameters by marginal likelihood'), false]],
    state: { seed: 2 },
    act: [[L('换一份数据', 'New data'), (s) => { s.seed++; }]],
    btn: [[L('设对了', 'Set right'), { l: 0.12, noise: 0.1, auto: false }], [L('太自信', 'Over-confident'), { l: 0.5, noise: 0.03, auto: false }], [L('太谨慎', 'Under-confident'), { l: 0.04, noise: 0.35, auto: false }]],
    figs: [[0.46, L('训练点（金）、测试点（灰）和模型的 ±2σ 预测区间（含噪声）。', 'Training points (gold), test points (grey) and the model’s ±2σ predictive interval (noise included).')], [0.56, L('校准曲线：横轴是区间应有的覆盖率，纵轴是实际落进去的比例（200 个测试点）。', 'Calibration curve: the interval’s nominal coverage on the horizontal axis, the fraction of 200 test points actually inside on the vertical.')]],
    note: L('预测区间 = 后验均值 ± z·√(σ²_f + σ²_n)，覆盖率按正态分布的分位数换算。200 个测试点也有抽样误差（68 % 处约 ±3 %）。真实模型（神经网络、集成）更容易过分自信，常用的修正是在验证集上把 σ 整体乘一个系数（等张回归是更灵活的版本）。', 'Predictive interval = posterior mean ± z·√(σ²_f + σ²_n), with coverage converted through normal quantiles. 200 test points carry sampling error of their own (about ±3 % at 68 %). Real models (neural networks, ensembles) are more prone to over-confidence; a common fix is to rescale σ by one factor fitted on a validation set (isotonic regression is a more flexible version).'),
    draw(s, [cv, cv2], c) {
      const C = M.calibration({ l: s.l, noise: s.noise, n: s.n, seed: s.seed, auto: s.auto }), D = C.data, xs = lin(0, 1, 200);
      const nz = s.auto ? C.g.noise * C.g.s * C.g.s : s.noise * s.noise, P = xs.map((x) => C.g.predict([x])), mu = P.map((p) => p[0]), sd = P.map((p) => Math.sqrt(p[1] + nz));
      plot(cv, { x: [0, 1], y: [-3, 3], xl: 'x', yl: 'y', series: [{ xs, ys: mu.map((m, i) => m + 2 * sd[i]), color: c.muted, width: 1 }, { xs, ys: mu.map((m, i) => m - 2 * sd[i]), color: c.muted, width: 1 }, { xs, ys: mu, color: c.accent, width: 2.2 }, { xs: D.xs.slice(D.n), ys: D.ys.slice(D.n), dots: 2, color: c.muted }, { xs: D.xs.slice(0, D.n), ys: D.ys.slice(0, D.n), dots: 4, color: c.gold }] });
      plot(cv2, { x: [0, 1], y: [0, 1], eq: true, xl: L('应有的覆盖率', 'nominal coverage'), yl: L('实际覆盖率', 'observed coverage'), series: [{ xs: [0, 1], ys: [0, 1], color: c.ink2, dash: [4, 4], width: 1.2 }, { xs: C.levels, ys: C.cover, color: c.accent, width: 2.4, dots: 3, line: true }] });
      const at = (p) => C.cover[C.levels.findIndex((v) => Math.abs(v - p) < 1e-9)];
      const z2 = M.mean(C.z.map((v) => v * v));
      return [[L('65 % 区间实际盖住', '65 % interval actually covers'), pct(at(0.65)), true], [L('90 % 区间实际盖住', '90 % interval actually covers'), pct(at(0.9))], [L('平均 z²（校准好时约为 1）', 'Mean z² (about 1 when calibrated)'), fix(z2, 2)], [L('用的长度 / 噪声', 'Length / noise in use'), s.auto ? `${fix(C.g.l, 2)} / ${fix(Math.sqrt(C.g.noise) * C.g.s, 2)}` : `${fix(s.l, 2)} / ${fix(s.noise, 2)}`]];
    },
  };
};
