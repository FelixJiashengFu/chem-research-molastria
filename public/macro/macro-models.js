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

  window.MOLASTRIA_MACRO_MODELS = { TAU, rng, kacInit, kacStep, kacDelta, mixEntropy, q2rInit, q2rHalf, q2rStep, q2rEnergy, q2rMag, ellipK, ISING, isingU, isingM, isingMofU, levelsThermal,
    hppInit, hppCollide, hppMove, hppStep, hppTotals, hppCoarse, latticeQuartic, LB, lbEq, lbInit, lbMoments, lbStep, lbCurl, lbDisc };
})();
