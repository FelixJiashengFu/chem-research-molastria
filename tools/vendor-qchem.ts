// Copies 量子化学计算 QChem Web (a separate repository, one self-contained HTML file) into public/qchem/app/,
// where public/qchem/index.html shows it under the MolAstria header. Build it first, then run this:
//   cd ../qchem-web && python3 tools/build.py
//   deno run --allow-read --allow-write --allow-run=git tools/vendor-qchem.ts [path/to/qchem-web]
// QChem Web carries its own Chinese/English dictionary (MolAstria's i18n.js is not loaded in the frame);
// qchem/index.html passes ?embed=1&lang=… so the frame follows the site's language and hides its own switch.
// It has a single dark theme and ignores MolAstria's light/dark switch (docs/DECISIONS.md, 2026-11-03).
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const src = `${Deno.args[0] ?? `${repo}../qchem-web`}/`;
const out = `${repo}public/qchem/app/`;
await Deno.mkdir(out, { recursive: true });

let html = await Deno.readTextFile(`${src}index.html`);
if (!/^<!doctype html>\s*<html[^>]*>\s*<head>/i.test(html) || !html.includes("window.QCHEM_I18N_EN")) {
  throw new Error("index.html: unexpected layout or no built-in dictionary; rebuild qchem-web or update tools/vendor-qchem.ts");
}
let version = "";
try {
  const p = new Deno.Command("git", { args: ["-C", src, "rev-parse", "--short", "HEAD"], stdout: "piped", stderr: "null" }).outputSync();
  if (p.success) version = new TextDecoder().decode(p.stdout).trim();
} catch { /* not a checkout */ }
// The note and noindex go inside <head>: anything before the doctype would put the page in quirks mode.
html = html.replace(/<head>/i, `<head>
<!-- 量子化学计算 QChem Web${version ? ` ${version}` : ""} (https://github.com/FelixJiashengFu/qchem-web), copied by tools/vendor-qchem.ts; do not edit here -->
<meta name="robots" content="noindex">`);
await Deno.writeTextFile(`${out}index.html`, html);
console.log(`qchem ${version || "(no git)"} → public/qchem/app/index.html (${Math.round(html.length / 1024)} KB)`);
