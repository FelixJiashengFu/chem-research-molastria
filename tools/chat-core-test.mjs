// The discussion rooms' page logic (public/chat/chat-core.js): the tokeniser that turns a message into text, links
// and code, the copies of the server's rules, the reducer that folds server frames into the page's state, unread
// counts, grouping for display, the reconnect schedule and the sentence for every refusal.
// The server (deploy/chat.js) is loaded next to it, so the copies are checked against the original and every code
// the server can send is checked for a sentence in both languages.
//   node --test tools/chat-core-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync } from 'node:fs';
import * as server from '../deploy/chat.js';

const C = createRequire(import.meta.url)('../public/chat/chat-core.js');
const serverSource = readFileSync(new URL('../deploy/chat.js', import.meta.url), 'utf8');
const HAN = /[㐀-鿿]/;
const pageSource = readFileSync(new URL('../public/chat/chat.js', import.meta.url), 'utf8');
const cssSource = readFileSync(new URL('../public/chat/chat.css', import.meta.url), 'utf8');
const plain = (v) => JSON.parse(JSON.stringify(v)); // the tables keyed by id have no prototype; compare their contents

test('tokeniser: links, inline code and fenced blocks; everything else stays text', () => {
  const kinds = (s) => C.tokenize(s).map((k) => [k.t, k.s]);
  assert.deepEqual(kinds('plain <b>text</b> & more'), [['text', 'plain <b>text</b> & more']]);
  assert.deepEqual(kinds('see https://example.org/a?b=1, then'), [['text', 'see '], ['link', 'https://example.org/a?b=1'], ['text', ', then']]);
  // Chinese is written without spaces: the address ends where the Chinese starts, and at full-width punctuation
  assert.deepEqual(kinds('见https://molastria.com/manual/，然后'), [['text', '见'], ['link', 'https://molastria.com/manual/'], ['text', '，然后']]);
  assert.deepEqual(kinds('(https://en.wikipedia.org/wiki/Basis_set_(chemistry))'), [['text', '('], ['link', 'https://en.wikipedia.org/wiki/Basis_set_(chemistry)'], ['text', ')']]);
  assert.deepEqual(kinds('use `%maxcore 4000` here'), [['text', 'use '], ['code', '%maxcore 4000'], ['text', ' here']]);
  assert.deepEqual(kinds('`https://example.org` is code'), [['code', 'https://example.org'], ['text', ' is code']], 'nothing inside code is linked');
  const block = C.tokenize('result:\n```python\nprint(1)\nhttps://example.org\n```\ndone');
  assert.deepEqual(block.map((k) => [k.t, k.s, k.lang]), [['text', 'result:', undefined], ['pre', 'print(1)\nhttps://example.org', 'python'], ['text', 'done', undefined]]);
  assert.deepEqual(kinds('``` not a block'), [['text', '``` not a block']]);
  assert.deepEqual(C.tokenize(null), []);
  // whatever goes in comes out again, in order (nothing is dropped or doubled)
  for (const s of ['a https://x.org b `c` d', '多行\n```\n1\n2\n```\n完', 'x'.repeat(5000) + ' https://example.org/' + 'y'.repeat(3000)]) {
    assert.equal(C.tokenize(s).map((k) => k.s).join('').replace(/\s/g, ''), s.replace(/```\w*/g, '').replace(/`/g, '').replace(/\s/g, ''));
  }
});

test('links: only plain http(s) addresses with a real host become clickable', () => {
  assert.equal(C.safeHref('https://example.org/a?b=1#c'), 'https://example.org/a?b=1#c');
  assert.equal(C.safeHref('http://sub.example.org'), 'http://sub.example.org/');
  for (const bad of ['javascript:alert(1)', 'JAVASCRIPT:alert(1)', 'data:text/html,<script>', 'vbscript:x', 'file:///etc/passwd', 'ftp://example.org/', 'https://user:pass@example.org/', 'https://example.org@evil.example/'.replace('example.org@', 'u@'), 'https://localhost/', 'https://', 'example.org', '', null]) {
    assert.equal(C.safeHref(bad), '', String(bad));
  }
  for (const s of ['javascript:alert(1)', 'click data:text/html,<b>x</b>', 'https://user:pw@bank.example/login', 'http://localhost:8080/admin']) {
    assert.ok(C.tokenize(s).every((k) => k.t === 'text'), s);
  }
  assert.equal(C.trimUrl('https://a.org/x).'), 'https://a.org/x');
  assert.equal(C.trimUrl('https://a.org/x_(y)'), 'https://a.org/x_(y)');
});

