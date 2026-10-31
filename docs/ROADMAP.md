# 路线图

做完就移到“已完成”。会话启动时会自动显示“现在”这一节，所以这一节要短。这个文件是公开的，私人事项放在本机 Claude 记忆里。

## 现在

- 接上“管理订阅”按钮：把 Stripe 客户门户登录链接填进 `public/pay/config.js` 的 `portalUrl`（等用户提供链接）。
- 更新 `public/pro/privacy.html` 的页面描述：还写着“网站不设账号”，已经不对了。
- 决定托管 AI 的 `deepseek-v4-pro` 怎么计次：用满 300 次的成本可能超过年付用户每月的收入（可选：一次算 3 次，或只开放 flash）。

## 接下来

- ChemRxiv 快照改成定时自动刷新（GitHub Actions 每周运行 `tools/hub-chemrxiv.ts` 并提交）。
- 价格页更突出年付：月付单笔手续费约 11%，年付约 7%。
- 把其余目录快照（arXiv、Crossref 期刊等，目前停在 2026-10-27）也改成不依赖 Python 的刷新脚本。

## 以后再说

- 代码签名：Apple Developer Program（US$99/年）加 Windows 证书，去掉首次打开时的安全提示。
- 如果收费功能变成主业，把网站从 GitHub Pages 搬到 Cloudflare（GitHub 条款不允许 Pages 主要用于商业交易；DNS 已在 Cloudflare）。
- Resend 每天超过 100 封时升级 Pro；Workers 每天超过 10 万次请求时升级 Workers Paid。

## 已完成

- 2026-10-31 项目系统化：`CLAUDE.md`、`docs/`、项目命令、端到端测试、每周健康检查。
- 2026-10-29 桌面版 0.1.3；VIP 卡、站长永久 Pro、可拖宽的 AI 窗口、ChemRxiv 来源、预印本雷达。
- 2026-10-29 Pro 账号上线：付款后自动登录、邮箱验证码、AI 托管额度、课题组席位。
- 2026-10-28 收款（Stripe）、桌面版应用内更新、改名 MolAstria。
