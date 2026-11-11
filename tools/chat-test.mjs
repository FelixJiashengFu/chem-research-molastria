// 讨论室的全部逻辑（deploy/chat.js 的 Hub）：node:sqlite 当存储，假连接当浏览器，时钟是假的，所以每一步都是确定的。
//   node --test tools/chat-test.mjs
// Worker 那一侧（/chat/ws 认出是谁、/chat/summary、举报邮件）在 tools/account-test.ts；
// 真的 workerd（Durable Object、WebSocket、D1）在 tools/chat-workerd-test.mjs，要先 npm ci --prefix deploy。
import test from 'node:test';
import assert from 'node:assert/strict';
import { Hub, OFFICIAL, addrKey, blockedWord, chatState, cleanLine, cleanName, cleanText, clip, invisible, keyOf, randomId, reservedName } from '../deploy/chat.js';

let DatabaseSync = null;
try { ({ DatabaseSync } = await import('node:sqlite')); } catch { /* Node 22.12 或更早没有（或要加 --experimental-sqlite） */ }
const db = DatabaseSync ? {} : { skip: '要 node:sqlite（Node 22.13 以上）' };

// ── 假的连接和一个小世界 ─────────────────────────────────────────────
class Sock {
  constructor() { this.sent = []; this.closed = null; this.att = undefined; this.broken = false; }
  send(s) {
    if (this.broken) throw new Error('this socket is dead');
    this.sent.push(s);
  }
  close(code, reason) { this.closed = [code, reason]; }
  serializeAttachment(v) { this.att = structuredClone(v); }
  deserializeAttachment() { return this.att === undefined ? null : structuredClone(this.att); }
  frames(t) { const all = this.sent.filter((s) => s !== 'pong').map((s) => JSON.parse(s)); return t ? all.filter((f) => f.t === t) : all; }
  last(t) { return this.frames(t).at(-1); }
  clear() { this.sent.length = 0; }
}
const HOUR = 3_600_000, DAY = 24 * HOUR;

function world(env = {}) {
  const sqlite = new DatabaseSync(':memory:');
  const w = { sqlite, env: { ...env }, t: Date.UTC(2026, 10, 11, 12), socks: new Set(), log: [], fail: null };
  w.sql = (q, ...p) => {
    if (w.fail && w.fail.test(q)) throw new Error('storage says no');
    w.log.push(q);
    return sqlite.prepare(q).all(...p);
  };
  w.tx = (fn) => {
    sqlite.exec('BEGIN');
    try { const out = fn(); sqlite.exec('COMMIT'); return out; } catch (e) { sqlite.exec('ROLLBACK'); throw e; }
  };
  /** What a wake after hibernation is: a new Hub over the same storage and the same sockets. */
  w.wake = () => { w.hub = new Hub({ sql: w.sql, tx: w.tx, sockets: () => [...w.socks], env: w.env, now: () => w.t }); return w.hub; };
  w.wake();
  w.tick = (ms) => { w.t += ms; };
  w.writes = () => w.log.filter((q) => /^(INSERT|UPDATE|DELETE)/.test(q));
  let n = 0;
  w.open = (who = {}) => {
    const ws = new Sock();
    w.socks.add(ws);
    w.hub.connect(ws, { uid: null, admin: false, auth: 'none', iph: `addr-${++n}`, ...who });
    return ws;
  };
  /** Sends one frame; → the frames this socket got back. */
  w.do = (ws, frame) => {
    const from = ws.sent.length;
    w.hub.message(ws, typeof frame === 'string' || frame instanceof ArrayBuffer ? frame : JSON.stringify(frame));
    return ws.sent.slice(from).map((s) => (s === 'pong' ? s : JSON.parse(s)));
  };
  /** A signed-in account, with a nickname when one is given. */
  w.user = (name, who = {}) => {
    const uid = who.uid || ((name || `anon${n}`).toLowerCase().replace(/[^a-z0-9]/g, '') + 'xxxxxxxxxxxx').slice(0, 12);
    const ws = w.open({ uid, auth: 'ok', ...who });
    ws.uid = uid;
    if (name) assert.equal(w.do(ws, { t: 'name', name }).at(-1).t, 'ok', `naming ${name}`);
    return ws;
  };
  w.admin = (name = 'Fe') => w.user(name, { admin: true });
  /** Posts after a pause long enough for every limit; → the message. */
  w.post = (ws, room, text, extra = {}) => {
    w.tick(5000);
    const got = w.do(ws, { t: 'say', room, text, ...extra }).find((f) => f.t === 'msg' || f.t === 'err');
    assert.equal(got.t, 'msg', `say "${text}": ${got.code}`);
    return got.m;
  };
  /** The platform's order when a browser leaves: the handler runs while the socket is still listed, then it is gone. */
  w.shut = (ws) => { w.hub.close(ws); w.socks.delete(ws); };
  w.rows = (q, ...p) => sqlite.prepare(q).all(...p);
  return w;
}
const code = (frames) => frames.find((f) => f.t === 'err')?.code;
const type = (frames, t) => frames.find((f) => f.t === t);

// ── 纯函数 ───────────────────────────────────────────────────────────
test('text: NFC, control characters and direction overrides go, tabs become spaces, at most two blank lines, counted in code points', () => {
  assert.deepEqual(cleanText('  hi\tthere \r\n\r\n\r\n\r\n\r\nend  \n'), { text: 'hi there\n\n\nend' });
  assert.deepEqual(cleanText('a\u0000b\u0007c\u202Edcba\u2066x\u2069\u200E\u200F\u200B\uFEFF'), { text: 'abcdcbax' });
  assert.deepEqual(cleanText('e\u0301'), { text: '\u00E9' }, 'NFC');
  assert.deepEqual(cleanText('一\u2028二\r三'), { text: '一\n二\n三' });
  assert.deepEqual(cleanText('line  \nnext   '), { text: 'line\nnext' });
  for (const empty of ['', '   ', '\n\n', '\u200B\u200B', '\u202E', '\u200D\uFE0F', '\u3164\u3164', '\u2800']) assert.deepEqual(cleanText(empty), { code: 'empty' }, JSON.stringify(empty));
  for (const bad of [undefined, null, 5, {}, ['a']]) assert.deepEqual(cleanText(bad), { code: 'bad' });
  assert.equal(cleanText('字'.repeat(2000)).text.length, 2000);
  assert.deepEqual(cleanText('字'.repeat(2001)), { code: 'long' });
  assert.equal([...cleanText('😀'.repeat(2000)).text].length, 2000, 'an emoji is one character, not two');
  assert.deepEqual(cleanText('😀'.repeat(2001)), { code: 'long' });
  assert.deepEqual(cleanText('x'.repeat(20000)), { code: 'long' });
  assert.equal(cleanText('a' + ' '.repeat(1990) + 'b\n' + ' '.repeat(5000)).text.length, 1992, 'spaces inside a line stay, at its end they go');
  assert.equal(cleanText('\uD800abc').text, '\uFFFDabc', 'a lone surrogate cannot be stored');
});

test('one-line fields, quotes, blocked words, ids, the switch', () => {
  assert.deepEqual(cleanLine('  量子\n化学   与\tDFT ', 30), { text: '量子 化学 与 DFT' });
  assert.deepEqual(cleanLine('x'.repeat(31), 30), { code: 'long' });
  assert.deepEqual(cleanLine(7, 30), { code: 'bad' });
  assert.equal(clip('a\n\nb   c', 140), 'a b c');
  assert.equal([...clip('字'.repeat(200), 80)].length, 80);
  assert.equal(clip('字'.repeat(200), 80).endsWith('…'), true);
  assert.equal(blockedWord('Buy CHEAP pills', { CHAT_BLOCK: 'spam, cheap pills ,' }), true);
  assert.equal(blockedWord('ｃｈｅａｐ pills', { CHAT_BLOCK: 'cheap' }), true, 'full-width letters do not get round it');
  assert.equal(blockedWord('fine', { CHAT_BLOCK: 'cheap' }), false);
  assert.equal(blockedWord('anything', { CHAT_BLOCK: '' }), false);
  assert.equal(blockedWord('anything', {}), false);
  for (let i = 0; i < 50; i++) assert.match(randomId(12), /^[a-z0-9]{12}$/);
  assert.notEqual(randomId(12), randomId(12));
  assert.deepEqual(['on', 'ON', 'readonly', 'off', '', undefined, 'nonsense'].map((s) => chatState({ CHAT_STATE: s })), ['on', 'on', 'readonly', 'off', 'on', 'on', 'on']);
});

test('nicknames: 2–20 letters, digits, spaces and _ - . ; the key ignores case, width and spaces; the site’s own names are reserved', () => {
  assert.equal(cleanName('  Alice   Liu '), 'Alice Liu');
  assert.equal(cleanName('小明_2.0-a'), '小明_2.0-a');
  assert.equal(cleanName('José'), 'José');
  assert.equal(cleanName('ab'), 'ab');
  assert.equal(cleanName('字'.repeat(20)), '字'.repeat(20));
  for (const bad of ['a', '字', '字'.repeat(21), 'a<b>', 'x@y.z', '_ab', '.ab', ' ', 'hi!', '😀😀', 'a/b', '\u3164\u3164\u3164', 7, null, undefined]) assert.equal(cleanName(bad), null, JSON.stringify(bad));
  assert.equal(cleanName('a\u202Eb'), 'ab', 'the override is stripped, the rest is a fine name');
  assert.equal(keyOf('Alice Liu'), keyOf('ａｌｉｃｅ\u3000ｌｉｕ'));
  assert.equal(keyOf('ALICELIU'), 'aliceliu');
  for (const name of ['站长', '站 长', '管理员小王', 'Admin', 'ad.min', 'A_D-M.I.N', 'MolAstria官方', 'System', 'Moderator1', '客服', '系统消息', 'official', 'Owner']) assert.equal(reservedName(keyOf(name)), true, name);
  for (const name of ['Alice', '化学家', 'sysop', 'adm']) assert.equal(reservedName(keyOf(name)), false, name);
});

// ── 连上 ─────────────────────────────────────────────────────────────
test('hello: a guest, a signed-in account, an admin, an expired sign-in; the official rooms in both languages', db, () => {
  const w = world();
  const guest = w.open();
  const h = guest.frames()[0];
  assert.deepEqual([h.t, h.v, h.state, h.auth, h.me, h.online, h.now], ['hello', 1, 'on', 'none', null, 1, w.t]);
  assert.deepEqual(h.limits, { text: 2000, name: [2, 20], title: [2, 30], topic: 120, rooms: 3 });
  assert.equal('reports' in h, false);
  assert.deepEqual(h.rooms.map((r) => r.id), ['lobby', 'qc', 'mlip', 'software', 'papers', 'study', 'site']);
  assert.deepEqual(h.rooms.map((r) => r.id), OFFICIAL.map((o) => o[0]));
  assert.deepEqual(h.rooms[0], { id: 'lobby', kind: 'official', title: '大厅', title_en: 'Lobby', topic: OFFICIAL[0][3], topic_en: OFFICIAL[0][4], owner: null, owner_name: null, n: 0, last: w.t, online: 0, closed: false });
  for (const r of h.rooms) assert.ok(r.title && r.title_en && r.topic && r.topic_en && [...r.topic].length <= 120 && r.topic_en.length <= 120, r.id);

  const alice = w.open({ uid: 'alice0000001', auth: 'ok' });
  assert.deepEqual([alice.last('hello').auth, alice.last('hello').me, alice.last('hello').online], ['ok', { uid: 'alice0000001', name: null, role: 'user', muted: 0, banned: false, rooms: 0 }, 2]);
  const boss = w.open({ uid: 'boss00000001', auth: 'ok', admin: true });
  assert.deepEqual([boss.last('hello').me.role, boss.last('hello').reports], ['admin', 0]);
  assert.equal(w.open({ auth: 'expired' }).last('hello').auth, 'expired');
  // What the Worker says is checked again: nothing but a plain id becomes an account, and no account means no admin.
  for (const who of [null, 'x', { uid: '../etc', admin: true }, { uid: 5, admin: true }, { uid: '', admin: true }, { admin: true }]) {
    const ws = new Sock();
    w.socks.add(ws);
    w.hub.connect(ws, who);
    assert.deepEqual([ws.last('hello').me, ws.last('hello').auth, 'reports' in ws.last('hello'), ws.att.a], [null, 'none', false, 0], JSON.stringify(who));
  }
  w.env.CHAT_ROOMS_PER_USER = '5';
  assert.equal(w.open().last('hello').limits.rooms, 5);
});

