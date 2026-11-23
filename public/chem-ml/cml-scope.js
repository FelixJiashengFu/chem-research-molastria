'use strict';
/* 化学机器学习 · 第九章“结构–性质图”演示的载入和接线（有 DOM 的部分；纯逻辑在 cml-map-core.js）。
   - 数据 cml-map-data.js（约 170 KB，node tools/chemml-map.mjs 生成）在演示第一次画的时候才载入。
   - Chemiscope（BSD-3-Clause，© 2020–2026 chemiscope developers，https://github.com/lab-cosmo/chemiscope）在用户按“打开 Chemiscope”时
     才从 jsDelivr 载入，版本写死。1.x 的包里自带 3Dmol.js 和 plotly.js（约 3.3 MB，压缩后约 1 MB），不需要 JSmol，也不访问别的主机。
     这里没有复制它的任何代码，只调用公开的 DefaultVisualizer。 */
(() => {
  const VERSION = '1.1.1';
  const SRC = `https://cdn.jsdelivr.net/npm/chemiscope@${VERSION}/dist/chemiscope.min.js`;
  const once = new Map();
  const script = (src, ok) => {
    if (ok()) return Promise.resolve();
    if (once.has(src)) return once.get(src);
    const p = new Promise((resolve, reject) => {
      const s = document.createElement('script');
      s.src = src; s.async = true;
      s.onload = () => (ok() ? resolve() : reject(new Error(`${src} 载入后不可用`)));
      s.onerror = () => { once.delete(src); s.remove(); reject(new Error(`${src} 载入失败`)); };
      document.head.appendChild(s);
    });
    once.set(src, p);
    return p;
  };
  const here = (() => { try { return new URL('.', document.currentScript.src).href; } catch { return ''; } })();
  const loadData = () => script(`${here}cml-map-data.js`, () => !!window.MOLASTRIA_CHEMML_MAP_DATA);
  const loadChemiscope = () => script(SRC, () => !!window.Chemiscope?.DefaultVisualizer);

  // 在 box 里放一个 Chemiscope：左（上）是性质图，右（下）是三维结构，下面是结构编号和播放条。
  // onPick(i) 在用户点图、点结构查看器或拖播放条换了分子时调用。返回 { select(i), remove() }。
  async function mount(box, dataset, onPick) {
    await loadChemiscope();
    box.innerHTML = '<div class="cms-grid" translate="no"><div class="cms-meta" hidden></div><div class="cms-map"></div><div class="cms-str"></div><div class="cms-info"></div></div>';
    const q = (c) => box.querySelector(c);
    const v = await window.Chemiscope.DefaultVisualizer.load({ meta: q('.cms-meta'), map: q('.cms-map'), info: q('.cms-info'), structure: q('.cms-str'), maxStructureViewers: 1 }, dataset);
    let quiet = false;
    const hook = (obj, key) => { const orig = obj[key]; obj[key] = (...a) => { orig?.apply(obj, a); const ix = a[a.length - 1]; if (!quiet && ix && Number.isInteger(ix.structure)) onPick(ix.structure); }; };
    hook(v.map, 'onselect'); hook(v.structure, 'onselect'); hook(v.info, 'onchange');
    return {
      vis: v,
      select(i) { quiet = true; try { v.select({ structure: i }); } finally { quiet = false; } },
      apply(settings) { try { v.applySettings(settings); } catch (err) { console.warn('[chemml] chemiscope settings', err); } },
      remove() { try { v.remove(); } catch { /* 已经拆掉了 */ } box.innerHTML = ''; },
    };
  }

  window.MOLASTRIA_CHEMML_SCOPE = { VERSION, SRC, loadData, loadChemiscope, mount };
})();
