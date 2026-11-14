/* AI 化学与材料企业图谱：按 ind-data.js 画整页；和多伦多大学有关的条目链到 ../toronto/（读 to-data.js 拿组织名字）。
   只用文字，不放标志：每家一个由名字首字母组成的方块。文字自带中英两版，标 translate="no"。地址 #co-<id> 打开并高亮一家。 */
(() => {
  const D = window.MOLASTRIA_IND;
  const U = window.MOLASTRIA_UOFT || { orgs: [] };
  if (!D) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const tx = (v) => (v && typeof v === 'object' ? (en ? v.en : v.zh) ?? v.zh : v ?? '');
  const T = (zh, e) => (en ? e : zh);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safe = (u) => (/^(https:\/\/|\.\.\/|#)/.test(u) ? u : '#');
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const orgs = new Map(U.orgs.map((o) => [o.id, o]));
  const $ = (id) => document.getElementById(id);
  const main = $('ind');
  if (!main) return;
  const C = D.companies;
  const cats = Object.keys(D.cats).filter((k) => C.some((c) => c.cat === k));
  // 方块里的字：取名字里前两个大写词的首字母（ByteDance Seed · 字节跳动 → BS），一个词就取前两个字母
  const mono = (name) => { const w = name.split(/[\s·(]+/).filter((x) => /^[A-Z0-9]/.test(x)); return (w.length >= 2 ? w[0][0] + w[1][0] : (w[0] || name).slice(0, 2)).toUpperCase(); };
  const omHref = (id) => (id === 'meta' ? '../meta/index.html' : `../open-models/${id}/index.html`);

  const card = (c) => {
    const ties = (c.uoft || []).map((id) => orgs.get(id)).filter(Boolean);
    return `<article class="ind-co" id="co-${c.id}" data-cat="${c.cat}" data-region="${c.region}" data-uoft="${ties.length ? 1 : 0}" tabindex="-1">
      <header><span class="ind-mono" data-cat="${c.cat}" aria-hidden="true">${esc(mono(c.name))}</span>
        <div><h3>${esc(c.name)}</h3><p class="ind-where">${esc(tx(c.hq))}${c.since ? ` · ${T(`${c.since} 年`, c.since)}` : ''}</p></div></header>
      <p class="ind-tags"><span class="ind-cat" data-cat="${c.cat}">${esc(tx(D.cats[c.cat]))}</span>${c.status && c.status !== 'active' ? `<span class="ind-status" data-s="${c.status}" title="${esc(tx(c.statusNote))}">${esc(tx(D.statuses[c.status]))}</span>` : ''}${c.region === 'ca' ? `<span class="ind-ca">${T('加拿大', 'Canada')}</span>` : ''}</p>
      <p class="ind-what">${esc(tx(c.what))}</p>
      ${c.statusNote ? `<p class="ind-note">${esc(tx(c.statusNote))}</p>` : ''}
      ${c.to ? `<p class="ind-to"><b>${T('和多大：', 'With U of T: ')}</b>${esc(tx(c.to))} ${ties.map((o) => `<a href="../toronto/index.html#o-${o.id}">${esc(o.abbr)}</a>`).join(' ')}</p>` : ''}
      <p class="ind-links"><a href="${esc(safe(c.url))}" target="_blank" rel="noopener">${/github\.com/.test(c.url) ? 'GitHub' : host(c.url) === 'matter.toronto.edu' || /thequantuminsider|businesswire/.test(c.url) ? T('介绍', 'About') : T('官网', 'Website')} <i class="ico-ext" aria-hidden="true"></i></a>${c.om ? `<a href="${omHref(c.om)}">${T('开放模型馆', 'Open Model Hall')} <i class="ico-ext ico-right" aria-hidden="true"></i></a>` : ''}${c.src ? `<a class="ind-src" href="${esc(safe(c.src))}" target="_blank" rel="noopener">${T('出处', 'Source')}: ${esc(host(c.src))}</a>` : ''}${c.toSrc ? `<a class="ind-src" href="${esc(safe(c.toSrc))}" target="_blank" rel="noopener">${T('关系出处', 'Tie source')}: ${esc(host(c.toSrc))}</a>` : ''}</p>
      <p class="ind-v" data-v="${c.v}">${c.v === 'site' ? T(`${D.checked} 打开官网核对过`, `Checked on the official site, ${D.checked}`) : T('按公开资料写，官网未逐句核对', 'From public sources; not checked line by line on the official site')}</p>
    </article>`;
  };

  const nTo = C.filter((c) => c.uoft?.length).length;
  const nCa = C.filter((c) => c.region === 'ca').length;
  const nOm = C.filter((c) => c.om).length;
  const nSite = C.filter((c) => c.v === 'site').length;
  main.innerHTML = `<section class="fs-hero" aria-labelledby="ind-h1">
      <p class="eyebrow">MOLASTRIA · COMPANIES IN AI FOR CHEMISTRY &amp; MATERIALS</p>
      <h1 id="ind-h1">${T('AI 化学与材料企业图谱', 'AI Chemistry & Materials Companies')}<span class="fs-h1-en" lang="en">Companies in AI for Chemistry &amp; Materials</span></h1>
      <p class="lead">${T(`做 AI 化学和材料的公司远不止科技巨头：有专做材料发现的初创公司、几十年的计算化学软件商、量子计算公司、卖自驱实验室设备的厂家，还有把这些买回去用的化工、电子、能源和制药企业。这里收了 ${C.length} 家，每家一句话说清在做什么，和多伦多大学有据可查的关系单独标出来。`, `Companies in AI for chemistry and materials go far beyond big tech: materials-discovery start-ups, decades-old simulation vendors, quantum computing companies, makers of self-driving-lab hardware, and the chemical, electronics, energy and pharma firms that put all of it to work. ${C.length} are listed here, each in one sentence, with documented ties to the University of Toronto marked separately.`)}</p>
      <p class="fs-honest">${T(`${nSite} 家在 ${D.checked} 打开官网核对过网址和介绍，其余按公开资料写并给出处。只用文字，不放各家标志；名字和商标归各自的公司，MolAstria 与这些公司没有隶属关系，也不是推荐。`, `${nSite} were checked on their official sites on ${D.checked}; the rest are written from public sources with links. Text only, no logos: names and trademarks belong to their companies, and MolAstria is neither affiliated with nor endorsing any of them.`)}</p>
      <p class="fs-jump"><a class="button primary" href="#ind-list">${T('浏览全部', 'Browse all')} <i class="ico-ext ico-down" aria-hidden="true"></i></a><a class="button" href="../toronto/index.html">${T('多伦多大学 · AI 化学与材料', 'U of T · AI for Chemistry & Materials')} <i class="ico-ext ico-right" aria-hidden="true"></i></a><a class="button ghost" href="../open-models/index.html">${T('开放模型馆', 'Open Model Hall')} <i class="ico-ext ico-right" aria-hidden="true"></i></a></p>
    </section>
    <section class="to-facts-strip" aria-label="${T('关键数字', 'Key numbers')}">
      <div><strong>${C.length}</strong><span>${T('家公司', 'companies')}</span></div>
      <div><strong>${cats.length}</strong><span>${T('个类别', 'categories')}</span></div>
      <div><strong>${nTo}</strong><span>${T('家和多大有据可查的关系', 'with a documented U of T tie')}</span></div>
      <div><strong>${nCa}</strong><span>${T('家总部在加拿大', 'headquartered in Canada')}</span></div>
      <div><strong>${nOm}</strong><span>${T('家在开放模型馆有展馆', 'with a pavilion in the Open Model Hall')}</span></div>
    </section>
    <section class="fs-block" id="ind-list" aria-labelledby="ind-list-h" tabindex="-1">
      <h2 id="ind-list-h">${T('全部公司', 'All companies')}</h2>
      <div class="ind-tools">
        <div class="fs-btns" id="ind-cat" role="group" aria-label="${T('按类别', 'By category')}"><button type="button" data-v="" aria-pressed="true">${T('全部', 'All')} <small>${C.length}</small></button>${cats.map((k) => `<button type="button" data-v="${k}" aria-pressed="false">${esc(tx(D.cats[k]))} <small>${C.filter((c) => c.cat === k).length}</small></button>`).join('')}</div>
        <div class="ind-row"><div class="fs-btns" id="ind-scope" role="group" aria-label="${T('范围', 'Scope')}"><button type="button" data-v="" aria-pressed="true">${T('全球', 'Worldwide')}</button><button type="button" data-v="uoft" aria-pressed="false">${T('和多大有关', 'Tied to U of T')}</button><button type="button" data-v="ca" aria-pressed="false">${T('加拿大', 'Canada')}</button></div>
        <label class="ind-search"><span class="sr-only">${T('搜索', 'Search')}</span><input id="ind-q" type="search" placeholder="${T('搜公司、产品、方向…（如 ORCA、电池、量子）', 'Search companies, products, topics… (e.g. ORCA, battery, quantum)')}" autocomplete="off"></label></div>
        <p class="ind-count" id="ind-count" aria-live="polite"></p>
      </div>
      <div class="ind-grid" id="ind-grid">${C.map(card).join('')}</div>
      <p class="ind-empty" id="ind-empty" hidden>${T('没有匹配的公司，换个词试试。', 'No company matches; try another word.')}</p>
    </section>
    <footer class="fs-foot"><strong>MolAstria · ${T('AI 化学与材料企业图谱', 'AI Chemistry & Materials Companies')}</strong>
      <p>${T('公司会改名、被收购、停业，这里写的是核对当天的情况。要加一家或改一条，请在讨论室或 GitHub 告诉我们，附上官网或报道的链接。', 'Companies get renamed, acquired or shut down; this reflects the day of checking. To add or correct one, tell us in the discussion rooms or on GitHub with a link to its website or a report.')}</p>
      <p><a href="../toronto/index.html">${T('多伦多大学 · AI 化学与材料', 'U of T · AI for Chemistry & Materials')}</a> · <a href="../open-models/index.html">${T('开放模型馆', 'Open Model Hall')}</a> · <a href="../scimodels/index.html">${T('科学大模型', 'Science LLMs')}</a> · <a href="../code/index.html">${T('开源代码台', 'Code Desk')}</a> · <a href="#ind-h1">${T('回到顶部', 'Back to top')} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p></footer>`;
  main.setAttribute('translate', 'no');
  for (const el of document.querySelectorAll('[data-zh][data-en]')) { el.textContent = en ? el.dataset.en : el.dataset.zh; el.lang = lang; }
  main.lang = lang;

  const st = { cat: '', scope: '', q: '' };
  const apply = () => {
    let n = 0;
    main.querySelectorAll('.ind-co').forEach((el) => {
      const ok = (!st.cat || el.dataset.cat === st.cat) && (!st.scope || (st.scope === 'uoft' ? el.dataset.uoft === '1' : el.dataset.region === st.scope)) && (!st.q || el.textContent.toLowerCase().includes(st.q));
      el.hidden = !ok; if (ok) n++;
    });
    $('ind-empty').hidden = n > 0;
    $('ind-count').textContent = T(`显示 ${n} 家，共 ${C.length} 家`, `Showing ${n} of ${C.length}`);
  };
  const group = (id, key) => $(id).addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    st[key] = b.dataset.v;
    $(id).querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    apply();
  });
  group('ind-cat', 'cat'); group('ind-scope', 'scope');
  $('ind-q').addEventListener('input', (e) => { st.q = e.target.value.trim().toLowerCase(); apply(); });
  apply();

  function go() {
    const m = location.hash.match(/^#co-([\w-]+)$/);
    if (!m) return;
    const el = document.getElementById(`co-${m[1]}`);
    if (!el) return;
    if (el.hidden) { st.cat = ''; st.scope = ''; st.q = ''; $('ind-q').value = ''; main.querySelectorAll('#ind-cat button,#ind-scope button').forEach((x) => x.setAttribute('aria-pressed', String(!x.dataset.v))); apply(); }
    el.classList.add('is-target');
    setTimeout(() => { el.scrollIntoView({ block: 'center' }); el.focus({ preventScroll: true }); }, 60);
    setTimeout(() => el.classList.remove('is-target'), 2600);
  }
  addEventListener('hashchange', go);
  go();
})();
