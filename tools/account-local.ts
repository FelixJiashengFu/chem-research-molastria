// Run deploy/account-worker.js locally with a fake Stripe, for trying the Pro pages end to end.
//   deno run --allow-net --allow-env --allow-read --allow-write tools/account-local.ts [port] [allowed-origin]
// Fake customers: pro@example.com (Pro, yearly) and pi@example.com (Group edition, 5 seats); fake paid checkout
// sessions cs_test_localpro and cs_test_localteam, and cs_test_localv1 (vault@example.com buys the locked section, one-off); admin@example.com and owner@example.com are site admins (permanent Pro, issue VIP cards).
// Sign-in codes are returned to the page instead of mailed.
// Hosted AI calls go to the real DeepSeek with DEEPSEEK_API_KEY from this process's environment,
// or get a fixed answer when FAKE_AI is set (tools/e2e/run.mjs).
// The discussion rooms (/chat/ws, /chat/summary) run in this process too: tools/chat-local.ts stands in for the Durable Object,
// with the real room logic of deploy/chat.js; messages are gone when the server stops.
// Point the site at it by setting accountApi in public/pay/config.js to http://127.0.0.1:<port> (do not commit that).
import worker from "../deploy/account-worker.js";
import { d1 } from "./d1-sqlite.ts";
import { chatLocal } from "./chat-local.ts";

const port = Number(Deno.args[0] ?? 8832);
const { DB } = await d1();
// owner@example.com and chat-owner@example.com are more admins, so a check can sign one in without using up admin@example.com's five codes an hour
for (const email of ["admin@example.com", "owner@example.com", "chat-owner@example.com"]) {
  await DB.prepare("INSERT INTO grants (email, source, expires, created) VALUES (?1, 'admin', NULL, ?2)").bind(email, Math.floor(Date.now() / 1000)).run();
}
const now = () => Math.floor(Date.now() / 1000);
const sub = (quantity: number, interval: string) => ({ status: "active", cancel_at_period_end: false, items: { data: [{ quantity, current_period_end: now() + 300 * 86400, price: { recurring: { interval } } }] } });
const customers = [{ id: "cus_local_pro", email: "pro@example.com" }, { id: "cus_local_team", email: "pi@example.com" }];
const subs: Record<string, unknown[]> = { cus_local_pro: [sub(1, "year")], cus_local_team: [sub(5, "year")] };
const session = (id: string, customer: string, email: string) => ({ id, status: "complete", payment_status: "paid", mode: "subscription", created: now(), customer, customer_details: { email } });
const sessions: Record<string, unknown> = {
  cs_test_localpro: session("cs_test_localpro", "cus_local_pro", "pro@example.com"),
  cs_test_localteam: session("cs_test_localteam", "cus_local_team", "pi@example.com"),
  // a one-off ¥199 payment: buys the locked section (/vault/). The stand-in text is tools/premium-fixture.json.
  cs_test_localv1: { id: "cs_test_localv1", status: "complete", payment_status: "paid", mode: "payment", created: now(), customer: null, amount_total: 19900, currency: "cny", payment_link: "plink_local_v1", customer_details: { email: "vault@example.com" } },
};
{
  const fx = JSON.parse(await Deno.readTextFile(new URL("./premium-fixture.json", import.meta.url)));
  for (const [part, langs] of Object.entries(fx.parts as Record<string, Record<string, unknown>>)) for (const [lang, body] of Object.entries(langs)) await DB.prepare("INSERT INTO premium (product, part, lang, body, updated) VALUES (?1, ?2, ?3, ?4, ?5)").bind(fx.product, part, lang, JSON.stringify(body), now()).run();
}

const realFetch = globalThis.fetch;
let umaLast: any = {}; // the last job sent to the pretend owner computer
let umaPolls = 0;

