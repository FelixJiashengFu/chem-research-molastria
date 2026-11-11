/* Discussion rooms: the page's pure logic. The message tokeniser (links, code), client-side mirrors of the server's
   text / nickname / room-name rules, the reducer that folds server frames into the page state, grouping for display,
   unread accounting, the reconnect schedule, the sentence for every error code, time helpers and avatar colours.
   No DOM and no network (tools/chat-core-test.mjs tests it). The server is deploy/chat.js; it is the authority on
   every rule mirrored here, the mirrors only let the page answer before the round trip.
   Browser: window.MOLASTRIA_CHAT_CORE; node: module.exports. */
(function (root) {
  'use strict';

  const PREFS_KEY = 'molastria-chat';        // localStorage: last room, last-read marks, people I hid
  const DRAFT_KEY = 'molastria-chat-draft';  // sessionStorage: what I was typing, per room
  const LIMITS = { text: 2000, name: [2, 20], title: [2, 30], topic: 120, rooms: 3 };
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;
  const GROUP_GAP = 5 * MIN;   // a later message by the same author within this gap goes under the same header
  const MAX_LOG = 600;         // messages kept per room in memory; older ones can be loaded again
  const MAX_READ = 300, MAX_HIDE = 200;
  // What one server frame may bring, far above what the server sends (50 messages, 200 people): a buggy or hostile
  // frame must not be able to fill the page's memory or make it draw for seconds.
  const MAX_BATCH = 200, MAX_ROOMS = 500, MAX_PEOPLE = 500, MAX_REPORTS = 200;
  const T_MAX = 4102444800000;   // 2100-01-01: times are clamped to 0..T_MAX so no date helper is handed an invalid date
  const STABLE_MS = 30000;       // a connection that stayed up this long was a good one: the next drop starts the backoff over
  const ROOM_ID = /^[a-z0-9_-]{1,40}$/i;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const arr = (v) => (Array.isArray(v) ? v : []);
  const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const int = (v, d = 0) => Math.max(0, Math.round(num(v, d)));
  const str = (v, n = 400) => (typeof v === 'string' ? v.slice(0, n) : '');
  const count = (s) => Array.from(s).length; // code points, the unit the server counts in
  const pad = (n) => String(n).padStart(2, '0');
  const time = (v) => Math.min(T_MAX, Math.max(0, num(v)));
  /** Room ids index plain tables (logs, read marks, drafts): only the server's own shape, and never "__proto__". */
  const isRoomId = (v) => typeof v === 'string' && ROOM_ID.test(v) && v !== '__proto__';
  const table = () => Object.create(null); // a lookup by id with no inherited keys ("constructor", "toString" …)

  // ── Rules mirrored from the server ─────────────────────────────────────
  // The same steps as tidy(), cleanText(), cleanLine() and cleanName() in deploy/chat.js; the test compares the two.
  // Control characters, zero-width spaces and the direction overrides that can reorder a line on screen.
  // eslint-disable-next-line no-control-regex
  const STRIP = /[\u0000-\u0009\u000B-\u001F\u007F-\u009F\u200B\u200E\u200F\u202A-\u202E\u2060\u2066-\u2069\uFEFF]/g;
  // Letters that are drawn as nothing (Hangul fillers, the Braille blank…): a name made of them would look empty.
  const BLANK = /[\u115F\u1160\u17B4\u17B5\u180E\u2800\u3164\uFFA0]/g;
  const VISIBLE = /[^\s\p{Cf}\p{M}]/u;
  // Characters that draw nothing even after cleanText (variation selectors, the combining grapheme joiner…): a nickname or a
  // room name holding one could look exactly like another one. The server refuses those (deploy/chat.js invisible()).
  const INVISIBLE = /[\p{Default_Ignorable_Code_Point}\p{Cf}]/u;

  /** Message text as the server will store it: NFC, no control, zero-width or direction characters, tabs to spaces, no spaces at line ends, trimmed, at most two blank lines in a row. */
  function cleanText(v) {
    const raw = typeof v === 'string' ? v : '';
    const s = (typeof raw.toWellFormed === 'function' ? raw.toWellFormed() : raw).normalize('NFC')
      .replace(/\r\n?|[\u2028\u2029]/g, '\n').replace(/\t/g, ' ').replace(STRIP, '').replace(BLANK, ' ');
    return s.split('\n').map((l) => l.trimEnd()).join('\n').replace(/\n{4,}/g, '\n\n\n').trim();
  }
  /** { ok, text, len, code } with code 'empty' or 'long'. */
  function checkText(v, limits = LIMITS) {
    const text = cleanText(v), len = count(text);
    if (typeof v === 'string' && v.length > limits.text * 8) return { ok: false, text, len, code: 'long' };
    if (!len || !VISIBLE.test(text)) return { ok: false, text, len, code: 'empty' };
    if (len > limits.text) return { ok: false, text, len, code: 'long' };
    return { ok: true, text, len, code: '' };
  }

  // Names nobody but the owner may carry: they would read as staff.
  const RESERVED = ['站长', '站長', '管理员', '管理員', '官方', '客服', '系统', '系統', 'admin', 'moderator', 'molastria', 'official', 'system', 'owner'];
  /** The form two nicknames are compared in: "Ｆe" and "fe" and "F e" are the same name. */
  const nameKey = (s) => String(s ?? '').normalize('NFKC').toLowerCase().replace(/\s+/g, '');
  /**
   * A nickname against the server's rules. Spaces at the ends are dropped and runs of spaces become one, as the
   * server does (the page sends the tidied name). Returns { ok, name, key, why }; why is one of empty, chars,
   * start, short, long, reserved.
   */
  function checkName(v, o = {}) {
    const [min, max] = (o.limits || LIMITS).name;
    const name = cleanText(v).replace(/\s+/g, ' ');
    const key = nameKey(name), n = count(name);
    const bad = (why) => ({ ok: false, name, key, why });
    if (!n || !VISIBLE.test(name)) return bad('empty');
    if (!/^[\p{L}\p{M}\p{N} _.-]+$/u.test(name) || INVISIBLE.test(name)) return bad('chars');
    if (!/^[\p{L}\p{N}]/u.test(name)) return bad('start');
    if (n < min) return bad('short');
    if (n > max) return bad('long');
    if (!o.admin && RESERVED.some((w) => key.replace(/[_.-]/g, '').includes(w))) return bad('reserved');
    return { ok: true, name, key, why: '' };
  }
  const NAME_WHY = {
    empty: ['先写一个昵称。', 'Type a nickname first.'],
    short: ['太短了，至少 {min} 个字。', 'Too short: at least {min} characters.'],
    long: ['太长了，最多 {max} 个字。', 'Too long: at most {max} characters.'],
    chars: ['只能用文字、数字、空格和 _ - . 这几个符号。', 'Letters, digits, spaces and _ - . only.'],
    start: ['要用文字或数字开头。', 'Start with a letter or a digit.'],
    reserved: ['这个名字留给站长用，换一个吧。', 'That name is reserved for the site owner. Pick another.']
  };
  function nameWhy(why, en, limits = LIMITS) {
    const pair = NAME_WHY[why];
    return pair ? pair[en ? 1 : 0].replace('{min}', limits.name[0]).replace('{max}', limits.name[1]) : '';
  }

  const oneLine = (v) => cleanText(v).replace(/\s+/g, ' ');
  /** A room name: one line, 2–30 characters. { ok, title, why: 'short' | 'long' | '' } */
  function checkTitle(v, limits = LIMITS) {
    const title = oneLine(v), n = count(title), seen = VISIBLE.test(title);
    return { ok: seen && n >= limits.title[0] && n <= limits.title[1] && !INVISIBLE.test(title), title, why: !seen || n < limits.title[0] ? 'short' : n > limits.title[1] ? 'long' : '' };
  }
  /** A room's one-line description, optional, at most 120 characters. */
  function checkTopic(v, limits = LIMITS) {
    const topic = oneLine(v), n = count(topic);
    return { ok: n <= limits.topic, topic, len: n, why: n > limits.topic ? 'long' : '' };
  }

  // ── Message text → tokens ──────────────────────────────────────────────
  // The page builds DOM nodes from these (textContent, never innerHTML), so nothing a person types is parsed as HTML.
  // A link stops at whitespace, at quotes and angle brackets, and at CJK characters and full-width punctuation:
  // Chinese is written without spaces, so "见 https://a.org/x，然后" must not swallow "，然后". Addresses with raw
  // Chinese in the path lose their tail this way; percent-encoded ones (what browsers copy) are unaffected.
  const URL_RE = /\bhttps?:\/\/[^\s<>"'`\p{Script=Han}\p{Script=Hiragana}\p{Script=Katakana}\p{Script=Hangul}　-〿＀-￯‘-‟…—]+/giu;
  const OPENER = { ')': '(', ']': '[', '}': '{' };
  /** Drop sentence punctuation that follows an address, and a closing bracket that the address never opened. */
  function trimUrl(s) {
    // Brackets are counted once and the count follows the trimming: counting again for every character dropped made
    // an address followed by thousands of ")" take seconds.
    const n = { '(': 0, ')': 0, '[': 0, ']': 0, '{': 0, '}': 0 };
    for (let i = 0; i < s.length; i++) if (n[s[i]] !== undefined) n[s[i]]++;
    let end = s.length;
    while (end > 0) {
      const ch = s[end - 1];
      if ('.,;:!?'.includes(ch)) { end--; continue; }
      if (OPENER[ch] && n[ch] > n[OPENER[ch]]) { n[ch]--; end--; continue; }
      break;
    }
    return s.slice(0, end);
  }
  /**
   * The address to put in href, or '' when it is not a plain http(s) address. user:pass@host is refused: it is how a
   * link pretends to go elsewhere. So is any address whose host, as the browser works it out, is not what was typed
   * right after the scheme: "molastria.com" followed by a slash look-alike (U+2215, U+2044) and "evil.example" reads
   * as a page on molastria.com but is one host under evil.example. Such text stays text. The price: a host typed in
   * non-ASCII letters, or as a number the browser rewrites, is not linked either.
   */
  function safeHref(s) {
    let u;
    try { u = new URL(s); } catch { return ''; }
    if (u.protocol !== 'http:' && u.protocol !== 'https:') return '';
    if (u.username || u.password || !u.hostname.includes('.')) return '';
    const typed = String(s).slice(u.protocol.length + 2).toLowerCase(), after = typed[u.hostname.length];
    if (!typed.startsWith(u.hostname) || (after !== undefined && !'/:?#'.includes(after))) return '';
    return u.href;
  }
  /**
   * Text → [{ t: 'text' | 'link' | 'code' | 'pre', s, href?, lang? }].
   * ``` fenced blocks (the fence on its own line) become 'pre', `spans` become 'code', http(s) addresses become
   * 'link'; everything else, line breaks included, stays 'text'. Nothing inside code is linked.
   */
  function tokenize(text) {
    const src = typeof text === 'string' ? text : '';
    const out = [];
    const push = (t, s, more) => {
      if (!s) return;
      const last = out[out.length - 1];
      if (t === 'text' && last && last.t === 'text') last.s += s; else out.push({ t, s, ...more });
    };
    const links = (s) => {
      let i = 0;
      URL_RE.lastIndex = 0;
      for (let m; (m = URL_RE.exec(s));) {
        const raw = trimUrl(m[0]), href = safeHref(raw);
        if (!href) continue;
        push('text', s.slice(i, m.index));
        push('link', raw, { href });
        i = m.index + raw.length;
        URL_RE.lastIndex = i;
      }
      push('text', s.slice(i));
    };
    const inline = (s) => {
      const CODE = /(`{1,3})(?!`)([^\n]*?[^`\n])\1(?!`)/g;
      let i = 0;
      for (let m; (m = CODE.exec(s));) {
        links(s.slice(i, m.index));
        push('code', m[2]);
        i = m.index + m[0].length;
      }
      links(s.slice(i));
    };
    const FENCE = /(^|\n)```([\w+#.-]{0,20})[^\S\n]*\n([\s\S]+?)\n?```[^\S\n]*(?=\n|$)/g;
    let i = 0;
    for (let m; (m = FENCE.exec(src));) {
      inline(src.slice(i, m.index));
      push('pre', m[3], m[2] ? { lang: m[2] } : undefined);
      i = m.index + m[0].length;
      if (src[i] === '\n') i++; // the block ends the line by itself
      FENCE.lastIndex = i;
    }
    inline(src.slice(i));
    return out;
  }
  /** One line of at most n characters, for quotes and previews. */
  function clip(text, n = 80) {
    const s = String(text ?? '').replace(/\s+/g, ' ').trim(), a = Array.from(s);
    return a.length > n ? a.slice(0, n - 1).join('') + '…' : s;
  }

  // ── Time ───────────────────────────────────────────────────────────────
  // Hand-rolled instead of Intl so the same instant gives the same string in every browser and in the tests.
  const WD_ZH = ['星期日', '星期一', '星期二', '星期三', '星期四', '星期五', '星期六'];
  const WD_EN = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  const MO_EN = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  /** Local date and time fields. tz is minutes west of UTC, as Date#getTimezoneOffset gives (so daylight saving follows the date). */
  function parts(ms, tz = new Date(ms).getTimezoneOffset()) {
    const d = new Date(ms - tz * MIN);
    return { y: d.getUTCFullYear(), mo: d.getUTCMonth(), d: d.getUTCDate(), h: d.getUTCHours(), mi: d.getUTCMinutes(), wd: d.getUTCDay() };
  }
  const dayOf = (ms, tz) => { const p = parts(ms, tz); return `${p.y}-${pad(p.mo + 1)}-${pad(p.d)}`; };
  const clock = (ms, tz) => { const p = parts(ms, tz); return `${pad(p.h)}:${pad(p.mi)}`; };
  const fullTime = (ms, tz) => `${dayOf(ms, tz)} ${clock(ms, tz)}`;
  const monthDay = (p, en) => (en ? `${MO_EN[p.mo]} ${p.d}` : `${p.mo + 1}月${p.d}日`);
  /** The divider between two days: Today, Yesterday, "Mon, Nov 9", or with the year when it is not this year. */
  function dayLabel(ms, now, en, tz) {
    const day = dayOf(ms, tz);
    if (day === dayOf(now, tz)) return en ? 'Today' : '今天';
    if (day === dayOf(now - DAY, tz)) return en ? 'Yesterday' : '昨天';
    const p = parts(ms, tz);
    if (p.y !== parts(now, tz).y) return en ? `${MO_EN[p.mo]} ${p.d}, ${p.y}` : `${p.y}年${p.mo + 1}月${p.d}日`;
    return en ? `${WD_EN[p.wd]}, ${MO_EN[p.mo]} ${p.d}` : `${p.mo + 1}月${p.d}日 ${WD_ZH[p.wd]}`;
  }
  /** How long ago, short, for the room list: now, 5 min, 14:05 (earlier today), Yesterday, 3 d, Nov 9. */
  function relTime(ms, now, en, tz) {
    const gap = now - ms;
    if (gap < MIN) return en ? 'now' : '刚刚';
    if (gap < HOUR) return en ? `${Math.floor(gap / MIN)} min` : `${Math.floor(gap / MIN)} 分钟前`;
    if (dayOf(ms, tz) === dayOf(now, tz)) return clock(ms, tz);
    if (dayOf(ms, tz) === dayOf(now - DAY, tz)) return en ? 'Yesterday' : '昨天';
    if (gap < 7 * DAY) return en ? `${Math.floor(gap / DAY)} d` : `${Math.floor(gap / DAY)} 天前`;
    const p = parts(ms, tz);
    return p.y === parts(now, tz).y ? monthDay(p, en) : en ? `${MO_EN[p.mo]} ${p.y}` : `${p.y}年${p.mo + 1}月`;
  }
  /** A wait in seconds, rounded up to a unit a person can count: 3 s, 2 min, 5 h. */
  function waitText(seconds, en) {
    const s = Math.max(1, Math.ceil(num(seconds, 1)));
    if (s < 90) return en ? `${s} s` : `${s} 秒`;
    if (s < 5400) return en ? `${Math.ceil(s / 60)} min` : `${Math.ceil(s / 60)} 分钟`;
    return en ? `${Math.ceil(s / 3600)} h` : `${Math.ceil(s / 3600)} 小时`;
  }
  /** A moment in the future: the clock time when it is today, with the date otherwise. */
  function untilText(ms, now, en, tz) {
    if (dayOf(ms, tz) === dayOf(now, tz)) return clock(ms, tz);
    const p = parts(ms, tz), date = p.y === parts(now, tz).y ? monthDay(p, en) : en ? `${MO_EN[p.mo]} ${p.d}, ${p.y}` : `${p.y}年${p.mo + 1}月${p.d}日`;
    return en ? `${date}, ${clock(ms, tz)}` : `${date} ${clock(ms, tz)}`;
  }

  // ── Error codes → sentences ────────────────────────────────────────────
  // Every refusal code of the wire protocol, in the order the contract lists them, then the ones the page raises itself.
  const ERR_CODES = ['bad', 'signin', 'name-needed', 'name-bad', 'name-taken', 'name-wait', 'muted', 'banned', 'readonly', 'closed', 'slow', 'flood', 'dup',
    'empty', 'long', 'word', 'no-room', 'no-msg', 'forbidden', 'rooms-max', 'rooms-full', 'room-wait', 'title-bad', 'title-taken', 'reports-max', 'self', 'full', 'server'];
  const ERRORS = {
    bad: ['服务器没看懂这个请求，刷新页面后再试。', 'The server could not read that request. Reload the page and try again.'],
    signin: ['登录后才能这样做。', 'Sign in to do that.'],
    'name-needed': ['先取一个昵称，再发言。', 'Pick a nickname before you post.'],
    'name-bad': ['这个昵称不合规则：{min}–{max} 个字，可以用文字、数字、空格和 _ - . 这几个符号。', 'That nickname does not fit the rules: {min}–{max} characters; letters, digits, spaces and _ - . only.'],
    'name-taken': ['这个昵称已经有人用了，换一个吧。', 'That nickname is taken. Try another.'],
    'name-wait': ['昵称每 24 小时只能改一次，{wait}后可以再改。', 'A nickname can change once every 24 hours. Try again in {wait}.'],
    muted: ['你被禁言了，{until}之后可以再发言。', 'You are muted until {until}.'],
    banned: ['你的账号已被禁止在讨论室发言。', 'Your account has been banned from posting in the rooms.'],
    readonly: ['讨论室现在是只读的，暂时不能发言。', 'The rooms are read-only right now, so nothing can be posted.'],
    closed: ['这个房间已经关闭，只能阅读。', 'This room is closed. You can still read it.'],
    slow: ['发得太快了，{wait}后再发。', 'A little too fast. Try again in {wait}.'],
    flood: ['发言太频繁了，{wait}后再试。', 'Too many messages in a short time. Try again in {wait}.'],
    dup: ['这句话你刚刚发过了。', 'You just sent that same message.'],
    empty: ['消息是空的。', 'The message is empty.'],
    long: ['消息太长了，最多 {text} 个字。', 'That message is too long. The limit is {text} characters.'],
    word: ['消息里有这里不允许的词，改一下再发。', 'The message contains a word that is not allowed here. Edit it and try again.'],
    'no-room': ['这个房间不存在，可能已经被移除。', 'That room does not exist. It may have been removed.'],
    'no-msg': ['这条消息不存在，可能已经被删除。', 'That message no longer exists.'],
    forbidden: ['你没有权限这样做。', 'You are not allowed to do that.'],
    'rooms-max': ['你已经开了 {rooms} 个房间，关掉一个才能再开。', 'You already have {rooms} open rooms. Close one before opening another.'],
    'rooms-full': ['大家开的房间已经到了全站上限，过些时候再试。', 'The site has reached its limit of community rooms. Try again later.'],
    'room-wait': ['每 10 分钟只能开一个房间，{wait}后再试。', 'You can open one room every 10 minutes. Try again in {wait}.'],
    'title-bad': ['房间名要 {tmin}–{tmax} 个字。', 'A room name needs {tmin}–{tmax} characters.'],
    'title-taken': ['已经有同名的房间了，换一个名字。', 'A room with that name already exists. Pick another name.'],
    'reports-max': ['你今天举报的次数已经到上限（20 次），明天再来。', 'You have reached today’s limit of 20 reports. Try again tomorrow.'],
    self: ['不能举报自己的消息。', 'You cannot report your own message.'],
    full: ['讨论室现在人满了，稍后会自动再试。', 'The rooms are full right now. The page will keep trying.'],
    server: ['服务器这边出了点问题，稍后再试。', 'Something went wrong on the server. Try again in a little while.'],
    // raised by the page, never sent by the server
    lost: ['没发出去：连接断了。', 'Not sent: the connection dropped.'],
    timeout: ['没发出去：服务器没有回应。', 'Not sent: the server did not answer.'],
    kicked: ['刚才发得太密，连接被服务器断开了，稍后会自动重连。', 'Too many requests in a few seconds, so the server closed the connection. The page will reconnect shortly.'],
    toobig: ['刚才那条内容太大，连接被服务器断开了。', 'That was too large, so the server closed the connection.'],
    'muted-open': ['你被禁言了，暂时不能发言。', 'You are muted for now.'],
    unknown: ['没成功（{code}），稍后再试。', 'That did not work ({code}). Try again later.']
  };
  /** The sentence for a refusal. o: { en, wait (s), until (ms), now, tz, limits }. A missing wait reads "in a moment". */
  function errorText(code, o = {}) {
    const en = !!o.en, lim = o.limits || LIMITS;
    let key = Object.prototype.hasOwnProperty.call(ERRORS, code) ? code : 'unknown';
    if (key === 'muted' && !(num(o.until) > 0)) key = 'muted-open';
    const fill = {
      wait: num(o.wait) > 0 ? waitText(o.wait, en) : en ? 'a moment' : '稍',
      until: num(o.until) > 0 ? untilText(o.until, num(o.now, o.until), en, o.tz) + (en ? '' : ' ') : '',
      min: lim.name[0], max: lim.name[1], tmin: lim.title[0], tmax: lim.title[1], text: lim.text, rooms: lim.rooms, code: String(code ?? '')
    };
    return ERRORS[key][en ? 1 : 0].replace(/\{(\w+)\}/g, (all, k) => (k in fill ? fill[k] : all));
  }
  /** Why the server closed the socket, as one of our error codes ('' = an ordinary drop). */
  const closeCode = (code) => ({ 4001: 'full', 4002: 'kicked', 1009: 'toobig' }[code] || '');

  // ── Reconnect schedule ─────────────────────────────────────────────────
  /** Milliseconds before reconnect attempt n (0-based): doubles from 1 s to 30 s, and the upper half is random so a crowd that dropped together does not come back together. */
  function backoff(attempt, rand = Math.random) {
    const top = Math.min(30000, 1000 * 2 ** Math.min(Math.max(0, attempt | 0), 10));
    return Math.round(top / 2 + rand() * top / 2);
  }
  /** The attempt counter after a connection that lasted upMs ended: only one that stayed up starts the schedule over. A socket that drops right after its hello keeps backing off. */
  const settle = (attempt, upMs) => (num(upMs) >= STABLE_MS ? 0 : Math.max(0, attempt | 0));
  const wsUrl = (api) => String(api || '').replace(/\/+$/, '').replace(/^http/i, 'ws') + '/chat/ws';
  /** A browser cannot set headers on a WebSocket, so the session token travels as a second subprotocol. */
  const wsProtocols = (token) => (token ? ['molastria-chat', 't.' + token] : ['molastria-chat']);

  // ── Avatars ────────────────────────────────────────────────────────────
  // Twelve muted colours that all carry white text at 4.5:1 or better (the test checks), so one circle works on
  // the light and the dark surface alike.
  const PALETTE = ['#2e6550', '#1f6b73', '#2f5f8a', '#4a5aa8', '#6e5aa8', '#86509a', '#9c4a6b', '#a5402d', '#8a5a14', '#62681f', '#48683a', '#566470'];
  function hash(s) {
    let h = 0x811c9dc5;
    for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h;
  }
  const avatarColor = (uid) => PALETTE[hash(uid || '') % PALETTE.length];
  /** The letter in the circle: the first character of the nickname, upper-cased; a wiped account shows a dot. */
  const initial = (name) => { const a = Array.from(String(name ?? '').trim()); return a.length ? a[0].toUpperCase() : '·'; };

  // ── Rooms ──────────────────────────────────────────────────────────────
  const roomTitle = (r, en) => (en && r.title_en) || r.title;
  const roomTopic = (r, en) => (en && r.topic_en) || r.topic || '';
  /** Official rooms keep the server's order; rooms people opened follow, the most recently active first. */
  function sortRooms(rooms) {
    const official = rooms.filter((r) => r.kind === 'official');
    const community = rooms.filter((r) => r.kind !== 'official').sort((a, b) => b.last - a.last || (a.id < b.id ? -1 : 1));
    return { official, community };
  }
  function filterRooms(rooms, query) {
    const q = String(query ?? '').trim().toLowerCase();
    if (!q) return rooms;
    return rooms.filter((r) => [r.title, r.title_en, r.topic, r.topic_en, r.owner_name].some((s) => typeof s === 'string' && s.toLowerCase().includes(q)));
  }
  /** #r-<room> opens a room, #mod the owner's panel. */
  function parseHash(hash) {
    const h = String(hash ?? '').replace(/^#/, '');
    if (h === 'mod') return { room: '', mod: true };
    const id = h.startsWith('r-') ? h.slice(2) : '';
    return { room: isRoomId(id) ? id : '', mod: false };
  }
  const roomHash = (id) => `#r-${id}`;
  /** The tab title with the unread total in front, the way mail and chat tabs show it. */
  const pageTitle = (base, n) => (n > 0 ? `(${n > 99 ? '99+' : n}) ${base}` : base);

  // ── Saved preferences ──────────────────────────────────────────────────
  // uid: the account these were last used with. read and hide are tables without a prototype (ids are their keys).
  const emptyPrefs = () => ({ v: 1, room: '', uid: '', read: table(), hide: table() });
  const UID = /^[a-z0-9]{1,40}$/i;
  /** Whatever was stored (object or JSON string) → valid preferences. Never throws. */
  function migratePrefs(raw) {
    const p = emptyPrefs();
    let r = raw;
    if (typeof r === 'string') try { r = JSON.parse(r); } catch { r = null; }
    if (!isObj(r)) return p;
    if (isRoomId(r.room)) p.room = r.room;
    if (typeof r.uid === 'string' && UID.test(r.uid)) p.uid = r.uid;
    if (isObj(r.read)) for (const [id, v] of Object.entries(r.read).slice(0, MAX_READ)) if (isObj(v) && isRoomId(id)) p.read[id] = { n: int(v.n), id: int(v.id) };
    if (isObj(r.hide)) for (const [uid, name] of Object.entries(r.hide).slice(0, MAX_HIDE)) if (UID.test(uid)) p.hide[uid] = str(name, 60);
    return p;
  }
  /**
   * The signed-in account, told to the saved preferences. The list of hidden people belongs to whoever made it: when
   * a different account signs in on this device it is emptied (the page empties the drafts too). Returns '' (same
   * account, or nobody signed in), 'first' (no account was recorded yet: nothing is cleared) or 'switched'.
   */
  function switchAccount(prefs, uid) {
    if (typeof uid !== 'string' || !UID.test(uid) || prefs.uid === uid) return '';
    const was = prefs.uid;
    prefs.uid = uid;
    if (!was) return 'first';
    prefs.hide = table();
    return 'switched';
  }

  // ── Unread ─────────────────────────────────────────────────────────────
  // A room reports n, the number of messages ever posted in it. The page remembers n as of the last time the reader
  // was at the bottom of that room; the difference is what they have not seen. A room met for the first time starts
  // from its current n: a newcomer is not told that the whole history is unread.
  /** Bring the saved marks in line with the room list. Returns true when something changed (so the page saves). */
  function syncRead(prefs, rooms) {
    let changed = false;
    const live = new Set(rooms.map((r) => r.id));
    for (const r of rooms) {
      const rec = prefs.read[r.id];
      if (!rec) { prefs.read[r.id] = { n: r.n, id: 0 }; changed = true; }
      else if (rec.n > r.n) { rec.n = r.n; changed = true; } // the count went back (rooms were rebuilt): start over from here
    }
    if (rooms.length) for (const id of Object.keys(prefs.read)) if (!live.has(id)) { delete prefs.read[id]; changed = true; }
    return changed;
  }
  const unread = (prefs, room) => { const rec = prefs.read[room.id]; return rec ? Math.max(0, room.n - rec.n) : 0; };
  const totalUnread = (prefs, rooms) => rooms.reduce((sum, r) => sum + unread(prefs, r), 0);
  /** The reader has seen this room up to lastId. Returns true when the mark moved. */
  function markRead(prefs, room, lastId = 0) {
    const rec = prefs.read[room.id] || (prefs.read[room.id] = { n: -1, id: 0 });
    const id = Math.max(rec.id, int(lastId));
    if (rec.n === room.n && rec.id === id) return false;
    rec.n = room.n; rec.id = id;
    return true;
  }
  /**
   * The message the "new" divider goes above when a room opens: the first one after the saved mark that someone
   * else wrote. Without a saved id (the room was never opened) the unread count says how far back to look. 0 = no divider.
   */
  function firstUnread(msgs, rec, unreadCount, myUid) {
    if (!rec || unreadCount <= 0 || !msgs.length) return 0;
    const from = rec.id > 0 ? msgs.findIndex((m) => m.id > rec.id) : Math.max(0, msgs.length - unreadCount);
    if (from < 0) return 0;
    const m = msgs.slice(from).find((x) => x.uid !== myUid);
    return m ? m.id : 0;
  }

  // ── State ──────────────────────────────────────────────────────────────
  function createState() {
    return {
      ready: false,        // a hello has arrived on the current connection
      known: false,        // a hello has arrived at some point, so rooms and identity are worth showing while reconnecting
      mode: 'on',          // 'on' | 'readonly'
      auth: 'none',        // 'ok' | 'none' | 'expired'
      me: null, online: 0, reports: 0, limits: { ...LIMITS, name: [...LIMITS.name], title: [...LIMITS.title] },
      skew: 0,             // server clock minus this device's clock, ms
      rooms: [], cur: '',  // cur: the room this connection has joined (or is joining)
      logs: table(),       // room id → { msgs: Msg[] ascending by id, more, loaded, older (a "more" request is out), stale }
      pending: [],         // my messages not yet confirmed: { cid, room, text, reply, t, state: 'sending' | 'failed', code }
      waiting: [],         // other requests not yet answered: { cid, re, frame, ctx }
      who: null, whoAsk: '', // whoAsk: the room whose "who is here" list the reader asked for and has not got yet
      mod: null, seq: 0
    };
  }
  const roomById = (s, id) => s.rooms.find((r) => r.id === id) || null;

  function cleanRoom(r) {
    if (!isObj(r) || !isRoomId(r.id) || typeof r.title !== 'string') return null;
    return {
      id: r.id, kind: r.kind === 'official' ? 'official' : 'user', title: str(r.title), title_en: str(r.title_en) || null,
      topic: str(r.topic), topic_en: str(r.topic_en) || null, owner: str(r.owner) || null, owner_name: str(r.owner_name) || null,
      n: int(r.n), last: time(r.last), online: int(r.online), closed: !!r.closed
    };
  }
  /** A room list from the server: valid rooms only, one per id, at most MAX_ROOMS. */
  function cleanRooms(list) {
    const byId = new Map();
    for (const raw of arr(list).slice(0, MAX_ROOMS)) { const r = cleanRoom(raw); if (r && !byId.has(r.id)) byId.set(r.id, r); }
    return [...byId.values()];
  }
  function cleanMe(me) {
    if (!isObj(me) || typeof me.uid !== 'string' || !me.uid) return null;
    return { uid: me.uid, name: str(me.name) || null, role: me.role === 'admin' ? 'admin' : 'user', muted: time(me.muted), banned: !!me.banned, rooms: int(me.rooms) };
  }
  function cleanMsg(m, room) {
    if (!isObj(m) || !Number.isInteger(m.id) || m.id <= 0) return null;
    const r = typeof m.room === 'string' && m.room ? m.room : room || '';
    if (!isRoomId(r)) return null;
    const out = { id: m.id, room: r, uid: str(m.uid), name: str(m.name) || null, role: m.role === 'admin' ? 'admin' : 'user', text: str(m.text, 8000), t: time(m.t), reply: null };
    if (isObj(m.reply) && Number.isInteger(m.reply.id)) out.reply = { id: m.reply.id, name: str(m.reply.name) || null, text: str(m.reply.text) };
    if (m.del === 1 || m.del === 2) { out.del = m.del; out.text = ''; }
    if (m.hidden === true) out.hidden = true;
    return out;
  }
  /** A batch from the server: valid messages only, ascending, one per id, at most MAX_BATCH. */
  function cleanMsgs(list, room) {
    const byId = new Map();
    for (const raw of arr(list).slice(0, MAX_BATCH)) { const m = cleanMsg(raw, room); if (m && m.room === room) byId.set(m.id, m); }
    return [...byId.values()].sort((a, b) => a.id - b.id);
  }
  function cleanLimits(l) {
    const out = { ...LIMITS, name: [...LIMITS.name], title: [...LIMITS.title] };
    if (!isObj(l)) return out;
    const pair = (v, d) => (Array.isArray(v) && v.length === 2 && v.every((x) => Number.isInteger(x) && x > 0) && v[0] <= v[1] ? [v[0], v[1]] : d);
    if (Number.isInteger(l.text) && l.text > 0) out.text = l.text;
    if (Number.isInteger(l.topic) && l.topic > 0) out.topic = l.topic;
    if (Number.isInteger(l.rooms) && l.rooms >= 0) out.rooms = l.rooms;
    out.name = pair(l.name, out.name); out.title = pair(l.title, out.title);
    return out;
  }
  /** Put a message into an ascending list. Returns false when its id was already there (the copy is replaced). */
  function insert(msgs, m) {
    if (!msgs.length || msgs[msgs.length - 1].id < m.id) { msgs.push(m); return true; }
    let i = msgs.length - 1;
    while (i >= 0 && msgs[i].id > m.id) i--;
    if (i >= 0 && msgs[i].id === m.id) { msgs[i] = m; return false; }
    msgs.splice(i + 1, 0, m);
    return true;
  }

  const newCid = (s, now, rand) => `c${now.toString(36)}${(++s.seq).toString(36)}${Math.floor(rand() * 46656).toString(36)}`;
  /**
   * Queue a message of mine: it shows at once as "sending" and is matched to the server's copy by cid.
   * o: { room, text, reply: { id, name, text } | null }. Returns the frame to send.
   */
  function say(s, o, now = Date.now(), rand = Math.random) {
    const cid = newCid(s, now, rand);
    s.pending.push({ cid, room: o.room, text: o.text, reply: o.reply || null, t: now + s.skew, state: 'sending', code: '' });
    const frame = { t: 'say', room: o.room, text: o.text, cid };
    if (o.reply) frame.reply = o.reply.id;
    return frame;
  }
  /**
   * Register any other request that the server answers with ok / err. The cid goes out with the frame; the server
   * echoes it where it can, and where it only names the request type (re) the oldest waiting request of that type
   * is the one being answered. ctx is whatever the page wants back with the answer.
   */
  function ask(s, frame, ctx, now = Date.now(), rand = Math.random) {
    const cid = newCid(s, now, rand);
    s.waiting.push({ cid, re: frame.t, frame, ctx: ctx ?? null });
    return { ...frame, cid };
  }
  function takeWaiting(s, cid, re) {
    let i = cid ? s.waiting.findIndex((w) => w.cid === cid) : -1;
    if (i < 0 && re) i = s.waiting.findIndex((w) => w.re === re);
    return i < 0 ? null : s.waiting.splice(i, 1)[0];
  }
  /**
   * Walk into a room. What the page already holds of it shows at once, but it is marked stale: the server's answer
   * replaces it outright, so messages removed while the reader was elsewhere do not linger. Returns the frame to send.
   */
  function enter(s, room) {
    if (s.cur !== room && s.logs[room]) s.logs[room].stale = true;
    s.cur = room;
    s.who = null; s.whoAsk = '';
    return { t: 'join', room };
  }
  /** Ask who is in a room. Only an answer to this opens the list: a who frame nobody asked for is dropped. Returns the frame to send. */
  function askWho(s, room) {
    s.whoAsk = room;
    return { t: 'who', room };
  }
  /** After a reconnect: join the same room again. The answer replaces what is on screen (dropConnection marked it stale). */
  const rejoin = (s) => (s.cur ? { t: 'join', room: s.cur } : null);
  /** Ask for the 50 messages above the oldest one held; null when there is nothing to ask or a request is already out. */
  function older(s, room) {
    const log = s.logs[room];
    if (!log || !log.loaded || !log.more || log.older || !log.msgs.length) return null;
    log.older = true;
    return { t: 'more', room, before: log.msgs[0].id };
  }
  /** The socket is gone: what was in flight will never be answered. Returns the requests that were waiting. */
  function dropConnection(s) {
    s.ready = false;
    for (const p of s.pending) if (p.state === 'sending') { p.state = 'failed'; p.code = 'lost'; }
    // While the line was down, messages may have been deleted and nothing told this page. What it holds cannot be
    // merged with the next answer any more, only replaced by it.
    for (const log of Object.values(s.logs)) { log.older = false; log.stale = true; }
    s.whoAsk = '';
    return s.waiting.splice(0);
  }

  /**
   * Fold one server frame into the state. Returns an event for the page ({ t, … } saying what changed), or null
   * for a frame that is malformed or changes nothing the page shows. now is this device's clock.
   */
  function reduce(s, f, now = Date.now()) {
    if (!isObj(f) || typeof f.t !== 'string') return null;
    switch (f.t) {
      case 'hello': {
        s.ready = true; s.known = true;
        s.mode = f.state === 'readonly' ? 'readonly' : 'on';
        s.auth = ['ok', 'none', 'expired'].includes(f.auth) ? f.auth : 'none';
        s.me = cleanMe(f.me);
        if (s.auth !== 'ok') s.me = null;
        s.rooms = cleanRooms(f.rooms);
        s.online = int(f.online);
        s.reports = int(f.reports);
        s.limits = cleanLimits(f.limits);
        s.skew = num(f.now) > 0 ? f.now - now : 0;
        s.who = null;
        const gone = s.cur && !roomById(s, s.cur) ? s.cur : '';
        return { t: 'hello', rejoin: gone ? '' : s.cur, gone };
      }
      case 'room': {
        const id = str(f.room), room = roomById(s, id);
        if (!isRoomId(id) || (id !== s.cur && !room)) return null; // neither the room being joined nor one on the list
        const batch = cleanMsgs(f.msgs, id);
        const log = s.logs[id] || (s.logs[id] = { msgs: [], more: false, loaded: false, older: false });
        // Coming back to a room already on screen: keep what is above the batch only when the batch reaches down
        // to it. If the newest message we hold is older than the batch's first one there may be a gap, and showing
        // a history with a hole is worse than loading earlier messages again.
        const first = batch.length ? batch[0].id : Infinity;
        const above = log.loaded && !log.stale && f.more && batch.length && log.msgs.length && log.msgs[log.msgs.length - 1].id >= first ? log.msgs.filter((m) => m.id < first) : [];
        if (above.length) log.msgs = above.concat(batch);
        else { log.msgs = batch; log.more = !!f.more; }
        log.loaded = true; log.older = false; log.stale = false;
        if (room) room.online = int(f.online);
        return { t: 'room', room: id };
      }
      case 'older': {
        const id = str(f.room), log = s.logs[id];
        if (!log || !log.older) return null; // only the answer to a "more" that is out may add to the top
        const first = log.msgs.length ? log.msgs[0].id : Infinity;
        const add = cleanMsgs(f.msgs, id).filter((m) => m.id < first);
        log.msgs = add.concat(log.msgs);
        log.more = !!f.more; log.older = false;
        return { t: 'older', room: id, added: add.length };
      }
      case 'msg': {
        const m = cleanMsg(f.m);
        if (!m) return null;
        const room = roomById(s, m.room), log = s.logs[m.room];
        let sent = null;
        if (typeof f.cid === 'string') { const i = s.pending.findIndex((p) => p.cid === f.cid); if (i >= 0) sent = s.pending.splice(i, 1)[0]; }
        const isNew = log && log.loaded ? insert(log.msgs, m) : true;
        if (isNew && room) { room.n += 1; room.last = Math.max(room.last, m.t); }
        return { t: 'msg', room: m.room, m, isNew, sent, mine: !!s.me && m.uid === s.me.uid };
      }
      case 'act': {
        const room = roomById(s, str(f.room));
        if (!room) return null;
        room.last = Math.max(room.last, time(f.last)); room.n = Math.max(room.n, int(f.n));
        return { t: 'act', room: room.id };
      }
      case 'upd': {
        const m = cleanMsg(f.m);
        if (!m) return null;
        const log = s.logs[m.room], quotes = [];
        let found = false;
        if (log) {
          const i = log.msgs.findIndex((x) => x.id === m.id);
          if (i >= 0) { log.msgs[i] = m; found = true; }
          // Replies quote their original; a removed original must not live on in the quotes under it.
          const gone = !!(m.del || m.hidden);
          for (const x of log.msgs) if (x.reply && x.reply.id === m.id) { x.reply = { id: m.id, name: m.name, text: gone ? '' : clip(m.text, 80) }; quotes.push(x.id); }
        }
        return { t: 'upd', room: m.room, m, found, quotes };
      }
      case 'rooms': {
        s.rooms = cleanRooms(f.rooms);
        for (const id of Object.keys(s.logs)) if (!roomById(s, id)) delete s.logs[id];
        s.pending = s.pending.filter((p) => roomById(s, p.room));
        return { t: 'rooms', gone: s.cur && !roomById(s, s.cur) ? s.cur : '' };
      }
      case 'pres': {
        const room = roomById(s, str(f.room));
        if (!room) return null;
        room.online = int(f.online);
        s.online = Math.max(s.online, room.online); // one room cannot hold more people than the site
        return { t: 'pres', room: room.id };
      }
      case 'who': {
        const id = str(f.room);
        if (!id || id !== s.whoAsk) return null; // nobody asked: a list of people must not open by itself
        s.whoAsk = '';
        s.who = {
          room: id, guests: int(f.guests),
          users: arr(f.users).slice(0, MAX_PEOPLE).filter((u) => isObj(u) && typeof u.uid === 'string').map((u) => ({ uid: u.uid, name: str(u.name) || null, role: u.role === 'admin' ? 'admin' : 'user' }))
        };
        return { t: 'who', room: s.who.room };
      }
      case 'me': {
        const me = cleanMe(f.me);
        if (!me) return null;
        const before = s.me;
        s.me = me;
        return { t: 'me', named: !!me.name && !(before && before.name), wiped: !!(before && before.name) && !me.name };
      }
      case 'reports': {
        s.reports = int(f.open);
        return { t: 'reports' };
      }
      case 'mod': {
        s.mod = {
          reports: arr(f.reports).slice(0, MAX_REPORTS).map((r) => {
            const m = isObj(r) ? cleanMsg(r.m) : null;
            return m ? { id: m.id, m, title: str(r.title), n: int(r.n), reasons: arr(r.reasons).slice(0, 20).map((x) => str(x, 200)).filter(Boolean), t: time(r.t) } : null;
          }).filter(Boolean),
          users: arr(f.users).slice(0, MAX_PEOPLE).filter((u) => isObj(u) && typeof u.uid === 'string').map((u) => ({ uid: u.uid, name: str(u.name) || null, muted: time(u.muted), banned: !!u.banned }))
        };
        return { t: 'mod' };
      }
      case 'ok':
      case 'err': {
        const re = str(f.re, 20), code = f.t === 'err' ? str(f.code, 30) || 'bad' : '';
        const ev = { t: f.t, re, code, wait: num(f.wait), until: num(f.until), room: str(f.room), req: null, lost: null };
        if (re === 'say' || (typeof f.cid === 'string' && s.pending.some((p) => p.cid === f.cid))) {
          // A refused message leaves the list; the page puts its text back into the box so nothing typed is lost.
          const i = typeof f.cid === 'string' ? s.pending.findIndex((p) => p.cid === f.cid) : s.pending.findIndex((p) => p.state === 'sending');
          if (i >= 0 && f.t === 'err') ev.lost = s.pending.splice(i, 1)[0];
          return ev;
        }
        ev.req = takeWaiting(s, typeof f.cid === 'string' ? f.cid : '', re);
        // A refused "more" does not say which room it was for (one is out at a time): nothing is loading any longer.
        if (re === 'more' && f.t === 'err') for (const log of Object.values(s.logs)) log.older = false;
        if (re === 'who') s.whoAsk = '';
        return ev;
      }
      default:
        return null;
    }
  }

  /** Drop the oldest messages of a long log; they can be loaded again from the top. Returns how many went. */
  function trimLog(log, max = MAX_LOG) {
    const extra = log.msgs.length - max;
    if (extra <= 0) return 0;
    log.msgs.splice(0, extra);
    log.more = true;
    return extra;
  }

  // ── Display ────────────────────────────────────────────────────────────
  /** Does m continue the block of prev (same author, close in time, same day, not a reply)? */
  function joins(prev, m, tz) {
    return !!prev && !!m.uid && prev.uid === m.uid && prev.name === m.name && !m.reply && m.t - prev.t <= GROUP_GAP && m.t >= prev.t && dayOf(prev.t, tz) === dayOf(m.t, tz);
  }
  /**
   * Messages → rows: { k: 'day', t } between days, { k: 'new' } above the first unread one, { k: 'msg', m, head }
   * (head: starts a block, so it carries the avatar and name), and { k: 'hid', n } for a run of messages by people
   * the reader hid. o: { tz, hide: { uid: … }, me: uid, newFrom: id }.
   */
  function groupMessages(msgs, o = {}) {
    const rows = [], hide = o.hide || {};
    let prev = null, day = '';
    for (const m of msgs) {
      if (m.uid && hide[m.uid] !== undefined && m.uid !== o.me) {
        const last = rows[rows.length - 1];
        if (last && last.k === 'hid') last.n++; else rows.push({ k: 'hid', n: 1, id: m.id });
        prev = null;
        continue;
      }
      const d = dayOf(m.t, o.tz);
      if (d !== day) { rows.push({ k: 'day', t: m.t, day: d }); day = d; prev = null; }
      if (o.newFrom && m.id === o.newFrom) { rows.push({ k: 'new' }); prev = null; }
      rows.push({ k: 'msg', m, head: !joins(prev, m, o.tz) });
      prev = m;
    }
    return rows;
  }

  /** What the box at the bottom is: 'wait' (no hello yet), 'guest', 'expired', 'banned', 'muted', 'readonly', 'closed' or 'ok'. */
  function composerState(s, room, now = Date.now()) {
    if (!s.known) return 'wait';
    if (s.auth === 'expired') return 'expired';
    if (s.auth !== 'ok' || !s.me) return 'guest';
    const admin = s.me.role === 'admin';
    if (s.me.banned) return 'banned';
    if (s.me.muted > now + s.skew) return 'muted';
    if (s.mode === 'readonly' && !admin) return 'readonly';
    if (room && room.closed && !admin) return 'closed';
    return 'ok';
  }
  /**
   * The actions offered on one message, in menu order: reply, copy, report, delete, hide, then the owner's
   * mute1 / mute24 / mute168 / ban / purge. A removed message keeps only what concerns its author.
   */
  function actionsFor(s, m, room, now = Date.now()) {
    const out = [], me = s.me, admin = !!me && me.role === 'admin', mine = !!me && m.uid === me.uid, gone = !!(m.del || m.hidden);
    if (!gone && composerState(s, room, now) === 'ok') out.push('reply');
    if (!gone) out.push('copy');
    if (!gone && me && !mine && s.auth === 'ok') out.push('report');
    if (!m.del && (mine || admin)) out.push('delete');
    if (!mine && m.uid) out.push('hide');
    if (admin && !mine && m.uid) out.push('mute1', 'mute24', 'mute168', 'ban', 'purge');
    return out;
  }
  /** What the reader may do with a room: { edit, close, reopen, remove }. Official rooms belong to the owner of the site. */
  function roomRights(s, room) {
    const me = s.me, admin = !!me && me.role === 'admin';
    const mine = !!me && room.kind !== 'official' && room.owner === me.uid;
    const can = admin || mine;
    return { edit: can, close: can && !room.closed, reopen: can && room.closed, remove: admin && room.kind !== 'official' };
  }

  const API = {
    PREFS_KEY, DRAFT_KEY, LIMITS, GROUP_GAP, MAX_LOG, MAX_BATCH, MAX_ROOMS, MAX_PEOPLE, STABLE_MS, RESERVED, ERR_CODES, ERRORS, PALETTE,
    cleanText, checkText, nameKey, checkName, nameWhy, checkTitle, checkTopic, count,
    tokenize, trimUrl, safeHref, clip,
    parts, dayOf, clock, fullTime, dayLabel, relTime, waitText, untilText,
    errorText, closeCode, backoff, settle, wsUrl, wsProtocols,
    avatarColor, initial, hash,
    roomTitle, roomTopic, sortRooms, filterRooms, parseHash, roomHash, pageTitle,
    isRoomId, table, emptyPrefs, migratePrefs, switchAccount, syncRead, unread, totalUnread, markRead, firstUnread,
    createState, roomById, reduce, say, ask, askWho, enter, rejoin, older, dropConnection, trimLog,
    joins, groupMessages, composerState, actionsFor, roomRights
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.MOLASTRIA_CHAT_CORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
