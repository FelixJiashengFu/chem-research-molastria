/* 核磁共振 NMR · 交互式实验室的数学模型（纯函数，不碰 DOM；tools/nmr-test.mjs 用解析解检验）。
   演示 1：脉冲傅里叶变换：FID（衰减的复指数之和）→ 加窗 → 补零 → FFT → 吸收谱；线宽 1/(πT₂*)、截断、匹配滤波、累加的 √N、Ernst 角。
   演示 2：自旋体系的一维谱：n 个自旋 1/2（n ≤ 6）的哈密顿量 H = Σ ν_i I_iz + Σ J_ij I_i·I_j 精确对角化，
           给出每条跃迁的频率和强度；磁场一变，化学位移差（Hz）跟着变，J 不变，所以能看到二级效应怎样随磁场消失。
   演示 3：偶极弛豫（BPP / Solomon）：两个相同自旋相距 r、各向同性转动相关时间 τ_c 时的 T₁、T₂ 和稳态 NOE。
   演示 4：魔角旋转：化学位移各向异性（δ、η）在转速 ν_r 下的旋转边带强度（Herzfeld–Berger 的做法，直接由张量算，不用查表）。
   演示 5：极化度与灵敏度：热平衡极化 P = tanh(γħB/2kT)，电子与核之比（DNP 的上限），超极化相当于省多少次累加。
   单位：频率 Hz，时间 s，磁场 T，温度 K，距离 Å（进公式前换成 m）。 */
