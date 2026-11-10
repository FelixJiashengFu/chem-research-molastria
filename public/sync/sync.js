/* 云同步（浏览器端）：登录后在账号页打开，学习记录和收藏在登录同一账号的设备之间同步。合并规则在 sync-core.js。
   shared-nav.js 在“已登录且打开了同步”时载入这个文件；账号页也会载入它。服务端是账号服务的 /sync（deploy/account-worker.js）。
   什么时候同步：打开页面时、切回这个标签页时、可见时每 90 秒一次；本机的存档改了（每 10 秒看一次）几秒后也同步一次。
   本机的键：molastria-sync（on 打开）、molastria-sync-state（每份存档上次对上云端的样子和游标，跟着账号走）、
   molastria-sync-status（上次同步的时间、空间、出错原因，给顶栏的账号面板看）。
   页面打开时已经把存档读进了内存：同步改了这个页面在用的存档时，页面底部提示刷新；没刷新前页面再写回，按它打开时读到的
   样子合并（sync-core 的 pageBase），所以不会把另一台设备传来的东西覆盖掉。
   Public API: MolAstriaSync.{on(), enable(), disable(), now(), wipe(), status()}；事件 document 'molastria:sync'（detail 是 status）。 */
(() => {
  'use strict';
  if (window.MolAstriaSync) return;
  const C = window.MOLASTRIA_SYNC_CORE;
  if (!C) return;
  const FLAG = 'molastria-sync', STATE = 'molastria-sync-state', STATUS = 'molastria-sync-status';
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  const safe = (fn, d) => { try { return fn(); } catch { return d; } };
  const ls = {
    get: (k) => safe(() => localStorage.getItem(k), null),
    set: (k, v) => safe(() => { if (v == null) localStorage.removeItem(k); else localStorage.setItem(k, v); return true; }, false)
  };
  const account = () => safe(() => (localStorage.getItem('molastria-session') ? JSON.parse(localStorage.getItem('molastria-account') || 'null') : null), null);
  const token = () => ls.get('molastria-session') || '';
  const api = () => String(window.MOLASTRIA_PAY?.accountApi || account()?.api || '').replace(/\/+$/, '');
  const isOn = () => ls.get(FLAG) === 'on';
  // 单文件版和本地文件没有账号服务
  const usable = () => location.protocol !== 'file:' && !!api() && !!token() && !!account();

  // 页面打开时（这个文件载入时）的样子，同步在页面下面改过的存档记在 under
  const loads = Object.fromEntries(C.KEY_NAMES.map((k) => [k, ls.get(k)]));
  const under = new Set();
  const usedHere = (key) => C.pageUses(C.KEYS.find((e) => e.key === key), location.pathname);
  let seen = Object.fromEntries(C.KEY_NAMES.map((k) => [k, loads[k]]));

  let status = safe(() => JSON.parse(ls.get(STATUS) || 'null'), null) || {};
  function setStatus(patch) {
    status = { ...status, ...patch };
    ls.set(STATUS, JSON.stringify(status));
    document.dispatchEvent(new CustomEvent('molastria:sync', { detail: status }));
  }

  async function call(method, arg) {
    const headers = { Authorization: `Bearer ${token()}` };
    let url = `${api()}/sync`, body;
    if (method === 'GET') url += `?since=${encodeURIComponent(arg.since || 0)}`;
    else { headers['Content-Type'] = 'application/json'; body = JSON.stringify(arg); }
    let res;
    try { res = await fetch(url, { method, headers, body, cache: 'no-store' }); }
    catch { throw Object.assign(new Error(T('连不上账号服务，下次再同步。')), { status: 0 }); }
    const j = await res.json().catch(() => ({}));
    if (!res.ok) throw Object.assign(new Error(T(j.error?.message || `同步失败（${res.status}）`)), { status: res.status });
    return j;
  }

  let running = null, again = false;
  function run(reason) {
    if (!isOn() || !usable()) return Promise.resolve(null);
    if (running) { again = true; return running; }
    const job = async () => {
      setStatus({ state: 'syncing' });
      const email = account().email;
      let slim = !!status.slim;
      const io = {
        email, get: ls.get,
        set: (k, v) => { ls.set(k, v); seen[k] = v; },
        loadState: () => safe(() => JSON.parse(ls.get(STATE) || 'null'), null),
        saveState: (s) => {
          if (ls.set(STATE, JSON.stringify(s))) return;
          // 本机空间不够存整份 shadow：只记哈希（合并时退回到“两边的都留下”）
          slim = true;
          const thin = { ...s, keys: Object.fromEntries(Object.entries(s.keys).map(([k, v]) => [k, typeof v.s === 'string' ? { v: v.v, h: C.hash(v.s) } : v])) };
          ls.set(STATE, JSON.stringify(thin));
        },
        call,
        pageBase: (k) => (under.has(k) && usedHere(k) ? loads[k] : undefined),
        touched: (k) => { if (usedHere(k)) { under.add(k); offerReload(); } }
      };
      Object.defineProperty(io, 'slim', { get: () => slim });
      try {
        const r = await C.syncOnce(io);
        for (const k of C.KEY_NAMES) seen[k] = ls.get(k);
        setStatus({ state: r.full.length ? 'full' : 'ok', at: Date.now(), used: r.used, limit: r.limit, pro: r.pro, full: r.full, error: '', slim, email, reason: reason || '' });
        return r;
      } catch (e) {
        if (e.status === 401) { setStatus({ state: 'signed-out', error: e.message }); return null; }
        setStatus({ state: e.status === 403 ? 'pro-only' : 'error', error: e.message, failedAt: Date.now() });
        return null;
      }
    };
    const locked = navigator.locks?.request ? () => navigator.locks.request('molastria-sync', job) : job;
    running = locked().finally(() => {
      running = null;
      if (again) { again = false; setTimeout(() => run('again'), 1500); }
    });
    return running;
  }

  // ── 提示刷新 ────────────────────────────────────────────────────────
  let bar = null;
  function offerReload() {
    if (bar || !document.body) return;
    bar = document.createElement('div');
    bar.className = 'cr-sync-bar';
    bar.setAttribute('role', 'status');
    bar.innerHTML = `<span>${T('其他设备上的学习记录和收藏已经同步过来，刷新后显示。')}</span><button type="button" class="cr-sync-go">${T('刷新')}</button><button type="button" class="cr-sync-x" aria-label="${T('关闭')}">×</button>`;
    bar.querySelector('.cr-sync-go').addEventListener('click', () => location.reload());
    bar.querySelector('.cr-sync-x').addEventListener('click', () => { bar.remove(); });
    document.body.append(bar);
  }

  // ── 什么时候同步 ────────────────────────────────────────────────────
  let timer = 0, lastRun = 0, tick = 0;
  const soon = (ms, why) => { clearTimeout(timer); timer = setTimeout(() => { lastRun = Date.now(); run(why); }, ms); };
  function start() {
    if (tick || !isOn()) return;
    soon(300, 'open');
    tick = setInterval(() => {
      if (!isOn()) return;
      if (document.visibilityState !== 'visible') return;
      if (C.KEY_NAMES.some((k) => ls.get(k) !== seen[k])) { for (const k of C.KEY_NAMES) seen[k] = ls.get(k); soon(3000, 'change'); return; }
      if (Date.now() - lastRun > 90000) soon(0, 'poll');
    }, 10000);
  }
  document.addEventListener('visibilitychange', () => {
    if (!isOn()) return;
    if (document.visibilityState === 'visible' && Date.now() - lastRun > 30000) soon(200, 'visible');
    // 切走前把改过的传上去（来不及也没关系：下次打开时和 shadow 比，照样能发现）
    if (document.visibilityState === 'hidden' && C.KEY_NAMES.some((k) => ls.get(k) !== seen[k])) { lastRun = Date.now(); run('hidden'); }
  });
  // 另一个标签页登录、退出或开关同步
  addEventListener('storage', (e) => { if (e.key === FLAG || e.key === 'molastria-session') { if (isOn()) start(); } });

  window.MolAstriaSync = {
    on: isOn,
    status: () => ({ ...status, on: isOn(), usable: usable() }),
    enable() { ls.set(FLAG, 'on'); start(); lastRun = Date.now(); return run('enable'); },
    disable() {
      ls.set(FLAG, null); ls.set(STATE, null);
      clearInterval(tick); tick = 0; clearTimeout(timer);
      setStatus({ state: 'off', error: '' });
    },
    now() { lastRun = Date.now(); return run('manual'); },
    /** 删掉云端的全部存档并关掉这台设备的同步；本机的存档不动。 */
    async wipe() {
      const r = await call('DELETE', {});
      this.disable();
      setStatus({ state: 'off', used: r.used || 0, at: 0 });
      return r;
    }
  };
  start();
})();
