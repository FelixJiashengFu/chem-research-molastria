/* 开源代码台的“quacc 流水线”标签：选配方和引擎，写一批分子，交给站长电脑上的 quacc（账号服务 /uma/jobs，
   在线模型 quacc-gfn2、quacc-psi4、quacc-emt），或者拿走一段在自己电脑上跑的 quacc 脚本。逻辑在 quacc-core.js
   （MolAstriaQuacc）。配方、引擎、分子列表存在 localStorage 的 molastria-code（和其他标签共用一份）。
   别人的结果（SMILES、报错）一律当文字放进页面。 */
(function () {
  'use strict';
  const Q = window.MolAstriaQuacc;
  const $ = (id) => document.getElementById(id);
  if (!Q || !$('p-quacc')) return;
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tr = (s) => (window.ChemI18n?.t ? window.ChemI18n.t(s) : s);
  const en = () => document.documentElement.lang === 'en';
  const KEY = 'molastria-code';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const save = (patch) => { try { localStorage.setItem(KEY, JSON.stringify({ ...load(), ...patch })); } catch { /* 隐私模式 */ } };
  const token = () => { try { return localStorage.getItem('molastria-session') || ''; } catch { return ''; } };
  const api = () => String(window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
  const status = (t, bad = false) => { const el = $('qc-status'); el.textContent = t; el.dataset.bad = String(bad); };
  const f = (v, d) => (Number.isFinite(v) ? Number(v).toFixed(d) : '—');

  const st = load();
  const S = {
    recipe: Q.RECIPE[st.qcRecipe] ? st.qcRecipe : 'relax_freq',
    engine: Q.ENGINE[st.qcEngine] && st.qcEngine !== 'emt' ? st.qcEngine : 'tblite',
    method: Q.PSI4_METHODS.includes(st.qcMethod) ? st.qcMethod : 'b3lyp-d3bj',
    basis: Q.PSI4_BASES.includes(st.qcBasis) ? st.qcBasis : 'def2-svp',
    element: Q.EMT_METALS.includes(st.qcMetal) ? st.qcMetal : 'Cu',
  };
  $('qc-list').value = typeof st.qcList === 'string' ? st.qcList : Q.SAMPLES.molecules;
  let health = null, busy = false, last = null, lastNames = {};

  // ── 配方卡片和选项 ──
  $('qc-recipes').innerHTML = Q.RECIPES.map(([id, name, fn, about]) => `<button type="button" role="radio" class="qc-recipe" data-recipe="${id}" aria-checked="false">
      <b>${esc(tr(name))}</b><code translate="no">${esc(fn)}</code><small>${esc(tr(about))}</small></button>`).join('');
  $('qc-method').innerHTML = Q.PSI4_METHODS.map((m) => `<option value="${m}">${m.toUpperCase().replace('-D3BJ', '-D3(BJ)')}</option>`).join('');
  $('qc-basis').innerHTML = Q.PSI4_BASES.map((b) => `<option value="${b}">${b}</option>`).join('');
  $('qc-metal').innerHTML = Q.EMT_METALS.map((m) => `<option value="${m}">${m}</option>`).join('');
  $('qc-method').value = S.method; $('qc-basis').value = S.basis; $('qc-metal').value = S.element;
  if (st.qcIndex === 2) $('qc-index').value = '2';
  if (Number.isFinite(st.qcFmax)) $('qc-fmax').value = st.qcFmax;
  if (Number.isFinite(st.qcTemp)) $('qc-temp').value = st.qcTemp;

  function engines() { // the engines that can run the chosen recipe; slabs only EMT
    return Q.ENGINES.filter((e) => e.recipes.includes(S.recipe));
  }
  function state() {
    const { items } = Q.parseList($('qc-list').value);
    return { recipe: S.recipe, engine: Q.engineFor(S.recipe, S.engine), items, fmax: Number($('qc-fmax').value), temperature: Number($('qc-temp').value),
      method: $('qc-method').value, basis: $('qc-basis').value, element: $('qc-metal').value, max_index: Number($('qc-index').value) === 2 ? 2 : 1 };
  }

  function render() {
    document.querySelectorAll('.qc-recipe').forEach((b) => b.setAttribute('aria-checked', String(b.dataset.recipe === S.recipe)));
    const list = engines();
    if (!list.some((e) => e.id === Q.engineFor(S.recipe, S.engine))) S.engine = list[0].id;
    const eid = Q.engineFor(S.recipe, S.engine);
    $('qc-engine').innerHTML = list.map((e) => `<option value="${e.id}">${esc(tr(e.name))}${e.model ? '' : ` · ${esc(tr('只在本机'))}`}</option>`).join('');
    $('qc-engine').value = eid;
    const E = Q.ENGINE[eid];
    $('qc-engine-note').textContent = `${tr('许可证')}：${tr(E.license)}。${tr(E.note)}`;
    const slab = S.recipe === 'slabs';
    $('qc-mols').hidden = slab; $('qc-slab').hidden = !slab;
    $('qc-method-l').hidden = $('qc-basis-l').hidden = eid !== 'psi4';
    $('qc-fmax-l').hidden = S.recipe === 'static';
    $('qc-temp-l').hidden = S.recipe !== 'relax_freq';
    const s = state();
    const { bad, extra } = Q.parseList($('qc-list').value);
    const n = s.items.length;
    $('qc-count').textContent = slab ? '' : [
      `${tr('共')} ${n} ${tr('个分子')}`,
      bad.length ? `${tr('不是 SMILES 的行')}：${bad.join(', ')}` : '',
      n > Q.MAX_ITEMS ? `${tr('在线一批最多')} ${Q.MAX_ITEMS} ${tr('个')}` : '',
      extra.length ? `${tr('本机脚本最多')} ${Q.MAX_LOCAL} ${tr('个')}` : '',
    ].filter(Boolean).join(' · ');
    const can = Q.online(S.recipe, eid), tooMany = !slab && (n === 0 || n > Q.MAX_ITEMS);
    const model = E.model, h = health?.models?.[model];
    $('qc-run').disabled = busy || !can || tooMany || (health && health.online === false) || (h && !h.ready);
    $('qc-cost').textContent = !can ? tr('这个引擎只给本机脚本')
      : health === null ? tr('正在看站长的电脑在不在线…')
      : !health.online ? tr('站长的电脑现在离线，可以先用右边的脚本')
      : h && !h.ready ? tr('站长的电脑上还没有装这个引擎')
      : `${tr('用掉今天在线计算次数')} ${Q.cost(s)} ${tr('次')}${h && (h.queue || h.running) ? ` · ${tr('前面排队')} ${(h.queue || 0) + (h.running ? 1 : 0)} ${tr('个')}` : ''}`;
    $('qc-install').innerHTML = `${esc(tr('安装'))}：<code translate="no">${esc(E.install.replace(/；.*$/, ''))}</code>${E.install.includes('；') ? `。${esc(tr(E.install.replace(/^.*?；/, '')))}` : ''}`;
    $('qc-script').textContent = Q.script(s);
    save({ qcRecipe: S.recipe, qcEngine: S.engine, qcMethod: s.method, qcBasis: s.basis, qcMetal: s.element, qcIndex: s.max_index, qcFmax: s.fmax, qcTemp: s.temperature, qcList: $('qc-list').value });
  }
  $('qc-recipes').addEventListener('click', (e) => {
    const b = e.target.closest('[data-recipe]');
    if (!b) return;
    S.recipe = b.dataset.recipe;
    render();
  });
  $('qc-recipes').addEventListener('keydown', (e) => {
    if (!['ArrowRight', 'ArrowDown', 'ArrowLeft', 'ArrowUp'].includes(e.key)) return;
    e.preventDefault();
    const ids = Q.RECIPES.map((r) => r[0]), i = ids.indexOf(S.recipe);
    S.recipe = ids[(i + (e.key === 'ArrowRight' || e.key === 'ArrowDown' ? 1 : ids.length - 1)) % ids.length];
    render();
    document.querySelector(`[data-recipe="${S.recipe}"]`).focus();
  });
  $('qc-engine').addEventListener('change', () => { S.engine = $('qc-engine').value; render(); });
  ['qc-method', 'qc-basis', 'qc-metal', 'qc-index'].forEach((id) => $(id).addEventListener('change', render));
  ['qc-list', 'qc-fmax', 'qc-temp'].forEach((id) => $(id).addEventListener('input', render));
  $('qc-sample').addEventListener('click', () => { $('qc-list').value = Q.SAMPLES.molecules; render(); });

  const download = (text, name, type) => {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name; document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  };
  $('qc-copy').addEventListener('click', async () => {
    const b = $('qc-copy');
    try { await navigator.clipboard.writeText($('qc-script').textContent); b.textContent = tr('已复制'); } catch { b.textContent = tr('复制失败'); }
    setTimeout(() => { b.textContent = tr('复制'); }, 1500);
  });
  $('qc-save').addEventListener('click', () => download($('qc-script').textContent, `quacc_${S.recipe}.py`, 'text/x-python'));
  $('qc-csv').addEventListener('click', () => last && download(Q.csv(last, lastNames), `quacc_${last.recipe || 'slabs'}.csv`, 'text/csv'));
  $('qc-json').addEventListener('click', () => last && download(JSON.stringify(last, null, 1), `quacc_${last.recipe || 'slabs'}.json`, 'application/json'));

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

  $('qc-run').addEventListener('click', async () => {
    let s, b;
    try { s = state(); b = Q.body(s); } catch (e) { status(tr(e.message), true); return; }
    lastNames = Object.fromEntries(s.items.filter((x) => x.name).map((x) => [x.smiles, x.name]));
    busy = true; render();
    status(tr('已提交，正在排队…'));
    try {
      let r = await call('/uma/jobs', { method: 'POST', body: JSON.stringify(b) });
      const until = Date.now() + 20 * 60 * 1000;
      while (r.status !== 'done' && r.status !== 'error') {
        const p = r.progress && Number(r.progress.total) ? ` ${Number(r.progress.done) || 0}/${Number(r.progress.total)}${r.progress.note ? ` · ${r.progress.note}` : ''}` : '';
        status(r.status === 'running' ? `${tr('quacc 正在计算')}${p}` : `${tr('排队中，前面还有')} ${Math.max(0, (r.position || 1) - 1)} ${tr('个任务')}`);
        if (Date.now() > until) throw new Error(tr('等了 20 分钟还没算完，请稍后再试'));
        await new Promise((ok) => setTimeout(ok, 1500));
        r = await call(`/uma/jobs/${r.id}`);
      }
      if (r.status === 'error') throw new Error(r.error || tr('计算失败'));
      last = r.result;
      status(r.cached ? tr('完成（这批以前算过，直接给了存下的结果，没有再算）') : tr('完成'));
      show(last);
      window.MolAstriaActivity?.('practice');
    } catch (e) {
      status(e.message, true);
    } finally {
      busy = false; render(); refresh();
    }
  });

  // ── 结果 ──
  function show(r) {
    $('qc-result').hidden = false;
    const fake = r.fake ? ` · ${tr('测试用的假数据')}` : '';
    if (Array.isArray(r.slabs)) {
      const rows = Q.slabRows(r);
      $('qc-meta').innerHTML = `<b translate="no">${esc(r.element)}</b> · ${esc(r.engine || '')} · quacc ${esc(r.quacc_version || '')} · a = ${f(r.a_angstrom, 4)} Å · E<sub>bulk</sub> = ${f(r.e_bulk_ev_atom, 4)} eV/${esc(tr('原子'))}${esc(fake)}`;
      $('qc-table').innerHTML = `<thead><tr><th>${esc(tr('晶面'))}</th><th>γ (J/m²)</th><th>γ (eV/Å²)</th><th>${esc(tr('相对最低'))}</th><th>${esc(tr('原子数'))}</th><th>${esc(tr('面积'))} (Å²)</th><th>${esc(tr('优化'))}</th></tr></thead><tbody>${rows.map((x) => `<tr><td translate="no"><b>${esc(x.hkl)}</b></td><td class="cd-num">${f(x.gamma_j_m2, 3)}</td><td class="cd-num">${f(x.gamma_ev_a2, 4)}</td><td class="cd-num">${f(x.ratio, 3)}</td><td class="cd-num">${x.atoms}</td><td class="cd-num">${f(x.area_a2, 1)}</td><td>${x.converged ? '✓' : esc(tr('未收敛'))} ${x.steps} ${esc(tr('步'))}</td></tr>`).join('')}</tbody>`;
      $('qc-chart').innerHTML = chart(rows);
      $('qc-caveat').textContent = tr('γ = (E_slab − N·E_bulk) / 2A，上下两个表面都算在里面。EMT 是给七种 fcc 金属拟合的教学用势：(111) 最低、(100) 次之、(110) 最高这个顺序是对的，绝对值比实验和 DFT 低（铜的实验平均值约 1.8 J/m²）。');
      return;
    }
    const rows = Q.rows(r, lastNames), freq = r.recipe === 'relax_freq', opt = r.recipe !== 'static';
    $('qc-meta').innerHTML = `${esc(tr(Q.RECIPE[r.recipe]?.name || r.recipe))} · ${esc(r.engine || '')} · quacc ${esc(r.quacc_version || '')} · ${tr('成功')} ${r.n_ok}/${rows.length}${esc(fake)}`;
    const head = [tr('分子'), tr('分子式'), 'E (eV)', ...(opt ? [tr('优化')] : []), ...(freq ? [tr('虚频'), 'ZPE (eV)', 'G (eV)', tr('点群')] : []), ''];
    $('qc-table').innerHTML = `<thead><tr>${head.map((h) => `<th>${esc(h)}</th>`).join('')}</tr></thead><tbody>${rows.map((x, i) => {
      const name = `<code translate="no">${esc(x.smiles)}</code>${x.name ? ` <span class="cd-dim" translate="no">${esc(x.name)}</span>` : ''}${x.charge || x.spin > 1 ? ` <span class="cd-dim">q=${x.charge} · 2S+1=${x.spin}</span>` : ''}`;
      if (!x.ok) return `<tr><td>${name}</td><td colspan="${head.length - 1}" class="qc-err">${esc(x.error)}</td></tr>`;
      return `<tr><td>${name}</td><td translate="no">${esc(x.formula)}</td><td class="cd-num">${f(x.energy_ev, 4)}</td>${opt ? `<td>${x.converged ? '✓' : `<span class="qc-err">${esc(tr('未收敛'))}</span>`} ${x.steps ?? ''} ${esc(tr('步'))}</td>` : ''}${freq ? `<td class="cd-num${x.n_imag ? ' qc-err' : ''}">${x.n_imag}</td><td class="cd-num">${f(x.zpe_ev, 3)}</td><td class="cd-num">${f(x.g_ev, 4)}</td><td translate="no">${esc(x.point_group)}${x.symmetry_number ? ` (σ=${x.symmetry_number})` : ''}</td>` : ''}<td class="qc-3d" data-i="${i}"></td></tr>`;
    }).join('')}</tbody>`;
    $('qc-chart').innerHTML = '';
    if (window.MolAstriaMol3D) document.querySelectorAll('#qc-table .qc-3d').forEach((td) => {
      const x = rows[Number(td.dataset.i)];
      if (x?.xyz) window.MolAstriaMol3D.button(td, { xyz: x.xyz, name: `quacc-${x.formula || 'mol'}`, label: x.smiles }, tr('3D'));
    });
    $('qc-caveat').textContent = freq
      ? tr('热化学按理想气体、1 bar 算，对称数和点群由 quacc 从结构判断；自由基的电子熵按 SMILES 的自旋多重度补上。分子不同，G 不能直接相减成反应能，除非原子守恒。GFN2-xTB 是半经验方法，频率和能量适合筛选，不能代替 DFT。')
      : tr('能量是这个引擎的总能量（eV），只有同一种方法、原子守恒的物种之间才能相减。');
  }
  /** γ 的横条图（SVG），颜色用页面的 CSS 变量，两种主题都能看 */
  function chart(rows) {
    if (!rows.length) return '';
    const W = 520, bar = 22, gap = 10, left = 70, H = rows.length * (bar + gap) + 26, max = Math.max(...rows.map((r) => r.gamma_j_m2)) * 1.1;
    const x = (v) => left + (v / max) * (W - left - 60);
    return `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="${esc(tr('各晶面的表面能'))}" class="qc-svg">${rows.map((r, i) => {
      const y = 8 + i * (bar + gap);
      return `<text x="${left - 10}" y="${y + bar * 0.7}" text-anchor="end" class="qc-svg-l">${esc(r.hkl)}</text><rect x="${left}" y="${y}" width="${Math.max(1, x(r.gamma_j_m2) - left)}" height="${bar}" rx="4" class="qc-svg-b${i ? '' : ' low'}"/><text x="${x(r.gamma_j_m2) + 6}" y="${y + bar * 0.7}" class="qc-svg-v">${f(r.gamma_j_m2, 3)}</text>`;
    }).join('')}<text x="${left}" y="${H - 4}" class="qc-svg-a">γ (J/m²)</text></svg>`;
  }

  render();
  refresh();
  // e2e and debugging: what the tab shows now
  window.MolAstriaQuaccTab = { state, show, get last() { return last; } };
})();
