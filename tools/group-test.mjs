// node --test tools/group-test.mjs
// 群论（/group-theory/）：十二个有限群满足群公理、30 个分子按流程图分到正确的点群、18 张特征标表正交完备（类的大小、
// 矢量和转动的归属都由矩阵重算）、振动的约化和红外 / 拉曼规则、简正模分析的频率个数、AOM 晶体场分裂（Δ_t = 4/9 Δ_o）、
// Hückel 轨道、17 种平面群闭合、晶体学限制定理、SU(2) → SO(3) 的二对一、CG 系数、近自由电子能带的简并、Landau 理论，
// 生成的内容是最新的、十二章中英齐全、十四个演示都登记了、54 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './group-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const DIR = 'group-theory/';
const sandbox = { window: {} };
vm.runInNewContext(read(DIR + 'gt-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_GROUP_MODELS;
const J = (x) => JSON.parse(JSON.stringify(x));
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`${DIR}gt-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_GROUP)); };

test('第一章：有限群满足群公理，阶、类和子群的个数对照已知结果', () => {
  const want = { C2: [2, 2, 2], C3: [3, 3, 2], C4: [4, 4, 3], C6: [6, 6, 4], V4: [4, 4, 5], D3: [6, 3, 6], D4: [8, 5, 10], D5: [10, 4, 8], D6: [12, 6, 16], Q8: [8, 5, 6], A4: [12, 4, 10], S4: [24, 5, 30] };
  for (const [id, [n, k, s]] of Object.entries(want)) {
    const g = M.finiteGroup(id);
    assert.ok(Object.values(M.checkAxioms(g)).every(Boolean), id);
    assert.equal(g.n, n, id); assert.equal(g.classes.length, k, id); assert.equal(g.subgroups.length, s, id);
    assert.equal(g.abelian, ['C2', 'C3', 'C4', 'C6', 'V4'].includes(id), id);
    for (const H of g.subgroups) assert.equal(g.n % H.length, 0, `${id} Lagrange`);
  }
});

test('第二章：30 个分子按流程图分到正确的点群，群的阶对得上', () => {
  assert.equal(M.MOLS.length, 30);
  for (const m of M.MOLS) {
    const r = M.classify(M.centred(m));
    assert.equal(r.pg, m.pg, m.id);
    if (Number.isFinite(M.groupOrder(r.pg))) assert.equal(M.closure(M.elementMatrices(r.S)).length, M.groupOrder(r.pg), m.id);
  }
  // Fe 给的流程图上的两个例子
  assert.deepEqual(J(M.classify(M.centred(M.molecule('chbrcl'))).steps.map((x) => x.node)), ['special', 'cn', 'sigmaA']);
  assert.equal(M.classify(M.centred(M.molecule('ch2cl2'))).pg, 'C2v');
});

test('第三章：18 张特征标表正交完备，类的大小、矢量 / 转动 / 二次函数的归属都由矩阵重算', () => {
  assert.equal(M.tableIds.length, 18);
  for (const id of M.tableIds) {
    const T = M.TABLES[id], h = M.tableOrder(T);
    assert.equal(T.irreps.length, T.classes.length, id);
    assert.equal(T.irreps.reduce((s, ir) => s + ir[1][0] ** 2, 0), h, id);
    T.irreps.forEach((a, i) => T.irreps.forEach((b, j) => near(M.inner(T, a[1], b[1]), i === j ? 1 : 0, 1e-9, `${id} ${a[0]}·${b[0]}`)));
    const mult = (ch) => M.reduce(T, ch).map((x) => Math.round(x * 1e6) / 1e6 + 0);
    const v = mult(M.vecChars(T)), r = mult(M.rotChars(T)), q = mult(M.quadChars(T));
    T.irreps.forEach((ir, i) => {
      assert.equal(v[i], ir[2].filter((f) => !/R/.test(f)).length, `${id} ${ir[0]} 矢量`);
      assert.equal(r[i], ir[2].filter((f) => /R/.test(f)).length, `${id} ${ir[0]} 转动`);
      assert.equal(q[i], ir[3].length, `${id} ${ir[0]} 二次`);
    });
    const reps = T.classes.map((c) => M.opMatrix(c[2])), G = M.closure(reps, 300);
    assert.equal(G.length, h, `${id} 闭合`);
    const cls = G.map((g) => reps.findIndex((R) => G.some((x) => M.sameM(M.mm(M.mm(x, R), M.transpose(x)), g, 1e-5))));
    T.classes.forEach((c, k) => assert.equal(cls.filter((x) => x === k).length, c[1], `${id} ${c[0]}`));
  }
});

test('第四、六章：振动的约化、红外和拉曼规则', () => {
  const name = (id) => { const g = M.gammaVib(M.molecule(id)); return [M.decompName(g.T, g.mult), g.mult.reduce((s, x, i) => s + x * g.T.irreps[i][1][0], 0), g.nModes, g]; };
  for (const [id, s] of [['h2o', '2A₁ + B₂'], ['nh3', '2A₁ + 2E'], ['ch4', 'A₁ + E + 2T₂'], ['sf6', 'A₁g + Eg + T₂g + 2T₁u + T₂u'], ['ch2cl2', '4A₁ + A₂ + 2B₁ + 2B₂'], ['xef4', 'A₁g + B₁g + B₂g + A₂u + B₂u + 2Eu']]) {
    const [n, d, modes] = name(id); assert.equal(n, s, id); assert.equal(d, modes, id);
  }
  // 有对称中心的分子：红外和拉曼互斥
  for (const id of ['sf6', 'benzene', 'xef4', 'ethylene', 'dce', 'ethane-s']) {
    const g = name(id)[3]; g.T.irreps.forEach((ir, i) => { if (g.mult[i]) assert.ok(!(g.ir[i] && g.ra[i]), `${id} ${ir[0]}`); });
  }
  const ch4 = name('ch4')[3]; assert.deepEqual(J(ch4.T.irreps.filter((_, i) => ch4.ir[i] && ch4.mult[i]).map((r) => r[0])), ['T_2']);
});

test('第六章：简正模分析：六个零频，频率按不可约表示成组', () => {
  const want = { h2o: [3, 0], nh3: [4, 2], ch4: [4, 2 + 3 + 3], bf3: [4, 2 + 2], ch2cl2: [9, 0] };
  for (const [id, [groups]] of Object.entries(want)) {
    const r = M.normalModes(id); assert.equal(r.zero, 6, id); assert.equal(r.groups.length, groups, id);
    for (const g of r.groups) { const d = M.TABLES[M.molecule(id).tbl].irreps.find((ir) => ir[0] === g.irrep)[1][0]; assert.equal(g.modes.length, d, `${id} ${g.irrep}`); }
  }
});

test('第五章：Hückel 环的能级 2cos(2πk/N)，苯 6 个 π 电子闭壳层、环丁二烯两个未成对', () => {
  for (const N of [3, 4, 5, 6, 7, 8]) {
    const a = M.huckelLevels(N).map((l) => l.x).sort((x, y) => x - y), b = M.symEig(M.huckelMatrix(N)).values.slice().sort((x, y) => x - y);
    a.forEach((x, i) => near(x, b[i], 1e-9, `N=${N}`));
  }
  const f6 = M.huckelFill(6, 6); assert.equal(f6.unpaired, 0); near(f6.E, 8, 1e-9);
  assert.equal(M.huckelFill(4, 4).unpaired, 2);
});

test('第七章：AOM 晶体场：八面体 Δ = 3e_σ，四面体 4/9，平面四方 d_{x²−y²} 最高；Jahn–Teller 拉长解除 e_g 简并', () => {
  const lv = (g, t) => M.aom(g, t).map((l) => l.e);
  const oh = lv('oh'); oh.slice(0, 3).forEach((e) => near(e, 0, 1e-9)); oh.slice(3).forEach((e) => near(e, 3, 1e-9));
  const td = lv('td'); near(td[2] - td[0], (4 / 9) * 3, 1e-9);
  const sp = M.aom('sp'); assert.equal(sp[4].main, 'x²−y²'); near(sp[4].e, 3, 1e-9);
  const jt = lv('oh', 0.8); assert.ok(jt[4] - jt[3] > 0.1);
  near(lv('oh').reduce((s, e) => s + e, 0), 6, 1e-9); // 重心：Σ = 6 e_σ（六个配体，每个 e_σ）
});

test('第八章：17 种平面群闭合（模格点平移），晶体学限制定理只允许 1、2、3、4、6 次轴', () => {
  assert.equal(Object.keys(M.WALL).length, 17);
  const mod = (x) => ((x % 1) + 1) % 1, key = (o) => JSON.stringify([o.m, o.t.map((v) => Math.round(mod(v) * 1000) / 1000)]);
  for (const id of Object.keys(M.WALL)) {
    const ops = M.wallOps(id), set = new Set(ops.map(key));
    for (const a of ops) for (const b of ops) {
      const m = [0, 1].map((i) => [0, 1].map((j) => a.m[i][0] * b.m[0][j] + a.m[i][1] * b.m[1][j]));
      assert.ok(set.has(key({ m, t: M.applyAff(a, b.t) })), id);
    }
  }
  assert.deepEqual([1, 2, 3, 4, 5, 6, 7, 8, 12].filter((n) => M.allowedRotation(n)), [1, 2, 3, 4, 6]);
});

test('第九、十章：SU(2) 二对一映到 SO(3)（转 2π 是 −1），CG 系数对照表', () => {
  assert.ok(M.sameM(M.so3FromSu2(M.su2([1, 1, 1], 1.1)), M.rot([1, 1, 1], 1.1), 1e-12));
  const U = M.su2([0, 0, 1], 2 * Math.PI); near(U[0][0][0], -1, 1e-12); near(U[1][1][0], -1, 1e-12);
  near(M.cg(0.5, 0.5, 0.5, -0.5, 1, 0), Math.SQRT1_2); near(M.cg(1, 1, 1, -1, 0, 0), 1 / Math.sqrt(3));
  near(M.cg(1, 0, 1, 0, 2, 0), Math.sqrt(2 / 3)); near(M.cg(1, 0, 1, 0, 1, 0), 0); near(M.cg(1.5, 0.5, 1, 0, 2.5, 0.5), Math.sqrt(3 / 5));
  // 正交性：Σ_{m1,m2} ⟨j1 m1 j2 m2|J M⟩² = 1
  for (const J of [1, 2, 3]) for (let m = -J; m <= J; m++) { let s = 0; for (let a = -2; a <= 2; a++) for (let b = -1; b <= 1; b++) if (a + b === m) s += M.cg(2, a, 1, b, J, m) ** 2; near(s, 1, 1e-9, `J=${J} M=${m}`); }
});

test('第十一章：近自由电子能带：空晶格在 X 点二重简并，加势之后打开能隙', () => {
  assert.deepEqual(J(M.emptyLattice([0.5, 0]).slice(0, 4)), [0.25, 0.25, 1.25, 1.25]);
  const x = M.nfeBands([0.5, 0], 0.05, 0.02); assert.ok(x[1] - x[0] > 0.05);
  const d = M.degeneracies(M.nfeBands([0.5, 0.5], 0.05, 0.02), 1e-6); assert.ok(d.some((g) => g[1] === 2), 'M 点的二维表示');
});

test('第十二章：Landau 理论的序参量和例题', () => {
  near(M.landauM0(0.5), 0.5, 1e-12); near(Math.abs(M.landauMin(0.5, 0)), 0.5, 1e-9);
  near(M.landauM0(1.2), 0, 0); near(M.landauMin(1.4, 0), 0, 1e-9);
  assert.ok(M.landauMin(0.5, 0.03) > 0 && M.landauMin(0.5, -0.03) < 0, '外场挑出极小');
  near(196884 - 196883, 1, 0);
});

test('生成的内容是最新的、十二章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/${DIR}gt-${lang}.js 不是最新的：运行 node tools/group-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['what', 'pointgroups', 'reps', 'reduce', 'orbitals', 'vibrations', 'ligand', 'crystals', 'lie', 'angular', 'bands', 'beyond'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read(DIR + 'gt-models.js') + '\n' + read(DIR + 'gt-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_GROUP_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  const names = ['aom', 'bands', 'cayley', 'cg', 'chartable', 'flow', 'huckel', 'landau', 'modes', 'reduce', 'restrict', 'su2', 'vib', 'wallpaper'];
  assert.deepEqual([...Object.keys(DEMOS)].sort(), names);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 6, id); assert.ok(ch.points.length >= 4 && ch.math.length >= 3 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, names.length, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 54); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.equal(C.index.quiz.length, 12); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /'group-theory\/index\.html'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("group-theory\/index\.html"/); assert.match(seo, /\["group-theory\/", "0\.8", "monthly"\]/);
  assert.match(read(DIR + 'index.html'), /data-section="group"/);
  assert.match(read(DIR + 'index.html'), /gt-models\.js[\s\S]*gt-demos\.js[\s\S]*gt\.js/);
});
