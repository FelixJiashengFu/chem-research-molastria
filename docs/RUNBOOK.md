# 操作手册

命令默认在仓库根目录运行。用户在 PowerShell 里运行时，把 `npx` 写成 `npx.cmd`。

## 上线网站

```bash
deno run --allow-read tools/account-test.ts
node --test tools/lab-test.mjs
node --test tools/net-test.mjs
node tools/e2e/run.mjs
git fetch origin && git rebase origin/main
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main
gh run watch --repo FelixJiashengFu/chem-research-molastria "$(gh run list --repo FelixJiashengFu/chem-research-molastria --workflow pages.yml --limit 1 --json databaseId --jq '.[0].databaseId')" --exit-status
node tools/e2e/live.mjs
```

`live.mjs` 也核对线上的 `manifest.webmanifest`、图标、`sw.js`（版本号必须已由 CI 写入，不是 `'dev'`）和 `offline.html`。

## 可添加到主屏幕（PWA）

`public/sw.js` 由 `shared-nav.js` 注册，只在线上网站（https、不是 localhost）注册；各页的 manifest 等头部标签和 sw.js 的版本号由 `tools/build-seo.ts` 在 CI 里写入。仓库里的 `sw.js` 保持 `VERSION = 'dev'`。

**关掉 PWA（kill switch）：**

1. `public/sw.js`：把 `const KILL = false;` 改成 `true`。
2. `public/shared-nav.js`：把 `const SW = true;` 改成 `false`。
3. 两处在同一次推送里上线（`/ship-site`）。

访客下一次打开任何页面时，浏览器会绕过缓存检查 `/sw.js`，装上关闭版并立即接管：它不再处理任何请求，删掉所有 `molastria-*` 缓存，然后注销自己。新的 shared-nav.js 不再注册，也会注销残留的 worker、删掉缓存。再下一次打开时就完全没有 Service Worker 了。

不要直接删除 sw.js：检查更新时拿到 404，浏览器会让旧的 worker 继续运行。恢复时把两处改回去再推送，版本号由 CI 重新写入。

**本地测 PWA：** localhost 不注册 sw.js，本地预览也没有 PWA 头部标签。测试步骤：

1. 把 `public/`、`tools/build-seo.ts`、`tools/serve.ts`、`site.config.json` 复制到仓库外的目录（保持同样的相对结构）。
2. 在副本里运行 `deno run --allow-read --allow-write <副本>/tools/build-seo.ts`。
3. 用 `deno run --allow-net --allow-read <副本>/tools/serve.ts 8851` 起服务。
4. 启动 Chrome，加参数 `--host-resolver-rules="MAP molastria.test 127.0.0.1" --unsafely-treat-insecure-origin-as-secure=http://molastria.test:8851`，打开 `http://molastria.test:8851/`。
5. 在 DevTools → Application 里看 Manifest、Service workers 和 Cache storage；在 Network 里勾选 Offline 测离线。

上线后在 iPad 的 Safari 里实际添加到主屏幕看一次：图标、全屏、状态栏下的深绿色条，以及断网打开看过的页面。

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

**在线上试跑一次生成：** Workers 免费版每次调用限 10 ms CPU，本地测不出来。2026-10-31 实测生成一期用了 8 ms，余量不多，加来源或改解析后要重测：

1. 确认 `digest_subs` 是空的或可以收到邮件；本周已有一期时先删掉那一行，否则会跳过生成。
2. 临时把 `wrangler.toml` 的 `crons` 第一项和 `account-worker.js` 的 `BUILD_CRON` 都改成 `*/2 * * * *`，然后 `npx wrangler deploy`。
3. `npx wrangler tail molastria-account --format json` 看定时任务的 `outcome` 和 `cpuTime`；`exceededCpu` 就是超了。
4. `git checkout -- deploy/account-worker.js deploy/wrangler.toml`，再部署一次，确认输出里是 `schedule: 0 12-20 * * 1`。

## 发布桌面版

```bash
git fetch origin --tags
git tag -a desktop-v0.1.4 -m "Desktop 0.1.4: 这个版本改了什么" origin/main
git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin desktop-v0.1.4
```

版本号来自标签。CI 大约 6–8 分钟。打包的网页不是直接取 `public/`：Tauri 每次构建前运行 `desktop/stage-web.mjs`，把 `public/` 复制到 `desktop/web/` 并去掉 App 里用不到的部分（目前是 `watch/` 视频导览，约 95 MB）。以后往 `public/` 放大文件时先想一下桌面版要不要它，不要的就加进脚本的 `LEAVE_OUT`；发版后看一眼 Release 里安装包的大小（0.1.14 约 6 MB / 13 MB，Windows / Mac）。完成后 `node tools/e2e/live.mjs` 会核对更新清单和 Release 是否一致。已安装的应用下次启动时提示更新。

本地构建（不发布）：`cd desktop && npm ci && npx tauri build --bundles nsis`。只想试功能：`npx.cmd tauri build --debug --no-bundle`，产物是 `desktop/src-tauri/target/debug/molastria.exe`。它和已安装的应用共用应用数据和 WebView2 存储（同一个 identifier）。

本机 UMA：`desktop/src-tauri/uma/runner.py` 可以单独测，`python -u runner.py --probe` 看环境，`python -u runner.py params.json` 跑一次（参数格式见 `uma.rs` 的 `Params`）。本机测试环境是 `D:/ChemDraw/uma-env`（Python 3.12、CUDA 版 PyTorch、fairchem）。

调试已构建的应用：启动前设环境变量 `WEBVIEW2_ADDITIONAL_BROWSER_ARGUMENTS=--remote-debugging-port=9333`，再用 Playwright 的 `connectOverCDP` 连上去。测试更新流程：用 `--config` 把 updater 的 `endpoints` 指向本机 `127.0.0.1` 的假更新源，并打开 `dangerousInsecureTransportProtocol`。不要在用户的应用开着时再启动一个实例。

## 翻译

改了界面文字后：

```bash
deno run --allow-read --allow-write tools/i18n-extract.ts
deno run --allow-read --allow-write --allow-net --allow-env tools/i18n-translate.ts
```

需要环境变量 `DEEPSEEK_API_KEY`。检查 `git diff i18n/en.json` 里的新译文，品牌词和按钮文字常要手改；手改时保持 1 空格缩进，再运行一次 `i18n-translate` 生成 `public/i18n/en.js`。

新词条全部手写好了、只想重新生成 `en.js` 时，不用 key、也不联网：

```bash
deno run --allow-read --allow-write --allow-env=DEEPSEEK_API_KEY tools/i18n-translate.ts
```

没有空项时它只写 `public/i18n/en.js`（输出 `nothing to translate`）；还有空项又没有 key 会直接退出，什么也不写。

## 说明讲解手册（/manual/）

正文在 `public/atlas/content.js`（中文，一行 JSON）和 `public/atlas/guides-en.js`（英文，一章一行），两边的章节 id 和顺序要一致；阅读器的中文标签是 `public/manual/app.js` 的 `guideLabels`，SEO 页的是 `tools/build-seo.ts` 的 `LABELS`（两份要相同），英文标签在 `guides-en.js` 的 `labels`。

- **加一章：** 两个文件各插一项（`{id, title, label, html}`，`title` 和 `<h1>` 一致），三处标签各加一个，再把站内写着“25 章”的地方一起改（`grep -rn "25 章\|25-chapter"`，`i18n/en.json` 里对应的译文也要改；网状查询的“本站 N 章讲解”和 `llms.txt` 是按章数算的，不用改）。e2e 的“handbook: its own page”里有章数。
- **第 12–16 类五章的数字：** 都来自 `tools/handbook-calcs.py`（PySCF 2.15.0）。改了章里的算例，先跑 `python3 tools/handbook-calcs.py <部分>`，把结果写进 `tools/handbook-test.mjs` 的 `REF`，再跑 `node --test tools/handbook-test.mjs`；它还核对每章说的“收录 N 个（编号 …）”和目录第 12–16 类是否一致，所以给这几类加条目时要同时改那一章的开头和表格。硅能带要 `HANDBOOK_SOLID=1`（约 20 分钟）；GitHub Actions 的 `Handbook calculations` 可以手动运行，勾 solid 就会算。
- **文献：** DOI 在 OpenAlex 逐个查（`https://api.openalex.org/works/doi:<DOI>`，单个查询不受搜索额度限制）；中英两版引用同一组链接（测试会查）。

## 增长（站长账号页）

- **第一次上线（站长在自己电脑上）：** 拉下最新的 main，在 `deploy` 文件夹里依次运行 `npm.cmd ci`、`npx.cmd wrangler d1 execute molastria --remote --file schema.sql`（只会新建 `signups` 表和索引，别的表已存在不受影响）、`npx.cmd wrangler deploy`。然后**马上**用站长邮箱打开账号页一次：“增长”一栏每次打开都会把还没登记的旧账号补进 `signups`（exact = 0，时间是能找到的最早记录，显示为“上线前”）。在这之前，会话全都过期了的老用户再登录会被当成新注册。
- **看数字：** 账号页“增长”一栏。“近 30 天登录过”按 `sessions` 里 30 天内新建会话的邮箱数算，一个人多台设备只算一次。
- **直接查库：** `npx.cmd wrangler d1 execute molastria --remote --command "SELECT date(created, 'unixepoch') AS day, COUNT(*) FROM signups WHERE exact = 1 GROUP BY day ORDER BY day DESC LIMIT 30"`。

