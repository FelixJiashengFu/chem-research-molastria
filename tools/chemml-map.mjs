// 化学机器学习 · 结构–性质图：把 tools/chemml-map/molecules.json（tools/chemml-map/build.py 算的三维结构和性质）
// 加上指纹和描述符的主成分，写成页面读的 public/chem-ml/cml-map-data.js（生成的文件，不要手改）。
//   node tools/chemml-map.mjs           重新生成
//   node tools/chemml-map.mjs --check   只检查生成的文件是不是最新的（tools/chemml-map-test.mjs 也做这一步）
// 指纹用的是本栏目自己的 cml-models.js（ecfp，半径 2、1024 位），主成分用 cml-map-core.js 的 pca，和页面上是同一份代码。
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const SRC = path.join(ROOT, 'tools/chemml-map/molecules.json');
export const OUT = path.join(ROOT, 'public/chem-ml/cml-map-data.js');
const CORE = path.join(ROOT, 'public/chem-ml/cml-map-core.js'), MODELS = path.join(ROOT, 'public/chem-ml/cml-models.js');
const norm = (f) => fs.readFileSync(f, 'utf8').replace(/\r\n/g, '\n');

export function inputHash() {
  const h = crypto.createHash('sha256');
  for (const f of [SRC, CORE, fileURLToPath(import.meta.url)]) h.update(`${path.basename(f)}\n`).update(norm(f));
  return h.digest('hex').slice(0, 16);
}
export const stamp = () => (fs.existsSync(OUT) ? (norm(OUT).match(/inputs ([0-9a-f]{16})/) || [])[1] : '');

// 在 node 里载入页面用的两个脚本
export function load() {
  const s = { window: {} };
  vm.runInNewContext(`${norm(MODELS)}\n${norm(CORE)}`, s);
  return { M: s.window.MOLASTRIA_CHEMML_MODELS, C: s.window.MOLASTRIA_CHEMML_MAP_CORE };
}

// 方法文献（在 tools/chemml/refs.json 里也有，页面的文献库按 id 链过去）
const REFS = [
  'S. Riniker, G. A. Landrum, J. Chem. Inf. Model. 55, 2562 (2015), doi:10.1021/acs.jcim.5b00654 (ETKDG)',
  'C. Bannwarth, S. Ehlert, S. Grimme, J. Chem. Theory Comput. 15, 1652 (2019), doi:10.1021/acs.jctc.8b01176 (GFN2-xTB)',
  'G. W. Bemis, M. A. Murcko, J. Med. Chem. 39, 2887 (1996), doi:10.1021/jm9602928 (scaffolds)',
  'G. Fraux, R. K. Cersonsky, M. Ceriotti, J. Open Source Softw. 5, 2117 (2020), doi:10.21105/joss.02117 (chemiscope)',
];

export function build() {
  const raw = JSON.parse(fs.readFileSync(SRC, 'utf8'));
  const { M, C } = load();
  const r3 = (v) => Math.round(v * 1000) / 1000;
  const mols = raw.molecules.map((m) => ({
    s: m.smiles, f: m.family, subs: m.subs, scaf: m.murcko,
    el: m.elements.join(' '), xyz: m.xyz.flat().map(r3),
    gap: r3(m.gap), homo: r3(m.homo), lumo: r3(m.lumo), dip: r3(m.dipole),
    mw: m.mw, logp: m.logp, tpsa: m.tpsa, hbd: m.hbd, hba: m.hba, rotb: m.rotb, heavy: m.heavy, fsp3: m.fsp3, rings: m.rings,
    conv: m.opt.converged ? 1 : 0,
  }));
  const fps = C.fingerprints(mols.map((m) => m.s), M, 2, 1024);
  const pe = C.pca(C.bitMatrix(fps, 1024), 2), pd = C.pca(C.descMatrix(mols), 2, { standardize: true });
  const xy = (p) => p.scores.map((r) => r.map(r3));
  const fam = Object.fromEntries(raw.meta.enumeration.scaffolds.map(([k, zh, en]) => [k, [zh, en]]));
  const D = {
    meta: { ...raw.meta, references: REFS, count: mols.length },
    fam, mols,
    pca: {
      ecfp: { xy: xy(pe), ev: pe.explained.map((v) => Math.round(v * 1e4) / 1e4), what: 'ECFP (radius 2, 1024 bits, cml-models.js), centred' },
      desc: { xy: xy(pd), ev: pd.explained.map((v) => Math.round(v * 1e4) / 1e4), keys: C.DESC, what: 'RDKit descriptors, standardised' },
    },
  };
  const head = `// 生成的文件，不要手改：node tools/chemml-map.mjs（inputs ${inputHash()}）\n// 来源：tools/chemml-map/build.py 枚举并计算（RDKit ETKDGv3 + MMFF94 → GFN2-xTB 优化与单点），CC BY 4.0。\n`;
  const body = `window.MOLASTRIA_CHEMML_MAP_DATA = {\n"meta": ${JSON.stringify(D.meta)},\n"fam": ${JSON.stringify(D.fam)},\n"pca": ${JSON.stringify(D.pca)},\n"mols": [\n${D.mols.map((m) => JSON.stringify(m)).join(',\n')}\n]};\n`;
  return head + body;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  if (process.argv.includes('--check')) {
    if (stamp() !== inputHash()) { console.error('public/chem-ml/cml-map-data.js 不是最新的：运行 node tools/chemml-map.mjs'); process.exit(1); }
    console.log('cml-map-data.js 是最新的');
  } else {
    const text = build();
    fs.writeFileSync(OUT, text);
    console.log(`写好 ${path.relative(ROOT, OUT)}（${(text.length / 1024).toFixed(0)} KB）`);
  }
}
