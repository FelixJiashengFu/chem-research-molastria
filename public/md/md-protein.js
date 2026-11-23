'use strict';
// 分子动力学与自由能（/md/）的“看一段蛋白质轨迹”一节：md.js 画好页面后调用 window.MOLASTRIA_MD_PROTEIN(el, L)。
// 三种来源都交给 ../viewer/molstar.js（Mol*，点了才从 jsDelivr 载入约 5 MB）：
//   1. 现算的玩具：理想 α 螺旋的 Cα 链 + 弹性网络模型（ANM）的低频正则模叠加出的一段“轨迹”（../viewer/molstar-core.js 的 helixDemo，tools/molstar-test.mjs 测）
//   2. 任意一个 PDB 编号（从 RCSB 下载）
//   3. 自己电脑上的 .pdb（可以多帧，比如模型接口下载的 Cα 轨迹）或 .cif
// 文字自带中英两版（L），这一节在 md.js 的 translate="no" 里。
window.MOLASTRIA_MD_PROTEIN = (el, L) => {
  const C = window.MolAstriaMolstarCore, V = window.MolAstriaMolstar;
  if (!el || !C) return;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  el.innerHTML = `<div class="mdp">
    <div class="mdp-src">
      <div class="mdp-card"><h3>${L('1 · 现算的玩具：螺旋的正则模', '1 · A toy computed here: normal modes of a helix')}</h3>
        <p class="muted small">${L('24 个残基的理想 α 螺旋，只留 Cα；每对相距 13 Å 以内的 Cα 之间放一根弹簧（弹性网络模型，Atilgan 等 2001），对角化 Hessian，把最低的几个正则模按热平衡的振幅叠起来，得到 40 帧“轨迹”。这不是分子动力学，但它的 RMSF 和真实蛋白质一样：两端和松的地方动得多。', 'An ideal 24-residue α helix, Cα atoms only; every pair of Cα closer than 13 Å is joined by a spring (the anisotropic network model, Atilgan et al. 2001). Diagonalising the Hessian and superposing the lowest normal modes with thermal amplitudes gives a 40-frame “trajectory”. This is not molecular dynamics, but its RMSF looks like a real protein’s: the ends and loose parts move most.')}</p>
        <label class="mdp-row">${L('叠加的模数', 'Modes superposed')} <select id="mdp-modes"><option value="1">1</option><option value="3" selected>3</option><option value="6">6</option></select></label>
        <svg class="mdp-rmsf" id="mdp-rmsf" viewBox="0 0 320 110" role="img" aria-label="${esc(L('每个残基的 RMSF', 'RMSF per residue'))}"></svg>
        <button type="button" class="button primary small" id="mdp-toy">${L('在 Mol* 里播放', 'Play in Mol*')}</button></div>
      <div class="mdp-card"><h3>${L('2 · 任意一个 PDB 条目', '2 · Any PDB entry')}</h3>
        <p class="muted small">${L('从 RCSB PDB 下载。NMR 结构有多个模型，滑杆可以一个一个看（比如 1L2Y 是 38 个模型的 Trp-cage）。', 'Downloaded from the RCSB PDB. NMR entries have several models and the slider steps through them (1L2Y, the Trp-cage, has 38).')}</p>
        <div class="mdp-row"><input id="mdp-id" value="1L2Y" maxlength="12" spellcheck="false" aria-label="${esc(L('PDB 编号', 'PDB ID'))}"><button type="button" class="button small" id="mdp-pdb">${L('打开', 'Open')}</button></div>
        <p class="mdp-why small" id="mdp-why" aria-live="polite"></p></div>
      <div class="mdp-card"><h3>${L('3 · 自己的文件', '3 · Your own file')}</h3>
        <p class="muted small">${L('.pdb（可以多帧：MODEL … ENDMDL）或 .cif，只在这台电脑上读，不上传。模型接口“蛋白质分子动力学”下载的 Cα 轨迹就能放进来；那边的结果上也可以直接用 Mol* 看。', 'A .pdb (several frames as MODEL … ENDMDL are fine) or a .cif, read on this computer only, never uploaded. The Cα trajectory downloaded from the model interface’s protein MD works here; its results can also be opened in Mol* directly.')}</p>
        <div class="mdp-row"><input type="file" id="mdp-file" accept=".pdb,.ent,.cif,.mmcif,.txt"></div>
        <p class="small"><a href="../models/index.html#protein">${L('在模型接口跑一段 OpenMM 蛋白质分子动力学', 'Run an OpenMM protein MD on the model interface')} <i class="ico-ext ico-right" aria-hidden="true"></i></a></p></div>
    </div>
    <div class="mdp-view" id="mdp-view"><p class="muted small">${L('选一个来源，Mol* 会出现在这里（第一次要下载约 5 MB）。', 'Pick a source and Mol* appears here (about 5 MB the first time).')}</p></div>
  </div>`;
  const $ = (s) => el.querySelector(s), view = $('#mdp-view');
  let handle = null, ticket = 0;
  const show = (opts) => {
    if (!V) { view.innerHTML = `<p class="mdp-why small">${esc(L('查看器没有载入，请刷新再试。', 'The viewer did not load. Please refresh the page.'))}</p>`; return; }
    handle?.destroy(); handle = null;
    const my = ++ticket;
    V.open(view, opts).then((h) => { if (my === ticket) handle = h; else h.destroy(); }, () => { /* 框里写明了原因 */ });
    view.scrollIntoView({ block: 'nearest', behavior: matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth' });
  };

  let toy = null;
  const drawToy = () => {
    toy = C.helixDemo(24, { modes: Number($('#mdp-modes').value), frames: 40 });
    const n = toy.rmsf.length, max = Math.max(...toy.rmsf, ...toy.rmsfTheory) * 1.1 || 1;
    const x = (i) => 30 + (280 * i) / (n - 1), y = (v) => 92 - (80 * v) / max;
    const line = (arr) => arr.map((v, i) => `${i ? 'L' : 'M'}${x(i).toFixed(1)},${y(v).toFixed(1)}`).join('');
    $('#mdp-rmsf').innerHTML = `<line x1="30" y1="92" x2="310" y2="92" class="mdp-ax"/><line x1="30" y1="10" x2="30" y2="92" class="mdp-ax"/>`
      + `<path d="${line(toy.rmsfTheory)}" class="mdp-th"/><path d="${line(toy.rmsf)}" class="mdp-fr"/>`
      + `<text x="34" y="18" class="mdp-tx">RMSF</text><text x="310" y="106" text-anchor="end" class="mdp-tx">${esc(L('残基 1 → 24', 'residue 1 → 24'))}</text>`
      + `<text x="306" y="14" text-anchor="end" class="mdp-tx mdp-tx-fr">${esc(L('实线：从帧里统计', 'solid: from the frames'))}</text><text x="306" y="25" text-anchor="end" class="mdp-tx">${esc(L('虚线：ANM 解析 Σ|v|²/λ', 'dashed: ANM analytic Σ|v|²/λ'))}</text>`;
  };
  drawToy();
  $('#mdp-modes').addEventListener('change', drawToy);
  $('#mdp-toy').addEventListener('click', () => show({ trajectoryFrames: toy, rmsf: toy.rmsf, label: L('理想 α 螺旋的弹性网络模型轨迹', 'Elastic-network trajectory of an ideal α helix'), name: 'helix-anm' }));

  $('#mdp-pdb').addEventListener('click', () => {
    const id = C.cleanPdbId($('#mdp-id').value);
    $('#mdp-why').textContent = id ? '' : L('PDB 编号是四位，第一位是 1–9 的数字，比如 1L2Y。', 'A PDB ID has four characters starting with a digit 1–9, such as 1L2Y.');
    if (id) show({ pdbId: id, name: id, label: `PDB ${id}` });
  });
  $('#mdp-id').addEventListener('keydown', (e) => { if (e.key === 'Enter') $('#mdp-pdb').click(); });

  $('#mdp-file').addEventListener('change', async (e) => {
    const f = e.target.files[0];
    e.target.value = '';
    if (!f) return;
    if (f.size > 30e6) { view.innerHTML = `<p class="mdp-why small">${esc(L('文件太大（超过 30 MB）。', 'The file is too large (over 30 MB).'))}</p>`; return; }
    const text = await f.text();
    const cif = /\.(cif|mmcif)$/i.test(f.name) || /^data_/m.test(text.slice(0, 2000));
    show(cif ? { mmcifText: text, name: f.name, label: f.name } : { pdbText: text, name: f.name, label: f.name });
  });
};
