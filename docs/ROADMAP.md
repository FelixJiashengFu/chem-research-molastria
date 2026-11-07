# 路线图

做完就移到“已完成”。会话启动时会自动显示“现在”这一节，所以这一节要短。这个文件是公开的，私人事项放在本机 Claude 记忆里。

## 现在

- 显示设置与金属箭头（2026-11-07，桌面版 0.1.16）：只在 Chromium（无头 Chrome）里测过。要在真机上看一次：iPad 主屏幕应用里的界面缩放（Safari 的 CSS zoom 与 Chrome 的坐标换算可能不同，网状查询的拖动和基础科学页的演示 3 拖动要试）、Mac 桌面版的原生缩放（WKWebView）和 Ctrl / ⌘ 加 = − 0、Windows 桌面版的原生缩放；楷体在 Windows 上是否装有 KaiTi。
- 基础科学栏目（`/fundamental-science/`，2026-11-07）上线后：跑一次 `node tools/e2e/live.mjs`；在 iPhone / Mac 的 Safari 和桌面版里看一眼 MathML 公式的排版（只在 Chromium 里测过）；单文件离线版（`tools/bundle-single.ts`）里打开这一页确认演示能用（没有实测）。之后可以考虑：演示 2 加入随机薛定谔方程的单次轨迹、演示 3 加入两个以上电子态，以及把文献库扩充到 GRW/CSL 的参数排除图。
- 在线模型已开通（2026-11-05）：15 个模型（UMA 四个、OMol25 的 AllScAIP 两个和 eSEN 三个、MACE 五个、ANI-2x 只给 Pro），隧道 `molastria-uma` → `uma-origin.molastria.com`。FEC 实测每个模型 1–14 秒（RTX 2080）。各档每天次数 2026-11-07 翻倍到 40 / 200 / 40 / 200（匿名 UMA 与 OMol25 / Pro / MACE / ANI-2x）。待办：观察一周的用量再调各档次数；考虑开启 Cloudflare Access 服务令牌；电脑开机自动启动（目前要手动运行 `start.ps1`）；UMA-M 1.1 要更大的内存和显存；可以向 MACE 作者要在线服务的书面许可；UMA-S 1.2.1 水的 IP 偏低，可以反馈给 fairchem。
- 模型接口（API v3，2026-11-06）：新页面 `/models/`，13 种计算（sp、opt、freq、conf、scan、md、rxn、ipea、spin、bde、pa、polar、ir），按计算量计次。站长电脑要用新版 `tools/uma-server/server.py` 重启 `start.ps1`（health 里有 `api: 3`）。真实模型试跑见 `tools/uma-server/realrun.py`：A 类最坏情况（30 个重原子）都在 600 s 内；MACE-OMOL-0、MACE-OFF23 large、MACE-MDP 的最坏情况还没测，MACE-OMOL-0 跑大分子的 md、freq 可能超时。
- 桌面版 0.1.14 装好后要人在真机上点一次：Mac 上点任意下载，应弹出系统“存储为”窗口（Mac 的保存窗口没有实测过）；Win 和 Mac 都从顶栏进“讲解手册”“数据库”“期刊发表”“科学大模型”看一眼，再看首页徽标和下载页片头视频有没有播放。Mac 桌面版的 WKWebView 从 Tauri 内置协议播视频可能要 Range 请求（内置协议只返回完整文件），没有实测；不支持时两处都退回 poster 静图。AI 面板片头：Windows 桌面版应正常播放（没在应用里实测，播不了会在 1.5 s 内淡出）；Mac 桌面版按 `location.protocol === 'tauri:'` 直接跳过，这个判断没在真机上验证过。
- 科学大模型的价格：2026-12-01 Gemini 4 Argon 涨到 4 / 20 美元，到时按 RUNBOOK 改价格和说明；之后每月核对一次。
- PWA 上线后要人在真机上看一次（只在 Chromium 里测过）：iPad / iPhone 的 Safari 添加到主屏幕后的图标、标题、全屏、状态栏下的深色条、从主屏幕第一次打开、断网打开看过的页面、开着 Service Worker 时视频能不能播（Range 请求绕过只在 Chromium 验证过）；iOS“作为网页 App 打开”开关的中文名和 iOS 26 分享菜单的写法；安卓 Chrome 的安装、maskable 图标裁切和启动底色。线上 `.webmanifest` 的内容类型和 Pages 的 10 分钟缓存与后台刷新的配合也没核对过。
- 每周精选第一期（周一）发出后看一眼：邮件显示、进垃圾箱没有、DeepSeek 花了多少。
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
- 云同步：下一个 Pro 功能；工作流库在它之后。
- 每周精选的来源比例：第一期 12 篇里 ChemRxiv 8 篇、arXiv 3 篇、期刊 1 篇，再看几期，需要的话按来源限量。
- 价格页更突出年付：月付单笔手续费约 11%，年付约 7%。

