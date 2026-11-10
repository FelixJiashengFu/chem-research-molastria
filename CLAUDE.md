# MolAstria 项目说明

MolAstria（molastria.com）是阿斯特赖亚科技（Morning Glory，16513778 Canada Inc.）旗下的计算化学研究导航：资源搜索、资源关系网、20 章中英双语讲解手册、计算化学教学视频（YouTube 和哔哩哔哩的课程与教程）、数据库目录、期刊投稿指南、科学大模型（27 个模型与价格对比）、AI 实验室、研习台（AI 家教）、开源代码台（计算化学程序的输入生成、输出解读与软件体检）、预印本雷达、游乐场（量子化学小游戏和浏览器里的量子化学计算器）、Pro 订阅和 Win/Mac 桌面版。
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
  shared-nav.*        顶栏（所有页面共用）：五个分组（发现、学习、探索、模型与 AI、工具）的大菜单，栏目清单是 shared-nav.js 的 GROUPS（新栏目在那里加一行：id、地址、中英名字、中英一句说明、关键词、子页面），页面用 body[data-section] 标出自己是哪一栏；Ctrl / ⌘ + K 打开菜单里的搜索（首页和数据库页自己的 Ctrl+K 优先）；放不下五个按钮时只剩一个“栏目”按钮，打开是全部分组的一张表。用户可以把栏目固定到顶栏（菜单里的图钉，或 显示 → 常用入口），存 molastria-nav-pins，固定的入口、五个分组和右边的按钮都能在顶栏上直接拖动换位（鼠标一拖就起，触屏先按住约 0.4 秒，拖起来是液态玻璃；Alt + Shift + ←/→ 键盘换位），分组和按钮的顺序存 molastria-nav-groups、molastria-nav-tools；原来的 Pro 按钮换成了账号入口（没登录是“登录”，登录后是首字母头像，点开是账号面板：登录、套餐与 AI 额度、API key、每周精选、订阅与付款、桌面版、退出登录，手机上在第二行右端）；主题、语言、AI 入口、左下角“下载桌面版”浮窗也在这里；切换语言时把地址、滚动位置、标签页和筛选存进 sessionStorage 的 molastria-lang-restore，刷新后复原
  backdrop.js         10 种背景和背景面板，含“徽标动画”开关（关时 html[data-logo-motion=off]，切换时派发 window 事件 molastria:logo-motion）
  assets/brand/       装饰视频与 poster：首页徽标 logo-loop.{mp4,webp}（以徽章为中心裁切的 256 px 正方形）；片头 intro.mp4 + intro-end.webp，只有下载页用（AI 面板改成了吉祥物进场动画）（ffmpeg 转码的小文件，原片不进仓库）
  sw.js, offline.html, manifest.webmanifest   可添加到主屏幕（PWA）：sw.js 离线保存看过的页面，由 shared-nav.js 注册（桌面版、单文件版、本地文件和 localhost 不注册）；各页的 PWA 头部标签和 sw.js 版本号由 build-seo.ts 在发布时写入，仓库里的 sw.js 保持 VERSION = 'dev'
  assets/pwa/         主屏幕和安装用的图标（按 favicon.svg 图案生成的新文件）
  i18n.js             运行时中译英，词典是生成的 i18n/en.js
  ai/ai.js            AI 助手：服务商、托管额度（只有 DeepSeek V4 Flash）、可拖宽窗口；六个吉祥物（MASCOTS，点顶部头像换，存 molastria-ai-mascot），面板从关到开时吉祥物进场 5 秒（纯 CSS，可跳过；选吉祥物的面板里能关，存 molastria-ai-intro）
  manual/ atlas/ journals/ scimodels/ hub/ lab/ meta/ models/ train/ download/   各栏目（meta/ 用 lab/chem.js 的 RDKit）
  manual/             讲解手册阅读器；正文数据仍在 atlas/content.js（中文）和 atlas/guides-en.js（英文），旧地址 atlas/#guide 会跳过来
  videos/             教学视频：videos-data.js 是全部条目（标题和频道照平台原文，说明中英两版，按主题分组），videos.js 渲染；播放器点了才加载，桌面版点封面在系统浏览器打开；封面 thumbs/ 由 tools/video-thumbs.mjs 在 CI 里下载（不进 git）
  viewer/             3D 分子查看器 mol3d.js（3Dmol.js，XYZ 多帧、PDB 编号从 RCSB 下载）和分子绘制器 sketch.js（Kekule.js，画结构出 SMILES），库都从 jsDelivr 按需载入、版本写死；模型接口、Meta 页和量子生物学的结构馆在用；纯函数由 tools/mol3d-test.mjs 测。pyrun.js 是浏览器里运行 Python 的代码框（Pyodide 314.0.7，jsDelivr，第一次约 9.2 MB，跑在 Web Worker 里，“停止”直接结束它；界面文字自带中英两版，标 translate="no"），练习程序在 py-examples.js（讲解手册“计算引擎”一章的 H₂ Hartree–Fock、量子物理“薛定谔方程与一维问题”一章的一维薛定谔求解器），tools/pyrun-test.mjs 用本机 python3 + numpy 对照 PySCF 和解析解核对。formula-check.js 是“写公式作答”的题块和判分（MathLive 0.111.1 输入、Compute Engine 0.69.1 判等价，都从 jsDelivr 按需载入；载不到时退回纯文本框和内置的小解析器），常见错误各有提示，错两次给方向、错三次给解答；界面文字自带中英两版，标 translate="no"；tools/formula-check-test.mjs 测
  review/             复习卡片：review-core.js 是纯逻辑（术语卡、研习台卡、自己的卡、队列、Anki 导出，tools/review-test.mjs 测），review.js 渲染并从 jsDelivr 载入 ts-fsrs（载不到用简化间隔）；进度存 molastria-review，研习台的 molastria-learn 只读不写
  code/               开源代码台：code-core.js 是纯逻辑（读 XYZ、电荷与多重度核对、PySCF/Psi4/xTB/CREST/ORCA/Gaussian/NWChem/CP2K/ASE 的输入和 QCSchema、读 xTB/ORCA/Psi4/Gaussian/PySCF 的输出、许可证判断、代码搜索链接、PyPI/OSV 返回值整理；tools/code-test.mjs 测，装了 PySCF 时真跑生成的脚本），code.js 是界面（软件体检由浏览器直接问 PyPI、OSV、GitHub、Software Heritage，哪家没回答就只给链接）；生成的输入里的注释一律英文（<pre> 不翻译）；上次的分子和标签存 molastria-code
  atlas/              数据库目录与 Agent 工程（#agent）；downloads/ 里的 resources.{json,csv} 与 content.js 同步
  digest/             每周精选：公开页（账号服务 /digest/preview 的本周概览和全部论文带点评），digest-card.js 是首页的卡片
  journals/           期刊发表：journals-data.js（期刊，中英双语，每项带出处）与 journals-guide.js（投稿指导）
  fundamental-science/  进一步基础科学发现：fs-data.js 是全部内容（中英两版，每条带研究状态，文献逐条核对过），fs-models.js 是交互演示的数学（纯函数），fs-math.js 是生成的 MathML
  fundamental-science/math/  子模块“数学基础与探索”：fm-data.js 是全部内容（10 门学科的讲解、大纲、公式、练习、自测、教材与视频，学科关系图，学习路线，Hall 章节导读；书目 DOI 在 Crossref 核对过，视频逐条核对过），fm.js 渲染，fm-prob.js 是概率论演示（大数定律、中心极限定理）的数学（纯函数，tools/fm-prob-test.mjs 测），fm-quiz.js 是每门学科的公式题（答案、常见错误和提示，做对的存 molastria-fm-quiz），fm-math.js 和 fm-quiz-math.js 是生成的 MathML
  quantum/biology/    量子嘉年华下的量子生物学：qb-data.js 是全部内容（中英两版，七个方向、证据账本，每条带证据状态：已确立 / 活跃研究 / 存在争议 / 推测性假说，文献在 Crossref 核对过），qb-models.js 是三个演示的数学（纯函数），qb-math.js 是生成的 MathML；版式用 ../../fundamental-science/fundamental.css
  quantum/            母栏目“量子嘉年华”：sections.js 是四个展馆（量子物理、量子计算机、量子算法、量子生物学）的卡片数据，每个展馆一块、互不交叉，live 为 false 时显示“即将上线”；carnival.js 画入口页（展馆、通道、路线）
  quantum/physics/    量子物理展馆：qp-data.js 是全部内容（三幕十二章的讲解、大纲、公式、练习、自测，关键实验时间线，原始论文、教材与课程；DOI 和链接逐条核对过），qp-models.js 是四个演示的数学（纯函数），qp.js 渲染，qp-quiz.js 是每章的公式题（做对的存 molastria-qp-quiz），qp-math.js 和 qp-quiz-math.js 是生成的 MathML；地址 #c-<章> 打开一章
  quantum/algorithms/  量子嘉年华的“量子算法”展馆：qa-data.js 是全部内容（14 个算法，中英双语，每个带加速的证据等级；化学资源估算；65 篇文献在 OpenAlex / arXiv 核对过），qa-models.js 是演示的数学（态矢量模拟器等，纯函数），qa.js 渲染，qa-math.js 是生成的 MathML
  quantum/computing/  量子嘉年华 · 量子计算机：qc-data.js 是全部内容（中英两版，每条带确定程度，文献在 OpenAlex 核对过），qc-models.js 是演示的数学（纯函数，tools/quantum-computing-test.mjs 测），qc-math.js 是生成的 MathML；只讲硬件与纠错，算法在 quantum/algorithms/
  open-models/        开放模型馆（Meta 归在这里）：om-data.js 是全部内容（11 家公司、50 个模型 / 数据集 / 工具，中英两版，每条带使用条件和许可证，按任务比较的 tasks；许可证按 GitHub 仓库、文献在 OpenAlex / arXiv 核对过），om.js 画母栏目页和每家的展馆页 open-models/<id>/（Meta 的展馆就是 meta/ 页，只用 om.js 的位置和展馆切换），om.css 在 meta/meta.css 上加；tools/open-models-test.mjs 查完整性
  programming/        编程语言教学区：pl-data.js 是全部内容（20 种语言和工具链，中英两版；每种一段代码，大多是同一道 LJ 势能题，tested 标明是否真跑过），pl.js 渲染（地址 #lang-<id>、#code-<id>，Python 用 viewer/pyrun.js 在浏览器里跑），tools/programming-test.mjs 用本机有的编译器重跑标了 tested 的代码
  scimodels/          科学大模型：scimodels-data.js（数据库第 17 类的 27 个模型，中英双语，每条官方链接；prices 是价格对比与汇率，带核对日期）
  api/                开放数据接口：v1/ 是给程序读的静态 JSON（资源目录、期刊、科学大模型与价格、教学视频，中英双语，CC BY 4.0），外加中英术语表、openapi.json，由 tools/build-api.mjs 从各栏目的数据文件生成（同时生成站点根的 llms.txt）；v1/molastria.mjs 是手写的零依赖 JS 库（跨数据集搜索，中英同义词互通，没有 DOM，tools/api-test.mjs 测）；v1/molastria.py 是手写的零依赖 Python 客户端（读数据集、提交计算并等结果，tools/molastria-py-test.py 测）；embed.js 是给别人网页用的嵌入卡片（shadow DOM，自带中英文字，不走 i18n）；index.html + api.js 是说明页：搜索台、跟着搜索变的代码、嵌入卡片生成器，只用公开的接口；compute.js 是说明页里“计算接口”一段（在线状态和 7 天在线率、带 key 试一次、示例代码），接口本身在账号服务的 /v1。v1 只加字段，删改字段要出 v2
  about/              关于页：阿斯特赖亚科技（Morning Glory，16513778 Canada Inc.）与 MolAstria 的关系；只有 MolAstria 标“已上线”，其他方向都是规划，不要写成现状
  pro/                价格页、账号页 account.html + account-page.js（含生成和撤销 API key、今天的用量和最近的计算）、条款
  pay/config.js       收款链接、显示价格、accountApi、portalUrl；pay/account.js 是账号客户端
  radar/              预印本雷达外层页面（28 个来源，理工到人文）；app/ 是复制来的，不要手改
  research-atlas/     研究图谱外层页面（中美二十所大学数理化网络、量子化学地图、Top 20、中美对比、北美产业）；app/ 是 university-science-research-network 的整站构建，由 tools/vendor-atlas.mjs 复制，不要手改；英文、Tт 字体和主题由外层页面经网址参数和 postMessage（ra-host）传进去，译文在那个仓库的 i18n/en.json，用本站的 i18n.js；图谱仓库 main 有新提交时 atlas-sync.yml（每 3 小时检查一次）自动重新复制并上线
  physics-realms/      物理疆界图：pr-data.js 是全部内容（理论、问题、关系与 ħ-c-G 立方体，中英两版），pr.js 手写力导向图（SVG，可拖动缩放、局部图、筛选，#n-<id> 选中节点），tools/realms-test.mjs 查内容完整性；pr-models.js 是双摆演示的数学（RK4、能量、简正模；打开“分析力学”或“混沌”节点时才加载，realms-test 也测它）
  learn/              研习台（AI 家教）：先摸底、画路线、一步一检，练习分开做，学到的命题和推理链存成跨会话的知识图；learn-core.js 是纯逻辑（状态、路线图、评分、知识图、练习选题、模型回答的校验、提示词，tools/learn-test.mjs 测），learn-sources.js 把六个讲解栏目改写成可当依据的章节、外加站内演示白名单（tools/learn-sources-test.mjs 查锚点），learn-graph.js 画路线图、知识图和示意图（SVG，不收模型的 HTML/SVG），learn.js 是界面；走 ai/ai.js 的 ChemAI（访客自己的 key 或托管额度），数据只存 localStorage（molastria-learn、molastria-learn-prompts）；#goal=qp:<章> 从站内一章开始，量子物理、数学基础、量子算法、量子计算机、量子生物学、基础科学各章都有入口
  qchem/              游乐场（地址仍是 /qchem/）：三个展区十五个小游戏。01–06（量子化学）在 play.js，物理是纯函数 play-models.js；07–14（量子嘉年华分会场、物理疆界）在 play-quantum.js，数学在 play-quantum-models.js，play.js 把画图和成绩工具经 MOLASTRIA_PLAY_MORE 交给它；15（二维波包画墙，展区二）在 play-wave2d.js，数学在 play-wave2d-models.js（分裂算符解二维薛定谔方程，自己写的 FFT），经 MOLASTRIA_PLAY_WAVE 拿到同样的工具；“量子化学计算器”标签是 iframe 里的 app/（从 qchem-web 复制来的，不要手改）。#play-… 打开游戏，#lab 打开计算器，其他 #… 原样交给计算器
  hub/network.*, net-engine.js   网状查询：net-engine.js 由目录、讲解手册和 search-terms.js 现算实体与关系（无 DOM，tools/net-test.mjs 测）
  hub/data.*, merged-data.*   目录快照
