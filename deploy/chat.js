/* MolAstria · 讨论室（账号服务的 /chat/*；Durable Object ChatHub）
   所有人都能看，发言要登录 MolAstria 账号并起一个昵称。邮箱只留在 D1：chat_users 表把邮箱对成一个随机代号 uid，
   Durable Object 里只有 uid，邮箱和 IP 都不进来，也不发给任何浏览器。只有文字，没有图片、文件和 HTML。
   官方话题房间之外，登录用户可以自己开房间。消息一直保留：只有作者本人或站长能删，用户可以一次删掉自己的全部消息和昵称。

   这个文件里有：
     纯函数         清理文字，昵称、房间名的规则，屏蔽词
     class Hub      全部逻辑，不依赖平台：给它同步的 sql()、事务 tx()、当前的连接 sockets()、环境变量和时钟就能跑。
                    tools/chat-test.mjs 用 node:sqlite 和假连接测它；tools/chat-local.ts 在 Deno 里用它给浏览器测试当服务端。
     class ChatHub  Durable Object 的薄壳（SQLite 存储，WebSocket Hibernation）：没人说话时休眠，不计时长。全站只有一个实例 hub。
     chatRoute      Worker 这一侧：/chat/ws 用一次 D1 查询认出是谁，再把连接交给 ChatHub；/chat/summary 给首页卡片。
     chatCron       有举报没处理时给站长发一封邮件，每 12 小时最多一封。

   免费套餐每天 10 万次请求、10 万行写入、500 万行读取，所以：一条消息写 5 行（消息、两个索引、自增计数、房间的最后发言时间）；
   发言频率记在内存里，不写库（每天 300 条的上限在休眠醒来后从这个账号最近的消息里重新数出来）；房间列表、昵称和最近打开的房间的
   最后 50 条消息在内存里留一份，休眠醒来后再从库里读。翻旧消息另有一份小得多的额度（访客每个地址 10 分钟 60 次，账号 120 次），
   这份额度记在库里（表 quota，每 20 次读写一行），所以休眠也清不掉它。IPv6 地址按前四段（/64）算一个地址。
   已知的上限管不住的地方：浏览器发来的每一帧都计费（20 帧算一次请求），而服务端关掉一个连接之后，对方不理会关闭的话帧照样送到；
   ping 由平台直接回答，根本不经过这里。这里能做的只是让被拒绝、被关掉的连接后面的帧不读库、不回话（休眠醒来也不建表、不读房间）。
   真被人这样刷的时候，站长可以把 CHAT_STATE 设成 off，或者在 Cloudflare 给 /chat/ws 加一条速率限制规则。
   这里不能用 setTimeout / setInterval / alarm（会让它没法休眠），也不能 import cloudflare:workers（Deno 和 Node 的测试也要加载这个文件）。

   连接：new WebSocket(…/chat/ws, ['molastria-chat', 't.' + 登录令牌])（浏览器的 WebSocket 不能带 Authorization，没登录就不带第二项）。
   令牌无效或过期照样连上，身份是访客（hello 里 auth = expired）。文本帧 ping 由平台直接回 pong，不唤醒 ChatHub。
   其余每一帧是一个带 t 的 JSON 对象，时间都是毫秒：
     服务端 → 浏览器
       hello   {v, state: on|readonly, auth: ok|none|expired, me, rooms, online, reports?（只给站长）, limits, now}   连上就发
       room    {room, msgs（最后 50 条，从旧到新）, more, online}      回答 join
       older   {room, msgs, more}                                    回答 more
       msg     {m, cid?}        房间里的每个连接；cid 只在发言人自己那一份里
       act     {room, last, n}  不在那个房间的连接：那里有新消息
       upd     {m}              一条消息变了（删除、被举报隐藏、站长恢复）
       rooms   {rooms}          房间建了、改了、关了、删了之后发给所有人
       pres    {room, online}   有人进出房间
       who     {room, users: [{uid, name, role}], guests}
       me      {me}             自己的昵称、禁言、封禁变了（这个账号的每个连接）
       ok      {re, cid?, …}    report、del、wipe、mkroom（带 room）、edroom、rmroom、name、mod 成功
       err     {re, code, cid?, wait?（秒）, until?（毫秒）}
       reports {open}           给站长：待处理的举报数变了
       mod     {reports: [{id, m, title, n, reasons, t}], users: [{uid, name, muted, banned}]}   回答 mod list
     浏览器 → 服务端
       join {room} · more {room, before} · who {room}                访客也可以
       say {room, text, reply?, cid?} · del {id} · name {name} · report {id, reason?} · wipe
       mkroom {title, topic?} · edroom {room, title?, topic?, closed?} · rmroom {room}（站长）
       mod {op: list | mute {uid, hours} | ban {uid, on} | purge {uid} | resolve {id, action: keep|delete}}（站长）
     me   = {uid, name, role: user|admin, muted, banned, rooms}
     room = {id, kind: official|user, title, title_en, topic, topic_en, owner, owner_name, n, last, online, closed}
     m    = {id, room, uid, name, role, text, t, reply: {id, name, text} | null, del?: 1 作者删 | 2 站长删, hidden?: true}
     err 的 code：bad signin name-needed name-bad name-taken name-wait muted banned readonly closed slow flood dup empty long word
       no-room no-msg forbidden rooms-max rooms-full room-wait title-bad title-taken reports-max self，
       连接本身的 full（关闭码 4001）、flood（4002）、off（4003），以及存储出错时的 server。
   被隐藏或删掉的消息，原文不会发给任何浏览器（引用、首页摘要里也没有）；只有站长的 mod list 能看到被举报消息的原文。 */

const PROTO = 'molastria-chat';
const TEXT_MAX = 2000, NAME_MIN = 2, NAME_MAX = 20, TITLE_MIN = 2, TITLE_MAX = 30, TOPIC_MAX = 120, REASON_MAX = 200, CID_MAX = 40;
const PAGE = 50;                                                   // messages per join and per "more"
const FRAME_MAX = 8192, FRAME_BURST = 40, FRAME_WINDOW = 10_000;   // one socket: bytes in a frame, frames in a window (ms)
// Incoming frames are billed (20 make one request), so one address may not keep sending just under the burst limit all day.
const IPH_FRAMES = 1200, IPH_WINDOW = 600_000, PER_IPH = 12;
const GUEST_SHARE = 0.8;                                           // guests are turned away at this part of CHAT_MAX_SOCKETS: the rest is for accounts
// Reading history costs 51–100 rows a time, far more than any other frame: its own budget per address (guests) or account,
// kept in storage (one row written for every READ_CHUNK reads) so that a sleep does not hand out a new one.
const READS_GUEST = 60, READS_USER = 120, READ_WINDOW = 600_000, READ_CHUNK = 20;
const DAY_MS = 86_400_000;
const SLOW_MS = 1500, MINUTE_MAX = 15, DAY_MAX = 300, DUP_MS = 60_000;
const RENAME_MS = DAY_MS, ROOM_WAIT_MS = 600_000, EMPTY_ROOM_MS = 7 * DAY_MS, SWEEP_MS = 3_600_000;
const WIPE_MS = 60_000, EDIT_MS = 60_000;                          // one wipe a minute per account, one edit a minute per room
const OWNED_FACTOR = 3;                                            // rooms one account may own, open and closed: this times CHAT_ROOMS_PER_USER
const REPORTS_DAY = 20, HIDE_AT = 3;
const IN_MAX = 80;                                                 // a Durable Object query takes at most 100 bound parameters
const CACHED_ROOMS = 24, MAP_MAX = 5000;                           // what is kept in memory between two sleeps
const SUMMARY_TTL = 30;

/** The official rooms: id, 中文 title, English title, 中文 topic, English topic. The order is the order on the page. */
export const OFFICIAL = [
  ['lobby', '大厅', 'Lobby', '打个招呼，随便聊聊计算化学和这个网站', 'Say hello and talk about anything in computational chemistry'],
  ['qc', '量子化学与 DFT', 'Quantum chemistry & DFT', '泛函、基组、收敛、激发态、溶剂化：方法怎么选，结果怎么看', 'Functionals, basis sets, convergence, excited states, solvation: choosing a method and reading the results'],
  ['mlip', '机器学习势与模型', 'ML potentials & models', 'UMA、MACE、ANI 这些机器学习势：怎么用、怎么训练和验证', 'UMA, MACE, ANI and other machine-learned potentials: using, training and validating them'],
  ['software', '软件与报错求助', 'Software help', 'Gaussian、ORCA、PySCF、CP2K、VASP 等软件的安装、输入文件和报错', 'Installing and running Gaussian, ORCA, PySCF, CP2K, VASP and others: input files and error messages'],
  ['papers', '论文与预印本', 'Papers & preprints', '新论文和预印本，读到的好文章，值得讨论的结果', 'New papers and preprints, good reads, results worth arguing about'],
  ['study', '学习与课程', 'Study & courses', '教材、课程、入门路线，还有学到一半卡住的地方', 'Textbooks, courses, where to start, and where you got stuck'],
  ['site', '站务与反馈', 'Site feedback', 'MolAstria 的问题、建议和想要的功能', 'Bugs, suggestions and feature requests for MolAstria']
];
const RESERVED = ['站长', '站長', '管理员', '管理員', '官方', '客服', '系统', '系統', 'admin', 'moderator', 'molastria', 'official', 'system', 'owner'];

