/* 计算工作台 · 结构的纯函数：读写九种结构格式、按共价半径连键、晶胞和晶体预设、超胞、按密勒指数切表面、
   测距离 / 键角 / 二面角、Kabsch–Horn 叠合和 RMSD、按元素的最优原子对应、IDPP 初始路径、构象系综（Boltzmann 布居、RMSD 归簇）。
   没有 DOM。浏览器里是 window.MolAstriaWB，node 里是 module.exports（tools/workbench-test.mjs 测）。
   功能清单参照 Ester Studio 2.1.2（github.com/Ahey1/Ester-Studio）；它的许可证不许销售修改版，所以这里没有用它的代码，
   全部按公开的格式说明和文献自己写（Kabsch 1976、Horn 1987、Smidstrup 2014 等，见 workbench.js 的文献表）。

   约定：一个结构 = { atoms: [{ el, x, y, z, frozen? }], cell: null | [[ax,ay,az],[bx,by,bz],[cx,cy,cz]]（Å）, energy?: number（Eh）,
   comment?: string }；多帧 = 这样的数组。原子编号对外一律从 1 开始（和各程序的输入一致）。 */
(function (root) {
  'use strict';

  const SYMBOLS = ('H He Li Be B C N O F Ne Na Mg Al Si P S Cl Ar K Ca Sc Ti V Cr Mn Fe Co Ni Cu Zn Ga Ge As Se Br Kr '
    + 'Rb Sr Y Zr Nb Mo Tc Ru Rh Pd Ag Cd In Sn Sb Te I Xe Cs Ba La Ce Pr Nd Pm Sm Eu Gd Tb Dy Ho Er Tm Yb Lu '
    + 'Hf Ta W Re Os Ir Pt Au Hg Tl Pb Bi Po At Rn').split(' ');
  const ZOF = Object.fromEntries(SYMBOLS.map((s, i) => [s, i + 1]));
  const BOHR = 0.529177210903; // Å per bohr (CODATA 2018)
  const HARTREE_KCAL = 627.509474, HARTREE_EV = 27.211386245988, HARTREE_KJ = 2625.4996394799;
  const KB_KCAL = 0.0019872043; // R in kcal mol⁻¹ K⁻¹

  // Cordero et al., Dalton Trans. 2008, 2832（低自旋值；C 取 sp³ 0.76）。没有的元素用 1.5。
  const COV = { H: 0.31, He: 0.28, Li: 1.28, Be: 0.96, B: 0.84, C: 0.76, N: 0.71, O: 0.66, F: 0.57, Ne: 0.58, Na: 1.66, Mg: 1.41, Al: 1.21, Si: 1.11,
    P: 1.07, S: 1.05, Cl: 1.02, Ar: 1.06, K: 2.03, Ca: 1.76, Sc: 1.70, Ti: 1.60, V: 1.53, Cr: 1.39, Mn: 1.39, Fe: 1.32, Co: 1.26, Ni: 1.24, Cu: 1.32,
    Zn: 1.22, Ga: 1.22, Ge: 1.20, As: 1.19, Se: 1.20, Br: 1.20, Kr: 1.16, Rb: 2.20, Sr: 1.95, Y: 1.90, Zr: 1.75, Nb: 1.64, Mo: 1.54, Tc: 1.47,
    Ru: 1.46, Rh: 1.42, Pd: 1.39, Ag: 1.45, Cd: 1.44, In: 1.42, Sn: 1.39, Sb: 1.39, Te: 1.38, I: 1.39, Xe: 1.40, Cs: 2.44, Ba: 2.15, La: 2.07,
    Hf: 1.75, Ta: 1.70, W: 1.62, Re: 1.51, Os: 1.44, Ir: 1.41, Pt: 1.36, Au: 1.36, Hg: 1.32, Tl: 1.45, Pb: 1.46, Bi: 1.48 };
  // 范德华半径：Bondi, J. Phys. Chem. 1964, 68, 441；H 用 Rowland & Taylor 的 1.09（CrystalExplorer 的 d_norm 也这样取）；没有的元素用 2.0。
  const VDW = { H: 1.09, He: 1.40, Li: 1.82, Be: 1.53, B: 1.92, C: 1.70, N: 1.55, O: 1.52, F: 1.47, Ne: 1.54, Na: 2.27, Mg: 1.73, Al: 1.84, Si: 2.10,
    P: 1.80, S: 1.80, Cl: 1.75, Ar: 1.88, K: 2.75, Ca: 2.31, Ni: 1.63, Cu: 1.40, Zn: 1.39, Ga: 1.87, Ge: 2.11, As: 1.85, Se: 1.90, Br: 1.85, Kr: 2.02,
    Rb: 3.03, Sr: 2.49, Pd: 1.63, Ag: 1.72, Cd: 1.58, In: 1.93, Sn: 2.17, Sb: 2.06, Te: 2.06, I: 1.98, Xe: 2.16, Cs: 3.43, Ba: 2.68, Pt: 1.72,
    Au: 1.66, Hg: 1.55, Tl: 1.96, Pb: 2.02, Bi: 2.07 };
  const cov = (el) => COV[el] ?? 1.5;
  const vdw = (el) => VDW[el] ?? 2.0;

  /** 'cl' 'CL' '17' 'C1'（标签） → 'Cl'；认不出返回 ''。 */
  function element(tok) {
    const s = String(tok ?? '').trim();
    if (/^\d+$/.test(s)) return SYMBOLS[Number(s) - 1] || '';
    const m = /^([A-Za-z])([A-Za-z]?)/.exec(s);
    if (!m) return '';
    const two = m[1].toUpperCase() + m[2].toLowerCase();
    if (m[2] && ZOF[two]) return two;
    const one = m[1].toUpperCase();
    return ZOF[one] ? one : '';
  }
  const num = (s) => { const v = Number(String(s ?? '').replace(/\(\d+\)$/, '').replace(/[dD]/, 'e')); return Number.isFinite(v) ? v : NaN; };
  const atom = (el, x, y, z, extra) => Object.assign({ el, x, y, z }, extra || {});

  // ── 向量和晶胞 ────────────────────────────────────────────────────────
  const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
  const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
  const mul = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const norm = (a) => Math.hypot(a[0], a[1], a[2]);
  const P = (a) => [a.x, a.y, a.z];
  const det3 = (m) => dot(m[0], cross(m[1], m[2]));

  /** a, b, c（Å）和 α, β, γ（度） → 三行晶胞矩阵：a 沿 x，b 在 xy 平面里。 */
  function cellFromParams(a, b, c, al = 90, be = 90, ga = 90) {
    const r = Math.PI / 180, ca = Math.cos(al * r), cb = Math.cos(be * r), cg = Math.cos(ga * r), sg = Math.sin(ga * r);
    const cx = c * cb, cy = (c * (ca - cb * cg)) / sg;
    const cz = Math.sqrt(Math.max(0, c * c - cx * cx - cy * cy));
    const z = (v) => (Math.abs(v) < 1e-12 ? 0 : v);
    return [[a, 0, 0], [z(b * cg), z(b * sg), 0], [z(cx), z(cy), z(cz)]];
  }
  /** 晶胞矩阵 → { a, b, c, alpha, beta, gamma, volume }。 */
  function cellParams(m) {
    const [A, B, C] = m, a = norm(A), b = norm(B), c = norm(C), d = 180 / Math.PI;
    return { a, b, c, alpha: Math.acos(dot(B, C) / (b * c)) * d, beta: Math.acos(dot(A, C) / (a * c)) * d, gamma: Math.acos(dot(A, B) / (a * b)) * d, volume: Math.abs(det3(m)) };
  }
  function inv3(m) {
    const d = det3(m);
    const c0 = cross(m[1], m[2]), c1 = cross(m[2], m[0]), c2 = cross(m[0], m[1]);
    // 列是 c0/d、c1/d、c2/d：frac = cart · inv
    return [[c0[0] / d, c1[0] / d, c2[0] / d], [c0[1] / d, c1[1] / d, c2[1] / d], [c0[2] / d, c1[2] / d, c2[2] / d]];
  }
  const fracToCart = (f, m) => [f[0] * m[0][0] + f[1] * m[1][0] + f[2] * m[2][0], f[0] * m[0][1] + f[1] * m[1][1] + f[2] * m[2][1], f[0] * m[0][2] + f[1] * m[1][2] + f[2] * m[2][2]];
  const cartToFrac = (p, m, inv = inv3(m)) => [p[0] * inv[0][0] + p[1] * inv[1][0] + p[2] * inv[2][0], p[0] * inv[0][1] + p[1] * inv[1][1] + p[2] * inv[2][1], p[0] * inv[0][2] + p[1] * inv[1][2] + p[2] * inv[2][2]];
  const wrap01 = (v) => { const w = v - Math.floor(v); return w > 1 - 1e-9 ? 0 : w; };

  // ── 连键 ──────────────────────────────────────────────────────────────
  /** 按共价半径连键：d < r_i + r_j + tol（默认 0.4 Å，和 Open Babel 的做法同一个思路）。有晶胞时也连跨边界的键（最近像）。
      返回 [[i, j, d]]（从 0 开始）。用网格分桶，几千个原子也快。 */
  function bonds(atoms, cell = null, tol = 0.4) {
    const n = atoms.length, out = [];
    if (!n) return out;
    const maxR = Math.max(...atoms.map((a) => cov(a.el))) * 2 + tol;
    const inv = cell ? inv3(cell) : null;
    const key = (x, y, z) => `${x},${y},${z}`;
    const cellOf = (p) => [Math.floor(p[0] / maxR), Math.floor(p[1] / maxR), Math.floor(p[2] / maxR)];
    const grid = new Map();
    atoms.forEach((a, i) => { const c = cellOf(P(a)); const k = key(...c); (grid.get(k) || grid.set(k, []).get(k)).push(i); });
    const near = (i, j) => {
      let d = sub(P(atoms[j]), P(atoms[i]));
      if (cell) { const f = cartToFrac(d, cell, inv).map((v) => v - Math.round(v)); d = fracToCart(f, cell); }
      return norm(d);
    };
    if (!cell) {
      atoms.forEach((a, i) => {
        const [cx, cy, cz] = cellOf(P(a));
        for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
          for (const j of grid.get(key(cx + dx, cy + dy, cz + dz)) || []) {
            if (j <= i) continue;
            const d = near(i, j);
            if (d > 0.1 && d < cov(a.el) + cov(atoms[j].el) + tol) out.push([i, j, d]);
          }
        }
      });
      return out;
    }
    // 有晶胞：原子数通常不多，直接两两比（n ≤ 3000 时），太多就只连胞内
    if (n > 3000) return bonds(atoms, null, tol);
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const d = near(i, j);
      if (d > 0.1 && d < cov(atoms[i].el) + cov(atoms[j].el) + tol) out.push([i, j, d]);
    }
    return out;
  }
  /** 连通的片段（分子）：返回每个原子所属片段的编号，以及片段列表 [[原子]]。 */
  function fragments(atoms, bondList = bonds(atoms)) {
    const parent = atoms.map((_, i) => i);
    const find = (i) => (parent[i] === i ? i : (parent[i] = find(parent[i])));
    for (const [i, j] of bondList) parent[find(i)] = find(j);
    const groups = new Map();
    atoms.forEach((_, i) => { const r = find(i); (groups.get(r) || groups.set(r, []).get(r)).push(i); });
    const list = [...groups.values()].sort((a, b) => b.length - a.length || a[0] - b[0]);
    const of = new Array(atoms.length);
    list.forEach((g, k) => g.forEach((i) => { of[i] = k; }));
    return { of, list };
  }

  // ── 读格式 ────────────────────────────────────────────────────────────
  const FORMATS = ['xyz', 'pdb', 'mol', 'cif', 'poscar', 'gjf', 'orca', 'cdxml', 'cube'];

  /** 猜格式：先看文件名，再看内容。 */
  function detectFormat(text, name = '') {
    const ext = (/\.([a-z0-9]+)$/i.exec(name) || [])[1]?.toLowerCase() || '';
    const byExt = { xyz: 'xyz', extxyz: 'xyz', trj: 'xyz', log: '', pdb: 'pdb', ent: 'pdb', mol: 'mol', sdf: 'mol', sd: 'mol', cif: 'cif', mmcif: 'cif', vasp: 'poscar', poscar: 'poscar', contcar: 'poscar', gjf: 'gjf', com: 'gjf', inp: 'orca', cdxml: 'cdxml', cube: 'cube', cub: 'cube' };
    if (byExt[ext]) return byExt[ext];
    if (/^(POSCAR|CONTCAR)/i.test(name)) return 'poscar';
    const t = String(text || '');
    if (/<CDXML[\s>]/.test(t)) return 'cdxml';
    if (/^\s*data_|_cell_length_a/m.test(t)) return 'cif';
    if (/^(ATOM  |HETATM|CRYST1)/m.test(t)) return 'pdb';
    if (/V2000|V3000/.test(t) || /\$\$\$\$/.test(t)) return 'mol';
    if (/^\s*\*\s*xyz\s+-?\d+\s+\d+/mi.test(t)) return 'orca';
    if (/^\s*#[a-z ]/im.test(t) && /^\s*-?\d+\s+\d+\s*$/m.test(t)) return 'gjf';
    const lines = t.replace(/\r/g, '').split('\n');
    if (/^\s*\d+\s*$/.test(lines[0] || '')) return 'xyz';
    if (lines.length > 3 && /^\s*\d+(\.\d+)?\s*$/.test(lines[1] || '') && lines.slice(2, 5).every((l) => (l.trim().split(/\s+/).length === 3 && l.trim().split(/\s+/).every((v) => Number.isFinite(Number(v)))))) return 'poscar';
    if (lines.length > 6 && /^\s*-?\d+\s+-?\d+\.\d+\s+-?\d+\.\d+\s+-?\d+\.\d+/.test(lines[2] || '')) return 'cube';
    return 'xyz';
  }

  /** 从注释行读能量：认 “E = -76.1 Eh”、“energy: -76.1”、“energy=-76.1”（extxyz）、ORCA 轨迹的 “E -154.12”、xtb 只写一个数。
      带 kcal/mol 的认作 kcal/mol（工作台自己从 SMILES 生成的 MMFF 构象这样写）。返回 { e, unit } 或 null。 */
  function commentEnergy(c) {
    const s = String(c || '');
    let m = /(?:^|[\s|,])(?:E|energy|Energy|ENERGY|E_tot|total_energy)\s*[:=]?\s*(-?\d+\.\d+(?:[eE][-+]?\d+)?)\s*(kcal\/mol|kj\/mol|ev|eh|hartree|au)?/i.exec(s);
    if (!m) m = /^\s*(-?\d+\.\d{4,})\s*(?:$|\s)/.exec(s);
    if (!m) return null;
    const unit = (m[2] || '').toLowerCase();
    return { e: Number(m[1]), unit: unit === 'kcal/mol' ? 'kcal' : unit === 'kj/mol' ? 'kj' : unit === 'ev' ? 'ev' : 'eh' };
  }
  /** extxyz 注释行里的 Lattice="ax ay az bx by bz cx cy cz"。 */
  function latticeOf(c) {
    const m = /Lattice\s*=\s*"([^"]+)"/i.exec(String(c || ''));
    if (!m) return null;
    const v = m[1].trim().split(/\s+/).map(Number);
    return v.length === 9 && v.every(Number.isFinite) ? [v.slice(0, 3), v.slice(3, 6), v.slice(6, 9)] : null;
  }

  function readXyz(t) {
    const lines = t.split('\n'), frames = [];
    let i = 0;
    while (i < lines.length) {
      if (!lines[i].trim()) { i++; continue; }
      const n = Number(lines[i].trim());
      if (!Number.isInteger(n) || n < 1 || i + 2 + n > lines.length) break;
      const comment = lines[i + 1] || '', atoms = [];
      for (let k = 0; k < n; k++) {
        const f = lines[i + 2 + k].trim().split(/\s+/);
        const el = element(f[0]);
        const xyz = f.slice(1, 4).map(num);
        if (!el || !xyz.every(Number.isFinite)) throw new Error(`xyz:${i + 3 + k}`);
        atoms.push(atom(el, ...xyz));
      }
      const ce = commentEnergy(comment); // 帧里的能量一律换成 Eh（注释里写了 kcal/mol、kJ/mol、eV 的照单位换）
      const toEh = ce ? { kcal: 1 / HARTREE_KCAL, kj: 1 / HARTREE_KJ, ev: 1 / HARTREE_EV, eh: 1 }[ce.unit] : 1;
      frames.push({ atoms, cell: latticeOf(comment), energy: ce ? ce.e * toEh : null, comment: comment.trim() });
      i += 2 + n;
    }
    return { frames, energyUnit: 'eh' };
  }

  function readPdb(t) {
    const frames = [];
    let cur = [], cell = null;
    const flush = () => { if (cur.length) frames.push({ atoms: cur, cell, energy: null, comment: '' }); cur = []; };
    for (const line of t.split('\n')) {
      if (line.startsWith('CRYST1')) {
        const v = [line.slice(6, 15), line.slice(15, 24), line.slice(24, 33), line.slice(33, 40), line.slice(40, 47), line.slice(47, 54)].map(Number);
        if (v.every(Number.isFinite) && v[0] > 1.5) cell = cellFromParams(...v); // 有的程序写 1 1 1 当“没有晶胞”
      } else if (/^(ATOM  |HETATM)/.test(line)) {
        const el = element(line.slice(76, 78).trim()) || element(line.slice(12, 16).trim().replace(/^\d+/, ''));
        const xyz = [line.slice(30, 38), line.slice(38, 46), line.slice(46, 54)].map(Number);
        if (el && xyz.every(Number.isFinite)) cur.push(atom(el, ...xyz));
      } else if (/^(ENDMDL|END\b)/.test(line)) flush();
    }
    flush();
    return { frames, energyUnit: 'eh' };
  }

  function readMol(t) {
    const frames = [];
    for (const block of t.split(/^\$\$\$\$\s*$/m)) {
      const lines = block.replace(/^\n+/, '').split('\n');
      const ci = lines.findIndex((l) => /V2000\s*$/.test(l));
      if (ci < 0) { if (/V3000/.test(block)) throw new Error('mol:v3000'); continue; }
      const na = Number(lines[ci].slice(0, 3)), nb = Number(lines[ci].slice(3, 6));
      const atoms = [], bondList = [];
      for (let k = 0; k < na; k++) {
        const l = lines[ci + 1 + k] || '';
        const xyz = [l.slice(0, 10), l.slice(10, 20), l.slice(20, 30)].map(Number);
        atoms.push(atom(element(l.slice(31, 34).trim()) || 'C', ...xyz));
      }
      for (let k = 0; k < nb; k++) {
        const l = lines[ci + 1 + na + k] || '';
        bondList.push([Number(l.slice(0, 3)) - 1, Number(l.slice(3, 6)) - 1, Number(l.slice(6, 9))]);
      }
      let charge = 0;
      for (const l of lines.slice(ci + 1 + na + nb)) {
        if (!l.startsWith('M  CHG')) continue;
        const v = l.slice(9).trim().split(/\s+/).map(Number);
        for (let k = 2; k < v.length; k += 2) charge += v[k] || 0;
      }
      const flat = atoms.every((a) => Math.abs(a.z) < 1e-4);
      const energy = /energy[^\n]*?(-?\d+\.\d+)/i.exec(block)?.[1];
      frames.push({ atoms, cell: null, energy: energy ? Number(energy) : null, comment: (lines[0] || '').trim(), bonds: bondList, charge, flat });
    }
    return { frames, energyUnit: 'eh' };
  }

  // CIF：晶胞、对称操作（x,y,z 形式）、原子（分数坐标），按操作展开到整个晶胞、去重。
  function symop(s) {
    const parts = String(s).replace(/['"\s]/g, '').toLowerCase().split(',');
    if (parts.length !== 3) return null;
    const rows = parts.map((p) => {
      const r = [0, 0, 0, 0];
      const re = /([+-]?)(\d*\.?\d+(?:\/\d+)?)?\*?([xyz])?/g;
      let m, any = false;
      while ((m = re.exec(p)) && m[0]) {
        any = true;
        const sign = m[1] === '-' ? -1 : 1;
        const v = m[2] ? (m[2].includes('/') ? m[2].split('/').reduce((a, b) => a / b) : Number(m[2])) : 1;
        if (m[3]) r['xyz'.indexOf(m[3])] += sign * (m[2] ? v : 1);
        else r[3] += sign * v;
      }
      return any ? r : null;
    });
    return rows.every(Boolean) ? rows : null;
  }
  function cifLoops(t) {
    const lines = t.replace(/\r/g, '').split('\n'), loops = [], tags = {};
    for (let i = 0; i < lines.length; i++) {
      const l = lines[i].trim();
      if (/^loop_/i.test(l)) {
        const head = [];
        let j = i + 1;
        while (j < lines.length && lines[j].trim().startsWith('_')) head.push(lines[j++].trim().split(/\s+/)[0].toLowerCase());
        const rows = [];
        let buf = [];
        while (j < lines.length) {
          const s = lines[j].trim();
          if (!s || s.startsWith('_') || /^loop_|^data_/i.test(s)) break;
          if (!s.startsWith('#')) {
            buf.push(...(s.match(/'[^']*'|"[^"]*"|\S+/g) || []).map((v) => v.replace(/^['"]|['"]$/g, '')));
            while (buf.length >= head.length) rows.push(buf.splice(0, head.length));
          }
          j++;
        }
        loops.push({ head, rows });
        i = j - 1;
      } else if (l.startsWith('_')) {
        const m = /^(\S+)\s+(.+)$/.exec(l);
        if (m) tags[m[1].toLowerCase()] = m[2].replace(/^['"]|['"]$/g, '');
      }
    }
    return { loops, tags };
  }
  function readCif(t) {
    const { loops, tags } = cifLoops(t);
    const p = ['_cell_length_a', '_cell_length_b', '_cell_length_c', '_cell_angle_alpha', '_cell_angle_beta', '_cell_angle_gamma'].map((k) => num(tags[k]));
    if (!p.slice(0, 3).every(Number.isFinite)) throw new Error('cif:cell');
    const cell = cellFromParams(p[0], p[1], p[2], Number.isFinite(p[3]) ? p[3] : 90, Number.isFinite(p[4]) ? p[4] : 90, Number.isFinite(p[5]) ? p[5] : 90);
    const opLoop = loops.find((L) => L.head.some((h) => /_symmetry_equiv_pos_as_xyz|_space_group_symop_operation_xyz/.test(h)));
    let ops = [];
    if (opLoop) {
      const k = opLoop.head.findIndex((h) => /_as_xyz|_operation_xyz/.test(h));
      ops = opLoop.rows.map((r) => symop(r[k])).filter(Boolean);
    }
    if (!ops.length) ops = [symop('x,y,z')];
    const at = loops.find((L) => L.head.includes('_atom_site_fract_x'));
    if (!at) throw new Error('cif:atoms');
    const col = (n) => at.head.indexOf(n);
    const ix = col('_atom_site_fract_x'), iy = col('_atom_site_fract_y'), iz = col('_atom_site_fract_z');
    const it = col('_atom_site_type_symbol'), il = col('_atom_site_label'), io = col('_atom_site_occupancy');
    const inv = inv3(cell), atoms = [];
    let partial = 0;
    for (const r of at.rows) {
      const el = element(it >= 0 ? r[it] : r[il]);
      const f = [num(r[ix]), num(r[iy]), num(r[iz])];
      if (!el || !f.every(Number.isFinite)) continue;
      if (io >= 0 && num(r[io]) < 0.99) partial++;
      for (const op of ops) {
        const g = op.map((row) => wrap01(row[0] * f[0] + row[1] * f[1] + row[2] * f[2] + row[3]));
        const c = fracToCart(g, cell);
        const dup = atoms.some((a) => {
          const d = cartToFrac(sub(P(a), c), cell, inv).map((v) => v - Math.round(v));
          return norm(fracToCart(d, cell)) < 0.05;
        });
        if (!dup) atoms.push(atom(el, ...c));
      }
    }
    return { frames: [{ atoms, cell, energy: null, comment: tags._chemical_formula_sum || tags['_chemical_name_common'] || '' }], energyUnit: 'eh', partial, ops: ops.length };
  }

  function readPoscar(t) {
    const lines = t.replace(/\r/g, '').split('\n');
    const scale = Number(lines[1]);
    let cell = [2, 3, 4].map((k) => lines[k].trim().split(/\s+/).slice(0, 3).map(Number));
    if (!Number.isFinite(scale) || !cell.flat().every(Number.isFinite)) throw new Error('poscar:cell');
    if (scale < 0) { const f = Math.cbrt(-scale / Math.abs(det3(cell))); cell = cell.map((v) => mul(v, f)); } else cell = cell.map((v) => mul(v, scale));
    let k = 5, names = lines[k].trim().split(/\s+/);
    let counts;
    if (names.every((s) => /^\d+$/.test(s))) { counts = names.map(Number); names = (lines[0].trim().split(/\s+/)).filter((s) => element(s)); }
    else { counts = lines[++k].trim().split(/\s+/).map(Number); }
    k++;
    let selective = false;
    if (/^\s*s/i.test(lines[k])) { selective = true; k++; }
    const direct = /^\s*d/i.test(lines[k]); k++;
    const atoms = [];
    counts.forEach((c, s) => {
      for (let q = 0; q < c; q++) {
        const f = lines[k++].trim().split(/\s+/);
        const v = f.slice(0, 3).map(Number);
        const p = direct ? fracToCart(v, cell) : v.map((x) => x * (scale > 0 ? scale : 1));
        const a = atom(element(names[s]) || 'X', ...p);
        if (selective && f.slice(3, 6).every((x) => /^f/i.test(x))) a.frozen = true;
        atoms.push(a);
      }
    });
    return { frames: [{ atoms, cell, energy: null, comment: lines[0].trim() }], energyUnit: 'eh' };
  }

  function readGjf(t) {
    const lines = t.replace(/\r/g, '').split('\n');
    let i = 0;
    while (i < lines.length && (lines[i].trim().startsWith('%') || !lines[i].trim())) i++;
    while (i < lines.length && lines[i].trim()) i++; // route
    i++;
    while (i < lines.length && lines[i].trim()) i++; // title
    i++;
    const cm = (lines[i] || '').trim().split(/\s+/).map(Number);
    const atoms = [], cellRows = [];
    for (i++; i < lines.length && lines[i].trim(); i++) {
      const f = lines[i].trim().split(/[\s,]+/);
      if (/^tv$/i.test(f[0])) { cellRows.push(f.slice(1, 4).map(Number)); continue; }
      const el = element(f[0].replace(/\(.*$/, '').replace(/-.*$/, ''));
      const nums = f.slice(1).map(Number);
      if (!el || nums.length < 3) throw new Error('gjf:zmatrix');
      const freeze = nums.length >= 4 && Number.isInteger(nums[0]) && f[1].indexOf('.') < 0 ? nums.shift() : 0;
      if (!nums.slice(0, 3).every(Number.isFinite)) throw new Error('gjf:zmatrix');
      atoms.push(atom(el, nums[0], nums[1], nums[2], freeze === -1 ? { frozen: true } : null));
    }
    return { frames: [{ atoms, cell: cellRows.length === 3 ? cellRows : null, energy: null, comment: '' }], energyUnit: 'eh', charge: cm[0], mult: cm[1] };
  }

  function readOrca(t) {
    const m = /^\s*\*\s*xyz\s+(-?\d+)\s+(\d+)\s*\n([\s\S]*?)^\s*\*/mi.exec(t);
    if (!m) throw new Error('orca:xyz');
    const atoms = m[3].split('\n').filter((l) => l.trim()).map((l) => {
      const f = l.trim().split(/\s+/);
      const v = f.slice(1, 4).map(Number);
      if (!element(f[0]) || !v.every(Number.isFinite)) throw new Error('orca:xyz');
      return atom(element(f[0]), ...v);
    });
    return { frames: [{ atoms, cell: null, energy: null, comment: '' }], energyUnit: 'eh', charge: Number(m[1]), mult: Number(m[2]) };
  }

  /** ChemDraw CDXML：节点（原子，2D 坐标）和键 → V2000 mol 块（2D，交给 RDKit 补氢、出 SMILES，再生成 3D）。
      缩写基团（Fragment / Nickname，比如 OMe、Ph）不展开，返回 skipped 计数。 */
  function cdxmlToMol(t) {
    const nodes = [], ids = new Map(), bondsOut = [];
    let skipped = 0;
    const attr = (s, k) => (new RegExp(`\\b${k}="([^"]*)"`).exec(s) || [])[1];
    // 只取最外层 fragment 里的 n（嵌套在 Nickname 里的子片段跳过）
    const depthRe = /<(\/?)(fragment|n|b)\b([^>]*?)(\/?)>/gi;
    let m, inNick = 0;
    const stack = [];
    while ((m = depthRe.exec(t))) {
      const [, close, tag, attrs, self] = m;
      const tg = tag.toLowerCase();
      if (close) { if (tg === 'n') { const top = stack.pop(); if (top === 'nick') inNick--; } continue; }
      if (tg === 'n') {
        const type = attr(attrs, 'NodeType') || '';
        const nick = /Fragment|Nickname|GenericNickname|Unspecified/i.test(type);
        if (!self) { stack.push(nick ? 'nick' : 'n'); if (nick) inNick++; }
        if (inNick > (nick && !self ? 1 : 0)) continue;
        const p = (attr(attrs, 'p') || '').split(/\s+/).map(Number);
        if (p.length < 2 || !p.every(Number.isFinite)) continue;
        if (nick) skipped++;
        const z = Number(attr(attrs, 'Element') || 6);
        ids.set(attr(attrs, 'id'), nodes.length);
        nodes.push({ el: nick ? 'C' : SYMBOLS[z - 1] || 'C', x: p[0] / 14.4, y: -p[1] / 14.4, charge: Number(attr(attrs, 'Charge') || 0), nick });
      } else if (tg === 'b') {
        if (inNick) continue;
        const b = ids.get(attr(attrs, 'B')), e = ids.get(attr(attrs, 'E'));
        const order = attr(attrs, 'Order') || '1';
        if (b != null && e != null) bondsOut.push([b, e, order === '2' ? 2 : order === '3' ? 3 : order === '1.5' ? 4 : 1]);
      }
    }
    if (!nodes.length) throw new Error('cdxml:empty');
    const L = ['', '  MolAstria workbench (from CDXML)', '', `${String(nodes.length).padStart(3)}${String(bondsOut.length).padStart(3)}  0  0  0  0  0  0  0  0999 V2000`];
    for (const n of nodes) L.push(`${n.x.toFixed(4).padStart(10)}${n.y.toFixed(4).padStart(10)}${'0.0000'.padStart(10)} ${n.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
    for (const [a, b, o] of bondsOut) L.push(`${String(a + 1).padStart(3)}${String(b + 1).padStart(3)}${String(o).padStart(3)}  0`);
    const ch = nodes.map((n, i) => [i + 1, n.charge]).filter(([, c]) => c);
    for (let k = 0; k < ch.length; k += 8) L.push(`M  CHG${String(Math.min(8, ch.length - k)).padStart(3)}${ch.slice(k, k + 8).map(([i, c]) => `${String(i).padStart(4)}${String(c).padStart(4)}`).join('')}`);
    L.push('M  END');
    return { molblock: L.join('\n') + '\n', atoms: nodes.length, bonds: bondsOut.length, skipped };
  }

  /** 读任何一种支持的格式。返回 { format, frames, energyUnit, charge?, mult?, notes: [代号] }。CDXML 返回 { format, molblock }（要先变成 3D）。 */
  function parseAny(text, name = '') {
    const t = String(text ?? '').replace(/\r\n?/g, '\n');
    const format = detectFormat(t, name);
    if (format === 'cdxml') return { format, ...cdxmlToMol(t), frames: [] };
    const fn = { xyz: readXyz, pdb: readPdb, mol: readMol, cif: readCif, poscar: readPoscar, gjf: readGjf, orca: readOrca }[format];
    if (!fn) return { format, frames: [] };
    const r = fn(t);
    r.format = format;
    r.notes = [];
    if (!r.frames.length || !r.frames[0].atoms.length) throw new Error(`${format}:empty`);
    if (r.frames.length > 1 && r.frames.some((f) => f.atoms.length !== r.frames[0].atoms.length)) r.notes.push('ragged');
    if (r.partial) r.notes.push('partial-occupancy');
    if (r.frames[0].flat) r.notes.push('flat');
    return r;
  }

  // ── 写格式 ────────────────────────────────────────────────────────────
  const f6 = (v) => v.toFixed(6).padStart(12);
  function writeXyz(frames, opts = {}) {
    return frames.map((fr, k) => {
      const parts = [];
      if (fr.cell) parts.push(`Lattice="${fr.cell.flat().map((v) => v.toFixed(6)).join(' ')}" Properties=species:S:1:pos:R:3 pbc="T T T"`);
      if (Number.isFinite(fr.energy)) parts.push(`energy=${fr.energy.toFixed(8)}`);
      const title = opts.title ? `${opts.title}${frames.length > 1 ? ` ${k + 1}/${frames.length}` : ''}` : (fr.comment || '').replace(/Lattice="[^"]*"|Properties=\S+|pbc="[^"]*"|energy=\S+/g, '').trim();
      if (title) parts.unshift(title);
      return `${fr.atoms.length}\n${parts.join(' ')}\n${fr.atoms.map((a) => `${a.el.padEnd(2)} ${f6(a.x)} ${f6(a.y)} ${f6(a.z)}`).join('\n')}\n`;
    }).join('');
  }
  function writePdb(frames, opts = {}) {
    const L = [`REMARK   1 ${String(opts.title || 'MolAstria workbench').slice(0, 60)}`];
    const fr0 = frames[0];
    if (fr0.cell) { const c = cellParams(fr0.cell); L.push(`CRYST1${c.a.toFixed(3).padStart(9)}${c.b.toFixed(3).padStart(9)}${c.c.toFixed(3).padStart(9)}${c.alpha.toFixed(2).padStart(7)}${c.beta.toFixed(2).padStart(7)}${c.gamma.toFixed(2).padStart(7)} P 1           1`); }
    frames.forEach((fr, k) => {
      if (frames.length > 1) L.push(`MODEL     ${String(k + 1).padStart(4)}`);
      const count = {};
      fr.atoms.forEach((a, i) => {
        count[a.el] = (count[a.el] || 0) + 1;
        const name = (a.el + count[a.el]).slice(0, 4);
        const nm = a.el.length === 1 ? ` ${name.padEnd(3)}` : name.padEnd(4);
        L.push(`HETATM${String((i + 1) % 100000).padStart(5)} ${nm} MOL A   1    ${a.x.toFixed(3).padStart(8)}${a.y.toFixed(3).padStart(8)}${a.z.toFixed(3).padStart(8)}  1.00  0.00          ${a.el.padStart(2)}`);
      });
      if (frames.length > 1) L.push('ENDMDL');
    });
    L.push('END');
    return L.join('\n') + '\n';
  }
  /** V2000 mol / SDF。连键按共价半径，键级一律写 1（XYZ 里没有键级；要键级请从 SMILES 生成）。 */
  function writeMol(frames, opts = {}) {
    return frames.map((fr, k) => {
      const bl = fr.bonds && fr.bonds.length ? fr.bonds.map(([i, j, o]) => [i, j, o]) : bonds(fr.atoms).map(([i, j]) => [i, j, 1]);
      if (fr.atoms.length > 999 || bl.length > 999) throw new Error('mol:big');
      const L = [String(opts.title || 'molecule').slice(0, 78), '  MolAstria workbench 3D', Number.isFinite(fr.energy) ? `energy ${fr.energy.toFixed(8)}` : '',
        `${String(fr.atoms.length).padStart(3)}${String(bl.length).padStart(3)}  0  0  0  0  0  0  0  0999 V2000`];
      for (const a of fr.atoms) L.push(`${a.x.toFixed(4).padStart(10)}${a.y.toFixed(4).padStart(10)}${a.z.toFixed(4).padStart(10)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
      for (const [i, j, o] of bl) L.push(`${String(i + 1).padStart(3)}${String(j + 1).padStart(3)}${String(o).padStart(3)}  0`);
      L.push('M  END');
      return L.join('\n') + (frames.length > 1 || opts.sdf ? '\n$$$$\n' : '\n');
    }).join('');
  }
  function writeCif(fr, opts = {}) {
    if (!fr.cell) throw new Error('cif:nocell');
    const c = cellParams(fr.cell), inv = inv3(fr.cell), count = {};
    const L = [`data_${String(opts.title || 'molastria').replace(/[^\w]+/g, '_')}`, '_symmetry_space_group_name_H-M   \'P 1\'', '_symmetry_Int_Tables_number      1',
      `_cell_length_a    ${c.a.toFixed(6)}`, `_cell_length_b    ${c.b.toFixed(6)}`, `_cell_length_c    ${c.c.toFixed(6)}`,
      `_cell_angle_alpha ${c.alpha.toFixed(4)}`, `_cell_angle_beta  ${c.beta.toFixed(4)}`, `_cell_angle_gamma ${c.gamma.toFixed(4)}`, `_cell_volume      ${c.volume.toFixed(4)}`,
      'loop_', '_symmetry_equiv_pos_as_xyz', "  'x, y, z'", 'loop_', '_atom_site_label', '_atom_site_type_symbol', '_atom_site_fract_x', '_atom_site_fract_y', '_atom_site_fract_z', '_atom_site_occupancy'];
    for (const a of fr.atoms) {
      count[a.el] = (count[a.el] || 0) + 1;
      const f = cartToFrac(P(a), fr.cell, inv);
      L.push(`  ${(a.el + count[a.el]).padEnd(6)} ${a.el.padEnd(2)} ${f.map((v) => v.toFixed(6).padStart(10)).join(' ')}  1.0`);
    }
    return L.join('\n') + '\n';
  }
  function writePoscar(fr, opts = {}) {
    if (!fr.cell) throw new Error('poscar:nocell');
    const order = [...new Set(fr.atoms.map((a) => a.el))];
    const sorted = order.flatMap((el) => fr.atoms.filter((a) => a.el === el));
    const inv = inv3(fr.cell), sel = sorted.some((a) => a.frozen);
    const L = [String(opts.title || 'MolAstria workbench'), '1.0', ...fr.cell.map((v) => v.map((x) => x.toFixed(10).padStart(16)).join('')),
      order.map((e) => e.padStart(5)).join(''), order.map((e) => String(sorted.filter((a) => a.el === e).length).padStart(5)).join('')];
    if (sel) L.push('Selective dynamics');
    L.push('Direct');
    for (const a of sorted) L.push(cartToFrac(P(a), fr.cell, inv).map((v) => wrap01(v).toFixed(10).padStart(16)).join('') + (sel ? (a.frozen ? '   F   F   F' : '   T   T   T') : ''));
    return L.join('\n') + '\n';
  }
  /** Gaussian 输入（只有结构部分和一行 route；完整的方法设置请用开源代码台）。冻结的原子写 −1，晶胞写 Tv。 */
  function writeGjf(fr, opts = {}) {
    const name = String(opts.name || 'mol').replace(/[^\w.-]+/g, '_');
    const frozen = fr.atoms.some((a) => a.frozen);
    const L = [`%chk=${name}.chk`, `%nprocshared=${opts.cores || 8}`, `%mem=${opts.mem || '8GB'}`, opts.route || '# opt B3LYP/def2SVP', '', String(opts.title || 'MolAstria workbench'), '', `${opts.charge ?? 0} ${opts.mult ?? 1}`];
    for (const a of fr.atoms) L.push(`${a.el.padEnd(2)}${frozen ? (a.frozen ? ' -1' : '  0') : ''} ${f6(a.x)} ${f6(a.y)} ${f6(a.z)}`);
    if (fr.cell) for (const v of fr.cell) L.push(`Tv ${f6(v[0])} ${f6(v[1])} ${f6(v[2])}`);
    L.push('', '');
    return L.join('\n');
  }
  function writeOrcaXyz(fr, opts = {}) {
    return `${opts.header || '! B3LYP def2-SVP Opt'}\n\n* xyz ${opts.charge ?? 0} ${opts.mult ?? 1}\n${fr.atoms.map((a) => `${a.el.padEnd(2)} ${f6(a.x)} ${f6(a.y)} ${f6(a.z)}`).join('\n')}\n*\n`;
  }
  /** 写出：format ∈ xyz pdb mol(sdf) cif poscar gjf orca。frames 是整个列表，单帧格式只写当前这一帧（opts.frame）。 */
  function write(format, frames, opts = {}) {
    const fr = frames[Math.max(0, Math.min(frames.length - 1, opts.frame || 0))];
    switch (format) {
      case 'xyz': return writeXyz(opts.all ? frames : [fr], opts);
      case 'pdb': return writePdb(opts.all ? frames : [fr], opts);
      case 'mol': case 'sdf': return writeMol(opts.all ? frames : [fr], { ...opts, sdf: format === 'sdf' });
      case 'cif': return writeCif(fr, opts);
      case 'poscar': return writePoscar(fr, opts);
      case 'gjf': return writeGjf(fr, opts);
      case 'orca': return writeOrcaXyz(fr, opts);
      default: throw new Error(`write:${format}`);
    }
  }
  const EXT = { xyz: 'xyz', pdb: 'pdb', mol: 'mol', sdf: 'sdf', cif: 'cif', poscar: 'vasp', gjf: 'gjf', orca: 'inp' };

  // ── 晶体预设、超胞、表面 ─────────────────────────────────────────────
  const FCC = [[0, 0, 0], [0, 0.5, 0.5], [0.5, 0, 0.5], [0.5, 0.5, 0]];
  const BCC = [[0, 0, 0], [0.5, 0.5, 0.5]];
  const lattice = (centring, motif) => centring.flatMap((t) => motif.map(([el, x, y, z]) => [el, wrap01(x + t[0]), wrap01(y + t[1]), wrap01(z + t[2])]));
  // 晶格常数都是常温实验值（Å），出处写在名字后面的说明里（见 workbench.js 的预设表）。
  const PRESETS = {
    nacl: { zh: '岩盐型 NaCl', en: 'Rock-salt NaCl', p: [5.640], basis: lattice(FCC, [['Na', 0, 0, 0], ['Cl', 0.5, 0, 0]]) },
    mgo: { zh: '岩盐型 MgO', en: 'Rock-salt MgO', p: [4.212], basis: lattice(FCC, [['Mg', 0, 0, 0], ['O', 0.5, 0, 0]]) },
    cscl: { zh: 'CsCl 型', en: 'CsCl type', p: [4.123], basis: [['Cs', 0, 0, 0], ['Cl', 0.5, 0.5, 0.5]] },
    diamond: { zh: '金刚石', en: 'Diamond', p: [3.567], basis: lattice(FCC, [['C', 0, 0, 0], ['C', 0.25, 0.25, 0.25]]) },
    si: { zh: '硅（金刚石型）', en: 'Silicon (diamond type)', p: [5.431], basis: lattice(FCC, [['Si', 0, 0, 0], ['Si', 0.25, 0.25, 0.25]]) },
    gaas: { zh: '闪锌矿 GaAs', en: 'Zinc-blende GaAs', p: [5.653], basis: lattice(FCC, [['Ga', 0, 0, 0], ['As', 0.25, 0.25, 0.25]]) },
    caf2: { zh: '萤石 CaF₂', en: 'Fluorite CaF₂', p: [5.463], basis: lattice(FCC, [['Ca', 0, 0, 0], ['F', 0.25, 0.25, 0.25], ['F', 0.75, 0.75, 0.75]]) },
    cu: { zh: '铜（面心立方）', en: 'Copper (fcc)', p: [3.615], basis: lattice(FCC, [['Cu', 0, 0, 0]]) },
    au: { zh: '金（面心立方）', en: 'Gold (fcc)', p: [4.078], basis: lattice(FCC, [['Au', 0, 0, 0]]) },
    pt: { zh: '铂（面心立方）', en: 'Platinum (fcc)', p: [3.924], basis: lattice(FCC, [['Pt', 0, 0, 0]]) },
    al: { zh: '铝（面心立方）', en: 'Aluminium (fcc)', p: [4.050], basis: lattice(FCC, [['Al', 0, 0, 0]]) },
    fe: { zh: 'α-铁（体心立方）', en: 'α-Iron (bcc)', p: [2.8665], basis: lattice(BCC, [['Fe', 0, 0, 0]]) },
    batio3: { zh: '立方 BaTiO₃（钙钛矿）', en: 'Cubic BaTiO₃ (perovskite)', p: [4.00], basis: [['Ba', 0, 0, 0], ['Ti', 0.5, 0.5, 0.5], ['O', 0.5, 0.5, 0], ['O', 0.5, 0, 0.5], ['O', 0, 0.5, 0.5]] },
    srtio3: { zh: '立方 SrTiO₃（钙钛矿）', en: 'Cubic SrTiO₃ (perovskite)', p: [3.905], basis: [['Sr', 0, 0, 0], ['Ti', 0.5, 0.5, 0.5], ['O', 0.5, 0.5, 0], ['O', 0.5, 0, 0.5], ['O', 0, 0.5, 0.5]] },
    tio2: { zh: '金红石 TiO₂', en: 'Rutile TiO₂', p: [4.594, 4.594, 2.959], basis: (() => { const u = 0.305; return [['Ti', 0, 0, 0], ['Ti', 0.5, 0.5, 0.5], ['O', u, u, 0], ['O', 1 - u, 1 - u, 0], ['O', 0.5 + u, 0.5 - u, 0.5], ['O', 0.5 - u, 0.5 + u, 0.5]]; })() },
    zno: { zh: '纤锌矿 ZnO', en: 'Wurtzite ZnO', p: [3.250, 3.250, 5.207, 90, 90, 120], basis: (() => { const u = 0.382; return [['Zn', 1 / 3, 2 / 3, 0], ['Zn', 2 / 3, 1 / 3, 0.5], ['O', 1 / 3, 2 / 3, u], ['O', 2 / 3, 1 / 3, 0.5 + u]]; })() },
    graphite: { zh: '石墨（AB 堆积）', en: 'Graphite (AB stacking)', p: [2.464, 2.464, 6.711, 90, 90, 120], basis: [['C', 0, 0, 0.25], ['C', 0, 0, 0.75], ['C', 1 / 3, 2 / 3, 0.25], ['C', 2 / 3, 1 / 3, 0.75]] },
  };
  function crystal(id) {
    const p = PRESETS[id];
    if (!p) throw new Error(`preset:${id}`);
    const v = p.p.length === 1 ? [p.p[0], p.p[0], p.p[0], 90, 90, 90] : p.p.length === 3 ? [...p.p, 90, 90, 90] : p.p;
    const cell = cellFromParams(...v);
    return { atoms: p.basis.map(([el, ...f]) => atom(el, ...fracToCart(f, cell))), cell, energy: null, comment: p.en };
  }
  /** 超胞 na × nb × nc。冻结标记照抄。 */
  function supercell(fr, na = 1, nb = 1, nc = 1) {
    if (!fr.cell) throw new Error('supercell:nocell');
    const atoms = [];
    for (let i = 0; i < na; i++) for (let j = 0; j < nb; j++) for (let k = 0; k < nc; k++) {
      const t = fracToCart([i, j, k], fr.cell);
      for (const a of fr.atoms) atoms.push(atom(a.el, a.x + t[0], a.y + t[1], a.z + t[2], a.frozen ? { frozen: true } : null));
    }
    return { atoms, cell: [mul(fr.cell[0], na), mul(fr.cell[1], nb), mul(fr.cell[2], nc)], energy: null, comment: `${fr.comment || ''} ${na}x${nb}x${nc}`.trim() };
  }
  const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
  /**
   * 按密勒指数 (h k l) 切表面：在整数格矢里找两条面内的最短格矢 v1、v2（叉积正好是 (h,k,l)/g，保证是这层面的原胞）、
   * 一条出面的 v3（(h,k,l)/g · v3 = 1），原子换到新晶胞里叠 layers 层，再把面转到 xy 平面、法线沿 z，上下加真空。
   * opts: { layers = 4, vacuum = 15（Å）, repeat: [ra, rb] 面内超胞, fixBottom: 冻结最下面几层 }。
   */
  function slab(fr, hkl, opts = {}) {
    if (!fr.cell) throw new Error('slab:nocell');
    let [h, k, l] = hkl.map((v) => Math.round(Number(v) || 0));
    const g = gcd(gcd(h, k), l);
    if (!g) throw new Error('slab:hkl');
    h /= g; k /= g; l /= g;
    const layers = Math.max(1, Math.min(30, Math.round(opts.layers || 4)));
    const vacuum = Math.max(0, Number(opts.vacuum ?? 15));
    const A = fr.cell, N = 6;
    const cart = (v) => fracToCart(v, A);
    const inPlane = [];
    for (let a = -N; a <= N; a++) for (let b = -N; b <= N; b++) for (let c = -N; c <= N; c++) {
      if ((a || b || c) && h * a + k * b + l * c === 0) inPlane.push([a, b, c]);
    }
    inPlane.sort((u, v) => norm(cart(u)) - norm(cart(v)));
    let v1 = null, v2 = null;
    const target = [h, k, l];
    outer: for (let i = 0; i < inPlane.length; i++) for (let j = i + 1; j < inPlane.length; j++) {
      const c = cross(inPlane[i], inPlane[j]);
      if ((c[0] === target[0] && c[1] === target[1] && c[2] === target[2]) || (c[0] === -target[0] && c[1] === -target[1] && c[2] === -target[2])) {
        v1 = inPlane[i]; v2 = inPlane[j];
        if (c[0] !== target[0] || c[1] !== target[1] || c[2] !== target[2]) v2 = v2.map((x) => -x);
        break outer;
      }
    }
    if (!v1) throw new Error('slab:basis');
    let v3 = null, best = Infinity;
    const nrm = cross(cart(v1), cart(v2)), nhat = mul(nrm, 1 / norm(nrm));
    for (let a = -N; a <= N; a++) for (let b = -N; b <= N; b++) for (let c = -N; c <= N; c++) {
      if (h * a + k * b + l * c !== 1) continue;
      const p = cart([a, b, c]), along = dot(p, nhat), off = norm(sub(p, mul(nhat, along)));
      if (along > 0 && off + 1e-6 * norm(p) < best) { best = off + 1e-6 * norm(p); v3 = [a, b, c]; }
    }
    if (!v3) throw new Error('slab:v3');
    const B = [cart(v1), cart(v2), cart(v3)], inv = inv3(B);
    const d = Math.abs(det3(B)) / norm(nrm); // 层间距
    // 新坐标系：e1 沿 v1，e3 沿法线，e2 = e3 × e1
    const e1 = mul(B[0], 1 / norm(B[0])), e3 = nhat, e2 = cross(e3, e1);
    const rot = (p) => [dot(p, e1), dot(p, e2), dot(p, e3)];
    const base = fr.atoms.map((a) => ({ el: a.el, f: cartToFrac(P(a), B, inv).map(wrap01) }));
    // 一个 v3 重复单元里可能有好几层原子面（比如面心立方的 (100)），所以多叠几份，再只留最下面 layers 层原子面
    let atoms = [];
    for (let L = 0; L < layers; L++) for (const a of base) {
      const p = rot(fracToCart([a.f[0], a.f[1], a.f[2] + L], B));
      atoms.push({ el: a.el, x: p[0], y: p[1], z: p[2] });
    }
    const planes = [];
    for (const z of atoms.map((a) => a.z).sort((x, y) => x - y)) if (!planes.length || z - planes[planes.length - 1] > 0.05) planes.push(z);
    if (planes.length > layers) { const top = planes[layers - 1] + 0.05; atoms = atoms.filter((a) => a.z <= top); }
    const a2 = [rot(B[0]), rot(B[1])];
    // 面内包回原胞
    const cell2 = [a2[0], a2[1], [0, 0, 1]], inv2 = inv3(cell2);
    for (const a of atoms) {
      const f = cartToFrac([a.x, a.y, 0], cell2, inv2).map(wrap01);
      const p = fracToCart([f[0], f[1], 0], cell2);
      a.x = p[0]; a.y = p[1];
    }
    const zmin = Math.min(...atoms.map((a) => a.z)), zmax = Math.max(...atoms.map((a) => a.z));
    const thick = zmax - zmin, cz = thick + vacuum;
    for (const a of atoms) a.z = a.z - zmin + vacuum / 2;
    let out = { atoms: atoms.map((a) => atom(a.el, a.x, a.y, a.z)), cell: [[...a2[0].slice(0, 2), 0], [...a2[1].slice(0, 2), 0], [0, 0, cz || 10]], energy: null, comment: `(${hkl.join(' ')}) slab, ${layers} layers` };
    const [ra, rb] = opts.repeat || [1, 1];
    if (ra > 1 || rb > 1) out = supercell(out, ra, rb, 1);
    if (opts.fixBottom > 0) {
      const zs = [...new Set(out.atoms.map((a) => Math.round(a.z * 20) / 20))].sort((x, y) => x - y);
      const cut = zs[Math.min(zs.length - 1, Math.round(opts.fixBottom) - 1)];
      for (const a of out.atoms) if (a.z <= cut + 0.026) a.frozen = true;
    }
    out.comment = `(${hkl.join(' ')}) slab, ${layers} layers, d = ${d.toFixed(4)} A, vacuum ${vacuum} A`;
    out.d = d;
    out.vectors = { v1, v2, v3 };
    return out;
  }

  // ── 几何 ─────────────────────────────────────────────────────────────
  const D2R = 180 / Math.PI;
  /** 原子 i、j（从 0 开始）的距离，有晶胞时取最近像。 */
  function distance(atoms, i, j, cell = null) {
    let d = sub(P(atoms[j]), P(atoms[i]));
    if (cell) { d = fracToCart(cartToFrac(d, cell).map((v) => v - Math.round(v)), cell); }
    return norm(d);
  }
  function angle(atoms, i, j, k) {
    const a = sub(P(atoms[i]), P(atoms[j])), b = sub(P(atoms[k]), P(atoms[j]));
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b) / (norm(a) * norm(b))))) * D2R;
  }
  /** 二面角 i-j-k-l（度，−180…180，IUPAC 符号约定）。 */
  function dihedral(atoms, i, j, k, l) {
    const b0 = sub(P(atoms[i]), P(atoms[j])), b1 = sub(P(atoms[k]), P(atoms[j])), b2 = sub(P(atoms[l]), P(atoms[k]));
    const n1 = norm(b1), u = mul(b1, 1 / n1);
    const v = sub(b0, mul(u, dot(b0, u))), w = sub(b2, mul(u, dot(b2, u)));
    return Math.atan2(dot(cross(u, v), w), dot(v, w)) * D2R;
  }
  /** 按选中的原子数量量出一个内坐标：2 个是键长，3 个是键角，4 个是二面角。 */
  function measure(atoms, picks, cell = null) {
    const [i, j, k, l] = picks;
    if (picks.length === 2) return { type: 'bond', value: distance(atoms, i, j, cell), unit: 'Å' };
    if (picks.length === 3) return { type: 'angle', value: angle(atoms, i, j, k), unit: '°' };
    if (picks.length === 4) return { type: 'dihedral', value: dihedral(atoms, i, j, k, l), unit: '°' };
    return null;
  }
  const centroid = (pts) => { const c = [0, 0, 0]; for (const p of pts) { c[0] += p[0]; c[1] += p[1]; c[2] += p[2]; } return mul(c, 1 / pts.length); };

  /** 对称 4×4 矩阵的最大本征值和本征向量（Jacobi 旋转）。 */
  function jacobi4(M) {
    const a = M.map((r) => r.slice()), v = [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    for (let sweep = 0; sweep < 60; sweep++) {
      let off = 0;
      for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) off += a[p][q] * a[p][q];
      if (off < 1e-22) break;
      for (let p = 0; p < 4; p++) for (let q = p + 1; q < 4; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let r = 0; r < 4; r++) { const x = a[r][p], y = a[r][q]; a[r][p] = c * x - s * y; a[r][q] = s * x + c * y; }
        for (let r = 0; r < 4; r++) { const x = a[p][r], y = a[q][r]; a[p][r] = c * x - s * y; a[q][r] = s * x + c * y; }
        for (let r = 0; r < 4; r++) { const x = v[r][p], y = v[r][q]; v[r][p] = c * x - s * y; v[r][q] = s * x + c * y; }
      }
    }
    let k = 0;
    for (let i = 1; i < 4; i++) if (a[i][i] > a[k][k]) k = i;
    return { value: a[k][k], vector: [v[0][k], v[1][k], v[2][k], v[3][k]] };
  }
  /**
   * 把 mobile 叠到 ref 上（最优旋转 + 平移，Horn 1987 的四元数法，和 Kabsch 1976 等价）。
   * ref、mobile：[[x,y,z]]，等长、一一对应；weights 可选。返回 { rmsd, rot（3×3，行向量右乘）, apply(pts) }。
   */
  function superpose(ref, mobile, weights = null) {
    const n = ref.length;
    if (!n || n !== mobile.length) throw new Error('superpose:length');
    const w = weights || ref.map(() => 1), W = w.reduce((s, x) => s + x, 0);
    const cr = [0, 0, 0], cm = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let d = 0; d < 3; d++) { cr[d] += w[i] * ref[i][d] / W; cm[d] += w[i] * mobile[i][d] / W; }
    const S = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
    let e0 = 0;
    for (let i = 0; i < n; i++) {
      const x = sub(mobile[i], cm), y = sub(ref[i], cr);
      e0 += w[i] * (dot(x, x) + dot(y, y));
      for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) S[a][b] += w[i] * x[a] * y[b];
    }
    const [[Sxx, Sxy, Sxz], [Syx, Syy, Syz], [Szx, Szy, Szz]] = S;
    const N = [[Sxx + Syy + Szz, Syz - Szy, Szx - Sxz, Sxy - Syx], [Syz - Szy, Sxx - Syy - Szz, Sxy + Syx, Szx + Sxz],
      [Szx - Sxz, Sxy + Syx, -Sxx + Syy - Szz, Syz + Szy], [Sxy - Syx, Szx + Sxz, Syz + Szy, -Sxx - Syy + Szz]];
    const { value, vector: [q0, q1, q2, q3] } = jacobi4(N);
    const rmsd = Math.sqrt(Math.max(0, (e0 - 2 * value) / W));
    // 旋转矩阵（列向量形式 R·x），这里存成行向量右乘用的转置
    const R = [[q0 * q0 + q1 * q1 - q2 * q2 - q3 * q3, 2 * (q1 * q2 - q0 * q3), 2 * (q1 * q3 + q0 * q2)],
      [2 * (q1 * q2 + q0 * q3), q0 * q0 - q1 * q1 + q2 * q2 - q3 * q3, 2 * (q2 * q3 - q0 * q1)],
      [2 * (q1 * q3 - q0 * q2), 2 * (q2 * q3 + q0 * q1), q0 * q0 - q1 * q1 - q2 * q2 + q3 * q3]];
    const apply = (pts) => pts.map((p) => { const x = sub(p, cm); return add([dot(R[0], x), dot(R[1], x), dot(R[2], x)], cr); });
    return { rmsd, rot: R, apply };
  }
  const rmsdOf = (A, B) => Math.sqrt(A.reduce((s, p, i) => s + dot(sub(p, B[i]), sub(p, B[i])), 0) / A.length);

  /** 匈牙利算法（最小代价完全匹配），cost 是 n×n。返回 assign[i] = j。 */
  function hungarian(cost) {
    const n = cost.length, INF = 1e18;
    const u = new Array(n + 1).fill(0), v = new Array(n + 1).fill(0), p = new Array(n + 1).fill(0), way = new Array(n + 1).fill(0);
    for (let i = 1; i <= n; i++) {
      p[0] = i;
      let j0 = 0;
      const minv = new Array(n + 1).fill(INF), used = new Array(n + 1).fill(false);
      do {
        used[j0] = true;
        const i0 = p[j0];
        let delta = INF, j1 = 0;
        for (let j = 1; j <= n; j++) {
          if (used[j]) continue;
          const cur = cost[i0 - 1][j - 1] - u[i0] - v[j];
          if (cur < minv[j]) { minv[j] = cur; way[j] = j0; }
          if (minv[j] < delta) { delta = minv[j]; j1 = j; }
        }
        for (let j = 0; j <= n; j++) { if (used[j]) { u[p[j]] += delta; v[j] -= delta; } else minv[j] -= delta; }
        j0 = j1;
      } while (p[j0] !== 0);
      do { const j1 = way[j0]; p[j0] = p[j1]; j0 = j1; } while (j0);
    }
    const assign = new Array(n);
    for (let j = 1; j <= n; j++) if (p[j]) assign[p[j] - 1] = j - 1;
    return assign;
  }

  /** 对称 3×3 矩阵的本征分解（Jacobi 旋转）。返回 { values（从大到小）, vectors（对应的列向量，[[x,y,z]]） }。 */
  function eigSym3(M) {
    const a = M.map((r) => r.slice()), v = [[1, 0, 0], [0, 1, 0], [0, 0, 1]];
    for (let sweep = 0; sweep < 50; sweep++) {
      const off = a[0][1] ** 2 + a[0][2] ** 2 + a[1][2] ** 2;
      if (off < 1e-24 * (1 + a[0][0] ** 2 + a[1][1] ** 2 + a[2][2] ** 2)) break;
      for (let p = 0; p < 3; p++) for (let q = p + 1; q < 3; q++) {
        if (Math.abs(a[p][q]) < 1e-300) continue;
        const th = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = Math.sign(th || 1) / (Math.abs(th) + Math.sqrt(th * th + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let r = 0; r < 3; r++) { const x = a[r][p], y = a[r][q]; a[r][p] = c * x - s * y; a[r][q] = s * x + c * y; }
        for (let r = 0; r < 3; r++) { const x = a[p][r], y = a[q][r]; a[p][r] = c * x - s * y; a[q][r] = s * x + c * y; }
        for (let r = 0; r < 3; r++) { const x = v[r][p], y = v[r][q]; v[r][p] = c * x - s * y; v[r][q] = s * x + c * y; }
      }
    }
    const idx = [0, 1, 2].sort((i, j) => a[j][j] - a[i][i]);
    return { values: idx.map((k) => a[k][k]), vectors: idx.map((k) => [v[0][k], v[1][k], v[2][k]]) };
  }

  /**
   * 两个结构的原子对应（反应物和产物、两个构象）：只在同种元素之间对，叠合 → 按距离的平方做最优匹配 → 再叠合，最多重复 8 轮。
   * 一个起点容易落进局部最优（两个单体整个换了位置时就是这样），所以从几个起点出发、取 RMSD 最小的：原来的顺序（或按元素依次配上），
   * 以及把两边的主轴（按原子序数加权的二阶矩）对齐的四种转法（主轴的正负号只差一个真转动）。
   * 返回 { ok, order（B 的第 order[i] 个原子对应 A 的第 i 个）, rmsd, changed（顺序是否变了）, why }。
   */
  function mapAtoms(A, B, opts = {}) {
    if (A.length !== B.length) return { ok: false, why: 'count' };
    const els = (X) => X.map((a) => a.el).slice().sort().join(',');
    if (els(A) !== els(B)) return { ok: false, why: 'elements' };
    const pa = A.map(P), pbAll = B.map(P), kinds = [...new Set(A.map((a) => a.el))];
    // 把 B 的点（已经摆到 A 的坐标系里）按元素做最优匹配
    const assign = (moved) => {
      const next = new Array(A.length);
      for (const el of kinds) {
        const ia = A.map((a, i) => (a.el === el ? i : -1)).filter((i) => i >= 0);
        const jb = B.map((b, j) => (b.el === el ? j : -1)).filter((j) => j >= 0);
        const cost = ia.map((i) => jb.map((j) => { const d = sub(pa[i], moved[j]); return dot(d, d); }));
        const as = hungarian(cost);
        ia.forEach((i, k) => { next[i] = jb[as[k]]; });
      }
      return next;
    };
    const refine = (order) => {
      let best = null;
      for (let round = 0; round < (opts.rounds || 8); round++) {
        const fit = superpose(pa, order.map((j) => pbAll[j]));
        const next = assign(fit.apply(pbAll));
        const r = superpose(pa, next.map((j) => pbAll[j])).rmsd;
        if (!best || r < best.rmsd - 1e-9) best = { order: next.slice(), rmsd: r };
        if (next.every((j, i) => j === order[i])) break;
        order = next;
      }
      return best;
    };
    const starts = [];
    if (A.every((a, i) => a.el === B[i].el)) starts.push(A.map((_, i) => i));
    else { // 按元素依次配上
      const pool = {};
      B.forEach((b, j) => (pool[b.el] = pool[b.el] || []).push(j));
      starts.push(A.map((a) => pool[a.el].shift()));
    }
    if (A.length >= 3) {
      // 主轴：按原子序数加权的二阶矩的本征向量（两边元素组成相同，总权重一样）
      const frame = (pts, X) => {
        const w = X.map((a) => ZOF[a.el] || 1), W = w.reduce((t, x) => t + x, 0), c = [0, 0, 0];
        pts.forEach((p, i) => { for (let d = 0; d < 3; d++) c[d] += (w[i] * p[d]) / W; });
        const M = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
        pts.forEach((p, i) => { const x = sub(p, c); for (let r = 0; r < 3; r++) for (let q = 0; q < 3; q++) M[r][q] += w[i] * x[r] * x[q]; });
        return { c, E: eigSym3(M).vectors };
      };
      const fa = frame(pa, A), fb = frame(pbAll, B);
      const det = (E) => dot(E[0], [E[1][1] * E[2][2] - E[1][2] * E[2][1], E[1][2] * E[2][0] - E[1][0] * E[2][2], E[1][0] * E[2][1] - E[1][1] * E[2][0]]);
      const sgn = det(fa.E) * det(fb.E) > 0 ? 1 : -1;
      for (const [s1, s2] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
        const s = [s1, s2, s1 * s2 * sgn];
        // b 在 B 主轴上的分量 → 乘上正负号 → 放到 A 的主轴上
        const moved = pbAll.map((p) => { const x = sub(p, fb.c), u = fb.E.map((e, k) => s[k] * dot(e, x)); return add(fa.c, add(add(mul(fa.E[0], u[0]), mul(fa.E[1], u[1])), mul(fa.E[2], u[2]))); });
        starts.push(assign(moved));
      }
    }
    let best = null;
    for (const st of starts) { const r = refine(st); if (!best || r.rmsd < best.rmsd - 1e-9) best = r; }
    return { ok: true, order: best.order, rmsd: best.rmsd, changed: best.order.some((j, i) => j !== i) };
  }

  /**
   * IDPP 初始路径（Smidstrup, Pedersen, Stokbro & Jónsson, J. Chem. Phys. 2014, 140, 214106）：
   * 每个中间像的目标原子间距是两端距离的线性插值 d_ij(k)，目标函数 S = Σ (d_ij(k) − |r_i − r_j|)² / |r_i − r_j|⁴，
   * 从线性插值出发，像和像之间用 NEB 的做法（只用垂直于路径切线的力，加沿切线的弹簧力）一起优化。
   * A、B：等长、同序的原子；返回 { frames: [[atom]]（含两端）, iterations, fmax, minDist: 每帧最近的两原子距离 }。
   */
  function idpp(A, B, opts = {}) {
    const n = A.length;
    if (n !== B.length) throw new Error('idpp:count');
    const nim = Math.max(1, Math.min(30, Math.round(opts.images ?? 8)));
    const steps = opts.steps ?? 1500, kspring = opts.k ?? 1.0, tol = opts.fmax ?? 5e-3, maxMove = 0.05;
    const pa = A.map(P), pb = superpose(pa, B.map(P)).apply(B.map(P)); // 先把 B 叠到 A 上，去掉整体转动
    const dA = [], dB = [];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) { dA.push(norm(sub(pa[i], pa[j]))); dB.push(norm(sub(pb[i], pb[j]))); }
    const imgs = [];
    for (let k = 0; k <= nim + 1; k++) { const t = k / (nim + 1); imgs.push(pa.map((p, i) => add(mul(p, 1 - t), mul(pb[i], t)))); }
    const grad = (X, t) => { // ∂S/∂r
      const g = X.map(() => [0, 0, 0]);
      let q = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++, q++) {
        const target = dA[q] * (1 - t) + dB[q] * t;
        const r = sub(X[i], X[j]), d = Math.max(norm(r), 0.1);
        // S_ij = (target − d)² d⁻⁴ ;  dS/dd = −2(target − d) d⁻⁴ − 4 (target − d)² d⁻⁵
        const dS = -2 * (target - d) / d ** 4 - 4 * (target - d) ** 2 / d ** 5;
        const v = mul(r, dS / d);
        g[i] = add(g[i], v); g[j] = sub(g[j], v);
      }
      return g;
    };
    let it = 0, fmax = Infinity;
    const vel = imgs.map((X) => X.map(() => [0, 0, 0]));
    for (; it < steps; it++) {
      fmax = 0;
      const forces = [];
      for (let k = 1; k <= nim; k++) {
        const t = k / (nim + 1);
        const g = grad(imgs[k], t);
        let tau = imgs[k + 1].map((p, i) => sub(p, imgs[k - 1][i]));
        const tn = Math.sqrt(tau.reduce((s, v) => s + dot(v, v), 0)) || 1;
        tau = tau.map((v) => mul(v, 1 / tn));
        const fdot = -g.reduce((s, v, i) => s + dot(v, tau[i]), 0);
        const dn = Math.sqrt(imgs[k + 1].reduce((s, p, i) => s + dot(sub(p, imgs[k][i]), sub(p, imgs[k][i])), 0));
        const dp = Math.sqrt(imgs[k].reduce((s, p, i) => s + dot(sub(p, imgs[k - 1][i]), sub(p, imgs[k - 1][i])), 0));
        const fs = kspring * (dn - dp);
        const F = g.map((v, i) => add(sub(mul(v, -1), mul(tau[i], fdot)), mul(tau[i], fs)));
        for (const v of F) fmax = Math.max(fmax, norm(v));
        forces.push(F);
      }
      if (fmax < tol) break;
      // 简单的速度投影步进（quick-min），每步位移不超过 0.05 Å
      for (let k = 1; k <= nim; k++) {
        const F = forces[k - 1], V = vel[k];
        const vf = V.reduce((s, v, i) => s + dot(v, F[i]), 0), ff = F.reduce((s, v) => s + dot(v, v), 0) || 1;
        for (let i = 0; i < n; i++) V[i] = vf > 0 ? mul(F[i], vf / ff) : [0, 0, 0];
        for (let i = 0; i < n; i++) {
          V[i] = add(V[i], mul(F[i], 0.02));
          let step = mul(V[i], 0.1);
          const s = norm(step);
          if (s > maxMove) step = mul(step, maxMove / s);
          imgs[k][i] = add(imgs[k][i], step);
        }
      }
    }
    const minDist = imgs.map((X) => { let m = Infinity; for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) m = Math.min(m, norm(sub(X[i], X[j]))); return m; });
    const frames = imgs.map((X) => X.map((p, i) => atom(A[i].el, ...p)));
    return { frames, iterations: it, fmax, minDist };
  }
  /** 同样的端点，纯线性插值（对照用）。 */
  function linearPath(A, B, images = 8) {
    const pa = A.map(P), pb = superpose(pa, B.map(P)).apply(B.map(P));
    const out = [];
    for (let k = 0; k <= images + 1; k++) { const t = k / (images + 1); out.push(pa.map((p, i) => atom(A[i].el, ...add(mul(p, 1 - t), mul(pb[i], t))))); }
    return out;
  }

  // ── 构象系综 ─────────────────────────────────────────────────────────
  const toKcal = (e, unit) => (unit === 'kcal' ? e : unit === 'kj' ? e / 4.184 : unit === 'ev' ? e * (HARTREE_KCAL / HARTREE_EV) : e * HARTREE_KCAL);
  /** Boltzmann 布居：能量（任意零点，单位 unit）→ 相对能量（kcal/mol）和布居（和为 1）。T 默认 298.15 K。
      注意这是电子能（或力场能）的布居，不是自由能布居。 */
  function boltzmann(energies, unit = 'eh', T = 298.15) {
    const kc = energies.map((e) => toKcal(e, unit));
    const min = Math.min(...kc.filter(Number.isFinite));
    const rel = kc.map((e) => e - min);
    const w = rel.map((e) => (Number.isFinite(e) ? Math.exp(-e / (KB_KCAL * T)) : 0));
    const Z = w.reduce((s, x) => s + x, 0) || 1;
    return { rel, pop: w.map((x) => x / Z), weight: w }; // weight：最低的那个是 1
  }
  /**
   * 构象归簇：按能量从低到高，每个构象和已有各簇的代表（簇里能量最低的）比 RMSD（叠合后），小于阈值就归进去。
   * opts: { rmsd = 0.5 Å, heavy = true（只比重原子）, permute = false（同种元素之间按最优对应比，近似处理对称等价的原子）,
   *         window = Infinity（kcal/mol，超出能量窗的丢掉）, unit, T }。
   * 返回 { clusters: [{ rep, members, rel, pop }], kept, dropped }，rep / members 是输入里的下标。
   */
  function clusterConformers(frames, opts = {}) {
    const thr = opts.rmsd ?? 0.5, heavy = opts.heavy !== false;
    const E = frames.map((f) => (Number.isFinite(f.energy) ? f.energy : NaN));
    const hasE = E.some(Number.isFinite);
    const bz = hasE ? boltzmann(E.map((e) => (Number.isFinite(e) ? e : Infinity)), opts.unit || 'eh', opts.T || 298.15) : { rel: E.map(() => 0) };
    const idx = frames.map((_, i) => i).filter((i) => !hasE || bz.rel[i] <= (opts.window ?? Infinity));
    const dropped = frames.length - idx.length;
    idx.sort((a, b) => (bz.rel[a] - bz.rel[b]) || a - b);
    const sel = (f) => f.atoms.filter((a) => !heavy || a.el !== 'H');
    const reps = [];
    for (const i of idx) {
      const Ai = sel(frames[i]);
      let home = null;
      for (const c of reps) {
        const Ar = sel(frames[c.rep]);
        if (Ar.length !== Ai.length) continue;
        let r;
        if (opts.permute) { const m = mapAtoms(Ar, Ai, { rounds: 4 }); r = m.ok ? m.rmsd : Infinity; }
        else r = superpose(Ar.map(P), Ai.map(P)).rmsd;
        if (r < thr) { home = c; c.rmsds.push(r); break; }
      }
      if (home) home.members.push(i); else reps.push({ rep: i, members: [i], rmsds: [0] });
    }
    // 簇的布居 = 成员布居之和（按全部保留的构象归一化）
    const keptE = idx.map((i) => E[i]);
    const b2 = hasE ? boltzmann(keptE, opts.unit || 'eh', opts.T || 298.15) : null;
    const popOf = new Map(idx.map((i, k) => [i, b2 ? b2.pop[k] : 1 / idx.length]));
    const clusters = reps.map((c) => ({ rep: c.rep, members: c.members, rel: hasE ? bz.rel[c.rep] : null, pop: c.members.reduce((s, i) => s + popOf.get(i), 0), maxRmsd: Math.max(...c.rmsds) }));
    return { clusters, kept: idx.length, dropped, hasEnergy: hasE };
  }

  // ── 键级和 R/S、E/Z ─────────────────────────────────────────────────
  // 只有坐标时先推键级：每个原子按元素取最低的、不小于成键数的常见价态，差几就要几个“多出来的键级”，
  // 在相邻的原子之间分配（短的键优先，回溯求恰好满足；芳环会得到一种凯库勒式，对 CIP 没有影响）。
  // 带电的写法只认几种常见的：四配位 N⁺、硝基和 N-氧化物（N⁺–O⁻）、分配不完的端位 O / S 当作负离子、
  // 结构总电荷为正时三配位 N 可以是 N⁺（吡啶鎓、亚胺鎓）。推出的形式电荷之和要等于给定的总电荷，否则不标。
  const VALENCE = { H: [1], B: [3], C: [4], N: [3], O: [2], F: [1], Si: [4], P: [3, 5], S: [2, 4, 6], Cl: [1], Br: [1], I: [1], Se: [2, 4, 6] };
  /** 返回 { ok, orders: [[i, j, 1|2|3]], charges: [形式电荷], why }。why ∈ elements | valence | charge | search。 */
  function bondOrders(atoms, bondList = bonds(atoms), charge = 0) {
    const n = atoms.length;
    if (!n) return { ok: false, why: 'elements' };
    if (atoms.some((a) => !VALENCE[a.el])) return { ok: false, why: 'elements' };
    const adj = atoms.map(() => []);
    bondList.forEach(([i, j], k) => { adj[i].push(k); adj[j].push(k); });
    const deg = adj.map((a) => a.length);
    const other = (k, i) => (bondList[k][0] === i ? bondList[k][1] : bondList[k][0]);
    const q = new Array(n).fill(0), v = new Array(n);
    const terminalO = (i) => adj[i].map((k) => other(k, i)).filter((j) => (atoms[j].el === 'O' || atoms[j].el === 'S') && deg[j] === 1);
    for (let i = 0; i < n; i++) {
      const a = atoms[i].el;
      if (a === 'N' && deg[i] === 4) { q[i] = 1; v[i] = 4; for (const j of terminalO(i).slice(0, 1)) { q[j] = -1; v[j] = 1; } continue; }
      if (a === 'N' && deg[i] === 3 && terminalO(i).length) { q[i] = 1; v[i] = 4; const j = terminalO(i)[0]; q[j] = -1; v[j] = 1; continue; }
    }
    for (let i = 0; i < n; i++) {
      if (v[i] !== undefined) continue;
      const opts = VALENCE[atoms[i].el].filter((x) => x >= deg[i]);
      if (!opts.length) return { ok: false, why: 'valence' };
      v[i] = opts[0];
    }
    // 键长和“单键长度”（共价半径之和）的比，越小越像多重键
    const ratio = bondList.map(([i, j, d]) => (d ?? distance(atoms, i, j)) / (cov(atoms[i].el) + cov(atoms[j].el)));
    const LIMIT = 200000;
    function solve(need) {
      const res = need.slice(), ord = new Int8Array(bondList.length);
      let best = null, bestDef = Infinity, steps = 0;
      const options = (i) => adj[i].filter((k) => ord[k] < 2 && res[other(k, i)] > 0).sort((a, b) => ratio[a] - ratio[b]);
      function rec(skip) {
        if (++steps > LIMIT || bestDef === 0) return;
        let pick = -1, po = null;
        for (let i = 0; i < n; i++) {
          if (res[i] <= 0 || skip.has(i)) continue;
          const o = options(i);
          if (!o.length) continue;
          if (!po || o.length < po.length) { pick = i; po = o; if (o.length === 1) break; }
        }
        if (pick < 0) { const def = res.reduce((s, x) => s + Math.max(0, x), 0); if (def < bestDef) { bestDef = def; best = ord.slice(); } return; }
        for (const k of po) {
          const j = other(k, pick);
          ord[k]++; res[pick]--; res[j]--;
          rec(skip);
          ord[k]--; res[pick]++; res[j]++;
          if (bestDef === 0 || steps > LIMIT) return;
        }
        skip.add(pick); rec(skip); skip.delete(pick); // 这个原子留着不满足（带电或自由基），看别的能不能都满足
      }
      rec(new Set());
      return { ord: best, def: bestDef, res: best ? need.map((x, i) => x - adj[i].reduce((s, k) => s + best[k], 0)) : need, timedOut: steps > LIMIT };
    }
    const need = v.map((x, i) => x - deg[i]);
    let r = solve(need);
    // 正电荷：三配位 N 依次试作 N⁺（多要一个键级）
    if (r.def > 0 && charge > q.reduce((s, x) => s + x, 0)) {
      const cand = atoms.map((a, i) => i).filter((i) => atoms[i].el === 'N' && deg[i] === 3 && q[i] === 0 && r.res[i] === 0);
      for (const i of cand.slice(0, 40)) {
        const need2 = need.slice(); need2[i] += 1;
        const r2 = solve(need2);
        if (r2.def < r.def) { r = r2; q[i] = 1; v[i] = 4; need[i] += 1; if (r.def === 0) break; }
      }
    }
    if (!r.ord) return { ok: false, why: r.timedOut ? 'search' : 'valence' };
    // 剩下的：端位 O / S 差一个键级 → −1；别的原子差键级说明推不出来
    for (let i = 0; i < n; i++) {
      if (r.res[i] <= 0) continue;
      if ((atoms[i].el === 'O' || atoms[i].el === 'S') && deg[i] === 1 && r.res[i] === 1) { q[i] -= 1; continue; }
      return { ok: false, why: r.timedOut ? 'search' : 'valence' };
    }
    if (q.reduce((s, x) => s + x, 0) !== Math.round(charge)) return { ok: false, why: 'charge', charges: q };
    return { ok: true, orders: bondList.map(([i, j], k) => [i, j, 1 + r.ord[k]]), charges: q };
  }
  /** 写一个带键级和形式电荷的 V2000 MOL 块（给 OpenChemLib / RDKit 读）。 */
  function molBlock(atoms, bo, title = 'molastria') {
    const f = (x) => x.toFixed(4).padStart(10);
    const L = [title.slice(0, 80), '  MolAstria workbench', '', `${String(atoms.length).padStart(3)}${String(bo.orders.length).padStart(3)}  0  0  0  0  0  0  0  0999 V2000`];
    for (const a of atoms) L.push(`${f(a.x)}${f(a.y)}${f(a.z)} ${a.el.padEnd(3)} 0  0  0  0  0  0  0  0  0  0  0  0`);
    for (const [i, j, o] of bo.orders) L.push(`${String(i + 1).padStart(3)}${String(j + 1).padStart(3)}${String(o).padStart(3)}  0`);
    const ch = bo.charges.map((c, i) => [i, c]).filter(([, c]) => c);
    for (let k = 0; k < ch.length; k += 8) { const part = ch.slice(k, k + 8); L.push(`M  CHG${String(part.length).padStart(3)}${part.map(([i, c]) => `${String(i + 1).padStart(4)}${String(c).padStart(4)}`).join('')}`); }
    L.push('M  END');
    return L.join('\n') + '\n';
  }
  /**
   * R/S 和 E/Z（只看三维坐标）。OCL 是 OpenChemLib 模块（浏览器里从 jsDelivr 载入，node 里是 npm 的 openchemlib）。
   * 返回 { ok, centres: [[原子, 'R'|'S']], bonds: [[i, j, 'E'|'Z']], unsure: 个数, why }；原子编号和输入一致。
   */
  function cipLabels(OCL, atoms, charge = 0, bondList = bonds(atoms)) {
    const bo = bondOrders(atoms, bondList, charge);
    if (!bo.ok) return { ok: false, why: bo.why, centres: [], bonds: [], unsure: 0 };
    const M = OCL.Molecule;
    const mol = M.fromMolfile(molBlock(atoms, bo));
    mol.ensureHelperArrays(M.cHelperCIP);
    if (mol.getAllAtoms() !== atoms.length) return { ok: false, why: 'ocl', centres: [], bonds: [], unsure: 0 };
    const centres = [], dbl = [];
    let unsure = 0;
    for (let i = 0; i < atoms.length; i++) {
      if (!mol.isAtomStereoCenter(i)) continue;
      const p = mol.getAtomCIPParity(i);
      if (p === M.cAtomCIPParityRorM) centres.push([i, 'R']);
      else if (p === M.cAtomCIPParitySorP) centres.push([i, 'S']);
      else if (p === M.cAtomCIPParityProblem) unsure++;
    }
    for (let b = 0; b < mol.getAllBonds(); b++) {
      if (mol.getBondOrder(b) !== 2) continue;
      const p = mol.getBondCIPParity(b);
      const i = mol.getBondAtom(0, b), j = mol.getBondAtom(1, b);
      if (p === M.cBondCIPParityEorP) dbl.push([Math.min(i, j), Math.max(i, j), 'E']);
      else if (p === M.cBondCIPParityZorM) dbl.push([Math.min(i, j), Math.max(i, j), 'Z']);
      else if (p === M.cBondCIPParityProblem) unsure++;
    }
    return { ok: true, centres, bonds: dbl, unsure, charges: bo.charges };
  }

  const pure = {
    SYMBOLS, ZOF, BOHR, HARTREE_KCAL, HARTREE_EV, HARTREE_KJ, COV, VDW, cov, vdw, element, FORMATS, EXT,
    cellFromParams, cellParams, inv3, fracToCart, cartToFrac, bonds, fragments,
    detectFormat, commentEnergy, parseAny, cdxmlToMol, symop, write, writeXyz, writePdb, writeMol, writeCif, writePoscar, writeGjf,
    PRESETS, crystal, supercell, slab, distance, angle, dihedral, measure, centroid, superpose, rmsdOf, hungarian, eigSym3, mapAtoms, idpp, linearPath,
    boltzmann, clusterConformers, toKcal, VALENCE, bondOrders, molBlock, cipLabels,
  };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaWB = pure;
})(typeof self !== 'undefined' ? self : this);
