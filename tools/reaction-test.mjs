// node --test tools/reaction-test.mjs
// 反应动力学与过渡态（/reaction/）：演示的数学对照解析解和已知数值（Müller–Brown 的五个驻点、CI-NEB 落到鞍点、IRC 连着两个极小、
// Marcus 抛物线、Eyring 的 5.71 kJ/mol 一个数量级、Beyer–Swinehart 对照穷举、RRKM 高压极限等于谐振子 TST、Eckart 解析式对照数值解
// Schrödinger 方程、Wigner 极限、零点能同位素效应和 Swain–Schaad、能量跨度公式和精确稳态逐位一致、速率控制度的求和规则、火山），
// 章里例题的算术，生成的内容是最新的、八章中英齐全、十三个演示都登记了、54 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './reaction-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('reaction/rx-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_RXN_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const rel = (a, b, tol, msg = '') => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`reaction/rx-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_RXN)); };
const P = Object.fromEntries(M.MB_POINTS.map((p) => [p.id, p]));

test('第一章：Müller–Brown 的五个驻点，Newton 法从附近都能落回，Hessian 的指标对', () => {
  const want = { MA: [-0.558, 1.442, -146.70, 0], MB: [0.623, 0.028, -108.17, 0], MC: [-0.050, 0.467, -80.77, 0], S1: [-0.822, 0.624, -40.66, 1], S2: [0.212, 0.293, -72.25, 1] };
  for (const [id, [x, y, v, idx]] of Object.entries(want)) {
    const st = M.stationary(x + 0.03, y - 0.03);
    near(st.x, x, 2e-3, `${id} x`); near(st.y, y, 2e-3, `${id} y`); near(st.v, v, 0.02, `${id} V`);
    assert.equal(st.index, idx, `${id} 指标`); assert.ok(st.grad < 1e-6, `${id} 梯度`);
    near(P[id].v, v, 0.02, `MB_POINTS ${id}`);
  }
  const s1 = M.stationary(-0.82, 0.62); near(s1.x, -0.8220, 1e-4); near(s1.y, 0.6243, 1e-4); near(s1.v, -40.665, 1e-3);
  // 解析梯度对照有限差分
  const h = 1e-6, a = M.mbAll(0.1, 0.7);
  near(a.g[0], (M.mb(0.1 + h, 0.7) - M.mb(0.1 - h, 0.7)) / (2 * h), 1e-4); near(a.g[1], (M.mb(0.1, 0.7 + h) - M.mb(0.1, 0.7 - h)) / (2 * h), 1e-4);
  near(a.h[0][1], (M.mbAll(0.1, 0.7 + h).g[0] - M.mbAll(0.1, 0.7 - h).g[0]) / (2 * h), 1e-3);
});

test('第一章：两条抛物线的交点、Marcus 势垒、BEP 斜率', () => {
  near(M.marcusBarrier(100, 0), 25, 1e-12); near(M.marcusBarrier(100, -100), 0, 1e-12); near(M.marcusBarrier(100, -150), 6.25, 1e-12);
  near(M.crossing(100, 0), 0.5, 1e-12); near(M.crossing(100, -40), 0.3, 1e-12);
  for (const [lam, dg] of [[100, -20], [80, 30], [200, -250]]) {
    const x = M.crossing(lam, dg), [r, p] = M.parabolas(lam, dg, x); near(r, p, 1e-9); near(r, M.marcusBarrier(lam, dg), 1e-9);
    const h = 1e-5; near(M.leffler(lam, dg), (M.marcusBarrier(lam, dg + h) - M.marcusBarrier(lam, dg - h)) / (2 * h), 1e-6);
    near(M.leffler(lam, dg), x, 1e-12); // α 就是交点的位置
  }
});