// ── text rules (pure) ───────────────────────────────────────────────────
// Control characters, zero-width spaces and the direction overrides that can reorder a line on screen.
const STRIP = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;
// Letters that are drawn as nothing (Hangul fillers, the Braille blank…): a name made of them would look empty.
const BLANK = /[\u115F\u1160\u17B4\u17B5\u180E\u2800\u3164\uFFA0]/g;
const VISIBLE = /[^\s\p{Cf}\p{M}]/u;
// What is left after STRIP and still draws nothing (variation selectors, the combining grapheme joiner, joiners, tags, the
// soft hyphen…): with one of these a name could look exactly like another one and still be a different string.
const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{Cf}]/u;
/** Whether a cleaned line holds a character nobody can see. Nicknames and room titles with one are refused, not repaired. */
export const invisible = (text) => INVISIBLE.test(text);
const count = (s) => [...s].length; // code points
const marks = (list) => list.map(() => '?').join(',');
const int = (v) => (Number.isSafeInteger(v) && v > 0 ? v : 0);
const secs = (ms) => Math.max(1, Math.ceil(ms / 1000));
const num = (v, fallback) => (v === undefined || v === null || v === '' || !Number.isFinite(Number(v)) ? fallback : Math.max(0, Math.floor(Number(v))));

function tidy(raw) {
  const s = (typeof raw.toWellFormed === 'function' ? raw.toWellFormed() : raw).normalize('NFC')
    .replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/\t/g, ' ').replace(STRIP, '').replace(BLANK, ' ');
  // Line by line, not one regex over the whole text: a long run of spaces would make that quadratic.
  return s.split('\n').map((l) => l.trimEnd()).join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
}
/** A message as it is stored: { text }, or { code: 'bad' | 'empty' | 'long' }. */
export function cleanText(raw, max = TEXT_MAX) {
  if (typeof raw !== 'string') return { code: 'bad' };
  if (raw.length > max * 8) return { code: 'long' };
  const text = tidy(raw);
  if (!VISIBLE.test(text)) return { code: 'empty' };
  return count(text) > max ? { code: 'long' } : { text };
}
/** The same on one line (room titles and topics, report reasons). */
export function cleanLine(raw, max) {
  if (typeof raw !== 'string') return { code: 'bad' };
  if (raw.length > max * 8) return { code: 'long' };
  const text = tidy(raw).replace(/\s+/g, ' ');
  if (!VISIBLE.test(text)) return { code: 'empty' };
  return count(text) > max ? { code: 'long' } : { text };
}
/** A nickname, or null: 2–20 letters, digits, spaces and _ - . starting with a letter or digit. */
export function cleanName(raw) {
  const c = cleanLine(raw, NAME_MAX);
  if (!c.text || count(c.text) < NAME_MIN || invisible(c.text)) return null;
  return /^[\p{L}\p{N}][\p{L}\p{M}\p{N} _.-]*$/u.test(c.text) ? c.text : null;
}
/** What makes two nicknames (or two room titles) the same: full-width forms, case and spaces do not count. */
export const keyOf = (s) => s.normalize('NFKC').toLowerCase().replace(/\s+/g, '');
/** Names that would pass for the site itself; only an admin may carry them. */
export const reservedName = (key) => RESERVED.some((w) => key.replace(/[_.-]/g, '').includes(w));
/** Whether the text contains one of env.CHAT_BLOCK ("word,another word"), whatever the case or width. */
export function blockedWord(text, env) {
  const words = String(env?.CHAT_BLOCK || '').split(',').map((w) => w.normalize('NFKC').toLowerCase().trim()).filter(Boolean);
  if (!words.length) return false;
  const low = text.normalize('NFKC').toLowerCase();
  return words.some((w) => low.includes(w));
}
/** One line of at most n code points, for quotes and the home card. */
export function clip(text, n) {
  const cp = [...String(text).replace(/\s+/g, ' ').trim()];
  return cp.length > n ? cp.slice(0, n - 1).join('') + '…' : cp.join('');
}
const ALNUM = 'abcdefghijklmnopqrstuvwxyz0123456789';
/** What the limits count as one address: an IPv4 address as it is (also when written as an IPv4-mapped IPv6 one), an IPv6
    address by its first four groups, since one subscriber has a whole /64 (2^64 addresses) to connect from. */
export function addrKey(ip) {
  const s = String(ip ?? '').trim().toLowerCase().replace(/^\[|\]$/g, '').replace(/%.*$/, '');
  if (!s.includes(':')) return s;
  let text = s;
  const quad = s.match(/^(.*:)(\d{1,3})\.(\d{1,3})\.(\d{1,3})\.(\d{1,3})$/);
  if (quad) {
    const b = quad.slice(2).map(Number);
    if (b.some((x) => x > 255)) return s;
    text = quad[1] + ((b[0] << 8) | b[1]).toString(16) + ':' + ((b[2] << 8) | b[3]).toString(16);
  }
  const halves = text.split('::');
  if (halves.length > 2) return s;
  const head = halves[0] ? halves[0].split(':') : [], tail = halves[1] ? halves[1].split(':') : [];
  const gap = halves.length === 2 ? 8 - head.length - tail.length : 0;
  const groups = [...head, ...Array(Math.max(0, gap)).fill('0'), ...tail];
  if (groups.length !== 8 || (halves.length === 2 && gap < 1) || !groups.every((g) => /^[0-9a-f]{1,4}$/.test(g))) return s; // not an address: counted as itself
  const g = groups.map((x) => parseInt(x, 16));
  if (g.slice(0, 5).every((x) => !x) && g[5] === 0xffff) return [g[6] >> 8, g[6] & 255, g[7] >> 8, g[7] & 255].join('.');
  return g.slice(0, 4).map((x) => x.toString(16)).join(':') + '::/64';
}
/** n random characters of [a-z0-9], each equally likely. */
export function randomId(n) {
  let out = '';
  while (out.length < n) {
    for (const b of crypto.getRandomValues(new Uint8Array(n * 2))) if (b < 252 && out.length < n) out += ALNUM[b % 36];
  }
  return out;
}
/** env.CHAT_STATE: on (default), readonly (only admins write) or off. */
export function chatState(env) {
  const s = String(env?.CHAT_STATE || 'on').trim().toLowerCase();
  return s === 'off' || s === 'readonly' ? s : 'on';
}
/** Whether a frame is over `max` bytes of UTF-8; only encodes it when its length does not already answer. */
function tooBig(data, max) {
  if (typeof data !== 'string') return (data?.byteLength ?? 0) > max;
  if (data.length > max) return true;
  return data.length * 3 > max && new TextEncoder().encode(data).length > max;
}

// ── the room logic ──────────────────────────────────────────────────────
// WITHOUT ROWID and partial indexes keep the rows written (and so the free plan's daily count) down: a row in such a table is
// one write, not a row and its key index. msgs keeps AUTOINCREMENT so that an id is never used twice, even after its row is removed.
const SCHEMA = [
  "CREATE TABLE IF NOT EXISTS rooms (id TEXT PRIMARY KEY, kind TEXT NOT NULL, title TEXT NOT NULL, title_en TEXT, topic TEXT NOT NULL DEFAULT '', topic_en TEXT, tkey TEXT NOT NULL, owner TEXT, created INTEGER NOT NULL, last INTEGER NOT NULL, n INTEGER NOT NULL DEFAULT 0, closed INTEGER NOT NULL DEFAULT 0, sort INTEGER NOT NULL DEFAULT 0) WITHOUT ROWID",
  'CREATE TABLE IF NOT EXISTS msgs (id INTEGER PRIMARY KEY AUTOINCREMENT, room TEXT NOT NULL, uid TEXT NOT NULL, text TEXT NOT NULL, reply INTEGER, t INTEGER NOT NULL, del INTEGER NOT NULL DEFAULT 0, hidden INTEGER NOT NULL DEFAULT 0, kept INTEGER NOT NULL DEFAULT 0)',
  'CREATE INDEX IF NOT EXISTS msgs_room ON msgs (room, id)',
  'CREATE INDEX IF NOT EXISTS msgs_uid ON msgs (uid, id)',
  "CREATE TABLE IF NOT EXISTS users (uid TEXT PRIMARY KEY, name TEXT, key TEXT UNIQUE, named INTEGER NOT NULL DEFAULT 0, role TEXT NOT NULL DEFAULT 'user', muted INTEGER NOT NULL DEFAULT 0, banned INTEGER NOT NULL DEFAULT 0, first INTEGER NOT NULL) WITHOUT ROWID",
  'CREATE INDEX IF NOT EXISTS users_held ON users (uid) WHERE banned = 1 OR muted > 0',
  "CREATE TABLE IF NOT EXISTS reports (msg INTEGER NOT NULL, who TEXT NOT NULL, reason TEXT NOT NULL DEFAULT '', t INTEGER NOT NULL, open INTEGER NOT NULL DEFAULT 1, PRIMARY KEY (msg, who)) WITHOUT ROWID",
  'CREATE INDEX IF NOT EXISTS reports_who ON reports (who, t)',
  'CREATE INDEX IF NOT EXISTS reports_open ON reports (msg) WHERE open = 1',
  // History reads handed out in the current window: key is "i:<address hash>" or "u:<uid>". Rows go an hour after their window.
  'CREATE TABLE IF NOT EXISTS quota (key TEXT PRIMARY KEY, t INTEGER NOT NULL, n INTEGER NOT NULL) WITHOUT ROWID'
];
const MSG_COLS = 'id, room, uid, text, reply, t, del, hidden, kept';
const OPS = { join: 'onJoin', more: 'onMore', who: 'onWho', say: 'onSay', del: 'onDel', name: 'onName', report: 'onReport', mkroom: 'onMkroom', edroom: 'onEdroom', rmroom: 'onRmroom', wipe: 'onWipe', mod: 'onMod' };
const official = (r) => r.kind === 'official';

