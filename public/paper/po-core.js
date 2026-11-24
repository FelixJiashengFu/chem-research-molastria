/* 论文工坊的纯逻辑（po-core.js）：没有 DOM，tools/paper-test.mjs 测。
   流水线照 PaperOrchestra Studio（github.com/FelixJiashengFu/paper-orchestra-studio，Apache-2.0，fork 自 Google Research 的
   PaperOrchestra）的 paper-orchestra/ 在浏览器里重写：大纲 → 找文献 → 引言与相关工作 → 写其余各节 → 审稿与修改；
   提示词原样在 po-prompts.js。这里是：
   · 服务商：每家的接口地址、请求体（OpenAI 兼容 / Anthropic / Gemini）、流式返回的读法、用量；
   · 价格（照 PaperOrchestra Studio 的 utils/pricing.py，2026-11-19 核对）和每一步的花费；
   · 每一步用哪个模型（照 resolve_task_model 的默认路由，用户可以逐步改）；
   · 期刊的 venue_note、模型回答里取 JSON 和 LaTeX、大纲里的检索任务、把引用键填回大纲；
   · 学术检索：OpenAlex、Semantic Scholar、Crossref、arXiv、Europe PMC、dblp 的地址和返回值整理，截止日期、去重、
     difflib 一样的标题相似度、引用键和 BibTeX；
   · 审稿：几份审稿意见取平均、按 PaperOrchestra 的规则决定留下修改稿还是退回；
   · 引用核对（离线）：正文的 \cite 和 .bib 对得上吗；联网核对单条文献的判断；
   · 不压缩的 zip、Overleaf 的表单字段、小的 Markdown 渲染、CSV 和数模的三模型基准、图的规格。
   API key 只由调用方传进 request()，这里不存、不记日志。 */
