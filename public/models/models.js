/* 量子化学模型接口：站长电脑上的 15 个机器学习势，经账号服务（/uma/*，在线模型 API v3）排队计算。
   四个窗口按模型类别分：① 带电荷与自旋的分子模型 ② 中性分子通用模型 ③ 有机分子力场 ④ 分子性质模型。
   RDKit 与 lab/chem.js 共用。页面只决定能不能提交；次数、许可和每人一个任务由账号服务和站长电脑检查。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = window.ChemLab;
  let R = null;
  const rdkit = L.loadRDKit().then((m) => { R = m; return m; });
  const KCAL = 23.0605; // kcal/mol per eV

  function toast(text) {
    const t = $('toast');
    t.textContent = text;
    t.dataset.show = 'true';
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => { t.dataset.show = 'false'; }, 2200);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); }
    catch {
      const a = document.createElement('textarea');
      a.value = text; document.body.append(a); a.select();
      try { document.execCommand('copy'); } finally { a.remove(); }
    }
    toast('已复制');
  }
  function save(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const store = { // visitor preferences only; storage may be off
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); } catch { /* private mode */ } }
  };

  // ── 模型（文案沿用 Meta 页的在线面板）─────────────────────────────────────
  const OFF = ['H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I'];
  const OFF_ABOUT = 'MACE-OFF23 有机分子力场（在 SPICE 数据上训练，ωB97M-D3BJ），只算由 H C N O F P S Cl Br I 组成的中性闭壳层分子；small 最快，large 最准。';
  const OFF_FINE = 'MACE-OFF23 采用学术软件许可（ASL），只限学术、非商业研究；论文里请引用 Kovács et al., J. Am. Chem. Soc. 2025（MACE-OFF）。';
  const NEUTRAL_ONLY = '实测它对不同电荷态的能量差不可靠，所以在线只算中性闭壳层分子。';
  const OMOL = '在 OMol25（ωB97M-V/def2-TZVPD，1 亿多个 DFT 计算）上训练';
  const OMOL_DFT = 'OMol25 · ωB97M-V/def2-TZVPD';
  const fair = (name, about, cite, more = {}) => ({ name, tier: 'fair', elements: null, dft: OMOL_DFT, license: 'FAIR Chemistry License', about, ...more,
    // One literal, not two adjacent slots: i18n.js cannot tell where a model name with spaces ends.
    fine: `${name} 采用 FAIR Chemistry License：只用于合法用途，不得用于武器、军事等 Meta 可接受使用政策禁止的用途；论文里请注明 ${cite}。` });
  const UMA_CITE = 'UMA（Meta FAIR Chemistry）', ALLSCAIP = 'AllScAIP 和 OMol25 数据集（Levine et al., 2025）', ESEN = 'eSEN 和 OMol25 数据集（Levine et al., 2025）';
  const MODELS = {
    'uma-s-1p2p1': fair('UMA-S 1.2.1', `Meta FAIR Chemistry 的通用原子模型，${OMOL}，支持电荷和自旋。实测水的垂直电离能偏低（6.4 eV，实验约 12.6 eV），极小分子的 IP / EA 请和 UMA-S 1.2 或 AllScAIP 对照。`, UMA_CITE),
    'uma-s-1p2': fair('UMA-S 1.2', `UMA-S 1.2.1 的上一版，${OMOL}，支持电荷和自旋。实测苯、乙醇、水的垂直电离能都接近实验值，可以用来对照 1.2.1 的 IP / EA；比 1.2.1 慢。`, UMA_CITE),
    'uma-s-1p2p1-ft-d4rev': fair('UMA-S 1.2.1 D4rev', 'UMA-S 1.2.1 按 ωB97M-D4rev 色散校正微调的分子专用版本，能量里含 D4 色散。和 1.2.1 一样，水这类极小分子的电离能偏低。', UMA_CITE, { dft: 'OMol25 结构按 ωB97M-D4rev 重算' }),
    'allscaip-md-conserving-all-omol': fair('AllScAIP-md 能量守恒型', `Meta 的 AllScAIP 中等模型，${OMOL}，力由能量求导，支持电荷和自旋；实测苯、乙醇、水的垂直电离能都接近实验值。`, ALLSCAIP),
    'allscaip-md-direct-all-omol': fair('AllScAIP-md 直接受力型', `Meta 的 AllScAIP 中等模型，${OMOL}，直接预测力（更快，但能量和力不严格守恒），支持电荷和自旋。`, ALLSCAIP, { direct: true }),
    'uma-s-1p1': fair('UMA-S 1.1', `较早的 UMA 版本，可作对照。${NEUTRAL_ONLY}`, UMA_CITE),
    'esen-sm-conserving-all-omol': fair('eSEN-sm 能量守恒型', `Meta 的 eSEN 小模型，${OMOL}，力由能量求导。${NEUTRAL_ONLY}`, ESEN),
    'esen-sm-direct-all-omol': fair('eSEN-sm 直接受力型', `Meta 的 eSEN 小模型，${OMOL}，直接预测力（能量和力不严格守恒）。${NEUTRAL_ONLY}`, ESEN, { direct: true }),
    'esen-md-direct-all-omol': fair('eSEN-md 直接受力型', `Meta 的 eSEN 中等模型，${OMOL}，直接预测力（能量和力不严格守恒）。${NEUTRAL_ONLY}`, ESEN, { direct: true }),
    'mace-omol-0': { name: 'MACE-OMOL-0', tier: 'asl', elements: null, dft: OMOL_DFT, license: '学术软件许可（ASL）',
      about: 'MACE 在 OMol25 上训练的模型，覆盖 83 种元素（H 到 Bi）。实测它对不同电荷态的能量差不可靠（水的垂直电离能只有 0.04 eV），所以在线只算中性闭壳层分子。',
      fine: 'MACE-OMOL-0 采用学术软件许可（ASL），只限学术、非商业研究；论文里请注明 MACE-OMOL-0 和 OMol25 数据集（Levine et al., 2025）。' },
    'mace-off23-small': { name: 'MACE-OFF23 small', tier: 'asl', elements: OFF, dft: 'SPICE · ωB97M-D3(BJ)/def2-TZVPPD', license: '学术软件许可（ASL）', about: OFF_ABOUT, fine: OFF_FINE },
    'mace-off23-medium': { name: 'MACE-OFF23 medium', tier: 'asl', elements: OFF, dft: 'SPICE · ωB97M-D3(BJ)/def2-TZVPPD', license: '学术软件许可（ASL）', about: OFF_ABOUT, fine: OFF_FINE },
    'mace-off23-large': { name: 'MACE-OFF23 large', tier: 'asl', elements: OFF, dft: 'SPICE · ωB97M-D3(BJ)/def2-TZVPPD', license: '学术软件许可（ASL）', about: OFF_ABOUT, fine: OFF_FINE },
    'ani-2x': { name: 'ANI-2x', tier: 'pro', elements: ['H', 'C', 'N', 'O', 'F', 'S', 'Cl'], dft: 'ωB97X/6-31G*', license: 'MIT',
      about: 'ANI-2x 神经网络势（ωB97X/6-31G*），只算由 H C N O F S Cl 组成的中性闭壳层分子，速度很快。Pro 会员专用。',
      fine: 'ANI-2x 采用 MIT 许可；论文里请引用 Devereux et al., J. Chem. Theory Comput. 2020。' },
    'mace-mdp': { name: 'MACE-MDP', tier: 'asl', elements: OFF, dft: 'SPICE-α · ωB97M-D3BJ/def2-TZVPP', license: '学术软件许可（ASL）',
      about: '预测分子的偶极矩和完整的极化率张量（在 SPICE-α 上训练，ωB97M-D3BJ/def2-TZVPP）。它本身不算能量和力，所以先用 MACE-OFF23 medium 优化结构，再在这个结构上预测；红外与拉曼光谱用 MACE-OFF23 medium 的振动模式加上 MACE-MDP 的偶极矩和极化率导数。只算由 H C N O F P S Cl Br I 组成的中性闭壳层分子。',
      fine: 'MACE-MDP 采用学术软件许可（ASL），只限学术、非商业研究；论文里请引用 MACE-MDP（ChemRxiv，doi:10.26434/chemrxiv.15000716）；结构来自 MACE-OFF23 medium，同样适用 ASL。' }
  };
  const GEOM = ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn'];
  const GROUPS = {
    charged: { name: '带电荷与自旋的分子模型', charged: true, models: ['uma-s-1p2p1', 'uma-s-1p2', 'uma-s-1p2p1-ft-d4rev', 'allscaip-md-conserving-all-omol', 'allscaip-md-direct-all-omol'], jobs: [...GEOM, 'ipea', 'spin', 'bde', 'pa'],
      intro: '① 这些模型在 OMol25 的不同电荷态和自旋态上训练，实测电荷态之间的能量差可靠：可以算离子、自由基和开壳层分子，以及电离能、电子亲和能、自旋态能隙、键解离能和质子亲和能。' },
    neutral: { name: '中性分子通用模型', charged: false, models: ['uma-s-1p1', 'esen-sm-conserving-all-omol', 'esen-sm-direct-all-omol', 'esen-md-direct-all-omol', 'mace-omol-0'], jobs: GEOM,
      intro: '② 同样在 OMol25 上训练、覆盖 83 种元素，但实测它们给不同电荷态的能量差不可靠，所以只算中性闭壳层分子：结构、频率、构象、扫描、动力学和反应能。带电荷或有未成对电子的分子请用窗口 ①。' },
    organic: { name: '有机分子力场', charged: false, models: ['mace-off23-small', 'mace-off23-medium', 'mace-off23-large', 'ani-2x'], jobs: GEOM,
      intro: '③ 为有机分子训练的力场，只认识少数元素（MACE-OFF23：H C N O F P S Cl Br I；ANI-2x：H C N O F S Cl），只算中性闭壳层分子。MACE-OFF23 是和 OMol25 系列相互独立的对照。' },
    props: { name: '分子性质模型', charged: false, models: ['mace-mdp'], jobs: ['polar', 'ir'],
      intro: '④ MACE-MDP 预测偶极矩和极化率，并和 MACE-OFF23 medium 的振动模式一起给出红外和拉曼光谱；只算由 H C N O F P S Cl Br I 组成的中性闭壳层分子。' }
  };

  // ── 计算与参数（范围和默认值同 API v3）──────────────────────────────────
  const T = (hi = 2000, def = 298.15) => ({ k: 'temperature', label: '温度（K）', type: 'num', lo: 10, hi, def, step: 0.01 });
  const RXN = '>>'; // kept out of the Chinese literals: i18n-extract would read it as the end of a tag
  const THERMO = { k: 'thermo', label: '加上热校正（焓与吉布斯自由能，要先算频率）', type: 'bool', def: false };
  const JOBS = {
    sp: { name: '单点能与受力', cost: () => 1, about: '在给定的结构上算能量和每个原子受的力，不优化。SMILES 输入时结构由 RDKit 生成。', fields: [] },
    opt: { name: '几何优化', cost: () => 1, about: '找到能量最低的结构（局部极小点）。', fields: [{ k: 'fmax', label: '收敛判据 fmax（eV/Å）', type: 'num', lo: 0.001, hi: 0.1, def: 0.02, step: 0.001 }] },
    freq: { name: '振动频率与热化学', cost: () => 3, about: '先优化，再用有限差分求振动频率，按理想气体、刚性转子和谐振子给出零点能、焓、熵和吉布斯自由能。',
      fields: [T(), { k: 'symmetry', label: '转动对称数 σ（水是 2，苯是 12）', type: 'int', lo: 1, hi: 24, def: 1 }] },
    conf: { name: '构象搜索', cost: () => 5, smiles: () => true, about: 'RDKit 生成多个构象，全部用模型优化，去掉重复的，按相对能量和 Boltzmann 权重排序。',
      fields: [{ k: 'n', label: '生成的构象数', type: 'int', lo: 2, hi: 30, def: 10 }, T(), { k: 'window_kcal', label: '保留的能量窗口（kcal/mol）', type: 'num', lo: 1, hi: 30, def: 10, step: 0.1 }] },
    scan: { name: '二面角扫描', cost: () => 5, about: '固定一个二面角，每个角度优化其余结构，得到扭转能量曲线（柔性扫描）。',
      fields: [{ k: 'atoms', label: '二面角的四个原子（按结构图上的编号）', type: 'atoms' }, { k: 'start', label: '起始角（°）', type: 'num', lo: -360, hi: 360, def: -180, step: 1 }, { k: 'end', label: '终止角（°）', type: 'num', lo: -360, hi: 360, def: 180, step: 1 }, { k: 'points', label: '扫描点数', type: 'int', lo: 3, hi: 24, def: 13 }] },
    md: { name: '分子动力学', cost: () => 5, about: '先优化，再在 Langevin 恒温器下跑一段气相分子动力学，给出势能、动能和温度随时间的变化。',
      fields: [T(1500, 300), { k: 'timestep_fs', label: '步长（fs）', type: 'num', lo: 0.1, hi: 2, def: 0.5, step: 0.1 }, { k: 'steps', label: '步数', type: 'int', lo: 100, hi: 2000, def: 1000 }, { k: 'friction', label: '摩擦系数（1/fs）', type: 'num', lo: 0.001, hi: 0.1, def: 0.01, step: 0.001 }] },
    rxn: { name: '反应能', cost: (p) => (p.thermo ? 5 : 3), smiles: () => true, about: '每个物种分别优化，反应能 ΔE = Σ 产物 − Σ 反应物；加热校正时再给出 ΔG。原子要守恒。',
      fields: [{ k: 'reaction', label: `反应 SMILES（反应物${RXN}产物，物种之间用 . 分开，两边一共最多 6 个）`, type: 'reaction', def: 'C=C.[H][H]>>CC' }, THERMO, T()] },
    ipea: { name: '电离能与电子亲和能', cost: () => 1, about: '绝热：中性、阳离子、阴离子各自优化；垂直：在中性分子的结构上直接换电荷态。IP = E(+1) − E(0)，EA = E(0) − E(−1)。',
      fields: [{ k: 'mode', label: '方式', type: 'select', def: 'adiabatic', options: [['adiabatic', '绝热'], ['vertical', '垂直'], ['both', '绝热和垂直都算']] }] },
    spin: { name: '自旋态能隙', cost: () => 2, about: '同一个分子的两个自旋多重度各自优化，比较能量；也给出在低能态结构上的垂直能隙。',
      fields: [{ k: 'spins', label: '比较的两个自旋多重度', type: 'spins' }] },
    bde: { name: '键解离能', cost: (p) => (p.thermo ? 5 : 2), smiles: () => true, about: '把一根非环单键均裂成两个自由基，各自优化：BDE = E(碎片 1) + E(碎片 2) − E(分子)。',
      fields: [{ k: 'bond', label: '断开的键（只列非环单键）', type: 'bond' }, THERMO, T()] },
    pa: { name: '质子亲和能与去质子化能', cost: (p) => (p.thermo ? 5 : 2), smiles: () => true, about: '在指定的重原子上加一个质子或去掉一个质子，比较优化后的能量。质子亲和能 = E(B) − E(BH⁺)；去质子化能 = E(A⁻) − E(AH)（不含质子本身的能量）。',
      fields: [{ k: 'site', label: '位点（重原子编号）', type: 'site' }, { k: 'mode', label: '方式', type: 'select', def: 'protonate', options: [['protonate', '加质子：质子亲和能'], ['deprotonate', '去质子：去质子化能']] }, THERMO, T()] },
    polar: { name: '偶极矩与极化率', cost: (p) => (p.average ? 5 : 1), smiles: (p) => !!p.average, about: '偶极矩和完整的极化率张量；可以对多个构象按 Boltzmann 权重平均。',
      fields: [{ k: 'average', label: '按构象的 Boltzmann 权重平均（要用 SMILES）', type: 'bool', def: false }, { k: 'n', label: '平均用的构象数', type: 'int', lo: 2, hi: 20, def: 8 }] },
    ir: { name: '红外与拉曼光谱', cost: () => 3, about: 'MACE-OFF23 medium 优化并求振动模式，MACE-MDP 给出偶极矩和极化率对振动的导数，得到红外强度和拉曼活性。', fields: [] }
  };

  // ── 状态 ────────────────────────────────────────────────────────────────
  const tabs = [...document.querySelectorAll('#m-tabs [data-win]')];
  const S = { win: 'charged', model: {}, job: {}, values: {}, compare: new Set(), mode: 'smiles' };
  let health = null, online = false, busy = false;
  let mol = null, g = null, xyz = null; // describe() and atom graph of the SMILES; the parsed XYZ
  let formKey = '';

  const umaApi = () => (window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
  const session = () => store.get('molastria-session') || '';
  const isPro = () => { try { return !!session() && !!JSON.parse(store.get('molastria-account') || 'null')?.pro; } catch { return false; } };
  async function umaCall(path, opts = {}) {
    const token = session();
    const res = await fetch(umaApi() + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error?.message || data.error || `HTTP ${res.status}`), { status: res.status });
    return data;
  }
  const st = (id) => health?.models?.[id];
  const can = (id, job) => !!st(id)?.jobs?.includes(job);

  // ── 结构 ────────────────────────────────────────────────────────────────
  function electrons(counts, charge) {
    let z = 0;
    for (const [sym, n] of Object.entries(counts)) z += Math.max(0, L.SYMBOLS.indexOf(sym)) * n;
    return z - charge;
  }
  const defaultSpin = (info, charge) => (info.radicals ? info.radicals + 1 : electrons(info.counts, charge) % 2 ? 2 : 1);

  /** Atoms and bonds in SMILES order (RDKit keeps it); hydrogens added by AddHs follow the heavy atoms in that order. */
  function graphOf(smiles) {
    let m = null;
    try {
      m = R.get_mol(smiles);
      if (!m || (m.is_valid && !m.is_valid())) return null;
      const j = JSON.parse(m.get_json()), mm = j.molecules[0], da = j.defaults?.atom || {}, db = j.defaults?.bond || {};
      let hNext = mm.atoms.length;
      const atoms = mm.atoms.map((a, i) => {
        const h = a.impHs ?? da.impHs ?? 0, at = { i, sym: L.SYMBOLS[a.z ?? da.z ?? 6] || '?', h, hFirst: h ? hNext : -1, nb: [] };
        hNext += h;
        return at;
      });
      const bonds = (mm.bonds || []).map((b, k) => ({ k, a: b.atoms[0], b: b.atoms[1], bo: b.bo ?? db.bo ?? 1 }));
      for (const b of bonds) { atoms[b.a].nb.push(b.b); atoms[b.b].nb.push(b.a); }
      // A bond is in a ring when its ends stay connected without it.
      const linked = (s, t, skip) => {
        const seen = new Set([s]), todo = [s];
        while (todo.length) {
          const x = todo.pop();
          for (const y of atoms[x].nb) {
            if ((x === skip.a && y === skip.b) || (x === skip.b && y === skip.a) || seen.has(y)) continue;
            if (y === t) return true;
            seen.add(y); todo.push(y);
          }
        }
        return false;
      };
      for (const b of bonds) b.ring = linked(b.a, b.b, b);
      return { smiles, atoms, bonds };
    } catch { return null; } finally { m?.delete?.(); }
  }
  function draw(smiles, hiAtoms = [], hiBonds = []) {
    let m = null;
    try {
      m = R.get_mol(smiles);
      if (!m) return '';
      return m.get_svg_with_highlights(JSON.stringify({ width: 340, height: 220, addAtomIndices: true, atoms: hiAtoms, bonds: hiBonds, bondLineWidth: 1.4, clearBackground: false, padding: 0.1 }));
    } catch { return ''; } finally { m?.delete?.(); }
  }
  const heavy = () => (g ? g.atoms.filter((a) => a.sym !== 'H') : []);
  const atomName = (a) => `${a.sym}${a.i}`;
  /** Bonds a BDE can break: acyclic single bonds between heavy atoms, and one X–H bond per heavy atom. */
  function breakable() {
    if (!g) return [];
    const out = g.bonds.filter((b) => !b.ring && b.bo === 1 && g.atoms[b.a].sym !== 'H' && g.atoms[b.b].sym !== 'H').map((b) => ({ v: `${b.a}-${b.b}`, label: `${atomName(g.atoms[b.a])}–${atomName(g.atoms[b.b])}`, bond: b.k }));
    for (const a of g.atoms) if (a.h && a.sym !== 'H') out.push({ v: `${a.i}-${a.hFirst}`, label: `${atomName(a)}–H${a.hFirst}`, bond: -1 });
    return out;
  }
  /** A dihedral a-b-c-d around an acyclic single bond, when the molecule has one. */
  function defaultDihedral() {
    if (!g) return [0, 1, 2, 3];
    const H = (i) => g.atoms[i].sym === 'H';
    const pick = (ringOk) => {
      for (const b of g.bonds) {
        if ((!ringOk && (b.ring || b.bo !== 1)) || H(b.a) || H(b.b)) continue;
        const a = g.atoms[b.a].nb.find((x) => x !== b.b && !H(x)), d = g.atoms[b.b].nb.find((x) => x !== b.a && !H(x) && x !== a);
        if (a !== undefined && d !== undefined) return [a, b.a, b.b, d];
      }
      return null;
    };
    return pick(false) || pick(true) || [0, 1, 2, 3];
  }

  /** The XYZ text as the account service checks it: atom count 1-120, a comment line, "Symbol x y z" per atom. */
  function parseXyz(text) {
    const v = text.replace(/\r/g, '');
    if (!v.trim()) return { error: '先粘贴或上传一个 XYZ 结构。' };
    if (v.length > 12000) return { error: 'XYZ 结构最多 12000 个字符。' };
    if (/[^\x20-\x7e\t\n]/.test(v)) return { error: 'XYZ 结构只能包含普通 ASCII 字符。' };
    const lines = v.replace(/^\s*\n/, '').split('\n');
    const n = Number(lines[0].trim());
    if (!Number.isInteger(n) || n < 1 || n > 120) return { error: 'XYZ 的第一行要是原子数；在线计算最多 120 个原子。' };
    const rows = lines.slice(2, 2 + n).map((l) => l.trim().split(/\s+/));
    if (rows.length !== n || !rows.every((f) => f.length >= 4 && /^[A-Z][a-z]?$/.test(f[0]) && f.slice(1, 4).every((x) => Number.isFinite(Number(x))))) return { error: 'XYZ 的原子行要写成“元素符号 x y z”，行数要和第一行的原子数一致。' };
    const symbols = rows.map((f) => f[0]);
    const unknown = [...new Set(symbols.filter((s) => L.SYMBOLS.indexOf(s) < 1))];
    if (unknown.length) return { error: `不认识的元素符号：${unknown.join('、')}` };
    const counts = {};
    for (const s of symbols) counts[s] = (counts[s] || 0) + 1;
    const formula = ['C', 'H', ...Object.keys(counts).filter((e) => e !== 'C' && e !== 'H').sort()].filter((e) => counts[e]).map((e) => e + (counts[e] > 1 ? counts[e] : '')).join('');
    return { n, symbols, counts, formula, text: lines.slice(0, 2 + n).join('\n') + '\n' };
  }

  // ── 表单 ────────────────────────────────────────────────────────────────
  const G = () => GROUPS[S.win];
  const job = () => S.job[S.win];
  const vals = (j = job()) => (S.values[j] ||= {});
  const charge = () => (G().charged ? Math.round(Number($('m-charge').value) || 0) : 0);
  const spin = () => (G().charged ? Math.max(1, Math.round(Number($('m-spin').value) || 1)) : 1);
  const runModels = () => (S.compare.size >= 1 && $('m-compare-on').checked ? G().models.filter((id) => S.compare.has(id)) : [$('m-model').value]);

  function param(f) { // the current value of one field, or its default
    const v = vals()[f.k];
    if (f.type === 'atoms') return v || (S.mode === 'smiles' ? defaultDihedral() : [0, 1, 2, 3]);
    if (f.type === 'spins') { const s = spin(); return v || [s, s + 2 <= 4 ? s + 2 : s - 2]; } // same parity: both fit the electron count
    if (f.type === 'bond') { const list = breakable(); return list.some((b) => b.v === v) ? v : list[0]?.v || ''; }
    if (f.type === 'site') { const hv = heavy(); return hv.some((a) => a.i === v) ? v : (hv.find((a) => /^(N|O|S|P)$/.test(a.sym)) || hv[0])?.i ?? 0; }
    return v ?? f.def;
  }
  function params(j = job()) {
    const out = {};
    for (const f of JOBS[j].fields) {
      const v = param(f);
      out[f.k] = f.type === 'bond' ? String(v).split('-').map(Number) : f.type === 'reaction' ? String(v).trim() : v;
    }
    return out;
  }
  function formHtml(j) {
    const opts = (list, v) => list.map(([val, label]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(label)}</option>`).join('');
    const atomOpts = () => (S.mode === 'xyz' && xyz?.symbols ? xyz.symbols.map((s, i) => [i, `${s}${i}`]) : heavy().map((a) => [a.i, atomName(a)]));
    return JOBS[j].fields.map((f) => {
      const v = param(f);
      if (f.type === 'bool') return `<label class="md-checkbox md-full"><input type="checkbox" data-k="${f.k}"${v ? ' checked' : ''}> ${esc(f.label)}</label>`;
      if (f.type === 'select') return `<label>${esc(f.label)}<select data-k="${f.k}">${opts(f.options, v)}</select></label>`;
      if (f.type === 'reaction') return `<label class="md-full">${esc(f.label)}<input type="text" data-k="${f.k}" value="${esc(v)}" maxlength="400" spellcheck="false" autocomplete="off"></label>`;
      if (f.type === 'atoms') return `<div class="md-full"><span class="small muted">${esc(f.label)}</span><div class="md-atoms">${[0, 1, 2, 3].map((n) => `<select data-k="atoms" data-n="${n}" aria-label="第 ${n + 1} 个原子">${opts(atomOpts(), v[n])}</select>`).join('')}</div></div>`;
      if (f.type === 'spins') return `<div class="md-full"><span class="small muted">${esc(f.label)}</span><div class="md-pair">${[0, 1].map((n) => `<select data-k="spins" data-n="${n}" aria-label="第 ${n + 1} 个自旋多重度">${opts([1, 2, 3, 4].map((m) => [m, `${m}（${['单重态', '二重态', '三重态', '四重态'][m - 1]}）`]), v[n])}</select>`).join('')}</div></div>`;
      if (f.type === 'bond') { const list = breakable(); return `<label class="md-full">${esc(f.label)}<select data-k="bond">${list.length ? opts(list.map((b) => [b.v, b.label]), v) : '<option value="">这个分子没有可以断开的非环单键</option>'}</select></label>`; }
      if (f.type === 'site') return `<label>${esc(f.label)}<select data-k="site">${opts(heavy().map((a) => [a.i, a.h ? `${atomName(a)}（${a.h} 个氢）` : atomName(a)]), v)}</select></label>`;
      return `<label>${esc(f.label)}<input type="number" data-k="${f.k}" value="${esc(v)}" min="${f.lo}" max="${f.hi}" step="${f.type === 'int' ? 1 : f.step}"><small>${f.lo} – ${f.hi}，默认 ${f.def}</small></label>`;
    }).join('');
  }
  $('m-params').addEventListener('input', (e) => {
    const el = e.target.closest('[data-k]');
    if (!el) return;
    const f = JOBS[job()].fields.find((x) => x.k === el.dataset.k), v = vals();
    if (f.type === 'atoms' || f.type === 'spins') { const cur = [...param(f)]; cur[Number(el.dataset.n)] = Number(el.value); v[f.k] = cur; }
    else if (f.type === 'bool') v[f.k] = el.checked;
    else if (f.type === 'site') v[f.k] = Number(el.value);
    else if (f.type === 'num' || f.type === 'int') v[f.k] = el.value === '' ? NaN : Number(el.value);
    else v[f.k] = el.value;
    sync();
  });

  // ── 检查：哪些情况不能提交 ─────────────────────────────────────────────
  function problem() {
    if (!health) return '';
    if (!online) return '站长的 GPU 现在离线，请稍后再试。';
    const j = job(), models = runModels(), p = params(j);
    if ($('m-compare-on').checked && models.length < 2) return '多模型对比至少要选两个模型。';
    for (const id of models) {
      if (!st(id)?.ready) return `${MODELS[id].name} 现在没有在站长电脑上运行，请换一个模型。`;
      if (!can(id, j)) return `${MODELS[id].name} 现在不做“${JOBS[j].name}”。`;
    }
    let symbols = null, electronCount = null, ionCharge = 0;
    if (j === 'rxn') {
      const r = p.reaction, sides = r.split('>>');
      if (sides.length !== 2 || sides.some((s) => !s.trim())) return `反应 SMILES 要写成“反应物${RXN}产物”。`;
      if (r.length > 400) return '反应 SMILES 最多 400 个字符。';
      const species = sides.map((s) => s.split('.'));
      if (species.flat().length > 6) return '反应物和产物一共最多 6 个物种（重复的物种按个数算）。';
      if (R) {
        symbols = new Set();
        for (const s of species.flat()) {
          const d = L.describe(R, s);
          if (!d) return `RDKit 无法解析反应里的物种 ${s}。`;
          d.elements.forEach((e) => symbols.add(e));
          if (!G().charged && (d.charge !== 0 || electrons(d.counts, d.charge) % 2)) return `${G().name}只算中性闭壳层分子：${s} 带电荷或有未成对电子，请换到窗口 ① 计算。`;
        }
        symbols = [...symbols];
      }
    } else if (S.mode === 'smiles') {
      if (!$('m-smiles').value.trim()) return '先输入一个 SMILES。';
      if (!R) return '正在载入 RDKit…';
      if (!mol) return 'RDKit 无法解析这个 SMILES，请先修正。';
      if (mol.heavy > 30) return 'SMILES 输入最多 30 个重原子；更大的分子请用 XYZ 输入（最多 120 个原子）。';
      symbols = mol.elements; ionCharge = mol.charge; electronCount = electrons(mol.counts, G().charged ? charge() : mol.charge);
    } else {
      if (!xyz || xyz.error) return xyz?.error || '先粘贴或上传一个 XYZ 结构。';
      if (JOBS[j].smiles?.(p)) return `“${JOBS[j].name}”要从 SMILES 生成结构，请换成 SMILES 输入。`;
      symbols = Object.keys(xyz.counts); electronCount = electrons(xyz.counts, charge());
    }
    for (const id of models) {
      const out = MODELS[id].elements && symbols ? symbols.filter((x) => !MODELS[id].elements.includes(x)) : [];
      if (out.length) return `${MODELS[id].name} 不认识 ${out.join('、')}。`;
    }
    if (j !== 'rxn') {
      if (!G().charged && (ionCharge !== 0 || electronCount % 2)) return `${G().name}只算中性闭壳层分子：这个结构带电荷或有未成对电子，请换到窗口 ① 计算。`;
      if (G().charged && electronCount !== null && (electronCount % 2 === 1) !== (spin() % 2 === 0)) return `电荷 ${charge()} 时有 ${electronCount} 个电子，和自旋多重度 ${spin()} 不相容。`;
    }
    for (const f of JOBS[j].fields) {
      if ((f.type === 'num' || f.type === 'int') && !(p[f.k] >= f.lo && p[f.k] <= f.hi && (f.type !== 'int' || Number.isInteger(p[f.k])))) return `${f.label}要在 ${f.lo} 到 ${f.hi} 之间${f.type === 'int' ? '，取整数' : ''}。`;
    }
    if (j === 'scan') {
      if (S.mode === 'smiles' && heavy().length < 4) return '二面角扫描要至少 4 个重原子。';
      if (new Set(p.atoms).size !== 4) return '二面角的四个原子要各不相同。';
      if (p.end <= p.start) return '终止角要大于起始角。';
    }
    if (j === 'scan' && S.mode === 'xyz' && p.atoms.some((i) => i >= xyz.n)) return '二面角扫描要至少 4 个原子。';
    if (j === 'spin' && p.spins[0] === p.spins[1]) return '请选两个不同的自旋多重度。';
    if (j === 'spin' && electronCount !== null && p.spins.some((m) => (electronCount % 2 === 1) !== (m % 2 === 0))) return `${electronCount} 个电子只能取${electronCount % 2 ? '偶数（2、4）' : '奇数（1、3）'}的自旋多重度。`;
    if (j === 'bde' && !breakable().length) return '这个分子没有可以断开的非环单键。';
    if (j === 'pa' && p.mode === 'deprotonate' && !g?.atoms[p.site]?.h) return `${atomName(g.atoms[p.site])} 上没有氢，不能去质子。`;
    if (models.some((id) => MODELS[id].tier === 'asl') && !$('m-academic').checked) return '请先勾选学术用途确认。';
    if (models.some((id) => MODELS[id].tier === 'pro') && !isPro()) return 'ANI-2x 是 Pro 会员的模型，请先登录 Pro 账号；其余模型对所有人免费。';
    return '';
  }

  // ── 同步界面 ────────────────────────────────────────────────────────────
  function sync() {
    const grp = G();
    tabs.forEach((b) => b.setAttribute('aria-selected', String(b.dataset.win === S.win)));
    $('m-win-about').textContent = grp.intro;
    const msel = $('m-model'), jsel = $('m-job');
    if (msel.dataset.win !== S.win) { // a new window: its own models and jobs
      msel.innerHTML = grp.models.map((id) => `<option value="${id}">${esc(MODELS[id].name)}${MODELS[id].tier === 'pro' ? '（Pro 会员）' : ''}</option>`).join('');
      msel.value = S.model[S.win] || grp.models[0];
      jsel.innerHTML = grp.jobs.map((j) => `<option value="${j}">${esc(JOBS[j].name)}</option>`).join('');
      jsel.value = S.job[S.win] || grp.jobs[0];
      msel.dataset.win = S.win;
      $('m-compare').innerHTML = grp.models.map((id) => `<label><input type="checkbox" value="${id}"${S.compare.has(id) ? ' checked' : ''}> ${esc(MODELS[id].name)}</label>`).join('');
      $('m-cards').innerHTML = grp.models.map(card).join('');
      formKey = '';
    }
    const model = msel.value, M = MODELS[model];
    S.model[S.win] = model;
    for (const o of msel.options) o.disabled = !!health?.models && !st(o.value)?.ready && o.value !== model;
    const compareOn = $('m-compare-on').checked && grp.models.length > 1;
    $('m-compare').hidden = !compareOn;
    $('m-compare-on').closest('label').hidden = grp.models.length < 2;
    const models = runModels();
    // Only the jobs every chosen model offers right now.
    for (const o of jsel.options) o.disabled = !!health?.models && !models.every((id) => can(id, o.value));
    if (jsel.selectedOptions[0]?.disabled) jsel.value = [...jsel.options].find((o) => !o.disabled)?.value || jsel.value;
    S.job[S.win] = jsel.value;
    const j = job();
    $('m-about').textContent = M.about;
    $('m-direct').hidden = !models.some((id) => MODELS[id].direct);
    $('m-job-about').textContent = JOBS[j].about;
    $('m-cs').hidden = !grp.charged || j === 'rxn';
    $('m-struct').hidden = j === 'rxn';
    $('m-rxn-note').hidden = j !== 'rxn';
    $('m-smiles-box').hidden = S.mode !== 'smiles';
    $('m-xyz-box').hidden = S.mode !== 'xyz';
    // Structure check line and the numbered drawing (highlights follow the chosen atoms or bond).
    const check = $('m-check');
    if (S.mode === 'smiles') {
      if (!R) { check.textContent = '正在载入 RDKit…'; check.dataset.bad = 'false'; }
      else if (!mol) { check.textContent = $('m-smiles').value.trim() ? 'RDKit 无法解析这个 SMILES，请先修正。' : '先输入一个 SMILES。'; check.dataset.bad = 'true'; }
      else { check.textContent = `${mol.formula} · ${mol.heavy} 个重原子 · ${electrons(mol.counts, grp.charged ? charge() : mol.charge)} 个电子${mol.charge ? ` · 形式电荷 ${mol.charge > 0 ? '+' : ''}${mol.charge}` : ''}`; check.dataset.bad = 'false'; }
      const p = params(j);
      const hiA = j === 'scan' ? p.atoms : j === 'pa' ? [p.site] : j === 'bde' ? p.bond.filter((i) => g && i < g.atoms.length) : [];
      const hiB = j === 'bde' ? [breakable().find((b) => b.v === p.bond.join('-'))?.bond].filter((k) => k >= 0) : [];
      $('m-art').innerHTML = R && mol ? draw($('m-smiles').value.trim(), hiA, hiB) : '';
    } else {
      check.textContent = xyz && !xyz.error ? `XYZ · ${xyz.n} 个原子 · ${xyz.formula}` : xyz?.error || '先粘贴或上传一个 XYZ 结构。';
      check.dataset.bad = String(!!xyz?.error);
    }
    // The params form is rebuilt only when what it lists changes, so typing keeps focus.
    const key = `${S.win}|${j}|${S.mode}|${g?.smiles || ''}|${xyz?.n || ''}${xyz?.formula || ''}`;
    if (key !== formKey) { $('m-params').innerHTML = formHtml(j); formKey = key; }
    $('m-asl').hidden = !models.some((id) => MODELS[id].tier === 'asl');
    const cost = JOBS[j].cost(params(j)), total = cost * models.length;
    const run = $('m-run');
    run.textContent = models.length > 1 ? `依次运行 ${models.length} 个模型 · 消耗 ${total} 次` : `运行 · 消耗 ${cost} 次`;
    run.dataset.cost = String(total);
    const why = problem();
    $('m-why').textContent = busy ? '' : why;
    run.disabled = busy || !online || !!why;
    // One text node per licence, so each one translates on its own.
    const fines = [...new Set(models.map((id) => MODELS[id].fine))].map((t) => `<span>${esc(t)}</span>`).join('');
    $('m-fine').innerHTML = `<span>提交即表示同意：</span>${fines}<span>结果按原样提供，不作任何保证。</span>`;
    status();
  }
  function card(id) {
    const M = MODELS[id], tierTag = { fair: '免费', asl: '免费 · 学术许可', pro: 'Pro 会员' }[M.tier];
    return `<article class="md-model"><h3>${esc(M.name)}</h3><p><span class="tag${M.tier === 'pro' ? ' pro' : ''}">${tierTag}</span>${M.direct ? '<span class="tag">直接受力型</span>' : ''}<code>${esc(id)}</code></p><p>${esc(M.about)}</p><p class="muted small">训练数据：${esc(M.dft)} · 许可：${esc(M.license)}</p></article>`;
  }
  function status() {
    const box = $('m-status');
    if (!health) return;
    if (health.configured === false || !umaApi()) { box.innerHTML = '<span class="chip warn">! 在线计算服务还没有开通</span>'; return; }
    if (!online) { box.innerHTML = '<span class="chip warn">! 站长的 GPU 现在离线，请稍后再来；也可以用 <a href="../meta/index.html#uma">Meta 页的脚本</a>在自己的电脑上算</span>'; return; }
    const ready = Object.values(health.models || {}).filter((m) => m.ready).length;
    const M = MODELS[$('m-model').value], s = st($('m-model').value);
    box.innerHTML = `<span class="chip ok">✓ 在线 · ${ready} 个模型${health.gpu ? ` · ${esc(health.gpu)}` : ''}</span>${s ? `<span class="chip" id="m-queue">${esc(M.name)}：${s.running ? '正在为一位访客计算' : '空闲'}，排队 ${Number(s.queue) || 0} 个</span>` : ''}`;
  }
  async function refresh() {
    if (!umaApi()) { health = { configured: false }; online = false; sync(); return; }
    try {
      health = await umaCall('/uma/health');
      online = !!health.online;
    } catch { health = { online: false }; online = false; }
    sync();
  }

  // ── 运行 ────────────────────────────────────────────────────────────────
  function body(model) {
    const j = job(), b = { model, job: j };
    if (j !== 'rxn') {
      if (S.mode === 'xyz') b.xyz = xyz.text; else b.smiles = $('m-smiles').value.trim();
      if (G().charged) { b.charge = charge(); b.spin = spin(); }
    }
    const p = params(j);
    if (Object.keys(p).length) b.params = p;
    if (MODELS[model].tier === 'asl') b.academic = true;
    return b;
  }
  const say = (html) => { $('m-progress').innerHTML = html; };
  async function runOne(model, prefix) {
    const M = MODELS[model];
    say(`${prefix}<span>已提交 ${esc(M.name)}…</span>`);
    let r = await umaCall('/uma/jobs', { method: 'POST', body: JSON.stringify(body(model)) });
    const until = Date.now() + 20 * 60 * 1000;
    while (r.status !== 'done' && r.status !== 'error') {
      const pr = r.progress && Number(r.progress.total) ? `（进度 ${Number(r.progress.done) || 0}/${Number(r.progress.total)}${r.progress.note ? ` · ${esc(r.progress.note)}` : ''}）` : '';
      say(prefix + (r.status === 'running' ? `<span>${esc(M.name)} 正在计算…${pr}</span>` : `<span>排队中，${esc(M.name)} 前面还有 ${Math.max(0, (r.position || 1) - 1)} 个任务…</span>`));
      if (Date.now() > until) throw new Error('等了 20 分钟还没算完，请稍后再试');
      await new Promise((ok) => setTimeout(ok, 1500));
      r = await umaCall(`/uma/jobs/${r.id}`);
    }
    if (r.status === 'error') throw new Error(r.error || '计算失败');
    return r.result;
  }
  let shown = []; // results on screen: {model, r} or {model, error}
  $('m-run').addEventListener('click', async () => {
    const models = runModels(), j = job();
    busy = true; sync();
    shown = [];
    $('m-result').innerHTML = '';
    try {
      for (const [i, model] of models.entries()) {
        const prefix = models.length > 1 ? `<b>${i + 1}/${models.length}</b> ` : '';
        try { shown.push({ model, job: j, r: await runOne(model, prefix) }); }
        catch (e) { shown.push({ model, job: j, error: e.message }); if (e.status === 429 || e.status === 503) break; }
        paint();
      }
    } finally {
      busy = false; say('');
      paint();
      refresh();
    }
  });

  // ── 结果 ────────────────────────────────────────────────────────────────
  const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
  const td = (v, d = 3, neg = false) => `<td class="n${neg && v < 0 ? ' neg' : ''}">${f(v, d)}</td>`;
  const table = (head, rows) => `<div class="md-table"><table><thead><tr>${head.map((h) => `<th>${h}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;
  const csvOf = (head, rows) => [head.join(','), ...rows.map((r) => r.map((x) => (/[,"\n]/.test(String(x ?? '')) ? `"${String(x).replace(/"/g, '""')}"` : x ?? '')).join(','))].join('\n') + '\n';

  /** Simple line / stick chart as inline SVG. series: [{pts: [[x, y]], dots?}], sticks: [[x, y]]. */
  function plot({ series = [], sticks = [], xlabel, ylabel, legend = [], xrev = false, w = 600, h = 250 }) {
    const all = [...series.flatMap((s) => s.pts), ...sticks];
    if (!all.length) return '';
    let [x0, x1] = [Math.min(...all.map((p) => p[0])), Math.max(...all.map((p) => p[0]))];
    let [y0, y1] = [Math.min(...all.map((p) => p[1]), sticks.length ? 0 : Infinity), Math.max(...all.map((p) => p[1]))];
    if (x1 === x0) { x0 -= 1; x1 += 1; }
    if (y1 === y0) { y0 -= 1; y1 += 1; }
    const pad = (y1 - y0) * 0.06; y0 -= sticks.length ? 0 : pad; y1 += pad;
    const L0 = 58, R0 = 14, T0 = 14, B0 = 40;
    const X = (x) => L0 + ((xrev ? x1 - x : x - x0) / (x1 - x0)) * (w - L0 - R0), Y = (y) => h - B0 - ((y - y0) / (y1 - y0)) * (h - T0 - B0);
    const ticks = (a, b) => {
      const raw = (b - a) / 5, mag = 10 ** Math.floor(Math.log10(raw)), step = [1, 2, 5, 10].map((m) => m * mag).find((s) => s >= raw);
      const out = [];
      for (let t = Math.ceil(a / step) * step; t <= b + step * 1e-9; t += step) out.push(+t.toFixed(10));
      return out;
    };
    const fmt = (t) => (Math.abs(t) >= 1000 || Number.isInteger(t) ? String(Math.round(t)) : String(+t.toPrecision(3)));
    let s = `<svg class="md-plot" viewBox="0 0 ${w} ${h}" role="img" aria-label="${esc(ylabel)}">`;
    for (const t of ticks(y0, y1)) s += `<line class="grid" x1="${L0}" x2="${w - R0}" y1="${Y(t)}" y2="${Y(t)}"/><text x="${L0 - 6}" y="${Y(t) + 4}" text-anchor="end">${fmt(t)}</text>`;
    for (const t of ticks(x0, x1)) s += `<line class="ax" x1="${X(t)}" x2="${X(t)}" y1="${h - B0}" y2="${h - B0 + 4}"/><text x="${X(t)}" y="${h - B0 + 16}" text-anchor="middle">${fmt(t)}</text>`;
    s += `<line class="ax" x1="${L0}" x2="${w - R0}" y1="${h - B0}" y2="${h - B0}"/><line class="ax" x1="${L0}" x2="${L0}" y1="${T0}" y2="${h - B0}"/>`;
    for (const [x, y] of sticks) s += `<line class="stick" x1="${X(x)}" x2="${X(x)}" y1="${Y(0)}" y2="${Y(y)}"/>`;
    series.forEach((se, i) => {
      s += `<polyline class="s${i}" points="${se.pts.map(([x, y]) => `${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join(' ')}"/>`;
      if (se.dots) se.pts.forEach(([x, y], k) => { s += `<circle class="dot${se.off?.[k] ? ' off' : ''}" cx="${X(x)}" cy="${Y(y)}" r="3"/>`; });
    });
    legend.forEach((t, i) => { s += `<rect class="lg${i}" x="${L0 + 10 + i * 120}" y="${T0}" width="10" height="3"/><text x="${L0 + 24 + i * 120}" y="${T0 + 5}">${esc(t)}</text>`; });
    s += `<text x="${(L0 + w - R0) / 2}" y="${h - 6}" text-anchor="middle">${esc(xlabel)}</text><text transform="translate(13 ${(T0 + h - B0) / 2}) rotate(-90)" text-anchor="middle">${esc(ylabel)}</text></svg>`;
    return s;
  }
  function spectrum(r, kind, fwhm) {
    const nu = r.frequencies_cm1 || [], amp = (kind === 'raman' ? r.raman_activity_a4_amu : r.ir_intensity_km_mol) || [];
    const pairs = nu.map((x, i) => [x, Number(amp[i]) || 0]).filter(([x]) => x > 0);
    if (!pairs.length) return '<p class="muted">没有实频振动。</p>';
    const top = Math.max(...pairs.map((p) => p[1])) || 1, g2 = (fwhm / 2) ** 2;
    const lo = Math.max(0, Math.min(...pairs.map((p) => p[0])) - 150), hi = Math.max(...pairs.map((p) => p[0])) + 150;
    const curve = Array.from({ length: 400 }, (_, i) => { const x = lo + ((hi - lo) * i) / 399; return [x, pairs.reduce((sum, [c, a]) => sum + a * g2 / ((x - c) ** 2 + g2), 0)]; });
    const ctop = Math.max(...curve.map((p) => p[1])) || 1;
    return plot({ series: [{ pts: curve.map(([x, y]) => [x, y / ctop]) }], sticks: pairs.map(([x, a]) => [x, a / top]), xlabel: '波数（cm⁻¹）', ylabel: kind === 'raman' ? '拉曼活性（相对）' : '红外强度（相对）', xrev: true });
  }
  const warnImag = (n) => (n > 0 ? `<p class="md-warn">有 ${n} 个虚频（表里是负数）：这个结构不是能量极小点，可能是过渡态或没有优化好，热化学数值不可靠。</p>` : '');

  /** One result: what it shows, plus the CSV and XYZ its buttons hand out. */
  function view(r) {
    const csv = [], c = (head, rows) => csv.push(csvOf(head, rows));
    let html = '', xyzOut = r.xyz || '';
    const e4 = f(r.energy_ev, 4); // tags stay in the templates so i18n-extract sees whole text nodes
    switch (r.job) {
      case 'sp': {
        const F = r.forces_ev_a || [];
        html = `<p>能量 <b>${e4} eV</b>，最大受力 ${f(r.fmax_ev_a, 4)} eV/Å。</p><details><summary>每个原子的受力（eV/Å）</summary>${table(['原子', 'Fx', 'Fy', 'Fz'], F.map((v, i) => `<tr><td>${i}</td>${td(v[0], 4)}${td(v[1], 4)}${td(v[2], 4)}</tr>`))}</details>`;
        c(['atom', 'fx_ev_a', 'fy_ev_a', 'fz_ev_a'], F.map((v, i) => [i, ...v]));
        break;
      }
      case 'opt':
        html = `<p>能量 <b>${e4} eV</b>，${r.steps ?? '?'} 步，最大受力 ${f(r.fmax_ev_a, 4)} eV/Å。</p>${r.converged === false ? '<p class="md-warn">优化没有在步数上限内收敛，结构可能不是极小点。</p>' : ''}`;
        c(['energy_ev', 'steps', 'converged', 'fmax_ev_a'], [[r.energy_ev, r.steps, r.converged, r.fmax_ev_a]]);
        break;
      case 'freq': {
        const t = r.thermo || {}, fr = r.frequencies_cm1 || [];
        html = `<p>优化后的能量 <b>${e4} eV</b>（优化 ${r.steps ?? '?'} 步）${r.linear ? '，线性分子' : ''}。</p>${warnImag(r.n_imag)}`
          + `<p class="small muted">振动频率（cm⁻¹，共 ${fr.length} 个）：</p><div class="md-freqs">${fr.map((v) => `<span class="${v < 0 ? 'neg' : ''}">${f(v, 1)}</span>`).join('')}</div>`
          + table([`热化学（${f(t.temperature_k, 2)} K）`, 'eV', 'kcal/mol'], [['零点能 ZPE', r.zpe_ev], ['焓校正 H_corr', t.h_corr_ev], ['吉布斯自由能校正 G_corr', t.g_corr_ev], ['焓 H', t.h_ev], ['吉布斯自由能 G', t.g_ev]].map(([n, v]) => `<tr><td>${n}</td>${td(v, 4)}${td(v * KCAL, 2)}</tr>`).concat([`<tr><td>熵 S</td><td class="n">${f(t.s_ev_k * 1e3, 4)} meV/K</td><td class="n">${f(t.s_ev_k * KCAL * 1e3, 2)} cal/(mol·K)</td></tr>`]));
        c(['mode', 'frequency_cm1'], fr.map((v, i) => [i + 1, v]));
        c(['quantity', 'value'], [['energy_ev', r.energy_ev], ['zpe_ev', r.zpe_ev], ['temperature_k', t.temperature_k], ['h_corr_ev', t.h_corr_ev], ['s_ev_k', t.s_ev_k], ['g_corr_ev', t.g_corr_ev], ['h_ev', t.h_ev], ['g_ev', t.g_ev], ['n_imag', r.n_imag]]);
        break;
      }
      case 'conf': {
        const cs = r.conformers || [];
        html = `<p>生成 ${r.n_generated ?? '?'} 个构象，去重后 ${r.n_unique ?? cs.length} 个；Boltzmann 权重按 ${f(r.temperature_k, 2)} K 计算。</p>`
          + table(['排序', '相对能量（kcal/mol）', 'Boltzmann 权重', '能量（eV）', ''], cs.map((x, i) => `<tr><td>${x.rank}</td>${td(x.rel_kcal, 2)}<td class="n">${f(x.weight * 100, 1)}%</td>${td(x.energy_ev, 4)}<td><button type="button" class="text-button" data-act="conf-xyz" data-k="${i}">下载</button></td></tr>`));
        c(['rank', 'energy_ev', 'rel_kcal', 'weight'], cs.map((x) => [x.rank, x.energy_ev, x.rel_kcal, x.weight]));
        xyzOut = cs.map((x) => x.xyz || '').join('') || xyzOut;
        break;
      }
      case 'scan': {
        const pts = r.points || [];
        html = `<p>二面角 ${esc((r.atoms || []).join('-'))}，${pts.length} 个点；最高相对能量 <b>${f(Math.max(...pts.map((x) => x.rel_kcal)), 2)} kcal/mol</b>。${pts.some((x) => x.converged === false) ? '红点是没有收敛的点。' : ''}</p>`
          + plot({ series: [{ pts: pts.map((x) => [x.angle_deg, x.rel_kcal]), dots: true, off: pts.map((x) => x.converged === false) }], xlabel: '二面角（°）', ylabel: '相对能量（kcal/mol）' });
        c(['angle_deg', 'energy_ev', 'rel_kcal', 'converged'], pts.map((x) => [x.angle_deg, x.energy_ev, x.rel_kcal, x.converged]));
        break;
      }
      case 'md': {
        const se = r.series || [], e0 = se[0]?.epot_ev ?? 0;
        html = `<p>平均温度 <b>${f(r.mean_temperature_k, 1)} K</b>，模拟时长 ${f(se.at(-1)?.t_fs, 0)} fs。</p>`
          + plot({ series: [{ pts: se.map((x) => [x.t_fs, x.epot_ev - e0]) }, { pts: se.map((x) => [x.t_fs, x.ekin_ev]) }, { pts: se.map((x) => [x.t_fs, x.epot_ev - e0 + x.ekin_ev]) }], legend: ['势能 − 初始势能', '动能', '总能量 − 初始势能'], xlabel: '时间（fs）', ylabel: '能量（eV）' })
          + plot({ series: [{ pts: se.map((x) => [x.t_fs, x.temperature_k]) }], xlabel: '时间（fs）', ylabel: '温度（K）', h: 200 });
        c(['t_fs', 'epot_ev', 'ekin_ev', 'temperature_k'], se.map((x) => [x.t_fs, x.epot_ev, x.ekin_ev, x.temperature_k]));
        break;
      }
      case 'rxn': {
        const sp = r.species || [], hasG = sp.some((x) => x.g_ev !== undefined);
        html = `<p class="smi">${esc(r.reaction)}</p><p>反应能 ΔE = <b>${f(r.delta_e_ev, 3)} eV</b>（换算为 ${f(r.delta_e_kcal, 2)} kcal/mol）。</p>${r.delta_g_ev !== undefined ? `<p>反应自由能 ΔG(${f(r.temperature_k, 2)} K) = <b>${f(r.delta_g_ev, 3)} eV</b>（换算为 ${f(r.delta_g_kcal, 2)} kcal/mol）。</p>` : ''}`
          + table(['', 'SMILES', '个数', '电荷', '自旋', 'E（eV）', ...(hasG ? ['G（eV）'] : [])], sp.map((x) => `<tr><td>${x.side === 'product' ? '产物' : '反应物'}</td><td class="smi">${esc(x.smiles)}</td><td>${x.count}</td><td>${x.charge}</td><td>${x.spin}</td>${td(x.energy_ev, 4)}${hasG ? td(x.g_ev, 4) : ''}</tr>`));
        c(['side', 'smiles', 'count', 'charge', 'spin', 'energy_ev', 'g_ev'], sp.map((x) => [x.side, x.smiles, x.count, x.charge, x.spin, x.energy_ev, x.g_ev]));
        break;
      }
      case 'ipea': {
        const rows = [];
        if (r.ip_ev !== undefined || r.ea_ev !== undefined) rows.push(['绝热', r.ip_ev, r.ea_ev]);
        if (r.ip_vertical_ev !== undefined || r.ea_vertical_ev !== undefined) rows.push(['垂直', r.ip_vertical_ev, r.ea_vertical_ev]);
        html = `<p>中性分子能量 <b>${e4} eV</b>。</p>${table(['', 'IP（eV）', 'EA（eV）'], rows.map(([n, ip, ea]) => `<tr><td>${n}</td>${td(ip)}${td(ea)}</tr>`))}<p class="muted small">IP = E(+1) − E(0)，EA = E(0) − E(−1)；绝热值每个电荷态各自优化，垂直值都用中性分子的结构。</p>`;
        c(['smiles', 'model', 'ip_ev', 'ea_ev', 'ip_vertical_ev', 'ea_vertical_ev'], [[r.smiles, r.model, r.ip_ev, r.ea_ev, r.ip_vertical_ev, r.ea_vertical_ev]]);
        break;
      }
      case 'spin': {
        const s = r.states || [], low = s.reduce((a, b) => (b.energy_ev < a.energy_ev ? b : a), s[0] || {});
        html = `<p>能隙 <b>${f(r.gap_ev, 3)} eV</b>（${f(r.gap_kcal, 2)} kcal/mol），垂直能隙 ${f(r.vertical_gap_ev, 3)} eV；能量较低的是自旋多重度 ${low.spin ?? '?'}。</p>`
          + table(['自旋多重度', '能量（eV）', '相对能量（kcal/mol）'], s.map((x) => `<tr><td>${x.spin}</td>${td(x.energy_ev, 4)}${td((x.energy_ev - low.energy_ev) * KCAL, 2)}</tr>`));
        c(['spin', 'energy_ev'], s.map((x) => [x.spin, x.energy_ev]));
        xyzOut = s.map((x) => x.xyz || '').join('') || xyzOut;
        break;
      }
      case 'bde': {
        const fr = r.fragments || [];
        html = `<p>断开的键 ${esc((r.bond || []).join('–'))}：BDE = <b>${f(r.bde_kcal, 1)} kcal/mol</b>（换算为 ${f(r.bde_ev, 3)} eV）。</p>${r.bdh298_kcal !== undefined ? `<p>298 K 键解离焓：<b>${f(r.bdh298_kcal, 1)} kcal/mol</b></p>` : ''}`
          + table(['', 'SMILES', '自旋', '能量（eV）'], [`<tr><td>分子</td><td class="smi">${esc(r.smiles)}</td><td>${r.spin ?? 1}</td>${td(r.parent_energy_ev, 4)}</tr>`, ...fr.map((x, i) => `<tr><td>碎片 ${i + 1}</td><td class="smi">${esc(x.smiles)}</td><td>${x.spin}</td>${td(x.energy_ev, 4)}</tr>`)]);
        c(['species', 'smiles', 'spin', 'energy_ev'], [['parent', r.smiles, r.spin, r.parent_energy_ev], ...fr.map((x, i) => [`fragment${i + 1}`, x.smiles, x.spin, x.energy_ev])]);
        break;
      }
      case 'pa': {
        const pa = r.mode !== 'deprotonate';
        html = `<p>原子 ${r.site}：${pa ? '质子亲和能' : '去质子化能'} <b>${f(r.value_kcal, 1)} kcal/mol</b>（换算为 ${f(r.value_ev, 3)} eV）。</p>${r.enthalpy_kcal !== undefined ? `<p>298 K 下的焓变：<b>${f(r.enthalpy_kcal, 1)} kcal/mol</b></p>` : ''}`
          + table(['', '能量（eV）'], [`<tr><td>${pa ? '碱 B' : '碱 A⁻'}</td>${td(r.energies?.base_ev, 4)}</tr>`, `<tr><td>${pa ? '共轭酸 BH⁺' : '酸 AH'}</td>${td(r.energies?.acid_ev, 4)}</tr>`]);
        c(['site', 'mode', 'base_ev', 'acid_ev', 'value_ev', 'value_kcal', 'enthalpy_kcal'], [[r.site, r.mode, r.energies?.base_ev, r.energies?.acid_ev, r.value_ev, r.value_kcal, r.enthalpy_kcal]]);
        break;
      }
      case 'polar': {
        const t = r.polarizability_tensor_a3 || [], v = r.dipole_vector || [], w = Array.isArray(r.weights) ? r.weights : [];
        const nc = Number(r.conformers) || w.length; // server.py: conformers is how many were averaged, weights their Boltzmann weights
        html = `<p>偶极矩 <b>${f(r.dipole_debye, 2)} D</b>${v.length ? `（分量 ${v.map((x) => f(x, 2)).join(' / ')} D）` : ''}，各向同性极化率 <b>${f(r.polarizability_a3, 2)} Å³</b>${nc ? `，按 ${nc} 个构象的 Boltzmann 权重平均。` : '。'}</p>`
          + (t.length ? table(['α（Å³）', 'x', 'y', 'z'], ['x', 'y', 'z'].map((a, i) => `<tr><th>${a}</th>${[0, 1, 2].map((k) => td(t[i]?.[k], 2)).join('')}</tr>`)) : '')
          + (w.length ? `<details><summary>各构象的权重</summary>${table(['构象', '权重'], w.map((x, i) => `<tr><td>${i + 1}</td><td class="n">${f(x * 100, 1)}%</td></tr>`))}</details>` : '')
          + `<p class="muted small">结构用 ${esc(MODELS[r.geometry_model]?.name || r.geometry_model || 'MACE-OFF23 medium')} 优化，偶极矩和极化率由 MACE-MDP 预测。</p>`;
        c(['smiles', 'dipole_debye', 'polarizability_a3', 'alpha_xx', 'alpha_yy', 'alpha_zz', 'alpha_xy', 'alpha_xz', 'alpha_yz'], [[r.smiles, r.dipole_debye, r.polarizability_a3, t[0]?.[0], t[1]?.[1], t[2]?.[2], t[0]?.[1], t[0]?.[2], t[1]?.[2]]]);
        break;
      }
      case 'ir': {
        const fr = r.frequencies_cm1 || [];
        html = `${warnImag(r.n_imag)}<div class="md-spec-ctl"><label><input type="radio" name="spec-${r.__i}" value="ir" checked data-act="spec"> 红外</label><label><input type="radio" name="spec-${r.__i}" value="raman" data-act="spec"> 拉曼</label><label>展宽（半峰宽）<input type="range" min="2" max="100" value="20" data-act="spec"><span class="md-fwhm">20</span> cm⁻¹</label></div><div class="md-spec">${spectrum(r, 'ir', 20)}</div>`
          + `<details><summary>振动模式（${fr.length} 个）</summary>${table(['波数（cm⁻¹）', '红外强度（km/mol）', '拉曼活性（Å⁴/amu）'], fr.map((x, i) => `<tr>${td(x, 1, true)}${td(r.ir_intensity_km_mol?.[i], 2)}${td(r.raman_activity_a4_amu?.[i], 2)}</tr>`))}</details>`
          + `<p class="muted small">振动模式来自 ${esc(MODELS[r.geometry_model]?.name || r.geometry_model || 'MACE-OFF23 medium')}；谱线按洛伦兹线型展宽，强度归一化到最高峰。</p>`;
        c(['frequency_cm1', 'ir_intensity_km_mol', 'raman_activity_a4_amu'], fr.map((x, i) => [x, r.ir_intensity_km_mol?.[i], r.raman_activity_a4_amu?.[i]]));
        break;
      }
      default: html = `<p>能量 <b>${e4} eV</b></p>`;
    }
    return { html, csv: csv.join('\n'), xyz: xyzOut };
  }
  /** The few numbers the comparison table shows for each job. */
  function summary(r) {
    const t = r.thermo || {};
    switch (r.job) {
      case 'sp': return [['能量（eV）', f(r.energy_ev, 4)], ['最大受力（eV/Å）', f(r.fmax_ev_a, 4)]];
      case 'opt': return [['能量（eV）', f(r.energy_ev, 4)], ['步数', r.steps ?? '—'], ['收敛', r.converged === false ? '否' : '是']];
      case 'freq': return [['能量（eV）', f(r.energy_ev, 4)], ['虚频数', r.n_imag ?? '—'], ['最低频率（cm⁻¹）', f(Math.min(...(r.frequencies_cm1 || [NaN])), 1)], ['零点能（eV）', f(r.zpe_ev, 4)], ['G（eV）', f(t.g_ev, 4)]];
      case 'conf': return [['不重复的构象', r.n_unique ?? '—'], ['最低能量（eV）', f(r.conformers?.[0]?.energy_ev, 4)], ['最低构象权重', f((r.conformers?.[0]?.weight ?? NaN) * 100, 1) + '%']];
      case 'scan': return [['最高相对能量（kcal/mol）', f(Math.max(...(r.points || []).map((x) => x.rel_kcal)), 2)]];
      case 'md': return [['平均温度（K）', f(r.mean_temperature_k, 1)]];
      case 'rxn': return [['ΔE（kcal/mol）', f(r.delta_e_kcal, 2)], ['ΔG（kcal/mol）', f(r.delta_g_kcal, 2)]];
      case 'ipea': return [['绝热 IP（eV）', f(r.ip_ev)], ['绝热 EA（eV）', f(r.ea_ev)], ['垂直 IP（eV）', f(r.ip_vertical_ev)], ['垂直 EA（eV）', f(r.ea_vertical_ev)]];
      case 'spin': return [['能隙（eV）', f(r.gap_ev, 3)], ['能隙（kcal/mol）', f(r.gap_kcal, 2)], ['垂直能隙（eV）', f(r.vertical_gap_ev, 3)]];
      case 'bde': return [['BDE（kcal/mol）', f(r.bde_kcal, 1)], ['BDH298（kcal/mol）', f(r.bdh298_kcal, 1)]];
      case 'pa': return [[r.mode === 'deprotonate' ? '去质子化能（kcal/mol）' : '质子亲和能（kcal/mol）', f(r.value_kcal, 1)]];
      case 'polar': return [['偶极矩（D）', f(r.dipole_debye, 2)], ['极化率（Å³）', f(r.polarizability_a3, 2)]];
      case 'ir': return [['振动模式', (r.frequencies_cm1 || []).length]];
      default: return [['能量（eV）', f(r.energy_ev, 4)]];
    }
  }
  function paint() {
    const box = $('m-result');
    if (!shown.length) { box.innerHTML = ''; return; }
    let html = '';
    if (shown.length > 1) {
      const first = shown.find((x) => x.r), cols = first ? summary(first.r).map(([k]) => k) : [];
      html += `<div class="md-res md-cmp"><h3>多模型对比 · ${esc(JOBS[shown[0].job].name)}</h3>${table(['模型', ...cols], shown.map((x) => (x.r ? `<tr><td>${esc(MODELS[x.model].name)}</td>${summary(x.r).map(([, v]) => `<td class="n">${esc(v)}</td>`).join('')}</tr>` : `<tr><td>${esc(MODELS[x.model].name)}</td><td colspan="${Math.max(1, cols.length)}" class="muted">${esc(x.error)}</td></tr>`)))}<div class="btns"><button type="button" class="button small" data-act="cmp-csv">复制对比 CSV</button></div></div>`;
    }
    shown.forEach((x, i) => {
      const M = MODELS[x.model];
      if (x.error) { html += `<div class="md-err"><b>${esc(M.name)}</b>：${esc(x.error)}</div>`; return; }
      x.r.__i = i;
      const v = view(x.r);
      x.view = v;
      const lab = x.r.job === 'ipea' && x.r.model === 'uma-s-1p2p1' && Number.isFinite(x.r.ip_uma_s ?? x.r.ip_ev) && x.r.ip_ev !== undefined;
      const head = `<h3>计算完成 · ${esc(M.name)} · ${esc(JOBS[x.r.job]?.name || x.r.job)}${x.r.fake ? '（测试数据）' : ''}</h3>`;
      const btns = `<div class="btns">${lab ? `<button type="button" class="button primary small" data-act="lab" data-i="${i}">导入 AI 实验室 <i class="ico-ext ico-right" aria-hidden="true"></i></button>` : ''}${v.csv ? `<button type="button" class="button small" data-act="csv" data-i="${i}">复制 CSV</button>` : ''}${v.xyz ? `<button type="button" class="button small" data-act="xyz" data-i="${i}">下载结构（.xyz${(v.xyz.match(/^\s*\d+\s*$/gm) || []).length > 1 ? '，多帧' : ''}）</button>` : ''}</div>`;
      const foot = `<p class="muted small">${x.r.seconds ?? '?'} 秒 · 机器学习势的预测，不是 DFT 计算${x.r.direct_forces ? ' · 直接受力型模型：力不是能量的导数，频率由受力差分得到' : ''}。</p>`;
      const body = shown.length > 1 ? `<details${i === 0 ? ' open' : ''}><summary>完整结果</summary>${v.html}</details>` : v.html;
      html += `<div class="md-res" data-i="${i}">${head}${body}${btns}${foot}</div>`;
    });
    box.innerHTML = html;
  }
  $('m-result').addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || b.dataset.act === 'spec') return;
    const x = shown[Number(b.closest('[data-i]')?.dataset.i ?? b.dataset.i)];
    const stem = `${(x?.r?.smiles || 'molecule').replace(/[^\w.-]+/g, '_').slice(0, 40)}_${x?.model || ''}_${x?.r?.job || ''}`;
    if (b.dataset.act === 'cmp-csv') {
      const first = shown.find((y) => y.r), cols = first ? summary(first.r).map(([k]) => k) : [];
      copy(csvOf(['model', ...cols], shown.map((y) => [y.model, ...(y.r ? summary(y.r).map(([, v]) => v) : [y.error])])));
    }
    if (!x?.view) return;
    if (b.dataset.act === 'csv') copy(x.view.csv);
    if (b.dataset.act === 'xyz') save(`${stem}.xyz`, x.view.xyz, 'chemical/x-xyz');
    if (b.dataset.act === 'conf-xyz') save(`${stem}_${Number(b.dataset.k) + 1}.xyz`, x.r.conformers[Number(b.dataset.k)].xyz || '', 'chemical/x-xyz');
    if (b.dataset.act === 'lab') { // the AI Lab reads UMA-S adiabatic IP / EA columns, the same hand-off as the Meta page used
      const csv = `smiles,name,ip_uma_s,ea_uma_s\n${x.r.smiles},,${x.r.ip_uma_s ?? x.r.ip_ev},${x.r.ea_uma_s ?? x.r.ea_ev}`;
      try { localStorage.setItem('molastria-lab-import', csv); } catch { toast('浏览器存储不可用，请复制 CSV 到 AI 实验室手动导入'); return; }
      location.href = '../lab/index.html#workbench';
    }
  });
  $('m-result').addEventListener('input', (e) => { // IR / Raman switch and line width
    const el = e.target.closest('[data-act=spec]');
    if (!el) return;
    const res = el.closest('.md-res'), x = shown[Number(res.dataset.i)];
    const kind = res.querySelector('input[type=radio]:checked')?.value || 'ir', w = Number(res.querySelector('input[type=range]').value);
    res.querySelector('.md-fwhm').textContent = String(w);
    res.querySelector('.md-spec').innerHTML = spectrum(x.r, kind, w);
  });

  // ── 事件 ────────────────────────────────────────────────────────────────
  function setWin(win, focus = false) {
    if (!GROUPS[win] || busy) return;
    S.win = win;
    store.set('molastria-models-win', win);
    if (location.hash.slice(1) !== win) history.replaceState(null, '', `#${win}`);
    sync();
    if (focus) tabs.find((b) => b.dataset.win === win)?.focus();
  }
  tabs.forEach((b, i) => {
    b.addEventListener('click', () => setWin(b.dataset.win));
    b.addEventListener('keydown', (e) => {
      const d = e.key === 'ArrowRight' ? 1 : e.key === 'ArrowLeft' ? -1 : 0;
      if (d) { e.preventDefault(); setWin(tabs[(i + d + tabs.length) % tabs.length].dataset.win, true); }
    });
  });
  function onSmiles() {
    const s = $('m-smiles').value.trim();
    mol = R && s ? L.describe(R, s) : null;
    g = mol ? graphOf(s) : null;
    if (mol) { $('m-charge').value = Math.max(-2, Math.min(2, mol.charge)); $('m-spin').value = Math.min(4, defaultSpin(mol, Number($('m-charge').value))); }
    for (const j of ['scan', 'bde', 'pa']) if (S.values[j]) delete S.values[j][j === 'scan' ? 'atoms' : j === 'bde' ? 'bond' : 'site'];
    sync();
  }
  let typing = 0;
  $('m-smiles').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(onSmiles, 250); });
  $('m-xyz').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(() => { xyz = parseXyz($('m-xyz').value); sync(); }, 250); });
  $('m-xyz-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 20000) { toast('文件太大：在线计算的 XYZ 最多 12000 个字符'); return; }
    $('m-xyz').value = await file.text();
    xyz = parseXyz($('m-xyz').value);
    sync();
  });
  $('m-xyz-sample').addEventListener('click', () => { $('m-xyz').value = '3\nwater\nO 0.000 0.000 0.000\nH 0.000 0.000 0.960\nH 0.930 0.000 -0.240\n'; xyz = parseXyz($('m-xyz').value); sync(); });
  for (const r of document.querySelectorAll('input[name=m-mode]')) r.addEventListener('change', () => { S.mode = r.value; if (S.mode === 'xyz') xyz = parseXyz($('m-xyz').value); sync(); });
  $('m-charge').addEventListener('input', () => { if (mol) $('m-spin').value = Math.min(4, defaultSpin(mol, charge())); sync(); });
  $('m-spin').addEventListener('input', sync);
  $('m-model').addEventListener('change', sync);
  $('m-job').addEventListener('change', sync);
  $('m-academic').addEventListener('change', sync);
  $('m-compare-on').addEventListener('change', () => {
    if ($('m-compare-on').checked && S.compare.size === 0) { // start with the chosen model and the next one
      const ms = G().models, k = ms.indexOf($('m-model').value);
      [ms[k], ms[(k + 1) % ms.length]].forEach((id) => S.compare.add(id));
      for (const c of $('m-compare').querySelectorAll('input')) c.checked = S.compare.has(c.value);
    }
    sync();
  });
  $('m-compare').addEventListener('change', (e) => { if (e.target.checked) S.compare.add(e.target.value); else S.compare.delete(e.target.value); sync(); });

  const start = location.hash.slice(1);
  S.win = GROUPS[start] ? start : GROUPS[store.get('molastria-models-win')] ? store.get('molastria-models-win') : 'charged';
  sync();
  refresh();
  rdkit.then(onSmiles, () => { $('m-check').textContent = 'RDKit.js 载入失败（需要联网访问 cdn.jsdelivr.net），SMILES 无法校验；可以改用 XYZ 输入。'; $('m-check').dataset.bad = 'true'; });
})();
