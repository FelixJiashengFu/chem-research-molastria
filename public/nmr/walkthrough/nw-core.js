/* 逐步解谱讲解的纯逻辑（nw-core.js）：没有 DOM，tools/nmr-walkthrough-test.mjs 测。
   照站长的 nmr-walkthrough（github.com/FelixJiashengFu/nmr-walkthrough，MIT）：
   · validate() 是它 lib/build.mjs 的 validate 原样搬过来（只改成不依赖 Node），build() / standalone() 和它的 build 一样把
     描述填进 player.html（player.html 和讲解方法由 tools/nmr-walkthrough-sync.mjs 从那个仓库复制，不要手改）；
   · 在 MCP 版本里写描述的是用户自己的编程助手；网页版改成用户自己配一个大模型的 API key，由浏览器直接问服务商
     （请求的拼法借用论文工坊的 ../../paper/po-core.js）。这里是给模型的提示词 prompts()、从回答里取 JSON extractJSON()，
     以及“数据必须真实”的两道关：
       ground()：描述里每个位移、J 值和二维相关峰，都要能在用户贴的数据里找到（容差见 TOL）；找不到的一律改标成
                 est / Jest / expected（页面上显示 ≈ 和 *），并列出来给用户看；
       finalize()：sources 换成用户自己的数据（模型写的来源一律不要，防止编出来的文献），去掉 unverified，写一段如实的说明。
   API key 只由调用方交给 po-core 的 request()，这里不碰。 */