/** All of the chat. Everything is synchronous: one frame is handled from start to finish before the next one.
    sql(query, ...params) → rows; tx(fn) runs fn in a transaction; sockets() → every connected socket (send, close,
    serializeAttachment, deserializeAttachment); env holds the CHAT_* settings; now() → ms.
    A socket's attachment is { u: uid | null, a: admin 0/1, r: room | null, i: hash of the address }. After a sleep a new Hub
    is made over the same storage and sockets, so nothing in memory is needed to carry on: it is all read again when asked for.
    Storage is not touched before something needs it (ready()): a frame from a socket that was refused or closed wakes the
    object, and must then cost nothing more. */
export class Hub {
  constructor({ sql, tx, sockets, env, now }) {
    this.raw = sql;
    this.up = false;
    this.sql = (query, ...params) => { this.ready(); return sql(query, ...params); };
    this.tx = tx;
    this.all = sockets;
    this.env = env || {};
    this.now = now || (() => Date.now());
    this.meta = new WeakMap();   // socket → its attachment, read once
    this.gone = new WeakSet();   // sockets that closed, or that were closed here; the platform may still list them for a moment
    this.frames = new WeakMap(); // socket → { t, n } frames in the current window
    this.heavy = new Map();      // address hash → { t, n } frames in the current window
    this.rate = new Map();       // uid → when they last posted (never written to storage)
    this.reads = new Map();      // "i:<address hash>" | "u:<uid>" → { t, n, left }: history reads, see readWait()
    this.wipes = new Map();      // uid → when they last wiped
    this.edits = new Map();      // room → when its owner last edited it
    this.users = new Map();      // uid → users row or null; every change goes through this object, so it stays true
    this.roomMap = null;         // id → rooms row
    this.recent = new Map();     // room → { rows, more }: its last PAGE messages
    this.pres = null;            // { total, rooms: id → online }
    this.swept = 0;
  }
  /** The tables and the official rooms, once per Hub, the first time storage is needed. */
  ready() {
    if (this.up) return;
    this.up = true;
    try {
      for (const q of SCHEMA) this.raw(q);
      this.seed();
    } catch (e) { this.up = false; throw e; }
  }

  /** Makes the official rooms what OFFICIAL says. Runs on every wake, so it only writes what differs. */
  seed() {
    const t = this.now();
    let changed = false;
    OFFICIAL.forEach(([id, title, titleEn, topic, topicEn], sort) => {
      const r = this.rooms().get(id);
      if (!r) {
        this.sql("INSERT INTO rooms (id, kind, title, title_en, topic, topic_en, tkey, owner, created, last, sort) VALUES (?, 'official', ?, ?, ?, ?, ?, NULL, ?, ?, ?)", id, title, titleEn, topic, topicEn, keyOf(title), t, t, sort);
      } else if (r.title !== title || r.title_en !== titleEn || r.topic !== topic || r.topic_en !== topicEn || r.sort !== sort) {
        this.sql('UPDATE rooms SET title = ?, title_en = ?, topic = ?, topic_en = ?, tkey = ?, sort = ? WHERE id = ?', title, titleEn, topic, topicEn, keyOf(title), sort, id);
      } else return;
      changed = true;
    });
    if (changed) this.roomMap = null;
  }

  // ── what is kept in memory, and how it is read back ───────────────────
  state() { return chatState(this.env); }
  perUser() { return num(this.env.CHAT_ROOMS_PER_USER, 3); }
  forget() { this.users.clear(); this.roomMap = null; this.recent.clear(); this.pres = null; this.reads.clear(); }

  att(ws) {
    let a = this.meta.get(ws);
    if (a === undefined) {
      try { a = ws.deserializeAttachment(); } catch { a = null; }
      if (!a || typeof a !== 'object' || a.x) a = null; // x: closed from here before a sleep, and the other side has not answered yet
      this.meta.set(ws, a);
    }
    return a;
  }
  save(ws, a) {
    this.meta.set(ws, a);
    try { ws.serializeAttachment(a); } catch { /* the socket is closing; close() follows */ }
  }
  /** Every socket that said hello and is still there, as [socket, attachment]. */
  live() {
    const out = [];
    for (const ws of this.all()) {
      if (this.gone.has(ws)) continue;
      const a = this.att(ws);
      if (a) out.push([ws, a]);
    }
    return out;
  }
  /** Online = signed-in accounts counted once, plus every guest socket. */
  presence() {
    if (this.pres) return this.pres;
    const everyone = new Set(), rooms = new Map();
    let guests = 0;
    for (const [, a] of this.live()) {
      if (a.u) everyone.add(a.u); else guests++;
      if (!a.r) continue;
      let r = rooms.get(a.r);
      if (!r) rooms.set(a.r, r = { users: new Set(), guests: 0 });
      if (a.u) r.users.add(a.u); else r.guests++;
    }
    this.pres = { total: everyone.size + guests, rooms: new Map([...rooms].map(([id, r]) => [id, r.users.size + r.guests])) };
    return this.pres;
  }
  online(room) { return this.presence().rooms.get(room) || 0; }

  rooms() {
    if (!this.roomMap) this.roomMap = new Map(this.sql('SELECT id, kind, title, title_en, topic, topic_en, tkey, owner, created, last, n, closed, sort FROM rooms').map((r) => [r.id, r]));
    return this.roomMap;
  }
  room(id) { return typeof id === 'string' && id.length <= 16 ? this.rooms().get(id) || null : null; }
  roomView(r) {
    return {
      id: r.id, kind: r.kind, title: r.title, title_en: r.title_en ?? null, topic: r.topic, topic_en: r.topic_en ?? null,
      owner: r.owner ?? null, owner_name: r.owner ? this.user(r.owner)?.name ?? null : null,
      n: r.n, last: r.last, online: this.online(r.id), closed: !!r.closed
    };
  }
  /** Official rooms in their order, then the users' rooms, the one spoken in last first. */
  roomList() {
    const list = [...this.rooms().values()].sort((a, b) => official(b) - official(a) || (official(a) ? a.sort - b.sort : b.last - a.last) || (a.id < b.id ? -1 : 1));
    this.loadUsers(list.map((r) => r.owner));
    return list.map((r) => this.roomView(r));
  }
  owned(uid) { return [...this.rooms().values()].filter((r) => r.owner === uid && !official(r)); }

  loadUsers(uids) {
    if (this.users.size > MAP_MAX) this.users.clear();
    const need = [...new Set(uids)].filter((u) => typeof u === 'string' && u && !this.users.has(u));
    for (let i = 0; i < need.length; i += IN_MAX) {
      const part = need.slice(i, i + IN_MAX);
      for (const u of part) this.users.set(u, null);
      for (const r of this.sql(`SELECT uid, name, key, named, role, muted, banned FROM users WHERE uid IN (${marks(part)})`, ...part)) this.users.set(r.uid, r);
    }
  }
  user(uid) {
    if (!this.users.has(uid)) this.loadUsers([uid]);
    return this.users.get(uid) || null;
  }
  me(a) {
    if (!a.u) return null;
    const u = this.user(a.u), t = this.now();
    return { uid: a.u, name: u?.name ?? null, role: a.a ? 'admin' : 'user', muted: u && u.muted > t ? u.muted : 0, banned: !!u?.banned, rooms: this.owned(a.u).filter((r) => !r.closed).length };
  }

  /** The last PAGE messages of a room (kept in memory for the rooms opened last), or the PAGE before an id. */
  page(room, before = 0) {
    if (!before && this.recent.has(room)) return this.recent.get(room);
    const rows = before
      ? this.sql(`SELECT ${MSG_COLS} FROM msgs WHERE room = ? AND id < ? ORDER BY id DESC LIMIT ?`, room, before, PAGE + 1)
      : this.sql(`SELECT ${MSG_COLS} FROM msgs WHERE room = ? ORDER BY id DESC LIMIT ?`, room, PAGE + 1);
    const out = { rows: rows.slice(0, PAGE).reverse(), more: rows.length > PAGE };
    if (!before) {
      if (this.recent.size >= CACHED_ROOMS) this.recent.delete(this.recent.keys().next().value);
      this.recent.set(room, out);
    }
    return out;
  }
  /** Stored rows → messages as the browser gets them. A deleted or hidden message goes out without its text, and so does a
      quote of one; `real` (the admin's list of reports) keeps the text of a hidden message. `known`: rows a reply may quote. */
  view(rows, { real = false, known = [] } = {}) {
    const at = new Map([...known, ...rows].map((r) => [r.id, r]));
    const missing = [...new Set(rows.map((r) => r.reply).filter((id) => id && !at.has(id)))];
    for (let i = 0; i < missing.length; i += IN_MAX) {
      const part = missing.slice(i, i + IN_MAX);
      for (const q of this.sql(`SELECT id, uid, text, del, hidden FROM msgs WHERE id IN (${marks(part)})`, ...part)) at.set(q.id, q);
    }
    this.loadUsers(rows.flatMap((r) => [r.uid, at.get(r.reply)?.uid]));
    return rows.map((r) => {
      const u = this.user(r.uid);
      const m = { id: r.id, room: r.room, uid: r.uid, name: u?.name ?? null, role: u?.role === 'admin' ? 'admin' : 'user', text: r.del || (r.hidden && !real) ? '' : r.text, t: r.t, reply: null };
      if (r.reply) {
        const q = at.get(r.reply); // a quoted message that was removed leaves only its id
        m.reply = q ? { id: q.id, name: this.user(q.uid)?.name ?? null, text: q.del || q.hidden ? '' : clip(q.text, 80) } : { id: r.reply, name: null, text: '' };
      }
      if (r.del) m.del = r.del;
      else if (r.hidden) m.hidden = true;
      return m;
    });
  }
  openReports() { return this.sql('SELECT COUNT(DISTINCT msg) AS n FROM reports WHERE open = 1')[0].n; }

