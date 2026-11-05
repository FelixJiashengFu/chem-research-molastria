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
    status('<span>Muse 正在读图…</span>');
    try {
      const model = $('v-model').value;
      const r = await window.ChemAI.chat({
        provider: 'muse', model, effort: 'low', maxTokens: 3000, temperature: 0,
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
      status(`<div class="mx-err">${noKey ? '识图需要 Meta Model API key：Muse Spark 能看图，在 AI 设置里选 Meta Muse 并填入 key。' : `识图没有完成：${esc(e.message)}`}${noKey ? '<br><button type="button" class="button small" data-act="settings">配置 Muse key</button>' : ''}</div>`);
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
  const fileName = () => `uma_${($('u-name').value.trim() || 'molecule').replace(/[^\w.-]+/g, '_')}_${JOBS[$('u-job').value]}.py`;

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
      `MODEL, DEVICE = ${py(model)}, ${py(device)}  # DEVICE = "cpu" also works, only slower`
    ];
    const predictor = job === 'md'
      ? ['# fairchem seeds numpy\'s global RNG when it loads a model; pass a fresh seed for a new trajectory.', 'seed = int(np.random.randint(0, np.iinfo(np.int32).max))', 'predictor = pretrained_mlip.get_predict_unit(MODEL, device=DEVICE, seed=seed)']
      : ['predictor = pretrained_mlip.get_predict_unit(MODEL, device=DEVICE)'];
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
        'predictor_m = pretrained_mlip.get_predict_unit("uma-m-1p1", device=DEVICE)',
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
    return [...head, ...imports, '', ...consts, '', ...predictor, '', '', ...(usesEmbed ? [...embed, '', ''] : []), ...relax, '', '', ...body, ''].join('\n');
  }

  function render() {
    const smiles = $('u-smiles').value.trim();
    const check = $('u-check');
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
      check.textContent = `${mol.formula} · ${mol.heavy} 个重原子 · ${e} 个电子${mismatch ? `，与自旋多重度 ${spin} 不相容` : ''}`;
      check.dataset.bad = String(mismatch);
    }
    $('u-code').textContent = ok ? script() : '# 先输入一个 RDKit 能解析的 SMILES';
    $('u-copy').disabled = $('u-download').disabled = !ok;
    $('u-file').textContent = fileName();
    $('u-cmd').textContent = `python ${fileName()}`;
  }
  let typing = 0;
  $('u-smiles').addEventListener('input', () => { clearTimeout(typing); typing = setTimeout(onSmiles, 250); });
  $('u-charge').addEventListener('input', onCharge);
  for (const id of ['u-name', 'u-spin']) $(id).addEventListener('input', render);
  for (const id of ['u-job', 'u-model', 'u-device', 'u-m']) $(id).addEventListener('change', render);
  $('u-copy').addEventListener('click', () => copy($('u-code').textContent));
  $('u-download').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([$('u-code').textContent], { type: 'text/x-python' }));
    a.download = fileName();
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  render();
  rdkit.then(onSmiles, () => { $('u-check').textContent = 'RDKit.js 载入失败（需要联网访问 cdn.jsdelivr.net），脚本照常生成，但没有校验 SMILES。'; });

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
