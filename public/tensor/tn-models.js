'use strict';
// 张量网络与强关联（/tensor/）演示背后的数学：纯函数，没有 DOM。tools/tensor-test.mjs 对照解析解、自由费米子精确解和精确对角化测这里的每一个函数。
// 页面里 tn-demos.js 经 window.MOLASTRIA_TENSOR_MODELS 拿到它们。
// 内容：对称矩阵本征值（Householder 三对角化 + 隐式 QL）· 奇异值分解（单边 Jacobi）· Lanczos 求基态 ·
// 自旋链精确对角化（横场 Ising、XXZ、任意图上的 Heisenberg）· 施密特分解和纠缠熵 · 逐次 SVD 把态压成矩阵乘积态（MPS）·
// 两格点 DMRG（MPO + 环境张量 + Lanczos + 截断）· 横场 Ising 的自由费米子精确能量 · 自由费米子的纠缠熵（一维、二维）和淬火后的纠缠增长 ·
// 半满 Hubbard 链的精确对角化、RHF 和 UHF · Hubbard 二聚体（H₂ 的最小模型）的解析解 · 活性空间的行列式和 CSF 个数 ·
// 交换耦合的自旋簇的多重态计数 · AKLT 态和随机 MPS 的转移矩阵与关联长度 · 两格点互信息和 Fiedler 排序。
// 全部自己写，没有复制任何程序（ITensor、TeNPy、block2、PySCF 等）的代码。
(() => {
  // ── 随机数（固定种子，同一个种子同一个结果）──────────────────────
  function rng(seed = 1) {
    let a = (seed >>> 0) || 1;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const dotv = (a, b) => { let s = 0; for (let i = 0; i < a.length; i++) s += a[i] * b[i]; return s; };
  const normv = (a) => Math.sqrt(dotv(a, a));
  const popcount = (x) => { let c = 0; while (x) { x &= x - 1; c++; } return c; };

  // ── 对称矩阵的本征值和本征向量：Householder 三对角化 + 隐式 QL ──────
  // A：n 行的数组（不改动它）。返回 { vals（从小到大）, vecs }，vecs[k][i] 是第 i 个本征向量的第 k 个分量。
  function eigh(A, wantVecs = true) {
    const n = A.length;
    if (!n) return { vals: new Float64Array(0), vecs: [] };
    const a = A.map((r) => Float64Array.from(r)), d = new Float64Array(n), e = new Float64Array(n);
    for (let i = n - 1; i > 0; i--) {
      const l = i - 1; let h = 0, scale = 0;
      if (l > 0) {
        for (let k = 0; k <= l; k++) scale += Math.abs(a[i][k]);
        if (scale === 0) e[i] = a[i][l];
        else {
          for (let k = 0; k <= l; k++) { a[i][k] /= scale; h += a[i][k] * a[i][k]; }
          let f = a[i][l];
          let g = f >= 0 ? -Math.sqrt(h) : Math.sqrt(h);
          e[i] = scale * g; h -= f * g; a[i][l] = f - g; f = 0;
          for (let j = 0; j <= l; j++) {
            if (wantVecs) a[j][i] = a[i][j] / h;
            g = 0;
            for (let k = 0; k <= j; k++) g += a[j][k] * a[i][k];
            for (let k = j + 1; k <= l; k++) g += a[k][j] * a[i][k];
            e[j] = g / h; f += e[j] * a[i][j];
          }
          const hh = f / (h + h);
          for (let j = 0; j <= l; j++) { f = a[i][j]; e[j] = g = e[j] - hh * f; for (let k = 0; k <= j; k++) a[j][k] -= f * e[k] + g * a[i][k]; }
        }
      } else e[i] = a[i][l];
      d[i] = h;
    }
    d[0] = 0; e[0] = 0;
    for (let i = 0; i < n; i++) {
      if (wantVecs) {
        if (d[i]) for (let j = 0; j < i; j++) { let g = 0; for (let k = 0; k < i; k++) g += a[i][k] * a[k][j]; for (let k = 0; k < i; k++) a[k][j] -= g * a[k][i]; }
        d[i] = a[i][i]; a[i][i] = 1; for (let j = 0; j < i; j++) a[j][i] = a[i][j] = 0;
      } else d[i] = a[i][i];
    }
    // 隐式 QL
    for (let i = 1; i < n; i++) e[i - 1] = e[i];
    e[n - 1] = 0;
    for (let l = 0; l < n; l++) {
      let iter = 0, m;
      do {
        for (m = l; m < n - 1; m++) { const dd = Math.abs(d[m]) + Math.abs(d[m + 1]); if (Math.abs(e[m]) <= 1e-16 * dd) break; }
        if (m !== l) {
          if (iter++ > 80) break;
          let g = (d[l + 1] - d[l]) / (2 * e[l]), r = Math.hypot(g, 1);
          g = d[m] - d[l] + e[l] / (g + (g >= 0 ? r : -r));
          let s = 1, c = 1, p = 0, i;
          for (i = m - 1; i >= l; i--) {
            let f = s * e[i]; const b = c * e[i];
            e[i + 1] = r = Math.hypot(f, g);
            if (r === 0) { d[i + 1] -= p; e[m] = 0; break; }
            s = f / r; c = g / r; g = d[i + 1] - p; r = (d[i] - g) * s + 2 * c * b; p = s * r; d[i + 1] = g + p; g = c * r - b;
            if (wantVecs) for (let k = 0; k < n; k++) { f = a[k][i + 1]; a[k][i + 1] = s * a[k][i] + c * f; a[k][i] = c * a[k][i] - s * f; }
          }
          if (r === 0 && i >= l) continue;
          d[l] -= p; e[l] = g; e[m] = 0;
        }
      } while (m !== l);
    }
    const idx = Array.from({ length: n }, (_, i) => i).sort((x, y) => d[x] - d[y]);
    const vals = Float64Array.from(idx, (i) => d[i]);
    if (!wantVecs) return { vals, vecs: [] };
    const vecs = Array.from({ length: n }, (_, k) => Float64Array.from(idx, (i) => a[k][i]));
    return { vals, vecs };
  }

  // ── 奇异值分解：单边 Jacobi（Hestenes），小的奇异值也算得准 ─────────
  // A：m × n，按行展平。返回 { U（m × k）, s（k，从大到小）, V（n × k）, k = min(m, n) }，A = U diag(s) Vᵀ。
  function svd(A, m, n) {
    if (m < n) {
      const T = new Float64Array(m * n);
      for (let i = 0; i < m; i++) for (let j = 0; j < n; j++) T[j * m + i] = A[i * n + j];
      const r = svd(T, n, m);
      return { U: r.V, s: r.s, V: r.U, k: r.k };
    }
    const cols = Array.from({ length: n }, (_, j) => { const c = new Float64Array(m); for (let i = 0; i < m; i++) c[i] = A[i * n + j]; return c; });
    const V = Array.from({ length: n }, (_, j) => { const c = new Float64Array(n); c[j] = 1; return c; });
    for (let sweep = 0; sweep < 60; sweep++) {
      let rotated = 0;
      for (let p = 0; p < n - 1; p++) {
        const cp = cols[p];
        for (let q = p + 1; q < n; q++) {
          const cq = cols[q];
          let al = 0, be = 0, ga = 0;
          for (let i = 0; i < m; i++) { const x = cp[i], y = cq[i]; al += x * x; be += y * y; ga += x * y; }
          if (ga === 0 || Math.abs(ga) <= 1e-15 * Math.sqrt(al * be)) continue;
          rotated++;
          const zeta = (be - al) / (2 * ga), t = (zeta >= 0 ? 1 : -1) / (Math.abs(zeta) + Math.sqrt(1 + zeta * zeta)), c = 1 / Math.sqrt(1 + t * t), s = c * t;
          for (let i = 0; i < m; i++) { const x = cp[i], y = cq[i]; cp[i] = c * x - s * y; cq[i] = s * x + c * y; }
          const vp = V[p], vq = V[q];
          for (let i = 0; i < n; i++) { const x = vp[i], y = vq[i]; vp[i] = c * x - s * y; vq[i] = s * x + c * y; }
        }
      }
      if (!rotated) break;
    }
    const sv = cols.map((c) => normv(c)), order = sv.map((_, j) => j).sort((x, y) => sv[y] - sv[x]), k = n;
    const U = new Float64Array(m * k), Vo = new Float64Array(n * k), s = new Float64Array(k);
    order.forEach((j, r) => {
      s[r] = sv[j];
      const inv = sv[j] > 1e-300 ? 1 / sv[j] : 0;
      for (let i = 0; i < m; i++) U[i * k + r] = cols[j][i] * inv;
      for (let i = 0; i < n; i++) Vo[i * k + r] = V[j][i];
    });
    return { U, s, V: Vo, k };
  }

  // ── Lanczos：最低本征值和本征向量（完全重正交，必要时从 Ritz 向量重启）──
  function lanczos(apply, v0, { maxIter = 60, tol = 1e-10, restarts = 8 } = {}) {
    let v = Float64Array.from(v0), nv = normv(v);
    if (!(nv > 0)) { v = new Float64Array(v0.length); v[0] = 1; nv = 1; }
    for (let i = 0; i < v.length; i++) v[i] /= nv;
    let E = NaN, iters = 0, res = Infinity;
    for (let rs = 0; rs <= restarts; rs++) {
      const Q = [v], al = [], be = [];
      let y = null;
      for (let j = 0; j < Math.min(maxIter, v.length); j++) {
        const w = apply(Q[j]); iters++;
        const a = dotv(Q[j], w); al.push(a);
        for (let pass = 0; pass < 2; pass++) for (const q of Q) { const c = dotv(q, w); for (let i = 0; i < w.length; i++) w[i] -= c * q[i]; }
        const b = normv(w);
        if (b >= 1e-13 && al.length % 4 && j < Math.min(maxIter, v.length) - 1) { be.push(b); for (let i = 0; i < w.length; i++) w[i] /= b; Q.push(w); continue; }
        const k = al.length, T = Array.from({ length: k }, (_, r) => Array.from({ length: k }, (_, c) => (r === c ? al[r] : Math.abs(r - c) === 1 ? be[Math.min(r, c)] : 0)));
        const ev = eigh(T);
        E = ev.vals[0]; y = Array.from({ length: k }, (_, r) => ev.vecs[r][0]);
        res = Math.abs(b * y[k - 1]);
        if (b < 1e-13 || res < tol) break;
        be.push(b);
        for (let i = 0; i < w.length; i++) w[i] /= b;
        Q.push(w);
      }
      const nv2 = new Float64Array(v.length);
      y.forEach((c, r) => { const q = Q[r]; for (let i = 0; i < nv2.length; i++) nv2[i] += c * q[i]; });
      const nn = normv(nv2); for (let i = 0; i < nv2.length; i++) nv2[i] /= nn;
      v = nv2;
      if (res < tol) break;
    }
    return { E, v, iters, res };
  }

  // ── 自旋 ½ 链的精确对角化 ─────────────────────────────────────────
  // 第 i 个格点对应下标的第 N − 1 − i 位（第一个格点在最高位），这样态向量按行展平就是左右两半的矩阵，和 MPS 的顺序一致。
  // kind：'tfim'（H = −J Σ ZᵢZᵢ₊₁ − g Σ Xᵢ，Pauli 矩阵）、'xxz'（H = J Σ [SˣSˣ + SʸSʸ + Δ SᶻSᶻ]）、'graph'（bonds：[[i, j, Jᵢⱼ]]，各向同性 Heisenberg）
  function spinModel(o) {
    const N = o.N, dim = 2 ** N, kind = o.kind || 'tfim', J = o.J ?? 1, g = o.g ?? 1, D = o.Delta ?? 1;
    const bit = (i) => 1 << (N - 1 - i);
    let bonds = o.bonds;
    if (!bonds) { bonds = []; for (let i = 0; i < N - 1; i++) bonds.push([i, i + 1, J]); if (o.pbc && N > 2) bonds.push([N - 1, 0, J]); }
    const diag = new Float64Array(dim);
    for (let x = 0; x < dim; x++) {
      let e = 0;
      for (const [i, j, Jb] of bonds) { const zi = x & bit(i) ? -1 : 1, zj = x & bit(j) ? -1 : 1; e += kind === 'tfim' ? -Jb * zi * zj : (kind === 'xxz' ? D : 1) * Jb * 0.25 * zi * zj; }
      diag[x] = e;
    }
    const masks = bonds.map(([i, j, Jb]) => [bit(i) | bit(j), Jb]);
    function apply(v) {
      const out = new Float64Array(dim);
      for (let x = 0; x < dim; x++) out[x] = diag[x] * v[x];
      if (kind === 'tfim') { for (let i = 0; i < N; i++) { const m = bit(i); for (let x = 0; x < dim; x++) out[x ^ m] -= g * v[x]; } }
      else for (const [m, Jb] of masks) { const h = 0.5 * Jb; for (let x = 0; x < dim; x++) { const b = x & m; if (b && b !== m) out[x ^ m] += h * v[x]; } }
      return out;
    }
    return { N, dim, kind, bonds, apply, diag };
  }
  function groundState(model, seed = 7, opt = {}) {
    const r = rng(seed), v0 = new Float64Array(model.dim);
    for (let i = 0; i < v0.length; i++) v0[i] = r() - 0.5;
    if (model.kind !== 'tfim') { // Heisenberg 型：只取 Sᶻ 总和为 0 的分量（偶数个格点时基态在这里），避开简并
      for (let x = 0; x < v0.length; x++) if (2 * popcount(x) !== model.N) v0[x] = 0;
    }
    return lanczos(model.apply, v0, { maxIter: 80, tol: 1e-11, restarts: 10, ...opt });
  }
  const energy = (model, v) => dotv(v, model.apply(v)) / dotv(v, v);

  // ── 纠缠：施密特分解、熵 ────────────────────────────────────────────
  // 熵用自然对数（单位 nat）；χ 个施密特值最多能装 ln χ。
  function entropyOf(s) {
    let tot = 0; for (const x of s) tot += x * x;
    let S = 0; for (const x of s) { const p = (x * x) / tot; if (p > 1e-300) S -= p * Math.log(p); }
    return S;
  }
  function schmidt(psi, N, l, d = 2) { const m = d ** l, n = psi.length / m; return Array.from(svd(psi, m, n).s); }
  function entropyProfile(psi, N, d = 2) { const out = []; for (let l = 1; l < N; l++) out.push(entropyOf(schmidt(psi, N, l, d))); return out; }
  // 两个自旋 ½：|ψ⟩ = cos θ |↑↓⟩ + e^{iφ}… 这里只用实数：|ψ⟩ = a|00⟩ + b|01⟩ + c|10⟩ + e|11⟩，施密特值是 2 × 2 矩阵的奇异值
  function twoQubit(a, b, c, e) { const n = Math.hypot(a, b, c, e) || 1; const r = svd(Float64Array.of(a / n, b / n, c / n, e / n), 2, 2); return { s: Array.from(r.s), S: entropyOf(r.s), concurrence: 2 * Math.abs((a * e - b * c) / (n * n)) }; }

  // ── 逐次 SVD：把一个态压成矩阵乘积态 ─────────────────────────────────
  // 返回 { A（每个格点一个张量，形状 [左, d, 右]，按行展平）, bonds（每条键：全部施密特值、保留个数、扔掉的权重）, params }
  function mpsCompress(psi, N, chi, d = 2, cutoff = 1e-14) {
    let rest = Float64Array.from(psi), cl = 1;
    const A = [], bonds = [];
    for (let i = 0; i < N - 1; i++) {
      const m = cl * d, n = rest.length / m, r = svd(rest, m, n);
      let tot = 0; for (const x of r.s) tot += x * x;
      let keep = Math.min(chi, r.k);
      while (keep > 1 && r.s[keep - 1] <= cutoff * r.s[0]) keep--;
      let kept = 0; for (let j = 0; j < keep; j++) kept += r.s[j] * r.s[j];
      const T = new Float64Array(m * keep);
      for (let row = 0; row < m; row++) for (let j = 0; j < keep; j++) T[row * keep + j] = r.U[row * r.k + j];
      A.push({ l: cl, d, r: keep, T });
      const next = new Float64Array(keep * n);
      for (let j = 0; j < keep; j++) for (let c = 0; c < n; c++) next[j * n + c] = r.s[j] * r.V[c * r.k + j];
      bonds.push({ s: Array.from(r.s).map((x) => x / Math.sqrt(tot)), keep, discarded: Math.max(0, 1 - kept / tot) });
      rest = next; cl = keep;
    }
    A.push({ l: cl, d, r: 1, T: rest });
    const params = A.reduce((s, t) => s + t.l * t.d * t.r, 0);
    return { A, bonds, params };
  }
  function mpsToVector(A) {
    let v = Float64Array.from(A[0].T), rows = A[0].d, c = A[0].r; // v：rows × c
    for (let i = 1; i < A.length; i++) {
      const t = A[i], out = new Float64Array(rows * t.d * t.r);
      for (let x = 0; x < rows; x++) for (let a = 0; a < c; a++) { const va = v[x * c + a]; if (!va) continue; for (let s = 0; s < t.d; s++) for (let b = 0; b < t.r; b++) out[(x * t.d + s) * t.r + b] += va * t.T[(a * t.d + s) * t.r + b]; }
      v = out; rows *= t.d; c = t.r;
    }
    return v;
  }
  // 精确态压到 χ 之后：保真度、能量误差、参数个数
  function truncate(model, psi, chi) {
    const N = model.N, c = mpsCompress(psi, N, chi), v = mpsToVector(c.A), nv = normv(v);
    const ov = dotv(psi, v) / (normv(psi) * nv);
    const E = energy(model, v), E0 = energy(model, psi);
    return { ...c, fidelity: ov * ov, E, E0, dE: E - E0, discarded: c.bonds.reduce((s, b) => s + b.discarded, 0), full: 2 ** N, prof: c.bonds.map((b) => entropyOf(b.s.slice(0, b.keep))) };
  }

  // ── 横场 Ising 开链的精确基态能量（Jordan–Wigner 变成自由费米子）───
  // E₀ = −Σₖ sₖ，sₖ 是对角线为 g、上对角线为 J 的 N × N 双对角矩阵的奇异值
  function tfimExact(N, J = 1, g = 1) {
    const M = new Float64Array(N * N);
    for (let i = 0; i < N; i++) { M[i * N + i] = g; if (i < N - 1) M[i * N + i + 1] = J; }
    const s = svd(M, N, N).s;
    let E = 0; for (const x of s) E -= x;
    return { E, eps: Array.from(s).map((x) => 2 * x).sort((a, b) => a - b) };
  }

  // ── 两格点 DMRG ─────────────────────────────────────────────────────
  // MPO 用“下三角”约定：左边界取最后一行，右边界取第一列。张量下标：L[a, w, a′]（a 是 bra），W[w, w′, s, s′]（s 是 bra），A[a, s, b]，θ[a, s, t, b]。
  function mpo(kind, J = 1, g = 1, Delta = 1) {
    const I = [[1, 0], [0, 1]], X = [[0, 1], [1, 0]], Z = [[1, 0], [0, -1]], Sp = [[0, 1], [0, 0]], Sm = [[0, 0], [1, 0]], Sz = [[0.5, 0], [0, -0.5]];
    const ent = []; // [w, w′, 算符, 系数]
    let D;
    if (kind === 'tfim') { D = 3; ent.push([0, 0, I, 1], [1, 0, Z, 1], [2, 0, X, -g], [2, 1, Z, -J], [2, 2, I, 1]); }
    else { D = 5; ent.push([0, 0, I, 1], [1, 0, Sp, 1], [2, 0, Sm, 1], [3, 0, Sz, 1], [4, 1, Sm, J / 2], [4, 2, Sp, J / 2], [4, 3, Sz, J * Delta], [4, 4, I, 1]); }
    const nz = [];
    for (const [w, w2, O, c] of ent) for (let s = 0; s < 2; s++) for (let t = 0; t < 2; t++) if (O[s][t]) nz.push([w, w2, s, t, c * O[s][t]]);
    return { D, nz };
  }
  function updateL(L, A, W, D) {
    const cl = A.l, d = A.d, cr = A.r;
    const T1 = new Float64Array(cl * D * d * cr); // [a, w, s′, b′]
    for (let a = 0; a < cl; a++) for (let w = 0; w < D; w++) for (let a2 = 0; a2 < cl; a2++) { const v = L[(a * D + w) * cl + a2]; if (!v) continue; const o = (a * D + w) * d * cr, src = a2 * d * cr; for (let k = 0; k < d * cr; k++) T1[o + k] += v * A.T[src + k]; }
    const T2 = new Float64Array(cl * D * d * cr); // [a, w′, s, b′]
    for (const [w, w2, s, s2, val] of W.nz) for (let a = 0; a < cl; a++) { const o = ((a * D + w2) * d + s) * cr, src = ((a * D + w) * d + s2) * cr; for (let b = 0; b < cr; b++) T2[o + b] += val * T1[src + b]; }
    const out = new Float64Array(cr * D * cr);
    for (let a = 0; a < cl; a++) for (let s = 0; s < d; s++) for (let b = 0; b < cr; b++) { const x = A.T[(a * d + s) * cr + b]; if (!x) continue; for (let w2 = 0; w2 < D; w2++) { const o = (b * D + w2) * cr, src = ((a * D + w2) * d + s) * cr; for (let b2 = 0; b2 < cr; b2++) out[o + b2] += x * T2[src + b2]; } }
    return out;
  }
  function updateR(R, A, W, D) {
    const cl = A.l, d = A.d, cr = A.r;
    const T1 = new Float64Array(cl * d * cr * D); // [a′, s′, b, w′]
    for (let a2 = 0; a2 < cl; a2++) for (let s2 = 0; s2 < d; s2++) for (let b2 = 0; b2 < cr; b2++) { const x = A.T[(a2 * d + s2) * cr + b2]; if (!x) continue; const o = (a2 * d + s2) * cr * D; for (let b = 0; b < cr; b++) for (let w2 = 0; w2 < D; w2++) T1[o + b * D + w2] += x * R[(b * D + w2) * cr + b2]; }
    const T2 = new Float64Array(cl * d * cr * D); // [a′, s, b, w]
    for (const [w, w2, s, s2, val] of W.nz) for (let a2 = 0; a2 < cl; a2++) for (let b = 0; b < cr; b++) T2[((a2 * d + s) * cr + b) * D + w] += val * T1[((a2 * d + s2) * cr + b) * D + w2];
    const out = new Float64Array(cl * D * cl);
    for (let a = 0; a < cl; a++) for (let s = 0; s < d; s++) for (let b = 0; b < cr; b++) { const x = A.T[(a * d + s) * cr + b]; if (!x) continue; for (let a2 = 0; a2 < cl; a2++) { const src = ((a2 * d + s) * cr + b) * D; for (let w = 0; w < D; w++) out[(a * D + w) * cl + a2] += x * T2[src + w]; } }
    return out;
  }
  function heff(L, W1, W2, R, D, cl, cr, d = 2) {
    const blk = d * d * cr;
    return (th) => {
      const X1 = new Float64Array(cl * D * blk); // [a, w, s′, t′, b′]
      for (let a = 0; a < cl; a++) for (let w = 0; w < D; w++) for (let a2 = 0; a2 < cl; a2++) { const v = L[(a * D + w) * cl + a2]; if (!v) continue; const o = (a * D + w) * blk, src = a2 * blk; for (let k = 0; k < blk; k++) X1[o + k] += v * th[src + k]; }
      const X2 = new Float64Array(cl * D * blk); // [a, w₂, s, t′, b′]
      for (const [w, w2, s, s2, val] of W1.nz) for (let a = 0; a < cl; a++) { const o = ((a * D + w2) * d + s) * d * cr, src = ((a * D + w) * d + s2) * d * cr; for (let k = 0; k < d * cr; k++) X2[o + k] += val * X1[src + k]; }
      const X3 = new Float64Array(cl * d * D * d * cr); // [a, s, w₃, t, b′]
      for (const [w2, w3, t, t2, val] of W2.nz) for (let a = 0; a < cl; a++) for (let s = 0; s < d; s++) { const o = (((a * d + s) * D + w3) * d + t) * cr, src = (((a * D + w2) * d + s) * d + t2) * cr; for (let b = 0; b < cr; b++) X3[o + b] += val * X2[src + b]; }
      const out = new Float64Array(cl * blk);
      for (let a = 0; a < cl; a++) for (let s = 0; s < d; s++) for (let t = 0; t < d; t++) for (let w3 = 0; w3 < D; w3++) {
        const src = (((a * d + s) * D + w3) * d + t) * cr, o = ((a * d + s) * d + t) * cr;
        for (let b = 0; b < cr; b++) { let acc = 0; const rr = (b * D + w3) * cr; for (let b2 = 0; b2 < cr; b2++) acc += X3[src + b2] * R[rr + b2]; out[o + b] += acc; }
      }
      return out;
    };
  }
  function dmrgInit({ kind = 'tfim', N = 20, J = 1, g = 1, Delta = 1, chi = 16, seed = 3 } = {}) {
    const d = 2, W = mpo(kind, J, g, Delta), D = W.D, r = rng(seed);
    const dims = Array.from({ length: N + 1 }, (_, l) => Math.min(2 ** Math.min(l, 30), 2 ** Math.min(N - l, 30), 2)); // 先从 χ = 2 的随机态开始，扫的时候长大
    const A = [];
    for (let i = 0; i < N; i++) { const l = dims[i], rr = dims[i + 1], T = new Float64Array(l * d * rr); for (let k = 0; k < T.length; k++) T[k] = r() - 0.5; A.push({ l, d, r: rr, T }); }
    // 从右往左用 SVD 做成右正交
    for (let i = N - 1; i > 0; i--) {
      const t = A[i], sv = svd(t.T, t.l, t.d * t.r), k = Math.min(sv.k, t.l);
      const Vt = new Float64Array(k * t.d * t.r);
      for (let j = 0; j < k; j++) for (let c = 0; c < t.d * t.r; c++) Vt[j * t.d * t.r + c] = sv.V[c * sv.k + j];
      const US = new Float64Array(t.l * k);
      for (let a = 0; a < t.l; a++) for (let j = 0; j < k; j++) US[a * k + j] = sv.U[a * sv.k + j] * sv.s[j];
      const p = A[i - 1], np = new Float64Array(p.l * p.d * k);
      for (let x = 0; x < p.l * p.d; x++) for (let j = 0; j < k; j++) { let acc = 0; for (let a = 0; a < t.l; a++) acc += p.T[x * p.r + a] * US[a * k + j]; np[x * k + j] = acc; }
      A[i] = { l: k, d, r: t.r, T: Vt }; A[i - 1] = { l: p.l, d, r: k, T: np };
    }
    const n0 = normv(A[0].T); for (let k = 0; k < A[0].T.length; k++) A[0].T[k] /= n0;
    const Lenv = new Array(N + 1), Renv = new Array(N + 1);
    Lenv[0] = new Float64Array(D); Lenv[0][D - 1] = 1;
    Renv[N] = new Float64Array(D); Renv[N][0] = 1;
    for (let i = N - 1; i >= 1; i--) Renv[i] = updateR(Renv[i + 1], A[i], W, D);
    return { kind, N, J, g, Delta, chi, d, W, D, A, Lenv, Renv, pos: 0, dir: 1, sweep: 0, steps: 0, hist: [], S: new Array(N - 1).fill(0), trunc: new Array(N - 1).fill(0), chiB: dims.slice(1, N), E: NaN, sweepE: [] };
  }
  function dmrgStep(st, lanczosIter = 12) {
    const { N, d, D, W, A, Lenv, Renv } = st, i = st.pos, a1 = A[i], a2 = A[i + 1], cl = a1.l, c = a1.r, cr = a2.r;
    const th = new Float64Array(cl * d * d * cr);
    for (let a = 0; a < cl; a++) for (let s = 0; s < d; s++) for (let m = 0; m < c; m++) { const x = a1.T[(a * d + s) * c + m]; if (!x) continue; for (let t = 0; t < d; t++) for (let b = 0; b < cr; b++) th[((a * d + s) * d + t) * cr + b] += x * a2.T[(m * d + t) * cr + b]; }
    const H = heff(Lenv[i], W, W, Renv[i + 2], D, cl, cr, d);
    const lz = lanczos(H, th, { maxIter: lanczosIter, tol: 1e-12, restarts: 1 });
    const sv = svd(lz.v, cl * d, d * cr);
    let tot = 0; for (const x of sv.s) tot += x * x;
    let keep = Math.min(st.chi, sv.k); while (keep > 1 && sv.s[keep - 1] <= 1e-13 * sv.s[0]) keep--;
    let kept = 0; for (let j = 0; j < keep; j++) kept += sv.s[j] ** 2;
    const nrm = Math.sqrt(kept);
    const U = new Float64Array(cl * d * keep), Vt = new Float64Array(keep * d * cr);
    for (let x = 0; x < cl * d; x++) for (let j = 0; j < keep; j++) U[x * keep + j] = sv.U[x * sv.k + j];
    for (let j = 0; j < keep; j++) for (let y = 0; y < d * cr; y++) Vt[j * d * cr + y] = sv.V[y * sv.k + j];
    if (st.dir > 0) { for (let j = 0; j < keep; j++) for (let y = 0; y < d * cr; y++) Vt[j * d * cr + y] *= sv.s[j] / nrm; }
    else { for (let x = 0; x < cl * d; x++) for (let j = 0; j < keep; j++) U[x * keep + j] *= sv.s[j] / nrm; }
    A[i] = { l: cl, d, r: keep, T: U }; A[i + 1] = { l: keep, d, r: cr, T: Vt };
    st.S[i] = entropyOf(Array.from(sv.s.slice(0, keep))); st.trunc[i] = Math.max(0, 1 - kept / tot); st.chiB[i] = keep;
    st.E = lz.E; st.steps++; st.hist.push(lz.E);
    if (st.dir > 0) {
      Lenv[i + 1] = updateL(Lenv[i], A[i], W, D);
      if (i === N - 2) st.dir = -1; else st.pos++;
    } else {
      Renv[i + 1] = updateR(Renv[i + 2], A[i + 1], W, D);
      if (i === 0) { st.dir = 1; st.sweep++; st.sweepE.push(lz.E); } else st.pos--;
    }
    return { bond: i, E: lz.E, trunc: st.trunc[i], S: st.S[i], keep };
  }
  function dmrgRun(opt, sweeps = 4) { const st = dmrgInit(opt); while (st.sweep < sweeps) dmrgStep(st); return st; }

  // ── 自由费米子：纠缠熵从关联矩阵来 ────────────────────────────────
  const hnu = (v) => (v <= 1e-15 || v >= 1 - 1e-15 ? 0 : -v * Math.log(v) - (1 - v) * Math.log(1 - v));
  function ffCorr(h, nOcc) { // h：单粒子哈密顿量（对称矩阵）；占据最低的 nOcc 个轨道
    const n = h.length, { vals, vecs } = eigh(h), C = Array.from({ length: n }, () => new Float64Array(n));
    for (let i = 0; i < n; i++) for (let j = i; j < n; j++) { let s = 0; for (let k = 0; k < nOcc; k++) s += vecs[i][k] * vecs[j][k]; C[i][j] = C[j][i] = s; }
    return { C, vals, gap: nOcc < n ? vals[nOcc] - vals[nOcc - 1] : NaN };
  }
  function ffEntropy(C, sites) { const sub = sites.map((i) => sites.map((j) => C[i][j])), v = eigh(sub, false).vals; let S = 0; for (const x of v) S += hnu(x); return S; }
  // 一维跳跃链（XX 链），键交替 1 + δ、1 − δ（δ ≠ 0 时有能隙，是 SSH 型的二聚化链）；半满，开边界
  function hopChain(N, delta = 0) { const h = Array.from({ length: N }, () => new Float64Array(N)); for (let i = 0; i < N - 1; i++) h[i][i + 1] = h[i + 1][i] = -(1 + (i % 2 ? -delta : delta)); return h; }
  function chainEntropy(N, delta = 0) {
    const { C, gap } = ffCorr(hopChain(N, delta), N / 2), S = [];
    for (let l = 1; l < N; l++) S.push(ffEntropy(C, Array.from({ length: l }, (_, i) => i)));
    return { S, gap };
  }
  // Calabrese–Cardy：开边界的临界链 S(l) = (c/6) ln[(2N/π) sin(πl/N)] + 常数
  const ccChord = (N, l) => Math.log(((2 * N) / Math.PI) * Math.sin((Math.PI * l) / N));
  function fitCentral(N, S, every = 2) { // 只用偶数 l（开边界的 XX 链有奇偶振荡），最小二乘拟合斜率 c/6
    const xs = [], ys = [];
    for (let l = 2; l <= N - 2; l += every) { xs.push(ccChord(N, l)); ys.push(S[l - 1]); }
    const mx = xs.reduce((a, b) => a + b, 0) / xs.length, my = ys.reduce((a, b) => a + b, 0) / ys.length;
    let sxy = 0, sxx = 0; xs.forEach((x, i) => { sxy += (x - mx) * (ys[i] - my); sxx += (x - mx) ** 2; });
    const slope = sxy / sxx; return { c: 6 * slope, b: my - slope * mx };
  }
  // 二维：Lx × Ly 的方格子（开边界），最近邻跳跃 1，交错势 ±m；半满；左半边（x < Lx/2）的纠缠熵
  function lattice2d(Lx, Ly, m = 0) {
    const n = Lx * Ly, id = (x, y) => x * Ly + y, h = Array.from({ length: n }, () => new Float64Array(n));
    for (let x = 0; x < Lx; x++) for (let y = 0; y < Ly; y++) {
      h[id(x, y)][id(x, y)] = (x + y) % 2 ? -m : m;
      if (x + 1 < Lx) h[id(x, y)][id(x + 1, y)] = h[id(x + 1, y)][id(x, y)] = -1;
      if (y + 1 < Ly) h[id(x, y)][id(x, y + 1)] = h[id(x, y + 1)][id(x, y)] = -1;
    }
    return h;
  }
  function halfEntropy2d(Lx, Ly, m = 0) {
    const { C, gap } = ffCorr(lattice2d(Lx, Ly, m), (Lx * Ly) / 2), half = Array.from({ length: (Lx / 2) * Ly }, (_, i) => i);
    return { S: ffEntropy(C, half), gap };
  }
  // 淬火：从 Néel 态（偶数格点上有粒子）出发，在 XX 链上演化；返回每个时刻的半链纠缠熵和各格点的粒子数
  function quench(N, times, delta = 0) {
    const h = hopChain(N, delta), { vals: E, vecs: V } = eigh(h), occ = Array.from({ length: N / 2 }, (_, k) => 2 * k), half = N / 2;
    return times.map((t) => {
      // U = V e^{−iEt} Vᵀ，只要占据的列
      const Ur = Array.from({ length: N }, () => new Float64Array(occ.length)), Ui = Array.from({ length: N }, () => new Float64Array(occ.length));
      const c = Float64Array.from(E, (e) => Math.cos(e * t)), s = Float64Array.from(E, (e) => Math.sin(e * t));
      for (let i = 0; i < N; i++) occ.forEach((m, k) => { let re = 0, im = 0; for (let q = 0; q < N; q++) { const w = V[i][q] * V[m][q]; re += w * c[q]; im -= w * s[q]; } Ur[i][k] = re; Ui[i][k] = im; });
      const dens = Float64Array.from({ length: N }, (_, i) => { let x = 0; for (let k = 0; k < occ.length; k++) x += Ur[i][k] ** 2 + Ui[i][k] ** 2; return x; });
      // C_ij = Σ_k U_ik conj(U_jk)，Hermite 的 half × half 块，换成 2half × 2half 的实对称矩阵求本征值（每个出现两次）
      const B = Array.from({ length: 2 * half }, () => new Float64Array(2 * half));
      for (let i = 0; i < half; i++) for (let j = 0; j < half; j++) {
        let re = 0, im = 0;
        for (let k = 0; k < occ.length; k++) { re += Ur[i][k] * Ur[j][k] + Ui[i][k] * Ui[j][k]; im += Ui[i][k] * Ur[j][k] - Ur[i][k] * Ui[j][k]; }
        B[i][j] = re; B[i + half][j + half] = re; B[i][j + half] = -im; B[i + half][j] = im;
      }
      const v = eigh(B, false).vals; let S = 0; for (const x of v) S += hnu(x);
      return { t, S: S / 2, dens };
    });
  }

  // ── 半满 Hubbard 开链：精确对角化（Sᶻ = 0）、RHF、UHF ─────────────────
  function combos(N, k) { const out = []; for (let x = 0; x < 1 << N; x++) if (popcount(x) === k) out.push(x); return out; }
  function hubbardED(N, U, t = 1) {
    const C = combos(N, N / 2), nc = C.length, idx = new Map(C.map((x, i) => [x, i])), dim = nc * nc;
    const hops = C.map((x) => { const out = []; for (let i = 0; i < N - 1; i++) { const m = (1 << i) | (1 << (i + 1)), b = x & m; if (b && b !== m) out.push(idx.get(x ^ m)); } return out; });
    const dbl = new Float64Array(dim); for (let u = 0; u < nc; u++) for (let dn = 0; dn < nc; dn++) dbl[u * nc + dn] = popcount(C[u] & C[dn]);
    const apply = (v) => {
      const out = new Float64Array(dim);
      for (let k = 0; k < dim; k++) out[k] = U * dbl[k] * v[k];
      for (let u = 0; u < nc; u++) for (const u2 of hops[u]) for (let dn = 0; dn < nc; dn++) out[u2 * nc + dn] -= t * v[u * nc + dn];
      for (let dn = 0; dn < nc; dn++) for (const d2 of hops[dn]) for (let u = 0; u < nc; u++) out[u * nc + d2] -= t * v[u * nc + dn];
      return out;
    };
    const r = rng(11), v0 = Float64Array.from({ length: dim }, () => r() - 0.5);
    const { E, v } = lanczos(apply, v0, { maxIter: 70, tol: 1e-10, restarts: 6 });
    let D = 0; for (let k = 0; k < dim; k++) D += dbl[k] * v[k] * v[k];
    return { E, D: D / N, dim };
  }
  function hubbardMF(N, U, t = 1) {
    const h0 = hopChain(N, 0).map((r) => r.map((x) => x * t));
    const occFree = eigh(h0).vals.slice(0, N / 2).reduce((a, b) => a + b, 0);
    const rhf = { E: 2 * occFree + (U * N) / 4, D: 0.25 };
    // UHF：从交错磁化出发自洽，阻尼混合
    let nu = Float64Array.from({ length: N }, (_, i) => 0.5 + (i % 2 ? -0.4 : 0.4)), nd = Float64Array.from(nu, (x) => 1 - x), E = 0;
    for (let it = 0; it < 400; it++) {
      const solve = (nOther) => { const h = h0.map((r, i) => { const q = Float64Array.from(r); q[i] += U * nOther[i]; return q; }); const { vals, vecs } = eigh(h); const n = new Float64Array(N); let e = 0; for (let k = 0; k < N / 2; k++) { e += vals[k]; for (let i = 0; i < N; i++) n[i] += vecs[i][k] ** 2; } return { n, e }; };
      const a = solve(nd), b = solve(nu);
      let dc = 0; for (let i = 0; i < N; i++) dc += nu[i] * nd[i];
      E = a.e + b.e - U * dc;
      let diff = 0; for (let i = 0; i < N; i++) { diff = Math.max(diff, Math.abs(a.n[i] - nu[i]), Math.abs(b.n[i] - nd[i])); nu[i] = 0.5 * nu[i] + 0.5 * a.n[i]; nd[i] = 0.5 * nd[i] + 0.5 * b.n[i]; }
      if (diff < 1e-11) break;
    }
    let dc = 0, mag = 0; for (let i = 0; i < N; i++) { dc += nu[i] * nd[i]; mag += Math.abs(nu[i] - nd[i]) / 2; }
    const uhf = { E, D: dc / N, m: mag / N };
    return { rhf, uhf: uhf.E < rhf.E - 1e-10 ? uhf : { ...rhf, m: 0 } };
  }

  // ── Hubbard 二聚体：两个电子、两个格点（H₂ 最小基的模型）────────────
  // 精确（= CAS(2,2) = 全 CI）、RHF、UHF。x = sin 2θ 是 UHF 两个自旋轨道的重叠。
  function dimer(t, U) {
    const exact = U / 2 - Math.sqrt(4 * t * t + (U * U) / 4), rhf = -2 * t + U / 2;
    const x = U > 2 * t ? (2 * t) / U : 1, uhf = -2 * t * x + (U / 2) * x * x;
    // 精确基态 = a|σg²⟩ − b|σu²⟩；自然轨道占据数 2a²、2b²
    const Hgg = -2 * t + U / 2, Huu = 2 * t + U / 2, Hgu = U / 2, th = 0.5 * Math.atan2(2 * Hgu, Huu - Hgg), a = Math.cos(th), b = Math.sin(th);
    return { exact, rhf, uhf, s2uhf: 1 - x * x, nG: 2 * a * a, nU: 2 * b * b, ionic: (a - b) ** 2 / 2 };
  }

  // ── 活性空间的大小 ─────────────────────────────────────────────────
  const LG = (() => { const t = [0]; for (let i = 1; i <= 400; i++) t[i] = t[i - 1] + Math.log(i); return t; })();
  const lbinom = (n, k) => (k < 0 || k > n ? -Infinity : LG[n] - LG[k] - LG[n - k]);
  const binom = (n, k) => Math.round(Math.exp(lbinom(n, k)));
  const log10dets = (ne, no) => (lbinom(no, Math.ceil(ne / 2)) + lbinom(no, Math.floor(ne / 2))) / Math.LN10;
  // Weyl–Paldus：n 个轨道、N 个电子、总自旋 S 的 CSF 个数
  const log10csf = (ne, no, S = 0) => (Math.log(2 * S + 1) - Math.log(no + 1) + lbinom(no + 1, ne / 2 - S) + lbinom(no + 1, ne / 2 + S + 1)) / Math.LN10;

  // ── 交换耦合的自旋簇：多重态计数（均匀反铁磁耦合时是 Landé 间隔规则）──
  // spins：每个格点的 2s（比如 Fe³⁺ 高自旋是 5，Fe²⁺ 是 4）。c[k]：总的 2M = 2k − top 的态数。
  function spinCounts(spins) {
    let c = [1];
    for (const s2 of spins) { const n = new Array(c.length + s2).fill(0); c.forEach((x, k) => { for (let j = 0; j <= s2; j++) n[k + j] += x; }); c = n; }
    const top = spins.reduce((a, b) => a + b, 0), out = [];
    for (let S2 = top % 2; S2 <= top; S2 += 2) { const k = (S2 + top) / 2, mult = c[k] - (k + 1 <= top ? c[k + 1] : 0); if (mult > 0) out.push({ S: S2 / 2, mult }); }
    return { dim: spins.reduce((a, s2) => a * (s2 + 1), 1), levels: out };
  }
  function spinLadder(spins, J = 1) { // 全部格点两两等强耦合：H = J Σ Sᵢ·Sⱼ = (J/2)[S(S+1) − Σ sᵢ(sᵢ+1)]
    const { dim, levels } = spinCounts(spins), base = spins.reduce((a, s2) => a + (s2 / 2) * (s2 / 2 + 1), 0);
    const L = levels.map((x) => ({ ...x, E: (J / 2) * (x.S * (x.S + 1) - base) })).sort((a, b) => a.E - b.E);
    const E0 = L[0].E; return { dim, levels: L.map((x) => ({ ...x, dE: x.E - E0 })) };
  }

  // ── 随机量子线路（砖墙排布的两比特门）：纠缠随深度长，MPS 需要的 χ 跟着指数长 ──
  function randomOrth4(r) { const S = Array.from({ length: 4 }, () => new Array(4).fill(0)); for (let i = 0; i < 4; i++) for (let j = i; j < 4; j++) S[i][j] = S[j][i] = r() - 0.5; const { vecs } = eigh(S); return vecs; } // 实对称矩阵的本征向量排成的正交矩阵
  function randomCircuit(N, depth, seed = 1, eps = 1e-6) {
    const r = rng(seed), dim = 2 ** N, bit = (i) => 1 << (N - 1 - i), out = [];
    let psi = new Float64Array(dim); psi[0] = 1;
    const record = (dd) => { const s = schmidt(psi, N, N / 2); let tot = 0; for (const x of s) tot += x * x; let acc = 0, k = 0; while (k < s.length && 1 - acc / tot > eps) { acc += s[k] * s[k]; k++; } out.push({ depth: dd, S: entropyOf(s), chi: Math.max(1, k) }); };
    record(0);
    for (let dd = 1; dd <= depth; dd++) {
      for (let i = (dd + 1) % 2; i + 1 < N; i += 2) {
        const G = randomOrth4(r), mi = bit(i), mj = bit(i + 1);
        for (let x = 0; x < dim; x++) {
          if (x & (mi | mj)) continue;
          const idx = [x, x | mj, x | mi, x | mi | mj], v = idx.map((y) => psi[y]);
          for (let a = 0; a < 4; a++) psi[idx[a]] = G[a][0] * v[0] + G[a][1] * v[1] + G[a][2] * v[2] + G[a][3] * v[3];
        }
      }
      record(dd);
    }
    return out;
  }

  // ── 无穷长 MPS 的转移矩阵：AKLT 和随机 MPS ──────────────────────────
  function akltTensors() { const a = Math.sqrt(2 / 3), b = Math.sqrt(1 / 3); return [[[0, a], [0, 0]], [[-b, 0], [0, b]], [[0, 0], [-a, 0]]]; } // 自旋 1 的 +1、0、−1
  function randomTensors(chi, d = 2, seed = 1) { const r = rng(seed); return Array.from({ length: d }, () => Array.from({ length: chi }, () => Array.from({ length: chi }, () => 2 * r() - 1))); }
  const mmul = (A, B) => A.map((row) => B[0].map((_, j) => row.reduce((s, x, k) => s + x * B[k][j], 0)));
  const mT = (A) => A[0].map((_, j) => A.map((r) => r[j]));
  const zeros = (n) => Array.from({ length: n }, () => new Array(n).fill(0));
  const madd = (A, B, c = 1) => A.map((r, i) => r.map((x, j) => x + c * B[i][j]));
  const mnorm = (A) => Math.sqrt(A.reduce((s, r) => s + r.reduce((q, x) => q + x * x, 0), 0));
  // 右作用 E_O(X) = Σ O_{ss′} A^{s′} X A^{s}ᵀ；左作用 Σ O_{ss′} A^{s}ᵀ Y A^{s′}
  const ER = (T, X, O) => { let out = zeros(X.length); T.forEach((As, s) => T.forEach((At, s2) => { const o = O ? O[s][s2] : s === s2 ? 1 : 0; if (o) out = madd(out, mmul(mmul(At, X), mT(As)), o); })); return out; };
  const EL = (T, Y, O) => { let out = zeros(Y.length); T.forEach((As, s) => T.forEach((At, s2) => { const o = O ? O[s][s2] : s === s2 ? 1 : 0; if (o) out = madd(out, mmul(mmul(mT(As), Y), At), o); })); return out; };
  function power(f, n, iters = 400) { let X = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0.1))), lam = 1; for (let k = 0; k < iters; k++) { const Y = f(X); lam = mnorm(Y); X = Y.map((r) => r.map((x) => x / lam)); } return { X, lam }; }
  function transfer(T) {
    const chi = T[0].length, R = power((X) => ER(T, X), chi), Lf = power((Y) => EL(T, Y), chi), lam = R.lam;
    const Tn = T.map((A) => A.map((r) => r.map((x) => x / Math.sqrt(lam))));
    let z = 0; for (let i = 0; i < chi; i++) for (let j = 0; j < chi; j++) z += Lf.X[i][j] * R.X[i][j];
    const l = Lf.X.map((r) => r.map((x) => x / z)), r = R.X;
    const pair = (Y, X) => { let s = 0; for (let i = 0; i < chi; i++) for (let j = 0; j < chi; j++) s += Y[i][j] * X[i][j]; return s; };
    // 第二大的本征值的模：把不动点投影掉之后，‖Eᵏx‖^{1/k}
    let X = Array.from({ length: chi }, (_, i) => Array.from({ length: chi }, (_, j) => Math.sin(1 + 3 * i + 7 * j))), logn = 0;
    const proj = (X) => { const c = pair(l, X); return madd(X, r, -c); };
    X = proj(X); const K = 400, logs = [];
    for (let k = 0; k < K; k++) { X = proj(ER(Tn, X)); const n = mnorm(X); if (!(n > 1e-280)) { logn = -Infinity; break; } logn += Math.log(n); logs.push(logn); X = X.map((row) => row.map((x) => x / n)); }
    const lam2 = Number.isFinite(logn) ? Math.exp((logs[K - 1] - logs[K / 2 - 1]) / (K / 2)) : 0; // 只用后一半：前面的暂态不算
    return { T: Tn, l, r, lam, lam2, xi: lam2 > 0 ? -1 / Math.log(lam2) : 0, pair };
  }
  // ⟨O₀ O_r⟩ − ⟨O⟩²（string：中间的格点乘 G，AKLT 的弦序用 G = exp(iπSᶻ)）
  function correlations(tr, O, rmax = 20, G = null) {
    const { T, l, r, pair } = tr, ev = pair(l, ER(T, r, O)), out = [];
    let X = ER(T, r, O); // 最右边的 O_r
    for (let k = 1; k <= rmax; k++) { out.push(pair(l, ER(T, X, O)) - (G ? 0 : ev * ev)); X = G ? ER(T, X, G) : ER(T, X); }
    return { mean: ev, C: out };
  }
  const SZ1 = [[1, 0, 0], [0, 0, 0], [0, 0, -1]], STRING1 = [[-1, 0, 0], [0, 1, 0], [0, 0, -1]], ZPAULI = [[1, 0], [0, -1]];

  // ── 互信息和 Fiedler 排序（量子化学 DMRG 用它排轨道）─────────────────
  function permuteState(psi, N, perm) { // perm[k]：新顺序里第 k 位是原来的哪个格点
    const out = new Float64Array(psi.length);
    for (let x = 0; x < psi.length; x++) { let y = 0; for (let k = 0; k < N; k++) if (x & (1 << (N - 1 - perm[k]))) y |= 1 << (N - 1 - k); out[y] = psi[x]; }
    return out;
  }
  function mutualInfo(psi, N) {
    const bit = (i) => 1 << (N - 1 - i), s1 = [], I = Array.from({ length: N }, () => new Float64Array(N));
    const vn = (rho) => { const v = eigh(rho, false).vals; let S = 0; for (const x of v) if (x > 1e-15) S -= x * Math.log(x); return S; };
    for (let i = 0; i < N; i++) { const r = [[0, 0], [0, 0]], m = bit(i); for (let x = 0; x < psi.length; x++) { const a = x & m ? 1 : 0; r[a][a] += psi[x] * psi[x]; if (!a) { r[0][1] += psi[x] * psi[x | m]; } } r[1][0] = r[0][1]; s1.push(vn(r)); }
    for (let i = 0; i < N; i++) for (let j = i + 1; j < N; j++) {
      const mi = bit(i), mj = bit(j), r = Array.from({ length: 4 }, () => new Array(4).fill(0));
      for (let x = 0; x < psi.length; x++) { const a = x & mi ? 1 : 0, b = x & mj ? 1 : 0, base = x & ~(mi | mj); for (let a2 = 0; a2 < 2; a2++) for (let b2 = 0; b2 < 2; b2++) r[2 * a + b][2 * a2 + b2] += psi[x] * psi[base | (a2 ? mi : 0) | (b2 ? mj : 0)]; }
      I[i][j] = I[j][i] = Math.max(0, s1[i] + s1[j] - vn(r));
    }
    return { s1, I };
  }
  function fiedler(W) { // W：对称的非负权重；返回按 Fiedler 向量排好的格点顺序
    const n = W.length, Lp = W.map((r, i) => { const q = Float64Array.from(r, (x) => -x); q[i] = r.reduce((a, b, j) => a + (j === i ? 0 : b), 0); return q; });
    const { vecs } = eigh(Lp), f = vecs.map((r) => r[1]);
    return Array.from({ length: n }, (_, i) => i).sort((a, b) => f[a] - f[b] || a - b);
  }
  // 一个排序下的最大切口熵、需要的 χ（每条切口扔掉的权重 ≤ eps 时）
  function orderingCost(psi, N, perm, eps = 1e-6) {
    const p = permuteState(psi, N, perm), prof = [], need = [];
    for (let l = 1; l < N; l++) { const s = schmidt(p, N, l); prof.push(entropyOf(s)); let tot = 0; for (const x of s) tot += x * x; let acc = 0, k = 0; while (k < s.length && 1 - acc / tot > eps) { acc += s[k] * s[k]; k++; } need.push(Math.max(1, k)); }
    return { prof, need, maxS: Math.max(...prof), maxChi: Math.max(...need) };
  }
  // 演示用的几种图（都是二分图且两边一样大，所以基态是唯一的单态，Lieb–Mattis）
  function graph(id) {
    const N = 12, b = [];
    if (id === 'chain') for (let i = 0; i < N - 1; i++) b.push([i, i + 1, 1]);
    else if (id === 'ring') for (let i = 0; i < N; i++) b.push([i, (i + 1) % N, 1]);
    else if (id === 'ladder') { for (let x = 0; x < 6; x++) { b.push([x, x + 6, 1]); if (x < 5) { b.push([x, x + 1, 1]); b.push([x + 6, x + 7, 1]); } } }
    else { // 三个强耦合的四元环（像三个片段），片段之间弱耦合；格点编号故意交错：片段 k 是 {k, k+3, k+6, k+9}
      const frag = (k) => [k, k + 3, k + 6, k + 9];
      for (let k = 0; k < 3; k++) { const [a, c, e, f] = frag(k); b.push([a, c, 1], [c, e, 1], [e, f, 1], [f, a, 1]); }
      b.push([9, 1, 0.15], [10, 2, 0.15]); // 片段 0 的 f（9）连片段 1 的 a（1）；片段 1 的 f（10）连片段 2 的 a（2）
    }
    return { N, bonds: b };
  }

  window.MOLASTRIA_TENSOR_MODELS = {
    rng, eigh, svd, lanczos, spinModel, groundState, energy, entropyOf, schmidt, entropyProfile, twoQubit, mpsCompress, mpsToVector, truncate, tfimExact,
    mpo, dmrgInit, dmrgStep, dmrgRun, hnu, ffCorr, ffEntropy, hopChain, chainEntropy, ccChord, fitCentral, lattice2d, halfEntropy2d, quench,
    hubbardED, hubbardMF, dimer, randomCircuit, lbinom, binom, log10dets, log10csf, spinCounts, spinLadder, akltTensors, randomTensors, transfer, correlations, SZ1, STRING1, ZPAULI,
    permuteState, mutualInfo, fiedler, orderingCost, graph, popcount,
  };
})();
