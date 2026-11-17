'use strict';
// 热、统计与流体（/macro/）演示背后的数学：纯函数，没有 DOM。tools/macro-test.mjs 对照解析解和已知值测这里的每一个函数。
// 页面里 macro-demos.js 经 window.MOLASTRIA_MACRO_MODELS 拿到它们。
(() => {
  const TAU = 2 * Math.PI;
  // 确定的伪随机数：同一个种子画出同一张图
  const rng = (seed) => { let a = (seed >>> 0) || 1; return () => { a |= 0; a = (a + 0x6d2b79f5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; };

  // ── the Kac ring: N balls (+1 white, −1 black) on a ring; every tick each ball moves one site clockwise and
  // changes colour when it crosses a marked edge. mk[i] marks the edge between site i and site i+1.
  const kacInit = (N, mu, seed) => { const r = rng(seed); const c = new Int8Array(N).fill(1); const mk = Uint8Array.from({ length: N }, () => (r() < mu ? 1 : 0)); return { c, mk }; };
  const kacStep = (c, mk, back) => { const N = c.length, o = new Int8Array(N); if (back) for (let i = 0; i < N; i++) { const j = (i + 1) % N; o[i] = mk[i] ? -c[j] : c[j]; } else for (let i = 0; i < N; i++) { const j = (i + 1) % N; o[j] = mk[i] ? -c[i] : c[i]; } return o; };
  const kacDelta = (c) => { let s = 0; for (let i = 0; i < c.length; i++) s += c[i]; return s / c.length; };
  // entropy per site (in units of k) of the macrostate "a fraction (1+Δ)/2 is white"; ln 2 at Δ = 0
  const mixEntropy = (d) => { const p = (1 + d) / 2; const h = (x) => (x <= 0 ? 0 : -x * Math.log(x)); return h(p) + h(1 - p); };

  // ── Q2R: a deterministic, reversible Ising automaton on an L × L torus (L even). A spin flips exactly when its four
  // neighbours sum to zero, so the energy −Σ s_i s_j never changes. One half-step updates one checkerboard colour.
  const q2rInit = (L, f, seed) => { const r = rng(seed); return Int8Array.from({ length: L * L }, () => (r() < f ? -1 : 1)); };
  const q2rHalf = (s, L, parity) => { for (let y = 0; y < L; y++) { const yu = ((y + L - 1) % L) * L, yd = ((y + 1) % L) * L, y0 = y * L; for (let x = (y + parity) & 1; x < L; x += 2) { if (s[yu + x] + s[yd + x] + s[y0 + ((x + 1) % L)] + s[y0 + ((x + L - 1) % L)] === 0) s[y0 + x] = -s[y0 + x]; } } return s; };
  const q2rStep = (s, L, back) => { if (back) { q2rHalf(s, L, 1); q2rHalf(s, L, 0); } else { q2rHalf(s, L, 0); q2rHalf(s, L, 1); } return s; };
  const q2rEnergy = (s, L) => { let e = 0; for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) e -= s[y * L + x] * (s[y * L + ((x + 1) % L)] + s[((y + 1) % L) * L + x]); return e; }; // in units of J
  const q2rMag = (s) => { let m = 0; for (let i = 0; i < s.length; i++) m += s[i]; return m / s.length; };
  // Onsager's exact square-lattice Ising results (J = 1, k = 1)
  const ellipK = (k) => { let a = 1, b = Math.sqrt(1 - k * k); if (b === 0) return Infinity; for (let i = 0; i < 40 && Math.abs(a - b) > 1e-15 * a; i++) { const t = (a + b) / 2; b = Math.sqrt(a * b); a = t; } return Math.PI / (2 * a); };
  const ISING = { betaC: Math.log(1 + Math.SQRT2) / 2, uC: -Math.SQRT2 };
  const isingU = (beta) => { const sh = Math.sinh(2 * beta), ch = Math.cosh(2 * beta), th = sh / ch, kap = 2 * sh / (ch * ch), kp = 2 * th * th - 1; const K = ellipK(Math.min(kap, 1)); return -(ch / sh) * (1 + (Number.isFinite(K) ? (2 / Math.PI) * kp * K : 0)); };
  const isingM = (beta) => (beta <= ISING.betaC ? 0 : (1 - Math.sinh(2 * beta) ** -4) ** 0.125);
  const isingMofU = (u) => { if (u >= ISING.uC) return 0; let lo = ISING.betaC, hi = 8; for (let i = 0; i < 70; i++) { const mid = (lo + hi) / 2; if (isingU(mid) > u) lo = mid; else hi = mid; } return isingM(lo); };

  // ── N 条等间隔能级 E_k = kω（k = 0 … N−1，ħ = 1）放进热浴，x = kT/ω。返回以 ω 为单位的平均能量和以 k 为单位的热容。
  // N = Infinity 就是不计零点能的谐振子（Planck 公式）。
  const levelsThermal = (N, x) => { const b = 1 / x; const f = (a) => (a > 700 ? 0 : 1 / Math.expm1(a)); const g = (a) => (a > 700 ? 0 : (a * a * Math.exp(a)) / Math.expm1(a) ** 2); const fin = Number.isFinite(N); return { E: f(b) - (fin ? N * f(b * N) : 0), C: g(b) - (fin ? g(b * N) : 0) }; };

  // ── HPP lattice gas (Hardy, de Pazzis, Pomeau 1973) on an L × L torus. Four bits per site: 1 = east, 2 = north (y − 1),
  // 4 = west, 8 = south. One tick: collide (a head-on pair alone on a site turns by 90°), then every particle moves one site.
  // The collision is its own inverse, so "un-move, then collide" runs the gas backwards exactly.
  const hppInit = (L, rho, seed, blob) => { const r = rng(seed), c = new Uint8Array(L * L), m = L / 2; for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) { const d = blob && (x - m + 0.5) ** 2 + (y - m + 0.5) ** 2 < (blob.r * blob.r) ? blob.rho : rho; let v = 0; for (let b = 1; b < 16; b <<= 1) if (r() < d) v |= b; c[y * L + x] = v; } return c; };
  const hppCollide = (c) => { for (let i = 0; i < c.length; i++) { if (c[i] === 5) c[i] = 10; else if (c[i] === 10) c[i] = 5; } return c; };
  const hppMove = (c, L, back) => { const o = new Uint8Array(L * L), d = back ? L - 1 : 1; for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) { const v = c[y * L + x]; if (!v) continue; if (v & 1) o[y * L + ((x + d) % L)] |= 1; if (v & 4) o[y * L + ((x + L - d) % L)] |= 4; if (v & 2) o[((y + L - d) % L) * L + x] |= 2; if (v & 8) o[((y + d) % L) * L + x] |= 8; } return o; };
  const hppStep = (c, L, back) => (back ? hppCollide(hppMove(c, L, true)) : hppMove(hppCollide(c), L));
  const POP4 = Uint8Array.from({ length: 16 }, (_, v) => (v & 1) + ((v >> 1) & 1) + ((v >> 2) & 1) + ((v >> 3) & 1));
  const hppTotals = (c, L) => { let n = 0, px = 0, py = 0; const rowPx = new Int32Array(L); for (let y = 0; y < L; y++) for (let x = 0; x < L; x++) { const v = c[y * L + x]; n += POP4[v]; const a = (v & 1) - ((v >> 2) & 1); px += a; rowPx[y] += a; py += ((v >> 3) & 1) - ((v >> 1) & 1); } return { n, px, py, rowPx }; };
  // particles per site, averaged over b × b blocks (L divisible by b): rows of length L / b
  const hppCoarse = (c, L, b) => { const n = L / b, out = []; for (let Y = 0; Y < n; Y++) { const row = new Float32Array(n); for (let X = 0; X < n; X++) { let s = 0; for (let y = 0; y < b; y++) for (let x = 0; x < b; x++) s += POP4[c[(Y * b + y) * L + X * b + x]]; row[X] = s / (b * b); } out.push(row); } return out; };
  // Σ_i (c_i · n)^4 over the q unit vectors of a regular lattice star, n at angle θ: isotropic (independent of θ) only for q ≥ 5, q ≠ 4
  const latticeQuartic = (q, theta) => { let s = 0; for (let i = 0; i < q; i++) s += Math.cos(theta - (TAU * i) / q) ** 4; return s; };

  // ── lattice Boltzmann, D2Q9 with the single-relaxation-time (BGK) collision. Lattice units: δx = δt = 1, c_s² = 1/3,
  // kinematic viscosity ν = (τ − ½)/3. o.open: the four edges are held at the equilibrium of speed u0 (a wind tunnel); o.open = 'x': only the left and right edges, top and bottom wrap round;
  // otherwise the grid is a torus. bar[i] = 1 marks solid cells (halfway bounce-back).
  const LB = { cx: [0, 1, 0, -1, 0, 1, -1, -1, 1], cy: [0, 0, 1, 0, -1, 1, 1, -1, -1], w: [4 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 9, 1 / 36, 1 / 36, 1 / 36, 1 / 36], opp: [0, 3, 4, 1, 2, 7, 8, 5, 6] };
  const lbEq = (i, rho, ux, uy) => { const cu = LB.cx[i] * ux + LB.cy[i] * uy; return LB.w[i] * rho * (1 + 3 * cu + 4.5 * cu * cu - 1.5 * (ux * ux + uy * uy)); };
  const lbInit = (nx, ny, o = {}) => { const n = nx * ny, f = new Float64Array(9 * n), bar = o.bar || new Uint8Array(n), u = o.u || (() => [o.u0 || 0, 0]); for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) { const [ux, uy] = u(x, y); for (let i = 0; i < 9; i++) f[i * n + y * nx + x] = lbEq(i, 1, ux, uy); } return { nx, ny, f, g: new Float64Array(9 * n), bar, open: o.open || false, u0: o.u0 || 0, rho: new Float64Array(n).fill(1), ux: new Float64Array(n), uy: new Float64Array(n), t: 0 }; };
  const lbMoments = (S) => { const { nx, ny, f, rho, ux, uy, bar } = S, n = nx * ny; for (let k = 0; k < n; k++) { if (bar[k]) { rho[k] = 1; ux[k] = uy[k] = 0; continue; } let r = 0, a = 0, b = 0; for (let i = 0; i < 9; i++) { const v = f[i * n + k]; r += v; a += LB.cx[i] * v; b += LB.cy[i] * v; } rho[k] = r; ux[k] = a / r; uy[k] = b / r; } return S; };
  const lbStep = (S, tau) => { const { nx, ny, f, g, bar, rho, ux, uy } = S, n = nx * ny, om = 1 / tau; lbMoments(S);
    for (let k = 0; k < n; k++) { if (bar[k]) continue; const r = rho[k], a = ux[k], b = uy[k], u2 = 1.5 * (a * a + b * b); for (let i = 0; i < 9; i++) { const cu = LB.cx[i] * a + LB.cy[i] * b, j = i * n + k; f[j] += om * (LB.w[i] * r * (1 + 3 * cu + 4.5 * cu * cu - u2) - f[j]); } }
    for (let i = 0; i < 9; i++) { const cx = LB.cx[i], cy = LB.cy[i], io = LB.opp[i] * n, ii = i * n; for (let y = 0; y < ny; y++) { const ys = (y - cy + ny) % ny; for (let x = 0; x < nx; x++) { const k = y * nx + x; if (bar[k]) continue; const ks = ys * nx + ((x - cx + nx) % nx); g[ii + k] = bar[ks] ? f[io + k] : f[ii + ks]; } } }
    if (S.open) { const edge = (k) => { for (let i = 0; i < 9; i++) g[i * n + k] = lbEq(i, 1, S.u0, 0); }; if (S.open !== 'x') for (let x = 0; x < nx; x++) { edge(x); edge((ny - 1) * nx + x); } for (let y = 0; y < ny; y++) { edge(y * nx); edge(y * nx + nx - 1); } }
    S.f = g; S.g = f; S.t++; return S; };
  const lbCurl = (S) => { const { nx, ny, ux, uy } = S, out = new Float64Array(nx * ny); for (let y = 1; y < ny - 1; y++) for (let x = 1; x < nx - 1; x++) { const k = y * nx + x; out[k] = (uy[k + 1] - uy[k - 1] - ux[k + nx] + ux[k - nx]) / 2; } return out; };
  const lbDisc = (nx, ny, cx, cy, r) => { const bar = new Uint8Array(nx * ny); for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) if ((x - cx) ** 2 + (y - cy) ** 2 <= r * r) bar[y * nx + x] = 1; return bar; };

  // ── 第四章：相变与重整化群 ─────────────────────────────────────────────
  // 带热浴的二维 Ising 模型（J = k = 1，L × L 周期格子，外场 h）。s 是 Int8Array（±1），r 是 rng(seed) 给的随机数。
  // Metropolis：逐格试翻，ΔE = 2 s_i (Σ 邻居 + h)，按 min(1, e^{−ΔE/T}) 接受。一次扫描试 L² 次，返回接受的次数。
  const isingInit = (L, cold, seed) => { const r = rng(seed); return Int8Array.from({ length: L * L }, () => (cold || r() < 0.5 ? 1 : -1)); };
  const nbSum = (s, L, i) => { const x = i % L, y = (i - x) / L; return s[y * L + ((x + 1) % L)] + s[y * L + ((x + L - 1) % L)] + s[((y + 1) % L) * L + x] + s[((y + L - 1) % L) * L + x]; };
  const metropolisSweep = (s, L, T, h, r) => { let acc = 0; const n = L * L; for (let k = 0; k < n; k++) { const i = (r() * n) | 0, dE = 2 * s[i] * (nbSum(s, L, i) + h); if (dE <= 0 || r() < Math.exp(-dE / T)) { s[i] = -s[i]; acc++; } } return acc; };
  // Wolff 1989：从一个随机格点长一团同号自旋，每条键以 p = 1 − e^{−2/T} 加进来，整团翻转（h = 0）。返回这一团的大小。
  const wolffStep = (s, L, T, r) => { const n = L * L, p = 1 - Math.exp(-2 / T), i0 = (r() * n) | 0, sg = s[i0], stack = [i0]; s[i0] = -sg; let size = 1;
    while (stack.length) { const i = stack.pop(), x = i % L, y = (i - x) / L; for (const j of [y * L + ((x + 1) % L), y * L + ((x + L - 1) % L), ((y + 1) % L) * L + x, ((y + L - 1) % L) * L + x]) if (s[j] === sg && r() < p) { s[j] = -sg; stack.push(j); size++; } }
    return size; };
  // 精确的期望：无穷大格子上每格的能量 u(T) 和自发磁化 |m|(T)（Onsager、Yang），以温度为自变量
  const isingExactT = (T) => ({ u: isingU(1 / T), m: isingM(1 / T) });
  // Binder 累积量 U = 1 − ⟨m⁴⟩ / (3⟨m²⟩²)：有序相趋于 2/3，无序相趋于 0
  const binder = (m2, m4) => (m2 > 0 ? 1 - m4 / (3 * m2 * m2) : 0);
  // Kadanoff 的块自旋：b × b 一块按多数票变成一个自旋（b 取奇数就没有平票）。L 要能被 b 整除。
  const blockSpin = (s, L, b) => { const n = L / b, o = new Int8Array(n * n); for (let Y = 0; Y < n; Y++) for (let X = 0; X < n; X++) { let t = 0; for (let y = 0; y < b; y++) for (let x = 0; x < b; x++) t += s[(Y * b + y) * L + X * b + x]; o[Y * n + X] = t > 0 ? 1 : t < 0 ? -1 : 1; } return o; };
  // 近邻自旋的关联（每格两条键的平均 ⟨s_i s_j⟩），等于 −u/2
  const bondCorr = (s, L) => -q2rEnergy(s, L) / (2 * L * L);

  // 一维 Ising 链的精确抽取和 Migdal–Kadanoff 近似（尺度因子 b，维数 d）：先把键挪到一起（K → b^{d−1} K），
  // 再把 b 条串联的键精确抽成一条：tanh K' = tanh(b^{d−1} K)^b。d = 1 时第一步什么都不做，就是精确的抽取。
  const mkMap = (K, b = 2, d = 1) => { const t = Math.tanh(b ** (d - 1) * K) ** b; return t >= 1 ? Infinity : Math.atanh(t); };
  // 非平凡的不动点 K*（d ≥ 2 才有），本征值 λ = dK'/dK 和关联长度指数 ν = ln b / ln λ
  const mkFixed = (b = 2, d = 2) => { if (d < 2) return null; let lo = 1e-6, hi = 5; for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (mkMap(mid, b, d) > mid) hi = mid; else lo = mid; } const K = (lo + hi) / 2, e = 1e-6, lam = (mkMap(K + e, b, d) - mkMap(K - e, b, d)) / (2 * e); return { K, lam, nu: Math.log(b) / Math.log(lam) }; };
  const mkOrbit = (K, b, d, n) => { const out = [K]; for (let i = 0; i < n; i++) { K = mkMap(K, b, d); if (!Number.isFinite(K) || K > 50) { out.push(Infinity); break; } out.push(K); } return out; };
  // 一维链的精确关联长度（以格距为单位）：ξ = −1 / ln tanh K。抽取一次以后格距变成 b，ξ' = ξ / b。
  const chainXi = (K) => -1 / Math.log(Math.tanh(K));

  // 平均场（Weiss）：m = tanh((T_c m + h)/T)，T_c = zJ/k。返回和 h 同号的那个自洽解（h = 0 时取正的；用二分法）。
  const meanFieldM = (T, Tc, h = 0) => { if (h < 0) return -meanFieldM(T, Tc, -h); const g = (m) => m - Math.tanh((Tc * m + h) / T);
    if (h === 0 && T >= Tc) return 0; let lo = h === 0 ? 1e-300 : 0, hi = 1; if (h === 0) { lo = 0; for (let k = 1; k < 400; k++) { const x = 2 ** -k; if (g(x) < 0) { lo = x; break; } } }
    for (let i = 0; i < 200; i++) { const mid = (lo + hi) / 2; if (g(mid) < 0) lo = mid; else hi = mid; } return (lo + hi) / 2; };
  // Landau 自由能 f(m) = a m² + b m⁴ + c m⁶ − h m，a = t = T/T_c − 1。返回在 [−mmax, mmax] 上的全局最小点（扫描后用牛顿法磨尖）。
  const landauF = (m, t, b, c, h) => t * m * m + b * m ** 4 + c * m ** 6 - h * m;
  const landauMin = (t, b, c, h, mmax = 2) => { let best = 0, fb = Infinity; for (let i = 0; i <= 4000; i++) { const m = mmax - (2 * mmax * i) / 4000, f = landauF(m, t, b, c, h); if (f < fb - 1e-15) { fb = f; best = m; } }
    for (let k = 0; k < 50; k++) { const d1 = 2 * t * best + 4 * b * best ** 3 + 6 * c * best ** 5 - h, d2 = 2 * t + 12 * b * best ** 2 + 30 * c * best ** 4; if (!(d2 > 0)) break; const nx = best - d1 / d2; if (Math.abs(nx - best) < 1e-15) break; best = nx; } return { m: best, f: landauF(best, t, b, c, h) }; };
  // 一级相变（b < 0, c > 0）的跃变温度：两个极小值等高时 t_1 = b²/(4c)，跃变的序参量 m_1² = −b/(2c)
  const landauFirst = (b, c) => ({ t1: (b * b) / (4 * c), m1: Math.sqrt(-b / (2 * c)) });

  // 临界指数：由 ν、η 和维数 d 经标度关系算出其余四个（Fisher γ = ν(2 − η)、Josephson dν = 2 − α、β = ν(d − 2 + η)/2、δ = (d + 2 − η)/(d − 2 + η)）
  const fromNuEta = (nu, eta, d) => ({ alpha: 2 - d * nu, beta: (nu * (d - 2 + eta)) / 2, gamma: nu * (2 - eta), delta: (d + 2 - eta) / (d - 2 + eta), nu, eta });
  const scalingChecks = (e, d) => ({ rushbrooke: e.alpha + 2 * e.beta + e.gamma - 2, widom: e.gamma - e.beta * (e.delta - 1), fisher: e.gamma - e.nu * (2 - e.eta), josephson: d * e.nu - (2 - e.alpha) });
  // ε = 4 − d 展开的第一阶（n 分量的 O(n) 模型）：Wilson & Fisher 1972
  const epsExp = (n, eps) => ({ nu: 0.5 + ((n + 2) / (4 * (n + 8))) * eps, eta: ((n + 2) / (2 * (n + 8) ** 2)) * eps * eps, gamma: 1 + ((n + 2) / (2 * (n + 8))) * eps, beta: 0.5 - (3 / (2 * (n + 8))) * eps });

  window.MOLASTRIA_MACRO_MODELS = { TAU, rng, kacInit, kacStep, kacDelta, mixEntropy, q2rInit, q2rHalf, q2rStep, q2rEnergy, q2rMag, ellipK, ISING, isingU, isingM, isingMofU, levelsThermal,
    hppInit, hppCollide, hppMove, hppStep, hppTotals, hppCoarse, latticeQuartic, LB, lbEq, lbInit, lbMoments, lbStep, lbCurl, lbDisc,
    isingInit, nbSum, metropolisSweep, wolffStep, isingExactT, binder, blockSpin, bondCorr, mkMap, mkFixed, mkOrbit, chainXi, meanFieldM, landauF, landauMin, landauFirst, fromNuEta, scalingChecks, epsExp };
})();
