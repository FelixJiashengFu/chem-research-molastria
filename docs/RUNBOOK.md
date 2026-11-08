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

## 基础科学栏目（/fundamental-science/）

内容全部在 `public/fundamental-science/fs-data.js`，中英两版并排写（`T(中文, English)`），页面按站点语言取用，不经过 i18n 翻译。

- **每一条都要有研究状态：** `established` 已确立、`active` 活跃研究、`hypothesis` 理论假说、`proposed` 计划方向。计划方向和假说不能写成成果；`tools/fundamental-test.mjs` 会检查三条主线的状态都写着“计划方向”。
- **加文献：** 先在 Crossref（或 arXiv）查到 DOI，把题目、作者、年份、期刊、卷、页码照原样写进 `refs`，然后运行 `NODE_USE_SYSTEM_CA=1 node tools/fundamental-refs.mjs` 逐条核对；不核对的不要放上去。正文用 `refs` 的 id 引用。
- **加公式：** 在 `math` 里写 LaTeX，运行 `node tools/fundamental-math.mjs`（用 KaTeX 转成 MathML，写进 `fs-math.js`，需要联网一次），再跑 `node --test tools/fundamental-test.mjs`。页面用浏览器原生的 MathML 排版，不加载公式脚本，离线和桌面版里都能显示。
- **演示的数学** 在 `fs-models.js`（纯函数）；改动后让 `fundamental-test.mjs` 里的解析解对照通过。
- **界面文字**（标题、按钮、控件标签）写中文，照常 `i18n-extract`；英文译文由维护者自己写进 `i18n/en.json`，不要留空，否则 `i18n-translate` 会把空项发给 DeepSeek。

## 游乐场（/qchem/）

- **六个小游戏** 在 `public/qchem/play.js`，物理是 `play-models.js` 里的纯函数。改了物理就跑 `node --test tools/play-test.mjs`（对照已知结果：苯的离域能 2β、Hα 656.47 nm、Cr/Cu 例外、T + R = 1 等），它也读 `play.js` 里的 `MISSIONS`，确认每个隧穿关卡在滑块上能过关、开局不是已过关。
- **界面文字** 写中文，照常 `i18n-extract`（`qchem/play.js` 已在列表里）后在 `i18n/en.json` 手写英文；画在 canvas 上的文字用 `ChemI18n.t`，也要有词条。元素名、环名、谱系名按站点语言直接取用（`translate="no"`），不走词典。
- **成绩** 只存在浏览器的 `molastria-play` 里。
- **计算器** 仍按“刷新数据”里的方式从 qchem-web 复制；它在“量子化学计算器”标签里，`#lab` 打开，其他未知的 `#…` 原样交给它。

## 教学视频（/videos/）

全部条目在 `public/videos/videos-data.js`，一行一条：`p`（`yt` / `bili`）、`k`（`video`、`playlist`、`multipart`）、`id`、标题和频道（照平台原文）、`topic`、`lang`（讲课语言）、`subs`（另加的字幕）、`level`、`official`、`reupload`、`sw`、`note`（中英两版，MolAstria 写的）。文件开头有字段说明。

- **封面：** 不进 git。`pages.yml` 发布前、`desktop.yml` 打包前运行 `node tools/video-thumbs.mjs`（发布时加 `--check`），下载到 `public/videos/thumbs/`；视频没了或不让嵌入，只在 Actions 日志里出 `::warning::`，不会让发布失败。看到警告就把那条删掉或改 `embed: false`。本地预览没有封面时，页面先用平台的图片地址，再画占位图。
- **加视频：** 在 YouTube 或哔哩哔哩核对标题、频道和能否嵌入（YouTube oEmbed 返回 401 就是不让嵌入，写 `embed: false`），照格式加一行，写中英两句说明，跑 `node tools/e2e/run.mjs videos`。只收教东西的课程、讲座和教程；不收中学化学、广告和培训班引流、破解安装、付费视频；转载只收开放许可的课程（MIT OCW、Yale、NPTEL），标 `reupload`。
- **批量找候选：** `node tools/video-search.mjs yt search [主题 id]` 和 `bili search`，查询词在 `tools/video-queries.json`，结果写到 `tmp-videos/`（不进 git），附平台上的标题、简介、时长、分集、能否嵌入。`yt verify` / `bili verify` 逐条重查数据文件里的视频。要在能上 YouTube 和哔哩哔哩的机器上跑；云端会话上不去时，临时加一个在分支上 push 触发的工作流跑它、把 `tmp-videos/` 提交回分支（2026-11-08 就是这样做的，合并前删掉工作流和结果）。
- **桌面版** 不嵌入播放器，点封面在系统浏览器里打开原视频（WebView 里嵌入 YouTube 常被拒绝）。

