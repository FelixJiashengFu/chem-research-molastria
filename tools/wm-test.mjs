// node --test tools/wm-test.mjs
// 世界模型（/world-models/）：十三个演示的数学对照解析结果或已知的行为（单摆模型一步准、出了训练范围多步漂，物理特征能外推；
// PCA 的重建误差等于丢掉的本征值之和；卡尔曼增益收敛到 Riccati 的稳态、归一化误差的方差约为 1；迷宫最短路 14 步、Dyna 省回合；
// 真实方程的 MPC 能甩上去、只见过下垂附近的模型不能；像素 R² 对照 φ²/(1 + 7σ²)、没有方差项会塌缩；潜在动作的纯度；
// DMD 找回精确的本征值；力匹配的势在高温下塌缩、加先验就稳；SINDy 找回洛伦兹方程；传播器对照 Smoluchowski 的精确首次通过时间；
// 连串反应的 t_max 和最大产率、机理模型比随机试快；集成的分歧和误差相关），章里例题的算术，
// 生成的内容是最新的、十一章中英齐全、演示都登记了、文献都被引用、联系表和总览表完整，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './wm-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('world-models/wm-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_WM_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`world-models/wm-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_WM)); };
const firstOver = (truth, pred, tol) => { for (let i = 0; i < truth.length; i++) if (!(Math.abs(pred[i]?.[0] - truth[i][0]) < tol)) return i; return truth.length; };

test('第一章：单摆的世界模型一步很准，出了训练范围多步漂；物理特征能外推', () => {
  const box = 1.2, data = M.pendData(400, box, 1);
  const poly3 = M.pendFit(data, 'poly', 3), trig = M.pendFit(data, 'trig', 0);
  assert.ok(M.oneStepRMSE(poly3, M.pendData(200, box, 77)) < 1e-3, '训练范围里一步误差很小');
  const truth = M.rollout((s, u) => M.pendStep(s, u), [2.4, 0], 200);
  const pPoly = M.rollout((s, u) => M.pendModelStep(poly3, s, u), [2.4, 0], 200), pTrig = M.rollout((s, u) => M.pendModelStep(trig, s, u), [2.4, 0], 200);
  assert.ok(firstOver(truth, pPoly, 0.1) < 60, `多项式从训练范围外出发很快就偏离（${firstOver(truth, pPoly, 0.1)} 步）`);
  assert.equal(firstOver(truth, pTrig, 0.1), truth.length, '物理特征的模型外推 200 步仍然准');
  const inside = M.rollout((s, u) => M.pendModelStep(poly3, s, u), [1, 0], 200), tIn = M.rollout((s, u) => M.pendStep(s, u), [1, 0], 200);
  assert.ok(firstOver(tIn, inside, 0.1) > 150, '起点在训练范围里时能推很久');
  near(M.pendStep([0, 0], 0)[0], 0, 0); // 下垂静止是平衡点
});

test('第二章：PCA 的重建误差等于丢掉的本征值之和；两个自由度要远多于两个线性分量', () => {
  const set = M.blobSet(400, 5), X = set.map((q) => q.x), P = M.pca(X);
  for (const k of [2, 5, 10]) {
    const err = X.reduce((s, x) => { const xr = M.pcaDecode(P, M.pcaEncode(P, x, k)); return s + x.reduce((a, v, i) => a + (v - xr[i]) ** 2, 0); }, 0) / (X.length - 1);
    near(err, P.values.slice(k).reduce((a, v) => a + v, 0), 1e-8 * P.total, `k = ${k}`);
  }
  assert.ok(M.explained(P, 2) < 0.8, `前两个分量 ${M.explained(P, 2)}`);
  const need = [...Array(16).keys()].map((k) => k + 1).find((k) => M.explained(P, k) >= 0.99);
  assert.ok(need >= 8, `99 % 要 ${need} 个分量`);
  const P1 = M.pca(M.blobSet(400, 5, 0.06).map((q) => q.x)); assert.ok(M.explained(P1, 6) > M.explained(P, 6), '只有位置时更容易压');
});

