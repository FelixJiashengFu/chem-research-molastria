// One command for the cloud GPU: start the VM, send the molecules, run UMA (IP/EA, UMA-M check) and MACE-OFF23,
// fetch results.csv for the AI Lab, and stop the VM again, also when something fails. Nothing listens on the internet:
// everything goes through `gcloud compute ssh` / `scp`.
//
//   node tools/cloud/run.mjs candidates.csv [--out dir] [--keep] [--no-m] [--limit N] [--retries N]
//
// candidates.csv is the AI Lab's "导出 CSV" (any CSV with a smiles column works). Results land in
// cloud-results/<time>/results.csv (not committed); drop that file onto the AI Lab's import box.
// The VM comes from tools/cloud/cloud.local.json (kept out of git; see cloud.example.json) or the environment:
// MOLASTRIA_GCP_PROJECT, MOLASTRIA_GCP_ZONE, MOLASTRIA_GCP_INSTANCE. Needs the Google Cloud CLI, logged in.
import { spawnSync } from 'node:child_process';
import { existsSync, mkdirSync, copyFileSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const args = process.argv.slice(2);
const flag = (name) => args.includes(name);
const opt = (name, fallback) => { const i = args.indexOf(name); return i >= 0 ? args[i + 1] : fallback; };
const input = args.find((a, i) => !a.startsWith('--') && !['--out', '--limit', '--retries'].includes(args[i - 1]));
if (!input || !existsSync(input)) {
  console.error('Usage: node tools/cloud/run.mjs candidates.csv [--out dir] [--keep] [--no-m] [--limit N] [--retries N]');
  process.exit(2);
}
const local = join(HERE, 'cloud.local.json');
const conf = existsSync(local) ? JSON.parse(readFileSync(local, 'utf8')) : {};
const project = process.env.MOLASTRIA_GCP_PROJECT || conf.project;
const zone = process.env.MOLASTRIA_GCP_ZONE || conf.zone;
const instance = process.env.MOLASTRIA_GCP_INSTANCE || conf.instance;
if (!project || !zone || !instance) {
  console.error('Set the VM in tools/cloud/cloud.local.json (copy cloud.example.json) or MOLASTRIA_GCP_PROJECT / _ZONE / _INSTANCE.');
  process.exit(2);
}
const where = ['--project', project, '--zone', zone];
const stamp = new Date().toISOString().replace(/[:T]/g, '-').slice(0, 19);
const out = resolve(opt('--out', join('cloud-results', stamp)));

// gcloud is a .cmd on Windows, so it runs through the shell; arguments are quoted for it.
const quote = (a) => /^[\w@%+=:,./~-]+$/.test(a) ? a : `"${a.replace(/"/g, '\\"')}"`;
function gcloud(list, { live = false, quiet = false } = {}) {
  const r = spawnSync(['gcloud', ...list.map(quote)].join(' '), { shell: true, stdio: live ? 'inherit' : 'pipe', encoding: 'utf8' });
  const text = `${r.stdout || ''}${r.stderr || ''}`;
  if (!live && !quiet && r.status !== 0) process.stderr.write(text);
  return { ok: r.status === 0, text };
}
const sleep = (s) => new Promise((r) => setTimeout(r, s * 1000));
const status = () => gcloud(['compute', 'instances', 'describe', instance, ...where, '--format=value(status)'], { quiet: true }).text.trim();

let started = false;
async function main() {
  const lines = readFileSync(input, 'utf8').split(/\r?\n/).filter(Boolean);
  if (!/smiles/i.test(lines[0] || '')) throw new Error(`${input}: the first line needs a smiles column`);
  console.log(`${lines.length - 1} rows from ${input} → ${instance} (${zone})`);

  // 1. Start, retrying while the zone has no free GPU.
  const retries = Number(opt('--retries', 6));
  if (status() !== 'RUNNING') {
    for (let n = 0; ; n++) {
      console.log(n ? `Starting again (${n}/${retries})…` : 'Starting the VM…');
      const r = gcloud(['compute', 'instances', 'start', instance, ...where], { quiet: true });
      if (r.ok) { started = true; break; }
      if (!/STOCKOUT|RESOURCE_POOL_EXHAUSTED|does not have enough resources/i.test(r.text) || n >= retries) {
        process.stderr.write(r.text);
        throw new Error(/STOCKOUT|EXHAUSTED|enough resources/i.test(r.text)
          ? `No free ${zone} GPU after ${retries} tries. Try later, or move the VM to another zone (docs/RUNBOOK.md).`
          : 'The VM did not start.');
      }
      console.log(`${zone} has no free GPU right now; waiting 60 s`);
      await sleep(60);
    }
  } else console.log('The VM is already running; it will be left running.');

  // 2. Wait for SSH.
  const ssh = (command, opts) => gcloud(['compute', 'ssh', instance, ...where, '--quiet', '--strict-host-key-checking=no', `--command=${command}`], opts);
  for (let n = 0; !ssh('echo ready', { quiet: true }).ok; n++) {
    if (n > 20) throw new Error('SSH did not come up within 5 minutes.');
    await sleep(15);
  }

  // 3. Send the scripts and the molecules.
  const stage = join(tmpdir(), `molastria-batch-${stamp}`);
  mkdirSync(stage, { recursive: true });
  // Remote paths are relative to the home folder: pscp (gcloud on Windows) does not expand ~.
  // Unix line endings: a checkout on Windows may have turned them into CRLF, which bash rejects.
  for (const f of ['batch_uma.py', 'batch_mace.py', 'remote.sh']) writeFileSync(join(stage, f), readFileSync(join(HERE, f), 'utf8').replace(/\r\n/g, '\n'));
  copyFileSync(input, join(stage, 'input.csv'));
  ssh('rm -rf ~/molastria-batch && mkdir -p ~/molastria-batch', { quiet: true });
  const files = ['batch_uma.py', 'batch_mace.py', 'remote.sh', 'input.csv'].map((f) => join(stage, f));
  if (!gcloud(['compute', 'scp', ...files, `${instance}:molastria-batch/`, ...where, '--quiet', '--strict-host-key-checking=no']).ok) throw new Error('Copying to the VM failed.');
  rmSync(stage, { recursive: true, force: true });

  // 4. Run, in this terminal (any Hugging Face login prompt appears here, typed by you, never stored locally).
  const extra = [flag('--no-m') ? '--no-m' : '', opt('--limit') ? `--limit ${Number(opt('--limit'))}` : ''].filter(Boolean).join(' ');
  const run = gcloud(['compute', 'ssh', instance, ...where, '--quiet', '--strict-host-key-checking=no', '--command=bash ~/molastria-batch/remote.sh ' + extra, '--', '-t'], { live: true });

  // 5. Fetch whatever was finished, even after a failure.
  mkdirSync(out, { recursive: true });
  gcloud(['compute', 'scp', '--recurse', `${instance}:molastria-batch/out/*`, out, ...where, '--quiet', '--strict-host-key-checking=no'], { quiet: true });
  const result = join(out, existsSync(join(out, 'results.csv')) ? 'results.csv' : 'uma_results.csv');
  if (!existsSync(result)) throw new Error('No results came back.');
  console.log(`\nResults: ${result}\nDrop it onto the AI Lab's import box (导入结果).`);
  if (!run.ok) console.log('The run stopped early; the file has the molecules that finished. Run the same command again to continue.');
}

main().catch((e) => { console.error(`\n${e.message}`); process.exitCode = 1; }).finally(() => {
  // 6. Stop the VM unless it was already running or --keep was given. Its 2-hour limit is the backstop.
  if (started && !flag('--keep')) {
    console.log('Stopping the VM…');
    gcloud(['compute', 'instances', 'stop', instance, ...where, '--quiet'], { quiet: true });
    console.log(`VM status: ${status() || 'unknown'}`);
  }
});
