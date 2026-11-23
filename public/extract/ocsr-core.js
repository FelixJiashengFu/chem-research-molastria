/* 文献信息抽取的“结构识别”一步：把图里每个结构的框裁下来交给站长电脑上的 MolNexTR（账号服务 /uma/jobs，
   模型 molnextr、任务 ocsr），再决定每个分子用谁的答案。这里是纯逻辑，没有 DOM，tools/ocsr-test.mjs 测。
   MolNexTR（Chen 等，J. Cheminform. 16, 141 (2024)；github.com/CYF2000127/MolNexTR，Apache-2.0）在站长电脑上作为
   库调用，这个仓库里没有它的代码（tools/uma-server/THIRD-PARTY-molnextr.md）。
   LIMITS 和 deploy/account-worker.js 的 OCSR、tools/uma-server/ocsr_backend.py 的常量是同一组数，ocsr-test 核对三处。 */
(function (root) {
  'use strict';

  const MODEL = 'molnextr', JOB = 'ocsr';
  const LIMITS = { maxImages: 8, maxBytes: 150000, maxTotal: 400000, maxSide: 2000, minSide: 16 };
  const COST = 1; // 每张图用掉一次今天的在线计算次数（账号服务 UMA_COST.ocsr）
  const CROP_SIDE = 1024; // 裁下来的图最长边；MolNexTR 自己会缩到 384 × 384
  // MolNexTR 的置信度是每个原子和键的分数的几何平均，没有在文献图上校准成“对的概率”。这两个阈值是经验值。
  const HIGH = 0.85, MID = 0.5;

  const DUMMY = /\[\d*\*(?::\d+)?\]|\*/;
  const num = (v) => (typeof v === 'number' ? v : typeof v === 'string' && v.trim() !== '' ? Number(v) : NaN);

  /**
   * A model's box → {x, y, w, h} as fractions of the image it saw, or null. Accepts [x0, y0, x1, y1] or {x, y, w, h};
   * numbers in 0–1 or in thousandths (0–1000, what the prompt asks for). Corners in either order.
   */
  function normBox(b) {
    let x0, y0, x1, y1;
    if (Array.isArray(b) && b.length === 4) [x0, y0, x1, y1] = b.map(num);
    else if (b && typeof b === 'object') { x0 = num(b.x); y0 = num(b.y); x1 = x0 + num(b.w); y1 = y0 + num(b.h); }
    else return null;
    const v = [x0, y0, x1, y1];
    if (!v.every(Number.isFinite) || v.some((t) => t < 0)) return null;
    const scale = Math.max(...v) > 1.5 ? 1000 : 1;
    if (Math.max(...v) > scale * 1.02) return null;
    const c = (t) => Math.min(1, Math.max(0, t / scale));
    const x = Math.min(c(x0), c(x1)), y = Math.min(c(y0), c(y1));
    const w = Math.abs(c(x1) - c(x0)), h = Math.abs(c(y1) - c(y0));
    const r6 = (t) => Math.round(t * 1e6) / 1e6;
    return w >= 0.01 && h >= 0.01 ? { x: r6(x), y: r6(y), w: r6(w), h: r6(h) } : null;
  }

  /** A little room around the drawing (models draw their boxes tight), kept inside the image. */
  function padBox(b, pad = 0.15) {
    const px = b.w * pad + 0.005, py = b.h * pad + 0.005;
    const x = Math.max(0, b.x - px), y = Math.max(0, b.y - py);
    return { x, y, w: Math.min(1, b.x + b.w + px) - x, h: Math.min(1, b.y + b.h + py) - y };
  }

  /**
   * The pixel rectangle on the full source image for a box drawn on the figure the model saw (the whole source, or the
   * crop the visitor boxed, both as fractions).
   */
  function toPixels(box, crop, W, H) {
    const c = crop || { x: 0, y: 0, w: 1, h: 1 };
    const sx = Math.round((c.x + box.x * c.w) * W), sy = Math.round((c.y + box.y * c.h) * H);
    return { sx, sy, sw: Math.max(1, Math.round(box.w * c.w * W)), sh: Math.max(1, Math.round(box.h * c.h * H)) };
  }

  /** The output size of a crop: longest side at most max, never upscaled; null when a side ends up under minSide. */
  function fitSize(w, h, max = CROP_SIDE) {
    const k = Math.min(1, max / Math.max(w, h));
    const out = { w: Math.round(w * k), h: Math.round(h * k), k };
    return out.w >= LIMITS.minSide && out.h >= LIMITS.minSide ? out : null;
  }

  const b64Bytes = (s) => Math.floor(s.length * 3 / 4) - (s.endsWith('==') ? 2 : s.endsWith('=') ? 1 : 0);

  /** A canvas data URL → the bare base64 the service takes ({format, b64, bytes}), or null for anything but PNG / JPEG. */
  function fromDataUrl(url) {
    const m = /^data:image\/(png|jpeg);base64,([A-Za-z0-9+/]+={0,2})$/.exec(String(url || ''));
    return m ? { format: m[1], b64: m[2], bytes: b64Bytes(m[2]) } : null;
  }

  /** The request body for one job; throws when the images break a limit (the service would refuse them anyway). */
  function body(images) {
    if (!Array.isArray(images) || !images.length) throw Object.assign(new Error('没有要识别的结构图'), { code: 'none' });
    if (images.length > LIMITS.maxImages) throw Object.assign(new Error(`一次最多识别 ${LIMITS.maxImages} 个结构`), { code: 'many' });
    let total = 0;
    for (const b of images) {
      if (typeof b !== 'string' || !/^(?:iVBORw0KGgo|\/9j\/)[A-Za-z0-9+/]*={0,2}$/.test(b) || b.length % 4) throw Object.assign(new Error('结构图只能是 PNG 或 JPEG'), { code: 'format' });
      const n = b64Bytes(b);
      if (n > LIMITS.maxBytes) throw Object.assign(new Error(`一张结构图最多 ${LIMITS.maxBytes} 字节`), { code: 'big' });
      total += n;
    }
    if (total > LIMITS.maxTotal) throw Object.assign(new Error(`一次的结构图合起来最多 ${LIMITS.maxTotal} 字节`), { code: 'total' });
    return { model: MODEL, job: JOB, params: { images } };
  }
  const cost = (n) => n * COST;

  const boxKey = (b) => [b.x, b.y, b.w, b.h].map((t) => Math.round(t * 200)).join(',');

  /**
   * The structures worth sending: every molecule of the result (reactants, products, standalone) whose model gave a
   * usable box. Molecules with the same box share one crop. Template structures with R groups are sent too (MolNexTR
   * reads R as *), but their answer is only a cross-check. Returns {targets: [{box, mols}], skipped}.
   */
  function targets(result, max = LIMITS.maxImages) {
    const byKey = new Map();
    const all = [...(result?.reactions || []).flatMap((r) => [...r.reactants, ...r.products]), ...(result?.molecules || [])];
    for (const m of all) {
      const b = m && normBox(m.box);
      if (!b) continue;
      const k = boxKey(b);
      if (!byKey.has(k)) byKey.set(k, { box: b, mols: [] });
      byKey.get(k).mols.push(m);
    }
    // the template's reactants share their boxes with every enumerated row; one crop each is enough
    const list = [...byKey.values()];
    return { targets: list.slice(0, max), skipped: Math.max(0, list.length - max) };
  }

  /**
   * Which answer a molecule keeps. vision: the SMILES the vision model wrote (may be ""); item: MolNexTR's item for its
   * crop; same(a, b) says whether two SMILES are the same molecule (RDKit canonical forms in the page).
   *   - MolNexTR failed or wrote something RDKit cannot read  → the vision answer, nothing else.
   *   - the vision answer has R groups ([*:n])                 → it stays (the R names matter); MolNexTR only cross-checks.
   *   - both agree                                             → "both".
   *   - MolNexTR at least HIGH                                 → MolNexTR, the vision answer kept as the alternative.
   *   - no vision answer and MolNexTR at least MID             → MolNexTR.
   *   - otherwise                                              → the vision answer, MolNexTR kept as the alternative.
   * @returns {{source:'vision'|'molnextr'|'both', smiles:string, alt:string, disagree:boolean, confidence:number|null, reason:string}}
   */
  function decide(vision, item, same = (a, b) => a === b) {
    const v = String(vision || '').trim();
    const keep = (reason, extra = {}) => ({ source: 'vision', smiles: v, alt: '', disagree: false, confidence: null, reason, ...extra });
    if (!item || !item.ok || item.valid === false || !(item.canonical || item.smiles)) return keep('failed', { error: String(item?.error || '') });
    const o = String(item.canonical || item.smiles);
    const conf = Number.isFinite(item.confidence) ? item.confidence : null;
    let agree = false;
    try { agree = !!v && !!same(v, o); } catch { agree = false; }
    if (agree) return { source: 'both', smiles: v, alt: '', disagree: false, confidence: conf, reason: 'agree' };
    if (v && DUMMY.test(v)) return keep('rgroups', { alt: o, disagree: !DUMMY.test(o), confidence: conf });
    if (conf != null && conf >= HIGH) return { source: 'molnextr', smiles: o, alt: v, disagree: !!v, confidence: conf, reason: 'high' };
    if (!v && conf != null && conf >= MID) return { source: 'molnextr', smiles: o, alt: '', disagree: false, confidence: conf, reason: 'fill' };
    return keep(conf == null ? 'unscored' : 'low', { alt: o, disagree: !!v, confidence: conf });
  }

  /** Write a decision onto a molecule: smiles, source and what MolNexTR read (kept for the swap button and the export). */
  function apply(m, d, item) {
    m.smiles = d.smiles;
    m.source = d.source;
    m.ocsr = { smiles: item?.ok ? String(item.canonical || item.smiles || '') : '', confidence: d.confidence, min: Number.isFinite(item?.min_confidence) ? item.min_confidence : null, alt: d.alt, disagree: d.disagree, reason: d.reason, ...(d.error ? { error: d.error } : {}) };
    return m;
  }

  /** The swap button: the other answer becomes the molecule's SMILES. */
  function swap(m) {
    const o = m.ocsr;
    if (!o || !o.alt) return m;
    const was = m.smiles;
    m.smiles = o.alt;
    o.alt = was;
    m.source = m.source === 'molnextr' ? 'vision' : 'molnextr';
    return m;
  }

  /** Counts for the note under the table. */
  function tally(mols) {
    const t = { both: 0, molnextr: 0, vision: 0, disagree: 0, failed: 0 };
    for (const m of mols) {
      if (!m.ocsr) continue;
      t[m.source] = (t[m.source] || 0) + 1;
      if (m.ocsr.disagree) t.disagree++;
      if (m.ocsr.reason === 'failed') t.failed++;
    }
    return t;
  }

  const SOURCE = {
    vision: ['视觉模型', 'Vision model'],
    molnextr: ['MolNexTR', 'MolNexTR'],
    both: ['两者一致', 'Both agree'],
    manual: ['手改', 'Edited'],
    pubchem: ['PubChem', 'PubChem'],
    rule: ['规则代入', 'By rule']
  };
  const sourceText = (s, en) => (SOURCE[s] ? SOURCE[s][en ? 1 : 0] : '');

  const API = { MODEL, JOB, LIMITS, COST, CROP_SIDE, HIGH, MID, normBox, padBox, toPixels, fitSize, b64Bytes, fromDataUrl, body, cost, targets, decide, apply, swap, tally, SOURCE, sourceText };
  root.MolAstriaOCSR = API;
})(typeof window !== 'undefined' ? window : globalThis);
