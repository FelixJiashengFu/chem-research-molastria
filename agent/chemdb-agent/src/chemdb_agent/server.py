"""chemdb-agent MCP 服务器入口（fastmcp，标准输入输出）。

十二个工具都接到真实适配器上：每个数据源在线程里查询，超过 ``CHEMDB_SOURCE_TIMEOUT``
（默认 90 秒）就单独记为超时，其他来源的结果照常返回；完整记录按 record_id 缓存在数据目录里。
其中三个（run_calculation、get_calculation、compute_status）调用 MolAstria 的计算接口，用机器学习势算分子。
启动：``python -m chemdb_agent.server``。
"""

from __future__ import annotations

import functools
import os
from concurrent.futures import ThreadPoolExecutor, wait
from dataclasses import asdict
from pathlib import Path
from typing import Annotated, Any, Callable, Literal

from dotenv import load_dotenv
from fastmcp import FastMCP
from fastmcp.exceptions import ToolError
from pydantic import Field

from chemdb_agent import __version__, net
from chemdb_agent.cache import Cache

PROJECT_DIR = Path(__file__).resolve().parents[2]
load_dotenv(PROJECT_DIR / ".env", override=False)

mcp = FastMCP(
    "chemdb-agent",
    instructions=(
        "计算化学数据库检索：search_structures 查晶体（OPTIMADE 15 个库、NOMAD、Materials Project），"
        "search_molecules 查分子（PubChem、ChEMBL、ChEBI），find_qm_data / fetch_dataset_shard 找并下载 "
        "QCArchive 量子化学数据，get_record 取完整记录，export_training_set 导出 extxyz / ASE 数据库训练集，"
        "get_basis 取基组，search_resources 查资源目录，catalog_status 看数据源与本地数据。"
        "要算而不是查：run_calculation 把分子交给 MolAstria 的在线机器学习势（UMA、eSEN、AllScAIP、ANI-2x）做单点、"
        "优化、频率、构象、电离能等计算，get_calculation 取还没算完的任务，compute_status 看算力在不在线和今天还剩几次。"
        "那份算力是站长电脑上的一块 RTX 2080，尽力而为，可能离线。"
    ),
    version=__version__,
)

DATA_DIR = Path(os.environ.get("CHEMDB_DATA_DIR", PROJECT_DIR / "data"))
_POOL = ThreadPoolExecutor(max_workers=8, thread_name_prefix="chemdb-source")
SHARD_CONFIRM_BYTES = 2 * 1024**3
DEFAULT_STRUCTURE_DATABASES = ["optimade-alexandria-pbe", "optimade-mp", "optimade-cod", "nomad"]


def source_timeout_s() -> float:
    try:
        return max(5.0, float(os.environ.get("CHEMDB_SOURCE_TIMEOUT", "90")))
    except ValueError:
        return 90.0


def _cache() -> Cache:
    return Cache(DATA_DIR)


def _message(e: BaseException) -> str:
    if isinstance(e, KeyError) and e.args:
        return str(e.args[0])
    return str(e) or type(e).__name__


def _tool_errors(fn: Callable) -> Callable:
    """把可预期的失败（参数不对、找不到、数据源报错、缺 key、导出被拒）转成 MCP 工具错误，消息原样给客户端。"""

    @functools.wraps(fn)
    def wrapper(*args, **kwargs):
        try:
            return fn(*args, **kwargs)
        except ToolError:
            raise
        except (ValueError, KeyError, net.SourceError, TimeoutError) as e:
            raise ToolError(_message(e)) from e

    return wrapper


def _run_sources(tasks: dict[str, Callable[[], Any]]) -> dict[str, tuple[str, Any]]:
    """并行跑各数据源；返回 {名称: (状态, 结果或消息)}，状态为 ok / missing_key / error / timeout。"""
    futures = {name: _POOL.submit(fn) for name, fn in tasks.items()}
    wait(futures.values(), timeout=source_timeout_s())
    out: dict[str, tuple[str, Any]] = {}
    for name, fut in futures.items():
        if not fut.done():
            fut.cancel()
            out[name] = ("timeout", f"{name}：超过 {source_timeout_s():g} 秒没有返回，已跳过（可调 CHEMDB_SOURCE_TIMEOUT）")
            continue
        try:
            out[name] = ("ok", fut.result())
        except net.MissingKeyError as e:
            out[name] = ("missing_key", str(e))
        except Exception as e:  # noqa: BLE001 - 单个来源失败不能拖垮整次检索
            out[name] = ("error", _message(e))
    return out