/** Protein MD as tools/uma-server/openmm_backend.py returns it: Trp-cage's sequence on a made-up Cα helix, 25 frames. */
function fakeProtein(p: any) {
  const three = ["ASN", "LEU", "TYR", "ILE", "GLN", "TRP", "LEU", "LYS", "ASP", "GLY", "GLY", "PRO", "SER", "SER", "GLY", "ARG", "PRO", "PRO", "PRO", "SER"];
  const ps = p.ps ?? 20, T = p.temperature ?? 300, n = three.length;
  const ca = (k: number) => three.map((_, i) => [2.3 * Math.cos(i * 1.75) + 0.2 * Math.sin(k + i), 2.3 * Math.sin(i * 1.75), 1.5 * i + 0.1 * Math.cos(k * i)]);
  const line = (i: number, x: number[], ch = "A") => `ATOM  ${String(i + 1).padStart(5)}  CA  ${three[i]} ${ch}${String(i + 1).padStart(4)}    ${x.map((v) => v.toFixed(3).padStart(8)).join("")}  1.00  0.00           C\n`;
  const frames = Array.from({ length: 25 }, (_, k) => ca(k + 1));
  const series = frames.map((_, k) => ({ t_ps: +(((k + 1) * ps) / 25).toFixed(3), epot_kj: -5300 + 900 * (1 - Math.exp(-k / 4)) + 30 * Math.sin(k), temperature_k: T * (1 - 0.3 * Math.exp(-k / 3)), rmsd_a: +(0.4 + 1.1 * (1 - Math.exp(-k / 6))).toFixed(3), rg_a: +(7.1 + 0.15 * Math.sin(k)).toFixed(3) }));
  return {
    pdb_id: String(p.pdb_id || "1L2Y").toUpperCase(), chains: p.chains || "A", residues: n, atoms: 304, sequence: "NLYIQWLKDGGPSSGRPPPS",
    fixes: { built_residues: 0, built_atoms: 0, replaced: [], removed_heterogens: 0 }, force_field: "Amber ff14SB + GBSA-OBC2 (implicit water)",
    platform: "OpenCL", openmm_version: "8.3.1", ps, temperature_k: T, timestep_fs: 2, energy_start_kj: -3120.4, energy_minimised_kj: -5301.2, ns_per_day: 812.5,
    series, mean_temperature_k: T - 1.4, final_rmsd_a: series.at(-1)!.rmsd_a,
    rmsf: three.map((r, i) => ({ res: `${r}${i + 1}`, chain: "A", a: +(0.4 + 1.6 * Math.exp(-i / 2) + 1.4 * Math.exp((i - n + 1) / 2)).toFixed(3) })),
    trajectory_pdb: frames.map((f, k) => `MODEL     ${String(k + 1).padStart(4)}\nREMARK   t = ${series[k].t_ps.toFixed(1)} ps\n${f.map((x, i) => line(i, x)).join("")}ENDMDL\n`).join("") + "END\n",
    final_pdb: frames.at(-1)!.map((x, i) => line(i, x)).join("") + "END\n", seconds_total: 4.2,
  };
}

