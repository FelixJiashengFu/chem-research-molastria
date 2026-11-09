# MolAstria 项目说明

MolAstria（molastria.com）是阿斯特赖亚科技（Morning Glory，16513778 Canada Inc.）旗下的计算化学研究导航：资源搜索、资源关系网、20 章中英双语讲解手册、计算化学教学视频（YouTube 和哔哩哔哩的课程与教程）、数据库目录、期刊投稿指南、科学大模型（27 个模型与价格对比）、AI 实验室、预印本雷达、游乐场（量子化学小游戏和浏览器里的量子化学计算器）、Pro 订阅和 Win/Mac 桌面版。
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
  index.html, app.js  统一搜索与收藏夹（?collection=saved，合并首页和数据库页两个收藏库）；search-terms.js 是中英术语表
  shared-nav.*        顶栏（所有页面共用）：导航、主题、语言、Pro 按钮、AI 入口、左下角“下载桌面版”浮窗；新栏目在这里加导航。入口可以在顶栏上直接拖动换位（鼠标一拖就起，触屏先按住约 0.4 秒），按住不动再松开（或 显示 → 调整导航顺序）打开玻璃面板排序，存 molastria-nav-order；切换语言时把地址、滚动位置、标签页和筛选存进 sessionStorage 的 molastria-lang-restore，刷新后复原，新加的入口排在它前一个入口后面
  backdrop.js         10 种背景和背景面板，含“徽标动画”开关（关时 html[data-logo-motion=off]，切换时派发 window 事件 molastria:logo-motion）
  assets/brand/       装饰视频与 poster：首页徽标 logo-loop.{mp4,webp}（以徽章为中心裁切的 256 px 正方形）；片头 intro.mp4 + intro-end.webp，只有下载页用（AI 面板改成了吉祥物进场动画）（ffmpeg 转码的小文件，原片不进仓库）
  sw.js, offline.html, manifest.webmanifest   可添加到主屏幕（PWA）：sw.js 离线保存看过的页面，由 shared-nav.js 注册（桌面版、单文件版、本地文件和 localhost 不注册）；各页的 PWA 头部标签和 sw.js 版本号由 build-seo.ts 在发布时写入，仓库里的 sw.js 保持 VERSION = 'dev'
  assets/pwa/         主屏幕和安装用的图标（按 favicon.svg 图案生成的新文件）
  i18n.js             运行时中译英，词典是生成的 i18n/en.js
  ai/ai.js            AI 助手：服务商、托管额度（只有 DeepSeek V4 Flash）、可拖宽窗口；六个吉祥物（MASCOTS，点顶部头像换，存 molastria-ai-mascot），面板从关到开时吉祥物进场 5 秒（纯 CSS，可跳过；选吉祥物的面板里能关，存 molastria-ai-intro）
  manual/ atlas/ journals/ scimodels/ hub/ lab/ meta/ models/ train/ download/   各栏目（meta/ 用 lab/chem.js 的 RDKit）
  manual/             讲解手册阅读器；正文数据仍在 atlas/content.js（中文）和 atlas/guides-en.js（英文），旧地址 atlas/#guide 会跳过来
  videos/             教学视频：videos-data.js 是全部条目（标题和频道照平台原文，说明中英两版，按主题分组），videos.js 渲染；播放器点了才加载，桌面版点封面在系统浏览器打开；封面 thumbs/ 由 tools/video-thumbs.mjs 在 CI 里下载（不进 git）
  atlas/              数据库目录与 Agent 工程（#agent）；downloads/ 里的 resources.{json,csv} 与 content.js 同步
  digest/             每周精选：公开页（账号服务 /digest/preview 的本周概览和前五篇带点评），digest-card.js 是首页的卡片
  journals/           期刊发表：journals-data.js（期刊，中英双语，每项带出处）与 journals-guide.js（投稿指导）
  fundamental-science/  进一步基础科学发现：fs-data.js 是全部内容（中英两版，每条带研究状态，文献逐条核对过），fs-models.js 是交互演示的数学（纯函数），fs-math.js 是生成的 MathML
  fundamental-science/math/  子模块“数学基础与探索”：fm-data.js 是全部内容（10 门学科的讲解、大纲、公式、练习、自测、教材与视频，学科关系图，学习路线，Hall 章节导读；书目 DOI 在 Crossref 核对过，视频逐条核对过），fm.js 渲染，fm-math.js 是生成的 MathML
  scimodels/          科学大模型：scimodels-data.js（数据库第 17 类的 27 个模型，中英双语，每条官方链接；prices 是价格对比与汇率，带核对日期）
  about/              关于页：阿斯特赖亚科技（Morning Glory，16513778 Canada Inc.）与 MolAstria 的关系；只有 MolAstria 标“已上线”，其他方向都是规划，不要写成现状
  pro/                价格页、账号页 account.html + account-page.js、条款
  pay/config.js       收款链接、显示价格、accountApi、portalUrl；pay/account.js 是账号客户端
  radar/              预印本雷达外层页面（28 个来源，理工到人文）；app/ 是复制来的，不要手改
  research-atlas/     研究图谱外层页面（中美二十所大学数理化网络、量子化学地图、Top 20、中美对比、北美产业）；app/ 是 university-science-research-network 的整站构建，由 tools/vendor-atlas.mjs 复制，不要手改；英文、Tт 字体和主题由外层页面经网址参数和 postMessage（ra-host）传进去，译文在那个仓库的 i18n/en.json，用本站的 i18n.js；每月 5 日 atlas-sync.yml 自动重新复制
  qchem/              游乐场（地址仍是 /qchem/）：六个小游戏 play.js，物理是纯函数 play-models.js；“量子化学计算器”标签是 iframe 里的 app/（从 qchem-web 复制来的，不要手改）。#play-… 打开游戏，#lab 打开计算器，其他 #… 原样交给计算器
  hub/network.*, net-engine.js   网状查询：net-engine.js 由目录、讲解手册和 search-terms.js 现算实体与关系（无 DOM，tools/net-test.mjs 测）
  hub/data.*, merged-data.*   目录快照