def _summary(rec) -> dict[str, Any]:
    from chemdb_agent.adapters.optimade import formula_of_atoms

    atoms = rec.atoms
    lot = rec.level_of_theory
    detail = lot.basis_set or (f"{lot.cutoff_ev:g} eV" if lot.cutoff_ev else None)
    return {
        "record_id": rec.record_id,
        "database": rec.source.database,
        "formula": atoms.get_chemical_formula(),
        "reduced_formula": formula_of_atoms(atoms),
        "natoms": len(atoms),
        "periodic": rec.is_periodic,
        "has_energy": rec.energy is not None,
        "energy_ev": rec.energy,
        "energy_type": rec.energy_type.value if rec.energy_type else None,
        "has_forces": rec.forces is not None,
        "has_stress": rec.stress is not None,
        "level_of_theory": "/".join(x for x in (lot.method, detail, lot.program) if x),
        "theory_key": rec.mix_key,
        "license": rec.license,
        "url": rec.source.url,
    }


def _remember(records) -> None:
    cache = _cache()
    for rec in records:
        cache.put(f"record:{rec.record_id}", rec.model_dump(mode="json"))


def _structure_task(database: str, formula: str | None, elements: list[str] | None, limit: int) -> Callable:
    if database == "mp":
        from chemdb_agent.adapters import materials_project as mp

        return lambda: mp.search_structures(formula=formula, elements=None if formula else elements, limit=limit)
    if database == "nomad":
        from chemdb_agent.adapters import nomad

        return lambda: nomad.search_structures(formula=formula, elements=elements, limit=limit)
    if database.startswith("optimade-"):
        from chemdb_agent.adapters import optimade

        provider = database.removeprefix("optimade-")
        if provider not in optimade.PROVIDERS:
            raise ValueError(f"未知数据库 {database!r}，可选：{', '.join(_structure_databases())}")
        return lambda: optimade.search_structures(formula=formula, elements=elements, providers=[provider], limit=limit)
    raise ValueError(f"未知数据库 {database!r}，可选：{', '.join(_structure_databases())}")


def _structure_databases() -> list[str]:
    from chemdb_agent.adapters.optimade import PROVIDERS

    return ["mp", "nomad"] + [f"optimade-{p}" for p in PROVIDERS]


def _expand_databases(databases: list[str] | None) -> tuple[list[str], list[str]]:
    from chemdb_agent.adapters import materials_project as mp
    from chemdb_agent.adapters.optimade import PROVIDERS

    notes: list[str] = []
    if not databases:
        chosen = list(DEFAULT_STRUCTURE_DATABASES)
        if mp.configured_key():
            chosen.append("mp")
        else:
            notes.append("没有 MP_API_KEY，默认不查 Materials Project 原生接口；结构可用 optimade-mp 查到（无能量）。")
        return chosen, notes
    chosen = []
    for d in databases:
        d = d.strip().lower()
        if d == "optimade-all":
            chosen += [f"optimade-{p}" for p in PROVIDERS]
        elif d == "optimade":
            chosen += [x for x in DEFAULT_STRUCTURE_DATABASES if x.startswith("optimade-")]
        else:
            chosen.append(d)
    return list(dict.fromkeys(chosen)), notes


def _overall(sources: list[dict[str, Any]]) -> str:
    oks = [s for s in sources if s["status"] == "ok"]
    if len(oks) == len(sources):
        return "ok"
    return "partial" if oks else "error"


def _report(results: dict[str, tuple[str, Any]], notes: list[str]) -> dict[str, Any]:
    records, sources = [], []
    for name, (status, value) in results.items():
        if status == "ok":
            records.extend(value)
            sources.append({"database": name, "status": "ok", "count": len(value)})
        else:
            sources.append({"database": name, "status": status, "count": 0, "message": value})
    _remember(records)
    if not records and all(s["status"] == "ok" for s in sources):
        notes = notes + ["各数据源都没有匹配结果：检查化学式或元素写法，或换个数据库。"]
    return {
        "status": _overall(sources),
        "count": len(records),
        "results": [_summary(r) for r in records],
        "sources": sources,
        "notes": notes,
    }


# -- 工具 ------------------------------------------------------------------


