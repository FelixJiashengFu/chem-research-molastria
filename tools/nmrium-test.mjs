// Tests for the NMRium page's glue logic (public/nmr/nmrium/nmrium-core.js), its sample data and the vendored app
// (public/nmr/nmrium/app/, built by tools/vendor-nmrium.mjs).
//   node --test tools/nmrium-test.mjs
// With NMRIUM_NODE_MODULES pointing at the node_modules of a wrapper checkout built by tools/vendor-nmrium.mjs, the
// practice spectra and the samples are also read by NMRium's own reader (nmr-load-save), as the app will read them.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, statSync, mkdtempSync, writeFileSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import { createRequire } from 'node:module';
import vm from 'node:vm';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const PUB = join(ROOT, 'public');
const DIR = join(PUB, 'nmr', 'nmrium');
const box = { window: {}, TextEncoder, URLSearchParams };
vm.runInNewContext(readFileSync(join(DIR, 'nmrium-core.js'), 'utf8'), box);
vm.runInNewContext(readFileSync(join(PUB, 'spectra', 'sp-practice.js'), 'utf8'), box);
const N = box.window.MolAstriaNMRium;
const PR = box.window.MOLASTRIA_SPECTRA_PRACTICE;
const plain = (v) => JSON.parse(JSON.stringify(v));

test('file types and picking', () => {
  assert.equal(N.classify('a/b/1H.JDX'), 'jcamp');
  assert.equal(N.classify('x.dx'), 'jcamp');
  assert.equal(N.classify('x.jdf'), 'jeol');
  assert.equal(N.classify('exp.zip'), 'zip');
  assert.equal(N.classify('state.nmrium'), 'nmrium');
  assert.equal(N.classify('m.mol'), 'molecule');
  assert.equal(N.classify('fid'), 'bruker-part');
  assert.equal(N.classify('photo.png'), null);
  const p = N.pick([{ name: 'a.jdx', size: 10 }, { name: 'b.png', size: 10 }, { name: 'fid', size: 10 }, { name: 'huge.zip', size: N.MAX_BYTES + 1 }]);
  assert.deepEqual(plain(p.send).map((f) => f.name), ['a.jdx']);
  assert.deepEqual(plain(p.skipped), ['b.png', 'fid']);
  assert.deepEqual(plain(p.big), ['huge.zip']);
  assert.equal(p.bruker, false);
  // a picked Bruker experiment folder: everything goes, packed into one zip
  const f = N.pick([{ name: 'fid', size: 5, path: 'aspirin/1/fid' }, { name: 'acqus', size: 5, path: 'aspirin/1/acqus' }, { name: 'title', size: 1, path: 'aspirin/1/pdata/1/title' }]);
  assert.equal(f.bruker, true);
  assert.equal(f.send.length, 3);
  assert.equal(N.zipName(['aspirin/1/fid', 'aspirin/1/acqus']), 'aspirin.zip');
  assert.equal(N.zipName(['a/fid', 'b/fid']), 'bruker.zip');
  assert.equal(N.zipPath('/../a\\b/./c'), 'a/b/c');
});

