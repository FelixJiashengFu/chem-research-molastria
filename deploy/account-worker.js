/* MolAstria · 账号服务（Cloudflare Worker + D1）
   内容对所有人免费（每周精选全文、在线模型），收费的是服务的量：三档额度，像 OpenAlex 的“不用 key / 免费 key / 付费”：
   匿名访客、免费账号（任何邮箱都能收验证码登录）、Pro 支持者（Stripe 订阅、课题组席位、VIP 卡、站长）。
   付款仍在 Stripe 的托管结账页完成；这个 Worker 只回答三件事：你是谁（邮箱登录）、你付过钱没有（向 Stripe 查询）、
   还剩多少 AI 托管额度（转发到 DeepSeek / Muse 并计数）。不需要 Stripe webhook。

   接口（JSON；登录后用 Authorization: Bearer <令牌>）：
     POST /auth/checkout {session_id}   付款确认页自动登录（Stripe Checkout Session 24 小时内有效）
     POST /auth/start {email, lang, card?}  给任何邮箱发 6 位验证码（没付费也能登录，就是免费账号）；
                                        带上未使用的 VIP 卡时，验证通过后卡才算兑换
     POST /auth/verify {email, code}    用验证码换登录令牌
     POST /auth/signout                 退出这台设备
     GET  /me                           订阅、额度、课题组成员
     POST /team/members {email}         课题组购买者添加成员；DELETE 同一路径移除
     POST /cards/redeem {code}          已登录时兑换 VIP 卡
     GET  /keys                         自己的 API key（只有前缀，没有原文）、今天的用量和最近通过 key 提交的计算；POST {name} 生成一个，原文只在这次返回；DELETE {id} 撤销
     GET  /sync?since=<版本>            云同步：每份存档的版本、云端的空间，以及版本比 since 新的存档原文
     POST /sync {items:[{key, base, body}]}  传上改过的存档；base 是这台设备上次看到的版本，对不上的放进 conflicts 退回去合并
     DELETE /sync                       删掉云端的全部存档
     POST /net/miss {q, hits}           网状查询里术语表认不出的词，访客的浏览器新记下一个时匿名报一次，不需要登录；
                                        只存词、次数和全文命中数，不存 IP、账号、来源（规则和 public/hub/net-misses.js 一样）
     POST /web/search {q}               联网网页搜索（Brave Search），只给 Pro 支持者：每人每天 WEB_DAILY_PRO 次，全站每 30 天 WEB_MONTHLY_ALL 次；
                                        需要 secret BRAVE_SEARCH_KEY，没有时回答 503（网站就不显示网页结果）
     GET  /admin/net-misses             站长：全站没找到的词，按次数排；DELETE {term} 删一个，DELETE {all: true} 全部删掉
     GET  /admin/cards                  站长：已发出的 VIP 卡；POST {count, days, note} 生成；DELETE {code} 收回
     POST /ai/chat                      与 deploy/ai-proxy-worker.js 相同的请求体，需登录：免费账号每天 FREE_DAILY_ASKS 次，Pro 每月 MONTHLY_ASKS 次
     GET  /digest/preview               每周精选的完整一期（概览、全部论文和点评），公开
     GET  /digest/latest                每周精选全文和订阅状态，需登录
     POST /digest/subscribe {lang}      订阅邮件，需登录（免费账号也可以）；DELETE 同一路径退订
     POST /digest/send-me               把最新一期发到自己的邮箱，需登录，每天 3 次
     POST /admin/digest/build           站长：重新生成本周精选
     GET、POST /digest/unsubscribe?t=   邮件里的退订链接，不需要登录
   给程序用的计算接口（/v1，用 Authorization: Bearer mola_… 的 API key，不查来源网站；报错同时带英文和中文）：
     GET  /v1                           说明和文档地址，不用 key
     GET  /v1/status                    GPU 最近一次探测是否在线、最近 7 天的在线率，不用 key
     GET  /v1/me                        这个 key 的档位和今天的次数
     GET  /v1/models                    可用的模型、每种计算花几次、GPU 在不在线
     POST /v1/jobs                      提交一个计算（和网站的 /uma/jobs 同一个队列、同一份每天次数；MACE 系列是学术许可，不提供）
     GET  /v1/jobs/<id>                 查询进度和结果
   定时任务见 wrangler.toml 的 [triggers]：周一生成每周精选，每 15 分钟发一小批邮件（deploy/digest.js），同一次里探测一下站长的 GPU 在不在线。

   赠送的 Pro：grants 表里 source = admin 的是站长本人（永久 Pro，可以发 VIP 卡），这一行用 wrangler d1 execute
   手动写入（见 PAYMENTS.md），不经过任何接口；兑换了 VIP 卡的人直接按 cards 表里的兑换记录算有效期。

   部署步骤见 PAYMENTS.md 第 4 节；本地测试：deno run -A tools/account-test.ts */

import { forward, list, reply } from './ai-proxy-worker.js';
import { buildDigest, digestMail, latestDigest, mailFor, previewOf, sendPending, unsubscribe } from './digest.js';

const DEFAULT_ORIGINS = 'https://molastria.com,https://www.molastria.com,tauri://localhost,http://tauri.localhost,https://tauri.localhost';
const ACTIVE = ['active', 'trialing', 'past_due'];
const RECHECK = 6 * 3600;          // re-read a subscription from Stripe after this many seconds
const SESSION_DAYS = 90;
const MAX_SESSIONS = 5;            // devices signed in at once per email; the oldest is signed out
const CODE_MINUTES = 10;
// Hosted AI is counted in answers, so a request that can cost more counts for more. A normal cited answer fits in one unit.
const UNIT_CHARS = 12000, UNIT_TOKENS = 4096;  // one answer: this much input, this much output allowed
const AUX_CHARS = 2000, AUX_TOKENS = 400;      // a short call (search keywords, connection test) must fit both
const MAX_INPUT_CHARS = 48000;
// Photos in hosted AI (the AI panel and the Study Desk): at most 4 per request, each a base64 JPEG/PNG/WebP/GIF data
// URL the page has already shrunk (public/ai/ai.js readImage keeps one under ~600 000 characters). One photo counts
// like IMAGE_CHARS characters of text: DeepSeek bills an image as at most ~1 000 tokens (api-docs.deepseek.com/guides/vision).
const MAX_IMAGES = 4, MAX_IMAGE_CHARS = 900_000, IMAGE_CHARS = 3000, AI_MAX_BODY = 3_000_000;
const IMAGE_URL = /^data:image\/(jpeg|png|webp|gif);base64,[A-Za-z0-9+/]+={0,2}$/;
/** Hosted-AI messages, checked and rebuilt: text, or (user turns only) text and image parts. → {messages, chars, images} */
function hostedMessages(messages) {
  let chars = 0, images = 0;
  const out = messages.map((m) => {
    const role = ['system', 'user', 'assistant'].includes(m?.role) ? m.role : null;
    if (!role) throw fail(400, '消息格式不对');
    if (typeof m.content === 'string') { chars += m.content.length; return { role, content: m.content }; }
    if (!Array.isArray(m.content) || role !== 'user') throw fail(400, '托管额度只支持文字内容');
    const parts = m.content.map((p) => {
      if (p?.type === 'text' && typeof p.text === 'string') { chars += p.text.length; return { type: 'text', text: p.text }; }
      const url = p?.type === 'image_url' ? String(p.image_url?.url || '') : '';
      if (!url) throw fail(400, '托管额度只支持文字和图片');
      if (url.length > MAX_IMAGE_CHARS) throw fail(413, '图片太大，换一张小一点的再试');
      if (!IMAGE_URL.test(url)) throw fail(400, '图片要是 JPEG、PNG、WebP 或 GIF');
      images++;
      return { type: 'image_url', image_url: { url } };
    });
    return { role, content: parts };
  });
  if (images > MAX_IMAGES) throw fail(413, `一次最多附 ${MAX_IMAGES} 张图`);
  return { messages: out, chars: chars + images * IMAGE_CHARS, images };
}
/** Hosted models that read images (env HOSTED_VISION_MODELS, default deepseek-flash). */
const visionModels = (env) => (list(env.HOSTED_VISION_MODELS).length ? list(env.HOSTED_VISION_MODELS) : ['deepseek-flash']);

const now = () => Math.floor(Date.now() / 1000);
const monthKey = () => new Date().toISOString().slice(0, 7);
const quota = (env) => Number(env.MONTHLY_ASKS || 300);
// Free accounts: a small daily allowance of hosted answers (0 turns it off), counted in the throttle table over 24 hours.
const freeQuota = (env) => Math.max(0, Number(env.FREE_DAILY_ASKS ?? 5) || 0);
const hostedModels = (env) => (list(env.HOSTED_MODELS).length ? list(env.HOSTED_MODELS) : ['deepseek-flash']);
/** How many answers one call to this model counts as: "deepseek-v4-pro:3,other-model:2". */
const modelWeight = (env, model) => Number(list(env.HOSTED_MODEL_WEIGHTS ?? 'deepseek-v4-pro:3').map((w) => w.split(':')).find(([m]) => m === model)?.[1]) || 1;
const normEmail = (v) => {
  const e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
};
// `en` is the same message in English and `code` a word a program can branch on: the compute API (/v1) answers with all three;
// the site shows the Chinese and translates it itself.
const fail = (status, message, en, code) => Object.assign(new Error(message), { status, en, code });

