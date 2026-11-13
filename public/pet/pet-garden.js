/* 浮窗花园：顶栏菜单里“当前位置”的小宠物被点了，就在页面上开一个小花园，和宠物摸摸、喂食、玩耍、哄睡。
   shared-nav.js 点了才载入 pet-core.js 和本文件，然后调用 window.MolAstriaPetGarden.open(回焦点的元素)。
   存档就是小窝（pet/）那一份 molastria-pet（也在云同步里）；没领养时花园里是苞苞，可以就地领养它，或者去小窝挑一只。
   改了存档后在本页派发一个 storage 事件，小窝页面和右下角的小伙伴会跟着重画。只用静态图（不载 three.js）。
   文字自带中英两版，translate="no"；减少动态效果时没有动画。 */
(() => {
  'use strict';
  const C = window.MolAstriaPetCore;
  if (!C || window.MolAstriaPetGarden) return;
  const base = new URL('.', document.currentScript?.src || location.href); // …/pet/
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const read = () => { try { return C.parse(localStorage.getItem(C.KEY)); } catch { return null; } };
  const write = (s) => {
    const v = JSON.stringify(s);
    try { localStorage.setItem(C.KEY, v); } catch { /* private mode: the garden still works for this visit */ }
    // the same tab gets no storage event: send one so the pet page, the corner buddy and the header repaint
    try { dispatchEvent(new StorageEvent('storage', { key: C.KEY, newValue: v })); } catch { /* old browsers */ }
  };
  const still = matchMedia('(prefers-reduced-motion: reduce)');
  const MOOD = { sleeping: ['在睡觉', 'is asleep'], hungry: ['饿了', 'is hungry'], tired: ['困了', 'is sleepy'], sad: ['想你了', 'misses you'], happy: ['很开心', 'is happy'], ok: ['在花园里', 'is in the garden'] };

  // small drawings: the snacks, a heart, a sparkle (no emoji, so iPhone draws them the same)
  const SNACK_SVG = {
    benzene: '<svg viewBox="0 0 24 24"><path d="M12 2.8 20 7.4v9.2L12 21.2 4 16.6V7.4Z" fill="#d9a35b" stroke="#a8742f" stroke-width="1.4"/><circle cx="12" cy="12" r="4.2" fill="none" stroke="#a8742f" stroke-width="1.4"/></svg>',
    water: '<svg viewBox="0 0 24 24"><path d="M12 3c3.6 4.6 6 8 6 11a6 6 0 0 1-12 0c0-3 2.4-6.4 6-11Z" fill="#8ec5e8" stroke="#4d8db8" stroke-width="1.3"/><circle cx="9.6" cy="14" r="1.5" fill="#fff" opacity=".8"/></svg>',
    c60: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8.6" fill="#c9b5ea" stroke="#7c64b3" stroke-width="1.3"/><path d="M12 7.2 15.5 9.7 14.2 13.8H9.8L8.5 9.7Z" fill="none" stroke="#7c64b3" stroke-width="1.1"/><path d="M12 3.4v3.8M15.5 9.7l3.9-1.2M14.2 13.8l2.4 3.4M9.8 13.8l-2.4 3.4M8.5 9.7 4.6 8.5" stroke="#7c64b3" stroke-width="1.1"/></svg>',
  };
  const HEART = '<svg viewBox="0 0 24 24"><path d="M12 20.5S3.5 15.2 3.5 9.2A4.4 4.4 0 0 1 12 7a4.4 4.4 0 0 1 8.5 2.2c0 6-8.5 11.3-8.5 11.3Z" fill="#e5788f"/></svg>';
  const SPARK = '<svg viewBox="0 0 24 24"><path d="M12 2.5c.7 5 2.5 6.8 7.5 7.5-5 .7-6.8 2.5-7.5 7.5-.7-5-2.5-6.8-7.5-7.5 5-.7 6.8-2.5 7.5-7.5Z" fill="#e2b64f"/></svg>';
  // a morning glory (the company's flower), drawn at (x, y) with size r and a colour class
  const flower = (x, y, r, c, d = 0) => `<g transform="translate(${x} ${y})"><g class="pg-fl ${c}" style="animation-delay:${d}s"><path d="M0 ${r * 0.9}V${r * 3}" class="pg-stem"/><path d="M${-r * 0.2} ${r * 2.2}q${-r} ${-r * 0.2} ${-r * 1.2} ${-r}q${r * 0.9} 0 ${r * 1.2} ${r}" class="pg-leaf"/><circle r="${r}" class="pg-pt"/><path d="M0 ${-r}V${r}M${-r} 0H${r}M${-r * 0.7} ${-r * 0.7}L${r * 0.7} ${r * 0.7}M${-r * 0.7} ${r * 0.7}L${r * 0.7} ${-r * 0.7}" class="pg-vein"/><circle r="${r * 0.3}" class="pg-eye"/></g></g>`;
  const SCENE = '<svg class="pg-bg" viewBox="0 0 360 200" preserveAspectRatio="xMidYMax slice" aria-hidden="true">'
    + '<g class="pg-stars"><circle cx="40" cy="26" r="1.2"/><circle cx="96" cy="14" r=".9"/><circle cx="150" cy="34" r="1.1"/><circle cx="214" cy="18" r=".8"/><circle cx="262" cy="40" r="1"/><circle cx="320" cy="22" r="1.3"/></g>'
    + '<circle class="pg-sun" cx="300" cy="44" r="18"/>'
    + '<path class="pg-hill2" d="M0 132C60 104 120 112 180 126S300 104 360 118V200H0Z"/>'
    + '<path class="pg-hill1" d="M0 160C70 140 140 150 200 158S300 146 360 152V200H0Z"/>'
    + flower(34, 144, 9, 'pg-v') + flower(70, 156, 7, 'pg-b', -2) + flower(286, 146, 8, 'pg-b', -1) + flower(326, 154, 10, 'pg-v', -3) + flower(250, 166, 6, 'pg-w', -1.5)
    + '<path class="pg-grass" d="M110 178l3-10 2 10M124 182l2-8 3 8M232 180l3-9 2 9M150 186l2-7 2 7"/>'
    + '</svg>';

  const css = document.createElement('style');
  css.textContent = `
.pg{position:fixed;inset:0;z-index:90;display:flex;align-items:flex-start;justify-content:center;padding:max(64px,9vh) 16px 16px;background:rgb(10 20 15/.24);font:14px/1.55 var(--font-sans);color:var(--ink);animation:pg-fade .2s ease-out}
.pg[hidden]{display:none}
.pg *{box-sizing:border-box}
.pg-win{position:relative;width:min(380px,100%);max-height:calc(100% - 8px);overflow:auto;border:1px solid var(--line-strong);border-radius:22px;background:var(--surface);box-shadow:0 20px 60px rgb(0 0 0/.3);animation:pg-rise .28s cubic-bezier(.2,.9,.3,1.2)}
.pg-hd{display:flex;align-items:center;gap:8px;padding:14px 14px 10px 18px}
.pg-hd h2{margin:0;flex:1;min-width:0;font:600 17px/1.3 var(--font-serif);overflow-wrap:anywhere}
.pg-lv{flex:none;padding:2px 9px;border-radius:99px;background:var(--gold-soft);color:var(--gold-ink);font-size:12px;font-weight:600;white-space:nowrap}
.pg-x{flex:none;display:grid;place-items:center;width:32px;height:32px;border:0;border-radius:50%;background:none;color:var(--muted);cursor:pointer}
.pg-x:hover{background:var(--surface-2);color:var(--ink)}
.pg-scene{position:relative;height:210px;margin:0 12px;border-radius:16px;overflow:hidden;
  background:linear-gradient(180deg,color-mix(in srgb,var(--info) 26%,var(--surface)) 0%,color-mix(in srgb,var(--gold) 16%,var(--surface)) 72%)}
.pg-bg{position:absolute;inset:0;width:100%;height:100%}
.pg-hill2{fill:color-mix(in srgb,var(--accent-2) 42%,var(--surface))}
.pg-hill1{fill:color-mix(in srgb,var(--accent-2) 64%,var(--surface))}
.pg-grass{fill:none;stroke:color-mix(in srgb,var(--accent) 70%,var(--surface));stroke-width:1.6;stroke-linecap:round;stroke-linejoin:round}
.pg-sun{fill:#f7d67e}
.pg-stars{fill:#fff;opacity:0}
.pg-stem{stroke:color-mix(in srgb,var(--accent) 80%,var(--surface));stroke-width:1.4;fill:none}
.pg-leaf{fill:color-mix(in srgb,var(--accent) 60%,var(--surface))}
.pg-vein{stroke:rgb(255 255 255/.55);stroke-width:.8}
.pg-eye{fill:#f5e6b8}
.pg-v .pg-pt{fill:#a98ad8}.pg-b .pg-pt{fill:#7fb0e2}.pg-w .pg-pt{fill:#f1ece0}.pg-w .pg-vein{stroke:#c9b98f}
.pg-fl{animation:pg-sway 5s ease-in-out infinite;transform-box:fill-box;transform-origin:50% 100%}
:root[data-theme=dark] .pg-scene{background:linear-gradient(180deg,#0f1c2b 0%,#1a2b2a 78%)}
:root[data-theme=dark] .pg-stars{opacity:.85}
:root[data-theme=dark] .pg-sun{fill:#efe3bf}
@media (prefers-color-scheme:dark){:root:not([data-theme=light]) .pg-scene{background:linear-gradient(180deg,#0f1c2b 0%,#1a2b2a 78%)}:root:not([data-theme=light]) .pg-stars{opacity:.85}:root:not([data-theme=light]) .pg-sun{fill:#efe3bf}}
.pg-scene[data-mood=sleeping]::after{content:"";position:absolute;inset:0;background:rgb(12 22 40/.32);pointer-events:none}
.pg-pet{position:absolute;left:50%;bottom:10px;width:120px;height:120px;margin-left:-60px;padding:0;border:0;background:none;cursor:pointer;z-index:2}
.pg-pet img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 10px 8px rgb(0 0 0/.22));animation:pg-bob 3.2s ease-in-out infinite;display:block}
.pg-scene[data-mood=sleeping] .pg-pet img{animation-duration:5.5s;filter:drop-shadow(0 10px 8px rgb(0 0 0/.22)) saturate(.7)}
.pg-pet[data-anim=hop] img{animation:pg-hop .7s ease-out}
.pg-pet[data-anim=spin] img{animation:pg-spin .9s ease-in-out}
.pg-pet[data-anim=munch] img{animation:pg-munch .6s ease-in-out 2}
.pg-pet[data-anim=shake] img{animation:pg-shake .5s ease-in-out}
.pg-pet:focus-visible{outline:3px solid var(--gold);outline-offset:2px;border-radius:50%}
.pg-say{position:absolute;left:12px;right:12px;top:10px;z-index:3;width:fit-content;max-width:calc(100% - 24px);margin:0 auto;padding:7px 12px;border:1px solid var(--line-strong);border-radius:14px;background:color-mix(in srgb,var(--surface) 92%,transparent);font:500 13.5px/1.55 var(--font-serif);text-align:center;box-shadow:var(--shadow);pointer-events:none}
.pg-say:empty{display:none}
.pg-say.pg-new{animation:pg-pop .28s ease-out}
.pg-zz{position:absolute;left:calc(50% + 36px);bottom:120px;z-index:3;font:600 16px/1 var(--font-serif);color:#cfd9f2;pointer-events:none;animation:pg-zz 2.4s ease-in-out infinite}
.pg-fx{position:absolute;inset:0;z-index:3;pointer-events:none}
.pg-fx span{position:absolute;width:22px;height:22px;animation:pg-float 1.2s ease-out forwards}
.pg-fx span.pg-drop{animation:pg-drop .7s ease-in forwards}
.pg-fx svg{width:100%;height:100%;display:block}
.pg-bars{display:grid;grid-template-columns:auto 1fr;gap:5px 10px;align-items:center;margin:12px 18px 0;font-size:12.5px;color:var(--ink-2)}
.pg-bar{position:relative;height:8px;border-radius:99px;background:var(--surface-3);overflow:hidden}
.pg-bar i{position:absolute;inset:0 auto 0 0;border-radius:99px;background:var(--accent-2);transition:width .4s}
.pg-bar[data-low] i{background:var(--warn)}
.pg-acts{display:grid;grid-template-columns:repeat(4,1fr);gap:7px;margin:14px 14px 0}
.pg-acts button,.pg-snacks button,.pg-adopt button{display:flex;flex-direction:column;align-items:center;gap:3px;padding:9px 4px;border:1px solid var(--line);border-radius:12px;background:var(--surface-2);color:var(--ink);font:600 13px/1.2 var(--font-sans);cursor:pointer;transition:transform .12s,background .12s}
.pg-acts button:hover,.pg-snacks button:hover{background:var(--accent-soft)}
.pg-acts button:active,.pg-snacks button:active{transform:scale(.96)}
.pg-acts button[aria-expanded=true]{background:var(--accent-soft);border-color:var(--accent-2)}
.pg-acts svg{width:20px;height:20px;fill:none;stroke:var(--accent-text);stroke-width:1.7;stroke-linecap:round;stroke-linejoin:round}
.pg-snacks{display:grid;grid-template-columns:repeat(3,1fr);gap:7px;margin:8px 14px 0}
.pg-snacks[hidden]{display:none}
.pg-snacks button{font-weight:500;font-size:12px}
.pg-snacks svg{width:26px;height:26px}
.pg-adopt{display:flex;gap:10px;align-items:center;justify-content:center;flex-wrap:wrap;margin:14px 14px 0}
.pg-adopt button{flex-direction:row;padding:10px 18px;border-color:var(--accent);background:var(--accent);color:var(--accent-ink)}
.pg-adopt button:hover{background:var(--accent-hover)}
.pg-adopt a,.pg-ft a{color:var(--accent-text);font-weight:600}
.pg-msg{min-height:1.55em;margin:9px 18px 0;font-size:12.5px;color:var(--muted);text-align:center}
.pg-ft{margin:4px 18px 16px;font-size:12.5px;text-align:center;color:var(--muted)}
.pg button:focus-visible,.pg a:focus-visible{outline:3px solid var(--gold);outline-offset:2px}
@keyframes pg-fade{from{opacity:0}}
@keyframes pg-rise{from{opacity:0;transform:translateY(-14px) scale(.96)}}
@keyframes pg-pop{from{opacity:0;transform:translateY(6px) scale(.96)}}
@keyframes pg-bob{50%{transform:translateY(-5px)}}
@keyframes pg-hop{40%{transform:translateY(-30px) scale(.97,1.04)}80%{transform:scale(1.05,.94)}}
@keyframes pg-spin{50%{transform:translateY(-18px) rotate(180deg)}100%{transform:rotate(360deg)}}
@keyframes pg-munch{50%{transform:scale(1.05,.93)}}
@keyframes pg-shake{25%{transform:translateX(-8px) rotate(-4deg)}75%{transform:translateX(8px) rotate(4deg)}}
@keyframes pg-sway{50%{transform:rotate(4deg)}}
@keyframes pg-zz{0%{opacity:0;transform:translate(0,6px)}40%{opacity:1}100%{opacity:0;transform:translate(14px,-18px)}}
@keyframes pg-float{from{opacity:1;transform:translateY(0) scale(.6)}to{opacity:0;transform:translateY(-70px) scale(1.1)}}
@keyframes pg-drop{from{opacity:0;transform:translateY(-90px)}30%{opacity:1}to{opacity:0;transform:translateY(0) scale(.5)}}
@media (max-width:599px){.pg{align-items:flex-end;padding:0}.pg-win{width:100%;border-radius:22px 22px 0 0;padding-bottom:env(safe-area-inset-bottom,0px);animation-name:pg-up}}
@keyframes pg-up{from{transform:translateY(40px);opacity:0}}
@media (prefers-reduced-motion:reduce){.pg,.pg-win,.pg-say.pg-new,.pg-pet img,.pg-fl,.pg-zz,.pg-fx span{animation:none!important}.pg-fx{display:none}.pg-bar i{transition:none}}
@media print{.pg{display:none}}`;
  document.head.append(css);

  const ICON = {
    pet: '<svg viewBox="0 0 24 24"><path d="M8 13V6.5a1.5 1.5 0 0 1 3 0V12M11 11V5a1.5 1.5 0 0 1 3 0v6M14 11V6.5a1.5 1.5 0 0 1 3 0V14c0 4-2.5 6.5-6 6.5-2.6 0-4.2-1.4-5.4-3.6L4 13.8a1.4 1.4 0 0 1 2.4-1.4L8 15"/></svg>',
    feed: '<svg viewBox="0 0 24 24"><path d="M12 3.5 19 7.5v9L12 20.5 5 16.5v-9Z"/><circle cx="12" cy="12" r="3.4"/></svg>',
    play: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="8"/><path d="M4.5 9.5c4 1.5 11 1.5 15 0M4.5 14.5c4-1.5 11-1.5 15 0M12 4c-2.5 4-2.5 12 0 16"/></svg>',
    sleep: '<svg viewBox="0 0 24 24"><path d="M19 14.5A7.5 7.5 0 0 1 9.5 5a7.5 7.5 0 1 0 9.5 9.5Z"/></svg>',
    wake: '<svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="3.8"/><path d="M12 3v2M12 19v2M3 12h2M19 12h2M5.6 5.6l1.4 1.4M17 17l1.4 1.4M5.6 18.4 7 17M17 7l1.4-1.4"/></svg>',
  };
  const X = '<svg width="14" height="14" viewBox="0 0 14 14" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" aria-hidden="true"><path d="m3 3 8 8M11 3l-8 8"/></svg>';

  let root = null, saved = null, back = null, tick = 0, sayTimer = 0;
  const $ = (sel) => root.querySelector(sel);
  const view = () => (saved ? C.advance(saved, Date.now()) : null);
  const kindName = (k) => { const x = C.kindOf(k); return x ? L(x.zh, x.en) : L('苞苞', 'Budi'); };

  function say(text, ms = 4200) {
    const p = $('.pg-say');
    p.textContent = text;
    p.classList.remove('pg-new');
    void p.offsetWidth;
    p.classList.add('pg-new');
    clearTimeout(sayTimer);
    if (ms) sayTimer = setTimeout(() => { if (root && !root.hidden) say(lineOf(view()), 0); }, ms);
  }
  const lineOf = (s) => {
    if (!s) return L('我是苞苞，一朵还没开的牵牛花。领养我，就能在这儿一起玩。', 'I’m Budi, a morning glory still in bud. Adopt me and we can play here.');
    const l = C.line(s);
    return en ? l.en : l.zh;
  };
  function anim(name) {
    if (still.matches) return;
    const b = $('.pg-pet');
    b.dataset.anim = '';
    void b.offsetWidth;
    b.dataset.anim = name;
    setTimeout(() => { if (b.dataset.anim === name) b.dataset.anim = ''; }, 1300);
  }
  function fx(svg, n, cls = '') {
    if (still.matches) return;
    const box = $('.pg-fx');
    for (let i = 0; i < n; i++) {
      const s = document.createElement('span');
      if (cls) s.className = cls;
      s.innerHTML = svg;
      s.style.left = `calc(50% + ${Math.round((Math.random() - 0.5) * (cls ? 20 : 110))}px - 11px)`;
      s.style.bottom = cls ? '96px' : `${100 + Math.round(Math.random() * 40)}px`;
      s.style.animationDelay = `${i * 0.12}s`;
      box.append(s);
      setTimeout(() => s.remove(), 1600 + i * 120);
    }
  }

  function paint() {
    const s = view();
    const scene = $('.pg-scene');
    const kind = s ? s.kind : 'budi';
    const name = s ? s.name : kindName('budi');
    const img = $('.pg-pet img');
    const src = new URL(`img/${kind}.webp`, base).href;
    if (img.getAttribute('src') !== src) img.src = src;
    $('#pg-t').textContent = L(`${name}的花园`, `${name}’s garden`);
    const m = s ? C.mood(s) : 'ok';
    scene.dataset.mood = m;
    $('.pg-zz').hidden = m !== 'sleeping';
    $('.pg-pet').setAttribute('aria-label', s ? L(`摸摸${name}（${MOOD[m][0]}）`, `Pat ${name} (${MOOD[m][1]})`) : L('苞苞', 'Budi'));
    const lv = $('.pg-lv');
    lv.hidden = !s;
    $('.pg-bars').hidden = !s;
    $('.pg-acts').hidden = !s;
    $('.pg-adopt').hidden = !!s;
    $('.pg-ft').hidden = !s;
    if (!s) { $('.pg-snacks').hidden = true; return; }
    lv.textContent = `Lv ${C.levelOf(s.xp).level} · ${L(`第 ${C.daysTogether(s, Date.now())} 天`, `day ${C.daysTogether(s, Date.now())}`)}`;
    for (const k of ['full', 'joy', 'energy']) {
      const bar = root.querySelector(`[data-bar=${k}]`), v = Math.round(s[k]);
      bar.firstChild.style.width = `${v}%`;
      bar.toggleAttribute('data-low', v < 30);
      bar.setAttribute('aria-valuenow', String(v));
    }
    const sl = $('[data-act=sleep]');
    sl.dataset.act2 = s.asleep ? 'wake' : 'sleep';
    sl.innerHTML = `${s.asleep ? ICON.wake : ICON.sleep}<span>${s.asleep ? L('叫醒', 'Wake') : L('睡觉', 'Sleep')}</span>`;
  }

  function act(action, arg) {
    if (!saved) return;
    const r = C.act(saved, action, Date.now(), arg);
    saved = r.s;
    write(saved);
    const msg = $('.pg-msg');
    if (!r.ok) {
      msg.textContent = L(C.WHY[r.why][0], C.WHY[r.why][1]);
      anim('shake');
      paint();
      return;
    }
    const name = saved.name;
    if (action === 'pet') { anim('hop'); fx(HEART, 3); say(saved.asleep ? L('（翻了个身，又睡着了）', '(rolls over, still asleep)') : L('嘿嘿，好舒服。', 'Hehe, that feels nice.')); }
    if (action === 'feed') { anim('munch'); fx(SNACK_SVG[r.snack] || SNACK_SVG.benzene, 1, 'pg-drop'); const sn = C.SNACKS.find((x) => x.id === r.snack); say(L(`${sn.zh}，好吃！`, `Mmm, ${sn.en.toLowerCase()}!`)); }
    if (action === 'play') { anim('spin'); fx(SPARK, 4); say(L('再来一次！', 'Again, again!')); }
    if (action === 'sleep') say(L('晚安……', 'Good night…'), 2500);
    if (action === 'wake') { anim('hop'); say(L('早上好！', 'Good morning!')); }
    msg.textContent = r.levelUp ? L(`${name}升到了 ${r.levelUp} 级！去小窝看看新解锁的装扮。`, `${name} reached level ${r.levelUp}! Visit the den for a new outfit.`)
      : r.xp ? L(`亲密度 +${r.xp}`, `Bond +${r.xp}`)
        : action === 'pet' || action === 'play' || action === 'feed' ? L('今天的亲密度攒满了，明天再来。', 'Today’s bond is full. Come back tomorrow.') : '';
    paint();
  }

  function build() {
    root = document.createElement('div');
    root.className = 'pg';
    root.id = 'pet-garden';
    root.hidden = true;
    root.setAttribute('translate', 'no');
    const bar = (k, zh, e) => `<span>${L(zh, e)}</span><span class="pg-bar" data-bar="${k}" role="meter" aria-label="${L(zh, e)}" aria-valuemin="0" aria-valuemax="100"><i></i></span>`;
    root.innerHTML = `<div class="pg-win" role="dialog" aria-modal="true" aria-labelledby="pg-t">
  <div class="pg-hd"><h2 id="pg-t"></h2><span class="pg-lv"></span><button type="button" class="pg-x" aria-label="${L('关闭花园', 'Close the garden')}">${X}</button></div>
  <div class="pg-scene">${SCENE}<p class="pg-say" aria-live="polite"></p><span class="pg-zz" aria-hidden="true">z Z</span><button type="button" class="pg-pet"><img alt="" width="120" height="120"></button><div class="pg-fx" aria-hidden="true"></div></div>
  <div class="pg-bars">${bar('full', '饱腹', 'Full')}${bar('joy', '心情', 'Mood')}${bar('energy', '精力', 'Energy')}</div>
  <div class="pg-acts">
    <button type="button" data-act="pet">${ICON.pet}<span>${L('摸摸', 'Pat')}</span></button>
    <button type="button" data-act="feed" aria-expanded="false" aria-controls="pg-snacks">${ICON.feed}<span>${L('喂食', 'Feed')}</span></button>
    <button type="button" data-act="play">${ICON.play}<span>${L('玩耍', 'Play')}</span></button>
    <button type="button" data-act="sleep"></button>
  </div>
  <div class="pg-snacks" id="pg-snacks" hidden>${C.SNACKS.map((s) => `<button type="button" data-snack="${s.id}">${SNACK_SVG[s.id]}<span>${L(s.zh, s.en)}</span></button>`).join('')}</div>
  <div class="pg-adopt"><button type="button" data-adopt>${L('领养苞苞', 'Adopt Budi')}</button><a href="${esc(new URL('index.html', base).href)}">${L('先去小窝挑一只', 'Choose another in the den')}</a></div>
  <p class="pg-msg" role="status"></p>
  <p class="pg-ft"><a href="${esc(new URL('index.html', base).href)}">${L('去小窝：改名、换装、看 3D 的它', 'Visit the den: rename, dress up, see it in 3D')}</a></p>
</div>`;
    document.body.append(root);
    const snacks = $('.pg-snacks'), feedBtn = $('[data-act=feed]');
    root.addEventListener('click', (e) => {
      if (e.target === root) { close(); return; }
      const b = e.target.closest('button');
      if (!b) return;
      if (b.classList.contains('pg-x')) close();
      else if (b.classList.contains('pg-pet')) { if (saved) act('pet'); else { anim('hop'); say(lineOf(null)); } }
      else if (b.hasAttribute('data-adopt')) {
        saved = C.fresh('budi', '', Date.now());
        write(saved);
        paint();
        anim('hop');
        fx(HEART, 4);
        say(L('从今天起，我就是你的苞苞啦！', 'From today on, I’m your Budi!'));
        $('[data-act=pet]').focus();
      } else if (b.dataset.act === 'feed') {
        snacks.hidden = !snacks.hidden;
        feedBtn.setAttribute('aria-expanded', String(!snacks.hidden));
        if (!snacks.hidden) snacks.querySelector('button').focus();
      } else if (b.dataset.snack) {
        act('feed', b.dataset.snack);
        snacks.hidden = true;
        feedBtn.setAttribute('aria-expanded', 'false');
        feedBtn.focus();
      } else if (b.dataset.act === 'sleep') act(b.dataset.act2 || 'sleep');
      else if (b.dataset.act) act(b.dataset.act);
    });
    root.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') { e.stopPropagation(); if (!snacks.hidden) { snacks.hidden = true; feedBtn.setAttribute('aria-expanded', 'false'); feedBtn.focus(); } else close(); return; }
      if (e.key !== 'Tab') return;
      // keep the focus inside the window while it is open
      const f = [...root.querySelectorAll('button,a[href]')].filter((x) => x.offsetParent);
      if (!f.length) return;
      if (e.shiftKey && document.activeElement === f[0]) { e.preventDefault(); f[f.length - 1].focus(); }
      else if (!e.shiftKey && document.activeElement === f[f.length - 1]) { e.preventDefault(); f[0].focus(); }
    });
    addEventListener('storage', (e) => { if (e.key === C.KEY && root && !root.hidden && e.newValue !== JSON.stringify(saved)) { saved = read(); paint(); } });
  }

  function open(from) {
    if (!root) build();
    back = from || document.activeElement;
    saved = read();
    root.hidden = false;
    $('.pg-msg').textContent = '';
    $('.pg-snacks').hidden = true;
    paint();
    say(saved ? L(`${saved.name}${MOOD[C.mood(view())][0]}。${lineOf(view())}`, `${saved.name} ${MOOD[C.mood(view())][1]}. ${lineOf(view())}`) : lineOf(null), 6000);
    (saved ? $('[data-act=pet]') : $('[data-adopt]')).focus({ preventScroll: true });
    clearInterval(tick);
    tick = setInterval(() => { if (!root.hidden) paint(); }, 30e3);
  }
  function close() {
    if (!root || root.hidden) return;
    root.hidden = true;
    clearInterval(tick);
    clearTimeout(sayTimer);
    if (back && document.contains(back)) back.focus({ preventScroll: true });
  }

  window.MolAstriaPetGarden = { open, close, isOpen: () => !!root && !root.hidden };
})();
