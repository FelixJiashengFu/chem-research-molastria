/* 账号页：邮箱验证码登录、订阅状态、AI 托管额度、课题组成员、API key（给程序用的计算接口）、云同步（../sync/sync.js）、VIP 卡（兑换；站长还能生成和收回）。数据来自 ../pay/account.js。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  const en = () => document.documentElement.lang === 'en';
  const A = window.MolAstriaAccount;
  const PAY = window.MOLASTRIA_PAY || {};
  const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  const date = (s) => new Date(s * 1000).toLocaleDateString(en() ? 'en-CA' : 'zh-CN', { year: 'numeric', month: 'long', day: 'numeric' });
  let account = null, pendingEmail = '', pendingCard = '', cardsLoaded = false, missesLoaded = false, fresh = new Set(), digestState = null, digestAsked = false, keysAsked = false, keyRows = null, keyUse = null;

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

    // Pro counts AI by the month; a free account has a small allowance over 24 hours (none when the service turns it off).
    const daily = a.usage?.period === 'day';
    $('quota-card').hidden = !a.pro && !(daily && a.usage.limit > 0);
    $('lapsed-card').hidden = a.pro;
    if (!$('quota-card').hidden) {
      const { asks, limit } = a.usage;
      $('quota-used').textContent = asks;
      $('quota-limit').textContent = limit;
      $('quota-reset').textContent = daily ? T('免费账号 · 从当天第一次提问起 24 小时后重置') : T('每月 1 日重置');
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
    $('digest-card').hidden = false; // free for every account
    $('digest-build').hidden = !a.admin;
    if (!digestAsked) { digestAsked = true; loadDigest(); }
    if (!keysAsked) { keysAsked = true; loadKeys(); }
    if (a.admin && !cardsLoaded) { cardsLoaded = true; loadCards(); }
    $('misses-card').hidden = !a.admin;
    if (a.admin && !missesLoaded) { missesLoaded = true; loadMisses(); }

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
    $('login-h').textContent = T(on ? '用 VIP 卡开通 Pro' : '用邮箱登录');
    $('login-sub').textContent = T(on ? '填你的邮箱和 VIP 卡号，我们会发一个 6 位验证码；验证通过后 Pro 立即生效。' : '我们会给这个邮箱发一个 6 位验证码，不需要密码。没付过款也能登录：免费账号可以订阅每周精选，在线模型每天次数更多，还有少量免配 key 的 AI 问答。付过款的请用付款邮箱。');
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
          : T('验证码会在一分钟内送达，没收到请看看垃圾邮件。'), 'ok');
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
    keysAsked = false;
    keyRows = null;
    keyUse = null;
    $('key-usage').hidden = true;
    $('key-jobs').innerHTML = '';
    $('key-new').hidden = true;
    $('key-value').textContent = '';
    $('key-list').innerHTML = '';
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

  // ── API keys ──────────────────────────────────────────────────────────
  const kmsg = $('key-msg');
  // The names of the calculations, as on the online models page and in the API documentation.
  const JOB_NAME = { sp: '单点能与受力', opt: '几何优化', freq: '振动频率与热化学', conf: '构象搜索', scan: '二面角扫描', md: '分子动力学', rxn: '反应能', ipea: '电离能与电子亲和能', spin: '自旋态能隙', bde: '键解离能', pa: '质子亲和能与去质子化能' };
  const clock = (s) => new Date(s * 1000).toLocaleString(en() ? 'en-CA' : 'zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false });
  /** `r` is what /keys answers: the keys, and (from a service that has it) today's usage and the latest jobs sent with a key. */
  function renderKeys(r) {
    const list = r.keys;
    keyRows = list;
    keyUse = r.usage ? { usage: r.usage, jobs: r.jobs || [] } : null;
    $('key-list').innerHTML = list.length ? list.map((k) => {
      const used = k.last_used ? T(`最近使用 ${date(k.last_used)}`) : T('还没用过');
      const day = k.used_24h ? ` · ${esc(T(`过去 24 小时用了 ${k.used_24h} 次`))}` : '';
      return `<li><code>${esc(k.prefix)}…</code><span class="acct-cardbtns"><button type="button" class="acct-remove" data-key="${esc(k.id)}">${T('撤销')}</button></span>` +
        `<small>${k.name ? `${esc(k.name)} · ` : ''}${esc(T(`${date(k.created)} 生成`))} · ${esc(used)}${day}</small></li>`;
    }).join('') : `<li class="acct-empty">${T('还没有 API key。')}</li>`;
    $('key-usage').hidden = !keyUse;
    if (!keyUse) return;
    const u = keyUse.usage, meter = $('key-usage-meter');
    $('key-usage-line').textContent = u.used
      ? T(`已用 ${u.used} / ${u.limit} 次，网站上算的和用 key 算的加在一起；${clock(u.reset)} 重新计数。`)
      : T(`今天还没用过，每天 ${u.limit} 次，网站上算的和用 key 算的加在一起。`);
    $('key-usage-bar').style.width = `${Math.min(100, (u.used / u.limit) * 100)}%`;
    meter.setAttribute('aria-valuemax', u.limit);
    meter.setAttribute('aria-valuenow', u.used);
    meter.dataset.level = u.remaining <= 0 ? 'out' : u.remaining <= u.limit * 0.1 ? 'low' : '';
    $('key-jobs-box').hidden = !keyUse.jobs.length;
    $('key-jobs').innerHTML = keyUse.jobs.map((j) => {
      const key = j.key_prefix ? `<code translate="no">${esc(j.key_prefix)}…</code>${j.key_name ? `<small translate="no">${esc(j.key_name)}</small>` : ''}` : esc(T('已撤销的 key'));
      return `<tr><td>${esc(clock(j.created))}</td><td class="acct-jobkey">${key}</td><td><code translate="no">${esc(j.model)}</code></td>` +
        `<td>${esc(T(JOB_NAME[j.job] || j.job))}${j.cached ? ` <small>${esc(T('读缓存'))}</small>` : ''}</td><td>${Number(j.cost) || 0}</td></tr>`;
    }).join('');
  }
  function loadKeys() { A.keys().then(renderKeys).catch((err) => say(kmsg, err.message, 'err')); }
  $('key-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    try {
      const r = await A.createKey($('key-name').value.trim());
      $('key-name').value = '';
      $('key-value').textContent = r.key;
      $('key-new').hidden = false;
      renderKeys(r);
      say(kmsg, '');
    } catch (err) { say(kmsg, err.message, 'err'); }
  });
  $('key-copy').addEventListener('click', async () => {
    const key = $('key-value').textContent;
    try { await navigator.clipboard.writeText(key); say(kmsg, T('已复制到剪贴板。'), 'ok'); }
    catch { prompt(T('复制下面的 key：'), key); }
  });
  $('key-list').addEventListener('click', async (e) => {
    const id = e.target.closest('[data-key]')?.dataset.key;
    if (!id) return;
    const k = keyRows.find((x) => x.id === id);
    if (!confirm(T(`撤销 ${k.prefix}…？用这个 key 的程序会立刻失效。`))) return;
    try {
      renderKeys(await A.revokeKey(id));
      if ($('key-value').textContent.startsWith(k.prefix)) { $('key-new').hidden = true; $('key-value').textContent = ''; }
      say(kmsg, T(`已撤销 ${k.prefix}…`), 'ok');
    } catch (err) { say(kmsg, err.message, 'err'); }
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

  // ── words the Network view did not know, across the site (admin) ──────
  const missMsg = $('misses-msg');
  let missRows = [];
  function renderMisses(r) {
    missRows = r.words;
    $('misses-total').textContent = r.total ? T(`共 ${r.total} 个词`) + (r.total > r.words.length ? T(`，这里列出报得最多的 ${r.words.length} 个`) : '') : '';
    $('misses-copy').disabled = $('misses-clear').disabled = !r.words.length;
    $('misses-list').innerHTML = r.words.length ? r.words.map((w) =>
      `<li><code translate="no">${esc(w.q)}</code><span class="acct-cardbtns"><button type="button" class="acct-remove" data-miss="${esc(w.q)}">${T('删掉')}</button></span>` +
      `<small>${T(`报过 ${w.n} 次 · 全文 ${w.hits} 条 · 最近 ${date(w.last)}`)}</small></li>`).join('')
      : `<li class="acct-empty">${T('还没有访客报上来的词。')}</li>`;
  }
  // Before the account service with /admin/net-misses is deployed the page already ships, so a 404 is not an error.
  function loadMisses() { A.netMisses().then(renderMisses).catch((err) => say(missMsg, err.status === 404 ? T('账号服务还没更新，部署之后这里会列出全站没找到的词。') : err.message, err.status === 404 ? '' : 'err')); }
  $('misses-list').addEventListener('click', async (e) => {
    const q = e.target.closest('[data-miss]')?.dataset.miss;
    if (!q) return;
    try { renderMisses(await A.dropNetMiss(q)); say(missMsg, T(`已删掉 ${q}。`), 'ok'); } catch (err) { say(missMsg, err.message, 'err'); }
  });
  $('misses-copy').addEventListener('click', async () => {
    const text = missRows.map((w) => `${w.q}\t${w.n}\t${w.hits}`).join('\n');
    try { await navigator.clipboard.writeText(text); say(missMsg, T('已复制：每行是词、报过的次数、全文命中数。'), 'ok'); }
    catch { prompt(T('复制下面的列表：'), text); }
  });
  $('misses-clear').addEventListener('click', async () => {
    if (!confirm(T('删掉全部报上来的词？删掉后不能恢复。'))) return;
    try { renderMisses(await A.clearNetMisses()); say(missMsg, T('已全部删掉。'), 'ok'); } catch (err) { say(missMsg, err.message, 'err'); }
  });

  // ── cloud sync (../sync/sync.js) ──────────────────────────────────────
  const smsg = $('sync-msg');
  const kb = (n) => (n >= 1024 * 1024 ? `${(n / 1048576).toFixed(n >= 10 * 1048576 ? 0 : 1)} MB` : `${Math.max(n ? 1 : 0, Math.round(n / 1024))} KB`);
  function renderSync() {
    const S = window.MolAstriaSync, C = window.MOLASTRIA_SYNC_CORE;
    if (!S || !C) { $('sync-card').hidden = true; return; }
    $('sync-list').innerHTML = C.KEYS.map((k) => `<li>${esc(en() ? k.en : k.zh)}</li>`).join('');
    const st = S.status(), on = st.on;
    $('sync-toggle').textContent = on ? T('关闭云同步') : T('打开云同步');
    $('sync-toggle').classList.toggle('primary', !on);
    $('sync-now').hidden = !on;
    $('sync-wipe').hidden = !(st.used > 0);
    const when = st.at ? new Date(st.at).toLocaleString(en() ? 'en-CA' : 'zh-CN', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit', hour12: false }) : '';
    const line = !on ? (st.used > 0 ? T(`这台设备没有打开同步。云端还存着 ${kb(st.used)}。`) : T('这台设备没有打开同步。'))
      : st.state === 'syncing' ? T('正在同步……')
      : st.state === 'pro-only' ? T('云同步现在只对 Pro 支持者开放。')
      : st.state === 'error' ? T(`上次没同步成功：${st.error || ''}`)
      : st.state === 'full' ? T(`云端空间已满，有 ${st.full?.length || 0} 份记录没传上去（本机的不受影响）。`)
      : when ? T(`上次同步：${when}。`) : T('还没有同步过。');
    $('sync-line').textContent = line;
    const meter = $('sync-meter');
    meter.hidden = !(st.limit > 0 && (on || st.used > 0));
    if (!meter.hidden) {
      $('sync-bar').style.width = `${Math.min(100, (st.used / st.limit) * 100)}%`;
      meter.setAttribute('aria-valuemax', st.limit);
      meter.setAttribute('aria-valuenow', st.used || 0);
      meter.dataset.level = st.used >= st.limit ? 'out' : st.used > st.limit * 0.9 ? 'low' : '';
      meter.title = T(`已用 ${kb(st.used || 0)} / ${kb(st.limit)}`);
      $('sync-line').textContent = `${line} ${T(`已用 ${kb(st.used || 0)} / ${kb(st.limit)}。`)}`;
    }
  }
  document.addEventListener('molastria:sync', renderSync);
  $('sync-toggle').addEventListener('click', async () => {
    const S = window.MolAstriaSync;
    if (S.on()) { S.disable(); say(smsg, T('这台设备已关闭云同步。本机和云端的记录都还在。'), 'ok'); renderSync(); return; }
    say(smsg, T('正在同步……'));
    const r = await S.enable();
    const st = S.status();
    if (!r) { say(smsg, st.error || T('同步失败，请稍后再试。'), 'err'); if (st.state === 'pro-only') S.disable(); }
    else say(smsg, r.pulled.length ? T(`已打开。从云端取回了 ${r.pulled.length} 份记录，打开相应页面时就能看到。`) : T('已打开。以后这台设备上的学习记录和收藏会自动同步。'), 'ok');
    renderSync();
  });
  $('sync-now').addEventListener('click', async () => {
    const r = await window.MolAstriaSync.now();
    const st = window.MolAstriaSync.status();
    say(smsg, r ? T(`同步好了：取回 ${r.pulled.length} 份，传上 ${r.pushed.length} 份。`) : st.error || T('同步失败，请稍后再试。'), r ? 'ok' : 'err');
  });
  $('sync-wipe').addEventListener('click', async () => {
    if (!confirm(T('删除云端的全部同步数据？本机的记录不动，这台设备的同步会关掉。'))) return;
    try { await window.MolAstriaSync.wipe(); say(smsg, T('云端副本已删除。'), 'ok'); }
    catch (err) { say(smsg, err.message, 'err'); }
    renderSync();
  });

  // Links from the header's account panel: #keys-card, #digest-card, #admin-card, #manage open that part of the page; #vip opens
  // the VIP card field on the sign-in form. The cards are drawn after the account loads, so the jump waits for paint().
  let jumped = false;
  const jump = () => {
    const id = decodeURIComponent(location.hash.slice(1));
    if (jumped || !id) return;
    if (id === 'vip') { if (!$('acct-login').hidden) { jumped = true; cardMode(true); $('login-card').focus(); } return; }
    const el = document.getElementById(id);
    if (el && !el.hidden && el.offsetParent) { jumped = true; requestAnimationFrame(() => el.scrollIntoView({ block: 'start', behavior: 'smooth' })); }
  };
  const painted = paint;
  paint = (a) => { painted(a); renderSync(); jump(); };
  addEventListener('hashchange', () => { jumped = false; jump(); });

  function init() {
    // An invitation link: ?card=VIP-…
    const card = new URLSearchParams(location.search).get('card');
    if (card) { $('login-card').value = card; $('redeem-code').value = card; cardMode(true); }
    if (!A?.enabled) { show('acct-off'); return; }
    if (!A.token()) { show('acct-login'); jump(); return; }
    if (A.cached()) paint(A.cached()); else show('acct-main');
    A.refresh().then((a) => { $('synced').textContent = ''; paint(a); }).catch((err) => {
      if (err.status === 401) { show('acct-login'); say(msg, T('登录已过期，请重新登录。'), 'err'); }
      else if (!account) { show('acct-login'); say(msg, err.message, 'err'); }
      else $('synced').textContent = T('暂时连不上账号服务，这里显示的是上次同步的信息。');
    });
  }
  init();
  // Re-render dates and labels when the language switches without a reload.
  document.addEventListener('chemhub:i18n', () => { if (account) paint(account); if (cardRows.length) renderCards(cardRows); if (keyRows) renderKeys({ keys: keyRows, ...(keyUse || {}) }); if (digestState) renderDigest(); renderSync(); if (!$('card-field').hidden) cardMode(true); });
})();
