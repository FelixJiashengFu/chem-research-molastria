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
     GET  /digest/preview               每周精选的标题预览，公开
     GET  /digest/latest                每周精选全文和订阅状态，需 Pro
     POST /digest/subscribe {lang}      订阅邮件，需 Pro；DELETE 同一路径退订
     POST /digest/send-me               把最新一期发到自己的邮箱，需 Pro，每天 3 次
     POST /admin/digest/build           站长：重新生成本周精选
     GET、POST /digest/unsubscribe?t=   邮件里的退订链接，不需要登录
   定时任务见 wrangler.toml 的 [triggers]：周一生成每周精选，每 15 分钟发一小批邮件（deploy/digest.js）。

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
//   fair: the Meta FAIR Chemistry models (UMA, eSEN, AllScAIP) free for everyone, sharing one daily allowance (Pro gets
//         more runs a day); pro: ANI-2x (MIT) for Pro members only.
//   asl: the MACE models are licensed for academic non-commercial use only, so they stay outside Pro: the same
//        free allowance for everyone, and the visitor confirms academic use with each job.
const UMA_BLOCKED = new Set(['CU', 'IR', 'KP', 'SY']);
const UMA_MODELS = {
  'uma-s-1p2p1': 'fair', 'uma-s-1p2': 'fair', 'uma-s-1p2p1-ft-d4rev': 'fair', 'uma-s-1p1': 'fair',
  'allscaip-md-conserving-all-omol': 'fair', 'allscaip-md-direct-all-omol': 'fair',
  'esen-sm-conserving-all-omol': 'fair', 'esen-sm-direct-all-omol': 'fair', 'esen-md-direct-all-omol': 'fair',
  'ani-2x': 'pro',
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
  if (raw !== undefined && raw !== null && (typeof raw !== 'object' || Array.isArray(raw))) throw fail(400, '参数（params）必须是一个对象');
  const out = {};
  for (const [k, check] of Object.entries(UMA_PARAMS[job])) {
    if (raw?.[k] === undefined) continue;
    const v = check(raw[k]);
    if (v === undefined) throw fail(400, `参数 ${k} 的值不在允许的范围内`);
    out[k] = v;
  }
  const missing = (UMA_REQUIRED[job] || []).filter((k) => !(k in out));
  if (missing.length) throw fail(400, `这项计算需要参数 ${missing.join('、')}`);
  if (job === 'scan' && (out.end ?? 180) <= (out.start ?? -180)) throw fail(400, '扫描的终止角要大于起始角');
  return out;
}
/** A standard XYZ text: atom count (1-120), a comment line, then one "Symbol x y z" line per atom. */
function umaXyz(v) {
  if (typeof v !== 'string' || v.length > 12000 || /[^\x20-\x7e\t\r\n]/.test(v)) throw fail(400, 'XYZ 结构不合法：最多 12000 个字符，只能包含普通 ASCII 字符');
  const lines = v.replace(/\r/g, '').replace(/^\s*\n/, '').split('\n');
  const n = Number(lines[0].trim());
  if (!Number.isInteger(n) || n < 1 || n > 120) throw fail(400, 'XYZ 结构的第一行要是原子数，在线计算最多 120 个原子');
  const atoms = lines.slice(2, 2 + n);
  const okLine = (l) => { const f = l.trim().split(/\s+/); return f.length >= 4 && /^[A-Z][a-z]?$/.test(f[0]) && f.slice(1, 4).every((x) => x !== '' && Number.isFinite(Number(x))); };
  if (atoms.length !== n || !atoms.every(okLine)) throw fail(400, 'XYZ 结构不合法：原子行要写成“元素符号 x y z”，行数要和第一行的原子数一致');
  return lines.slice(0, 2 + n).join('\n') + '\n';
}

