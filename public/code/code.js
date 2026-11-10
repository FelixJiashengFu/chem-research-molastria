/* 开源代码台的界面：四个标签（写输入、读输出、软件体检、搜代码）。逻辑都在 code-core.js（MolAstriaCode）。
   从 SMILES 生成坐标用 viewer/smiles3d.js（MolAstriaSmiles3D），“读输出”的示例在 code-demos.js。
   上次的分子、设置和标签存在 localStorage 的 molastria-code；模型接口页把算好的结构放在 molastria-code-import，这里读一次就删掉。 */
(function () {
  'use strict';
  const C = window.MolAstriaCode;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tr = (s) => (window.ChemI18n?.t ? window.ChemI18n.t(s) : s);
  const KEY = 'molastria-code';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* 隐私模式 */ } };
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  // 外来的网址（PyPI 的 project_urls 等）只放行 http(s)，javascript: 之类的一律当纯文字。
  const safeUrl = (u) => { try { const x = new URL(String(u || '')); return /^https?:$/.test(x.protocol) ? x.href : ''; } catch { return ''; } };
  const link = (href, text) => { const u = safeUrl(href); return u ? `<a href="${esc(u)}" target="_blank" rel="noopener noreferrer">${esc(text)} ${ext}</a>` : esc(text); };

  // ── 标签 ──
  const TABS = ['input', 'output', 'check', 'search'];
  function show(tab, push) {
    if (!TABS.includes(tab)) tab = 'input';
    for (const t of TABS) {
      $(`t-${t}`).setAttribute('aria-selected', String(t === tab));
      $(`p-${t}`).hidden = t !== tab;
    }
    document.body.dataset.tab = tab;
    if (push) history.replaceState(null, '', `#${tab}`);
    save({ tab });
  }
  document.querySelectorAll('.cd-tabs [data-tab]').forEach((b) => b.addEventListener('click', () => show(b.dataset.tab, true)));
  document.querySelector('.cd-tabs').addEventListener('keydown', (e) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    const i = TABS.indexOf(document.body.dataset.tab);
    const next = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length];
    show(next, true); $(`t-${next}`).focus();
  });

  // ── 写输入 ──
  const SAMPLES = {
    water: { xyz: '3\nwater (experimental geometry)\nO   0.000000   0.000000   0.117300\nH   0.000000   0.757200  -0.469200\nH   0.000000  -0.757200  -0.469200\n', charge: 0, mult: 1, name: 'water' },
    formaldehyde: { xyz: '4\nformaldehyde\nC   0.000000   0.000000  -0.526500\nO   0.000000   0.000000   0.677000\nH   0.000000   0.937800  -1.112300\nH   0.000000  -0.937800  -1.112300\n', charge: 0, mult: 1, name: 'formaldehyde' },
    methyl: { xyz: '4\nmethyl radical (planar)\nC   0.000000   0.000000   0.000000\nH   1.079000   0.000000   0.000000\nH  -0.539500   0.934400   0.000000\nH  -0.539500  -0.934400   0.000000\n', charge: 0, mult: 2, name: 'methyl' },
    o2: { xyz: '2\ntriplet O2\nO   0.000000   0.000000   0.603700\nO   0.000000   0.000000  -0.603700\n', charge: 0, mult: 3, name: 'o2' },
  };
  const ABOUT = {
    pyscf: ['PySCF', 'https://pyscf.org', 'Apache-2.0'], psi4: ['Psi4', 'https://psicode.org', 'LGPL-3.0'], xtb: ['xTB', 'https://xtb-docs.readthedocs.io', 'LGPL-3.0'],
    crest: ['CREST', 'https://crest-lab.github.io/crest-docs/', 'LGPL-3.0'], orca: ['ORCA', 'https://www.faccts.de/orca/', '学术免费，商用收费'], gaussian: ['Gaussian', 'https://gaussian.com', '商业软件'],
    nwchem: ['NWChem', 'https://nwchemgit.github.io', 'ECL-2.0'], cp2k: ['CP2K', 'https://www.cp2k.org', 'GPL-2.0'], ase: ['ASE + tblite', 'https://ase-lib.org', 'LGPL-2.1 / LGPL-3.0'],
    qcschema: ['QCSchema', 'https://molssi-qc-schema.readthedocs.io', 'BSD-3'],
  };
  const st = load();
  // 多帧的 XYZ（构象、自旋态、反应里的各个分子）：frame 是用哪一帧，frameMeta 是每一帧自己的电荷和多重度（模型接口送来的才有）
  let frame = Number.isInteger(st.frame) ? st.frame : 0;
  let frameMeta = Array.isArray(st.frameMeta) ? st.frameMeta : null;
  let prog = C.PROGRAMS.some(([id]) => id === st.prog) ? st.prog : 'pyscf';
  $('in-progs').innerHTML = C.PROGRAMS.map(([id, name]) => `<button type="button" role="tab" data-prog="${id}" aria-selected="${id === prog}" translate="no">${esc(name)}</button>`).join('');
  $('in-progs').addEventListener('click', (e) => {
    const b = e.target.closest('[data-prog]');
    if (!b) return;
    prog = b.dataset.prog;
    $('in-progs').querySelectorAll('[data-prog]').forEach((x) => x.setAttribute('aria-selected', String(x === b)));
    save({ prog });
    render();
  });

  const opts = () => ({
    charge: Number($('in-charge').value), mult: Number($('in-mult').value), method: $('in-method').value, basis: $('in-basis').value,
    task: $('in-task').value, solvent: $('in-water').checked ? 'water' : '', d3: $('in-d3').checked, name: $('in-name').value.trim() || 'mol',
  });
  let current = null;
  function render() {
    const parsed = C.parseXYZ($('in-xyz').value, frame);
    frame = parsed.frame;
    frames(parsed);
    const o = opts();
    const status = $('in-status');
    let bad = false;
    if (parsed.errors.length) { status.textContent = parsed.errors.join('；'); bad = true; }
    else {
      const sp = C.checkSpin(parsed.atoms, o.charge, o.mult);
      status.textContent = `${C.formula(parsed.atoms)} · ${parsed.atoms.length} 个原子 · ${sp.message}`;
      bad = !sp.ok;
    }
    status.dataset.bad = String(bad);
    const g = bad ? { supported: false, text: '', notes: [parsed.errors.length ? '先把坐标改对。' : '电荷和多重度对不上，先改过来。'] } : C.generate(prog, parsed.atoms, o);
    current = g;
    $('in-code').textContent = g.supported ? g.text : '';
    $('in-code').dataset.empty = String(!g.supported);
    $('in-fname').textContent = g.supported ? g.filename : '';
    $('in-copy').disabled = $('in-save').disabled = !g.supported;
    $('in-run').textContent = g.run || '';
    $('in-run-row').hidden = !g.run;
    $('in-notes').innerHTML = (g.notes || []).map((n) => `<li>${esc(n)}</li>`).join('');
    const a = ABOUT[prog];
    $('in-about').innerHTML = `${link(a[1], a[0])} · 许可：${esc(a[2])}`;
    save({ xyz: $('in-xyz').value, opts: o, frame, frameMeta });
    preview(parsed);
  }
  function frames(p) {
    const row = $('in-frame-row'), sel = $('in-frame');
    row.hidden = p.frames < 2;
    if (p.frames < 2) { sel.innerHTML = ''; delete sel.dataset.key; return; }
    const key = p.comments.join('\n');
    if (sel.dataset.key !== key) {
      sel.innerHTML = p.comments.map((c, i) => `<option value="${i}">${i + 1} / ${p.frames}${c ? ` · ${esc(c.length > 90 ? `${c.slice(0, 90)}…` : c)}` : ''}</option>`).join('');
      sel.dataset.key = key;
    }
    sel.value = String(p.frame);
  }
  $('in-frame').addEventListener('change', () => {
    frame = Number($('in-frame').value) || 0;
    const m = frameMeta?.[frame];
    if (m) { $('in-charge').value = m.charge; $('in-mult').value = m.mult; }
    render();
    embedSummary();
  });
  // 3D 预览：点了才载入 3Dmol.js
  let lastXyz = '';
  function preview(parsed) {
    const box = $('in-preview');
    if (!window.MolAstriaMol3D || parsed.errors.length) { box.innerHTML = ''; lastXyz = ''; return; }
    const xyz = `${parsed.atoms.length}\n\n${parsed.atoms.map((x) => `${x.el} ${x.x} ${x.y} ${x.z}`).join('\n')}\n`;
    if (xyz === lastXyz) return;
    lastXyz = xyz;
    window.MolAstriaMol3D.button(box, { xyz, name: $('in-name').value || 'mol', label: '输入的结构' }, '预览 3D 结构');
  }
  // 换了分子以后，描述上一个分子的那几句（SMILES 生成的说明、“来自模型接口”）都要收起来
  function forget() {
    lastEmbed = null;
    $('in-embed-status').textContent = ''; $('in-embed-notes').innerHTML = '';
    $('in-import').hidden = true;
  }
  function setSample(k) {
    const s = SAMPLES[k];
    $('in-xyz').value = s.xyz; $('in-charge').value = s.charge; $('in-mult').value = s.mult; $('in-name').value = s.name;
    frame = 0; frameMeta = null; forget();
    render();
  }
  document.querySelectorAll('[data-sample]').forEach((b) => b.addEventListener('click', () => setSample(b.dataset.sample)));
  $('in-xyz').addEventListener('input', () => {
    frameMeta = null; // 改过坐标，原来每一帧的电荷和多重度不一定还对
    // 贴进来的是另一个多帧文件（各帧的注释变了）：从第一帧开始，不沿用上一个文件选的那一帧
    if (C.parseXYZ($('in-xyz').value).comments.join('\n') !== ($('in-frame').dataset.key || '')) frame = 0;
    forget();
    render();
  });
  ['in-charge', 'in-mult', 'in-name'].forEach((id) => $(id).addEventListener('input', render));
  ['in-method', 'in-basis', 'in-task', 'in-water', 'in-d3'].forEach((id) => $(id).addEventListener('change', render));
  $('in-copy').addEventListener('click', async () => {
    const b = $('in-copy');
    try { await navigator.clipboard.writeText(current.text); b.textContent = tr('已复制'); } catch { b.textContent = tr('复制失败'); }
    setTimeout(() => { b.textContent = tr('复制'); }, 1500);
  });
  $('in-save').addEventListener('click', () => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([current.text], { type: 'text/plain' }));
    a.download = current.filename; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  });
  // ── 从 SMILES 生成三维坐标 ──
  const S3 = window.MolAstriaSmiles3D;
  const smi = $('in-smiles');
  if (window.MolAstriaSketch) window.MolAstriaSketch.attach(smi);
  if (typeof st.smiles === 'string') smi.value = st.smiles;
  const embedStatus = (text, bad = false) => { const el = $('in-embed-status'); el.textContent = text; el.dataset.bad = String(bad); };
  function embedErr(e, r) {
    const m = e ? String(e.message || e) : r.error;
    if (m === 'stopped') return tr('已停止。');
    if (m === 'load') return tr('没载入 OpenChemLib（要联网访问 cdn.jsdelivr.net），过一会儿再试。');
    if (m === 'empty') return tr('先写一个 SMILES。');
    if (m === 'parse') return r.detail === 'whitespace' ? tr('SMILES 里不能有空格。') : `这个 SMILES 读不出来：${r.detail || ''}`;
    if (m === 'big') return `重原子有 ${r.heavy} 个，超过了浏览器里能算的 ${r.max} 个；这么大的分子请在本机用 RDKit 或 CREST 搭构象。`;
    if (m === 'stereo') return tr('搭出的构象和写的立体构型都对不上，换一种写法再试。');
    if (m === 'hcount') return `方括号里的 ${r.detail} 写明了 ${r.want} 个氢，OpenChemLib 读成了 ${r.got} 个，算出来会是另一个分子。自由基请换一种写法，比如二氧化氮写成 N(=O)[O]。`;
    if (m === 'embed') return tr('搭不出三维结构：检查一下价态，或者环是不是太紧张。');
    return `出错了：${m}`;
  }
  function embedNotes(r) {
    const W = {
      unspecified: () => `SMILES 里有 ${r.unspecified} 处立体构型没写，按第一个搭出的结构定成了 ${r.fixedSmiles}；要另一个异构体，请在 SMILES 里用 @、@@、/、\\ 写明。`,
      'stereo-dropped': () => tr('有的构象搭出来立体构型不对，已经去掉，只留和 SMILES 一致的。'),
      'no-forcefield': () => tr('MMFF94 力场算不了这个分子（不认识某些原子或价态，或者算不出能量），坐标没有优化，只是一个粗糙的起点，请先用 xTB 优化。'),
      'partly-optimised': () => tr('有的构象 MMFF94 算不出能量，坐标没有优化，排在最后；用前面优化过的那几个更好。'),
      atom: () => `单个原子：多重度按洪特规则填成基态的 ${r.mult}；要算别的态请自己改。`,
      'atom-check': () => `单个原子：多重度只按电子数的奇偶填成了 ${r.mult}；过渡金属的原子和离子基态常是高自旋（比如 Fe²⁺ 是五重态），请查表核对。`,
      fragments: () => `SMILES 里有 ${r.fragments} 个互不相连的部分，它们之间的相对位置是随手摆的。`,
      radical: () => `有 ${r.unpaired} 个未成对电子，多重度按高自旋填成 ${r.mult}；MMFF94 是给闭壳层分子做的，自由基的结构只能作参考。`,
    };
    $('in-embed-notes').innerHTML = r.warnings.map((w) => (W[w] ? `<li>${esc(W[w]())}</li>` : '')).join('');
  }
  // SMILES 生成的那一句：用的是第几个构象跟着选的帧变
  function embedSummary() {
    const r = lastEmbed;
    if (!r) return;
    const fr = r.frames[frame] || r.frames[0];
    const done = Number.isFinite(fr.energy);
    if (r.frames.length < 2) { embedStatus(done ? tr('生成了一个结构，已用 MMFF94 优化。') : tr('生成了一个结构（没有优化）。')); return; }
    const k = frame + 1, dE = done ? (fr.energy - r.frames[0].energy).toFixed(2) : '';
    // 整句写全（不拼接），界面翻译按整句认
    if (!frame) embedStatus(`搭了 ${r.tried} 个构象，去掉重复的还剩 ${r.frames.length} 个，按 MMFF94 能量从低到高排好，现在用的是能量最低的一个。`);
    else if (done) embedStatus(`搭了 ${r.tried} 个构象，去掉重复的还剩 ${r.frames.length} 个，按 MMFF94 能量从低到高排好；现在用的是第 ${k} 个，比最低的高 ${dE} kcal/mol。`);
    else embedStatus(`搭了 ${r.tried} 个构象，去掉重复的还剩 ${r.frames.length} 个，按 MMFF94 能量从低到高排好；现在用的是第 ${k} 个，这一个没有优化。`);
  }
  let embedding = false, lastEmbed = null;
  async function embedSmiles() {
    if (embedding || !S3) return;
    const text = smi.value.trim();
    $('in-embed-notes').innerHTML = '';
    if (!text) { embedStatus(tr('先写一个 SMILES。'), true); smi.focus(); return; }
    embedding = true;
    $('in-embed').disabled = true; $('in-embed-stop').hidden = false;
    embedStatus(tr('正在载入 OpenChemLib，搭构象…'));
    save({ smiles: text });
    try {
      const r = await S3.run(text, { onProgress: (k, n) => embedStatus(`正在用 MMFF94 优化第 ${k} 个构象（共 ${n} 个）…`) });
      if (r.error) { embedStatus(embedErr(null, r), true); return; }
      $('in-xyz').value = S3.toXYZ(r);
      $('in-charge').value = r.charge; $('in-mult').value = r.mult;
      if (Object.values(SAMPLES).some((s) => s.name === $('in-name').value)) $('in-name').value = 'mol';
      frame = 0; frameMeta = null; $('in-import').hidden = true;
      render();
      lastEmbed = r;
      embedSummary();
      embedNotes(r);
    } catch (e) {
      embedStatus(embedErr(e), true);
    } finally {
      embedding = false;
      $('in-embed').disabled = false; $('in-embed-stop').hidden = true;
    }
  }
  $('in-embed').addEventListener('click', embedSmiles);
  smi.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); embedSmiles(); } });
  $('in-embed-stop').addEventListener('click', () => S3?.stop());
  if (!S3) $('in-embed').disabled = true;

  // ── 从模型接口送来的结构 ──
  const MAX_IMPORT = 2e6;
  function importFromModels() {
    let d = null;
    try { d = JSON.parse(localStorage.getItem('molastria-code-import') || 'null'); localStorage.removeItem('molastria-code-import'); } catch { d = null; }
    if (!d || typeof d.xyz !== 'string' || !d.xyz.trim() || d.xyz.length > MAX_IMPORT) return false;
    const int = (v, lo, dflt) => (Number.isInteger(v) && v >= lo ? v : dflt);
    $('in-xyz').value = d.xyz;
    frameMeta = Array.isArray(d.meta) ? d.meta.slice(0, 1000).map((m) => ({ charge: int(m?.charge, -20, 0), mult: int(m?.mult, 1, 1) })) : null;
    frame = int(d.frame, 0, 0);
    const m = frameMeta?.[frame];
    $('in-charge').value = m ? m.charge : int(d.charge, -20, 0);
    $('in-mult').value = m ? m.mult : int(d.mult, 1, 1);
    if (typeof d.name === 'string' && /^[\w.-]{1,40}$/.test(d.name)) $('in-name').value = d.name;
    const note = $('in-import');
    note.textContent = '';
    const part = (tag, text, raw) => { const el = document.createElement(tag); el.textContent = text; if (raw) el.setAttribute('translate', 'no'); note.append(el); };
    part('span', tr('这个结构来自模型接口：'));
    if (typeof d.model === 'string') part('b', d.model.slice(0, 60)); // 有的模型名带中文（“eSEN-sm 直接受力型”），要跟着翻译
    if (typeof d.job === 'string') { note.append(' · '); part('span', d.job.slice(0, 40)); }
    part('span', tr('。电荷和多重度照那次计算填好了；坐标是机器学习势算的，正式计算前请检查。'));
    note.hidden = false;
    return true;
  }

  { // 上次的设置（方法、基组、任务、溶剂、色散）照旧；分子用送来的，没有就用上次的
    const o = st.opts || {};
    for (const [id, k] of [['in-method', 'method'], ['in-basis', 'basis'], ['in-task', 'task']]) if (o[k] && [...$(id).options].some((x) => x.value === o[k])) $(id).value = o[k];
    $('in-water').checked = !!o.solvent; $('in-d3').checked = !!o.d3;
    if (importFromModels()) render();
    else if (st.xyz) {
      $('in-xyz').value = st.xyz;
      if (o.charge !== undefined) $('in-charge').value = o.charge;
      if (o.mult) $('in-mult').value = o.mult;
      if (o.name) $('in-name').value = o.name;
      render();
    } else setSample('water');
  }

  // ── 读输出 ──
  const DEMOS = window.MolAstriaCodeDemos || {};
  const NAMES = { xtb: 'xTB', orca: 'ORCA', psi4: 'Psi4', gaussian: 'Gaussian', pyscf: 'PySCF', nwchem: 'NWChem', cp2k: 'CP2K', qchem: 'Q-Chem' };
  const yesNo = (v, yes, no) => (v === true ? `<b class="ok">${esc(yes)}</b>` : v === false ? `<b class="no">${esc(no)}</b>` : '<span class="cd-dim">—</span>');
  function readOutput() {
    const text = $('out-text').value;
    const box = $('out-result');
    if (!text.trim()) { box.innerHTML = `<p class="cd-empty">${esc(tr('还没有输出。'))}</p>`; return; }
    const r = C.parseOutput(text, $('out-prog').value);
    const rows = [];
    rows.push(['程序', r.program ? `<span translate="no">${NAMES[r.program]}</span>` : '<span class="cd-dim">—</span>']);
    if (r.energy !== null) {
      rows.push(['最终能量', `<span class="cd-num" translate="no">${r.energy.toFixed(8)} Eh</span><small class="cd-dim" translate="no">${r.energyEV.toFixed(4)} eV · ${esc(r.energyLabel)}</small>`]);
      if (!$('d-e1').value) $('d-e1').value = r.energy.toFixed(8);
    }
    rows.push(['正常结束', yesNo(r.normal, '是', '否')]);
    rows.push(['SCF 收敛', yesNo(r.scfConverged, '收敛', '没有收敛')]);
    if (r.optConverged !== null) rows.push(['结构优化', yesNo(r.optConverged, '收敛', '没有收敛')]);
    if (r.gap !== null) rows.push(['HOMO–LUMO 能隙', `<span class="cd-num" translate="no">${r.gap.toFixed(3)} eV</span>${r.gapNote ? `<small class="cd-dim cd-gapnote">${esc(r.gapNote)}</small>` : ''}`]);
    if (r.freqs.length) {
      const shown = r.freqs.slice(0, 12).map((v) => `<span class="${v < 0 ? 'cd-imag' : ''}">${v.toFixed(1)}</span>`).join(' ');
      rows.push(['振动频率 / cm⁻¹', `<span class="cd-freqs" translate="no">${shown}${r.freqs.length > 12 ? ' …' : ''}</span><small class="cd-dim">共 ${r.freqs.length} 个，虚频 ${r.imaginary.length} 个（负数表示虚频）</small>`]);
    }
    box.innerHTML = `<dl class="cd-dl">${rows.map(([k, v]) => `<div><dt>${esc(k)}</dt><dd>${v}</dd></div>`).join('')}</dl>`
      + (r.warnings.length ? `<ul class="cd-warn">${r.warnings.map((w) => `<li>${esc(w)}</li>`).join('')}</ul>` : `<p class="cd-ok">${esc(tr('没有发现问题。'))}</p>`);
    diff();
  }
  $('out-text').addEventListener('input', readOutput);
  $('out-prog').addEventListener('change', readOutput);
  const demo = () => { $('out-text').value = DEMOS[$('out-demo-prog').value] || ''; $('out-prog').value = ''; readOutput(); };
  $('out-demo').addEventListener('click', demo);
  $('out-demo-prog').addEventListener('change', () => { const t = $('out-text').value; if (!t.trim() || Object.values(DEMOS).includes(t)) demo(); });
  $('out-file').addEventListener('change', async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.size > 30e6) { $('out-result').innerHTML = `<p class="cd-warn1">${esc(tr('文件超过 30 MB，请只贴最后一部分。'))}</p>`; return; }
    $('out-text').value = await file.text();
    readOutput();
  });
  function diff() {
    const a = Number($('d-e1').value), b = Number($('d-e2').value), out = $('d-out');
    if (!$('d-e1').value.trim() || !$('d-e2').value.trim() || !Number.isFinite(a) || !Number.isFinite(b)) { out.textContent = tr('填两个能量（单位 Eh），算 E₂ − E₁。'); return; }
    const d = C.energyDiff(a, b);
    out.innerHTML = `<span translate="no">ΔE = ${d.hartree.toFixed(6)} Eh = ${d.kcal.toFixed(2)} kcal/mol = ${d.kj.toFixed(2)} kJ/mol = ${d.ev.toFixed(4)} eV</span>`;
  }
  $('d-e1').addEventListener('input', diff); $('d-e2').addEventListener('input', diff);
  diff();

  // ── 软件体检 ──
  const VERD = { ok: '可以', cond: '有条件', no: '不行' };
  const FAM_NAME = { permissive: 'MIT、BSD、ISC 等宽松许可', apache: 'Apache-2.0', mpl: 'MPL-2.0', lgpl: 'LGPL', gpl: 'GPL', agpl: 'AGPL', ccby: 'CC BY', ccbysa: 'CC BY-SA', nc: '非商业（CC BY-NC 等）', none: '没有许可证', proprietary: '商业或自定义许可' };
  const FAM_EX = { permissive: 'MIT', apache: 'Apache-2.0', mpl: 'MPL-2.0', lgpl: 'LGPL-3.0', gpl: 'GPL-3.0', agpl: 'AGPL-3.0', ccby: 'CC-BY-4.0', ccbysa: 'CC-BY-SA-4.0', nc: 'CC-BY-NC-4.0', none: '', proprietary: 'Proprietary' };
  const verdictCells = (v) => C.USES.map(([u]) => `<td><b class="${v.verdicts[u]}">${esc(tr(VERD[v.verdicts[u]]))}</b></td>`).join('');
  $('lic-table').innerHTML = `<thead><tr><th>许可证</th>${C.USES.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody>${Object.keys(FAM_NAME).map((f) => {
    const v = C.licenceVerdict(FAM_EX[f]);
    return `<tr><th scope="row">${esc(FAM_NAME[f])}<small>${esc(v.why)}</small></th>${verdictCells(v)}</tr>`;
  }).join('')}</tbody>`;

  const fetchJSON = async (url, init) => {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 12000);
    try {
      const res = await fetch(url, { ...init, signal: ctl.signal });
      if (res.status === 404) return { notFound: true };
      if (!res.ok) throw new Error(String(res.status));
      return await res.json();
    } finally { clearTimeout(timer); }
  };
  const card = (id, title) => `<section class="cd-card" id="${id}"><h3>${esc(title)}</h3><div class="cd-card-body"><p class="cd-dim">${esc(tr('正在查询…'))}</p></div></section>`;
  const fill = (id, html) => { const el = document.querySelector(`#${id} .cd-card-body`); if (el) el.innerHTML = html; };
  const failed = (name, href) => `<p class="cd-warn1">${esc(tr('没连上'))} ${esc(name)}。${link(href, tr('去官网看'))}</p>`;
  let run = 0;
  async function check(q) {
    const me = ++run;
    const t = C.parseTarget(q);
    const out = $('ck-out');
    if (!t.kind) { out.innerHTML = `<p class="cd-warn1">${esc(t.error)}</p>`; return; }
    save({ check: q });
    out.innerHTML = (t.kind === 'pypi' ? card('ck-pypi', 'PyPI') + card('ck-osv', '已知漏洞（OSV）') : '') + card('ck-lic', '许可证结论') + card('ck-repo', '源码仓库') + card('ck-swh', '长期存档（Software Heritage）');
    let repo = t.kind === 'pypi' ? null : t;
    let licence = '', pypiFailed = false;
    const licCard = (raw, from) => {
      const v = C.licenceVerdict(raw);
      fill('ck-lic', `<p><b translate="no">${esc(raw || tr('没写'))}</b> <span class="cd-dim">· ${esc(from)}</span></p><p class="cd-p">${esc(v.why)}</p><div class="cd-tablewrap"><table class="cd-lic small"><thead><tr>${C.USES.map(([, l]) => `<th>${esc(l)}</th>`).join('')}</tr></thead><tbody><tr>${verdictCells(v)}</tr></tbody></table></div>`);
    };
    if (t.kind === 'pypi') {
      try {
        const j = await fetchJSON(`https://pypi.org/pypi/${encodeURIComponent(t.name)}/json`);
        if (me !== run) return;
        if (j.notFound) { fill('ck-pypi', `<p class="cd-warn1">${esc(tr('PyPI 上没有这个包。'))}</p>`); fill('ck-osv', ''); fill('ck-lic', ''); fill('ck-repo', ''); fill('ck-swh', ''); return; }
        const s = C.summarizePypi(j);
        repo = s.repo; licence = s.licence;
        fill('ck-pypi', `<dl class="cd-dl"><div><dt>${esc(tr('最新版本'))}</dt><dd translate="no">${esc(s.name)} ${esc(s.version)}${s.released ? ` <small class="cd-dim">${esc(s.released)}</small>` : ''}</dd></div>`
          + `<div><dt>${esc(tr('简介'))}</dt><dd translate="no">${esc(s.summary)}</dd></div>`
          + (s.requiresPython ? `<div><dt>Python</dt><dd translate="no">${esc(s.requiresPython)}</dd></div>` : '')
          + `<div><dt>${esc(tr('链接'))}</dt><dd>${link(`https://pypi.org/project/${encodeURIComponent(t.name)}/`, 'PyPI')} ${Object.entries(s.urls).slice(0, 4).map(([k, u]) => link(u, k)).join(' ')}</dd></div></dl>`
          + `<p class="cd-small">${esc(tr('conda-forge 上的同名包：'))}${link(`https://anaconda.org/conda-forge/${encodeURIComponent(t.name)}`, 'anaconda.org')}</p>`);
        licCard(licence, 'PyPI');
        fetchJSON('https://api.osv.dev/v1/query', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ package: { name: t.name, ecosystem: 'PyPI' }, version: s.version }) })
          .then((o) => {
            if (me !== run) return;
            const v = C.summarizeOsv(o);
            fill('ck-osv', v.length
              ? `<p class="cd-warn1">${esc(s.version)}：${v.length} ${esc(tr('条已知漏洞'))}</p><ul class="cd-vulns">${v.map((x) => `<li>${link(x.url, x.id)} ${x.severity ? `<b class="no">${esc(x.severity)}</b>` : ''} <span>${esc(x.summary)}</span></li>`).join('')}</ul>`
              : `<p><b class="ok">${esc(tr('最新版本没有已知漏洞'))}</b> <span class="cd-dim">· ${esc(s.version)}</span></p>`);
          })
          .catch(() => fill('ck-osv', failed('OSV', `https://osv.dev/list?ecosystem=PyPI&q=${encodeURIComponent(t.name)}`)));
      } catch {
        if (me !== run) return;
        fill('ck-pypi', failed('PyPI', `https://pypi.org/project/${encodeURIComponent(t.name)}/`));
        fill('ck-osv', failed('OSV', `https://osv.dev/list?ecosystem=PyPI&q=${encodeURIComponent(t.name)}`));
        fill('ck-lic', `<p class="cd-dim">${esc(tr('没拿到许可证信息。'))}</p>`);
        pypiFailed = true;
      }
    }
    if (!repo) {
      fill('ck-repo', `<p class="cd-dim">${esc(tr(pypiFailed ? '不知道源码仓库在哪。' : 'PyPI 页面上没写源码仓库。'))}</p>`);
      fill('ck-swh', `<p class="cd-dim">${esc(tr('没有仓库网址，查不了存档。'))}</p><p class="cd-small">${link(`https://archive.softwareheritage.org/browse/search/?q=${encodeURIComponent(t.name || '')}`, tr('在存档里按名字搜'))}</p>`);
      return;
    }
    if (repo.kind === 'github') {
      fetchJSON(`https://api.github.com/repos/${encodeURIComponent(repo.owner)}/${encodeURIComponent(repo.repo)}`)
        .then((g) => {
          if (me !== run) return;
          if (g.notFound) { fill('ck-repo', `<p class="cd-warn1">${esc(tr('GitHub 上没有这个仓库。'))}</p>`); return; }
          const pushed = (g.pushed_at || '').slice(0, 10);
          const months = pushed ? (Date.now() - Date.parse(pushed)) / 2.63e9 : 0;
          fill('ck-repo', `<dl class="cd-dl"><div><dt>${esc(tr('仓库'))}</dt><dd>${link(g.html_url, g.full_name)}</dd></div>`
            + `<div><dt>${esc(tr('星标'))}</dt><dd translate="no">${Number(g.stargazers_count || 0).toLocaleString()}</dd></div>`
            + `<div><dt>${esc(tr('最近推送'))}</dt><dd translate="no">${esc(pushed)}${g.archived ? ` <b class="no">${esc(tr('已归档'))}</b>` : months > 18 ? ` <b class="cond">${esc(tr('一年半没有推送'))}</b>` : ''}</dd></div>`
            + `<div><dt>${esc(tr('GitHub 认出的许可证'))}</dt><dd translate="no">${esc(g.license?.spdx_id || '—')}</dd></div></dl>`);
          if (!licence) licCard(g.license?.spdx_id || '', 'GitHub');
        })
        .catch(() => { fill('ck-repo', failed('GitHub', repo.url)); if (!licence) fill('ck-lic', `<p class="cd-dim">${esc(tr('没拿到许可证信息。'))}</p>`); });
    } else fill('ck-repo', `<p>${link(repo.url, repo.url.replace(/^https:\/\//, ''))}</p>`);
    const swh = `https://archive.softwareheritage.org/browse/origin/directory/?origin_url=${encodeURIComponent(repo.url)}`;
    fetchJSON(`https://archive.softwareheritage.org/api/1/origin/${encodeURIComponent(repo.url)}/visit/latest/`)
      .then((v) => {
        if (me !== run) return;
        fill('ck-swh', v.notFound
          ? `<p class="cd-warn1">${esc(tr('还没有存档。'))}</p><p class="cd-small">${link('https://archive.softwareheritage.org/save/', tr('请 Software Heritage 存一份'))}</p>`
          : `<p><b class="ok">${esc(tr('已存档'))}</b> <span class="cd-dim" translate="no">${esc((v.date || '').slice(0, 10))}</span></p><p class="cd-small">${link(swh, tr('浏览存档'))} · ${esc(tr('论文里引用某一版本时，用存档页上的 SWHID。'))}</p>`);
      })
      .catch(() => fill('ck-swh', failed('Software Heritage', swh)));
  }
  $('ck-form').addEventListener('submit', (e) => { e.preventDefault(); check($('ck-q').value); });
  document.querySelectorAll('[data-ck]').forEach((b) => b.addEventListener('click', () => { $('ck-q').value = b.dataset.ck; check(b.dataset.ck); }));
  if (st.check) $('ck-q').value = st.check;
  let checked = false;
  $('t-check').addEventListener('click', () => { if (!checked) { checked = true; check($('ck-q').value); } });

  // ── 搜代码 ──
  $('sr-repos').innerHTML = `${esc(tr('常用仓库：'))}<span translate="no">${C.CHEM_REPOS.map(esc).join(' · ')}</span>`;
  function links() {
    const L = C.searchLinks($('sr-q').value, { lang: $('sr-lang').value, chem: $('sr-chem').checked });
    $('sr-repos').hidden = !$('sr-chem').checked;
    $('sr-links').innerHTML = L.length ? L.map((x) => `<li><a class="cd-btn" href="${esc(x.url)}" target="_blank" rel="noopener noreferrer" data-engine="${x.id}"><b translate="no">${esc(x.name.replace(' 代码搜索', ''))}</b>${x.name.includes('代码搜索') ? esc(tr(' 代码搜索')) : ''} ${ext}</a><small>${esc(x.note)}</small></li>`).join('') : `<li class="cd-dim">${esc(tr('先写一个关键字。'))}</li>`;
    if (ready) save({ search: $('sr-q').value });
  }
  let ready = false;
  $('sr-form').addEventListener('submit', (e) => { e.preventDefault(); const a = $('sr-links').querySelector('a'); if (a) a.click(); });
  ['sr-q'].forEach((id) => $(id).addEventListener('input', links));
  ['sr-lang', 'sr-chem'].forEach((id) => $(id).addEventListener('change', links));
  if (st.search) $('sr-q').value = st.search;
  links(); ready = true;

  const hash = location.hash.slice(1);
  show(TABS.includes(hash) ? hash : st.tab || 'input', false);
  if (document.body.dataset.tab === 'check') { checked = true; check($('ck-q').value); }
})();
