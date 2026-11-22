/* NMRium 谱图处理：工具栏和 iframe 里的 NMRium 之间的对接。规则和数据在 nmrium-core.js（MolAstriaNMRium）。
   - iframe 载入 app/index.html（tools/vendor-nmrium.mjs 构建的 NMRium，生成的，不要手改）；它准备好时发 nmr-wrapper:ready，
     这之前要交的文件先排着。
   - 示例：fetch samples/ 里的文件，做成 File，用 postMessage 交过去（type 'file'）。#sample=<id> 打开时直接载入。
   - 自己的数据：选文件（JCAMP-DX、Bruker zip、JEOL、.nmrium、molfile），或选一个 Bruker 实验文件夹（先打成 zip）；
     也可以直接把文件拖进 NMRium。文件只在浏览器里处理，不上传。
   - #practice=<题>-<图>：载入谱图馆 sp-practice.js，把那道练习题的一维谱写成 JCAMP-DX 交过去（按峰位重画，不是实测）。
   文字自带中英两版（工具栏标 translate="no"）。 */
(() => {
  'use strict';
  const N = window.MolAstriaNMRium;
  const $ = (s, r = document) => r.querySelector(s);
  const bar = $('#nmrium-bar'), frame = $('#nmrium-frame');
  if (!N || !bar || !frame) return;
  const en = document.documentElement.lang === 'en';
  const L = (t) => (t && typeof t === 'object' ? (en ? t.en : t.zh) : String(t ?? ''));
  const esc = (s) => String(s).replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const TX = N.TEXT;

  bar.innerHTML = `
    <h2>${en ? 'NMRium processing' : 'NMRium 谱图处理'}<small>NMRium ${esc(N.BUILD.nmrium)} · ${en ? 'runs in your browser, nothing is uploaded' : '在你的浏览器里处理，不上传'}</small></h2>
    <div class="nmrium-group" role="group" aria-label="${en ? 'Samples' : '示例数据'}"><span class="nmrium-label">${en ? 'Samples' : '示例'}</span>
      ${N.SAMPLES.map((s) => `<button type="button" class="button" data-sample="${s.id}" aria-pressed="false" title="${esc(L(s.what))}">${esc(L(s.name))}</button>`).join('')}</div>
    <div class="nmrium-group" role="group" aria-label="${en ? 'Your own data' : '自己的数据'}">
      <label class="button primary nmrium-file" id="nmrium-own">${en ? 'Process your own data' : '处理自己的数据'}<input type="file" id="nmrium-files" multiple accept=".jdx,.dx,.jcamp,.jdf,.zip,.nmrium,.json,.mol,.sdf,.csv,.tsv,.txt"></label>
      <label class="button nmrium-file">${en ? 'Bruker folder' : 'Bruker 文件夹'}<input type="file" id="nmrium-folder" webkitdirectory multiple></label>
      <a class="button" href="${esc(N.BUILD.app)}" target="_blank" rel="noopener">${en ? 'Full window' : '整窗打开'} <i class="ico-ext" aria-hidden="true"></i></a></div>
    <p class="nmrium-status" id="nmrium-status" role="status" aria-live="polite">${esc(L(TX.loading))}</p>
    <p class="nmrium-phone">${en ? 'NMRium is built for a mouse and a wide screen; on a phone, use it to look rather than to process.' : 'NMRium 是给鼠标和大屏幕设计的；手机上适合看谱，处理谱图请用电脑。'}</p>
    <details class="nmrium-more" id="nmrium-more"><summary>${en ? 'What you can do here, data and licences' : '能做什么、数据和许可'}</summary>
      <div class="nmrium-notes">
        <div><p>${en
          ? 'NMRium is an open-source NMR processor from the cheminfo community (github.com/cheminfo), packaged for embedding by NFDI4Chem. Its interface is in English. Drop files straight into it, or use the buttons above.'
          : 'NMRium 是 cheminfo 社区（github.com/cheminfo）开发的开源核磁处理程序，NFDI4Chem 把它包成了可以嵌入的页面。它的界面是英文的。可以直接把文件拖进去，也可以用上面的按钮。'}</p>
          <ul>${(en
            ? ['1D: Fourier transform of a raw FID, apodization, zero filling, phase correction, baseline correction', 'Peak picking, integrals, multiplet analysis (Ranges), J couplings', '2D: COSY, HSQC, HMBC contour plots and cross peaks', 'Assign signals to a structure, export images or an .nmrium file']
            : ['一维：原始 FID 的傅里叶变换、窗函数、补零、相位校正、基线校正', '找峰、积分、多重峰分析（Ranges）、耦合常数', '二维：COSY、HSQC、HMBC 的等高线图和交叉峰', '把信号归属到结构上，导出图片或 .nmrium 文件']).map((t) => `<li>${esc(t)}</li>`).join('')}</ul></div>
        <div><p>${en
          ? 'Formats it reads: JCAMP-DX (.jdx, .dx), Bruker (a zip of the experiment folder, or pick the folder with the button above), JEOL (.jdf), its own .nmrium files and molfiles.'
          : '能读的格式：JCAMP-DX（.jdx、.dx）、Bruker（实验文件夹的 zip，或者用上面的按钮选文件夹）、JEOL（.jdf）、它自己的 .nmrium 文件和 molfile。'}</p>
          <p>${en
          ? 'Everything is processed in this browser tab; files are not sent to MolAstria or anyone else. The “Predict” feature inside NMRium is the one exception: it sends the structure you draw to Zakodium’s prediction service.'
          : '所有处理都在这个浏览器标签页里完成，文件不会发给 MolAstria 或别人。唯一的例外是 NMRium 里的 “Predict”（预测谱图）：它会把你画的结构发给 Zakodium 的预测服务。'}</p></div>
        <div><p>${en
          ? `This is NMRium ${esc(N.BUILD.nmrium)} (wrapper ${esc(N.BUILD.wrapper)}, 2024), not the newest release: from 2025 on, the libraries NMRium uses to read and process data are licensed CC BY-NC-SA 4.0 (non-commercial), so MolAstria keeps the last version that is MIT throughout.`
          : `这里是 NMRium ${esc(N.BUILD.nmrium)}（包装 ${esc(N.BUILD.wrapper)}，2024 年），不是最新版：从 2025 年起，NMRium 读数据和处理数据用的几个库改成了 CC BY-NC-SA 4.0（不许商用），所以本站保留全部是 MIT 许可的最后一版。`}</p>
          <p><a href="app/LICENSE.txt" target="_blank" rel="noopener">${en ? 'Licence' : '许可证'}</a> · <a href="app/THIRD-PARTY-LICENSES.md" target="_blank" rel="noopener">${en ? 'Bundled packages' : '打包的软件包'}</a> · <a href="samples/NOTICE.txt" target="_blank" rel="noopener">${en ? 'Sample data (MIT, cheminfo test data)' : '示例数据（MIT，cheminfo 的测试数据）'}</a> · <a href="https://github.com/cheminfo/nmrium" target="_blank" rel="noopener">GitHub <i class="ico-ext" aria-hidden="true"></i></a></p>
          <p><a href="../index.html">${en ? 'NMR section' : '核磁共振栏目'}</a> · <a href="../../spectra/index.html#sp-practice">${en ? 'Spectra Hall: practice problems' : '谱图馆：练习题'}</a></p></div>
      </div>
    </details>`;

  const status = $('#nmrium-status');
  const say = (text, kind = '') => { status.textContent = text; if (kind) status.dataset.kind = kind; else delete status.dataset.kind; };

  // ── iframe 和消息 ──────────────────────────────────────────────────────
  let ready = false, queue = null;
  const post = (msg) => { try { frame.contentWindow.postMessage(msg, location.origin === 'null' ? '*' : location.origin); } catch { /* frame gone */ } };
  function send(files, tab, label) {
    const msg = N.loadMessage(files, tab);
    if (!ready) { queue = { msg, label }; say(L(TX.loading)); return; }
    post(msg);
    say(L(TX.sent) + label, 'ok');
  }
  window.addEventListener('message', (e) => {
    if (e.source !== frame.contentWindow) return;
    const m = N.readMessage(e.data);
    if (!m) return;
    if (m.kind === 'ready') {
      if (ready) return; // NMRium can announce itself more than once; only the first one counts
      ready = true;
      if (queue) { const q = queue; queue = null; post(q.msg); say(L(TX.sent) + q.label, 'ok'); } else say(L(TX.ready));
    } else if (m.kind === 'data-change') {
      const n = N.spectraCount(m.data); // 只数谱，供页面和测试看是不是载入了
      if (n != null) document.body.dataset.spectra = String(n);
    } else if (m.kind === 'error') {
      const t = N.errorText(m.data);
      if (t) say(L(TX.error) + t, 'error');
    }
  });
  frame.src = N.frameSrc({ workspace: 'default' });
  setTimeout(() => {
    if (ready) return;
    status.innerHTML = `${esc(L(TX.fail))} <a href="${esc(N.BUILD.app)}" target="_blank" rel="noopener">app/index.html</a>`;
    status.dataset.kind = 'error';
  }, 45000);

  // ── 示例 ──────────────────────────────────────────────────────────────
  const pressed = (id) => bar.querySelectorAll('[data-sample]').forEach((b) => b.setAttribute('aria-pressed', String(b.dataset.sample === id)));
  async function loadSample(id) {
    const s = N.SAMPLES.find((x) => x.id === id);
    if (!s) return;
    pressed(id);
    say(L(TX.sending) + L(s.name));
    try {
      const files = await Promise.all(s.files.map(async (name) => {
        const r = await fetch(`samples/${name}`);
        if (!r.ok) throw new Error(`${name}: HTTP ${r.status}`);
        return new File([await r.blob()], name);
      }));
      send(files, s.tab, L(s.name));
      try { window.MolAstriaActivity && window.MolAstriaActivity('practice'); } catch { /* 记不上不要紧 */ }
    } catch (err) { say(L(TX.error) + err.message, 'error'); }
  }
  bar.addEventListener('click', (e) => {
    const b = e.target.closest('[data-sample]');
    if (!b) return;
    history.replaceState(history.state, '', `${location.pathname}${location.search}#sample=${b.dataset.sample}`);
    loadSample(b.dataset.sample);
  });

  // ── 自己的数据 ────────────────────────────────────────────────────────
  async function own(fileList) {
    const files = [...fileList], info = files.map((f) => ({ name: f.name, size: f.size, path: f.webkitRelativePath || '' }));
    const p = N.pick(info);
    pressed('');
    const notes = [];
    if (p.big.length) notes.push(L(TX.big) + p.big.join(', '));
    if (p.bruker) {
      say(L(TX.zipping));
      const keep = files.filter((f) => f.size <= N.MAX_BYTES);
      const entries = await Promise.all(keep.map(async (f) => ({ name: f.webkitRelativePath || f.name, data: new Uint8Array(await f.arrayBuffer()) })));
      const name = N.zipName(keep.map((f) => f.webkitRelativePath || f.name));
      send([new File([N.zip(entries)], name, { type: 'application/zip' })], '', name);
    } else {
      const keep = files.filter((f, i) => p.send.includes(info[i]));
      if (p.skipped.length) notes.push(L(TX.skipped) + p.skipped.join(', '));
      if (!keep.length) { say([L(TX.none), ...notes].join(' '), 'error'); return; }
      send(keep, '', keep.map((f) => f.name).join(', '));
    }
    if (notes.length) say(`${status.textContent} ${notes.join(' ')}`, 'error');
  }
  for (const id of ['#nmrium-files', '#nmrium-folder']) $(id).addEventListener('change', (e) => { if (e.target.files.length) own(e.target.files); e.target.value = ''; });

  // ── 谱图馆练习题 ──────────────────────────────────────────────────────
  const script = (src) => new Promise((ok, no) => { const s = document.createElement('script'); s.src = src; s.onload = ok; s.onerror = () => no(new Error(src)); document.head.append(s); });
  async function loadPractice(id, fig) {
    try {
      if (!window.MOLASTRIA_SPECTRA_PRACTICE) await script('../../spectra/sp-practice.js');
      const p = (window.MOLASTRIA_SPECTRA_PRACTICE?.problems || []).find((x) => x.id === id);
      const out = p && N.practiceFile(p, fig, en ? 'en' : 'zh');
      if (!out) { say(L(TX.nopractice), 'error'); return; }
      pressed('');
      const label = `${L(TX.practice)}${L(p.figs[fig].title)}${out.nominal ? ` ${L(TX.nominal).replace('{0}', out.mhz)}` : ''}`;
      send([new File([out.text], out.name, { type: 'chemical/x-jcamp-dx' })], out.tab, label);
    } catch (err) { say(L(TX.error) + err.message, 'error'); }
  }

  function route() {
    const h = N.parseHash(location.hash);
    if (h && h.sample) loadSample(h.sample);
    else if (h && h.practice) loadPractice(h.practice, h.fig);
  }
  window.addEventListener('hashchange', route);
  route();
})();
