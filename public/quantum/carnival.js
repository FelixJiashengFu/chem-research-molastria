'use strict';
// 量子嘉年华（母栏目）：把 sections.js 的四个展馆画成卡片，再加展馆之间的联系、按背景的游览路线和站内相关栏目。
// 文字都在这里成对写出（中文 / 英文），按站点语言取用并标 translate="no"，所以英文页不依赖词典。
(() => {
  const SEC = window.MOLASTRIA_QUANTUM_SECTIONS || [];
  const en = document.documentElement.lang === 'en';
  const lang = en ? 'en' : 'zh-CN';
  const $ = (s) => document.querySelector(s);
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const tx = (t) => (t ? (en ? t.en : t.zh) : '');
  const C = (html, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} translate="no" lang="${lang}">${html}</${tag}>`;
  const L = (zh, e) => C(esc(en ? e : zh));
  const T = (zh, e) => ({ zh, en: e });
  const ext = '<i class="ico-ext" aria-hidden="true"></i>';
  const S = Object.fromEntries(SEC.map((s) => [s.id, s]));
  const chip = (id) => {
    const s = S[id]; if (!s) return '';
    return s.live ? `<a class="qc-chip" data-hall="${id}" href="${esc(s.path)}" translate="no" lang="${lang}">${esc(tx(s.title))}</a>`
      : `<span class="qc-chip" data-hall="${id}" data-soon translate="no" lang="${lang}">${esc(tx(s.title))}</span>`;
  };

  if (en) document.title = 'Quantum Carnival · MolAstria';

  // ── 首屏 ──────────────────────────────────────────────────────────────
  $('#qc-quote').innerHTML = C(esc(en
    ? '“Nature isn’t classical, dammit, and if you want to make a simulation of nature, you’d better make it quantum mechanical.”'
    : '“大自然不是经典的，见鬼，如果你想模拟大自然，最好用量子力学的方式来做。”'))
    + `<span class="fs-q-en" lang="en" translate="no">${en ? '' : 'Nature isn’t classical, dammit, and if you want to make a simulation of nature, you’d better make it quantum mechanical. · '}Richard P. Feynman, “Simulating physics with computers”, 1982</span>`;
  $('#qc-lead').innerHTML = L('量子嘉年华是 MolAstria 的量子母栏目：一张门票，四个展馆。量子物理讲这门理论本身，从薛定谔方程、测量到纠缠和退相干；量子计算机讲怎样把量子比特真的造出来；量子算法讲在这样的机器上能算什么、比经典快在哪里；量子生物学追问生命里有没有真正“量子”的环节。四个展馆互相引用，可以从任何一个进场。',
    'The Quantum Carnival is MolAstria\'s home for everything quantum: one ticket, four pavilions. Quantum Physics covers the theory itself, from the Schrödinger equation and measurement to entanglement and decoherence; Quantum Computers shows how qubits are actually built; Quantum Algorithms asks what such machines can compute and where they beat classical ones; Quantum Biology asks whether any step of life is genuinely quantum. The pavilions cross-reference each other, so you can enter through any of them.');
  $('#qc-honest').innerHTML = L('嘉年华的名字是玩笑，内容不是：每个展馆都分清楚哪些是教科书里确立的结论、哪些还在争论（量子生物学和“量子优势”尤其如此），文献和课程都逐条核对过。全部内容免费，不需要账号。',
    'The name is playful; the content is not. Every pavilion separates textbook results from open debates (quantum biology and "quantum advantage" especially), and every reference and course was checked one by one. Everything is free and needs no account.');
  $('#qc-jump').innerHTML = [['#qc-halls', '四个展馆', 'The four pavilions', true], ['#qc-links', '展馆之间的通道', 'How they connect'], ['#qc-routes', '游览路线', 'Routes by background'], ['#qc-around', '园区里的其他地方', 'Elsewhere on MolAstria']]
    .map(([h, zh, e, p]) => `<a class="button${p ? ' primary' : ''}" href="${h}">${L(zh, e)}</a>`).join('');

  // ── 四个展馆 ──────────────────────────────────────────────────────────
  $('#qc-halls-h').innerHTML = L('四个展馆', 'The four pavilions');
  const open = SEC.filter((s) => s.live).length;
  $('#qc-halls-note').innerHTML = L(`已开放 ${open} 个，其余正在布展。标“即将上线”的展馆还没有页面，上线后这里会直接变成入口。`, `${open} of ${SEC.length} open; the others are still being set up. Pavilions marked "Coming soon" have no page yet and become links here when they open.`);
  $('#qc-hall-grid').innerHTML = SEC.map((s, i) => {
    const inner = `<span class="qc-hall-n" translate="no">0${i + 1}</span><span class="qc-hall-glyph" aria-hidden="true" translate="no">${esc(s.glyph)}</span>
      <span class="qc-hall-state">${s.live ? L('已开放', 'Open') : L('即将上线', 'Coming soon')}</span>
      <h3>${C(esc(tx(s.title)))}${en ? '' : `<small lang="en" translate="no">${esc(s.title.en)}</small>`}</h3>
      ${C(esc(tx(s.blurb)), 'p')}
      <ul class="qc-tags">${(en ? s.topics.en : s.topics.zh).map((t) => `<li translate="no" lang="${lang}">${esc(t)}</li>`).join('')}</ul>
      ${s.live ? `<span class="qc-go">${L('进入展馆', 'Enter')} <i class="ico-ext ico-right" aria-hidden="true"></i></span>` : ''}`;
    return s.live ? `<a class="qc-hall" data-hall="${s.id}" href="${esc(s.path)}">${inner}</a>` : `<article class="qc-hall" data-hall="${s.id}" data-soon>${inner}</article>`;
  }).join('');

  // ── 展馆之间的通道 ────────────────────────────────────────────────────
  $('#qc-links-h').innerHTML = L('展馆之间的通道', 'How the pavilions connect');
  $('#qc-links-note').innerHTML = L('四个展馆讲的是同一套物理，只是站在不同的位置看。下面每条写明一个展馆具体借用了另一个展馆的什么。', 'All four pavilions rest on the same physics, seen from different places. Each line below names exactly what one pavilion borrows from another.');
  const LINKS = [
    ['physics', 'computing', T('量子比特就是被工程化的二能级系统。T₁、T₂ 这两个硬件指标说的是能量弛豫和退相干，用的是开放量子系统的语言；超导量子比特本身是宏观量子现象（Josephson 结）。', 'A qubit is an engineered two-level system. The two headline hardware numbers, T₁ and T₂, are energy relaxation and dephasing, in the language of open quantum systems; a superconducting qubit is itself a macroscopic quantum effect (the Josephson junction).')],
    ['physics', 'algorithms', T('电路模型里的态、幺正门和测量，就是量子力学的几条公设换了记号。纠缠是量子加速的必要条件，但不是充分条件：只用 Clifford 门的电路纠缠可以很强，却能被经典计算机高效模拟（Gottesman–Knill 定理）。', 'States, unitary gates and measurement in the circuit model are the postulates of quantum mechanics in new notation. Entanglement is necessary for a quantum speed-up but not sufficient: Clifford-only circuits can be highly entangled and still be simulated efficiently on a classical computer (Gottesman–Knill theorem).')],
    ['physics', 'biology', T('隧穿、自旋动力学（自由基对的单重态–三重态混合）和环境里的激子传递，用的都是物理展馆里的工具；量子生物学的问题是这些效应在温暖、潮湿、嘈杂的细胞里还剩多少。', 'Tunnelling, spin dynamics (singlet–triplet mixing in radical pairs) and exciton transfer in a noisy environment all use tools from the physics pavilion; the question quantum biology asks is how much of each survives in a warm, wet, noisy cell.')],
    ['algorithms', 'computing', T('算法决定需要多少逻辑量子比特和多少 T 门，硬件和纠错码决定每个逻辑比特要花多少物理比特和时间。“资源估算”就是两个展馆的交汇处。', 'Algorithms set how many logical qubits and T gates are needed; hardware and error-correcting codes set how many physical qubits and how much time each logical qubit costs. Resource estimation is where the two pavilions meet.')],
    ['algorithms', 'physics', T('哈密顿量模拟（Trotter 分解、相位估计）把物理展馆里的时间演化 e^{−iHt/ħ} 直接搬上量子电路；这被普遍认为是量子计算机最可能先在化学和材料里派上用场的方向。', 'Hamiltonian simulation (Trotter splitting, phase estimation) puts the time evolution e^{−iHt/ħ} of the physics pavilion straight onto a quantum circuit; it is widely seen as the most likely first use of quantum computers in chemistry and materials.')],
    ['biology', 'computing', T('生物体系是天然的开放量子系统，也是量子硬件的反面教材：同样的退相干机制，一边要在芯片上压下去，一边要问生命是否反而利用了它。', 'Biological systems are natural open quantum systems and a mirror image of quantum hardware: the same decoherence mechanisms that engineers fight on a chip are the ones biologists ask whether life might exploit.')],
  ];
  const sup = (s) => esc(s).replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>');
  $('#qc-link-list').innerHTML = LINKS.map(([a, b, t]) => `<li><div class="qc-pair">${chip(a)}<span class="qc-arrow" aria-hidden="true">→</span>${chip(b)}</div>${C(sup(tx(t)), 'p')}</li>`).join('');

  // ── 按背景的游览路线 ──────────────────────────────────────────────────
  $('#qc-routes-h').innerHTML = L('按你的背景选游览路线', 'Pick a route by background');
  $('#qc-routes-note').innerHTML = L('没有唯一正确的顺序。下面是按常见背景给的建议，括号里写的是每个展馆先看哪部分。', 'There is no single right order. These are suggestions for common backgrounds, with the part of each pavilion to see first.');
  const ROUTES = [
    { k: T('化学 / 材料', 'Chemistry / materials'), g: '⌬', steps: [['physics', T('薛定谔方程、角动量与氢原子、近似方法', 'the Schrödinger equation, angular momentum and hydrogen, approximation methods')], ['algorithms', T('哈密顿量模拟与 VQE', 'Hamiltonian simulation and VQE')], ['computing', T('硬件路线与噪声', 'hardware routes and noise')], ['biology', T('酶中的氢隧穿', 'hydrogen tunnelling in enzymes')]],
      note: T('量子化学里用到的物理，在物理展馆里有更完整的来龙去脉；数学准备见“数学基础与探索”。', 'The physics behind quantum chemistry gets its full story in the physics pavilion; for the mathematics see Mathematical Foundations & Exploration.') },
    { k: T('物理', 'Physics'), g: 'ħ', steps: [['computing', T('量子比特的物理与纠错', 'qubit physics and error correction')], ['algorithms', T('复杂度与量子优势的边界', 'complexity and the limits of quantum advantage')], ['biology', T('证据账本', 'the evidence ledger')], ['physics', T('纠缠、Bell 实验与退相干（复习和文献）', 'entanglement, Bell tests and decoherence (review and literature)')]],
      note: T('物理展馆对你多半是复习，可以直接去看前沿和争议更多的三个展馆。', 'The physics pavilion is mostly review for you; head straight for the three pavilions with more open questions.') },
    { k: T('计算机 / 数学', 'Computer science / mathematics'), g: '⊗', steps: [['physics', T('态、算符与测量；纠缠与 Bell 不等式', 'states, operators and measurement; entanglement and Bell inequalities')], ['algorithms', T('从电路模型到 Shor 与 Grover', 'from the circuit model to Shor and Grover')], ['computing', T('纠错与容错架构', 'error correction and fault tolerance')]],
      note: T('线性代数够用就能进场；物理展馆的前四章是你需要补的全部物理。', 'Linear algebra is enough to get in; the first chapters of the physics pavilion are all the physics you need.') },
    { k: T('生物 / 医学', 'Biology / medicine'), g: '⚘', steps: [['physics', T('一维问题与隧穿、自旋', 'one-dimensional problems and tunnelling, spin')], ['biology', T('能量传递、磁罗盘、氢隧穿', 'energy transfer, the magnetic compass, hydrogen tunnelling')], ['algorithms', T('想了解药物发现宣传时再看', 'when you want to judge drug-discovery claims')]],
      note: T('先在物理展馆补两章，量子生物学的论文就能读懂大半。', 'Two chapters in the physics pavilion are enough to read most quantum biology papers.') },
  ];
  $('#qc-route-grid').innerHTML = ROUTES.map((r) => `<article class="qc-route"><p class="qc-route-k"><span class="qc-route-g" aria-hidden="true" translate="no">${esc(r.g)}</span>${C(esc(tx(r.k)))}</p>
      <ol>${r.steps.map(([id, t]) => `<li>${chip(id)}${C(esc(tx(t)), 'small')}</li>`).join('')}</ol>${C(esc(tx(r.note)), 'p', 'muted')}</article>`).join('');

  // ── 园区里的其他地方 ──────────────────────────────────────────────────
  $('#qc-around-h').innerHTML = L('园区里的其他地方', 'Elsewhere on MolAstria');
  $('#qc-around-note').innerHTML = L('这些栏目和量子嘉年华讲的是同一片领域，可以配合着看。', 'These sections cover the same ground and pair well with the carnival.');
  const AROUND = [
    ['../fundamental-science/index.html', '∮', T('进一步基础科学发现', 'Advancing Fundamental Science'), T('量子力学的基础与局限、Berry 相位与圆锥交叉、GRW 与 CSL 塌缩模型，带研究状态标注和交互演示。', 'Foundations and limits of quantum mechanics, Berry phases and conical intersections, GRW and CSL collapse models, with research-status labels and interactive demos.')],
    ['../physics-realms/index.html', '⊛', T('物理疆界图', 'Realms of Physics'), T('四十多个物理理论和它们能解释的问题连成一张网：量子力学从哪里接手经典物理，又在哪里让位给量子场论和量子引力。', 'Over forty physical theories linked to the problems they explain: where quantum mechanics takes over from classical physics, and where it hands over to quantum field theory and quantum gravity.')],
    ['../fundamental-science/math/index.html', 'λ', T('数学基础与探索', 'Mathematical Foundations & Exploration'), T('线性代数、泛函分析、群论、张量网络等十门数学，每门有讲解、大纲、练习和核对过的教材。', 'Ten mathematical subjects from linear algebra and functional analysis to group theory and tensor networks, each with explanations, outlines, exercises and checked textbooks.')],
    ['../qchem/index.html', '⚛', T('游乐场', 'Playground'), T('十五个小游戏：量子化学、量子嘉年华分会场（自旋、贝尔游戏、量子电路、纠错、Grover、二维波包）和物理疆界，以及在浏览器里运行的量子化学计算器。', 'Fifteen games in quantum chemistry, the Quantum Carnival (spin, the Bell game, circuits, error correction, Grover, a 2D wave packet) and the realms of physics, plus a quantum chemistry calculator that runs in the browser.')],
    ['../videos/index.html#t-quantum', '▶', T('教学视频 · 量子计算与量子化学', 'Teaching videos · Quantum computing for chemistry'), T('YouTube 和哔哩哔哩上核对过的课程，量子力学入门课在同一页的“课程”主题里。', 'Checked courses on YouTube and Bilibili; introductory quantum mechanics courses are under the "courses" topic on the same page.')],
    ['../manual/index.html', '¶', T('讲解手册', 'Handbook'), T('20 章中英双语手册，讲计算化学的数据库、软件与方法。', 'A 20-chapter bilingual handbook on the databases, software and methods of computational chemistry.')],
  ];
  $('#qc-around-grid').innerHTML = AROUND.map(([href, g, t, d]) => `<a class="qc-place" href="${href}"><span class="qc-place-g" aria-hidden="true" translate="no">${esc(g)}</span><span>${C(esc(tx(t)), 'b')}${C(esc(tx(d)), 'small')}</span><i class="ico-ext ico-right" aria-hidden="true"></i></a>`).join('');

  $('#qc-foot').innerHTML = `<strong>${L('MolAstria · 量子嘉年华', 'MolAstria · Quantum Carnival')}</strong>
    <p>${L('讲解与演示由 MolAstria 编写，书目与视频只收录核对过、真实存在的条目，不代表作者或平台认可本站。', 'Explanations and demos are written by MolAstria; reading lists contain only entries we checked and that exist, and imply no endorsement by authors or platforms.')}</p>
    <p>${L('开头的引文出自', 'The opening quotation is from')} <a href="https://doi.org/10.1007/BF02650179" target="_blank" rel="noopener noreferrer" translate="no">R. P. Feynman, Int. J. Theor. Phys. 21, 467 (1982) ${ext}</a> · <a href="#qc-h1">${L('回到顶部', 'Back to top')} <i class="ico-ext ico-up" aria-hidden="true"></i></a></p>`;
})();