  /** When this account last posted. After a sleep it is read back once from its last messages; when those are all from the
      last 24 hours the day's count is taken from its newest DAY_MAX messages (read-only: a count that is written down would
      cost a write per message). Messages that were removed since are not counted. */
  pace(uid) {
    let p = this.rate.get(uid);
    if (!p) {
      if (this.rate.size > MAP_MAX) this.rate.clear();
      const t = this.now();
      const rows = this.sql('SELECT t, text, del FROM msgs WHERE uid = ? ORDER BY id DESC LIMIT ?', uid, MINUTE_MAX);
      const today = rows.filter((r) => r.t > t - DAY_MS);
      p = { times: rows.map((r) => r.t).reverse(), text: rows[0] && !rows[0].del ? rows[0].text : null, day: today.length ? today[today.length - 1].t : t, n: today.length, room: 0 };
      if (today.length === MINUTE_MAX) { // there may be more today than these: newest DAY_MAX by id first, so old history is never scanned
        const d = this.sql('SELECT COUNT(*) AS n, MIN(t) AS t FROM (SELECT t FROM msgs WHERE uid = ? ORDER BY id DESC LIMIT ?) WHERE t > ?', uid, DAY_MAX, t - DAY_MS)[0];
        if (d.n > p.n) { p.n = d.n; p.day = d.t; }
      }
      this.rate.set(uid, p);
    }
    return p;
  }

  /** Takes one history read out of this socket's budget (per address for guests, per account otherwise, none for admins);
      → 0, or the seconds to wait when the window's budget is used up. A chunk of reads is written down before it is used,
      so a Hub made after a sleep carries on from what storage says (and what was left of the chunk is lost). */
  readWait(a) {
    if (a.a) return 0;
    const key = a.u ? 'u:' + a.u : 'i:' + a.i, max = a.u ? READS_USER : READS_GUEST, t = this.now();
    let b = this.reads.get(key);
    if (!b || t - b.t >= READ_WINDOW) {
      if (this.reads.size > MAP_MAX) this.reads.clear();
      const row = b ? null : this.sql('SELECT t, n FROM quota WHERE key = ?', key)[0];
      this.reads.set(key, b = row && t - row.t < READ_WINDOW ? { t: row.t, n: row.n, left: 0 } : { t, n: 0, left: 0 });
    }
    if (!b.left) {
      if (b.n >= max) return secs(b.t + READ_WINDOW - t);
      const take = Math.min(READ_CHUNK, max - b.n);
      try {
        this.sql('INSERT INTO quota (key, t, n) VALUES (?, ?, ?) ON CONFLICT (key) DO UPDATE SET t = excluded.t, n = excluded.n', key, b.t, b.n + take);
      } catch (e) { // storage takes no more writes today: reading must go on, the budget is then only as good as memory
        console.error('chat: read budget not saved', e);
      }
      b.n += take;
      b.left = take;
    }
    b.left--;
    return 0;
  }

  // ── sending ───────────────────────────────────────────────────────────
  send(ws, frame) {
    try { ws.send(typeof frame === 'string' ? frame : JSON.stringify(frame)); } catch { /* a dead socket must not stop the loop it is in */ }
  }
  toAll(frame, pick) {
    const s = JSON.stringify(frame);
    for (const [ws, a] of this.live()) if (!pick || pick(a, ws)) this.send(ws, s);
  }
  toRoom(room, frame, except) { this.toAll(frame, (a, ws) => a.r === room && ws !== except); }
  toMe(uid) { for (const [ws, a] of this.live()) if (a.u === uid) this.send(ws, { t: 'me', me: this.me(a) }); }
  sendRooms() { this.toAll({ t: 'rooms', rooms: this.roomList() }); }
  sendPresence(room, except) { this.toRoom(room, { t: 'pres', room, online: this.online(room) }, except); }
  sendReports() {
    const admins = this.live().filter(([, a]) => a.a);
    if (!admins.length) return;
    const s = JSON.stringify({ t: 'reports', open: this.openReports() });
    for (const [ws] of admins) this.send(ws, s);
  }
  reply(ws, t, re, m, extra) {
    const cid = m && typeof m.cid === 'string' && m.cid.length <= CID_MAX ? { cid: m.cid } : null;
    this.send(ws, { t, re, ...extra, ...cid });
  }
  ok(ws, re, m, extra) { this.reply(ws, 'ok', re, m, extra); }
  err(ws, re, code, m, extra) { this.reply(ws, 'err', re, m, { code, ...extra }); }
  /** Closes a socket from this side. The mark in the attachment is for a Hub made after a sleep, which has no `gone`. */
  drop(ws, code, reason) {
    const a = this.att(ws);
    if (a) { try { ws.serializeAttachment({ ...a, x: 1 }); } catch { /* already closed */ } }
    this.close(ws);
    try { ws.close(code, reason); } catch { /* already closed */ }
  }

  /** Why this socket may not write: [code, extra], or null. Admins are only asked for a nickname. */
  bar(a, needName = true) {
    if (!a.u) return ['signin'];
    const u = this.user(a.u);
    if (!a.a) {
      if (this.state() === 'readonly') return ['readonly'];
      if (u?.banned) return ['banned'];
      if (u && u.muted > this.now()) return ['muted', { until: u.muted }];
    }
    return needName && !u?.name ? ['name-needed'] : null;
  }
  /** Removes rooms nobody ever wrote in after a week. `force`: now (before a new room is made); else at most once an hour. */
  sweep(force) {
    const t = this.now();
    if (!force && t - this.swept < SWEEP_MS) return;
    this.swept = t;
    if (this.sql('SELECT 1 AS x FROM quota WHERE t < ? LIMIT 1', t - SWEEP_MS).length) this.sql('DELETE FROM quota WHERE t < ?', t - SWEEP_MS);
    const old = [...this.rooms().values()].filter((r) => !official(r) && !r.n && r.created < t - EMPTY_ROOM_MS);
    if (!old.length) return;
    this.tx(() => { for (const r of old) this.sql('DELETE FROM rooms WHERE id = ? AND n = 0', r.id); });
    this.roomsGone(old);
  }
  /** After rooms were removed: nobody is in them any more, and everyone gets the new list. */
  roomsGone(list) {
    const ids = new Set(list.map((r) => r.id));
    this.roomMap = null;
    for (const id of ids) this.recent.delete(id);
    for (const [ws, a] of this.live()) if (ids.has(a.r)) { a.r = null; this.save(ws, a); }
    this.pres = null;
    this.sendRooms();
    for (const uid of new Set(list.map((r) => r.owner).filter(Boolean))) this.toMe(uid);
  }
  titleTaken(key, except) {
    return [...this.rooms().values()].some((r) => r.id !== except && (r.tkey === key || (r.title_en && keyOf(r.title_en) === key)));
  }
  /** Removes every message of an account (`how`: 1 by the author, 2 by an admin) and the reports on them. Browsers that
      show one of its last 200 messages are told it is deleted; the rest is simply not there the next time a room is read. */
  removeAll(uid, how) {
    const rows = this.sql('SELECT id, room, t FROM msgs WHERE uid = ? ORDER BY id DESC LIMIT 200', uid);
    if (!rows.length) return;
    let reports = 0;
    this.tx(() => {
      reports = this.sql('DELETE FROM reports WHERE msg IN (SELECT id FROM msgs WHERE uid = ?) RETURNING msg', uid).length;
      this.sql('DELETE FROM msgs WHERE uid = ?', uid);
    });
    this.recent.clear();
    const name = this.user(uid)?.name ?? null, busy = this.presence().rooms;
    for (const r of rows) if (busy.has(r.room)) this.toRoom(r.room, { t: 'upd', m: { id: r.id, room: r.room, uid, name, role: 'user', text: '', t: r.t, reply: null, del: how } });
    if (reports) this.sendReports();
  }
  /** Blanks one message (the row stays as a tombstone) and drops the reports on it. */
  remove(row, how) {
    let reports = 0;
    this.tx(() => {
      this.sql("UPDATE msgs SET text = '', del = ?, hidden = 0 WHERE id = ?", how, row.id);
      reports = this.sql('DELETE FROM reports WHERE msg = ? RETURNING msg', row.id).length;
    });
    this.recent.delete(row.room);
    this.toRoom(row.room, { t: 'upd', m: this.view([{ ...row, text: '', del: how, hidden: 0 }])[0] });
    if (reports) this.sendReports();
  }

