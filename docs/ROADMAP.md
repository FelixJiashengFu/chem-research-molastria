# 路线图

做完就移到“已完成”。会话启动时会自动显示“现在”这一节，所以这一节要短。这个文件是公开的，私人事项放在本机 Claude 记忆里。

## 现在

- 上线 AI 托管限额和 Pro 页修正：代码已改好，等 `/ship-worker`，然后 `/ship-site`。
- 售后邮箱：在 Porkbun 设 `support@molastria.com` 转发，再填进 `public/pay/config.js` 的 `contactEmail`（现在售后只能去公开的 GitHub Issues）。
- 发信记录：在 Cloudflare DNS 加 `_dmarc` TXT 记录 `v=DMARC1; p=none`。
- 接上“管理订阅”按钮：把 Stripe 客户门户登录链接填进 `public/pay/config.js` 的 `portalUrl`（等用户提供链接）。
- 确认结账页和银行账单上的商户名是 MolAstria，不是 Chem（Stripe → Settings → Public details）。

## 接下来

收入：
- 支付宝和微信支付：Stripe 支持加拿大商户，但不支持自动续费。做“一次性买一年”，有效期沿用 VIP 卡的计算方式。
- 每周精选推送：用雷达查询、Crossref、DeepSeek、Resend 和 Worker 定时任务。之后做云同步。
- 价格页更突出年付：月付单笔手续费约 11%，年付约 7%。

增长：
- 站内搜索：中英同义词（现在搜“电解液”0 条，但有英文 electrolyte 条目）；没结果时引导去问 AI 或用雷达。
- 目录数据：定时自动刷新；把 arXiv、Crossref 期刊等快照也改成不依赖 Python；补上缺失的日期和占位摘要。
- 搜索引擎：生成英文静态页（`?lang=en` 和中文页 HTML 相同，没有 hreflang）；雷达页加静态介绍；做主题合集页；到 Search Console 确认收录。
- 用大陆网络实测访问速度和百度收录（GitHub Pages 在这两方面都有风险）。
- 使用数据：Cloudflare Web Analytics（先更新隐私政策）、Worker 日志（`[observability]`）、统计没有结果的搜索词。

## 以后再说

- 文字对比度：讲解与数据库页 148 处、训练 Agent 页 71 处、论文与社区页 63 处、Pro 页 13 处不达标（axe，2026-10-31）。
- 代码整理：根目录遗留文件（`server.py`、`merge-report.json`、`verification.json`、`index.html`），`public/app.js` 的超长行，开 Dependabot。
- 代码签名：Apple Developer Program（US$99/年）加 Windows 证书，去掉首次打开时的安全提示。
- 如果收费功能变成主业，把网站从 GitHub Pages 搬到 Cloudflare（GitHub 条款不允许 Pages 主要用于商业交易；DNS 已在 Cloudflare）。
- Resend 每天超过 100 封时升级 Pro；Workers 每天超过 10 万次请求时升级 Workers Paid。

## 已完成

- 2026-10-31 项目系统化：`CLAUDE.md`、`docs/`、项目命令、端到端测试、每周健康检查、使用说明书。
- 2026-10-29 桌面版 0.1.3；VIP 卡、站长永久 Pro、可拖宽的 AI 窗口、ChemRxiv 来源、预印本雷达。
- 2026-10-29 Pro 账号上线：付款后自动登录、邮箱验证码、AI 托管额度、课题组席位。
- 2026-10-28 收款（Stripe）、桌面版应用内更新、改名 MolAstria。
