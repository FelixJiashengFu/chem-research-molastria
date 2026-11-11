/* 首页的“讨论室”入口：首屏的小入口（#chat-pill）和统计条下面的卡片（#chat-card）。
   文字和七个主题房间写在 index.html 里，不用等网络；这里从账号服务读一次 /chat/summary，填上在线人数和最近三条发言。
   讨论室关着（或者账号服务还没有它）时两处都收起；只是读不到（断网）时保持原样。首页不开 WebSocket。
   发言是别人写的：只用 textContent，不拼 HTML。 */
(() => {
  'use strict';
  const card = document.getElementById('chat-card'), pill = document.getElementById('chat-pill');
  const api = String(window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');
  if (!card) return;
  const en = document.documentElement.lang === 'en';
  const $ = (id) => document.getElementById(id);
  const el = (tag, cls, text) => {
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text != null) n.textContent = text;
    return n;
  };
  const OFFICIAL = 7;
  // The colours of the circles in the rooms (chat-core.js): white text reads on every one of them.
  const PALETTE = ['#2e6550', '#1f6b73', '#2f5f8a', '#4a5aa8', '#6e5aa8', '#86509a', '#9c4a6b', '#a5402d', '#8a5a14', '#62681f', '#48683a', '#566470'];
  const colour = (s) => {
    let h = 0x811c9dc5;
    for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 0x01000193) >>> 0; }
    return PALETTE[h % PALETTE.length];
  };
  const MIN = 60000, HOUR = 60 * MIN, DAY = 24 * HOUR;
  function ago(ms) {
    const gap = Date.now() - ms;
    if (!(gap >= MIN)) return en ? 'just now' : '刚刚';
    if (gap < HOUR) return en ? `${Math.floor(gap / MIN)} min ago` : `${Math.floor(gap / MIN)} 分钟前`;
    if (gap < DAY) return en ? `${Math.floor(gap / HOUR)} h ago` : `${Math.floor(gap / HOUR)} 小时前`;
    if (gap < 7 * DAY) return en ? `${Math.floor(gap / DAY)} d ago` : `${Math.floor(gap / DAY)} 天前`;
    return new Date(ms).toLocaleDateString(en ? 'en-GB' : 'zh-CN', { month: 'short', day: 'numeric' });
  }
  const roomHref = (id) => (/^[a-z0-9-]{1,40}$/.test(String(id)) ? `chat/index.html#r-${id}` : 'chat/index.html');

  function bubble(m) {
    const name = m.name ? String(m.name) : en ? 'Former member' : '已离开的用户';
    const a = el('a', 'cc-msg');
    a.href = roomHref(m.room);
    const av = el('span', 'cc-av', m.name ? Array.from(name.trim())[0].toUpperCase() : '·');
    av.setAttribute('aria-hidden', 'true');
    av.style.setProperty('--av', colour(m.name || ''));
    const meta = el('span', 'cc-meta');
    meta.append(el('b', '', name), el('span', '', `${(en && m.title_en) || m.title || ''} · ${ago(Number(m.t) || 0)}`));
    const body = el('span', 'cc-body');
    // one or two lines of plain text: code fences and line breaks would only waste them
    body.append(meta, el('span', 'cc-say', String(m.text).replace(/```\w*/g, ' ').replace(/\s+/g, ' ').trim()));
    a.append(av, body);
    return a;
  }

  function paint(d) {
    const n = Math.max(0, Math.floor(Number(d.online) || 0));
    if (n > 0) { // never "0 online": an empty room invites nobody
      const online = $('cc-online');
      online.textContent = en ? `${n} online now` : `现在 ${n} 人在线`;
      online.hidden = false;
      const text = $('chat-pill-text');
      if (text) { text.setAttribute('translate', 'no'); text.textContent = en ? `Discussion rooms: ${n} online now` : `讨论室现在 ${n} 人在线，进来聊聊`; }
    }
    const latest = (Array.isArray(d.latest) ? d.latest : []).filter((m) => m && typeof m.text === 'string' && m.text.trim()).slice(0, 3).reverse();
    if (latest.length) {
      const feed = $('cc-feed'), label = $('cc-label');
      feed.setAttribute('translate', 'no');
      feed.replaceChildren(...latest.map(bubble));
      label.textContent = en ? 'LATEST MESSAGES' : '最新发言';
      label.hidden = false;
    }
    const more = Math.floor(Number(d.rooms) || 0) - OFFICIAL;
    if (more > 0) {
      const li = el('li'), a = el('a', '', en ? `+${more} opened by members` : `另有 ${more} 个自建房间`);
      a.href = 'chat/index.html';
      a.setAttribute('translate', 'no');
      li.append(a);
      $('cc-rooms').append(li);
    }
  }
  const close = () => { card.hidden = true; if (pill) pill.hidden = true; };

  // The messages rise one after another the first time the card is on screen.
  if ('IntersectionObserver' in window && !matchMedia('(prefers-reduced-motion: reduce)').matches) {
    card.classList.add('cc-wait');
    const seen = new IntersectionObserver((entries) => {
      if (!entries.some((e) => e.isIntersecting)) return;
      card.classList.replace('cc-wait', 'cc-rise');
      seen.disconnect();
    }, { threshold: 0.25 });
    seen.observe(card);
  }

  if (!api) return;
  fetch(`${api}/chat/summary`)
    .then(async (r) => ({ status: r.status, d: await r.json().catch(() => null) })) // always read the body, or the request stays pending
    .then(({ status, d }) => {
      if (status === 404 || status === 503 || (d && d.state === 'off')) close();
      else if (status === 200 && d) paint(d);
    })
    .catch(() => {});
})();