(() => {
  'use strict';
  const M = {};
  const TAU = 2 * Math.PI;
  const HBAR = 1.054571817e-34, KB = 1.380649e-23, MU0_4PI = 1e-7;
  // ¹H 的 γ/2π（MHz/T）；其余核按 IUPAC 2001 推荐的频率比 Ξ（相对 ¹H 100%）换算，四到五位有效数字
  M.GAMMA_H = 42.577;
  M.ELECTRON = 28024.95; // 自由电子 γ/2π（MHz/T）
  M.NUCLEI = {
    H1: { label: '¹H', xi: 100, spin: '1/2', abundance: 99.99 },
    H2: { label: '²H', xi: 15.351, spin: '1', abundance: 0.0115 },
    Li7: { label: '⁷Li', xi: 38.864, spin: '3/2', abundance: 92.4 },
    C13: { label: '¹³C', xi: 25.145, spin: '1/2', abundance: 1.07 },
    N15: { label: '¹⁵N', xi: 10.137, spin: '1/2', abundance: 0.36 },
    O17: { label: '¹⁷O', xi: 13.556, spin: '5/2', abundance: 0.038 },
    F19: { label: '¹⁹F', xi: 94.094, spin: '1/2', abundance: 100 },
    Na23: { label: '²³Na', xi: 26.452, spin: '3/2', abundance: 100 },
    Si29: { label: '²⁹Si', xi: 19.867, spin: '1/2', abundance: 4.68 },
    P31: { label: '³¹P', xi: 40.481, spin: '1/2', abundance: 100 },
    Xe129: { label: '¹²⁹Xe', xi: 27.81, spin: '1/2', abundance: 26.4 },
  };
  // 某个核在磁场 B（T）下的 Larmor 频率（MHz，取绝对值）
  M.larmor = (key, B) => (M.GAMMA_H * M.NUCLEI[key].xi / 100) * B;
  // ¹H 频率（MHz）↔ 磁场（T）
  M.fieldOf = (mhz) => mhz / M.GAMMA_H;

  // 可重复的伪随机数（mulberry32）与高斯噪声
  M.rng = (seed) => { let a = seed >>> 0; return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  M.gauss = (rand) => Math.sqrt(-2 * Math.log(1 - rand())) * Math.cos(TAU * rand());

  // ── 演示 1：脉冲傅里叶变换 ────────────────────────────────────────────
  // 原位 radix-2 FFT（长度必须是 2 的幂），约定 X_k = Σ x_n e^{−2πikn/N}
  M.fft = (re, im) => {
    const n = re.length;
    if (n & (n - 1)) throw new Error('FFT length must be a power of two');
    for (let i = 1, j = 0; i < n; i++) {
      let bit = n >> 1;
      for (; j & bit; bit >>= 1) j ^= bit;
      j ^= bit;
      if (i < j) { [re[i], re[j]] = [re[j], re[i]]; [im[i], im[j]] = [im[j], im[i]]; }
    }
    for (let len = 2; len <= n; len <<= 1) {
      const ang = -TAU / len, wr = Math.cos(ang), wi = Math.sin(ang);
      for (let i = 0; i < n; i += len) {
        let cr = 1, ci = 0;
        for (let k = 0; k < len / 2; k++) {
          const a = i + k, b = a + len / 2, xr = re[b] * cr - im[b] * ci, xi = re[b] * ci + im[b] * cr;
          re[b] = re[a] - xr; im[b] = im[a] - xi; re[a] += xr; im[a] += xi;
          const t = cr * wr - ci * wi; ci = cr * wi + ci * wr; cr = t;
        }
      }
    }
    return { re, im };
  };
  // FID：s(t) = Σ a_k exp(i2πf_k t) exp(−t/T2_k)，采样间隔 1/sw，共 n 点；noise 是每点高斯噪声的标准差
  M.fid = (lines, { sw, n, noise = 0, seed = 1 }) => {
    const re = new Float64Array(n), im = new Float64Array(n), dt = 1 / sw, rand = M.rng(seed);
    for (let i = 0; i < n; i++) {
      const t = i * dt;
      for (const l of lines) { const a = (l.amp ?? 1) * Math.exp(-t / l.T2); re[i] += a * Math.cos(TAU * l.f * t); im[i] += a * Math.sin(TAU * l.f * t); }
      if (noise) { re[i] += noise * M.gauss(rand); im[i] += noise * M.gauss(rand); }
    }
    return { re, im, dt };
  };
  // 指数窗（线展宽 lb，Hz）、补零到 size 点，FFT 后给出按频率从低到高排好的吸收谱（实部）和频率轴
  M.spectrum = ({ re, im, dt }, { lb = 0, size } = {}) => {
    const n = re.length, N = size || n, R = new Float64Array(N), I = new Float64Array(N);
    for (let i = 0; i < n; i++) { const w = Math.exp(-Math.PI * lb * i * dt) * (i === 0 ? 0.5 : 1); R[i] = re[i] * w; I[i] = im[i] * w; } // 第一点乘 1/2，去掉基线偏移
    // 约定 s ∝ e^{+i2πft}，所以正频率落在 FFT 的正频率格点上
    M.fft(R, I);
    const sw = 1 / dt, f = new Float64Array(N), y = new Float64Array(N);
    for (let k = 0; k < N; k++) { const j = (k + N / 2) % N; f[k] = (k - N / 2) * sw / N; y[k] = R[j] * dt; }
    return { f, y };
  };
  M.lorentz = (f, f0, T2) => T2 / (1 + (TAU * (f - f0) * T2) ** 2); // 吸收线型，峰高 T₂，面积 1/2
  M.fwhm = (T2) => 1 / (Math.PI * T2); // 半高全宽（Hz）
  // 半高全宽（在采样好的谱上线性内插）
  M.measureWidth = (f, y) => {
    let m = 0; for (let i = 1; i < y.length; i++) if (y[i] > y[m]) m = i;
    const half = y[m] / 2; let a = m, b = m;
    while (a > 0 && y[a] > half) a--;
    while (b < y.length - 1 && y[b] > half) b++;
    const xa = f[a] + (f[a + 1] - f[a]) * (half - y[a]) / (y[a + 1] - y[a]), xb = f[b - 1] + (f[b] - f[b - 1]) * (half - y[b - 1]) / (y[b] - y[b - 1]);
    return { width: xb - xa, peak: f[m], height: y[m] };
  };
  // 重复时间 TR、纵向弛豫 T₁ 下，翻转角 θ（rad）的稳态信号；Ernst 角让它最大
  M.ernstAngle = (TR, T1) => Math.acos(Math.exp(-TR / T1));
  M.steadySignal = (theta, TR, T1) => { const E = Math.exp(-TR / T1); return Math.sin(theta) * (1 - E) / (1 - E * Math.cos(theta)); };

  // ── 演示 2：自旋体系 ──────────────────────────────────────────────────
  // 实对称矩阵的 Jacobi 对角化：返回本征值 w 和本征矢 V（V[i][k] 是第 k 个本征矢的第 i 个分量）
  M.jacobi = (A) => {
    const n = A.length, a = A.map((r) => r.slice()), V = a.map((_, i) => a.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] ** 2;
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = V[k][p], y = V[k][q]; V[k][p] = c * x - s * y; V[k][q] = s * x + c * y; }
      }
    }
    return { w: a.map((r, i) => r[i]), V };
  };
  // 自旋体系：shifts（ppm）、J[i][j]（Hz，i < j）、field（¹H 频率，MHz）。返回跃迁 [{ f（Hz，相对 0 ppm）, ppm, I }]，
  // 强度归一成每个自旋贡献 1（总和 = n）。基矢是乘积态，第 i 位是 1 表示自旋 i 向上（α）。
  M.spinSystem = ({ shifts, J = [], field }) => {
    const n = shifts.length;
    if (n < 1 || n > 6) throw new Error('1–6 spins');
    const nu = shifts.map((d) => d * field), dim = 1 << n, Jij = (i, j) => (J[i] && J[i][j]) || (J[j] && J[j][i]) || 0;
    const blocks = Array.from({ length: n + 1 }, () => []); // 按向上自旋的个数分块
    for (let s = 0; s < dim; s++) { let k = 0; for (let i = 0; i < n; i++) k += (s >> i) & 1; blocks[k].push(s); }
    const m = (s, i) => (((s >> i) & 1) ? 0.5 : -0.5);
    const eig = blocks.map((states) => {
      const idx = new Map(states.map((s, k) => [s, k])), H = states.map(() => new Array(states.length).fill(0));
      states.forEach((s, a) => {
        let d = 0;
        for (let i = 0; i < n; i++) { d += nu[i] * m(s, i); for (let j = i + 1; j < n; j++) d += Jij(i, j) * m(s, i) * m(s, j); }
        H[a][a] = d;
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
          if (((s >> i) & 1) === ((s >> j) & 1)) continue;
          const b = idx.get(s ^ (1 << i) ^ (1 << j)); H[a][b] += Jij(i, j) / 2;
        }
      });
      return { states, idx, ...M.jacobi(H) };
    });
    const out = [];
    for (let k = 1; k <= n; k++) {
      const up = eig[k], lo = eig[k - 1];
      for (let a = 0; a < up.states.length; a++) for (let b = 0; b < lo.states.length; b++) {
        let amp = 0; // ⟨下 | Σ I_i⁻ | 上⟩
        lo.states.forEach((s, q) => { for (let i = 0; i < n; i++) if (!((s >> i) & 1)) { const p = up.idx.get(s | (1 << i)); amp += lo.V[q][b] * up.V[p][a]; } });
        const I = amp * amp / (dim / 2);
        if (I > 1e-9) { const f = up.w[a] - lo.w[b]; out.push({ f, ppm: f / field, I }); }
      }
    }
    return out.sort((x, y) => x.f - y.f);
  };
  // 把频率相差不到 tol（Hz）的跃迁并成一条线
  M.mergeLines = (lines, tol = 1e-3) => {
    const out = [];
    for (const l of lines) { const last = out[out.length - 1]; if (last && Math.abs(l.f - last.f) < tol) { last.f = (last.f * last.I + l.f * l.I) / (last.I + l.I); last.I += l.I; last.ppm = last.f / (l.f / l.ppm || 1); } else out.push({ ...l }); }
    return out;
  };
  // 洛伦兹线型叠加出谱图：ppm 从 hi 到 lo 取 npts 点，线宽 lw（Hz，半高全宽）
  M.renderSpectrum = (lines, { field, lo, hi, npts = 1200, lw = 1 }) => {
    const x = new Float64Array(npts), y = new Float64Array(npts), h = lw / 2;
    for (let k = 0; k < npts; k++) {
      x[k] = lo + (hi - lo) * k / (npts - 1);
      const f = x[k] * field; let s = 0;
      for (const l of lines) s += l.I * h / (Math.PI * ((f - l.f) ** 2 + h * h));
      y[k] = s;
    }
    return { x, y };
  };
  // AB 体系的解析解（检验用）：四条线的频率（相对中心）和强度（总和 2）
  M.abAnalytic = (dnu, Jab) => { const D = Math.hypot(dnu, Jab), s = Jab / D; return [{ f: -(D + Jab) / 2, I: (1 - s) / 2 }, { f: -(D - Jab) / 2, I: (1 + s) / 2 }, { f: (D - Jab) / 2, I: (1 + s) / 2 }, { f: (D + Jab) / 2, I: (1 - s) / 2 }]; };

  // ── 演示 3：偶极弛豫 ──────────────────────────────────────────────────
  const GH = TAU * M.GAMMA_H * 1e6; // ¹H 的 γ（rad s⁻¹ T⁻¹）
  M.dipolarB = (rA) => MU0_4PI * GH * GH * HBAR / (rA * 1e-10) ** 3; // 偶极耦合常数 b（rad/s），两个 ¹H 相距 rA Å
  M.Jw = (w, tc) => tc / (1 + (w * tc) ** 2); // 各向同性转动的谱密度（不含 2/5 的系数）
  // 两个相同的 ¹H：field 是 ¹H 频率（MHz），tc 是转动相关时间（s），r 是距离（Å）
  M.relax = ({ field, tc, r = 1.8 }) => {
    const w = TAU * field * 1e6, b2 = M.dipolarB(r) ** 2, J0 = M.Jw(0, tc), J1 = M.Jw(w, tc), J2 = M.Jw(2 * w, tc);
    const R1 = 0.3 * b2 * (J1 + 4 * J2), R2 = 0.15 * b2 * (3 * J0 + 5 * J1 + 2 * J2);
    const W0 = 0.05 * b2 * J0, W1 = 0.075 * b2 * J1, W2 = 0.3 * b2 * J2;
    return { R1, R2, T1: 1 / R1, T2: 1 / R2, noe: (W2 - W0) / (2 * W1 + W2 + W0), sigma: W2 - W0, x: w * tc, linewidth: R2 / Math.PI };
  };
  // Stokes–Einstein–Debye：球形分子的转动相关时间。mw（Da）、T（K）、eta（Pa·s）；比容 0.73 cm³/g，外加 hyd（Å）的水化层
  M.tauC = ({ mw, T = 298, eta = 0.89e-3, hyd = 3.2 }) => {
    const rA = Math.cbrt(3 * 0.73 * mw / (4 * Math.PI * 6.02214076e23)) * 1e8 + hyd, r = rA * 1e-10;
    return { tc: 4 * Math.PI * eta * r ** 3 / (3 * KB * T), radius: rA };
  };

  // ── 演示 4：魔角旋转的旋转边带 ────────────────────────────────────────
  // 各向异性张量（Haeberlen 约定）：主轴系里 σ_zz = δ，σ_xx = −δ(1+η)/2，σ_yy = −δ(1−η)/2（迹为零），δ 用 Hz。
  // 晶粒取向 (α, β)；转子绕与 B₀ 成 angle 的轴以 ν_r 转。瞬时频率 ν(θ) = b(θ)ᵀ σ b(θ)，b 是转子系里的 B₀ 方向。
  const MAGIC = Math.acos(1 / Math.sqrt(3));
  M.MAGIC = MAGIC;
  const rotorTensor = (delta, eta, a, b) => {
    const ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
    const R = [[cb * ca, -cb * sa, sb], [sa, ca, 0], [-sb * ca, sb * sa, cb]]; // R = Ry(β) Rz(α)：转子轴在主轴系里的方向是 (−sinβ cosα, sinβ sinα, cosβ)，扫过整个球面；绕转子轴的第三个角只改变边带的相位
    const d = [-delta * (1 + eta) / 2, -delta * (1 - eta) / 2, delta], S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) for (let k = 0; k < 3; k++) S[i][j] += R[i][k] * d[k] * R[j][k];
    return S;
  };
  // 一个晶粒在转子相位 θ 处的频率（Hz）
  M.masFreq = (S, theta, angle = MAGIC) => {
    const b = [Math.sin(angle) * Math.cos(theta), Math.sin(angle) * Math.sin(theta), Math.cos(angle)];
    let v = 0; for (let i = 0; i < 3; i++) for (let j = 0; j < 3; j++) v += b[i] * S[i][j] * b[j];
    return v;
  };
  // 旋转边带强度 I_N（N = −order … order，总和 1）。grid 是 α、β 各取多少个取向。
  M.sidebands = ({ delta, eta = 0, rate, order, grid = 24, angle = MAGIC }) => {
    const span = Math.abs(delta) * (1 + eta / 2) / rate; // 调制指数的量级
    const nmax = order ?? Math.min(60, Math.ceil(span * 1.6) + 4), K = 1 << Math.ceil(Math.log2(Math.max(32, 4 * nmax + 8)));
    const I = new Float64Array(2 * nmax + 1), cs = new Float64Array(K), sn = new Float64Array(K);
    for (let k = 0; k < K; k++) { cs[k] = Math.cos(TAU * k / K); sn[k] = Math.sin(TAU * k / K); }
    let wsum = 0;
    for (let ib = 0; ib < grid; ib++) {
      const beta = Math.acos(1 - (2 * ib + 1) / grid); // cosβ 等间隔取中点
      for (let ia = 0; ia < grid; ia++) {
        const alpha = TAU * (ia + 0.5) / grid, S = rotorTensor(delta, eta, alpha, beta);
        // ν(θ) 只有 ±1、±2 阶：取 8 个点做离散傅里叶变换就是精确的
        const c = [[0, 0], [0, 0]]; let mean = 0;
        for (let k = 0; k < 8; k++) { const th = TAU * k / 8, v = M.masFreq(S, th, angle); mean += v / 8; for (let m = 1; m <= 2; m++) { c[m - 1][0] += v * Math.cos(m * th) / 4; c[m - 1][1] += v * Math.sin(m * th) / 4; } }
        // 相位 ξ(θ) = (2π/ν_r) ∫₀^θ (ν − 平均) dθ'/2π = Σ_m [A_m sin mθ + B_m (1 − cos mθ)] / (m ν_r)
        const re = new Float64Array(K), im = new Float64Array(K);
        for (let k = 0; k < K; k++) {
          let xi = 0;
          for (let m = 1; m <= 2; m++) { const j = (m * k) % K; xi += (c[m - 1][0] * sn[j] + c[m - 1][1] * (1 - cs[j])) / (m * rate); }
          re[k] = Math.cos(xi); im[k] = Math.sin(xi);
        }
        M.fft(re, im);
        for (let N = -nmax; N <= nmax; N++) { const j = (N + K) % K; I[N + nmax] += (re[j] * re[j] + im[j] * im[j]) / (K * K); }
        wsum += 1;
        void mean; // 魔角下平均值为零；偏离魔角时它给出残余的粉末展宽，这里只算边带强度
      }
    }
    const list = [];
    for (let N = -nmax; N <= nmax; N++) list.push({ N, f: N * rate, I: I[N + nmax] / wsum });
    return list;
  };
  // 静止粉末谱：把各取向的频率 ν = δ/2 [3cos²β − 1 − η sin²β cos2α] 统计进直方图（面积归一），返回 { f, y }
  M.powder = ({ delta, eta = 0, bins = 160, grid = 220 }) => {
    const lo = -Math.abs(delta) * 1.15, hi = Math.abs(delta) * 1.15, y = new Float64Array(bins), f = new Float64Array(bins), w = (hi - lo) / bins;
    for (let ib = 0; ib < grid; ib++) { const cb = 1 - (2 * ib + 1) / grid, sb2 = 1 - cb * cb; for (let ia = 0; ia < grid; ia++) { const v = (delta / 2) * (3 * cb * cb - 1 - eta * sb2 * Math.cos(2 * TAU * (ia + 0.5) / grid)), k = Math.floor((v - lo) / w); if (k >= 0 && k < bins) y[k] += 1; } }
    for (let k = 0; k < bins; k++) { f[k] = lo + (k + 0.5) * w; y[k] /= grid * grid * w; }
    return { f, y };
  };
  M.csaM2 = (delta, eta = 0) => (delta * delta / 5) * (1 + eta * eta / 3); // 静止粉末谱的二阶矩（Hz²）

  // ── 演示 5：极化度与灵敏度 ────────────────────────────────────────────
  // 自旋 1/2 的热平衡极化；gammaMHz 是 γ/2π（MHz/T）
  M.polarization = (gammaMHz, B, T) => Math.tanh(HBAR * TAU * gammaMHz * 1e6 * B / (2 * KB * T));
  M.nuclearP = (key, B, T) => M.polarization(M.GAMMA_H * M.NUCLEI[key].xi / 100, B, T);
  M.electronP = (B, T) => M.polarization(M.ELECTRON, B, T);
  M.dnpMax = (key) => M.ELECTRON / (M.GAMMA_H * M.NUCLEI[key].xi / 100); // DNP 增强的理论上限 γ_e/γ_n
  // 相对灵敏度（同样数目的核、同样磁场，相对 ¹H）：∝ γ³；乘上天然丰度就是“天然丰度下的接收度”
  M.receptivity = (key) => { const g = M.NUCLEI[key].xi / 100; return { perSpin: g ** 3, natural: g ** 3 * M.NUCLEI[key].abundance / M.NUCLEI.H1.abundance }; };

  // ── 演示 2 的预设自旋体系 ─────────────────────────────────────────────
  // 位移（ppm）和耦合常数（Hz）是这类基团的典型数值，不是某个具体化合物的实测值。J[i][j] 只写 i < j。
  const pairs = (n, list) => { const J = Array.from({ length: n }, () => []); for (const [i, j, v] of list) J[i][j] = v; return J; };
  M.PRESETS = [
    { id: 'ab', zh: '两个耦合的质子（AB → AX）', en: 'Two coupled protons (AB → AX)', shifts: [6.40, 6.15], J: pairs(2, [[0, 1, 12]]) },
    { id: 'ethyl', zh: '乙基 CH₃CH₂–（A₃X₂）', en: 'Ethyl group CH₃CH₂– (A₃X₂)', shifts: [3.60, 3.60, 1.20, 1.20, 1.20], J: pairs(5, [[0, 2, 7], [0, 3, 7], [0, 4, 7], [1, 2, 7], [1, 3, 7], [1, 4, 7]]) },
    { id: 'vinyl', zh: '乙烯基的三个质子（AMX）', en: 'Three vinyl protons (AMX)', shifts: [6.40, 6.10, 5.80], J: pairs(3, [[0, 1, 17.4], [0, 2, 1.5], [1, 2, 10.5]]) },
    { id: 'aabb', zh: '邻位二取代苯（AA′BB′）', en: 'ortho-Disubstituted benzene (AA′BB′)', shifts: [7.45, 7.20, 7.20, 7.45], J: pairs(4, [[0, 1, 8.1], [0, 2, 1.5], [0, 3, 0.3], [1, 2, 7.5], [1, 3, 1.5], [2, 3, 8.1]]) },
  ];

  window.MOLASTRIA_NMR_MODELS = M;
})();
