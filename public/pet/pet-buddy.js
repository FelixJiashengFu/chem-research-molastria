/* 小伙伴：领养了宠物的人在网站其他页面的右下角看到它（静态图，轻轻上下浮动，不载 three.js）。
   shared-nav.js 只在有 molastria-pet、没关掉（molastria-pet-buddy ≠ off）、这个会话没收起时才载入本文件。
   点它冒一个气泡：它现在的样子和一句话，可以去小窝看看，也可以“今天先收起”（sessionStorage）。
   饿了、困了或寂寞时头顶有个小圆点。文字自带中英两版，translate="no"。 */
(() => {
  'use strict';
  const C = window.MolAstriaPetCore;
  if (!C || document.getElementById('pb-buddy')) return;
  const script = document.currentScript;
  const base = new URL('.', script?.src || location.href); // …/pet/
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const read = () => { try { return C.parse(localStorage.getItem(C.KEY)); } catch { return null; } };
  let saved = read();
  if (!saved) return;
  const HIDE = 'molastria-pet-buddy-hide';
  const MOOD = { sleeping: ['在睡觉', 'is asleep'], hungry: ['饿了', 'is hungry'], tired: ['困了', 'is sleepy'], sad: ['想你了', 'misses you'], happy: ['很开心', 'is happy'], ok: ['在陪着你', 'is keeping you company'] };

  const css = document.createElement('style');
  css.textContent = `
.pb{position:fixed;right:16px;bottom:calc(14px + env(safe-area-inset-bottom,0px));z-index:54;font:13.5px/1.5 var(--font-sans);display:flex;flex-direction:column;align-items:flex-end;gap:8px;pointer-events:none}
.pb>*{pointer-events:auto}
.pb-pet{position:relative;width:64px;height:64px;padding:0;border:0;background:none;cursor:pointer;animation:pb-in .5s ease-out .8s both}
.pb-pet img{width:100%;height:100%;object-fit:contain;filter:drop-shadow(0 6px 8px rgb(0 0 0/.22));animation:pb-bob 3.4s ease-in-out infinite;display:block}
.pb-pet[data-mood=sleeping] img{animation-duration:5.5s;filter:drop-shadow(0 6px 8px rgb(0 0 0/.22)) saturate(.7)}
.pb-pet[data-alert=true]::after{content:"";position:absolute;top:2px;right:6px;width:11px;height:11px;border-radius:50%;background:var(--warn,#d98a2b);box-shadow:0 0 0 2px var(--surface,#fff)}
.pb-pet:hover img{transform:translateY(-3px) rotate(-4deg)}
.pb-pet:focus-visible{outline:3px solid var(--gold);outline-offset:2px;border-radius:12px}
.pb-bub{width:min(270px,calc(100vw - 32px));padding:12px 14px;border:1px solid var(--line-strong);border-radius:14px 14px 4px 14px;background:var(--surface);color:var(--ink);box-shadow:var(--shadow,0 8px 24px rgb(0 0 0/.15))}
.pb-bub b{font-family:var(--font-serif)}
.pb-bub p{margin:0 0 4px}
.pb-bub .pb-line{font-family:var(--font-serif);color:var(--ink-2)}
.pb-row{display:flex;gap:12px;align-items:center;margin-top:8px}
.pb-row a{font-weight:600;color:var(--accent-text)}
.pb-row button{border:0;background:none;padding:0;font:inherit;font-size:12.5px;color:var(--muted);cursor:pointer;text-decoration:underline;text-underline-offset:3px}
@keyframes pb-bob{50%{transform:translateY(-4px)}}
@keyframes pb-in{from{opacity:0;transform:translateY(20px) scale(.6)}}
@media (max-width:599px){.pb{display:none}}
@media print{.pb{display:none}}
@media (prefers-reduced-motion:reduce){.pb-pet,.pb-pet img{animation:none}}`;
  document.head.append(css);

  const box = document.createElement('div');
  box.className = 'pb';
  box.id = 'pb-buddy';
  box.setAttribute('translate', 'no');
  box.innerHTML = `<div class="pb-bub" id="pb-bub" role="status" hidden></div><button type="button" class="pb-pet" id="pb-pet" aria-expanded="false" aria-controls="pb-bub"><img alt="" width="64" height="64"></button>`;
  document.body.append(box);
  const btn = box.querySelector('#pb-pet'), bub = box.querySelector('#pb-bub'), img = btn.querySelector('img');
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));

  function paint() {
    const s = C.advance(saved, Date.now()), m = C.mood(s);
    img.src = new URL(`img/${s.kind}.webp`, base).href;
    btn.dataset.mood = m;
    btn.dataset.alert = String(m === 'hungry' || m === 'tired' || m === 'sad');
    btn.setAttribute('aria-label', L(`你的宠物 ${s.name}${MOOD[m][0]}，点开看看`, `Your pet ${s.name} ${MOOD[m][1]}. Open`));
    return s;
  }
  function open() {
    const s = paint(), m = C.mood(s), l = C.line(s);
    bub.innerHTML = `<p><b>${esc(s.name)}</b> ${L(MOOD[m][0], MOOD[m][1])}</p><p class="pb-line">“${esc(en ? l.en : l.zh)}”</p>
      <div class="pb-row"><a href="${new URL('index.html', base).href}">${L(m === 'hungry' ? '去喂它' : '去看看它', m === 'hungry' ? 'Feed it' : 'Visit')}</a><button type="button" id="pb-hide">${L('今天先收起', 'Hide for today')}</button></div>`;
    bub.hidden = false;
    btn.setAttribute('aria-expanded', 'true');
    bub.querySelector('#pb-hide').addEventListener('click', () => {
      try { sessionStorage.setItem(HIDE, '1'); } catch { /* ignore */ }
      box.remove();
    });
  }
  const close = () => { bub.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
  btn.addEventListener('click', () => (bub.hidden ? open() : close()));
  document.addEventListener('keydown', (e) => { if (e.key === 'Escape' && !bub.hidden) { close(); btn.focus(); } });
  document.addEventListener('pointerdown', (e) => { if (!bub.hidden && !box.contains(e.target)) close(); });
  addEventListener('storage', (e) => {
    if (e.key === C.KEY) { saved = read(); if (!saved) box.remove(); else paint(); }
    if (e.key === C.BUDDY_KEY && e.newValue === 'off') box.remove();
  });
  paint();
  setInterval(() => { if (box.isConnected) paint(); }, 60e3);
})();
