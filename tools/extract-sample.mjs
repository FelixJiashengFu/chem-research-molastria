// Draws the sample figure of the Literature Extractor (public/extract/sample-suzuki.svg): a Suzuki–Miyaura scheme with a
// text-based Ar table, in the style of a journal scheme. The yields are made up for the page and the figure says so.
// Structures are drawn by OpenChemLib (BSD-3, installed by npm ci --prefix tools/e2e).
//   node tools/extract-sample.mjs            (rewrites the SVG)
//   node tools/extract-sample.mjs --check    (fails when the SVG is out of date)
import { readFileSync, writeFileSync, existsSync } from 'node:fs';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('..', import.meta.url));
const OUT = `${ROOT}public/extract/sample-suzuki.svg`;
const require = createRequire(`${ROOT}tools/e2e/package.json`);
const OCL = require('openchemlib');

/** One structure as a nested <svg> placed at (x, y), scaled to height h. A [Xe] atom is drawn as "Ar". */
function structure(id, smiles, x, y, h) {
  const m = OCL.Molecule.fromSmiles(smiles);
  let svg = m.toSVG(320, 220, id, { autoCrop: true, autoCropMargin: 6, suppressChiralText: true, noImplicitAtomLabelColors: true, noStereoProblem: true });
  const vb = /viewBox="([\d.\s-]+)"/.exec(svg)[1].split(/\s+/).map(Number);
  const w = (vb[2] / vb[3]) * h;
  svg = svg.replace(/<svg [^>]*>/, `<svg id="${id}" x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" viewBox="${vb.join(' ')}">`)
    .replace(/>Xe</g, '>Ar<').replace(/\s*<circle [^>]*r="1\.44"[^>]*\/>/g, '').replace(/\s*<circle [^>]*class="event"[^>]*\/>/g, '').replace(/ #\w+ \{ pointer-events:none; \} #\w+ \.event  \{ pointer-events:all; \}/, '').replace(/fill="rgb\(\d+,\d+,\d+\)"/g, 'fill="#111"').replace(/stroke="rgb\(\d+,\d+,\d+\)"/g, 'stroke="#111"')
    .replace(/font-family: sans-serif;/, 'font-family: Arial, Helvetica, sans-serif;');
  return { svg, w };
}
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;');
const text = (x, y, s, { size = 15, anchor = 'start', weight = 400, style = '' } = {}) => `<text x="${x}" y="${y}" font-size="${size}" text-anchor="${anchor}" font-weight="${weight}"${style ? ` font-style="${style}"` : ''}>${s}</text>`;
const sub = (s) => esc(s).replace(/(\d+)/g, (d, _, i, all) => (/[A-Za-z)]$/.test(all.slice(0, i)) ? `<tspan baseline-shift="sub" font-size="75%">${d}</tspan>` : d));

const W = 900, H = 600;
const parts = [];
const r1 = structure('s1', 'Brc1ccc(C(C)=O)cc1', 40, 70, 120);
parts.push(r1.svg, text(40 + r1.w / 2, 210, '1', { weight: 700, anchor: 'middle' }));
parts.push(text(40 + r1.w + 28, 135, '+', { size: 26, anchor: 'middle' }));
const x2 = 40 + r1.w + 60;
parts.push(text(x2, 140, sub('ArB(OH)2'), { size: 20 }), text(x2 + 55, 210, '2', { weight: 700, anchor: 'middle' }));
const ax = x2 + 150, aw = 250;
parts.push(`<line x1="${ax}" y1="130" x2="${ax + aw}" y2="130" stroke="#111" stroke-width="2"/><polygon points="${ax + aw},130 ${ax + aw - 12},124 ${ax + aw - 12},136" fill="#111"/>`);
parts.push(text(ax + aw / 2, 105, sub('Pd(PPh3)4 (5 mol%)'), { anchor: 'middle' }));
parts.push(text(ax + aw / 2, 158, sub('K2CO3 (2.0 equiv)'), { anchor: 'middle' }));
parts.push(text(ax + aw / 2, 180, sub('toluene/H2O (4:1), 80 °C, 12 h'), { anchor: 'middle' }));
const p3 = structure('s3', 'CC(=O)c1ccc([Xe])cc1', ax + aw + 24, 70, 120);
parts.push(p3.svg, text(ax + aw + 24 + p3.w / 2, 210, '3', { weight: 700, anchor: 'middle' }));

// the Ar table
const rows = [['3a', 'Ph', '95'], ['3b', '4-MeOC6H4', '92'], ['3c', '4-FC6H4', '88'], ['3d', '3,5-Me2C6H3', '90'], ['3e', '2-naphthyl', '84'], ['3f', '2-thienyl', '76']];
const tx = 170, ty = 262, cw = [110, 200, 140, 120], rh = 34;
const tw = cw.reduce((a, b) => a + b, 0);
parts.push(`<line x1="${tx}" y1="${ty}" x2="${tx + tw}" y2="${ty}" stroke="#111" stroke-width="1.6"/>`);
const head = ['entry', 'Ar', 'product', 'yield (%)ᵃ'];
let cx = tx;
head.forEach((h, i) => { parts.push(text(cx + cw[i] / 2, ty + 23, esc(h), { anchor: 'middle', weight: 700 })); cx += cw[i]; });
parts.push(`<line x1="${tx}" y1="${ty + rh}" x2="${tx + tw}" y2="${ty + rh}" stroke="#111" stroke-width="1"/>`);
rows.forEach(([lab, ar, y], k) => {
  const yy = ty + rh * (k + 2) - 11;
  const cells = [String(k + 1), sub(ar), `<tspan font-weight="700">${lab}</tspan>`, y];
  let x = tx;
  cells.forEach((c, i) => { parts.push(text(x + cw[i] / 2, yy, c, { anchor: 'middle' })); x += cw[i]; });
});
const tb = ty + rh * (rows.length + 1) + 6;
parts.push(`<line x1="${tx}" y1="${tb}" x2="${tx + tw}" y2="${tb}" stroke="#111" stroke-width="1.6"/>`);
parts.push(text(tx, tb + 26, `ᵃ Isolated yields; 1 (0.5 mmol), 2 (0.75 mmol).`, { size: 13 }));
parts.push(text(W / 2, H - 22, 'Illustrative example drawn for MolAstria — the yields are made up, not data from a published paper.', { size: 13, anchor: 'middle', style: 'italic' }));
parts.push(text(40, 40, 'Scheme 1. Suzuki–Miyaura coupling of 1 with arylboronic acids 2', { size: 16, weight: 700 }));

const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${W}" height="${H}" viewBox="0 0 ${W} ${H}" font-family="Arial, Helvetica, sans-serif" fill="#111">
<!-- Generated by tools/extract-sample.mjs (structures drawn with OpenChemLib). Illustrative data, not from a paper. -->
<rect width="${W}" height="${H}" fill="#fff"/>
${parts.join('\n')}
</svg>
`;
if (process.argv.includes('--check')) {
  if (!existsSync(OUT) || readFileSync(OUT, 'utf8') !== svg) { console.error('sample-suzuki.svg is out of date: run node tools/extract-sample.mjs'); process.exit(1); }
  console.log('sample-suzuki.svg is up to date');
} else { writeFileSync(OUT, svg); console.log(`wrote ${OUT} (${svg.length} bytes)`); }