test('the copies of the server\'s rules agree with the server', () => {
  assert.deepEqual(C.LIMITS, { text: 2000, name: [2, 20], title: [2, 30], topic: 120, rooms: 3 });
  for (const [name, n] of [['TEXT_MAX', C.LIMITS.text], ['NAME_MIN', C.LIMITS.name[0]], ['NAME_MAX', C.LIMITS.name[1]], ['TITLE_MIN', C.LIMITS.title[0]], ['TITLE_MAX', C.LIMITS.title[1]], ['TOPIC_MAX', C.LIMITS.topic]]) {
    assert.match(serverSource, new RegExp(`\\b${name} = ${n}\\b`), `${name} on the server is ${n}`);
  }
  // messages: what the page calls sendable, the server stores, and as the same text
  for (const s of ['hello', '  两边的空格  ', 'a\r\nb\tc', 'x\n\n\n\n\n\ny', 'zero\u200Bwidth', 'bidi\u202Eevil', 'e\u0301 combining', '', '   \n ', '\u0000\u0007', 'x'.repeat(2000), 'x'.repeat(2001), '字'.repeat(2000), '字'.repeat(2001), '😀'.repeat(2000), '😀'.repeat(2001)]) {
    const page = C.checkText(s), srv = server.cleanText(s);
    assert.equal(page.ok, !!srv.text, JSON.stringify(s.slice(0, 20)));
    if (page.ok) assert.equal(page.text, srv.text, JSON.stringify(s.slice(0, 20)));
    else assert.equal(page.code, srv.code, JSON.stringify(s.slice(0, 20)));
  }
  // nicknames: accepted by the page ⇔ accepted by the server for an ordinary account
  const names = ['Ada', '阿澈', 'wavefn_cat', 'J. Fu', 'a', '字', 'ab', 'x'.repeat(20), 'x'.repeat(21), '量'.repeat(20), '量'.repeat(21), 'two  spaces', ' padded ', '_under', '-dash', '.dot', '9lives',
    'emoji😀', 'semi;colon', '<b>', 'a@b.c', 'tab\there', 'Admin', 'ADMIN', 'ａｄｍｉｎ', 'a d m i n', 'a.d.m.i.n', 'ad_min', '站长', '站長', '管理员', '管理員', '官方客服', 'MolAstria', 'molastria_fan', 'the owner', 'system', '系统', '系統',
    'moderator1', 'official', 'Fe', 'é', 'e\u0301e', 'Ünïcödé', 'мир', 'عربى', '\u3164\u3164', '\u200B\u200B'];
  // invisible marks inside a name (variation selector, combining grapheme joiner, soft hyphen, word joiner): refused on both sides
  const cp = (...c) => String.fromCodePoint(...c);
  names.push('站' + cp(0xFE00) + '长', 'F' + cp(0x34F) + 'e', 'Ali' + cp(0xFE01) + 'ce', 'so' + cp(0xAD) + 'ft', 'wo' + cp(0x2060) + 'rd');
  for (const n of names) {
    const page = C.checkName(n), cleaned = server.cleanName(n);
    const srvOk = !!cleaned && !server.reservedName(server.keyOf(cleaned));
    assert.equal(page.ok, srvOk, `nickname ${JSON.stringify(n)}: page ${page.ok} (${page.why}), server ${srvOk}`);
    if (page.ok) { assert.equal(page.name, cleaned); assert.equal(page.key, server.keyOf(cleaned)); }
    else assert.ok(C.nameWhy(page.why, false) && C.nameWhy(page.why, true) && !HAN.test(C.nameWhy(page.why, true)), `a reason for ${JSON.stringify(n)}`);
  }
  assert.equal(C.checkName('admin', { admin: true }).ok, true, 'the owner may carry a reserved name');
  // room names and topics
  for (const s of ['VASP 表面计算互助', 'a', 'ab', 'x'.repeat(30), 'x'.repeat(31), '  two   words  ', 'line\nbreak', '', '大' + cp(0xFE00) + '厅', 'Lob' + cp(0x34F) + 'by']) {
    const page = C.checkTitle(s), srv = server.cleanLine(s, 30);
    const srvOk = !!srv.text && [...srv.text].length >= 2 && !server.invisible(srv.text);
    assert.equal(page.ok, srvOk, JSON.stringify(s));
    if (page.ok) assert.equal(page.title, srv.text);
  }
  assert.equal(C.checkTopic('x'.repeat(120)).ok, true);
  assert.equal(C.checkTopic('x'.repeat(121)).ok, false);
  assert.equal(C.checkTopic('').ok, true, 'a topic is optional');
  assert.equal(C.clip('一二三四五六七八九十', 5), server.clip('一二三四五六七八九十', 5));
});

test('every refusal the server can send has a sentence in both languages', () => {
  // The contract is the list in the header of deploy/chat.js; every code on it is also used somewhere in the code below it.
  const [head, body] = [serverSource.slice(0, serverSource.indexOf('*/')), serverSource.slice(serverSource.indexOf('*/'))];
  const sent = head.slice(head.indexOf('err 的 code：'), head.indexOf('被隐藏或删掉的消息')).match(/[a-z]+(?:-[a-z]+)*/g).filter((c) => c !== 'err' && c !== 'code');
  assert.ok(sent.length >= 28 && sent.includes('signin') && sent.includes('room-wait') && sent.includes('server'), sent.join(' '));
  for (const code of sent) assert.ok(body.includes(`'${code}'`), `"${code}" is in the contract but the server never sends it`);
  // "off" is never worded by code: the socket closes with 4003 and the page asks the summary why.
  for (const code of sent.filter((c) => c !== 'off')) assert.ok(C.ERRORS[code], `no sentence for "${code}"`);
  for (const code of C.ERR_CODES) assert.ok(C.ERRORS[code], code);
  for (const [code, pair] of Object.entries(C.ERRORS)) {
    assert.equal(pair.length, 2, code);
    assert.ok(HAN.test(pair[0]) && !HAN.test(pair[1]), `${code}: Chinese first, English second`);
    for (const en of [false, true]) {
      const s = C.errorText(code, { en, wait: 75, until: Date.UTC(2026, 10, 12, 9, 30), now: Date.UTC(2026, 10, 11, 9, 0), tz: 0 });
      assert.ok(s && !/[{}]|undefined|NaN/.test(s), `${code}: ${s}`);
      if (en) assert.ok(!HAN.test(s), `${code}: ${s}`);
    }
  }
  assert.equal(C.errorText('slow', { wait: 2 }), '发得太快了，2 秒后再发。');
  assert.equal(C.errorText('slow', { en: true, wait: 2 }), 'A little too fast. Try again in 2 s.');
  assert.match(C.errorText('never-heard-of-it', { en: true }), /never-heard-of-it/);
  assert.equal(C.errorText('muted', {}), C.ERRORS['muted-open'][0], 'a mute without an end time still reads as a sentence');
  assert.deepEqual([C.closeCode(4001), C.closeCode(4002), C.closeCode(1006)], ['full', 'kicked', '']);
});

const room = (id, more = {}) => ({ id, kind: 'official', title: id, topic: '', n: 0, last: 0, online: 0, closed: false, ...more });
const msg = (id, more = {}) => ({ id, room: 'qc', uid: 'u1', name: 'Ada', role: 'user', text: `m${id}`, t: 1000 * id, reply: null, ...more });
function connected(me = { uid: 'me', name: 'Me', role: 'user', muted: 0, banned: false, rooms: 0 }) {
  const s = C.createState();
  C.reduce(s, { t: 'hello', v: 1, state: 'on', auth: me ? 'ok' : 'none', me, rooms: [room('lobby'), room('qc', { n: 3 })], online: 4, limits: { text: 2000, name: [2, 20], title: [2, 30], topic: 120, rooms: 3 }, now: 5000 }, 4000);
  return s;
}