function json(data, headers, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
/** A uniform 6-digit code: draws at or above the largest multiple of 10^6 below 2^32 are thrown away, so no code is likelier. */
function sixDigits() {
  const limit = 2 ** 32 - (2 ** 32 % 1e6);
  let n;
  do n = crypto.getRandomValues(new Uint32Array(1))[0]; while (n >= limit);
  return String(n % 1e6).padStart(6, '0');
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── rate limits ─────────────────────────────────────────────────────────
/** Adds `cost` uses to this window's count and returns the new count. */
async function bump(env, key, seconds, cost = 1) {
  const t = now();
  const row = await env.DB.prepare(
    'INSERT INTO throttle (key, n, reset) VALUES (?1, ?4, ?2) ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset < ?3 THEN ?4 ELSE n + ?4 END, reset = CASE WHEN reset < ?3 THEN ?2 ELSE reset END RETURNING n'
  ).bind(key, t + seconds, t, cost).first();
  return row.n;
}
async function allow(env, key, limit, seconds) { return (await bump(env, key, seconds)) <= limit; }
async function refund(env, key, cost = 1) { // give back the uses counted by allow() / bump() for a request that was not served
  await env.DB.prepare('UPDATE throttle SET n = MAX(n - ?2, 0) WHERE key = ?1').bind(key, cost).run().catch(() => {});
}

// ── Stripe (read-only restricted key: Customers, Checkout Sessions, Subscriptions) ──
async function stripe(env, path) {
  if (!env.STRIPE_KEY) throw fail(503, '账号服务还没有配置 Stripe 密钥');
  let res;
  try { res = await fetch(`https://api.stripe.com/v1/${path}`, { headers: { Authorization: `Bearer ${env.STRIPE_KEY}` } }); }
  catch { throw fail(502, '暂时连不上付款平台，请稍后再试'); }
  const j = await res.json().catch(() => ({}));
  if (res.status === 404) return null;
  if (!res.ok) throw fail(502, `付款平台返回错误（${res.status}）：${j.error?.message || ''}`.trim());
  return j;
}

/** The best live subscription for this email across every Stripe customer that uses it. */
async function planFromStripe(env, email, known) {
  const ids = new Set(known);
  const found = await stripe(env, `customers?limit=20&email=${encodeURIComponent(email)}`);
  for (const c of found?.data || []) ids.add(c.id);
  if (!ids.size) {
    // The list filter is case-sensitive; search also finds "Name@Example.com" typed at checkout.
    const s = await stripe(env, `customers/search?limit=20&query=${encodeURIComponent(`email:"${email}"`)}`).catch(() => null);
    for (const c of s?.data || []) ids.add(c.id);
  }
  let best = null;
  for (const id of ids) {
    const subs = await stripe(env, `subscriptions?limit=20&status=all&customer=${encodeURIComponent(id)}`);
    for (const s of subs?.data || []) {
      if (!ACTIVE.includes(s.status)) continue;
      const item = s.items?.data?.[0] || {};
      const seats = Number(item.quantity || s.quantity || 1);
      // Pro links sell one seat; the team plan sells five or more.
      const p = {
        plan: seats >= 2 ? 'team' : 'pro', seats,
        cycle: item.price?.recurring?.interval || item.plan?.interval || '',
        renews: Number(item.current_period_end || s.current_period_end || 0),
        status: s.cancel_at_period_end ? 'canceling' : s.status
      };
      if (!best || (p.plan === 'team') > (best.plan === 'team') || ((p.plan === 'team') === (best.plan === 'team') && p.renews > best.renews)) best = p;
    }
  }
  return { ...(best || { plan: 'free', seats: 0, cycle: '', renews: 0, status: '' }), customers: [...ids] };
}

/** Cached subscription summary; asks Stripe again when stale, expired or `fresh` is set. */
async function account(env, email, { fresh = false, known = [] } = {}) {
  let row = await env.DB.prepare('SELECT * FROM accounts WHERE email = ?1').bind(email).first();
  const t = now();
  if (fresh || !row || row.checked < t - RECHECK || (row.plan !== 'free' && row.renews && row.renews < t)) {
    try {
      const p = await planFromStripe(env, email, [...new Set([...known, ...JSON.parse(row?.customers || '[]')])]);
      row = { email, plan: p.plan, seats: p.seats, cycle: p.cycle, renews: p.renews, status: p.status, customers: JSON.stringify(p.customers), checked: t };
      await env.DB.prepare(
        'INSERT INTO accounts (email, plan, seats, cycle, renews, status, customers, checked) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8) ON CONFLICT(email) DO UPDATE SET plan = ?2, seats = ?3, cycle = ?4, renews = ?5, status = ?6, customers = ?7, checked = ?8'
      ).bind(row.email, row.plan, row.seats, row.cycle, row.renews, row.status, row.customers, row.checked).run();
    } catch (e) {
      if (!row) throw e; // Stripe unreachable: keep the last known plan
    }
  }
  return row;
}

/** A gift of Pro that is still valid: a grants row (the site admin), or the VIP cards this email redeemed.
    Cards stack in the order they were redeemed; a permanent one makes the whole gift permanent. */
async function grantOf(env, email) {
  const t = now();
  const row = await env.DB.prepare('SELECT source, expires FROM grants WHERE email = ?1 AND (expires IS NULL OR expires > ?2)').bind(email, t).first();
  if (row) return row;
  const cards = (await env.DB.prepare('SELECT days, redeemed_at FROM cards WHERE redeemed_by = ?1 AND revoked = 0 ORDER BY redeemed_at, code').bind(email).all()).results;
  if (!cards.length) return null;
  if (cards.some((c) => c.days == null)) return { source: 'card', expires: null };
  const expires = cards.reduce((end, c) => Math.max(end, c.redeemed_at) + c.days * 86400, 0);
  return expires > t ? { source: 'card', expires } : null;
}

/** What this email may use: its own subscription, a gift of Pro, or a seat in someone's team. */
async function access(env, email) {
  const own = await account(env, email);
  const grant = await grantOf(env, email);
  if (own.plan !== 'free') return { ...own, pro: true, role: own.plan === 'team' ? 'owner' : 'pro', grant };
  if (grant) return { ...own, plan: 'pro', seats: 1, cycle: '', renews: grant.expires || 0, status: 'active', pro: true, role: 'pro', grant };
  const m = await env.DB.prepare('SELECT owner FROM members WHERE member = ?1').bind(email).first();
  if (m) {
    const team = await account(env, m.owner);
    if (team.plan === 'team') return { ...team, email, customers: '[]', pro: true, role: 'member', owner: m.owner };
  }
  return { ...own, pro: false, role: 'free' };
}

/** What is left of a throttle() window: { n, reset }, or zero uses when the window has passed. */
async function windowOf(env, key) {
  const row = await env.DB.prepare('SELECT n, reset FROM throttle WHERE key = ?1 AND reset >= ?2').bind(key, now()).first();
  return row || { n: 0, reset: 0 };
}

async function view(env, a) {
  const month = monthKey();
  let usage;
  if (a.pro) {
    const u = (await env.DB.prepare('SELECT asks FROM usage WHERE email = ?1 AND month = ?2').bind(a.email, month).first()) || { asks: 0 };
    usage = { period: 'month', month, asks: u.asks, limit: quota(env) };
  } else { // a free account: the last 24 hours (old pages read month/asks/limit and only show it to Pro)
    const w = await windowOf(env, `aifree:${a.email}`);
    usage = { period: 'day', month, asks: w.n, limit: freeQuota(env), reset: w.reset };
  }
  const out = {
    email: a.email, pro: a.pro, role: a.role, plan: a.plan, cycle: a.cycle, seats: a.seats, renews: a.renews, status: a.status,
    usage, models: hostedModels(env)
  };
  if (a.role === 'member') out.owner = a.owner;
  if (a.role === 'owner') out.members = (await env.DB.prepare('SELECT member FROM members WHERE owner = ?1 ORDER BY added').bind(a.email).all()).results.map((r) => r.member);
  if (a.grant) out.grant = { source: a.grant.source, expires: a.grant.expires ?? null };
  if (a.grant?.source === 'admin') out.admin = true;
  return out;
}

// ── VIP cards ───────────────────────────────────────────────────────────
// Codes look like VIP-7KQ2-M9XD-4HTP: 12 characters without 0/O, 1/I/L or U, about 59 bits.
const CARD_ALPHABET = '23456789ABCDEFGHJKMNPQRSTVWXYZ';
function newCard() {
  const r = crypto.getRandomValues(new Uint8Array(12));
  const s = [...r].map((b) => CARD_ALPHABET[b % CARD_ALPHABET.length]).join('');
  return `VIP-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}`;
}
function normCard(v) {
  const s = String(v || '').toUpperCase().replace(/[^0-9A-Z]/g, '').replace(/^VIP/, '');
  return s.length === 12 && [...s].every((c) => CARD_ALPHABET.includes(c)) ? `VIP-${s.slice(0, 4)}-${s.slice(4, 8)}-${s.slice(8)}` : '';
}
/** A card this email may still redeem (unused, or already redeemed by this same email). */
async function usableCard(env, code, email) {
  const card = await env.DB.prepare('SELECT * FROM cards WHERE code = ?1').bind(code).first();
  if (!card || card.revoked || (card.redeemed_by && card.redeemed_by !== email)) throw fail(404, 'VIP 卡无效或已经被使用');
  return card;
}
/** Marks the card as used by this email; grantOf() turns the redeemed cards into Pro. */
async function redeem(env, email, code) {
  const card = await usableCard(env, code, email);
  if (card.redeemed_by === email) return;
  const taken = await env.DB.prepare('UPDATE cards SET redeemed_by = ?1, redeemed_at = ?2 WHERE code = ?3 AND redeemed_by IS NULL AND revoked = 0 RETURNING code').bind(email, now(), code).first();
  if (!taken) throw fail(409, '这张 VIP 卡刚刚被别人用掉了');
}
const cardList = async (env) => (await env.DB.prepare('SELECT code, days, note, created, redeemed_by, redeemed_at, revoked FROM cards ORDER BY created DESC, code LIMIT 500').all()).results;
async function signedInAdmin(env, request, refusal = '只有站长可以管理 VIP 卡') {
  const me = await signedIn(env, request);
  if ((await grantOf(env, me))?.source !== 'admin') throw fail(403, refusal);
  return me;
}

// ── growth (the owner's account page) ─────────────────────────────────
const DAY = 86400;
/** Accounts that predate the signups table are registered here first, with the earliest time any table knows of. */
const BACKFILL = 'INSERT OR IGNORE INTO signups (email, created, exact) SELECT email, MIN(t), 0 FROM (' +
  'SELECT email, created AS t FROM sessions UNION ALL SELECT email, created FROM api_keys UNION ALL SELECT email, created FROM digest_subs ' +
  'UNION ALL SELECT redeemed_by, redeemed_at FROM cards WHERE redeemed_by IS NOT NULL AND redeemed_at IS NOT NULL ' +
  'UNION ALL SELECT email, ?1 FROM accounts) WHERE email IS NOT NULL AND email <> \'\' GROUP BY email';
const maskEmail = (e) => { const [u, d = ''] = String(e).split('@'); return `${u.slice(0, 1)}${'*'.repeat(Math.max(1, Math.min(4, u.length - 1)))}@${d}`; };
async function growth(env) {
  const t = now();
  await env.DB.prepare(BACKFILL).bind(t).run();
  const one = async (sql, ...args) => Number(Object.values((await env.DB.prepare(sql).bind(...args).first()) || { n: 0 })[0] || 0);
  const today = Math.floor(t / DAY) * DAY;
  const daily = (await env.DB.prepare('SELECT (created / 86400) * 86400 AS day, COUNT(*) AS n FROM signups WHERE exact = 1 AND created >= ?1 GROUP BY day').bind(today - 29 * DAY).all()).results;
  const byDay = new Map(daily.map((r) => [Number(r.day), Number(r.n)]));
  const days = Array.from({ length: 30 }, (_, i) => { const d = today - (29 - i) * DAY; return { day: new Date(d * 1000).toISOString().slice(0, 10), n: byDay.get(d) || 0 }; });
  const recent = (await env.DB.prepare('SELECT email, created, exact FROM signups ORDER BY exact DESC, created DESC LIMIT 20').all()).results
    .map((r) => ({ who: maskEmail(r.email), created: Number(r.created), exact: !!r.exact }));
  return {
    total: await one('SELECT COUNT(*) AS n FROM signups'),
    before: await one('SELECT COUNT(*) AS n FROM signups WHERE exact = 0'),
    last7: await one('SELECT COUNT(*) AS n FROM signups WHERE exact = 1 AND created >= ?1', t - 7 * DAY),
    last30: await one('SELECT COUNT(*) AS n FROM signups WHERE exact = 1 AND created >= ?1', t - 30 * DAY),
    active30: await one('SELECT COUNT(DISTINCT email) AS n FROM sessions WHERE created >= ?1', t - 30 * DAY),
    paid: await one("SELECT COUNT(*) AS n FROM accounts WHERE plan <> 'free' AND status IN ('active', 'trialing', 'canceling')"),
    vip: await one('SELECT COUNT(DISTINCT redeemed_by) AS n FROM cards WHERE redeemed_by IS NOT NULL AND revoked = 0'),
    digest: await one('SELECT COUNT(*) AS n FROM digest_subs'),
    keys: await one('SELECT COUNT(DISTINCT email) AS n FROM api_keys'),
    sync: await one('SELECT COUNT(DISTINCT email) AS n FROM sync_items'),
    days, recent
  };
}

// ── sessions ────────────────────────────────────────────────────────────
async function createSession(env, email) {
  const token = randomToken();
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires < ?1').bind(t),
    // First sign-in of this email (the owner's growth card). An email that already has a session predates the signups
    // table: its time is only an upper bound (exact = 0). (Not accounts: /auth/verify writes that row just before this.)
    env.DB.prepare('INSERT OR IGNORE INTO signups (email, created, exact) SELECT ?1, COALESCE((SELECT MIN(created) FROM sessions WHERE email = ?1), ?2), ' +
      'CASE WHEN EXISTS (SELECT 1 FROM sessions WHERE email = ?1) THEN 0 ELSE 1 END').bind(email, t),
    env.DB.prepare('INSERT INTO sessions (hash, email, created, expires) VALUES (?1, ?2, ?3, ?4)').bind(await sha256(token), email, t, t + SESSION_DAYS * 86400),
    env.DB.prepare('DELETE FROM sessions WHERE email = ?1 AND hash NOT IN (SELECT hash FROM sessions WHERE email = ?1 ORDER BY created DESC, rowid DESC LIMIT ?2)').bind(email, MAX_SESSIONS)
  ]);
  return token;
}
const bearer = (request) => /^Bearer\s+(\S+)$/.exec(request.headers.get('Authorization') || '')?.[1] || '';
async function signedIn(env, request) {
  const token = bearer(request);
  if (!token) throw fail(401, '请先登录 MolAstria Pro');
  const row = await env.DB.prepare('SELECT email FROM sessions WHERE hash = ?1 AND expires > ?2').bind(await sha256(token), now()).first();
  if (!row) throw fail(401, '登录已过期，请重新登录');
  return row.email;
}

