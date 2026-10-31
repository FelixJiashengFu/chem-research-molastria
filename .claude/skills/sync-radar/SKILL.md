---
name: sync-radar
description: 把独立仓库 PreprintRadar 的最新网页版同步进 MolAstria 的 /radar/，补好翻译并测试。
---

PreprintRadar 是独立仓库（`D:\ChemDraw\PreprintRadar`），这里不要改它的代码，除非用户要求。

1. 在 `D:\ChemDraw\PreprintRadar` 看 `git status -sb` 和版本号，告诉用户要同步的是哪个版本、有没有未推送的提交。
2. 在那里运行 `deno task web`（生成 `site/`，已被忽略，不影响它的仓库）。
3. 回到本仓库：`deno run --allow-read --allow-write tools/vendor-radar.ts`。如果它报“规则变了”或“布局变了”，说明雷达改了结构，要相应更新 `tools/vendor-radar.ts`，不要手改 `public/radar/app/`。
4. 跑 `i18n-extract` 和 `i18n-translate`，检查新译文。
5. `node tools/e2e/run.mjs radar --net`，并截图看浅色、深色、英文。
6. 告诉用户结果，提交和发布用 `/ship-site`；桌面版用户要等下一个 `/ship-desktop`。
