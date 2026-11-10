// 开放模型馆（public/open-models/om-data.js）的内容完整性：node --test tools/open-models-test.mjs
// 每家公司和每个条目中英两版齐全；类型、使用条件都在定义里；按任务比较引用的条目都存在；链接是 https；
// 每家公司（Meta 除外，它用现成的 /meta/ 页）都有自己的展馆页，页面加载的脚本都在。
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import vm from 'node:vm';

const root = new URL('../public/', import.meta.url);
const ctx = { window: {} };
vm.runInNewContext(readFileSync(new URL('open-models/om-data.js', root), 'utf8'), ctx);
const D = JSON.parse(JSON.stringify(ctx.window.MOLASTRIA_OM));
const bi = (v, what) => { assert.ok(v && v.zh && v.en, `${what} 缺中文或英文`); };

test('公司和条目：id 唯一、双语、类型和许可都有定义', () => {
  const orgIds = D.orgs.map((o) => o.id);
  assert.equal(new Set(orgIds).size, orgIds.length);
  assert.ok(orgIds.includes('meta') && D.orgs.length >= 10);
  let n = 0;
  for (const o of D.orgs) {
    bi(o.name, `${o.id}.name`); bi(o.blurb, `${o.id}.blurb`);
    if (!o.path) { // Meta 的展馆是现成的 /meta/ 页，没有这几项
      bi(o.lead, `${o.id}.lead`);
      for (const [num, label] of o.facts) { if (typeof num === "object") bi(num, `${o.id}.facts`); else assert.match(String(num), /^[^\u4e00-\u9fff]+$/, `${o.id} 的数字 ${num} 有汉字，要写成中英两版`); bi(label, `${o.id}.facts`); }
      for (const s of o.site) { bi(s, `${o.id}.site`); assert.match(s.href, /^(https:\/\/|\.\.\/)/); }
    }
    const ids = o.items.map((i) => i.id);
    assert.equal(new Set(ids).size, ids.length, `${o.id} 的条目 id 重复`);
    for (const it of o.items) {
      n++;
      const w = `${o.id}:${it.id}`;
      assert.ok(D.kinds[it.kind], `${w} 的类型 ${it.kind}`);
      assert.ok(D.uses[it.use], `${w} 的使用条件 ${it.use}`);
      bi(it.desc, `${w}.desc`);
      if (typeof it.lic === "string") assert.ok(it.lic.trim(), `${w}.lic`); else bi(it.lic, `${w}.lic`); // 许可证名本身不用翻译时写成字符串
      assert.ok(it.name && it.links.length, `${w} 缺名字或链接`);
      for (const [k, u] of it.links) { assert.ok(D.linkNames[k], `${w} 的链接类型 ${k}`); assert.match(u, /^(https:\/\/|\.\.\/)/, `${w} ${u}`); }
      // DOI 链接写成 doi.org，arXiv 写 abs 页
      for (const [, u] of it.links) if (/doi/.test(u)) assert.match(u, /^https:\/\/doi\.org\/10\.\d{4,}\//, `${w} ${u}`);
    }
  }
  assert.ok(n >= 50, `条目只有 ${n} 个`);
});

test('按任务比较：引用的条目都存在，没有空任务', () => {
  const keys = new Set(D.orgs.flatMap((o) => o.items.map((i) => `${o.id}:${i.id}`)));
  for (const t of D.tasks) {
    bi(t, 'task');
    for (const k of t.items) assert.ok(keys.has(k), `任务“${t.zh}”引用的 ${k} 不存在`);
    assert.ok(t.items.length >= 1, `任务“${t.zh}”是空的`);
  }
});

test('页面：母栏目页、每个展馆页、Meta 页都接上了', () => {
  const hub = readFileSync(new URL('open-models/index.html', root), 'utf8');
  assert.match(hub, /data-section="openmodels"/);
  for (const o of D.orgs) {
    if (o.path) continue;
    const f = new URL(`open-models/${o.id}/index.html`, root);
    assert.ok(existsSync(f), `${o.id} 没有展馆页`);
    const h = readFileSync(f, 'utf8');
    assert.match(h, new RegExp(`data-org="${o.id}"`));
    for (const s of ['../../shared-nav.js', '../../open-models/om-data.js', '../../open-models/om.js', '../../meta/meta.css']) assert.ok(h.includes(s), `${o.id} 缺 ${s}`);
  }
  const meta = readFileSync(new URL('meta/index.html', root), 'utf8');
  assert.match(meta, /data-om-host="meta"/);
  assert.match(meta, /id="om-crumbs"/);
  assert.match(meta, /id="om-switch"/);
});