@mcp.tool()
@_tool_errors
def search_structures(
    formula: Annotated[str | None, Field(description="化学式，写法不限：NaCl、ClNa、Na2Cl2 等价；与 elements 二选一，同时给时以化学式为准")] = None,
    elements: Annotated[list[str] | None, Field(description="元素符号列表，如 [\"Li\", \"Mn\", \"O\"]；只查恰好由这些元素组成的结构")] = None,
    databases: Annotated[list[str] | None, Field(description="要查的库：mp（需 MP_API_KEY）、nomad（原生接口，带能量/力/应力）、optimade-<提供方>（如 optimade-alexandria-pbe、optimade-cod）、optimade（默认 OPTIMADE 组合）或 optimade-all（全部 15 个）。不填时查 optimade-alexandria-pbe、optimade-mp、optimade-cod、nomad，配置了 MP_API_KEY 时再加 mp")] = None,
    limit: Annotated[int, Field(ge=1, le=100, description="每个库最多返回的条数")] = 5,
) -> dict[str, Any]:
    """跨库检索晶体结构，返回摘要（是否带能量、理论级别、许可）和每个库的状态。

    单个库超时、报错或缺 key 时只在 sources 里记下原因，其他库的结果照常返回。完整记录已缓存，用 get_record 取。
    """
    if formula is None and not elements:
        raise ValueError("请至少给出 formula 或 elements")
    chosen, notes = _expand_databases(databases)
    tasks = {d: _structure_task(d, formula, elements, limit) for d in chosen}
    return _report(_run_sources(tasks), notes)


def _fetch_record(record_id: str):
    """按前缀分派到适配器取一条记录。"""
    prefix = record_id.partition(":")[0]
    if prefix == "mp":
        from chemdb_agent.adapters import materials_project as mp

        return mp.get_record(record_id)
    if prefix.startswith("optimade-"):
        from chemdb_agent.adapters import optimade

        return optimade.get_record(record_id)
    if prefix == "nomad":
        from chemdb_agent.adapters import nomad

        return nomad.get_record(record_id)
    if prefix == "pubchem":
        from chemdb_agent.adapters import pubchem

        return pubchem.get_record(record_id)
    if prefix == "chembl":
        from chemdb_agent.adapters import chembl

        return chembl.get_record(record_id)
    if prefix == "chebi":
        from chemdb_agent.adapters import chebi

        return chebi.get_record(record_id)
    if prefix.startswith("qcarchive-"):
        from chemdb_agent.adapters import qcarchive

        return qcarchive.get_record(record_id)
    raise ValueError(
        f"不认识的 record_id 前缀 {prefix!r}：应为 mp、nomad、optimade-<提供方>、pubchem、chembl、chebi、qcarchive-ml 或 qcarchive-main"
    )


def _load_record(record_id: str):
    """缓存 → 本地分片 → 联网，返回 (记录, 出处)。"""
    from chemdb_agent.adapters import local_catalog
    from chemdb_agent.schema import UnifiedRecord

    record_id = record_id.strip()
    cached = _cache().get(f"record:{record_id}")
    if cached is not None:
        return UnifiedRecord.model_validate(cached), "cache"
    local = local_catalog.get(DATA_DIR, record_id)
    if local is not None:
        return local, "local"
    status, value = _run_sources({record_id: lambda: _fetch_record(record_id)})[record_id]
    if status != "ok":
        raise ToolError(value)
    _remember([value])
    return value, "network"


@mcp.tool()
@_tool_errors
def get_record(
    record_id: Annotated[str, Field(description="统一记录编号，形如 mp:mp-149、optimade-cod:1010928、nomad:<entry_id>、pubchem:2244、chembl:CHEMBL25、chebi:15365、qcarchive-ml:119038366")],
) -> dict[str, Any]:
    """按 record_id 取完整统一记录（extxyz 结构、能量、力、应力、理论级别、来源、许可）。先查缓存与本地分片。"""
    rec, origin = _load_record(record_id)
    return {"status": "ok", "origin": origin, "summary": _summary(rec), "record": rec.model_dump(mode="json")}


@mcp.tool()
@_tool_errors
def search_molecules(
    query: Annotated[str, Field(description="分子名称、SMILES 或 InChIKey，与 by 对应")],
    by: Annotated[Literal["name", "smiles", "inchikey"], Field(description="query 的类型")] = "name",
    databases: Annotated[list[Literal["pubchem", "chembl", "chebi"]] | None, Field(description="要查的库，默认只查 pubchem（三维构象）；chembl、chebi 给二维重原子结构；chebi 不支持 smiles")] = None,
    limit: Annotated[int, Field(ge=1, le=20, description="每个库最多返回的条数")] = 3,
) -> dict[str, Any]:
    """按名称/SMILES/InChIKey 查分子，返回结构记录摘要（分子记录没有能量，不能直接进训练集）。"""
    if not query.strip():
        raise ValueError("query 不能为空")
    from chemdb_agent.adapters import chebi, chembl, pubchem

    modules = {"pubchem": pubchem, "chembl": chembl, "chebi": chebi}
    chosen = list(dict.fromkeys(databases or ["pubchem"]))
    tasks = {d: functools.partial(modules[d].search_molecules, query, by=by, limit=limit) for d in chosen}
    return _report(_run_sources(tasks), [])


