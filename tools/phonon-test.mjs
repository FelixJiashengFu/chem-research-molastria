// node --test tools/phonon-test.mjs
// 准粒子 · 声子（/quasiparticles/phonons/）：演示的数学对照解析结果（一维链的色散和力常数矩阵、双原子链边界频率、
// 正方格子的声速、fcc 态密度归一和 X 点、Debye 热容的两个极限、中子运动学、拉曼温度计、FPU 能量守恒和回归、
// 准谐近似的 Grüneisen 关系、热导率的斜率、冻结声子在准确点上的误差和虚频），章里例题的算术，
// 生成的内容是最新的、九章中英齐全、十一个演示都登记了、53 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './phonon-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const DIR = 'quasiparticles/phonons/';
const sandbox = { window: {} };
vm.runInNewContext(read(DIR + 'phonon-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_PHONON_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`${DIR}phonon-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_PHONON)); };

test('第一章：链的色散 = 力常数矩阵的本征值；声速；N 个 q', () => {
  for (const K2 of [0, 0.3]) {
    const N = 12, ev = M.symEig(M.chainHessian(N, 1, K2)).values.slice().sort((a, b) => a - b);
    const an = M.chainQs(N).map((q) => M.chainW2(q, 1, 1, K2)).sort((a, b) => a - b);
    ev.forEach((v, i) => near(v, an[i], 1e-9, `K2=${K2} #${i}`));
  }
  near(M.chainW(Math.PI, 1, 1), 2, 1e-12); near(M.chainVg(Math.PI, 1, 1), 0, 1e-12); near(M.chainVg(1e-6, 1, 1), 1, 1e-9);
  assert.equal(M.chainQs(20).length, 20); near(Math.max(...M.chainQs(20)), Math.PI, 1e-12);
  // 例题：a = 0.25 nm，v = 5000 m/s → ω_max = 4×10¹³ rad/s，6.37 THz，26.3 meV
  const w = (2 * 5000) / 0.25e-9; near(w / (2 * Math.PI) / 1e12, 6.37, 0.01); near(6.582e-16 * w * 1000, 26.3, 0.1);
});

test('第二章：双原子链边界频率 √(2K/M)、√(2K/m)，q = 0 的光学支，NaCl 的比值', () => {
  const d = M.diatomic(Math.PI, 1, 1, 1, 3);
  near(d.w[0], Math.sqrt(2 / 3), 1e-12); near(d.w[1], Math.sqrt(2), 1e-12);
  const z = M.diatomic(0, 1, 1, 1, 3); near(z.w[0], 0, 1e-7); near(z.w[1], Math.sqrt(2 * (1 + 1 / 3)), 1e-12);
  // 光学支在 q = 0 质心不动：m1 u1 + m2 u2 = 0
  const u = z.u[1]; near(1 * u[0][0] + 3 * u[1][0], 0, 1e-12);
  const e = M.diatomic(Math.PI, 1, 1, 1, 1); near(e.w[0], e.w[1], 1e-12); // 等质量等弹簧：没有带隙
  const r = 35.45 / 22.99; near(Math.sqrt(r), 1.242, 1e-3); near(Math.sqrt(1 + 1 / r), 1.284, 1e-3);
  const n = M.diatomic(Math.PI, 1, 1, 1, r); near(n.w[1] / n.w[0], Math.sqrt(r), 1e-12);
});

test('第三章：正方格子 K₂ = 0 时横波为零；声学求和；三角格子各向同性', () => {
  const s0 = M.sound2d('square', 1, 0, 1, 0); near(Math.min(...s0), 0, 1e-6); near(Math.max(...s0), 1, 1e-6);
  const s1 = M.sound2d('square', 1, 0.5, 1, 0); near(Math.min(...s1), Math.sqrt(0.5), 1e-6); near(Math.max(...s1), Math.sqrt(1.5), 1e-6); // v_L² = K₁ + K₂，v_T² = K₂
  const [a, b, dd] = M.dyn2d([0, 0], 'square', 1, 0.5); near(a, 0, 1e-15); near(b, 0, 1e-15); near(dd, 0, 1e-15);
  const t1 = M.sound2d('triangle', 1, 0, 1, 0.2), t2 = M.sound2d('triangle', 1, 0, 1, 1.1);
  t1.slice().sort().forEach((v, i) => near(v, t2.slice().sort()[i], 1e-6)); // 六角对称的弹性是各向同性的
});

test('第四章：fcc 态密度归一到 3、最高频率在 X 点；Bose 占据数', () => {
  const f = M.fccFreqs(16), h = M.histogram(f, 60, M.FCC_WMAX * 1.0001, 3);
  near(h.g.reduce((s, v) => s + v * h.dw, 0), 3, 1e-9);
  near(Math.max(...f), M.FCC_WMAX, 0.02);
  const x = M.fccAlong(1); near(x[2].w, 1, 1e-12);
  near(M.bose(1), 1 / (Math.E - 1), 1e-12); near(M.bose(1), 0.582, 1e-3);
  // 例题：硅 520 cm⁻¹ → 64.5 meV，300 K 时 n = 0.090，零点能 32 meV
  const hw = 520 / M.MEV.cm; near(hw, 64.5, 0.05); near(M.bose(hw / (300 / M.MEV.K)), 0.090, 0.001); near(hw / 2, 32.2, 0.1);
});

test('第五章：Debye 和 Einstein 热容的极限，铜的例题', () => {
  near(M.debyeC(1e5, 343), 3, 1e-4); near(M.einsteinC(1e5, 300), 3, 1e-4);
  near(M.debyeC(3, 343) / M.debyeT3(3, 343), 1, 1e-6);
  near(M.debyeT3(10, 343) * M.R_GAS, 0.0482, 5e-4);
  near(M.debyeC(300, 343) / 3, 0.938, 1e-3); near(M.debyeC(300, 343) * M.R_GAS, 23.39, 0.02);
  assert.ok(M.einsteinC(10, 343 * Math.sqrt(3 / 5)) < M.debyeC(10, 343) / 100); // Einstein 在低温掉得快得多
  near((12 * Math.PI ** 4) / 5 * M.R_GAS, 1944, 1);
});

test('第六章：中子运动学、拉曼温度计和例题', () => {
  near(M.kOfE(60), 5.381, 1e-3); near(M.lambdaOfE(81.8), 1, 2e-3); near(M.lambdaOfE(25.3), 1.798, 2e-3);
  const [lo, hi] = M.qRange(60, 20); near(lo, M.kOfE(60) - M.kOfE(40), 1e-12); near(hi, M.kOfE(60) + M.kOfE(40), 1e-12);
  assert.equal(M.qRange(10, 20), null);
  const L = 1e7 / 532, r = M.ramanRatio(520, 300, L); near(r, 0.103, 1e-3);
  near(M.ramanTemp(520, r, L), 300, 1e-9); near(M.ramanTemp(520, 0.15, L), 353, 1);
  // 细致平衡：吸收 / 产生 = e^{−ħω/k_BT}
  const p = M.onePhonon([1, 0, 0], [1, 0, 0], 20, 150); near(p.annihilate / p.create, Math.exp(-20 / (150 / M.MEV.K)), 1e-12);
});

test('第七章：FPU 能量守恒和回归；准谐近似的 Grüneisen 关系；铜的热膨胀', () => {
  const s = M.fpuInit(32, 1, 1), E0 = M.fpuEnergy(s, 0.25, 0);
  let best = 0;
  for (let i = 0; i < 150; i++) { M.fpuStep(s, 0.1, 1000, 0.25, 0); if (s.t > 5000) best = Math.max(best, M.fpuModes(s, 1)[0]); }
  near(M.fpuEnergy(s, 0.25, 0), E0, 1e-3 * E0);
  assert.ok(best > 0.9 * E0, `回归 ${best}`);
  const h = M.fpuInit(16, 1, 1); M.fpuStep(h, 0.05, 4000, 0, 0); near(M.fpuModes(h, 1)[0], 1, 1e-3); // 谐振链：能量留在第一个模式
  // 准谐：γ = 0 不膨胀；γ > 0 随温度膨胀；高温下 α ≈ γ C_V /(B V) = 3γ/(BV)
  near(M.qhaVolume(2, 0, 120), 1, 1e-6);
  const g = 2, BV = 3000, T = 3, dT = 0.01, a = (Math.log(M.qhaVolume(T + dT, g, BV)) - Math.log(M.qhaVolume(T - dT, g, BV))) / (2 * dT);
  near(a / ((3 * g) / BV), 1, 0.05);
  assert.ok(M.qhaVolume(2, -1, 120) < 1);
  near((2.0 * 23.4) / 7.11e-6 / 1.4e11 / 3, 1.57e-5, 0.02e-5);
});

test('第八章：热导率低温 ∝ T³、高温 ∝ 1/T，有一个峰；硅的平均自由程', () => {
  const sl = (t, o) => (Math.log(M.kappa(t * 1.01, o)) - Math.log(M.kappa(t / 1.01, o))) / (2 * Math.log(1.01));
  near(sl(0.003, {}), 3, 0.05); near(sl(5, {}), -1, 0.15);
  const ts = Array.from({ length: 80 }, (_, i) => 0.005 * 1.08 ** i), ks = ts.map((t) => M.kappa(t));
  const im = ks.indexOf(Math.max(...ks)); assert.ok(im > 0 && im < ks.length - 1);
  assert.ok(Math.max(...ts.map((t) => M.kappa(t, { a: 3 }))) < Math.max(...ks) / 3); // 合金压平了峰
  near((3 * 150) / (1.66e6 * 6400) * 1e9, 42.4, 0.1);
});

test('第九章：冻结声子在准确点上对、插值随超胞收敛、虚频和位移的误差', () => {
  const err = (lam, a, N, h = 0.01, noise = 0) => { const P = M.fdConstants(N, a, h, lam, { noise, seed: 3 }); let e = 0, c = 0; for (let i = 0; i <= 200; i++) { const q = (i / 200) * Math.PI / a; e = Math.max(e, Math.abs(M.signedW(M.fdW2(q, P, a)) - M.signedW(M.pairW2(q, a, lam)))); } for (let n = 0; n <= N / 2; n++) { const q = (2 * Math.PI * n) / (N * a); c = Math.max(c, Math.abs(M.fdW2(q, P, a) - M.pairW2(q, a, lam))); } return [e, c]; };
  for (const lam of [0.3, 0.5, 1, 2]) { let mn = Infinity; for (let i = 1; i <= 100; i++) mn = Math.min(mn, M.pairW2((i / 100) * Math.PI, 1, lam)); assert.ok(mn > -1e-9, `a = rₑ 时稳定 λ=${lam}`); }
  const [e4, c4] = err(0.5, 1, 4), [e8] = err(0.5, 1, 8), [e3] = err(2, 1, 3);
  assert.ok(c4 < 1e-3 * M.pairW2(Math.PI, 1, 0.5), `准确点 ${c4}`); assert.ok(e8 < e4 / 10); assert.ok(e3 > 0.5);
  assert.ok(err(0.5, 1, 8, 0.1)[0] > 20 * err(0.5, 1, 8, 0.01)[0]); // h 太大混进非谐项
  assert.ok(err(0.5, 1, 4, 0.001, 0.01)[0] > err(0.5, 1, 4, 0.03, 0.01)[0]); // 有噪声时 h 太小更糟
  assert.ok(M.pairW2(Math.PI / 1.55, 1.55, 0.3) < 0); near(M.inflection(0.3), 1.423, 1e-3);
  // 没有尾巴（C = 0）时拐点是 1 + ln2/α
  const C = M.PAIR.C; M.PAIR.C = 0; near(M.inflection(0.5), 1 + Math.log(2) / M.PAIR.alpha, 1e-9); M.PAIR.C = C;
});

test('生成的内容是最新的、九章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/${DIR}phonon-${lang}.js 不是最新的：运行 node tools/phonon-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['chain', 'diatomic', 'bz', 'quantum', 'heat', 'measure', 'anharm', 'transport', 'compute'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read(DIR + 'phonon-models.js') + '\n' + read(DIR + 'phonon-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_PHONON_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  assert.deepEqual([...Object.keys(DEMOS)].sort(), ['bz', 'chain', 'cv', 'diatomic', 'dos', 'fpu', 'frozen', 'kappa', 'qha', 'raman', 'scatter']);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 8, id); assert.ok(ch.points.length >= 5 && ch.math.length >= 4 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, 11, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 53); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 10); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /'quasiparticles\/phonons\/index\.html'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("quasiparticles\/phonons\/index\.html"/); assert.match(seo, /\["quasiparticles\/phonons\/", "0\.8", "monthly"\]/);
  assert.match(read(DIR + 'index.html'), /data-section="quasi"/);
});
