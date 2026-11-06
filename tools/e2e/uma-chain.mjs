// Joins the whole online-model chain without a browser: deploy/account-worker.js (tools/account-local.ts) in front of
// the real tools/uma-server/server.py --fake, and checks that every field public/models/models.js reads is in the
// server's output with the shape it expects. --fake runs the real algorithms on a toy calculator: no model weights.
//   E2E_UMA_PYTHON=<python with numpy, ase, rdkit> node tools/e2e/uma-chain.mjs [results.json]
// A one-time key goes to both sides through MOLASTRIA_UMA_SECRET / UMA_SERVER_SECRET; secret.local is never read.
import { spawn } from 'node:child_process';
import { randomBytes } from 'node:crypto';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = fileURLToPath(new URL('../../', import.meta.url));
const PY = process.env.E2E_UMA_PYTHON;
if (!PY) { console.error('set E2E_UMA_PYTHON to a Python that has the uma-server dependencies'); process.exit(2); }
const UMA_PORT = 8874, API_PORT = 8872, API = `http://127.0.0.1:${API_PORT}`, ORIGIN = 'http://localhost:8830';
const key = randomBytes(24).toString('hex'), tmp = mkdtempSync(join(tmpdir(), 'molastria-chain-'));
const servers = [
  spawn(PY, ['-X', 'utf8', 'tools/uma-server/server.py', '--fake', '--port', String(UMA_PORT), '--cache', join(tmp, 'cache.json')], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, MOLASTRIA_UMA_SECRET: key, PYTHONUTF8: '1' } }),
  spawn('deno', ['run', '--allow-net', '--allow-env', '--allow-read', '--allow-write', 'tools/account-local.ts', String(API_PORT), ORIGIN], { cwd: ROOT, stdio: 'ignore', env: { ...process.env, FAKE_AI: '1', UMA_ORIGIN: `http://127.0.0.1:${UMA_PORT}`, UMA_SERVER_SECRET: key } }),
];
process.on('exit', () => { servers.forEach((s) => s.kill()); rmSync(tmp, { recursive: true, force: true }); });

const call = async (path, body, token, base = API, headers = {}) => {
  const res = await fetch(base + path, { method: body ? 'POST' : 'GET', headers: { Origin: ORIGIN, 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}), ...headers }, body: body ? JSON.stringify(body) : undefined });
  return { status: res.status, data: await res.json().catch(() => ({})) };
};
for (let i = 0; i < 120; i++) {
  try { if ((await call('/uma/health')).data.online) break; } catch { /* not up yet */ }
  await new Promise((r) => setTimeout(r, 500));
}
const health = (await call('/uma/health')).data;
if (!health.online) { console.error('the chain did not come up', health); process.exit(1); }

// ANI-2x is for Pro: sign in as the local admin (permanent Pro); the local worker hands the code back.
const start = await call('/auth/start', { email: 'admin@example.com', lang: 'zh' });
const token = (await call('/auth/verify', { email: 'admin@example.com', code: start.data.devCode })).data.token;

