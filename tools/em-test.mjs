// node --test tools/em-test.mjs
// 电磁学与介电（/em/）：演示的数学对照解析结果和教科书数值（高斯定律、方盒的级数解、水和 CO₂ 的多极矩、Onsager 和 Kirkwood g、
// Born 常数、COSMO 的导体极限对照 Kirkwood 级数、水的 Debye 时间、Kramers–Kronig、亥姆霍兹线圈、Brillouin 极限、Weiss 临界行为、
// Stoner–Wohlfarth 星形线、偶极辐射场线、Drude 振子的 3/4、NaCl 的 Madelung 常数），章里例题的算术，
// 生成的内容是最新的、十二章中英齐全、十五个演示都登记了、55 篇文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './em-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const DIR = 'em/';
const sandbox = { window: {} };
vm.runInNewContext(read(DIR + 'em-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_EM_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const rel = (a, b, tol, msg = '') => assert.ok(Math.abs(a / b - 1) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`${DIR}em-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_EM)); };

test('第一章：高斯定律（通量只数里面的电荷）；场线顺着 E 走', () => {
  const ch = [{ x: 0, y: 0, q: 1 }, { x: 1, y: 0, q: -2 }, { x: 0.3, y: 0.8, q: 0.5 }];
  near(M.fluxSphere(ch, 0, 0, 0, 0.6, 80) / (4 * Math.PI), 1, 2e-4);
  near(M.fluxSphere(ch, 0, 0, 0, 5, 80) / (4 * Math.PI), -0.5, 2e-4);
  const [Ex, Ey] = M.field3([{ x: 0, y: 0, q: 2 }], 2, 0); near(Ex, 0.5, 1e-12); near(Ey, 0, 1e-12);
  near(M.potential3([{ x: 0, y: 0, q: 1 }, { x: 2, y: 0, q: -1 }], 1, 0), 0, 1e-12);
  // 例题：原子单位的场 5.14×10¹¹ V/m，对应激光强度 ½cε₀E² ≈ 3.5×10¹⁶ W/cm²
  const Eau = M.C.Eh / (M.C.e * M.C.a0); rel(Eau, 5.142e11, 1e-3); rel((0.5 * M.C.c * M.C.eps0 * Eau ** 2) / 1e4, 3.51e16, 0.01);
});

test('第二章：方盒的级数解、SOR 收敛到它，最优 ω 让遍数 ∝ n；Debye 长度例题', () => {
  near(M.boxAnalytic(0.5, 0.5), 0.25, 1e-9); // 一边 V = 1、三边接地：中心是 1/4（叠加四个方向）
  const st = M.laplaceInit(41), w = M.sorOmega(41); let d; for (let i = 0; i < 400; i++) d = M.laplaceSweep(st, w);
  near(st.V[20][20], 0.25, 1e-3); assert.ok(d < 1e-10);
  const j = M.laplaceInit(41); for (let i = 0; i < 400; i++) M.laplaceSweep(j, 1, true);
  assert.ok(Math.abs(j.V[20][20] - 0.25) > 0.01, 'Jacobi 400 遍还远没收敛');
  // Debye 长度：25 °C 水里 1:1 电解质 κ⁻¹ = 0.304 nm / √c
  const kinv = (c) => Math.sqrt((78.4 * M.C.eps0 * M.C.kB * 298.15) / (2 * M.C.NA * c * 1000 * M.C.e ** 2)) * 1e9;
  near(kinv(0.1), 0.96, 0.01); near(kinv(0.001), 9.6, 0.1); near(kinv(0.15), 0.79, 0.01);
});

test('第三章：水（TIP3P）偶极 2.35 D、CO₂ 四极 −4.1 B；多极展开逐阶逼近精确势', () => {
  const w = M.moments(M.MOLECULES.water); near(w.muD, 2.347, 2e-3);
  near(M.moments(M.MOLECULES.co2).Th[2][2] * w.eA2toB, -4.13, 0.01);
  const P = [3, 1, 4], ex = M.exactV(M.MOLECULES.water, P);
  const err = [1, 2, 3].map((L) => Math.abs(M.multipoleV(M.MOLECULES.water, P, L) - ex)); assert.ok(err[0] > err[1] && err[1] > err[2]);
  near(M.multipoleV(M.MOLECULES.water, P, 0), 0, 1e-12); // 中性分子没有单极
  near(M.legendre(2, 0.5), -0.125, 1e-12); near(M.legendre(3, 1), 1, 1e-12);
  // 例题：两个水分子相距 3.0 Å、偶极共线的能量 −2μ²/(4πε₀r³)
  const U = (-2 * (1.855 * M.C.debye) ** 2 * M.C.coul) / (3.0e-10) ** 3 * M.C.NA / 1000; near(U, -15.3, 0.5);
});

test('第四章：Debye 的转向极化、Clausius–Mossotti、Onsager 和 Kirkwood g（水 28.7 → g = 2.79）', () => {
  near(M.orientVol(1.855, 373), 22.27, 0.02);
  const W = M.LIQUIDS.water, n = M.liquidDensity(W);
  near(M.onsager(n, W.mu, W.T, W.n ** 2), 28.69, 0.02); near(M.kirkwoodG(n, W.mu, W.T, W.n ** 2, W.eps), 2.79, 0.01);
  for (const k in M.LIQUIDS) { const L = M.LIQUIDS[k], m = M.liquidDensity(L), e = M.onsager(m, L.mu, L.T, L.n ** 2); assert.ok(e > L.n ** 2 && Number.isFinite(e), k); }
  // Onsager 的解代回方程
  const e = M.onsager(n, W.mu, W.T, W.n ** 2), n2 = W.n ** 2; near(((e - n2) * (2 * e + n2)) / (e * (n2 + 2) ** 2), M.onsagerRHS(n, W.mu, W.T), 1e-9);
  assert.equal(M.clausius(M.liquidDensity(W), 1.45 + M.orientVol(1.855, 298.15)), Infinity); // 极化灾难
  // 例题：100 °C、1 atm 的水蒸气 ε_r ≈ 1.006
  const x = M.gasDensity(373.15) * ((4 * Math.PI) / 3) * (1.45 + M.orientVol(1.855, 373.15)) * 1e-30; near((1 + 2 * x) / (1 - x), 1.006, 0.0005);
});

test('第五章：Born 常数 694.7 kJ·Å/mol；COSMO 的导体极限、低介电常数时 x 的作用都对照 Kirkwood 级数', () => {
  near(M.C.bornKJ, 694.68, 0.01); near(M.bornKJ(1, 0.95, 78.4), -721.9, 0.1);
  near(M.kirkwood(0, 1e12), -0.5, 1e-9); near(M.kirkwood(0.5, 1e12), -0.5 / (1 - 0.25) , 1e-9); // 导体：镜像电荷
  const c = M.cosmo(0.5, 1e12, 300); near(c.W, -0.6667, 0.003);
  const k2 = M.kirkwood(0.5, 2), a = M.cosmo(0.5, 2, 400, 0).W, b = M.cosmo(0.5, 2, 400, 0.5).W;
  assert.ok(Math.abs(a - k2) < 0.03 && Math.abs(b - k2) < 0.06);
  for (const [, z, r, g] of M.IONS) { const born = M.bornKJ(z, r, 78.4); assert.ok(born < g, '裸 Pauling 半径的 Born 能高估了'); }
});

test('第六章：水的 ε_s（Malmberg–Maryott）和 Debye 时间；2.45 GHz 的穿透深度；Kramers–Kronig 自洽', () => {
  near(M.waterEpsS(25), 78.30, 0.01); near(M.waterEpsS(0), 87.74, 1e-9);
  near(M.waterTau(25), 8.27e-12, 1e-16); near(M.waterTau(0) * 1e12, 17.8, 0.1);
  near(1 / (2 * Math.PI * M.waterTau(25)) / 1e9, 19.2, 0.1);
  const e = M.hn(2 * Math.PI * 2.45e9, M.waterEpsS(25), 5.2, M.waterTau(25)); near(e.im, 9.16, 0.05); near(M.penetration(2.45e9, e) * 100, 1.87, 0.02);
  const d = M.hn(1, 10, 2, 1); near(d.re, 6, 1e-12); near(d.im, 4, 1e-12); // Debye：ωτ = 1 处 ε″ = Δε/2
  const cc = M.hn(1, 10, 2, 1, 0.3, 1); assert.ok(cc.im < 4 && cc.im > 0); // 展宽让峰变矮
  const f = (w) => M.hn(w, 10, 2, 1).im; for (const w of [0.1, 1, 3]) near(M.kkReal(f, w) + 2, M.hn(w, 10, 2, 1).re, 1e-4);
});

test('第七章：Lorentz 振子 ε″ ≥ 0 并满足求和规则；LST 例题', () => {
  for (const w of [0.3, 1, 2]) assert.ok(M.lorentz(w, 1, 1, 0.1).im >= 0);
  near(M.lorentz(1e-6, 3, 1, 0.1).re, 3, 1e-6);
  let s = 0; const dw = 1e-3; for (let w = dw / 2; w < 200; w += dw) s += w * M.lorentz(w, 2, 1, 0.1).im * dw; near(s, (Math.PI / 2) * 2, 0.02);
  near(164 * Math.sqrt(5.9 / 2.34), 260.4, 0.5); // NaCl：ω_LO = ω_TO √(ε_s/ε∞)
});

test('第八章：亥姆霍兹线圈中心场、离轴 Biot–Savart 对照轴上公式；例题', () => {
  near(M.pairAxis(0, 1, 1) / M.helmholtzCentre(1), 1, 1e-12);
  near(M.loopField(0, 0.3, 0, 1)[1] / M.loopAxis(0.3, 0, 1), 1, 1e-9);
  const h = 1e-3, d2 = (M.pairAxis(h, 1, 1) - 2 * M.pairAxis(0, 1, 1) + M.pairAxis(-h, 1, 1)) / (h * h); assert.ok(Math.abs(d2 / M.pairAxis(0, 1, 1)) < 1e-4);
  near(M.pairAxis(0, 1, 1, true), 0, 1e-15); // 反接：中心为零
  near(14.1 ** 2 / (2 * M.C.mu0) / 1e6, 79.1, 0.2); near(7.9e7 / 101325, 780, 2); near(14.1 / (M.C.mu0 * 200), 5.6e4, 0.1e4);
});

test('第九章：Brillouin 极限（J = ½ 是 tanh，J → ∞ 是 Langevin）、Weiss 临界行为、Stoner–Wohlfarth 星形线', () => {
  near(M.brillouin(0.5, 0.7), Math.tanh(0.7), 1e-12); near(M.brillouin(500, 2), M.langevin(2), 2e-3);
  near(M.brillouin(2, 1e-9) / 1e-9, 3 / 6, 1e-6);
  near(M.pEff(2.5, 2), 5.916, 1e-3); near(M.pEff(0.5, 2), 1.732, 1e-3);
  rel(M.weiss(0.5, 0.99), M.weissCritical(0.5, 0.99), 0.01); rel(M.weiss(3.5, 0.999), M.weissCritical(3.5, 0.999), 0.01);
  near(M.weiss(0.5, 0.2), 1 - 2 * Math.exp(-10), 1e-6); near(M.weiss(0.5, 1.2), 0, 1e-6);
  for (const deg of [0, 45, 60]) { const ps = (deg * Math.PI) / 180, hc = M.swCoercive(M.swLoop(ps, 2000)); near(hc, deg === 0 ? 1 : deg === 45 ? 0.5 : 0.433, 0.004, `ψ=${deg}`); }
  near(M.swSwitch(Math.PI / 4), 0.5, 1e-12);
});

test('第十章：偶极辐射场线 ψ 处处和 E 相切；Larmor 功率、Rayleigh λ⁻⁴、铜的趋肤深度；例题', () => {
  let worst = 0;
  for (let i = 0; i < 60; i++) {
    const x = 0.3 + ((i * 0.37) % 5), z = ((i * 0.71) % 8) - 4, ph = (i * 1.3) % 6, h = 1e-6;
    const [Ex, Ez] = M.dipoleE(x, z, ph), gx = (M.dipolePsi(x + h, z, ph) - M.dipolePsi(x - h, z, ph)) / (2 * h), gz = (M.dipolePsi(x, z + h, ph) - M.dipolePsi(x, z - h, ph)) / (2 * h);
    worst = Math.max(worst, Math.abs(Ex * gx + Ez * gz) / (Math.hypot(Ex, Ez) * Math.hypot(gx, gz)));
  }
  assert.ok(worst < 1e-6, worst);
  // 远场功率在球面上积分 = Larmor
  const p0 = 1e-30, w = 1e15, r = 1; let P = 0; const n = 400; for (let i = 0; i < n; i++) { const th = ((i + 0.5) / n) * Math.PI; P += M.poyntingFar(p0, w, th, r) * 2 * Math.PI * r * r * Math.sin(th) * (Math.PI / n); }
  rel(P, M.larmor(p0, w), 1e-4); // 两个都是时间平均：⟨P⟩ = ω⁴p₀²/(12πε₀c³)
  near((700 / 450) ** 4, 5.86, 0.01);
  near(M.skinDepth(1e9, 5.96e7) * 1e6, 2.06, 0.01);
  // 例题：经典氢原子的坍缩时间 a₀³/(4 r_e² c) ≈ 16 ps
  const re = M.C.coul * M.C.e ** 2 / (M.C.me * M.C.c ** 2); near(M.C.a0 ** 3 / (4 * re ** 2 * M.C.c) * 1e12, 15.6, 0.2);
});

test('第十一章：两个 Drude 振子的零点能 → −(3/4)ħω₀α′²/R⁶；Casimir 压强例题；磁通量子', () => {
  for (const R of [10, 20]) near(-M.drudePair(R) * R ** 6, M.londonC6, 1e-4);
  assert.ok(Number.isNaN(M.drudePair(1.2))); // R³ < 2α′：极化灾难
  near(M.casimirP(1e-6) * 1e3, 1.30, 0.01); near(M.casimirP(1e-7), 13.0, 0.1); near(M.casimirP(1e-8) / 101325, 1.28, 0.02);
  near((2 * Math.PI * M.C.hbar) / M.C.e * 1e15, 4.1357, 1e-4);
  near(M.c6eVA6toAU(1), 1 / (27.211386 * 0.529177 ** 6), 1e-5);
});

test('第十二章：Ewald 的 Madelung 常数与 α 无关；Evjen 收敛、球形加和不收敛；晶格能例题', () => {
  for (const a of [1.5, 2, 3]) near(M.ewald(a).M, 1.7475646, 2e-7, `α=${a}`);
  const e2 = M.ewald(2), e3 = M.ewald(3); assert.ok(Math.abs(e2.Er - e3.Er) > 0.1, '两部分各自随 α 变');
  near(M.madelungEvjen(6), 1.7476, 2e-4);
  const sp = [5, 10, 15].map(M.madelungSphere); assert.ok(Math.abs(sp[1] - sp[0]) > 1 && Math.abs(sp[2] - sp[1]) > 1, '按球加和振荡');
  near(M.erfc(0), 1, 1e-7); near(M.erfc(1), 0.157299, 1e-6);
  const k = (M.C.NA * M.C.e ** 2 * M.C.coul) / 1e-10 / 1000; near(k, 1389.35, 0.05); near((1.7476 * k) / 2.82 * 0.875, 753, 1);
});

test('生成的内容是最新的、十二章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/${DIR}em-${lang}.js 不是最新的：运行 node tools/em-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['maxwell', 'electrostatics', 'multipoles', 'dielectrics', 'solvation', 'relaxation', 'spectrum', 'magnetostatics', 'magnetism', 'radiation', 'quantum', 'computing'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read(DIR + 'em-models.js') + '\n' + read(DIR + 'em-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_EM_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  const names = ['born', 'brillouin', 'cosmo', 'debye', 'dipole', 'ewald', 'fieldlines', 'helmholtz', 'hysteresis', 'laplace', 'london', 'multipole', 'polar', 'spectrum', 'weiss'];
  assert.deepEqual([...Object.keys(DEMOS)].sort(), names);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 6, id); assert.ok(ch.points.length >= 4 && ch.math.length >= 3 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, names.length, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 55); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.equal(C.index.quiz.length, 12); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
  assert.match(JSON.stringify(zh.chapters.radiation), /spectra\//, '辐射一章链到谱图馆');
});

test('顶栏、SEO 和站点地图接上了', () => {
  const nav = read('shared-nav.js');
  assert.match(nav, /\['em', 'em\/index\.html'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("em\/index\.html"/); assert.match(seo, /\["em\/", "0\.8", "monthly"\]/);
  assert.match(read(DIR + 'index.html'), /data-section="em"/);
  assert.match(read(DIR + 'index.html'), /em-models\.js[\s\S]*em-demos\.js[\s\S]*em\.js/);
});