  // ── a socket connects, speaks, leaves ─────────────────────────────────
  /** `who` is what the Worker found out: { uid | null, admin, auth: 'ok' | 'none' | 'expired', iph }. */
  connect(ws, who) {
    const w = who && typeof who === 'object' ? who : {};
    const uid = typeof w.uid === 'string' && /^[a-z0-9]{6,32}$/.test(w.uid) ? w.uid : null;
    const a = { u: uid, a: uid && w.admin === true ? 1 : 0, r: null, i: typeof w.iph === 'string' ? w.iph.slice(0, 32) : '' };
    const refuse = (code, close) => { // no attachment: after a sleep too, att() makes it nobody without asking storage
      this.meta.set(ws, null);
      this.gone.add(ws);
      this.send(ws, { t: 'err', re: 'connect', code });
      try { ws.close(close, code); } catch { /* already closed */ }
    };
    if (this.state() === 'off') return refuse('off', 4003);
    const others = this.live().filter(([x]) => x !== ws);
    // An admin always gets in: a full house is when they are needed. Guests stop earlier, so that accounts still find room.
    const max = num(this.env.CHAT_MAX_SOCKETS, 2000), room = uid ? max : Math.ceil(max * GUEST_SHARE);
    if (!a.a && (others.length >= room || (a.i && others.filter(([, b]) => b.i === a.i).length >= PER_IPH))) return refuse('full', 4001);
    this.sweep(false);
    this.save(ws, a);
    this.pres = null;
    if (uid) { // the Worker's word on who is an admin is the only one; the stored role is what old messages show
      const u = this.user(uid), role = a.a ? 'admin' : 'user';
      if (u && u.role !== role) { this.sql('UPDATE users SET role = ? WHERE uid = ?', role, uid); u.role = role; }
    }
    this.send(ws, {
      t: 'hello', v: 1, state: this.state(), auth: uid ? 'ok' : w.auth === 'expired' ? 'expired' : 'none', me: this.me(a),
      rooms: this.roomList(), online: this.presence().total, ...(a.a ? { reports: this.openReports() } : {}),
      limits: { text: TEXT_MAX, name: [NAME_MIN, NAME_MAX], title: [TITLE_MIN, TITLE_MAX], topic: TOPIC_MAX, rooms: this.perUser() }, now: this.now()
    });
  }

  message(ws, data) {
    // A socket that was refused or closed from here may keep sending (see the header): nothing is read, nothing is answered.
    if (this.gone.has(ws)) return;
    const a = this.att(ws);
    if (!a) return;
    if (tooBig(data, FRAME_MAX)) return this.drop(ws, 1009, 'frame too large');
    const t = this.now();
    let f = this.frames.get(ws);
    if (!f || t - f.t >= FRAME_WINDOW) this.frames.set(ws, f = { t, n: 0 });
    let g = null;
    if (a.i && !a.a) {
      g = this.heavy.get(a.i);
      if (!g || t - g.t >= IPH_WINDOW) {
        if (this.heavy.size > MAP_MAX) this.heavy.clear();
        this.heavy.set(a.i, g = { t, n: 0 });
      }
    }
    if (++f.n > FRAME_BURST || (g && ++g.n > IPH_FRAMES)) {
      this.send(ws, { t: 'err', re: 'connect', code: 'flood' });
      return this.drop(ws, 4002, 'too many frames');
    }
    if (data === 'ping') return this.send(ws, 'pong'); // where the platform does not answer it itself
    if (this.state() === 'off') { // switched off while people were connected
      this.send(ws, { t: 'err', re: 'connect', code: 'off' });
      return this.drop(ws, 4003, 'off');
    }
    let m = null;
    if (typeof data === 'string') { try { m = JSON.parse(data); } catch { m = null; } }
    if (!m || typeof m !== 'object' || Array.isArray(m) || typeof m.t !== 'string') return this.err(ws, '', 'bad');
    if (!Object.hasOwn(OPS, m.t)) return this.err(ws, m.t.slice(0, 20), 'bad');
    try {
      this[OPS[m.t]](ws, a, m);
    } catch (e) { // storage refused (the plan's daily limit, a full disk): say so, and trust nothing that was in memory
      console.error(`chat: ${m.t} failed`, e);
      this.forget();
      this.err(ws, m.t, 'server', m);
    }
  }

  close(ws) {
    if (this.gone.has(ws)) return;
    const a = this.att(ws);
    this.gone.add(ws);
    if (!a) return;
    this.pres = null;
    if (a.r) this.sendPresence(a.r);
  }

  // ── reading (guests too) ──────────────────────────────────────────────
  onJoin(ws, a, m) {
    const room = this.room(m.room);
    if (!room) return this.err(ws, 'join', 'no-room', m);
    if (!this.recent.has(room.id)) { // a page from storage; one that is in memory is free
      const wait = this.readWait(a);
      if (wait) return this.err(ws, 'join', 'slow', m, { wait });
    }
    const from = a.r;
    if (from !== room.id) { a.r = room.id; this.save(ws, a); this.pres = null; }
    const { rows, more } = this.page(room.id);
    this.send(ws, { t: 'room', room: room.id, msgs: this.view(rows), more, online: this.online(room.id) });
    if (from === room.id) return;
    if (from) this.sendPresence(from);
    this.sendPresence(room.id, ws);
  }
  onMore(ws, a, m) {
    const room = this.room(m.room), before = int(m.before);
    if (!room) return this.err(ws, 'more', 'no-room', m);
    if (!before) return this.err(ws, 'more', 'bad', m);
    const wait = this.readWait(a);
    if (wait) return this.err(ws, 'more', 'slow', m, { wait });
    const { rows, more } = this.page(room.id, before);
    this.send(ws, { t: 'older', room: room.id, msgs: this.view(rows), more });
  }
  onWho(ws, a, m) {
    const room = this.room(m.room);
    if (!room) return this.err(ws, 'who', 'no-room', m);
    const admins = new Map();
    let guests = 0;
    for (const [, b] of this.live()) {
      if (b.r !== room.id) continue;
      if (b.u) admins.set(b.u, admins.get(b.u) || b.a); else guests++;
    }
    this.loadUsers([...admins.keys()]);
    const users = [];
    for (const [uid, admin] of admins) {
      const name = this.user(uid)?.name;
      if (name) users.push({ uid, name, role: admin ? 'admin' : 'user' }); else guests++; // no nickname yet: not listed
    }
    users.sort((x, y) => (y.role === 'admin') - (x.role === 'admin') || (x.name < y.name ? -1 : 1));
    this.send(ws, { t: 'who', room: room.id, users: users.slice(0, 200), guests: guests + Math.max(0, users.length - 200) });
  }

  // ── writing ───────────────────────────────────────────────────────────
  onSay(ws, a, m) {
    if (m.cid !== undefined && (typeof m.cid !== 'string' || m.cid.length > CID_MAX)) return this.err(ws, 'say', 'bad');
    const no = this.bar(a);
    if (no) return this.err(ws, 'say', no[0], m, no[1]);
    const room = this.room(m.room);
    if (!room) return this.err(ws, 'say', 'no-room', m);
    if (room.closed && !a.a) return this.err(ws, 'say', 'closed', m);
    const c = cleanText(m.text);
    if (c.code) return this.err(ws, 'say', c.code, m);
    if (!a.a && blockedWord(c.text, this.env)) return this.err(ws, 'say', 'word', m);
    let quoted = null;
    if (m.reply !== undefined && m.reply !== null) {
      quoted = int(m.reply) ? this.sql('SELECT id, room, uid, text, del, hidden FROM msgs WHERE id = ?', m.reply)[0] : null;
      if (!quoted || quoted.room !== room.id) return this.err(ws, 'say', 'no-msg', m);
    }
    const t = this.now(), p = this.pace(a.u), last = p.times.length ? p.times[p.times.length - 1] : -Infinity;
    if (t - last < SLOW_MS) return this.err(ws, 'say', 'slow', m, { wait: secs(last + SLOW_MS - t) });
    const minute = p.times.filter((x) => x > t - 60_000);
    if (minute.length >= MINUTE_MAX) return this.err(ws, 'say', 'flood', m, { wait: secs(minute[minute.length - MINUTE_MAX] + 60_000 - t) });
    if (t - p.day >= DAY_MS) { p.day = t; p.n = 0; }
    if (p.n >= DAY_MAX) return this.err(ws, 'say', 'flood', m, { wait: secs(p.day + DAY_MS - t) });
    if (p.text === c.text && t - last < DUP_MS) return this.err(ws, 'say', 'dup', m);

    let id = 0;
    this.tx(() => {
      id = this.sql('INSERT INTO msgs (room, uid, text, reply, t) VALUES (?, ?, ?, ?, ?) RETURNING id', room.id, a.u, c.text, quoted ? quoted.id : null, t)[0].id;
      this.sql('UPDATE rooms SET last = ?, n = n + 1 WHERE id = ?', t, room.id);
    });
    p.times.push(t);
    if (p.times.length > MINUTE_MAX) p.times.shift();
    p.n++;
    p.text = c.text;
    room.last = t;
    room.n++;
    const row = { id, room: room.id, uid: a.u, text: c.text, reply: quoted ? quoted.id : null, t, del: 0, hidden: 0, kept: 0 };
    const kept = this.recent.get(room.id);
    if (kept) {
      kept.rows.push(row);
      if (kept.rows.length > PAGE) { kept.rows.shift(); kept.more = true; }
    }
    const msg = this.view([row], { known: quoted ? [quoted] : [] })[0];
    const there = JSON.stringify({ t: 'msg', m: msg }), elsewhere = JSON.stringify({ t: 'act', room: room.id, last: t, n: room.n });
    for (const [x, b] of this.live()) if (x !== ws) this.send(x, b.r === room.id ? there : elsewhere);
    this.send(ws, typeof m.cid === 'string' ? { t: 'msg', m: msg, cid: m.cid } : there);
  }

