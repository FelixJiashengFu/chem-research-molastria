# ChemResearch Hub · 计算化学研究导航

计算化学资源统一入口：1,465 条去重资源（数据库、软件、教程、论文、开源项目）、网状查询、19 章中文讲解，以及新增的 **AI 实验室**——按“闭环 AI 科学家”计划做电解液溶剂分子发现。AI 由 DeepSeek 或 Meta Muse 驱动。

纯静态网站，`public/` 就是发布目录，不需要后端。

## 栏目

| 栏目 | 路径 | 说明 |
| --- | --- | --- |
| 统一搜索 | `public/index.html` | 多关键词检索、筛选、收藏、CSV 导出；自然语言问句会退回到相关度近似匹配 |
| 网状查询 | `public/hub/network.html` | 来源 / 主题 / 数据库关系图，点节点跨库查询 |
| 中文讲解与数据库 | `public/atlas/index.html` | 103 条数据库目录、19 章讲解阅读器、Agent 工程说明 |
| 论文与社区 | `public/hub/index.html` | 来源接入状态、内容分布、论文与教程快照 |
| AI 实验室 | `public/lab/index.html` | 闭环电解液分子发现工作台（见下） |
| AI 助手 | 每页右上角 | “问目录”先检索本站目录再作答并标注出处；“自由提问”直接对话 |
| 静态页（给搜索引擎） | `public/guide/`、`public/resources/` | 由 `tools/build-seo.ts` 生成的讲解章节与资源目录 |

全站共用一套颜色变量（`shared-nav.css`），支持浅色 / 深色，右上角可切换并记住选择。

## AI 实验室

对应《Closed-Loop AI Scientist: A Ten-Day Plan for Electrolyte Molecule Discovery》的六步闭环：

1. **提出**：Muse Wonder / DeepSeek 按 JSON 给出 SMILES 与设计理由。提示词自动带上当前 Pareto 前沿、上一轮被过滤的分子、被 DFT 推翻的判断。
2. **RDKit 过滤**（浏览器里的 RDKit.js）：元素限制（C/H/O/F，可放宽 N/S/P/B）、≤ 20 个重原子、中性闭壳层单分子、危险基团 SMARTS（过氧、叠氮、重氮、酰卤等）、合成复杂度近似值、InChIKey 去重、与 9 个种子溶剂的 Morgan 指纹相似度。
3. **计算结果**：生成 rowan-python 脚本（Tier 1 UMA / Tier 2 氧化还原电位 / Tier 3 ωB97M-V，先 `is_draft=True` + `dispatch_info()` 估价），导入 CSV / JSON 结果。
4. **可靠性层**：先验误差（UMA-S 还原电位 MAE 0.261 V、EA MAE 0.439 eV）、UMA-S/M 分歧、适用域、参考集距离、Rowan 警告；可用已完成的 DFT 校准阈值（MAE、偏差、Spearman ρ）。
5. **前沿与 DFT 预算**：IP–EA Pareto 前沿（Li⁺ 结合能作约束，差距小于先验误差视为并列）、逐轮回放、超体积曲线；按“在前沿附近 × 存疑程度”在本轮 credits 预算内挑 2–3 个做 DFT；十轮 credits 预算表。
6. **候选卡片**：结构图、三级结果、可靠性、DFT 确认 / 推翻、PubChem 新颖性（按 InChIKey 查询），导出 Markdown 报告与 CSV。

项目状态存在浏览器 localStorage，可导出 / 导入 JSON。「载入演示数据」用固定的分子跑真实的 RDKit 过滤，但 IP/EA/Li⁺/电位/DFT 数值是**合成值**，页面上有明确标注。

CSV 列：`smiles, ip_uma_s, ip_uma_m, ea_uma_s, ea_uma_m, li_uma_s, li_uma_m, e_ox, e_red, rowan_warning, ip_dft, ea_dft, rowan_url`（能量单位 eV，电位为相对 SCE 的 V，页面按设置换算到 Li/Li⁺）。

## 接入 DeepSeek 与 Muse

两种方式，可以同时存在：

**A. 访客自带 key（默认，无需服务器）**
右上角「AI 助手」→ 设置，选 DeepSeek（`https://api.deepseek.com`，模型 `deepseek-flash` / `deepseek-v4-pro`）、Meta Muse（`https://api.meta.ai/v1`，模型 `muse-spark-1.3` / `muse-wonder-1.0`）或任意 OpenAI 兼容接口。两家接口都允许浏览器跨域直连（2026-10-28 实测预检通过）。key 默认只保存在当前标签页（sessionStorage），勾选“记住”才写入 localStorage。

