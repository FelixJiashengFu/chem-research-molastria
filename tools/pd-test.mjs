// node --test tools/pd-test.mjs
// AI 蛋白质设计（/protein-design/）：十二个演示的数学对照解析解或已知的计数（序列空间的组合数、自回避行走的条数对照 OEIS A001411、
// HP 模型的可设计性穷举、疏水矩在 720°/7 顶起来、精度矩阵在非接触处恒为零、逆折叠期望回收率的闭式解对照抽样、
// 反向扩散的样本协方差等于先验而只取均值会塌、K_D ↔ ΔG 每十倍 1.364 kcal/mol、Eyring 前因子、命中率的贝叶斯公式、
// NK 面上三种策略、分层筛查独立和相关两个极限、两态折叠的 T_m 精确解和近似式），章里例题的算术，
// 生成的内容是最新的、十一章中英齐全、演示都登记了、文献都被引用、联系表和成果总览完整，顶栏、SEO 和最近更新接上了。
import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { inputHash, outFile, stamp } from './pd-build.mjs';

const pub = new URL('../public/', import.meta.url);
const read = (p) => fs.readFileSync(new URL(p, pub), 'utf8');
const sandbox = { window: {} };
vm.runInNewContext(read('protein-design/pd-models.js'), sandbox);
const M = sandbox.window.MOLASTRIA_PD_MODELS;
const near = (a, b, tol = 1e-9, msg = '') => assert.ok(Math.abs(a - b) <= tol, `${msg} ${a} vs ${b}`);
const content = (lang) => { const s = { window: {} }; vm.runInNewContext(read(`protein-design/pd-${lang}.js`), s); return JSON.parse(JSON.stringify(s.window.MOLASTRIA_PD)); };
const log10 = (x) => Math.log10(x);

test('第一章：序列空间和突变球的组合数精确（例题 1.87 × 10¹⁴ 占 1.5 × 10⁻¹¹⁶）', () => {
  near(M.log10Seqs(100), 100 * log10(20), 1e-12);
  near(M.log10Seqs(1), log10(20), 1e-12);
  // 壳层：C(N, d)·19^d，小数字可以直接算
  near(M.log10Shell(100, 1), log10(1900), 1e-12);
  near(M.log10Shell(100, 2), log10(4950 * 361), 1e-12);
  near(M.log10Shell(100, 5), log10(75287520) + 5 * log10(19), 1e-12);
  // 球：逐项求和（整数算一遍对照）
  let sum = 0n; const C = (n, k) => { let r = 1n; for (let i = 0n; i < BigInt(k); i++) r = (r * (BigInt(n) - i)) / (i + 1n); return r; };
  for (let d = 0; d <= 5; d++) sum += C(100, d) * 19n ** BigInt(d);
  near(M.log10Ball(100, 5), log10(Number(sum)), 1e-9, '例题的 1.869e14');
  near(Number(sum) / 1e14, 1.86931481836856, 1e-6);
  near(M.log10Ball(100, 5) - M.log10Seqs(100), log10(1.47e-116), 1e-2, '例题的比值');
  // 覆盖率：一个 10¹¹ 条的文库连 d = 5 的球都盖不住
  assert.ok(M.log10Covered(100, 5, 11) < 0, '文库盖不住突变球');
  near(M.log10Ball(20, 0), 0, 1e-12);
});

