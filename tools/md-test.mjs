// node --test tools/md-test.mjs
// 分子动力学与自由能（/md/）：演示的数学对照解析结果（Verlet 的影子能量精确守恒、h = 2 失稳、RK4 会漂；
// Nosé–Hoover 单振子不遍历而 Langevin / 链 / CSVR 对；Berendsen 把动能涨落压掉；LJ 截断和尾修正；
// 谐振子 FEP/BAR/TI 收敛到 ½ ln(k₁/k₀)；WHAM 和元动力学恢复双势阱的垒高；Jarzynski 和 Crooks；
// 马尔可夫模型的隐含时间尺度对照 Smoluchowski 方程的本征值；AR(1) 的分块平台），章里例题的算术，
// 生成的内容是最新的、十章中英齐全、十二个演示都登记了、78 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './md-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('md/md-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_MD_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`md/md-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_MD)); };

test('第一章：LJ 盒子里动量守恒、NVE 总能量不漂，温度按 N − 1 个自由度算', () => {
  const s = M.ljBox(36, 0.6, 1.0, 3);
  const P = () => { let px = 0, py = 0; for (let i = 0; i < s.N; i++) { px += s.v[2 * i]; py += s.v[2 * i + 1]; } return [px, py]; };
  for (const c of P()) near(c, 0, 1e-10, '初始总动量');
  const E = () => M.ljKinetic(s) + s.U;
  M.ljRun(s, 0.004, 100); const E0 = E();
  M.ljRun(s, 0.004, 500);
  for (const c of P()) near(c, 0, 1e-9, '总动量');
  assert.ok(Math.abs(E() - E0) / s.N < 5e-3, `能量漂移 ${(E() - E0) / s.N}`);
  near(M.ljTemp(s), M.ljKinetic(s) / (s.N - 1), 1e-12);
});

test('第二章：Verlet 精确守恒影子能量、h = 2 是稳定极限、Euler 爆、RK4 慢慢漂', () => {
  const h = 0.1, v = M.integrate('verlet', 'harm', 1, 0, h, 2000);
  const sh0 = M.shadowHarm(1, 0, h);
  for (let i = 0; i < v.xs.length; i += 97) near(M.shadowHarm(v.xs[i], v.ps[i], h), sh0, 1e-12, '影子能量');
  assert.ok(Math.max(...v.E.map((e) => Math.abs(e - 0.5))) < 0.5 * h * h / 4 * 1.01, 'Verlet 能量误差 ≤ h²/8');
  near(M.verletOmega(0.1), Math.acos(1 - 0.005) / 0.1, 1e-14); assert.ok(Number.isNaN(M.verletOmega(2.01)));
  const bad = M.integrate('verlet', 'harm', 1, 0, 2.01, 3000); assert.ok(bad.xs.length < 3001 || Math.abs(bad.xs.at(-1)) > 100, 'h > 2 发散');
  const eu = M.integrate('euler', 'harm', 1, 0, h, 2000); assert.ok(eu.E.at(-1) > 1000, `Euler ${eu.E.at(-1)}`);
  const rk = M.integrate('rk4', 'harm', 1, 0, h, 2000); assert.ok(rk.E.at(-1) < 0.5 && rk.E.at(-1) > 0.4999, `RK4 ${rk.E.at(-1)}`);
});

test('第三章：恒温器——单振子 NH 不遍历，Langevin / NH 链 / CSVR 给出 ⟨x²⟩ = kT；Berendsen 压掉动能涨落', () => {
  const x2 = (method, opt, n = 60000) => {
    const s = M.thermoState('osc', 1, 7); let a = 0, c = 0;
    for (let k = 0; k < n / 10; k++) { M.thermoRun(s, method, 0.05, 10, opt); if (k > 200) { a += s.x[0] ** 2; c++; } }
    return a / c;
  };
  near(x2('langevin', { gamma: 1 }), 1, 0.15, 'Langevin');
  near(x2('nhc', { Q: 1, M: 3 }), 1, 0.2, 'NH 链');
  assert.ok(Math.abs(x2('nh', { Q: 1 }) - 1) > 0.1, '单振子 NH 不该给出正确的 ⟨x²⟩');
  const varK = (method) => {
    const s = M.thermoState('gas', 32, 5), K = [];
    for (let k = 0; k < 1500; k++) { M.thermoRun(s, method, 0.05, 4, { tau: 0.5 }); if (k > 300) K.push(M.kin(s.p)); }
    return M.variance(K);
  };
  assert.ok(varK('berendsen') < 0.5, 'Berendsen 的动能涨落被压掉'); near(varK('csvr'), 16, 6, 'CSVR：Var K = N/2');
  near(M.kinPdf(1, 2), Math.exp(-1), 1e-9); near(Math.exp(M.lnGamma(5)), 24, 1e-9);
});

