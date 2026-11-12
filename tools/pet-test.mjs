// 小宠物（public/pet/pet-core.js）的纯逻辑：存档、随时间变化、动作、亲密度上限、等级和配饰、它说的话。
// node --test tools/pet-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { readFileSync, existsSync } from 'node:fs';

const require = createRequire(import.meta.url);
const C = require('../public/pet/pet-core.js');
const H = 3600e3;
const T0 = Date.UTC(2026, 10, 12, 9, 0, 0);

test('领养：三种吉祥物、名字清理、默认名字', () => {
  assert.deepEqual(C.KINDS.map((k) => k.id), ['budi', 'budi-plain', 'astra']);
  const s = C.fresh('astra', '  小​星\n星  ', T0);
  assert.equal(s.kind, 'astra');
  assert.equal(s.name, '小星 星');
  assert.equal(C.fresh('budi', '', T0).name, '苞苞');
  assert.equal(C.fresh('nope', 'x', T0).kind, 'budi');
  assert.equal([...C.cleanName('一二三四五六七八九十一二三四', 'budi')].length, C.NAME_MAX);
  assert.equal(C.cleanName('<b>‮', 'budi'), '<b>'); // 只清控制字符和方向符；转义交给界面
});

test('存档：坏数据读不出来，越界的数拉回范围，字段补齐', () => {
  assert.equal(C.parse('not json'), null);
  assert.equal(C.parse('{"kind":"dog","born":1}'), null);
  assert.equal(C.parse('{"kind":"budi"}'), null);
  assert.equal(C.parse('[]'), null);
  const s = C.parse(JSON.stringify({ kind: 'budi', born: T0, full: 500, joy: -3, xp: -9, acc: 'crown', count: 'x' }));
  assert.equal(s.full, 100);
  assert.equal(s.joy, 0);
  assert.equal(s.xp, 0);
  assert.equal(s.acc, '');
  assert.deepEqual(s.count, { pet: 0, feed: 0, play: 0 });
  const back = C.parse(JSON.stringify(C.fresh('budi-plain', '豆豆', T0)));
  assert.deepEqual(back, C.fresh('budi-plain', '豆豆', T0));
});

test('时间：一天不管饱腹慢慢掉、停在下限，不会死；睡觉回精力、睡满自己醒', () => {
  const s = C.fresh('budi', 'a', T0);
  const a = C.advance(s, T0 + 5 * H);
  assert.equal(a.full, 80 - 4 * 5);
  assert.equal(a.joy, 80 - 3 * 5);
  assert.equal(a.energy, 90 - 2.5 * 5);
  const week = C.advance(s, T0 + 7 * 24 * H);
  assert.equal(week.full, C.FLOOR.full);
  assert.equal(week.joy, C.FLOOR.joy);
  assert.equal(week.energy, C.FLOOR.energy);
  assert.equal(C.mood(week), 'hungry');
  // 时间倒流（换了设备时钟）不加不减
  assert.deepEqual(C.advance(s, T0 - H), { ...s, t: T0 });
  // 睡觉：精力 30 → 100 要 70/18 ≈ 3.9 小时，之后醒着按常速掉
  const tired = { ...s, energy: 30, asleep: true };
  const two = C.advance(tired, T0 + 2 * H);
  assert.equal(two.asleep, true);
  assert.equal(two.energy, 30 + 18 * 2);
  assert.equal(two.full, 80 - 2 * 2); // 睡着时饿得慢一半
  const ten = C.advance(tired, T0 + 10 * H);
  assert.equal(ten.asleep, false);
  const need = 70 / 18;
  assert.ok(Math.abs(ten.energy - (100 - 2.5 * (10 - need))) < 1e-9);
  // 原对象不变
  assert.equal(tired.energy, 30);
});

test('动作：喂食、玩耍、摸摸，各自的限制', () => {
  let s = C.fresh('budi', 'a', T0);
  let r = C.act(s, 'feed', T0, 'c60');
  assert.ok(r.ok);
  assert.equal(r.s.full, 90);
  assert.equal(r.s.joy, 94);
  assert.equal(r.xp, C.XP.feed);
  r = C.act(r.s, 'feed', T0 + 1000, 'benzene');
  assert.ok(r.ok); // 90 < 92 还能吃
  r = C.act(r.s, 'feed', T0 + 2000, 'benzene');
  assert.equal(r.ok, false);
  assert.equal(r.why, 'full');
  // 摸摸：8 秒里只算一次亲密度，心情照样涨
  s = C.fresh('astra', 'b', T0);
  const p1 = C.act(s, 'pet', T0);
  const p2 = C.act(p1.s, 'pet', T0 + 3000);
  const p3 = C.act(p2.s, 'pet', T0 + 3000 + C.PET_GAP);
  assert.deepEqual([p1.xp, p2.xp, p3.xp], [1, 0, 1]);
  assert.equal(p3.s.count.pet, 3);
  assert.equal(Math.round(p2.s.joy), 80 + 12);
  // 玩耍要有力气、不能太饿
  const weak = { ...s, energy: 10 };
  assert.equal(C.act(weak, 'play', T0).why, 'tired');
  const hungry = { ...s, full: 15 };
  assert.equal(C.act(hungry, 'play', T0).why, 'hungry');
  const pl = C.act(s, 'play', T0);
  assert.ok(pl.ok);
  assert.deepEqual([pl.s.joy, pl.s.energy, pl.s.full], [95, 80, 75]);
  // 睡着时不能喂和玩，可以摸，可以叫醒
  const zz = C.act(s, 'sleep', T0).s;
  assert.equal(zz.asleep, true);
  assert.equal(C.mood(zz), 'sleeping');
  assert.equal(C.act(zz, 'feed', T0, 'water').why, 'asleep');
  assert.equal(C.act(zz, 'play', T0).why, 'asleep');
  assert.ok(C.act(zz, 'pet', T0).ok);
  assert.equal(C.act(zz, 'sleep', T0).why, 'asleep');
  const up = C.act(zz, 'wake', T0 + H / 4);
  assert.ok(up.ok);
  assert.equal(up.s.asleep, false);
  assert.equal(C.act(up.s, 'wake', T0 + H / 4).why, 'awake');
  assert.equal(C.act(s, 'dance', T0).why, 'unknown');
});

