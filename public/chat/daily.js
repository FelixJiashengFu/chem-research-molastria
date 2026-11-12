'use strict';
// Discussion rooms: the daily problem. One formula question a day from the Quantum Physics and Mathematics sections
// (daily-core.js picks it, the same for everyone, changing at midnight Beijing time); viewer/formula-check.js grades
// it in the browser. The card sits above the room list; the question and its data files load only when it is opened.
// Solving it counts in that section too (same localStorage key) and on My Study. "Discuss" hands a draft to the
// Study & courses room through window.MolAstriaChat.draft (chat.js) and opens that room.
// Wording in both languages here (translate="no"), like chat.js.
(() => {
  const D = window.MOLASTRIA_CHAT_DAILY, box = document.getElementById('ch-daily');
  if (!D || !box) return;
  const en = document.documentElement.lang === 'en';
  const t = (zh, e) => (en ? e : zh);
  const FILES = ['../viewer/formula-check.js', '../quantum/physics/qp-quiz.js', '../quantum/physics/qp-quiz-math.js', '../fundamental-science/math/fm-quiz.js', '../fundamental-science/math/fm-quiz-math.js'];
  let loading = null, today = '', entry = null;

  function load() {
    if (loading) return loading;
    if (!document.querySelector('link[data-daily]')) { const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: '../viewer/formula-check.css' }); l.dataset.daily = '1'; document.head.append(l); }
    // In order: the data files only define globals, formula-check.js mounts nothing until asked.
    loading = FILES.reduce((p, src) => p.then(() => new Promise((ok, bad) => {
      const s = Object.assign(document.createElement('script'), { src });
      s.onload = ok; s.onerror = () => bad(new Error(src));
      document.head.append(s);
    })), Promise.resolve()).catch((e) => { loading = null; throw e; });
    return loading;
  }
  const solvedSet = (key) => { try { return new Set(JSON.parse(localStorage.getItem(key) || '[]')); } catch { return new Set(); } };
  // The card remembers today's result (molastria-chat-daily: { day, set, ok }) so it can say so before the data loads.
  const KEY = 'molastria-chat-daily';
  const memo = () => { try { const m = JSON.parse(localStorage.getItem(KEY) || 'null'); return m && m.day === today ? m : null; } catch { return null; } };
  const remember = () => { try { localStorage.setItem(KEY, JSON.stringify({ day: today, set: entry.set, ok: solvedSet(D.SETS[entry.set].store).has(entry.item.id) })); } catch { /* private mode */ } };
  const solved = () => (entry ? solvedSet(D.SETS[entry.set].store).has(entry.item.id) : !!memo()?.ok);
  const fmtDate = (key) => (en ? new Date(`${key}T12:00:00Z`).toLocaleDateString('en', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : `${Number(key.slice(5, 7))} 月 ${Number(key.slice(8))} 日`);

  function el(tag, cls, text) { const e = document.createElement(tag); if (cls) e.className = cls; if (text != null) e.textContent = text; return e; }
  function card() {
    today = D.dayKey();
    const btn = el('button', 'ch-daily-btn');
    btn.type = 'button';
    btn.setAttribute('aria-haspopup', 'dialog');
    const mark = el('span', 'ch-daily-mark', '∑');
    mark.setAttribute('aria-hidden', 'true');
    const words = el('span', 'ch-daily-w');
    const set = entry?.set || memo()?.set;
    words.append(el('b', '', t('每日一题', 'Daily problem')), el('small', '', `${fmtDate(today)}${D.SETS[set] ? ` · ${D.SETS[set].name[en ? 1 : 0]}` : ''}`));
    btn.append(mark, words);
    if (solved()) { const ok = el('span', 'ch-daily-ok', t('已答对', 'Solved')); btn.append(ok); btn.dataset.solved = ''; }
    btn.addEventListener('click', open);
    box.replaceChildren(btn);
  }

  async function open() {
    const dlg = el('dialog', 'ch-dlg wide ch-daily-dlg');
    dlg.setAttribute('aria-labelledby', 'ch-daily-h');
    dlg.setAttribute('translate', 'no');
    const head = el('div', 'ch-dlg-h');
    const h2 = el('h2', '', `${t('每日一题', 'Daily problem')} · ${fmtDate(today)}`); h2.id = 'ch-daily-h';
    const x = el('button', 'ch-icon'); x.type = 'button'; x.setAttribute('aria-label', t('关闭', 'Close')); x.textContent = '×';
    x.addEventListener('click', () => dlg.close());
    head.append(h2, x);
    const body = el('div', 'ch-dlg-b');
    const state = el('p', 'ch-daily-state', t('正在载入题目…', 'Loading the problem…'));
    body.append(state);
    dlg.append(head, body);
    dlg.addEventListener('close', () => { dlg.remove(); if (entry) remember(); card(); });
    document.getElementById('ch-layer').append(dlg);
    dlg.showModal();
    try { await load(); } catch { state.textContent = t('题目没有载入（网络问题），请稍后再试。', 'The problem did not load (network problem). Please try again later.'); return; }
    entry = D.pick(D.pool({ qp: window.MOLASTRIA_QP_QUIZ, fm: window.MOLASTRIA_FM_QUIZ }), today);
    if (!entry || !window.MolAstriaFormulaCheck) { state.textContent = t('今天没有题。', 'No problem today.'); return; }
    const S = D.SETS[entry.set], data = window[S.global];
    const src = el('p', 'ch-daily-src');
    const a = el('a', '', t(`出自${S.name[0]}栏目，去那一章`, `From the ${S.name[1]} section: open the chapter`));
    a.href = S.href(entry.chapter);
    src.append(a);
    const quiz = el('div');
    body.replaceChildren(src, quiz);
    window.MolAstriaFormulaCheck.mount(quiz, [entry.item], { math: window[`${S.global}_MATH`] || {}, tex: data.math || {}, store: S.store });
    const foot = el('div', 'ch-dlg-f');
    const note = el('p', 'ch-daily-note', t(`所有人今天都是这一道，北京时间零点换题；${entry.n} 道题轮完才重复。`, `Everyone gets this one today; it changes at midnight Beijing time, and all ${entry.n} problems come round before any repeats.`));
    const talk = el('button', 'ch-btn primary', t('到「学习与课程」里讨论', 'Discuss in Study & courses'));
    talk.type = 'button';
    talk.addEventListener('click', () => {
      window.MolAstriaChat?.draft(D.ROOM, D.draft(entry, en));
      dlg.close();
      location.hash = `#r-${D.ROOM}`;
    });
    foot.append(note, talk);
    dlg.append(foot);
  }

  // The card's subtitle names the section once the data has been seen; until then just the date. Midnight: a new card.
  card();
  setTimeout(function next() { entry = null; card(); setTimeout(next, D.msToNext() + 1000); }, D.msToNext() + 1000);
})();
