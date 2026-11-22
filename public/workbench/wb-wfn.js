/* 计算工作台 · 波函数和实空间函数的纯函数：
   - 读 Molden（[Atoms] [GTO] [MO]，球谐 / 笛卡尔的 d f g，[5D] [7F] [9G] 等标记），在格点上算分子轨道和电子密度；
   - 读写 Gaussian cube；
   - 原子密度叠加（promolecule，表在 wb-promol.js）：Hirshfeld 面的权重函数和 d_norm、指纹图的 (d_i, d_e) 点、
     IGM 的 δg^inter、IRI，以及给它们着色的 sign(λ₂)ρ；
   - 用点电荷近似的静电势（没有 cube 时给静电势着色用，页面上标明是近似）；读 Mulliken / Hirshfeld / CHELPG 电荷。
   没有 DOM，可以在 Web Worker 里跑（wb-worker.js）。浏览器里是 self.MolAstriaWBWfn，node 里是 module.exports。
   Molden 读法用 PySCF 写的文件逐点核对（tools/workbench/fixtures.py → tools/workbench-test.mjs）。 */
(function (root) {
  'use strict';

  const BOHR = 0.529177210903; // Å
  const SYMBOLS = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr '
    + 'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu '
    + 'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn').split(' ');
  const LVAL = { s: 0, p: 1, d: 2, f: 3, g: 4 };
  const dfact = (n) => { let r = 1; for (let k = n; k > 1; k -= 2) r *= k; return r; }; // (−1)!! = 1
  const gammaHalf = (l) => { let g = Math.sqrt(Math.PI) / 2; for (let k = 1; k <= l; k++) g *= k + 0.5; return g; }; // Γ(l + 3/2)

  // 笛卡尔分量的顺序（Molden 约定）
  const CART = {
    0: [[0, 0, 0]],
    1: [[1, 0, 0], [0, 1, 0], [0, 0, 1]],
    2: [[2, 0, 0], [0, 2, 0], [0, 0, 2], [1, 1, 0], [1, 0, 1], [0, 1, 1]],
    3: [[3, 0, 0], [0, 3, 0], [0, 0, 3], [1, 2, 0], [2, 1, 0], [2, 0, 1], [1, 0, 2], [0, 1, 2], [0, 2, 1], [1, 1, 1]],
    4: [[4, 0, 0], [0, 4, 0], [0, 0, 4], [3, 1, 0], [3, 0, 1], [1, 3, 0], [0, 3, 1], [1, 0, 3], [0, 1, 3], [2, 2, 0], [2, 0, 2], [0, 2, 2], [2, 1, 1], [1, 2, 1], [1, 1, 2]],
  };
  // 实球谐函数 r^l·Y_lm（∫Y² dΩ = 1），按 Molden 的顺序 m = 0, +1, −1, +2, −2, …
  const SQ = Math.sqrt, PI = Math.PI;
  const SPH = {
    0: [() => 1 / (2 * SQ(PI))],
    1: [(x) => SQ(3 / (4 * PI)) * x, (x, y) => SQ(3 / (4 * PI)) * y, (x, y, z) => SQ(3 / (4 * PI)) * z],
    2: [
      (x, y, z) => 0.25 * SQ(5 / PI) * (2 * z * z - x * x - y * y),
      (x, y, z) => 0.5 * SQ(15 / PI) * x * z,
      (x, y, z) => 0.5 * SQ(15 / PI) * y * z,
      (x, y) => 0.25 * SQ(15 / PI) * (x * x - y * y),
      (x, y) => 0.5 * SQ(15 / PI) * x * y,
    ],
    3: [
      (x, y, z) => 0.25 * SQ(7 / PI) * z * (2 * z * z - 3 * x * x - 3 * y * y),
      (x, y, z) => 0.25 * SQ(21 / (2 * PI)) * x * (4 * z * z - x * x - y * y),
      (x, y, z) => 0.25 * SQ(21 / (2 * PI)) * y * (4 * z * z - x * x - y * y),
      (x, y, z) => 0.25 * SQ(105 / PI) * z * (x * x - y * y),
      (x, y, z) => 0.5 * SQ(105 / PI) * x * y * z,
      (x, y) => 0.25 * SQ(35 / (2 * PI)) * x * (x * x - 3 * y * y),
      (x, y) => 0.25 * SQ(35 / (2 * PI)) * y * (3 * x * x - y * y),
    ],
    4: [
      (x, y, z) => { const r2 = x * x + y * y + z * z; return (3 / 16) * SQ(1 / PI) * (35 * z ** 4 - 30 * z * z * r2 + 3 * r2 * r2); },
      (x, y, z) => { const r2 = x * x + y * y + z * z; return 0.75 * SQ(5 / (2 * PI)) * x * z * (7 * z * z - 3 * r2); },
      (x, y, z) => { const r2 = x * x + y * y + z * z; return 0.75 * SQ(5 / (2 * PI)) * y * z * (7 * z * z - 3 * r2); },
      (x, y, z) => { const r2 = x * x + y * y + z * z; return 0.375 * SQ(5 / PI) * (x * x - y * y) * (7 * z * z - r2); },
      (x, y, z) => { const r2 = x * x + y * y + z * z; return 0.75 * SQ(5 / PI) * x * y * (7 * z * z - r2); },
      (x, y, z) => 0.75 * SQ(35 / (2 * PI)) * x * z * (x * x - 3 * y * y),
      (x, y, z) => 0.75 * SQ(35 / (2 * PI)) * y * z * (3 * x * x - y * y),
      (x, y) => (3 / 16) * SQ(35 / PI) * (x * x * (x * x - 3 * y * y) - y * y * (3 * x * x - y * y)),
      (x, y) => 0.75 * SQ(35 / PI) * x * y * (x * x - y * y),
    ],
  };

  /**
   * 读 Molden。返回 { atoms: [{ el, Z, x, y, z }]（bohr）, shells: [{ atom, l, pure, exps, coefs }], nbf, mos: [{ e, occ, spin, sym, c: Float64Array }], warnings }。
   * 笛卡尔函数按“每个分量各自归一”的约定；PySCF、Multiwfn、Molden 本身都这样写（tools/workbench-test.mjs 用 PySCF 的文件核对）。
   */
  function parseMolden(text) {
    const t = String(text || '').replace(/\r/g, '');
    if (!/\[Molden Format\]/i.test(t) && !/\[GTO\]/i.test(t)) throw new Error('molden:format');
    const sections = {};
    let cur = null;
    for (const line of t.split('\n')) {
      const m = /^\s*\[([^\]]+)\]\s*(.*)$/.exec(line);
      if (m) { cur = m[1].trim().toLowerCase(); sections[cur] = sections[cur] || { arg: m[2].trim(), lines: [] }; continue; }
      if (cur) sections[cur].lines.push(line);
    }
    const flags = Object.keys(sections);
    const pureD = flags.some((f) => f === '5d' || f === '5d7f' || f === '5d10f');
    const pureF = flags.some((f) => f === '5d' || f === '5d7f' || f === '7f');
    const pureG = flags.includes('9g');
    const warnings = [];
    // 原子
    const asec = sections.atoms;
    if (!asec) throw new Error('molden:atoms');
    const angs = /angs/i.test(asec.arg);
    const atoms = [];
    for (const l of asec.lines) {
      const f = l.trim().split(/\s+/);
      if (f.length < 6) continue;
      const Z = Number(f[2]), xyz = f.slice(3, 6).map(Number);
      if (!Number.isFinite(Z) || !xyz.every(Number.isFinite)) continue;
      const s = angs ? 1 / BOHR : 1;
      atoms.push({ el: SYMBOLS[Z - 1] || f[0], Z, x: xyz[0] * s, y: xyz[1] * s, z: xyz[2] * s });
    }
    if (!atoms.length) throw new Error('molden:atoms');
    // 基组
    const gsec = sections.gto;
    if (!gsec) throw new Error('molden:gto');
    const shells = [];
    const gl = gsec.lines;
    let atomIdx = -1;
    for (let i = 0; i < gl.length; i++) {
      const f = gl[i].trim().split(/\s+/);
      if (!f[0]) continue;
      if (/^\d+$/.test(f[0]) && (f.length === 1 || /^\d+$/.test(f[1] || ''))) { atomIdx = Number(f[0]) - 1; continue; }
      const type = f[0].toLowerCase();
      if (!/^(s|p|d|f|g|sp)$/.test(type)) continue;
      const np = Number(f[1]);
      const exps = [], c1 = [], c2 = [];
      for (let k = 0; k < np; k++) {
        const v = gl[++i].trim().replace(/[dD]/g, 'e').split(/\s+/).map(Number);
        exps.push(v[0]); c1.push(v[1]); c2.push(v[2]);
      }
      if (type === 'sp') { shells.push({ atom: atomIdx, l: 0, exps, coefs: c1 }); shells.push({ atom: atomIdx, l: 1, exps, coefs: c2 }); }
      else shells.push({ atom: atomIdx, l: LVAL[type], exps, coefs: c1 });
    }
    for (const s of shells) {
      s.pure = (s.l === 2 && pureD) || (s.l === 3 && pureF) || (s.l === 4 && pureG);
      s.n = s.l < 2 ? 2 * s.l + 1 : s.pure ? 2 * s.l + 1 : CART[s.l].length;
      normalizeShell(s);
    }
    const nbf = shells.reduce((a, s) => a + s.n, 0);
    // 轨道
    const msec = sections.mo;
    const mos = [];
    if (msec) {
      let mo = null;
      for (const l of msec.lines) {
        const s = l.trim();
        if (!s) continue;
        const kv = /^(\w+)\s*=\s*(.*)$/.exec(s);
        if (kv) {
          const k = kv[1].toLowerCase();
          if (!mo || mo.filled) { mo = { e: 0, occ: 0, spin: 'alpha', sym: '', c: new Float64Array(nbf), filled: false }; mos.push(mo); }
          if (k === 'ene') mo.e = Number(kv[2].replace(/[dD]/, 'e'));
          else if (k === 'occup') mo.occ = Number(kv[2].replace(/[dD]/, 'e'));
          else if (k === 'spin') mo.spin = /beta/i.test(kv[2]) ? 'beta' : 'alpha';
          else if (k === 'sym') mo.sym = kv[2].trim();
          continue;
        }
        const f = s.split(/\s+/);
        if (mo && f.length >= 2) { const i = Number(f[0]) - 1; if (i >= 0 && i < nbf) mo.c[i] = Number(f[1].replace(/[dD]/, 'e')); mo.filled = true; }
      }
      for (const m of mos) delete m.filled;
    }
    if (!mos.length) warnings.push('no-mo');
    return { atoms, shells, nbf, mos, warnings, pure: { d: pureD, f: pureF, g: pureG } };
  }
  /** 把收缩系数乘上原始函数的归一化因子，再让整个收缩函数归一。 */
  function normalizeShell(s) {
    const l = s.l, n = s.exps.length;
    if (s.pure || l < 2) {
      // 径向部分 r^l e^{−αr²}，乘上 ∫Y²dΩ = 1 的球谐函数
      const N = s.exps.map((a) => Math.sqrt((2 * (2 * a) ** (l + 1.5)) / gammaHalf(l)));
      let S = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) S += s.coefs[i] * s.coefs[j] * N[i] * N[j] * gammaHalf(l) / (2 * (s.exps[i] + s.exps[j]) ** (l + 1.5));
      s.cn = s.coefs.map((c, i) => (c * N[i]) / Math.sqrt(S));
      s.kind = 'sph';
    } else {
      // 笛卡尔：每个分量 x^a y^b z^c 各自归一。径向部分先按 x^l 归一，分量的差别在 cartNorm 里补
      const N = s.exps.map((a) => ((2 * a) / PI) ** 0.75 * (4 * a) ** (l / 2) / Math.sqrt(dfact(2 * l - 1)));
      let S = 0;
      for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) S += s.coefs[i] * s.coefs[j] * N[i] * N[j] * (PI ** 1.5 * dfact(2 * l - 1)) / (2 ** l * (s.exps[i] + s.exps[j]) ** (l + 1.5));
      s.cn = s.coefs.map((c, i) => (c * N[i]) / Math.sqrt(S));
      s.cartNorm = CART[l].map(([a, b, c]) => Math.sqrt(dfact(2 * l - 1) / (dfact(2 * a - 1) * dfact(2 * b - 1) * dfact(2 * c - 1))));
      s.kind = 'cart';
    }
    s.amin = Math.min(...s.exps);
  }

  /** 一点上所有基函数的值（坐标 bohr）。out 是长度 nbf 的数组。 */
  function basisAt(w, x, y, z, out) {
    let k = 0;
    for (const s of w.shells) {
      const A = w.atoms[s.atom];
      const dx = x - A.x, dy = y - A.y, dz = z - A.z, r2 = dx * dx + dy * dy + dz * dz;
      if (s.amin * r2 > 46) { for (let q = 0; q < s.n; q++) out[k++] = 0; continue; }
      let R = 0;
      for (let i = 0; i < s.cn.length; i++) R += s.cn[i] * Math.exp(-s.exps[i] * r2);
      if (s.kind === 'sph') { for (const Y of SPH[s.l]) out[k++] = R * Y(dx, dy, dz); }
      else {
        const comps = CART[s.l];
        for (let q = 0; q < comps.length; q++) { const [a, b, c] = comps[q]; out[k++] = R * s.cartNorm[q] * dx ** a * dy ** b * dz ** c; }
      }
    }
    return out;
  }
  /** 一点上的轨道值。 */
  function moAt(w, mo, x, y, z, buf = new Float64Array(w.nbf)) {
    basisAt(w, x, y, z, buf);
    let v = 0;
    for (let i = 0; i < w.nbf; i++) v += mo.c[i] * buf[i];
    return v;
  }
  /** 一点上的电子密度 Σ n_i |φ_i|²（Molden 里的占据数，α 和 β 分开写的就分开加）。 */
  function densityAt(w, x, y, z, buf = new Float64Array(w.nbf), occ = w.mos.filter((m) => m.occ > 1e-8)) {
    basisAt(w, x, y, z, buf);
    let rho = 0;
    for (const m of occ) { let v = 0; for (let i = 0; i < w.nbf; i++) v += m.c[i] * buf[i]; rho += m.occ * v * v; }
    return rho;
  }
  /** 前线轨道：按自旋分开排，返回 { homo, lumo }（mos 里的下标，β 的单独给）。 */
  function frontierMos(w) {
    const pick = (spin) => {
      const list = w.mos.map((m, i) => ({ m, i })).filter((o) => o.m.spin === spin).sort((a, b) => a.m.e - b.m.e);
      const occ = list.filter((o) => o.m.occ > 0.5), vir = list.filter((o) => o.m.occ <= 0.5);
      return { homo: occ.length ? occ[occ.length - 1].i : -1, lumo: vir.length ? vir[0].i : -1 };
    };
    return { alpha: pick('alpha'), beta: w.mos.some((m) => m.spin === 'beta') ? pick('beta') : null };
  }

  // ── 格点和 cube ──────────────────────────────────────────────────────
  /** 包住一组点（bohr）的格子：外扩 margin（bohr），步长 h（bohr），总点数超过 maxPts 时自动加大步长。 */
  function gridFor(pts, { margin = 4.5, h = 0.25, maxPts = 4e5 } = {}) {
    const lo = [0, 1, 2].map((d) => Math.min(...pts.map((p) => p[d])) - margin), hi = [0, 1, 2].map((d) => Math.max(...pts.map((p) => p[d])) + margin);
    let step = h, n;
    for (;;) {
      n = lo.map((v, d) => Math.max(2, Math.ceil((hi[d] - v) / step) + 1));
      if (n[0] * n[1] * n[2] <= maxPts) break;
      step *= 1.08;
    }
    return { origin: lo, h: step, n };
  }
  /** 在格子上算一个函数 f(x, y, z)（bohr），数据按 cube 的顺序（x 最慢、z 最快）。progress(k, total)。 */
  function fillGrid(g, f, progress) {
    const [nx, ny, nz] = g.n, data = new Float32Array(nx * ny * nz);
    let k = 0;
    for (let i = 0; i < nx; i++) {
      const x = g.origin[0] + i * g.h;
      for (let j = 0; j < ny; j++) {
        const y = g.origin[1] + j * g.h;
        for (let l = 0; l < nz; l++) data[k++] = f(x, y, g.origin[2] + l * g.h);
      }
      if (progress && i % 4 === 0) progress(i, nx);
    }
    return data;
  }
  /** 写 cube 文本。atoms 是 bohr 坐标的 { Z, x, y, z }。 */
  function cubeText(g, data, atoms, title = 'MolAstria workbench', title2 = '') {
    const e = (v) => { const s = v.toExponential(5).toUpperCase().replace(/E([+-])(\d)$/, 'E$10$2'); return (v < 0 ? '' : ' ') + s; };
    const L = [title, title2 || 'cube written in the browser', `${String(atoms.length).padStart(5)} ${g.origin.map((v) => v.toFixed(6).padStart(12)).join('')}`];
    for (let d = 0; d < 3; d++) { const v = [0, 0, 0]; v[d] = g.h; L.push(`${String(g.n[d]).padStart(5)} ${v.map((x) => x.toFixed(6).padStart(12)).join('')}`); }
    for (const a of atoms) L.push(`${String(a.Z).padStart(5)} ${a.Z.toFixed(6).padStart(12)}${[a.x, a.y, a.z].map((x) => x.toFixed(6).padStart(12)).join('')}`);
    const out = [L.join('\n')];
    const nz = g.n[2];
    let line = [];
    for (let k = 0; k < data.length; k++) {
      line.push(e(data[k]));
      if (line.length === 6 || (k + 1) % nz === 0) { out.push(line.join(' ')); line = []; }
    }
    return out.join('\n') + '\n';
  }
  /** 读 cube：{ title, atoms（bohr）, origin, axes（3×3，bohr）, n, data: Float32Array, mo? }。 */
  function parseCube(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    const h = lines[2].trim().split(/\s+/).map(Number);
    let nat = h[0];
    const mo = nat < 0; nat = Math.abs(nat);
    const origin = h.slice(1, 4);
    const axes = [], n = [];
    let unit = 1;
    for (let d = 0; d < 3; d++) { const f = lines[3 + d].trim().split(/\s+/).map(Number); n.push(Math.abs(f[0])); if (f[0] < 0) unit = 1 / BOHR; axes.push(f.slice(1, 4)); }
    if (unit !== 1) { for (let d = 0; d < 3; d++) axes[d] = axes[d].map((v) => v * unit); for (let d = 0; d < 3; d++) origin[d] *= unit; }
    const atoms = [];
    for (let i = 0; i < nat; i++) { const f = lines[6 + i].trim().split(/\s+/).map(Number); atoms.push({ Z: f[0], el: SYMBOLS[f[0] - 1] || 'X', x: f[2] * unit, y: f[3] * unit, z: f[4] * unit }); }
    let k = 6 + nat + (mo ? 1 : 0);
    const total = n[0] * n[1] * n[2], data = new Float32Array(total);
    let p = 0;
    for (; k < lines.length && p < total; k++) {
      const s = lines[k].trim();
      if (!s) continue;
      for (const v of s.split(/\s+/)) if (p < total) data[p++] = Number(v);
    }
    if (p < total) throw new Error('cube:short');
    return { title: lines[0].trim(), title2: lines[1].trim(), atoms, origin, axes, n, data };
  }
  /** cube 的格点积分（体积元 = 三条轴张成的平行六面体）。 */
  function cubeIntegral(c) {
    const [a, b, cc] = c.axes;
    const vol = Math.abs(a[0] * (b[1] * cc[2] - b[2] * cc[1]) - a[1] * (b[0] * cc[2] - b[2] * cc[0]) + a[2] * (b[0] * cc[1] - b[1] * cc[0]));
    let s = 0;
    for (let i = 0; i < c.data.length; i++) s += c.data[i];
    return s * vol;
  }

  // ── 原子密度叠加（promolecule）────────────────────────────────────────
  /** Z > 36 的元素借同族第四周期的原子密度（近似，页面上会提示）。 */
  const proxyZ = (Z) => (Z <= 36 ? Z : Z <= 54 ? Z - 18 : Z <= 56 ? Z - 36 : Z <= 71 ? 21 : Z <= 86 ? Z - 50 : 36);
  /** 由 wb-promol.js 的表建每个元素的样条：返回 rho(Z, r) → [ρ, ρ′, ρ″]（r 单位 bohr）。 */
  function makePromol(T) {
    const n = T.n, x0 = Math.log(T.r0), dx = (Math.log(T.r1) - x0) / (n - 1);
    const cache = {};
    const build = (el) => {
      const a = T.atoms[el];
      const y = a.ln, M = new Float64Array(n);
      // 等距节点的自然样条：M_{i−1} + 4M_i + M_{i+1} = 6(y_{i+1} − 2y_i + y_{i−1})/dx²
      const cp = new Float64Array(n), dp = new Float64Array(n);
      for (let i = 1; i < n - 1; i++) {
        const rhs = (6 * (y[i + 1] - 2 * y[i] + y[i - 1])) / (dx * dx);
        const m = 4 - (i > 1 ? cp[i - 1] : 0);
        cp[i] = 1 / m;
        dp[i] = (rhs - (i > 1 ? dp[i - 1] : 0)) / m;
      }
      for (let i = n - 2; i >= 1; i--) M[i] = dp[i] - cp[i] * M[i + 1];
      return { y, M, k: a.k };
    };
    return function rho(Z, r) {
      const el = SYMBOLS[proxyZ(Z) - 1];
      const s = cache[el] || (cache[el] = build(el));
      if (r <= T.r0) return [Math.exp(s.y[0]), 0, 0];
      if (r >= T.r1) { const v = Math.exp(s.y[n - 1] - s.k * (r - T.r1)); return [v, -s.k * v, s.k * s.k * v]; }
      const x = Math.log(r), u = (x - x0) / dx;
      const i = Math.min(n - 2, Math.floor(u)), t = u - i;
      const A = 1 - t, B = t;
      const yv = A * s.y[i] + B * s.y[i + 1] + (((A ** 3 - A) * s.M[i] + (B ** 3 - B) * s.M[i + 1]) * dx * dx) / 6;
      const y1 = (s.y[i + 1] - s.y[i]) / dx + ((-(3 * A * A - 1) * s.M[i] + (3 * B * B - 1) * s.M[i + 1]) * dx) / 6; // dy/dx
      const y2 = A * s.M[i] + B * s.M[i + 1]; // d²y/dx²
      const yr = y1 / r, yrr = (y2 - y1) / (r * r);
      const v = Math.exp(yv);
      return [v, v * yr, v * (yrr + yr * yr)];
    };
  }
  /** 3×3 对称矩阵的本征值（升序），三角函数解法。 */
  function eig3(a, b, c, d, e, f) { // [[a,d,e],[d,b,f],[e,f,c]]
    const p1 = d * d + e * e + f * f;
    if (p1 < 1e-30) return [a, b, c].sort((x, y) => x - y);
    const q = (a + b + c) / 3;
    const p2 = (a - q) ** 2 + (b - q) ** 2 + (c - q) ** 2 + 2 * p1, p = Math.sqrt(p2 / 6);
    const B = [(a - q) / p, (b - q) / p, (c - q) / p, d / p, e / p, f / p];
    const detB = B[0] * (B[1] * B[2] - B[5] * B[5]) - B[3] * (B[3] * B[2] - B[5] * B[4]) + B[4] * (B[3] * B[5] - B[1] * B[4]);
    const r = Math.max(-1, Math.min(1, detB / 2)), phi = Math.acos(r) / 3;
    const l1 = q + 2 * p * Math.cos(phi), l3 = q + 2 * p * Math.cos(phi + (2 * PI) / 3);
    return [l3, 3 * q - l1 - l3, l1];
  }
  /**
   * 一点上的原子密度叠加：返回 { rho, g（总梯度）, H（Hessian 的 6 个分量 xx yy zz xy xz yz）, parts }。
   * groups：把原子分组（比如两个片段），parts[k] = { rho, g } 是第 k 组的贡献。atoms 用 bohr、Z。cut 是截断半径（bohr）。
   */
  function promolAt(rhoFn, atoms, x, y, z, groups = null, cut = 10) {
    let rho = 0;
    const g = [0, 0, 0], H = [0, 0, 0, 0, 0, 0];
    const parts = groups ? groups.map(() => ({ rho: 0, g: [0, 0, 0] })) : null;
    for (let i = 0; i < atoms.length; i++) {
      const A = atoms[i];
      const dx = x - A.x, dy = y - A.y, dz = z - A.z, r2 = dx * dx + dy * dy + dz * dz;
      if (r2 > cut * cut) continue;
      const r = Math.max(Math.sqrt(r2), 1e-6);
      const [v, v1, v2] = rhoFn(A.Z, r);
      const ux = dx / r, uy = dy / r, uz = dz / r;
      rho += v;
      const gx = v1 * ux, gy = v1 * uy, gz = v1 * uz;
      g[0] += gx; g[1] += gy; g[2] += gz;
      const t = v1 / r; // 切向
      H[0] += v2 * ux * ux + t * (1 - ux * ux); H[1] += v2 * uy * uy + t * (1 - uy * uy); H[2] += v2 * uz * uz + t * (1 - uz * uz);
      H[3] += (v2 - t) * ux * uy; H[4] += (v2 - t) * ux * uz; H[5] += (v2 - t) * uy * uz;
      if (parts) { const k = groups[i]; if (k >= 0) { parts[k].rho += v; parts[k].g[0] += gx; parts[k].g[1] += gy; parts[k].g[2] += gz; } }
    }
    return { rho, g, H, parts };
  }
  const len3 = (v) => Math.hypot(v[0], v[1], v[2]);

  /**
   * IGM / IRI 的格点（原子密度叠加）。atoms：bohr + Z；frag：每个原子属于片段 0 或 1（IRI 可以不分）。
   * 返回 { grid, main（δg^inter 或 IRI）, sl2r（sign(λ₂)ρ）, scatter: [[sign(λ₂)ρ, 值]] 抽样 } 。
   * δg^inter = |abs(∇ρ_A) + abs(∇ρ_B)| − |∇ρ_A + ∇ρ_B|（abs 逐分量取，Lefebvre 等 2017）；IRI = |∇ρ| / ρ^1.1（Lu & Chen 2021）。
   */
  function nciGrid(rhoFn, atoms, frag, kind, gopts = {}, progress) {
    const pts = atoms.map((a) => [a.x, a.y, a.z]);
    const g = gridFor(pts, { margin: gopts.margin ?? 3.5, h: gopts.h ?? 0.2, maxPts: gopts.maxPts ?? 6e5 });
    const [nx, ny, nz] = g.n, N = nx * ny * nz;
    const main = new Float32Array(N), sl2r = new Float32Array(N), scatter = [];
    const every = Math.max(1, Math.floor(N / 40000));
    let k = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) for (let l = 0; l < nz; l++, k++) {
        const x = g.origin[0] + i * g.h, y = g.origin[1] + j * g.h, z = g.origin[2] + l * g.h;
        const p = promolAt(rhoFn, atoms, x, y, z, kind === 'igm' ? frag : null);
        const lam = eig3(...p.H);
        const s = (lam[1] < 0 ? -1 : 1) * p.rho;
        sl2r[k] = s;
        let v;
        if (kind === 'igm') {
          const A = p.parts[0].g, B = p.parts[1].g;
          v = Math.hypot(Math.abs(A[0]) + Math.abs(B[0]), Math.abs(A[1]) + Math.abs(B[1]), Math.abs(A[2]) + Math.abs(B[2])) - len3(p.g);
        } else v = p.rho > 1e-12 ? len3(p.g) / p.rho ** 1.1 : 0;
        main[k] = v;
        if (k % every === 0 && p.rho < 0.2 && p.rho > 1e-5) scatter.push([s, v]);
      }
      if (progress && i % 4 === 0) progress(i, nx);
    }
    return { grid: g, main, sl2r, scatter };
  }

  // ── 密度的梯度和 Hessian（IGMH、真实密度的 sign(λ₂)ρ 用）────────────
  // 基函数 φ = P(dx, dy, dz)·R(r²)，R = Σ c·e^{−αr²}。R 的导数解析地写；P 是 l 次多项式（球谐或笛卡尔），
  // 它的一、二阶导数用步长 1e-3 bohr 的中心差分（对 l ≤ 2 的多项式是精确的，更高次的误差约 1e-7，测试对照 PySCF）。
  const FDH = 1e-3;
  function angularFn(s) {
    if (s.kind === 'sph') return SPH[s.l];
    return CART[s.l].map(([a, b, c], q) => (x, y, z) => s.cartNorm[q] * x ** a * y ** b * z ** c);
  }
  /** 一点上的 ρ、∇ρ 和 Hessian（xx yy zz xy xz yz）。ws：derivWork(w) 的缓冲。 */
  function derivWork(w) {
    const n = w.nbf;
    for (const s of w.shells) if (!s.P) s.P = angularFn(s);
    return { V: new Float64Array(n), G: new Float64Array(3 * n), H: new Float64Array(6 * n), occ: w.mos.filter((m) => m.occ > 1e-8) };
  }
  function rhoDerivsAt(w, x, y, z, ws = derivWork(w)) {
    const { V, G, H } = ws, h = FDH, h2 = h * h;
    let k = 0;
    for (const s of w.shells) {
      const A = w.atoms[s.atom];
      const dx = x - A.x, dy = y - A.y, dz = z - A.z, r2 = dx * dx + dy * dy + dz * dz;
      const m = s.P.length;
      if (s.amin * r2 > 46) { for (let q = 0; q < m; q++, k++) { V[k] = 0; G.fill(0, 3 * k, 3 * k + 3); H.fill(0, 6 * k, 6 * k + 6); } continue; }
      let R = 0, R1 = 0, R2 = 0;
      for (let i = 0; i < s.cn.length; i++) { const e = s.cn[i] * Math.exp(-s.exps[i] * r2), a = s.exps[i]; R += e; R1 -= a * e; R2 += a * a * e; }
      const d = [dx, dy, dz];
      for (let q = 0; q < m; q++, k++) {
        const f = s.P[q];
        const p0 = f(dx, dy, dz);
        let px = 0, py = 0, pz = 0, pxx = 0, pyy = 0, pzz = 0, pxy = 0, pxz = 0, pyz = 0;
        if (s.l > 0) {
          const xp = f(dx + h, dy, dz), xm = f(dx - h, dy, dz), yp = f(dx, dy + h, dz), ym = f(dx, dy - h, dz), zp = f(dx, dy, dz + h), zm = f(dx, dy, dz - h);
          px = (xp - xm) / (2 * h); py = (yp - ym) / (2 * h); pz = (zp - zm) / (2 * h);
          if (s.l > 1) {
            pxx = (xp - 2 * p0 + xm) / h2; pyy = (yp - 2 * p0 + ym) / h2; pzz = (zp - 2 * p0 + zm) / h2;
            pxy = (f(dx + h, dy + h, dz) - f(dx + h, dy - h, dz) - f(dx - h, dy + h, dz) + f(dx - h, dy - h, dz)) / (4 * h2);
            pxz = (f(dx + h, dy, dz + h) - f(dx + h, dy, dz - h) - f(dx - h, dy, dz + h) + f(dx - h, dy, dz - h)) / (4 * h2);
            pyz = (f(dx, dy + h, dz + h) - f(dx, dy + h, dz - h) - f(dx, dy - h, dz + h) + f(dx, dy - h, dz - h)) / (4 * h2);
          }
        }
        const P = [px, py, pz];
        V[k] = p0 * R;
        for (let a = 0; a < 3; a++) G[3 * k + a] = P[a] * R + p0 * 2 * d[a] * R1;
        // ∂²φ/∂a∂b = P_ab R + 2(P_a d_b + P_b d_a) R1 + P (4 d_a d_b R2 + 2 δ_ab R1)
        const PP = [[pxx, pxy, pxz], [pxy, pyy, pyz], [pxz, pyz, pzz]];
        const IDX = [[0, 0], [1, 1], [2, 2], [0, 1], [0, 2], [1, 2]];
        for (let t = 0; t < 6; t++) {
          const [a, b] = IDX[t];
          H[6 * k + t] = PP[a][b] * R + 2 * (P[a] * d[b] + P[b] * d[a]) * R1 + p0 * (4 * d[a] * d[b] * R2 + (a === b ? 2 * R1 : 0));
        }
      }
    }
    let rho = 0;
    const g = [0, 0, 0], Hs = [0, 0, 0, 0, 0, 0];
    const n = w.nbf;
    for (const mo of ws.occ) {
      const c = mo.c;
      let v = 0, gx = 0, gy = 0, gz = 0, h0 = 0, h1 = 0, h2b = 0, h3 = 0, h4 = 0, h5 = 0;
      for (let i = 0; i < n; i++) {
        const ci = c[i];
        if (ci === 0 || (V[i] === 0 && G[3 * i] === 0 && G[3 * i + 1] === 0 && G[3 * i + 2] === 0)) continue;
        v += ci * V[i]; gx += ci * G[3 * i]; gy += ci * G[3 * i + 1]; gz += ci * G[3 * i + 2];
        const o = 6 * i;
        h0 += ci * H[o]; h1 += ci * H[o + 1]; h2b += ci * H[o + 2]; h3 += ci * H[o + 3]; h4 += ci * H[o + 4]; h5 += ci * H[o + 5];
      }
      const nn = mo.occ;
      rho += nn * v * v;
      g[0] += 2 * nn * v * gx; g[1] += 2 * nn * v * gy; g[2] += 2 * nn * v * gz;
      Hs[0] += 2 * nn * (gx * gx + v * h0); Hs[1] += 2 * nn * (gy * gy + v * h1); Hs[2] += 2 * nn * (gz * gz + v * h2b);
      Hs[3] += 2 * nn * (gx * gy + v * h3); Hs[4] += 2 * nn * (gx * gz + v * h4); Hs[5] += 2 * nn * (gy * gz + v * h5);
    }
    return { rho, g, H: Hs };
  }
  /**
   * IGMH（Lu & Chen 2022）：IGM 的 δg^inter，但片段的密度用真实分子密度的 Hirshfeld 划分 ρ_F = W_F·ρ，
   * W_F = Σ_{A∈F} ρ_A^free / Σ_A ρ_A^free（自由原子球平均密度，wb-promol.js）。∇ρ_F = W_F ∇ρ + ρ ∇W_F，两个片段的梯度加起来正好是 ∇ρ。
   * δg^inter = |abs(∇ρ_1) + abs(∇ρ_2)| − |∇ρ|（abs 逐分量）；着色用真实密度的 sign(λ₂)ρ。w 是 parseMolden 的结果，frag[i] ∈ {0, 1}。
   */
  function igmhGrid(rhoFn, w, frag, gopts = {}, progress) {
    const atoms = w.atoms;
    const g = gridFor(atoms.map((a) => [a.x, a.y, a.z]), { margin: gopts.margin ?? 3.5, h: gopts.h ?? 0.25, maxPts: gopts.maxPts ?? 3e5 });
    const [nx, ny, nz] = g.n, N = nx * ny * nz;
    const main = new Float32Array(N), sl2r = new Float32Array(N), scatter = [];
    const every = Math.max(1, Math.floor(N / 40000));
    const ws = derivWork(w);
    let k = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) for (let l = 0; l < nz; l++, k++) {
        const x = g.origin[0] + i * g.h, y = g.origin[1] + j * g.h, z = g.origin[2] + l * g.h;
        const p = promolAt(rhoFn, atoms, x, y, z, frag);
        const f1 = p.parts[0], f2 = p.parts[1], rf = f1.rho + f2.rho;
        if (rf < 1e-14) { main[k] = 0; sl2r[k] = 0; continue; }
        const d = rhoDerivsAt(w, x, y, z, ws);
        const W1 = f1.rho / rf, r2 = rf * rf;
        const a = [0, 0, 0], b = [0, 0, 0];
        for (let c = 0; c < 3; c++) {
          const dW = (f1.g[c] * f2.rho - f1.rho * f2.g[c]) / r2;
          a[c] = W1 * d.g[c] + d.rho * dW;
          b[c] = d.g[c] - a[c];
        }
        const v = Math.hypot(Math.abs(a[0]) + Math.abs(b[0]), Math.abs(a[1]) + Math.abs(b[1]), Math.abs(a[2]) + Math.abs(b[2])) - len3(d.g);
        const lam = eig3(...d.H);
        const s = (lam[1] < 0 ? -1 : 1) * d.rho;
        main[k] = v; sl2r[k] = s;
        if (k % every === 0 && d.rho < 0.2 && d.rho > 1e-5) scatter.push([s, v]);
      }
      if (progress && i % 2 === 0) progress(i, nx);
    }
    return { grid: g, main, sl2r, scatter };
  }

  /**
   * Hirshfeld 面：inside 是一组原子（下标），其余是外面。权重 w = ρ_in / (ρ_in + ρ_out)，面取 w = 0.5。
   * 同时给出 d_norm = (d_i − r_i^vdW)/r_i^vdW + (d_e − r_e^vdW)/r_e^vdW（d_i、d_e 是到最近的里面 / 外面原子核的距离，Å），
   * 以及面上的点（格子棱上 w 穿过 0.5 的地方线性插值）给指纹图用：[{ di, de, ei, ee }]。
   * atoms：bohr + Z + el；vdw(el) 给范德华半径（Å）。
   */
  function hirshfeldGrid(rhoFn, atoms, inside, vdw, gopts = {}, progress) {
    const inSet = new Set(inside);
    const ins = atoms.filter((_, i) => inSet.has(i)), outs = atoms.filter((_, i) => !inSet.has(i));
    if (!ins.length || !outs.length) throw new Error('hirshfeld:fragments');
    const g = gridFor(ins.map((a) => [a.x, a.y, a.z]), { margin: gopts.margin ?? 4.5, h: gopts.h ?? 0.25, maxPts: gopts.maxPts ?? 4e5 });
    const [nx, ny, nz] = g.n, N = nx * ny * nz;
    const w = new Float32Array(N), dn = new Float32Array(N);
    // 孤立的团簇（不是晶体）：分子背向邻居的一侧 w 一直是 1，w = 0.5 的面合不上。envelope（a.u.）> 0 时取
    // min(w, ρ_里 / 2·envelope)，面就是 {w > ½} ∩ {ρ_里 > envelope} 的边界：朝邻居的部分仍是 Hirshfeld 面，朝外的部分是分子自己的等密度面。
    const env = gopts.envelope > 0 ? gopts.envelope : 0, raw = env > 0 ? new Float32Array(N) : null;
    // 只有离片段不太远的外部原子才有贡献
    const lo = g.origin, hi = g.origin.map((v, d) => v + (g.n[d] - 1) * g.h), cut = 10;
    const near = outs.filter((a) => a.x > lo[0] - cut && a.x < hi[0] + cut && a.y > lo[1] - cut && a.y < hi[1] + cut && a.z > lo[2] - cut && a.z < hi[2] + cut);
    const nearest = (set, x, y, z) => { let best = Infinity, el = ''; for (const a of set) { const d = (x - a.x) ** 2 + (y - a.y) ** 2 + (z - a.z) ** 2; if (d < best) { best = d; el = a.el; } } return { d: Math.sqrt(best) * BOHR, el }; };
    const dens = (set, x, y, z) => { let s = 0; for (const a of set) { const r2 = (x - a.x) ** 2 + (y - a.y) ** 2 + (z - a.z) ** 2; if (r2 < cut * cut) s += rhoFn(a.Z, Math.sqrt(r2))[0]; } return s; };
    let k = 0;
    for (let i = 0; i < nx; i++) {
      for (let j = 0; j < ny; j++) for (let l = 0; l < nz; l++, k++) {
        const x = g.origin[0] + i * g.h, y = g.origin[1] + j * g.h, z = g.origin[2] + l * g.h;
        const ri = dens(ins, x, y, z), ro = dens(near, x, y, z);
        w[k] = ri + ro > 1e-14 ? ri / (ri + ro) : 0;
        if (env > 0) { raw[k] = w[k]; w[k] = Math.min(w[k], ri / (2 * env)); }
        const a = nearest(ins, x, y, z), b = nearest(near.length ? near : outs, x, y, z);
        dn[k] = (a.d - vdw(a.el)) / vdw(a.el) + (b.d - vdw(b.el)) / vdw(b.el);
      }
      if (progress && i % 4 === 0) progress(i, nx);
    }
    // 面上的点
    const surf = [];
    const idx = (i, j, l) => (i * ny + j) * nz + l;
    for (let i = 0; i < nx; i++) for (let j = 0; j < ny; j++) for (let l = 0; l < nz; l++) {
      const a = w[idx(i, j, l)] - 0.5;
      for (const [di, dj, dl] of [[1, 0, 0], [0, 1, 0], [0, 0, 1]]) {
        const I = i + di, J = j + dj, Lz = l + dl;
        if (I >= nx || J >= ny || Lz >= nz) continue;
        const b = w[idx(I, J, Lz)] - 0.5;
        if ((a < 0) === (b < 0)) continue;
        const t = a / (a - b);
        const x = g.origin[0] + (i + t * di) * g.h, y = g.origin[1] + (j + t * dj) * g.h, z = g.origin[2] + (l + t * dl) * g.h;
        const pi = nearest(ins, x, y, z), pe = nearest(near.length ? near : outs, x, y, z);
        // 朝外的部分（这里由等密度面决定，不是 w = ½）：没有邻居，不算接触
        const free = env > 0 && raw[idx(i, j, l)] + t * (raw[idx(I, J, Lz)] - raw[idx(i, j, l)]) > 0.5 + 1e-3;
        surf.push(free ? { di: pi.d, de: pe.d, ei: pi.el, ee: pe.el, free: true } : { di: pi.d, de: pe.d, ei: pi.el, ee: pe.el });
      }
    }
    return { grid: g, w, dnorm: dn, surface: surf };
  }
  /** 指纹图：(d_i, d_e) 的二维直方图，范围 lo…hi（Å），bin 宽 step。filter(pt) 可选（只看某一类接触）。 */
  function fingerprint(surface, { lo = 0.4, hi = 2.6, step = 0.01, filter = null } = {}) {
    const n = Math.round((hi - lo) / step);
    const H = new Uint32Array(n * n);
    let used = 0;
    for (const p of surface) {
      if (p.free || (filter && !filter(p))) continue;
      const i = Math.floor((p.di - lo) / step), j = Math.floor((p.de - lo) / step);
      if (i < 0 || j < 0 || i >= n || j >= n) continue;
      H[j * n + i]++; used++;
    }
    return { n, lo, hi, step, H, used, total: surface.length };
  }
  /** 按元素对统计接触的比例（用面上的采样点数近似面积比例；朝外、没有邻居的点 free 不算）。键名 “H···O” 表示里面是 H、外面是 O。 */
  function contactShares(surface) {
    const c = {};
    let tot = 0;
    for (const p of surface) { if (p.free) continue; const k = `${p.ei}···${p.ee}`; c[k] = (c[k] || 0) + 1; tot++; }
    tot = tot || 1;
    return Object.entries(c).map(([k, v]) => ({ pair: k, share: v / tot })).sort((a, b) => b.share - a.share);
  }

  /** 点电荷近似的静电势（a.u.）：V(r) = Σ q_A / |r − R_A|，离核太近时截到 0.3 bohr。 */
  function espPointCharges(atoms, charges, g) {
    return fillGrid(g, (x, y, z) => { let v = 0; for (let i = 0; i < atoms.length; i++) { const A = atoms[i]; v += charges[i] / Math.max(0.3, Math.hypot(x - A.x, y - A.y, z - A.z)); } return v; });
  }
  /** 读原子电荷：ORCA（MULLIKEN / LOEWDIN / HIRSHFELD / CHELPG 表）、Gaussian（Mulliken charges、ESP charges、Hirshfeld charges）。返回 { kind, q: [] } 列表。 */
  function chargesOf(text) {
    const t = String(text || '').replace(/\r/g, '');
    const out = [];
    const blocks = (re, row) => { const ms = [...t.matchAll(re)]; if (!ms.length) return null; const m = ms[ms.length - 1]; const q = []; for (const l of m[1].split('\n')) { const r = row.exec(l); if (r) q.push(Number(r[1])); else if (q.length) break; } return q.length ? q : null; };
    const orcaRow = /^\s*\d+\s+[A-Z][a-z]?\s*:\s*(-?\d+\.\d+)/;
    let q;
    if ((q = blocks(/MULLIKEN ATOMIC CHARGES\s*\n-+\s*\n([\s\S]*?)Sum of atomic charges/g, orcaRow))) out.push({ kind: 'Mulliken', q });
    if ((q = blocks(/LOEWDIN ATOMIC CHARGES\s*\n-+\s*\n([\s\S]*?)(?:\n\s*\n)/g, orcaRow))) out.push({ kind: 'Löwdin', q });
    if ((q = blocks(/CHELPG Charges\s*\n-+\s*\n([\s\S]*?)-{5,}/g, orcaRow))) out.push({ kind: 'CHELPG', q });
    const gRow = /^\s*\d+\s+[A-Z][a-z]?\s+(-?\d+\.\d+)/;
    if (!out.length) {
      if ((q = blocks(/Mulliken charges(?: and spin densities)?:\s*\n[^\n]*\n([\s\S]*?)Sum of Mulliken/g, gRow))) out.push({ kind: 'Mulliken', q });
      if ((q = blocks(/ESP charges:\s*\n[^\n]*\n([\s\S]*?)Sum of ESP/g, gRow))) out.push({ kind: 'ESP', q });
      if ((q = blocks(/Hirshfeld charges, spin densities[^\n]*\n[^\n]*\n([\s\S]*?)Tot/g, gRow))) out.push({ kind: 'Hirshfeld', q });
    }
    return out;
  }

  const pure = { BOHR, SYMBOLS, CART, SPH, parseMolden, basisAt, moAt, densityAt, frontierMos, gridFor, fillGrid, cubeText, parseCube, cubeIntegral,
    proxyZ, makePromol, eig3, promolAt, nciGrid, derivWork, rhoDerivsAt, igmhGrid, hirshfeldGrid, fingerprint, contactShares, espPointCharges, chargesOf };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaWBWfn = pure;
})(typeof self !== 'undefined' ? self : this);
