/* 游乐场 15 · 二维波包画墙的数学（不碰 DOM；tools/play-test.mjs 用解析解和已知结果检验）。
   二维含时薛定谔方程 i ∂ψ/∂t = −½∇²ψ + Vψ（ħ = m = 1，格距 dx = 1，时间单位 m·dx²/ħ）。
   分裂算符（Strang）：ψ(t + dt) = e^{−iV dt/2} · F⁻¹ e^{−ik² dt/2} F · e^{−iV dt/2} ψ(t)，F 是二维 FFT（基 2，下面自己写的）。
   每一步只乘相位，在周期边界下严格幺正（误差只来自浮点舍入）；动能部分对网格上的带限函数是精确的。
   四周各有一条 ABSORB 格宽的吸收带：每步再乘一个 ≤ 1 的掩码，波包走到边上就被吸收，不会从对边绕回来；
   被吸收的概率按格子记在 gone 里，所以“穿过势垒的概率”可以把已经飞出画面的部分也算上。
   墙是高势垒 V = WALL，势垒是关卡给定的较低的 V。墙不能无限高：e^{−iV dt} 以 2π/dt 为周期，V·dt 太大就等于另一个势能；
   网格也表示不了墙里急剧衰减的波函数，所以 2 格厚的墙会漏过千分之二左右，4 格厚的约万分之一（测试里有数）。 */
