# 操作手册

命令默认在仓库根目录运行。用户在 PowerShell 里运行时，把 `npx` 写成 `npx.cmd`。

## 上线网站

```bash
deno run --allow-read tools/account-test.ts
node --test tools/lab-test.mjs
node tools/e2e/run.mjs
git fetch origin && git rebase origin/main
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main
gh run watch --repo FelixJiashengFu/chem-research-molastria "$(gh run list --repo FelixJiashengFu/chem-research-molastria --workflow pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
node tools/e2e/live.mjs
```

## 部署账号服务

```bash
cd deploy
npm ci
npx wrangler deploy
```

推到 GitHub **不会**部署它。部署前先跑 `tools/account-test.ts`；新版本要兼容还没更新的网页和桌面版。

**改表结构：** 新表写进 `schema.sql` 后运行 `npx wrangler d1 execute molastria --remote --file schema.sql`（可重复执行）。给已有的表加列要单独跑 `ALTER TABLE`，并在 `schema.sql` 留注释。顺序是先迁移，再部署，再推网站。

看线上请求：`npx wrangler tail molastria-account`；过去的日志和定时任务记录在 Cloudflare 控制台的 Worker → Observability。

## 每周精选

每周一自动生成并分批发送（`ARCHITECTURE.md`）。站长可以在账号页点“重新生成本期”。在 `deploy/` 里查看：

```bash
npx wrangler d1 execute molastria --remote --command "SELECT week, created, length(body) FROM digests ORDER BY created DESC LIMIT 4"
npx wrangler d1 execute molastria --remote --command "SELECT count(*) FROM digest_subs"
npx wrangler d1 execute molastria --remote --command "SELECT week, sent, count(*) FROM digest_sends GROUP BY week, sent ORDER BY week DESC LIMIT 6"
```

`digest_sends.sent` 是发送时间；0 表示这个人已不是 Pro，跳过了。

要加一个来源：改 `deploy/digest.js` 的来源列表，并先用真实接口确认返回大小（一次调用的 CPU 时间很有限，每个来源只取 20 条）。

## 发布桌面版

```bash
git fetch origin --tags
git tag -a desktop-v0.1.4 -m "Desktop 0.1.4: 这个版本改了什么" origin/main
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin desktop-v0.1.4
```

版本号来自标签。CI 大约 6–8 分钟。完成后 `node tools/e2e/live.mjs` 会核对更新清单和 Release 是否一致。已安装的应用下次启动时提示更新。

本地构建（不发布）：`cd desktop && npm ci && npx tauri build --bundles nsis`。

调试已构建的应用：启动前设环境变量 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`，再用 Playwright 的 `connectOverCDP` 连上去。测试更新流程：用 `--config` 把 updater 的 `endpoints` 指向本机 `127.0.0.1` 的假更新源，并打开 `dangerousInsecureTransportProtocol`。不要在用户的应用开着时再启动一个实例。

## 翻译

改了界面文字后：

```bash
deno run --allow-read --allow-write tools/i18n-extract.ts
deno run --allow-read --allow-write --allow-net --allow-env tools/i18n-translate.ts
```

需要环境变量 `DEEPSEEK_API_KEY`。检查 `git diff i18n/en.json` 里的新译文，品牌词和按钮文字常要手改；手改时保持 1 空格缩进，再运行一次 `i18n-translate` 生成 `public/i18n/en.js`。

## 刷新数据

- **ChemRxiv：** `deno run --allow-net --allow-read --allow-write tools/hub-chemrxiv.ts`，可重复运行，只替换 ChemRxiv 条目。新增文字后走一遍翻译。
- **其余目录快照：** `maintenance/` 的 Python 脚本。本机没有 Python。重新生成后要再跑一次 `hub-chemrxiv.ts`，否则 ChemRxiv 条目会丢。
- **预印本雷达：** 先在 `D:\ChemDraw\PreprintRadar` 运行 `deno task web`，再回到这里运行 `deno run --allow-read --allow-write tools/vendor-radar.ts`，然后走一遍翻译。
- **训练 Agent 页的模型表：** 模型信息要对照 Hugging Face（`huggingface.co/api/models/<id>?expand[]=safetensors`）和模型卡核实。刷新时要按作者加 `sort=createdAt` 逐家查最新的仓库，不能只查已知的系列名，否则会漏掉刚发布的新系列（发生过）。
- **站内数字：** 数据量大变时，检查写死的“1,500 多条”（`public/ai/ai.js`、`public/pro/index.html`）。

## 站长和 VIP 卡

授予站长（用户自己运行，在 `deploy` 目录）：

```bash
npx.cmd wrangler d1 execute molastria --remote --command "INSERT INTO grants (email, source, expires, created) VALUES ('邮箱', 'admin', NULL, unixepoch())"
```

取消：`DELETE FROM grants WHERE email = '邮箱'`。VIP 卡在账号页管理。

## 更换密钥

在服务商后台新建密钥，**用户自己**在 `deploy` 目录的终端运行下面对应的命令并粘贴。旧密钥确认没问题后删除。

```bash
npx.cmd wrangler secret put STRIPE_KEY
```

```bash
npx.cmd wrangler secret put RESEND_API_KEY
```

```bash
npx.cmd wrangler secret put DEEPSEEK_API_KEY
```

- **Stripe：** Developers → API keys → Create restricted key，只开 Customers、Checkout Sessions、Subscriptions 三项 Read。
- **Resend：** API Keys，Sending access。
- **DeepSeek：** platform.deepseek.com → API keys。
- **Cloudflare：** wrangler 用 OAuth 登录（`npx.cmd wrangler login`），没有长期密钥。

写入后验证：`npx wrangler secret list --name molastria-account`，再跑 `node tools/e2e/live.mjs`。

## 备份

- **D1（建议每月一次）：** 在 `deploy` 目录运行 `npx wrangler d1 export molastria --remote --output "D:/备份路径/molastria-日期.sql"`。文件含用户邮箱，**不要放进仓库**。
- **更新签名私钥：** `~/.tauri/molastria-updater.key` 另存到安全的地方。丢了它，已安装的桌面版就再也收不到更新。
- **Claude 记忆：** `~/.claude/projects/D--ChemDraw/memory/`，换电脑时带走。

## 换电脑

1. 装 Git、GitHub CLI（`gh auth login`）、Node、Deno、Chrome、Claude。
2. `git clone https://github.com/FelixJiashengFu/chem-research-molastria D:\ChemDraw\ChemResearchHub`
3. 依赖：`npm ci --prefix deploy`，`npm ci --prefix tools/e2e`。
4. Cloudflare：在 `deploy` 里运行 `npx.cmd wrangler login`。
5. 复制 `~/.tauri/molastria-updater.key` 和 Claude 记忆目录。
6. 用户环境变量 `DEEPSEEK_API_KEY`（翻译要用）：用户自己 `setx`。
7. 跑 `node tools/e2e/run.mjs` 和 `node tools/e2e/live.mjs`。

