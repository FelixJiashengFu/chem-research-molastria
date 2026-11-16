// node --test tools/nequip-test.mjs
// NequIP（/nequip/）：演示的数学对照解析结果（球谐函数正交归一、Wigner D 是正交的群表示、CG 积等变、
// 1 ⊗ 1 是点积和叉积、包络在 r_c 处平滑归零、保守力 NVE 不漂、绕圈做功、幂律斜率），论文数字和章里例题的算术，
// 生成的内容是最新的、八章中英齐全、十个演示都登记了、36 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './nequip-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('nequip/nequip-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_NEQUIP_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`nequip/nequip-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_NEQUIP)); };
const R1 = M.euler(0.7, 1.1, -0.4), R2 = M.euler(-1.3, 0.5, 2.2);

test('第一章：Morse 和谐振子在 1.6 rₑ 处差 0.458 D', () => {
  near(M.morse(1.6, 1, 1.5, 1), 0.352, 1e-3); near(M.harmonic(1.6, 1, 1.5, 1), 0.81, 1e-12);
  near(M.harmonic(1.6, 1, 1.5, 1) - M.morse(1.6, 1, 1.5, 1), 0.458, 1e-3);
  near(M.harmonic(1 + 1 / 1.5, 1, 1.5, 1), 1, 1e-12); // 谐振子在 r = 1.67 rₑ 到达 D
  near(M.morseF(1 + Math.log(2) / 1.5, 1, 1.5, 1), -0.75, 1e-12); // 拐点处力最大：2Da · ¼
  const h = 1e-6; near(M.morseF(1.3, 1, 1.5, 1), -(M.morse(1.3 + h, 1, 1.5, 1) - M.morse(1.3 - h, 1, 1.5, 1)) / (2 * h), 1e-8);
});

test('第二章：消息传递的向量模型等变、能量不变，乘了固定矩阵的模型不等变', () => {
  const pos = M.centred(M.MOL.pos);
  assert.ok(M.equivError(M.vecModel, pos, R1) < 1e-13);
  assert.ok(M.equivError(M.badModel, pos, R1) > 0.1);
  near(M.pairEnergy(pos.map((p) => M.matVec(R1, p))), M.pairEnergy(pos), 1e-12);
  const Rt = M.matMul(R1, M.transpose(R1)); for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) near(Rt[i][j], i === j ? 1 : 0, 1e-14);
});

test('第三章：实球谐函数正交归一，Wigner D 是正交的群表示，l = 1 的分量是 (y, z, x)', () => {
  const grid = M.sphereGrid(8); // 对次数 ≤ 8 的球面多项式精确，Y_l·Y_l′（l, l′ ≤ 3）在其内
  const integ = (f) => grid.reduce((s, [[x, y, z], w]) => s + w * f(x, y, z), 0);
  for (const [l, m, l2, m2] of [[0, 0, 0, 0], [1, -1, 1, -1], [2, 1, 2, 1], [3, -2, 3, -2], [1, 0, 2, 0], [2, -2, 2, 2], [3, 1, 1, 1]]) near(integ((x, y, z) => M.realSH(l, m, x, y, z) * M.realSH(l2, m2, x, y, z)), l === l2 && m === m2 ? 1 : 0, 1e-10, `${l}${m}·${l2}${m2}`);
  const v = [0.3, -0.5, 0.8], n = M.norm(v), y1 = M.shVec(1, v.map((c) => c / n));
  near(y1[0] / y1[2], v[1] / v[0], 1e-12); near(y1[1] / y1[2], v[2] / v[0], 1e-12);
  for (const l of [1, 2, 3]) {
    const D1 = M.wignerD(l, R1), D2 = M.wignerD(l, R2), D12 = M.wignerD(l, M.matMul(R1, R2)), P = M.matMul(D1, D2), O = M.matMul(D1, M.transpose(D1));
    for (let i = 0; i <= 2 * l; i++) for (let j = 0; j <= 2 * l; j++) { near(P[i][j], D12[i][j], 1e-10, `D 同态 l=${l}`); near(O[i][j], i === j ? 1 : 0, 1e-10, `D 正交 l=${l}`); }
  }
  // 宇称 (−1)^l
  for (const l of [0, 1, 2, 3]) near(M.realSH(l, 0, -0.36, -0.48, -0.8), (-1) ** l * M.realSH(l, 0, 0.36, 0.48, 0.8), 1e-12);
});