test('the official rooms are written once: waking up again writes nothing', db, () => {
  const w = world();
  assert.deepEqual(w.log, [], 'storage is not touched before something needs it');
  w.hub.ready();
  assert.equal(w.writes().length, 7);
  w.log.length = 0;
  w.wake().ready();
  w.wake().ready();
  w.hub.ready();
  assert.deepEqual(w.writes(), []);
  // A title changed in the code is put right at the next wake (here: one changed behind its back).
  w.sqlite.exec("UPDATE rooms SET title = '旧名字', closed = 1 WHERE id = 'qc'");
  w.wake().ready();
  assert.deepEqual(w.rows("SELECT title, closed FROM rooms WHERE id = 'qc'"), [{ title: '量子化学与 DFT', closed: 1 }].map((r) => Object.assign(Object.create(null), r)));
  assert.equal(w.writes().length, 1);
});

// ── 看 ───────────────────────────────────────────────────────────────
test('join, presence, who: an account counts once however many tabs, every guest counts', db, () => {
  const w = world();
  const g1 = w.open(), g2 = w.open(), alice = w.user('Alice'), alice2 = w.user(null, { uid: alice.uid }), bob = w.user('Bob'), shy = w.user(null);
  assert.equal(code(w.do(g1, { t: 'join', room: 'nowhere' })), 'no-room');
  assert.equal(code(w.do(g1, { t: 'join', room: 7 })), 'no-room');
  assert.equal(code(w.do(g1, { t: 'join' })), 'no-room');
  assert.deepEqual(w.do(g1, { t: 'join', room: 'lobby' }), [{ t: 'room', room: 'lobby', msgs: [], more: false, online: 1 }]);
  g1.clear();
  assert.equal(type(w.do(alice, { t: 'join', room: 'lobby' }), 'room').online, 2);
  assert.deepEqual(g1.frames(), [{ t: 'pres', room: 'lobby', online: 2 }], 'the one already there is told; the one who came in got it with the room');
  w.do(alice2, { t: 'join', room: 'lobby' });
  assert.equal(g1.last('pres').online, 2, 'a second tab of the same account');
  w.do(g2, { t: 'join', room: 'lobby' });
  w.do(bob, { t: 'join', room: 'lobby' });
  w.do(shy, { t: 'join', room: 'lobby' });
  assert.equal(g1.last('pres').online, 5);
  assert.equal(w.open().last('hello').online, 6, 'two guests and this new one; Alice (once), Bob and the account without a name');
  const who = w.do(g1, { t: 'who', room: 'lobby' })[0];
  assert.deepEqual(who, { t: 'who', room: 'lobby', users: [{ uid: alice.uid, name: 'Alice', role: 'user' }, { uid: bob.uid, name: 'Bob', role: 'user' }], guests: 3 });
  assert.equal(code(w.do(g1, { t: 'who', room: 'x' })), 'no-room');
  // Moving to another room: both rooms hear about it; joining the same room again is only a fresh copy.
  g1.clear();
  assert.equal(type(w.do(bob, { t: 'join', room: 'qc' }), 'room').online, 1);
  assert.deepEqual(g1.frames(), [{ t: 'pres', room: 'lobby', online: 4 }]);
  g1.clear();
  assert.equal(w.do(bob, { t: 'join', room: 'qc' }).length, 1);
  assert.deepEqual(g1.frames(), []);
  // Leaving: the socket is still listed while the handler runs, and must not be counted.
  w.shut(g2);
  assert.deepEqual(g1.last('pres'), { t: 'pres', room: 'lobby', online: 3 });
  w.shut(alice2);
  assert.equal(g1.last('pres').online, 3, 'Alice still has a tab open');
  w.shut(alice);
  assert.equal(g1.last('pres').online, 2);
  w.hub.close(alice); // told twice (close, then error): nothing more happens
  assert.equal(g1.frames('pres').length, 3);
  assert.equal(type(w.open().frames(), 'hello').rooms.find((r) => r.id === 'lobby').online, 2);
  // An admin is marked in the list, and comes first.
  const boss = w.admin();
  w.do(boss, { t: 'join', room: 'qc' });
  assert.deepEqual(w.do(g1, { t: 'who', room: 'qc' })[0].users.map((u) => [u.name, u.role]), [['Fe', 'admin'], ['Bob', 'user']]);
});

test('reading back: the last 50, then 50 older at a time', db, () => {
  const w = world();
  const alice = w.user('Alice'), guest = w.open();
  for (let i = 1; i <= 120; i++) w.post(alice, 'lobby', `message ${i}`);
  const room = w.do(guest, { t: 'join', room: 'lobby' })[0];
  assert.deepEqual([room.msgs.length, room.more, room.msgs[0].text, room.msgs[49].text], [50, true, 'message 71', 'message 120']);
  assert.deepEqual(room.msgs[49], { id: 120, room: 'lobby', uid: alice.uid, name: 'Alice', role: 'user', text: 'message 120', t: w.t, reply: null });
  const older = w.do(guest, { t: 'more', room: 'lobby', before: room.msgs[0].id })[0];
  assert.deepEqual([older.t, older.room, older.msgs.length, older.more, older.msgs[0].text, older.msgs[49].text], ['older', 'lobby', 50, true, 'message 21', 'message 70']);
  const oldest = w.do(guest, { t: 'more', room: 'lobby', before: older.msgs[0].id })[0];
  assert.deepEqual([oldest.msgs.length, oldest.more, oldest.msgs[0].text], [20, false, 'message 1']);
  assert.deepEqual(w.do(guest, { t: 'more', room: 'lobby', before: 1 })[0], { t: 'older', room: 'lobby', msgs: [], more: false });
  for (const before of [0, -1, 1.5, '71', null, undefined, 2 ** 60]) assert.equal(code(w.do(guest, { t: 'more', room: 'lobby', before })), 'bad', String(before));
  assert.equal(code(w.do(guest, { t: 'more', room: 'gone', before: 5 })), 'no-room');
  // The copy kept in memory is the same as what storage gives after a wake.
  w.wake();
  assert.deepEqual(w.do(guest, { t: 'join', room: 'lobby' })[0].msgs, room.msgs);
  // Exactly 50 messages: nothing more to fetch.
  for (let i = 1; i <= 50; i++) w.post(alice, 'qc', `q${i}`);
  assert.deepEqual([w.do(guest, { t: 'join', room: 'qc' })[0].more, w.do(alice, { t: 'join', room: 'qc' })[0].msgs.length], [false, 50]);
  w.post(alice, 'qc', 'q51');
  assert.deepEqual([w.do(guest, { t: 'join', room: 'qc' })[0].more, w.do(guest, { t: 'join', room: 'qc' })[0].msgs[0].text], [true, 'q2']);
});

// ── 发言 ─────────────────────────────────────────────────────────────
test('say: who may, what comes back to whom, and what it costs in writes', db, () => {
  const w = world();
  const guest = w.open(), alice = w.user('Alice'), bob = w.user('Bob'), nameless = w.user(null), far = w.open();
  for (const ws of [guest, alice, bob]) w.do(ws, { t: 'join', room: 'lobby' });
  w.do(far, { t: 'join', room: 'qc' });
  assert.deepEqual(w.do(guest, { t: 'say', room: 'lobby', text: 'hi', cid: 'c0' }), [{ t: 'err', re: 'say', code: 'signin', cid: 'c0' }]);
  assert.equal(code(w.do(nameless, { t: 'say', room: 'lobby', text: 'hi' })), 'name-needed');
  for (const ws of [guest, bob, far, nameless]) ws.clear();
  w.log.length = 0;
  const mine = w.do(alice, { t: 'say', room: 'lobby', text: '  你好\u202E，世界  ', cid: 'c1' });
  const m = { id: 1, room: 'lobby', uid: alice.uid, name: 'Alice', role: 'user', text: '你好，世界', t: w.t, reply: null };
  assert.deepEqual(mine, [{ t: 'msg', m, cid: 'c1' }]);
  assert.deepEqual(bob.frames(), [{ t: 'msg', m }], 'no cid on anyone else’s copy');
  assert.deepEqual(guest.frames(), [{ t: 'msg', m }]);
  assert.deepEqual(far.frames(), [{ t: 'act', room: 'lobby', last: w.t, n: 1 }], 'in another room: only that something was said');
  assert.deepEqual(nameless.frames(), [{ t: 'act', room: 'lobby', last: w.t, n: 1 }], 'in no room at all: the same');
  assert.deepEqual(w.writes().map((q) => q.split(' ').slice(0, 3).join(' ')), ['INSERT INTO msgs', 'UPDATE rooms SET'], 'one message: its row and the room’s last time, nothing per user');
  // Refusals, each with the cid so the page can mark the right bubble.
  w.tick(5000);
  const no = (frame) => code(w.do(alice, { t: 'say', room: 'lobby', cid: 'c2', ...frame }));
  assert.equal(no({ room: 'nowhere', text: 'x' }), 'no-room');
  assert.equal(no({ room: ['lobby'], text: 'x' }), 'no-room');
  assert.equal(no({ text: '   \n ' }), 'empty');
  assert.equal(no({ text: '字'.repeat(2001) }), 'long');
  assert.equal(no({ text: 5 }), 'bad');
  assert.equal(no({}), 'bad');
  assert.equal(no({ text: 'x', cid: 'c'.repeat(41) }), 'bad');
  assert.equal(no({ text: 'x', cid: 5 }), 'bad');
  assert.equal(no({ text: 'x', reply: 999 }), 'no-msg');
  assert.equal(no({ text: 'x', reply: '1' }), 'no-msg');
  assert.equal(w.do(alice, { t: 'say', room: 'lobby', text: 'x', reply: 999, cid: 'c9' })[0].cid, 'c9');
  assert.equal(w.rows('SELECT COUNT(*) AS n FROM msgs')[0].n, 1, 'none of those was stored');
  assert.equal(w.do(alice, { t: 'say', room: 'lobby', text: 'no cid' })[0].cid, undefined, 'a cid is optional');
  // A reply quotes one line of at most 80 characters; a reply across rooms is refused.
  const long = w.post(bob, 'lobby', '第一行\n第二行 ' + '长'.repeat(200));
  const answer = w.post(alice, 'lobby', '同意', { reply: long.id });
  assert.deepEqual([answer.reply.id, answer.reply.name, [...answer.reply.text].length, answer.reply.text.startsWith('第一行 第二行 长')], [long.id, 'Bob', 80, true]);
  w.tick(5000);
  assert.equal(code(w.do(alice, { t: 'say', room: 'qc', text: 'x', reply: long.id })), 'no-msg');
  // Speaking into a room one is not looking at still confirms to the speaker (and is an "act" for nobody twice).
  alice.clear();
  w.tick(5000);
  assert.deepEqual(w.do(alice, { t: 'say', room: 'qc', text: 'over here', cid: 'c3' }).map((f) => [f.t, f.cid]), [['msg', 'c3']]);
  assert.equal(far.last('msg').m.text, 'over here');
  // Blocked words are a setting; admins are not held to it.
  w.env.CHAT_BLOCK = 'casino,免费领取';
  w.tick(5000);
  assert.equal(no({ text: 'best CASINO here' }), 'word');
  assert.equal(no({ text: '点击免费领取' }), 'word');
  const boss = w.admin();
  assert.equal(w.post(boss, 'lobby', 'the word casino is blocked').role, 'admin');
});

test('say: 1.5 s between messages, 15 a minute, 300 a day, no repeating oneself; refusals write nothing', db, () => {
  const w = world();
  const alice = w.user('Alice');
  const say = (text) => w.do(alice, { t: 'say', room: 'lobby', text, cid: 'k' })[0];
  assert.equal(say('one').t, 'msg');
  w.log.length = 0;
  assert.deepEqual(say('two'), { t: 'err', re: 'say', code: 'slow', wait: 2, cid: 'k' });
  w.tick(700);
  assert.deepEqual([say('two').code, say('two').wait], ['slow', 1]);
  w.tick(800);
  assert.equal(say('two').t, 'msg');
  w.tick(1500);
  assert.equal(say('two').code, 'dup', 'the same words again within a minute');
  assert.equal(say(' two ').code, 'dup', 'compared after cleaning');
  assert.equal(say('three').t, 'msg');
  w.tick(1500);
  assert.equal(say('two').t, 'msg', 'only the message just before counts');
  w.tick(61_000);
  assert.equal(say('two').t, 'msg', 'and only for a minute');
  // 15 in a minute: the 16th waits until the first of them is a minute old.
  w.tick(120_000);
  const start = w.t;
  for (let i = 0; i < 15; i++) { assert.equal(say(`burst ${i}`).t, 'msg'); w.tick(2000); }
  const flood = say('one too many');
  assert.deepEqual([flood.code, flood.wait], ['flood', (start + 60_000 - w.t) / 1000]);
  assert.equal(w.writes().filter((q) => !/^(INSERT INTO msgs|UPDATE rooms SET last)/.test(q)).length, 0, 'limits live in memory');
  const stored = w.rows('SELECT COUNT(*) AS n FROM msgs')[0].n;
  assert.equal(w.writes().length, 2 * (stored - 1), 'and a refused message writes nothing');
  w.tick(flood.wait * 1000);
  assert.equal(say('now it fits').t, 'msg');
  // 300 in a day.
  const w2 = world();
  const bob = w2.user('Bob');
  const first = w2.t + 5000;
  for (let i = 0; i < 300; i++) w2.post(bob, 'lobby', `m${i}`);
  w2.tick(5000);
  const day = w2.do(bob, { t: 'say', room: 'lobby', text: 'm300' })[0];
  assert.deepEqual([day.code, day.wait], ['flood', (first + DAY - w2.t) / 1000]);
  w2.tick(day.wait * 1000);
  assert.equal(w2.do(bob, { t: 'say', room: 'lobby', text: 'm300' })[0].t, 'msg');
  // Another account is not affected by any of this.
  const carol = w.user('Carol');
  assert.equal(w.do(carol, { t: 'say', room: 'lobby', text: 'now it fits' })[0].t, 'msg');
});

