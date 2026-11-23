'use strict';
// 化学机器学习 · 结构–性质图（第九章的 Chemiscope 演示）的纯逻辑：没有 DOM，tools/chemml-map-test.mjs 测。
// 数据在 cml-map-data.js（node tools/chemml-map.mjs 生成，分子和性质来自 tools/chemml-map/build.py）。
// 内容：主成分分析（幂迭代 + 收缩，符号固定）· 指纹矩阵和描述符矩阵 · 随机划分和按 Bemis–Murcko 骨架分组的划分 ·
// 测试分子到训练集的最近邻 Tanimoto · Tanimoto 加权的 k 近邻预测 · 拼成 Chemiscope 读的数据集（structures、properties、settings）。
// 页面经 window.MOLASTRIA_CHEMML_MAP_CORE 拿到它们；指纹用同一栏目的 cml-models.js（ecfp、tanimoto），作为参数 M 传进来。
(() => {
  const range = (n) => Array.from({ length: n }, (_, i) => i);
  const mean = (v) => v.reduce((s, x) => s + x, 0) / v.length;
  // 和 cml-models.js 同一个带种子的随机数（mulberry32）
  function rng(seed) {
    let a = (seed >>> 0) || 1;
    const next = () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
    next.shuffle = (arr) => { const b = arr.slice(); for (let i = b.length - 1; i > 0; i--) { const j = Math.floor(next() * (i + 1)); [b[i], b[j]] = [b[j], b[i]]; } return b; };
    return next;
  }

  // ── 主成分分析 ─────────────────────────────────────────────────────
  // X：n 行 d 列。先减去每列的均值（standardize 时再除以标准差），用幂迭代求协方差矩阵的前 k 个本征向量，每求出一个就从矩阵里收缩掉。
  // 不显式组协方差矩阵（d 可以是 1024），每步只算 Xᵀ(Xv)。每个主成分的符号定成“绝对值最大的那个载荷是正的”，这样结果和起点无关。
  function pca(X, k = 2, { standardize = false, iters = 500, tol = 1e-12 } = {}) {
    const n = X.length, d = X[0].length;
    const mu = range(d).map((j) => mean(X.map((r) => r[j])));
    const sd = range(d).map((j) => (standardize ? Math.sqrt(mean(X.map((r) => (r[j] - mu[j]) ** 2))) || 1 : 1));
    const Z = X.map((r) => r.map((v, j) => (v - mu[j]) / sd[j]));
    const total = Z.reduce((s, r) => s + r.reduce((t, v) => t + v * v, 0), 0) / n;
    const comps = [], vals = [];
    const Cv = (v) => { // (ZᵀZ / n) v，再减去已经找到的主成分
      const z = Z.map((r) => r.reduce((s, x, j) => s + x * v[j], 0)), out = new Array(d).fill(0);
      Z.forEach((r, i) => { const zi = z[i]; if (zi) for (let j = 0; j < d; j++) out[j] += r[j] * zi; });
      for (let j = 0; j < d; j++) out[j] /= n;
      comps.forEach((c, m) => { const p = c.reduce((s, x, j) => s + x * v[j], 0) * vals[m]; for (let j = 0; j < d; j++) out[j] -= p * c[j]; });
      return out;
    };
    for (let m = 0; m < k; m++) {
      let v = range(d).map((j) => 1 + ((j * 7919 + m * 104729) % 97) / 97), lam = 0;
      const norm = (a) => Math.sqrt(a.reduce((s, x) => s + x * x, 0)) || 1;
      v = v.map((x) => x / norm(v));
      for (let it = 0; it < iters; it++) {
        const w = Cv(v), nw = norm(w), nv = w.map((x) => x / nw);
        const diff = Math.sqrt(nv.reduce((s, x, j) => s + (x - v[j]) ** 2, 0));
        v = nv; lam = nw;
        if (diff < tol) break;
      }
      let big = 0; v.forEach((x, j) => { if (Math.abs(x) > Math.abs(v[big])) big = j; });
      if (v[big] < 0) v = v.map((x) => -x);
      comps.push(v); vals.push(lam);
    }
    const scores = Z.map((r) => comps.map((c) => r.reduce((s, x, j) => s + x * c[j], 0)));
    return { scores, components: comps, values: vals, explained: vals.map((l) => (total ? l / total : 0)), mean: mu, scale: sd };
  }

  // ── 表示 ─────────────────────────────────────────────────────────
  // 每个分子的 ECFP 位（cml-models.js 的 ecfp），返回 Set 的数组
  const fingerprints = (smiles, M, radius = 2, nbits = 1024) => smiles.map((s) => { const m = M.parseSmiles(s); if (!m.ok) throw new Error(`读不通 ${s}`); return M.ecfp(m, radius, nbits).bits; });
  const bitMatrix = (fps, nbits = 1024) => fps.map((b) => { const r = new Array(nbits).fill(0); for (const i of b) r[i] = 1; return r; });
  const DESC = ['mw', 'logp', 'tpsa', 'hbd', 'hba', 'rotb', 'heavy', 'fsp3', 'rings'];
  const descMatrix = (mols, keys = DESC) => mols.map((m) => keys.map((k) => m[k]));

  // ── 划分 ─────────────────────────────────────────────────────────
  // random：随机取 frac 的分子做测试。scaffold：按 Bemis–Murcko 骨架分组（无环分子的骨架是空的，算一组），
  // 组的顺序随机打乱，依次整组放进测试集，直到测试集够 frac（超出的组跳过），同一个骨架永远只在一边。
  function split(mols, how, seed = 1, frac = 0.2) {
    const n = mols.length, R = rng(seed), target = Math.round(frac * n);
    if (how === 'random') { const p = R.shuffle(range(n)), t = new Set(p.slice(0, target)); return { test: range(n).filter((i) => t.has(i)), train: range(n).filter((i) => !t.has(i)) }; }
    if (how !== 'scaffold') throw new Error(`不认得的划分 ${how}`);
    const groups = new Map();
    mols.forEach((m, i) => { const g = m.scaf || ''; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(i); });
    const keys = R.shuffle([...groups.keys()].sort()), t = new Set();
    for (const g of keys) { const ids = groups.get(g); if (t.size >= target) break; if (t.size + ids.length <= Math.round(target * 1.15)) ids.forEach((i) => t.add(i)); }
    return { test: range(n).filter((i) => t.has(i)), train: range(n).filter((i) => !t.has(i)) };
  }
  // 每个测试分子到训练集的最近邻 Tanimoto 相似度（第九章的 sim_max）
  const nnSim = (fps, train, test, M) => test.map((i) => { let b = 0; for (const j of train) { const t = M.tanimoto(fps[i], fps[j]); if (t > b) b = t; } return b; });
  // Tanimoto 加权的 k 近邻：预测值是 k 个最像的训练分子的加权平均（权重 = 相似度）
  function knn(fps, y, train, test, M, k = 5) {
    const pred = test.map((i) => {
      const nb = train.map((j) => [M.tanimoto(fps[i], fps[j]), j]).sort((a, b) => b[0] - a[0] || a[1] - b[1]).slice(0, k);
      const w = nb.reduce((s, [t]) => s + t, 0);
      return w > 0 ? nb.reduce((s, [t, j]) => s + t * y[j], 0) / w : mean(train.map((j) => y[j]));
    });
    const err = pred.map((p, q) => p - y[test[q]]);
    return { pred, err, mae: mean(err.map(Math.abs)), baseline: mean(test.map((i) => Math.abs(y[i] - mean(train.map((j) => y[j]))))) };
  }

  // 每个分子都给一个最近邻相似度和 k 近邻预测：测试分子对照整个训练集；训练分子对照“除了它自己的”训练集（留一法）。
  // 这样整张图上每个点都有值，可以拿来上色；第九章关心的是测试分子那部分。
  function perMolecule(fps, y, S, M, k = 5) {
    const n = fps.length, nn = new Array(n), pred = new Array(n);
    const inTest = new Set(S.test);
    for (let i = 0; i < n; i++) {
      const ref = inTest.has(i) ? S.train : S.train.filter((j) => j !== i);
      nn[i] = nnSim(fps, ref, [i], M)[0];
      pred[i] = knn(fps, y, ref, [i], M, k).pred[0];
    }
    return { nn, pred, err: pred.map((p, i) => p - y[i]), test: inTest };
  }
  const median = (v) => { const a = v.slice().sort((x, z) => x - z), m = a.length >> 1; return a.length ? (a.length % 2 ? a[m] : (a[m - 1] + a[m]) / 2) : NaN; };

  // ── 数据文件 ↔ 分子 ─────────────────────────────────────────────────
  // cml-map-data.js 里一个分子是 { s, f, el: 'C C H …', xyz: [x0, y0, z0, x1, …], 性质… }
  const atomsOf = (m) => { const el = m.el.split(' '), xyz = m.xyz; return el.map((e, i) => [e, xyz[3 * i], xyz[3 * i + 1], xyz[3 * i + 2]]); };
  const toXYZ = (m, title = m.s) => { const a = atomsOf(m); return `${a.length}\n${title}\n${a.map(([e, x, y, z]) => `${e} ${x.toFixed(4)} ${y.toFixed(4)} ${z.toFixed(4)}`).join('\n')}\n`; };

  // 拼成 Chemiscope 的数据集（https://chemiscope.org/docs/manual/input.html 的格式）。
  // props：{ 名字: { values, units, description } }，值是数字或字符串；settings 选初始的横轴、纵轴和颜色。
  function chemiscopeDataset(D, { props = {}, x, y, color, name, description = '', palette = 'viridis' } = {}) {
    const structures = D.mols.map((m) => { const a = atomsOf(m); return { size: a.length, names: a.map((t) => t[0]), x: a.map((t) => t[1]), y: a.map((t) => t[2]), z: a.map((t) => t[3]) }; });
    const properties = {};
    for (const [k, p] of Object.entries(props)) {
      if (p.values.length !== D.mols.length) throw new Error(`性质 ${k} 的个数不对`);
      properties[k] = { target: 'structure', values: p.values, ...(p.units ? { units: p.units } : {}), ...(p.description ? { description: p.description } : {}) };
    }
    const map = { x: { property: x }, y: { property: y } };
    if (color) map.color = { property: color, palette };
    return {
      meta: { name: name || D.meta.name[0], description, authors: ['MolAstria'], references: D.meta.references || [] },
      structures, properties,
      settings: { map, structure: [{ bonds: true, atoms: true, spaceFilling: false, axes: 'off', keepOrientation: false }] },
    };
  }

  window.MOLASTRIA_CHEMML_MAP_CORE = { rng, pca, fingerprints, bitMatrix, DESC, descMatrix, split, nnSim, knn, perMolecule, median, atomsOf, toXYZ, chemiscopeDataset };
})();
