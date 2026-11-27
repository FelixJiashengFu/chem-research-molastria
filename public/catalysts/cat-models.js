'use strict';
// 人工催化剂（/catalysts/）十四个演示的数学。全部是纯函数（同一个种子同一个结果），没有 DOM；tools/cat-test.mjs 对照解析解和教科书数值测。
// 没有复制任何程序的代码：每一项都按教科书或论文里的公式自己写成最小的版本（Eyring 方程、主客体的热力学循环、
// 1:1 结合的精确解和拟合、米氏动力学的数值积分、库仑和 Born 静电、Langmuir 等温线、能量跨度模型的火山图、
// OER 的标度关系、球形颗粒的分散度、正态次序统计量、回归树与随机森林和它的精确 Shapley 值）。
(() => {
  // ── 常数和通用工具 ────────────────────────────────────────────────────
  const R_KCAL = 1.98720425e-3;      // kcal/(mol·K)
  const KB_H = 2.083661912e10;       // k_B/h，单位 s⁻¹K⁻¹
  const COUL = 332.0637;             // e²/(4πε₀·Å) 换成 kcal/mol
  const NA = 6.02214076e23;

  const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a = (a + 0x6d2b79f5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };
  const gauss = (R) => { let u = 0; while (u === 0) u = R(); return Math.sqrt(-2 * Math.log(u)) * Math.cos(2 * Math.PI * R()); };
  const mean = (a) => a.reduce((s, v) => s + v, 0) / (a.length || 1);
  const variance = (a) => { const m = mean(a); return a.reduce((s, v) => s + (v - m) ** 2, 0) / Math.max(1, a.length - 1); };
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const clamp = (v, a, b) => Math.min(b, Math.max(a, v));

  // ── 1. Eyring 方程：速率、垒高和加速倍数 ──────────────────────────────
  const eyring = (dG, T = 298.15) => KB_H * T * Math.exp(-dG / (R_KCAL * T));          // s⁻¹
  const dGfromRate = (k, T = 298.15) => -R_KCAL * T * Math.log(k / (KB_H * T));
  const kcalPerDecade = (T = 298.15) => R_KCAL * T * Math.LN10;                         // 298.15 K 时 1.3642
  const rateRatio = (ddG, T = 298.15) => Math.exp(ddG / (R_KCAL * T));                  // 垒降低 ddG 换来的倍数
  const ddGFromRatio = (ratio, T = 298.15) => R_KCAL * T * Math.log(ratio);
  const decades = (ddG, T = 298.15) => ddG / kcalPerDecade(T);
  // 半衰期（一级反应）
  const halfLife = (k) => Math.LN2 / k;

  // ── 2. 预组织和有效摩尔浓度 ───────────────────────────────────────────
  // 分子内反应（一级，s⁻¹）和分子间反应（二级，M⁻¹s⁻¹）之比就是有效摩尔浓度，单位 mol/L。
  const effectiveMolarity = (kIntra, kInter) => kIntra / kInter;
  // 把 EM 换成自由能：相当于把一个二级反应变成一级省下来的自由能（标准态 1 M）
  const emToDG = (EM, T = 298.15) => -R_KCAL * T * Math.log(EM);
  // 把两个分子绑在一起要付的熵：平动加转动，粗略的 Page–Jencks 估计（每个自由度约 R ln q）
  const bindingEntropyCost = (T = 298.15, perMode = 1.2) => perMode * 6 * (T / 298.15); // kcal/mol，只作量级

  // ── 3. 主客体的热力学循环：笼结合过渡态比结合底物强多少，就是加速多少 ──
  // 催化的上限：k_cat/k_uncat = K_TS / K_S（Pauling / Kurz 的关系）。
  const cageAccel = (KS, KTS) => KTS / KS;
  // 饱和动力学：底物占住笼的比例，以及产物抑制
  const occupancy = (K, c, cP = 0, KP = 0) => (K * c) / (1 + K * c + KP * cP);
  // 一个循环的表观速率（笼浓度 E0、底物 S、产物 P）
  const cageRate = (p) => {
    const { E0, S, P = 0, KS, KP = 0, kcat } = p;
    return kcat * E0 * occupancy(KS, S, P, KP);
  };
  // 催化循环的能量跨度：笼结合底物太强，决速的就变成“爬出势阱”
  const spanOfCycle = (states) => {           // states: [{G, ts}] 沿循环排好的自由能
    let best = -Infinity, at = [0, 0];
    for (let i = 0; i < states.length; i++) for (let j = 0; j < states.length; j++) {
      if (!states[j].ts || states[i].ts) continue;
      const d = states[j].G - states[i].G + (j < i ? (states.cycle || 0) : 0);
      if (d > best) { best = d; at = [i, j]; }
    }
    return { span: best, tdi: at[0], tdts: at[1] };
  };

  // ── 4. 1:1 结合：精确解、滴定曲线和拟合 ───────────────────────────────
  // H + G ⇌ HG，总浓度 h0、g0，结合常数 Ka（M⁻¹）：复合物浓度是二次方程的小根
  function complexConc(h0, g0, Ka) {
    if (Ka <= 0) return 0;
    const b = h0 + g0 + 1 / Ka;
    return (b - Math.sqrt(Math.max(0, b * b - 4 * h0 * g0))) / 2;
  }
  // 核磁滴定：固定主体浓度，加客体，观测位移 Δδ = Δδ_max · [HG]/[H]₀
  const titrationCurve = (h0, guests, Ka, dmax) => guests.map((g) => (dmax * complexConc(h0, g, Ka)) / h0);
  // 拟合 Ka：对数网格扫 Ka，每个 Ka 下 Δδ_max 有线性最小二乘的闭式解
  function fitKa(h0, guests, obs, range = [1, 1e7], steps = 600) {
    let best = { Ka: range[0], dmax: 0, rss: Infinity };
    const scan = (lo, hi, n) => {
      for (let i = 0; i < n; i++) {
        const Ka = Math.exp(Math.log(lo) + ((Math.log(hi) - Math.log(lo)) * i) / (n - 1));
        const f = guests.map((g) => complexConc(h0, g, Ka) / h0);
        let num = 0, den = 0;
        for (let k = 0; k < obs.length; k++) { num += f[k] * obs[k]; den += f[k] * f[k]; }
        const dmax = den > 0 ? num / den : 0;
        let rss = 0;
        for (let k = 0; k < obs.length; k++) rss += (dmax * f[k] - obs[k]) ** 2;
        if (rss < best.rss) best = { Ka, dmax, rss };
      }
    };
    scan(range[0], range[1], steps);
    scan(best.Ka / 3, best.Ka * 3, steps);   // 再细扫一遍
    return best;
  }
  const dGofK = (Ka, T = 298.15) => -R_KCAL * T * Math.log(Ka);

  // ── 5. 米氏动力学：数值积分（RK4）和稳态近似 ─────────────────────────
  // E + S ⇌ ES → E + P，产物可以结合回去（竞争性抑制，常数 KP）
  function mmSimulate(p) {
    const { e0, s0, k1, km1, k2, KP = 0, tEnd, steps = 2000 } = p;
    const dt = tEnd / steps;
    // 变量：[S, ES, P]，自由酶 E = (e0 − ES)/(1 + K_P[P])（产物结合按快速平衡折进自由酶里），
    // 底物由物料平衡给出 S = s0 − ES − P，所以三项永远守恒。
    // 结合这一步比化学那一步快几个数量级（k₁ 常取 10⁷ M⁻¹s⁻¹），显式积分不论切多少子步都会炸，
    // 所以对 ES 用指数积分：固定 S、P 时 dES/dt = a·e0 − λ·ES 是线性的，这一步的精确解是
    //   ES(h) = ES∞ + (ES₀ − ES∞)·e^{−λh}，  ΔP = k₂·[ES∞·h + (ES₀ − ES∞)(1 − e^{−λh})/λ]。
    // 步长再大也稳定（大步长自动退化成稳态近似），小步长仍能看到预稳态那一段爬升。
    let S = s0, ES = 0, P = 0;
    const t = [0], sS = [S], sES = [ES], sP = [P];
    const sub = 4, h = dt / sub;
    const step = (S_, ES_, P_, dtv) => {
      const a = (k1 * S_) / (1 + KP * P_);
      const lam = a + km1 + k2;
      const inf = lam > 0 ? (a * e0) / lam : 0;
      const dec = Math.exp(-lam * dtv);
      const esNew = inf + (ES_ - inf) * dec;
      const dP = k2 * (inf * dtv + ((ES_ - inf) * (1 - dec)) / (lam || 1));
      return [esNew, dP];
    };
    for (let i = 0; i < steps; i++) {
      for (let j = 0; j < sub; j++) {
        // 预估 — 校正：先走半步取中点的 S、P，再用中点的系数走整步
        const [esHalf, dPHalf] = step(S, ES, P, h / 2);
        const Pm = P + dPHalf, Sm = Math.max(0, s0 - esHalf - Pm);
        const [esNew, dP] = step(Sm, ES, Pm, h);
        ES = clamp(esNew, 0, e0);
        P = clamp(P + dP, 0, s0 - ES);
        S = Math.max(0, s0 - ES - P);
      }
      t.push((i + 1) * dt); sS.push(S); sES.push(ES); sP.push(P);
    }
    return { t, S: sS, ES: sES, P: sP, TON: P / e0, TOF: P / e0 / tEnd };
  }
  const KM = (k1, km1, k2) => (km1 + k2) / k1;
  const mmRate = (s, e0, kcat, Km) => (kcat * e0 * s) / (Km + s);
  // 催化效率和扩散极限
  const efficiency = (kcat, Km) => kcat / Km;

  // ── 6. 笼内静电：库仑和 Born ─────────────────────────────────────────
  const coulomb = (q1, q2, r, eps = 1) => (COUL * q1 * q2) / (eps * r);       // kcal/mol，r 单位 Å
  const bornSolv = (q, r, eps) => -(COUL / 2) * (q * q / r) * (1 - 1 / eps);  // kcal/mol
  // 底物带电 qS、过渡态带电 qTS，笼总电荷 Q 均匀分布在半径 R 的球壳上：
  // 球壳内部的电势处处相同，所以稳定化只取决于电荷的变化量
  const cageElectrostatic = (p) => {
    const { Q, R, eps, qS, qTS } = p;
    const phi = (q) => coulomb(Q, q, R, eps);
    return { gS: phi(qS), gTS: phi(qTS), ddG: phi(qTS) - phi(qS) };
  };

  // ── 7. Langmuir 等温线和孔内富集 ──────────────────────────────────────
  const langmuir = (p, K) => (K * p) / (1 + K * p);
  // 孔里的浓度比本体高多少：按分配系数 K_p = exp(−ΔG_ads/RT)
  const enrichment = (dGads, T = 298.15) => Math.exp(-dGads / (R_KCAL * T));
  // 两个底物都要进同一个孔：孔内的二级反应速率比本体高 enrichment²（孔体积有限时饱和）
  function poreRate(p) {
    const { dGads, cBulk, poreVol, T = 298.15, kInter } = p;  // poreVol：每升材料的孔体积（L/L）
    const Kp = enrichment(dGads, T);
    const cPore = (Kp * cBulk) / (1 + (Kp * cBulk) / (p.cMax || 10));   // 孔内浓度，到 cMax 饱和
    return { Kp, cPore, rate: kInter * cPore * cPore * poreVol, bulk: kInter * cBulk * cBulk };
  }

  // ── 8. 火山图：Sabatier 原理的最小模型 ────────────────────────────────
  // x = 吸附自由能 ΔG_ads（eV，负值表示结合强）。两条 BEP 直线给出两个表观垒：
  //   吸附和活化这一步从空位算起：ΔG‡₁ = max(0, b₁ + a₁·x)（结合越强越容易）
  //   表面反应和脱附这一步从吸附态算起：ΔG‡₂ = max(0, b₂ − a₂·x)（结合越强越难爬出来）
  // 决速的是两者里大的那个，所以 TOF 对 x 画出来是一座山。
  const EV_KCAL = 23.060548;
  function volcanoTOF(x, p) {
    const { a1 = 0.5, a2 = 0.5, b1 = 1.1, b2 = 0.8, T = 500 } = p || {};
    const ts1 = Math.max(0, b1 + a1 * x), ts2 = Math.max(0, b2 - a2 * x);
    const barrier = Math.max(ts1, ts2);
    const RT = R_KCAL * T;
    return { ts1, ts2, barrier, limiting: ts1 >= ts2 ? 1 : 2, logTOF: Math.log10(KB_H * T) - (barrier * EV_KCAL) / (RT * Math.LN10) };
  }
  // 山顶：两条直线相交的地方，闭式解
  function volcanoPeak(p) {
    const { a1 = 0.5, a2 = 0.5, b1 = 1.1, b2 = 0.8 } = p || {};
    return (b2 - b1) / (a1 + a2);
  }

  // ── 9. 标度关系：OER 四步和 0.37 V 的极限 ────────────────────────────
  // 四个电化学步骤的自由能差（eV）。标度关系把 ΔG_OOH 钉死在 ΔG_OH + Δ（实测 Δ ≈ 3.2 eV）。
  function oerSteps(dGOH, dGO, scaling = 3.2) {
    const dGOOH = dGOH + scaling;
    const s = [dGOH, dGO - dGOH, dGOOH - dGO, 4.92 - dGOOH];
    const max = Math.max(...s);
    return { steps: s, dGOOH, eta: max - 1.23, limiting: s.indexOf(max) };
  }
  // 固定标度关系时，最好的催化剂：两个中间步骤相等，η = Δ/2 − 1.23
  const oerLimit = (scaling = 3.2) => scaling / 2 - 1.23;

  // ── 10. ee 和 ΔΔG‡ ───────────────────────────────────────────────────
  const eeToDdG = (ee, T = 298.15) => { const e = clamp(Math.abs(ee), 0, 0.999999); return R_KCAL * T * Math.log((1 + e) / (1 - e)); };
  const ddGToEe = (ddG, T = 298.15) => { const r = Math.exp(ddG / (R_KCAL * T)); return (r - 1) / (r + 1); };
  const erOf = (ee) => (1 + ee) / (1 - ee);
  // 同一个 ΔΔG‡ 在别的温度下的 ee（只在 ΔΔH‡、ΔΔS‡ 都给出时才真的能外推）
  const eeAtT = (dH, dS, T) => ddGToEe(dH - T * dS / 1000, T);

  // ── 11. 纳米颗粒：表面原子数、分散度和每位点活性 ─────────────────────
  // n：每 nm³ 多少个原子（由密度和摩尔质量算）；sigma：每 nm² 多少个表面位点
  const atomDensity = (rho, M) => (rho * NA) / (M * 1e21);     // g/cm³、g/mol → 原子/nm³
  function particle(d, rho, M, sigma) {
    const n = atomDensity(rho, M);
    const total = (Math.PI / 6) * d * d * d * n;
    const surf = Math.min(total, Math.PI * d * d * sigma);
    return { nPerNm3: n, total, surface: surf, dispersion: surf / total };
  }
  // 把“每个颗粒”的活性换成“每个表面位点”的活性
  const perSite = (kcatParticle, surfaceAtoms) => kcatParticle / surfaceAtoms;

  // ── 12. 活性位点的几何精度：三个催化基团摆歪了损失多少 ───────────────
  // 一个氢键的能量：距离用 12–10 势（最低点 r0、深度 D），角度用 cos²θ（θ 是偏离直线的角）
  function hbond(r, theta, D = 2.5, r0 = 2.9) {
    const x = r0 / Math.max(0.5, r);
    const radial = D * (5 * x ** 12 - 6 * x ** 10);              // r = r0 时正好是 −D
    const ang = Math.cos(clamp(theta, -Math.PI / 2, Math.PI / 2)) ** 2;
    return radial * ang;                                         // 负值表示稳定
  }
  // 三个基团各有自己的偏差：总稳定化，以及相对完美摆放损失了多少倍速率
  function activeSite(groups, T = 298.15, D = 2.5, r0 = 2.9) {
    const now = groups.reduce((s, g) => s + hbond(r0 + g.dr, g.dth, D, r0), 0);
    const ideal = groups.length * hbond(r0, 0, D, r0);
    const lost = now - ideal;                                    // ≥ 0，越大越糟
    return { now, ideal, lost, factor: Math.exp(-lost / (R_KCAL * T)) };
  }

  // ── 13. 筛选的通量：期望最好的一个 ────────────────────────────────────
  const probAtLeast = (n, p) => 1 - (1 - p) ** n;
  // n 个标准正态里最大值的期望：E[max] = n∫ z φ(z) Φ(z)^{n−1} dz，用辛普森法积分
  function expectedBestZ(n) {
    if (n < 1) return 0;
    const f = (z) => z * Math.exp(-z * z / 2) / Math.sqrt(2 * Math.PI) * Phi(z) ** (n - 1);
    const a = -9, b = 9, m = 4000, h = (b - a) / m;
    let s = f(a) + f(b);
    for (let i = 1; i < m; i++) s += f(a + i * h) * (i % 2 ? 4 : 2);
    return (n * s * h) / 3;
  }
  const erf = (x) => { const t = 1 / (1 + 0.5 * Math.abs(x)); const y = t * Math.exp(-x * x - 1.26551223 + t * (1.00002368 + t * (0.37409196 + t * (0.09678418 + t * (-0.18628806 + t * (0.27886807 + t * (-1.13520398 + t * (1.48851587 + t * (-0.82215223 + t * 0.17087277))))))))); return x >= 0 ? 1 - y : y - 1; };
  const Phi = (z) => 0.5 * (1 + erf(z / Math.SQRT2));
  // 一条流程：每个候选要多少天、一共多少天 → 能测多少个；再换成期望最好的活性（对数速率按正态分布）
  function screen(p) {
    const { daysEach, days, mu, sigma, threshold } = p;
    const n = Math.max(1, Math.floor(days / daysEach));
    const best = mu + sigma * expectedBestZ(n);
    const pOne = 1 - Phi((threshold - mu) / sigma);
    return { n, best, pOne, pAny: probAtLeast(n, pOne) };
  }

  // ── 14. 回归树、随机森林和它的精确 Shapley 值 ────────────────────────
  // 玩具数据集：五个按物理意义选的描述符 → 活化自由能。规律是我们自己定的，不是任何论文的数据。
  const FEATURES = ['preorg', 'volume', 'esp', 'bite', 'flex'];
  function cageData(n = 120, seed = 7, noise = 0.25) {
    const R = rng(seed), X = [], y = [];
    for (let i = 0; i < n; i++) {
      const preorg = R(), volume = 80 + 320 * R(), esp = -40 + 90 * R(), bite = 70 + 50 * R(), flex = R();
      // 真实规律：预组织好、静电正、夹角靠近 92°、柔性低 → 垒低；体积只在太小的时候有害
      const g = 22 - 4.5 * preorg - 0.035 * esp + 0.9 * Math.abs(bite - 92) / 10 + 2.2 * flex
        + (volume < 140 ? (140 - volume) * 0.02 : 0) + noise * gauss(R);
      X.push([preorg, volume, esp, bite, flex]); y.push(g);
    }
    return { X, y, names: FEATURES };
  }
  function splitBest(X, y, idx, feats, minLeaf) {
    let best = null;
    for (const f of feats) {
      const order = [...idx].sort((a, b) => X[a][f] - X[b][f]);
      let sl = 0, sr = order.reduce((s, i) => s + y[i], 0), nl = 0, nr = order.length;
      for (let k = 0; k < order.length - 1; k++) {
        const i = order[k];
        sl += y[i]; sr -= y[i]; nl++; nr--;
        if (nl < minLeaf || nr < minLeaf) continue;
        if (X[order[k + 1]][f] === X[i][f]) continue;
        const gain = (sl * sl) / nl + (sr * sr) / nr;
        if (!best || gain > best.gain) best = { f, thr: (X[i][f] + X[order[k + 1]][f]) / 2, gain, left: order.slice(0, k + 1), right: order.slice(k + 1) };
      }
    }
    return best;
  }
  function growTree(X, y, idx, p, depth = 0) {
    const { maxDepth = 6, minLeaf = 3, mtry = 2, R } = p;
    const value = mean(idx.map((i) => y[i]));
    if (depth >= maxDepth || idx.length < 2 * minLeaf) return { value, n: idx.length };
    const all = [...X[0].keys()];
    const feats = [];
    while (feats.length < Math.min(mtry, all.length)) { const f = all[Math.floor(R() * all.length)]; if (!feats.includes(f)) feats.push(f); }
    const s = splitBest(X, y, idx, feats, minLeaf);
    if (!s) return { value, n: idx.length };
    return { value, n: idx.length, f: s.f, thr: s.thr, L: growTree(X, y, s.left, p, depth + 1), Rt: growTree(X, y, s.right, p, depth + 1) };
  }
  const treePredict = (t, x) => (t.f === undefined ? t.value : treePredict(x[t.f] <= t.thr ? t.L : t.Rt, x));
  function buildForest(X, y, opt = {}) {
    const { trees = 60, seed = 3 } = opt, R = rng(seed), out = [], oob = [];
    for (let t = 0; t < trees; t++) {
      const idx = [], inBag = new Set();
      for (let i = 0; i < X.length; i++) { const j = Math.floor(R() * X.length); idx.push(j); inBag.add(j); }
      out.push(growTree(X, y, idx, { ...opt, R }));
      oob.push([...X.keys()].filter((i) => !inBag.has(i)));
    }
    return { trees: out, oob, X, y };
  }
  const forestPredict = (F, x) => mean(F.trees.map((t) => treePredict(t, x)));
  // 袋外预测：每个样本只用没见过它的树来预测，这是随机森林自带的留出集
  function oobPredict(F) {
    return F.X.map((x, i) => {
      const vs = F.trees.filter((_, t) => F.oob[t].includes(i)).map((t) => treePredict(t, x));
      return vs.length ? mean(vs) : forestPredict(F, x);
    });
  }
  function metrics(yTrue, yPred) {
    const n = yTrue.length, m = mean(yTrue);
    let ae = 0, se = 0, tot = 0;
    for (let i = 0; i < n; i++) { ae += Math.abs(yTrue[i] - yPred[i]); se += (yTrue[i] - yPred[i]) ** 2; tot += (yTrue[i] - m) ** 2; }
    return { mae: ae / n, rmse: Math.sqrt(se / n), r2: 1 - se / (tot || 1) };
  }
  // 置换重要性：把一列打乱，看袋外误差变差多少
  function permImportance(F, seed = 11) {
    const base = metrics(F.y, oobPredict(F)).rmse, R = rng(seed);
    return F.X[0].map((_, f) => {
      const X2 = F.X.map((row) => [...row]);
      const col = X2.map((r) => r[f]);
      for (let i = col.length - 1; i > 0; i--) { const j = Math.floor(R() * (i + 1)); [col[i], col[j]] = [col[j], col[i]]; }
      X2.forEach((r, i) => { r[f] = col[i]; });
      const pred = X2.map((x, i) => { const vs = F.trees.filter((_, t) => F.oob[t].includes(i)).map((t) => treePredict(t, x)); return vs.length ? mean(vs) : forestPredict(F, x); });
      return metrics(F.y, pred).rmse - base;
    });
  }
  // 精确的 Shapley 值（介入式）：特征少的时候可以把 2^d 个子集全枚举，背景取训练集的一个子样本。
  // 满足效率公理：Σφ = f(x) − E[f]，tools/cat-test.mjs 对照检验。
  function shapley(F, x, background) {
    const d = x.length, bg = background, phi = new Array(d).fill(0);
    const val = (set) => {                       // 只固定 set 里的特征，其余按背景取平均
      let s = 0;
      for (const b of bg) { const z = b.map((v, k) => (set.includes(k) ? x[k] : v)); s += forestPredict(F, z); }
      return s / bg.length;
    };
    const cache = new Map();
    const V = (set) => { const key = set.join(','); if (!cache.has(key)) cache.set(key, val(set)); return cache.get(key); };
    const fact = (k) => { let r = 1; for (let i = 2; i <= k; i++) r *= i; return r; };
    const subsets = (arr) => arr.reduce((acc, v) => acc.concat(acc.map((s) => [...s, v])), [[]]);
    for (let i = 0; i < d; i++) {
      const others = [...Array(d).keys()].filter((k) => k !== i);
      for (const S of subsets(others)) {
        const w = (fact(S.length) * fact(d - S.length - 1)) / fact(d);
        phi[i] += w * (V([...S, i].sort((a, b) => a - b)) - V(S.slice().sort((a, b) => a - b)));
      }
    }
    return { phi, base: V([]), pred: V([...Array(d).keys()]) };
  }

  window.MOLASTRIA_CAT_MODELS = {
    R_KCAL, KB_H, COUL, NA, EV_KCAL, rng, gauss, mean, variance, lin, clamp, erf, Phi,
    eyring, dGfromRate, kcalPerDecade, rateRatio, ddGFromRatio, decades, halfLife,
    effectiveMolarity, emToDG, bindingEntropyCost,
    cageAccel, occupancy, cageRate, spanOfCycle,
    complexConc, titrationCurve, fitKa, dGofK,
    mmSimulate, KM, mmRate, efficiency,
    coulomb, bornSolv, cageElectrostatic,
    langmuir, enrichment, poreRate,
    volcanoTOF, volcanoPeak, oerSteps, oerLimit,
    eeToDdG, ddGToEe, erOf, eeAtT,
    atomDensity, particle, perSite,
    hbond, activeSite,
    probAtLeast, expectedBestZ, screen,
    FEATURES, cageData, buildForest, forestPredict, oobPredict, treePredict, metrics, permImportance, shapley,
  };
})();
