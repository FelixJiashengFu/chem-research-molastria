// Local static preview of public/: deno run --allow-net --allow-read tools/serve.ts [port]
import { serveDir } from "jsr:@std/http@1.0.9/file-server";
import { fileURLToPath } from "node:url";

const port = Number(Deno.args[0] ?? 8830);
// fileURLToPath, not .pathname: the checkout path may contain non-ASCII characters, which .pathname leaves percent-encoded.
const root = fileURLToPath(new URL("../public", import.meta.url));

Deno.serve({ port, hostname: "127.0.0.1" }, async (req) => {
  const res = await serveDir(req, { fsRoot: root, quiet: true });
  if (res.status !== 404) return res;
  // Mirror GitHub Pages: unknown paths get the site's 404 page.
  try {
    const body = await Deno.readFile(`${root}/404.html`);
    return new Response(body, { status: 404, headers: { "content-type": "text/html; charset=utf-8" } });
  } catch {
    return res;
  }
});
