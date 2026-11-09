# chemdb-agent

计算化学数据库 Agent：一个 MCP 服务器。用自然语言跨库检索晶体、分子和量子化学数据，
统一单位、理论级别与来源记录，再导出 extxyz 或 ASE 数据库训练集，直接交给 MACE、SchNetPack 等使用。

版本 0.3.0。改了什么见 `CHANGELOG.md`。

## 能做什么

| 工具 | 作用 |
| --- | --- |
| `search_structures` | 按化学式或元素跨库查晶体；返回是否带能量、理论级别、许可，以及每个库的状态 |
| `get_record` | 按 `record_id` 取完整记录（extxyz 结构、能量、力、应力、来源）；先查缓存和本地分片 |
| `search_molecules` | 按名称、SMILES 或 InChIKey 查分子（PubChem、ChEMBL、ChEBI） |
| `find_qm_data` | 在 QCArchive 公共服务器上找量子化学数据集：规格（方法/基组/程序）、条数、许可；不下载 |
| `fetch_dataset_shard` | 把 QCArchive 数据集的一段下载到本地目录并登记索引；估计超过 2 GB 要确认 |
| `export_training_set` | 导出 extxyz / ASE db 与来源清单；理论级别不一致时拒绝并说明差在哪 |
| `get_basis` | 取基组与 ECP 文本（Basis Set Exchange，离线） |
| `search_resources` | 查资源目录（与 MolAstria 网站同一份，214 条、17 类；随包安装，离线可用） |
| `catalog_status` | 数据源清单、本地分片、缓存与资源目录概况（不联网） |
| `run_calculation` | 把一个分子（SMILES 或 XYZ）交给 MolAstria 计算接口，用机器学习势算：单点、优化、频率、构象、扫描、分子动力学等 11 种；默认等到算完 |
| `get_calculation` | 按任务编号取状态和结果（任务算完后保留一小时） |
| `compute_status` | 计算接口背后那块 GPU 最近一次探测在不在线、最近 7 天的在线率（不用 key） |

每个工具的参数都带说明，MCP 客户端列工具时能看到。

## 计算（MolAstria 计算接口）

