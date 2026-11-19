/* 最近更新（updates/）的纯逻辑：存档、每条的进度圈、哪些算“新”、按日期分组。没有 DOM，没有网络（tools/updates-test.mjs 测）。
   存档 molastria-updates：{ v: 1, seen: 上次打开面板时最新一条的日期, pop: 首页自动弹过的那一版的日期, ack: [点过“全部标为已看”的条目 id], p: [打开过的页面] }。
   p 由 shared-nav.js 在每页载入时记一笔（同一套 normPath），只留最近 KEEP 个。
   浏览器：window.MOLASTRIA_UPDATES_CORE；node：module.exports。 */
(function (root) {
  const KEY = 'molastria-updates';
  const KEEP = 300;
  const DATE = /^\d{4}-\d{2}-\d{2}$/;

  // 'open-models/sensetime/index.html#x' → 'open-models/sensetime/'；首页是 ''
  const normPath = (p) => String(p || '').replace(/[?#].*$/, '').replace(/^(\.\/|\/)+/, '').replace(/(^|\/)index\.html$/, '$1');

  const migrate = (raw) => {
    const s = raw && typeof raw === 'object' && !Array.isArray(raw) ? raw : {};
    const strs = (a) => (Array.isArray(a) ? [...new Set(a.filter((x) => typeof x === 'string' && x.length < 200))] : []);
    return {
      v: 1,
      seen: typeof s.seen === 'string' && DATE.test(s.seen) ? s.seen : '',
      pop: typeof s.pop === 'string' && DATE.test(s.pop) ? s.pop : '',
      ack: strs(s.ack).slice(-KEEP),
      p: strs(s.p).slice(-KEEP),
    };
  };

  const visit = (state, path) => {
    const s = migrate(state), k = normPath(path);
    if (s.p[s.p.length - 1] === k) return s;
    s.p = s.p.filter((x) => x !== k).concat(k).slice(-KEEP);
    return s;
  };

  const latest = (items) => items.reduce((m, x) => (x.date > m ? x.date : m), '');

  // 进度圈：有 store 的按读过的章算，没有的打开过那一页就是满的。readStore(key) 返回那个栏目的存档（或 null）。
  const progress = (item, state, readStore) => {
    const s = migrate(state);
    const opened = s.p.includes(normPath(item.path));
    if (!item.store) return { done: opened ? 1 : 0, total: 1, frac: opened ? 1 : 0, opened };
    let store = null;
    try { store = readStore ? readStore(item.store) : null; } catch { store = null; }
    const seen = new Set(store && Array.isArray(store.seen) ? store.seen.filter((x) => typeof x === 'string') : []);
    const need = Array.isArray(item.need) && item.need.length ? item.need : null;
    const total = need ? need.length : Math.max(1, item.chapters | 0);
    const done = need ? need.filter((x) => seen.has(x)).length : Math.min(total, seen.size);
    return { done, total, frac: done / total, opened: opened || done > 0 };
  };

  const isNew = (item, state, prog) => !migrate(state).ack.includes(item.id) && !prog.opened;

  const newCount = (items, state, readStore) => items.filter((x) => isNew(x, state, progress(x, state, readStore))).length;

  // 顶栏账号按钮上的小点：有比上次打开面板时更新的条目
  const hasUnseen = (items, state) => latest(items) > migrate(state).seen;

  const ackAll = (items, state) => {
    const s = migrate(state);
    s.ack = [...new Set(s.ack.concat(items.map((x) => x.id)))].slice(-KEEP);
    return s;
  };

  const markOpened = (items, state) => { const s = migrate(state); s.seen = latest(items) > s.seen ? latest(items) : s.seen; return s; };

  // 首页每一版只自动弹一次；第一次来的人不弹（他们看到的是进场动画）
  const shouldAutoOpen = (items, state, firstVisit) => {
    const s = migrate(state), top = latest(items);
    return !firstVisit && !!top && s.pop !== top && s.seen < top;
  };

  const pad = (n) => String(n).padStart(2, '0');
  const dayKey = (t) => { const d = new Date(t); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };
  const dayDiff = (a, b) => Math.round((Date.UTC(...b.split('-').map((x, i) => +x - (i === 1 ? 1 : 0))) - Date.UTC(...a.split('-').map((x, i) => +x - (i === 1 ? 1 : 0)))) / 864e5);
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];

  // 'YYYY-MM-DD' → { zh, en }：今天、昨天、N 天前（一周内），再早就写日期
  const relDay = (date, now) => {
    const n = dayDiff(date, dayKey(now));
    const [y, m, d] = date.split('-').map(Number);
    const sameYear = y === new Date(now).getFullYear();
    if (n <= 0) return { zh: '今天', en: 'Today' };
    if (n === 1) return { zh: '昨天', en: 'Yesterday' };
    if (n < 7) return { zh: `${n} 天前`, en: `${n} days ago` };
    return { zh: `${sameYear ? '' : `${y} 年 `}${m} 月 ${d} 日`, en: `${MON[m - 1]} ${d}${sameYear ? '' : `, ${y}`}` };
  };

  const byDay = (items) => {
    const out = [];
    for (const x of items) {
      const last = out[out.length - 1];
      if (last && last.date === x.date) last.items.push(x); else out.push({ date: x.date, items: [x] });
    }
    return out;
  };

  const API = { KEY, KEEP, normPath, migrate, visit, latest, progress, isNew, newCount, hasUnseen, ackAll, markOpened, shouldAutoOpen, dayKey, relDay, byDay };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.MOLASTRIA_UPDATES_CORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
