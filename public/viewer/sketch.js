/* 分子绘制器：在任何 SMILES 输入框旁边加一个“画结构”按钮，点开一个窗口用鼠标或手指画分子，
   画完把 SMILES 填回输入框（并派发 input 事件，页面原来的校验照常运行）。
   画板用 Kekule.js（MIT，https://github.com/partridgejiang/Kekule.js），第一次打开时才从 jsDelivr 载入（约 2.6 MB）。
   页面上有 RDKit.js（window.ChemLab，实验室、Meta 页、模型接口都有）时：打开时把现有 SMILES 画进画板，
   画完用 RDKit 规范化 SMILES；没有 RDKit 时用 Kekule 自己导出的 SMILES。
   用法：MolAstriaSketch.attach(inputElement)。 */
(function (root) {
  'use strict';

  const VERSION = '1.0.4';
  const BASE = `https://cdn.jsdelivr.net/npm/kekule@${VERSION}/dist/`;
  let loading = null;

  function load() {
    if (root.Kekule?.Editor?.Composer) return Promise.resolve(root.Kekule);
    if (loading) return loading;
    loading = new Promise((resolve, reject) => {
      if (!document.querySelector('link[data-kekule]')) {
        const l = Object.assign(document.createElement('link'), { rel: 'stylesheet', href: `${BASE}themes/default/kekule.css` });
        l.dataset.kekule = '1';
        document.head.append(l);
      }
      const s = document.createElement('script');
      s.src = `${BASE}kekule.min.js`; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (root.Kekule?.Editor?.Composer ? resolve(root.Kekule) : reject(new Error('Kekule.js 载入后不可用')));
      s.onerror = () => { loading = null; reject(new Error('分子绘制器载入失败（需要联网访问 cdn.jsdelivr.net）')); };
      document.head.append(s);
    });
    return loading;
  }
  const rdkit = () => (root.ChemLab?.loadRDKit ? root.ChemLab.loadRDKit().catch(() => null) : Promise.resolve(null));

  /** SMILES → MOL 文本（带二维坐标），要 RDKit；不行就返回空串。 */
  function molblockOf(R, smiles) {
    if (!R || !smiles) return '';
    let m = null;
    try { m = R.get_mol(smiles); return m && m.is_valid() ? m.get_molblock() : ''; } catch { return ''; } finally { m?.delete(); }
  }
  /** MOL 文本 → 规范 SMILES（RDKit）；失败返回空串。 */
  function smilesOf(R, molblock) {
    if (!R || !molblock) return '';
    let m = null;
    try { m = R.get_mol(molblock); return m && m.is_valid() ? m.get_smiles() : ''; } catch { return ''; } finally { m?.delete(); }
  }

  let dlg = null, composer = null, target = null;
  function dialog() {
    if (dlg) return dlg;
    dlg = document.createElement('dialog');
    dlg.className = 'sk-dialog';
    dlg.setAttribute('aria-labelledby', 'sk-title');
    dlg.innerHTML = '<div class="sk-head"><h2 id="sk-title">画一个分子</h2><button type="button" class="sk-x" aria-label="关闭">×</button></div>'
      + '<p class="sk-tip">左边工具栏选原子、键和环，点画布放上去；拖动可以连键。画好后点“用这个分子”。</p>'
      + '<div class="sk-board"><p class="sk-state">正在载入绘制器…</p></div>'
      + '<p class="sk-msg" role="status"></p>'
      + '<div class="sk-actions"><button type="button" class="sk-clear">清空</button><button type="button" class="sk-cancel">取消</button><button type="button" class="sk-ok">用这个分子</button></div>';
    document.body.append(dlg);
    dlg.querySelector('.sk-x').addEventListener('click', () => dlg.close());
    dlg.querySelector('.sk-cancel').addEventListener('click', () => dlg.close());
    dlg.querySelector('.sk-clear').addEventListener('click', () => { try { composer?.newDoc(); } catch { /* 画板还没好 */ } });
    dlg.querySelector('.sk-ok').addEventListener('click', finish);
    return dlg;
  }
  const msg = (t, bad = false) => { const m = dlg.querySelector('.sk-msg'); m.textContent = t; m.dataset.bad = String(bad); };

  async function open(input) {
    target = input;
    const d = dialog();
    msg('');
    d.showModal();
    let K;
    try { K = await load(); } catch (e) { d.querySelector('.sk-state').textContent = e.message; return; }
    const board = d.querySelector('.sk-board');
    if (!composer) {
      board.innerHTML = '';
      composer = new K.Editor.Composer(board);
      composer.setDimension('100%', '100%');
      composer.setEnableOperHistory?.(true);
    }
    const R = await rdkit();
    const mb = molblockOf(R, input.value.trim());
    try {
      if (mb) composer.setChemObj(K.IO.loadFormatData(mb, 'mol'));
      else composer.newDoc();
    } catch { composer.newDoc(); }
    d.dataset.ready = 'true';
  }

  async function finish() {
    const K = root.Kekule;
    if (!composer || !K) return;
    let mols = [];
    try { mols = composer.exportObjs(K.Molecule) || []; } catch { mols = []; }
    if (!mols.length) { msg('画板上还没有分子。', true); return; }
    if (mols.length > 1) { msg('画板上有好几个分子，请只留一个（或把它们连起来）。', true); return; }
    let smiles = '';
    const R = await rdkit();
    try { smiles = smilesOf(R, K.IO.saveFormatData(mols[0], 'mol')); } catch { smiles = ''; }
    if (!smiles) { try { smiles = K.IO.saveFormatData(mols[0], 'smi').trim(); } catch { smiles = ''; } }
    if (!smiles) { msg('这个结构转不成 SMILES，检查一下有没有悬空的键。', true); return; }
    target.value = smiles;
    target.dispatchEvent(new Event('input', { bubbles: true }));
    target.dispatchEvent(new Event('change', { bubbles: true }));
    dlg.close();
    target.focus();
  }

  /** 在 input 后面放一个“画结构”按钮。 */
  function attach(input, label = '画结构') {
    if (!input || input.dataset.sketch) return;
    input.dataset.sketch = '1';
    const b = document.createElement('button');
    b.type = 'button'; b.className = 'sk-open'; b.textContent = label;
    b.setAttribute('aria-haspopup', 'dialog');
    b.addEventListener('click', () => open(input));
    input.insertAdjacentElement('afterend', b);
    return b;
  }

  root.MolAstriaSketch = { attach, open, load, VERSION };
})(window);