/** A result with the fields of API v3 for each job; the numbers are made up (fake: true). */
function fakeResult(b: any) {
  const p = b.params || {}, job = b.job || "ipea", model = b.model || "uma-s-1p2p1";
  const xyz = "3\nfake\nO 0.000 0.000 0.000\nH 0.000 0.000 0.960\nH 0.930 0.000 -0.240\n";
  const E = -2079.62, T = p.temperature ?? 298.15, kcal = 23.0605;
  if (job === "pmd") return { model, job, smiles: null, charge: 0, spin: null, params: p, seconds: 4.2, fake: true, ...fakeProtein(p) };
  const base: any = { model, job, smiles: b.smiles ?? null, charge: b.charge ?? 0, spin: b.spin ?? 1, params: p, seconds: 1, fake: true, xyz };
  if (/direct/.test(model)) base.direct_forces = true;
  // server.py adds what the xtb run prints to xTB single points and optimisations
  if (/xtb/.test(model) && (job === "sp" || job === "opt")) base.xtb = { gap_ev: 14.693, homo_ev: -12.177, lumo_ev: 2.516, dipole_debye: 2.27, charges: [-0.564, 0.282, 0.282], xtb_version: "6.8.0" };
  const thermo = { temperature_k: T, h_corr_ev: 0.664, s_ev_k: 0.00195, g_corr_ev: 0.083, h_ev: E + 0.664, g_ev: E + 0.083 };
  switch (job) {
    case "sp": return { ...base, energy_ev: E, forces_ev_a: [[0, 0, 0.012], [0, 0, -0.006], [0.004, 0, -0.006]], fmax_ev_a: 0.012 };
    case "opt": return { ...base, energy_ev: E, steps: 22, converged: true, fmax_ev_a: 0.018 };
    case "freq": return { ...base, energy_ev: E, steps: 12, frequencies_cm1: [-112.4, 1595.2, 3657.1, 3756.0], n_imag: 1, zpe_ev: 0.561, linear: false, thermo };
    case "conf": return { ...base, conformers: [[0, 0.712], [0.62, 0.249], [1.85, 0.039]].map(([rel, w], i) => ({ rank: i + 1, energy_ev: E + rel / kcal, rel_kcal: rel, weight: w, xyz })), n_generated: p.n ?? 10, n_unique: 3, temperature_k: T };
    case "scan": {
      const a = p.start ?? -180, z = p.end ?? 180, n = p.points ?? 13;
      const points = Array.from({ length: n }, (_, i) => { const d = a + (i * (z - a)) / (n - 1), rel = 1.4 * (1 + Math.cos((3 * d * Math.PI) / 180)); return { angle_deg: d, energy_ev: E + rel / kcal, rel_kcal: rel, converged: true }; });
      const m = Math.min(...points.map((x) => x.rel_kcal));
      return { ...base, atoms: p.atoms, points: points.map((x) => ({ ...x, rel_kcal: x.rel_kcal - m })), xyz: xyz + xyz };
    }
    case "md": {
      const steps = p.steps ?? 1000, dt = p.timestep_fs ?? 0.5;
      const series = Array.from({ length: 11 }, (_, i) => ({ t_fs: (i * steps * dt) / 10, epot_ev: E + 0.02 * Math.sin(i), ekin_ev: 0.116 + 0.01 * Math.cos(i), temperature_k: (p.temperature ?? 300) + 12 * Math.sin(i * 1.3) }));
      return { ...base, series, mean_temperature_k: 301.2, xyz: xyz + xyz };
    }
    case "rxn": {
      const [l, r] = String(p.reaction || "C=C.[H][H]>>CC").split(">>");
      const species = [...l.split(".").map((s) => [s, "reactant"]), ...r.split(".").map((s) => [s, "product"])].map(([s, side], i) => ({ smiles: s, side, count: 1, charge: 0, spin: 1, energy_ev: -1000 - 100 * i, ...(p.thermo ? { g_ev: -1000 - 100 * i + 0.5 } : {}) }));
      return { ...base, smiles: null, reaction: p.reaction, species, delta_e_ev: -1.37, delta_e_kcal: -31.6, ...(p.thermo ? { delta_g_ev: -1.05, delta_g_kcal: -24.2, temperature_k: T } : {}) };
    }
    case "ipea": {
      const mode = p.mode ?? "adiabatic", adia = mode !== "vertical", vert = mode !== "adiabatic";
      return { ...base, energy_ev: E, mode, ...(adia ? { ip_ev: 10.9, ea_ev: -0.4 } : {}), ...(vert ? { ip_vertical_ev: 11.32, ea_vertical_ev: -0.95 } : {}), ...(model === "uma-s-1p2p1" && adia ? { ip_uma_s: 10.9, ea_uma_s: -0.4 } : {}) };
    }
    case "spin": return { ...base, states: (p.spins || [1, 3]).map((s: number, i: number) => ({ spin: s, energy_ev: E + i * 1.02, xyz })), gap_ev: 1.02, gap_kcal: 23.52, vertical_gap_ev: 1.31 };
    case "bde": return { ...base, bond: p.bond, parent_energy_ev: E, fragments: [{ smiles: "[CH3]", spin: 2, energy_ev: -1080.1 }, { smiles: "[CH2]O", spin: 2, energy_ev: -995.67 }], bde_ev: 3.85, bde_kcal: 88.8, ...(p.thermo ? { bdh298_kcal: 86.1 } : {}) };
    case "pa": return { ...base, site: p.site, mode: p.mode, energies: { base_ev: E, acid_ev: E - 9.4 }, value_ev: 9.4, value_kcal: 216.8, ...(p.thermo ? { enthalpy_kcal: 218.3 } : {}) };
    case "polar": {
      const one = { dipole_debye: 4.81, dipole_vector: [-4.24, 2.02, -1.06], polarizability_a3: 6.78, polarizability_tensor_a3: [[8.34, -0.41, -0.26], [-0.41, 6.46, 0.15], [-0.26, 0.15, 5.53]] };
      return { ...base, geometry_model: "mace-off23-medium", energy_ev: E, steps: 22, ...one, ...(p.average ? { conformers: 2, weights: [0.8, 0.2] } : {}) }; // as server.py: how many conformers, and their weights
    }
    case "ir": return { ...base, geometry_model: "mace-off23-medium", frequencies_cm1: [1595.2, 3657.1, 3756.0], ir_intensity_km_mol: [68.2, 4.1, 45.7], raman_activity_a4_amu: [3.2, 98.4, 41.0], n_imag: 0 };
  }
  return base;
}
globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  const fake = Deno.env.get("FAKE_AI");
  const reply = (data: unknown) => new Response(JSON.stringify(data), { headers: { "Content-Type": "application/json" } });
  if (fake && url.hostname === "api.crossref.org") return reply({ message: { items: [1, 2, 3].map((n) => ({ DOI: `10.1/test.${n}`, title: [`测试论文 ${n} about electrolytes`], abstract: "Abstract", created: { "date-time": "2026-10-30T00:00:00Z" } })) } });
  if (fake && url.hostname === "api.datacite.org") return reply({ data: [] });
  if (fake && url.hostname === "api.search.brave.com") { // e2e: Pro web search without a key
    const q = url.searchParams.get("q") || "";
    return reply({ web: { results: [{ title: `${q} — a web page about ${q}`, url: `https://example.org/${encodeURIComponent(q)}`, description: `Everything about <strong>${q}</strong>.`, profile: { name: "example.org" } }] } });
  }
  if (url.hostname === "uma.test") { // e2e: a pretend owner computer speaking API v3 (tools/uma-server --fake behaves the same)
    const geom = ["sp", "opt", "freq", "conf", "scan", "md", "rxn"], charged = [...geom, "ipea", "spin", "bde", "pa"], xtb = charged.filter((j) => j !== "ipea");
    const ids = { charged: ["uma-s-1p2p1", "uma-s-1p2", "uma-s-1p2p1-ft-d4rev", "allscaip-md-conserving-all-omol", "allscaip-md-direct-all-omol"], neutral: ["uma-s-1p1", "esen-sm-conserving-all-omol", "esen-sm-direct-all-omol", "esen-md-direct-all-omol", "mace-omol-0", "mace-off23-small", "mace-off23-medium", "mace-off23-large", "ani-2x", "gfn-ff"] };
    const jobs: Record<string, string[]> = { ...Object.fromEntries(ids.charged.map((m) => [m, charged])), ...Object.fromEntries(ids.neutral.map((m) => [m, geom])), "mace-mdp": ["polar", "ir"], "gfn2-xtb": xtb, "gfn2-xtb-alpb-water": xtb, "gfn1-xtb": xtb, "openmm-amber14": ["pmd"] };
    if (url.pathname === "/health") return reply({ ok: true, ready: true, api: 3, model: "uma-s-1p2p1", gpu: "Test GPU", queue: 0, running: false, done: 0, cached: 0, models: Object.fromEntries(Object.entries(jobs).map(([id, j]) => [id, { ready: true, jobs: j, queue: 0, running: false }])) });
    if (url.pathname === "/jobs") {
      umaLast = JSON.parse(String(init?.body ?? (input instanceof Request ? await input.clone().text() : "{}")));
      umaPolls = 0;
      return new Response(JSON.stringify({ id: "00000000000000e2", status: "queued", position: 1 }), { status: 202, headers: { "Content-Type": "application/json" } });
    }
    if (url.pathname === "/jobs/00000000000000e2") { // one poll reports progress, the next one the result
      if (umaPolls++ === 0) return reply({ id: "00000000000000e2", status: "running", progress: { done: 1, total: 3, note: "test step" } });
      return reply({ id: "00000000000000e2", status: "done", result: fakeResult(umaLast) });
    }
  }
  if (fake && url.hostname === "api.deepseek.com" && JSON.parse(String(init?.body ?? "{}")).response_format && !JSON.parse(String(init?.body ?? "{}")).stream) {
    return reply({ choices: [{ message: { content: JSON.stringify({ overview_zh: "本周概览", overview_en: "This week", picks: [0, 1, 2].map((i) => ({ i, why_zh: `解读 ${i}`, why_en: `Why ${i}` })) }) } }] });
  }
  if (url.hostname === "api.deepseek.com" && fake) { // tools/e2e: no key, no cost, a fixed streamed answer
    const events = [{ choices: [{ delta: { content: "测试回答。" } }] }, { choices: [], usage: { prompt_tokens: 1, completion_tokens: 1 } }];
    const body = events.map((e) => `data: ${JSON.stringify(e)}\n\n`).join("") + "data: [DONE]\n\n";
    return new Response(body, { headers: { "Content-Type": "text/event-stream" } });
  }
  if (url.hostname !== "api.stripe.com") return realFetch(input, init);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const p = url.pathname.replace("/v1/", "");
  if (p === "customers" || p === "customers/search") {
    const want = (url.searchParams.get("email") || /email:"(.*)"/.exec(url.searchParams.get("query") || "")?.[1] || "").toLowerCase();
    return json({ data: customers.filter((c) => c.email === want) });
  }
  if (p === "subscriptions") return json({ data: subs[url.searchParams.get("customer") || ""] || [] });
  if (p === "checkout/sessions") { const want = (url.searchParams.get("customer_details[email]") || "").toLowerCase(); return json({ data: Object.values(sessions).filter((x: any) => x.customer_details?.email === want) }); }
  if (p.startsWith("checkout/sessions/")) return sessions[p.split("/")[2]] ? json(sessions[p.split("/")[2]]) : json({ error: { message: "No such session" } }, 404);
  return json({ error: { message: "not faked" } }, 404);
}) as typeof fetch;