deploy/               账号服务：account-worker.js、digest.js（每周精选）、schema.sql、wrangler.toml（Cloudflare Worker + D1）
desktop/              Tauri 2 桌面版，打包时内置网站：stage-web.mjs 在每次构建前把 public/ 复制到 desktop/web/（不进 git），去掉 App 里用不到的 watch/ 视频；src/uma.rs + uma/runner.py 是“在本机运行 UMA”；src/save.rs 让页面里的下载走系统保存窗口；src/notify.rs 把页面的通知（预印本雷达）转成系统通知；Mac 上 window.print() 改走 print_page 命令（WKWebView 自己不打印）
i18n/en.json          英文译文的源文件，可以手改（JSON 缩进 1 个空格）
tools/                构建、翻译、数据、测试脚本
tools/e2e/            浏览器端到端测试
tools/uma-server/     在线模型：站长电脑上的服务 server.py（15 个模型，经 Cloudflare Tunnel 接到账号服务 /uma/*），MACE 在 mace_worker.py（单独的 mace-env）；secret.local、cache*.json 不进 git
tools/cloud/          站长的云端 GPU 批量计算：run.mjs（本机，经 gcloud）+ batch_uma.py / batch_mace.py / remote.sh（虚拟机上）；cloud.local.json 不进 git
agent/chemdb-agent/   chemdb-agent 源码（计算化学 MCP 服务器，Python；测试与 venv 说明见其 README）。下载包由 python tools/pack-chemdb-agent.py 生成
maintenance/          Python 爬虫与合并脚本，单元测试是 test_*.py（离线）；每周四由 .github/workflows/refresh-data.yml 自动运行（同一个工作流也跑 tools/train-models.mjs，核对训练页的模型）
```

## 常用命令

```bash
deno run --allow-net --allow-read tools/serve.ts 8830   # 本地预览 public/
deno run --allow-read tools/account-test.ts             # 账号服务接口测试
node --test tools/lab-test.mjs                          # 实验室逻辑测试
node --test tools/net-test.mjs                          # 网状查询引擎（用真实目录快照）
node --test tools/fundamental-test.mjs                  # 基础科学栏目：演示的数学对照解析解，内容的状态、公式、文献都能对上
node --test tools/play-test.mjs                         # 游乐场：游戏的物理对照已知结果，隧穿关卡都能过关
node tools/fundamental-math.mjs                         # 基础科学栏目：把 fs-data.js 里的 LaTeX 用 KaTeX 转成 fs-math.js（MathML）
NODE_USE_SYSTEM_CA=1 node tools/fundamental-refs.mjs    # 基础科学栏目：逐条在 Crossref 核对文献
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
- **生成的文件不要手改：** `public/radar/app/`（用 `tools/vendor-radar.ts`）、`public/research-atlas/app/`（用 `tools/vendor-atlas.mjs`）、`public/qchem/app/`（用 `tools/vendor-qchem.ts`）、`public/i18n/en.js`（用 `i18n-translate`）、`public/hub/data.*` 和 `public/merged-data.*`（用 `tools/hub-chemrxiv.ts` 或 `maintenance/`）、`public/train/models-live.js`（用 `tools/train-models.mjs`）、`public/fundamental-science/fs-math.js` 和 `public/fundamental-science/math/fm-math.js`（都用 `tools/fundamental-math.mjs`）、`public/atlas/downloads/chemdb-agent.zip`（用 `python tools/pack-chemdb-agent.py`，同样的源码打出同样的 zip）。`public/videos/thumbs/` 不进 git，发布和打包桌面版时由 `tools/video-thumbs.mjs` 下载。`public/guide/`、`public/resources/`、`sitemap.xml`、各页的 SEO 头和 PWA 头部标签、`sw.js` 的版本号每次发布由 CI 重新生成，本地不用跑。

## 代码约定

- 原生 JS，没有框架和构建步骤；页面用 `<script defer>` 加载。写代码前先看同目录的现有写法并照着写。
- **中文是源语言。** 界面文字直接写中文，改完运行 `i18n-extract` 和 `i18n-translate`。数据内容（论文标题、论坛帖、AI 回答）不翻译，选择器加进 `public/i18n.js` 的 `SKIP`。
- 用户偏好只存 `localStorage`，读写要包 `try/catch`；键名沿用 `chemhub-*`、`molastria-*`。
- **箭头用图标，不用字符：** 按钮和链接上的箭头写 `<i class="ico-ext" aria-hidden="true"></i>`（右上，外链 / 打开），其他方向加 `ico-right`、`ico-left`、`ico-up`、`ico-down`；样式在 `shared-nav.css`，是金属金色的遮罩图形。不要再写 ↗ → ← ↑ ↓ 字符（iPad 和 iPhone 把 ↗ 画成蓝色 emoji）；句子里表示流程的箭头（如“UMA → DFT”）照常用字符。
- **显示设置：** 顶栏“Tт”按钮（`shared-nav.js` 的 `DISPLAY`）调界面缩放、正文字号和字体，存在 `molastria-zoom`、`molastria-text`、`molastria-font`；每页 `<head>` 的小脚本先套用，避免跳动。界面缩放在网站和 iPad 主屏幕应用里是 `<html>` 的 CSS zoom，在桌面版是 WebView 自己的缩放（Rust 命令 `set_zoom`）；正文字号是 `main{zoom}`；字体改 `--font-sans`。CSS zoom 不改变媒体查询看到的宽度，所以窗口窄时自动压低倍数（`roomFor()`），新页面的宽元素也要能在约 520 px 的排版宽度里放下。嵌入的应用（雷达、计算器）的 iframe 标 `data-display-frame`，放在一个 `position:relative` 的盒子里绝对定位：`displayFrames()` 用 zoom 抵消页面缩放，再用 transform 放大，这样 Chrome 和 iPad 的 WebKit 表现一致，应用拿到的视口也跟着变窄。整页高度用 `height:100%`，不要用 `100dvh`（Chrome 会把 vh 再乘一次 CSS zoom）。
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
- **Worker 免费版：** 每次调用限 10 ms CPU，本地测不出来；生成一期实测 8 ms（2026-10-31）。定时任务里解析的响应要小（每个来源 20 条），改动后在线上跑一次（`docs/RUNBOOK.md`）。
- **页面缓存：** GitHub Pages 让浏览器缓存文件 10 分钟，刚上线时要 Ctrl+F5。测线上时给网址加查询参数。
- **ChemRxiv：** 官网对程序返回 Cloudflare 验证，不要绕过；用 Crossref（前缀 10.26434）。Crossref 里没有学科字段，靠关键词筛。
- **i18n：** 带 `{0}` 的词条至少要有 2 个汉字才生效；一个按钮和一个列表同名会共用一条译文（雷达的“收藏”因此把列表改成了“我的收藏”）。`i18n.js` 的 `SKIP` 选择器要写窄：`.card h3` 曾把实验室所有卡片标题一起跳过，现在是 `article.card h3`（只跳论文卡片）；`textarea` 只跳过内容，placeholder 照常翻译。`i18n-extract` 不抽资源名和 `hub/net-engine.js`，那里要显示英文的文字直接手加到 `i18n/en.json`（有译文的手加词条会保留）。只有一个汉字的模板（如 `${n} 条`）永远不会被翻译，写成至少两个汉字（`共 ${n} 条`）。
- **Stripe 测试 ID：** 账号服务只接受 `cs_test_` 或 `cs_live_` 加字母数字，带下划线的假 ID 会被拒。
- **本机杀毒：** Norton 会拦截 HTTPS。Deno 脚本报 `UnknownIssuer` 时加 `DENO_TLS_CA_STORE=system`，Node 脚本加 `NODE_USE_SYSTEM_CA=1`。
- **本机 shell：** Git Bash 的 heredoc 里同时有反引号和引号时可能解析失败；复杂的编辑脚本先写成文件再运行。脚本里 `String.replace` 的替换文本要用函数形式，否则 `$$eval` 会变成 `$eval`。
- **浏览器面板：** 不要把内置浏览器导航到 PDF（会在用户屏幕上弹保存框）；窗口隐藏时动画会变慢，看动画和性能用无头 Chrome。
- **PWA 在本地看不到：** localhost 不注册 sw.js（e2e 用 `page.route` 模拟同源文件，Service Worker 会绕过它），各页的 manifest 等头部标签也只在 CI 跑 build-seo.ts 时才加。要测离线和安装，按 `docs/RUNBOOK.md`“本地测 PWA”在仓库外的副本里测。本地跑过 build-seo.ts 的话，提交前把 `public/sw.js` 的 `VERSION` 改回 `'dev'`。
- **e2e 端口：** `tools/e2e/run.mjs` 固定用 8840 端口，两个会话同时跑时一边结束会关掉另一边的服务器（`ERR_CONNECTION_REFUSED`）。一次只跑一个；自己预览用别的端口。
- **云端会话连不上 YouTube 和哔哩哔哩：** 教学视频的搜索和核对（`tools/video-search.mjs`）要在站长电脑或 GitHub Actions 上跑，做法见 RUNBOOK“教学视频”。哔哩哔哩对 GitHub 的服务器可以用（搜索要 wbi 签名和 buvid3 cookie），频繁请求会返回 -412，脚本遇到连续限流就停。
- **桌面版不能用 `panic = "abort"`：** wry 在 Mac 上靠 `objc2::exception::catch` 接住 WKURLSchemeTask 的 Objective-C 异常（请求已被 WebKit 停掉时会抛），abort 模式下接不住，整个应用 SIGABRT 闪退（0.1.19 的崩溃，`docs/DECISIONS.md` 2026-11-08）。
- **桌面版测试：** 不要在用户的 MolAstria 开着时再启动一个实例。调试版和已安装的应用共用应用数据和 localStorage。
- **UMA 在 Windows：** fairchem 的默认设置用 `torch.compile`，需要 Triton，Windows 没有，会报 `TritonMissing`；所有加载 UMA 的地方（`uma-server/server.py`、桌面版 `runner.py`、`batch_uma.py`、Meta 页生成的脚本）用 `uma_settings()`，没有 Triton 时改用 `batch` 预设（全精度、不编译）。中文 Windows 上 Python 还要用 UTF-8 模式（`-X utf8` 或 `PYTHONUTF8=1`），否则 fairchem 按 GBK 读自己的数据文件失败；桌面版已设 `PYTHONUTF8=1`，`start.ps1` 用 `-X utf8`。RTX 20 系（计算能力 7.5）用不了 UMA Nitro。
- **MACE 和 fairchem 不能装在一起：** mace-torch 固定 e3nn 0.4.4，fairchem 要 0.5 以上。在线服务把 MACE 放在 `mace-env`，经 `mace_worker.py`（标准输入输出 JSON）调用。
- **在线模型的 IP/EA：** 不少 OMol25 系模型（UMA-S 1.1、eSEN、MACE-OMOL-0）给的电荷态能量差不可靠，加模型前按 RUNBOOK“加一个在线模型”先测垂直 IP。
- **WSL 里的模型权重：** Hugging Face 缓存的 `snapshots` 是 Linux 符号链接，Windows 经 `\\wsl.localhost` 读不到，要复制 `blobs` 里的文件；WSL 也写不进 Windows 的 `%USERPROFILE%\.cache`，从 Windows 这边复制。
