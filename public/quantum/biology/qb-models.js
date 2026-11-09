/* 量子生物学 · 交互式实验室的数学模型（纯函数，不碰 DOM；tools/quantum-bio-test.mjs 用解析解和独立的时间积分检验）。
   演示 1：FMO 复合物里的激发能传递（Haken–Strobl 纯退相干 + 反应中心捕获 + 激子损失），传递效率由刘维尔算符的线性方程精确求出。
   演示 2：自由基对罗盘：两个电子自旋 + 一个各向异性超精细耦合的核自旋，单重态产率随磁场方向变化（本征分解公式）。
   演示 3：抛物线势垒的隧穿修正（Bell 模型），氢与氘的速率、动力学同位素效应与 Arrhenius 参数。 */
(() => {
  'use strict';
  const M = {};

  // ── 通用：复数矩阵（行优先的 [re, im] 平铺数组）与线性方程 ──────────────
  // 复线性方程组 A x = b，A 为 n×n（re、im 两个 Float64Array），部分主元高斯消元。
  M.solveComplex = (n, Are, Aim, bre, bim) => {
    const ar = Float64Array.from(Are), ai = Float64Array.from(Aim), xr = Float64Array.from(bre), xi = Float64Array.from(bim);
    for (let c = 0; c < n; c++) {
      let p = c, best = 0;
      for (let r = c; r < n; r++) { const m = ar[r * n + c] ** 2 + ai[r * n + c] ** 2; if (m > best) { best = m; p = r; } }
      if (best === 0) throw new Error('singular matrix');
      if (p !== c) {
        for (let k = 0; k < n; k++) { const i = c * n + k, j = p * n + k; [ar[i], ar[j]] = [ar[j], ar[i]]; [ai[i], ai[j]] = [ai[j], ai[i]]; }
        [xr[c], xr[p]] = [xr[p], xr[c]]; [xi[c], xi[p]] = [xi[p], xi[c]];
      }
      const dr = ar[c * n + c], di = ai[c * n + c], dd = dr * dr + di * di;
      for (let r = c + 1; r < n; r++) {
        const er = ar[r * n + c], ei = ai[r * n + c];
        if (er === 0 && ei === 0) continue;
        const fr = (er * dr + ei * di) / dd, fi = (ei * dr - er * di) / dd; // f = e / d
        for (let k = c; k < n; k++) {
          const sr = ar[c * n + k], si = ai[c * n + k];
          ar[r * n + k] -= fr * sr - fi * si; ai[r * n + k] -= fr * si + fi * sr;
        }
        const sr = xr[c], si = xi[c];
        xr[r] -= fr * sr - fi * si; xi[r] -= fr * si + fi * sr;
      }
    }
    for (let r = n - 1; r >= 0; r--) {
      let sr = xr[r], si = xi[r];
      for (let k = r + 1; k < n; k++) { const a = ar[r * n + k], b = ai[r * n + k]; sr -= a * xr[k] - b * xi[k]; si -= a * xi[k] + b * xr[k]; }
      const dr = ar[r * n + r], di = ai[r * n + r], dd = dr * dr + di * di;
      xr[r] = (sr * dr + si * di) / dd; xi[r] = (si * dr - sr * di) / dd;
    }
    return [xr, xi];
  };

  // ── 演示 1：FMO 复合物的激发能传递 ──────────────────────────────────────
  // 七个细菌叶绿素 a 位点的哈密顿量（cm⁻¹，对角元相对 12210 cm⁻¹），Adolphs & Renger (2006)，Ishizaki & Fleming (2009) 采用的数值。
  M.FMO = [
    [410, -87.7, 5.5, -5.9, 6.7, -13.7, -9.9],
    [-87.7, 530, 30.8, 8.2, 0.7, 11.8, 4.3],
    [5.5, 30.8, 210, -53.5, -2.2, -9.6, 6.0],
    [-5.9, 8.2, -53.5, 320, -70.7, -17.0, -63.3],
    [6.7, 0.7, -2.2, -70.7, 480, 81.1, -1.3],
    [-13.7, 11.8, -9.6, -17.0, 81.1, 630, 39.7],
    [-9.9, 4.3, 6.0, -63.3, -1.3, 39.7, 440],
  ];
  M.CM_TO_RADPS = 2 * Math.PI * 2.99792458e10 * 1e-12; // 1 cm⁻¹ 对应的角频率，rad/ps（≈ 0.18837）
  // 主方程（ħ = 1，时间以 ps 计）：
  //   dρ/dt = −i[H, ρ] − {Λ, ρ} − γ (ρ − diag ρ)，Λ = (κ/2)|trap⟩⟨trap| + (Γ/2)·1
  // κ：反应中心从捕获位点取走激发的速率；Γ：激子在每个位点上衰减（荧光、无辐射）的速率；γ：纯退相干率（Haken–Strobl）。
  // 效率 η = κ ∫₀^∞ ρ_trap,trap(t) dt；损失 = Γ ∫₀^∞ Tr ρ(t) dt；η + 损失 = 1。
  // 用 ∫₀^∞ e^{𝓛t} dt = −𝓛⁻¹ 直接解线性方程，不必做时间积分。
  M.liouvillian = (H, { gamma, kappa, loss, trap }) => {
    const n = H.length, N = n * n, re = new Float64Array(N * N), im = new Float64Array(N * N);
    const idx = (a, b) => a * n + b;
    for (let a = 0; a < n; a++) for (let b = 0; b < n; b++) {
      const row = idx(a, b) * N;
      // −i(Hρ − ρH)_{ab} = −i Σ_c H_ac ρ_cb + i Σ_c ρ_ac H_cb
      for (let c = 0; c < n; c++) { im[row + idx(c, b)] -= H[a][c]; im[row + idx(a, c)] += H[c][b]; }
      const la = (a === trap ? kappa / 2 : 0) + loss / 2, lb = (b === trap ? kappa / 2 : 0) + loss / 2;
      re[row + idx(a, b)] -= la + lb + (a === b ? 0 : gamma);
    }
    return { re, im, N };
  };
  // 传递效率与损失。H 的单位是 rad/ps，速率是 1/ps。
  M.transfer = (H, opt) => {
    const n = H.length, { re, im, N } = M.liouvillian(H, opt);
    const br = new Float64Array(N), bi = new Float64Array(N);
    br[opt.start * n + opt.start] = -1; // 𝓛 X = −ρ(0)  ⇒  X = ∫ρ dt
    const [xr] = M.solveComplex(N, re, im, br, bi);
    let tr = 0;
    for (let a = 0; a < n; a++) tr += xr[a * n + a];
    const eff = opt.kappa * xr[opt.trap * n + opt.trap];
    return { efficiency: eff, lost: opt.loss * tr, meanTime: tr }; // meanTime：激发在复合物里平均停留的时间（ps）
  };
  M.fmoH = (scale = M.CM_TO_RADPS) => M.FMO.map((r) => r.map((v) => v * scale));
  // 复矩阵指数 e^{A}（A = re + i·im，n×n）：缩放与平方 + Taylor 级数。
  M.expm = (n, Are, Aim) => {
    let norm = 0;
    for (let r = 0; r < n; r++) { let s = 0; for (let c = 0; c < n; c++) s += Math.hypot(Are[r * n + c], Aim[r * n + c]); norm = Math.max(norm, s); }
    const sq = Math.max(0, Math.ceil(Math.log2(norm / 0.25)));
    const f = 2 ** -sq, ar = Are.map((v) => v * f), ai = Aim.map((v) => v * f);
    const mm = (xr, xi, yr, yi) => {
      const zr = new Float64Array(n * n), zi = new Float64Array(n * n);
      for (let r = 0; r < n; r++) for (let k = 0; k < n; k++) {
        const pr = xr[r * n + k], pi = xi[r * n + k];
        if (pr === 0 && pi === 0) continue;
        for (let c = 0; c < n; c++) { const qr = yr[k * n + c], qi = yi[k * n + c]; zr[r * n + c] += pr * qr - pi * qi; zi[r * n + c] += pr * qi + pi * qr; }
      }
      return [zr, zi];
    };
    let Er = new Float64Array(n * n), Ei = new Float64Array(n * n), Tr = new Float64Array(n * n), Ti = new Float64Array(n * n);
    for (let k = 0; k < n; k++) { Er[k * n + k] = 1; Tr[k * n + k] = 1; }
    for (let j = 1; j <= 16; j++) { // ‖A‖ ≤ 1/4，16 项后余项 < 10⁻¹⁹
      [Tr, Ti] = mm(Tr, Ti, ar, ai);
      for (let k = 0; k < n * n; k++) { Tr[k] /= j; Ti[k] /= j; Er[k] += Tr[k]; Ei[k] += Ti[k]; }
    }
    for (let k = 0; k < sq; k++) [Er, Ei] = mm(Er, Ei, Er, Ei);
    return [Er, Ei];
  };
  // 时间演化：每个输出间隔 dt 的传播子 e^{𝓛dt} 只算一次，对任何 γ 都精确且稳定。
  // 返回每个时刻的位点布居，以及已被反应中心取走的比例 κ∫ρ₃₃dt（梯形积分）。
  M.evolve = (H, opt, tMax, steps) => {
    const n = H.length, dt = tMax / steps, { re, im, N } = M.liouvillian(H, opt);
    const [Pr, Pi] = M.expm(N, re.map((v) => v * dt), im.map((v) => v * dt));
    let r = new Float64Array(N), i = new Float64Array(N);
    r[opt.start * n + opt.start] = 1;
    const tr = opt.trap * n + opt.trap, out = [];
    const add = (t, trapped) => out.push({ t, pop: Array.from({ length: n }, (_, a) => r[a * n + a]), trapped });
    let trapped = 0;
    add(0, 0);
    for (let s = 1; s <= steps; s++) {
      const p0 = r[tr], nr = new Float64Array(N), ni = new Float64Array(N);
      for (let a = 0; a < N; a++) {
        let sr = 0, si = 0;
        for (let b = 0; b < N; b++) { const xr = r[b], xi = i[b]; if (xr === 0 && xi === 0) continue; const pr = Pr[a * N + b], pi = Pi[a * N + b]; sr += pr * xr - pi * xi; si += pr * xi + pi * xr; }
        nr[a] = sr; ni[a] = si;
      }
      r = nr; i = ni;
      trapped += opt.kappa * 0.5 * (p0 + r[tr]) * dt;
      add(s * dt, trapped);
    }
    return out;
  };

  // ── 演示 2：自由基对罗盘 ────────────────────────────────────────────────
  // 自旋算符（ħ = 1）：电子 1、电子 2、核 I = 1/2，基矢 |m1 m2 mI⟩，共 8 维。场在 xz 平面内、超精细张量为对角时 H 是实对称矩阵。
  const sx = [[0, 0.5], [0.5, 0]], sz = [[0.5, 0], [0, -0.5]], syI = [[0, -0.5], [0.5, 0]]; // σy/2 = i·syI
  const id2 = [[1, 0], [0, 1]];
  const kron = (A, B) => A.flatMap((ra) => B.map((rb) => ra.flatMap((a) => rb.map((b) => a * b))));
  const k3 = (a, b, c) => kron(kron(a, b), c);
  const addM = (A, B, s = 1) => A.map((r, i) => r.map((v, j) => v + s * B[i][j]));
  const mul = (A, B) => A.map((r) => B[0].map((_, j) => r.reduce((t, v, k) => t + v * B[k][j], 0)));
  M.GAMMA_E = 176.0859630; // 电子旋磁比 |γe|（g ≈ 2.0023），单位 rad μs⁻¹ mT⁻¹（= 1.7609 × 10¹¹ rad s⁻¹ T⁻¹）
  // H（rad/μs）：B 以 μT 计、方向与 z 轴夹角 θ；超精细张量 A = diag(ax, ay, az)，单位 mT（乘 γe 变成角频率）。
  M.rpHamiltonian = ({ B, theta, ax, ay, az }) => {
    const w = M.GAMMA_E * B * 1e-3, bx = w * Math.sin(theta), bz = w * Math.cos(theta);
    let H = Array.from({ length: 8 }, () => new Array(8).fill(0));
    for (const e of [0, 1]) { // 两个电子的 Zeeman 项
      const ops = (o) => (e === 0 ? k3(o, id2, id2) : k3(id2, o, id2));
      H = addM(H, ops(sx), bx); H = addM(H, ops(sz), bz);
    }
    // 电子 1 与核的超精细耦合 S1·A·I。S1y·Iy = (i·syI)⊗(i·syI) = −syI⊗syI，仍是实矩阵。
    const g = M.GAMMA_E;
    H = addM(H, k3(sx, id2, sx), g * ax);
    H = addM(H, k3(syI, id2, syI), -g * ay);
    H = addM(H, k3(sz, id2, sz), g * az);
    return H;
  };
  // 单重态投影 P_S = 1/4 − S1·S2（作用在电子上），再乘核的单位算符
  M.singletProjector = () => {
    let S = Array.from({ length: 8 }, (_, i) => Array.from({ length: 8 }, (_, j) => (i === j ? 0.25 : 0)));
    S = addM(S, k3(sx, sx, id2), -1); S = addM(S, k3(sz, sz, id2), -1);
    S = addM(S, k3(syI, syI, id2), 1); // −S1y S2y = +syI⊗syI
    return S;
  };
  // 实对称矩阵的 Jacobi 本征分解：返回本征值 w 与本征矢（V 的列）
  M.jacobi = (A0) => {
    const n = A0.length, A = A0.map((r) => r.slice()), V = A0.map((_, i) => A0.map((__, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += A[p][q] ** 2;
      if (off < 1e-26) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(A[p][q]) < 1e-300) continue;
        const th = (A[q][q] - A[p][p]) / (2 * A[p][q]), t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = A[k][p], akq = A[k][q]; A[k][p] = c * akp - s * akq; A[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = A[p][k], aqk = A[q][k]; A[p][k] = c * apk - s * aqk; A[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    return { w: A.map((r, i) => r[i]), V };
  };
  // 单重态产率（指数复合模型，单重态与三重态以同一速率 k 反应；Timmel et al. 1998）：
  //   Φ_S = (1/M) Σ_{m,n} |⟨m|P_S|n⟩|² k² / (k² + ω_mn²)，M = 2（核自旋态数）
  const PS = M.singletProjector();
  M.singletYield = (p) => {
    const { w, V } = M.jacobi(M.rpHamiltonian(p));
    const P = mul(mul(V[0].map((_, j) => V.map((r) => r[j])), PS), V); // Vᵀ P_S V
    const k = p.k;
    let s = 0;
    for (let m = 0; m < 8; m++) for (let n = 0; n < 8; n++) { const d = w[m] - w[n]; s += P[m][n] ** 2 * (k * k) / (k * k + d * d); }
    return s / 2;
  };
  // 独立核对用：直接做时间演化，Φ_S = k ∫ e^{−kt} Tr[P_S ρ(t)] dt（ρ(0) = P_S / 2）
  M.singletYieldTime = (p, tMax, steps) => {
    const { w, V } = M.jacobi(M.rpHamiltonian(p));
    const P = mul(mul(V[0].map((_, j) => V.map((r) => r[j])), PS), V);
    const dt = tMax / steps;
    let s = 0;
    for (let i = 0; i <= steps; i++) {
      const t = i * dt;
      let ps = 0; // Tr[P_S e^{−iHt} P_S e^{iHt}]/2 = (1/2) Σ |P_mn|² cos(ω_mn t)
      for (let m = 0; m < 8; m++) for (let n = 0; n < 8; n++) ps += P[m][n] ** 2 * Math.cos((w[m] - w[n]) * t);
      s += (i === 0 || i === steps ? 0.5 : 1) * p.k * Math.exp(-p.k * t) * ps / 2;
    }
    return s * dt;
  };
  M.yieldCurve = (p, n = 91) => Array.from({ length: n }, (_, i) => { const th = (Math.PI * i) / (n - 1); return [th, M.singletYield({ ...p, theta: th })]; });

  // ── 演示 3：抛物线势垒的隧穿与同位素效应 ────────────────────────────────
  // 能量用 kJ/mol，频率用 cm⁻¹（1 cm⁻¹ = 0.01196266 kJ/mol），R = 8.314462618e-3 kJ mol⁻¹ K⁻¹。
  M.CM_TO_KJ = 0.0119626566;
  M.R = 8.314462618e-3;
  // 穿透概率（Bell 的抛物线势垒）：P(E) = 1 / (1 + exp(2π(V − E)/(hν‡)))
  M.transmission = (E, V, hnu) => 1 / (1 + Math.exp((2 * Math.PI * (V - E)) / hnu));
  // 隧穿修正 Q = 量子速率 / 经典速率 = ∫₀^∞ P(E) e^{−(E−V)/RT} dE / RT（反应物处 E = 0，势垒在 E = V 处截断）
  M.tunnelQ = (V, hnu, T, n = 4000) => {
    const kT = M.R * T, top = V + 40 * kT, h = top / n;
    let s = 0;
    for (let i = 0; i <= n; i++) {
      const E = i * h, f = M.transmission(E, V, hnu) * Math.exp(-(E - V) / kT);
      s += (i === 0 || i === n ? 1 : i % 2 ? 4 : 2) * f;
    }
    return (s * h) / 3 / kT;
  };
  // 无限抛物线势垒的解析结果（u = hν‡/kT < 2π）：Q = (u/2) / sin(u/2)
  M.bellInfinite = (hnu, T) => { const u = hnu / (M.R * T); return u < 2 * Math.PI ? u / 2 / Math.sin(u / 2) : Infinity; };
  // 速率（任意单位）：k = Q · exp(−V_eff/RT)，V_eff = V0 − ZPE，ZPE = ½hν(C–H 伸缩)；氘的频率按 1/√2 缩放（只计质量，忽略非谐性）
  M.isotope = ({ V0, nuCH, nuBarrier, T, tunnel = true }) => {
    const rt = Math.SQRT1_2, out = {};
    for (const [iso, f] of [['H', 1], ['D', rt]]) {
      const zpe = 0.5 * nuCH * f * M.CM_TO_KJ, V = V0 - zpe, hnu = nuBarrier * f * M.CM_TO_KJ;
      const Q = tunnel ? M.tunnelQ(V, hnu, T) : 1;
      out[iso] = { V, Q, k: Q * Math.exp(-V / (M.R * T)) };
    }
    out.kie = out.H.k / out.D.k;
    return out;
  };
  // 在 [T1, T2] 上对 ln k − 1/T 做线性拟合，得到表观活化能 Ea 与指前因子 A（与速率同单位）
  M.arrhenius = (p, T1 = 278, T2 = 318, n = 9) => {
    const pts = Array.from({ length: n }, (_, i) => { const T = T1 + ((T2 - T1) * i) / (n - 1); return [1 / T, M.isotope({ ...p, T })]; });
    const fit = (iso) => {
      const xs = pts.map((q) => q[0]), ys = pts.map((q) => Math.log(q[1][iso].k));
      const mx = xs.reduce((a, b) => a + b) / n, my = ys.reduce((a, b) => a + b) / n;
      const slope = xs.reduce((t, x, i) => t + (x - mx) * (ys[i] - my), 0) / xs.reduce((t, x) => t + (x - mx) ** 2, 0);
      return { Ea: -slope * M.R, lnA: my - slope * mx };
    };
    const H = fit('H'), D = fit('D');
    return { H, D, ratioA: Math.exp(H.lnA - D.lnA), dEa: D.Ea - H.Ea };
  };

  window.MOLASTRIA_QB_MODELS = M;
})();