@mcp.tool()
@_tool_errors
def find_qm_data(
    query: Annotated[str, Field(description="数据集名称关键词（不分大小写），如 SPICE、QM9、water；空字符串列出全部")] = "",
    elements: Annotated[list[str] | None, Field(description="只要元素清单包含这些元素的数据集；数据集没给元素清单时照列，并标 elements_checked=false")] = None,
    method: Annotated[str | None, Field(description="只要含此方法的规格，如 wb97m-d3bj、b3lyp")] = None,
    basis: Annotated[str | None, Field(description="只要含此基组的规格，如 def2-tzvppd")] = None,
    server: Annotated[Literal["ml", "main"], Field(description="QCArchive 公共服务器：ml（机器学习数据集）或 main（OpenFF 等）")] = "ml",
    limit: Annotated[int, Field(ge=1, le=20, description="最多返回的数据集个数")] = 5,
) -> dict[str, Any]:
    """找量子化学数据集：只返回统计、规格（方法/基组/程序）和许可，不下载记录；同时列出本地已下载的匹配数据。"""
    from chemdb_agent import units
    from chemdb_agent.adapters import local_catalog, qcarchive
    from chemdb_agent.adapters.optimade import normalize_elements

    want = normalize_elements(elements) if elements else []

    def scan() -> dict[str, Any]:
        candidates = qcarchive.list_datasets(server, query)
        found, scanned = [], 0
        for d in candidates:
            if len(found) >= limit or scanned >= 40:
                break
            scanned += 1
            summ = qcarchive.dataset_summary(server, qcarchive.get_dataset(server, d["dataset_id"]))
            specs = [
                s for s in summ["specifications"]
                if not s["is_correction_only"]
                and (method is None or units.normalize_method(s["method"]) == units.normalize_method(method))
                and (basis is None or (s["basis"] or "").lower() == basis.strip().lower())
            ]
            if not specs:
                continue
            checked = summ["elements"] is not None
            if want and checked and not set(want) <= set(summ["elements"]):
                continue
            summ["specifications"] = specs
            summ["elements_checked"] = checked or not want
            found.append(summ)
        return {"candidates": len(candidates), "scanned": scanned, "datasets": found}

    status, value = _run_sources({f"qcarchive-{server}": scan})[f"qcarchive-{server}"]
    local = local_catalog.search(DATA_DIR, elements=want)
    if status != "ok":
        return {"status": "error", "message": value, "datasets": [], "local": local}
    notes = []
    if value["scanned"] < value["candidates"] and len(value["datasets"]) < limit:
        notes.append(f"只检查了前 {value['scanned']} 个候选（共 {value['candidates']} 个），请把 query 写得更具体。")
    return {"status": "ok", "server": server, **value, "local": local, "notes": notes}


@mcp.tool()
@_tool_errors
def get_basis(
    basis_name: Annotated[str, Field(description="基组名，如 def2-SVP、def2-TZVP、cc-pVDZ、6-31G*")],
    elements: Annotated[list[str], Field(description="元素符号列表，如 [\"Fe\", \"Pt\"]；重元素会同时返回配套 ECP")],
    fmt: Annotated[Literal["orca", "gaussian", "cp2k", "pyscf", "psi4", "nwchem", "json", "molpro", "qchem", "turbomole"], Field(description="输出格式（程序名）；pyscf 返回与其兼容的 NWChem 格式")] = "orca",
) -> dict[str, Any]:
    """取基组与 ECP 文本（Basis Set Exchange 本地库，离线）。"""
    from chemdb_agent.adapters import basis

    return {"status": "ok", **asdict(basis.get_basis(basis_name, elements, fmt=fmt))}


