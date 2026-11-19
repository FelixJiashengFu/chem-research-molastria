/* 开源代码台“quacc 流水线”标签的纯逻辑（MolAstriaQuacc）：配方和引擎的清单、读分子列表、在线批量提交的请求体和
   花费、把结果整理成表格和 CSV，以及一段在自己电脑上跑同样配方的 quacc 脚本。不碰 DOM，也不发请求。
   quacc（github.com/Quantum-Accelerators/quacc，Andrew S. Rosen，BSD-3-Clause）是基于 ASE 的高通量计算工作流库；
   这里没有拷贝它的代码，只照它公开的配方接口写调用。在线部分由站长电脑上的 tools/uma-server/quacc_backend.py 执行，
   规则和那边、和账号服务 deploy/account-worker.js 是同一套（tools/quacc-test.mjs 核对，并在本机装了 quacc 时真跑脚本）。 */
(function (root) {
  'use strict';

  const MAX_ITEMS = 8; // 在线一批最多几个分子（quacc_backend.MAX_ITEMS）
  const MAX_LOCAL = 200; // 本机脚本里最多写几个
  const SMILES_RE = /^[A-Za-z0-9@+\-[\]()=#$%/\\.:~*]{1,200}$/;
  const EMT_METALS = ['Al', 'Cu', 'Ag', 'Au', 'Ni', 'Pd', 'Pt'];
  const PSI4_METHODS = ['hf', 'b3lyp-d3bj', 'pbe0', 'wb97x-d'];
  const PSI4_BASES = ['sto-3g', '6-31g*', 'def2-svp'];

  // 配方：id、名字、quacc 里对应的函数、一句说明
  const RECIPES = [
    ['relax', '几何优化', 'relax_job', '从 RDKit 生成的三维结构出发，用 ASE 的优化器优化到受力小于 fmax。'],
    ['relax_freq', '优化 + 频率与热化学', 'relax_job → freq_job', '先优化，再用有限差分算振动频率，按理想气体给出 ZPE、H、S、G；对称数和点群由 quacc 自己判断。'],
    ['static', '单点能', 'static_job', '不动结构，只算一次能量。'],
    ['slabs', '金属表面能', 'bulk_to_slabs_flow', '先连晶胞一起优化体相，再切出低指数晶面、逐个优化，最后算每个晶面的表面能 γ。'],
  ];
  // 引擎：id、名字、在线模型 id（没有就只能在本机跑）、能做的配方、许可证、安装
  const ENGINES = [
    { id: 'tblite', name: 'GFN2-xTB（tblite）', model: 'quacc-gfn2', recipes: ['relax', 'relax_freq', 'static'], license: 'LGPL-3.0',
      install: 'pip install quacc tblite rdkit', note: 'tblite 的 pip 包只有 Linux 和 macOS 版；Windows 上用 WSL，或者 conda install -c conda-forge tblite-python。站长电脑是 Windows，在线计算用同样的 quacc 调用接 xtb 程序。' },
    { id: 'psi4', name: 'Psi4（DFT / HF）', model: 'quacc-psi4', recipes: ['static'], license: 'LGPL-3.0',
      install: 'conda install -c conda-forge psi4 rdkit && pip install quacc', note: 'quacc 的 Psi4 配方只有单点。' },
    { id: 'emt', name: 'EMT（ASE 自带）', model: 'quacc-emt', recipes: ['slabs'], license: 'LGPL-2.1（ASE）',
      install: 'pip install quacc', note: 'EMT 是只给七种 fcc 金属拟合的教学用势，quacc 自己也说这组配方“主要用来演示”。数值看趋势，不要当成 DFT。' },
    { id: 'orca', name: 'ORCA（只在本机）', model: '', recipes: ['relax', 'relax_freq', 'static'], license: '学术免费，商用要买授权',
      install: 'pip install quacc rdkit；ORCA 要到 orcaforum.kofo.mpg.de 注册下载，再设 QUACC_ORCA_CMD', note: 'ORCA 只对学术用户免费，所以站长的电脑不替别人跑它；这里只给你在自己电脑上用的脚本。' },
  ];
  const ENGINE = Object.fromEntries(ENGINES.map((e) => [e.id, e]));
  const RECIPE = Object.fromEntries(RECIPES.map(([id, name, fn, about]) => [id, { id, name, fn, about }]));
  const ITEM_COST = { static: 1, relax: 1, relax_freq: 3 };
  // 一个分子的元素、重原子数的上限：和服务端一样（GFN2 30 个重原子，Psi4 12 个）
  const HEAVY = { tblite: 30, psi4: 12, orca: 30 };

  const SAMPLES = {
    molecules: ['CCO ethanol', 'O water', 'CC(=O)O acetic acid', 'c1ccccc1 benzene', '[CH3] methyl radical'].join('\n'),
  };

  /** 一行一个分子：“SMILES 名字”（名字可省）；# 开头的行和空行跳过。 */
  function parseList(text, max = MAX_LOCAL) {
    const items = [], bad = [], extra = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const [smiles, ...rest] = line.split(/\s+/);
      if (!SMILES_RE.test(smiles)) { bad.push(i + 1); return; }
      if (items.length >= max) { extra.push(i + 1); return; }
      items.push({ line: i + 1, smiles, name: rest.join(' ') });
    });
    return { items, bad, extra };
  }

  const engineFor = (recipe, engine) => (recipe === 'slabs' ? 'emt' : engine === 'emt' ? 'tblite' : engine);
  /** 在线能不能跑这个组合：引擎要有在线模型，配方要是它会的 */
  const online = (recipe, engine) => {
    const e = ENGINE[engineFor(recipe, engine)];
    return !!(e && e.model && e.recipes.includes(recipe));
  };

  /** 每天次数的花费，和账号服务的 quaccCost 一样 */
  function cost(s) {
    const e = engineFor(s.recipe, s.engine);
    if (s.recipe === 'slabs') return (s.max_index || 1) > 1 ? 5 : 3;
    const n = Math.max(1, s.items?.length || 1);
    return n * (e === 'psi4' ? 2 : ITEM_COST[s.recipe] || 1);
  }

  /** 提交到 /uma/jobs（或 /v1/jobs）的请求体；s = {recipe, engine, items:[{smiles}], fmax, temperature, method, basis, element, max_index} */
  function body(s) {
    const e = ENGINE[engineFor(s.recipe, s.engine)];
    if (!online(s.recipe, s.engine)) throw new Error(`${e?.name || s.engine} 的“${RECIPE[s.recipe]?.name || s.recipe}”不能在线运行，请用下面的脚本在自己的电脑上跑`);
    if (s.recipe === 'slabs') {
      if (!EMT_METALS.includes(s.element)) throw new Error(`EMT 只认这七种金属：${EMT_METALS.join('、')}`);
      return { model: e.model, job: 'qslab', params: { element: s.element, max_index: s.max_index === 2 ? 2 : 1 } };
    }
    const items = (s.items || []).map((x) => x.smiles);
    if (!items.length) throw new Error('先写至少一个分子的 SMILES');
    if (items.length > MAX_ITEMS) throw new Error(`在线一批最多 ${MAX_ITEMS} 个分子（现在 ${items.length} 个）；多的请用下面的脚本在自己的电脑上跑`);
    const params = { items, recipe: s.recipe };
    if (s.recipe !== 'static' && Number.isFinite(s.fmax)) params.fmax = s.fmax;
    if (s.recipe === 'relax_freq' && Number.isFinite(s.temperature)) params.temperature = s.temperature;
    if (e.id === 'psi4') Object.assign(params, { method: PSI4_METHODS.includes(s.method) ? s.method : 'b3lyp-d3bj', basis: PSI4_BASES.includes(s.basis) ? s.basis : 'def2-svp' });
    return { model: e.model, job: 'qflow', params };
  }

  const num = (v, d) => (Number.isFinite(v) ? Number(v).toFixed(d) : '');
  const EV_KCAL = 23.060548;

  /** 批量结果 → 表格的行（能量用 eV，相对能量用 kcal/mol，最低的为 0） */
  function rows(result, names = {}) {
    const items = Array.isArray(result?.items) ? result.items : [];
    const key = (r) => (Number.isFinite(r.g_ev) ? r.g_ev : r.energy_ev);
    const ok = items.filter((r) => r.ok && Number.isFinite(key(r)));
    return items.map((r) => ({
      smiles: String(r.smiles || ''), name: names[r.smiles] || '', formula: String(r.formula || ''), ok: !!r.ok, error: r.ok ? '' : String(r.error || ''),
      charge: r.charge ?? 0, spin: r.spin ?? 1, energy_ev: r.energy_ev, converged: r.converged, steps: r.steps, fmax_ev_a: r.fmax_ev_a,
      n_imag: r.n_imag, zpe_ev: r.zpe_ev, h_ev: r.h_ev, g_ev: r.g_ev, s_ev_k: r.s_ev_k, point_group: r.point_group || '', symmetry_number: r.symmetry_number,
      frequencies_cm1: Array.isArray(r.frequencies_cm1) ? r.frequencies_cm1 : [], xyz: String(r.xyz || ''),
      // 同一批里按 G（没有就按 E）排的相对值；分子不同时只是读数，不是反应能
      atoms: r.xyz ? Number(String(r.xyz).split('\n')[0]) || 0 : 0,
      isMin: ok.length > 1 && r.ok && key(r) === Math.min(...ok.map(key)),
    }));
  }

  /** 表面能结果 → 行，γ 从低到高，附相对最低晶面的比值 */
  function slabRows(result) {
    const slabs = Array.isArray(result?.slabs) ? result.slabs.filter((x) => Number.isFinite(x.gamma_j_m2)) : [];
    const low = slabs.length ? Math.min(...slabs.map((x) => x.gamma_j_m2)) : NaN;
    return slabs.slice().sort((a, b) => a.gamma_j_m2 - b.gamma_j_m2).map((x) => ({
      hkl: `(${(x.family || x.miller || []).join('')})`, miller: x.miller, atoms: x.atoms, area_a2: x.area_a2, gamma_j_m2: x.gamma_j_m2,
      gamma_ev_a2: x.gamma_ev_a2, ratio: x.gamma_j_m2 / low, converged: x.converged, steps: x.steps,
    }));
  }

  const csvCell = (v) => { const t = String(v ?? ''); return /[",\n]/.test(t) ? `"${t.replace(/"/g, '""')}"` : t; };
  function csv(result, names = {}) {
    if (Array.isArray(result?.slabs)) {
      const head = ['element', 'hkl', 'atoms', 'area_A2', 'gamma_J_m2', 'gamma_eV_A2', 'converged', 'steps'];
      return [head.join(','), ...slabRows(result).map((r) => [result.element, r.hkl, r.atoms, r.area_a2, r.gamma_j_m2, r.gamma_ev_a2, r.converged, r.steps].map(csvCell).join(','))].join('\n') + '\n';
    }
    const head = ['smiles', 'name', 'formula', 'charge', 'multiplicity', 'ok', 'energy_eV', 'converged', 'steps', 'fmax_eV_A', 'n_imag', 'zpe_eV', 'H_eV', 'S_eV_K', 'G_eV', 'point_group', 'symmetry_number', 'error'];
    return [head.join(','), ...rows(result, names).map((r) => [r.smiles, r.name, r.formula, r.charge, r.spin, r.ok, r.energy_ev, r.converged, r.steps, r.fmax_ev_a, r.n_imag, r.zpe_ev, r.h_ev, r.s_ev_k, r.g_ev, r.point_group, r.symmetry_number, r.error].map(csvCell).join(','))].join('\n') + '\n';
  }

  // ── 本机脚本（Python，注释一律英文：<pre> 不翻译） ──
  const py = (s) => JSON.stringify(String(s));
  const FROM_SMILES = `def from_smiles(smiles, seed=42):
    """RDKit ETKDG + MMFF, the same start the MolAstria online models use. Charge and multiplicity from the SMILES."""
    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
    params = AllChem.ETKDGv3()
    params.randomSeed = seed
    AllChem.EmbedMolecule(mol, params)
    if AllChem.MMFFHasAllMoleculeParams(mol):
        AllChem.MMFFOptimizeMolecule(mol)
    atoms = Atoms([a.GetSymbol() for a in mol.GetAtoms()], positions=mol.GetConformer().GetPositions())
    charge = Chem.GetFormalCharge(mol)
    multiplicity = sum(a.GetNumRadicalElectrons() for a in mol.GetAtoms()) + 1
    return atoms, charge, multiplicity
`;

  /** 在自己电脑上跑同一个配方的 quacc 脚本。s 和 body() 的一样，外加 nprocs。 */
  function script(s) {
    const e = ENGINE[engineFor(s.recipe, s.engine)], r = RECIPE[s.recipe];
    const head = `# MolAstria Code Desk: quacc recipe "${r.fn}" with ${e.name.replace(/（.*）/, '').trim()} (${e.id})
# quacc: https://github.com/Quantum-Accelerators/quacc (BSD-3-Clause, Andrew S. Rosen)
# Install: ${e.install.replace(/；.*$/, '')}
`;
    const engineNote = '# Each job runs in its own folder under QUACC_RESULTS_DIR (default: the current folder).\n'
      + '# To spread a batch over a cluster, set QUACC_WORKFLOW_ENGINE (parsl, dask, prefect, jobflow, redun) and\n'
      + '# follow the quacc documentation on that engine; the recipes stay the same.\n';
    if (s.recipe === 'slabs') {
      const el = EMT_METALS.includes(s.element) ? s.element : 'Cu', mi = s.max_index === 2 ? 2 : 1;
      return `${head}${engineNote}import numpy as np
from ase.build import bulk
from quacc.recipes.emt.core import relax_job
from quacc.recipes.emt.slabs import bulk_to_slabs_flow

EV_A2_TO_J_M2 = 16.0217663

# 1. Relax the conventional fcc cell of ${el}, cell included.
bulk_doc = relax_job(bulk(${py(el)}, "fcc", cubic=True), relax_cell=True)
e_bulk = bulk_doc["results"]["energy"] / len(bulk_doc["atoms"])
print(f"a = {np.linalg.norm(bulk_doc['atoms'].cell[0]):.4f} A, E_bulk = {e_bulk:.6f} eV/atom")

# 2. Cut every slab up to Miller index ${mi}, relax each, and take gamma = (E_slab - N E_bulk) / 2A.
flow = bulk_to_slabs_flow(bulk_doc["atoms"], run_static=False, make_slabs_kwargs={"max_index": ${mi}})
for doc in flow["relax"]:
    slab = doc["atoms"]
    area = np.linalg.norm(np.cross(slab.cell[0], slab.cell[1]))
    gamma = (doc["results"]["energy"] - len(slab) * e_bulk) / (2 * area) * EV_A2_TO_J_M2
    print(slab.info["slab_stats"]["miller_index"], len(slab), f"{gamma:.4f} J/m^2")
`;
    }
    const mols = (s.items || []).slice(0, MAX_LOCAL).map((x) => x.smiles);
    const list = mols.length ? mols : ['CCO'];
    const fmax = Number.isFinite(s.fmax) ? s.fmax : 0.01, T = Number.isFinite(s.temperature) ? s.temperature : 298.15;
    const imports = `from ase import Atoms
from rdkit import Chem
from rdkit.Chem import AllChem
`;
    let engineImport = '', calc = '';
    if (e.id === 'tblite') {
      engineImport = `from quacc.recipes.tblite.core import ${s.recipe === 'static' ? 'static_job' : s.recipe === 'relax' ? 'relax_job' : 'freq_job, relax_job'}\n`;
      const kw = 'method="GFN2-xTB", charge=charge, multiplicity=multiplicity';
      if (s.recipe === 'static') calc = `    doc = static_job(atoms, ${kw})\n    print(smiles, f"E = {doc['results']['energy']:.6f} eV")\n`;
      else {
        calc = `    relax = relax_job(atoms, ${kw}, opt_params={"fmax": ${fmax}})\n    print(smiles, f"E = {relax['results']['energy']:.6f} eV", "converged" if relax["converged"] else "NOT converged")\n`;
        if (s.recipe === 'relax_freq') calc += `    freq = freq_job(relax["atoms"], ${kw}, energy=relax["results"]["energy"], temperature=${T})
    r = freq["results"]
    # quacc reads the multiplicity for the electronic entropy from a magnetic moment tblite does not report:
    # for a radical, add k_B ln(multiplicity) to S (MolAstria's online run does this with quacc's ThermoSummarize).
    print("   ZPE", round(r["zpe"], 4), "eV  G", round(r["gibbs_energy"], 6), "eV  imaginary:", r["n_imag"])
`;
      }
    } else if (e.id === 'psi4') {
      const m = PSI4_METHODS.includes(s.method) ? s.method : 'b3lyp-d3bj', b = PSI4_BASES.includes(s.basis) ? s.basis : 'def2-svp';
      engineImport = 'from quacc.recipes.psi4.core import static_job\n';
      calc = `    doc = static_job(atoms, charge=charge, spin_multiplicity=multiplicity, method=${py(m)}, basis=${py(b)},
                     num_threads=${Number.isInteger(s.nprocs) ? s.nprocs : 4}, mem="4GB")
    print(smiles, f"E = {doc['results']['energy']:.6f} eV")
`;
    } else { // orca
      engineImport = `from quacc.recipes.orca.core import ${s.recipe === 'static' ? 'static_job' : 'relax_job'}\n`;
      // quacc's defaults for ORCA (wB97M-D4rev / def2-TZVP); change them with xc= and basis=
      const kw = `charge=charge, spin_multiplicity=multiplicity, nprocs=${Number.isInteger(s.nprocs) ? s.nprocs : 4}`;
      calc = s.recipe === 'static'
        ? `    doc = static_job(atoms, ${kw})\n    print(smiles, f"E = {doc['results']['energy']:.6f} eV")\n`
        : `    doc = relax_job(atoms, ${kw}${s.recipe === 'relax_freq' ? ', run_freq=True' : ''})\n    print(smiles, f"E = {doc['results']['energy']:.6f} eV")\n`;
    }
    const orcaNote = e.id === 'orca' ? '# ORCA is free for academic use only; a commercial use needs a licence from FACCTs.\n# Tell quacc where it is first:  export QUACC_ORCA_CMD=/path/to/orca\n# The default level of theory in quacc is wB97M-D4rev/def2-TZVP; pass xc= and basis= to change it.\n' : '';
    return `${head}${orcaNote}${engineNote}${imports}${engineImport}

${FROM_SMILES}

molecules = [
${list.map((m) => `    ${py(m)},`).join('\n')}
]
for smiles in molecules:
    atoms, charge, multiplicity = from_smiles(smiles)
${calc}`;
  }

  const api = { MAX_ITEMS, MAX_LOCAL, SMILES_RE, EMT_METALS, PSI4_METHODS, PSI4_BASES, RECIPES, RECIPE, ENGINES, ENGINE, ITEM_COST, HEAVY, SAMPLES, EV_KCAL,
    parseList, engineFor, online, cost, body, rows, slabRows, csv, script, num };
  root.MolAstriaQuacc = api;
})(typeof window !== 'undefined' ? window : globalThis);
