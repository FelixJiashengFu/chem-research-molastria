'use strict';
// 化学与材料新闻 · 演示用的数学（纯函数，没有 DOM；tools/news-test.mjs 测）。
// 1. 自由基对的单重态–T0 混合（两能级，高场近似）；2. 三重态（S = 1）在 X 波段的粉末 EPR 谱，带自旋极化；
// 3. 三重态的零场能级、ODMR 跃迁和弱磁场下的能级（3×3 精确对角化）；4. 两个电子自旋的点偶极 D 值。
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

  window.MOLASTRIA_NEWS_MODELS = { MUB_H, gamma, stMix, qFromDg, stYield, gaussAvg, stMixAvg, stYieldAvg, sphere, tripletSticks, broaden, spanMT, zeroField, fromLines, eig3, levelsAt, DIP, dipD, rFromD, branch };
})();
