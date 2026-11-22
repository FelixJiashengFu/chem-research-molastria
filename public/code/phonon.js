/* 开源代码台的“晶体声子”标签：选一个预设晶体或者贴 POSCAR / CIF，选算力的模型（EMT 或 UMA 的 omat 任务）和超胞、位移，
   交给站长电脑上的 phonopy（账号服务 /uma/jobs，任务 phon），画色散曲线、态密度、热容和熵；也给一段在自己电脑上跑的脚本。
   逻辑在 phonon-core.js（MolAstriaPhonon），画图借用谱图馆的 ../spectra/sp-plot.js（MOLASTRIA_SPECTRA_KIT）。
   选择存在 localStorage 的 molastria-code（和其他标签共用一份，键名以 ph 开头）。服务端回来的文字一律当文字放进页面。 */
(function () {
  'use strict';
  const P = window.MolAstriaPhonon, K = window.MOLASTRIA_SPECTRA_KIT;
  const $ = (id) => document.getElementById(id);
  if (!P || !$('p-phonon')) return;
  // 标签按钮自带中英两版（translate="no"），这样别的标签的英文页面不等这一页的译文
  if (document.documentElement.lang === 'en') $('t-phonon')?.querySelectorAll('[data-en]').forEach((el) => { el.textContent = el.dataset.en; });
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tr = (s) => (window.ChemI18n?.t ? window.ChemI18n.t(s) : s);
  const KEY = 'molastria-code';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* 隐私模式 */ } };
  const token = () => { try { return localStorage.getItem('molastria-session') || ''; } catch { return ''; } };
  const api = () => String(window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
  const status = (t, bad = false) => { const el = $('ph-status'); el.textContent = t; el.dataset.bad = String(bad); };
  const f = (v, d) => (Number.isFinite(v) ? Number(v).toFixed(d) : '—');
  const OWN = '__own';

  const st = load();
  const S = {
    source: st.phSource === 'structure' ? 'structure' : 'preset',
    preset: P.PRESET[st.phPreset] ? st.phPreset : 'Cu',
    engine: P.ENGINE[st.phEngine] ? st.phEngine : 'emt',
    unit: P.UNITS[st.phUnit] ? st.phUnit : 'thz',
  };
  $('ph-text').value = typeof st.phStructure === 'string' ? st.phStructure : '';
  if (st.phFormat === 'cif') $('ph-format').value = 'cif';
  if (Array.isArray(st.phSc) && st.phSc.length === 3) ['ph-sa', 'ph-sb', 'ph-sc'].forEach((id, i) => { if (Number.isInteger(st.phSc[i])) $(id).value = st.phSc[i]; });
  if (Number.isFinite(st.phDisp)) $('ph-disp').value = st.phDisp;
  if (Number.isFinite(st.phMesh)) $('ph-mesh').value = st.phMesh;
  if (Number.isFinite(st.phTmax)) $('ph-tmax').value = st.phTmax;
  if (st.phRelax === false) $('ph-relax').checked = false;
  $('ph-unit').value = S.unit;
  let health = null, busy = false, last = null, lastModel = '';

  // ── 晶体（预设卡片 + “自己的结构”）和引擎 ──
  $('ph-presets').innerHTML = P.PRESETS.map((p) => `<button type="button" role="radio" class="ph-preset" data-preset="${p.id}" aria-checked="false">
      <b translate="no">${esc(p.id)}</b><small>${esc(tr(p.name))}</small><small class="ph-a">a = ${p.a} Å</small></button>`).join('')
    + `<button type="button" role="radio" class="ph-preset own" data-preset="${OWN}" aria-checked="false"><b>${esc(tr('自己的结构'))}</b><small>${esc(tr('POSCAR 或 CIF'))}</small></button>`;
  $('ph-engine').innerHTML = P.ENGINES.map((e) => `<option value="${e.id}">${esc(tr(e.name))}</option>`).join('');

  function state() {
    const int = (id) => Math.round(Number($(id).value));
    return { source: S.source, preset: S.preset, engine: S.engine, structure: $('ph-text').value, format: $('ph-format').value,
      supercell: [int('ph-sa'), int('ph-sb'), int('ph-sc')], displacement: Number($('ph-disp').value), relax: $('ph-relax').checked,
      mesh: int('ph-mesh'), tMax: int('ph-tmax') };
  }

  function render() {
    const cur = S.source === 'preset' ? S.preset : OWN;
    document.querySelectorAll('.ph-preset').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.preset === cur)));
    $('ph-own').hidden = S.source !== 'structure';
    $('ph-engine').value = S.engine;
    const E = P.ENGINE[S.engine];
    $('ph-engine-note').textContent = `${tr('许可证')}：${tr(E.license)}。${tr(E.note)}`;
    const s = state(), est = P.estimate(s), why = est.error || P.engineProblem(s, est);
    let bad = '';
    try { P.body(s); } catch (e) { bad = e.message; }
    const parts = [];
    if (est.superAtoms) parts.push(`${tr('晶胞')} ${est.cellAtoms} ${tr('个原子')}，${tr('超胞')} ${est.superAtoms} ${tr('个原子')}${est.exact ? '' : `（${tr('估算')}）`}`);
    if (est.note) parts.push(tr(est.note));
    if (why || bad) parts.push(tr(why || bad));
    $('ph-estimate').textContent = parts.join(' · ');
    $('ph-estimate').dataset.bad = String(!!(why || bad));
    const h = health?.models?.[E.model];
    $('ph-run').disabled = busy || !!bad || (health && health.online === false) || (h && !h.ready);
    $('ph-cost').textContent = health === null ? tr('正在看站长的电脑在不在线…')
      : !health.online ? tr('站长的电脑现在离线，可以先用右边的脚本')
      : h && !h.ready ? tr('站长的电脑上还没有装这个引擎')
      : `${tr('用掉今天在线计算次数')} ${P.COST} ${tr('次')}${h && (h.queue || h.running) ? ` · ${tr('前面排队')} ${(h.queue || 0) + (h.running ? 1 : 0)} ${tr('个')}` : ''}`;
    $('ph-install').innerHTML = `${esc(tr('安装'))}：<code translate="no">pip install phonopy spglib seekpath ase${E.emtOnly ? '' : ' fairchem-core'}</code>${E.emtOnly ? '' : `。${esc(tr('UMA 要先在 Hugging Face 上同意许可证并登录'))}`}`;
    $('ph-script').textContent = P.script(s);
    save({ phSource: S.source, phPreset: S.preset, phEngine: S.engine, phStructure: s.structure.slice(0, P.LIMITS.maxText), phFormat: s.format,
      phSc: s.supercell, phDisp: s.displacement, phMesh: s.mesh, phTmax: s.tMax, phRelax: s.relax, phUnit: S.unit });
  }
  const pick = (id) => {
    if (id === OWN) S.source = 'structure';
    else { S.source = 'preset'; S.preset = id; if (!P.PRESET[id].emt && P.ENGINE[S.engine].emtOnly) S.engine = 'uma'; }
    render();
  };
  $('ph-presets').addEventListener('click', (e) => { const b = e.target.closest('[data-preset]'); if (b) pick(b.dataset.preset); });
  $('ph-presets').addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const ids = [...P.PRESETS.map((p) => p.id), OWN], i = ids.indexOf(S.source === 'preset' ? S.preset : OWN);
    const next = ids[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : ids.length - 1)) % ids.length];
    pick(next);
    document.querySelector(`.ph-preset[data-preset="${next}"]`).focus();
  });
  $('ph-engine').addEventListener('change', () => { S.engine = $('ph-engine').value; render(); });
  ['ph-format', 'ph-relax'].forEach((id) => $(id).addEventListener('change', render));
  ['ph-text', 'ph-sa', 'ph-sb', 'ph-sc', 'ph-disp', 'ph-mesh', 'ph-tmax'].forEach((id) => $(id).addEventListener('input', render));
  $('ph-text').addEventListener('change', () => { $('ph-format').value = P.guessFormat($('ph-text').value); render(); });
  $('ph-sample-poscar').addEventListener('click', () => { $('ph-text').value = P.SAMPLES.poscar; $('ph-format').value = 'poscar'; render(); });
  $('ph-sample-cif').addEventListener('click', () => { $('ph-text').value = P.SAMPLES.cif; $('ph-format').value = 'cif'; render(); });
  $('ph-file').addEventListener('change', () => {
    const file = $('ph-file').files?.[0];
    if (!file) return;
    if (file.size > P.LIMITS.maxText * 2) { status(`${tr('文件太大：结构文字最多')} ${P.LIMITS.maxText} ${tr('个字符')}`, true); return; }
    file.text().then((text) => {
      $('ph-text').value = text;
      $('ph-format').value = /\.cif$/i.test(file.name) ? 'cif' : P.guessFormat(text);
      status('');
      render();
    }).catch(() => status(tr('读不了这个文件'), true));
  });
  $('ph-unit').addEventListener('change', () => { S.unit = $('ph-unit').value; render(); if (last) plots(last); });

  const download = (text, name, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  const stem = () => `phonon_${String(last?.formula || 'crystal').replace(/[^A-Za-z0-9]+/g, '')}`;
  $('ph-copy').addEventListener('click', async () => {
    const b = $('ph-copy');
    try { await navigator.clipboard.writeText($('ph-script').textContent); b.textContent = tr('已复制'); } catch { b.textContent = tr('复制失败'); }
    setTimeout(() => { b.textContent = tr('复制'); }, 1500);
  });
  $('ph-save').addEventListener('click', () => download($('ph-script').textContent, 'phonopy_phonons.py', 'text/x-python'));
  $('ph-csv').addEventListener('click', () => last && download(P.csv(last), `${stem()}.csv`, 'text/csv'));
  $('ph-json').addEventListener('click', () => last && download(JSON.stringify(last, null, 1), `${stem()}.json`, 'application/json'));
  $('ph-poscar').addEventListener('click', () => last?.poscar && download(last.poscar, `${stem()}.vasp`, 'text/plain'));

  // ── 在线 ──
  async function call(path, opts = {}) {
    const t = token();
    const res = await fetch(api() + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(data.error?.message || data.error || `HTTP ${res.status}`), { status: res.status });
    return data;
  }
  async function refresh() {
    if (!api()) { health = { online: false }; render(); return; }
    try { health = await call('/uma/health'); } catch { health = { online: false }; }
    render();
  }

  $('ph-run').addEventListener('click', async () => {
    let b;
    try { b = P.body(state()); } catch (e) { status(tr(e.message), true); return; }
    lastModel = P.ENGINE[S.engine].name;
    busy = true; render();
    status(tr('已提交，正在排队…'));
    try {
      let r = await call('/uma/jobs', { method: 'POST', body: JSON.stringify(b) });
      const until = Date.now() + 20 * 60 * 1000;
      while (r.status !== 'done' && r.status !== 'error') {
        const p = r.progress && Number(r.progress.total) ? ` ${Number(r.progress.done) || 0}/${Number(r.progress.total)}${r.progress.note ? ` · ${r.progress.note}` : ''}` : '';
        status(r.status === 'running' ? `${tr('phonopy 正在计算')}${p}` : `${tr('排队中，前面还有')} ${Math.max(0, (r.position || 1) - 1)} ${tr('个任务')}`);
        if (Date.now() > until) throw new Error(tr('等了 20 分钟还没算完，请稍后再试'));
        await new Promise((ok) => setTimeout(ok, 1500));
        r = await call(`/uma/jobs/${r.id}`);
      }
      if (r.status === 'error') throw new Error(r.error || tr('计算失败'));
      last = r.result;
      status(r.cached ? tr('完成（这个晶体以前算过，直接给了存下的结果，没有再算）') : tr('完成'));
      show(last);
      window.MolAstriaActivity?.('practice');
    } catch (e) {
      status(e.message, true);
    } finally {
      busy = false; render(); refresh();
    }
  });

  // ── 结果 ──
  function plots(r) {
    const u = P.UNITS[S.unit], ul = u.label;
    const mount = (id, o) => { const el = $(id); if (!K) { el.textContent = tr('画图工具没有载入'); return; } const g = K.plot(o); el.innerHTML = g.svg; el._sp = g.meta; };
    const b = P.band(r, S.unit);
    const tickX = b.ticks.map((t) => t.x), label = (v) => b.ticks.find((t) => Math.abs(t.x - v) < 1e-9)?.label ?? '';
    const pad = (b.hi - Math.min(0, b.lo)) * 0.06;
    mount('ph-band', { x: b.x, y: [Math.min(0, b.lo) - (b.lo < 0 ? pad : 0), b.hi + pad], h: 320, zero: true,
      series: b.series.map((s) => ({ ...s, c: 0 })), xticks: tickX, xfmt: label, vlines: tickX.slice(1, -1).map((x) => ({ x, c: 5, dash: false })),
      yl: `${tr('频率')} (${ul})`, curfmt: () => '', aria: tr('声子色散曲线') });
    const d = P.dos(r, S.unit);
    mount('ph-dos', { x: [Math.min(0, ...d.xs), Math.max(...d.xs)], h: 320, series: [{ xs: d.xs, ys: d.ys, c: 1, fill: true }],
      xl: `${tr('频率')} (${ul})`, yl: `${tr('态密度')} (1/${ul})`, aria: tr('声子态密度') });
    const t = P.thermal(r);
    mount('ph-thermal', { x: [0, t.T[t.T.length - 1] || 1], h: 260,
      series: [{ xs: t.T, ys: t.Cv, c: 0, label: { zh: '定容热容 C_V', en: 'heat capacity C_V' } }, { xs: t.T, ys: t.S, c: 2, label: { zh: '熵 S', en: 'entropy S' } }],
      hlines: [{ y: t.dp, c: 1 }], legend: [{ c: 1, dash: true, t: { zh: `Dulong–Petit 3NR = ${f(t.dp, 2)}`, en: `Dulong–Petit 3NR = ${f(t.dp, 2)}` } }],
      xl: 'T (K)', yl: 'J/(K·mol)', aria: tr('热容和熵') });
  }

  function show(r) {
    $('ph-result').hidden = false;
    const sy = r.symmetry || {}, lat = r.lattice || {}, v = r.versions || {};
    const fake = r.fake ? ` · ${tr('测试用的假数据')}` : '';
    const cubic = Math.abs(lat.a - lat.b) < 1e-4 && Math.abs(lat.b - lat.c) < 1e-4;
    const cell = cubic ? `a = ${f(lat.a, 4)} Å` : `a, b, c = ${f(lat.a, 3)}, ${f(lat.b, 3)}, ${f(lat.c, 3)} Å · α, β, γ = ${f(lat.alpha, 1)}°, ${f(lat.beta, 1)}°, ${f(lat.gamma, 1)}°`;
    $('ph-meta').innerHTML = `<b translate="no">${esc(K ? K.chem(r.formula || '') : r.formula)}</b> · ${esc(tr('空间群'))} <b translate="no">${esc(sy.international)}</b>（No. ${esc(sy.number)}，${esc(tr('点群'))} <span translate="no">${esc(sy.point_group)}</span>，${esc(tr(sy.crystal_system || ''))}）`
      + ` · ${esc(cell)}${r.relax ? `（${esc(tr('优化前'))} ${f(r.lattice_input?.a, 4)} Å）` : ''}<br>`
      + `${esc(tr('原胞'))} ${esc(sy.n_primitive)} · ${esc(tr('惯用胞'))} ${esc(sy.n_conventional)} · ${esc(tr('超胞'))} ${esc((r.supercell || []).join('×'))} = ${esc(r.n_supercell)} ${esc(tr('个原子'))} · ${esc(r.n_displacements)} ${esc(tr('个位移超胞'))} · ${esc(tr('位移'))} ${esc(r.displacement_a)} Å`
      + ` · Wyckoff <span translate="no">${esc((sy.wyckoffs || []).join(', '))}</span><br>`
      + `<span class="cd-dim">${esc(lastModel || '')}${lastModel ? ' · ' : ''}phonopy ${esc(v.phonopy || '')} · spglib ${esc(v.spglib || '')} · seekpath ${esc(v.seekpath || '')}${esc(fake)}</span>`;
    $('ph-verdict').innerHTML = P.verdict(r).map(([k, t]) => `<p class="ph-verdict ${k}">${esc(tr(t))}</p>`).join('');
    plots(r);
    const th = P.thermal(r), temps = [100, 298.15, 500, 1000].filter((T) => T <= (th.T[th.T.length - 1] || 0) + 1e-9);
    const rows = temps.map((T) => P.at(r, T)).filter(Boolean);
    $('ph-table').innerHTML = `<thead><tr><th>T (K)</th><th>C<sub>V</sub> (J/K/mol)</th><th>C<sub>V</sub> / 3NR</th><th>S (J/K/mol)</th><th>F (kJ/mol)</th></tr></thead><tbody>${rows.map((x) => `<tr><td class="cd-num">${f(x.T, 0)}</td><td class="cd-num">${f(x.Cv, 3)}</td><td class="cd-num">${f(x.Cv / th.dp, 3)}</td><td class="cd-num">${f(x.S, 3)}</td><td class="cd-num">${f(x.F, 3)}</td></tr>`).join('')}</tbody>`
      + `<caption class="cd-small">${esc(tr('每摩尔原胞'))}（${esc(th.n)} ${esc(tr('个原子'))}）· ${esc(tr('零点能'))} ${f(th.zpe, 3)} kJ/mol · ${esc(tr('最高频率'))} ${f(P.toUnit(r.max_frequency_thz, S.unit), P.UNITS[S.unit].d)} ${esc(P.UNITS[S.unit].label)}</caption>`;
    $('ph-caveat').textContent = tr('谐振近似：频率不随温度变，没有热膨胀（要的话用准谐近似，在几个体积上各算一次）。热学量对每摩尔原胞，F 含零点能。力来自所选的模型，不是 DFT；EMT 只适合教学和检查流程。超胞太小时，远处的力常数被截掉，布里渊区边上的频率会偏；加大超胞看看收不收敛。');
  }

  render();
  refresh();
  // e2e and debugging: what the tab shows now
  window.MolAstriaPhononTab = { state, show, get last() { return last; } };
})();
