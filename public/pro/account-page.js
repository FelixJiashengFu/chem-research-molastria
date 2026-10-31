/* 账号页：邮箱验证码登录、订阅状态、AI 托管额度、课题组成员、VIP 卡（兑换；站长还能生成和收回）。数据来自 ../pay/account.js。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  const en = () => document.documentElement.lang === 'en';
  const A = window.MolAstriaAccount;
  const PAY = window.MOLASTRIA_PAY || {};
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const date = (s) => new Date(s * 1000).toLocaleDateString(en() ? 'en-CA' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  let account = null, pendingEmail = '', pendingCard = '', cardsLoaded = false, fresh = new Set(), digestState = null, digestAsked = false;

  const esc = (v) => String(v ?? '').replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`);
  // Pro that comes from a VIP card or the admin grant rather than a Stripe subscription
  const gifted = (a) => !!a.grant && a.role === 'pro' && !a.cycle;
  const show = (which) => ['acct-off', 'acct-login', 'acct-main'].forEach((id) => { $(id).hidden = id !== which; });
  const say = (el, text, tone = '') => { el.textContent = text; el.className = `co-msg ${tone}`; };

  function planLine(a) {
    if (a.role === 'free') return T('免费账号');
    if (gifted(a)) {
      if (a.grant.source === 'admin') return T('站长 · 永久 Pro');
      return a.grant.expires ? T(`VIP 卡 · ${date(a.grant.expires)} 到期`) : T('VIP 卡 · 永久有效');
    }
    const head = a.role === 'member' ? T(`由 ${a.owner} 的课题组版提供`)
      : a.role === 'owner' ? T(`课题组版 · ${a.seats} 席位`)
      : T(a.cycle === 'month' ? 'Pro · 月付' : 'Pro · 年付');
    const when = a.renews ? date(a.renews) : '';
    const tail = a.status === 'past_due' ? T('续费扣款失败，请在订阅管理里更新付款方式')
      : a.status === 'canceling' ? T(`已取消续费，${when} 到期`)
      : a.status === 'trialing' ? T(`试用中，${when} 开始扣费`)
      : when ? T(`${when} 自动续费`) : '';
    return [head, tail].filter(Boolean).join(' · ');
  }

  function paint(a) {
    if (!a) return;
    account = a;
    show('acct-main');
    $('acct-email').textContent = a.email;
    const badge = $('plan-badge');
    const kind = gifted(a) ? (a.grant.source === 'admin' ? 'admin' : 'vip') : a.role;
    badge.textContent = T({ pro: 'Pro', owner: '课题组', member: '课题组成员', free: '免费', vip: 'VIP', admin: '站长' }[kind] || 'Pro');
    badge.dataset.role = kind;
    $('plan-line').textContent = planLine(a);
    $('plan-line').classList.toggle('warn', a.status === 'past_due');

    // Members manage nothing; owners and Pro buyers go to Stripe's customer portal.
    const portal = a.role !== 'member' && a.role !== 'free' && !gifted(a) && PAY.portalUrl;
    $('manage').hidden = a.role === 'member' || a.role === 'free' || gifted(a);
    $('manage-link').hidden = !portal;
    $('manage-text').hidden = !!portal;
    if (portal) { const u = new URL(PAY.portalUrl); u.searchParams.set('prefilled_email', a.email); $('manage-link').href = u.href; }

    $('quota-card').hidden = !a.pro;
    $('lapsed-card').hidden = a.pro;
    if (a.pro) {
      const { asks, limit } = a.usage;
      $('quota-used').textContent = asks;
      $('quota-limit').textContent = limit;
      const share = limit ? Math.min(1, asks / limit) : 1;
      $('quota-bar').style.width = `${(share * 100).toFixed(1)}%`;
      const meter = $('quota-meter');
      meter.setAttribute('aria-valuemax', String(limit));
      meter.setAttribute('aria-valuenow', String(asks));
      meter.dataset.level = share >= 1 ? 'out' : share >= 0.85 ? 'low' : '';
    }

    // A card can be redeemed by a free account, or to extend a card that runs out.
    $('redeem-card').hidden = !(a.role === 'free' || (gifted(a) && a.grant.source === 'card' && a.grant.expires));
    $('admin-card').hidden = !a.admin;
    $('digest-card').hidden = !a.pro;
    $('digest-build').hidden = !a.admin;
    if (a.pro && !digestAsked) { digestAsked = true; loadDigest(); }
    if (a.admin && !cardsLoaded) { cardsLoaded = true; loadCards(); }

    $('team-card').hidden = a.role !== 'owner';
    if (a.role === 'owner') {
      const members = a.members || [];
      const free = Math.max(0, a.seats - 1 - members.length);
      $('team-line').textContent = T(`已用 ${members.length + 1} / ${a.seats} 个席位（含你自己），每位成员每月 ${a.usage.limit} 次 AI 托管额度。成员用自己的邮箱在本页登录。`);
      $('member-list').innerHTML = members.length
        ? members.map((m) => `<li><span>${m.replace(/[&<>"]/g, (c) => `&#${c.charCodeAt(0)};`)}</span><button type="button" class="acct-remove" data-member="${m.replace(/"/g, '&quot;')}">${T('移除')}</button></li>`).join('')
        : `<li class="acct-empty">${T('还没有添加成员。')}</li>`;
      $('member-form').hidden = free === 0;
    }
  }

  // ── sign-in ────────────────────────────────────────────────────────────
  const form = $('login-form'), msg = $('login-msg'), btn = $('login-btn');
  function cardMode(on) {
    $('card-field').hidden = !on;
    $('card-toggle').hidden = on;
    $('login-h').textContent = T(on ? '用 VIP 卡开通 Pro' : '用付款邮箱登录');
    $('login-sub').textContent = T(on ? '填你的邮箱和 VIP 卡号，我们会发一个 6 位验证码；验证通过后 Pro 立即生效。' : '我们会给这个邮箱发一个 6 位验证码，不需要密码。');
    $('login-email').placeholder = T(on ? '你的邮箱' : '付款时填写的邮箱');
  }
  $('card-toggle').addEventListener('click', () => { cardMode(true); $('login-card').focus(); });
  function codeStep(on) {
    $('code-field').hidden = !on;
    $('login-card').readOnly = on;
    $('login-back').hidden = !on;
    $('login-email').readOnly = on;
    btn.textContent = T(on ? '登录' : '发送验证码');
    if (!on) { pendingEmail = ''; pendingCard = ''; $('login-code').value = ''; }
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      if (!pendingEmail) {
        const email = $('login-email').value.trim();
        if (!EMAIL.test(email)) { say(msg, T('邮箱格式不对。'), 'err'); $('login-email').focus(); return; }
        const card = $('card-field').hidden ? '' : $('login-card').value.trim();
        if (!$('card-field').hidden && !card) { say(msg, T('请填写 VIP 卡号。'), 'err'); $('login-card').focus(); return; }
        const r = await A.start(email, card);
        pendingEmail = email;
        pendingCard = card;
        codeStep(true);
        say(msg, card ? T('验证码已发到你的邮箱，填进来后 VIP 卡立即生效。没收到请看看垃圾邮件。')
          : T('如果这个邮箱有有效的 Pro 订阅，验证码会在一分钟内送达。没收到请看看垃圾邮件，或确认是付款时填写的邮箱。'), 'ok');
        if (r.devCode) $('login-code').value = r.devCode; // local test server only
        $('login-code').focus();
      } else {
        const code = $('login-code').value.replace(/\D/g, '');
        if (code.length !== 6) { say(msg, T('请输入邮件里的 6 位验证码。'), 'err'); $('login-code').focus(); return; }
        const viaCard = !!pendingCard;
        paint(await A.verify(pendingEmail, code));
        codeStep(false);
        say(msg, '');
        if (viaCard) { cardMode(false); $('login-card').value = ''; say($('redeem-msg'), T('VIP 卡兑换成功，Pro 已开通。'), 'ok'); }
      }
    } catch (err) {
      say(msg, err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  });
  $('login-back').addEventListener('click', () => { codeStep(false); say(msg, ''); $('login-email').focus(); });

  // ── signed in ─────────────────────────────────────────────────────────
  $('open-ai').addEventListener('click', () => window.ChemHub?.loadAI().then((ai) => ai.openDrawer({ provider: 'hosted' })).catch((e) => alert(e.message)));
  document.addEventListener('molastria:account', (e) => { if (account && e.detail) paint(e.detail); }); // e.g. quota used in the AI drawer
  $('signout').addEventListener('click', async () => {
    await A.signOut();
    account = null;
    digestState = null;
    digestAsked = false;
    show('acct-login');
    say(msg, T('已退出登录。'), 'ok');
  });
  const mmsg = $('member-msg');
  $('member-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const email = $('member-email').value.trim();
    if (!EMAIL.test(email)) { say(mmsg, T('邮箱格式不对。'), 'err'); return; }
    try {
      paint(await A.addMember(email));
      $('member-email').value = '';
      say(mmsg, T(`已添加 ${email}，我们给 TA 发了一封邀请邮件。`), 'ok');
    } catch (err) { say(mmsg, err.message, 'err'); }
  });
  $('member-list').addEventListener('click', async (e) => {
    const b = e.target.closest('[data-member]');
    if (!b) return;
    const email = b.dataset.member;
    if (!confirm(T(`移除 ${email}？TA 将立即失去 Pro 权益。`))) return;
    try { paint(await A.removeMember(email)); say(mmsg, T(`已移除 ${email}。`), 'ok'); } catch (err) { say(mmsg, err.message, 'err'); }
  });

  // ── weekly picks ──────────────────────────────────────────────────────
  const dmsg = $('digest-msg');
  function renderDigest() {
    const { digest: d, subscribed } = digestState;
    $('digest-toggle').textContent = T(subscribed ? '退订邮件' : '订阅邮件');
    $('digest-toggle').className = subscribed ? 'btn' : 'btn primary';
    $('digest-mail').hidden = !d;
    $('digest-empty').hidden = !!d;
    $('digest-body').hidden = !d;
    if (!d) return;
    $('digest-week').textContent = T(`${d.week} 这一期`);
    $('digest-overview').textContent = (en() ? d.overview_en : d.overview_zh) || '';
    $('digest-list').innerHTML = d.items.map((it) => {
      const why = (en() ? it.why_en : it.why_zh) || '';
      const meta = [it.source, it.date, it.authors].filter(Boolean).join(' · ');
      return `<li><a href="${esc(it.url)}" target="_blank" rel="noopener">${esc(it.title)}</a><small>${esc(meta)}</small>${why ? `<p>${esc(why)}</p>` : ''}</li>`;
    }).join('');
  }
  function loadDigest() { A.digest().then((r) => { digestState = r; renderDigest(); }).catch((err) => say(dmsg, err.message, 'err')); }
  $('digest-toggle').addEventListener('click', async () => {
    try {
      const r = await A.digestSubscribe(!digestState.subscribed);
      digestState.subscribed = r.subscribed;
      renderDigest();
      say(dmsg, r.subscribed ? T(`已订阅，每周一发到 ${account.email}。如果本周这一期已经生成，15 分钟内也会寄出。`) : T('已退订邮件，这里仍然可以看。'), 'ok');
    } catch (err) { say(dmsg, err.message, 'err'); }
  });
  $('digest-mail').addEventListener('click', async () => {
    try { await A.digestSendMe(); say(dmsg, T(`已发到 ${account.email}，没看到的话看看垃圾邮件。`), 'ok'); } catch (err) { say(dmsg, err.message, 'err'); }
  });
  $('digest-build').addEventListener('click', async (e) => {
    e.currentTarget.disabled = true;
    say(dmsg, T('正在生成，大约需要一分钟……'));
    try { digestState.digest = (await A.digestBuild()).digest; renderDigest(); say(dmsg, T('本期已重新生成。'), 'ok'); }
    catch (err) { say(dmsg, err.message, 'err'); }
    finally { $('digest-build').disabled = false; }
  });

  // ── VIP cards ─────────────────────────────────────────────────────────
  const rmsg = $('redeem-msg');
  $('redeem-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const code = $('redeem-code').value.trim();
    if (!code) { say(rmsg, T('请填写 VIP 卡号。'), 'err'); return; }
    try {
      paint(await A.redeemCard(code));
      $('redeem-code').value = '';
      say(rmsg, T('VIP 卡兑换成功，Pro 已开通。'), 'ok');
    } catch (err) { say(rmsg, err.message, 'err'); }
  });

  const cmsg = $('card-msg');
  const span = (days) => {
    if (days == null) return T('永久');
    const [n, zh, unit] = days % 365 === 0 ? [days / 365, '年', 'year'] : days % 30 === 0 ? [days / 30, '个月', 'month'] : [days, '天', 'day'];
    return en() ? `${n} ${unit}${n === 1 ? '' : 's'}` : `${n} ${zh}`;
  };
  const SITE = 'https://molastria.com/pro/account.html';
  const invite = (c) => en()
    ? `Here is a MolAstria VIP card (${span(c.days)} of Pro): ${c.code}\nOpen ${SITE}?card=${c.code}&lang=en, enter your email, and Pro starts as soon as you type in the code we email you.`
    : `送你一张 MolAstria VIP 卡（Pro ${span(c.days)}）：${c.code}\n打开 ${SITE}?card=${c.code} ，填你的邮箱，收到验证码填进去就开通了。`;
  let cardRows = [];
  function renderCards(list) {
    cardRows = list;
    $('card-list').innerHTML = list.length ? list.map((c) => {
      const state = c.revoked ? T('已收回') : c.redeemed_by ? T(`已兑换 · ${c.redeemed_by} · ${date(c.redeemed_at)}`) : T('未使用');
      const used = c.revoked || c.redeemed_by;
      return `<li class="${fresh.has(c.code) ? 'new' : ''}${c.revoked ? ' off' : ''}"><code>${esc(c.code)}</code>` +
        `<span class="acct-cardbtns">${used ? '' : `<button type="button" class="acct-copy" data-copy="${esc(c.code)}">${T('复制邀请')}</button>`}` +
        `${c.revoked ? '' : `<button type="button" class="acct-remove" data-revoke="${esc(c.code)}">${T('收回')}</button>`}</span>` +
        `<small>${esc(span(c.days))} · ${esc(state)}${c.note ? ` · ${esc(c.note)}` : ''}</small></li>`;
    }).join('') : `<li class="acct-empty">${T('还没有发过 VIP 卡。')}</li>`;
  }
  function loadCards() { A.cards().then((r) => renderCards(r.cards)).catch((err) => say(cmsg, err.message, 'err')); }
  $('card-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    const count = Math.round(Number($('card-count').value) || 1);
    if (count < 1 || count > 50) { say(cmsg, T('一次可以生成 1–50 张。'), 'err'); return; }
    const days = $('card-days').value ? Number($('card-days').value) : null;
    try {
      const r = await A.createCards(count, days, $('card-note').value.trim());
      fresh = new Set(r.created);
      renderCards(r.cards);
      say(cmsg, T(`已生成 ${r.created.length} 张，点“复制邀请”发给朋友。`), 'ok');
    } catch (err) { say(cmsg, err.message, 'err'); }
  });
  $('card-list').addEventListener('click', async (e) => {
    const copy = e.target.closest('[data-copy]')?.dataset.copy;
    if (copy) {
      const c = cardRows.find((x) => x.code === copy);
      try { await navigator.clipboard.writeText(invite(c)); say(cmsg, T(`已复制 ${copy} 的邀请文字。`), 'ok'); }
      catch { prompt(T('复制下面的邀请文字：'), invite(c)); }
      return;
    }
    const code = e.target.closest('[data-revoke]')?.dataset.revoke;
    if (!code) return;
    const c = cardRows.find((x) => x.code === code);
    if (!confirm(c?.redeemed_by ? T(`收回 ${code}？${c.redeemed_by} 会立即失去这张卡带来的 Pro 时长。`) : T(`收回 ${code}？收回后这张卡不能再兑换。`))) return;
    try { renderCards((await A.revokeCard(code)).cards); say(cmsg, T(`已收回 ${code}。`), 'ok'); } catch (err) { say(cmsg, err.message, 'err'); }
  });

  function init() {
    // An invitation link: ?card=VIP-…
    const card = new URLSearchParams(location.search).get('card');
    if (card) { $('login-card').value = card; $('redeem-code').value = card; cardMode(true); }
    if (!A?.enabled) { show('acct-off'); return; }
    if (!A.token()) { show('acct-login'); return; }
    if (A.cached()) paint(A.cached()); else show('acct-main');
    A.refresh().then((a) => { $('synced').textContent = ''; paint(a); }).catch((err) => {
      if (err.status === 401) { show('acct-login'); say(msg, T('登录已过期，请重新登录。'), 'err'); }
      else if (!account) { show('acct-login'); say(msg, err.message, 'err'); }
      else $('synced').textContent = T('暂时连不上账号服务，这里显示的是上次同步的信息。');
    });
  }
  init();
  // Re-render dates and labels when the language switches without a reload.
  document.addEventListener('chemhub:i18n', () => { if (account) paint(account); if (cardRows.length) renderCards(cardRows); if (digestState) renderDigest(); if (!$('card-field').hidden) cardMode(true); });
})();
