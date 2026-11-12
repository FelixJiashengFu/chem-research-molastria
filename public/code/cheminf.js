/* 开源代码台的“化学信息学”标签：RDKit.js（经 lab/chem.js 的 ChemLab.loadRDKit 从 jsDelivr 载入）在浏览器里
   给一列分子算描述符、画二维结构、标出子结构、按 Morgan 指纹排相似度；整理和导出在 cheminf-core.js（MolAstriaChemInf）。
   列表、SMARTS 和参照分子存在 localStorage 的 molastria-code（和其他标签共用一份）。
   “生成 3D 并写输入”把 SMILES 交给“写输入”标签（那里用 OpenChemLib 搭三维结构）。 */
(function () {
  'use strict';
  const CI = window.MolAstriaChemInf, L = window.ChemLab;
  const $ = (id) => document.getElementById(id);
  if (!CI || !$('p-chem')) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tr = (s) => (window.ChemI18n?.t ? window.ChemI18n.t(s) : s);
  const KEY = 'molastria-code';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* 隐私模式 */ } };
  const status = (t, bad = false) => { const el = $('ci-status'); el.textContent = t; el.dataset.bad = String(bad); };
  const fmt = (v, k) => (Number.isFinite(v) ? v.toFixed(k) : '—');

  let R = null, rows = [], current = -1, busy = false;
  const sample = () => (document.documentElement.lang === 'en' ? CI.SAMPLES_EN : CI.SAMPLES);
  const st = load();
  const list = $('ci-list'), smartsBox = $('ci-smarts'), refBox = $('ci-ref');
  if (typeof st.ciList === 'string') list.value = st.ciList;
  if (typeof st.ciSmarts === 'string') smartsBox.value = st.ciSmarts;
  if (typeof st.ciRef === 'string') refBox.value = st.ciRef;
  $('ci-smarts-pick').insertAdjacentHTML('beforeend', CI.SMARTS.map(([name, s]) => `<option value="${esc(s)}">${esc(name)}</option>`).join(''));
  if (window.MolAstriaSketch) window.MolAstriaSketch.attach($('ci-one'));

  async function rdkit() {
    if (R) return R;
    if (!L?.loadRDKit) throw new Error(tr('这一页没有载入 RDKit。'));
    R = await L.loadRDKit();
    return R;
  }
  // RDKit 的对象要手动释放
  function use(obj, fn) { try { return fn(obj); } finally { obj?.delete?.(); } }
  const getMol = (smi) => { const m = R.get_mol(String(smi || '').trim()); if (m && m.is_valid()) return m; m?.delete?.(); return null; };

  function svgOf(mol, atoms = [], bonds = [], w = 130, h = 95) {
    const opts = { width: w, height: h, clearBackground: false, atoms, bonds, highlightColour: [0.98, 0.69, 0.18] };
    try { return mol.get_svg_with_highlights(JSON.stringify(opts)); } catch { return mol.get_svg(w, h); }
  }

  /** The whole table from the list box: descriptors, highlights for the SMARTS, Tanimoto to the reference. */
  function compute() {
    const { mols, skipped } = CI.parseList(list.value);
    const smarts = smartsBox.value.trim(), ref = refBox.value.trim();
    let q = null, refFp = null, problem = '';
    if (smarts) { q = R.get_qmol(smarts); if (!q || !q.is_valid()) { q?.delete?.(); q = null; problem = `子结构 ${smarts} 不是 RDKit 能读的 SMARTS。`; } }
    if (ref) {
      const m = getMol(ref);
      if (m) refFp = use(m, (x) => x.get_morgan_fp(JSON.stringify({ radius: 2, nBits: 2048 })));
      else problem = `参照分子 ${ref} 不是 RDKit 能读的 SMILES。`;
    }
    try {
      rows = mols.map((m) => {
        const mol = getMol(m.smiles);
        if (!mol) return { ...m, d: null };
        return use(mol, (x) => {
          const d = JSON.parse(x.get_descriptors());
          const desc = L.describe ? L.describe(R, m.smiles) : null;
          let hit = null, hits;
          if (q) { const all = CI.matches(x.get_substruct_matches(q)); hits = all.length; hit = { atoms: [...new Set(all.flatMap((a) => a.atoms))], bonds: [...new Set(all.flatMap((a) => a.bonds || []))] }; }
          const inchi = (() => { try { return x.get_inchi(); } catch { return ''; } })();
          return {
            ...m, d, hits, hit, inchi,
            canonical: x.get_smiles(), formula: desc?.formula || '', inchikey: inchi ? R.get_inchikey_for_inchi(inchi) : '',
            svg: svgOf(x, hit?.atoms, hit?.bonds),
            sim: refFp ? CI.tanimoto(refFp, x.get_morgan_fp(JSON.stringify({ radius: 2, nBits: 2048 }))) : undefined,
          };
        });
      });
    } finally { q?.delete?.(); }
    if (refFp) rows.sort((a, b) => (b.sim ?? -1) - (a.sim ?? -1));
    const bad = rows.filter((r) => !r.d).length;
    const parts = [`算了 ${rows.length - bad} 个分子。`];
    if (bad) parts.push(`有 ${bad} 行读不出 SMILES，表里标红。`);
    if (skipped.length) parts.push(`超过 ${CI.MAX_MOLS} 个，后面 ${skipped.length} 行没算。`);
    if (q) parts.push(`${rows.filter((r) => r.hits).length} 个含有这个子结构（结构图里标黄）。`);
    if (refFp) parts.push(tr('已按和参照分子的 Tanimoto 相似度从高到低排好。'));
    if (problem) parts.push(problem);
    status(parts.join(''), !!(bad || problem));
    draw();
  }

  function draw() {
    const sim = rows.some((r) => r.sim !== undefined), hits = rows.some((r) => r.hits !== undefined);
    const head = `<thead><tr><th>结构</th><th>名字 / SMILES</th>${CI.COLUMNS.map(([, name, , unit]) => `<th>${esc(name)}${unit ? `<small>${esc(unit)}</small>` : ''}</th>`).join('')}<th>Lipinski</th><th>Veber</th>${sim ? '<th>相似度</th>' : ''}${hits ? '<th>子结构</th>' : ''}</tr></thead>`;
    const body = rows.map((r, i) => {
      if (!r.d) return `<tr class="ci-bad"><td></td><td><b>${esc(r.name || '')}</b><code translate="no">${esc(r.smiles)}</code><small>第 ${r.line} 行读不出来</small></td><td colspan="${CI.COLUMNS.length + 2 + (sim ? 1 : 0) + (hits ? 1 : 0)}"></td></tr>`;
      const lip = CI.lipinski(r.d), veb = CI.veber(r.d);
      return `<tr data-i="${i}" tabindex="0"${i === current ? ' aria-selected="true"' : ''}><td><div class="ci-img">${r.svg}</div></td><td><b translate="no">${esc(r.name || '')}</b><code translate="no">${esc(r.canonical)}</code><small translate="no">${esc(r.formula)}</small></td>`
        + CI.COLUMNS.map(([k, , dp]) => `<td class="n">${fmt(r.d[k], dp)}</td>`).join('')
        + `<td>${lip.pass ? (lip.broken.length ? '<span class="ci-ok">通过（违反 1 条）</span>' : '<span class="ci-ok">通过</span>') : `<span class="ci-no">违反 ${lip.broken.length} 条</span>`}</td>`
        + `<td>${veb.pass ? '<span class="ci-ok">通过</span>' : '<span class="ci-no">不通过</span>'}</td>`
        + (sim ? `<td class="n">${fmt(r.sim, 3)}</td>` : '') + (hits ? `<td class="n">${r.hits ?? ''}</td>` : '') + '</tr>';
    }).join('');
    $('ci-table').innerHTML = rows.length ? head + `<tbody>${body}</tbody>` : `<tbody><tr><td class="cd-empty">${esc(tr('列表里还没有分子。'))}</td></tr></tbody>`;
    $('ci-csv').disabled = $('ci-py').disabled = !rows.length;
    if ($('ci-py').getAttribute('aria-expanded') === 'true') pyFill();
    if (current >= rows.length || !rows[current]?.d) current = rows.findIndex((r) => r.d);
    detail();
  }

  const LIP_NAME = { mw: '分子量 > 500', logp: 'cLogP > 5', hbd: '氢键供体 > 5', hba: '氢键受体 > 10' };
  const VEB_NAME = { rotb: '可旋转键 > 10', tpsa: 'TPSA > 140 Å²' };
  function detail() {
    const box = $('ci-detail'), r = rows[current];
    document.querySelectorAll('#ci-table tbody tr[data-i]').forEach((tr2) => tr2.setAttribute('aria-selected', String(Number(tr2.dataset.i) === current)));
    if (!r?.d) { box.innerHTML = `<p class="cd-empty">${esc(tr('算完后点表格里的一行，这里显示它的结构、InChI 和全部描述符。'))}</p>`; return; }
    const big = use(getMol(r.smiles), (m) => svgOf(m, r.hit?.atoms, r.hit?.bonds, 360, 260));
    const lip = CI.lipinski(r.d), veb = CI.veber(r.d);
    const more = Object.entries(CI.MORE).filter(([k]) => Number.isFinite(r.d[k])).map(([k, name]) => `<tr><th>${esc(name)}</th><td translate="no"><code>${esc(k)}</code></td><td class="n">${fmt(r.d[k], Number.isInteger(r.d[k]) ? 0 : 3)}</td></tr>`).join('');
    box.innerHTML = `<div class="ci-big">${big}</div>`
      + `<p class="ci-name"><b translate="no">${esc(r.name || r.canonical)}</b> <span translate="no">${esc(r.formula)}</span></p>`
      + `<dl class="ci-ids"><dt>规范 SMILES</dt><dd translate="no"><code>${esc(r.canonical)}</code></dd><dt>InChI</dt><dd translate="no"><code>${esc(r.inchi || '—')}</code></dd><dt>InChIKey</dt><dd translate="no"><code>${esc(r.inchikey || '—')}</code></dd></dl>`
      + `<p class="cd-p">${lip.broken.length ? `Lipinski：${esc(lip.broken.map((k) => LIP_NAME[k]).join('、'))}。` : esc(tr('Lipinski 四项都满足。'))}${veb.pass ? esc(tr('Veber 两项都满足。')) : `Veber：${esc(veb.broken.map((k) => VEB_NAME[k]).join('、'))}。`}</p>`
      + '<div class="cd-row"><button type="button" class="cd-btn primary" id="ci-to3d">生成 3D 结构并写输入</button><button type="button" class="cd-btn" id="ci-mol">下载 MOL 文件</button>'
      + `<a class="cd-btn" href="https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(r.inchikey || r.canonical)}" target="_blank" rel="noopener noreferrer">在 PubChem 里查 <i class="ico-ext" aria-hidden="true"></i></a></div>`
      + `<details class="ci-more"><summary>全部 ${Object.keys(r.d).length} 个描述符</summary><div class="cd-tablewrap"><table class="ci-desc">${more}</table></div></details>`;
    $('ci-to3d').addEventListener('click', () => {
      const box2 = $('in-smiles');
      if (!box2) return;
      box2.value = r.canonical;
      box2.dispatchEvent(new Event('input', { bubbles: true }));
      if ($('in-name')) $('in-name').value = (r.name || 'mol').replace(/[^\w.-]+/g, '_').slice(0, 40) || 'mol';
      $('t-input').click();
      $('in-embed')?.click();
      box2.scrollIntoView({ block: 'center', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
    });
    $('ci-mol').addEventListener('click', () => {
      const mb = use(getMol(r.smiles), (m) => m.get_molblock());
      download(`${(r.name || 'molecule').replace(/[^\w.-]+/g, '_')}.mol`, mb, 'chemical/x-mdl-molfile');
    });
  }

  function download(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  const pyFill = () => { $('ci-pycode').textContent = CI.python(CI.parseList(list.value).mols, { smarts: smartsBox.value.trim(), ref: refBox.value.trim() }); };

  async function run() {
    if (busy) return;
    save({ ciList: list.value, ciSmarts: smartsBox.value, ciRef: refBox.value });
    if (!CI.parseList(list.value).mols.length) { status(tr('先在列表里写至少一个 SMILES。'), true); rows = []; draw(); return; }
    busy = true; $('ci-run').disabled = true;
    if (!R) status(tr('正在载入 RDKit（第一次约 7 MB）…'));
    try {
      await rdkit();
      compute();
    } catch (e) {
      status(String(e?.message || e), true);
    } finally { busy = false; $('ci-run').disabled = false; }
  }

  $('ci-run').addEventListener('click', run);
  list.addEventListener('keydown', (e) => { if (e.key === 'Enter' && (e.ctrlKey || e.metaKey)) { e.preventDefault(); run(); } });
  $('ci-sample').addEventListener('click', () => { list.value = sample(); refBox.value ||= 'OC(=O)c1ccccc1O'; run(); });
  $('ci-clear').addEventListener('click', () => { list.value = ''; rows = []; current = -1; status(''); save({ ciList: '' }); draw(); });
  $('ci-add').addEventListener('click', () => {
    const one = $('ci-one').value.trim();
    if (!one) { $('ci-one').focus(); return; }
    list.value = (list.value.replace(/\s*$/, '') + (list.value.trim() ? '\n' : '') + one + '\n');
    $('ci-one').value = '';
    run();
  });
  $('ci-one').addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); $('ci-add').click(); } });
  $('ci-smarts-pick').addEventListener('change', (e) => { if (e.target.value) { smartsBox.value = e.target.value; e.target.value = ''; if (rows.length) run(); } });
  let timer = 0;
  for (const box of [smartsBox, refBox]) box.addEventListener('input', () => { clearTimeout(timer); if (rows.length) timer = setTimeout(run, 400); });
  $('ci-table').addEventListener('click', (e) => { const row = e.target.closest('tr[data-i]'); if (row) { current = Number(row.dataset.i); detail(); } });
  $('ci-table').addEventListener('keydown', (e) => { const row = e.target.closest('tr[data-i]'); if (row && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); current = Number(row.dataset.i); detail(); } });
  $('ci-csv').addEventListener('click', () => download('molastria-descriptors.csv', CI.csv(rows, { sim: rows.some((r) => r.sim !== undefined), hits: rows.some((r) => r.hits !== undefined) }), 'text/csv'));
  $('ci-py').addEventListener('click', () => {
    const open = $('ci-py').getAttribute('aria-expanded') !== 'true';
    $('ci-py').setAttribute('aria-expanded', String(open));
    $('ci-pywrap').hidden = !open;
    if (open) pyFill();
  });
  $('ci-pycopy').addEventListener('click', async () => {
    try { await navigator.clipboard.writeText($('ci-pycode').textContent); $('ci-pycopy').textContent = tr('已复制'); }
    catch { $('ci-pycopy').textContent = tr('复制失败，请手动选中'); }
    setTimeout(() => { $('ci-pycopy').textContent = tr('复制脚本'); }, 1600);
  });
  // ── 按结构搜 PubChem ──
  const ssQ = $('ss-q'), ssMode = $('ss-mode'), ssTh = $('ss-th');
  if (typeof st.ssQ === 'string' && st.ssQ) ssQ.value = st.ssQ;
  if (CI.SEARCH_MODES.includes(st.ssMode)) ssMode.value = st.ssMode;
  if (Number.isFinite(st.ssTh)) ssTh.value = String(st.ssTh);
  if (window.MolAstriaSketch) window.MolAstriaSketch.attach(ssQ);
  const ssStatus = (t, bad = false) => { const el = $('ss-status'); el.textContent = t; el.dataset.bad = String(bad); };
  const ssModeSync = () => { $('ss-th-l').hidden = ssMode.value !== 'similarity'; };
  ssMode.addEventListener('change', ssModeSync); ssModeSync();
  let ssRows = [], ssBusy = false;
  async function pubchem(url, body) {
    const res = await fetch(url, body ? { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body } : {});
    const json = await res.json().catch(() => null);
    if (!json) throw new Error(`PubChem HTTP ${res.status}`);
    if (res.status === 503) throw new Error(tr('PubChem 现在太忙（限流），过一会儿再试。'));
    return json;
  }
  async function structureSearch(e) {
    e?.preventDefault();
    if (ssBusy) return;
    const raw = ssQ.value.trim();
    if (!raw) { ssStatus(tr('先写一个 SMILES，或者点“画结构”画一个。'), true); ssQ.focus(); return; }
    ssBusy = true; $('ss-go').disabled = true;
    try {
      if (!R) ssStatus(tr('正在载入 RDKit（第一次约 7 MB）…'));
      await rdkit();
      const q = getMol(raw);
      if (!q) { ssStatus(`RDKit 读不出 ${raw}，请检查 SMILES。`, true); return; }
      const canon = use(q, (m) => m.get_smiles());
      const qfp = use(getMol(canon), (m) => m.get_morgan_fp(JSON.stringify({ radius: 2, nBits: 2048 })));
      const req = CI.pubchemSearch(ssMode.value, canon, { threshold: ssTh.value, max: 20 });
      ssTh.value = String(req.threshold);
      save({ ssQ: raw, ssMode: req.mode, ssTh: req.threshold });
      ssStatus(tr('正在问 PubChem…'));
      const cids = CI.pubchemCids(await pubchem(req.url, req.body), req.max);
      if (!cids.length) { ssRows = []; ssDraw(); ssStatus(req.mode === 'similarity' ? `PubChem 里没有相似度 ≥ ${req.threshold}% 的化合物，可以把下限调低再试。` : tr('PubChem 里没有找到。'), false); return; }
      ssRows = CI.pubchemRows(await pubchem(CI.pubchemPropsUrl(cids)), cids).map((r) => {
        const m = r.smiles ? getMol(r.smiles) : null;
        if (!m) return { ...r, svg: '', sim: undefined };
        return use(m, (x) => ({ ...r, svg: svgOf(x), sim: CI.tanimoto(qfp, x.get_morgan_fp(JSON.stringify({ radius: 2, nBits: 2048 }))) }));
      });
      if (req.mode === 'similarity') ssRows.sort((a, b) => (b.sim ?? -1) - (a.sim ?? -1));
      ssDraw();
      ssStatus(`PubChem 找到 ${ssRows.length} 个${req.mode === 'similarity' ? `（相似度 ≥ ${req.threshold}%，最多列 ${req.max} 个）` : req.mode === 'substructure' ? `（最多列 ${req.max} 个）` : ''}。`);
    } catch (err) {
      const msg = String(err?.message || err);
      ssStatus(/fetch|network|Failed/i.test(msg) ? tr('连不上 PubChem（网络不通或被拦了）。可以点下面的链接直接在 PubChem 网站上搜。') : `PubChem：${msg}`, true);
      $('ss-table').innerHTML = `<tbody><tr><td class="cd-empty"><a href="https://pubchem.ncbi.nlm.nih.gov/#query=${encodeURIComponent(raw)}&input_type=smiles" target="_blank" rel="noopener noreferrer">${esc(tr('在 PubChem 网站上搜'))} <i class="ico-ext" aria-hidden="true"></i></a></td></tr></tbody>`;
    } finally { ssBusy = false; $('ss-go').disabled = false; }
  }
  function ssDraw() {
    const head = '<thead><tr><th>结构</th><th>名字 / CID</th><th>分子式</th><th>分子量<small>g/mol</small></th><th>Morgan 相似度</th><th></th></tr></thead>';
    const body = ssRows.map((r, i) => `<tr><td>${r.svg ? `<div class="ci-img">${r.svg}</div>` : ''}</td>`
      + `<td><b translate="no">${esc(r.title)}</b><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" translate="no">CID ${r.cid} <i class="ico-ext" aria-hidden="true"></i></a><code translate="no">${esc(r.smiles)}</code></td>`
      + `<td translate="no">${esc(r.formula)}</td><td class="n">${fmt(r.mw, 2)}</td><td class="n">${fmt(r.sim, 3)}</td>`
      + `<td><div class="ss-acts"><button type="button" class="cd-btn" data-ss="add" data-i="${i}">加到列表</button><a class="cd-btn" href="../index.html?q=${encodeURIComponent(r.title)}">在本站搜这个名字</a></div></td></tr>`).join('');
    $('ss-table').innerHTML = ssRows.length ? head + `<tbody>${body}</tbody>` : `<tbody><tr><td class="cd-empty">${esc(tr('没有结果。'))}</td></tr></tbody>`;
  }
  $('ss-form').addEventListener('submit', structureSearch);
  $('ss-table').addEventListener('click', (e) => {
    const b = e.target.closest('[data-ss=add]');
    if (!b) return;
    const r = ssRows[Number(b.dataset.i)];
    if (!r?.smiles) return;
    list.value = list.value.replace(/\s*$/, '') + (list.value.trim() ? '\n' : '') + `${r.smiles} ${r.title}\n`;
    b.textContent = tr('已加入'); b.disabled = true;
    run();
  });

  // 打开这个标签时，如果列表里有东西就直接算
  const maybe = () => { if (!$('p-chem').hidden && !rows.length && list.value.trim()) run(); };
  $('t-chem').addEventListener('click', maybe);
  if (!list.value.trim()) list.value = sample();
  setTimeout(maybe, 0);
})();
