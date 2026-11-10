# 路线图

做完就移到“已完成”。会话启动时会自动显示“现在”这一节，所以这一节要短。这个文件是公开的，私人事项放在本机 Claude 记忆里。

## 现在

- 云同步（2026-11-10 上线，和代码台扩充、讲解手册新章节一起）：登录后在账号页打开，13 份本机存档（首页和数据库收藏、各栏目的自测和公式题、学习路线、游乐场成绩、复习卡片、研习台）在同一账号的设备之间三方合并同步，删掉的不会再冒出来；页面开着时被同步改了会提示刷新。免费账号 1 MB、Pro 支持者 10 MB（`SYNC_FREE_KB` / `SYNC_PRO_KB`；站长要改成只给 Pro，把 `SYNC_FREE_KB` 设成 0 再部署账号服务）。表 `sync_items` 和账号服务已在 2026-11-10 上线。只在无头 Chrome 里用两个浏览器测过（`tools/e2e/run.mjs "cloud sync"`），上线后在真的两台设备上（比如 Mac 和 iPhone）各打开一次、互相收藏和取消收藏，再在桌面版里试一次（桌面版要等下一个版本）。以后可以加：顶栏固定的入口（`molastria-nav-pins`）也同步；研习台“清空全部数据”时问一句要不要连云端一起删；Worker 里看一眼 `/sync` 的 CPU 时间（大的研习台存档）。
- 代码台扩充（2026-11-10，和讲解手册新章节、云同步一起上线）：输出解读加 NWChem、CP2K、Q-Chem（八个程序；NWChem 7.2.2 和 CP2K 2026.2 在云端真跑本页生成的输入核对，Q-Chem 用 cclib 收的 5.4 / 6.0 真实输出，样本在 `tools/code-fixtures/`）；从 SMILES 直接生成三维坐标（`public/viewer/smiles3d.js`，OpenChemLib 在 Web Worker 里搭构象、MMFF94 优化、按能量排序，立体构型照写的来，没写的定成一种并提示）；XYZ 可以多帧（选一帧写输入）；模型接口的结果多了“送进代码台写输入”（每一帧带自己的电荷和多重度）。顺手修了 CP2K 的 GFN2-xTB 输入（`GFN_TYPE 2` CP2K 不认，改成 tblite）和开放模型馆手机上的横向滚动。没测到的：Q-Chem 的报错只有照手册写的样本；桌面版里 Worker + jsDelivr 动态载入还没在真机上试过，下一个桌面版出来后打开代码台生成一次。
- 讲解手册补到 25 章（12–16 类五章，2026-11-10）和网状查询的“没找到的词”：上线后看一次 GitHub Actions 里 `Handbook calculations`（第一次在 GitHub 的机器上用 PySCF 2.15.0 重算章里的数字，约 5 分钟；硅能带要手动勾 solid 再跑一次）；在英文站打开五章各看一眼；在网状查询搜一个乱写的词，点“到 GitHub 提交”确认 Issue 页面预先填好了（仓库的 Issues 要开着）。以后有人提交了词，挑出真正的术语补进 `public/search-terms.js`（做法见 `docs/RUNBOOK.md`“网状查询没找到的词”）。
- 愿景页（`/vision/`，2026-11-10）：站长的文章《工业革命2.5》原文、手写英文译文和编者的展望（四项承诺 × 已上线 / 规划中 / 设想）。上线后在线上打开一次文章里的三个来源链接（云端会话打不开那三个网站）；以后路线图上的事做完，把展望里对应的“规划中”改成“已上线”（`vision/vision-data.js` 的 `outlook`）。
- 新顶栏、开放模型馆、编程语言教学区（2026-11-10）：顶栏是五个分组的大菜单（搜索 Ctrl / ⌘ + K、可固定常用入口），Meta 归到新母栏目 `/open-models/`（11 家公司、50 个条目），新栏目 `/programming/`（20 种语言，同一道题 18 种实跑）。只在无头 Chrome 里测过（1024–1920 px、iPad 768 px、手机 390 px，深浅色、中英文）。上线后要在真机上看：iPad 横竖屏和 iPhone 上打开“栏目”表、在表里搜索和滚动（Safari 的 `position:sticky` 加 `backdrop-filter` 下的大菜单）、触屏按住拖动固定的入口；Mac / Windows 桌面版里 Ctrl / ⌘ + K；编程区的 Python 代码框（Pyodide 第一次约 9 MB，SymPy 再加几 MB）。展馆页的“最近的版本”直接问 GitHub API（未登录每小时 60 次，超了就只给链接）。以后可以加：开放模型馆加 Google Research、Mistral 的科学模型、Isomorphic 等新出的开放模型时照 `om-data.js` 的格式加一项；编程区加 Julia、CUDA 的实跑（要有机器）、一段 Fortran 和 Python 互调（f2py）的例子。
- 开源代码台（`/code/`，2026-11-10，按站长整理的《全球公开代码仓库与科研代码资源目录》做，和 #103 一起上线）：输入生成（九个程序 + QCSchema）、输出解读、软件体检（PyPI / OSV / GitHub / Software Heritage）、搜代码；资源目录补到 251 条。
- 学习功能大补充（2026-11-10，和研习台一起上线）：3D 分子查看器（`public/viewer/mol3d.js`，模型接口的结果、量子生物学的结构馆）、分子绘制器（`public/viewer/sketch.js`，模型接口和 Meta 页的 SMILES 旁“画结构”）、量子线路模拟器的旋转门 / 中途测量 / Bloch 球、复习卡片 `/review/`（FSRS 调度，导出到 Anki）、浏览器里运行 Python（`public/viewer/pyrun.js`，Pyodide；讲解手册“计算引擎”一章的 H₂ Hartree–Fock、量子物理的一维薛定谔求解器）、公式题（`public/viewer/formula-check.js`，数学子模块 10 门学科和量子物理 12 章共 45 道，MathLive 输入、Compute Engine 判分）、游乐场第 15 个游戏“二维波包画墙”、数学子模块的大数定律 / 中心极限定理演示和 Lean 4 书目、物理疆界图的双摆演示、资源目录 228 条、操作手册里用 Manim 和 Molecular Nodes 做视频。上线后：跑 `node tools/e2e/live.mjs`；在 Safari、iPad、iPhone 和 Mac / Windows 桌面版里各试一次 3D 查看器（WebGL）、绘制器、Python 代码框（module Web Worker，第一次下载约 9.2 MB）、公式题（MathLive 的屏幕数学键盘只在无头 Chrome 里截过图）、第 15 个游戏和双摆的帧率（4 倍 CPU 减速下约 43 帧，真机没试）；这些库都从 jsDelivr 载入，桌面版里也没实测；用真实的 Anki（2.1.54 以上）导入一次复习卡片导出的文件，看正面、背面、标签和卡组是否对上（只按 Anki 手册的文件头格式核对过）；结构馆的六个 PDB 结构从 files.rcsb.org 现场下载，大陆网络下可能慢。以后可以加：复习卡片的云同步（等 Pro 云同步）和顶栏入口（研习台合并后加）、讲解手册更多章节的“动手算”（按章节编号加在 `manual/app.js` 的 `TRY` 里）、更多公式题、Anki 的 .apkg 导出（带进度）、Lean 的 Linear Algebra Game 和 Real Analysis Game（这次没核对上，没收）。
- 研习台（`/learn/`，2026-11-10）：AI 家教，五个标签——学习（摸底 → 路线图 → 一步一检，答错或靠猜答对就补一步，学完总结进知识图）、练习（从知识图里选题，跨主题穿插、先不说考什么，提示一级一级给）、知识图（命题和推理链的力导向图，可搜索、删除）、导入笔记（AI 从笔记里提取命题，预览后再加）、数据（导出导入 JSON、用量与费用、可编辑的提示词）。量子物理、数学基础、量子算法、量子计算机、量子生物学、基础科学的每一章都有“用研习台学”的入口，那一章的内容当作依据。走现有的 ChemAI（访客自己的 key，或登录后的托管额度），数据只存在本机浏览器。只对着假的 DeepSeek 测过（`tools/e2e/run.mjs "study desk"`）。上线后要做：用自己的 DeepSeek key 完整学一次（看真实模型能不能稳定按 JSON 格式回答、一步一检的节奏和补讲是否合适、费用多少），再用 Muse 和一个 OpenAI 兼容的服务各试一次摸底；登录免费账号用托管额度试一次（每天 5 次大约只够摸底加画路线，页面上写了建议用自己的 key）；在 iPad 和 iPhone 的 Safari 里试口述按钮（Web Speech API，只确认了不支持时会隐藏）、知识图的拖动和双指缩放。没有做：附带图片、按单轮附带文件；单文件离线版没有收录（栏目数据按需加载，单文件版里用不了）。

