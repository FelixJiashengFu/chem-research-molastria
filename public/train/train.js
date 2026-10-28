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

  // Table of contents follows the reading position.
  const links = [...document.querySelectorAll('.tr-toc a')];
  const byId = new Map(links.map((a) => [a.getAttribute('href').slice(1), a]));
  const spy = new IntersectionObserver((entries) => {
    for (const en of entries) if (en.isIntersecting) { links.forEach((a) => a.classList.remove('on')); byId.get(en.target.id)?.classList.add('on'); }
  }, { rootMargin: '-30% 0px -60% 0px' });
  document.querySelectorAll('main section[id]').forEach((s) => spy.observe(s));
})();
