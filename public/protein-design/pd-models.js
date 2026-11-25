'use strict';
// AI 蛋白质设计（/protein-design/）十一个演示的数学。全部是纯函数（同一个种子同一个结果），没有 DOM；tools/pd-test.mjs 对照解析解和已知结果测。
// 没有复制任何蛋白质设计程序的代码：每个演示都按论文里的公式自己写成最小的版本（组合计数、HP 格子模型的穷举、疏水矩、
// 高斯图模型和逆协方差、softmax 的逆折叠、高斯先验的扩散和它的精确去噪器、信号检测的贝叶斯、过渡态稳定化的热力学、
// NK 适应度面上的定向进化和模型引导、分层筛查的概率、两态折叠的 Gibbs–Helmholtz）。
(() => {
  // ── 通用工具 ──────────────────────────────────────────────────────────
  const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gauss = (R) => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const variance = (a) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1); };
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb || 1); };
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const logsumexp = (xs) => { const m = Math.max(...xs); return m + Math.log(xs.reduce((s, v) => s + Math.exp(v - m), 0)); };

  // 解线性方程组 A x = b（部分主元的高斯消元）
  function solve(A, b) {
    const n = b.length, M = A.map((r, i) => [...r, b[i]]);
    for (let c = 0; c < n; c++) {
      let p = c; for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      const d = M[c][c] || 1e-300;
      for (let r = c + 1; r < n; r++) { const f = M[r][c] / d; if (f) for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    const x = new Array(n).fill(0);
    for (let r = n - 1; r >= 0; r--) { let s = M[r][n]; for (let k = r + 1; k < n; k++) s -= M[r][k] * x[k]; x[r] = s / (M[r][r] || 1e-300); }
    return x;
  }
  const inv = (A) => { const n = A.length, cols = []; for (let j = 0; j < n; j++) { const e = new Array(n).fill(0); e[j] = 1; cols.push(solve(A, e)); } return Array.from({ length: n }, (_, i) => cols.map((c) => c[i])); };
  const matvec = (A, x) => A.map((r) => dot(r, x));
  // 对称正定矩阵的 Cholesky 分解 A = L Lᵀ
  function chol(A) {
    const n = A.length, L = Array.from({ length: n }, () => new Array(n).fill(0));
    for (let i = 0; i < n; i++) for (let j = 0; j <= i; j++) {
      let s = A[i][j]; for (let k = 0; k < j; k++) s -= L[i][k] * L[j][k];
      if (i === j) L[i][i] = Math.sqrt(Math.max(s, 1e-300)); else L[i][j] = s / (L[j][j] || 1e-300);
    }
    return L;
  }
  // 对称矩阵的本征分解（Jacobi 转动），本征值从大到小
  function eigSym(S) {
    const n = S.length, A = S.map((r) => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-24) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const theta = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(theta || 1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
    return { values: idx.map((i) => A[i][i]), vecs: idx.map((i) => V.map((row) => row[i])) };
  }
  // 误差函数和标准正态分布（Abramowitz–Stegun 7.1.26 的精度不够，这里用连分数展开的 erfc）
  function erf(x) {
    const z = Math.abs(x), t = 1 / (1 + 0.5 * z);
    const y = t * Math.exp(-z * z - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807
      + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277)))))))));
    return x >= 0 ? 1 - y : y - 1;
  }
  const Phi = (x) => 0.5 * (1 + erf(x / Math.SQRT2));
  const lgamma = (x) => { // Lanczos 近似
    const g = [676.5203681218851, -1259.1392167224028, 771.32342877765313, -176.61502916214059, 12.507343278686905, -0.13857109526572012, 9.9843695780195716e-6, 1.5056327351493116e-7];
    if (x < 0.5) return Math.log(Math.PI / Math.sin(Math.PI * x)) - lgamma(1 - x);
    let y = x - 1, a = 0.99999999999980993, t = y + 7.5;
    for (let i = 0; i < 8; i++) a += g[i] / (y + i + 1);
    return 0.5 * Math.log(2 * Math.PI) + (y + 0.5) * Math.log(t) - t + Math.log(a);
  };
  const logChoose = (n, k) => (k < 0 || k > n ? -Infinity : lgamma(n + 1) - lgamma(k + 1) - lgamma(n - k + 1));
  const LOG10 = Math.LN10;

  // ── 1. 序列空间有多大（精确的组合计数）────────────────────────────────
  // 长度 N 的序列共 20^N 条；和一条给定序列相差 d 个位置的有 C(N, d)·19^d 条。
  const log10Seqs = (N) => (N * Math.log(20)) / LOG10;
  const log10Shell = (N, d) => (logChoose(N, d) + d * Math.log(19)) / LOG10;
  const log10Ball = (N, d) => logsumexp(Array.from({ length: d + 1 }, (_, k) => logChoose(N, k) + k * Math.log(19))) / LOG10;
  // 一个库能覆盖多少：库里有 10^logLib 条随机序列，落进“和目标相差 ≤ d”这个球里的期望条数
  const log10Covered = (N, d, logLib) => logLib + log10Ball(N, d) - log10Seqs(N);
  // 随机序列里有多少能折叠：按“每个位置独立地有 pOK 的概率合格”这种最粗的估计，只用来说明量级
  const log10Folding = (N, pOK) => (N * Math.log(pOK)) / LOG10 + log10Seqs(N);

  // ── 2. HP 格子模型：折叠容易，设计难（穷举，精确）──────────────────────
  // 正方格子上长度 N 的自回避行走。reduced：只保留每个形状的一个代表（第一步朝 +x，第一个转弯朝 +y）。
  function sawWalks(N, reduced = true) {
    const out = [], xs = new Int8Array(N), ys = new Int8Array(N), seen = new Set();
    const key = (x, y) => (x + 64) * 256 + (y + 64);
    seen.add(key(0, 0));
    const DIR = [[1, 0], [0, 1], [-1, 0], [0, -1]];
    (function step(i, turned) {
      if (i === N) { out.push({ x: Array.from(xs.slice(0, N)), y: Array.from(ys.slice(0, N)) }); return; }
      for (let d = 0; d < 4; d++) {
        if (reduced && i === 1 && d !== 0) continue; // 第一步朝 +x
        const nx = xs[i - 1] + DIR[d][0], ny = ys[i - 1] + DIR[d][1], k = key(nx, ny);
        if (seen.has(k)) continue;
        // 第一次不沿 +x 走的时候只允许朝 +y（去掉上下镜像）
        const isTurn = !turned && i > 1 && d !== 0;
        if (reduced && isTurn && d !== 1) continue;
        seen.add(k); xs[i] = nx; ys[i] = ny;
        step(i + 1, turned || isTurn);
        seen.delete(k);
      }
    })(1, false);
    return out;
  }
  const sawCount = (N, reduced = true) => sawWalks(N, reduced).length;
  // 每个构象的拓扑接触：|i − j| > 2 而且格点相邻
  function contactsOf(w) {
    const out = [], n = w.x.length;
    for (let i = 0; i < n; i++) for (let j = i + 3; j < n; j++) if (Math.abs(w.x[i] - w.x[j]) + Math.abs(w.y[i] - w.y[j]) === 1) out.push([i, j]);
    return out;
  }
  // 一次性准备好所有构象和它们的接触掩码（按位：第 i 位是第 i 个单体）
  function hpStructures(N) {
    const walks = sawWalks(N, true);
    return walks.map((w) => { const cs = contactsOf(w); return { w, contacts: cs, masks: cs.map(([i, j]) => (1 << i) | (1 << j)) }; });
  }
  // 能量：每一对接触的 H–H 得 −1（Lau–Dill 的 HP 模型）。seq 是按位的疏水标记。
  const hpEnergy = (seqMask, st) => { let e = 0; for (const m of st.masks) if ((seqMask & m) === m) e--; return e; };
  // 一条序列折叠成什么：基态能量、简并度（= 1 才算“设计得出来”）、一个基态构象的编号
  function hpFold(seqMask, STS) {
    let best = Infinity, deg = 0, at = -1;
    for (let s = 0; s < STS.length; s++) { const e = hpEnergy(seqMask, STS[s]); if (e < best) { best = e; deg = 1; at = s; } else if (e === best) deg++; }
    return { E: best, deg, at };
  }
  // 可设计性：把全部 2^N 条序列过一遍，统计有多少条有唯一基态，以及每个构象被多少条序列唯一地折叠出来
  function hpDesignability(N) {
    const STS = hpStructures(N), count = new Array(STS.length).fill(0);
    let unique = 0, total = 1 << N;
    for (let s = 0; s < total; s++) { const f = hpFold(s, STS); if (f.deg === 1 && f.E < 0) { unique++; count[f.at]++; } }
    const order = count.map((c, i) => [c, i]).sort((a, b) => b[0] - a[0]);
    return { STS, count, unique, total, uniqueFrac: unique / total, top: order.slice(0, 12), maxCount: order[0][0] };
  }
  // 埋藏度：每个单体在格子上有几个非相邻的邻居（0–2），逆折叠演示用它当“环境”
  function burialOf(w) {
    const n = w.x.length, out = new Array(n).fill(0);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (Math.abs(i - j) > 1 && Math.abs(w.x[i] - w.x[j]) + Math.abs(w.y[i] - w.y[j]) === 1) out[i]++;
    return out;
  }

  // ── 3. 螺旋束：疏水矩和周期性（精确几何）──────────────────────────────
  // Eisenberg 等 1984 的归一化共识疏水标度
  const EISENBERG = { A: 0.62, R: -2.53, N: -0.78, D: -0.90, C: 0.29, Q: -0.85, E: -0.74, G: 0.48, H: -0.40, I: 1.38, L: 1.06, K: -1.50, M: 0.64, F: 1.19, P: 0.12, S: -0.18, T: -0.05, W: 0.81, Y: 0.26, V: 1.08 };
  const hydro = (seq) => [...seq].map((c) => EISENBERG[c] ?? 0);
  // 疏水矩：μ(δ) = |Σ Hᵢ e^{i δ i}| / N（δ 是每个残基绕螺旋轴转过的角度）
  function hydroMoment(H, degPerRes) {
    const d = (degPerRes * Math.PI) / 180;
    let cx = 0, cy = 0;
    H.forEach((h, i) => { cx += h * Math.cos(d * i); cy += h * Math.sin(d * i); });
    return Math.hypot(cx, cy) / (H.length || 1);
  }
  const momentCurve = (H, degs) => degs.map((d) => hydroMoment(H, d));
  const bestAngle = (H, lo = 60, hi = 200, n = 1401) => { const degs = lin(lo, hi, n), m = momentCurve(H, degs); let k = 0; for (let i = 1; i < m.length; i++) if (m[i] > m[k]) k = i; return { deg: degs[k], mu: m[k] }; };
  // 几个教科书式的序列：七肽重复的螺旋束（a 和 d 位疏水）、交替的 β 链、全疏水的跨膜螺旋、随机
  function makeSeq(kind, n = 28, seed = 1) {
    const R = rng(seed), polar = 'EKQRSD', apolar = 'LIVFM';
    const pick = (s) => s[Math.floor(R() * s.length)];
    let out = '';
    for (let i = 0; i < n; i++) {
      if (kind === 'coil') out += (i % 7 === 0 || i % 7 === 3) ? pick(apolar) : pick(polar);
      else if (kind === 'sheet') out += i % 2 === 0 ? pick(apolar) : pick(polar);
      else if (kind === 'tm') out += pick(apolar);
      else out += pick(apolar + polar);
    }
    return out;
  }
  // 理想 α 螺旋的 Cα 坐标（半径 2.3 Å、每残基升高 1.5 Å、转 100°）
  const helixCA = (n, { r = 2.3, rise = 1.5, deg = 100 } = {}) => Array.from({ length: n }, (_, i) => { const a = (deg * Math.PI * i) / 180; return [r * Math.cos(a), r * Math.sin(a), rise * i]; });
  const helixPitch = ({ rise = 1.5, deg = 100 } = {}) => (rise * 360) / deg;

  // ── 4. 协同进化：相关不等于接触（高斯图模型，精确）────────────────────
  // 一条“蛋白质”有 L 个位置，真实的耦合只在接触的位置之间（精度矩阵 J 是稀疏的），
  // 观测到的相关（协方差 = J⁻¹）却是稠密的。把协方差反过来求逆，就只剩下真实的接触，这就是 DCA 的道理。
  const CHAIN = (L) => Array.from({ length: L - 1 }, (_, i) => [i, i + 1]);
  function gmModel(L, contacts, w = 0.45, diag = 1) {
    const J = Array.from({ length: L }, () => new Array(L).fill(0));
    for (let i = 0; i < L; i++) J[i][i] = diag;
    for (const [i, j] of contacts) { J[i][j] = -w; J[j][i] = -w; J[i][i] += w; J[j][j] += w; }
    return { L, contacts, J, S: inv(J) };
  }
  const toCorr = (S) => S.map((row, i) => row.map((v, j) => v / Math.sqrt(S[i][i] * S[j][j])));
  // 平均积分修正（APC）：减掉每个位置自己的平均偏好
  function apc(Mat) {
    const L = Mat.length, A = Mat.map((r) => r.map(Math.abs));
    for (let i = 0; i < L; i++) A[i][i] = 0;
    const rowMean = A.map((r) => mean(r)), all = mean(rowMean);
    return A.map((r, i) => r.map((v, j) => (i === j ? 0 : v - (rowMean[i] * rowMean[j]) / (all || 1))));
  }
  // 从协方差抽 n 条“序列”（多元正态），再估一次协方差；shrink 是收缩系数（数据少时必须加）
  function gmSample(model, n, seed = 1, shrink = 0.1) {
    const L = model.L, Lc = chol(model.S), R = rng(seed), X = [];
    for (let s = 0; s < n; s++) { const z = Array.from({ length: L }, () => gauss(R)); X.push(matvec(Lc, z)); }
    const mu = Array.from({ length: L }, (_, i) => mean(X.map((x) => x[i])));
    const C = Array.from({ length: L }, () => new Array(L).fill(0));
    for (const x of X) for (let i = 0; i < L; i++) for (let j = 0; j < L; j++) C[i][j] += ((x[i] - mu[i]) * (x[j] - mu[j])) / Math.max(1, n - 1);
    const tr = mean(C.map((r, i) => r[i]));
    const Cs = C.map((r, i) => r.map((v, j) => (1 - shrink) * v + (i === j ? shrink * tr : 0)));
    return { X, C, Cs, Jhat: inv(Cs) };
  }
  // 取分数最高的 k 对（只看 |i − j| ≥ 2 的“长程”对），看有几对真的是接触
  function topPairs(Mat, k, minSep = 2) {
    const L = Mat.length, list = [];
    for (let i = 0; i < L; i++) for (let j = i + minSep; j < L; j++) list.push([Mat[i][j], i, j]);
    list.sort((a, b) => b[0] - a[0]);
    return list.slice(0, k).map(([v, i, j]) => [i, j, v]);
  }
  const precisionAt = (Mat, contacts, k, minSep = 2) => {
    const set = new Set(contacts.map(([i, j]) => `${Math.min(i, j)}-${Math.max(i, j)}`));
    const top = topPairs(Mat, k, minSep);
    return top.filter(([i, j]) => set.has(`${Math.min(i, j)}-${Math.max(i, j)}`)).length / Math.max(1, top.length);
  };
  // 把“接触对”和“非接触对”的分数分开看：AUC = 1 表示任何阈值都能把两堆分开；
  // sep = 最小的接触分数 ÷ 最大的非接触分数，> 1 就是干净分开。精确的精度矩阵在非接触处正好是 0，
  // 所以 sep 大到机器精度；相关矩阵做不到，因为相关会沿着链“传递”。
  function pairAuc(Mat, contacts, minSep = 2) {
    const set = new Set(contacts.map(([i, j]) => `${Math.min(i, j)}-${Math.max(i, j)}`));
    const pos = [], neg = [], L = Mat.length;
    for (let i = 0; i < L; i++) for (let j = i + minSep; j < L; j++) (set.has(`${i}-${j}`) ? pos : neg).push(Math.abs(Mat[i][j]));
    let c = 0, t = 0;
    for (const p of pos) for (const q of neg) { t++; c += p > q ? 1 : p === q ? 0.5 : 0; }
    const minPos = pos.length ? Math.min(...pos) : 0, maxNeg = neg.length ? Math.max(...neg) : 0;
    return { auc: t ? c / t : 0, nPos: pos.length, nNeg: neg.length, minPos, maxNeg, sep: minPos / Math.max(maxNeg, Number.MIN_VALUE) };
  }

  // ── 5. 逆折叠：给骨架写序列（softmax 的玩具模型）──────────────────────
  // 每个位置的环境只用“埋藏度”概括；模型给出 p(残基 | 埋藏度) ∝ exp((β·h·(b − b₀) + bias)/T)。
  const AA20 = Object.keys(EISENBERG);
  function ifProfile(burial, { T = 1, beta = 2.2, b0 = 1, bias = 0 } = {}) {
    const logits = AA20.map((a) => (beta * EISENBERG[a] * (burial - b0) + bias * (EISENBERG[a] < 0 ? 1 : 0)) / Math.max(1e-6, T));
    const m = Math.max(...logits), ex = logits.map((v) => Math.exp(v - m)), z = ex.reduce((s, v) => s + v, 0);
    return ex.map((v) => v / z);
  }
  const entropyBits = (p) => -p.reduce((s, v) => s + (v > 0 ? v * Math.log2(v) : 0), 0);
  // “天然”序列：用低温的同一个模型抽一次，当作要回收的答案
  const ifNative = (burials, seed = 1, T = 0.35) => { const R = rng(seed); return burials.map((b) => { const p = ifProfile(b, { T }), u = R(); let c = 0; for (let i = 0; i < p.length; i++) { c += p[i]; if (u <= c) return i; } return p.length - 1; }); };
  // 期望回收率（解析：Σᵢ pᵢ(天然残基)）、取最大值的回收率、每个位置的熵
  function ifStats(burials, native, opt = {}) {
    const ps = burials.map((b) => ifProfile(b, opt));
    const expect = mean(ps.map((p, i) => p[native[i]]));
    const argmax = mean(ps.map((p, i) => (p.indexOf(Math.max(...p)) === native[i] ? 1 : 0)));
    const H = ps.map(entropyBits);
    return { ps, expect, argmax, bits: mean(H), logSeqs: H.reduce((s, v) => s + v, 0) / Math.log2(10) };
  }
  const ifSample = (ps, R) => ps.map((p) => { const u = R(); let c = 0; for (let i = 0; i < p.length; i++) { c += p[i]; if (u <= c) return i; } return p.length - 1; });

  // ── 6. 扩散生成骨架（高斯先验 + 精确去噪器）──────────────────────────
  // 先验：一条 n 个“残基”的骨架在平面上，均值是理想的螺旋投影，精度矩阵 = a·I + c·DᵀD（D 是二阶差分），
  // 所以涨落是平滑的（弹性网络）。高斯先验下最优去噪器有闭式解，反向扩散抽出来的样本精确服从先验。
  function backbonePrior(n = 20, { a = 1.2, c = 60, turns = 2.2, rad = 1 } = {}) {
    const dim = 2 * n, mu = new Array(dim).fill(0);
    for (let i = 0; i < n; i++) { const t = (2 * Math.PI * turns * i) / (n - 1); mu[2 * i] = rad * Math.cos(t) * (0.55 + (0.45 * i) / (n - 1)); mu[2 * i + 1] = rad * Math.sin(t) * (0.55 + (0.45 * i) / (n - 1)); }
    const J = Array.from({ length: dim }, () => new Array(dim).fill(0));
    for (let i = 0; i < dim; i++) J[i][i] += a;
    for (let i = 1; i + 1 < n; i++) for (const k of [0, 1]) { // 二阶差分：x_{i-1} − 2x_i + x_{i+1}
      const idx = [2 * (i - 1) + k, 2 * i + k, 2 * (i + 1) + k], w = [1, -2, 1];
      for (let p = 0; p < 3; p++) for (let q = 0; q < 3; q++) J[idx[p]][idx[q]] += c * w[p] * w[q];
    }
    return { n, dim, mu, J, S: inv(J) };
  }
  const mvnSample = (mu, S, R) => { const e = eigSym(S), z = e.values.map((v) => Math.sqrt(Math.max(v, 0)) * gauss(R)); return mu.map((m, i) => m + e.vecs.reduce((s, v, k) => s + v[i] * z[k], 0)); };
  // 余弦式的噪声表：ᾱ(t) 从 1 降到接近 0
  const abar = (t, Tn) => Math.cos((Math.PI / 2) * Math.min(1, Math.max(0, t / Tn))) ** 2;
  const diffuseTo = (x0, t, Tn, R) => { const ab = abar(t, Tn), s = Math.sqrt(1 - ab); return x0.map((v) => Math.sqrt(ab) * v + s * gauss(R)); };
  // 精确的后验均值 E[x₀ | x_t]：先验 N(μ, Σ)，x_t = √ᾱ x₀ + √(1−ᾱ) ε
  function denoise(prior, xt, t, Tn, { iso = false, fixed = null, draw = null } = {}) {
    const ab = abar(t, Tn), s2 = Math.max(1e-9, 1 - ab), dim = prior.dim;
    const J = iso ? Array.from({ length: dim }, (_, i) => Array.from({ length: dim }, (_, j) => (i === j ? 1 : 0))) : prior.J;
    const mu = iso ? new Array(dim).fill(0) : prior.mu;
    const A = J.map((row, i) => row.map((v, j) => v + (i === j ? ab / s2 : 0)));
    const b = matvec(J, mu).map((v, i) => v + (Math.sqrt(ab) * xt[i]) / s2);
    let x0 = solve(A, b);
    // draw 给了随机数发生器时，从后验 N(m, A⁻¹) 抽一条，而不是只取后验均值。
    // 只取均值会把方差吃掉（真实扩散模型“过度平滑”的来源），抽样才精确服从先验。
    if (draw) { const Lc = chol(inv(A)), z = Array.from({ length: dim }, () => gauss(draw)), d = matvec(Lc, z); x0 = x0.map((v, i) => v + d[i]); }
    if (fixed) for (const [i, v] of fixed) x0[i] = v; // motif：固定下来的原子每一步都按住
    return x0;
  }
  // 反向扩散（DDPM 式的祖先采样）：每一步用去噪器给出的 x̂₀ 再加回 t−1 步的噪声
  // sample = true：每一步从后验抽样（样本精确服从先验）；false：每一步只用后验均值（样本偏平滑）
  function reverseDiffusion(prior, { steps = 24, Tn = 24, seed = 1, iso = false, fixed = null, sample = true } = {}) {
    const R = rng(seed), dim = prior.dim, draw = sample ? R : null;
    let x = Array.from({ length: dim }, () => gauss(R));
    if (fixed) for (const [i, v] of fixed) x[i] = v;
    const path = [x.slice()], hats = [];
    for (let k = steps; k > 0; k--) {
      const t = (k * Tn) / steps, tPrev = ((k - 1) * Tn) / steps;
      const x0 = denoise(prior, x, t, Tn, { iso, fixed, draw });
      hats.push(x0.slice());
      const ab = abar(tPrev, Tn);
      x = x0.map((v) => Math.sqrt(ab) * v + Math.sqrt(1 - ab) * gauss(R));
      if (fixed) for (const [i, v] of fixed) x[i] = v;
      path.push(x.slice());
    }
    const x0 = denoise(prior, x, (0.03 * Tn) / steps, Tn, { iso, fixed, draw });
    path.push(x0.slice());
    hats.push(x0.slice());
    return { x: x0, path, hats };
  }
  // 条件分布（motif scaffolding）：固定一部分坐标，其余的精确高斯条件分布
  function conditionPrior(prior, fixed) {
    const dim = prior.dim, fi = fixed.map(([i]) => i), fv = fixed.map(([, v]) => v);
    const free = Array.from({ length: dim }, (_, i) => i).filter((i) => !fi.includes(i));
    const Saa = free.map((i) => free.map((j) => prior.S[i][j])), Sab = free.map((i) => fi.map((j) => prior.S[i][j]));
    const Sbb = fi.map((i) => fi.map((j) => prior.S[i][j])), Sbbi = inv(Sbb);
    const d = fv.map((v, k) => v - prior.mu[fi[k]]);
    const corrMu = Sab.map((row) => dot(matvec(Sbbi, d), row));
    const mu = new Array(dim).fill(0), S = Array.from({ length: dim }, () => new Array(dim).fill(0));
    fixed.forEach(([i, v]) => { mu[i] = v; });
    free.forEach((i, k) => { mu[i] = prior.mu[i] + corrMu[k]; });
    const Mid = Sab.map((row) => matvec(Sbbi, row));
    free.forEach((i, k) => free.forEach((j, l) => { S[i][j] = Saa[k][l] - dot(Mid[k], fi.map((_, q) => Sab[l][q])); }));
    return { n: prior.n, dim, mu, S, free, fixed };
  }
  // 骨架好不好：相邻“残基”的间距有多均匀（真实的程序看键长、键角和碰撞）
  function bondStats(x) {
    const n = x.length / 2, d = [];
    for (let i = 0; i + 1 < n; i++) d.push(Math.hypot(x[2 * i + 2] - x[2 * i], x[2 * i + 3] - x[2 * i + 1]));
    return { mean: mean(d), sd: Math.sqrt(variance(d)), rough: Math.sqrt(variance(d)) / (mean(d) || 1) };
  }
  // 一组样本的协方差（检验反向扩散抽的样本是不是真的服从先验）
  function sampleCov(samples) {
    const dim = samples[0].length, mu = Array.from({ length: dim }, (_, i) => mean(samples.map((x) => x[i])));
    const C = Array.from({ length: dim }, () => new Array(dim).fill(0));
    for (const x of samples) for (let i = 0; i < dim; i++) for (let j = 0; j < dim; j++) C[i][j] += ((x[i] - mu[i]) * (x[j] - mu[j])) / Math.max(1, samples.length - 1);
    return { mu, C };
  }
  const relFrob = (A, B) => { let num = 0, den = 0; for (let i = 0; i < A.length; i++) for (let j = 0; j < A.length; j++) { num += (A[i][j] - B[i][j]) ** 2; den += B[i][j] ** 2; } return Math.sqrt(num / (den || 1)); };

  // ── 7. 筛选的贝叶斯：把计算的分数变成实验的命中率（精确）──────────────
  // 信号检测模型：真能结合的设计分数 ~ N(d′, 1)，不能结合的 ~ N(0, 1)。
  const roc = (dprime, t) => ({ tpr: 1 - Phi(t - dprime), fpr: 1 - Phi(t) });
  const auc = (dprime) => Phi(dprime / Math.SQRT2);
  const dprimeFromAuc = (a) => Math.SQRT2 * invPhi(Math.min(0.999999, Math.max(0.5, a)));
  function invPhi(p) { // 二分法够用（只在界面上用）
    let lo = -8, hi = 8;
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (Phi(m) < p) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }
  function funnel({ prior = 0.01, dprime = 2, t = 1.5, made = 100 } = {}) {
    const { tpr, fpr } = roc(dprime, t);
    const ppv = (prior * tpr) / (prior * tpr + (1 - prior) * fpr || 1e-300);
    const keptFrac = prior * tpr + (1 - prior) * fpr;
    return { tpr, fpr, ppv, keptFrac, enrich: ppv / prior, hits: made * ppv, auc: auc(dprime),
      needed: ppv > 0 && ppv < 1 ? Math.ceil(Math.log(0.05) / Math.log(1 - ppv)) : ppv >= 1 ? 1 : Infinity,
      neededNaive: prior > 0 && prior < 1 ? Math.ceil(Math.log(0.05) / Math.log(1 - prior)) : Infinity };
  }


  // ── 7b. 亲和力：K_D 和自由能（精确热力学）──────────────────────────────
  const kdToDG = (kd_M, T = 298.15) => R_KCAL * T * Math.log(kd_M); // ΔG°（负值越大结合越强）
  const dgToKd = (dG, T = 298.15) => Math.exp(dG / (R_KCAL * T));
  const occupancy = (conc_M, kd_M) => conc_M / (conc_M + kd_M);
  const ddGForFold = (fold, T = 298.15) => R_KCAL * T * Math.log(fold); // 亲和力提高 fold 倍需要多少 kcal/mol
  // Cheng–Prusoff：和天然配体竞争时，测到的 IC₅₀ 和真正的 K_i 的关系
  const chengPrusoff = (ki_M, ligand_M, kdLigand_M) => ki_M * (1 + ligand_M / kdLigand_M);

  // ── 8. 催化：过渡态稳定化和速率（精确热力学）──────────────────────────
  const R_KCAL = 1.98720425864083e-3; // kcal/(mol·K)
  const rateRatio = (ddG, T = 298.15) => Math.exp(ddG / (R_KCAL * T)); // ΔΔG‡ 以 kcal/mol 计，正值表示降低了垒
  const decadesPerKcal = (T = 298.15) => 1 / (R_KCAL * T * Math.LN10);
  const kcalPerDecade = (T = 298.15) => R_KCAL * T * Math.LN10;
  const ddGFromRatio = (ratio, T = 298.15) => R_KCAL * T * Math.log(ratio);
  // 过渡态理论的一级速率常数（k_B T/h · e^{−ΔG‡/RT}），只用来把 kcal/mol 换成 s⁻¹ 的量级
  const eyring = (dG, T = 298.15) => (2.083661912e10 * T) * Math.exp(-dG / (R_KCAL * T));
  const dGFromKcat = (kcat, T = 298.15) => R_KCAL * T * Math.log((2.083661912e10 * T) / Math.max(1e-300, kcat));

  // ── 9. 定向进化和模型引导（NK 适应度面，数值实验）──────────────────────
  // L 个位置、每个位置两种残基；每个位置的贡献由它自己和 K 个邻居决定（Kauffman 的 NK 模型）。
  function nkLandscape(L = 12, K = 2, seed = 1) {
    const R = rng(seed), tab = [];
    for (let i = 0; i < L; i++) { const m = 1 << (K + 1), t = new Float64Array(m); for (let k = 0; k < m; k++) t[k] = R(); tab.push(t); }
    const f = (x) => { let s = 0; for (let i = 0; i < L; i++) { let idx = 0; for (let k = 0; k <= K; k++) idx = (idx << 1) | ((x >> ((i + k) % L)) & 1); s += tab[i][idx]; } return s / L; };
    const all = new Float64Array(1 << L); for (let x = 0; x < 1 << L; x++) all[x] = f(x);
    let best = 0; for (let x = 1; x < 1 << L; x++) if (all[x] > all[best]) best = x;
    let local = 0;
    for (let x = 0; x < 1 << L; x++) { let isLocal = true; for (let i = 0; i < L; i++) if (all[x ^ (1 << i)] > all[x]) { isLocal = false; break; } if (isLocal) local++; }
    return { L, K, f, all, best, bestF: all[best], local };
  }
  // 定向进化：每一轮测当前最好序列的全部 L 个单点突变，走到最好的那个（每轮 L 次测量）
  function evoWalk(land, { start = 0, budget = 120 } = {}) {
    const L = land.L; let x = start, used = 1, curve = [{ n: used, f: land.all[x] }];
    while (used + L <= budget) {
      let bx = x, bf = land.all[x];
      for (let i = 0; i < L; i++) { const y = x ^ (1 << i); if (land.all[y] > bf) { bf = land.all[y]; bx = y; } }
      used += L;
      curve.push({ n: used, f: bf });
      if (bx === x) break; // 到了局部极大，再测也不动
      x = bx;
    }
    return { curve, best: Math.max(...curve.map((p) => p.f)), stuck: curve.at(-1).f < land.bestF };
  }
  // 模型引导：先随机测 n₀ 条，拟合（一次项，可选二次项）的岭回归，预测全部序列，再测预测最好的 m 条，循环
  function modelGuided(land, { n0 = 40, m = 10, rounds = 4, pair = false, seed = 1 } = {}) {
    const L = land.L, R = rng(seed), feats = (x) => { const v = [1]; for (let i = 0; i < L; i++) v.push((x >> i) & 1); if (pair) for (let i = 0; i < L; i++) for (let j = i + 1; j < L; j++) v.push(((x >> i) & 1) * ((x >> j) & 1)); return v; };
    const seen = new Map(), add = (x) => { if (!seen.has(x)) seen.set(x, land.all[x]); };
    for (let i = 0; i < n0; i++) add(Math.floor(R() * (1 << L)));
    const curve = [{ n: seen.size, f: Math.max(...seen.values()) }];
    for (let r = 0; r < rounds; r++) {
      const X = [...seen.keys()].map(feats), y = [...seen.values()], p = X[0].length;
      const A = Array.from({ length: p }, () => new Array(p).fill(0)), b = new Array(p).fill(0);
      for (let n = 0; n < X.length; n++) for (let i = 0; i < p; i++) { for (let j = 0; j < p; j++) A[i][j] += X[n][i] * X[n][j]; b[i] += X[n][i] * y[n]; }
      for (let i = 0; i < p; i++) A[i][i] += 1e-3 * X.length;
      const w = solve(A, b);
      const pred = []; for (let x = 0; x < 1 << L; x++) if (!seen.has(x)) pred.push([dot(feats(x), w), x]);
      pred.sort((a, c) => c[0] - a[0]);
      for (let i = 0; i < m && i < pred.length; i++) add(pred[i][1]);
      curve.push({ n: seen.size, f: Math.max(...seen.values()) });
    }
    return { curve, best: Math.max(...seen.values()), tested: seen.size };
  }
  function randomSearch(land, { budget = 120, seed = 1 } = {}) {
    const R = rng(seed), L = land.L, curve = []; let best = -Infinity;
    for (let i = 1; i <= budget; i++) { best = Math.max(best, land.all[Math.floor(R() * (1 << L))]); if (i % 10 === 0 || i === 1) curve.push({ n: i, f: best }); }
    return { curve, best };
  }

  // ── 10. 分层筛查：为什么一层不够，以及相关失效会吃掉分层的好处（精确）──
  const layered = (sens) => { const indep = 1 - sens.reduce((s, v) => s * (1 - v), 1); return { indep, correlated: Math.max(0, ...sens), weakest: Math.min(...sens), strongest: Math.max(...sens) }; };
  const missPerMillion = (p, n = 1e6) => n * (1 - p);
  // 把一层的灵敏度从 s 提到 s + ds，总体漏检率下降多少（边际收益）
  const marginal = (sens, i, ds = 0.01) => { const a = layered(sens).indep, b = layered(sens.map((v, k) => (k === i ? Math.min(1, v + ds) : v))).indep; return b - a; };

  // ── 11. 稳定性：ΔΔG 和熔解温度（两态折叠，精确）────────────────────────
  // Gibbs–Helmholtz：ΔG(T) = ΔH_m(1 − T/T_m) − ΔC_p[(T_m − T) + T ln(T/T_m)]，ΔG > 0 表示折叠态更稳定
  const dGunfold = (T, { Tm = 330, dHm = 90, dCp = 1.5 } = {}) => dHm * (1 - T / Tm) - dCp * ((Tm - T) + T * Math.log(T / Tm));
  const foldedFrac = (T, p) => 1 / (1 + Math.exp(-dGunfold(T, p) / (R_KCAL * T)));
  // 加上 ΔΔG（kcal/mol）以后的新 T_m：解 ΔG(T) + ΔΔG = 0（二分法）
  function tmShift(ddG, p = {}) {
    const q = { Tm: 330, dHm: 90, dCp: 1.5, ...p };
    const g = (T) => dGunfold(T, q) + ddG;
    let lo = q.Tm, hi = q.Tm;
    if (g(q.Tm) > 0) { hi = q.Tm + 1; while (g(hi) > 0 && hi < 600) hi += 1; } else { lo = q.Tm - 1; while (g(lo) < 0 && lo > 200) lo -= 1; }
    for (let i = 0; i < 200; i++) { const m = (lo + hi) / 2; if (g(m) > 0) lo = m; else hi = m; }
    const Tnew = (lo + hi) / 2;
    return { Tm: Tnew, dTm: Tnew - q.Tm, approx: (ddG * q.Tm) / q.dHm };
  }
  // 几个突变加起来：addFrac = 1 是完全可加，小于 1 表示有递减（上位效应）
  const stack = (ddGs, addFrac = 1) => ddGs.reduce((s, v, i) => s + v * addFrac ** i, 0);

  window.MOLASTRIA_PD_MODELS = {
    rng, gauss, mean, variance, dot, corr, lin, logsumexp, solve, inv, matvec, chol, eigSym, erf, Phi, invPhi, lgamma, logChoose,
    log10Seqs, log10Shell, log10Ball, log10Covered, log10Folding,
    sawWalks, sawCount, contactsOf, hpStructures, hpEnergy, hpFold, hpDesignability, burialOf,
    EISENBERG, hydro, hydroMoment, momentCurve, bestAngle, makeSeq, helixCA, helixPitch,
    CHAIN, gmModel, toCorr, apc, gmSample, topPairs, precisionAt, pairAuc,
    AA20, ifProfile, entropyBits, ifNative, ifStats, ifSample,
    backbonePrior, mvnSample, abar, diffuseTo, denoise, reverseDiffusion, conditionPrior, bondStats, sampleCov, relFrob,
    roc, auc, dprimeFromAuc, funnel, kdToDG, dgToKd, occupancy, ddGForFold, chengPrusoff,
    R_KCAL, rateRatio, decadesPerKcal, kcalPerDecade, ddGFromRatio, eyring, dGFromKcat,
    nkLandscape, evoWalk, modelGuided, randomSearch,
    layered, missPerMillion, marginal,
    dGunfold, foldedFrac, tmShift, stack,
  };
})();
