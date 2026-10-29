// Run deploy/account-worker.js locally with a fake Stripe, for trying the Pro pages end to end.
//   deno run --allow-net --allow-env --allow-read --allow-write tools/account-local.ts [port] [allowed-origin]
// Fake customers: pro@example.com (Pro, yearly) and pi@example.com (Group edition, 5 seats); fake paid checkout
// sessions cs_test_localpro and cs_test_localteam; admin@example.com is the site admin (permanent Pro, issues VIP cards).
// Sign-in codes are returned to the page instead of mailed.
// Hosted AI calls go to the real DeepSeek with DEEPSEEK_API_KEY from this process's environment.
// Point the site at it by setting accountApi in public/pay/config.js to http://127.0.0.1:<port> (do not commit that).
import worker from "../deploy/account-worker.js";
import { d1 } from "./d1-sqlite.ts";

const port = Number(Deno.args[0] ?? 8832);
const { DB } = await d1();
await DB.prepare("INSERT INTO grants (email, source, expires, created) VALUES (?1, 'admin', NULL, ?2)").bind("admin@example.com", Math.floor(Date.now() / 1000)).run();
const now = () => Math.floor(Date.now() / 1000);
const sub = (quantity: number, interval: string) => ({ status: "active", cancel_at_period_end: false, items: { data: [{ quantity, current_period_end: now() + 300 * 86400, price: { recurring: { interval } } }] } });
const customers = [{ id: "cus_local_pro", email: "pro@example.com" }, { id: "cus_local_team", email: "pi@example.com" }];
const subs: Record<string, unknown[]> = { cus_local_pro: [sub(1, "year")], cus_local_team: [sub(5, "year")] };
const session = (id: string, customer: string, email: string) => ({ id, status: "complete", payment_status: "paid", mode: "subscription", created: now(), customer, customer_details: { email } });
const sessions: Record<string, unknown> = {
  cs_test_localpro: session("cs_test_localpro", "cus_local_pro", "pro@example.com"),
  cs_test_localteam: session("cs_test_localteam", "cus_local_team", "pi@example.com"),
};

const realFetch = globalThis.fetch;
globalThis.fetch = (async (input: Request | URL | string, init?: RequestInit) => {
  const url = new URL(input instanceof Request ? input.url : String(input));
  if (url.hostname !== "api.stripe.com") return realFetch(input, init);
  const json = (data: unknown, status = 200) => new Response(JSON.stringify(data), { status, headers: { "Content-Type": "application/json" } });
  const p = url.pathname.replace("/v1/", "");
  if (p === "customers" || p === "customers/search") {
    const want = (url.searchParams.get("email") || /email:"(.*)"/.exec(url.searchParams.get("query") || "")?.[1] || "").toLowerCase();
    return json({ data: customers.filter((c) => c.email === want) });
  }
  if (p === "subscriptions") return json({ data: subs[url.searchParams.get("customer") || ""] || [] });
  if (p.startsWith("checkout/sessions/")) return sessions[p.split("/")[2]] ? json(sessions[p.split("/")[2]]) : json({ error: { message: "No such session" } }, 404);
  return json({ error: { message: "not faked" } }, 404);
}) as typeof fetch;

const env = {
  DB, STRIPE_KEY: "rk_test_local", DEV_SHOW_CODE: "1",
  DEEPSEEK_API_KEY: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
  ALLOWED_ORIGINS: Deno.args[1] ?? "http://localhost:8830,http://127.0.0.1:8830",
  MONTHLY_ASKS: "300",
};
Deno.serve({ port, hostname: "127.0.0.1" }, (req) => worker.fetch(req, env));