test('第二章：CI-NEB 的最高像落到 S1，IRC 从 S1 连着 MA 和 MC', () => {
  const st = { img: M.nebInit([P.MA.x, P.MA.y], [P.MB.x, P.MB.y], 13) };
  M.nebRun(st, 3000, { k: 300 });
  const plain = M.nebForces(st.img, { k: 300 });
  M.nebRun(st, 4000, { k: 300, climb: true });
  const f = M.nebForces(st.img, { k: 300, climb: true }), top = st.img[f.top];
  near(top[0], -0.8220, 1e-3); near(top[1], 0.6243, 1e-3); near(f.E[f.top], -40.665, 1e-2);
  assert.ok(plain.E[plain.top] < f.E[f.top] - 1, '没有爬坡像时最高像低于鞍点');
  for (const ts of ['S1', 'S2']) {
    const path = M.irc(M.stationary(P[ts].x, P[ts].y)), ends = [path[0], path[path.length - 1]].map((p) => M.stationary(p.x, p.y)).map((s) => M.MB_POINTS.find((q) => Math.hypot(q.x - s.x, q.y - s.y) < 0.01)?.id).sort();
    assert.deepEqual(ends, ts === 'S1' ? ['MA', 'MC'] : ['MB', 'MC'], ts);
    for (let i = 1; i < path.length; i++) if (path[i].s > 0 && path[i - 1].s >= 0) assert.ok(path[i].v <= path[i - 1].v + 1e-9, `${ts} 一路下山`);
  }
});

test('第三章：Eyring 公式的数（25 °C 下 k_BT/h、一个数量级 5.71 kJ/mol、一秒和一小时的半衰期）和例题', () => {
  rel(M.kTh(298.15), 6.2124e12, 1e-4);
  near(M.barrierFor(1, 298.15), 73.02, 0.01);
  near(M.R * 298.15 * Math.log(10) / 1000, 5.708, 1e-3);
  near(M.barrierFor(Math.LN2, 298.15), 73.93, 0.01);
  near(M.barrierFor(Math.LN2 / 3600, 298.15), 94.23, 0.01);
  near(M.halfLife(M.eyring(73.93, 298.15)), 1, 0.01);
  rel(M.eyringHS(80, -20, 310), M.eyring(80 - (310 * -20) / 1000, 310), 1e-12);
  // 第三章例题：2.0e-4 和 1.6e-3 s⁻¹ 在 298.15、318.15 K
  const f = M.eyringFit([298.15, 318.15], [2.0e-4, 1.6e-3]);
  near(f.dH, 79.44, 0.02); near(f.dS, -49.3, 0.1); near(f.dH - (298.15 * f.dS) / 1000, 94.14, 0.02);
  near(M.arrheniusFit([298.15, 318.15], [2.0e-4, 1.6e-3]).Ea, 82.0, 0.1);
  // 无噪声的合成数据拟合回真值；有噪声时 ΔH‡ 和 ΔS‡ 的估计强烈正相关
  const d0 = M.fakeKinetics(85, -15, 290, 330, 6, 0, 3), f0 = M.eyringFit(d0.Ts, d0.ks); near(f0.dH, 85, 1e-6); near(f0.dS, -15, 1e-5);
  const d1 = M.fakeKinetics(85, -15, 290, 330, 6, 0.05, 3); assert.ok(M.eyringFit(d1.Ts, d1.ks).corr > 0.99);
  const ar = M.arrheniusOf(80, 0, 300); near(ar.Ea, 80 + (M.R * 300) / 1000, 1e-9);
});

test('第四章：Beyer–Swinehart 对照穷举，RRKM 的热平均等于谐振子 TST，下降曲线的两个极限', () => {
  const cum = M.cumsum(M.beyerSwinehart([500, 700, 1100], 5000, 1));
  assert.equal(cum[5000], 102); assert.equal(M.bruteCount([500, 700, 1100], 5000), 102);
  assert.equal(cum[2000], 13); assert.equal(M.bruteCount([500, 700, 1100], 2000), 13);
  for (const e of [0, 499, 500, 1199, 1200, 3333]) assert.equal(cum[e], M.bruteCount([500, 700, 1100], e), `E = ${e}`);
  const r = M.rrkm({ ...M.TOY, emax: 80000, grain: 5, smooth: 100 });
  for (const [T, tol] of [[1000, 0.05], [1500, 0.02]]) {
    const f = M.falloff(r, T, 1e30);
    rel(f.kinf, M.tstHarmonic(M.TOY, T), tol, `高压极限 ${T} K`);
    rel(f.k, f.kinf, 1e-6, `ω → ∞ 时 k → k∞ ${T} K`);
    const lo = M.falloff(r, T, 1e-6); rel(lo.k, lo.k0, 1e-3, `ω → 0 时 k → k₀[M] ${T} K`);
  }
  // k(E) 在阈能以下为零、以上单调上升；经典 RRK 在高能下趋于同一个量级
  const j0 = Math.round(M.TOY.E0 / r.grain); assert.equal(r.k[j0 - 2], 0);
  for (let j = j0 + 200; j < r.k.length; j += 400) assert.ok(r.k[j] > r.k[j - 200]);
  // 强碰撞比 Lindemann 宽：在 p½ 处 k/k∞ < 0.5
  const r10 = M.rrkm({ ...M.TOY, emax: 80000, grain: 10 }), hi = M.falloff(r10, 1000, 1e30), lo = M.falloff(r10, 1000, 1);
  const half = M.falloff(r10, 1000, hi.kinf / lo.k0); assert.ok(half.k / hi.kinf < 0.45, `${half.k / hi.kinf}`);
  near(M.lindemann(2, 2), 1, 1e-12);
});

