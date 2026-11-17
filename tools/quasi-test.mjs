// node --test tools/quasi-test.mjs
// 准粒子（/quasiparticles/，总馆）：演示的数学对照解析结果和文献数值（谱函数归一、Debye 声子数的两个极限、满带不导电、
// 费米液体 Γ/ε → 0、单磁振子精确对角化、激子的里德伯能量和 Elliott 公式、Feynman 极化子的表、等离子体频率、LST 关系、
// 微腔光子质量、BCS 的 2Δ/k_BT_c = 3.528、Kitaev 链的零能模、ARPES 扭折的斜率 1 + λ），章里例题的算术，
// 生成的内容是最新的、十二章中英齐全、十三个演示都登记了、57 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './quasi-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const DIR = 'quasiparticles/';
const sandbox = { window: {} };
vm.runInNewContext(read(DIR + 'quasi-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_QUASI_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const rel = (a, b, tol, msg = '') => assert.ok(Math.abs(a / b - 1) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`${DIR}quasi-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_QUASI)); };

test('第一章：谱函数归一、准粒子部分按 Z e^{−Γt} 衰减；例题', () => {
  const p = { E: 1, G: 0.05, Z: 0.7, Ei: 3, W: 1.5 };
  near(M.integrateN((w) => M.spectral(w, p), -400, 400, 4000), 1, 2e-3);
  near(M.survival(0, p), 1, 1e-12);
  near(M.survival(30, p), 0.7 * Math.exp(-0.05 * 30), 1e-6); // 背景早就散掉了
  // 例题：Γ = 8 meV → τ = 82 fs；E = 40 meV → T = 103 fs；τ/T = 0.80
  near(6.582e-13 / 8 * 1e15, 82.3, 0.1); near(4.1357e-12 / 40 * 1e15, 103.4, 0.1); near(40 / (2 * Math.PI * 8), 0.796, 1e-3);
});

test('第二章：Debye 声子数的低温 T³、高温 T 极限；铜的例题', () => {
  rel(M.phononNumber(2, 343), M.phononNumberLow(2, 343), 1e-6);
  rel(M.phononNumber(5000, 343), M.phononNumberHigh(5000, 343), 1e-5);
  near(18 * 1.2020569, 21.64, 0.01);
  const n = M.phononNumber(10, 343); near(n, 5.35e-4, 0.05e-4); near(n * 8.5e22 / 1e19, 4.6, 0.1);
  near(M.phononNumber(300, 343), 2.65, 0.01); // 正文：室温下每个原子两个多声子
});

test('第三章：满带不导电、电子和空穴算出同样的电流；有效质量的例题', () => {
  const full = M.tbCurrent(40, 1, 0.3); near(full.electrons, 0, 1e-12); near(full.holes, 0, 1e-12);
  for (const nu of [0.1, 0.5, 0.9]) for (const dk of [-0.4, 0.25]) { const r = M.tbCurrent(40, nu, dk); near(r.electrons, r.holes, 1e-12, `ν=${nu}`); }
  near(M.tbMass(0), 0.5, 1e-12); near(M.tbMass(Math.PI), -0.5, 1e-12); // ħ = a = t = 1：带底 ħ²/2ta²、带顶取负
  near(0.0762 / (2 * 1 * 0.09), 0.423, 1e-3); // 紧束缚例题
  const kF = Math.sqrt(Math.PI * 1e16), mc = (1.054571817e-34 * kF) / 1e6; near(mc / 9.1093837e-31, 0.0205, 2e-4); // 石墨烯回旋质量
  near(197.3269804 ** 2 / 510998.95, 0.0762, 1e-4); // ħ²/m_e = (ħc)²/(m_ec²) = 0.0762 eV·nm²
});

test('第四章：费米液体 Γ/ε → 0，边缘费米液体不 → 0；n(k) 跳变 Z；Kadowaki–Woods 例题', () => {
  assert.ok(M.flGamma(0.01, 0, 2) / 0.01 < 0.03 && M.flGamma(0.001, 0, 2) / 0.001 < 0.003);
  near(M.mflGamma(0.01, 0, 0.4) / 0.01, M.mflGamma(0.001, 0, 0.4) / 0.001, 1e-12);
  near(M.nk(-1e-9, 0.6) - M.nk(1e-9, 0.6), 0.6, 1e-6);
  near(M.KW * 400 ** 2, 1.6, 1e-12); near(1.6 * 4, 6.4, 1e-12); near(400 / 0.7, 571, 1);
});

test('第五章：单磁振子精确对角化 = J(1 − cos k)；Bloch 定律；铁的例题', () => {
  const N = 16, ex = M.oneMagnonExact(N).slice().sort((a, b) => a - b);
  const an = Array.from({ length: N }, (_, n) => 1 - Math.cos((2 * Math.PI * n) / N)).sort((a, b) => a - b);
  ex.forEach((v, i) => near(v, an[i], 1e-9, `#${i}`));
  near(M.magnonFM(Math.PI), 2 * 1 * 0.5 * 2, 1e-12); near(M.magnonAFM(Math.PI / 2), 1, 1e-12);
  near(M.blochDeficit(0.4) / M.blochDeficit(0.1), 8, 1e-9); // ∝ T^{3/2}
  near(280 * 0.01, 2.8, 1e-12); near(Math.sqrt(0.08617 * 10 / 280), 0.0555, 2e-4); near(2 * Math.PI / 0.0555 / 10, 11.3, 0.1);
});

test('第六章：激子里德伯能量和半径；Elliott 公式在带隙两边连续；Cu₂O 例题', () => {
  near(M.excitonRy(0.059, 12.9), 4.82, 0.01); near(M.excitonA(0.059, 12.9), 11.57, 0.02);
  near(M.excitonRy(0.366, 7.5), 88.5, 0.1);
  // 能级越靠近带隙越密：单位能量里的谱线强度 (4π/n³)/(2/n³) = 2π，接上带隙上方的 Sommerfeld 因子 → 2π
  near(M.sommerfeld(1e-6, 0, 1), 2 * Math.PI, 1e-6); near(M.sommerfeld(1e6, 0, 1) / Math.sqrt(1e6), 1, 0.01); // 远离带隙回到 √E
  // 展宽比线间距大时，带隙两边的吸收都是 2π√Ry：分立线平滑地接上连续谱
  near(M.elliott(-0.02, 0, 1, 0.05), 2 * Math.PI, 0.05); near(M.elliott(0.02, 0, 1, 0.05), 2 * Math.PI, 0.05);
  near(M.elliott(0.5, 0, 1, 0.02) / M.sommerfeld(0.5, 0, 1), 1, 0.03);
  near(M.levels2D(0, 1, 1), -4, 1e-12); // 二维基态是三维的 4 倍
  near(1.5 * 625 * 1.1, 1031, 1); near(92 / 625, 0.147, 1e-3); near(2 * 92 / 25 ** 3, 0.0118, 1e-4);
});

test('第七章：Feynman 极化子对照文献的表，弱、强耦合极限；例题', () => {
  for (const [a, E] of [[1, -1.0130], [3, -3.1333], [5, -5.4401], [7, -8.1127], [9, -11.486]]) near(M.feynman(a).E, E, 2e-3, `α=${a}`);
  near(M.feynman(5).mass, 3.886, 0.01);
  near(M.feynman(0.05).E, -0.05, 2e-4); near(M.feynman(0.2).mass, 1 + 0.2 / 6, 2e-3);
  assert.ok(M.feynman(12).E < M.polaronStrong(12)); // 变分上界比 Pekar 还低一点（Feynman 在强耦合给出 −0.106α² − 2.83）
  near(0.068 * 36, 2.45, 0.01); near(3.133 * 25, 78.3, 0.1);
});

test('第八章：等离子体频率（铝、钠、掺杂 GaAs）、Drude 反射和损失函数', () => {
  near(M.plasmaEV(18.1e22, 1), 15.80, 0.01); near(M.plasmaEV(2.65e22, 1), 6.04, 0.01);
  near(M.plasmaEV(1e24, 1), 37.1, 0.05); // 正文的系数
  near(M.plasmaEV(1e19, 0.067), 0.454, 0.002); near(M.plasmaEV(1e19, 0.067) / Math.sqrt(10.9), 0.1374, 5e-4); near(1239.84 / 0.1374, 9024, 20);
  assert.ok(M.reflect(M.drude(0.3, 1, 0.01)) > 0.97 && M.reflect(M.drude(2, 1, 0.01)) < 0.1);
  const lf = (w) => M.lossFn(M.drude(w, 1, 0.02)); assert.ok(lf(1) > 10 * lf(0.8) && lf(1) > 10 * lf(1.3));
  near(15.8 / Math.SQRT2, 11.17, 0.01);
});

test('第九章：两振子模型、Hopfield 系数、LST、微腔光子质量；例题', () => {
  const z = M.polariton(1.6, 1.6, 0.01); near(z.up - z.lo, 0.01, 1e-12); near(z.Xlo, 0.5, 1e-12);
  const far = M.polariton(1.7, 1.6, 0.01); assert.ok(far.Xlo > 0.99); // 腔在上面很远：下支几乎全是激子
  near(M.lst(268, 292, 10.9), 12.94, 0.01);
  const [lo, hi] = M.phononPolariton(1e5, 268, 292, 10.9); near(lo, 268, 0.5); near(hi, 1e5 / Math.sqrt(10.9), 50);
  const [l0, h0] = M.phononPolariton(1e-3, 268, 292, 10.9); near(l0, 0, 1e-3); near(h0, 292, 0.01);
  near(M.cavityMass(1.6), 3.84e-5, 0.01e-5);
  const m = 2 * M.cavityMass(1.6) * 9.1093837e-31, lt = 6.62607e-34 / Math.sqrt(2 * Math.PI * m * 1.380649e-23 * 10); near(lt * 1e6, 2.7, 0.05);
});

test('第十章：BCS 能隙方程、2Δ/k_BT_c = 3.528、Δ(T) 的两端、Bogoliubov 系数；例题', () => {
  for (const lam of [0.2, 0.25, 0.3]) {
    const tc = M.tcBCS(lam, 1), d0 = M.gap0(lam, 1);
    near((2 * d0) / tc, 3.528, 0.01, `λ=${lam}`);
    near(tc, 1.134 * Math.exp(-1 / lam), 0.01 * tc);
    near(M.gapT(1e-6 * tc, lam, 1), d0, 1e-6 * d0); near(M.gapT(0.999 * tc, lam, 1) / d0, 1.74 * Math.sqrt(0.001), 0.01);
    near(M.gapT(0.5 * tc, lam, 1) / d0, 0.9475, 0.01); // BCS 表：T/T_c = 0.5 时 Δ/Δ(0) ≈ 0.95
  }
  const b = M.bogoliubov(0, 1); near(b.E, 1, 1e-12); near(b.u2, 0.5, 1e-12); const b2 = M.bogoliubov(3, 1); near(b2.u2 + b2.v2, 1, 1e-12);
  near(M.bcsDOS(0.5, 1), 0, 1e-12); near(M.bcsDOS(5, 1), 5 / Math.sqrt(24), 1e-12);
  near(3.53 * 0.08617 * 1.18, 0.359, 2e-3); near(3.53 * 0.08617 * 7.2, 2.19, 0.01); near(2.7 / (0.08617 * 7.2), 4.35, 0.01);
  near((1.054571817e-34 * 2e6) / (Math.PI * 0.18e-3 * 1.602e-19) * 1e6, 2.33, 0.02);
});

test('第十一章：Kitaev 链的零能模、相变点和体能隙；散粒噪声例题', () => {
  const sweet = M.kitaevSpectrum(10, 0, 1, 1).values.map(Math.abs).sort((a, b) => a - b);
  near(sweet[0], 0, 1e-9); near(sweet[1], 0, 1e-9); for (const v of sweet.slice(2)) near(v, 2, 1e-9);
  const sp = (N) => Math.min(...M.kitaevSpectrum(N, 1, 1, 0.6).values.map(Math.abs));
  assert.ok(sp(30) < sp(15) / 100, `${sp(15)} → ${sp(30)}`); // 分裂随链长指数减小
  assert.ok(Math.min(...M.kitaevSpectrum(24, 3, 1, 0.6).values.map(Math.abs)) > 0.5); // 普通相：没有零能模
  near(M.kitaevBulk(Math.PI, 2, 1, 0.6), 0, 1e-12); // μ = 2t 时能隙在 k = π 闭合
  const v = M.kitaevSpectrum(24, 0, 1, 1), mid = 23, w = M.modeWeight(v.vectors[mid + 1], 24);
  near(w[0] + w[23], 1, 1e-9); // 甜点：零能模完全在两端
  near((2 * 1.602176634e-19 / 3) * 1e-9, 1.068e-28, 1e-31);
});

test('第十二章：ARPES 扭折，费米面附近的速度除以 1 + λ；例题', () => {
  const p = { v: 1, lam: 0.6, wE: 0.06 };
  const slope = (w) => { const h = 1e-5; return (2 * h) / (M.arpesPeak(w + h, p) - M.arpesPeak(w - h, p)); };
  near(slope(-1e-4) * (1 + 0.6), 1, 1e-3); // dω/dk = v/(1 + λ)
  near(slope(-1), 1, 0.02); // 远离扭折回到裸速度
  near(M.sigmaIm(-0.1, 0.6, 0.06), -(Math.PI * 0.6 * 0.06) / 2, 1e-12); near(M.sigmaIm(-0.03, 0.6, 0.06), 0, 1e-12);
  near(0.512 * Math.sqrt(16.7) * Math.sin((10 * Math.PI) / 180), 0.363, 2e-3); near(2.7 / 1.5 - 1, 0.8, 1e-12);
});

test('生成的内容是最新的、十二章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/${DIR}quasi-${lang}.js 不是最新的：运行 node tools/quasi-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['what', 'phonons', 'holes', 'fermi', 'magnons', 'excitons', 'polarons', 'plasmons', 'polaritons', 'cooper', 'anyons', 'measure'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read(DIR + 'quasi-models.js') + '\n' + read(DIR + 'quasi-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_QUASI_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  const names = ['arpes', 'band', 'bcs', 'count', 'exciton', 'fermi', 'kitaev', 'magnon', 'plasmon', 'polariton', 'polaron', 'spectral', 'zoo'];
  assert.deepEqual([...Object.keys(DEMOS)].sort(), names);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 6, id); assert.ok(ch.points.length >= 4 && ch.math.length >= 3 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, names.length, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 57); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.equal(C.index.quiz.length, 12); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
  assert.match(JSON.stringify(zh.chapters.phonons), /quasiparticles\/phonons\//, '声子一章链到声子馆');
});

test('顶栏、SEO 和站点地图接上了（总馆和声子馆）', () => {
  const nav = read('shared-nav.js');
  assert.match(nav, /'quasiparticles\/index\.html'/); assert.match(nav, /'quasiparticles\/phonons\/index\.html'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("quasiparticles\/index\.html"/); assert.match(seo, /\["quasiparticles\/", "0\.8", "monthly"\]/);
  assert.match(read(DIR + 'index.html'), /data-section="quasi"/);
  assert.match(read(DIR + 'index.html'), /quasi-models\.js[\s\S]*quasi-demos\.js[\s\S]*quasi\.js/);
});
