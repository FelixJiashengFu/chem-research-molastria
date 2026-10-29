// Tests for deploy/account-worker.js: a D1 stand-in on SQLite, and fake Stripe, Resend and DeepSeek behind fetch.
//   deno run --allow-read tools/account-test.ts
import worker from "../deploy/account-worker.js";
import { d1 } from "./d1-sqlite.ts";

const { sqlite, DB } = await d1();

// ── fake services ───────────────────────────────────────────────────────
const nowS = () => Math.floor(Date.now() / 1000);
const customers: Record<string, { id: string; email: string }> = {};
const subs: Record<string, any[]> = {};
const sessions: Record<string, any> = {};
const mails: { to: string; subject: string; text: string }[] = [];
let upstreamStatus = 200;
let stripeCalls = 0;
function addCustomer(id: string, email: string, sub?: { quantity?: number; status?: string; interval?: string; cancel?: boolean }) {
  customers[id] = { id, email };
  subs[id] = sub ? [{ status: sub.status ?? "active", cancel_at_period_end: !!sub.cancel, items: { data: [{ quantity: sub.quantity ?? 1, current_period_end: nowS() + 86400 * 300, price: { recurring: { interval: sub.interval ?? "year" } } }] } }] : [];
}
const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const req = new Request(input, init);
  const url = new URL(req.url);
  const ok = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  if (url.hostname === "api.stripe.com") {
    stripeCalls++;
    if (req.headers.get("Authorization") !== "Bearer rk_test_fake") return ok({ error: { message: "bad key" } }, 401);
    const p = url.pathname.replace("/v1/", "");
    if (p === "customers") return ok({ data: Object.values(customers).filter((c) => c.email === url.searchParams.get("email")) });
    if (p === "customers/search") {
      const want = /email:"(.*)"/.exec(url.searchParams.get("query") || "")?.[1]?.toLowerCase();
      return ok({ data: Object.values(customers).filter((c) => c.email.toLowerCase() === want) });
    }
    if (p === "subscriptions") return ok({ data: subs[url.searchParams.get("customer") || ""] || [] });
    if (p.startsWith("checkout/sessions/")) { const s = sessions[p.split("/")[2]]; return s ? ok(s) : ok({ error: { message: "No such session" } }, 404); }
    return ok({ error: { message: "unknown" } }, 404);
  }
  if (url.hostname === "api.resend.com") { const b = await req.json(); mails.push({ to: b.to[0], subject: b.subject, text: b.text }); return ok({ id: "m1" }); }
  if (url.hostname === "api.deepseek.com") {
    const b = await req.json();
    if (upstreamStatus !== 200) return ok({ error: { message: "upstream down" } }, upstreamStatus);
    return ok({ model: b.model, choices: [{ message: { content: "ok" } }], usage: { total_tokens: 5 } });
  }
  return realFetch(input, init);
}) as typeof fetch;

const env: Record<string, unknown> = { DB, STRIPE_KEY: "rk_test_fake", RESEND_API_KEY: "re_fake", DEEPSEEK_API_KEY: "sk-fake", MONTHLY_ASKS: "3", ALLOWED_ORIGINS: "https://molastria.com,http://tauri.localhost" };
async function call(method: string, path: string, body?: unknown, token?: string, origin = "https://molastria.com") {
  const headers: Record<string, string> = { Origin: origin };
  if (body) headers["Content-Type"] = "application/json";
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await worker.fetch(new Request(`https://api.test${path}`, { method, headers, body: body ? JSON.stringify(body) : undefined }), env);
  const text = await res.text();
  let data: any = null;
  try { data = JSON.parse(text); } catch { data = text; }
  return { status: res.status, data, headers: res.headers };
}

// ── tests ───────────────────────────────────────────────────────────────
let failed = 0;
async function test(name: string, fn: () => Promise<void>) {
  try { await fn(); console.log(`ok   ${name}`); } catch (e) { failed++; console.log(`FAIL ${name}\n     ${(e as Error).message}`); }
}
function eq(actual: unknown, expected: unknown, what = "") {
  if (JSON.stringify(actual) !== JSON.stringify(expected)) throw new Error(`${what} expected ${JSON.stringify(expected)}, got ${JSON.stringify(actual)}`);
}
const codeFor = (email: string) => /\b(\d{6})\b/.exec(mails.filter((m) => m.to === email).at(-1)?.text || "")?.[1] || "";

