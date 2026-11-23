// 化学机器学习 · 结构–性质图（第九章的 Chemiscope 演示）：node --test tools/chemml-map-test.mjs
// 查三样：tools/chemml-map/build.py 算出的数据（个数、来源和方法记录、三维结构和 SMILES 对得上、键长合理、性质合理）、
// 生成的 public/chem-ml/cml-map-data.js 是最新的、cml-map-core.js 的纯逻辑（主成分、划分、近邻、Chemiscope 数据集），
// 以及第九章正文里关于这份数据的说法（骨架划分让相似度下降；logP 变难，能隙不变难，偶极矩因为苯骨架进不了测试集反而变容易）。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { SRC, OUT, inputHash, stamp, build, load } from './chemml-map.mjs';

const RAW = JSON.parse(fs.readFileSync(SRC, 'utf8'));
const { M, C } = load();
const sb = { window: {} };
vm.runInNewContext(fs.readFileSync(OUT, 'utf8'), sb);
const D = sb.window.MOLASTRIA_CHEMML_MAP_DATA;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);

test('数据：个数、来源和方法都记着', () => {
  const m = RAW.meta;
  assert.equal(RAW.molecules.length, 284);
  assert.equal(m.licence, 'CC BY 4.0');
  assert.ok(m.source[0].includes('build.py') && m.source[1].includes('no external dataset'));
  for (const k of ['embed', 'preopt', 'opt', 'props']) assert.ok(m.method[k], k);
  assert.match(m.method.opt, /GFN2-xTB/);
  for (const k of ['rdkit', 'tblite', 'ase', 'numpy']) assert.match(m.versions[k], /^\d+\.\d+/, k);
  assert.match(m.date, /^\d{4}-\d\d-\d\d$/);
  assert.equal(m.enumeration.scaffolds.length, 14);
  assert.equal(new Set(RAW.molecules.map((x) => x.smiles)).size, 284, 'SMILES 不重复');
  assert.ok(RAW.molecules.every((x) => x.opt.converged && x.opt.fmax <= 0.03), '每个分子的 GFN2-xTB 优化都收敛了');
});

test('数据：三维结构和 SMILES 是同一个分子，键长合理', () => {
  const R = { H: 0.31, C: 0.76, N: 0.71, O: 0.66, F: 0.57, S: 1.05, Cl: 1.02, Br: 1.2 };
  for (const x of RAW.molecules) {
    const mol = M.parseSmiles(x.smiles);
    assert.ok(mol.ok, x.smiles);
    const count = {}; for (const e of x.elements) count[e] = (count[e] || 0) + 1;
    const hill = Object.keys(count).sort((a, b) => (a === 'C' ? -1 : b === 'C' ? 1 : a === 'H' ? -1 : b === 'H' ? 1 : a < b ? -1 : 1)).map((e) => `${e}${count[e] > 1 ? count[e] : ''}`).join('');
    assert.equal(hill, mol.formula, `${x.smiles} 的原子和分子式`);
    assert.equal(x.xyz.length, x.elements.length);
    assert.equal(x.elements.filter((e) => e !== 'H').length, x.heavy);
    // 每个原子都有一个按共价半径算“成键”的邻居，没有两个原子挤在一起；成键的数目等于分子图的键数
    let bonds = 0;
    x.xyz.forEach((p, i) => {
      let has = false;
      x.xyz.forEach((q, j) => {
        if (i === j) return;
        const d = Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2]), cut = 1.2 * (R[x.elements[i]] + R[x.elements[j]]);
        assert.ok(d > 0.9, `${x.smiles} 原子 ${i}、${j} 只隔 ${d.toFixed(2)} Å`);
        if (d < cut) { has = true; if (i < j) bonds++; }
      });
      assert.ok(has, `${x.smiles} 原子 ${i} 没有邻居`);
    });
    const nH = count.H || 0;
    assert.equal(bonds, mol.bonds.length + nH, `${x.smiles} 的键数`);
  }
});

