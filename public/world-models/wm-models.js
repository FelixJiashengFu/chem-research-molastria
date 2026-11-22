'use strict';
// 世界模型（/world-models/）十三个演示的数学。全部是纯函数（同一个种子同一个结果），没有 DOM；tools/wm-test.mjs 对照解析解和已知结果测。
// 没有复制任何世界模型程序的代码：每个演示都按论文里的公式自己写成最小的版本（线性回归、PCA、卡尔曼滤波、Dyna-Q、CEM、慢特征、k-means、DMD、
// 力匹配、SINDy、条件高斯传播器、高斯过程和机理模型拟合、自助法集成）。
(() => {
  // ── 通用工具 ──────────────────────────────────────────────────────────
  const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gauss = (R) => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const variance = (a) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1); };
  const dot = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const corr = (a, b) => { const ma = mean(a), mb = mean(b); let sab = 0, saa = 0, sbb = 0; for (let i = 0; i < a.length; i++) { sab += (a[i] - ma) * (b[i] - mb); saa += (a[i] - ma) ** 2; sbb += (b[i] - mb) ** 2; } return sab / Math.sqrt(saa * sbb || 1); };
  // 解线性方程组 A x = b（部分主元的高斯消元，A 会被复制）
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
  // 最小二乘：行是特征 Φ，目标 Y（每列一个），岭 λ；返回每列的系数
  function lstsq(Phi, Ys, ridge = 1e-10) {
    const p = Phi[0].length, A = Array.from({ length: p }, () => new Array(p).fill(0)), B = Ys.map(() => new Array(p).fill(0));
    for (let n = 0; n < Phi.length; n++) { const f = Phi[n]; for (let i = 0; i < p; i++) { const fi = f[i]; if (!fi) continue; for (let j = i; j < p; j++) A[i][j] += fi * f[j]; for (let k = 0; k < Ys.length; k++) B[k][i] += fi * Ys[k][n]; } }
    let tr = 0; for (let i = 0; i < p; i++) tr += A[i][i];
    for (let i = 0; i < p; i++) { for (let j = 0; j < i; j++) A[i][j] = A[j][i]; A[i][i] += ridge * (tr / p + 1e-12); }
    return B.map((b) => solve(A, b));
  }
  // 对称矩阵的本征分解（Jacobi 转动），本征值从大到小，vecs[k] 是第 k 个本征向量
  function eigSym(S) {
    const n = S.length, A = S.map((r) => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += A[i][j] ** 2;
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((a, b) => A[b][b] - A[a][a]);
    return { values: idx.map((i) => A[i][i]), vecs: idx.map((i) => V.map((r) => r[i])) };
  }
  // 复数小工具和一般实矩阵的本征值（复数的带位移 QR 迭代，矩阵最多二三十阶）
  const C = { add: (a, b) => [a[0] + b[0], a[1] + b[1]], sub: (a, b) => [a[0] - b[0], a[1] - b[1]], mul: (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]], div: (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; }, abs: (a) => Math.hypot(a[0], a[1]), conj: (a) => [a[0], -a[1]], sqrt: (a) => { const r = Math.hypot(a[0], a[1]), x = Math.sqrt((r + a[0]) / 2), y = Math.sign(a[1] || 1) * Math.sqrt(Math.max(0, (r - a[0]) / 2)); return [x, y]; }, log: (a) => [Math.log(Math.hypot(a[0], a[1])), Math.atan2(a[1], a[0])] };
  function eigGeneral(Ain) {
    let n = Ain.length;
    let A = Ain.map((r) => r.map((v) => [v, 0]));
    const out = [];
    let guard = 0;
    while (n > 0 && guard++ < 5000) {
      if (n === 1) { out.push(A[0][0]); break; }
      // 末行的次对角元够小就把最后一个本征值取下来
      if (C.abs(A[n - 1][n - 2]) < 1e-12 * (C.abs(A[n - 1][n - 1]) + C.abs(A[n - 2][n - 2]) + 1e-300)) { out.push(A[n - 1][n - 1]); A = A.slice(0, n - 1).map((r) => r.slice(0, n - 1)); n--; continue; }
      // Wilkinson 位移：右下 2×2 块里离 a_nn 近的那个本征值
      const a = A[n - 2][n - 2], b = A[n - 2][n - 1], c = A[n - 1][n - 2], d = A[n - 1][n - 1];
      const tr = C.add(a, d), det = C.sub(C.mul(a, d), C.mul(b, c)), disc = C.sqrt(C.sub(C.mul(tr, tr), C.mul([4, 0], det)));
      const l1 = C.div(C.add(tr, disc), [2, 0]), l2 = C.div(C.sub(tr, disc), [2, 0]);
      let mu = C.abs(C.sub(l1, d)) < C.abs(C.sub(l2, d)) ? l1 : l2;
      if (guard % 37 === 0) mu = C.add(mu, [1e-3 * (C.abs(d) + 1), 1e-3]); // 偶尔扰一下，防止卡住
      // A − μI = QR（Gram–Schmidt），A ← RQ + μI
      const M = A.map((r, i) => r.map((v, j) => (i === j ? C.sub(v, mu) : v)));
      const Q = [], R = Array.from({ length: n }, () => Array.from({ length: n }, () => [0, 0]));
      for (let j = 0; j < n; j++) {
        let v = M.map((r) => r[j].slice());
        for (let k = 0; k < j; k++) { let s = [0, 0]; for (let i = 0; i < n; i++) s = C.add(s, C.mul(C.conj(Q[k][i]), v[i])); R[k][j] = s; for (let i = 0; i < n; i++) v[i] = C.sub(v[i], C.mul(s, Q[k][i])); }
        const nv = Math.sqrt(v.reduce((s, z) => s + z[0] * z[0] + z[1] * z[1], 0)) || 1e-300;
        R[j][j] = [nv, 0]; Q.push(v.map((z) => [z[0] / nv, z[1] / nv]));
      }
      A = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => { let s = [0, 0]; for (let k = 0; k < n; k++) s = C.add(s, C.mul(R[i][k], Q[j][k])); return i === j ? C.add(s, mu) : s; }));
    }
    return out;
  }
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));

  // ── 1. 单摆：真实动力学、从数据学一个模型、开环推演 ───────────────────
  // θ'' = −sin θ − γ θ' + u。状态 [θ, ω]，一步 Δt 用 RK4。
  function pendDeriv(s, u, g) { return [s[1], -Math.sin(s[0]) - g * s[1] + u]; }
  function pendStep(s, u, dt = 0.1, g = 0.1) {
    const k1 = pendDeriv(s, u, g), k2 = pendDeriv([s[0] + 0.5 * dt * k1[0], s[1] + 0.5 * dt * k1[1]], u, g), k3 = pendDeriv([s[0] + 0.5 * dt * k2[0], s[1] + 0.5 * dt * k2[1]], u, g), k4 = pendDeriv([s[0] + dt * k3[0], s[1] + dt * k3[1]], u, g);
    return [s[0] + (dt / 6) * (k1[0] + 2 * k2[0] + 2 * k3[0] + k4[0]), s[1] + (dt / 6) * (k1[1] + 2 * k2[1] + 2 * k3[1] + k4[1])];
  }
  // 特征：kind = 'poly'（θ、ω、u 的多项式，次数 deg）或 'trig'（物理上对的特征：sin θ、cos θ、ω、u 和它们的少数乘积）
  function pendFeatures(s, u, kind, deg) {
    const [t, w] = s;
    if (kind === 'trig') { const sn = Math.sin(t), cs = Math.cos(t); return [1, sn, cs, w, u, sn * w, cs * w, w * w, sn * cs]; }
    const f = [1];
    for (let a = 0; a <= deg; a++) for (let b = 0; a + b <= deg; b++) { if (a + b === 0) continue; f.push(t ** a * w ** b); }
    f.push(u);
    return f;
  }
  // 训练数据：在 |θ| ≤ box、|ω| ≤ 1.5 里随机取状态和力矩，记下真实的下一步
  function pendData(n, box, seed, umax = 0.5) {
    const R = rng(seed), X = [];
    for (let i = 0; i < n; i++) { const s = [(2 * R() - 1) * box, (2 * R() - 1) * 1.5], u = (2 * R() - 1) * umax; X.push({ s, u, s1: pendStep(s, u) }); }
    return X;
  }
  function pendFit(data, kind, deg, ridge = 1e-8) {
    const Phi = data.map((d) => pendFeatures(d.s, d.u, kind, deg));
    const W = lstsq(Phi, [data.map((d) => d.s1[0] - d.s[0]), data.map((d) => d.s1[1] - d.s[1])], ridge);
    return { kind, deg, W };
  }
  const pendModelStep = (m, s, u) => { const f = pendFeatures(s, u, m.kind, m.deg); return [s[0] + dot(m.W[0], f), s[1] + dot(m.W[1], f)]; };
  function rollout(step, s0, H, u = () => 0) { const out = [s0]; let s = s0; for (let k = 0; k < H; k++) { s = step(s, u(k, s)); if (!Number.isFinite(s[0]) || Math.abs(s[0]) > 1e6) { out.push([NaN, NaN]); break; } out.push(s); } return out; }
  function oneStepRMSE(m, data) { let e = 0; for (const d of data) { const p = pendModelStep(m, d.s, d.u); e += (p[0] - d.s1[0]) ** 2 + (p[1] - d.s1[1]) ** 2; } return Math.sqrt(e / data.length / 2); }

  // ── 2. 潜空间：一维“图像”上的高斯斑点和 PCA ───────────────────────────
  const BLOB_N = 48;
  const blob = (p, w, n = BLOB_N) => Array.from({ length: n }, (_, i) => Math.exp(-0.5 * (((i + 0.5) / n - p) / w) ** 2));
  function blobSet(m, seed, wFixed = 0) {
    const R = rng(seed), out = [];
    for (let i = 0; i < m; i++) { const p = 0.15 + 0.7 * R(), w = wFixed || 0.035 + 0.06 * R(); out.push({ p, w, x: blob(p, w) }); }
    return out;
  }
  function pca(X) {
    const n = X[0].length, mu = new Array(n).fill(0);
    for (const x of X) for (let i = 0; i < n; i++) mu[i] += x[i] / X.length;
    const S = Array.from({ length: n }, () => new Array(n).fill(0));
    for (const x of X) for (let i = 0; i < n; i++) { const a = x[i] - mu[i]; for (let j = i; j < n; j++) S[i][j] += (a * (x[j] - mu[j])) / (X.length - 1); }
    for (let i = 0; i < n; i++) for (let j = 0; j < i; j++) S[i][j] = S[j][i];
    const e = eigSym(S);
    return { mu, values: e.values.map((v) => Math.max(0, v)), vecs: e.vecs, total: e.values.reduce((s, v) => s + Math.max(0, v), 0) };
  }
  const pcaEncode = (P, x, k) => P.vecs.slice(0, k).map((v) => dot(v, x.map((xi, i) => xi - P.mu[i])));
  const pcaDecode = (P, z) => P.mu.map((m, i) => m + z.reduce((s, zk, k) => s + zk * P.vecs[k][i], 0));
  const explained = (P, k) => P.values.slice(0, k).reduce((s, v) => s + v, 0) / P.total;

  // ── 3. 卡尔曼滤波：匀速运动的粒子，含噪声的观测，看不到以后的“做梦” ─────
  // x = [位置, 速度]，x' = F x + w，w ~ N(0, Q)，Q 是连续白噪声加速度（强度 q）；观测 y = 位置 + v，v ~ N(0, r²)
  function kalmanRun({ q = 0.05, r = 0.5, dt = 0.1, T = 200, stop = 140, seed = 1 }) {
    const R = rng(seed), F = [[1, dt], [0, 1]], Q = [[(q * dt ** 3) / 3, (q * dt ** 2) / 2], [(q * dt ** 2) / 2, q * dt]];
    const L = (() => { const a = Math.sqrt(Q[0][0]), b = Q[0][1] / a, c = Math.sqrt(Math.max(0, Q[1][1] - b * b)); return [[a, 0], [b, c]]; })();
    let x = [0, 1], m = [0, 0], P = [[1, 0], [0, 1]];
    const out = [];
    for (let k = 0; k < T; k++) {
      // 真实体系往前走
      const z1 = gauss(R), z2 = gauss(R);
      x = [x[0] + dt * x[1] + L[0][0] * z1, x[1] + L[1][0] * z1 + L[1][1] * z2];
      const y = x[0] + r * gauss(R);
      // 预测
      m = [m[0] + dt * m[1], m[1]];
      P = [[P[0][0] + dt * (P[1][0] + P[0][1]) + dt * dt * P[1][1] + Q[0][0], P[0][1] + dt * P[1][1] + Q[0][1]], [P[1][0] + dt * P[1][1] + Q[1][0], P[1][1] + Q[1][1]]];
      let K = [0, 0];
      if (k < stop) { // 有观测就更新
        const S = P[0][0] + r * r; K = [P[0][0] / S, P[1][0] / S];
        const inn = y - m[0];
        m = [m[0] + K[0] * inn, m[1] + K[1] * inn];
        P = [[(1 - K[0]) * P[0][0], (1 - K[0]) * P[0][1]], [P[1][0] - K[1] * P[0][0], P[1][1] - K[1] * P[0][1]]];
      }
      out.push({ t: (k + 1) * dt, x: x.slice(), y: k < stop ? y : NaN, m: m.slice(), sd: Math.sqrt(Math.max(0, P[0][0])), K: K[0] });
    }
    return out;
  }
  // 稳态卡尔曼增益：把预测协方差的 Riccati 递推迭代到收敛
  function kalmanSteady({ q = 0.05, r = 0.5, dt = 0.1 }) {
    const Q = [[(q * dt ** 3) / 3, (q * dt ** 2) / 2], [(q * dt ** 2) / 2, q * dt]];
    let P = [[1, 0], [0, 1]], K = 0;
    for (let i = 0; i < 20000; i++) {
      const Pp = [[P[0][0] + dt * (P[1][0] + P[0][1]) + dt * dt * P[1][1] + Q[0][0], P[0][1] + dt * P[1][1] + Q[0][1]], [P[1][0] + dt * P[1][1] + Q[1][0], P[1][1] + Q[1][1]]];
      const S = Pp[0][0] + r * r, K0 = Pp[0][0] / S, K1 = Pp[1][0] / S;
      P = [[(1 - K0) * Pp[0][0], (1 - K0) * Pp[0][1]], [Pp[1][0] - K1 * Pp[0][0], Pp[1][1] - K1 * Pp[0][1]]];
      if (Math.abs(K0 - K) < 1e-15) { K = K0; break; }
      K = K0;
    }
    return K;
  }

  // ── 4. Dyna-Q：Sutton 的迷宫（6 × 9），每走一步在模型里再“想” n 步 ────────
  const MAZE = { rows: 6, cols: 9, start: [2, 0], goal: [0, 8], walls: ['1,2', '2,2', '3,2', '4,5', '0,7', '1,7', '2,7'] };
  const MOVES = [[-1, 0], [1, 0], [0, -1], [0, 1]];
  function mazeStep(s, a) {
    const r = s[0] + MOVES[a][0], c = s[1] + MOVES[a][1];
    if (r < 0 || c < 0 || r >= MAZE.rows || c >= MAZE.cols || MAZE.walls.includes(`${r},${c}`)) return s;
    return [r, c];
  }
  const isGoal = (s) => s[0] === MAZE.goal[0] && s[1] === MAZE.goal[1];
  function mazeShortest() {
    const key = (s) => `${s[0]},${s[1]}`, seen = { [key(MAZE.start)]: 0 }, q = [MAZE.start];
    while (q.length) { const s = q.shift(); if (isGoal(s)) return seen[key(s)]; for (let a = 0; a < 4; a++) { const t = mazeStep(s, a); if (!(key(t) in seen)) { seen[key(t)] = seen[key(s)] + 1; q.push(t); } } }
    return Infinity;
  }
  // 跑 episodes 个回合，返回每回合的步数和最后的 Q
  function dynaQ({ n = 5, episodes = 50, seed = 1, alpha = 0.1, gamma = 0.95, eps = 0.1, maxSteps = 4000 }) {
    const R = rng(seed), S = MAZE.rows * MAZE.cols, id = (s) => s[0] * MAZE.cols + s[1];
    const Q = Array.from({ length: S }, () => [0, 0, 0, 0]), model = new Map(), seenKeys = [];
    const greedy = (q) => { const m = Math.max(...q), best = [0, 1, 2, 3].filter((a) => q[a] === m); return best[Math.floor(R() * best.length)]; };
    const steps = [];
    let modelTotal = 0;
    for (let ep = 0; ep < episodes; ep++) {
      let s = MAZE.start, k = 0;
      while (!isGoal(s) && k < maxSteps) {
        const a = R() < eps ? Math.floor(R() * 4) : greedy(Q[id(s)]);
        const s1 = mazeStep(s, a), r = isGoal(s1) ? 1 : 0;
        Q[id(s)][a] += alpha * (r + (isGoal(s1) ? 0 : gamma * Math.max(...Q[id(s1)])) - Q[id(s)][a]);
        const key = id(s) * 4 + a;
        if (!model.has(key)) seenKeys.push(key);
        model.set(key, [id(s1), r, isGoal(s1)]);
        for (let j = 0; j < n; j++) { // 在学到的模型里想象：随机挑一个见过的 (状态, 动作)
          const kk = seenKeys[Math.floor(R() * seenKeys.length)], [t1, rr, done] = model.get(kk), ss = Math.floor(kk / 4), aa = kk % 4;
          Q[ss][aa] += alpha * (rr + (done ? 0 : gamma * Math.max(...Q[t1])) - Q[ss][aa]);
          modelTotal++;
        }
        s = s1; k++;
      }
      steps.push(k);
    }
    return { steps, Q, modelUpdates: modelTotal };
  }
  function dynaAverage(n, episodes, runs, seed0 = 1) { const acc = new Array(episodes).fill(0); for (let r = 0; r < runs; r++) { const { steps } = dynaQ({ n, episodes, seed: seed0 + 97 * r }); steps.forEach((v, i) => { acc[i] += v / runs; }); } return acc; }
  function greedyPath(Q, limit = 60) { const id = (s) => s[0] * MAZE.cols + s[1], path = [MAZE.start]; let s = MAZE.start; for (let k = 0; k < limit && !isGoal(s); k++) { const q = Q[id(s)], a = q.indexOf(Math.max(...q)); s = mazeStep(s, a); path.push(s); } return path; }

  // ── 5. 用模型规划：交叉熵法（CEM）做模型预测控制，把单摆甩上去 ─────────────
  const wrap = (t) => { let x = (t + Math.PI) % (2 * Math.PI); if (x < 0) x += 2 * Math.PI; return x - Math.PI; }; // 到 (−π, π]
  const upCost = (s, u) => { const d = wrap(s[0] - Math.PI); return d * d + 0.1 * s[1] * s[1] + 0.01 * u * u; };
  function cemPlan(step, s0, warm, { H = 25, N = 64, iters = 4, elite = 8, umax = 0.5, R }) {
    let mu = warm.slice(0, H); while (mu.length < H) mu.push(0);
    let sd = new Array(H).fill(umax);
    let best = null;
    for (let it = 0; it < iters; it++) {
      const cand = [];
      for (let k = 0; k < N; k++) {
        const us = mu.map((m, i) => Math.max(-umax, Math.min(umax, m + sd[i] * gauss(R))));
        let s = s0, J = 0;
        for (let i = 0; i < H; i++) { s = step(s, us[i]); if (!Number.isFinite(s[0])) { J = Infinity; break; } J += upCost(s, us[i]); }
        cand.push({ us, J });
      }
      cand.sort((a, b) => a.J - b.J);
      const el = cand.slice(0, elite);
      if (!best || el[0].J < best.J) best = el[0];
      mu = mu.map((_, i) => mean(el.map((c) => c.us[i])));
      sd = sd.map((_, i) => Math.max(0.02, Math.sqrt(variance(el.map((c) => c.us[i])))));
    }
    return { u: best.us, J: best.J };
  }
  // 一整段控制：每一步重新规划，只执行第一个动作（模型预测控制）
  function mpcRun(plannerStep, { steps = 200, seed = 1, s0 = [0.05, 0], umax = 0.5 } = {}) {
    const R = rng(seed), traj = [s0], us = [];
    let s = s0, warm = [];
    for (let k = 0; k < steps; k++) {
      const plan = cemPlan(plannerStep, s, warm, { R, umax });
      const u = plan.u[0];
      s = pendStep(s, u); traj.push(s); us.push(u);
      warm = plan.u.slice(1);
    }
    return { traj, us };
  }
  const upTime = (traj, dt = 0.1, tol = 0.25) => { for (let k = 0; k < traj.length; k++) { if (Math.abs(wrap(traj[k][0] - Math.PI)) < tol && traj.slice(k, k + 20).every((s) => Math.abs(wrap(s[0] - Math.PI)) < tol)) return k * dt; } return NaN; };

  // ── 6. 预测像素还是预测表示：慢变量、噪声和表示塌缩 ─────────────────────────
  // 观测 x_t = Q·[s_t, σ n_t]：s 是一个慢的 AR(1)（φ），n 是 D − 1 维白噪声；Q 是随机正交矩阵
  function randomOrtho(D, R) { const V = []; for (let i = 0; i < D; i++) { let v = Array.from({ length: D }, () => gauss(R)); for (const u of V) { const p = dot(u, v); v = v.map((x, k) => x - p * u[k]); } const nv = Math.sqrt(dot(v, v)); V.push(v.map((x) => x / nv)); } return V; }
  function jepaData({ D = 8, T = 2000, phi = 0.98, noise = 1, seed = 1 }) {
    const R = rng(seed), Q = randomOrtho(D, R), s = [], X = [];
    let z = 0;
    for (let t = 0; t < T; t++) {
      z = phi * z + Math.sqrt(1 - phi * phi) * gauss(R); s.push(z);
      const h = [z, ...Array.from({ length: D - 1 }, () => noise * gauss(R))];
      X.push(Q.map((_, i) => h.reduce((acc, hk, k) => acc + Q[k][i] * hk, 0)));
    }
    return { s, X, D };
  }
  // 像素层面：最好的线性预测 x_{t+1} ≈ A x_t，返回 R²（可预测的方差占总方差的比例）
  function pixelR2(X) {
    const D = X[0].length, Phi = X.slice(0, -1).map((x) => [...x, 1]);
    const W = lstsq(Phi, Array.from({ length: D }, (_, i) => X.slice(1).map((x) => x[i])), 1e-9);
    let se = 0, st = 0;
    for (let i = 0; i < D; i++) { const ys = X.slice(1).map((x) => x[i]), m = mean(ys); for (let t = 0; t < Phi.length; t++) { se += (ys[t] - dot(W[i], Phi[t])) ** 2; st += (ys[t] - m) ** 2; } }
    return 1 - se / st;
  }
  // 表示层面：编码 z = w·x，预测 z_{t+1} ≈ z_t。梯度下降，reg = 0 时没有任何防塌缩的项；reg > 0 时加 VICReg 式的方差项 reg·max(0, 1 − std z)²
  function jepaTrain(X, { reg = 1, iters = 600, lr = 0.1, seed = 2 }) {
    const R = rng(seed), D = X[0].length, T = X.length;
    let w = Array.from({ length: D }, () => gauss(R)); const n0 = Math.sqrt(dot(w, w)); w = w.map((v) => v / n0);
    const hist = [];
    for (let it = 0; it <= iters; it++) {
      const z = X.map((x) => dot(w, x)), mz = mean(z), sd = Math.sqrt(variance(z));
      let pred = 0; const g = new Array(D).fill(0);
      for (let t = 0; t < T - 1; t++) { const e = z[t + 1] - z[t]; pred += (e * e) / (T - 1); for (let i = 0; i < D; i++) g[i] += (2 * e * (X[t + 1][i] - X[t][i])) / (T - 1); }
      if (reg > 0 && sd < 1) { // d std / d w = cov(z, x) / std
        for (let i = 0; i < D; i++) { let c = 0; for (let t = 0; t < T; t++) c += ((z[t] - mz) * X[t][i]) / (T - 1); g[i] += reg * 2 * (sd - 1) * (c / (sd || 1e-12)); }
      }
      hist.push({ it, pred, sd, loss: pred + (reg > 0 ? reg * Math.max(0, 1 - sd) ** 2 : 0) });
      if (it < iters) w = w.map((v, i) => v - lr * g[i]);
    }
    return { w, hist, z: X.map((x) => dot(w, x)) };
  }
  // 慢特征分析：在 var(w·x) = 1 的约束下让 var(w·Δx) 最小，是一个广义本征问题；返回最慢的方向
  function sfa(X) {
    const D = X[0].length, T = X.length, mu = new Array(D).fill(0);
    for (const x of X) for (let i = 0; i < D; i++) mu[i] += x[i] / T;
    const cov = (rows) => { const S = Array.from({ length: D }, () => new Array(D).fill(0)); for (const r of rows) for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) S[i][j] += (r[i] * r[j]) / rows.length; return S; };
    const Cx = cov(X.map((x) => x.map((v, i) => v - mu[i]))), Cd = cov(X.slice(1).map((x, t) => x.map((v, i) => v - X[t][i])));
    const e = eigSym(Cx), Wh = e.vecs.map((v, k) => v.map((x) => x / Math.sqrt(e.values[k]))); // 白化
    const M = Wh.map((a) => Wh.map((b) => { let s = 0; for (let i = 0; i < D; i++) for (let j = 0; j < D; j++) s += a[i] * Cd[i][j] * b[j]; return s; }));
    const f = eigSym(M), y = f.vecs[f.vecs.length - 1]; // 最小的本征值
    return Array.from({ length: D }, (_, i) => Wh.reduce((s, row, k) => s + y[k] * row[i], 0));
  }

  // ── 7. 潜在动作：只看视频、不知道按了什么键，能不能找回动作？（Genie 的思路）──────
  // 8 × 12 的画面，一个亮点按 5 种动作走（上、下、左、右、不动），撞墙就停；画面上撒噪声
  const LA = { rows: 8, cols: 12, acts: [[-1, 0], [1, 0], [0, -1], [0, 1], [0, 0]] };
  function laVideo({ T = 400, noise = 0.2, seed = 1 }) {
    const R = rng(seed), frames = [], acts = [];
    let p = [4, 6];
    const draw = (q) => { const f = Array.from({ length: LA.rows * LA.cols }, () => noise * R()); for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) { const r = q[0] + dr, c = q[1] + dc; if (r >= 0 && c >= 0 && r < LA.rows && c < LA.cols) f[r * LA.cols + c] += dr || dc ? 0.45 : 1; } return f; };
    frames.push(draw(p));
    for (let t = 0; t < T; t++) {
      const a = Math.floor(R() * 5), d = LA.acts[a], q = [Math.max(0, Math.min(LA.rows - 1, p[0] + d[0])), Math.max(0, Math.min(LA.cols - 1, p[1] + d[1]))];
      acts.push({ a, moved: q[0] !== p[0] || q[1] !== p[1] }); p = q; frames.push(draw(p));
    }
    return { frames, acts };
  }
  // 两帧之间的“动作特征”：亮度重心的位移（扣掉噪声的平均亮度）
  function laFeature(f0, f1) {
    const cen = (f) => { const m = mean(f); let w = 0, r = 0, c = 0; f.forEach((v, i) => { const x = Math.max(0, v - m - 0.05); w += x; r += x * Math.floor(i / LA.cols); c += x * (i % LA.cols); }); return [r / (w || 1), c / (w || 1)]; };
    const a = cen(f0), b = cen(f1); return [b[0] - a[0], b[1] - a[1]];
  }
  function kmeans(P, K, seed = 1, iters = 50) {
    const R = rng(seed), d2 = (a, b) => (a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2;
    const cen = [P[Math.floor(R() * P.length)].slice()];
    while (cen.length < K) { const ds = P.map((p) => Math.min(...cen.map((c) => d2(p, c)))), tot = ds.reduce((s, v) => s + v, 0); let u = R() * tot, i = 0; while (i < P.length - 1 && (u -= ds[i]) > 0) i++; cen.push(P[i].slice()); }
    let lab = new Array(P.length).fill(0);
    for (let it = 0; it < iters; it++) {
      lab = P.map((p) => { let b = 0; for (let k = 1; k < K; k++) if (d2(p, cen[k]) < d2(p, cen[b])) b = k; return b; });
      for (let k = 0; k < K; k++) { const mine = P.filter((_, i) => lab[i] === k); if (mine.length) cen[k] = [mean(mine.map((p) => p[0])), mean(mine.map((p) => p[1]))]; }
    }
    return { lab, cen };
  }
  // 纯度：每个簇按它里面最多的真实动作算对；撞墙没动的那几步按“不动”算
  function laPurity(lab, acts, K) {
    const tab = Array.from({ length: K }, () => [0, 0, 0, 0, 0]);
    lab.forEach((k, i) => { tab[k][acts[i].moved ? acts[i].a : 4]++; });
    return { tab, purity: tab.reduce((s, r) => s + Math.max(...r), 0) / lab.length };
  }

  // ── 8. DMD：从快照里学一个线性算子（一维周期的对流扩散方程）─────────────────
  // u_t + c u_x = D u_xx，x ∈ [0, 2π)，N 个格点；初值是几个傅里叶模；解析解按模演化
  function advdiff({ N = 64, c = 1, D = 0.02, modes = [1, 2, 3], dt = 0.1, m = 40, seed = 1, noise = 0 }) {
    const R = rng(seed), amp = modes.map(() => [gauss(R), gauss(R)]), x = lin(0, 2 * Math.PI, N + 1).slice(0, N);
    const at = (t) => x.map((xi) => modes.reduce((s, k, j) => { const dec = Math.exp(-D * k * k * t), ph = k * (xi - c * t); return s + dec * (amp[j][0] * Math.cos(ph) + amp[j][1] * Math.sin(ph)); }, 0));
    const snaps = Array.from({ length: m + 1 }, (_, i) => at(i * dt).map((v) => v + noise * gauss(R)));
    const exact = modes.flatMap((k) => [[-D * k * k, -c * k], [-D * k * k, c * k]]); // 连续时间本征值 ω = −Dk² ∓ i c k
    return { x, snaps, at, exact, dt };
  }
  function dmd(snaps, r, dt) {
    const N = snaps[0].length, m = snaps.length - 1;
    const X = snaps.slice(0, m), Y = snaps.slice(1); // 每个元素是一列（长度 N）
    // X 的薄 SVD：先对 XᵀX（m × m）做本征分解
    const G = X.map((a) => X.map((b) => dot(a, b))), e = eigSym(G);
    const rr = Math.min(r, e.values.filter((v) => v > 1e-12 * e.values[0]).length);
    const sig = e.values.slice(0, rr).map(Math.sqrt), V = e.vecs.slice(0, rr); // V[k] 长度 m
    const U = V.map((v, k) => Array.from({ length: N }, (_, i) => X.reduce((s, col, j) => s + col[i] * v[j], 0) / sig[k]));
    // Ã = Uᵀ Y V Σ⁻¹（r × r）
    const UY = U.map((u) => Y.map((col) => dot(u, col))); // r × m
    const At = U.map((_, i) => V.map((v, k) => dot(UY[i], v) / sig[k]));
    const mu = eigGeneral(At);
    const omega = mu.map((z) => { const l = C.log(z); return [l[0] / dt, l[1] / dt]; });
    // 预测：x_{k+1} = U Ã Uᵀ x_k（在 r 维子空间里走）
    const predict = (x0, steps) => { let z = U.map((u) => dot(u, x0)); const out = []; for (let s = 0; s < steps; s++) { z = At.map((row) => dot(row, z)); out.push(Array.from({ length: N }, (_, i) => z.reduce((acc, zk, k) => acc + zk * U[k][i], 0))); } return out; };
    return { mu, omega, predict, r: rr, sig };
  }
  // 两组复数本征值之间的最大配对误差（贪心配对）
  function eigMatchError(found, exact) {
    const left = exact.slice(); let worst = 0;
    for (const z of found) { let b = 0; for (let i = 1; i < left.length; i++) if (Math.hypot(z[0] - left[i][0], z[1] - left[i][1]) < Math.hypot(z[0] - left[b][0], z[1] - left[b][1])) b = i; if (!left.length) break; worst = Math.max(worst, Math.hypot(z[0] - left[b][0], z[1] - left[b][1])); left.splice(b, 1); }
    return worst;
  }

  // ── 9. 学出来的粒子模拟器：从力学习对势（力匹配），再拿去跑 ───────────────────
  // 二维 7 个 Lennard-Jones 原子（ε = σ = 1），外面一个软的球形墙把它们关在一起
  const LJ = (r) => 4 * (r ** -12 - r ** -6), dLJ = (r) => 4 * (-12 * r ** -13 + 6 * r ** -7);
  const WALL = 2.2;
  const PF = { centers: lin(0.9, 2.6, 24), width: 0.08, rc: 2.8 };
  const bump = (r, k) => Math.exp(-0.5 * ((r - PF.centers[k]) / PF.width) ** 2);
  const dbump = (r, k) => (-(r - PF.centers[k]) / PF.width ** 2) * bump(r, k);
  const cut = (r) => (r < PF.rc ? (1 - (r / PF.rc) ** 2) ** 2 : 0), dcut = (r) => (r < PF.rc ? (-4 * r / PF.rc ** 2) * (1 - (r / PF.rc) ** 2) : 0);
  // 学到的对势：U(r) = 先验(r) + cut(r) Σ c_k φ_k(r)；先验是 r⁻¹² 的排斥（prior 为真时）
  const prior = (r, on) => (on ? 4 * r ** -12 : 0), dprior = (r, on) => (on ? -48 * r ** -13 : 0);
  const learnedU = (m, r) => prior(r, m.prior) + cut(r) * m.c.reduce((s, ck, k) => s + ck * bump(r, k), 0);
  const learnedDU = (m, r) => dprior(r, m.prior) + m.c.reduce((s, ck, k) => s + ck * (dcut(r) * bump(r, k) + cut(r) * dbump(r, k)), 0);
  function pfForces(x, dU) {
    const N = x.length / 2, f = new Array(2 * N).fill(0); let U = 0;
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const dx = x[2 * i] - x[2 * j], dy = x[2 * i + 1] - x[2 * j + 1], r = Math.hypot(dx, dy), g = dU.d(r) / r;
      U += dU.u(r); f[2 * i] -= g * dx; f[2 * i + 1] -= g * dy; f[2 * j] += g * dx; f[2 * j + 1] += g * dy;
    }
    for (let i = 0; i < N; i++) { const r = Math.hypot(x[2 * i], x[2 * i + 1]); if (r > WALL) { const k = 5 * (r - WALL); U += 2.5 * (r - WALL) ** 2; f[2 * i] -= (k * x[2 * i]) / r; f[2 * i + 1] -= (k * x[2 * i + 1]) / r; } }
    return { f, U };
  }
  const TRUE_PAIR = { u: LJ, d: dLJ };
  function pfInit(N = 7) { const x = [0, 0]; for (let k = 0; k < N - 1; k++) { const a = (2 * Math.PI * k) / (N - 1); x.push(1.12 * Math.cos(a), 1.12 * Math.sin(a)); } return x; }
  // Langevin（BAOAB 的简化版）：给训练数据用
  function pfLangevin(x, v, pair, T, dt, steps, R, gamma = 1) {
    const N = x.length / 2, c1 = Math.exp(-gamma * dt), c2 = Math.sqrt((1 - c1 * c1) * T);
    let F = pfForces(x, pair).f;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < 2 * N; i++) v[i] += 0.5 * dt * F[i];
      for (let i = 0; i < 2 * N; i++) x[i] += 0.5 * dt * v[i];
      for (let i = 0; i < 2 * N; i++) v[i] = c1 * v[i] + c2 * gauss(R);
      for (let i = 0; i < 2 * N; i++) x[i] += 0.5 * dt * v[i];
      F = pfForces(x, pair).f;
      for (let i = 0; i < 2 * N; i++) v[i] += 0.5 * dt * F[i];
    }
  }
  function pfTrainData({ T = 0.3, n = 60, seed = 1 }) {
    const R = rng(seed), x = pfInit(), v = new Array(x.length).fill(0), out = [];
    pfLangevin(x, v, TRUE_PAIR, T, 0.004, 400, R);
    for (let k = 0; k < n; k++) { pfLangevin(x, v, TRUE_PAIR, T, 0.004, 40, R); out.push({ x: x.slice(), f: pfForces(x, TRUE_PAIR).f }); }
    return out;
  }
  // 力匹配：力对系数 c 是线性的，所以是普通的最小二乘
  function pfFit(data, usePrior, ridge = 1e-6) {
    const K = PF.centers.length, rows = [], ys = [];
    for (const d of data) {
      const N = d.x.length / 2, A = Array.from({ length: 2 * N }, () => new Array(K).fill(0));
      const wallAndPrior = pfForces(d.x, { u: (r) => prior(r, usePrior), d: (r) => dprior(r, usePrior) }).f;
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
        const dx = d.x[2 * i] - d.x[2 * j], dy = d.x[2 * i + 1] - d.x[2 * j + 1], r = Math.hypot(dx, dy);
        for (let k = 0; k < K; k++) { const g = (dcut(r) * bump(r, k) + cut(r) * dbump(r, k)) / r; A[2 * i][k] -= g * dx; A[2 * i + 1][k] -= g * dy; A[2 * j][k] += g * dx; A[2 * j + 1][k] += g * dy; }
      }
      for (let i = 0; i < 2 * N; i++) { rows.push(A[i]); ys.push(d.f[i] - wallAndPrior[i]); }
    }
    const [c] = lstsq(rows, [ys], ridge);
    let se = 0; rows.forEach((row, i) => { se += (dot(row, c) - ys[i]) ** 2; });
    const dists = []; for (const d of data) { const N = d.x.length / 2; for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) dists.push(Math.hypot(d.x[2 * i] - d.x[2 * j], d.x[2 * i + 1] - d.x[2 * j + 1])); }
    return { c, prior: usePrior, rmse: Math.sqrt(se / rows.length), dists, rmin: Math.min(...dists) };
  }
  // 拿学到的（或真的）对势在 NVE 里跑：速度 Verlet，初速度按温度 T 抽
  function pfRun(pair, { T = 0.3, steps = 2000, dt = 0.003, seed = 3 }) {
    const R = rng(seed), x = pfInit(), N = x.length / 2, v = Array.from({ length: 2 * N }, () => Math.sqrt(T) * gauss(R));
    let F = pfForces(x, pair), K0 = 0.5 * dot(v, v);
    const E0 = K0 + F.U, rec = [];
    let rmin = Infinity;
    for (let s = 0; s < steps; s++) {
      for (let i = 0; i < 2 * N; i++) { v[i] += 0.5 * dt * F.f[i]; x[i] += dt * v[i]; }
      F = pfForces(x, pair);
      for (let i = 0; i < 2 * N; i++) v[i] += 0.5 * dt * F.f[i];
      for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) rmin = Math.min(rmin, Math.hypot(x[2 * i] - x[2 * j], x[2 * i + 1] - x[2 * j + 1]));
      if (s % 20 === 0) rec.push({ t: s * dt, E: 0.5 * dot(v, v) + F.U - E0, rmin });
      if (!Number.isFinite(F.U) || rmin < 0.3) { rec.push({ t: s * dt, E: NaN, rmin }); return { x, rec, rmin, collapsed: true }; }
    }
    return { x, rec, rmin, collapsed: false };
  }

  // ── 10. SINDy：从洛伦兹系统的轨迹里找回方程，再做集合预报 ────────────────────
  const LZ = { s: 10, r: 28, b: 8 / 3 };
  const lorenzF = (p) => [LZ.s * (p[1] - p[0]), p[0] * (LZ.r - p[2]) - p[1], p[0] * p[1] - LZ.b * p[2]];
  function rk4(f, p, dt) { const k1 = f(p), k2 = f(p.map((v, i) => v + 0.5 * dt * k1[i])), k3 = f(p.map((v, i) => v + 0.5 * dt * k2[i])), k4 = f(p.map((v, i) => v + dt * k3[i])); return p.map((v, i) => v + (dt / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i])); }
  function lorenzTraj(p0, dt, n) { const out = [p0]; let p = p0; for (let i = 0; i < n; i++) { p = rk4(lorenzF, p, dt); out.push(p); } return out; }
  const LIB_NAMES = ['1', 'x', 'y', 'z', 'x²', 'xy', 'xz', 'y²', 'yz', 'z²'];
  const lib = (p) => [1, p[0], p[1], p[2], p[0] * p[0], p[0] * p[1], p[0] * p[2], p[1] * p[1], p[1] * p[2], p[2] * p[2]];
  const LZ_TRUE = [[0, -10, 10, 0, 0, 0, 0, 0, 0, 0], [0, 28, -1, 0, 0, 0, -1, 0, 0, 0], [0, 0, 0, -8 / 3, 0, 1, 0, 0, 0, 0]];
  // 带噪声的轨迹 → 中心差分求导 → 序列阈值最小二乘（STLSQ）
  function sindy({ noise = 0, thresh = 0.1, dt = 0.002, n = 5000, seed = 1 }) {
    const R = rng(seed), clean = lorenzTraj([-8, 7, 27], dt, n), X = clean.map((p) => p.map((v) => v + noise * gauss(R)));
    const Phi = [], dX = [[], [], []];
    for (let i = 2; i < X.length - 2; i++) { // 五点中心差分
      Phi.push(lib(X[i]));
      for (let d = 0; d < 3; d++) dX[d].push((-X[i + 2][d] + 8 * X[i + 1][d] - 8 * X[i - 1][d] + X[i - 2][d]) / (12 * dt));
    }
    const Xi = [];
    for (let d = 0; d < 3; d++) {
      let active = LIB_NAMES.map((_, k) => k), coef = new Array(10).fill(0);
      for (let it = 0; it < 10; it++) {
        const [c] = lstsq(Phi.map((row) => active.map((k) => row[k])), [dX[d]], 1e-12);
        coef = new Array(10).fill(0); active.forEach((k, j) => { coef[k] = c[j]; });
        const keep = active.filter((k) => Math.abs(coef[k]) >= thresh);
        if (keep.length === active.length) break;
        active = keep; if (!active.length) break;
      }
      Xi.push(coef);
    }
    return { Xi };
  }
  const sindyF = (Xi) => (p) => { const f = lib(p); return Xi.map((c) => dot(c, f)); };
  // 集合预报：从 p0 附近 M 个扰动过的起点出发，用模型 f 积分
  function ensembleForecast(f, p0, { M = 20, eps = 0.01, dt = 0.01, n = 1000, seed = 1 }) {
    const R = rng(seed);
    return Array.from({ length: M }, () => { let p = p0.map((v) => v + eps * gauss(R)); const out = [p]; for (let i = 0; i < n; i++) { p = rk4(f, p, dt); if (!p.every(Number.isFinite) || Math.abs(p[0]) > 1e4) { out.push([NaN, NaN, NaN]); break; } out.push(p); } return out; });
  }

  // ── 11. 学出来的分子动力学传播器：一步跨过 τ（Timewarp / ITO 的最小版本）───────
  // 过阻尼 Langevin：dx = −U′(x) dt + √2 dW（kT = D = 1），U = h (x² − 1)²
  const dwU = (x, h) => h * (x * x - 1) ** 2, dwF = (x, h) => -4 * h * x * (x * x - 1);
  function dwSim(x0, h, dt, n, R, every = 1) { const out = []; let x = x0; const s = Math.sqrt(2 * dt); for (let i = 0; i < n; i++) { x += dwF(x, h) * dt + s * gauss(R); if (i % every === every - 1) out.push(x); } return out; }
  // 训练数据：很多条短轨迹，每条只跑一个 τ，起点在 [−2.2, 2.2] 里均匀撒（不是平衡分布，就像实际中的短模拟）
  function propData({ h = 2.5, tau = 0.1, dt = 1e-3, n = 3000, seed = 1 }) {
    const R = rng(seed), k = Math.max(1, Math.round(tau / dt)), pairs = [];
    for (let i = 0; i < n; i++) { const x0 = -PBOX + 2 * PBOX * R(), x1 = dwSim(x0, h, dt, k, R, k)[0]; pairs.push([x0, x1]); }
    return pairs;
  }
  const PDEG = 7, PBOX = 2.2;
  const pfeat = (x) => Array.from({ length: PDEG + 1 }, (_, j) => x ** j);
  // 条件高斯：x′ ~ N(μ(x), σ²(x))，μ 是多项式，ln σ² 也是多项式（对残差的平方做回归）
  function propFit(pairs) {
    const Phi = pairs.map((p) => pfeat(p[0]));
    const [a] = lstsq(Phi, [pairs.map((p) => p[1])], 1e-8);
    const res = pairs.map((p, i) => Math.log((p[1] - dot(a, Phi[i])) ** 2 + 1e-8) + 1.2704); // E[ln χ²₁] = −1.2704
    const [b] = lstsq(Phi, [res], 1e-6);
    return { a, b, mu: (x) => dot(a, pfeat(x)), sd: (x) => Math.sqrt(Math.exp(dot(b, pfeat(x)))) };
  }
  function propRun(m, x0, n, R) { const out = [x0]; let x = x0; for (let i = 0; i < n; i++) { x = m.mu(x) + m.sd(x) * gauss(R); if (!Number.isFinite(x)) x = 0; x = Math.max(-PBOX, Math.min(PBOX, x)); /* 训练数据只到 ±PBOX，走出去就夹回来 */ out.push(x); } return out; }
  // 精确的平均首次通过时间（从 −1 到 +1）：τ_MFPT = ∫_{−1}^{1} dy e^{U(y)} ∫_{−∞}^{y} e^{−U(z)} dz（kT = D = 1）
  function mfptExact(h) {
    const zs = lin(-4, 1, 5001), dz = zs[1] - zs[0], inner = []; let acc = 0;
    for (let i = 0; i < zs.length; i++) { acc += Math.exp(-dwU(zs[i], h)) * dz * (i === 0 ? 0.5 : 1); inner.push(acc - 0.5 * Math.exp(-dwU(zs[i], h)) * dz); }
    let T = 0; for (let i = 0; i < zs.length; i++) if (zs[i] >= -1) T += Math.exp(dwU(zs[i], h)) * inner[i] * dz * (i === zs.length - 1 || zs[i] - dz < -1 ? 0.5 : 1);
    return T;
  }
  // 从一条轨迹数 −1 → +1 的平均首次通过时间（每次从进入 x < −1 开始计时，到 x > +1 停）
  function mfptFromTraj(xs, dtStep) { let start = null, sum = 0, n = 0; for (let i = 0; i < xs.length; i++) { if (xs[i] < -1 && start === null) start = i; else if (xs[i] > 1 && start !== null) { sum += (i - start) * dtStep; n++; start = null; } } return n ? { t: sum / n, n } : { t: NaN, n: 0 }; }
  function boltzHist(h, edges) { const w = edges.slice(0, -1).map((a, i) => { let s = 0; for (const x of lin(a, edges[i + 1], 21)) s += Math.exp(-dwU(x, h)); return s / 21; }); const z = w.reduce((s, v) => s + v, 0); return w.map((v) => v / z); }
  function hist(xs, edges) { const c = new Array(edges.length - 1).fill(0); const w = edges[1] - edges[0]; for (const x of xs) { const k = Math.floor((x - edges[0]) / w); if (k >= 0 && k < c.length) c[k]++; } const n = c.reduce((s, v) => s + v, 0) || 1; return c.map((v) => v / n); }
  const l1 = (p, q) => p.reduce((s, v, i) => s + Math.abs(v - q[i]), 0);

  // ── 12. 反应的世界模型：机理模型（灰箱）、高斯过程（黑箱）和随机试 ────────────────
  // A → B → C，两步都是 Arrhenius；选温度 T（K）和时间 t（min），测 B 的产率
  const RX = { T0: 350, k1: 0.05, E1: 60e3, k2: 0.012, E2: 95e3, Tlo: 300, Thi: 400, tlo: 1, thi: 120 };
  const Rgas = 8.314;
  const kArr = (k0, E, T) => k0 * Math.exp((-E / Rgas) * (1 / T - 1 / RX.T0));
  function yieldB(T, t, p = RX) { const k1 = kArr(p.k1, p.E1, T), k2 = kArr(p.k2, p.E2, T); if (Math.abs(k1 - k2) < 1e-12) return k1 * t * Math.exp(-k1 * t); return (k1 / (k2 - k1)) * (Math.exp(-k1 * t) - Math.exp(-k2 * t)); }
  const toUnit = (T, t) => [(T - RX.Tlo) / (RX.Thi - RX.Tlo), (Math.log(t) - Math.log(RX.tlo)) / (Math.log(RX.thi) - Math.log(RX.tlo))];
  const fromUnit = (u) => [RX.Tlo + u[0] * (RX.Thi - RX.Tlo), Math.exp(Math.log(RX.tlo) + u[1] * (Math.log(RX.thi) - Math.log(RX.tlo)))];
  const RX_GRID = (() => { const g = []; for (const a of lin(0, 1, 31)) for (const b of lin(0, 1, 31)) g.push([a, b]); return g; })();
  const rxBest = (() => { let best = 0, at = null; for (const u of lin(0, 1, 201).flatMap((a) => lin(0, 1, 201).map((b) => [a, b]))) { const [T, t] = fromUnit(u); const y = yieldB(T, t); if (y > best) { best = y; at = u; } } return { y: best, u: at }; })();
  function gpPost(X, y, Q, ls = 0.22, sf = 0.3, sn = 0.02) {
    const k = (a, b) => sf * sf * Math.exp(-((a[0] - b[0]) ** 2 + (a[1] - b[1]) ** 2) / (2 * ls * ls));
    const n = X.length, m0 = mean(y), K = X.map((a, i) => X.map((b, j) => k(a, b) + (i === j ? sn * sn : 0)));
    const alpha = solve(K, y.map((v) => v - m0));
    return Q.map((q) => { const ks = X.map((a) => k(a, q)), mu = m0 + dot(ks, alpha), v = solve(K, ks); return { mu, sd: Math.sqrt(Math.max(1e-12, sf * sf - dot(ks, v))) }; });
  }
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2)), phi = (z) => Math.exp(-0.5 * z * z) / Math.sqrt(2 * Math.PI);
  function erf(x) { const t = 1 / (1 + 0.3275911 * Math.abs(x)), y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-x * x); return x >= 0 ? y : -y; }
  const ei = (mu, sd, best) => { const z = (mu - best) / sd; return (mu - best) * Phi(z) + sd * phi(z); };
  // 机理模型的拟合：参数 θ = [ln k1, E1/10⁴, ln k2, E2/10⁴]，Gauss–Newton（带阻尼），从几个起点各拟一次取最好的
  function mechFit(X, y) {
    const model = (th, u) => { const [T, t] = fromUnit(u); return yieldB(T, t, { k1: Math.exp(th[0]), E1: th[1] * 1e4, k2: Math.exp(th[2]), E2: th[3] * 1e4 }); };
    const sse = (th) => X.reduce((s, u, i) => s + (model(th, u) - y[i]) ** 2, 0);
    let best = null;
    for (const start of [[-3, 5, -4.5, 8], [-2, 8, -5, 5], [-4, 7, -3.5, 10], [-3, 10, -4, 6]]) {
      let th = start.slice(), lam = 1e-2, cur = sse(th);
      for (let it = 0; it < 60; it++) {
        const J = X.map((u) => th.map((_, j) => { const d = th.slice(); d[j] += 1e-5; return (model(d, u) - model(th, u)) / 1e-5; })), r = X.map((u, i) => y[i] - model(th, u));
        const A = th.map((_, a) => th.map((_, b) => J.reduce((s, row) => s + row[a] * row[b], 0) + (a === b ? lam : 0))), g = th.map((_, a) => J.reduce((s, row, i) => s + row[a] * r[i], 0));
        const step = solve(A, g), cand = th.map((v, j) => v + step[j]);
        cand[1] = Math.max(1, Math.min(20, cand[1])); cand[3] = Math.max(1, Math.min(20, cand[3]));
        const cs = sse(cand);
        if (cs < cur) { th = cand; cur = cs; lam = Math.max(1e-6, lam / 3); } else lam *= 4;
        if (lam > 1e6) break;
      }
      if (!best || cur < best.sse) best = { th, sse: cur };
    }
    return { th: best.th, predict: (u) => model(best.th, u) };
  }
  function rxCampaign(strategy, { n = 15, seed = 1, noise = 0.02 } = {}) {
    const R = rng(seed), X = [], y = [], measure = (u) => { const [T, t] = fromUnit(u); return Math.max(0, yieldB(T, t) + noise * gauss(R)); };
    for (let i = 0; i < 3; i++) { const u = [R(), R()]; X.push(u); y.push(measure(u)); } // 三个随机的起点，三种做法一样
    while (X.length < n) {
      let u;
      if (strategy === 'random') u = [R(), R()];
      else if (strategy === 'gp') { const best = Math.max(...y), post = gpPost(X, y, RX_GRID); let b = 0; post.forEach((p, i) => { if (ei(p.mu, p.sd, best) > ei(post[b].mu, post[b].sd, best)) b = i; }); u = RX_GRID[b].map((v) => Math.min(1, Math.max(0, v + 0.01 * (R() - 0.5)))); }
      else { const m = mechFit(X, y); let b = 0, bv = -1; for (const g of RX_GRID) { const v = m.predict(g); if (v > bv) { bv = v; b = g; } } u = b.map((v) => Math.min(1, Math.max(0, v + 0.02 * (R() - 0.5)))); }
      X.push(u); y.push(measure(u));
    }
    // 每一步“到目前为止最好的那次实验”的真实产率（不是测出来的带噪声的数）
    const truth = X.map((u) => { const [T, t] = fromUnit(u); return yieldB(T, t); });
    let bi = 0; const bestSoFar = y.map((v, i) => { if (v > y[bi]) bi = i; return truth[bi]; });
    return { X, y, truth, bestSoFar };
  }

  // ── 13. 什么时候该相信模型：自助法集成的分歧 ───────────────────────────────
  // 一维速度场 dx/dt = f(x)，只在 [lo, hi] 里有数据；每个成员用随机傅里叶特征在一份自助样本上拟合
  const fTrue = (x) => Math.sin(2 * x) - 0.3 * x;
  function ensFit({ lo = -1, hi = 1, n = 40, M = 6, noise = 0.05, seed = 1, nf = 30 }) {
    const R = rng(seed), xs = Array.from({ length: n }, () => lo + (hi - lo) * R()), ys = xs.map((x) => fTrue(x) + noise * gauss(R));
    const members = [];
    for (let m = 0; m < M; m++) {
      const W = Array.from({ length: nf }, () => 1.5 * gauss(R)), B = Array.from({ length: nf }, () => 2 * Math.PI * R());
      const feat = (x) => [1, ...W.map((w, k) => Math.cos(w * x + B[k]))];
      const idx = Array.from({ length: n }, () => Math.floor(R() * n));
      const [c] = lstsq(idx.map((i) => feat(xs[i])), [idx.map((i) => ys[i])], 1e-3);
      members.push((x) => dot(c, feat(x)));
    }
    return { xs, ys, members, lo, hi };
  }
  const ensStats = (E, x) => { const v = E.members.map((f) => f(x)), m = mean(v); return { mean: m, sd: Math.sqrt(variance(v)), err: Math.abs(m - fTrue(x)) }; };
  function ensRollout(f, x0, dt, n) { const out = [x0]; let x = x0; for (let i = 0; i < n; i++) { const k1 = f(x), k2 = f(x + 0.5 * dt * k1), k3 = f(x + 0.5 * dt * k2), k4 = f(x + dt * k3); x += (dt / 6) * (k1 + 2 * k2 + 2 * k3 + k4); if (!Number.isFinite(x) || Math.abs(x) > 50) { out.push(NaN); break; } out.push(x); } return out; }

  window.MOLASTRIA_WM_MODELS = {
    rng, gauss, mean, variance, dot, corr, solve, lstsq, eigSym, eigGeneral, lin, C,
    pendStep, pendFeatures, pendData, pendFit, pendModelStep, rollout, oneStepRMSE,
    BLOB_N, blob, blobSet, pca, pcaEncode, pcaDecode, explained,
    kalmanRun, kalmanSteady,
    MAZE, mazeStep, mazeShortest, dynaQ, dynaAverage, greedyPath,
    wrap, upCost, cemPlan, mpcRun, upTime,
    jepaData, pixelR2, jepaTrain, sfa,
    LA, laVideo, laFeature, kmeans, laPurity,
    advdiff, dmd, eigMatchError,
    LJ, dLJ, PF, learnedU, learnedDU, pfForces, TRUE_PAIR, pfInit, pfTrainData, pfFit, pfRun,
    LZ, lorenzF, rk4, lorenzTraj, LIB_NAMES, LZ_TRUE, sindy, sindyF, ensembleForecast,
    dwU, dwF, dwSim, propData, propFit, propRun, mfptExact, mfptFromTraj, boltzHist, hist, l1,
    RX, yieldB, toUnit, fromUnit, RX_GRID, rxBest, gpPost, ei, mechFit, rxCampaign,
    fTrue, ensFit, ensStats, ensRollout,
  };
})();
