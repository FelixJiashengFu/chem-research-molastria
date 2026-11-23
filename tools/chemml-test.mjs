// node --test tools/chemml-test.mjs
// 化学机器学习（/chem-ml/）：SMILES 读法（化学式、分子量、芳香环、坏的写法会报错）、ECFP 和 Tanimoto（同一分子不同写法相似度为 1）、
// 十氢萘和联环戊烷 1-WL 分不开、消息传递和 Coulomb 矩阵本征值对编号和转动不变、高斯过程的对数边际似然对照多元正态密度、
// 后验方差与 y 无关、小网络的解析梯度对照有限差分、EI 的闭式和极限、贝叶斯优化在中位数上胜过随机、主动学习、学习曲线的排序、
// n-gram 生成的有效率和新颖度此消彼长、骨架划分的误差大于随机划分、先选特征再验证的泄漏、校准、Pareto 前沿和超体积，
// 生成的内容是最新的、十章中英齐全、十八个演示都登记了、67 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './chemml-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const DIR = 'chem-ml/';
const sandbox = { window: {} };
vm.runInNewContext(read(DIR + 'cml-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_CHEMML_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`${DIR}cml-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_CHEMML)); };
const fp = (s) => M.ecfp(M.parseSmiles(s)).bits;

test('第二章：SMILES 的化学式和分子量，坏写法报错，语料全部合法', () => {
  const want = { CCO: ['C2H6O', 46.07], c1ccccc1: ['C6H6', 78.11], 'CC(=O)O': ['C2H4O2', 60.05], 'Cn1cnc2c1c(=O)n(C)c(=O)n2C': ['C8H10N4O2', 194.19], 'c1ccc(cc1)-c1ccccc1': ['C12H10', 154.21] };
  for (const [s, [f, mw]] of Object.entries(want)) { const m = M.parseSmiles(s); assert.ok(m.ok, `${s} ${m.why}`); assert.equal(m.formula, f, s); near(m.mw, mw, 0.02, s); }
  for (const s of ['CC(', 'C1CC', 'c1cccc1', 'C(C)(C)(C)(C)C']) assert.ok(!M.parseSmiles(s).ok, s);
  for (const s of M.CORPUS) assert.ok(M.parseSmiles(s).ok, s);
});

test('第二章：ECFP 对写法不变，Tanimoto 的性质；十氢萘和联环戊烷 1-WL 分不开', () => {
  near(M.tanimoto(fp('CCO'), fp('OCC')), 1); near(M.tanimoto(fp('Cc1ccccc1'), fp('c1ccc(C)cc1')), 1);
  const a = fp('Oc1ccccc1'), b = fp('Nc1ccccc1'), c = fp('CCO');
  near(M.tanimoto(a, b), M.tanimoto(b, a)); assert.ok(M.tanimoto(a, b) > M.tanimoto(a, c));
  assert.ok(M.tanimoto(fp('c1ccccc1'), fp('Cc1ccccc1')) < 1);
  const dec = M.parseSmiles('C1CCC2CCCCC2C1'), bcp = M.parseSmiles('C1CCC(C1)C1CCCC1');
  assert.equal(dec.formula, bcp.formula);
  for (let t = 0; t <= 4; t++) assert.equal(M.wl(dec, t).hist[t], M.wl(bcp, t).hist[t], `WL 第 ${t} 轮`);
  assert.notEqual(M.wl(M.parseSmiles('CCCCCC'), 2).hist[2], M.wl(M.parseSmiles('CC(C)CCC'), 2).hist[2]);
});

test('第二、四章：消息传递对原子编号不变，Coulomb 矩阵本征值对编号和转动不变', () => {
  const m = M.parseSmiles('CC(=O)Nc1ccc(O)cc1'), n = m.atoms.length;
  const perm = M.rng(5).shuffle([...Array(n).keys()]);
  const r1 = M.mpnnReadout(m, 3), r2 = M.mpnnReadout(M.permute(m, perm), 3);
  r1.forEach((v, k) => near(v, r2[k], 1e-9, 'MPNN'));
  for (const g of Object.values(M.GEOMS)) {
    const e = M.cmEigen(g.atoms), rot = M.cmEigen(M.rotateAtoms(g.atoms, 0.7, 1.9)), pe = M.cmEigen([...g.atoms].reverse());
    e.forEach((v, k) => { near(v, rot[k], 1e-6, 'rot'); near(v, pe[k], 1e-6, 'perm'); });
  }
  // 对角元 0.5 Z^2.4：水分子里的 O 是 0.5·8^2.4
  near(M.coulombMatrix(M.GEOMS.h2o.atoms)[0][0], 0.5 * 8 ** 2.4, 1e-9);
});

test('第三章：高斯过程的边际似然对照多元正态密度；后验方差与 y 无关、在数据点上接近噪声', () => {
  const X = [[0.1], [0.35], [0.5], [0.8]], y = [0.2, -0.4, 0.1, 0.9], K = { type: 'm52', l: 0.3, s2: 1.3 }, nz = 0.01;
  const g = M.gpFit(X, y, K, nz), k = M.kfun(K);
  const C = X.map((a, i) => X.map((b, j) => k(a, b) + (i === j ? nz + 1e-10 : 0)));
  near(g.lml, M.mvnLogpdf(y, C), 1e-8, 'lml');
  const g2 = M.gpFit(X, y.map((v) => -3 * v + 1), K, nz);
  for (const x of [[0], [0.42], [0.95]]) near(g.predict(x)[1], g2.predict(x)[1], 1e-12, 'var');
  assert.ok(g.predict([0.35])[1] < nz * 1.2); near(g.predict([30])[1], 1.3, 1e-6, '远处回到先验');
  const auto = M.gpAuto(M.lin(0, 1, 15).map((x) => [x]), M.lin(0, 1, 15).map((x) => Math.sin(6 * x)));
  assert.ok(auto.l >= 0.1 && auto.l <= 0.4, `长度 ${auto.l}`);
});

test('第四章：小网络的解析梯度对照有限差分', () => {
  const P = M.mlpInit(6, 3), d = M.data1(12, 0.1, 2), xs = d.map((p) => p[0]), ys = d.map((p) => p[1]);
  const { g } = M.mlpLossGrad(P, xs, ys, 1e-3), h = 1e-6;
  for (const key of ['w1', 'b1', 'w2']) for (let j = 0; j < 6; j++) {
    const Q = JSON.parse(JSON.stringify(P)), R = JSON.parse(JSON.stringify(P)); Q[key][j] += h; R[key][j] -= h;
    near((M.mlpLossGrad(Q, xs, ys, 1e-3).loss - M.mlpLossGrad(R, xs, ys, 1e-3).loss) / (2 * h), g[key][j], 1e-5, `${key}[${j}]`);
  }
});

test('第五章：EI 的闭式、单调和极限；贝叶斯优化在中位数上胜过随机', () => {
  near(M.EI(0.8, 0.02, 0.78, 0), 0.02 * M.Phi(1) + 0.02 * M.phi(1), 1e-12);
  near(M.EI(0.8, 0.02, 0.78, 0), 0.0217, 2e-4, '例题 A'); near(M.EI(0.7, 0.15, 0.78, 0), 0.0281, 2e-4, '例题 B');
  near(M.EI(0.9, 0, 0.5, 0), 0.4); near(M.EI(0.1, 0, 0.5, 0), 0);
  assert.ok(M.EI(0.5, 0.2, 0.5, 0) > M.EI(0.5, 0.1, 0.5, 0)); assert.ok(M.EI(0.6, 0.1, 0.5, 0) > M.EI(0.5, 0.1, 0.5, 0));
  near(M.Phi(1.96), 0.975, 1e-3); near(M.zFor(0.95), 1.96, 1e-3);
  const fmax = M.maxOn(M.yield2, 2), reg = (st) => fmax - M.median([1, 2, 3, 4, 5, 6, 7, 8].map((s) => M.boRun(M.yield2, 2, st, { seed: s, budget: 25, n0: 4 }).hist.at(-1)));
  assert.ok(reg('ei') < reg('random'), `EI ${reg('ei')} vs random ${reg('random')}`);
});

test('第一、六章：学习曲线的排序和斜率；方差采样胜过随机', () => {
  const sizes = [16, 32, 64, 128, 256], lc = Object.fromEntries(['mean', 'linear', 'knn', 'krr'].map((k) => [k, M.learningCurve(k, sizes)]));
  assert.ok(lc.krr.at(-1) < lc.knn.at(-1) && lc.knn.at(-1) < lc.linear.at(-1) && lc.linear.at(-1) < lc.mean.at(-1));
  assert.ok(M.loglogSlope(sizes, lc.krr).slope < -0.3, '核岭回归的误差随数据下降');
  const al = (st) => M.mean([1, 2, 3, 4, 5].map((s) => M.activeRun(st, { seed: s, budget: 24 }).curve.at(-1)[1]));
  assert.ok(al('var') < al('random'));
});

test('第七、八章：n-gram 的有效率升、新颖度降；Pareto 前沿和超体积（例题 0.48）', () => {
  const e2 = M.ngramEval(2, 200, 1, 1), e6 = M.ngramEval(6, 200, 1, 1);
  assert.ok(e6.validity > e2.validity && e6.novelty < e2.novelty);
  const P = [[0.9, 0.2], [0.6, 0.6], [0.2, 0.9], [0.5, 0.5]];
  assert.deepEqual(M.paretoIdx(P), [0, 1, 2]);
  near(M.hypervolume(P), 0.48, 1e-12); near(M.hypervolume(P.slice(0, 3)), 0.48, 1e-12);
  near(M.hypervolume([[1, 0], [0, 1], [0.5, 0.5]]), 0.25, 1e-12);
  assert.equal(M.weightedPick(P, 0.5), 1);
  const dent = [[0.9, 0.2], [0.5, 0.5], [0.2, 0.9]];
  for (let w = 0; w <= 1; w += 0.05) assert.notEqual(M.weightedPick(dent, w), 1, `w=${w}`);
});

test('第九章：骨架划分的误差大于随机划分；泄漏的 R² 是假的；校准对得上', () => {
  const D = M.scaffoldData({ seed: 1 });
  assert.ok(M.splitScore(D, 'scaffold', 'knn').mae > 1.5 * M.splitScore(D, 'random', 'knn').mae);
  for (const s of [1, 2, 3]) { const L = M.leakage({ seed: s }); assert.ok(L.wrong > 0.1 && L.right < 0.05, `${L.wrong} ${L.right}`); }
  const c = M.calibration({ seed: 3 });
  c.levels.forEach((p, i) => { if (p >= 0.5) near(c.cover[i], p, 0.1, `覆盖率 ${p}`); });
});

test('生成的内容是最新的、十章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/${DIR}cml-${lang}.js 不是最新的：运行 node tools/chemml-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['why', 'repr', 'gp', 'nn', 'bo', 'active', 'gen', 'sdl', 'eval', 'frontier'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read(DIR + 'cml-models.js') + '\n' + read(DIR + 'cml-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_CHEMML_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  const names = ['active', 'batch', 'bo', 'calib', 'coulomb', 'fp', 'goodhart', 'gp', 'lc', 'leak', 'mlp', 'mpnn', 'ngram', 'pareto', 'prior', 'regret', 'scope', 'split'];
  assert.deepEqual([...Object.keys(DEMOS)].sort(), names);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 5, id); assert.ok(ch.points.length >= 4 && ch.math.length >= 3 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, names.length, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 67); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.equal(C.index.quiz.length, 12); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /'chem-ml\/index\.html'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("chem-ml\/index\.html"/); assert.match(seo, /\["chem-ml\/", "0\.8", "monthly"\]/);
  assert.match(read(DIR + 'index.html'), /data-section="chemml"/);
  assert.match(read(DIR + 'index.html'), /cml-models\.js[\s\S]*cml-demos\.js[\s\S]*cml\.js/);
});