test('reducer: hello, joining a room, live messages, my own message and its refusal', () => {
  const s = connected();
  assert.deepEqual([s.ready, s.auth, s.me.name, s.rooms.length, s.online, s.skew], [true, 'ok', 'Me', 2, 4, 1000]);
  assert.deepEqual(C.enter(s, 'qc'), { t: 'join', room: 'qc' });
  assert.equal(C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(2), msg(1), msg(2), { id: 'x' }, msg(9, { room: 'lobby' })], more: true, online: 2 }).t, 'room');
  assert.deepEqual(s.logs.qc.msgs.map((m) => m.id), [1, 2], 'ascending, one per id, only this room, only well-formed');
  assert.deepEqual([s.logs.qc.more, s.logs.qc.loaded, C.roomById(s, 'qc').online], [true, true, 2]);
  // someone else speaks
  const ev = C.reduce(s, { t: 'msg', m: msg(3, { uid: 'u2', name: 'Ben' }) });
  assert.deepEqual([ev.isNew, ev.mine, C.roomById(s, 'qc').n, s.logs.qc.msgs.length], [true, false, 4, 3]);
  assert.equal(C.reduce(s, { t: 'msg', m: msg(3, { uid: 'u2', name: 'Ben' }) }).isNew, false, 'the same message twice is one message');
  assert.equal(C.roomById(s, 'qc').n, 4);
  // I speak: shown as pending at once, replaced by the server's copy
  const frame = C.say(s, { room: 'qc', text: 'hi', reply: { id: 3, name: 'Ben', text: 'm3' } }, 4000, () => 0.5);
  assert.deepEqual([frame.t, frame.room, frame.text, frame.reply, s.pending.length, s.pending[0].state], ['say', 'qc', 'hi', 3, 1, 'sending']);
  const mine = C.reduce(s, { t: 'msg', m: msg(4, { uid: 'me', name: 'Me', text: 'hi' }), cid: frame.cid });
  assert.deepEqual([mine.mine, mine.sent.cid, s.pending.length], [true, frame.cid, 0]);
  // refused: it leaves the pending list and comes back to the page with its text
  const again = C.say(s, { room: 'qc', text: 'too fast' }, 4001, () => 0.5);
  const no = C.reduce(s, { t: 'err', re: 'say', code: 'slow', wait: 2, cid: again.cid });
  assert.deepEqual([no.code, no.wait, no.lost.text, s.pending.length], ['slow', 2, 'too fast', 0]);
  // a message for a room that is not open only moves that room's counters
  assert.equal(C.reduce(s, { t: 'act', room: 'lobby', last: 9000, n: 5 }).room, 'lobby');
  assert.deepEqual([C.roomById(s, 'lobby').n, C.roomById(s, 'lobby').last], [5, 9000]);
  // malformed frames change nothing and do not throw
  for (const f of [null, 1, 'x', [], {}, { t: 5 }, { t: 'msg' }, { t: 'msg', m: { id: -1 } }, { t: 'room' }, { t: 'upd', m: {} }, { t: 'nope' }, { t: 'pres', room: 'nowhere' }]) assert.equal(C.reduce(s, f), null, JSON.stringify(f));
});

test('reducer: a deleted message loses its text everywhere, quotes included; a dropped connection fails what was in flight', () => {
  const s = connected();
  C.enter(s, 'qc');
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(1, { text: 'the original' }), msg(2, { uid: 'u2', name: 'Ben', reply: { id: 1, name: 'Ada', text: 'the original' } })], more: false, online: 1 });
  const ev = C.reduce(s, { t: 'upd', m: msg(1, { text: 'ignored', del: 1 }) });
  assert.deepEqual([ev.found, ev.quotes, s.logs.qc.msgs[0].text, s.logs.qc.msgs[0].del, s.logs.qc.msgs[1].reply.text], [true, [2], '', 1, '']);
  assert.equal(C.reduce(s, { t: 'upd', m: msg(2, { uid: 'u2', hidden: true }) }).m.hidden, true);
  // requests answered by ok / err are matched by cid, or by type when the server only names the type
  const f = C.ask(s, { t: 'name', name: 'New' }, 'ctx');
  assert.equal(s.waiting.length, 1);
  assert.equal(C.reduce(s, { t: 'ok', re: 'name', cid: f.cid }).req.ctx, 'ctx');
  C.ask(s, { t: 'report', id: 2 }, 'r');
  assert.equal(C.reduce(s, { t: 'err', re: 'report', code: 'self' }).req.ctx, 'r');
  assert.equal(s.waiting.length, 0);
  // the socket goes away
  C.say(s, { room: 'qc', text: 'unsent' });
  C.ask(s, { t: 'who', room: 'qc' }, 'w');
  const waiting = C.dropConnection(s);
  assert.deepEqual([s.ready, s.pending[0].state, s.pending[0].code, waiting.length, s.waiting.length], [false, 'failed', 'lost', 1, 0]);
  assert.deepEqual(C.rejoin(s), { t: 'join', room: 'qc' });
  // rooms that disappear take their logs and unsent messages with them
  const gone = C.reduce(s, { t: 'rooms', rooms: [room('lobby')] });
  assert.deepEqual([gone.gone, Object.keys(s.logs), s.pending.length], ['qc', [], 0]);
  // me: named for the first time, then wiped
  const g = connected({ uid: 'me', name: null, role: 'user', muted: 0, banned: false, rooms: 0 });
  assert.equal(C.reduce(g, { t: 'me', me: { uid: 'me', name: 'Now', role: 'user', muted: 0, banned: false, rooms: 0 } }).named, true);
  assert.equal(C.reduce(g, { t: 'me', me: { uid: 'me', name: null, role: 'user', muted: 0, banned: false, rooms: 0 } }).wiped, true);
  // a guest's hello never carries an identity, whatever the frame says
  const guest = C.createState();
  C.reduce(guest, { t: 'hello', auth: 'none', me: { uid: 'x', name: 'Fake', role: 'admin' }, rooms: [] });
  assert.equal(guest.me, null);
});

