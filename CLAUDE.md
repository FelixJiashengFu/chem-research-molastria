# MolAstria 项目说明

MolAstria（molastria.com）是计算化学研究导航：资源搜索、资源关系网、19 章中文讲解、AI 实验室、预印本雷达、Pro 订阅和 Win/Mac 桌面版。
网站是纯静态的，只有账号服务跑在 Cloudflare 上。**这个仓库是公开的：写进来的一切都公开，包括这个文件。**

- 现在要做什么：`docs/ROADMAP.md`
- 为什么是现在这样：`docs/DECISIONS.md`（不要推翻已记录的决定，除非用户要求）
- 系统怎么连起来、用了哪些服务：`docs/ARCHITECTURE.md`
- 每种操作的具体步骤和排障：`docs/RUNBOOK.md`
- 收款与账号服务的开通记录：`PAYMENTS.md`

**开工前：** 如果上下文里没有“MolAstria 当前状态”这一段，先运行 `node .claude/hooks/session-start.mjs`，看分支、是否落后和待办。

## 目录

```text
public/               发布目录，推到 main 就上线
  index.html, app.js  统一搜索
  shared-nav.*        顶栏（所有页面共用）：导航、主题、语言、Pro 按钮、AI 入口；新栏目在这里加导航
  i18n.js             运行时中译英，词典是生成的 i18n/en.js
  ai/ai.js            AI 助手：服务商、托管额度、可拖宽窗口
  atlas/ hub/ lab/ train/ download/   各栏目
  pro/                价格页、账号页 account.html + account-page.js、条款
  pay/config.js       收款链接、显示价格、accountApi、portalUrl；pay/account.js 是账号客户端
  radar/              预印本雷达外层页面；app/ 是复制来的，不要手改
  hub/data.*, merged-data.*   目录快照
deploy/               账号服务：account-worker.js、schema.sql、wrangler.toml（Cloudflare Worker + D1）
desktop/              Tauri 2 桌面版，打包时内置 public/
i18n/en.json          英文译文的源文件，可以手改（JSON 缩进 1 个空格）
tools/                构建、翻译、数据、测试脚本
tools/e2e/            浏览器端到端测试
maintenance/          旧的 Python 爬虫（本机没装 Python）
```

## 常用命令

```bash
deno run --allow-net --allow-read tools/serve.ts 8830   # 本地预览 public/
deno run --allow-read tools/account-test.ts             # 账号服务接口测试
node --test tools/lab-test.mjs                          # 实验室逻辑测试
npm ci --prefix tools/e2e                               # 浏览器测试的依赖，首次运行前装一次
node tools/e2e/run.mjs                                  # 浏览器端到端（假 Stripe、假邮件、假 AI，免费）；可加关键词只跑部分，--net 含真实雷达搜索
node tools/e2e/live.mjs                                 # 线上只读检查（不发邮件、不写数据）
deno run --allow-read --allow-write tools/i18n-extract.ts                              # 抽取新的界面文字
deno run --allow-read --allow-write --allow-net --allow-env tools/i18n-translate.ts    # DeepSeek 补译并生成 public/i18n/en.js
```

`deploy/` 里部署前先 `npm ci`。Windows PowerShell 禁止运行 `npx.ps1`，给用户的命令要写 `npx.cmd`。

## 三条上线路径

| 改了哪里 | 怎么上线 | 命令 |
| --- | --- | --- |
| `public/`、`i18n/`、`tools/` | 推到 `main`，GitHub Actions 跑测试、生成 SEO 页后发布 | `/ship-site` |
| `deploy/` | **推送不会部署**，要跑 wrangler；改表结构要先迁移数据库 | `/ship-worker` |
| `desktop/`，或想让桌面版用户拿到新网页 | 打标签 `desktop-v0.1.x`，CI 构建并发布，已安装的应用自动提示更新 | `/ship-desktop 0.1.4` |

桌面版内置的是打包时的网页，所以网站改动要等下一个桌面版本才到桌面用户手里。
账号服务要和网站配合改时，先部署 Worker（要兼容旧网页），再推网站。

其他：`/site-status` 看全局状态，`/refresh-chemrxiv` 刷新 ChemRxiv 快照，`/sync-radar` 同步预印本雷达，`/wrap-up` 收尾。

## 必须遵守