@mcp.tool()
@_tool_errors
def search_resources(
    query: Annotated[str, Field(description="关键词，匹配名称、描述和链接；空字符串表示不按关键词筛")] = "",
    category: Annotated[str | None, Field(description="类别名，如 材料与晶体结构、药物、生物活性与化学空间（类别列表见 catalog_status）")] = None,
    integration: Annotated[Literal["adapter", "optimade", "stub", "catalog"] | None, Field(description="接入状态：adapter（独立适配器）、optimade（经 OPTIMADE 接入）、stub（占位）、catalog（仅收录导航信息）")] = None,
) -> dict[str, Any]:
    """检索资源目录（与 MolAstria 网站的数据库目录同一份：数据库、软件、数据集、课程和科学大模型）。catalog 表示仅收录导航信息、尚未接入，不会冒充可检索数据源。"""
    from chemdb_agent.catalog.resources import search_resources as _search

    results = _search(query, category=category, integration=integration)
    return {"status": "ok", "count": len(results), "results": results}


def _sources_status() -> list[dict[str, Any]]:
    from chemdb_agent.adapters import materials_project as mp
    from chemdb_agent.adapters import optimade, qcarchive

    rows: list[dict[str, Any]] = [
        {"id": "mp", "kind": "晶体", "energy": "形成能/原子（MP 兼容性校正）", "requires_key": "MP_API_KEY",
         "configured": bool(mp.configured_key()), "license": mp.MP_LICENSE},
        {"id": "nomad", "kind": "晶体", "energy": "总能量、力、应力（SI 单位换算）", "license": "CC-BY-4.0"},
    ]
    for p, url in optimade.PROVIDERS.items():
        spec = optimade.ENERGY_FIELDS.get(p)
        energy = None
        if spec:
            energy = "总能量" + ("、力" if spec.forces else "") + ("、应力" if spec.stress else "")
        rows.append({"id": f"optimade-{p}", "kind": "晶体", "energy": energy, "url": url,
                     "license": optimade.LICENSES.get(p, "see-provider-terms")})
    rows += [
        {"id": "pubchem", "kind": "分子", "energy": None, "license": "public-domain"},
        {"id": "chembl", "kind": "分子", "energy": None, "license": "CC-BY-SA-3.0"},
        {"id": "chebi", "kind": "分子", "energy": None, "license": "CC-BY-4.0"},
    ]
    rows += [{"id": f"qcarchive-{s}", "kind": "量子化学", "energy": "总能量、力（gradient 规格）", "url": url,
              "license": "按数据集（SPICE 为 CC0，其余见数据集引用）"} for s, url in qcarchive.SERVERS.items()]
    rows.append({"id": "bse", "kind": "基组", "energy": None, "license": "见 Basis Set Exchange 各基组引用", "offline": True})
    return rows


@mcp.tool()
@_tool_errors
def catalog_status() -> dict[str, Any]:
    """数据源清单（是否带能量、是否要 key、许可）、本地已下载的分片、缓存与资源目录概况（只读，不联网）。"""
    from chemdb_agent.adapters import local_catalog
    from chemdb_agent.catalog.resources import CATEGORIES, RESOURCES, SOURCE, UPDATED, integrated

    DATA_DIR.mkdir(parents=True, exist_ok=True)
    entries = [
        {"name": p.name, "size_bytes": p.stat().st_size if p.is_file() else None}
        for p in sorted(DATA_DIR.iterdir())
        if p.name != ".gitkeep"
    ]
    return {
        "status": "ok",
        "version": __version__,
        "data_dir": str(DATA_DIR),
        "entries": entries,
        "sources": _sources_status(),
        "local_catalog": local_catalog.stats(DATA_DIR),
        "cache": _cache().stats(),
        "resources": {
            "total": len(RESOURCES),
            "categories": CATEGORIES,
            "integrated": [r["name"] for r in integrated()],
            "source": f"MolAstria 开放数据接口 {SOURCE}（{len(RESOURCES)} 条，{UPDATED} 核对；随包安装，离线可用）",
        },
    }


