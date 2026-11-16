// node --test tools/optics-test.mjs
// 光学（/optics/）：演示的数学对照解析解和教科书数值，章里的例题和自测的数字自己重算一遍，
// 生成的内容是最新的、八章中英齐全、演示都登记了、文献都被引用，顶栏和 SEO 接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './optics-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('optics/optics-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_OPTICS_MODELS;
const deg = Math.PI / 180;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`optics/optics-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_OPTICS)); };

test('单缝、多缝和光栅：sinc² 的零点、缺级、主极大和次极大', () => {
  near(M.slitI(1, 0.5, 0), 1); near(M.slitI(1, 0.5, 0.5), 0, 1e-30); near(M.slitI(2, 0.5, 0.25), 0, 1e-30);
  // 第一个次极大在 x = 1.4303π 处，约 4.72 %
  let best = 0; for (let x = 1.1; x < 1.9; x += 1e-5) best = Math.max(best, M.sinc(Math.PI * x) ** 2); near(best, 0.04719, 1e-5);
  // N 缝：主极大处等于单缝包络，d = 2a 时第 ±2 级缺级
  near(M.multiI(5, 0.6, 3, 0.5, 0.5 / 3), M.slitI(0.6, 0.5, 0.5 / 3), 1e-9);
  near(M.multiI(2, 1.6, 3.2, 0.5, (2 * 0.5) / 3.2), 0, 1e-12);
  near(M.gratingAngle(1 / 600 * 1e6, 589.3, 1) / deg, 20.706, 1e-3);
  assert.ok(Number.isNaN(M.gratingAngle(1000, 589.3, 2)));
  assert.equal(M.resolvingPower(1, 1000), 1000);
});

test('艾里斑：J₁ 的第一个零点，瑞利判据下两峰之间的谷是 73.5 %', () => {
  near(M.besselJ(1, M.AIRY_ZERO), 0, 1e-12); near(M.besselJ(0, 2.404825557695773), 0, 1e-12); near(M.besselJ(1, 1), 0.44005058574493355, 1e-12);
  near(M.airyI(0), 1); near(M.airyI(M.AIRY_ZERO), 0, 1e-20);
  let mx = 0; for (let v = -6; v < 6; v += 1e-3) mx = Math.max(mx, M.twoPoint(v, M.AIRY_ZERO));
  near(M.twoPoint(0, M.AIRY_ZERO) / mx, 0.735, 1e-3);
  near(M.AIRY_ZERO / Math.PI, 1.2197, 1e-4); // 1.22 λ/D 的来历
});

test('菲涅耳衍射：Fresnel 积分的极限、直边上的 1/4、菲涅耳数', () => {
  const [c, s] = M.fresnelCS(100); near(c, 0.5, 5e-3); near(s, 0.5, 5e-3);
  const [c1, s1] = M.fresnelCS(1); near(c1, 0.7798934003768228, 1e-6); near(s1, 0.4382591473903548, 1e-6);
  near(M.fresnelSlit(0, 0, 0.5, 1000, true), 0.25, 1e-6);
  near(M.fresnelSlit(0, 1000, 0.5, 1, false), 1, 0.02); // 很宽的缝、很近的屏：就是几何的亮区
  near(M.fresnelNumber(0.5, 633e-6, 200), 0.25 ** 2 / (633e-6 * 200), 1e-12);
});

test('波场水槽：很宽的缝中间就是入射的平面波，矢量图首尾相接等于直接求和', () => {
  const lam = 0.5, src = M.tankSources({ mode: 'single', a: 40 }, lam);
  const g = M.tankGrid(src, lam, 3, 1, 4, 3); near(Math.hypot(g.re[1 * 4 + 2], g.im[1 * 4 + 2]), 1, 0.05);
  const at = M.tankAt(src, lam, 2, 0.3), ph = M.phasors(src, lam, 2, 0.3);
  const sum = ph.reduce((a, [re, im]) => [a[0] + re, a[1] + im], [0, 0]);
  near(sum[0], at[0], 1e-9); near(sum[1], at[1], 1e-9);
});

test('薄膜：MgF₂ 四分之一波增透膜，裸玻璃 4.26 %，半波厚度的膜等于没有', () => {
  near(M.filmR(1, 1.52, 1.52, 100, 550, 0, 's'), ((0.52 / 2.52) ** 2), 1e-12);
  near(M.filmR(1, 1.38, 1.52, 550 / 4 / 1.38, 550, 0, 's'), ((1.52 - 1.38 ** 2) / (1.52 + 1.38 ** 2)) ** 2, 1e-12);
  near(M.filmR(1, 1.38, 1.52, 550 / 4 / 1.38, 550, 0, 's'), 0.0126, 1e-4);
  near(M.filmR(1, 1.38, 1.52, 550 / 2 / 1.38, 550, 0, 's'), M.filmR(1, 1.52, 1.52, 100, 550, 0, 's'), 1e-12);
  // 白光（各波长反射率都是 1）换算成颜色，亮度 Y = 1
  near(M.spectrumColor(() => 1).Y, 1, 0.01);
  
});

test('迈克耳孙：零光程差处可见度 1，钠双线在拍的半周期处可见度最低；相干长度 λ²/Δλ', () => {
  const na = [[588.995, 0.002, 1], [589.592, 0.002, 1]];
  near(M.interferogram(na, 0), 2, 1e-12); // 两臂相长：1 + 1
  const beat = (588.995 * 589.592) / (589.592 - 588.995) / 2 / 1e3; // 半个拍周期（μm）：两条线的条纹正好错开半个
  let lo = 2, hi = 0; for (let d = beat - 1; d < beat + 1; d += 0.002) { const I = M.interferogram(na, d); lo = Math.min(lo, I); hi = Math.max(hi, I); }
  near((hi - lo) / (hi + lo), 0, 0.01);
  near(M.coherenceLength(600, 30), 12, 1e-12); // μm
  near(M.coherenceLength(589.3, 0.597) / 1e3, 0.5817, 1e-3); // mm：钠双线的拍
});

test('布拉格：N 层同相时 |Σ|²/N² = 1，四个晶体的峰位和消光', () => {
  const b = Math.asin(1.5406 / 4); near(M.braggLayers(8, 2, 1.5406, b), 1, 1e-12); near(b / deg, 22.65, 0.01);
  assert.ok(M.braggLayers(40, 2, 1.5406, b + 2 * deg) < 0.05); near(M.braggLayers(8, 2, 1.5406, b + 0.3 * deg), M.braggLayers(8, 2, 1.5406, b - 0.3 * deg), 0.05);
  const first = (k) => M.powderPeaks(M.CRYSTALS[k], 1.5406, 120)[0];
  near(first('Cu').tt, 43.32, 0.01); assert.equal(first('Cu').hkl.join(''), '111');
  near(first('Si').tt, 28.44, 0.01);
  assert.equal(first('Fe').hkl.join(''), '110'); near(first('Fe').tt, 44.67, 0.02);
  const nacl = M.powderPeaks(M.CRYSTALS.NaCl, 1.5406, 120), p200 = nacl.find((p) => p.hkl.join('') === '200');
  near(p200.tt, 31.70, 0.01); near(p200.d, 2.82, 1e-3); assert.equal(Math.max(...nacl.map((p) => p.I)), p200.I);
  assert.ok(!M.powderPeaks(M.CRYSTALS.Si, 1.5406, 120).some((p) => p.hkl.join('') === '200'), '硅没有 (200)');
  const kcl111 = M.powderPeaks(M.CRYSTALS.KCl, 1.5406, 120).find((p) => p.hkl.join('') === '111');
  assert.ok(!kcl111 || kcl111.I < 1, 'KCl 的 (111) 几乎消失');
  // 第五章例题：20 nm 的晶粒，(200) 的 Scherrer 宽度 0.41°
  near(M.scherrer(20, 1.5406, 31.70), 0.413, 2e-3);
});

test('菲涅耳公式和偏振：4 %、布儒斯特角、临界角、三片偏振片 1/8、波片', () => {
  near(M.fresnel(1, 1.5, 0).Rs, 0.04, 1e-12); near(M.fresnel(1, 1.5, 0).Rp, 0.04, 1e-12);
  near(M.brewster(1, 1.5) / deg, 56.3099, 1e-4); near(M.fresnel(1, 1.5, M.brewster(1, 1.5)).Rp, 0, 1e-20);
  near(M.critical(1.5, 1) / deg, 41.8103, 1e-4); assert.ok(M.fresnel(1.5, 1, 45 * deg).tir);
  // 第六章例题：空气到水的布儒斯特角上 R_s = 7.8 %
  const w = M.fresnel(1, 1.333, M.brewster(1, 1.333)); near(M.brewster(1, 1.333) / deg, 53.12, 0.01); near(w.Rs, 0.0783, 5e-4);
  for (let t = 0; t < 89; t += 7) { const f = M.fresnel(1, 1.5, t * deg); assert.ok(f.Rs >= f.Rp - 1e-15 && f.Rs <= 1 && f.Rp >= 0); }
  let v = M.apply(M.polarizer(0), [[Math.SQRT1_2, 0], [0, 0]]); v = M.apply(M.polarizer(Math.PI / 4), v); v = M.apply(M.polarizer(Math.PI / 2), v);
  near(M.intensity(v), 0.125, 1e-12);
  const q = M.ellipse(M.apply(M.waveplate(Math.PI / 4, Math.PI / 2), [[1, 0], [0, 0]])); near(Math.abs(Math.tan(q.chi)), 1, 1e-9);
  near(M.ellipse(M.apply(M.waveplate(Math.PI / 8, Math.PI), [[1, 0], [0, 0]])).psi / deg, 45, 1e-9);
  near(M.intensity(M.apply(M.polarizer(30 * deg), [[1, 0], [0, 0]])), Math.cos(30 * deg) ** 2, 1e-12); // 马吕斯定律
});

test('光线追迹：单个球面的傍轴焦点 nR/(n − 1)，平凸透镜两种摆法的球差差约四倍，第七章例题', () => {
  near(M.trace([{ z: 0, R: 10, n: 1.5 }], 0.001).zf, 30, 1e-4);
  near(M.lensmaker(1.5168, 50, Infinity), 96.75, 0.01);
  const n = 1.5168, A = [{ z: 0, R: 50, n, ap: 21 }, { z: 8, R: Infinity, n: 1 }], B = [{ z: 0, R: Infinity, n }, { z: 8, R: -50, n: 1, ap: 21 }];
  const lsa = (S, h) => M.trace(S, h).zf - M.trace(S, 1e-3).zf;
  near(M.trace(A, 1e-3).zf, 96.75 - 8 / n + 8, 0.05); // 后焦距 f − t/n，再加上厚度
  near(lsa(B, 15) / lsa(A, 15), 4.05, 0.05);
  near(lsa(A, 7.5) / lsa(A, 15), 0.25, 0.01); // ∝ h²
  near(Math.sqrt(1.468 ** 2 - 1.462 ** 2), 0.1326, 1e-4); near(Math.asin(0.1326) / deg, 7.62, 0.01);
  const im = M.thinImage(100, 300); near(im.si, 150, 1e-9); near(im.m, -0.5, 1e-12);
});

test('阿贝成像：一级进不去时像是均匀的，进得去时有条纹；Zernike 相衬让相位物显出来；FFT 正逆变换回到原样', () => {
  const lo = M.fourier4f({ kind: 'amp', p: 1.2, lam: 0.55, na: 0.4 }), hi = M.fourier4f({ kind: 'amp', p: 1.4, lam: 0.55, na: 0.4 });
  near(Math.max(...lo.img) - Math.min(...lo.img), 0, 1e-9); near(Math.max(...lo.img), 0.25, 1e-9);
  assert.ok(Math.max(...hi.img) - Math.min(...hi.img) > 1);
  near(M.abbeLimit(0.55, 0.4), 1.375, 1e-12);
  const plain = M.fourier4f({ kind: 'cell', p: 2, phi: 0.3, lam: 0.55, na: 0.6 }), zer = M.fourier4f({ kind: 'cell', p: 2, phi: 0.3, lam: 0.55, na: 0.6, zernike: true });
  const span = (r) => Math.max(...r.img) - Math.min(...r.img);
  assert.ok(span(zer) > 4 * span(plain), `相衬 ${span(zer)} vs ${span(plain)}`);
  const re = Float64Array.from({ length: 64 }, (_, i) => Math.sin(i) + 0.3), im = new Float64Array(64), r0 = Float64Array.from(re);
  M.fft(re, im); M.fft(re, im, true); for (let i = 0; i < 64; i++) near(re[i], r0[i], 1e-12);
});

test('自测和第八章例题里的数字', () => {
  near((632.8e-9 * 1) / 0.25e-3 * 1e3, 2.53, 0.01);
  near((1.22 * 550e-9) / 0.1 / deg * 3600, 1.38, 0.01);
  near(589.3 / 0.6, 982, 1);
  near(0.55 / 1.2, 0.458, 1e-3); near(0.55 / 1.4, 0.393, 1e-3);
  near((450 / 700) ** -4, 5.86, 0.01);
});

test('生成的内容是最新的、八章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/optics/optics-${lang}.js 不是最新的：运行 node tools/optics-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['waves', 'interference', 'diffraction', 'gratings', 'xray', 'polarization', 'geometric', 'fourier'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read('optics/optics-models.js') + '\n' + read('optics/optics-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_OPTICS_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : () => '') }), DEMOS);
  assert.deepEqual([...Object.keys(DEMOS)].sort(), ['abbe', 'airy', 'bragg', 'film', 'fresnel', 'grating', 'jones', 'lens', 'michelson', 'powder', 'reflect', 'tank']);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length > 10, id); assert.ok(ch.points.length >= 5 && ch.math.length >= 4 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, 12, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 46); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 10); for (const q of C.index.quiz) assert.ok(q.a < q.opts.length);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
  }
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO 和站点地图接上了', () => {
  assert.match(read('shared-nav.js'), /\['optics', 'optics\/index\.html', '光学', 'Optics'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("optics\/index\.html"/); assert.match(seo, /\["optics\/", "0\.8", "monthly"\]/);
  assert.match(read('optics/index.html'), /data-section="optics"/);
});