- **提交和推送：** 用户说了才做。提交信息**不加** `Co-Authored-By` 那一行（用户明确要求，优先于默认的归属提醒）。可能有另一个会话也在推送，推送前先 `git fetch` 并 rebase。
- **推送命令：** `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main`（Windows 凭据管理器里存的是另一个账号）。
- **真实密钥不经过 Claude：** 不写进仓库、文件或命令行，也不替用户输入，用户发到聊天里也一样。要放密钥时，在终端启动 `wrangler secret put`，让用户自己粘贴。发现密钥出现在聊天里，提醒用户更换。
- **站长权限由用户授予：** 往 `grants` 表写站长的命令让用户自己运行（`docs/RUNBOOK.md`）。
- **不提交用户数据：** D1 备份含邮箱，只放在仓库外。
- **生成的文件不要手改：** `public/radar/app/`（用 `tools/vendor-radar.ts`）、`public/i18n/en.js`（用 `i18n-translate`）、`public/hub/data.*` 和 `public/merged-data.*`（用 `tools/hub-chemrxiv.ts` 或 `maintenance/`）。`public/guide/`、`public/resources/`、`sitemap.xml` 和各页的 SEO 头每次发布由 CI 重新生成，本地不用跑。

## 代码约定

- 原生 JS，没有框架和构建步骤；页面用 `<script defer>` 加载。写代码前先看同目录的现有写法并照着写。
- **中文是源语言。** 界面文字直接写中文，改完运行 `i18n-extract` 和 `i18n-translate`。数据内容（论文标题、论坛帖、AI 回答）不翻译，选择器加进 `public/i18n.js` 的 `SKIP`。
- 用户偏好只存 `localStorage`，读写要包 `try/catch`；键名沿用 `chemhub-*`、`molastria-*`。
- 颜色用 `shared-nav.css` 的 CSS 变量，深浅两种主题都要看。
- 预印本雷达保持书香风格，是有意和站点其他部分不同。`D:\ChemDraw\PreprintRadar` 是独立仓库，MolAstria 只复制它的构建结果。
- AI 实验室的演示数值是合成的，页面上要一直标明。Muse 指 Meta 的 Muse 模型（`api.meta.ai`）。
- 账号服务的报错信息是中文，由网站原样显示，所以也要翻译（`i18n-extract` 已包含 `deploy/account-worker.js`）。

## 改完要验证

- 接口或账号逻辑：`tools/account-test.ts`，新逻辑要加测试。
- 页面：`tools/e2e/run.mjs`，并截图看一眼浅色、深色、英文、手机宽度。新功能要在 `run.mjs` 里加一条检查。
- 上线后：`tools/e2e/live.mjs`。
- 外部服务的真实行为（真实付款、真实邮件）测试覆盖不到，要如实告诉用户哪些没测。

## 收尾

一项工作做完时更新文档（`/wrap-up` 会走一遍）：`docs/ROADMAP.md` 划掉做完的、加上新发现的；做了取舍就在 `docs/DECISIONS.md` 记一条；操作方式变了就改 `docs/RUNBOOK.md`；发现新的坑就记到下面。

## 已知的坑

- **`wrangler.toml`：** `routes`、`workers_dev` 这类顶层设置必须写在 `[[d1_databases]]`、`[vars]` 之前，否则会被算进那些段里。
- **D1 偶发 403（code 7403）：** 一段时间没用后的第一个请求常失败，重试就好，不是权限问题。
- **D1 迁移：** `schema.sql` 只有 `CREATE TABLE IF NOT EXISTS`，加列要另外跑 `ALTER TABLE`，并在 `schema.sql` 留注释。
- **页面缓存：** GitHub Pages 让浏览器缓存文件 10 分钟，刚上线时要 Ctrl+F5。测线上时给网址加查询参数。
- **ChemRxiv：** 官网对程序返回 Cloudflare 验证，不要绕过；用 Crossref（前缀 10.26434）。Crossref 里没有学科字段，靠关键词筛。
- **i18n：** 带 `{0}` 的词条至少要有 2 个汉字才生效；一个按钮和一个列表同名会共用一条译文（雷达的“收藏”因此把列表改成了“我的收藏”）。
- **Stripe 测试 ID：** 账号服务只接受 `cs_test_` 或 `cs_live_` 加字母数字，带下划线的假 ID 会被拒。
- **本机杀毒：** Norton 会拦截 HTTPS。Deno 脚本报 `UnknownIssuer` 时加 `DENO_TLS_CA_STORE=system`，Node 脚本加 `NODE_USE_SYSTEM_CA=1`。
- **本机 shell：** Git Bash 的 heredoc 里同时有反引号和引号时可能解析失败；复杂的编辑脚本先写成文件再运行。
- **浏览器面板：** 不要把内置浏览器导航到 PDF（会在用户屏幕上弹保存框）；窗口隐藏时动画会变慢，看动画和性能用无头 Chrome。
- **桌面版测试：** 不要在用户的 MolAstria 开着时再启动一个实例。
