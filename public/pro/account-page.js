/* 账号页：邮箱验证码登录、订阅状态、AI 托管额度、课题组成员。数据来自 ../pay/account.js。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  const en = () => document.documentElement.lang === 'en';
  const A = window.MolAstriaAccount;
  const PAY = window.MOLASTRIA_PAY || {};
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const date = (s) => new Date(s * 1000).toLocaleDateString(en() ? 'en-CA' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  let account = null, pendingEmail = '';

  const show = (which) => ['acct-off', 'acct-login', 'acct-main'].forEach((id) => { $(id).hidden = id !== which; });
  const say = (el, text, tone = '') => { el.textContent = text; el.className = `co-msg ${tone}`; };

  function planLine(a) {
    if (a.role === 'free') return T('免费账号');
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
    badge.textContent = T({ pro: 'Pro', owner: '课题组', member: '课题组成员', free: '免费' }[a.role] || 'Pro');
    badge.dataset.role = a.role;
    $('plan-line').textContent = planLine(a);
    $('plan-line').classList.toggle('warn', a.status === 'past_due');

    // Members manage nothing; owners and Pro buyers go to Stripe's customer portal.
    const portal = a.role !== 'member' && a.role !== 'free' && PAY.portalUrl;
    $('manage').hidden = a.role === 'member' || a.role === 'free';
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
  function codeStep(on) {
    $('code-field').hidden = !on;
    $('login-back').hidden = !on;
    $('login-email').readOnly = on;
    btn.textContent = T(on ? '登录' : '发送验证码');
    if (!on) { pendingEmail = ''; $('login-code').value = ''; }
  }
  form.addEventListener('submit', async (e) => {
    e.preventDefault();
    btn.disabled = true;
    try {
      if (!pendingEmail) {
        const email = $('login-email').value.trim();
        if (!EMAIL.test(email)) { say(msg, T('邮箱格式不对。'), 'err'); $('login-email').focus(); return; }
        const r = await A.start(email);
        pendingEmail = email;
        codeStep(true);
        say(msg, T('如果这个邮箱有有效的 Pro 订阅，验证码会在一分钟内送达。没收到请看看垃圾邮件，或确认是付款时填写的邮箱。'), 'ok');
        if (r.devCode) $('login-code').value = r.devCode; // local test server only
        $('login-code').focus();
      } else {
        const code = $('login-code').value.replace(/\D/g, '');
        if (code.length !== 6) { say(msg, T('请输入邮件里的 6 位验证码。'), 'err'); $('login-code').focus(); return; }
        paint(await A.verify(pendingEmail, code));
        codeStep(false);
        say(msg, '');
      }
    } catch (err) {
      say(msg, err.message, 'err');
    } finally {
      btn.disabled = false;
    }
  });
  $('login-back').addEventListener('click', () => { codeStep(false); say(msg, ''); $('login-email').focus(); });

  // ── signed in ─────────────────────────────────────────────────────────
  $('open-ai').addEventListener('click', () => window.ChemHub?.loadAI().then((ai) => ai.openDrawer()).catch((e) => alert(e.message)));
  $('signout').addEventListener('click', async () => {
    await A.signOut();
    account = null;
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

  function init() {
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
  document.addEventListener('chemhub:i18n', () => { if (account) paint(account); });
})();