// ── mail (Resend) ───────────────────────────────────────────────────────
async function sendMail(env, to, subject, text, extra = {}) {
  if (!env.RESEND_API_KEY) {
    if (env.DEV_SHOW_CODE === '1') return;
    throw fail(503, '账号服务还没有配置发信');
  }
  const html = extra.html || `<div style="font:15px/1.7 -apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1f2a24;max-width:520px">${text
    .split('\n').map((l) => (l ? `<p style="margin:0 0 10px">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\b(\d{6})\b/, '<b style="font-size:26px;letter-spacing:4px">$1</b>')}</p>` : '')).join('')}</div>`;
  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM || 'MolAstria <login@molastria.com>', to: [to], subject, text, html, ...(extra.headers ? { headers: extra.headers } : {}) })
    });
  } catch { res = null; }
  if (!res?.ok) throw fail(502, '邮件发送失败，请稍后再试');
}
const codeMail = (code, en) => en
  ? [`Your MolAstria sign-in code: ${code}`, `Your MolAstria sign-in code is\n${code}\nIt expires in ${CODE_MINUTES} minutes. If you did not ask for it, ignore this email.\n\nhttps://molastria.com/`]
  : [`MolAstria 登录验证码：${code}`, `你的 MolAstria 登录验证码是\n${code}\n${CODE_MINUTES} 分钟内有效。如果不是你本人操作，忽略这封邮件即可。\n\nhttps://molastria.com/`];
const inviteMail = (owner) => [
  'MolAstria 课题组邀请 · Team invitation',
  `${owner} 把你加入了 TA 的 MolAstria 课题组，你已获得 Pro 权益。\n打开 https://molastria.com/pro/account.html ，用这个邮箱收验证码登录即可。\n\n${owner} added you to their MolAstria team plan. Sign in at https://molastria.com/pro/account.html with this email address.`
];

// ── Online models on the site owner's GPU (tools/uma-server, reached through Cloudflare Tunnel) ─────────
// This service limits jobs per visitor, decides who may use which model, keeps embargoed regions out (the FAIR
// Chemistry License requires following trade-control laws) and adds the shared secret the owner's computer checks.
// The computer may be off; health then answers { online: false } instead of an error.
//   fair: the Meta FAIR Chemistry models (UMA, eSEN, AllScAIP) and ANI-2x (MIT), free for everyone, sharing one daily
//         allowance: anonymous visitors by address, free accounts and Pro supporters by email, each a larger one.
//   asl: the MACE models are licensed for academic non-commercial use only, so they stay outside Pro: the same
//        free allowance for everyone, and the visitor confirms academic use with each job.
const UMA_BLOCKED = new Set(['CU', 'IR', 'KP', 'SY']);
const UMA_MODELS = {
  'uma-s-1p2p1': 'fair', 'uma-s-1p2': 'fair', 'uma-s-1p2p1-ft-d4rev': 'fair', 'uma-s-1p1': 'fair',
  'allscaip-md-conserving-all-omol': 'fair', 'allscaip-md-direct-all-omol': 'fair',
  'esen-sm-conserving-all-omol': 'fair', 'esen-sm-direct-all-omol': 'fair', 'esen-md-direct-all-omol': 'fair',
  'ani-2x': 'fair',
  'mace-off23-small': 'asl', 'mace-off23-medium': 'asl', 'mace-off23-large': 'asl', 'mace-omol-0': 'asl', 'mace-mdp': 'asl'
};
// Online model API v3 (the same contract as tools/uma-server/server.py): each job costs this many of the day's uses.
const UMA_COST = { sp: 1, opt: 1, ipea: 1, polar: 1, spin: 2, bde: 2, pa: 2, freq: 3, ir: 3, rxn: 3, conf: 5, scan: 5, md: 5 };
const UMA_GEOM = ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn'];
const UMA_CHARGED = new Set(['uma-s-1p2p1', 'uma-s-1p2', 'uma-s-1p2p1-ft-d4rev', 'allscaip-md-conserving-all-omol', 'allscaip-md-direct-all-omol']);
// Which jobs each kind of model does: charge-and-spin molecular models, neutral models, and MACE-MDP's properties.
const umaJobsOf = (model) => (model === 'mace-mdp' ? ['polar', 'ir'] : UMA_CHARGED.has(model) ? [...UMA_GEOM, 'ipea', 'spin', 'bde', 'pa'] : UMA_GEOM);
const SMILES_RE = /^[A-Za-z0-9@+\-[\]()=#$%/\\.:~*]{1,200}$/;
const UMA_SMILES_ONLY = new Set(['conf', 'rxn', 'bde', 'pa']);
// params: the allowed keys per job and how each is checked; anything else is dropped, a bad value is refused.
const pnum = (lo, hi, int = false) => (v) => (typeof v === 'number' && Number.isFinite(v) && v >= lo && v <= hi && (!int || Number.isInteger(v)) ? v : undefined);
const pbool = (v) => (typeof v === 'boolean' ? v : undefined);
const pone = (...ok) => (v) => (ok.includes(v) ? v : undefined);
const pidx = pnum(0, 999, true);
const plist = (n, item) => (v) => (Array.isArray(v) && v.length === n && v.every((x) => item(x) !== undefined) && new Set(v).size === n ? v : undefined);
const preaction = (v) => {
  if (typeof v !== 'string' || v.length > 400) return undefined;
  const sides = v.split('>>').map((s) => s.split('.'));
  if (sides.length !== 2) return undefined;
  // At least one species a side and at most 6 in all, repeats counted (server.py: MAX_SPECIES).
  return sides[0].length + sides[1].length <= 6 && sides.flat().every((x) => SMILES_RE.test(x)) ? v : undefined;
};
const TEMP = pnum(10, 2000);
const UMA_PARAMS = {
  sp: {}, ir: {},
  opt: { fmax: pnum(0.001, 0.1) },
  freq: { temperature: TEMP, symmetry: pnum(1, 24, true) },
  conf: { n: pnum(2, 30, true), temperature: TEMP, window_kcal: pnum(1, 30) },
  scan: { atoms: plist(4, pidx), start: pnum(-360, 360), end: pnum(-360, 360), points: pnum(3, 24, true) },
  md: { temperature: pnum(10, 1500), timestep_fs: pnum(0.1, 2.0), steps: pnum(100, 2000, true), friction: pnum(0.001, 0.1) },
  rxn: { reaction: preaction, thermo: pbool, temperature: TEMP },
  ipea: { mode: pone('vertical', 'adiabatic', 'both') },
  spin: { spins: plist(2, pnum(1, 4, true)) },
  bde: { bond: plist(2, pidx), thermo: pbool, temperature: TEMP },
  pa: { site: pidx, mode: pone('protonate', 'deprotonate'), thermo: pbool, temperature: TEMP },
  polar: { average: pbool, n: pnum(2, 20, true) }
};
// No default for these; spins and pa's mode have one on the computer (the two lowest multiplicities, protonate).
const UMA_REQUIRED = { scan: ['atoms'], rxn: ['reaction'], bde: ['bond'], pa: ['site'] };
function umaParams(job, raw) {
  if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) throw fail(400, '参数（params）必须是一个对象', 'params must be an object');
  const out = {};
  for (const [k, check] of Object.entries(UMA_PARAMS[job])) {
    if (raw?.[k] === undefined) continue;
    const v = check(raw[k]);
    if (v === undefined) throw fail(400, `参数 ${k} 的值不在允许的范围内`, `The value of parameter ${k} is outside the allowed range`);
    out[k] = v;
  }
  const missing = (UMA_REQUIRED[job] || []).filter((k) => !(k in out));
  if (missing.length) throw fail(400, `这项计算需要参数 ${missing.join('、')}`, `This calculation needs the parameter ${missing.join(', ')}`);
  if (job === 'scan' && (out.end ?? 180) <= (out.start ?? -180)) throw fail(400, '扫描的终止角要大于起始角', "The scan's end angle must be greater than its start angle");
  return out;
}
/** A standard XYZ text: atom count (1-120), a comment line, then one "Symbol x y z" line per atom. */
function umaXyz(v) {
  if (typeof v !== 'string' || v.length > 12000 || /[^\x20-\x7e\t\r\n]/.test(v)) throw fail(400, 'XYZ 结构不合法：最多 12000 个字符，只能包含普通 ASCII 字符', 'Invalid XYZ structure: at most 12000 characters, plain ASCII only');
  const lines = v.replace(/\r/g, '').replace(/^\s*\n/, '').split('\n');
  const n = Number(lines[0].trim());
  if (!Number.isInteger(n) || n < 1 || n > 120) throw fail(400, 'XYZ 结构的第一行要是原子数，在线计算最多 120 个原子', 'The first line of the XYZ structure must be the atom count; online calculations take at most 120 atoms');
  const atoms = lines.slice(2, 2 + n);
  const okLine = (l) => { const f = l.trim().split(/\s+/); return f.length >= 4 && /^[A-Z][a-z]?$/.test(f[0]) && f.slice(1, 4).every((x) => x !== '' && Number.isFinite(Number(x))); };
  if (atoms.length !== n || !atoms.every(okLine)) throw fail(400, 'XYZ 结构不合法：原子行要写成“元素符号 x y z”，行数要和第一行的原子数一致', 'Invalid XYZ structure: each atom line must read "symbol x y z", and the number of lines must match the atom count on the first line');
  return lines.slice(0, 2 + n).join('\n') + '\n';
}

