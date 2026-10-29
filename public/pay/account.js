/* MolAstria Pro 账号（浏览器端）：付款后自动登录、邮箱验证码登录、订阅与 AI 托管额度。
   服务端是 deploy/account-worker.js，地址来自 pay/config.js 的 accountApi；留空时账号功能显示“正在开通”。
   登录令牌存在本机 localStorage 的 molastria-session；账号摘要缓存在 molastria-account，导航与 AI 助手直接读这份缓存。
   Public API: MolAstriaAccount.{enabled, token(), cached(), refresh(), start(), verify(), fromCheckout(), signOut(), addMember(), removeMember(),
     redeemCard(), and for the site admin cards(), createCards(), revokeCard()} */
(() => {
  'use strict';
  if (window.MolAstriaAccount) return;
  const TOKEN = 'molastria-session', CACHE = 'molastria-account';
  const safe = (fn, fallback) => { try { return fn(); } catch { return fallback; } };
  const cached = () => safe(() => JSON.parse(localStorage.getItem(CACHE) || 'null'), null);
  const token = () => safe(() => localStorage.getItem(TOKEN), '') || '';
  const api = () => String(window.MOLASTRIA_PAY?.accountApi || cached()?.api || '').replace(/\/+$/, '');
  const T = (s) => window.ChemI18n?.t(s) ?? s;

  function store(newToken, account) {
    safe(() => {
      if (newToken) localStorage.setItem(TOKEN, newToken);
      if (account) localStorage.setItem(CACHE, JSON.stringify({ ...account, api: api(), at: Date.now() }));
    });
    document.dispatchEvent(new CustomEvent('molastria:account', { detail: account || cached() }));
    return account;
  }
  function clear() {
    safe(() => { localStorage.removeItem(TOKEN); localStorage.removeItem(CACHE); });
    document.dispatchEvent(new CustomEvent('molastria:account', { detail: null }));
  }

  async function call(path, { method = 'GET', body, auth = true } = {}) {
    const base = api();
    if (!base) throw new Error(T('账号服务正在开通，请稍后再试。'));
    const headers = {};
    if (body) headers['Content-Type'] = 'application/json';
    if (auth) {
      if (!token()) throw Object.assign(new Error(T('请先登录。')), { status: 401 });
      headers.Authorization = `Bearer ${token()}`;
    }
    let res;
    try { res = await fetch(base + path, { method, headers, body: body ? JSON.stringify(body) : undefined }); }
    catch { throw new Error(T('连不上账号服务，请检查网络后重试。')); }
    const j = await res.json().catch(() => ({}));
    if (res.status === 401 && auth) clear();
    if (!res.ok) throw Object.assign(new Error(T(j.error?.message || `请求失败（${res.status}）`)), { status: res.status });
    return j;
  }
  const signedIn = (r) => (r.token ? store(r.token, r.account) : r);
  const updated = (a) => store(null, a);

  window.MolAstriaAccount = {
    get enabled() { return !!api(); },
    token, cached,
    refresh: () => call('/me').then(updated),
    start: (email, card) => call('/auth/start', { method: 'POST', auth: false, body: { email, card: card || undefined, lang: document.documentElement.lang === 'en' ? 'en' : 'zh' } }),
    verify: (email, code) => call('/auth/verify', { method: 'POST', auth: false, body: { email, code } }).then((r) => signedIn(r)),
    fromCheckout: (sessionId) => call('/auth/checkout', { method: 'POST', auth: false, body: { session_id: sessionId } }).then((r) => signedIn(r)),
    signOut: () => (token() ? call('/auth/signout', { method: 'POST' }).catch(() => {}) : Promise.resolve()).finally(clear),
    addMember: (email) => call('/team/members', { method: 'POST', body: { email } }).then(updated),
    removeMember: (email) => call('/team/members', { method: 'DELETE', body: { email } }).then(updated),
    redeemCard: (code) => call('/cards/redeem', { method: 'POST', body: { code } }).then(updated),
    cards: () => call('/admin/cards'),
    createCards: (count, days, note) => call('/admin/cards', { method: 'POST', body: { count, days, note } }),
    revokeCard: (code) => call('/admin/cards', { method: 'DELETE', body: { code } })
  };
})();