test('亲密度：每天最多 60 点，第二天重新算；升级和配饰', () => {
  let s = C.fresh('budi', 'a', T0);
  let total = 0, t = T0;
  for (let i = 0; i < 40; i++) {
    t += C.PET_GAP;
    const r = C.act(s, 'pet', t, undefined, 0);
    s = r.s; total += r.xp;
  }
  for (let i = 0; i < 30; i++) {
    t += 60e3;
    s = { ...s, full: 20, energy: 100 }; // 让它一直能吃能玩
    total += C.act(s, 'feed', t, 'benzene', 0).xp;
    s = C.act(s, 'feed', t, 'benzene', 0).s;
  }
  assert.equal(s.dayXp, C.DAY_XP);
  assert.equal(s.xp, C.DAY_XP);
  // 第二天
  const r = C.act(s, 'feed', T0 + 24 * H, 'water', 0);
  assert.equal(r.xp, C.XP.feed);
  assert.equal(r.s.dayXp, C.XP.feed);
  // 等级表
  assert.equal(C.levelOf(0).level, 1);
  assert.equal(C.levelOf(19).level, 1);
  assert.equal(C.levelOf(20).level, 2);
  assert.equal(C.levelOf(60).level, 3);
  assert.equal(C.levelOf(200).level, 5);
  assert.equal(C.levelOf(70).progress, 10 / 60);
  // 升级的那一下 act 会报出来
  const near = { ...C.fresh('budi', 'a', T0), xp: 18 };
  const lv = C.act(near, 'play', T0, undefined, 0);
  assert.equal(lv.levelUp, 2);
  assert.deepEqual(C.unlocked(lv.s), ['goggles']);
  assert.deepEqual(C.unlocked({ ...near, xp: 200 }), ['goggles', 'cap', 'halo']);
  // 没解锁的配饰戴不上
  assert.equal(C.setAcc(near, 'halo').acc, '');
  assert.equal(C.setAcc(lv.s, 'goggles').acc, 'goggles');
  assert.equal(C.setAcc(C.setAcc(lv.s, 'goggles'), '').acc, '');
});

test('改名、换一只（进度保留）、在一起的天数', () => {
  const s = { ...C.fresh('budi', 'a', T0), xp: 77, acc: 'goggles' };
  const k = C.setKind(s, 'astra');
  assert.equal(k.kind, 'astra');
  assert.equal(k.xp, 77);
  assert.equal(k.acc, 'goggles');
  assert.equal(C.setKind(s, 'cat'), s);
  assert.equal(C.rename(s, '   ').name, '苞苞');
  assert.equal(C.daysTogether(s, T0), 1);
  assert.equal(C.daysTogether(s, T0 + 23 * H), 1);
  assert.equal(C.daysTogether(s, T0 + 49 * H), 3);
});

test('说的话：中英两版都有，睡着只说梦话，各自的台词只有自己说', () => {
  for (const f of C.FACTS) { assert.ok(f[0] && f[1]); assert.match(f[0], /[一-鿿]/); assert.doesNotMatch(f[1], /[一-鿿]/); }
  for (const list of Object.values(C.MOODS)) for (const f of list) assert.ok(f[0] && f[1]);
  for (const w of Object.values(C.WHY)) assert.ok(w[0] && w[1]);
  const zz = { ...C.fresh('budi', 'a', T0), asleep: true };
  for (let i = 0; i < 20; i++) assert.ok(C.MOODS.sleeping.some((m) => m[0] === C.line(zz, i / 20).zh));
  const astra = C.fresh('astra', 'a', T0), budi = C.fresh('budi', 'a', T0);
  const said = (s) => new Set(Array.from({ length: 200 }, (_, i) => C.line(s, i / 200).zh));
  const budiOnly = C.FACTS.filter((f) => f[2] === 'budi').map((f) => f[0]);
  const astraOnly = C.FACTS.filter((f) => f[2] === 'astra').map((f) => f[0]);
  for (const x of budiOnly) { assert.ok(!said(astra).has(x)); assert.ok(said(budi).has(x)); }
  for (const x of astraOnly) { assert.ok(!said(budi).has(x)); assert.ok(said(astra).has(x)); }
  // 简色版也是苞苞
  assert.ok(said(C.fresh('budi-plain', 'a', T0)).has(budiOnly[0]));
});

test('素材：每种都有图片和 3D 模型；同步清单里有这份存档', () => {
  for (const k of C.KINDS) {
    assert.ok(existsSync(new URL(`../public/pet/img/${k.id}.webp`, import.meta.url)), `${k.id}.webp`);
    const glb = readFileSync(new URL(`../public/pet/models/${k.id}.glb`, import.meta.url));
    assert.equal(glb.subarray(0, 4).toString('latin1'), 'glTF');
  }
  const sync = require('../public/sync/sync-core.js');
  const entry = sync.KEYS.find((x) => x.key === C.KEY);
  assert.ok(entry, 'molastria-pet in sync KEYS');
  assert.ok(sync.pageUses(entry, '/pet/'));
});
