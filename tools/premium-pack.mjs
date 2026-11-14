// 买断专区（锁区）的正文不在这个仓库里。这个脚本把站长手里的一份内容包（JSON）变成能灌进 D1 premium 表的 SQL。
//   node tools/premium-pack.mjs <内容包.json> <输出.sql>
//   cd deploy && npx wrangler d1 execute <数据库名> --remote --file <输出.sql>      （Windows 上写 npx.cmd）
// 内容包的样子见 tools/premium-fixture.json（本地测试用的占位内容）：{ product, parts: { <块名>: { zh: {…}, en: {…} } } }。
// 一块一种语言是 premium 表里的一行；D1 一条语句不能太长，所以长的正文拆成一条 INSERT 加几条 UPDATE … body = body || '…'。
// 先删掉这个专区原有的行再写入，所以包里没有的块会消失；输出的文件含全部正文，不要提交进仓库。
import { readFileSync, writeFileSync } from 'node:fs';

const LIMIT = 80000; // 每条语句里正文最多这么多字节（D1 的上限是 100 KB）
const q = (s) => `'${String(s).replace(/'/g, "''")}'`;
export function pieces(text, limit = LIMIT) {
  const out = []; let cur = '', bytes = 0;
  for (const ch of text) { const b = Buffer.byteLength(ch) + (ch === "'" ? 1 : 0); if (bytes + b > limit) { out.push(cur); cur = ''; bytes = 0; } cur += ch; bytes += b; }
  if (cur || !out.length) out.push(cur);
  return out;
}
export function pack(bundle, now = Math.floor(Date.now() / 1000)) {
  const product = String(bundle.product || '');
  if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(product)) throw new Error('product 要是小写字母、数字和连字符');
  const sql = [`DELETE FROM premium WHERE product = ${q(product)};`];
  let rows = 0;
  for (const [name, langs] of Object.entries(bundle.parts || {})) {
    if (!/^[a-z0-9][a-z0-9-]{0,39}$/.test(name)) throw new Error(`块名不合规：${name}`);
    for (const lang of ['zh', 'en']) {
      if (langs[lang] === undefined) continue;
      const [first, ...rest] = pieces(JSON.stringify(langs[lang]));
      sql.push(`INSERT INTO premium (product, part, lang, body, updated) VALUES (${q(product)}, ${q(name)}, ${q(lang)}, ${q(first)}, ${now});`);
      for (const more of rest) sql.push(`UPDATE premium SET body = body || ${q(more)} WHERE product = ${q(product)} AND part = ${q(name)} AND lang = ${q(lang)};`);
      rows++;
    }
  }
  return { sql: sql.join('\n') + '\n', rows, statements: sql.length };
}
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  const [src, dst] = process.argv.slice(2);
  if (!src || !dst) { console.error('用法：node tools/premium-pack.mjs <内容包.json> <输出.sql>'); process.exit(1); }
  const r = pack(JSON.parse(readFileSync(src, 'utf8')));
  writeFileSync(dst, r.sql);
  console.log(`${r.rows} 行，${r.statements} 条语句，${(Buffer.byteLength(r.sql) / 1024).toFixed(0)} KB → ${dst}`);
}