## 排障

| 现象 | 原因和处理 |
| --- | --- |
| 账号页显示“账号服务正在开通” | `pay/config.js` 的 `accountApi` 是空的，或浏览器还在用旧缓存（Ctrl+F5） |
| 点“发送验证码”后没收到，数据库也没记录 | 请求没到服务：多半是浏览器缓存了旧网页 |
| 显示“会送达”但没收到 | 这个邮箱没有订阅（按设计不发），或进了垃圾箱，或 Resend 当天超过 100 封 |
| AI 没走托管额度 | 浏览器里存了自己的 key；在 AI 设置选 MolAstria Pro，或从账号页的按钮打开 |
| 托管 AI 报错 | DeepSeek 余额用完，或本月额度用完 |
| 一次提问扣了不止 1 次 | 正常：`deepseek-v4-pro` 按 3 倍计，AI 实验室一轮计 3 次，内容特别长时按长度多计（`ARCHITECTURE.md`） |
| 用户说被退出登录了 | 同一账号最多 5 台设备同时登录，超过时最早的那台会退出 |
| 退款或取消后还是 Pro | 账号服务最多 6 小时后才和 Stripe 同步 |
| 周一过后没有这一期 | 看 Observability 的定时任务记录；论文接口和 DeepSeek 都挂了才会没有。在账号页点“重新生成本期” |
| 订阅了但没收到每周精选 | 每 15 分钟只发 5 封，每天最多 80 封，人多时要等；再看垃圾箱和 Resend 控制台 |
| 解读是空的 | 模型失败或选出不足 3 篇，发的是不带解读的列表；可以重新生成 |
| wrangler 报 7403 | 偶发，重试 |
| wrangler 要注册 workers.dev 子域名 | `wrangler.toml` 顶层设置写到了 `[vars]` 后面 |
| PowerShell 说禁止运行脚本 | 用 `npx.cmd` |
| Deno 报 `UnknownIssuer` | Norton 拦截 HTTPS，加 `DENO_TLS_CA_STORE=system` |
| 桌面版没提示更新 | 启动时才检查，要彻底退出再打开；用户点过“稍后”的话 3 天内不再提示 |
| 每周健康检查没运行 | 公开仓库 60 天没活动时 GitHub 会停掉定时任务，到 Actions 页重新启用 |

## 定期看一眼

- **每年：** Porkbun 域名续费（确认自动续费和银行卡）。
- **每月：** D1 备份；DeepSeek 余额。
- **每周（自动）：** 健康检查失败时 GitHub 发邮件。
- **价格：** `ARCHITECTURE.md` 的费用表写了查询日期，隔一段时间核对一次。