test('第二章：卡尔曼增益收敛到 Riccati 的稳态，滤波比单个观测准，归一化误差的方差约为 1', () => {
  const run = M.kalmanRun({ seed: 3 });
  near(run[139].K, M.kalmanSteady({}), 1e-4, '稳态增益');
  const rms = (f) => Math.sqrt(M.mean(run.slice(20, 140).map(f)));
  assert.ok(rms((o) => (o.m[0] - o.x[0]) ** 2) < 0.6 * rms((o) => (o.y - o.x[0]) ** 2), '滤波比观测准');
  assert.ok(run[199].sd > 3 * run[139].sd, '观测停了以后不确定度张开');
  const z = []; for (let s = 1; s <= 40; s++) { const r = M.kalmanRun({ seed: s }); for (let k = 30; k < 140; k += 10) z.push((r[k].m[0] - r[k].x[0]) / r[k].sd); }
  const v = M.variance(z); assert.ok(v > 0.75 && v < 1.25, `归一化误差的方差 ${v}`);
  // 例题：随机游走 q = r 的稳态增益 = 黄金分割的倒数
  const p = 0.5 * (1 + Math.sqrt(5)); near(p / (p + 1), (Math.sqrt(5) - 1) / 2, 1e-12);
});

test('第三章：迷宫最短路 14 步；Dyna 想得越多，需要的真实回合越少；例题 0.95¹³', () => {
  assert.equal(M.mazeShortest(), 14);
  const a0 = M.dynaAverage(0, 30, 10), a50 = M.dynaAverage(50, 30, 10);
  assert.ok(M.mean(a50.slice(2, 5)) < 30, `n = 50 第 3–5 回合 ${M.mean(a50.slice(2, 5))}`);
  assert.ok(M.mean(a0.slice(2, 5)) > 100, `n = 0 第 3–5 回合 ${M.mean(a0.slice(2, 5))}`);
  const one = M.dynaQ({ n: 50, episodes: 30, seed: 1 }), path = M.greedyPath(one.Q), end = path.at(-1);
  assert.deepEqual(end, M.MAZE.goal); assert.ok(path.length - 1 <= 16, `贪心路径 ${path.length - 1} 步`);
  near(0.95 ** 13, 0.5133, 1e-4);
});

test('第四章：真实方程的 MPC 能甩上去；只见过下垂附近的模型不能；物理特征可以', () => {
  const up = (step) => M.upTime(M.mpcRun(step, { steps: 200 }).traj);
  const tTrue = up((s, u) => M.pendStep(s, u)); assert.ok(tTrue < 20, `真实方程 ${tTrue}`);
  const near1 = M.pendFit(M.pendData(800, 1.0, 1), 'poly', 3); assert.ok(Number.isNaN(up((s, u) => M.pendModelStep(near1, s, u))), '只见过下垂附近的模型');
  const trig = M.pendFit(M.pendData(800, Math.PI, 1), 'trig', 0); assert.ok(up((s, u) => M.pendModelStep(trig, s, u)) < 25, '物理特征');
  // 例题：|u| ≤ 0.5 只能静止托到 30°；甩起要注入 ΔE = 2
  near(Math.asin(0.5), Math.PI / 6, 1e-12); near((0 - Math.cos(Math.PI)) - (0 - Math.cos(0)), 2, 1e-12);
});

test('第五章：像素 R² ≈ φ²/(1 + 7σ²)；没有方差项会塌缩，加上就找到慢变量，和 SFA 一致', () => {
  const J = M.jepaData({ noise: 1, seed: 1 });
  near(M.pixelR2(J.X), 0.98 ** 2 / 8, 0.04, '像素 R²');
  const t0 = M.jepaTrain(J.X, { reg: 0 }), t1 = M.jepaTrain(J.X, { reg: 1 });
  assert.ok(t0.hist.at(-1).sd < 0.01, `无方差项 sd ${t0.hist.at(-1).sd}`);
  assert.ok(t1.hist.at(-1).sd > 0.9 && Math.abs(M.corr(t1.z, J.s)) > 0.95, '方差项');
  const w = M.sfa(J.X); assert.ok(Math.abs(M.corr(J.X.map((x) => M.dot(w, x)), J.s)) > 0.99, 'SFA');
});