async function visitorId(env, who) { // the computer sees a stable hash of the visitor, never the IP or email
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.UMA_SERVER_SECRET}|${who}`)));
  return [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function umaOrigin(env, path, init = {}) {
  if (!env.UMA_ORIGIN || !env.UMA_SERVER_SECRET) throw fail(503, 'UMA 计算服务还没有开通', 'The calculation service is not set up yet');
  const res = await fetch(env.UMA_ORIGIN.replace(/\/+$/, '') + path, {
    ...init,
    headers: {
      'Content-Type': 'application/json', 'X-MolAstria-Key': env.UMA_SERVER_SECRET,
      // Optional Cloudflare Access service token: requests without it are stopped at Cloudflare and never reach the computer.
      ...(env.UMA_ACCESS_ID && env.UMA_ACCESS_SECRET ? { 'CF-Access-Client-Id': env.UMA_ACCESS_ID, 'CF-Access-Client-Secret': env.UMA_ACCESS_SECRET } : {})
    },
    signal: AbortSignal.timeout(Number(env.UMA_TIMEOUT_MS || 8000))
  });
  const data = await res.json().catch(() => ({}));
  return { status: res.status, data };
}
/** `api` is set for a program calling with an API key (/v1): { email, pro }. */
async function uma(request, env, cors, path, ip, api = null) {
  const key = `${request.method} ${path}`;
  if (key === 'GET /uma/health') {
    try {
      const { status, data } = await umaOrigin(env, '/health');
      if (status !== 200) return json({ online: false }, { ...cors, 'Cache-Control': 'no-store' });
      // Per model: whether it is loaded, what it can do and how many visitors wait for it; only the known models.
      const models = {};
      for (const [id, v] of Object.entries(data.models && typeof data.models === 'object' ? data.models : {})) {
        if (!UMA_MODELS[id] || !v || typeof v !== 'object') continue;
        models[id] = { ready: !!v.ready, jobs: (Array.isArray(v.jobs) ? v.jobs : []).filter((j) => umaJobsOf(id).includes(j)), queue: Number(v.queue) || 0, running: !!v.running, tier: UMA_MODELS[id] };
      }
      const api = ['number', 'string'].includes(typeof data.api) ? { api: data.api } : {}; // the computer's API version
      return json({ online: !!data.ready, model: data.model, gpu: data.gpu || '', queue: data.queue, running: data.running, cached: data.cached, ...api, ...(Object.keys(models).length ? { models } : {}) }, { ...cors, 'Cache-Control': 'no-store' });
    } catch (e) {
      if (e.status === 503) return json({ online: false, configured: false }, cors);
      return json({ online: false }, cors);
    }
  }
  const country = request.cf?.country || '';
  if (UMA_BLOCKED.has(country)) throw fail(451, '按照模型许可要求遵守的出口管制规定，这个地区不能使用在线计算服务', 'Under the export control rules the model licences require us to follow, the online calculation service is not available in this region');
  if (key === 'POST /uma/jobs') {
    const raw = await request.text();
    if (raw.length > 16000) throw fail(413, '请求内容过大', 'Request too large');
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { throw fail(400, '请求不是合法的 JSON', 'The request is not valid JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, '请求不是合法的 JSON', 'The request is not valid JSON');
    const job = String(body.job || 'ipea');
    const model = String(body.model || 'uma-s-1p2p1');
    if (!Object.hasOwn(UMA_MODELS, model)) throw fail(400, '没有这个在线模型', 'No such online model');
    if (!Object.hasOwn(UMA_COST, job)) throw fail(400, '没有这种计算', 'No such calculation');
    if (!umaJobsOf(model).includes(job)) throw fail(400, '这个模型不做这种计算', 'This model does not do that calculation');
    const tier = UMA_MODELS[model];
    // A tick in a browser is how a visitor confirms academic use; a program cannot give that, so the API leaves these models out.
    if (tier === 'asl' && api) throw fail(403, 'MACE 模型采用学术软件许可（ASL），不通过 API 提供；可以在网站的在线模型页上使用', V1_ASL, 'licence');
    if (tier === 'asl' && body.academic !== true) throw fail(400, 'MACE 模型采用学术软件许可（ASL），请先勾选“只用于学术、非商业研究”');
    // Structure: exactly one of SMILES and XYZ; a reaction brings its species in params.reaction instead.
    const given = (v) => v !== undefined && v !== null && v !== '';
    const out = {};
    if (job === 'rxn') {
      if (given(body.smiles) || given(body.xyz)) throw fail(400, '反应计算的物种写在反应 SMILES 里，不要另给 SMILES 或 XYZ', "A reaction's species go in the reaction SMILES; do not also give SMILES or XYZ");
    } else if (given(body.smiles) === given(body.xyz)) {
      throw fail(400, given(body.smiles) ? 'SMILES 和 XYZ 只能给一个' : '请给出分子的 SMILES 或 XYZ 结构', given(body.smiles) ? 'Give either SMILES or XYZ, not both' : "Give the molecule's SMILES or XYZ structure");
    } else if (given(body.smiles)) {
      const smiles = String(body.smiles).trim();
      if (!SMILES_RE.test(smiles)) throw fail(400, 'SMILES 含有不支持的字符或太长', 'The SMILES contains unsupported characters or is too long');
      out.smiles = smiles;
    } else {
      if (UMA_SMILES_ONLY.has(job) || (job === 'polar' && body.params?.average === true)) throw fail(400, '这项计算要从 SMILES 生成结构，不接受 XYZ', 'This calculation builds its structures from SMILES and does not take XYZ');
      out.xyz = umaXyz(body.xyz);
    }
    Object.assign(out, { job, model }); // the same field order as API v2, so old requests reach the computer unchanged
    for (const [k, lo, hi] of [['charge', -2, 2], ['spin', 1, 4]]) {
      if (body[k] === undefined || body[k] === null || body[k] === '') continue;
      const v = Number(body[k]);
      if (!Number.isInteger(v) || v < lo || v > hi) throw fail(400, '电荷要在 -2 到 2 之间，自旋多重度在 1 到 4 之间', 'Charge must be between -2 and 2, spin multiplicity between 1 and 4');
      out[k] = v;
    }
    if (!UMA_CHARGED.has(model) && ((out.charge ?? 0) !== 0 || (out.spin ?? 1) !== 1)) throw fail(400, '这个模型只算中性闭壳层分子：电荷要为 0，自旋多重度为 1', 'This model takes neutral closed-shell molecules only: charge 0 and multiplicity 1');
    const params = umaParams(job, body.params);
    if (Object.keys(params).length) out.params = params;
    // Conformer-averaged polarisability and the thermochemistry options need frequency runs: 5 uses each.
    const cost = (job === 'polar' && params.average) || (['rxn', 'bde', 'pa'].includes(job) && params.thermo) ? 5 : UMA_COST[job];
    const email = api ? api.email : await signedIn(env, request).catch(() => null);
    const pro = api ? api.pro : email ? (await access(env, email)).pro : false;
    let counter, limit, used, more = '', moreEn = '';
    if (tier === 'asl') { // the same for everyone: an account or a paid plan must not buy more of an academic-only model
      [counter, limit, used] = [`asl:${ip}`, Number(env.ASL_DAILY || 40), '今天的 MACE 计算次数已用完'];
    } else if (pro) { // the three allowances: Pro supporters, free accounts, anonymous visitors
      [counter, limit, used] = [`uma:${email}`, Number(env.UMA_DAILY_PRO || 200), '今天的在线模型计算次数已用完'];
    } else if (email) {
      [counter, limit, used, more, moreEn] = [`uma:${email}`, Number(env.UMA_DAILY_ACCOUNT || 100), '今天的在线模型计算次数已用完', '，Pro 支持者每天更多', '; Pro supporters get more'];
    } else {
      [counter, limit, used, more] = [`uma:${ip}`, Number(env.UMA_DAILY || 40), '今天的在线模型计算次数已用完', '，登录免费账号每天更多'];
    }
    // A job costs UMA_COST uses at once; one that does not fit in what is left is refused and costs nothing.
    const n = await bump(env, counter, 86400, cost);
    if (n > limit) {
      await refund(env, counter, cost);
      const left = Math.max(0, limit - (n - cost));
      if (!left) throw fail(429, `${used}（每天 ${limit} 次${more}），明天再来`, `Today's online model uses are used up (${limit} a day${moreEn}); come back tomorrow`, 'quota_exceeded');
      throw fail(429, `今天还剩 ${left} 次，这项计算要用 ${cost} 次（每天 ${limit} 次${more}）；换一项花费少的计算，或明天再来`, `${left} uses left today and this calculation needs ${cost} (${limit} a day${moreEn}); choose a cheaper calculation or come back tomorrow`, 'quota_exceeded');
    }
    // Programs together get a share of the day, so scripts cannot crowd the site's own visitors off one home GPU.
    const total = api ? Math.max(0, Number(env.API_DAILY_TOTAL ?? 2000) || 0) : 0;
    const giveBack = async () => { await refund(env, counter, cost); if (total) await refund(env, 'v1:all', cost); };
    if (total && (await bump(env, 'v1:all', 86400, cost)) > total) {
      await giveBack();
      throw fail(429, '今天通过 API 提交的计算已经到了总量上限，明天再来，或者到网站的在线模型页上算', 'The API as a whole has reached its total for today; come back tomorrow, or use the online models page of the site', 'api_busy');
    }
    out.who = await visitorId(env, email || ip); // one job at a time per visitor, checked on the computer
    let status, data;
    try {
      ({ status, data } = await umaOrigin(env, '/jobs', { method: 'POST', body: JSON.stringify(out) }));
    } catch {
      await giveBack();
      throw fail(503, '站长的 GPU 现在离线，请稍后再试', "The site owner's GPU is offline right now, try again later", 'offline');
    }
    if (status >= 400) { // refused on the computer (busy visitor, full queue, unknown element): not counted
      await giveBack();
      if (status === 429) throw fail(429, '你已经有一个任务在排队或计算，等它完成再提交下一个', 'You already have a job queued or running; wait for it to finish before submitting the next one', 'job_in_progress');
      throw fail(status === 503 ? 503 : 400, data.error ? `计算服务：${data.error}` : '计算服务暂时不可用', data.error ? `Calculation service: ${data.error}` : 'The calculation service is not available right now');
    }
    if (api) { // a program cannot see the site's counter, so the answer says what the job cost and what is left
      const usage = { used: Math.min(n, limit), limit, remaining: Math.max(0, limit - n), reset: (await windowOf(env, counter)).reset };
      // For the account page: which key ran what and what it cost. Never the molecule.
      await env.DB.prepare('INSERT INTO api_jobs (id, email, key_id, model, job, cost, cached, created) VALUES (?1, ?2, ?3, ?4, ?5, ?6, ?7, ?8)')
        .bind(typeof data.id === 'string' ? data.id.slice(0, 16) : '', api.email, api.key || '', model, job, cost, data.cached ? 1 : 0, now()).run().catch((e) => console.error('api_jobs', e));
      return json({ ...data, cost, usage }, { ...cors, ...rateHeaders(usage) }, status);
    }
    return json(data, cors, status);
  }
  const m = /^\/uma\/jobs\/([0-9a-f]{16})$/.exec(path);
  if (request.method === 'GET' && m) {
    if (!(await allow(env, api ? `v1-poll:${api.email}` : `uma-poll:${ip}`, 1200, 3600))) throw fail(429, '查询太频繁，请稍后再试', 'Too many requests, try again later');
    try {
      const { status, data } = await umaOrigin(env, `/jobs/${m[1]}`);
      if (status === 404) throw fail(404, '没有找到这个任务（完成后保留一小时）', 'No such job (finished jobs are kept for an hour)');
      return json(data, { ...cors, 'Cache-Control': 'no-store' }, status);
    } catch (e) {
      if (e.status) throw e;
      throw fail(503, '站长的 GPU 现在离线，请稍后再试', "The site owner's GPU is offline right now, try again later", 'offline');
    }
  }
  throw fail(404, '没有这个接口', 'No such endpoint');
}

