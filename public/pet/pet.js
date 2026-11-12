/* 小宠物页（/pet/）：选一只吉祥物领养、起名字，然后摸摸、喂食、玩耍、哄睡，升级解锁配饰。
   逻辑在 pet-core.js，3D 在 pet-3d.js（载不到 three.js 或没有 WebGL 时用静态图片，功能一样）。
   存档是 localStorage 的 molastria-pet（打开云同步时跟着账号走）；只在动作发生时写，时间带来的变化每次读的时候现算。
   界面文字自带中英两版，translate="no"。 */
(() => {
  'use strict';
  const C = window.MolAstriaPetCore;
  const root = document.documentElement;
  const en = root.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const app = document.getElementById('pt');
  if (!C || !app) return;
  const reduce = matchMedia('(prefers-reduced-motion: reduce)').matches;
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const nm = (o) => (en ? o.en : o.zh);

  const read = () => { try { return C.parse(localStorage.getItem(C.KEY)); } catch { return null; } };
  const write = (s) => { try { if (s) localStorage.setItem(C.KEY, JSON.stringify(s)); else localStorage.removeItem(C.KEY); } catch { /* private mode */ } };
  const buddyOn = () => { try { return localStorage.getItem(C.BUDDY_KEY) !== 'off'; } catch { return true; } };
  let saved = read();
  let pick = saved?.kind || C.KINDS[0].id;
  let stage = null, stageReady = null, failed3d = false;
  let sayTimer = 0, tickTimer = 0;
  const now = () => Date.now();
  const view = () => (saved ? C.advance(saved, now()) : null);

  // ── 3D 舞台（整页只有一个，领养前后共用）
  const stageHtml = (label) => `<div class="pt-stage" id="pt-stage" data-mode="loading">
      <canvas id="pt-canvas" role="img" aria-label="${esc(label)}"></canvas>
      <img id="pt-still" alt="" hidden>
      <div class="pt-fx" id="pt-fx" aria-hidden="true"></div>
      <p class="pt-say" id="pt-say" role="status" aria-live="polite" hidden></p>
      <p class="pt-hint" id="pt-hint">${L('拖动转身 · 点一下摸摸它', 'Drag to turn · tap to pat')}</p>
    </div>`;
  function mountStage(kind, acc, mood) {
    const canvas = document.getElementById('pt-canvas'), still = document.getElementById('pt-still'), box = document.getElementById('pt-stage');
    const showStill = () => {
      failed3d = true;
      box.dataset.mode = 'still';
      canvas.hidden = true;
      still.hidden = false;
      still.src = `img/${kind}.webp`;
      still.alt = canvas.getAttribute('aria-label').split(/。|\. /)[0];
      document.getElementById('pt-hint').textContent = L('3D 没有载入（需要联网和 WebGL），先看图片', '3D did not load (needs a connection and WebGL); showing a picture');
    };
    if (stage) { try { stage.dispose(); } catch { /* ignore */ } stage = null; }
    if (failed3d || !window.MolAstriaPet3D) { showStill(); return Promise.resolve(null); }
    stageReady = window.MolAstriaPet3D.load().then((T) => {
      if (!canvas.isConnected) return null;
      stage = window.MolAstriaPet3D.create(T, canvas, { reduce, onTap: () => doAct('pet') });
      stage.setTheme(isDark());
      stage.setKind(kind);
      stage.setAcc(acc || '');
      stage.setMood(mood || 'ok');
      box.dataset.mode = '3d';
      return stage;
    }).catch(() => { showStill(); return null; });
    return stageReady;
  }
  function stillAnim(type) {
    const still = document.getElementById('pt-still');
    if (!still || still.hidden || reduce) return;
    still.dataset.anim = '';
    void still.offsetWidth;
    still.dataset.anim = type;
  }
  // 图片模式下点图片也算摸摸（3D 模式由画布自己判断是轻点还是拖动）
  app.addEventListener('click', (e) => { if (e.target.id === 'pt-still') doAct('pet'); });
  const isDark = () => root.dataset.theme === 'dark' || (root.dataset.theme !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches);
  new MutationObserver(() => stage?.setTheme(isDark())).observe(root, { attributes: true, attributeFilter: ['data-theme'] });

  // ── 小特效：爱心、星星、Zzz（HTML 叠在画布上）
  function burst(kind, n = 6) {
    const fx = document.getElementById('pt-fx');
    if (!fx || reduce) return;
    for (let i = 0; i < n; i++) {
      const s = document.createElement('i');
      s.className = `pt-p pt-${kind}`;
      s.style.setProperty('--x', `${(Math.random() - 0.5) * 160}px`);
      s.style.setProperty('--d', `${i * 70}ms`);
      s.style.left = `${46 + (Math.random() - 0.5) * 14}%`;
      fx.append(s);
      setTimeout(() => s.remove(), 1600 + i * 70);
    }
  }
  function say(text, ms = 5200) {
    const el = document.getElementById('pt-say');
    if (!el) return;
    el.textContent = text;
    el.hidden = false;
    clearTimeout(sayTimer);
    sayTimer = setTimeout(() => { el.hidden = true; }, ms);
  }

  // ── 领养前：三只里选一只
  function renderAdopt() {
    const k = C.kindOf(pick);
    app.innerHTML = `<header class="pt-mast">
        <p class="pt-eyebrow">MOLASTRIA · PETS</p>
        <h1>${L('领养一只小宠物', 'Adopt a little pet')}</h1>
        <p class="pt-lead">${L('MolAstria 的三个吉祥物在等一个主人。选一只，给它起个名字，以后来学习的时候顺便摸摸它、喂一块苯环饼干。它不会生病，也不会因为你忙而离开，只是会想你。', 'MolAstria’s three mascots are waiting for a home. Pick one, give it a name, and drop by to pat it or share a benzene cookie when you come to study. It never gets sick and won’t leave when you’re busy. It just misses you.')}</p>
      </header>
      <section class="pt-adopt">
        ${stageHtml(L(`候选宠物：${k.zh}`, `Candidate: ${k.en}`))}
        <div class="pt-pick">
          <h2 class="pt-h2">${L('选一只', 'Choose one')}</h2>
          <div class="pt-kinds" role="radiogroup" aria-label="${L('三只吉祥物', 'Three mascots')}">
            ${C.KINDS.map((x) => `<button type="button" class="pt-kind" role="radio" aria-checked="${x.id === pick}" data-kind="${x.id}">
              <img src="img/${x.id}.webp" alt="" width="72" height="72" loading="lazy"><span><b>${esc(nm(x))}</b><small>${esc(x.note[en ? 1 : 0])}</small></span></button>`).join('')}
          </div>
          <form class="pt-name" id="pt-adopt-form">
            <label for="pt-name-in">${L('给它起个名字', 'Give it a name')}</label>
            <div class="pt-row"><input id="pt-name-in" maxlength="24" autocomplete="off" placeholder="${esc(nm(k))}"><button type="submit" class="pt-btn pt-primary">${L('领养', 'Adopt')}</button></div>
            <p class="pt-note">${L('宠物存在这台设备的浏览器里；登录并在账号页打开云同步后，换一台设备也是同一只。', 'Your pet lives in this browser. Sign in and switch on cloud sync on the account page to keep the same pet on every device.')}</p>
          </form>
        </div>
      </section>`;
    mountStage(pick, '', 'happy').then((s) => s?.play('hello'));
    app.querySelectorAll('[data-kind]').forEach((b) => b.addEventListener('click', () => {
      pick = b.dataset.kind;
      app.querySelectorAll('[data-kind]').forEach((x) => x.setAttribute('aria-checked', String(x.dataset.kind === pick)));
      const kk = C.kindOf(pick);
      document.getElementById('pt-name-in').placeholder = nm(kk);
      const cv = document.getElementById('pt-canvas');
      cv?.setAttribute('aria-label', L(`候选宠物：${kk.zh}`, `Candidate: ${kk.en}`));
      if (stage) { stage.setKind(pick); stage.play('hello'); } else if (failed3d) { const st = document.getElementById('pt-still'); st.src = `img/${pick}.webp`; stillAnim('hop'); }
    }));
    document.getElementById('pt-adopt-form').addEventListener('submit', (e) => {
      e.preventDefault();
      const kk = C.kindOf(pick);
      const raw = document.getElementById('pt-name-in').value;
      saved = C.fresh(pick, raw.trim() ? raw : (en ? kk.en : kk.zh), now());
      write(saved);
      renderHome(true);
    });
  }

  // ── 领养后：它的小窝
  const MOOD_TEXT = { sleeping: ['睡着了', 'Asleep'], hungry: ['饿了', 'Hungry'], tired: ['困了', 'Sleepy'], sad: ['有点寂寞', 'A bit lonely'], happy: ['很开心', 'Happy'], ok: ['挺好的', 'Doing fine'] };
  const bar = (id, zh, e, v) => `<div class="pt-stat"><span>${L(zh, e)}</span><div class="pt-bar" role="progressbar" aria-label="${L(zh, e)}" aria-valuemin="0" aria-valuemax="100" aria-valuenow="${Math.round(v)}" data-stat="${id}"><i style="width:${Math.round(v)}%"></i></div><b data-num="${id}">${Math.round(v)}</b></div>`;

  function renderHome(adoptedNow) {
    const s = view();
    const k = C.kindOf(s.kind), lv = C.levelOf(s.xp), un = C.unlocked(s);
    app.innerHTML = `<header class="pt-mast pt-mast-home">
        <p class="pt-eyebrow">MOLASTRIA · PETS</p>
        <h1><span id="pt-title">${esc(s.name)}</span><small>${L(`的小窝`, `’s corner`)}</small></h1>
      </header>
      <section class="pt-home">
        <div class="pt-left">
          ${stageHtml(L(`你的宠物 ${s.name}，${k.zh}。可以拖动转身，点一下摸摸它`, `Your pet ${s.name}, ${k.en}. Drag to turn it, tap to pat it`))}
          <div class="pt-acts" role="group" aria-label="${L('和它互动', 'Play with it')}">
            <button type="button" class="pt-act" data-act="pet"><span class="pt-ic pt-ic-heart" aria-hidden="true"></span>${L('摸摸', 'Pat')}</button>
            <button type="button" class="pt-act" data-act="feed" aria-expanded="false" aria-controls="pt-snacks"><span class="pt-ic pt-ic-food" aria-hidden="true"></span>${L('喂食', 'Feed')}</button>
            <button type="button" class="pt-act" data-act="play"><span class="pt-ic pt-ic-ball" aria-hidden="true"></span>${L('玩耍', 'Play')}</button>
            <button type="button" class="pt-act" data-act="sleep" id="pt-sleep"><span class="pt-ic pt-ic-moon" aria-hidden="true"></span><span id="pt-sleep-t"></span></button>
          </div>
          <div class="pt-snacks" id="pt-snacks" hidden>
            ${C.SNACKS.map((x) => `<button type="button" class="pt-snack" data-snack="${x.id}"><i class="pt-sn pt-sn-${x.id}" aria-hidden="true"></i><b>${esc(nm(x))}</b><small>${L(`饱腹 +${x.full}`, `Fullness +${x.full}`)}</small></button>`).join('')}
          </div>
        </div>
        <div class="pt-right">
          <div class="pt-card pt-who">
            <img src="img/${s.kind}.webp" alt="" width="56" height="56">
            <div><p class="pt-name-line"><b id="pt-name">${esc(s.name)}</b><button type="button" class="pt-link" id="pt-rename">${L('改名', 'Rename')}</button></p>
            <p class="pt-sub">${esc(nm(k))} · <span id="pt-days"></span> · <span id="pt-mood"></span></p></div>
          </div>
          <form class="pt-rename" id="pt-rename-form" hidden><input id="pt-rename-in" maxlength="24" autocomplete="off" aria-label="${L('新名字', 'New name')}" value="${esc(s.name)}"><button type="submit" class="pt-btn pt-primary">${L('保存', 'Save')}</button><button type="button" class="pt-btn" id="pt-rename-x">${L('取消', 'Cancel')}</button></form>
          <div class="pt-card">
            <div class="pt-level"><b id="pt-lv">Lv ${lv.level}</b><div class="pt-bar pt-xp" role="progressbar" aria-label="${L('亲密度', 'Bond')}" aria-valuemin="0" aria-valuemax="100" id="pt-xpbar"><i></i></div><small id="pt-xp"></small></div>
            ${bar('full', '饱腹', 'Fullness', s.full)}${bar('joy', '心情', 'Mood', s.joy)}${bar('energy', '精力', 'Energy', s.energy)}
            <p class="pt-note" id="pt-today"></p>
          </div>
          <div class="pt-card">
            <h2 class="pt-h2">${L('换装', 'Dress up')}</h2>
            <div class="pt-accs" role="radiogroup" aria-label="${L('配饰', 'Accessories')}">
              <button type="button" role="radio" class="pt-acc" data-acc="" aria-checked="${!s.acc}">${L('不戴', 'None')}</button>
              ${C.ACCS.map((a) => `<button type="button" role="radio" class="pt-acc" data-acc="${a.id}" aria-checked="${s.acc === a.id}" ${un.includes(a.id) ? '' : 'disabled'}><span>${esc(nm(a))}</span>${un.includes(a.id) ? '' : `<small>${L(`${a.level} 级解锁`, `Unlocks at Lv ${a.level}`)}</small>`}</button>`).join('')}
            </div>
          </div>
          <details class="pt-card pt-more">
            <summary>${L('更多', 'More')}</summary>
            <label class="pt-check"><input type="checkbox" id="pt-buddy" ${buddyOn() ? 'checked' : ''}><span>${L('在网站其他页面的右下角陪着我', 'Keep me company in the corner of other pages')}</span></label>
            <p class="pt-more-h">${L('换一只（名字、等级和配饰都留着）', 'Switch mascot (name, level and outfit stay)')}</p>
            <div class="pt-swap">${C.KINDS.map((x) => `<button type="button" class="pt-swap-b" data-swap="${x.id}" aria-pressed="${x.id === s.kind}"><img src="img/${x.id}.webp" alt="" width="40" height="40" loading="lazy"><span>${esc(nm(x))}</span></button>`).join('')}</div>
            <p class="pt-more-h">${L('把它带回家', 'Take it home')}</p>
            <p class="pt-note">${L('下载这只吉祥物的彩色 3D 模型（glTF 二进制 .glb），Blender、Windows 的 3D 查看器和各种在线查看器都能打开。', 'Download this mascot’s colour 3D model (binary glTF, .glb). Blender, Windows 3D Viewer and online glTF viewers open it.')}</p>
            <a class="pt-btn" id="pt-glb" href="models/${s.kind}.glb" download="${s.kind}.glb">${L('下载 3D 模型', 'Download 3D model')}</a>
            <p class="pt-more-h">${L('重新领养', 'Start over')}</p>
            <p class="pt-note">${L('清掉这只宠物的名字、等级和记录，回到选宠物的页面。', 'Clear this pet’s name, level and history and go back to choosing.')}</p>
            <button type="button" class="pt-btn pt-danger" id="pt-reset">${L('重新领养', 'Start over')}</button>
            <span class="pt-confirm" id="pt-reset-c" hidden>${L('确定吗？', 'Sure?')} <button type="button" class="pt-btn pt-danger" id="pt-reset-yes">${L('确定，重新开始', 'Yes, start over')}</button> <button type="button" class="pt-btn" id="pt-reset-no">${L('算了', 'Keep it')}</button></span>
          </details>
        </div>
      </section>`;
    paint(s);
    mountStage(s.kind, s.acc, C.mood(s)).then((st) => {
      if (adoptedNow) { st?.play('hello'); stillAnim('hop'); burst('heart', 8); say(L(`${s.name} 来到你身边了！`, `${s.name} is home with you!`)); }
    });
    if (!adoptedNow) setTimeout(() => talk(), 900);
    wire();
    clearInterval(tickTimer);
    tickTimer = setInterval(() => { if (saved) paint(view()); }, 30e3);
  }

  function paint(s) {
    const lv = C.levelOf(s.xp), m = C.mood(s);
    const set = (id, v) => { const el = document.getElementById(id); if (el) el.textContent = v; };
    for (const k of ['full', 'joy', 'energy']) {
      const b = app.querySelector(`[data-stat="${k}"]`);
      if (!b) continue;
      b.setAttribute('aria-valuenow', String(Math.round(s[k])));
      b.firstElementChild.style.width = `${Math.round(s[k])}%`;
      b.dataset.low = String(s[k] < 30);
      set(`pt-num-${k}`, '');
      const n = app.querySelector(`[data-num="${k}"]`);
      if (n) n.textContent = Math.round(s[k]);
    }
    set('pt-lv', `Lv ${lv.level}`);
    const xb = document.getElementById('pt-xpbar');
    if (xb) { xb.firstElementChild.style.width = `${Math.round(lv.progress * 100)}%`; xb.setAttribute('aria-valuenow', String(Math.round(lv.progress * 100))); }
    set('pt-xp', L(`亲密度 ${s.xp} / ${lv.to}`, `Bond ${s.xp} / ${lv.to}`));
    const d = C.daysTogether(s, now());
    set('pt-days', L(`在一起第 ${d} 天`, d === 1 ? 'Day 1 together' : `Day ${d} together`));
    set('pt-mood', L(MOOD_TEXT[m][0], MOOD_TEXT[m][1]));
    const today = s.day === C.dayKey(now()) ? s.dayXp : 0;
    set('pt-today', today >= C.DAY_XP ? L('今天的亲密度已经攒满了，明天再来。', 'Today’s bond is full. Come back tomorrow.') : L(`今天还能攒 ${C.DAY_XP - today} 点亲密度（每天最多 ${C.DAY_XP} 点）。`, `${C.DAY_XP - today} bond points left today (up to ${C.DAY_XP} a day).`));
    set('pt-sleep-t', s.asleep ? L('叫醒', 'Wake') : L('睡觉', 'Sleep'));
    const sb = document.getElementById('pt-sleep');
    if (sb) sb.dataset.act = s.asleep ? 'wake' : 'sleep';
    const box = document.getElementById('pt-stage');
    if (box) box.dataset.mood = m;
    app.querySelectorAll('[data-act="feed"],[data-act="play"]').forEach((b) => { b.disabled = s.asleep; });
    stage?.setMood(m);
  }

  function talk() {
    const s = view();
    if (!s) return;
    const l = C.line(s);
    say(en ? l.en : l.zh);
  }

  function doAct(action, arg) {
    if (!saved) { stage?.play('pet'); stillAnim('hop'); burst('heart', 4); return; }
    const r = C.act(saved, action, now(), arg);
    saved = r.s;
    write(saved);
    if (!r.ok) {
      stage?.play('refuse'); stillAnim('shake');
      const w = C.WHY[r.why] || C.WHY.unknown;
      say(en ? w[1] : w[0], 3600);
    } else {
      stage?.play(action === 'pet' && saved.asleep ? 'sleep' : action, arg);
      stillAnim(action === 'sleep' ? 'settle' : 'hop');
      if (action === 'pet') { burst('heart', saved.asleep ? 2 : 6); if (Math.random() < 0.45 && !saved.asleep) setTimeout(talk, 500); }
      if (action === 'feed') { const sn = C.SNACKS.find((x) => x.id === r.snack); say(L(`好吃！谢谢你的${sn.zh}。`, `Yum! Thanks for the ${sn.en.toLowerCase()}.`), 3600); setTimeout(() => burst('crumb', 6), 900); }
      if (action === 'play') { setTimeout(() => burst('star', 7), 900); say(L('接住啦！', 'Got it!'), 3000); }
      if (action === 'sleep') say(L('晚安……', 'Good night…'), 3000);
      if (action === 'wake') { say(L('早上好！睡得好香。', 'Morning! What a nap.'), 3600); }
      if (r.levelUp) {
        setTimeout(() => {
          stage?.play('levelup'); burst('star', 12);
          const acc = C.ACCS.find((a) => a.level === r.levelUp);
          say(L(`升到 ${r.levelUp} 级了！${acc ? `解锁了${acc.zh}。` : ''}`, `Level ${r.levelUp}!${acc ? ` ${acc.en} unlocked.` : ''}`), 5200);
          renderAccs();
        }, 1500);
      }
    }
    paint(view());
  }

  function renderAccs() {
    const s = view(), un = C.unlocked(s);
    app.querySelectorAll('[data-acc]').forEach((b) => {
      const id = b.dataset.acc;
      b.setAttribute('aria-checked', String((s.acc || '') === id));
      if (id && un.includes(id) && b.disabled) { b.disabled = false; b.querySelector('small')?.remove(); }
    });
  }

  function wire() {
    app.querySelectorAll('[data-act]').forEach((b) => b.addEventListener('click', () => {
      const a = b.dataset.act;
      if (a === 'feed') {
        const box = document.getElementById('pt-snacks');
        box.hidden = !box.hidden;
        b.setAttribute('aria-expanded', String(!box.hidden));
        if (!box.hidden) box.querySelector('button')?.focus();
        return;
      }
      doAct(a);
    }));
    app.querySelectorAll('[data-snack]').forEach((b) => b.addEventListener('click', () => {
      doAct('feed', b.dataset.snack);
      document.getElementById('pt-snacks').hidden = true;
      app.querySelector('[data-act="feed"]').setAttribute('aria-expanded', 'false');
    }));
    app.querySelectorAll('[data-acc]').forEach((b) => b.addEventListener('click', () => {
      if (b.disabled) return;
      saved = C.setAcc(view(), b.dataset.acc);
      write(saved);
      stage?.setAcc(saved.acc);
      renderAccs();
      if (saved.acc) { stage?.play('hello'); stillAnim('hop'); }
    }));
    const form = document.getElementById('pt-rename-form');
    document.getElementById('pt-rename').addEventListener('click', () => { form.hidden = false; document.getElementById('pt-rename-in').select(); });
    document.getElementById('pt-rename-x').addEventListener('click', () => { form.hidden = true; });
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      saved = C.rename(view(), document.getElementById('pt-rename-in').value);
      write(saved);
      form.hidden = true;
      document.getElementById('pt-name').textContent = saved.name;
      document.getElementById('pt-title').textContent = saved.name;
      say(L(`我叫${saved.name}啦！`, `Call me ${saved.name}!`), 3000);
    });
    document.getElementById('pt-buddy').addEventListener('change', (e) => { try { if (e.target.checked) localStorage.removeItem(C.BUDDY_KEY); else localStorage.setItem(C.BUDDY_KEY, 'off'); } catch { /* ignore */ } });
    app.querySelectorAll('[data-swap]').forEach((b) => b.addEventListener('click', () => {
      if (b.dataset.swap === saved.kind) return;
      saved = C.setKind(view(), b.dataset.swap);
      write(saved);
      renderHome(false);
      setTimeout(() => stage?.play('hello'), 300);
    }));
    const rc = document.getElementById('pt-reset-c');
    document.getElementById('pt-reset').addEventListener('click', () => { rc.hidden = false; document.getElementById('pt-reset-no').focus(); });
    document.getElementById('pt-reset-no').addEventListener('click', () => { rc.hidden = true; });
    document.getElementById('pt-reset-yes').addEventListener('click', () => {
      pick = saved.kind;
      saved = null;
      write(null);
      clearInterval(tickTimer);
      renderAdopt();
      scrollTo({ top: 0 });
    });
  }

  // 别的标签页或云同步改了存档：重新画。
  addEventListener('storage', (e) => {
    if (e.key !== C.KEY) return;
    const next = read();
    const had = !!saved;
    saved = next;
    if (!next) { if (had) renderAdopt(); return; }
    if (!had || stage?.kind !== next.kind) renderHome(false);
    else { paint(view()); stage?.setAcc(next.acc); renderAccs(); }
  });

  if (saved) renderHome(false); else renderAdopt();
  window.MolAstriaPet = { get state() { return view(); }, act: doAct, get mode() { return document.getElementById('pt-stage')?.dataset.mode; } };
})();
