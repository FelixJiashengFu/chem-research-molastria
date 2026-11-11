'use strict';
// Discussion rooms: the page. The rules, the reducer for server frames, grouping and every sentence for an error
// code are in chat-core.js (pure, tested); this file draws them and owns the WebSocket.
// Fixed wording is written here in both languages (t(中文, English)) inside translate="no" containers, so the page
// does not wait for the site dictionary. What people type (messages, nicknames, room names) only ever reaches the
// DOM through textContent, never innerHTML.
// Server: deploy/chat.js behind the account service, GET /chat/ws. Reading needs no account; posting needs a
// signed-in account and a nickname. Address: #r-<room> opens a room, #mod the owner's panel.
// Saved on this device: localStorage molastria-chat (last room, last-read marks, people I hid); sessionStorage
// molastria-chat-draft (what I was typing, per room).
(() => {
  const C = window.MOLASTRIA_CHAT_CORE;
  const app = document.getElementById('ch-app');
  if (!C || !app) return;
  const root = document.documentElement;
  const en = root.lang === 'en';
  const t = (zh, e) => (en ? e : zh);
  const pl = (n, one, many = `${one}s`) => `${n} ${n === 1 ? one : many}`;
  const $ = (id) => document.getElementById(id);
  const topEl = $('ch-top'), roomsEl = $('ch-rooms'), footEl = $('ch-foot'), meEl = $('ch-me'), pane = $('ch-pane'), layer = $('ch-layer');
  const touch = matchMedia('(hover: none) and (pointer: coarse)').matches;
  const BASE_TITLE = en ? 'Discussion rooms · Chat live with people doing computational chemistry · MolAstria' : document.title;
  const SIGN_IN = '../pro/account.html', RULES = '../pro/terms.html#chat-rules', PRIVACY = '../pro/privacy.html#chat';
  const api = String(window.MOLASTRIA_PAY?.accountApi || '').replace(/\/+$/, '');

  // ── Small DOM helpers ──────────────────────────────────────────────────
  /** h('button', { class, text, onclick, data: {…}, 'aria-label': … }, ...children): strings become text nodes. */
  function h(tag, props, ...kids) {
    const el = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') el.className = v;
      else if (k === 'text') el.textContent = v;
      else if (k === 'data') for (const [d, x] of Object.entries(v)) el.dataset[d] = x;
      else if (k.startsWith('on')) el.addEventListener(k.slice(2), v);
      else el.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) if (kid != null && kid !== false) el.append(kid);
    return el;
  }
  // Line icons, drawn here so the page loads nothing extra. The strings are constants; no visitor text goes through innerHTML.
  const ICONS = {
    reply: '<path d="M9 14 4 9l5-5"/><path d="M4 9h10a6 6 0 0 1 6 6v3"/>',
    more: '<circle cx="5" cy="12" r="1.3" fill="currentColor"/><circle cx="12" cy="12" r="1.3" fill="currentColor"/><circle cx="19" cy="12" r="1.3" fill="currentColor"/>',
    copy: '<rect x="9" y="9" width="11" height="11" rx="2"/><path d="M5 15V6a2 2 0 0 1 2-2h9"/>',
    flag: '<path d="M5 21V4"/><path d="M5 4h12l-2.5 4 2.5 4H5"/>',
    trash: '<path d="M4 7h16"/><path d="M9 7V4h6v3"/><path d="m6 7 1 12a2 2 0 0 0 2 2h6a2 2 0 0 0 2-2l1-12"/><path d="M10 11v6M14 11v6"/>',
    eyeoff: '<path d="m3 3 18 18"/><path d="M10.5 6.2A9 9 0 0 1 12 6c5 0 8.5 4.2 9.5 6a14 14 0 0 1-2.7 3.3"/><path d="M6.6 7.6A14 14 0 0 0 2.5 12c1 1.8 4.5 6 9.5 6a9 9 0 0 0 4-.900"/><path d="M9.9 9.9a3 3 0 0 0 4.2 4.2"/>',
    send: '<path d="M21 3 10.5 13.5"/><path d="m21 3-6.5 18-4-7.5L3 9.5z"/>',
    plus: '<path d="M12 5v14M5 12h14"/>',
    search: '<circle cx="11" cy="11" r="6.5"/><path d="m20 20-4.3-4.3"/>',
    gear: '<path d="M4 7h9M17 7h3M4 17h3M11 17h9"/><circle cx="15" cy="7" r="2"/><circle cx="9" cy="17" r="2"/>',
    lock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 8 0v3"/>',
    unlock: '<rect x="5" y="11" width="14" height="9" rx="2"/><path d="M8 11V8a4 4 0 0 1 7.6-1.7"/>',
    x: '<path d="m6 6 12 12M18 6 6 18"/>',
    shield: '<path d="M12 3 5 6v6c0 4.4 3 7.6 7 9 4-1.4 7-4.6 7-9V6z"/><path d="m9 12 2 2 4-4"/>',
    clock: '<circle cx="12" cy="12" r="8.5"/><path d="M12 7.5V12l3 2"/>',
    ban: '<circle cx="12" cy="12" r="8.5"/><path d="m6 6 12 12"/>',
    edit: '<path d="M4 20h4L19 9l-4-4L4 16z"/><path d="m13.5 6.5 4 4"/>',
    link: '<path d="M10 14a4 4 0 0 0 5.7 0l3-3a4 4 0 0 0-5.7-5.7l-1 1"/><path d="M14 10a4 4 0 0 0-5.7 0l-3 3a4 4 0 0 0 5.7 5.7l1-1"/>',
    refresh: '<path d="M20 11a8 8 0 0 0-14.6-4"/><path d="M4 4v4h4"/><path d="M4 13a8 8 0 0 0 14.6 4"/><path d="M20 20v-4h-4"/>',
    check: '<path d="m5 12.5 4.5 4.5L19 7.5"/>',
    bubbles: '<path d="M4 5h11a2 2 0 0 1 2 2v5a2 2 0 0 1-2 2H9l-4 3v-3H4a2 2 0 0 1-2-2V7a2 2 0 0 1 2-2z"/><path d="M19.5 10H20a2 2 0 0 1 2 2v4a2 2 0 0 1-2 2v2.5L17 18h-4"/>',
    // official rooms
    lobby: '<path d="M4 5h16v11H10l-4 3.5V16H4z"/><path d="M8 9h8M8 12h5"/>',
    qc: '<circle cx="12" cy="12" r="1.5" fill="currentColor"/><ellipse cx="12" cy="12" rx="9" ry="3.6"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(60 12 12)"/><ellipse cx="12" cy="12" rx="9" ry="3.6" transform="rotate(120 12 12)"/>',
    mlip: '<circle cx="5" cy="7" r="2"/><circle cx="5" cy="17" r="2"/><circle cx="12" cy="12" r="2"/><circle cx="19" cy="7" r="2"/><circle cx="19" cy="17" r="2"/><path d="m6.7 8.2 3.6 2.6M6.7 15.8l3.6-2.6M13.7 10.8l3.6-2.6M13.7 13.2l3.6 2.6"/>',
    software: '<rect x="3" y="4.5" width="18" height="15" rx="2.5"/><path d="m7 10 3 2.5L7 15M12.5 15H17"/>',
    papers: '<path d="M7 3h7l4 4v14H7z"/><path d="M14 3v4h4M10 12h5M10 16h5"/>',
    study: '<path d="M12 6.5C10 5 7 4.5 4 5v13c3-.500 6 0 8 1.5 2-1.5 5-2 8-1.5V5c-3-.500-6 0-8 1.5z"/><path d="M12 6.5V19.5"/>',
    site: '<path d="M4 10v4l3 .500V9.5z"/><path d="M7 9.5 18 5v14L7 14.5"/><path d="M8.5 15v3.5h3V16"/>',
    hash: '<path d="M9 4 7 20M17 4l-2 16M4.5 9h16M3.5 15h16"/>'
  };
  function icon(name, size = 16) {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    for (const [k, v] of Object.entries({ viewBox: '0 0 24 24', width: size, height: size, fill: 'none', stroke: 'currentColor', 'stroke-width': 1.8, 'stroke-linecap': 'round', 'stroke-linejoin': 'round', 'aria-hidden': 'true' })) svg.setAttribute(k, v);
    svg.innerHTML = Object.prototype.hasOwnProperty.call(ICONS, name) ? ICONS[name] : ICONS.hash; // name can be a room id
    return svg;
  }
  /** The site's own arrow (shared-nav.css): '' is up-right for links that leave, or right / left / down. */
  const arrow = (dir) => h('i', { class: `ico-ext${dir ? ` ico-${dir}` : ''}`, 'aria-hidden': 'true' });
  const avatar = (uid, name, small) => h('span', { class: `ch-av${small ? ' small' : ''}${name ? '' : ' ghost'}`, style: name ? `--av:${C.avatarColor(uid)}` : null, 'aria-hidden': 'true', text: C.initial(name) });
  const ownerBadge = () => h('span', { class: 'ch-owner', text: t('站长', 'Owner') });
  const nameOf = (name) => name || t('已离开的用户', 'Former member');

  // ── What is saved on this device ───────────────────────────────────────
  const store = {
    get(k) { try { return localStorage.getItem(k); } catch { return null; } },
    set(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
  };
  let prefs = C.migratePrefs(store.get(C.PREFS_KEY));
  const savePrefs = () => store.set(C.PREFS_KEY, JSON.stringify(prefs));
  // Keyed by room id, so a table without a prototype: a room called "constructor" must find no draft, not a function.
  const drafts = (() => { try { const d = JSON.parse(sessionStorage.getItem(C.DRAFT_KEY) || '{}'); return Object.assign(C.table(), d && typeof d === 'object' && !Array.isArray(d) ? d : null); } catch { return C.table(); } })();
  const saveDrafts = () => { try { sessionStorage.setItem(C.DRAFT_KEY, JSON.stringify(drafts)); } catch {} };
  const token = () => { try { return window.MolAstriaAccount?.token?.() || localStorage.getItem('molastria-session') || ''; } catch { return ''; } };

  // ── State ──────────────────────────────────────────────────────────────
  const S = C.createState();
  const V = {
    conn: api ? 'idle' : 'none', // idle | connecting | open | retry | offline | off | missing | full | asleep | none (no account service here)
    retryAt: 0, attempt: 0, asleep: false, full: false,
    screen: 'list',  // phones show one of the two columns: 'list' or 'pane'
    pane: 'room',    // what the right column holds: 'room' or 'mod'
    filter: '', replyTo: null, atBottom: true, newCount: 0, newFrom: 0, opening: false,
    gotoRoom: ''     // a room I just opened that the room list has not delivered yet
  };
  const now = () => Date.now() + S.skew;   // the server's clock, for anything compared with server times
  const cur = () => (S.cur ? C.roomById(S, S.cur) : null);
  const isWide = () => getComputedStyle(app).getPropertyValue('--wide').trim() === '1';
  const isAdmin = () => !!S.me && S.me.role === 'admin';
  const title = (r) => C.roomTitle(r, en);
  const errText = (ev) => C.errorText(ev && ev.code, { en, wait: ev && ev.wait, until: ev && ev.until, now: now(), limits: S.limits });

  // ── The right column, built once ───────────────────────────────────────
  const headEl = h('header', { class: 'ch-head' });
  const bannerEl = h('p', { class: 'ch-banner', hidden: true });
  const logEl = h('div', { class: 'ch-log', role: 'log', 'aria-live': 'polite', 'aria-relevant': 'additions', tabindex: '0', 'aria-label': t('消息', 'Messages') });
  const pillEl = h('button', { class: 'ch-pill', type: 'button', hidden: true, onclick: () => { toBottom(true); logEl.focus({ preventScroll: true }); } });
  const toastEl = h('div', { class: 'ch-toast', role: 'status', 'aria-live': 'polite' });
  const modEl = h('div', { class: 'ch-mod', hidden: true });
  const composeEl = h('div', { class: 'ch-compose' });
  const bodyEl = h('div', { class: 'ch-body' }, logEl, pillEl, toastEl);
  pane.append(headEl, bannerEl, bodyEl, modEl, composeEl);
  pane.setAttribute('aria-label', t('当前房间', 'Current room'));
  roomsEl.setAttribute('aria-label', t('房间', 'Rooms'));

  let toastTimer = 0;
  function toast(text, bad) {
    clearTimeout(toastTimer);
    toastEl.textContent = text;
    toastEl.toggleAttribute('data-bad', !!bad);
    toastEl.dataset.show = '';
    toastTimer = setTimeout(() => { delete toastEl.dataset.show; }, bad ? 6000 : 3500);
  }
  const fail = (ev) => toast(errText(ev), true);

  // ── Dialogs ────────────────────────────────────────────────────────────
  let dlgSeq = 0;
  /**
   * A modal <dialog>: the browser traps focus, closes on Esc and gives focus back to what opened it.
   * o: { title, body: Node[], actions: Node[], wide, onSubmit }. Returns { dlg, close }.
   */
  function dialog(o) {
    const opener = document.activeElement;
    const id = `ch-dlg-${++dlgSeq}`;
    const dlg = h('dialog', { class: `ch-dlg${o.wide ? ' wide' : ''}`, 'aria-labelledby': id });
    const form = h('form', { method: 'dialog', novalidate: true, onsubmit: (e) => { e.preventDefault(); if (o.onSubmit) o.onSubmit(); } },
      h('div', { class: 'ch-dlg-h' }, h('h2', { id, text: o.title }), h('button', { type: 'button', class: 'ch-icon', 'aria-label': t('关闭', 'Close'), onclick: () => dlg.close() }, icon('x', 18))),
      h('div', { class: 'ch-dlg-b' }, o.body),
      o.actions && o.actions.length ? h('div', { class: 'ch-dlg-f' }, o.actions) : null);
    dlg.append(form);
    dlg.addEventListener('close', () => { dlg.remove(); if (o.onClose) o.onClose(); if (opener && opener.isConnected && document.activeElement === document.body) opener.focus(); });
    layer.append(dlg);
    dlg.showModal();
    return { dlg, close: () => { if (dlg.open) dlg.close(); } };
  }
  const cancelBtn = (d, label) => h('button', { type: 'button', class: 'ch-btn', text: label || t('取消', 'Cancel'), onclick: () => d().close() });
  /** Ask before something that cannot be undone. Resolves true only when the person presses the action. Focus starts on Cancel. */
  function confirmDialog(o) {
    return new Promise((resolve) => {
      let yes = false, d = null;
      const stay = h('button', { type: 'button', class: 'ch-btn', autofocus: true, text: t('取消', 'Cancel'), onclick: () => d.close() });
      const go = h('button', { type: 'button', class: `ch-btn ${o.danger ? 'danger solid' : 'primary'}`, text: o.ok, onclick: () => { yes = true; d.close(); } });
      d = dialog({ title: o.title, body: [].concat(o.text).map((p) => h('p', { text: p })).concat(o.extra || []), actions: [stay, go], onClose: () => resolve(yes) });
    });
  }
  let menuDlg = null;
  /**
   * A menu. On a wide window with a mouse it opens beside its button; on phones and touch screens it is a sheet
   * from the bottom edge. Either way it is a modal <dialog>, so Esc closes it and focus returns.
   * items: [{ icon, label, run, danger } | '-'].
   */
  function openMenu(anchor, items, o = {}) {
    if (menuDlg && menuDlg.open) menuDlg.close();
    const dlg = h('dialog', { class: 'ch-menu', 'aria-label': o.label || t('操作', 'Actions') });
    if (o.who) dlg.append(h('p', { class: 'ch-menu-who', text: o.who }));
    for (const it of items) dlg.append(it === '-' ? h('hr') : h('button', { type: 'button', class: it.danger ? 'danger' : null, onclick: () => { dlg.close(); it.run(); } }, icon(it.icon, 16), it.label));
    const sheet = touch || !isWide();
    if (sheet) dlg.dataset.sheet = '';
    const acts = anchor && anchor.closest('.ch-acts');
    if (acts) acts.dataset.open = '';
    dlg.addEventListener('close', () => { dlg.remove(); if (acts) delete acts.dataset.open; if (anchor && anchor.isConnected && document.activeElement === document.body) anchor.focus(); });
    dlg.addEventListener('click', (e) => {
      const r = dlg.getBoundingClientRect();
      if (e.target === dlg && (e.clientX < r.left || e.clientX > r.right || e.clientY < r.top || e.clientY > r.bottom)) dlg.close();
    });
    dlg.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const list = [...dlg.querySelectorAll('button')], i = list.indexOf(document.activeElement);
      e.preventDefault();
      list[(i + (e.key === 'ArrowDown' ? 1 : list.length - 1)) % list.length].focus();
    });
    layer.append(dlg);
    menuDlg = dlg;
    dlg.showModal();
    if (!sheet && anchor) {
      // Rectangles are in window pixels, style lengths in the page's zoomed pixels: k converts between them.
      const r = dlg.getBoundingClientRect(), a = anchor.getBoundingClientRect(), k = dlg.offsetWidth ? r.width / dlg.offsetWidth || 1 : 1;
      const left = Math.min(Math.max(8, a.right - r.width), innerWidth - r.width - 8);
      const top = a.bottom + 6 + r.height > innerHeight - 8 ? Math.max(8, a.top - r.height - 6) : a.bottom + 6;
      dlg.style.left = `${left / k}px`;
      dlg.style.top = `${top / k}px`;
    }
  }

  // ── Connection ─────────────────────────────────────────────────────────
  let ws = null, wsToken = '', opened = false, retryTimer = 0, tickTimer = 0, sleepTimer = 0, lastFrame = 0, helloAt = 0;
  let lastUid = prefs.uid; // the account the drafts in this tab were typed under
  function setConn(c) {
    V.conn = c;
    clearInterval(tickTimer);
    if (c === 'retry' || c === 'full') tickTimer = setInterval(renderStatus, 1000);
    renderStatus();
    renderPlaceholder();
    updateSend();
  }
  function send(frame) {
    if (!ws || ws.readyState !== 1 || !S.ready) return false;
    try { ws.send(JSON.stringify(frame)); return true; } catch { return false; }
  }
  /** A request the server answers with ok or err. Rejects with { code } (also 'lost' and 'timeout'). */
  function call(frame) {
    return new Promise((resolve, reject) => {
      const f = C.ask(S, frame, { resolve, reject });
      const drop = (code) => { const i = S.waiting.findIndex((w) => w.cid === f.cid); if (i >= 0) { S.waiting.splice(i, 1); reject({ code }); } };
      if (!send(f)) drop('lost'); else setTimeout(() => drop('timeout'), 12000);
    });
  }
  function connect() {
    clearTimeout(retryTimer);
    if (!api || ws) return;
    if (navigator.onLine === false) { setConn('offline'); return; }
    setConn('connecting');
    wsToken = token();
    let sock;
    try { sock = new WebSocket(C.wsUrl(api), C.wsProtocols(wsToken)); }
    catch {
      // A token that is not a legal subprotocol cannot be sent at all; reading still works without it.
      try { sock = new WebSocket(C.wsUrl(api), C.wsProtocols('')); } catch { retryLater(C.backoff(V.attempt++)); return; }
    }
    ws = sock; opened = false;
    sock.onopen = () => { if (ws === sock) { opened = true; lastFrame = Date.now(); } };
    sock.onmessage = (e) => {
      if (ws !== sock) return;
      lastFrame = Date.now();
      if (typeof e.data !== 'string' || e.data === 'pong') return;
      let f;
      try { f = JSON.parse(e.data); } catch { return; }
      onFrame(f);
    };
    sock.onclose = (e) => { if (ws === sock) { ws = null; onClosed(e.code, opened); } };
    sock.onerror = () => {}; // a close event always follows and carries the reason
  }
  /** Let go of the socket without waiting for the closing handshake (a dead network would hold it for a minute). */
  function dropSocket(code) {
    const sock = ws;
    if (!sock) return;
    ws = null;
    sock.onclose = null;
    try { sock.close(1000, 'bye'); } catch {}
    onClosed(code, true);
  }
  function retryLater(ms, state = 'retry') {
    clearTimeout(retryTimer);
    V.retryAt = Date.now() + ms;
    retryTimer = setTimeout(connect, ms);
    setConn(state);
  }
  function onClosed(code, wasOpen) {
    const hadHello = S.ready;
    // Only a connection that stayed up (about 30 s) starts the backoff over; one that drops right after its hello keeps backing off.
    if (hadHello) V.attempt = C.settle(V.attempt, Date.now() - helloAt);
    for (const w of C.dropConnection(S)) w.ctx.reject({ code: 'lost' });
    renderPending();
    renderComposer();
    if (V.asleep) { setConn('asleep'); return; }
    const why = C.closeCode(code);
    if (why === 'full' || V.full) { V.full = false; retryLater(Math.max(15000, C.backoff(V.attempt++)), 'full'); return; }
    if (why === 'kicked') { toast(errText({ code: 'kicked' }), true); retryLater(10000 + C.backoff(V.attempt++)); return; }
    if (why === 'toobig') toast(errText({ code: 'toobig' }), true);
    if (!wasOpen || !hadHello) { probe(); return; } // it never got as far as a hello: find out why before trying again
    retryLater(C.backoff(V.attempt++));
  }
  /**
   * A WebSocket that fails to open tells the page nothing (no status code). The public summary does: 404 means the
   * account service has no chat yet, state "off" that the owner closed it; anything else is a passing failure.
   */
  async function probe() {
    let status = 0, body = null;
    setConn('connecting');
    try {
      const r = await fetch(`${api}/chat/summary`);
      status = r.status;
      body = await r.json().catch(() => null); // always read the body, or the request stays pending
    } catch { status = 0; }
    if (ws || V.asleep) return;
    if (status === 404) retryLater(5 * 60000, 'missing');
    else if (status === 503 || (status === 200 && body && body.state === 'off')) retryLater(5 * 60000, 'off');
    else if (status === 0 && navigator.onLine === false) setConn('offline');
    else retryLater(C.backoff(V.attempt++));
  }
  function reconnectNow() {
    V.attempt = 0; V.asleep = false;
    clearTimeout(retryTimer);
    if (ws) dropSocket(1000);
    clearTimeout(retryTimer);
    connect();
  }
  // Keep-alive: the platform answers the literal text "ping" with "pong" without waking the server. Only while the
  // page is visible; a tab hidden for three minutes lets go of its socket and reconnects when it is looked at again.
  setInterval(() => {
    if (!ws || ws.readyState !== 1 || document.visibilityState !== 'visible') return;
    if (Date.now() - lastFrame > 125000) { dropSocket(1006); return; } // two pings unanswered: the line is dead
    try { ws.send('ping'); } catch {}
  }, 50000);
  document.addEventListener('visibilitychange', () => {
    clearTimeout(sleepTimer);
    if (document.visibilityState === 'hidden') {
      sleepTimer = setTimeout(() => {
        if (document.visibilityState !== 'hidden') return;
        V.asleep = true;
        clearTimeout(retryTimer);
        if (ws) dropSocket(1000); else setConn('asleep');
      }, 180000);
      return;
    }
    if (V.asleep) reconnectNow();
    else if (ws && ws.readyState === 1) { try { ws.send('ping'); } catch {} }
    seen();
  });
  addEventListener('online', () => { if (!ws && !V.asleep) reconnectNow(); });
  addEventListener('offline', () => { if (!ws) { clearTimeout(retryTimer); setConn('offline'); } });
  // Signing in or out (here or in another tab) changes who the socket speaks for.
  const tokenChanged = () => { if (api && token() !== wsToken && !V.asleep) reconnectNow(); };
  document.addEventListener('molastria:account', tokenChanged);
  addEventListener('storage', (e) => {
    if (e.key === 'molastria-session' || e.key === null) tokenChanged();
    if (e.key === C.PREFS_KEY) { prefs = C.migratePrefs(e.newValue); scheduleRooms(); updateTitle(); }
  });

  // ── Frames ─────────────────────────────────────────────────────────────
  function onFrame(f) {
    const ev = C.reduce(S, f);
    if (!ev) return;
    switch (ev.t) {
      case 'hello': onHello(ev); break;
      case 'room': onRoom(ev); break;
      case 'older': if (ev.room === S.cur) renderLog('anchor'); break;
      case 'msg': onMsg(ev); break;
      case 'act': seen(); break;
      case 'upd': onUpd(ev); break;
      case 'rooms': onRooms(ev); break;
      case 'pres': if (ev.room === S.cur) renderHere(); scheduleRooms(); renderStatus(); break;
      case 'who': showWho(); break; // only the answer to askWho gets this far
      case 'me': onMe(ev); break;
      case 'reports': scheduleRooms(); if (V.pane === 'mod') send({ t: 'mod', op: 'list' }); break;
      case 'mod': renderMod(); break;
      case 'ok': if (ev.req) ev.req.ctx.resolve(ev); break;
      case 'err': onErr(ev); break;
      default: break;
    }
  }
  function onHello(ev) {
    helloAt = Date.now();
    // Hidden people and drafts belong to the account that made them, not to the device.
    const uid = S.me ? S.me.uid : '', acct = C.switchAccount(prefs, uid);
    if (acct) savePrefs();
    if (acct === 'switched' || (uid && lastUid && uid !== lastUid)) {
      for (const k of Object.keys(drafts)) delete drafts[k];
      saveDrafts();
      if (ta) ta.value = '';
      V.replyTo = null;
    }
    if (uid) lastUid = uid;
    if (C.syncRead(prefs, S.rooms)) savePrefs();
    setConn('open');
    renderRooms(); renderMe(); renderFoot(); updateTitle();
    if (ev.gone) { S.cur = ''; toast(errText({ code: 'no-room' }), true); }
    if (S.cur) {
      renderHead(); renderLog('keep'); renderComposer(true);
      send(C.rejoin(S));
    }
    route();
  }
  function onRoom(ev) {
    if (ev.room !== S.cur) return;
    const room = cur(), log = S.logs[ev.room];
    if (V.opening && room) {
      const n = C.unread(prefs, room);
      V.newFrom = C.firstUnread(log.msgs, prefs.read[room.id], n, S.me && S.me.uid);
      V.newCount = V.newFrom ? log.msgs.filter((m) => m.id >= V.newFrom).length : 0;
    }
    // After a reconnect the list is replaced by the newest messages. A reader who was further up stays with the
    // message they were looking at when it is still there, otherwise goes to the top of what is held now.
    const top = V.opening || V.atBottom ? null : [...logEl.querySelectorAll('.ch-msg[data-id]')].find((el) => el.offsetTop + el.offsetHeight > logEl.scrollTop);
    const anchor = top ? { id: top.id, off: top.offsetTop - logEl.scrollTop } : null;
    renderLog(V.opening ? 'open' : 'keep');
    if (anchor) { const el = $(anchor.id); logEl.scrollTop = el ? el.offsetTop - anchor.off : 0; V.atBottom = nearBottom(); }
    V.opening = false;
    renderHere(); renderPill(); seen();
  }
  function onMsg(ev) {
    if (ev.room === S.cur && V.pane === 'room') {
      const stick = ev.mine || looking();
      if (ev.sent) renderPending();
      if (ev.isNew) {
        appendMsg(ev.m);
        if (stick) toBottom();
        else if (prefs.hide[ev.m.uid] === undefined) {
          // The first message that arrives while the reader is away gets the "new" line above it.
          if (++V.newCount === 1) { V.newFrom = ev.m.id; renderLog('keep'); }
          renderPill();
        }
      } else replaceMsg(ev.m.id);
    }
    seen();
  }
  function onUpd(ev) {
    if (ev.room !== S.cur) return;
    if (ev.found) replaceMsg(ev.m.id);
    for (const id of ev.quotes) replaceMsg(id);
  }
  function onRooms(ev) {
    if (C.syncRead(prefs, S.rooms)) savePrefs();
    if (ev.gone) {
      S.cur = '';
      toast(t('这个房间被移除了。', 'This room was removed.'));
      history.replaceState(null, '', location.pathname + location.search);
      route();
    } else if (S.cur) { renderHead(); renderComposer(); }
    if (V.gotoRoom && C.roomById(S, V.gotoRoom)) { const id = V.gotoRoom; V.gotoRoom = ''; openRoom(id, { push: !isWide() }); }
    renderRooms(); renderMe(); updateTitle();
  }
  function onMe(ev) {
    renderMe(); renderComposer(true);
    if (ev.wiped && S.cur) reload();
    else if (S.cur) renderLog('keep'); // which actions each message offers depends on who I am
  }
  function onErr(ev) {
    if (ev.lost) { saidNo(ev); return; }
    if (ev.req) { ev.req.ctx.reject(ev); return; }
    if (ev.re === 'connect') { V.full = ev.code === 'full'; return; }
    if (ev.re === 'join' && ev.code === 'no-room') {
      S.cur = '';
      history.replaceState(null, '', location.pathname + location.search);
      fail(ev); route();
      return;
    }
    if (ev.re === 'more') renderLog('keep'); // the reducer cleared the loading state: the button reads "Load earlier" again
    fail(ev);
  }
  /** Ask the server for the current room again and replace what is on screen (after messages were removed in bulk). */
  function reload() {
    const log = S.logs[S.cur];
    if (log) log.stale = true;
    send(C.rejoin(S));
  }

  // ── Where we are: the address, the two columns ─────────────────────────
  const defaultRoom = () => (C.roomById(S, prefs.room) || C.roomById(S, 'lobby') || S.rooms.find((r) => r.kind === 'official') || S.rooms[0] || { id: '' }).id;
  function setScreen(s) {
    V.screen = s;
    app.dataset.view = s;
  }
  function setHash(hash, push) {
    if (location.hash === hash) return;
    if (push) history.pushState({ chFromList: true }, '', hash); else history.replaceState(history.state, '', hash || location.pathname + location.search);
  }
  /** Bring the page in line with the address. Runs at load, after every hello and when the address changes. */
  function route() {
    const want = C.parseHash(location.hash);
    if (want.mod) {
      if (S.known && !isAdmin()) {
        toast(t('管理面板只有站长能打开。', 'Only the site owner can open the moderation panel.'), true);
        history.replaceState(null, '', location.pathname + location.search);
      } else { showMod(); return; }
    } else if (want.room) {
      if (S.known && !C.roomById(S, want.room)) {
        toast(errText({ code: 'no-room' }), true);
        history.replaceState(null, '', location.pathname + location.search);
      } else {
        if (S.cur !== want.room || V.pane !== 'room' || V.screen !== 'pane') openRoom(want.room, { keepHash: true });
        return;
      }
    }
    // No address: a wide window always has a room open, a phone starts from the list.
    if (isWide()) {
      if (V.pane === 'mod') V.pane = 'room';
      const id = S.cur || (S.known ? defaultRoom() : '');
      if (id) openRoom(id, {}); else { setScreen('list'); renderPane(); }
    } else { if (V.pane === 'mod') V.pane = 'room'; setScreen('list'); renderPane(); scheduleRooms(); }
    updateTitle();
  }
  function openRoom(id, o = {}) {
    stashDraft();
    const same = S.cur === id && V.pane === 'room';
    const frame = C.enter(S, id);
    if (prefs.room !== id) { prefs.room = id; savePrefs(); }
    V.pane = 'room';
    if (!same) { V.replyTo = null; V.newCount = 0; V.newFrom = 0; V.opening = true; V.atBottom = true; }
    if (!o.keepHash) setHash(C.roomHash(id), o.push);
    setScreen('pane');
    renderPane();
    renderRooms();
    if (!same || !(S.logs[id] && S.logs[id].loaded)) send(frame);
    if (o.focus && !touch) { const ta = composeEl.querySelector('textarea'); if (ta) ta.focus(); }
    seen();
  }
  function showList() {
    stashDraft();
    setScreen('list');
    scheduleRooms(); updateTitle();
  }
  function showMod() {
    stashDraft();
    V.pane = 'mod';
    setScreen('pane');
    renderPane(); renderRooms();
    send({ t: 'mod', op: 'list' });
  }
  /** The back button of a phone: to the room list. If the list is the previous history entry, go back to it. */
  function goBack() {
    if (history.state && history.state.chFromList) history.back();
    else { history.replaceState(null, '', location.pathname + location.search); showList(); const a = roomsEl.querySelector('[aria-current=true]') || roomsEl.querySelector('a'); if (a) a.focus(); }
  }
  addEventListener('popstate', route);
  addEventListener('hashchange', route);

  // ── Room list ──────────────────────────────────────────────────────────
  let statusEl = null;
  function renderTop() {
    statusEl = h('p', { class: 'ch-status', role: 'status', 'aria-live': 'polite' });
    const input = h('input', { type: 'search', id: 'ch-filter', autocomplete: 'off', spellcheck: 'false', placeholder: t('找一个房间', 'Find a room'), 'aria-label': t('按名字或简介找房间', 'Filter rooms by name or topic'),
      oninput: (e) => { V.filter = e.target.value; renderRooms(); } });
    topEl.replaceChildren(
      h('p', { class: 'ch-eyebrow', text: 'MOLASTRIA · ROOMS' }),
      h('h1', { class: 'ch-h1' }, t('讨论室', 'Discussion rooms'), en ? null : h('span', { lang: 'en', text: 'Discussion rooms' })),
      statusEl,
      h('label', { class: 'ch-filter' }, icon('search', 15), input));
    renderStatus();
  }
  function renderStatus() {
    if (!statusEl) return;
    const left = Math.max(1, Math.ceil((V.retryAt - Date.now()) / 1000));
    const retry = () => h('button', { type: 'button', class: 'ch-link', text: t('现在重连', 'Reconnect now'), onclick: reconnectNow });
    const kids = [h('span', { class: 'ch-dot', 'aria-hidden': 'true' })];
    switch (V.conn) {
      case 'open': kids.push(h('span', { text: t(`${S.online} 人在线`, `${S.online} online`) })); if (S.mode === 'readonly') kids.push(h('span', { class: 'ch-tag gold', text: t('只读', 'Read-only') })); break;
      case 'connecting': case 'idle': kids.push(h('span', { text: t('正在连接…', 'Connecting…') })); break;
      case 'retry': kids.push(h('span', { text: t(`连接断了，${left} 秒后重连`, `Disconnected. Reconnecting in ${left} s`) }), retry()); break;
      case 'full': kids.push(h('span', { text: t(`讨论室人满了，${left} 秒后再试`, `The rooms are full. Trying again in ${left} s`) })); break;
      case 'offline': kids.push(h('span', { text: t('网络断开了，恢复后会自动重连', 'You are offline. The page reconnects when the network is back') })); break;
      case 'off': kids.push(h('span', { text: t('讨论室暂时关闭', 'The rooms are closed for now') }), retry()); break;
      case 'missing': kids.push(h('span', { text: t('讨论室还没开张', 'The rooms are not open yet') }), retry()); break;
      case 'asleep': kids.push(h('span', { text: t('已暂停，回到这一页时重连', 'Paused. Reconnects when you come back') })); break;
      default: kids.push(h('span', { text: t('这里用不了讨论室', 'The rooms are not available here') })); break;
    }
    // The countdown changes every second; only the state is worth announcing.
    statusEl.setAttribute('aria-live', V.conn === 'retry' || V.conn === 'full' ? 'off' : 'polite');
    statusEl.dataset.s = V.conn;
    const had = statusEl.contains(document.activeElement);
    statusEl.replaceChildren(...kids);
    if (had) { const b = statusEl.querySelector('button'); if (b) b.focus(); }
  }
  let roomsFrame = 0;
  /** Several frames can change the list in one tick (a message, a presence change); draw it once per frame. */
  function scheduleRooms() {
    if (roomsFrame) return;
    roomsFrame = requestAnimationFrame(() => { roomsFrame = 0; renderRooms(); });
  }
  function roomRow(r) {
    const n = C.unread(prefs, r), here = r.id === S.cur && V.pane === 'room', name = title(r);
    const topic = C.roomTopic(r, en) || (r.kind === 'official' ? '' : r.owner_name ? t(`${r.owner_name} 开的房间`, `Opened by ${r.owner_name}`) : t('大家开的房间', 'Community room'));
    const label = [name, r.closed ? t('已关闭', 'closed') : '', r.online ? t(`${r.online} 人在线`, `${r.online} online`) : '', n ? t(`${n} 条未读`, pl(n, 'unread message')) : ''].filter(Boolean).join(en ? ', ' : '，');
    const a = h('a', { class: 'ch-room', href: C.roomHash(r.id), 'aria-label': label, 'aria-current': here ? 'true' : null, data: { room: r.id, kind: r.kind },
      onclick: (e) => { if (e.metaKey || e.ctrlKey || e.shiftKey || e.button) return; e.preventDefault(); openRoom(r.id, { push: !isWide(), focus: true }); } },
      h('span', { class: 'ch-glyph', 'aria-hidden': 'true', style: r.kind === 'official' ? null : `--av:${C.avatarColor(r.owner || r.id)}` }, r.closed ? icon('lock', 17) : r.kind === 'official' ? icon(ICONS[r.id] ? r.id : 'hash', 19) : C.initial(name)),
      h('span', { class: 'ch-room-l1' }, h('span', { class: 'ch-room-t', text: name }), r.n > 0 && r.last ? h('span', { class: 'ch-room-time', text: C.relTime(r.last, now(), en) }) : null),
      h('span', { class: 'ch-room-l2' }, h('span', { class: 'ch-room-s', text: r.closed ? t('已关闭，只能阅读', 'Closed, read-only') : topic }),
        r.online > 0 ? h('span', { class: 'ch-room-on', text: String(r.online) }) : null, n > 0 && !(here && looking()) ? h('span', { class: 'ch-badge', text: n > 99 ? '99+' : String(n) }) : null));
    if (n > 0 && !(here && looking())) a.dataset.unread = '';
    if (r.closed) a.dataset.closed = '';
    return h('li', null, a);
  }
  // A redraw between mouse down and mouse up replaces the row under the pointer, and the browser then sends no click.
  // While a pointer is down on the list the redraw waits for it to lift.
  let roomsHeld = false, roomsDue = false;
  const roomsRelease = () => {
    if (!roomsHeld) return;
    roomsHeld = false;
    if (roomsDue) { roomsDue = false; scheduleRooms(); } // next frame, after the click this release may still produce
  };
  roomsEl.addEventListener('pointerdown', () => { roomsHeld = true; });
  for (const type of ['pointerup', 'pointercancel']) addEventListener(type, roomsRelease, true);
  addEventListener('blur', (e) => { if (e.target === window) roomsRelease(); }); // the button was let go outside the window
  function renderRooms() {
    if (roomsHeld) { roomsDue = true; return; }
    const active = document.activeElement, focusRoom = active && roomsEl.contains(active) ? active.dataset.room || active.id : '';
    const kids = [];
    if (isAdmin()) {
      const here = V.pane === 'mod';
      kids.push(h('ul', { class: 'ch-list' }, h('li', null, h('a', { class: 'ch-room mod', href: '#mod', id: 'ch-mod-link', 'aria-current': here ? 'true' : null,
        onclick: (e) => { e.preventDefault(); setHash('#mod', !isWide()); showMod(); } },
        h('span', { class: 'ch-glyph', 'aria-hidden': 'true' }, icon('shield', 19)),
        h('span', { class: 'ch-room-l1' }, h('span', { class: 'ch-room-t', text: t('管理面板', 'Moderation') })),
        h('span', { class: 'ch-room-l2' }, h('span', { class: 'ch-room-s', text: S.reports ? t(`${S.reports} 条举报待处理`, `${pl(S.reports, 'report')} waiting`) : t('没有待处理的举报', 'No open reports') }),
          S.reports ? h('span', { class: 'ch-badge', text: String(S.reports) }) : null)))));
    }
    if (!S.rooms.length) {
      const why = { none: t('这个版本没有配置账号服务，讨论室在 molastria.com 上可以用。', 'No account service is configured in this copy. The rooms work on molastria.com.'),
        missing: t('账号服务还没有更新到带讨论室的版本，稍后再来。', 'The account service has not been updated with the rooms yet. Check back soon.'),
        off: t('站长暂时关闭了讨论室。', 'The owner has closed the rooms for now.'),
        offline: t('网络断开了。', 'You are offline.') }[V.conn] || t('正在载入房间…', 'Loading rooms…');
      kids.push(h('p', { class: 'ch-none', text: why }));
    } else {
      const { official, community } = C.sortRooms(S.rooms);
      const off = C.filterRooms(official, V.filter), com = C.filterRooms(community, V.filter);
      const mine = S.me ? S.me.rooms : 0;
      if (off.length || !V.filter) kids.push(h('div', { class: 'ch-sec' }, h('h2', { id: 'ch-sec-off', text: t('官方房间', 'Official rooms') })), h('ul', { class: 'ch-list', 'aria-labelledby': 'ch-sec-off' }, off.map(roomRow)));
      kids.push(h('div', { class: 'ch-sec' }, h('h2', { id: 'ch-sec-com', text: t('大家开的房间', 'Community rooms') }),
        h('button', { type: 'button', class: 'ch-new-room', id: 'ch-new-room', title: S.me ? t(`你开了 ${mine} / ${S.limits.rooms} 个`, `You have opened ${mine} of ${S.limits.rooms}`) : null, onclick: askRoom }, icon('plus', 14), t('开一个房间', 'Open a room'))));
      if (com.length) kids.push(h('ul', { class: 'ch-list', 'aria-labelledby': 'ch-sec-com' }, com.map(roomRow)));
      else kids.push(h('p', { class: 'ch-none', text: V.filter ? (off.length ? t('大家开的房间里没有匹配的。', 'No community room matches.') : t('没有匹配的房间。', 'No room matches.')) : t('还没有人开房间。想聊一个具体的题目，就开一个。', 'Nobody has opened a room yet. Have a specific topic in mind? Open one.') }));
    }
    roomsEl.replaceChildren(...kids);
    if (focusRoom) { const el = roomsEl.querySelector(`[data-room="${CSS.escape(focusRoom)}"]`) || (focusRoom.startsWith('ch-') ? $(focusRoom) : null); if (el) el.focus({ preventScroll: true }); }
  }
  function renderFoot() {
    footEl.replaceChildren(
      h('a', { href: RULES }, t('社区守则', 'Community rules'), arrow()),
      h('a', { href: PRIVACY }, t('隐私说明', 'Privacy'), arrow()));
  }
  function renderMe() {
    const gear = h('button', { type: 'button', class: 'ch-icon', id: 'ch-settings', 'aria-label': t('我的设置', 'My settings'), title: t('我的设置', 'My settings'), onclick: showSettings }, icon('gear', 18));
    let kids;
    if (S.me && S.me.name) {
      kids = [avatar(S.me.uid, S.me.name), h('span', { class: 'ch-me-t' }, h('b', { text: S.me.name }), h('span', { text: isAdmin() ? t('站长', 'Site owner') : S.me.banned ? t('已被禁止发言', 'Banned from posting') : S.me.muted > now() ? t('禁言中', 'Muted') : t('已登录，可以发言', 'Signed in') })), gear];
    } else if (S.me) {
      kids = [avatar('', null), h('span', { class: 'ch-me-t' }, h('b', { text: t('还没有昵称', 'No nickname yet') }), h('span', { text: t('取一个就能发言', 'Pick one to start posting') })),
        h('button', { type: 'button', class: 'ch-btn small', id: 'ch-name-btn', text: t('取昵称', 'Pick one'), onclick: () => askName() }), gear];
    } else {
      const expired = S.auth === 'expired';
      kids = [avatar('', null), h('span', { class: 'ch-me-t' }, h('b', { text: expired ? t('登录已过期', 'Sign-in expired') : t('游客', 'Guest') }), h('span', { text: expired ? t('重新登录后可以发言', 'Sign in again to post') : t('可以看，登录后发言', 'Reading only. Sign in to post') })),
        api ? h('a', { class: 'ch-btn small', href: SIGN_IN }, expired ? t('重新登录', 'Sign in again') : t('登录', 'Sign in')) : null, gear];
    }
    meEl.replaceChildren(...kids);
  }

  // ── The open room: header ──────────────────────────────────────────────
  let hereEl = null;
  function renderHere() {
    const room = cur();
    if (!hereEl || !room) return;
    hereEl.replaceChildren(String(room.online), h('span', { text: t(' 人在线', ' online') }));
    hereEl.setAttribute('aria-label', t(`${room.online} 人在线，看看都有谁`, `${room.online} online. See who is here`));
  }
  function renderHead() {
    const back = h('button', { type: 'button', class: 'ch-back', id: 'ch-back', onclick: goBack }, arrow('left'), t('房间', 'Rooms'));
    if (V.pane === 'mod') {
      headEl.replaceChildren(back, h('div', { class: 'ch-head-t' }, h('h2', null, h('span', { text: t('管理面板', 'Moderation') })), h('p', { class: 'ch-topic', text: t('举报、禁言和封禁，只有站长看得到。', 'Reports, mutes and bans. Only the site owner sees this.') })),
        h('button', { type: 'button', class: 'ch-icon', 'aria-label': t('刷新', 'Refresh'), title: t('刷新', 'Refresh'), onclick: () => { if (!send({ t: 'mod', op: 'list' })) fail({ code: 'lost' }); } }, icon('refresh', 18)));
      hereEl = null;
      return;
    }
    const room = cur();
    if (!room) {
      headEl.replaceChildren(back, h('div', { class: 'ch-head-t' }, h('h2', null, h('span', { text: t('讨论室', 'Discussion rooms') }))));
      hereEl = null;
      return;
    }
    const topic = C.roomTopic(room, en);
    hereEl = h('button', { type: 'button', class: 'ch-here', id: 'ch-here', onclick: () => { if (!send(C.askWho(S, room.id))) { S.whoAsk = ''; fail({ code: 'lost' }); } } });
    headEl.replaceChildren(back,
      h('div', { class: 'ch-head-t' },
        h('h2', null, h('span', { text: title(room) }), room.closed ? h('span', { class: 'ch-tag' }, icon('lock', 11), t('已关闭', 'Closed')) : null),
        topic ? h('button', { type: 'button', class: 'ch-topic', title: topic, 'aria-expanded': 'false', text: topic, onclick: (e) => e.currentTarget.setAttribute('aria-expanded', e.currentTarget.getAttribute('aria-expanded') === 'true' ? 'false' : 'true') }) : null),
      hereEl,
      h('button', { type: 'button', class: 'ch-icon', id: 'ch-room-menu', 'aria-label': t('这个房间的操作', 'Room actions'), 'aria-haspopup': 'menu', title: t('更多', 'More'), onclick: (e) => roomMenu(e.currentTarget) }, icon('more', 18)));
    renderHere();
  }
  function roomMenu(anchor) {
    const room = cur();
    if (!room) return;
    const rights = C.roomRights(S, room);
    const items = [{ icon: 'link', label: t('复制房间链接', 'Copy room link'), run: () => copy(location.origin + location.pathname + C.roomHash(room.id), t('链接已复制。', 'Link copied.')) }];
    if (rights.edit) items.push('-', { icon: 'edit', label: t('改名字和简介', 'Edit name and topic'), run: () => editRoom(room) });
    if (rights.close) items.push({ icon: 'lock', label: t('关闭房间', 'Close room'), run: () => closeRoom(room, true) });
    if (rights.reopen) items.push({ icon: 'unlock', label: t('重新开放', 'Reopen room'), run: () => closeRoom(room, false) });
    if (rights.remove) items.push('-', { icon: 'trash', label: t('移除房间和里面的消息', 'Remove room and its messages'), danger: true, run: () => removeRoom(room) });
    openMenu(anchor, items, { label: t('这个房间的操作', 'Room actions'), who: title(room) });
  }

  // ── The open room: messages ────────────────────────────────────────────
  const nearBottom = () => logEl.scrollHeight - logEl.scrollTop - logEl.clientHeight < 80;
  function toBottom(pill) {
    logEl.scrollTop = logEl.scrollHeight;
    V.atBottom = true;
    if (pill) { V.newCount = 0; renderPill(); }
    seen();
  }
  /** Is the reader looking at the newest message of the open room right now? */
  const looking = () => V.pane === 'room' && !!S.cur && (isWide() || V.screen === 'pane') && document.visibilityState === 'visible' && V.atBottom;
  /** Record what has been read, then refresh every place that shows an unread count. */
  function seen() {
    const room = cur(), log = room && S.logs[room.id];
    if (room && log && log.loaded && looking()) {
      if (C.markRead(prefs, room, log.msgs.length ? log.msgs[log.msgs.length - 1].id : 0)) savePrefs();
      if (V.newCount) { V.newCount = 0; renderPill(); }
    }
    updateTitle();
    scheduleRooms();
  }
  const updateTitle = () => { const s = C.pageTitle(BASE_TITLE, C.totalUnread(prefs, S.rooms) - (cur() && looking() ? C.unread(prefs, cur()) : 0)); if (document.title !== s) document.title = s; };
  function renderPill() {
    pillEl.hidden = !V.newCount || V.pane !== 'room';
    if (!pillEl.hidden) pillEl.replaceChildren(t(`${V.newCount} 条新消息`, pl(V.newCount, 'new message')), arrow('down'));
  }
  logEl.addEventListener('scroll', () => {
    const was = V.atBottom;
    V.atBottom = nearBottom();
    if (V.atBottom && !was) seen();
    if (logEl.scrollTop < 140) loadOlder();
  }, { passive: true });
  function loadOlder() {
    const f = C.older(S, S.cur);
    if (!f) return;
    if (!send(f)) { S.logs[S.cur].older = false; return; }
    const b = $('ch-older');
    if (b) { b.disabled = true; b.textContent = t('正在加载…', 'Loading…'); }
  }

  /** Message text → nodes. Tokens come from chat-core; every piece is a text node or an element with textContent. */
  function fill(el, text) {
    for (const k of C.tokenize(text)) {
      if (k.t === 'link') el.append(h('a', { href: k.href, target: '_blank', rel: 'noopener noreferrer nofollow ugc', text: k.s }));
      else if (k.t === 'code') el.append(h('code', { text: k.s }));
      else if (k.t === 'pre') el.append(h('pre', null, h('code', { text: k.s })));
      else el.append(k.s);
    }
    return el;
  }
  function textEl(m) {
    if (m.del) return h('div', { class: 'ch-text', text: m.del === 2 ? t('这条消息已被站长删除', 'This message was removed by the owner') : t('这条消息已删除', 'This message was deleted') });
    if (m.hidden) return h('div', { class: 'ch-text', text: t('被多人举报，等待站长处理', 'Hidden after several reports, awaiting the owner') });
    return fill(h('div', { class: 'ch-text' }), m.text);
  }
  function quoteEl(reply, inert) {
    const who = nameOf(reply.name), gone = !reply.text;
    return h(inert ? 'div' : 'button', { class: 'ch-quote', type: inert ? null : 'button', 'aria-label': inert ? null : t(`回复 ${who} 的消息，跳到原文`, `In reply to ${who}. Jump to the original`), onclick: inert ? null : () => jumpTo(reply.id) },
      h('b', { text: who }), h('span', { text: gone ? t('原消息已经不在了', 'The original is gone') : reply.text }));
  }
  function jumpTo(id) {
    const el = $(`m-${id}`);
    if (!el) { toast(t('原消息在更早的地方，往上加载就能看到。', 'The original is further up. Load earlier messages to see it.')); return; }
    el.scrollIntoView({ block: 'center' });
    el.classList.remove('flash');
    void el.offsetWidth; // restart the highlight if it is still running
    el.classList.add('flash');
  }
  function msgRow(m, head) {
    const mine = !!S.me && m.uid === S.me.uid, gone = !!(m.del || m.hidden), who = nameOf(m.name);
    const el = h('article', { class: `ch-msg${head ? ' head' : ''}${mine ? ' mine' : ''}${gone ? ' gone' : ''}`, id: `m-${m.id}`, data: { id: m.id, uid: m.uid } });
    const when = h('time', { datetime: new Date(m.t).toISOString(), title: C.fullTime(m.t), text: C.clock(m.t) });
    if (head) {
      el.append(avatar(m.uid, m.name), h('header', { class: 'ch-msg-h' },
        h('b', { class: 'ch-name', style: m.name ? `--av:${C.avatarColor(m.uid)}` : null, text: who }), mine ? h('span', { class: 'cr-sr', text: t('（我）', ' (you)') }) : null, m.role === 'admin' ? ownerBadge() : null, when));
    } else {
      // No visible header on a follow-up line, but a screen reader still needs to hear who is speaking.
      when.className = 'ch-gutter';
      el.append(when, h('span', { class: 'cr-sr', text: `${who}${t('：', ': ')}` }));
    }
    if (m.reply) el.append(quoteEl(m.reply));
    el.append(textEl(m));
    const acts = C.actionsFor(S, m, cur(), now());
    if (acts.length) {
      el.append(h('div', { class: 'ch-acts' },
        acts.includes('reply') ? h('button', { type: 'button', class: 'ch-act-reply', 'aria-label': t(`回复 ${who}`, `Reply to ${who}`), title: t('回复', 'Reply'), onclick: () => startReply(m.id) }, icon('reply', 15)) : null,
        h('button', { type: 'button', class: 'ch-act-more', 'aria-label': t(`${who} 这条消息的操作`, `Actions for this message by ${who}`), 'aria-haspopup': 'menu', title: t('更多', 'More'), onclick: (e) => msgMenu(m.id, e.currentTarget) }, icon('more', 16))));
    }
    return el;
  }
  const dayRow = (ms) => h('div', { class: 'ch-day', role: 'separator', text: C.dayLabel(ms, Date.now(), en) });
  function rowEl(r) {
    if (r.k === 'day') return dayRow(r.t);
    if (r.k === 'new') return h('div', { class: 'ch-newline', role: 'separator', text: t('以下是新消息', 'New messages') });
    if (r.k === 'hid') return h('p', { class: 'ch-hid', text: t(`你屏蔽的人发了 ${r.n} 条消息`, `${pl(r.n, 'message')} from people you hid`) });
    return msgRow(r.m, r.head);
  }
  let pendEl = null;
  /**
   * Draw the whole list. mode: 'open' (a room was just opened: go to the "new" line, or the end), 'anchor' (earlier
   * messages were added on top: keep what is in view where it is), 'keep' (stay put, or stay at the end).
   * aria-busy for the duration keeps a screen reader from reading the history out as if it had just arrived.
   */
  function renderLog(mode = 'keep') {
    const room = cur(), log = room && S.logs[room.id];
    const wasBottom = V.atBottom, oldH = logEl.scrollHeight, oldTop = logEl.scrollTop;
    logEl.setAttribute('aria-busy', 'true');
    delete logEl.dataset.empty;
    const mine = room ? S.pending.filter((p) => p.room === room.id) : [];
    pendEl = h('div', { class: 'ch-pend' });
    const kids = [];
    if (!room || !log || !log.loaded) {
      logEl.dataset.empty = '';
      kids.push(placeholder());
    } else if (!log.msgs.length && !mine.length) {
      logEl.dataset.empty = '';
      const can = C.composerState(S, room, now());
      kids.push(h('div', { class: 'ch-empty' }, icon('bubbles', 44), h('h3', { text: t('这里还没有人说话', 'Nobody has said anything here yet') }),
        h('p', { text: can === 'ok' ? t('说第一句吧：一个问题、一篇刚读的论文、一个卡住的报错，都可以。', 'Say the first thing: a question, a paper you just read, an error you are stuck on.') : room.closed ? t('这个房间已经关闭。', 'This room is closed.') : t('登录后就能说第一句。', 'Sign in and say the first thing.') })));
    } else {
      kids.push(log.more
        ? h('div', { class: 'ch-top' }, h('button', { type: 'button', class: 'ch-btn small', id: 'ch-older', disabled: log.older, text: log.older ? t('正在加载…', 'Loading…') : t('加载更早的消息', 'Load earlier messages'), onclick: loadOlder }))
        : h('div', { class: 'ch-top' }, h('span', { class: 'ch-mark', 'aria-hidden': 'true', text: '✦' }), h('h3', { text: title(room) }), h('p', { text: t('这是这个房间的开头。', 'This is the beginning of the room.') })));
      const rows = h('div', { class: 'ch-rows' });
      for (const r of C.groupMessages(log.msgs, { hide: prefs.hide, me: S.me && S.me.uid, newFrom: V.newFrom })) rows.append(rowEl(r));
      kids.push(rows);
    }
    kids.push(pendEl);
    logEl.replaceChildren(...kids);
    renderPending();
    const line = logEl.querySelector('.ch-newline');
    if (mode === 'open') logEl.scrollTop = line && line.offsetTop < logEl.scrollHeight - logEl.clientHeight ? Math.max(0, line.offsetTop - 10) : logEl.scrollHeight;
    else if (mode === 'anchor') logEl.scrollTop = oldTop + (logEl.scrollHeight - oldH);
    else logEl.scrollTop = wasBottom ? logEl.scrollHeight : oldTop;
    V.atBottom = nearBottom();
    requestAnimationFrame(() => logEl.removeAttribute('aria-busy'));
  }
  /** One new message at the end: add its row instead of drawing the list again. */
  function appendMsg(m) {
    const log = S.logs[S.cur], rows = logEl.querySelector('.ch-rows');
    const i = log ? log.msgs.indexOf(m) : -1;
    if (!rows || i !== log.msgs.length - 1 || (prefs.hide[m.uid] !== undefined && !(S.me && m.uid === S.me.uid))) { renderLog('keep'); return; }
    const prev = i > 0 ? log.msgs[i - 1] : null, last = rows.lastElementChild;
    if (!prev || C.dayOf(prev.t) !== C.dayOf(m.t)) rows.append(dayRow(m.t));
    rows.append(msgRow(m, !(prev && last && last.dataset.id === String(prev.id) && C.joins(prev, m))));
    if (V.atBottom && C.trimLog(log)) renderLog('keep'); // a room left open for days: drop the oldest rows
  }
  function replaceMsg(id) {
    const el = $(`m-${id}`), log = S.logs[S.cur], m = log && log.msgs.find((x) => x.id === id);
    if (!el || !m) return;
    const had = el.contains(document.activeElement);
    const next = msgRow(m, el.classList.contains('head'));
    el.replaceWith(next);
    if (had) logEl.focus({ preventScroll: true });
  }
  /** My messages that the server has not confirmed yet, under the list: greyed while sending, with Retry when they failed. */
  function renderPending() {
    if (!pendEl) return;
    const mine = S.cur ? S.pending.filter((p) => p.room === S.cur) : [];
    pendEl.replaceChildren(...mine.map((p) => {
      const el = h('article', { class: `ch-msg head mine pending${p.state === 'failed' ? ' failed' : ''}`, data: { cid: p.cid } },
        avatar(S.me ? S.me.uid : '', S.me && S.me.name), h('header', { class: 'ch-msg-h' }, h('b', { class: 'ch-name', style: S.me ? `--av:${C.avatarColor(S.me.uid)}` : null, text: (S.me && S.me.name) || '' })));
      if (p.reply) el.append(quoteEl(p.reply, true));
      el.append(fill(h('div', { class: 'ch-text' }), p.text));
      el.append(p.state === 'failed'
        ? h('div', { class: 'ch-state', role: 'status' }, h('span', { text: errText({ code: p.code || 'lost' }) }),
          h('button', { type: 'button', class: 'ch-link', text: t('重发', 'Send again'), onclick: () => resend(p.cid) }),
          h('button', { type: 'button', class: 'ch-link', text: t('不发了', 'Discard'), onclick: () => { S.pending = S.pending.filter((x) => x.cid !== p.cid); renderPending(); } }))
        : h('div', { class: 'ch-state', text: t('发送中…', 'Sending…') }));
      return el;
    }));
    if (logEl.dataset.empty !== undefined && mine.length) renderLog('keep');
  }
  function placeholder() {
    const big = (ico, head, text, more) => h('div', { class: 'ch-empty' }, icon(ico, 44), h('h3', { text: head }), h('p', { text }), more || null);
    const again = () => h('button', { type: 'button', class: 'ch-btn', text: t('再试一次', 'Try again'), onclick: reconnectNow });
    switch (V.conn) {
      case 'none': return big('bubbles', t('这里用不了讨论室', 'The rooms are not available here'), t('这个版本没有配置账号服务。讨论室在 molastria.com 上可以用，其他栏目不受影响。', 'This copy has no account service configured. The rooms work on molastria.com; everything else here is unaffected.'));
      case 'missing': return big('bubbles', t('讨论室还没开张', 'The rooms are not open yet'), t('账号服务还没有更新到带讨论室的版本。这不是你的问题，过一会儿再来就好。', 'The account service has not been updated with the rooms yet. Nothing is wrong on your side; check back in a little while.'), again());
      case 'off': return big('lock', t('讨论室暂时关闭', 'The rooms are closed for now'), t('站长暂时关闭了讨论室，过一会儿再来。', 'The owner has closed the rooms for the moment. Come back a little later.'), again());
      case 'offline': return big('bubbles', t('网络断开了', 'You are offline'), t('网络恢复后会自动重连。', 'The page reconnects by itself when the network is back.'));
      case 'full': return big('bubbles', t('讨论室人满了', 'The rooms are full'), errText({ code: 'full' }));
      case 'retry': return big('bubbles', t('连接断了', 'Disconnected'), t('正在重连，稍等一下。', 'Reconnecting. One moment.'), again());
      default: return big('bubbles', t('正在走进讨论室…', 'Walking into the rooms…'), t('马上就好。', 'One moment.'));
    }
  }
  /** While no room is on screen, the right column says why (connecting, closed, not open yet …). */
  function renderPlaceholder() {
    const log = S.cur && S.logs[S.cur];
    if (V.pane === 'room' && !(log && log.loaded)) renderLog('keep');
  }
  function renderPane() {
    const mod = V.pane === 'mod';
    bodyEl.hidden = mod;
    modEl.hidden = !mod;
    renderHead();
    const room = cur();
    const banner = mod || !room ? '' : S.mode === 'readonly' ? errText({ code: 'readonly' }) : '';
    bannerEl.hidden = !banner;
    bannerEl.textContent = banner;
    if (mod) { renderMod(); renderComposer(true); return; }
    renderLog(V.opening ? 'open' : 'keep');
    renderPill();
    renderComposer(true);
  }

  // ── Composer ───────────────────────────────────────────────────────────
  let ta = null, sendBtn = null, errEl = null, countEl = null, composeKey = '', errTimer = 0, muteTimer = 0, lastSay = 0;
  function stashDraft() {
    if (!ta || !ta.dataset.room) return;
    const id = ta.dataset.room;
    if (ta.value.trim()) drafts[id] = ta.value; else delete drafts[id];
    saveDrafts();
  }
  function showError(ev, soft) {
    if (!errEl) return;
    clearTimeout(errTimer);
    errEl.textContent = ev ? (typeof ev === 'string' ? ev : errText(ev)) : '';
    errEl.toggleAttribute('data-soft', !!soft);
    if (ev && !soft) errTimer = setTimeout(() => showError(null), Math.max(8000, ((ev.wait || 0) + 2) * 1000));
    if (!ev) updateSend();
  }
  function autosize() {
    if (!ta) return;
    ta.style.height = 'auto';
    ta.style.height = `${Math.min(ta.scrollHeight + 2, 168)}px`;
  }
  /** The send button and the line under the box follow what is typed and whether the line is up. */
  function updateSend() {
    if (!ta || !sendBtn) return;
    const len = C.count(C.cleanText(ta.value)), max = S.limits.text;
    const near = len >= max - 200;
    countEl.textContent = near ? `${len} / ${max}` : '';
    countEl.toggleAttribute('data-over', len > max);
    sendBtn.disabled = !len || len > max || !S.ready;
    if (!S.ready && S.known && (!errEl.textContent || errEl.hasAttribute('data-soft'))) showError(V.conn === 'offline' ? t('网络断开了，恢复后可以继续发言。', 'You are offline. You can post again when the network is back.') : t('连接断了，正在重连…', 'Disconnected. Reconnecting…'), true);
    else if (S.ready && errEl.hasAttribute('data-soft')) showError(null);
  }
  function renderComposer(force) {
    const room = cur();
    const kind = V.pane !== 'room' || !room ? 'none' : C.composerState(S, room, now());
    const key = `${kind}|${room ? room.id : ''}|${S.me ? `${S.me.uid}${S.me.name || ''}${S.me.muted}` : ''}`;
    if (!force && key === composeKey) { updateSend(); return; }
    // The box is built again below (after every hello, for one). Someone typing in it must not lose their place.
    const held = ta && document.activeElement === ta ? { room: ta.dataset.room, text: ta.value, from: ta.selectionStart, to: ta.selectionEnd } : null;
    stashDraft();
    composeKey = key;
    clearTimeout(muteTimer);
    ta = sendBtn = errEl = countEl = null;
    composeEl.hidden = kind === 'none' || kind === 'wait';
    if (composeEl.hidden) { composeEl.replaceChildren(); return; }
    const note = (b, s, link, label) => h('div', { class: `ch-cta${link ? '' : ' plain'}` }, h('div', null, h('b', { text: b }), h('span', { text: s })),
      link ? h('a', { class: 'ch-btn primary', href: link }, label, arrow('right')) : null);
    if (kind === 'guest') { composeEl.replaceChildren(note(t('登录后就能发言', 'Sign in to join the conversation'), t('免费，用邮箱收一个验证码就能登录，不用设密码。不登录也可以一直看。', 'It is free: sign in with a code sent to your email, no password. You can keep reading without it.'), SIGN_IN, t('登录', 'Sign in'))); return; }
    if (kind === 'expired') { composeEl.replaceChildren(note(t('登录已过期', 'Your sign-in has expired'), t('重新登录后就能继续发言，现在可以照常阅读。', 'Sign in again to keep posting. Reading works as usual.'), SIGN_IN, t('重新登录', 'Sign in again'))); return; }
    if (kind === 'banned') { composeEl.replaceChildren(note(t('不能发言', 'Posting is off'), errText({ code: 'banned' }))); return; }
    if (kind === 'muted') {
      composeEl.replaceChildren(note(t('禁言中', 'Muted'), errText({ code: 'muted', until: S.me.muted })));
      const left = S.me.muted - now();
      if (left < 86400000) muteTimer = setTimeout(() => { renderComposer(true); renderMe(); }, left + 500);
      return;
    }
    if (kind === 'readonly') { composeEl.replaceChildren(note(t('只读', 'Read-only'), errText({ code: 'readonly' }))); return; }
    if (kind === 'closed') { composeEl.replaceChildren(note(t('房间已关闭', 'Room closed'), errText({ code: 'closed' }))); return; }
    ta = h('textarea', { id: 'ch-input', rows: '1', autocomplete: 'off', enterkeyhint: touch ? 'enter' : 'send', 'aria-label': t(`在“${title(room)}”里发言`, `Message ${title(room)}`), 'aria-describedby': 'ch-hint',
      placeholder: S.me.name ? t('说点什么…', 'Write a message…') : t('说点什么…（发第一条前会请你取一个昵称）', 'Write a message… (you will pick a nickname first)'), data: { room: room.id } });
    ta.value = drafts[room.id] || '';
    ta.addEventListener('input', () => { autosize(); updateSend(); if (errEl.textContent && !errEl.hasAttribute('data-soft')) showError(null); });
    ta.addEventListener('blur', stashDraft);
    ta.addEventListener('keydown', (e) => {
      if (e.key === 'Escape' && V.replyTo) { e.preventDefault(); V.replyTo = null; renderReply(); return; }
      // Enter sends with a keyboard; on a touch keyboard it breaks the line and the button sends. An Enter that
      // confirms an input-method candidate (isComposing, or keyCode 229 in older WebKit) is never a send.
      if (e.key !== 'Enter' || e.shiftKey || e.isComposing || e.keyCode === 229) return;
      if (touch && !(e.ctrlKey || e.metaKey)) return;
      e.preventDefault();
      trySend();
    });
    sendBtn = h('button', { type: 'button', class: 'ch-send', id: 'ch-send', 'aria-label': t('发送', 'Send'), onclick: () => { trySend(); if (ta) ta.focus(); } }, icon('send', 17), h('span', { text: t('发送', 'Send') }));
    errEl = h('span', { class: 'ch-err', id: 'ch-err', role: 'status', 'aria-live': 'polite' });
    countEl = h('span', { class: 'ch-count', 'aria-live': 'off' });
    composeEl.replaceChildren(
      h('div', { class: 'ch-replying', id: 'ch-replying', hidden: true }),
      h('div', { class: 'ch-box' }, ta, sendBtn),
      h('div', { class: 'ch-under' }, errEl, h('span', { class: 'ch-hint', id: 'ch-hint', text: t('Enter 发送 · Shift + Enter 换行 · `代码` 和 ``` 代码块会按代码显示', 'Enter to send · Shift + Enter for a new line · `code` and ``` blocks are shown as code') }), countEl));
    if (held && held.room === room.id) {
      ta.value = held.text;
      ta.focus({ preventScroll: true });
      try { ta.setSelectionRange(held.from, held.to); } catch {}
    }
    renderReply(); autosize(); updateSend();
  }
  function renderReply() {
    const bar = $('ch-replying');
    if (!bar) return;
    bar.hidden = !V.replyTo;
    if (V.replyTo) bar.replaceChildren(h('span', null, h('b', { text: t(`回复 ${nameOf(V.replyTo.name)}：`, `Replying to ${nameOf(V.replyTo.name)}: `) }), V.replyTo.text),
      h('button', { type: 'button', class: 'ch-icon', 'aria-label': t('不回复了', 'Cancel reply'), onclick: () => { V.replyTo = null; renderReply(); if (ta) ta.focus(); } }, icon('x', 15)));
  }
  function startReply(id) {
    const log = S.logs[S.cur], m = log && log.msgs.find((x) => x.id === id);
    if (!m || !ta) return;
    V.replyTo = { id: m.id, name: m.name, text: C.clip(m.text, 80) };
    renderReply();
    ta.focus();
  }
  function trySend() {
    const room = cur();
    if (!ta || !room) return;
    const c = C.checkText(ta.value, S.limits);
    if (c.code === 'empty') { ta.value = ''; autosize(); updateSend(); return; }
    if (!c.ok) { showError({ code: c.code }); return; }
    if (!S.ready) { updateSend(); return; }
    if (!S.me.name) { askName(trySend); return; }
    const frame = C.say(S, { room: room.id, text: c.text, reply: V.replyTo });
    dispatch(frame);
    ta.value = '';
    delete drafts[room.id]; saveDrafts();
    V.replyTo = null;
    renderReply(); autosize(); showError(null); updateSend();
    renderPending();
    toBottom(true);
  }
  /**
   * Put a queued message on the wire. The server refuses a second message within 1.5 s of the first; someone who
   * types two short lines quickly should not see an error for that, so the second one simply leaves a moment later.
   */
  function dispatch(frame) {
    const wait = Math.max(0, lastSay + 1600 - Date.now());
    lastSay = Date.now() + wait;
    const failed = (code) => { const p = S.pending.find((x) => x.cid === frame.cid); if (p && p.state === 'sending') { p.state = 'failed'; p.code = code; renderPending(); } };
    setTimeout(() => { if (S.pending.some((x) => x.cid === frame.cid && x.state === 'sending') && !send(frame)) failed('lost'); }, wait);
    setTimeout(() => failed('timeout'), wait + 12000);
  }
  function resend(cid) {
    const p = S.pending.find((x) => x.cid === cid);
    if (!p) return;
    if (!S.ready) { fail({ code: 'lost' }); return; }
    S.pending = S.pending.filter((x) => x.cid !== cid);
    dispatch(C.say(S, { room: p.room, text: p.text, reply: p.reply }));
    renderPending();
    toBottom(true);
  }
  /** The server refused a message: it leaves the list and its text goes back into the box, with the reason under it. */
  function saidNo(ev) {
    renderPending();
    const p = ev.lost;
    if (ta && p.room === S.cur) {
      if (!ta.value.trim()) ta.value = p.text;
      if (p.reply && !V.replyTo) { V.replyTo = p.reply; renderReply(); }
      autosize(); updateSend();
    } else { drafts[p.room] = p.text; saveDrafts(); }
    if (ev.code === 'name-needed') { askName(trySend); return; }
    if (ev.code === 'muted' || ev.code === 'banned' || ev.code === 'closed' || ev.code === 'readonly') renderComposer(true);
    if (errEl) showError(ev); else fail(ev);
  }

  // ── Nickname, rooms, reports ───────────────────────────────────────────
  const rulesBox = () => h('div', { class: 'ch-rules' }, h('h3', { text: t('社区守则，简单说', 'Community rules, in short') }),
    h('ul', null,
      h('li', { text: t('对人客气，讨论问题，不攻击人。', 'Be kind. Argue about the problem, not the person.') }),
      h('li', { text: t('不发广告、不刷屏，不发违法或危险的内容。', 'No ads, no flooding, nothing illegal or dangerous.') }),
      h('li', { text: t('这里是公开的：不登录的人也能看到，消息会一直保留。别贴密码、密钥、邮箱和别人的隐私。', 'This is public: anyone can read it without an account, and messages are kept. Do not post passwords, keys, email addresses or other people’s private details.') }),
      h('li', { text: t('自己的发言随时可以删除；违反守则的消息和账号，站长会处理。', 'You can delete your own messages at any time. The owner removes messages and accounts that break the rules.') })),
    h('a', { href: RULES, target: '_blank', rel: 'noopener' }, t('完整的守则', 'The full rules'), arrow()));
  /** Not signed in: nothing that writes can go ahead. Explain, and offer the sign-in page. */
  function needAccount() {
    if (S.me) return false;
    let d = null;
    d = dialog({ title: S.auth === 'expired' ? t('登录已过期', 'Your sign-in has expired') : t('登录后就能这样做', 'Sign in to do that'),
      body: [h('p', { text: t('看消息不需要账号。发言、举报和开房间需要登录：免费，用邮箱收一个验证码就行，不用设密码。', 'Reading needs no account. Posting, reporting and opening rooms need one: it is free, and you sign in with a code sent to your email, no password.') })],
      actions: [cancelBtn(() => d), h('a', { class: 'ch-btn primary', href: SIGN_IN, autofocus: true }, t('去登录', 'Sign in'), arrow('right'))] });
    return true;
  }
  /** The nickname dialog. then() runs once the server has accepted the name (the message that was waiting gets sent). */
  function askName(then) {
    if (needAccount()) return;
    const first = !S.me.name;
    let d = null, busy = false;
    const input = h('input', { id: 'ch-name', type: 'text', autocomplete: 'nickname', autocapitalize: 'off', spellcheck: 'false', maxlength: '60', autofocus: true, value: S.me.name || '', 'aria-describedby': 'ch-name-say ch-name-rule' });
    const say = h('p', { class: 'ch-say', id: 'ch-name-say', role: 'status', 'aria-live': 'polite' });
    const ok = h('button', { type: 'submit', class: 'ch-btn primary', text: first ? t('就用这个名字', 'Use this name') : t('改成这个名字', 'Change nickname') });
    const check = () => {
      const c = C.checkName(input.value, { limits: S.limits, admin: isAdmin() });
      const empty = c.why === 'empty';
      say.textContent = c.ok ? t(`“${c.name}”可以用。`, `“${c.name}” looks fine.`) : empty ? '' : C.nameWhy(c.why, en, S.limits);
      say.toggleAttribute('data-bad', !c.ok && !empty);
      say.toggleAttribute('data-ok', c.ok);
      ok.disabled = !c.ok || busy || (!first && c.name === S.me.name);
      return c;
    };
    input.addEventListener('input', check);
    d = dialog({
      title: first ? t('先取一个昵称', 'Pick a nickname first') : t('改昵称', 'Change nickname'),
      body: [
        h('label', { class: 'ch-field' }, t('昵称', 'Nickname'), input,
          h('small', { id: 'ch-name-rule', text: t(`${S.limits.name[0]}–${S.limits.name[1]} 个字，可以用文字、数字、空格和 _ - . 。昵称是公开的，别用邮箱或真实全名；之后每 24 小时可以改一次。`, `${S.limits.name[0]}–${S.limits.name[1]} characters: letters, digits, spaces and _ - . only. It is public, so avoid your email or full legal name. You can change it once every 24 hours.`) })),
        say, rulesBox()],
      actions: [cancelBtn(() => d), ok],
      onSubmit: () => {
        const c = check();
        if (!c.ok || busy) return;
        busy = true; ok.disabled = true;
        call({ t: 'name', name: c.name }).then(() => { d.close(); toast(t(`你现在叫“${c.name}”。`, `You are now “${c.name}”.`)); if (then) then(); },
          (ev) => { busy = false; check(); say.textContent = errText(ev); say.removeAttribute('data-ok'); say.setAttribute('data-bad', ''); input.focus(); });
      }
    });
    check();
  }
  /** One form for opening a room and for editing one. */
  function roomForm(o) {
    let d = null, busy = false;
    const name = h('input', { id: 'ch-room-title', type: 'text', autocomplete: 'off', maxlength: '80', autofocus: true, value: o.title || '', 'aria-describedby': 'ch-room-say' });
    const topic = h('textarea', { id: 'ch-room-topic', rows: '2', maxlength: '300', 'aria-describedby': 'ch-room-say' });
    topic.value = o.topic || '';
    const say = h('p', { class: 'ch-say', id: 'ch-room-say', role: 'status', 'aria-live': 'polite' });
    const ok = h('button', { type: 'submit', class: 'ch-btn primary', text: o.ok });
    const check = () => {
      const a = C.checkTitle(name.value, S.limits), b = C.checkTopic(topic.value, S.limits);
      const empty = !a.title;
      const why = !a.ok && !empty ? errText({ code: 'title-bad' }) : !b.ok ? t(`简介太长了：${b.len} / ${S.limits.topic} 个字。`, `The topic is too long: ${b.len} / ${S.limits.topic} characters.`) : '';
      say.textContent = why;
      say.toggleAttribute('data-bad', !!why);
      ok.disabled = busy || !a.ok || !b.ok;
      return { ok: a.ok && b.ok, title: a.title, topic: b.topic };
    };
    name.addEventListener('input', check);
    topic.addEventListener('input', check);
    d = dialog({
      title: o.heading,
      body: [o.intro ? h('p', { text: o.intro }) : null,
        h('label', { class: 'ch-field' }, t('房间名', 'Room name'), name, h('small', { text: t(`${S.limits.title[0]}–${S.limits.title[1]} 个字，说清楚聊什么。`, `${S.limits.title[0]}–${S.limits.title[1]} characters. Say what it is about.`) })),
        h('label', { class: 'ch-field' }, t('简介（可选）', 'Topic (optional)'), topic, h('small', { text: t(`一句话，最多 ${S.limits.topic} 个字。`, `One line, up to ${S.limits.topic} characters.`) })),
        say, o.note ? h('p', { class: 'ch-say', text: o.note }) : null],
      actions: [cancelBtn(() => d), ok],
      onSubmit: () => {
        const c = check();
        if (!c.ok || busy) return;
        busy = true; ok.disabled = true;
        o.send(c).then((ev) => { d.close(); o.done(ev, c); }, (ev) => { busy = false; check(); say.textContent = errText(ev); say.setAttribute('data-bad', ''); });
      }
    });
    check();
  }
  function askRoom() {
    if (needAccount()) return;
    if (!S.me.name) { askName(askRoom); return; }
    const kind = C.composerState(S, null, now());
    if (kind !== 'ok') { fail({ code: kind, until: S.me.muted }); return; }
    const mine = S.me.rooms, max = S.limits.rooms;
    if (mine >= max && !isAdmin()) { fail({ code: 'rooms-max' }); return; }
    roomForm({
      heading: t('开一个房间', 'Open a room'), ok: t('开房间', 'Open room'),
      intro: t('想聊一个具体的题目、带一个读书会、给课题组留个角落，都可以开一个房间。所有人都能看到，也都能进来。', 'For a specific topic, a reading group, or a corner for your lab. Everyone can see the room and walk in.'),
      note: t(`你已经开了 ${mine} / ${max} 个房间。一直没人发言的空房间，7 天后会被自动收走。`, `You have opened ${mine} of ${max} rooms. An empty room that nobody ever posts in is tidied away after 7 days.`),
      send: (c) => call({ t: 'mkroom', title: c.title, topic: c.topic }),
      done: (ev, c) => {
        toast(t(`“${c.title}”开好了。`, `“${c.title}” is open.`));
        if (ev.room && C.roomById(S, ev.room)) openRoom(ev.room, { push: !isWide(), focus: true }); else V.gotoRoom = ev.room;
      }
    });
  }
  function editRoom(room) {
    roomForm({
      heading: t('改名字和简介', 'Edit name and topic'), ok: t('保存', 'Save'), title: room.title, topic: room.topic,
      note: room.kind === 'official' && (room.title_en || room.topic_en) ? t('这里改的是中文名字和简介；英文版本在服务端。', 'This edits the Chinese name and topic. The English ones live on the server.') : '',
      send: (c) => {
        const f = { t: 'edroom', room: room.id };
        if (c.title !== room.title) f.title = c.title;
        if (c.topic !== room.topic) f.topic = c.topic;
        return call(f);
      },
      done: () => toast(t('已保存。', 'Saved.'))
    });
  }
  async function closeRoom(room, closed) {
    if (closed && !await confirmDialog({ title: t('关闭这个房间？', 'Close this room?'), text: t('关闭后大家还能看里面的消息，但不能再发言。之后可以重新开放。', 'People can still read it, but nobody can post. You can reopen it later.'), ok: t('关闭房间', 'Close room') })) return;
    call({ t: 'edroom', room: room.id, closed }).then(() => toast(closed ? t('房间已关闭。', 'Room closed.') : t('房间重新开放了。', 'Room reopened.')), fail);
  }
  async function removeRoom(room) {
    if (!await confirmDialog({ title: t('移除这个房间？', 'Remove this room?'), text: t(`“${title(room)}”和里面的全部消息会被永久删除，不能恢复。`, `“${title(room)}” and every message in it will be deleted for good.`), ok: t('永久移除', 'Remove for good'), danger: true })) return;
    call({ t: 'rmroom', room: room.id }).then(() => toast(t('房间已移除。', 'Room removed.')), fail);
  }
  function copy(text, done) {
    const ok = () => toast(done || t('已复制。', 'Copied.'));
    const old = () => {
      // The clipboard API needs a secure page and permission; a hidden text box and execCommand work everywhere else.
      const box = h('textarea', { style: 'position:fixed;opacity:0;top:0;left:0', 'aria-hidden': 'true', tabindex: '-1' });
      box.value = text;
      layer.append(box);
      box.select();
      let good = false;
      try { good = document.execCommand('copy'); } catch {}
      box.remove();
      if (good) ok(); else toast(t('没能复制，请手动选中后复制。', 'Could not copy. Select the text and copy it by hand.'), true);
    };
    if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(ok, old); else old();
  }
  function msgMenu(id, anchor) {
    const log = S.logs[S.cur], m = log && log.msgs.find((x) => x.id === id);
    if (!m) return;
    const who = nameOf(m.name), items = [];
    const add = { reply: () => items.push({ icon: 'reply', label: t('回复', 'Reply'), run: () => startReply(m.id) }),
      copy: () => items.push({ icon: 'copy', label: t('复制文字', 'Copy text'), run: () => copy(m.text) }),
      report: () => items.push({ icon: 'flag', label: t('举报', 'Report'), run: () => report(m) }),
      delete: () => items.push({ icon: 'trash', label: t('删除', 'Delete'), danger: true, run: () => delMsg(m) }),
      hide: () => items.push({ icon: 'eyeoff', label: t('屏蔽此人', 'Hide this person'), run: () => hide(m) }),
      mute1: () => items.push('-', { icon: 'clock', label: t('禁言 1 小时', 'Mute for 1 hour'), run: () => mute(m.uid, who, 1) }),
      mute24: () => items.push({ icon: 'clock', label: t('禁言 1 天', 'Mute for 1 day'), run: () => mute(m.uid, who, 24) }),
      mute168: () => items.push({ icon: 'clock', label: t('禁言 7 天', 'Mute for 7 days'), run: () => mute(m.uid, who, 168) }),
      ban: () => items.push({ icon: 'ban', label: t('封禁', 'Ban'), danger: true, run: () => ban(m.uid, who) }),
      purge: () => items.push({ icon: 'trash', label: t('删除此人的全部消息', 'Delete all their messages'), danger: true, run: () => purge(m.uid, who) }) };
    for (const a of C.actionsFor(S, m, cur(), now())) add[a]();
    openMenu(anchor, items, { label: t(`${who} 这条消息的操作`, `Actions for this message by ${who}`), who: `${who} · ${C.clock(m.t)}${isAdmin() && m.uid ? ` · ${m.uid}` : ''}` }); // the owner also sees the account's id (docs/RUNBOOK.md)
  }
  function report(m) {
    if (needAccount()) return;
    if (!S.me.name) { askName(() => report(m)); return; }
    let d = null, busy = false;
    const why = h('input', { id: 'ch-report-why', type: 'text', maxlength: '200', autocomplete: 'off', autofocus: true, placeholder: t('比如：广告、人身攻击、危险内容', 'For example: spam, a personal attack, dangerous content') });
    const say = h('p', { class: 'ch-say', role: 'status', 'aria-live': 'polite' });
    const ok = h('button', { type: 'submit', class: 'ch-btn primary', text: t('举报', 'Report') });
    d = dialog({
      title: t('举报这条消息', 'Report this message'),
      body: [h('div', { class: 'ch-quoted' }, h('b', { text: nameOf(m.name) }), C.clip(m.text, 300)),
        h('label', { class: 'ch-field' }, t('原因（可选）', 'Reason (optional)'), why),
        h('p', { text: t('举报只有站长看得到，对方不会知道是谁举报的。一条消息被 3 个人举报后会先隐藏，等站长处理。', 'Only the owner sees reports, and the author is not told who reported. A message reported by 3 people is hidden until the owner has looked at it.') }), say],
      actions: [cancelBtn(() => d), ok],
      onSubmit: () => {
        if (busy) return;
        busy = true; ok.disabled = true;
        call({ t: 'report', id: m.id, reason: C.clip(why.value, 200) }).then(() => { d.close(); toast(t('已举报，谢谢。站长会来看。', 'Reported. Thank you, the owner will take a look.')); },
          (ev) => { busy = false; ok.disabled = false; say.textContent = errText(ev); say.setAttribute('data-bad', ''); });
      }
    });
  }
  async function delMsg(m) {
    const mine = S.me && m.uid === S.me.uid;
    if (!await confirmDialog({ title: t('删除这条消息？', 'Delete this message?'), text: mine ? t('删除后所有人都看不到它的内容，不能恢复。', 'Nobody will be able to read it afterwards, and it cannot be brought back.') : t(`${nameOf(m.name)} 的这条消息会被删除，不能恢复。`, `This message by ${nameOf(m.name)} will be deleted and cannot be brought back.`),
      extra: [h('div', { class: 'ch-quoted' }, C.clip(m.text, 200))], ok: t('删除', 'Delete'), danger: true })) return;
    call({ t: 'del', id: m.id }).then(() => toast(t('已删除。', 'Deleted.')), fail);
  }
  function hide(m) {
    prefs.hide[m.uid] = m.name || '';
    savePrefs();
    renderLog('keep');
    toast(t(`已屏蔽 ${nameOf(m.name)}，只在这台设备上生效。在“我的设置”里可以取消。`, `${nameOf(m.name)} is hidden on this device. Undo it under “My settings”.`));
  }
  /** An owner's action. Resolves true when the server did it, false (after showing why) when it did not. */
  const modCall = (frame, done) => call(frame).then(() => { if (done) toast(done); if (V.pane === 'mod') send({ t: 'mod', op: 'list' }); return true; }, (ev) => { fail(ev); return false; });
  const mute = (uid, who, hours) => modCall({ t: 'mod', op: 'mute', uid, hours }, hours ? t(`已禁言 ${who}：${hours >= 24 ? `${hours / 24} 天` : `${hours} 小时`}。`, `${who} is muted for ${hours >= 24 ? pl(hours / 24, 'day') : pl(hours, 'hour')}.`) : t(`已解除 ${who} 的禁言。`, `${who} is no longer muted.`));
  async function ban(uid, who) {
    if (!await confirmDialog({ title: t(`封禁 ${who}？`, `Ban ${who}?`), text: t('封禁后这个账号不能再发言、举报和开房间，直到你解封。已有的消息不受影响。', 'The account can no longer post, report or open rooms until you lift the ban. Existing messages stay.'), ok: t('封禁', 'Ban'), danger: true })) return false;
    return modCall({ t: 'mod', op: 'ban', uid, on: true }, t(`已封禁 ${who}。`, `${who} is banned.`));
  }
  async function purge(uid, who) {
    if (!await confirmDialog({ title: t(`删除 ${who} 的全部消息？`, `Delete every message by ${who}?`), text: t('这个人在所有房间里的消息都会被永久删除，不能恢复。', 'Every message this person posted, in every room, will be deleted for good.'), ok: t('全部删除', 'Delete everything'), danger: true })) return;
    if (!await modCall({ t: 'mod', op: 'purge', uid }, t(`已删除 ${who} 的全部消息。`, `Every message by ${who} is deleted.`))) return;
    if (S.cur) reload();
  }

  // ── Who is here, my settings ───────────────────────────────────────────
  let whoDlg = null;
  function showWho() {
    const w = S.who, room = w && C.roomById(S, w.room);
    if (!w || !room) return;
    const list = h('ul', { class: 'ch-people' }, w.users.map((u) => h('li', null, avatar(u.uid, u.name, true), h('span', { text: nameOf(u.name) }), u.role === 'admin' ? ownerBadge() : null)));
    const rest = w.guests ? h('p', { text: w.users.length ? t(`还有 ${w.guests} 位没有登录的读者。`, `And ${pl(w.guests, 'reader')} who ${w.guests === 1 ? 'is' : 'are'} not signed in.`) : t(`现在有 ${w.guests} 位没有登录的读者。`, `${pl(w.guests, 'reader')} here, not signed in.`) }) : null;
    const none = !w.users.length && !w.guests ? h('p', { text: t('现在没有别人在这个房间。', 'Nobody else is in this room right now.') }) : null;
    if (whoDlg && whoDlg.dlg.open) whoDlg.close();
    whoDlg = dialog({ title: t(`谁在“${title(room)}”`, `Who is in ${title(room)}`), body: [w.users.length ? list : null, rest, none], actions: [] });
  }
  function showSettings() {
    let d = null;
    const again = () => { d.close(); showSettings(); };
    const hidden = Object.entries(prefs.hide);
    const body = [h('h3', { class: 'ch-h3', text: t('我的昵称', 'My nickname') })];
    if (S.me) {
      body.push(h('ul', { class: 'ch-people' }, h('li', null, avatar(S.me.uid, S.me.name, true), h('span', { text: S.me.name || t('还没有昵称', 'No nickname yet') }),
        h('button', { type: 'button', class: 'ch-btn small', text: S.me.name ? t('改昵称', 'Change') : t('取昵称', 'Pick one'), onclick: () => { d.close(); askName(); } }))));
    } else body.push(h('p', null, t('你现在是游客，可以看所有房间。', 'You are reading as a guest. Every room is open to you.'), ' ', api ? h('a', { href: SIGN_IN, text: t('登录后发言', 'Sign in to post') }) : null));
    body.push(h('h3', { class: 'ch-h3', text: t('我屏蔽的人', 'People I hid') }));
    body.push(hidden.length
      ? h('ul', { class: 'ch-people' }, hidden.map(([uid, name]) => h('li', null, avatar(uid, name, true), h('span', { text: nameOf(name) }),
        h('button', { type: 'button', class: 'ch-btn small', text: t('取消屏蔽', 'Unhide'), 'aria-label': t(`取消屏蔽 ${nameOf(name)}`, `Unhide ${nameOf(name)}`), onclick: () => { delete prefs.hide[uid]; savePrefs(); if (S.cur) renderLog('keep'); again(); } }))))
      : h('p', { text: t('你没有屏蔽任何人。屏蔽只在这台设备上生效，对方不会知道。', 'You have not hidden anyone. Hiding only affects this device, and the other person is not told.') }));
    if (S.me) {
      body.push(h('h3', { class: 'ch-h3', text: t('我的数据', 'My data') }),
        h('p', { text: t('你可以一次删掉自己在所有房间里的发言和昵称。你开的房间会留下，但不再显示是谁开的。', 'You can delete every message you posted, in every room, together with your nickname. Rooms you opened stay, without your name on them.') }),
        h('button', { type: 'button', class: 'ch-btn danger', id: 'ch-wipe', text: t('删除我的全部发言和昵称', 'Delete all my messages and nickname'), onclick: () => { d.close(); wipe(); } }));
    }
    body.push(h('h3', { class: 'ch-h3', text: t('了解更多', 'More') }),
      h('p', null, h('a', { href: RULES }, t('社区守则', 'Community rules')), t('　·　', ' · '), h('a', { href: PRIVACY }, t('讨论室保存什么', 'What the rooms store'))));
    d = dialog({ title: t('我的设置', 'My settings'), body, actions: [] });
  }
  async function wipe() {
    if (!await confirmDialog({ title: t('删除我的全部发言和昵称？', 'Delete all my messages and nickname?'),
      text: [t('你在所有房间里发过的消息都会被永久删除，昵称也会清空。别人回复你时引用的片段会显示为“原消息已经不在了”。', 'Every message you posted, in every room, will be deleted for good, and your nickname will be cleared. Where others quoted you, the quote will read “The original is gone”.'),
        t('你的 MolAstria 账号不受影响，之后可以重新取昵称。', 'Your MolAstria account is not affected, and you can pick a nickname again later.')], ok: t('继续', 'Continue'), danger: true })) return;
    if (!await confirmDialog({ title: t('最后确认', 'One last check'), text: t('这一步不能撤销，删掉的消息找不回来。', 'This cannot be undone. Deleted messages cannot be recovered.'), ok: t('全部删除', 'Delete everything'), danger: true })) return;
    call({ t: 'wipe' }).then(() => { toast(t('你的发言和昵称都已删除。', 'Your messages and nickname are deleted.')); if (S.cur) reload(); }, fail);
  }

  // ── The owner's panel ──────────────────────────────────────────────────
  function renderMod() {
    if (V.pane !== 'mod') return;
    const m = S.mod;
    if (!m) { modEl.replaceChildren(h('p', { class: 'ch-mod-none', text: S.ready ? t('正在载入…', 'Loading…') : t('连接断了，重连后会载入。', 'Disconnected. This loads once the page is back online.') })); return; }
    const kids = [h('h3', { class: 'ch-h3', text: t(`待处理的举报（${m.reports.length}）`, `Open reports (${m.reports.length})`) })];
    if (!m.reports.length) kids.push(h('p', { class: 'ch-mod-none', text: t('没有待处理的举报。', 'No open reports. All quiet.') }));
    for (const r of m.reports) {
      const who = nameOf(r.m.name);
      const act = (label, run, cls) => h('button', { type: 'button', class: `ch-btn small${cls ? ` ${cls}` : ''}`, text: label, onclick: run });
      const resolve = (action) => call({ t: 'mod', op: 'resolve', id: r.id, action });
      const done = (text) => () => { toast(text); send({ t: 'mod', op: 'list' }); };
      kids.push(h('article', { class: 'ch-report', data: { id: r.id } },
        h('p', { class: 'ch-report-h' }, h('b', { text: r.title }), h('span', { class: 'ch-tag gold', text: t(`${r.n} 人举报`, pl(r.n, 'report')) }), r.m.hidden ? h('span', { class: 'ch-tag', text: t('已自动隐藏', 'Hidden automatically') }) : null, h('span', { text: C.fullTime(r.m.t) })),
        h('div', { class: 'ch-report-m' }, avatar(r.m.uid, r.m.name, true), h('div', null, h('b', { class: 'ch-name', style: r.m.name ? `--av:${C.avatarColor(r.m.uid)}` : null, text: who }), fill(h('div', { class: 'ch-text' }), r.m.text))),
        r.reasons.length ? h('ul', { class: 'ch-reasons', 'aria-label': t('举报原因', 'Reasons given') }, r.reasons.map((x) => h('li', { text: x }))) : null,
        h('div', { class: 'ch-report-a' },
          act(t('保留', 'Keep'), () => resolve('keep').then(done(t('已保留，这条消息不会再被自动隐藏。', 'Kept. This message will not be hidden automatically again.')), fail)),
          act(t('删除', 'Delete'), () => resolve('delete').then(done(t('已删除。', 'Deleted.')), fail), 'danger'),
          act(t('删除并禁言 1 天', 'Delete + mute 1 day'), () => resolve('delete').then(() => call({ t: 'mod', op: 'mute', uid: r.m.uid, hours: 24 })).then(done(t(`已删除，并禁言 ${who} 1 天。`, `Deleted, and ${who} is muted for 1 day.`)), fail), 'danger'),
          act(t('封禁', 'Ban'), async () => { if (await ban(r.m.uid, who)) resolve('delete').then(done(t(`已封禁 ${who}，这条消息也删除了。`, `${who} is banned and the message is deleted.`)), fail); }, 'danger'))));
    }
    kids.push(h('h3', { class: 'ch-h3', text: t(`被禁言和封禁的人（${m.users.length}）`, `Muted and banned (${m.users.length})`) }));
    if (!m.users.length) kids.push(h('p', { class: 'ch-mod-none', text: t('现在没有人被禁言或封禁。', 'Nobody is muted or banned right now.') }));
    else kids.push(h('ul', { class: 'ch-users' }, m.users.map((u) => {
      const who = nameOf(u.name);
      return h('li', null, avatar(u.uid, u.name, true),
        h('span', null, h('b', { text: who }), h('small', { text: [u.uid, u.banned ? t('已封禁', 'Banned') : '', u.muted > now() ? t(`禁言到 ${C.untilText(u.muted, now(), en)}`, `Muted until ${C.untilText(u.muted, now(), en)}`) : ''].filter(Boolean).join(' · ') })),
        u.muted > now() ? h('button', { type: 'button', class: 'ch-btn small', text: t('解除禁言', 'Unmute'), 'aria-label': t(`解除 ${who} 的禁言`, `Unmute ${who}`), onclick: () => mute(u.uid, who, 0) }) : null,
        u.banned ? h('button', { type: 'button', class: 'ch-btn small', text: t('解封', 'Unban'), 'aria-label': t(`解封 ${who}`, `Unban ${who}`), onclick: () => modCall({ t: 'mod', op: 'ban', uid: u.uid, on: false }, t(`已解封 ${who}。`, `${who} is no longer banned.`)) }) : null);
    })));
    const top = modEl.scrollTop;
    modEl.replaceChildren(...kids);
    modEl.scrollTop = top;
  }

  // ── Touch screens ──────────────────────────────────────────────────────
  // A long press on a message opens its actions where the browser reports one (Android); the "…" button is always there.
  if (touch) logEl.addEventListener('contextmenu', (e) => {
    const row = e.target.closest && e.target.closest('.ch-msg[data-id]'), btn = row && row.querySelector('.ch-act-more');
    if (!btn || (e.target.closest && e.target.closest('a'))) return;
    e.preventDefault();
    msgMenu(Number(row.dataset.id), btn);
  });
  // The on-screen keyboard covers the bottom of the window without resizing the page. Shrink the app to the part
  // that is still visible so the box stays above the keyboard and the newest message above the box.
  const vv = window.visualViewport;
  if (vv) {
    const fit = () => {
      const covered = window.innerHeight - vv.height;
      if (covered > 120 && document.activeElement && /^(TEXTAREA|INPUT)$/.test(document.activeElement.tagName)) {
        const stick = V.atBottom;
        // <body> sits inside the zoomed <html>, so its height is written in zoomed pixels
        document.body.style.height = `${vv.height / (parseFloat(root.style.zoom) || 1)}px`;
        window.scrollTo(0, 0);
        if (stick) logEl.scrollTop = logEl.scrollHeight;
      } else document.body.style.height = '';
    };
    vv.addEventListener('resize', fit);
    vv.addEventListener('scroll', fit);
  }
  // Crossing between one column and two (a rotated tablet, a resized or zoomed window).
  let wasWide = null;
  new ResizeObserver(() => {
    const w = isWide();
    if (w === wasWide) return;
    const first = wasWide === null;
    wasWide = w;
    if (!first) route();
  }).observe(app);
  addEventListener('focus', seen);

  // ── Start ──────────────────────────────────────────────────────────────
  if (en) document.title = BASE_TITLE;
  renderTop(); renderFoot(); renderMe(); renderRooms();
  route();
  // A tab opened in the background holds no connection: the sleep timer only starts on a visibilitychange, which
  // such a tab never gets. It connects when it is first looked at (the visibilitychange handler wakes it).
  if (document.visibilityState === 'hidden') { V.asleep = true; setConn('asleep'); } else connect();
})();
