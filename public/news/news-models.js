'use strict';
// 化学与材料新闻 · 演示用的数学（纯函数，没有 DOM；tools/news-test.mjs 测）。
// 1. 自由基对的单重态–T0 混合（两能级，高场近似）；2. 三重态（S = 1）在 X 波段的粉末 EPR 谱，带自旋极化；
// 3. 三重态的零场能级、ODMR 跃迁和弱磁场下的能级（3×3 精确对角化）；4. 两个电子自旋的点偶极 D 值；
// 6. 二维玩具表面上的吸附：真实势上的弛豫、近平衡才准的“机器学习势”、周期布朗桥（DBCata 的演示）。
// 单位：频率 MHz，磁场 mT，时间 ns 或 μs（各函数注明）。
(() => {
  // g = 2.0023 的电子：γ = gμB/h，单位 MHz/mT（μB/h = 13.996 245 GHz/T）
  const MUB_H = 13.996245; // MHz/mT
  const gamma = (g = 2.0023) => g * MUB_H;

  // ── 1. 自由基对：|S⟩ 和 |T0⟩ 两个态 ─────────────────────────────────────────
  // H = h[[J, Q], [Q, −J]]：S 和 T0 的能量差是 2J（单位 MHz），Q 是把两者混起来的那一项：
  // Q = (Δg μB B0 / h + a1 − a2) / 2，a1、a2 是两个自由基各自感受到的超精细场（这里取一个有效值）。
  // 从 S 出发，t 时刻在 T0 的概率 P(t) = Q²/(J²+Q²) · sin²(2π√(J²+Q²) t)，t 单位 μs（MHz·μs = 1）。
  function stMix(J, Q, t) {
    const w = Math.hypot(J, Q);
    if (w === 0) return 0;
    const s = Math.sin(2 * Math.PI * w * t);
    return (Q * Q) / (w * w) * s * s;
  }
  // Δg 带来的混合频率：Q_Δg = Δg μB B0 / (2h)，单位 MHz（B0 单位 mT）
  const qFromDg = (dg, B0) => (dg * MUB_H * B0) / 2;
  // 自由基对有寿命 τ（μs，指数分布）时，最后落在 T0 的平均比例：
  // ∫ k e^{−kt} P(t) dt = Q²/(J²+Q²) · 2Ω²/(k²+4Ω²)，Ω = 2π√(J²+Q²)，k = 1/τ
  function stYield(J, Q, tau) {
    const w = Math.hypot(J, Q);
    if (w === 0 || !(tau > 0)) return 0;
    const W = 2 * Math.PI * w, k = 1 / tau;
    return (Q * Q) / (w * w) * (2 * W * W) / (k * k + 4 * W * W);
  }
  // 超精细场不止一个值：取高斯分布（宽 sigma，MHz）上的平均。在 ±6σ 上用 241 点的 Simpson 积分，结果确定、可复现
  // ⟨f(Q0 + q)⟩，q ~ N(0, sigma²)。f 随 q 振荡得越快（t 越长），格点要越密，否则会出现假的“回潮”：n 由调用方给（偶数）
  function gaussAvg(f, Q0, sigma, n = 240) {
    if (!(sigma > 0)) return f(Q0);
    const a = -6, h = 12 / n;
    let s = 0, wsum = 0;
    for (let i = 0; i <= n; i++) {
      const x = a + i * h, c = i === 0 || i === n ? 1 : i % 2 ? 4 : 2, w = c * Math.exp(-x * x / 2);
      s += w * f(Q0 + sigma * x); wsum += w;
    }
    return s / wsum;
  }
  // sin²(2π√(J²+q²)t) 在 q 上的周期不短于 1/(2t)，每个周期取至少 16 个点
  const gridFor = (sigma, t) => 2 * Math.ceil(Math.min(6000, Math.max(240, 12 * sigma * 2 * t * 16)) / 2);
  const stMixAvg = (J, Q0, sigma, t) => gaussAvg((q) => stMix(J, q, t), Q0, sigma, gridFor(sigma, t));
  const stYieldAvg = (J, Q0, sigma, tau) => gaussAvg((q) => stYield(J, q, tau), Q0, sigma);

  // ── 2. 三重态的粉末 EPR 谱 ───────────────────────────────────────────────
  // 零场分裂 H = D(Sz² − S²/3) + E(Sx² − Sy²)。磁场方向 n（在零场主轴系里）上的一阶能量：
  // E_m = gμB B m + X (m² − 2/3)，X = D(3n_z² − 1)/2 + (3/2)E(n_x² − n_y²)。
  // 于是 −1↔0 在 B = (ν + X)/γ 共振，0↔+1 在 B = (ν − X)/γ 共振。
  // 布居：系间窜越（ISC）给的是零场能级 Tx、Ty、Tz 的布居 Px、Py、Pz，投到高场：
  // p0 = Σ Pi ni²，p± = Σ Pi (1 − ni²)/2；只进 T0 的情形 p0 = 1、p± = 0。
  // 强度 ∝ 下能级布居 − 上能级布居：正的是吸收（A），负的是发射（E）。
  function sphere(n) {
    // Fibonacci 球面点，只取上半球（谱对 n → −n 不变）
    const out = [], ga = Math.PI * (3 - Math.sqrt(5));
    for (let i = 0; i < n; i++) {
      const z = 1 - (i + 0.5) / n, r = Math.sqrt(1 - z * z), p = ga * i;
      out.push([r * Math.cos(p), r * Math.sin(p), z]);
    }
    return out;
  }
  const popsAt = (n, pops) => {
    if (pops.mode === 't0') return [0, 1, 0];
    const [Px, Py, Pz] = pops.P, s = Px + Py + Pz || 1;
    const p0 = (Px * n[0] * n[0] + Py * n[1] * n[1] + Pz * n[2] * n[2]) / s;
    const pm = (1 - p0) / 2;
    return [pm, p0, pm]; // m = −1, 0, +1
  };
  /**
   * 粉末谱的“棍”：每个方向两条线 { B, I }。o = { D, E, nu (MHz), g, pops: { mode:'isc', P:[Px,Py,Pz] } | { mode:'t0' }, n }
   */
  function tripletSticks(o) {
    const gm = gamma(o.g), pts = sphere(o.n || 1500), out = [];
    for (const n of pts) {
      const X = (o.D * (3 * n[2] * n[2] - 1)) / 2 + 1.5 * o.E * (n[0] * n[0] - n[1] * n[1]);
      const [pm, p0, pp] = popsAt(n, o.pops);
      out.push({ B: (o.nu + X) / gm, I: pm - p0 }, { B: (o.nu - X) / gm, I: p0 - pp });
    }
    return out;
  }
  // 把棍展成高斯线（半高宽 fwhm，mT），在 [b0, b1] 上取 npts 个点
  function broaden(sticks, b0, b1, npts, fwhm) {
    const xs = [], ys = new Array(npts).fill(0), s = fwhm / 2.3548200450309493, inv = 1 / (2 * s * s), dx = (b1 - b0) / (npts - 1);
    for (let i = 0; i < npts; i++) xs.push(b0 + i * dx);
    const reach = 5 * s;
    for (const st of sticks) {
      const i0 = Math.max(0, Math.floor((st.B - reach - b0) / dx)), i1 = Math.min(npts - 1, Math.ceil((st.B + reach - b0) / dx));
      for (let i = i0; i <= i1; i++) { const d = xs[i] - st.B; ys[i] += st.I * Math.exp(-d * d * inv); }
    }
    const m = Math.max(1e-12, ...ys.map(Math.abs));
    return { xs, ys: ys.map((v) => v / m) };
  }
  // 粉末谱最外面两条线（z 方向）之间的距离 2|D|/γ（mT）
  const spanMT = (D, g) => (2 * Math.abs(D)) / gamma(g);

  // ── 3. 零场和弱磁场下的三重态能级 ────────────────────────────────────────
  // 零场：E_X = D/3 − E，E_Y = D/3 + E，E_Z = −2D/3；ODMR 看到三条跃迁：2E、D − E、D + E。
  function zeroField(D, E) {
    const lv = { X: D / 3 - E, Y: D / 3 + E, Z: (-2 * D) / 3 };
    const lines = [Math.abs(lv.X - lv.Y), Math.abs(lv.X - lv.Z), Math.abs(lv.Y - lv.Z)].sort((a, b) => a - b);
    return { levels: lv, lines };
  }
  // 反过来：由三条 ODMR 线读出 |D|、|E|（三条线排好序：2E、D − E、D + E）
  function fromLines(lines) {
    const [a, b, c] = [...lines].sort((x, y) => x - y);
    return { D: (b + c) / 2, E: (c - b) / 2, check: a - (c - b) };
  }
  // 3×3 实对称矩阵的本征值（Jacobi 旋转），从小到大
  function eig3(A) {
    const a = A.map((r) => r.slice());
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) off += a[p][q] * a[p][q];
      if (off < 1e-24) break;
      for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < 3; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < 3; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
      }
    }
    return [a[0][0], a[1][1], a[2][2]].sort((x, y) => x - y);
  }
  // 在 |+1⟩、|0⟩、|−1⟩ 基里写 H（MHz）：零场部分 diag(D/3, −2D/3, D/3)，E 连着 +1 和 −1；
  // 磁场沿 z：γB·diag(1, 0, −1)；沿 x：γB·Sx，Sx = [[0,1,0],[1,0,1],[0,1,0]]/√2。两种都是实矩阵。
  function levelsAt(D, E, B, axis = 'z', g = 2.0023) {
    const z = gamma(g) * B, H = [[D / 3, 0, E], [0, (-2 * D) / 3, 0], [E, 0, D / 3]];
    if (axis === 'z') { H[0][0] += z; H[2][2] -= z; }
    else { const v = z / Math.SQRT2; H[0][1] += v; H[1][0] += v; H[1][2] += v; H[2][1] += v; }
    return eig3(H);
  }

  // ── 4. 两个电子自旋的点偶极相互作用 ───────────────────────────────────────
  // 偶极耦合常数 d = (μ0/4π) g² μB² / (h r³) = 52.04 MHz·nm³ / r³（g ≈ 2.0023）；
  // 把两个自旋看成一个三重态时，零场分裂 |D| = (3/2) d。
  const DIP = 52.04;
  const dipD = (rNm) => (1.5 * DIP) / (rNm * rNm * rNm);
  const rFromD = (D) => Math.cbrt((1.5 * DIP) / Math.abs(D));

  // ── 5. 两条路竞争：k1/(k1 + k2) ──────────────────────────────────────────
  const branch = (tau1, tau2) => (1 / tau1) / (1 / tau1 + 1 / tau2);

  // ── 6. 吸附结构：一个二维玩具表面上的力弛豫和布朗桥（DBCata 那一条的演示） ──────────────────
  // 一个吸附原子在周期为 1 的正方形表面上的位置 (x, y)。势能 V 是几口周期排列的高斯井：空位（0.5, 0.5）最深，
  // 两个桥位（0.5, 0）、（0, 0.5）是浅井，顶位（0, 0）是一个鼓包。“DFT”就是在 V 上最速下降到局部极小。
  // “机器学习势”在极小附近和 V 一样（训练数据都是近平衡的），离极小远了就叠上一个固定的起伏误差 ε·S(d)·G(x, y)。
  // 布朗桥：训练数据是 N 对（初猜 y，弛豫后的 x），初猜按“规则位点 + 高斯偏移”生成；去噪器用这批数据的
  // 经验分布的最优去噪器（核回归），也就是一个训练好的网络想逼近的那个函数。采样走 ODE（σ_t = 0），K 步。
  const SURF = [
    { c: [0.5, 0.5], a: -1.0, s: 0.16, name: 'hollow' },
    { c: [0.5, 0], a: -0.4, s: 0.10, name: 'bridge' },
    { c: [0, 0.5], a: -0.4, s: 0.10, name: 'bridge' },
    { c: [0, 0], a: 0.6, s: 0.12, name: 'top' },
  ];
  const SITES = [[0, 0], [0.5, 0], [0, 0.5], [0.5, 0.5]]; // 规则枚举的位点：顶、桥、桥、空
  const MINIMA = [[0.5, 0.5], [0.5, 0], [0, 0.5]];
  const wrap1 = (v) => v - Math.floor(v);
  const mimg = (d) => d - Math.round(d); // 最小像：差值折到 [−½, ½]
  const pdist = (a, b) => Math.hypot(mimg(a[0] - b[0]), mimg(a[1] - b[1]));
  function surfV(x, y) {
    x = wrap1(x); y = wrap1(y); // 先折回晶胞，九个像就够，而且严格周期
    let e = 0;
    for (const w of SURF) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const dx = x - w.c[0] - i, dy = y - w.c[1] - j;
      e += w.a * Math.exp(-(dx * dx + dy * dy) / (2 * w.s * w.s));
    }
    return e;
  }
  function surfGrad(x, y) {
    x = wrap1(x); y = wrap1(y); // 先折回晶胞，九个像就够，而且严格周期
    let gx = 0, gy = 0;
    for (const w of SURF) for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) {
      const dx = x - w.c[0] - i, dy = y - w.c[1] - j, s2 = w.s * w.s, f = w.a * Math.exp(-(dx * dx + dy * dy) / (2 * s2));
      gx -= (f * dx) / s2; gy -= (f * dy) / s2;
    }
    return [gx, gy];
  }
  const minDist = (x, y) => Math.min(...MINIMA.map((c) => pdist([x, y], c)));
  const smoothstep = (t) => (t <= 0 ? 0 : t >= 1 ? 1 : t * t * (3 - 2 * t));
  // 误差只在离最近的极小超过 0.07 之后出现，0.19 以外全开；G 是整数频率的三角函数，所以 V_ML 仍然是周期的
  const mlipErr = (x, y) => smoothstep((minDist(x, y) - 0.07) / 0.12) * Math.sin(2 * Math.PI * (2 * x + y) + 1.3) * Math.cos(2 * Math.PI * (x - 2 * y) + 0.4);
  const mlipV = (x, y, eps) => surfV(x, y) + eps * mlipErr(x, y);
  function mlipGrad(x, y, eps) {
    const h = 1e-5, f = (a, b) => mlipV(a, b, eps);
    return [(f(x + h, y) - f(x - h, y)) / (2 * h), (f(x, y + h) - f(x, y - h)) / (2 * h)];
  }
  // 最速下降：步长 η·|∇V|，每步最多 0.02，|∇V| < tol 停；坐标不折回（画轨迹用），终点另外折回到 [0, 1)
  function descend(grad, x, y, { eta = 0.003, steps = 6000, tol = 1e-4, every = 5 } = {}) {
    const path = [[x, y]];
    let k = 0;
    for (; k < steps; k++) {
      const [gx, gy] = grad(x, y), n = Math.hypot(gx, gy);
      if (n < tol) break;
      let sx = eta * gx, sy = eta * gy;
      const m = Math.hypot(sx, sy);
      if (m > 0.02) { sx *= 0.02 / m; sy *= 0.02 / m; }
      x -= sx; y -= sy;
      if (k % every === 0) path.push([x, y]);
    }
    path.push([x, y]);
    return { x: [wrap1(x), wrap1(y)], end: [x, y], path, steps: k };
  }
  const relaxTrue = (y) => descend(surfGrad, y[0], y[1]);
  const relaxML = (y, eps) => descend((a, b) => mlipGrad(a, b, eps), y[0], y[1]);
  // 可复现的随机数（mulberry32）和 Box–Muller
  function rng(seed) {
    let s = seed >>> 0;
    return () => { s = (s + 0x6D2B79F5) >>> 0; let t = s; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  // N 对训练数据：第 i 个初猜放在规则位点 SITES[i mod 4]，加标准差 sig 的高斯偏移；弛豫用真实的 V
  function adsPairs(n, seed = 7, sig = 0.08) {
    const r = rng(seed), g = () => Math.sqrt(-2 * Math.log(r() + 1e-12)) * Math.cos(2 * Math.PI * r()), out = [];
    for (let i = 0; i < n; i++) {
      const s = SITES[i % 4], y = [wrap1(s[0] + sig * g()), wrap1(s[1] + sig * g())];
      out.push({ y, x: relaxTrue(y).x });
    }
    return out;
  }
  // 桥的方差 δ_t = 2s(m_t − m_t²)，m_t = t/T（论文式 2）
  const bridgeVar = (m, s) => 2 * s * (m - m * m);
  // 周期插值：从 x0 到 y 的第 m 处。nearest = true 用最小像位移（论文式 8），false 是直接线性插值
  const periodicInterp = (x0, y, m, nearest = true) => [0, 1].map((k) => { const d = y[k] - x0[k]; return x0[k] + m * (nearest ? mimg(d) : d); });
  // 经验分布的最优去噪器：给定 x_t，预测 x_t − x0 的条件期望。每对数据在 t 处的桥均值 μ_i = x0_i + m·mimg(y_i − x0_i)，
  // 方差 δ_t + h²（h 是核宽，δ_t = 0 的两端靠它不退化）。返回 [εx, εy]，都按最小像算
  function denoise(data, xt, m, s, h) {
    const v2 = 2 * (bridgeVar(m, s) + h * h), n = data.length, lw = new Float64Array(n);
    let wmax = -Infinity;
    for (let i = 0; i < n; i++) {
      const p = data[i], mx = p.x[0] + m * mimg(p.y[0] - p.x[0]), my = p.x[1] + m * mimg(p.y[1] - p.x[1]);
      const dx = mimg(xt[0] - mx), dy = mimg(xt[1] - my), l = -(dx * dx + dy * dy) / v2;
      lw[i] = l; if (l > wmax) wmax = l;
    }
    let sw = 0, ex = 0, ey = 0;
    for (let i = 0; i < n; i++) {
      const w = Math.exp(lw[i] - wmax);
      if (w < 1e-12) continue;
      sw += w; ex += w * mimg(xt[0] - data[i].x[0]); ey += w * mimg(xt[1] - data[i].x[1]);
    }
    return [ex / sw, ey / sw];
  }
  // 反向 ODE 采样（论文式 10，σ_t = 0）：x̂0 = x_t − ε̂；x_{t−1} = (1 − m_{t−1}) x̂0 + m_{t−1} y + √(δ_{t−1}/δ_t)·(x_t − (1 − m_t) x̂0 − m_t y)。
  // y 取离 x̂0 最近的像（最近原子插值）。返回终点（折回 [0, 1)）和每一步的位置
  function bridgeSample(data, y, { K = 20, s = 0.02, h = 0.035 } = {}) {
    let xt = [y[0], y[1]];
    const path = [[xt[0], xt[1]]], preds = [];
    for (let k = K; k >= 1; k--) {
      const m = k / K, mp = (k - 1) / K, dt = bridgeVar(m, s), e = denoise(data, xt, m, s, h);
      const x0 = [xt[0] - e[0], xt[1] - e[1]], yy = [x0[0] + mimg(y[0] - x0[0]), x0[1] + mimg(y[1] - x0[1])];
      const r = dt > 0 ? Math.sqrt(bridgeVar(mp, s) / dt) : 0;
      const res = [0, 1].map((q) => mimg(xt[q] - ((1 - m) * x0[q] + m * yy[q])));
      xt = [0, 1].map((q) => (1 - mp) * x0[q] + mp * yy[q] + r * res[q]);
      path.push([xt[0], xt[1]]); preds.push(x0);
    }
    return { x: [wrap1(xt[0]), wrap1(xt[1])], end: xt, path, preds };
  }
  // 一批初猜上的成功率：终点离真实弛豫结果（同一个初猜在 V 上最速下降）不到 tol 算成功
  function adsScore(data, tests, { eps = 0.5, K = 20, s = 0.02, h = 0.035, tol = 0.03 } = {}) {
    let b = 0, ml = 0;
    for (const p of tests) {
      if (pdist(bridgeSample(data, p.y, { K, s, h }).x, p.x) < tol) b++;
      if (pdist(relaxML(p.y, eps).x, p.x) < tol) ml++;
    }
    return { bridge: b / tests.length, mlip: ml / tests.length, n: tests.length };
  }

  window.MOLASTRIA_NEWS_MODELS = { SURF, SITES, MINIMA, wrap1, mimg, pdist, surfV, surfGrad, mlipErr, mlipV, mlipGrad, descend, relaxTrue, relaxML, rng, adsPairs, bridgeVar, periodicInterp, denoise, bridgeSample, adsScore, MUB_H, gamma, stMix, qFromDg, stYield, gaussAvg, stMixAvg, stYieldAvg, sphere, tripletSticks, broaden, spanMT, zeroField, fromLines, eig3, levelsAt, DIP, dipD, rFromD, branch };
})();
