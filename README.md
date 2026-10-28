# ChemResearch Hub · 计算化学研究导航（合并版）

## 直接打开

1. 先把压缩包**全部解压**到一个文件夹，不要在压缩软件里单独打开网页。
2. 双击根目录 `index.html`，或双击 `打开网站.bat`。
3. 首页可以统一搜索；顶部导航可进入网状查询、中文讲解、论文与社区、Agent 工程。

浏览本地目录、图谱和讲解不需要安装任何依赖，也不需要联网。访问原文、官网和论文链接需要联网。收藏保存在当前浏览器，换浏览器或换电脑不会自动同步。

若浏览器限制本地文件，安装 Python 3 后运行 `启动本地预览.bat`。它只在本机启动预览，自动选择空闲端口，关闭终端或按 Ctrl+C 即可结束。

## 合并内容

- 统一检索两个项目原有的 1,487 条记录：ChemVis Hub 1,384 条 + ChemDB Atlas 103 条。
- 按网址合并 22 条重复记录，首页与网状查询使用 1,465 条独立资源。重复资源保留两边的原始出处和说明。
- 支持多关键词检索、内容范围、来源、类型、日期排序、收藏、CSV 导出及资源出处详情。
- 网状查询包含原有来源和 Atlas 目录，支持关键词、来源筛选、节点定位、拖动与缩放，也可使用节点下拉框进行键盘操作。
- Atlas 的 103 条目录、19 章中文讲解、Agent 工程状态说明和源码下载完整保留。
- Hub 的论文、教程、社区来源状态和内容分布看板保留，作为统一入口下的独立栏目。

统计由实际条目计算。一个资源可能被多个来源收录，因此各来源数量相加可能大于去重总数。

## 数据日期与能力范围

数据使用原项目保存的 2026-10-27 快照；本包于 2026-10-28 合并。此过程未重新抓取或逐个核验外部站点。论文“最新”顺序对应快照中的日期，来源接入状态对应保存时的状态。

目录中的全文、登录要求、更新日期与使用许可请查看原站。Agent 页面区分已有适配器代码与仍待连接的 MCP 查询/训练集导出；网页不会执行尚未实现的接口。

本次交付为本地压缩包；没有把合并版部署或提交给 Google。原网站的线上版本保持原状。

## 文件结构

```text
index.html                 双击入口
打开网站.bat               Windows 一键打开
启动本地预览.bat / server.py 可选的本机预览
public/                    可独立部署的完整静态网站
  index.html / app.js       合并搜索首页
  merged-data.json / .js    可核查目录与离线脚本
  shared-nav.css / .js      各栏目共同导航
  atlas/                   原数据库目录、19章讲解、Agent与下载包
  hub/                     原内容看板、合并后的网状查询、原始数据快照
maintenance/               可选数据更新与合并工具
merge-report.json          合并统计
```

## 可选：更新数据

仅需要浏览网站时，请忽略本节。更新数据需要联网和 Python 3；爬虫沿用原项目的数据源策略，失败时保留旧快照。

在本包根目录打开 PowerShell：

```powershell
python -m venv maintenance/.venv
maintenance/.venv/Scripts/python.exe -m pip install -r maintenance/requirements.txt
maintenance/.venv/Scripts/python.exe maintenance/refresh_data.py
```

完成后重新载入网页。更新工具会同步 Hub JSON、离线数据脚本和去重后的统一目录；Atlas 中文讲解和固定目录不随抓取更新。

只修改本地数据、需要重新合并时运行：

```powershell
python maintenance/merge_data.py
```

`merge_data.py` 只使用 Python 标准库。它归一化域名、http/https、末尾斜杠和跟踪参数，并保留页面路径、普通查询参数与片段。原始地址与完整原始记录保存在合并条目中。

## 后续公开上线

把 `public/` 整个目录作为静态网站发布目录即可，无需构建、后端或 API 密钥；无需上传 maintenance、Git 历史或缓存。获得公开网址后，再完成 Search Console 验证、正式网址的 canonical 与 sitemap 配置和收录申请。本包未写死旧网站地址，便于选择最终域名。
