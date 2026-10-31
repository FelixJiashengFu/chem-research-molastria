/* 价格页：年付 / 月付切换、结账窗口、跳转到托管结账页（Stripe Payment Link 等），以及下载按钮的系统识别。
   收款链接与展示价格都在 ../pay/config.js。 */
(() => {
  'use strict';
  const PAY = window.MOLASTRIA_PAY || { plans: {} };
  const $ = (id) => document.getElementById(id);
  const en = () => document.documentElement.lang === 'en';
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  // Prices are in yuan, as charged by Stripe. English pages mark them CN¥ and add a rough US$ figure.
  const money = (n) => (n == null ? '' : `${en() ? 'CN¥' : '¥'}${Number(n).toLocaleString(en() ? 'en-US' : 'zh-CN')}`);
  const approx = (n) => (en() && n && PAY.usdPerCny ? `≈ US$${Math.round(n * PAY.usdPerCny)}` : '');
  const seatLine = (p) => T(`${p.seats} 个 Pro 席位起，每加 1 席 ${money(p.seatPrice)} / 年，席位数在结账页调整`);
  let billing = 'year';

  const PLANS = {
    pro: () => (billing === 'year' ? 'pro_year' : 'pro_month'),
    team: () => 'team_year',
    sponsor: () => 'sponsor'
  };
  const TITLE = { pro_year: 'MolAstria Pro · 年付早鸟', pro_month: 'MolAstria Pro · 月付', team_year: 'MolAstria 课题组版 · 年付', sponsor: '支持 MolAstria' };
  // Once the account service is configured, the hosted AI quota works right after payment.
  const LIVE = !!PAY.accountApi;
  const SOON = LIVE ? ['AI 托管额度每月 300 次，付款后立即可用', '云同步、每周精选、深度工作流库：开发中，上线后自动开通，暂无确定日期'] : ['AI 托管额度、云同步、每周精选、深度工作流库：开发中，上线后自动开通，暂无确定日期'];
  const ITEMS = {
    pro_year: ['锁定早鸟价，续费不涨价', ...SOON, '14 天内无理由全额退款'],
    pro_month: ['随时取消，当前周期结束后不再续费', ...SOON, '14 天内无理由全额退款'],
    team_year: [...(LIVE ? ['成员用自己的邮箱登录，每个席位每月 300 次 AI 托管额度'] : []), '组内共享资料库与实验室项目：开发中，上线后自动开通，暂无确定日期', 'Stripe 收据可用于报销；需要正式发票请联系我们', '14 天内无理由全额退款'],
    sponsor: ['金额在结账页自行填写', '全部用于服务器、AI 测试与持续开发']
  };
  const METHOD = { card: '银行卡', applepay: 'Apple Pay', googlepay: 'Google Pay', alipay: '支付宝', wechat: '微信支付', paypal: 'PayPal' };

  // Prices on the cards follow the billing switch and the page language.
  function paintPrices() {
    const pro = PAY.plans[PLANS.pro()];
    const set = (sel, v) => document.querySelectorAll(sel).forEach((el) => { el.textContent = v; });
    if (pro) {
      set('[data-price="pro"]', money(pro.price));
      set('[data-period="pro"]', T(billing === 'year' ? '/ 年' : '/ 月'));
      set('[data-list="pro"]', billing === 'year' && pro.list ? money(pro.list) : '');
      set('[data-fx="pro"]', approx(pro.price));
    }
    const team = PAY.plans.team_year;
    if (team) {
      set('[data-price="team"]', money(team.price));
      set('[data-fx="team"]', approx(team.price));
      document.querySelectorAll('[data-seats="team"]').forEach((li) => {
        li.innerHTML = `<b>${T(`${team.seats} 个 Pro 席位起`)}</b>${T(`，每加 1 席 ${money(team.seatPrice)} / 年`)}`;
      });
    }
    set('[data-price="free"]', money(0));
  }
  document.querySelectorAll('[data-billing]').forEach((b) => b.addEventListener('click', () => {
    billing = b.dataset.billing;
    document.querySelectorAll('[data-billing]').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    paintPrices();
  }));

  if (LIVE) document.querySelectorAll('[data-live]').forEach((el) => { el.className = 'st ok'; el.textContent = T('开通即享'); });

  // Contact link.
  const contact = $('contact-link');
  if (contact && PAY.contactEmail) { contact.href = `mailto:${PAY.contactEmail}`; contact.removeAttribute('target'); }

  // Checkout dialog.
  const dlg = $('checkout');
  let current = null;
  function open(kind) {
    current = PLANS[kind]();
    const plan = PAY.plans[current] || {};
    $('co-title').textContent = T(TITLE[current]);
    $('co-price').textContent = plan.price ? money(plan.price) : T('自定金额');
    const fx = approx(plan.price);
    $('co-fx').hidden = !fx;
    $('co-fx').textContent = fx ? `${fx}. Charged in Chinese yuan (CNY); your bank converts it.` : '';
    $('co-period').textContent = plan.period ? T(plan.period === 'year' ? '/ 年' : '/ 月') + (plan.seats ? T(` · ${plan.seats} 席位起`) : '') : T('一次性');
    const items = ITEMS[current].map(T);
    if (plan.seats) items.unshift(seatLine(plan));
    $('co-items').innerHTML = items.map((s) => `<li>${s}</li>`).join('');
    $('co-methods').innerHTML = (PAY.methods || []).map((m) => `<span>${T(METHOD[m] || m)}</span>`).join('');
    $('co-agree').checked = false;
    const live = !!plan.checkoutUrl;
    const test = live && /\/test_/.test(plan.checkoutUrl); // Stripe test-mode links: no real charge
    $('co-pay').disabled = !live;
    if (!live) msg(T('收款通道正在开通，暂时还不能付款。可以先通过页面底部的“联系我们”预约。'), 'err');
    else if (test) msg(T('测试模式：不会真实扣款，可用测试卡 4242 4242 4242 4242 体验付款流程。'), 'warn');
    else msg('');
    dlg.showModal();
    (live ? $('co-email') : dlg.querySelector('[data-close]')).focus();
  }
  function msg(text, tone = '') { const m = $('co-msg'); m.textContent = text; m.className = `co-msg ${tone}`; }
  document.querySelectorAll('[data-checkout]').forEach((b) => b.addEventListener('click', () => open(b.dataset.checkout)));
  dlg.addEventListener('click', (e) => { if (e.target.closest('[data-close]') || e.target === dlg) dlg.close(); });

  $('co-form').addEventListener('submit', (e) => {
    e.preventDefault();
    const plan = PAY.plans[current] || {};
    if (!plan.checkoutUrl) return;
    if (!$('co-agree').checked) { msg(T('请先勾选同意服务条款与退款政策。'), 'err'); $('co-agree').focus(); return; }
    let url;
    try { url = new URL(plan.checkoutUrl); } catch { msg(T('收款链接格式不对，请联系站长。'), 'err'); return; }
    const email = $('co-email').value.trim();
    if (email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { msg(T('邮箱格式不对。'), 'err'); return; }
    // Stripe Payment Links accept a prefilled email, a reference and the page language.
    if (PAY.provider === 'stripe' || /(^|\.)stripe\.com$/.test(url.hostname)) {
      if (email) url.searchParams.set('prefilled_email', email);
      url.searchParams.set('client_reference_id', `${current}-${Date.now().toString(36)}`);
      url.searchParams.set('locale', en() ? 'en' : 'zh');
    }
    // 'noopener' would make window.open return null even on success, so detach the opener by hand.
    const w = window.open(url.href, '_blank');
    if (w) { try { w.opener = null; } catch {} }
    else if (!window.__MOLASTRIA_DESKTOP__) location.href = url.href; // popup blocked: continue in this tab
    msg(T('已在新窗口打开安全结账页。付款完成后会回到本站的确认页，收据会发到你的邮箱。'), 'ok');
  });

  // Highlight the download that matches this computer.
  const ua = navigator.userAgent;
  const os = /Mac|iPhone|iPad/.test(ua) ? 'mac' : /Windows/.test(ua) ? 'win' : '';
  if (os) document.querySelectorAll(`.dl[data-os="${os}"]`).forEach((a) => a.classList.add('mine'));

  paintPrices();
  document.addEventListener('chemhub:i18n', paintPrices);
})();
