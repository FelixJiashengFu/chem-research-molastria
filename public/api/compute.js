/* 开放数据接口说明页的“计算接口”一段：电脑在不在线、带 key 试一次、跟着选择变的代码、计算一览表。
   用的就是文档里写的 /v1 接口（账号服务 deploy/account-worker.js），和别人在自己的脚本里做的一样。
   key 只放在这个页面的内存里：不进 localStorage，不进地址，也不进生成的代码。 */
(() => {
  'use strict';
  const $ = (id) => document.getElementById(id);
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
  const PUBLIC = 'https://api.molastria.com';
  const base = () => String(window.MOLASTRIA_PAY?.accountApi || PUBLIC).replace(/\/+$/, '');

  // The jobs the API offers: id, name (as on the online models page), cost in uses, params. tools/account-test.ts checks the costs against the service.
  const JOBS = [
    ['sp', '单点能与受力', 1, ''],
    ['opt', '几何优化', 1, 'fmax'],
    ['freq', '振动频率与热化学', 3, 'temperature, symmetry'],
    ['conf', '构象搜索', 5, 'n, temperature, window_kcal'],
    ['scan', '二面角扫描', 5, 'atoms*, start, end, points'],
    ['md', '分子动力学', 5, 'temperature, timestep_fs, steps, friction'],
    ['rxn', '反应能', 3, 'reaction*, thermo, temperature'],
    ['ipea', '电离能与电子亲和能', 1, 'mode'],
    ['spin', '自旋态能隙', 2, 'spins'],
    ['bde', '键解离能', 2, 'bond*, thermo, temperature'],
    ['pa', '质子亲和能与去质子化能', 2, 'site*, mode, thermo, temperature']
  ];
  const NAME = Object.fromEntries(JOBS.map(([id, name]) => [id, name]));
  const TRY = ['opt', 'sp', 'freq', 'ipea', 'conf', 'md']; // what the box above offers: the jobs that need no parameter
  // Until the service answers: the models the API offers and whether each handles charge and spin (GET /v1/models says the same).
  const GEOM = ['sp', 'opt', 'freq', 'conf', 'scan', 'md', 'rxn'], CHARGED = [...GEOM, 'ipea', 'spin', 'bde', 'pa'];
  let models = [
    ['uma-s-1p2p1', CHARGED], ['uma-s-1p2', CHARGED], ['uma-s-1p2p1-ft-d4rev', CHARGED], ['uma-s-1p1', GEOM],
    ['allscaip-md-conserving-all-omol', CHARGED], ['allscaip-md-direct-all-omol', CHARGED],
    ['esen-sm-conserving-all-omol', GEOM], ['esen-sm-direct-all-omol', GEOM], ['esen-md-direct-all-omol', GEOM], ['ani-2x', GEOM]
  ].map(([id, jobs]) => ({ id, jobs, ready: null }));

  function drawJobs() {
    $('run-jobs').innerHTML = JOBS.map(([id, name, cost, params]) => `<tr><td><code translate="no">${id}</code></td><td>${esc(T(name))}</td><td>${cost}</td><td translate="no">${
      params ? params.split(', ').map((p) => (p.endsWith('*') ? `<code>${p.slice(0, -1)}</code> <span class="api-req" translate="yes">${esc(T('必填'))}</span>` : `<code>${p}</code>`)).join(' ') : '—'}</td></tr>`).join('');
  }

  // ── the form: model and job ──
  const state = { tab: 'py' };
  const pick = () => ({ smiles: $('run-smiles').value.trim() || 'CCO', model: $('run-model').value || models[0].id, job: $('run-job').value || 'opt' });
  function drawModels() {
    const keep = $('run-model').value;
    $('run-model').innerHTML = models.map((m) => `<option value="${esc(m.id)}">${esc(m.id)}${m.ready === false ? ` · ${esc(T('没有加载'))}` : ''}</option>`).join('');
    if (models.some((m) => m.id === keep)) $('run-model').value = keep;
    drawJobOptions();
  }
  function drawJobOptions() {
    const m = models.find((x) => x.id === $('run-model').value) || models[0], keep = $('run-job').value;
    const jobs = TRY.filter((j) => m.jobs.includes(j));
    $('run-job').innerHTML = jobs.map((j) => `<option value="${j}">${esc(T(NAME[j]))} (${j})</option>`).join('');
    if (jobs.includes(keep)) $('run-job').value = keep;
    drawCode();
  }

  // ── code for the current choice (never the key) ──
  function code(tab) {
    const body = pick(), json = JSON.stringify(body), fields = Object.entries(body);
    const single = (v) => `'${String(v).replace(/\\/g, '\\\\').replace(/'/g, "\\'")}'`;
    if (tab === 'py') {
      return `import json, os, time, urllib.request, urllib.error

API = "${PUBLIC}/v1"
KEY = os.environ["MOLASTRIA_KEY"]  # make one at https://molastria.com/pro/account.html

def call(path, body=None):
    req = urllib.request.Request(
        API + path,
        data=json.dumps(body).encode() if body else None,
        headers={"Authorization": "Bearer " + KEY,
                 "Content-Type": "application/json",
                 "User-Agent": "my-script/1.0"})
    try:
        with urllib.request.urlopen(req) as r:
            return json.load(r)
    except urllib.error.HTTPError as e:  # {"error": {"code", "message", "message_zh"}}
        raise SystemExit(json.load(e)["error"]["message"])

job = call("/jobs", {${fields.map(([k, v]) => `"${k}": ${JSON.stringify(v)}`).join(', ')}})
while job["status"] in ("queued", "running"):  # best effort: one home GPU, it may be busy or offline
    time.sleep(3)
    job = call("/jobs/" + job["id"])
print(job["status"], json.dumps(job.get("result") or job.get("error"), indent=2))`;
    }
    if (tab === 'js') {
      return `const API = '${PUBLIC}/v1';
const KEY = process.env.MOLASTRIA_KEY; // make one at https://molastria.com/pro/account.html

async function call(path, body) {
  const res = await fetch(API + path, {
    method: body ? 'POST' : 'GET',
    headers: { Authorization: \`Bearer \${KEY}\`, 'Content-Type': 'application/json' },
    body: body && JSON.stringify(body),
  });
  const data = await res.json();
  if (!res.ok) throw new Error(\`\${data.error.code}: \${data.error.message}\`);
  return data;
}

let job = await call('/jobs', { ${fields.map(([k, v]) => `${k}: ${single(v)}`).join(', ')} });
while (job.status === 'queued' || job.status === 'running') { // best effort: one home GPU, it may be busy or offline
  await new Promise((r) => setTimeout(r, 3000));
  job = await call(\`/jobs/\${job.id}\`);
}
console.log(job.status, job.result ?? job.error);`;
    }
    return `export MOLASTRIA_KEY=mola_...   # make one at https://molastria.com/pro/account.html

# submit: answers {"id": "...", "status": "queued", "position": 1, "cost": 1, "usage": {...}}
curl -s ${PUBLIC}/v1/jobs \\
  -H "Authorization: Bearer $MOLASTRIA_KEY" -H "Content-Type: application/json" \\
  -d '${json.replace(/'/g, `'\\''`)}'

# poll with the id from above until "status" is "done" or "error"
curl -s ${PUBLIC}/v1/jobs/JOB_ID -H "Authorization: Bearer $MOLASTRIA_KEY"

# what is left today
curl -s ${PUBLIC}/v1/me -H "Authorization: Bearer $MOLASTRIA_KEY"`;
  }
  function drawCode() {
    for (const t of document.querySelectorAll('#run-tabs [role=tab]')) t.setAttribute('aria-selected', String(t.dataset.tab === state.tab));
    $('run-code').firstElementChild.textContent = code(state.tab);
  }

  // ── is the computer on? (the public health check the online models page uses; no key) ──
  let health = null;
  function drawHealth() {
    const el = $('gpu-live');
    if (!health) return;
    el.dataset.state = health.online ? 'on' : 'off';
    const queue = Number(health.queue) || 0;
    $('gpu-text').textContent = !health.online ? T('这台电脑现在离线，提交会被拒绝，不扣次数。过一会儿再来。')
      : queue ? T(`这台电脑现在在线，前面有 ${queue} 个任务在排队。`) : T('这台电脑现在在线，没有任务在排队。');
  }
  async function watch() {
    try {
      const res = await fetch(`${base()}/uma/health`);
      health = res.ok ? await res.json() : { online: false };
    } catch { health = { online: false }; }
    const live = Object.entries(health.models || {}).filter(([, m]) => m.tier === 'fair');
    if (live.length) {
      for (const m of models) m.ready = false;
      for (const [id, v] of live) { const m = models.find((x) => x.id === id); if (m) Object.assign(m, { ready: !!v.ready, jobs: v.jobs?.length ? v.jobs : m.jobs }); }
      models.sort((a, b) => (b.ready === true) - (a.ready === true)); // loaded models first; stable, so the order above is kept
      drawModels();
    }
    drawHealth();
  }

  // ── run one job with the reader's key ──
  let running = false;
  const status = (text, tone = '') => { $('run-status').textContent = text; $('run-status').dataset.tone = tone; };
  async function call(key, path, body) {
    let res;
    try {
      res = await fetch(`${base()}/v1${path}`, { method: body ? 'POST' : 'GET', headers: { Authorization: `Bearer ${key}`, ...(body ? { 'Content-Type': 'application/json' } : {}) }, body: body ? JSON.stringify(body) : undefined });
    } catch { throw new Error(T('连不上计算接口，请检查网络后重试。')); }
    const data = await res.json().catch(() => ({}));
    if (!res.ok) throw new Error(document.documentElement.lang === 'en' ? data.error?.message || `HTTP ${res.status}` : data.error?.message_zh || T(`请求失败（${res.status}）`));
    return data;
  }
  function show(job) {
    $('run-result').hidden = false;
    $('run-result').firstElementChild.textContent = JSON.stringify(job, null, 2);
  }
  $('run-form').addEventListener('submit', async (e) => {
    e.preventDefault();
    if (running) return;
    const key = $('run-key').value.trim();
    if (!/^mola_[A-Za-z0-9_-]{43}$/.test(key)) { status(T('先填一个 API key（以 mola_ 开头，在账号页生成）。'), 'err'); $('run-key').focus(); return; }
    running = true;
    $('run-go').disabled = true;
    $('run-result').hidden = true;
    try {
      status(T('正在提交……'));
      let job = await call(key, '/jobs', pick());
      const usage = job.usage;
      const t0 = Date.now();
      while (job.status === 'queued' || job.status === 'running') {
        status(job.status === 'queued' ? T(`已提交，排在第 ${job.position ?? 1} 位。`) : job.progress?.total ? T(`正在计算，第 ${job.progress.done} / ${job.progress.total} 步。`) : T('正在计算……'));
        if (Date.now() - t0 > 600000) throw new Error(T('等了十分钟还没算完。任务还在队列里，稍后用任务编号再查。'));
        await new Promise((ok) => setTimeout(ok, 2000));
        job = await call(key, `/jobs/${job.id}`);
      }
      show(job);
      if (job.status === 'done') status(usage ? T(`算完了。今天还剩 ${usage.remaining} 次计算。`) : T('算完了。'), 'ok');
      else status(T('这次计算失败了，原因在下面的 error 里。'), 'err');
    } catch (err) {
      status(err.message, 'err');
    } finally {
      running = false;
      $('run-go').disabled = false;
    }
  });

  // ── wiring ──
  $('run-model').addEventListener('change', drawJobOptions);
  $('run-job').addEventListener('change', drawCode);
  $('run-smiles').addEventListener('input', drawCode);
  $('run-tabs').addEventListener('click', (e) => {
    const t = e.target.closest('[role=tab]');
    if (t) { state.tab = t.dataset.tab; drawCode(); }
  });
  document.addEventListener('chemhub:i18n', () => { drawJobs(); drawModels(); drawHealth(); });
  drawJobs(); drawModels(); watch();
  // A link to #compute lands here before the search results above have taken their place: go there again once they have.
  if (/^#compute/.test(location.hash)) setTimeout(() => document.getElementById(location.hash.slice(1))?.scrollIntoView(), 600);
})();
