# 更新记录

## 未发版

- **资源目录与网站同步：** 从 214 条增加到 228 条（2026-11-10 新收录 psi4numpy、Psi4Education、Quirk、QuTiP、3Dmol.js、Mol*、ColabFold 等 14 条），仍是 17 类。

## 0.3.0（2026-11-09）

- **三个计算工具：** `run_calculation` 把一个分子（SMILES 或 XYZ）交给 MolAstria 计算接口，用机器学习势做
  单点、优化、频率、构象搜索、扫描、分子动力学、反应路径、电离能与电子亲和能、自旋态、键解离能、质子亲和能，
  默认等到算完；`get_calculation` 取一个任务的状态和结果；`compute_status` 看那块 GPU 在不在线、最近 7 天的
  在线率（不用 key）。需要环境变量 `MOLASTRIA_API_KEY`（在 https://molastria.com/pro/account.html 登录后生成，
  免费）。
- **如实说明算力：** 算力是站长电脑上的 RTX 2080，尽力而为，可能离线；每个结果和每条报错都带这句话。一个账号
  同时只能有一个任务，次数和网站上的在线模型共用。MACE 系列是学术许可（ASL），不通过接口提供。
- **不重试没有用的错误：** 次数用完、已有任务（429）和电脑离线（503）直接把服务给的中文说明和代号交回来，
  不像数据源那样退避重试。

## 0.2.1（2026-11-09）

- **资源目录与网站同步：** `search_resources` 和 `catalog_status` 的目录从 103 条、11 类增加到 214 条、17 类
  （新增量子化学程序、周期体系第一性原理、波函数分析、课程教材、量子计算、科学大模型）。条目放在
  `catalog/resources.json`，由仓库的 `tools/build-api.mjs` 从网站数据生成，和 MolAstria 开放数据接口
  （`https://molastria.com/api/v1/resources.json`，另有英文说明）同源；原有 103 条的编号和内容不变。

## 0.2.0（2026-11-06）

- **MCP 工具接通：** `search_structures`、`get_record`、`search_molecules`、`find_qm_data`、`get_basis`、
  `fetch_dataset_shard`、`export_training_set` 不再返回占位，接到真实适配器上。每个数据源在线程里查询，
  单独超时；完整记录按 `record_id` 缓存（sqlite，默认 7 天）；参数不对、找不到、缺 key、数据源报错都给出
  中文说明，不让服务器崩溃。每个工具参数都有说明。
- **共用 HTTP（`net.py`）：** 超时默认 30 秒，网络错误、5xx、429 退避重试共 3 次，4xx 带上服务器给的原因。
- **Materials Project：** 没有 `MP_API_KEY` 时明确提示怎么配置，并指向不需要 key 的 `optimade-mp`。
- **OPTIMADE：** 改为直接按规范请求（不再依赖 optimade 客户端库）。新增 Alexandria（PBE、PBEsol，带总能量、
  力、应力）、Materials Project、OQMD、MC3D-PBEsol、MC2D、ODBX、GNoME、OMDB、2DMatPedia，共 15 个库。
  化学式按约化式规范化，结果在本地再核对组成；已知每页上限（COD 为 10）。MC3D 带总能量。
- **新数据源：** NOMAD 原生接口（总能量、力、应力，SI 单位换算）、QCArchive（`ml` 与 `main` 公共服务器，
  Hartree/Bohr 换算，梯度转力，拒绝只有校正能量的 dftd3 等规格）、ChEBI。
- **本地目录：** 分片（jsonl + manifest）与 sqlite 索引，可由 manifest 重建；`fetch_dataset_shard` 先估计大小，
  超过 2 GB 要确认。
- **训练集导出：** extxyz 与 ASE 数据库，能量/力/应力挂在 ASE 计算器上；来源清单逐条记录来源、理论级别、
  许可和获取时间，并提示非商业、相同方式共享和许可不明的记录；理论级别不一致时拒绝并说明差别，可指定一个键
  或显式允许混用；纯结构记录不能导出；导出路径限制在数据目录内。
- **资源目录：** ChEBI、NOMAD、QCArchive 改为独立适配器，OQMD、Alexandria 改为 OPTIMADE 接入。
- **依赖：** 去掉没用到的 optimade、duckdb、pyarrow、requests-cache；显式声明 requests。
- **测试：** 离线单元测试覆盖每个适配器、单位换算、缓存与错误处理、导出格式；`tests/test_live.py` 为联网冒烟测试。
  录制的接口返回去掉了 API key 与 Cookie。

## 0.1.0（2026-10-27）

- 骨架：统一记录、单位换算与理论级别键；PubChem、BSE、Materials Project、ChEMBL 与 5 家 OPTIMADE 适配器；
  资源目录与 `search_resources`、`catalog_status`；其余工具为占位。