test('第六章：潜在动作——干净视频纯度接近 1，噪声大了下降，码不够时有上限', () => {
  const purity = (noise, K, seed = 1) => { const V = M.laVideo({ noise, seed }); const F = V.frames.slice(1).map((f, i) => M.laFeature(V.frames[i], f)); return { p: M.laPurity(M.kmeans(F, K, seed).lab, V.acts, K).purity, V }; };
  const clean = purity(0.05, 5); assert.ok(clean.p > 0.95, `干净 ${clean.p}`);
  assert.ok(purity(0.8, 5).p < 0.6, '噪声大');
  const three = purity(0.05, 3), cnt = [0, 0, 0, 0, 0]; three.V.acts.forEach((a) => cnt[a.moved ? a.a : 4]++);
  const cap = cnt.sort((a, b) => b - a).slice(0, 3).reduce((a, b) => a + b, 0) / three.V.acts.length;
  assert.ok(three.p <= cap + 1e-12, `K = 3 的纯度 ${three.p} 不超过上限 ${cap}`);
});

test('第七章：DMD 在秩够、没有噪声时找回精确的本征值；例题的半衰期', () => {
  const A = M.advdiff({});
  assert.ok(M.eigMatchError(M.dmd(A.snaps, 6, A.dt).omega, A.exact) < 1e-8, 'r = 6');
  assert.ok(M.eigMatchError(M.dmd(A.snaps, 4, A.dt).omega, A.exact) > 1e-3, 'r = 4 不够'); assert.ok(M.eigMatchError(M.dmd(A.snaps, 2, A.dt).omega, A.exact) > 0.1, 'r = 2');
  const An = M.advdiff({ noise: 0.05 }); assert.ok(M.eigMatchError(M.dmd(An.snaps, 6, An.dt).omega, An.exact) > 1e-3, '噪声');
  for (const z of A.exact) near(z[0], -0.02 * Math.round(Math.abs(z[1])) ** 2, 1e-12);
  near(Math.log(2) / 0.18, 3.851, 1e-3);
});

test('第七章：力匹配的对势——训练温度下稳定，热了没有排斥会塌缩，加物理先验就稳（演示的预设）', () => {
  const data = M.pfTrainData({ T: 0.1, n: 60, seed: 1 });
  const pair = (m) => ({ u: (r) => M.learnedU(m, r), d: (r) => M.learnedDU(m, r) });
  const bare = M.pfFit(data, false), prior = M.pfFit(data, true);
  assert.ok(bare.rmse < 0.05 && prior.rmse < 0.05, `力的拟合 ${bare.rmse} ${prior.rmse}`);
  assert.ok(!M.pfRun(pair(bare), { T: 0.3, seed: 8 }).collapsed, '训练温度附近稳定');
  assert.ok(M.pfRun(pair(bare), { T: 6, seed: 8 }).collapsed, '热了塌缩');
  assert.ok(!M.pfRun(pair(prior), { T: 6, seed: 8 }).collapsed, '加先验不塌缩');
  assert.ok(!M.pfRun(M.TRUE_PAIR, { T: 6, seed: 8 }).collapsed, '真实的势不塌缩');
  // 力只约束斜率：训练数据覆盖的距离上学到的力和真实的力一致
  for (const r of [1.05, 1.12, 1.3]) near(M.learnedDU(bare, r), M.dLJ(r), 0.5, `r = ${r}`);
});

