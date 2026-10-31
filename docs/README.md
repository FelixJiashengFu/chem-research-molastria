# 怎么继续开发 MolAstria

这个项目不依赖任何一段聊天。背景都写在仓库里，每次新开会话都能接着做。

## 开始一次新工作

1. 在 Claude 桌面版的 Code 页新建会话，文件夹选 **`D:\ChemDraw\ChemResearchHub`**。终端里则是 `cd D:\ChemDraw\ChemResearchHub`，然后运行 `claude`。
2. 直接说要做什么，比如“给价格页加一个常见问题”。Claude 启动时会自动读 `CLAUDE.md`，并看到当前分支、有没有落后、路线图上的待办。
3. 一件事一个会话。做完说“收尾”或输入 `/wrap-up`，它会更新路线图和决定记录。

想接着上次的对话，在侧栏点开旧会话即可（终端里是 `claude --continue` 或 `claude --resume`）。但聊得很长的旧会话不如新开一个：背景在文档里，不会丢。

## 可以用的命令

| 命令 | 做什么 |
| --- | --- |
| `/site-status` | 看全局状态：代码、线上网站、账号服务、桌面版、待办 |
| `/ship-site` | 测试、提交、推送，发布网站并在线上验证 |
| `/ship-worker` | 测试、迁移数据库（如果需要）、部署账号服务 |
| `/ship-desktop 0.1.4` | 发布桌面版新版本 |
| `/refresh-chemrxiv` | 刷新 ChemRxiv 预印本快照 |
| `/sync-radar` | 把预印本雷达的新版本同步进来 |
| `/wrap-up` | 收尾：更新路线图、决定记录，准备提交 |

`/ship-*` 只有你输入时才会运行，Claude 不会自己触发。

## 每样东西放在哪

| 内容 | 位置 | 丢了怎么办 |
| --- | --- | --- |
| 代码、文档、测试 | GitHub（公开仓库） | 重新克隆 |
| 项目规则和背景 | `CLAUDE.md`、`docs/` | 同上 |
| 私人笔记（你的邮箱、待换的密钥等） | 本机 Claude 记忆 `~/.claude/projects/D--ChemDraw/memory/` | 换电脑时复制过去 |
| 服务密钥 | Cloudflare 和 GitHub 的密钥存储，原件在你的密钥匣 | 到各服务商重新生成 |
| 桌面版更新签名私钥 | `~/.tauri/molastria-updater.key` 和 GitHub 密钥 | **无法重新生成，务必备份** |
| 用户账号数据 | Cloudflare D1 | 定期备份，见 `RUNBOOK.md` |

## 文档索引

- [`../CLAUDE.md`](../CLAUDE.md)：每次会话自动读取的规则和命令
- [`ROADMAP.md`](ROADMAP.md)：要做的事
- [`DECISIONS.md`](DECISIONS.md)：做过的决定和原因
- [`ARCHITECTURE.md`](ARCHITECTURE.md)：系统结构和用到的服务
- [`RUNBOOK.md`](RUNBOOK.md)：每种操作的步骤、排障、备份、换电脑
- [`../PAYMENTS.md`](../PAYMENTS.md)：收款和账号服务的开通记录
