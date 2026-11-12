/* 讨论室的“每日一题”：纯逻辑，没有 DOM（tools/chat-daily-test.mjs 测）。浏览器：window.MOLASTRIA_CHAT_DAILY；node：module.exports。
   题目不另写：取量子物理（qp-quiz.js）和数学基础（fm-quiz.js）里“动手算一算”的公式题，判分照旧用 viewer/formula-check.js。
   每个人同一天看到同一道题，不经过服务器：
   - “一天”按北京时间（UTC+8，没有夏令时）算，零点换题；
   - 全部题目用一个固定的种子打乱一次，第 d 天出第 d mod N 道，所以 N 天之内不重复（现在 N = 45）。
   题库增删题时顺序会整体变，这是有意的：不用维护一张排期表。 */
(function (root) {
  'use strict';

  const OFFSET_MS = 8 * 3600 * 1000; // 北京时间
  const SEED = 20261112;
  const ROOM = 'study'; // “学习与课程”房间
  const SETS = {
    qp: { global: 'MOLASTRIA_QP_QUIZ', store: 'molastria-qp-quiz', name: ['量子物理', 'Quantum physics'], href: (ch) => `../quantum/physics/index.html#c-${ch}` },
    fm: { global: 'MOLASTRIA_FM_QUIZ', store: 'molastria-fm-quiz', name: ['数学基础', 'Mathematics'], href: (ch) => `../fundamental-science/math/index.html#m-${ch}` },
  };

  /** 北京时间的日期 'YYYY-MM-DD'。 */
  function dayKey(now = Date.now()) { return new Date(Number(now) + OFFSET_MS).toISOString().slice(0, 10); }
  /** 从 1970-01-01 起的第几天（按 dayKey 的日期）。 */
  function dayNumber(key) { const t = Date.parse(`${key}T00:00:00Z`); return Number.isFinite(t) ? Math.round(t / 86400000) : NaN; }
  /** 离北京时间下一个零点还有多少毫秒。 */
  function msToNext(now = Date.now()) { const d = (Number(now) + OFFSET_MS) % 86400000; return 86400000 - d; }

  /** 两个题库 → 一列 { set, chapter, item }，按题库、章节、题号的原顺序。 */
  function pool(data) {
    const out = [];
    for (const set of Object.keys(SETS)) {
      const items = data?.[set]?.items || {};
      for (const [chapter, list] of Object.entries(items)) for (const item of list || []) if (item && item.id && item.q) out.push({ set, chapter, item });
    }
    return out;
  }

  function mulberry32(a) {
    return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  /** 固定种子的 Fisher–Yates：0..n-1 的一个排列。 */
  function order(n, seed = SEED) {
    const a = Array.from({ length: n }, (_, i) => i), r = mulberry32(seed);
    for (let i = n - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; }
    return a;
  }
  /** 这一天的题；题库空时是 null。 */
  function pick(list, key) {
    if (!list.length) return null;
    const d = dayNumber(key);
    if (!Number.isFinite(d)) return null;
    const perm = order(list.length);
    return { ...list[perm[((d % list.length) + list.length) % list.length]], key, n: list.length };
  }

  /** 发到房间的草稿：日期、题面（长的截断）和一行“我的思路”。题面里没有答案。 */
  function draft(entry, en = false) {
    if (!entry) return '';
    const q = String(en ? entry.item.q.en : entry.item.q.zh).replace(/\s+/g, ' ').trim();
    const short = q.length > 140 ? `${q.slice(0, 139)}…` : q;
    const date = entry.key.slice(5).replace('-', en ? '/' : '-');
    return en ? `[Daily problem ${date}] ${short}\nMy approach: ` : `【每日一题 ${date}】${short}\n我的思路：`;
  }

  const API = { OFFSET_MS, SEED, ROOM, SETS, dayKey, dayNumber, msToNext, pool, order, pick, draft };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.MOLASTRIA_CHAT_DAILY = API;
})(typeof window !== 'undefined' ? window : globalThis);