test('第五章：Eckart 解析透射系数对照数值解 Schrödinger 方程，κ 的高温极限是 Wigner', () => {
  for (const [V1, V2] of [[3, 3], [2.2, 4.5], [6, 2]]) {
    const ek = M.eckart(V1, V2);
    for (const e of [0.6, 0.9, 1, 1.2]) {
      const E = e * V1; if (E <= Math.max(0, ek.A)) continue;
      near(ek.P(E), M.transmitNumeric(ek.V, E, ek.A, -40, 40, 40000), 2e-6, `V1=${V1} V2=${V2} E=${E}`);
    }
    // 势垒顶的曲率是 −1（ħω‡ 为单位）
    const h = 1e-4, xt = ek.top, d2 = (ek.V(xt + h) - 2 * ek.V(xt) + ek.V(xt - h)) / (h * h);
    near(d2, -1, 1e-4); near(ek.V(xt), V1, 1e-6);
  }
  assert.ok(Number.isFinite(M.eckart(200, 300).P(150)), '大势垒不溢出');
  // 高温：κ − 1 → u²/24
  const u = 0.3, w = M.kappaWigner(u) - 1; near(w, 0.00375, 1e-12);
  for (const [V, want] of [[20, 0.00438], [60, 0.00397], [200, 0.00382]]) near(M.kappaEckart(V, V, u) - 1, want, 2e-5, `V=${V}`);
  near(M.kappaBell(0.3), 0.15 / Math.sin(0.15), 1e-12);
  assert.ok(!Number.isFinite(M.kappaBell(7)) || M.kappaBell(7) <= 0, 'u ≥ 2π 时 Bell 发散');
  near(M.uOf(1500, 300), (M.HCK * 1500) / 300, 1e-12);
});

test('第六章：零点能同位素效应、隧穿、Swain–Schaad 指数', () => {
  const d = M.kie({ nu: 2900, T: 298.15 });
  near(d.nuI, 2129.27, 0.05); near(d.dzpe, 385.37, 0.05); near(d.kie, 6.42, 0.01);
  near(M.kie({ nu: 2900, T: 298.15, tunnel: true }).kie, 8.78, 0.02);
  near(M.kie({ nu: 2900, T: 298.15, iso: 'T' }).kie, 14.17, 0.02);
  near(M.swainSchaad('C'), 1.4257, 1e-4); near(M.swainSchaad('O'), 1.4293, 1e-4);
  // 只有零点能时 Swain–Schaad 指数和频率、温度无关
  for (const [nu, T] of [[2900, 298.15], [3400, 250], [2200, 500]]) near(Math.log(M.kie({ nu, T, iso: 'T' }).kie) / Math.log(M.kie({ nu, T }).kie), M.swainSchaad('C'), 1e-9);
  // 过渡态里残留一部分伸缩振动，同位素效应变小；温度越高越小
  assert.ok(M.kie({ nu: 2900, T: 298.15, tsFrac: 0.3 }).kie < d.kie);
  assert.ok(M.kie({ nu: 2900, T: 400 }).kie < d.kie);
  near(M.isoFreq(2900, 'C', 'H'), 2900, 1e-9);
});