@mcp.tool()
@_tool_errors
def fetch_dataset_shard(
    dataset: Annotated[str, Field(description="QCArchive singlepoint 数据集的编号（如 385）或准确名称（如 SPICE Water Clusters v1.0）；先用 find_qm_data 找")],
    specification: Annotated[str, Field(description="规格名（find_qm_data 返回的 specifications[].name），如 wb97m-d3bj/def2-tzvppd")],
    start: Annotated[int, Field(ge=0, description="从第几个条目开始（按数据集的条目顺序）")] = 0,
    count: Annotated[int, Field(ge=1, le=50000, description="下载多少个条目")] = 100,
    server: Annotated[Literal["ml", "main"], Field(description="QCArchive 公共服务器")] = "ml",
    confirm: Annotated[bool, Field(description="估计大小超过 2 GB 时必须设为 true 才会真正下载")] = False,
) -> dict[str, Any]:
    """把 QCArchive 数据集的一段下载到本地目录（jsonl 分片 + manifest），登记到本地索引，保留理论级别、来源和许可。

    先取一条样本估计大小；超过 2 GB 只返回估计值，确认后才下载。之后可用 export_training_set(dataset=…) 导出。
    """
    from chemdb_agent.adapters import local_catalog, qcarchive

    def run() -> dict[str, Any]:
        ds = qcarchive.get_dataset(server, dataset)
        spec = qcarchive.check_specification(ds, specification)
        names = ds.entry_names
        if start >= len(names):
            raise ValueError(f"start={start} 超出范围：数据集 {ds.name!r} 只有 {len(names)} 个条目")
        chunk = names[start : start + count]
        sample = next((r for _, r in qcarchive.iterate_records(server, ds, specification, chunk[:1]) if not isinstance(r, str)), None)
        per_record = len(sample.model_dump_json()) + 1 if sample is not None else 4096
        estimate = per_record * len(chunk)
        if estimate > SHARD_CONFIRM_BYTES and not confirm:
            return {"status": "needs_confirmation", "dataset": ds.name, "entries": len(chunk),
                    "estimated_bytes": estimate, "message": "估计超过 2 GB；确认磁盘空间后用 confirm=true 再调用一次，或减小 count"}
        records, skipped = [], []
        for entry_name, rec in qcarchive.iterate_records(server, ds, specification, chunk):
            if isinstance(rec, str):
                skipped.append({"entry": entry_name, "reason": rec})
            else:
                records.append(rec)
        if not records:
            raise ValueError(f"这一段没有可用记录（跳过 {len(skipped)} 条）：{skipped[:3]}")
        manifest = local_catalog.write_shard(
            DATA_DIR, source=f"qcarchive-{server}", dataset=ds.name, dataset_id=ds.id, specification=specification,
            start=start, records=records, license=qcarchive.license_for(ds.name),
            level_of_theory={k: spec[k] for k in ("program", "driver", "method", "basis")},
            notes=[f"跳过 {len(skipped)} 条：{skipped[:5]}"] if skipped else [],
        )
        return {"status": "ok", "dataset": ds.name, "dataset_id": ds.id, "specification": specification,
                "n_records": len(records), "n_skipped": len(skipped), "skipped": skipped[:20],
                "estimated_bytes": estimate, "shard_id": manifest["shard_id"], "file": manifest["file"],
                "license": manifest["license"], "theory_keys": manifest["theory_keys"]}

    status, value = _run_sources({"qcarchive": run})["qcarchive"]
    if status != "ok":
        raise ToolError(value)
    return value


def _export_path(path: str) -> Path:
    """导出路径只能落在数据目录里：相对路径放到 <数据目录>/exports/ 下。"""
    p = Path(path)
    if not p.is_absolute():
        p = DATA_DIR / "exports" / p
    p = p.resolve()
    root = DATA_DIR.resolve()
    if p != root and root not in p.parents:
        raise ValueError(f"导出路径须在数据目录 {root} 之内（可用环境变量 CHEMDB_DATA_DIR 改数据目录），实际 {p}")
    return p


@mcp.tool()
@_tool_errors
def export_training_set(
    record_ids: Annotated[list[str] | None, Field(description="要导出的记录编号（search_structures / get_record 返回的 record_id）")] = None,
    dataset: Annotated[str | None, Field(description="改为导出本地已下载的数据集：数据集名称、编号或 shard_id（见 catalog_status）")] = None,
    fmt: Annotated[Literal["extxyz", "ase_db"], Field(description="extxyz（.extxyz/.xyz，能量、力、应力挂在 ASE 计算器上）或 ase_db（.db）")] = "extxyz",
    path: Annotated[str, Field(description="输出文件；相对路径放在 <数据目录>/exports/ 下，绝对路径必须在数据目录内。清单写在旁边的 <文件名>.manifest.json")] = "train.extxyz",
    level_of_theory: Annotated[str | None, Field(description="只导出这个理论级别键（记录摘要里的 theory_key）；记录理论级别不一致时用它指定一种")] = None,
    allow_mixed: Annotated[bool, Field(description="确认要混用不同理论级别时设为 true（清单里会标明）")] = False,
    overwrite: Annotated[bool, Field(description="文件已存在时是否覆盖")] = False,
) -> dict[str, Any]:
    """导出训练集与来源清单（每条记录的来源、理论级别、许可、获取时间）。

    统一单位：能量 eV、长度 Å、力 eV/Å、应力 eV/Å³（ASE 号约定）。理论级别不一致时拒绝并说明差在哪；
    没有能量的纯结构记录不能导出。
    """
    from chemdb_agent import export
    from chemdb_agent.adapters import local_catalog

    if bool(record_ids) == bool(dataset):
        raise ValueError("record_ids 与 dataset 二选一")
    out = _export_path(path)
    if dataset:
        records = local_catalog.load_dataset(DATA_DIR, dataset)
    else:
        records = [_load_record(rid)[0] for rid in dict.fromkeys(record_ids)]
    return {"status": "ok", **export.export_training_set(
        records, out, fmt, level_of_theory=level_of_theory, allow_mixed=allow_mixed, overwrite=overwrite)}


