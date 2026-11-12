/* 云同步的核心逻辑：同步哪些本机存档、三方合并、一轮同步该做什么。纯函数，没有 DOM，没有网络（tools/sync-test.mjs 测）。
   每台设备记住每份存档上次和云端对上时的样子（shadow），同步时拿“上次对上的样子 / 本机现在 / 云端现在”三份做三方合并，
   像 git 一样：只有一边改过就取改过的那边；两边都改过时逐项合并：对象按字段、带 id 的数组按 id、其他数组按集合，
   一边删了而另一边没动就删掉，一边删了而另一边改了就留下改过的（宁可多留，不丢数据），两边把同一个值改得不一样时本机优先。
   浏览器：window.MOLASTRIA_SYNC_CORE；node：module.exports。 */
(function (root) {
  'use strict';

  // 同步的存档：键名和用到它的页面（地址前缀）。页面打开时已经把存档读进内存，同步在它下面改了存档就要提示刷新。
  // 只放学习记录和收藏；登录令牌、AI 的 key、显示设置、对话记录都不在这里。
  const KEYS = [
    { key: 'chemresearch-saved', pages: ['/', '/index.html'], zh: '首页收藏', en: 'Saved resources' },
    { key: 'chemdb-atlas-saved', pages: ['/', '/index.html', '/atlas/'], zh: '数据库收藏', en: 'Saved databases' },
    { key: 'molastria-learn', pages: ['/learn/', '/review/'], zh: '研习台（会话、知识图、用量）', en: 'Study Desk (sessions, knowledge graph, usage)' },
    { key: 'molastria-learn-prompts', pages: ['/learn/'], zh: '研习台的提示词改动', en: 'Study Desk prompt edits' },
    { key: 'molastria-review', pages: ['/review/'], zh: '复习卡片的进度和自己的卡', en: 'Review cards: progress and your own cards' },
    { key: 'molastria-qp-progress', pages: ['/quantum/physics/'], zh: '量子物理的自测', en: 'Quantum physics self-checks' },
    { key: 'molastria-qp-quiz', pages: ['/quantum/physics/'], zh: '量子物理的公式题', en: 'Quantum physics formula questions' },
    { key: 'molastria-fm-progress', pages: ['/fundamental-science/math/'], zh: '数学基础的自测', en: 'Mathematics self-checks' },
    { key: 'molastria-fm-quiz', pages: ['/fundamental-science/math/'], zh: '数学基础的公式题', en: 'Mathematics formula questions' },
    { key: 'molastria-fm-track', pages: ['/fundamental-science/math/'], zh: '数学基础的学习路线', en: 'Mathematics learning track' },
    { key: 'molastria-qa-progress', pages: ['/quantum/algorithms/'], zh: '量子算法的自测', en: 'Quantum algorithms self-checks' },
    { key: 'molastria-qa-track', pages: ['/quantum/algorithms/'], zh: '量子算法的学习路线', en: 'Quantum algorithms learning track' },
    { key: 'molastria-play', pages: ['/qchem/'], zh: '游乐场的最好成绩', en: 'Playground best scores' },
    { key: 'molastria-pet', pages: ['/pet/'], zh: '领养的小宠物', en: 'Your adopted pet' },
    { key: 'molastria-shelf', pages: ['/shelf/'], zh: '书架（我的书、状态和笔记）', en: 'Bookshelf (your books, status and notes)' }
  ];
  const KEY_NAMES = KEYS.map((k) => k.key);
  const KEY_RE = /^[a-z0-9-]{1,48}$/; // 账号服务也按这个检查

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);

  /** 页面地址（location.pathname）用不用这份存档。桌面版和网站的路径一样；子目录部署时只看结尾。 */
  function pageUses(entry, pathname) {
    const p = String(pathname || '/').replace(/index\.html$/, '');
    return entry.pages.some((pre) => {
      const want = pre.replace(/index\.html$/, '');
      if (want === '/') return p === '/' || /\/molastria\/?$/.test(p) || p === '';
      return p.endsWith(want) || p.includes(want);
    });
  }

  /** 32 位 FNV-1a，存不下整份 shadow 时只记哈希。 */
  function hash(s) {
    let h = 0x811c9dc5;
    for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36) + ':' + s.length;
  }

  const parse = (s) => {
    if (s == null || s === '') return { ok: true, v: undefined };
    try { return { ok: true, v: JSON.parse(s) }; } catch { return { ok: false, v: s }; }
  };

  /** 结构相等（对象不看键的顺序）。 */
  function same(a, b) {
    if (a === b) return true;
    if (typeof a !== typeof b || a === null || b === null || typeof a !== 'object') return Number.isNaN(a) && Number.isNaN(b);
    if (Array.isArray(a) !== Array.isArray(b)) return false;
    if (Array.isArray(a)) return a.length === b.length && a.every((x, i) => same(x, b[i]));
    const ka = Object.keys(a), kb = Object.keys(b);
    return ka.length === kb.length && ka.every((k) => Object.prototype.hasOwnProperty.call(b, k) && same(a[k], b[k]));
  }
  /** 键排好序的 JSON，当集合元素的身份用。 */
  function canon(v) {
    if (Array.isArray(v)) return '[' + v.map(canon).join(',') + ']';
    if (isObj(v)) return '{' + Object.keys(v).sort().map((k) => JSON.stringify(k) + ':' + canon(v[k])).join(',') + '}';
    return JSON.stringify(v) ?? 'null';
  }

  const idOf = (x) => (isObj(x) && (typeof x.id === 'string' || typeof x.id === 'number') ? 'id:' + typeof x.id + ':' + x.id : null);
  /** 数组里每一项都是带 id 的对象且 id 不重复时按 id 合并，否则按值当集合合并。 */
  function identities(list) {
    const byId = list.every((x) => idOf(x) !== null);
    const ids = list.map((x) => (byId ? idOf(x) : 'v:' + canon(x)));
    return { byId, ids, unique: new Set(ids).size === ids.length };
  }

  /** 三方合并。undefined 表示这一边没有这一项（删了或没建过）。 */
  function merge3(base, local, remote) {
    if (same(local, remote)) return local;
    if (same(base, local)) return remote;
    if (same(base, remote)) return local;
    // 两边都改过
    if (local === undefined) return remote; // 本机删了、云端改了：留下改过的
    if (remote === undefined) return local;
    if (isObj(local) && isObj(remote)) {
      const b = isObj(base) ? base : {};
      const out = {};
      const keys = [...Object.keys(local), ...Object.keys(remote).filter((k) => !Object.prototype.hasOwnProperty.call(local, k))];
      for (const k of keys) {
        const v = merge3(b[k], local[k], remote[k]);
        if (v !== undefined) out[k] = v;
      }
      return out;
    }
    if (Array.isArray(local) && Array.isArray(remote)) return mergeList(Array.isArray(base) ? base : [], local, remote);
    return local; // 同一个值两边改得不一样：本机优先
  }

  function mergeList(base, local, remote) {
    const L = identities(local), R = identities(remote), B = identities(base);
    // 有重复项（比如日志里两条一样的记录）时没法逐项对应：两边各自新增的都留下
    if (!L.unique || !R.unique || !B.unique || L.byId !== R.byId) {
      const seen = new Set(local.map(canon));
      const baseSeen = new Set(base.map(canon));
      return [...local, ...remote.filter((x) => !seen.has(canon(x)) && !baseSeen.has(canon(x)))];
    }
    const bMap = new Map(B.ids.map((id, i) => [id, base[i]]));
    const rMap = new Map(R.ids.map((id, i) => [id, remote[i]]));
    const lSet = new Set(L.ids);
    const out = [];
    L.ids.forEach((id, i) => {
      const v = merge3(bMap.get(id), local[i], rMap.get(id));
      if (v !== undefined) out.push(v);
    });
    R.ids.forEach((id, i) => {
      if (lSet.has(id)) return;
      const v = merge3(bMap.get(id), undefined, remote[i]);
      if (v !== undefined) out.push(v);
    });
    return out;
  }

  /** 合并三份存档的原文（localStorage 里的字符串；null 或 '' 表示没有）。返回合并后的原文，没有就是 null。
      不是 JSON 的存档没法逐项合并：只有一边改过取那边，两边都改过本机优先。 */
  function mergeText(base, local, remote) {
    const norm = (s) => (s == null || s === '' ? null : s);
    base = norm(base); local = norm(local); remote = norm(remote);
    if (local === remote) return local;
    if (base === local) return remote;
    if (base === remote) return local;
    const b = parse(base), l = parse(local), r = parse(remote);
    if (!l.ok || !r.ok) return local ?? remote;
    const v = merge3(b.ok ? b.v : undefined, l.v, r.v);
    if (v === undefined) return null;
    if (same(v, l.v)) return local; // 没变就保留原文，免得只因为键的顺序不同就重写
    if (same(v, r.v)) return remote;
    return JSON.stringify(v);
  }

  /** 本机这份和上次对上的样子（shadow：{v, s} 或存不下原文时的 {v, h}）比，有没有改过。 */
  function changedSince(shadow, local) {
    const l = local == null || local === '' ? null : local;
    if (!shadow) return l !== null;
    if (typeof shadow.s === 'string' || shadow.s === null) return l !== (shadow.s || null);
    return (l === null ? '' : hash(l)) !== (shadow.h || '');
  }

  /**
   * 一份存档这一轮该怎么办。
   * @param {object} o
   * @param {string|null} o.local       本机现在的原文
   * @param {{v:number,s?:string|null,h?:string}|undefined} o.shadow 上次和云端对上时
   * @param {number} o.serverV          云端现在的版本（0 = 云端没有）
   * @param {string|null|undefined} o.remote 云端现在的原文（版本和 shadow 一样时可以不给）
   * @param {string|null|undefined} o.pageBase 这个页面打开时读到的原文；页面还拿着旧数据、而同步已经在它下面改过存档时传进来
   * @returns {{result:string|null, write:boolean, push:boolean, base:number}}
   *   result 合并结果；write 要写回本机；push 要传上云端（base 是云端的版本，用来防止覆盖别的设备刚传的）
   */
  function plan({ local, shadow, serverV, remote, pageBase }) {
    const norm = (s) => (s == null || s === '' ? null : s);
    local = norm(local);
    serverV = Number(serverV) || 0;
    const known = !!shadow && shadow.v === serverV && serverV > 0;
    const shadowText = shadow && (typeof shadow.s === 'string' || shadow.s === null) ? norm(shadow.s) : undefined; // undefined：只记了哈希
    let result, remoteNow; // remoteNow：云端现在的原文；undefined 表示不知道（只记了哈希），只知道它和 shadow 一样
    if (known) {
      remoteNow = shadowText;
      if (!changedSince(shadow, local)) return { result: local, write: false, push: false, base: serverV };
      result = remoteNow === undefined ? local : mergeText(pageBase !== undefined ? norm(pageBase) : remoteNow, local, remoteNow);
    } else {
      remoteNow = serverV ? norm(remote) : null;
      // 本机没改过：直接用云端的（页面还拿着旧数据也一样，它下次写回时再按 pageBase 合并）
      if (serverV > 0 && shadow && shadow.v > 0 && !changedSince(shadow, local)) return { result: remoteNow, write: remoteNow !== local, push: false, base: serverV };
      // 云端没有这一份（第一次同步，或者云端副本被删了）：没有共同的底，两边都算新增，不会删掉本机的东西
      const base = !serverV ? null : pageBase !== undefined ? norm(pageBase) : shadowText ?? null;
      result = mergeText(base, local, remoteNow);
    }
    const push = remoteNow === undefined ? true : result !== remoteNow && !(result === null && !serverV);
    return { result, write: result !== local, push, base: serverV };
  }

  /** 字节数（UTF-8），和账号服务算空间的方法一样。 */
  function bytes(s) {
    if (s == null) return 0;
    let n = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s.charCodeAt(i);
      if (c < 0x80) n += 1; else if (c < 0x800) n += 2; else if (c >= 0xd800 && c < 0xdc00) { n += 4; i++; } else n += 3;
    }
    return n;
  }

  /**
   * 一轮同步：拉云端改过的、逐份合并、写回本机、传上改过的；别的设备刚好也传了的那份退回来再合并一次（最多三轮）。
   * 所有读写都从 io 进来，浏览器里是 localStorage 和 fetch，测试里是假的存储和假的账号服务。
   * @param {object} io
   * @param {string} io.email                         现在登录的账号（shadow 跟着账号走，换账号就从头来）
   * @param {(key:string)=>string|null} io.get         读本机存档
   * @param {(key:string, text:string|null)=>void} io.set 写本机存档（null 删掉）
   * @param {()=>object|null} io.loadState / io.saveState(state)  shadow 和游标
   * @param {(method:string, arg:object)=>Promise<object>} io.call  GET {since} / POST {items}
   * @param {(key:string)=>string|null|undefined} [io.pageBase]  页面打开时读到的原文（页面在用这份存档、而同步在它下面改过时）
   * @param {(key:string)=>void} [io.touched]           同步改了本机的这份存档
   * @param {string[]} [io.keys]                        要同步的键，默认 KEY_NAMES
   * @param {boolean} [io.slim]                         shadow 只记哈希（本机空间紧张时）
   * @returns {Promise<{pulled:string[], pushed:string[], full:string[], used:number, limit:number, pro:boolean, cursor:number}>}
   */
  async function syncOnce(io) {
    const keys = io.keys || KEY_NAMES;
    let state = io.loadState();
    if (!state || state.email !== io.email || !isObj(state.keys)) state = { email: io.email, cursor: 0, keys: {} };
    const remember = (key, v, text) => {
      if (!v) { delete state.keys[key]; return; }
      state.keys[key] = io.slim && text ? { v, h: hash(text) } : { v, s: text ?? null };
    };
    let got = await io.call('GET', { since: state.cursor });
    if (got.reset) { state = { email: io.email, cursor: 0, keys: {} }; got = await io.call('GET', { since: 0 }); }
    const versions = got.versions || {};
    const remote = {};
    for (const it of got.items || []) remote[it.key] = it.body;
    // 云端没有了的（副本被删）：忘掉 shadow，当第一次同步
    for (const key of Object.keys(state.keys)) if (!versions[key]) delete state.keys[key];
    // 版本对不上、又没随这次拉下来的（游标出过错）：整份再拉一次
    if (keys.some((k) => versions[k] && state.keys[k]?.v !== versions[k] && !(k in remote))) {
      const all = await io.call('GET', { since: 0 });
      for (const it of all.items || []) remote[it.key] = it.body;
    }
    const pulled = new Set(), pushed = new Set(), full = new Set();
    let todo = keys.map((key) => ({ key, serverV: versions[key] || 0, remote: remote[key] }));
    let last = got;
    for (let round = 0; round < 3 && todo.length; round++) {
      const items = [], results = {};
      for (const t of todo) {
        const local = io.get(t.key);
        const p = plan({ local, shadow: state.keys[t.key], serverV: t.serverV, remote: t.remote, pageBase: io.pageBase?.(t.key) });
        if (p.write) { io.set(t.key, p.result); pulled.add(t.key); io.touched?.(t.key); }
        if (p.push) { items.push({ key: t.key, base: p.base, body: p.result ?? '' }); results[t.key] = p.result; }
        else if (t.serverV) remember(t.key, t.serverV, p.result);
      }
      todo = [];
      if (!items.length) break;
      // 一次最多传约 2.5 MB，太多就分几次
      const batches = [[]];
      let size = 0;
      for (const it of items) {
        const b = bytes(it.body) + 64;
        if (size + b > 2_500_000 && batches.at(-1).length) { batches.push([]); size = 0; }
        batches.at(-1).push(it); size += b;
      }
      for (const batch of batches) {
        const r = await io.call('POST', { items: batch });
        last = r;
        for (const [key, v] of Object.entries(r.saved || {})) { remember(key, v, results[key]); pushed.add(key); }
        for (const key of r.full || []) full.add(key);
        for (const c of r.conflicts || []) todo.push({ key: c.key, serverV: c.v, remote: c.body });
      }
    }
    if (got.cursor >= state.cursor) state.cursor = got.cursor; // 只用拉的时候的游标：自己传的不算，免得跳过别的设备在中间传的
    io.saveState(state);
    return { pulled: [...pulled], pushed: [...pushed], full: [...full], used: last.used ?? got.used ?? 0, limit: last.limit ?? got.limit ?? 0, pro: !!(last.pro ?? got.pro), cursor: state.cursor };
  }

  const api = { KEYS, syncOnce, KEY_NAMES, KEY_RE, pageUses, hash, same, canon, merge3, mergeText, changedSince, plan, bytes };
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.MOLASTRIA_SYNC_CORE = api;
})(typeof self !== 'undefined' ? self : this);
