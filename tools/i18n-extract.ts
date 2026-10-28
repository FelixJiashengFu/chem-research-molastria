// Collect every Chinese UI string the site can show, as keys for i18n/en.json.
//   deno run --allow-read --allow-write tools/i18n-extract.ts
// HTML: text nodes and placeholder / title / aria-label / alt attributes.
// JS:   string and template literals; ${…} becomes {0}, {1}…, and templates are split at HTML tags so each
//       key matches one rendered text node. Catalogue fields that appear in the interface (categories,
//       access, short descriptions, source names) are taken from the data files.
// Existing translations in i18n/en.json are kept; new keys are added with an empty value.
const repo = new URL("../", import.meta.url);
const pub = new URL("public/", repo);
const HAN = /[㐀-鿿]/;
const norm = (s: string) => s.replace(/\s+/g, " ").trim();
const ENT: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', "#39": "'", apos: "'", nbsp: " ", times: "×", middot: "·", rarr: "→", larr: "←", hellip: "…" };
const decode = (s: string) => s.replace(/&(#x?[0-9a-f]+|\w+);/gi, (m, e) => e[0] === "#" ? String.fromCodePoint(e[1] === "x" ? parseInt(e.slice(2), 16) : Number(e.slice(1))) : ENT[e] ?? m);

const keys = new Map<string, Set<string>>();
function add(text: string, from: string, max = 600) {
  const k = norm(decode(text));
  if (!k || !HAN.test(k) || k.length > max) return;
  if ((k.match(/\{\d\}/g) || []).length > 6) return;
  // A key made only of slots and punctuation around one short word is too greedy to be a pattern.
  const literal = k.replace(/\{\d\}/g, "");
  if (/\{\d\}/.test(k) && (literal.match(/[㐀-鿿]/g) || []).length < 2) return;
  if (!keys.has(k)) keys.set(k, new Set());
  keys.get(k)!.add(from);
}

// ── HTML ────────────────────────────────────────────────────────────────
function fromHTML(html: string, from: string) {
  const body = html.replace(/<script\b[\s\S]*?<\/script>/gi, "").replace(/<style\b[\s\S]*?<\/style>/gi, "").replace(/<!--[\s\S]*?-->/g, "");
  for (const seg of body.split(/<[^>]*>/)) add(seg, from);
  for (const m of body.matchAll(/\s(?:placeholder|title|aria-label|alt)="([^"]*)"/g)) add(m[1], from);
  const t = html.match(/<title>([\s\S]*?)<\/title>/);
  if (t) add(t[1], from);
}

// ── JS ──────────────────────────────────────────────────────────────────
type Template = string[]; // text chunks around ${} slots
function literals(src: string): Template[] {
  const out: Template[] = [];
  let i = 0, prev = "";
  const n = src.length;
  const esc = (c: string) => ({ n: "\n", t: "\t", r: "", b: "", "0": "" }[c] ?? c);
  const readEscape = (): string => {
    const c = src[i + 1];
    if (c === "u") {
      if (src[i + 2] === "{") { const end = src.indexOf("}", i); const cp = parseInt(src.slice(i + 3, end), 16); i = end + 1; return String.fromCodePoint(cp); }
      const cp = parseInt(src.slice(i + 2, i + 6), 16); i += 6; return String.fromCharCode(cp);
    }
    if (c === "\n") { i += 2; return ""; }
    i += 2; return esc(c);
  };
  const readString = (q: string) => {
    let s = ""; i++;
    while (i < n && src[i] !== q && src[i] !== "\n") { if (src[i] === "\\") { s += readEscape(); continue; } s += src[i++]; }
    i++; out.push([s]); prev = "a";
  };
  const readTemplate = () => {
    const chunks = [""]; i++;
    while (i < n && src[i] !== "`") {
      if (src[i] === "\\") { chunks[chunks.length - 1] += readEscape(); continue; }
      if (src[i] === "$" && src[i + 1] === "{") { i += 2; expr(); chunks.push(""); continue; }
      chunks[chunks.length - 1] += src[i++];
    }
    i++; out.push(chunks); prev = "a";
  };
  const readRegex = () => {
    i++; let cls = false;
    while (i < n) { const c = src[i]; if (c === "\\") { i += 2; continue; } if (c === "[") cls = true; else if (c === "]") cls = false; else if (c === "/" && !cls) break; else if (c === "\n") break; i++; }
    i++; while (/[a-z]/i.test(src[i] || "")) i++; prev = "a";
  };
  const step = (): boolean => {
    const c = src[i];
    if (c === "'" || c === '"') { readString(c); return true; }
    if (c === "`") { readTemplate(); return true; }
    if (c === "/" && src[i + 1] === "/") { while (i < n && src[i] !== "\n") i++; return true; }
    if (c === "/" && src[i + 1] === "*") { const e = src.indexOf("*/", i + 2); i = e < 0 ? n : e + 2; return true; }
    if (c === "/") {
      const word = src.slice(Math.max(0, i - 8), i).match(/(return|typeof|case|in|of)\s*$/);
      if (!prev || "(,=:[!&|?{};+-*%<>~^".includes(prev) || word) { readRegex(); return true; }
    }
    if (!/\s/.test(c)) prev = /[\w$)\]]/.test(c) ? "a" : c;
    i++; return false;
  };
  const expr = () => {
    let depth = 0;
    while (i < n) {
      const c = src[i];
      if (c === "{") { depth++; i++; prev = "{"; continue; }
      if (c === "}") { if (!depth) { i++; prev = "a"; return; } depth--; i++; prev = "}"; continue; }
      step();
    }
  };
  while (i < n) step();
  return out;
}
function fromJS(src: string, from: string) {
  for (const t of literals(src)) {
    // Join with markers, split at tags, then number the slots inside each piece.
    const joined = t.map((c, k) => (k ? "\u0000" : "") + c).join("");
    const pieces = joined.split(/<[^<>]*>/);
    // Literals glued with `+` start or end inside a tag: '" target="_blank">原文 ↗' or '原文</a'.
    if (pieces[0].includes(">") && !pieces[0].includes("<")) pieces[0] = pieces[0].slice(pieces[0].lastIndexOf(">") + 1);
    const last = pieces.length - 1;
    if (pieces[last].includes("<") && !pieces[last].slice(pieces[last].lastIndexOf("<")).includes(">")) pieces[last] = pieces[last].slice(0, pieces[last].lastIndexOf("<"));
    for (const p of pieces) {
      let k = 0;
      const key = p.replace(/\u0000/g, () => `{${k++}}`);
      add(key, from, 400);
    }
    // Attribute values inside the template's tags (aria-label="…", placeholder="…").
    for (const m of joined.matchAll(/(?:placeholder|title|aria-label|alt)="([^"]*)"/g)) { let k = 0; add(m[1].replace(/\u0000/g, () => `{${k++}}`), from, 400); }
  }
}