const env = {
  DB, STRIPE_KEY: "rk_test_local", DEV_SHOW_CODE: "1",
  DEEPSEEK_API_KEY: Deno.env.get("FAKE_AI") ? "fake" : Deno.env.get("DEEPSEEK_API_KEY") ?? "",
  ALLOWED_ORIGINS: Deno.args[1] ?? "http://localhost:8830,http://127.0.0.1:8830",
  MONTHLY_ASKS: "300", V1_AMOUNT: "19900", V1_CURRENCY: "cny",
  BRAVE_SEARCH_KEY: Deno.env.get("FAKE_AI") ? "fake" : Deno.env.get("BRAVE_SEARCH_KEY") ?? "",
  // UMA on the owner computer: UMA_ORIGIN / UMA_SERVER_SECRET from this process (e.g. tools/uma-server --fake), else the e2e stand-in.
  UMA_ORIGIN: Deno.env.get("UMA_ORIGIN") ?? (Deno.env.get("FAKE_AI") ? "https://uma.test" : ""),
  UMA_SERVER_SECRET: Deno.env.get("UMA_SERVER_SECRET") ?? (Deno.env.get("FAKE_AI") ? "e2e-secret-0123456789abcdef0123456789" : ""),
  // e2e runs every job many times from one address; the daily limits themselves are tested in tools/account-test.ts.
  ...(Deno.env.get("FAKE_AI") ? { UMA_DAILY: "100000", UMA_DAILY_ACCOUNT: "100000", UMA_DAILY_PRO: "100000", ASL_DAILY: "100000" } : {}),
};
// What Cloudflare's quarter-hourly cron does: one probe of the (pretend) owner computer, so /v1/status has a sample.
if (env.UMA_ORIGIN) await worker.scheduled({ cron: "*/15 * * * *" }, env);
// The binding wrangler.toml calls CHAT. Added after the cron above, which would otherwise ask the rooms for open reports.
const chat = chatLocal(env);
Object.assign(env, { CHAT: chat.CHAT });
Deno.serve({ port, hostname: "127.0.0.1" }, (req) => chat.serve(req, (r) => worker.fetch(r, env)));