后三个工具不查数据库，而是真的去算：把分子交给 [MolAstria 计算接口](https://molastria.com/api/#compute)，
用 UMA、eSEN、AllScAIP、ANI-2x 这些机器学习势算，和网站上的在线模型是同一个队列。

- **key：** 在 <https://molastria.com/pro/account.html> 用邮箱登录后生成（免费），放进 `MOLASTRIA_API_KEY`。
  没有 key 时这三个工具里只有 `compute_status` 能用，其余工具不受影响。
- **算力：** 站长电脑上的一块 RTX 2080，尽力而为，可能离线。不要用在有时限的任务上；先用 `compute_status` 看一眼。
- **限制：** 一个账号同时只能有一个任务；每天的次数和网站上算的加在一起（免费 100 次，Pro 200 次），
  频率、构象、扫描这类计算一次花不止一次。结果里的 `usage` 是今天还剩多少。
- **等待：** `run_calculation` 默认最多等 120 秒；到时间还没算完会返回任务编号，任务继续算，
  用 `get_calculation` 接着取。
- **许可：** MACE 系列是学术许可（ASL），不通过接口提供。

## 数据源

`record_id` 的前缀就是数据库名。2026-11-06 逐个实测过的接口：

| 数据库 | 内容 | 能量 | 需要 key | 许可 |
| --- | --- | --- | --- | --- |
| `mp` | Materials Project 官方接口 | 形成能/原子（MP 兼容性校正） | `MP_API_KEY` | MP 使用条款 |
| `nomad` | NOMAD 原生接口，周期体系计算 | 总能量、力、应力（SI 单位换算） | 否 | CC BY 4.0 |
| `optimade-alexandria-pbe`、`optimade-alexandria-pbesol` | Alexandria | 总能量、力、应力 | 否 | CC BY 4.0 |
| `optimade-materialscloud`、`optimade-mc3d-pbesol` | Materials Cloud MC3D（PBE / PBEsol） | 总能量 | 否 | 见提供方 |
| `optimade-mp` | Materials Project 的 OPTIMADE 端点 | 无（只有结构） | 否 | MP 使用条款 |
| `optimade-aflow`、`optimade-cod`、`optimade-nomad`、`optimade-jarvis`、`optimade-oqmd`、`optimade-mc2d`、`optimade-odbx`、`optimade-gnome`、`optimade-omdb`、`optimade-twodmatpedia` | 各家 OPTIMADE 端点 | 无（只有结构） | 否 | AFLOW 条款、COD 为 CC0、OQMD 为 CC BY 4.0、GNoME 为 CC BY-NC 4.0，其余见提供方 |
| `pubchem` | PubChem 三维构象（MMFF94） | 无 | 否 | 公有领域 |
| `chembl`、`chebi` | ChEMBL、ChEBI 二维重原子结构 | 无 | 否 | CC BY-SA 3.0 / CC BY 4.0 |
| `qcarchive-ml`、`qcarchive-main` | MolSSI QCArchive 两个公共服务器的 singlepoint 记录 | 总能量；gradient 规格带力 | 否 | SPICE 系列 CC0，其余按数据集 |
| Basis Set Exchange | 基组与 ECP（随包安装，离线） | — | 否 | 见各基组引用 |

没有能量的记录是“纯结构记录”，可以检索和查看，但不能进训练集。

**测过但没有接入的：** TCOD 与 MPDS 的 OPTIMADE 不给原子坐标（MPDS 另需授权）；MPDD、Matterverse、MPOD
超时；CMR 返回 404；AtomGPT 返回的不是 JSON；PSDI 各子库对测试查询没有结构；Catalysis-Hub 的 GraphQL
接口返回 404；NIST Chemistry WebBook 与 CCCBDB 没有正式 API；ChemSpider、CAS Common Chemistry 要申请 key。
OQMD 接入了，但它的端点时好时坏：同一天里既有约 20 秒的正常返回，也有连续 502。

## 安装

需要 Python 3.11–3.13。在解压后的项目目录里：

```bash
# 方式一：uv（按 uv.lock 装出完全相同的版本）
uv sync

# 方式二：pip
python -m venv .venv
# Windows：.venv\Scripts\activate   macOS/Linux：source .venv/bin/activate
python -m pip install -e .
python -m pip install pytest vcrpy
```

Materials Project 是可选的：复制 `.env.example` 为 `.env`，填入 `MP_API_KEY`。不填时 `mp` 不可用，
检索会在结果的 `sources` 里写明原因，其他库照常返回。

## 测试

```bash
python -m pytest                      # 离线：全部用 tests/cassettes 里录好的接口返回，不联网
CHEMDB_LIVE=1 python -m pytest tests/test_live.py -v -s   # 真实联网的冒烟测试（Windows PowerShell 先 $env:CHEMDB_LIVE=1）
```

用 uv 时在命令前加 `uv run`。联网测试对每个不要 key 的数据源跑一次小查询，再用 MCP 客户端经标准输入输出
走完整查询链；有 `MP_API_KEY` 时才查 Materials Project。

## 启动 MCP 服务器

```bash
python -m chemdb_agent.server        # 标准输入输出；用 uv：uv run python -m chemdb_agent.server
```

在 MCP 客户端（Claude Desktop、Claude Code、Kiro 等）的配置里加一项，路径换成你的项目目录
（同样的内容在 `mcp-config.example.json`）：

```json
{
  "mcpServers": {
    "chemdb-agent": {
      "command": "uv",
      "args": ["--directory", "/替换为项目绝对路径/chemdb-agent", "run", "python", "-m", "chemdb_agent.server"]
    }
  }
}
```

用 pip 装的，把 `command` 换成虚拟环境里的 Python（Windows 为 `.venv\Scripts\python.exe`），`args` 写
`["-m", "chemdb_agent.server"]`。

## 典型用法

- 晶体训练数据：`search_structures(formula="GaN", databases=["optimade-alexandria-pbe", "nomad"])`
  → 看摘要里的 `has_energy` 与 `theory_key` → `export_training_set(record_ids=[...], level_of_theory="<theory_key>")`。
- 分子身份：`search_molecules("aspirin", databases=["pubchem", "chembl", "chebi"])` → `get_record("pubchem:2244")`。
- 量化基组：`get_basis("def2-TZVP", ["Fe", "Pt"], fmt="orca")`，重元素同时给 ECP。
- 量子化学数据集：`find_qm_data(query="SPICE")` → `fetch_dataset_shard(dataset="385", specification="wb97m-d3bj/def2-tzvppd", count=100)`
  → `export_training_set(dataset="SPICE Water Clusters v1.0", path="water.extxyz")`。

直接在 Python 里调用也可以，例如：

```python
from chemdb_agent.adapters import optimade
from chemdb_agent import export

recs = optimade.search_structures(formula="GaN", providers=["alexandria-pbe"], limit=5)
export.export_training_set(recs, "data/exports/gan.extxyz", level_of_theory=recs[0].mix_key)
```

## 单位与约定

- 统一单位：能量 eV，长度 Å，力 eV/Å，应力 eV/Å³。应力用 ASE 的号约定。
- 原始单位留在每条记录的 `raw_units` 里：QCArchive 是 Hartree、Bohr、Hartree/Bohr（力取梯度的相反数）；
  NOMAD 是 J、m、N、Pa；Alexandria 的应力是 kbar，按 VASP 的号约定（压为正）给出，换成 ASE 约定时取负。
- 理论级别键（`theory_key`）由方法、基组、截断能、赝势、色散、自旋、程序与主版本、能量类型和能量修正组成。
  同一个训练集只允许一个键；要混用必须显式 `allow_mixed=true`，清单里会标明。
- Alexandria 与 MP 参数兼容，但接口不给 Hubbard U：含 O 或 F、且含 Co、Cr、Fe、Mn、Mo、Ni、V、W 的体系
  按 MP 的规则记为 `PBE+U`（extras 里注明是推断），不会和无 U 的记录混在一起。
- 化学式写法不限：`NaCl`、`ClNa`、`Na2Cl2` 等价；结果一律在本地再核对组成。

## 环境变量

| 变量 | 默认 | 作用 |
| --- | --- | --- |
| `MP_API_KEY` | 无 | Materials Project 官方接口 |
| `MOLASTRIA_API_KEY` | 无 | MolAstria 计算接口的 key（`run_calculation`、`get_calculation`） |
| `MOLASTRIA_API` | `https://api.molastria.com/v1` | 计算接口的地址，一般不用改 |
| `CHEMDB_DATA_DIR` | 项目目录下 `data/` | 缓存、分片、导出都放这里；导出路径必须在它之内 |
| `CHEMDB_HTTP_TIMEOUT` | 30 | 单次 HTTP 请求超时（秒）；网络错误、5xx、429 自动重试共 3 次 |
| `CHEMDB_SOURCE_TIMEOUT` | 90 | 单个数据源一次查询的总时限（秒）；超时只跳过这个源 |
| `CHEMDB_CACHE_TTL` | 604800 | 记录缓存有效期（秒）；0 表示不读缓存 |

## 数据目录

```text
data/
├── cache.sqlite                     记录缓存
├── catalog.sqlite                   本地分片索引（可由 manifest 重建）
├── shards/<来源>/<数据集>/<规格>/    下载的分片：*.jsonl（每行一条统一记录）+ *.manifest.json
└── exports/                         导出的训练集与 <文件名>.manifest.json 来源清单
```

## 还没有做的

- 跨库去重与合并：同一结构在不同库里是不同记录，目前不合并。
- AFLOW、JARVIS、OQMD、GNoME 的能量字段没有映射（理论级别信息不全），这些库只返回结构。
- OMol25 等需要 Hugging Face 授权的数据集没有接入；QCArchive 只支持 singlepoint 数据集。
- ChEMBL、ChEBI 只有二维重原子坐标，不能当三维量化结构用。
- 导出只有 extxyz 与 ASE 数据库，还没有直接生成 MACE / SchNetPack 的训练配置。

## 仓库结构

```text
chemdb-agent/
├── pyproject.toml · uv.lock · .env.example · mcp-config.example.json · CHANGELOG.md
├── src/chemdb_agent/
│   ├── server.py         MCP 入口，十二个工具
│   ├── schema.py         统一记录 UnifiedRecord
│   ├── units.py          单位换算、理论级别规范化
│   ├── net.py            共用 HTTP：超时、重试、报错
│   ├── cache.py          记录缓存
│   ├── export.py         extxyz / ASE db + 来源清单
│   ├── adapters/         optimade、materials_project、nomad、pubchem、chembl、chebi、qcarchive、basis、local_catalog、molastria_compute
│   └── catalog/          资源目录（resources.json 由网站数据生成，及接入状态）
├── data/                 本地数据（git 忽略）
└── tests/                单元测试与录制的接口返回（cassettes/）
```
