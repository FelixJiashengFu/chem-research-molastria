/* 网状查询的“没找到的词”：术语表（search-terms.js）认不出、只能做全文检索的查询，记在这台设备的 localStorage
   （molastria-net-misses），用来补术语表。不发到任何服务器；用户自己决定是否复制出来或提交到 GitHub Issues。
   这里只有纯函数（没有 DOM，tools/net-test.mjs 测），读写和面板在 network.js。
   存的格式：{ v: 1, off: false, items: [{ q, n, hits, first, last }] }，n 是查过几次，hits 是全文检索命中几条。 */
(() => {
  'use strict';
  const KEY = 'molastria-net-misses';
  const MAX = 100;      // 最多记多少个词，超出时丢掉最久没查的
  const MAXLEN = 60;    // 更长的输入多半是整句或粘贴来的文字，不是术语
  const ISSUES = 'https://github.com/FelixJiashengFu/chem-research-molastria/issues/new';

  const clean = (q) => String(q ?? '').replace(/\s+/g, ' ').trim();
  const keyOf = (q) => clean(q).normalize('NFKC').toLowerCase();
  const empty = (off = false) => ({ v: 1, off, items: [] });

  // 读回存着的值；坏数据、旧格式一律当成空的，不报错
  function parse(raw) {
    let o = raw;
    if (typeof raw === 'string') { try { o = JSON.parse(raw); } catch { return empty(); } }
    if (!o || typeof o !== 'object') return empty();
    const items = (Array.isArray(o.items) ? o.items : []).filter((x) => x && typeof x.q === 'string' && clean(x.q))
      .map((x) => ({ q: clean(x.q).slice(0, MAXLEN), n: Math.max(1, Math.floor(+x.n) || 1), hits: Math.max(0, Math.floor(+x.hits) || 0), first: +x.first || 0, last: +x.last || +x.first || 0 }));
    const seen = new Set();
    return { v: 1, off: o.off === true, items: items.filter((x) => !seen.has(keyOf(x.q)) && seen.add(keyOf(x.q))).slice(0, MAX) };
  }

  // 这个查询算不算“没找到”：术语表认不出（全文检索模式）。返回 null 表示不算，否则返回命中条数。
  // 拼写纠错认出来的（Gaussain → Gaussian）不算，那是拼错了，不是术语表缺词。
  function missOf(result) {
    if (!result || result.mode !== 'text' || !clean(result.q)) return null;
    return { hits: Array.isArray(result.primary) ? result.primary.length : 0 };
  }

  // 不该记的输入：太短、太长、网址、邮箱、DOI 一类的路径、像电话、证件号或 CAS 号的长串数字（编号不是术语）
  function worthKeeping(q) {
    const s = clean(q);
    if ([...s].length < 2 || s.length > MAXLEN) return false;
    if (/[@/\\]|:\/\/|^www\./i.test(s)) return false;
    if (/\d{6,}/.test(s.replace(/[\s-]/g, ''))) return false;
    return true;
  }

  // 记一次；返回新的存储对象，不改原来的
  function record(store, q, result, now = Date.now()) {
    const s = parse(store);
    const miss = missOf(result);
    if (s.off || !miss || !worthKeeping(q)) return s;
    const text = clean(q), k = keyOf(text);
    const old = s.items.find((x) => keyOf(x.q) === k);
    const item = old ? { ...old, q: text, n: old.n + 1, hits: miss.hits, last: now } : { q: text, n: 1, hits: miss.hits, first: now, last: now };
    const items = [item, ...s.items.filter((x) => x !== old)].sort((a, b) => b.last - a.last).slice(0, MAX);
    return { ...s, items };
  }

  const remove = (store, q) => { const s = parse(store); return { ...s, items: s.items.filter((x) => keyOf(x.q) !== keyOf(q)) }; };
  const clear = (store) => ({ ...parse(store), items: [] });
  // 关掉记录时把已有的也清掉；再打开从空的开始
  const setOff = (store, off) => empty(!!off);

  // 列表的排序：查得多的在前，次数一样时最近查的在前
  const ranked = (store) => [...parse(store).items].sort((a, b) => b.n - a.n || b.last - a.last);

  // 复制出来的纯文本，一行一个词：词、查过几次、全文命中几条
  function toText(store, labels = { times: '次', hits: '条全文命中' }) {
    return ranked(store).map((x) => `${x.q}\t${x.n} ${labels.times}\t${x.hits} ${labels.hits}`).join('\n');
  }

  // 预填好的 GitHub Issue 地址：用户在 GitHub 上看到全文、自己决定提交与否。地址太长时只放查得最多的词。
  function issueUrl(store, {
    title = '网状查询：术语表里没有的词',
    intro = '下面这些词在网状查询里没有认出来（只做了全文检索），建议补进术语表 search-terms.js：',
    line = (x) => `- ${x.q}（${x.n} 次，全文命中 ${x.hits} 条）`,
    limit = 6000,
  } = {}) {
    const list = ranked(store);
    const build = (n) => {
      const body = `${intro}\n\n${list.slice(0, n).map(line).join('\n')}\n`;
      return `${ISSUES}?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`;
    };
    let n = list.length;
    while (n > 1 && build(n).length > limit) n -= 1;
    return { url: build(n), included: Math.min(n, list.length), total: list.length };
  }

  window.MolAstriaNetMisses = { KEY, MAX, MAXLEN, parse, missOf, worthKeeping, record, remove, clear, setOff, ranked, toText, issueUrl, keyOf };
})();