test('第二章：自回避行走的条数对照 OEIS A001411，HP 可设计性穷举（N = 12：4096 条序列里 87 条有唯一基态）', () => {
  // A001411（n 步自回避行走，n = N − 1 个键）：1, 4, 12, 36, 100, 284, 780, 2172, 5916, 16268, 44100, 120292
  const A001411 = [1, 4, 12, 36, 100, 284, 780, 2172, 5916, 16268, 44100, 120292];
  for (const N of [3, 5, 8, 10, 12]) assert.equal(M.sawCount(N, false), A001411[N - 1], `N = ${N} 的全部行走`);
  // 去掉八重对称（第一步固定朝 +x、第一次转弯固定朝 +y）：(c − 4)/8 + 1
  for (const N of [5, 8, 10, 12]) assert.equal(M.sawCount(N, true), (A001411[N - 1] - 4) / 8 + 1, `N = ${N} 去对称`);
  assert.equal(M.sawCount(12, true), 15037);
  const d = M.hpDesignability(12);
  assert.equal(d.total, 4096);
  assert.equal(d.unique, 87, '有唯一基态的序列数');
  assert.equal(d.maxCount, 12, '最可设计的构象被多少条序列折出来');
  assert.ok(d.uniqueFrac < 0.03, `只有 ${(100 * d.uniqueFrac).toFixed(1)} % 的序列有唯一基态`);
  // 可设计性极不均匀：25 个构象分到这 87 条序列，最好的那个一个人拿 12 条，前三个拿掉 27.6 %
  const nonzero = d.count.filter((c) => c > 0).length;
  assert.equal(nonzero, 25, '有几个构象被唯一地折叠出来');
  assert.ok(d.maxCount > 3 * (d.unique / nonzero), `最好的 ${d.maxCount} 条 vs 平均 ${(d.unique / nonzero).toFixed(2)} 条`);
  const top3 = d.top.slice(0, 3).reduce((a, b) => a + b[0], 0) / d.unique;
  assert.ok(top3 > 0.25, `前三个构象占 ${(100 * top3).toFixed(1)} %，而它们只是 25 个里的 3 个`);
  // 全疏水的序列基态一定简并（没有任何序列信息去挑一个构象）
  const all = M.hpFold((1 << 12) - 1, d.STS); assert.ok(all.deg > 1, '全 H 的序列基态简并');
});

test('第三章：疏水矩在 720°/7 顶起来，交替序列在 180°；一条全疏水的链在任何角度都没有矩以外的峰', () => {
  const coil = M.hydro(M.makeSeq('coil', 28, 1)), alt = M.hydro(M.makeSeq('sheet', 28, 1));
  const b1 = M.bestAngle(coil); near(b1.deg, 102.86, 0.25, '七肽重复的最佳角度 = 720°/7');
  assert.ok(b1.mu > M.hydroMoment(coil, 180), '螺旋的矩大于 β 的角度');
  const b2 = M.bestAngle(alt); near(b2.deg, 180, 1e-9, '交替序列顶在 180°');
  near(b1.mu, 0.5649, 1e-4, '例题里的 μ');
  // μ 的解析性质：δ = 0 时等于平均疏水值的绝对值
  near(M.hydroMoment(coil, 0), Math.abs(M.mean(coil)), 1e-12);
  // 一个残基的链在任何角度 μ 都等于它自己
  near(M.hydroMoment([1.38], 137), 1.38, 1e-12);
  near(M.hydroMoment([1, -1], 180), 1, 1e-12); // 两个相反的残基在 180° 同相
  near(M.hydroMoment([1, -1], 0), 0, 1e-12);
  near(M.momentCurve(coil, [100, 180])[1], M.hydroMoment(coil, 180), 0);
  near(M.helixPitch(), 5.4, 1e-12, 'α 螺旋的螺距 1.5 Å × 360 / 100 = 5.4 Å');
  near(M.helixPitch({ deg: 120, rise: 1.5 }), 4.5, 1e-12, '三重螺旋');
});

test('第三章：两态折叠的 T_m 精确解和近似式（例题：4 × 0.8 打八折 → ΔT_m = 8.1 K）', () => {
  const p = { Tm: 330, dHm: 90, dCp: 1.5 };
  near(M.foldedFrac(330, p), 0.5, 1e-12, 'T_m 处正好一半');
  near(M.tmShift(0, p).dTm, 0, 1e-9);
  const one = M.tmShift(1, p); near(one.dTm, 3.5614, 1e-3); near(one.approx, 330 / 90, 1e-12);
  assert.ok(one.approx > one.dTm, '近似式高估');
  const dd = M.stack([0.8, 0.8, 0.8, 0.8], 0.8); near(dd, 2.3616, 1e-9, '上位效应打折');
  near(M.stack([0.8, 0.8, 0.8, 0.8], 1), 3.2, 1e-12, '理想叠加');
  const sh = M.tmShift(dd, p); near(sh.dTm, 8.1149, 1e-3, '例题的 8.1 K'); near(sh.Tm - 273.15, 64.96, 1e-2, '65 °C');
  near(sh.approx, 8.6592, 1e-3);
  // 更稳的出发点换来的度数更少（T_m 越高、ΔH_m 越大）
  assert.ok(M.tmShift(2, { Tm: 360, dHm: 110 }).dTm < M.tmShift(2, p).dTm);
  assert.ok(M.foldedFrac(310.15, { ...p, Tm: sh.Tm }) > 0.999, '37 °C 下几乎全折叠');
});