test('数据：性质合理', () => {
  const by = Object.fromEntries(RAW.molecules.map((x) => [x.smiles, x]));
  assert.ok(RAW.molecules.every((x) => x.gap > 1 && x.gap < 16 && x.dipole >= 0 && x.lumo > x.homo && Math.abs(x.gap - (x.lumo - x.homo)) < 1e-3));
  assert.ok(by.c1ccccc1.dipole < 0.05, '苯没有偶极矩');
  assert.ok(by['Fc1ccc(F)cc1'].dipole < 0.1, '对二氟苯的两个偶极抵消');
  assert.ok(by['O=[N+]([O-])c1ccccc1'].dipole > 3.5, '硝基苯的偶极矩大（实验 4.2 D）');
  near(by.c1ccccc1.mw, 78.114, 0.01, '苯的分子量');
  assert.ok(by['O=[N+]([O-])c1ccccc1'].gap < by.c1ccccc1.gap, '硝基让能隙变小');
  assert.ok(by.CCC.gap > by.c1ccccc1.gap, '烷烃的 xTB 能隙比芳香环大');
});

test('生成的 cml-map-data.js 是最新的，和重新生成的一字不差', () => {
  assert.equal(stamp(), inputHash(), 'public/chem-ml/cml-map-data.js 不是最新的：运行 node tools/chemml-map.mjs');
  assert.match(fs.readFileSync(new URL('./chemml-map.mjs', import.meta.url), 'utf8'), /\[SRC, CORE, MODELS,/, '指纹用的 cml-models.js 也要算进输入的哈希，否则 --check 看不出过期');
  assert.equal(fs.readFileSync(OUT, 'utf8'), build());
  assert.equal(D.mols.length, 284);
  assert.equal(D.pca.ecfp.xy.length, 284); assert.equal(D.pca.desc.xy.length, 284);
  for (const m of D.mols) { assert.equal(m.el.split(' ').length * 3, m.xyz.length); assert.ok(D.fam[m.f], m.f); }
  assert.ok(D.meta.references.some((r) => r.includes('10.21105/joss.02117')));
});

test('主成分：解释方差等于协方差矩阵的本征值，主成分正交归一，符号固定', () => {
  const R = M.rng(5), X = M.range(40).map(() => M.range(6).map((j) => R.normal() * (j + 1) + (j === 2 ? 3 : 0)));
  const p = C.pca(X, 3);
  const n = X.length, mu = M.range(6).map((j) => M.mean(X.map((r) => r[j])));
  const cov = M.range(6).map((a) => M.range(6).map((b) => X.reduce((s, r) => s + (r[a] - mu[a]) * (r[b] - mu[b]), 0) / n));
  const ev = M.symEig(cov).values.slice().sort((a, b) => b - a), total = ev.reduce((s, v) => s + v, 0);
  p.values.forEach((v, i) => near(v, ev[i], 1e-8, `本征值 ${i}`));
  p.explained.forEach((v, i) => near(v, ev[i] / total, 1e-9, `解释方差 ${i}`));
  for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) near(p.components[a].reduce((s, x, j) => s + x * p.components[b][j], 0), a === b ? 1 : 0, 1e-8, `正交 ${a}${b}`);
  const q = C.pca(X.map((r) => r.map((v) => v + 7)), 3);
  q.scores.forEach((r, i) => r.forEach((v, k) => near(v, p.scores[i][k], 1e-8, '平移不变')));
  // 指纹的主成分：前两维解释的方差和数据文件一致
  const fps = C.fingerprints(D.mols.map((m) => m.s), M);
  const pe = C.pca(C.bitMatrix(fps), 2);
  pe.explained.forEach((v, i) => near(v, D.pca.ecfp.ev[i], 1e-4, `ECFP 解释方差 ${i}`));
  assert.ok(D.pca.desc.ev[0] + D.pca.desc.ev[1] > 0.5, '九个描述符的前两维解释一半以上的方差');
});

