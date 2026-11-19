/* 文献信息抽取的纯逻辑（MolAstriaExtract）：不碰 DOM，不联网，不调模型。
   思路来自 ChemEAGLE：Yufan Chen 等，“A Multi-Agent System Enables Versatile Information Extraction from the Chemical
   Literature”，arXiv:2507.20230；代码 github.com/CYF2000127/ChemEagle（MIT，Copyright (c) 2025 Yufan Chen）。
   这里借的是分工：规划、按图里有什么挑智能体、反应式、分子、两种 R 基团表、条件、文字、汇总、核对和打分。
   代码和提示词是自己写的，没有复制那个仓库的文件；原版靠几个要 GPU 的识图模型（MolScribe、RxnScribe 一类），
   这里识图交给能看图的大模型，能用确定的规则做的事都不交给模型：
   - 规划之后的“计划核对”（两种 R 基团表互斥、有反应式就要读条件），
   - R 基团代入和产物枚举（自己写的 SMILES 拼接，substitute），
   - 取代基缩写、常见试剂和溶剂的名字到 SMILES（两张表，tools/extract-test.mjs 用 OpenChemLib 逐条核对分子式），
   - 条件的拆分和归类、产率读数、标签对齐、元素守恒检查、置信度打分（规则打分，没有像原文那样拿基准集校准），
   - 导出 JSON / CSV / 反应 SMILES。
   界面 extract.js 负责调模型（ai/ai.js 的 ChemAI）、RDKit 校验、PubChem 查名字和可编辑的表。 */
