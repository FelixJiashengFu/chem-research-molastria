// node --test tools/cat-test.mjs
// 人工催化剂（/catalysts/）：十四个演示的数学对照解析解或已知的数（Eyring 的 1.3642 kcal/mol 每十倍、有效摩尔浓度和熵代价、
// 笼催化按占有率的精确稳态和产物抑制、1:1 结合的二次方程精确解和从无噪声滴定曲线反解 Ka、米氏方程的数值积分对照稳态闭式、
// Born 和笼内静电、Langmuir 等温线的表观级数、火山图顶点的闭式解、OER 标度关系给出的 0.37 V 下限、ee ↔ ΔΔG‡、
// 球形颗粒的分散度、氢键 12–10 势的精度代价、n 个正态里最大值的期望、随机森林的袋外预测和精确 Shapley 值的效率公理），
// 章里例题的算术，生成的内容是最新的、十章中英齐全、演示都登记了、文献都被引用，顶栏、SEO 和最近更新接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './cat-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('catalysts/cat-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_CAT_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`catalysts/cat-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_CAT)); };
const RT = 1.98720425e-3 * 298.15;

test('第一章：Eyring 换算和每十倍 1.3642 kcal/mol，加速倍数 ↔ ΔΔG‡ 互为逆运算', () => {
  near(M.kcalPerDecade(), RT * Math.LN10, 1e-15);
  near(M.kcalPerDecade(), 1.36418, 1e-4, '室温下每十倍速率');
  near(M.kcalPerDecade(500), 1.98720425e-3 * 500 * Math.LN10, 1e-15);
  // Eyring 和它的反函数
  for (const dG of [5, 12, 18.6, 25, 33]) near(M.dGfromRate(M.eyring(dG)), dG, 1e-9, '逆运算');
  // 18.6 kcal/mol ≈ 每秒一次（教科书常用的记法）
  assert.ok(M.eyring(17) > 1 && M.eyring(20) < 1, '每秒一次落在 17–20 kcal/mol 之间');
  // 加速倍数和能量：10⁴ 倍 = 4 × 1.364
  near(M.ddGFromRatio(1e4), 4 * M.kcalPerDecade(), 1e-12);
  near(M.decades(M.ddGFromRatio(1e6)), 6, 1e-12);
  near(M.rateRatio(M.ddGFromRatio(250)), 250, 1e-9);
  near(M.halfLife(Math.LN2), 1, 1e-15);
  // 温度越高，同一个垒差换来的倍数越小
  assert.ok(M.rateRatio(3, 298.15) > M.rateRatio(3, 500));
});

test('第一章：有效摩尔浓度、结合熵代价和笼内静电能把 10⁴ 倍拆开', () => {
  near(M.effectiveMolarity(2e-2, 2e-6), 1e4, 1e-9);
  // EM = 10⁴ M 相当于 −5.46 kcal/mol
  near(M.emToDG(1e4), -4 * M.kcalPerDecade(), 1e-12);
  near(M.emToDG(1), 0, 1e-15);
  // 六个被冻住的自由度，每个约 1.2 kcal/mol
  near(M.bindingEntropyCost(298.15, 1.2), 7.2, 1e-12);
  near(M.bindingEntropyCost(596.3, 1.2), 14.4, 1e-9, '熵代价随温度线性增长');
  // 静电那一项：带正电的笼稳定带负电的过渡态，低介电里大、水里小
  const low = M.cageElectrostatic({ Q: 4, R: 7, eps: 4, qS: -0.2, qTS: -0.8 });
  const water = M.cageElectrostatic({ Q: 4, R: 7, eps: 78.4, qS: -0.2, qTS: -0.8 });
  assert.ok(low.ddG < 0 && water.ddG < 0, '都是稳定化');
  near(low.ddG / water.ddG, 78.4 / 4, 1e-9, 'ΔΔG 反比于介电常数');
  near(low.ddG, (332.0637 * 4 * (-0.8 - -0.2)) / (4 * 7), 1e-9);
  // Born 溶剂化：电荷平方、反比于半径，真空里为零
  near(M.bornSolv(1, 3, 1), 0, 1e-15);
  near(M.bornSolv(2, 3, 78.4) / M.bornSolv(1, 3, 78.4), 4, 1e-9);
});