test('第四章：CG 积等变，1 ⊗ 1 → 0 是点积、→ 1 是叉积，路径数按选择规则', () => {
  const x = [0.4, -0.2, 0.9], y = [-0.7, 0.5, 0.3];
  near(M.tensorProduct(1, M.toL1(x), 1, M.toL1(y), 0)[0], -M.dot(x, y) / Math.sqrt(3), 1e-12);
  const c = M.fromL1(M.tensorProduct(1, M.toL1(x), 1, M.toL1(y), 1)), cr = M.cross(x, y);
  for (let k = 0; k < 3; k++) near(c[k], cr[k] / Math.SQRT2, 1e-12);
  for (const [l1, l2, L] of [[1, 1, 2], [2, 1, 1], [2, 2, 3], [3, 2, 1]]) {
    const u = Array.from({ length: 2 * l1 + 1 }, (_, i) => Math.sin(i + 1)), w = Array.from({ length: 2 * l2 + 1 }, (_, i) => Math.cos(2 * i + 0.3));
    const lhs = M.matVec(M.wignerD(L, R1), M.tensorProduct(l1, u, l2, w, L)), rhs = M.tensorProduct(l1, M.matVec(M.wignerD(l1, R1), u), l2, M.matVec(M.wignerD(l2, R1), w), L);
    lhs.forEach((a, i) => near(a, rhs[i], 1e-10, `等变 ${l1}⊗${l2}→${L}`));
  }
  assert.equal(M.tpPaths(M.featureIrreps(1, 'both'), 1, 1, true).length, 10);
  // 第四章例题：只留 0e、1o，1o ⊗ 1o 只剩 → 0e
  const nat = M.tpPaths(M.featureIrreps(1, 'natural'), 1, 1, false).filter((p) => p.li === 1 && p.lf === 1);
  assert.equal(JSON.stringify(nat.map((p) => [p.lo, p.po])), '[[0,1]]');
  // 维数守恒 (2l₁ + 1)(2l₂ + 1) = Σ(2L + 1)
  for (const [a, b] of [[1, 1], [2, 3], [3, 3]]) { let s = 0; for (let L = Math.abs(a - b); L <= a + b; L++) s += 2 * L + 1; assert.equal(s, (2 * a + 1) * (2 * b + 1)); }
});

test('第五章：Bessel 基、包络在 r_c 处值和前两阶导数为零，近邻数估计', () => {
  near(M.envelope(0), 1); near(M.envelope(1 - 1e-12), 0, 1e-9); near(M.envelopeD(1 - 1e-12), 0, 1e-8); near(M.envelopeD2(1 - 1e-12), 0, 1e-6);
  const h = 1e-5; near(M.envelopeD(0.6), (M.envelope(0.6 + h) - M.envelope(0.6 - h)) / (2 * h), 1e-7); near(M.envelopeD2(0.6), (M.envelopeD(0.6 + h) - M.envelopeD(0.6 - h)) / (2 * h), 1e-5);
  near(M.bessel(1, 4, 4), 0, 1e-15); near(M.bessel(2, 2, 4), 0, 1e-15); near(M.bessel(1, 1e-12, 4), (2 / 4) * (Math.PI / 4), 1e-12);
  near(M.DENSITY.water, 0.1003, 1e-4); near(M.DENSITY.si, 0.04994, 1e-5); near(M.DENSITY.cu, 0.08467, 1e-5);
  near(M.sphereN(0.1, 6) - 1, 89.5, 0.1); near(M.sphereN(0.1, 4), 26.8, 0.05); near((6 / 4) ** 3, 3.375, 1e-12);
  // 近邻图：T 层的感受野包含 T − 1 层的
  const pts = M.scatter(32, 18, 2.4, 7), nb = M.neighbours(pts, 4);
  for (let i = 0; i < pts.length; i++) for (let j = 0; j < pts.length; j++) if (i !== j) assert.ok(Math.hypot(pts[i][0] - pts[j][0], pts[i][1] - pts[j][1]) >= 2.4 - 1e-9);
  assert.ok(M.hops(nb, 0, 3).size >= M.hops(nb, 0, 2).size && M.hops(nb, 0, 2).size >= nb[0].length + 1);
});