- 计算接口的五项补充（2026-11-09）：① 在线模型登录后自动启动、崩溃后自动重启（`tools/uma-server/autostart.ps1` 和 `start.ps1 -KeepAlive`）；② Python 客户端 `public/api/v1/molastria.py`（一个文件，`Compute().run(...)` 提交并等结果），计算接口写进 `openapi.json`；③ chemdb-agent 0.3.0 多了三个工具（`run_calculation`、`get_calculation`、`compute_status`）；④ 账号页的用量面板（今天用了多少、每个 key 过去 24 小时用了多少、最近 10 次计算）；⑤ 账号服务每 15 分钟探测一次站长电脑，`GET /v1/status` 和说明页显示最近 7 天的在线率。已全部上线（2026-11-09：D1 迁移、账号服务 719f6db1、网站 #97、桌面版 0.2.4），`tools/e2e/live.mjs` 16 项全过，定时探测在记录（站长电脑没开服务的那两天记的是 0%，如实显示）。站长电脑上已经运行过 `autostart.ps1 -Install`，“启动”文件夹里有快捷方式。还要做：下次登录 Windows 后看一眼 `autostart.ps1 -Status` 和 `keepalive.log`，确认服务真的自己起来了（两个脚本只在 Windows PowerShell 5.1 里做过语法检查，`-Install` 和 `-Status` 跑过，`-KeepAlive` 的重启循环还没有真的跑过）；`molastria.py` 和 chemdb-agent 的计算工具只对着假服务测过，用真实的 key 各跑一次；`molastria.py` 没有发到 PyPI（要站长的 PyPI 账号），有人要 `pip install` 时再发；没有做批量提交（一个账号同时只能有一个任务，批量等于排队，等第 3 步有了租用的 GPU 再说）。

