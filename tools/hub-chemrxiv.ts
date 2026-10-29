// Adds (or refreshes) the ChemRxiv source in the catalogue snapshot: public/hub/data.{json,js} and public/merged-data.{json,js}.
//   deno run --allow-net --allow-read --allow-write tools/hub-chemrxiv.ts [days=21] [count=50]
// ChemRxiv moved to Wiley in 2026 and its site answers programs with a Cloudflare challenge, so the records come from
// Crossref (prefix 10.26434, every posting within minutes, abstracts included). Crossref has no subject field for
// ChemRxiv, so theoretical/computational papers are picked by keywords in the title and abstract.
import { fileURLToPath } from "node:url";

const DAYS = Number(Deno.args[0] ?? 21), COUNT = Number(Deno.args[1] ?? 50);
const pub = fileURLToPath(new URL("../public/", import.meta.url));
const UA = "MolAstria catalogue (https://molastria.com/)";

// ── fetch the recent postings ──────────────────────────────────────────
type Work = { DOI: string; title?: string[]; author?: { given?: string; family?: string; name?: string }[]; abstract?: string; created?: { "date-time": string }; posted?: { "date-parts": number[][] } };
const from = new Date(Date.now() - DAYS * 86400e3).toISOString().slice(0, 10);
const works: Work[] = [];
let cursor = "*";
for (let page = 0; page < 5; page++) {
  const q = new URLSearchParams({ filter: `prefix:10.26434,type:posted-content,from-created-date:${from}`, sort: "created", order: "desc", rows: "1000", cursor, select: "DOI,title,author,abstract,created,posted" });
  const res = await fetch(`https://api.crossref.org/works?${q}`, { headers: { "User-Agent": UA } });
  if (!res.ok) throw new Error(`Crossref HTTP ${res.status}`);
  const m = (await res.json()).message;
  works.push(...m.items);
  if (m.items.length < 1000 || !m["next-cursor"]) break;
  cursor = m["next-cursor"];
  await new Promise((r) => setTimeout(r, 1100)); // public pool: about one request a second
}
console.log(`Crossref: ${works.length} ChemRxiv postings since ${from}`);

