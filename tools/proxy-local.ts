// Run deploy/ai-proxy-worker.js locally for testing (keys come from this process's environment).
//   deno run --allow-net --allow-env --allow-read tools/proxy-local.ts [port] [allowed-origin]
import worker from "../deploy/ai-proxy-worker.js";

const port = Number(Deno.args[0] ?? 8831);
const env = {
  DEEPSEEK_API_KEY: Deno.env.get("DEEPSEEK_API_KEY") ?? "",
  MUSE_API_KEY: Deno.env.get("MUSE_API_KEY") ?? "",
  ALLOWED_ORIGINS: Deno.args[1] ?? "http://localhost:8830",
  MAX_TOKENS: "12000",
};
Deno.serve({ port, hostname: "127.0.0.1" }, (req) => worker.fetch(req, env));
