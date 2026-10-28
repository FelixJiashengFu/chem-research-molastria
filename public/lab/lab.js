/* AI 实验室界面：提出 → 过滤 → 计算结果 → 可靠性 → 前沿与 DFT 预算 → 候选卡片。
   项目状态保存在 localStorage（chemhub-lab-v1），可导出 / 导入 JSON。化学逻辑在 chem.js。 */
(() => {
  'use strict';
  const L = window.ChemLab;
  const $ = (id) => document.getElementById(id);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const safeURL = (v) => { try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) ? u.href : ''; } catch { return ''; } };
  const f2 = (v) => (v === null || v === undefined || v === '' || Number.isNaN(Number(v)) ? '—' : Number(v).toFixed(2));
  const STORE = 'chemhub-lab-v1';
  const DEFAULT_CFG = {
    extraElements: [], maxHeavy: 20, maxComplexity: 6,
    priorIP: 0.44, priorEA: 0.439, priorRP: 0.261, disagreeIP: 0.3, disagreeEA: 0.3, disagreeLi: 0.15, simMin: 0.3, tieWithPrior: true,
    liWindow: null, liMargin: 0.1,
    credits: { t1: 5, t2: 10, t3: 20 }, creditUSD: 0.04, roundBudget: 60, maxDFT: 3,
    plan: { rounds: 10, perRound: 10, t2Total: 40, t3Total: 25, margin: 500 },
    sceToLi: 3.28, redoxMode: 'RAPID', umaModel: 'uma_s_1_2_omol'
  };
  const FOCUS = {
    balance: '同时兼顾抗氧化、抗还原与适中的 Li⁺ 结合能',
    oxidation: '优先提高抗氧化性（更高的 IP / 氧化电位），面向高电压正极',
    reduction: '优先提高抗还原性（更低的 EA / 更负的还原电位），面向负极稳定',
    solvation: '优先让 Li⁺ 结合能落在参考溶剂范围的中段',
    additive: '设计易被还原、能在负极形成稳定 SEI 的添加剂（与溶剂目标相反：EA 较高）'
  };

  // ── state ───────────────────────────────────────────────────────────────
  const blank = () => ({ version: 1, cfg: structuredClone(DEFAULT_CFG), molecules: {}, rounds: [], demo: false, created: new Date().toISOString() });
  function normalize(p) {
    p.cfg = { ...structuredClone(DEFAULT_CFG), ...(p.cfg || {}) };
    p.cfg.credits = { ...DEFAULT_CFG.credits, ...(p.cfg.credits || {}) };
    p.cfg.plan = { ...DEFAULT_CFG.plan, ...(p.cfg.plan || {}) };
    p.molecules = p.molecules || {};
    p.rounds = p.rounds || [];
    return p;
  }
  function load() {
    try { const p = JSON.parse(localStorage.getItem(STORE) || 'null'); if (p?.version === 1) return normalize(p); } catch {}
    return blank();
  }
  let project = load();
  let storageWarned = false;
  function save() {
    try { localStorage.setItem(STORE, JSON.stringify(project)); } catch { if (!storageWarned) { storageWarned = true; toast('浏览器存储不可用或已满：请定期「导出项目」'); } }
  }
  const all = () => Object.values(project.molecules).sort((a, b) => a.round - b.round || a.order - b.order);
  const active = () => all().filter((m) => m.filter?.pass);
  const withData = () => active().filter((m) => L.objectives(m));
  function cfg() {
    const c = project.cfg;
    let win = c.liWindow;
    if (!win) { const w = L.seedLiWindow(active()); win = w ? [w[0] - c.liMargin, w[1] + c.liMargin] : null; }
    return { ...c, liWindow: win };
  }
  const rel = (m) => L.reliability(m, cfg());
  function ensureSeeds() {
    L.SEEDS.forEach((s, i) => {
      const key = `seed-${s.id}`;
      if (!project.molecules[key]) project.molecules[key] = { key, smiles: s.smiles, label: s.id, name: s.name, en: s.en, round: 0, order: i, origin: 'seed', rationale: `${s.name}（${s.en}）· 参考溶剂`, props: {} };
    });
  }
  ensureSeeds();

  // ── RDKit ───────────────────────────────────────────────────────────────
  let R = null, rdkitError = '', seedFps = [];
  const svgCache = new Map();
  const ready = L.loadRDKit().then((mod) => {
    R = mod;
    seedFps = L.SEEDS.map((s) => ({ id: s.id, fp: L.fingerprint(R, s.smiles) }));
    refilterAll(false);
    renderAll();
    return mod;
  }).catch((e) => { rdkitError = e.message; renderStatus(); renderFilter(); throw e; });
  function molSVG(smiles, w = 220, h = 150) {
    if (!R) return '';
    const k = `${w}x${h}:${smiles}`;
    if (!svgCache.has(k)) svgCache.set(k, (L.svg(R, smiles, w, h) || '').replace(/<\?xml[^>]*>/, '').replace(/<svg /, '<svg class="molsvg" aria-hidden="true" '));
    return svgCache.get(k);
  }

  /** Re-run the gate over every molecule in creation order, so the earliest copy of a duplicate wins. */
  function refilterAll(persist = true) {
    if (!R) return;
    const known = new Map();
    const c = cfg();
    for (const m of all()) {
      m.filter = L.filterMolecule(R, m.smiles, c, m.origin === 'seed' ? new Map() : known, seedFps);
      if (m.filter.info) m.canonical = m.filter.info.canonical;
      if (m.filter.pass) known.set(m.filter.id, m.label);
    }
    if (persist) save();
  }
  function filterNew(list) {
    const known = new Map(active().map((m) => [m.filter.id, m.label]));
    const c = cfg();
    for (const m of list) {
      m.filter = L.filterMolecule(R, m.smiles, c, known, seedFps);
      if (m.filter.info) m.canonical = m.filter.info.canonical;
      if (m.filter.pass) known.set(m.filter.id, m.label);
    }
  }

  // ── small UI helpers ────────────────────────────────────────────────────
  let toastTimer;
  function toast(text) { const t = $('toast'); t.textContent = text; t.classList.add('show'); clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove('show'), 3000); }
  function download(name, text, type = 'text/plain') {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  }
  async function copy(text, what) {
    try { await navigator.clipboard.writeText(text); toast(`已复制${what}`); } catch { download('copy.txt', text); }
  }
  const LEVEL = { trusted: ['可信', 'ok'], doubtful: ['存疑', 'warn'], untrusted: ['不可信', 'bad'], pending: ['待计算', ''] };
  const levelTag = (r) => `<span class="tag ${LEVEL[r.level][1]}">${LEVEL[r.level][0]}${r.level !== 'pending' ? ` · ${r.doubt.toFixed(2)}` : ''}</span>`;
  const originTag = (m) => m.origin === 'seed' ? '<span class="tag gold">种子</span>' : m.origin === 'ai' ? `<span class="tag">AI · 第 ${m.round} 轮</span>` : m.origin === 'demo' ? `<span class="tag demo">演示 · 第 ${m.round} 轮</span>` : `<span class="tag">${m.origin === 'import' ? '导入' : '手动'} · 第 ${m.round} 轮</span>`;
  const toLi = (v) => (v === null || v === undefined || v === '' ? null : Number(v) + Number(project.cfg.sceToLi));

  // ── tabs ────────────────────────────────────────────────────────────────
  let tab = 'propose';
  try { tab = sessionStorage.getItem('chemhub-lab-tab') || 'propose'; } catch {}
  function showTab(id, focus = false) {
    tab = id;
    try { sessionStorage.setItem('chemhub-lab-tab', id); } catch {}
    document.querySelectorAll('.steps [data-tab]').forEach((b) => b.setAttribute('aria-selected', String(b.dataset.tab === id)));
    document.querySelectorAll('.tab').forEach((p) => { p.hidden = p.id !== `tab-${id}`; });
    renderTab(id);
    if (focus) $('workbench').scrollIntoView({ behavior: 'smooth', block: 'start' });
  }
  document.querySelector('.steps').addEventListener('click', (e) => { const b = e.target.closest('[data-tab]'); if (b) showTab(b.dataset.tab); });
  document.querySelector('.steps').addEventListener('keydown', (e) => {
    if (!['ArrowLeft', 'ArrowRight'].includes(e.key)) return;
    const tabs = [...document.querySelectorAll('.steps [data-tab]')];
    const i = tabs.findIndex((b) => b.dataset.tab === tab);
    const next = tabs[(i + (e.key === 'ArrowRight' ? 1 : tabs.length - 1)) % tabs.length];
    showTab(next.dataset.tab); next.focus();
  });
  document.querySelectorAll('.loop-node').forEach((n) => n.addEventListener('click', () => showTab(n.dataset.step === 'memory' ? 'propose' : n.dataset.step, true)));

  function renderTab(id) {
    ({ propose: renderPropose, filter: renderFilter, results: renderResults, reliability: renderReliability, pareto: renderPareto, cards: renderCards })[id]?.();
  }
  function renderAll() { renderStatus(); renderTab(tab); }

  function renderStatus() {
    const a = active(), d = withData();
    const verified = a.filter((m) => L.verdict(m, cfg())).length;
    const ai = window.ChemAI;
    const s = ai?.settings?.();
    const aiOk = ai?.isReady?.();
    $('bench-status').innerHTML = [
      `<span class="pill" data-ok="${R ? 'true' : rdkitError ? 'false' : ''}"><i></i>RDKit ${R ? `<b>${esc(R.version?.() || L.RDKIT_VERSION)}</b>` : rdkitError ? '载入失败' : '载入中…'}</span>`,
      `<span class="pill" data-ok="${aiOk ? 'true' : 'false'}"><i></i>AI ${aiOk ? `<b>${esc(ai.providers[s.provider]?.label)} · ${esc(s.models[s.provider] || '')}</b>` : '未配置'}</span>`,
      `<span class="pill">已完成 <b>${project.rounds.length}</b> 轮</span>`,
      `<span class="pill">通过过滤 <b>${a.length}</b> / ${all().length}</span>`,
      `<span class="pill">有 Tier 1 <b>${d.length}</b></span>`,
      `<span class="pill">DFT 验证 <b>${verified}</b></span>`
    ].join('');
    $('demo-banner').hidden = !project.demo;
  }

  // ── ① propose ───────────────────────────────────────────────────────────
  function renderAILine() {
    const ai = window.ChemAI;
    if (!ai) { $('ai-line').innerHTML = '<span class="err">AI 模块未载入。</span>'; return; }
    const s = ai.settings();
    $('ai-line').innerHTML = ai.isReady()
      ? `<span>使用</span><b>${esc(ai.providers[s.provider].label)} · ${esc(s.models[s.provider] || '')}</b><span class="muted">思考强度 ${esc(s.effort[s.provider])}</span><button type="button" class="text-button" data-ai-settings>更换</button>`
      : `<span>还没有配置 AI。支持 DeepSeek、Meta Muse（推荐 Muse Wonder 1.0 作为化学家）或任意 OpenAI 兼容接口。</span><button type="button" class="button small primary" data-ai-settings>配置 API key</button>`;
  }
  document.addEventListener('click', (e) => { if (e.target.closest('[data-ai-settings]')) window.ChemAI?.openSettings(); });
  document.addEventListener('chemhub:ai-config', () => { renderAILine(); renderStatus(); });

  function renderPropose() {
    renderAILine();
    const rounds = project.rounds.slice().reverse();
    $('round-list').innerHTML = rounds.length ? rounds.map((r) => {
      const cost = r.cost != null ? ` · $${r.cost.toFixed(3)}` : '';
      return `<div><b>R${r.n}</b><span>${esc(r.label)} · 通过 ${r.passed}/${r.total}${cost}</span><small>${esc(new Date(r.at).toLocaleString('zh-CN', { month: 'numeric', day: 'numeric', hour: '2-digit', minute: '2-digit' }))}</small></div>`;
    }).join('') : '<p class="muted small">还没有轮次。第 0 轮是 9 个种子溶剂。</p>';
  }

  function frontSummary(limit = 8) {
    const c = cfg();
    return L.paretoFront(withData(), c).slice(0, limit).map((m) => {
      const o = L.objectives(m), r = rel(m);
      return `- ${m.canonical || m.smiles} | IP ${f2(o.ip)} | EA ${f2(o.ea)} | Li⁺ ${f2(o.li)} | ${LEVEL[r.level][0]}`;
    });
  }
  function buildPrompt(n, round) {
    const c = cfg();
    const extraEl = c.extraElements.length ? `、${c.extraElements.join('、')}` : '';
    const system = `你是一位电解液分子设计化学家（代号 Wonder），在一个闭环发现系统里工作：你提出分子 → RDKit 过滤 → UMA 机器学习势计算 → 可靠性层挑选可疑者做 DFT 验证 → 结果反馈给你。
目标：为锂电池找到新的溶剂分子，同时具备强抗氧化性（高绝热电离能 IP）、强抗还原性（低绝热电子亲和能 EA）、与 Li⁺ 的结合能落在常用溶剂的范围内。
硬约束：只含 C、H、O、F${extraEl}；不超过 ${c.maxHeavy} 个重原子；中性闭壳层的单个分子；不含过氧、叠氮、重氮、酰卤、环氧等不稳定或危险基团；结构简单、可合成；不要重复已评估过的分子，也不要只换写法。
每个分子给出一句化学上的设计理由（为什么会改善目标性质）。
只输出一个 JSON 对象，不要任何额外文字：{"candidates":[{"smiles":"…","name":"中文或英文名","rationale":"不超过 40 字的设计理由","target":"oxidation|reduction|solvation|balance"}]}`;
    const seen = active().map((m) => m.canonical || m.smiles);
    const last = project.rounds[project.rounds.length - 1];
    const rejected = last ? all().filter((m) => m.round === last.n && m.filter && !m.filter.pass).map((m) => `- ${m.smiles}：${m.filter.reasons.join('；')}`) : [];
    const overturned = active().map((m) => ({ m, v: L.verdict(m, c) })).filter((x) => x.v && !x.v.confirmed)
      .map(({ m, v }) => `- ${m.canonical || m.smiles}：${v.checks.filter((k) => !k.ok).map((k) => `${k.label} UMA ${f2(k.uma)} → DFT ${f2(k.dft)} eV`).join('，')}`);
    const confirmed = active().map((m) => ({ m, v: L.verdict(m, c) })).filter((x) => x.v && x.v.confirmed).map(({ m }) => `- ${m.canonical || m.smiles}`);
    const doubtful = withData().filter((m) => rel(m).level !== 'trusted').slice(0, 8).map((m) => `- ${m.canonical || m.smiles}：${rel(m).reasons[0]}`);
    const front = frontSummary();
    const user = [
      `第 ${round} 轮。请正好提出 ${n} 个新的候选分子。`,
      `本轮侧重：${FOCUS[$('focus').value] || FOCUS.balance}。`,
      `\n【参考集 / 种子溶剂】\n${L.SEEDS.map((s) => `- ${s.id}（${s.en}）${s.smiles}`).join('\n')}`,
      front.length ? `\n【当前 Pareto 前沿（UMA-S，eV；IP 越高越好，EA 越低越好）】\n${front.join('\n')}` : '\n【当前 Pareto 前沿】还没有 Tier 1 结果，先在种子溶剂周围做合理的结构修饰。',
      c.liWindow ? `\nLi⁺ 结合能的目标区间：${f2(c.liWindow[0])} 到 ${f2(c.liWindow[1])} eV。` : '',
      overturned.length ? `\n【被 DFT 推翻的判断：UMA 在这些化学空间不可靠，避开或换方向】\n${overturned.join('\n')}` : '',
      confirmed.length ? `\n【已被 DFT 确认的结果】\n${confirmed.join('\n')}` : '',
      doubtful.length ? `\n【可靠性层标记为存疑的分子】\n${doubtful.join('\n')}` : '',
      rejected.length ? `\n【上一轮被过滤掉的分子与原因，不要再犯】\n${rejected.join('\n')}` : '',
      seen.length ? `\n【已评估过的分子（不要重复）】\n${seen.join(', ')}` : '',
      $('extra').value.trim() ? `\n【额外要求】\n${$('extra').value.trim()}` : ''
    ].filter(Boolean).join('\n');
    return [{ role: 'system', content: system }, { role: 'user', content: user }];
  }
  const nextRound = () => (project.rounds.length ? Math.max(...project.rounds.map((r) => r.n)) : 0) + 1;

  let proposing = null;
  $('show-prompt').addEventListener('click', () => {
    const pre = $('prompt-preview');
    if (!pre.hidden) { pre.hidden = true; return; }
    const msgs = buildPrompt(Number($('n-propose').value), nextRound());
    pre.textContent = msgs.map((m) => `【${m.role}】\n${m.content}`).join('\n\n');
    pre.hidden = false;
  });
  $('propose-stop').addEventListener('click', () => proposing?.abort());
  $('propose-btn').addEventListener('click', async () => {
    const ai = window.ChemAI;
    if (!ai) { toast('AI 模块未载入'); return; }
    if (!ai.isReady()) { ai.openSettings(); return; }
    const n = Number($('n-propose').value);
    const round = nextRound();
    const out = $('propose-out');
    out.innerHTML = `<details open><summary>思考过程</summary><div data-think>…</div></details><div class="live" data-live>等待模型回复…</div>`;
    const think = out.querySelector('[data-think]'), live = out.querySelector('[data-live]');
    proposing = new AbortController();
    $('propose-btn').disabled = true; $('propose-stop').hidden = false;
    try {
      await ready.catch(() => { throw new Error('RDKit 未能载入，无法过滤候选；请检查网络后刷新'); });
      const r = await ai.chat({
        messages: buildPrompt(n, round), json: true, maxTokens: 12000, signal: proposing.signal,
        onReasoning: (_, full) => { think.textContent = full.slice(-4000); },
        onDelta: (_, full) => { live.textContent = full; live.scrollTop = live.scrollHeight; }
      });
      if (!r.reasoning) out.querySelector('details').remove();
      const data = ai.parseJSON(r.text);
      const list = (Array.isArray(data) ? data : data.candidates || data.molecules || []).filter((x) => x && typeof x.smiles === 'string');
      if (!list.length) throw new Error('模型没有给出可用的 SMILES');
      const meta = { origin: 'ai', label: `${ai.providers[r.provider]?.label || r.provider} · ${r.model}`, usage: r.usage, cost: r.cost };
      const res = addRound(list.slice(0, n + 5), meta);
      live.insertAdjacentHTML('afterend', `<p class="ok">第 ${res.n} 轮：收到 ${res.total} 个，通过过滤 ${res.passed} 个${r.cost != null ? `，本次约 $${r.cost.toFixed(3)}` : ''}${r.usage ? `（${r.usage.prompt_tokens} / ${r.usage.completion_tokens} token）` : ''}。</p><button type="button" class="button small" data-goto="filter">查看过滤结果 →</button>`);
    } catch (err) {
      out.insertAdjacentHTML('beforeend', `<p class="err">${esc(err.name === 'AbortError' ? '已停止。' : err.message)}</p>`);
      if (err.code === 'no-key') ai.openSettings();
    } finally {
      proposing = null;
      $('propose-btn').disabled = false; $('propose-stop').hidden = true;
    }
  });
  document.addEventListener('click', (e) => { const g = e.target.closest('[data-goto]'); if (g) showTab(g.dataset.goto, true); });

  function addRound(cands, meta) {
    const n = nextRound();
    const list = cands.map((c, i) => ({
      key: `r${n}-${i + 1}`, smiles: String(c.smiles).trim(), label: c.name ? String(c.name).slice(0, 40) : `R${n}-${i + 1}`,
      round: n, order: i, origin: meta.origin, rationale: String(c.rationale || '').slice(0, 200), target: c.target || '', props: {}
    }));
    filterNew(list);
    for (const m of list) project.molecules[m.key] = m;
    const passed = list.filter((m) => m.filter?.pass).length;
    project.rounds.push({ n, at: new Date().toISOString(), origin: meta.origin, label: meta.label, total: list.length, passed, usage: meta.usage || null, cost: meta.cost ?? null });
    save(); renderAll();
    return { n, total: list.length, passed };
  }
  $('manual-add').addEventListener('click', async () => {
    const lines = $('manual-smiles').value.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
    if (!lines.length) return;
    try { await ready; } catch { toast('RDKit 未能载入，无法过滤'); return; }
    const cands = lines.map((l) => { const [smiles, ...why] = l.split(/\s+/); return { smiles, rationale: why.join(' ') }; });
    const r = addRound(cands, { origin: 'manual', label: '手动添加' });
    $('manual-smiles').value = '';
    toast(`第 ${r.n} 轮：${r.total} 个分子，通过 ${r.passed} 个`);
  });

  // ── ② filter ────────────────────────────────────────────────────────────
  let filterView = 'all';
  function syncFilterInputs() {
    const c = project.cfg;
    document.querySelectorAll('[data-el]').forEach((cb) => { cb.checked = c.extraElements.includes(cb.dataset.el); });
    $('max-heavy').value = c.maxHeavy;
    $('max-cx').value = c.maxComplexity;
  }
  function renderFilter() {
    syncFilterInputs();
    const rows = all().filter((m) => filterView === 'all' || (filterView === 'pass' && m.filter?.pass && m.origin !== 'seed') || (filterView === 'fail' && m.filter && !m.filter.pass) || (filterView === 'seed' && m.origin === 'seed'));
    const head = '<thead><tr><th>结构</th><th>名称 / 来源</th><th>SMILES（规范化）</th><th>分子式</th><th class="num">重原子</th><th class="num">复杂度</th><th>最近种子</th><th>结果</th></tr></thead>';
    if (!R) { $('filter-table').innerHTML = `${head}<tbody><tr><td colspan="8" class="muted">${rdkitError ? esc(rdkitError) : 'RDKit 载入中…'}</td></tr></tbody>`; return; }
    $('filter-table').innerHTML = head + '<tbody>' + (rows.map((m) => {
      const f = m.filter || {};
      const res = f.pass ? '<span class="tag ok">通过</span>' : `<span class="tag bad">未通过</span><ul class="reasons">${(f.reasons || []).map((r) => `<li>${esc(r)}</li>`).join('')}</ul>`;
      return `<tr><td class="mol">${f.info ? molSVG(f.info.canonical, 184, 128) : ''}</td><td><b>${esc(m.label)}</b><br>${originTag(m)}${m.rationale && m.origin !== 'seed' ? `<div class="muted small">${esc(m.rationale)}</div>` : ''}</td><td class="smi">${esc(f.info?.canonical || m.smiles)}</td><td>${esc(f.info?.formula || '—')}</td><td class="num">${f.info?.heavy ?? '—'}</td><td class="num">${f.complexity ?? '—'}</td><td>${f.nearest ? `${esc(f.nearest)} · ${f.sim.toFixed(2)}` : '—'}</td><td>${res}</td></tr>`;
    }).join('') || '<tr><td colspan="8" class="muted">没有符合的分子。</td></tr>') + '</tbody>';
  }
  $('filter-view').addEventListener('click', (e) => {
    const b = e.target.closest('[data-v]'); if (!b) return;
    filterView = b.dataset.v;
    $('filter-view').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderFilter();
  });
  $('refilter').addEventListener('click', () => {
    const c = project.cfg;
    c.extraElements = [...document.querySelectorAll('[data-el]:checked')].map((cb) => cb.dataset.el);
    c.maxHeavy = Math.max(4, Number($('max-heavy').value) || 20);
    c.maxComplexity = Math.max(1, Number($('max-cx').value) || 6);
    refilterAll(); renderAll(); toast('已按新条件重新过滤全部分子');
  });
  $('copy-passed').addEventListener('click', () => copy(active().filter((m) => m.origin !== 'seed').map((m) => m.canonical || m.smiles).join('\n'), '通过过滤的 SMILES'));

  // ── ③ results ───────────────────────────────────────────────────────────
  let tier = 't1';
  function scriptTargets() {
    const c = cfg();
    if (tier === 't1') return active().filter((m) => !L.objectives(m));
    if (tier === 't2') {
      const pending = withData().filter((m) => m.props.e_ox == null && m.props.e_red == null);
      const front = new Set(L.paretoFront(pending, c).map((m) => m.key));
      return pending.sort((a, b) => Number(front.has(b.key)) - Number(front.has(a.key)) || L.objectives(b).ip - L.objectives(a).ip).slice(0, 5);
    }
    return L.pickForDFT(withData(), c, rel).picks.map((p) => p.m);
  }
  function renderScript() {
    const list = scriptTargets().map((m) => ({ ...m, label: m.label }));
    const note = { t1: `${list.length} 个分子还没有 Tier 1 结果`, t2: `前沿优先的 ${list.length} 个分子（每轮 3–5 个）`, t3: `可靠性层挑出的 ${list.length} 个“有希望但可疑”的分子` }[tier];
    $('script-note').textContent = note;
    $('script').textContent = list.length ? L.rowanScript(tier, list, cfg()) : '# 当前没有需要提交的分子。';
  }
  $('tier-pick').addEventListener('click', (e) => {
    const b = e.target.closest('[data-t]'); if (!b) return;
    tier = b.dataset.t;
    $('tier-pick').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    renderScript();
  });
  $('copy-script').addEventListener('click', () => copy($('script').textContent, '脚本'));
  $('download-script').addEventListener('click', () => download(`rowan_${tier}.py`, $('script').textContent, 'text/x-python'));

  function renderResults() {
    renderScript();
    $('sce-li').value = project.cfg.sceToLi;
    const rows = active().filter((m) => Object.keys(m.props || {}).some((k) => k !== 'demo' && m.props[k] !== null && m.props[k] !== ''));
    $('results-table').innerHTML = '<thead><tr><th>结构</th><th>名称</th><th class="num">IP S</th><th class="num">IP M</th><th class="num">EA S</th><th class="num">EA M</th><th class="num">Li⁺ S</th><th class="num">Li⁺ M</th><th class="num">E<sub>ox</sub> vs Li</th><th class="num">E<sub>red</sub> vs Li</th><th class="num">IP DFT</th><th class="num">EA DFT</th><th>备注</th></tr></thead><tbody>'
      + (rows.map((m) => {
        const p = m.props;
        const link = safeURL(p.rowan_url);
        return `<tr><td class="mol">${molSVG(m.canonical || m.smiles, 184, 128)}</td><td><b>${esc(m.label)}</b><br>${originTag(m)}${p.demo ? ' <span class="tag demo">合成值</span>' : ''}</td><td class="num">${f2(p.ip_s)}</td><td class="num">${f2(p.ip_m)}</td><td class="num">${f2(p.ea_s)}</td><td class="num">${f2(p.ea_m)}</td><td class="num">${f2(p.li_s)}</td><td class="num">${f2(p.li_m)}</td><td class="num">${f2(toLi(p.e_ox))}</td><td class="num">${f2(toLi(p.e_red))}</td><td class="num">${f2(p.ip_dft)}</td><td class="num">${f2(p.ea_dft)}</td><td>${p.warn ? `<span class="tag warn">${esc(p.warn)}</span>` : ''}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Rowan ↗</a>` : ''}</td></tr>`;
      }).join('') || '<tr><td colspan="13" class="muted">还没有导入任何计算结果。可以先「载入演示数据」看看完整流程。</td></tr>') + '</tbody>';
  }
  $('sce-li').addEventListener('change', () => { project.cfg.sceToLi = Number($('sce-li').value) || 0; save(); renderResults(); });

  const ALIASES = {
    smiles: ['smiles', 'SMILES', 'canonical_smiles'], inchikey: ['inchikey', 'InChIKey'], name: ['name', 'label'],
    ip_s: ['ip_uma_s', 'ip_s', 'ip_umas', 'IP_UMA_S'], ip_m: ['ip_uma_m', 'ip_m', 'IP_UMA_M'],
    ea_s: ['ea_uma_s', 'ea_s', 'EA_UMA_S'], ea_m: ['ea_uma_m', 'ea_m', 'EA_UMA_M'],
    li_s: ['li_uma_s', 'li_s', 'li_bind_s', 'li_bind_uma_s'], li_m: ['li_uma_m', 'li_m', 'li_bind_m', 'li_bind_uma_m'],
    e_ox: ['e_ox', 'eox', 'oxidation_potential', 'e_ox_sce'], e_red: ['e_red', 'ered', 'reduction_potential', 'e_red_sce'],
    warn: ['rowan_warning', 'warning', 'warn'], ip_dft: ['ip_dft', 'IP_DFT'], ea_dft: ['ea_dft', 'EA_DFT'], rowan_url: ['rowan_url', 'url']
  };
  const NUMERIC = ['ip_s', 'ip_m', 'ea_s', 'ea_m', 'li_s', 'li_m', 'e_ox', 'e_red', 'ip_dft', 'ea_dft'];
  function parseCSV(text) {
    const rows = []; let row = [], cell = '', q = false;
    for (let i = 0; i < text.length; i++) {
      const ch = text[i];
      if (q) { if (ch === '"') { if (text[i + 1] === '"') { cell += '"'; i++; } else q = false; } else cell += ch; continue; }
      if (ch === '"') q = true;
      else if (ch === ',' || ch === '\t') { row.push(cell); cell = ''; }
      else if (ch === '\n' || ch === '\r') { if (ch === '\r' && text[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += ch;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    const clean = rows.filter((r) => r.some((c) => c.trim()));
    if (clean.length < 2) return [];
    const header = clean[0].map((h) => h.trim().replace(/^﻿/, ''));
    return clean.slice(1).map((r) => Object.fromEntries(header.map((h, i) => [h, (r[i] ?? '').trim()])));
  }
  function pick(obj, field) { for (const k of ALIASES[field]) if (obj[k] !== undefined && obj[k] !== '') return obj[k]; return undefined; }
  async function importRows(records) {
    await ready;
    const byId = new Map(all().filter((m) => m.filter?.id).map((m) => [m.filter.id, m]));
    let updated = 0, added = 0, skipped = 0;
    const fresh = [];
    for (const rec of records) {
      const smiles = pick(rec, 'smiles');
      let m = null;
      const key = pick(rec, 'inchikey');
      if (key && byId.has(key)) m = byId.get(key);
      if (!m && smiles) { const d = L.describe(R, smiles); if (d) m = byId.get(d.inchikey || d.canonical) || null; }
      if (!m) {
        if (!smiles || !L.describe(R, smiles)) { skipped++; continue; }
        m = { key: `imp-${Date.now().toString(36)}-${fresh.length}`, smiles, label: pick(rec, 'name') || `导入-${fresh.length + 1}`, round: Math.max(0, ...project.rounds.map((r) => r.n)), order: 1000 + fresh.length, origin: 'import', rationale: '', props: {} };
        fresh.push(m); added++;
      } else updated++;
      for (const f of [...NUMERIC, 'warn', 'rowan_url']) {
        const v = pick(rec, f);
        if (v === undefined) continue;
        m.props[f] = NUMERIC.includes(f) ? (Number.isFinite(Number(v)) ? Number(v) : m.props[f]) : String(v);
      }
      delete m.props.demo;
    }
    if (fresh.length) { filterNew(fresh); for (const m of fresh) { project.molecules[m.key] = m; byId.set(m.filter?.id, m); } }
    save(); renderAll();
    return { updated, added, skipped };
  }
  async function importText(text, name = '') {
    const msg = $('import-msg');
    try {
      let records;
      const t = text.trim();
      if (/\.json$/i.test(name) || t.startsWith('[') || t.startsWith('{')) {
        const j = JSON.parse(t);
        if (j.version === 1 && j.molecules) { replaceProject(j); msg.textContent = '已载入完整项目。'; msg.className = 'msg ok'; return; }
        records = Array.isArray(j) ? j : j.results || j.molecules || [];
      } else records = parseCSV(t);
      if (!records.length) throw new Error('没有读到数据行（CSV 需要表头行）');
      const r = await importRows(records);
      msg.textContent = `更新 ${r.updated} 个分子，新增 ${r.added} 个${r.skipped ? `，跳过 ${r.skipped} 行（SMILES 无法解析）` : ''}。`;
      msg.className = 'msg ok';
    } catch (e) { msg.textContent = `导入失败：${e.message}`; msg.className = 'msg err'; }
  }
  $('import-results').addEventListener('change', async (e) => { const f = e.target.files[0]; if (f) await importText(await f.text(), f.name); e.target.value = ''; });
  $('apply-paste').addEventListener('click', () => importText($('paste-results').value));
  const drop = $('drop');
  ['dragenter', 'dragover'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.add('over'); }));
  ['dragleave', 'drop'].forEach((t) => drop.addEventListener(t, (e) => { e.preventDefault(); drop.classList.remove('over'); }));
  drop.addEventListener('drop', async (e) => { const f = e.dataTransfer.files[0]; if (f) await importText(await f.text(), f.name); });
  $('template').addEventListener('click', () => {
    const header = 'smiles,name,ip_uma_s,ip_uma_m,ea_uma_s,ea_uma_m,li_uma_s,li_uma_m,e_ox,e_red,rowan_warning,ip_dft,ea_dft,rowan_url';
    const rows = active().map((m) => `"${(m.canonical || m.smiles).replace(/"/g, '""')}","${String(m.label).replace(/"/g, '""')}",,,,,,,,,,,,`);
    download('chemhub-results-template.csv', '﻿' + [header, ...rows].join('\r\n'), 'text/csv');
  });

  // ── ④ reliability ───────────────────────────────────────────────────────
  function syncRelInputs() {
    const c = project.cfg;
    $('prior-ip').value = c.priorIP; $('prior-ea').value = c.priorEA; $('dis-ip').value = c.disagreeIP; $('dis-ea').value = c.disagreeEA; $('dis-li').value = c.disagreeLi; $('sim-min').value = c.simMin; $('tie-prior').checked = c.tieWithPrior;
  }
  [['prior-ip', 'priorIP'], ['prior-ea', 'priorEA'], ['dis-ip', 'disagreeIP'], ['dis-ea', 'disagreeEA'], ['dis-li', 'disagreeLi'], ['sim-min', 'simMin']].forEach(([id, k]) => {
    $(id).addEventListener('change', () => { const v = Number($(id).value); if (Number.isFinite(v) && v >= 0) { project.cfg[k] = v; save(); renderReliability(); renderStatus(); } });
  });
  $('tie-prior').addEventListener('change', () => { project.cfg.tieWithPrior = $('tie-prior').checked; save(); });
  $('calibrate').addEventListener('click', () => {
    const cal = L.calibrate(active());
    const parts = [];
    if (cal.ip) { project.cfg.priorIP = cal.ip.mae; parts.push(`IP：n = ${cal.ip.n}，MAE ${cal.ip.mae} eV，平均偏差 ${cal.ip.bias} eV${cal.ip.rho != null ? `，Spearman ρ = ${cal.ip.rho}` : ''}`); }
    if (cal.ea) { project.cfg.priorEA = cal.ea.mae; parts.push(`EA：n = ${cal.ea.n}，MAE ${cal.ea.mae} eV，平均偏差 ${cal.ea.bias} eV${cal.ea.rho != null ? `，Spearman ρ = ${cal.ea.rho}` : ''}`); }
    if (!parts.length) { toast('至少需要 2 个同时有 UMA-S 与 DFT 结果的分子'); return; }
    save(); renderReliability();
    $('calib-msg').textContent = `已用 UMA-S 与 DFT 的配对结果更新先验：${parts.join('；')}。${project.demo ? '（演示数据，仅示意）' : ''}`;
  });
  function renderReliability() {
    syncRelInputs();
    const c = cfg();
    const rows = active().filter((m) => m.origin !== 'seed' || L.objectives(m)).map((m) => ({ m, r: rel(m), v: L.verdict(m, c) })).sort((a, b) => b.r.doubt - a.r.doubt);
    $('rel-table').innerHTML = '<thead><tr><th>结构</th><th>名称</th><th>判定</th><th>原因</th><th>最近种子</th><th>DFT 判决</th></tr></thead><tbody>' + (rows.map(({ m, r, v }) => `<tr><td class="mol">${molSVG(m.canonical || m.smiles, 184, 128)}</td><td><b>${esc(m.label)}</b><br>${originTag(m)}</td><td>${levelTag(r)}</td><td><ul class="reasons">${r.reasons.map((x) => `<li>${esc(x)}</li>`).join('')}</ul></td><td>${m.filter?.nearest ? `${esc(m.filter.nearest)} · ${m.filter.sim.toFixed(2)}` : '—'}</td><td>${verdictHTML(v)}</td></tr>`).join('') || '<tr><td colspan="6" class="muted">还没有分子。</td></tr>') + '</tbody>';
  }
  function verdictHTML(v) {
    if (!v) return '<span class="muted">—</span>';
    return `<span class="tag ${v.confirmed ? 'ok' : 'bad'}">${v.confirmed ? 'DFT 确认' : 'DFT 推翻'}</span><div class="small muted">${v.checks.map((k) => `${k.label} ${f2(k.uma)} → ${f2(k.dft)}（${k.gap > 0 ? '+' : ''}${k.gap}）`).join('<br>')}</div>`;
  }

  // ── ⑤ pareto, hypervolume, DFT budget ───────────────────────────────────
  let roundLimit = null, playing = null;
  function niceTicks(min, max, count = 6) {
    const span = max - min || 1, step0 = span / count, mag = 10 ** Math.floor(Math.log10(step0));
    const step = [1, 2, 2.5, 5, 10].map((k) => k * mag).find((s) => s >= step0) || step0;
    const out = [];
    for (let v = Math.ceil(min / step) * step; v <= max + 1e-9; v += step) out.push(Math.round(v * 1000) / 1000);
    return out;
  }
  const roundColor = (r, max) => r === 0 ? 'var(--surface)' : `color-mix(in oklab, var(--accent-2) ${Math.round(100 - 75 * ((r - 1) / Math.max(1, max - 1)))}%, var(--gold))`;
  function renderPareto() {
    const maxRound = Math.max(0, ...all().map((m) => m.round));
    const slider = $('round');
    slider.max = String(maxRound);
    if (roundLimit === null || roundLimit > maxRound) roundLimit = maxRound;
    slider.value = String(roundLimit);
    $('round-out').textContent = String(roundLimit);
    drawPareto();
    drawHV(maxRound);
    renderDFT();
    renderBudget();
  }
  function drawPareto() {
    const c = cfg();
    const data = withData().filter((m) => m.round <= roundLimit);
    const box = $('pareto-chart');
    const W = 860, H = 460, P = { l: 64, r: 24, t: 30, b: 50 };
    if (!data.length) { box.innerHTML = `<svg viewBox="0 0 ${W} 200" role="img" aria-label="暂无数据"><text class="empty" x="${W / 2}" y="100" text-anchor="middle">还没有 Tier 1 结果。导入 Rowan 结果，或先载入演示数据。</text></svg>`; $('pareto-legend').innerHTML = ''; return; }
    const os = data.map(L.objectives);
    let x0 = Math.min(...os.map((o) => o.ip)), x1 = Math.max(...os.map((o) => o.ip)), y0 = Math.min(...os.map((o) => o.ea)), y1 = Math.max(...os.map((o) => o.ea));
    const px = (x1 - x0) * 0.08 + 0.1, py = (y1 - y0) * 0.1 + 0.1;
    x0 -= px; x1 += px; y0 -= py; y1 += py;
    const sx = (v) => P.l + ((v - x0) / (x1 - x0)) * (W - P.l - P.r);
    const sy = (v) => P.t + ((v - y0) / (y1 - y0)) * (H - P.t - P.b); // low EA on top = better
    const maxRound = Math.max(1, ...data.map((m) => m.round));
    const front = L.strictFront(data, c).map((m) => ({ m, o: L.objectives(m) })).sort((a, b) => a.o.ip - b.o.ip);
    const tied = new Set(L.paretoFront(data, c).map((m) => m.key));
    const prev = roundLimit > 0 ? L.strictFront(withData().filter((m) => m.round < roundLimit), c).map(L.objectives).sort((a, b) => a.ip - b.ip) : [];
    const step = (pts) => pts.length ? pts.map((o, i) => `${i ? 'L' : 'M'}${sx(o.ip).toFixed(1)},${sy(o.ea).toFixed(1)}${i < pts.length - 1 ? ` L${sx(pts[i + 1].ip).toFixed(1)},${sy(o.ea).toFixed(1)}` : ''}`).join(' ') : '';
    const xt = niceTicks(x0, x1), yt = niceTicks(y0, y1);
    let g = '';
    g += xt.map((v) => `<line class="gridline" x1="${sx(v)}" x2="${sx(v)}" y1="${P.t}" y2="${H - P.b}"/><text class="tick" x="${sx(v)}" y="${H - P.b + 18}" text-anchor="middle">${v}</text>`).join('');
    g += yt.map((v) => `<line class="gridline" x1="${P.l}" x2="${W - P.r}" y1="${sy(v)}" y2="${sy(v)}"/><text class="tick" x="${P.l - 8}" y="${sy(v) + 4}" text-anchor="end">${v}</text>`).join('');
    g += `<line class="axis" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}"/><line class="axis" x1="${P.l}" x2="${P.l}" y1="${P.t}" y2="${H - P.b}"/>`;
    g += `<text class="label" x="${(P.l + W - P.r) / 2}" y="${H - 10}" text-anchor="middle">绝热电离能 IP（UMA-S，eV）→ 越抗氧化</text>`;
    g += `<text class="label" transform="translate(16 ${(P.t + H - P.b) / 2}) rotate(-90)" text-anchor="middle">电子亲和能 EA（eV，向上越低）→ 越抗还原</text>`;
    g += `<text class="better" x="${W - P.r - 4}" y="${P.t - 10}" text-anchor="end">↗ 更好：高 IP、低 EA</text>`;
    if (prev.length) g += `<path class="front-old" d="${step(prev)}"/>`;
    g += `<path class="front" d="${step(front.map((x) => x.o))}"/>`;
    // Uncertainty boxes (± prior MAE) around front points: overlapping boxes are rule 1's ties.
    for (const { o } of front) g += `<rect class="err-box" x="${sx(o.ip - c.priorIP).toFixed(1)}" y="${sy(o.ea - c.priorEA).toFixed(1)}" width="${(sx(o.ip + c.priorIP) - sx(o.ip - c.priorIP)).toFixed(1)}" height="${(sy(o.ea + c.priorEA) - sy(o.ea - c.priorEA)).toFixed(1)}" rx="3"/>`;
    for (const m of data.sort((a, b) => a.round - b.round)) {
      const o = L.objectives(m), r = rel(m), v = L.verdict(m, c);
      const x = sx(o.ip), y = sy(o.ea), inside = L.inWindow(o.li, c.liWindow);
      const fill = inside ? roundColor(m.round, maxRound) : 'none';
      const stroke = m.origin === 'seed' ? 'var(--ink)' : 'var(--ink-2)';
      const shape = m.origin === 'seed' ? `<rect class="dot" x="${x - 6}" y="${y - 6}" width="12" height="12" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>` : `<circle class="dot" cx="${x}" cy="${y}" r="${tied.has(m.key) ? 7.5 : 6}" fill="${fill}" stroke="${stroke}" stroke-width="1.4"/>`;
      const ring = r.level === 'doubtful' ? `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="var(--warn)" stroke-width="1.6" stroke-dasharray="3 3"/>` : r.level === 'untrusted' ? `<circle cx="${x}" cy="${y}" r="11" fill="none" stroke="var(--danger)" stroke-width="1.8"/>` : '';
      const mark = v ? `<text x="${x + 10}" y="${y - 8}" font-size="13" font-weight="700" fill="${v.confirmed ? 'var(--ok)' : 'var(--danger)'}">${v.confirmed ? '✓' : '✗'}</text>` : '';
      const name = m.origin === 'seed' ? `<text x="${x}" y="${y + 20}" text-anchor="middle" font-size="10.5" fill="var(--muted)">${esc(m.label)}</text>` : '';
      g += `<g class="pt" data-key="${esc(m.key)}" tabindex="0" role="button" aria-label="${esc(`${m.label}，IP ${f2(o.ip)}，EA ${f2(o.ea)}，${LEVEL[r.level][0]}`)}">${ring}${shape}${mark}${name}</g>`;
    }
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="Pareto 前沿散点图：横轴电离能，纵轴电子亲和能">${g}</svg>`;
    const sw = (inner) => `<svg width="22" height="16" viewBox="0 0 22 16">${inner}</svg>`;
    $('pareto-legend').innerHTML = [
      `<span>${sw('<rect x="5" y="2" width="12" height="12" fill="var(--surface)" stroke="var(--ink)" stroke-width="1.5"/>')}种子溶剂</span>`,
      `<span>${sw(`<circle cx="11" cy="8" r="6" fill="${roundColor(1, 3)}" stroke="var(--ink-2)"/>`)}早期轮次</span>`,
      `<span>${sw(`<circle cx="11" cy="8" r="6" fill="${roundColor(3, 3)}" stroke="var(--ink-2)"/>`)}后期轮次</span>`,
      `<span>${sw('<circle cx="11" cy="8" r="6" fill="none" stroke="var(--ink-2)"/>')}Li⁺ 结合能超出区间</span>`,
      `<span>${sw('<circle cx="11" cy="8" r="6.5" fill="none" stroke="var(--warn)" stroke-dasharray="3 3" stroke-width="1.6"/>')}存疑</span>`,
      `<span>${sw('<path d="M1 12 H8 V5 H21" fill="none" stroke="var(--gold)" stroke-width="2"/>')}当前前沿</span>`,
      `<span>${sw('<rect x="2" y="2" width="18" height="12" rx="2" class="err-box"/>')}± 先验误差（重叠即并列）</span>`,
      prev.length ? `<span>${sw('<path d="M1 12 H8 V5 H21" fill="none" stroke="var(--line-strong)" stroke-dasharray="4 4" stroke-width="1.4"/>')}上一轮前沿</span>` : '',
      `<span><b style="color:var(--ok)">✓</b> / <b style="color:var(--danger)">✗</b> DFT 确认 / 推翻</span>`,
      c.liWindow ? `<span>Li⁺ 区间 ${f2(c.liWindow[0])} 至 ${f2(c.liWindow[1])} eV</span>` : ''
    ].join('');
  }
  function drawHV(maxRound) {
    const c = cfg();
    const ref = L.referencePoint(withData());
    const box = $('hv-chart');
    if (!ref || !maxRound) { box.innerHTML = '<p class="muted small">至少需要种子溶剂和一轮候选的 Tier 1 结果。</p>'; return; }
    const vals = [];
    for (let r = 0; r <= maxRound; r++) vals.push(L.hypervolume(L.strictFront(withData().filter((m) => m.round <= r), c), ref));
    const W = 860, H = 110, P = { l: 64, r: 24, t: 14, b: 26 };
    const top = Math.max(...vals, 1e-6), bw = (W - P.l - P.r) / vals.length;
    const bars = vals.map((v, r) => {
      const h = (v / top) * (H - P.t - P.b), x = P.l + r * bw + bw * 0.2, y = H - P.b - h;
      return `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${(bw * 0.6).toFixed(1)}" height="${Math.max(0, h).toFixed(1)}" rx="2" fill="${r <= roundLimit ? 'var(--accent-2)' : 'var(--line)'}"/><text class="tick" x="${(x + bw * 0.3).toFixed(1)}" y="${H - 8}" text-anchor="middle">R${r}</text><text class="tick" x="${(x + bw * 0.3).toFixed(1)}" y="${(y - 4).toFixed(1)}" text-anchor="middle">${v.toFixed(2)}</text>`;
    }).join('');
    box.innerHTML = `<svg viewBox="0 0 ${W} ${H}" role="img" aria-label="各轮前沿超体积"><line class="axis" x1="${P.l}" x2="${W - P.r}" y1="${H - P.b}" y2="${H - P.b}" stroke="var(--line-strong)"/>${bars}<text class="tick" x="${P.l - 8}" y="${P.t + 8}" text-anchor="end">eV²</text></svg>`;
  }
  $('round').addEventListener('input', () => { roundLimit = Number($('round').value); $('round-out').textContent = String(roundLimit); drawPareto(); drawHV(Number($('round').max)); });
  $('play').addEventListener('click', () => {
    if (playing) { clearInterval(playing); playing = null; $('play').textContent = '▶ 回放'; return; }
    const max = Number($('round').max);
    if (!max) return;
    roundLimit = 0; drawPareto(); drawHV(max); $('round').value = '0'; $('round-out').textContent = '0';
    $('play').textContent = '❚❚ 暂停';
    playing = setInterval(() => {
      roundLimit++;
      $('round').value = String(roundLimit); $('round-out').textContent = String(roundLimit);
      drawPareto(); drawHV(max);
      if (roundLimit >= max) { clearInterval(playing); playing = null; $('play').textContent = '▶ 回放'; }
    }, 1100);
  });

  // tooltip + click on points
  const tip = $('tip');
  $('pareto-chart').addEventListener('pointermove', (e) => {
    const g = e.target.closest('.pt');
    if (!g) { tip.hidden = true; return; }
    const m = project.molecules[g.dataset.key]; if (!m) return;
    const o = L.objectives(m), r = rel(m);
    tip.innerHTML = `<b>${esc(m.label)}</b> ${originTag(m)}<div class="smi">${esc(m.canonical || m.smiles)}</div>IP ${f2(o.ip)} · EA ${f2(o.ea)} · Li⁺ ${f2(o.li)} eV<br>${LEVEL[r.level][0]}：${esc(r.reasons[0])}${m.props.demo ? '<br><span class="tag demo">合成演示值</span>' : ''}`;
    tip.hidden = false;
    const x = Math.min(innerWidth - tip.offsetWidth - 12, e.clientX + 14), y = Math.min(innerHeight - tip.offsetHeight - 12, e.clientY + 14);
    tip.style.left = `${x}px`; tip.style.top = `${y}px`;
  });
  $('pareto-chart').addEventListener('pointerleave', () => { tip.hidden = true; });
  const openCard = (key) => { selected = key; cardView = 'all'; showTab('cards'); setTimeout(() => document.querySelector(`.mcard[data-key="${CSS.escape(key)}"]`)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 50); };
  $('pareto-chart').addEventListener('click', (e) => { const g = e.target.closest('.pt'); if (g) openCard(g.dataset.key); });
  $('pareto-chart').addEventListener('keydown', (e) => { const g = e.target.closest('.pt'); if (g && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault(); openCard(g.dataset.key); } });

  function renderDFT() {
    $('round-budget').value = project.cfg.roundBudget;
    $('max-dft').value = project.cfg.maxDFT;
    const c = cfg();
    const { picks, spent, ranked } = L.pickForDFT(withData(), c, rel);
    $('dft-picks').innerHTML = picks.length ? `<div class="picks">${picks.map((p, i) => `<div class="pick"><span class="rank">${i + 1}</span><span><b>${esc(p.m.label)}</b> <span class="smi">${esc(p.m.canonical || p.m.smiles)}</span></span><span class="cost">优先级 ${p.priority} · ${c.credits.t3} credits</span><ul class="reasons">${[p.onFront === 1 ? '在当前前沿上' : '在前沿附近（差距小于先验误差）', ...p.r.reasons].map((x) => `<li>${esc(x)}</li>`).join('')}</ul></div>`).join('')}</div><p class="muted small">合计 ${spent} credits（约 $${(spent * c.creditUSD).toFixed(2)}），本轮预算 ${c.roundBudget}。另有 ${Math.max(0, ranked.length - picks.length)} 个候选排在后面。</p>`
      : '<p class="muted small">目前没有需要 DFT 验证的候选：要么还没有 Tier 1 结果，要么前沿上的分子都已验证或可信。</p>';
  }
  $('round-budget').addEventListener('change', () => { project.cfg.roundBudget = Math.max(0, Number($('round-budget').value) || 0); save(); renderDFT(); });
  $('max-dft').addEventListener('change', () => { project.cfg.maxDFT = Math.max(1, Number($('max-dft').value) || 3); save(); renderDFT(); });
  $('dft-script').addEventListener('click', () => { tier = 't3'; showTab('results'); $('tier-pick').querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x.dataset.t === 't3'))); renderScript(); });

  function renderBudget() {
    const c = project.cfg, p = c.plan;
    const t1n = p.rounds * p.perRound + L.SEEDS.length;
    const rows = [
      ['Tier 1：构象 + 4 个电荷态 + UMA-M 单点', t1n, 't1', `${p.rounds} 轮 × ${p.perRound} + ${L.SEEDS.length} 个种子`],
      ['Tier 2：Rapid 电位', p.t2Total, 't2', ''],
      ['Tier 3：ωB97M-V 单点', p.t3Total, 't3', '']
    ];
    const total = rows.reduce((s, [, n, k]) => s + n * c.credits[k], 0) + p.margin;
    $('budget').innerHTML = `<thead><tr><th>任务</th><th>数量</th><th>每个 credits</th><th>小计</th></tr></thead><tbody>${rows.map(([label, n, k, note]) => `<tr><td>${label}${note ? `<br><span class="muted small">${note}</span>` : ''}</td><td>${k === 't1' ? `${n}` : `<input type="number" min="0" data-plan="${k === 't2' ? 't2Total' : 't3Total'}" value="${n}">`}</td><td><input type="number" min="0" step="1" data-credit="${k}" value="${c.credits[k]}"></td><td>${n * c.credits[k]}</td></tr>`).join('')}<tr><td>开发与调试余量</td><td>—</td><td>—</td><td><input type="number" min="0" step="50" data-plan="margin" value="${p.margin}"></td></tr></tbody><tfoot><tr><td>合计</td><td></td><td></td><td>${total} credits</td></tr></tfoot>`;
    $('budget-note').innerHTML = `按 $${c.creditUSD}/credit 折算约 <b>$${(total * c.creditUSD).toFixed(0)}</b>。计划 <input type="number" min="1" max="50" data-plan="rounds" value="${p.rounds}" style="width:60px"> 轮，每轮 <input type="number" min="1" max="30" data-plan="perRound" value="${p.perRound}" style="width:60px"> 个分子。`;
  }
  document.addEventListener('change', (e) => {
    const el = e.target;
    if (el.dataset.credit) { project.cfg.credits[el.dataset.credit] = Math.max(0, Number(el.value) || 0); save(); renderBudget(); renderDFT(); }
    else if (el.dataset.plan) { project.cfg.plan[el.dataset.plan] = Math.max(0, Number(el.value) || 0); save(); renderBudget(); }
  });

  // ── ⑥ cards ─────────────────────────────────────────────────────────────
  let cardView = 'front', selected = null;
  function cardList() {
    const c = cfg(), d = withData();
    const order = (list) => list.sort((a, b) => Number(a.origin === 'seed') - Number(b.origin === 'seed') || L.objectives(b).ip - L.objectives(a).ip);
    if (cardView === 'front') { const f = new Set(L.paretoFront(d, c).map((m) => m.key)); return order(d.filter((m) => f.has(m.key))); }
    if (cardView === 'verified') return order(d.filter((m) => L.verdict(m, c)));
    if (cardView === 'doubtful') return order(d.filter((m) => rel(m).level !== 'trusted'));
    return order(d);
  }
  function pubchemHTML(m) {
    const p = m.pubchem;
    if (!m.filter?.info?.inchikey) return '';
    if (!p) return `<button type="button" class="text-button" data-pubchem="${esc(m.key)}">查 PubChem</button>`;
    if (p.status === 'listed') return `<a href="https://pubchem.ncbi.nlm.nih.gov/compound/${encodeURIComponent(p.cid)}" target="_blank" rel="noopener noreferrer"><span class="tag">PubChem CID ${esc(p.cid)}</span></a>`;
    if (p.status === 'new') return '<span class="tag gold" title="未收录只说明新，不说明好或可合成">PubChem 未收录 · 新</span>';
    if (p.status === 'loading') return '<span class="tag">查询中…</span>';
    return `<button type="button" class="text-button" data-pubchem="${esc(m.key)}">重试 PubChem</button>`;
  }
  function renderCards() {
    $('card-view').querySelectorAll('button').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.v === cardView)));
    const c = cfg(), list = cardList();
    $('cards').innerHTML = list.length ? list.map((m) => {
      const p = m.props, r = rel(m), v = L.verdict(m, c), link = safeURL(p.rowan_url);
      return `<article class="mcard${selected === m.key ? ' sel' : ''}" data-key="${esc(m.key)}"><div class="art">${molSVG(m.canonical || m.smiles, 300, 150)}</div><div class="body"><div class="badges">${originTag(m)}${levelTag(r)}${p.demo ? '<span class="tag demo">合成值</span>' : ''}</div><h4>${esc(m.label)}${m.filter?.info ? ` <span class="muted small">${esc(m.filter.info.formula)}</span>` : ''}</h4><div class="smi">${esc(m.canonical || m.smiles)}</div>${m.rationale ? `<p class="why">${esc(m.rationale)}</p>` : ''}<table><thead><tr><th></th><th>UMA-S</th><th>UMA-M</th><th>DFT</th></tr></thead><tbody><tr><td>IP / eV</td><td>${f2(p.ip_s)}</td><td>${f2(p.ip_m)}</td><td>${f2(p.ip_dft)}</td></tr><tr><td>EA / eV</td><td>${f2(p.ea_s)}</td><td>${f2(p.ea_m)}</td><td>${f2(p.ea_dft)}</td></tr><tr><td>Li⁺ / eV</td><td>${f2(p.li_s)}</td><td>${f2(p.li_m)}</td><td>—</td></tr>${p.e_ox != null || p.e_red != null ? `<tr><td>E vs Li/Li⁺</td><td colspan="3">氧化 ${f2(toLi(p.e_ox))} V · 还原 ${f2(toLi(p.e_red))} V</td></tr>` : ''}</tbody></table><ul class="reasons">${r.reasons.slice(0, 3).map((x) => `<li>${esc(x)}</li>`).join('')}</ul><div class="foot">${verdictHTML(v)}${pubchemHTML(m)}${link ? `<a href="${esc(link)}" target="_blank" rel="noopener noreferrer">Rowan ↗</a>` : ''}<button type="button" class="text-button" data-copy="${esc(m.canonical || m.smiles)}">复制 SMILES</button></div></div></article>`;
    }).join('') : `<div class="empty-note">${withData().length ? '这个筛选下没有分子。' : '还没有带计算结果的分子。先导入 Rowan 结果，或载入演示数据看完整流程。'}</div>`;
  }
  $('card-view').addEventListener('click', (e) => { const b = e.target.closest('[data-v]'); if (b) { cardView = b.dataset.v; renderCards(); } });
  $('cards').addEventListener('click', (e) => {
    const cp = e.target.closest('[data-copy]'); if (cp) { copy(cp.dataset.copy, ' SMILES'); return; }
    const pc = e.target.closest('[data-pubchem]'); if (pc) checkPubChem([project.molecules[pc.dataset.pubchem]]);
  });
  async function checkPubChem(list) {
    const todo = list.filter((m) => m?.filter?.info?.inchikey && m.pubchem?.status !== 'listed' && m.pubchem?.status !== 'new');
    if (!todo.length) { toast('这些分子都已查过'); return; }
    let i = 0;
    const worker = async () => {
      while (i < todo.length) {
        const m = todo[i++];
        m.pubchem = { status: 'loading' }; renderCards();
        try {
          const res = await fetch(`https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/inchikey/${encodeURIComponent(m.filter.info.inchikey)}/cids/JSON`);
          if (res.status === 404) m.pubchem = { status: 'new', at: Date.now() };
          else if (res.ok) { const j = await res.json(); m.pubchem = { status: 'listed', cid: j.IdentifierList?.CID?.[0], at: Date.now() }; }
          else m.pubchem = { status: 'error' };
        } catch { m.pubchem = { status: 'error' }; }
        await new Promise((r) => setTimeout(r, 260)); // PubChem asks for ≤ 5 requests / second
      }
    };
    await Promise.all([worker(), worker()]);
    save(); renderCards();
    const fresh = todo.filter((m) => m.pubchem.status === 'new').length;
    toast(`PubChem：${todo.length} 个分子中 ${fresh} 个未收录`);
  }
  $('pubchem-all').addEventListener('click', () => checkPubChem(cardList()));
  $('export-csv').addEventListener('click', () => {
    const c = cfg();
    const head = ['label', 'origin', 'round', 'smiles', 'inchikey', 'formula', 'ip_uma_s', 'ip_uma_m', 'ea_uma_s', 'ea_uma_m', 'li_uma_s', 'li_uma_m', 'e_ox_sce', 'e_red_sce', 'ip_dft', 'ea_dft', 'reliability', 'doubt', 'dft_verdict', 'pubchem', 'rationale', 'synthetic_demo'];
    const q = (v) => `"${String(v ?? '').replace(/"/g, '""')}"`;
    const rows = active().map((m) => { const p = m.props, r = rel(m), v = L.verdict(m, c); return [m.label, m.origin, m.round, m.canonical || m.smiles, m.filter?.info?.inchikey, m.filter?.info?.formula, p.ip_s, p.ip_m, p.ea_s, p.ea_m, p.li_s, p.li_m, p.e_ox, p.e_red, p.ip_dft, p.ea_dft, r.level, r.doubt, v ? (v.confirmed ? 'confirmed' : 'overturned') : '', m.pubchem?.status === 'listed' ? `CID ${m.pubchem.cid}` : m.pubchem?.status || '', m.rationale, p.demo ? 'yes' : ''].map(q).join(','); });
    download('chemhub-candidates.csv', '﻿' + [head.join(','), ...rows].join('\r\n'), 'text/csv');
  });
  $('export-md').addEventListener('click', () => {
    const c = cfg(), d = withData();
    const front = L.paretoFront(d, c);
    const cal = L.calibrate(active());
    const line = (m) => { const p = m.props, r = rel(m), v = L.verdict(m, c); return `| ${m.label} | \`${m.canonical || m.smiles}\` | ${f2(p.ip_s)} | ${f2(p.ea_s)} | ${f2(p.li_s)} | ${LEVEL[r.level][0]} (${r.doubt}) | ${v ? (v.confirmed ? '确认' : '推翻') : '—'} | ${m.pubchem?.status === 'listed' ? `CID ${m.pubchem.cid}` : m.pubchem?.status === 'new' ? '未收录' : '—'} |`; };
    const md = `# 闭环电解液溶剂发现 · 结果报告\n\n生成于 ${new Date().toLocaleString('zh-CN')}，ChemResearch Hub AI 实验室。${project.demo ? '\n\n> **注意：本报告基于合成演示数据，数值不是计算结果。**' : ''}\n\n- 轮次：${project.rounds.length}；通过过滤的分子：${active().length}；有 Tier 1 结果：${d.length}\n- 先验误差：IP ${c.priorIP} eV，EA ${c.priorEA} eV；模型分歧阈值 IP ${c.disagreeIP} / EA ${c.disagreeEA} eV\n${cal.ip ? `- UMA-S 对 DFT 的 IP 误差：MAE ${cal.ip.mae} eV（n = ${cal.ip.n}，ρ = ${cal.ip.rho ?? '—'}）\n` : ''}${cal.ea ? `- UMA-S 对 DFT 的 EA 误差：MAE ${cal.ea.mae} eV（n = ${cal.ea.n}，ρ = ${cal.ea.rho ?? '—'}）\n` : ''}\n## Pareto 前沿（差距小于先验误差视为并列）\n\n| 名称 | SMILES | IP | EA | Li⁺ | 可靠性 | DFT | PubChem |\n|---|---|---|---|---|---|---|---|\n${front.map(line).join('\n')}\n\n## 已验证的候选\n\n| 名称 | SMILES | IP | EA | Li⁺ | 可靠性 | DFT | PubChem |\n|---|---|---|---|---|---|---|---|\n${d.filter((m) => L.verdict(m, c)).map(line).join('\n') || '| — |'}\n\n## 局限\n\n- 电位工作流的溶剂固定为乙腈，只适合相对排序。\n- 忽略阴离子与电极界面；不考虑黏度、熔点、闪点、电导率。\n- 合成可及性为启发式分数，没有实验验证；PubChem 未收录只说明新，不说明好或可合成。\n`;
    download('chemhub-report.md', md, 'text/markdown');
  });

  // ── project actions ─────────────────────────────────────────────────────
  function replaceProject(p) {
    project = normalize(p);
    ensureSeeds();
    svgCache.clear();
    if (R) refilterAll(false);
    roundLimit = null;
    save(); renderAll();
  }
  $('export-project').addEventListener('click', () => download(`chemhub-lab-${new Date().toISOString().slice(0, 10)}.json`, JSON.stringify(project, null, 1), 'application/json'));
  $('import-project').addEventListener('change', async (e) => {
    const f = e.target.files[0]; e.target.value = '';
    if (!f) return;
    try { const j = JSON.parse(await f.text()); if (j.version !== 1 || !j.molecules) throw new Error('不是 AI 实验室导出的项目文件'); replaceProject(j); toast('已载入项目'); } catch (err) { toast(`导入失败：${err.message}`); }
  });
  $('reset-project').addEventListener('click', () => {
    if (!confirm('清空当前项目？种子溶剂会保留，其他分子、轮次与结果都会删除（建议先导出）。')) return;
    replaceProject(blank());
    toast('已清空');
  });

  /** Synthetic demo: three rounds run through the real RDKit gate, with made-up tier values and simulated DFT picks. */
  async function loadDemo() {
    if (project.rounds.length && !confirm('载入演示数据会替换当前项目（建议先导出）。继续？')) return;
    try { await ready; } catch { toast('RDKit 未能载入，无法生成演示'); return; }
    const p = blank();
    p.demo = true;
    project = p; ensureSeeds(); svgCache.clear();
    refilterAll(false);
    const r = L.rng(20261104);
    for (const m of active()) m.props = L.demoProps(m.filter.info, m.canonical, r, 'seed');
    L.DEMO_ROUNDS.forEach((round, idx) => {
      const n = idx + 1;
      const list = round.map(([smiles, why], i) => ({ key: `r${n}-${i + 1}`, smiles, label: `R${n}-${i + 1}`, round: n, order: i, origin: 'demo', rationale: why, props: {} }));
      filterNew(list);
      for (const m of list) { project.molecules[m.key] = m; if (m.filter.pass) m.props = L.demoProps(m.filter.info, m.canonical, r, 'demo'); }
      project.rounds.push({ n, at: new Date(Date.UTC(2026, 9, 28 + idx, 14)).toISOString(), origin: 'demo', label: '演示（固定分子 + 合成数值）', total: list.length, passed: list.filter((m) => m.filter.pass).length, usage: null, cost: null });
      // Tier 2 for the round's best few, tier 3 for the reliability layer's picks.
      const c = cfg();
      list.filter((m) => m.filter.pass).sort((a, b) => b.props.ip_s - a.props.ip_s).slice(0, 4).forEach((m) => {
        m.props.e_ox = Math.round((0.86 * m.props.ip_s - 6.95 + (r() - 0.5) * 0.2) * 100) / 100;
        m.props.e_red = Math.round((-3.05 + 0.85 * m.props.ea_s + (r() - 0.5) * 0.2) * 100) / 100;
        if (r() < 0.15) m.props.warn = '还原态出现碎片化';
      });
      // The last round's picks stay pending so the DFT panel has something to allocate.
      if (n === L.DEMO_ROUNDS.length) return;
      for (const { m } of L.pickForDFT(withData(), c, rel).picks) {
        const split = Math.abs(m.props.ip_s - m.props.ip_m) > c.disagreeIP;
        // Where UMA-S and UMA-M disagree, the synthetic DFT sides with UMA-M (an "overturn").
        m.props.ip_dft = Math.round(((split ? m.props.ip_m : m.props.ip_s) + (r() - 0.5) * 0.2) * 100) / 100;
        m.props.ea_dft = Math.round((m.props.ea_s + (r() - 0.5) * 0.3) * 100) / 100;
      }
    });
    roundLimit = null;
    save(); renderAll();
    showTab('pareto', true);
    toast('已载入演示：3 轮、21 个提案；数值为合成值');
  }
  $('load-demo').addEventListener('click', loadDemo);
  $('hero-demo').addEventListener('click', loadDemo);

  // ── boot ────────────────────────────────────────────────────────────────
  // ai.js is loaded (deferred) before this file; if it failed, the lab still works without the propose step.
  showTab(tab);
  renderStatus();
})();