test('older messages, and coming back to a room without a hole in its history', () => {
  const s = connected();
  C.enter(s, 'qc');
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(51), msg(52)], more: true, online: 1 });
  assert.deepEqual(C.older(s, 'qc'), { t: 'more', room: 'qc', before: 51 });
  assert.equal(C.older(s, 'qc'), null, 'one request at a time');
  assert.equal(C.reduce(s, { t: 'older', room: 'qc', msgs: [msg(49), msg(50), msg(51)], more: false }).added, 2);
  assert.deepEqual([s.logs.qc.msgs.map((m) => m.id), s.logs.qc.more], [[49, 50, 51, 52], false]);
  assert.equal(C.older(s, 'qc'), null, 'nothing above');
  // reconnect: the batch overlaps what is held → the earlier part is kept
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(51), msg(52), msg(53)], more: true, online: 1 });
  assert.deepEqual(s.logs.qc.msgs.map((m) => m.id), [49, 50, 51, 52, 53]);
  // reconnect after a long time: the batch starts above everything held → start again from the batch
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(200), msg(201)], more: true, online: 1 });
  assert.deepEqual([s.logs.qc.msgs.map((m) => m.id), s.logs.qc.more], [[200, 201], true]);
  // a very long log lets go of its oldest part
  const log = { msgs: Array.from({ length: 650 }, (_, i) => msg(i + 1)), more: false };
  assert.equal(C.trimLog(log), 50);
  assert.deepEqual([log.msgs.length, log.msgs[0].id, log.more], [600, 51, true]);
});

test('unread: counted from where the reader last was; a room met for the first time starts read', () => {
  const prefs = C.emptyPrefs(), rooms = [room('lobby', { n: 10 }), room('qc', { n: 3 })];
  assert.equal(C.syncRead(prefs, rooms), true);
  assert.deepEqual([C.unread(prefs, rooms[0]), C.totalUnread(prefs, rooms)], [0, 0]);
  rooms[0].n = 14;
  assert.deepEqual([C.unread(prefs, rooms[0]), C.totalUnread(prefs, rooms), C.pageTitle('讨论室', 4), C.pageTitle('讨论室', 0), C.pageTitle('x', 120)], [4, 4, '(4) 讨论室', '讨论室', '(99+) x']);
  assert.equal(C.markRead(prefs, rooms[0], 77), true);
  assert.equal(C.markRead(prefs, rooms[0], 77), false);
  assert.equal(C.unread(prefs, rooms[0]), 0);
  // the divider goes above the first message after the mark that somebody else wrote
  const msgs = [msg(76), msg(77), msg(78, { uid: 'me' }), msg(79, { uid: 'u2' }), msg(80)];
  assert.equal(C.firstUnread(msgs, { n: 10, id: 77 }, 3, 'me'), 79);
  assert.equal(C.firstUnread(msgs, { n: 10, id: 0 }, 2, 'me'), 79, 'never opened before: the count says how far back');
  assert.equal(C.firstUnread(msgs, { n: 10, id: 80 }, 0, 'me'), 0);
  // rooms that are gone are forgotten; a count that went backwards starts over
  rooms[1].n = 1;
  assert.equal(C.syncRead(prefs, [rooms[1]]), true);
  assert.deepEqual(plain(prefs.read), { qc: { n: 1, id: 0 } });
  // stored preferences never break the page
  for (const raw of [null, undefined, 'not json', '[]', '{"read":5,"hide":"x"}', { room: '../../x', read: { 'bad id!': { n: 1 } }, hide: { 'u-1': 'x' } }]) assert.deepEqual(C.migratePrefs(raw), C.emptyPrefs());
  assert.deepEqual(plain(C.migratePrefs('{"room":"qc","uid":"abc123","read":{"qc":{"n":4,"id":9}},"hide":{"u1":"Ada"}}')), { v: 1, room: 'qc', uid: 'abc123', read: { qc: { n: 4, id: 9 } }, hide: { u1: 'Ada' } });
});