// ── API keys and the compute API for programs (/v1) ─────────────────────
// A free account makes its own keys on the account page. A key is shown once, when it is made: the table keeps its SHA-256
// and its first characters (so the page can tell keys apart). Revoking a key deletes its row.
// /v1 is the same queue as /uma, reached with a key instead of a browser session: any origin may call it, the uses are the
// account's own daily allowance (shared with what it uses on the site), and only models whose licence allows it are offered.
const KEY_PREFIX = 'mola_', MAX_KEYS = 3;
const KEY_RE = /^mola_[A-Za-z0-9_-]{43}$/;
const V1_DOCS = 'https://molastria.com/api/#compute';
const V1_ASL = 'The MACE models are under the Academic Software License (ASL) and are not offered through the API; use them on the online models page of the site';
const V1_NOTE = {
  zh: '算力是站长电脑上的 RTX 2080，尽力而为，可能离线；不要用在有时限的任务上。',
  en: "The compute is the RTX 2080 in the site owner's computer: best effort, and it may be offline. Do not build anything with a deadline on it."
};
const V1_CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, OPTIONS',
  'Access-Control-Allow-Headers': 'Content-Type, Authorization',
  'Access-Control-Expose-Headers': 'X-RateLimit-Limit, X-RateLimit-Remaining, X-RateLimit-Reset',
  'Access-Control-Max-Age': '86400'
};
const V1_CODES = { 400: 'invalid_request', 401: 'unauthorized', 403: 'forbidden', 404: 'not_found', 413: 'too_large', 429: 'too_many_requests', 451: 'region', 503: 'unavailable' };
const rateHeaders = (u) => ({ 'X-RateLimit-Limit': String(u.limit), 'X-RateLimit-Remaining': String(u.remaining), 'X-RateLimit-Reset': String(u.reset) });
const v1Models = Object.keys(UMA_MODELS).filter((id) => UMA_MODELS[id] === 'fair');
const v1Costs = Object.fromEntries(Object.entries(UMA_COST).filter(([job]) => v1Models.some((id) => umaJobsOf(id).includes(job))));

const JOBS_SHOWN = 10, JOBS_KEPT_DAYS = 30;
/** The account's keys, each with what it used in the last 24 hours. */
async function keyRows(env, email) {
  return (await env.DB.prepare(
    `SELECT substr(k.hash, 1, 16) AS id, k.prefix, k.name, k.created, k.last_used,
       (SELECT COALESCE(SUM(j.cost), 0) FROM api_jobs j WHERE j.email = k.email AND j.key_id = substr(k.hash, 1, 16) AND j.created > ?2) AS used_24h
     FROM api_keys k WHERE k.email = ?1 ORDER BY k.created, k.rowid`
  ).bind(email, now() - 86400).all()).results;
}
/** What the account page shows under the keys: today's allowance (shared with the site) and the latest jobs sent with a key. */
async function keyUsage(env, email) {
  const pro = (await access(env, email)).pro;
  const limit = Number(pro ? env.UMA_DAILY_PRO || 200 : env.UMA_DAILY_ACCOUNT || 100);
  const w = await windowOf(env, `uma:${email}`);
  const jobs = (await env.DB.prepare(
    `SELECT j.id, j.model, j.job, j.cost, j.cached, j.created, k.prefix AS key_prefix, k.name AS key_name
     FROM api_jobs j LEFT JOIN api_keys k ON k.email = j.email AND substr(k.hash, 1, 16) = j.key_id
     WHERE j.email = ?1 ORDER BY j.created DESC, j.rowid DESC LIMIT ?2`
  ).bind(email, JOBS_SHOWN).all()).results.map((j) => ({ ...j, cached: !!j.cached }));
  return { usage: { used: Math.min(w.n, limit), limit, remaining: Math.max(0, limit - w.n), reset: w.reset }, jobs };
}

