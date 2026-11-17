// node --test tools/tensor-test.mjs
// 张量网络与强关联（/tensor/）：线性代数（本征值、SVD、Lanczos）对照已知矩阵；横场 Ising 链的精确对角化、两格点 DMRG 对照
// 自由费米子的精确能量；Heisenberg 链的 DMRG 对照精确对角化；MPS 截断的保真度；AKLT 的 ξ = 1/ln 3 和弦序 −4/9；临界链的
// 中心荷 c ≈ 1；淬火后纠缠线性增长；二维面积律；Hubbard 链的 RHF / UHF / 精确；二聚体的解析解；行列式和 CSF 计数；铁簇的自旋
// 多重态；Fiedler 排序；随机线路的 Page 值；各章例题的数字；生成的内容是最新的、十章中英齐全、十四个演示都登记了、95 篇文献
// 都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './tensor-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const DIR = 'tensor/';
const sandbox = { window: {} };
vm.runInNewContext(read(DIR + 'tn-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_TENSOR_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`${DIR}tn-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_TENSOR)); };

test('线性代数：对称矩阵的本征值、SVD 的奇异值', () => {
  const e = Array.from(M.eigh([[2, 1, 0], [1, 2, 1], [0, 1, 2]], false).vals).sort((a, b) => a - b);
  [2 - Math.SQRT2, 2, 2 + Math.SQRT2].forEach((x, i) => near(e[i], x, 1e-12, 'eig'));
  const s = Array.from(M.svd(Float64Array.of(3, 0, 0, 4), 2, 2).s).sort((a, b) => b - a);
  near(s[0], 4, 1e-12); near(s[1], 3, 1e-12);
  const s2 = Array.from(M.svd(Float64Array.of(1, 2, 3, 4, 5, 6), 2, 3).s);
  near(s2[0] ** 2 + s2[1] ** 2, 91, 1e-9, 'Frobenius'); near(s2[0] * s2[1], Math.sqrt(54), 1e-9, '√det(AAᵀ)');
});

test('第一章：横场 Ising 链的精确对角化对上自由费米子解；Hubbard 链的 RHF、UHF 和精确解', () => {
  for (const [N, g] of [[8, 1], [12, 1], [12, 0.5]]) {
    const m = M.spinModel({ kind: 'tfim', N, g });
    near(M.groundState(m).E, M.tfimExact(N, 1, g).E, 1e-9, `TFIM N=${N} g=${g}`);
  }
  near(M.hubbardED(2, 4).E, 2 - Math.sqrt(4 + 4), 1e-9, '两格点 Hubbard：U/2 − √(4t² + U²/4)');
  const ed = M.hubbardED(8, 8), mf = M.hubbardMF(8, 8);
  near(ed.E / 8, -0.3026, 5e-4, 'N=8 U=8 精确'); near(mf.uhf.E / 8, -0.2158, 5e-4, 'UHF'); near(mf.rhf.E / 8, 0.8103, 5e-4, 'RHF');
  assert.ok(mf.rhf.E > mf.uhf.E && mf.uhf.E > ed.E, '变分顺序：RHF ≥ UHF ≥ 精确');
  assert.equal(M.binom(18, 9) ** 2, 2363904400, 'CAS(18,18) 的行列式个数');
});

test('第二章：施密特分解、两比特纠缠、临界链的中心荷 c ≈ 1、例题 θ = 30°', () => {
  const t = M.twoQubit(Math.cos(Math.PI / 6), 0, 0, Math.sin(Math.PI / 6));
  near(t.S, -(0.75 * Math.log(0.75) + 0.25 * Math.log(0.25)), 1e-12, 'S(θ=30°)'); near(t.S, 0.5623, 1e-4);
  near(M.twoQubit(1, 0, 0, 1).S, Math.LN2, 1e-12, 'Bell 态 ln 2');
  const c = M.fitCentral(100, M.chainEntropy(100, 0).S).c;
  assert.ok(Math.abs(c - 1) < 0.15, `XX 链 c = ${c}`);
  const gapped = M.chainEntropy(64, 0.4).S;
  assert.ok(Math.abs(gapped[31] - gapped[15]) < 0.05, '二聚化（有能隙）的链纠缠饱和');
});

test('第三章：MPS 截断的保真度和参数个数；AKLT 的 ξ = 1/ln 3、关联 (4/3)(−1/3)^r、弦序 −4/9', () => {
  const m = M.spinModel({ kind: 'tfim', N: 12, g: 1 }), v = M.groundState(m).v;
  const t4 = M.truncate(m, v, 4), t8 = M.truncate(m, v, 8);
  assert.equal(t4.params, 296); assert.equal(t8.params, 936);
  near(1 - t4.fidelity, 5.66e-6, 2e-7, 'χ=4'); assert.ok(1 - t8.fidelity < 1e-8, 'χ=8');
  const mp = M.spinModel({ kind: 'tfim', N: 12, g: 2 }); assert.ok(1 - M.truncate(mp, M.groundState(mp).v, 4).fidelity < 1e-7, '顺磁 g=2 χ=4');
  const exact = M.mpsToVector(M.mpsCompress(v, 12, 64).A); let ov = 0; for (let i = 0; i < v.length; i++) ov += v[i] * exact[i];
  near(Math.abs(ov), 1, 1e-10, 'χ 足够大时 MPS 精确');
  const tr = M.transfer(M.akltTensors());
  near(Math.abs(tr.lam2), 1 / 3, 1e-6, '|λ₂|'); near(tr.xi, 1 / Math.log(3), 1e-5, 'ξ');
  const C = M.correlations(tr, M.SZ1, 6).C, S = M.correlations(tr, M.SZ1, 6, M.STRING1).C;
  for (let r = 1; r <= 6; r++) { near(C[r - 1], (4 / 3) * (-1 / 3) ** r, 1e-6, `⟨SzSz⟩ r=${r}`); near(S[r - 1], -4 / 9, 1e-6, `弦序 r=${r}`); }
});

test('第四章：两格点 DMRG 收敛到精确能量（横场 Ising 对自由费米子、Heisenberg 对精确对角化），例题的参数个数', () => {
  const st = M.dmrgRun({ kind: 'tfim', N: 24, g: 1, chi: 12 }, 6), ex = M.tfimExact(24, 1, 1).E;
  near(ex, -30.1997123313, 1e-9, '精确 E₀');
  assert.ok(Math.abs(st.E - ex) < 1e-8, `DMRG 误差 ${st.E - ex}`); assert.ok(st.E > ex - 1e-10, '变分：从上方逼近（到舍入误差）');
  const dims = Array.from({ length: 25 }, (_, l) => Math.min(2 ** l, 2 ** (24 - l), 12)); let p = 0; for (let i = 0; i < 24; i++) p += dims[i] * 2 * dims[i + 1];
  assert.equal(p, 5160);
  const h = M.groundState(M.spinModel({ kind: 'xxz', N: 12 })).E; near(h, -5.1420906328, 1e-8, 'Heisenberg N=12');
  const s2 = M.dmrgRun({ kind: 'heis', N: 12, chi: 16 }, 4); assert.ok(Math.abs(s2.E - h) < 1e-6, `Heisenberg DMRG ${s2.E - h}`);
});

test('第五章：淬火后纠缠线性增长，例题 S(10) = 8.94', () => {
  const q = M.quench(64, [0, 2, 4, 10]);
  near(q[0].S, 0, 1e-9, 'Néel 态没有纠缠'); near(q[1].S, 1.851, 2e-3); near(q[2].S, 3.624, 2e-3); near(q[3].S, 8.94, 1e-2);
  near(M.quench(128, [20])[0].S, 17.78, 1e-2, 'N=128 t=20');
});

test('第六章：二维面积律（有能隙的自由费米子每列 ΔS ≈ 0.289）', () => {
  const S = [2, 8].map((W) => M.halfEntropy2d(12, W, 0.6).S);
  near(S[0], 0.721, 2e-3); near((S[1] - S[0]) / 6, 0.2887, 2e-3, '斜率');
});

test('第七章：Fiedler 排序把三个片段排到一起，需要的 χ 从 64 降到 6', () => {
  const g = M.graph('clusters'), m = M.spinModel({ kind: 'graph', N: 12, bonds: g.bonds }), v = M.groundState(m).v;
  const ord = M.fiedler(M.mutualInfo(v, 12).I.map((r) => Array.from(r)));
  assert.deepEqual([...ord].sort((a, b) => a - b), [...Array(12).keys()], '是一个排列');
  assert.equal(M.orderingCost(v, 12, [...Array(12).keys()]).maxChi, 64); assert.equal(M.orderingCost(v, 12, ord).maxChi, 6);
  assert.equal(M.binom(20, 10) ** 2, 34134779536, '例题：(20e, 20o)');
});

test('第八章：二聚体的解析解（RHF 50 % 离子、UHF 的 ⟨S²⟩）和 CAS(16,16) 的计数', () => {
  const d = M.dimer(0.3, 1);
  near(d.exact, 0.5 - Math.sqrt(4 * 0.09 + 0.25), 1e-12); near(d.rhf, -0.6 + 0.5, 1e-12); near(d.uhf, -2 * 0.09, 1e-12); near(d.s2uhf, 1 - 0.36, 1e-12);
  near(d.nG + d.nU, 2, 1e-12, '自然轨道占据数之和');
  const d2 = M.dimer(0.7, 1); near(d2.uhf, d2.rhf, 1e-12, 't/U > 1/2 时 UHF = RHF');
  assert.equal(M.binom(16, 8) ** 2, 165636900);
  near(M.log10csf(16, 16, 0), Math.log10(34763300), 1e-9, 'Weyl–Paldus 单态 CSF');
  near(M.log10csf(2, 2, 0), Math.log10(3), 1e-9, 'CAS(2,2) 有 3 个单态 CSF');
});

test('第九章：铁簇的自旋态（[2Fe-2S] 36 个、最高 15J；[4Fe-4S] 900 个、单态基态；七个铁 135 000 个）', () => {
  const a = M.spinLadder([5, 5], 1); assert.equal(a.dim, 36); assert.equal(a.levels[0].S, 0); near(Math.max(...a.levels.map((x) => x.dE)), 15, 1e-12);
  assert.equal(a.levels.reduce((s, x) => s + x.mult * (2 * x.S + 1), 0), 36);
  const b = M.spinLadder([5, 5, 4, 4], 1); assert.equal(b.dim, 900); assert.equal(b.levels[0].S, 0); assert.equal(b.levels.reduce((s, x) => s + x.mult * (2 * x.S + 1), 0), 900);
  assert.equal(M.spinCounts([5, 5, 5, 4, 4, 4, 4]).dim, 135000);
});

test('第十章：随机线路的纠缠饱和到 Page 值附近，χ 撞上 2^{N/2}', () => {
  const C = M.randomCircuit(12, 30, 1), last = C[C.length - 1];
  assert.equal(C[0].S, 0); assert.ok(last.chi >= 63 && last.chi <= 64, `χ = ${last.chi}`);
  near(last.S, 6 * Math.LN2 - 0.5, 0.08, 'Page 值'); assert.ok(last.S < 6 * Math.LN2);
  assert.equal(2 * 12 * 64 * 64, 98304);
});

test('生成的内容是最新的、十章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/${DIR}tn-${lang}.js 不是最新的：运行 node tools/tensor-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['strong', 'entangle', 'mps', 'dmrg', 'dynamics', 'higher', 'qcdmrg', 'casscf', 'femoco', 'frontier'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read(DIR + 'tn-models.js') + '\n' + read(DIR + 'tn-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_TENSOR_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  const names = ['aklt', 'area', 'area2d', 'cas', 'circuit', 'dimer', 'dmrg', 'hubbard', 'order', 'quench', 'schmidt', 'spins', 'trunc', 'wall'];
  assert.deepEqual([...Object.keys(DEMOS)].sort(), names);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 6, id); assert.ok(ch.points.length >= 4 && ch.math.length >= 3 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, names.length, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 95); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.equal(C.index.quiz.length, 12); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /'tensor\/index\.html'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("tensor\/index\.html"/); assert.match(seo, /\["tensor\/", "0\.8", "monthly"\]/);
  assert.match(read(DIR + 'index.html'), /data-section="tensor"/);
  assert.match(read(DIR + 'index.html'), /tn-models\.js[\s\S]*tn-demos\.js[\s\S]*tn\.js/);
});