test('第四章：LJ 的极小和截断，尾修正，Lorentz–Berthelot，丁烷二面角', () => {
  near(M.lj(2 ** (1 / 6)), -1, 1e-12); near(M.ljF(2 ** (1 / 6)), 0, 1e-12);
  near(M.ljCut(2.5, 2.5, 'shift'), 0, 1e-12); near(M.ljCut(2.4999999, 2.5, 'cut') - M.ljCut(2.4999999, 2.5, 'shift'), M.lj(2.5), 1e-9);
  near(M.ljCutF(2.5 - 1e-9, 2.5, 'sf'), 0, 1e-7);
  near(M.ljTail(0.8, 2.5), (8 / 3) * Math.PI * 0.8 * (1 / (3 * 2.5 ** 9) - 1 / 2.5 ** 3), 1e-12);
  const lb = M.lorentzBerthelot(3.4, 1, 2.6, 4); near(lb.sig, 3.0, 1e-12); near(lb.eps, 2, 1e-12);
  near(M.coulomb(0.1, 1, -1), -1389.35458, 1e-6);
  near(M.torsion(180), 0, 1e-9); assert.ok(M.torsion(60) > 2 && M.torsion(60) < 5, 'gauche 比 anti 高几 kJ/mol');
  const pop = M.torsionPopulations(298); assert.ok(pop.trans > 0.5 && pop.trans < 0.9, JSON.stringify(pop)); near(pop.trans + pop.gauche, 1, 1e-12);
});

test('第五章：谐振子的 ΔF = ½ ln(k₁/k₀)；BAR 稳，TI 梯形收敛', () => {
  near(M.harmDF(1, 4), Math.log(2), 1e-14);
  const r = M.rng(11), x0 = M.fepSample(1, 0, 4000, r), x1 = M.fepSample(4, 1, 4000, r);
  const w0 = x0.map((x) => M.dU(x, 1, 4, 1)), w1 = x1.map((x) => M.dU(x, 1, 4, 1));
  near(M.bar(w0, w1), Math.log(2), 0.05, 'BAR'); near(M.fepForward(w0), Math.log(2), 0.2, 'FEP 正向');
  near(M.tiTrapezoid(201, 1, 4, 1).dF, Math.log(2), 2e-4); assert.ok(M.tiTrapezoid(5, 1, 4, 1).dF - Math.log(2) > 0.05, '5 个窗口偏大');
  near(M.softcore(0, 1e-9), 4e-9 * (1 / 0.25 - 2), 1e-12, '软核在 r = 0 有限');
  // 例题
  near(0.5 * Math.log(4), 0.693, 1e-3);
});

test('第六章：WHAM 恢复双势阱的垒高（解析值 h）', () => {
  const run = M.umbrellaRun({ h: 4, k: 30, nWin: 13, lo: -1.6, hi: 1.6, n: 6000, dt: 5e-4, seed: 2 });
  const W = M.wham(run.centres, run.samples, run.k, -1.6, 1.6, 64);
  const at = (x) => W.F[W.x.reduce((b, v, i) => (Math.abs(v - x) < Math.abs(W.x[b] - x) ? i : b), 0)];
  const base = Math.min(at(-1), at(1)); near(at(0) - base, 4, 0.5, 'WHAM 垒高');
  // 例题：σ² = 1/(k − κ)
  near(Math.sqrt(1 / 14), 0.267, 1e-3);
});