(() => {
  'use strict';
  const W = {};
  W.WALL = 5;       // 墙的势能：约为波包动能（0.5–0.72）的七到十倍；V·dt 要远小于 2π，否则 e^{−iV dt} 会“绕回”成别的势能
  W.ABSORB = 12;    // 吸收带宽度（格）
  W.RATE = 1.5;     // 吸收带最外层的吸收率 γ（每单位时间），向内按 u² 减小

  // ── 基 2 FFT ──────────────────────────────────────────────────────────
  W.plan = (n) => {
    if (!(n > 1) || n & (n - 1)) throw new Error(`FFT size ${n} is not a power of 2`);
    const bits = Math.round(Math.log2(n)), rev = new Uint32Array(n), cos = new Float64Array(n / 2), sin = new Float64Array(n / 2);
    for (let i = 0; i < n; i++) { let r = 0; for (let b = 0; b < bits; b++) r |= ((i >> b) & 1) << (bits - 1 - b); rev[i] = r; }
    for (let i = 0; i < n / 2; i++) { cos[i] = Math.cos((2 * Math.PI * i) / n); sin[i] = Math.sin((2 * Math.PI * i) / n); }
    return { n, rev, cos, sin };
  };
  // 原地变换：正变换 X_k = Σ x_j e^{−2πijk/n}；inverse 时指数取正号、不除以 n
  W.fft = (re, im, p, inverse = false) => {
    const { n, rev, cos, sin } = p, sg = inverse ? 1 : -1;
    for (let i = 0; i < n; i++) {
      const j = rev[i];
      if (j > i) { let t = re[i]; re[i] = re[j]; re[j] = t; t = im[i]; im[i] = im[j]; im[j] = t; }
    }
    for (let size = 2; size <= n; size <<= 1) {
      const half = size >> 1, step = n / size;
      for (let s = 0; s < n; s += size) {
        for (let k = 0, w = 0; k < half; k++, w += step) {
          const wr = cos[w], wi = sg * sin[w], a = s + k, b = a + half;
          const tr = re[b] * wr - im[b] * wi, ti = re[b] * wi + im[b] * wr;
          re[b] = re[a] - tr; im[b] = im[a] - ti; re[a] += tr; im[a] += ti;
        }
      }
    }
  };
  // 二维：先逐行、再逐列；数组下标 i = y·nx + x
  W.fft2 = (s, inverse) => {
    const { nx, ny, re, im, px, py, br, bi } = s;
    for (let y = 0; y < ny; y++) W.fft(re.subarray(y * nx, (y + 1) * nx), im.subarray(y * nx, (y + 1) * nx), px, inverse);
    for (let x = 0; x < nx; x++) {
      for (let y = 0, i = x; y < ny; y++, i += nx) { br[y] = re[i]; bi[y] = im[i]; }
      W.fft(br, bi, py, inverse);
      for (let y = 0, i = x; y < ny; y++, i += nx) { re[i] = br[y]; im[i] = bi[y]; }
    }
  };
  // 网格上的波数：j < n/2 时 2πj/n，否则 2π(j − n)/n
  W.wavenumber = (j, n) => (2 * Math.PI * (j < n / 2 ? j : j - n)) / n;

  // ── 模拟 ─────────────────────────────────────────────────────────────
  // V：每格的势能（Float64Array，长度 nx·ny）；absorb：吸收带宽度，0 表示纯周期边界（测幺正性用）
  W.sim = ({ nx, ny = nx, dt = 0.25, V = null, absorb = W.ABSORB, rate = W.RATE }) => {
    const n = nx * ny;
    const s = {
      nx, ny, dt, t: 0, steps: 0, re: new Float64Array(n), im: new Float64Array(n), gone: new Float64Array(n),
      ur: new Float64Array(n), ui: new Float64Array(n), mask: new Float64Array(n), kr: new Float64Array(n), ki: new Float64Array(n),
      px: W.plan(nx), py: ny === nx ? null : W.plan(ny), br: new Float64Array(ny), bi: new Float64Array(ny), absorb,
    };
    s.py ||= s.px;
    // e^{−ik²dt/2}，顺便除以 nx·ny（逆变换不归一化）
    for (let y = 0; y < ny; y++) {
      const ky = W.wavenumber(y, ny);
      for (let x = 0; x < nx; x++) { const k2 = W.wavenumber(x, nx) ** 2 + ky * ky, ph = -0.5 * k2 * dt, i = y * nx + x; s.kr[i] = Math.cos(ph) / n; s.ki[i] = Math.sin(ph) / n; }
    }
    // 吸收掩码 m = e^{−γ dt}，γ = rate·u²，u = (宽度 − 到边的格数)/宽度
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const d = Math.min(x, nx - 1 - x, y, ny - 1 - y), u = absorb > 0 && d < absorb ? (absorb - d) / absorb : 0;
      s.mask[y * nx + x] = Math.exp(-rate * u * u * dt);
    }
    W.setPotential(s, V || new Float64Array(n));
    return s;
  };
  W.setPotential = (s, V) => { for (let i = 0; i < V.length; i++) { s.ur[i] = Math.cos(-0.5 * V[i] * s.dt); s.ui[i] = Math.sin(-0.5 * V[i] * s.dt); } };
  // 高斯波包 ψ ∝ exp(−(x−x₀)²/(4σx²) − (y−y₀)²/(4σy²) + i(kx·x + ky·y))；σ 是 |ψ|² 的标准差。归一化到 Σ|ψ|² = 1
  W.gaussian = (s, { x0, y0, sx, sy = sx, kx = 0, ky = 0 }) => {
    const { nx, ny, re, im } = s;
    let sum = 0;
    for (let y = 0; y < ny; y++) for (let x = 0; x < nx; x++) {
      const i = y * nx + x, a = Math.exp(-((x - x0) ** 2) / (4 * sx * sx) - ((y - y0) ** 2) / (4 * sy * sy)), ph = kx * x + ky * y;
      re[i] = a * Math.cos(ph); im[i] = a * Math.sin(ph); sum += a * a;
    }
    const f = 1 / Math.sqrt(sum);
    for (let i = 0; i < re.length; i++) { re[i] *= f; im[i] *= f; }
    s.gone.fill(0); s.t = 0; s.steps = 0;
    return s;
  };
  const halfV = (s, absorb) => {
    const { re, im, ur, ui, mask, gone } = s;
    for (let i = 0; i < re.length; i++) {
      const a = re[i], b = im[i];
      let r = a * ur[i] - b * ui[i], q = a * ui[i] + b * ur[i];
      if (absorb) { const m = mask[i]; if (m < 1) { gone[i] += (r * r + q * q) * (1 - m * m); r *= m; q *= m; } }
      re[i] = r; im[i] = q;
    }
  };
  W.step = (s, k = 1) => {
    const { re, im, kr, ki } = s, absorb = s.absorb > 0;
    for (let n = 0; n < k; n++) {
      halfV(s, false);
      W.fft2(s, false);
      for (let i = 0; i < re.length; i++) { const a = re[i], b = im[i]; re[i] = a * kr[i] - b * ki[i]; im[i] = a * ki[i] + b * kr[i]; }
      W.fft2(s, true);
      halfV(s, absorb);
      s.steps++; s.t = s.steps * s.dt;
    }
    return s;
  };
  W.norm = (s) => { let p = 0; for (let i = 0; i < s.re.length; i++) p += s.re[i] * s.re[i] + s.im[i] * s.im[i]; return p; };
  W.absorbed = (s) => s.gone.reduce((a, b) => a + b, 0);
  // 矩形 [x0, x1) × [y0, y1) 里的概率；withGone 把在这里被吸收掉的也算上
  W.prob = (s, [x0, y0, x1, y1], withGone = false) => {
    let p = 0;
    for (let y = Math.max(0, y0); y < Math.min(s.ny, y1); y++) for (let x = Math.max(0, x0), i = y * s.nx + x; x < Math.min(s.nx, x1); x++, i++) {
      p += s.re[i] * s.re[i] + s.im[i] * s.im[i];
      if (withGone) p += s.gone[i];
    }
    return p;
  };
  // 位置的一阶、二阶矩
  W.moments = (s) => {
    let p = 0, mx = 0, my = 0, xx = 0, yy = 0;
    for (let y = 0; y < s.ny; y++) for (let x = 0, i = y * s.nx; x < s.nx; x++, i++) {
      const d = s.re[i] * s.re[i] + s.im[i] * s.im[i];
      p += d; mx += d * x; my += d * y; xx += d * x * x; yy += d * y * y;
    }
    mx /= p; my /= p;
    return { norm: p, x: mx, y: my, sx: Math.sqrt(xx / p - mx * mx), sy: Math.sqrt(yy / p - my * my) };
  };
  // 自由高斯波包的宽度（ħ = m = 1）：σ(t) = σ₀ √(1 + (t / (2σ₀²))²)
  W.freeWidth = (s0, t) => s0 * Math.sqrt(1 + (t / (2 * s0 * s0)) ** 2);

  // ── 条纹计数 ─────────────────────────────────────────────────────────
  // I：屏上每一行累积的强度。在 [lo, hi) 里找局部极大，高于最大值的 thr 倍才算；
  // 相邻两个峰之间的谷要低于较矮那个峰的 vis 倍，否则只算一个（留下较高的）。
  W.fringes = (I, lo = 0, hi = I.length, { thr = 0.08, vis = 0.7 } = {}) => {
    let top = 0;
    for (let y = lo; y < hi; y++) top = Math.max(top, I[y]);
    if (!(top > 0)) return { count: 0, peaks: [] };
    const peaks = [];
    for (let y = lo + 1; y < hi - 1; y++) {
      if (!(I[y] >= I[y - 1] && I[y] > I[y + 1] && I[y] >= thr * top)) continue;
      const prev = peaks[peaks.length - 1];
      if (prev != null) {
        let dip = Infinity;
        for (let z = prev; z <= y; z++) dip = Math.min(dip, I[z]);
        if (dip > vis * Math.min(I[prev], I[y])) { if (I[y] > I[prev]) peaks[peaks.length - 1] = y; continue; }
      }
      peaks.push(y);
    }
    return { count: peaks.length, peaks };
  };

  // ── 关卡 ─────────────────────────────────────────────────────────────
  // 格子的值：0 空，1 玩家画的墙，2 固定的墙，3 可以擦的势垒，4 固定的势垒。
  // 布局和参考解都写成矩形 [x0, y0, x1, y1, 值]（左闭右开）。预算 = 和初始布局不同的格子数。
  W.N = 128;
  W.EMPTY = 0; W.PAINT = 1; W.LOCK = 2; W.BARRIER = 3; W.BARRIER_LOCK = 4;
  const N = W.N, A = W.ABSORB;
  // 每关：时间步 dt、总步数 steps（结束时刻 T = steps·dt）、预算 budget、波包 packet、初始布局 layout、
  // 目标 goal、星级门槛 stars（成绩 ≥ 门槛就得一颗）和一份参考解 ref（tools/play-test.mjs 检查它拿满三星、不超预算）。
  W.levels = [
    { // 双缝：固定的墙（4 格厚）上有一道 32 格宽的口子，在口子里画墙把它分成两条缝；屏在 x = 104
      id: 'slits', dt: 0.25, steps: 420, budget: 60,
      packet: { x0: 24, y0: 64, sx: 6, sy: 16, kx: 1.2 },
      layout: [[44, 0, 48, 48, W.LOCK], [44, 80, 48, N, W.LOCK]],
      goal: { type: 'fringes', screen: [104, 106], rows: [A, N - A], through: [48, 0, N, N] },
      stars: [3, 5, 7],
      ref: [[44, 52, 46, 76, W.PAINT]], // 口子中间一根 24 格长、2 格厚的墙：两条 4 格宽的缝，中心相距 28 格
    },
    { // 隧穿：一道 6 格厚、V = 1 的势垒（波包动能 E = 0.5），最右一列不能擦；擦薄它，让波包穿过去
      id: 'tunnel', dt: 0.25, steps: 300, budget: 200, vb: 1,
      packet: { x0: 28, y0: 64, sx: 8, sy: 10, kx: 1 },
      layout: [[60, 0, 65, N, W.BARRIER], [65, 0, 66, N, W.BARRIER_LOCK]],
      goal: { type: 'past', region: [66, 0, N, N] },
      stars: [0.2, 0.3, 0.34],
      ref: [[60, 44, 65, 84, W.EMPTY]], // 波包正前方 40 行擦到只剩 1 格
    },
    { // 引导：波包向右飞，目标框在右上方；用不超过预算的墙格做一面 45° 的镜子把它反射上去
      id: 'steer', dt: 0.25, steps: 440, budget: 70,
      packet: { x0: 22, y0: 92, sx: 6, sy: 6, kx: 1.2 },
      layout: [],
      goal: { type: 'box', region: [74, 14, 106, 44] },
      stars: [0.3, 0.45, 0.55],
      ref: { line: [80, 104, 100, 84] }, // 2×2 笔刷画的一条斜线
    },
    { // 自由玩：随便画，不限格数
      id: 'free', dt: 0.25, steps: 600, budget: Infinity,
      packet: { x0: 24, y0: 64, sx: 6, sy: 10, kx: 1.2 },
      layout: [],
      goal: { type: 'none' },
      stars: [],
      ref: [],
    },
  ];
  W.BRUSH = 2; // 画笔是 2×2 格
  // 笔刷沿直线移动经过的方块（相邻两块至少共用一条边，斜线也不会留缝）
  W.brushLine = (x0, y0, x1, y1, size = W.BRUSH, v = W.PAINT) => {
    const out = [], n = Math.max(Math.abs(x1 - x0), Math.abs(y1 - y0), 1);
    for (let k = 0; k <= n; k++) { const x = Math.round(x0 + ((x1 - x0) * k) / n), y = Math.round(y0 + ((y1 - y0) * k) / n); out.push([x, y, x + size, y + size, v]); }
    return out;
  };
  W.refRects = (L) => (L.ref.line ? W.brushLine(...L.ref.line) : L.ref);
  W.layout = (L) => { const c = new Uint8Array(N * N); W.paint(c, L.layout, true); return c; };
  // 把矩形写进格子；固定的格子（2、4）只有布局本身能写
  W.paint = (cells, rects, force = false) => {
    for (const [x0, y0, x1, y1, v] of rects) for (let y = Math.max(0, y0); y < Math.min(N, y1); y++) for (let x = Math.max(0, x0); x < Math.min(N, x1); x++) {
      const i = y * N + x;
      if (force) cells[i] = v;
      else if (W.editable(cells[i]) && (v === W.EMPTY || v === W.PAINT)) cells[i] = v;
    }
    return cells;
  };
  W.editable = (v) => v === W.EMPTY || v === W.PAINT || v === W.BARRIER;
  W.edits = (L, cells) => { const base = W.layout(L); let n = 0; for (let i = 0; i < cells.length; i++) if (cells[i] !== base[i]) n++; return n; };
  W.potential = (L, cells) => {
    const V = new Float64Array(cells.length);
    for (let i = 0; i < cells.length; i++) V[i] = cells[i] === W.PAINT || cells[i] === W.LOCK ? W.WALL : cells[i] === W.BARRIER || cells[i] === W.BARRIER_LOCK ? L.vb : 0;
    return V;
  };
  W.stars = (L, v) => L.stars.filter((t) => v >= t - 1e-12).length;
  // 一局：UI 和测试用同一个对象。advance(k) 走 k 步并记录测量；result() 给出关卡的成绩
  W.runner = (L, cells, opts = {}) => {
    const s = W.sim({ nx: N, dt: L.dt, V: W.potential(L, cells), ...opts });
    W.gaussian(s, L.packet);
    const g = L.goal, screen = g.type === 'fringes' ? new Float64Array(N) : null;
    let peak = 0;
    const measure = () => {
      if (screen) for (let y = 0; y < N; y++) for (let x = g.screen[0]; x < g.screen[1]; x++) { const i = y * N + x; screen[y] += (s.re[i] * s.re[i] + s.im[i] * s.im[i]) * s.dt; }
      if (g.type === 'box') peak = Math.max(peak, W.prob(s, g.region));
    };
    const r = {
      s, L, screen,
      done: () => s.steps >= L.steps,
      advance(k = 1) { for (let n = 0; n < k && s.steps < L.steps; n++) { W.step(s, 1); measure(); } return r; },
      // 现在的读数：双缝是已经穿过墙的概率，隧穿是穿过势垒的概率（都含飞出画面的），引导是框里的概率，自由玩是画面里还剩的概率
      now: () => (g.type === 'fringes' ? W.prob(s, g.through, true) : g.type === 'past' ? W.prob(s, g.region, true) : g.type === 'box' ? W.prob(s, g.region) : W.norm(s)),
      value: () => (g.type === 'fringes' ? W.fringes(screen, g.rows[0], g.rows[1]).count : g.type === 'past' ? W.prob(s, g.region, true) : g.type === 'box' ? peak : 0),
      result: () => { const v = r.value(); return { value: v, stars: W.stars(L, v) }; },
      run: () => { while (!r.done()) r.advance(50); return r.result(); },
    };
    return r;
  };
  W.refCells = (L) => W.paint(W.layout(L), W.refRects(L));

  if (typeof window !== 'undefined') window.MOLASTRIA_WAVE2D = W;
  if (typeof module !== 'undefined') module.exports = W;
})();
