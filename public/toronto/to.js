/* 多伦多大学 · AI 化学与材料：按 to-data.js 画整页。企业的名字和链接读 ../industry/ind-data.js（同一份数据，两页互链）。
   文字自带中英两版，标 translate="no"，不走 i18n.js 的词典。地址 #o-<组织> 打开并高亮一个组织。 */
(() => {
  const D = window.MOLASTRIA_UOFT;
  const I = window.MOLASTRIA_IND || { companies: [] };
  if (!D) return;
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const tx = (v) => (v && typeof v === 'object' ? (en ? v.en : v.zh) ?? v.zh : v ?? '');
  const T = (zh, e) => (en ? e : zh);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const safe = (u) => (/^(https:\/\/|\.\.\/|#)/.test(u) ? u : '#');
  const ext = (u, label, cls = '') => `<a${cls ? ` class="${cls}"` : ''} href="${esc(safe(u))}" target="_blank" rel="noopener">${label} <i class="ico-ext" aria-hidden="true"></i></a>`;
  const host = (u) => { try { return new URL(u).hostname.replace(/^www\./, ''); } catch { return ''; } };
  const co = new Map(I.companies.map((c) => [c.id, c]));
  const orgOf = new Map(D.orgs.map((o) => [o.id, o]));
  const $ = (id) => document.getElementById(id);
  const main = $('to');
  if (!main) return;

  // ── 关系图：加速联盟在中间，其余按种类排在两圈上（位置手排，好读）
  const POS = { ac: [400, 235], matter: [235, 130], hattrick: [400, 65], lilienfeld: [565, 130], cdl: [725, 95], a3md: [85, 235], cel: [215, 345], vector: [720, 250], dsi: [590, 345], cptg: [400, 415], scinet: [200, 450], cqiqc: [600, 450] };
  const KC = { isi: 'var(--gold)', lab: 'var(--accent)', alliance: 'var(--info)', institute: 'var(--violet)', infra: 'var(--muted)', hub: 'var(--danger)' };
  function graph() {
    const edges = D.edges.filter(([a, b]) => POS[a] && POS[b]).map(([a, b, zh, e]) => {
      const [x1, y1] = POS[a], [x2, y2] = POS[b];
      return `<g class="to-edge" data-a="${a}" data-b="${b}"><line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}"/><title>${esc(tx(orgOf.get(a).name))} — ${esc(en ? e : zh)} — ${esc(tx(orgOf.get(b).name))}</title></g>`;
    }).join('');
    const nodes = D.orgs.filter((o) => POS[o.id]).map((o) => {
      const [x, y] = POS[o.id], r = o.id === 'ac' ? 30 : 20;
      return `<a class="to-node" href="#o-${o.id}" data-id="${o.id}" aria-label="${esc(tx(o.name))}"><circle cx="${x}" cy="${y}" r="${r}" style="--k:${KC[o.kind]}"/><text x="${x}" y="${y + 4}" class="to-node-abbr">${esc(o.abbr.length > 7 ? o.abbr.split(' ')[0] : o.abbr)}</text><text x="${x}" y="${y + r + 15}" class="to-node-name">${esc(en ? o.name.en.replace(/\s*\(.*\)$/, '') : o.name.zh.replace(/（.*）$/, ''))}</text></a>`;
    }).join('');
    return `<svg class="to-graph" viewBox="0 0 800 500" role="img" aria-labelledby="to-map-h"><g class="to-edges">${edges}</g>${nodes}</svg>`;
  }

  const kinds = [...new Set(D.orgs.map((o) => o.kind))];
  const legend = kinds.map((k) => `<li><span class="to-dot" style="--k:${KC[k]}"></span>${esc(tx(D.kinds[k]))}</li>`).join('');

  const chips = (ids) => ids.map((id) => co.get(id)).filter(Boolean).map((c) => `<a class="to-chip" href="../industry/index.html#co-${c.id}">${esc(c.name)}</a>`).join('');
  const orgCard = (o) => `<article class="to-org" id="o-${o.id}" data-kind="${o.kind}" tabindex="-1">
      <header><p class="to-meta"><span class="to-kind" style="--k:${KC[o.kind]}">${esc(tx(D.kinds[o.kind]))}</span>${o.since ? `<span>${T(`${o.since} 年起`, `Since ${o.since}`)}</span>` : ''}<span class="to-abbr">${esc(o.abbr)}</span></p>
        <h3>${esc(tx(o.name))}</h3>
        <p class="to-line">${esc(tx(o.line))}</p></header>
      <dl class="to-dl"><div><dt>${T('在哪里', 'Where')}</dt><dd>${esc(tx(o.home))}</dd></div><div><dt>${T('谁在带', 'Led by')}</dt><dd>${esc(tx(o.lead))}</dd></div></dl>
      ${o.nums.length ? `<ul class="to-nums">${o.nums.map(([n, zh, e]) => `<li><strong>${esc(en ? n.replace('C$2 亿', 'C$200M').replace('C$1.35 亿', 'C$135M').replace('C$1,000 万+', 'C$10M+') : n)}</strong><span>${esc(en ? e : zh)}</span></li>`).join('')}</ul>` : ''}
      <div class="to-about"><p>${esc(tx(o.about))}</p></div>
      <details class="to-facts"><summary>${T(`核对过的事实（${o.facts.length} 条，每条有出处）`, `Checked facts (${o.facts.length}, each with a source)`)}</summary>
        <ol>${o.facts.map(([zh, e, src]) => `<li>${esc(en ? e : zh)} <a class="to-src" href="${esc(safe(src))}" target="_blank" rel="noopener">${esc(host(src))}</a></li>`).join('')}</ol></details>
      ${o.co.length ? `<div class="to-co"><span>${T('相关企业', 'Companies')}</span>${chips(o.co)}</div>` : ''}
      <p class="to-links">${ext(o.url, T('官网', 'Website'), 'button')}${o.site.map(([zh, e, href]) => `<a class="button ghost" href="../${esc(href)}">${esc(en ? e : zh)} <i class="ico-ext ico-right" aria-hidden="true"></i></a>`).join('')}</p>
    </article>`;

  const ac = orgOf.get('ac');
  const partnerGroups = [['industry', '企业', 'Industry'], ['startups', '初创公司', 'Start-ups'], ['academic', '大学与研究机构', 'Academic'], ['government', '政府与国家实验室', 'Government'], ['nonprofit', '非营利机构', 'Non-profit']];
  const linkedName = (name) => { const c = I.companies.find((x) => x.name === name || x.name.startsWith(name.split(' (')[0]) || name.startsWith(x.name.split(' ·')[0])); return c && c.uoft?.includes('ac') ? `<a href="../industry/index.html#co-${c.id}">${esc(name)}</a>` : esc(name); };
  const allCo = new Set(D.orgs.flatMap((o) => o.co).filter((id) => co.has(id)));

  main.innerHTML = `<section class="fs-hero to-hero" aria-labelledby="to-h1">
      <p class="eyebrow">MOLASTRIA · UNIVERSITY OF TORONTO · AI FOR CHEMISTRY &amp; MATERIALS</p>
      <h1 id="to-h1">${T('多伦多大学 · AI 化学与材料', 'U of T · AI for Chemistry & Materials')}<span class="fs-h1-en" lang="en">University of Toronto · AI for Chemistry &amp; Materials</span></h1>
      <p class="lead">${T('多伦多是“让 AI 自己做化学实验”这件事最集中的地方之一：一个拿了加拿大大学史上最大一笔联邦科研资助的自驱实验室联盟，一批做机器学习势、量子机器学习和逆向设计的课题组，一台 24 万核的超级计算机，以及围着它们的几十家企业。这一页把这些组织是什么、谁在带、做出了什么、和哪些公司合作、学生怎么进去，一个个写清楚。', 'Toronto is one of the places where “AI that runs chemistry experiments” is most concentrated: a self-driving-lab consortium holding the largest federal research grant ever given to a Canadian university, groups working on ML potentials, quantum machine learning and inverse design, a 241,000-core supercomputer, and dozens of companies around them. This page sets out, one by one, what each organisation is, who leads it, what it has produced, which companies it works with and how students can get in.')}</p>
      <p class="fs-honest">${T(`每条事实都标了出处，${D.checked} 逐条读过原网页；介绍是编者自己写的，不是各机构的官方文字。MolAstria 和多伦多大学及这里列出的机构、公司都没有隶属关系。`, `Every fact carries its source, each read on ${D.checked}; the descriptions are the editors’ own, not official text. MolAstria is not affiliated with the University of Toronto or any organisation or company listed here.`)}</p>
      <p class="fs-jump"><a class="button primary" href="#to-orgs">${T('看组织', 'The organisations')} <i class="ico-ext ico-down" aria-hidden="true"></i></a><a class="button" href="#to-sdl">${T('八个自驱实验室', 'The eight SDLs')}</a><a class="button" href="#to-involve">${T('学生怎么参与', 'How students get involved')}</a><a class="button ghost" href="../industry/index.html">${T('AI 化学企业图谱', 'AI chemistry companies')} <i class="ico-ext ico-right" aria-hidden="true"></i></a></p>
    </section>
    <section class="to-facts-strip" aria-label="${T('关键数字', 'Key numbers')}">
      <div><strong>${T('C$2 亿', 'C$200M')}</strong><span>${T('加速联盟 2023 年拿到的 CFREF 资助', 'CFREF grant to the Acceleration Consortium, 2023')}</span></div>
      <div><strong>${D.sdls.length}</strong><span>${T('个自驱实验室用户设施', 'self-driving lab user facilities')}</span></div>
      <div><strong>${D.orgs.length}</strong><span>${T('个组织和研究组', 'organisations and groups')}</span></div>
      <div><strong>${allCo.size}</strong><span>${T('家有据可查的合作企业', 'companies with a documented tie')}</span></div>
      <div><strong>241,056</strong><span>${T('Trillium 超级计算机的 CPU 核', 'CPU cores on Trillium')}</span></div>
    </section>
    <section class="fs-block" id="to-map" aria-labelledby="to-map-h">
      <h2 id="to-map-h">${T('它们怎么连在一起', 'How they connect')}</h2>
      <p class="muted">${T('点一个圆跳到那个组织；鼠标停在连线上看是什么关系。', 'Click a circle to jump to it; hover a line to see the relationship.')}</p>
      <div class="to-graph-wrap">${graph()}</div>
      <ul class="to-legend">${legend}</ul>
    </section>
    <section class="fs-block" id="to-orgs" aria-labelledby="to-orgs-h" tabindex="-1">
      <h2 id="to-orgs-h">${T('组织与研究组', 'Organisations and groups')}</h2>
      <p class="muted">${T('先是加速联盟和最直接做“AI 找材料”的三个组，再是研究所、算力和创业。', 'The Acceleration Consortium and the three groups most directly doing “AI finds materials” come first, then institutes, compute and ventures.')}</p>
      <div class="fs-btns to-filter" id="to-filter" role="group" aria-label="${T('按种类筛选', 'Filter by kind')}"><button type="button" data-k="" aria-pressed="true">${T('全部', 'All')}</button>${kinds.map((k) => `<button type="button" data-k="${k}" aria-pressed="false">${esc(tx(D.kinds[k]))}</button>`).join('')}</div>
      <div class="to-org-list">${D.orgs.map(orgCard).join('')}</div>
    </section>
    <section class="fs-block" id="to-sdl" aria-labelledby="to-sdl-h">
      <h2 id="to-sdl-h">${T('加速联盟的八个自驱实验室', 'The Acceleration Consortium’s eight self-driving labs')}</h2>
      <p class="muted">${T('自驱实验室是一个闭环：模型提出下一组实验，机器人去做，测量结果回到模型里。下面是加速联盟开放给成员使用的八个设施；名单照官网，页面只列成员、不标谁是负责人。', 'A self-driving lab is a loop: a model proposes the next experiments, robots run them and the measurements go back into the model. These are the eight facilities the AC opens to members; names are as on its website, which lists members without marking a lead.')}</p>
      <div class="to-sdl-grid">${D.sdls.map(([id, name, what, city, people]) => `<article class="to-sdl"><p class="to-meta"><span class="to-abbr">${id}</span><span>${esc(city)}</span></p><h3>${esc(tx(name))}</h3><p>${esc(tx(what))}</p><p class="to-people">${esc(people)}</p></article>`).join('')}</div>
      <p class="to-src-line">${T('出处：', 'Source: ')}<a href="https://acceleration.utoronto.ca/ac-labs-and-facilities" target="_blank" rel="noopener">acceleration.utoronto.ca</a></p>
    </section>
    <section class="fs-block" id="to-partners" aria-labelledby="to-partners-h">
      <h2 id="to-partners-h">${T('加速联盟的合作伙伴', 'Acceleration Consortium partners')}</h2>
      <p class="muted">${T('官网合作伙伴页按类列出的机构（名字由编者按网址认出）。在企业图谱里有条目的，可以点进去。截图里提到的几家里，Meta（FAIR）和默克（EMD）在这里；LG 是 A3MD 的伙伴。', 'Organisations on the AC partners page, by group (names read from the web addresses by the editors). Those with an entry in the company map are links. Of the companies in the screenshot, Meta (FAIR) and Merck (EMD) are here; LG partners with A3MD.')}</p>
      <div class="to-partners">${partnerGroups.map(([k, zh, e]) => `<div><h3>${en ? e : zh}<small>${D.acPartners[k].length}</small></h3><p>${D.acPartners[k].map(linkedName).join(' · ')}</p></div>`).join('')}</div>
      <p class="to-src-line">${T('出处：', 'Source: ')}<a href="https://acceleration.utoronto.ca/members/partners" target="_blank" rel="noopener">acceleration.utoronto.ca/members/partners</a></p>
    </section>
    <section class="fs-block" id="to-papers" aria-labelledby="to-papers-h">
      <h2 id="to-papers-h">${T('代表论文', 'Key papers')}</h2>
      <p class="muted">${T(`DOI 都在 OpenAlex 核对过题目、年份和期刊（${D.checked}）。`, `Every DOI checked against OpenAlex for title, year and journal (${D.checked}).`)}</p>
      <ol class="to-papers">${D.papers.slice().sort((a, b) => b.year - a.year).map((p) => `<li><span class="to-p-year">${p.year}</span><div><a href="https://doi.org/${esc(p.doi)}" target="_blank" rel="noopener" lang="en">${esc(p.title)}</a><small>${esc(p.who)} · <i>${esc(p.venue)}</i> · <a class="to-org-tag" href="#o-${p.org}">${esc(orgOf.get(p.org).abbr)}</a></small><p>${esc(tx(p.note))}</p></div></li>`).join('')}</ol>
    </section>
    <section class="fs-block" id="to-involve" aria-labelledby="to-involve-h">
      <h2 id="to-involve-h">${T('学生怎么参与', 'How students get involved')}</h2>
      <ol class="to-involve">${D.involve.map((x) => `<li><p>${esc(tx(x))}</p>${ext(x.href, esc(x.label))}</li>`).join('')}</ol>
    </section>
    <section class="fs-block" id="to-notes" aria-labelledby="to-notes-h">
      <h2 id="to-notes-h">${T('核对说明', 'Verification notes')}</h2>
      <ul class="to-notes">${D.notes.open.map((n) => `<li>${esc(tx(n))}</li>`).join('')}</ul>
    </section>
    <footer class="fs-foot"><strong>MolAstria · ${T('多伦多大学 · AI 化学与材料', 'U of T · AI for Chemistry & Materials')}</strong>
      <p>${T('机构和公司的名字归各自所有；这里只用文字，不放标志。发现写错或过时的地方，请在讨论室或 GitHub 告诉我们。', 'Names belong to their owners; this page uses text only, no logos. If anything is wrong or out of date, tell us in the discussion rooms or on GitHub.')}</p>
      <p><a href="../industry/index.html">${T('AI 化学企业图谱', 'AI chemistry companies')}</a> · <a href="../open-models/index.html">${T('开放模型馆', 'Open Model Hall')}</a> · <a href="../research-atlas/index.html">${T('研究图谱', 'Research Atlas')}</a> · <a href="../lab/index.html">${T('AI 实验室', 'AI Lab')}</a> · <a href="#to-h1">${T('回到顶部', 'Back to top')} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p></footer>`;
  main.setAttribute('translate', 'no');
  for (const el of document.querySelectorAll('[data-zh][data-en]')) { el.textContent = en ? el.dataset.en : el.dataset.zh; el.lang = lang; }
  main.lang = lang;

  // 筛选
  const filter = $('to-filter');
  filter.addEventListener('click', (e) => {
    const b = e.target.closest('button'); if (!b) return;
    filter.querySelectorAll('button').forEach((x) => x.setAttribute('aria-pressed', String(x === b)));
    main.querySelectorAll('.to-org').forEach((el) => { el.hidden = !!b.dataset.k && el.dataset.kind !== b.dataset.k; });
  });

  // 关系图：悬停一个组织时高亮它的连线
  main.querySelectorAll('.to-node').forEach((n) => {
    const on = (v) => main.querySelectorAll(`.to-edge[data-a="${n.dataset.id}"],.to-edge[data-b="${n.dataset.id}"]`).forEach((g) => g.classList.toggle('is-on', v));
    n.addEventListener('mouseenter', () => on(true)); n.addEventListener('mouseleave', () => on(false));
    n.addEventListener('focus', () => on(true)); n.addEventListener('blur', () => on(false));
  });

  // #o-<组织>：打开、滚到、高亮
  function go() {
    const m = location.hash.match(/^#o-([\w-]+)$/);
    if (!m) return;
    const el = document.getElementById(`o-${m[1]}`);
    if (!el) return;
    el.hidden = false;
    el.classList.add('is-target');
    el.querySelector('details')?.setAttribute('open', '');
    setTimeout(() => { el.scrollIntoView({ block: 'start' }); el.focus({ preventScroll: true }); }, 60);
    setTimeout(() => el.classList.remove('is-target'), 2600);
  }
  addEventListener('hashchange', go);
  go();
})();