// ── 昵称 ─────────────────────────────────────────────────────────────
test('nickname: rules, one of each, a change once a day, shown on old messages too', db, () => {
  const w = world();
  const alice = w.user(null, { uid: 'alice0000001' }), tab = w.open({ uid: 'alice0000001', auth: 'ok' }), bob = w.user(null, { uid: 'bob000000001' }), guest = w.open();
  const name = (ws, n) => w.do(ws, { t: 'name', name: n, cid: 'n1' });
  assert.deepEqual(name(guest, 'Ghost'), [{ t: 'err', re: 'name', code: 'signin', cid: 'n1' }]);
  for (const bad of ['a', '字'.repeat(21), 'no<html>', '', 5, null, '管理员', 'Admin Bob', 'MolAstria', 'ad-min', '系统', 'official_account']) assert.equal(code(name(alice, bad)), 'name-bad', String(bad));
  tab.clear();
  const done = name(alice, ' Alice  Liu ');
  const me = { uid: 'alice0000001', name: 'Alice Liu', role: 'user', muted: 0, banned: false, rooms: 0 };
  assert.deepEqual(done, [{ t: 'me', me }, { t: 'ok', re: 'name', cid: 'n1' }]);
  assert.deepEqual(tab.frames(), [{ t: 'me', me }], 'the other tab learns it too');
  for (const taken of ['Alice Liu', 'alice liu', 'ALICELIU', 'ａｌｉｃｅ ｌｉｕ', 'A l i c e L i u']) assert.equal(code(name(bob, taken)), 'name-taken', taken);
  assert.equal(type(name(bob, 'Bob'), 'ok').re, 'name');
  assert.equal(type(name(alice, 'Alice Liu'), 'ok').re, 'name', 'the name one already has: fine, and not a change');
  // The first name is free; the next change waits a day.
  const wait = name(alice, 'Alice2');
  assert.deepEqual(wait, [{ t: 'err', re: 'name', code: 'name-wait', wait: 86400, cid: 'n1' }]);
  w.tick(DAY - 60_000);
  assert.equal(name(alice, 'Alice2')[0].wait, 60);
  assert.equal(code(name(alice, 'Bob')), 'name-wait', 'waiting comes before "taken"');
  w.tick(60_000);
  assert.equal(code(name(alice, 'bob')), 'name-taken');
  const m = w.post(bob, 'lobby', 'who am I');
  assert.equal(type(name(alice, 'Alice2'), 'ok').re, 'name');
  assert.equal(type(name(bob, 'Alice Liu'), 'ok').re, 'name', 'the old name is free again (Bob’s day has passed too)');
  assert.equal(w.do(guest, { t: 'join', room: 'lobby' })[0].msgs.find((x) => x.id === m.id).name, 'Alice Liu', 'names are looked up when a room is read');
  // An admin may carry a reserved name; blocked words apply to names.
  const boss = w.user(null, { uid: 'boss00000001', admin: true });
  assert.equal(type(name(boss, '站长 Fe'), 'ok').re, 'name');
  w.env.CHAT_BLOCK = 'casino';
  assert.equal(code(name(w.user(null, { uid: 'spam00000001' }), 'Casino King')), 'name-bad');
  assert.deepEqual(w.rows('SELECT uid, name, key, role FROM users ORDER BY uid').map((r) => ({ ...r })), [
    { uid: 'alice0000001', name: 'Alice2', key: 'alice2', role: 'user' }, { uid: 'bob000000001', name: 'Alice Liu', key: 'aliceliu', role: 'user' }, { uid: 'boss00000001', name: '站长 Fe', key: '站长fe', role: 'admin' }
  ]);
});

// ── 删除 ─────────────────────────────────────────────────────────────
test('del: one’s own, or anyone’s for an admin; the text is gone from storage, from the room and from quotes', db, () => {
  const w = world();
  const alice = w.user('Alice'), bob = w.user('Bob'), boss = w.admin(), guest = w.open();
  for (const ws of [alice, bob, guest]) w.do(ws, { t: 'join', room: 'lobby' });
  const a = w.post(alice, 'lobby', 'alice secret one'), b = w.post(bob, 'lobby', 'bob secret two'), q = w.post(bob, 'lobby', 'quoting', { reply: a.id });
  assert.equal(q.reply.text, 'alice secret one');
  assert.deepEqual(w.do(guest, { t: 'del', id: a.id }), [{ t: 'err', re: 'del', code: 'signin' }]);
  assert.equal(code(w.do(bob, { t: 'del', id: a.id })), 'forbidden');
  assert.equal(code(w.do(bob, { t: 'del', id: 999 })), 'no-msg');
  for (const id of [0, -1, '1', null, 1.5, undefined]) assert.equal(code(w.do(bob, { t: 'del', id })), 'bad');
  guest.clear();
  const tomb = { id: a.id, room: 'lobby', uid: alice.uid, name: 'Alice', role: 'user', text: '', t: a.t, reply: null, del: 1 };
  assert.deepEqual(w.do(alice, { t: 'del', id: a.id, cid: 'd1' }), [{ t: 'upd', m: tomb }, { t: 'ok', re: 'del', id: a.id, cid: 'd1' }]);
  assert.deepEqual(guest.frames(), [{ t: 'upd', m: tomb }]);
  assert.deepEqual(w.do(alice, { t: 'del', id: a.id }), [{ t: 'ok', re: 'del', id: a.id }], 'again: fine, nothing happens');
  guest.clear();
  assert.equal(type(w.do(boss, { t: 'del', id: b.id }), 'ok').id, b.id);
  assert.deepEqual([guest.frames()[0].m.del, guest.frames()[0].m.text], [2, ''], 'deleted by an admin');
  assert.deepEqual(w.rows('SELECT id, text, del FROM msgs ORDER BY id').map((r) => ({ ...r })), [{ id: 1, text: '', del: 1 }, { id: 2, text: '', del: 2 }, { id: 3, text: 'quoting', del: 0 }]);
  const again = w.do(guest, { t: 'join', room: 'lobby' })[0];
  assert.deepEqual(again.msgs.map((m) => [m.text, m.del, m.reply?.text]), [['', 1, undefined], ['', 2, undefined], ['quoting', undefined, '']]);
  assert.equal(JSON.stringify(again).includes('secret'), false);
  assert.equal(again.msgs.length, 3, 'the place of a deleted message stays');
  assert.equal(w.open().last('hello').rooms[0].n, 3, 'and the room’s count is of messages ever posted');
});

// ── 举报 ─────────────────────────────────────────────────────────────
test('report: three accounts hide a message until an admin looks; keep brings it back for good, delete removes it', db, () => {
  const w = world();
  const troll = w.user('Troll'), boss = w.admin(), guest = w.open(), nameless = w.user(null);
  const fans = ['Ann', 'Ben', 'Cat', 'Dan'].map((n) => w.user(n));
  for (const ws of [guest, troll]) w.do(ws, { t: 'join', room: 'lobby' });
  const bad = w.post(troll, 'lobby', 'rude words here'), quote = w.post(fans[0], 'lobby', 'that was rude', { reply: bad.id });
  assert.equal(quote.reply.text, 'rude words here');
  assert.equal(code(w.do(guest, { t: 'report', id: bad.id })), 'signin');
  assert.equal(code(w.do(nameless, { t: 'report', id: bad.id })), 'name-needed');
  assert.equal(code(w.do(troll, { t: 'report', id: bad.id })), 'self');
  assert.equal(code(w.do(fans[0], { t: 'report', id: 999 })), 'no-msg');
  assert.equal(code(w.do(fans[0], { t: 'report', id: 'x' })), 'bad');
  assert.equal(code(w.do(fans[0], { t: 'report', id: bad.id, reason: 5 })), 'bad');
  boss.clear(); guest.clear();
  assert.deepEqual(w.do(fans[0], { t: 'report', id: bad.id, reason: ' insulting\nme ', cid: 'r1' }), [{ t: 'ok', re: 'report', id: bad.id, cid: 'r1' }]);
  assert.deepEqual(boss.frames(), [{ t: 'reports', open: 1 }], 'the admin’s badge');
  assert.deepEqual(w.do(fans[0], { t: 'report', id: bad.id }), [{ t: 'ok', re: 'report', id: bad.id }], 'the same account again: thanked, not counted');
  w.do(fans[1], { t: 'report', id: bad.id, reason: 'x'.repeat(500) });
  assert.deepEqual([guest.frames().length, boss.frames().length], [0, 1], 'two reports: nothing to see yet, and still one reported message');
  w.do(fans[2], { t: 'report', id: bad.id });
  const hidden = { id: bad.id, room: 'lobby', uid: troll.uid, name: 'Troll', role: 'user', text: '', t: bad.t, reply: null, hidden: true };
  assert.deepEqual(guest.frames(), [{ t: 'upd', m: hidden }]);
  assert.deepEqual(troll.last('upd'), { t: 'upd', m: hidden });
  const view = w.do(guest, { t: 'join', room: 'lobby' })[0];
  assert.deepEqual(view.msgs.map((m) => [m.text, m.hidden, m.reply?.text]), [['', true, undefined], ['that was rude', undefined, '']]);
  assert.equal(JSON.stringify([view, w.hub.summary(), w.do(boss, { t: 'join', room: 'lobby' })]).includes('rude words'), false, 'not in a room, a quote or the summary, for an admin’s room view either');
  assert.deepEqual(w.hub.pending(), { reports: 1 });
  assert.equal(w.open({ uid: 'boss20000001', auth: 'ok', admin: true }).last('hello').reports, 1);
  // The admin's list has the real text, the reasons, how many reported.
  const list = w.do(boss, { t: 'mod', op: 'list' })[0];
  assert.deepEqual(list.reports, [{ id: bad.id, m: { ...hidden, text: 'rude words here' }, title: '大厅', n: 3, reasons: ['insulting me', 'x'.repeat(199) + '…'], t: w.t }]);
  assert.deepEqual(list.users, []);
  assert.equal(code(w.do(fans[0], { t: 'mod', op: 'list' })), 'forbidden');
  assert.equal(code(w.do(guest, { t: 'mod', op: 'list' })), 'forbidden');
  // Keep: back for everyone, and later reports cannot hide it again.
  guest.clear(); boss.clear();
  assert.deepEqual(type(w.do(boss, { t: 'mod', op: 'resolve', id: bad.id, action: 'keep' }), 'ok'), { t: 'ok', re: 'mod', op: 'resolve' });
  assert.deepEqual(guest.frames(), [{ t: 'upd', m: { ...bad } }]);
  assert.deepEqual(boss.frames('reports'), [{ t: 'reports', open: 0 }]);
  assert.equal(type(w.do(fans[3], { t: 'report', id: bad.id }), 'ok').re, 'report');
  assert.deepEqual([w.rows('SELECT COUNT(*) AS n FROM reports WHERE open = 1')[0].n, w.rows('SELECT hidden, kept FROM msgs WHERE id = ?', bad.id)[0].kept], [0, 1]);
  assert.equal(w.do(guest, { t: 'join', room: 'lobby' })[0].msgs[0].text, 'rude words here');
  // Delete: gone as "deleted by an admin", its reports with it.
  const worse = w.post(troll, 'lobby', 'worse words');
  for (const f of fans.slice(0, 3)) w.do(f, { t: 'report', id: worse.id });
  assert.equal(guest.last('upd').m.hidden, true);
  assert.equal(code(w.do(boss, { t: 'mod', op: 'resolve', id: worse.id, action: 'burn' })), 'bad');
  assert.equal(code(w.do(boss, { t: 'mod', op: 'resolve', id: 999, action: 'keep' })), 'no-msg');
  w.do(boss, { t: 'mod', op: 'resolve', id: worse.id, action: 'delete' });
  assert.deepEqual([guest.last('upd').m.del, guest.last('upd').m.text, guest.last('upd').m.hidden], [2, '', undefined]);
  assert.deepEqual(w.rows('SELECT text, del, hidden FROM msgs WHERE id = ?', worse.id).map((r) => ({ ...r })), [{ text: '', del: 2, hidden: 0 }]);
  assert.deepEqual([w.hub.pending().reports, w.do(boss, { t: 'mod', op: 'list' })[0].reports.length, boss.last('reports').open], [0, 0, 0]);
  assert.equal(code(w.do(fans[3], { t: 'report', id: worse.id })), 'no-msg', 'a deleted message cannot be reported');
  // An author who deletes a reported message takes the reports with it.
  const third = w.post(troll, 'lobby', 'third try');
  w.do(fans[0], { t: 'report', id: third.id });
  assert.equal(boss.last('reports').open, 1);
  w.do(troll, { t: 'del', id: third.id });
  assert.equal(boss.last('reports').open, 0);
  // Three accounts cannot silence the admin.
  const word = w.post(boss, 'lobby', 'please be kind');
  for (const f of fans.slice(0, 3)) w.do(f, { t: 'report', id: word.id });
  assert.deepEqual([w.rows('SELECT hidden FROM msgs WHERE id = ?', word.id)[0].hidden, w.hub.pending().reports], [0, 1]);
});

