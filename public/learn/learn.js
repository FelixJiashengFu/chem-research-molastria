'use strict';
// 研习台的页面：学习（摸底 → 路线 → 一步一检 → 总结进知识图）、练习、知识图、导入笔记、数据（导出导入、用量、提示词）。
// 逻辑在 learn-core.js（纯函数），站内章节和演示白名单在 learn-sources.js，SVG 图在 learn-graph.js；这里只管界面和调用 AI。
// 固定文字成对写在这里（L(中, 英)，标 translate="no"），英文页不依赖词典；AI 和学习者写的文字是数据，一律转义、标 translate="no"。
// 模型只回 JSON，由 learn-core 校验；讲解用 ChemAI.markdown（先转义再排版）。数据存在本机 localStorage（molastria-learn）；打开云同步时由 sync/sync.js 同步到账号。
// 地址：#learn #practice #graph #import #data；#s-<会话> 打开一次学习或练习；#goal=qp:<章> 用站内一章预填目标。
(() => {
  const C = window.MOLASTRIA_LEARN_CORE, S = window.MOLASTRIA_LEARN_SOURCES, G = window.MOLASTRIA_LEARN_GRAPH;
  const panel = document.getElementById('ln-panel');
  if (!C || !S || !G || !panel) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const aiLang = en ? 'en' : 'zh';
  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const t = (zh, e) => (en ? e : zh);
  const L = (zh, e) => `<span translate="no" lang="${lang}">${esc(t(zh, e))}</span>`;
  // 数据（AI 或学习者写的）：转义，标 translate="no"
  const X = (s, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no">${esc(s)}</${tag}>`;
  const ico = (dir) => `<i class="ico-ext${dir ? ` ico-${dir}` : ''}" aria-hidden="true"></i>`;
  const safeId = (s) => String(s).replace(/[^\w-]/g, '_');
  const letter = (i) => String.fromCharCode(65 + i);
  const store = {
    get(k, d) { try { const v = localStorage.getItem(k); return v == null ? d : JSON.parse(v); } catch { return d; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); return true; } catch { return false; } },
  };
  const fmtDate = (ms) => { try { return new Date(ms).toLocaleDateString(en ? 'en' : 'zh-CN', { year: 'numeric', month: 'short', day: 'numeric' }); } catch { return ''; } };
  const fmtNum = (n) => Number(n || 0).toLocaleString(en ? 'en' : 'zh-CN');
  // 英文的单复数：pl(1, 'claim') → '1 claim'，pl(3, 'claim') → '3 claims'
  const pl = (n, one, many = `${one}s`) => `${fmtNum(n)} ${n === 1 ? one : many}`;
  // 报错文字：learn-sources 的报错带 zh / en，按页面语言挑；其他的用 message
  const errText = (e) => (e && (en ? e.en : e.zh)) || String(e?.message || e);
  const abortErr = () => { try { return new DOMException('Aborted', 'AbortError'); } catch { return Object.assign(new Error('Aborted'), { name: 'AbortError' }); } };
  // 等一个 Promise，按下“停止”时立刻放弃
  const abortable = (p, signal) => new Promise((resolve, reject) => {
    if (signal.aborted) { reject(abortErr()); return; }
    const on = () => reject(abortErr());
    signal.addEventListener('abort', on, { once: true });
    Promise.resolve(p).then(resolve, reject).finally(() => signal.removeEventListener('abort', on));
  });
  if (en) {
    document.title = 'Study Desk · MolAstria';
    const h1 = document.getElementById('ln-h1');
    if (h1?.firstChild?.nodeType === 3) h1.firstChild.textContent = 'Study Desk';
  }

  // ── 状态 ──────────────────────────────────────────────────────────────
  const migrate = (raw) => C.migrate(raw, { isDemo: S.isDemo });
  let state = migrate(store.get(C.STORE_KEY, null));
  let prompts = store.get(C.PROMPT_KEY, {}) || {};
  if (typeof prompts !== 'object' || Array.isArray(prompts)) prompts = {};
  function save() {
    let ok = false;
    try { localStorage.setItem(C.STORE_KEY, JSON.stringify(state)); ok = true; } catch { ok = false; }
    const w = $('#ln-warn');
    if (w) {
      w.hidden = ok;
      if (!ok) w.innerHTML = L('浏览器存储已满或被禁用，刚才的改动没能保存。请到“数据”里导出一份备份，或删掉一些旧会话。', 'Browser storage is full or blocked, so the last change was not saved. Export a backup under “Data”, or delete some old sessions.');
    }
    return ok;
  }
  const sessionById = (id) => state.sessions.find((s) => s.id === id) || null;
  const propById = (id) => state.props.find((p) => p.id === id) || null;
  const nodeOf = (sess, id) => sess?.plan?.nodes.find((n) => n.id === id) || null;
  const touch = (sess) => { if (sess) sess.updated = Date.now(); };

  // 草稿：答题框里打到一半的内容，重画页面时填回去（不存盘）
  const drafts = {};
  const draft = (key) => (drafts[key] ||= { value: undefined, confidence: '', thinking: '' });

  // 新会话表单
  const form = { goal: '', autoGoal: '', srcId: '', chId: '', source: null, files: [], msg: '' };
  // 当前打开的会话、各页的临时状态
  let tab = 'learn', openLearn = null, openPractice = null, planSel = null, mapOpen = true;
  let kg = null, kgSel = null, kgQuery = '';
  const imp = { text: '', name: '', preview: null, msg: '', ok: '' };
  let pendingImport = null, dataMsg = '';

  // ── AI 调用：同一时间只有一个，带计时、停止和重试 ──────────────────
  let job = null;   // {ctx, label, started, chars, ctrl}
  let fail = null;  // {ctx, message, code, retry}
  const ai = () => window.ChemAI;
  const aiReady = () => !!ai()?.isReady?.();
  function needAI() {
    if (!ai()) { announce(t('AI 模块没有载入，请刷新页面。', 'The AI module did not load; reload the page.')); return false; }
    if (!aiReady()) { ai().openSettings(); return false; }
    return true;
  }
  // 进行中的那一项换一句说明（不重画整页，免得打断别处）
  function jobLabel(label) {
    if (!job) return;
    Object.assign(job, { label, started: Date.now(), chars: 0 });
    const els = $$('[data-job-label]');
    if (els.length) { for (const el of els) el.textContent = label; tick(); } else softRender(job.ctx);
  }
  // 在 run() 里调用：沿用 run 建好的 job（同一个停止按钮）
  async function call(ctx, label, msgs, sess, maxTokens = 6000) {
    const A = ai();
    if (!A) throw new Error(t('AI 模块没有载入，请刷新页面。', 'The AI module did not load; reload the page.'));
    const own = !job;
    if (own) { job = { ctx, label, started: Date.now(), chars: 0, ctrl: new AbortController() }; softRender(ctx); } else jobLabel(label);
    const j = job;
    try {
      if (j.ctrl.signal.aborted) throw abortErr();
      const r = await A.chat({ messages: msgs, json: true, maxTokens, signal: j.ctrl.signal, onDelta: (_, full) => { j.chars = full.length; tick(); } });
      C.addUsage(state, sess, r);
      save();
      return A.parseJSON(r.text);
    } finally {
      if (own && job === j) job = null;
    }
  }
  const blocked = () => { if (!job) return false; announce(t('上一个请求还没结束。', 'The previous request is still running.')); return true; };
  // fn 里出错时显示在 ctx 对应的位置，带重试。从第一刻起就算“忙”（fn 可能先要载入章节数据），按钮随即变灰。
  async function run(ctx, fn) {
    if (blocked()) return;
    const j = job = { ctx, label: t('准备中…', 'Getting ready…'), started: Date.now(), chars: 0, ctrl: new AbortController() };
    fail = null;
    softRender(ctx);
    try {
      await fn();
      fail = null;
    } catch (err) {
      const aborted = err?.name === 'AbortError';
      fail = { ctx, message: aborted ? t('已停止。', 'Stopped.') : errText(err), code: err?.code, status: err?.status, retry: () => run(ctx, fn) };
      if (err?.code === 'no-key') ai()?.openSettings();
    } finally {
      if (job === j) job = null;
    }
    afterJob(ctx);
  }
  // 请求结束：正在看的是它的视图就重画；别的视图里因为忙而变灰的控件恢复可用（不重画，免得打断打字）
  function afterJob(ctx) {
    if (viewCtx() === ctx) { render(); return; }
    renderTabs();
    for (const el of $$('[data-jobdis]', panel)) { el.disabled = false; el.removeAttribute('data-jobdis'); }
  }
  function tick() {
    if (!job) return;
    const s = Math.round((Date.now() - job.started) / 1000);
    for (const el of $$('[data-job-time]')) el.textContent = String(s);
    for (const el of $$('[data-job-chars]')) el.textContent = fmtNum(job.chars);
  }
  setInterval(tick, 500);
  // 在 ctx 的位置显示：进行中 / 出错
  function jobBox(ctx) {
    if (job && job.ctx === ctx) {
      return `<div class="ln-busy" role="status"><span class="ln-spin" aria-hidden="true"></span><span data-job-label>${esc(job.label)}</span>
        <span class="ln-busy-meta" aria-hidden="true"><span data-job-time>0</span> s · ${L('已收到', 'received')} <span data-job-chars>${fmtNum(job.chars)}</span> ${L('字', 'chars')}</span>
        <button type="button" class="button small" data-act="abort">${L('停止', 'Stop')}</button></div>`;
    }
    if (fail && fail.ctx === ctx) {
      return `<div class="ln-error" role="alert"><p>${L('没有成功：', 'That did not work: ')}<span>${esc(fail.message)}</span></p>
        <div class="ln-row">${fail.code === 'no-key' || fail.status === 401 || fail.status === 403 ? `<button type="button" class="button small primary" data-act="settings">${L('配置 AI', 'Set up AI')}</button>` : ''}<button type="button" class="button small" data-act="retry">${L('重试', 'Try again')}</button></div></div>`;
    }
    return '';
  }
  const busy = () => !!job;
  const dis = () => (job ? ' disabled data-jobdis' : '');
  function announce(msg) { const el = $('#ln-status'); if (el) { el.textContent = ''; setTimeout(() => { el.textContent = msg; }, 30); } }

  // ── 首屏：介绍、AI 状态 ───────────────────────────────────────────────
  $('#ln-lead').innerHTML = L(
    '先摸底：AI 先问几道诊断题，连同你有多确定、你是怎么想的，看清你已经会什么。再画路线：从你会的到目标，画成一张依赖图。然后一步一检：每次只讲一步，紧跟一道检查题，答错或靠猜答对就换个角度补一步。练习分开做，题目跨主题穿插、不提前说考什么。学到的命题和推理链积累成跨会话的知识图，下次学习从这里接着走。用你自己的 AI key（或登录后的托管额度），数据只存在这台设备。',
    'Probe first: the AI asks a few diagnostic questions and reads your answers together with how sure you are and how you reasoned. Then a map: a dependency graph from what you hold to the goal. Then one step, one check: a single step at a time, each followed by a check question; a wrong answer or a lucky guess gets a repair step from another angle. Practice is separate, interleaved across topics, without saying what each problem is about. What you learn builds a knowledge graph of claims and reasoning chains that later sessions start from. It runs on your own AI key (or the hosted allowance when signed in), and your data stays on this device.');
  $('#ln-tabs').setAttribute('aria-label', t('研习台', 'Study Desk'));
  function renderAI() {
    const box = $('#ln-ai');
    const A = ai();
    if (!A) { box.innerHTML = `<p class="ln-ai-line err">${L('AI 模块没有载入，请刷新页面。', 'The AI module did not load; reload the page.')}</p>`; return; }
    const s = A.settings();
    const p = A.providers[s.provider] || {};
    if (A.isReady()) {
      const model = (p.models || []).find(([id]) => id === s.models[s.provider])?.[0] || s.models[s.provider] || p.models?.[0]?.[0] || '';
      box.innerHTML = `<p class="ln-ai-line"><span class="ln-dot ok" aria-hidden="true"></span>${L('使用', 'Using')} <b translate="no">${esc(p.label || s.provider)}${model ? ` · ${esc(model)}` : ''}</b>
        <button type="button" class="text-button" data-act="settings">${L('更换', 'Change')}</button></p>
        ${p.hosted ? `<p class="ln-ai-note">${L('托管额度：免费账号每天 5 次回答，大约够一次摸底；完整学一次要十几次调用，建议在设置里填你自己的 key。', 'Hosted allowance: a free account gets 5 answers a day, about one probe; a full session takes a dozen or more calls, so an own key in the settings is the better fit.')}</p>` : ''}`;
    } else {
      box.innerHTML = `<p class="ln-ai-line"><span class="ln-dot" aria-hidden="true"></span>${L('还没有配置 AI。支持 DeepSeek、Meta Muse 或任意 OpenAI 兼容接口，key 只存在你的浏览器里。', 'No AI set up yet. DeepSeek, Meta Muse or any OpenAI-compatible API works; the key stays in your browser.')}
        <button type="button" class="button small primary" data-act="settings">${L('配置 API key', 'Set up an API key')}</button></p>
        <p class="ln-ai-note">${L('不配置也能看知识图、导入导出数据、编辑提示词。登录 MolAstria 账号后可以用少量托管额度。', 'Without one you can still browse the knowledge graph, import and export data and edit the prompts. A MolAstria account adds a small hosted allowance.')}</p>`;
    }
  }
  document.addEventListener('chemhub:ai-config', () => { renderAI(); });
  document.addEventListener('molastria:account', () => { renderAI(); });

  // ── 标签页与地址 ──────────────────────────────────────────────────────
  const TABS = [['learn', '学习', 'Learn'], ['practice', '练习', 'Practice'], ['graph', '知识图', 'Knowledge graph'], ['import', '导入笔记', 'Import notes'], ['data', '数据', 'Data']];
  function renderTabs() {
    const n = { learn: state.sessions.filter((s) => s.kind === 'learn').length, practice: state.sessions.filter((s) => s.kind === 'practice').length, graph: state.props.length };
    $('#ln-tabs').innerHTML = TABS.map(([id, zh, e]) => `<a class="ln-tab" href="#${id}" data-tab="${id}"${tab === id ? ' aria-current="page"' : ''}>${L(zh, e)}${n[id] ? `<span class="ln-count" translate="no">${n[id]}</span>` : ''}</a>`).join('');
  }
  function route() {
    let h = '';
    try { h = decodeURIComponent(location.hash.slice(1)); } catch { h = location.hash.slice(1); }
    if (h.startsWith('goal=')) { tab = 'learn'; openLearn = null; prefill(h.slice(5)); }
    else if (h.startsWith('s-')) {
      const s = sessionById(h.slice(2));
      if (s?.kind === 'practice') { tab = 'practice'; openPractice = s.id; }
      else if (s) { tab = 'learn'; openLearn = s.id; planSel = null; }
      else { tab = 'learn'; openLearn = null; }
    } else if (TABS.some(([id]) => id === h)) {
      tab = h;
      if (h === 'learn') openLearn = null;
      if (h === 'practice') openPractice = null;
    }
    render();
  }
  window.addEventListener('hashchange', route);
  const go = (hash) => { if (location.hash === hash) route(); else location.hash = hash; };

  // ctx：这个视图里会出现的请求位置
  const viewCtx = () => (tab === 'learn' && openLearn ? openLearn : tab === 'practice' && openPractice ? openPractice : tab === 'import' ? 'import' : tab === 'learn' ? 'new' : '');
  // 请求开始和结束时：只重画正在看的那个视图（别打断在别处打字）
  function softRender(ctx) { if (viewCtx() === ctx) render(); else renderTabs(); }

  function render() {
    renderTabs();
    if (tab !== 'graph' && kg) { kg.destroy(); kg = null; }
    panel.dataset.tab = tab;
    if (tab === 'learn') renderLearn();
    else if (tab === 'practice') renderPractice();
    else if (tab === 'graph') renderGraph();
    else if (tab === 'import') renderImport();
    else renderData();
    tick();
  }

  // ── 共用的答题块：选项或简答、有多确定、怎么想的（可口述）──────────
  const CONF = [['sure', '确定', 'Sure'], ['fair', '大概', 'Fairly sure'], ['guess', '猜的', 'Guessing']];
  const confLabel = (c) => { const x = CONF.find(([k]) => k === c) || CONF[1]; return t(x[1], x[2]); };
  const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
  const micBtn = (target) => (SR ? `<button type="button" class="ln-mic" data-act="mic" data-target="${esc(target)}" aria-pressed="false" title="${esc(t('口述（语音输入）', 'Dictate'))}"><span class="ln-mic-ico" aria-hidden="true"></span><span class="sr-only">${L('口述', 'Dictate')}</span></button>` : '');
  function answerBlock(key, q, o = {}) {
    const d = draft(key), id = safeId(key);
    let input;
    if (q.kind === 'choice' && q.options?.length) {
      input = `<fieldset class="ln-opts"><legend class="sr-only">${L('选一个', 'Pick one')}</legend>${q.options.map((op, i) => `<label class="ln-opt"><input type="radio" name="a-${id}" value="${i}" data-draft="${esc(key)}" data-field="value" data-num${d.value === i ? ' checked' : ''}${dis()}><span class="ln-opt-l" aria-hidden="true">${letter(i)}</span>${X(op)}</label>`).join('')}</fieldset>`;
    } else {
      input = `<label class="ln-field"><span>${L('你的回答', 'Your answer')}</span><span class="ln-with-mic"><textarea id="v-${id}" rows="${o.rows || 3}" data-draft="${esc(key)}" data-field="value" translate="no"${dis()}>${esc(typeof d.value === 'string' ? d.value : '')}</textarea>${micBtn(`v-${id}`)}</span></label>`;
    }
    const conf = `<fieldset class="ln-conf"><legend>${L('你有多确定？', 'How sure are you?')}</legend><div class="ln-seg">${CONF.map(([k, zh, e]) => `<label><input type="radio" name="c-${id}" value="${k}" data-draft="${esc(key)}" data-field="confidence"${d.confidence === k ? ' checked' : ''}${dis()}><span>${L(zh, e)}</span></label>`).join('')}</div></fieldset>`;
    const think = `<label class="ln-field"><span>${L('说说你是怎么想的（可选）', 'How did you think about it? (optional)')}</span><span class="ln-with-mic"><textarea id="t-${id}" rows="2" data-draft="${esc(key)}" data-field="thinking" translate="no" placeholder="${esc(t('想到什么写什么，半句话也行', 'Whatever comes to mind, half a sentence is fine'))}"${dis()}>${esc(d.thinking || '')}</textarea>${micBtn(`t-${id}`)}</span></label>`;
    return `<div class="ln-answer">${input}${o.noConf ? '' : conf}${o.noThink ? '' : think}<p class="ln-hint-msg" data-msg="${esc(key)}" role="alert"></p></div>`;
  }
  // 读出草稿：{value, confidence, thinking}；value 为空时 ok=false
  function readDraft(key, q, o = {}) {
    const d = draft(key);
    const isChoice = q.kind === 'choice' && q.options?.length;
    const value = isChoice ? (Number.isInteger(d.value) ? d.value : undefined) : String(d.value || '').trim();
    const msg = $(`[data-msg="${CSS.escape(key)}"]`);
    const say = (m) => { if (msg) msg.textContent = m; return null; };
    if (!o.allowBlank && (value === undefined || value === '')) return say(isChoice ? t('先选一个选项。', 'Pick an option first.') : t('先写下你的回答（不知道也可以直说）。', 'Write an answer first (saying you don’t know is fine).'));
    if (value === undefined || value === '') return { value: '', confidence: 'guess', thinking: String(d.thinking || '').trim() };
    if (!d.confidence) return say(t('选一下你有多确定。', 'Say how sure you are.'));
    return { value, confidence: d.confidence, thinking: String(d.thinking || '').trim() };
  }
  // 已作答的展示
  function answeredView(q, a, graded, o = {}) {
    if (!a) return '';
    const isChoice = q.kind === 'choice' && q.options?.length;
    const val = isChoice && Number.isInteger(a.value) ? `${letter(a.value)}. ${q.options[a.value] ?? ''}` : String(a.value ?? '');
    const g = graded || (typeof a.correct === 'boolean' ? { correct: a.correct, feedback: a.feedback || '' } : null);
    const expected = q.answer ?? o.expected;
    const exp = expected === undefined || expected === '' ? '' : isChoice && Number.isInteger(expected) ? `${letter(expected)}. ${q.options[expected] ?? ''}` : String(expected);
    return `<div class="ln-answered${g ? (g.correct ? ' is-right' : ' is-wrong') : ''}">
      <p><span class="ln-k">${L('你的回答', 'Your answer')}</span>${val ? X(val) : L('（空着）', '(left blank)')} <span class="ln-conf-tag" data-c="${esc(a.confidence)}">${L(...CONF.find(([k]) => k === a.confidence)?.slice(1) || ['大概', 'Fairly sure'])}</span></p>
      ${a.thinking ? `<p class="ln-thinking"><span class="ln-k">${L('你的想法', 'Your thinking')}</span>${X(a.thinking)}</p>` : ''}
      ${g ? `<p class="ln-verdict"><b>${g.correct ? (a.confidence === 'guess' ? L('答对了，但是猜的', 'Right, but a guess') : L('答对了', 'Right')) : L('还没对', 'Not yet')}</b>${g.feedback ? ` ${X(g.feedback)}` : ''}</p>` : `<p class="ln-verdict muted">${L('等待评分', 'Waiting for grading')}</p>`}
      ${g?.misconception ? `<p class="ln-miscon"><span class="ln-k">${L('可能的误解', 'Likely misconception')}</span>${X(g.misconception)}</p>` : ''}
      ${g && exp && o.showExpected !== false ? `<p class="ln-expected"><span class="ln-k">${L('参考答案', 'Model answer')}</span>${X(exp)}</p>` : ''}
    </div>`;
  }
  // 讲解：ChemAI.markdown 先转义再排版（[n] 只连到会话里存的目录条目）；没有它就按段落转义
  // 模型写的 [文字](网址) 不做成链接，只留文字和网站名：可点的只有会话自己的 [n] 目录条目和白名单里的站内演示
  const unlink = (text) => String(text || '').replace(/\[([^\]\n]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, label, url) => {
    let host = '';
    try { host = new URL(url).host; } catch { host = ''; }
    return host ? `${label} (${host})` : label;
  });
  function prose(text, refs) {
    const md = ai()?.markdown;
    const plain = unlink(text);
    const html = md ? md(plain, refs || []) : plain.split(/\n{2,}|\n/).filter((x) => x.trim()).map((p) => `<p>${esc(p)}</p>`).join('');
    return `<div class="ln-prose" translate="no">${html}</div>`;
  }
  const refList = (sess, nums) => {
    const refs = sess.refs || [];
    const list = (nums || []).map((n) => [n, refs[n - 1]]).filter(([, r]) => r);
    if (!list.length) return '';
    return `<ol class="ln-refs">${list.map(([n, r]) => `<li value="${n}"><a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer" translate="no">${esc(r.title)} ${ico()}</a>${r.sources?.length ? `<small>${r.sources.map((x) => `<span>${esc(x)}</span>`).join(' · ')}</small>` : ''}</li>`).join('')}</ol>`;
  };
  const demoCard = (id) => {
    const d = S.demo(id);
    if (!d) return '';
    return `<a class="ln-demo" href="${esc(d.href)}"><span class="ln-k">${L('在站内动手试试', 'Try it on the site')}</span><b>${esc(t(d.label.zh, d.label.en))}</b><span class="muted">${esc(t(d.desc.zh, d.desc.en))}</span>${ico()}</a>`;
  };

  // ── 学习 ──────────────────────────────────────────────────────────────
  const PHASE = { probe: ['摸底', 'Probe'], plan: ['路线', 'Map'], teach: ['学习中', 'Learning'], done: ['已完成', 'Done'], practice: ['进行中', 'In progress'] };
  const phaseText = (p) => t(...(PHASE[p] || PHASE.probe));
  const usageText = (u) => {
    if (!u?.calls) return t('还没有调用 AI', 'No AI calls yet');
    const cost = u.cost > 0 ? `$${u.cost < 0.01 ? u.cost.toFixed(4) : u.cost.toFixed(3)}` : '';
    return `${t(`${u.calls} 次调用`, `${u.calls} call${u.calls > 1 ? 's' : ''}`)} · ${fmtNum(u.tokens)} token${cost ? ` · ${t('约', '≈')} ${cost}` : ''}${u.unpriced ? ` · ${u.cost > 0 ? t('部分未计价', 'partly unpriced') : t('未计价', 'not priced')}` : ''}`;
  };
  function sessionList() {
    const list = state.sessions.filter((s) => s.kind === 'learn');
    const items = list.map((s) => {
      const pr = C.planProgress(s.plan);
      return `<li${s.id === openLearn ? ' aria-current="true"' : ''}><a href="#s-${esc(s.id)}" class="ln-sess">${X(s.title, 'b')}<span class="ln-sess-meta"><span class="ln-phase" data-p="${s.phase}">${esc(phaseText(s.phase))}</span>${pr.total ? `<span translate="no">${pr.done}/${pr.total}</span>` : ''}<span translate="no">${esc(fmtDate(s.updated))}</span></span></a>
        <button type="button" class="ln-x" data-act="del-session" data-id="${esc(s.id)}" title="${esc(t('删除这次学习', 'Delete this session'))}"${dis()}><span aria-hidden="true">×</span><span class="sr-only">${L('删除', 'Delete')}</span></button></li>`;
    }).join('');
    return `<aside class="ln-side" aria-labelledby="ln-side-h">
      <div class="ln-side-head"><h2 id="ln-side-h">${L('我的学习', 'My sessions')}</h2><a class="button small${openLearn ? '' : ' primary'}" href="#learn">${L('新的学习', 'New session')}</a></div>
      ${items ? `<ul class="ln-sess-list">${items}</ul>` : `<p class="muted ln-empty">${L('还没有学习记录。写下一个目标，从摸底开始。', 'No sessions yet. Write a goal and start with the probe.')}</p>`}
    </aside>`;
  }
  function renderLearn() {
    const sess = openLearn ? sessionById(openLearn) : null;
    if (openLearn && !sess) openLearn = null;
    panel.innerHTML = `<div class="ln-learn">${sessionList()}<div class="ln-main" id="ln-learn-main">${sess ? sessionView(sess) : newForm()}</div></div>`;
    if (sess) afterSessionRender(sess);
  }

  // 新会话表单
  function newForm() {
    const src = form.srcId ? S.sources.find((s) => s.id === form.srcId) : null;
    const chs = src ? S.chapters(src.id) : [];
    const ch = chs.find((c) => c.id === form.chId);
    const accept = [...C.FILE_RULES.ext.map((e) => `.${e}`), 'image/*'].join(',');
    return `<article class="ln-card ln-new" aria-labelledby="ln-new-h">
      <h2 id="ln-new-h">${L('这次想弄懂什么？', 'What do you want to understand?')}</h2>
      <label class="ln-field"><span>${L('学习目标', 'Goal')}</span><textarea id="ln-goal" rows="3" data-form="goal" translate="no" placeholder="${esc(t('我想弄懂……（比如：为什么氢原子的能级只和主量子数有关）。也可以直接粘贴题目或课本的照片', 'I want to understand… (e.g. why hydrogen levels depend only on the principal quantum number). You can also paste a photo of a problem or a textbook page'))}">${esc(form.goal)}</textarea></label>
      <fieldset class="ln-src"><legend>${L('从站内章节开始（可选）', 'Start from a MolAstria chapter (optional)')}</legend>
        <p class="muted">${L('选一章，它核对过的讲解、误区和自测会作为 AI 的依据。', 'Pick a chapter; its checked explanation, pitfalls and self-checks become the AI’s grounding.')}</p>
        <div class="ln-row">
          <label class="ln-field ln-inline"><span class="sr-only">${L('栏目', 'Section')}</span><select id="ln-src" data-form="src"><option value="">${esc(t('选一个栏目', 'Choose a section'))}</option>${S.sources.map((s) => `<option value="${s.id}"${s.id === form.srcId ? ' selected' : ''}>${esc(t(s.label.zh, s.label.en))}</option>`).join('')}</select></label>
          <label class="ln-field ln-inline"><span class="sr-only">${L('章节', 'Chapter')}</span><select id="ln-ch" data-form="ch"${src && chs.length ? '' : ' disabled'}><option value="">${esc(src && !chs.length ? t('载入中…', 'Loading…') : t('选一章', 'Choose a chapter'))}</option>${chs.map((c) => `<option value="${esc(c.id)}"${c.id === form.chId ? ' selected' : ''}>${esc(t(c.name.zh, c.name.en))}</option>`).join('')}</select></label>
        </div>
        ${ch ? `<div class="ln-chip-src"><span>${L('依据', 'Grounding')}</span><b translate="no">${esc(t(ch.name.zh, ch.name.en))}</b>${ch.blurb ? X(t(ch.blurb.zh, ch.blurb.en), 'small', 'muted') : ''}<a href="${esc(ch.href)}" target="_blank" rel="noopener">${L('打开这一章', 'Open the chapter')} ${ico()}</a><button type="button" class="text-button" data-act="src-clear">${L('不用了', 'Remove')}</button></div>` : ''}
      </fieldset>
      <fieldset class="ln-files"><legend>${L('附带文件（可选）', 'Attach files (optional)')}</legend>
        <p class="muted">${L(`纯文本文件（${C.FILE_RULES.ext.join(' ')}），每个不超过 60 KB；或者照片和截图（一次最多 4 张，也可以直接粘贴到上面的学习目标里）。合计最多 3 项，内容会随请求发给 AI。照片先由能看图的模型读成文字，你可以核对、修改，之后只发这段文字。`, `Plain-text files (${C.FILE_RULES.ext.join(' ')}), up to 60 KB each, or photos and screenshots (up to 4 at a time; you can also paste them into the goal above). At most 3 items in all; their contents go to the AI with each request. A model that reads images first turns photos into text, which you can check and edit; after that only the text is sent.`)}</p>
        <div class="ln-row"><label class="button small ln-file-btn"><input type="file" id="ln-files" accept="${accept}" multiple class="sr-only"${form.files.length >= C.FILE_RULES.max || job ? ' disabled' : ''}>${L('选择文件', 'Choose files')}</label><label class="button small ln-file-btn"><input type="file" id="ln-photos" accept="image/*" multiple class="sr-only"${form.files.length >= C.FILE_RULES.max || job ? ' disabled' : ''}>${L('拍照或选照片', 'Take or choose photos')}</label></div>
        ${form.files.length ? `<ul class="ln-file-list">${form.files.map((f, i) => f.photo ? `<li class="ln-photo"><span class="ln-thumbs">${f.thumbs.map((u, k) => `<img src="${esc(u)}" alt="${esc(t(`照片 ${k + 1}`, `Photo ${k + 1}`))}">`).join('')}</span>${X(f.name)}${f.reading ? `<small>${L('识读中…', 'Reading…')}</small>` : '<small></small>'}<button type="button" class="ln-x" data-act="file-remove" data-i="${i}"${f.reading ? ' disabled' : ''}><span aria-hidden="true">×</span><span class="sr-only">${L('移除', 'Remove')}</span></button>
          ${f.reading ? '' : `<details class="ln-photo-text"><summary>${L('看 AI 读出的文字（可以改）', 'See the text the AI read (editable)')}</summary><label class="ln-field"><span class="sr-only">${L('照片里的文字', 'Text from the photos')}</span><textarea rows="8" data-photo-text="${i}" translate="no">${esc(f.text)}</textarea></label></details>`}</li>`
          : `<li>${X(f.name)}<small translate="no">${(f.size / 1024).toFixed(1)} KB</small><button type="button" class="ln-x" data-act="file-remove" data-i="${i}"><span aria-hidden="true">×</span><span class="sr-only">${L('移除', 'Remove')}</span></button></li>`).join('')}</ul>` : ''}
      </fieldset>
      ${form.msg ? `<p class="ln-hint-msg" role="alert">${esc(form.msg)}</p>` : ''}
      <div class="ln-row ln-actions"><button type="button" class="button primary" data-act="new"${dis()}>${L('开始：先摸底', 'Start with the probe')} ${ico('right')}</button></div>
      ${jobBox('new')}
      <p class="ln-small muted">${L('发给 AI 的有：目标、所选章节的文字、附带文件、你在知识图里相关的命题和你的回答。会话、知识图和提示词只存在这台设备的浏览器里。', 'Sent to the AI: the goal, the chosen chapter’s text, attached files, related claims from your knowledge graph and your answers. Sessions, the graph and prompts stay in this browser on this device.')}</p>
    </article>`;
  }
  // #goal=qp:birth → 预填
  async function prefill(ref) {
    const r = S.parseRef(ref);
    form.chId = ''; form.source = null; form.msg = '';
    if (form.goal === form.autoGoal) { form.goal = ''; form.autoGoal = ''; }
    if (!r) { form.srcId = ''; form.msg = t('这个链接里的章节认不出来，请在下面自己选一章。', 'The chapter in that link was not recognised; choose one below.'); if (tab === 'learn' && !openLearn) render(); return; }
    form.srcId = r.source;
    try {
      const ch = await S.find(r.source, r.chapter);
      if (ch) chooseChapter(ch);
      else form.msg = t('没有找到链接里的那一章（可能改了名），请在下面自己选一章。', 'The chapter in that link was not found (it may have been renamed); choose one below.');
    } catch (e) { form.msg = errText(e); }
    if (tab === 'learn' && !openLearn) render();
  }
  function chooseChapter(ch) {
    form.chId = ch.id;
    form.source = { type: 'chapter', ref: `${form.srcId}:${ch.id}`, label: `${t(S.sources.find((s) => s.id === form.srcId)?.label.zh || '', S.sources.find((s) => s.id === form.srcId)?.label.en || '')} · ${t(ch.name.zh, ch.name.en)}` };
    const auto = t(`弄懂「${ch.name.zh}」这一章的核心思路`, `Understand the core ideas of “${ch.name.en}”`);
    if (!form.goal.trim() || form.goal === form.autoGoal) { form.goal = auto; form.autoGoal = auto; }
  }
  async function loadSource(id) {
    form.srcId = id; form.chId = ''; form.source = null;
    if (form.goal === form.autoGoal) { form.goal = ''; form.autoGoal = ''; }
    render();
    if (!id) return;
    try { await S.load(id); form.msg = ''; } catch (e) { form.msg = errText(e); }
    if (tab === 'learn' && !openLearn) render();
  }
  async function addFiles(list) {
    form.msg = '';
    const photos = list.filter((f) => /^image\//i.test(f.type) || /\.(jpe?g|png|gif|webp|heic|heif)$/i.test(f.name));
    if (photos.length) { await addPhotos(photos); list = list.filter((f) => !photos.includes(f)); if (!list.length) return; }
    for (const f of list) {
      const ok = C.acceptFile(f.name, f.size, form.files.length);
      if (!ok.ok) {
        form.msg = ok.reason === 'type' ? t(`“${f.name}”不是支持的文本格式。`, `“${f.name}” is not a supported text format.`)
          : ok.reason === 'size' ? t(`“${f.name}”超过 60 KB。`, `“${f.name}” is larger than 60 KB.`)
            : t('最多附带 3 个文件。', 'At most 3 files.');
        continue;
      }
      try { form.files.push({ name: f.name, size: f.size, text: await f.text() }); } catch { form.msg = t(`读不了“${f.name}”。`, `Could not read “${f.name}”.`); }
    }
    render();
  }

  // 照片：先缩小，再让能看图的模型读成文字（transcript）；之后它和文本文件一样随请求发出，照片本身不保存。
  let photoSeq = 0;
  async function addPhotos(list) {
    const A = ai();
    form.msg = '';
    if (!A?.readImage) { form.msg = t('AI 模块没有载入，请刷新页面。', 'The AI module did not load; reload the page.'); render(); return; }
    if (form.files.length >= C.FILE_RULES.max) { form.msg = t('最多附带 3 项。', 'At most 3 items.'); render(); return; }
    if (blocked() || !needAI()) return;
    if (!A.visionModel()) { form.msg = t('现在选的 AI 服务不能看图。在 AI 设置里换成 DeepSeek V4 Flash、Meta Muse Spark 或 MolAstria 托管额度再试。', 'The AI service you chose cannot read images. Switch to DeepSeek V4 Flash, Meta Muse Spark or the MolAstria hosted allowance in the AI settings.'); render(); return; }
    if (list.length > A.MAX_IMAGES) form.msg = t(`一次最多 ${A.MAX_IMAGES} 张照片，先读前 ${A.MAX_IMAGES} 张。`, `Up to ${A.MAX_IMAGES} photos at a time; reading the first ${A.MAX_IMAGES}.`);
    const entry = { name: '', size: 0, text: '', photo: true, thumbs: [], reading: true };
    await run('new', async () => { try {
      jobLabel(t('正在读取照片…', 'Loading the photos…'));
      const imgs = [];
      for (const f of list.slice(0, A.MAX_IMAGES)) imgs.push(await A.readImage(f));
      photoSeq++;
      Object.assign(entry, { name: imgs.length > 1 ? t(`照片 ${photoSeq}（${imgs.length} 张，AI 识读）`, `Photos ${photoSeq} (${imgs.length}, read by AI)`) : t(`照片 ${photoSeq}（AI 识读）`, `Photo ${photoSeq} (read by AI)`), thumbs: imgs.map((x) => x.thumb) });
      form.files.push(entry);
      render();
      const j = await call('new', t('AI 正在读照片…', 'The AI is reading the photos…'), C.buildPhoto({ goal: form.goal.trim(), images: imgs.map((x) => x.url), lang: aiLang, prompts }), null, 4000);
      const p = C.parsePhoto(j);
      Object.assign(entry, { text: p.transcript, size: p.transcript.length, reading: false });
      if (!form.goal.trim() && p.goal) form.goal = form.autoGoal = p.goal;
    } catch (err) {
      // 没读成：去掉这一项（“重试”会重新读）
      const i = form.files.indexOf(entry);
      if (i >= 0) form.files.splice(i, 1);
      throw err;
    } });
  }

  // 依据：所选章节的文字 + 目录检索到的资源（[n]），按会话缓存
  const groundCache = new Map();
  async function chapterOf(sess) {
    const r = sess.source?.type === 'chapter' ? S.parseRef(sess.source.ref) : null;
    if (!r) return null;
    try { return await S.find(r.source, r.chapter); } catch { return null; }
  }
  async function grounding(sess) {
    if (groundCache.has(sess.id)) return groundCache.get(sess.id);
    const ch = await chapterOf(sess);
    const g = { chapter: ch, text: C.buildGrounding(ch ? ch.text(aiLang) : '', sess.refs || [], 6000) };
    groundCache.set(sess.id, g);
    return g;
  }
  const heldFor = (about) => C.relatedProps(state, about, 12).map((p) => p.text);

  async function startSession() {
    const goal = form.goal.trim();
    if (!goal) { form.msg = t('先写下学习目标。', 'Write a goal first.'); render(); $('#ln-goal')?.focus(); return; }
    if (blocked() || !needAI()) return;
    const files = form.files.filter((f) => !f.reading && f.text.trim()).map((f) => ({ name: f.name, size: f.photo ? f.text.length : f.size, text: f.text }));
    const sess = C.createSession(state, { kind: 'learn', goal, title: form.source && form.goal === form.autoGoal ? form.source.label.split(' · ').pop() : '', source: form.source || { type: 'free' }, files });
    save();
    Object.assign(form, { goal: '', autoGoal: '', srcId: '', chId: '', source: null, files: [], msg: '' });
    openLearn = sess.id;
    history.replaceState(null, '', `#s-${sess.id}`);
    render();
    await run(sess.id, () => doProbe(sess));
  }
  async function doProbe(sess) {
    if (!sess.refs && !sess.probe.questions.length) {
      // 站内目录里和目标相关的资源，AI 可以按 [n] 引用（可选：载入失败就不引用）
      jobLabel(t('正在查站内目录…', 'Searching the site catalogue…'));
      const signal = job.ctrl.signal;
      try {
        const refs = await abortable(ai().retrieve(sess.goal, 5), signal);
        if (refs?.length) sess.refs = migrate({ sessions: [{ id: 'x', refs }] }).sessions[0].refs;
      } catch (e) { if (e?.name === 'AbortError') throw e; /* 目录检索可选 */ }
      if (signal.aborted) throw abortErr();
      groundCache.delete(sess.id);
      save();
    }
    const g = await grounding(sess);
    const msgs = C.buildProbe({ goal: sess.goal, grounding: g.text, held: heldFor(sess.goal), files: sess.files, lang: aiLang, prompts });
    const j = await call(sess.id, t('正在出摸底题…', 'Writing the probe…'), msgs, sess);
    const p = C.parseProbe(j);
    sess.probe = { questions: p.questions, answers: {}, goalRestated: p.goalRestated };
    sess.phase = 'probe';
    touch(sess); save();
    focusAfter = '#ln-probe-h';
    announce(t(`摸底题来了：${p.questions.length} 道`, `${p.questions.length} probe questions are ready`));
  }
  async function submitProbe(sess) {
    const answers = {};
    let firstBad = null;
    for (const q of sess.probe.questions) {
      const a = readDraft(`${sess.id}:${q.id}`, q, { allowBlank: true });
      if (!a) { firstBad ||= q.id; continue; }
      const local = C.gradeChoice(q, a.value);
      if (local !== null && a.value !== '') a.correct = local;
      if (a.value === '') a.correct = false;
      answers[q.id] = a;
    }
    if (firstBad) { $(`#q-${safeId(`${sess.id}:${firstBad}`)}`)?.scrollIntoView({ block: 'center' }); return; }
    if (blocked() || !needAI()) return;
    sess.probe.answers = answers;
    touch(sess); save();
    await run(sess.id, () => doPlan(sess));
  }
  async function doPlan(sess) {
    const g = await grounding(sess);
    const held = heldFor(`${sess.goal} ${sess.probe.goalRestated || ''}`);
    const msgs = C.buildPlan({ goal: sess.goal, grounding: g.text, held, probe: sess.probe, files: sess.files, lang: aiLang, prompts });
    const j = await call(sess.id, t('正在画路线…', 'Drawing the map…'), msgs, sess);
    const p = C.parsePlan(j, { heldTexts: held });
    for (const gr of p.grades) {
      const a = sess.probe.answers[gr.id];
      if (!a) continue;
      if (typeof a.correct !== 'boolean' || sess.probe.questions.find((q) => q.id === gr.id)?.kind !== 'choice') a.correct = gr.correct;
      if (gr.feedback) a.feedback = gr.feedback;
    }
    sess.plan = C.prunePlan({ nodes: p.nodes, goalId: p.goalId });
    sess.startNote = p.startNote;
    sess.current = null;
    sess.phase = 'plan';
    touch(sess); save();
    focusAfter = '#ln-plan-h';
    announce(t('路线画好了', 'The map is ready'));
  }
  async function startTeach(sess) {
    if (blocked() || !needAI()) return;
    sess.phase = 'teach';
    touch(sess); save();
    await run(sess.id, () => doTeach(sess));
  }
  // 一次调用：给上一道检查题评分，并写下一步（或者目标已达成）
  async function doTeach(sess) {
    const pending = [...sess.steps].reverse().find((s) => s.check && s.answer && !s.graded) || null;
    let nodeId = sess.current && nodeOf(sess, sess.current) && nodeOf(sess, sess.current).status !== 'done' ? sess.current : C.nextNode(sess.plan);
    // 路线已经走完：只有还没学会的节点才回去评它的检查题；学会了的节点不再改回“学习中”
    if (pending && !nodeId && nodeOf(sess, pending.nodeId) && nodeOf(sess, pending.nodeId).status !== 'done') nodeId = pending.nodeId;
    if (!nodeId) {
      const local = pending ? C.gradeChoice(pending.check, pending.answer.value) : null;
      if (local !== null) { pending.graded = { correct: local, feedback: '' }; pending.answer.correct = local; }
      await doSummary(sess);
      return;
    }
    if (nodeOf(sess, nodeId)?.status !== 'doing') sess.plan = C.setNodeStatus(sess.plan, nodeId, 'doing');
    sess.current = nodeId;
    const g = await grounding(sess);
    const node = nodeOf(sess, nodeId);
    const demos = S.matchDemos(`${sess.goal} ${node?.label || ''} ${node?.detail || ''}`, 6, g.chapter?.demos || []);
    const o = { session: sess, node: nodeId, lastStep: pending, held: heldFor(`${node?.label || ''} ${sess.goal}`), grounding: g.text, demos, files: sess.files, lang: aiLang, prompts };
    const msgs = C.buildTeach(o), ctx = C.teachContext(o);
    const j = await call(sess.id, pending ? t('正在评分并写下一步…', 'Grading and writing the next step…') : t('正在写这一步…', 'Writing the step…'), msgs, sess);
    const res = C.parseStep(j, { nodeId: ctx.nodeId, nextId: ctx.nextId, demoIds: demos.map((d) => d.id), refCount: (sess.refs || []).length, lastConfidence: ctx.lastConfidence, localCorrect: ctx.localCorrect, needGrade: !!pending && ctx.localCorrect === null, id: C.newId('st', sess.steps.map((s) => s.id)) });
    if (pending) {
      // 没有本地答案的简答题，parseStep 要求模型评分（没评就报错重试），所以这里没有“默认算对”
      pending.graded = res.grade || { correct: ctx.localCorrect === true, feedback: '' };
      pending.answer.correct = pending.graded.correct;
    }
    if (res.planPatch) sess.plan = C.applyPlanPatch(sess.plan, res.planPatch);
    if (res.nodeDone) sess.plan = C.setNodeStatus(sess.plan, ctx.nodeId, 'done');
    if (res.step) {
      // 模型补了一个前置节点并说先讲它：只要它在路线上、前置都满足，就照办
      const named = j?.step?.node;
      const nn = named && res.step.kind !== 'repair' ? nodeOf(sess, String(named)) : null;
      if (nn && nn.id !== res.step.nodeId && nn.status !== 'done' && nn.status !== 'held' && nn.deps.every((d) => ['held', 'done'].includes(nodeOf(sess, d)?.status ?? 'done'))) res.step.nodeId = nn.id;
      if (!nodeOf(sess, res.step.nodeId)) res.step.nodeId = ctx.nodeId || res.step.nodeId;
      sess.steps.push(res.step);
      if (nodeOf(sess, res.step.nodeId)?.status !== 'done') sess.plan = C.setNodeStatus(sess.plan, res.step.nodeId, 'doing');
      sess.current = res.step.nodeId;
      touch(sess); save();
      focusAfter = `#step-${safeId(res.step.id)}`;
      announce(res.step.kind === 'repair' ? t('换个角度再讲一次', 'A repair step from another angle') : t('下一步来了', 'Next step is ready'));
    } else {
      sess.current = null;
      touch(sess); save();
      await doSummary(sess);
    }
  }
  async function doSummary(sess) {
    const j = await call(sess.id, t('目标达成，正在总结…', 'Goal reached, summing up…'), C.buildSummary({ session: sess, lang: aiLang, prompts }), sess);
    const s = C.parseSummary(j);
    sess.summary = { goalSentence: s.goalSentence, props: s.props, chains: s.chains };
    const goal = sess.plan.goalId;
    if (goal && nodeOf(sess, goal)?.status !== 'done') sess.plan = C.setNodeStatus(sess.plan, goal, 'done');
    sess.current = null;
    sess.phase = 'done';
    touch(sess); save();
    focusAfter = '#ln-summary';
    announce(t('学完了：看看总结，选好要加入知识图的命题', 'Done: review the summary and pick what goes into your knowledge graph'));
  }
  let focusAfter = null;

  async function submitCheck(sess, stepId) {
    const step = sess.steps.find((s) => s.id === stepId);
    if (!step?.check || step.answer || blocked()) return;
    const a = readDraft(`${sess.id}:${step.id}`, step.check);
    if (!a) return;
    if (!needAI()) return;
    step.answer = a;
    const local = C.gradeChoice(step.check, a.value);
    if (local !== null) a.correct = local;
    touch(sess); save();
    await run(sess.id, () => doTeach(sess));
  }

  function phaseBar(sess) {
    const order = ['probe', 'plan', 'teach', 'done'];
    const at = order.indexOf(sess.phase);
    return `<ol class="ln-phases" aria-label="${esc(t('进度', 'Progress'))}">${order.map((p, i) => `<li${i < at ? ' data-done' : ''}${i === at ? ' aria-current="step"' : ''}>${L(...PHASE[p])}</li>`).join('')}</ol>`;
  }
  function sessionView(sess) {
    const src = sess.source?.type === 'chapter' ? S.parseRef(sess.source.ref) : null;
    const srcLink = src ? `<a class="ln-src-link" href="${esc(S.link(`${S.sources.find((s) => s.id === src.source)?.page}#${S.sources.find((s) => s.id === src.source)?.anchor}${src.chapter}`))}" target="_blank" rel="noopener">${L('依据', 'Grounding')}: <span translate="no">${esc(sess.source.label || sess.source.ref)}</span> ${ico()}</a>` : '';
    let body = '';
    if (sess.phase === 'probe') body = probeView(sess);
    else if (sess.phase === 'plan') body = planView(sess);
    else if (sess.phase === 'teach') body = teachView(sess);
    else body = doneView(sess);
    return `<header class="ln-shead">
        <h2>${X(sess.title)}</h2>
        <p class="ln-goal">${X(sess.goal)}</p>
        <div class="ln-row ln-smeta">${srcLink}${sess.files.length ? `<span class="ln-tag">${L(`附带 ${sess.files.length} 个文件`, `${sess.files.length} file${sess.files.length > 1 ? 's' : ''} attached`)}</span>` : ''}<span class="ln-usage">${esc(usageText(sess.usage))}</span></div>
        ${phaseBar(sess)}
      </header>${body}`;
  }
  function probeView(sess) {
    const qs = sess.probe.questions;
    if (!qs.length) {
      return `<section class="ln-card"><h3>${L('摸底', 'Probe')}</h3><p class="muted">${L('先问几道题，看看你已经会什么。', 'A few questions first, to see what you already hold.')}</p>
        ${jobBox(sess.id) || `<button type="button" class="button primary" data-act="probe-again" data-id="${esc(sess.id)}"${dis()}>${L('出摸底题', 'Write the probe')}</button>`}</section>`;
    }
    // 已经交过（比如画路线时刷新了页面）：答案存在会话里，填回答题框
    for (const q of qs) {
      const key = `${sess.id}:${q.id}`, a = sess.probe.answers[q.id];
      if (!a || drafts[key]) continue;
      const blank = a.value === '' || a.value === undefined;
      drafts[key] = { value: blank ? undefined : a.value, confidence: blank ? '' : a.confidence, thinking: a.thinking || '' };
    }
    return `<section class="ln-probe" aria-labelledby="ln-probe-h">
      <h3 id="ln-probe-h" tabindex="-1">${L('先摸底', 'Probe first')}</h3>
      <p class="muted">${L('这些题测的是目标依赖的东西，不打分，只为看清起点。不会的可以空着；“有多确定”和“怎么想的”比答案本身更有用。', 'These questions test what the goal depends on. Nothing is scored; they only find your starting point. Leave one blank if you don’t know; “how sure” and “how you thought” matter more than the answer.')}</p>
      ${sess.probe.goalRestated ? `<p class="ln-target"><span class="ln-k">${L('目标', 'Goal')}</span>${X(sess.probe.goalRestated)}</p>` : ''}
      <ol class="ln-qs">${qs.map((q, i) => `<li class="ln-card ln-q" id="q-${safeId(`${sess.id}:${q.id}`)}"><p class="ln-qn" aria-hidden="true">${i + 1}</p><div class="ln-qbody">${X(q.prompt, 'p', 'ln-qtext')}${answerBlock(`${sess.id}:${q.id}`, q)}</div></li>`).join('')}</ol>
      <div class="ln-row ln-actions"><button type="button" class="button primary" data-act="probe-submit" data-id="${esc(sess.id)}"${dis()}>${L('交卷，画路线', 'Submit and draw the map')} ${ico('right')}</button></div>
      ${jobBox(sess.id)}
    </section>`;
  }
  function calibrationNote(answers) {
    const c = C.calibration(answers);
    if (!c.n) return '';
    const bits = [t(`${c.n} 题里答对 ${c.correct} 题`, `${c.correct} of ${c.n} right`)];
    if (c.overconfident) bits.push(t(`${c.overconfident} 题“确定”却答错了`, `${c.overconfident} wrong while “sure”`));
    if (c.underconfident) bits.push(t(`${c.underconfident} 题是猜对的`, `${c.underconfident} right by a guess`));
    return `<p class="ln-calib">${esc(bits.join(t('；', '; ')))}${c.overconfident ? ` ${L('——确定却错的地方最值得补。', '— being sure and wrong is the most useful thing to fix.')}` : ''}</p>`;
  }
  const legend = () => `<ul class="ln-legend" aria-label="${esc(t('图例', 'Legend'))}">${['held', 'todo', 'doing', 'done', 'shaky'].map((s) => `<li><span class="ln-sw" data-st="${s}" aria-hidden="true"></span>${esc(G.statusText(s, lang))}</li>`).join('')}</ul>`;
  function nodeList(sess, editable) {
    const order = C.topoOrder(sess.plan);
    return `<ol class="ln-nodes">${order.map((id) => {
      const n = nodeOf(sess, id);
      const goal = id === sess.plan.goalId;
      return `<li data-st="${n.status}"${planSel === id ? ' class="is-sel"' : ''}><span class="ln-sw" data-st="${n.status}" aria-hidden="true"></span><div><b translate="no">${esc(n.label)}</b>${goal ? `<span class="ln-tag gold">${L('目标', 'Goal')}</span>` : ''}<span class="ln-st">${esc(G.statusText(n.status, lang))}</span>${n.detail ? X(n.detail, 'p', 'muted') : ''}</div>
        ${editable && !goal ? `<button type="button" class="text-button" data-act="node-toggle" data-id="${esc(id)}"${dis()}>${n.status === 'held' ? L('改回待学', 'Teach this') : L('我已经会了', 'I know this')}</button>` : ''}</li>`;
    }).join('')}</ol>`;
  }
  function probeReview(sess) {
    const qs = sess.probe.questions;
    if (!qs.length) return '';
    return `<details class="ln-card ln-review"><summary>${L('摸底题的结果', 'Probe results')}</summary>
      ${calibrationNote(sess.probe.answers)}
      <ol class="ln-qs">${qs.map((q) => `<li>${X(q.prompt, 'p', 'ln-qtext')}${answeredView(q, sess.probe.answers[q.id] || { value: '', confidence: 'guess', thinking: '' })}</li>`).join('')}</ol></details>`;
  }
  function planView(sess) {
    return `<section class="ln-plan" aria-labelledby="ln-plan-h">
      <h3 id="ln-plan-h" tabindex="-1">${L('学习路线', 'Your map')}</h3>
      ${sess.startNote ? `<p class="ln-target">${X(sess.startNote)}</p>` : ''}
      ${calibrationNote(sess.probe.answers)}
      <div class="ln-card ln-mapcard"><div class="ln-map"><svg id="ln-plan-svg"></svg></div>${legend()}</div>
      <p class="muted ln-small">${L('灰色虚线的是你已经掌握的，不再讲；点节点看说明。觉得哪一项其实已经会了，可以在下面标出来。', 'Dashed grey nodes are what you already hold and are skipped; click a node for details. Mark anything below that you already know.')}</p>
      ${nodeList(sess, true)}
      <div class="ln-row ln-actions"><button type="button" class="button primary" data-act="teach-start" data-id="${esc(sess.id)}"${dis()}>${L('开始学习', 'Start learning')} ${ico('right')}</button>
        <button type="button" class="button" data-act="plan-again" data-id="${esc(sess.id)}"${dis()}>${L('重新画路线', 'Redraw the map')}</button></div>
      ${jobBox(sess.id)}
      ${probeReview(sess)}
    </section>`;
  }
  function stepCard(sess, step, i, isLast) {
    const node = nodeOf(sess, step.nodeId);
    const key = `${sess.id}:${step.id}`;
    const predictOpen = step.predict && !step.predictAnswer;
    const kindTag = step.kind === 'repair' ? `<span class="ln-tag warn">${L('换个角度', 'Repair')}</span>` : '';
    let inner = '';
    if (predictOpen) {
      const d = draft(`${key}:p`);
      inner = `<div class="ln-predict"><p class="ln-k">${L('你先猜一猜', 'Guess first')}</p>${X(step.predict, 'p', 'ln-qtext')}
        <label class="ln-field"><span class="sr-only">${L('你的猜测', 'Your guess')}</span><span class="ln-with-mic"><textarea id="p-${safeId(key)}" rows="2" data-draft="${esc(`${key}:p`)}" data-field="value" translate="no" placeholder="${esc(t('写下你的猜测，再看讲解', 'Write your guess, then read on'))}">${esc(typeof d.value === 'string' ? d.value : '')}</textarea>${micBtn(`p-${safeId(key)}`)}</span></label>
        <div class="ln-row"><button type="button" class="button small primary" data-act="reveal" data-id="${esc(step.id)}">${L('写好了，看讲解', 'Show the explanation')}</button><button type="button" class="text-button" data-act="reveal" data-skip data-id="${esc(step.id)}">${L('跳过', 'Skip')}</button></div></div>`;
    } else {
      const pred = step.predict ? `<div class="ln-predict done"><p class="ln-k">${L('先猜一猜', 'The guess')}</p>${X(step.predict, 'p')}${step.predictAnswer?.value ? `<p><span class="ln-k">${L('你猜', 'You guessed')}</span>${X(step.predictAnswer.value)}</p>` : ''}</div>` : '';
      inner = `${pred}${prose(step.explain, sess.refs)}<div class="ln-dg" data-dg="${esc(step.id)}"></div>${step.demo ? demoCard(step.demo) : ''}${refList(sess, step.refs)}`;
      if (step.check) {
        inner += `<div class="ln-check" id="chk-${safeId(key)}"><p class="ln-k">${L('检查一下', 'Check')}</p>${X(step.check.prompt, 'p', 'ln-qtext')}`;
        if (step.answer) inner += answeredView(step.check, step.answer, step.graded, { showExpected: !!step.graded });
        else inner += `${answerBlock(key, step.check)}<div class="ln-row"><button type="button" class="button primary" data-act="check-submit" data-id="${esc(step.id)}"${dis()}>${L('提交', 'Submit')}</button></div>`;
        inner += '</div>';
      }
      if (step.props?.length) inner += `<details class="ln-props"><summary>${L('这一步确立的命题', 'Claims this step establishes')}</summary><ul>${step.props.map((p) => X(p, 'li')).join('')}</ul></details>`;
    }
    return `<article class="ln-card ln-step${step.kind === 'repair' ? ' is-repair' : ''}${isLast ? ' is-last' : ''}" id="step-${safeId(step.id)}" tabindex="-1" aria-labelledby="sh-${safeId(step.id)}">
      <header class="ln-step-h" id="sh-${safeId(step.id)}"><span class="ln-stepn" translate="no">${i + 1}</span>${node ? X(node.label, 'b') : ''}${kindTag}</header>${inner}</article>`;
  }
  function mapBox(sess) {
    const pr = C.planProgress(sess.plan);
    const pct = pr.total ? Math.round((pr.done / pr.total) * 100) : 0;
    return `<details class="ln-card ln-mapbox" id="ln-mapbox"${mapOpen ? ' open' : ''}><summary><span>${L('路线', 'Map')}</span><span class="ln-prog" role="progressbar" aria-valuemin="0" aria-valuemax="${pr.total}" aria-valuenow="${pr.done}" aria-label="${esc(t('已学会的节点', 'Nodes learned'))}"><span style="width:${pct}%"></span></span><span class="ln-prog-n" translate="no">${pr.done}/${pr.total}</span></summary>
      <div class="ln-map"><svg id="ln-plan-svg"></svg></div>${legend()}<div id="ln-node-card"></div></details>`;
  }
  function teachView(sess) {
    const last = sess.steps[sess.steps.length - 1];
    const waiting = !job && (!last || !last.check || (last.answer && (!last.graded || !C.nextNode(sess.plan))));
    return `<section class="ln-teach" aria-label="${esc(t('一步一检', 'One step, one check'))}">
      ${mapBox(sess)}
      <div class="ln-steps">${sess.steps.map((s, i) => stepCard(sess, s, i, i === sess.steps.length - 1)).join('')}</div>
      ${jobBox(sess.id)}
      ${waiting && !(fail && fail.ctx === sess.id) ? `<div class="ln-row ln-actions"><button type="button" class="button primary" data-act="teach-go" data-id="${esc(sess.id)}">${!last ? L('讲第一步', 'Teach the first step') : L('继续', 'Continue')} ${ico('right')}</button></div>` : ''}
    </section>`;
  }
  function doneView(sess) {
    const s = sess.summary;
    const checks = sess.steps.filter((x) => x.answer && typeof x.answer.correct === 'boolean').map((x) => x.answer);
    const head = `${mapBox(sess)}`;
    if (!s) {
      return `${head}<section class="ln-card"><h3>${L('目标达成', 'Goal reached')}</h3><p class="muted">${L('还差一份总结：把这次学到的写成命题，加入知识图。', 'One thing left: a summary that turns what you learned into claims for the knowledge graph.')}</p>
        ${jobBox(sess.id) || `<button type="button" class="button primary" data-act="summary-again" data-id="${esc(sess.id)}"${dis()}>${L('写总结', 'Write the summary')}</button>`}</section>`;
    }
    const added = s.added;
    return `${head}<section class="ln-card ln-summary" id="ln-summary" tabindex="-1" aria-labelledby="ln-sum-h">
      <h3 id="ln-sum-h">${L('目标达成', 'Goal reached')}</h3>
      <blockquote class="ln-goalsent">${X(s.goalSentence)}</blockquote>
      ${checks.length ? calibrationNote(checks) : ''}
      <h4>${added ? L('已加入知识图', 'Added to your knowledge graph') : L('加入知识图', 'Add to your knowledge graph')}</h4>
      ${added ? `<p class="muted">${L('这些命题和推理链已经在知识图里，下次学习会把相关的当作“已经会的”。', 'These claims and chains are in your knowledge graph; later sessions treat related ones as already known.')} <a href="#graph">${L('去看知识图', 'Open the graph')} ${ico('right')}</a></p>` : `<p class="muted">${L('勾掉不想保留的。只存想法和它们之间的联系，不存分数。', 'Untick what you don’t want to keep. Only ideas and their links are stored, not scores.')}</p>`}
      <fieldset class="ln-picks"${added ? ' disabled' : ''}><legend class="sr-only">${L('命题', 'Claims')}</legend>
        ${s.props.map((p, i) => `<label class="ln-pick"><input type="checkbox" data-sum-prop="${i}" checked>${X(p)}</label>`).join('')}</fieldset>
      ${s.chains.length ? `<fieldset class="ln-picks"${added ? ' disabled' : ''}><legend class="ln-k">${L('推理链', 'Reasoning chains')}</legend>${s.chains.map((c, i) => `<label class="ln-pick ln-chain"><input type="checkbox" data-sum-chain="${i}" checked><span translate="no">${c.premises.map((p) => `<span class="ln-prem">${esc(p)}</span>`).join('')}<span class="ln-concl">${esc(c.conclusion)}</span></span></label>`).join('')}</fieldset>` : ''}
      ${added ? '' : `<div class="ln-row ln-actions"><button type="button" class="button primary" data-act="summary-add" data-id="${esc(sess.id)}">${L('加入知识图', 'Add to the graph')}</button></div>`}
    </section>
    <details class="ln-card ln-review"><summary>${L(`回看这次的 ${sess.steps.length} 步`, `Review the ${sess.steps.length} steps`)}</summary><div class="ln-steps">${sess.steps.map((x, i) => stepCard(sess, x, i, false)).join('')}</div></details>
    ${probeReview(sess)}`;
  }
  function nodeCard(sess) {
    const box = $('#ln-node-card');
    if (!box) return;
    const n = planSel && nodeOf(sess, planSel);
    box.innerHTML = n ? `<div class="ln-nodecard"><b translate="no">${esc(n.label)}</b> <span class="ln-st">${esc(G.statusText(n.status, lang))}</span>${n.detail ? X(n.detail, 'p') : ''}</div>` : '';
  }
  function afterSessionRender(sess) {
    const svg = $('#ln-plan-svg');
    if (svg && sess.plan.nodes.length) {
      G.planMap(svg, sess.plan, C.layoutLayers(sess.plan), {
        current: sess.phase === 'teach' ? sess.current : null, lang,
        onSelect: (id) => {
          planSel = planSel === id ? null : id;
          if (sess.phase === 'plan') { for (const li of $$('.ln-nodes li')) li.classList.remove('is-sel'); renderLearnKeepScroll(); } else nodeCard(sess);
        },
      });
    }
    nodeCard(sess);
    for (const box of $$('[data-dg]')) {
      const st = sess.steps.find((s) => s.id === box.dataset.dg);
      if (st?.diagram) G.diagram(box, st.diagram, { lang });
    }
    const mb = $('#ln-mapbox');
    if (mb) mb.addEventListener('toggle', () => { mapOpen = mb.open; });
    if (focusAfter) {
      const el = $(focusAfter);
      focusAfter = null;
      if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'start', behavior: 'smooth' }); }
    }
  }
  function renderLearnKeepScroll() { const y = window.scrollY; render(); window.scrollTo(0, y); }
  function addSummary(sess) {
    const s = sess.summary;
    if (!s || s.added) return;
    const keep = new Set($$('[data-sum-prop]').filter((x) => x.checked).map((x) => Number(x.dataset.sumProp)));
    const keepC = new Set($$('[data-sum-chain]').filter((x) => x.checked).map((x) => Number(x.dataset.sumChain)));
    const ids = C.addProps(state, s.props.filter((_, i) => keep.has(i)), sess.id);
    let chains = 0;
    for (const [i, c] of s.chains.entries()) if (keepC.has(i) && C.addChain(state, c.premises, c.conclusion, sess.id)) chains++;
    s.added = true;
    touch(sess); save();
    announce(t(`已加入 ${ids.length} 条命题、${chains} 条推理链`, `Added ${pl(ids.length, 'claim')} and ${pl(chains, 'chain')}`));
    renderLearnKeepScroll();
  }

  // ── 练习 ──────────────────────────────────────────────────────────────
  const pform = { k: 5, focus: '' };
  function renderPractice() {
    const sess = openPractice ? sessionById(openPractice) : null;
    if (openPractice && !sess) openPractice = null;
    panel.innerHTML = sess ? practiceView(sess) : practiceHome();
    if (focusAfter) { const el = $(focusAfter); focusAfter = null; if (el) { el.focus({ preventScroll: true }); el.scrollIntoView({ block: 'start', behavior: 'smooth' }); } }
  }
  function practiceHome() {
    const list = state.sessions.filter((s) => s.kind === 'practice');
    const hist = list.map((s) => {
      const items = s.practice.items, right = items.filter((i) => i.graded?.correct).length;
      return `<li><a href="#s-${esc(s.id)}" class="ln-sess">${X(s.title, 'b')}<span class="ln-sess-meta"><span class="ln-phase" data-p="${s.phase}">${esc(phaseText(s.phase))}</span><span translate="no">${right}/${s.practice.queue.length || items.length}</span><span translate="no">${esc(fmtDate(s.updated))}</span></span></a>
        <button type="button" class="ln-x" data-act="del-session" data-id="${esc(s.id)}" title="${esc(t('删除这次练习', 'Delete this practice'))}"${dis()}><span aria-hidden="true">×</span><span class="sr-only">${L('删除', 'Delete')}</span></button></li>`;
    }).join('');
    const empty = !state.props.length;
    return `<div class="ln-learn"><aside class="ln-side"><div class="ln-side-head"><h2>${L('练习记录', 'Practice history')}</h2></div>${hist ? `<ul class="ln-sess-list">${hist}</ul>` : `<p class="muted ln-empty">${L('还没有练习过。', 'No practice yet.')}</p>`}</aside>
      <div class="ln-main"><article class="ln-card" aria-labelledby="ln-pr-h">
      <h2 id="ln-pr-h">${L('从知识图里出题练习', 'Practise from your knowledge graph')}</h2>
      <p class="muted">${L('题目从你学过的命题里挑：没练过的、上次错了或靠猜的、很久没碰的优先；不同来源的题穿插着出，题面不说考哪一块，答完才揭晓。不会就要提示，提示一级比一级强。', 'Problems come from claims you have learned: never practised, last missed or guessed, and longest untouched come first. Topics are interleaved and a problem never says what it is about; the topic is revealed after you answer. Ask for hints when stuck; each is stronger than the last.')}</p>
      ${empty ? `<div class="ln-note">${L('知识图还是空的。先学一次，或者导入你的笔记。', 'Your knowledge graph is empty. Learn something first, or import your notes.')} <a href="#learn">${L('去学习', 'Learn')} ${ico('right')}</a> · <a href="#import">${L('导入笔记', 'Import notes')} ${ico('right')}</a></div>` : `
      <div class="ln-row">
        <label class="ln-field ln-inline"><span>${L('题数', 'Problems')}</span><select id="pr-k" data-pform="k">${[3, 5, 8].map((n) => `<option value="${n}"${pform.k === n ? ' selected' : ''}>${n}</option>`).join('')}</select></label>
        <label class="ln-field ln-grow"><span>${L('只练和这个有关的（可选）', 'Only about this (optional)')}</span><input type="text" id="pr-focus" data-pform="focus" value="${esc(pform.focus)}" translate="no" placeholder="${esc(t('比如：隧穿、本征值', 'e.g. tunnelling, eigenvalues'))}"></label>
      </div>
      <p class="muted ln-small">${L(`知识图里有 ${state.props.length} 条命题。`, `Your graph holds ${pl(state.props.length, 'claim')}.`)}</p>
      <div class="ln-row ln-actions"><button type="button" class="button primary" data-act="practice-start"${dis()}>${L('开始练习', 'Start practising')} ${ico('right')}</button></div>`}
      ${jobBox('new-practice')}
      </article></div></div>`;
  }
  async function startPractice() {
    if (!state.props.length || blocked() || !needAI()) return;
    const k = pform.k, focus = pform.focus.trim();
    let ids;
    if (focus) {
      const rel = C.relatedProps(state, focus, k * 3);
      // 也按来源轮流取，免得连着几道同一来源的题
      const groups = new Map();
      for (const p of rel) { const g = p.sessionIds[0] || '-'; if (!groups.has(g)) groups.set(g, []); groups.get(g).push(p.id); }
      ids = [];
      const qs = [...groups.values()];
      while (ids.length < k && qs.some((q) => q.length)) for (const q of qs) if (q.length && ids.length < k) ids.push(q.shift());
    } else ids = C.pickPractice(state, { k, now: Date.now(), seed: Date.now() % 1e6 });
    if (!ids.length) { announce(t('知识图里没有和它相关的命题。', 'No claims in your graph match that.')); return; }
    const sess = C.createSession(state, { kind: 'practice', goal: focus, title: `${t('练习', 'Practice')}${focus ? ` · ${focus.slice(0, 24)}` : ''} · ${fmtDate(Date.now())}` });
    sess.practice.queue = ids;
    save();
    openPractice = sess.id;
    history.replaceState(null, '', `#s-${sess.id}`);
    render();
    await run(sess.id, () => nextItem(sess));
  }
  async function nextItem(sess) {
    const items = sess.practice.items, queue = sess.practice.queue;
    while (items.length < queue.length && !propById(queue[items.length])) queue.splice(items.length, 1);
    if (items.length >= queue.length) { sess.phase = 'done'; touch(sess); save(); focusAfter = '#pr-done'; return; }
    const pid = queue[items.length];
    const p = propById(pid);
    const nb = C.neighbours(state, pid).map(propById).filter(Boolean).slice(0, 1);
    const msgs = C.buildPractice({ props: [p.text, ...nb.map((x) => x.text)], avoidTopics: items.map((i) => i.topic), lang: aiLang, prompts });
    const j = await call(sess.id, t(`正在出第 ${items.length + 1} 题…`, `Writing problem ${items.length + 1}…`), msgs, sess, 4000);
    const o = { id: C.newId('pi', items.map((i) => i.id)), propIds: [pid, ...nb.map((x) => x.id)] };
    let item = C.parsePracticeItem(j, o);
    if (item.namesTopic) {
      // 题面说出了考点（“用隧穿估算……”）：再要一题；第二题还是这样就用第一题
      const again = [...msgs.slice(0, -1), { role: 'user', content: `${msgs[msgs.length - 1].content}\n\nYour previous problem named its topic ("${item.topic}") in the problem text. Write a different problem that does not name it.` }];
      try {
        const it2 = C.parsePracticeItem(await call(sess.id, t(`正在重出第 ${items.length + 1} 题…`, `Rewriting problem ${items.length + 1}…`), again, sess, 4000), o);
        if (!it2.namesTopic) item = it2;
      } catch (e) { if (e?.name === 'AbortError') throw e; }
    }
    delete item.namesTopic;
    items.push(item);
    touch(sess); save();
    focusAfter = `#pi-${safeId(item.id)}`;
  }
  async function submitPractice(sess, itemId) {
    const item = sess.practice.items.find((i) => i.id === itemId);
    if (!item || item.answer) return;
    const q = { kind: item.kind, options: item.options };
    const a = readDraft(`${sess.id}:${item.id}`, q);
    if (!a) return;
    const local = item.kind === 'choice' && Number.isInteger(item.expected) ? C.gradeChoice({ kind: 'choice', options: item.options, answer: item.expected }, a.value) : null;
    if (local === null && !needAI()) return;
    item.answer = a;
    if (local !== null) finishItem(sess, item, { correct: local, feedback: '' });
    else { save(); await run(sess.id, () => gradeItem(sess, item)); }
    renderLearnKeepScroll();
  }
  async function gradeItem(sess, item) {
    const j = await call(sess.id, t('正在评分…', 'Grading…'), C.buildPracticeGrade({ item, answer: item.answer, lang: aiLang, prompts }), sess, 2000);
    finishItem(sess, item, C.parsePracticeGrade(j));
  }
  function finishItem(sess, item, g) {
    item.graded = g;
    item.answer.correct = g.correct;
    C.recordPractice(state, item.propIds, g.correct, Date.now(), item.answer.confidence);
    touch(sess); save();
    announce(g.correct ? t('答对了', 'Right') : t('还没对，看看解答', 'Not yet; see the solution'));
  }
  function itemCard(sess, item, i, n) {
    const key = `${sess.id}:${item.id}`;
    const q = { kind: item.kind, options: item.options };
    const hints = item.hints.slice(0, item.hintsUsed);
    const done = !!item.graded;
    return `<article class="ln-card ln-item" id="pi-${safeId(item.id)}" tabindex="-1" aria-labelledby="pih-${safeId(item.id)}">
      <header class="ln-step-h" id="pih-${safeId(item.id)}"><span class="ln-stepn" translate="no">${i + 1}</span><b>${L(`第 ${i + 1} 题，共 ${n} 题`, `Problem ${i + 1} of ${n}`)}</b>${done ? `<span class="ln-tag">${L('练的是', 'Topic')}: <span translate="no">${esc(item.topic)}</span></span>` : ''}</header>
      ${X(item.problem, 'p', 'ln-qtext')}
      ${hints.length ? `<ol class="ln-hints">${hints.map((h, k) => `<li><span class="ln-k">${L(`提示 ${k + 1}`, `Hint ${k + 1}`)}</span>${X(h)}</li>`).join('')}</ol>` : ''}
      ${item.answer ? answeredView(q, item.answer, item.graded, { expected: item.expected }) : `${answerBlock(key, q)}
        <div class="ln-row"><button type="button" class="button primary" data-act="practice-submit" data-id="${esc(item.id)}"${dis()}>${L('提交', 'Submit')}</button>
        ${item.hintsUsed < item.hints.length ? `<button type="button" class="button" data-act="hint" data-id="${esc(item.id)}">${L(`要一个提示（${item.hintsUsed}/${item.hints.length}）`, `Get a hint (${item.hintsUsed}/${item.hints.length})`)}</button>` : ''}</div>`}
      ${item.answer && !item.graded && !(job && job.ctx === sess.id) && !(fail && fail.ctx === sess.id) ? `<div class="ln-row"><button type="button" class="button small" data-act="practice-regrade" data-id="${esc(item.id)}">${L('评分', 'Grade it')}</button></div>` : ''}
      ${done ? `<details class="ln-sol" open><summary>${L('解答', 'Solution')}</summary>${prose(item.solution, [])}</details>
        <p class="ln-small muted">${L('用到的命题', 'Claims used')}: ${item.propIds.map(propById).filter(Boolean).map((p) => `<a href="#graph" data-act="kg-goto" data-id="${esc(p.id)}" translate="no">${esc(p.text)}</a>`).join(' · ') || L('（已删除）', '(deleted)')}${item.hintsUsed ? ` · ${L(`用了 ${item.hintsUsed} 个提示`, `${item.hintsUsed} hint${item.hintsUsed > 1 ? 's' : ''} used`)}` : ''}</p>` : ''}
    </article>`;
  }
  function practiceView(sess) {
    const items = sess.practice.items, n = sess.practice.queue.length || items.length;
    const last = items[items.length - 1];
    const canNext = !job && sess.phase === 'practice' && (!last || last.graded);
    const right = items.filter((i) => i.graded?.correct).length;
    return `<div class="ln-practice">
      <header class="ln-shead"><p><a href="#practice">${ico('left')} ${L('练习', 'Practice')}</a></p><h2>${X(sess.title)}</h2><div class="ln-row ln-smeta"><span class="ln-usage">${esc(usageText(sess.usage))}</span></div></header>
      ${items.map((it, i) => itemCard(sess, it, i, n)).join('')}
      ${jobBox(sess.id)}
      ${canNext && !(fail && fail.ctx === sess.id) ? `<div class="ln-row ln-actions"><button type="button" class="button primary" data-act="practice-next" data-id="${esc(sess.id)}">${items.length >= n ? L('看结果', 'See results') : items.length ? L('下一题', 'Next problem') : L('出第一题', 'First problem')} ${ico('right')}</button></div>` : ''}
      ${sess.phase === 'done' ? `<section class="ln-card ln-summary" id="pr-done" tabindex="-1"><h3>${L('这组练完了', 'Set complete')}</h3>
        <p class="ln-big" translate="no">${right} / ${items.length}</p>${calibrationNote(items.map((i) => i.answer).filter(Boolean))}
        <ul class="ln-topics">${items.map((i) => `<li class="${i.graded?.correct ? 'is-right' : 'is-wrong'}"><span class="ln-dot${i.graded?.correct ? ' ok' : ' bad'}" aria-hidden="true"></span>${X(i.topic || i.problem.slice(0, 40))}${i.answer?.confidence === 'guess' && i.graded?.correct ? ` <span class="ln-conf-tag" data-c="guess">${L('猜的', 'Guess')}</span>` : ''}</li>`).join('')}</ul>
        <p class="muted ln-small">${L('错的和猜对的命题下次会优先出现。', 'Missed and guessed claims come up first next time.')}</p>
        <div class="ln-row"><a class="button primary" href="#practice">${L('再练一组', 'Another set')}</a><a class="button" href="#graph">${L('看知识图', 'Knowledge graph')}</a></div></section>` : ''}
    </div>`;
  }

  // ── 知识图 ────────────────────────────────────────────────────────────
  const sessionName = (sid) => {
    const s = sessionById(sid);
    if (s) return { href: `#s-${s.id}`, text: s.title };
    if (String(sid).startsWith('imp')) return { href: '#import', text: t('导入的笔记', 'Imported notes') };
    return { href: '', text: t('已删除的会话', 'Deleted session') };
  };
  function renderGraph() {
    const data = C.graphData(state);
    panel.innerHTML = `<section class="ln-graph" aria-labelledby="ln-kg-h">
      <div class="ln-kg-head"><h2 id="ln-kg-h">${L('知识图', 'Knowledge graph')}</h2>
        <p class="muted">${L(`${state.props.length} 条命题 · ${state.chains.length} 条推理链 · 来自 ${new Set(state.props.flatMap((p) => p.sessionIds)).size} 个来源。拖动节点、滚轮或双指缩放；点一个命题看它从哪里来、和谁相连。`, `${pl(state.props.length, 'claim')} · ${pl(state.chains.length, 'chain')} · from ${pl(new Set(state.props.flatMap((p) => p.sessionIds)).size, 'source')}. Drag nodes, scroll or pinch to zoom; click a claim to see where it came from and what it connects to.`)}</p>
        <label class="ln-field ln-search"><span class="sr-only">${L('搜索命题', 'Search claims')}</span><input type="search" id="kg-q" value="${esc(kgQuery)}" translate="no" placeholder="${esc(t('搜索命题', 'Search claims'))}"></label></div>
      <div class="ln-kg-grid"><div id="ln-kg" class="ln-kg-box"></div><aside class="ln-card ln-kg-card" id="ln-kg-card" aria-live="polite"></aside></div>
      ${state.props.length ? '' : `<p class="ln-note">${L('学完一次并把总结加入知识图，或者导入笔记，这里就会长出来。', 'Finish a session and add its summary, or import notes, and the graph grows here.')} <a href="#learn">${L('去学习', 'Learn')} ${ico('right')}</a> · <a href="#import">${L('导入笔记', 'Import notes')} ${ico('right')}</a></p>`}
      <details class="ln-card ln-all"${kgQuery ? ' open' : ''}><summary>${L('命题列表', 'All claims as a list')}</summary><ul class="ln-plist" id="kg-list"></ul></details>
    </section>`;
    if (kg) kg.destroy();
    kg = G.knowledgeGraph($('#ln-kg'), data, { lang, onSelect: (id) => pickProp(id, false), onClear: () => pickProp(null, false) });
    applySearch();
    if (kgSel && propById(kgSel)) kg.focus(kgSel); else kgSel = null;
    propCard();
  }
  function applySearch() {
    const q = kgQuery.trim();
    const list = q ? C.searchProps(state, q) : state.props;
    if (kg) kg.setHighlight(q ? list.map((p) => p.id) : []);
    const ul = $('#kg-list');
    if (ul) ul.innerHTML = list.length ? list.slice(0, 300).map((p) => `<li><button type="button" class="ln-plink${p.id === kgSel ? ' is-sel' : ''}" data-act="kg-pick" data-id="${esc(p.id)}" translate="no">${esc(p.text)}</button></li>`).join('') : `<li class="muted">${L('没有找到', 'Nothing found')}</li>`;
  }
  function pickProp(id, center) {
    kgSel = id && propById(id) ? id : null;
    if (center && kg) kg.focus(kgSel);
    propCard();
    for (const b of $$('.ln-plink')) b.classList.toggle('is-sel', b.dataset.id === kgSel);
  }
  function propCard() {
    const box = $('#ln-kg-card');
    if (!box) return;
    const p = kgSel && propById(kgSel);
    if (!p) { box.innerHTML = `<p class="muted">${state.props.length ? L('点图里的一个命题，或在列表里选一个。', 'Click a claim in the graph, or pick one from the list.') : L('还没有命题。', 'No claims yet.')}</p>`; return; }
    const asConcl = state.chains.filter((c) => c.conclusion === p.id);
    const asPrem = state.chains.filter((c) => c.premises.includes(p.id));
    const link = (id) => { const q = propById(id); return q ? `<button type="button" class="ln-plink" data-act="kg-pick" data-center data-id="${esc(id)}" translate="no">${esc(q.text)}</button>` : ''; };
    const srcs = p.sessionIds.map(sessionName);
    box.innerHTML = `<p class="ln-k">${L('命题', 'Claim')}</p>${X(p.text, 'p', 'ln-ptext')}
      ${asConcl.length ? `<p class="ln-k">${L('由这些推出', 'Follows from')}</p><ul>${asConcl.map((c) => `<li>${c.premises.map(link).join('')}</li>`).join('')}</ul>` : ''}
      ${asPrem.length ? `<p class="ln-k">${L('用来推出', 'Leads to')}</p><ul>${asPrem.map((c) => `<li>${link(c.conclusion)}${c.premises.length > 1 ? `<small class="muted">${L('同时需要', 'together with')} ${c.premises.filter((x) => x !== p.id).map((x) => esc(propById(x)?.text || '')).join(t('；', '; '))}</small>` : ''}</li>`).join('')}</ul>` : ''}
      <p class="ln-k">${L('来自', 'From')}</p><ul>${srcs.length ? srcs.map((s) => `<li>${s.href ? `<a href="${esc(s.href)}" translate="no">${esc(s.text)}</a>` : X(s.text, 'span', 'muted')}</li>`).join('') : `<li class="muted">${L('（没有记录来源）', '(no source recorded)')}</li>`}</ul>
      ${p.practiced?.n ? `<p class="ln-small muted">${L(`练过 ${p.practiced.n} 次，错 ${p.practiced.missed} 次`, `Practised ${p.practiced.n}×, missed ${p.practiced.missed}×`)} · ${esc(fmtDate(p.practiced.at))}</p>` : ''}
      <div class="ln-row"><button type="button" class="button small danger" data-act="kg-del" data-id="${esc(p.id)}">${L('删除这条命题', 'Delete this claim')}</button></div>`;
  }

  // ── 导入笔记 ──────────────────────────────────────────────────────────
  const MAX_CHUNKS = 6;
  function renderImport() {
    const chunks = imp.text.trim() ? C.splitNotes(imp.text, 3500) : [];
    const pv = imp.preview;
    panel.innerHTML = `<section class="ln-import" aria-labelledby="ln-imp-h"><article class="ln-card">
      <h2 id="ln-imp-h">${L('导入笔记', 'Import notes')}</h2>
      <p class="muted">${L('粘贴笔记或打开一个 .md / .txt 文件。AI 把它拆成一条条命题和推理链，你确认后加入知识图。笔记会发给你选的 AI 服务商。', 'Paste notes or open a .md / .txt file. The AI splits them into claims and reasoning chains, and you confirm before they join the graph. The notes are sent to your AI provider.')}</p>
      <label class="ln-field"><span>${L('笔记', 'Notes')}</span><textarea id="imp-text" rows="10" data-imp translate="no" placeholder="${esc(t('# 标题\n一段一段的笔记……', '# Heading\nNotes, paragraph by paragraph…'))}">${esc(imp.text)}</textarea></label>
      <div class="ln-row"><label class="button small ln-file-btn"><input type="file" id="imp-file" accept=".md,.markdown,.txt" class="sr-only">${L('打开文件', 'Open a file')}</label>${imp.name ? X(imp.name, 'span', 'ln-tag') : ''}
        <span class="muted ln-small" id="imp-count">${chunkNote(chunks)}</span></div>
      ${imp.msg ? `<p class="ln-hint-msg" role="alert">${esc(imp.msg)}</p>` : ''}${imp.ok ? `<p class="ln-ok-msg" role="status">${esc(imp.ok)} <a href="#graph">${L('去看知识图', 'Open the graph')} ${ico('right')}</a></p>` : ''}
      <div class="ln-row ln-actions"><button type="button" class="button primary" data-act="import-extract"${dis()}>${L('提取命题', 'Extract claims')}</button>${imp.text ? `<button type="button" class="text-button" data-act="import-clear">${L('清空', 'Clear')}</button>` : ''}</div>
      ${jobBox('import')}
    </article>
    ${pv ? `<article class="ln-card" id="imp-preview" tabindex="-1" aria-labelledby="imp-pv-h"><h3 id="imp-pv-h">${L('预览：勾选要加入的', 'Preview: tick what to add')}</h3>
      ${pv.props.length ? `<fieldset class="ln-picks"><legend class="sr-only">${L('命题', 'Claims')}</legend>${pv.props.map((p, i) => `<label class="ln-pick"><input type="checkbox" data-imp-prop="${i}" checked>${X(p)}${C.searchProps(state, p)[0] && C.similar(C.searchProps(state, p)[0].text, p) ? ` <span class="ln-tag">${L('已有', 'Already there')}</span>` : ''}</label>`).join('')}</fieldset>` : `<p class="muted">${L('没有提取到命题。', 'No claims were found.')}</p>`}
      ${pv.chains.length ? `<fieldset class="ln-picks"><legend class="ln-k">${L('推理链', 'Reasoning chains')}</legend>${pv.chains.map((c, i) => `<label class="ln-pick ln-chain"><input type="checkbox" data-imp-chain="${i}" checked><span translate="no">${c.premises.map((p) => `<span class="ln-prem">${esc(p)}</span>`).join('')}<span class="ln-concl">${esc(c.conclusion)}</span></span></label>`).join('')}</fieldset>` : ''}
      ${pv.props.length ? `<div class="ln-row ln-actions"><button type="button" class="button primary" data-act="import-add">${L('加入知识图', 'Add to the graph')}</button></div>` : ''}
    </article>` : ''}</section>`;
    if (focusAfter) { const el = $(focusAfter); focusAfter = null; el?.focus(); }
  }
  function chunkNote(chunks) {
    if (!chunks.length) return '';
    return esc(chunks.length > MAX_CHUNKS ? t(`共 ${chunks.length} 段，只处理前 ${MAX_CHUNKS} 段`, `${chunks.length} chunks; only the first ${MAX_CHUNKS} are processed`) : t(`共 ${chunks.length} 段，每段一次调用`, `${chunks.length} chunk${chunks.length > 1 ? 's' : ''}, one call each`));
  }
  async function extract() {
    const chunks = C.splitNotes(imp.text, 3500).slice(0, MAX_CHUNKS);
    if (!chunks.length) { imp.msg = t('先粘贴笔记或打开一个文件。', 'Paste notes or open a file first.'); render(); return; }
    if (blocked() || !needAI()) return;
    imp.msg = ''; imp.ok = ''; imp.preview = null;
    await run('import', async () => {
      const props = [], chains = [];
      for (const [i, chunk] of chunks.entries()) {
        const j = await call('import', t(`正在提取第 ${i + 1} / ${chunks.length} 段…`, `Extracting chunk ${i + 1} of ${chunks.length}…`), C.buildExtract({ text: chunk, lang: aiLang, prompts }), null, 4000);
        const ex = C.parseExtraction(j);
        for (const p of ex.props) if (!props.some((q) => C.normText(q) === C.normText(p))) props.push(p);
        chains.push(...ex.chains);
      }
      imp.preview = { props, chains };
      focusAfter = '#imp-preview';
    });
  }
  function importAdd() {
    const pv = imp.preview;
    if (!pv) return;
    const sid = C.newId('imp', state.props.flatMap((p) => p.sessionIds));
    const keep = new Set($$('[data-imp-prop]').filter((x) => x.checked).map((x) => Number(x.dataset.impProp)));
    const keepC = new Set($$('[data-imp-chain]').filter((x) => x.checked).map((x) => Number(x.dataset.impChain)));
    const ids = C.addProps(state, pv.props.filter((_, i) => keep.has(i)), sid);
    let n = 0;
    for (const [i, c] of pv.chains.entries()) if (keepC.has(i) && C.addChain(state, c.premises, c.conclusion, sid)) n++;
    save();
    imp.preview = null; imp.text = ''; imp.name = '';
    imp.msg = '';
    imp.ok = t(`已加入 ${ids.length} 条命题、${n} 条推理链。`, `Added ${pl(ids.length, 'claim')} and ${pl(n, 'chain')}.`);
    announce(imp.ok);
    render();
  }

  // ── 数据 ──────────────────────────────────────────────────────────────
  const PROMPT_NAMES = { probe: ['摸底出题', 'Probe questions'], plan: ['画路线', 'Map'], teach: ['一步一检（评分 + 下一步）', 'One step, one check (grade + next step)'], grade: ['单题评分（备用）', 'Single-answer grading (spare)'], practice: ['练习出题', 'Practice problem'], practiceGrade: ['练习评分', 'Practice grading'], extract: ['笔记提取', 'Notes extraction'], summary: ['学完总结', 'Session summary'] };
  function renderData() {
    const u = state.usage;
    const rows = state.sessions.filter((s) => s.usage.calls).map((s) => `<tr><td><a href="#s-${esc(s.id)}" translate="no">${esc(s.title)}</a></td><td translate="no">${s.usage.calls}</td><td translate="no">${fmtNum(s.usage.tokens)}</td><td translate="no">${s.usage.cost > 0 ? `$${s.usage.cost.toFixed(4)}` : '—'}</td></tr>`).join('');
    const pi = pendingImport;
    panel.innerHTML = `<section class="ln-data">
      <article class="ln-card" aria-labelledby="ln-use-h"><h2 id="ln-use-h">${L('用量与花费', 'Usage and cost')}</h2>
        <dl class="ln-stats"><div><dt translate="no">${fmtNum(u.calls)}</dt><dd>${L('次调用', 'calls')}</dd></div><div><dt translate="no">${fmtNum(u.tokens)}</dt><dd>token</dd></div><div><dt translate="no">${u.cost > 0 ? `$${u.cost.toFixed(4)}` : '—'}</dt><dd>${L('估算花费（美元）', 'estimated cost (USD)')}</dd></div></dl>
        <p class="muted ln-small">${L('花费只按页面知道价格的模型估算（目前是 Meta Muse）；DeepSeek、订阅、MolAstria 托管额度和自定义接口不计价，只记 token。实际以服务商账单为准。', 'Cost is estimated only for models whose prices the page knows (currently Meta Muse); DeepSeek, subscriptions, the MolAstria hosted allowance and custom endpoints are not priced, only counted in tokens. Your provider’s bill is what counts.')}${u.unpriced ? ` ${L('你的记录里有未计价的调用。', 'Some of your calls are unpriced.')}` : ''}</p>
        ${rows ? `<div class="ln-table"><table><thead><tr><th>${L('会话', 'Session')}</th><th>${L('调用', 'Calls')}</th><th>token</th><th>${L('花费', 'Cost')}</th></tr></thead><tbody>${rows}</tbody></table></div>` : ''}
      </article>
      <article class="ln-card" aria-labelledby="ln-io-h"><h2 id="ln-io-h">${L('导出与导入', 'Export and import')}</h2>
        <p class="muted">${L(`现在有 ${state.sessions.length} 次会话、${state.props.length} 条命题、${state.chains.length} 条推理链。全部只存在这个浏览器里；换设备或清理浏览器前先导出。`, `${pl(state.sessions.length, 'session')}, ${pl(state.props.length, 'claim')} and ${pl(state.chains.length, 'chain')}, all stored only in this browser. Export before switching devices or clearing browser data.`)}</p>
        <p class="muted ln-small">${L('“导出全部”是完整备份：包括每次会话里你的回答和想法、附带文件的全文、知识图和提示词改动。要分享给别人，用“只导出知识图”：只有命题和推理链，没有回答、文件和练习记录。', '“Export everything” is a full backup: your answers and thinking in every session, the full text of attached files, the knowledge graph and prompt edits. To share with someone, use “Export the graph only”: claims and chains, without answers, files or practice history.')}</p>
        <div class="ln-row"><button type="button" class="button primary" data-act="export">${L('导出全部', 'Export everything')}</button>
          <button type="button" class="button" data-act="export-graph"${state.props.length ? '' : ' disabled'}>${L('只导出知识图', 'Export the graph only')}</button>
          <label class="button ln-file-btn"><input type="file" id="data-file" accept=".json,application/json" class="sr-only">${L('导入 JSON', 'Import JSON')}</label>
          <button type="button" class="button danger" data-act="clear-all">${L('清空全部', 'Clear everything')}</button></div>
        ${dataMsg ? `<p class="ln-ok-msg" role="status">${esc(dataMsg)}</p>` : ''}
        ${pi ? `<div class="ln-note" id="data-pi" tabindex="-1"><p>${L(`文件里有 ${pi.state.sessions.length} 次会话、${pi.state.props.length} 条命题、${pi.state.chains.length} 条推理链。`, `The file holds ${pl(pi.state.sessions.length, 'session')}, ${pl(pi.state.props.length, 'claim')} and ${pl(pi.state.chains.length, 'chain')}.`)}</p>
          ${pi.prompts ? `<div class="ln-warnbox"><p>${L(`文件里还有 ${Object.keys(pi.prompts).length} 条改过的提示词：`, `The file also carries ${pl(Object.keys(pi.prompts).length, 'edited prompt')}: `)}<code translate="no">${Object.keys(pi.prompts).map(esc).join(', ')}</code>${L('。提示词决定 AI 怎么出题、怎么讲，只换上你信任的来源给的。', '. Prompts decide how the AI asks and explains; only take them from a source you trust.')}</p>
            <label class="ln-pick"><input type="checkbox" id="data-pi-prompts">${L('也换上文件里的提示词', 'Also use the prompts from the file')}</label></div>` : ''}
          <div class="ln-row"><button type="button" class="button primary" data-act="import-merge">${L('合并进来', 'Merge in')}</button><button type="button" class="button" data-act="import-replace">${L('替换现有数据', 'Replace current data')}</button><button type="button" class="text-button" data-act="import-cancel">${L('取消', 'Cancel')}</button></div></div>` : ''}
      </article>
      <article class="ln-card" aria-labelledby="ln-pr-h2"><h2 id="ln-pr-h2">${L('提示词', 'Prompts')}</h2>
        <p class="muted">${L('每一步发给 AI 的系统提示词都在这里，可以改。{lang} 会换成网站当前的语言；最后的 JSON 格式说明请保留，页面靠它读懂回复。第一行的 TASK 标记由页面自动加上。改动只存在这个浏览器。', 'Every system prompt the page sends is here, and you can edit it. {lang} becomes the site’s current language; keep the JSON shape at the end, which the page relies on to read replies. The TASK line on top is added automatically. Edits stay in this browser.')}</p>
        ${Object.keys(C.DEFAULT_PROMPTS).map((k) => { const mod = typeof prompts[k] === 'string' && prompts[k].trim() && prompts[k] !== C.DEFAULT_PROMPTS[k]; return `<details class="ln-prompt" data-key="${k}"><summary>${L(...(PROMPT_NAMES[k] || [k, k]))} <code translate="no">${k}</code>${mod ? `<span class="ln-tag gold">${L('已修改', 'Edited')}</span>` : ''}</summary>
          <label class="ln-field"><span class="sr-only">${L('提示词', 'Prompt')} ${esc(k)}</span><textarea id="pr-${k}" rows="14" spellcheck="false" translate="no">${esc(mod ? prompts[k] : C.DEFAULT_PROMPTS[k])}</textarea></label>
          <div class="ln-row"><button type="button" class="button small primary" data-act="prompt-save" data-key="${k}">${L('保存', 'Save')}</button><button type="button" class="button small" data-act="prompt-reset" data-key="${k}"${mod ? '' : ' disabled'}>${L('恢复默认', 'Reset to default')}</button><span class="ln-small muted" data-prompt-msg="${k}" role="status"></span></div></details>`; }).join('')}
      </article>
      <article class="ln-card" aria-labelledby="ln-priv-h"><h2 id="ln-priv-h">${L('隐私', 'Privacy')}</h2>
        <ul class="ln-bullets">
          <li>${L('保存在本机：所有会话、回答、知识图、提示词改动和用量记录存在这个浏览器的 localStorage 里，MolAstria 不保存它们；只有你登录后在账号页打开了云同步，才会存到你自己的账号里，在你的设备之间同步（可以随时删除云端副本）。', 'Stored on this device: every session, answer, the knowledge graph, prompt edits and usage live in this browser’s localStorage and MolAstria does not store them, unless you sign in and switch on cloud sync on the account page; then they are kept in your own account to sync across your devices (you can delete the cloud copy at any time).')}</li>
          <li>${L('发给你选的 AI 服务商：学习目标、所选章节的文字、附带文件、相关命题、你的回答和想法、导入的笔记。用 MolAstria 托管额度时，请求经 MolAstria 账号服务转发给 DeepSeek，账号服务只计次数、不保存内容。', 'Sent to the AI provider you chose: the goal, the chosen chapter’s text, attached files, related claims, your answers and thinking, imported notes. With the MolAstria hosted allowance, requests are relayed through MolAstria’s account service to DeepSeek; the service counts requests and does not store their content.')}${relayNote()}</li>
          <li>${L('口述用的是浏览器自带的语音识别；有些浏览器会把声音交给它自己的服务处理。', 'Dictation uses the browser’s own speech recognition; some browsers send the audio to their own service.')}</li>
        </ul>
      </article>
    </section>`;
    if (focusAfter) { const el = $(focusAfter); focusAfter = null; el?.focus(); }
  }
  // 现在用的服务商经 MolAstria 转发时，在隐私说明里点明
  function relayNote() {
    const A = ai();
    const p = A?.providers?.[A.settings?.()?.provider];
    if (!p?.proxy) return '';
    return p.hosted ? ` <b>${L('你现在用的就是托管额度。', 'You are using the hosted allowance now.')}</b>` : ` <b>${L('你现在用的是站点代理：请求经它转发给服务商。', 'You are using the site proxy now: requests are relayed through it to the provider.')}</b>`;
  }
  // 只导出知识图：命题和推理链，不带会话、回答、文件、练习记录和提示词；来源改成“导入的”编号，分组仍在
  function graphOnly() {
    const sid = (x) => (String(x).startsWith('imp') ? x : `imp-${x}`.slice(0, 40));
    return { v: C.SCHEMA_VERSION, sessions: [], usage: { cost: 0, tokens: 0, calls: 0 },
      props: state.props.map((p) => ({ id: p.id, text: p.text, sessionIds: p.sessionIds.map(sid), created: p.created })),
      chains: state.chains.map((c) => ({ id: c.id, premises: [...c.premises], conclusion: c.conclusion, sessionIds: c.sessionIds.map(sid) })) };
  }
  function exportData(graph) {
    const body = graph ? { app: 'molastria-study-desk', kind: 'graph', v: C.SCHEMA_VERSION, exported: new Date().toISOString(), state: graphOnly() }
      : { app: 'molastria-study-desk', v: C.SCHEMA_VERSION, exported: new Date().toISOString(), state, prompts };
    const blob = new Blob([JSON.stringify(body, null, 1)], { type: 'application/json' });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = `molastria-study-desk-${graph ? 'graph-' : ''}${new Date().toISOString().slice(0, 10)}.json`;
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(a.href), 4000);
    dataMsg = t('已导出。', 'Exported.');
    render();
  }
  async function readImport(file) {
    dataMsg = ''; pendingImport = null;
    let raw = null;
    try { raw = JSON.parse(await file.text()); } catch { dataMsg = t('这个文件不是有效的 JSON。', 'That file is not valid JSON.'); render(); return; }
    const inc = migrate(raw && typeof raw === 'object' && raw.state ? raw.state : raw);
    if (!inc.sessions.length && !inc.props.length) { dataMsg = t('文件里没有研习台的数据。', 'The file holds no Study Desk data.'); render(); return; }
    // 提示词：只认默认提示词里有的键、非空字符串、和默认不同的；导入时要另外勾选才会换上
    let fp = null;
    if (raw && typeof raw.prompts === 'object' && raw.prompts && !Array.isArray(raw.prompts)) {
      for (const k of Object.keys(C.DEFAULT_PROMPTS)) {
        const v = raw.prompts[k];
        if (typeof v === 'string' && v.trim() && v !== C.DEFAULT_PROMPTS[k]) (fp ||= {})[k] = v.slice(0, 8000);
      }
    }
    pendingImport = { state: inc, prompts: fp };
    focusAfter = '#data-pi';
    render();
  }
  function mergeIn(inc) {
    const have = new Set(state.sessions.map((s) => s.id));
    const fresh = inc.sessions.filter((s) => !have.has(s.id));
    // 用量：文件和这里没有共同的会话时整份加上；有重叠（比如导回自己的备份）时只加新会话的，免得重复计数
    const overlap = fresh.length < inc.sessions.length;
    const add = overlap ? fresh.reduce((u, s) => ({ calls: u.calls + s.usage.calls, tokens: u.tokens + s.usage.tokens, cost: u.cost + s.usage.cost, unpriced: u.unpriced || !!s.usage.unpriced }), { calls: 0, tokens: 0, cost: 0, unpriced: false }) : inc.usage;
    state.sessions.push(...fresh);
    state.sessions.sort((a, b) => b.created - a.created);
    const map = new Map();
    for (const p of inc.props) {
      const id = C.addProp(state, p.text, p.sessionIds[0] || null);
      if (!id) continue;
      const tgt = propById(id);
      for (const sid of p.sessionIds) if (!tgt.sessionIds.includes(sid)) tgt.sessionIds.push(sid);
      if (p.practiced && (!tgt.practiced || p.practiced.at > tgt.practiced.at)) tgt.practiced = p.practiced;
      map.set(p.id, id);
    }
    for (const c of inc.chains) {
      const prem = c.premises.map((id) => propById(map.get(id))?.text).filter(Boolean), concl = propById(map.get(c.conclusion))?.text;
      if (!concl || !prem.length) continue;
      const cid = C.addChain(state, prem, concl, c.sessionIds[0] || null);
      const ch = cid && state.chains.find((x) => x.id === cid);
      if (ch) for (const sid of c.sessionIds) if (!ch.sessionIds.includes(sid)) ch.sessionIds.push(sid);
    }
    state.usage.calls += add.calls; state.usage.tokens += add.tokens; state.usage.cost += add.cost;
    if (add.unpriced) state.usage.unpriced = true;
  }

  // ── 事件 ──────────────────────────────────────────────────────────────
  const curLearn = () => sessionById(openLearn);
  const curPractice = () => sessionById(openPractice);
  let rec = null;
  function dictate(btn) {
    const target = document.getElementById(btn.dataset.target);
    if (!SR || !target) return;
    if (rec) { try { rec.stop(); } catch { /* 已停 */ } return; }
    try {
      rec = new SR();
      rec.lang = en ? 'en-US' : 'zh-CN';
      rec.interimResults = false;
      rec.continuous = true;
      rec.onresult = (ev) => {
        let add = '';
        for (let i = ev.resultIndex; i < ev.results.length; i++) if (ev.results[i].isFinal) add += ev.results[i][0].transcript;
        if (!add) return;
        target.value = target.value ? `${target.value}${en ? ' ' : ''}${add}` : add;
        target.dispatchEvent(new Event('input', { bubbles: true }));
      };
      const stop = () => { rec = null; for (const b of $$('.ln-mic')) b.setAttribute('aria-pressed', 'false'); };
      rec.onend = stop;
      rec.onerror = (ev) => { stop(); if (ev?.error === 'not-allowed') announce(t('浏览器没有允许使用麦克风。', 'The browser did not allow the microphone.')); };
      rec.start();
      btn.setAttribute('aria-pressed', 'true');
    } catch { rec = null; }
  }

  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-act]');
    if (!b || !(panel.contains(b) || $('#ln-ai')?.contains(b))) return;
    const act = b.dataset.act, id = b.dataset.id;
    if (b.tagName === 'A' && act !== 'kg-goto') e.preventDefault();
    if (act === 'settings') ai()?.openSettings();
    else if (act === 'abort') job?.ctrl.abort();
    else if (act === 'retry') { if (blocked()) return; const r = fail?.retry; fail = null; r?.(); }
    else if (act === 'mic') dictate(b);
    else if (act === 'new') startSession();
    else if (act === 'src-clear') { Object.assign(form, { srcId: '', chId: '', source: null }); if (form.goal === form.autoGoal) form.goal = form.autoGoal = ''; render(); }
    else if (act === 'file-remove') { form.files.splice(Number(b.dataset.i), 1); render(); }
    else if (act === 'del-session') {
      const s = sessionById(id);
      if (!s || !confirm(t(`删除“${s.title}”？知识图里的命题会保留。`, `Delete “${s.title}”? Its claims stay in the knowledge graph.`))) return;
      C.removeSession(state, id); save(); groundCache.delete(id);
      if (openLearn === id) { openLearn = null; history.replaceState(null, '', '#learn'); }
      if (openPractice === id) { openPractice = null; history.replaceState(null, '', '#practice'); }
      render();
    }
    else if (act === 'probe-again') { const s = curLearn(); if (s && needAI()) run(s.id, () => doProbe(s)); }
    else if (act === 'probe-submit') { const s = curLearn(); if (s) submitProbe(s); }
    else if (act === 'plan-again') { const s = curLearn(); if (s && needAI()) run(s.id, () => doPlan(s)); }
    else if (act === 'node-toggle') {
      const s = curLearn(), n = nodeOf(s, id);
      if (!n) return;
      s.plan = C.setNodeStatus(s.plan, id, n.status === 'held' ? 'todo' : 'held'); touch(s); save(); renderLearnKeepScroll();
    }
    else if (act === 'teach-start') { const s = curLearn(); if (s) startTeach(s); }
    else if (act === 'teach-go') { const s = curLearn(); if (s && needAI()) run(s.id, () => doTeach(s)); }
    else if (act === 'summary-again') { const s = curLearn(); if (s && needAI()) run(s.id, () => doSummary(s)); }
    else if (act === 'reveal') {
      const s = curLearn(), st = s?.steps.find((x) => x.id === id);
      if (!st) return;
      st.predictAnswer = { value: 'skip' in b.dataset ? '' : String(draft(`${s.id}:${st.id}:p`).value || '').trim(), thinking: '' };
      touch(s); save(); focusAfter = `#step-${safeId(st.id)}`; renderLearnKeepScroll();
    }
    else if (act === 'check-submit') { const s = curLearn(); if (s) submitCheck(s, id); }
    else if (act === 'summary-add') { const s = curLearn(); if (s) addSummary(s); }
    else if (act === 'practice-start') startPractice();
    else if (act === 'practice-next') { const s = curPractice(); if (s && (s.practice.items.length >= s.practice.queue.length || needAI())) run(s.id, () => nextItem(s)); }
    else if (act === 'practice-submit') { const s = curPractice(); if (s) submitPractice(s, id); }
    else if (act === 'practice-regrade') { const s = curPractice(), it = s?.practice.items.find((x) => x.id === id); if (it && needAI()) run(s.id, () => gradeItem(s, it)); }
    else if (act === 'hint') {
      const s = curPractice(), it = s?.practice.items.find((x) => x.id === id);
      if (!it || it.hintsUsed >= it.hints.length) return;
      it.hintsUsed++; touch(s); save(); renderLearnKeepScroll();
      announce(t(`提示 ${it.hintsUsed}`, `Hint ${it.hintsUsed}`));
    }
    else if (act === 'kg-goto') { kgSel = id; kgQuery = ''; }
    else if (act === 'kg-pick') pickProp(id, true);
    else if (act === 'kg-del') {
      const p = propById(id);
      if (!p || !confirm(t('删除这条命题？用到它的推理链也会一起删掉。', 'Delete this claim? Chains that use it are deleted too.'))) return;
      C.removeProp(state, id); save(); kgSel = null; render();
      announce(t('已删除', 'Deleted'));
    }
    else if (act === 'import-extract') extract();
    else if (act === 'import-add') importAdd();
    else if (act === 'import-clear') { imp.text = ''; imp.name = ''; imp.preview = null; imp.msg = ''; render(); }
    else if (act === 'export') exportData(false);
    else if (act === 'export-graph') exportData(true);
    else if (act === 'import-cancel') { pendingImport = null; render(); }
    else if (act === 'import-merge' || act === 'import-replace') {
      if (!pendingImport) return;
      const usePrompts = !!pendingImport.prompts && !!$('#data-pi-prompts')?.checked;
      if (act === 'import-replace') {
        const q = usePrompts ? t('用文件里的数据替换现在的全部数据，并换上文件里的提示词？现在的数据会丢失。', 'Replace all current data with the file, and use the prompts from the file? What is here now will be lost.')
          : t('用文件里的数据替换现在的全部数据？现在的数据会丢失（你的提示词不变）。', 'Replace all current data with the file? What is here now will be lost (your prompts stay as they are).');
        if (!confirm(q)) return;
        state = pendingImport.state;
      } else mergeIn(pendingImport.state);
      if (usePrompts) { prompts = act === 'import-replace' ? { ...pendingImport.prompts } : { ...prompts, ...pendingImport.prompts }; store.set(C.PROMPT_KEY, prompts); }
      pendingImport = null; groundCache.clear(); save();
      dataMsg = act === 'import-replace' ? t('已替换。', 'Replaced.') : t('已合并。', 'Merged.');
      render();
    }
    else if (act === 'clear-all') {
      if (!confirm(t('清空研习台的全部会话、知识图和用量记录？这一步不能撤销，建议先导出。', 'Clear every Study Desk session, the knowledge graph and usage? This cannot be undone; export first if unsure.'))) return;
      state = C.emptyState(); save(); groundCache.clear(); openLearn = openPractice = kgSel = null;
      dataMsg = t('已清空。', 'Cleared.');
      render();
    }
    else if (act === 'prompt-save' || act === 'prompt-reset') {
      const k = b.dataset.key, ta = $(`#pr-${k}`);
      if (!ta) return;
      if (act === 'prompt-reset') { delete prompts[k]; ta.value = C.DEFAULT_PROMPTS[k]; }
      else if (ta.value.trim() && ta.value !== C.DEFAULT_PROMPTS[k]) prompts[k] = ta.value; else delete prompts[k];
      const ok = store.set(C.PROMPT_KEY, prompts);
      const openKeys = $$('.ln-prompt[open]').map((d) => d.dataset.key);
      render();
      for (const d of $$('.ln-prompt')) if (openKeys.includes(d.dataset.key)) d.open = true;
      const m = $(`[data-prompt-msg="${k}"]`);
      if (m) m.textContent = !ok ? t('没能保存（浏览器存储不可用）', 'Could not save (storage unavailable)') : act === 'prompt-reset' ? t('已恢复默认', 'Reset to default') : t('已保存', 'Saved');
    }
  });

  document.addEventListener('input', (e) => {
    const el = e.target;
    if (!panel.contains(el)) return;
    if (el.dataset.draft) {
      const d = draft(el.dataset.draft), f = el.dataset.field;
      d[f] = 'num' in el.dataset ? Number(el.value) : el.value;
      const msg = $(`[data-msg="${CSS.escape(el.dataset.draft)}"]`);
      if (msg) msg.textContent = '';
    } else if (el.dataset.form === 'goal') { form.goal = el.value; }
    else if ('photoText' in el.dataset) { const f = form.files[Number(el.dataset.photoText)]; if (f?.photo) { f.text = el.value.slice(0, C.FILE_RULES.maxBytes); f.size = f.text.length; } }
    else if (el.dataset.pform === 'focus') pform.focus = el.value;
    else if ('imp' in el.dataset) { imp.text = el.value; const c = $('#imp-count'); if (c) c.innerHTML = chunkNote(imp.text.trim() ? C.splitNotes(imp.text, 3500) : []); }
    else if (el.id === 'kg-q') { kgQuery = el.value; applySearch(); }
  });
  // 学习目标里粘贴照片或截图：当作附带的照片
  document.addEventListener('paste', (e) => {
    if (e.target?.id !== 'ln-goal' || !ai()?.imageFiles) return;
    const files = ai().imageFiles(e.clipboardData);
    if (!files.length) return;
    if (!e.clipboardData.getData('text/plain')) e.preventDefault();
    addPhotos(files);
  });
  document.addEventListener('change', async (e) => {
    const el = e.target;
    if (!panel.contains(el)) return;
    if (el.dataset.draft && el.type === 'radio') { draft(el.dataset.draft)[el.dataset.field] = 'num' in el.dataset ? Number(el.value) : el.value; }
    else if (el.dataset.form === 'src') loadSource(el.value);
    else if (el.dataset.form === 'ch') {
      const ch = S.chapters(form.srcId).find((c) => c.id === el.value);
      if (ch) chooseChapter(ch); else { form.chId = ''; form.source = null; if (form.goal === form.autoGoal) form.goal = form.autoGoal = ''; }
      render();
    }
    else if (el.dataset.pform === 'k') pform.k = Number(el.value) || 5;
    else if (el.id === 'ln-files') { await addFiles([...el.files]); }
    else if (el.id === 'ln-photos') { const fs = [...el.files]; el.value = ''; if (fs.length) await addPhotos(fs); }
    else if (el.id === 'imp-file') {
      const f = el.files[0];
      if (!f) return;
      if (f.size > 400 * 1024) { imp.msg = t('文件太大（超过 400 KB）。', 'The file is too large (over 400 KB).'); render(); return; }
      try { imp.text = await f.text(); imp.name = f.name; imp.msg = ''; imp.preview = null; } catch { imp.msg = t('读不了这个文件。', 'Could not read that file.'); }
      render();
    }
    else if (el.id === 'data-file') { const f = el.files[0]; if (f) readImport(f); }
  });

  renderAI();
  if (!location.hash) history.replaceState(null, '', '#learn');
  route();
})();
