---
name: refresh-chemrxiv
description: 从 Crossref 刷新目录快照里的 ChemRxiv 计算化学预印本，补好翻译，并检查结果。
argument-hint: "[天数=21] [条数=50]"
---

1. `deno run --allow-net --allow-read --allow-write tools/hub-chemrxiv.ts $ARGUMENTS`（报 `UnknownIssuer` 就加环境变量 `DENO_TLS_CA_STORE=system`）。
2. 抽几条看看是不是真的计算化学；如果跑偏了，调整脚本里的关键词。不要手改生成的数据文件。
3. `git diff --stat -- public/hub public/merged-data.*`：应该主要是替换 ChemRxiv 条目。
4. 跑 `i18n-extract`；有新词条再跑 `i18n-translate`。
5. `node tools/e2e/run.mjs catalogue`。
6. 告诉用户结果，提交和发布用 `/ship-site`。