test('display: blocks by author, day lines, the "new" line, hidden people; who may do what', () => {
  const t0 = Date.UTC(2026, 10, 11, 10, 0);
  const list = [msg(1, { t: t0 }), msg(2, { t: t0 + 60_000 }), msg(3, { t: t0 + 120_000, uid: 'u2', name: 'Ben' }), msg(4, { t: t0 + 20 * 60_000 }), msg(5, { t: t0 + 21 * 60_000, reply: { id: 1, name: 'Ada', text: 'm1' } }), msg(6, { t: t0 + 26 * 3600_000 })];
  const rows = C.groupMessages(list, { tz: 0, newFrom: 4 });
  assert.deepEqual(rows.map((r) => (r.k === 'msg' ? `${r.m.id}${r.head ? 'H' : ''}` : r.k)), ['day', '1H', '2', '3H', 'new', '4H', '5H', 'day', '6H']);
  assert.deepEqual(C.groupMessages(list, { tz: 0, hide: { u2: 'Ben' } }).map((r) => r.k), ['day', 'msg', 'msg', 'hid', 'msg', 'msg', 'day', 'msg']);
  assert.equal(C.groupMessages(list, { tz: 0, hide: { u1: 'Ada' }, me: 'u1' }).filter((r) => r.k === 'hid').length, 0, 'nobody hides themselves');
  // the box at the bottom
  const s = connected();
  const qc = C.roomById(s, 'qc');
  assert.equal(C.composerState(C.createState(), qc), 'wait');
  assert.equal(C.composerState(connected(null), qc), 'guest');
  assert.equal(C.composerState(s, qc, 4000), 'ok');
  assert.equal(C.composerState(s, { ...qc, closed: true }, 4000), 'closed');
  s.me.muted = 9000;
  assert.equal(C.composerState(s, qc, 4000), 'muted', 'by the server\'s clock (this device is a second behind)');
  assert.equal(C.composerState(s, qc, 8500), 'ok');
  s.me.banned = true;
  assert.equal(C.composerState(s, qc, 8500), 'banned');
  // actions on a message
  const me = connected(), other = msg(1, { uid: 'u2' }), own = msg(2, { uid: 'me' });
  assert.deepEqual(C.actionsFor(me, other, qc, 4000), ['reply', 'copy', 'report', 'hide']);
  assert.deepEqual(C.actionsFor(me, own, qc, 4000), ['reply', 'copy', 'delete']);
  assert.deepEqual(C.actionsFor(me, { ...own, del: 1, text: '' }, qc, 4000), []);
  assert.deepEqual(C.actionsFor(connected(null), other, qc, 4000), ['copy', 'hide']);
  const admin = connected({ uid: 'boss', name: 'Fe', role: 'admin', muted: 0, banned: false, rooms: 0 });
  assert.deepEqual(C.actionsFor(admin, other, qc, 4000), ['reply', 'copy', 'report', 'delete', 'hide', 'mute1', 'mute24', 'mute168', 'ban', 'purge']);
  // rooms: the owner of a community room edits and closes it, only the site owner removes one, official rooms are the site owner's
  const mineRoom = { id: 'r1', kind: 'user', owner: 'me', closed: false };
  assert.deepEqual(C.roomRights(me, mineRoom), { edit: true, close: true, reopen: false, remove: false });
  assert.deepEqual(C.roomRights(me, { ...mineRoom, owner: 'u2' }), { edit: false, close: false, reopen: false, remove: false });
  assert.deepEqual(C.roomRights(me, { ...mineRoom, kind: 'official' }), { edit: false, close: false, reopen: false, remove: false });
  assert.deepEqual(C.roomRights(admin, { ...mineRoom, closed: true }), { edit: true, close: false, reopen: true, remove: true });
  assert.deepEqual(C.roomRights(admin, room('qc')), { edit: true, close: true, reopen: false, remove: false });
});

test('addresses, the connection and small helpers', () => {
  assert.deepEqual([C.parseHash('#r-qc'), C.parseHash('#mod'), C.parseHash('#r-../x'), C.parseHash(''), C.parseHash('#r-' + 'a'.repeat(41))], [{ room: 'qc', mod: false }, { room: '', mod: true }, { room: '', mod: false }, { room: '', mod: false }, { room: '', mod: false }]);
  assert.equal(C.roomHash('qc'), '#r-qc');
  assert.equal(C.wsUrl('https://api.molastria.com/'), 'wss://api.molastria.com/chat/ws');
  assert.equal(C.wsUrl('http://127.0.0.1:8842'), 'ws://127.0.0.1:8842/chat/ws');
  assert.deepEqual([C.wsProtocols('tok'), C.wsProtocols('')], [['molastria-chat', 't.tok'], ['molastria-chat']]);
  // reconnect: 0.5–1 s at first, doubling, never more than 30 s, and never the same for everybody
  assert.deepEqual([0, 1, 2, 5, 9, 50].map((n) => C.backoff(n, () => 0)), [500, 1000, 2000, 15000, 15000, 15000]);
  assert.deepEqual([0, 5].map((n) => C.backoff(n, () => 1)), [1000, 30000]);
  // every avatar colour carries white text at 4.5:1 or better
  const lum = (hex) => { const [r, g, b] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255).map((v) => (v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4)); return 0.2126 * r + 0.7152 * g + 0.0722 * b; };
  for (const c of C.PALETTE) assert.ok(1.05 / (lum(c) + 0.05) >= 4.5, c);
  assert.equal(C.avatarColor('u1'), C.avatarColor('u1'));
  assert.deepEqual([C.initial('ada'), C.initial(' 阿澈'), C.initial(''), C.initial(null)], ['A', '阿', '·', '·']);
  // times are written the same in every browser
  const now = Date.UTC(2026, 10, 11, 12, 0);
  assert.deepEqual([C.relTime(now - 20_000, now, false, 0), C.relTime(now - 5 * 60_000, now, true, 0), C.relTime(now - 3 * 3600_000, now, false, 0), C.relTime(now - 26 * 3600_000, now, true, 0), C.relTime(now - 3 * 86400_000, now, false, 0)], ['刚刚', '5 min', '09:00', 'Yesterday', '3 天前']);
  assert.deepEqual([C.dayLabel(now, now, false, 0), C.dayLabel(now - 86400_000, now, true, 0), C.clock(now, -480), C.waitText(75, true), C.waitText(7200, false)], ['今天', 'Yesterday', '20:00', '75 s', '2 小时']);
  // official rooms keep their order; community rooms follow, the busiest lately first; the filter reads names and topics in both languages
  const rooms = [room('lobby'), { ...room('r2'), kind: 'user', last: 5, title: 'VASP 互助' }, room('qc', { title_en: 'Quantum chemistry' }), { ...room('r1'), kind: 'user', last: 9, title: 'Reading group', owner_name: 'Mina' }];
  const sorted = C.sortRooms(rooms);
  assert.deepEqual([sorted.official.map((r) => r.id), sorted.community.map((r) => r.id)], [['lobby', 'qc'], ['r1', 'r2']]);
  assert.deepEqual([C.filterRooms(rooms, 'vasp').map((r) => r.id), C.filterRooms(rooms, 'QUANTUM').map((r) => r.id), C.filterRooms(rooms, 'mina').map((r) => r.id), C.filterRooms(rooms, '  ').length], [['r2'], ['qc'], ['r1'], 4]);
});

// ── Findings of the review of the first version ──────────────────────────

