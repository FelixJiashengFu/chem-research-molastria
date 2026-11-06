# 路线图

做完就移到“已完成”。会话启动时会自动显示“现在”这一节，所以这一节要短。这个文件是公开的，私人事项放在本机 Claude 记忆里。

## 现在

- 在线 UMA 已开通（2026-11-05）：隧道 `molastria-uma` → `uma-origin.molastria.com`，账号服务已部署；FEC 的 IP/EA 实测 8.8 秒（RTX 2080，batch 设置）。待办：观察一周的用量再调 `UMA_DAILY`；考虑开启 Cloudflare Access 服务令牌；电脑开机自动启动（目前要手动运行 `start.ps1`）。
- 发新桌面版：桌面版“在本机运行”在 Windows + NVIDIA 上会因缺 Triton 报错，`runner.py` 已修，要发版才到用户手里。
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
- 说明讲解手册：给 12–16 类（量子化学程序、凝聚态第一性原理、波函数分析、课程教材、量子计算）补写章节；现有 19 章按原材料的 103 条写成，封面数字也还是 103。
- 网状查询：记录没有命中的查询词，用来补 `public/search-terms.js` 的概念组。
- 目录数据：定时自动刷新；把 arXiv、Crossref 期刊等快照也改成不依赖 Python；补上缺失的日期和占位摘要。
- 搜索引擎：生成英文静态页（`?lang=en` 和中文页 HTML 相同，没有 hreflang）；做主题合集页；到 Search Console 确认收录。
- 用大陆网络实测访问速度和百度收录（GitHub Pages 在这两方面都有风险）。
- 使用数据：Cloudflare Web Analytics（先更新隐私政策）、统计没有结果的搜索词（用来补 `public/search-terms.js`）。

## 以后再说

- 顶栏已有 9 个栏目：中文在 1181–1250 px 宽、英文在 1536 px 以下会折成两行。再加栏目前先考虑合并或做下拉菜单。
- 文字对比度：讲解与数据库页 148 处、训练 Agent 页 71 处、论文与社区页 63 处、Pro 页 13 处不达标（axe，2026-10-31）。
- 代码整理：根目录遗留文件（`server.py`、`merge-report.json`、`verification.json`、`index.html`），`public/app.js` 的超长行，开 Dependabot。
- 代码签名：Apple Developer Program（US$99/年）加 Windows 证书，去掉首次打开时的安全提示。
- 如果收费功能变成主业，把网站从 GitHub Pages 搬到 Cloudflare（GitHub 条款不允许 Pages 主要用于商业交易；DNS 已在 Cloudflare）。
- Resend 每天超过 100 封时升级 Pro；Workers 每天超过 10 万次请求时升级 Workers Paid。

## 已完成

- 2026-11-05 目录每周四自动刷新（`refresh-data.yml` + `check-catalogue.mjs`），当天先刷新一次：1,515 → 1,607 条；ChemDB Atlas 新增 84 条量子物理、量子力学与量子化学资源（程序、凝聚态第一性原理、波函数分析与动力学、课程教材、量子计算化学，共 187 条、16 类）。
- 2026-11-05 AI 设置的“其他兼容接口”内置 19 家服务商预设（只收浏览器能直接调用的），可按 key 获取模型列表；识图可用“AI 设置中的当前模型”。页面介绍仍只写 Muse / DeepSeek。
- 2026-11-05 GitHub 学生包：仓库加了 Codespaces 开发环境（`.devcontainer/`）和 Copilot 说明（`.github/copilot-instructions.md`）。
- 2026-11-05 桌面版“在本机运行 UMA”（Meta 页）：找 Python、检查 fairchem / GPU / Hugging Face 权限并给出安装命令，运行内置脚本、实时日志，IP/EA 一键导入 AI 实验室。真实计算还没跑过：等 facebook/UMA 的 Hugging Face 权限。
- 2026-11-05 “Meta × 化学”页（`meta/`）：Muse Spark 识图（图片 → SMILES，RDKit 逐个校验）、UMA 脚本生成器（fairchem + ASE，IP/EA 输出可直接导入 AI 实验室）、FAIR Chemistry 开放模型与数据集目录、fairchem 最新版本；首页、AI 实验室和训练页加了入口，导航加“Meta”。
- 2026-11-03 量子化学计算并入（`qchem/`，来自 qchem-web）：HF/DFT、CCSD(T)、FCI、激发态、VQE/QPE，新增量子点模块（核/壳有效质量模型、Yu 2003 经验尺寸曲线、石墨烯量子点、硅纳米团簇），中英文跟随站点。顺带修好 `tools/serve.ts` 在含中文的路径下找不到文件。
- 2026-10-31 每周精选（账号页、邮件、Pro 页标题预览）；站内搜索中英术语互查和“还可以”面板；雷达 `?q=` 直达搜索；Worker 日志。
- 2026-10-31 托管 AI 按花费计次、5 台设备上限、Pro 页文字修正。
- 2026-10-31 项目系统化：`CLAUDE.md`、`docs/`、项目命令、端到端测试、每周健康检查、使用说明书。
- 2026-10-29 桌面版 0.1.3；VIP 卡、站长永久 Pro、可拖宽的 AI 窗口、ChemRxiv 来源、预印本雷达。
- 2026-10-29 Pro 账号上线：付款后自动登录、邮箱验证码、AI 托管额度、课题组席位。
- 2026-10-28 收款（Stripe）、桌面版应用内更新、改名 MolAstria。
