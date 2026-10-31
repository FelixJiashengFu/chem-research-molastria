---
name: ship-desktop
description: 发布桌面版新版本：打标签、等 CI 构建 Win 和 Mac、核对更新清单。
disable-model-invocation: true
argument-hint: "<版本号，如 0.1.4>"
---

用户输入这个命令，就是同意发布版本 $ARGUMENTS。已安装的用户下次打开应用都会收到更新提示，所以发布前要确认内容。

1. `git fetch origin --tags`。确认本地没有未推送的改动、`origin/main` 的网站发布已成功（`gh run list --workflow pages.yml --limit 1`）。
2. 确认 `desktop-v$ARGUMENTS` 不存在，且版本号比最新标签大。没给版本号就建议下一个小版本并问用户。
3. 列出上个标签以来的提交：`git log --oneline <上个标签>..origin/main`，告诉用户这次包含什么。
4. 打标签并推送：
   `git tag -a desktop-v$ARGUMENTS -m "Desktop $ARGUMENTS: 一句话说明" origin/main`
   `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin desktop-v$ARGUMENTS`
5. 把 `gh run watch <运行编号> --repo FelixJiashengFu/chem-research-molastria --exit-status` 放到后台（约 15 分钟），等通知，不要轮询。
6. 完成后：`gh release view desktop-v$ARGUMENTS --repo FelixJiashengFu/chem-research-molastria --json assets`，再跑 `node tools/e2e/live.mjs`（它会核对 `latest.json` 和 Release 一致）。
7. 不要在用户的 MolAstria 开着时再启动一个实例。告诉用户：彻底退出再打开，应该弹出更新提示。