// ── keep the newest version of each theoretical / computational paper ──
const clean = (s = "") => s.replace(/<[^>]+>/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&").replace(/\s+/g, " ").trim();
const STRONG = /\b(DFT|TD-?DFT|density[- ]functional|ab initio|first[- ]principles|coupled[- ]cluster|CCSD|CASSCF|CASPT2|NEVPT2|multireference|quantum[- ]chemi\w*|electronic[- ]structure|molecular dynamics|MD simulations?|force[- ]fields?|metadynamics|enhanced sampling|QM\/MM|free[- ]energy (?:perturbation|calculations?|surfaces?)|semi-?empirical|GFN\d?-?xTB|xTB|basis sets?|wave ?functions?|machine[- ]learn\w*|neural networks?|interatomic potentials?|computational(?:ly)?|in silico|theoretical(?:ly)?|simulations?|calculations?|Monte Carlo|docking)\b/gi;
const distinct = (text: string) => new Set([...text.matchAll(STRONG)].map((m) => m[0].toLowerCase().replace(/s$/, ""))).size;
const base = (doi: string) => doi.toLowerCase().replace(/[/.-]v\d+$/, "");
const byPaper = new Map<string, Work & { title0: string; abs: string; score: number; date: string }>();
for (const w of works) {
  const title0 = clean(w.title?.[0]), abs = clean(w.abstract).replace(/^Abstract\s*/i, "");
  if (!title0) continue;
  const inTitle = distinct(title0), score = distinct(`${title0} ${abs}`);
  if (!(inTitle >= 1 && score >= 2) && score < 3) continue; // computational in the title, or clearly so in the abstract
  const p = w.posted?.["date-parts"]?.[0];
  const date = p?.length === 3 ? `${p[0]}-${String(p[1]).padStart(2, "0")}-${String(p[2]).padStart(2, "0")}` : (w.created?.["date-time"] || "").slice(0, 10);
  const prev = byPaper.get(base(w.DOI));
  if (!prev || (w.created?.["date-time"] || "") > (prev.created?.["date-time"] || "")) byPaper.set(base(w.DOI), { ...w, title0, abs, score, date });
}
const picked = [...byPaper.values()].sort((a, b) => (b.created?.["date-time"] || "").localeCompare(a.created?.["date-time"] || "")).slice(0, COUNT);
console.log(`theoretical/computational: ${byPaper.size} papers, keeping the newest ${picked.length}`);

// ── records in the snapshot's shape, tagged with the catalogue's existing topics ──
const TOPICS: [string, RegExp][] = [
  ["AI与机器学习", /machine[- ]learn|neural network|deep learning|graph neural|transformer|language model|LLM|generative|active learning|interatomic potential|MLIP/i],
  ["分子动力学", /molecular dynamics|MD simulation|force[- ]field|coarse[- ]grain|metadynamics|enhanced sampling|umbrella sampling|replica exchange|free[- ]energy perturbation/i],
  ["激发态与光谱", /excited[- ]state|TD-?DFT|photophysic|photochemi|absorption spectr|fluorescen|phosphorescen|spectroscop|vibronic|NMR chemical shift/i],
  ["催化与反应", /cataly|reaction mechanism|transition state|activation (?:barrier|energ)|reaction pathway|kinetic/i],
  ["VASP/第一性原理", /\bVASP\b|plane[- ]wave|first[- ]principles|periodic DFT|band structure|slab model|surface adsorption/i],
  ["弱相互作用", /non-?covalent|dispersion correction|hydrogen bond|halogen bond|van der Waals|SAPT|energy decomposition/i],
  ["电荷与静电势", /electrostatic potential|partial charge|atomic charge|population analysis/i],
  ["量子化学", /\bDFT\b|density[- ]functional|ab initio|coupled[- ]cluster|CCSD|CASSCF|multireference|quantum[- ]chemi|electronic[- ]structure|wave ?function/i],
];
const hex = async (s: string, n: number) => [...new Uint8Array(await crypto.subtle.digest("SHA-1", new TextEncoder().encode(s)))].map((b) => b.toString(16).padStart(2, "0")).join("").slice(0, n);
const items = [];
for (const w of picked) {
  const text = `${w.title0} ${w.abs}`;
  const tags = TOPICS.filter(([, re]) => re.test(text)).map(([t]) => t).slice(0, 2);
  items.push({
    id: await hex(w.DOI, 12),
    source: "chemrxiv",
    type: "preprint",
    title: w.title0,
    url: `https://doi.org/${w.DOI}`,
    excerpt: w.abs.length > 180 ? `${w.abs.slice(0, 180)}…` : w.abs,
    date: w.date,
    category: "ChemRxiv",
    tags: tags.length ? tags : ["预印本"],
    authors: (w.author || []).slice(0, 3).map((a) => a.name || [a.given, a.family].filter(Boolean).join(" ")).join("、"),
    metric: `DOI:${w.DOI}`,
  });
}
const fetchedAt = (() => { // local time with offset, like the rest of the snapshot
  const d = new Date(), off = -d.getTimezoneOffset(), pad = (n: number) => String(Math.trunc(Math.abs(n))).padStart(2, "0");
  return new Date(d.getTime() + off * 60e3).toISOString().slice(0, 19) + (off >= 0 ? "+" : "-") + pad(off / 60) + ":" + pad(off % 60);
})();
const source = {
  id: "chemrxiv", name: "ChemRxiv 计算化学", url: "https://chemrxiv.org/",
  role: "ChemRxiv 理论与计算化学最新预印本（Crossref 官方元数据，按标题与摘要筛选，DOI 直达）",
  color: "#c26a2e", status: "ok", statusLabel: "直抓成功", fetchedAt, itemCount: items.length, usedCache: false,
};

// ── write both snapshots; the source goes right after arXiv ──
function place(sources: any[]) {
  const rest = sources.filter((s) => s.id !== "chemrxiv");
  const at = rest.findIndex((s) => s.id === "arxiv");
  rest.splice(at >= 0 ? at + 1 : rest.length, 0, source);
  return rest;
}
async function save(name: string, global: string, data: unknown) {
  await Deno.writeTextFile(`${pub}${name}.json`, JSON.stringify(data, null, 1));
  await Deno.writeTextFile(`${pub}${name}.js`, `window.${global} = ${JSON.stringify(data)};\n`);
}
const keepJson = async (name: string) => JSON.parse(await Deno.readTextFile(`${pub}${name}.json`));

const hub = await keepJson("hub/data");
hub.sources = place(hub.sources);
hub.items = [...hub.items.filter((i: any) => i.source !== "chemrxiv"), ...items];
await save("hub/data", "CHEMVIS_DATA", hub);

const merged = await keepJson("merged-data");
merged.sources = place(merged.sources);
const mergedItems = [];
for (const it of items) mergedItems.push({ ...it, id: await hex(`chemrxiv:${it.metric}`, 16), origins: ["hub"], sourceIds: ["chemrxiv"], sourceRecords: [it] });
merged.items = [...merged.items.filter((i: any) => !(i.sourceIds || [i.source]).includes("chemrxiv")), ...mergedItems];
merged.stats = { ...merged.stats, hubEntries: hub.items.length, uniqueEntries: merged.items.length, sources: merged.sources.length };
await save("merged-data", "CHEMRESEARCH_DATA", merged);

const tagCount: Record<string, number> = {};
items.forEach((i) => i.tags.forEach((t) => (tagCount[t] = (tagCount[t] || 0) + 1)));
console.log(`wrote ${items.length} ChemRxiv records · hub ${hub.items.length} · merged ${merged.items.length} · tags`, tagCount);
