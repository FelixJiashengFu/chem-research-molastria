/* 开源代码台“化学信息学”标签的纯逻辑（MolAstriaChemInf）：读分子列表、类药性规则、Tanimoto 相似度、
   描述符的说明、CSV 和一段做同样事情的 RDKit Python 脚本。不碰 DOM，也不载入 RDKit：
   描述符本身由界面（cheminf.js）调用 RDKit.js（@rdkit/rdkit，BSD-3）的 get_descriptors() 得到，这里只整理。
   tools/cheminf-test.mjs 测它，并在本机有 RDKit 时真跑生成的 Python 脚本。 */
(function (root) {
  'use strict';

  const MAX_MOLS = 200;

  /** 一行一个分子：“SMILES 名字”（名字可以有空格，也可以没有）；# 开头的行和空行跳过。 */
  function parseList(text) {
    const out = [], skipped = [];
    String(text || '').replace(/\r/g, '').split('\n').forEach((raw, i) => {
      const line = raw.trim();
      if (!line || line.startsWith('#')) return;
      const m = /^(\S+)(?:[\s,;\t]+(.*))?$/.exec(line);
      if (out.length >= MAX_MOLS) { skipped.push(i + 1); return; }
      out.push({ line: i + 1, smiles: m[1], name: (m[2] || '').trim() });
    });
    return { mols: out, skipped };
  }

  // 表里显示的描述符：RDKit.js get_descriptors() 的键 → 中文名、小数位、单位。顺序就是表格的列序。
  const COLUMNS = [
    ['amw', '分子量', 2, 'g/mol'],
    ['exactmw', '精确质量', 4, 'Da'],
    ['CrippenClogP', 'cLogP', 2, ''],
    ['tpsa', 'TPSA', 1, 'Å²'],
    ['lipinskiHBD', '氢键供体', 0, ''],
    ['lipinskiHBA', '氢键受体', 0, ''],
    ['NumRotatableBonds', '可旋转键', 0, ''],
    ['NumHeavyAtoms', '重原子', 0, ''],
    ['NumRings', '环数', 0, ''],
    ['NumAromaticRings', '芳香环', 0, ''],
    ['FractionCSP3', 'Fsp³', 2, ''],
    ['NumAtomStereoCenters', '手性中心', 0, ''],
  ];
  // 详情里列出的其余描述符（RDKit 的原名照写，旁边一句说明）
  const MORE = {
    NumAtoms: '原子数（含氢）', NumHeteroatoms: '杂原子数', NumAmideBonds: '酰胺键', NumHBD: '氢键供体（RDKit 严格定义）',
    NumHBA: '氢键受体（RDKit 严格定义）', NumAliphaticRings: '脂肪环', NumSaturatedRings: '饱和环', NumHeterocycles: '杂环',
    NumAromaticHeterocycles: '芳香杂环', NumSpiroAtoms: '螺原子', NumBridgeheadAtoms: '桥头原子',
    NumUnspecifiedAtomStereoCenters: '没写明构型的手性中心', labuteASA: 'Labute 近似表面积（Å²）', CrippenMR: 'Crippen 摩尔折射率',
    hallKierAlpha: 'Hall–Kier α', kappa1: 'κ1 形状指数', kappa2: 'κ2 形状指数', kappa3: 'κ3 形状指数', Phi: 'Kier 柔性指数 Φ',
    chi0v: 'χ0v 连接性指数', chi1v: 'χ1v', chi2v: 'χ2v', chi3v: 'χ3v', chi4v: 'χ4v', chi0n: 'χ0n', chi1n: 'χ1n', chi2n: 'χ2n', chi3n: 'χ3n', chi4n: 'χ4n',
  };

  /** Lipinski 五规则（Lipinski 1997/2001）：MW ≤ 500、cLogP ≤ 5、氢键供体 ≤ 5、受体 ≤ 10；违反不超过一条算通过。 */
  function lipinski(d) {
    const broken = [];
    if (d.amw > 500) broken.push('mw');
    if (d.CrippenClogP > 5) broken.push('logp');
    if (d.lipinskiHBD > 5) broken.push('hbd');
    if (d.lipinskiHBA > 10) broken.push('hba');
    return { broken, pass: broken.length <= 1 };
  }
  /** Veber 规则（Veber 2002，口服生物利用度）：可旋转键 ≤ 10 且 TPSA ≤ 140 Å²。 */
  function veber(d) {
    const broken = [];
    if (d.NumRotatableBonds > 10) broken.push('rotb');
    if (d.tpsa > 140) broken.push('tpsa');
    return { broken, pass: !broken.length };
  }

  /** 两个同长的 0/1 字符串（RDKit.js 的 get_morgan_fp）之间的 Tanimoto 系数；两个都全零时记 0。 */
  function tanimoto(a, b) {
    if (typeof a !== 'string' || typeof b !== 'string' || a.length !== b.length) return NaN;
    let both = 0, either = 0;
    for (let i = 0; i < a.length; i++) {
      const x = a.charCodeAt(i) === 49, y = b.charCodeAt(i) === 49;
      if (x && y) both++;
      if (x || y) either++;
    }
    return either ? both / either : 0;
  }

  /** get_substruct_matches 的返回（JSON 字符串，单个匹配时 RDKit 给对象而不是数组）→ [{atoms,bonds}]。 */
  function matches(json) {
    let v;
    try { v = JSON.parse(json || '[]'); } catch { return []; }
    if (v && !Array.isArray(v)) v = [v];
    return (v || []).filter((m) => m && Array.isArray(m.atoms) && m.atoms.length);
  }

  const csvCell = (v) => {
    const s = v === undefined || v === null || (typeof v === 'number' && !Number.isFinite(v)) ? '' : String(v);
    return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
  };
  /** rows: [{name, smiles, canonical, formula, inchikey, d, sim?, hits?}] → CSV 文本（列名用英文，方便程序读）。 */
  function csv(rows, { sim = false, hits = false } = {}) {
    const head = ['name', 'input_smiles', 'canonical_smiles', 'formula', 'inchikey', ...COLUMNS.map((c) => c[0]), 'lipinski_violations', 'veber_pass'];
    if (sim) head.push('tanimoto');
    if (hits) head.push('substructure_matches');
    const lines = [head.join(',')];
    for (const r of rows) {
      if (!r.d) { lines.push([r.name, r.smiles].map(csvCell).join(',') + ',' + 'invalid'); continue; }
      const cells = [r.name, r.smiles, r.canonical, r.formula, r.inchikey, ...COLUMNS.map(([k]) => r.d[k]), lipinski(r.d).broken.length, veber(r.d).pass];
      if (sim) cells.push(Number.isFinite(r.sim) ? r.sim.toFixed(4) : '');
      if (hits) cells.push(r.hits ?? '');
      lines.push(cells.map(csvCell).join(','));
    }
    return lines.join('\n') + '\n';
  }

  const pyStr = (s) => JSON.stringify(String(s)); // a JSON string is a valid Python string literal for these characters
  /** 在自己电脑上用 RDKit（pip install rdkit）重做这张表的脚本：同样的描述符、Lipinski、Veber、子结构和相似度。 */
  function python(mols, { smarts = '', ref = '' } = {}) {
    const L = [
      '# MolAstria Code Desk: the same table with RDKit on your own computer.',
      '# pip install rdkit pandas',
      'from rdkit import Chem, DataStructs',
      'from rdkit.Chem import Crippen, Descriptors, Lipinski, rdMolDescriptors, rdFingerprintGenerator',
      'import pandas as pd',
      '',
      'mols = [',
      ...mols.map((m) => `    (${pyStr(m.smiles)}, ${pyStr(m.name || '')}),`),
      ']',
    ];
    if (smarts) L.push(`pattern = Chem.MolFromSmarts(${pyStr(smarts)})`);
    if (ref) L.push('gen = rdFingerprintGenerator.GetMorganGenerator(radius=2, fpSize=2048)', `ref_fp = gen.GetFingerprint(Chem.MolFromSmiles(${pyStr(ref)}))`);
    L.push(
      '',
      'rows = []',
      'for smi, name in mols:',
      '    mol = Chem.MolFromSmiles(smi)',
      '    if mol is None:',
      '        rows.append({"name": name, "input_smiles": smi, "error": "invalid SMILES"})',
      '        continue',
      '    row = {',
      '        "name": name, "canonical_smiles": Chem.MolToSmiles(mol), "formula": rdMolDescriptors.CalcMolFormula(mol),',
      '        "inchikey": Chem.MolToInchiKey(mol), "amw": Descriptors.MolWt(mol), "exactmw": Descriptors.ExactMolWt(mol),',
      '        "CrippenClogP": Crippen.MolLogP(mol), "tpsa": rdMolDescriptors.CalcTPSA(mol),',
      '        "lipinskiHBD": rdMolDescriptors.CalcNumLipinskiHBD(mol), "lipinskiHBA": rdMolDescriptors.CalcNumLipinskiHBA(mol),',
      '        "NumRotatableBonds": rdMolDescriptors.CalcNumRotatableBonds(mol), "NumHeavyAtoms": mol.GetNumHeavyAtoms(),',
      '        "NumRings": rdMolDescriptors.CalcNumRings(mol), "NumAromaticRings": rdMolDescriptors.CalcNumAromaticRings(mol),',
      '        "FractionCSP3": rdMolDescriptors.CalcFractionCSP3(mol),',
      '    }',
      '    row["lipinski_violations"] = sum([row["amw"] > 500, row["CrippenClogP"] > 5, row["lipinskiHBD"] > 5, row["lipinskiHBA"] > 10])',
      '    row["veber_pass"] = row["NumRotatableBonds"] <= 10 and row["tpsa"] <= 140',
    );
    if (smarts) L.push('    row["substructure_matches"] = len(mol.GetSubstructMatches(pattern))');
    if (ref) L.push('    row["tanimoto"] = DataStructs.TanimotoSimilarity(ref_fp, gen.GetFingerprint(mol))');
    L.push('    rows.append(row)', '', 'table = pd.DataFrame(rows)');
    if (ref) L.push('table = table.sort_values("tanimoto", ascending=False)');
    L.push('print(table.to_string(index=False))', 'table.to_csv("molastria-descriptors.csv", index=False)');
    return L.join('\n') + '\n';
  }

  // 常用的子结构（SMARTS），给“子结构”框做快捷选项
  const SMARTS = [
    ['羧酸', '[CX3](=O)[OX2H1]'],
    ['酯基', '[#6][CX3](=O)[OX2H0][#6]'],
    ['酰胺', '[NX3][CX3](=[OX1])'],
    ['伯 / 仲胺', '[NX3;H2,H1;!$(NC=O)]'],
    ['醇羟基', '[CX4][OX2H]'],
    ['酚羟基', 'c[OX2H]'],
    ['羰基', '[CX3]=[OX1]'],
    ['苯环', 'c1ccccc1'],
    ['卤素', '[F,Cl,Br,I]'],
    ['硝基', '[N+](=O)[O-]'],
  ];
  const SAMPLES = 'CC(=O)Oc1ccccc1C(=O)O 阿司匹林\nCN1C=NC2=C1C(=O)N(C(=O)N2C)C 咖啡因\nCC(C)Cc1ccc(cc1)C(C)C(=O)O 布洛芬\nCC(=O)Nc1ccc(O)cc1 对乙酰氨基酚\nOC(=O)c1ccccc1O 水杨酸\nc1ccccc1 苯\n';

  // 英文页面的示例用英文名（列表框是数据，不经界面翻译）
  const SAMPLES_EN = 'CC(=O)Oc1ccccc1C(=O)O aspirin\nCN1C=NC2=C1C(=O)N(C(=O)N2C)C caffeine\nCC(C)Cc1ccc(cc1)C(C)C(=O)O ibuprofen\nCC(=O)Nc1ccc(O)cc1 paracetamol\nOC(=O)c1ccccc1O salicylic acid\nc1ccccc1 benzene\n';

  // ── 按结构搜 PubChem（PUG-REST，浏览器直接问，不经过账号服务） ──
  const PUBCHEM = 'https://pubchem.ncbi.nlm.nih.gov/rest/pug';
  const SEARCH_MODES = ['similarity', 'substructure', 'identity'];
  const clampInt = (v, lo, hi, def) => { const n = Math.round(Number(v)); return Number.isFinite(n) ? Math.min(hi, Math.max(lo, n)) : def; };
  /**
   * 第一步：按结构找 CID。SMILES 放在 POST 的表单里（放进网址的话 / 和 # 会出问题）。
   * similarity：PubChem 自己的二维指纹，Tanimoto ≥ threshold（%）；substructure：含有这个子结构；identity：同一个连接方式（不管立体）。
   */
  function pubchemSearch(mode, smiles, opts = {}) {
    const m = SEARCH_MODES.includes(mode) ? mode : 'similarity';
    const max = clampInt(opts.max, 1, 50, 20), threshold = clampInt(opts.threshold, 70, 100, 90);
    const q = [`MaxRecords=${max}`, ...(m === 'similarity' ? [`Threshold=${threshold}`] : []), ...(m === 'identity' ? ['identity_type=same_connectivity'] : [])].join('&');
    const op = { similarity: 'fastsimilarity_2d', substructure: 'fastsubstructure', identity: 'fastidentity' }[m];
    return { url: `${PUBCHEM}/compound/${op}/smiles/cids/JSON?${q}`, body: `smiles=${encodeURIComponent(String(smiles || '').trim())}`, mode: m, max, threshold };
  }
  /** PubChem 的回答里的 CID（去重、保持顺序）；没找到（PUGREST.NotFound）是空数组，别的错误抛出带 PubChem 原话的异常。 */
  function pubchemCids(json, max = 50) {
    if (json?.Fault) { if (/NotFound/i.test(json.Fault.Code || '')) return []; throw new Error(json.Fault.Message || json.Fault.Code || 'PubChem error'); }
    const ids = json?.IdentifierList?.CID || [];
    return [...new Set(ids.map(Number).filter((n) => Number.isInteger(n) && n > 0))].slice(0, max);
  }
  /** 第二步：这些 CID 的名字、分子式、分子量和 SMILES。 */
  function pubchemPropsUrl(cids) {
    return `${PUBCHEM}/compound/cid/${cids.map(Number).filter((n) => n > 0).join(',')}/property/Title,MolecularFormula,MolecularWeight,SMILES,ConnectivitySMILES,IUPACName/JSON`;
  }
  /** 整理成表格的行，顺序跟 cids 一样。SMILES 的字段名 PubChem 2025 年改过（CanonicalSMILES/IsomericSMILES → ConnectivitySMILES/SMILES），新旧都认。 */
  function pubchemRows(json, cids) {
    const props = json?.PropertyTable?.Properties || [];
    const by = new Map(props.map((p) => [Number(p.CID), p]));
    return (cids || props.map((p) => Number(p.CID))).filter((c) => by.has(c)).map((cid) => {
      const p = by.get(cid);
      return { cid, title: String(p.Title || p.IUPACName || `CID ${cid}`), formula: String(p.MolecularFormula || ''), mw: Number(p.MolecularWeight),
        smiles: String(p.SMILES || p.IsomericSMILES || p.ConnectivitySMILES || p.CanonicalSMILES || ''), iupac: String(p.IUPACName || ''), url: `https://pubchem.ncbi.nlm.nih.gov/compound/${cid}` };
    });
  }

  root.MolAstriaChemInf = { PUBCHEM, SEARCH_MODES, pubchemSearch, pubchemCids, pubchemPropsUrl, pubchemRows, MAX_MOLS, parseList, COLUMNS, MORE, lipinski, veber, tanimoto, matches, csv, python, SMARTS, SAMPLES, SAMPLES_EN };
})(typeof window !== 'undefined' ? window : globalThis);