**B. 站点代理（站长托管 key，访客免配置）**
部署 `deploy/ai-proxy-worker.js` 到 Cloudflare Workers，把 key 放进 Worker 的 secret，再把 Worker 地址填进 `public/ai/config.js` 的 `proxy`。Worker 会检查来源网站、模型白名单和输出上限，可绑定 Rate Limiting 防滥用。部署命令写在文件头部注释里。

本地测试代理：

```powershell
$env:DEEPSEEK_API_KEY = "<你的 key>"; deno run --allow-net --allow-env --allow-read tools/proxy-local.ts 8831 http://localhost:8830
```

## 上线到 GitHub Pages 并提交 Google

1. 在 `site.config.json` 里确认正式网址 `siteUrl`（正式网址 `https://molastria.com/`）。
2. 推送到 GitHub 仓库的 `main` 分支，在仓库 Settings → Pages 里把 Source 设为 **GitHub Actions**。`.github/workflows/pages.yml` 会跑测试、重新生成 SEO 页面和 sitemap，然后发布 `public/`。
3. 打开 [Google Search Console](https://search.google.com/search-console)，添加“网址前缀”资源，填正式网址。验证方式选 **HTML 标记**，把 `content="…"` 里的值填进 `site.config.json` 的 `googleSiteVerification`，推送后点验证。
4. 在 Search Console →「站点地图」提交 `sitemap.xml`，再用「网址检查」对首页和 `lab/`、`resources/`、`guide/` 请求编入索引。

正式网站：https://molastria.com/ 。自定义域名使 robots.txt 位于域名根目录；Search Console 可用 DNS TXT 验证「网域」资源，再提交 https://molastria.com/sitemap.xml。

SEO 内容由 `tools/build-seo.ts` 生成：每页 canonical、Open Graph / Twitter 卡片、JSON-LD（WebSite、Dataset、TechArticle、BreadcrumbList、WebApplication），19 个讲解章节和 14 个资源目录静态页，`sitemap.xml`、`robots.txt`、`404.html`。分享图 `public/og.png` 由 `tools/og.html` 渲染。

## 开发命令

```powershell
deno run --allow-net --allow-read tools/serve.ts 8830              # 本地预览 public/
deno run --allow-read --allow-write tools/build-seo.ts             # 生成 SEO 页面、sitemap
deno run --allow-read --allow-write tools/theme.ts                 # 首页 / Atlas 样式的深色配色
deno run --allow-read --allow-write tools/bundle-single.ts         # 生成 dist/ChemResearchHub-单文件版.html
node --test tools/lab-test.mjs                                     # 实验室决策逻辑单元测试
deno run --allow-read --allow-net --allow-env tools/ai-smoke.ts    # 用真实 DeepSeek key 测 ai.js（需 DEEPSEEK_API_KEY）
```

## 文件结构

```text
public/                    发布目录
  index.html / app.js       统一搜索
  shared-nav.css / .js      全站顶栏、颜色变量、深色模式、AI 入口
  theme-auto.css            首页与 Atlas 写死颜色的深色版本（tools/theme.ts 生成）
  ai/ai.js / config.js      AI 接入层与助手抽屉；站点代理配置
  lab/                      AI 实验室（index.html、lab.js、chem.js、lab.css）
  atlas/ hub/               原有栏目
  guide/ resources/         静态 SEO 页（生成）
  sitemap.xml robots.txt 404.html og.png favicon.svg
deploy/ai-proxy-worker.js   可选的 Cloudflare Worker AI 代理
tools/                      预览、构建、测试脚本
maintenance/                数据更新与合并工具（Python）
site.config.json            正式网址与 Search Console 验证码
```

## 数据与边界

目录数据为 2026-10-27 快照，合并时未重新抓取外部网站；全文、更新日期与使用许可以原站为准。数据更新方法见 `maintenance/` 中的脚本（需要 Python 3）：

```powershell
python -m venv maintenance/.venv
maintenance/.venv/Scripts/python.exe -m pip install -r maintenance/requirements.txt
maintenance/.venv/Scripts/python.exe maintenance/refresh_data.py
```

更新后重新运行 `tools/build-seo.ts`。

实验室的已知局限：电位工作流溶剂固定为乙腈，只适合相对排序；忽略阴离子与电极界面；不考虑黏度、熔点、闪点、电导率；合成复杂度是启发式近似，不是 SA score；SCE→Li/Li⁺ 默认 +3.28 V（水相约定），乙腈体系需核对。