test('a link followed by thousands of closing brackets is trimmed in one pass', () => {
  // the rule itself, written the slow way, to compare with
  const slow = (str) => {
    const times = (x, ch) => x.split(ch).length - 1;
    let end = str.length;
    for (;;) {
      const ch = str[end - 1];
      if (ch && '.,;:!?'.includes(ch)) { end--; continue; }
      const open = { ')': '(', ']': '[', '}': '{' }[ch];
      if (open && times(str.slice(0, end), ch) > times(str.slice(0, end), open)) { end--; continue; }
      return str.slice(0, end);
    }
  };
  let seed = 7;
  const rand = (n) => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed % n; };
  for (let i = 0; i < 2000; i++) {
    const str = 'https://a.b/' + Array.from({ length: rand(14) }, () => 'ab()[]{}.,!?'[rand(12)]).join('');
    assert.equal(C.trimUrl(str), slow(str), str);
  }
  assert.equal(C.trimUrl('https://a.b/((x)).,)'), 'https://a.b/((x))');
  assert.equal(C.trimUrl('...'), '');
  const url = 'https://a.b/', t0 = performance.now();
  assert.deepEqual(C.tokenize(url + ')'.repeat(7000)).map((k) => [k.t, k.s.length]), [['link', url.length], ['text', 7000]]);
  assert.equal(C.trimUrl(url + ')'.repeat(200000)), url);
  assert.equal(C.trimUrl(url + '('.repeat(100000) + ')'.repeat(100001)).length, url.length + 200000);
  // the first version needed about 15 s for the 7000 alone; this is milliseconds
  assert.ok(performance.now() - t0 < 3000, `took ${Math.round(performance.now() - t0)} ms`);
});

test('links: text whose host is not the host the browser would open stays text', () => {
  // DIVISION SLASH and FRACTION SLASH look like "/" but are part of the host: the browser goes to evil.example
  for (const cp of [0x2215, 0x2044]) {
    const sl = String.fromCodePoint(cp), s = `https://molastria.com${sl}pro${sl}account.evil.example`;
    assert.ok(new URL(s).hostname.endsWith('.evil.example'), 'the browser reads it as a host under evil.example');
    assert.equal(C.safeHref(s), '', `U+${cp.toString(16)}`);
    assert.equal(C.safeHref(`${s}/login?x=1`), '');
    assert.ok(C.tokenize(`sign in at ${s} now`).every((k) => k.t === 'text'), `U+${cp.toString(16)} in a message`);
  }
  for (const bad of ['https://exa%6dple.org/', 'https://0x7f.0.0.1/', 'https:///example.org/x', 'https:example.org', 'https://example.org' + String.fromCodePoint(92) + '@evil.example/']) assert.equal(C.safeHref(bad), '', bad);
  // ordinary addresses are untouched, whatever the case, port or tail
  for (const [typed, href] of [['https://molastria.com/pro/account.html', 'https://molastria.com/pro/account.html'], ['HTTPS://Example.ORG:8443/a?b#c', 'https://example.org:8443/a?b#c'],
    ['http://example.org?q=1', 'http://example.org/?q=1'], ['https://example.org#top', 'https://example.org/#top'], ['https://doi.org/10.1021/acs.jctc.5c00001', 'https://doi.org/10.1021/acs.jctc.5c00001']]) assert.equal(C.safeHref(typed), href, typed);
});

test('reconnect: only a connection that stayed up starts the backoff over', () => {
  assert.equal(C.STABLE_MS, 30000);
  assert.deepEqual([C.settle(6, 0), C.settle(6, 29999), C.settle(6, 30000), C.settle(6, 3600000), C.settle(0, 5), C.settle(3, NaN)], [6, 6, 0, 0, 0, 3]);
  // a server that says hello and hangs up 100 ms later, for two minutes, at the fastest the random part allows
  let attempt = 0, clock = 0, tries = 0;
  while (clock < 120000) { tries++; clock += 100; attempt = C.settle(attempt, 100); clock += C.backoff(attempt++, () => 0); }
  assert.ok(tries <= 12, `${tries} connections in two minutes`);
  assert.match(pageSource, /if \(hadHello\) V\.attempt = C\.settle\(V\.attempt, Date\.now\(\) - helloAt\)/);
  const hello = pageSource.slice(pageSource.indexOf('function onHello('), pageSource.indexOf('function onRoom('));
  assert.ok(hello.includes('helloAt = Date.now()') && !hello.includes('V.attempt = 0'), 'a hello alone does not reset the counter');
});

test('after a dropped connection the room is replaced, not merged: what was deleted meanwhile does not stay', () => {
  const s = connected();
  C.enter(s, 'qc');
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(51), msg(52), msg(53)], more: true, online: 1 });
  C.older(s, 'qc');
  C.reduce(s, { t: 'older', room: 'qc', msgs: [msg(49, { text: 'deleted while I was away' }), msg(50)], more: false });
  C.enter(s, 'lobby');
  C.reduce(s, { t: 'room', room: 'lobby', msgs: [msg(7, { room: 'lobby' })], more: false, online: 1 });
  C.dropConnection(s);
  assert.deepEqual([s.logs.qc.stale, s.logs.lobby.stale, s.logs.qc.loaded], [true, true, true], 'still shown while reconnecting, but not to be trusted');
  // back in the other room first: its answer overlaps what is held, and still replaces it
  C.reduce(s, { t: 'hello', auth: 'none', rooms: [room('lobby'), room('qc', { n: 9 })], now: 5000 }, 4000);
  C.enter(s, 'qc');
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(52), msg(53), msg(54)], more: true, online: 1 });
  assert.deepEqual([s.logs.qc.msgs.map((m) => m.id), s.logs.qc.more, s.logs.qc.stale], [[52, 53, 54], true, false]);
  assert.ok(!s.logs.qc.msgs.some((m) => m.text === 'deleted while I was away'));
  assert.equal(C.roomById(s, 'qc').n, 9, 'unread counts come from the new room list');
  // the same when the reader stayed in the room (rejoin)
  const r = connected();
  C.enter(r, 'qc');
  C.reduce(r, { t: 'room', room: 'qc', msgs: [msg(1), msg(2), msg(3)], more: false, online: 1 });
  C.dropConnection(r);
  assert.deepEqual(C.rejoin(r), { t: 'join', room: 'qc' });
  C.reduce(r, { t: 'room', room: 'qc', msgs: [msg(3), msg(4)], more: true, online: 1 });
  assert.deepEqual([r.logs.qc.msgs.map((m) => m.id), r.logs.qc.more], [[3, 4], true]);
});