(function (root) {
  'use strict';

  // ── 服务商 ─────────────────────────────────────────────────────────────
  // kind：openai = /chat/completions 兼容接口；anthropic = Messages API；gemini = generateContent。
  // models 是建议的模型 id（照 PaperOrchestra Studio 的 providers.py / pricing.py，2026-11-19），也可以自己填或从 /models 列出来。
  const PROVIDERS = {
    openai: { label: 'OpenAI', kind: 'openai', base: 'https://api.openai.com/v1', keyUrl: 'https://platform.openai.com/api-keys', models: ['gpt-6.2-sol', 'gpt-6.1-terra', 'gpt-6-luna', 'gpt-6.2-astra'] },
    anthropic: { label: 'Anthropic Claude', kind: 'anthropic', base: 'https://api.anthropic.com', keyUrl: 'https://platform.claude.com/settings/keys', models: ['claude-sonnet-5-5', 'claude-opus-5-5', 'claude-haiku-5-5', 'claude-fable-5-2'] },
    gemini: { label: 'Google Gemini', kind: 'gemini', base: 'https://generativelanguage.googleapis.com/v1beta', keyUrl: 'https://aistudio.google.com/apikey', models: ['gemini-4-argon', 'gemini-3.8-flash', 'gemini-4-hydrogen', 'gemini-3.1-pro-preview'] },
    deepseek: { label: 'DeepSeek', kind: 'openai', base: 'https://api.deepseek.com', keyUrl: 'https://platform.deepseek.com/api_keys', models: ['deepseek-v4-pro', 'deepseek-flash'] },
    openrouter: { label: 'OpenRouter', kind: 'openai', base: 'https://openrouter.ai/api/v1', keyUrl: 'https://openrouter.ai/keys', models: ['anthropic/claude-sonnet-5.5', 'openai/gpt-6.2-sol', 'google/gemini-4-argon', 'deepseek/deepseek-v4-pro'] },
    qwen: { label: '通义千问 Qwen', kind: 'openai', base: 'https://dashscope.aliyuncs.com/compatible-mode/v1', keyUrl: 'https://bailian.console.aliyun.com/', models: ['qwen4-max', 'qwen3.8-max', 'qwen-max', 'qwen-plus'] },
    moonshot: { label: 'Kimi（月之暗面）', kind: 'openai', base: 'https://api.moonshot.cn/v1', keyUrl: 'https://platform.moonshot.cn/console/api-keys', models: ['kimi-k3.1-pro', 'kimi-k2.6'] },
    zhipu: { label: '智谱 GLM', kind: 'openai', base: 'https://open.bigmodel.cn/api/paas/v4', keyUrl: 'https://open.bigmodel.cn/usercenter/apikeys', models: ['glm-5.3', 'glm-5', 'glm-4-plus'] },
    hunyuan: { label: '腾讯混元', kind: 'openai', base: 'https://tokenhub.tencentmaas.com/v1', keyUrl: 'https://console.cloud.tencent.com/hunyuan', models: ['hy4', 'hy4-flash', 'hy3'] },
    qianfan: { label: '百度千帆（文心）', kind: 'openai', base: 'https://qianfan.baidubce.com/v2', keyUrl: 'https://console.bce.baidu.com/qianfan/', models: ['ernie-5.1'] },
    siliconflow: { label: '硅基流动 SiliconFlow', kind: 'openai', base: 'https://api.siliconflow.cn/v1', keyUrl: 'https://cloud.siliconflow.cn/account/ak', models: ['deepseek-ai/DeepSeek-V3.2', 'deepseek-ai/DeepSeek-V3'] },
    xai: { label: 'xAI Grok', kind: 'openai', base: 'https://api.x.ai/v1', keyUrl: 'https://console.x.ai/', models: ['grok-4.7', 'grok-4.5'] },
    mistral: { label: 'Mistral', kind: 'openai', base: 'https://api.mistral.ai/v1', keyUrl: 'https://console.mistral.ai/api-keys', models: ['mistral-large-latest'] },
    groq: { label: 'Groq', kind: 'openai', base: 'https://api.groq.com/openai/v1', keyUrl: 'https://console.groq.com/keys', models: ['llama-3.3-70b-versatile'] },
    together: { label: 'Together AI', kind: 'openai', base: 'https://api.together.xyz/v1', keyUrl: 'https://api.together.ai/settings/api-keys', models: [] },
    ollama: { label: 'Ollama（本机）', kind: 'openai', base: 'http://localhost:11434/v1', keyOptional: true, local: true, models: [] },
    lmstudio: { label: 'LM Studio（本机）', kind: 'openai', base: 'http://localhost:1234/v1', keyOptional: true, local: true, models: [] },
    vllm: { label: 'vLLM（本机）', kind: 'openai', base: 'http://localhost:8000/v1', keyOptional: true, local: true, models: [] },
    custom: { label: '其他兼容接口 / 中转站', kind: 'openai', base: '', custom: true, models: [] },
  };
  const trimBase = (b) => String(b || '').trim().replace(/\/+$/, '');

  /** 从一个模型 id 猜它属于哪家（用户只填了模型名时用）。 */
  function guessProvider(model) {
    const m = String(model || '').toLowerCase();
    if (m.includes('/')) return 'openrouter';
    if (m.startsWith('claude')) return 'anthropic';
    if (m.startsWith('gemini')) return 'gemini';
    if (m.startsWith('deepseek')) return 'deepseek';
    if (/^(gpt|o\d|chatgpt)/.test(m)) return 'openai';
    if (m.startsWith('qwen')) return 'qwen';
    if (m.startsWith('kimi') || m.startsWith('moonshot')) return 'moonshot';
    if (m.startsWith('glm')) return 'zhipu';
    if (m.startsWith('hy')) return 'hunyuan';
    if (m.startsWith('ernie')) return 'qianfan';
    if (m.startsWith('grok')) return 'xai';
    if (m.startsWith('mistral')) return 'mistral';
    return '';
  }
  /** "provider:model" 或只有模型名 → { provider, model }。 */
  function splitRef(ref) {
    const s = String(ref || '').trim();
    const i = s.indexOf(':');
    if (i > 0 && PROVIDERS[s.slice(0, i)]) return { provider: s.slice(0, i), model: s.slice(i + 1) };
    return { provider: guessProvider(s), model: s };
  }

  /** 一次调用的 fetch 参数。o: { provider, base?, key, model, system, prompt | messages, maxTokens, temperature, stream, images? }
      images：[{ mime, data(base64) }]，只放进最后一条用户消息。 */
  function request(o) {
    const p = PROVIDERS[o.provider];
    if (!p) throw new Error('unknown-provider');
    const base = trimBase(o.base || p.base);
    if (!base) throw new Error('no-base');
    if (!o.key && !p.keyOptional && !p.custom) throw new Error('no-key');
    const messages = o.messages || [{ role: 'user', content: String(o.prompt || '') }];
    const maxTokens = o.maxTokens || 16000;
    const temp = typeof o.temperature === 'number' ? o.temperature : undefined;
    const imgs = o.images || [];
    const headers = { 'content-type': 'application/json' };
    if (p.kind === 'anthropic') {
      headers['x-api-key'] = o.key;
      headers['anthropic-version'] = '2023-06-01';
      headers['anthropic-dangerous-direct-browser-access'] = 'true';
      const msgs = messages.map((m, i) => ({ role: m.role === 'assistant' ? 'assistant' : 'user', content: i === messages.length - 1 && imgs.length
        ? [...imgs.map((im) => ({ type: 'image', source: { type: 'base64', media_type: im.mime, data: im.data } })), { type: 'text', text: m.content }]
        : m.content }));
      const body = { model: o.model, max_tokens: maxTokens, messages: msgs, stream: !!o.stream };
      if (o.system) body.system = o.system;
      if (temp !== undefined) body.temperature = temp;
      return { url: `${base}/v1/messages`, init: { method: 'POST', headers, body: JSON.stringify(body) } };
    }
    if (p.kind === 'gemini') {
      headers['x-goog-api-key'] = o.key;
      const contents = messages.map((m, i) => ({ role: m.role === 'assistant' ? 'model' : 'user', parts: [
        ...(i === messages.length - 1 ? imgs.map((im) => ({ inline_data: { mime_type: im.mime, data: im.data } })) : []),
        { text: m.content }] }));
      const body = { contents, generationConfig: { maxOutputTokens: maxTokens } };
      if (temp !== undefined) body.generationConfig.temperature = temp;
      if (o.system) body.systemInstruction = { parts: [{ text: o.system }] };
      const model = encodeURIComponent(o.model);
      return { url: o.stream ? `${base}/models/${model}:streamGenerateContent?alt=sse` : `${base}/models/${model}:generateContent`, init: { method: 'POST', headers, body: JSON.stringify(body) } };
    }
    if (o.key) headers.authorization = `Bearer ${o.key}`;
    if (o.provider === 'openrouter') { headers['x-title'] = 'MolAstria Paper Studio'; }
    const msgs = [];
    if (o.system) msgs.push({ role: 'system', content: o.system });
    messages.forEach((m, i) => msgs.push({ role: m.role, content: i === messages.length - 1 && imgs.length
      ? [{ type: 'text', text: m.content }, ...imgs.map((im) => ({ type: 'image_url', image_url: { url: `data:${im.mime};base64,${im.data}` } }))]
      : m.content }));
    const body = { model: o.model, messages: msgs, stream: !!o.stream };
    // OpenAI 的新模型只认 max_completion_tokens；其他兼容接口大多只认 max_tokens。
    if (o.provider === 'openai') body.max_completion_tokens = maxTokens; else body.max_tokens = maxTokens;
    if (temp !== undefined && !(o.provider === 'openai' && /^(gpt-6|o\d)/.test(o.model))) body.temperature = temp;
    if (o.stream && !p.local) body.stream_options = { include_usage: true };
    return { url: `${base}/chat/completions`, init: { method: 'POST', headers, body: JSON.stringify(body) } };
  }

  /** 列模型的地址（OpenAI 兼容的 /models、Anthropic 的 /v1/models、Gemini 的 /models）。 */
  function modelsRequest(provider, base, key) {
    const p = PROVIDERS[provider];
    const b = trimBase(base || p.base);
    if (p.kind === 'anthropic') return { url: `${b}/v1/models?limit=100`, init: { headers: { 'x-api-key': key, 'anthropic-version': '2023-06-01', 'anthropic-dangerous-direct-browser-access': 'true' } } };
    if (p.kind === 'gemini') return { url: `${b}/models?pageSize=200`, init: { headers: { 'x-goog-api-key': key } } };
    return { url: `${b}/models`, init: { headers: key ? { authorization: `Bearer ${key}` } : {} } };
  }
  function parseModels(provider, json) {
    const p = PROVIDERS[provider];
    if (p.kind === 'gemini') return (json?.models || []).filter((m) => (m.supportedGenerationMethods || []).includes('generateContent')).map((m) => String(m.name || '').replace(/^models\//, '')).filter(Boolean);
    return (json?.data || json?.models || []).map((m) => m.id || m.name).filter(Boolean).sort();
  }

  /** 流式返回：把一段文本按 SSE 拆成事件，返回 { events: [解析过的 JSON], rest }。 */
  function sseSplit(buffer) {
    const events = [];
    const parts = buffer.replace(/\r\n/g, '\n').split('\n\n');
    const rest = parts.pop();
    for (const block of parts) {
      const data = block.split('\n').filter((l) => l.startsWith('data:')).map((l) => l.slice(5).trimStart()).join('\n');
      if (!data || data === '[DONE]') continue;
      try { events.push(JSON.parse(data)); } catch { /* 不完整或心跳 */ }
    }
    return { events, rest };
  }
  /** 一个流式事件 → { text, usage?, stop?, error? }。usage 字段：input、output、cacheRead。 */
  function streamDelta(kind, ev) {
    if (ev?.error) return { text: '', error: ev.error.message || JSON.stringify(ev.error) };
    if (kind === 'anthropic') {
      if (ev.type === 'content_block_delta' && ev.delta?.type === 'text_delta') return { text: ev.delta.text || '' };
      if (ev.type === 'message_start') { const u = ev.message?.usage || {}; return { text: '', usage: { input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0), cacheRead: u.cache_read_input_tokens || 0 } }; }
      if (ev.type === 'message_delta') return { text: '', usage: { output: ev.usage?.output_tokens || 0 }, stop: ev.delta?.stop_reason };
      return { text: '' };
    }
    if (kind === 'gemini') {
      const c = ev.candidates?.[0];
      const text = (c?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join('');
      const u = ev.usageMetadata;
      return { text, usage: u ? { input: u.promptTokenCount || 0, output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), cacheRead: u.cachedContentTokenCount || 0, replace: true } : undefined, stop: c?.finishReason };
    }
    const ch = ev.choices?.[0];
    const u = ev.usage;
    return { text: ch?.delta?.content || '', usage: u ? { input: u.prompt_tokens || 0, output: u.completion_tokens || 0, cacheRead: u.prompt_tokens_details?.cached_tokens || u.prompt_cache_hit_tokens || 0, replace: true } : undefined, stop: ch?.finish_reason || undefined };
  }
  /** 不流式时的完整回答 → { text, usage, stop }。 */
  function parseReply(kind, json) {
    if (kind === 'anthropic') {
      const u = json.usage || {};
      return { text: (json.content || []).filter((c) => c.type === 'text').map((c) => c.text).join(''), usage: { input: (u.input_tokens || 0) + (u.cache_creation_input_tokens || 0), output: u.output_tokens || 0, cacheRead: u.cache_read_input_tokens || 0 }, stop: json.stop_reason };
    }
    if (kind === 'gemini') {
      const c = json.candidates?.[0], u = json.usageMetadata || {};
      return { text: (c?.content?.parts || []).filter((x) => !x.thought).map((x) => x.text || '').join(''), usage: { input: u.promptTokenCount || 0, output: (u.candidatesTokenCount || 0) + (u.thoughtsTokenCount || 0), cacheRead: u.cachedContentTokenCount || 0 }, stop: c?.finishReason };
    }
    const u = json.usage || {};
    return { text: json.choices?.[0]?.message?.content || '', usage: { input: u.prompt_tokens || 0, output: u.completion_tokens || 0, cacheRead: u.prompt_tokens_details?.cached_tokens || u.prompt_cache_hit_tokens || 0 }, stop: json.choices?.[0]?.finish_reason };
  }
  /** 累加流式用量：Gemini 和 OpenAI 每次给累计值（replace），Anthropic 分开给输入和输出。 */
  function addUsage(acc, u) {
    if (!u) return acc;
    if (u.replace) return { input: u.input || acc.input, output: u.output || acc.output, cacheRead: u.cacheRead || acc.cacheRead };
    return { input: u.input ?? acc.input, output: u.output ?? acc.output, cacheRead: u.cacheRead ?? acc.cacheRead };
  }
  /** 报错的原因 → 一个代号，界面再翻成人话。 */
  function errorCode(status, text) {
    const t = String(text || '').toLowerCase();
    if (status === 401 || status === 403 || /invalid.*(api|key)|incorrect api key|unauthori[sz]ed|permission/.test(t)) return 'auth';
    if (status === 404 || /model.*(not found|does not exist)|unknown model|no such model/.test(t)) return 'model';
    if (status === 429 || /rate limit|quota|insufficient|balance|credit/.test(t)) return 'quota';
    if (status === 400 && /(max_tokens|max_completion_tokens|maxoutputtokens|context|too long|maximum)/.test(t)) return 'length';
    if (status >= 500) return 'server';
    return 'other';
  }

  // ── 价格 ──────────────────────────────────────────────────────────────
  // 每百万 token 的列表价，币种是平台自己的（照 PaperOrchestra Studio 的 utils/pricing.py，PRICES_CHECKED = 2026-11-19）。
  // [币种, 输入, 输出, 缓存读取]。只是估算：不算免费额度、折扣和税；长上下文的加价没有算进来。
  const PRICES_CHECKED = '2026-11-19';
  const PRICES = {
    'claude-fable-5-2': ['USD', 8, 40, 0.2], 'claude-opus-5-5': ['USD', 4, 20, 0.2], 'claude-opus-5': ['USD', 5, 25, 0.5], 'claude-opus-4-8': ['USD', 5, 25, 0.5],
    'claude-sonnet-5-5': ['USD', 2, 10, 0.1], 'claude-sonnet-5': ['USD', 2, 10, 0.2], 'claude-sonnet-4-6': ['USD', 3, 15, 0.3], 'claude-sonnet-4-5': ['USD', 3, 15, 0.3],
    'claude-haiku-5-5': ['USD', 0.1, 0.5, 0.01], 'claude-haiku-4-5': ['USD', 1, 5, 0.1],
    'gemini-4-hydrogen': ['USD', 1.5, 7.5], 'gemini-3.1-pro-preview': ['USD', 2, 12, 0.2], 'gemini-3-flash-preview': ['USD', 0.5, 3, 0.05],
    'deepseek-flash': ['USD', 0.3, 1.2, 0.006], 'deepseek-v4-pro': ['USD', 1.32, 3.96, 0.044],
    'gpt-6.2-astra': ['USD', 8, 40, 0.4], 'gpt-6.2-sol': ['USD', 2, 10, 0.1], 'gpt-6.1-terra': ['USD', 1, 5, 0.05], 'gpt-6-luna': ['USD', 0.1, 0.5, 0.01],
    'gpt-5.5': ['USD', 5, 30, 0.5], 'gpt-4.1': ['USD', 2, 8, 0.5], 'gpt-4o': ['USD', 2.5, 10, 1.25],
    'grok-4.7': ['USD', 2, 6, 0.5], 'grok-4.5': ['USD', 2, 6, 0.3], 'grok-4.3': ['USD', 1.25, 2.5, 0.2],
    'mistral-large-latest': ['USD', 0.7, 2.1, 0.07],
    'qwen4-max': ['CNY', 10, 30, 0.5], 'qwen3.8-max': ['CNY', 12, 36], 'qwen-max': ['CNY', 2.4, 9.6], 'qwen-plus': ['CNY', 0.8, 2], 'qwen3.7-plus': ['CNY', 2, 8],
    'kimi-k2.6': ['CNY', 6.5, 27, 1.1],
    'glm-5': ['CNY', 4, 18, 1], 'glm-5.3': ['CNY', 8, 28, 2], 'glm-4-plus': ['CNY', 5, 5, 2.5],
    'hy4': ['CNY', 6, 18, 0.3], 'hy4-flash': ['CNY', 0.5, 2, 0.02], 'hy3': ['CNY', 1, 4, 0.25],
    'ernie-5.1': ['CNY', 4, 18],
    'deepseek-ai/deepseek-v3': ['CNY', 2, 8], 'deepseek-ai/deepseek-v3.2': ['CNY', 4, 6, 0.4],
  };
  function priceOf(model) {
    const m = String(model || '').toLowerCase();
    if (PRICES[m]) return PRICES[m];
    const tail = m.includes('/') ? m.split('/').pop().replace(/\./g, '-') : '';
    if (tail && PRICES[tail]) return PRICES[tail];
    const dated = m.replace(/-\d{8}$/, '');
    return PRICES[dated] || null;
  }
  /** 一次调用的估价 { currency, amount } 或 null（价格表里没有）。缓存读取的 token 按缓存价，其余输入按输入价。 */
  function costOf(model, usage) {
    const p = priceOf(model);
    if (!p || !usage) return null;
    const [cur, inp, out, cache] = p;
    const cached = Math.min(usage.cacheRead || 0, usage.input || 0);
    const amount = ((usage.input - cached) * inp + cached * (cache ?? inp) + (usage.output || 0) * out) / 1e6;
    return { currency: cur, amount };
  }
  /** 一串调用记录按币种加总。 */
  function totals(calls) {
    const t = { input: 0, output: 0, calls: 0, money: {}, unpriced: 0 };
    for (const c of calls || []) {
      t.calls++;
      t.input += c.usage?.input || 0;
      t.output += c.usage?.output || 0;
      const cost = costOf(c.model, c.usage);
      if (cost) t.money[cost.currency] = (t.money[cost.currency] || 0) + cost.amount;
      else t.unpriced++;
    }
    return t;
  }

  // ── 每一步用哪个模型 ───────────────────────────────────────────────────
  // 照 PaperOrchestra Studio 的 resolve_task_model：每一步有一串首选（哪家有 key 就用哪家），用户可以逐步指定。
  const TASKS = [
    { id: 'outline', zh: '大纲规划', en: 'Outline', pick: [['deepseek', 'deepseek-v4-pro'], ['anthropic', 'claude-sonnet-5-5'], ['openai', 'gpt-6.2-sol'], ['gemini', 'gemini-4-argon']] },
    { id: 'literature_query', zh: '文献检索词', en: 'Search queries', pick: [['deepseek', 'deepseek-flash'], ['anthropic', 'claude-sonnet-5-5'], ['openai', 'gpt-6.1-terra'], ['gemini', 'gemini-3.8-flash']] },
    { id: 'relevance_screen', zh: '文献筛选', en: 'Relevance screen', parent: 'literature_query' },
    { id: 'literature_write', zh: '引言与相关工作', en: 'Intro & related work', pick: [['anthropic', 'claude-sonnet-5-5'], ['deepseek', 'deepseek-flash'], ['openai', 'gpt-6.2-sol'], ['gemini', 'gemini-4-argon']] },
    { id: 'plot_code', zh: '绘图', en: 'Figures', pick: [['deepseek', 'deepseek-flash'], ['anthropic', 'claude-sonnet-5-5'], ['openai', 'gpt-6.1-terra'], ['gemini', 'gemini-4-argon']] },
    { id: 'section_writing', zh: '正文写作', en: 'Section writing', pick: [['anthropic', 'claude-sonnet-5-5'], ['openai', 'gpt-6.2-sol'], ['gemini', 'gemini-4-argon'], ['deepseek', 'deepseek-v4-pro']] },
    { id: 'peer_review', zh: '模拟审稿', en: 'Peer review', pick: [['deepseek', 'deepseek-v4-pro'], ['anthropic', 'claude-sonnet-5-5'], ['openai', 'gpt-6.2-sol'], ['gemini', 'gemini-4-argon']] },
    { id: 'content_refinement', zh: '按审稿意见修改', en: 'Refinement', pick: [['anthropic', 'claude-sonnet-5-5'], ['openai', 'gpt-6.2-sol'], ['gemini', 'gemini-4-argon'], ['deepseek', 'deepseek-v4-pro']] },
    { id: 'studio', zh: '科研工坊', en: 'Research studio', pick: [['anthropic', 'claude-sonnet-5-5'], ['deepseek', 'deepseek-v4-pro'], ['openai', 'gpt-6.2-sol'], ['gemini', 'gemini-4-argon']] },
    { id: 'copilot', zh: 'LaTeX 助手', en: 'LaTeX copilot', parent: 'content_refinement' },
  ];
  /** settings: { keys: {provider: key}, bases: {provider: base}, routes: {task: 'provider:model'}, fallback: 'provider:model' } → { provider, model } 或 null。 */
  function resolveTask(task, settings) {
    const s = settings || {};
    const has = (p) => !!PROVIDERS[p] && (!!s.keys?.[p] || (PROVIDERS[p].keyOptional && !!s.bases?.[p]) || (PROVIDERS[p].custom && !!s.bases?.[p]));
    const explicit = s.routes?.[task];
    if (explicit) { const r = splitRef(explicit); if (r.provider && r.model) return r; }
    const t = TASKS.find((x) => x.id === task);
    if (t?.parent) return resolveTask(t.parent, { ...s, routes: { ...s.routes, [task]: '' } });
    if (s.fallback) { const r = splitRef(s.fallback); if (r.provider && r.model && has(r.provider)) return r; }
    for (const [p, m] of t?.pick || []) if (has(p)) return { provider: p, model: m };
    // 只配了别家（千问、Kimi、本机……）：用它在设置里选的第一个模型
    for (const p of Object.keys(PROVIDERS)) if (has(p)) { const m = s.models?.[p] || PROVIDERS[p].models[0]; if (m) return { provider: p, model: m }; }
    return null;
  }

  // ── 提示词 ────────────────────────────────────────────────────────────
  /** Python 的 str.format：{name} 换成值，{{ 和 }} 换成单个括号。没给的名字原样留着。 */
  function fill(template, vars = {}) {
    return String(template).replace(/\{\{|\}\}|\{([A-Za-z_][A-Za-z0-9_]*)\}/g, (m, name) => {
      if (m === '{{') return '{';
      if (m === '}}') return '}';
      return Object.prototype.hasOwnProperty.call(vars, name) ? String(vars[name]) : m;
    });
  }

  /** utils/venue_profile.py 的 venue_note：期刊模板（venue.json 的 kind 是 journal）给每个角色加的一段说明；会议模板返回空串。 */
  function venueNote(profile, role) {
    if (!profile || profile.kind !== 'journal') return '';
    const ROLES = ['outline', 'literature', 'writing', 'refinement', 'review', 'meta_review'];
    if (!ROLES.includes(role)) throw new Error(`unknown role ${role}`);
    const text = (key, d = '') => { const v = profile[key]; if (Array.isArray(v)) return v.map((x) => String(x).trim()).filter(Boolean).join('; '); return v == null ? d : String(v).trim(); };
    const venue = text('venue_name') || 'the target journal';
    const short = text('short_name');
    const label = short && !venue.includes(short) ? `${venue} (${short})` : venue;
    const field = text('field') || 'its field';
    const sections = text('section_order'), abstract = text('abstract_limit'), style = text('writing_style'), focus = text('reviewer_focus'), figures = text('figure_style'), extras = text('extras');
    const reviewModel = text('review_model') || 'single-blind';
    if (role === 'review' || role === 'meta_review') {
      const who = role === 'review' ? 'an expert referee' : 'the handling editor';
      const lines = ['', '### Target venue', `You act as ${who} for ${label}, a peer-reviewed journal in ${field}, not a machine-learning conference. Read every mention of 'the conference' in the instructions and rubric as this journal, and judge by its standards.`];
      if (focus) lines.push(`What referees at this journal weigh: ${focus}`);
      lines.push('- Audit claim-to-evidence alignment (flag overclaiming or unsupported causal leaps), statistical reporting completeness (sample size n, exact tests, error bar definitions, effect sizes/confidence intervals), and consistency between figure panels, legends and text.');
      lines.push('Author names in the manuscript are placeholders by design; do not penalise them, and do not ask for anonymisation.');
      return lines.join('\n') + '\n';
    }
    const lines = ['', '### Target venue (this overrides conference-specific wording above)',
      `This paper is for ${label}, a peer-reviewed journal in ${field}, not a machine-learning conference. Where the instructions above mention NeurIPS, ICML, CVPR, ICLR or ML conferences, double-blind anonymity, a separate Related Work section, 'experiments', baselines or page limits, apply them in this journal's terms:`,
      `- Review model: ${reviewModel}. Keep the author placeholder block of template.tex exactly as it is; never invent author names, affiliations, funding, grant numbers, dates or data.`];
    if (sections) lines.push(`- Structure: the \\section commands of template.tex, in this order: ${sections}. There is no separate Related Work section: literature context and the state of the art belong in the Introduction (and in Results and Discussion when comparing with earlier computed or measured values). Do not add sections template.tex does not have.`);
    if (abstract) lines.push(`- Abstract: ${abstract}.`);
    lines.push('- Length: follow the target length and word limits in conference_guidelines.md instead of a conference page limit.');
    if (style) lines.push(`- Style: ${style}`);
    if (extras) lines.push(`- Journal-specific parts: ${extras} (how to fill them is in conference_guidelines.md).`);
    if (role === 'outline') {
      lines.push("- Keep the JSON keys exactly as specified (intro_related_work_plan, related_work_strategy, ...): they drive the literature search. Plan the related-work material as background paragraphs of the Introduction. Treat the calculations and analyses in experimental_log.md as the study's 'experiments'.");
      lines.push('- Claim-driven architecture: ensure every Results subsection and every planned figure owns one explicit scientific claim backed by concrete evidence in the logs; assign distinct panel roles (a, b, c) when planning multi-panel figures.');
      if (figures) lines.push(`- Figures (write the plotting_plan to match): ${figures}`);
    } else if (role === 'literature') {
      lines.push('- template.tex has no Related Work section: write the related-work discussion as part of the Introduction, add no new \\section, and leave every other section untouched. The citation requirements above still apply.');
    } else if (role === 'writing') {
      lines.push('- Methods and computational details must be reproducible and come only from the provided materials (software and version, level of theory or force field, basis set, dispersion and solvation treatment, convergence criteria, sampling length, reference data). Leave out what the materials do not state; do not guess it.');
      lines.push('- Use \\ce{...} for chemical formulas and reactions and \\SI/\\qty/\\si for quantities, as the template provides; keep units consistent.');
      lines.push("- Prose discipline (anti-AI & anti-defensive style): zero em-dashes (---) and zero semicolons in the abstract, and at most one em-dash or semicolon per body paragraph (never paired em-dashes); avoid AI clichés ('delve', 'tapestry', 'realm', 'holistic', 'underscore', 'pivotal', 'seamless', 'harness', 'intricate', 'it is worth noting', 'Taken together,'). Lead paragraphs with findings rather than defensive caveats, and hedge once rather than stacking hedges.");
      lines.push('- Statistical reporting: whenever quantitative comparisons or inferential tests appear in the provided materials, report sample size n, exact test or metric, error bar definition (s.d., s.e.m., CI) and exact p/effect size; never invent numbers.');
      lines.push("- Back-matter statements (data or code availability, conflicts of interest, author contributions, acknowledgements, supporting information) may only state what the materials say; otherwise write 'To be completed by the authors.'");
      if (figures) lines.push(`- Figures: ${figures}`);
    } else if (role === 'refinement') {
      if (focus) lines.push(`- Revise as a referee of this journal would judge it: ${focus}`);
      lines.push('- Polish prose for publication: remove em-dash/semicolon tics (none in abstract, <= 1 per paragraph), trim redundant hedges and empty throat-clearing, verify every figure/panel reference matches its caption, and keep all numbers and back-matter statements strictly faithful to the provided materials.');
      lines.push("- 'Preserve anonymity' here means: keep the author placeholders unchanged. Keep the journal-specific parts (TOC graphic or graphical abstract, highlights, statements) present and compilable.");
    }
    return lines.join('\n') + '\n';
  }

  /** utils/prompt_utils 外的两段：AgentReview 式审稿人的系统提示（“最好的情况”：内行、负责、善意）。 */
  function reviewerSystem(scores) {
    const S = scores || {};
    const rub = ['10', '8', '6', '5', '3', '1'].map((k, i, a) => `* ${k}: ${S[k] || ''}${i < a.length - 1 ? ';' : '. '}`).join('\n');
    return 'You are a reviewer. You write peer review of academic papers by evaluating their technical quality, originality, and clarity.\n\n'
      + 'Knowledgeability: You are knowledgeable, with a strong background and a PhD degree in the subject areas related to this paper. You possess the expertise necessary to scrutinize and provide insightful feedback to this paper.\n\n'
      + "Responsibility: As a responsible reviewer, you highly responsibly write paper reviews. You meticulously assess a research paper's technical accuracy, innovation, and relevance. You thoroughly read the paper, critically analyze the methodologies, and carefully consider the paper's contribution to the field.\n\n"
      + 'Intention: As a benign reviewer, your approach to reviewing is guided by a genuine intention to aid authors in enhancing their work. You provide detailed, constructive feedback, aimed at both validating robust research and guiding authors to refine and improve their work. You are also critical of technical flaws in the paper.\n\n'
      + `## Rubrics for Overall Rating\n${rub}`;
  }

  // ── 从模型的回答里取东西 ───────────────────────────────────────────────
  function fenced(text, lang) {
    const re = new RegExp('```\\s*' + lang + '\\s*\\n([\\s\\S]*?)```', 'gi');
    const out = [];
    let m;
    while ((m = re.exec(String(text || '')))) out.push(m[1]);
    return out;
  }
  /** 回答里的 JSON：先找 ```json 块，再找第一个配平的 {...}。解析不了返回 null。 */
  function extractJSON(text) {
    const t = String(text || '');
    for (const block of [...fenced(t, 'json'), ...fenced(t, '')]) { const v = tryJSON(block); if (v !== undefined) return v; }
    const start = t.indexOf('{');
    if (start >= 0) {
      let depth = 0, inStr = false, esc = false;
      for (let i = start; i < t.length; i++) {
        const c = t[i];
        if (inStr) { if (esc) esc = false; else if (c === '\\') esc = true; else if (c === '"') inStr = false; continue; }
        if (c === '"') inStr = true;
        else if (c === '{') depth++;
        else if (c === '}' && --depth === 0) { const v = tryJSON(t.slice(start, i + 1)); return v === undefined ? null : v; }
      }
    }
    return null;
  }
  function tryJSON(s) {
    const x = String(s).trim();
    try { return JSON.parse(x); } catch { /* 再试一次：去掉结尾多余的逗号 */ }
    try { return JSON.parse(x.replace(/,\s*([}\]])/g, '$1')); } catch { return undefined; }
  }
  /** 回答里的 LaTeX：```latex / ```tex 块里最长的那段；没有代码块但整段像 LaTeX 时取整段。 */
  function extractLatex(text) {
    const t = String(text || '');
    const blocks = [...fenced(t, 'latex'), ...fenced(t, 'tex')];
    if (blocks.length) return blocks.sort((a, b) => b.length - a.length)[0].trim() + '\n';
    // 没写完的代码块（输出被截断）：从 ```latex 起到结尾
    const open = t.search(/```\s*(?:latex|tex)\s*\n/i);
    if (open >= 0) return t.slice(t.indexOf('\n', open) + 1).replace(/```\s*$/, '').trim() + '\n';
    if (/\\documentclass/.test(t)) return t.slice(t.indexOf('\\documentclass')).trim() + '\n';
    return '';
  }
  /** 看起来是不是一篇完整的 LaTeX（输出被截断时会缺 \end{document}）。 */
  function latexComplete(tex) {
    const t = String(tex || '');
    return /\\documentclass/.test(t) && /\\begin\{document\}/.test(t) && /\\end\{document\}/.test(t);
  }

  // ── 大纲 ──────────────────────────────────────────────────────────────
  function checkOutline(o) {
    const problems = [];
    if (!o || typeof o !== 'object') return ['not-object'];
    for (const k of ['plotting_plan', 'intro_related_work_plan', 'section_plan']) if (!(k in o)) problems.push(`missing:${k}`);
    if (o.plotting_plan && !Array.isArray(o.plotting_plan)) problems.push('plotting_plan:not-array');
    if (o.section_plan && !Array.isArray(o.section_plan)) problems.push('section_plan:not-array');
    for (const f of Array.isArray(o.plotting_plan) ? o.plotting_plan : []) {
      if (!['plot', 'diagram'].includes(f.plot_type)) problems.push(`figure:${f.figure_id}:plot_type`);
      if (/figure/i.test(f.figure_id || '')) problems.push(`figure:${f.figure_id}:id`);
    }
    return problems;
  }
  /** literature_review_agent._collect_search_tasks 的移植。 */
  function searchTasks(outline) {
    const tasks = [];
    const plan = outline?.intro_related_work_plan || {};
    const intro = plan.introduction_strategy || {};
    for (const d of intro.search_directions || []) tasks.push({ section: 'Introduction', focus: d, context: `Hook: ${intro.hook_hypothesis || ''}. Gap: ${intro.problem_gap_hypothesis || ''}`, type: 'exploration' });
    const rw = plan.related_work_strategy || {};
    for (const sub of rw.subsections || []) {
      let qs = sub.limitation_search_queries || [];
      if (!qs.length) qs = [`${sub.subsection_title || ''} ${sub.methodology_cluster || ''}`];
      for (const q of qs) tasks.push({ section: `Related Work: ${sub.subsection_title || 'General'}`, focus: q, context: `Mission: ${sub.sota_investigation_mission || ''}. Hypothesis: ${sub.limitation_hypothesis || ''}`, type: 'exploration' });
    }
    for (const sec of outline?.section_plan || []) {
      const st = sec.section_title || 'Unknown Section';
      for (const sub of sec.subsections || []) {
        const sbt = sub.subsection_title || 'General';
        for (const hint of sub.citation_hints || []) tasks.push({ section: `${st} - ${sbt}`, focus: hint, context: `Must-have citation for section covering: ${(sub.content_bullets || []).join(' ')}`, type: 'targeted' });
      }
    }
    return tasks;
  }
  /** 引用提示里的题目：“Vaswani et al. (Attention Is All You Need)” → 题目；“research paper … introducing 'X'” → X。 */
  function hintTitle(hint) {
    const s = String(hint || '');
    const q = s.match(/introducing\s+['"‘“]([^'"’”]+)['"’”]/i);
    if (q) return { title: '', name: q[1].trim() };
    const p = s.match(/\(([^()]{8,})\)\s*$/);
    if (p) return { title: p[1].trim(), name: '' };
    return { title: '', name: s.trim() };
  }
  /** _inject_citations_into_outline 的移植：每一节找到的文献键写回大纲，删掉 citation_hints。返回新的对象。 */
  function injectCitations(outline, papers) {
    const o = JSON.parse(JSON.stringify(outline || {}));
    const bySec = {};
    for (const p of papers) (bySec[p.section] = bySec[p.section] || []).push(p.key);
    const plan = o.intro_related_work_plan || (o.intro_related_work_plan = {});
    const intro = plan.introduction_strategy || (plan.introduction_strategy = {});
    intro.citation_candidates = [...new Set(bySec.Introduction || [])];
    for (const sub of plan.related_work_strategy?.subsections || []) sub.citation_candidates = bySec[`Related Work: ${sub.subsection_title || 'General'}`] || [];
    for (const sec of o.section_plan || []) {
      for (const sub of sec.subsections || []) {
        sub.citation_candidates = bySec[`${sec.section_title || 'Unknown Section'} - ${sub.subsection_title || 'General'}`] || [];
        delete sub.citation_hints;
      }
    }
    return o;
  }

  // ── 学术检索 ───────────────────────────────────────────────────────────
  // 都由浏览器直接问，不要 key（Semantic Scholar 可选填 key 提高限额）。每家只问需要的字段。
  const UA_MAILTO = ''; // 不带邮箱：不把用户信息发给外部服务
  const SCHOLAR = {
    openalex: { label: 'OpenAlex', search: (q, n, cutoff) => `https://api.openalex.org/works?search=${encodeURIComponent(q)}&per-page=${n}${cutoff ? `&filter=to_publication_date:${cutoffDay(cutoff)}` : ''}&select=id,doi,title,display_name,publication_year,publication_date,authorships,primary_location,abstract_inverted_index,cited_by_count,biblio,ids` },
    s2: { label: 'Semantic Scholar', search: (q, n) => `https://api.semanticscholar.org/graph/v1/paper/search?query=${encodeURIComponent(q)}&limit=${n}&fields=title,year,venue,abstract,authors,externalIds,citationCount,publicationDate,journal,url`, match: (t) => `https://api.semanticscholar.org/graph/v1/paper/search/match?query=${encodeURIComponent(t)}&fields=title,year,venue,abstract,authors,externalIds,citationCount,publicationDate,journal,url` },
    crossref: { label: 'Crossref', search: (q, n, cutoff) => `https://api.crossref.org/works?query.bibliographic=${encodeURIComponent(q)}&rows=${n}${cutoff ? `&filter=until-pub-date:${cutoffDay(cutoff)}` : ''}&select=DOI,title,author,issued,published-print,published-online,container-title,volume,page,abstract,is-referenced-by-count,type` },
    // arXiv 的接口（export.arxiv.org）不带 Access-Control-Allow-Origin，浏览器读不到返回值：页面不提供它，OpenAlex 里有 arXiv 的预印本。
    arxiv: { label: 'arXiv', browser: false, search: (q, n) => `https://export.arxiv.org/api/query?search_query=${encodeURIComponent('all:' + q.split(/\s+/).filter(Boolean).join(' AND all:'))}&max_results=${n}` },
    europepmc: { label: 'Europe PMC', search: (q, n) => `https://www.ebi.ac.uk/europepmc/webservices/rest/search?query=${encodeURIComponent(q)}&format=json&resultType=core&pageSize=${n}` },
    dblp: { label: 'dblp', search: (q, n) => `https://dblp.org/search/publ/api?q=${encodeURIComponent(q)}&format=json&h=${n}` },
  };
  const SCHOLAR_ORDER = ['openalex', 's2', 'crossref', 'arxiv', 'europepmc', 'dblp'];
  function cutoffDay(cutoff) {
    const [y, m = 12, d] = String(cutoff).split('-').map(Number);
    if (!y) return '';
    const last = d || new Date(Date.UTC(y, m, 0)).getUTCDate();
    return `${y}-${String(m).padStart(2, '0')}-${String(last).padStart(2, '0')}`;
  }
  const clean = (s) => String(s || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  function invertedAbstract(inv) {
    if (!inv || typeof inv !== 'object') return '';
    const words = [];
    for (const [w, pos] of Object.entries(inv)) for (const p of pos) words[p] = w;
    return words.filter((w) => w !== undefined).join(' ');
  }
  /** 每家的返回值 → 统一的条目：{ title, authors[], year, date, venue, journal, volume, pages, doi, arxiv, url, abstract, citations, source }。 */
  function normalize(source, data) {
    const out = [];
    if (source === 'openalex') {
      for (const w of data?.results || []) {
        const loc = w.primary_location?.source;
        const doi = w.doi ? String(w.doi).replace(/^https?:\/\/doi\.org\//i, '') : '';
        out.push({ title: clean(w.display_name || w.title), authors: (w.authorships || []).map((a) => a.author?.display_name).filter(Boolean), year: w.publication_year || null, date: w.publication_date || '', venue: loc?.display_name || '', journal: loc?.type === 'journal' ? loc.display_name : '', volume: w.biblio?.volume || '', pages: w.biblio?.first_page ? `${w.biblio.first_page}${w.biblio.last_page && w.biblio.last_page !== w.biblio.first_page ? '--' + w.biblio.last_page : ''}` : '', doi, arxiv: '', url: doi ? `https://doi.org/${doi}` : (w.id || ''), abstract: invertedAbstract(w.abstract_inverted_index), citations: w.cited_by_count || 0, source });
      }
    } else if (source === 's2') {
      const list = data?.data || (data?.paperId ? [data] : []);
      for (const p of list) {
        const ext = p.externalIds || {};
        out.push({ title: clean(p.title), authors: (p.authors || []).map((a) => a.name).filter(Boolean), year: p.year || null, date: p.publicationDate || '', venue: p.venue || p.journal?.name || '', journal: p.journal?.name || '', volume: p.journal?.volume || '', pages: (p.journal?.pages || '').replace(/\s/g, '').replace(/-+/, '--'), doi: ext.DOI || '', arxiv: ext.ArXiv || '', url: ext.DOI ? `https://doi.org/${ext.DOI}` : ext.ArXiv ? `https://arxiv.org/abs/${ext.ArXiv}` : (p.url || ''), abstract: clean(p.abstract), citations: p.citationCount || 0, source });
      }
    } else if (source === 'crossref') {
      for (const it of data?.message?.items || (data?.message?.DOI ? [data.message] : [])) {
        let year = null, date = '';
        for (const k of ['published-print', 'published-online', 'issued']) {
          const dp = it[k]?.['date-parts']?.[0];
          if (dp && dp[0]) { year = dp[0]; date = dp.map((x) => String(x).padStart(2, '0')).join('-'); break; }
        }
        const venue = (it['container-title'] || [''])[0] || '';
        out.push({ title: clean((it.title || [''])[0]), authors: (it.author || []).map((a) => [a.given, a.family].filter(Boolean).join(' ')).filter(Boolean), year, date, venue, journal: it.type === 'journal-article' ? venue : '', volume: it.volume || '', pages: (it.page || '').replace(/-+/, '--'), doi: it.DOI || '', arxiv: '', url: it.DOI ? `https://doi.org/${it.DOI}` : '', abstract: clean(it.abstract), citations: it['is-referenced-by-count'] || 0, source });
      }
    } else if (source === 'arxiv') {
      const xml = String(data || '');
      for (const m of xml.matchAll(/<entry>([\s\S]*?)<\/entry>/g)) {
        const e = m[1];
        const tag = (n) => (e.match(new RegExp(`<${n}[^>]*>([\\s\\S]*?)</${n}>`)) || [])[1] || '';
        const id = tag('id').replace(/^https?:\/\/arxiv\.org\/abs\//, '').replace(/v\d+$/, '');
        const pub = tag('published');
        const doi = (e.match(/<arxiv:doi[^>]*>([^<]+)</) || [])[1] || '';
        out.push({ title: decodeXml(clean(tag('title'))), authors: [...e.matchAll(/<name>([^<]+)<\/name>/g)].map((x) => decodeXml(x[1].trim())), year: pub ? Number(pub.slice(0, 4)) : null, date: pub.slice(0, 10), venue: 'arXiv', journal: '', volume: '', pages: '', doi, arxiv: id, url: `https://arxiv.org/abs/${id}`, abstract: decodeXml(clean(tag('summary'))), citations: 0, source });
      }
    } else if (source === 'europepmc') {
      for (const r of data?.resultList?.result || []) {
        const ji = r.journalInfo || {};
        out.push({ title: clean(r.title).replace(/\.$/, ''), authors: (r.authorList?.author || []).map((a) => a.fullName || [a.firstName, a.lastName].filter(Boolean).join(' ')).filter(Boolean), year: Number(r.pubYear) || null, date: r.firstPublicationDate || '', venue: ji.journal?.title || r.bookOrReportDetails?.publisher || '', journal: ji.journal?.title || '', volume: ji.volume || '', pages: (r.pageInfo || '').replace(/-+/, '--'), doi: r.doi || '', arxiv: '', url: r.doi ? `https://doi.org/${r.doi}` : `https://europepmc.org/article/${r.source}/${r.id}`, abstract: clean(r.abstractText), citations: r.citedByCount || 0, source });
      }
    } else if (source === 'dblp') {
      const hits = data?.result?.hits?.hit || [];
      for (const h of hits) {
        const i = h.info || {};
        const au = i.authors?.author;
        const names = (Array.isArray(au) ? au : au ? [au] : []).map((a) => String(a.text || a).replace(/\s\d{4}$/, ''));
        const doi = i.doi || '';
        out.push({ title: clean(i.title).replace(/\.$/, ''), authors: names, year: Number(i.year) || null, date: '', venue: i.venue || '', journal: i.type === 'Journal Articles' ? (i.venue || '') : '', volume: i.volume || '', pages: (i.pages || '').replace(/-+/, '--'), doi, arxiv: '', url: doi ? `https://doi.org/${doi}` : (i.ee || i.url || ''), abstract: '', citations: 0, source });
      }
    }
    return out.filter((x) => x.title);
  }
  function decodeXml(s) { return String(s).replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"').replace(/&#39;|&apos;/g, "'").replace(/&amp;/g, '&'); }

  /** _is_paper_allowed 的移植：发表日期晚于截止（年-月[-日]）就不要；不知道日期的留着。 */
  function allowedByCutoff(paper, cutoff) {
    if (!cutoff) return true;
    const [cy, cm = 12, cd = 1] = String(cutoff).split('-').map(Number);
    let py = null, pm = null, pd = null;
    if (paper.date) {
      const raw = String(paper.date).split('-');
      // int() 认不出任何一段时，原版整个日期都不用（try/except），只看年份
      if (raw.every((x) => /^\s*[+-]?\d+\s*$/.test(x))) { const parts = raw.map(Number); [py, pm, pd] = [parts[0], parts.length > 1 ? parts[1] : null, parts.length > 2 ? parts[2] : null]; }
    }
    if (py == null && paper.year) py = Number(paper.year);
    if (py == null) return true;
    if (py !== cy) return py < cy;
    if (pm == null) return true;
    if (pm !== cm) return pm < cm;
    if (pd == null) return true;
    return !(pd > cd);
  }
  /** literature agent 的 _normalize_title：只留小写字母和数字。 */
  const normKey = (t) => String(t || '').toLowerCase().replace(/[^a-z0-9]/g, '');

  /** submission_tools.norm_title：去 LaTeX、去重音、非字母数字变空格。 */
  function cleanLatexText(v) {
    if (!v) return '';
    return String(v).replace(/\\[A-Za-z]+\s*/g, ' ').replace(/[{}]/g, '').replace(/~/g, ' ').split(/\s+/).filter(Boolean).join(' ');
  }
  function normTitle(t) {
    return cleanLatexText(t).normalize('NFKD').replace(/[\u0300-\u036f]/g, '').toLowerCase().replace(/[^a-z0-9]+/g, ' ').trim();
  }
  /** difflib.SequenceMatcher(None, a, b) 的移植（没有 isjunk；b 不短于 200 项时照 autojunk 去掉高频项）。a、b 是字符串或字符串数组。 */
  function matcher(a, b) {
    const b2j = new Map();
    for (let i = 0; i < b.length; i++) { const c = b[i]; if (!b2j.has(c)) b2j.set(c, []); b2j.get(c).push(i); }
    if (b.length >= 200) { const ntest = Math.floor(b.length / 100) + 1; for (const [c, idx] of [...b2j]) if (idx.length > ntest) b2j.delete(c); }
    function longest(alo, ahi, blo, bhi) {
      let bi = alo, bj = blo, size = 0, j2len = new Map();
      for (let i = alo; i < ahi; i++) {
        const nj = new Map();
        for (const j of b2j.get(a[i]) || []) {
          if (j < blo) continue;
          if (j >= bhi) break;
          const k = (j2len.get(j - 1) || 0) + 1;
          nj.set(j, k);
          if (k > size) { bi = i - k + 1; bj = j - k + 1; size = k; }
        }
        j2len = nj;
      }
      while (bi > alo && bj > blo && a[bi - 1] === b[bj - 1]) { bi--; bj--; size++; }
      while (bi + size < ahi && bj + size < bhi && a[bi + size] === b[bj + size]) size++;
      return [bi, bj, size];
    }
    let blocksCache = null;
    function blocks() {
      if (blocksCache) return blocksCache;
      const found = [], queue = [[0, a.length, 0, b.length]];
      while (queue.length) {
        const [alo, ahi, blo, bhi] = queue.pop();
        const x = longest(alo, ahi, blo, bhi), [i, j, k] = x;
        if (k) {
          found.push(x);
          if (alo < i && blo < j) queue.push([alo, i, blo, j]);
          if (i + k < ahi && j + k < bhi) queue.push([i + k, ahi, j + k, bhi]);
        }
      }
      found.sort((x, y) => x[0] - y[0] || x[1] - y[1] || x[2] - y[2]);
      const out = [];
      let [i1, j1, k1] = [0, 0, 0];
      for (const [i2, j2, k2] of found) {
        if (i1 + k1 === i2 && j1 + k1 === j2) k1 += k2;
        else { if (k1) out.push([i1, j1, k1]); [i1, j1, k1] = [i2, j2, k2]; }
      }
      if (k1) out.push([i1, j1, k1]);
      out.push([a.length, b.length, 0]);
      return (blocksCache = out);
    }
    function opcodes() {
      let i = 0, j = 0;
      const ans = [];
      for (const [ai, bj, size] of blocks()) {
        const tag = i < ai && j < bj ? 'replace' : i < ai ? 'delete' : j < bj ? 'insert' : '';
        if (tag) ans.push([tag, i, ai, j, bj]);
        i = ai + size; j = bj + size;
        if (size) ans.push(['equal', ai, i, bj, j]);
      }
      return ans;
    }
    function grouped(n = 3) {
      let codes = opcodes();
      if (!codes.length) codes = [['equal', 0, 1, 0, 1]];
      if (codes[0][0] === 'equal') { const [t, i1, i2, j1, j2] = codes[0]; codes[0] = [t, Math.max(i1, i2 - n), i2, Math.max(j1, j2 - n), j2]; }
      const last = codes.length - 1;
      if (codes[last][0] === 'equal') { const [t, i1, i2, j1, j2] = codes[last]; codes[last] = [t, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)]; }
      const groups = [];
      let group = [];
      for (let [t, i1, i2, j1, j2] of codes) {
        if (t === 'equal' && i2 - i1 > 2 * n) {
          group.push([t, i1, Math.min(i2, i1 + n), j1, Math.min(j2, j1 + n)]);
          groups.push(group);
          group = [];
          i1 = Math.max(i1, i2 - n); j1 = Math.max(j1, j2 - n);
        }
        group.push([t, i1, i2, j1, j2]);
      }
      if (group.length && !(group.length === 1 && group[0][0] === 'equal')) groups.push(group);
      return groups;
    }
    const ratio = () => { const m = blocks().reduce((s, x) => s + x[2], 0); return a.length + b.length ? (2 * m) / (a.length + b.length) : 1; };
    return { blocks, opcodes, grouped, ratio };
  }
  const seqRatio = (a, b) => matcher(a, b).ratio();
  /** difflib.unified_diff(a, b, fromfile, tofile, lineterm='', n)：a、b 是行的数组。 */
  function unifiedDiff(a, b, fromfile = '', tofile = '', n = 3) {
    const range = (start, stop) => { let beg = start + 1; const len = stop - start; if (len === 1) return `${beg}`; if (!len) beg -= 1; return `${beg},${len}`; };
    const out = [];
    for (const g of matcher(a, b).grouped(n)) {
      if (!out.length) out.push(`--- ${fromfile}`, `+++ ${tofile}`);
      const f = g[0], l = g[g.length - 1];
      out.push(`@@ -${range(f[1], l[2])} +${range(f[3], l[4])} @@`);
      for (const [t, i1, i2, j1, j2] of g) {
        if (t === 'equal') { for (const x of a.slice(i1, i2)) out.push(' ' + x); continue; }
        if (t !== 'insert') for (const x of a.slice(i1, i2)) out.push('-' + x);
        if (t !== 'delete') for (const x of b.slice(j1, j2)) out.push('+' + x);
      }
    }
    return out;
  }
  function similarity(a, b) { const x = normTitle(a), y = normTitle(b); return x && y ? seqRatio(x, y) : 0; }

  /** _generate_key：第一作者姓 + 年 + 题目里前两个实词。 */
  const STOP = new Set(['the', 'a', 'an', 'in', 'on', 'at', 'for', 'to', 'of', 'and', 'is', 'are', 'with', 'by', 'study']);
  function citeKey(authors, year, title) {
    const first = authors?.length ? (String(authors[0]).trim().split(/\s+/).pop() || '') : 'Unknown';
    const cap = (w) => (w ? w[0].toUpperCase() + w.slice(1).toLowerCase() : w);
    const author = cap(first.replace(/[^a-zA-Z]/g, ''));
    const words = String(title || '').toLowerCase().replace(/[^a-zA-Z0-9\s]/g, '').split(/\s+/).filter(Boolean);
    const meaningful = words.filter((w) => !STOP.has(w)).map(cap);
    return `${author}${year || 2024}${meaningful.length ? meaningful.slice(0, 2).join('') : 'Paper'}`;
  }
  /** 同名的键依次加 a、b、c（_generate_bibtex 的规则）。原地改 papers[].key。 */
  function uniqueKeys(papers) {
    const seen = new Set();
    for (const p of papers) {
      const base = p.key;
      let k = base, s = 97;
      while (seen.has(k)) k = base + String.fromCharCode(s++);
      p.key = k;
      seen.add(k);
    }
    return papers;
  }
  const bibEscape = (t) => String(t ?? '').replace(/(?<!\\)((?:\\\\)*)([&%#])/g, '$1\\$2');
  /** _generate_bibtex：article（有期刊名）或 inproceedings；DOI 和网址不写进 .bib（有的 .bst 会原样打印，下划线会坏），放在 meta 里。 */
  function bibtex(papers) {
    return papers.map((p) => {
      const journal = p.journal;
      let e = `@${journal ? 'article' : 'inproceedings'}{${p.key},\n  title={${bibEscape(p.title)}},\n  author={${bibEscape(p.authors?.length ? p.authors.join(' and ') : 'Unknown')}},\n`;
      e += journal ? `  journal={${bibEscape(journal)}},\n` : `  booktitle={${bibEscape(p.venue || 'arXiv')}},\n`;
      e += `  year={${p.year || ''}}`;
      if (p.volume) e += `,\n  volume={${p.volume}}`;
      if (p.pages) e += `,\n  pages={${p.pages}}`;
      return e + '\n}';
    }).join('\n\n');
  }
  /** citation_map.json：有摘要的文献，键 → 题目、作者、出处、年、摘要。 */
  function citationMap(papers) {
    const m = {};
    for (const p of papers) if (p.abstract) m[p.key] = { citation_key: p.key, title: p.title, authors: p.authors, venue: p.venue || 'arXiv', year: p.year, abstract: String(p.abstract).trim() };
    return m;
  }
  /** references_meta.json：键 → 题目、年、DOI、网址、来源。 */
  function referencesMeta(papers) {
    const m = {};
    for (const p of papers) m[p.key] = { title: p.title, year: p.year ? Number(p.year) : null, doi: p.doi || null, url: p.url || null, source: p.source || null };
    return m;
  }
  /** 摘要截到 1500 字（照 _enrich_and_register_paper）。 */
  const trimAbstract = (s) => (String(s || '').length > 1500 ? String(s).slice(0, 1500) + '... [Truncated]' : String(s || ''));

  // ── 审稿 ──────────────────────────────────────────────────────────────
  const AXES = [['Originality', 1, 4], ['Quality', 1, 4], ['Clarity', 1, 4], ['Significance', 1, 4], ['Soundness', 1, 4], ['Presentation', 1, 4], ['Contribution', 1, 4], ['Overall', 1, 10], ['Confidence', 1, 5]];
  /** perform_review_agentreview 的合并：每个分数取几份审稿的平均（四舍五入，只算范围内的整数），其余字段用元审稿的。 */
  function mergeReviews(meta, reviews) {
    const out = { ...(meta || reviews[0] || {}) };
    for (const [axis, lo, hi] of AXES) {
      const vals = reviews.map((r) => pyInt(r?.[axis])).filter((v) => v !== null && v >= lo && v <= hi);
      if (vals.length) out[axis] = pyRound(vals.reduce((a, b) => a + b, 0) / vals.length);
    }
    return out;
  }
  /** Python 的 int(x)：整数、小数（截断）、写成整数的字符串；别的都不算。 */
  function pyInt(v) { if (typeof v === 'boolean') return v ? 1 : 0; if (typeof v === 'number') return Number.isFinite(v) ? Math.trunc(v) : null; if (typeof v === 'string' && /^\s*[+-]?\d+\s*$/.test(v)) return Number.parseInt(v, 10); return null; }
  /** Python 的 round（四舍六入五成双），np.mean 再 round 用的就是它。 */
  function pyRound(x) { const f = Math.floor(x), d = x - f; if (Math.abs(d - 0.5) < 1e-12) return f % 2 === 0 ? f : f + 1; return Math.round(x); }
  function scores(review) { const s = {}; for (const [a] of AXES) { const v = Number.parseFloat(review?.[a]); s[a] = Number.isFinite(v) ? v : 0; } return s; }
  /** content_refinement_agent 的取舍：总分升了就留；降了就退回并停；不变时各分项涨的不少于跌的就留，否则退回并停。 */
  function decide(before, after) {
    const o = scores(before), n = scores(after);
    let gain = 0, drop = 0;
    const deltas = {};
    for (const [a] of AXES) {
      if (a === 'Overall' || a === 'Confidence') continue;
      const d = n[a] - o[a];
      deltas[a] = d;
      if (d > 0) gain += d; else if (d < 0) drop -= d;
    }
    let outcome;
    if (n.Overall > o.Overall) outcome = 'ACCEPTED_SCORE_INCREASE';
    else if (n.Overall < o.Overall) outcome = 'REJECTED_SCORE_DECREASE';
    else outcome = drop > gain ? 'REJECTED_DEGRADATION' : 'ACCEPTED_NEUTRAL_IMPROVEMENT';
    return { outcome, accept: outcome.startsWith('ACCEPTED'), stop: outcome.startsWith('REJECTED'), deltas, gain, drop, before: o, after: n };
  }

  // ── 引用核对（离线，utils/citation_audit.py 的移植）──────────────────────
  const CITE_CMDS = ['cite', 'citep', 'citet', 'citealp', 'citealt', 'citeauthor', 'citefullauthor', 'citepalias', 'citetalias', 'citeyear', 'citeyearpar', 'citenum', 'citeurl', 'citetitle', 'citedate', 'Cite', 'Citep', 'Citet', 'Citealp', 'Citealt', 'Citeauthor', 'nocite', 'parencite', 'Parencite', 'textcite', 'Textcite', 'autocite', 'Autocite', 'footcite', 'footcitetext', 'smartcite', 'Smartcite', 'supercite', 'fullcite', 'onlinecite'];
  const MULTI_CMDS = ['cites', 'Cites', 'parencites', 'Parencites', 'textcites', 'Textcites', 'autocites', 'Autocites', 'footcites', 'footcitetexts', 'smartcites', 'Smartcites', 'supercites'];
  const OPT = String.raw`\[(?:[^\]{}]|\{[^{}]*\})*\]`;
  const byLen = (a) => [...a].sort((x, y) => y.length - x.length).join('|');
  const CITE_RE = new RegExp(String.raw`\\(?:${byLen(CITE_CMDS)})(?![A-Za-z@])\*?\s*(?:${OPT}\s*){0,2}\{([^{}]*)\}`, 'g');
  const MULTI_RE = new RegExp(String.raw`\\(?:${byLen(MULTI_CMDS)})(?![A-Za-z@])\*?\s*(?:\([^()]*\)\s*){0,2}`, 'g');
  const MULTI_ARG = new RegExp(String.raw`^\s*(?:${OPT}\s*){0,2}\{([^{}]*)\}`);
  function stripTexComments(tex) { return String(tex || '').replace(/(^|[^\\])((?:\\\\)*)%.*$/gm, '$1$2'); }
  const texCode = (tex) => stripTexComments(String(tex || '').replace(/(\\(?:url|path|href)\s*)\{[^{}\n]*\}/g, '$1{}'));
  /** 正文引用了哪些键（第一次出现的顺序，不分大小写去重），有没有 \nocite{*}。 */
  function citedKeys(tex) {
    const code = texCode(tex);
    const groups = [];
    for (const m of code.matchAll(CITE_RE)) groups.push([m.index, m[1]]);
    for (const m of code.matchAll(MULTI_RE)) {
      let pos = m.index + m[0].length;
      for (;;) { const a = code.slice(pos).match(MULTI_ARG); if (!a) break; groups.push([m.index, a[1]]); pos += a[0].length; }
    }
    groups.sort((x, y) => x[0] - y[0]);
    const keys = [], seen = new Set();
    let star = false;
    for (const [, g] of groups) for (const raw of g.split(',')) {
      const k = raw.trim();
      if (!k || k.includes('#')) continue;
      if (k === '*') { star = true; continue; }
      if (!seen.has(k.toLowerCase())) { seen.add(k.toLowerCase()); keys.push(k); }
    }
    return { keys, star };
  }
  function matching(text, start, open) {
    const close = open === '{' ? '}' : ')';
    let depth = 0;
    for (let i = start; i < text.length; i++) {
      const ch = text[i];
      if (ch === '\\') { i++; continue; }
      if (ch === '{' || (open === '(' && ch === '(')) depth++;
      else if (ch === '}' || (open === '(' && ch === ')')) { depth--; if (depth === 0 && ch === close) return i + 1; }
    }
    return text.length;
  }
  function parseFields(body) {
    const f = {};
    let i = 0;
    const n = body.length;
    const nameRe = /\s*,?\s*([A-Za-z][\w\-:.]*)\s*=\s*/y;
    while (i < n) {
      nameRe.lastIndex = i;
      const m = nameRe.exec(body);
      if (!m) { const nx = body.indexOf(',', i + 1); if (nx === -1) break; i = nx; continue; }
      const name = m[1].toLowerCase();
      let j = nameRe.lastIndex;
      const parts = [];
      while (j < n) {
        const ch = body[j];
        if (ch === '{') { const end = matching(body, j, '{'); parts.push(body.slice(j + 1, end - 1)); j = end; }
        else if (ch === '"') {
          let k = j + 1, depth = 0;
          while (k < n && !(body[k] === '"' && depth === 0)) { if (body[k] === '{') depth++; else if (body[k] === '}') depth--; else if (body[k] === '\\') k++; k++; }
          parts.push(body.slice(j + 1, k)); j = k + 1;
        } else { const m2 = body.slice(j).match(/^[^\s,#}]+/); if (m2) { parts.push(m2[0]); j += m2[0].length; } }
        const m3 = body.slice(j).match(/^\s*#\s*/);
        if (m3) { j += m3[0].length; continue; }
        break;
      }
      if (!(name in f)) f[name] = parts.join('');
      i = j;
    }
    return f;
  }
  /** .bib → { 键: { 字段: 原文, ENTRYTYPE } }，@string / @comment / @preamble 跳过。 */
  function parseBib(text) {
    const entries = {};
    const t = String(text || '');
    const re = /@\s*([A-Za-z]+)\s*([{(])/g;
    let m;
    while ((m = re.exec(t))) {
      const type = m[1].toLowerCase(), open = m[2];
      const end = matching(t, m.index + m[0].length - 1, open);
      re.lastIndex = Math.max(end, m.index + m[0].length);
      if (['comment', 'string', 'preamble'].includes(type)) continue;
      const inner = t.slice(m.index + m[0].length, end - 1);
      const comma = inner.indexOf(',');
      if (comma < 0) continue;
      const key = inner.slice(0, comma).trim();
      if (!key) continue;
      const fields = parseFields(inner.slice(comma + 1));
      fields.ENTRYTYPE = type;
      if (!(key in entries)) entries[key] = fields;
    }
    return entries;
  }
  const cleanDoi = (v) => { const d = cleanLatexText(v).replace(/^(?:https?:\/\/(?:dx\.)?doi\.org\/|doi:\s*)/i, '').trim(); return d || null; };
  /** citation_audit.build_audit：每条文献 verified（有 DOI，或检索记录里有网址）/ metadata_only / unverified；缺的键和没被引用的键。 */
  function citationAudit(tex, bibText, meta = {}) {
    const { keys, star } = citedKeys(tex);
    const bib = parseBib(bibText);
    const cited = new Set(keys.map((k) => k.toLowerCase()));
    const citedList = [...keys];
    if (star) for (const k of Object.keys(bib)) if (!cited.has(k.toLowerCase())) { cited.add(k.toLowerCase()); citedList.push(k); }
    const inBib = new Set(Object.keys(bib).map((k) => k.toLowerCase()));
    const entries = Object.entries(bib).map(([key, f]) => {
      const m = meta[key];
      const doi = m?.doi || cleanDoi(f.doi);
      const url = m?.url || cleanLatexText(f.url) || null;
      const status = doi || (m && url) ? 'verified' : m ? 'metadata_only' : 'unverified';
      const ym = String(f.year || '').match(/\d{4}/);
      return { key, title: m?.title || cleanLatexText(f.title), year: m?.year ?? (ym ? Number(ym[0]) : null), doi: doi || null, url, source: m?.source || null, cited: cited.has(key.toLowerCase()), status };
    });
    const missing = citedList.filter((k) => !inBib.has(k.toLowerCase()));
    const uncited = entries.filter((e) => !e.cited).map((e) => e.key);
    return { summary: { cited: citedList.length, bib_entries: entries.length, in_bibliography: entries.filter((e) => e.cited).length, missing_in_bib: missing.length, uncited: uncited.length, with_doi: entries.filter((e) => e.doi).length, verified: entries.filter((e) => e.status === 'verified').length }, missing_in_bib: missing, uncited, entries };
  }
  /** citation_audit.cited_bib_text：被引用的条目原样、按文件顺序（重复的键留第一条），连同 @string / @preamble；
      crossref / xdata 指向的父条目也留下（BibTeX 会把被引用的子条目的父条目一起放进去）。返回 { text, count }。 */
  function citedBibText(bibText, keys) {
    const t = String(bibText || '');
    const fields = {};
    for (const [k, f] of Object.entries(parseBib(t))) if (!(k.toLowerCase() in fields)) fields[k.toLowerCase()] = f;
    const keep = new Set([...keys].map((k) => String(k).toLowerCase()));
    const todo = [...keep];
    while (todo.length) {
      const child = todo.pop();
      for (const ref of ['crossref', 'xdata']) {
        for (let parent of String(fields[child]?.[ref] || '').split(',')) {
          parent = parent.trim().toLowerCase();
          if (parent in fields && !keep.has(parent)) { keep.add(parent); todo.push(parent); }
        }
      }
    }
    const out = [], seen = new Set();
    const re = /@\s*([A-Za-z]+)\s*([{(])/g;
    let m;
    while ((m = re.exec(t))) {
      const end = matching(t, m.index + m[0].length - 1, m[2]);
      re.lastIndex = Math.max(end, m.index + m[0].length);
      const type = m[1].toLowerCase(), raw = t.slice(m.index, end);
      if (['comment', 'string', 'preamble'].includes(type)) { if (type !== 'comment') out.push(raw); continue; }
      const inner = t.slice(m.index + m[0].length, end - 1), comma = inner.indexOf(',');
      if (comma < 0) continue;
      const low = inner.slice(0, comma).trim().toLowerCase();
      if (keep.has(low) && !seen.has(low)) { seen.add(low); out.push(raw); }
    }
    return { text: out.join('\n\n') + (out.length ? '\n' : ''), count: seen.size };
  }
  /** 只留被引用的条目（references_cited.bib）；\nocite{*} 时整份留下。 */
  function citedBib(bibText, tex) {
    const { keys, star } = citedKeys(tex);
    return star ? String(bibText || '') : citedBibText(bibText, keys).text;
  }
  /** submission_tools.first_author_surname。 */
  function firstSurname(authors) {
    const first = cleanLatexText(authors).split(/\s+and\s+/)[0].trim();
    if (first.includes(',')) return first.split(',')[0].trim();
    const w = first.split(/\s+/).filter(Boolean);
    return w.length ? w[w.length - 1] : '';
  }
  function surnameMatches(surname, authors) {
    const flat = (x) => normTitle(x).replace(/[^a-z]/g, '');
    const want = flat(surname);
    if (!want || !authors?.length) return true;
    for (const a of [...authors.slice(0, 3), ...authors.slice(-1)]) {
      const parts = String(a).split(/\s+/).filter(Boolean);
      const last = flat(parts.length ? parts[parts.length - 1] : a);
      if (flat(a).includes(want) || seqRatio(want, last) >= 0.8) return true;
    }
    return false;
  }
  /** cite-online 的判断（check_entry 后半段）：fields 是 .bib 里这一条，candidates 是各家查到的 { source, title, doi, year, venue, authors, viaDoi }。 */
  /** where：问过的数据库（显示在“没找到”那句里）。原版问 Crossref、arXiv、Semantic Scholar；浏览器里 arXiv 的接口不许跨域读，页面改问 OpenAlex。 */
  function judgeEntry(key, fields, candidates, failures = [], where = ['Crossref', 'arXiv', 'Semantic Scholar']) {
    const title = cleanLatexText(fields.title || '');
    const doi = String(fields.doi || '').trim().replace(/^https?:\/\/(dx\.)?doi\.org\//i, '');
    const ym = String(fields.year || '').match(/\d{4}/);
    const year = ym ? Number(ym[0]) : null;
    const surname = firstSurname(fields.author || '');
    const res = { key, title, year, doi: doi || null, status: 'not_found', found: null, score: 0, notes: [], suggestions: [] };
    if (!title && !doi) { res.status = 'skipped'; res.notes.push(['条目没有标题和 DOI，没法核对', 'No title and no DOI: nothing to check']); return res; }
    if (!candidates.length) {
      if (failures.length) { res.status = 'error'; res.notes.push([`网络错误，稍后重试：${failures.join('；').slice(0, 200)}`, `Network error, try again later: ${failures.join('; ').slice(0, 200)}`]); }
      else res.notes.push([`${where.join('、')} 都没找到这篇，可能是编出来的文献，请人工核实`, `Not found in ${where.slice(0, -1).join(', ')} or ${where[where.length - 1]}: it may be made up, check it by hand`]);
      return res;
    }
    const sc = (c) => (title ? similarity(c.title, title) : c.viaDoi ? 1 : 0);
    const best = candidates.reduce((a, c) => (sc(c) > sc(a) ? c : a));
    const score = title ? similarity(best.title, title) : 1;
    res.found = best;
    res.score = Math.round(score * 1000) / 1000;
    if (score >= 0.9) {
      const problems = [];
      if (best.doi && doi && best.doi.toLowerCase() !== doi.toLowerCase() && !best.viaDoi) problems.push([`DOI 不一致：.bib 写 ${doi}，数据库是 ${best.doi}`, `DOI differs: the .bib has ${doi}, the database ${best.doi}`]);
      if (surname && !surnameMatches(surname, best.authors || [])) problems.push([`第一作者「${surname}」和数据库里的作者（${(best.authors || []).slice(0, 3).join(', ')}）对不上`, `First author "${surname}" does not match the database (${(best.authors || []).slice(0, 3).join(', ')})`]);
      if (best.doi && !doi) res.suggestions.push([`可补 DOI：${best.doi}`, `DOI to add: ${best.doi}`]);
      if (year && best.year && Number(best.year) !== year) {
        const venue = best.venue || '';
        if (Number(best.year) > year && venue && !/arxiv/i.test(venue)) res.suggestions.push([`已正式发表：${venue}（${best.year}），可以改引正式版`, `Now published: ${venue} (${best.year}); cite the published version`]);
        else res.suggestions.push([`年份不同：.bib 写 ${year}，${best.source} 是 ${best.year}`, `Year differs: the .bib has ${year}, ${best.source} ${best.year}`]);
      }
      res.status = problems.length ? 'fix' : 'verified';
      res.notes.push(...problems);
    } else if (score >= 0.7) {
      res.status = 'mismatch';
      res.notes.push([`只找到相近的标题：「${best.title.slice(0, 120)}」，请人工确认`, `Only a similar title: "${best.title.slice(0, 120)}"; check by hand`]);
    } else if (failures.length) {
      res.status = 'error';
      res.notes.push([`有数据库没连上，没法下结论，稍后重试：${failures.join('；').slice(0, 200)}`, `A database did not answer, so no verdict: ${failures.join('; ').slice(0, 200)}`]);
    } else {
      res.notes.push([`最接近的是「${best.title.slice(0, 120)}」（相似度 ${res.score}），不像同一篇`, `Closest: "${best.title.slice(0, 120)}" (similarity ${res.score}), not the same paper`]);
    }
    return res;
  }

  // ── zip、Overleaf ──────────────────────────────────────────────────────
  const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
  function crc32(bytes) { let c = 0xffffffff; for (let i = 0; i < bytes.length; i++) c = CRC[(c ^ bytes[i]) & 0xff] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
  const utf8 = (s) => new TextEncoder().encode(s);
  /** files: [{ name, data: string | Uint8Array }] → Uint8Array（zip，不压缩，文件名 UTF-8）。 */
  function zip(files) {
    const parts = [], central = [];
    let off = 0;
    const u16 = (v) => [v & 0xff, (v >>> 8) & 0xff], u32 = (v) => [v & 0xff, (v >>> 8) & 0xff, (v >>> 16) & 0xff, (v >>> 24) & 0xff];
    for (const f of files) {
      const name = utf8(f.name), data = typeof f.data === 'string' ? utf8(f.data) : f.data, crc = crc32(data);
      const head = [0x50, 0x4b, 0x03, 0x04, ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0)];
      parts.push(Uint8Array.from(head), name, data);
      central.push(Uint8Array.from([0x50, 0x4b, 0x01, 0x02, ...u16(20), ...u16(20), ...u16(0x0800), ...u16(0), ...u16(0), ...u16(0x21), ...u32(crc), ...u32(data.length), ...u32(data.length), ...u16(name.length), ...u16(0), ...u16(0), ...u16(0), ...u16(0), ...u32(0), ...u32(off)]), name);
      off += head.length + name.length + data.length;
    }
    const csize = central.reduce((s, p) => s + p.length, 0);
    const end = Uint8Array.from([0x50, 0x4b, 0x05, 0x06, ...u16(0), ...u16(0), ...u16(files.length), ...u16(files.length), ...u32(csize), ...u32(off), ...u16(0)]);
    const all = [...parts, ...central, end], out = new Uint8Array(all.reduce((s, p) => s + p.length, 0));
    let p = 0;
    for (const a of all) { out.set(a, p); p += a.length; }
    return out;
  }
  /** Overleaf 的“用这些文件开一个新项目”（POST https://www.overleaf.com/docs）：snip_uri 不能用（要公网地址），用 encoded_snip[] + snip_name[]，只放文本文件。 */
  function overleafFields(files, engine) {
    const fields = [];
    for (const f of files) if (typeof f.data === 'string') { fields.push(['encoded_snip[]', encodeURIComponent(f.data)]); fields.push(['snip_name[]', f.name]); }
    if (engine) fields.push(['engine', engine]);
    fields.push(['main_document', 'main.tex']);
    return fields;
  }
  /** 中文模板用 XeLaTeX（ctex），其余 pdfLaTeX。 */
  const engineFor = (tex) => (/\\usepackage(\[[^\]]*\])?\{ctex\}|\\documentclass(\[[^\]]*\])?\{ctex|xeCJK|fontspec/.test(String(tex || '')) ? 'xelatex' : 'pdflatex');

  // ── 小的 Markdown（科研工坊的报告）────────────────────────────────────────
  // 标题、段落、列表、表格、引用、代码块（mermaid 块单独标出来，由界面画）、行内代码、粗体、斜体、链接；$…$ / $$…$$ 原样留给 KaTeX。只出转义过的 HTML。
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const unesc = (v) => String(v).replace(/&(amp|lt|gt|quot|#39);/g, (_, e) => ({ amp: '&', lt: '<', gt: '>', quot: '"', '#39': "'" }[e]));
  const safeURL = (v) => { try { const u = new URL(v); return ['http:', 'https:'].includes(u.protocol) ? u.href : '#'; } catch { return '#'; } };
  function mdInline(s) {
    const keep = [];
    let h = String(s).replace(/(\$\$[^$]+\$\$|\$[^$\n]+\$|`[^`]+`)/g, (m) => { keep.push(m); return `\u0000${keep.length - 1}\u0000`; });
    h = esc(h)
      .replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>')
      .replace(/(^|[^*])\*([^*\s][^*]*)\*/g, '$1<em>$2</em>')
      .replace(/\[([^\]]+)\]\((https?:\/\/[^\s)]+)\)/g, (_, t, u) => `<a href="${esc(safeURL(unesc(u)))}" target="_blank" rel="noopener noreferrer">${t}</a>`);
    return h.replace(/\u0000(\d+)\u0000/g, (_, i) => { const m = keep[i]; return m.startsWith('`') ? `<code>${esc(m.slice(1, -1))}</code>` : `<span class="po-math" data-tex="${esc(m.replace(/^\$\$?|\$\$?$/g, ''))}" data-display="${m.startsWith('$$')}">${esc(m)}</span>`; });
  }
  function markdown(src) {
    const lines = String(src || '').replace(/\r/g, '').split('\n');
    let html = '', i = 0;
    const isTableSep = (l) => /^\s*\|?\s*:?-{2,}:?\s*(\|\s*:?-{2,}:?\s*)*\|?\s*$/.test(l);
    const cells = (l) => l.trim().replace(/^\|/, '').replace(/\|$/, '').split('|').map((c) => c.trim());
    while (i < lines.length) {
      const line = lines[i];
      const fence = line.match(/^```\s*([\w-]*)/);
      if (fence) {
        const lang = fence[1].toLowerCase(), body = [];
        i++;
        while (i < lines.length && !/^```/.test(lines[i])) body.push(lines[i++]);
        i++;
        html += lang === 'mermaid' ? `<div class="po-mermaid" data-src="${esc(body.join('\n'))}"><pre><code>${esc(body.join('\n'))}</code></pre></div>` : `<pre><code${lang ? ` data-lang="${esc(lang)}"` : ''}>${esc(body.join('\n'))}</code></pre>`;
        continue;
      }
      if (/^\s*\$\$\s*$/.test(line)) {
        const body = [];
        i++;
        while (i < lines.length && !/^\s*\$\$\s*$/.test(lines[i])) body.push(lines[i++]);
        i++;
        html += `<div class="po-math" data-tex="${esc(body.join('\n'))}" data-display="true">${esc('$$' + body.join('\n') + '$$')}</div>`;
        continue;
      }
      const h = line.match(/^(#{1,6})\s+(.*)/);
      if (h) { const n = Math.min(6, h[1].length + 1); html += `<h${n}>${mdInline(h[2])}</h${n}>`; i++; continue; }
      if (/^\s*\|/.test(line) && i + 1 < lines.length && isTableSep(lines[i + 1])) {
        const head = cells(line);
        i += 2;
        const rows = [];
        while (i < lines.length && /^\s*\|/.test(lines[i])) rows.push(cells(lines[i++]));
        html += `<div class="po-table"><table><thead><tr>${head.map((c) => `<th>${mdInline(c)}</th>`).join('')}</tr></thead><tbody>${rows.map((r) => `<tr>${r.map((c) => `<td>${mdInline(c)}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
        continue;
      }
      if (/^\s*>/.test(line)) {
        const body = [];
        while (i < lines.length && /^\s*>/.test(lines[i])) body.push(lines[i++].replace(/^\s*>\s?/, ''));
        html += `<blockquote>${markdown(body.join('\n'))}</blockquote>`;
        continue;
      }
      const li = line.match(/^(\s*)([-*•]|\d+[.)])\s+(.*)/);
      if (li) {
        const ordered = /\d/.test(li[2]);
        const tag = ordered ? 'ol' : 'ul';
        html += `<${tag}>`;
        while (i < lines.length) {
          const m = lines[i].match(/^(\s*)([-*•]|\d+[.)])\s+(.*)/);
          if (!m || /\d/.test(m[2]) !== ordered) break;
          const task = m[3].match(/^\[( |x|X)\]\s+(.*)/);
          html += task ? `<li class="po-task"><input type="checkbox" disabled${task[1] !== ' ' ? ' checked' : ''}> ${mdInline(task[2])}</li>` : `<li${m[1].length >= 2 ? ' class="po-sub"' : ''}>${mdInline(m[3])}</li>`;
          i++;
        }
        html += `</${tag}>`;
        continue;
      }
      if (/^\s*(---+|\*\*\*+)\s*$/.test(line)) { html += '<hr>'; i++; continue; }
      if (!line.trim()) { i++; continue; }
      const para = [];
      while (i < lines.length && lines[i].trim() && !/^(#{1,6}\s|```|\s*[-*•]\s|\s*\d+[.)]\s|\s*\||\s*>|\s*\$\$\s*$)/.test(lines[i])) para.push(lines[i++]);
      if (!para.length) para.push(lines[i++]);
      html += `<p>${mdInline(para.join(' '))}</p>`;
    }
    return html;
  }
  /** 目录：报告里的 ## / ### 标题。 */
  function mdHeadings(src) { return String(src || '').split('\n').map((l) => l.match(/^(#{2,3})\s+(.*)/)).filter(Boolean).map((m) => ({ level: m[1].length, text: m[2].trim() })); }

  // ── CSV 和数模的三模型基准（research_studio._run_numpy_math_benchmark 的移植）──
  function parseCSV(text) {
    const t = String(text || '').replace(/^\uFEFF/, '');
    const delim = (t.split('\n')[0].match(/\t/g) || []).length > (t.split('\n')[0].match(/,/g) || []).length ? '\t' : ',';
    const rows = [];
    let row = [], cell = '', q = false;
    for (let i = 0; i < t.length; i++) {
      const c = t[i];
      if (q) { if (c === '"' && t[i + 1] === '"') { cell += '"'; i++; } else if (c === '"') q = false; else cell += c; continue; }
      if (c === '"') q = true;
      else if (c === delim) { row.push(cell); cell = ''; }
      else if (c === '\n' || c === '\r') { if (c === '\r' && t[i + 1] === '\n') i++; row.push(cell); rows.push(row); row = []; cell = ''; }
      else cell += c;
    }
    if (cell || row.length) { row.push(cell); rows.push(row); }
    return rows.filter((r) => r.some((x) => x.trim()));
  }
  function lstsq(A, y, lam = 0) {
    // 正规方程 (AᵀA + λI′) w = Aᵀy（截距不加罚），Gauss 消元带部分主元
    const n = A[0].length;
    const M = Array.from({ length: n }, (_, i) => Array.from({ length: n + 1 }, (_, j) => (j < n ? A.reduce((s, r) => s + r[i] * r[j], 0) + (i === j && i > 0 ? lam : 0) : A.reduce((s, r, k) => s + r[i] * y[k], 0))));
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(M[r][c]) > Math.abs(M[p][c])) p = r;
      [M[c], M[p]] = [M[p], M[c]];
      if (Math.abs(M[c][c]) < 1e-12) { M[c][c] = 1e-12; }
      for (let r = 0; r < n; r++) if (r !== c) { const f = M[r][c] / M[c][c]; for (let k = c; k <= n; k++) M[r][k] -= f * M[c][k]; }
    }
    return M.map((r, i) => r[n] / r[i]);
  }
  /** 最后一列数值是目标，前面的数值列是特征；前 80% 训练、后 20% 测试（不打乱，和原版一样）。
      数值列照 pandas 的 select_dtypes：一列里非空的格子都是数才算；再去掉数值列里有空格子的行（dropna）。 */
  function mathBenchmark(rows, name = 'data.csv') {
    if (!rows?.length) return null;
    const head = rows[0], body = rows.slice(1);
    const isNum = (v) => v !== undefined && v.trim() !== '' && Number.isFinite(Number(v));
    const numericCols = head.map((_, j) => j).filter((j) => body.some((r) => isNum(r[j])) && body.every((r) => r[j] === undefined || r[j].trim() === '' || isNum(r[j])));
    const data = body.filter((r) => numericCols.every((j) => isNum(r[j]))).map((r) => numericCols.map((j) => Number(r[j])));
    if (numericCols.length < 2 || data.length < 12) return { dataset: name, rows: body.length, cols: head.length, note: '数值列不足 2 列或样本少于 12 行，已记录基础轮廓' };
    const target = head[numericCols[numericCols.length - 1]], features = numericCols.slice(0, -1).map((j) => head[j]);
    const X = data.map((r) => r.slice(0, -1)), y = data.map((r) => r[r.length - 1]);
    const split = Math.max(4, Math.floor(0.8 * y.length));
    const Xtr = X.slice(0, split), Xte = X.slice(split), ytr = y.slice(0, split), yte = y.slice(split);
    const p = features.length;
    const mu = Array.from({ length: p }, (_, j) => Xtr.reduce((s, r) => s + r[j], 0) / Xtr.length);
    const sd = Array.from({ length: p }, (_, j) => { const v = Math.sqrt(Xtr.reduce((s, r) => s + (r[j] - mu[j]) ** 2, 0) / Xtr.length); return v > 1e-8 ? v : 1; });
    const norm = (M) => M.map((r) => r.map((v, j) => (v - mu[j]) / sd[j]));
    const Ntr = norm(Xtr), Nte = norm(Xte);
    const aug = (M) => M.map((r) => [1, ...r]);
    const metrics = (pred) => {
      const err = yte.map((v, i) => v - pred[i]);
      const mean = yte.reduce((a, b) => a + b, 0) / yte.length;
      const ssTot = yte.reduce((s, v) => s + (v - mean) ** 2, 0) || 1e-12;
      const mae = err.reduce((s, e) => s + Math.abs(e), 0) / err.length;
      const rmse = Math.sqrt(err.reduce((s, e) => s + e * e, 0) / err.length);
      const mape = (err.reduce((s, e, i) => s + Math.abs(e) / (Math.abs(yte[i]) > 1e-6 ? Math.abs(yte[i]) : 1), 0) / err.length) * 100;
      return { MAE: pyRoundN(mae, 4), RMSE: pyRoundN(rmse, 4), MAPE_pct: pyRoundN(mape, 2), R2: pyRoundN(1 - err.reduce((s, e) => s + e * e, 0) / ssTot, 4) };
    };
    const predict = (w, M) => aug(M).map((r) => r.reduce((s, v, i) => s + v * w[i], 0));
    const wOls = lstsq(aug(Ntr), ytr, 0), wRidge = lstsq(aug(Ntr), ytr, 1);
    const k = Math.min(5, Math.max(2, Math.floor(Ntr.length / 3)));
    const knn = Nte.map((row) => {
      const d = Ntr.map((r, i) => [Math.sqrt(r.reduce((s, v, j) => s + (v - row[j]) ** 2, 0)) + 1e-6, i]).sort((a, b) => a[0] - b[0] || a[1] - b[1]).slice(0, k);
      const ws = d.map(([dist]) => 1 / dist);
      return d.reduce((s, [, i], n) => s + ws[n] * ytr[i], 0) / ws.reduce((a, b) => a + b, 0);
    });
    const models = [
      { model: '多元线性回归 (OLS)', ...metrics(predict(wOls, Nte)) },
      { model: '岭回归 (Ridge λ=1.0)', ...metrics(predict(wRidge, Nte)) },
      { model: `距离加权近邻 (k=${k})`, ...metrics(knn) },
    ];
    const importance = features.map((f, j) => ({ feature: String(f), absStdWeight: pyRoundN(Math.abs(wRidge[j + 1]), 4) })).sort((a, b) => b.absStdWeight - a.absStdWeight);
    return { dataset: name, targetColumn: String(target), trainRows: Xtr.length, testRows: Xte.length, models, featureImportance: importance };
  }
  /** Python 的 round(x, n)：按 x 的二进制精确值四舍五入；toFixed 也看精确值，只是正好一半时取大的，Python 取偶数。 */
  function pyRoundN(x, n) {
    if (!Number.isFinite(x)) return x;
    const exact = Math.abs(x).toFixed(100), dot = exact.indexOf('.');
    const tail = exact.slice(dot + 1 + n);
    if (/^50*$/.test(tail)) {
      const kept = exact.slice(0, dot + 1 + n).replace('.', '');
      const down = Number(kept) / 10 ** n;
      const lastDigit = Number(kept[kept.length - 1]);
      const v = lastDigit % 2 === 0 ? down : down + 10 ** -n;
      return Number((Math.sign(x) * v).toFixed(n));
    }
    return Number(x.toFixed(n));
  }

  // ── 图 ────────────────────────────────────────────────────────────────
  // 绘图这一步让模型只给出“图的规格”（JSON：图型、坐标轴、数据点，数据全部来自实验记录），由浏览器按期刊插图的画法画成 PNG。
  // 这样数据点可以核对，不会有模型“画”出来的数字。
  const PALETTE = ['#0072B2', '#E69F00', '#009E73', '#D55E00', '#CC79A7', '#56B4E9', '#F0E442', '#000000']; // Okabe–Ito
  function checkChart(spec) {
    const problems = [];
    if (!spec || typeof spec !== 'object') return ['not-object'];
    if (!['line', 'scatter', 'bar', 'hbar'].includes(spec.type)) problems.push('type');
    const series = Array.isArray(spec.series) ? spec.series : [];
    if (!series.length) problems.push('series');
    for (const [i, s] of series.entries()) {
      const xs = s.x || [], ys = s.y || [];
      if (!Array.isArray(ys) || !ys.length) problems.push(`series${i}:y`);
      if (spec.type !== 'bar' && spec.type !== 'hbar' && xs.length !== ys.length) problems.push(`series${i}:length`);
      if (ys.some((v) => v !== null && !Number.isFinite(Number(v)))) problems.push(`series${i}:nan`);
      if (s.err && s.err.length !== ys.length) problems.push(`series${i}:err`);
    }
    if ((spec.type === 'bar' || spec.type === 'hbar') && !Array.isArray(spec.categories)) problems.push('categories');
    return problems;
  }
  /** 坐标轴的“好看”刻度（1、2、5 × 10ⁿ）。 */
  function niceTicks(lo, hi, n = 5) {
    if (!(hi > lo)) { const d = Math.abs(lo) || 1; lo -= d / 2; hi += d / 2; }
    const raw = (hi - lo) / Math.max(1, n);
    const mag = 10 ** Math.floor(Math.log10(raw));
    const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) || 10 * mag;
    const start = Math.floor(lo / step + 1e-9) * step, end = Math.ceil(hi / step - 1e-9) * step;
    const ticks = [];
    for (let v = start; v <= end + step * 1e-6; v += step) ticks.push(Number(v.toPrecision(12)));
    return { ticks, lo: start, hi: end, step };
  }
  /** 图里每个数字都要在实验记录里出现过（或是记录里数字的简单差）。返回找不到的数字。 */
  function unverifiedNumbers(spec, log) {
    const nums = new Set((String(log || '').match(/-?\d+(?:\.\d+)?(?:[eE][-+]?\d+)?/g) || []).map((x) => Number(x)));
    const near = (v) => [...nums].some((n) => Math.abs(n - v) <= 1e-9 * Math.max(1, Math.abs(v)) || Math.abs(n * 100 - v) < 1e-9 || Math.abs(n - v * 100) < 1e-9);
    const missing = [];
    for (const s of spec?.series || []) for (const v of [...(s.y || []), ...(s.err || [])]) if (v !== null && Number.isFinite(Number(v)) && !near(Number(v))) missing.push(Number(v));
    return [...new Set(missing)];
  }

  // ── 运行记录 ──────────────────────────────────────────────────────────
  /** 字数的粗估：英文 ≈ 4 字符一个 token，中文 ≈ 1 字一个 token（只用于提示“这一步大概要多少”）。 */
  function estTokens(text) { const s = String(text || ''); const cjk = (s.match(/[\u3400-\u9fff]/g) || []).length; return Math.round(cjk + (s.length - cjk) / 4); }
  const fmtMoney = (money) => Object.entries(money || {}).map(([c, v]) => `${c === 'USD' ? 'US$' : c === 'CNY' ? '¥' : c + ' '}${v < 0.01 ? v.toFixed(4) : v.toFixed(2)}`).join(' + ');

  const pure = {
    PROVIDERS, guessProvider, splitRef, request, modelsRequest, parseModels, sseSplit, streamDelta, parseReply, addUsage, errorCode,
    PRICES, PRICES_CHECKED, priceOf, costOf, totals, fmtMoney, TASKS, resolveTask, fill, venueNote, reviewerSystem,
    extractJSON, extractLatex, latexComplete, checkOutline, searchTasks, hintTitle, injectCitations,
    SCHOLAR, SCHOLAR_ORDER, cutoffDay, normalize, invertedAbstract, allowedByCutoff, normKey, normTitle, cleanLatexText, seqRatio, similarity,
    matcher, unifiedDiff, citeKey, uniqueKeys, bibEscape, bibtex, citationMap, referencesMeta, trimAbstract,
    AXES, mergeReviews, pyRound, scores, decide,
    citedKeys, parseBib, citationAudit, citedBib, citedBibText, firstSurname, surnameMatches, judgeEntry, stripTexComments,
    crc32, zip, overleafFields, engineFor, esc, markdown, mdHeadings, parseCSV, mathBenchmark, lstsq, pyRoundN, pyInt,
    PALETTE, checkChart, niceTicks, unverifiedNumbers, estTokens, UA_MAILTO,
  };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaPaper = pure;
})(typeof self !== 'undefined' ? self : this);