  onDel(ws, a, m) {
    if (!a.u) return this.err(ws, 'del', 'signin', m);
    const id = int(m.id);
    if (!id) return this.err(ws, 'del', 'bad', m);
    const row = this.sql(`SELECT ${MSG_COLS} FROM msgs WHERE id = ?`, id)[0];
    if (!row) return this.err(ws, 'del', 'no-msg', m);
    if (row.uid !== a.u && !a.a) return this.err(ws, 'del', 'forbidden', m);
    if (!row.del) this.remove(row, row.uid === a.u ? 1 : 2);
    this.ok(ws, 'del', m, { id });
  }

  onName(ws, a, m) {
    const no = this.bar(a, false);
    if (no) return this.err(ws, 'name', no[0], m, no[1]);
    const name = cleanName(m.name);
    if (!name) return this.err(ws, 'name', 'name-bad', m);
    const key = keyOf(name);
    if (!a.a && (reservedName(key) || blockedWord(name, this.env))) return this.err(ws, 'name', 'name-bad', m);
    const u = this.user(a.u), t = this.now();
    if (u?.name === name) return this.ok(ws, 'name', m);
    // Not "u.name &&": after a wipe there is no name, and the day since the last change still counts.
    if (u?.named && t - u.named < RENAME_MS) return this.err(ws, 'name', 'name-wait', m, { wait: secs(u.named + RENAME_MS - t) });
    const holder = this.sql('SELECT uid FROM users WHERE key = ?', key)[0];
    if (holder && holder.uid !== a.u) return this.err(ws, 'name', 'name-taken', m);
    const role = a.a ? 'admin' : 'user';
    if (u) this.sql('UPDATE users SET name = ?, key = ?, named = ?, role = ? WHERE uid = ?', name, key, t, role, a.u);
    else this.sql('INSERT INTO users (uid, name, key, named, role, first) VALUES (?, ?, ?, ?, ?, ?)', a.u, name, key, t, role, t);
    this.users.set(a.u, { uid: a.u, muted: 0, banned: 0, ...u, name, key, named: t, role });
    this.toMe(a.u);
    if (this.owned(a.u).length) this.sendRooms(); // the rooms show their owner's name
    this.ok(ws, 'name', m);
  }

  onReport(ws, a, m) {
    const no = this.bar(a);
    if (no) return this.err(ws, 'report', no[0], m, no[1]);
    const id = int(m.id);
    if (!id || (m.reason !== undefined && m.reason !== null && typeof m.reason !== 'string')) return this.err(ws, 'report', 'bad', m);
    const row = this.sql(`SELECT ${MSG_COLS} FROM msgs WHERE id = ?`, id)[0];
    if (!row || row.del) return this.err(ws, 'report', 'no-msg', m);
    if (row.uid === a.u) return this.err(ws, 'report', 'self', m);
    // Already looked at by an admin, or already reported by this account: thanked, and nothing more is stored.
    if (row.kept || this.sql('SELECT 1 AS x FROM reports WHERE msg = ? AND who = ?', id, a.u).length) return this.ok(ws, 'report', m, { id });
    const t = this.now();
    if (this.sql('SELECT COUNT(*) AS n FROM (SELECT 1 FROM reports WHERE who = ? AND t > ? LIMIT ?)', a.u, t - DAY_MS, REPORTS_DAY)[0].n >= REPORTS_DAY) return this.err(ws, 'report', 'reports-max', m);
    const reason = clip(tidy(m.reason || ''), REASON_MAX);
    let n = 0, hide = false;
    this.tx(() => {
      this.sql('INSERT INTO reports (msg, who, reason, t) VALUES (?, ?, ?, ?)', id, a.u, reason, t);
      n = this.sql('SELECT COUNT(*) AS n FROM reports WHERE msg = ? AND open = 1', id)[0].n;
      // Three accounts hide a message until an admin has looked; not an admin's own, or three accounts could silence the site.
      hide = n >= HIDE_AT && !row.hidden && this.user(row.uid)?.role !== 'admin';
      if (hide) this.sql('UPDATE msgs SET hidden = 1 WHERE id = ?', id);
    });
    if (hide) {
      this.recent.delete(row.room);
      this.toRoom(row.room, { t: 'upd', m: this.view([{ ...row, hidden: 1 }])[0] });
    }
    if (n === 1) this.sendReports();
    this.ok(ws, 'report', m, { id });
  }

  onMkroom(ws, a, m) {
    const no = this.bar(a);
    if (no) return this.err(ws, 'mkroom', no[0], m, no[1]);
    const title = cleanLine(m.title, TITLE_MAX);
    if (!title.text || count(title.text) < TITLE_MIN || invisible(title.text) || (!a.a && blockedWord(title.text, this.env))) return this.err(ws, 'mkroom', 'title-bad', m);
    let topic = '';
    if (m.topic !== undefined && m.topic !== null && m.topic !== '') {
      const c = cleanLine(m.topic, TOPIC_MAX);
      if (c.code === 'bad' || c.code === 'long') return this.err(ws, 'mkroom', c.code, m);
      topic = c.text || '';
      if (!a.a && blockedWord(topic, this.env)) return this.err(ws, 'mkroom', 'word', m);
    }
    this.sweep(true);
    const key = keyOf(title.text), t = this.now(), mine = this.owned(a.u), p = this.pace(a.u);
    if (this.titleTaken(key)) return this.err(ws, 'mkroom', 'title-taken', m);
    if (!a.a) {
      // Closed rooms count too, up to a point: closing one and making another would otherwise fill the site's list from one account.
      if (mine.filter((r) => !r.closed).length >= this.perUser() || mine.length >= OWNED_FACTOR * this.perUser()) return this.err(ws, 'mkroom', 'rooms-max', m);
      if ([...this.rooms().values()].filter((r) => !official(r)).length >= num(this.env.CHAT_USER_ROOMS, 100)) return this.err(ws, 'mkroom', 'rooms-full', m);
      const last = Math.max(p.room, ...mine.map((r) => r.created));
      if (t - last < ROOM_WAIT_MS) return this.err(ws, 'mkroom', 'room-wait', m, { wait: secs(last + ROOM_WAIT_MS - t) });
    }
    let id = '';
    // An id that a removed room once had would be harmless (its messages went with it), but there is no need to reuse one.
    do id = 'u' + randomId(8); while (this.rooms().has(id) || this.sql('SELECT 1 AS x FROM msgs WHERE room = ? LIMIT 1', id).length);
    this.sql("INSERT INTO rooms (id, kind, title, topic, tkey, owner, created, last) VALUES (?, 'user', ?, ?, ?, ?, ?, ?)", id, title.text, topic, key, a.u, t, t);
    p.room = t;
    this.roomMap = null;
    this.sendRooms();
    this.toMe(a.u);
    this.ok(ws, 'mkroom', m, { room: id });
  }

  onEdroom(ws, a, m) {
    const no = this.bar(a);
    if (no) return this.err(ws, 'edroom', no[0], m, no[1]);
    const room = this.room(m.room);
    if (!room) return this.err(ws, 'edroom', 'no-room', m);
    if (!a.a && (official(room) || room.owner !== a.u)) return this.err(ws, 'edroom', 'forbidden', m);
    const has = (k) => m[k] !== undefined && m[k] !== null;
    if (!has('title') && !has('topic') && !has('closed')) return this.err(ws, 'edroom', 'bad', m);
    if (has('closed') && typeof m.closed !== 'boolean') return this.err(ws, 'edroom', 'bad', m);
    // The official rooms' names are OFFICIAL above (seed() would put them back): an admin opens and closes them, nothing else.
    if (official(room) && (has('title') || has('topic'))) return this.err(ws, 'edroom', 'forbidden', m);
    let { title, topic, tkey } = room;
    if (has('title')) {
      const c = cleanLine(m.title, TITLE_MAX);
      if (!c.text || count(c.text) < TITLE_MIN || invisible(c.text) || (!a.a && blockedWord(c.text, this.env))) return this.err(ws, 'edroom', 'title-bad', m);
      title = c.text;
      tkey = keyOf(title);
      if (this.titleTaken(tkey, room.id)) return this.err(ws, 'edroom', 'title-taken', m);
    }
    if (has('topic')) {
      const c = m.topic === '' ? { text: '' } : cleanLine(m.topic, TOPIC_MAX);
      if (c.code === 'bad' || c.code === 'long') return this.err(ws, 'edroom', c.code, m);
      topic = c.text || '';
      if (!a.a && blockedWord(topic, this.env)) return this.err(ws, 'edroom', 'word', m);
    }
    // closed: 0 open, 1 closed by its owner, 2 closed by an admin (which its owner cannot undo).
    const closed = !has('closed') ? room.closed : !m.closed ? 0 : a.a ? 2 : room.closed || 1;
    if (!a.a && room.closed === 2 && !closed) return this.err(ws, 'edroom', 'forbidden', m);
    // Opening a room again counts like making one.
    if (!a.a && room.closed && !closed && this.owned(a.u).filter((r) => !r.closed).length >= this.perUser()) return this.err(ws, 'edroom', 'rooms-max', m);
    if (title === room.title && topic === room.topic && closed === room.closed) return this.ok(ws, 'edroom', m, { room: room.id }); // nothing to write, nobody to tell
    const t = this.now();
    if (!a.a) { // every edit is a row written and the whole list sent to every socket
      const last = this.edits.get(room.id) ?? -Infinity;
      if (t - last < EDIT_MS) return this.err(ws, 'edroom', 'slow', m, { wait: secs(last + EDIT_MS - t) });
    }
    this.sql('UPDATE rooms SET title = ?, tkey = ?, topic = ?, closed = ? WHERE id = ?', title, tkey, topic, closed, room.id);
    if (!a.a) {
      if (this.edits.size > MAP_MAX) this.edits.clear();
      this.edits.set(room.id, t);
    }
    const flipped = !closed !== !room.closed;
    Object.assign(room, { title, tkey, topic, closed });
    this.sendRooms();
    if (flipped && room.owner) this.toMe(room.owner);
    this.ok(ws, 'edroom', m, { room: room.id });
  }

