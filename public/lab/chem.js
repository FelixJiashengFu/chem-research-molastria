/* AI 实验室的化学与决策逻辑：RDKit 过滤、可靠性层、Pareto 前沿、DFT 预算、Rowan 脚本。
   与界面无关，lab.js 调用；tools/lab-test.mjs 在 Node 里核验非 RDKit 部分。 */
(function (root) {
  'use strict';

  const RDKIT_VERSION = '2025.3.4-1.0.0';
  const RDKIT_BASE = `https://cdn.jsdelivr.net/npm/@rdkit/rdkit@${RDKIT_VERSION}/dist/`;

  /** Nine common solvents from the plan: seeds and the reference set. SMILES only — no property values are bundled. */
  const SEEDS = [
    { id: 'EC', name: '碳酸乙烯酯', en: 'ethylene carbonate', smiles: 'O=C1OCCO1' },
    { id: 'PC', name: '碳酸丙烯酯', en: 'propylene carbonate', smiles: 'CC1COC(=O)O1' },
    { id: 'DMC', name: '碳酸二甲酯', en: 'dimethyl carbonate', smiles: 'COC(=O)OC' },
    { id: 'DEC', name: '碳酸二乙酯', en: 'diethyl carbonate', smiles: 'CCOC(=O)OCC' },
    { id: 'EMC', name: '碳酸甲乙酯', en: 'ethyl methyl carbonate', smiles: 'CCOC(=O)OC' },
    { id: 'FEC', name: '氟代碳酸乙烯酯', en: 'fluoroethylene carbonate', smiles: 'O=C1OCC(F)O1' },
    { id: 'VC', name: '碳酸亚乙烯酯', en: 'vinylene carbonate', smiles: 'O=C1OC=CO1' },
    { id: 'DME', name: '乙二醇二甲醚', en: '1,2-dimethoxyethane', smiles: 'COCCOC' },
    { id: 'DOL', name: '1,3-二氧戊环', en: '1,3-dioxolane', smiles: 'C1COCO1' }
  ];

  /** Unstable or hazardous groups excluded before any compute is spent. */
  const HAZARDS = [
    ['过氧键 O–O', '[OX2][OX2]'],
    ['臭氧化物 / 多氧链', '[OX2][OX2][OX2]'],
    ['叠氮', '[NX2]=[NX2+]=[NX1-]'],
    ['叠氮', 'N=[N+]=[N-]'],
    ['重氮', '[CX3]=[NX2+]=[NX1-]'],
    ['酰卤', '[CX3](=O)[F,Cl,Br,I]'],
    ['硝基', '[NX3+](=O)[O-]'],
    ['亚硝基', '[#6][NX2]=O'],
    ['异氰酸酯', 'N=C=O'],
    ['乙烯酮', '[CX3]=[CX2]=O'],
    ['三元环醚（环氧）', 'C1OC1'],
    ['醛基', '[CX3H1](=O)[#6]'],
    ['累积双键', '[CX3]=[CX2]=[CX3]'],
    ['碳–碳三键', 'C#C']
  ];

  const SYMBOLS = ['', 'H', 'He', 'Li', 'Be', 'B', 'C', 'N', 'O', 'F', 'Ne', 'Na', 'Mg', 'Al', 'Si', 'P', 'S', 'Cl', 'Ar', 'K', 'Ca'];
  const symbol = (z) => SYMBOLS[z] || `Z${z}`;

  // ── RDKit ───────────────────────────────────────────────────────────────
  let rdkitPromise = null;
  function loadRDKit() {
    if (root.RDKitModule) return Promise.resolve(root.RDKitModule);
    if (rdkitPromise) return rdkitPromise;
    rdkitPromise = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = RDKIT_BASE + 'RDKit_minimal.js';
      s.crossOrigin = 'anonymous';
      s.onload = () => root.initRDKitModule({ locateFile: () => RDKIT_BASE + 'RDKit_minimal.wasm' }).then((m) => { root.RDKitModule = m; resolve(m); }, reject);
      s.onerror = () => reject(new Error('RDKit.js 载入失败（需要联网访问 cdn.jsdelivr.net）'));
      document.head.append(s);
    }).catch((e) => { rdkitPromise = null; throw e; });
    return rdkitPromise;
  }

  function withMol(R, smiles, fn) {
    let mol = null;
    try {
      mol = R.get_mol(String(smiles || '').trim());
      if (!mol || (mol.is_valid && !mol.is_valid())) return fn(null);
      return fn(mol);
    } finally { mol?.delete?.(); }
  }

  /** Canonical SMILES, InChIKey, formula, element set, size and ring/stereo counts. */
  function describe(R, smiles) {
    return withMol(R, smiles, (mol) => {
      if (!mol) return null;
      const json = JSON.parse(mol.get_json());
      const m = json.molecules[0];
      const defaults = json.defaults?.atom || {};
      const counts = {};
      let charge = 0, radicals = 0, hydrogens = 0;
      for (const a of m.atoms) {
        const z = a.z ?? defaults.z ?? 6;
        counts[symbol(z)] = (counts[symbol(z)] || 0) + 1;
        hydrogens += a.impHs ?? defaults.impHs ?? 0;
        charge += a.chg ?? 0;
        radicals += a.nRad ?? 0;
      }
      if (hydrogens) counts.H = (counts.H || 0) + hydrogens;
      const d = JSON.parse(mol.get_descriptors());
      let inchikey = '';
      try { const inchi = mol.get_inchi(); inchikey = inchi ? R.get_inchikey_for_inchi(inchi) : ''; } catch { /* build without InChI */ }
      const order = ['C', 'H', ...Object.keys(counts).filter((e) => e !== 'C' && e !== 'H').sort()];
      const formula = order.filter((e) => counts[e]).map((e) => e + (counts[e] > 1 ? counts[e] : '')).join('');
      return {
        canonical: mol.get_smiles(), inchikey, formula, counts,
        elements: Object.keys(counts), heavy: d.NumHeavyAtoms ?? m.atoms.length, mw: d.exactmw ?? d.amw ?? null,
        rings: d.NumRings ?? 0, aromatic: d.NumAromaticRings ?? 0, stereo: d.NumAtomStereoCenters ?? 0,
        spiro: d.NumSpiroAtoms ?? 0, bridge: d.NumBridgeheadAtoms ?? 0, rotors: d.NumRotatableBonds ?? 0,
        charge, radicals, fragments: String(smiles).includes('.') ? String(smiles).split('.').length : 1
      };
    });
  }
  function svg(R, smiles, w = 220, h = 150) {
    return withMol(R, smiles, (mol) => {
      if (!mol) return '';
      try {
        return mol.get_svg_with_highlights(JSON.stringify({ width: w, height: h, bondLineWidth: 1.4, clearBackground: false, addStereoAnnotation: false, padding: 0.12 }));
      } catch { return mol.get_svg(w, h); }
    });
  }
  function fingerprint(R, smiles) {
    return withMol(R, smiles, (mol) => mol ? mol.get_morgan_fp(JSON.stringify({ radius: 2, nBits: 2048 })) : null);
  }
  function hazards(R, smiles) {
    return withMol(R, smiles, (mol) => {
      if (!mol) return [];
      const hits = [];
      for (const [label, smarts] of HAZARDS) {
        let q = null;
        try {
          q = R.get_qmol(smarts);
          const match = JSON.parse(mol.get_substruct_match(q) || '{}');
          if (match.atoms?.length) hits.push(label);
        } catch { /* skip a pattern this build cannot parse */ } finally { q?.delete?.(); }
      }
      return [...new Set(hits)];
    });
  }
  function tanimoto(a, b) {
    if (!a || !b || a.length !== b.length) return 0;
    let both = 0, either = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a.charCodeAt(i) === 49, y = b.charCodeAt(i) === 49;
      if (x && y) both++;
      if (x || y) either++;
    }
    return either ? both / either : 0;
  }

  /**
   * Synthetic-complexity proxy (not the Ertl–Schuffenhauer SA score, which needs fragment statistics):
   * penalises stereocentres, spiro / bridgehead atoms, ring count beyond two, large rings and size.
   * Range ~0–10; the default threshold 6 keeps simple solvents and drops cage-like structures.
   */
  function complexity(info) {
    if (!info) return 10;
    const c = 1 + 0.9 * info.stereo + 1.5 * info.spiro + 1.5 * info.bridge + 0.8 * Math.max(0, info.rings - 2) + 0.06 * Math.max(0, info.heavy - 12);
    return Math.round(c * 10) / 10;
  }

  /**
   * The RDKit gate from the plan: allowed elements, ≤ maxHeavy heavy atoms, parsable, complexity below threshold,
   * no hazardous groups, neutral closed-shell single fragment, and InChIKey de-duplication against `known`.
   */
  function filterMolecule(R, smiles, opts, known, seedFps) {
    const reasons = [];
    const info = describe(R, smiles);
    if (!info) return { pass: false, reasons: ['SMILES 无法解析'], info: null };
    const allowed = new Set(['C', 'H', 'O', 'F', ...(opts.extraElements || [])]);
    const bad = info.elements.filter((e) => !allowed.has(e));
    if (bad.length) reasons.push(`含不允许的元素：${bad.join('、')}`);
    if (info.heavy > opts.maxHeavy) reasons.push(`重原子 ${info.heavy} 个，超过 ${opts.maxHeavy}`);
    if (info.fragments > 1) reasons.push('包含多个片段（盐或混合物）');
    if (info.charge !== 0) reasons.push(`净电荷 ${info.charge}，应输入中性分子`);
    if (info.radicals) reasons.push('含自由基');
    const hz = hazards(R, smiles);
    if (hz.length) reasons.push(`危险或不稳定基团：${hz.join('、')}`);
    const cx = complexity(info);
    if (cx > opts.maxComplexity) reasons.push(`合成复杂度近似值 ${cx}，超过 ${opts.maxComplexity}`);
    const id = info.inchikey || info.canonical;
    const dup = known.get(id);
    if (dup) reasons.push(`与已评估的分子重复（${dup}）`);
    const fp = fingerprint(R, info.canonical);
    let nearest = null, sim = 0;
    for (const s of seedFps) { const t = tanimoto(fp, s.fp); if (t > sim) { sim = t; nearest = s.id; } }
    return { pass: reasons.length === 0, reasons, info, id, complexity: cx, sim: Math.round(sim * 100) / 100, nearest, hazards: hz };
  }

  // ── reliability layer ───────────────────────────────────────────────────
  const num = (v) => (v === '' || v === null || v === undefined || Number.isNaN(Number(v)) ? null : Number(v));
  /**
   * Six rules from the plan. Returns {level: 'trusted'|'doubtful'|'untrusted'|'pending', doubt: 0..1, reasons[]}.
   * Thresholds come from `cfg` so the calibration step can update them.
   */
  function reliability(m, cfg) {
    const p = m.props || {};
    const ipS = num(p.ip_s), ipM = num(p.ip_m), eaS = num(p.ea_s), eaM = num(p.ea_m), liS = num(p.li_s), liM = num(p.li_m);
    if (ipS === null && eaS === null) return { level: 'pending', doubt: 0, reasons: ['尚无 Tier 1 结果'] };
    const reasons = [];
    let doubt = 0;
    // Rule 2 — UMA-S vs UMA-M disagreement.
    const gaps = [];
    if (ipS !== null && ipM !== null && Math.abs(ipS - ipM) > cfg.disagreeIP) gaps.push(`IP 相差 ${Math.abs(ipS - ipM).toFixed(2)} eV`);
    if (eaS !== null && eaM !== null && Math.abs(eaS - eaM) > cfg.disagreeEA) gaps.push(`EA 相差 ${Math.abs(eaS - eaM).toFixed(2)} eV`);
    if (liS !== null && liM !== null && Math.abs(liS - liM) > cfg.disagreeLi) gaps.push(`Li⁺ 结合能相差 ${Math.abs(liS - liM).toFixed(2)} eV`);
    if (gaps.length) { doubt += 0.45; reasons.push(`UMA-S 与 UMA-M 不一致：${gaps.join('，')}`); }
    if (ipM === null && eaM === null && m.origin !== 'seed') { doubt += 0.1; reasons.push('缺少 UMA-M 对照单点，无法检查模型分歧'); }
    // Rule 3 — applicability domain.
    const info = m.filter?.info;
    if (info) {
      const outside = info.elements.filter((e) => !['C', 'H', 'O', 'F'].includes(e));
      if (outside.length) { doubt += 0.2; reasons.push(`含 ${outside.join('、')}，超出主要验证的 C/H/O/F 范围`); }
      if (info.heavy > 20) { doubt += 0.15; reasons.push('体系超过 20 个重原子'); }
    }
    // Rule 4 — distance from the reference set.
    const sim = m.filter?.sim;
    if (m.origin !== 'seed' && typeof sim === 'number') {
      if (sim < cfg.simMin * 0.6) { doubt += 0.3; reasons.push(`与最近的种子溶剂相似度仅 ${sim.toFixed(2)}，远离参考集`); }
      else if (sim < cfg.simMin) { doubt += 0.15; reasons.push(`与最近的种子溶剂相似度 ${sim.toFixed(2)}，偏离参考集`); }
    }
    // Rule 5 — workflow warnings.
    if (p.warn && String(p.warn).trim()) { doubt += 0.4; reasons.push(`Rowan 警告：${String(p.warn).trim()}`); }
    // Rule 1 is applied in ranking (epsilon-dominance with the prior MAE); rule 6 lives in calibrate().
    doubt = Math.min(1, doubt);
    const level = doubt >= 0.7 ? 'untrusted' : doubt >= 0.3 ? 'doubtful' : 'trusted';
    if (!reasons.length) reasons.push('UMA-S / UMA-M 一致，处于参考集附近');
    return { level, doubt: Math.round(doubt * 100) / 100, reasons };
  }

  /** DFT verdict: tier-3 confirms UMA when the gap is within the prior MAE. */
  function verdict(m, cfg) {
    const p = m.props || {};
    const out = [];
    const pairs = [['IP', num(p.ip_s), num(p.ip_dft), cfg.priorIP], ['EA', num(p.ea_s), num(p.ea_dft), cfg.priorEA]];
    for (const [label, uma, dft, prior] of pairs) {
      if (uma === null || dft === null) continue;
      const gap = uma - dft;
      out.push({ label, uma, dft, gap: Math.round(gap * 100) / 100, ok: Math.abs(gap) <= prior });
    }
    if (!out.length) return null;
    return { checks: out, confirmed: out.every((c) => c.ok) };
  }

  /** Rule 6 — recalibrate priors from molecules that have both UMA-S and DFT values. */
  function calibrate(molecules) {
    const stat = (pairs) => {
      if (pairs.length < 2) return null;
      const mae = pairs.reduce((s, [a, b]) => s + Math.abs(a - b), 0) / pairs.length;
      const mean = pairs.reduce((s, [a, b]) => s + (a - b), 0) / pairs.length;
      return { n: pairs.length, mae: Math.round(mae * 1000) / 1000, bias: Math.round(mean * 1000) / 1000, rho: spearman(pairs) };
    };
    const ip = [], ea = [];
    for (const m of molecules) {
      const p = m.props || {};
      if (num(p.ip_s) !== null && num(p.ip_dft) !== null) ip.push([num(p.ip_s), num(p.ip_dft)]);
      if (num(p.ea_s) !== null && num(p.ea_dft) !== null) ea.push([num(p.ea_s), num(p.ea_dft)]);
    }
    return { ip: stat(ip), ea: stat(ea) };
  }
  function ranks(values) {
    const idx = values.map((v, i) => [v, i]).sort((a, b) => a[0] - b[0]);
    const r = new Array(values.length);
    for (let i = 0; i < idx.length;) {
      let j = i;
      while (j + 1 < idx.length && idx[j + 1][0] === idx[i][0]) j++;
      for (let k = i; k <= j; k++) r[idx[k][1]] = (i + j) / 2 + 1;
      i = j + 1;
    }
    return r;
  }
  function spearman(pairs) {
    if (pairs.length < 3) return null;
    const a = ranks(pairs.map((p) => p[0])), b = ranks(pairs.map((p) => p[1]));
    const n = a.length, ma = (n + 1) / 2;
    let num_ = 0, da = 0, db = 0;
    for (let i = 0; i < n; i++) { num_ += (a[i] - ma) * (b[i] - ma); da += (a[i] - ma) ** 2; db += (b[i] - ma) ** 2; }
    return da && db ? Math.round((num_ / Math.sqrt(da * db)) * 1000) / 1000 : null;
  }

  // ── multi-objective ranking ─────────────────────────────────────────────
  /** Objectives: maximise IP (oxidation resistance), minimise EA (reduction resistance), Li⁺ binding inside the window. */
  function objectives(m) {
    const p = m.props || {};
    const ip = num(p.ip_s), ea = num(p.ea_s), li = num(p.li_s);
    if (ip === null || ea === null) return null;
    return { ip, ea, li };
  }
  function inWindow(li, win) { return li === null || !win || (li >= win[0] && li <= win[1]); }
  /**
   * Pareto front with epsilon-dominance (rule 1): b only dominates a when it is better by more than the prior
   * error on at least one objective and not worse beyond it on the other. Li⁺ binding acts as a constraint.
   */
  function paretoFront(list, cfg) {
    const pts = list.map((m) => ({ m, o: objectives(m) })).filter((x) => x.o && inWindow(x.o.li, cfg.liWindow));
    const epsIP = cfg.tieWithPrior ? cfg.priorIP : 0, epsEA = cfg.tieWithPrior ? cfg.priorEA : 0;
    const dominates = (b, a) => (b.ip >= a.ip - 1e-12 && b.ea <= a.ea + 1e-12) && (b.ip > a.ip + epsIP || b.ea < a.ea - epsEA);
    return pts.filter((a) => !pts.some((b) => b !== a && dominates(b.o, a.o))).map((x) => x.m);
  }
  /** Strict front (no ties) used for the step line and hypervolume. */
  function strictFront(list, cfg) { return paretoFront(list, { ...cfg, tieWithPrior: false }); }
  /** 2-D hypervolume (IP up, EA down) against a reference point taken from the seeds. */
  function hypervolume(front, ref) {
    const pts = front.map(objectives).filter((o) => o && o.ip > ref.ip && o.ea < ref.ea).sort((a, b) => b.ip - a.ip);
    let hv = 0, bestEA = ref.ea;
    for (const o of pts) {
      if (o.ea < bestEA) { hv += (o.ip - ref.ip) * (bestEA - o.ea); bestEA = o.ea; }
    }
    return hv;
  }
  function referencePoint(molecules) {
    const seeds = molecules.filter((m) => m.origin === 'seed').map(objectives).filter(Boolean);
    const all = seeds.length ? seeds : molecules.map(objectives).filter(Boolean);
    if (!all.length) return null;
    return { ip: Math.min(...all.map((o) => o.ip)), ea: Math.max(...all.map((o) => o.ea)) };
  }
  /** Li⁺ window from the seed solvents' own range (the plan: stay within the reference-solvent range). */
  function seedLiWindow(molecules) {
    const li = molecules.filter((m) => m.origin === 'seed').map((m) => num(m.props?.li_s)).filter((v) => v !== null);
    if (li.length < 2) return null;
    return [Math.min(...li), Math.max(...li)];
  }

  /**
   * DFT allocation: rank by "on or near the front × doubt", then take candidates until the round's credit budget
   * runs out (single points only, no re-optimisation).
   */
  function pickForDFT(molecules, cfg, rel) {
    const front = new Set(paretoFront(molecules, cfg).map((m) => m.key));
    const cand = molecules.filter((m) => m.origin !== 'seed' && objectives(m) && !verdict(m, cfg) && !(m.props?.ip_dft || m.props?.ea_dft));
    const scored = cand.map((m) => {
      const r = rel(m);
      const onFront = front.has(m.key) ? 1 : nearFront(m, molecules, cfg) ? 0.6 : 0.15;
      return { m, r, onFront, priority: Math.round(onFront * (0.25 + r.doubt) * 100) / 100 };
    }).filter((x) => x.r.level !== 'trusted' || x.onFront === 1).sort((a, b) => b.priority - a.priority);
    const picks = [];
    let spent = 0;
    for (const s of scored) {
      if (picks.length >= cfg.maxDFT) break;
      if (spent + cfg.credits.t3 > cfg.roundBudget) continue;
      picks.push(s); spent += cfg.credits.t3;
    }
    return { picks, spent, ranked: scored };
  }
  function nearFront(m, molecules, cfg) {
    const o = objectives(m);
    if (!o) return false;
    return strictFront(molecules, cfg).some((f) => { const q = objectives(f); return Math.abs(q.ip - o.ip) <= cfg.priorIP && Math.abs(q.ea - o.ea) <= cfg.priorEA; });
  }

  // ── Rowan scripts ───────────────────────────────────────────────────────
  const py = (s) => JSON.stringify(String(s));
  /** Tier-2 follows the redox_potential.py example quoted in the plan; tier-1/3 helpers mirror the same API family. */
  function rowanScript(tier, molecules, cfg) {
    const rows = molecules.map((m) => `    (${py(m.label || m.key)}, ${py(m.smiles)}),`).join('\n');
    const head = `# 由 MolAstria · AI 实验室生成。运行前：pip install rowan-python，并设置环境变量 ROWAN_API_KEY。
# 函数名来自 rowan-python 官方示例；参数请以当前版本文档为准。先用 is_draft=True + dispatch_info() 估价，再正式提交。
import json
import rowan

MOLECULES = [
${rows}
]
`;
    if (tier === 't2') return head + `
results = {}
for name, smiles in MOLECULES:
    workflow = rowan.submit_redox_potential_workflow(
        initial_molecule=rowan.Molecule.from_smiles(smiles),
        mode=rowan.Mode.${cfg.redoxMode || 'RAPID'},
        oxidation=True,
        reduction=True,
        name=f"{name} redox",
    )
    results[smiles] = workflow.result()  # 乙腈隐式溶剂，默认相对 SCE，单位 V
    print(name, results[smiles])

with open("tier2_redox.json", "w") as f:
    json.dump(results, f, indent=2, default=str)
# 导入网页时：e_ox / e_red 填相对 SCE 的电位；网页按设置换算到 Li/Li+。
`;
    if (tier === 't1') return head + `
# Tier 1：构象搜索 → 中性 / 阳离子 / 阴离子 / Li+ 络合物的 UMA-S 优化 → 同几何的 UMA-M 单点。
# IP = E(+1, 二重态) − E(0, 单重态)；EA = E(0) − E(−1, 二重态)；Li+ 结合能 = E(Li+·溶剂) − E(Li+) − E(溶剂)。
STATES = [("neutral", 0, 1), ("cation", 1, 2), ("anion", -1, 2)]

for name, smiles in MOLECULES:
    conformers = rowan.submit_conformer_search_workflow(
        initial_molecule=rowan.Molecule.from_smiles(smiles),
        name=f"{name} conformers",
    )
    best = conformers.result()  # 取最低能构象，作为各电荷态的起点
    for state, charge, multiplicity in STATES:
        draft = rowan.submit_basic_calculation_workflow(
            initial_molecule=best,               # 以文档为准：可能需要从结果里取几何
            method="${cfg.umaModel || 'uma_s_1_2_omol'}",
            tasks=["optimize"],
            charge=charge,
            multiplicity=multiplicity,
            is_draft=True,
            name=f"{name} {state} UMA-S",
        )
        print(name, state, draft.dispatch_info())  # 先看预计 credits，确认后去掉 is_draft 再提交
`;
    return head + `
# Tier 3：只对「前沿附近且存疑」的 2–3 个候选做 ωB97M-V/def2-TZVPD 单点（沿用 UMA-S 几何，不重新优化）。
STATES = [("neutral", 0, 1), ("cation", 1, 2), ("anion", -1, 2)]
BUDGET_CREDITS = ${cfg.roundBudget}
planned = 0
for name, smiles in MOLECULES:
    for state, charge, multiplicity in STATES:
        draft = rowan.submit_basic_calculation_workflow(
            initial_molecule=rowan.Molecule.from_smiles(smiles),  # 实际应传入 Tier 1 的优化几何
            method="wb97m-v",
            basis_set="def2-tzvpd",
            tasks=["energy"],
            charge=charge,
            multiplicity=multiplicity,
            is_draft=True,
            name=f"{name} {state} wB97M-V",
        )
        info = draft.dispatch_info()
        print(name, state, info)
# 估价合计不超过 BUDGET_CREDITS 后再正式提交；结果填入 ip_dft / ea_dft 两列。
`;
  }

  // ── synthetic demo ──────────────────────────────────────────────────────
  /** Deterministic pseudo-random numbers so the demo looks the same on every load. */
  function rng(seed) { let s = seed >>> 0; return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; }; }
  const DEMO_ROUNDS = [
    [['COC(=O)OCC(F)(F)F', '甲基 2,2,2-三氟乙基碳酸酯：末端 CF3 吸电子，抬高氧化电位'], ['FC(F)COC(=O)OC', '二氟乙基取代，兼顾黏度与抗氧化'], ['O=C1OC(F)C(F)O1', '在 FEC 上再加一个 F，期望更稳定的 SEI'], ['O=C1OCCCO1', '六元环碳酸酯，介电常数接近 EC'], ['COCC(F)(F)COC', '醚链中段二氟化，降低 HOMO'], ['FC(F)(F)CCOC(=O)OC', '三氟丙基让 CF3 远离羰基，减少还原敏感性'], ['OOC1COC(=O)O1', '引入额外氧以增强 Li⁺ 配位'], ['FCOC(=O)OCF', '双氟甲基碳酸酯，探索氟化极限']],
    [['O=C1OCC(C(F)(F)F)O1', '三氟甲基碳酸乙烯酯：环状骨架 + CF3'], ['FC(F)OCCOC(F)F', '双二氟甲氧基乙烷：氟化 DME，提高抗氧化性'], ['CCOC(=O)OCC(F)(F)F', '乙基三氟乙基碳酸酯，平衡氟含量'], ['O=C(OCC(F)(F)F)OCC(F)(F)F', '双三氟乙基碳酸酯：高氟化线性碳酸酯'], ['C1COC(=O)O1', '回到 EC 作为对照'], ['[N-]=[N+]=NCCOC(=O)OC', '叠氮乙基碳酸酯：尝试引入 N'], ['COC(=O)OC1CC1', '环丙基碳酸酯，探索小环张力']],
    [['FC(F)(F)COCCOCC(F)(F)F', '双三氟乙氧基乙烷：高氟醚，适合高压正极'], ['O=C1OCC(F)(F)O1', '4,4-二氟碳酸乙烯酯'], ['COC(=O)OC(C(F)(F)F)C(F)(F)F', '六氟异丙基甲基碳酸酯：强吸电子'], ['FC1COC(=O)O1', '换一种写法的 FEC（用于检验去重）'], ['CC1(F)COC(=O)O1', '在 PC 的季碳上氟化'], ['FC(F)(F)C1COCO1', 'CF3 取代的 DOL，改善 DOL 的抗氧化性']]
  ];
  /** Synthetic tier values from a crude fluorine / carbonate heuristic. They are NOT calculations. */
  function demoProps(info, smiles, r, origin) {
    const nF = info.counts.F || 0, nO = info.counts.O || 0;
    const carbonate = /C\(=O\)O|O=C/.test(smiles) ? 1 : 0, ring = info.rings > 0 ? 1 : 0, vinyl = /C=C/.test(smiles) ? 1 : 0;
    const ipS = 10.35 + 0.16 * nF + 0.35 * carbonate - 0.25 * vinyl + 0.04 * nO + (r() - 0.5) * 0.3;
    const eaS = -0.55 + 0.07 * nF + 0.3 * ring * carbonate + 0.75 * vinyl + (r() - 0.5) * 0.3;
    const liS = -1.62 - 0.22 * carbonate - 0.08 * ring + 0.045 * nF - 0.03 * nO + (r() - 0.5) * 0.12;
    const split = origin !== 'seed' && r() < 0.22;
    const ipM = ipS + (split ? (r() < 0.5 ? -1 : 1) * (0.45 + r() * 0.3) : (r() - 0.5) * 0.16);
    const eaM = eaS + (split ? (r() - 0.5) * 0.9 : (r() - 0.5) * 0.14);
    const liM = liS + (r() - 0.5) * 0.08;
    const f = (v) => Math.round(v * 100) / 100;
    return { ip_s: f(ipS), ip_m: f(ipM), ea_s: f(eaS), ea_m: f(eaM), li_s: f(liS), li_m: f(liM), demo: true };
  }

  root.ChemLab = {
    RDKIT_VERSION, SEEDS, HAZARDS, loadRDKit, describe, svg, fingerprint, hazards, tanimoto, complexity, filterMolecule,
    reliability, verdict, calibrate, spearman, objectives, paretoFront, strictFront, hypervolume, referencePoint,
    seedLiWindow, pickForDFT, inWindow, rowanScript, rng, DEMO_ROUNDS, demoProps, num
  };
})(typeof window !== 'undefined' ? window : globalThis);