test('第八章：SINDy 在干净数据上找回洛伦兹方程；集合的离散度按混沌增长；例题', () => {
  const s = M.sindy({ noise: 0 }), flat = s.Xi.flat(), truth = M.LZ_TRUE.flat();
  assert.equal(flat.filter((v) => v !== 0).length, 7);
  assert.ok(Math.max(...flat.map((v, i) => Math.abs(v - truth[i]))) < 1e-2, '系数');
  const ens = M.ensembleForecast(M.lorenzF, [-8, 7, 27], { n: 1500, eps: 0.01 });
  const spread = (i) => Math.sqrt(M.variance(ens.map((e) => e[i][0])));
  assert.ok(spread(100) < 0.2 && spread(1499) > 3, `离散度 ${spread(100)} → ${spread(1499)}`);
  near(Math.log(100) / 0.906, 5.083, 1e-3); near(Math.exp(5 * 0.906), 92.8, 0.2);
});

test('第九章：精确的首次通过时间（独立的数值积分）；小 τ 的传播器对，大 τ 的错；Kramers 低估', () => {
  const h = 2.5, U = (x) => h * (x * x - 1) ** 2, n = 20000, a = -6, dz = (1 - a) / n;
  let inner = 0, T = 0; // 梯形法：T = ∫_{-1}^{1} e^{U(y)} ∫_{-∞}^{y} e^{-U(z)} dz dy
  for (let i = 0; i <= n; i++) { const y = a + i * dz, prev = inner; inner += (i ? 0.5 * (Math.exp(-U(y)) + Math.exp(-U(y - dz))) * dz : 0); if (y >= -1) T += 0.5 * (Math.exp(U(y)) * inner + Math.exp(U(y - dz)) * prev) * dz * (y - dz >= -1 ? 1 : 0); }
  near(M.mfptExact(h), T, 0.02, 'MFPT');
  const edges = M.lin(-2, 2, 41), B = M.boltzHist(h, edges);
  const run = (tau) => { const m = M.propFit(M.propData({ h, tau })); const xs = M.propRun(m, -1, Math.round(4000 / tau), M.rng(7)); return { L1: M.l1(M.hist(xs, edges), B), t: M.mfptFromTraj(xs, tau).t }; };
  const small = run(0.05); assert.ok(small.L1 < 0.15 && Math.abs(small.t / M.mfptExact(h) - 1) < 0.25, `τ = 0.05 ${JSON.stringify(small)}`);
  const big = run(2); assert.ok(big.L1 > 0.5 || big.t > 1.8 * M.mfptExact(h), `τ = 2 ${JSON.stringify(big)}`);
  const k = (Math.sqrt(8 * h * 4 * h) / (2 * Math.PI)) * Math.exp(-h); near(1 / k, 5.41, 0.01); assert.ok(1 / k < M.mfptExact(h));
});

test('第十章：连串反应的 t_max 和最大产率；最优在时间上限；机理模型比随机试快', () => {
  const k1 = 0.05, k2 = 0.012, tm = Math.log(k2 / k1) / (k2 - k1);
  near(tm, 37.55, 0.01); near(M.yieldB(350, tm), (k1 / k2) ** (k2 / (k2 - k1)), 1e-9); near(M.yieldB(350, tm), 0.637, 1e-3);
  near(M.rxBest.u[1], 1, 1e-12, '最优在时间的上限'); assert.ok(M.rxBest.y > 0.72 && M.rxBest.y < 0.75);
  const best = (st) => M.mean([1, 2, 3, 4, 5].map((seed) => M.rxCampaign(st, { n: 10, seed }).bestSoFar[9]));
  const mech = best('mech'), rnd = best('random');
  assert.ok(mech > 0.95 * M.rxBest.y && mech > rnd + 0.05, `机理 ${mech}，随机 ${rnd}`);
  const a = M.rxCampaign('mech', { n: 4, seed: 2 }), b = M.rxCampaign('gp', { n: 4, seed: 2 }), c = M.rxCampaign('random', { n: 4, seed: 2 });
  assert.deepEqual(a.X.slice(0, 3), b.X.slice(0, 3)); assert.deepEqual(a.X.slice(0, 3), c.X.slice(0, 3));
});