test('report: 20 a day per account', db, () => {
  const w = world();
  const poster = w.user('Poster'), keen = w.user('Keen');
  const ids = [];
  for (let i = 0; i < 22; i++) ids.push(w.post(poster, 'lobby', `post ${i}`).id);
  for (const id of ids.slice(0, 20)) assert.equal(w.do(keen, { t: 'report', id })[0].t, 'ok');
  assert.deepEqual(w.do(keen, { t: 'report', id: ids[20], cid: 'x' }), [{ t: 'err', re: 'report', code: 'reports-max', cid: 'x' }]);
  assert.equal(w.do(keen, { t: 'report', id: ids[0] })[0].t, 'ok', 'one already made is still acknowledged');
  w.wake();
  assert.equal(code(w.do(keen, { t: 'report', id: ids[20] })), 'reports-max', 'counted in storage, so a sleep does not reset it');
  w.tick(DAY + 1);
  assert.equal(w.do(keen, { t: 'report', id: ids[20] })[0].t, 'ok');
});

// ── 房间 ─────────────────────────────────────────────────────────────
test('rooms: opening one’s own (three at most, one every ten minutes), editing, closing, removing', db, () => {
  const w = world({ CHAT_USER_ROOMS: '5' });
  const alice = w.user('Alice'), bob = w.user('Bob'), boss = w.admin(), guest = w.open(), nameless = w.user(null);
  const mk = (ws, title, topic) => w.do(ws, { t: 'mkroom', title, topic, cid: 'm1' });
  assert.equal(code(mk(guest, '访客的房间')), 'signin');
  assert.equal(code(mk(nameless, '没名字的房间')), 'name-needed');
  for (const bad of ['x', '字'.repeat(31), '', '   ', 5, null, undefined]) assert.equal(code(mk(alice, bad)), 'title-bad', String(bad));
  assert.equal(code(mk(alice, '好房间', '题'.repeat(121))), 'long');
  assert.equal(code(mk(alice, '好房间', 5)), 'bad');
  for (const taken of ['大厅', 'lobby', 'LOBBY', 'Quantum Chemistry  &  DFT', '量子化学与DFT']) assert.equal(code(mk(alice, taken)), 'title-taken', taken);
  guest.clear();
  const made = mk(alice, '  过渡态 搜索  ', ' NEB、dimer\n和 IRC ');
  const id = type(made, 'ok').room;
  assert.match(id, /^u[a-z0-9]{8}$/);
  assert.deepEqual(made.map((f) => f.t), ['rooms', 'me', 'ok']);
  assert.deepEqual([type(made, 'me').me.rooms, type(made, 'ok')], [1, { t: 'ok', re: 'mkroom', room: id, cid: 'm1' }]);
  const room = { id, kind: 'user', title: '过渡态 搜索', title_en: null, topic: 'NEB、dimer 和 IRC', topic_en: null, owner: alice.uid, owner_name: 'Alice', n: 0, last: w.t, online: 0, closed: false };
  assert.deepEqual(guest.frames(), [{ t: 'rooms', rooms: [...guest.frames()[0].rooms.slice(0, 7), room] }], 'everyone gets the new list: the official rooms first');
  assert.deepEqual(mk(alice, '第二个房间'), [{ t: 'err', re: 'mkroom', code: 'room-wait', wait: 600, cid: 'm1' }]);
  w.wake();
  w.tick(599_000);
  assert.equal(mk(alice, '第二个房间')[0].wait, 1, 'the wait survives a sleep');
  w.tick(1000);
  assert.equal(code(mk(alice, '过渡态搜索')), 'title-taken');
  const second = type(mk(alice, '第二个房间'), 'ok').room;
  w.tick(600_000);
  const third = type(mk(alice, '第三个房间'), 'ok').room;
  w.tick(600_000);
  assert.equal(code(mk(alice, '第四个房间')), 'rooms-max');
  // Editing: the owner or an admin; an official room only by an admin, and only open/closed.
  const ed = (ws, frame) => w.do(ws, { t: 'edroom', ...frame });
  assert.equal(code(ed(bob, { room: id, title: '抢来的房间' })), 'forbidden');
  assert.equal(code(ed(guest, { room: id, closed: true })), 'signin');
  assert.equal(code(ed(alice, { room: 'lobby', closed: true })), 'forbidden');
  assert.equal(code(ed(alice, { room: 'nowhere', closed: true })), 'no-room');
  assert.equal(code(ed(alice, { room: id })), 'bad');
  assert.equal(code(ed(alice, { room: id, closed: 'yes' })), 'bad');
  assert.equal(code(ed(alice, { room: id, title: 'x' })), 'title-bad');
  assert.equal(code(ed(alice, { room: id, title: '第二个房间' })), 'title-taken');
  assert.equal(code(ed(alice, { room: id, topic: '题'.repeat(121) })), 'long');
  assert.equal(type(ed(alice, { room: id, title: '过渡态搜索' }), 'ok').room, id, 'its own title, spelled differently');
  guest.clear();
  w.tick(60_000); // an owner edits a room once a minute
  ed(alice, { room: id, title: '过渡态与反应路径', topic: '' });
  assert.deepEqual(guest.last('rooms').rooms.find((r) => r.id === id), { ...room, title: '过渡态与反应路径', topic: '' });
  assert.equal(code(ed(boss, { room: 'lobby', title: '新大厅' })), 'forbidden', 'the official names are in the code');
  // A closed room can be read but not written in, except by an admin; closing frees one of the three places.
  w.do(guest, { t: 'join', room: id });
  w.post(alice, id, 'before closing');
  w.tick(60_000);
  assert.deepEqual(type(ed(alice, { room: id, closed: true }), 'me').me.rooms, 2);
  assert.equal(guest.last('rooms').rooms.find((r) => r.id === id).closed, true);
  w.tick(5000);
  assert.deepEqual(w.do(alice, { t: 'say', room: id, text: 'after closing', cid: 's' }), [{ t: 'err', re: 'say', code: 'closed', cid: 's' }]);
  assert.equal(w.post(boss, id, 'closed by the owner').text, 'closed by the owner');
  assert.deepEqual(w.do(w.open(), { t: 'join', room: id })[0].msgs.map((m) => m.text), ['before closing', 'closed by the owner']);
  w.tick(600_000);
  const fourth = type(mk(alice, '第四个房间'), 'ok').room;
  assert.equal(code(ed(alice, { room: id, closed: false })), 'rooms-max', 'opening it again would make four');
  assert.equal(type(ed(boss, { room: id, closed: false }), 'ok').room, id, 'an admin may');
  assert.equal(alice.last('me').me.rooms, 4);
  assert.equal(type(ed(boss, { room: 'site', closed: true }), 'ok').room, 'site');
  w.tick(5000);
  assert.equal(code(w.do(alice, { t: 'say', room: 'site', text: 'feedback' })), 'closed');
  // The site-wide number of users' rooms.
  w.tick(600_000);
  assert.equal(type(mk(bob, '鲍勃的房间'), 'ok').re, 'mkroom');
  w.tick(600_000);
  assert.equal(code(mk(bob, '鲍勃的第二个房间')), 'rooms-full');
  assert.match(type(mk(boss, '站长的房间'), 'ok').room, /^u/, 'the limits are not for admins');
  // Removing: admins only, never an official room; the messages go, and whoever was inside is put out.
  assert.equal(code(w.do(alice, { t: 'rmroom', room: id })), 'forbidden');
  assert.equal(code(w.do(guest, { t: 'rmroom', room: id })), 'forbidden');
  assert.equal(code(w.do(boss, { t: 'rmroom', room: 'lobby' })), 'forbidden');
  assert.equal(code(w.do(boss, { t: 'rmroom', room: 'nowhere' })), 'no-room');
  guest.clear();
  assert.deepEqual(type(w.do(boss, { t: 'rmroom', room: id }), 'ok'), { t: 'ok', re: 'rmroom', room: id });
  assert.equal(guest.last('rooms').rooms.some((r) => r.id === id), false);
  assert.deepEqual([guest.att.r, alice.last('me').me.rooms], [null, 3]);
  assert.deepEqual([w.rows('SELECT COUNT(*) AS n FROM msgs WHERE room = ?', id)[0].n, w.rows('SELECT COUNT(*) AS n FROM rooms WHERE id = ?', id)[0].n], [0, 0]);
  assert.equal(code(w.do(guest, { t: 'join', room: id })), 'no-room');
  assert.deepEqual([second, third, fourth].map((r) => w.hub.room(r)?.owner), [alice.uid, alice.uid, alice.uid]);
  // CHAT_ROOMS_PER_USER = 0: users cannot open rooms at all.
  w.env.CHAT_ROOMS_PER_USER = '0';
  w.tick(600_000);
  assert.equal(code(mk(w.user('Carol'), '卡罗尔的房间')), 'rooms-max');
});

test('rooms: one nobody ever wrote in is removed after a week (checked when someone connects, and before a new room is made)', db, () => {
  const w = world();
  const alice = w.user('Alice'), bob = w.user('Bob');
  const empty = type(w.do(alice, { t: 'mkroom', title: '没人说话的房间' }), 'ok').room;
  w.tick(600_000);
  const used = type(w.do(alice, { t: 'mkroom', title: '有人说话的房间' }), 'ok').room;
  w.post(alice, used, 'hello');
  w.do(bob, { t: 'join', room: empty });
  w.tick(7 * DAY - 700_000);
  assert.equal(w.open().last('hello').rooms.length, 9, 'not a week old yet');
  w.tick(DAY);
  bob.clear(); alice.clear();
  assert.deepEqual(w.open().last('hello').rooms.map((r) => r.id).slice(7), [used]);
  assert.deepEqual([bob.last('rooms').rooms.length, bob.att.r, alice.last('me').me.rooms], [8, null, 1]);
  // And before counting rooms for a new one.
  const w2 = world({ CHAT_USER_ROOMS: '1' });
  const carol = w2.user('Carol'), dan = w2.user('Dan');
  w2.do(carol, { t: 'mkroom', title: '占着位置的空房间' });
  w2.tick(HOUR);
  assert.equal(code(w2.do(dan, { t: 'mkroom', title: '丹的房间' })), 'rooms-full');
  w2.tick(7 * DAY);
  assert.match(type(w2.do(dan, { t: 'mkroom', title: '丹的房间' }), 'ok').room, /^u/);
  assert.equal(w2.rows("SELECT COUNT(*) AS n FROM rooms WHERE kind = 'user'")[0].n, 1);
});

