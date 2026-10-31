---
name: ship-worker
description: 测试并部署账号服务（Cloudflare Worker），需要时先迁移 D1 数据库，部署后在线上验证。
disable-model-invocation: true
---

用户输入这个命令，就是同意部署账号服务。步骤也见 `docs/RUNBOOK.md`。

1. `git diff` 看 `deploy/` 改了什么。确认新版本兼容还没更新的网页和桌面版；不兼容就先和用户商量顺序。
2. `deno run --allow-read tools/account-test.ts`，失败就停下来修。
3. 如果 `deploy/schema.sql` 变了：
   - 新表：在 `deploy` 里运行 `npx wrangler d1 execute molastria --remote --file schema.sql`。
   - 给已有的表加列：单独跑 `ALTER TABLE`，再用 `pragma_table_info` 确认。
   - 改动数据之前，先把要做什么告诉用户。
4. 在 `deploy` 里：`npm ci`（没装过时），然后 `npx wrangler deploy`。输出里要有 `api.molastria.com (custom domain)`。
5. `node tools/e2e/live.mjs`，以及针对这次改动的只读探测。不要用真实邮箱触发发信，不要往线上数据库写测试数据。
6. 报 7403 就重试。需要写入或更换密钥时，让用户自己在终端粘贴，不要经手。
7. Worker 不会随 `git push` 部署，代码本身仍要提交；用户没要求就问一下是否 `/ship-site`。
