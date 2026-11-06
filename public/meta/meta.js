/* Meta × 化学页：Muse Spark 识图（RDKit 校验）、UMA / fairchem 脚本生成器、开放资源筛选、fairchem 最新版本。
   识图走 ChemAI.chat（provider 固定为 muse，用访客自己的 key）；RDKit 与 lab/chem.js 共用。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const L = window.ChemLab;
  const en = () => document.documentElement.lang === 'en';
  let R = null;
  const rdkit = L.loadRDKit().then((m) => { R = m; return m; });

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

  // ── Muse 识图 ───────────────────────────────────────────────────────────
  const drop = $('v-drop'), file = $('v-file'), run = $('v-run');
  let image = null; // data URL sent to Muse
  let busy = false;

  const loadImage = (src) => new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('图片无法读取'));
    img.src = src;
  });
  // Large photos are scaled down to 1600 px on the long side; transparent areas become white.
  function encode(img) {
    const s = Math.min(1, 1600 / Math.max(img.naturalWidth, img.naturalHeight));
    const c = document.createElement('canvas');
    c.width = Math.max(1, Math.round(img.naturalWidth * s));
    c.height = Math.max(1, Math.round(img.naturalHeight * s));
    const g = c.getContext('2d');
    g.fillStyle = '#fff';
    g.fillRect(0, 0, c.width, c.height);
    g.drawImage(img, 0, 0, c.width, c.height);
    const png = c.toDataURL('image/png');
    return png.length < 1.5e6 ? png : c.toDataURL('image/jpeg', 0.9);
  }
  async function useBlob(blob) {
    if (!blob || !/^image\//.test(blob.type)) { toast('请选择图片文件'); return; }
    const url = URL.createObjectURL(blob);
    try { setImage(encode(await loadImage(url))); }
    catch (e) { toast(e.message); }
    finally { URL.revokeObjectURL(url); }
  }
  function setImage(dataURL) {
    image = dataURL;
    let img = drop.querySelector('img');
    if (!img) { img = document.createElement('img'); img.alt = '待识别的图片'; drop.append(img); }
    img.src = dataURL;
    $('v-drop-text').hidden = true;
    run.disabled = busy;
  }
  file.addEventListener('change', () => { if (file.files[0]) useBlob(file.files[0]); file.value = ''; });
  drop.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); file.click(); } });
  drop.addEventListener('dragover', (e) => { e.preventDefault(); drop.dataset.over = 'true'; });
  drop.addEventListener('dragleave', () => { drop.dataset.over = 'false'; });
  drop.addEventListener('drop', (e) => { e.preventDefault(); drop.dataset.over = 'false'; useBlob(e.dataTransfer.files[0]); });
  document.addEventListener('paste', (e) => {
    if (e.target.closest?.('input,textarea')) return;
    const item = [...(e.clipboardData?.items || [])].find((i) => i.type.startsWith('image/'));
    if (item) { e.preventDefault(); useBlob(item.getAsFile()); }
  });
  // Sample: vinylene carbonate and fluoroethylene carbonate drawn by RDKit, so it works offline from any key.
  $('v-sample').addEventListener('click', async () => {
    try {
      await rdkit;
      const svg = L.svg(R, 'O=C1OC=CO1.O=C1OCC(F)O1', 560, 240);
      const url = URL.createObjectURL(new Blob([svg], { type: 'image/svg+xml' }));
      try { setImage(encode(await loadImage(url))); } finally { URL.revokeObjectURL(url); }
    } catch { toast('RDKit.js 载入失败（需要联网访问 cdn.jsdelivr.net）'); }
  });

  const SYSTEM = () => `You read images of chemical structures for a computational chemistry website.
Identify every distinct molecule or ion drawn in the image (reaction schemes: every species; tables: every structure).
Return JSON only, no prose: {"molecules":[{"name":"...","smiles":"...","confidence":0.0,"note":"..."}],"note":"..."}
- smiles: one valid SMILES per species. Expand abbreviations (Me, Et, Ph, Ts, OTf, Boc). Keep drawn charges, isotopes and stereochemistry; do not invent stereo that is not drawn.
- name: common or IUPAC name in ${en() ? 'English' : 'Simplified Chinese'}.
- confidence: 0 to 1, how sure you are that the SMILES matches the drawing.
- note: one short sentence in ${en() ? 'English' : 'Simplified Chinese'} on anything ambiguous (unclear bonds, cropped parts, R groups). Empty if nothing.
If the image shows no chemical structure, return {"molecules":[],"note":"<what the image shows>"}.`;

  function status(html) { $('v-status').innerHTML = html; }
  run.addEventListener('click', async () => {
    if (!image || busy || !window.ChemAI) return;
    busy = true; run.disabled = true;
    $('v-results').innerHTML = '';
    const model = $('v-model').value;
    status(model === 'current' ? '<span>正在读图…</span>' : '<span>Muse 正在读图…</span>');
    try {
      const r = await window.ChemAI.chat({
        // "current" uses whatever the visitor set up in AI settings (any vision-capable compatible API).
        ...(model === 'current' ? {} : { provider: 'muse', model, effort: 'low' }), maxTokens: 3000, temperature: 0,
        messages: [
          { role: 'system', content: SYSTEM() },
          { role: 'user', content: [{ type: 'text', text: 'Read the chemical structures in this image.' }, { type: 'image_url', image_url: { url: image } }] }
        ]
      });
      const j = window.ChemAI.parseJSON(r.text);
      const list = Array.isArray(j.molecules) ? j.molecules : [];
      await rdkit.catch(() => null);
      const cost = r.cost ? ` · 约 $${r.cost.toFixed(4)}` : '';
      status(`<span>${esc(r.model || model)} · ${(r.ms / 1000).toFixed(1)} s${cost}</span>${list.length ? '' : `<p>图里没有找到化学结构。${j.note ? esc(j.note) : ''}</p>`}`);
      $('v-results').innerHTML = list.map(molCard).join('');
    } catch (e) {
      const noKey = e.code === 'no-key' || e.status === 401;
      status(`<div class="mx-err">${noKey ? '识图需要能看图的模型：在 AI 设置里选 Meta Muse 并填入 key（Muse Spark 能看图）。' : `识图没有完成：${esc(e.message)}`}${noKey ? '<br><button type="button" class="button small" data-act="settings">配置 Muse key</button>' : ''}</div>`);
    } finally {
      busy = false; run.disabled = !image;
    }
  });
  $('v-status').addEventListener('click', (e) => { if (e.target.closest('[data-act=settings]')) window.ChemAI?.openSettings(); });

  function molCard(m, i) {
    const smiles = String(m.smiles || '').trim();
    const info = R && smiles ? L.describe(R, smiles) : null;
    const art = info ? L.svg(R, info.canonical, 150, 110) : '';
    const conf = Number(m.confidence);
    const tags = (info ? '<span class="tag ok">RDKit 校验通过</span>' : `<span class="tag bad">${R ? 'SMILES 无法解析' : '未校验（RDKit 未载入）'}</span>`)
      + (Number.isFinite(conf) ? `<span class="tag">把握 ${Math.round(conf * 100)}%</span>` : '');
    const facts = info ? `<p class="why">${esc(info.formula)} · 精确质量 ${info.mw ? info.mw.toFixed(3) : '—'}</p>` : '';
    const s = info?.canonical || smiles;
    return `<article class="mx-mol" data-i="${i}"><div class="art">${art || '<span class="muted small">无结构图</span>'}</div><div>`
      + `<h4>${esc(m.name || `分子 ${i + 1}`)}</h4><div>${tags}</div><p class="smi">${esc(s)}</p>${facts}${m.note ? `<p class="why">${esc(m.note)}</p>` : ''}`
      + `<div class="btns"><button type="button" class="button small" data-act="copy" data-smiles="${esc(s)}">复制 SMILES</button>`
      + (info ? `<button type="button" class="button small" data-act="uma" data-smiles="${esc(s)}" data-name="${esc(m.name || '')}">生成 UMA 脚本 ↓</button>` : '')
      + `<a class="button small ghost" href="https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(s)}" target="_blank" rel="noopener">PubChem ↗</a></div></div></article>`;
  }
  $('v-results').addEventListener('click', (e) => {
    const b = e.target.closest('button[data-act]');
    if (!b) return;
    if (b.dataset.act === 'copy') copy(b.dataset.smiles);
    if (b.dataset.act === 'uma') {
      $('u-smiles').value = b.dataset.smiles;
      $('u-name').value = /^[\w.+-]{1,40}$/.test(b.dataset.name) ? b.dataset.name : '';
      onSmiles();
      $('uma').scrollIntoView({ behavior: 'smooth' });
    }
  });

  // ── UMA 脚本生成器 ──────────────────────────────────────────────────────
  const COL = { 'uma-s-1p2p1': 'uma_s', 'uma-m-1p1': 'uma_m', 'uma-s-1p2p1-ft-d4rev': 'd4rev' };
  const JOBS = { ipea: 'ipea', opt: 'opt', conf: 'conformers', md: 'md' };
  let mol = null; // RDKit description of the current SMILES

  const py = (s) => JSON.stringify(String(s));
  const ionSpin = (m) => (m === 1 ? 2 : m - 1);
  const isMace = () => $('u-model').value.startsWith('mace');
  const MACE_ELEMENTS = new Set(['H', 'C', 'N', 'O', 'F', 'P', 'S', 'Cl', 'Br', 'I']);
  const fileName = () => `${isMace() ? 'mace' : 'uma'}_${($('u-name').value.trim() || 'molecule').replace(/[^\w.-]+/g, '_')}_${JOBS[$('u-job').value]}.py`;

  function electrons(info, charge) {
    let z = 0;
    for (const [sym, n] of Object.entries(info.counts)) z += Math.max(0, L.SYMBOLS.indexOf(sym)) * n;
    return z - charge;
  }
  function defaultSpin(info, charge) {
    if (info.radicals) return info.radicals + 1;
    return electrons(info, charge) % 2 ? 2 : 1;
  }
  function onSmiles() {
    const smiles = $('u-smiles').value.trim();
    mol = R && smiles ? L.describe(R, smiles) : null;
    if (mol) {
      $('u-charge').value = mol.charge;
      $('u-spin').value = defaultSpin(mol, mol.charge);
      $('u-art').innerHTML = L.svg(R, mol.canonical, 170, 130);
    } else $('u-art').innerHTML = '';
    render();
  }
  function onCharge() {
    if (mol) $('u-spin').value = defaultSpin(mol, Number($('u-charge').value) || 0);
    render();
  }

  function script() {
    const smiles = $('u-smiles').value.trim();
    const name = $('u-name').value.trim() || 'molecule';
    const job = $('u-job').value, model = $('u-model').value, device = $('u-device').value;
    const charge = Math.round(Number($('u-charge').value) || 0), spin = Math.max(1, Math.round(Number($('u-spin').value) || 1));
    const withM = job === 'ipea' && model === 'uma-s-1p2p1' && $('u-m').checked;
    const date = new Date().toISOString().slice(0, 10);
    if (model.startsWith('mace')) return maceScript({ smiles, name, job, device, date });
    const head = [
      '"""MolAstria · UMA script for ' + name.replace(/"""/g, '') + ' (' + smiles.replace(/"""/g, '') + ')',
      `Generated ${date} at https://molastria.com/meta/#uma`,
      '',
      `Runs Meta FAIR Chemistry's UMA (${model}, task "omol") through fairchem and ASE.`,
      'Setup once:',
      '  pip install fairchem-core rdkit',
      '  request access at https://huggingface.co/facebook/UMA, then run: huggingface-cli login',
      '"""'
    ];
    const imports = ['import csv', 'import os', 'from ase import Atoms', 'from ase.optimize import LBFGS', 'from rdkit import Chem', 'from rdkit.Chem import AllChem', 'from fairchem.core import pretrained_mlip, FAIRChemCalculator'];
    if (job !== 'ipea') imports.splice(0, 2);
    if (job === 'md') imports.unshift('import numpy as np', 'from ase import units', 'from ase.io import Trajectory', 'from ase.md.langevin import Langevin', 'from ase.md.velocitydistribution import MaxwellBoltzmannDistribution');
    const consts = [
      `SMILES = ${py(smiles)}`,
      `NAME = ${py(name)}`,
      `CHARGE, SPIN = ${charge}, ${spin}  # SPIN is the multiplicity 2S+1, as fairchem expects`,
      `MODEL, DEVICE = ${py(model)}, ${py(device)}  # auto, cuda (NVIDIA), rocm (AMD), apple or cpu`
    ];
    const pick = [
      'def pick_device(want):',
      '    """fairchem runs UMA on "cuda" or "cpu". AMD cards appear as "cuda" in the ROCm build of PyTorch.',
      '    fairchem does not support Apple GPUs (MPS) yet, so a Mac uses its CPU, which is fine for small molecules."""',
      '    import torch',
      '    if want in ("auto", "cuda", "rocm") and torch.cuda.is_available():',
      '        kind = "AMD ROCm" if torch.version.hip else "NVIDIA CUDA"',
      '        print(f"GPU: {torch.cuda.get_device_name(0)} ({kind})")',
      '        return "cuda"',
      '    if want == "rocm":',
      '        print("No AMD GPU in this PyTorch: install the ROCm build from https://pytorch.org/get-started/locally/ (Linux). Using the CPU.")',
      '    elif want == "cuda":',
      '        print("No NVIDIA GPU in this PyTorch (CPU-only build or no driver). Using the CPU.")',
      '    elif want == "apple":',
      '        print("fairchem does not support Apple GPUs (MPS) yet; running on the CPU.")',
      '    return "cpu"',
      '',
      '',
      'DEVICE = pick_device(DEVICE)',
      '',
      '',
      'def uma_settings():',
      '    """fairchem\'s default settings compile the model with torch.compile, which needs Triton. Windows has no Triton,',
      '    so there UMA runs the full-precision path without compilation ("batch"), slower but exact."""',
      '    try:',
      '        import triton  # noqa: F401',
      '        return "default"',
      '    except ImportError:',
      '        return "batch"',
      '',
      ''
    ];
    const predictor = job === 'md'
      ? ['# fairchem seeds numpy\'s global RNG when it loads a model; pass a fresh seed for a new trajectory.', 'seed = int(np.random.randint(0, np.iinfo(np.int32).max))', 'predictor = pretrained_mlip.get_predict_unit(MODEL, device=DEVICE, inference_settings=uma_settings(), seed=seed)']
      : ['predictor = pretrained_mlip.get_predict_unit(MODEL, device=DEVICE, inference_settings=uma_settings())'];
    const embed = [
      'def embed(smiles, seed=42):',
      '    """3D structure from SMILES: RDKit ETKDG, then an MMFF clean-up when MMFF knows every atom."""',
      '    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))',
      '    params = AllChem.ETKDGv3()',
      '    params.randomSeed = seed',
      '    if AllChem.EmbedMolecule(mol, params) != 0:',
      '        raise SystemExit(f"RDKit could not build a 3D structure for {smiles}")',
      '    if AllChem.MMFFHasAllMoleculeParams(mol):',
      '        AllChem.MMFFOptimizeMolecule(mol)',
      '    return Atoms([a.GetSymbol() for a in mol.GetAtoms()], positions=mol.GetConformer().GetPositions())'
    ];
    const relax = [
      'def relax(atoms, charge, spin, fmax=0.02, steps=500):',
      '    """Optimize with UMA; returns the relaxed copy (calculator attached) and its energy in eV."""',
      '    atoms = atoms.copy()',
      '    atoms.info.update({"charge": charge, "spin": spin})',
      '    atoms.calc = FAIRChemCalculator(predictor, task_name="omol")',
      '    LBFGS(atoms, logfile=None).run(fmax=fmax, steps=steps)',
      '    return atoms, atoms.get_potential_energy()'
    ];
    let body;
    if (job === 'opt') {
      body = [
        'atoms, energy = relax(embed(SMILES), CHARGE, SPIN)',
        'atoms.write(f"{NAME}_uma.xyz")',
        'print(f"{NAME}: E = {energy:.6f} eV with {MODEL} (omol); geometry written to {NAME}_uma.xyz")'
      ];
    } else if (job === 'conf') {
      body = [
        'N_CONFORMERS = 20',
        'mol = Chem.AddHs(Chem.MolFromSmiles(SMILES))',
        'params = AllChem.ETKDGv3()',
        'params.randomSeed = 42',
        'ids = list(AllChem.EmbedMultipleConfs(mol, N_CONFORMERS, params))',
        'if not ids:',
        '    raise SystemExit(f"RDKit could not build conformers for {SMILES}")',
        'if AllChem.MMFFHasAllMoleculeParams(mol):',
        '    AllChem.MMFFOptimizeMoleculeConfs(mol)',
        'symbols = [a.GetSymbol() for a in mol.GetAtoms()]',
        '',
        'found = []',
        'for cid in ids:',
        '    start = Atoms(symbols, positions=mol.GetConformer(cid).GetPositions())',
        '    atoms, energy = relax(start, CHARGE, SPIN)',
        '    found.append((energy, cid, atoms))',
        'found.sort(key=lambda x: x[0])',
        '',
        '# Relaxed conformers can collapse onto the same minimum; equal energies usually mean duplicates.',
        'e_min = found[0][0]',
        'for energy, cid, _ in found:',
        '    print(f"conformer {cid:2d}: {(energy - e_min) * 23.0605:7.2f} kcal/mol")',
        'found[0][2].write(f"{NAME}_lowest.xyz")',
        'print(f"Lowest: E = {e_min:.6f} eV, written to {NAME}_lowest.xyz")'
      ];
    } else if (job === 'md') {
      body = [
        'atoms, _ = relax(embed(SMILES), CHARGE, SPIN, fmax=0.05)',
        'MaxwellBoltzmannDistribution(atoms, temperature_K=300)',
        'dyn = Langevin(atoms, timestep=0.5 * units.fs, temperature_K=300, friction=0.01 / units.fs)',
        'traj = Trajectory(f"{NAME}_md.traj", "w", atoms)',
        'dyn.attach(traj.write, interval=10)',
        'dyn.attach(lambda: print(f"step {dyn.get_number_of_steps():5d}  T = {atoms.get_temperature():6.1f} K  E = {atoms.get_total_energy():.4f} eV"), interval=200)',
        'dyn.run(2000)  # 2000 steps x 0.5 fs = 1 ps',
        'print(f"Trajectory written to {NAME}_md.traj (open it with: ase gui {NAME}_md.traj)")'
      ];
    } else {
      const c = COL[model];
      const fields = c === 'd4rev' ? ['smiles', 'name', 'ip_d4rev', 'ea_d4rev'] : ['smiles', 'name', 'ip_uma_s', 'ea_uma_s', 'ip_uma_m', 'ea_uma_m'];
      body = [
        '# Adiabatic IP = E(+1) - E(0) and EA = E(0) - E(-1), each state relaxed on its own (eV),',
        '# the same definitions the MolAstria AI Lab uses for its Tier 1 columns.',
        `CATION_SPIN, ANION_SPIN = ${ionSpin(spin)}, ${ionSpin(spin)}`,
        'neutral, e0 = relax(embed(SMILES), CHARGE, SPIN)',
        'cation, e_cat = relax(neutral, CHARGE + 1, CATION_SPIN)',
        'anion, e_an = relax(neutral, CHARGE - 1, ANION_SPIN)',
        `row = {"smiles": SMILES, "name": NAME, "ip_${c}": round(e_cat - e0, 4), "ea_${c}": round(e0 - e_an, 4)}`
      ];
      if (withM) body.push(
        '',
        '# UMA-M single points on the UMA-S geometries: the AI Lab compares S and M to flag doubtful results.',
        'predictor_m = pretrained_mlip.get_predict_unit("uma-m-1p1", device=DEVICE, inference_settings=uma_settings())',
        '',
        '',
        'def single_point(atoms):',
        '    atoms = atoms.copy()  # keeps the charge and spin in atoms.info',
        '    atoms.calc = FAIRChemCalculator(predictor_m, task_name="omol")',
        '    return atoms.get_potential_energy()',
        '',
        '',
        'm0, m_cat, m_an = (single_point(a) for a in (neutral, cation, anion))',
        'row["ip_uma_m"] = round(m_cat - m0, 4)',
        'row["ea_uma_m"] = round(m0 - m_an, 4)'
      );
      const out = c === 'd4rev' ? 'uma_results_d4rev.csv' : 'uma_results.csv';
      body.push(
        '',
        `OUT = ${py(out)}`,
        'new_file = not os.path.exists(OUT)',
        'with open(OUT, "a", newline="", encoding="utf-8") as f:',
        `    writer = csv.DictWriter(f, fieldnames=${JSON.stringify(fields)}, restval="")`,
        '    if new_file:',
        '        writer.writeheader()',
        '    writer.writerow(row)',
        'for atoms, state in ((neutral, "neutral"), (cation, "cation"), (anion, "anion")):',
        '    atoms.write(f"{NAME}_{state}.xyz")',
        'print(row)',
        c === 'd4rev'
          ? 'print(f"Appended to {OUT}. These are omega-B97M-D4rev values; the AI Lab only reads the ip_uma_* / ea_uma_* columns.")'
          : 'print(f"Appended to {OUT}. Import it in the MolAstria AI Lab: Results -> 2 Import results.")'
      );
    }
    const usesEmbed = job !== 'conf';
    return [...head, ...imports, '', ...consts, '', '', ...pick, ...predictor, '', '', ...(usesEmbed ? [...embed, '', ''] : []), ...relax, '', '', ...body, ''].join('\n');
  }

  /** The same jobs with MACE-OFF23 medium: neutral, closed-shell organic molecules (H C N O F P S Cl Br I). */
  function maceScript({ smiles, name, job, device, date }) {
    const head = [
      '"""MolAstria · MACE-OFF23 script for ' + name.replace(/"""/g, '') + ' (' + smiles.replace(/"""/g, '') + ')',
      `Generated ${date} at https://molastria.com/meta/#uma`,
      '',
      'Runs MACE-OFF23 medium (Kovacs et al.; trained on SPICE, wB97M-D3(BJ)/def2-TZVPPD) through mace-torch and ASE,',
      'an independent check on UMA. It covers neutral, closed-shell molecules made of H C N O F P S Cl Br I only.',
      'Setup once, in its own environment (mace-torch pins e3nn 0.4.4, which fairchem cannot share):',
      '  pip install mace-torch rdkit',
      'The model downloads from GitHub on the first run. MACE-OFF23 is under the Academic Software License:',
      'non-commercial use only.',
      '"""'
    ];
    const imports = ['import torch', 'from ase import Atoms', 'from ase.optimize import LBFGS', 'from rdkit import Chem', 'from rdkit.Chem import AllChem', 'from mace.calculators import mace_off'];
    if (job === 'md') imports.unshift('from ase import units', 'from ase.io import Trajectory', 'from ase.md.langevin import Langevin', 'from ase.md.velocitydistribution import MaxwellBoltzmannDistribution');
    const consts = [
      `SMILES = ${py(smiles)}`,
      `NAME = ${py(name)}`,
      'MODEL = "medium"',
      `# ${py(device)} was chosen on the page; mace-torch uses an NVIDIA (or ROCm) GPU when PyTorch has one, otherwise the CPU.`,
      'DEVICE = "cuda" if torch.cuda.is_available() else "cpu"',
      '',
      'calc = mace_off(model=MODEL, device=DEVICE, default_dtype="float64")  # float64 is the recommended setting for optimisation'
    ];
    const embed = [
      'def embed(smiles, seed=42):',
      '    """3D structure from SMILES: RDKit ETKDG, then an MMFF clean-up when MMFF knows every atom."""',
      '    mol = Chem.AddHs(Chem.MolFromSmiles(smiles))',
      '    params = AllChem.ETKDGv3()',
      '    params.randomSeed = seed',
      '    if AllChem.EmbedMolecule(mol, params) != 0:',
      '        raise SystemExit(f"RDKit could not build a 3D structure for {smiles}")',
      '    if AllChem.MMFFHasAllMoleculeParams(mol):',
      '        AllChem.MMFFOptimizeMolecule(mol)',
      '    return Atoms([a.GetSymbol() for a in mol.GetAtoms()], positions=mol.GetConformer().GetPositions())'
    ];
    const relax = [
      'def relax(atoms, fmax=0.02, steps=500):',
      '    """Optimize with MACE-OFF23; returns the relaxed copy (calculator attached) and its energy in eV."""',
      '    atoms = atoms.copy()',
      '    atoms.calc = calc',
      '    LBFGS(atoms, logfile=None).run(fmax=fmax, steps=steps)',
      '    return atoms, atoms.get_potential_energy()'
    ];
    let body;
    if (job === 'conf') {
      body = [
        'N_CONFORMERS = 20',
        'mol = Chem.AddHs(Chem.MolFromSmiles(SMILES))',
        'params = AllChem.ETKDGv3()',
        'params.randomSeed = 42',
        'ids = list(AllChem.EmbedMultipleConfs(mol, N_CONFORMERS, params))',
        'if not ids:',
        '    raise SystemExit(f"RDKit could not build conformers for {SMILES}")',
        'if AllChem.MMFFHasAllMoleculeParams(mol):',
        '    AllChem.MMFFOptimizeMoleculeConfs(mol)',
        'symbols = [a.GetSymbol() for a in mol.GetAtoms()]',
        '',
        'found = []',
        'for cid in ids:',
        '    atoms, energy = relax(Atoms(symbols, positions=mol.GetConformer(cid).GetPositions()))',
        '    found.append((energy, cid, atoms))',
        'found.sort(key=lambda x: x[0])',
        'e_min = found[0][0]',
        'for energy, cid, _ in found:',
        '    print(f"conformer {cid:2d}: {(energy - e_min) * 23.0605:7.2f} kcal/mol")',
        'found[0][2].write(f"{NAME}_mace_lowest.xyz")',
        'print(f"Lowest: E = {e_min:.6f} eV, written to {NAME}_mace_lowest.xyz")'
      ];
    } else if (job === 'md') {
      body = [
        'atoms, _ = relax(embed(SMILES), fmax=0.05)',
        'MaxwellBoltzmannDistribution(atoms, temperature_K=300)',
        'dyn = Langevin(atoms, timestep=0.5 * units.fs, temperature_K=300, friction=0.01 / units.fs)',
        'traj = Trajectory(f"{NAME}_mace_md.traj", "w", atoms)',
        'dyn.attach(traj.write, interval=10)',
        'dyn.attach(lambda: print(f"step {dyn.get_number_of_steps():5d}  T = {atoms.get_temperature():6.1f} K  E = {atoms.get_total_energy():.4f} eV"), interval=200)',
        'dyn.run(2000)  # 2000 steps x 0.5 fs = 1 ps',
        'print(f"Trajectory written to {NAME}_mace_md.traj (open it with: ase gui {NAME}_mace_md.traj)")'
      ];
    } else {
      body = [
        'atoms, energy = relax(embed(SMILES))',
        'atoms.write(f"{NAME}_mace.xyz")',
        'print(f"{NAME}: E = {energy:.6f} eV with MACE-OFF23 {MODEL}; geometry written to {NAME}_mace.xyz")'
      ];
    }
    return [...head, ...imports, '', ...consts, '', '', ...(job === 'conf' ? [] : [...embed, '', '']), ...relax, '', '', ...body, ''].join('\n');
  }

  function render() {
    const smiles = $('u-smiles').value.trim();
    const check = $('u-check');
    const mace = isMace();
    const ipeaOption = $('u-job').querySelector('option[value=ipea]');
    ipeaOption.disabled = mace;
    if (mace && $('u-job').value === 'ipea') $('u-job').value = 'opt';
    for (const li of document.querySelectorAll('.mx-run [data-for]')) li.hidden = li.dataset.for !== (mace ? 'mace' : 'uma');
    $('u-mace-note').hidden = !mace;
    if ($('u-run')) $('u-run').dataset.mace = String(mace);
    const job = $('u-job').value, model = $('u-model').value;
    $('u-m-wrap').hidden = !(job === 'ipea' && model === 'uma-s-1p2p1');
    const ok = !!smiles && (!R || !!mol);
    if (!smiles) { check.textContent = '先输入一个 SMILES。'; check.dataset.bad = 'true'; }
    else if (!R) { check.textContent = '正在载入 RDKit，载入后会校验 SMILES…'; check.dataset.bad = 'false'; }
    else if (!mol) { check.textContent = 'RDKit 无法解析这个 SMILES，请先修正。'; check.dataset.bad = 'true'; }
    else {
      const charge = Number($('u-charge').value) || 0;
      const e = electrons(mol, charge), spin = Number($('u-spin').value) || 1;
      const mismatch = (e % 2 === 1) !== (spin % 2 === 0); // odd electron counts need an even multiplicity
      const outside = mace ? [...new Set(mol.formula.match(/[A-Z][a-z]?/g) || [])].filter((x) => !MACE_ELEMENTS.has(x)) : [];
      const maceIssue = !mace ? '' : outside.length ? `；MACE-OFF23 不认识 ${outside.join('、')}` : (charge !== 0 || spin !== 1) ? '；MACE-OFF23 只算中性闭壳层分子，电荷和自旋多重度会按 0 和 1 处理' : '';
      check.textContent = `${mol.formula} · ${mol.heavy} 个重原子 · ${e} 个电子${mismatch && !mace ? `，与自旋多重度 ${spin} 不相容` : ''}${maceIssue}`;
      check.dataset.bad = String((mismatch && !mace) || outside.length > 0);
    }
    $('u-code').textContent = ok ? script() : '# 先输入一个 RDKit 能解析的 SMILES';
    $('u-copy').disabled = $('u-download').disabled = !ok;
    $('u-file').textContent = fileName();
    $('u-cmd').textContent = `python ${fileName()}`;
    onlineSync();
  }

  // ── 在线运行：站长电脑上的 UMA，经账号服务（/uma/*）排队 ──────────────────────────
  // The owner's computer is reached only through the account service, which limits jobs per visitor and adds the
  // secret the computer checks (tools/uma-server). It may be off: the panel then says so and the button stays off.
  const umaApi = () => (window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
  let umaOnline = false, umaBusy = false;
  async function umaCall(path, opts = {}) {
    const token = (() => { try { return localStorage.getItem('molastria-session') || ''; } catch { return ''; } })();
    const res = await fetch(umaApi() + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
    return data;
  }
  function onlineSync() {
    const box = $('u-online');
    if (!box || box.hidden) return;
    const job = $('u-job').value, model = $('u-model').value;
    const why = !umaOnline ? '' : !mol ? '先输入一个 RDKit 能解析的 SMILES。' : !['ipea', 'opt'].includes(job) ? '在线运行只支持电离能 / 电子亲和能和几何优化。' : model !== 'uma-s-1p2p1' ? '在线运行用的是 uma-s-1p2p1，请把模型切回它。' : mol.heavy > 30 ? '在线运行最多 30 个重原子。' : '';
    $('u-online-why').textContent = why;
    $('u-online-run').disabled = umaBusy || !umaOnline || !!why;
  }
  async function online() {
    const box = $('u-online');
    if (!box || !umaApi()) return;
    try {
      const h = await umaCall('/uma/health');
      // Shown only once the service exists: before the owner opens it (or with an older account service) it stays hidden.
      if (h.configured === false) return;
      box.hidden = false;
      umaOnline = !!h.online;
      $('u-online-status').innerHTML = h.online
        ? `<span class="chip ok">✓ 在线 · ${esc(h.model)}${h.gpu ? ` · ${esc(h.gpu)}` : ''}</span><span class="chip">排队 ${Number(h.queue) || 0} 个${h.running ? '，正在计算' : ''}</span>`
        : '<span class="chip warn">! 站长的 GPU 现在离线，可以先下载脚本自己运行</span>';
    } catch {
      umaOnline = false;
      return;
    }
    onlineSync();
  }
  function onlineResult(r) {
    const f = (v, d = 3) => (Number.isFinite(v) ? v.toFixed(d) : '—');
    const box = $('u-online-result');
    const head = `<h4>计算完成 · ${esc(r.model)}${r.fake ? '（测试数据）' : ''}</h4>`;
    if (r.job === 'ipea') {
      box.csv = `smiles,name,ip_uma_s,ea_uma_s\n${r.smiles},${($('u-name').value.trim() || 'molecule').replace(/[,\n]/g, ' ')},${r.ip_uma_s},${r.ea_uma_s}`;
      box.innerHTML = `<div class="mx-res">${head}<table class="mx-res-table"><thead><tr><th>IP（eV）</th><th>EA（eV）</th><th>中性能量（eV）</th></tr></thead><tbody><tr><td>${f(r.ip_uma_s)}</td><td>${f(r.ea_uma_s)}</td><td>${f(r.energy_ev, 4)}</td></tr></tbody></table><div class="btns"><button type="button" class="button primary small" data-act="lab">导入 AI 实验室 →</button><button type="button" class="button small" data-act="csv">复制 CSV</button>${r.xyz ? '<button type="button" class="button small" data-act="xyz">下载结构</button>' : ''}</div><p class="muted small">绝热 IP = E(+1) − E(0)，EA = E(0) − E(−1)，每个电荷态各自优化；${r.seconds ?? '?'} 秒。</p></div>`;
    } else {
      box.csv = '';
      box.innerHTML = `<div class="mx-res">${head}<p>能量 <b>${f(r.energy_ev, 4)} eV</b>，${r.steps ?? '?'} 步收敛，${r.seconds ?? '?'} 秒。</p><div class="btns">${r.xyz ? '<button type="button" class="button primary small" data-act="xyz">下载优化结构（.xyz）</button>' : ''}</div></div>`;
    }
    box.xyz = r.xyz || '';
  }
  $('u-online-result')?.addEventListener('click', (e) => {
    const b = e.target.closest('[data-act]'), box = $('u-online-result');
    if (!b) return;
    if (b.dataset.act === 'csv' && box.csv) copy(box.csv);
    if (b.dataset.act === 'lab' && box.csv) {
      try { localStorage.setItem('molastria-lab-import', box.csv); } catch { toast('浏览器存储不可用，请复制 CSV 到 AI 实验室手动导入'); return; }
      location.href = '../lab/index.html#workbench';
    }
    if (b.dataset.act === 'xyz' && box.xyz) {
      const a = document.createElement('a');
      a.href = URL.createObjectURL(new Blob([box.xyz], { type: 'chemical/x-xyz' }));
      a.download = `${($('u-name').value.trim() || 'molecule').replace(/[^\w.-]+/g, '_')}_uma.xyz`;
      document.body.append(a); a.click(); a.remove();
      setTimeout(() => URL.revokeObjectURL(a.href), 1000);
    }
  });
  $('u-online-run')?.addEventListener('click', async () => {
    const box = $('u-online-result');
    umaBusy = true; onlineSync();
    box.innerHTML = '<p class="muted">已提交…</p>';
    try {
      const body = { smiles: $('u-smiles').value.trim(), job: $('u-job').value, charge: Math.round(Number($('u-charge').value) || 0), spin: Math.max(1, Math.round(Number($('u-spin').value) || 1)) };
      let r = await umaCall('/uma/jobs', { method: 'POST', body: JSON.stringify(body) });
      const until = Date.now() + 15 * 60 * 1000;
      while (r.status !== 'done' && r.status !== 'error') {
        box.innerHTML = r.status === 'running' ? '<p class="muted">正在计算…（一个分子通常几十秒）</p>' : `<p class="muted">排队中，前面还有 ${Math.max(0, (r.position || 1) - 1)} 个任务…</p>`;
        if (Date.now() > until) throw new Error('等了 15 分钟还没轮到，请稍后再试');
        await new Promise((ok) => setTimeout(ok, 2500));
        r = await umaCall(`/uma/jobs/${r.id}`);
      }
      if (r.status === 'error') throw new Error(r.error || '计算失败');
      onlineResult(r.result);
    } catch (err) {
      box.innerHTML = `<p class="mx-err">${esc(err.message)}</p>`;
    } finally {
      umaBusy = false; onlineSync();
    }
  });
  let typing = 0;
  $('u-smiles').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(onSmiles, 250); });
  $('u-charge').addEventListener('input', onCharge);
  for (const id of ['u-name', 'u-spin']) $(id).addEventListener('input', render);
  for (const id of ['u-job', 'u-model', 'u-device', 'u-m']) $(id).addEventListener('change', render);
  $('u-model').addEventListener('change', () => { if ($('u-run') && !$('u-run').hidden) $('u-run').disabled = isMace() || $('u-run').dataset.ready !== 'true'; });
  $('u-copy').addEventListener('click', () => copy($('u-code').textContent));
  $('u-download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('u-code').textContent], { type: 'text/x-python' }));
    a.download = fileName();
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  render();
  online();
  rdkit.then(onSmiles, () => { $('u-check').textContent = 'RDKit.js 载入失败（需要联网访问 cdn.jsdelivr.net），脚本照常生成，但没有校验 SMILES。'; });

  // ── 桌面版：在本机运行 ──────────────────────────────────────────────────
  // The app (desktop/src-tauri/src/uma.rs) runs its built-in runner.py with the visitor's Python;
  // this page only sends the parameters chosen above and polls the log.
  const ipc = window.__MOLASTRIA_DESKTOP__ && window.__TAURI_INTERNALS__;
  $('u-desk-note').hidden = !!ipc;
  if (ipc) desktop((cmd, args) => ipc.invoke(cmd, args));

  function desktop(invoke) {
    const PY_KEY = 'molastria-uma-python';
    const ERR = {
      'bad-smiles': 'SMILES 含有不支持的字符。', 'bad-params': '参数不在允许的范围内。', 'bad-python': '这不是 python 可执行文件的完整路径。',
      busy: '已经有一个计算在运行。', 'probe-failed': '这个 Python 没有在 90 秒内完成检测。', 'no-run': '还没有运行过计算。'
    };
    const why = (e) => { const s = String(e?.message || e); return ERR[s] || (s.startsWith('spawn-failed') ? `无法启动 Python：${s.slice(14)}` : s); };
    const saved = () => { try { return localStorage.getItem(PY_KEY) || ''; } catch { return ''; } };
    const minor = (v) => (/^3\.(\d+)/.exec(v || '') || [])[1] * 1 || 0;
    const usable = (v) => minor(v) >= 11 && minor(v) <= 14;
    let found = [], info = null, timer = 0, next = 0, ending = false, log = [];
    $('u-local').hidden = false;

    async function find() {
      info = null;
      $('u-env').innerHTML = '<span class="muted">正在查找 Python…</span>';
      $('u-help').innerHTML = '';
      $('u-run').disabled = true;
      try { found = await invoke('uma_find', { extra: saved() || null }); } catch { found = []; }
      const score = (p) => (p.executable.toLowerCase() === saved().toLowerCase() ? 1000 : 0) + (p.has_fairchem ? 100 : 0) + (usable(p.python) ? 10 : 0) + minor(p.python) / 100;
      found.sort((a, b) => score(b) - score(a));
      $('u-py').innerHTML = found.map((p, i) => `<option value="${i}">${esc(p.executable)} · Python ${esc(p.python)}${p.has_fairchem ? ' · fairchem' : ''}</option>`).join('');
      $('u-py').disabled = !found.length;
      if (found.length) await inspect(); else paint();
    }
    async function inspect() {
      const p = found[Number($('u-py').value) || 0];
      $('u-env').innerHTML = `<span class="muted">正在检测 ${esc(p.executable)}…（第一次导入 PyTorch 可能要十几秒）</span>`;
      $('u-run').disabled = true;
      try { info = await invoke('uma_inspect', { python: p.executable }); }
      catch (e) { info = { executable: p.executable, python: p.python, error: why(e) }; }
      paint();
    }
    const chip = (state, text) => `<span class="chip ${state}">${state === 'ok' ? '✓' : state === 'bad' ? '✗' : '!'} ${text}</span>`;
    const ready = () => !!info && usable(info.python) && !!info.torch && !!info.fairchem && !!info.rdkit && info.hf_login && info.uma_access !== false;

    function paint() {
      const chips = [];
      const steps = [];
      if (!found.length || !info) {
        chips.push(chip('bad', '没有找到可用的 Python'));
        steps.push(['安装 Python 3.12（<a href="https://www.python.org/downloads/" target="_blank" rel="noopener">python.org</a> 或 Miniforge），装好后点「重新检测」。已经装在别处的，可以在下面「用其他 Python」里填路径。']);
      } else {
        const win = info.executable.includes('\\');
        const py = win ? `& "${info.executable}"` : `"${info.executable}"`;
        if (info.error) chips.push(chip('bad', esc(info.error)));
        chips.push(usable(info.python) ? chip('ok', `Python ${esc(info.python)}`) : chip('bad', `Python ${esc(info.python)}：需要 3.11–3.14`));
        chips.push(info.fairchem ? chip('ok', `fairchem ${esc(info.fairchem)}`) : chip('bad', '没有 fairchem'));
        chips.push(info.rdkit ? chip('ok', `RDKit ${esc(info.rdkit)}`) : chip('bad', '没有 RDKit'));
        chips.push(!info.torch ? chip('bad', '没有 PyTorch') : info.cuda ? chip('ok', `GPU：${esc(info.gpu || 'CUDA')}${info.hip ? '（ROCm）' : ''}`) : info.mps ? chip('warn', 'Apple 芯片：fairchem 暂不支持 Apple GPU，用 CPU') : chip('warn', '只能用 CPU（较慢）'));
        chips.push(!info.hf_login ? chip('bad', '没有登录 Hugging Face') : info.uma_access === true ? chip('ok', 'facebook/UMA 已有权限') : info.uma_access === false ? chip('bad', '这个账号还没有 facebook/UMA 权限') : chip('warn', '已登录，权限暂时没能确认'));
        if (!usable(info.python)) steps.push(['fairchem 需要 Python 3.11–3.14：装一个新的 Python，或在下面填另一个环境的路径。']);
        else {
          if (!info.fairchem || !info.rdkit || !info.torch) steps.push(['在终端里安装 fairchem 和 RDKit（会一并装上 PyTorch，约 3 GB）：', `${py} -m pip install fairchem-core rdkit`]);
          if (win && /\+cpu$/.test(info.torch || '') ) steps.push(['有 NVIDIA 显卡时，把 PyTorch 换成 CUDA 版（版本号与现在的一致）：', `${py} -m pip install --force-reinstall --no-deps torch==${esc(info.torch.replace(/\+cpu$/, ''))} --index-url https://download.pytorch.org/whl/cu126`]);
          if (!info.hf_login) steps.push(['申请模型权限：<a href="https://huggingface.co/facebook/UMA" target="_blank" rel="noopener">huggingface.co/facebook/UMA</a>（Meta 人工审核）。获批后在终端运行下面的命令，按提示粘贴你的 Hugging Face token：', `${py} -c "from huggingface_hub import login; login()"`]);
          else if (info.uma_access === false) steps.push(['已经登录，但这个账号还没有 facebook/UMA 的下载权限：到 <a href="https://huggingface.co/facebook/UMA" target="_blank" rel="noopener">模型页</a> 申请，Meta 批准后点「重新检测」。']);
        }
      }
      $('u-env').innerHTML = chips.join('');
      $('u-help').innerHTML = steps.length ? `<ol>${steps.map(([t, c]) => `<li><span>${t}</span>${c ? `<div class="mx-cmd"><code>${esc(c)}</code><button type="button" class="text-button" data-cmd="${esc(c)}">复制</button></div>` : ''}</li>`).join('')}</ol><p class="muted small">做完点「重新检测」。</p>` : '';
      $('u-run').dataset.ready = String(ready());
      $('u-run').disabled = !ready() || isMace();
    }
    $('u-help').addEventListener('click', (e) => { const b = e.target.closest('[data-cmd]'); if (b) copy(b.dataset.cmd); });
    $('u-recheck').addEventListener('click', find);
    $('u-py').addEventListener('change', inspect);
    $('u-py-add').addEventListener('click', () => {
      const v = $('u-py-path').value.trim();
      try { if (v) localStorage.setItem(PY_KEY, v); else localStorage.removeItem(PY_KEY); } catch {}
      find();
    });
    $('u-py-path').value = saved();

    function params() {
      return {
        smiles: $('u-smiles').value.trim(), name: $('u-name').value.trim() || 'molecule', job: $('u-job').value, model: $('u-model').value,
        device: $('u-device').value, charge: Math.round(Number($('u-charge').value) || 0), spin: Math.max(1, Math.round(Number($('u-spin').value) || 1)),
        with_m: $('u-job').value === 'ipea' && $('u-model').value === 'uma-s-1p2p1' && $('u-m').checked
      };
    }
    function busy(on) {
      $('u-run').hidden = on; $('u-stop').hidden = !on;
      $('u-recheck').disabled = $('u-py').disabled = on;
    }
    $('u-run').addEventListener('click', async () => {
      if (R && !mol) { toast('RDKit 无法解析这个 SMILES，请先修正。'); return; }
      try { await invoke('uma_start', { python: info.executable, params: params() }); }
      catch (e) { $('u-result').innerHTML = `<div class="mx-err">${esc(why(e))}</div>`; return; }
      log = []; next = 0; ending = false;
      $('u-log').textContent = ''; $('u-log').hidden = false; $('u-result').innerHTML = ''; $('u-dir').hidden = false;
      busy(true);
      poll();
    });
    $('u-stop').addEventListener('click', () => invoke('uma_stop').catch(() => {}));
    $('u-dir').addEventListener('click', () => invoke('uma_open_dir').catch((e) => toast(why(e))));

    const show = (l) => (l.startsWith('@@STEP ') ? `▸ ${l.slice(7)}` : l.startsWith('@@ERROR ') ? `✗ ${(() => { try { return JSON.parse(l.slice(8)).message; } catch { return l.slice(8); } })()}` : l.startsWith('@@') ? null : l);
    async function poll() {
      clearTimeout(timer);
      let p;
      try { p = await invoke('uma_poll', { since: next }); } catch { timer = setTimeout(poll, 1000); return; }
      if (p.lines.length) {
        log.length = Math.min(log.length, p.from);
        log.push(...p.lines);
        next = log.length;
        const box = $('u-log'), atEnd = box.scrollTop + box.clientHeight >= box.scrollHeight - 30;
        box.textContent = log.map(show).filter((l) => l !== null).join('\n');
        if (atEnd) box.scrollTop = box.scrollHeight;
      }
      if (p.running) { timer = setTimeout(poll, 400); return; }
      if (!ending && p.exit !== null) { ending = true; timer = setTimeout(poll, 300); return; } // last lines after exit
      if (p.exit !== null) finish(p.exit);
    }

    function finish(code) {
      busy(false);
      const pick = (tag) => { const l = [...log].reverse().find((x) => x.startsWith(tag)); try { return l ? JSON.parse(l.slice(tag.length)) : null; } catch { return null; } };
      const res = pick('@@RESULT '), err = pick('@@ERROR ');
      const out = $('u-result');
      if (res) out.innerHTML = resultCard(res);
      else if (err?.kind === 'hf_access') out.innerHTML = '<div class="mx-err">Hugging Face 拒绝下载 UMA：这个账号还没有 facebook/UMA 的权限，或者 token 失效。申请或重新登录后再试。</div>';
      else out.innerHTML = `<div class="mx-err">${code === 0 ? '计算结束了，但没有读到结果。' : err ? `计算出错：${esc(err.message)}` : `计算被停止，或 Python 意外退出（退出码 ${code}）。`}</div>`;
    }
    const f4 = (v) => (Number.isFinite(v) ? v.toFixed(3) : '—');
    function resultCard(r) {
      const files = (r.files || []).map((f) => `<code>${esc(f)}</code>`).join(' ');
      let body = '';
      if (r.job === 'ipea') {
        const row = r.row || {};
        const cols = [['UMA-S', 'uma_s'], ['UMA-M', 'uma_m'], ['D4rev 微调', 'd4rev']].filter(([, c]) => `ip_${c}` in row);
        body = `<table class="mx-res-table"><thead><tr><th>模型</th><th>IP（eV）</th><th>EA（eV）</th></tr></thead><tbody>${cols.map(([n, c]) => `<tr><td>${n}</td><td>${f4(row[`ip_${c}`])}</td><td>${f4(row[`ea_${c}`])}</td></tr>`).join('')}</tbody></table>`
          + (cols.some(([, c]) => c !== 'd4rev') ? '<div class="btns"><button type="button" class="button primary small" data-act="lab">导入 AI 实验室 →</button><button type="button" class="button small" data-act="csv">复制 CSV</button></div>' : '<p class="muted small">D4rev 的数值不进 AI 实验室（实验室只读 UMA-S / UMA-M 列）。</p>');
        out.csv = `${Object.keys(row).join(',')}\n${Object.values(row).join(',')}\n`;
      } else if (r.job === 'conf') {
        body = `<p>最低能量 E = ${r.energy_ev.toFixed(6)} eV。各构象的相对能量（kcal/mol）：${(r.relative_kcal || []).slice(0, 20).map((v) => v.toFixed(2)).join('、')}</p>`;
      } else if (r.job === 'opt') body = `<p>优化后的能量 E = ${r.energy_ev.toFixed(6)} eV</p>`;
      else body = `<p>分子动力学完成：${r.steps} 步，300 K。</p>`;
      return `<div class="mx-res"><h4>计算完成 · ${esc(r.model)}</h4>${body}<p class="muted small">文件：${files}</p></div>`;
    }
    const out = $('u-result');
    out.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b || !out.csv) return;
      if (b.dataset.act === 'csv') copy(out.csv);
      if (b.dataset.act === 'lab') {
        try { localStorage.setItem('molastria-lab-import', out.csv); } catch { toast('浏览器存储不可用，请复制 CSV 到 AI 实验室手动导入'); return; }
        location.href = '../lab/index.html#workbench';
      }
    });

    // A calculation keeps running while the visitor looks at other pages; pick its log back up.
    invoke('uma_poll', { since: 0 }).then((p) => {
      if (!p.running && p.exit === null) return;
      $('u-log').hidden = false; $('u-dir').hidden = false;
      if (p.running) { busy(true); poll(); } else { ending = true; poll(); }
    }).catch(() => {});
    find();
  }

  // ── 开放资源筛选 ────────────────────────────────────────────────────────
  const items = [...document.querySelectorAll('#o-grid .mx-item')];
  const chips = [...document.querySelectorAll('.mx-filter button')];
  let kind = '';
  function filter() {
    const q = $('o-q').value.trim().toLowerCase();
    let shown = 0;
    for (const it of items) {
      const hit = (!kind || it.dataset.kind === kind) && (!q || it.textContent.toLowerCase().includes(q));
      it.hidden = !hit;
      if (hit) shown++;
    }
    $('o-empty').hidden = shown > 0;
  }
  chips.forEach((b) => b.addEventListener('click', () => {
    kind = b.dataset.kind;
    chips.forEach((c) => c.setAttribute('aria-pressed', String(c === b)));
    filter();
  }));
  $('o-q').addEventListener('input', filter);

  // ── fairchem 最新版本（GitHub releases + Hugging Face facebook/UMA）────
  const LIVE = 'molastria-meta-live';
  const day = (iso) => String(iso || '').slice(0, 10);
  async function live() {
    let data = null;
    try { data = JSON.parse(sessionStorage.getItem(LIVE) || 'null'); } catch {}
    if (!data || Date.now() - data.t > 3600e3) {
      const get = (url) => fetch(url, { headers: { Accept: 'application/json' } }).then((r) => (r.ok ? r.json() : Promise.reject(new Error(r.status))));
      const [rel, uma] = await Promise.allSettled([
        get('https://api.github.com/repos/facebookresearch/fairchem/releases?per_page=6'),
        get('https://huggingface.co/api/models/facebook/UMA')
      ]);
      data = {
        t: Date.now(),
        releases: rel.status === 'fulfilled' && Array.isArray(rel.value) ? rel.value.slice(0, 5).map((r) => ({ name: r.name || r.tag_name, url: r.html_url, date: day(r.published_at) })) : [],
        uma: uma.status === 'fulfilled' ? day(uma.value.lastModified) : ''
      };
      if (data.releases.length) try { sessionStorage.setItem(LIVE, JSON.stringify(data)); } catch {}
    }
    const safe = (u) => (/^https:\/\/github\.com\//.test(u) ? u : 'https://github.com/facebookresearch/fairchem/releases');
    const rows = data.releases.map((r) => `<li><a href="${esc(safe(r.url))}" target="_blank" rel="noopener">${esc(r.name)}</a><span>${esc(r.date)}</span></li>`);
    if (data.uma) rows.push(`<li><a href="https://huggingface.co/facebook/UMA" target="_blank" rel="noopener">facebook/UMA</a><span>模型库最近更新 ${esc(data.uma)}</span></li>`);
    $('live-list').innerHTML = rows.join('') || '<li><span>暂时读不到 GitHub 和 Hugging Face。</span><a href="https://github.com/facebookresearch/fairchem/releases" target="_blank" rel="noopener">直接去 GitHub 看 ↗</a></li>';
  }
  live().catch(() => {});
})();