// What public/models/models.js reads from each result (view() and summary()); '?' marks a field that is optional.
const num = 'number', str = 'string', bool = 'boolean', arr = 'array', obj = 'object';
const SHAPE = {
  common: { model: str, job: str, seconds: num, xyz: str },
  sp: { energy_ev: num, forces_ev_a: [[num]], fmax_ev_a: num },
  opt: { energy_ev: num, steps: num, converged: bool, fmax_ev_a: num },
  freq: { energy_ev: num, steps: num, frequencies_cm1: [num], n_imag: num, zpe_ev: num, linear: bool, thermo: { temperature_k: num, h_corr_ev: num, s_ev_k: num, g_corr_ev: num, h_ev: num, g_ev: num } },
  conf: { conformers: [{ rank: num, energy_ev: num, rel_kcal: num, weight: num, xyz: str }], n_generated: num, n_unique: num, temperature_k: num },
  scan: { atoms: [num], points: [{ angle_deg: num, energy_ev: num, rel_kcal: num, converged: bool }] },
  md: { series: [{ t_fs: num, epot_ev: num, ekin_ev: num, temperature_k: num }], mean_temperature_k: num },
  rxn: { reaction: str, species: [{ smiles: str, side: str, count: num, charge: num, spin: num, energy_ev: num, 'g_ev?': num }], delta_e_ev: num, delta_e_kcal: num, 'delta_g_ev?': num, 'delta_g_kcal?': num, 'temperature_k?': num },
  ipea: { energy_ev: num, mode: str, 'ip_ev?': num, 'ea_ev?': num, 'ip_vertical_ev?': num, 'ea_vertical_ev?': num, 'ip_uma_s?': num, 'ea_uma_s?': num },
  spin: { states: [{ spin: num, energy_ev: num, xyz: str }], gap_ev: num, gap_kcal: num, vertical_gap_ev: num },
  bde: { bond: [num], parent_energy_ev: num, fragments: [{ smiles: str, spin: num, energy_ev: num }], bde_ev: num, bde_kcal: num, 'bdh298_kcal?': num },
  pa: { site: num, mode: str, energies: { base_ev: num, acid_ev: num }, value_ev: num, value_kcal: num, 'enthalpy_kcal?': num },
  polar: { geometry_model: str, dipole_debye: num, dipole_vector: [num], polarizability_a3: num, polarizability_tensor_a3: [[num]], 'conformers?': num, 'weights?': [num] },
  ir: { geometry_model: str, frequencies_cm1: [num], ir_intensity_km_mol: [num], raman_activity_a4_amu: [num], n_imag: num },
};
const kind = (v) => (Array.isArray(v) ? arr : v === null ? 'null' : typeof v);
function shape(v, spec, path, out) {
  if (Array.isArray(spec)) {
    if (!Array.isArray(v)) return out.push(`${path}: ${kind(v)}, expected array`);
    if (!v.length) return out.push(`${path}: empty array`);
    v.forEach((x, i) => shape(x, spec[0], `${path}[${i}]`, out));
  } else if (spec && typeof spec === 'object') {
    if (kind(v) !== obj) return out.push(`${path}: ${kind(v)}, expected object`);
    for (const [k0, s] of Object.entries(spec)) {
      const k = k0.replace(/\?$/, '');
      if (!(k in v)) { if (!k0.endsWith('?')) out.push(`${path}.${k}: missing`); continue; }
      shape(v[k], s, `${path}.${k}`, out);
    }
  } else if (kind(v) !== spec && !(spec === arr && Array.isArray(v))) out.push(`${path}: ${kind(v)}, expected ${spec}`);
  return out;
}

