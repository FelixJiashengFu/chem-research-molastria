// The discussion rooms for the local account server (tools/account-local.ts, and through it tools/e2e): what the Durable
// Object ChatHub is on Cloudflare, here in Deno. It is the same Hub class (deploy/chat.js) with an in-memory SQLite database
// and Deno's own WebSockets, so the pages talk to the real room logic; only the thin platform adapter is different.
//   const chat = chatLocal(env); env.CHAT = chat.CHAT;
//   Deno.serve((req) => chat.serve(req, (r) => worker.fetch(r, env)));
// Why serve() wraps the handler: the Worker hands the room a NEW Request (https://chat/ws, with X-Chat-Who added), but Deno
// can only upgrade the request that came in from the browser. serve() remembers that one under its Sec-WebSocket-Key, which
// the Worker copies along with the other headers, until the Worker has answered.
// Nothing is kept between runs. The real adapter under workerd is tested by tools/chat-workerd-test.mjs.
import { DatabaseSync } from "node:sqlite";
import { Hub } from "../deploy/chat.js";

const PROTO = "molastria-chat";

/** A Deno WebSocket with what Hub asks of a Cloudflare one: attachments, and send() / close() that work before it is open. */
class Sock {
  #ws: WebSocket;
  #queue: string[] = [];
  #bye: [number, string] | null = null;
  #att: unknown = null;
  constructor(ws: WebSocket) { this.#ws = ws; }
  send(text: string) {
    if (this.#ws.readyState === WebSocket.OPEN) this.#ws.send(text);
    // Hub greets a socket the moment it connects; Deno's is not open until the upgrade response has gone out.
    else if (this.#ws.readyState === WebSocket.CONNECTING && !this.#bye) this.#queue.push(text);
    else throw new Error("the socket is closed");
  }
  close(code = 1000, reason = "") {
    // Deno only sends 1000 or 3000–4999 (Cloudflare also sends 1009, "too big"): anything else goes out as 4000 + its last two digits.
    const sendable = code === 1000 || (code >= 3000 && code <= 4999) ? code : 4000 + (code % 100);
    if (this.#ws.readyState === WebSocket.CONNECTING) this.#bye = [sendable, reason];
    else this.#ws.close(sendable, reason);
  }
  opened() {
    for (const text of this.#queue.splice(0)) this.#ws.send(text);
    if (this.#bye) this.#ws.close(...this.#bye);
  }
  serializeAttachment(value: unknown) { this.#att = structuredClone(value); }
  deserializeAttachment() { return structuredClone(this.#att); }
}

/** env: the same object the Worker gets (Hub reads the CHAT_* settings from it each time, so a test may change them). */
export function chatLocal(env: Record<string, unknown>) {
  const db = new DatabaseSync(":memory:");
  const socks = new Set<Sock>();
  const hub = new Hub({
    sql: (query: string, ...params: unknown[]) => db.prepare(query).all(...(params as never[])),
    tx: (fn: () => unknown) => {
      db.exec("BEGIN");
      try { const out = fn(); db.exec("COMMIT"); return out; } catch (e) { db.exec("ROLLBACK"); throw e; }
    },
    sockets: () => [...socks],
    env,
    now: () => Date.now(),
  });
  const waiting = new Map<string, Request>(); // Sec-WebSocket-Key → the browser's own upgrade request

  // What ChatHub.fetch does in deploy/chat.js.
  const stub = {
    fetch: (request: Request) => {
      const path = new URL(request.url).pathname;
      if (path === "/summary") return Promise.resolve(Response.json(hub.summary()));
      if (path === "/pending") return Promise.resolve(Response.json(hub.pending()));
      const original = waiting.get(request.headers.get("Sec-WebSocket-Key") ?? "");
      if (path !== "/ws" || !original) return Promise.resolve(new Response("expected a WebSocket", { status: 426 }));
      let who = null;
      try { who = JSON.parse(request.headers.get("X-Chat-Who") ?? "null"); } catch { /* a guest */ }
      const offered = (request.headers.get("Sec-WebSocket-Protocol") ?? "").split(",").some((p) => p.trim() === PROTO);
      const { socket, response } = Deno.upgradeWebSocket(original, offered ? { protocol: PROTO } : {});
      socket.binaryType = "arraybuffer";
      const sock = new Sock(socket);
      socks.add(sock);
      hub.connect(sock, who);
      socket.onopen = () => sock.opened();
      // On Cloudflare the platform answers "ping" itself, without waking the object.
      socket.onmessage = (e) => { if (e.data === "ping") socket.send("pong"); else hub.message(sock, e.data); };
      // As on Cloudflare: the handler runs while the socket is still listed, then it is gone. An error is followed by a close.
      const gone = () => { if (socks.has(sock)) { hub.close(sock); socks.delete(sock); } };
      socket.onclose = gone;
      socket.onerror = gone;
      return Promise.resolve(response);
    },
  };

  return {
    /** The binding: env.CHAT.get(env.CHAT.idFromName('hub')).fetch(request). There is one room object whatever the name. */
    CHAT: { idFromName: (name: string) => name, get: (_id: unknown) => stub },
    /** Runs the server's handler, keeping a WebSocket upgrade request at hand while it does. */
    serve: async (request: Request, next: (request: Request) => Response | Promise<Response>) => {
      const key = request.headers.get("Upgrade")?.toLowerCase() === "websocket" ? request.headers.get("Sec-WebSocket-Key") : null;
      if (!key) return next(request);
      waiting.set(key, request);
      try { return await next(request); } finally { waiting.delete(key); }
    },
    hub,
  };
}
