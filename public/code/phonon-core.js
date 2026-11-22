/* 开源代码台“声子”标签的纯逻辑（MolAstriaPhonon）：预设晶体、读 POSCAR / CIF（只为估算原子数和给出提示）、在线提交的
   请求体和花费、把结果整理成色散曲线、态密度和热学量的数据，CSV，以及一段在自己电脑上跑同样流程的 phonopy 脚本。
   不碰 DOM，也不发请求。
   在线部分由站长电脑上的 tools/uma-server/phonon_backend.py 执行：spglib 判空间群并标准化成惯用胞 → （可选）连晶胞一起
   优化、保持对称性 → phonopy 有限位移 → 力常数 → seekpath 的高对称路径上的色散、Γ 为中心的网格上的态密度和热学量。
   phonopy、spglib（BSD-3-Clause）和 seekpath（MIT）都只是在那边调用，没有拷贝它们的代码。上限和预设在三处是同一套
   （这里、phonon_backend.py、deploy/account-worker.js；tools/phonon-job-test.mjs 核对，本机装了 phonopy 时还真跑脚本）。 */
(function (root) {
  'use strict';

  const LIMITS = {
    maxText: 8000, // POSCAR / CIF 最多几个字符
    maxCellAtoms: 32, // 标准化之后的惯用胞最多几个原子
    maxSupercellAtoms: 216, // 超胞最多几个原子
    maxDisplacements: 48, // 按对称性约化后最多几个位移超胞（每个算一次力）
    supercellMax: 4, // 超胞每个方向最多乘几
    disp: [0.005, 0.05, 0.01], // 位移（Å）：最小、最大、默认
    mesh: [4, 32, 16], // 态密度和热学量的网格（每个方向）
    tmax: [100, 2000, 1000], // 热学量算到多少 K
  };
  const COST = 5; // 一次声子计算用掉在线计算的次数
  const IMAG_THZ = -0.05; // 比这个还低的频率算虚频（Γ 点的三个声学支约 1e-7 THz）
  const R = 8.314462618;
  const EMT_METALS = ['Al', 'Cu', 'Ag', 'Au', 'Ni', 'Pd', 'Pt'];

  // 预设：惯用立方胞、室温实验晶格常数（Å），和 phonon_backend.PRESETS 一致；atoms 是惯用胞里的原子数
  const PRESETS = [
    { id: 'Cu', name: '铜', kind: 'fcc', a: 3.615, atoms: 4 },
    { id: 'Al', name: '铝', kind: 'fcc', a: 4.05, atoms: 4 },
    { id: 'Ag', name: '银', kind: 'fcc', a: 4.086, atoms: 4 },
    { id: 'Au', name: '金', kind: 'fcc', a: 4.078, atoms: 4 },
    { id: 'Ni', name: '镍', kind: 'fcc', a: 3.524, atoms: 4 },
    { id: 'Pd', name: '钯', kind: 'fcc', a: 3.891, atoms: 4 },
    { id: 'Pt', name: '铂', kind: 'fcc', a: 3.924, atoms: 4 },
    { id: 'Si', name: '硅', kind: 'diamond', a: 5.431, atoms: 8 },
    { id: 'C', name: '金刚石', kind: 'diamond', a: 3.567, atoms: 8 },
    { id: 'NaCl', name: '氯化钠', kind: 'rocksalt', a: 5.64, atoms: 8 },
    { id: 'MgO', name: '氧化镁', kind: 'rocksalt', a: 4.212, atoms: 8 },
  ];
  const PRESET = Object.fromEntries(PRESETS.map((p) => [p.id, p]));
  for (const p of PRESETS) p.emt = EMT_METALS.includes(p.id);
  const KIND = { fcc: '面心立方（Fm-3m）', diamond: '金刚石结构（Fd-3m）', rocksalt: '岩盐结构（Fm-3m）' };

  // 计算力的引擎：在线模型 id、名字、说明、许可证
  const ENGINES = [
    { id: 'emt', model: 'phonopy-emt', name: 'EMT（ASE 自带，CPU）', emtOnly: true, license: 'LGPL-2.1（ASE）',
      note: 'EMT 是只给七种 fcc 金属（Al、Cu、Ag、Au、Ni、Pd、Pt）拟合的教学用势，几秒就算完；色散的形状对，数值和实验差 5–15 %。' },
    { id: 'uma', model: 'uma-s-1p2p1', name: 'UMA-S 1.2.1 · omat（GPU）', license: 'FAIR Chemistry License',
      note: 'UMA 的无机材料任务（omat，在 OMat24 上训练，PBE/PBE+U 精度），能算大多数元素的晶体；在站长的 GPU 上跑。' },
    { id: 'uma-s-1p2', model: 'uma-s-1p2', name: 'UMA-S 1.2 · omat（GPU）', license: 'FAIR Chemistry License', note: '上一版 UMA 的 omat 任务，用来对照。' },
    { id: 'uma-s-1p1', model: 'uma-s-1p1', name: 'UMA-S 1.1 · omat（GPU）', license: 'FAIR Chemistry License', note: '最早的 UMA 的 omat 任务，用来对照。' },
  ];
  const ENGINE = Object.fromEntries(ENGINES.map((e) => [e.id, e]));

  // 频率单位：1 THz = 33.35641 cm⁻¹ = 4.135667 meV
  const UNITS = { thz: { label: 'THz', k: 1, d: 2 }, cm1: { label: 'cm⁻¹', k: 33.35641, d: 0 }, mev: { label: 'meV', k: 4.135667, d: 1 } };
  const toUnit = (thz, u) => thz * (UNITS[u] || UNITS.thz).k;

  const ELEMENT = /^[A-Z][a-z]?$/;
  /** POSCAR（VASP 5，第六行写元素名）→ { n, symbols, counts, cell } 或 { error } */
  function parsePoscar(text) {
    const lines = String(text || '').replace(/\r/g, '').split('\n');
    if (lines.length < 8) return { error: 'POSCAR 至少要 8 行：注释、缩放、三行晶格矢量、元素、个数、坐标类型' };
    const scale = Number(lines[1].trim().split(/\s+/)[0]);
    const cell = lines.slice(2, 5).map((l) => l.trim().split(/\s+/).slice(0, 3).map(Number));
    if (!Number.isFinite(scale) || cell.some((v) => v.length < 3 || v.some((x) => !Number.isFinite(x)))) return { error: 'POSCAR 的第 2–5 行要是缩放因子和三行晶格矢量' };
    const names = lines[5].trim().split(/\s+/);
    if (!names.every((s) => ELEMENT.test(s))) return { error: 'POSCAR 的第 6 行要写元素符号（VASP 5 格式），例如 Na Cl' };
    const counts = lines[6].trim().split(/\s+/).map(Number);
    if (counts.length !== names.length || !counts.every((c) => Number.isInteger(c) && c > 0)) return { error: 'POSCAR 的第 7 行要是每种元素的原子数，个数和第 6 行对应' };
    const n = counts.reduce((a, b) => a + b, 0);
    let k = 7;
    if (/^\s*s/i.test(lines[k])) k++; // Selective dynamics
    if (!/^\s*[dDcCkK]/.test(lines[k] || '')) return { error: 'POSCAR 的坐标类型要写 Direct 或 Cartesian' };
    const coords = lines.slice(k + 1, k + 1 + n).filter((l) => l.trim().split(/\s+/).slice(0, 3).every((x) => x !== '' && Number.isFinite(Number(x))));
    if (coords.length !== n) return { error: `POSCAR 写了 ${n} 个原子，但坐标只有 ${coords.length} 行` };
    const symbols = names.flatMap((s, i) => Array(counts[i]).fill(s));
    const vol = Math.abs(det(cell)) * scale ** 3;
    if (!(vol > 1)) return { error: '晶格矢量不能共面（体积是零）' };
    return { n, symbols, counts: Object.fromEntries(names.map((s, i) => [s, counts[i]])), cell: cell.map((v) => v.map((x) => x * scale)), volume: vol };
  }
  const det = (m) => m[0][0] * (m[1][1] * m[2][2] - m[1][2] * m[2][1]) - m[0][1] * (m[1][0] * m[2][2] - m[1][2] * m[2][0]) + m[0][2] * (m[1][0] * m[2][1] - m[1][1] * m[2][0]);

  /** CIF：只数晶胞参数和不等价位置（对称操作展开由站长电脑上的 ASE 做），给出提示用 */
  function parseCif(text) {
    const t = String(text || '').replace(/\r/g, '');
    const num = (k) => { const m = t.match(new RegExp(`^\\s*${k}\\s+([-+0-9.eE]+)`, 'm')); return m ? Number(m[1]) : NaN; };
    const cell = ['_cell_length_a', '_cell_length_b', '_cell_length_c', '_cell_angle_alpha', '_cell_angle_beta', '_cell_angle_gamma'].map(num);
    if (cell.some((v) => !Number.isFinite(v))) return { error: 'CIF 里要有 _cell_length_a/b/c 和 _cell_angle_alpha/beta/gamma' };
    const lines = t.split('\n');
    let sites = 0, symbols = [];
    for (let i = 0; i < lines.length; i++) {
      if (!/^\s*loop_/.test(lines[i])) continue;
      const head = [];
      let j = i + 1;
      while (j < lines.length && /^\s*_/.test(lines[j])) head.push(lines[j++].trim().split(/\s+/)[0]);
      if (!head.some((h) => h.startsWith('_atom_site_fract_') || h.startsWith('_atom_site_cartn_'))) continue;
      const iType = head.indexOf('_atom_site_type_symbol'), iLabel = head.indexOf('_atom_site_label');
      for (; j < lines.length && lines[j].trim() && !/^\s*(loop_|_|data_)/.test(lines[j]); j++) {
        const f = lines[j].trim().split(/\s+/);
        if (f.length < head.length) continue;
        sites++;
        const raw = f[iType >= 0 ? iType : Math.max(0, iLabel)] || '';
        symbols.push((raw.match(/^[A-Z][a-z]?/) || [''])[0]);
      }
    }
    if (!sites) return { error: 'CIF 里没找到原子位置（loop_ 下的 _atom_site_fract_x 等）' };
    const symops = /_symmetry_equiv_pos_as_xyz|_space_group_symop_operation_xyz|_symmetry_space_group_name_H-M|_space_group_name_H-M_alt|_symmetry_Int_Tables_number|_space_group_IT_number/.test(t);
    return { sites, symbols, cell, symops };
  }
  /** 猜格式：有 data_ 或 _cell_length_a 的是 CIF，否则当 POSCAR */
  const guessFormat = (text) => (/^\s*data_|_cell_length_a/m.test(String(text || '')) ? 'cif' : 'poscar');

  /** 估一下超胞有多少原子（预设是准的；POSCAR 按输入的晶胞估，站长电脑先标准化成惯用胞再数）和能不能交上去 */
  function estimate(s) {
    const sc = s.supercell, mult = sc[0] * sc[1] * sc[2];
    const out = { cellAtoms: null, superAtoms: null, exact: false, symbols: [], error: '', note: '' };
    if (!sc.every((x) => Number.isInteger(x) && x >= 1 && x <= LIMITS.supercellMax)) { out.error = `超胞每个方向是 1 到 ${LIMITS.supercellMax} 的整数`; return out; }
    if (s.source === 'preset') {
      const p = PRESET[s.preset];
      if (!p) { out.error = '先选一个预设晶体'; return out; }
      Object.assign(out, { cellAtoms: p.atoms, superAtoms: p.atoms * mult, exact: true, symbols: p.id === 'NaCl' ? ['Na', 'Cl'] : p.id === 'MgO' ? ['Mg', 'O'] : [p.id] });
    } else {
      const text = String(s.structure || '');
      if (!text.trim()) { out.error = '先粘贴一段 POSCAR 或 CIF，或者选一个预设'; return out; }
      if (text.length > LIMITS.maxText) { out.error = `结构文字最多 ${LIMITS.maxText} 个字符`; return out; }
      if (/[^\x20-\x7e\t\r\n]/.test(text)) { out.error = '结构文字只能有普通 ASCII 字符（检查有没有中文标点或全角空格）'; return out; }
      if (s.format === 'cif') {
        const c = parseCif(text);
        if (c.error) { out.error = c.error; return out; }
        out.symbols = [...new Set(c.symbols.filter(Boolean))];
        out.note = c.symops ? `CIF 里有 ${c.sites} 个不等价位置；按空间群展开、标准化之后才知道晶胞里有几个原子，由站长的电脑数` : `CIF 里有 ${c.sites} 个位置，没写空间群，按 P1 读`;
        if (!c.symops) Object.assign(out, { cellAtoms: c.sites, superAtoms: c.sites * mult });
      } else {
        const p = parsePoscar(text);
        if (p.error) { out.error = p.error; return out; }
        Object.assign(out, { cellAtoms: p.n, superAtoms: p.n * mult, symbols: Object.keys(p.counts) });
        out.note = '按你给的晶胞估算；站长的电脑会先用 spglib 标准化成惯用胞，原胞会变大（面心的原胞 1 个原子变成惯用胞 4 个）';
      }
    }
    if (out.cellAtoms > LIMITS.maxCellAtoms * 4) out.error = `晶胞里有 ${out.cellAtoms} 个原子，在线计算最多 ${LIMITS.maxCellAtoms} 个（标准化之后）`;
    else if (out.exact && out.superAtoms > LIMITS.maxSupercellAtoms) out.error = `超胞有 ${out.superAtoms} 个原子，在线计算最多 ${LIMITS.maxSupercellAtoms} 个；把超胞调小`;
    return out;
  }

  /** 这个引擎能不能算这个晶体：EMT 只算七种 fcc 金属 */
  function engineProblem(s, est) {
    const e = ENGINE[s.engine];
    if (!e) return '没有这个引擎';
    if (e.emtOnly) {
      const bad = (est.symbols || []).filter((x) => !EMT_METALS.includes(x));
      if (bad.length) return `EMT 只算 ${EMT_METALS.join('、')}，这个晶体里有 ${bad.join('、')}；换成 UMA`;
    }
    return '';
  }

  /** 交给账号服务 /uma/jobs 的请求体；有问题就抛出一句中文 */
  function body(s) {
    const est = estimate(s);
    if (est.error) throw new Error(est.error);
    const why = engineProblem(s, est);
    if (why) throw new Error(why);
    const [dlo, dhi] = LIMITS.disp, [mlo, mhi] = LIMITS.mesh, [tlo, thi] = LIMITS.tmax;
    if (!(s.displacement >= dlo && s.displacement <= dhi)) throw new Error(`位移在 ${dlo} 到 ${dhi} Å 之间`);
    if (!(Number.isInteger(s.mesh) && s.mesh >= mlo && s.mesh <= mhi)) throw new Error(`网格是 ${mlo} 到 ${mhi} 的整数`);
    if (!(Number.isInteger(s.tMax) && s.tMax >= tlo && s.tMax <= thi)) throw new Error(`最高温度是 ${tlo} 到 ${thi} K 的整数`);
    const params = s.source === 'preset' ? { preset: s.preset } : { structure: String(s.structure).replace(/\r/g, ''), format: s.format };
    Object.assign(params, { supercell: [...s.supercell], displacement: s.displacement, relax: !!s.relax, mesh: s.mesh, t_max: s.tMax });
    return { job: 'phon', model: ENGINE[s.engine].model, params };
  }

  // ── 结果 ──
  /** 色散曲线：每一段、每一支一条线（段与段之间断开），刻度是高对称点 */
  function band(r, unit = 'thz') {
    const segs = r?.band?.segments || [], series = [];
    for (const seg of segs) {
      const nb = seg.frequencies_thz[0]?.length || 0;
      for (let b = 0; b < nb; b++) series.push({ xs: seg.distances, ys: seg.frequencies_thz.map((row) => toUnit(row[b], unit)) });
    }
    const ticks = (r?.band?.ticks || []).map((t) => ({ x: t.x, label: t.label }));
    const all = series.flatMap((s) => s.ys);
    return { series, ticks, x: ticks.length ? [ticks[0].x, ticks[ticks.length - 1].x] : [0, 1], lo: all.length ? Math.min(...all) : 0, hi: all.length ? Math.max(...all) : 1 };
  }
  /** 态密度：频率换了单位，密度跟着除以换算系数，面积仍是每个原胞 3N 个模式 */
  function dos(r, unit = 'thz') {
    const k = (UNITS[unit] || UNITS.thz).k, f = r?.dos?.frequency_thz || [], g = r?.dos?.dos || [];
    return { xs: f.map((x) => x * k), ys: g.map((y) => y / k) };
  }
  const trapz = (xs, ys) => xs.slice(1).reduce((a, x, i) => a + ((x - xs[i]) * (ys[i] + ys[i + 1])) / 2, 0);
  /** 热学量：温度、F、S、Cv，以及 Dulong–Petit 极限 */
  function thermal(r) {
    const t = r?.thermal || {};
    return { T: t.temperature_k || [], F: t.free_energy_kj_mol || [], S: t.entropy_j_k_mol || [], Cv: t.heat_capacity_j_k_mol || [],
      dp: t.dulong_petit_j_k_mol ?? 3 * R * (t.atoms_per_cell || 1), n: t.atoms_per_cell || 1, zpe: t.zero_point_kj_mol };
  }
  /** 某个温度上的 Cv、S、F（取最近的一点） */
  function at(r, T) {
    const t = thermal(r);
    if (!t.T.length) return null;
    let k = 0;
    t.T.forEach((v, i) => { if (Math.abs(v - T) < Math.abs(t.T[k] - T)) k = i; });
    return { T: t.T[k], Cv: t.Cv[k], S: t.S[k], F: t.F[k] };
  }
  /** 结论：有没有虚频、Γ 点的声学支、超胞够不够 */
  function verdict(r) {
    const out = [];
    const g = (r.gamma_thz || []).map(Math.abs);
    if (r.imaginary) out.push(['warn', `有虚频：最低 ${r.min_frequency_thz.toFixed(2)} THz（网格上 ${r.n_imaginary_mesh} 个模式）。可能是这个结构在这个模型下动力学不稳定（会自发畸变），也可能是超胞太小、位移太大或者没有先优化；先试试打开“先优化”、加大超胞。`]);
    else out.push(['ok', `没有虚频（最低 ${r.min_frequency_thz.toFixed(3)} THz）：这个结构在这个模型下动力学稳定。`]);
    if (g.length && Math.max(...g) > 0.05) out.push(['warn', `Γ 点三个声学支没有落到零（最大 ${Math.max(...g).toFixed(3)} THz），力常数不满足平移不变性；结果要小心看。`]);
    if (r.relax && !r.relax.converged) out.push(['warn', `优化没有在 ${r.relax.steps} 步内收敛（应力 ${r.relax.max_stress_gpa} GPa），声子可能出现小的虚频。`]);
    if (!r.relax && r.max_residual_force_ev_a > 0.01) out.push(['warn', `没有先优化，完美超胞里还有 ${r.max_residual_force_ev_a.toFixed(3)} eV/Å 的残余受力（已经从位移的受力里减掉），频率会有偏差。`]);
    return out;
  }
  const n = (v, d) => (Number.isFinite(v) ? Number(v).toFixed(d) : '');
  /** CSV：色散（距离、段、各支的频率 THz）、态密度、热学量，三块用空行分开 */
  function csv(r) {
    const rows = [];
    const segs = r?.band?.segments || [];
    const nb = segs[0]?.frequencies_thz[0]?.length || 0;
    rows.push(['distance', 'segment', ...Array.from({ length: nb }, (_, b) => `band${b + 1}_thz`)].join(','));
    for (const seg of segs) seg.distances.forEach((x, i) => rows.push([n(x, 5), `${seg.from}-${seg.to}`, ...seg.frequencies_thz[i].map((v) => n(v, 4))].join(',')));
    rows.push('', 'frequency_thz,dos_states_per_thz');
    (r?.dos?.frequency_thz || []).forEach((x, i) => rows.push(`${n(x, 4)},${n(r.dos.dos[i], 5)}`));
    const t = thermal(r);
    rows.push('', 'temperature_k,free_energy_kj_mol,entropy_j_k_mol,heat_capacity_j_k_mol');
    t.T.forEach((T, i) => rows.push([n(T, 1), n(t.F[i], 4), n(t.S[i], 4), n(t.Cv[i], 4)].join(',')));
    return rows.join('\n') + '\n';
  }

  // ── 本机脚本 ──
  const PY_KIND = { fcc: 'fcc', diamond: 'diamond', rocksalt: 'rocksalt' };
  /** 在自己电脑上跑同样流程的 Python 脚本（phonopy + spglib + seekpath + ASE；UMA 另要 fairchem-core） */
  function script(s) {
    const e = ENGINE[s.engine] || ENGINES[0], p = PRESET[s.preset] || PRESETS[0];
    const uma = !e.emtOnly;
    const L = [];
    L.push(`# Phonons with phonopy (BSD-3-Clause), spglib (BSD-3-Clause) and seekpath (MIT); forces from ${uma ? `${e.model} (fairchem, task "omat")` : "ASE's EMT"}.`);
    L.push(`# The same steps as the MolAstria online job: spglib standard cell -> ${s.relax ? 'relax (cell + positions, symmetry kept) -> ' : ''}finite displacements -> band, DOS, thermal properties.`);
    L.push(`# pip install phonopy spglib seekpath ase${uma ? ' fairchem-core   (UMA: accept the licence on Hugging Face, then huggingface-cli login)' : ''}`);
    L.push('import io', '', 'import numpy as np', 'import spglib', 'from ase import Atoms', 'from ase.build import bulk', 'from ase.constraints import FixSymmetry',
      'from ase.filters import FrechetCellFilter', 'from ase.io import read', 'from ase.optimize import BFGS', 'from phonopy import Phonopy', 'from phonopy.structure.atoms import PhonopyAtoms', '');
    L.push(`SUPERCELL = [${s.supercell.join(', ')}]  # multiplies the standardised conventional cell`);
    L.push(`DISPLACEMENT = ${s.displacement}  # Angstrom`, `MESH = ${s.mesh}  # Gamma-centred mesh for the DOS and thermal properties`, `T_MAX = ${s.tMax}  # K`, 'SYMPREC = 1e-3  # Angstrom, spglib tolerance', `RELAX = ${s.relax ? 'True' : 'False'}`, '');
    if (s.source === 'preset') L.push(`atoms = bulk(${JSON.stringify(p.id)}, ${JSON.stringify(PY_KIND[p.kind])}, a=${p.a}, cubic=True)  # ${p.kind}, experimental a`);
    else L.push(`STRUCTURE = ${JSON.stringify(String(s.structure || '').replace(/\r/g, ''))}`, `atoms = read(io.StringIO(STRUCTURE), format=${JSON.stringify(s.format === 'cif' ? 'cif' : 'vasp')})`);
    L.push('');
    if (uma) L.push('from fairchem.core import FAIRChemCalculator, pretrained_mlip', '', `calc = FAIRChemCalculator(pretrained_mlip.get_predict_unit(${JSON.stringify(e.model)}, device="cuda"), task_name="omat")  # device="cpu" without a GPU`);
    else L.push('from ase.calculators.emt import EMT', '', 'calc = EMT()');
    L.push('', '',
      'def standard_cell(a):',
      '    lattice, positions, numbers = spglib.standardize_cell((a.cell[:], a.get_scaled_positions(), a.numbers), to_primitive=False, symprec=SYMPREC)',
      '    return Atoms(numbers=numbers, cell=lattice, scaled_positions=positions, pbc=True)', '', '',
      'atoms = standard_cell(atoms)',
      'ds = spglib.get_symmetry_dataset((atoms.cell[:], atoms.get_scaled_positions(), atoms.numbers), symprec=SYMPREC)',
      'print(f"space group {ds.international} ({ds.number}), {len(atoms)} atoms in the conventional cell")',
      'if RELAX:',
      '    atoms.calc = calc',
      '    atoms.set_constraint(FixSymmetry(atoms, symprec=SYMPREC))',
      '    BFGS(FrechetCellFilter(atoms), logfile=None).run(fmax=1e-3, steps=300)',
      '    atoms.set_constraint()',
      '    print("relaxed a, b, c, alpha, beta, gamma:", np.round(atoms.cell.cellpar(), 4))', '',
      'unit = PhonopyAtoms(symbols=atoms.get_chemical_symbols(), cell=atoms.cell[:], scaled_positions=atoms.get_scaled_positions())',
      'ph = Phonopy(unit, supercell_matrix=np.diag(SUPERCELL), primitive_matrix="auto", symprec=SYMPREC)',
      'ph.generate_displacements(distance=DISPLACEMENT, is_plusminus="auto")', '', '',
      'def forces(cell):',
      '    at = Atoms(cell.symbols, cell=cell.cell, scaled_positions=cell.scaled_positions, pbc=True)',
      '    at.calc = calc',
      '    return at.get_forces()', '', '',
      'residual = forces(ph.supercell)  # subtracted, so a structure not quite at its minimum still gives clean force constants',
      'print(f"{len(ph.supercell)} atoms in the supercell, {len(ph.supercells_with_displacements)} displaced supercells")',
      'ph.forces = np.array([forces(c) - residual for c in ph.supercells_with_displacements])',
      'ph.produce_force_constants()',
      'ph.symmetrize_force_constants()',
      'ph.save("phonopy_params.yaml")  # structure, displacements and forces: phonopy-load phonopy_params.yaml', '',
      'ph.auto_band_structure(npoints=51, plot=False, write_yaml=True, filename="band.yaml")  # seekpath path; phonopy-bandplot band.yaml',
      'ph.run_mesh([MESH] * 3, is_gamma_center=True)',
      'ph.run_total_dos()',
      'np.savetxt("total_dos.dat", np.column_stack([ph.total_dos.frequency_points, ph.total_dos.dos]), header="frequency_THz dos")',
      'ph.run_thermal_properties(t_min=0, t_max=T_MAX, t_step=10)',
      'tp = ph.thermal_properties',
      'print("T (K)   F (kJ/mol)   S (J/K/mol)   Cv (J/K/mol)   per mole of primitive cells")',
      'for T, F, S, Cv in list(zip(tp.temperatures, tp.free_energy, tp.entropy, tp.heat_capacity))[::10]:',
      '    print(f"{T:6.0f} {F:12.4f} {S:13.4f} {Cv:14.4f}")',
      'lowest = min(float(np.min(ph.mesh.frequencies)), min(float(np.min(f)) for f in ph.band_structure.frequencies))',
      `print(f"lowest frequency {lowest:.3f} THz" + ("  -> imaginary modes: unstable, or the supercell is too small" if lowest < ${IMAG_THZ} else "  (no imaginary modes)"))`);
    return L.join('\n') + '\n';
  }

  const SAMPLES = {
    poscar: 'Si primitive cell (diamond)\n1.0\n0.0000 2.7155 2.7155\n2.7155 0.0000 2.7155\n2.7155 2.7155 0.0000\nSi\n2\nDirect\n0.00 0.00 0.00\n0.25 0.25 0.25\n',
    cif: "data_NaCl\n_cell_length_a 5.640\n_cell_length_b 5.640\n_cell_length_c 5.640\n_cell_angle_alpha 90\n_cell_angle_beta 90\n_cell_angle_gamma 90\n_symmetry_space_group_name_H-M 'F m -3 m'\n_symmetry_Int_Tables_number 225\nloop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\nNa1 Na 0.0 0.0 0.0\nCl1 Cl 0.5 0.5 0.5\n",
  };

  const api = { LIMITS, COST, IMAG_THZ, EMT_METALS, PRESETS, PRESET, KIND, ENGINES, ENGINE, UNITS, SAMPLES,
    toUnit, parsePoscar, parseCif, guessFormat, estimate, engineProblem, body, band, dos, trapz, thermal, at, verdict, csv, script };
  root.MolAstriaPhonon = api;
})(typeof window !== 'undefined' ? window : globalThis);
