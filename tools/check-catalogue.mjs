// Guards the weekly refresh: compares the rebuilt catalogue with the committed one and fails if it shrank
// noticeably or a source came back empty, so a bad crawl never replaces a good snapshot.
//   node tools/check-catalogue.mjs            (run after maintenance/refresh_data.py and tools/hub-chemrxiv.ts)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

const now = JSON.parse(fs.readFileSync('public/merged-data.json', 'utf8'));
let before = null;
try { before = JSON.parse(execSync('git show HEAD:public/merged-data.json', { encoding: 'utf8', maxBuffer: 64 << 20 })); } catch { /* first run */ }

const problems = [];
const count = (d) => d.stats.uniqueEntries;
if (before && count(now) < count(before) * 0.85) problems.push(`entries dropped from ${count(before)} to ${count(now)}`);
for (const s of now.sources) if (!s.itemCount) problems.push(`source ${s.id} has no entries`);
if (!now.sources.some((s) => s.id === 'chemrxiv')) problems.push('ChemRxiv entries are missing (run tools/hub-chemrxiv.ts)');

console.log(`catalogue: ${before ? count(before) : '?'} -> ${count(now)} entries; generated ${now.generatedAt}`);
for (const s of now.sources) console.log(`  ${s.id.padEnd(9)} ${String(s.itemCount).padStart(4)}  ${s.status || ''}`);
if (problems.length) {
  console.error('Refusing to publish this snapshot:\n  ' + problems.join('\n  '));
  process.exit(1);
}
