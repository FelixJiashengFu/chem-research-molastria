'use strict';
// 化学学科馆 · 总入口：十四个展馆的卡片（按四组排）、学科关系图、站内已有的化学内容。名单在 chem-subjects.js。
// 文字自带中英两版，页面标 translate="no"。卡片上的进度读本机的 molastria-chem（各展馆读过的章、答对的题）。
(() => {
  const S = window.MOLASTRIA_CHEM_SUBJECTS;
  if (!S) return;
  const en = document.documentElement.lang === 'en';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (Array.isArray(t) ? t[en ? 1 : 0] : t || '');
  const L = (zh, e) => (en ? e : zh);
  if (en) document.title = 'Chemistry Disciplines · MolAstria';
  const SUB = S.subjects.map(([id, num, group, zh, e, line, chapters, demos, refs, rel]) => ({ id, num, group, zh, en: e, line, chapters, demos, refs, rel }));
  const name = (s) => (en ? s.en : s.zh);
  const soon = new Set(S.soon || []), open = SUB.filter((s) => !soon.has(s.id)).length;
  const later = SUB.filter((s) => soon.has(s.id)).map(name).join(L('、', ', '));
  let rec = {};
  try { const v = JSON.parse(localStorage.getItem('molastria-chem') || '{}'); if (v && typeof v === 'object') rec = v; } catch { /* 没有记录 */ }
  const total = (k) => SUB.reduce((n, s) => n + s[k], 0);

  $('#chm-h1').innerHTML = en ? 'Chemistry Disciplines' : '化学学科馆<span class="fs-h1-en" lang="en">Chemistry Disciplines</span>';
  $('#chm-question').innerHTML = esc(L('同一个“化学”，为什么大学里要拆成十几门课？它们各自回答什么问题，又怎样连成一张网？', 'Chemistry is one subject, so why does a university split it into a dozen courses? What question does each answer, and how do they join into one web?'))
    + (en ? '' : '<span class="fs-q-en" lang="en">Chemistry is one subject, so why does a university split it into a dozen courses? What question does each answer, and how do they join into one web?</span>');
  $('#chm-lead').textContent = L(
    `十四个展馆，从四大基础化学（无机、有机、物理化学、分析化学）到结构、计算、配位、电化学，再到高分子、生物、材料、环境、核化学和化学工程。每一馆分章讲解（标出基础、进阶、前沿三档），给出核心公式和一道带数字的例题，配有在浏览器里当场计算的演示、发展时间线、自测题、教材和按 DOI 核对过的文献。一共 ${total('chapters')} 章、${total('demos')} 个演示、${total('refs')} 篇文献。${soon.size ? `现在开放 ${open} 个展馆，${later}还在准备，即将上线。` : ''}`,
    `Fourteen halls, from the four core branches (inorganic, organic, physical, analytical) through structure, computation, coordination and electrochemistry to polymers, biochemistry, materials, the environment, nuclear chemistry and chemical engineering. Each hall has chapters marked foundation, advanced or frontier, key formulas and a worked example with numbers, demos computed live in the browser, a timeline, a self-test, textbooks and references checked by DOI. ${total('chapters')} chapters, ${total('demos')} demos and ${total('refs')} references in all.${soon.size ? ` ${open} halls are open now; ${later} is still being prepared and will open soon.` : ''}`);
  $('#chm-honest').textContent = L(
    '每一门都是一整套大学课程，这里不可能把教材搬过来。每馆挑出这一门最核心的概念和最常用的公式，讲清它们回答什么问题、在哪里会失效，然后指向原始论文和好教材。和站里已有栏目重叠的部分（量子化学、谱图、核磁）只写概览并链过去。',
    'Each of these is a whole university course and no page can replace the textbook. Each hall picks the core ideas and the formulas used most, says what question they answer and where they break down, and points to the original papers and good textbooks. Where another section of this site already covers a topic in depth (quantum chemistry, spectra, NMR), the hall gives an overview and links there.');
  $('#chm-legend').innerHTML = Object.entries(S.levels).map(([k, [t, d]]) => `<li><span class="fs-st" data-s="${k}">${esc(tx(t))}</span><span>${esc(tx(d))}</span></li>`).join('');
  $('#chm-jump').innerHTML = [['chm-halls', L('十四个展馆', 'The fourteen halls'), 1], ['chm-web', L('学科关系图', 'How they connect')], ['chm-site', L('站内其他化学内容', 'More chemistry on this site')]].map(([id, t, p]) => `<a class="button${p ? ' primary' : ''}" href="#${id}">${t}${p ? ' <i class="ico-ext ico-down" aria-hidden="true"></i>' : ''}</a>`).join('');
  for (const [id, t] of Object.entries({ 'chm-halls-h': ['十四个展馆', 'The fourteen halls'], 'chm-web-h': ['学科关系图', 'How the disciplines connect'], 'chm-site-h': ['站内其他化学内容', 'More chemistry on this site'] })) $(`#${id}`).textContent = tx(t);
  $('#chm-halls-note').textContent = L('按四组排列。卡片右上角的数字是你在这台设备上读过的章和答对的题。', 'Arranged in four groups. The figures in a card’s corner are the chapters you have read and questions you have answered on this device.');
  $('#chm-web-note').textContent = L('每条线表示两门学科在概念或方法上联系很紧（各馆末尾的“接着逛”就是按这张图推荐的）。指向一个展馆，看它连着哪些；点一下进入。', 'Each line joins two disciplines that share many ideas or methods (each hall’s “Keep exploring” follows this map). Point at a hall to see its links; click to enter.');
  $('#chm-skip').textContent = L('跳到十四个展馆', 'Skip to the fourteen halls');

  const card = (s) => {
    if (soon.has(s.id)) return `<div class="chm-card is-soon" aria-disabled="true"><span class="chm-card-n">${s.num}</span><span class="chm-card-done chm-soon-tag">${L('即将上线', 'Coming soon')}</span>
      <h4>${esc(name(s))}</h4>${en ? '' : `<p class="chm-card-en" lang="en">${esc(s.en)}</p>`}<p>${esc(tx(s.line))}</p>
      <span class="chm-card-meta"><span>${L('展馆正在准备', 'This hall is being prepared')}</span></span></div>`;
    const r = rec[s.id] || {}, seen = Array.isArray(r.seen) ? r.seen.length : 0, quiz = Array.isArray(r.quiz) ? r.quiz.length : 0;
    return `<a class="chm-card" href="${s.id}/index.html"><span class="chm-card-n">${s.num}</span>${seen || quiz ? `<span class="chm-card-done">${L(`读 ${seen} · 对 ${quiz}`, `${seen} read · ${quiz} right`)}</span>` : ''}
      <h4>${esc(name(s))}</h4>${en ? '' : `<p class="chm-card-en" lang="en">${esc(s.en)}</p>`}<p>${esc(tx(s.line))}</p>
      <span class="chm-card-meta"><span>${L(`${s.chapters} 章`, `${s.chapters} chapters`)}</span><span>${L(`${s.demos} 个演示`, `${s.demos} demos`)}</span><span>${L(`${s.refs} 篇文献`, `${s.refs} refs`)}</span></span></a>`;
  };
  $('#chm-groups').innerHTML = S.groups.map((g) => `<section class="chm-group"><header><h3>${esc(tx(g.title))}</h3><p>${esc(tx(g.text))}</p></header><div class="chm-cards">${SUB.filter((s) => s.group === g.id).map(card).join('')}</div></section>`).join('');

  // ── 学科关系图：十四个节点排成一圈，按组连续，四大基础在上 ──────────────
  const R = 230, cx = 300, cy = 270, n = SUB.length;
  const pos = Object.fromEntries(SUB.map((s, i) => { const a = -Math.PI / 2 + ((i - 1.5) / n) * 2 * Math.PI; return [s.id, [cx + R * Math.cos(a), cy + R * Math.sin(a)]]; }));
  const edges = [];
  for (const s of SUB) for (const t of s.rel) if (pos[t] && !edges.some(([a, b]) => (a === t && b === s.id) || (a === s.id && b === t))) edges.push([s.id, t]);
  const curve = ([a, b]) => { const [x0, y0] = pos[a], [x1, y1] = pos[b], mx = (x0 + x1) / 2, my = (y0 + y1) / 2, k = 0.35; return `M${x0.toFixed(1)} ${y0.toFixed(1)}Q${(mx + (cx - mx) * k).toFixed(1)} ${(my + (cy - my) * k).toFixed(1)} ${x1.toFixed(1)} ${y1.toFixed(1)}`; };
  const label = (s) => { const t = en ? s.en.replace(/ Chemistry$/, '').replace('Quantum & Computational', 'Computational').replace('Coordination & Organometallic', 'Coordination').replace('Nuclear & Radiochemistry', 'Nuclear') : s.zh.replace('与金属有机化学', '').replace('与放射化学', '').replace('量子与', ''); return t; };
  $('#chm-map').innerHTML = `<svg viewBox="0 0 600 540" role="group" aria-label="${esc(L('十四门化学学科的关系图', 'A map of how the fourteen disciplines connect'))}">
    <g>${edges.map((e) => `<path class="chm-edge" data-a="${e[0]}" data-b="${e[1]}" d="${curve(e)}"/>`).join('')}</g>
    <g>${SUB.map((s) => { const [x, y] = pos[s.id]; return `<a class="chm-node${soon.has(s.id) ? ' is-soon' : ''}" href="${s.id}/index.html" data-id="${s.id}" data-g="${s.group}" aria-label="${esc(`${s.num} ${name(s)}${soon.has(s.id) ? L('（即将上线）', ' (coming soon)') : ''}`)}"><circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="30"/><text class="chm-node-n" x="${x.toFixed(1)}" y="${(y - 6).toFixed(1)}">${s.num}</text><text x="${x.toFixed(1)}" y="${(y + 10).toFixed(1)}">${esc(label(s))}</text></a>`; }).join('')}</g></svg>`;
  const map = $('#chm-map');
  const focus = (id) => {
    map.classList.toggle('is-focus', !!id);
    for (const p of map.querySelectorAll('.chm-edge')) p.classList.toggle('is-on', !!id && (p.dataset.a === id || p.dataset.b === id));
    for (const g of map.querySelectorAll('.chm-node')) g.classList.toggle('is-on', !!id && (g.dataset.id === id || edges.some(([a, b]) => (a === id && b === g.dataset.id) || (b === id && a === g.dataset.id))));
  };
  map.addEventListener('pointerover', (e) => { const g = e.target.closest('.chm-node'); focus(g ? g.dataset.id : ''); });
  map.addEventListener('pointerleave', () => focus(''));
  map.addEventListener('focusin', (e) => { const g = e.target.closest('.chm-node'); focus(g ? g.dataset.id : ''); });
  map.addEventListener('focusout', () => focus(''));

  // ── 站内其他化学内容 ────────────────────────────────────────────────────
  const SITE = [
    ['manual/index.html', ['讲解手册', 'Handbook'], ['25 章计算化学讲解：数据库、程序、方法和课程', '25 chapters on computational chemistry: databases, codes, methods and courses']],
    ['spectra/index.html', ['谱图馆', 'Spectra Hall'], ['91 种分析方法的谱图怎么来、怎么读', 'How the spectra of 91 analytical methods arise and how to read them']],
    ['nmr/index.html', ['核磁共振', 'NMR'], ['NMR 方法从 1938 年到今天的全部主线', 'NMR methods from 1938 to today']],
    ['quantum/index.html', ['量子嘉年华', 'Quantum Carnival'], ['量子物理、量子计算机、量子算法和量子生物学四个展馆', 'Quantum physics, quantum computers, quantum algorithms and quantum biology']],
    ['code/index.html', ['开源代码台', 'Code Desk'], ['给 PySCF、ORCA、Gaussian、xTB 等写输入、读输出，RDKit 化学信息学', 'Inputs and outputs for PySCF, ORCA, Gaussian, xTB and more; RDKit cheminformatics']],
    ['models/index.html', ['模型接口', 'Model API'], ['在线跑机器学习势：优化、频率、光谱', 'Run machine-learned potentials online: optimisation, frequencies, spectra']],
    ['qchem/index.html', ['游乐场', 'Playground'], ['二十个化学和量子小游戏，五个是 3D 的', 'Twenty chemistry and quantum games, five in 3D']],
    ['learn/index.html', ['研习台', 'Study Desk'], ['AI 家教：先摸底、画路线、一步一检', 'An AI tutor: probe, plan, then teach step by step']],
  ];
  $('#chm-site-list').innerHTML = SITE.map(([p, t, d]) => `<li><a href="../${p}"><b>${esc(tx(t))}</b><span>${esc(tx(d))}</span></a></li>`).join('');
})();
