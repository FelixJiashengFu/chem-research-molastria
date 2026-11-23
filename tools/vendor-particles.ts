// Copies the WebGPU build of Particle HIVE (https://github.com/0ffz/particle-hive, MIT License)
// into public/particles/app/, where public/particles/index.html embeds it under the MolAstria header.
// Usage:
//   deno run --allow-read --allow-write tools/vendor-particles.ts [dist-dir] [repo-dir]
import { fileURLToPath } from "node:url";

const repo = fileURLToPath(new URL("../", import.meta.url));
const distDir = Deno.args[0] ?? "/tmp/particle-hive-web";
const srcRepo = Deno.args[1] ?? "/tmp/particle-hive";
const out = `${repo}public/particles/app`;

function exists(path: string): boolean {
  try {
    Deno.statSync(path);
    return true;
  } catch {
    return false;
  }
}

if (!exists(`${distDir}/index.html`) || !exists(`${distDir}/particles-demo.js`)) {
  throw new Error(`${distDir}: missing built index.html or particles-demo.js`);
}
const licenseSrc = `${srcRepo}/LICENSE`;
if (!exists(licenseSrc)) {
  throw new Error(`${licenseSrc}: missing MIT LICENSE in source repo`);
}

function readGitCommit(repoDir: string): string {
  try {
    const head = Deno.readTextFileSync(`${repoDir}/.git/HEAD`).trim();
    if (!head.startsWith("ref: ")) return head.slice(0, 7);
    const ref = head.slice(5).trim();
    const refPath = `${repoDir}/.git/${ref}`;
    if (exists(refPath)) return Deno.readTextFileSync(refPath).trim().slice(0, 7);
    const packed = `${repoDir}/.git/packed-refs`;
    if (exists(packed)) {
      for (const line of Deno.readTextFileSync(packed).split("\n")) {
        if (!line || line.startsWith("#") || line.startsWith("^")) continue;
        const [sha, name] = line.trim().split(/\s+/);
        if (name === ref && sha) return sha.slice(0, 7);
      }
    }
  } catch {
    // Source directory may not be a git checkout.
  }
  return "";
}

function copyFiltered(srcDir: string, dstDir: string) {
  Deno.mkdirSync(dstDir, { recursive: true });
  for (const entry of Deno.readDirSync(srcDir)) {
    if (entry.name.startsWith("._") || entry.name.endsWith(".map")) continue;
    const src = `${srcDir}/${entry.name}`;
    const dst = `${dstDir}/${entry.name}`;
    if (entry.isDirectory) copyFiltered(src, dst);
    else if (entry.isFile) Deno.copyFileSync(src, dst);
  }
}

if (exists(out)) Deno.removeSync(out, { recursive: true });
copyFiltered(distDir, out);

const commit = readGitCommit(srcRepo);
const indexPath = `${out}/index.html`;
let html = Deno.readTextFileSync(indexPath);
if (!html.includes('name="robots"')) {
  html = html.replace(
    "<head>",
    `<head>\n    <meta name="robots" content="noindex">\n    <!-- Particle HIVE (https://github.com/0ffz/particle-hive, MIT License, commit ${commit || "unknown"}), vendored by tools/vendor-particles.ts -->`,
  );
  Deno.writeTextFileSync(indexPath, html);
}

Deno.copyFileSync(licenseSrc, `${out}/LICENSE`);
Deno.writeTextFileSync(
  `${out}/VERSION.txt`,
  `Particle HIVE https://github.com/0ffz/particle-hive ${commit || "unknown"}\ncopied by tools/vendor-particles.ts (source map omitted)\n`,
);
Deno.writeTextFileSync(
  `${out}/NOTICE.txt`,
  [
    "Particle HIVE (WebGPU particle simulation)",
    "Upstream: https://github.com/0ffz/particle-hive",
    "License: MIT License (see LICENSE in this directory)",
    "Copyright (c) 2025 Danielle Voznyy",
    "",
    `Vendored build commit: ${commit || "unknown"} (includes upstream PR #11 fixes & WebGPU pre-check UI)`,
    "Excluded build artifact: particles-demo.js.map",
  ].join("\n") + "\n",
);

function dirSize(dir: string): number {
  let total = 0;
  for (const entry of Deno.readDirSync(dir)) {
    if (entry.name.startsWith("._")) continue;
    const path = `${dir}/${entry.name}`;
    if (entry.isDirectory) total += dirSize(path);
    else if (entry.isFile) total += Deno.statSync(path).size;
  }
  return total;
}

console.log(`particle-hive ${commit || "(no git)"} -> public/particles/app/ (${(dirSize(out) / 1048576).toFixed(2)} MB)`);