(function (root) {
  'use strict';

  // ── 校验（nmr-walkthrough 的 lib/build.mjs，原样） ─────────────────────
  const isText = (v) => typeof v === 'string' || (v && typeof v === 'object' && (typeof v.zh === 'string' || typeof v.en === 'string'));
  const isRange = (r) => Array.isArray(r) && r.length === 2 && r.every(Number.isFinite) && r[0] !== r[1];

  function validate(spec) {
    const errors = [], warnings = [];
    const err = (m) => errors.push(m), warn = (m) => warnings.push(m);
    if (!spec || typeof spec !== 'object') return { errors: ['spec must be an object'], warnings };
    if (!isText(spec.title)) err('title is required (string or {zh,en})');
    if (!Array.isArray(spec.spectra) || !spec.spectra.length) err('spectra must be a non-empty array');
    if (!Array.isArray(spec.steps) || !spec.steps.length) err('steps must be a non-empty array');
    if (errors.length) return { errors, warnings };

    const atomIds = new Set(), bondIds = new Set(), peakOwner = new Map(), spIds = new Set();
    if (spec.molecule) {
      for (const a of spec.molecule.atoms || []) {
        if (!a.id || !Number.isFinite(a.x) || !Number.isFinite(a.y)) err(`atom ${JSON.stringify(a.id)} needs id, x, y`);
        if (atomIds.has(a.id)) err(`duplicate atom id ${a.id}`);
        atomIds.add(a.id);
      }
      for (const b of spec.molecule.bonds || []) {
        if (!atomIds.has(b.a) || !atomIds.has(b.b)) err(`bond ${b.a}-${b.b} refers to an unknown atom`);
        if (b.id) bondIds.add(b.id);
      }
    } else warn('no molecule: the structure panel will be hidden');

    for (const sp of spec.spectra) {
      if (!sp.id) { err('every spectrum needs an id'); continue; }
      if (spIds.has(sp.id)) err(`duplicate spectrum id ${sp.id}`);
      spIds.add(sp.id);
      if (!Array.isArray(sp.peaks)) { err(`spectrum ${sp.id}: peaks must be an array`); continue; }
      if (sp.kind === '2d') {
        if (!sp.type) err(`spectrum ${sp.id}: 2D spectra need a type (COSY, HSQC, HMBC, ...)`);
        for (const ax of ['x', 'y']) if (!sp[ax] || !isRange(sp[ax].range) || !sp[ax].nucleus) err(`spectrum ${sp.id}: ${ax} needs {nucleus, range:[hi,lo]}`);
        for (const p of sp.peaks) if (!Number.isFinite(p.x) || !Number.isFinite(p.y)) err(`spectrum ${sp.id}: peak ${p.id} needs numeric x and y`);
      } else {
        if (!sp.nucleus) err(`spectrum ${sp.id}: nucleus is required (e.g. "1H")`);
        if (!isRange(sp.range)) err(`spectrum ${sp.id}: range must be [hi, lo] in ppm`);
        for (const p of sp.peaks) {
          if (!Number.isFinite(p.ppm)) err(`spectrum ${sp.id}: peak ${p.id} needs numeric ppm`);
          if (p.mult && !/^(sext|sept|quint|br|[sdtqpm]|\s)+$/.test(p.mult)) warn(`peak ${p.id}: multiplicity "${p.mult}" is not understood and is drawn as a singlet`);
        }
      }
      for (const p of sp.peaks) {
        if (!p.id) { err(`spectrum ${sp.id}: every peak needs an id`); continue; }
        if (peakOwner.has(p.id)) err(`duplicate peak id ${p.id} (ids must be unique across all spectra)`);
        peakOwner.set(p.id, sp.id);
      }
    }
    for (const sp of spec.spectra) if (sp.kind === '2d') for (const ax of ['x', 'y'])
      if (sp[ax]?.ref && !spIds.has(sp[ax].ref)) err(`spectrum ${sp.id}: ${ax}.ref "${sp[ax].ref}" is not a spectrum id`);

    spec.steps.forEach((s, n) => {
      const at = `step ${n + 1}`;
      if (!isText(s.title)) err(`${at}: title is required`);
      if (!isText(s.text) && !isText(s.ask)) err(`${at}: needs text (the observation) or ask`);
      if (s.spectrum && !spIds.has(s.spectrum)) err(`${at}: unknown spectrum "${s.spectrum}"`);
      for (const id of s.peaks || []) {
        if (!peakOwner.has(id)) err(`${at}: unknown peak "${id}"`);
        else if (s.spectrum && peakOwner.get(id) !== s.spectrum) warn(`${at}: peak "${id}" belongs to ${peakOwner.get(id)}, not to the shown spectrum ${s.spectrum}; it is highlighted only in the table`);
      }
      for (const id of [...(s.atoms || []), ...(s.reveal?.atoms || [])]) if (!atomIds.has(id)) err(`${at}: unknown atom "${id}"`);
      for (const id of s.reveal?.bonds || []) if (!bondIds.has(id)) err(`${at}: unknown bond id "${id}"`);
      for (const a of s.arrows || []) if (!atomIds.has(a.from) || !atomIds.has(a.to)) err(`${at}: arrow ${a.from}→${a.to} refers to an unknown atom`);
      for (const id of Object.keys(s.assign || {})) if (!peakOwner.has(id)) err(`${at}: assign refers to unknown peak "${id}"`);
      if (s.zoom) {
        const sp = spec.spectra.find((x) => x.id === s.spectrum);
        if (sp?.kind === '2d' ? !(isRange(s.zoom.x) || isRange(s.zoom.y)) : !isRange(s.zoom)) err(`${at}: zoom must be [hi,lo] for 1D or {x:[hi,lo],y:[hi,lo]} for 2D`);
      }
      if (!s.so && !s.ask && n > 0) warn(`${at}: no "so" conclusion; every step should end in one inference`);
      for (const k of ['title', 'text', 'so']) if (s[k] && typeof s[k] === 'object' && !(s[k].zh && s[k].en)) warn(`${at}: ${k} is missing zh or en`);
    });
    if (spec.molecule && spec.steps.some((s) => s.reveal)) {
      const shown = new Set(spec.steps.flatMap((s) => s.reveal?.atoms || []));
      const missing = [...atomIds].filter((a) => !shown.has(a));
      if (missing.length) warn(`atoms never revealed: ${missing.join(', ')}`);
      const bshown = new Set(spec.steps.flatMap((s) => s.reveal?.bonds || []));
      const bmissing = [...bondIds].filter((b) => !bshown.has(b));
      if (bmissing.length) warn(`bonds with an id that are never revealed: ${bmissing.join(', ')}`);
    }
    const assigned = new Set(spec.steps.flatMap((s) => Object.keys(s.assign || {})));
    const unassigned = spec.spectra.filter((sp) => sp.kind !== '2d').flatMap((sp) => sp.peaks.map((p) => p.id)).filter((id) => !assigned.has(id));
    if (unassigned.length) warn(`1D peaks never assigned: ${unassigned.join(', ')} (assign every peak, or say why it is solvent/impurity)`);
    if (!Array.isArray(spec.sources) || !spec.sources.length) {
      const m = 'no sources: every shift, J value and correlation must be traceable to measured data (the user\'s own spectra or peak list, or a cited source). Add sources:[{label,url?,covers}] and mark anything the source does not give with est / Jest / expected';
      if (spec.unverified === true) warn(m + '. Built as UNVERIFIED: the page carries a red notice'); else err(m + '. Never fill in numbers from memory. Only if the user explicitly accepts unverified data, set unverified:true (the page then carries a red notice)');
    } else for (const q of spec.sources) if (!q.label && !q.url) err('each source needs a label or url');
    if (!spec.steps.at(-1).final) warn('last step is not marked final:true (the verification step that shows the answer)');
    if (spec.steps.length < 6) warn('fewer than 6 steps: one click should carry one idea, so most problems need 8 to 16');
    return { errors, warnings };
  }

  // ── 生成页面（和 nmr-walkthrough 的 build 一样） ──────────────────────────
  const shortTitle = (spec) => spec.shortTitle || (typeof spec.title === 'string' ? spec.title : spec.title.en || spec.title.zh);
  /** 播放器片段：player.html 里填好标题和描述。 */
  function build(template, spec) {
    const { errors, warnings } = validate(spec);
    if (errors.length) throw Object.assign(new Error('Invalid walkthrough spec:\n- ' + errors.join('\n- ')), { errors, warnings });
    const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
    const html = String(template)
      .replace('__TITLE__', () => esc(shortTitle(spec)))
      .replace('/*__SPEC__*/null', () => JSON.stringify(spec).replace(/</g, '\\u003c'));
    return { html, warnings };
  }
  /** 完整的 HTML 文件（下载用；theme 给页面里的 iframe 用，跟着网站的深浅色）。 */
  function standalone(template, spec, o = {}) {
    const { html, warnings } = build(template, spec);
    const theme = o.theme === 'dark' || o.theme === 'light' ? ` data-theme="${o.theme}"` : '';
    return { html: `<!doctype html>\n<html lang="zh"${theme}>\n<meta name="viewport" content="width=device-width,initial-scale=1">\n<style>body{margin:0}</style>\n` + html, warnings };
  }

  // ── 给模型的提示词 ─────────────────────────────────────────────────────
  const SYSTEM_RULES = `You write click-to-advance NMR structure-solving walkthroughs as ONE JSON object (the "spec") for the MolAstria player.

HARD RULES (a page that breaks them is not shown as measured):
1. Use ONLY the numbers the user gives you: every ppm, J value, integral and 2D cross peak must be copied from the user's data below. Never fill a gap from memory, never "improve" a number. If the user's data contain an obvious typo, keep the number and say so in that step's check.
2. If the picture needs a value the user did not give (typically J in Hz, or a 2D peak that must exist but is not listed), set est:true (shift), Jest:true (J) or expected:true (2D peak) on it and say so in that step's check. Do not invent whole spectra: draw only the spectrum types the user gave (no NOESY unless they gave one).
3. Do not write a "sources" field and do not cite papers or web pages: the page fills in the user's own data as the only source.
4. If the data do not determine the structure, say so plainly in the final step and name the experiment that would settle it. If the user gives the expected answer, explain towards it; if the data contradict it, say so.
5. Every text field is {"zh": "...", "en": "..."} with both languages written properly (Simplified Chinese and English).
6. Output only the JSON object, no commentary. A \`\`\`json fence is fine.

Follow the teaching method and the schema below exactly; one complete example follows them.`;

  /** 系统提示词：规则 + 讲解方法 + 数据格式 + 一个完整的示例（压成一行，省 token）。 */
  function systemPrompt(G) {
    const ex = (G.examples.find((e) => e.id === 'ethyl-crotonate') || G.examples[0]).spec;
    return [SYSTEM_RULES, '# Teaching method\n\n' + G.guide, '# Spec schema\n\n' + G.schema, '# Complete example spec\n\n' + JSON.stringify(ex)].join('\n\n---\n\n');
  }
  /** 用户消息。f: { name, formula, solvent, mhz, data, answer, notes, images }。 */
  function userPrompt(f) {
    const L = [];
    L.push('Write the walkthrough spec for this problem. All measured data are below; use nothing else.');
    if (f.name) L.push(`Compound or problem name: ${f.name}`);
    if (f.formula) L.push(`Molecular formula: ${f.formula}`);
    if (f.solvent) L.push(`Solvent: ${f.solvent}`);
    if (f.mhz) L.push(`Spectrometer: ${f.mhz} MHz (1H)`);
    if (f.answer) L.push(`Expected answer given by the user (explain towards it; flag any contradiction with the data): ${f.answer}`);
    else L.push('The answer is not given: deduce it from the data. If the data allow more than one structure, compare the candidates and say which experiment would decide.');
    if (f.notes) L.push(`Notes from the user: ${f.notes}`);
    if (f.images) L.push(`The user also attached ${f.images} image(s) of their spectra or handout. Read numbers from them only where they are legible, and mark any value you are unsure of with est / Jest / expected.`);
    L.push('--- USER DATA (peak lists, as given) ---\n' + String(f.data || '').trim() + '\n--- END OF USER DATA ---');
    return L.join('\n');
  }
  /** 校验没过时，把错误交回去让模型改（只改这些，不换数据）。 */
  function repairPrompt(errors, warnings = []) {
    return 'The spec you wrote does not validate. Fix exactly these problems and output the whole corrected JSON object again (same data, no new numbers):\n- '
      + errors.join('\n- ') + (warnings.length ? '\nAlso, if easy:\n- ' + warnings.slice(0, 8).join('\n- ') : '');
  }

  /** 从模型的回答里取出 JSON：```json 围栏里的，否则第一个 { 到最后一个 }。 */
  function extractJSON(text) {
    const s = String(text || '');
    const fence = s.match(/```(?:json)?\s*\n([\s\S]*?)```/i);
    const a = s.indexOf('{'), b = s.lastIndexOf('}');
    // 没有收尾的 } 多半是回答被截断了：照样拿去解析，报 bad-json
    const body = fence ? fence[1] : a < 0 ? '' : s.slice(a, b > a ? b + 1 : undefined);
    if (!body || !body.trim().startsWith('{')) throw Object.assign(new Error('no-json'), { code: 'no-json' });
    try { return JSON.parse(body); } catch (e) {
      // 常见的小毛病：结尾多一个逗号
      try { return JSON.parse(body.replace(/,\s*([}\]])/g, '$1')); } catch { throw Object.assign(new Error('bad-json: ' + e.message), { code: 'bad-json' }); }
    }
  }

  // ── 数据必须真实：和用户贴的数据逐个对 ────────────────────────────────
  // 容差：¹H 写两位小数，差 0.006 以内算同一个数；其他核写一位，差 0.06；J 写一位小数，差 0.06 Hz。
  const TOL = { h: 0.006, x: 0.06, j: 0.06 };
  /** 用户数据里的数和范围（“7.20–7.35”这样的写法算一个范围，多重峰的中心落在里面也算对得上）。 */
  function numbersIn(text) {
    const s = String(text || '').replace(/[，、；]/g, ' ').replace(/(\d),(\d)/g, '$1.$2');
    const nums = (s.match(/\d+(?:\.\d+)?/g) || []).map(Number).filter(Number.isFinite);
    const ranges = [];
    for (const m of s.matchAll(/(\d+(?:\.\d+)?)\s*(?:-|–|—|~|～|to|至|到)\s*(\d+(?:\.\d+)?)/g)) {
      const a = +m[1], b = +m[2];
      if (Number.isFinite(a) && Number.isFinite(b) && a !== b) ranges.push([Math.min(a, b), Math.max(a, b)]);
    }
    return { nums, ranges };
  }
  const isH = (n) => /^1H$/i.test(String(n || '').trim());
  const near = (v, list, tol) => list.some((n) => Math.abs(n - v) <= tol + 1e-9);
  const inRange = (v, ranges, tol) => ranges.some(([a, b]) => v >= a - tol && v <= b + tol);

  /** 逐个核对，返回 { spec（没对上的已改标 est / Jest / expected）, flagged: [{ kind, id, value, where }], checked }。
      一个二维相关峰的坐标对上了用户的数，或者对上了一个已经对上的一维峰，都算对上。 */
  function ground(spec, text) {
    const out = JSON.parse(JSON.stringify(spec));
    const { nums, ranges } = numbersIn(text);
    const flagged = [];
    let checked = 0;
    const ok1d = { h: [], x: {} };
    for (const sp of out.spectra || []) {
      if (sp.kind === '2d' || !Array.isArray(sp.peaks)) continue;
      const tol = isH(sp.nucleus) ? TOL.h : TOL.x;
      for (const p of sp.peaks) {
        if (!Number.isFinite(p.ppm)) continue;
        if (!p.est) {
          checked++;
          if (near(p.ppm, nums, tol) || inRange(p.ppm, ranges, tol)) (ok1d.x[sp.nucleus] = ok1d.x[sp.nucleus] || []).push(p.ppm);
          else { p.est = true; flagged.push({ kind: 'shift', id: p.id, value: p.ppm, where: sp.id }); }
        }
        if (Array.isArray(p.J) && p.J.length && !p.Jest) {
          checked += p.J.length;
          const bad = p.J.filter((j) => !near(+j, nums, TOL.j));
          if (bad.length) { p.Jest = true; flagged.push({ kind: 'J', id: p.id, value: bad.join(', '), where: sp.id }); }
        }
      }
    }
    for (const sp of out.spectra || []) {
      if (sp.kind !== '2d' || !Array.isArray(sp.peaks)) continue;
      for (const p of sp.peaks) {
        if (p.expected) continue;
        checked++;
        const axOk = (ax, v) => {
          const nuc = sp[ax]?.nucleus, tol = isH(nuc) ? TOL.h : TOL.x;
          return near(v, nums, tol) || inRange(v, ranges, tol) || near(v, ok1d.x[nuc] || [], tol);
        };
        if (!(axOk('x', p.x) && axOk('y', p.y))) { p.expected = true; flagged.push({ kind: 'cross', id: p.id, value: `${p.x} / ${p.y}`, where: sp.id }); }
      }
    }
    return { spec: out, flagged, checked };
  }

  /** 定稿：来源只写用户自己的数据，去掉 unverified，写一段如实的说明，起始语言跟着页面。
      o: { label, model, flagged, checked, images, answerGiven, lang } */
  function finalize(spec, o = {}) {
    const out = JSON.parse(JSON.stringify(spec));
    delete out.unverified;
    const label = String(o.label || '').trim() || '用户提供的谱图和峰表 / spectra and peak lists supplied by the user';
    const n = (o.flagged || []).length;
    out.sources = [{
      label,
      covers: {
        zh: `全部位移、J 值和相关峰都取自用户在 MolAstria 网页上提供的数据${o.images ? '（含图片，图片里读出的数没法逐个核对）' : ''}。网页逐个核对了 ${o.checked || 0} 个数，${n ? `${n} 个在用户的数据里找不到，已标成 ≈ 或 *（不是实测）` : '都能在用户的数据里找到'}。`,
        en: `Every shift, J value and cross peak comes from data the user supplied on the MolAstria page${o.images ? ' (including images; numbers read from images cannot be checked one by one)' : ''}. The page checked ${o.checked || 0} numbers against that data: ${n ? `${n} could not be found there and are marked ≈ or * (not measured)` : 'all of them were found'}.`,
      },
    }];
    const who = o.model ? `${o.model}` : '';
    out.note = {
      zh: `这份讲解由大模型${who ? ` ${who}` : ''}按用户给的数据写出，${o.answerGiven ? '答案由用户给定' : '答案是模型推出来的，请自己核对'}。谱线是按峰表画的示意图，位移是用户的数据，峰形不是原始谱。`,
      en: `Written by a language model${who ? ` (${who})` : ''} from the data the user supplied; ${o.answerGiven ? 'the answer was given by the user' : 'the answer was deduced by the model, so check it yourself'}. Line shapes are drawn from the peak list: the shifts are the user's data, the shapes are not the raw spectrum.`,
    };
    if (o.lang) out.lang = o.lang;
    return out;
  }

  /** 文件名：shortTitle 或标题里的英文和数字。 */
  function slug(spec) {
    return String(shortTitle(spec) || '').toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 60) || 'nmr-walkthrough';
  }
  /** 估算 token 数（中文一字一个，其他四个字符一个）。 */
  const estTokens = (s) => { const t = String(s || ''); const cjk = (t.match(/[㐀-鿿]/g) || []).length; return Math.round(cjk + (t.length - cjk) / 4); };

  const pure = { validate, build, standalone, systemPrompt, userPrompt, repairPrompt, extractJSON, numbersIn, ground, finalize, slug, estTokens, TOL, SYSTEM_RULES };
  if (typeof module === 'object' && module.exports) module.exports = pure;
  else root.MolAstriaNMRWalk = pure;
})(typeof self !== 'undefined' ? self : this);