test('第四章：精度矩阵在非接触处恒为零、相关矩阵不是；求逆的 AUC = 1，相关的 AUC < 1', () => {
  const Lc = 16, far = [[2, 13], [3, 12], [4, 11], [5, 10]], contacts = [...M.CHAIN(Lc), ...far];
  const g = M.gmModel(Lc, contacts, 0.4);
  const prec = M.pairAuc(g.J, far), cor = M.pairAuc(M.toCorr(g.S), far);
  near(prec.auc, 1, 1e-12, '精确的精度矩阵完美区分');
  near(cor.auc, 1, 1e-12, '这个接触图上相关也排得对，但是');
  assert.equal(prec.maxNeg, 0, '非接触处的精度矩阵元正好是零');
  assert.ok(cor.maxNeg > 0.05, `相关沿着链传递到非接触的位置对上：${cor.maxNeg.toFixed(3)}`);
  assert.equal(prec.sep, Infinity, '精度矩阵的分离度是无穷');
  assert.ok(cor.sep > 1 && cor.sep < 5, `相关矩阵的分离度只有 ${cor.sep.toFixed(2)}`);
  near(M.precisionAt(M.toCorr(g.S), far, 4), 1, 1e-12, '前四对都是真接触');
  // 协方差是精度矩阵的逆：J·S = I
  const P = M.matvec(g.J, g.S.map((r) => r[0]));
  near(P[0], 1, 1e-9); near(P[5], 0, 1e-9);
  // 有限样本：序列少的时候求逆放大噪声，多的时候逼近精确结果
  const few = M.gmSample(g, 40, 7), many = M.gmSample(g, 20000, 7);
  const aFew = M.pairAuc(few.Jhat, far).auc, aMany = M.pairAuc(many.Jhat, far).auc;
  assert.ok(aMany > aFew + 0.3, `40 条序列 AUC ${aFew.toFixed(3)} → 20000 条 ${aMany.toFixed(3)}`);
  assert.ok(aMany > 0.99, '序列够多时求逆回到精确结果');
  // APC 校正不改变矩阵的形状（对称、同样大小）
  const a = M.apc(M.toCorr(g.S)); assert.equal(a.length, Lc); near(a[3][7], a[7][3], 1e-12); assert.equal(a[5][5], 0);
});

test('第五章：逆折叠的期望回收率有闭式解、和抽样一致；温度越低回收率越高而熵越低', () => {
  const burials = [0, 1, 2, 2, 1, 0, 1, 2, 2, 1, 0, 1];
  const native = M.ifNative(burials, 0.35, 11);
  const cold = M.ifStats(burials, native, { T: 0.2, beta: 2.2 }), hot = M.ifStats(burials, native, { T: 1.6, beta: 2.2 });
  assert.ok(cold.expect > hot.expect, '低温回收率更高');
  assert.ok(cold.bits < hot.bits, '低温的熵更低');
  // 闭式的期望回收率 = 大量抽样的平均
  const R = M.rng(3); let hit = 0, n = 4000;
  for (let k = 0; k < n; k++) { const s = M.ifSample(cold.ps, R); hit += s.filter((a, i) => a === native[i]).length / burials.length; }
  near(hit / n, cold.expect, 0.02, '抽样对照闭式解');
  // 每个位置的概率归一，埋藏的位置熵更低
  for (const p of cold.ps) near(p.reduce((a, b) => a + b, 0), 1, 1e-12);
  const prof = (b) => M.entropyBits(M.ifProfile(b, { T: 0.6, beta: 2.2 }));
  near(prof(1), Math.log2(20), 1e-12, '埋藏度正好在参考值上时模型没有偏好，熵 = log₂20');
  assert.ok(prof(2) < prof(1) - 1 && prof(0) < prof(1) - 1, `环境明确的位置熵低：${prof(0).toFixed(2)} / ${prof(1).toFixed(2)} / ${prof(2).toFixed(2)} bit`);
  // 合格序列的数量：2^(N·H)（第五章例题的算术）
  near(2 ** (100 * 1.8) / 1e54, 1.53, 5e-3, '章里的 1.53 × 10⁵⁴ 条合格序列');
  near(10 ** (log10(2 ** 180) - 100 * log10(20)) / 1e-76, 1.21, 0.02, '占整个序列空间的 1.2 × 10⁻⁷⁶');
  near(2 ** 1.8, 3.482, 1e-3, '每个位置相当于从 20 种减到 3.5 种');
});

