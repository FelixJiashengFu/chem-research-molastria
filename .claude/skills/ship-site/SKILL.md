---
name: ship-site
description: 测试、提交并推送网站改动，等发布完成后在线上验证。
disable-model-invocation: true
argument-hint: "[提交说明]"
---

用户输入这个命令，就是同意提交并推送到 `main`。提交说明：$ARGUMENTS（没写就根据改动自己写一句英文）。

1. `git status` 和 `git diff`，确认改动都是这次要发布的；不相干的改动先问用户。检查没有密钥、邮箱或 D1 备份混进来。
2. 改了界面文字的话，先跑 `i18n-extract` 和 `i18n-translate`。
3. 测试，有失败就停下来修：
   - `deno run --allow-read tools/account-test.ts`
   - `node --test tools/lab-test.mjs`
   - `node tools/e2e/run.mjs`
4. 提交（**不加** `Co-Authored-By` 行）。`git fetch origin`，落后就 rebase。推送：
   `git -c credential.helper= -c "credential.helper=!gh auth git-credential" push origin main`
5. 等 `Deploy to GitHub Pages` 工作流完成（`gh run watch … --exit-status`，放到后台运行）。
6. 跑 `node tools/e2e/live.mjs`，并打开这次改动的页面确认（网址加 `?v=时间戳` 避开缓存）。
7. 如果 `deploy/` 也改了，提醒用户还要 `/ship-worker`；如果桌面用户也该拿到这次改动，提醒可以 `/ship-desktop`。
8. 更新 `docs/ROADMAP.md`（要在推送前做，和这次一起提交）。
