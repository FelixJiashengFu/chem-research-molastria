/* 我的学习：读各栏目的本机存档（只读），加上 molastria-me 的打卡记录，画连续天数、本周目标、热力图和各栏目进度。
   只写 molastria-me（每周目标）。文字自带中英两版，容器标 translate="no"，不经过 i18n.js。 */
(() => {
  'use strict';
  const C = window.MOLASTRIA_ME_CORE;
  if (!C) return;
  const $ = (id) => document.getElementById(id);
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const read = (key) => { try { const v = localStorage.getItem(key); return v == null ? undefined : JSON.parse(v); } catch { return undefined; } };
  const KEYS = {
    learn: 'molastria-learn', review: 'molastria-review', play: 'molastria-play', pet: 'molastria-pet',
    qpQuiz: 'molastria-qp-quiz', fmQuiz: 'molastria-fm-quiz', qpProgress: 'molastria-qp-progress', fmProgress: 'molastria-fm-progress', qaProgress: 'molastria-qa-progress'
  };
  const WEEKDAYS = en ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'] : ['一', '二', '三', '四', '五', '六', '日'];
  const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmtDay = (d) => { const [y, m, dd] = d.split('-').map(Number); return en ? `${MONTHS[m - 1]} ${dd}, ${y}` : `${y} 年 ${m} 月 ${dd} 日`; };

  let state = C.migrate(read(C.KEY));
  const save = () => { try { localStorage.setItem(C.KEY, JSON.stringify(state)); } catch { /* private mode */ } };

  function gather() {
    const stores = {};
    for (const [k, key] of Object.entries(KEYS)) stores[k] = read(key);
    state = C.migrate(read(C.KEY));
    const counts = C.dayCounts(state, C.derivedDays(stores));
    const petLevel = window.MolAstriaPetCore?.levelOf ? (xp) => window.MolAstriaPetCore.levelOf(xp).level : null;
    return { stores, counts, sum: C.summary(stores, Date.now(), petLevel) };
  }

  // ── 上面四个数 ──
  function ring(done, goal) {
    const r = 34, c = 2 * Math.PI * r, f = Math.min(1, done / goal);
    return `<svg class="me-ring" viewBox="0 0 84 84" aria-hidden="true"><circle cx="42" cy="42" r="${r}" class="me-ring-bg"/>` +
      `<circle cx="42" cy="42" r="${r}" class="me-ring-fg${done >= goal ? ' met' : ''}" stroke-dasharray="${(c * f).toFixed(2)} ${c.toFixed(2)}" transform="rotate(-90 42 42)"/>` +
      `<text x="42" y="40" text-anchor="middle" class="me-ring-n">${done}</text><text x="42" y="56" text-anchor="middle" class="me-ring-d">/ ${goal}</text></svg>`;
  }
  function drawTop(counts) {
    const st = C.streak(counts), wk = C.week(counts, state.goal);
    const streakLine = st.current === 0 ? L('今天学一点就开始计数', 'Do a little today to start a streak')
      : st.today ? L('今天已经学过了', 'Done for today') : L('今天还没学，别断了', 'Not yet today, keep it going');
    const weekLine = wk.met ? L('本周目标达成', 'Weekly goal reached')
      : wk.left > wk.daysLeft + (wk.days.find((d) => d.today)?.n ? 0 : 1) ? L(`还差 ${wk.left} 天，这周有点悬了`, `${wk.left} days to go, this week is tight`)
      : L(`还差 ${wk.left} 天`, `${wk.left} more day${wk.left === 1 ? '' : 's'}`);
    $('me-top').innerHTML = `
      <div class="me-stat me-stat-streak"><span class="me-stat-k">${L('连续学习', 'Current streak')}</span>
        <b class="me-stat-n">${st.current}<small>${L('天', st.current === 1 ? 'day' : 'days')}</small></b><span class="me-stat-note">${streakLine}</span></div>
      <div class="me-stat me-stat-week">${ring(wk.done, wk.goal)}<div><span class="me-stat-k">${L('本周', 'This week')}</span>
        <div class="me-week" aria-label="${L('本周每天', 'Each day this week')}">${wk.days.map((d, i) => `<span class="me-wd${d.n ? ' on' : ''}${d.today ? ' today' : ''}${d.future ? ' future' : ''}" title="${esc(fmtDay(d.day))}">${WEEKDAYS[i]}</span>`).join('')}</div>
        <span class="me-stat-note">${weekLine}</span></div></div>
      <div class="me-stat"><span class="me-stat-k">${L('最长连续', 'Longest streak')}</span><b class="me-stat-n">${st.longest}<small>${L('天', st.longest === 1 ? 'day' : 'days')}</small></b></div>
      <div class="me-stat"><span class="me-stat-k">${L('累计学习', 'Days studied')}</span><b class="me-stat-n">${st.total}<small>${L('天', st.total === 1 ? 'day' : 'days')}</small></b></div>`;
    for (const b of document.querySelectorAll('#me-goal button')) b.setAttribute('aria-pressed', String(Number(b.dataset.goal) === state.goal));
    return wk;
  }

  // ── 热力图 ──
  function drawHeat(counts) {
    const narrow = (document.getElementById('me-heat')?.clientWidth || 700) < 520;
    const weeks = narrow ? 17 : 26;
    const cols = C.heatmap(counts, weeks);
    const cell = 13, gap = 3, top = 18, left = en ? 14 : 18;
    const w = left + weeks * (cell + gap), h = top + 7 * (cell + gap);
    let s = `<svg viewBox="0 0 ${w} ${h}" class="me-heat-svg" role="img" aria-label="${L(`最近 ${weeks} 周每天的学习次数`, `Study activity per day over the last ${weeks} weeks`)}">`;
    let lastMonth = -1;
    cols.forEach((col, x) => {
      const m = Number(col[0].day.slice(5, 7)) - 1;
      if (m !== lastMonth) { if (x < weeks - 2) s += `<text x="${left + x * (cell + gap)}" y="11" class="me-heat-m">${en ? MONTHS[m] : `${m + 1}月`}</text>`; lastMonth = m; }
      col.forEach((c, y) => {
        if (c.future) return;
        const tip = `${fmtDay(c.day)} · ${c.n ? L(`做了 ${c.n} 件事`, `${c.n} activit${c.n === 1 ? 'y' : 'ies'}`) : L('没有学', 'nothing')}`;
        s += `<rect x="${left + x * (cell + gap)}" y="${top + y * (cell + gap)}" width="${cell}" height="${cell}" rx="3" class="me-l${c.level}"><title>${esc(tip)}</title></rect>`;
      });
    });
    [0, 2, 4].forEach((y) => { s += `<text x="0" y="${top + y * (cell + gap) + 10}" class="me-heat-d">${WEEKDAYS[y]}</text>`; });
    s += '</svg>';
    $('me-heat').innerHTML = s;
  }

  // ── 最近 30 天做了什么 ──
  function drawKinds() {
    const since = C.addDays(C.dayKey(Date.now()), -29);
    const tot = {};
    for (const [d, v] of Object.entries(state.days)) if (d >= since) for (const [k, n] of Object.entries(v.k)) tot[k] = (tot[k] || 0) + n;
    const rows = Object.entries(tot).sort((a, b) => b[1] - a[1]);
    const max = rows[0]?.[1] || 1;
    $('me-kinds').innerHTML = rows.length ? rows.map(([k, n]) => `<div class="me-kind"><span>${L(...C.KIND_NAMES[k])}</span><i style="--w:${Math.max(4, Math.round((n / max) * 100))}%"></i><b>${n}</b></div>`).join('')
      : `<p class="me-empty">${L('最近 30 天这台设备上还没有记录。答一道题、复习一张卡、在研习台走一步，这里就会有。', 'Nothing recorded on this device in the last 30 days. Answer a question, review a card or take a step in the Study Desk and it shows up here.')}</p>`;
  }

  // ── 接下来做什么 ──
  function drawNext(sum, wk) {
    const steps = C.nextSteps(sum, wk);
    $('me-next').innerHTML = steps.length ? steps.map((s) => `<a class="me-next-item" href="${esc(s.href)}"><span>${esc(L(s.zh, s.en))}</span><i class="ico-ext ico-right" aria-hidden="true"></i></a>`).join('')
      : `<p class="me-empty">${L('都做完了。可以去讲解手册读一章，或者在研习台开一个新目标。', 'All caught up. Read a handbook chapter, or start a new goal in the Study Desk.')}</p>`;
  }

  // ── 各栏目 ──
  const bar = (done, total) => `<span class="me-bar" role="img" aria-label="${done} / ${total}"><i style="--w:${total ? Math.round((done / total) * 100) : 0}%"></i></span>`;
  function card(href, title, big, unit, lines, extra = '') {
    return `<a class="me-card" href="${href}"><span class="me-card-h">${title}</span><b class="me-card-n">${big}<small>${unit}</small></b>${extra}<span class="me-card-l">${lines}</span></a>`;
  }
  function drawAreas(sum) {
    const q = sum.quiz, ch = sum.checks, lr = sum.learn, rv = sum.review;
    const quizDone = q.qp.done + q.fm.done, quizTotal = q.qp.total + q.fm.total;
    const chkDone = ch.qp.done + ch.fm.done + ch.qa.done, chkTotal = ch.qp.total + ch.fm.total + ch.qa.total;
    const pet = sum.pet;
    $('me-areas').innerHTML = [
      card('../learn/index.html', L('研习台', 'Study Desk'), lr.sessions, L('个学习会话', lr.sessions === 1 ? ' session' : ' sessions'),
        L(`学完 ${lr.done} 个 · 练习 ${lr.practice} 次 · 知识图里 ${lr.props} 条命题`, `${lr.done} finished · ${lr.practice} practice · ${lr.props} propositions in your graph`)),
      card('../review/index.html', L('复习卡片', 'Flashcards'), rv.due, L('张今天到期', rv.due === 1 ? ' due today' : ' due today'),
        L(`学过 ${rv.seen} 张 · 最近 7 天复习 ${rv.week} 次 · 自己写了 ${rv.mine} 张`, `${rv.seen} seen · ${rv.week} reviews in 7 days · ${rv.mine} of your own`)),
      card('../quantum/physics/index.html', L('公式题', 'Formula questions'), quizDone, ` / ${quizTotal}`,
        L(`量子物理 ${q.qp.done}/${q.qp.total} · 数学基础 ${q.fm.done}/${q.fm.total}`, `Quantum physics ${q.qp.done}/${q.qp.total} · Maths ${q.fm.done}/${q.fm.total}`), bar(quizDone, quizTotal)),
      card('../quantum/index.html', L('过关自测', 'Self-checks'), chkDone, ` / ${chkTotal}`,
        L(`量子物理 ${ch.qp.done}/${ch.qp.total} · 数学 ${ch.fm.done}/${ch.fm.total} · 量子算法 ${ch.qa.done}/${ch.qa.total}`, `Quantum physics ${ch.qp.done}/${ch.qp.total} · Maths ${ch.fm.done}/${ch.fm.total} · Algorithms ${ch.qa.done}/${ch.qa.total}`), bar(chkDone, chkTotal)),
      card('../qchem/index.html', L('游乐场', 'Playground'), sum.play.played.length, ` / ${sum.play.total}`,
        sum.play.played.length ? esc(sum.play.played.slice(0, 4).map((g) => L(g.zh, g.en)).join(L('、', ', '))) + (sum.play.played.length > 4 ? L(' 等', ' and more') : '') : L('还没有游戏成绩', 'No game scores yet'), bar(sum.play.played.length, sum.play.total)),
      pet ? card('../pet/index.html', L('小宠物', 'Pet'), pet.level ?? '·', L(' 级', pet.level == null ? '' : ' level'), esc(L(`${pet.name} 在等你`, `${pet.name} is waiting for you`)))
        : card('../pet/index.html', L('小宠物', 'Pet'), '—', '', L('还没有领养', 'Not adopted yet'))
    ].join('');
  }

  function draw() {
    const { counts, sum } = gather();
    const wk = drawTop(counts);
    drawHeat(counts);
    drawKinds();
    drawNext(sum, wk);
    drawAreas(sum);
    let syncOn = false;
    try { syncOn = localStorage.getItem('molastria-sync') === 'on'; } catch { /* private mode */ }
    $('me-sync').innerHTML = syncOn ? L('云同步开着：打卡记录和各栏目的进度会跟着账号到你的其他设备。', 'Cloud sync is on: your streak and progress follow your account to your other devices.')
      : L('这些记录只在这台设备的浏览器里。想在别的设备上也看到，<a href="../pro/account.html#sync-card">在账号页打开云同步</a>。', 'These records live only in this browser. To see them on your other devices, <a href="../pro/account.html#sync-card">turn on cloud sync on the account page</a>.');
  }

  $('me-goal').addEventListener('click', (e) => {
    const b = e.target.closest('[data-goal]');
    if (!b) return;
    state = C.migrate(read(C.KEY));
    state.goal = Number(b.dataset.goal);
    save();
    draw();
  });
  window.addEventListener('molastria:activity', draw);
  window.addEventListener('storage', (e) => { if (!e.key || e.key.startsWith('molastria-')) draw(); });
  let rz = 0;
  window.addEventListener('resize', () => { clearTimeout(rz); rz = setTimeout(() => drawHeat(C.dayCounts(state, C.derivedDays({ review: read(KEYS.review), learn: read(KEYS.learn) }))), 150); });
  draw();
})();
