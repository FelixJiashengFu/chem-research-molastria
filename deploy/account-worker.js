/* MolAstria · Pro 账号服务（Cloudflare Worker + D1）
   付款仍在 Stripe 的托管结账页完成；这个 Worker 只回答三件事：你是谁（邮箱登录）、你付过钱没有（向 Stripe 查询）、
   这个月还剩多少 AI 托管额度（转发到 DeepSeek / Muse 并计数）。不需要 Stripe webhook。

   接口（JSON；登录后用 Authorization: Bearer <令牌>）：
     POST /auth/checkout {session_id}   付款确认页自动登录（Stripe Checkout Session 24 小时内有效）
     POST /auth/start {email, lang, card?}  给有订阅的邮箱发 6 位验证码（对任何邮箱都回答 ok，不泄露谁买过）；
                                        带上未使用的 VIP 卡时也发，验证通过后卡才算兑换
     POST /auth/verify {email, code}    用验证码换登录令牌
     POST /auth/signout                 退出这台设备
     GET  /me                           订阅、额度、课题组成员
     POST /team/members {email}         课题组购买者添加成员；DELETE 同一路径移除
     POST /cards/redeem {code}          已登录时兑换 VIP 卡
     GET  /admin/cards                  站长：已发出的 VIP 卡；POST {count, days, note} 生成；DELETE {code} 收回
     POST /ai/chat                      与 deploy/ai-proxy-worker.js 相同的请求体，需 Pro

   赠送的 Pro：grants 表里 source = admin 的是站长本人（永久 Pro，可以发 VIP 卡），这一行用 wrangler d1 execute
   手动写入（见 PAYMENTS.md），不经过任何接口；兑换了 VIP 卡的人直接按 cards 表里的兑换记录算有效期。

   部署步骤见 PAYMENTS.md 第 4 节；本地测试：deno run -A tools/account-test.ts */

import { forward, list, reply } from './ai-proxy-worker.js';

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

const now = () => Math.floor(Date.now() / 1000);
const monthKey = () => new Date().toISOString().slice(0, 7);
const quota = (env) => Number(env.MONTHLY_ASKS || 300);
const hostedModels = (env) => (list(env.HOSTED_MODELS).length ? list(env.HOSTED_MODELS) : ['deepseek-flash', 'deepseek-v4-pro']);
/** How many answers one call to this model counts as: "deepseek-v4-pro:3,other-model:2". */
const modelWeight = (env, model) => Number(list(env.HOSTED_MODEL_WEIGHTS ?? 'deepseek-v4-pro:3').map((w) => w.split(':')).find(([m]) => m === model)?.[1]) || 1;
const normEmail = (v) => {
  const e = String(v || '').trim().toLowerCase();
  return e.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(e) ? e : '';
};
const fail = (status, message) => Object.assign(new Error(message), { status });