# -- 计算：MolAstria 的在线机器学习势 -----------------------------------------


def _job_view(job: dict[str, Any]) -> dict[str, Any]:
    """任务的状态写成工具的返回值：算完给结果，没算完给任务号和下一步怎么做。"""
    state = job.get("status")
    out: dict[str, Any] = {"status": "ok" if state == "done" else "pending" if state in ("queued", "running") else "error", "job_status": state}
    for k in ("id", "model", "job", "position", "progress", "cached", "cost", "usage", "result", "error"):
        if k in job:
            out["job_id" if k == "id" else k] = job[k]
    res = out.get("result")
    if isinstance(res, dict) and "trajectory_pdb" in res:  # protein MD: the PDB texts are long; say how big instead
        out["result"] = {k: (f"<{len(v)} characters of PDB text, left out>" if k in ("trajectory_pdb", "final_pdb") else v) for k, v in res.items()}
    if out["status"] == "pending":
        out["next"] = f"还没算完（任务继续在排队或计算）。稍后用 get_calculation(job_id=\"{job.get('id')}\") 取结果；完成后保留一小时。"
    return out


@mcp.tool()
@_tool_errors
def run_calculation(
    smiles: Annotated[str | None, Field(description="分子的 SMILES，如 CCO；与 xyz 二选一。反应能（job=rxn）不填这里，把反应 SMILES 写进 params.reaction")] = None,
    job: Annotated[Literal["sp", "opt", "freq", "conf", "scan", "md", "rxn", "ipea", "spin", "bde", "pa", "pmd"], Field(description="计算种类：sp 单点能与受力，opt 几何优化，freq 振动频率与热化学，conf 构象搜索，scan 二面角扫描，md 分子动力学，rxn 反应能，ipea 电离能与电子亲和能，spin 自旋态能隙，bde 键解离能，pa 质子亲和能，pmd 蛋白质分子动力学（只有 openmm-amber14 做，不给 smiles 和 xyz，PDB 编号写进 params.pdb_id）。花费（次）：sp/opt/ipea 1，spin/bde/pa 2，freq/rxn 3，conf/scan/md/pmd 5（pmd 超过 20 ps 是 10）")] = "opt",
    model: Annotated[Literal["uma-s-1p2p1", "uma-s-1p2", "uma-s-1p2p1-ft-d4rev", "uma-s-1p1", "allscaip-md-conserving-all-omol", "allscaip-md-direct-all-omol", "esen-sm-conserving-all-omol", "esen-sm-direct-all-omol", "esen-md-direct-all-omol", "ani-2x", "gfn2-xtb", "gfn2-xtb-alpb-water", "gfn1-xtb", "gfn-ff", "openmm-amber14"], Field(description="模型，默认 UMA-S 1.2.1。openmm-amber14 只做 pmd（Amber ff14SB + 隐式水）。ipea、spin、bde、pa 只有能处理电荷和自旋的模型做（uma-s-1p2p1、uma-s-1p2、uma-s-1p2p1-ft-d4rev 和两个 allscaip；三个 xTB 做 spin、bde、pa，不做 ipea；gfn-ff 只算中性闭壳层）；compute_status 列出每个模型现在能做什么")] = "uma-s-1p2p1",
    xyz: Annotated[str | None, Field(description="标准 XYZ 文本（第一行原子数，第二行注释，之后每行“元素 x y z”，单位 Å），最多 120 个原子；与 smiles 二选一")] = None,
    charge: Annotated[int | None, Field(ge=-2, le=2, description="总电荷，默认 0")] = None,
    spin: Annotated[int | None, Field(ge=1, le=4, description="自旋多重度，默认 1")] = None,
    params: Annotated[dict[str, Any] | None, Field(description="这种计算的参数，都可省略，除非标了必填：opt {fmax}；freq {temperature, symmetry}；conf {n, temperature, window_kcal}；scan {atoms 必填（四个原子序号）, start, end, points}；md {temperature, timestep_fs, steps, friction}；rxn {reaction 必填, thermo, temperature}；ipea {mode}；spin {spins}；bde {bond 必填（两个原子序号）, thermo, temperature}；pa {site 必填, mode, thermo, temperature}；pmd {pdb_id 必填（如 1L2Y）, chains（如 A，空为全部蛋白链）, ps（1–100，默认 20）, temperature（250–400 K）}")] = None,
    wait_s: Annotated[float, Field(ge=0, le=600, description="最多等多少秒；到时间还没算完就返回任务号，之后用 get_calculation 取。0 表示提交后立刻返回")] = 120,
) -> dict[str, Any]:
    """用 MolAstria 的在线机器学习势算一个分子（单点、优化、频率、构象、扫描、动力学、反应能、电离能等），等到算完并返回结果。

    需要环境变量 MOLASTRIA_API_KEY（免费，在 https://molastria.com/pro/account.html 生成）。每次计算从账号每天的次数里扣
    （免费账号 100 次，Pro 支持者 200 次），一个账号同时只能有一个任务。算力是站长电脑上的 RTX 2080，尽力而为，可能离线：
    离线或排队时会如实报错或返回任务号，不要反复重试。能量单位 eV，长度 Å。结果是机器学习势的预测，不是 DFT。
    """
    from chemdb_agent.adapters import molastria_compute as mc

    if job not in ("rxn", "pmd") and (smiles is None) == (xyz is None):
        raise ValueError("smiles 和 xyz 要给一个，且只能给一个")
    submitted = mc.submit(job=job, model=model, smiles=smiles.strip() if smiles else None, xyz=xyz, charge=charge, spin=spin, params=params)
    return _job_view(mc.wait(submitted, wait_s))


