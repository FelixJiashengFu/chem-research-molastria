// node --test tools/macro-test.mjs
// 热、统计与流体（/macro/）：演示的数学对照解析解和已知值，章里的例题数字自己重算一遍，生成的内容是最新的、中英齐全，
// 顶栏和 SEO 接上了，页面和源文件里没有不该出现的词。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import crypto from 'node:crypto';
import { inputHash, outFile, stamp } from './macro-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('macro/macro-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_MACRO_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`macro/macro-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_MACRO)); };

test('Kac 环：精确倒回，N 拍后颜色乘 (−1)^m，2N 拍回到起点，对记号摆法平均后是 Boltzmann 的指数衰减', () => {
  const N = 500, { c, mk } = M.kacInit(N, 0.1, 5), m = mk.reduce((a, b) => a + b, 0);
  let x = c; const hist = [x];
  for (let t = 0; t < 2 * N; t++) { x = M.kacStep(x, mk); hist.push(x); }
  near(M.kacDelta(hist[N]), m % 2 ? -1 : 1, 0); assert.deepEqual([...hist[2 * N]], [...c]);
  let y = hist[137]; for (let t = 0; t < 137; t++) y = M.kacStep(y, mk, true); assert.deepEqual([...y], [...c]);
  const mu = 0.05, T = 30, sum = new Float64Array(T + 1), R = 400;
  for (let k = 0; k < R; k++) { const a = M.kacInit(400, mu, 100 + k); let z = a.c; for (let t = 0; t <= T; t++) { sum[t] += M.kacDelta(z) / R; z = M.kacStep(z, a.mk); } }
  for (const t of [0, 5, 10, 20, 30]) near(sum[t], (1 - 2 * mu) ** t, 0.012, `t=${t}`);
  near(M.mixEntropy(0), Math.LN2); near(M.mixEntropy(1), 0); near(M.mixEntropy(-1), 0);
});

test('Q2R：能量一拍都不变，可以精确倒回；Onsager 和 Yang 的闭式', () => {
  const L = 32, s = M.q2rInit(L, 0.12, 9), s0 = Int8Array.from(s), e0 = M.q2rEnergy(s, L);
  for (let t = 0; t < 300; t++) { M.q2rStep(s, L); assert.equal(M.q2rEnergy(s, L), e0); }
  assert.notDeepEqual([...s], [...s0]);
  for (let t = 0; t < 300; t++) M.q2rStep(s, L, true);
  assert.deepEqual([...s], [...s0]);
  assert.equal(M.q2rEnergy(new Int8Array(16).fill(1), 4), -32); // 基态每格 −2J
  near(M.ellipK(0), Math.PI / 2, 1e-14); near(M.ellipK(Math.SQRT1_2), 1.8540746773013719, 1e-12);
  near(M.ISING.betaC, 0.44068679350977147, 1e-15); near(1 / M.ISING.betaC, 2.269185314213022, 1e-12); // kT_c/J = 2/ln(1+√2)
  near(M.isingU(M.ISING.betaC), -Math.SQRT2, 1e-12);
  near(M.isingU(1e-6), -2e-6, 1e-8); near(M.isingU(5), -2, 1e-6);
  near(M.isingM(0.5), (1 - Math.sinh(1) ** -4) ** 0.125, 1e-15); assert.equal(M.isingM(0.4), 0); near(M.isingM(3), 1, 1e-4);
  let prev = 0; for (let b = 0.01; b < 2; b += 0.01) { const u = M.isingU(b); assert.ok(u < prev, `单调 ${b}`); prev = u; }
  near(M.isingU(M.ISING.betaC - 1e-7), M.isingU(M.ISING.betaC + 1e-7), 1e-4);
  // 低能量时冻住：孤立的反向自旋永远不翻
  const F = new Int8Array(L * L).fill(1); F[5 * L + 5] = -1; F[20 * L + 9] = -1; const F0 = Int8Array.from(F);
  for (let t = 0; t < 50; t++) M.q2rStep(F, L); assert.deepEqual([...F], [...F0]);
});

test('有限能级放进热浴：闭式等于直接求和；Planck 极限；高温饱和；二能级的 Schottky 峰和例题的数字', () => {
  for (const N of [2, 5, 24]) for (const x of [0.05, 0.5, 3, 40]) {
    let Z = 0, E = 0, E2 = 0; for (let k = 0; k < N; k++) { const w = Math.exp(-k / x); Z += w; E += k * w; E2 += k * k * w; } E /= Z; E2 /= Z;
    const r = M.levelsThermal(N, x); near(r.E, E, 1e-9, `E N=${N} x=${x}`); near(r.C, (E2 - E * E) / (x * x), 1e-9, `C N=${N} x=${x}`);
  }
  near(M.levelsThermal(Infinity, 2).E, 1 / Math.expm1(0.5), 1e-12); near(M.levelsThermal(Infinity, 50).C, 1, 1e-3);
  near(M.levelsThermal(1e6, 2).E, M.levelsThermal(Infinity, 2).E, 1e-9); near(M.levelsThermal(12, 1e5).E, 5.5, 1e-3); near(M.levelsThermal(2, 1e4).C, 0, 1e-6);
  // 第二章的例题：kT = ω 时 ⟨E⟩ = ω/(e+1) ≈ 0.269ω，Planck 一项 0.582ω，C/k ≈ 0.197；峰在 kT ≈ 0.417ω，约 0.439k
  near(M.levelsThermal(2, 1).E, 1 / (Math.E + 1), 1e-12); near(M.levelsThermal(2, 1).E, 0.269, 5e-4); near(M.levelsThermal(Infinity, 1).E, 0.582, 5e-4); near(M.levelsThermal(2, 1).C, 0.197, 5e-4);
  let best = [0, 0]; for (let x = 0.2; x < 1; x += 1e-4) { const C = M.levelsThermal(2, x).C; if (C > best[0]) best = [C, x]; }
  near(best[1], 0.417, 1e-3); near(best[0], 0.439, 1e-3);
});

test('HPP 格子气：守恒律、每一行多余的守恒量、精确倒回；方格子的四阶矩不各向同性，六角格子的各向同性', () => {
  const L = 64; let c = M.hppInit(L, 0.2, 4, { r: 10, rho: 0.8 }); const c0 = Uint8Array.from(c), a = M.hppTotals(c, L);
  for (let t = 0; t < 200; t++) { c = M.hppStep(c, L); if (t % 20 === 0) { const b = M.hppTotals(c, L); assert.equal(b.n, a.n); assert.equal(b.px, a.px); assert.equal(b.py, a.py); assert.deepEqual([...b.rowPx], [...a.rowPx]); } }
  assert.notDeepEqual([...c], [...c0]);
  for (let t = 0; t < 200; t++) c = M.hppStep(c, L, true);
  assert.deepEqual([...c], [...c0]);
  const g = M.hppCoarse(c, L, 8); assert.equal(g.length, 8); near(g.reduce((x, row) => x + row.reduce((p, q) => p + q, 0), 0) * 64, a.n, 1e-3);
  assert.deepEqual([...M.hppCollide(Uint8Array.from([5, 10, 15, 3, 0]))], [10, 5, 15, 3, 0]);
  for (const th of [0, 0.3, 0.7, 1.1]) { near(M.latticeQuartic(6, th), 9 / 4, 1e-12); near(M.latticeQuartic(4, th), 1.5 + 0.5 * Math.cos(4 * th), 1e-12); near(M.latticeQuartic(12, th), 4.5, 1e-12); }
});

test('格子 Boltzmann D2Q9：格子恒等式、守恒、剪切波按 ν = (τ − ½)/3 衰减；风洞里的圆盘', () => {
  const { cx, cy, w } = M.LB; near(w.reduce((p, q) => p + q, 0), 1, 1e-15);
  let xx = 0, xy = 0, x4 = 0, x2y2 = 0; for (let i = 0; i < 9; i++) { xx += w[i] * cx[i] ** 2; xy += w[i] * cx[i] * cy[i]; x4 += w[i] * cx[i] ** 4; x2y2 += w[i] * cx[i] ** 2 * cy[i] ** 2; }
  near(xx, 1 / 3, 1e-15); near(xy, 0, 1e-15); near(x4, 3 * x2y2, 1e-15);
  let r = 0, mx = 0; for (let i = 0; i < 9; i++) { const e = M.lbEq(i, 1.1, 0.05, -0.02); r += e; mx += e * cx[i]; } near(r, 1.1, 1e-14); near(mx, 1.1 * 0.05, 1e-14);
  for (const tau of [0.6, 0.8, 1.2]) {
    const nx = 8, ny = 48, k = (2 * Math.PI) / ny, U = 0.01, S = M.lbInit(nx, ny, { u: (x, y) => [U * Math.sin(k * y), 0] });
    const amp = () => { M.lbMoments(S); let a = 0; for (let y = 0; y < ny; y++) a += S.ux[y * nx] * Math.sin(k * y); return (2 * a) / ny; };
    const mass0 = S.f.reduce((p, q) => p + q, 0); for (let t = 0; t < 100; t++) M.lbStep(S, tau); const a1 = amp(); for (let t = 0; t < 400; t++) M.lbStep(S, tau); const a2 = amp();
    near(Math.log(a1 / a2) / (400 * k * k) / ((tau - 0.5) / 3), 1, 0.01, `tau=${tau}`); near(S.f.reduce((p, q) => p + q, 0), mass0, 1e-9);
  }
  const nx = 120, ny = 48, S = M.lbInit(nx, ny, { u0: 0.1, open: true, bar: M.lbDisc(nx, ny, 30, 24, 5) });
  for (let t = 0; t < 600; t++) M.lbStep(S, 0.56);
  M.lbMoments(S);
  assert.ok(S.ux.every(Number.isFinite)); assert.ok(S.ux[24 * nx + 40] < 0.05); near(S.ux[5 * nx + 60], 0.1, 0.03); assert.equal(S.ux[24 * nx + 30], 0); assert.equal(M.lbCurl(S).length, nx * ny);
});

test('第一章的例题和自测里的数字：太阳质量黑洞的熵与温度，室温下的 Landauer 界', () => {
  const G = 6.6743e-11, c = 299792458, hbar = 1.054571817e-34, k = 1.380649e-23, Msun = 1.98847e30;
  const rs = (2 * G * Msun) / c ** 2, A = 4 * Math.PI * rs ** 2, lp2 = (G * hbar) / c ** 3, S = A / (4 * lp2);
  near(rs / 1e3, 2.95, 0.01); near(A / 1e8, 1.10, 0.01); near(lp2 / 1e-70, 2.61, 0.01); near(S / 1e77, 1.05, 0.01); near(S / Math.LN2 / 1e77, 1.5, 0.05);
  near((hbar * c ** 3) / (8 * Math.PI * G * Msun * k) / 1e-8, 6.2, 0.05);
  near((k * 300 * Math.LN2) / 1e-21, 2.87, 0.01); near((k * 300) / 1e-21, 4.14, 0.01);
});

test('生成的内容是最新的、三章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/macro/macro-${lang}.js 不是最新的：运行 node tools/macro-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['thermo', 'statmech', 'fluid'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read('macro/macro-models.js') + '\n' + read('macro/macro-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_MACRO_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  assert.deepEqual([...Object.keys(DEMOS)].sort(), ['kac', 'lbm', 'levels', 'lgas', 'q2r']);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length > 15, id); assert.ok(ch.points.length >= 5 && ch.math.length >= 4 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    for (const c of C.index.chapters) for (const d of c.demos) assert.ok(DEMOS[d], d);
    assert.equal(C.refs.length, 56); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 8); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /\['macro', 'macro\/index\.html', '热、统计与流体', 'Heat, Statistics & Flow'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("macro\/index\.html"/); assert.match(seo, /\["macro\/", "0\.8", "monthly"\]/);
  assert.match(read('macro/index.html'), /data-section="macro"/);
});

// 有一小份不该出现在这个栏目里的词（换成别的栏目的说法会误导读者）。名单本身也不该公开，所以只存哈希：sha256('molastria-macro:' + 词) 的前 20 位。
const BANNED = new Set(['919ecfad9efad0286826', '71f4b6211bbf1b42a477', 'c843b3be534717a37ff5', '567355f2f9fa5db9f3f4', 'cb0d56ac244e620d0caf', '14bb86f355d198ee7600', 'a9d45db52eee931cc362', '8f38e437d2862c018c30', 'c0e26fe1beaeb54cf0fc', '4d9ccfc67ea579f07f79', '23f34f0a6b239124218c', 'e604ea37b3d8fc095549', '0b360ab9e863be3ffaf9', 'bb608c1f2b7eda565091', '4d7d16c4de8629fe4e0d', 'aac59c7e17dff8481beb', '433143aa02a56dba5cd2']);
const hit = (w) => BANNED.has(crypto.createHash('sha256').update(`molastria-macro:${w}`).digest('hex').slice(0, 20));
test('页面和源文件里没有不该出现的词', () => {
  const files = [...fs.readdirSync(new URL('macro/', pub)).map((f) => new URL(`macro/${f}`, pub)), new URL('macro/index.mjs', import.meta.url), new URL('macro/refs.json', import.meta.url),
    ...fs.readdirSync(new URL('macro/ch/', import.meta.url)).map((f) => new URL(`macro/ch/${f}`, import.meta.url)), new URL('macro-build.mjs', import.meta.url), new URL('macro-refs.mjs', import.meta.url)];
  for (const f of files) {
    const t = fs.readFileSync(f, 'utf8');
    for (const w of t.toLowerCase().match(/[a-z]+/g) || []) assert.ok(!hit(w), `${f.pathname.split('/').slice(-2).join('/')}: 有一个不该出现的英文词`);
    for (const run of t.match(/[㐀-鿿]+/g) || []) for (let i = 0; i < run.length; i++) for (let n = 2; n <= 7 && i + n <= run.length; n++) assert.ok(!hit(run.slice(i, i + n)), `${f.pathname.split('/').slice(-2).join('/')}: 有一个不该出现的词（…${run.slice(Math.max(0, i - 3), i)}▢…）`);
  }
});