test('第二章：笼的占有率、产物抑制和能量跨度', () => {
  // 占有率是 Langmuir 形式：K·c 很大时趋于 1
  near(M.occupancy(1e3, 1e-3), 0.5, 1e-12);
  near(M.occupancy(1e6, 1), 1 / (1 + 1e-6), 1e-12);
  // 产物结合牢 100 倍、浓度相同时，位点基本被产物占住
  const free = M.occupancy(1e3, 1e-3, 1e-3, 1e5);
  assert.ok(free < 0.01, `产物抑制后只剩 ${free}`);
  // 例题：转化到一半，K_S = 10³、K_P = 10⁵，笼上 98.8 % 是产物
  const S = 5e-3, P = 5e-3;
  const occS = M.occupancy(1e3, S, P, 1e5), occP = (1e5 * P) / (1 + 1e3 * S + 1e5 * P);
  near(occP, 1 - occS - 1 / (1 + 1e3 * S + 1e5 * P), 1e-12, '三项加起来是 1');
  assert.ok(occP > 0.98 && occS < 0.012, `产物占 ${occP}，底物占 ${occS}`);
  // 速率就按占有率缩小
  near(M.cageRate({ E0: 1e-5, S, P, KS: 1e3, KP: 1e5, kcat: 2 }), 2 * 1e-5 * occS, 1e-18);
  // 能量跨度：结合太强时决速的是“爬出势阱”
  const span = M.spanOfCycle([{ G: 0 }, { G: 8, ts: true }, { G: -6 }, { G: 10, ts: true }]);
  near(span.span, 16, 1e-12, '最深的阱到最高的过渡态');
  assert.equal(span.tdi, 2);
  assert.equal(span.tdts, 3);
});

test('第二章：1:1 结合的精确解、滴定曲线和从曲线反解 Ka', () => {
  // 二次方程的小根：代回去质量作用定律要成立
  for (const [h0, g0, Ka] of [[1e-4, 1e-4, 1e3], [1e-3, 5e-4, 1e5], [1e-5, 1e-2, 1e2]]) {
    const hg = M.complexConc(h0, g0, Ka);
    assert.ok(hg > 0 && hg < Math.min(h0, g0) + 1e-18, '复合物不超过限制试剂');
    near(hg / ((h0 - hg) * (g0 - hg)), Ka, Ka * 1e-7, '质量作用定律');
  }
  // 极限：Ka → ∞ 时完全结合
  near(M.complexConc(1e-4, 1e-4, 1e14), 1e-4, 1e-9);
  near(M.complexConc(1e-4, 0, 1e5), 0, 1e-18);
  // 无噪声的滴定曲线能把 Ka 反解回来（滴到饱和）
  const h0 = 1e-3, guests = Array.from({ length: 24 }, (_, i) => (i * 5e-3) / 23);
  for (const Ka of [3e2, 5e3, 8e4]) {
    const obs = M.titrationCurve(h0, guests, Ka, 1.2);
    const fit = M.fitKa(h0, guests, obs);
    assert.ok(Math.abs(Math.log10(fit.Ka / Ka)) < 0.02, `反解 ${fit.Ka} vs ${Ka}`);
  }
  // ΔG = −RT ln K：10³ M⁻¹ 是 −4.09 kcal/mol
  near(M.dGofK(1e3), -3 * M.kcalPerDecade(), 1e-12);
  near(M.dGofK(1), 0, 1e-15);
});