test('"load earlier" that the server refuses can be asked again', () => {
  const s = connected();
  C.enter(s, 'qc');
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(51), msg(52)], more: true, online: 1 });
  assert.ok(C.older(s, 'qc'));
  assert.equal(s.logs.qc.older, true);
  const ev = C.reduce(s, { t: 'err', re: 'more', code: 'server' }); // as the server sends it: no cid, no room
  assert.deepEqual([ev.t, ev.re, ev.code, s.logs.qc.older], ['err', 'more', 'server', false]);
  assert.deepEqual(C.older(s, 'qc'), { t: 'more', room: 'qc', before: 51 });
  // the page draws the button again and says why
  const onErr = pageSource.slice(pageSource.indexOf('function onErr('), pageSource.indexOf('function reload('));
  assert.match(onErr, /if \(ev\.re === 'more'\) renderLog\('keep'\);[^\n]*\n\s*fail\(ev\);/);
});

test('hostile or broken server frames: room ids, times, sizes, and a list of people nobody asked for', () => {
  assert.deepEqual(['qc', 'u1a2b3c4d', 'A-b_9', '__proto__', 'a b', '', 'x'.repeat(41), '../x', 5, null].map(C.isRoomId), [true, true, true, false, false, false, false, false, false, false]);
  const s = C.createState();
  const evil = ['__proto__', 'constructor', 'toString', 'hasOwnProperty'];
  C.reduce(s, { t: 'hello', auth: 'ok', me: { uid: 'me', name: 'Me', muted: 1e300 }, now: 5000,
    rooms: [room('qc'), room('qc', { title: 'twice' }), room('bad id'), room(''), ...evil.map((id) => room(id, { last: 1e300, n: 2 }))] }, 4000);
  assert.deepEqual(s.rooms.map((r) => r.id), ['qc', 'constructor', 'toString', 'hasOwnProperty'], 'one per id, no "__proto__", nothing malformed');
  assert.ok(s.rooms.every((r) => r.last <= Date.UTC(2100, 0, 1)) && s.me.muted <= Date.UTC(2100, 0, 1));
  // ids that are also names on Object.prototype behave like any other id
  const prefs = C.emptyPrefs();
  C.syncRead(prefs, s.rooms);
  s.rooms.find((r) => r.id === 'constructor').n = 5;
  assert.deepEqual([C.unread(prefs, s.rooms[1]), C.totalUnread(prefs, s.rooms)], [3, 3]);
  assert.equal(C.groupMessages([msg(1, { uid: 'constructor' })], { tz: 0, hide: prefs.hide }).filter((r) => r.k === 'hid').length, 0, 'nobody is hidden by an empty list');
  for (const id of ['constructor', 'toString']) {
    C.enter(s, id);
    assert.equal(C.older(s, id), null);
    assert.equal(C.reduce(s, { t: 'room', room: id, msgs: [msg(1, { room: id })], more: false, online: 1 }).room, id);
    assert.equal(s.logs[id].msgs.length, 1);
  }
  assert.equal(C.reduce(s, { t: 'room', room: '__proto__', msgs: [msg(1, { room: '__proto__' })], more: false }), null);
  assert.equal(C.reduce(s, { t: 'msg', m: msg(9, { room: '__proto__' }) }), null);
  assert.equal(C.reduce(s, { t: 'room', room: 'nowhere', msgs: [], more: false }), null, 'neither the room being joined nor one on the list');
  assert.equal(Object.getPrototypeOf(s.logs), null);
  assert.equal(({}).msgs, undefined, 'Object.prototype is untouched');
  // times: whatever arrives can be formatted
  C.enter(s, 'qc');
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(1, { t: 1e300 }), msg(2, { t: -1e300 }), msg(3, { t: 8.64e15 + 1 }), msg(4, { t: 'x' })], more: false, online: 1 });
  for (const m of s.logs.qc.msgs) {
    assert.ok(m.t >= 0 && m.t <= Date.UTC(2100, 0, 1), String(m.t));
    assert.doesNotThrow(() => [new Date(m.t).toISOString(), C.fullTime(m.t, 0), C.clock(m.t), C.dayLabel(m.t, Date.now(), true), C.relTime(m.t, Date.now(), false)]);
  }
  assert.equal(C.reduce(s, { t: 'act', room: 'qc', last: 1e300, n: 4 }).room, 'qc');
  assert.ok(C.roomById(s, 'qc').last <= Date.UTC(2100, 0, 1));
  // sizes: one frame adds a bounded amount
  const many = Array.from({ length: 5000 }, (_, i) => msg(i + 1));
  C.reduce(s, { t: 'room', room: 'qc', msgs: many, more: true, online: 1 });
  assert.equal(s.logs.qc.msgs.length, C.MAX_BATCH);
  assert.equal(C.reduce(s, { t: 'older', room: 'qc', msgs: [msg(0.5)], more: true }), null, 'nothing was asked for');
  const top = s.logs.qc.msgs[0].id + 10000;
  C.reduce(s, { t: 'room', room: 'qc', msgs: [msg(top)], more: true, online: 1 });
  C.older(s, 'qc');
  assert.equal(C.reduce(s, { t: 'older', room: 'qc', msgs: many, more: true }).added, C.MAX_BATCH);
  C.reduce(s, { t: 'rooms', rooms: Array.from({ length: 5000 }, (_, i) => room(`r${i}`)) });
  assert.equal(s.rooms.length, C.MAX_ROOMS);
  assert.deepEqual([C.MAX_BATCH, C.MAX_ROOMS, C.MAX_PEOPLE], [200, 500, 500]);
  // who: only the answer to a question opens the list
  const w = connected();
  C.enter(w, 'qc');
  const people = { t: 'who', room: 'qc', users: Array.from({ length: 2000 }, (_, i) => ({ uid: `u${i}`, name: 'x' })), guests: 2 };
  assert.equal(C.reduce(w, people), null, 'not asked for');
  assert.equal(w.who, null);
  assert.deepEqual(C.askWho(w, 'qc'), { t: 'who', room: 'qc' });
  assert.equal(C.reduce(w, { ...people, room: 'lobby' }), null, 'asked about another room');
  assert.equal(C.reduce(w, people).room, 'qc');
  assert.equal(w.who.users.length, C.MAX_PEOPLE);
  assert.equal(C.reduce(w, people), null, 'one answer per question');
  C.askWho(w, 'qc'); C.dropConnection(w);
  assert.equal(C.reduce(w, people), null, 'a question from before the connection dropped');
  assert.match(pageSource, /send\(C\.askWho\(S, room\.id\)\)/);
  assert.ok(!/send\(\{ t: 'who'/.test(pageSource));
});

