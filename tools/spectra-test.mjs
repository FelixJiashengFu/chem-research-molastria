// 谱图馆：模型对照已知数值，内容完整（中英两版、来源标注、文献和锚点都对得上），每一张图都能画出来。
//   node --test tools/spectra-test.mjs
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, readdirSync } from 'node:fs';
import vm from 'node:vm';

const dir = new URL('../public/spectra/', import.meta.url);
function load(lang) {
  const win = { console };
  win.window = win; win.globalThis = win;
  win.document = { documentElement: { lang }, addEventListener() {} };
  win.addEventListener = () => {};
  const ctx = vm.createContext(win);
  const files = ['sp-tables.js', 'sp-models.js', 'sp-macro.js', 'sp-computed.js', 'sp-data.js', ...readdirSync(dir).filter((f) => /^sp-m-.*\.js$/.test(f)).sort(), 'sp-atlas.js', 'sp-refs.js', 'sp-measured.js', 'sp-plot.js', 'sp-figs.js', 'sp-gens.js', 'sp-gens2.js', 'sp-gens3.js'];
  for (const f of files) vm.runInContext(readFileSync(new URL(f, dir), 'utf8'), ctx, { filename: f });
  return win;
}
const W = load('zh-CN'), E = load('en');
const X = W.MOLASTRIA_SPECTRA_MACRO, D = W.MOLASTRIA_SPECTRA, METHODS = W.MOLASTRIA_SPECTRA_METHODS, M = W.MOLASTRIA_SPECTRA_MODELS, ATLAS = W.MOLASTRIA_SPECTRA_ATLAS, REFS = W.MOLASTRIA_SPECTRA_REFS, MEAS = W.MOLASTRIA_SPECTRA_MEASURED, COMP = W.MOLASTRIA_SPECTRA_COMPUTED;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} expected ${b} ± ${tol}, got ${a}`);
const isT = (t) => t && typeof t === 'object' && typeof t.zh === 'string' && typeof t.en === 'string' && t.zh.trim() && t.en.trim();
const han = /[㐀-鿿]/;

test('models: masses, isotope patterns and adducts', () => {
  near(M.monoMass('C8H10N4O2'), 194.0804, 2e-4, 'caffeine');
  near(M.monoMass('C8H10N4O2', 1), 194.0804 - 0.000549, 2e-4, 'caffeine cation');
  near(M.ADDUCTS['[M+H]+'](194.08038), 195.0877, 2e-4);
  near(M.avgMass('H2O'), 18.015, 2e-3);
  const cl = M.isotopePattern('CH3Cl', { resolution: 0.2 }), m0 = cl.find((p) => Math.round(p.mz) === 50), m2 = cl.find((p) => Math.round(p.mz) === 52);
  near(m2.rel / m0.rel, 0.32, 0.01, 'one chlorine');
  const br = M.isotopePattern('CH2Br2', { resolution: 0.2 }).filter((p) => p.rel > 5).map((p) => Math.round(p.rel));
  assert.deepEqual(br.length, 3); near(br[0], 51, 2); near(br[2], 49, 2);
  near(M.resolvingPower(M.monoMass('CO', 1), M.monoMass('N2', 1)), 2490, 30);
  const d = M.deconvolute(M.chargeState(16951.5, 18), M.chargeState(16951.5, 17));
  assert.equal(d.z, 17); near(d.M, 16951.5, 0.5);
  near(M.peptide('LVNELTEFAK').mh2, 582.319, 2e-3);
});

test('models: optical spectroscopy', () => {
  near(M.hydrogenLine(2, 3).air, 656.28, 0.02, 'H-alpha');
  near(M.hydrogenLine(1, 2).vac, 121.57, 0.01, 'Lyman-alpha');
  near(M.bandOrigin(M.DIATOMICS.H35Cl), 2885.98, 0.5);
  near(M.bondLength(M.DIATOMICS.H35Cl), 1.2746, 2e-3);
  near(M.bandOrigin(M.DIATOMICS['12C16O']), 2143.3, 0.5);
  near(M.beer(1, 2, 1, 0.001).A, 1.96, 0.005, 'stray light at A = 2');
  near(M.conv.evToNm(3.3), 375.7, 0.2);
  assert.ok(M.antiStokesRatio(1000, 532, 298) < 0.02);
});

test('models: diffraction, X-rays and nuclear', () => {
  const na = M.powderPattern(M.CRYSTALS.NaCl, { lambda: 1.540593, tmin: 8, tmax: 100 }), hk = (p) => p.hkl.join('');
  const p200 = na.find((p) => hk(p) === '200'), p111 = na.find((p) => hk(p) === '111');
  near(p200.tt, 31.70, 0.03); assert.equal(Math.round(p200.I), 100); assert.ok(p111.I > 4 && p111.I < 14, `NaCl (111) ${p111.I}`);
  const k111 = M.powderPattern(M.CRYSTALS.KCl, { lambda: 1.540593, tmin: 8, tmax: 100 }).find((p) => hk(p) === '111');
  assert.ok(!k111 || k111.I < 1, 'KCl (111) nearly vanishes');
  assert.ok(!M.powderPattern(M.CRYSTALS.Si, {}).some((p) => hk(p) === '200'), 'Si (200) is forbidden');
  near(M.bragg.d(M.bragg.twoTheta(2.82)), 2.82, 1e-9);
  near(M.scherrerWidth(50, 30, 1.5406), 0.164, 0.004);
  near(M.compton(661.66).edge, 477.3, 0.2); near(M.compton(661.66).backscatter, 184.3, 0.2);
  near(M.moseleyKa(29), 8.0, 0.01);
  near(M.dipolarMHz(3.5), 52.04 / 3.5 ** 3, 0.01);
  near(M.eprField(2.0023, 9.5), 338.97, 0.1);
  assert.equal(M.mossbauerSextet(33, 0, 0).length, 6);
  near(M.radiocarbonAge(0.5), 5568, 2, 'Libby half-life');
});

test('models: separations, thermal analysis and electrochemistry', () => {
  near(M.purnell(10000, 1.1, 3), 1.70, 0.01);
  near(M.resolution(8, 9.2, 8000), 3.12, 0.01);
  near(M.vanDeemterOpt(0, 1.43, 0.00846).u, 13.0, 0.05);
  near(M.kovats(5, [{ n: 6, t: 4 }, { n: 7, t: 6 }], true), 650, 1e-9);
  near(M.ee(95, 5), 90, 1e-9);
  const sz = M.schulzZimm(50000, 2); near(sz.Mw, 100000, 1e-6);
  const st = M.tgaSteps(['CaC2O4H2O', 'CaC2O4', 'CaCO3', 'CaO']); near(st[1], 87.67, 0.02); near(st[2], 68.50, 0.02); near(st[3], 38.38, 0.02);
  const cv = M.cyclicVoltammogram({ pts: 400 }); near(Math.max(...cv.psi), 0.4463, 0.004, 'reversible peak');
  near(M.randlesSevcik(1, 0.071, 1e-5, 1e-6, 0.1) * 1e6, 19.07, 0.05);
  near(M.titrationPH(0), 2.88, 0.01); near(M.titrationPH(12.5), 4.756, 0.01); near(M.titrationPH(25), 8.73, 0.01);
  const z = M.randlesImpedance(1e6, { Rs: 10, Rct: 100, Cdl: 2e-5 }); near(z.re, 10, 0.01);
  near(M.randlesImpedance(1e-4, { Rs: 10, Rct: 100, Cdl: 2e-5 }).re, 110, 0.01);
  near(M.sphereForm(4.4934 / 5, 5), 0, 1e-6, 'first minimum of the sphere form factor');
  near(M.dls(50).D * 1e12, 4.91, 0.02);
});

test('models: macromolecules and polymers', () => {
  // Electron wavelengths: 1.9687 pm at 300 kV, 2.5079 pm at 200 kV, 3.7014 pm at 100 kV (relativistic).
  near(X.electronWavelength(300), 1.96875, 2e-4); near(X.electronWavelength(200), 2.50793, 2e-4); near(X.electronWavelength(100), 3.70144, 2e-4);
  near(X.electronWavelength(300, false), 2.23919, 2e-4);
  // CTF: without spherical aberration and amplitude contrast the first zero is at k = 1/√(λΔf).
  const z = X.ctfZeros({ kV: 300, df: 1.5, cs: 0, ac: 0 }, 1)[0];
  near(z, 1 / Math.sqrt(0.0196875 * 15000), 2e-4);
  // EDS: 129 eV at Mn Kα by construction, √E growth beyond the noise floor.
  near(X.edsFwhm(5.895), 129, 0.01); assert.ok(X.edsFwhm(8.048) > 140 && X.edsFwhm(0.525) < 70);
  // Karplus 1959: maximum 9.22 Hz at 180°, 8.22 at 0°, −0.28 at 90°.
  near(X.karplus(180), 9.22, 1e-9); near(X.karplus(0), 8.22, 1e-9); near(X.karplus(90), -0.28, 1e-9); near(X.karplus(-60), X.karplus(60), 1e-12);
  // Bernoulli statistics: triads and pentads sum to one, 4·mm·rr = mr².
  for (const pm of [0, 0.22, 0.5, 0.9]) { const t = X.triads(pm), p = X.pentads(pm); near(t.mm + t.mr + t.rr, 1, 1e-12); near(Object.values(p).reduce((a, b) => a + b, 0), 1, 1e-12); near(4 * t.mm * t.rr, t.mr * t.mr, 1e-12); }
  // Bessel functions: J0 zero at 2.404826, J1(1) = 0.4400506, J5(5) = 0.2611405.
  near(X.besselJ(0, 2.404825558), 0, 1e-8); near(X.besselJ(1, 1), 0.44005059, 1e-7); near(X.besselJ(5, 5), 0.26114055, 1e-7);
  // Two strands offset by 3/8 of the pitch: the fourth layer line vanishes, the others do not; half a pitch removes odd layers.
  near(X.helixIntensity(4, 0.08), 0, 1e-20); assert.ok(X.helixIntensity(3, 0.08) > 0.01 || X.helixIntensity(3, 0.06) > 0.01);
  for (const R of [0.03, 0.07, 0.12]) near(X.helixIntensity(3, R, { offset: 0.5 }), 0, 1e-20);
  near(X.helixIntensity(10, 0), 4 * Math.cos(Math.PI * 10 * 0.375) ** 2, 1e-9, 'meridional reflection at 1/h');
  // Zimm plot: exact data are fitted back exactly.
  const o = { Mw: 3.5e5, Rg: 31, A2: 2.5e-4 }, pts = [];
  for (const c of [5e-4, 1e-3, 2e-3]) for (const th of [35, 60, 90, 120, 145]) pts.push({ c, theta: th, y: X.zimmY(c, th, o) });
  const f = X.zimmFit(pts); near(f.Mw / o.Mw, 1, 1e-9); near(f.Rg, o.Rg, 1e-6); near(f.A2 / o.A2, 1, 1e-9);
  // Svedberg: BSA (4.3 S, 5.9e-7 cm²/s, v̄ 0.734) is about 66 kg/mol.
  near(X.svedberg(4.3, 5.9e-7, 0.734, 0.9982, 293.15), 66.5, 0.3);
  // Sedimentation velocity: the boundary sits at the midpoint of the plateau; plateau falls by radial dilution.
  const t = 3600, rb = X.svBoundary(t), plateau = X.svProfile(7.15, t);
  near(X.svProfile(rb, t) / plateau, 0.5, 0.02); near(plateau, Math.exp(-2 * Math.log(rb / 6)), 0.01);
  // Two-state unfolding: f_u = ½ at Tm; a ligand of K_d 1 μM at 10 μM raises Tm by about RTm² ln 11 / ΔH ≈ 5 K.
  near(X.fracUnfolded(328.15, {}), 0.5, 1e-9); near(X.apparentTm({}), 328.15, 1e-6);
  const dT = X.apparentTm({ L: 10e-6, Kd: 1e-6 }) - 328.15; assert.ok(dT > 4 && dT < 6.5, `ΔTm ${dT}`);
  // HDX: uptake saturates at dfrac·(1−back)·n; the deuterium-count distribution is normalised with the right mean.
  near(X.hdxUptake(1e9, [1, 10, 100]), 0.9 * 0.75 * 3, 1e-9);
  const dd = X.deuteriumDist([0.2, 0.5, 0.9]); near(dd.reduce((a, b) => a + b, 0), 1, 1e-12); near(dd.reduce((a, b, k) => a + k * b, 0), 1.6, 1e-12);
  assert.equal(X.peptideFormula('GAST'), 'C12H22N4O7'); assert.equal(X.peptideFormula('M'), 'C5H11NO2S'); assert.equal(X.exchangeableAmides('GASPTL'), 3);
  near(M.monoMass(X.peptideFormula('VLSEGEWQLV')), M.peptide('VLSEGEWQLV').M, 1e-4, 'formula and residue masses agree');
  // Random-coil strips: the walk links each residue to the previous one; prolines have no strip.
  const st = X.strips('GASPT'); assert.equal(st.map((r) => r.res).join(''), 'AST'); assert.equal(JSON.stringify(st[0].prev), '[45.1,null]'); assert.equal(JSON.stringify(st[2].prev), JSON.stringify(X.RANDOM_COIL.P));
  // Gel calibration recovers an exact semi-log ladder.
  const lad = [200, 100, 50, 25, 10].map((m) => ({ m, rf: (2.5 - Math.log10(m)) / 1.6 })), cal = X.gelCalibration(lad); near(cal.mass(cal.rf(42)), 42, 1e-9); near(cal.b, -1.6, 1e-12);
  // Viscometry: Huggins and Kraemer intercepts meet at [η].
  const cs = [1e-3, 2e-3, 3e-3, 4e-3], hy = X.linfit(cs, cs.map((c) => (X.viscRel(c, 150, 0.35) - 1) / c)), kr = X.linfit(cs, cs.map((c) => Math.log(X.viscRel(c, 150, 0.35)) / c));
  near(hy.a, 150, 1e-9); near(kr.a, 150, 3); near(X.markHouwinkM(0.011 * 1e5 ** 0.725, 0.011, 0.725), 1e5, 1e-6);
});

test('content: 91 methods in eleven families, bilingual and complete', () => {
  assert.equal(METHODS.length, 91);
  assert.equal(new Set(METHODS.map((m) => m.id)).size, 91);
  assert.equal(D.families.length, 11);
  assert.equal(METHODS.filter((m) => m.core).length, 33);
  const fams = new Set(D.families.map((f) => f.id));
  for (const m of METHODS) {
    assert.ok(fams.has(m.fam), `${m.id}: family`);
    for (const k of ['name', 'one', 'axes', 'sample']) assert.ok(isT(m[k]), `${m.id}.${k}`);
    for (const k of ['how', 'tells', 'read', 'traps']) { assert.ok(m[k].length >= 1, `${m.id}.${k}`); for (const t of m[k]) assert.ok(isT(t), `${m.id}.${k}`); }
    assert.ok(m.nums.length >= 2, `${m.id}.nums`);
    for (const [a, b] of m.nums) assert.ok(isT(a) && isT(b), `${m.id}.nums`);
    assert.ok(m.figs.length >= 1, `${m.id} has a figure`);
    for (const f of m.figs) assert.ok(isT(f.cap), `${m.id}: figure caption`);
    assert.ok(m.refs.length >= 1, `${m.id} cites something`);
    for (const t of [m.name, m.one, m.axes, m.sample, ...m.how, ...m.tells, ...m.read, ...m.traps]) assert.ok(!han.test(t.en), `${m.id}: Chinese left in English text: ${t.en.slice(0, 60)}`);
  }
  for (const k of ['question', 'lead', 'honesty']) assert.ok(isT(D.hero[k]));
  assert.equal(D.questions.length, 20); assert.equal(D.cases.length, 4); assert.equal(D.labs.length, 9); assert.equal(ATLAS.TABLES.length, 16);
});

test('content: every link, reference and anchor resolves', () => {
  const ids = new Set(METHODS.map((m) => m.id)), refs = new Set(REFS.refs.map((r) => r.id)), tables = new Set(ATLAS.TABLES.map((t) => t.id)), labs = new Set(D.labs.map((l) => l.id)), cases = new Set(D.cases.map((c) => c.id));
  assert.equal(refs.size, REFS.refs.length, 'reference ids are unique');
  const used = new Set();
  for (const m of METHODS) {
    for (const r of m.refs) { assert.ok(refs.has(r), `${m.id}: reference ${r}`); used.add(r); }
    if (m.table) assert.ok(tables.has(m.table), `${m.id}: table ${m.table}`);
    for (const [h, t] of m.see || []) {
      assert.ok(isT(t));
      if (h.startsWith('#m-')) assert.ok(ids.has(h.slice(3)), `${m.id}: ${h}`);
      else if (h.startsWith('#lab-')) assert.ok(labs.has(h.slice(5)), `${m.id}: ${h}`);
      else if (h.startsWith('#t-')) assert.ok(tables.has(h.slice(3)), `${m.id}: ${h}`);
      else if (h.startsWith('#case-')) assert.ok(cases.has(h.slice(6)), `${m.id}: ${h}`);
      else assert.ok(/^[a-z-]+\//.test(h), `${m.id}: site link ${h}`);
    }
  }
  for (const r of REFS.refs) { assert.ok(r.authors && r.title && r.journal && r.year > 1800 && r.year < 2027, `ref ${r.id}`); assert.match(r.doi, /^10\.\d{4,9}\//, `ref ${r.id} doi`); assert.ok(used.has(r.id) || r.area === 'calc', `ref ${r.id} is cited somewhere`); }
  for (const q of D.questions) for (const id of q.methods) assert.ok(ids.has(id), `question → ${id}`);
  for (const row of D.ladder.rows) for (const id of row.methods) assert.ok(ids.has(id), `ladder → ${id}`);
  for (const c of D.cases) for (const s of c.steps) assert.ok(ids.has(s.method), `case ${c.id} → ${s.method}`);
  for (const t of ATLAS.TABLES) { assert.ok(isT(t.title) && isT(t.note) && D.families.some((f) => f.id === t.fam), `table ${t.id}`); if (!t.compute) for (const r of t.rows) assert.equal(r.length, t.cols.length, `table ${t.id}: row width`); }
});

test('measured data: open licences only, every record traceable', () => {
  const recs = Object.entries(MEAS.ms);
  assert.equal(recs.length, 52);
  for (const [id, r] of recs) {
    assert.match(r.lic, /^(CC BY|CC0)/, `${id}: licence ${r.lic}`);
    assert.ok(!/NC|ND/.test(r.lic), `${id}: no non-commercial or no-derivatives licences`);
    assert.ok(r.acc && r.authors && r.formula && r.peaks.length, `${id}: accession, authors, formula, peaks`);
    assert.ok(r.peaks.every((p) => p[0] > 0 && p[1] > 0 && p[1] <= 999), `${id}: peaks`);
  }
  for (const [id, r] of Object.entries(MEAS.xy)) { assert.match(r.lic, /^(CC BY|CC0|Public domain)/, id); assert.equal(r.x.length, r.y.length); }
  const tol = MEAS.ms['ei-toluene'], base = tol.peaks.reduce((a, b) => (b[1] > a[1] ? b : a));
  near(base[0], 91.05, 0.02, 'toluene base peak');
  assert.match(MEAS.sources.massbank.commit, /^[0-9a-f]{40}$/);
});

test('computed spectra: units, sanity against experiment, selection rules', () => {
  const v = COMP.vib;
  assert.ok(Object.keys(v).length >= 26, 'vibrational set');
  near(v.co.modes[0][1], 80, 25, 'CO infrared intensity (km/mol)');
  near(v.co.modes[0][0], 2170, 60, 'CO harmonic frequency');
  assert.ok(v.n2.modes[0][1] < 0.01 && v.n2.modes[0][2] > 5, 'N2: infrared-inactive, Raman-active');
  assert.equal(v.water.modes.length, 3); assert.equal(v.co2.modes.length, 4); assert.equal(v.methane.modes.length, 9);
  const sym = v.co2.modes.find((m) => m[0] > 1200 && m[0] < 1500);
  assert.ok(sym[1] < 0.01 && sym[2] > 5, 'CO2 symmetric stretch: Raman only (mutual exclusion)');
  for (const [id, c] of Object.entries(v)) { assert.ok(D.molecules[id], `${id} has a name`); assert.equal(c.modes.length + (c.imag?.length || 0), c.atoms === 2 ? 1 : 3 * c.atoms - (['co2', 'acetylene'].includes(id) ? 5 : 6), `${id}: mode count`); assert.ok(c.modes.every((m) => m[0] > 0 && m[1] >= 0)); }
  for (const [id, c] of Object.entries(COMP.uv)) { assert.ok(D.molecules[id], `${id} has a name`); for (const list of Object.values(c.states)) assert.ok(list.length >= 5 && list.every((s) => s[0] > 1 && s[0] < 12 && s[1] >= 0), `${id}: states`); }
});

test('figures: provenance on every one, and every one draws in both languages', () => {
  const kinds = new Set(Object.keys(D.kinds)), genKind = {};
  for (const [k, list] of Object.entries(D.genKinds)) { assert.ok(kinds.has(k)); for (const g of list) genKind[g] = k; }
  for (const [name, win] of [['zh', W], ['en', E]]) {
    const K = win.MOLASTRIA_SPECTRA_KIT, G = win.MOLASTRIA_SPECTRA_GENS, V = win.MOLASTRIA_SPECTRA_VIEWS, DD = win.MOLASTRIA_SPECTRA;
    const figs = [];
    for (const m of win.MOLASTRIA_SPECTRA_METHODS) for (const f of m.figs) figs.push([m.id, f]);
    for (const l of DD.labs) figs.push([`lab:${l.id}`, l.fig]);
    const CMP = W.MOLASTRIA_SPECTRA_COMPUTED;   // the page leaves out a case step whose computed data is missing
    for (const c of DD.cases) for (const s of c.steps) if (s.fig && !(s.fig.vib && !CMP.vib[s.fig.vib]) && !(s.fig.uv && !CMP.uv[s.fig.uv])) figs.push([`case:${c.id}`, s.fig]);
    assert.ok(figs.length >= 125);
    let gens = 0;
    for (const [who, f] of figs) {
      const key = f.gen ? 'gen' : Object.keys(DD.figKinds).find((k) => f[k] != null);
      assert.ok(key, `${who}: unknown figure type`);
      const kind = f.kind || (f.gen ? genKind[f.gen] : DD.figKinds[key]);
      assert.ok(kinds.has(kind), `${who} ${f.gen || key}: provenance`);
      if (f.gen) { assert.ok(G[f.gen], `${who}: generator ${f.gen}`); gens++; }
      const view = f.gen ? G[f.gen](f.args || {}) : V[key](f), s = {};
      for (const c of view.ctl || []) s[c.k] = c.log ? 10 ** c.v : c.v;
      const r = view.draw(s, { set() {} });
      assert.ok((r.plots || []).length, `${who} ${f.gen || key}: draws something`);
      for (const p of r.plots) { const html = p.html ?? K.plot(p).svg; assert.ok(!/NaN|undefined|Infinity/.test(html), `${name} ${who} ${f.gen || key}: clean output`); if (name === 'en') assert.ok(!han.test(html.replace(/<title>.*?<\/title>/g, '')), `${who} ${f.gen || key}: Chinese left in the English figure`); }
      const out = JSON.stringify((r.out || []).map(([k, v]) => [K.tx(k), v && v.html ? '' : K.tx(v)]));
      assert.ok(!/NaN|undefined|Infinity|\[object/.test(out), `${name} ${who} ${f.gen || key}: clean read-out ${out.slice(0, 200)}`);
      if (name === 'en') assert.ok(!han.test(out), `${who} ${f.gen || key}: Chinese left in the English read-out ${out.slice(0, 200)}`);
    }
    assert.ok(gens >= 60);
    assert.equal(new Set(figs.filter(([, f]) => f.gen).map(([, f]) => f.gen)).size, Object.keys(G).length, 'no unused generators');
  }
});