// ── 全部删除 ─────────────────────────────────────────────────────────
test('wipe: every message of the account and its nickname are removed; its rooms, a mute and a ban stay', db, () => {
  const w = world();
  const alice = w.user('Alice'), tab = w.open({ uid: alice.uid, auth: 'ok' }), bob = w.user('Bob'), boss = w.admin(), guest = w.open();
  assert.deepEqual(w.do(guest, { t: 'wipe' }), [{ t: 'err', re: 'wipe', code: 'signin' }]);
  const room = type(w.do(alice, { t: 'mkroom', title: '爱丽丝的房间' }), 'ok').room;
  const first = w.post(alice, 'lobby', 'my first words'), other = w.post(bob, 'lobby', 'bob stays'), quote = w.post(bob, 'lobby', 'quoting alice', { reply: first.id });
  w.post(alice, room, 'in my own room');
  w.post(alice, 'qc', 'nobody is looking here');
  w.do(bob, { t: 'report', id: first.id });
  w.do(boss, { t: 'mod', op: 'mute', uid: alice.uid, hours: 2 });
  w.do(guest, { t: 'join', room: 'lobby' });
  for (const ws of [guest, tab, boss]) ws.clear();
  const done = w.do(alice, { t: 'wipe', cid: 'w1' });
  assert.deepEqual(done.map((f) => f.t), ['me', 'rooms', 'ok']);
  assert.deepEqual([type(done, 'me').me.name, type(done, 'me').me.rooms, type(done, 'me').me.muted > w.t, type(done, 'ok')], [null, 1, true, { t: 'ok', re: 'wipe', cid: 'w1' }]);
  assert.equal(tab.last('me').me.name, null);
  assert.deepEqual(guest.frames('upd'), [{ t: 'upd', m: { id: first.id, room: 'lobby', uid: alice.uid, name: null, role: 'user', text: '', t: first.t, reply: null, del: 1 } }], 'whoever shows one of the messages is told');
  assert.deepEqual(guest.last('rooms').rooms.find((r) => r.id === room).owner_name, null);
  assert.equal(guest.last('rooms').rooms.find((r) => r.id === room).owner, alice.uid, 'still its owner');
  assert.deepEqual(boss.frames('reports'), [{ t: 'reports', open: 0 }]);
  assert.deepEqual(w.rows('SELECT id FROM msgs ORDER BY id').map((r) => r.id), [other.id, quote.id], 'the rows are gone, not blanked');
  assert.deepEqual(w.rows('SELECT name, key, muted > 0 AS muted FROM users WHERE uid = ?', alice.uid).map((r) => ({ ...r })), [{ name: null, key: null, muted: 1 }]);
  const view = w.do(guest, { t: 'join', room: 'lobby' })[0];
  assert.deepEqual(view.msgs.map((m) => [m.text, m.reply]), [['bob stays', null], ['quoting alice', { id: first.id, name: null, text: '' }]]);
  assert.equal(JSON.stringify([view, w.hub.summary()]).includes('my first words'), false);
  assert.equal(w.open().last('hello').rooms.find((r) => r.id === 'lobby').n, 3, 'a count of what was ever posted');
  // The name is free for someone else at once. The account itself waits out the day since it last chose one: a wipe is
  // not a way round "one change a day".
  assert.equal(type(w.do(w.user(null, { uid: 'carol0000001' }), { t: 'name', name: 'alice' }), 'ok').re, 'name');
  w.do(boss, { t: 'mod', op: 'mute', uid: alice.uid, hours: 0 });
  const named = w.rows('SELECT named FROM users WHERE uid = ?', alice.uid)[0].named;
  assert.deepEqual(w.do(alice, { t: 'name', name: 'Alice again' }), [{ t: 'err', re: 'name', code: 'name-wait', wait: (named + DAY - w.t) / 1000 }]);
  w.wake();
  assert.equal(code(w.do(alice, { t: 'name', name: 'Alice again' })), 'name-wait', 'the clock is in storage');
  w.tick(named + DAY - w.t);
  assert.equal(type(w.do(alice, { t: 'name', name: 'Alice again' }), 'ok').re, 'name');
  assert.equal(w.do(alice, { t: 'wipe' }).at(-1).t, 'ok', 'with nothing to remove: fine');
  // An account that never did anything can ask too.
  assert.deepEqual(w.do(w.user(null), { t: 'wipe' }).map((f) => f.t), ['me', 'ok']);
});

// ── 站长 ─────────────────────────────────────────────────────────────
test('mod: a mute and a ban reach a browser that is already connected, and every write is refused', db, () => {
  const w = world();
  const troll = w.user('Troll'), tab = w.open({ uid: troll.uid, auth: 'ok' }), boss = w.admin(), boss2 = w.user('Deputy', { admin: true }), other = w.user('Other');
  const mine = w.post(troll, 'lobby', 'my own message'), theirs = w.post(other, 'lobby', 'someone else');
  w.tick(HOUR); // out of the way of every wait
  const mod = (frame, ws = boss) => w.do(ws, { t: 'mod', ...frame });
  for (const ws of [troll, other, w.open()]) for (const op of ['list', 'mute', 'ban', 'purge', 'resolve']) assert.equal(code(mod({ op, uid: other.uid, hours: 1, on: true, id: 1, action: 'delete' }, ws)), 'forbidden');
  assert.equal(code(mod({ op: 'nuke' })), 'bad');
  assert.equal(code(mod({})), 'bad');
  for (const bad of [{ uid: 'nobody000001', hours: 1 }, { uid: 5, hours: 1 }, { uid: troll.uid, hours: -1 }, { uid: troll.uid, hours: 24 * 365 + 1 }, { uid: troll.uid, hours: '2' }, { uid: troll.uid }, { uid: troll.uid, hours: NaN }]) assert.equal(code(mod({ op: 'mute', ...bad })), 'bad', JSON.stringify(bad));
  assert.equal(code(mod({ op: 'ban', uid: troll.uid, on: 1 })), 'bad');
  assert.equal(code(mod({ op: 'mute', uid: boss2.uid, hours: 1 })), 'forbidden', 'not another admin');
  assert.equal(code(mod({ op: 'ban', uid: boss.uid, on: true })), 'forbidden', 'nor oneself');
  // Muted for two hours.
  troll.clear(); tab.clear();
  assert.deepEqual(mod({ op: 'mute', uid: troll.uid, hours: 2, cid: 'x' }), [{ t: 'ok', re: 'mod', op: 'mute', cid: 'x' }]);
  const until = w.t + 2 * HOUR;
  const me = { uid: troll.uid, name: 'Troll', role: 'user', muted: until, banned: false, rooms: 0 };
  assert.deepEqual([troll.frames(), tab.frames()], [[{ t: 'me', me }], [{ t: 'me', me }]]);
  const refused = (c, extra = {}) => {
    assert.deepEqual(w.do(troll, { t: 'say', room: 'lobby', text: 'let me speak' }), [{ t: 'err', re: 'say', code: c, ...extra }]);
    assert.equal(code(w.do(tab, { t: 'say', room: 'lobby', text: 'from the other tab' })), c);
    assert.equal(code(w.do(troll, { t: 'name', name: 'NewName' })), c);
    assert.equal(code(w.do(troll, { t: 'report', id: theirs.id })), c);
    assert.equal(code(w.do(troll, { t: 'mkroom', title: '我的房间' })), c);
    assert.equal(code(w.do(troll, { t: 'edroom', room: 'lobby', closed: true })), c);
  };
  refused('muted', { until });
  assert.deepEqual(mod({ op: 'list' })[0].users, [{ uid: troll.uid, name: 'Troll', muted: until, banned: false }]);
  w.wake();
  refused('muted', { until });
  assert.equal(w.open({ uid: troll.uid, auth: 'ok' }).last('hello').me.muted, until, 'a new connection sees it too');
  w.tick(2 * HOUR);
  assert.equal(w.do(troll, { t: 'say', room: 'lobby', text: 'time is up' })[0].t, 'msg');
  assert.deepEqual([w.open({ uid: troll.uid, auth: 'ok' }).last('hello').me.muted, mod({ op: 'list' })[0].users], [0, []], 'a mute that ran out is not shown');
  mod({ op: 'mute', uid: troll.uid, hours: 24 * 365 });
  assert.equal(troll.last('me').me.muted, w.t + 365 * DAY);
  mod({ op: 'mute', uid: troll.uid, hours: 0 });
  assert.equal(troll.last('me').me.muted, 0);
  // Banned: the same for every write, until taken back. Reading, deleting one's own and wiping stay possible.
  mod({ op: 'ban', uid: troll.uid, on: true });
  assert.deepEqual([troll.last('me').me.banned, tab.last('me').me.banned], [true, true]);
  w.tick(5000);
  refused('banned');
  assert.equal(w.do(troll, { t: 'join', room: 'lobby' })[0].t, 'room');
  assert.equal(type(w.do(troll, { t: 'del', id: mine.id }), 'ok').id, mine.id);
  assert.deepEqual(mod({ op: 'list' })[0].users, [{ uid: troll.uid, name: 'Troll', muted: 0, banned: true }]);
  w.wake();
  refused('banned');
  mod({ op: 'ban', uid: troll.uid, on: false });
  assert.equal(troll.last('me').me.banned, false);
  w.tick(5000);
  assert.equal(w.do(troll, { t: 'say', room: 'lobby', text: 'back again' })[0].t, 'msg');
  // Purge: every message of that account is removed; its name stays.
  const guest = w.open();
  w.do(guest, { t: 'join', room: 'lobby' });
  guest.clear();
  assert.deepEqual(mod({ op: 'purge', uid: troll.uid }), [{ t: 'ok', re: 'mod', op: 'purge' }]);
  assert.deepEqual(guest.frames('upd').map((f) => [f.m.del, f.m.text, f.m.name]), [[2, '', 'Troll'], [2, '', 'Troll'], [2, '', 'Troll']]);
  assert.deepEqual(w.rows('SELECT uid FROM msgs').map((r) => r.uid), [other.uid]);
  assert.equal(w.rows('SELECT name FROM users WHERE uid = ?', troll.uid)[0].name, 'Troll');
  assert.equal(code(mod({ op: 'purge', uid: 'nobody000001' })), 'bad');
});

test('mod: who is an admin is the Worker’s word at connect, and the stored role follows it', db, () => {
  const w = world();
  const fe = w.user('Fe', { uid: 'fe0000000001', admin: true });
  const m = w.post(fe, 'lobby', 'welcome');
  assert.equal(m.role, 'admin');
  w.shut(fe);
  // The grant was taken away: the same account connects as a user. Its old messages lose the badge, and it moderates nothing.
  const was = w.open({ uid: 'fe0000000001', auth: 'ok', admin: false });
  assert.deepEqual([was.last('hello').me.role, 'reports' in was.last('hello')], ['user', false]);
  assert.equal(w.do(was, { t: 'join', room: 'lobby' })[0].msgs[0].role, 'user');
  assert.equal(code(w.do(was, { t: 'mod', op: 'list' })), 'forbidden');
  assert.equal(code(w.do(was, { t: 'rmroom', room: 'lobby' })), 'forbidden');
  // A frame cannot claim it either.
  const eve = w.user('Eve');
  assert.equal(code(w.do(eve, { t: 'mod', op: 'list', admin: true, a: 1 })), 'forbidden');
  assert.equal(code(w.do(eve, { t: 'del', id: m.id, admin: true })), 'forbidden');
});

// ── 只读、关闭 ───────────────────────────────────────────────────────
test('read-only: nobody but an admin writes; deleting one’s own and wiping still work. Off: sockets are turned away', db, () => {
  const w = world();
  const alice = w.user('Alice'), boss = w.admin(), bob = w.user('Bob');
  const mine = w.post(alice, 'lobby', 'before the freeze'), theirs = w.post(bob, 'lobby', 'bob before the freeze');
  w.env.CHAT_STATE = 'readonly';
  assert.equal(w.open().last('hello').state, 'readonly');
  w.tick(5000);
  for (const frame of [{ t: 'say', room: 'lobby', text: 'x' }, { t: 'name', name: 'Alicia' }, { t: 'report', id: theirs.id }, { t: 'mkroom', title: '新的房间' }, { t: 'edroom', room: 'lobby', closed: true }]) {
    assert.deepEqual(w.do(alice, frame), [{ t: 'err', re: frame.t, code: 'readonly' }], frame.t);
  }
  assert.equal(code(w.do(w.user(null), { t: 'name', name: 'Newcomer' })), 'readonly');
  assert.equal(w.do(alice, { t: 'join', room: 'lobby' })[0].msgs.length, 2);
  assert.equal(type(w.do(alice, { t: 'del', id: mine.id }), 'ok').id, mine.id);
  assert.equal(w.do(bob, { t: 'wipe' }).at(-1).t, 'ok');
  assert.equal(w.post(boss, 'lobby', 'maintenance tonight').role, 'admin');
  assert.match(type(w.do(boss, { t: 'mkroom', title: '公告' }), 'ok').room, /^u/);
  w.env.CHAT_STATE = 'on';
  assert.equal(w.do(alice, { t: 'say', room: 'lobby', text: 'thawed' })[0].t, 'msg');
  // Off while people are connected: the next frame is answered with "off" and the socket is closed; new ones are not let in.
  w.env.CHAT_STATE = 'off';
  assert.deepEqual(w.do(alice, { t: 'join', room: 'lobby' }), [{ t: 'err', re: 'connect', code: 'off' }]);
  assert.deepEqual(alice.closed, [4003, 'off']);
  const late = w.open();
  assert.deepEqual([late.frames(), late.closed], [[{ t: 'err', re: 'connect', code: 'off' }], [4003, 'off']]);
  w.env.CHAT_STATE = 'on';
  assert.equal(w.open().last('hello').online, 5, 'neither of the two that were closed is counted');
});