test('第三章：随机森林的袋外预测、置换重要性和精确 Shapley 值满足效率公理', () => {
  const { X, y } = M.cageData(140, 7, 0.2);
  assert.equal(X.length, 140);
  assert.equal(X[0].length, M.FEATURES.length);
  const F = M.buildForest(X, y, { trees: 40, seed: 3 });
  // 袋内拟合一定比袋外好，而袋外还是明显比“预测平均值”强
  const inBag = M.metrics(y, X.map((x) => M.forestPredict(F, x)));
  const oob = M.metrics(y, M.oobPredict(F));
  assert.ok(inBag.r2 > oob.r2, `袋内 ${inBag.r2} 应该优于袋外 ${oob.r2}`);
  assert.ok(oob.r2 > 0.6, `袋外 R² = ${oob.r2}`);
  const sdY = Math.sqrt(y.reduce((a, v) => a + (v - y.reduce((c, d) => c + d, 0) / y.length) ** 2, 0) / y.length);
  assert.ok(oob.mae < 0.45 * sdY, `袋外 MAE = ${oob.mae}，数据本身的标准差 ${sdY}`);
  // 只预测平均值的 R² 是 0
  near(M.metrics(y, y.map(() => y.reduce((a, b) => a + b, 0) / y.length)).r2, 0, 1e-12);
  // 置换重要性：真正进了数据生成规律的那几列应该排前面，而纯噪声列几乎不动
  const imp = M.permImportance(F, 11);
  const order = imp.map((v, i) => [v, M.FEATURES[i]]).sort((a, b) => b[0] - a[0]).map((p) => p[1]);
  assert.ok(order.slice(0, 2).includes('preorg'), `重要性排序是 ${order}`);
  assert.ok(imp[M.FEATURES.indexOf('flex')] < imp[M.FEATURES.indexOf('preorg')], '柔性不该比预组织重要');
  // 精确 Shapley 值：Σφ = f(x) − E[f]（效率公理）
  const bg = X.slice(0, 24);
  for (const x of [X[5], X[77], X[130]]) {
    const sh = M.shapley(F, x, bg);
    near(sh.phi.reduce((a, b) => a + b, 0), sh.pred - sh.base, 1e-9, '效率公理');
  }
});

test('第四、五章：Langmuir 的表观级数、孔内富集，以及米氏方程的数值解对照闭式', () => {
  // Langmuir：低压一级、高压零级，表观级数的闭式是 1/(1 + Kc)
  near(M.langmuir(1e-6, 1e3), 1e3 * 1e-6 / (1 + 1e-3), 1e-15);
  const K = 500, c = 2e-3, h = 1e-9;
  const dlnr = (Math.log(M.langmuir(c + h, K)) - Math.log(M.langmuir(c - h, K))) / (Math.log(c + h) - Math.log(c - h));
  near(dlnr, 1 / (1 + K * c), 1e-6, '表观反应级数');
  // 富集因子：−3 kcal/mol 在 298 K 是 159 倍（第四章例题）
  near(M.enrichment(-3), Math.exp(3 / RT), 1e-9);
  assert.ok(Math.abs(M.enrichment(-3) - 159) < 1, `富集 ${M.enrichment(-3)}`);
  near(M.enrichment(0), 1, 1e-15);
  const pore = M.poreRate({ dGads: -3, cBulk: 1e-3, poreVol: 0.02, kInter: 1, cMax: 10 });
  assert.ok(pore.rate / pore.bulk > 100, `孔内比本体快 ${pore.rate / pore.bulk} 倍，纯富集就够`);
  // 米氏方程：数值积分的初速率要对上闭式
  const p = { e0: 1e-5, s0: 1e-2, k1: 1e4, km1: 100, k2: 0.5, tEnd: 20, steps: 2000 };
  const Km = M.KM(p.k1, p.km1, p.k2);
  near(Km, (100 + 0.5) / 1e4, 1e-15);
  const run = M.mmSimulate(p);
  const v0 = (run.P[40] - run.P[20]) / (run.t[40] - run.t[20]);
  near(v0 / M.mmRate(p.s0, p.e0, p.k2, Km), 1, 0.05, '初速率对照米氏闭式');
  // 结合这一步快几个数量级，所以积分要自己切子步：粗步长、硬参数下也要守恒、不炸
  for (const hard of [{ ...p, steps: 200 }, { ...p, k1: 1e7, km1: 1e3, tEnd: 200, steps: 1500 }]) {
    const r = M.mmSimulate(hard);
    const mass = r.S.at(-1) + r.ES.at(-1) + r.P.at(-1);
    assert.ok(Number.isFinite(mass), '积分没有炸');
    near(mass / hard.s0, 1, 1e-6, '底物、复合物、产物三项守恒');
    assert.ok(r.TON <= hard.s0 / hard.e0 + 1e-9, `TON ${r.TON} 不能超过底物当量 ${hard.s0 / hard.e0}`);
  }
  // 产物抑制让同样时间内的 TON 变小
  const inhib = M.mmSimulate({ ...p, KP: 5e3, tEnd: 3000, steps: 2000 });
  const clean = M.mmSimulate({ ...p, tEnd: 3000, steps: 2000 });
  assert.ok(inhib.TON < clean.TON * 0.5, `抑制 ${inhib.TON} vs 不抑制 ${clean.TON}`);
  assert.ok(clean.TON > 500, `没有抑制时跑到 TON = ${clean.TON}`);
  near(M.efficiency(0.5, Km), 0.5 / Km, 1e-12);
});