const A = ['uma-s-1p2p1', 'uma-s-1p2', 'uma-s-1p2p1-ft-d4rev', 'allscaip-md-conserving-all-omol', 'allscaip-md-direct-all-omol'];
const B = ['uma-s-1p1', 'esen-sm-conserving-all-omol', 'esen-sm-direct-all-omol', 'esen-md-direct-all-omol', 'mace-omol-0'];
const C = ['mace-off23-small', 'mace-off23-medium', 'mace-off23-large', 'ani-2x'];
const WATER = '3\nwater\nO 0.000 0.000 0.000\nH 0.000 0.000 0.960\nH 0.930 0.000 -0.240\n';
// The same requests the page builds (body() in models.js): SMILES in SMILES order, params as the form sends them.
const GEOM = [
  ['sp', { smiles: 'CCCO' }], ['sp', { xyz: WATER }], ['opt', { smiles: 'CCCO', params: { fmax: 0.02 } }],
  ['freq', { smiles: 'CCO', params: { temperature: 298.15, symmetry: 1 } }],
  ['conf', { smiles: 'CCCO', params: { n: 6, temperature: 298.15, window_kcal: 10 } }],
  ['scan', { smiles: 'CCCO', params: { atoms: [0, 1, 2, 3], start: -180, end: 180, points: 5 } }],
  ['md', { smiles: 'CCO', params: { temperature: 300, timestep_fs: 0.5, steps: 100, friction: 0.01 } }],
  ['rxn', { params: { reaction: 'C=C.[H][H]>>CC', thermo: false, temperature: 298.15 } }],
  ['rxn', { params: { reaction: 'C=C.[H][H]>>CC', thermo: true, temperature: 298.15 } }],
];
const CHARGED = [
  ['ipea', { smiles: 'CCO', params: { mode: 'both' } }], ['ipea', { smiles: 'CCO', params: { mode: 'adiabatic' } }],
  ['spin', { smiles: 'CCO', params: { spins: [1, 3] } }],
  ['bde', { smiles: 'CCCO', params: { bond: [0, 1], thermo: false, temperature: 298.15 } }],
  ['bde', { smiles: 'CCCO', params: { bond: [3, 11], thermo: true, temperature: 298.15 } }],
  ['pa', { smiles: 'CCCO', params: { site: 3, mode: 'protonate', thermo: false, temperature: 298.15 } }],
  ['pa', { smiles: 'CCCO', params: { site: 3, mode: 'deprotonate', thermo: true, temperature: 298.15 } }],
];
const cases = [];
const add = (model, list, extra = {}) => list.forEach(([job, b]) => cases.push({ model, job, ...b, ...extra }));
add(A[0], GEOM, { charge: 0, spin: 1 }); add(A[0], CHARGED, { charge: 0, spin: 1 });
add(A[4], GEOM, { charge: 0, spin: 1 }); add(A[4], CHARGED, { charge: 0, spin: 1 }); // a direct-force model
for (const m of A.slice(1, 4)) add(m, [GEOM[0], CHARGED[0]], { charge: 0, spin: 1 });
add(A[0], [['sp', { smiles: '[NH4+]' }]], { charge: 1, spin: 1 }); add(A[0], [['sp', { xyz: WATER }]], { charge: 1, spin: 2 });
add(B[0], GEOM); add(B[2], [GEOM[0], GEOM[3]]); for (const m of [B[1], B[3]]) add(m, [GEOM[0]]);
add(B[4], [GEOM[0], GEOM[7]], { academic: true }); // MACE-OMOL-0 is under the ASL
add(C[1], GEOM, { academic: true }); for (const m of [C[0], C[2]]) add(m, [GEOM[0]], { academic: true }); add(C[3], GEOM);
// Edges the worker lets through, which the computer must take too.
add(A[0], [['rxn', { params: { reaction: 'C.C.C>>C.C.C' } }], ['spin', { smiles: 'CCO' }], ['pa', { smiles: 'CCCO', params: { site: 3 } }],
  ['scan', { smiles: 'CCCO', params: { atoms: [3, 2, 1, 0], start: -360, end: 360, points: 3 } }], ['conf', { smiles: 'CCCO', params: { n: 2, window_kcal: 1 } }],
  ['md', { smiles: 'O', params: { steps: 100, timestep_fs: 2, temperature: 1500, friction: 0.1 } }], ['freq', { smiles: 'O', params: { temperature: 2000, symmetry: 24 } }],
  ['opt', { smiles: 'O', params: { fmax: 0.001 } }], ['bde', { smiles: 'CCCO', params: { bond: [2, 3], temperature: 10, thermo: true } }]]);
add('mace-mdp', [['polar', { smiles: 'CCCO', params: { average: false, n: 8 } }], ['polar', { smiles: 'CCCO', params: { average: true, n: 4 } }], ['polar', { xyz: WATER }], ['ir', { smiles: 'CCO' }], ['ir', { xyz: WATER }]], { academic: true });

let failed = 0;
const results = [];
for (const c of cases) {
  const t0 = Date.now();
  const sent = await call('/uma/jobs', c, c.model === 'ani-2x' ? token : undefined);
  let r = sent.data, note = '';
  if (sent.status >= 400) note = `refused ${sent.status}: ${r.error?.message || JSON.stringify(r)}`;
  else {
    while (r.status !== 'done' && r.status !== 'error') { await new Promise((ok) => setTimeout(ok, 300)); r = (await call(`/uma/jobs/${r.id}`)).data; }
    if (r.status === 'error') note = `error: ${r.error}`;
  }
  const problems = note ? [note] : shape(r.result, { ...SHAPE.common, ...SHAPE[c.job] }, c.job, []);
  if (!note && (r.result.job !== c.job || r.result.model !== c.model)) problems.push(`echo: ${r.result.model}/${r.result.job}`);
  if (problems.length) failed++;
  const label = `${c.model} ${c.job}${c.xyz ? ' xyz' : ''}${c.params?.thermo ? ' thermo' : ''}${c.params?.mode ? ` ${c.params.mode}` : ''}${c.params?.average ? ' average' : ''}`;
  console.log(`${problems.length ? 'FAIL' : 'ok  '} ${label} (${((Date.now() - t0) / 1000).toFixed(1)} s)${problems.length ? `\n     ${problems.slice(0, 8).join('\n     ')}` : ''}`);
  results.push({ case: c, result: r.result ?? null, problems });
}