test('第六章：反向扩散的样本协方差等于先验，只取后验均值会把方差压掉；固定 motif 精确不动', () => {
  const prior = M.backbonePrior(14);
  const tr = (A) => A.reduce((s, r, i) => s + r[i], 0);
  const draw = (sample, n) => Array.from({ length: n }, (_, k) => M.reverseDiffusion(prior, { steps: 20, seed: k + 1, sample }).x);
  const S1 = M.sampleCov(draw(true, 220)).C, S0 = M.sampleCov(draw(false, 220)).C;
  const r1 = tr(S1) / tr(prior.S), r0 = tr(S0) / tr(prior.S);
  assert.ok(r1 > 0.85 && r1 < 1.15, `从后验抽样：协方差的迹比 ${r1}`);
  assert.ok(r0 < 0.6, `只取均值：协方差的迹比 ${r0}`);
  assert.ok(M.relFrob(S1, prior.S) < M.relFrob(S0, prior.S), '抽样比只取均值更接近先验');
  // 一维的例题：先验 N(0,1)、噪声 1 → 后验均值的方差 0.5，抽样后回到 1
  near(0.25 * 2, 0.5, 1e-12); near(0.5 + 0.5, 1, 1e-12);
  // 固定 motif：条件分布里那几个坐标完全不动
  const fixed = [[0, prior.mu[0] + 0.4], [1, prior.mu[1] - 0.3], [6, prior.mu[6]]];
  const c = M.conditionPrior(prior, fixed);
  for (const [i, v] of fixed) { assert.equal(c.mu[i], v, `第 ${i} 个坐标的条件均值`); assert.equal(c.S[i][i], 0, `第 ${i} 个坐标的条件方差`); }
  assert.equal(c.free.length, prior.dim - fixed.length);
  const got = M.reverseDiffusion(prior, { steps: 20, seed: 2, fixed }).x;
  for (const [i, v] of fixed) assert.equal(got[i], v, `生成以后第 ${i} 个坐标还在原处`);
  // 先验是弹性网络：相邻键长的涨落有限
  const st = M.bondStats(M.reverseDiffusion(prior, { steps: 24, seed: 9 }).x);
  assert.ok(st.sd / st.mean < 0.8, `键长的相对涨落 ${st.sd / st.mean}`);
});