test('第六章：氢键 12–10 势在 r₀ 处取到 −D，摆歪的代价和章里的数字一致', () => {
  near(M.hbond(2.9, 0), -2.5, 1e-12, '最优处正好是 −D');
  near(M.hbond(2.9, 0, 4, 2.9), -4, 1e-12);
  // 两侧都上升（更近的斥力、更远的失去）
  assert.ok(M.hbond(2.6, 0) > M.hbond(2.9, 0) && M.hbond(3.4, 0) > M.hbond(2.9, 0));
  // 角度因子是 cos²θ
  near(M.hbond(2.9, Math.PI / 3) / M.hbond(2.9, 0), 0.25, 1e-12);
  // 第六章正文：四个基团各偏 0.4 Å → 4.1 kcal/mol、三个数量级
  const g4 = (dr, dth) => Array.from({ length: 4 }, () => ({ dr, dth }));
  const a04 = M.activeSite(g4(0.4, 0));
  near(a04.ideal, -10, 1e-12);
  assert.ok(Math.abs(a04.lost - 4.13) < 0.02, `偏 0.4 Å 丢掉 ${a04.lost}`);
  assert.ok(Math.abs(M.decades(a04.lost) - 3.0) < 0.1, `也就是 ${M.decades(a04.lost)} 个数量级`);
  // 例题：各偏 0.5 Å、歪 20° → 5.75 kcal/mol、4.2 个数量级、速率剩 6 × 10⁻⁵
  const ex = M.activeSite(g4(0.5, (20 * Math.PI) / 180));
  assert.ok(Math.abs(ex.lost - 5.75) < 0.02, `例题的 ${ex.lost}`);
  assert.ok(Math.abs(M.decades(ex.lost) - 4.2) < 0.05);
  assert.ok(Math.abs(Math.log10(ex.factor) + 4.21) < 0.05, `速率因子 ${ex.factor}`);
  // 例题的反向算法：压到 0.2 Å、10° 只剩 1.9 kcal/mol
  const tight = M.activeSite(g4(0.2, (10 * Math.PI) / 180));
  assert.ok(Math.abs(tight.lost - 1.91) < 0.03, `收紧后 ${tight.lost}`);
  near(M.activeSite(g4(0, 0)).lost, 0, 1e-12, '摆准了不损失');
});

test('第七章：ee ↔ ΔΔG‡ 对照表里的四行，以及等选择温度之外降温提高 ee', () => {
  near(M.erOf(0.99), 199, 1e-12);
  const rows = [[0.5, 0.6508], [0.9, 1.7452], [0.99, 3.1355], [0.999, 4.5024]];
  for (const [ee, dd] of rows) {
    near(M.eeToDdG(ee), RT * Math.log(M.erOf(ee)), 1e-12);
    assert.ok(Math.abs(M.eeToDdG(ee) - dd) < 0.01, `ee ${ee} → ${M.eeToDdG(ee)}，表里写 ${dd}`);
    near(M.ddGToEe(M.eeToDdG(ee)), ee, 1e-9, '互为逆运算');
  }
  // 从 90 % 到 99 % 要的能量比从 50 % 到 90 % 多
  assert.ok(M.eeToDdG(0.99) - M.eeToDdG(0.9) > M.eeToDdG(0.9) - M.eeToDdG(0.5));
  // 例题：88 % ee 在 25 °C → 1.63 kcal/mol；要 96 % 得降到约 211 K
  const dd = M.eeToDdG(0.88);
  assert.ok(Math.abs(dd - 1.630) < 0.005, `88 % ee 是 ${dd}`);
  const T = dd / (1.98720425e-3 * Math.log(M.erOf(0.96)));
  assert.ok(Math.abs(T - 210.9) < 1, `要降到 ${T} K`);
  assert.ok(Math.abs(M.ddGToEe(dd, T) - 0.96) < 1e-6, '在这个温度下正好 96 %');
  // 纯焓控制时降温单调提高 ee；有熵贡献时存在等选择温度
  assert.ok(M.ddGToEe(2, 200) > M.ddGToEe(2, 400));
  near(M.eeAtT(1.5, 0, 298.15), M.ddGToEe(1.5, 298.15), 1e-12);
  const iso = M.eeAtT(1.5, 5, 300);        // ΔΔS = 5 cal/(mol·K) → 等选择温度 300 K
  near(iso, 0, 1e-12, '等选择温度上 ee = 0');
});

