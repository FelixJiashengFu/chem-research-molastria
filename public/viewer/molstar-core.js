/* Mol* 查看器的纯函数：不碰 DOM，浏览器和 node 都能用（tools/molstar-test.mjs 测）。
   - 读写 PDB：多帧（MODEL … ENDMDL）的拆分和拼回，每帧可带时间（REMARK t = … ps）
   - 把模型接口“蛋白质分子动力学”返回的 Cα 轨迹（或 { residues, frames } 形式的 JSON）变成多帧 PDB，
     把每个残基的 RMSF 写进 B 因子一栏（B = 8π²/3 · RMSF²），Mol* 的 uncertainty 配色和 putty 粗细就按它画
   - 玩具演示：理想 α 螺旋的 Cα 链 + 弹性网络模型（ANM）的低频正则模，现算一段“轨迹”和 RMSF（分子动力学栏目用）
   浏览器里是 window.MolAstriaMolstarCore，node 里 module.exports。 */
(function (root) {
  'use strict';

  const VERSION = '5.13.1';
  const BASE = `https://cdn.jsdelivr.net/npm/molstar@${VERSION}/build/viewer/`;
  const SRC = `${BASE}molstar.js`;
  const css = (dark) => `${BASE}theme/${dark ? 'dark' : 'light'}.css`;
  const RCSB = (id) => `https://files.rcsb.org/download/${id}.cif`;

  /** PDB 编号：4 位（第一位是 1–9），或者新式的 pdb_0000xxxx。不对就给空字符串。 */
  const cleanPdbId = (v) => {
    const s = String(v ?? '').trim().toUpperCase();
    return /^[1-9][A-Z0-9]{3}$/.test(s) || /^PDB_[0-9A-Z]{8}$/.test(s) ? s : '';
  };

  /** 一行 ATOM / HETATM 读成对象；读不出坐标就给 null。 */
  function parseAtom(line) {
    if (!/^(ATOM  |HETATM)/.test(line)) return null;
    const num = (a, b) => Number(line.slice(a, b));
    const x = num(30, 38), y = num(38, 46), z = num(46, 54);
    if (![x, y, z].every(Number.isFinite) || line.length < 54) return null;
    const name = line.slice(12, 16).trim();
    const el = line.slice(76, 78).trim() || name.replace(/[^A-Za-z]/g, '').slice(0, 1);
    const b = num(60, 66);
    return {
      het: line.startsWith('HETATM'), name, alt: line.slice(16, 17).trim(), resn: line.slice(17, 20).trim(), chain: line.slice(21, 22).trim() || 'A',
      resi: Number.parseInt(line.slice(22, 26), 10) || 0, icode: line.slice(26, 27).trim(), x, y, z, occ: Number.isFinite(num(54, 60)) && line.slice(54, 60).trim() ? num(54, 60) : 1,
      b: Number.isFinite(b) && line.slice(60, 66).trim() ? b : 0, el,
    };
  }

  /** 多帧 PDB 拆成帧：[{ t（ps，没有就是 null）, atoms }]。没有 MODEL 记录时整个文件算一帧；没有原子的帧丢掉。 */
  function parseModels(text) {
    const lines = String(text ?? '').replace(/\r\n?/g, '\n').split('\n');
    const models = [];
    let cur = null;
    const flush = () => { if (cur && cur.atoms.length) models.push(cur); cur = null; };
    for (const line of lines) {
      if (line.startsWith('MODEL')) { flush(); cur = { t: null, atoms: [] }; continue; }
      if (line.startsWith('ENDMDL')) { flush(); continue; }
      if (line.startsWith('END') && !line.startsWith('ENDMDL')) { flush(); continue; }
      const m = line.match(/^REMARK\s+t\s*=\s*([-\d.eE+]+)\s*ps/);
      if (m) { cur ||= { t: null, atoms: [] }; cur.t = Number(m[1]); continue; }
      const a = parseAtom(line);
      if (a) { cur ||= { t: null, atoms: [] }; cur.atoms.push(a); }
    }
    flush();
    return models;
  }

  /** 只有 Cα 的结构（模型接口的轨迹）：画不出卡通的二级结构，只能画成一根管子。 */
  const caOnly = (text) => {
    const a = parseModels(text)[0]?.atoms || [];
    return a.length > 0 && a.every((x) => x.name === 'CA');
  };

  /** RMSF（Å）换成各向同性 B 因子（Å²）：B = 8π²⟨u²⟩，⟨u²⟩ 是一个方向上的均方位移 = RMSF²/3。 */
  const rmsfToB = (a) => (8 * Math.PI ** 2 / 3) * a * a;
  const bToRmsf = (b) => Math.sqrt((3 * b) / (8 * Math.PI ** 2));

  const resKey = (chain, resn, resi) => `${chain || 'A'}:${String(resn).toUpperCase()}${resi}`;
  /** 每个原子对应的 RMSF（Å）：先按“链:残基名+编号”（rmsf 里是 { chain, res: 'ASN1', a }）对，对不上的按残基出现的顺序对。
      返回 { values（每个原子一个，没有就是 NaN）, matched（对上的残基数）}。 */
  function rmsfPerAtom(atoms, rmsf) {
    const list = Array.isArray(rmsf) ? rmsf.filter((r) => r && Number.isFinite(Number(r.a))) : [];
    const byKey = new Map(list.map((r) => [`${r.chain || 'A'}:${String(r.res || '').toUpperCase()}`, Number(r.a)]));
    const order = [];
    const seen = new Map();
    for (const a of atoms) { const k = resKey(a.chain, a.resn, `${a.resi}${a.icode || ''}`); if (!seen.has(k)) { seen.set(k, order.length); order.push(k); } }
    let matched = 0;
    const perRes = order.map((k, i) => {
      if (byKey.has(k)) { matched++; return byKey.get(k); }
      return list.length === order.length ? Number(list[i].a) : NaN;
    });
    if (!matched && list.length === order.length) matched = order.length; // 名字不一样（比如 HID / HIS）但个数一样：按顺序
    return { values: atoms.map((a) => perRes[seen.get(resKey(a.chain, a.resn, `${a.resi}${a.icode || ''}`))]), matched };
  }

  /** 一组数的显示范围 [低, 高]：去掉 NaN，范围为零时撑开一点，免得配色除以零。 */
  function domainOf(values) {
    const v = values.filter(Number.isFinite);
    if (!v.length) return [0, 1];
    let lo = Math.min(...v), hi = Math.max(...v);
    if (hi - lo < 1e-6) { lo -= 0.5; hi += 0.5; }
    return [lo, hi];
  }

  const fx = (v, w, d) => (Number.isFinite(v) ? v.toFixed(d) : (0).toFixed(d)).padStart(w).slice(-w);
  /** 一个原子写回 PDB 的 ATOM 行（80 列）。 */
  function atomLine(serial, a, b = a.b) {
    const name = a.name.length < 4 && !/^\d/.test(a.name) ? ` ${a.name.padEnd(3)}` : a.name.padEnd(4).slice(0, 4);
    return `${a.het ? 'HETATM' : 'ATOM  '}${String(serial % 100000).padStart(5)} ${name}${(a.alt || ' ').slice(0, 1)}${String(a.resn).padStart(3).slice(-3)} ${(a.chain || 'A').slice(0, 1)}${String(a.resi % 10000).padStart(4)}${(a.icode || ' ').slice(0, 1)}   `
      + `${fx(a.x, 8, 3)}${fx(a.y, 8, 3)}${fx(a.z, 8, 3)}${fx(a.occ ?? 1, 6, 2)}${fx(b, 6, 2)}          ${String(a.el || 'C').toUpperCase().padStart(2).slice(-2)}  `;
  }
  /** 帧写回 PDB。bfac：每个原子一个 B 因子（所有帧共用），不给就用原来的。多于一帧时写 MODEL / ENDMDL 和时间。 */
  function writeModels(models, bfac) {
    const many = models.length > 1;
    let out = '';
    models.forEach((m, k) => {
      if (many) out += `MODEL     ${String(k + 1).padStart(4)}\n`;
      if (Number.isFinite(m.t)) out += `REMARK   t = ${m.t.toFixed(1)} ps\n`;
      m.atoms.forEach((a, i) => { out += `${atomLine(i + 1, a, bfac && Number.isFinite(bfac[i]) ? bfac[i] : a.b).trimEnd()}\n`; });
      if (many) out += 'ENDMDL\n';
    });
    return `${out}END\n`;
  }

  /** 给一段 PDB（可以多帧）的 B 因子写上 RMSF：返回 { pdb, frames, times, domain（B 的范围）, rmsfDomain（Å）, matched }。
      rmsf 是空的或一个也对不上时原样返回，domain 是 null。 */
  function withRmsf(text, rmsf) {
    const models = parseModels(text);
    const times = models.map((m) => m.t);
    if (!models.length) return { pdb: '', frames: 0, times, domain: null, rmsfDomain: null, matched: 0 };
    const { values, matched } = rmsfPerAtom(models[0].atoms, rmsf);
    if (!matched) return { pdb: String(text), frames: models.length, times, domain: null, rmsfDomain: null, matched: 0 };
    const b = values.map((a) => (Number.isFinite(a) ? rmsfToB(a) : NaN));
    return { pdb: writeModels(models, b), frames: models.length, times, domain: domainOf(b), rmsfDomain: domainOf(values), matched };
  }

  /** 轨迹的 JSON 形式 → 多帧 PDB（只有 Cα）。traj = { residues: [{ resn, chain, resi }], frames: [{ t_ps, xyz: [[x, y, z]…] }] }。
      坐标个数和残基个数不一致的帧丢掉。rmsf 可选（[{ chain, res, a }] 或者每个残基一个数）。 */
  function framesToPdb(traj, rmsf) {
    const res = Array.isArray(traj?.residues) ? traj.residues : [];
    const models = (Array.isArray(traj?.frames) ? traj.frames : [])
      .filter((f) => Array.isArray(f?.xyz) && f.xyz.length === res.length && f.xyz.every((p) => Array.isArray(p) && p.length >= 3 && p.slice(0, 3).every((v) => Number.isFinite(Number(v)))))
      .map((f) => ({ t: Number.isFinite(Number(f.t_ps)) ? Number(f.t_ps) : null, atoms: f.xyz.map((p, i) => ({ het: false, name: 'CA', alt: '', resn: String(res[i].resn || 'UNK').toUpperCase().slice(0, 3), chain: String(res[i].chain || 'A').slice(0, 1), resi: Number(res[i].resi) || i + 1, icode: '', x: Number(p[0]), y: Number(p[1]), z: Number(p[2]), occ: 1, b: 0, el: 'C' })) }));
    if (!models.length) return '';
    const text = writeModels(models);
    if (rmsf == null) return text;
    const list = Array.isArray(rmsf) && rmsf.every((v) => typeof v === 'number') ? rmsf.map((a, i) => ({ chain: models[0].atoms[i]?.chain, res: `${models[0].atoms[i]?.resn}${models[0].atoms[i]?.resi}`, a })) : rmsf;
    return withRmsf(text, list).pdb || text;
  }

  /** 滑杆旁边的说明：“第 k / n 帧 · t ps”（k 从 0 数；en 为真时写英文）。 */
  const frameLabel = (k, n, t, en = false) => `${en ? `Frame ${k + 1} / ${n}` : `第 ${k + 1} / ${n} 帧`}${Number.isFinite(t) ? ` · ${t.toFixed(1)} ps` : ''}`;

  // ── 玩具演示：理想 α 螺旋 + 弹性网络模型 ───────────────────────────────
  /** 理想 α 螺旋的 Cα：每个残基转 100°、上升 1.5 Å，半径 2.3 Å（相邻 Cα 约 3.8 Å）。 */
  function helixCa(n) {
    const out = [];
    for (let i = 0; i < n; i++) { const th = (i * 100 * Math.PI) / 180; out.push([2.3 * Math.cos(th), 2.3 * Math.sin(th), 1.5 * (i - (n - 1) / 2)]); }
    return out;
  }
  /** 实对称矩阵的全部本征值和本征向量（循环 Jacobi）：{ values 从小到大, vectors[k] 是第 k 个本征向量 }。 */
  function eigSym(A) {
    const n = A.length, a = A.map((r) => r.slice()), V = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p][q] ** 2;
      if (off < 1e-22) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const akp = a[k][p], akq = a[k][q]; a[k][p] = c * akp - s * akq; a[k][q] = s * akp + c * akq; }
        for (let k = 0; k < n; k++) { const apk = a[p][k], aqk = a[q][k]; a[p][k] = c * apk - s * aqk; a[q][k] = s * apk + c * aqk; }
        for (let k = 0; k < n; k++) { const vkp = V[k][p], vkq = V[k][q]; V[k][p] = c * vkp - s * vkq; V[k][q] = s * vkp + c * vkq; }
      }
    }
    const idx = [...Array(n).keys()].sort((i, j) => a[i][i] - a[j][j]);
    return { values: idx.map((i) => a[i][i]), vectors: idx.map((i) => V.map((row) => row[i])) };
  }
  /** ANM（Atilgan 等 2001）的 Hessian：截断 rc 以内的每对 Cα 之间一根力常数 γ 的弹簧。3N × 3N。 */
  function anmHessian(xyz, rc = 13, gamma = 1) {
    const n = xyz.length, H = Array.from({ length: 3 * n }, () => new Array(3 * n).fill(0));
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = [0, 1, 2].map((k) => xyz[j][k] - xyz[i][k]), r2 = d[0] ** 2 + d[1] ** 2 + d[2] ** 2;
      if (r2 > rc * rc) continue;
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) {
        const v = (-gamma * d[a] * d[b]) / r2;
        H[3 * i + a][3 * j + b] = v; H[3 * j + b][3 * i + a] = v;
        H[3 * i + a][3 * i + b] -= v; H[3 * j + a][3 * j + b] -= v;
      }
    }
    return H;
  }
  /** 一段由低频正则模叠加出来的“轨迹”：第 k 个模以自己的频率 √λ 振动，振幅按热平衡 ∝ 1/√λ（温度归一到 amp）。
      返回 { frames: [[x, y, z]…][], rmsf: 每个残基（Å，从帧里统计）, rmsfTheory: ANM 的 ⟨Δr²⟩ ∝ Σ |v|²/λ（缩放到同样的最大值）, values }。 */
  function anmTrajectory(xyz, { modes = 3, frames = 40, amp = 1.2, rc = 13 } = {}) {
    const n = xyz.length, { values, vectors } = eigSym(anmHessian(xyz, rc));
    const use = [];
    for (let k = 0; k < values.length && use.length < modes; k++) if (values[k] > 1e-6) use.push(k); // 前六个是平动和转动（本征值 0）
    const l0 = values[use[0]];
    const out = [];
    for (let f = 0; f < frames; f++) {
      const ph = (2 * Math.PI * f) / frames;
      out.push(xyz.map((p, i) => p.map((v, a) => v + use.reduce((s, k, m) => s + amp * Math.sqrt(l0 / values[k]) * vectors[k][3 * i + a] * Math.sqrt(n) * Math.sin(Math.round(Math.sqrt(values[k] / l0) * (m + 1)) * ph + m), 0))));
    }
    const mean = xyz.map((_, i) => [0, 1, 2].map((a) => out.reduce((s, fr) => s + fr[i][a], 0) / frames));
    const rmsf = xyz.map((_, i) => Math.sqrt(out.reduce((s, fr) => s + (fr[i][0] - mean[i][0]) ** 2 + (fr[i][1] - mean[i][1]) ** 2 + (fr[i][2] - mean[i][2]) ** 2, 0) / frames));
    const th = xyz.map((_, i) => use.reduce((s, k) => s + (vectors[k][3 * i] ** 2 + vectors[k][3 * i + 1] ** 2 + vectors[k][3 * i + 2] ** 2) / values[k], 0));
    const sc = Math.max(...rmsf) / Math.sqrt(Math.max(...th));
    return { frames: out, rmsf, rmsfTheory: th.map((v) => Math.sqrt(v) * sc), values: use.map((k) => values[k]) };
  }
  /** 演示用的整套数据：n 个残基的丙氨酸螺旋（两端各一个甘氨酸），轨迹 JSON 和 RMSF。 */
  function helixDemo(n = 24, opts = {}) {
    const xyz = helixCa(n), run = anmTrajectory(xyz, opts);
    const residues = xyz.map((_, i) => ({ resn: i === 0 || i === n - 1 ? 'GLY' : 'ALA', chain: 'A', resi: i + 1 }));
    return { residues, frames: run.frames.map((p, k) => ({ t_ps: k * 0.5, xyz: p })), rmsf: run.rmsf, rmsfTheory: run.rmsfTheory, values: run.values };
  }

  const api = { VERSION, BASE, SRC, css, RCSB, cleanPdbId, parseAtom, parseModels, caOnly, rmsfToB, bToRmsf, rmsfPerAtom, domainOf, atomLine, writeModels, withRmsf, framesToPdb, frameLabel, helixCa, eigSym, anmHessian, anmTrajectory, helixDemo };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MolAstriaMolstarCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