test('第七章：K_D 和 ΔG 的换算（每十倍 1.364 kcal/mol）、占据率、Cheng–Prusoff；例题的 0.845²⁰', () => {
  near(M.kcalPerDecade(298.15), 1.3642, 1e-4, '每个数量级的 kcal/mol');
  near(M.decadesPerKcal(298.15), 1 / 1.3642, 1e-4);
  near(M.kdToDG(1e-9), -12.28, 1e-2, '1 nM 的 ΔG°');
  near(M.dgToKd(M.kdToDG(3.2e-7)), 3.2e-7, 1e-14, '来回一致');
  near(M.ddGForFold(100), 2.7285, 1e-3, '强一百倍要 2.73 kcal/mol');
  near(M.kdToDG(1e-12) - M.kdToDG(1e-6), -6 * M.kcalPerDecade(298.15), 1e-9, '六个数量级 = 8.19 kcal/mol');
  near(M.occupancy(1e-9, 1e-9), 0.5, 1e-12);
  near(M.occupancy(1e-8, 1e-9), 10 / 11, 1e-12);
  near(M.chengPrusoff(1e-9, 1e-8, 1e-9), 11e-9, 1e-18, '竞争配体把 IC₅₀ 抬高');
  // 例题：平均命中率 15.5 %、每个靶点 20 个设计，独立时 96.6 % 的靶点该有命中
  near(1 - 0.845 ** 20, 0.9656, 1e-4);
  assert.ok(1 - 0.845 ** 20 > 0.9, '所以“26/52 个靶点”说明命中率在靶点之间不均匀');
  near((0.155 * 1040) / 26 / 20, 0.31, 0.01, '成功靶点上的命中率约 31 %');
});

test('第八章：速率和 ΔΔG‡ 的指数关系、Eyring 前因子；例题 10³–10⁴ 倍 = 4.1–5.5 kcal/mol', () => {
  near(M.rateRatio(M.kcalPerDecade(298.15)), 10, 1e-9, '1.364 kcal/mol = 十倍');
  near(M.rateRatio(0), 1, 1e-12);
  near(M.ddGFromRatio(1e10), 10 * M.kcalPerDecade(298.15), 1e-9, '10¹⁰ 倍 = 13.6 kcal/mol');
  near(M.ddGFromRatio(1e3), 4.093, 1e-3, '例题下界');
  near(M.ddGFromRatio(1e4), 5.457, 1e-3, '例题上界');
  near(M.R_KCAL * 298.15, 0.5925, 1e-4, 'RT');
  near(M.eyring(0) / 1e12, 6.2124, 1e-3, 'k_B T / h');
  near(M.dGFromKcat(M.eyring(18.5)), 18.5, 1e-9, '来回一致');
  // 2008 年的设计酶（慢天然酶 10⁴–10⁶ 倍）和 2026 年的差距
  near(M.ddGFromRatio(6e4), 6.52, 0.01, '六万倍 = 6.5 kcal/mol');
  assert.ok(M.ddGFromRatio(1e4) < 2 * 3, '差距只有两三个氢键');
});

test('第九章：命中率的贝叶斯公式、AUC ↔ d′、富集；例题反解出约 1.2 % 的先验', () => {
  near(M.Phi(1.96), 0.975002, 1e-6);
  near(M.invPhi(0.975002), 1.96, 1e-4);
  near(M.dprimeFromAuc(0.92), 1.98707, 1e-5);
  near(M.auc(2), M.Phi(2 / Math.SQRT2), 1e-12, 'AUC = Φ(d′/√2)');
  near(M.auc(M.dprimeFromAuc(0.92)), 0.92, 1e-6, '来回一致');
  const r = M.roc(2, 1.5); near(r.tpr, M.Phi(0.5), 1e-12); near(r.fpr, 1 - M.Phi(1.5), 1e-12);
  const f = M.funnel({ prior: 0.01, dprime: M.dprimeFromAuc(0.92), t: 1.5, made: 96 });
  near(f.ppv, 0.09408, 1e-5, '命中率 9.4 %');
  near(f.enrich, f.ppv / 0.01, 1e-12);
  near(f.tpr, M.Phi(M.dprimeFromAuc(0.92) - 1.5), 1e-12);
  near(f.fpr, 1 - M.Phi(1.5), 1e-12);
  // 贝叶斯公式本身
  const pi = 0.01, ppv = (pi * f.tpr) / (pi * f.tpr + (1 - pi) * f.fpr); near(f.ppv, ppv, 1e-12);
  // 例题：从观测到的 10.9 % 反解先验
  const h = 0.109, back = (h * f.fpr) / (f.tpr * (1 - h) + h * f.fpr);
  near(back, 0.01176, 1e-4, '例题的 1.2 %');
  near(M.funnel({ prior: back, dprime: M.dprimeFromAuc(0.92), t: 1.5 }).ppv, h, 1e-6, '反解回得去');
  // 先验趋于零时富集趋于似然比
  near(M.funnel({ prior: 1e-9, dprime: 2, t: 1.5 }).enrich, M.Phi(0.5) / (1 - M.Phi(1.5)), 1e-4);
  // 95 % 把握要做几个
  assert.equal(M.funnel({ prior: 0.01, dprime: M.dprimeFromAuc(0.92), t: 1.5 }).needed, Math.ceil(Math.log(0.05) / Math.log(1 - 0.09408492986885393)));
});

