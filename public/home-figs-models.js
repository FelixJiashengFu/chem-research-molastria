'use strict';
// 首页“栏目图版”六张图的数学（纯函数，没有 DOM；tools/home-figs-test.mjs 测）。home-hero.js 只管画。
// 1. 红外谱：谐振频率和强度的洛伦兹展宽（数据摘自谱图馆 sp-computed.js，PySCF B3LYP/def2-SVPD，未标度）
// 2. 苯的 π 分子轨道：Hückel 系数 × Slater 2p_z 轨道              3. 氢原子定态 ψ_nl0（原子单位）
// 4. 扩散模型：高斯混合数据在 VP 加噪下的解析分数函数，概率流 ODE   5. 核磁：FID 和有限采样时间的吸收谱（解析）
// 6. 双缝：强度分布和按它抽样的落点          7. Grover 搜索的振幅            8. 中心极限定理：均匀分布之和
// 9. 逻辑斯蒂映射的分岔图                   10. H₂ 的 Morse 势和振动能级    11. 麦克斯韦–玻尔兹曼速率分布
// 12. 氯的同位素峰簇
(() => {
  const TAU = Math.PI * 2;
  // Deterministic random numbers (mulberry32): the same picture on every visit, and testable.
  const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const gauss = (r) => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(TAU * r());

  // ── 1. infrared: [frequency cm⁻¹, IR intensity km/mol] of the modes above 450 cm⁻¹ with at least 1 km/mol ──
  const IR = {
    ethanol: { formula: 'CH₃CH₂OH', modes: [[800, 3.2], [888, 10], [1054, 20.5], [1083, 109.5], [1129, 11.3], [1263, 14.2], [1353, 3.8], [1378, 4.2], [1410, 39.8], [1459, 6.6], [1466, 1.6], [1491, 1.4], [2993, 59.6], [3019, 14.2], [3076, 3.9], [3098, 45.9], [3115, 28.5], [3837, 28.3]], bands: [[3837, 'O–H'], [3050, 'C–H'], [1083, 'C–O']] },
    acetone: { formula: '(CH₃)₂CO', modes: [[540, 15], [795, 1.5], [883, 5.9], [1104, 3.7], [1235, 54.3], [1364, 20.1], [1373, 75.4], [1441, 27.4], [1461, 19.3], [1806, 204.6], [3031, 5.3], [3100, 13.4], [3154, 9.5], [3155, 4.7]], bands: [[1806, 'C=O'], [1373, 'CH₃'], [1235, 'C–C–C']] },
    aceticacid: { formula: 'CH₃COOH', modes: [[552, 23.4], [590, 39.1], [669, 96.2], [870, 3], [995, 59.3], [1056, 8.9], [1201, 210.6], [1326, 33.6], [1397, 78.2], [1443, 14.3], [1451, 8.7], [1837, 357], [3125, 2.4], [3176, 3.2], [3765, 73.5]], bands: [[3765, 'O–H'], [1837, 'C=O'], [1201, 'C–O']] },
  };
  // Sum of Lorentzians of half width hw (cm⁻¹); each line's peak height is its intensity.
  const lorentz = (modes, nu, hw = 14) => { let a = 0; for (const [c, h] of modes) a += h / (1 + ((nu - c) / hw) ** 2); return a; };

  // ── 2. benzene π orbitals. Lengths in bohr; the ring lies in the plane z = 0, carbon k at angle 60°·k. ──
  const RCC = 1.397 / 0.529177, ZETA = 1.625; // C–C distance; Slater exponent of carbon 2p
  const RING = [0, 1, 2, 3, 4, 5].map((k) => [RCC * Math.cos(k * TAU / 6), RCC * Math.sin(k * TAU / 6)]);
  const s12 = Math.sqrt(12);
  const HUCKEL = [ // the three occupied orbitals (energies α + 2β, α + β, α + β)
    [1, 1, 1, 1, 1, 1].map((c) => c / Math.sqrt(6)),
    [2, 1, -1, -2, -1, 1].map((c) => c / s12),
    [0, 1, 1, 0, -1, -1].map((c) => c / 2),
  ];
  const pz = (x, y, z) => { const r = Math.hypot(x, y, z); return Math.sqrt(ZETA ** 5 / Math.PI) * z * Math.exp(-ZETA * r); };
  const benzeneMO = (k, x, y, z) => { let v = 0; for (let i = 0; i < 6; i++) v += HUCKEL[k][i] * pz(x - RING[i][0], y - RING[i][1], z); return v; };
  const benzeneDensity = (x, y, z) => { let d = 0; for (let k = 0; k < 3; k++) d += 2 * benzeneMO(k, x, y, z) ** 2; return d; };
  const bondOrder = (i, j) => { let p = 0; for (let k = 0; k < 3; k++) p += 2 * HUCKEL[k][i] * HUCKEL[k][j]; return p; };

  // ── 3. hydrogen ψ_nl0(r, cos θ), atomic units ──
  const fact = (n) => { let f = 1; for (let i = 2; i <= n; i++) f *= i; return f; };
  const laguerre = (p, a, x) => { // associated Laguerre L_p^a(x) by recurrence
    if (p === 0) return 1; let l0 = 1, l1 = 1 + a - x;
    for (let k = 1; k < p; k++) { const l2 = ((2 * k + 1 + a - x) * l1 - (k + a) * l0) / (k + 1); l0 = l1; l1 = l2; }
    return l1;
  };
  const legendre = (l, x) => { if (l === 0) return 1; let p0 = 1, p1 = x; for (let k = 1; k < l; k++) { const p2 = ((2 * k + 1) * x * p1 - k * p0) / (k + 1); p0 = p1; p1 = p2; } return p1; };
  const radial = (n, l, r) => { const rho = 2 * r / n; return Math.sqrt((2 / n) ** 3 * fact(n - l - 1) / (2 * n * fact(n + l))) * rho ** l * Math.exp(-rho / 2) * laguerre(n - l - 1, 2 * l + 1, rho); };
  const hydrogen = (n, l, r, cos) => radial(n, l, r) * Math.sqrt((2 * l + 1) / (2 * TAU)) * legendre(l, cos);
  const hydrogenE = (n) => -13.605693 / (n * n); // eV

  // ── 4. diffusion. Data: eight narrow Gaussians on a circle. Forward: x_t = a(t) x_0 + σ(t) ε (variance preserving). ──
  const MODES = [0, 1, 2, 3, 4, 5, 6, 7].map((k) => [2 * Math.cos(k * TAU / 8), 2 * Math.sin(k * TAU / 8)]), S0 = 0.12;
  const B0 = 0.1, B1 = 20, beta = (t) => B0 + (B1 - B0) * t;
  const alpha = (t) => Math.exp(-0.5 * (B0 * t + 0.5 * (B1 - B0) * t * t));
  // ∇ log p_t(x): p_t is again a mixture, means a·μ_k, variance a²s₀² + 1 − a².
  const score = (x, y, t) => {
    const a = alpha(t), v = a * a * S0 * S0 + 1 - a * a; let sx = 0, sy = 0, w = 0, best = -Infinity; const e = [];
    for (const [mx, my] of MODES) { const q = -((x - a * mx) ** 2 + (y - a * my) ** 2) / (2 * v); e.push(q); if (q > best) best = q; }
    MODES.forEach(([mx, my], k) => { const p = Math.exp(e[k] - best); w += p; sx += p * (a * mx - x); sy += p * (a * my - y); });
    return [sx / (w * v), sy / (w * v)];
  };
  // The probability-flow ODE dx/dt = −½β(t)(x + score), integrated from t = 1 down to t0 (Heun). Returns steps+1 frames of [x0,y0,x1,y1,…].
  const reverseFlow = (count, steps = 90, seed = 11, t0 = 1e-3) => {
    const r = rng(seed), f = (x, y, t) => { const [sx, sy] = score(x, y, t), b = -0.5 * beta(t); return [b * (x + sx), b * (y + sy)]; };
    let cur = new Float32Array(2 * count); for (let i = 0; i < 2 * count; i++) cur[i] = gauss(r);
    const frames = [cur], ts = [1];
    for (let s = 0; s < steps; s++) {
      // steps bunch up near t = 0, where the flow is fastest
      const ta = 1 - (1 - t0) * (1 - (1 - s / steps) ** 2), tb = 1 - (1 - t0) * (1 - (1 - (s + 1) / steps) ** 2), h = tb - ta, nxt = new Float32Array(2 * count);
      for (let i = 0; i < count; i++) {
        const x = cur[2 * i], y = cur[2 * i + 1], [k1x, k1y] = f(x, y, ta), [k2x, k2y] = f(x + h * k1x, y + h * k1y, tb);
        nxt[2 * i] = x + h * (k1x + k2x) / 2; nxt[2 * i + 1] = y + h * (k1y + k2y) / 2;
      }
      frames.push(nxt); ts.push(tb); cur = nxt;
    }
    return { frames, ts };
  };

  // ── 5. NMR: ethanol ¹H at 60 MHz. Lines are [offset from the carrier in Hz, amplitude]; one T₂ for all. ──
  const MHZ = 60, CARRIER = 2.4, J = 7, T2 = 0.45;
  const multiplet = (ppm, weights, total) => { const n = weights.length, sum = weights.reduce((a, b) => a + b); return weights.map((w, i) => [(ppm - CARRIER) * MHZ + (i - (n - 1) / 2) * J, total * w / sum]); };
  const LINES = [...multiplet(1.19, [1, 2, 1], 3), ...multiplet(2.61, [1], 1), ...multiplet(3.69, [1, 3, 3, 1], 2)];
  const fid = (t) => { let s = 0; for (const [f, a] of LINES) s += a * Math.cos(TAU * f * t); return s * Math.exp(-t / T2); };
  // Absorption spectrum of the FID cut off at tacq: Re ∫₀ᵀ a e^(−t/T₂) e^(i2π(f₀−f)t) dt, in closed form.
  const absorption = (f, tacq = Infinity) => {
    let s = 0;
    for (const [f0, a] of LINES) {
      const d = TAU * (f0 - f), k = 1 / T2, den = k * k + d * d;
      if (tacq === Infinity) { s += a * k / den; continue; }
      const e = Math.exp(-k * tacq), c = Math.cos(d * tacq), sn = Math.sin(d * tacq);
      s += a * (k * (1 - e * c) + d * e * sn) / den;
    }
    return s;
  };
  const ppmOf = (f) => CARRIER + f / MHZ;

  // ── 6. double slit. u = position in units of the fringe spacing λL/d; ratio = slit separation / slit width. ──
  const slit = (u, ratio = 4.5) => { const b = Math.PI * u / ratio, e = b ? Math.sin(b) / b : 1; return Math.cos(Math.PI * u) ** 2 * e * e; };
  // count landing points [u, v] (v uniform in 0…1) drawn from that intensity by rejection, |u| ≤ span.
  const landings = (count, span = 7, seed = 3) => { const r = rng(seed), out = new Float32Array(2 * count); let n = 0; while (n < count) { const u = (r() * 2 - 1) * span; if (r() < slit(u)) { out[2 * n] = u; out[2 * n + 1] = r(); n++; } } return out; };

  // ── 7. Grover search among N items, one marked: amplitudes after k iterations ──
  const grover = (N, k) => { const th = Math.asin(1 / Math.sqrt(N)); return { marked: Math.sin((2 * k + 1) * th), rest: Math.cos((2 * k + 1) * th) / Math.sqrt(N - 1) }; };
  const groverBest = (N) => Math.floor(Math.PI / 4 * Math.sqrt(N));

  // ── 8. central limit theorem: count standardised means of n uniform numbers; the normal density ──
  const cltSamples = (n, count, seed = 5) => { const r = rng(seed + n), out = new Float32Array(count), sd = Math.sqrt(n / 12); for (let i = 0; i < count; i++) { let s = 0; for (let j = 0; j < n; j++) s += r(); out[i] = (s - n / 2) / sd; } return out; };
  const normalPdf = (z) => Math.exp(-z * z / 2) / Math.sqrt(TAU);
  const histogram = (xs, lo, hi, bins) => { const h = new Float32Array(bins); for (const x of xs) { const b = Math.floor((x - lo) / (hi - lo) * bins); if (b >= 0 && b < bins) h[b]++; } return h; };

  // ── 9. logistic map x → r x (1 − x): the values the orbit keeps visiting after a transient ──
  const logisticOrbit = (r, skip = 300, keep = 120, x = 0.5) => { for (let i = 0; i < skip; i++) x = r * x * (1 - x); const out = new Float32Array(keep); for (let i = 0; i < keep; i++) { x = r * x * (1 - x); out[i] = x; } return out; };

  // ── 10. H₂ as a Morse oscillator built from ωe and ωexe (Huber & Herzberg): lengths Å, energies eV above the minimum ──
  const H2 = { re: 0.7414, we: 4401.21, wexe: 121.34 }, CM_EV = 1 / 8065.544;
  const MU_H2 = 1.00782503 / 2 * 1.66053907e-27, HBAR = 1.054571817e-34, CLIGHT = 2.99792458e10;
  H2.De = H2.we ** 2 / (4 * H2.wexe) * CM_EV;                                    // Morse well depth
  H2.a = Math.sqrt(4 * Math.PI * CLIGHT * MU_H2 * H2.wexe / HBAR) * 1e-10;       // Å⁻¹
  H2.vmax = Math.floor(H2.we / (2 * H2.wexe) - 0.5);
  const morse = (r) => H2.De * (1 - Math.exp(-H2.a * (r - H2.re))) ** 2;
  const morseLevel = (v) => (H2.we * (v + 0.5) - H2.wexe * (v + 0.5) ** 2) * CM_EV;
  const morseTurn = (E) => { const q = Math.sqrt(E / H2.De); return [H2.re - Math.log(1 + q) / H2.a, H2.re - Math.log(1 - q) / H2.a]; };

  // ── 11. Maxwell–Boltzmann speed distribution (s/m) of a gas of molar mass M (g/mol) at T (K) ──
  const KB = 1.380649e-23, AMU = 1.66053907e-27;
  const maxwell = (v, T, M = 28.0134) => { const m = M * AMU, a = m / (2 * KB * T); return 4 * Math.PI * (a / Math.PI) ** 1.5 * v * v * Math.exp(-a * v * v); };
  const vMostProbable = (T, M = 28.0134) => Math.sqrt(2 * KB * T / (M * AMU));

  // ── 12. isotope pattern of n chlorine atoms: [number of ³⁷Cl, abundance relative to the tallest peak] ──
  const CL37 = 0.2424;
  const chlorinePattern = (n) => { const p = []; let c = 1; for (let k = 0; k <= n; k++) { p.push(c * CL37 ** k * (1 - CL37) ** (n - k)); c = c * (n - k) / (k + 1); } const top = Math.max(...p); return p.map((x, k) => [k, x / top]); };

  window.MOLASTRIA_HOME_FIGS = { rng, IR, lorentz, RCC, RING, HUCKEL, pz, benzeneMO, benzeneDensity, bondOrder, laguerre, legendre, radial, hydrogen, hydrogenE, MODES, S0, alpha, beta, score, reverseFlow, MHZ, CARRIER, T2, LINES, fid, absorption, ppmOf, slit, landings, grover, groverBest, cltSamples, normalPdf, histogram, logisticOrbit, H2, morse, morseLevel, morseTurn, maxwell, vMostProbable, CL37, chlorinePattern };
})();