test('第七章：回火元动力学的偏置收敛到 −(ΔT/(T+ΔT)) F，读出的垒高约等于 h', () => {
  const s = M.metadState(4); M.metadRun(s, 150000, { shape: 'dw', h: 5, w: 0.2, sigma: 0.15, stride: 100, wt: 4 });
  const { x: xs, F } = M.metadF(s, 4);
  const at = (x) => F[Math.round(((x - M.MG.lo) / (M.MG.hi - M.MG.lo)) * (M.MG.n - 1))];
  near(at(0) - Math.min(at(-1), at(1)), 5, 1.2, '元动力学垒高'); assert.equal(xs.length, M.MG.n);
  near(36 / (1 - 1 / 10), 40, 1e-12, '例题');
});

test('第八章：Jarzynski 等式和第二定律，二阶累积量，Crooks 的交点', () => {
  const dF = M.jarzDF(-1, 1.5, 3, 6);
  const W = M.jarzRun({ h: 3, kap: 6, l0: -1, l1: 1.5, tau: 5, n: 300, seed: 3 });
  assert.ok(M.mean(W) > dF, '⟨W⟩ ≥ ΔF'); near(M.jarzEstimate(W), dF, 0.35, 'Jarzynski');
  const Wr = M.jarzRun({ h: 3, kap: 6, l0: 1.5, l1: -1, tau: 5, n: 300, seed: 4 });
  near(M.bar(W, Wr.map((w) => -w)), dF, 0.2, '正反两边做 BAR');
  near(M.cumulantEstimate([10, 12, 14]), 12 - 2, 1e-12);
  near(12 - 9 / 2, 7.5, 1e-12, '例题');
});

test('第九章：马尔可夫模型——好的切分给出 Smoluchowski 方程的最慢时间', () => {
  const ex = M.msmExact(2, 3); assert.ok(ex.times[0] > 3 && ex.times[0] < 4.2 && ex.times[1] < 0.4, JSON.stringify(ex.times));
  near(ex.pi.reduce((s, v) => s + v, 0), 1, 1e-12);
  const tr = M.msmTraj({ h: 2, H: 3, T: 1500, seed: 5 });
  const lag = Math.round(0.5 / tr.dt);
  const good = M.msmEstimate(M.discretize(tr.x, 4, 0), 4, lag), bad = M.msmEstimate(M.discretize(tr.x, 4, 0.5), 4, lag);
  const tg = M.impliedTimescale(good.values[1], lag * tr.dt), tb = M.impliedTimescale(bad.values[1], lag * tr.dt);
  near(tg, ex.times[0], 1.2, '好的切分'); assert.ok(tb < tg, `切在阱底的切分偏短：${tb} vs ${tg}`);
  near(-10 / Math.log(0.94), 161.6, 0.1, '例题');
});

test('第十章：AR(1) 的分块平台等于解析误差，朴素误差小很多', () => {
  const tau = 20, n = 32768, x = M.ar1(n, tau, 9), exact = M.ar1Error(n, tau);
  const b = M.blocking(x), plateau = b.filter((r) => r.size >= 256 && r.n >= 16);
  assert.ok(b[0].se < exact / 4, '朴素误差太乐观');
  for (const r of plateau) near(r.se, exact, Math.max(0.35 * exact, 3 * r.err), `块 ${r.size}`);
  near(M.tauInt(x), 0.5 * (1 + Math.exp(-1 / tau)) / (1 - Math.exp(-1 / tau)), 6, 'τ_int');
  near(0.12 / Math.sqrt(10000 / 500), 0.0268, 1e-4, '例题');
});

test('生成的内容是最新的、十章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/md/md-${lang}.js 不是最新的：运行 node tools/md-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['basics', 'integrators', 'thermostats', 'forcefields', 'fep', 'umbrella', 'metad', 'jarzynski', 'msm', 'practice'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read('md/md-models.js') + '\n' + read('md/md-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_MD_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  assert.deepEqual([...Object.keys(DEMOS)].sort(), ['blocks', 'box', 'fep', 'integ', 'jarz', 'metad', 'msm', 'pair', 'thermo', 'ti', 'torsion', 'umbrella']);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 8, id); assert.ok(ch.points.length >= 5 && ch.math.length >= 4 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, 12, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 78); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 10); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /\['md', 'md\/index\.html', '分子动力学与自由能', 'Molecular Dynamics & Free Energy'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("md\/index\.html"/); assert.match(seo, /\["md\/", "0\.8", "monthly"\]/);
  assert.match(read('md/index.html'), /data-section="md"/);
});