// ── 休眠 ─────────────────────────────────────────────────────────────
test('hibernation: a new Hub over the same storage and sockets carries on where the old one stopped', db, () => {
  const w = world();
  const alice = w.user('Alice'), bob = w.user('Bob'), guest = w.open(), boss = w.admin(), far = w.open();
  for (const ws of [alice, bob, guest]) w.do(ws, { t: 'join', room: 'qc' });
  w.do(far, { t: 'join', room: 'lobby' });
  const before = w.post(alice, 'qc', 'before the sleep');
  const room = type(w.do(alice, { t: 'mkroom', title: '睡前开的房间' }), 'ok').room;
  for (const ws of w.socks) ws.clear();
  const old = w.hub;
  w.wake();
  assert.notEqual(w.hub, old);
  // Who is who, and who is where, comes from the attachments.
  assert.deepEqual(w.hub.summary().online, 5);
  assert.equal(w.do(far, { t: 'who', room: 'qc' })[0].users.length, 2);
  assert.equal(w.do(far, { t: 'who', room: 'qc' })[0].guests, 1);
  // Limits come back from the last messages: too soon is still too soon, a repeat is still a repeat.
  assert.equal(code(w.do(alice, { t: 'say', room: 'qc', text: 'right after waking' })), 'slow');
  w.tick(2000);
  assert.equal(code(w.do(alice, { t: 'say', room: 'qc', text: 'before the sleep' })), 'dup');
  for (const ws of w.socks) ws.clear();
  const m = w.do(alice, { t: 'say', room: 'qc', text: 'after the sleep', reply: before.id, cid: 'z' })[0];
  assert.deepEqual([m.cid, m.m.id, m.m.name, m.m.reply], ['z', before.id + 1, 'Alice', { id: before.id, name: 'Alice', text: 'before the sleep' }]);
  assert.deepEqual([bob.frames(), guest.frames()], [[{ t: 'msg', m: m.m }], [{ t: 'msg', m: m.m }]]);
  assert.deepEqual([far.frames(), boss.frames()], [[{ t: 'act', room: 'qc', last: w.t, n: 2 }], [{ t: 'act', room: 'qc', last: w.t, n: 2 }]]);
  // The admin is still the admin, the owner still the owner.
  assert.equal(type(w.do(boss, { t: 'del', id: m.m.id }), 'ok').id, m.m.id);
  assert.equal(type(w.do(alice, { t: 'edroom', room, closed: true }), 'ok').room, room);
  // Fifteen a minute holds across a sleep in the middle of the burst.
  w.tick(HOUR);
  for (let i = 0; i < 8; i++) { assert.equal(w.do(bob, { t: 'say', room: 'qc', text: `a${i}` })[0].t, 'msg'); w.tick(1600); }
  w.wake();
  for (let i = 0; i < 7; i++) { assert.equal(w.do(bob, { t: 'say', room: 'qc', text: `b${i}` })[0].t, 'msg'); w.tick(1600); }
  assert.equal(code(w.do(bob, { t: 'say', room: 'qc', text: 'the sixteenth' })), 'flood');
  // A close that arrives after the wake still tells the room, and is not counted.
  w.wake();
  bob.clear();
  w.shut(guest);
  assert.deepEqual(bob.frames(), [{ t: 'pres', room: 'qc', online: 2 }]);
  // A socket this side closed just before the sleep, whose close has not come back yet, is nobody.
  alice.clear();
  for (let i = 0; i < 41; i++) w.hub.message(far, '{"t":"who","room":"lobby"}');
  assert.deepEqual(far.closed, [4002, 'too many frames']);
  w.wake();
  far.clear();
  assert.equal(w.hub.summary().online, 3, 'alice, bob, boss');
  w.do(far, { t: 'join', room: 'lobby' });
  assert.deepEqual(far.frames(), [], 'and it is not answered');
  w.post(alice, 'lobby', 'not for the closed one');
  assert.deepEqual(far.frames(), []);
});

// ── 坏连接、洪水、上限 ───────────────────────────────────────────────
test('a socket that throws on send does not stop the others', db, () => {
  const w = world();
  const alice = w.user('Alice'), dead = w.open(), dead2 = w.user('Dead'), bob = w.open(), far = w.open();
  for (const ws of [alice, dead, dead2, bob]) w.do(ws, { t: 'join', room: 'lobby' });
  dead.broken = true;
  dead2.broken = true;
  const m = w.post(alice, 'lobby', 'still delivered');
  assert.deepEqual(bob.last('msg').m, m);
  assert.equal(far.last('act').n, 1);
  assert.equal(type(w.do(alice, { t: 'mkroom', title: '照样能开房间' }), 'ok').re, 'mkroom');
  assert.equal(bob.last('rooms').rooms.length, 8);
  // Its own frames go nowhere, and nothing is thrown.
  assert.doesNotThrow(() => w.hub.message(dead2, '{"t":"say","room":"lobby","text":"into the void"}'));
  assert.doesNotThrow(() => w.hub.message(dead, 'not json'));
  w.shut(dead);
  assert.equal(bob.last('pres').online, 3);
});

test('frames: nonsense is "bad", more than 40 in 10 s closes the socket (4002), over 8 KB too (1009)', db, () => {
  const w = world();
  const alice = w.user('Alice');
  for (const junk of ['', 'hello', '{', '[]', '[{"t":"join"}]', '5', 'null', '"say"', '{"room":"lobby"}', '{"t":5}', '{"t":null}']) assert.deepEqual(w.do(alice, junk), [{ t: 'err', re: '', code: 'bad' }], junk);
  assert.deepEqual(w.do(alice, new ArrayBuffer(8)), [{ t: 'err', re: '', code: 'bad' }], 'binary frames are not part of it');
  // An unknown t is echoed (cut short); names of the object's own methods are not operations.
  assert.deepEqual(w.do(alice, { t: 'dance' }), [{ t: 'err', re: 'dance', code: 'bad' }]);
  assert.equal(w.do(alice, { t: 'x'.repeat(100) })[0].re.length, 20);
  for (const t of ['constructor', 'seed', 'forget', 'onSay', 'close', 'connect', '__proto__', 'toString', 'hasOwnProperty']) assert.equal(code(w.do(alice, { t, room: 'lobby' })), 'bad', t);
  assert.deepEqual(w.do(alice, 'ping'), ['pong']);
  assert.equal(alice.closed, null);
  // 40 frames in ten seconds are fine; the 41st is the last.
  w.tick(10_000);
  const bob = w.user('Bob'), bystander = w.open();
  w.do(bob, { t: 'join', room: 'lobby' });
  w.do(bystander, { t: 'join', room: 'lobby' });
  for (let i = 0; i < 38; i++) assert.equal(w.do(bob, { t: 'who', room: 'lobby' })[0].t, 'who'); // with "name" and "join": 40
  assert.equal(bob.closed, null);
  bystander.clear();
  assert.deepEqual(w.do(bob, { t: 'who', room: 'lobby' }), [{ t: 'err', re: 'connect', code: 'flood' }]);
  assert.deepEqual(bob.closed, [4002, 'too many frames']);
  assert.deepEqual(bystander.frames(), [{ t: 'pres', room: 'lobby', online: 1 }], 'it is gone from the room at once');
  assert.deepEqual(w.do(bob, { t: 'who', room: 'lobby' }), [], 'and nothing more is heard from it');
  w.shut(bob);
  assert.equal(bystander.frames().length, 1, 'the close that follows changes nothing');
  // Spread out, the same number is fine.
  const carol = w.user('Carol');
  for (let i = 0; i < 100; i++) { w.tick(300); assert.equal(w.do(carol, { t: 'who', room: 'lobby' })[0].t, 'who'); }
  assert.equal(carol.closed, null);
  // Size is bytes of UTF-8: 2000 emoji (8000 bytes) still fit, 3000 Chinese characters (9000 bytes) do not.
  w.tick(10_000);
  assert.equal(w.do(carol, { t: 'say', room: 'lobby', text: '😀'.repeat(2000), cid: 'c'.repeat(40), reply: null })[0].t, 'msg');
  assert.equal(carol.closed, null);
  const dan = w.user('Dan');
  assert.deepEqual(w.do(dan, JSON.stringify({ t: 'say', room: 'lobby', text: '字'.repeat(3000) })), []);
  assert.deepEqual(dan.closed, [1009, 'frame too large']);
  const eve = w.user('Eve');
  w.do(eve, 'x'.repeat(8193));
  assert.equal(eve.closed?.[0], 1009);
  const fay = w.user('Fay');
  w.do(fay, new ArrayBuffer(9000));
  assert.equal(fay.closed?.[0], 1009);
  const gil = w.user('Gil');
  assert.equal(code(w.do(gil, 'x'.repeat(8192))), 'bad', 'exactly 8 KB is read (and is not JSON)');
  assert.equal(gil.closed, null);
});

test('frames: one address cannot keep several sockets just under the limit all day', db, () => {
  const w = world();
  const socks = [1, 2, 3].map(() => w.open({ iph: 'same-address' })), other = w.open({ iph: 'other-address' });
  const boss = w.user('Fe', { admin: true, iph: 'same-address' });
  // 30 frames every 10 s from each of three sockets: under 40 per socket, but 1200 from the address after 134 s.
  let closed = 0, sent = 0;
  for (let round = 0; round < 20 && !closed; round++) {
    for (const ws of socks) for (let i = 0; i < 30 && !closed; i++) { w.hub.message(ws, 'ping'); sent++; if (ws.closed) closed = sent; }
    w.tick(10_000);
  }
  assert.equal(closed, 1201);
  const hit = socks.find((ws) => ws.closed);
  assert.deepEqual([hit.closed, hit.frames().at(-1)], [[4002, 'too many frames'], { t: 'err', re: 'connect', code: 'flood' }]);
  assert.deepEqual(w.do(other, 'ping'), ['pong'], 'another address is not affected');
  assert.deepEqual(w.do(boss, 'ping'), ['pong'], 'nor an admin behind the same address');
  w.tick(600_000);
  assert.deepEqual(w.do(socks.find((ws) => !ws.closed), 'ping'), ['pong'], 'ten minutes later the count starts again');
});

test('sockets: a cap on the whole house and 12 per address; the one too many is told "full" and closed (4001)', db, () => {
  const w = world({ CHAT_MAX_SOCKETS: '3' });
  const a = w.open(), b = w.open(), c = w.open();
  const d = w.open();
  assert.deepEqual([d.frames(), d.closed], [[{ t: 'err', re: 'connect', code: 'full' }], [4001, 'full']]);
  assert.equal(d.att, undefined, 'it never becomes anyone');
  assert.deepEqual(w.do(d, { t: 'join', room: 'lobby' }), []);
  assert.equal(w.hub.summary().online, 3);
  w.wake();
  assert.equal(w.hub.summary().online, 3, 'also after a sleep, while its close is still on the way');
  w.shut(d);
  const boss = w.user(null, { uid: 'boss00000001', admin: true });
  assert.equal(boss.last('hello').online, 4, 'an admin gets in when the house is full');
  w.shut(a);
  assert.equal(w.open().closed?.[0], 4001, 'the admin counts, so it is still full');
  w.shut(b);
  assert.equal(w.open().last('hello').online, 3);
  assert.equal(c.closed, null);
  // Per address.
  const w2 = world();
  const same = Array.from({ length: 12 }, () => w2.open({ iph: 'one-address' }));
  assert.equal(same.every((ws) => ws.last('hello') && !ws.closed), true);
  assert.deepEqual(w2.open({ iph: 'one-address' }).closed, [4001, 'full']);
  assert.equal(w2.open({ iph: 'another-address' }).closed, null);
  assert.equal(w2.user('Fe', { admin: true, iph: 'one-address' }).closed, null);
  w2.shut(same[0]);
  assert.equal(w2.open({ iph: 'one-address' }).closed?.[0], 4001, 'the admin’s socket is one of the twelve');
  w2.shut(same[1]);
  assert.equal(w2.open({ iph: 'one-address' }).closed, null);
  assert.equal(w2.open({ iph: '' }).closed, null);
});