(function (root) {
  'use strict';

  // ── 智能体 ───────────────────────────────────────────────────────────────
  /** 流水线的每一步。llm：要不要调模型；image：要不要看图。顺序就是界面上的顺序。 */
  const AGENTS = [
    { id: 'planner', llm: true, image: true, zh: '规划', en: 'Planner', dz: '看图判断里面有什么：反应式、单独的分子、底物表、R 基团表、条件、说明文字', de: 'Looks at the figure and decides what is in it: a scheme, standalone molecules, a scope panel, an R-group table, conditions, text' },
    { id: 'observer', llm: false, zh: '计划核对', en: 'Plan check', dz: '按规则检查计划：两种 R 基团表不同时用，有反应式就要读条件', de: 'Checks the plan by rule: never both R-group agents, a scheme always gets its conditions read' },
    { id: 'template', llm: true, image: true, zh: '反应式', en: 'Reaction template', dz: '读出反应物、产物和编号，R 基团写成 [*:n]', de: 'Reads reactants, products and their labels; R groups become [*:n]' },
    { id: 'molecules', llm: true, image: true, zh: '分子识别', en: 'Molecules', dz: '反应式之外单独画出的分子（催化剂、配体、添加剂）转成 SMILES', de: 'Standalone molecules outside the scheme (catalysts, ligands, additives) to SMILES' },
    { id: 'scope', llm: true, image: true, zh: '结构底物表', en: 'Scope panel', dz: '每格画着完整产物的底物表：逐格读结构、编号和产率', de: 'A scope panel with a whole product in each cell: structure, label and yield per cell' },
    { id: 'rtable', llm: true, image: true, zh: 'R 基团表', en: 'R-group table', dz: '只列取代基的表：读出每行的 R 值，产物由规则代入枚举', de: 'A table that lists substituents only: reads each row’s R values; products are enumerated by rule' },
    { id: 'conditions', llm: true, image: true, zh: '条件', en: 'Conditions', dz: '箭头上下的催化剂、试剂、溶剂、温度、时间、气氛', de: 'Catalyst, reagents, solvent, temperature, time and atmosphere around the arrow' },
    { id: 'text', llm: true, image: false, zh: '文字', en: 'Text', dz: '图注或正文段落里的化合物和反应', de: 'Compounds and reactions in the caption or a paragraph' },
    { id: 'merge', llm: false, zh: '汇总', en: 'Assemble', dz: '把各步的结果按编号对齐，拼成一张反应表', de: 'Aligns every step’s output by label into one reaction table' },
    { id: 'verify', llm: true, image: true, optional: true, zh: '模型复核', en: 'Model review', dz: '可选：让模型对着原图逐条回答“对不对”', de: 'Optional: the model answers yes / no per reaction against the figure' },
    { id: 'check', llm: false, zh: '核对和打分', en: 'Check & score', dz: 'SMILES 能否解析、R 基团是否代完、元素是否守恒、产率是否合理，给每条反应打分', de: 'Parsable SMILES, R groups filled, elements accounted for, sane yields; a score per reaction' }
  ];
  const EXTRACTORS = ['template', 'molecules', 'scope', 'rtable', 'conditions', 'text'];

  // ── 提示词 ───────────────────────────────────────────────────────────────
  const RULES = `Rules:
- Reply with ONE JSON object and nothing else.
- Copy labels exactly as printed (e.g. "1", "2a", "3b", "L1", "cat. A"). Use "" when there is none.
- SMILES: write what is drawn; keep stereo wedges as @/@@ and E/Z as / \\ when they are drawn; keep counter-ions as separate dot-joined parts.
- Write R groups (R, R1, R2, Ar, X, Y …) inside SMILES as [*:n] with a distinct n per R name, and list the names with their n.
- Never invent a molecule, value or label that is not in the figure or text. If something is unreadable, leave it "" and say so in "note".`;

  const SCHEMA = {
    planner: `{"components":{"scheme":bool,"standalone":bool,"scope_panel":bool,"rgroup_table":bool,"conditions":bool,"text":bool},"note":""}`,
    template: `{"reactants":[{"label":"","smiles":"","name":""}],"products":[{"label":"","smiles":"","name":""}],"rgroups":[{"name":"R1","map":1}],"arrow_text":[""],"note":""}`,
    molecules: `{"molecules":[{"label":"","smiles":"","name":"","role":"catalyst|ligand|reagent|additive|product|other"}],"note":""}`,
    scope: `{"entries":[{"label":"","product_smiles":"","reactants":[{"label":"","smiles":""}],"yield":"","ee":"","dr":"","note":""}],"note":""}`,
    rtable: `{"columns":["R1"],"rows":[{"label":"","values":{"R1":""},"yield":"","ee":"","dr":"","note":""}],"note":""}`,
    conditions: `{"conditions":[{"text":"","role":"catalyst|ligand|reagent|base|acid|oxidant|reductant|additive|solvent|temperature|time|atmosphere|light|other","name":"","amount":"","smiles":""}],"note":""}`,
    text: `{"reactions":[{"reactants":[{"label":"","name":"","smiles":""}],"products":[{"label":"","name":"","smiles":""}],"conditions":[{"text":"","role":""}],"yield":"","sentence":""}],"entities":[{"text":"","type":"compound|reagent|solvent|catalyst|condition|yield"}],"note":""}`,
    verify: `{"reactions":[{"id":"","reactants":"yes|no|unsure","products":"yes|no|unsure","conditions":"yes|no|unsure","yield":"yes|no|unsure","note":""}]}`
  };

  const TASK = {
    planner: `You plan the extraction of chemical information from one figure of a chemistry paper.
Decide which components the figure contains (several may be present):
- scheme: a reaction scheme (arrow from reactants to products).
- standalone: molecules drawn outside the scheme (catalysts, ligands, additives, reference compounds), or a figure that is only molecules.
- scope_panel: a substrate-scope panel where each cell is a COMPLETE product or substrate structure, usually with a label and yield.
- rgroup_table: a table whose rows give only substituent values (R, R1, Ar, X … as text such as "Me", "4-MeOC6H4", or drawn fragments with wavy bonds).
- conditions: reaction conditions (above/below the arrow, or a conditions table: catalyst, solvent, temperature, time …).
- text: a caption or sentences describing reactions or compounds.
The deciding question between scope_panel and rgroup_table is what a cell holds: a whole molecule means scope_panel, a substituent means rgroup_table.`,
    template: `You read the main reaction scheme of the figure. List every reactant and product drawn in the scheme with its label and SMILES. Reagents written as text over or under the arrow are NOT reactants: copy each line of that text into "arrow_text" instead. If the scheme is general (R groups), write the general structures with [*:n] and list the R names in "rgroups".`,
    molecules: `You read the molecules drawn in the figure OUTSIDE the main reaction scheme (catalysts, ligands, additives, reference compounds), or every molecule when the figure has no scheme. Give each one's label, SMILES, name if printed, and its role.`,
    scope: `You read a substrate-scope panel. Each cell shows a complete product (sometimes the substrate) with a label such as "3a" and a yield. For EVERY cell, in reading order, give the label, the full product SMILES (no R groups: the actual structure drawn), the variable reactants if you can deduce them from the general scheme, and the yield / ee / dr as printed. Do not skip or merge cells; count them before answering.`,
    rtable: `You read an R-group table. Give the column names that hold substituents (R, R1, R2, Ar, X …) in "columns", then one row per table row: its label (the product number such as "3a"), the value of each substituent column exactly as printed (e.g. "4-MeOC6H4", "Me", "H", "2-thienyl"), and the yield / ee / dr. If a substituent is drawn as a structure, give it as SMILES starting with * at the attachment point (e.g. "*c1ccccc1"). Do not skip rows; count them before answering.`,
    conditions: `You read the reaction conditions in the figure: the text over and under the arrow, and any conditions table or footnote. Give one entry per species or setting, with the original text, its role, the name, the amount (mol%, equiv, mmol, M …) and a SMILES only for a molecule you are certain of. Temperature, time, atmosphere and light are separate entries without SMILES. A solvent mixture such as "toluene/H2O (4:1)" is one entry per solvent.`,
    text: `You read the text below (a caption or a paragraph from a chemistry paper). Extract every reaction it describes (reactants, products, conditions, yield, with compound labels such as "3a" kept), and list the chemical entities it names. Give a SMILES only when you are certain of it; otherwise give the name.`,
    verify: `You check an extraction against the figure. For each reaction below, answer whether its reactants, products, conditions and yield match what the figure shows: "yes", "no" or "unsure". Judge only what you can see; say what is wrong in "note".`
  };

  /**
   * The messages for one agent call. ctx: {text, template, columns, reactions} — what earlier steps found.
   * @returns {{system:string, user:string}}
   */
  function prompt(id, ctx = {}) {
    if (!TASK[id]) throw new Error(`unknown agent ${id}`);
    let user = `Answer with this JSON shape:\n${SCHEMA[id]}\n\n${RULES}`;
    if (id === 'planner' && ctx.text) user += `\n\nThe user also pasted this text from the paper (it counts as "text"):\n${clip(ctx.text, 1500)}`;
    if ((id === 'rtable' || id === 'scope') && ctx.template) user += `\n\nThe general scheme was read as:\n${JSON.stringify(ctx.template).slice(0, 2500)}\nUse the same R names.`;
    if (id === 'conditions' && ctx.template?.arrow_text?.length) user += `\n\nThe arrow text was read as:\n${ctx.template.arrow_text.join('\n')}`;
    if (id === 'text') user += `\n\nTEXT:\n${clip(ctx.text || '', 12000)}`;
    if (id === 'verify') user += `\n\nEXTRACTION:\n${JSON.stringify(compactForReview(ctx.reactions || [])).slice(0, 9000)}`;
    if (ctx.caption && id !== 'text' && id !== 'planner') user += `\n\nCaption / nearby text from the paper (context only):\n${clip(ctx.caption, 1500)}`;
    return { system: TASK[id], user };
  }
  const clip = (s, n) => (String(s).length > n ? String(s).slice(0, n) + ' …' : String(s));
  function compactForReview(rxns) {
    return rxns.map((r) => ({ id: r.id, reactants: r.reactants.map((m) => [m.label, m.smiles].filter(Boolean).join(' ')), products: r.products.map((m) => [m.label, m.smiles].filter(Boolean).join(' ')), conditions: r.conditions.filter((c) => c.role !== 'yield').map((c) => c.text), yield: r.yield?.text || '' }));
  }

  // ── 规划和计划核对 ───────────────────────────────────────────────────────
  /**
   * The plan observer: which extractors run, in order, from the planner's components. Deterministic rules
   * (the same ones ChemEAGLE's planner prompt states), each change explained in notes.
   */
  function plan(components, { hasText = false, hasImage = true } = {}) {
    const c = { ...(components || {}) };
    const notes = [];
    if (!hasImage) {
      return { agents: hasText ? ['text'] : [], notes: hasText ? [] : [{ zh: '没有图也没有文字，没什么可读的。', en: 'No figure and no text: nothing to read.' }] };
    }
    if (c.scope_panel && c.rgroup_table) {
      c.rgroup_table = false;
      notes.push({ zh: '图里既有结构底物表又有 R 基团表：按规则只用结构底物表（它给的是完整产物）。', en: 'Both a scope panel and an R-group table: by rule only the scope panel is read (it gives whole products).' });
    }
    if (c.scheme && !c.conditions) {
      c.conditions = true;
      notes.push({ zh: '有反应式却没标条件：箭头附近通常有条件，补上“条件”一步。', en: 'A scheme with no conditions marked: arrows nearly always carry some, so the conditions step is added.' });
    }
    if ((c.scope_panel || c.rgroup_table) && !c.scheme) {
      c.scheme = true;
      notes.push({ zh: '有底物表就要有通式：补上“反应式”一步，代入 R 基团时要用。', en: 'A scope table needs its general scheme: the template step is added for the substitution.' });
    }
    if (hasText && !c.text) { c.text = true; notes.push({ zh: '你贴了文字：加上“文字”一步。', en: 'You pasted text: the text step is added.' }); }
    if (!hasText && c.text) { c.text = false; notes.push({ zh: '图里有说明文字，但没有贴正文：文字一步跳过（图里的字由其他步骤一起读）。', en: 'The figure has text but none was pasted: the text step is skipped (the other steps read the figure’s own words).' }); }
    const agents = [];
    if (c.scheme) agents.push('template');
    if (c.standalone) agents.push('molecules');
    if (c.scope_panel) agents.push('scope');
    if (c.rgroup_table) agents.push('rtable');
    if (c.conditions) agents.push('conditions');
    if (c.text) agents.push('text');
    if (!agents.length) { agents.push('molecules'); notes.push({ zh: '规划没认出任何部分：当成一张分子图来读。', en: 'The planner found nothing: the figure is read as molecules.' }); }
    return { agents, notes, components: c };
  }

  // ── SMILES：切词、元素、R 基团代入 ─────────────────────────────────────────
  const TOKEN = /(\[[^\]]*\])|(Br|Cl|[BCNOPSFIbcnops*])|(%\d\d|\d)|([-=#$:/\\.~])|(\()|(\))|(\S)/g;
  /** SMILES → tokens {t, type: atom|ring|bond|open|close|bad}. */
  function tokens(smiles) {
    const out = [];
    for (const m of String(smiles || '').trim().matchAll(TOKEN)) {
      const type = m[1] || m[2] ? 'atom' : m[3] ? 'ring' : m[4] ? 'bond' : m[5] ? 'open' : m[6] ? 'close' : 'bad';
      out.push({ t: m[0], type });
    }
    return out;
  }
  const join = (toks) => toks.map((x) => x.t).join('');
  /** The R-group number of a dummy atom token, or -1. [*:2] → 2, [2*] → 2, * → 0. */
  function dummyMap(tok) {
    if (tok.type !== 'atom') return -1;
    if (tok.t === '*') return 0;
    const m = /^\[(\d*)\*(?::(\d+))?\]$/.exec(tok.t);
    return m ? Number(m[2] || m[1] || 0) : -1;
  }
  /** Models often write [R1] or [R]; make them dummies. [Rb], [Ru] … are elements and stay. */
  const normalizeR = (smiles) => String(smiles || '').trim().replace(/\[R(\d*)'?\]/g, (_, n) => `[*:${n || 0}]`);
  const hasDummy = (smiles) => tokens(normalizeR(smiles)).some((x) => dummyMap(x) >= 0);
  /** Element symbols in a SMILES (aromatic written as upper case; H only when written in brackets). */
  function elements(smiles) {
    const out = new Set();
    for (const x of tokens(smiles)) {
      if (x.type !== 'atom' || dummyMap(x) >= 0) continue;
      const m = x.t.startsWith('[') ? /^\[\d*([A-Z][a-z]?|[bcnops]|se|as)/.exec(x.t) : [x.t, x.t];
      if (!m) continue;
      let s = m[1];
      if (/^[a-z]/.test(s)) s = s[0].toUpperCase() + s.slice(1);
      if (s === 'H' && x.t.startsWith('[')) continue;
      out.add(s);
    }
    return [...out];
  }
  /** A quick syntax check that needs no RDKit: balanced branches, ring bonds closed, no stray characters. */
  function syntaxOk(smiles) {
    const toks = tokens(smiles);
    if (!toks.length || toks.some((x) => x.type === 'bad')) return false;
    let depth = 0;
    const rings = new Map();
    let prevAtom = false;
    for (const x of toks) {
      if (x.type === 'open') { if (!prevAtom) return false; depth++; }
      else if (x.type === 'close') { depth--; if (depth < 0) return false; }
      else if (x.type === 'ring') { if (!prevAtom) return false; rings.set(x.t, !rings.get(x.t)); }
      else if (x.type === 'atom') prevAtom = true;
      else if (x.t === '.') prevAtom = false;
    }
    return depth === 0 && [...rings.values()].every((open) => !open);
  }

  const ringLabel = (n) => (n < 10 ? String(n) : `%${n}`);
  const ringNum = (t) => Number(t.replace('%', ''));
  /** Split leading branch groups "(...)(...)" off a token list. */
  function leadingBranches(toks) {
    let i = 0;
    while (i < toks.length && toks[i].type === 'open') {
      let d = 0;
      for (; i < toks.length; i++) { if (toks[i].type === 'open') d++; else if (toks[i].type === 'close' && --d === 0) { i++; break; } }
    }
    return [toks.slice(0, i), toks.slice(i)];
  }
  /**
   * Put fragment SMILES (attachment point written first, as "*…") in place of one dummy atom of a core SMILES.
   * Ring-bond numbers of the fragment are renumbered so they cannot clash with the core's.
   * @returns {string|null} null when the fragment cannot be attached this way.
   */
  function attach(coreToks, at, frag) {
    const f = tokens(normalizeR(frag));
    if (!f.length || dummyMap(f[0]) < 0) return null;
    let k = 1, bond = '';
    if (f[k]?.type === 'bond' && f[k].t !== '.') bond = f[k++].t;
    let body = f.slice(k);
    if (!body.length || body[0].type !== 'atom' || body.some((x) => x.type === 'bad' || dummyMap(x) >= 0 || x.t === '.')) return null;
    if (coreToks[at + 1]?.type === 'ring') return null; // a dummy that closes a ring: not a substituent
    // renumber the fragment's ring bonds
    const used = new Set(coreToks.filter((x) => x.type === 'ring').map((x) => ringNum(x.t)));
    const remap = new Map();
    let next = 1;
    body = body.map((x) => {
      if (x.type !== 'ring') return x;
      const n = ringNum(x.t);
      if (!remap.has(n)) { while (used.has(next)) next++; remap.set(n, next); used.add(next); }
      return { t: ringLabel(remap.get(n)), type: 'ring' };
    });
    // the attachment atom with its own ring bonds, then the rest
    let i = 1;
    while (i < body.length && (body[i].type === 'ring' || (body[i].type === 'bond' && body[i + 1]?.type === 'ring'))) i += body[i].type === 'ring' ? 1 : 2;
    const head = body.slice(0, i), rest = body.slice(i);
    const follows = coreToks[at + 1] && coreToks[at + 1].type !== 'close' && coreToks[at + 1].t !== '.';
    let repl;
    if (follows && rest.length) {
      const [branches, chain] = leadingBranches(rest);
      repl = join(head) + join(branches) + (chain.length ? `(${join(chain)})` : '');
    } else repl = join(head) + join(rest);
    const before = coreToks[at - 1];
    if (bond && !(before?.type === 'bond' && before.t !== '.')) repl = bond + repl;
    return join(coreToks.slice(0, at)) + repl + join(coreToks.slice(at + 1));
  }
  /**
   * Fill every dummy in a core SMILES whose number has a fragment. values: {mapNumber: fragmentSmiles}.
   * @returns {{smiles:string, missing:number[], failed:number[]}}
   */
  function substitute(core, values) {
    let s = normalizeR(core);
    const missing = new Set(), failed = new Set();
    for (let guard = 0; guard < 40; guard++) {
      const toks = tokens(s);
      const at = toks.findIndex((x) => { const n = dummyMap(x); return n >= 0 && values[n] != null && !failed.has(n); });
      if (at < 0) break;
      const n = dummyMap(toks[at]);
      const out = attach(toks, at, values[n]);
      if (out == null) { failed.add(n); continue; }
      s = out;
    }
    for (const x of tokens(s)) { const n = dummyMap(x); if (n >= 0 && !failed.has(n)) missing.add(n); }
    return { smiles: s, missing: [...missing], failed: [...failed] };
  }

  // ── 取代基缩写 → 片段 SMILES（* 是连接点）────────────────────────────────
  const SUBSTITUENTS = {
    H: '*[H]', D: '*[2H]', Me: '*C', Et: '*CC', 'n-Pr': '*CCC', iPr: '*C(C)C', 'n-Bu': '*CCCC', iBu: '*CC(C)C', sBu: '*C(C)CC', tBu: '*C(C)(C)C',
    'n-Pent': '*CCCCC', 'n-Hex': '*CCCCCC', Ph: '*c1ccccc1', Bn: '*Cc1ccccc1', Bz: '*C(=O)c1ccccc1', Ac: '*C(C)=O', Piv: '*C(=O)C(C)(C)C',
    OMe: '*OC', OEt: '*OCC', OiPr: '*OC(C)C', OtBu: '*OC(C)(C)C', OPh: '*Oc1ccccc1', OBn: '*OCc1ccccc1', OAc: '*OC(C)=O', OH: '*O', OCF3: '*OC(F)(F)F', OTf: '*OS(=O)(=O)C(F)(F)F', OTs: '*OS(=O)(=O)c1ccc(C)cc1', OTBS: '*O[Si](C)(C)C(C)(C)C',
    SH: '*S', SMe: '*SC', SPh: '*Sc1ccccc1', NH2: '*N', NHMe: '*NC', NMe2: '*N(C)C', NEt2: '*N(CC)CC', NHAc: '*NC(C)=O', NHBoc: '*NC(=O)OC(C)(C)C', NO2: '*[N+](=O)[O-]', N3: '*N=[N+]=[N-]',
    CN: '*C#N', CF3: '*C(F)(F)F', CHF2: '*C(F)F', F: '*F', Cl: '*Cl', Br: '*Br', I: '*I',
    CO2Me: '*C(=O)OC', CO2Et: '*C(=O)OCC', CO2tBu: '*C(=O)OC(C)(C)C', CO2Bn: '*C(=O)OCc1ccccc1', CO2H: '*C(=O)O', CHO: '*C=O', CONH2: '*C(N)=O', CONMe2: '*C(=O)N(C)C', COMe: '*C(C)=O',
    Ts: '*S(=O)(=O)c1ccc(C)cc1', Ms: '*S(=O)(=O)C', SO2Ph: '*S(=O)(=O)c1ccccc1', Tf: '*S(=O)(=O)C(F)(F)F', Boc: '*C(=O)OC(C)(C)C', Cbz: '*C(=O)OCc1ccccc1', Fmoc: '*C(=O)OCC1c2ccccc2-c2ccccc21',
    TMS: '*[Si](C)(C)C', TES: '*[Si](CC)(CC)CC', TBS: '*[Si](C)(C)C(C)(C)C', TIPS: '*[Si](C(C)C)(C(C)C)C(C)C', Bpin: '*B1OC(C)(C)C(C)(C)O1', 'B(OH)2': '*B(O)O',
    vinyl: '*C=C', allyl: '*CC=C', ethynyl: '*C#C', propargyl: '*CC#C', cPr: '*C1CC1', cBu: '*C1CCC1', cPent: '*C1CCCC1', Cy: '*C1CCCCC1', Ad: '*C12CC3CC(CC(C3)C1)C2',
    '1-naphthyl': '*c1cccc2ccccc12', '2-naphthyl': '*c1ccc2ccccc2c1', '2-thienyl': '*c1cccs1', '3-thienyl': '*c1ccsc1', '2-furyl': '*c1ccco1', '3-furyl': '*c1ccoc1',
    '2-pyridyl': '*c1ccccn1', '3-pyridyl': '*c1cccnc1', '4-pyridyl': '*c1ccncc1', Mes: '*c1c(C)cc(C)cc1C', Tol: '*c1ccc(C)cc1', PMP: '*c1ccc(OC)cc1', Fc: null
  };
  delete SUBSTITUENTS.Fc;
  /** Other ways papers write the same groups. Keys are compared case-sensitively after trimming. */
  const ALIASES = {
    Pr: 'n-Pr', nPr: 'n-Pr', 'i-Pr': 'iPr', Bu: 'n-Bu', nBu: 'n-Bu', 'i-Bu': 'iBu', 's-Bu': 'sBu', 't-Bu': 'tBu', nPent: 'n-Pent', nHex: 'n-Hex',
    MeO: 'OMe', EtO: 'OEt', iPrO: 'OiPr', tBuO: 'OtBu', PhO: 'OPh', BnO: 'OBn', AcO: 'OAc', HO: 'OH', F3CO: 'OCF3', TfO: 'OTf', TsO: 'OTs', TBSO: 'OTBS',
    HS: 'SH', MeS: 'SMe', PhS: 'SPh', H2N: 'NH2', MeHN: 'NHMe', Me2N: 'NMe2', Et2N: 'NEt2', AcHN: 'NHAc', BocHN: 'NHBoc', O2N: 'NO2',
    NC: 'CN', F3C: 'CF3', HF2C: 'CHF2', MeO2C: 'CO2Me', EtO2C: 'CO2Et', tBuO2C: 'CO2tBu', HO2C: 'CO2H', COOMe: 'CO2Me', COOEt: 'CO2Et', COOH: 'CO2H', COOtBu: 'CO2tBu', OHC: 'CHO', H2NOC: 'CONH2', MeOC: 'COMe',
    MeSO2: 'Ms', SO2Me: 'Ms', PhSO2: 'SO2Ph', pinB: 'Bpin', BPin: 'Bpin', Me3Si: 'TMS', C6H5: 'Ph', phenyl: 'Ph', benzyl: 'Bn', methyl: 'Me', ethyl: 'Et', hydrogen: 'H',
    'c-Pr': 'cPr', cyclopropyl: 'cPr', 'c-Bu': 'cBu', cyclobutyl: 'cBu', 'c-Pent': 'cPent', cyclopentyl: 'cPent', 'c-Hex': 'Cy', cHex: 'Cy', cyclohexyl: 'Cy', C6H11: 'Cy', '1-adamantyl': 'Ad',
    '1-Naph': '1-naphthyl', '2-Naph': '2-naphthyl', '1-Np': '1-naphthyl', '2-Np': '2-naphthyl', 'α-naphthyl': '1-naphthyl', 'β-naphthyl': '2-naphthyl', '2-thiophenyl': '2-thienyl', '3-thiophenyl': '3-thienyl', '2-Py': '2-pyridyl', '3-Py': '3-pyridyl', '4-Py': '4-pyridyl',
    'p-Tol': 'Tol', 'p-tolyl': 'Tol', tolyl: 'Tol', mesityl: 'Mes', 'p-MeOC6H4': 'PMP'
  };
  const lookupGroup = (v) => {
    const k = ALIASES[v] || v;
    if (SUBSTITUENTS[k]) return SUBSTITUENTS[k];
    const lower = Object.keys(SUBSTITUENTS).find((x) => x.toLowerCase() === String(v).toLowerCase() && x.length > 2);
    return lower ? SUBSTITUENTS[lower] : null;
  };
  /** A phenyl ring with the attachment at C1 and fragments at given positions (2–6). */
  function aryl(subs) {
    let s = '*c1';
    for (let p = 2; p <= 6; p++) {
      const f = subs[p];
      let part = 'c';
      if (f) {
        const body = f.replace(/^\*/, '');
        // ring bonds inside the substituent must not reuse 1 (the phenyl's own)
        part += `(${body.replace(/(%\d\d|\d)/g, (d) => ringLabel(ringNum(d) + 1))})`;
      }
      s += part + (p === 6 ? '1' : '');
    }
    return s;
  }
  /**
   * A substituent as printed in a table → fragment SMILES starting with *, or null.
   * Understands the abbreviation table, "4-MeOC6H4", "3,5-(CF3)2C6H3", "p-ClC6H4", "4-F-Ph", "n-C5H11", and SMILES with *.
   */
  function fragment(value) {
    let v = String(value ?? '').trim().replace(/[–—−]/g, '-').replace(/\s+/g, '').replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080));
    if (!v) return null;
    if (v.includes('*') && syntaxOk(v)) return v.startsWith('*') || v.startsWith('[*') ? normalizeR(v) : null;
    const direct = lookupGroup(v);
    if (direct) return direct;
    // linear alkyl C_nH_{2n+1}
    let m = /^(?:n-)?C(\d{1,2})H(\d{1,2})$/.exec(v);
    if (m && +m[2] === 2 * +m[1] + 1) return '*' + 'C'.repeat(+m[1]);
    // substituted phenyl
    m = /^(?:\(?((?:\d,?)+|[opm])\)?-)(.+?)-?(?:C6H[2345]|Ph|phenyl)$/.exec(v);
    if (m) {
      const pos = /^[opm]$/.test(m[1]) ? [{ o: 2, m: 3, p: 4 }[m[1]]] : m[1].split(',').filter(Boolean).map(Number);
      let x = m[2], count = 1;
      const mult = /^\((.+)\)(\d)$/.exec(x) || /^(.+?)(\d)$/.exec(x);
      if (mult && lookupGroup(mult[1]) && !lookupGroup(x)) { x = mult[1]; count = +mult[2]; }
      const f = lookupGroup(x);
      if (!f || count !== pos.length || pos.some((p) => p < 2 || p > 6)) return null;
      const subs = {};
      pos.forEach((p) => { subs[p] = f; });
      return aryl(subs);
    }
    return null;
  }

  // ── 常见试剂和溶剂 → SMILES ─────────────────────────────────────────────
  // [SMILES, 分子式（Hill，tools/extract-test.mjs 用 OpenChemLib 逐条核对）, 名字和缩写……]
  const REAGENTS = [
    ['C1CCOC1', 'C4H8O', 'THF', 'tetrahydrofuran'], ['CC1CCCO1', 'C5H10O', '2-MeTHF', '2-methyltetrahydrofuran'], ['ClCCl', 'CH2Cl2', 'DCM', 'CH2Cl2', 'dichloromethane'],
    ['ClC(Cl)Cl', 'CHCl3', 'CHCl3', 'chloroform'], ['ClCCCl', 'C2H4Cl2', 'DCE', '1,2-DCE', '1,2-dichloroethane', '(CH2Cl)2'], ['CN(C)C=O', 'C3H7NO', 'DMF', 'N,N-dimethylformamide'],
    ['CC(=O)N(C)C', 'C4H9NO', 'DMA', 'DMAc', 'N,N-dimethylacetamide'], ['CS(C)=O', 'C2H6OS', 'DMSO', 'dimethyl sulfoxide'], ['CN1CCCC1=O', 'C5H9NO', 'NMP'],
    ['CC#N', 'C2H3N', 'MeCN', 'CH3CN', 'acetonitrile'], ['CO', 'CH4O', 'MeOH', 'methanol'], ['CCO', 'C2H6O', 'EtOH', 'ethanol'], ['CC(C)O', 'C3H8O', 'iPrOH', 'i-PrOH', 'IPA', 'isopropanol', '2-propanol'],
    ['CC(C)(C)O', 'C4H10O', 'tBuOH', 't-BuOH', 'tert-butanol'], ['OC(C(F)(F)F)C(F)(F)F', 'C3H2F6O', 'HFIP', 'hexafluoroisopropanol'], ['OCC(F)(F)F', 'C2H3F3O', 'TFE', '2,2,2-trifluoroethanol'],
    ['O', 'H2O', 'H2O', 'water', 'aq.'], ['Cc1ccccc1', 'C7H8', 'toluene', 'PhMe', 'PhCH3'], ['c1ccccc1', 'C6H6', 'benzene', 'PhH', 'C6H6'], ['Cc1ccccc1C', 'C8H10', 'o-xylene'], ['Cc1cccc(C)c1', 'C8H10', 'm-xylene'],
    ['Cc1ccc(C)cc1', 'C8H10', 'p-xylene'], ['Cc1cc(C)cc(C)c1', 'C9H12', 'mesitylene'], ['CCCCCC', 'C6H14', 'hexane', 'n-hexane', 'hexanes'], ['CCCCCCC', 'C7H16', 'heptane', 'n-heptane'], ['CCCCC', 'C5H12', 'pentane', 'n-pentane'],
    ['CCOCC', 'C4H10O', 'Et2O', 'ether', 'diethyl ether'], ['COC(C)(C)C', 'C5H12O', 'MTBE', 'TBME'], ['C1COCCO1', 'C4H8O2', 'dioxane', '1,4-dioxane'], ['COCCOC', 'C4H10O2', 'DME', '1,2-dimethoxyethane'],
    ['CC(C)=O', 'C3H6O', 'acetone'], ['CCOC(C)=O', 'C4H8O2', 'EtOAc', 'AcOEt', 'ethyl acetate'], ['CC(=O)O', 'C2H4O2', 'AcOH', 'HOAc', 'acetic acid'], ['Clc1ccccc1', 'C6H5Cl', 'PhCl', 'chlorobenzene'],
    ['FC(F)(F)c1ccccc1', 'C7H5F3', 'PhCF3', 'trifluorotoluene', 'BTF'], ['c1ccncc1', 'C5H5N', 'pyridine', 'py'], ['OC(=O)C(F)(F)F', 'C2HF3O2', 'TFA', 'trifluoroacetic acid'],
    // bases
    ['O=C([O-])[O-].[K+].[K+]', 'CK2O3', 'K2CO3', 'potassium carbonate'], ['O=C([O-])[O-].[Na+].[Na+]', 'CNa2O3', 'Na2CO3', 'sodium carbonate'], ['O=C([O-])[O-].[Cs+].[Cs+]', 'CCs2O3', 'Cs2CO3', 'cesium carbonate', 'caesium carbonate'],
    ['O=C([O-])O.[Na+]', 'CHNaO3', 'NaHCO3', 'sodium bicarbonate'], ['O=P([O-])([O-])[O-].[K+].[K+].[K+]', 'K3O4P', 'K3PO4', 'potassium phosphate'], ['[K+].[OH-]', 'HKO', 'KOH'], ['[Na+].[OH-]', 'HNaO', 'NaOH'],
    ['[Li+].[OH-]', 'HLiO', 'LiOH'], ['[Na+].[H-]', 'HNa', 'NaH', 'sodium hydride'], ['CC(C)(C)[O-].[K+]', 'C4H9KO', 'KOtBu', 'tBuOK', 't-BuOK', 'KOt-Bu', 'potassium tert-butoxide'],
    ['CC(C)(C)[O-].[Na+]', 'C4H9NaO', 'NaOtBu', 'tBuONa', 't-BuONa', 'NaOt-Bu'], ['CC(=O)[O-].[K+]', 'C2H3KO2', 'KOAc', 'potassium acetate'], ['CC(=O)[O-].[Na+]', 'C2H3NaO2', 'NaOAc', 'sodium acetate'],
    ['CCN(CC)CC', 'C6H15N', 'Et3N', 'NEt3', 'TEA', 'triethylamine'], ['CCN(C(C)C)C(C)C', 'C8H19N', 'DIPEA', 'iPr2NEt', 'Hünig’s base', 'DIEA'], ['C1CCC2=NCCCN2CC1', 'C9H16N2', 'DBU'],
    ['CN(C)c1ccncc1', 'C7H10N2', 'DMAP'], ['C[Si](C)(C)[N-][Si](C)(C)C.[Li+]', 'C6H18LiNSi2', 'LiHMDS', 'LHMDS'], ['C[Si](C)(C)[N-][Si](C)(C)C.[K+]', 'C6H18KNSi2', 'KHMDS'],
    ['CC(C)[N-]C(C)C.[Li+]', 'C6H14LiN', 'LDA'], ['CCCC[Li]', 'C4H9Li', 'n-BuLi', 'nBuLi', 'BuLi'], ['[Cs+].[F-]', 'CsF', 'CsF'], ['[K+].[F-]', 'FK', 'KF'],
    // acids, oxidants, reductants, other reagents
    ['N', 'H3N', 'NH3', 'ammonia'], ['Cl', 'ClH', 'HCl'], ['Br', 'BrH', 'HBr'], ['O=S(=O)(O)O', 'H2O4S', 'H2SO4', 'sulfuric acid'], ['Cc1ccc(S(=O)(=O)O)cc1', 'C7H8O3S', 'TsOH', 'p-TsOH', 'PTSA', 'p-TSA'],
    ['O=S(=O)(O)C(F)(F)F', 'CHF3O3S', 'TfOH', 'triflic acid'], ['O=C1CCC(=O)N1Br', 'C4H4BrNO2', 'NBS'], ['O=C1CCC(=O)N1I', 'C4H4INO2', 'NIS'], ['O=C1CCC(=O)N1Cl', 'C4H4ClNO2', 'NCS'],
    ['O=C(OO)c1cccc(Cl)c1', 'C7H5ClO3', 'mCPBA', 'm-CPBA'], ['N#CC1=C(C#N)C(=O)C(Cl)=C(Cl)C1=O', 'C8Cl2N2O2', 'DDQ'], ['CCCC[N+](CCCC)(CCCC)CCCC.[F-]', 'C16H36FN', 'TBAF'],
    ['[BH4-].[Na+]', 'BH4Na', 'NaBH4'], ['[AlH4-].[Li+]', 'AlH4Li', 'LiAlH4', 'LAH'], ['CC(C)C[AlH]CC(C)C', 'C8H19Al', 'DIBAL', 'DIBAL-H', 'DIBALH'], ['[H][H]', 'H2', 'H2', 'hydrogen'],
    ['O=O', 'O2', 'O2', 'oxygen'], ['CC1(C)OB(B2OC(C)(C)C(C)(C)O2)OC1(C)C', 'C12H24B2O4', 'B2pin2', 'B2(pin)2', 'bis(pinacolato)diboron'], ['CC1(C)OBOC1(C)C', 'C6H13BO2', 'HBpin', 'pinacolborane'],
    ['C[Si](C)(C)Cl', 'C3H9ClSi', 'TMSCl', 'TMS-Cl', 'chlorotrimethylsilane'], ['CC(C)(C)OC(=O)OC(=O)OC(C)(C)C', 'C10H18O5', 'Boc2O', '(Boc)2O'], ['Cc1ccc(S(=O)(=O)Cl)cc1', 'C7H7ClO2S', 'TsCl'],
    ['CS(=O)(=O)Cl', 'CH3ClO2S', 'MsCl'], ['CC(=O)OC(C)=O', 'C4H6O3', 'Ac2O', 'acetic anhydride'], ['II', 'I2', 'I2', 'iodine'], ['BrBr', 'Br2', 'Br2', 'bromine'],
    ['CC(=O)OI(OC(C)=O)c1ccccc1', 'C10H11IO4', 'PhI(OAc)2', 'PIDA', 'DIB'], ['CC1(C)CCCC(C)(C)N1[O]', 'C9H18NO', 'TEMPO'], ['FB(F)F.CCOCC', 'C4H10BF3O', 'BF3·OEt2', 'BF3.OEt2', 'BF3•OEt2'],
    // metals and catalysts
    ['CC(=O)[O-].CC(=O)[O-].[Pd+2]', 'C4H6O4Pd', 'Pd(OAc)2', 'palladium acetate'], ['Cl[Pd]Cl', 'Cl2Pd', 'PdCl2'], ['[Pd]', 'Pd', 'Pd/C', 'Pd on carbon', 'Pd black'],
    ['[Pd].c1ccc(P(c2ccccc2)c2ccccc2)cc1.c1ccc(P(c2ccccc2)c2ccccc2)cc1.c1ccc(P(c2ccccc2)c2ccccc2)cc1.c1ccc(P(c2ccccc2)c2ccccc2)cc1', 'C72H60P4Pd', 'Pd(PPh3)4', 'tetrakis(triphenylphosphine)palladium'],
    ['[Pd].[Pd].O=C(/C=C/c1ccccc1)/C=C/c1ccccc1.O=C(/C=C/c1ccccc1)/C=C/c1ccccc1.O=C(/C=C/c1ccccc1)/C=C/c1ccccc1', 'C51H42O3Pd2', 'Pd2(dba)3', 'Pd2dba3'],
    ['c1ccc(P(c2ccccc2)c2ccccc2)cc1', 'C18H15P', 'PPh3', 'triphenylphosphine'], ['[Cu]I', 'CuI', 'CuI'], ['[Cu]Br', 'BrCu', 'CuBr'], ['[Cu]Cl', 'ClCu', 'CuCl'],
    ['CC(=O)[O-].CC(=O)[O-].[Cu+2]', 'C4H6CuO4', 'Cu(OAc)2'], ['[Ni].C1=CCCC=CCC1.C1=CCCC=CCC1', 'C16H24Ni', 'Ni(cod)2', 'Ni(COD)2'], ['Cl[Ni]Cl', 'Cl2Ni', 'NiCl2'],
    ['Cl[Fe](Cl)Cl', 'Cl3Fe', 'FeCl3'], ['Cl[Al](Cl)Cl', 'AlCl3', 'AlCl3'], ['Cl[Ti](Cl)(Cl)Cl', 'Cl4Ti', 'TiCl4'], ['[Zn]', 'Zn', 'Zn', 'zinc'], ['[Mg]', 'Mg', 'Mg', 'magnesium'],
    ['CC(=O)[O-].[Ag+]', 'C2H3AgO2', 'AgOAc'], ['O=C([O-])[O-].[Ag+].[Ag+]', 'CAg2O3', 'Ag2CO3'], ['[Ar]', 'Ar', 'Ar', 'argon'], ['N#N', 'N2', 'N2', 'nitrogen']
  ];
  const keyOf = (s) => String(s || '').trim().toLowerCase().replace(/[\s·•.‧∙]+/g, '').replace(/[‐-―−]/g, '-').replace(/[₀-₉]/g, (d) => String(d.charCodeAt(0) - 0x2080)).replace(/[’']/g, '');
  const REAGENT_INDEX = new Map();
  for (const [smiles, formula, ...names] of REAGENTS) for (const n of names) if (!REAGENT_INDEX.has(keyOf(n))) REAGENT_INDEX.set(keyOf(n), { smiles, formula, name: names[0] });
  /** A reagent or solvent name → {smiles, formula, name} from the built-in table, or null. */
  const reagent = (name) => REAGENT_INDEX.get(keyOf(name)) || null;

  // ── 条件：拆分、归类、产率 ───────────────────────────────────────────────
  /** Split a conditions line at commas / semicolons / line breaks that are not inside brackets. */
  function splitConditions(text) {
    const out = [];
    let depth = 0, cur = '';
    for (const ch of String(text || '')) {
      if ('([{'.includes(ch)) depth++;
      if (')]}'.includes(ch)) depth = Math.max(0, depth - 1);
      if (depth === 0 && /[,;，；\n]/.test(ch)) { if (cur.trim()) out.push(cur.trim()); cur = ''; continue; }
      cur += ch;
    }
    if (cur.trim()) out.push(cur.trim());
    return out;
  }
  const AMOUNT = /\s*\(?\s*((?:\d+(?:\.\d+)?|\d*\.\d+)\s*(?:–|-|~|to)?\s*(?:\d+(?:\.\d+)?)?\s*(?:mol\s*%|mol%|equiv\.?|eq\.?|mmol|mol|mg|g|mL|ml|μL|uL|µL|M|mM|N|wt\s*%|%|bar|atm|psi))\s*\)?\s*/i;
  /** One condition piece → {text, role, name, amount, smiles?}. The role is guessed by rule; a role given by the model wins unless the text says otherwise. */
  function classify(piece, givenRole = '') {
    const text = String(piece || '').trim();
    const t = text.replace(/\s+/g, ' ');
    const out = { text, role: '', name: '', amount: '' };
    if (/(-?\d+(?:\.\d+)?\s*(?:°|º|˚|℃)\s*C?|\b\d+\s*K\b|\brt\b|r\.\s?t\.|room temp|reflux|\bambient temperature\b)/i.test(t) && !/mol|equiv/i.test(t)) out.role = 'temperature';
    else if (/^(?:\d+(?:\.\d+)?\s*(?:–|-|to)?\s*\d*(?:\.\d+)?\s*(?:h|hr|hrs|hours?|min|mins|minutes?|d|days?|s)|overnight|o\/n)$/i.test(t)) out.role = 'time';
    else if (/\b(?:yield|ee|er|dr|d\.r\.|e\.r\.)\b/i.test(t) || /^\d+(?:\.\d+)?\s*%$/.test(t)) out.role = 'yield';
    else if (/^(?:under\s+|in\s+)?(?:N2|Ar|argon|nitrogen|air|O2(?:\s*balloon)?|H2\s*\(?(?:balloon|\d+\s*(?:atm|bar|psi))\)?|CO\s*\(?\d*\s*(?:atm|bar)\)?)(?:\s*atmosphere)?$/i.test(t)) out.role = 'atmosphere';
    else if (/(\bLEDs?\b|\bhν\b|\bhv\b|\blight\b|\d+\s*nm\b|\bvisible\b|\bUV\b|\bCFL\b|\blamp\b)/i.test(t)) out.role = 'light';
    if (out.role) return out;
    const am = AMOUNT.exec(t);
    let name = t;
    if (am) { out.amount = am[1].replace(/\s+/g, ' ').trim(); name = (t.slice(0, am.index) + ' ' + t.slice(am.index + am[0].length)).trim(); }
    name = name.replace(/^(?:cat\.|catalyst|then|and)\s+/i, '').replace(/\s*\((?:\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?|v\/v)[^)]*\)\s*$/i, '').trim();
    out.name = name;
    const known = reagent(name);
    if (known) out.smiles = known.smiles;
    const SOLVENTS = /^(?:THF|2-MeTHF|DCM|CH2Cl2|CHCl3|DCE|DMF|DMA|DMAc|DMSO|NMP|MeCN|CH3CN|MeOH|EtOH|i-?PrOH|t-?BuOH|HFIP|TFE|H2O|water|toluene|PhMe|benzene|xylenes?|mesitylene|hexanes?|heptane|pentane|Et2O|MTBE|(?:1,4-)?dioxane|DME|acetone|EtOAc|AcOH|PhCl|PhCF3|pyridine)$/i;
    const role = String(givenRole || '').toLowerCase();
    if (SOLVENTS.test(name) && !out.amount.match(/equiv|mol|mmol|eq/i)) out.role = 'solvent';
    else if (/mol\s*%/i.test(out.amount)) out.role = ['ligand', 'catalyst'].includes(role) ? role : 'catalyst';
    else out.role = ROLES.includes(role) && !['temperature', 'time', 'yield', 'atmosphere', 'light', 'solvent'].includes(role) ? role : 'reagent';
    return out;
  }
  const ROLES = ['catalyst', 'ligand', 'reagent', 'base', 'acid', 'oxidant', 'reductant', 'additive', 'solvent', 'temperature', 'time', 'atmosphere', 'light', 'yield', 'other'];
  /** Split "toluene/H2O (4:1)" into its solvents when every part is a known solvent; otherwise leave it. */
  function splitMixture(c) {
    if (c.role !== 'solvent' && !/\//.test(c.text)) return [c];
    const base = c.text.replace(/\s*\(([^)]*)\)\s*$/, '');
    const ratio = (/\(([^)]*)\)\s*$/.exec(c.text) || [])[1] || '';
    const parts = base.split('/').map((s) => s.trim()).filter(Boolean);
    if (parts.length < 2 || !parts.every((p) => reagent(p))) return [c];
    return parts.map((p) => ({ text: c.text, role: 'solvent', name: p, amount: ratio, smiles: reagent(p).smiles }));
  }
  /** "92%", "92% yield", "85 (90:10 er)", "trace", "n.d." → {value, ee, dr, text}. */
  function parseYield(s) {
    const text = String(s ?? '').trim();
    const out = { text, value: null, ee: '', dr: '' };
    if (!text) return out;
    const ee = /(\d+(?:\.\d+)?)\s*%?\s*ee/i.exec(text); if (ee) out.ee = `${ee[1]}%`;
    const er = /(\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?)\s*(?:er|e\.r\.)/i.exec(text); if (er && !out.ee) out.ee = `${er[1]} er`;
    const dr = /(?:(>?\s*\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?)\s*(?:dr|d\.r\.)|(?:dr|d\.r\.)\s*[=:]?\s*(\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?|>\s*\d+\s*:\s*1))/i.exec(text); if (dr) out.dr = (dr[1] || dr[2]).replace(/\s+/g, '');
    const cleaned = text.replace(/(\d+(?:\.\d+)?)\s*%?\s*ee/ig, '').replace(/\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?\s*(?:er|e\.r\.|dr|d\.r\.)/ig, '').replace(/(?:dr|d\.r\.)\s*[=:]?\s*>?\s*\d+(?:\.\d+)?\s*:\s*\d+(?:\.\d+)?/ig, '');
    const y = /(?:^|[^\d.:])(\d+(?:\.\d+)?)\s*%/.exec(' ' + cleaned) || /^\s*(\d+(?:\.\d+)?)\s*(?:\(|$|yield)/i.exec(cleaned);
    if (y) out.value = Number(y[1]);
    else if (/\b(trace|n\.?d\.?|n\.?r\.?|<\s*5\s*%|no reaction)\b/i.test(text)) out.value = 0;
    return out;
  }

  // ── 编号 ────────────────────────────────────────────────────────────────
  /** The label a variable template molecule gets in one table row: template "1" + row "3a" (product "3") → "1a". */
  function relabel(templateLabel, rowLabel, productLabel) {
    const t = String(templateLabel || '').trim(), r = String(rowLabel || '').trim(), p = String(productLabel || '').trim();
    if (!r) return t;
    let suffix = '';
    if (p && r.startsWith(p) && r.length > p.length) suffix = r.slice(p.length);
    else { const m = /^\d+([a-z]{1,2}'?)$/i.exec(r); if (m) suffix = m[1]; else if (/^[a-z]{1,2}$/i.test(r)) suffix = r; }
    if (!t) return '';
    return suffix ? t + suffix : `${t} (${r})`;
  }

  // ── 汇总 ────────────────────────────────────────────────────────────────
  const mol = (m = {}) => ({ label: String(m.label ?? '').trim(), smiles: normalizeR(m.smiles ?? ''), name: String(m.name ?? '').trim() });
  /** Conditions from the conditions agent (preferred) or from the arrow text, each normalised; molecules referenced by label get their SMILES. */
  function conditionsOf(out, molecules) {
    let list = Array.isArray(out.conditions?.conditions) ? out.conditions.conditions : null;
    if (!list || !list.length) list = (out.template?.arrow_text || []).flatMap(splitConditions).map((t) => ({ text: t }));
    const byLabel = new Map(molecules.filter((m) => m.label && m.smiles).map((m) => [keyOf(m.label), m]));
    const res = [];
    for (const c0 of list) {
      const text = String(c0.text || c0.name || '').trim();
      if (!text) continue;
      const pieces = splitConditions(text).length > 1 && !c0.role ? splitConditions(text) : [text];
      for (const piece of pieces) {
        const c = classify(piece, c0.role);
        if (c0.name && !reagent(c.name) && reagent(c0.name)) { c.name = String(c0.name); c.smiles = reagent(c0.name).smiles; }
        if (c0.amount && !c.amount) c.amount = String(c0.amount);
        const ref = byLabel.get(keyOf(c.name)) || byLabel.get(keyOf(String(c0.name || '')));
        if (ref) { c.smiles = ref.smiles; c.label = ref.label; }
        if (!c.smiles && c0.smiles && !['temperature', 'time', 'yield', 'atmosphere', 'light'].includes(c.role)) c.smiles = String(c0.smiles).trim();
        if (c.role === 'yield') continue; // yields belong to each reaction
        res.push(...splitMixture(c));
      }
    }
    return res;
  }
  /** The R name → map number table, from the template agent, else from the names (R1 → 1, R → 1 when alone). */
  function rMap(template, names) {
    const map = new Map();
    for (const g of template?.rgroups || []) if (g?.name != null) map.set(String(g.name).trim(), Number(g.map));
    let next = Math.max(0, ...map.values(), 0) + 1;
    for (const n of names) {
      if (map.has(n)) continue;
      const m = /^R(\d+)$/.exec(n);
      if (m && ![...map.values()].includes(+m[1])) map.set(n, +m[1]);
      else map.set(n, next++);
    }
    // a lone "*" (map 0) in the template stands for the only R group
    if (map.size === 1) map.set('__lone__', 0);
    return map;
  }
  /**
   * The data-structure step: every agent's JSON (out.template, out.molecules, out.scope, out.rtable,
   * out.conditions, out.text) → {reactions, molecules, entities, notes}. Nothing here calls a model.
   */
  function assemble(out = {}) {
    const notes = [];
    const molecules = (out.molecules?.molecules || []).map((m) => ({ ...mol(m), role: String(m.role || 'other') }));
    const T = out.template;
    const tRe = (T?.reactants || []).map(mol).filter((m) => m.smiles || m.label || m.name);
    const tPr = (T?.products || []).map(mol).filter((m) => m.smiles || m.label || m.name);
    const conds = conditionsOf(out, molecules);
    const reactions = [];
    const productLabel = tPr[0]?.label || '';
    if (T && (tRe.length || tPr.length)) {
      const isTemplate = [...tRe, ...tPr].some((m) => hasDummy(m.smiles));
      reactions.push({ id: '0_1', kind: isTemplate ? 'template' : 'scheme', reactants: tRe, products: tPr, conditions: conds.map((c) => ({ ...c })), yield: parseYield(''), source: 'template' });
      if (T.yield) reactions[0].yield = parseYield(T.yield);
    }
    // a structure-based scope panel: whole products per cell
    const entries = out.scope?.entries || [];
    entries.forEach((e, i) => {
      const y = parseYield([e.yield, e.ee ? `${e.ee} ee`.replace(/%?\s*ee\s*ee/i, ' ee') : '', e.dr ? `${e.dr} dr` : ''].filter(Boolean).join(', '));
      if (e.ee && !y.ee) y.ee = String(e.ee);
      if (e.dr && !y.dr) y.dr = String(e.dr);
      const label = String(e.label || '').trim();
      let reactants = (e.reactants || []).map(mol).filter((m) => m.smiles || m.label);
      if (!reactants.length) reactants = tRe.filter((m) => !hasDummy(m.smiles)).map((m) => ({ ...m }));
      // fixed reactants of the template (no R) are added when the cell gave only the variable ones
      for (const f of tRe.filter((m) => !hasDummy(m.smiles))) if (!reactants.some((r) => r.smiles === f.smiles || (r.label && r.label === f.label))) reactants.push({ ...f });
      reactions.push({ id: `${i + 1}_1`, kind: 'variant', reactants, products: [mol({ label, smiles: e.product_smiles })], conditions: conds.map((c) => ({ ...c })), yield: y, note: String(e.note || ''), source: 'scope' });
    });
    // a text-based R-group table: products enumerated by substitution
    const rows = out.rtable?.rows || [];
    if (rows.length) {
      const names = [...new Set([...(out.rtable.columns || []), ...rows.flatMap((r) => Object.keys(r.values || {}))].map((s) => String(s).trim()).filter(Boolean))];
      const map = rMap(T, names);
      if (!T || !tPr.length) notes.push({ zh: 'R 基团表读到了，但没有通式，产物没法代入。', en: 'The R-group table was read but there is no general scheme to substitute into.' });
      rows.forEach((r, i) => {
        const label = String(r.label || '').trim();
        const values = {}, unresolved = [], used = {};
        for (const [name, raw] of Object.entries(r.values || {})) {
          const n = map.get(String(name).trim());
          const f = fragment(raw);
          used[String(name).trim()] = String(raw ?? '');
          if (n == null) continue;
          if (f) { values[n] = f; if (map.size === 2 && map.has('__lone__')) values[0] = f; }
          else unresolved.push(`${name} = ${raw}`);
        }
        const sub = (m, product) => {
          if (!hasDummy(m.smiles)) return { ...m };
          const s = substitute(m.smiles, values);
          return { label: product ? label || relabel(m.label, label, productLabel) : relabel(m.label, label, productLabel), smiles: s.smiles, name: '' };
        };
        const y = parseYield([r.yield, r.ee ? `${String(r.ee).replace(/\s*ee$/i, '')} ee` : '', r.dr ? `${r.dr} dr` : ''].filter(Boolean).join(', '));
        if (r.ee && !y.ee) y.ee = String(r.ee);
        reactions.push({ id: `${i + 1}_1`, kind: 'variant', reactants: tRe.map((m) => sub(m, false)), products: (tPr.length ? tPr : [mol({})]).map((m) => sub(m, true)), conditions: conds.map((c) => ({ ...c })), yield: y, rvalues: used, unresolved, note: String(r.note || ''), source: 'rtable' });
      });
    }
    // reactions described in the text
    (out.text?.reactions || []).forEach((r, i) => {
      const tm = (m) => mol({ label: m.label, smiles: m.smiles || (reagent(m.name)?.smiles ?? ''), name: m.name });
      const cs = (r.conditions || []).map((c) => classify(c.text || '', c.role)).filter((c) => c.text && c.role !== 'yield');
      reactions.push({ id: `t${i + 1}_1`, kind: 'text', reactants: (r.reactants || []).map(tm), products: (r.products || []).map(tm), conditions: cs, yield: parseYield(r.yield), sentence: String(r.sentence || ''), source: 'text' });
    });
    // labelled molecules in the figure fill reactants / products that came back with a label only
    const byLabel = new Map(molecules.filter((m) => m.label && m.smiles).map((m) => [keyOf(m.label), m.smiles]));
    for (const rx of reactions) for (const m of [...rx.reactants, ...rx.products]) if (!m.smiles && m.label && byLabel.has(keyOf(m.label))) m.smiles = byLabel.get(keyOf(m.label));
    const entities = (out.text?.entities || []).map((e) => ({ text: String(e.text || ''), type: String(e.type || '') })).filter((e) => e.text);
    return { reactions, molecules, entities, notes };
  }

  // ── 核对和打分 ───────────────────────────────────────────────────────────
  /** Penalties of the rule-based score; each flag multiplies the score. Levels use ChemEAGLE's thresholds (0.85 / 0.5). */
  const PENALTY = { invalid: 0.3, unfilled: 0.4, unresolved: 0.4, noProduct: 0.2, noReactant: 0.5, element: 0.6, elementSoft: 0.85, yieldOdd: 0.7, noSmiles: 0.95, dupLabel: 0.8, review_no: 0.5, review_unsure: 0.85, emptySmiles: 0.6 };
  const FLAG_TEXT = {
    invalid: ['SMILES 解析不了：{x}', 'SMILES does not parse: {x}'],
    emptySmiles: ['有分子没有 SMILES：{x}', 'A molecule has no SMILES: {x}'],
    unfilled: ['R 基团没有代完：{x}', 'R group left unfilled: {x}'],
    unresolved: ['认不出这个取代基，手动填一个以 * 开头的片段：{x}', 'Unknown substituent; type a fragment starting with *: {x}'],
    noProduct: ['没有产物', 'No product'],
    noReactant: ['没有反应物', 'No reactant'],
    element: ['产物里的 {x} 不在任何反应物或试剂里', 'Product has {x}, which no reactant or reagent brings'],
    elementSoft: ['产物里的 {x} 不在已解析的反应物和试剂里（还有试剂没有 SMILES）', 'Product has {x}, absent from the parsed reactants and reagents (some reagents lack SMILES)'],
    yieldOdd: ['产率读不懂或超过 100%：{x}', 'Yield unreadable or above 100%: {x}'],
    noSmiles: ['试剂没有 SMILES：{x}', 'Reagent without SMILES: {x}'],
    dupLabel: ['产物编号重复：{x}', 'Product label used twice: {x}'],
    review_no: ['模型复核说不对：{x}', 'Model review says no: {x}'],
    review_unsure: ['模型复核拿不准：{x}', 'Model review unsure: {x}']
  };
  const flagText = (f, en) => (FLAG_TEXT[f.code] ? FLAG_TEXT[f.code][en ? 1 : 0].replace('{x}', f.detail || '') : f.code);
  const level = (score) => (score >= 0.85 ? 'high' : score >= 0.5 ? 'medium' : 'low');
  /**
   * Check every reaction and give it {score, level, flags}. validate(smiles) → {ok, canonical?} comes from RDKit in the
   * page; without it a syntax check stands in. review: the verify agent's JSON (optional).
   */
  function check(result, { validate, review } = {}) {
    const ok = (s) => { if (!s) return false; if (validate) { try { return !!validate(s)?.ok; } catch { return false; } } return syntaxOk(s); };
    const seen = new Map();
    for (const rx of result.reactions) for (const m of rx.products) if (m.label && rx.kind !== 'template' && rx.kind !== 'scheme') seen.set(m.label, (seen.get(m.label) || 0) + 1);
    const answers = new Map((review?.reactions || []).map((r) => [String(r.id), r]));
    for (const rx of result.reactions) {
      const flags = [];
      const add = (code, detail = '') => flags.push({ code, detail });
      const all = [...rx.reactants, ...rx.products];
      for (const m of all) {
        const who = m.label || m.name || '?';
        if (!m.smiles) { add('emptySmiles', who); continue; }
        const dum = hasDummy(m.smiles);
        if (dum && rx.kind !== 'template') add('unfilled', who);
        if (!ok(dum ? m.smiles.replace(/\[(\d*)\*(?::\d+)?\]/g, '*') : m.smiles)) add('invalid', `${who} ${m.smiles}`);
      }
      for (const u of rx.unresolved || []) add('unresolved', u);
      if (!rx.products.some((m) => m.smiles || m.label)) add('noProduct');
      if (!rx.reactants.length && rx.kind !== 'text') add('noReactant');
      if (rx.kind !== 'template') {
        const have = new Set([...rx.reactants.flatMap((m) => elements(m.smiles)), ...rx.conditions.flatMap((c) => elements(c.smiles || ''))]);
        const missing = [...new Set(rx.products.flatMap((m) => elements(m.smiles)))].filter((e) => e !== 'H' && !have.has(e));
        const loose = rx.conditions.some((c) => !c.smiles && !['temperature', 'time', 'atmosphere', 'light', 'yield', 'other'].includes(c.role));
        if (missing.length && rx.reactants.some((m) => m.smiles)) add(loose ? 'elementSoft' : 'element', missing.join(', '));
      }
      if (rx.yield?.text && (rx.yield.value == null || rx.yield.value > 100)) add('yieldOdd', rx.yield.text);
      let noSm = 0;
      for (const c of rx.conditions) if (!c.smiles && ['catalyst', 'ligand', 'reagent', 'base', 'acid', 'oxidant', 'reductant', 'additive', 'solvent'].includes(c.role) && noSm++ < 3) add('noSmiles', c.name || c.text);
      for (const m of rx.products) if (m.label && (seen.get(m.label) || 0) > 1 && rx.kind !== 'template') { add('dupLabel', m.label); break; }
      const a = answers.get(rx.id);
      if (a) for (const k of ['reactants', 'products', 'conditions', 'yield']) {
        const v = String(a[k] || '').toLowerCase();
        if (v === 'no') add('review_no', `${k}${a.note ? ' · ' + a.note : ''}`);
        else if (v === 'unsure') add('review_unsure', k);
      }
      const score = flags.reduce((s, f) => s * (PENALTY[f.code] ?? 1), 1);
      rx.confidence = { score: Math.round(score * 1000) / 1000, level: level(score), flags };
    }
    const n = result.reactions.length;
    const count = (lv) => result.reactions.filter((r) => r.confidence.level === lv).length;
    result.summary = { reactions: n, high: count('high'), medium: count('medium'), low: count('low'), molecules: result.molecules.length };
    return result;
  }

  // ── 导出 ────────────────────────────────────────────────────────────────
  /** Reaction SMILES "reactants>agents>products" (agents: conditions with SMILES). */
  function rxnSmiles(rx) {
    const s = (ms) => ms.map((m) => m.smiles).filter(Boolean).join('.');
    return `${s(rx.reactants)}>${rx.conditions.map((c) => c.smiles).filter(Boolean).join('.')}>${s(rx.products)}`;
  }
  /** The JSON people download: the reactions in ChemEAGLE's shape, plus molecules, entities and where the ideas came from. */
  function toJSON(result, meta = {}) {
    return {
      format: 'molastria-extract/1',
      generated: meta.date || '',
      model: meta.model || '',
      method: 'Multi-agent extraction after ChemEAGLE (Chen et al., arXiv:2507.20230); reimplemented by MolAstria, rule-based checks and score.',
      reactions: result.reactions.map((r) => ({
        reaction_id: r.id, kind: r.kind,
        reactants: r.reactants.map((m) => ({ label: m.label, smiles: m.smiles, ...(m.name ? { name: m.name } : {}) })),
        conditions: [...r.conditions.map((c) => ({ role: c.role, text: c.text, ...(c.name && c.name !== c.text ? { name: c.name } : {}), ...(c.amount ? { amount: c.amount } : {}), ...(c.smiles ? { smiles: c.smiles } : {}), ...(c.label ? { label: c.label } : {}) })),
          ...(r.yield?.text ? [{ role: 'yield', text: r.yield.text }] : [])],
        products: r.products.map((m) => ({ label: m.label, smiles: m.smiles, ...(m.name ? { name: m.name } : {}) })),
        reaction_smiles: rxnSmiles(r),
        ...(r.yield?.value != null ? { yield_percent: r.yield.value } : {}), ...(r.yield?.ee ? { ee: r.yield.ee } : {}), ...(r.yield?.dr ? { dr: r.yield.dr } : {}),
        ...(r.rvalues ? { r_groups: r.rvalues } : {}), ...(r.sentence ? { sentence: r.sentence } : {}), ...(r.note ? { note: r.note } : {}),
        ...(r.confidence ? { confidence: { score: r.confidence.score, level: r.confidence.level, flags: r.confidence.flags.map((f) => f.code + (f.detail ? `: ${f.detail}` : '')) } } : {})
      })),
      molecules: result.molecules.map((m) => ({ label: m.label, smiles: m.smiles, ...(m.name ? { name: m.name } : {}), role: m.role })),
      text_entities: result.entities || []
    };
  }
  const CSV_COLS = ['reaction_id', 'kind', 'reactant_labels', 'reactant_smiles', 'product_labels', 'product_smiles', 'catalysts', 'reagents', 'solvents', 'temperature', 'time', 'atmosphere', 'yield', 'yield_percent', 'ee', 'dr', 'r_groups', 'reaction_smiles', 'confidence', 'level', 'flags'];
  const cell = (v) => { const s = String(v ?? ''); return /[",\n\r]/.test(s) || /^[=+\-@]/.test(s) ? `"${(/^[=+\-@]/.test(s) ? "'" : '') + s.replace(/"/g, '""')}"` : s; };
  /** One row per reaction. Cells that a spreadsheet would run as a formula (= + - @) get a leading apostrophe. */
  function toCSV(result) {
    const by = (r, roles) => r.conditions.filter((c) => roles.includes(c.role)).map((c) => [c.name || c.text, c.amount].filter(Boolean).join(' ')).join('; ');
    const rows = result.reactions.map((r) => [
      r.id, r.kind, r.reactants.map((m) => m.label).join('; '), r.reactants.map((m) => m.smiles).join('.'), r.products.map((m) => m.label).join('; '), r.products.map((m) => m.smiles).join('.'),
      by(r, ['catalyst', 'ligand']), by(r, ['reagent', 'base', 'acid', 'oxidant', 'reductant', 'additive', 'other']), by(r, ['solvent']), by(r, ['temperature']), by(r, ['time']), by(r, ['atmosphere', 'light']),
      r.yield?.text || '', r.yield?.value ?? '', r.yield?.ee || '', r.yield?.dr || '', r.rvalues ? Object.entries(r.rvalues).map(([k, v]) => `${k}=${v}`).join('; ') : '', rxnSmiles(r),
      r.confidence?.score ?? '', r.confidence?.level || '', (r.confidence?.flags || []).map((f) => f.code).join('; ')
    ]);
    return [CSV_COLS, ...rows].map((row) => row.map(cell).join(',')).join('\r\n') + '\r\n';
  }

  /** The JSON in a model reply: plain, fenced or wrapped in prose. */
  function parseReply(text) {
    const t = String(text || '').replace(/^\uFEFF/, '').trim();
    try { return JSON.parse(t); } catch { /* try harder */ }
    const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(t);
    if (fenced) try { return JSON.parse(fenced[1]); } catch { /* go on */ }
    const start = t.indexOf('{');
    for (let end = t.lastIndexOf('}'); start >= 0 && end > start; end = t.lastIndexOf('}', end - 1)) { try { return JSON.parse(t.slice(start, end + 1)); } catch { /* shorter */ } }
    throw new Error('no JSON in the reply');
  }
  /** PubChem PUG-REST: a name → SMILES and formula (the page asks it straight from the browser). */
  const pubchemNameUrl = (name) => `https://pubchem.ncbi.nlm.nih.gov/rest/pug/compound/name/${encodeURIComponent(String(name).trim())}/property/SMILES,ConnectivitySMILES,MolecularFormula/JSON`;
  function pubchemName(json) {
    const p = json?.PropertyTable?.Properties?.[0];
    if (!p) return null;
    const smiles = String(p.SMILES || p.IsomericSMILES || p.ConnectivitySMILES || p.CanonicalSMILES || '');
    return smiles ? { cid: p.CID, smiles, formula: String(p.MolecularFormula || '') } : null;
  }

  const API = { AGENTS, EXTRACTORS, ROLES, prompt, plan, tokens, elements, syntaxOk, normalizeR, hasDummy, substitute, fragment, aryl, SUBSTITUENTS, ALIASES, REAGENTS, reagent, splitConditions, classify, splitMixture, parseYield, relabel, assemble, check, level, PENALTY, flagText, rxnSmiles, toJSON, toCSV, CSV_COLS, parseReply, pubchemNameUrl, pubchemName };
  root.MolAstriaExtract = API;
})(typeof window !== 'undefined' ? window : globalThis);