test('划分：骨架划分里同一个骨架只在一边，比例约 20 %，同一个种子同一个结果', () => {
  for (const seed of [1, 2, 3, 7]) {
    const S = C.split(D.mols, 'scaffold', seed), T = new Set(S.test.map((i) => D.mols[i].scaf));
    assert.equal(S.test.length + S.train.length, 284);
    assert.ok(S.train.every((i) => !T.has(D.mols[i].scaf)), '训练集里没有测试集的骨架');
    near(S.test.length / 284, 0.2, 0.04, '测试比例');
    assert.deepEqual(C.split(D.mols, 'scaffold', seed), S);
    const Rn = C.split(D.mols, 'random', seed);
    assert.equal(Rn.test.length, Math.round(0.2 * 284));
    assert.ok(Rn.test.some((i) => Rn.train.some((j) => D.mols[j].scaf === D.mols[i].scaf)), '随机划分会把同一个骨架拆到两边');
  }
  assert.throws(() => C.split(D.mols, 'time', 1));
});

test('近邻和 k 近邻：玩具数据对得上；训练分子用留一法', () => {
  const fps = [new Set([1, 2, 3]), new Set([1, 2, 3]), new Set([7, 8]), new Set([1, 2])];
  const y = [1, 3, 10, 2];
  near(C.nnSim(fps, [0, 2], [3], M)[0], 2 / 3, 1e-12, '最近邻相似度');
  const K = C.knn(fps, y, [0, 1, 2], [3], M, 2);
  near(K.pred[0], 2, 1e-12, '两个最像的（相似度一样）平均'); near(K.mae, 0, 1e-12, 'MAE');
  const P = C.perMolecule(fps, y, { train: [0, 1, 2], test: [3] }, M, 1);
  near(P.nn[0], 1, 1e-12, '分子 0 的留一近邻是一模一样的分子 1'); near(P.pred[0], 3, 1e-12, '留一法的预测');
  near(P.nn[2], 0, 1e-12, '分子 2 没有像它的');
  assert.equal(C.median([3, 1, 2]), 2); assert.equal(C.median([4, 1, 2, 3]), 2.5);
});

test('Chemiscope 数据集：结构和性质的个数、设置', () => {
  const ds = C.chemiscopeDataset(D, { props: { gap: { values: D.mols.map((m) => m.gap), units: 'eV' }, fam: { values: D.mols.map((m) => m.f) } }, x: 'gap', y: 'gap', color: 'gap' });
  assert.equal(ds.structures.length, 284);
  ds.structures.forEach((s, i) => { assert.equal(s.size, s.names.length); assert.equal(s.x.length, s.size); assert.equal(s.size * 3, D.mols[i].xyz.length); });
  assert.equal(ds.properties.gap.target, 'structure'); assert.equal(ds.properties.gap.units, 'eV');
  assert.deepEqual(JSON.parse(JSON.stringify(ds.settings.map.color)), { property: 'gap', palette: 'viridis' });
  assert.ok(ds.meta.name && ds.meta.authors.length);
  assert.throws(() => C.chemiscopeDataset(D, { props: { bad: { values: [1, 2] } }, x: 'bad', y: 'bad' }));
  assert.match(C.toXYZ(D.mols[0]), /^12\nc1ccccc1\nC /);
});