// ── 首页卡片、举报邮件 ───────────────────────────────────────────────
test('summary: who is here, the rooms, the last six messages; nothing deleted, hidden or from a closed room', db, () => {
  const w = world();
  assert.deepEqual(w.hub.summary(), { state: 'on', online: 0, rooms: 7, top: w.hub.summary().top, latest: [] });
  assert.deepEqual(w.hub.summary().top.map((r) => r.id), ['lobby', 'qc', 'mlip', 'software', 'papers', 'study']);
  const alice = w.user('Alice'), bob = w.user('Bob'), boss = w.admin(), guest = w.open();
  const fans = ['Ann', 'Ben', 'Cat'].map((n) => w.user(n));
  w.do(guest, { t: 'join', room: 'qc' });
  w.do(alice, { t: 'join', room: 'qc' });
  const room = type(w.do(bob, { t: 'mkroom', title: '鲍勃的房间' }), 'ok').room;
  const texts = [];
  for (let i = 1; i <= 8; i++) texts.push(w.post(i % 2 ? alice : bob, i % 2 ? 'qc' : 'lobby', `public line ${i}`));
  const deleted = w.post(alice, 'qc', 'DELETED-SECRET'), hidden = w.post(bob, 'qc', 'HIDDEN-SECRET'), closed = w.post(bob, room, 'CLOSED-ROOM-SECRET');
  const long = w.post(alice, 'lobby', '第一行\n\n第二行\t' + '很长'.repeat(200));
  w.do(alice, { t: 'del', id: deleted.id });
  for (const f of fans) w.do(f, { t: 'report', id: hidden.id });
  w.do(bob, { t: 'edroom', room, closed: true });
  const s = w.hub.summary();
  assert.deepEqual([s.state, s.online, s.rooms, s.top.length, s.latest.length], ['on', 7, 7, 6, 6]);
  assert.deepEqual(s.top[1], { ...w.open().last('hello').rooms[1], online: 2 });
  assert.deepEqual(s.latest.map((m) => m.t), [long.t, ...texts.slice(-5).reverse().map((m) => m.t)], 'newest first');
  assert.deepEqual(Object.keys(s.latest[0]).sort(), ['name', 'room', 't', 'text', 'title', 'title_en']);
  assert.deepEqual([s.latest[0].room, s.latest[0].title, s.latest[0].title_en, s.latest[0].name, [...s.latest[0].text].length, s.latest[0].text.includes('\n'), s.latest[0].text.startsWith('第一行 第二行 很长')], ['lobby', '大厅', 'Lobby', 'Alice', 140, false, true]);
  assert.equal(/SECRET/.test(JSON.stringify(s)), false);
  // Nothing in it says who anyone is beyond the nickname.
  assert.equal(new RegExp(`${alice.uid}|addr-`).test(JSON.stringify({ ...s, top: [] })), false);
  w.env.CHAT_STATE = 'readonly';
  assert.equal(w.hub.summary().state, 'readonly');
  // Hidden and deleted texts never reached a browser that is not an admin's list.
  const everything = [...w.socks].filter((ws) => ws !== boss).flatMap((ws) => ws.sent).join('\n');
  assert.equal(everything.includes('HIDDEN-SECRET'), true, 'it was public until the third report');
  for (const ws of w.socks) ws.clear();
  w.env.CHAT_STATE = 'on';
  const late = w.open();
  w.do(late, { t: 'join', room: 'qc' });
  w.do(late, { t: 'more', room: 'qc', before: 10_000 });
  w.post(alice, 'qc', 'answering the hidden one', { reply: hidden.id });
  w.post(alice, 'qc', 'answering the deleted one', { reply: deleted.id });
  w.do(boss, { t: 'join', room: 'qc' });
  const after = [...w.socks].flatMap((ws) => ws.sent).join('\n');
  assert.equal(/HIDDEN-SECRET|DELETED-SECRET/.test(after), false, 'not in a room, an older page, a quote or an "act"');
  assert.equal(w.do(boss, { t: 'mod', op: 'list' })[0].reports[0].m.text, 'HIDDEN-SECRET', 'only in the admin’s list');
  assert.equal(w.do(boss, { t: 'mod', op: 'list' })[0].reports[0].title, '量子化学与 DFT');
});

test('nothing sent to a browser carries the address hash, and messages are numbered once and for all', db, () => {
  const w = world();
  const alice = w.user('Alice', { iph: 'IPH-OF-ALICE' }), bob = w.user('Bob', { iph: 'IPH-OF-BOB' }), boss = w.user('Fe', { admin: true, iph: 'IPH-OF-FE' });
  for (const ws of [alice, bob, boss]) w.do(ws, { t: 'join', room: 'lobby' });
  const one = w.post(alice, 'lobby', 'one'), two = w.post(alice, 'lobby', 'two');
  w.do(bob, { t: 'report', id: two.id });
  w.do(boss, { t: 'mod', op: 'list' });
  w.do(boss, { t: 'who', room: 'lobby' });
  w.do(boss, { t: 'mod', op: 'mute', uid: alice.uid, hours: 1 });
  assert.equal(/IPH-OF/.test([...w.socks].flatMap((ws) => ws.sent).join('\n') + JSON.stringify(w.hub.summary())), false);
  assert.equal(alice.att.i, 'IPH-OF-ALICE', 'it stays with the socket, for counting');
  // The newest message is removed with its row; the next one does not get its number.
  w.do(alice, { t: 'wipe' });
  assert.equal(w.rows('SELECT COUNT(*) AS n FROM msgs')[0].n, 0);
  w.wake();
  assert.equal(w.post(bob, 'lobby', 'three').id, two.id + 1);
  assert.equal(one.id, 1);
});

test('storage that fails: the browser is told, nothing half-done stays, and the next frame works', db, () => {
  const w = world();
  const alice = w.user('Alice'), bob = w.open();
  w.do(bob, { t: 'join', room: 'lobby' });
  w.post(alice, 'lobby', 'fine');
  w.tick(5000);
  bob.clear();
  const quiet = console.error;
  console.error = () => {};
  try {
    w.fail = /^UPDATE rooms SET last/; // the second statement of the transaction
    assert.deepEqual(w.do(alice, { t: 'say', room: 'lobby', text: 'lost', cid: 'e1' }), [{ t: 'err', re: 'say', code: 'server', cid: 'e1' }]);
    w.fail = /^DELETE FROM msgs/;
    assert.equal(code(w.do(alice, { t: 'wipe' })), 'server');
  } finally { console.error = quiet; w.fail = null; }
  assert.deepEqual(bob.frames(), []);
  assert.deepEqual(w.rows('SELECT text FROM msgs').map((r) => r.text), ['fine'], 'rolled back');
  assert.equal(w.rows('SELECT name FROM users WHERE uid = ?', alice.uid)[0].name, null, 'the nickname went in its own statement, before the failure');
  assert.equal(w.do(alice, { t: 'join', room: 'lobby' })[0].msgs.length, 1);
  assert.deepEqual([w.open().last('hello').rooms[0].n, w.rows("SELECT n FROM rooms WHERE id = 'lobby'")[0].n], [1, 1], 'memory was read again from storage');
});

// ── 复查后补上的限制 ─────────────────────────────────────────────────
const cp = (...points) => String.fromCodePoint(...points); // invisible characters are spelled by number, never typed

test('addresses: an IPv6 address counts by its /64, an IPv4 one (also IPv4-mapped) as itself', () => {
  assert.equal(addrKey('203.0.113.7'), '203.0.113.7');
  assert.equal(addrKey('2001:db8:1:2:aaaa:bbbb:cccc:dddd'), '2001:db8:1:2::/64');
  assert.equal(addrKey('2001:0DB8:0001:0002::1'), '2001:db8:1:2::/64', 'case, leading zeros and :: do not make another address');
  assert.equal(addrKey('[2001:db8:1:2::9%eth0]'), '2001:db8:1:2::/64');
  assert.notEqual(addrKey('2001:db8:1:3::1'), addrKey('2001:db8:1:2::1'));
  assert.equal(addrKey('2001:db8::1'), '2001:db8:0:0::/64');
  assert.equal(addrKey('::1'), '0:0:0:0::/64');
  for (const mapped of ['::ffff:203.0.113.7', '::FFFF:cb00:7107', '0:0:0:0:0:ffff:203.0.113.7']) assert.equal(addrKey(mapped), '203.0.113.7', mapped);
  assert.equal(addrKey('64:ff9b::203.0.113.7'), '64:ff9b:0:0::/64');
  for (const odd of ['local', '', '1::2::3', '2001:db8:1:2:3:4:5:6:7', 'g::1', '::ffff:999.1.1.1', '1:2:3:4:5:6:7::8']) assert.equal(addrKey(odd), odd, `${odd} is counted as itself`);
  assert.equal(addrKey(undefined), '');
});

test('sockets: guests are turned away at four fifths of the cap, so that accounts still get in', db, () => {
  const w = world({ CHAT_MAX_SOCKETS: '10' });
  const guests = Array.from({ length: 8 }, () => w.open());
  assert.equal(guests.every((ws) => !ws.closed), true);
  assert.deepEqual(w.open().closed, [4001, 'full'], 'the ninth guest');
  assert.deepEqual(w.open({ auth: 'expired' }).closed, [4001, 'full'], 'a sign-in that ran out is a guest');
  assert.equal(w.user(null, { uid: 'first0000001' }).closed, null);
  assert.equal(w.user(null, { uid: 'second000001' }).closed, null);
  assert.deepEqual(w.user(null, { uid: 'third0000001' }).closed, [4001, 'full'], 'ten is ten for accounts');
  assert.equal(w.admin().closed, null);
});

test('history: reading back has its own budget (60 per address in ten minutes for guests, 120 per account), and a sleep does not renew it', db, () => {
  const w = world();
  const alice = w.user('Alice'), boss = w.admin();
  for (let i = 0; i < 3; i++) w.post(alice, 'lobby', `m${i}`);
  const guest = w.open({ iph: 'reader' }), twin = w.open({ iph: 'reader' }), other = w.open({ iph: 'elsewhere' });
  const more = (ws) => { w.tick(300); return w.do(ws, { t: 'more', room: 'lobby', before: 3, cid: 'h' })[0]; };
  w.log.length = 0;
  const start = w.t + 300;
  for (let i = 0; i < 60; i++) assert.equal(more(i % 2 ? guest : twin).t, 'older', `read ${i + 1}`);
  assert.equal(w.writes().length, 3, 'one row written for every 20 reads');
  w.log.length = 0;
  assert.deepEqual(more(guest), { t: 'err', re: 'more', code: 'slow', wait: (start + 600_000 - w.t) / 1000, cid: 'h' });
  assert.equal(more(twin).code, 'slow', 'the budget is the address’s, not the socket’s');
  assert.deepEqual(w.log.filter((q) => /FROM msgs/.test(q)), [], 'a refused read reads nothing');
  // A room whose last page is not in memory is a read too; one that is, is free.
  assert.deepEqual(w.do(guest, { t: 'join', room: 'qc' }), [{ t: 'err', re: 'join', code: 'slow', wait: Math.ceil((start + 600_000 - w.t) / 1000) }]);
  assert.equal(guest.att.r, null, 'and it is not in that room');
  w.do(alice, { t: 'join', room: 'lobby' });
  assert.equal(w.do(guest, { t: 'join', room: 'lobby' })[0].t, 'room');
  assert.equal(more(other).t, 'older', 'another address has its own');
  // The point of writing it down: a new Hub after a sleep knows.
  w.wake();
  assert.equal(more(guest).code, 'slow');
  w.tick(start + 600_000 - w.t);
  assert.equal(more(guest).t, 'older', 'ten minutes after the first read it starts again');
  // Accounts get twice as much, each its own; admins are not counted.
  const bob = w.user('Bob', { iph: 'reader' });
  for (let i = 0; i < 120; i++) assert.equal(more(bob).t, 'older', `read ${i + 1}`);
  assert.equal(more(bob).code, 'slow');
  assert.equal(more(alice).t, 'older');
  for (let i = 0; i < 130; i++) assert.equal(more(boss).t, 'older');
  // The rows are removed an hour after their window (they hold hashes of addresses).
  assert.equal(w.rows('SELECT COUNT(*) AS n FROM quota')[0].n >= 3, true);
  assert.equal(w.rows("SELECT COUNT(*) AS n FROM quota WHERE key NOT LIKE 'i:%' AND key NOT LIKE 'u:%'")[0].n, 0);
  w.tick(2 * HOUR);
  w.open();
  assert.equal(w.rows('SELECT COUNT(*) AS n FROM quota')[0].n, 0);
  // When storage takes no more writes, reading still works.
  const quiet = console.error;
  console.error = () => {};
  try {
    w.fail = /^INSERT INTO quota/;
    assert.equal(more(w.open()).t, 'older');
  } finally { console.error = quiet; w.fail = null; }
});