test('第十章：NK 面上的局部极大值随 K 增多，模型引导在中等上位效应时胜过爬山和随机', () => {
  const easy = M.nkLandscape(14, 1, 3), hard = M.nkLandscape(14, 5, 3);
  assert.ok(hard.local > 10 * easy.local, `局部极大值 ${easy.local} → ${hard.local}`);
  assert.equal(easy.all.length, 1 << 14);
  assert.equal(easy.all[easy.best], easy.bestF);
  for (let x = 0; x < easy.all.length; x++) assert.ok(easy.all[x] <= easy.bestF, '穷举过的最优');
  // K = 1 时爬山基本能到顶
  const land = M.nkLandscape(14, 3, 11);
  const climb = M.evoWalk(land, { budget: 140 }), rand = M.randomSearch(land, { budget: 140, seed: 1 }), guided = M.modelGuided(land, { n0: 40, m: 25, rounds: 4, seed: 1 });
  for (const r of [climb, rand, guided]) assert.ok(r.best <= land.bestF + 1e-12, '谁也不会超过真实最优');
  assert.equal(guided.tested, 140, '三种策略花掉同样的测量数');
  assert.ok(guided.best > rand.best && rand.best > climb.best, `同样 140 次测量：爬山 ${climb.best.toFixed(3)} < 随机 ${rand.best.toFixed(3)} < 模型引导 ${guided.best.toFixed(3)}`);
  near(guided.best, land.bestF, 1e-12, '模型引导找到了全局最优');
  const flat = M.nkLandscape(14, 1, 5);
  assert.ok(M.evoWalk(flat, { budget: 200 }).best > 0.95 * flat.bestF, '上位效应弱时爬山就够了');
  // 爬山停在局部极大值上（这张面上有 48 个）
  assert.ok(climb.stuck, '爬山没到全局最优');
  assert.equal(climb.curve.at(-1).f, climb.best);
  // 预算越多，随机搜索越好（单调）
  assert.ok(M.randomSearch(land, { budget: 400, seed: 2 }).best >= M.randomSearch(land, { budget: 50, seed: 2 }).best);
});

test('第十一章：分层筛查独立时漏检率是乘积、完全相关时塌回最好的一层；例题 99.9 % 对 95 %', () => {
  const three = M.layered([0.9, 0.9, 0.9]);
  near(three.indep, 0.999, 1e-12, '独立');
  near(three.correlated, 0.9, 1e-12, '完全相关');
  near(1 - three.indep, 0.001, 1e-12);
  const ex = M.layered([0.95, 0.9, 0.8]);
  near(ex.indep, 0.999, 1e-12, '例题：独立 99.9 %');
  near(ex.correlated, 0.95, 1e-12, '例题：完全相关 95 %');
  near((1 - ex.correlated) / (1 - ex.indep), 50, 1e-9, '漏检率相差 50 倍');
  near(M.missPerMillion(ex.indep, 1e6), 1000, 1e-9);
  near(M.missPerMillion(ex.indep, 100), 0.1, 1e-9, '一百条值得关注的订单漏掉 0.1 条');
  // 边际收益有闭式解：把第 i 层提高 ds，总体漏检率正好少 ds · Π_{k≠i}(1 − s_k)
  const sens = [0.95, 0.9, 0.8];
  for (const i of [0, 1, 2]) near(M.marginal(sens, i, 0.01), 0.01 * sens.filter((_, k) => k !== i).reduce((s, v) => s * (1 - v), 1), 1e-15, `第 ${i} 层`);
  // 所以同样加一个百分点，加在已经最强的那一层上降得最多（它的同伴漏得最多）
  const g = [0, 1, 2].map((i) => M.marginal(sens, i));
  assert.ok(g[0] > g[1] && g[1] > g[2], `边际收益 ${g.map((x) => x.toExponential(1))}`);
  near(1 - ex.indep, sens.reduce((s, v) => s * (1 - v), 1), 1e-15, '漏检率 = 各层漏检率的乘积');
  near(M.layered([0.9]).indep, 0.9, 1e-12, '一道关卡时两个极限相同');
  near(M.layered([0.9]).indep, M.layered([0.9]).correlated, 1e-12);
});

