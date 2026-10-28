// Smoke test for public/ai/ai.js outside the browser: loads it with a minimal DOM stub and calls a live API.
//   DEEPSEEK_API_KEY=... deno run --allow-read --allow-net --allow-env tools/ai-smoke.ts [deepseek|muse]
// Uses Deno's sessionStorage, so no key is written to disk.
const provider = Deno.args[0] ?? "deepseek";
const key = Deno.env.get(provider === "muse" ? "MUSE_API_KEY" : "DEEPSEEK_API_KEY");
if (!key) { console.error(`missing ${provider === "muse" ? "MUSE_API_KEY" : "DEEPSEEK_API_KEY"}`); Deno.exit(2); }

const g = globalThis as any;
g.window = g;
const noop = () => {};
g.document = {
  currentScript: { src: new URL("../public/ai/ai.js", import.meta.url).href },
  head: { append: noop }, body: { append: noop },
  createElement: () => ({ setAttribute: noop, addEventListener: noop, querySelector: () => null, querySelectorAll: () => [], dataset: {} }),
  getElementById: () => null, addEventListener: noop, dispatchEvent: noop, querySelector: () => null, activeElement: null,
};
g.Event = class { constructor(public type: string) {} };
g.CustomEvent = g.Event;
g.requestAnimationFrame = (f: () => void) => setTimeout(f, 0);
const read = (p: string) => Deno.readTextFileSync(new URL(p, import.meta.url));
new Function(read("../public/merged-data.js"))();
new Function(read("../public/ai/ai.js"))();
const ai = g.ChemAI;

localStorage.removeItem("chemhub-ai");
localStorage.setItem("chemhub-ai", JSON.stringify({ provider, remember: false }));
sessionStorage.setItem(`chemhub-ai-key:${provider}`, key);

let ok = 0, fail = 0;
const check = (name: string, cond: unknown, detail = "") => { cond ? ok++ : fail++; console.log(`${cond ? "PASS" : "FAIL"} ${name}${detail ? " — " + detail : ""}`); };

check("isReady with session key", ai.isReady());
const refs = await ai.retrieve("分析分子静电势用什么软件", 8);
check("retrieve finds Multiwfn-related items", refs.some((r: any) => /静电势|Multiwfn/i.test(r.title + r.excerpt)), refs.slice(0, 3).map((r: any) => r.title).join(" | "));

let deltas = 0, thoughts = 0;
const r = await ai.chat({ messages: [{ role: "user", content: "Give the SMILES of ethylene carbonate only." }], maxTokens: 600, onDelta: () => deltas++, onReasoning: () => thoughts++ });
check("streamed text", deltas > 0 && /C1COC\(=O\)O1|O=C1OCCO1|C1OC\(=O\)OC1/.test(r.text.replace(/\s/g, "")), r.text.trim().slice(0, 80));
check("usage reported", r.usage?.completion_tokens > 0, JSON.stringify(r.usage));
console.log(`  reasoning chunks: ${thoughts}, ${r.ms} ms, model ${r.model}`);

const j = await ai.chat({ json: true, effort: "off", maxTokens: 300, messages: [
  { role: "system", content: 'Return only JSON: {"candidates":[{"smiles":string,"rationale":string}]}' },
  { role: "user", content: "Propose 2 fluorinated carbonate solvents." },
] });
let parsed: any = null;
try { parsed = ai.parseJSON(j.text); } catch (e) { console.log(e); }
check("JSON mode parses", Array.isArray(parsed?.candidates) && parsed.candidates.length >= 1, j.text.slice(0, 120));

try {
  sessionStorage.setItem(`chemhub-ai-key:${provider}`, "sk-invalid-for-test");
  await ai.chat({ messages: [{ role: "user", content: "hi" }], maxTokens: 10 });
  check("bad key rejected", false);
} catch (e) {
  check("bad key gives friendly error", /401|无效|403/.test((e as Error).message), (e as Error).message.slice(0, 60));
}
console.log(`${ok} passed, ${fail} failed`);
Deno.exit(fail ? 1 : 0);