  onRmroom(ws, a, m) {
    if (!a.a) return this.err(ws, 'rmroom', 'forbidden', m);
    const room = this.room(m.room);
    if (!room) return this.err(ws, 'rmroom', 'no-room', m);
    if (official(room)) return this.err(ws, 'rmroom', 'forbidden', m);
    let reports = 0;
    this.tx(() => {
      reports = this.sql('DELETE FROM reports WHERE msg IN (SELECT id FROM msgs WHERE room = ?) RETURNING msg', room.id).length;
      this.sql('DELETE FROM msgs WHERE room = ?', room.id);
      this.sql('DELETE FROM rooms WHERE id = ?', room.id);
    });
    this.roomsGone([room]);
    if (reports) this.sendReports();
    this.ok(ws, 'rmroom', m, { room: room.id });
  }

  /** Everything this account wrote (the reasons it gave when reporting too), and its nickname. Its rooms stay (without an
      owner's name), and so do a mute, a ban, and the day to wait since its last change of name. Nothing to remove: nothing written. */
  onWipe(ws, a, m) {
    if (!a.u) return this.err(ws, 'wipe', 'signin', m);
    const t = this.now(), last = this.wipes.get(a.u) ?? -Infinity;
    if (t - last < WIPE_MS) return this.err(ws, 'wipe', 'slow', m, { wait: secs(last + WIPE_MS - t) });
    const u = this.user(a.u), named = !!u?.name;
    if (u && (u.name || u.key)) {
      this.sql('UPDATE users SET name = NULL, key = NULL WHERE uid = ?', a.u);
      Object.assign(u, { name: null, key: null });
    }
    this.removeAll(a.u, 1);
    // Its reports stay (they count towards hiding a message and towards its own daily number); what it wrote in them goes.
    if (this.sql("SELECT 1 AS x FROM reports WHERE who = ? AND reason <> '' LIMIT 1", a.u).length) this.sql("UPDATE reports SET reason = '' WHERE who = ? AND reason <> ''", a.u);
    if (this.wipes.size > MAP_MAX) this.wipes.clear();
    this.wipes.set(a.u, t);
    const p = this.rate.get(a.u);
    if (p) p.text = null;
    this.toMe(a.u);
    if (named && this.owned(a.u).length) this.sendRooms();
    this.ok(ws, 'wipe', m);
  }

  // ── the admin's desk ──────────────────────────────────────────────────
  onMod(ws, a, m) {
    if (!a.a) return this.err(ws, 'mod', 'forbidden', m);
    const t = this.now(), bad = () => this.err(ws, 'mod', 'bad', m), done = () => this.ok(ws, 'mod', m, { op: m.op });
    if (m.op === 'list') {
      const groups = this.sql('SELECT msg, COUNT(*) AS n, MAX(t) AS t FROM reports WHERE open = 1 GROUP BY msg ORDER BY MAX(t) DESC LIMIT 100');
      const ids = groups.map((g) => g.msg), rows = new Map(), reasons = new Map();
      for (let i = 0; i < ids.length; i += IN_MAX) {
        const part = ids.slice(i, i + IN_MAX);
        for (const r of this.sql(`SELECT ${MSG_COLS} FROM msgs WHERE id IN (${marks(part)})`, ...part)) rows.set(r.id, r);
        for (const r of this.sql(`SELECT msg, reason FROM reports WHERE open = 1 AND reason <> '' AND msg IN (${marks(part)}) ORDER BY t`, ...part)) reasons.set(r.msg, [...(reasons.get(r.msg) || []), r.reason]);
      }
      const reports = groups.filter((g) => rows.has(g.msg)).map((g) => {
        const row = rows.get(g.msg);
        return { id: g.msg, m: this.view([row], { real: true })[0], title: this.rooms().get(row.room)?.title ?? '', n: g.n, reasons: (reasons.get(g.msg) || []).slice(0, 20), t: g.t };
      });
      // Written so that the partial index users_held answers it; a mute that has run out is left out here.
      const users = this.sql('SELECT uid, name, muted, banned FROM users WHERE (banned = 1 OR muted > 0) LIMIT 500')
        .filter((u) => u.banned || u.muted > t).map((u) => ({ uid: u.uid, name: u.name ?? null, muted: u.muted > t ? u.muted : 0, banned: !!u.banned }));
      return this.send(ws, { t: 'mod', reports, users });
    }
    if (m.op === 'mute' || m.op === 'ban' || m.op === 'purge') {
      const u = typeof m.uid === 'string' && m.uid.length <= 32 ? this.user(m.uid) : null;
      if (!u) return bad();
      if (m.op === 'purge') { this.removeAll(u.uid, 2); return done(); }
      if (u.role === 'admin') return this.err(ws, 'mod', 'forbidden', m); // an admin is not locked out, by themself or by another
      if (m.op === 'mute') {
        if (typeof m.hours !== 'number' || !(m.hours >= 0 && m.hours <= 24 * 365)) return bad();
        u.muted = m.hours ? Math.round(t + m.hours * 3_600_000) : 0;
        this.sql('UPDATE users SET muted = ? WHERE uid = ?', u.muted, u.uid);
      } else {
        if (typeof m.on !== 'boolean') return bad();
        u.banned = Number(m.on);
        this.sql('UPDATE users SET banned = ? WHERE uid = ?', u.banned, u.uid);
      }
      this.toMe(u.uid); // a browser that is connected learns it now; the next write would be refused anyway
      return done();
    }
    if (m.op === 'resolve') {
      const id = int(m.id);
      if (!id || (m.action !== 'keep' && m.action !== 'delete')) return bad();
      const row = this.sql(`SELECT ${MSG_COLS} FROM msgs WHERE id = ?`, id)[0];
      if (!row) return this.err(ws, 'mod', 'no-msg', m);
      if (m.action === 'delete') {
        if (!row.del) this.remove(row, 2);
      } else { // it stays, shown again, and no later report can hide it
        this.tx(() => {
          this.sql('UPDATE msgs SET hidden = 0, kept = 1 WHERE id = ?', id);
          this.sql('UPDATE reports SET open = 0 WHERE msg = ? AND open = 1', id);
        });
        this.recent.delete(row.room);
        if (row.hidden) this.toRoom(row.room, { t: 'upd', m: this.view([{ ...row, hidden: 0 }])[0] });
        this.sendReports();
      }
      return done();
    }
    return bad();
  }

  // ── asked over HTTP by the Worker ─────────────────────────────────────
  /** For the home page: how many are here, the busiest rooms, the last few messages. Nothing deleted, hidden or from a closed room. */
  summary() {
    const open = [...this.rooms().values()].filter((r) => !r.closed);
    const top = open.sort((a, b) => official(b) - official(a) || (official(a) ? a.sort - b.sort : this.online(b.id) - this.online(a.id) || b.last - a.last)).slice(0, 6);
    this.loadUsers(top.map((r) => r.owner));
    // Only the newest 400 ids are looked at, so a long run of deleted messages cannot turn this into a scan of everything.
    const newest = this.sql('SELECT MAX(id) AS id FROM msgs')[0].id || 0;
    const rows = newest ? this.sql('SELECT id, room, uid, text, t FROM msgs WHERE id > ? AND del = 0 AND hidden = 0 ORDER BY id DESC LIMIT 24', newest - 400) : [];
    const shown = rows.filter((r) => this.rooms().get(r.room) && !this.rooms().get(r.room).closed).slice(0, 6);
    this.loadUsers(shown.map((r) => r.uid));
    return {
      state: this.state(), online: this.presence().total, rooms: open.length, top: top.map((r) => this.roomView(r)),
      latest: shown.map((r) => {
        const room = this.rooms().get(r.room);
        return { room: r.room, title: room.title, title_en: room.title_en ?? null, name: this.user(r.uid)?.name ?? null, text: clip(r.text, 140), t: r.t };
      })
    };
  }
  /** For the report mail: how many reported messages wait for an admin. */
  pending() { return { reports: this.openReports() }; }
}

