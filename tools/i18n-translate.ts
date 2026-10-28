// Fill the empty English values in i18n/en.json with DeepSeek, then write public/i18n/en.js.
//   DEEPSEEK_API_KEY=... deno run --allow-read --allow-write --allow-net --allow-env tools/i18n-translate.ts
// Only empty values are sent; hand edits in en.json are never overwritten. Every answer must keep the
// same {0} {1} … slots as its key, or it is retried on its own.
const repo = new URL("../", import.meta.url);
const enUrl = new URL("i18n/en.json", repo);
const en: Record<string, string> = JSON.parse(await Deno.readTextFile(enUrl));
const key = Deno.env.get("DEEPSEEK_API_KEY");
const todo = Object.keys(en).filter((k) => !en[k]);

const SYSTEM = `You translate the user interface of MolAstria (molastria.com), a Chinese website for computational chemistry: a searchable catalogue of databases, software, tutorials, papers and open-source tools; an interactive resource network; a 19-chapter Chinese guide; and an "AI Lab" for closed-loop discovery of lithium-battery electrolyte solvent molecules (LLM proposes molecules → RDKit filter → UMA machine-learned potential on Rowan → reliability layer → DFT verification).
Translate each Chinese string into concise, natural English as it would appear in a polished scientific web app.
Rules:
- Keep every placeholder such as {0} {1} exactly once each; move them if English word order needs it.
- Keep product, method and data names as they are: MolAstria, DeepSeek, Muse, Muse Wonder, Meta, RDKit, RDKit.js, Rowan, UMA, UMA-S, UMA-M, OMol25, ωB97M-V, r²SCAN-3c, GFN2-xTB, PubChem, InChIKey, SMILES, Pareto, Tier 1/2/3, ChemDB Atlas, ChemVis Hub, Sobereva, Multiwfn, ORCA, VASP, CCL, X-MOL, arXiv, Crossref, GitHub, MCP, SCE, Li/Li⁺, IP, EA.
- Glossary: 统一搜索=Search; 网状查询=Network; 中文讲解=Chinese guide; 中文讲解与数据库=Guide & databases; 论文与社区=Papers & community; AI 实验室=AI Lab; Agent 工程=Agent engineering; AI 助手=AI assistant; 问目录（带出处）=Ask the catalogue (cited); 自由提问=Open question; 收藏=Save/Saved; 来源=Source; 条目=entries; 资源=resources; 快照=snapshot; 原站=original site; 计算化学公社=Keinsci forum (计算化学公社); 种子溶剂=seed solvents; 参考集=reference set; 轮=round; 前沿=front; Pareto 前沿=Pareto front; 超体积=hypervolume; 可靠性层=reliability layer; 可信=trusted; 存疑=doubtful; 不可信=untrusted; 先验误差=prior error; 模型分歧=model disagreement; 适用域=applicability domain; 电离能=ionization energy; 电子亲和能=electron affinity; Li⁺ 结合能=Li⁺ binding energy; 氧化还原电位=redox potential; 合成复杂度=synthetic complexity; 演示数据=demo data; 合成值=synthetic values; 过滤=filter; 通过=passed; 未通过=rejected; 浓淡=Strength; 背景=Background.
- Short labels stay short (buttons, tabs, table headers). Keep punctuation style English (no full-width punctuation). Keep arrows (→ ↗ ↓), ★/☆, ·, and leading/trailing symbols.
- If a string is code, a SMILES, or already English, return it unchanged.
Return JSON: {"t":[{"i":<index>,"en":"<translation>"}]} covering every input index.`;

const slots = (s: string) => (s.match(/\{\d\}/g) || []).sort().join("");
async function ask(items: { i: number; zh: string }[], attempt = 0): Promise<Map<number, string>> {
  const res = await fetch("https://api.deepseek.com/chat/completions", {
    method: "POST",
    headers: { "Content-Type": "application/json", Authorization: `Bearer ${key}` },
    body: JSON.stringify({
      model: "deepseek-v4-pro", reasoning_effort: "low", max_tokens: 16000, response_format: { type: "json_object" },
      messages: [{ role: "system", content: SYSTEM }, { role: "user", content: JSON.stringify({ strings: items }) }],
    }),
  });
  if (!res.ok) {
    if (attempt < 3) { await new Promise((r) => setTimeout(r, 2000 * (attempt + 1))); return ask(items, attempt + 1); }
    throw new Error(`DeepSeek ${res.status}: ${await res.text()}`);
  }
  const j = await res.json();
  const out = new Map<number, string>();
  try { for (const t of JSON.parse(j.choices[0].message.content).t || []) if (typeof t.en === "string") out.set(Number(t.i), t.en.trim()); } catch { /* retried below */ }
  return out;
}

if (!todo.length) console.log("nothing to translate");
else if (!key) { console.error("DEEPSEEK_API_KEY is not set"); Deno.exit(2); }
else {
  const batches: string[][] = [];
  for (let i = 0; i < todo.length; i += 45) batches.push(todo.slice(i, i + 45));
  let done = 0;
  const run = async (batch: string[]) => {
    const items = batch.map((zh, i) => ({ i, zh }));
    let got = await ask(items);
    let bad = items.filter((x) => !got.has(x.i) || slots(got.get(x.i)!) !== slots(x.zh));
    for (const x of bad) { // one more try, alone
      const single = await ask([{ i: 0, zh: x.zh }]);
      const v = single.get(0);
      if (v && slots(v) === slots(x.zh)) got.set(x.i, v); else got.delete(x.i);
    }
    for (const x of items) if (got.has(x.i)) en[x.zh] = got.get(x.i)!;
    done += batch.length;
    console.log(`${done}/${todo.length}`);
  };
  for (let i = 0; i < batches.length; i += 5) await Promise.all(batches.slice(i, i + 5).map(run));
  await Deno.writeTextFile(enUrl, JSON.stringify(en, null, 1) + "\n");
}

const filled = Object.fromEntries(Object.entries(en).filter(([, v]) => v));
await Deno.mkdir(new URL("public/i18n/", repo), { recursive: true });
await Deno.writeTextFile(new URL("public/i18n/en.js", repo), `/* Generated from i18n/en.json by tools/i18n-translate.ts. ${Object.keys(filled).length} strings. */\nwindow.CHEMHUB_I18N_EN=${JSON.stringify(filled).replace(/<\//g, "<\\/")};\n`);
console.log(`public/i18n/en.js: ${Object.keys(filled).length} of ${Object.keys(en).length} strings translated`);