test('第八章：火山图顶点的闭式解和 OER 标度关系给出的 0.37 V 下限', () => {
  const p = { a1: 0.5, a2: 0.5, b1: 1.1, b2: 0.8, T: 500 };
  const xp = M.volcanoPeak(p);
  near(xp, (p.b2 - p.b1) / (p.a1 + p.a2), 1e-15);
  near(xp, -0.3, 1e-12);
  // 顶点上两条支线相等，两侧都更低
  const top = M.volcanoTOF(xp, p);
  near(top.ts1, top.ts2, 1e-12, '山顶两条支线交叉');
  for (const dx of [0.05, 0.2, 0.6, 1.2]) {
    assert.ok(M.volcanoTOF(xp - dx, p).logTOF < top.logTOF - 1e-9, `左侧 ${dx}`);
    assert.ok(M.volcanoTOF(xp + dx, p).logTOF < top.logTOF - 1e-9, `右侧 ${dx}`);
  }
  // 决速步在顶点两侧互换
  assert.equal(M.volcanoTOF(xp - 0.5, p).limiting, 2);
  assert.equal(M.volcanoTOF(xp + 0.5, p).limiting, 1);
  // OER：四步加起来一定是 4.92 eV，而标度关系把 η 钉在 ≥ 0.37 V
  near(M.oerLimit(3.2), 0.37, 1e-12);
  near(M.oerLimit(2.46), 0, 1e-12, '标度关系松到 2.46 eV 才能零过电位');
  for (const [dGOH, dGO] of [[0.8, 2.4], [1.2, 2.6], [0.6, 1.9], [1.6, 3.4]]) {
    const r = M.oerSteps(dGOH, dGO);
    near(r.steps.reduce((a, b) => a + b, 0), 4.92, 1e-12, '四步之和');
    assert.ok(r.eta >= M.oerLimit(3.2) - 1e-12, `η = ${r.eta} 不能低于下限`);
  }
  // 最好的情形：把 3.2 eV 平分，正好打到下限
  const best = M.oerSteps(0.8, 0.8 + 1.6);
  near(best.eta, M.oerLimit(3.2), 1e-12);
});

test('第九章：球形颗粒的分散度和每位点归一化（例题里 20 nm 的 Fe₃O₄）', () => {
  // 原子数密度：Fe₃O₄ 密度 5.17 g/cm³、摩尔质量 231.5 g/mol
  const n = M.atomDensity(5.17, 231.5);
  assert.ok(Math.abs(n - 13.45) < 0.1, `每 nm³ ${n} 个式量单元`);
  // 演示里取表面位点密度 15 nm⁻²（金属常见的量级）
  const p20 = M.particle(20, 5.17, 231.5, 15);
  assert.ok(Math.abs(p20.total - 5.63e4) < 300, `20 nm 颗粒里 ${p20.total} 个式量单元`);
  near(p20.surface, Math.PI * 400 * 15, 1e-9);
  assert.ok(p20.dispersion > 0.05 && p20.dispersion < 0.5, `分散度 ${p20.dispersion}`);
  // 分散度反比于粒径：直径翻倍，表面比例减半
  near(p20.dispersion / M.particle(40, 5.17, 231.5, 15).dispersion, 2, 1e-9);
  // 颗粒越小越分散，到极小的时候整颗都是表面（表面数不会超过总数）
  const tiny = M.particle(1.2, 5.17, 231.5, 15);
  assert.ok(tiny.dispersion <= 1 + 1e-12 && tiny.surface <= tiny.total + 1e-12);
  // 第九章例题的另一种估法（0.25 nm 的一层壳，f ≈ 6a/d）给出同一个量级
  const shell = p20.total * ((6 * 0.25) / 20);
  assert.ok(Math.abs(Math.log10(p20.surface / shell)) < 0.7, `两种估法 ${p20.surface} vs ${shell}`);
  // 每位点归一化：按颗粒算的 3 × 10⁴ s⁻¹ 在表面位点上只剩个位数，远低于辣根过氧化物酶的 4 × 10³
  for (const sites of [p20.surface, shell]) {
    const per = M.perSite(3e4, sites);
    assert.ok(per > 0.5 && per < 30, `每个表面位点 ${per} s⁻¹`);
    assert.ok(per < 4e3 / 100, '比天然酶低两个数量级以上');
  }
  assert.ok(M.perSite(3e4, p20.total) < 1, '按全部金属算更小');
});