- 计算接口和 API key（`api.molastria.com/v1`，2026-11-09）：对外服务路线的第 2 步，和第 1 步一起上线。免费账号在账号页生成 key（D1 只存哈希），带 key 的程序可以提交在线模型的计算并轮询结果，不限来源网站；次数就是账号在网站上的那一份（100 / 200），MACE 全系（ASL）不提供。说明在 `/api/#compute`，有实时在线状态、带 key 试一次和三种语言的示例。**上线顺序：`schema.sql` 迁移（新表 `api_keys`）→ 部署账号服务 → 合并网站。** 上线后：`node tools/e2e/live.mjs`（有一条检查 `/v1`）；用真实的 key 在站长电脑上把 `/api/` 页的 Python 示例跑一次（本地测试里站长电脑是假的）；Cloudflare 会拦 Python urllib 默认的 User-Agent（403，2026-11-09 实测），说明页和示例已经写明要自己设一个；想放行的话在 Cloudflare 的安全规则里给 `api.molastria.com/v1` 关掉 Browser Integrity Check；Worker 免费版每次调用 10 ms CPU，`/v1/jobs` 比 `/uma/jobs` 多一次查 key，在 Cloudflare 控制台看一眼 CPU 时间。以后看 `api_keys` 的行数和 `last_used` 就知道有没有人用；有人用了再考虑第 3 步，以及：按 key 的用量页、把计算接口写进 OpenAPI、给 chemdb-agent 加一个调用计算接口的工具。

- 开放数据接口（`/api/`，2026-11-09）：对外服务路线的第 1 步。`public/api/v1/` 五个数据集（资源目录 214 条、期刊 48 种、科学大模型 27 个与价格、教学视频 189 条、中英术语表 109 组），CC BY 4.0；零依赖的 JS 库 `molastria.mjs`（跨数据集搜索，中英同义词互通）；嵌入卡片 `embed.js`（一行 script 放到别人的网页上）；`openapi.json` 和 `llms.txt` 给 AI 和程序发现接口；说明页 `/api/` 有搜索台、跟着搜索变的代码和嵌入卡片生成器，页脚有入口；chemdb-agent 0.2.1 的目录同步到 214 条。嵌入卡片只在无头 Chrome 里测过，上线后在一个真实的外部网页（比如 GitHub Pages 上的课程页）和 Safari 里各贴一次试试；`.mjs` 在 GitHub Pages 上应以 `text/javascript` 返回（没有实测，不对的话 `import` 会失败）。上线后：用 `curl -I https://molastria.com/api/v1/index.json` 确认有 `access-control-allow-origin: *`（GitHub Pages 默认会给，没有实测过自定义域名）；跑 `node tools/e2e/live.mjs`；把 chemdb-agent 登记到 MCP 目录（要站长的账号）。看有没有人用：现在没有访问统计，接入 Cloudflare Web Analytics 之前只能看 GitHub Issues 的反馈。第 3 步（云 GPU、机构档）等有人用了再做，见 `docs/DECISIONS.md` 2026-11-09。以后可以加：网状查询的实体与关系、讲解手册各章、每周精选。
- 量子嘉年华（`/quantum/`，2026-11-09）：母栏目和第一个展馆“量子物理”（`/quantum/physics/`，十二章、四个演示、36 篇原始论文、27 本教材与讲义、15 门课程）。其余三个展馆（量子计算机、量子算法、量子生物学）各自上线时把 `sections.js` 里自己那块改成 `live: true`。上线后在 Safari 和桌面版里看一眼 MathML 公式和演示 2 的波包动画（只在 Chromium 里测过）；视频链接每半年复查一次；单文件离线版没有收录量子物理页（数学子模块也没有收录），以后可以一起加。
- 量子嘉年华 · 量子计算机（`/quantum/computing/`，2026-11-09）：硬件与纠错一层（六条硬件路线、20 个里程碑、证据账本、三个演示），57 篇文献在 OpenAlex 核对（容器里连不上 Crossref，站长电脑上可以用 `tools/fundamental-refs.mjs` 的做法再核一遍）。量子算法、量子生物两个展馆合并后，`tools/quantum-computing-test.mjs` 里跳过这两个路径的那一行可以删掉，让学习路线的链接也被检查。只在无头 Chrome 里测过；在 Safari 和桌面版里看一眼 MathML 公式和 Bloch 球。硬件数字（保真度、比特数）变化快，每半年按页面上的核对日期复查一次。
- 研究图谱（`/research-atlas/`，2026-11-08）：整站从 university-science-research-network 复制，二十所学校已全部建好（复制过来约 150 MB），图谱更新后重新运行 `tools/vendor-atlas.mjs`。只在无头 Chrome 里测过缩放（125%，地图的放大缩小按钮和滚轮、sigma 网络、手机 390 px）；iPad 主屏幕应用里开缩放看一眼框内的网络图和地图能否拖动、点选。
- 付费模式改成 OpenAlex 的做法（2026-11-08，PR 待合并）：内容全部免费（每周精选全文和邮件、ANI-2x），任何邮箱都能登录免费账号（在线模型每天 100 次、AI 托管每天 5 次），Pro 改叫“Pro 支持者”，价格和 Stripe 链接不变。**要先部署账号服务（`/ship-worker`），再推网站。** 上线后看：每天发出的验证码邮件数（Resend 免费版每天 100 封，每周精选最多占 80 封，注册的人多了要升级 Resend 或调低 `DAILY_MAIL_CAP`）；DeepSeek 每天花多少（免费账号的托管问答）；一个月后看付费人数有没有变化。已安装的旧桌面版在下一个版本之前，ANI-2x 仍显示“Pro 会员”、免费账号看不到托管 AI。