// ── is the GPU there? ───────────────────────────────────────────────────
// The scheduled task asks the computer every 15 minutes and keeps per-day counts in one row (status.uptime), so the public
// answer costs one small read however often it is asked. "Best effort" is then a number anyone can check.
const UPTIME_SLOT = 900, UPTIME_KEPT_DAYS = 35, UPTIME_SHOWN_DAYS = 7;
const dayOf = (t) => new Date(t * 1000).toISOString().slice(0, 10);
async function uptimeRow(env) {
  const row = await env.DB.prepare("SELECT body FROM status WHERE name = 'uptime'").first();
  try { const v = JSON.parse(row?.body || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; }
}
async function probeUptime(env) {
  if (!env.UMA_ORIGIN || !env.UMA_SERVER_SECRET) return null; // no computer set up: nothing to record
  const t = now(), slot = t - (t % UPTIME_SLOT);
  const state = await uptimeRow(env);
  if (state.last?.slot === slot) return state; // this quarter of an hour is already counted
  let online = false, gpu = '';
  try {
    const { status, data } = await umaOrigin(env, '/health');
    online = status === 200 && !!data?.ready;
    gpu = online ? String(data.gpu || '').slice(0, 80) : '';
  } catch { /* offline */ }
  const days = state.days && typeof state.days === 'object' ? state.days : {};
  const today = dayOf(slot), [up, n] = Array.isArray(days[today]) ? days[today] : [0, 0];
  days[today] = [up + (online ? 1 : 0), n + 1];
  // The first probe of a day also forgets job records older than a month.
  if (!n) await env.DB.prepare('DELETE FROM api_jobs WHERE created < ?1').bind(t - JOBS_KEPT_DAYS * 86400).run();
  const oldest = dayOf(slot - UPTIME_KEPT_DAYS * 86400);
  for (const d of Object.keys(days)) if (d < oldest) delete days[d];
  const next = { last: { slot, online, gpu: gpu || state.last?.gpu || '' }, days };
  await env.DB.prepare("INSERT INTO status (name, body, updated) VALUES ('uptime', ?1, ?2) ON CONFLICT(name) DO UPDATE SET body = ?1, updated = ?2").bind(JSON.stringify(next), t).run();
  return next;
}
function uptimeView(state) {
  const t = now(), days = [];
  let up = 0, n = 0;
  for (let i = UPTIME_SHOWN_DAYS - 1; i >= 0; i--) {
    const date = dayOf(t - i * 86400), [u, c] = Array.isArray(state.days?.[date]) ? state.days[date] : [0, 0];
    up += u; n += c;
    days.push({ date, samples: c, ratio: c ? Math.round((u / c) * 1000) / 1000 : null });
  }
  const fresh = state.last && t - state.last.slot < 3 * UPTIME_SLOT; // a missed probe or two is not "offline"; an old answer is "unknown"
  return {
    online: fresh ? !!state.last.online : null, checked: state.last?.slot || null, gpu: state.last?.gpu || '',
    uptime: { window_days: UPTIME_SHOWN_DAYS, every_minutes: UPTIME_SLOT / 60, samples: n, ratio: n ? Math.round((up / n) * 1000) / 1000 : null, days },
    note: V1_NOTE
  };
}
/** The account behind this request's API key. Only keys are taken here, never the sign-in token of a browser. */
async function keyOwner(env, request) {
  const key = bearer(request);
  if (!key) throw fail(401, '请在请求头里带上 API key：Authorization: Bearer mola_…', 'Send your API key in the request header: Authorization: Bearer mola_…');
  const hash = KEY_RE.test(key) ? await sha256(key) : '';
  const row = hash && await env.DB.prepare('SELECT substr(hash, 1, 16) AS id, email, prefix, name, created, last_used FROM api_keys WHERE hash = ?1').bind(hash).first();
  if (!row) throw fail(401, '这个 API key 无效或已撤销，在账号页可以重新生成', 'This API key is not valid or has been revoked; make a new one on the account page');
  const t = now();
  if (!row.last_used || row.last_used < t - 3600) await env.DB.prepare('UPDATE api_keys SET last_used = ?2 WHERE hash = ?1').bind(hash, t).run().catch(() => {});
  return row;
}
async function v1(request, env, path, ip) {
  const cors = V1_CORS;
  const key = `${request.method} ${path}`;
  if (key === 'GET /v1') { // what this is and where the documentation lives; needs no key
    return json({
      service: 'molastria-compute', version: 1, docs: V1_DOCS, auth: 'Authorization: Bearer mola_…', note: V1_NOTE,
      endpoints: ['GET /v1/status', 'GET /v1/me', 'GET /v1/models', 'POST /v1/jobs', 'GET /v1/jobs/{id}']
    }, cors);
  }
  if (key === 'GET /v1/status') { // public and cheap: one row, and a browser may keep the answer for five minutes
    return new Response(JSON.stringify(uptimeView(await uptimeRow(env))), { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=300' } });
  }
  if (env.API_COMPUTE === '0') throw fail(503, '计算接口暂时关闭', 'The compute API is switched off for now');
  if (UMA_BLOCKED.has(request.cf?.country || '')) throw fail(451, '按照模型许可要求遵守的出口管制规定，这个地区不能使用在线计算服务', 'Under the export control rules the model licences require us to follow, the online calculation service is not available in this region');
  const owner = await keyOwner(env, request);
  const pro = (await access(env, owner.email)).pro;
  if (key === 'GET /v1/me') {
    const limit = Number(pro ? env.UMA_DAILY_PRO || 200 : env.UMA_DAILY_ACCOUNT || 100);
    const w = await windowOf(env, `uma:${owner.email}`);
    const usage = { used: Math.min(w.n, limit), limit, remaining: Math.max(0, limit - w.n), reset: w.reset };
    return json({ tier: pro ? 'pro' : 'free', usage, key: { prefix: owner.prefix, name: owner.name, created: owner.created } }, { ...cors, ...rateHeaders(usage) });
  }
  if (key === 'GET /v1/models') {
    if (!(await allow(env, `v1-poll:${owner.email}`, 1200, 3600))) throw fail(429, '查询太频繁，请稍后再试', 'Too many requests, try again later');
    let health = null;
    try {
      const { status, data } = await umaOrigin(env, '/health');
      if (status === 200 && data && typeof data === 'object') health = data;
    } catch { /* offline, or not set up: the list below still says what exists */ }
    const live = health?.models && typeof health.models === 'object' ? health.models : {};
    const models = v1Models.map((id) => {
      const v = live[id] && typeof live[id] === 'object' ? live[id] : {};
      return { id, ready: !!v.ready, queue: Number(v.queue) || 0, charged: UMA_CHARGED.has(id), jobs: umaJobsOf(id).filter((j) => !Array.isArray(v.jobs) || v.jobs.includes(j)) };
    });
    return json({ online: !!health?.ready, gpu: String(health?.gpu || ''), models, costs: v1Costs, cost_with_thermo: 5, note: V1_NOTE }, cors);
  }
  if (key === 'POST /v1/jobs' || (request.method === 'GET' && /^\/v1\/jobs\/[0-9a-f]{16}$/.test(path))) {
    return uma(request, env, cors, path.replace('/v1/', '/uma/'), ip, { email: owner.email, pro, key: owner.id });
  }
  throw fail(404, '没有这个接口', 'No such endpoint');
}

// ── routes ──────────────────────────────────────────────────────────────
// ── cloud sync ──────────────────────────────────────────────────────────
// Each signed-in account keeps a few of the site's localStorage records (favourites, self-checks, the Study Desk, review cards;
// the list is public/sync/sync-core.js) as opaque text, one row per record. Versions are counted per account, so "what changed
// since version N" is one query. A device sends back the version it last saw (base); a row someone else changed in between is
// not overwritten but returned, and the device merges and tries again. The Worker never parses the records (10 ms CPU).
// Space: SYNC_FREE_KB for free accounts (0 = Pro only), SYNC_PRO_KB for Pro supporters.
const SYNC_KEY = /^[a-z0-9-]{1,48}$/, SYNC_MAX_KEYS = 32, SYNC_MAX_ITEM = 1_500_000, SYNC_MAX_BODY = 3_200_000;
const utf8 = (s) => new TextEncoder().encode(s).length;
async function syncLimit(env, email) {
  const pro = (await access(env, email)).pro;
  return { pro, limit: 1024 * Math.max(0, Number(pro ? env.SYNC_PRO_KB ?? 10240 : env.SYNC_FREE_KB ?? 1024) || 0) };
}
async function syncState(env, email) {
  const rows = (await env.DB.prepare('SELECT key, v, size, updated FROM sync_items WHERE email = ?1').bind(email).all()).results;
  return {
    versions: Object.fromEntries(rows.map((r) => [r.key, r.v])),
    used: rows.reduce((n, r) => n + r.size, 0),
    cursor: rows.reduce((n, r) => Math.max(n, r.v), 0),
    updated: rows.reduce((n, r) => Math.max(n, r.updated), 0)
  };
}
async function sync(request, env, cors, url) {
  const me = await signedIn(env, request);
  const { pro, limit } = await syncLimit(env, me);
  if (request.method === 'DELETE') {
    await env.DB.prepare('DELETE FROM sync_items WHERE email = ?1').bind(me).run();
    return json({ ok: true, ...(await syncState(env, me)), limit, pro }, cors);
  }
  if (!limit) throw fail(403, '云同步是 Pro 支持者的功能');
  if (request.method === 'GET') {
    const since = Math.max(0, Math.floor(Number(url.searchParams.get('since')) || 0));
    const state = await syncState(env, me);
    // a version newer than anything stored means the cloud copy was deleted (or this is another account's cursor): send all
    const from = since > state.cursor ? 0 : since;
    const items = (await env.DB.prepare('SELECT key, v, body FROM sync_items WHERE email = ?1 AND v > ?2').bind(me, from).all()).results;
    return json({ ...state, items, limit, pro, reset: since > state.cursor }, cors);
  }
  if (request.method !== 'POST') throw fail(405, '不支持这种请求');
  const raw = await request.text();
  if (raw.length > SYNC_MAX_BODY) throw fail(413, '一次传的内容过大');
  let body;
  try { body = JSON.parse(raw); } catch { throw fail(400, '请求不是合法的 JSON'); }
  const items = Array.isArray(body?.items) ? body.items : [];
  if (!items.length || items.length > SYNC_MAX_KEYS) throw fail(400, '没有要同步的内容');
  if (!(await allow(env, `sync:${me}`, Number(env.SYNC_HOURLY || 360), 3600))) throw fail(429, '同步得太频繁，请过一会儿再试');
  const seen = new Set();
  const clean = items.map((it) => {
    const key = String(it?.key || ''), text = typeof it?.body === 'string' ? it.body : null;
    if (!SYNC_KEY.test(key) || seen.has(key) || text === null) throw fail(400, '同步的内容格式不对');
    seen.add(key);
    const size = utf8(text);
    if (size > SYNC_MAX_ITEM) throw fail(413, '有一份存档太大，没法同步');
    return { key, base: Math.max(0, Math.floor(Number(it.base) || 0)), body: text, size };
  });
  const t = now();
  // One statement per record: it is written only if the stored version is still the one the device saw, the account stays
  // under its space and its number of records; the new version is one more than the account's newest.
  const stmt = 'INSERT INTO sync_items (email, key, v, body, size, updated) '
    + 'SELECT ?1, ?2, (SELECT COALESCE(MAX(v), 0) + 1 FROM sync_items WHERE email = ?1), ?3, ?4, ?5 '
    + 'WHERE ?6 = COALESCE((SELECT v FROM sync_items WHERE email = ?1 AND key = ?2), 0) '
    + 'AND (SELECT COALESCE(SUM(size), 0) FROM sync_items WHERE email = ?1 AND key <> ?2) + ?4 <= ?7 '
    + 'AND (SELECT COUNT(*) FROM sync_items WHERE email = ?1 AND key <> ?2) < ?8 '
    + 'ON CONFLICT (email, key) DO UPDATE SET v = excluded.v, body = excluded.body, size = excluded.size, updated = excluded.updated RETURNING key, v';
  const done = await env.DB.batch(clean.map((c) => env.DB.prepare(stmt).bind(me, c.key, c.body, c.size, t, c.base, limit, SYNC_MAX_KEYS)));
  const saved = {};
  done.forEach((r) => { const row = r.results?.[0]; if (row) saved[row.key] = row.v; });
  const missed = clean.filter((c) => !(c.key in saved)).map((c) => c.key);
  let conflicts = [], full = [];
  if (missed.length) {
    const rows = (await env.DB.prepare(`SELECT key, v, body FROM sync_items WHERE email = ?1 AND key IN (${missed.map((_, i) => `?${i + 2}`).join(', ')})`).bind(me, ...missed).all()).results;
    const at = Object.fromEntries(rows.map((r) => [r.key, r]));
    for (const c of clean) {
      if (c.key in saved) continue;
      const cur = at[c.key];
      if ((cur?.v || 0) !== c.base) conflicts.push(cur ? { key: c.key, v: cur.v, body: cur.body } : { key: c.key, v: 0, body: null });
      else full.push(c.key); // the version matched, so it was the space (or the number of records)
    }
  }
  return json({ saved, conflicts, full, ...(await syncState(env, me)), limit, pro }, cors);
}

// ── words the Network view did not know ─────────────────────────────────
// A visitor's browser keeps the searches the term table did not recognise (public/hub/net-misses.js); the first time it keeps
// a word it also reports it here once, unless the visitor turned that off. Only the word, how many browsers reported it and the
// last full-text hit count are kept: no IP, account, page or time of day beyond first/last. The filter is the browser's
// worthKeeping(), repeated so a hand-made request cannot store an address, an email or a long number. One limit for everybody
// (NET_MISS_HOURLY) instead of a per-IP counter, so nothing about who sent it lands in the throttle table either.
const MISS_LEN = 60, MISS_ROWS = 3000;
const missText = (q) => String(q ?? '').replace(/\s+/g, ' ').trim();
const missKey = (q) => missText(q).normalize('NFKC').toLowerCase();
function missWorth(q) {
  const s = missText(q);
  if ([...s].length < 2 || s.length > MISS_LEN) return false;
  if (/[\u0000-\u001f\u007f]/.test(s) || /[@/\\]|:\/\/|^www\./i.test(s)) return false;
  if (/\d{6,}/.test(s.replace(/[\s-]/g, ''))) return false;
  return true;
}
async function missList(env) {
  const words = (await env.DB.prepare('SELECT shown AS q, n, hits, first, last FROM net_misses ORDER BY n DESC, last DESC LIMIT 300').all()).results;
  const { total } = await env.DB.prepare('SELECT COUNT(*) AS total FROM net_misses').first();
  return { words, total };
}
async function netMiss(env, body, cors) {
  const shown = missText(body.q);
  if (!missWorth(shown)) throw fail(400, '这个词不记');
  const hits = Math.max(0, Math.min(99999, Math.floor(Number(body.hits)) || 0));
  if (!(await allow(env, 'net-miss', Number(env.NET_MISS_HOURLY || 300), 3600))) throw fail(429, '提交太频繁，请稍后再试');
  const t = now();
  const row = await env.DB.prepare('INSERT INTO net_misses (term, shown, n, hits, first, last) VALUES (?1, ?2, 1, ?3, ?4, ?4) ON CONFLICT(term) DO UPDATE SET shown = ?2, n = n + 1, hits = ?3, last = ?4 RETURNING n')
    .bind(missKey(shown), shown, hits, t).first();
  // A new word may push the table over MISS_ROWS: the words reported least, longest ago, go first.
  if (row.n === 1) await env.DB.prepare('DELETE FROM net_misses WHERE term IN (SELECT term FROM net_misses ORDER BY n ASC, last ASC LIMIT MAX((SELECT COUNT(*) FROM net_misses) - ?1, 0))').bind(MISS_ROWS).run();
  return json({ ok: true }, cors);
}

// ── 联网网页搜索（Pro）────────────────────────────────────────────────
// The home page's 网上最匹配 asks free sources (OpenAlex, Wikipedia, PubChem, GitHub) from the browser; general web results
// cost money per query (Brave Search API), so they go through here: Pro only, a daily cap per person and a 30-day cap for
// the whole site so the bill has a ceiling. Only titles, addresses and plain-text snippets come back; nothing is stored.
const webText = (v, max) => {
  let t = String(v ?? '').replace(/&(?:quot|#0?39|amp|lt|gt|nbsp);/g, (m) => ({ '&quot;': '"', '&#39;': "'", '&#039;': "'", '&amp;': '&', '&lt;': '<', '&gt;': '>', '&nbsp;': ' ' })[m]);
  for (let prev = ''; prev !== t;) { prev = t; t = t.replace(/<[^<>]*>/g, ''); }
  return t.replace(/[<>]/g, '').replace(/\s+/g, ' ').trim().slice(0, max);
};
async function webSearch(request, env, cors, body) {
  const email = await signedIn(env, request);
  const a = await access(env, email);
  if (!a.pro) throw fail(403, '网页搜索只给 Pro 支持者');
  if (!env.BRAVE_SEARCH_KEY) throw fail(503, '网页搜索还没有开通');
  const q = String(body.q || '').replace(/\s+/g, ' ').trim();
  if (!q || q.length > 200) throw fail(400, '搜索词要在 1 到 200 个字之间');
  const daily = Number(env.WEB_DAILY_PRO || 50), monthly = Number(env.WEB_MONTHLY_ALL || 1500);
  const mine = `web:${email}`, all = 'web-all';
  if (!(await allow(env, mine, daily, 86400))) throw fail(429, '今天的网页搜索次数用完了，明天再来');
  if (!(await allow(env, all, monthly, 30 * 86400))) { await refund(env, mine); throw fail(503, '本月全站的网页搜索额度用完了'); }
  const lang = /[㐀-鿿]/.test(q) ? 'zh-hans' : 'en';
  let res;
  try {
    res = await fetch(`https://api.search.brave.com/res/v1/web/search?q=${encodeURIComponent(q)}&count=8&safesearch=moderate&text_decorations=false&search_lang=${lang}`, {
      headers: { Accept: 'application/json', 'X-Subscription-Token': env.BRAVE_SEARCH_KEY },
    });
  } catch { res = null; }
  if (!res || !res.ok) {
    await refund(env, mine); await refund(env, all);
    if (res) await res.text().catch(() => {});
    throw fail(502, res?.status === 429 ? '网页搜索暂时太忙，请稍后再试' : '网页搜索暂时连不上');
  }
  const data = await res.json().catch(() => ({}));
  const results = (data.web?.results || []).slice(0, 8).map((r) => {
    let url = '';
    try { const u = new URL(r.url); if (u.protocol === 'https:' || u.protocol === 'http:') url = u.href; } catch { /* dropped */ }
    return { title: webText(r.title, 200), url, snippet: webText(r.description, 300), site: webText(r.profile?.name || r.meta_url?.hostname || '', 80) };
  }).filter((r) => r.title && r.url);
  const used = (await windowOf(env, mine)).n;
  return json({ results, used, limit: daily }, cors);
}

async function route(request, env, cors) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (request.method === 'GET' && path === '/') return json({ ok: true, service: 'molastria-account' }, cors);
  if (request.method === 'GET' && path === '/me') return json(await view(env, await access(env, await signedIn(env, request))), cors);
  if (path === '/uma' || path.startsWith('/uma/')) return uma(request, env, cors, path, ip);
  if (path === '/sync') return sync(request, env, cors, url); // larger bodies than the rest, read there

  const raw = request.method === 'GET' ? '' : await request.text();
  // Hosted AI may carry photos, so it takes larger bodies than the rest.
  if (raw.length > (path === '/ai/chat' ? AI_MAX_BODY : Number(env.MAX_BODY || 200000))) throw fail(413, path === '/ai/chat' ? '内容太大：图片太多或太大，少附几张再试' : '请求内容过大');
  let body = {};
  if (raw) { try { body = JSON.parse(raw); } catch { throw fail(400, '请求不是合法的 JSON'); } }
  const key = `${request.method} ${path}`;

  if (key === 'POST /auth/checkout') {
    const id = String(body.session_id || '');
    if (!/^cs_(test|live)_[A-Za-z0-9]+$/.test(id)) throw fail(400, '订单参考号格式不对');
    if (!(await allow(env, `checkout:${ip}`, 30, 3600))) throw fail(429, '请求太频繁，请稍后再试');
    const s = await stripe(env, `checkout/sessions/${id}`);
    if (!s) throw fail(404, '没有找到这笔订单');
    if (s.status !== 'complete' || !['paid', 'no_payment_required'].includes(s.payment_status)) throw fail(402, '这笔订单还没有完成付款');
    if (s.created < now() - 86400) throw fail(410, '确认页链接已过期，请用付款邮箱登录');
    const email = normEmail(s.customer_details?.email || s.customer_email);
    if (!email) throw fail(422, '订单里没有邮箱，请联系我们');
    if (s.mode !== 'subscription') return json({ token: null, sponsor: true, email }, cors);
    await account(env, email, { fresh: true, known: s.customer ? [s.customer] : [] });
    const token = await createSession(env, email);
    return json({ token, account: await view(env, await access(env, email)) }, cors);
  }

  if (key === 'POST /auth/start') {
    const email = normEmail(body.email);
    if (!email) throw fail(400, '邮箱格式不对');
    if (!(await allow(env, `start-ip:${ip}`, 20, 3600)) || !(await allow(env, `start:${email}`, 5, 3600))) throw fail(429, '验证码发送太频繁，请一小时后再试');
    // A VIP card makes any email eligible; it is only marked used once the code from the email is entered.
    let card = null;
    if (body.card) {
      card = normCard(body.card);
      if (!card) throw fail(400, 'VIP 卡号格式不对，应该像 VIP-XXXX-XXXX-XXXX');
      await usableCard(env, card, email);
    }
    // Anyone may have a free account, so every valid email gets a code (and nobody learns who has paid).
    // Stripe is asked again on sign-in (/auth/verify), so someone who just paid does not wait for the 6-hour cache.
    const out = { ok: true };
    const code = sixDigits();
    await env.DB.prepare('INSERT INTO codes (email, hash, expires, tries, card) VALUES (?1, ?2, ?3, 0, ?4) ON CONFLICT(email) DO UPDATE SET hash = ?2, expires = ?3, tries = 0, card = ?4')
      .bind(email, await sha256(`${email}:${code}`), now() + CODE_MINUTES * 60, card).run();
    const [subject, text] = codeMail(code, body.lang === 'en');
    await sendMail(env, email, subject, text);
    if (env.DEV_SHOW_CODE === '1') out.devCode = code; // local testing only
    return json(out, cors);
  }

  if (key === 'POST /auth/verify') {
    const email = normEmail(body.email);
    const code = String(body.code || '').replace(/\D/g, '');
    if (!email || code.length !== 6) throw fail(400, '请填写邮箱和 6 位验证码');
    const row = await env.DB.prepare('SELECT * FROM codes WHERE email = ?1').bind(email).first();
    if (!row || row.expires < now()) throw fail(400, '验证码已过期，请重新获取');
    if (row.tries >= 5) throw fail(429, '尝试次数太多，请重新获取验证码');
    if (row.hash !== (await sha256(`${email}:${code}`))) {
      await env.DB.prepare('UPDATE codes SET tries = tries + 1 WHERE email = ?1').bind(email).run();
      throw fail(400, '验证码不对');
    }
    if (row.card) await redeem(env, email, row.card);
    await env.DB.prepare('DELETE FROM codes WHERE email = ?1').bind(email).run();
    await account(env, email, { fresh: true }).catch(() => {}); // a fresh look at Stripe; Stripe being down must not block signing in
    const token = await createSession(env, email);
    return json({ token, account: await view(env, await access(env, email)) }, cors);
  }

  if (key === 'POST /auth/signout') {
    const token = bearer(request);
    if (token) await env.DB.prepare('DELETE FROM sessions WHERE hash = ?1').bind(await sha256(token)).run();
    return json({ ok: true }, cors);
  }

  if (path === '/team/members' && (request.method === 'POST' || request.method === 'DELETE')) {
    const me = await signedIn(env, request);
    const a = await access(env, me);
    if (a.role !== 'owner') throw fail(403, '只有课题组版的购买者可以管理成员');
    const member = normEmail(body.email);
    if (!member) throw fail(400, '邮箱格式不对');
    if (member === me) throw fail(400, '你自己已经占用 1 个席位，不用再添加');
    if (request.method === 'DELETE') {
      await env.DB.prepare('DELETE FROM members WHERE member = ?1 AND owner = ?2').bind(member, me).run();
    } else {
      const other = await env.DB.prepare('SELECT owner FROM members WHERE member = ?1').bind(member).first();
      if (other && other.owner !== me) throw fail(409, '这个邮箱已经在另一个课题组里');
      if (!other) {
        const { n } = await env.DB.prepare('SELECT COUNT(*) AS n FROM members WHERE owner = ?1').bind(me).first();
        if (n >= a.seats - 1) throw fail(409, `席位已满：共 ${a.seats} 席，你自己占 1 席。可以在订阅管理里增加席位。`);
        await env.DB.prepare('INSERT INTO members (member, owner, added) VALUES (?1, ?2, ?3)').bind(member, me, now()).run();
        const [subject, text] = inviteMail(me);
        await sendMail(env, member, subject, text).catch(() => {}); // the seat counts even if the invitation bounces
      }
    }
    return json(await view(env, await access(env, me)), cors);
  }

  if (path === '/keys') { // API keys of the signed-in account, free or paid
    const me = await signedIn(env, request);
    const listed = async (extra = {}) => json({ ...extra, keys: await keyRows(env, me), max: MAX_KEYS, ...(await keyUsage(env, me)) }, cors);
    if (request.method === 'GET') return listed();
    if (request.method === 'POST') {
      if (!(await allow(env, `keys:${me}`, 10, 3600))) throw fail(429, '生成得太频繁，请一小时后再试');
      const name = String(body.name || '').replace(/[\u0000-\u001f\u007f]/g, '').trim().slice(0, 40);
      const made = KEY_PREFIX + randomToken();
      // One statement checks the limit and inserts, so two requests at once cannot both get the last place.
      const row = await env.DB.prepare(
        'INSERT INTO api_keys (hash, email, prefix, name, created) SELECT ?1, ?2, ?3, ?4, ?5 WHERE (SELECT COUNT(*) FROM api_keys WHERE email = ?2) < ?6 RETURNING prefix'
      ).bind(await sha256(made), me, made.slice(0, 10), name, now(), MAX_KEYS).first();
      if (!row) throw fail(409, `每个账号最多 ${MAX_KEYS} 个 API key，先撤销一个不用的`);
      return listed({ key: made });
    }
    if (request.method === 'DELETE') {
      const id = String(body.id || '');
      const row = /^[0-9a-f]{16}$/.test(id) && await env.DB.prepare('DELETE FROM api_keys WHERE email = ?1 AND substr(hash, 1, 16) = ?2 RETURNING prefix').bind(me, id).first();
      if (!row) throw fail(404, '没有这个 API key');
      return listed();
    }
  }

  if (key === 'POST /cards/redeem') {
    const me = await signedIn(env, request);
    const code = normCard(body.code);
    if (!code) throw fail(400, 'VIP 卡号格式不对，应该像 VIP-XXXX-XXXX-XXXX');
    if (!(await allow(env, `redeem:${me}`, 10, 3600))) throw fail(429, '尝试太频繁，请一小时后再试');
    await redeem(env, me, code);
    return json(await view(env, await access(env, me)), cors);
  }

  if (path === '/admin/cards') {
    const me = await signedInAdmin(env, request);
    if (request.method === 'POST') {
      const count = Math.floor(Number(body.count) || 1);
      if (count < 1 || count > 50) throw fail(400, '一次可以生成 1–50 张');
      const days = body.days == null || body.days === '' ? null : Math.floor(Number(body.days));
      if (days !== null && !(days >= 1 && days <= 3650)) throw fail(400, '有效期应为 1–3650 天，或留空表示永久');
      const note = String(body.note || '').trim().slice(0, 80);
      const t = now(), created = [];
      while (created.length < count) {
        const code = newCard();
        const row = await env.DB.prepare('INSERT INTO cards (code, days, note, created, created_by) VALUES (?1, ?2, ?3, ?4, ?5) ON CONFLICT(code) DO NOTHING RETURNING code').bind(code, days, note, t, me).first();
        if (row) created.push(code);
      }
      return json({ created, cards: await cardList(env) }, cors);
    }
    if (request.method === 'DELETE') {
      const code = normCard(body.code);
      // The redeemer loses exactly this card's days (their other cards still count).
      const row = code && await env.DB.prepare('UPDATE cards SET revoked = 1 WHERE code = ?1 RETURNING code').bind(code).first();
      if (!row) throw fail(404, '没有这张 VIP 卡');
      return json({ cards: await cardList(env) }, cors);
    }
    if (request.method === 'GET') return json({ cards: await cardList(env) }, cors);
  }

  if (key === 'POST /net/miss') return netMiss(env, body, cors);
  if (key === 'POST /web/search') return webSearch(request, env, cors, body);
  if (path === '/admin/net-misses' && (request.method === 'GET' || request.method === 'DELETE')) {
    await signedInAdmin(env, request, '只有站长可以看全站没找到的词');
    if (request.method === 'DELETE') {
      if (body.all === true) await env.DB.prepare('DELETE FROM net_misses').run();
      else if (missKey(body.term)) await env.DB.prepare('DELETE FROM net_misses WHERE term = ?1').bind(missKey(body.term)).run();
      else throw fail(400, '要删哪个词？');
    }
    return json(await missList(env), cors);
  }

  if (key === 'GET /admin/growth') {
    await signedInAdmin(env, request, '只有站长可以看增长数据');
    return json(await growth(env), cors);
  }

  if (key === 'GET /digest/preview') {
    return new Response(JSON.stringify(previewOf(await latestDigest(env)) || { items: [], total: 0 }), { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }

  if (path.startsWith('/digest/')) {
    const me = await signedIn(env, request); // every signed-in account, free or paid
    const sub = () => env.DB.prepare('SELECT token, lang FROM digest_subs WHERE email = ?1').bind(me).first();
    const lang = body.lang === 'en' ? 'en' : 'zh';
    if (key === 'GET /digest/latest') {
      const s = await sub();
      return json({ digest: await latestDigest(env), subscribed: !!s }, cors);
    }
    if (key === 'POST /digest/subscribe') {
      await env.DB.prepare('INSERT INTO digest_subs (email, token, lang, created) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(email) DO UPDATE SET lang = ?3').bind(me, randomToken(), lang, now()).run();
      return json({ subscribed: true }, cors);
    }
    if (key === 'DELETE /digest/subscribe') {
      await env.DB.batch([env.DB.prepare('DELETE FROM digest_subs WHERE email = ?1').bind(me), env.DB.prepare('DELETE FROM digest_sends WHERE email = ?1').bind(me)]);
      return json({ subscribed: false }, cors);
    }
    if (key === 'POST /digest/send-me') {
      if (!(await allow(env, `digest-me:${me}`, 3, 86400))) throw fail(429, '今天发得太多了，明天再试');
      const d = await latestDigest(env);
      if (!d) throw fail(404, '第一期还没有生成');
      const s = await sub();
      const m = s ? mailFor(env, d, { token: s.token, lang }) : digestMail(d, { en: lang === 'en', unsubscribeUrl: 'https://molastria.com/pro/account.html' });
      await sendMail(env, me, m.subject, m.text, { html: m.html, headers: s ? m.headers : undefined });
      return json({ ok: true }, cors);
    }
  }

  if (key === 'POST /admin/digest/build') {
    await signedInAdmin(env, request);
    const d = await buildDigest(env, { force: true });
    if (!d) throw fail(502, '这周的新论文太少，或者论文接口暂时不可用');
    return json({ digest: d }, cors);
  }

  if (key === 'POST /ai/chat') {
    const me = await signedIn(env, request);
    const a = await access(env, me);
    if (!a.pro && !freeQuota(env)) throw fail(403, '免配 key 的 AI 托管额度是 Pro 支持者的服务；也可以在 AI 设置里填自己的 key，永久免费');
    if (!(await allow(env, `ai:${me}`, 30, 60))) throw fail(429, '请求太频繁，请稍后再试');
    const checked = hostedMessages(Array.isArray(body.messages) ? body.messages : []);
    const { chars } = checked;
    body.messages = checked.messages;
    if (chars > MAX_INPUT_CHARS) throw fail(413, `内容太长：这次约 ${chars} 字，托管额度一次最多 ${MAX_INPUT_CHARS} 字。可以清空对话或缩短内容后重试。`);
    const tokens = Math.min(Number(body.max_tokens) || UNIT_TOKENS, Number(env.MAX_TOKENS || 12000));
    // A DeepSeek model the quota no longer offers (an older page, or a saved setting) is answered by the first one it does offer.
    const offered = hostedModels(env);
    if (!offered.includes(body.model) && /^deepseek-/.test(String(body.model)) && /^deepseek-/.test(offered[0] || '')) body.model = offered[0];
    if (checked.images && !visionModels(env).includes(body.model)) throw fail(400, `托管额度的 ${body.model} 不能看图，换成 DeepSeek V4.1 Flash-1017 再试`);
    const weight = modelWeight(env, body.model);
    // Short calls get their own, larger allowance; anything longer counts as answers, in proportion to what it can cost.
    const aux = Number(body.max_tokens) > 0 && tokens <= AUX_TOKENS && chars <= AUX_CHARS;
    const units = aux ? weight : weight * Math.max(1, Math.ceil(chars / UNIT_CHARS), Math.ceil(tokens / UNIT_TOKENS));
    if (!a.pro) return freeChat(env, cors, me, body, { units, aux });
    const limit = quota(env), month = monthKey();
    const counted = (n) => env.DB.prepare(
      'INSERT INTO usage (email, month, asks, aux) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(email, month) DO UPDATE SET asks = asks + ?3, aux = aux + ?4 RETURNING asks, aux'
    ).bind(me, month, aux ? 0 : n, aux ? n : 0).first();
    const u = await counted(units);
    if (aux ? u.aux > limit * 2 : u.asks > limit) {
      await counted(-units);
      const left = aux ? 0 : limit - (u.asks - units);
      if (left > 0) throw fail(429, `本月 AI 托管额度还剩 ${left} 次，这次请求要计 ${units} 次（长内容和 AI 实验室会多计）。可以缩短内容，或在 AI 设置里换成自己的 key。`);
      throw fail(429, `本月 ${limit} 次 AI 托管额度已用完，下个月 1 日恢复。也可以在 AI 设置里换成自己的 key 继续使用。`);
    }
    const res = await forward(body, env, cors, hostedModels(env));
    if (!res.ok) { await counted(-units); return res; }
    res.headers.set('X-MolAstria-Usage', `${u.asks}/${limit}`);
    return res;
  }

  throw fail(404, '没有这个接口');
}

/** Hosted AI for a free account: FREE_DAILY_ASKS answers in 24 hours (short calls get twice as many), counted like Pro's. */
async function freeChat(env, cors, me, body, { units, aux }) {
  const limit = freeQuota(env), key = `${aux ? 'aifree-aux' : 'aifree'}:${me}`, cap = aux ? limit * 2 : limit;
  const n = await bump(env, key, 86400, units);
  if (n > cap) {
    await refund(env, key, units);
    const left = Math.max(0, cap - (n - units));
    if (left > 0 && !aux) throw fail(429, `今天的免费 AI 次数还剩 ${left} 次，这次请求要计 ${units} 次（长内容和 AI 实验室会多计）。可以缩短内容，或在 AI 设置里换成自己的 key。`);
    throw fail(429, `免费账号每天 ${limit} 次 AI 托管额度，今天的已用完，明天再来。Pro 支持者每月 ${quota(env)} 次；在 AI 设置里换成自己的 key 也可以继续用。`);
  }
  const res = await forward(body, env, cors, hostedModels(env));
  if (!res.ok) { await refund(env, key, units); return res; }
  const used = aux ? (await windowOf(env, `aifree:${me}`)).n : n;
  res.headers.set('X-MolAstria-Usage', `${used}/${limit}`);
  return res;
}

const BUILD_CRON = '0 12-20 * * 1'; // hourly on Mondays, so a failed run gets another chance; it only builds once a week

export default {
  async scheduled(event, env) {
    try {
      if (event.cron === BUILD_CRON) await buildDigest(env);
      else {
        await probeUptime(env).catch((e) => console.error('uptime probe failed', e)); // its own catch: mail still goes out
        await sendPending(env, { access, sendMail });
      }
    } catch (e) { console.error('scheduled task failed', event.cron, e); }
  },

  async fetch(request, env) {
    // Linked from emails and posted to by mail apps, so it comes before the check of which sites may call this service.
    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/digest/unsubscribe' && ['GET', 'POST'].includes(request.method)) return unsubscribe(request, env);
    // The compute API for programs: the key is the permission, so any origin may call it (and no cookie is involved).
    const path = new URL(request.url).pathname.replace(/\/+$/, '');
    if (path === '/v1' || path.startsWith('/v1/')) {
      if (request.method === 'OPTIONS') return new Response(null, { status: 204, headers: V1_CORS });
      try {
        return await v1(request, env, path, request.headers.get('CF-Connecting-IP') || 'local');
      } catch (e) {
        if (!e.status) console.error(e);
        const status = e.status || 500;
        const error = e.status
          ? { code: e.code || V1_CODES[status] || 'error', message: e.en || e.message, message_zh: e.message }
          : { code: 'server_error', message: 'The service failed, try again later', message_zh: '账号服务出错了，请稍后再试' };
        return json({ error }, V1_CORS, status);
      }
    }
    const origin = request.headers.get('Origin') || '';
    const allowed = list(env.ALLOWED_ORIGINS || DEFAULT_ORIGINS);
    const originOk = !origin || allowed.includes('*') || allowed.includes(origin);
    const cors = {
      'Access-Control-Allow-Origin': originOk ? origin || '*' : 'null',
      'Access-Control-Allow-Methods': 'GET, POST, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization',
      'Access-Control-Expose-Headers': 'X-MolAstria-Usage',
      'Access-Control-Max-Age': '86400',
      Vary: 'Origin'
    };
    if (request.method === 'OPTIONS') return new Response(null, { status: originOk ? 204 : 403, headers: cors });
    if (!originOk) return reply(403, '这个网站没有使用账号服务的权限', cors);
    try {
      return await route(request, env, cors);
    } catch (e) {
      if (!e.status) console.error(e);
      return reply(e.status || 500, e.status ? e.message : '账号服务出错了，请稍后再试', cors);
    }
  }
};
