/* 复习卡片的核心逻辑：卡组、到期队列、存档清洗、Anki 导出。纯函数，没有 DOM，没有网络（tools/review-test.mjs 测）。
   调度用 ts-fsrs（MIT，https://github.com/open-spaced-repetition/ts-fsrs），由 review.js 从 CDN 载入后包成
   { empty(now), next(card, now, rating), preview(card, now) } 传进来；载不到时用这里的 simpleScheduler（固定倍数的间隔）。
   卡片来源：中英术语表（search-terms.js）、研习台的知识图（localStorage molastria-learn，只读不写）、自己写的卡片。
   浏览器：window.MOLASTRIA_REVIEW_CORE；node：module.exports。 */
(function (root) {
  'use strict';

  const STORE_KEY = 'molastria-review';
  const LEARN_KEY = 'molastria-learn';
  const DECKS = ['terms', 'learn', 'mine'];
  const RATINGS = [1, 2, 3, 4]; // 与 ts-fsrs 的 Rating 相同：1 重来 Again，2 困难 Hard，3 良好 Good，4 简单 Easy
  const MAX_MINE = 500, MAX_LOG = 400, MAX_TEXT = 1000;
  const MIN = 60000, HOUR = 3600000, DAY = 86400000;

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const arr = (v) => (Array.isArray(v) ? v : []);
  const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  /** 纯文本：去掉控制字符，裁到 n 个字符。显示时页面还会转义，这里不处理 HTML。 */
  // eslint-disable-next-line no-control-regex
  const text = (v, n = MAX_TEXT) => (typeof v === 'string' ? Array.from(v.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0008\u000b\u000c\u000e-\u001f\u007f]/g, '').trim()).slice(0, n).join('') : '');
  const cleanId = (v) => String(v ?? '').replace(/[^\w-]/g, '').slice(0, 60);
  const CARD_ID = /^(terms|learn|mine):[\w-]{1,62}$/;
  const deckOf = (id) => String(id).split(':')[0];

  /** 32 位 FNV-1a，给术语组一个不随顺序变化的编号。 */
  function hash(s) {
    let h = 0x811c9dc5;
    for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return h.toString(36);
  }
  /** 本地日期 YYYY-MM-DD（“今天的新卡”按设备时区算）。 */
  function dayOf(ms, tzOffsetMin = new Date(ms).getTimezoneOffset()) {
    return new Date(ms - tzOffsetMin * MIN).toISOString().slice(0, 10);
  }

  // ── 存档 ───────────────────────────────────────────────────────────────
  function emptyState() {
    return { v: 1, decks: { terms: true, learn: true, mine: true }, dir: 'auto', newPerDay: 15, sched: {}, mine: [], log: [], newDay: { day: '', n: 0 } };
  }
  /** 一张卡的调度记录：与 ts-fsrs 的 Card 字段相同，日期存成毫秒数。 */
  function cleanSched(c) {
    if (!isObj(c)) return null;
    const due = num(c.due, NaN);
    if (!Number.isFinite(due)) return null;
    const s = {
      due, stability: Math.max(0, num(c.stability)), difficulty: Math.max(0, num(c.difficulty)),
      elapsed_days: Math.max(0, num(c.elapsed_days)), scheduled_days: Math.max(0, num(c.scheduled_days)),
      learning_steps: Math.max(0, Math.round(num(c.learning_steps))), reps: Math.max(0, Math.round(num(c.reps))),
      lapses: Math.max(0, Math.round(num(c.lapses))), state: [0, 1, 2, 3].includes(c.state) ? c.state : 0
    };
    const last = num(c.last_review, NaN);
    if (Number.isFinite(last)) s.last_review = last;
    return s;
  }
  /** 任何存下来的值（对象或 JSON 字符串）→ 合法的存档。用不上的丢掉，从不抛错。 */
  function migrate(raw) {
    const st = emptyState();
    let r = raw;
    if (typeof r === 'string') try { r = JSON.parse(r); } catch { r = null; }
    if (!isObj(r)) return st;
    if (isObj(r.decks)) for (const d of DECKS) if (typeof r.decks[d] === 'boolean') st.decks[d] = r.decks[d];
    if (['auto', 'zh-en', 'en-zh'].includes(r.dir)) st.dir = r.dir;
    if (Number.isInteger(r.newPerDay) && r.newPerDay >= 0 && r.newPerDay <= 200) st.newPerDay = r.newPerDay;
    if (isObj(r.sched)) for (const [id, c] of Object.entries(r.sched)) { const s = CARD_ID.test(id) && cleanSched(c); if (s) st.sched[id] = s; }
    const seen = new Set();
    for (const m of arr(r.mine)) {
      if (!isObj(m)) continue;
      const id = cleanId(m.id), front = text(m.front), back = text(m.back);
      if (!id || seen.has(id) || !front || !back) continue;
      seen.add(id);
      st.mine.push({ id, front, back, tags: arr(m.tags).map((t) => text(t, 30).replace(/\s+/g, '_')).filter(Boolean).slice(0, 8), created: num(m.created) });
      if (st.mine.length >= MAX_MINE) break;
    }
    st.log = arr(r.log).filter((l) => isObj(l) && CARD_ID.test(l.id) && RATINGS.includes(l.r) && num(l.at, NaN) > 0).map((l) => ({ id: l.id, at: l.at, r: l.r })).slice(-MAX_LOG);
    if (isObj(r.newDay) && /^\d{4}-\d{2}-\d{2}$/.test(r.newDay.day)) st.newDay = { day: r.newDay.day, n: Math.max(0, Math.round(num(r.newDay.n))) };
    return st;
  }

  // ── 卡组 ───────────────────────────────────────────────────────────────
  const CJK = /[㐀-鿿]/;
  /** 术语表的一组 → 一张卡。中文是第一个汉字词，英文挑最长的写法（通常是全称），其余写法放在“也写作”。 */
  function termCards(groups, dir = 'zh-en') {
    const out = [];
    for (const g of arr(groups)) {
      const words = arr(g).filter((w) => typeof w === 'string' && w.trim());
      const zh = words.filter((w) => CJK.test(w)), en = words.filter((w) => !CJK.test(w) && /[a-z]/i.test(w));
      if (!zh.length || !en.length) continue;
      const main = [...en].sort((a, b) => b.length - a.length || en.indexOf(a) - en.indexOf(b))[0];
      const zhMain = zh[0];
      const id = `terms:${hash(zhMain)}`;
      const card = { id, deck: 'terms', kind: 'term', zh: zhMain, en: main, zhAlt: zh.slice(1), enAlt: en.filter((w) => w !== main) };
      if (dir === 'en-zh') { card.front = main; card.back = zhMain; } else { card.front = zhMain; card.back = main; }
      out.push(card);
    }
    return out;
  }

  /** 研习台存档 → 卡片。只读：推理链（前提 → 结论）一张“推出什么”，每条知识点一张“讲清楚”。 */
  function learnCards(raw) {
    let r = raw;
    if (typeof r === 'string') try { r = JSON.parse(r); } catch { r = null; }
    if (!isObj(r)) return [];
    const titles = new Map();
    for (const s of arr(r.sessions)) if (isObj(s) && cleanId(s.id)) titles.set(cleanId(s.id), text(s.title, 120) || text(s.goal, 60));
    const props = new Map();
    for (const p of arr(r.props)) {
      if (!isObj(p)) continue;
      const id = cleanId(p.id), t = text(p.text);
      if (id && t && !props.has(id)) props.set(id, { id, text: t, sessions: arr(p.sessionIds).map(cleanId).filter((x) => titles.has(x)).map((x) => titles.get(x)).filter(Boolean) });
    }
    const out = [];
    const seenChain = new Set();
    for (const c of arr(r.chains)) {
      if (!isObj(c)) continue;
      const id = cleanId(c.id), concl = props.get(cleanId(c.conclusion));
      const premises = [...new Set(arr(c.premises).map(cleanId))].filter((p) => props.has(p) && p !== concl?.id).map((p) => props.get(p).text);
      if (!id || !concl || !premises.length || seenChain.has(id)) continue;
      seenChain.add(id);
      out.push({ id: `learn:c-${id}`.slice(0, 68), deck: 'learn', kind: 'chain', premises, back: concl.text, sessions: concl.sessions });
    }
    for (const p of props.values()) out.push({ id: `learn:p-${p.id}`.slice(0, 68), deck: 'learn', kind: 'prop', front: p.text, sessions: p.sessions });
    return out;
  }

  const mineCards = (state) => state.mine.map((m) => ({ id: `mine:${m.id}`, deck: 'mine', kind: 'mine', front: m.front, back: m.back, tags: m.tags }));

  /** 加一张自己的卡；返回新卡的 id，内容不全时返回空串。 */
  function addMine(state, o, ids = {}) {
    const front = text(o?.front), back = text(o?.back);
    if (!front || !back || state.mine.length >= MAX_MINE) return '';
    const id = cleanId(ids.id) || `m${(ids.now ?? Date.now()).toString(36)}${Math.floor((ids.rand ?? Math.random)() * 1e6).toString(36)}`;
    if (state.mine.some((m) => m.id === id)) return '';
    state.mine.push({ id, front, back, tags: arr(o.tags).map((t) => text(t, 30).replace(/\s+/g, '_')).filter(Boolean).slice(0, 8), created: ids.now ?? Date.now() });
    return `mine:${id}`;
  }
  function removeMine(state, cardId) {
    const id = String(cardId).replace(/^mine:/, '');
    const n = state.mine.length;
    state.mine = state.mine.filter((m) => m.id !== id);
    delete state.sched[`mine:${id}`];
    return state.mine.length < n;
  }

  // ── 到期队列 ────────────────────────────────────────────────────────────
  /**
   * 今天要做的卡：先是到期的（越早到期越先），再是新卡（自己的卡、研习台、术语，按这个顺序），新卡受每天上限限制。
   * 返回 { queue: [card], due, fresh, newLeft, next: 下一张到期的时间（毫秒）或 null, total }
   */
  function buildQueue(state, cards, now, tz) {
    const today = dayOf(now, tz);
    const used = state.newDay.day === today ? state.newDay.n : 0;
    const newLeft = Math.max(0, state.newPerDay - used);
    const due = [], fresh = [];
    let next = null, total = 0;
    for (const c of cards) {
      if (!state.decks[c.deck]) continue;
      total++;
      const s = state.sched[c.id];
      if (!s) fresh.push(c);
      else if (s.due <= now) due.push(c);
      else if (next === null || s.due < next) next = s.due;
    }
    due.sort((a, b) => state.sched[a.id].due - state.sched[b.id].due || (a.id < b.id ? -1 : 1));
    const order = { mine: 0, learn: 1, terms: 2 };
    fresh.sort((a, b) => order[a.deck] - order[b.deck]); // 稳定排序：同一卡组里保持原来的顺序
    const take = fresh.slice(0, newLeft);
    return { queue: [...due, ...take], due: due.length, fresh: fresh.length, newLeft, next, total };
  }

  /** 每个卡组的张数：总数、新卡、今天到期。 */
  function deckStats(state, cards, now) {
    const out = {};
    for (const d of DECKS) out[d] = { total: 0, fresh: 0, due: 0 };
    for (const c of cards) {
      const o = out[c.deck];
      if (!o) continue;
      o.total++;
      const s = state.sched[c.id];
      if (!s) o.fresh++;
      else if (s.due <= now) o.due++;
    }
    return out;
  }

  /** 把 ts-fsrs 返回的卡（日期是 Date）存成毫秒数。 */
  function toStored(card) {
    const ms = (d) => (typeof d?.getTime === 'function' ? d.getTime() : typeof d === 'string' ? Date.parse(d) : d);
    return cleanSched({ ...card, due: ms(card.due), last_review: card.last_review == null ? undefined : ms(card.last_review) });
  }

  /** 记一次复习：用调度器算下一次，写进 state。返回新的调度记录。 */
  function record(state, id, rating, now, scheduler, tz) {
    if (!CARD_ID.test(id) || !RATINGS.includes(rating)) throw new Error('bad review');
    const prev = state.sched[id];
    const card = prev ? { ...prev } : scheduler.empty(now);
    const next = toStored(scheduler.next(card, now, rating));
    if (!next) throw new Error('scheduler returned no card');
    state.sched[id] = next;
    if (!prev) {
      const today = dayOf(now, tz);
      state.newDay = state.newDay.day === today ? { day: today, n: state.newDay.n + 1 } : { day: today, n: 1 };
    }
    state.log.push({ id, at: now, r: rating });
    if (state.log.length > MAX_LOG) state.log.splice(0, state.log.length - MAX_LOG);
    return next;
  }

  /**
   * 载不到 ts-fsrs 时用的简化调度：重来 10 分钟；新卡 困难 1 天、良好 1 天、简单 4 天；
   * 复习过的卡按上次的间隔乘 1.2 / 2.5 / 3.5。只动 due、scheduled_days、reps、lapses、state、last_review，
   * 稳定度和难度原样保留，联网后 ts-fsrs 接着用。
   */
  const simpleScheduler = {
    empty: (now) => ({ due: now, stability: 0, difficulty: 0, elapsed_days: 0, scheduled_days: 0, learning_steps: 0, reps: 0, lapses: 0, state: 0 }),
    next(card, now, rating) {
      const c = { ...card };
      const prevDays = c.reps > 0 ? Math.max(1, num(c.scheduled_days)) : 0;
      let days;
      if (rating === 1) { c.lapses += c.reps > 0 ? 1 : 0; c.state = c.reps > 0 ? 3 : 1; c.due = now + 10 * MIN; days = 0; }
      else {
        days = prevDays ? Math.round(prevDays * { 2: 1.2, 3: 2.5, 4: 3.5 }[rating]) : { 2: 1, 3: 1, 4: 4 }[rating];
        days = Math.max(1, days);
        c.state = 2; c.due = now + days * DAY;
      }
      c.scheduled_days = days; c.reps += 1; c.last_review = now;
      return c;
    },
    preview(card, now) {
      const out = {};
      for (const r of RATINGS) out[r] = this.next(card, now, r);
      return out;
    }
  };

  /** 一段时间 → 按钮上的“多久以后”。返回 [数值, 单位]，单位是 min h d mo y。 */
  function interval(ms) {
    const m = Math.max(1, Math.round(ms / MIN));
    if (m < 60) return [m, 'min'];
    const h = Math.round(ms / HOUR);
    if (h < 24) return [h, 'h'];
    const d = Math.round(ms / DAY);
    if (d < 31) return [d, 'd'];
    const mo = Math.round(d / 30.4);
    if (mo < 12) return [mo, 'mo'];
    return [Math.round(d / 36.5) / 10, 'y'];
  }

  // ── 导出 ───────────────────────────────────────────────────────────────
  const esc = (s) => String(s).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/\t/g, ' ').replace(/\n/g, '<br>');
  /** 卡片 → 正反面的纯文本（导出用）。t 是页面的翻译函数（ChemI18n.t），只用来翻提示语，卡片内容原样。 */
  function faces(c, t = (x) => x) {
    if (c.kind === 'chain') return { front: `${t('由这些推出什么？')}\n${c.premises.map((p) => `· ${p}`).join('\n')}`, back: c.back };
    if (c.kind === 'prop') return { front: `${t('讲清楚这一条，并说出它从哪里来：')}\n${c.front}`, back: c.sessions?.length ? t(`来自研习台：${c.sessions.join('；')}`) : t('对照研习台里的原始讲解。') };
    if (c.kind === 'term') {
      const alt = (c.front === c.zh ? c.enAlt : c.zhAlt) || [];
      return { front: c.front, back: alt.length ? `${c.back}\n${t(`也写作：${alt.join('、')}`)}` : c.back };
    }
    return { front: c.front, back: c.back };
  }
  /**
   * Anki 能直接导入的纯文本（Anki 2.1.54 起认文件头：#separator、#html、#notetype、#deck、#tags column）。
   * 字段按 HTML 写：&、<、>、" 转义，换行写成 <br>，制表符换成空格，所以不需要再加引号。
   */
  function ankiText(cards, o = {}) {
    const t = typeof o.t === 'function' ? o.t : (x) => x;
    const deck = String(o.deck || 'MolAstria').replace(/[\t\n\r]/g, ' ');
    const lines = ['#separator:Tab', '#html:true', '#notetype:Basic', `#deck:${deck}`, '#tags column:3'];
    for (const c of cards) {
      const f = faces(c, t);
      const tags = ['MolAstria', `MolAstria::${c.deck}`, ...(c.tags || [])].map((t) => String(t).replace(/\s+/g, '_')).join(' ');
      lines.push(`${esc(f.front)}\t${esc(f.back)}\t${tags}`);
    }
    return lines.join('\n') + '\n';
  }

  const API = {
    STORE_KEY, LEARN_KEY, DECKS, RATINGS, MAX_MINE, MAX_LOG,
    emptyState, migrate, termCards, learnCards, mineCards, addMine, removeMine,
    buildQueue, deckStats, record, toStored, simpleScheduler, interval, faces, ankiText, dayOf, hash
  };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.MOLASTRIA_REVIEW_CORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