- 教学视频（`/videos/`，2026-11-08，桌面版 0.2.0）：189 条，14 个主题。上线后看一次 Pages 发布日志里 `video-thumbs` 的警告（失效或不让嵌入的视频），线上点几个 YouTube 和哔哩哔哩的封面试播（本地测试里播放器是假的）；在 iPhone Safari 上试一次哔哩哔哩的嵌入播放器。说明是按平台上的标题、简介和分集写的，没有逐个看完视频，站长看到不准的可以直接改 `videos-data.js`。以后每季度跑一次 `yt verify` / `bili verify`。

- Mac 桌面版后台闪退（0.1.19，SIGABRT）：已去掉 `panic = "abort"`，要打下一个桌面版本（`/ship-desktop`）才到用户手里；装好后在 Mac 上让应用开着切到后台半小时以上，看是否还会闪退。根因是推断出来的（按崩溃偏移反汇编发布包），没有在真机上复现过。
- 每周精选：11 月 2 日那一期没有生成（线上最新仍是 10 月 26 日），原因未查（看不到 Worker 的历史日志）。站长可以在账号页“每周精选”里点“重新生成本期”补上；下周一（11 月 9 日）看定时任务是否正常出刊。
- 桌面版 0.1.18（2026-11-07）装好后在真机上看：Mac 上讲解手册的“打印当前章节”弹出系统打印窗口；预印本雷达的“测试通知”弹出系统通知；AI 助手的吉祥物进场；在 iPad 和 iPhone 上按住顶栏入口后直接拖动换位、按住不动松开打开排序面板（只在无头 Chrome 里用模拟触摸测过，Safari 真机没试）。
- 桌面版的系统通知（预印本雷达“测试通知”，下一个桌面版本）：WebView 本身没有可用的网页通知，改走 tauri-plugin-notification。只在模拟的桌面环境里测过，发布后要在 Mac 和 Windows 的安装版里各点一次“测试通知”，看系统通知是否弹出（Mac 第一次可能要在“系统设置 → 通知”里允许 MolAstria）。点通知不会跳回应用（插件在桌面上没有点击回调）。
- 游乐场（2026-11-07，桌面版 0.1.17）：上线后跑 `node tools/e2e/live.mjs`；在 iPad 主屏幕应用里打开缩放（如 125%）看一眼预印本雷达和量子化学计算器不再被切掉（只在无头 WebKit 和 Chrome 里测过），再各玩一局小游戏。桌面浏览器（Chrome/Edge）开了界面缩放时，其他页面里用 `100vh` 的侧栏会比窗口高一点（Chrome 把 vh 乘了 CSS zoom），桌面版和 iPad 不受影响，以后可以统一换算。
- 显示设置与金属箭头（2026-11-07，桌面版 0.1.16）：只在 Chromium（无头 Chrome）里测过。要在真机上看一次：iPad 主屏幕应用里的界面缩放（Safari 的 CSS zoom 与 Chrome 的坐标换算可能不同，网状查询的拖动和基础科学页的演示 3 拖动要试）、Mac 桌面版的原生缩放（WKWebView）和 Ctrl / ⌘ 加 = − 0、Windows 桌面版的原生缩放；楷体在 Windows 上是否装有 KaiTi。
- 量子生物学栏目（`/quantum/biology/`，2026-11-09）上线后：跑一次 `node tools/e2e/live.mjs`；在 Safari 和桌面版里看一眼公式和三个演示（只在 Chromium 里测过）；文献是在 Crossref 逐条核对过的，但核对是经由网页抓取完成的，站长电脑上方便时可以再跑一次 `NODE_USE_SYSTEM_CA=1 node tools/fundamental-refs.mjs quantum-biology`。以后可以加：教学视频里的量子生物学条目（云端连不上 YouTube 和哔哩哔哩，没有核对视频）、演示 1 换成 HEOM 或加入振动模式、演示 2 加入多个核与射频场。
- 子模块“数学基础与探索”（`/fundamental-science/math/`，2026-11-08）上线后：在 Safari 和桌面版里看一眼关系图和公式；视频链接每半年复查一次（YouTube 和哔哩哔哩的转载可能下架，页面上写了核对日期）；以后可以给每门学科加一套带答案的小测验。
- 量子算法展馆（`/quantum/algorithms/`，2026-11-09，量子嘉年华的子栏目）上线后：跑 `node tools/e2e/live.mjs`；在 Safari 和桌面版里看一眼 MathML 公式和线路模拟器（只在 Chromium 里测过）；资源估算会随新论文过时，每半年对照新的估算更新 `estimates`（页面写了核对日期），新文献照例跑 `node tools/quantum-algorithms-refs.mjs`。模拟器的旋转门（Rx/Ry/Rz 带角度）、中途测量和 Bloch 球 2026-11-10 已加；以后可以考虑把 VQE 演示换成 H₂ 的 STO-3G 哈密顿量。
- 物理疆界图（`/physics-realms/`，2026-11-09）：42 个理论、67 个问题、213 条关系的力导向网状图，内容在 `pr-data.js`（`tools/realms-test.mjs` 查完整性）。上线后在 iPad 和 iPhone 的 Safari 里试一次拖动节点、双指缩放（只在无头 Chrome 里测过模拟触摸）；量子嘉年华合并后，在 `quantum/carnival.js` 的 AROUND 末尾加一行反向链接，量子物理页的页脚也链过来。以后可以加：每个理论的入门教材与视频、按年代播放理论出现的顺序。
- 基础科学栏目（`/fundamental-science/`，2026-11-07）上线后：跑一次 `node tools/e2e/live.mjs`；在 iPhone / Mac 的 Safari 和桌面版里看一眼 MathML 公式的排版（只在 Chromium 里测过）；单文件离线版（`tools/bundle-single.ts`）里打开这一页确认演示能用（没有实测）。之后可以考虑：演示 2 加入随机薛定谔方程的单次轨迹、演示 3 加入两个以上电子态，以及把文献库扩充到 GRW/CSL 的参数排除图。
- 在线模型已开通（2026-11-05）：15 个模型（UMA 四个、OMol25 的 AllScAIP 两个和 eSEN 三个、MACE 五个、ANI-2x，2026-11-08 起对所有人免费），隧道 `molastria-uma` → `uma-origin.molastria.com`。FEC 实测每个模型 1–14 秒（RTX 2080）。各档每天次数 2026-11-07 翻倍到 40 / 200 / 40 / 200（匿名 UMA 与 OMol25 / Pro / MACE / ANI-2x）。待办：观察一周的用量再调各档次数；考虑开启 Cloudflare Access 服务令牌；电脑开机自动启动（目前要手动运行 `start.ps1`）；UMA-M 1.1 要更大的内存和显存；可以向 MACE 作者要在线服务的书面许可；UMA-S 1.2.1 水的 IP 偏低，可以反馈给 fairchem。
- 模型接口（API v3，2026-11-06）：新页面 `/models/`，13 种计算（sp、opt、freq、conf、scan、md、rxn、ipea、spin、bde、pa、polar、ir），按计算量计次。站长电脑要用新版 `tools/uma-server/server.py` 重启 `start.ps1`（health 里有 `api: 3`）。真实模型试跑见 `tools/uma-server/realrun.py`：A 类最坏情况（30 个重原子）都在 600 s 内；MACE-OMOL-0、MACE-OFF23 large、MACE-MDP 的最坏情况还没测，MACE-OMOL-0 跑大分子的 md、freq 可能超时。
- 桌面版 0.1.14 装好后要人在真机上点一次：Mac 上点任意下载，应弹出系统“存储为”窗口（Mac 的保存窗口没有实测过）；Win 和 Mac 都从顶栏进“讲解手册”“数据库”“期刊发表”“科学大模型”看一眼，再看首页徽标和下载页片头视频有没有播放。Mac 桌面版的 WKWebView 从 Tauri 内置协议播视频可能要 Range 请求（内置协议只返回完整文件），没有实测；不支持时两处都退回 poster 静图。AI 面板片头：Windows 桌面版应正常播放（没在应用里实测，播不了会在 1.5 s 内淡出）；Mac 桌面版按 `location.protocol === 'tauri:'` 直接跳过，这个判断没在真机上验证过。
- 科学大模型的价格：2026-12-01 Gemini 4 Argon 涨到 4 / 20 美元，到时按 RUNBOOK 改价格和说明；之后每月核对一次。
- PWA 上线后要人在真机上看一次（只在 Chromium 里测过）：iPad / iPhone 的 Safari 添加到主屏幕后的图标、标题、全屏、状态栏下的深色条、从主屏幕第一次打开、断网打开看过的页面、开着 Service Worker 时视频能不能播（Range 请求绕过只在 Chromium 验证过）；iOS“作为网页 App 打开”开关的中文名和 iOS 26 分享菜单的写法；安卓 Chrome 的安装、maskable 图标裁切和启动底色。线上 `.webmanifest` 的内容类型和 Pages 的 10 分钟缓存与后台刷新的配合也没核对过。
- 每周精选第一期（周一）发出后看一眼：邮件显示、进垃圾箱没有、DeepSeek 花了多少。
- Morning Glory 品牌（中文名 2026-11-08 起改为阿斯特赖亚科技，原名晨光科技；2026-11-08，关于页 `/about/`）：条款写个人运营、商标归 16513778 Canada Inc.。商标从个人转到公司最好有一份书面转让（个人签给公司），站长自己留档；若以后 Stripe 转到公司名下，再把条款和隐私政策的主体改成公司。每周精选邮件的 CASL 发件人信息届时也可用公司名称和地址。
- 商业邮件合规：加拿大 CASL 一般要求邮件里有发件人的联系方式（如邮寄地址），每周精选现在只有网址和退订链接；要确认是否适用、放什么。
- 售后邮箱：在 Porkbun 设 `support@molastria.com` 转发，再填进 `public/pay/config.js` 的 `contactEmail`（现在售后只能去公开的 GitHub Issues）。
- 发信记录：在 Cloudflare DNS 加 `_dmarc` TXT 记录 `v=DMARC1; p=none`。
- 接上“管理订阅”按钮：把 Stripe 客户门户登录链接填进 `public/pay/config.js` 的 `portalUrl`（等用户提供链接）。
- 确认结账页和银行账单上的商户名是 MolAstria，不是 Chem（Stripe → Settings → Public details）。

