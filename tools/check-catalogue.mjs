// Guards the weekly refresh: compares the rebuilt catalogue with the committed one and fails if it shrank
// noticeably, a source came back empty or vanished, or the snapshot files grew past what the pages should load,
// so a bad crawl never replaces a good snapshot. A source that failed this week keeps last week's entries
// (status "cache"); those are listed, not refused.
//   node tools/check-catalogue.mjs            (run after maintenance/refresh_data.py and tools/hub-chemrxiv.ts)
import { execSync } from 'node:child_process';
import fs from 'node:fs';

// shortcut: fixed size ceilings (about 1.5x the 2026-11-06 snapshot); raise them deliberately if the pages are made to load lazily.
const MAX_BYTES = { 'public/hub/data.js': 1.6e6, 'public/merged-data.js': 3.2e6 };

const now = JSON.parse(fs.readFileSync('public/merged-data.json', 'utf8'));
const hub = JSON.parse(fs.readFileSync('public/hub/data.json', 'utf8'));
let before = null;
try { before = JSON.parse(execSync('git show HEAD:public/merged-data.json', { encoding: 'utf8', maxBuffer: 64 << 20 })); } catch { /* first run */ }

const problems = [];
const count = (d) => d.stats.uniqueEntries;
if (before && count(now) < count(before) * 0.85) problems.push(`entries dropped from ${count(before)} to ${count(now)}`);
for (const s of now.sources) if (!s.itemCount) problems.push(`source ${s.id} has no entries`);
for (const s of before?.sources || []) if (!now.sources.some((x) => x.id === s.id)) problems.push(`source ${s.id} disappeared`);
if (!now.sources.some((s) => s.id === 'chemrxiv')) problems.push('ChemRxiv entries are missing (run tools/hub-chemrxiv.ts)');
for (const [file, max] of Object.entries(MAX_BYTES)) {
  const size = fs.statSync(file).size;
  if (size > max) problems.push(`${file} is ${(size / 1e6).toFixed(2)} MB, over ${(max / 1e6).toFixed(1)} MB (lower the per-source caps in maintenance/crawler.py)`);
}

const zh = new Set(hub.sources.filter((s) => s.lang === 'zh').map((s) => s.id));
const intl = hub.items.filter((i) => !zh.has(i.source)).length;
console.log(`catalogue: ${before ? count(before) : '?'} -> ${count(now)} entries; generated ${now.generatedAt}`);
console.log(`hub snapshot: ${hub.items.length} entries, ${intl} from international sources (${(100 * intl / hub.items.length).toFixed(1)}%)`);
for (const s of now.sources) console.log(`  ${s.id.padEnd(15)} ${String(s.itemCount).padStart(4)}  ${s.status || ''}`);
const cached = now.sources.filter((s) => s.status === 'cache').map((s) => s.id);
if (cached.length) console.log(`kept last week's entries (fetch failed this week): ${cached.join(', ')}`);
if (intl * 2 < hub.items.length) console.log('note: international sources are below half of the snapshot');
if (problems.length) {
  console.error('Refusing to publish this snapshot:\n  ' + problems.join('\n  '));
  process.exit(1);
}
