'use strict';
// 化学与材料新闻（图解版）：把 news-data.js 画成页面——新闻列表（按领域筛选）和每一条的图解：
// 白话讲、一步步、示意图、关键数字（标出处）、为什么重要、还没做到的、演示、站内相关、文献。
// 演示的数学在 news-models.js；画图和控件借用谱图馆的 ../spectra/sp-plot.js（MOLASTRIA_SPECTRA_KIT）。
// 文字自带中英两版，按页面语言取用，标 translate="no"。地址：#n-<条目> 跳到一条，#ref-<文献>。
(() => {
  const D = window.MOLASTRIA_NEWS, M = window.MOLASTRIA_NEWS_MODELS, K = window.MOLASTRIA_SPECTRA_KIT;
  if (!D || !M || !K) return;
  const { en, lang, esc, tx, L, rich, num, fix, mount, ctl } = K;
  const $ = (s) => document.querySelector(s);
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  const refById = Object.fromEntries(D.refs.map((r) => [r.id, r]));
  const date = (d) => { const [y, m, dd] = d.split('-').map(Number); return en ? new Date(Date.UTC(y, m - 1, dd)).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' }) : `${y} 年 ${m} 月 ${dd} 日`; };
  const firstAuthor = (r) => r.authors.split(',')[0].trim().split(' ').pop();
  const fieldTag = (f) => `<span class="nw-field" data-f="${f}">${esc(tx(D.fields[f]))}</span>`;

  // 页面上写死的几句：自带两版
  for (const el of document.querySelectorAll('[data-zh][data-en]')) { el.textContent = en ? el.dataset.en : el.dataset.zh; el.lang = lang; }
  if (en) { document.title = 'Chemistry & Materials News, Explained · MolAstria'; $('#nw-h1').firstChild.textContent = 'Chemistry & Materials News'; $('#nw-h1 .fs-h1-en').textContent = 'Explained, with demos you can adjust'; }
  $('#nw-legend').setAttribute('aria-label', L('数字出处的标注', 'Where each number comes from'));
  $('#nw-filter').setAttribute('aria-label', L('按领域筛选', 'Filter by field'));

  // ── 首屏 ──────────────────────────────────────────────────────────────
  $('#nw-lead').innerHTML = C(esc(tx(D.hero.lead)));
  $('#nw-honest').innerHTML = C(esc(tx(D.hero.honesty)));
  $('#nw-legend').innerHTML = Object.entries(D.srcLabel).map(([k, v]) => `<li><span class="nw-src" data-s="${k}">${esc(tx(v))}</span>${C(esc(L({ paper: '论文原文里的数字', calc: '由论文给的常数算出，算法写在旁边', press: '只在新闻稿里出现' }[k], { paper: 'Stated in the paper', calc: 'Computed from the paper’s constants, method alongside', press: 'Only in a press release' }[k])))}</li>`).join('');

  // ── 列表和筛选 ────────────────────────────────────────────────────────
  const items = [...D.items].sort((a, b) => b.date.localeCompare(a.date));
  const used = [...new Set(items.flatMap((i) => i.fields))];
  const filter = $('#nw-filter');
  filter.innerHTML = [`<button type="button" class="button" data-f="" aria-pressed="true">${L('全部', 'All')} <b>${items.length}</b></button>`]
    .concat(used.map((f) => `<button type="button" class="button" data-f="${f}" aria-pressed="false">${C(esc(tx(D.fields[f])))} <b>${items.filter((i) => i.fields.includes(f)).length}</b></button>`)).join('');
  $('#nw-list').innerHTML = items.map((it) => {
    const r = refById[it.paper];
    return `<li class="nw-card" data-fields="${it.fields.join(' ')}"><a href="#n-${it.id}">
      <span class="nw-card-top"><time datetime="${it.date}">${date(it.date)}</time>${C(esc(tx(it.kicker)), 'span', 'nw-kicker')}</span>
      ${C(esc(tx(it.title)), 'h3')}${C(rich(tx(it.dek)), 'p')}
      <span class="nw-card-foot" translate="no">${esc(r.journal)} · ${r.year}<span class="nw-more">${L('看图解', 'Read the explainer')} <i class="ico-ext ico-right" aria-hidden="true"></i></span></span></a></li>`;
  }).join('');
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('button[data-f]');
    if (!b) return;
    for (const x of filter.querySelectorAll('button')) x.setAttribute('aria-pressed', x === b);
    const f = b.dataset.f;
    for (const li of document.querySelectorAll('.nw-card')) li.hidden = !!f && !li.dataset.fields.split(' ').includes(f);
    for (const a of document.querySelectorAll('.nw-item')) a.hidden = !!f && !a.dataset.fields.split(' ').includes(f);
  });

  // ── 示意图 ────────────────────────────────────────────────────────────
  // 能级示意（不按比例）：S1 → 电荷分离（单重态自由基对）→ 三重态自由基对，只填 T₀；旁边是卟啉自己的系间窜越
  const schemeRP = () => `<figure class="nw-scheme"><svg viewBox="0 0 720 300" role="img" aria-label="${esc(L('能级示意', 'Energy-level sketch'))}">
    <defs><marker id="nw-ah" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="nw-ahead"/></marker></defs>
    <line class="nw-lv" x1="40" x2="170" y1="60" y2="60"/><text class="nw-t" x="105" y="50" text-anchor="middle">${esc(L('卟啉激发单重态 S₁', 'Porphyrin S₁'))}</text>
    <line class="nw-lv" x1="40" x2="170" y1="270" y2="270"/><text class="nw-t" x="105" y="290" text-anchor="middle">${esc(L('基态 S₀', 'Ground state S₀'))}</text>
    <path class="nw-ar nw-c2" d="M80 268V64" marker-end="url(#nw-ah)"/><text class="nw-t nw-c2" x="74" y="175" text-anchor="end">hν</text>
    <line class="nw-lv" x1="300" x2="440" y1="130" y2="130"/><text class="nw-t" x="370" y="120" text-anchor="middle">${esc(L('单重态自由基对 ¹(D•⁺A•⁻)', 'Singlet pair ¹(D•⁺A•⁻)'))}</text>
    <path class="nw-ar nw-c0" d="M172 64L298 126" marker-end="url(#nw-ah)"/><text class="nw-t nw-c0" x="240" y="84">${esc(L('电子转移', 'electron transfer'))}</text>
    <line class="nw-lv nw-thin" x1="540" x2="680" y1="112" y2="112"/><line class="nw-lv nw-hot" x1="540" x2="680" y1="134" y2="134"/><line class="nw-lv nw-thin" x1="540" x2="680" y1="156" y2="156"/>
    <text class="nw-t" x="686" y="116">T₊</text><text class="nw-t nw-c1" x="686" y="138">T₀</text><text class="nw-t" x="686" y="160">T₋</text>
    <text class="nw-t" x="610" y="96" text-anchor="middle">${esc(L('三重态自由基对 ³(D•⁺A•⁻)', 'Triplet pair ³(D•⁺A•⁻)'))}</text>
    <path class="nw-ar nw-c1" d="M442 131H536" marker-end="url(#nw-ah)"/><text class="nw-t nw-c1" x="490" y="150" text-anchor="middle">${esc(L('S–T₀ 混合', 'S–T₀ mixing'))}</text>
    ${[0, 1, 2, 3, 4, 5].map((i) => `<circle class="nw-dot" cx="${562 + i * 18}" cy="134" r="4.5"/>`).join('')}
    <line class="nw-lv nw-dim" x1="40" x2="170" y1="190" y2="190"/><text class="nw-t nw-dim-t" x="176" y="194">${esc(L('卟啉三重态 T₁（这条路被抢先）', 'Porphyrin T₁ (this route loses the race)'))}</text>
    <path class="nw-ar nw-dim" d="M140 64V186" stroke-dasharray="4 4" marker-end="url(#nw-ah)"/><text class="nw-t nw-dim-t" x="146" y="150">ISC</text>
  </svg><figcaption>${C(esc(L('示意，不按比例。强磁场里 T₊、T₋ 被塞曼能推开，单重态只和 T₀ 混合，所以金色的布居只落在 T₀。', 'Sketch, not to scale. In a strong field the Zeeman energy pushes T₊ and T₋ away, so the singlet mixes only with T₀ and the gold population lands on T₀ alone.')))}</figcaption></figure>`;
  // ODMR 示意：三重态三个零场能级、发光、微波搬布居
  const schemeODMR = () => `<figure class="nw-scheme"><svg viewBox="0 0 720 280" role="img" aria-label="${esc(L('ODMR 示意', 'ODMR sketch'))}">
    <defs><marker id="nw-ah2" viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto"><path d="M0 0L10 5L0 10z" class="nw-ahead"/></marker></defs>
    <line class="nw-lv" x1="40" x2="170" y1="40" y2="40"/><text class="nw-t" x="105" y="30" text-anchor="middle">S₁</text>
    <line class="nw-lv" x1="40" x2="170" y1="250" y2="250"/><text class="nw-t" x="105" y="272" text-anchor="middle">S₀</text>
    <path class="nw-ar nw-c2" d="M70 248V44" marker-end="url(#nw-ah2)"/><text class="nw-t nw-c2" x="64" y="150" text-anchor="end">532 nm</text>
    <line class="nw-lv" x1="300" x2="440" y1="110" y2="110"/><line class="nw-lv" x1="300" x2="440" y1="126" y2="126"/><line class="nw-lv nw-hot" x1="300" x2="440" y1="160" y2="160"/>
    <text class="nw-t" x="446" y="114">T_Y</text><text class="nw-t" x="446" y="130">T_X</text><text class="nw-t nw-c1" x="446" y="164">T_Z</text>
    <path class="nw-ar nw-dim" d="M172 44L298 106" marker-end="url(#nw-ah2)"/><text class="nw-t" x="236" y="66">ISC</text>
    <path class="nw-ar nw-c4" d="M520 110V160M520 160V110" marker-end="url(#nw-ah2)"/><text class="nw-t nw-c4" x="528" y="140">${esc(L('微波', 'microwave'))}</text>
    <path class="nw-ar nw-c3 nw-wave" d="M370 162L190 246" marker-end="url(#nw-ah2)"/><text class="nw-t nw-c3" x="300" y="226">${esc(L('近红外磷光（> 800 nm）', 'Near-IR phosphorescence (> 800 nm)'))}</text>
    <text class="nw-t" x="560" y="190">${esc(L('子能级发光快慢不同：', 'Sublevels emit at different rates:'))}</text>
    <text class="nw-t" x="560" y="208">${esc(L('微波搬动布居 → 亮度变化', 'microwaves move population →'))}</text>
    <text class="nw-t" x="560" y="226">${esc(L('= 光学读出自旋', 'the glow changes = optical readout'))}</text>
  </svg><figcaption>${C(esc(L('示意，不按比例。三个零场能级的顺序和间距由 D、E 决定，见下面的演示 1。', 'Sketch, not to scale. The order and spacing of the three zero-field levels are set by D and E; see Demo 1 below.')))}</figcaption></figure>`;
  const schemes = { 'mof-radical-pairs': schemeRP, 'mof-odmr': schemeODMR };

  // ── 每一条 ────────────────────────────────────────────────────────────
  const refLine = (r) => `<li id="ref-${r.id}" class="nw-ref" translate="no"><span>${esc(r.authors)} (${r.year}). <b>${esc(r.title)}</b>. <i>${esc(r.journal)}</i> ${esc(r.vol)}, ${esc(r.pages)}.</span>
    <a href="https://doi.org/${esc(r.doi)}" rel="noopener" target="_blank">doi:${esc(r.doi)} ${ext}</a>${r.oa ? `<span class="nw-oa">${L('开放获取', 'Open access')}</span>` : ''}<span class="nw-chk">${esc(L('核对：', 'Checked: '))}${esc(r.checked)}</span></li>`;
  let demoN = 0;
  const demoBlock = (key, itemId) => {
    const d = D.demos[key]; demoN++;
    return `<article class="fs-demo nw-demo" id="demo-${itemId}-${key}" data-demo="${key}"><header><p class="fs-demo-n">${L('演示', 'Demo')} ${demoN}</p>${C(esc(tx(d.title)), 'h4')}${C(rich(tx(d.intro)), 'p', 'muted')}</header>
      <p class="nw-formula" translate="no">${rich(d.formula)}</p><div class="nw-demo-host"></div>
      <details class="fs-notes"><summary>${L('模型说明与局限', 'Model notes and limits')}</summary>${C(rich(tx(d.notes)), 'p')}</details></article>`;
  };
  $('#nw-items').innerHTML = items.map((it) => {
    const r = refById[it.paper];
    demoN = 0;
    return `<article class="nw-item fs-block" id="n-${it.id}" data-fields="${it.fields.join(' ')}" tabindex="-1" aria-labelledby="n-${it.id}-h">
      <header class="nw-head"><p class="nw-meta"><time datetime="${it.date}">${date(it.date)}</time>${it.fields.map(fieldTag).join('')}</p>
        ${C(esc(tx(it.title)), 'h2').replace('<h2', `<h2 id="n-${it.id}-h"`)}${C(rich(tx(it.dek)), 'p', 'nw-dek')}
        <div class="nw-paper"><span class="nw-paper-l">${L('原始论文', 'Original paper')}</span><span translate="no">${esc(firstAuthor(r))} et al., <i>${esc(r.journal)}</i> ${esc(r.vol)}, ${esc(r.pages)} (${r.year}) · <a href="https://doi.org/${esc(r.doi)}" rel="noopener" target="_blank">doi:${esc(r.doi)} ${ext}</a></span>
        <span class="nw-paper-l">${L('新闻报道', 'Coverage')}</span><span>${it.press.map(([u, z, e]) => `<a href="${esc(u)}" rel="noopener" target="_blank" translate="no">${esc(en ? e : z)} ${ext}</a>`).join('<br>')}</span></div></header>
      <section class="nw-sec"><h3>${L('白话讲', 'In plain words')}</h3><div class="fs-prose">${it.plain.map((p) => C(rich(tx(p)), 'p')).join('')}</div></section>
      <section class="nw-sec"><h3>${L('一步步怎么做到的', 'How it worked, step by step')}</h3>
        <ol class="nw-steps">${it.steps.map((s, i) => `<li><span class="nw-step-n">${i + 1}</span><div>${C(esc(tx(s.t)), 'h4')}${C(rich(tx(s.text)), 'p')}</div></li>`).join('')}</ol>
        ${schemes[it.id] ? schemes[it.id]() : ''}</section>
      <section class="nw-sec"><h3>${L('关键数字', 'Key numbers')}</h3><div class="nw-table-wrap"><table class="nw-nums"><thead><tr><th>${L('量', 'Quantity')}</th><th>${L('数值', 'Value')}</th><th>${L('出处', 'Source')}</th></tr></thead><tbody>
        ${it.numbers.map(([k, v, s, n]) => `<tr><th scope="row">${C(rich(tx(k)))}${n ? C(rich(tx(n)), 'small') : ''}</th><td translate="no">${rich(tx(v))}</td><td><span class="nw-src" data-s="${s}">${esc(tx(D.srcLabel[s]))}</span></td></tr>`).join('')}
      </tbody></table></div></section>
      <div class="nw-two"><section class="nw-sec"><h3>${L('为什么重要', 'Why it matters')}</h3><ul class="nw-list nw-why">${it.why.map((p) => C(rich(tx(p)), 'li')).join('')}</ul></section>
        <section class="nw-sec"><h3>${L('还没做到的', 'What it does not show yet')}</h3><ul class="nw-list nw-limits">${it.limits.map((p) => C(rich(tx(p)), 'li')).join('')}</ul></section></div>
      ${it.interp ? `<p class="fs-note">${C(rich(tx(it.interp)))}</p>` : ''}
      <section class="nw-sec fs-lab"><h3>${L('动手调', 'Try it')}</h3><p class="muted">${L('曲线随参数在浏览器里实时重算，是教学模型，不是论文的实测谱。', 'Curves are recomputed live in your browser. They are teaching models, not the paper’s measured spectra.')}</p>${it.demos.map((k) => demoBlock(k, it.id)).join('')}</section>
      <section class="nw-sec"><h3>${L('站内接着读', 'Read on at MolAstria')}</h3><ul class="nw-related">${it.related.map((k) => D.site[k]).filter(Boolean).map(([h, z, e]) => `<li><a class="button" href="${esc(h)}" translate="no">${esc(en ? e : z)} <i class="ico-ext ico-right" aria-hidden="true"></i></a></li>`).join('')}</ul></section>
      <section class="nw-sec"><h3>${L('文献', 'References')}</h3><p class="muted">${L('每个 DOI 都在 Crossref 或 OpenAlex 上核对过题目、作者和期刊。', 'Each DOI was checked against Crossref or OpenAlex for title, authors and journal.')}</p><ol class="nw-refs">${it.refs.map((id) => refById[id]).filter(Boolean).map((r) => refLine(r).replace(`id="ref-${r.id}"`, `id="ref-${it.id}-${r.id}"`)).join('')}</ol></section>
      <p class="nw-top"><a href="#nw-list-h">${L('回到新闻列表', 'Back to the list')} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p>
    </article>`;
  }).join('');

  // ── 演示 ──────────────────────────────────────────────────────────────
  const lin = (a, b, n) => Array.from({ length: n }, (_, i) => a + ((b - a) * i) / (n - 1));
  const VIEWS = {
    rp: () => ({
      ctl: [
        { ...ctl.seg('pre', L('预设', 'Presets'), [['weak', L('弱交换（J 小）', 'Weak exchange (small J)')], ['strong', L('强交换（J 大）', 'Strong exchange (large J)')], ['nodg', L('只有超精细', 'Hyperfine only')]], 'weak'), apply: (v) => ({ weak: { J: 1, dg: 2, B: 340, sig: 5, tau: 0.5 }, strong: { J: 100, dg: 2, B: 340, sig: 5, tau: 0.5 }, nodg: { J: 1, dg: 0, B: 340, sig: 10, tau: 0.5 } }[v]) },
        { ...ctl.log('J', L('交换作用 J（MHz）', 'Exchange J (MHz)'), 0.01, 300, 1, (v) => `${num(v, 3)} MHz`), apply: () => ({ pre: '' }) },
        { ...ctl.range('dg', L('Δg（×10⁻³）', 'Δg (×10⁻³)'), 0, 6, 0.05, 2, (v) => fix(v, 2)), apply: () => ({ pre: '' }) },
        { ...ctl.range('B', L('磁场 B₀（mT）', 'Field B₀ (mT)'), 0, 1250, 5, 340, (v) => `${num(v, 0)} mT`), apply: () => ({ pre: '' }) },
        { ...ctl.range('sig', L('超精细场的宽度 σ（MHz）', 'Hyperfine width σ (MHz)'), 0, 30, 0.5, 5, (v) => `${fix(v, 1)} MHz`), apply: () => ({ pre: '' }) },
        { ...ctl.log('tau', L('自由基对寿命 τ（μs）', 'Pair lifetime τ (μs)'), 0.01, 10, 0.5, (v) => `${num(v, 3)} μs`), apply: () => ({ pre: '' }) },
      ],
      draw(s) {
        const Q0 = M.qFromDg(s.dg * 1e-3, s.B), tMax = Math.min(2, Math.max(0.05, 3 * s.tau));
        const ts = lin(0, tMax, 400), P = ts.map((t) => M.stMixAvg(s.J, Q0, s.sig, t)), env = ts.map((t) => Math.exp(-t / s.tau));
        const Js = lin(-2, 2.5, 120).map((e) => 10 ** e), Y = Js.map((j) => M.stYieldAvg(j, Q0, s.sig, s.tau));
        const y = M.stYieldAvg(s.J, Q0, s.sig, s.tau);
        return {
          plots: [
            { title: L('从单重态出发，T₀ 的布居随时间', 'Population of T₀ over time, starting from the singlet'), h: 250, x: [0, tMax], y: [0, 1.05], xl: L('时间 t（μs）', 'Time t (μs)'), yl: 'P(T₀)',
              series: [{ xs: ts, ys: P, c: 1, fill: true, label: L('T₀ 布居（超精细平均）', 'T₀ population (hyperfine-averaged)') }, { xs: ts, ys: env, c: 5, dash: true, label: L('自由基对还活着的比例 e^{−t/τ}', 'Pairs still alive, e^{−t/τ}') }] },
            { title: L('最后落进 T₀ 的比例 vs 交换作用 J', 'Final share in T₀ vs exchange J'), h: 230, x: [0.01, 316], logx: true, y: [0, Math.max(0.05, ...Y) * 1.15], xl: L('J（MHz）', 'J (MHz)'), yl: L('T₀ 产率', 'T₀ yield'),
              series: [{ xs: Js, ys: Y, c: 0 }], pts: [{ x: s.J, y, c: 1, r: 5 }] },
          ],
          out: [
            [L('Δg 带来的混合 Q_{Δg}', 'Δg mixing Q_{Δg}'), `${num(Q0, 3)} MHz`],
            [L('平均 T₀ 产率', 'Average T₀ yield'), `${fix(100 * y, 1)}%`],
            [L('T₊、T₋ 的布居', 'T₊ and T₋ population'), L('0（强场近似：塞曼能 ≈ 9.5 GHz，远大于 J 和 Q）', '0 (high-field limit: Zeeman ≈ 9.5 GHz ≫ J, Q)')],
          ],
          note: s.J > 20 ? L('J 比 Q 大得多时，S 和 T₀ 能量差太大，混不起来：产率掉下去。', 'When J is much larger than Q the S–T₀ gap is too wide to mix, so the yield drops.') : L('J 小、Q 不小：单重态来回变成 T₀，寿命内大约一半落进 T₀。', 'Small J with sizeable Q: the singlet oscillates into T₀, and roughly half ends up there within the lifetime.'),
        };
      },
    }),
    epr: () => ({
      ctl: [
        { ...ctl.seg('pre', L('预设', 'Presets'), [['al', L('Al-PMOF 三重态（论文的 D、E、布居）', 'Al-PMOF triplet (paper’s D, E, populations)')], ['rp', L('自由基对，只填 T₀', 'Radical pair, T₀ only')]], 'al'), apply: (v) => (v === 'al' ? { mode: 'isc', D: 926, E: 121, px: 0.68, py: 0.32, pz: 0, lw: 1.5 } : { mode: 't0', D: Math.round(M.dipD(1.1)), E: 0, lw: 0.5 }) },
        { ...ctl.seg('mode', L('布居怎么来', 'Where populations come from'), [['isc', L('系间窜越（按 Px、Py、Pz）', 'ISC (by Px, Py, Pz)')], ['t0', L('只填 T₀', 'T₀ only')]], 'isc'), apply: () => ({ pre: '' }) },
        { ...ctl.range('D', L('零场分裂 D（MHz）', 'Zero-field splitting D (MHz)'), 10, 1300, 1, 926, (v) => `${num(v, 0)} MHz`), apply: (v, s) => ({ pre: '', E: Math.min(s.E, v / 3) }) },
        { ...ctl.range('E', 'E（MHz）', 0, 433, 1, 121, (v) => `${num(v, 0)} MHz`), apply: (v, s) => ({ pre: '', E: Math.min(v, s.D / 3) }) },
        { ...ctl.range('px', 'Px', 0, 1, 0.01, 0.68, (v) => fix(v, 2)), show: (s) => s.mode === 'isc', apply: () => ({ pre: '' }) },
        { ...ctl.range('py', 'Py', 0, 1, 0.01, 0.32, (v) => fix(v, 2)), show: (s) => s.mode === 'isc', apply: () => ({ pre: '' }) },
        { ...ctl.range('pz', 'Pz', 0, 1, 0.01, 0, (v) => fix(v, 2)), show: (s) => s.mode === 'isc', apply: () => ({ pre: '' }) },
        { ...ctl.range('lw', L('线宽（mT）', 'Line width (mT)'), 0.2, 6, 0.1, 1.5, (v) => `${fix(v, 1)} mT`) },
      ],
      draw(s) {
        const nu = 9500, g = 2.0023, B0 = nu / M.gamma(g), half = Math.max(4, (1.25 * s.D) / M.gamma(g) + 3 * s.lw);
        const st = M.tripletSticks({ D: s.D, E: s.E, nu, g, n: 1500, pops: s.mode === 't0' ? { mode: 't0' } : { mode: 'isc', P: [s.px, s.py, s.pz] } });
        const sp = M.broaden(st, B0 - half, B0 + half, 700, s.lw);
        const lowHalf = sp.ys.slice(0, 350).reduce((a, v) => a + v, 0), pat = lowHalf >= 0 ? L('低场吸收、高场发射', 'absorption at low field, emission at high field') : L('低场发射、高场吸收', 'emission at low field, absorption at high field');
        return {
          plots: [{ title: L('X 波段（9.5 GHz）粉末谱，向上是吸收 A，向下是发射 E', 'X-band (9.5 GHz) powder spectrum: up is absorption A, down is emission E'), h: 290, x: [B0 - half, B0 + half], y: [-1.12, 1.12], zero: true, xl: L('磁场 B（mT）', 'Field B (mT)'), yl: L('信号（归一）', 'Signal (normalised)'),
            series: [{ xs: sp.xs, ys: sp.ys, c: s.mode === 't0' ? 1 : 0, fill: true }], vlines: [{ x: B0, label: 'g = 2.0023', c: 5 }] }],
          out: [
            [L('谱的总宽度 2|D|/γ', 'Full width 2|D|/γ'), `${fix(M.spanMT(s.D, g), 1)} mT`],
            ...(s.mode === 't0' ? [[L('当成两个电子的点偶极，对应间距', 'As two point dipoles, this means r ≈'), `${fix(M.rFromD(s.D), 2)} nm`]] : []),
            [L('图样', 'Pattern'), s.mode === 't0' ? L('两半对称、符号相反', 'two mirror halves with opposite sign') : pat],
          ],
          note: s.mode === 't0' ? L('只填 T₀：−1↔0 的线一律发射、0↔+1 的线一律吸收，所以谱是正负对称的一对。D 小（两个自由基相隔约 1 nm），谱就窄——这就是论文里“又窄又强”的来历。', 'T₀ only: every −1↔0 line is emissive and every 0↔+1 line absorptive, so the spectrum is a mirror-symmetric pair. A small D (radicals about 1 nm apart) makes it narrow, which is why the paper’s signal is sharp.') : L('系间窜越的布居随取向变化，谱里吸收和发射交错出现；Al-PMOF 的 D 大（约 926 MHz），谱宽约 66 mT。', 'ISC populations change with orientation, so absorption and emission alternate across the spectrum; Al-PMOF’s large D (about 926 MHz) spreads it over about 66 mT.'),
        };
      },
    }),
    zf: () => ({
      ctl: [
        { ...ctl.seg('pre', L('预设', 'Presets'), [['odmr', L('ODMR 读出的值（920 / 150 MHz）', 'From ODMR (920 / 150 MHz)')], ['epr', L('EPR 拟合的值（926 / 121 MHz）', 'From EPR (926 / 121 MHz)')]], 'odmr'), apply: (v) => (v === 'epr' ? { D: 926, E: 121 } : { D: 920, E: 150 }) },
        { ...ctl.range('D', 'D（MHz）', 50, 1500, 1, 920, (v) => `${num(v, 0)} MHz`), apply: (v, s) => ({ pre: '', E: Math.min(s.E, v / 3) }) },
        { ...ctl.range('E', 'E（MHz）', 0, 500, 1, 150, (v) => `${num(v, 0)} MHz`), apply: (v, s) => ({ pre: '', E: Math.min(v, s.D / 3) }) },
        ctl.seg('axis', L('磁场方向', 'Field direction'), [['z', L('沿分子 z 轴', 'Along molecular z')], ['x', L('沿 x 轴', 'Along x')]], 'z'),
        ctl.range('B', L('磁场 B（mT）', 'Field B (mT)'), 0, 10, 0.1, 0, (v) => `${fix(v, 1)} mT`),
      ],
      draw(s) {
        const z = M.zeroField(s.D, s.E), Bs = lin(0, 10, 121), lv = Bs.map((b) => M.levelsAt(s.D, s.E, b, s.axis));
        const now = M.levelsAt(s.D, s.E, s.B, s.axis), tr = [now[1] - now[0], now[2] - now[0], now[2] - now[1]].sort((a, b) => a - b);
        const measured = [300, 770, 1070];
        const top = Math.max(1150, s.D + s.E + 120);
        return {
          plots: [
            { title: L(`在 ${fix(s.B, 1)} mT 下的三条跃迁（金色）；灰色虚线是论文 77 K 零场测到的 300、770、1070 MHz`, `The three transitions at ${fix(s.B, 1)} mT (gold); grey dashes are the paper’s 77 K zero-field lines at 300, 770, 1070 MHz`), h: 200, x: [0, top], y: [0, 1.3], noy: true, xl: L('微波频率（MHz）', 'Microwave frequency (MHz)'),
              sticks: tr.map((f, i) => ({ x: f, y: 1, c: 1, w: 3, label: `${num(f, 0)}`, tip: `${num(f, 0)} MHz` })), vlines: measured.map((x) => ({ x, c: 5 })) },
            { title: L('三个能级随磁场变化（3×3 精确对角化）', 'The three levels vs field (exact 3×3 diagonalisation)'), h: 260, x: [0, 10], xl: L('磁场 B（mT）', 'Field B (mT)'), yl: L('能量（MHz）', 'Energy (MHz)'),
              series: [0, 1, 2].map((k) => ({ xs: Bs, ys: lv.map((v) => v[k]), c: [0, 2, 4][k] })), vlines: [{ x: s.B, c: 1, label: `${fix(s.B, 1)} mT` }] },
          ],
          out: [
            ['E_X, E_Y, E_Z', `${num(z.levels.X, 0)}, ${num(z.levels.Y, 0)}, ${num(z.levels.Z, 0)} MHz`],
            [L('零场 ODMR 线（2E, D − E, D + E）', 'Zero-field ODMR (2E, D − E, D + E)'), `${z.lines.map((v) => num(v, 0)).join(', ')} MHz`],
            [L('当前磁场下的跃迁', 'Transitions at this field'), `${tr.map((v) => num(v, 0)).join(', ')} MHz`],
          ],
          note: L('三条线不是彼此独立的：最低的一条恰好等于另外两条之差（2E = (D + E) − (D − E)）。论文的 300 = 1070 − 770，正好满足——这是一个很好的自洽检查。', 'The three lines are not independent: the lowest equals the difference of the other two (2E = (D + E) − (D − E)). The paper’s 300 = 1070 − 770 satisfies this exactly, a neat self-consistency check.'),
        };
      },
    }),
  };
  // 演示进入视野才挂上（省掉首屏的计算）
  const io = 'IntersectionObserver' in window ? new IntersectionObserver((es) => { for (const e of es) if (e.isIntersecting) { io.unobserve(e.target); start(e.target); } }, { rootMargin: '300px' }) : null;
  function start(art) { if (art._on) return; art._on = true; mount(art.querySelector('.nw-demo-host'), VIEWS[art.dataset.demo]()); }
  for (const a of document.querySelectorAll('.nw-demo')) io ? io.observe(a) : start(a);
  window.MOLASTRIA_NEWS_START = () => { for (const a of document.querySelectorAll('.nw-demo')) start(a); };

  // 地址里的 #n-… / #ref-…
  const jump = () => {
    const h = decodeURIComponent(location.hash.slice(1));
    if (!h) return;
    const el = document.getElementById(h);
    if (el) setTimeout(() => el.scrollIntoView({ block: 'start' }), 60);
  };
  addEventListener('hashchange', jump);
  jump();
  document.body.classList.add('is-ready');
})();
