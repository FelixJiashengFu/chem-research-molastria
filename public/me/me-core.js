/* 我的学习：打卡记录和各栏目进度的汇总。纯函数，没有 DOM，没有网络（tools/me-test.mjs 测）。
   打卡记录存在 molastria-me：{ v: 1, days: { 'YYYY-MM-DD': { n, k: { quiz: 2, review: 5, … } } }, goal: 每周想学几天 }。
   哪天算“学了”：这份记录里有这一天，或者复习卡片的记录（molastria-review 的 log）、研习台的会话（molastria-learn）在这一天动过。
   记录只留最近 KEEP_DAYS 天，云同步里每人只占几 KB。日期一律按访客本地时间算。
   浏览器：window.MOLASTRIA_ME_CORE；node：module.exports。 */
(function (root) {
  'use strict';

  const KEY = 'molastria-me';
  const KEEP_DAYS = 400;
  const DAY_RE = /^\d{4}-\d{2}-\d{2}$/;
  // 记录的种类：页面调用 window.MolAstriaActivity(kind) 时用。不认识的种类记成 other。
  const KINDS = ['learn', 'practice', 'review', 'quiz', 'check', 'play', 'read', 'code', 'other'];
  const KIND_NAMES = {
    learn: ['研习台', 'Study Desk'], practice: ['练习', 'Practice'], review: ['复习卡片', 'Flashcards'], quiz: ['公式题', 'Formula questions'],
    check: ['过关自测', 'Self-checks'], play: ['游乐场', 'Playground'], read: ['读手册', 'Handbook'], code: ['代码台', 'Code Desk'], other: ['其他', 'Other']
  };
  // 各栏目的总数，tools/me-test.mjs 核对它们和数据文件对得上（数据改了，测试会提醒改这里）。
  const TOTALS = { qpCheck: 48, fmCheck: 34, qaCheck: 42, qpQuiz: 25, fmQuiz: 20 };
  // 游乐场的游戏，顺序和编号同 qchem/index.html；world 没有成绩。
  const GAMES = [
    ['box', '盒中粒子调颜色', 'Particle-in-a-box colours'], ['orbital', '猜轨道', 'Guess the orbital'], ['config', '电子排布', 'Electron configuration'],
    ['tunnel', '量子隧穿闯关', 'Quantum tunnelling'], ['ring', '芳香性判断', 'Aromaticity'], ['lines', '氢原子光谱', 'Hydrogen spectrum'],
    ['sg', 'Stern–Gerlach 自旋过滤', 'Stern–Gerlach spin filters'], ['bell', 'CHSH 贝尔游戏', 'The CHSH Bell game'], ['circuit', '量子电路拼图', 'Quantum circuit puzzles'],
    ['qec', '纠错救援', 'Error-correction rescue'], ['grover', 'Grover 寻宝', 'Grover treasure hunt'], ['enaqt', '噪声助推能量传递', 'Noise-assisted energy transfer'],
    ['wave', '二维波包画墙', 'Draw walls for a 2D wave packet'], ['planck', '普朗克单位工坊', 'Planck unit workshop'], ['cube', 'ħ-c-G 立方体分拣', 'Sorting by the ħ-c-G cube'],
    ['vsepr', '价层电子对排布', 'VSEPR: arrange the electron pairs'], ['chiral', '手性 R/S', 'Chirality: R or S'], ['miller', '密勒晶面', 'Miller planes'],
    ['bloch', 'Bloch 球导航', 'Bloch-sphere navigation']
  ];

  const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
  const num = (v, d = 0) => (typeof v === 'number' && Number.isFinite(v) ? v : d);
  const pad = (n) => String(n).padStart(2, '0');

  /** 本地日期 'YYYY-MM-DD'。 */
  function dayKey(t) {
    const d = t instanceof Date ? t : new Date(t);
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }
  /** 'YYYY-MM-DD' 的本地正午（避开夏令时切换的那一小时）。 */
  const noonOf = (key) => { const [y, m, d] = key.split('-').map(Number); return new Date(y, m - 1, d, 12).getTime(); };
  const addDays = (key, n) => { const t = new Date(noonOf(key)); t.setDate(t.getDate() + n); return dayKey(t); };

  const emptyState = () => ({ v: 1, days: {}, goal: 4 });

  /** 读进来的任何东西都变成合法的记录；坏的天、坏的种类、太旧的天丢掉。now 用来决定留哪些天。 */
  function migrate(raw, now = Date.now()) {
    let o = raw;
    if (typeof o === 'string') { try { o = JSON.parse(o); } catch { o = null; } }
    const st = emptyState();
    if (!isObj(o)) return st;
    const goal = Math.round(num(o.goal, 4));
    st.goal = goal >= 1 && goal <= 7 ? goal : 4;
    const oldest = addDays(dayKey(now), -(KEEP_DAYS - 1));
    if (isObj(o.days)) {
      for (const [d, v] of Object.entries(o.days)) {
        if (!DAY_RE.test(d) || d < oldest || !isObj(v)) continue;
        const k = {};
        if (isObj(v.k)) for (const [kind, c] of Object.entries(v.k)) if (KINDS.includes(kind) && num(c) >= 1) k[kind] = Math.min(9999, Math.floor(c));
        const n = Math.min(99999, Math.max(Math.floor(num(v.n)), Object.values(k).reduce((a, b) => a + b, 0)));
        if (n >= 1) st.days[d] = { n, k };
      }
    }
    return st;
  }

  /** 记一次学习动作（改 state 并返回它）。 */
  function record(state, kind, now = Date.now()) {
    const k = KINDS.includes(kind) ? kind : 'other';
    const d = dayKey(now);
    const day = state.days[d] || (state.days[d] = { n: 0, k: {} });
    day.n = Math.min(99999, day.n + 1);
    day.k[k] = Math.min(9999, (day.k[k] || 0) + 1);
    const oldest = addDays(d, -(KEEP_DAYS - 1));
    for (const key of Object.keys(state.days)) if (key < oldest) delete state.days[key];
    return state;
  }

  /** 从别的存档推出学过的日子：复习记录的每一条、研习台每个会话的开始和最后一次改动。返回 { 'YYYY-MM-DD': 次数 }。 */
  function derivedDays({ review, learn } = {}) {
    const out = {};
    const add = (t, n = 1) => { if (num(t) > 0) { const d = dayKey(t); out[d] = (out[d] || 0) + n; } };
    if (isObj(review) && Array.isArray(review.log)) for (const l of review.log) if (isObj(l)) add(l.at);
    if (isObj(learn) && Array.isArray(learn.sessions)) {
      for (const s of learn.sessions) {
        if (!isObj(s)) continue;
        add(s.created);
        if (num(s.updated) > 0 && dayKey(s.updated) !== dayKey(num(s.created) || 0)) add(s.updated);
      }
    }
    return out;
  }

  /** 每天的总次数：打卡记录和推出来的取大的那个（同一件事两边都可能记过，不重复相加）。 */
  function dayCounts(state, derived = {}) {
    const out = {};
    for (const [d, v] of Object.entries(state.days)) out[d] = v.n;
    for (const [d, n] of Object.entries(derived)) if (DAY_RE.test(d)) out[d] = Math.max(out[d] || 0, n);
    return out;
  }

  /** 连续学习天数：今天学了就从今天往回数；今天还没学但昨天学了，从昨天往回数（今天还有机会，不算断）。最长连续也一起算。 */
  function streak(counts, now = Date.now()) {
    const today = dayKey(now);
    let start = counts[today] ? today : counts[addDays(today, -1)] ? addDays(today, -1) : '';
    let current = 0;
    for (let d = start; d && counts[d]; d = addDays(d, -1)) current++;
    let longest = 0, run = 0, prev = '';
    for (const d of Object.keys(counts).filter((x) => counts[x] > 0).sort()) {
      run = prev && addDays(prev, 1) === d ? run + 1 : 1;
      longest = Math.max(longest, run);
      prev = d;
    }
    return { current, longest: Math.max(longest, current), today: !!counts[today], total: Object.values(counts).filter((n) => n > 0).length };
  }

  /** 这一周（周一开始）学了几天，和每天的格子。 */
  function week(counts, goal, now = Date.now()) {
    const today = dayKey(now);
    const dow = (new Date(noonOf(today)).getDay() + 6) % 7; // 周一 = 0
    const monday = addDays(today, -dow);
    const days = [];
    for (let i = 0; i < 7; i++) { const d = addDays(monday, i); days.push({ day: d, n: counts[d] || 0, future: d > today, today: d === today }); }
    const done = days.filter((x) => x.n > 0).length;
    return { days, done, goal, met: done >= goal, left: Math.max(0, goal - done), daysLeft: 6 - dow };
  }

  /** 热力图：最近 weeks 周，按列（每列一周，周一在上），每格 { day, n, level 0–4 }。今天之后的格子 future。 */
  function heatmap(counts, weeks = 26, now = Date.now()) {
    const today = dayKey(now);
    const dow = (new Date(noonOf(today)).getDay() + 6) % 7;
    const first = addDays(today, -dow - (weeks - 1) * 7);
    const vals = Object.values(counts).filter((n) => n > 0).sort((a, b) => a - b);
    const q = (p) => vals.length ? vals[Math.floor(p * (vals.length - 1))] : 1;
    const cuts = [q(0.25), q(0.5), q(0.75)];
    const level = (n) => (n <= 0 ? 0 : n <= cuts[0] ? 1 : n <= cuts[1] ? 2 : n <= cuts[2] ? 3 : 4);
    const cols = [];
    for (let w = 0; w < weeks; w++) {
      const col = [];
      for (let i = 0; i < 7; i++) {
        const d = addDays(first, w * 7 + i);
        const n = counts[d] || 0;
        col.push({ day: d, n, level: d > today ? 0 : level(n), future: d > today });
      }
      cols.push(col);
    }
    return cols;
  }

  const setOf = (v) => new Set(Array.isArray(v) ? v.filter((x) => typeof x === 'string') : []);
  const countPrefix = (set) => { const ch = new Set(); for (const id of set) ch.add(id.split(':')[0]); return ch.size; };

  /**
   * 各栏目的进度。stores 是各键读出来（已 JSON.parse）的值，缺的给 undefined。
   * petLevel：可选，函数 xp → 等级（页面里用 pet-core 的 levelOf）。
   */
  function summary(stores = {}, now = Date.now(), petLevel = null) {
    const s = stores;
    const learn = isObj(s.learn) ? s.learn : {};
    const sessions = Array.isArray(learn.sessions) ? learn.sessions.filter(isObj) : [];
    const learnS = sessions.filter((x) => x.kind !== 'practice');
    const open = learnS.filter((x) => x.phase !== 'done').sort((a, b) => num(b.updated) - num(a.updated));
    const review = isObj(s.review) ? s.review : {};
    const sched = isObj(review.sched) ? Object.values(review.sched).filter(isObj) : [];
    const log = Array.isArray(review.log) ? review.log.filter(isObj) : [];
    const weekAgo = now - 7 * 86400000;
    const play = isObj(s.play) ? s.play : {};
    const played = GAMES.filter(([id]) => { const v = play[id]; return Array.isArray(v) ? v.length > 0 : !!v; });
    const pet = isObj(s.pet) && typeof s.pet.name === 'string' ? s.pet : null;
    const sets = { qpCheck: setOf(s.qpProgress), fmCheck: setOf(s.fmProgress), qaCheck: setOf(s.qaProgress), qpQuiz: setOf(s.qpQuiz), fmQuiz: setOf(s.fmQuiz) };
    const frac = (k) => ({ done: Math.min(sets[k].size, TOTALS[k]), total: TOTALS[k] });
    return {
      learn: {
        sessions: learnS.length, practice: sessions.length - learnS.length, done: learnS.length - open.length,
        props: Array.isArray(learn.props) ? learn.props.length : 0,
        open: open.slice(0, 3).map((x) => ({ id: String(x.id || ''), title: String(x.title || '').slice(0, 80), phase: x.phase, updated: num(x.updated) }))
      },
      review: {
        seen: sched.length, due: sched.filter((c) => num(c.due, Infinity) <= now).length,
        week: log.filter((l) => num(l.at) >= weekAgo).length, total: log.length, mine: Array.isArray(review.mine) ? review.mine.length : 0
      },
      quiz: { qp: frac('qpQuiz'), fm: frac('fmQuiz') },
      checks: {
        qp: { ...frac('qpCheck'), chapters: countPrefix(sets.qpCheck) },
        fm: { ...frac('fmCheck'), chapters: countPrefix(sets.fmCheck) },
        qa: { ...frac('qaCheck'), chapters: countPrefix(sets.qaCheck) }
      },
      play: { played: played.map(([id, zh, en]) => ({ id, zh, en })), total: GAMES.length },
      pet: pet ? { name: pet.name.slice(0, 24), kind: String(pet.kind || ''), xp: num(pet.xp), level: petLevel ? petLevel(num(pet.xp)) : null } : null
    };
  }

  /** 接下来做什么：最多三条建议，每条 { id, zh, en, href }。 */
  function nextSteps(sum, wk) {
    const out = [];
    if (sum.review.due > 0) out.push({ id: 'review', zh: `复习到期的 ${sum.review.due} 张卡`, en: `Review ${sum.review.due} due card${sum.review.due === 1 ? '' : 's'}`, href: '../review/index.html' });
    const o = sum.learn.open[0];
    if (o) out.push({ id: 'learn', zh: `接着学：${o.title || '未命名的会话'}`, en: `Continue: ${o.title || 'untitled session'}`, href: `../learn/index.html#s-${encodeURIComponent(o.id)}` });
    const qp = sum.quiz.qp, fm = sum.quiz.fm;
    if (qp.done < qp.total && (qp.done > 0 || fm.done === 0)) out.push({ id: 'qp', zh: `量子物理的公式题还有 ${qp.total - qp.done} 道`, en: `${qp.total - qp.done} quantum physics formula questions left`, href: '../quantum/physics/index.html' });
    else if (fm.done < fm.total) out.push({ id: 'fm', zh: `数学基础的公式题还有 ${fm.total - fm.done} 道`, en: `${fm.total - fm.done} maths formula questions left`, href: '../fundamental-science/math/index.html' });
    if (out.length < 3 && sum.play.played.length < sum.play.total) out.push({ id: 'play', zh: `游乐场还有 ${sum.play.total - sum.play.played.length} 个游戏没有成绩`, en: `${sum.play.total - sum.play.played.length} playground games without a score yet`, href: '../qchem/index.html' });
    if (out.length < 3 && wk && !wk.met) out.push({ id: 'goal', zh: `这周还差 ${wk.left} 天达到目标`, en: `${wk.left} more day${wk.left === 1 ? '' : 's'} to reach this week’s goal`, href: '../review/index.html' });
    return out.slice(0, 3);
  }

  const API = { KEY, KEEP_DAYS, KINDS, KIND_NAMES, TOTALS, GAMES, dayKey, addDays, emptyState, migrate, record, derivedDays, dayCounts, streak, week, heatmap, summary, nextSteps };
  if (typeof module === 'object' && module.exports) module.exports = API;
  else root.MOLASTRIA_ME_CORE = API;
})(typeof window !== 'undefined' ? window : globalThis);