test('hidden people and drafts belong to the account, not the device', () => {
  const prefs = C.migratePrefs('{"room":"qc","read":{"qc":{"n":4,"id":9}},"hide":{"u1":"Ada"}}');
  assert.equal(C.switchAccount(prefs, null), '', 'a guest changes nothing');
  assert.equal(C.switchAccount(prefs, 'alice1'), 'first');
  assert.deepEqual([prefs.uid, plain(prefs.hide)], ['alice1', { u1: 'Ada' }], 'the first account seen keeps what was there');
  assert.equal(C.switchAccount(prefs, 'alice1'), '');
  assert.equal(C.switchAccount(prefs, ''), '', 'signing out keeps the list for when the same account comes back');
  assert.equal(C.switchAccount(prefs, 'bob222'), 'switched');
  assert.deepEqual([prefs.uid, plain(prefs.hide), plain(prefs.read), prefs.room], ['bob222', {}, { qc: { n: 4, id: 9 } }, 'qc'], 'only the hidden list goes');
  assert.equal(C.migratePrefs(JSON.stringify(prefs)).uid, 'bob222', 'and it is remembered');
  assert.equal(C.switchAccount(prefs, '__proto__'), '');
  const hello = pageSource.slice(pageSource.indexOf('function onHello('), pageSource.indexOf('function onRoom('));
  assert.match(hello, /C\.switchAccount\(prefs, uid\)/);
  assert.match(hello, /for \(const k of Object\.keys\(drafts\)\) delete drafts\[k\];\s*saveDrafts\(\);/);
});

// What follows cannot run without a browser; these read the page and the stylesheet for the fix itself.
test('page and stylesheet: keyboard reach, focus, sleep, clicks, the ban button, long titles', () => {
  const rule = (sel) => { const i = cssSource.indexOf(`\n${sel}{`); assert.ok(i >= 0, sel); return cssSource.slice(i + 1, cssSource.indexOf('}', i) + 1); };
  // message actions stay in the Tab order: never display:none, shown when the row or the buttons hold focus
  assert.ok(!/\.ch-acts\{[^}]*display:none/.test(cssSource.replace(/@media print\{[^\n]*/, '')), '.ch-acts is not hidden with display:none');
  assert.match(rule('.ch-acts'), /display:flex/);
  assert.match(cssSource, /@media \(hover:hover\)\{\s*\.ch-acts\{opacity:0;pointer-events:none\}\s*\.ch-msg:hover \.ch-acts,\.ch-msg:focus-within \.ch-acts,\.ch-acts:focus-within,\.ch-acts\[data-open\]\{opacity:1;pointer-events:auto\}/);
  // a long unbroken room name wraps in the opening block and cannot widen the header
  assert.match(rule('.ch-top h3'), /overflow-wrap:anywhere/);
  assert.match(rule('.ch-top'), /grid-template-columns:minmax\(0,1fr\)/);
  assert.match(rule('.ch-head-t'), /min-width:0.*grid-template-columns:minmax\(0,1fr\)/);
  // the message box keeps focus, text and selection when it is built again
  const composer = pageSource.slice(pageSource.indexOf('function renderComposer('), pageSource.indexOf('function renderReply('));
  assert.match(composer, /const held = ta && document\.activeElement === ta \?/);
  assert.match(composer, /if \(held && held\.room === room\.id\) \{\s*ta\.value = held\.text;\s*ta\.focus\(\{ preventScroll: true \}\);\s*try \{ ta\.setSelectionRange\(held\.from, held\.to\); \}/);
  // a tab opened in the background waits until it is looked at
  assert.match(pageSource, /if \(document\.visibilityState === 'hidden'\) \{ V\.asleep = true; setConn\('asleep'\); \} else connect\(\);\s*\}\)\(\);\s*$/);
  assert.match(pageSource, /if \(V\.asleep\) reconnectNow\(\);/);
  // the room list is not rebuilt under a pressed pointer
  assert.match(pageSource, /roomsEl\.addEventListener\('pointerdown', \(\) => \{ roomsHeld = true; \}\);/);
  assert.match(pageSource, /function renderRooms\(\) \{\s*if \(roomsHeld\) \{ roomsDue = true; return; \}/);
  assert.match(pageSource, /for \(const type of \['pointerup', 'pointercancel'\]\) addEventListener\(type, roomsRelease, true\);/);
  // an owner's action reports whether it worked, and Ban on a report only goes on when it did
  assert.match(pageSource, /const modCall = [^\n]*return true; \}, \(ev\) => \{ fail\(ev\); return false; \}\);/);
  const ban = pageSource.slice(pageSource.indexOf('async function ban('), pageSource.indexOf('async function purge('));
  assert.ok(/return modCall\(\{ t: 'mod', op: 'ban'/.test(ban) && !/return true;/.test(ban), 'ban() resolves to what the server said');
  assert.match(pageSource, /if \(await ban\(r\.m\.uid, who\)\) resolve\('delete'\)/);
  // no raw invisible characters in the files (escapes in source must stay escapes)
  const coreSource = readFileSync(new URL('../public/chat/chat-core.js', import.meta.url), 'utf8');
  for (const [name, src] of [['chat-core.js', coreSource], ['chat.js', pageSource], ['chat.css', cssSource]]) assert.ok(!/[\p{Cc}\p{Cf}\p{Zl}\p{Zp}]/u.test(src.replace(/[\n]/g, '')), `${name} holds a raw control or format character`);
});
