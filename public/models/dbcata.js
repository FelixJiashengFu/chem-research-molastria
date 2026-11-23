/* 量子化学模型接口的“⑦ 合金表面吸附结构”窗口：选两种金属、比例、晶面和吸附物，交给站长电脑上的 DBCata 通道
   （账号服务 /uma/jobs，模型 dbcata，计算 adsgen）：电脑搭出每个不等价的吸附位点，DBCata 一步生成接近 DFT 弛豫的结构，
   四条化学规则（和分类器，有的话）标出异常，UMA（oc20 任务）给能量。这里画表单、表格和 3D 结构，逻辑在 dbcata-core.js。
   页签和面板都由本文件插进页面（models.js 之前载入），文字自带中英两版，标 translate="no"。账号服务没开放这个通道时
   （health 里没有 dbcata），页签藏起来；直接打开 #dbcata 时说明还没开放。服务器传回的文字一律当文字放进页面。
   DBCata（GPL-3.0）不是本站的一部分，只作为独立程序在站长电脑上运行；页面上写明出处和许可。 */
(function () {
  'use strict';
  const C = window.MolAstriaDbcataCore;
  const $ = (id) => document.getElementById(id);
  const tabs = $('m-tabs'), main = $('m-panel');
  if (!C || !tabs || !main) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const LT = (t) => (t ? (en ? t.en : t.zh) : '');
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const KEY = 'molastria-models-dbcata';
  const load = () => { try { return JSON.parse(localStorage.getItem(KEY) || '{}') || {}; } catch { return {}; } };
  const keep = (v) => { try { localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* storage off */ } };
  const api = () => String(window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
  const token = () => { try { return localStorage.getItem('molastria-session') || ''; } catch { return ''; } };
  const f = (v, d) => (Number.isFinite(v) ? Number(v).toFixed(d) : '—');
  const ico = (dir) => `<i class="ico-ext${dir ? ` ico-${dir}` : ''}" aria-hidden="true"></i>`;
  const DOI_URL = `https://doi.org/${C.DOI}`;

  // ── the tab and the panel ──────────────────────────────────────────────────────────────────────────────────────
  const tab = document.createElement('button');
  Object.assign(tab, { type: 'button', hidden: true });
  tab.setAttribute('role', 'tab');
  tab.dataset.win = 'dbcata';
  tab.setAttribute('aria-selected', 'false');
  tab.setAttribute('aria-controls', 'm-dbcata');
  tab.setAttribute('translate', 'no');
  tab.innerHTML = `<b>⑦</b><span>${esc(L('合金表面吸附结构', 'Adsorbates on alloy surfaces'))}</span><small>DBCata · UMA-OC20</small>`;
  tabs.append(tab);

  const metalOptions = (sel) => C.METAL_GROUPS.map(([g, ms]) => `<optgroup label="${esc({ '3d': L('3d 过渡金属', '3d transition metals'), '4d': L('4d 过渡金属', '4d transition metals'), '5d': L('5d 过渡金属', '5d transition metals'), p: L('p 区金属', 'p-block metals') }[g])}">${ms.map((m) => `<option value="${m}"${m === sel ? ' selected' : ''}>${m}</option>`).join('')}</optgroup>`).join('');
  const panel = document.createElement('div');
  panel.id = 'm-dbcata';
  panel.className = 'md-panel md-db';
  panel.setAttribute('role', 'tabpanel'); // its own text is bilingual (translate="no" per block); the 3D viewer's toolbar is i18n.js's
  panel.hidden = true;
  const st0 = load();
  const pick = (v, list, d) => (list.includes(v) ? v : d);
  const S = {
    a: pick(st0.a, C.METALS, 'Pt'), b: pick(st0.b, C.METALS, 'Ni'), x: pick(st0.x, C.RATIOS, 0.75), facet: pick(st0.facet, C.FACETS, '111'),
    ads: pick(st0.ads, C.ADSORBATES, 'OH'), polish: st0.polish !== false, steps: pick(st0.steps, C.STEPS, 20), lattice: pick(st0.lattice, C.LATTICES, 'uma'),
  };
  panel.innerHTML = `
    <p class="md-win-about" translate="no">${esc(L(
    '⑦ 给一个二元合金表面和一种吸附物，站长电脑会搭出表面上每一个不等价的吸附位点，用 DBCata（一个扩散生成模型）一步生成接近 DFT 弛豫的吸附结构，再用四条化学规则检查异常，最后用 Meta 的 UMA（OC20 任务）算能量、可选再做一段短程优化。结果是每个位点的结构、能量、和初始结构的距离误差（DMAE）与异常标记，以及能量最低的位点。',
    '⑦ Give a binary-alloy surface and an adsorbate: the site owner’s computer builds every distinct adsorption site on that surface, DBCata (a diffusion model) turns each start into a near-DFT-relaxed adsorption structure in one pass, four chemical rules flag anomalies, and Meta’s UMA (OC20 task) gives the energies, optionally after a short relaxation. You get every site’s structure, energy, distance error from the start (DMAE) and flags, and the lowest-energy site.'))}</p>
    <div class="md-db-domain" role="note" translate="no">
      <b>${esc(L('只在 DBCata 的训练范围内', 'Only inside DBCata’s training domain'))}</b>
      <span>${esc(L(
    'DBCata 只学过 Catalysis-Hub 上 Mamun 等人的数据：fcc 二元合金 A₃B / AB / AB₃（L1₂、L1₀ 有序结构）的 (111) 和 (110) 面，每层 4 个原子的三层板（12 个原子，下面两层 8 个原子固定），12 种吸附物。所以这里只能从列表里选，不接受上传的结构；超出范围的请求会被拒绝。',
    'DBCata was trained only on Mamun et al.’s Catalysis-Hub data: the (111) and (110) facets of fcc binary alloys A₃B / AB / AB₃ (L1₂, L1₀ ordering), three-layer slabs of 4 atoms a layer (12 atoms, the bottom two layers, 8 atoms, fixed), and 12 adsorbates. So the choices here come from fixed lists and no structure can be uploaded; requests outside that are refused.'))}</span>
    </div>
    <div class="md-grid" translate="no">
      <div class="md-card">
        <h2 class="md-step">${esc(L('1 · 合金表面', '1 · Alloy surface'))}</h2>
        <div class="md-row">
          <label>${esc(L('金属 A', 'Metal A'))}<select id="db-a">${metalOptions(S.a)}</select></label>
          <label>${esc(L('金属 B', 'Metal B'))}<select id="db-b">${metalOptions(S.b)}</select></label>
          <label>${esc(L('组成', 'Composition'))}<select id="db-x">${C.RATIOS.map((x) => `<option value="${x}"${x === S.x ? ' selected' : ''}>${{ 0.75: 'A₃B', 0.5: 'AB', 0.25: 'AB₃' }[x]}</option>`).join('')}</select></label>
        </div>
        <div class="md-seg md-db-facets" role="radiogroup" aria-label="${esc(L('晶面', 'Facet'))}">
          ${C.FACETS.map((x) => `<label><input type="radio" name="db-facet" value="${x}"${x === S.facet ? ' checked' : ''}> (${x})</label>`).join('')}
        </div>
        <p class="md-check" id="db-system"></p>
        <h2 class="md-step">${esc(L('2 · 吸附物', '2 · Adsorbate'))}</h2>
        <div class="md-db-ads" role="radiogroup" aria-label="${esc(L('吸附物', 'Adsorbate'))}">
          ${C.ADSORBATES.map((x) => `<label><input type="radio" name="db-ads" value="${x}"${x === S.ads ? ' checked' : ''}><span>${C.sub(x)}</span></label>`).join('')}
        </div>
        <p class="muted small" id="db-ref"></p>
      </div>
      <div class="md-card">
        <h2 class="md-step">${esc(L('3 · 计算', '3 · Run'))}</h2>
        <label class="md-checkbox"><input type="checkbox" id="db-polish"${S.polish ? ' checked' : ''}> ${esc(L('DBCata 之后再用 UMA 做一段短程优化（fmax 0.05 eV/Å，最多 100 步；能量更可靠，消耗 5 次，不做 3 次）', 'Relax briefly with UMA after DBCata (fmax 0.05 eV/Å, at most 100 steps; more reliable energies, 5 uses instead of 3)'))}</label>
        <div class="md-row">
          <label>${esc(L('DBCata 采样步数', 'DBCata sampling steps'))}<select id="db-steps">${C.STEPS.map((x) => `<option value="${x}"${x === S.steps ? ' selected' : ''}>${x}${x === 20 ? esc(L('（论文的默认值）', ' (the paper’s default)')) : ''}</option>`).join('')}</select></label>
          <label>${esc(L('晶格常数', 'Lattice constant'))}<select id="db-lattice">
            <option value="uma"${S.lattice === 'uma' ? ' selected' : ''}>${esc(L('Vegard 估计，再用 UMA（omat）弛豫体相', 'Vegard’s estimate, then the bulk relaxed with UMA (omat)'))}</option>
            <option value="vegard"${S.lattice === 'vegard' ? ' selected' : ''}>${esc(L('只用 Vegard 定律（实验晶格常数的线性插值）', 'Vegard’s law only (linear in the experimental lattice constants)'))}</option></select></label>
        </div>
        <p class="muted small">${esc(L('论文里 20 步和 100 步的 DMAE 几乎一样（0.0353 和 0.0349 Å）。论文的晶格常数来自 Catalysis-Hub（BEEF-vdW）；这里离线得不到那些数，所以先按 Vegard 定律估计，再让 UMA 弛豫，用到的数写在结果里。', 'In the paper 20 and 100 steps give almost the same DMAE (0.0353 and 0.0349 Å). The paper took its lattice constants from Catalysis-Hub (BEEF-vdW); those are not available offline here, so the start is Vegard’s law, then a UMA relaxation; the value used is in the result.'))}</p>
        <div class="md-row md-run-row"><button class="button primary" type="button" id="db-run" disabled></button><span class="muted small" id="db-why"></span></div>
        <div class="md-progress" id="db-progress" role="status" aria-live="polite"></div>
        <p class="md-fine">${esc(L('提交即表示同意：', 'By submitting you agree that: '))}${esc(L(
    'DBCata 在站长的 GPU 电脑上作为独立程序运行，它的代码采用 GPL-3.0 许可，不是本站的一部分；能量由 UMA 计算，采用 FAIR Chemistry License（只用于合法用途）。论文里请引用 DBCata 的论文和 UMA。结果是机器学习模型的预测，不是 DFT 计算，按原样提供，不作任何保证。',
    'DBCata runs on the site owner’s GPU computer as a separate program; its code is under GPL-3.0 and is not part of this site. The energies come from UMA under the FAIR Chemistry License (lawful use only). Cite the DBCata paper and UMA in your work. The results are machine-learning predictions, not DFT, provided as they are, without any warranty.'))}</p>
      </div>
    </div>
    <div id="db-result" class="md-result" aria-live="polite" translate="no"></div>
    <div class="md-db-view" id="db-view" hidden>
      <div class="md-db-view-head" translate="no"><b id="db-view-title"></b><span class="muted small" id="db-view-frames"></span></div>
      <div id="db-3d" class="md-3d"></div>
      <div class="btns" translate="no"><button type="button" class="button small" data-save="xyz">${esc(L('下载这个位点的结构（extxyz）', 'Download this site (extxyz)'))}</button><button type="button" class="button small" data-save="csv">${esc(L('下载表格（CSV）', 'Download the table (CSV)'))}</button><button type="button" class="button small" data-save="json">${esc(L('下载全部结果（JSON）', 'Download everything (JSON)'))}</button></div>
    </div>
    <div class="md-db-cite" translate="no">
      <p><b>${esc(L('出处', 'Source'))}</b> ${esc(C.citation(en))} <a href="${DOI_URL}" target="_blank" rel="noopener">${esc(L('论文', 'paper'))} ${ico()}</a> · <a href="https://github.com/Songze1019/DBCata" target="_blank" rel="noopener">${esc(L('代码（GPL-3.0）', 'code (GPL-3.0)'))} ${ico()}</a></p>
      <p class="muted small">${esc(L('四条规则按论文第 4.2.2 节：原子相撞（比共价半径之和的 0.8 倍还近）、吸附物解离、脱附、表面重构（后三条照 AdsorbML / fairchem 的定义）。DMAE 是论文的式 (16)：所有原子对距离差的平均（最小镜像）。吸附能 E_ads = E(吸附结构) − E(同一模型弛豫的干净表面) − Σ OC20 的气相参考（H −3.477、C −7.282、N −8.083、O −7.204 eV）；OC20 没有 S 的参考，所以 S 和 SH 只给 E(吸附结构) − E(表面)，只能用来比较位点。UMA 的 OC20 训练数据里也没有含 S 的吸附物，S、SH 的能量要格外小心。',
    'The four rules follow the paper’s section 4.2.2: collision (closer than 0.8 × the sum of covalent radii), dissociation, desorption and surface reconstruction (the last three as AdsorbML / fairchem define them). DMAE is the paper’s eq. (16): the mean difference of all pair distances (minimum image). E_ads = E(adsorbate on slab) − E(clean slab relaxed with the same model) − the OC20 gas references (H −3.477, C −7.282, N −8.083, O −7.204 eV); OC20 has none for S, so S and SH only get E(adslab) − E(slab), which ranks the sites. UMA’s OC20 training data have no S-containing adsorbates either: treat S and SH energies with extra care.'))}</p>
    </div>`;
  main.after(panel);

  // ── state ──────────────────────────────────────────────────────────────────────────────────────────────────────
  let health = null, busy = false, last = null, active = false;
  const choice = () => ({ metal_a: $('db-a').value, metal_b: $('db-b').value, ratio: Number($('db-x').value), facet: panel.querySelector('input[name=db-facet]:checked')?.value,
    adsorbate: panel.querySelector('input[name=db-ads]:checked')?.value, polish: $('db-polish').checked, steps: Number($('db-steps').value), lattice: $('db-lattice').value });
  const model = () => health?.models?.dbcata;

  function why(c) {
    if (c.error) return LT(c.error);
    if (!api() || health?.configured === false) return L('在线计算服务还没有开通。', 'The online calculation service is not set up yet.');
    if (!health) return L('正在查询站长电脑的状态…', 'Checking the site owner’s computer…');
    if (!health.online) return L('站长的 GPU 现在离线，请稍后再来。', 'The site owner’s GPU is offline right now; try again later.');
    if (!model()) return L('DBCata 通道还没有开放：站长确认模型权重的许可并测试之后才开放。', 'The DBCata lane is not open yet: it opens once the site owner has confirmed the licence of the model weights and tested it.');
    if (!model().ready) return L('DBCata 现在没有在站长电脑上运行。', 'DBCata is not running on the site owner’s computer right now.');
    return '';
  }
  function render() {
    const raw = choice(), c = C.check(raw);
    $('db-system').textContent = c.params
      ? `${C.formula(raw.metal_a, raw.metal_b, raw.ratio, true)}(${raw.facet}) · ${C.structure(raw.ratio)} · ${L('12 个原子的三层板', 'three-layer slab of 12 atoms')} · ${C.sub(raw.adsorbate)}`
      : LT(c.error);
    $('db-system').dataset.bad = String(!c.params);
    $('db-ref').textContent = C.refsAvailable(raw.adsorbate)
      ? L(`吸附能按 OC20 的气相参考：${raw.adsorbate.match(/[A-Z][a-z]?\d*/g).join(' + ')}。`, `Adsorption energy with OC20’s gas references: ${raw.adsorbate.match(/[A-Z][a-z]?\d*/g).join(' + ')}.`)
      : L('OC20 没有 S 的气相参考，只给 E(吸附结构) − E(表面)；UMA 的 OC20 数据里也没有含 S 的吸附物。', 'OC20 has no gas reference for S, so only E(adslab) − E(slab) is given; UMA’s OC20 data have no S-containing adsorbates either.');
    const run = $('db-run'), n = c.params ? C.cost(c.params) : C.cost(raw);
    run.textContent = L(`运行 · 消耗 ${n} 次`, `Run · ${n} uses`);
    const w = why(c);
    $('db-why').textContent = busy ? '' : w;
    run.disabled = busy || !!w;
    keep({ a: raw.metal_a, b: raw.metal_b, x: raw.ratio, facet: raw.facet, ads: raw.adsorbate, polish: raw.polish, steps: raw.steps, lattice: raw.lattice });
  }
  panel.addEventListener('change', render);

  // ── running ────────────────────────────────────────────────────────────────────────────────────────────────────
  async function call(path, opts = {}) {
    const t = token();
    const res = await fetch(api() + path, { ...opts, headers: { 'Content-Type': 'application/json', ...(t ? { Authorization: `Bearer ${t}` } : {}) } });
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(data.error?.message || data.error || `HTTP ${res.status}`);
    return data;
  }
  const NOTES = { 'bulk lattice': L('弛豫体相晶格', 'relaxing the bulk lattice'), DBCata: L('DBCata 生成吸附结构', 'DBCata generating the structures'), done: L('整理结果', 'collecting the results') };
  function note(p) {
    if (!p) return '';
    const m = /^(clean slab|UMA) (\d+)\/(\d+)$/.exec(p.note || '');
    if (m) return m[1] === 'UMA' ? L(`UMA 算能量：第 ${m[2]} / ${m[3]} 个位点`, `UMA energies: site ${m[2]} of ${m[3]}`) : L(`弛豫干净表面 ${m[2]} / ${m[3]}`, `relaxing clean slab ${m[2]} of ${m[3]}`);
    return NOTES[p.note] || String(p.note || '');
  }
  const say = (html) => { $('db-progress').innerHTML = html; };
  const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
  async function run() {
    const c = C.check(choice());
    if (!c.params || busy) return;
    busy = true; render();
    $('db-result').innerHTML = '';
    $('db-view').hidden = true;
    say(esc(L('正在提交…', 'Submitting…')));
    try {
      let r = await call('/uma/jobs', { method: 'POST', body: JSON.stringify(C.body(c.params)) });
      const t0 = Date.now();
      while (r.status === 'queued' || r.status === 'running') {
        const secs = Math.round((Date.now() - t0) / 1000);
        say(r.status === 'queued'
          ? esc(L(`排队中，前面还有 ${r.position || 0} 个任务（${secs} 秒）`, `Queued, ${r.position || 0} ahead (${secs} s)`))
          : esc(`${L('计算中', 'Running')}${r.progress ? ` · ${note(r.progress)}` : ''} (${secs} ${L('秒', 's')})`));
        await sleep(1500);
        r = await call(`/uma/jobs/${r.id}`);
      }
      if (r.status === 'error') throw new Error(r.error || L('计算失败', 'The calculation failed'));
      last = r.result;
      show(last, r.cached);
    } catch (e) {
      $('db-result').innerHTML = `<div class="md-err">${esc(e.message)}</div>`;
    } finally {
      busy = false; say(''); render();
    }
  }
  $('db-run').addEventListener('click', run);

  // ── the result ─────────────────────────────────────────────────────────────────────────────────────────────────
  const flagChips = (flags) => (flags.length ? flags.map((x) => `<span class="md-db-flag" title="${esc(LT(C.FLAGS[x]))}">${esc(LT(C.FLAG_SHORT[x]) || x)}</span>`).join(' ') : `<span class="md-db-ok">${esc(L('无', 'none'))}</span>`);
  function show(r, cached) {
    const rows = C.rows(r), sys = r.system || {}, lat = r.lattice || {}, ref = r.reference || {}, eng = r.engine || {};
    const best = rows.find((x) => x.best);
    const eName = ref.available ? 'E_ads' : 'E − E_slab';
    const site = (x) => `${LT(C.KINDS[x.kind]) || esc(x.kind)} · ${esc(x.atoms)}`;
    const warn = [];
    if (r.fake) warn.push(L('这是测试用的假数字（站长电脑的假模式），不是 DBCata 的结果。', 'These are made-up test numbers (the computer’s fake mode), not DBCata results.'));
    if (!r.best_ok) warn.push(L('每个位点都有异常标记或分类器信心不足：最低能量的位点也不可靠，请看表里的标记。', 'Every site has a flag or low classifier confidence: even the lowest one is not reliable; see the flags in the table.'));
    if (lat.note) warn.push(/moved more than/.test(lat.note) ? L('UMA 弛豫出的晶胞离 Vegard 估计超过 8 %，不可信，改用了 Vegard 的估计。', `Lattice: ${lat.note}.`)
      : /failed/.test(lat.note) ? L('体相的 UMA 弛豫失败，改用了 Vegard 的估计。', `Lattice: ${lat.note}.`) : lat.note);
    if (ref.available === false) warn.push(L('OC20 没有 S 的气相参考：这里的能量是 E(吸附结构) − E(表面)，只用来比较位点，不是吸附能。', 'OC20 has no gas reference for S: the energies here are E(adslab) − E(slab), for ranking the sites only, not adsorption energies.'));
    if (r.truncated) warn.push(L('位点太多，只算了前 32 个。', 'Too many sites: only the first 32 were computed.'));
    $('db-result').innerHTML = `<div class="md-res md-db-res">
      <h3>${C.formula(sys.metal_a, sys.metal_b, sys.ratio, true)}(${esc(sys.facet)}) + ${C.sub(esc(sys.adsorbate))}${cached ? ` <span class="chip">${esc(L('缓存的结果', 'cached result'))}</span>` : ''}</h3>
      ${warn.map((w) => `<p class="md-warn">${esc(w)}</p>`).join('')}
      ${best ? `<p class="md-db-best"><b>${esc(L('能量最低的位点', 'Lowest-energy site'))}</b> ${site(best)} · ${esc(L('表面', 'top layer'))} ${C.sub(esc(best.top))} · ${eName} = <b>${f(best.energy, 3)} eV</b> · DMAE ${f(best.dmae, 3)} Å</p>` : ''}
      <p class="muted small">${esc(C.structure(sys.ratio))} · a = ${f(lat.a, 3)} Å${lat.c ? ` · c = ${f(lat.c, 3)} Å` : ''} (${esc(lat.method === 'uma-omat' ? L('UMA omat 弛豫', 'UMA omat relaxation') : L('Vegard 定律', 'Vegard’s law'))}, Vegard ${f(lat.a_vegard, 3)} Å) · ${esc(L(`${(r.slabs || []).length} 种表面终止 · ${rows.length} 个位点`, `${(r.slabs || []).length} termination(s) · ${rows.length} sites`))} · ${esc([eng.checkpoint, eng.uma && `UMA ${eng.uma} (${eng.task})`, eng.gpu || (eng.device !== 'none' && eng.device)].filter(Boolean).join(' · '))}</p>
      <div class="md-table"><table class="md-db-table">
        <thead><tr><th>#</th><th>${esc(L('位点', 'Site'))}</th><th>${esc(L('表面', 'Top layer'))}</th><th>${esc(L('等价数', 'Mult.'))}</th><th>${esc(eName)} (eV)</th><th>ΔE (eV)</th><th>DMAE (Å)</th>${r.sites?.some((s) => s.dmae_gen_final != null) ? `<th>${esc(L('优化位移', 'Relax DMAE'))} (Å)</th>` : ''}<th>${esc(L('信心', 'Conf.'))}</th><th>${esc(L('异常', 'Flags'))}</th><th></th></tr></thead>
        <tbody>${rows.map((x) => `<tr data-site="${x.id}"${x.best ? ' class="md-db-top"' : ''}${x.ok ? '' : ' data-bad="true"'}><td class="n">${x.id}</td><td>${site(x)}</td><td>${C.sub(esc(x.top))}</td><td class="n">${x.multiplicity}</td><td class="n">${f(x.energy, 3)}</td><td class="n">${f(x.rel, 3)}</td><td class="n">${f(x.dmae, 3)}</td>${r.sites?.some((s) => s.dmae_gen_final != null) ? `<td class="n">${f(x.dmaeFinal, 3)}</td>` : ''}<td class="n">${x.confidence == null ? '—' : f(x.confidence, 2)}</td><td>${flagChips(x.flags)}</td><td><button type="button" class="text-button" data-view="${x.id}">3D</button></td></tr>`).join('')}</tbody>
      </table></div>
      <p class="muted small">${esc(L('ΔE 相对能量最低的可靠位点；DMAE 是 DBCata 结构和初始结构的差别，优化位移是 UMA 短程优化又挪了多少（大说明 DBCata 的结构离 UMA 的极小点远）。信心来自 DBCata 的异常分类器（站长电脑上没有它的权重时为 —）。', 'ΔE is relative to the lowest reliable site; DMAE is how far DBCata moved the start, relax DMAE how much the short UMA relaxation moved it again (large: DBCata’s structure is far from UMA’s minimum). Confidence comes from DBCata’s anomaly classifier (— when its weights are not on the computer).'))}</p>
    </div>`;
    $('db-view').hidden = !rows.length;
    view(best ? best.id : rows[0]?.id);
  }
  let viewing = null;
  function view(id) {
    const s = last?.sites?.find((x) => x.id === id);
    if (!s) return;
    viewing = s;
    const fr = C.frames(s.xyz);
    $('db-view-title').textContent = `#${s.id} ${LT(C.KINDS[s.kind]) || s.kind} · ${s.atoms}`;
    $('db-view-frames').textContent = fr.map((x, i) => `${L('帧', 'frame')} ${i + 1}: ${LT(C.FRAME_NAMES[x.label]) || x.label}`).join(' · ');
    for (const tr of $('db-result').querySelectorAll('tr[data-site]')) tr.toggleAttribute('data-shown', Number(tr.dataset.site) === id);
    const box = $('db-3d');
    if (window.MolAstriaMol3D) window.MolAstriaMol3D.mount(box, { xyz: s.xyz, name: `dbcata-site-${s.id}`, label: $('db-view-title').textContent, style: 'ballstick' }).catch(() => {});
    else box.textContent = L('3D 查看器没有载入；可以下载结构文件。', 'The 3D viewer did not load; download the structure instead.');
  }
  function save(name, text, type) {
    const a = document.createElement('a');
    a.href = URL.createObjectURL(new Blob([text], { type }));
    a.download = name;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 1000);
  }
  panel.addEventListener('click', (e) => {
    const v = e.target.closest('#db-result [data-view]');
    if (v) { view(Number(v.dataset.view)); $('db-view').scrollIntoView({ block: 'nearest', behavior: 'smooth' }); return; }
    const s = e.target.closest('#db-view [data-save]');
    if (!s || !last) return;
    const base = `${last.system?.formula || 'alloy'}-${last.system?.facet || ''}-${last.system?.adsorbate || ''}`;
    if (s.dataset.save === 'xyz' && viewing) save(`${base}-site${viewing.id}.extxyz`, viewing.xyz, 'chemical/x-xyz');
    if (s.dataset.save === 'csv') save(`${base}.csv`, C.csv(last), 'text/csv');
    if (s.dataset.save === 'json') save(`${base}.json`, JSON.stringify(last, null, 1), 'application/json');
  });

  // ── what models.js calls ───────────────────────────────────────────────────────────────────────────────────────
  window.MolAstriaDbcata = {
    name: 'DBCata',
    /** Every sync of the page: whether this window is the one shown, and the latest health answer. */
    activate(on, h) {
      health = h;
      tab.hidden = !(h?.models?.dbcata || on || location.hash === '#dbcata');
      panel.hidden = !on;
      if (on !== active || on) { active = on; render(); }
    },
    card() {
      return `<article class="md-model" translate="no"><h3>DBCata + UMA-OC20</h3><p><span class="tag">${esc(L('免费 · 开源（GPL-3.0，独立运行）', 'free · open source (GPL-3.0, run separately)'))}</span><code>dbcata</code></p><p>${esc(L(
        '上海交通大学 Huo 和 Cao 的周期性布朗桥扩散模型（PaiNN 等变网络），把未弛豫的吸附结构直接映射到接近 DFT 弛豫的结构，在 Catalysis-Hub 上 DMAE 0.035 Å；能量由 Meta 的 UMA-S 1.1（OC20 任务，RPBE 水平）给出。',
        'A periodic Brownian-bridge diffusion model with a PaiNN equivariant network by Huo and Cao (Shanghai Jiao Tong University) that maps an unrelaxed adsorption structure straight to a near-DFT-relaxed one, DMAE 0.035 Å on Catalysis-Hub; the energies come from Meta’s UMA-S 1.1 (OC20 task, RPBE level).'))}</p><p class="muted small">${esc(L('训练数据：Catalysis-Hub（Mamun 等，BEEF-vdW）· 许可：代码 GPL-3.0，权重在 Figshare 标为 GPL', 'Training data: Catalysis-Hub (Mamun et al., BEEF-vdW) · licence: code GPL-3.0, weights marked GPL on Figshare'))}</p></article>`;
    },
  };
  render();
})();