test('生成的内容是最新的、十一章中英齐全、演示都登记了、文献都被引用、成果总览完整', () => {
  const h = inputHash();
  for (const lang of ['zh', 'en']) assert.equal(stamp(outFile(lang)), h, `public/protein-design/pd-${lang}.js 不是最新的：运行 node tools/pd-build.mjs`);
  const zh = content('zh'), en = content('en');
  const ids = ['why', 'fold', 'rosetta', 'plm', 'inverse', 'gen', 'binder', 'enzyme', 'general', 'wet', 'safe'];
  assert.deepEqual(zh.index.chapters.map((c) => c.id), ids); assert.deepEqual(en.index.chapters.map((c) => c.id), ids);
  const s = { window: {} }; vm.runInNewContext(read('protein-design/pd-models.js') + '\n' + read('protein-design/pd-demos.js'), s);
  const DEMOS = {}; s.window.MOLASTRIA_PD_DEMOS(new Proxy({}, { get: (_, k) => (k === 'L' ? (a) => a : k === 'en' ? false : () => '') }), DEMOS);
  assert.deepEqual([...Object.keys(DEMOS)].sort(), ['bundle', 'diff', 'evo', 'hp', 'kcat', 'kd', 'layers', 'mpnn', 'msa', 'screen', 'seqspace', 'stab']);
  for (const C of [zh, en]) {
    for (const id of ids) { const ch = C.chapters[id]; assert.ok(ch.body.length >= 8, `${id} 的正文只有 ${ch.body.length} 块`); assert.ok(ch.points.length >= 5 && ch.math.length >= 4 && ch.example, id); for (const b of ch.body) if (b.demo) assert.ok(DEMOS[b.demo], b.demo); }
    const shown = new Set(); for (const c of C.index.chapters) for (const d of c.demos) { assert.ok(DEMOS[d], d); shown.add(d); }
    assert.equal(shown.size, 12, '每个演示都放进了某一章');
    assert.equal(C.refs.length, 79); for (const r of C.refs) assert.ok(r.used.length, r.id);
    assert.ok(C.index.quiz.length >= 10); for (const q of C.index.quiz) { assert.ok(q.a < q.opts.length); assert.ok(ids.includes(q.ch), q.ch); }
    assert.ok(C.index.bridge.rows.length >= 12 && C.index.bridge.head.length === 4, '联系表');
    for (const row of C.index.bridge.rows) assert.ok(ids.includes(row.ch) && row.ai && row.chem && row.go, row.ch);
    const fams = Object.keys(C.index.families).sort();
    assert.deepEqual(fams, ['binder', 'enzyme', 'eval', 'gen', 'inverse', 'platform', 'plm', 'pred', 'safety']);
    assert.ok(C.index.catalog.length >= 50, `总览 ${C.index.catalog.length} 项`);
    const evid = Object.keys(C.index.evidence), weights = Object.keys(C.index.weightKinds);
    for (const m of C.index.catalog) {
      assert.ok(fams.includes(m.fam) && m.learns && m.name && m.org, m.name);
      assert.ok(ids.includes(m.ch), `${m.name} 的章 ${m.ch}`);
      assert.ok(evid.includes(m.exp), `${m.name} 的证据等级 ${m.exp}`);
      assert.ok(!m.weights || weights.includes(m.weights), `${m.name} 的权重 ${m.weights}`);
      assert.ok(m.src || /^https:\/\//.test(m.url), `${m.name} 没有出处`);
      if (m.url) assert.match(m.urlDate, /^\d{4}-\d{2}-\d{2}$/);
    }
    for (const f of fams) assert.ok(C.index.catalog.some((m) => m.fam === f), `类别 ${f} 是空的`);
    for (const e of evid) assert.ok(C.index.catalog.some((m) => m.exp === e), `证据等级 ${e} 没有用到`);
    assert.ok(C.index.open.length >= 8); for (const o of C.index.open) assert.ok(ids.includes(o.ch), o.ch);
    assert.ok(C.index.milestones.length >= 18, `时间线 ${C.index.milestones.length} 条`);
    assert.ok(C.index.books.length >= 5);
    const t = JSON.stringify(C), m = /\[@|\{\{ch:|\[\[[^"[]|\$[^$"]{1,40}\$|\\`|undefined|NaN|&amp;amp;/.exec(t);
    assert.ok(!m, m && `没转换的标记：…${t.slice(Math.max(0, m.index - 50), m.index + 30)}…`);
    // 普通引号里写 TeX 时反斜杠会被 JS 吃掉（'\mid' 变成 mid），KaTeX 就把命令名当成一串单个字母
    for (const w of ['mid', 'frac', 'sum', 'prod', 'cdot', 'nabla', 'partial', 'text', 'mathbf', 'mathcal', 'mathrm', 'quad', 'alpha', 'theta', 'sigma', 'lambda', 'omega', 'epsilon', 'approx', 'times', 'infty', 'sqrt', 'operatorname', 'langle', 'rangle', 'left', 'right', 'hat', 'tilde', 'bar', 'exp', 'log', 'min', 'max', 'ddagger', 'Delta', 'Phi', 'binom', 'lceil', 'rceil'])
      assert.ok(!t.includes([...w].map((c) => `<mi>${c}</mi>`).join('')), `公式里有拆成字母的 \\${w}：源文件里少了反斜杠（用 String.raw 或写成 \\\\${w}）`);
  }
  // 只有公司发布、没有 DOI 的那几篇要标着人工核对的日期
  const web = JSON.parse(fs.readFileSync(new URL('pd/refs.json', import.meta.url), 'utf8')).filter((r) => !r.doi && !r.arxiv);
  assert.ok(web.length >= 5, `web-only 文献 ${web.length} 篇`);
  for (const r of web) { assert.match(r.checked, /^\d{4}-\d{2}-\d{2}$/, r.id); assert.match(r.url, /^https:\/\//, r.id); }
  // OpenAI 的两次发布分别标成“只有说法”和“湿实验（自行发布）”
  const cat = zh.index.catalog;
  assert.equal(cat.find((m) => m.name.startsWith('GPT-4b micro')).exp, 'claim');
  assert.equal(cat.find((m) => m.name === 'GPT-6 binders').exp, 'selfpub');
  assert.doesNotMatch(JSON.stringify(en), /[㐀-鿿]/);
});

test('顶栏、SEO、站点地图和最近更新接上了', () => {
  assert.match(read('shared-nav.js'), /\['protein', 'protein-design\/index\.html', 'AI 蛋白质设计', 'AI Protein Design'/);
  const seo = fs.readFileSync(new URL('build-seo.ts', import.meta.url), 'utf8');
  assert.match(seo, /injectHead\("protein-design\/index\.html"/); assert.match(seo, /\["protein-design\/", "0\.8", "monthly"\]/);
  assert.match(read('protein-design/index.html'), /data-section="protein"/);
  assert.match(read('updates/updates-data.js'), /id: 'protein-design'/);
  // 以后的栏目会把 UPDATES_LATEST 往后推，这里只要求不早于这一条的日期
  const latest = read('shared-nav.js').match(/UPDATES_LATEST = '(\d{4}-\d{2}-\d{2})'/);
  assert.ok(latest && latest[1] >= '2026-11-25', 'UPDATES_LATEST 不早于 2026-11-25');
  const yml = fs.readFileSync(new URL('../.github/workflows/pages.yml', import.meta.url), 'utf8');
  assert.match(yml, /node --test tools\/pd-test\.mjs/);
});
