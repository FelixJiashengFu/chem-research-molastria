// node --test tools/dft-test.mjs
// 密度泛函理论（/dft/）：Thomas–Fermi 的大 Z 展开、Hubbard 二聚体的精确解和反演、一维 Kohn–Sham 自洽场（能量的两种算法一致、
// DIIS 比线性混合快）、GGA 增强因子的极限和氢原子交换能、均匀电子气、分数电子数的直线条件、色散阻尼、平面波和 k 点收敛、
// Birch–Murnaghan 拟合、两能级 Casida 和电荷转移、积分格点，生成的内容是最新的、十章中英齐全、十二个演示都登记了、
// 70 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './dft-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const DIR = 'dft/';
const sandbox = { window: {} };
vm.runInNewContext(read(DIR + 'dft-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_DFT_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`${DIR}dft-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_DFT)); };

test('第一章：Thomas–Fermi 加 Scott 和 Schwinger 修正，越重的原子相对误差越小', () => {
  near(M.tfEnergy(18, 3), -524.12, 0.01, 'Ar 三项');
  const rel = (z, e, k) => Math.abs((M.tfEnergy(z, k) - e) / e);
  const ar = M.ATOMS.find((a) => a[0] === 'Ar');
  assert.ok(rel(18, ar[2], 3) < rel(18, ar[2], 2) && rel(18, ar[2], 2) < rel(18, ar[2], 1));
  assert.ok(rel(18, ar[2], 1) < rel(2, -2.903724, 1), '纯 TF 对重原子更准');
  near(M.ATOMS.find((a) => a[0] === 'H')[2], -0.5, 0);
});

test('第二章：Hubbard 二聚体的精确解、U = 0 时等于 Kohn–Sham、密度反演回到原来的势', () => {
  near(M.dimer(0, 1).E, (1 - Math.sqrt(1 + 16 * 0.25)) / 2, 1e-9, 'Δv = 0 的闭式');
  near(M.dimer(0, 1).E, -0.618034, 1e-6);
  for (const dv of [0.3, 1, 2.5]) near(M.dimer(dv, 0).dn, M.dimerDnS(dv), 1e-9, `U = 0, Δv = ${dv}`);
  const r = M.dimer(1.2, 2), inv = M.dimerInvert(r.dn, 2);
  near(inv.dv, 1.2, 1e-6, '反演'); near(inv.E, r.E, 1e-6);
  near(M.dimerInvert(-0.5, 2).dv, 1.4258, 1e-3); near(M.dimerInvert(-0.5, 2).F, -0.2080, 1e-3);
});

test('第三章：一维 Kohn–Sham：没有相互作用时等于单粒子解，能量的两种算法一致，DIIS 比线性混合快', () => {
  near(M.ks1d({ Z: 1, N: 2, xc: 'none' }).eps[0], -0.66991, 1e-4, '软库仑氢');
  const lin3 = M.ks1d({ Z: 2, N: 2, xc: 'x2', mix: 'linear', alpha: 0.3 }), diis = M.ks1d({ Z: 2, N: 2, xc: 'x2', mix: 'diis', alpha: 0.3 });
  assert.ok(lin3.converged && diis.converged);
  near(lin3.E, -2.224663, 1e-5); near(diis.E, lin3.E, 1e-6);
  assert.ok(diis.iters < lin3.iters, `DIIS ${diis.iters} vs 线性 ${lin3.iters}`);
  assert.ok(!M.ks1d({ Z: 2, N: 2, xc: 'h', mix: 'linear', alpha: 1 }).converged, 'α = 1 只有 Hartree 时振荡');
  assert.ok(M.ks1d({ Z: 2, N: 2, xc: 'h', mix: 'diis', alpha: 1 }).converged, 'DIIS 救回来');
  for (const [Z, N, e] of [[2, 2, -2.725498], [6, 6, -15.162820]]) {
    const r = M.ks1d({ Z, N, xc: 'lda', mix: 'diis' });
    assert.ok(r.converged); near(r.E, e, 1e-5, `LDA Z=${Z}`);
    // 本征值之和减去重复计算的部分，等于直接算的总能量
    const h = r.h, occ = Math.floor(N / 2), sumEps = 2 * r.eps.slice(0, occ).reduce((s, v) => s + v, 0);
    const dbl = r.n.reduce((s, v, i) => s + (r.vh[i] + r.vx[i]) * v * h, 0);
    near(sumEps - dbl + r.EH + r.Ex, r.E, 1e-4, `能量的两种算法 Z=${Z}`);
    near(r.n.reduce((s, v) => s + v * h, 0), N, 1e-6, '电子数');
  }
});

test('第四章：GGA 增强因子的极限、氢原子交换能、均匀电子气', () => {
  for (const k of Object.keys(M.FX)) near(M.FX[k](0), 1, 1e-12, k);
  near(M.FX.pbe(1e4), 1 + M.KAPPA, 1e-4, 'PBE 的上限 1 + κ');
  near((M.FX.ge(0.01) - 1) / 1e-4, M.MU_GE, 1e-9, '梯度展开');
  near((M.FX.pbesol(0.01) - 1) / 1e-4, M.MU_GE, 1e-3, 'PBEsol 改回 μ_GE');
  near(M.EX_LDA_H, -0.26804, 1e-5);
  const want = { lda: -0.26804, b88: -0.30976, pbe: -0.30594, revpbe: -0.31052, pbesol: -0.29269, ge: -0.30541 };
  for (const [k, v] of Object.entries(want)) near(M.hydrogenEx(M.FX[k]), v, 2e-5, k);
  // 精确交换 −5/16：B88 最接近
  const err = (k) => Math.abs(M.hydrogenEx(M.FX[k]) + 0.3125);
  assert.ok(err('b88') < err('pbe') && err('pbe') < err('pbesol') && err('pbesol') < err('lda'));
  near(M.pw92(1), -0.05977, 2e-5, 'PW92(rs = 1)');
  near(M.ueX(2), -0.458165 / 2, 1e-6, 'ε_x = −0.4582/rs');
  near(M.ueX(1, 1) / M.ueX(1, 0), 2 ** (1 / 3), 1e-12, '完全极化');
});

test('第五章：分数电子数：精确的 E(N) 是直线，弯曲 b 让能隙少 2b', () => {
  for (const N of [-0.7, -0.2, 0.3, 0.9]) near(M.fracE(N, 11.26, 1.26, 0), N < 0 ? -11.26 * N : -1.26 * N, 1e-12);
  const s = M.fracSlopes(11.26, 1.26, 2);
  near(s.homo, -9.26, 1e-12); near(s.lumo, -3.26, 1e-12); near(s.gapApprox, 6, 1e-12);
  near(M.fracE(0.5, 11.26, 1.26, 2) - M.fracE(0.5, 11.26, 1.26, 0), -0.5, 1e-12, '半个电子低 b/4');
});

test('第六章：色散：BJ 阻尼在短距离有限，玩具曲线的极小落在 Ar₂ 的实验值上', () => {
  assert.ok(Number.isFinite(M.dispBJ(1e-6, M.AR.C6, M.AR.R0)));
  near(M.dispZero(0.5, M.AR.C6, 3.4), 0, 1e-6, '零阻尼在短距离归零');
  near(M.dispBJ(50, M.AR.C6, M.AR.R0) / M.dispBare(50, M.AR.C6), 1, 1e-4, '远处回到 −C₆/R⁶');
  near(M.dispBare(3.757, M.AR.C6) * 349.755, -110.19, 0.05, '例题：C₆ 项 110 cm⁻¹');
  const f = (R) => M.dispBJ8(R, M.AR.C6, M.AR.R0), rep = M.toyRepulsion(f);
  const m = M.curveMin((R) => rep.A * Math.exp(-rep.b * R) + f(R), 3, 5);
  near(m.R, M.AR.Re, 1e-4); near(-m.E, M.AR.De, 1e-5);
});

test('第七章：平面波单调收敛，绝缘体的 k 点指数收敛、金属代数收敛', () => {
  const ref = M.pwE0(0, 70, { sigma: 0.25 });
  let prev = Infinity;
  for (const m of [1, 2, 4, 8, 12]) { const e = M.pwE0(0, m, { sigma: 0.25 }); assert.ok(e >= ref - 1e-12 && e <= prev + 1e-12, `M=${m}`); prev = e; }
  near(M.bandExact('metal'), -4 / Math.PI, 1e-12);
  const em = (n) => Math.abs(M.bandEnergy('metal', n) - M.bandExact('metal')), ei = (n) => Math.abs(M.bandEnergy('insulator', n) - M.bandExact('insulator'));
  near(em(16), 8.2e-3, 1e-4); near(em(64), 5.1e-4, 2e-5);
  assert.ok(ei(16) < 1e-5 && ei(32) < 1e-9, '绝缘体指数收敛');
  assert.ok(em(16) / em(64) > 12 && em(16) / em(64) < 20, '金属 ∝ N⁻²');
});

test('第八章：Birch–Murnaghan：没有噪声时拟合回到原来的参数，例题的压力', () => {
  const V0 = 20.02, Vs = [0.94, 0.97, 1, 1.03, 1.06].map((f) => f * V0), f = M.bmFit(Vs, Vs.map((v) => M.bmE(v, V0, 98, 4.2)));
  near(f.V0, V0, 1e-5); near(f.B0, 98, 0.01); near(f.Bp, 4.2, 0.01);
  near(M.bmP(V0, V0, 98, 4.2), 0, 1e-12);
  near(M.bmP(0.9 * V0, V0, 98, 4.2), 12.89, 0.01, '例题');
  // 压力和能量的导数一致
  const h = 1e-4, v = 0.95 * V0; near(-(M.bmE(v + h, V0, 98, 4.2) - M.bmE(v - h, V0, 98, 4.2)) / (2 * h) * M.GPA, M.bmP(v, V0, 98, 4.2), 1e-4);
});

test('第九章：两能级 Casida 和电荷转移', () => {
  const r = M.casida(5, 0, 0, 0); near(r.S, 5, 1e-12); near(r.T, 5, 1e-12);
  const q = M.casida(5, 0.5, -0.4, -0.2); assert.ok(q.S > q.T, '单态高于三态'); assert.ok(q.TDA_S >= q.S - 1e-12, 'TDA 不低于完整的 Casida');
  const ct = M.ctEnergy(10, 9, 1, 3, 0); near(ct.exact, 6.56, 0.005); near(ct.dfa, 5, 1e-12);
  near(M.ctEnergy(10, 9, 1, 3, 1).dfa, ct.exact, 1e-12, '长程校正回到精确');
});

test('第十章：积分格点：Gauss–Legendre 精确积多项式，氢原子径向格点指数收敛，Becke 分割修好 H₂', () => {
  const { x, w } = M.gaussLegendre(5);
  near(x.reduce((s, xi, i) => s + w[i] * xi ** 8, 0), 2 / 9, 1e-12, 'x⁸');
  near(M.hAtomGrid(30).N, 1, 1e-8); near(M.hAtomGrid(30).Ex, M.EX_LDA_H, 1e-9);
  assert.ok(Math.abs(M.hAtomGrid(20).errEx) < Math.abs(M.hAtomGrid(12).errEx) / 100);
  const a = M.h2Grid(20, 10, false), b = M.h2Grid(20, 10, true);
  assert.ok(Math.abs(b.err) < 1e-5 && Math.abs(a.err) > 1e-4, `Becke ${b.err} vs ${a.err}`);
});

test('生成的内容是最新的、十章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/${DIR}dft-${lang}.js 不是最新的：运行 node tools/dft-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['why', 'hk', 'ks', 'ladder', 'errors', 'disp', 'basis', 'solids', 'tddft', 'practice'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read(DIR + 'dft-models.js') + '\n' + read(DIR + 'dft-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_DFT_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  const names = ['casida', 'dimer', 'disp', 'enh', 'eos', 'frac', 'grid', 'kpts', 'pwcut', 'scf', 'tf', 'ueg'];
  assert.deepEqual([...Object.keys(DEMOS)].sort(), names);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 6, id); assert.ok(ch.points.length >= 4 && ch.math.length >= 3 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, names.length, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 70); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.equal(C.index.quiz.length, 12); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /'dft\/index\.html'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("dft\/index\.html"/); assert.match(seo, /\["dft\/", "0\.8", "monthly"\]/);
  assert.match(read(DIR + 'index.html'), /data-section="dft"/);
  assert.match(read(DIR + 'index.html'), /dft-models\.js[\s\S]*dft-demos\.js[\s\S]*dft\.js/);
});