## 接下来

GitHub 学生包里需要用户自己领取、领取后可以接进来的：
- Stripe 的 25 美元手续费额度（直接抵 MolAstria 的收款手续费）。
- Sentry（错误监控，网页和桌面版报错）与 SimpleAnalytics（不用 cookie 的访问统计）：领取后把 DSN / 站点名告诉 Claude 接入，并同步更新隐私政策。
- Honeybadger 的定时任务签到：监控每周目录刷新和每周精选有没有按时跑。

收入：
- 支付宝和微信支付：Stripe 支持加拿大商户，但不支持自动续费。做“一次性买一年”，有效期沿用 VIP 卡的计算方式。
- 工作流库（云同步已在 2026-11-10 做完，见“现在”）。
- 每周精选的来源比例：第一期 12 篇里 ChemRxiv 8 篇、arXiv 3 篇、期刊 1 篇，再看几期，需要的话按来源限量。
- 价格页更突出年付：月付单笔手续费约 11%，年付约 7%。

增长：
- 云端批量计算（2026-11-05 站长暂停）：`tools/cloud/` 代码和 MACE-OFF23 一段已在云端 L4 上验证过；L4 在美国各区普遍缺货，UMA 一段没跑成。要继续时：在虚拟机上登录 Hugging Face，跑 `tools/cloud/run.mjs`，再用真实 UMA 结果校准 MACE-OFF23 的两个阈值（0.3 Å / 0.2 eV）。云上的两台机器都关着，磁盘和快照还在计存储费。
- 网状查询：条目翻倍后网状查询页变慢（4 倍 CPU 减速下 1.5 → 1.8 s），可以懒加载或预先算好实体；“ESPRESSO”和目录里的“Quantum ESPRESSO”是两个节点，可以合并。
- 目录数据：定时自动刷新；把 arXiv、Crossref 期刊等快照也改成不依赖 Python；补上缺失的日期和占位摘要。
- 搜索引擎：生成英文静态页（`?lang=en` 和中文页 HTML 相同，没有 hreflang）；做主题合集页；到 Search Console 确认收录。
- 用大陆网络实测访问速度和百度收录（GitHub Pages 在这两方面都有风险）。
- 使用数据：Cloudflare Web Analytics（先更新隐私政策）。没有结果的搜索词现在只记在各人自己的浏览器里（网状查询的“没找到的词”，2026-11-10）；要在服务器上汇总所有人的，得先改隐私政策、在页面上明说并让用户能关，等站长决定（`docs/DECISIONS.md` 2026-11-10）。