test('第七、八章：能量跨度公式和精确稳态逐位一致，速率控制度的求和规则，例题的数', () => {
  const T0 = 298.15;
  const ex = M.energeticSpan([0, -30, -10], [50, 25, 45], -40, T0);
  near(ex.dE, 75, 1e-9); assert.equal(ex.tdts, 2); assert.equal(ex.tdi, 1); near(ex.tof, 0.45034, 5e-5);
  for (const [I, T, g] of [[[0, -30, -10], [50, 25, 45], -40], [[0, -20, -5], [60, 70, 45], -50], [[0, 5, -30], [70, 40, 20], -20], [[0, -30, -10], [50, 25, 45], -2], [[0, 10, 20], [30, 40, 50], -15]]) {
    const a = M.energeticSpan(I, T, g, T0), b = M.cycleTOF(I, T, g, T0);
    rel(a.tof, b.tof, 1e-10, `${I} ${T} ${g}`);
    const X = M.tofControl(I, T, g, T0);
    near(X.XT.reduce((s, v) => s + v, 0), 1, 1e-4); near(X.XI.reduce((s, v) => s + v, 0), -1, 1e-4);
  }
  const b = M.energeticSpan([0, -20, -5], [60, 70, 45], -50, T0); near(b.dE, 90, 1e-9); rel(b.tof, 1.0612e-3, 1e-3);
  const c = M.energeticSpan([0, 5, -30], [70, 40, 20], -20, T0); near(c.dE, 80, 1e-9); assert.ok(c.tdts < c.tdi);
  // 表面微观动力学：例题、求和规则
  const p = { GA: -30, GB: -40, T1: 5, T2: 60, T3: 10, dGr: -20, pA: 1, pB: 0.01, temp: 500 }, s = M.surface(p);
  rel(s.tof, 4.121e3, 1e-3); near(s.theta.A, 0.9983, 1e-4); near(s.theta.free + s.theta.A + s.theta.B, 1, 1e-12);
  const x = M.surfaceDRC(p); near(x.T1 + x.T2 + x.T3, 1, 1e-4); near(x.GA + x.GB + x.Gfree, -1, 1e-4); near(x.T2, 1, 2e-3); near(x.GA, -0.998, 2e-3);
  const s2 = M.surface({ ...p, GA: -10 }); rel(s2.tof, 4.193e5, 1e-3); near(s2.theta.A, 0.827, 1e-3);
  // 火山：中间高、两头低
  const es = Array.from({ length: 181 }, (_, i) => -140 + i), lt = es.map((e) => Math.log10(M.volcanoPoint(e).tof));
  const bi = lt.indexOf(Math.max(...lt)); near(es[bi], -35, 2); near(lt[bi], 6.75, 0.05);
  near(lt[0], -0.57, 0.05); near(lt[lt.length - 1], 2.57, 0.05); assert.ok(lt[bi] - lt[0] > 6 && lt[bi] - lt[lt.length - 1] > 4);
});

test('生成的内容是最新的、八章中英齐全、十三个演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/reaction/rx-${lang}.js 不是最新的：运行 node tools/reaction-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['pes', 'paths', 'tst', 'rrkm', 'tunnel', 'kie', 'micro', 'span'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read('reaction/rx-models.js') + '\n' + read('reaction/rx-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_RXN_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  const want = ['eckart', 'eyring', 'falloff', 'hammond', 'irc', 'kie', 'micro', 'neb', 'pes', 'plot', 'rrkm', 'span', 'volcano'];
  assert.deepEqual([...Object.keys(DEMOS)].sort(), want);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 6, id); assert.ok(ch.points.length >= 5 && ch.math.length >= 4 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, 13, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 54); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 10); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
  // 演示的英文部分也不能漏中文：用 L 取英文那一半，把定义里的文字串起来查
  const E = {}; s.window.MOLASTRIA_RXN_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a, b) => b : () => '') }), E);
  for (const [id, d] of Object.entries(E)) {
    const txt = JSON.stringify([d.title, d.intro, d.note, d.figs?.map((f) => f[1]), d.ctl?.map((c) => c[1]), d.sel?.map((c) => [c[1], c[2].map((o) => o[1])]), d.chk?.map((c) => c[1]), d.btn?.map((c) => c[0]), d.act?.map((c) => c[0])]);
    assert.doesNotMatch(txt, /[㐀-鿿]/, `演示 ${id} 的英文里有中文`);
  }
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /\['reaction', 'reaction\/index\.html', '反应动力学', 'Reaction Kinetics'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("reaction\/index\.html"/); assert.match(seo, /\["reaction\/", "0\.8", "monthly"\]/);
  assert.match(read('reaction/index.html'), /data-section="reaction"/);
});