test('第九章的说法：骨架划分降低相似度；logP 变难，能隙不变，偶极矩因为测试集里没有对位二取代苯反而变小', () => {
  const fps = C.fingerprints(D.mols.map((m) => m.s), M);
  const mae = (key, how) => M.mean(M.range(12).map((k) => { const S = C.split(D.mols, how, k + 1); return C.knn(fps, D.mols.map((m) => m[key]), S.train, S.test, M, 5).mae; }));
  for (let seed = 1; seed <= 12; seed++) {
    const nn = (how) => { const S = C.split(D.mols, how, seed); return C.median(C.nnSim(fps, S.train, S.test, M)); };
    assert.ok(nn('scaffold') < nn('random'), `种子 ${seed}：骨架划分的相似度更低`);
  }
  const lr = mae('logp', 'random'), ls = mae('logp', 'scaffold');
  assert.ok(ls > 1.3 * lr && ls < 1.6 * lr, `logP：骨架 ${ls} 比随机 ${lr} 大四成左右`);
  const gr = mae('gap', 'random'), gs = mae('gap', 'scaffold');
  assert.ok(gs > 0.9 * gr && gs < 1.1 * gr, `能隙：骨架 ${gs} 和随机 ${gr} 差不多`);
  near(gr, 0.81, 0.02, '能隙随机划分的 MAE（正文写约 0.81 eV）'); near(gs, 0.80, 0.02, '能隙骨架划分的 MAE（正文写约 0.80 eV）');
  const dr = mae('dip', 'random'), ds = mae('dip', 'scaffold');
  assert.ok(ds > 0.55 * dr && ds < 0.75 * dr, `偶极矩：骨架 ${ds} 比随机 ${dr} 小三分之一左右`);
  near(dr, 1.20, 0.02, '偶极矩随机划分的 MAE（正文写约 1.20 D）'); near(ds, 0.79, 0.02, '偶极矩骨架划分的 MAE（正文写约 0.79 D）');
  // 正文给的原因：苯骨架（72 个）比测试集（57 个）大，骨架划分从不把它放进测试集；对位二取代苯是偶极矩最难猜的
  const bz = D.mols.filter((m) => m.scaf === 'c1ccccc1');
  assert.equal(bz.length, 72); assert.equal(D.mols.filter((m) => m.f === 'benzene' && m.subs.length === 2).length, 55);
  assert.ok(bz.length > Math.round(0.2 * 284) * 1.15, '苯骨架比测试集的上限还大');
  for (let k = 1; k <= 12; k++) assert.ok(C.split(D.mols, 'scaffold', k).test.every((i) => D.mols[i].scaf !== 'c1ccccc1'), `种子 ${k}：骨架划分的测试集里没有苯`);
  const para = [], rest = [], y = D.mols.map((m) => m.dip);
  for (let k = 1; k <= 12; k++) {
    const S = C.split(D.mols, 'random', k), K = C.knn(fps, y, S.train, S.test, M, 5);
    K.err.forEach((e, q) => { const m = D.mols[S.test[q]]; (m.f === 'benzene' && m.subs.length === 2 ? para : rest).push(Math.abs(e)); });
  }
  near(M.mean(para), 2.0, 0.1, '随机划分下对位二取代苯的偶极矩误差（正文写约 2.0 D）');
  near(M.mean(rest), 1.0, 0.1, '随机划分下其余分子的偶极矩误差（正文写约 1.0 D）');
});

test('页面接线：Chemiscope 的版本写死、和 e2e 装的一致，脚本按顺序载入', () => {
  const scope = fs.readFileSync(new URL('../public/chem-ml/cml-scope.js', import.meta.url), 'utf8');
  const ver = scope.match(/const VERSION = '([\d.]+)'/)[1];
  assert.match(scope, /https:\/\/cdn\.jsdelivr\.net\/npm\/chemiscope@\$\{VERSION\}\/dist\/chemiscope\.min\.js/);
  assert.equal(JSON.parse(fs.readFileSync(new URL('./e2e/package.json', import.meta.url), 'utf8')).devDependencies.chemiscope, ver);
  const html = fs.readFileSync(new URL('../public/chem-ml/index.html', import.meta.url), 'utf8');
  assert.match(html, /cml-models\.js[\s\S]*cml-map-core\.js[\s\S]*cml-scope\.js[\s\S]*cml-demos\.js[\s\S]*cml\.js/);
  assert.doesNotMatch(html, /cml-map-data\.js/, '数据在演示第一次画时才载入');
});