## 以后再说

- 顶栏在 360 px 和 320 px 宽时让页面横向滚动（到 361 px）：第一行的站标加右侧按钮比屏幕宽，5bcee2f 就是这样，不是第三期造成的；390 px 没有问题。360 px 只差约 1.2 px（`shared-nav.css` 手机宽度下 `.cr-header` 的列间距是 10 px，减 2 px 应该就够，没试过），320 px 差约 41 px，要藏掉一个按钮。
- 英文站里以链接结尾的句子末尾会剩一个中文句号“。”（如模型接口页指向科学大模型栏目的那句）：`i18n.js` 不翻译只有标点、没有汉字的文字节点。
- PWA 没处理的：iPhone 横屏时 AI 面板右边可能在刘海下面；实验室、Meta、模型接口、训练页的提示条（`bottom: 24px`）在 iPhone 上压住主屏幕指示条约 10 px；雷达和量子化学的 iframe 伸到指示条下面。
- 390 px 下正文比容器宽 2 px：讲解手册第 17 类一章的 `#guide-article` scrollWidth 352、clientWidth 350，找不到超出右边界的元素，页面本身不横向滚动。
- 目录数据小错：Alexandria（#74）的说明写成“百万级分子的 DFT 性质数据集”，它其实是无机晶体库；网状查询里几个中文资源名（Burcat 热化学库、IUPAC 气相动力学、USPTO 反应数据集）英文站仍显示中文。
- 单文件版（`tools/bundle-single.ts`）没有打包模型接口页、开源代码台和量子算法 / 量子计算机两个展馆，手册第 17 类一章里指向 `../models/index.html`、第 12 类和第 16 类指向 `../code/`、`../quantum/algorithms/`、`../quantum/computing/` 的链接在单文件版里打不开。
- 文字对比度：讲解与数据库页 148 处、训练 Agent 页 71 处、论文与社区页 63 处、Pro 页 13 处不达标（axe，2026-10-31）。
- 代码整理：根目录遗留文件（`server.py`、`merge-report.json`、`verification.json`、`index.html`），`public/app.js` 的超长行，开 Dependabot。
- 代码签名：Apple Developer Program（US$99/年）加 Windows 证书，去掉首次打开时的安全提示。
- 如果收费功能变成主业，把网站从 GitHub Pages 搬到 Cloudflare（GitHub 条款不允许 Pages 主要用于商业交易；DNS 已在 Cloudflare）。
- Resend 每天超过 100 封时升级 Pro；Workers 每天超过 10 万次请求时升级 Workers Paid。