增长：
- 云端批量计算（2026-11-05 站长暂停）：`tools/cloud/` 代码和 MACE-OFF23 一段已在云端 L4 上验证过；L4 在美国各区普遍缺货，UMA 一段没跑成。要继续时：在虚拟机上登录 Hugging Face，跑 `tools/cloud/run.mjs`，再用真实 UMA 结果校准 MACE-OFF23 的两个阈值（0.3 Å / 0.2 eV）。云上的两台机器都关着，磁盘和快照还在计存储费。
- 说明讲解手册：给 12–16 类（量子化学程序、凝聚态第一性原理、波函数分析、课程教材、量子计算）补写章节；现有 20 章，其中 19 章按原材料的 103 条写成（封面数字也还是 103），第 17 类一章是 2026-11-06 新写的。
- 同步 chemdb-agent 工具包的目录：现在是 103 条，网站是 214 条。要连带改 `agent/chemdb-agent` 的 `catalog/resources.py`、`tests/test_resources.py`（断言 103 条、11 类）、`server.py`、README，再 `python tools/pack-chemdb-agent.py`。
- 网状查询：记录没有命中的查询词，用来补 `public/search-terms.js` 的概念组。条目翻倍后网状查询页变慢（4 倍 CPU 减速下 1.5 → 1.8 s），可以懒加载或预先算好实体；“ESPRESSO”和目录里的“Quantum ESPRESSO”是两个节点，可以合并。
- 目录数据：定时自动刷新；把 arXiv、Crossref 期刊等快照也改成不依赖 Python；补上缺失的日期和占位摘要。
- 搜索引擎：生成英文静态页（`?lang=en` 和中文页 HTML 相同，没有 hreflang）；做主题合集页；到 Search Console 确认收录。
- 用大陆网络实测访问速度和百度收录（GitHub Pages 在这两方面都有风险）。
- 使用数据：Cloudflare Web Analytics（先更新隐私政策）、统计没有结果的搜索词（用来补 `public/search-terms.js`）。

## 以后再说

- 顶栏在 360 px 和 320 px 宽时让页面横向滚动（到 361 px）：第一行的站标加右侧按钮比屏幕宽，5bcee2f 就是这样，不是第三期造成的；390 px 没有问题。360 px 只差约 1.2 px（`shared-nav.css` 手机宽度下 `.cr-header` 的列间距是 10 px，减 2 px 应该就够，没试过），320 px 差约 41 px，要藏掉一个按钮。
- 英文站里以链接结尾的句子末尾会剩一个中文句号“。”（如模型接口页指向科学大模型栏目的那句）：`i18n.js` 不翻译只有标点、没有汉字的文字节点。
- PWA 没处理的：iPhone 横屏时 AI 面板右边可能在刘海下面；实验室、Meta、模型接口、训练页的提示条（`bottom: 24px`）在 iPhone 上压住主屏幕指示条约 10 px；雷达和量子化学的 iframe 伸到指示条下面。
- 390 px 下正文比容器宽 2 px：讲解手册第 17 类一章的 `#guide-article` scrollWidth 352、clientWidth 350，找不到超出右边界的元素，页面本身不横向滚动。
- 目录数据小错：Alexandria（#74）的说明写成“百万级分子的 DFT 性质数据集”，它其实是无机晶体库；网状查询里几个中文资源名（Burcat 热化学库、IUPAC 气相动力学、USPTO 反应数据集）英文站仍显示中文。
- 单文件版（`tools/bundle-single.ts`）没有打包模型接口页，手册第 17 类一章里指向 `../models/index.html` 的链接在单文件版里打不开。
- 文字对比度：讲解与数据库页 148 处、训练 Agent 页 71 处、论文与社区页 63 处、Pro 页 13 处不达标（axe，2026-10-31）。
- 代码整理：根目录遗留文件（`server.py`、`merge-report.json`、`verification.json`、`index.html`），`public/app.js` 的超长行，开 Dependabot。
- 代码签名：Apple Developer Program（US$99/年）加 Windows 证书，去掉首次打开时的安全提示。
- 如果收费功能变成主业，把网站从 GitHub Pages 搬到 Cloudflare（GitHub 条款不允许 Pages 主要用于商业交易；DNS 已在 Cloudflare）。
- Resend 每天超过 100 封时升级 Pro；Workers 每天超过 10 万次请求时升级 Workers Paid。

## 已完成

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
