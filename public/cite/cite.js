/* 导出引用的按钮：一排小按钮“BibTeX · RIS · 复制”，下载 .bib / .ris 或把参考文献复制到剪贴板。
   用法：MolAstriaCite.bar(recs, { name: 'molastria-refs' }) 返回一个元素；recs 可以是数组或返回数组的函数（点的时候才取）。
   记录的格式和写法在 cite-core.js。文字自带中英两版，标 translate="no"。样式在本目录的 cite.css（页面自己引入，或由这里补上）。 */
(() => {
  'use strict';
  const C = window.MOLASTRIA_CITE_CORE;
  if (!C || window.MolAstriaCite) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const today = () => new Date().toISOString().slice(0, 10);

  // 样式表：和本文件同目录
  const me = document.currentScript;
  if (me && !document.querySelector('link[data-cite-css]')) {
    const l = document.createElement('link');
    l.rel = 'stylesheet'; l.href = new URL('cite.css', me.src).href; l.dataset.citeCss = '';
    document.head.append(l);
  }

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }
  async function copy(text) {
    try { await navigator.clipboard.writeText(text); return true; } catch { /* fall back */ }
    const t = Object.assign(document.createElement('textarea'), { value: text });
    t.style.cssText = 'position:fixed;left:-9999px;top:0';
    document.body.append(t); t.select();
    let ok = false;
    try { ok = document.execCommand('copy'); } catch { ok = false; }
    t.remove();
    return ok;
  }

  /** 一排按钮。opts: { name: 文件名（不带扩展名）, label: 前面的字（默认“引用”）, compact } */
  function bar(recs, opts = {}) {
    const get = () => (typeof recs === 'function' ? recs() : recs) || [];
    const el = document.createElement('div');
    el.className = 'cite-bar' + (opts.compact ? ' compact' : '');
    el.setAttribute('translate', 'no');
    el.setAttribute('role', 'group');
    const label = opts.label ?? L('引用', 'Cite');
    el.setAttribute('aria-label', label || L('导出引用', 'Export citations'));
    el.innerHTML = `${label ? `<span class="cite-l">${label}</span>` : ''}`
      + `<button type="button" data-fmt="bib" title="${L('下载 BibTeX（LaTeX、Overleaf、Zotero）', 'Download BibTeX (LaTeX, Overleaf, Zotero)')}">BibTeX</button>`
      + `<button type="button" data-fmt="ris" title="${L('下载 RIS（Zotero、EndNote、Mendeley）', 'Download RIS (Zotero, EndNote, Mendeley)')}">RIS</button>`
      + `<button type="button" data-fmt="txt" title="${L('把参考文献复制成文字', 'Copy as formatted references')}">${L('复制', 'Copy')}</button>`
      + '<span class="cite-msg" role="status" aria-live="polite"></span>';
    const msg = el.querySelector('.cite-msg');
    let t = 0;
    const say = (s) => { msg.textContent = s; clearTimeout(t); t = setTimeout(() => { msg.textContent = ''; }, 2600); };
    el.addEventListener('click', async (e) => {
      const b = e.target.closest('button[data-fmt]');
      if (!b) return;
      const list = get();
      if (!list.length) { say(L('没有可以导出的条目', 'Nothing to export')); return; }
      const name = opts.name || 'molastria-refs';
      if (b.dataset.fmt === 'bib') { download(`${name}.bib`, C.toBibTeX(list), 'application/x-bibtex'); say(L(`已下载 ${list.length} 条`, `Downloaded ${list.length}`)); }
      else if (b.dataset.fmt === 'ris') { download(`${name}.ris`, C.toRIS(list), 'application/x-research-info-systems'); say(L(`已下载 ${list.length} 条`, `Downloaded ${list.length}`)); }
      else { const ok = await copy(list.map(C.toText).join('\n')); say(ok ? L(`已复制 ${list.length} 条`, `Copied ${list.length}`) : L('浏览器不让复制', 'The browser blocked copying')); }
    });
    return el;
  }

  window.MolAstriaCite = {
    bar,
    fromCatalogue: (i) => C.fromCatalogue(i, today()),
    fromRef: (r) => C.fromRef(r, today()),
    download, copy
  };
})();