## 已完成

- 2026-11-10 讲解手册补写 12–16 类五章（量子化学程序与方法库、周期体系与凝聚态第一性原理、波函数分析与动力学、量子力学与量子化学课程教材、量子计算与量子化学算法），中英两版手写，共 25 章；章里的算例（水的方法阶梯、电荷随基组、Crawford 项目对照、两种 B3LYP、Jordan–Wigner 的项数与 1-范数、硅的 PBE 带隙）都由 `tools/handbook-calcs.py` 用 PySCF 2.15 重算，`tools/handbook-test.mjs` 核对条数、编号和数字；术语表从 109 组加到 156 组（平面波、准粒子、活性空间、面跳跃、泡利串等）；网状查询记下术语表认不出的词（只存本机，可复制、提交 GitHub Issue、删除、关闭）。

- 2026-11-09 游乐场大更新：从六个小游戏扩到三个展区十四个。展区二“量子嘉年华分会场”（Stern–Gerlach 自旋过滤、CHSH 贝尔游戏、量子电路拼图十道题、三比特纠错救援、Grover 寻宝、噪声助推能量传递），展区三“物理疆界”（普朗克单位工坊、ħ-c-G 立方体分拣），每个游戏链到对应展馆。数学在 `play-quantum-models.js`，`tools/play-test.mjs` 对照解析解，并和量子生物学展馆的求解器独立对拍；电路题的“最少门数”由测试穷举核对；英文全部手写。上线后在 iPad 上各玩一局（只在无头 Chrome 里测过）。
- 2026-11-07 量子化学栏目改名“游乐场”（地址仍是 `/qchem/`）：总览 + 六个小游戏（盒中粒子调颜色、猜轨道、电子排布、量子隧穿闯关、芳香性判断、氢原子光谱），计算器 QChem Web 成为其中一个标签；物理在 `play-models.js`，`tools/play-test.mjs` 用已知结果检验并确认每个隧穿关卡都能过关；英文全部手写。修好预印本雷达和计算器在 iPad（WebKit）开缩放时被切掉、在 Chrome 里底部被裁掉的问题。
- 2026-11-06 第三期（桌面版 0.1.14）：新栏目“科学大模型”（`scimodels/`，数据库第 17 类的 27 个模型，官方链接，价格对比图只放官方按 token 价格），数据库详情、手册第 17 类一章和首页页脚链过去；AI 助手面板改版，打开时播片头；背景面板加“徽标动画”开关；网页左下角“下载桌面版”浮窗（平板上是“添加到主屏幕”）；首页“收藏夹”按钮（合并首页和数据库页的收藏），“研究笔记”卡片重画，徽标重新居中裁切并放到标题旁；网状查询去掉“/”提示；网站可添加到主屏幕（PWA：manifest、`sw.js` 离线保存看过的页面、`offline.html`，下载页有说明）；英文数据库页 390 px 不再横向滚动；数据库页筛选改名“收藏夹”（英文 Saved）；顺带修好静态手册页（`guide/`）第 14 章以后的章节标签错位（`build-seo.ts` 的标签少了第 17 类一章）。
- 2026-11-06 第二期（桌面版 0.1.13）：讲解手册单独成栏目 `manual/`，顶栏放不下的入口收进“更多”；新栏目“期刊发表”（46 种期刊 + 2 个预印本平台，18 章投稿指导，只写官网核实过的内容）；数据库第 17 类“科学领域语言模型与多模态基础模型”27 条，讲解手册加一章（共 20 章）；论文与社区新增 14 个国际来源，目录 1,607 → 2,639 条、国际来源过半；chemdb-agent 0.2.0 源码进仓库（`agent/chemdb-agent/`），下载包由 `tools/pack-chemdb-agent.py` 确定性生成；桌面版点下载弹系统保存窗口；首页动态徽标、下载页片头视频（`assets/brand/`）。
- 2026-11-06 模型接口 API v3（`models/`）与桌面版 0.1.12。
- 2026-11-05 目录每周四自动刷新（`refresh-data.yml` + `check-catalogue.mjs`），当天先刷新一次：1,515 → 1,607 条；ChemDB Atlas 新增 84 条量子物理、量子力学与量子化学资源（程序、凝聚态第一性原理、波函数分析与动力学、课程教材、量子计算化学，共 187 条、16 类）。
- 2026-11-05 AI 设置的“其他兼容接口”内置 19 家服务商预设（只收浏览器能直接调用的），可按 key 获取模型列表；识图可用“AI 设置中的当前模型”。页面介绍仍只写 Muse / DeepSeek。
- 2026-11-05 GitHub 学生包：仓库加了 Codespaces 开发环境（`.devcontainer/`）和 Copilot 说明（`.github/copilot-instructions.md`）。
- 2026-11-05 桌面版 0.1.11：“在本机运行”在 Windows 上不再因缺 Triton 报错（runner.py 用 batch 设置）；内置 15 个在线模型的 Meta 页；Pro 的 AI 模型切换修复。
- 2026-11-05 桌面版“在本机运行 UMA”（Meta 页）：找 Python、检查 fairchem / GPU / Hugging Face 权限并给出安装命令，运行内置脚本、实时日志，IP/EA 一键导入 AI 实验室。真实计算还没跑过：等 facebook/UMA 的 Hugging Face 权限。
- 2026-11-05 “Meta × 化学”页（`meta/`）：Muse Spark 识图（图片 → SMILES，RDKit 逐个校验）、UMA 脚本生成器（fairchem + ASE，IP/EA 输出可直接导入 AI 实验室）、FAIR Chemistry 开放模型与数据集目录、fairchem 最新版本；首页、AI 实验室和训练页加了入口，导航加“Meta”。
- 2026-11-03 量子化学计算并入（`qchem/`，来自 qchem-web）：HF/DFT、CCSD(T)、FCI、激发态、VQE/QPE，新增量子点模块（核/壳有效质量模型、Yu 2003 经验尺寸曲线、石墨烯量子点、硅纳米团簇），中英文跟随站点。顺带修好 `tools/serve.ts` 在含中文的路径下找不到文件。
- 2026-10-31 每周精选（账号页、邮件、Pro 页标题预览）；站内搜索中英术语互查和“还可以”面板；雷达 `?q=` 直达搜索；Worker 日志。
- 2026-10-31 托管 AI 按花费计次、5 台设备上限、Pro 页文字修正。
- 2026-10-31 项目系统化：`CLAUDE.md`、`docs/`、项目命令、端到端测试、每周健康检查、使用说明书。
- 2026-10-29 桌面版 0.1.3；VIP 卡、站长永久 Pro、可拖宽的 AI 窗口、ChemRxiv 来源、预印本雷达。
- 2026-10-29 Pro 账号上线：付款后自动登录、邮箱验证码、AI 托管额度、课题组席位。
- 2026-10-28 收款（Stripe）、桌面版应用内更新、改名 MolAstria。