test('第十章：n 个正态里最大值的期望、筛选通量和回归到均值', () => {
  // 小 n 的闭式：E[max of 2] = 1/√π，E[max of 3] = 3/(2√π)
  near(M.expectedBestZ(1), 0, 1e-6);
  near(M.expectedBestZ(2), 1 / Math.sqrt(Math.PI), 1e-6);
  near(M.expectedBestZ(3), 3 / (2 * Math.sqrt(Math.PI)), 1e-6);
  // 第十章正文里引的三个数
  assert.ok(Math.abs(M.expectedBestZ(30) - 2.04) < 0.01);
  assert.ok(Math.abs(M.expectedBestZ(100) - 2.51) < 0.01);
  assert.ok(Math.abs(M.expectedBestZ(10000) - 3.85) < 0.01);
  // 单调增长，但只按 √(2 ln n) 那么慢
  for (const n of [5, 50, 500, 5000]) assert.ok(M.expectedBestZ(n) < M.expectedBestZ(10 * n));
  assert.ok(M.expectedBestZ(1e6) < Math.sqrt(2 * Math.log(1e6)));
  // 至少中一个的概率
  near(M.probAtLeast(1, 0.3), 0.3, 1e-12);
  near(M.probAtLeast(10, 0.1), 1 - 0.9 ** 10, 1e-12);
  const sc = M.screen({ daysEach: 3, days: 90, mu: 0, sigma: 1, threshold: 2 });
  assert.equal(sc.n, 30);
  near(sc.best, M.expectedBestZ(30), 1e-12);
  assert.ok(sc.pAny > sc.pOne && sc.pAny < 1);
  // 例题：真实 σ = 1.5、测量误差 0.4 → 赢家重测平均差 0.21 kcal/mol
  const sdObs = Math.sqrt(1.5 ** 2 + 0.4 ** 2);
  const lead = M.expectedBestZ(30) * sdObs, errPart = lead * (0.4 ** 2 / sdObs ** 2);
  assert.ok(Math.abs(sdObs - 1.5524) < 1e-3);
  assert.ok(Math.abs(lead - 3.171) < 0.01, `赢家领先 ${lead}`);
  assert.ok(Math.abs(errPart - 0.211) < 0.01, `其中运气占 ${errPart}`);
  assert.ok(Math.abs(1 - Math.exp(-errPart / RT) - 0.30) < 0.02, '速率低约 30 %');
  // 信噪比一样时运气占一半：赢家重测差 2.2 kcal/mol
  const sd2 = Math.sqrt(2) * 1.5, err2 = M.expectedBestZ(30) * sd2 * 0.5;
  assert.ok(Math.abs(err2 - 2.17) < 0.03, `${err2}`);
  assert.ok(1 / Math.exp(-err2 / RT) > 30, '速率掉几十倍');
});