// ── sources ─────────────────────────────────────────────────────────────
const read = (p: string) => Deno.readTextFile(new URL(p, pub));
for (const f of ["index.html", "atlas/index.html", "hub/index.html", "hub/network.html", "lab/index.html"]) fromHTML(await read(f), f);
for (const f of ["shared-nav.js", "app.js", "atlas/app.js", "hub/app.js", "hub/network.js", "lab/lab.js", "lab/chem.js", "ai/ai.js"]) fromJS(await read(f), f);
fromJS(await Deno.readTextFile(new URL("tools/build-seo.ts", repo)), "tools/build-seo.ts");

const g = globalThis as any;
g.window = g;
new Function(await read("atlas/content.js"))();
new Function(await read("merged-data.js"))();
new Function(await read("hub/data.js"))();
for (const r of g.CHEMDB_CONTENT.resources) { add(r.category, "atlas data"); add(r.access, "atlas data"); add(r.description, "atlas data"); add(r.detail, "atlas data"); }
for (const gd of g.CHEMDB_CONTENT.guides) add(gd.title, "guide titles");
add(g.CHEMVIS_DATA.compliance || "", "hub data");
for (const x of g.CHEMVIS_DATA.xmolHomepageStats || []) add(x, "hub data");
// Short category names atlas/app.js derives with .replace() for the sidebar.
for (const r of g.CHEMDB_CONTENT.resources) add(r.category.replace("与基础参数", "与参数").replace("、生物活性与化学空间", "与化学空间"), "atlas data");
for (const data of [g.CHEMRESEARCH_DATA, g.CHEMVIS_DATA]) {
  for (const s of data.sources) { add(s.name, "sources"); add(s.role, "sources"); add(s.statusLabel, "sources"); add(s.note || "", "sources"); }
  const tags = new Map<string, number>(), cats = new Map<string, number>();
  for (const it of data.items) { for (const t of it.tags || []) tags.set(t, (tags.get(t) || 0) + 1); if (it.category) cats.set(it.category, (cats.get(it.category) || 0) + 1); }
  for (const [t, c] of tags) if (c >= 3) add(t, "tags");
  for (const [t] of cats) add(t, "categories");
}

// ── merge ───────────────────────────────────────────────────────────────
const enUrl = new URL("i18n/en.json", repo);
let en: Record<string, string> = {};
try { en = JSON.parse(await Deno.readTextFile(enUrl)); } catch { /* first run */ }
const merged: Record<string, string> = {};
for (const k of [...keys.keys()].sort()) merged[k] = en[k] ?? "";
for (const [k, v] of Object.entries(en)) if (!(k in merged) && v) merged[k] = v; // keep hand-added entries
await Deno.mkdir(new URL("i18n/", repo), { recursive: true });
await Deno.writeTextFile(enUrl, JSON.stringify(merged, null, 1) + "\n");
await Deno.writeTextFile(new URL("i18n/sources.json", repo), JSON.stringify(Object.fromEntries([...keys].map(([k, s]) => [k, [...s]])), null, 1) + "\n");
const missing = Object.values(merged).filter((v) => !v).length;
console.log(`${Object.keys(merged).length} keys, ${missing} untranslated, ${[...keys.keys()].filter((k) => /\{\d\}/.test(k)).length} patterns`);
