/* 复习卡片页面：把 review-core.js 的卡组和队列画出来，载入 ts-fsrs 做调度，存档在 localStorage 的 molastria-review。
   研习台的存档（molastria-learn）只读。键盘：空格或回车显示答案，1–4 打分。 */
(() => {
  'use strict';
  const C = window.MOLASTRIA_REVIEW_CORE;
  if (!C) return;
  const $ = (id) => document.getElementById(id);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const i18n = () => window.ChemI18n || { lang: 'zh', t: (s) => s };
  const t = (s) => i18n().t(s);

  // ── 存档 ──
  const load = (key) => { try { return localStorage.getItem(key); } catch { return null; } };
  let state = C.migrate(load(C.STORE_KEY));
  let saveFailed = false;
  function save() {
    try { localStorage.setItem(C.STORE_KEY, JSON.stringify(state)); saveFailed = false; } catch { saveFailed = true; }
  }

  // ── 调度：ts-fsrs（MIT），从 jsDelivr 载入，固定版本 ──
  const FSRS_VERSION = '5.4.2';
  const FSRS_SRC = `https://cdn.jsdelivr.net/npm/ts-fsrs@${FSRS_VERSION}/dist/index.umd.js`;
  let scheduler = null;
  function loadFsrs() {
    if (window.FSRS?.fsrs) return Promise.resolve(window.FSRS);
    return new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = FSRS_SRC; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (window.FSRS?.fsrs ? resolve(window.FSRS) : reject(new Error('ts-fsrs')));
      s.onerror = () => reject(new Error('ts-fsrs'));
      document.head.append(s);
    });
  }
  function fsrsScheduler(F) {
    const f = F.fsrs(F.generatorParameters({ enable_fuzz: true }));
    return {
      empty: (now) => F.createEmptyCard(new Date(now)),
      next: (card, now, r) => f.next(card, new Date(now), r).card,
      preview: (card, now) => { const p = f.repeat(card, new Date(now)); const o = {}; for (const r of C.RATINGS) o[r] = p[r].card; return o; }
    };
  }

  // ── 卡片 ──
  let cards = [], byId = new Map();
  const dirNow = () => (state.dir === 'auto' ? (i18n().lang === 'en' ? 'en-zh' : 'zh-en') : state.dir);
  function collect() {
    cards = [
      ...C.mineCards(state),
      ...C.learnCards(load(C.LEARN_KEY)),
      ...C.termCards(window.MolAstriaTerms?.groups || [], dirNow())
    ];
    byId = new Map(cards.map((c) => [c.id, c]));
  }

  const DECK_NAMES = { terms: '中英术语', learn: '研习台', mine: '我的卡片' };
  const DECK_NOTES = {
    terms: '站内搜索用的中英术语表，每组一张：看中文想英文，或者反过来。',
    learn: '研习台知识图里的推理链（由前提推结论）和知识点（讲清楚来龙去脉）。只读，不会改动研习台。',
    mine: '你自己写的卡片，写在下面。'
  };

  // ── 学习区 ──
  let current = null, shown = false, timer = 0;
  const unit = (ms) => {
    const [n, u] = C.interval(ms);
    return { min: `${n} 分钟后`, h: `${n} 小时后`, d: `${n} 天后`, mo: `${n} 个月后`, y: `${n} 年后` }[u];
  };
  function faceHtml(c) {
    if (c.kind === 'chain') {
      return {
        front: `<p class="rv-ask">由这些推出什么？</p><ul class="rv-prem" translate="no">${c.premises.map((p) => `<li>${esc(p)}</li>`).join('')}</ul>`,
        back: `<p class="rv-ans" translate="no">${esc(c.back)}</p>`
      };
    }
    if (c.kind === 'prop') {
      return {
        front: `<p class="rv-ask">讲清楚这一条，并说出它从哪里来：</p><p class="rv-q" translate="no">${esc(c.front)}</p>`,
        back: `${c.sessions?.length ? `<p class="rv-from">来自研习台：<span translate="no">${esc(c.sessions.join('；'))}</span></p>` : ''}<p class="rv-from">对照研习台里的原始讲解，讲不清的地方去那里再练一次。</p><p><a class="rv-link" href="../learn/index.html#practice">去研习台练习 <i class="ico-ext ico-right" aria-hidden="true"></i></a></p>`
      };
    }
    if (c.kind === 'term') {
      const alt = (c.front === c.zh ? c.enAlt : c.zhAlt) || [];
      return {
        front: `<p class="rv-term" translate="no">${esc(c.front)}</p>`,
        back: `<p class="rv-term rv-term-a" translate="no">${esc(c.back)}</p>${alt.length ? `<p class="rv-from">也写作：<span translate="no">${esc(alt.join('、'))}</span></p>` : ''}`
      };
    }
    return { front: `<p class="rv-q rv-pre" translate="no">${esc(c.front)}</p>`, back: `<p class="rv-ans rv-pre" translate="no">${esc(c.back)}</p>${c.tags?.length ? `<p class="rv-from" translate="no">${esc(c.tags.map((x) => `#${x}`).join(' '))}</p>` : ''}` };
  }

  function render() {
    clearTimeout(timer);
    const now = Date.now();
    const q = C.buildQueue(state, cards, now);
    const st = $('rv-status');
    st.textContent = q.total ? `到期 ${q.due} 张 · 新卡 ${Math.min(q.fresh, q.newLeft)} 张（共 ${q.total} 张）` : '';
    current = q.queue[0] || null;
    shown = false;
    $('rv-card').hidden = !current;
    $('rv-actions').hidden = !current;
    $('rv-done').hidden = !!current;
    if (current) {
      const f = faceHtml(current);
      const sch = state.sched[current.id];
      $('rv-tag').textContent = `${t(DECK_NAMES[current.deck])} · ${sch ? t('复习') : t('新卡')}`;
      $('rv-front').innerHTML = f.front;
      $('rv-back').innerHTML = f.back;
      $('rv-back').hidden = true;
      $('rv-show').hidden = false;
      $('rv-rate').hidden = true;
    } else {
      const doneH = $('rv-done-h'), doneT = $('rv-done-text');
      if (!q.total) {
        doneH.textContent = '还没有可以复习的卡片';
        doneT.textContent = '在下面勾选一个卡组，或者写一张自己的卡。';
      } else {
        doneH.textContent = '今天的复习做完了';
        const more = q.fresh > q.newLeft ? q.fresh - q.newLeft : 0;
        doneT.textContent = q.next ? `下一张 ${unit(q.next - now)}到期。` : more ? `还有 ${more} 张新卡，明天接着学。` : '所有卡片都学过了。';
        if (q.next && q.next - now < 30 * 60000) timer = setTimeout(render, q.next - now + 500);
      }
    }
    renderDecks(now);
  }

  function reveal() {
    if (!current || shown) return;
    shown = true;
    $('rv-back').hidden = false;
    $('rv-show').hidden = true;
    $('rv-rate').hidden = false;
    const now = Date.now();
    const base = state.sched[current.id] ? { ...state.sched[current.id] } : (scheduler || C.simpleScheduler).empty(now);
    let p = null;
    try { p = (scheduler || C.simpleScheduler).preview(base, now); } catch { p = null; }
    for (const r of C.RATINGS) {
      const el = document.querySelector(`#rv-rate [data-iv="${r}"]`);
      const due = p?.[r]?.due;
      const ms = due == null ? NaN : (typeof due.getTime === 'function' ? due.getTime() : Number(due)) - now;
      el.textContent = Number.isFinite(ms) ? unit(ms) : '';
    }
    document.querySelector('#rv-rate [data-r="3"]').focus({ preventScroll: true });
  }

  function rate(r) {
    if (!current || !shown) return;
    try { C.record(state, current.id, r, Date.now(), scheduler || C.simpleScheduler); } catch { return; }
    save();
    if (saveFailed) $('rv-sched-note').textContent = '这台设备的浏览器不让保存（可能是隐私模式），关掉页面后进度会丢失。';
    render();
    $('rv-show').focus({ preventScroll: true });
  }

  // ── 卡组 ──
  function renderDecks(now = Date.now()) {
    const s = C.deckStats(state, cards, now);
    $('rv-decks').innerHTML = C.DECKS.map((d) => {
      const o = s[d];
      const empty = d === 'learn' && !o.total ? '<span class="rv-empty">研习台还没有知识点。在研习台学完一节，这里会自动出现卡片。</span>' : '';
      return `<label class="rv-deck"><input type="checkbox" data-deck="${d}"${state.decks[d] ? ' checked' : ''}><span class="rv-deck-main"><b>${DECK_NAMES[d]}</b><span class="rv-deck-note">${DECK_NOTES[d]}</span>${empty}</span><span class="rv-deck-n"><span>共 ${o.total} 张</span><span>新卡 ${o.fresh} 张</span><span>到期 ${o.due} 张</span></span></label>`;
    }).join('');
    $('rv-dir').value = state.dir;
    $('rv-new').value = String(state.newPerDay);
    const mine = state.mine;
    $('rv-mine-sum').textContent = `我的卡片（共 ${mine.length} 张）`;
    $('rv-mine').innerHTML = mine.length
      ? mine.slice().reverse().map((m) => `<li><div translate="no"><b>${esc(m.front)}</b><span>${esc(m.back)}</span></div><button type="button" class="rv-del" data-del="mine:${esc(m.id)}">删除</button></li>`).join('')
      : '<li class="rv-empty">还没有自己的卡片。</li>';
  }

  // ── 下载 ──
  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  const stamp = () => new Date().toISOString().slice(0, 10);
  const outMsg = (s, bad = false) => { const m = $('rv-out-msg'); m.textContent = s; m.dataset.bad = String(bad); };

  // ── 事件 ──
  $('rv-show').addEventListener('click', reveal);
  $('rv-rate').addEventListener('click', (e) => { const b = e.target.closest('[data-r]'); if (b) rate(Number(b.dataset.r)); });
  document.addEventListener('keydown', (e) => {
    if (e.target.closest?.('input,textarea,select,[contenteditable]') || e.metaKey || e.ctrlKey || e.altKey) return;
    if (!current) return;
    // 焦点在按钮或链接上时，空格和回车照常按那个按钮（“显示答案”按钮自己会显示答案）
    if (!shown && (e.key === ' ' || e.key === 'Enter') && !e.target.closest?.('button,a,summary,label')) { e.preventDefault(); reveal(); }
    else if (shown && /^[1-4]$/.test(e.key)) { e.preventDefault(); rate(Number(e.key)); }
  });
  $('rv-decks').addEventListener('change', (e) => {
    const d = e.target.dataset.deck;
    if (!d) return;
    state.decks[d] = e.target.checked; save(); render();
  });
  $('rv-dir').addEventListener('change', (e) => { state.dir = e.target.value; save(); collect(); render(); });
  $('rv-new').addEventListener('change', (e) => {
    const n = Math.round(Number(e.target.value));
    if (Number.isFinite(n) && n >= 0 && n <= 200) { state.newPerDay = n; save(); }
    render();
  });
  $('rv-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const id = C.addMine(state, { front: $('rv-f').value, back: $('rv-b').value, tags: $('rv-t').value.split(/\s+/) });
    const m = $('rv-form-msg');
    if (!id) { m.textContent = state.mine.length >= C.MAX_MINE ? `最多 ${C.MAX_MINE} 张，先删掉一些。` : '正面和背面都要写。'; m.dataset.bad = 'true'; return; }
    save(); collect(); render();
    $('rv-f').value = ''; $('rv-b').value = ''; $('rv-t').value = '';
    m.textContent = '已加入，会作为新卡出现在今天的复习里。'; m.dataset.bad = 'false';
  });
  $('rv-mine').addEventListener('click', (e) => {
    const b = e.target.closest('[data-del]');
    if (!b) return;
    C.removeMine(state, b.dataset.del); save(); collect(); render();
  });
  $('rv-anki').addEventListener('click', () => {
    const list = cards.filter((c) => state.decks[c.deck]);
    if (!list.length) { outMsg('没有勾选的卡组可以导出。', true); return; }
    download(`molastria-review-anki-${stamp()}.txt`, C.ankiText(list, { deck: 'MolAstria', t }), 'text/plain');
    outMsg(`已导出 ${list.length} 张卡片。`);
  });
  $('rv-backup').addEventListener('click', () => {
    download(`molastria-review-backup-${stamp()}.json`, JSON.stringify({ app: 'molastria-review', saved: new Date().toISOString(), state }, null, 1), 'application/json');
    outMsg('备份已下载。');
  });
  $('rv-restore').addEventListener('change', async (e) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (file.size > 2e6) { outMsg('这个文件太大，不像是复习卡片的备份。', true); return; }
    let raw = null;
    try { raw = JSON.parse(await file.text()); } catch { raw = null; }
    if (!raw || raw.app !== 'molastria-review' || !raw.state) { outMsg('这不是复习卡片的备份文件。', true); return; }
    state = C.migrate(raw.state); save(); collect(); render();
    outMsg('已从备份恢复。');
  });
  $('rv-reset').addEventListener('click', () => {
    if (!window.confirm(t('清除全部复习进度和自己的卡片？这一步不能撤销，建议先下载备份。'))) return;
    state = C.emptyState(); save(); collect(); render();
    outMsg('已清除。');
  });
  // 另一个标签页（比如研习台）改了存档：重新读一遍
  window.addEventListener('storage', (e) => {
    if (e.key === C.STORE_KEY) state = C.migrate(e.newValue);
    if (e.key === C.STORE_KEY || e.key === C.LEARN_KEY) { collect(); if (!shown) render(); else renderDecks(); }
  });

  // ── 开始 ──
  collect();
  render();
  $('rv-sched-note').textContent = '正在载入 FSRS 调度算法…';
  loadFsrs().then((F) => {
    scheduler = fsrsScheduler(F);
    $('rv-sched-note').textContent = '';
    document.body.dataset.scheduler = 'fsrs';
  }).catch(() => {
    $('rv-sched-note').textContent = '没能载入 FSRS（需要联网访问 cdn.jsdelivr.net），先用简化的间隔安排复习，联网后会接着用 FSRS。';
    document.body.dataset.scheduler = 'simple';
  }).finally(() => { if (shown && current) { shown = false; reveal(); } });
  i18n().ready?.then?.(() => { if (state.dir === 'auto') { collect(); if (!shown) render(); } });
})();