test('第十一章：集成的分歧在数据外变大、和真实误差高度相关；例题的全方差', () => {
  const E = M.ensFit({});
  const st = M.lin(-3, 3, 61).map((x) => M.ensStats(E, x)), inside = M.lin(-1, 1, 21).map((x) => M.ensStats(E, x)), out = M.lin(1.5, 3, 16).map((x) => M.ensStats(E, x));
  assert.ok(M.corr(st.map((q) => q.sd), st.map((q) => q.err)) > 0.8);
  assert.ok(M.mean(out.map((q) => q.sd)) > 10 * M.mean(inside.map((q) => q.sd)));
  const f = [1.0, 1.2, 0.8, 1.1, 0.9], s2 = M.variance(f); near(s2, 0.025, 1e-12); near(Math.sqrt(s2 + 0.0025), 0.1658, 1e-4);
  // 第一章例题：误差界
  near(1e-4 * (1.05 ** 100 - 1) / 0.05, 0.261, 1e-3);
});

test('生成的内容是最新的、十一章中英齐全、演示都登记了、文献都被引用、两张表完整', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/world-models/wm-${lang}.js 不是最新的：运行 node tools/wm-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['what', 'latent', 'dream', 'planning', 'jepa', 'video', 'physics', 'earth', 'molecular', 'lab', 'limits'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read('world-models/wm-models.js') + '\n' + read('world-models/wm-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_WM_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  assert.deepEqual([...Object.keys(DEMOS)].sort(), ['dmd', 'dyna', 'ens', 'jepa', 'kalman', 'lam', 'loop', 'lorenz', 'mpc', 'pairfit', 'pca', 'prop', 'rxopt']);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 8, id); assert.ok(ch.points.length >= 5 && ch.math.length >= 4 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, 13, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 80); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 10); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    assert.ok(C.index.bridge.rows.length >= 12 && C.index.bridge.head.length === 3, '联系表');
    const fams = Object.keys(C.index.families); assert.deepEqual(fams.sort(), ['agent', 'earth', 'jepa', 'lab', 'mol', 'sim', 'video']);
    assert.ok(C.index.catalog.length >= 60, `总览 ${C.index.catalog.length} 个`);
    for (const m of C.index.catalog) { assert.ok(fams.includes(m.fam) && m.learns && m.chem, m.name); assert.ok(m.src || /^https:\/\//.test(m.url), `${m.name} 没有出处`); if (m.url) assert.match(m.urlDate, /^\d{4}-\d{2}-\d{2}$/); }
    for (const f of fams) assert.ok(C.index.catalog.some((m) => m.fam === f), `类别 ${f} 是空的`);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
    // 普通引号里写 TeX 时反斜杠会被 JS 吃掉（'\mid' 变成 mid），KaTeX 就把命令名当成一串单个字母
    for (const w of ['mid', 'frac', 'sum', 'cdot', 'nabla', 'partial', 'text', 'mathbf', 'mathcal', 'quad', 'alpha', 'theta', 'sigma', 'lambda', 'omega', 'epsilon', 'approx', 'times', 'infty', 'sqrt', 'operatorname', 'langle', 'rangle', 'big', 'left', 'right', 'hat', 'tilde', 'exp', 'log', 'min', 'max'])
      assert.ok(!t.includes([...w].map((c) => `<mi>${c}</mi>`).join('')), `公式里有拆成字母的 \\${w}：源文件里少了反斜杠（用 String.raw 或写成 \\\\${w}）`);
  }
  // 只有博客的三个：Sora、Genie 2、Genie 3
  assert.deepEqual(zh.index.catalog.filter((m) => m.url).map((m) => m.name).sort(), ['Genie 2', 'Genie 3', 'Sora']);
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO、站点地图和最近更新接上了', () => {
  assert.match(read('shared-nav.js'), /\['world', 'world-models\/index\.html', '世界模型', 'World Models'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("world-models\/index\.html"/); assert.match(seo, /\["world-models\/", "0\.8", "monthly"\]/);
  assert.match(read('world-models/index.html'), /data-section="world"/);
  assert.match(read('updates/updates-data.js'), /id: 'world-models'/);
});
