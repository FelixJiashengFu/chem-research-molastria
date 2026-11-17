// node --test tools/photochem-test.mjs
// 光化学与激发态（/photochem/）：吸收带的积分和 Strickler–Berg、Jablonski 动力学的产率加起来是 1 并和时间积分一致、
// Franck–Condon 因子的数值重叠对照 Poisson、能隙律的 Stirling 近似、Förster 半径对照 0.02108 公式、激子链的亮态能量、
// Landau–Zener 的含时薛定谔方程对照解析式、锥形交叉的几何相位、Marcus 抛物线和倒置区、MLJ 在 S → 0 时退回经典、
// TADF 两态动力学的本征值和产率、激发态电位和 Stern–Volmer、自由基对的零场和高场极限、瞬态吸收的仪器响应卷积，
// 每章例题里的数字，生成的内容是最新的、十一章中英齐全、十五个演示都登记了、72 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './photochem-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const DIR = 'photochem/';
const sandbox = { window: {} };
vm.runInNewContext(read(DIR + 'pc-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_PHOTOCHEM_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const rel = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`${DIR}pc-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_PHOTOCHEM)); };

test('第一章：高斯吸收带的面积、振子强度、Strickler–Berg 和 Beer 定律', () => {
  const xs = M.lin(10000, 40000, 6001), ys = xs.map((x) => 1e4 * M.gauss(x, 25000, 4000));
  rel(M.trapz(xs, ys), M.bandArea(1e4, 4000), 1e-6, '面积');
  rel(M.oscStrength(1e4, 4000), 0.184, 0.01, 'f');
  // ε = 10⁴、FWHM 4000 cm⁻¹、25000 cm⁻¹：k_r = 2.88e-9 ν² ∫ε dν ≈ 7.7e7 s⁻¹
  rel(M.stricklerBerg(1e4, 4000, 25000), 2.88e-9 * 25000 ** 2 * M.bandArea(1e4, 4000), 1e-12);
  near(M.transmit(M.absorbance(1e4, 1e-4, 1)), 0.1, 1e-12, 'A = 1 透过 10 %');
  near(M.erfc(0.5), 0.4795001221869535, 1e-7, 'erfc'); near(M.erfc(-1), 1.8427007929497148, 1e-7);
});

test('第二章：Jablonski 动力学的产率加起来是 1，荧光和磷光产率等于时间积分', () => {
  const k = { F: 1e8, IC: 5e7, ISC: 1e8, P: 1e2, TNR: 1e4, q: 0 }, R = M.jablonski(k);
  near(R.phiF + R.phiIC + R.phiISC, 1, 1e-12); near(R.phiP + R.phiTNR, R.phiISC, 1e-12);
  const ts = M.lin(0, 20 * R.tauS, 20001); rel(M.trapz(ts, ts.map((t) => k.F * R.S(t))), R.phiF, 1e-4, 'Φ_F = ∫k_F S dt');
  const tt = M.lin(0, 20 * R.tauT, 200001); rel(M.trapz(tt, tt.map((t) => k.P * R.T(t))), R.phiP, 1e-3, 'Φ_P = ∫k_P T dt');
  // 第二章例题的写法：k_r = Φ/τ
  near(0.5 / 4e-9, 1.25e8, 1);
});

test('第三章：Franck–Condon 因子的数值重叠对照 Poisson，加起来是 1', () => {
  for (const d of [0.5, 1.5, 2.5]) {
    const fc = M.fcFactors(1, 1, d, 30), S = d * d / 2;
    near(fc.from0.reduce((a, b) => a + b, 0), 1, 1e-6, `Σ d=${d}`);
    for (let v = 0; v < 8; v++) near(fc.from0[v], M.poisson(S, v), 1e-6, `v=${v} d=${d}`);
    for (let v = 0; v < 8; v++) near(fc.to0[v], fc.from0[v], 1e-6, '频率相同时吸收和发射镜像对称');
  }
  const fc = M.fcFactors(1, 0.6, 1, 30); near(fc.from0.reduce((a, b) => a + b, 0), 1, 1e-5, '频率不同时也归一');
});

test('第四章：能隙律随能隙指数下降，Englman–Jortner 式是 Poisson 的 Stirling 近似', () => {
  const hw = 0.18, S = 1;
  for (const dE of [1.8, 2.7, 3.6]) rel(M.gapEJ(dE, hw, S), M.gapRate(dE, hw, S), 0.02, `ΔE=${dE}`);
  assert.ok(M.gapRate(2, hw, S) / M.gapRate(3, hw, S) > 1e3, '能隙大一个电子伏特，速率慢上千倍');
  const K = M.kasha({ E1: 3, E2: 4, kr1: 1e8, kr2: 1e8, hw, S }); assert.ok(K.k21 > 1e3 * K.k10, 'S₂ → S₁ 的内转换远快于 S₁ → S₀');
  assert.ok(K.phiS2 < 1e-2 && K.phiS1 > 0.5, 'Kasha 规则：S₂ 几乎不发光');
});

test('第五章：Förster 半径对照 0.02108 公式、FRET 效率、激子链的亮态', () => {
  for (const [k2, phi, n, J] of [[2 / 3, 0.5, 1.4, 1e15], [2 / 3, 0.9, 1.33, 5e14], [4, 0.3, 1.5, 3e13]]) rel(M.forsterR0(k2, phi, n, J), 0.02108 * (k2 * phi * n ** -4 * J) ** (1 / 6), 1e-3, 'R₀（0.02108 是四舍五入的系数）');
  near(M.fretE(5, 5), 0.5, 1e-12); near(M.fretE(10, 5), 1 / 65, 1e-12, '自测：10 nm 处约 1.5 %');
  for (const N of [2, 5, 12]) {
    const X = M.exciton(N, -0.1), iMin = X.E.indexOf(Math.min(...X.E));
    near(Math.min(...X.E), 2 * -0.1 * Math.cos(Math.PI / (N + 1)), 1e-9, `J 聚集体最低态 N=${N}`);
    near(X.f.reduce((a, b) => a + b, 0), N, 1e-9, '振子强度守恒');
    assert.equal(X.f.indexOf(Math.max(...X.f)), iMin, 'J 聚集体：最低的态最亮');
  }
});

test('第六章：Landau–Zener 的数值解对照 exp(−2πV²/α)，锥形交叉的几何相位是 π', () => {
  for (const [V, a] of [[0.2, 1], [0.35, 1], [0.5, 2], [0.05, 6], [1, 0.05]]) {
    const T = Math.max(30 / Math.sqrt(a), 40 * V / a, 12), R = M.lzSolve(V, a, T, Math.min(0.01, 0.15 / (a * T)), 1000); // 和演示同样的 T 和步长
    near(R.final, M.lzP(V, a), 1e-4, `V=${V}：跳到上面绝热态的概率就是 P_LZ`);
    near(R.norm, 1, 5e-4, '模长守恒（RK4 不严格幺正）');
  }
  assert.equal(M.berryPhase(0, 0, 0.5, 1, 1), Math.PI, '绕过尖点'); assert.equal(M.berryPhase(2, 0, 0.5, 1, 1), 0, '不绕');
  assert.equal(M.berryPhase(0.1, -0.1, 0.3, 1, 0.4), Math.PI, '各向异性的锥');
  const [lo, up] = M.coneE(0.3, 0.4, 1, 1); near(up - lo, 1, 1e-12, '线性锥：能隙 = 2|r|');
});

test('第七章：Marcus 抛物线、无活化点、倒置区，MLJ 在 S → 0 时退回经典，例题的数字', () => {
  const lam = 1, V = 0.01;
  near(M.marcusBarrier(-lam, lam), 0, 1e-15);
  const [gr, gp] = M.marcusCurves(M.marcusCross(lam, -0.4), lam, -0.4); near(gr, gp, 1e-12, '交点'); near(gr, M.marcusBarrier(-0.4, lam), 1e-12);
  near(M.marcusBarrier(-0.5, lam), 0.0625, 1e-15); near(M.marcusBarrier(-1.5, lam), 0.0625, 1e-15);
  rel(M.marcusK(-0.5, lam, V), M.marcusK(-1.5, lam, V), 1e-12, '经典 Marcus 对 −λ 对称');
  rel(M.marcusK(-1, lam, V) / M.marcusK(-0.5, lam, V), Math.exp(0.0625 / (M.C.kB * 298.15)), 1e-9); assert.ok(Math.abs(M.marcusK(-1, lam, V) / M.marcusK(-0.5, lam, V) - 11.4) < 0.3, '约 11 倍');
  rel(M.mljK(-0.7, lam, V, 0.18, 1e-9), M.marcusK(-0.7, lam, V), 1e-6, 'S → 0');
  const a = M.mljK(-0.5, lam, V, 0.18, 1), b = M.mljK(-1.5, lam, V, 0.18, 1);
  assert.ok(b > 5 * a, 'MLJ：倒置区一侧衰减得慢'); rel(a, 6e10, 0.1); rel(b, 6.6e11, 0.1);
  near(M.marcusK(-1, 1, 0.01), 1.68e12, 0.01e12, 'V = 10 meV、λ = 1 eV 的峰值');
});

test('第八章：TADF 两态动力学：本征值、细致平衡、产率和时间积分一致、例题的数字', () => {
  const e = (x) => 10 ** x, p = { kr: e(7.2), knrS: e(5.5), kISC: e(7.7), knrT: e(3.5), dEST: 0.083, T: 300 }, R = M.tadf(p);
  const a = p.kr + p.knrS + p.kISC, b = R.kRISC + p.knrT;
  near(R.l1 + R.l2, -(a + b), 1e-6 * (a + b), '迹'); rel(R.l1 * R.l2, a * b - R.kRISC * p.kISC, 1e-9, '行列式');
  rel(R.kRISC, 6.7e5, 0.02, 'k_RISC'); rel(R.tauDF, 6.0e-6, 0.02); near(R.phiF, 0.966, 2e-3); near(R.phiPF, 0.239, 2e-3);
  const ts = M.lin(0, 40 * R.tauDF, 400001); rel(M.trapz(ts, ts.map((t) => p.kr * R.fromS(t))), R.phiF, 2e-3, 'Φ_F = ∫k_r S dt');
  near(R.fromS(0), 1, 1e-12); near(R.fromT(0), 0, 1e-12);
  const C = M.tadf({ ...p, T: 77 }); rel(C.kRISC, 62, 0.03, '77 K'); near(C.phiF, C.phiPF, 0.01, '77 K 只剩瞬时荧光');
  const Z = M.tadf({ ...p, dEST: 0 }); rel(Z.kRISC, p.kISC / 3, 1e-12, '能隙为零时 k_RISC = k_ISC/3');
});

test('第九章：激发态电位（Prier 2013 的表）、Rehm–Weller、Stern–Volmer 和例题', () => {
  const ru = M.excitedPot(1.29, -1.33, 2.1), ir = M.excitedPot(0.77, -2.19, 2.5);
  near(ru.oxStar, -0.81, 1e-12); near(ru.redStar, 0.77, 1e-12); near(ir.oxStar, -1.73, 1e-12); near(ir.redStar, 0.31, 1e-12);
  const dG = M.rehmWellerDG(1.29, -0.45, 2.1); near(dG, -0.36, 1e-12);
  const kq = M.rehmWellerK(dG); rel(kq, 1.15e10, 0.02, '例题');
  assert.ok(M.rehmWellerK(-1.5) > 0.95 * M.rehmWellerK(-0.8), '强放热时是平台，不下降');
  assert.ok(M.rehmWellerK(0.3) < 1e-3 * M.rehmWellerK(-0.5), '吸热时很慢');
  const sv = M.sternVolmer(0.01, kq, 1.1e-6); rel(sv.I, 127, 0.01, 'I₀/I');
  const st = M.sternVolmer(0.01, 1e9, 1e-6, 150); near(st.tau, 11, 1e-9); near(st.I, 11 * 2.5, 1e-9, '静态猝灭只改强度');
});

test('第十章：自由基对的单重态产率：零场 5/8、高场 1/2、低场效应、复合太快时没有磁场效应', () => {
  near(M.singletYield(0, 0, 1, 1, 0.01), 0.625, 1e-6, '零场、慢复合'); near(M.singletYield(0, 0, 1, 1, 1), 0.625, 1e-4, '例题：零场');
  near(M.singletYield(50, 0, 1, 1, 1e-3), 0.5, 2e-3, '高场、慢复合');
  near(M.singletYield(0.05, 0, 1, 1, 1), 0.3876, 2e-3, '例题：地磁场'); near(M.singletYield(5, 0, 1, 1, 1), 0.4953, 2e-3, '例题：5 mT');
  near(M.singletYield(0, 0, 1, 1, 100), M.singletYield(0.05, 0, 1, 1, 100), 1e-3, '复合快：低场效应消失');
  const H = M.rpHamiltonian(0.3, 0.7, 0.4, 1.2); for (let i = 0; i < 8; i++) for (let j = 0; j < 8; j++) near(H[i][j], H[j][i], 1e-12, '厄米');
  const P = M.rpProjector(); near(P.reduce((s, r, i) => s + r[i], 0), 2, 1e-12, '单重态投影的迹 = 核自旋态数');
  assert.ok(Math.abs(M.singletYield(0.05, 0, 0.2, 2, 0.5) - M.singletYield(0.05, Math.PI / 2, 0.2, 2, 0.5)) > 1e-3, '各向异性：产率随方向变');
});

test('第十一章：指数和高斯仪器响应的卷积、依次反应的浓度、瞬态吸收的符号', () => {
  for (const t of [-0.1, 0.3, 2]) near(M.expIRF(t, 1, 1e-6), t >= 0 ? Math.exp(-t) : 0, 1e-4, `σ → 0, t=${t}`);
  const ts = M.lin(-5, 60, 65001); rel(M.trapz(ts, ts.map((t) => M.expIRF(t, 0.2, 0.5))), 5, 1e-4, '∫ = 1/k');
  for (const t of [-3, -1, 0, 1]) assert.ok(Number.isFinite(M.expIRF(t, 50, 0.3)), '大 kσ 时不溢出');
  // 依次反应：没有仪器响应时 c_A + c_B 的导数是 −k₂ c_B
  const k1 = 1, k2 = 0.1, h = 1e-5;
  for (const t of [0.5, 2, 10]) { const [a, b] = M.seqPops(t, k1, k2, 0), [a2, b2] = M.seqPops(t + h, k1, k2, 0); near((a2 + b2 - a - b) / h, -k2 * b, 1e-4); }
  // 第十一章例题：10 fs 变换极限脉冲 800 nm 的谱宽
  near((800e-9) ** 2 * (0.441 / 10e-15) / 2.998e8 * 1e9, 94, 1);
});

test('生成的内容是最新的、十一章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/${DIR}pc-${lang}.js 不是最新的：运行 node tools/photochem-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['light', 'jablonski', 'franck', 'kasha', 'transfer', 'ci', 'marcus', 'tadf', 'photocat', 'life', 'measure'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read(DIR + 'pc-models.js') + '\n' + read(DIR + 'pc-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_PHOTOCHEM_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  const names = ['absorb', 'aggregate', 'cone', 'fc', 'fcwave', 'fret', 'gap', 'jablonski', 'lz', 'marcus', 'redox', 'rp', 'sv', 'ta', 'tadf'];
  assert.deepEqual([...Object.keys(DEMOS)].sort(), names);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 6, id); assert.ok(ch.points.length >= 4 && ch.math.length >= 3 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, names.length, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 72); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.equal(C.index.quiz.length, 12); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /'photochem\/index\.html'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("photochem\/index\.html"/); assert.match(seo, /\["photochem\/", "0\.8", "monthly"\]/);
  assert.match(read(DIR + 'index.html'), /data-section="photochem"/);
  assert.match(read(DIR + 'index.html'), /pc-models\.js[\s\S]*pc-demos\.js[\s\S]*pc\.js/);
});