@mcp.tool()
@_tool_errors
def get_calculation(
    job_id: Annotated[str, Field(description="run_calculation 返回的任务号（16 位十六进制）")],
    wait_s: Annotated[float, Field(ge=0, le=600, description="最多再等多少秒；0 表示只看一眼现在的状态")] = 60,
) -> dict[str, Any]:
    """取一个还没算完的计算的状态或结果（任务完成后保留一小时）。需要 MOLASTRIA_API_KEY。"""
    from chemdb_agent.adapters import molastria_compute as mc

    job_id = job_id.strip().lower()
    if len(job_id) != 16 or any(c not in "0123456789abcdef" for c in job_id):
        raise ValueError("job_id 应为 run_calculation 返回的 16 位十六进制任务号")
    return _job_view(mc.wait(mc.get(job_id), wait_s))


@mcp.tool()
@_tool_errors
def compute_status() -> dict[str, Any]:
    """MolAstria 的算力现在在不在线、最近 7 天的在线率；配了 MOLASTRIA_API_KEY 时还有可用的模型、每种计算的花费和今天还剩几次。提交计算前先看一眼。"""
    from chemdb_agent.adapters import molastria_compute as mc

    out: dict[str, Any] = {"status": "ok", "note": mc.NOTE, "docs": mc.DOCS, "key_configured": bool(mc.configured_key())}
    try:
        st = mc.status()
        out.update(online=st.get("online"), checked=st.get("checked"), gpu=st.get("gpu"), uptime=st.get("uptime"))
    except net.SourceError as e:  # 状态查不到不影响下面带 key 的部分
        out["status_error"] = _message(e)
    if not out["key_configured"]:
        out["key_hint"] = f"还没有配置 MOLASTRIA_API_KEY：在 {mc.ACCOUNT_PAGE} 用邮箱登录后生成（免费），写进环境变量后重启这个 MCP 服务器。"
        return out
    listed = mc.models()
    out.update(online=listed.get("online"), gpu=listed.get("gpu") or out.get("gpu"), models=listed.get("models"), costs=listed.get("costs"),
               cost_with_thermo=listed.get("cost_with_thermo"))
    account = mc.me()
    out.update(tier=account.get("tier"), usage=account.get("usage"))
    return out


def main() -> None:
    mcp.run(show_banner=False)


if __name__ == "__main__":
    main()
