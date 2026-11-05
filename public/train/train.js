/* 训练指南页的交互：模型介绍展开、筛选、按显存标注、代码复制、目录高亮。 */
(() => {
  'use strict';
  const T = (s) => window.ChemI18n?.t(s) ?? s;
  const rows = [...document.querySelectorAll('table.models tbody tr:not(.detail)')];
  const detailOf = (row) => row.nextElementSibling?.classList.contains('detail') ? row.nextElementSibling : null;

  // Rough memory needs from the total parameter count (billions); shown as estimates.
  const need = (p) => ({ infer: 0.6 * p + 1.5, sft: 1.0 * p + 4, grpo: 1.6 * (1.0 * p + 4) });
  const gb = (v) => `${Math.ceil(v)} GB`;

  rows.forEach((row, i) => {
    const d = detailOf(row);
    if (!d) return;
    const id = `model-${i}`;
    d.id = id;
    const cell = row.querySelector('td.m');
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'more';
    btn.setAttribute('aria-expanded', 'false');
    btn.setAttribute('aria-controls', id);
    btn.textContent = '介绍 ▾';
    cell.append(btn);
    btn.addEventListener('click', () => toggle(row, d.hidden));
    const est = d.querySelector('.est');
    const p = Number(row.dataset.p);
    if (est && p) {
      const n = need(p);
      est.textContent = `显存估算：4-bit 推理约 ${gb(n.infer)}，QLoRA 微调约 ${gb(n.sft)}，GRPO 约 ${gb(n.grpo)}。`;
    }
  });
  function toggle(row, open) {
    const d = detailOf(row), btn = row.querySelector('button.more');
    if (!d || !btn) return;
    d.hidden = !open;
    btn.setAttribute('aria-expanded', String(open));
    btn.textContent = open ? '收起 ▴' : '介绍 ▾';
    row.classList.toggle('open', open);
  }
  // Clicking anywhere on a model row (except its links) opens the description too.
  rows.forEach((row) => row.addEventListener('click', (e) => {
    if (e.target.closest('a,button')) return;
    const d = detailOf(row);
    if (d) toggle(row, d.hidden);
  }));

  // Filters.
  const chips = [...document.querySelectorAll('.filters [data-filter]')];
  let filter = 'all';
  function applyFilter() {
    for (const row of rows) {
      const show = filter === 'all' || (row.dataset.tags || '').split(/\s+/).includes(filter);
      row.hidden = !show;
      const d = detailOf(row);
      if (d && !show) d.hidden = true;
      if (d && show && row.classList.contains('open')) d.hidden = false;
    }
  }
  chips.forEach((c) => c.addEventListener('click', () => {
    filter = c.dataset.filter;
    chips.forEach((x) => x.setAttribute('aria-pressed', String(x === c)));
    applyFilter();
  }));
  const all = document.querySelector('.expand-all');
  all?.addEventListener('click', () => {
    const open = all.getAttribute('aria-pressed') !== 'true';
    all.setAttribute('aria-pressed', String(open));
    all.textContent = open ? '全部收起' : '全部展开';
    rows.filter((r) => !r.hidden).forEach((r) => toggle(r, open));
  });

  // Memory picker: mark which models fit.
  const vram = document.getElementById('vram'), goal = document.getElementById('goal'), out = document.getElementById('pick-out');
  const GOAL = { infer: '本地推理', sft: 'QLoRA 微调', grpo: 'GRPO 强化学习' };
  function pick() {
    const cap = Number(vram.value), g = goal.value;
    const fit = [];
    for (const row of rows) {
      const p = Number(row.dataset.p);
      row.classList.remove('fit', 'nofit');
      if (!cap || !p) continue;
      const ok = need(p)[g] <= cap;
      row.classList.add(ok ? 'fit' : 'nofit');
      if (ok) fit.push(row.querySelector('td.m').firstChild.textContent.trim());
    }
    if (!cap) { out.textContent = '选择显存后，放得下的模型会以绿色标出。'; return; }
    out.textContent = fit.length
      ? `${cap} GB 做${GOAL[g]}，大约放得下 ${fit.length} 个：${fit.slice(0, 8).join('、')}${fit.length > 8 ? ' 等' : ''}。`
      : `${cap} GB 做${GOAL[g]}比较吃紧，可以换成本地推理，或选更小的模型。`;
  }
  vram?.addEventListener('change', pick);
  goal?.addEventListener('change', pick);
  pick();

  // Copy buttons.
  document.addEventListener('click', async (e) => {
    const b = e.target.closest('[data-copy]');
    if (!b) return;
    const code = b.closest('.code')?.querySelector('code')?.textContent || '';
    try { await navigator.clipboard.writeText(code); b.textContent = T('已复制'); } catch { b.textContent = T('请手动复制'); }
    setTimeout(() => { b.textContent = T('复制'); }, 1600);
  });

  // Weekly Hugging Face check (models-live.js, written by tools/train-models.mjs every Thursday):
  // downloads and likes next to each link, links that stopped working, and new small models from the labs we follow.
  const live = window.MOLASTRIA_MODELS_LIVE;
  if (live) {
    const en = document.documentElement.lang === 'en';
    const short = (n) => n == null ? '' : en
      ? (n >= 1e6 ? (n / 1e6).toFixed(1) + 'M' : n >= 1e3 ? Math.round(n / 1e3) + 'k' : String(n))
      : (n >= 1e4 ? (n / 1e4).toFixed(n >= 1e5 ? 0 : 1) + ' 万' : n.toLocaleString('en-US'));
    const idOf = (href) => (href.match(/^https:\/\/huggingface\.co\/([\w.-]+\/[\w.-]+)/) || [])[1];
    const stampDate = document.getElementById('stamp-date');
    if (stampDate) stampDate.innerHTML = `每周四自动核对 · <b>${live.checkedAt}</b>`;
    const stampLinks = document.getElementById('stamp-links');
    if (stampLinks) stampLinks.textContent = `${live.ok}/${live.linked} 个 Hugging Face 链接本周可用`;
    for (const a of document.querySelectorAll('table.models a[href^="https://huggingface.co/"], table a[href^="https://huggingface.co/"]')) {
      const m = live.models[idOf(a.href)];
      if (!m || a.dataset.live) continue;
      a.dataset.live = '1';
      const s = document.createElement('small');
      s.className = 'hf-stats';
      if (m.ok) { s.innerHTML = `<span>↓ ${short(m.downloads)}</span> <span>♥ ${short(m.likes)}</span>`; s.title = `近 30 天下载 ${m.downloads ?? '?'} · 点赞 ${m.likes ?? '?'} · 更新于 ${m.updated}`; }
      else { s.textContent = '本周检查打不开'; s.classList.add('hf-dead'); }
      a.after(s);
    }
    const box = document.getElementById('model-news');
    if (box && live.fresh?.length) {
      box.innerHTML = `<h3>近 ${live.newDays} 天的新模型（每周自动发现）</h3><p>从各家实验室的 Hugging Face 官方账号自动找出、上表还没收录的 40B 以下文本或图文模型，按下载量排序。尚未人工评测，用于化学 Agent 前先读模型卡。</p><div class="news-list">` +
        live.fresh.map((m) => `<div class="news-item"><a href="https://huggingface.co/${m.id}" target="_blank" rel="noopener" translate="no">${m.id.split('/')[1]}</a><small translate="no">${m.lab} · ${(m.params / 1e9).toFixed(1)}B · ${m.license || '—'}</small><small>${m.created} · ↓ ${short(m.downloads)}</small></div>`).join('') + '</div>';
      box.hidden = false;
    }
  }

  // Table of contents follows the reading position.
  const links = [...document.querySelectorAll('.tr-toc a')];
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { links.forEach((a) => a.classList.remove('on')); byId.get(en.target.id)?.classList.add('on'); }
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));
})();