## 刷新数据

训练页的模型核对：`node tools/train-models.mjs`（每周四随目录刷新自动跑；本机有 HTTPS 扫描时加 `NODE_USE_SYSTEM_CA=1`）。它只更新 `public/train/models-live.js`，手写的模型介绍要人来改。

- **ChemRxiv：** `deno run --allow-net --allow-read --allow-write tools/hub-chemrxiv.ts`，可重复运行，只替换 ChemRxiv 条目。新增文字后走一遍翻译。
- **每周自动刷新：** `.github/workflows/refresh-data.yml` 每周四 13:00（UTC）跑一遍，结果自动提交并发布。马上要刷新就运行 `gh workflow run refresh-data.yml`。某个来源抓取失败时沿用上周的条目（来源状态记为 `cache`，页面卡片显示“本次失败，保留上次缓存”）；`tools/check-catalogue.mjs` 发现条目减少超过 15%、某个来源为空、上次有的来源这次没了、`hub/data.js` 超过 1.6 MB 或 `merged-data.js` 超过 3.2 MB 时拒绝提交，到 Actions 日志里看是哪个来源出了问题。
- **在本机刷新：** 用 Python 3.12 虚拟环境装好 `maintenance/requirements.txt`，先跑维护脚本的单元测试 `python -m unittest discover -s maintenance -p "test_*.py"`（离线，不联网；每周的工作流也先跑它），再运行 `python -X utf8 maintenance/refresh_data.py`，然后运行 `hub-chemrxiv.ts` 和 `node tools/check-catalogue.mjs`。
- **ChemDB Atlas 目录（`public/atlas/content.js`）：** 人工整理，可以手改；加条目前用浏览器 UA 检查链接，改完同步 `public/atlas/downloads/resources.{json,csv}` 和页面上写死的条数、类别数（`atlas/index.html`、`index.html`），再依次运行 `python -X utf8 maintenance/merge_data.py`、`hub-chemrxiv.ts`（`merge_data.py` 给 ChemRxiv 条目算的 id 和它不同，不重跑会换掉这 50 条的 id）和 `node tools/check-catalogue.mjs`。手册加章时还要改写死的章数（`index.html`、`manual/index.html`、`hub/network.html`、`hub/net-engine.js`、`pro/index.html`、`download/index.html`、`tools/bundle-single.ts`、`tools/og.html`）。
- **其余目录快照（旧说明）：** `maintenance/` 的 Python 脚本。重新生成后要再跑一次 `hub-chemrxiv.ts`，否则 ChemRxiv 条目会丢。
- **预印本雷达：** 先在 `D:\ChemDraw\PreprintRadar` 运行 `deno task web`，再回到这里运行 `deno run --allow-read --allow-write tools/vendor-radar.ts`，然后走一遍翻译。
- **研究图谱：** 先在 university-science-research-network 仓库运行 `./build_site.sh`，再回到这里运行 `node tools/vendor-atlas.mjs [那个仓库的路径]`（默认同级目录），然后跑 `node tools/e2e/run.mjs "research atlas"`。图谱的英文在那个仓库的 `i18n/en.json`，改了图谱界面文字要在那里补译文（e2e 会检查英文首页不剩中文），本站不用走翻译；外层页面 `public/research-atlas/index.html` 的说明文字是隐藏的，也不进词典。桌面版不打包 `app/`（约 100 MB 的网络数据，`desktop/stage-web.mjs` 的 `LEAVE_OUT`），应用里的外层页面直接框住网站上的那一份。
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

**15 个在线模型**（Meta 页“在线运行”面板；`server.py` 的 `MODELS`、账号服务的 `UMA_MODELS`、`meta.js` 的 `ONLINE` 三处要一致）：

| 模型 | 任务 | 谁能用 | 许可 |
| --- | --- | --- | --- |
| UMA-S 1.2.1、1.2、1.2.1 D4rev | IP/EA、几何优化 | 所有人 | FAIR Chemistry License |
| AllScAIP-md 能量守恒型、直接受力型（OMol25） | IP/EA、几何优化 | 所有人 | FAIR Chemistry License |
| UMA-S 1.1，eSEN-sm 能量守恒型、eSEN-sm / eSEN-md 直接受力型（OMol25） | 只算中性分子的几何优化 | 所有人 | FAIR Chemistry License |
| MACE-OFF23 small / medium / large，MACE-OMOL-0（中性） | 几何优化 | 所有人，勾选学术用途 | ASL（学术、非商业） |
| MACE-MDP | 偶极矩与极化率（结构用 MACE-OFF23 medium 优化） | 所有人，勾选学术用途 | ASL |
| ANI-2x | 中性分子的几何优化 | 只有 Pro | MIT |

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
