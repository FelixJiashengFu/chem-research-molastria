'use strict';
// 锁区：一次买断后才能打开的栏目。这个文件只有两样东西：锁页（价格、购买、登录、找回购买）和一个通用的阅读器。
// 正文、目录、公式（已经转成 MathML）、文献和演示的代码都不在公开仓库里，存在账号服务的 D1 里，
// 由 GET /premium/<PRODUCT>?part=&lang= 发给买了的账号（deploy/account-worker.js）；没买的人拿到 402，这一页就只有一把锁。
// 分块：index（标题、各章目录、时间线、自测、书目）、refs（文献）、code（演示的数学和定义，一段 JS）、c-<章>（一章的正文）。
// 正文字段是服务端给的 HTML（只有站长能上传），直接放进页面；这一页自己拼的文字一律 esc()。
// 写法照化学学科馆的阅读器（../chemistry/chem.js）：一次读一章，演示嵌在章里。地址 #c-<章>、#ref-<文献>。
// 本机只存读过的章和答对的题（molastria-vault），正文不落盘。文字自带中英两版，整页 translate="no"。
(() => {
  const PRODUCT = 'v1';
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (Array.isArray(t) ? t[en ? 1 : 0] : t ?? '');
  const reduced = () => matchMedia('(prefers-reduced-motion: reduce)').matches;
  const gate = $('#vault-gate'), lockEl = $('#vault-lock'), panel = $('#vault-panel'), root = $('#vault');
  if (!gate || !panel || !root) return;
  const acct = window.MolAstriaAccount, PAY = window.MOLASTRIA_PAY || {}, plan = PAY.plans?.[PRODUCT] || {};
  document.title = L('锁区 · MolAstria', 'Locked · MolAstria');
  $('#vault-h1').textContent = L('锁区', 'Locked section');

  // ── 锁页 ────────────────────────────────────────────────────────────────
  const price = () => {
    const p = Number(plan.price) || 199, usd = PAY.usdPerCny ? Math.round(p * PAY.usdPerCny) : 0;
    return `<p class="vlt-price">¥${p}<small>${L('一次买断', `One-time purchase${usd ? ` · about US$${usd}` : ''}`)}</small></p>`;
  };
  const fine = () => `<p class="vlt-fine">${L('一次性付款，不是订阅，Pro 不包含。买到的内容绑定在付款邮箱上，换设备用这个邮箱登录就能再打开。', 'A single payment, not a subscription, and not part of Pro. The purchase belongs to the email you pay with: sign in with it on any device to open this again.')} <a href="../pro/terms.html">${L('条款与退款', 'Terms and refunds')}</a></p>`;
  const shake = () => { lockEl.classList.remove('is-no'); void lockEl.offsetWidth; lockEl.classList.add('is-no'); };
  const say = (t, err) => { const m = $('#vault-msg'); if (m) { m.textContent = t || ''; m.classList.toggle('is-err', !!err); } if (err) shake(); };

  function buy() {
    let url;
    try { url = new URL(plan.checkoutUrl); } catch { say(L('还没有开放购买。', 'Not on sale yet.'), true); return; }
    const email = acct?.token?.() ? acct.cached()?.email : '';
    if (PAY.provider === 'stripe' || /(^|\.)stripe\.com$/.test(url.hostname)) {
      if (email) url.searchParams.set('prefilled_email', email);
      url.searchParams.set('client_reference_id', `${PRODUCT}-${Date.now().toString(36)}`);
      url.searchParams.set('locale', en ? 'en' : 'zh');
    }
    const w = window.open(url.href, '_blank');
    if (w) { try { w.opener = null; } catch { /* 已经分开了 */ } }
    say(L('付款页在新窗口打开了。付完以后回到这里，点“我已经付款”。', 'Checkout opened in a new window. When you have paid, come back and press “I have paid”.'));
    const b = $('#vault-paid'); if (b) b.hidden = false;
  }
  const buyBtn = () => `<button type="button" class="button primary" id="vault-buy"${plan.checkoutUrl ? '' : ' disabled'}>${plan.checkoutUrl ? L('解锁', 'Unlock') : L('即将开放', 'Opening soon')}</button>`;

  function lock(state, note) {
    gate.hidden = false; root.hidden = true; root.innerHTML = '';
    lockEl.classList.toggle('is-busy', state === 'busy');
    lockEl.classList.remove('is-open');
    const who = acct?.token?.() ? acct.cached()?.email : '';
    if (state === 'busy') { panel.innerHTML = `<p class="vlt-msg" id="vault-msg">${L('正在核对…', 'Checking…')}</p>`; return; }
    if (state === 'in') {
      panel.innerHTML = `${price()}<p class="vlt-who">${L('已登录', 'Signed in as')} ${esc(who)} · ${L('这个账号还没有解锁', 'this account has not unlocked it')}</p>
        <div class="vlt-acts">${buyBtn()}<button type="button" class="button" id="vault-paid" hidden>${L('我已经付款', 'I have paid')}</button><button type="button" class="button" id="vault-restore">${L('找回购买', 'Restore purchase')}</button></div>
        <p class="vlt-msg" id="vault-msg" role="status"></p>${fine()}`;
    } else if (state === 'error') {
      panel.innerHTML = `<p class="vlt-msg is-err" id="vault-msg" role="alert">${esc(note || L('暂时打不开，请稍后再试。', 'This cannot be opened right now. Please try again later.'))}</p><div class="vlt-acts"><button type="button" class="button" id="vault-retry">${L('再试一次', 'Try again')}</button></div>`;
    } else {
      panel.innerHTML = `${price()}<div class="vlt-acts">${buyBtn()}<button type="button" class="button" id="vault-signin">${L('已经买过？登录', 'Already bought? Sign in')}</button></div>
        <form class="vlt-form" id="vault-form" hidden novalidate><input type="email" id="vault-email" autocomplete="email" inputmode="email" placeholder="${L('付款时用的邮箱', 'The email you paid with')}" aria-label="${L('邮箱', 'Email')}"><input type="text" id="vault-code" inputmode="numeric" autocomplete="one-time-code" maxlength="6" placeholder="${L('6 位验证码', '6-digit code')}" aria-label="${L('验证码', 'Code')}" hidden><button type="submit" class="button primary" id="vault-send">${L('发送验证码', 'Send code')}</button></form>
        <p class="vlt-msg" id="vault-msg" role="status">${esc(note || '')}</p>${fine()}`;
    }
  }
  let emailSent = '';
  panel.addEventListener('click', (e) => {
    const b = e.target.closest('button');
    if (!b) return;
    if (b.id === 'vault-buy') buy();
    else if (b.id === 'vault-signin') { const f = $('#vault-form'); f.hidden = !f.hidden; if (!f.hidden) $('#vault-email').focus(); }
    else if (b.id === 'vault-retry') boot();
    else if (b.id === 'vault-restore' || b.id === 'vault-paid') {
      b.disabled = true; say(L('正在向付款平台核对…', 'Checking with the payment provider…'));
      acct.restorePurchases().then((r) => { if (r.account?.owns?.includes(PRODUCT)) boot(); else { say(L('没有查到这个邮箱的付款。付款时填的如果是别的邮箱，请退出后用那个邮箱登录。', 'No payment found for this email. If you paid with a different email, sign out and sign in with that one.'), true); b.disabled = false; } })
        .catch((err) => { say(err.message, true); b.disabled = false; });
    }
  });
  panel.addEventListener('submit', (e) => {
    e.preventDefault();
    if (!acct?.enabled) { say(L('账号服务正在开通，请稍后再试。', 'The account service is not available yet.'), true); return; }
    const email = $('#vault-email').value.trim(), codeEl = $('#vault-code'), send = $('#vault-send');
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { say(L('邮箱格式不对。', 'That email address does not look right.'), true); return; }
    send.disabled = true;
    if (emailSent !== email || codeEl.hidden) {
      acct.start(email).then(() => { emailSent = email; codeEl.hidden = false; codeEl.value = ''; codeEl.focus(); send.textContent = L('登录', 'Sign in'); say(L('验证码已经发到这个邮箱，10 分钟内有效。', 'A code is on its way to that address. It is valid for 10 minutes.')); })
        .catch((err) => say(err.message, true)).finally(() => { send.disabled = false; });
    } else {
      acct.verify(email, codeEl.value.trim()).then(() => boot()).catch((err) => { say(err.message, true); send.disabled = false; });
    }
  });

  // ── 取内容 ──────────────────────────────────────────────────────────────
  const lang = en ? 'en' : 'zh';
  const cache = new Map();
  const part = (name) => { if (!cache.has(name)) cache.set(name, acct.premium(PRODUCT, name, lang).catch((err) => { cache.delete(name); throw err; })); return cache.get(name); };

  async function boot() {
    if (!acct?.enabled || !acct.token()) { lock('out'); return; }
    lock('busy');
    let D, R, C;
    try { [D, R, C] = await Promise.all([part('index'), part('refs'), part('code')]); } catch (err) {
      if (err.status === 402) lock('in'); else if (err.status === 401) lock('out', L('登录已经过期，请重新登录。', 'Your sign-in has expired. Please sign in again.')); else lock('error', err.message);
      return;
    }
    lockEl.classList.remove('is-busy'); lockEl.classList.add('is-open'); panel.innerHTML = '';
    setTimeout(() => { gate.hidden = true; root.hidden = false; try { reader(D, R.refs || [], C.js || ''); } catch (err) { console.error('[vault]', err); lock('error'); } }, reduced() ? 0 : 750);
  }

  // ── 阅读器 ──────────────────────────────────────────────────────────────
  function reader(D, REFS, code) {
    document.title = `${D.title} · MolAstria`;
    const chById = Object.fromEntries(D.chapters.map((c, i) => [c.id, { ...c, n: c.n || String(i + 1).padStart(2, '0') }]));
    const order = D.chapters.map((c) => c.id);
    const refById = Object.fromEntries(REFS.map((r) => [r.id, r]));
    const lvl = (k) => (D.levels?.[k] ? `<span class="fs-st" data-s="${esc(k)}" title="${esc(D.levels[k][1] || '')}">${esc(D.levels[k][0])}</span>` : '');

    const KEY = 'molastria-vault';
    const load = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
    const save = (fn) => { try { const v = load(); const m = v[PRODUCT] && typeof v[PRODUCT] === 'object' ? v[PRODUCT] : {}; fn(m); v[PRODUCT] = m; localStorage.setItem(KEY, JSON.stringify(v)); } catch { /* 存不了也不影响阅读 */ } };
    const mine = () => { const v = load()[PRODUCT]; return v && typeof v === 'object' ? v : {}; };
    let seen = (Array.isArray(mine().seen) ? mine().seen : []).filter((id) => chById[id]);
    const progress = () => { const el = $('#chm-progress'); if (el) el.textContent = L(`已读 ${seen.length} / ${order.length} 章`, `${seen.length} of ${order.length} chapters read`); };
    const markSeen = (id) => {
      if (seen.includes(id)) return;
      seen.push(id); save((m) => { m.seen = seen.slice(); });
      try { window.MolAstriaActivity?.('read'); } catch { /* 学习记录是可选的 */ }
      document.querySelector(`.chm-ch[data-open="${id}"]`)?.classList.add('is-seen'); progress();
    };

    // 页面骨架
    const sec = (id, h, note, body) => `<section translate="no" class="fs-block" id="${id}" aria-labelledby="${id}-h" tabindex="-1"><h2 id="${id}-h">${esc(h)}</h2>${note ? `<p class="muted">${note}</p>` : ''}${body}</section>`;
    const JUMP = [['chm-map', L(`${order.length} 章`, `${order.length} chapters`), 1], ['chm-reader', L('开始读', 'Start reading')], ['chm-labs', L('全部演示', 'All demos')], ['chm-history', L('时间线', 'Timeline')], ['chm-quiz', L('自测', 'Self-test')], ['chm-path', L('读什么', 'Reading')], ['chm-library', L('文献', 'References')]];
    root.innerHTML = `<section translate="no" class="fs-hero" aria-labelledby="chm-h1">
        <p class="vlt-owner">${L('已解锁', 'Unlocked')} · ${esc(acct.cached()?.email || '')}</p>
        <p class="eyebrow">${esc(D.eyebrow || '')}</p>
        <h1 id="chm-h1">${D.h1 || esc(D.title)}</h1>
        ${D.question ? `<blockquote class="fs-question">${D.question}</blockquote>` : ''}
        <p class="lead">${D.lead || ''}</p>
        ${D.scope ? `<p class="chm-scope">${D.scope}</p>` : ''}
        <ul class="fs-legend">${Object.keys(D.levels || {}).map((k) => `<li>${lvl(k)}<span>${esc(D.levels[k][1])}</span></li>`).join('')}</ul>
        <nav class="fs-jump">${JUMP.map(([id, t, primary]) => `<a class="button${primary ? ' primary' : ''}" href="#${id}">${esc(t)}${primary ? ' <i class="ico-ext ico-down" aria-hidden="true"></i>' : ''}</a>`).join('')}</nav>
      </section>`
      + sec('chm-map', L(`${order.length} 章`, `${order.length} chapters`), D.notes?.map || '', '<p class="chm-progress" id="chm-progress" aria-live="polite"></p><div id="chm-chapters"></div>')
      + `<section translate="no" class="fs-block fs-reader" id="chm-reader" aria-labelledby="chm-reader-h" tabindex="-1"><h2 id="chm-reader-h">${L('阅读与演示', 'Read and experiment')}</h2>
        <div class="chm-bar"><button type="button" class="button" id="chm-prev" aria-label="${L('上一章', 'Previous chapter')}"><i class="ico-ext ico-left" aria-hidden="true"></i></button><select id="chm-select" aria-label="${L('选择一章', 'Choose a chapter')}"></select><button type="button" class="button" id="chm-next" aria-label="${L('下一章', 'Next chapter')}"><i class="ico-ext ico-right" aria-hidden="true"></i></button></div>
        <div id="chm-panel"></div></section>`
      + sec('chm-labs', L('全部演示', 'All demos'), L('每个演示都在浏览器里当场计算，不是预先画好的动画。点一个就打开它所在的那一章。', 'Every demo is computed live in the browser, not a pre-drawn animation. Click one to open the chapter it belongs to.'), '<ul class="chm-demo-list" id="chm-demo-list"></ul>')
      + sec('chm-history', L('时间线', 'Timeline'), D.notes?.history || '', '<ol class="chm-timeline" id="chm-timeline"></ol>')
      + sec('chm-quiz', L('自测', 'Self-test'), L('先自己选，再看解析。答对的题记在这台设备上。', 'Choose first, then read the explanation. Correct answers are remembered on this device.'), '<p class="chm-score" id="chm-score" aria-live="polite"></p><div class="chm-quiz" id="chm-quiz-list"></div>')
      + sec('chm-path', L('读什么、怎么读', 'What to read, and in what order'), D.notes?.path || '', `<ul class="chm-books" id="chm-books"></ul>${D.open?.length ? `<h3 class="fs-sub-h">${L('还没解决的问题', 'Open questions')}</h3><ol class="chm-open" id="chm-open-list"></ol>` : ''}`)
      + sec('chm-library', L('参考文献', 'References'), D.notes?.library || '', '<div class="fs-kind-filter" role="group" id="chm-ref-filter"></div><p class="muted" id="chm-ref-count" aria-live="polite"></p><ol class="fs-refs" id="chm-refs"></ol>');

    // 章节地图（可以分组）
    const card = (id) => { const c = chById[id]; return `<a class="chm-ch${seen.includes(id) ? ' is-seen' : ''}" href="#c-${id}" data-open="${id}"><span class="chm-ch-n">${c.n}</span><span class="chm-ch-t">${c.title}</span><span class="chm-ch-s">${c.summary || ''}</span>${lvl(c.level)}</a>`; };
    $('#chm-chapters').innerHTML = (D.groups?.length ? D.groups : [{ ids: order }]).map((g) => `${g.title ? `<h3 class="vlt-group">${esc(g.title)}</h3>` : ''}<div class="chm-chapters">${g.ids.filter((id) => chById[id]).map(card).join('')}</div>`).join('');
    progress();

    // ── 画图工具（和化学学科馆的阅读器是同一套）──────────────────────────
    const css = () => { const s = getComputedStyle(document.documentElement), g = (n) => s.getPropertyValue(n).trim(); return { ink: g('--ink'), ink2: g('--ink-2'), muted: g('--muted'), faint: g('--faint'), line: g('--line'), accent: g('--accent-text'), gold: g('--gold'), info: g('--info'), warn: g('--warn'), ok: g('--ok'), danger: g('--danger'), paper: g('--paper'), surface: g('--surface'), violet: g('--violet') }; };
    function fit(cv) {
      const ratio = Number(cv.dataset.ratio), w = Math.max(200, cv.clientWidth || cv.parentElement.clientWidth), h = Math.round(w * Math.max(ratio, w < 420 ? Math.min(0.75, ratio * 1.35) : 0)), dpr = Math.min(2, window.devicePixelRatio || 1);
      if (cv.width !== Math.round(w * dpr) || cv.height !== Math.round(h * dpr)) { cv.width = Math.round(w * dpr); cv.height = Math.round(h * dpr); }
      const ctx = cv.getContext('2d');
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0); ctx.clearRect(0, 0, w, h);
      return { ctx, w, h };
    }
    const sup = (s) => String(s).replace(/[-0-9]/g, (ch) => '⁻⁰¹²³⁴⁵⁶⁷⁸⁹'['-0123456789'.indexOf(ch)]);
    const fmt = (v, d = 3) => (!Number.isFinite(v) ? (Number.isNaN(v) ? '—' : v > 0 ? '∞' : '−∞') : v === 0 ? '0' : Math.abs(v) >= 1e5 || Math.abs(v) < 1e-3 ? v.toExponential(d - 1).replace(/e\+?(-?)(\d+)/, (_, s, e) => ` × 10${sup(`${s}${e}`)}`).replace('-', '−') : String(Number(v.toPrecision(d))).replace('-', '−'));
    const fix = (v, d = 2) => (Number.isFinite(v) ? v.toFixed(d).replace('-', '−') : '—');
    const pct = (v, d = 1) => `${(100 * v).toFixed(d)} %`;
    const font = (px, w = 500) => `${w} ${px}px ${getComputedStyle(document.body).fontFamily}`;
    const ticks = (a, b, n = 5) => { if (!(b > a)) return [a]; const step = 10 ** Math.floor(Math.log10((b - a) / n)), m = [1, 2, 5, 10].find((k) => (b - a) / (k * step) <= n) * step, out = []; for (let t = Math.ceil(a / m - 1e-9) * m; t <= b + 1e-9; t += m) out.push(Number(t.toPrecision(12))); return out; };
    const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
    function arrow(ctx, x0, y0, x1, y1, color, width = 2) {
      const a = Math.atan2(y1 - y0, x1 - x0), len = Math.hypot(x1 - x0, y1 - y0), hd = Math.min(8, len * 0.45);
      ctx.strokeStyle = color; ctx.fillStyle = color; ctx.lineWidth = width;
      ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
      if (len < 2) return;
      ctx.beginPath(); ctx.moveTo(x1, y1); ctx.lineTo(x1 - hd * Math.cos(a - 0.45), y1 - hd * Math.sin(a - 0.45)); ctx.lineTo(x1 - hd * Math.cos(a + 0.45), y1 - hd * Math.sin(a + 0.45)); ctx.closePath(); ctx.fill();
    }
    // 一张坐标图。o：x/y 范围，xl/yl 轴名，xt/yt 刻度，xf/yf 刻度写法，logx/logy 对数轴（范围写指数），eq 等比例，
    // series：{ xs, ys | pts, color, width, dash, label, fill, sticks, dots, bars, line, alpha }，marks 竖线，hmarks 横线，arrows，texts，bands / hbands 色带，after(g) 自己接着画
    function plot(cv, o) {
      const { ctx, w, h } = fit(cv), c = css();
      let [x0, x1] = o.x, [y0, y1] = o.y;
      const noY = o.yt && !o.yt.length, pad = { l: noY ? 14 : 50, r: 12, t: 26, b: o.xl ? 36 : 22 }, W = w - pad.l - pad.r, Hh = h - pad.t - pad.b;
      if (o.eq) { const sx = (x1 - x0) / W, sy = (y1 - y0) / Hh; if (sx > sy) { const m = (y0 + y1) / 2, half = (sx * Hh) / 2; y0 = m - half; y1 = m + half; } else { const m = (x0 + x1) / 2, half = (sy * W) / 2; x0 = m - half; x1 = m + half; } }
      const tX = o.logx ? (v) => Math.log10(v) : (v) => v, tY = o.logy ? (v) => Math.log10(v) : (v) => v;
      const X = (v) => pad.l + ((tX(v) - x0) / (x1 - x0)) * W, Y = (v) => pad.t + Hh - ((tY(v) - y0) / (y1 - y0)) * Hh;
      const Xr = (t) => pad.l + ((t - x0) / (x1 - x0)) * W, Yr = (t) => pad.t + Hh - ((t - y0) / (y1 - y0)) * Hh;
      const xt = o.xt || (o.logx ? ticks(Math.ceil(x0), Math.floor(x1), 8).filter(Number.isInteger) : ticks(x0, x1, w < 420 ? 4 : 6)), yt = o.yt || (o.logy ? ticks(Math.ceil(y0), Math.floor(y1), 6).filter(Number.isInteger) : ticks(y0, y1, 5));
      const pw = (t) => (t === 0 ? '1' : `10${sup(t)}`);
      const xf = o.xf || (o.logx ? pw : (t) => String(t).replace('-', '−')), yf = o.yf || (o.logy ? pw : (t) => String(t).replace('-', '−'));
      for (const b of o.bands || []) { ctx.globalAlpha = b.alpha ?? 0.12; ctx.fillStyle = b.color; const a = X(b.x0), z = X(b.x1); ctx.fillRect(Math.min(a, z), pad.t, Math.abs(z - a), Hh); ctx.globalAlpha = 1; }
      for (const b of o.hbands || []) { ctx.globalAlpha = b.alpha ?? 0.12; ctx.fillStyle = b.color; const a = Y(b.y0), z = Y(b.y1); ctx.fillRect(pad.l, Math.min(a, z), W, Math.abs(z - a)); ctx.globalAlpha = 1; }
      ctx.strokeStyle = c.line; ctx.lineWidth = 1; ctx.fillStyle = c.muted; ctx.font = font(11);
      let lastX = -1e9;
      for (const t of xt) { if (t < x0 - 1e-9 || t > x1 + 1e-9) continue; ctx.beginPath(); ctx.moveTo(Xr(t), pad.t); ctx.lineTo(Xr(t), pad.t + Hh); ctx.stroke(); const lab = String(xf(t)), wd = ctx.measureText(lab).width; if (Math.abs(Xr(t) - lastX) > wd + 6) { ctx.textAlign = Xr(t) + wd / 2 > w - 2 ? 'right' : 'center'; ctx.fillText(lab, Xr(t), pad.t + Hh + 14); lastX = Xr(t); } }
      for (const t of yt) { if (t < y0 - 1e-9 || t > y1 + 1e-9) continue; ctx.beginPath(); ctx.moveTo(pad.l, Yr(t)); ctx.lineTo(pad.l + W, Yr(t)); ctx.stroke(); ctx.textAlign = 'right'; ctx.fillText(yf(t), pad.l - 6, Yr(t) + 4); }
      ctx.strokeStyle = c.ink2; ctx.beginPath(); ctx.moveTo(pad.l, pad.t); ctx.lineTo(pad.l, pad.t + Hh); ctx.lineTo(pad.l + W, pad.t + Hh); ctx.stroke();
      ctx.fillStyle = c.ink2; ctx.textAlign = 'center';
      if (o.xl) ctx.fillText(o.xl, pad.l + W / 2, h - 5);
      if (o.yl && !noY) { ctx.save(); ctx.translate(11, pad.t + Hh / 2); ctx.rotate(-Math.PI / 2); ctx.fillText(o.yl, 0, 0); ctx.restore(); }
      ctx.save(); ctx.beginPath(); ctx.rect(pad.l, pad.t, W, Hh); ctx.clip();
      const base = o.logy ? 10 ** y0 : Math.min(Math.max(0, y0), y1);
      for (const s of o.series || []) {
        const xs = s.pts ? s.pts.map((p) => p[0]) : s.xs, ys = s.pts ? s.pts.map((p) => p[1]) : s.ys;
        ctx.globalAlpha = s.alpha ?? 1;
        if (s.bars) { ctx.fillStyle = s.color; xs.forEach((x, i) => { const a = X(x - s.bars / 2), b = X(x + s.bars / 2), t = Y(ys[i]), z = Y(s.base ?? base); ctx.fillRect(a, Math.min(t, z), Math.max(1, b - a - 1), Math.abs(z - t)); }); ctx.globalAlpha = 1; continue; }
        if (s.sticks) { ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; xs.forEach((x, i) => { ctx.beginPath(); ctx.moveTo(X(x), Y(s.base ?? base)); ctx.lineTo(X(x), Y(ys[i])); ctx.stroke(); }); ctx.globalAlpha = 1; continue; }
        if (s.dots) { ctx.fillStyle = s.color; xs.forEach((x, i) => { if (!Number.isFinite(ys[i])) return; ctx.beginPath(); ctx.arc(X(x), Y(ys[i]), s.dots, 0, 2 * Math.PI); ctx.fill(); }); ctx.globalAlpha = 1; if (!s.line) continue; }
        ctx.beginPath();
        let pen = false;
        xs.forEach((x, i) => { const y = ys[i]; if (!Number.isFinite(y) || (o.logy && y <= 0)) { pen = false; return; } if (pen) ctx.lineTo(X(x), Y(y)); else { ctx.moveTo(X(x), Y(y)); pen = true; } });
        if (s.fill) { ctx.lineTo(X(xs[xs.length - 1]), Y(base)); ctx.lineTo(X(xs[0]), Y(base)); ctx.closePath(); ctx.globalAlpha = 0.2; ctx.fillStyle = s.color; ctx.fill(); ctx.globalAlpha = s.alpha ?? 1; }
        ctx.setLineDash(s.dash || []); ctx.strokeStyle = s.color; ctx.lineWidth = s.width || 2; ctx.stroke(); ctx.setLineDash([]); ctx.globalAlpha = 1;
      }
      for (const m of o.hmarks || []) { ctx.strokeStyle = m.color; ctx.setLineDash(m.dash || [4, 4]); ctx.beginPath(); ctx.moveTo(pad.l, Y(m.y)); ctx.lineTo(pad.l + W, Y(m.y)); ctx.stroke(); ctx.setLineDash([]); }
      for (const m of o.marks || []) {
        ctx.strokeStyle = m.color; ctx.setLineDash([4, 4]); ctx.beginPath(); ctx.moveTo(X(m.x), pad.t); ctx.lineTo(X(m.x), pad.t + Hh); ctx.stroke(); ctx.setLineDash([]);
        if (m.y !== undefined && Number.isFinite(m.y)) { ctx.fillStyle = m.color; ctx.beginPath(); ctx.arc(X(m.x), Y(m.y), 4.5, 0, 2 * Math.PI); ctx.fill(); }
      }
      for (const a of o.arrows || []) arrow(ctx, X(a.from[0]), Y(a.from[1]), X(a.to[0]), Y(a.to[1]), a.color, a.width || 2);
      ctx.font = font(11, 600);
      for (const t of o.texts || []) { ctx.fillStyle = t.color || c.ink; ctx.textAlign = t.align || 'left'; ctx.fillText(t.s, X(t.x) + (t.dx || 0), Y(t.y) + (t.dy || 0)); }
      if (o.after) o.after({ ctx, X, Y, w, h, c, pad, W, H: Hh });
      ctx.restore();
      let lx = pad.l, ly = 14;
      ctx.font = font(11);
      for (const s of (o.series || []).filter((q) => q.label)) {
        const wd = 26 + ctx.measureText(s.label).width;
        if (lx + wd > w - 4 && lx > pad.l) break;
        if (s.dots && !s.line) { ctx.fillStyle = s.color; ctx.beginPath(); ctx.arc(lx + 8, ly - 4, 3.5, 0, 2 * Math.PI); ctx.fill(); } else if (s.bars) { ctx.fillStyle = s.color; ctx.fillRect(lx + 2, ly - 9, 12, 9); } else { ctx.strokeStyle = s.color; ctx.lineWidth = 2.2; ctx.setLineDash(s.dash || []); ctx.beginPath(); ctx.moveTo(lx, ly - 4); ctx.lineTo(lx + 16, ly - 4); ctx.stroke(); ctx.setLineDash([]); }
        ctx.fillStyle = c.ink; ctx.textAlign = 'left'; ctx.fillText(s.label, lx + 20, ly);
        lx += wd + 8;
      }
    }
    // 格子图：rows 是一行行的数，color(v, 行, 列) 给颜色；用来画时空图
    function cells(cv, rows, color, o = {}) {
      const { ctx, w, h } = fit(cv), n = rows[0]?.length || 1, m = o.rows || rows.length, cw = w / n, chh = h / m;
      rows.forEach((r, j) => { for (let i = 0; i < n; i++) { const col = color(r[i], j, i); if (!col) continue; ctx.fillStyle = col; ctx.fillRect(Math.floor(i * cw), Math.floor(j * chh), Math.ceil(cw), Math.ceil(chh)); } });
      return { ctx, w, h, cw, ch: chh };
    }
    const box = (t, sub, cls = '') => `<div class="chm-box${cls ? ` ${cls}` : ''}"><b>${esc(t)}</b>${sub !== undefined && sub !== '' ? `<span>${esc(sub)}</span>` : ''}</div>`;
    const flow = (...xs) => `<div class="chm-flow">${xs.join('<i class="ico-ext ico-right chm-arr" aria-hidden="true"></i>')}</div>`;
    const table = (head, rows, on = -1) => `<div class="chm-wrap"><table class="chm-table"><thead><tr>${head.map((x) => `<th>${esc(x)}</th>`).join('')}</tr></thead><tbody>${rows.map((r, i) => `<tr${i === on ? ' class="is-on"' : ''}>${r.map((x) => (typeof x === 'number' ? `<td class="num">${esc(fmt(x))}</td>` : `<td${/^[−+\-\d.,\s×⁰¹²³⁴⁵⁶⁷⁸⁹⁻%]+$/.test(String(x)) ? ' class="num"' : ''}>${esc(x)}</td>`)).join('')}</tr>`).join('')}</tbody></table></div>`;

    // ── 演示 ──────────────────────────────────────────────────────────────
    // 每个演示：title，kind，intro，ctl 滑块 [键, 名字, 最小, 最大, 步长, 初值, 写法]，sel 下拉 [键, 名字, [[值, 名字]…], 初值]，chk 开关 [键, 名字, 初值]，
    // btn 预设 [名字, { 键: 值 }]，act 动作 [名字, (s) => …]，figs 图 [高宽比 | 'html', 图注]，stack 控件放到图上面，note 模型说明，
    // draw(s, 图, 颜色) 画图并返回读数 [[名字, 值, 是否加粗]]；有 tick(s) 的演示多一个“播放”按钮，每秒调 fps 次，返回 false 就停。
    const DEMOS = {};
    const K = { en, L, tx, esc, fmt, fix, pct, plot, cells, fit, arrow, css, font, ticks, lin, sup, box, flow, table, reduced };
    try { new Function('K', 'DEMOS', code)(K, DEMOS); } catch (err) { console.error('[vault] demos', err); }
    let live = [];
    function demoHTML(id, n) {
      const d = DEMOS[id];
      if (!d) return '';
      const u = `d${n}`;
      const ctl = (d.ctl || []).map(([k, lab, min, max, step, v]) => `<label>${esc(tx(lab))}<span><input type="range" data-k="${k}" id="${u}-${k}" min="${min}" max="${max}" step="${step}" value="${v}"><output for="${u}-${k}"></output></span></label>`).join('');
      const sel = (d.sel || []).map(([k, lab, opts, v]) => `<label>${esc(tx(lab))}<span><select data-k="${k}">${opts.map(([val, t]) => `<option value="${esc(val)}"${String(val) === String(v) ? ' selected' : ''}>${esc(tx(t))}</option>`).join('')}</select></span></label>`).join('');
      const chk = (d.chk || []).map(([k, lab, v]) => `<label class="chm-check"><input type="checkbox" data-k="${k}"${v ? ' checked' : ''}><span>${esc(tx(lab))}</span></label>`).join('');
      const btn = [d.tick ? `<button type="button" class="button primary" data-play aria-pressed="false">${L('播放', 'Play')}</button>` : '', ...(d.btn || []).map(([lab], i) => `<button type="button" class="button" data-preset="${i}">${esc(tx(lab))}</button>`), ...(d.act || []).map(([lab], i) => `<button type="button" class="button" data-act="${i}">${esc(tx(lab))}</button>`)].join('');
      const figs = (d.figs || []).map(([ratio, cap], i) => (ratio === 'html' ? `<div class="chm-html" data-fig="${i}"></div>` : `<figure class="fs-figure"><canvas data-fig="${i}" data-ratio="${ratio}" width="720" height="${Math.round(720 * ratio)}" role="img" aria-label="${esc(tx(cap))}"></canvas><figcaption>${esc(tx(cap))}</figcaption></figure>`)).join('');
      const kind = D.demoKinds?.[d.kind || 'model'] || ['', ''];
      return `<article class="fs-demo chm-demo" data-demo="${id}" id="demo-${id}">
        <header><p class="fs-demo-n">${L('演示', 'Demo')}${kind[0] ? `<span class="fs-st" data-s="${esc(d.kind || 'model')}" title="${esc(kind[1])}">${esc(kind[0])}</span>` : ''}</p><h4>${esc(tx(d.title))}</h4>${d.intro ? `<p class="muted">${esc(tx(d.intro))}</p>` : ''}</header>
        <div class="fs-demo-body${d.stack ? ' chm-stack' : ''}"><div class="fs-controls">${sel}${ctl}${chk}${btn ? `<div class="fs-btns">${btn}</div>` : ''}<dl class="fs-readout" aria-live="polite"></dl></div><div class="chm-figs">${figs}</div></div>
        ${d.note ? `<details class="fs-notes"><summary>${L('模型说明与局限', 'About the model and its limits')}</summary><p>${esc(tx(d.note))}</p></details>` : ''}
      </article>`;
    }
    function mountDemo(el) {
      const id = el.dataset.demo, d = DEMOS[id], s = { ...(d.state ? (typeof d.state === 'function' ? d.state() : d.state) : {}) };
      for (const [k, , , , , v] of d.ctl || []) s[k] = v;
      for (const [k, , , v] of d.sel || []) s[k] = String(v);
      for (const [k, , v] of d.chk || []) s[k] = !!v;
      const figs = [...el.querySelectorAll('[data-fig]')], read = el.querySelector('.fs-readout'), playBtn = el.querySelector('[data-play]');
      const draw = () => {
        for (const [k, , , , , , f] of d.ctl || []) { const inp = el.querySelector(`input[data-k="${k}"]`); inp.value = s[k]; inp.nextElementSibling.textContent = f ? f(s[k]) : fmt(s[k]); }
        for (const [k] of d.sel || []) el.querySelector(`select[data-k="${k}"]`).value = s[k];
        for (const [k] of d.chk || []) el.querySelector(`input[type=checkbox][data-k="${k}"]`).checked = s[k];
        let rows = [];
        try { rows = d.draw(s, figs, css()) || []; } catch (err) { console.error(`[vault] demo ${id}`, err); }
        if (read) { read.innerHTML = rows.map(([k, v, big]) => `<dt>${esc(tx(k))}</dt><dd${big ? ' class="fs-big"' : ''}>${v}</dd>`).join(''); read.hidden = !rows.length; }
      };
      let q = 0, timer = 0;
      const later = () => { cancelAnimationFrame(q); q = requestAnimationFrame(draw); };
      const stop = () => { clearInterval(timer); timer = 0; if (playBtn) { playBtn.textContent = L('播放', 'Play'); playBtn.setAttribute('aria-pressed', 'false'); } };
      const play = () => { if (timer) { stop(); return; } playBtn.textContent = L('暂停', 'Pause'); playBtn.setAttribute('aria-pressed', 'true'); timer = setInterval(() => { if (!el.isConnected || document.hidden) { if (!el.isConnected) stop(); return; } let go = true; try { go = d.tick(s) !== false; } catch (err) { console.error(`[vault] demo ${id}`, err); go = false; } draw(); if (!go) stop(); }, 1000 / (d.fps || 8)); };
      el.addEventListener('input', (e) => { const k = e.target.dataset.k; if (!k) return; s[k] = e.target.type === 'checkbox' ? e.target.checked : e.target.tagName === 'SELECT' ? e.target.value : Number(e.target.value); d.changed?.(s, k); later(); });
      el.addEventListener('change', (e) => { if (e.target.tagName === 'SELECT' && e.target.dataset.k) { s[e.target.dataset.k] = e.target.value; d.changed?.(s, e.target.dataset.k); later(); } });
      el.addEventListener('click', (e) => {
        const b = e.target.closest('button');
        if (!b || !el.contains(b)) return;
        if (b.hasAttribute('data-play')) play();
        else if (b.dataset.preset) { Object.assign(s, d.btn[b.dataset.preset][1]); d.changed?.(s, ''); draw(); }
        else if (b.dataset.act) { d.act[b.dataset.act][1](s); draw(); }
      });
      d.changed?.(s, '');
      draw();
      later.stop = stop;
      return later;
    }

    // ── 一章 ──────────────────────────────────────────────────────────────
    const block = (b) => (b.p ? `<p>${b.p}</p>` : b.h ? `<h4>${b.h}</h4>` : b.list ? `<ul>${b.list.map((x) => `<li>${x}</li>`).join('')}</ul>` : b.steps ? `<ol>${b.steps.map((x) => `<li>${x}</li>`).join('')}</ol>`
      : b.quote ? `<blockquote>${b.quote}${b.by ? `<footer>${b.by}</footer>` : ''}</blockquote>` : b.note ? `<div class="vlt-note" data-k="${esc(b.kind || 'info')}">${b.note}</div>`
      : b.table ? `<figure class="vlt-table"><div class="chm-wrap"><table class="chm-table"><thead><tr>${b.table.head.map((x) => `<th>${x}</th>`).join('')}</tr></thead><tbody>${b.table.rows.map((r) => `<tr>${r.map((x) => `<td>${x}</td>`).join('')}</tr>`).join('')}</tbody></table></div>${b.table.cap ? `<figcaption>${b.table.cap}</figcaption>` : ''}</figure>`
      : b.math ? `<div class="fs-formulas"><figure><div class="fs-formula" tabindex="0">${b.math}</div>${b.cap ? `<figcaption>${b.cap}</figcaption>` : ''}</figure></div>` : b.demo ? `<!--demo:${esc(b.demo)}-->` : '');
    const selEl = $('#chm-select');
    selEl.innerHTML = order.map((id) => `<option value="${id}">${chById[id].n} · ${chById[id].title}</option>`).join('');
    let current = null, ticket = 0;
    async function open(id, { scroll = false, push = true, auto = false } = {}) {
      const c = Object.hasOwn(chById, id) ? chById[id] : null;
      if (!c) return false;
      current = id; selEl.value = id;
      for (const f of live) f.stop?.();
      live = [];
      const my = ++ticket, pane = $('#chm-panel');
      if (push) history.replaceState(null, '', `#c-${id}`);
      if (scroll) $('#chm-reader').scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' });
      if (!cache.has(`c-${id}`)) pane.innerHTML = `<p class="vlt-loading">${L('正在取这一章…', 'Fetching this chapter…')}</p>`;
      let ch;
      try { ch = await part(`c-${id}`); } catch (err) { if (my === ticket) pane.innerHTML = `<p class="vlt-loading">${esc(err.message)} <button type="button" class="button" id="vlt-again">${L('再试一次', 'Try again')}</button></p>`; if (err.status === 401 || err.status === 402) boot(); return false; }
      if (my !== ticket) return false;
      const i = order.indexOf(id), prev = order[i - 1], next = order[i + 1], ex = ch.example;
      let nDemo = 0;
      const inBody = new Set((ch.body || []).filter((b) => b.demo).map((b) => b.demo));
      const body = (ch.body || []).map(block).join('').replace(/<!--demo:([\w-]+)-->/g, (_, x) => `</div>${demoHTML(x, nDemo++)}<div class="chm-prose">`);
      pane.innerHTML = `<article class="chm-topic" lang="${en ? 'en' : 'zh-CN'}">
        <header class="chm-topic-head"><p class="chm-crumb"><span>${esc(D.title)}</span><span>${L(`第 ${c.n} 章 / 共 ${order.length} 章`, `Chapter ${c.n} of ${order.length}`)}</span></p>
          <h3 id="chm-topic-h" tabindex="-1"><span class="chm-topic-n">${c.n}</span>${c.title} ${lvl(c.level)}</h3></header>
        <div class="chm-prose">${body}</div>
        ${ch.points?.length ? `<h4 class="fs-sub-h">${L('要点', 'Key points')}</h4><ul class="chm-points">${ch.points.map((p) => `<li><h5>${p.h}${p.st ? lvl(p.st) : ''}</h5><p>${p.p}</p></li>`).join('')}</ul>` : ''}
        ${ch.math?.length ? `<h4 class="fs-sub-h">${L('核心公式', 'Key formulas')}</h4><div class="fs-formulas">${ch.math.map((m) => `<figure><div class="fs-formula" tabindex="0">${m.m}</div>${m.cap ? `<figcaption>${m.cap}</figcaption>` : ''}</figure>`).join('')}</div>` : ''}
        ${(c.demos || []).filter((x) => !inBody.has(x)).map((x) => demoHTML(x, nDemo++)).join('')}
        ${ex ? `<div class="chm-example"><b>${L('例题', 'Worked example')}</b><p>${ex.q}</p><details><summary>${L('看解答', 'Show the solution')}</summary><ol>${ex.steps.map((st) => `<li>${st}</li>`).join('')}</ol><p class="chm-answer">${ex.a}</p></details></div>` : ''}
        ${ch.cites ? `<h4 class="fs-sub-h">${L('本章文献', 'References for this chapter')}</h4><p class="fs-cite">${ch.cites}</p>` : ''}
        <nav class="chm-pager" aria-label="${L('上一章和下一章', 'Previous and next chapter')}">
          ${prev ? `<a class="button" href="#c-${prev}" data-open="${prev}"><i class="ico-ext ico-left" aria-hidden="true"></i> ${chById[prev].n} · ${chById[prev].title}</a>` : '<span></span>'}
          ${next ? `<a class="button primary" href="#c-${next}" data-open="${next}">${chById[next].n} · ${chById[next].title} <i class="ico-ext ico-right" aria-hidden="true"></i></a>` : '<span></span>'}
        </nav></article>`;
      live = [...pane.querySelectorAll('.chm-demo')].map(mountDemo);
      if (!auto) markSeen(id);
      return true;
    }
    selEl.addEventListener('change', () => open(selEl.value));
    $('#chm-prev').addEventListener('click', () => { const i = order.indexOf(current); if (i > 0) open(order[i - 1]); });
    $('#chm-next').addEventListener('click', () => { const i = order.indexOf(current); if (i < order.length - 1) open(order[i + 1]); });
    root.addEventListener('click', (e) => {
      if (e.target.closest('#vlt-again')) { open(current); return; }
      const a = e.target.closest('a[data-open]');
      if (a) { e.preventDefault(); open(a.dataset.open, { scroll: true }).then(() => { if (a.dataset.demo) setTimeout(() => document.getElementById(`demo-${a.dataset.demo}`)?.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'start' }), 60); }); return; }
      const r = e.target.closest('a[data-ref]');
      if (r) { e.preventDefault(); showRef(r.dataset.ref); }
    });
    const redraw = () => { for (const f of live) f(); };
    if ('ResizeObserver' in window) { let w0 = 0; new ResizeObserver(() => { const w = $('#chm-panel')?.clientWidth; if (w && w !== w0) { w0 = w; redraw(); } }).observe($('#chm-panel')); }
    new MutationObserver(redraw).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme', 'style'] });
    matchMedia('(prefers-color-scheme: dark)').addEventListener?.('change', redraw);

    // ── 全部演示、时间线、自测、书目 ──────────────────────────────────────
    $('#chm-demo-list').innerHTML = order.flatMap((id) => (chById[id].demos || []).filter((x) => DEMOS[x]).map((x) => `<li><a href="#c-${id}" data-open="${id}" data-demo="${x}">${esc(tx(DEMOS[x].title))}<small>${chById[id].n} · ${chById[id].title}</small></a></li>`)).join('');
    $('#chm-timeline').innerHTML = (D.milestones || []).map((m) => `<li><span class="chm-year">${esc(m.year)}</span><div><p>${m.text}</p></div></li>`).join('');
    const QUIZ = D.quiz || [];
    const right = new Set((Array.isArray(mine().quiz) ? mine().quiz : []).filter((i) => Number.isInteger(i) && i < QUIZ.length));
    const score = () => { $('#chm-score').textContent = L(`答对过 ${right.size} / ${QUIZ.length} 题`, `${right.size} of ${QUIZ.length} answered correctly`); };
    $('#chm-quiz-list').innerHTML = QUIZ.map((q, i) => `<div class="chm-q" data-q="${i}"><p><b>${i + 1}</b>${q.q}</p>
      <fieldset class="chm-opts"><legend class="chm-sr">${L(`第 ${i + 1} 题的选项`, `Options for question ${i + 1}`)}</legend>${q.opts.map((o, j) => `<label><input type="radio" name="q${i}" value="${j}"><span>${o}</span></label>`).join('')}</fieldset>
      <p class="chm-why" hidden></p></div>`).join('');
    $('#chm-quiz-list').addEventListener('change', (e) => {
      const qb = e.target.closest('.chm-q');
      if (!qb || e.target.type !== 'radio') return;
      const i = Number(qb.dataset.q), q = QUIZ[i], pick = Number(e.target.value), ok = pick === q.a;
      for (const lab of qb.querySelectorAll('label')) { const v = Number(lab.querySelector('input').value); lab.classList.toggle('is-right', v === q.a); lab.classList.toggle('is-wrong', v === pick && !ok); }
      const why = qb.querySelector('.chm-why');
      why.hidden = false;
      why.innerHTML = `<b>${ok ? L('答对了。', 'Correct.') : L('不对。', 'Not quite.')}</b> ${q.why}${q.ch && chById[q.ch] ? ` ${L('详见', 'See')} <a href="#c-${q.ch}" data-open="${q.ch}">${chById[q.ch].n} · ${chById[q.ch].title}</a>` : ''}`;
      if (ok && !right.has(i)) { right.add(i); save((m) => { m.quiz = [...right]; }); try { window.MolAstriaActivity?.('quiz'); } catch { /* 可选 */ } score(); }
    });
    score();
    $('#chm-books').innerHTML = (D.books || []).map((b) => `<li><b>${esc(b.title)}</b><i>${esc(b.authors)}</i><br>${b.note}</li>`).join('');
    if ($('#chm-open-list')) $('#chm-open-list').innerHTML = D.open.map((o) => `<li>${o.q}${o.ch && chById[o.ch] ? `<span class="chm-open-meta"><a href="#c-${o.ch}" data-open="${o.ch}">${chById[o.ch].n} · ${chById[o.ch].title}</a></span>` : ''}</li>`).join('');

    // ── 文献 ──────────────────────────────────────────────────────────────
    const filt = $('#chm-ref-filter');
    const usedCh = order.filter((id) => REFS.some((r) => r.used?.includes(id)));
    filt.innerHTML = `<button type="button" class="fs-chip" data-ch="" aria-pressed="true">${L('全部', 'All')}</button>` + usedCh.map((id) => `<button type="button" class="fs-chip" data-ch="${id}" aria-pressed="false" title="${esc(chById[id].title)}">${chById[id].n}</button>`).join('');
    const where = (r) => (r.doi ? `<a href="https://doi.org/${esc(r.doi)}" target="_blank" rel="noopener noreferrer">doi:${esc(r.doi)} <i class="ico-ext" aria-hidden="true"></i></a>` : '') + (r.arxiv ? `<a href="https://arxiv.org/abs/${esc(r.arxiv)}" target="_blank" rel="noopener noreferrer">arXiv:${esc(r.arxiv)} <i class="ico-ext" aria-hidden="true"></i></a>` : '') + (r.url ? `<a href="${esc(r.url)}" target="_blank" rel="noopener noreferrer">${L('链接', 'Link')} <i class="ico-ext" aria-hidden="true"></i></a>` : '');
    function renderRefs(ch) {
      const list = REFS.filter((r) => !ch || r.used?.includes(ch));
      $('#chm-refs').innerHTML = list.map((r) => `<li class="fs-ref" id="ref-${esc(r.id)}"><span>${esc(r.authors)} (${esc(r.year)}). <span class="fs-ref-title">${esc(r.title)}</span>. <i>${esc(r.journal || '')}</i>${r.vol ? ` ${esc(r.vol)}` : ''}${r.pages ? `, ${esc(r.pages)}` : ''}.</span>
        <div class="fs-ref-meta">${where(r)}${r.used?.length ? `<span>${L('用于', 'Used in')} ${r.used.filter((id) => chById[id]).map((id) => `<a href="#c-${id}" data-open="${id}">${chById[id].n}</a>`).join(', ')}</span>` : ''}${r.note ? `<span>${esc(r.note)}</span>` : ''}</div></li>`).join('');
      $('#chm-ref-count').textContent = L(`显示 ${list.length} / ${REFS.length} 篇`, `${list.length} of ${REFS.length}`);
    }
    filt.addEventListener('click', (e) => { const b = e.target.closest('.fs-chip'); if (!b) return; for (const x of filt.children) x.setAttribute('aria-pressed', x === b); renderRefs(b.dataset.ch); });
    renderRefs('');
    function showRef(id) {
      if (!refById[id]) return;
      if (!document.getElementById(`ref-${id}`)) { for (const x of filt.children) x.setAttribute('aria-pressed', x.dataset.ch === ''); renderRefs(''); }
      const el = document.getElementById(`ref-${id}`);
      if (!el) return;
      history.replaceState(null, '', `#ref-${id}`);
      el.scrollIntoView({ behavior: reduced() ? 'auto' : 'smooth', block: 'center' });
      el.classList.add('flash'); setTimeout(() => el.classList.remove('flash'), 1800);
    }

    // ── 地址 ──────────────────────────────────────────────────────────────
    function route() {
      const m = location.hash.match(/^#c-([\w-]+)$/);
      if (m && chById[m[1]]) { open(m[1], { push: false }).then(() => $('#chm-reader').scrollIntoView({ block: 'start' })); return true; }
      const r = location.hash.match(/^#ref-([\w-]+)$/);
      if (r) setTimeout(() => showRef(r[1]), 80);
      return false;
    }
    window.addEventListener('hashchange', route);
    if (!route()) open(order[0], { push: false, auto: true });
    window.MOLASTRIA_VAULT_READY = true;
  }

  boot();
})();