test('第六章：保守力 NVE 不漂、绕圈做功为零，有旋度的力相反', () => {
  const a = M.verlet(M.cluster(), 0.005, 1200), b = M.verlet(M.cluster(), 0.005, 1200, 0.3);
  const E0 = M.ljEnergy(M.cluster().x) + M.kinetic(M.cluster().v);
  assert.ok(Math.abs(M.ljEnergy(a.x) + M.kinetic(a.v) - E0) < 1e-3, '保守的漂移很小');
  assert.ok(Math.abs(M.ljEnergy(b.x) + M.kinetic(b.v) - E0) > 0.1, '有旋度的会漂');
  const x0 = M.cluster().x;
  assert.ok(Math.abs(M.loopWork(x0, 1, 0.05)) < 1e-5); assert.ok(Math.abs(M.loopWork(x0, 1, 0.05, 0.3)) > 1e-4);
  // 力是能量的负梯度（数值核对）
  const f = M.ljForces(x0), hh = 1e-6, xp = Float64Array.from(x0), xm = Float64Array.from(x0); xp[3] += hh; xm[3] -= hh;
  near(f[3], -(M.ljEnergy(xp) - M.ljEnergy(xm)) / (2 * hh), 1e-6);
  // 第六章例题：LiPS 2500 个结构 × (3·83 + 1)，λ_F = 83²
  assert.equal(2500 * (3 * 83 + 1), 625000); assert.equal(83 ** 2, 6889);
});

test('第七章：论文数字、LiPS 的幂律斜率、高斯过程加上力以后误差变小', () => {
  const L = M.PAPER.lips, fit = M.powerFit(L.N, L.Fmae);
  near(fit.b, -0.560, 1e-3); near(2 ** (1 / 0.56), 3.45, 0.01); near(8.3 * (2500 / 1000) ** -0.56, 5.0, 0.05);
  near(M.PAPER.lipsDiffusion.nequip / M.PAPER.lipsDiffusion.aimd, 0.912, 1e-3);
  assert.equal(M.PAPER.rmd17.Aspirin.F.join(), '41.9,12.9,8.7,8.5');
  for (const k of Object.keys(M.PAPER.rmd17)) { const F = M.PAPER.rmd17[k].F; assert.ok(F[1] < F[0] / 1.7, k); }
  assert.equal(M.PAPER.water.nDeepmd / M.PAPER.water.nNequip, 1003.7593984962406);
  for (let i = 0; i < 4; i++) { const q = M.PAPER.water.nequip[i] / M.PAPER.water.deepmd[i]; assert.ok(q > 0.24 && q < 0.5, `水和冰 ${i}: ${q}`); }
  const tr = Array.from({ length: 4 }, (_, i) => { const x = 0.75 + (i * (2.8 - 0.75)) / 3; return { x, E: M.morse(x, 1, 1.5, 1), F: M.morseF(x, 1, 1.5, 1) }; });
  const xs = Array.from({ length: 200 }, (_, i) => 0.75 + (i * 2.05) / 199), rm = (p) => Math.sqrt(p.reduce((s, q) => s + (q.E - M.morse(q.x, 1, 1.5, 1)) ** 2, 0) / p.length);
  assert.ok(rm(M.gpFit(tr, xs, { forces: true })) < rm(M.gpFit(tr, xs, { forces: false })));
});

test('第八章例题：GPU 分块时的边界', () => {
  const side = Math.cbrt(1e6 / 64 / 0.1); near(side, 53.9, 0.1);
  near(((side + 60) / side) ** 3, 9.4, 0.1); near(((side + 10) / side) ** 3, 1.67, 0.02);
});

test('生成的内容是最新的、八章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/nequip/nequip-${lang}.js 不是最新的：运行 node tools/nequip-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['why', 'symmetry', 'irreps', 'tensor', 'arch', 'forces', 'results', 'practice'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read('nequip/nequip-models.js') + '\n' + read('nequip/nequip-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_NEQUIP_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  assert.deepEqual([...Object.keys(DEMOS)].sort(), ['cost', 'curve', 'equiv', 'gpfit', 'graph', 'nve', 'pes', 'radial', 'sh', 'tp']);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 8, id); assert.ok(ch.points.length >= 5 && ch.math.length >= 4 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, 10, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 36); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 10); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
  assert.match(JSON.stringify(zh), /<code>nequip-train<\/code>/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /\['nequip', 'nequip\/index\.html', 'NequIP 等变势', 'NequIP'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("nequip\/index\.html"/); assert.match(seo, /\["nequip\/", "0\.8", "monthly"\]/);
  assert.match(read('nequip/index.html'), /data-section="nequip"/);
});