async function visitorId(env, who) { // the computer sees a stable hash of the visitor, never the IP or email
  const bytes = new Uint8Array(await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`${env.UMA_SERVER_SECRET}|${who}`)));
  return [...bytes.slice(0, 8)].map((b) => b.toString(16).padStart(2, '0')).join('');
}
async function umaOrigin(env, path, init = {}) {
  if (!env.UMA_ORIGIN || !env.UMA_SERVER_SECRET) throw fail(503, 'UMA 计算服务还没有开通');
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
async function uma(request, env, cors, path, ip) {
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
  if (UMA_BLOCKED.has(country)) throw fail(451, '按照模型许可要求遵守的出口管制规定，这个地区不能使用在线计算服务');
  if (key === 'POST /uma/jobs') {
    const raw = await request.text();
    if (raw.length > 16000) throw fail(413, '请求内容过大');
    let body;
    try { body = JSON.parse(raw || '{}'); } catch { throw fail(400, '请求不是合法的 JSON'); }
    if (!body || typeof body !== 'object' || Array.isArray(body)) throw fail(400, '请求不是合法的 JSON');
    const job = String(body.job || 'ipea');
    const model = String(body.model || 'uma-s-1p2p1');
    if (!Object.hasOwn(UMA_MODELS, model)) throw fail(400, '没有这个在线模型');
    if (!Object.hasOwn(UMA_COST, job)) throw fail(400, '没有这种计算');
    if (!umaJobsOf(model).includes(job)) throw fail(400, '这个模型不做这种计算');
    const tier = UMA_MODELS[model];
    if (tier === 'asl' && body.academic !== true) throw fail(400, 'MACE 模型采用学术软件许可（ASL），请先勾选“只用于学术、非商业研究”');
    // Structure: exactly one of SMILES and XYZ; a reaction brings its species in params.reaction instead.
    const given = (v) => v !== undefined && v !== null && v !== '';
    const out = {};
    if (job === 'rxn') {
      if (given(body.smiles) || given(body.xyz)) throw fail(400, '反应计算的物种写在反应 SMILES 里，不要另给 SMILES 或 XYZ');
    } else if (given(body.smiles) === given(body.xyz)) {
      throw fail(400, given(body.smiles) ? 'SMILES 和 XYZ 只能给一个' : '请给出分子的 SMILES 或 XYZ 结构');
    } else if (given(body.smiles)) {
      const smiles = String(body.smiles).trim();
      if (!SMILES_RE.test(smiles)) throw fail(400, 'SMILES 含有不支持的字符或太长');
      out.smiles = smiles;
    } else {
      if (UMA_SMILES_ONLY.has(job) || (job === 'polar' && body.params?.average === true)) throw fail(400, '这项计算要从 SMILES 生成结构，不接受 XYZ');
      out.xyz = umaXyz(body.xyz);
    }
    Object.assign(out, { job, model }); // the same field order as API v2, so old requests reach the computer unchanged
    for (const [k, lo, hi] of [['charge', -2, 2], ['spin', 1, 4]]) {
      if (body[k] === undefined || body[k] === null || body[k] === '') continue;
      const v = Number(body[k]);
      if (!Number.isInteger(v) || v < lo || v > hi) throw fail(400, '电荷要在 -2 到 2 之间，自旋多重度在 1 到 4 之间');
      out[k] = v;
    }
    if (!UMA_CHARGED.has(model) && ((out.charge ?? 0) !== 0 || (out.spin ?? 1) !== 1)) throw fail(400, '这个模型只算中性闭壳层分子：电荷要为 0，自旋多重度为 1');
    const params = umaParams(job, body.params);
    if (Object.keys(params).length) out.params = params;
    // Conformer-averaged polarisability and the thermochemistry options need frequency runs: 5 uses each.
    const cost = (job === 'polar' && params.average) || (['rxn', 'bde', 'pa'].includes(job) && params.thermo) ? 5 : UMA_COST[job];
    const email = await signedIn(env, request).catch(() => null);
    const pro = email ? (await access(env, email)).pro : false;
    let counter, limit, used;
    if (tier === 'pro') { // ANI-2x: Pro members only
      if (!pro) throw fail(403, 'ANI-2x 是 Pro 会员的在线模型，登录 Pro 账号后可用；其余模型对所有人免费');
      [counter, limit, used] = [`ani:${email}`, Number(env.ANI_DAILY_PRO || 100), '今天的 ANI-2x 计算次数已用完'];
    } else if (tier === 'asl') { // the same for everyone: a paid plan must not buy more of an academic-only model
      [counter, limit, used] = [`asl:${ip}`, Number(env.ASL_DAILY || 20), '今天的 MACE 计算次数已用完'];
    } else { // UMA: signed-in Pro members get a larger daily allowance than anonymous visitors
      [counter, limit, used] = [`uma:${pro ? email : ip}`, Number(pro ? env.UMA_DAILY_PRO || 100 : env.UMA_DAILY || 20), '今天的 UMA / OMol25 模型计算次数已用完'];
    }
    // A job costs UMA_COST uses at once; one that does not fit in what is left is refused and costs nothing.
    const n = await bump(env, counter, 86400, cost);
    if (n > limit) {
      await refund(env, counter, cost);
      const left = Math.max(0, limit - (n - cost)), more = tier === 'fair' && !pro ? '，Pro 会员每天更多' : '';
      if (!left) throw fail(429, `${used}（每天 ${limit} 次${more}），明天再来`);
      throw fail(429, `今天还剩 ${left} 次，这项计算要用 ${cost} 次（每天 ${limit} 次${more}）；换一项花费少的计算，或明天再来`);
    }
    out.who = await visitorId(env, pro ? email : ip); // one job at a time per visitor, checked on the computer
    let status, data;
    try {
      ({ status, data } = await umaOrigin(env, '/jobs', { method: 'POST', body: JSON.stringify(out) }));
    } catch {
      await refund(env, counter, cost);
      throw fail(503, '站长的 GPU 现在离线，请稍后再试');
    }
    if (status >= 400) { // refused on the computer (busy visitor, full queue, unknown element): not counted
      await refund(env, counter, cost);
      if (status === 429) throw fail(429, '你已经有一个任务在排队或计算，等它完成再提交下一个');
      throw fail(status === 503 ? 503 : 400, data.error ? `计算服务：${data.error}` : '计算服务暂时不可用');
    }
    return json(data, cors, status);
  }
  const m = /^\/uma\/jobs\/([0-9a-f]{16})$/.exec(path);
  if (request.method === 'GET' && m) {
    if (!(await allow(env, `uma-poll:${ip}`, 1200, 3600))) throw fail(429, '查询太频繁，请稍后再试');
    try {
      const { status, data } = await umaOrigin(env, `/jobs/${m[1]}`);
      if (status === 404) throw fail(404, '没有找到这个任务（完成后保留一小时）');
      return json(data, { ...cors, 'Cache-Control': 'no-store' }, status);
    } catch (e) {
      if (e.status) throw e;
      throw fail(503, '站长的 GPU 现在离线，请稍后再试');
    }
  }
  throw fail(404, '没有这个接口');
}

// ── routes ──────────────────────────────────────────────────────────────
async function route(request, env, cors) {
  const url = new URL(request.url);
  const path = url.pathname.replace(/\/+$/, '') || '/';
  const ip = request.headers.get('CF-Connecting-IP') || 'local';
  if (request.method === 'GET' && path === '/') return json({ ok: true, service: 'molastria-account' }, cors);
  if (request.method === 'GET' && path === '/me') return json(await view(env, await access(env, await signedIn(env, request))), cors);
  if (path === '/uma' || path.startsWith('/uma/')) return uma(request, env, cors, path, ip);

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

  if (key === 'GET /digest/preview') {
    return new Response(JSON.stringify(previewOf(await latestDigest(env)) || { items: [], total: 0 }), { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'public, max-age=3600' } });
  }

  if (path.startsWith('/digest/')) {
    const me = await signedIn(env, request);
    if (!(await access(env, me)).pro) throw fail(403, '每周精选是 Pro 功能');
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

const BUILD_CRON = '0 12-20 * * 1'; // hourly on Mondays, so a failed run gets another chance; it only builds once a week

export default {
  async scheduled(event, env) {
    try {
      if (event.cron === BUILD_CRON) await buildDigest(env);
      else await sendPending(env, { access, sendMail });
    } catch (e) { console.error('scheduled task failed', event.cron, e); }
  },

  async fetch(request, env) {
    // Linked from emails and posted to by mail apps, so it comes before the check of which sites may call this service.
    if (new URL(request.url).pathname.replace(/\/+$/, '') === '/digest/unsubscribe' && ['GET', 'POST'].includes(request.method)) return unsubscribe(request, env);
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
