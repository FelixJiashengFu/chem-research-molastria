// A stand-in for Cloudflare D1 on node:sqlite, with deploy/schema.sql applied. Used by the account worker's
// tests and local server. D1 numbers parameters ?1, ?2…; node:sqlite binds them positionally the same way.
import { DatabaseSync } from "node:sqlite";

export async function d1(path = ":memory:") {
  const sqlite = new DatabaseSync(path);
  sqlite.exec(await Deno.readTextFile(new URL("../deploy/schema.sql", import.meta.url)));
  function statement(sql: string, args: unknown[] = []) {
    const st = () => sqlite.prepare(sql);
    return {
      bind: (...a: unknown[]) => statement(sql, a),
      first: async () => (st().get(...(args as any[])) as any) ?? null,
      all: async () => ({ results: st().all(...(args as any[])) }),
      run: async () => { st().run(...(args as any[])); return { success: true }; },
    };
  }
  return { sqlite, DB: { prepare: (sql: string) => statement(sql), batch: async (list: any[]) => Promise.all(list.map((s) => s.run())) } };
}