addCustomer("cus_pro", "pro@example.com", { interval: "month" });
addCustomer("cus_team", "PI@Example.com", { quantity: 3 });
addCustomer("cus_none", "lapsed@example.com", { status: "canceled" });
sessions.cs_test_paid = { id: "cs_test_paid", status: "complete", payment_status: "paid", mode: "subscription", created: nowS() - 60, customer: "cus_pro", customer_details: { email: "Pro@Example.com" } };
sessions.cs_test_open = { ...sessions.cs_test_paid, id: "cs_test_open", status: "open", payment_status: "unpaid" };
sessions.cs_test_old = { ...sessions.cs_test_paid, id: "cs_test_old", created: nowS() - 3 * 86400 };
sessions.cs_test_gift = { ...sessions.cs_test_paid, id: "cs_test_gift", mode: "payment", customer: null };

let proToken = "", piToken = "", memberToken = "";

await test("CORS: allowed origins pass, others are refused", async () => {
  eq((await call("OPTIONS", "/me", undefined, undefined, "http://tauri.localhost")).status, 204);
  eq((await call("OPTIONS", "/me", undefined, undefined, "https://evil.example")).status, 403);
  eq((await call("GET", "/me", undefined, undefined, "https://evil.example")).status, 403);
});

await test("checkout: a paid session signs in and shows Pro", async () => {
  const r = await call("POST", "/auth/checkout", { session_id: "cs_test_paid" });
  eq(r.status, 200, "status");
  proToken = r.data.token;
  eq([r.data.account.email, r.data.account.pro, r.data.account.role, r.data.account.cycle], ["pro@example.com", true, "pro", "month"]);
  eq(r.data.account.usage, { month: new Date().toISOString().slice(0, 7), asks: 0, limit: 3 });
});

await test("checkout: unpaid, old, malformed and missing sessions are refused", async () => {
  eq((await call("POST", "/auth/checkout", { session_id: "cs_test_open" })).status, 402);
  eq((await call("POST", "/auth/checkout", { session_id: "cs_test_old" })).status, 410);
  eq((await call("POST", "/auth/checkout", { session_id: "abc'; drop" })).status, 400);
  eq((await call("POST", "/auth/checkout", { session_id: "cs_test_nope" })).status, 404);
});

await test("checkout: a one-off sponsor payment gives no session", async () => {
  const r = await call("POST", "/auth/checkout", { session_id: "cs_test_gift" });
  eq([r.status, r.data.token, r.data.sponsor], [200, null, true]);
});

await test("/me needs a valid token", async () => {
  eq((await call("GET", "/me")).status, 401);
  eq((await call("GET", "/me", undefined, "nonsense")).status, 401);
  eq((await call("GET", "/me", undefined, proToken)).data.plan, "pro");
});

await test("email code: no mail for addresses without a subscription, same answer", async () => {
  const before = mails.length;
  const r = await call("POST", "/auth/start", { email: "stranger@example.com" });
  const r2 = await call("POST", "/auth/start", { email: "lapsed@example.com" });
  eq([r.status, r.data, r2.data, mails.length], [200, { ok: true }, { ok: true }, before]);
});

await test("email code: case-insensitive match finds the team buyer; wrong codes count", async () => {
  const r = await call("POST", "/auth/start", { email: "pi@example.com", lang: "en" });
  eq(r.data, { ok: true });
  const code = codeFor("pi@example.com");
  if (!code) throw new Error("no code mailed");
  if (!mails.at(-1)!.subject.startsWith("Your MolAstria sign-in code")) throw new Error("English subject expected");
  const wrong = code === "000000" ? "111111" : "000000";
  eq((await call("POST", "/auth/verify", { email: "pi@example.com", code: wrong })).status, 400);
  const ok = await call("POST", "/auth/verify", { email: "PI@example.com ", code });
  eq(ok.status, 200);
  piToken = ok.data.token;
  eq([ok.data.account.role, ok.data.account.seats, ok.data.account.members], ["owner", 3, []]);
  eq((await call("POST", "/auth/verify", { email: "pi@example.com", code })).status, 400, "code reuse");
});

await test("email code: five wrong tries lock the code", async () => {
  await call("POST", "/auth/start", { email: "pro@example.com" });
  const code = codeFor("pro@example.com");
  const wrong = code === "000000" ? "111111" : "000000";
  for (let i = 0; i < 5; i++) await call("POST", "/auth/verify", { email: "pro@example.com", code: wrong });
  eq((await call("POST", "/auth/verify", { email: "pro@example.com", code })).status, 429);
});

