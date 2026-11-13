/* 小宠物（/pet/）的纯逻辑：存档的样子、随时间慢慢变化、摸摸 / 喂食 / 玩耍 / 睡觉、等级和装扮、它会说的话。
   没有 DOM，浏览器里挂在 window.MolAstriaPetCore，Node 里 module.exports；tools/pet-test.mjs 测。
   设计上不让宠物“生病”或“死掉”：饱腹和心情最低停在 10，放着不管只会变得没精神，回来喂一口就好。
   一天能攒的亲密度有上限（DAY_XP），所以升级靠的是常来看看，不是连点。 */
(function (root) {
  'use strict';
  const KEY = 'molastria-pet';
  const BUDDY_KEY = 'molastria-pet-buddy'; // "off" = 别的页面不显示右下角的小伙伴
  const HOUR = 3600e3, DAY = 24 * HOUR;

  const KINDS = [
    { id: 'budi', zh: '苞苞', en: 'Budi', note: ['牵牛花的花苞：香槟白的身体、金色螺旋纹、祖母绿花萼', 'A morning-glory bud: champagne body, gold swirls, emerald calyx'] },
    { id: 'budi-plain', zh: '苞苞 · 简色', en: 'Budi · Simple', note: ['同一个花苞，去掉螺旋纹和腮红，干干净净', 'The same bud without swirls or blush, clean and simple'] },
    { id: 'budi-midnight', zh: '苞苞 · 午夜金', en: 'Budi · Midnight Gold', note: ['照“午夜金”重瓣矮牵牛配的色：深紫近黑的身体，奶金色的纹', 'Coloured after the Midnight Gold double petunia: violet-black body, cream-gold swirls'] },
    { id: 'budi-rose', zh: '苞苞 · 胭脂', en: 'Budi · Rose', note: ['照粉色牵牛花配的色：玫红的花冠，雪白的花喉', 'Coloured after a pink morning glory: rose-pink petals, a white throat'] },
    { id: 'astra', zh: '星环', en: 'Astra', note: ['照 MolAstria 徽标长的：金色六边形、圆环里的脸、轨道和四角星', 'Built from the MolAstria emblem: gold hexagon, a face in the ring, an orbit and a star'] },
  ];
  const SNACKS = [
    { id: 'benzene', zh: '苯环饼干', en: 'Benzene cookie', full: 24, joy: 4, energy: 0 },
    { id: 'water', zh: '水分子果冻', en: 'Water jelly', full: 14, joy: 6, energy: 6 },
    { id: 'c60', zh: '富勒烯糖球', en: 'Buckyball candy', full: 10, joy: 14, energy: 0 },
  ];
  const ACCS = [
    { id: 'goggles', zh: '护目镜', en: 'Safety goggles', level: 2 },
    { id: 'cap', zh: '学位帽', en: 'Graduation cap', level: 3 },
    { id: 'halo', zh: '星光环', en: 'Star halo', level: 5 },
  ];
  // 每小时的变化。饱腹 100 → 10 大约 22 小时，也就是一天喂一次就够。
  const RATE = { full: -4, joy: -3, energy: -2.5, sleep: 18 };
  const FLOOR = { full: 10, joy: 10, energy: 5 };
  const DAY_XP = 60;
  const XP = { pet: 1, feed: 3, play: 4 };
  const PET_GAP = 8e3; // 摸摸在 8 秒里只算一次亲密度
  const NAME_MAX = 12;

  const kindOf = (id) => KINDS.find((k) => k.id === id) || null;
  const clamp = (v, lo, hi) => Math.min(hi, Math.max(lo, v));
  const num = (v, d) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  /** 本地日期（YYYY-MM-DD）；offset 是分钟（同 Date#getTimezoneOffset），测试里可以固定。 */
  const dayKey = (now, offset = new Date(now).getTimezoneOffset()) => new Date(now - offset * 60e3).toISOString().slice(0, 10);

  /** 名字：去掉控制字符和首尾空白，最多 12 个字；空了就用这一种的名字。 */
  function cleanName(name, kind) {
    const s = [...String(name ?? '').replace(/\s+/g, ' ').replace(/[\u0000-\u001f\u007f-\u009f\u200b-\u200f\u2028-\u202e\u2066-\u2069]/g, '').trim()].slice(0, NAME_MAX).join('').trim();
    return s || kindOf(kind)?.zh || KINDS[0].zh;
  }

  function fresh(kind, name, now) {
    const k = kindOf(kind) ? kind : KINDS[0].id;
    return { v: 1, kind: k, name: cleanName(name, k), born: now, t: now, full: 80, joy: 80, energy: 90, xp: 0, day: '', dayXp: 0, asleep: false, acc: '', lastPet: 0, count: { pet: 0, feed: 0, play: 0 } };
  }

  /** 读存档（字符串或对象）；看不懂就返回 null。缺的字段补上，越界的数拉回范围。 */
  function parse(raw) {
    let o = raw;
    if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return null; } }
    if (!o || typeof o !== 'object' || Array.isArray(o) || !kindOf(o.kind)) return null;
    const born = num(o.born, 0);
    if (!born) return null;
    const c = o.count && typeof o.count === 'object' ? o.count : {};
    return {
      v: 1, kind: o.kind, name: cleanName(o.name, o.kind), born, t: num(o.t, born),
      full: clamp(num(o.full, 60), 0, 100), joy: clamp(num(o.joy, 60), 0, 100), energy: clamp(num(o.energy, 60), 0, 100),
      xp: Math.max(0, Math.floor(num(o.xp, 0))), day: typeof o.day === 'string' ? o.day : '', dayXp: Math.max(0, num(o.dayXp, 0)),
      asleep: o.asleep === true, acc: ACCS.some((a) => a.id === o.acc) ? o.acc : '', lastPet: num(o.lastPet, 0),
      count: { pet: Math.max(0, num(c.pet, 0)), feed: Math.max(0, num(c.feed, 0)), play: Math.max(0, num(c.play, 0)) },
    };
  }

  /** 一个数按 rate（每小时）走 h 小时，碰到 floor 就停；本来就在 floor 以下的不会被抬上去。 */
  const drift = (v, rate, h, floor) => (v <= floor ? v : Math.max(floor, v + rate * h));

  /** 把状态推进到 now（不改原对象）。睡着时精力回升，回满就自己醒。最多推进 60 天。 */
  function advance(s, now) {
    const o = { ...s, count: { ...s.count } };
    let h = clamp((now - s.t) / HOUR, 0, 60 * 24);
    if (o.asleep) {
      const need = (100 - o.energy) / RATE.sleep; // 睡满要几个小时
      const slept = Math.min(h, need);
      o.energy = Math.min(100, o.energy + RATE.sleep * slept);
      // 睡着时饿得慢一半，心情不掉
      o.full = drift(o.full, RATE.full / 2, slept, FLOOR.full);
      if (h >= need) { o.asleep = false; h -= need; } else h = 0;
    }
    if (h > 0) {
      o.full = drift(o.full, RATE.full, h, FLOOR.full);
      o.joy = drift(o.joy, RATE.joy * (o.full < 30 ? 1.5 : 1), h, FLOOR.joy);
      o.energy = drift(o.energy, RATE.energy, h, FLOOR.energy);
    }
    o.t = Math.max(s.t, now);
    return o;
  }

  /** 等级：升到 n 级要 10·n·(n−1) 点亲密度（2 级 20，3 级 60，4 级 120，5 级 200……）。 */
  const need = (n) => 10 * n * (n - 1);
  function levelOf(xp) {
    let n = 1;
    while (need(n + 1) <= xp) n++;
    return { level: n, from: need(n), to: need(n + 1), progress: (xp - need(n)) / (need(n + 1) - need(n)) };
  }
  const unlocked = (s) => ACCS.filter((a) => levelOf(s.xp).level >= a.level).map((a) => a.id);

  /** 加亲密度，算上每天的上限。返回实际加了多少。 */
  function gain(o, n, now, offset) {
    const d = dayKey(now, offset);
    if (o.day !== d) { o.day = d; o.dayXp = 0; }
    const add = Math.max(0, Math.min(n, DAY_XP - o.dayXp));
    o.dayXp += add;
    o.xp += add;
    return add;
  }

  /**
   * 做一个动作。返回 { s, ok, why, xp, levelUp }；ok 为 false 时 s 只推进了时间，why 说明原因：
   * asleep（睡着了）、full（吃不下了）、tired（太累了）、hungry（饿了，先吃东西）、awake（本来就醒着）、unknown。
   */
  function act(state, action, now, arg, offset) {
    const s = advance(state, now);
    const before = levelOf(s.xp).level;
    const done = (xp, extra = {}) => {
      const lv = levelOf(s.xp).level;
      return { s, ok: true, why: '', xp, levelUp: lv > before ? lv : 0, ...extra };
    };
    const no = (why) => ({ s, ok: false, why, xp: 0, levelUp: 0 });
    if (action === 'pet') {
      s.joy = clamp(s.joy + (s.asleep ? 2 : 6), 0, 100);
      s.count.pet++;
      let xp = 0;
      if (now - s.lastPet >= PET_GAP) { s.lastPet = now; xp = gain(s, XP.pet, now, offset); }
      return done(xp);
    }
    if (action === 'feed') {
      if (s.asleep) return no('asleep');
      const sn = SNACKS.find((x) => x.id === arg) || SNACKS[0];
      if (s.full >= 92) return no('full');
      s.full = clamp(s.full + sn.full, 0, 100);
      s.joy = clamp(s.joy + sn.joy, 0, 100);
      s.energy = clamp(s.energy + sn.energy, 0, 100);
      s.count.feed++;
      return done(gain(s, XP.feed, now, offset), { snack: sn.id });
    }
    if (action === 'play') {
      if (s.asleep) return no('asleep');
      if (s.full < 20) return no('hungry');
      if (s.energy < 15) return no('tired');
      s.joy = clamp(s.joy + 15, 0, 100);
      s.energy = clamp(s.energy - 10, 0, 100);
      s.full = clamp(s.full - 5, 0, 100);
      s.count.play++;
      return done(gain(s, XP.play, now, offset));
    }
    if (action === 'sleep') {
      if (s.asleep) return no('asleep');
      s.asleep = true;
      return done(0);
    }
    if (action === 'wake') {
      if (!s.asleep) return no('awake');
      s.asleep = false;
      return done(0);
    }
    return no('unknown');
  }

  /** 现在的样子：sleeping / hungry / tired / sad / happy / ok。 */
  function mood(s) {
    if (s.asleep) return 'sleeping';
    if (s.full < 30) return 'hungry';
    if (s.energy < 20) return 'tired';
    if (s.joy < 30) return 'sad';
    if (s.joy >= 70 && s.full >= 50) return 'happy';
    return 'ok';
  }

  const rename = (s, name) => ({ ...s, name: cleanName(name, s.kind) });
  const setKind = (s, kind) => (kindOf(kind) ? { ...s, kind } : s);
  const setAcc = (s, acc) => (acc === '' || unlocked(s).includes(acc) ? { ...s, acc } : s);
  /** 在一起的第几天（领养当天是第 1 天）。 */
  const daysTogether = (s, now) => Math.max(1, Math.floor((now - s.born) / DAY) + 1);

  // 它会说的话。知识类的每一句都是能查到的事实；带 kind 的只有那一种会说。
  const FACTS = [
    ['一摩尔大约是 6.022×10²³ 个粒子。', 'A mole is about 6.022×10²³ particles.'],
    ['氢原子基态的能量是 −13.6 eV。', 'The hydrogen atom’s ground state sits at −13.6 eV.'],
    ['水分子的键角大约是 104.5°。', 'Water’s bond angle is about 104.5°.'],
    ['C₆₀ 有 12 个五边形和 20 个六边形，像一只足球。', 'C₆₀ has 12 pentagons and 20 hexagons, like a football.'],
    ['金是黄色的，和相对论效应有关：6s 轨道收缩了。', 'Gold looks yellow because of relativity: its 6s orbital contracts.'],
    ['密度泛函理论的主角是电子密度，不是波函数。', 'In density functional theory the star is the electron density, not the wavefunction.'],
    ['Hartree–Fock 让每个电子只感受其他电子的平均场。', 'Hartree–Fock lets each electron feel only the average field of the others.'],
    ['液氮在 −196 °C 沸腾。', 'Liquid nitrogen boils at −196 °C.'],
    ['1 Hartree 大约是 27.2 eV。', 'One hartree is about 27.2 eV.'],
    ['苯的六个 C–C 键一样长，大约 1.39 Å。', 'All six C–C bonds in benzene are the same length, about 1.39 Å.'],
    ['电子的自旋是 ½，所以一个轨道最多住两个电子。', 'Electrons have spin ½, so one orbital holds at most two of them.'],
    ['牵牛花清早开花，英文叫 morning glory。', 'Morning glories open early in the day, hence the name.', 'budi'],
    ['我是一朵还没开的牵牛花。', 'I am a morning glory that has not opened yet.', 'budi'],
    ['我身上的六边形和苯环一样有六条边。', 'My hexagon has six sides, just like a benzene ring.', 'astra'],
    ['我的轨道上有一颗小行星，转一圈要好一会儿。', 'A little planet rides my orbit; one lap takes a while.', 'astra'],
  ];
  const MOODS = {
    sleeping: [['呼……呼……', 'Zzz…'], ['（睡得正香）', '(fast asleep)']],
    hungry: [['肚子咕咕叫了。', 'My tummy is rumbling.'], ['想吃一块苯环饼干。', 'A benzene cookie would be nice.']],
    tired: [['有点困了……', 'Getting a bit sleepy…'], ['可以让我睡一会儿吗？', 'Could I take a nap?']],
    sad: [['好久没人陪我玩了。', 'Nobody has played with me for a while.'], ['摸摸我好不好？', 'Pat me, please?']],
    happy: [['今天也一起做研究吧！', 'Let’s do some research today!'], ['你来啦！', 'You’re here!']],
    ok: [['今天想学点什么？', 'What shall we learn today?'], ['我在这儿陪着你。', 'I’m right here with you.']],
  };
  const WHY = {
    asleep: ['它睡着了，先让它睡一会儿。', 'It’s asleep. Let it rest for a bit.'],
    full: ['吃不下了，过几个小时再喂吧。', 'Too full. Try again in a few hours.'],
    tired: ['太累了，先让它睡一觉。', 'Too tired. Let it sleep first.'],
    hungry: ['饿得玩不动，先喂点东西。', 'Too hungry to play. Feed it first.'],
    awake: ['它本来就醒着。', 'It’s already awake.'],
    unknown: ['没有这个动作。', 'Unknown action.'],
  };

  /** 随机说一句：一半按心情，一半讲知识（睡着时只按心情）。rnd 是 0–1 的随机数，测试里可以固定。 */
  function line(s, rnd = Math.random()) {
    const m = mood(s);
    const facts = FACTS.filter((f) => !f[2] || f[2] === (s.kind === 'astra' ? 'astra' : 'budi'));
    const pool = m === 'sleeping' || m === 'hungry' || m === 'tired' || rnd < 0.5 ? MOODS[m] : facts;
    const r = m === 'sleeping' || m === 'hungry' || m === 'tired' || rnd < 0.5 ? rnd * 2 % 1 : (rnd - 0.5) * 2;
    const f = pool[Math.min(pool.length - 1, Math.floor(r * pool.length))];
    return { zh: f[0], en: f[1] };
  }

  const api = { KEY, BUDDY_KEY, KINDS, SNACKS, ACCS, RATE, FLOOR, DAY_XP, XP, PET_GAP, NAME_MAX, FACTS, MOODS, WHY, kindOf, dayKey, cleanName, fresh, parse, advance, levelOf, unlocked, act, mood, rename, setKind, setAcc, daysTogether, line };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MolAstriaPetCore = api;
})(typeof window !== 'undefined' ? window : globalThis);