test('生成的内容是最新的、十章中英齐全、演示都登记了、文献都被引用', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `cat-${lang}.js 不是最新的：运行 node tools/cat-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['why', 'cage', 'data', 'mof', 'metal', 'denovo', 'organo', 'sac', 'nano', 'read'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids);
  assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} };
  vm.runInNewContext(read('catalysts/cat-models.js') + '\n' + read('catalysts/cat-demos.js'), s);
  const DEMOS = {};
  s.window.MOLASTRIA_CAT_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : k === 'en' ? false : () => '') }), DEMOS);
  assert.deepEqual([...Object.keys(DEMOS)].sort(), ['accel', 'cagecycle', 'ee', 'electro', 'em', 'forest', 'geom', 'langmuir', 'mm', 'nano', 'scaling', 'screen', 'titration', 'volcano']);
  for (const C of [zh, en]) {
    for (const id of ids) {
      const ch = C.chapters[id];
      assert.ok(ch.body.length >= 8, `${id} 的正文只有 ${ch.body.length} 块`);
      assert.ok(ch.points.length >= 5 && ch.math.length >= 3 && ch.example, id);
      for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo);
    }
    const shown = new Set();
    for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, 14, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 61);
    for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 7);
    for (const q of C.index.quiz) { assert.ok(q.a < q.opts.length); assert.ok(ids.includes(q.ch), q.ch); }
    assert.ok(C.index.bridge.rows.length >= 12 && C.index.bridge.head.length === 4, '联系表');
    for (const row of C.index.bridge.rows) assert.ok(ids.includes(row.ch) && row.ai && row.chem && row.go, row.ch);
    const fams = Object.keys(C.index.families);
    assert.ok(C.index.catalog.length >= 24, `总览 ${C.index.catalog.length} 项`);
    const evid = Object.keys(C.index.evidence);
    for (const m of C.index.catalog) {
      assert.ok(fams.includes(m.fam) && m.learns && m.name && m.org, m.name);
      assert.ok(ids.includes(m.ch), `${m.name} 的章 ${m.ch}`);
      assert.ok(evid.includes(m.exp), `${m.name} 的证据等级 ${m.exp}`);
      assert.ok(m.src || /^https:\/\//.test(m.url), `${m.name} 没有出处`);
      if (m.url) assert.match(m.urlDate, /^\d{4}-\d{2}-\d{2}$/);
    }
    for (const f of fams) assert.ok(C.index.catalog.some((m) => m.fam === f), `类别 ${f} 是空的`);
    assert.ok(C.index.open.length >= 6);
    for (const o of C.index.open) assert.ok(ids.includes(o.ch), o.ch);
    assert.ok(C.index.milestones.length >= 18, `时间线 ${C.index.milestones.length} 条`);
    assert.ok(C.index.books.length >= 5);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
    // 普通引号里写 TeX 时反斜杠会被 JS 吃掉（'\mid' 变成 mid），KaTeX 就把命令名当成一串单个字母
    for (const w of ['frac', 'sum', 'prod', 'cdot', 'partial', 'text', 'mathbf', 'mathrm', 'quad', 'alpha', 'theta', 'sigma', 'lambda', 'epsilon', 'approx', 'times', 'infty', 'sqrt', 'langle', 'rangle', 'left', 'right', 'hat', 'exp', 'log', 'min', 'max', 'ddagger', 'Delta', 'Phi', 'tanh', 'ldots', 'varepsilon', 'ge', 'le'])
      assert.ok(!t.includes([...w].map((c) => `<mi>${c}</mi>`).join('')), `公式里有拆成字母的 \\${w}：源文件里少了反斜杠`);
  }
  // 这一栏的锚点论文（2026 年 11 月的 JACS）在总览和文献里都标着
  const anchor = zh.refs.find((r) => r.id === 'bickerton2026');
  assert.ok(anchor && anchor.doi && anchor.year === 2026, '锚点论文');
  assert.ok(zh.index.catalog.some((m) => m.ref === 'bickerton2026' || (m.src || '').includes('bickerton2026')));
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO、站点地图和最近更新接上了', () => {
  assert.match(read('shared-nav.js'), /\['catalyst', 'catalysts\/index\.html', '人工催化剂', 'Artificial Catalysts'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("catalysts\/index\.html"/);
  assert.match(seo, /\["catalysts\/", "0\.8", "monthly"\]/);
  assert.match(read('catalysts/index.html'), /data-section="catalyst"/);
  assert.match(read('updates/updates-data.js'), /id: 'catalysts'/);
  // 以后的栏目会把 UPDATES_LATEST 往后推，这里只要求不早于这一条的日期
  const latest = read('shared-nav.js').match(/UPDATES_LATEST = '(\d{4}-\d{2}-\d{2})'/);
  assert.ok(latest && latest[1] >= '2026-11-27', 'UPDATES_LATEST 不早于 2026-11-27');
  const yml = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(yml, /node --test tools\/cat-test\.mjs/);
});