// ── the Durable Object ──────────────────────────────────────────────────
/** A plain class (nothing imported from the platform): storage and sockets come in through `ctx`. With the Hibernation API
    the object is put to sleep between frames and this constructor runs again on the next one. */
export class ChatHub {
  constructor(ctx, env) {
    this.ctx = ctx;
    this.hub = new Hub({
      sql: (query, ...params) => ctx.storage.sql.exec(query, ...params).toArray(),
      tx: (fn) => ctx.storage.transactionSync(fn),
      sockets: () => ctx.getWebSockets(),
      env
    });
    // "ping" is answered by the platform without waking this object.
    try { ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair('ping', 'pong')); } catch (e) { console.error('chat: no auto response', e); }
  }
  async fetch(request) {
    const path = new URL(request.url).pathname;
    if (path === '/summary') return Response.json(this.hub.summary());
    if (path === '/pending') return Response.json(this.hub.pending());
    if (path !== '/ws') return new Response('not found', { status: 404 });
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') return new Response('expected a WebSocket', { status: 426 });
    let who = null;
    try { who = JSON.parse(request.headers.get('X-Chat-Who') || 'null'); } catch { who = null; }
    const pair = new WebSocketPair();
    this.ctx.acceptWebSocket(pair[1]);
    this.hub.connect(pair[1], who);
    // The browser drops the connection if it offered a protocol and none comes back (or the other way round).
    const offered = (request.headers.get('Sec-WebSocket-Protocol') || '').split(',').some((p) => p.trim() === PROTO);
    return new Response(null, { status: 101, webSocket: pair[0], headers: offered ? { 'Sec-WebSocket-Protocol': PROTO } : {} });
  }
  webSocketMessage(ws, data) { this.hub.message(ws, data); }
  webSocketClose(ws, code, reason) {
    this.hub.close(ws);
    // Answered by the platform itself from compatibility date 2026-04-07 on; before that the handshake is finished here.
    try { ws.close(code, reason); } catch { /* already closed, or a code that cannot be sent back */ }
  }
  webSocketError(ws) { this.hub.close(ws); }
}

// ── the Worker's side ───────────────────────────────────────────────────
// The address hash is keyed with the secret UMA_SERVER_SECRET. Where that is not set, a key made up in this isolate stands
// in for it (made on first use: random values cannot be had at module level): the hash can then not be computed, or turned
// back into an address, by anyone outside, and the limits by address hold for as long as the isolate lives.
let isolateKey = '';
const FORWARD = ['Upgrade', 'Connection', 'Sec-WebSocket-Key', 'Sec-WebSocket-Version', 'Sec-WebSocket-Extensions'];
const TOKEN = /^[A-Za-z0-9_-]{20,128}$/;
const hubOf = (env) => env.CHAT.get(env.CHAT.idFromName('hub'));
const chatOn = (env) => typeof env.CHAT?.idFromName === 'function' && chatState(env) !== 'off';

/** The random id an account is known by in the rooms; made the first time it connects. */
async function uidFor(env, email, t) {
  for (let i = 0; i < 3; i++) { // OR IGNORE also covers the (unlikely) uid that is already someone's: then another one is tried
    await env.DB.prepare('INSERT OR IGNORE INTO chat_users (email, uid, created) VALUES (?1, ?2, ?3)').bind(email, randomId(12), t).run();
    const row = await env.DB.prepare('SELECT uid FROM chat_users WHERE email = ?1').bind(email).first();
    if (row) return row.uid;
  }
  throw new Error('chat_users: could not make a uid');
}

/** /chat/*. `h` are the account worker's helpers { fail, json, sha256, now, allow, visitorId }; this file imports nothing from it. */
export async function chatRoute(request, env, cors, path, url, ip, h) {
  if (request.method === 'GET' && path === '/chat/summary') {
    // The home page asks this on every visit: the answer is kept at Cloudflare's edge for a while, and in the browser.
    const out = (body, cache) => new Response(body, { headers: { ...cors, 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': cache } });
    const fresh = `public, max-age=${SUMMARY_TTL}`;
    if (!chatOn(env)) return out('{"state":"off"}', fresh);
    try {
      const cache = globalThis.caches?.default; // absent in Deno and in the tests
      const key = new Request(`${url.origin}/chat/summary`);
      const hit = cache && await cache.match(key);
      if (hit) return out(await hit.text(), fresh);
      const res = await hubOf(env).fetch(new Request('https://chat/summary'));
      if (!res.ok) throw new Error(`chat summary: HTTP ${res.status}`);
      const body = await res.text();
      if (cache) await cache.put(key, new Response(body, { headers: { 'Content-Type': 'application/json', 'Cache-Control': fresh } }));
      return out(body, fresh);
    } catch (e) { // the card on the home page hides itself rather than show an error
      console.error(e);
      return out('{"state":"off"}', 'no-store');
    }
  }

  if (request.method === 'GET' && path === '/chat/ws') {
    if ((request.headers.get('Upgrade') || '').toLowerCase() !== 'websocket') throw h.fail(426, '这个地址只接受 WebSocket 连接');
    if (!chatOn(env)) return h.json({ error: { message: '讨论室暂时关闭', code: 'off' } }, cors, 503);
    // The rooms count sockets per address by this hash, never by the address.
    const iph = await h.visitorId(env.UMA_SERVER_SECRET ? env : { UMA_SERVER_SECRET: isolateKey ||= randomId(32) }, 'chat|' + addrKey(ip));
    // The counter is in D1. When D1 fails, reading along must still work (a guest needs nothing else from it): let them in.
    const allowed = await h.allow(env, 'chat-ws:' + iph, 120, 600).catch((e) => { console.error('chat: connection counter failed', e); return true; });
    if (!allowed) throw h.fail(429, '连接太频繁，请稍后再试');
    // A browser cannot set Authorization on a WebSocket, so the session token comes as a second subprotocol, "t.<token>".
    const offered = (request.headers.get('Sec-WebSocket-Protocol') || '').split(',').map((p) => p.trim());
    const token = offered.find((p) => p.startsWith('t.'))?.slice(2) || '';
    const who = { uid: null, admin: false, auth: token ? 'expired' : 'none', iph };
    if (TOKEN.test(token)) {
      const t = h.now();
      const row = await env.DB.prepare(
        "SELECT s.email AS email, c.uid AS uid, g.source AS source FROM sessions s LEFT JOIN chat_users c ON c.email = s.email LEFT JOIN grants g ON g.email = s.email AND g.source = 'admin' AND (g.expires IS NULL OR g.expires > ?2) WHERE s.hash = ?1 AND s.expires > ?2"
      ).bind(await h.sha256(token), t).first();
      if (row) Object.assign(who, { uid: row.uid || await uidFor(env, row.email, t), admin: row.source === 'admin', auth: 'ok' });
    }
    // An unknown or expired token is not an error: the visitor reads along as a guest and the page offers to sign in again.
    // The rooms get the handshake and who it is, nothing else the browser or Cloudflare sent: no address, no cookie, no token.
    const headers = new Headers();
    for (const name of FORWARD) if (request.headers.has(name)) headers.set(name, request.headers.get(name));
    headers.set('X-Chat-Who', JSON.stringify(who));
    if (offered.includes(PROTO)) headers.set('Sec-WebSocket-Protocol', PROTO); // the token stops here
    return hubOf(env).fetch(new Request('https://chat/ws', { headers }));
  }

  throw h.fail(404, '没有这个接口');
}

/** Every 15 minutes: when reports wait, one mail to each site admin, at most every 12 hours. `h` = { allow, sendMail }.
    Costs one request to the rooms each time, so nothing is asked while they are switched off.
    First it forgets the connection counters whose ten minutes are over: their keys are hashes of addresses, and the
    privacy page says these are kept for a short while only. (A range on the key and not LIKE, so the index is used.) */
export async function chatCron(env, h) {
  await env.DB.prepare("DELETE FROM throttle WHERE key >= 'chat-ws:' AND key < 'chat-ws;' AND reset < ?1").bind(Math.floor(Date.now() / 1000)).run()
    .catch((e) => console.error('chat: clearing connection counters failed', e));
  if (env.CHAT_REPORT_MAIL === '0' || !chatOn(env)) return;
  const res = await hubOf(env).fetch(new Request('https://chat/pending'));
  const n = res.ok ? num((await res.json()).reports, 0) : 0;
  if (!n || !(await h.allow(env, 'chat-report-mail', 1, 43200))) return;
  const admins = (await env.DB.prepare("SELECT email FROM grants WHERE source = 'admin' AND (expires IS NULL OR expires > ?1)").bind(Math.floor(Date.now() / 1000)).all()).results;
  for (const a of admins) {
    await h.sendMail(env, a.email, `讨论室有 ${n} 条举报待处理`, `MolAstria 讨论室里有 ${n} 条被举报的消息等你处理（被三个账号举报的消息已经先隐藏了）。\n打开 https://molastria.com/chat/#mod 查看。\n\n处理完之前，这封提醒每 12 小时最多发一次。`)
      .catch((e) => console.error('chat: report mail failed', e));
  }
}