test('say: 300 a day holds across a sleep', db, () => {
  const w = world();
  const bob = w.user('Bob'), carol = w.user('Carol');
  const first = w.t + 5000;
  for (let i = 0; i < 300; i++) w.post(bob, 'lobby', `m${i}`);
  for (let i = 0; i < 20; i++) w.post(carol, 'lobby', `c${i}`);
  w.wake();
  w.tick(5000);
  w.log.length = 0;
  const day = w.do(bob, { t: 'say', room: 'lobby', text: 'm300' })[0];
  assert.deepEqual([day.code, day.wait], ['flood', (first + DAY - w.t) / 1000]);
  assert.deepEqual(w.writes(), []);
  assert.equal(w.log.filter((q) => /FROM msgs/.test(q)).every((q) => /LIMIT \?/.test(q)), true, 'the count is read from a bounded number of rows');
  assert.equal(w.do(carol, { t: 'say', room: 'lobby', text: 'c20' })[0].t, 'msg', '20 today is 20 after the sleep too');
  w.tick(day.wait * 1000);
  assert.equal(w.do(bob, { t: 'say', room: 'lobby', text: 'm300' })[0].t, 'msg');
});

test('wipe: with nothing to remove nothing is written; once a minute; the reasons the account gave in reports go too', db, () => {
  const w = world();
  const alice = w.user('Alice'), bob = w.user('Bob'), carol = w.user('Carol'), idle = w.user(null), boss = w.admin();
  w.log.length = 0;
  assert.deepEqual(w.do(idle, { t: 'wipe' }).map((f) => f.t), ['me', 'ok']);
  assert.deepEqual(w.writes(), [], 'an account that never did anything');
  assert.deepEqual(w.do(idle, { t: 'wipe', cid: 'w' }), [{ t: 'err', re: 'wipe', code: 'slow', wait: 60, cid: 'w' }]);
  w.tick(59_000);
  assert.equal(w.do(idle, { t: 'wipe' })[0].wait, 1);
  w.tick(1000);
  assert.equal(w.do(idle, { t: 'wipe' }).at(-1).t, 'ok');
  // Reasons written on other people's messages.
  const m = w.post(alice, 'lobby', 'reported twice');
  w.do(bob, { t: 'report', id: m.id, reason: 'bob wrote this' });
  w.do(carol, { t: 'report', id: m.id, reason: 'carol wrote this' });
  assert.deepEqual(w.do(boss, { t: 'mod', op: 'list' })[0].reports[0].reasons, ['bob wrote this', 'carol wrote this']);
  assert.equal(w.do(bob, { t: 'wipe' }).at(-1).t, 'ok');
  const listed = w.do(boss, { t: 'mod', op: 'list' })[0].reports[0];
  assert.deepEqual([listed.n, listed.reasons], [2, ['carol wrote this']], 'the report still counts, its words are gone');
  assert.equal(JSON.stringify(w.rows('SELECT * FROM reports')).includes('bob wrote this'), false);
  // A second wipe, also from a banned account, has nothing to do and writes nothing.
  w.do(boss, { t: 'mod', op: 'ban', uid: bob.uid, on: true });
  w.tick(60_000);
  w.log.length = 0;
  assert.equal(w.do(bob, { t: 'wipe' }).at(-1).t, 'ok');
  assert.deepEqual(w.writes(), []);
});

test('rooms: an owner edits once a minute, an edit that changes nothing costs nothing, a room an admin closed stays closed', db, () => {
  const w = world();
  const alice = w.user('Alice'), boss = w.admin(), guest = w.open();
  const id = type(w.do(alice, { t: 'mkroom', title: '反应路径', topic: 'NEB' }), 'ok').room;
  const ed = (ws, frame) => w.do(ws, { t: 'edroom', room: id, ...frame });
  assert.equal(type(ed(alice, { topic: 'NEB 和 IRC' }), 'ok').room, id);
  assert.deepEqual(ed(alice, { topic: '再改一次', cid: 'e' }), [{ t: 'err', re: 'edroom', code: 'slow', wait: 60, cid: 'e' }]);
  assert.equal(w.hub.room(id).topic, 'NEB 和 IRC');
  w.tick(59_000);
  assert.equal(ed(alice, { closed: true })[0].wait, 1);
  assert.equal(code(ed(alice, { title: 'x' })), 'title-bad', 'what is wrong with the edit is said first');
  w.tick(1000);
  guest.clear();
  w.log.length = 0;
  assert.deepEqual(ed(alice, { title: ' 反应路径 ', topic: 'NEB 和 IRC', closed: false }), [{ t: 'ok', re: 'edroom', room: id }]);
  assert.deepEqual([w.writes(), guest.frames()], [[], []], 'the same again: no row, no list for everyone');
  assert.equal(type(ed(alice, { topic: '再改一次' }), 'ok').room, id, 'and it did not use up the minute');
  for (let i = 0; i < 3; i++) assert.equal(type(ed(boss, { topic: `站长改的 ${i}` }), 'ok').room, id, 'an admin is not slowed');
  // Closed by an admin: its owner cannot open it again, an admin can.
  assert.equal(type(ed(boss, { closed: true }), 'ok').room, id);
  w.tick(60_000);
  assert.deepEqual(ed(alice, { closed: false, cid: 'o' }), [{ t: 'err', re: 'edroom', code: 'forbidden', cid: 'o' }]);
  assert.equal(type(ed(alice, { closed: true }), 'ok').room, id, 'closing what is closed changes nothing');
  assert.equal(code(ed(alice, { closed: false })), 'forbidden', 'and does not make it the owner’s to open');
  w.wake();
  assert.equal(code(ed(alice, { closed: false })), 'forbidden', 'also after a sleep');
  assert.equal(guest.last('rooms').rooms.find((r) => r.id === id).closed, true, 'browsers see closed as before: true or false');
  assert.equal(type(ed(boss, { closed: false }), 'ok').room, id);
  // Closed by its owner: theirs to open again; an admin closing it on top makes it the admin's.
  w.tick(60_000);
  assert.equal(type(ed(alice, { closed: true }), 'ok').room, id);
  w.tick(60_000);
  assert.equal(type(ed(alice, { closed: false }), 'ok').room, id);
  w.tick(60_000);
  ed(alice, { closed: true });
  ed(boss, { closed: true });
  w.tick(60_000);
  assert.equal(code(ed(alice, { closed: false })), 'forbidden');
});

test('rooms: one account owns at most three times its open rooms in all, closed ones included', db, () => {
  const w = world({ CHAT_ROOMS_PER_USER: '1' });
  const alice = w.user('Alice'), boss = w.admin();
  const made = [];
  for (let i = 0; i < 3; i++) {
    w.tick(600_000);
    const id = type(w.do(alice, { t: 'mkroom', title: `轮换的房间 ${i}` }), 'ok').room;
    w.post(alice, id, 'so that it is never swept');
    w.tick(60_000);
    assert.equal(type(w.do(alice, { t: 'edroom', room: id, closed: true }), 'ok').room, id);
    made.push(id);
  }
  w.tick(600_000);
  assert.deepEqual(w.do(alice, { t: 'mkroom', title: '第四个', cid: 'r' }), [{ t: 'err', re: 'mkroom', code: 'rooms-max', cid: 'r' }]);
  assert.equal(w.rows("SELECT COUNT(*) AS n FROM rooms WHERE kind = 'user'")[0].n, 3);
  // What it has can still be used: opened again, renamed. With one removed by an admin there is room for a new one.
  assert.equal(type(w.do(alice, { t: 'edroom', room: made[0], closed: false, title: '换个名字再用' }), 'ok').room, made[0]);
  w.tick(60_000);
  w.do(alice, { t: 'edroom', room: made[0], closed: true });
  w.do(boss, { t: 'rmroom', room: made[1] });
  assert.match(type(w.do(alice, { t: 'mkroom', title: '第四个' }), 'ok').room, /^u/);
  assert.match(type(w.do(boss, { t: 'mkroom', title: '站长不受限' }), 'ok').room, /^u/);
});

test('names and room titles with characters nobody can see are refused', db, () => {
  const VS16 = cp(0xFE0F), CGJ = cp(0x34F), ZWJ = cp(0x200D), SHY = cp(0xAD), MVS = cp(0x180B), VS17 = cp(0xE0100), TAG = cp(0xE0061), ZWNJ = cp(0x200C);
  for (const hidden of [VS16, CGJ, ZWJ, SHY, MVS, VS17, TAG, ZWNJ]) {
    const hex = hidden.codePointAt(0).toString(16);
    assert.equal(invisible(`a${hidden}b`), true, hex);
    assert.equal(cleanName(`Fe${hidden}`), null, `name ending in ${hex}`);
    assert.equal(cleanName(`F${hidden}e`), null, `name with ${hex} inside`);
  }
  for (const fine of ['Fe', '阿澈', 'José', 'e' + cp(0x301) + 'e', 'عربى', '量子 化学 😀', 'a-b_c.d']) assert.equal(invisible(cleanLine(fine, 30).text), false, fine);
  const w = world();
  const boss = w.admin('Fe'), alice = w.user('Alice'), bob = w.user(null, { uid: 'bob000000001' });
  for (const hidden of [VS16, CGJ, MVS, VS17]) {
    assert.deepEqual(w.do(bob, { t: 'name', name: `Fe${hidden}` }), [{ t: 'err', re: 'name', code: 'name-bad' }], 'not the admin’s name with something unseen added');
    assert.equal(code(w.do(boss, { t: 'name', name: `F${hidden}e` })), 'name-bad', 'nor for an admin');
  }
  assert.equal(w.rows('SELECT COUNT(*) AS n FROM users WHERE uid = ?', bob.uid)[0].n, 0);
  const mk = (title, topic) => w.do(alice, { t: 'mkroom', title, topic });
  for (const title of [`大厅${VS16}`, `大${ZWJ}厅`, `Lob${SHY}by`, `大${CGJ}厅`, `Lobby${TAG}`, `量子化学与 DFT${VS17}`]) assert.equal(code(mk(title)), 'title-bad', [...title].map((c) => c.codePointAt(0).toString(16)).join(' '));
  assert.equal(w.rows("SELECT COUNT(*) AS n FROM rooms WHERE kind = 'user'")[0].n, 0);
  const id = type(mk('看得见的名字', `心 ${cp(0x2764)}${VS16}`), 'ok').room; // a topic is not a name: emoji may carry their selector
  w.tick(60_000);
  assert.equal(code(w.do(alice, { t: 'edroom', room: id, title: `大厅${VS16}` })), 'title-bad');
  assert.equal(code(w.do(boss, { t: 'edroom', room: id, title: `大厅${CGJ}` })), 'title-bad');
  assert.equal(w.hub.room(id).title, '看得见的名字');
});

test('a socket that was refused, or closed for flooding, costs nothing more: no storage, no answer, also after a sleep', db, () => {
  const w = world({ CHAT_MAX_SOCKETS: '2' });
  const a = w.open(), flooder = w.open(), refused = w.open();
  assert.deepEqual(refused.closed, [4001, 'full']);
  for (let i = 0; i < 41; i++) w.hub.message(flooder, '{"t":"who","room":"lobby"}');
  assert.deepEqual(flooder.closed, [4002, 'too many frames']);
  for (const ws of [a, flooder, refused]) ws.clear();
  w.log.length = 0;
  const frames = ['{"t":"join","room":"lobby"}', '{"t":"more","room":"lobby","before":9}', 'ping', 'x'.repeat(9000), '{"t":"say","room":"lobby","text":"hi"}'];
  for (const f of frames) { w.hub.message(flooder, f); w.hub.message(refused, f); }
  assert.deepEqual([w.log, flooder.sent, refused.sent, a.sent], [[], [], [], []]);
  // A sleep, and the frames keep coming: the new Hub does not even set up its tables for them.
  w.wake();
  for (const f of frames) { w.hub.message(flooder, f); w.hub.message(refused, f); }
  assert.deepEqual([w.log, flooder.sent, refused.sent, a.sent], [[], [], [], []]);
  w.shut(flooder);
  w.shut(refused);
  assert.deepEqual([w.log, a.sent], [[], []], 'nor for their close');
  assert.equal(w.do(a, { t: 'join', room: 'lobby' })[0].t, 'room', 'everyone else is served as before');
});