## 访问统计（Cloudflare Web Analytics）

- **打开：** Cloudflare 控制台 → Analytics & Logs → Web Analytics → Add a site → 填 `molastria.com`，选“手动加 JS 片段”（网站在 GitHub Pages 上，不走 Cloudflare 代理时不能自动注入）。复制片段里 `"token": "..."` 的那串，填进 `public/shared-nav.js` 的 `const ANALYTICS = ''`，推到 main。token 写在每个页面里，本来就是公开的，不是密钥。
- **关掉：** 把 `ANALYTICS` 改回 `''` 再推；隐私政策里“访问统计”一节也要跟着改。
- **不统计的：** 桌面版、本地预览、自动化浏览器（测试）、开着 GPC 或 DNT 的浏览器。
- **看数据：** Cloudflare 控制台 → Web Analytics → molastria.com。和账号页的“增长”对照：多少人来、多少人注册。

## 网状查询没找到的词

网状查询把术语表认不出、只能做全文检索的词记在用户自己的浏览器里（`molastria-net-misses`，逻辑在 `public/hub/net-misses.js`，页面上的“没找到的词”）。第一次记下一个词时，浏览器把这个词和全文命中数匿名报给账号服务一次（`POST /net/miss`，表 `net_misses`；访客取消“匿名报给站长”就不报）。服务端只存词、次数和时间，不存 IP 和账号；全站共用一个每小时上限 `NET_MISS_HOURLY`（默认 300，设成 `"0"` 就停收），最多留 3000 个词。

- **第一次上线（站长在自己电脑上）：** 拉下最新的 main，在 `deploy` 文件夹里依次运行 `npm.cmd ci`、`npx.cmd wrangler d1 execute molastria --remote --file schema.sql`（建 `net_misses` 表，可重复执行）、`npx.cmd wrangler deploy`。之前网站已经上线也没关系：账号服务没更新时访客报的词会被丢掉，页面不报错，账号页那一栏会说“账号服务还没更新”。
- **站长看全站排行：** 用站长的邮箱登录账号页，“全站没找到的词”一栏按报过的次数排（大致是多少个浏览器查过），可以复制、删一个或全部删掉。命令行：`npx.cmd wrangler d1 execute molastria --remote --command "SELECT shown, n, hits FROM net_misses ORDER BY n DESC LIMIT 50"`（没有邮箱，可以贴出来）。
- **补进术语表之后：** 在账号页把那些词删掉；还留着也不要紧，访客那边认出来了就不会再报。
- **改“哪些词不记”的规则：** 浏览器 `net-misses.js` 的 `worthKeeping` 和账号服务的 `missWorth` 要一起改（`tools/net-test.mjs` 会对照两边），再改隐私页“网状查询里没找到的词”一节。
- **站长自己这台设备：** 网状查询往下翻到“没找到的词”，查得多的在前。
- **有人提交了 Issue：** 题目是“网状查询：术语表里没有的词”。挑出真正的术语（不是拼错的、不是整句话），在 `public/search-terms.js` 里加一组或加进已有的组：一组只放互为同义的写法，至少一个中文、一个英文（复习卡片要用），4 个字母以内的英文缩写会按整词匹配。加完跑 `node --test tools/net-test.mjs tools/review-test.mjs`，再 `node tools/build-api.mjs`（开放数据接口的术语表跟着变）。
- **试一个词现在认不认得：** `node -e` 里照 `tools/net-test.mjs` 开头的写法建网，看 `net.query('词').mode` 是不是 `entity`。

## 联网搜索（首页“网上最匹配”）

首页搜索框停下约 0.7 秒或按回车后，浏览器直接问 OpenAlex（额度用完改问 Crossref）、Wikipedia、PubChem、GitHub，结果合成一个列表画在站内结果上面（`public/websearch/`）。这部分不要 key、不经过账号服务。**Pro 支持者**另外经账号服务的 `POST /web/search` 拿 Brave Search 的通用网页结果。