deploy/               账号服务：account-worker.js（含给程序用的计算接口 /v1、API key、用量记录和每 15 分钟一次的在线率探测）、digest.js（每周精选）、schema.sql、wrangler.toml（Cloudflare Worker + D1）
desktop/              Tauri 2 桌面版，打包时内置网站：stage-web.mjs 在每次构建前把 public/ 复制到 desktop/web/（不进 git），去掉 App 里用不到的 watch/ 视频；src/uma.rs + uma/runner.py 是“在本机运行 UMA”；src/save.rs 让页面里的下载走系统保存窗口；src/notify.rs 把页面的通知（预印本雷达）转成系统通知；Mac 上 window.print() 改走 print_page 命令（WKWebView 自己不打印）
i18n/en.json          英文译文的源文件，可以手改（JSON 缩进 1 个空格）
tools/                构建、翻译、数据、测试脚本
tools/e2e/            浏览器端到端测试
tools/uma-server/     在线模型：站长电脑上的服务 server.py（15 个模型，经 Cloudflare Tunnel 接到账号服务 /uma/*），MACE 在 mace_worker.py（单独的 mace-env）；start.ps1 启动服务和隧道（-KeepAlive 崩溃后重启），autostart.ps1 装成登录后自动启动；secret.local、cache*.json 不进 git
tools/cloud/          站长的云端 GPU 批量计算：run.mjs（本机，经 gcloud）+ batch_uma.py / batch_mace.py / remote.sh（虚拟机上）；cloud.local.json 不进 git
agent/chemdb-agent/   chemdb-agent 源码（计算化学 MCP 服务器，Python；十二个工具，其中三个经计算接口 /v1 提交计算；测试与 venv 说明见其 README）。下载包由 python tools/pack-chemdb-agent.py 生成
maintenance/          Python 爬虫与合并脚本，单元测试是 test_*.py（离线）；每周四由 .github/workflows/refresh-data.yml 自动运行（同一个工作流也跑 tools/train-models.mjs，核对训练页的模型）
```

## 常用命令

```bash
deno run --allow-net --allow-read tools/serve.ts 8830   # 本地预览 public/
deno run --allow-read tools/account-test.ts             # 账号服务接口测试
node --test tools/lab-test.mjs                          # 实验室逻辑测试
node tools/build-api.mjs                                # 开放数据接口：重新生成 public/api/v1/ 和 chemdb-agent 的 catalog/resources.json（改了目录、期刊、科学大模型、视频的数据后跑；发布时 CI 也会跑）
node --test tools/api-test.mjs                          # 开放数据接口：内容完整、双语齐全、代号都对得上；JS 库的搜索（同义词互通、排序、筛选）
python3 tools/molastria-py-test.py                      # Python 客户端 molastria.py：对着本地假服务测提交、等待、报错和命令行
node --test tools/net-test.mjs                          # 网状查询引擎（用真实目录快照）
node --test tools/fundamental-test.mjs                  # 基础科学栏目：演示的数学对照解析解，内容的状态、公式、文献都能对上
node --test tools/fm-prob-test.mjs                      # 数学子模块的概率论演示：大数定律、中心极限定理对照解析结果，同一个种子同一个结果
node --test tools/formula-check-test.mjs                # 公式题：判分的各种情形、内置解析器、题目数据，每个答案都用数值独立核对
node --test tools/quantum-bio-test.mjs                  # 量子生物学：演示的数学对照解析解和时间积分，内容的状态、公式、文献都能对上
node --test tools/play-test.mjs                         # 游乐场：十五个游戏的物理对照已知结果和解析解（二维波包：幺正、自由波包展宽、双缝条纹间距），关卡都能过关、电路题的最少门数穷举核对
node --test tools/learn-test.mjs tools/learn-sources-test.mjs   # 研习台：纯逻辑（路线图、评分、知识图、练习选题、校验、提示词）；六个来源都能改写成章节，演示白名单的地址和锚点都存在
node --test tools/quantum-physics-test.mjs                # 量子嘉年华 · 量子物理：四个演示对照解析解，章节的公式、论文、书目、视频都能对上
node tools/fundamental-math.mjs                         # 基础科学栏目：把 fs-data.js 里的 LaTeX 用 KaTeX 转成 fs-math.js（MathML）
NODE_USE_SYSTEM_CA=1 node tools/fundamental-refs.mjs    # 基础科学栏目：逐条在 Crossref 核对文献
node --test tools/quantum-algorithms-test.mjs           # 量子算法：演示的数学对照解析解，内容完整
node --test tools/mol3d-test.mjs                        # 3D 查看器的纯函数：XYZ 拆帧、Hill 式、PDB 编号、样式
node --test tools/review-test.mjs                       # 复习卡片：卡组生成、新卡上限、调度记录、坏数据迁移、Anki 导出
node --test tools/code-test.mjs                         # 开源代码台：输入生成、输出解读（五个程序的真实格式片段）、许可证、搜索链接；本机有 PySCF 时真跑生成的脚本对照参考能量（CODE_SKIP_PYTHON=1 跳过）
node --test tools/open-models-test.mjs tools/programming-test.mjs   # 开放模型馆的内容完整性；编程区的代码用本机有的编译器真跑（PROGRAMMING_SKIP_RUN=1 跳过）
node --test tools/pyrun-test.mjs                        # 浏览器里的 Python：代码框的纯函数，两段练习用本机 python3 + numpy 跑并对照参考值（PYRUN_SKIP_PYTHON=1 跳过）
node tools/quantum-algorithms-refs.mjs                  # 量子算法：文献在 OpenAlex / arXiv 核对
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
- **生成的文件不要手改：** `public/radar/app/`（用 `tools/vendor-radar.ts`）、`public/research-atlas/app/`（用 `tools/vendor-atlas.mjs`）、`public/qchem/app/`（用 `tools/vendor-qchem.ts`）、`public/i18n/en.js`（用 `i18n-translate`）、`public/hub/data.*` 和 `public/merged-data.*`（用 `tools/hub-chemrxiv.ts` 或 `maintenance/`）、`public/train/models-live.js`（用 `tools/train-models.mjs`）、`public/fundamental-science/fs-math.js`、`public/fundamental-science/math/fm-math.js`、`public/quantum/physics/qp-math.js`、`public/quantum/biology/qb-math.js`、`public/quantum/algorithms/qa-math.js`、`public/quantum/computing/qc-math.js`、`public/fundamental-science/math/fm-quiz-math.js` 和 `public/quantum/physics/qp-quiz-math.js`（都用 `tools/fundamental-math.mjs`；只重建公式题用 `node tools/fundamental-math.mjs quiz`）、`public/api/v1/*.json`、`public/llms.txt` 和 `agent/chemdb-agent/src/chemdb_agent/catalog/resources.json`（都用 `node tools/build-api.mjs`）、`public/atlas/downloads/chemdb-agent.zip`（用 `python tools/pack-chemdb-agent.py`，同样的源码打出同样的 zip）。`public/videos/thumbs/` 不进 git，发布和打包桌面版时由 `tools/video-thumbs.mjs` 下载。`public/guide/`、`public/resources/`、`sitemap.xml`、各页的 SEO 头和 PWA 头部标签、`sw.js` 的版本号每次发布由 CI 重新生成，本地不用跑。

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
- **`wrangler deploy` 之后线上可能还是旧代码：** 2026-11-09 部署成功、`wrangler deployments status` 也显示新版本 100%，但 `api.molastria.com` 有五到十分钟仍由旧版本回应（响应是 `no-store`，不是缓存）。先等几分钟再测，不要急着重新部署或回滚；`wrangler deployments list` 可以确认没有别人在之后部署过。
- **D1 偶发 403（code 7403）：** 一段时间没用后的第一个请求常失败，重试就好，不是权限问题。
- **D1 迁移：** `schema.sql` 只有 `CREATE TABLE IF NOT EXISTS`，加列要另外跑 `ALTER TABLE`，并在 `schema.sql` 留注释。
- **Worker 免费版：** 每次调用限 10 ms CPU，本地测不出来；生成一期实测 8 ms（2026-10-31）。定时任务里解析的响应要小（每个来源 20 条），改动后在线上跑一次（`docs/RUNBOOK.md`）。
- **页面缓存：** GitHub Pages 让浏览器缓存文件 10 分钟，刚上线时要 Ctrl+F5。测线上时给网址加查询参数。
- **ChemRxiv：** 官网对程序返回 Cloudflare 验证，不要绕过；用 Crossref（前缀 10.26434）。Crossref 里没有学科字段，靠关键词筛。
- **i18n：** 带 `{0}` 的词条至少要有 2 个汉字才生效；一个按钮和一个列表同名会共用一条译文（雷达的“收藏”因此把列表改成了“我的收藏”）。`i18n.js` 的 `SKIP` 选择器要写窄：`.card h3` 曾把实验室所有卡片标题一起跳过，现在是 `article.card h3`（只跳论文卡片）；`textarea` 只跳过内容，placeholder 照常翻译。`i18n-extract` 不抽资源名和 `hub/net-engine.js`，那里要显示英文的文字直接手加到 `i18n/en.json`（有译文的手加词条会保留）。只有一个汉字的模板（如 `${n} 条`）永远不会被翻译，写成至少两个汉字（`共 ${n} 条`）。
- **计算接口 `/v1` 的报错要写两种语言：** 在线模型路径上的 `fail(状态, 中文, 英文, code)` 第三个参数是给程序看的英文，漏了的话 `/v1` 会把中文当英文返回。网站自己的接口只用中文那一句。
- **Cloudflare 拦脚本的默认 User-Agent：** `api.molastria.com` 对 `Python-urllib/3.x` 返回 403（不是我们的 JSON）。给程序看的示例都要自己设 User-Agent。
- **`pro.css` 的表格规则管到所有表格：** `td:not(:first-child){text-align:center;white-space:nowrap}` 是给价格表写的，账号页里新加的表格也会被它压成一行、撑出横向滚动；新表格要自己写回 `white-space:normal`（账号页的用量表就是这样）。
- **Stripe 测试 ID：** 账号服务只接受 `cs_test_` 或 `cs_live_` 加字母数字，带下划线的假 ID 会被拒。
- **本机杀毒：** Norton 会拦截 HTTPS。Deno 脚本报 `UnknownIssuer` 时加 `DENO_TLS_CA_STORE=system`，Node 脚本加 `NODE_USE_SYSTEM_CA=1`。
- **本机 shell：** Git Bash 的 heredoc 里同时有反引号和引号时可能解析失败；复杂的编辑脚本先写成文件再运行。脚本里 `String.replace` 的替换文本要用函数形式，否则 `$$eval` 会变成 `$eval`。
- **MathLive 的输入框：** 点一下之后约 60 ms 才把焦点移进去，浏览器测试里点完要等一下再打字（或者直接给 `math-field` 的 `value` 赋值再点“检查”）；数学子模块和量子物理页读到地址里的 `#…` 后也要过 60 ms 才滚动，测试先等 300 ms 再自己滚到题块。
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