await test("team: owner adds members up to seats − 1; members get Pro", async () => {
  let r = await call("POST", "/team/members", { email: "a@lab.edu" }, piToken);
  eq([r.status, r.data.members], [200, ["a@lab.edu"]]);
  if (!mails.some((m) => m.to === "a@lab.edu" && m.subject.includes("Team invitation"))) throw new Error("invitation not sent");
  r = await call("POST", "/team/members", { email: "b@lab.edu" }, piToken);
  eq(r.data.members, ["a@lab.edu", "b@lab.edu"]);
  eq((await call("POST", "/team/members", { email: "c@lab.edu" }, piToken)).status, 409, "seat limit");
  eq((await call("POST", "/team/members", { email: "pi@example.com" }, piToken)).status, 400, "self");
  eq((await call("POST", "/team/members", { email: "x@lab.edu" }, proToken)).status, 403, "pro is not an owner");
  await call("POST", "/auth/start", { email: "a@lab.edu" });
  const v = await call("POST", "/auth/verify", { email: "a@lab.edu", code: codeFor("a@lab.edu") });
  memberToken = v.data.token;
  eq([v.data.account.pro, v.data.account.role, v.data.account.owner], [true, "member", "pi@example.com"]);
});

await test("hosted AI: counts asks, keeps short calls apart, stops at the quota", async () => {
  const ask = (token: string, max = 2000) => call("POST", "/ai/chat", { provider: "deepseek", model: "deepseek-flash", messages: [{ role: "user", content: "hi" }], max_tokens: max }, token);
  eq((await ask("")).status, 401);
  let r = await ask(proToken);
  eq([r.status, r.headers.get("X-MolAstria-Usage")], [200, "1/3"]);
  if (!r.headers.get("Access-Control-Expose-Headers")?.includes("X-MolAstria-Usage")) throw new Error("usage header not exposed");
  r = await ask(proToken, 300);
  eq([r.status, r.headers.get("X-MolAstria-Usage")], [200, "1/3"], "short call");
  await ask(proToken); await ask(proToken);
  r = await ask(proToken);
  eq(r.status, 429, "over quota");
  eq((await call("GET", "/me", undefined, proToken)).data.usage.asks, 3, "refused call not counted");
  eq((await call("POST", "/ai/chat", { provider: "deepseek", model: "muse-wonder-1.0", messages: [{ role: "user", content: "x" }] }, memberToken)).status, 400, "model outside HOSTED_MODELS");
});

await test("hosted AI: upstream failures are not counted", async () => {
  upstreamStatus = 503;
  const r = await call("POST", "/ai/chat", { provider: "deepseek", model: "deepseek-flash", messages: [{ role: "user", content: "hi" }] }, memberToken);
  upstreamStatus = 200;
  eq(r.status, 503);
  eq((await call("GET", "/me", undefined, memberToken)).data.usage.asks, 0);
});

await test("team: removing a member ends their access at once", async () => {
  await call("DELETE", "/team/members", { email: "a@lab.edu" }, piToken);
  const me = await call("GET", "/me", undefined, memberToken);
  eq([me.data.pro, me.data.role], [false, "free"]);
  eq((await call("POST", "/ai/chat", { provider: "deepseek", model: "deepseek-flash", messages: [{ role: "user", content: "hi" }] }, memberToken)).status, 403);
});

await test("Stripe is asked again only after the cache goes stale", async () => {
  stripeCalls = 0;
  await call("GET", "/me", undefined, proToken);
  eq(stripeCalls, 0, "cached");
  subs.cus_pro[0].status = "canceled";
  sqlite.prepare("UPDATE accounts SET checked = 0 WHERE email = ?").run("pro@example.com");
  const me = await call("GET", "/me", undefined, proToken);
  eq([me.data.pro, me.data.plan], [false, "free"]);
  if (stripeCalls === 0) throw new Error("Stripe not consulted");
});

await test("sign-out ends the session", async () => {
  eq((await call("POST", "/auth/signout", {}, piToken)).status, 200);
  eq((await call("GET", "/me", undefined, piToken)).status, 401);
});

await test("unknown routes and bad JSON", async () => {
  eq((await call("GET", "/nope")).status, 404);
  const res = await worker.fetch(new Request("https://api.test/auth/start", { method: "POST", headers: { Origin: "https://molastria.com" }, body: "{" }), env);
  eq(res.status, 400);
});

console.log(failed ? `\n${failed} failed` : "\nall passed");
if (failed) Deno.exit(1);