- **开通 Pro 的网页搜索（站长）：** 在 [api-dashboard.search.brave.com](https://api-dashboard.search.brave.com/) 注册、绑卡、建一个 Search 的 API key；然后在 `deploy` 目录的终端里运行 `npx.cmd wrangler secret put BRAVE_SEARCH_KEY` 自己粘贴，再 `npx.cmd wrangler deploy`（`WEB_DAILY_PRO`、`WEB_MONTHLY_ALL` 是 wrangler.toml 里新加的变量，要部署才生效；不用改数据库）。没有这个 secret 时接口回答 503，网页就安静地不显示网页结果。
- **额度：** 每个 Pro 每天 `WEB_DAILY_PRO` 次（默认 50），全站每 30 天 `WEB_MONTHLY_ALL` 次（默认 1500，约 7.5 美元，扣掉 Brave 每月送的约 5 美元）。改了再 `wrangler deploy`。失败的搜索不计次数。Brave 后台也可以设每月花费上限，两边都设最稳。
- **验证：** 部署后用 Pro 账号在首页搜 `pyscf`，展开“再看 N 条”，应有来源是 Brave 的“网页”一类；免费账号看到的说明里有“Pro 支持者还会收到整个网页的结果”。
- **关掉：** `npx.cmd wrangler secret delete BRAVE_SEARCH_KEY`，或把 `WEB_DAILY_PRO` 设成 `"0"` 再部署。
- **看用量：** `npx.cmd wrangler d1 execute molastria --remote --command "SELECT key, n, reset FROM throttle WHERE key LIKE 'web%'"`（`web-all` 是全站这 30 天的次数；`web:` 开头的行含邮箱，不要贴出来）。

## 基础科学栏目（/fundamental-science/）

内容全部在 `public/fundamental-science/fs-data.js`，中英两版并排写（`T(中文, English)`），页面按站点语言取用，不经过 i18n 翻译。

- **每一条都要有研究状态：** `established` 已确立、`active` 活跃研究、`hypothesis` 理论假说、`proposed` 计划方向。计划方向和假说不能写成成果；`tools/fundamental-test.mjs` 会检查三条主线的状态都写着“计划方向”。
- **加文献：** 先在 Crossref（或 arXiv）查到 DOI，把题目、作者、年份、期刊、卷、页码照原样写进 `refs`，然后运行 `NODE_USE_SYSTEM_CA=1 node tools/fundamental-refs.mjs` 逐条核对；不核对的不要放上去。正文用 `refs` 的 id 引用。
- **加公式：** 在 `math` 里写 LaTeX，运行 `node tools/fundamental-math.mjs`（用 KaTeX 转成 MathML，写进 `fs-math.js`，需要联网一次），再跑 `node --test tools/fundamental-test.mjs`。页面用浏览器原生的 MathML 排版，不加载公式脚本，离线和桌面版里都能显示。
- **演示的数学** 在 `fs-models.js`（纯函数）；改动后让 `fundamental-test.mjs` 里的解析解对照通过。
- **界面文字**（标题、按钮、控件标签）写中文，照常 `i18n-extract`；英文译文由维护者自己写进 `i18n/en.json`，不要留空，否则 `i18n-translate` 会把空项发给 DeepSeek。

## 量子算法（/quantum/algorithms/）

内容在 `public/quantum/algorithms/qa-data.js`（中英两版并排写，页面按站点语言取用，不经过 i18n），演示的数学在 `qa-models.js`（纯函数，态矢量模拟器、Grover、相位估计、Trotter、VQE、Shor 的经典部分），`qa.js` 只管画。

- **改了内容或数学：** `node --test tools/quantum-algorithms-test.mjs`（对照解析解：QFT 等于 DFT、Grover 闭式解、QPE 的 4/π² 下界、Trotter 一阶和二阶的收敛阶、VQE 收敛到精确基态；并检查每条内容都有中英文、证据等级、文献和公式）。
- **加文献：** 照原样写进 `refs`，运行 `node tools/quantum-algorithms-refs.mjs`（DOI 走 OpenAlex，加 `--crossref` 改问 Crossref；arXiv 编号走 arXiv 接口）。只有网址的条目要手动核对。
- **加公式：** 在 `math` 里写 LaTeX（不要夹中文，英文页也会显示），运行 `node tools/fundamental-math.mjs quantum` 生成 `qa-math.js`。
- **加视频：** 先把视频加进教学视频栏目（`videos-data.js`，那里有核对流程），再在 `qa-data.js` 的 `videos` 里按 id 引用。

## 量子生物学栏目（/quantum/biology/，在量子嘉年华下）

写法和基础科学栏目一样：内容全部在 `public/quantum/biology/qb-data.js`（`T(中文, English)` 并排），演示的数学在 `qb-models.js`（纯函数），页面在 `qb.js`，版式直接用 `../fundamental-science/fundamental.css`，只有本栏目独有的部分写在 `qb.css`。

- **四种状态不同于基础科学栏目：** `established` 已确立、`active` 活跃研究、`contested` 存在争议、`hypothesis` 推测性假说。这个领域被媒体放大的说法多，有争议的结论要同时写出支持和反对的实验（证据账本 `ledger`）。
- **加文献：** 先在 Crossref 查到 DOI，照原样写进 `refs`，再运行 `NODE_USE_SYSTEM_CA=1 node tools/fundamental-refs.mjs quantum-biology` 核对。云端会话连不上 api.crossref.org 时，可以在站长电脑上跑，或逐条打开 `https://api.crossref.org/works/<DOI>` 对照。除综述（`area: 'review'`）外，每篇文献都要被某一节引用，测试会检查。
- **加公式：** 写进 `math`，运行 `node tools/fundamental-math.mjs`（三个栏目一起生成），结果在 `qb-math.js`。
- **测试：** `node --test tools/quantum-bio-test.mjs`（FMO 效率的线性方程解对照时间演化、自由基对产率的本征公式对照时间积分、Bell 隧穿对照解析式，以及内容完整性）；浏览器检查是 `node tools/e2e/run.mjs "quantum biology"`。演示数值改了，`run.mjs` 和 `live.mjs` 里写死的数（99.02 %、0.4371、16.3）也要跟着改。

## 游乐场（/qchem/）

- **六个小游戏** 在 `public/qchem/play.js`，物理是 `play-models.js` 里的纯函数。改了物理就跑 `node --test tools/play-test.mjs`（对照已知结果：苯的离域能 2β、Hα 656.47 nm、Cr/Cu 例外、T + R = 1 等），它也读 `play.js` 里的 `MISSIONS`，确认每个隧穿关卡在滑块上能过关、开局不是已过关。
- **第 15 个（二维波包画墙）** 在 `play-wave2d.js`，数学在 `play-wave2d-models.js`：128×128 网格上的分裂算符法（ħ = m = 1，dt = 0.25，自己写的基 2 FFT），边上 12 格是吸收层，波包碰到边不会反弹。墙高 V = 5：再高的话 e^(−iV·dt) 的相位会绕回来，墙反而变“透明”；薄墙在网格上会漏一点（两格厚约 2×10⁻³），页面上写了。改了网格或步长要重跑 `node --test tools/play-test.mjs`（幺正到 1e-12、自由波包的 ⟨x⟩ 和 σ(t)、双缝条纹间距 λL/d、势垒透射、每关的参考解都能拿三星），再在 4 倍 CPU 减速下看帧率（2026-11-10：每步 6.1 ms，约 43 帧）。
- **界面文字** 写中文，照常 `i18n-extract`（`qchem/play.js` 已在列表里）后在 `i18n/en.json` 手写英文；画在 canvas 上的文字用 `ChemI18n.t`，也要有词条。元素名、环名、谱系名按站点语言直接取用（`translate="no"`），不走词典。
- **成绩** 只存在浏览器的 `molastria-play` 里。
- **计算器** 仍按“刷新数据”里的方式从 qchem-web 复制；它在“量子化学计算器”标签里，`#lab` 打开，其他未知的 `#…` 原样交给它。

## 云同步（学习记录和收藏）

登录后在账号页 `#sync-card` 打开，只对打开的那台设备生效（本机 `molastria-sync = on`）。同步哪些存档写在 `public/sync/sync-core.js` 的 `KEYS`（键名、用到它的页面、中英文名字）；合并规则和一轮同步（`syncOnce`）也在那里，`public/sync/sync.js` 只管什么时候同步、提示刷新和状态。服务端是账号服务的 `GET / POST / DELETE /sync`，表 `sync_items`。

- **加一份要同步的存档：** 在 `KEYS` 里加一行；`pages` 写所有一打开就把它读进内存的页面（地址前缀），同步在这些页面下面改了存档时会提示刷新，页面没刷新前写回的内容按它打开时读到的样子合并。不要加登录令牌、API key、AI 对话、显示设置。改完更新 `pro/privacy.html` 的“云同步”一段和账号页的说明（列表是自动画的），跑 `node --test tools/sync-test.mjs`。
- **合并规则：** 三方合并（上次对上云端的样子 / 本机 / 云端）。对象按字段、带 `id` 的数组按 id、其他数组当集合；一边删了另一边没动就删，一边删了另一边改了就留下改过的；同一个值两边改得不一样，本机优先。存档的格式变了（比如 `v` 升级）也照样能合并，但两边版本不同时会按字段混在一起，页面自己的读取函数要能清洗。
- **空间：** `wrangler.toml` 的 `SYNC_FREE_KB`（免费账号，0 表示只给 Pro）和 `SYNC_PRO_KB`。一份存档最大约 1.5 MB（D1 一行上限 2 MB），一次请求最多约 3 MB；Worker 不解析存档内容（10 ms CPU）。
- **看用量：** `npx wrangler d1 execute molastria --remote --command "SELECT COUNT(DISTINCT email) AS people, SUM(size) AS bytes FROM sync_items"`。
- **用户要删数据：** 账号页的“删除云端副本”就是 `DELETE /sync`；站长手动删：`DELETE FROM sync_items WHERE email = '…'`。其他还开着同步的设备下次会把本机的再传上来，要先在那些设备上关掉。
- **测试：** `node --test tools/sync-test.mjs`（合并、两三台设备对着假服务）、`deno run --allow-read tools/account-test.ts`（真的 /sync 接口）、`node tools/e2e/run.mjs "cloud sync"`（两个浏览器同一个账号）。

## 讨论室（/chat/）

多人实时聊天。页面是 `public/chat/`（`chat-core.js` 纯逻辑、`chat.js` 界面），首页的入口是 `public/chat/chat-card.{js,css}`；服务端是账号服务里的 `deploy/chat.js`：Worker 认出是谁（D1 的 `chat_users` 表把邮箱对成随机代号），再把 WebSocket 交给 Durable Object `ChatHub`，房间、消息、昵称、举报都存在它自己的 SQLite 里。帧的格式和报错代号写在 `deploy/chat.js` 开头的注释里。

- **第一次上线（站长在自己电脑上）：** 顺序是先账号服务，再网站。在 PowerShell 里：
  1. `cd D:\ChemDraw\ChemResearchHub`，`git fetch origin`，然后 `git checkout origin/claude/project-thread-odxxto`（PR 还没合并时用它的分支；已经合并了就 `git checkout main` 再 `git pull`）。
  2. `cd deploy`，依次运行 `npm.cmd ci`、`npx.cmd wrangler d1 execute molastria --remote --file schema.sql`（建 `chat_users` 表，可重复执行）、`npx.cmd wrangler deploy`。第一次部署会带上 `wrangler.toml` 里的 `[[migrations]]`（建 `ChatHub` 这个类），输出里应该能看到 Durable Object 的绑定 `CHAT`。
  3. 等几分钟（见“已知的坑”：部署后线上可能还有几分钟是旧代码），浏览器打开 `https://api.molastria.com/chat/summary`，看到 `{"state":"on","online":0,"rooms":7,…}` 就对了。
  4. 合并网站的 PR，等 GitHub Actions 发布完，打开 molastria.com 首页看卡片，再进 `/chat/` 用站长邮箱登录、起昵称、发一条。之后 `git checkout main`、`git pull` 回到主分支。
  顺序反了（先合并网站）也不会坏：账号服务还没有讨论室时，首页的卡片和小入口自己收起，讨论室页显示连不上，部署完就好。
- **站长怎么管：** 用站长的邮箱（`grants` 表里的）登录后打开讨论室，房间列表里多一个“管理面板”，有待处理的举报时带数字。面板里每条举报可以“保留”（恢复显示，以后不再自动隐藏）、“删除”、“删除并禁言 1 天”或“封禁”（封禁并删除），下面列着被禁言和封禁的人，可以解除。任何一条消息的“…”菜单里，站长多出：删除、禁言 1 小时 / 1 天 / 7 天、封禁、删除此人的全部消息。站长的名字旁边有“站长”标记，不受房间数、屏蔽词、保留昵称、连接数上限和只读状态的限制（发言频率和别人一样），能关闭或移除任何房间。一条消息被 3 个不同的人举报会先自动隐藏。有举报没处理时账号服务给站长的邮箱发一封提醒，12 小时最多一封（`CHAT_REPORT_MAIL = "0"` 关掉）。
- **总开关：** `deploy/wrangler.toml` 的 `CHAT_STATE`：`on` 正常；`readonly` 所有人照样能看、只有站长能发言（出事时先用这个）；`off` 整个关掉，连接被拒绝，首页的卡片和入口自动收起。改完 `npx.cmd wrangler deploy`。消息都还在，改回 `on` 就恢复。
- **其他设置（都在 `wrangler.toml`，改完部署）：** `CHAT_BLOCK` 屏蔽词（逗号分隔，消息、昵称、房间名里出现就拒绝）；`CHAT_ROOMS_PER_USER` 每人同时开着几个房间（`"0"` 不让用户开）；`CHAT_USER_ROOMS` 全站用户房间总数；`CHAT_MAX_SOCKETS` 同时在线的连接数。发言长度、频率这些数字是 `deploy/chat.js` 开头的常量，页面这边 `public/chat/chat-core.js` 有同一套（`tools/chat-core-test.mjs` 对照两边）。
- **加一个官方房间：** 在 `deploy/chat.js` 的 `OFFICIAL` 里加一行（代号、中英名字、中英话题；顺序就是页面上的顺序），部署账号服务后它自己建出来；再在 `public/index.html` 的 `#cc-rooms` 里加一个链接，把 `public/chat/chat-card.js` 的 `OFFICIAL` 改成新的数目，改 `tools/chat-workerd-test.mjs` 和 `tools/e2e/run.mjs` 里列出房间的地方。从 `OFFICIAL` 里拿掉一行不会删房间和消息。
- **从代号找到邮箱（处理严重的滥用或法律要求时）：** 每个账号在讨论室里是一个 12 位的随机代号；站长点一条消息的“…”，菜单最上面那一行（名字 · 时间 · 代号）里有它，管理面板的名单里也有。`npx.cmd wrangler d1 execute molastria --remote --command "SELECT email FROM chat_users WHERE uid = '代号'"`。结果里有邮箱，不要贴到公开的地方。
- **用户要求删除数据：** 他自己在讨论室左下角“我的设置”里点“删除我的全部发言和昵称”就行；站长代办：在他任意一条消息的“…”菜单里点“删除此人的全部消息”。要连代号一起断开：`DELETE FROM chat_users WHERE email = '…'`（下次登录会拿到新代号）。
- **看用量：** Cloudflare 控制台 → Workers & Pages → `molastria-account` → Durable Objects，看请求数、时长和存储。免费套餐每天 10 万次请求（收到的 WebSocket 帧 20 条算 1 次）、写 10 万行；接近时先把 `CHAT_MAX_SOCKETS` 调小或者开 `readonly`。
- **有人刷屏、刷连接：** 先 `CHAT_STATE = "readonly"` 或 `"off"` 再部署；只是一个地址在刷连接时，在 Cloudflare 控制台 → Security → WAF → Rate limiting rules 给 `api.molastria.com/chat/ws` 加一条按 IP 的限速（服务端自己挡不住已经连上的连接继续发帧，见 `docs/DECISIONS.md`）。
- **备份：** 讨论室的消息在 Durable Object 自己的库里，**不在** D1 的备份里（“备份”一节的命令导不出它），这次也没做导出功能。D1 里只有 `chat_users`（邮箱和代号），随 D1 一起备份。
- **测试：** `node --test tools/chat-test.mjs tools/chat-core-test.mjs`（服务端的全部规则、页面的纯逻辑）、`deno run --allow-read tools/account-test.ts`（Worker 这一侧：认人、连接数限制、摘要、举报邮件）、`node tools/chat-workerd-test.mjs`（真的 workerd，要先 `npm ci --prefix deploy`）、`node tools/e2e/run.mjs chat`（两个浏览器对聊、举报和处理、英文和手机、首页卡片）。本地预览：`tools/account-local.ts` 自带讨论室（`tools/chat-local.ts`，数据在内存里）。

## 研习台（/learn/）

AI 家教，全部在浏览器里：`learn-core.js` 是纯逻辑，`learn-sources.js` 是站内内容和演示白名单，`learn-graph.js` 画 SVG，`learn.js` 是界面。决定见 `docs/DECISIONS.md` 2026-11-10（只有那一条可以写出借鉴的开源项目的名字，别处不要写）。

- **提示词** 在 `learn-core.js` 的 `DEFAULT_PROMPTS`（摸底、路线、一步一检、单题评分、练习出题、练习评分、提取笔记、总结），发出去的系统消息第一行由构造函数自动加上 `TASK: <名字>`（e2e 的假 AI 靠它分辨请求；访客改的提示词里写不写都一样）。每段最后写明要的 JSON 形状，改了形状要同时改对应的 `parse…` 校验函数和 `tools/learn-test.mjs`。访客在数据页改过的提示词存在本机 `molastria-learn-prompts`，不受默认值更新影响（数据页有“恢复默认”）。
- **加一个内容来源：** 在 `learn-sources.js` 的 `SOURCES` 加一项（页面、数据文件、全局变量名、章节锚点前缀），在 `ADAPT` 里写同名的改写函数，把一章变成纯文本；再在那个栏目的渲染脚本里加“用研习台学”的链接（`../../learn/index.html#goal=<来源>:<章 id>`，相对路径按页面深度写）。`tools/learn-sources-test.mjs` 会在 node 里加载每个数据文件，检查每个来源都有章节、中英文都不空。
- **加一个站内演示：** 在 `learn-sources.js` 的 `DEMOS` 加一条（id、相对站点根的地址、中英文名称和一句话说明、关键词）。锚点必须是那个页面的代码真的会处理的（`#play-…`、`#d-…`、`id="demo-…"` 等），测试会查文件和锚点都在。模型只能返回白名单里的 id。
- **界面文字** 在 `learn.js` 里用 `L(中文, English)` 成对写，不经过词典；只有 `index.html` 里的几句和 `learn-core.js` 校验报错（`bad('…')`）由 `i18n-extract` 抽取，要在 `i18n/en.json` 手写英文。
- **测试：** `node --test tools/learn-test.mjs tools/learn-sources-test.mjs`；浏览器检查 `node tools/e2e/run.mjs "study desk"`（假的 DeepSeek，按 `TASK:` 返回固定 JSON：摸底、路线、一步一检带一次补讲、总结、练习、知识图删除、导出再导入、改提示词，最后英文页手机宽度不留中文）。真实服务商的效果只能手动试，见 ROADMAP。

## 开源代码台（/code/）

全部在浏览器里：`code-core.js` 是纯逻辑（输入生成、输出解读、多帧 XYZ、许可证、搜索链接），`code.js` 是界面，`code-demos.js` 是“试一段示例”的四段输出，从 SMILES 生成坐标在 `public/viewer/smiles3d.js`。决定见 `docs/DECISIONS.md` 2026-11-10 的两条。

- **测试：** `node --test tools/code-test.mjs`。SMILES 那几项要 `npm ci --prefix tools/e2e`（装 openchemlib，没装就跳过）；本机有 PySCF、`nwchem`、`cp2k.psmp`（或设 `CP2K_EXE=` 指到可执行文件）时，生成的输入会真跑一遍、对照参考能量，`CODE_SKIP_PYTHON=1` 全部跳过。CI 只装 PySCF。浏览器检查 `node tools/e2e/run.mjs "code desk"`（OpenChemLib 从 `tools/e2e/node_modules` 送给页面，不连 jsDelivr）和 `"models page: a result goes"`（模型接口送结构过来）。
- **加一个输出读法：** 在 `code-core.js` 的 `detect()` 加识别、`PARSE` 加同名函数（只填 `energy`、`energyLabel`、收敛、`gap` / `gapNote`、`freqs`、`normal`、`errorText`，别的不要），`PROGRAMS`、`index.html` 的 `#out-prog` 和 `code.js` 的 `NAMES` 各加一项；拿真实输出摘一段放进 `tools/code-fixtures/`（只留要读的行和前后几行，数字不改），在 `tools/code-test.mjs` 的 `OUTS` 表里加一行，并在那里的 README 写清来源。除了普通的单点和优化，还要拿**数值差分**（有限差分频率、数值梯度优化）和**一个文件里好几个任务**的输出试一次：这两种文件里最后印出的能量常常不是这个结构的（2026-11-10 审查出的错，见 DECISIONS）。
- **代码台：重做输出样本（NWChem、CP2K）：** 云端会话里 `apt-get install -y nwchem`（Ubuntu 的包是 7.2.2）；CP2K 不在 apt 里，用 micromamba（2026-11-10 这样装成的）：`curl -L -o mm.tar.bz2 https://conda.anaconda.org/conda-forge/linux-64/micromamba-2.0.5-0.tar.bz2 && tar -xjf mm.tar.bz2 bin/micromamba`，再 `MAMBA_ROOT_PREFIX=$PWD/root ./bin/micromamba create -y -n cp2k -c conda-forge cp2k`，可执行文件在 `root/envs/cp2k/bin/cp2k.psmp`，基组和赝势是编译进去的路径，不用设 `CP2K_DATA_DIR`（注意这个环境自带的 python3 没有 PySCF，跑 `code-test.mjs` 时不要把它放在 PATH 前面，用 `CP2K_EXE`）。输入用代码台生成，`nwchem x.nw > x.out`、`cp2k.psmp -i x.inp -o x.out`；要失败的样本就把迭代或步数上限改小。conda-forge 的 CP2K 没有 tblite，GFN2-xTB 跑不了，会报 “Built without TBLITE”。
- **模型接口送结构：** `public/models/models.js` 的 `codeImport()` 把 `{xyz, frame, meta:[{charge, mult}], charge, mult, name, model, job}` 写进 localStorage 的 `molastria-code-import`，代码台读一次就删。服务器（`tools/uma-server/chemjobs.py`）改了某个任务的多帧顺序（尤其 `run_rxn` 的“每种分子一帧、按出现顺序去重”），这里要跟着改。
- **OpenChemLib 升级：** 改 `smiles3d.js` 的 `VERSION` 和 `tools/e2e/package.json` 里的版本（两处要一样），`npm install --prefix tools/e2e`，再跑上面两组测试；新版本至少要两周前发布的。

## 开放数据接口（/api/）

`public/api/v1/*.json` 是给程序读的，由 `tools/build-api.mjs` 从 `atlas/content.js`、`journals/journals-data.js`、`scimodels/scimodels-data.js`、`videos/videos-data.js` 和 `i18n/en.json` 生成。

- **改了这些数据之后：** `node tools/build-api.mjs`，再 `node --test tools/api-test.mjs`。忘了跑也不影响线上（发布时 CI 会重新生成），但本地预览和桌面版里是旧的。同一个脚本也生成 chemdb-agent 的 `catalog/resources.json`；目录变了要再跑 `python tools/pack-chemdb-agent.py` 更新下载包。
- **加一个数据集：** 在 `build-api.mjs` 里加一个函数并放进 `sets`，在 `api-test.mjs` 加检查。说明页的列表读自 `v1/index.json`，不用改页面。只放 MolAstria 自己整理和撰写的内容。
- **JS 库和嵌入卡片：** `public/api/v1/molastria.mjs` 和 `public/api/embed.js` 是手写的，不是生成的。库的结果形状（`dataset, id, title, subtitle, summary, url, page, item, score`）和 `embed.js` 的 `data-*` 属性已经公开，别人的网页在用，改名等于破坏别人的页面；要改就加新的，旧的保留。新数据集要能被搜到，在 `molastria.mjs` 的 `SHAPE` 里加一项。
- **改字段：** 加字段随便加。删字段、改含义不要在 v1 里做：新建 `v2/`，v1 的文件保留。
- **上线后检查：** `curl -sI "https://molastria.com/api/v1/index.json?x=1" | grep -i access-control` 应有 `access-control-allow-origin: *`。

## 计算接口和 API key（api.molastria.com/v1）

给程序用的在线模型计算，在账号服务里（`deploy/account-worker.js` 的 `v1()` 和 `/keys`），说明页是 `/api/#compute`（`public/api/compute.js`）。链路和网站的在线模型相同，只是身份换成 key：程序 → `api.molastria.com/v1/*`（查 key、不查来源网站）→ 同一个 `uma()` → Cloudflare Tunnel → 站长电脑。

- **key 在哪：** D1 的 `api_keys` 表，只有 SHA-256 和开头 10 个字符。谁也查不出原文，用户丢了只能撤销重发。
- **看有没有人用：** `npx wrangler d1 execute molastria --remote --command "SELECT COUNT(*) AS n, COUNT(last_used) AS used, MAX(last_used) AS latest FROM api_keys"`（不要把带邮箱的查询结果贴到仓库或聊天里）。
- **撤掉某个 key：** 用户自己在账号页撤销。站长要强制撤销时让用户自己运行：`npx wrangler d1 execute molastria --remote --command "DELETE FROM api_keys WHERE prefix = 'mola_xxxxx'"`。
- **接口的总量：** `wrangler.toml` 的 `API_DAILY_TOTAL`（所有 key 合起来每天的次数，默认 2000）。嫌多嫌少改这个数再部署。
- **电脑被接口占满时：** 把 `wrangler.toml` 的 `API_COMPUTE` 改成 `"0"` 再 `npx wrangler deploy`，`/v1` 全部返回 503，网站自己的在线模型照常。恢复时改回 `"1"`。
- **加一个在线模型或一种计算：** 账号服务的 `UMA_MODELS` 里 tier 是 `fair` 的模型自动出现在 `/v1/models`，`asl` 的永远不会。说明页 `compute.js` 的 `JOBS` 和模型列表要跟着改，`tools/account-test.ts` 会对照两边（对不上就失败）。
- **改接口：** 和开放数据接口一样，v1 只加字段。已经公开的：五个路径（`/status`、`/me`、`/models`、`/jobs`、`/jobs/{id}`）、`usage` 和 `cost` 字段、`X-RateLimit-*` 响应头、错误的 `code` 值、`/v1/status` 的 `online` / `checked` / `uptime`。
- **用量记录：** D1 的 `api_jobs` 表，每次用 key 提交一行（key 的编号、模型、计算种类、花费、时间），不存分子，留 30 天（每天第一次探测时清理）。账号页“今天的用量”读的就是它。看最近一周哪些模型被用得多：`npx wrangler d1 execute molastria --remote --command "SELECT model, job, COUNT(*) AS n, SUM(cost) AS uses FROM api_jobs WHERE created > unixepoch() - 604800 GROUP BY model, job ORDER BY uses DESC"`（这条不带邮箱，可以贴出来）。
- **在线率：** 每 15 分钟的定时任务顺带探测一次站长电脑，累加进 `status` 表的 `uptime` 一行（每天“在线几次 / 探测几次”，留 35 天）。`curl -s https://api.molastria.com/v1/status` 看结果：`online` 是最近一次探测，超过 45 分钟没有探测时是 `null`。清零重来：`npx wrangler d1 execute molastria --remote --command "DELETE FROM status WHERE name = 'uptime'"`。没有配置 `UMA_ORIGIN` 时不探测、不记录。
- **Python 客户端：** `public/api/v1/molastria.py` 是手写的，不是生成的；改了跑 `python3 tools/molastria-py-test.py`（起一个假的服务对着测，不联网）。公开的名字只加不改；改了行为就升 `__version__`，User-Agent 跟着变（`molastria-python/x.y.z`），上线后 `tools/e2e/live.mjs` 会确认 Cloudflare 没有拦它。
- **chemdb-agent 的计算工具：** `agent/chemdb-agent/src/chemdb_agent/adapters/molastria_compute.py` 和 `server.py` 里的 `run_calculation`、`get_calculation`、`compute_status`。改了跑 agent 的 pytest，再 `python tools/pack-chemdb-agent.py` 重新打包；模型和计算种类的名单由 `tools/account-test.ts` 和账号服务对照。
- **上线后检查：** `curl -s https://api.molastria.com/v1` 应返回说明；`node tools/e2e/live.mjs` 里有一条检查任何来源都能预检、没有 key 是 401，另一条检查 `/v1/status`、`molastria.py` 能下载、它的 User-Agent 没有被拦。带真实 key 的提交要站长自己试（`/api/#compute` 的“带上 key 试一次”）。

## 教学视频（/videos/）

全部条目在 `public/videos/videos-data.js`，一行一条：`p`（`yt` / `bili`）、`k`（`video`、`playlist`、`multipart`）、`id`、标题和频道（照平台原文）、`topic`、`lang`（讲课语言）、`subs`（另加的字幕）、`level`、`official`、`reupload`、`sw`、`note`（中英两版，MolAstria 写的）。文件开头有字段说明。

- **封面：** 不进 git。`pages.yml` 发布前、`desktop.yml` 打包前运行 `node tools/video-thumbs.mjs`（发布时加 `--check`），下载到 `public/videos/thumbs/`；视频没了或不让嵌入，只在 Actions 日志里出 `::warning::`，不会让发布失败。看到警告就把那条删掉或改 `embed: false`。本地预览没有封面时，页面先用平台的图片地址，再画占位图。
- **加视频：** 在 YouTube 或哔哩哔哩核对标题、频道和能否嵌入（YouTube oEmbed 返回 401 就是不让嵌入，写 `embed: false`），照格式加一行，写中英两句说明，跑 `node tools/e2e/run.mjs videos`。只收教东西的课程、讲座和教程；不收中学化学、广告和培训班引流、破解安装、付费视频；转载只收开放许可的课程（MIT OCW、Yale、NPTEL），标 `reupload`。
- **批量找候选：** `node tools/video-search.mjs yt search [主题 id]` 和 `bili search`，查询词在 `tools/video-queries.json`，结果写到 `tmp-videos/`（不进 git），附平台上的标题、简介、时长、分集、能否嵌入。`yt verify` / `bili verify` 逐条重查数据文件里的视频。要在能上 YouTube 和哔哩哔哩的机器上跑；云端会话上不去时，临时加一个在分支上 push 触发的工作流跑它、把 `tmp-videos/` 提交回分支（2026-11-08 就是这样做的，合并前删掉工作流和结果）。
- **桌面版** 不嵌入播放器，点封面在系统浏览器里打开原视频（WebView 里嵌入 YouTube 常被拒绝）。

### 自己做教学和宣传视频（Manim、Molecular Nodes）

这两个工具不进网站，只在站长电脑上用来做视频；做出来的视频按上面的流程上传到 YouTube 或哔哩哔哩，再像别的视频一样加进 `videos-data.js`。

- **公式和几何动画用 Manim。** 有两个版本：3Blue1Brown 自己用的 `3b1b/manim` 和社区维护的 `ManimCommunity/manim`（都是 MIT 许可）。用社区版，文档和安装说明更全（`pip install manim`，写 `MathTex` 公式还要装 LaTeX）。脚本放在仓库外，或者放进 `tools/` 下单独的目录并写清楚怎么渲染；渲染出的视频不进 git（太大），只放平台链接。
- **蛋白和分子动画用 Molecular Nodes。** 它是 Blender 的插件（`BradyAJohnston/MolecularNodes`，GPL-3.0），能把 PDB / mmCIF 结构和分子动力学轨迹读进 Blender，用几何节点上色、做镜头动画。量子生物学结构馆里的六个 PDB 结构（隐花色素、光合复合体等，见 `qb-data.js` 的 `structures`）可以直接拿来做。插件是 GPL，但按 GNU 的 GPL 常见问答，程序的输出不受 GPL 约束（除非输出里含有程序自己的代码），渲染出来的视频可以照常发布；不要把插件的代码复制进本仓库。
- **两个都别塞进网页。** 网页里的动画照旧手写 SVG / canvas，转分子用 `public/viewer/mol3d.js`（3Dmol.js）。

## 刷新数据

训练页的模型核对：`node tools/train-models.mjs`（每周四随目录刷新自动跑；本机有 HTTPS 扫描时加 `NODE_USE_SYSTEM_CA=1`）。它只更新 `public/train/models-live.js`，手写的模型介绍要人来改。

- **ChemRxiv：** `deno run --allow-net --allow-read --allow-write tools/hub-chemrxiv.ts`，可重复运行，只替换 ChemRxiv 条目。新增文字后走一遍翻译。
- **每周自动刷新：** `.github/workflows/refresh-data.yml` 每周四 13:00（UTC）跑一遍，结果自动提交并发布。马上要刷新就运行 `gh workflow run refresh-data.yml`。某个来源抓取失败时沿用上周的条目（来源状态记为 `cache`，页面卡片显示“本次失败，保留上次缓存”）；`tools/check-catalogue.mjs` 发现条目减少超过 15%、某个来源为空、上次有的来源这次没了、`hub/data.js` 超过 1.6 MB 或 `merged-data.js` 超过 3.2 MB 时拒绝提交，到 Actions 日志里看是哪个来源出了问题。
- **在本机刷新：** 用 Python 3.12 虚拟环境装好 `maintenance/requirements.txt`，先跑维护脚本的单元测试 `python -m unittest discover -s maintenance -p "test_*.py"`（离线，不联网；每周的工作流也先跑它），再运行 `python -X utf8 maintenance/refresh_data.py`，然后运行 `hub-chemrxiv.ts` 和 `node tools/check-catalogue.mjs`。
- **ChemDB Atlas 目录（`public/atlas/content.js`）：** 人工整理，可以手改；加条目前用浏览器 UA 检查链接，改完同步 `public/atlas/downloads/resources.{json,csv}` 和页面上写死的条数、类别数（`atlas/index.html`、`index.html`），再依次运行 `python -X utf8 maintenance/merge_data.py`、`hub-chemrxiv.ts`（`merge_data.py` 给 ChemRxiv 条目算的 id 和它不同，不重跑会换掉这 50 条的 id）和 `node tools/check-catalogue.mjs`。手册加章时还要改写死的章数（`index.html`、`manual/index.html`、`hub/network.html`、`hub/net-engine.js`、`pro/index.html`、`download/index.html`、`tools/bundle-single.ts`、`tools/og.html`）。
- **其余目录快照（旧说明）：** `maintenance/` 的 Python 脚本。重新生成后要再跑一次 `hub-chemrxiv.ts`，否则 ChemRxiv 条目会丢。
- **预印本雷达：** 先在 `D:\ChemDraw\PreprintRadar` 运行 `deno task web`，再回到这里运行 `deno run --allow-read --allow-write tools/vendor-radar.ts`，然后走一遍翻译。
- **研究图谱：** 先在 university-science-research-network 仓库运行 `./build_site.sh`，再回到这里运行 `node tools/vendor-atlas.mjs [那个仓库的路径]`（默认同级目录），然后跑 `node tools/e2e/run.mjs "research atlas"`。图谱的英文在那个仓库的 `i18n/en.json`，改了图谱界面文字要在那里补译文（e2e 会检查英文首页不剩中文），本站不用走翻译；外层页面 `public/research-atlas/index.html` 的说明文字是隐藏的，也不进词典。桌面版不打包 `app/`（约 100 MB 的网络数据，`desktop/stage-web.mjs` 的 `LEAVE_OUT`），应用里的外层页面直接框住网站上的那一份。**自动上线：** 图谱仓库 main 一有新提交（新学校、修改，或 1–4 日每月重抓 OpenAlex），本站 `.github/workflows/atlas-sync.yml` 每 3 小时检查一次，发现图谱的提交和 `public/research-atlas/app/VERSION.txt` 不同就复制、跑研究图谱的 e2e、提交并重新部署，相同就立刻结束；桌面版框的是线上那一份，不用发新版。手动跑：Actions → Research atlas sync → Run workflow（手动跑不管有没有新提交都会复制一次）。
- **量子化学计算：** 先在 qchem-web 仓库运行 `python3 tools/build.py`（它的测试是 `node tests/run_all.js`），再回到这里运行 `deno run --allow-read --allow-write --allow-run=git tools/vendor-qchem.ts [qchem-web 的路径]`，默认找同级目录 `../qchem-web`。它自带中英文词典，复制后不用走翻译；只有外层页面 `public/qchem/index.html` 的文字改了才要走。
- **chemdb-agent 下载包：** 源码在 `agent/chemdb-agent/`。改完先在那里跑离线测试（`uv sync` 后 `uv run python -m pytest`，或 venv 里 `pip install -e . pytest vcrpy` 后 `python -m pytest`；联网冒烟测试加 `CHEMDB_LIVE=1`），再回到仓库根目录运行 `python tools/pack-chemdb-agent.py`，重新生成 `public/atlas/downloads/chemdb-agent.zip`。同样的源码打出同样的 zip；脚本发现 .env、缓存、本机路径或 token 时会中止，不要手放 zip。
- **训练 Agent 页的模型表：** 模型信息要对照 Hugging Face（`huggingface.co/api/models/<id>?expand[]=safetensors`）和模型卡核实。刷新时要按作者加 `sort=createdAt` 逐家查最新的仓库，不能只查已知的系列名，否则会漏掉刚发布的新系列（发生过）。
- **科学大模型的价格（`public/scimodels/scimodels-data.js` 的 `prices`）：** 每月核对一次，已知的变动日期过后马上核对。逐行打开 `src` 指向的官方价格页读原文（多数是脚本渲染的，用浏览器看），只改官方写明的每百万 token 标准价（`in` / `out`）和 `note`；没有官方按 token 价格的不进图，不要用第三方聚合价。人民币行：`rate.cny` 换成核对当天中国外汇交易中心公布的人民币兑美元汇率中间价（`chinamoney.com.cn` 的人民币汇率中间价页），同时改 `rate.date`；最后改 `prices.checked`。模型卡片的链接和事实另有 `checked`（文件开头），重核链接时一起改。改完跑 `node tools/e2e/run.mjs scimodels`。已知的变动：
  - Gemini 4 Argon：2026-12-01 起从 2 / 10 美元涨到 4 / 20 美元。到期后改 `in` / `out`，并改掉说明里“此价格到 2026-11-30”那句。
  - Hydrogen-1.0：现在是 NeuroSpark 的发布价（Launch Price），核对时看是否已换成正式价格。
  - Kimi：K2 系列 2026-10-31 起不再向新用户开放，年底下线；图里只有 K3.1 Pro，K2 下线后改掉它说明里提到 K2 的那句。Kimi 出了在售的小型模型就补一行。
- **站内数字：** 数据量大变时，检查写死的“1,600 多条”（`public/ai/ai.js`、`public/pro/index.html`）和 atlas 页的条数、类别数。

## 在线模型：站长电脑的 GPU，对所有访客开放（UMA、OMol25、MACE、ANI-2x）

链路：访客 → `api.molastria.com/uma/*`（账号服务：检查来源网站、决定谁能用哪个模型、按访客每天限次、挡住受全面制裁的地区、加上共享暗号）→ Cloudflare Tunnel → 站长电脑上的 `tools/uma-server/server.py`（只监听 127.0.0.1，只认带暗号的请求，每个模型一次只给一个人算，每人同时只能有一个任务，算过的分子按规范 SMILES 缓存）。电脑关着时 Meta 页显示“站长的 GPU 现在离线”。

**20 个在线模型**（Meta 页“在线运行”面板；`server.py` 的 `MODELS`、账号服务的 `UMA_MODELS`、`meta.js` 的 `ONLINE` 三处要一致）：

| 模型 | 任务 | 谁能用 | 许可 |
| --- | --- | --- | --- |
| UMA-S 1.2.1、1.2、1.2.1 D4rev | IP/EA、几何优化 | 所有人 | FAIR Chemistry License |
| AllScAIP-md 能量守恒型、直接受力型（OMol25） | IP/EA、几何优化 | 所有人 | FAIR Chemistry License |
| UMA-S 1.1，eSEN-sm 能量守恒型、eSEN-sm / eSEN-md 直接受力型（OMol25） | 只算中性分子的几何优化 | 所有人 | FAIR Chemistry License |
| MACE-OFF23 small / medium / large，MACE-OMOL-0（中性） | 几何优化 | 所有人，勾选学术用途 | ASL（学术、非商业） |
| MACE-MDP | 偶极矩与极化率（结构用 MACE-OFF23 medium 优化） | 所有人，勾选学术用途 | ASL |
| ANI-2x | 中性分子的几何优化 | 只有 Pro | MIT |
| GFN2-xTB、GFN2-xTB + ALPB 水、GFN1-xTB | 几何优化、频率、构象、扫描、MD 等（可以带电荷和自旋，不开放 IP/EA） | 所有人 | LGPL-3.0（xtb 程序） |
| GFN-FF | 同上，只算中性闭壳层 | 所有人 | LGPL-3.0 |
| OpenMM（Amber ff14SB + 隐式水） | 蛋白质分子动力学（按 PDB 编号，最多 300 个残基、100 ps） | 所有人 | MIT |

三条通道并行：fairchem 模型（UMA-S 1.2.1 常驻显存，另外最多留 2 个，其余按需加载）、ANI-2x、MACE 模型（`mace_worker.py`，一个 GPU 进程轮流算）。UMA-M 1.1 的权重 11 GB，这台电脑（15 GB 内存、8 GB 显存）装不下，没有上线。

**两个 Python 环境**（mace-torch 固定 e3nn 0.4.4，fairchem 要 0.5 以上，不能装在一起）：
- `D:\ChemDraw\uma-env`：fairchem-core、rdkit、`torchani==2.9.0`（2.9 兼容 torch 2.13，不会改动 torch）。
- `D:\ChemDraw\mace-env`：`pip install torch==2.13.0 --index-url https://download.pytorch.org/whl/cu126`，再装 mace-torch、rdkit。
- 权重：fairchem 的在 `%USERPROFILE%\.cache\fairchem`（Hugging Face 上 facebook/UMA 和 facebook/OMol25 都要申请访问；站长 WSL 里已有的是从 `~/.cache/fairchem/blobs` 按快照名复制过来的，WSL 的符号链接 Windows 读不到）；MACE 的五个文件在 `%USERPROFILE%\.cache\mace`；ANI-2x 由 TorchANI 第一次运行时下载。

**开通一次（按顺序）：**
1. UMA 环境里登录 Hugging Face：`D:\ChemDraw\uma-env\Scripts\python.exe -c "from huggingface_hub import login; login()"`（站长自己粘贴 token 或用浏览器登录）。
2. 装 Cloudflare Tunnel：`winget install --id Cloudflare.cloudflared`，然后 `cloudflared tunnel login`（浏览器里选 molastria.com）。
3. 建隧道和域名：`cloudflared tunnel create molastria-uma`，`cloudflared tunnel route dns molastria-uma uma-origin.molastria.com`，在 `%USERPROFILE%\.cloudflared\config.yml` 写：
   ```yaml
   tunnel: molastria-uma
   credentials-file: C:\Users\<你>\.cloudflared\<隧道 ID>.json
   ingress:
     - hostname: uma-origin.molastria.com
       service: http://127.0.0.1:8765
     - service: http_status:404
   ```
4. 生成共享暗号：`node tools/uma-server/new-secret.mjs`（写进 `tools/uma-server/secret.local`，同时用 `wrangler secret put UMA_SERVER_SECRET` 交给账号服务；屏幕上不显示）。
5. 在 `deploy/wrangler.toml` 的 `[vars]` 加 `UMA_ORIGIN = "https://uma-origin.molastria.com"`，部署账号服务（`/ship-worker`）。
6. **推荐：** Cloudflare Zero Trust → Access → 为 `uma-origin.molastria.com` 建一个 Self-hosted 应用，策略选 Service Auth，绑定一个 Service Token；把令牌的 ID 和 Secret 用 `wrangler secret put UMA_ACCESS_ID` / `UMA_ACCESS_SECRET` 交给账号服务。这样不是账号服务发来的请求在 Cloudflare 就被拦下，到不了电脑。

**每次上线：** 普通（非管理员）PowerShell 里运行 `powershell -ExecutionPolicy Bypass -File tools\uma-server\start.ps1 -Python D:\ChemDraw\uma-env\Scripts\python.exe -MacePython D:\ChemDraw\mace-env\Scripts\python.exe`（不给 `-MacePython` 时 MACE 模型不上线）。启动约 1 分钟；关掉这个窗口就同时下线服务和隧道。服务运行时设 `HF_HUB_OFFLINE=1`，不连 Hugging Face。

**登录后自动启动（装一次）：** 普通 PowerShell 里运行 `powershell -ExecutionPolicy Bypass -File tools\uma-server\autostart.ps1 -Install -Python D:\ChemDraw\uma-env\Scripts\python.exe -MacePython D:\ChemDraw\mace-env\Scripts\python.exe`。它只在你自己的“启动”文件夹里放一个快捷方式（不要管理员权限，不建计划任务或服务），以后每次登录 Windows 都会最小化启动 `start.ps1 -KeepAlive`：服务自己停了（崩溃、驱动重置）会在 5 秒到 2 分钟后重新启动，隧道没了也会重新拉起；两分钟内连续停五次就放弃（说明有要修的问题）。每次重启记在 `tools\uma-server\keepalive.log`（不进 git）。

- 看状态：`autostart.ps1 -Status`（装了没有、现在在不在跑、最近几次重启）。取消：`autostart.ps1 -Remove`（不会停掉正在跑的，关窗口才停）。
- 已经在跑时再运行 `start.ps1` 会直接退出（8765 端口有应答），不会起第二份。
- 是“登录后”启动，不是“开机后”：电脑重启后停在登录界面时模型是离线的。电脑睡眠时也离线，想一直在线就在电源设置里关掉睡眠。
- 仓库换了位置要重新 `-Install`（快捷方式里是绝对路径）。
- 在线了多久看 `https://api.molastria.com/v1/status` 或 `/api/#compute` 页上的 7 天记录。

**xTB（第五条通道，四个模型）：** 装一次 xtb 程序：`D:\ChemDraw\uma-env` 是 conda 环境时 `conda install -n uma-env -c conda-forge xtb`（装进 `Library\bin`，`server.py` 会自己找到）；否则从 grimme-lab/xtb 的 Releases 下载 Windows 包，解压后在 `start.ps1` 后面加 `-Xtb D:\ChemDraw\xtb\bin\xtb.exe`（或设用户环境变量 `MOLASTRIA_XTB`；装了自动启动的，`autostart.ps1 -Install` 时也加 `-Xtb` 重装一次）。找顺序：`--xtb`、`MOLASTRIA_XTB`、运行 server.py 的 Python 环境、PATH。启动日志里有 `xtb <版本>` 就是找到了；没找到时四个 xTB 模型显示离线，其他模型不受影响。测试：`python -X utf8 -m unittest tools/uma-server/test_xtb_backend.py -v`（有 xtb 时真算水）。xtb 用 CPU，每次调用 4 个线程（`xtb_backend.py` 的 `THREADS`）。

**OpenMM（第六条通道，蛋白质分子动力学）：** 在 uma-env 里装一次 `conda install -n uma-env -c conda-forge openmm pdbfixer`（或 `pip install openmm pdbfixer`；openmm 的 pip 包自带 CUDA 和 OpenCL 平台）。重启 `start.ps1` 后日志里有 `OpenMM <版本> on CUDA`（或 OpenCL）就是好了；平台不对时用 `--openmm-platform OpenCL` 指定。没装时 `openmm-amber14` 显示离线，其他模型不受影响。结构从 `files.rcsb.org` 下载（站长电脑要能上外网）。测试：`python -X utf8 -m unittest tools/uma-server/test_openmm_backend.py -v`（装了 openmm 时在 CPU 上真跑 1VII 3 ps，约 30 秒）。

**额度**（`wrangler.toml` 的 `[vars]`）：Meta 的 UMA、OMol25 模型和 ANI-2x 共用一份，匿名访客每天 `UMA_DAILY`（40）次、登录的免费账号 `UMA_DAILY_ACCOUNT`（100）次、Pro 支持者 `UMA_DAILY_PRO`（200）次；MACE 系列每位访客每天 `ASL_DAILY`（40）次，账号和 Pro 都不加（学术许可的模型不能变成付费功能）。被电脑拒绝的任务（已有任务在算、队列满、元素不支持）不计次数。改次数时要一起改 `account-worker.js` 里的默认值（`tools/account-test.ts` 会核对两边一致）、`models/index.html` 的“每日额度”表和价格页 `pro/index.html` 的“三档额度”表（`tools/e2e/run.mjs` 会核对价格页），再跑 `i18n-extract`、补 `i18n/en.json` 的英文、跑 `i18n-translate`，最后 `npx.cmd wrangler deploy`。

**电脑的安全：**
- 不开任何入站端口：服务只听 127.0.0.1，隧道是电脑主动连出去的，家里的 IP 不公开；Windows 防火墙保持默认开启。
- 只认暗号：没有 `X-MolAstria-Key` 的请求一律 401（用 `hmac.compare_digest` 比较）；暗号只在 `secret.local` 和账号服务的 secret 里，怀疑泄露就重跑 `new-secret.mjs` 并重启服务。
- 不执行外来内容：只接受 SMILES、模型（白名单）、任务（ipea / opt / polar）、电荷、自旋，账号服务先校验再转发，多余字段丢弃；请求体最大 8 KB；不读写访客给的文件或路径，不调用 shell；只加载官方发布的模型权重；MACE 进程只经标准输入输出收发 JSON。
- 每人一次一个任务：账号服务把访客的 IP（或 Pro 的邮箱）和暗号一起做 SHA-256，只把前 16 位交给电脑，电脑凭它拒绝同一访客的第二个任务。
- 防耗尽：最多 30 个重原子、120 个原子，优化最多 400 步，队列最多 25 个，空闲连接 15 秒断开；账号服务按访客限次、限查询频率。
- 不用管理员身份运行（`start.ps1` 会拒绝）；服务只写本文件夹里的缓存。
- 电脑看不到访客的 IP（请求都经过 Cloudflare 和账号服务）；缓存里只有提交的 SMILES 和结果。
- 许可：FAIR Chemistry License（UMA、eSEN、AllScAIP）要求遵守 Meta 的可接受使用政策和出口管制，所以页面写明禁止用途、结果不作保证、论文注明模型，账号服务挡住 CU、IR、KP、SY。MACE 的 ASL 只许学术、非商业用途：MACE 对所有人免费且次数相同，不进 Pro，每次提交都要勾选学术用途（账号服务检查 `academic: true`）。ANI-2x 是 MIT，可以放进 Pro。

**测试（不用 GPU）：** `server.py --fake` 返回标明 fake 的假数据（缓存单独放在 `cache.fake.local.json`），所有模型都算“已加载”；`tools/account-test.ts` 和 `tools/e2e/run.mjs` 里各有在线模型的检查。

**加一个在线模型：** 先在 GPU 上测：能加载、FEC 优化收敛，再在 ETKDG 结构上算苯、乙醇、水的垂直 IP（实验约 9.2 / 10.5 / 12.6 eV）。接近的才开放 IP/EA；偏差大（OMol-0 时期的模型常见）就只开放中性分子的几何优化（`charged: False`）。然后改 `server.py` 的 `MODELS`、`deploy/account-worker.js` 的 `UMA_MODELS`（新许可要想清楚放哪一档）、`public/meta/meta.js` 的 `ONLINE` 和 `index.html` 的选项、`tools/account-local.ts` 的假电脑；跑测试，部署账号服务，重启 `start.ps1`。

## 云端 GPU 批量计算（UMA + MACE-OFF23）

站长自己的谷歌云 L4 虚拟机，只给 AI 实验室跑批量计算，不对外服务：没有公网端口，全部经 `gcloud compute ssh` / `scp`。

**准备一次：**
- 本机装好 Google Cloud CLI 并登录（`gcloud auth login`）。
- 把 `tools/cloud/cloud.example.json` 复制成 `tools/cloud/cloud.local.json`，填项目、区、机器名（这个文件不进 git）。
- 虚拟机上：UMA 在 `/opt/uma/venv`（开机脚本装的 fairchem；缺 RDKit 时 `remote.sh` 自动补装）；MACE-OFF23 要在另一个装了 `mace-torch` 的 Python 里（两者的 e3nn 版本冲突），`remote.sh` 会自己找，找不到用 `MACE_PY=/路径/python` 指定。
- Hugging Face：第一次运行时如果虚拟机上没有登录，会在你的终端里提示粘贴 token（只存在虚拟机上）。token 由用户自己粘贴，不经过 Claude。

**每次：**
1. AI 实验室 → ⑥ 候选卡片 → 导出 CSV（或任何带 smiles 列的 CSV）。
2. `node tools/cloud/run.mjs chemhub-candidates.csv`：开机 → 上传 → UMA-S 算绝热 IP/EA、UMA-M 单点 → MACE-OFF23 复核中性结构 → 取回 → 关机。中途失败也会关机；虚拟机设了 2 小时自动停机兜底。
3. 把 `cloud-results/<时间>/results.csv` 拖进 AI 实验室 ③ 计算结果 → 导入结果。
   可加 `--limit 3` 先试几个，`--no-m` 跳过 UMA-M，`--keep` 算完不关机。同一个命令再跑一次会跳过已算完的分子。

**GPU 缺货（STOCKOUT）：** `run.mjs` 每 60 秒重试，默认 6 次。长期缺货就把机器搬到别的区（先问站长，会改动云资源）：给磁盘做快照 → 在新区用快照建磁盘 → 用同样的设置（一张 L4、`--max-run-duration=2h --instance-termination-action=STOP`）建机器 → 改 `cloud.local.json`。提供 L4 的区可以用 `gcloud compute accelerator-types list --filter="name=nvidia-l4"` 查。项目的 GPU 总配额是 1（`GPUS_ALL_REGIONS`），同一时间只能开一台 GPU 机器；关着的机器不占配额。2026-11-05 us-west4 的两个区和 us-central1、us-east1、us-east4 都没货或报错，搬到了 us-west1-c（快照 `uma-research-l4-20261105` 保留）。

**Windows 上的两个坑：** gcloud 在 Windows 用 PuTTY 的 pscp 传文件，它不认 `~/`，远程路径要写成相对家目录的（`实例名:molastria-batch/`）；在 Git Bash 里手动跑 `gcloud compute ssh --command="/opt/..."` 时，MSYS 会把 `/opt/...` 改成 Windows 路径，改用 PowerShell 跑（`run.mjs` 走 Windows 的 shell，不受影响）。

**不开云也能试：** `batch_uma.py` 和 `batch_mace.py` 在本机也能跑（各用各的环境，例如 `D:\ChemDraw\uma-env` 和 `D:\ChemDraw\mace-env`）。

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

```bash
npx.cmd wrangler secret put BRAVE_SEARCH_KEY
```

- **Stripe：** Developers → API keys → Create restricted key，只开 Customers、Checkout Sessions、Subscriptions 三项 Read。
- **Resend：** API Keys，Sending access。
- **DeepSeek：** platform.deepseek.com → API keys。
- **Brave Search：** api-dashboard.search.brave.com → API Keys（Pro 的网页搜索用）。
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
| 显示“会送达”但没收到 | 进了垃圾箱，或 Resend 当天超过 100 封（免费账号也收验证码，每周精选每天最多占 80 封；登录的人多了要升级 Resend） |
| AI 没走托管额度 | 浏览器里存了自己的 key；在 AI 设置选“MolAstria 托管”，或从账号页的按钮打开 |
| 托管 AI 报错 | DeepSeek 余额用完，或额度用完（Pro 按月，免费账号按 24 小时，`FREE_DAILY_ASKS`） |
| 一次提问扣了不止 1 次 | 正常：`deepseek-v4-pro` 按 3 倍计，AI 实验室一轮计 3 次，内容特别长时按长度多计（`ARCHITECTURE.md`） |
| 用户说被退出登录了 | 同一账号最多 5 台设备同时登录，超过时最早的那台会退出 |
| 退款或取消后还是 Pro | 账号服务最多 6 小时后才和 Stripe 同步 |
| 周一过后没有这一期 | 看 Observability 的定时任务记录；论文接口和 DeepSeek 都挂了才会没有。在账号页点“重新生成本期” |
| 订阅了但没收到每周精选 | 每 15 分钟只发 5 封，每天最多 80 封，人多时要等；再看垃圾箱和 Resend 控制台 |
| 解读是空的 | 模型失败或选出不足 3 篇，发的是不带解读的列表；可以重新生成 |
| wrangler 报 7403 | 偶发，重试 |
| wrangler 要注册 workers.dev 子域名 | `wrangler.toml` 顶层设置写到了 `[vars]` 后面。另外，定时任务要求账号有这个子域名：已注册 `molastria.workers.dev`，`workers_dev = false`，所以账号服务不在上面。换 Cloudflare 账号时要重新开，打开控制台的 Workers 页面会自动创建 |
| PowerShell 说禁止运行脚本 | 用 `npx.cmd` |
| Deno 报 `UnknownIssuer` | Norton 拦截 HTTPS，加 `DENO_TLS_CA_STORE=system` |
| 桌面版没提示更新 | 启动时才检查，要彻底退出再打开；用户点过“稍后”的话 3 天内不再提示 |
| 每周健康检查没运行 | 公开仓库 60 天没活动时 GitHub 会停掉定时任务，到 Actions 页重新启用 |

## 定期看一眼

- **每年：** Porkbun 域名续费（确认自动续费和银行卡）。
- **每月：** D1 备份；DeepSeek 余额；科学大模型的价格和汇率（见“刷新数据”）。
- **每周（自动）：** 健康检查失败时 GitHub 发邮件。
- **价格：** `ARCHITECTURE.md` 的费用表写了查询日期，隔一段时间核对一次。
