/* ChemResearch Hub · AI 代理（Cloudflare Worker，可选）
   让访客不用自备 key 也能用 AI：key 存在 Worker 的加密变量里，网页只把对话发给这个 Worker。

   部署（需要 Cloudflare 账号与 wrangler）：
     npx wrangler deploy deploy/ai-proxy-worker.js --name chemhub-ai --compatibility-date 2026-10-01
     npx wrangler secret put DEEPSEEK_API_KEY --name chemhub-ai     # 可选
     npx wrangler secret put MUSE_API_KEY --name chemhub-ai         # 可选，Meta Model API key
     npx wrangler secret put ALLOWED_ORIGINS --name chemhub-ai      # 例如 https://felixjiashengfu.github.io
   然后把 Worker 地址填进 public/ai/config.js 的 proxy。

   可选变量：ALLOWED_MODELS（逗号分隔）、MAX_TOKENS（默认 12000）、MAX_BODY（默认 200000 字节）。
   限流：在 wrangler.toml 绑定 Rate Limiting（binding 名 RATE_LIMITER），每个 IP 按设定频率放行。 */

const UPSTREAMS = {
  deepseek: { url: 'https://api.deepseek.com/chat/completions', secret: 'DEEPSEEK_API_KEY', models: ['deepseek-flash', 'deepseek-v4-pro'] },
  muse: { url: 'https://api.meta.ai/v1/chat/completions', secret: 'MUSE_API_KEY', models: ['muse-spark-1.3', 'muse-wonder-1.0', 'muse-spark-1.2'] }
};
const PASS_THROUGH = ['temperature', 'top_p', 'response_format', 'reasoning_effort', 'thinking', 'stream_options'];

const list = (v) => String(v || '').split(',').map((s) => s.trim()).filter(Boolean);

function reply(status, message, headers) {
  return new Response(JSON.stringify({ error: { message } }), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8' } });
}

export default {
  async fetch(request, env) {
    const origin = request.headers.get('Origin') || '';
    const allowed = list(env.ALLOWED_ORIGINS);
    const originOk = allowed.includes('*') || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin || '*' : 'null',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (request.method !== 'POST') return reply(405, '只接受 POST', cors);
    if (!originOk) return reply(403, '这个网站没有使用本代理的权限', cors);

    if (env.RATE_LIMITER) {
      const { success } = await env.RATE_LIMITER.limit({ key: request.headers.get('CF-Connecting-IP') || 'anonymous' });
      if (!success) return reply(429, '请求太频繁，请稍后再试', cors);
    }

    const raw = await request.text();
    if (raw.length > Number(env.MAX_BODY || 200000)) return reply(413, '请求内容过大', cors);
    let body;
    try { body = JSON.parse(raw); } catch { return reply(400, '请求不是合法的 JSON', cors); }

    const provider = body.provider === 'muse' ? 'muse' : 'deepseek';
    const upstream = UPSTREAMS[provider];
    const key = env[upstream.secret];
    if (!key) return reply(503, `站点没有配置 ${provider === 'muse' ? 'Muse' : 'DeepSeek'} 的 key`, cors);
    const models = list(env.ALLOWED_MODELS).length ? list(env.ALLOWED_MODELS) : upstream.models;
    if (!models.includes(body.model)) return reply(400, `代理不允许模型 ${body.model}`, cors);
    if (!Array.isArray(body.messages) || !body.messages.length) return reply(400, '缺少 messages', cors);

    const payload = {
      model: body.model,
      messages: body.messages,
      stream: body.stream === true,
      max_tokens: Math.min(Number(body.max_tokens) || 4096, Number(env.MAX_TOKENS || 12000))
    };
    for (const k of PASS_THROUGH) if (body[k] !== undefined) payload[k] = body[k];

    const res = await fetch(upstream.url, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${key}` },
      body: JSON.stringify(payload)
    });
    const headers = new Headers(cors);
    headers.set('Content-Type', res.headers.get('Content-Type') || 'application/json');
    headers.set('Cache-Control', 'no-store');
    return new Response(res.body, { status: res.status, headers });
  }
};
