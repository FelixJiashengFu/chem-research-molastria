---
name: site-status
description: 查看 MolAstria 的全局状态：本地代码、GitHub 发布、线上网站、账号服务、桌面版和路线图。用户问“现在什么情况”“线上正常吗”时使用。只读，不改任何东西。
allowed-tools: Bash(git status*) Bash(git log*) Bash(git fetch*) Bash(gh run list*) Bash(gh release view*) Bash(node tools/e2e/live.mjs*) Read
---

只读检查，不要修改、提交或部署任何东西。

1. `git fetch origin --tags`，然后 `git status -sb` 和 `git log --oneline -5 origin/main`。
2. 最近的工作流：`gh run list --repo FelixJiashengFu/chem-research-molastria --limit 5 --json workflowName,headSha,status,conclusion,createdAt`。特别留意最近一次 `Health check` 是否失败。
3. 最新桌面版：`gh release view --repo FelixJiashengFu/chem-research-molastria --json tagName,publishedAt`，并算出之后 `main` 上还有多少提交没进桌面版。
4. 线上检查：`node tools/e2e/live.mjs`。如果没装依赖，先 `npm ci --prefix tools/e2e`。
5. 读 `docs/ROADMAP.md` 的“现在”一节。

用中文简短汇报：什么正常、什么不正常、接下来最该做哪一件。