test('the zip is read back by Python (names, contents, CRC)', (t) => {
  const enc = new TextEncoder();
  const entries = [{ name: 'exp/1/acqus', data: enc.encode('##$SFO1= 400.13\n') }, { name: 'exp/1/fid', data: Uint8Array.from({ length: 4096 }, (_, i) => (i * 37) & 255) }, { name: 'exp/1/pdata/1/title', data: enc.encode('阿司匹林') }];
  const bytes = N.zip(entries);
  assert.equal(N.crc32(enc.encode('123456789')), 0xcbf43926, 'CRC-32 check value');
  const py = spawnSync('python3', ['--version']);
  if (py.status !== 0) { t.skip('python3 not found'); return; }
  const dir = mkdtempSync(join(tmpdir(), 'nmrium-zip-'));
  writeFileSync(join(dir, 'a.zip'), bytes);
  const r = spawnSync('python3', ['-I', '-c', 'import sys,zipfile,json\nz=zipfile.ZipFile(sys.argv[1])\nassert z.testzip() is None\nprint(json.dumps({i.filename:list(z.read(i)) for i in z.infolist()}))', join(dir, 'a.zip')], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  const got = JSON.parse(r.stdout);
  for (const e of entries) assert.deepEqual(got[e.name], [...e.data], e.name);
});

test('messages to and from the wrapper', () => {
  const m = plain(N.loadMessage(['f1', 'f2'], '1H'));
  assert.deepEqual(m, { type: 'nmr-wrapper:load', data: { type: 'file', data: ['f1', 'f2'], activeTab: '1H' } });
  assert.equal(plain(N.loadMessage([], '')).data.activeTab, undefined);
  assert.deepEqual(plain(N.actionMessage('exportSpectraViewerAsBlob')), { type: 'nmr-wrapper:action-request', data: { type: 'exportSpectraViewerAsBlob' } });
  assert.deepEqual(plain(N.readMessage({ type: 'nmr-wrapper:ready', data: {} })), { kind: 'ready', data: {} });
  assert.equal(N.readMessage({ type: 'nmr-wrapper:load', data: {} }), null, 'our own outgoing type is not an incoming event');
  assert.equal(N.readMessage({ type: 'ra-host:theme' }), null);
  assert.equal(N.readMessage('nmr-wrapper:ready'), null);
  assert.equal(N.readMessage(null), null);
  assert.equal(N.errorText({ message: 'x'.repeat(400) }).length, 300);
  assert.equal(N.spectraCount({ state: { data: { spectra: [1, 2] } } }), 2);
  assert.equal(N.spectraCount({}), null);
  assert.equal(N.frameSrc({ workspace: 'default' }), 'app/index.html?workspace=default');
  assert.equal(N.frameSrc(), 'app/index.html');
  assert.deepEqual(plain(N.parseHash('#sample=aspirin')), { sample: 'aspirin' });
  assert.equal(N.parseHash('#sample=nope'), null);
  assert.deepEqual(plain(N.parseHash('#practice=etoac-0')), { practice: 'etoac', fig: 0 });
  assert.equal(N.parseHash('#practice=<x>-0'), null);
  assert.equal(N.parseHash(''), null);
});

test('practice spectra become JCAMP-DX with the stated peaks and integrals', () => {
  const figs = N.practiceFigures(PR.problems);
  assert.deepEqual(plain(figs.map((f) => `${f.problem}-${f.fig}`)), ['etoac-0', 'tbe-0', 'tbe-1', 'sbu-0', 'sbu-1'], 'every 1D figure, no 2D one');
  for (const f of figs) {
    const p = PR.problems.find((x) => x.id === f.problem), out = N.practiceFile(p, f.fig);
    const back = N.readJcamp(out.text);
    const spec = N.practiceSpectrum(f.args);
    assert.equal(back.npoints, spec.hz.length, `${out.name} NPOINTS`);
    assert.equal(back.y.length, spec.hz.length, `${out.name} all points written`);
    assert.ok(Math.abs(back.hz.at(-1) - spec.hz.at(-1)) < 1e-3, `${out.name} X++ spacing adds up to LASTX`);
    assert.match(out.text, /not measured/);
    assert.match(out.text, /##DATA TYPE=NMR SPECTRUM/);
    assert.equal((spec.hz[0] - spec.hz[1]) <= spec.hwhm / 3 + 1e-9, true, 'fine enough grid for the lines');
    if (spec.nominal) assert.match(out.text, /MHz assumed/);
  }
  // problem 1: ethyl acetate at 250.13 MHz; the three groups integrate 2 : 3 : 3, and the largest point is the singlet
  const p1 = PR.problems.find((x) => x.id === 'etoac'), s1 = N.practiceSpectrum(p1.figs[0].args);
  assert.equal(s1.mhz, 250.13);
  const area = (lo, hi) => { let a = 0; for (let i = 0; i < s1.hz.length; i++) { const ppm = s1.hz[i] / s1.mhz; if (ppm >= lo && ppm <= hi) a += s1.y[i]; } return a; };
  const q = area(4.0, 4.3), s = area(1.95, 2.15), tr = area(1.15, 1.4);
  assert.ok(Math.abs(q / s - 2 / 3) < 0.03 && Math.abs(tr / s - 1) < 0.03, `integrals ${q / s} ${tr / s}`);
  let imax = 0;
  for (let i = 0; i < s1.y.length; i++) if (s1.y[i] > s1.y[imax]) imax = i;
  assert.ok(Math.abs(s1.hz[imax] / s1.mhz - 2.05) < 0.002);
  // problem 2's carbon spectrum is at the stated 62.9 MHz, not the fallback
  assert.equal(N.practiceSpectrum(PR.problems.find((x) => x.id === 'tbe').figs[0].args).mhz, 62.9);
  assert.equal(N.practiceLines({ x: [0, 1] }), null);
});

test('samples exist, are small enough and carry their licence', () => {
  const notice = readFileSync(join(DIR, 'samples', 'NOTICE.txt'), 'utf8');
  assert.match(notice, /MIT License/);
  let total = 0;
  for (const s of N.SAMPLES) {
    for (const k of ['zh', 'en']) { assert.ok(s.name[k] && s.what[k] && s.kind[k], `${s.id} ${k}`); }
    for (const f of s.files) {
      const p = join(DIR, 'samples', f);
      assert.ok(existsSync(p), f);
      total += statSync(p).size;
      assert.ok(notice.includes(f), `${f} is listed in NOTICE.txt`);
      assert.ok(N.classify(f), `${f} is a type NMRium reads`);
    }
  }
  assert.ok(total < 6 * 1048576, `samples total ${total} bytes`);
  for (const k of Object.keys(N.TEXT)) assert.ok(N.TEXT[k].zh && N.TEXT[k].en, k);
});

test('the vendored app matches the pin and stays permissively licensed', () => {
  const app = join(DIR, 'app');
  const vendor = readFileSync(join(ROOT, 'tools', 'vendor-nmrium.mjs'), 'utf8');
  const version = readFileSync(join(app, 'VERSION.txt'), 'utf8');
  const tag = /export const TAG = '([^']+)'/.exec(vendor)[1], commit = /export const COMMIT = '([^']+)'/.exec(vendor)[1];
  assert.equal(tag, N.BUILD.wrapper);
  assert.ok(version.includes(`nmrium-react-wrapper ${tag} ${commit}`), 'app/VERSION.txt is from the pinned wrapper: run node tools/vendor-nmrium.mjs');
  assert.ok(version.includes(`nmrium ${N.BUILD.nmrium}`), 'NMRium version in nmrium-core.js BUILD');
  const html = readFileSync(join(app, 'index.html'), 'utf8');
  assert.match(html, /name="robots" content="noindex"/);
  assert.doesNotMatch(html, /manifest|registerSW/);
  for (const m of html.matchAll(/(?:src|href)="\.\/(assets\/[^"]+)"/g)) assert.ok(existsSync(join(app, m[1])), m[1]);
  const js = [...html.matchAll(/src="\.\/(assets\/[^"]+\.js)"/g)].map((m) => readFileSync(join(app, m[1]), 'utf8')).join('\n');
  assert.ok(js.includes('nmr-wrapper') && js.includes('"ready"'), 'patched: ready event');
  assert.ok(!js.includes('nmrium-react-wrapper/main/src/allowed-origins.json'), 'patched: no allowed-origins download');
  const lic = readFileSync(join(app, 'THIRD-PARTY-LICENSES.md'), 'utf8');
  const kinds = [...lic.matchAll(/^## \S+ \S+ \((.+)\)$/gm)].map((m) => m[1]);
  assert.ok(kinds.length > 100, 'licence list is filled');
  for (const k of kinds) assert.doesNotMatch(k, /NC|GPL-[23]\.0(?:-only)?$|AGPL|SSPL|BUSL/, `bundled licence ${k}`);
  assert.match(readFileSync(join(app, 'LICENSE.txt'), 'utf8'), /MIT License/);
  assert.doesNotMatch(vendor, /geomeTRIC/i);
});

test('pages link to it, the nav lists it and SEO skips the app', () => {
  assert.match(readFileSync(join(PUB, 'nmr', 'index.html'), 'utf8'), /href="nmrium\/index\.html#sample=aspirin"/);
  assert.match(readFileSync(join(PUB, 'spectra', 'spectra.js'), 'utf8'), /\.\.\/nmr\/nmrium\/index\.html#practice=/);
  assert.match(readFileSync(join(PUB, 'shared-nav.js'), 'utf8'), /'nmr\/nmrium\/index\.html'/);
  const seo = readFileSync(join(ROOT, 'tools', 'build-seo.ts'), 'utf8');
  assert.match(seo, /path !== "nmr\/nmrium\/app"/);
  assert.match(seo, /injectHead\("nmr\/nmrium\/index\.html"/);
  const page = readFileSync(join(DIR, 'index.html'), 'utf8');
  assert.match(page, /data-section="nmr"/);
  assert.match(page, /data-display-frame/);
});

test("NMRium's own reader opens the practice spectra and the samples", async (t) => {
  const W = process.env.NMRIUM_NODE_MODULES;
  if (!W || !existsSync(join(W, 'nmr-load-save'))) { t.skip('set NMRIUM_NODE_MODULES to a built wrapper checkout\'s node_modules'); return; }
  const req = createRequire(join(W, 'x.js'));
  const { read } = req(join(W, 'nmr-load-save', 'nmr-load-save.cjs'));
  const { fileCollectionFromFiles } = req(join(W, 'filelist-utils'));
  const load = async (files) => (await read(await fileCollectionFromFiles(files), { onLoadProcessing: { autoProcessing: true } })).nmriumState.data;
  for (const f of N.practiceFigures(PR.problems)) {
    const out = N.practiceFile(PR.problems.find((x) => x.id === f.problem), f.fig);
    const d = await load([new File([out.text], out.name)]);
    assert.equal(d.spectra.length, 1, out.name);
    assert.equal(d.spectra[0].info.nucleus, out.tab, out.name);
  }
  for (const s of N.SAMPLES) {
    const d = await load(s.files.map((n) => new File([readFileSync(join(DIR, 'samples', n))], n)));
    assert.ok(d.spectra.length >= 1, s.id);
    if (s.id === 'cyclosporin') assert.ok(d.spectra.some((x) => x.info.dimension === 2), 'COSY is 2D');
    if (s.id === 'indometacin') assert.equal(d.molecules.length, 1);
  }
});