// Spot checks straight at the server: requests the worker refuses must be refused there too.
const direct = (b) => call('/jobs', { ...b, who: '00000000000000aa' }, undefined, `http://127.0.0.1:${UMA_PORT}`, { 'X-MolAstria-Key': key });
const refusals = [
  [{ smiles: 'CCO', job: 'md', model: 'mace-mdp' }, 'MACE-MDP has no MD'], [{ smiles: 'CCO', job: 'ipea', model: 'uma-s-1p1' }, 'no IP / EA in class B'],
  [{ smiles: 'CCO', job: 'opt', model: 'esen-md-direct-all-omol', charge: 1, spin: 2 }, 'class B refuses a cation'],
  [{ xyz: WATER, job: 'conf', model: 'uma-s-1p2p1' }, 'conf needs SMILES'], [{ xyz: WATER, job: 'polar', model: 'mace-mdp', params: { average: true } }, 'polar average needs SMILES'],
  [{ smiles: 'O', xyz: WATER, job: 'sp', model: 'uma-s-1p2p1' }, 'both SMILES and XYZ'], [{ smiles: 'CCO', job: 'opt', model: 'uma-s-1p2p1', params: { fmax: 0.5 } }, 'fmax too large'],
  [{ smiles: 'CCCO', job: 'scan', model: 'uma-s-1p2p1', params: { atoms: [0, 1, 1, 2] } }, 'repeated scan atoms'], [{ smiles: 'CCCO', job: 'scan', model: 'uma-s-1p2p1', params: { atoms: [0, 1, 2, 3], start: 90, end: 90 } }, 'end <= start'],
  [{ job: 'rxn', model: 'uma-s-1p2p1', params: { reaction: 'C.C.C.C>>C.C.C.C' } }, 'eight species in all'], [{ smiles: 'O=O', job: 'spin', model: 'uma-s-1p2p1', params: { spins: [3, 3] } }, 'same spins'],
  [{ smiles: 'CCO', job: 'pa', model: 'uma-s-1p2p1', params: { site: 2, mode: 'oxidise' } }, 'bad pa mode'], [{ smiles: 'CCO', job: 'md', model: 'uma-s-1p2p1', params: { steps: 5000 } }, 'too many steps'],
  [{ xyz: `121\nbig\n${'H 0 0 0\n'.repeat(121)}`, job: 'sp', model: 'uma-s-1p2p1' }, '121 atoms'],
];
for (const [b, why] of refusals) {
  const viaWorker = await call('/uma/jobs', { ...b, academic: true });
  const s = await direct(b);
  // "计算服务：" is the worker passing on the computer's refusal; anything else the worker refused by itself.
  const own = viaWorker.status === 400 && !String(viaWorker.data.error?.message || '').startsWith('计算服务');
  const ok = own && s.status === 400;
  if (!ok) failed++;
  console.log(`${ok ? 'ok  ' : 'FAIL'} refused on both sides: ${why} (worker ${viaWorker.status}${own ? '' : ' not by itself'}, server ${s.status}${s.status !== 400 ? ` ${JSON.stringify(s.data).slice(0, 200)}` : ''})`);
}
if (process.argv[2]) writeFileSync(process.argv[2], JSON.stringify({ health, results }, null, 1));
console.log(failed ? `\n${failed} failed` : `\nall passed (${cases.length} jobs, ${refusals.length} refusals)`);
process.exit(failed ? 1 : 0);