function json(data, headers, status = 200) {
  return new Response(JSON.stringify(data), { status, headers: { ...headers, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' } });
}
async function sha256(text) {
  const d = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(text));
  return [...new Uint8Array(d)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
function randomToken() {
  const bytes = crypto.getRandomValues(new Uint8Array(32));
  return btoa(String.fromCharCode(...bytes)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

// ── rate limits ─────────────────────────────────────────────────────────
async function allow(env, key, limit, seconds) {
  const t = now();
  const row = await env.DB.prepare(
    'INSERT INTO throttle (key, n, reset) VALUES (?1, 1, ?2) ON CONFLICT(key) DO UPDATE SET n = CASE WHEN reset < ?3 THEN 1 ELSE n + 1 END, reset = CASE WHEN reset < ?3 THEN ?2 ELSE reset END RETURNING n'
  ).bind(key, t + seconds, t).first();
  return row.n <= limit;
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

async function view(env, a) {
  const month = monthKey();
  const u = (await env.DB.prepare('SELECT asks FROM usage WHERE email = ?1 AND month = ?2').bind(a.email, month).first()) || { asks: 0 };
  const out = {
    email: a.email, pro: a.pro, role: a.role, plan: a.plan, cycle: a.cycle, seats: a.seats, renews: a.renews, status: a.status,
    usage: { month, asks: u.asks, limit: quota(env) }, models: hostedModels(env)
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
async function signedInAdmin(env, request) {
  const me = await signedIn(env, request);
  if ((await grantOf(env, me))?.source !== 'admin') throw fail(403, '只有站长可以管理 VIP 卡');
  return me;
}

// ── sessions ────────────────────────────────────────────────────────────
async function createSession(env, email) {
  const token = randomToken();
  const t = now();
  await env.DB.batch([
    env.DB.prepare('DELETE FROM sessions WHERE expires < ?1').bind(t),
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
async function sendMail(env, to, subject, text) {
  if (!env.RESEND_API_KEY) {
    if (env.DEV_SHOW_CODE === '1') return;
    throw fail(503, '账号服务还没有配置发信');
  }
  const html = `<div style="font:15px/1.7 -apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;color:#1f2a24;max-width:520px">${text
    .split('\n').map((l) => (l ? `<p style="margin:0 0 10px">${l.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/\b(\d{6})\b/, '<b style="font-size:26px;letter-spacing:4px">$1</b>')}</p>` : '')).join('')}</div>`;
  let res;
  try {
    res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: { Authorization: `Bearer ${env.RESEND_API_KEY}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ from: env.MAIL_FROM || 'MolAstria <login@molastria.com>', to: [to], subject, text, html })
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

// ── routes ──────────────────────────────────────────────────────────────
async function route(request, env, cors) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (request.method === 'GET' && path === '/') return json({ ok: true, service: 'molastria-account' }, cors);
  if (request.method === 'GET' && path === '/me') return json(await view(env, await access(env, await signedIn(env, request))), cors);

  const raw = request.method === 'GET' ? '' : await request.text();
  if (raw.length > Number(env.MAX_BODY || 200000)) throw fail(413, '请求内容过大');
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
    await account(env, email, { fresh: true }); // someone who just paid must not wait for the 6-hour cache
    const a = await access(env, email);
    const out = { ok: true };
    if (a.pro || card) {
      const code = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1e6).padStart(6, '0');
      await env.DB.prepare('INSERT INTO codes (email, hash, expires, tries, card) VALUES (?1, ?2, ?3, 0, ?4) ON CONFLICT(email) DO UPDATE SET hash = ?2, expires = ?3, tries = 0, card = ?4')
        .bind(email, await sha256(`${email}:${code}`), now() + CODE_MINUTES * 60, card).run();
      const [subject, text] = codeMail(code, body.lang === 'en');
      await sendMail(env, email, subject, text);
      if (env.DEV_SHOW_CODE === '1') out.devCode = code; // local testing only
    }
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

  if (key === 'POST /ai/chat') {
    const me = await signedIn(env, request);
    const a = await access(env, me);
    if (!a.pro) throw fail(403, '这个账号目前没有有效的 Pro 订阅');
    if (!(await allow(env, `ai:${me}`, 30, 60))) throw fail(429, '请求太频繁，请稍后再试');
    const messages = Array.isArray(body.messages) ? body.messages : [];
    if (messages.some((m) => typeof m?.content !== 'string')) throw fail(400, '托管额度只支持文字内容');
    const chars = messages.reduce((n, m) => n + m.content.length, 0);
    if (chars > MAX_INPUT_CHARS) throw fail(413, `内容太长：这次约 ${chars} 字，托管额度一次最多 ${MAX_INPUT_CHARS} 字。可以清空对话或缩短内容后重试。`);
    const tokens = Math.min(Number(body.max_tokens) || UNIT_TOKENS, Number(env.MAX_TOKENS || 12000));
    const weight = modelWeight(env, body.model);
    // Short calls get their own, larger allowance; anything longer counts as answers, in proportion to what it can cost.
    const aux = Number(body.max_tokens) > 0 && tokens <= AUX_TOKENS && chars <= AUX_CHARS;
    const units = aux ? weight : weight * Math.max(1, Math.ceil(chars / UNIT_CHARS), Math.ceil(tokens / UNIT_TOKENS));
    const limit = quota(env), month = monthKey();
    const counted = (n) => env.DB.prepare(
      'INSERT INTO usage (email, month, asks, aux) VALUES (?1, ?2, ?3, ?4) ON CONFLICT(email, month) DO UPDATE SET asks = asks + ?3, aux = aux + ?4 RETURNING asks, aux'
    ).bind(me, month, aux ? 0 : n, aux ? n : 0).first();
    const u = await counted(units);
    if (aux ? u.aux > limit * 2 : u.asks > limit) {
      await counted(-units);
      const left = aux ? 0 : limit - (u.asks - units);
      if (left > 0) throw fail(429, `本月 AI 托管额度还剩 ${left} 次，这次请求要计 ${units} 次（长内容、deepseek-v4-pro 和 AI 实验室会多计）。可以缩短内容、换成 deepseek-flash，或在 AI 设置里换成自己的 key。`);
      throw fail(429, `本月 ${limit} 次 AI 托管额度已用完，下个月 1 日恢复。也可以在 AI 设置里换成自己的 key 继续使用。`);
    }
    const res = await forward(body, env, cors, hostedModels(env));
    if (!res.ok) { await counted(-units); return res; }
    res.headers.set('X-MolAstria-Usage', `${u.asks}/${limit}`);
    return res;
  }

  throw fail(404, '没有这个接口');
}

export default {
  async fetch(request, env) {
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
