"""QCArchive 适配器（#076，qcportal，只读 MolSSI 公共服务器，匿名访问）。

- 服务器：``ml``（https://ml.qcarchive.molssi.org，SPICE、QM9、ANI 等机器学习数据集）与
  ``main``（https://api.qcarchive.molssi.org，OpenFF 等），2026-11-06 实测均可匿名读取。
  两个服务器的记录编号互不相通，record_id 写成 ``qcarchive-ml:<编号>`` / ``qcarchive-main:<编号>``。
- 只用 singlepoint 记录：能量取 ``return_energy``（Hartree → eV）；driver 为 gradient 时
  力取梯度的相反数（Hartree/Bohr → eV/Å）；坐标 Bohr → Å；电荷与多重度取自分子本身。
- dftd3/dftd4/gcp 等程序只算色散或校正能量，不是总能量，明确拒绝，不冒充训练数据。
- 理论级别：方法、基组、程序取自记录的 specification，程序版本取自计算来源（provenance）。
- 许可：QCArchive 不给逐条许可。SPICE 系列数据集官方声明为 CC0（openmm/spice-dataset），
  其余记为 ``unspecified``，导出时会提示去数据集的引用里核对。
"""

from __future__ import annotations

import threading
from typing import Any, Iterator

from ase import Atoms

from chemdb_agent import units
from chemdb_agent.net import SourceError
from chemdb_agent.schema import EnergyType, LevelOfTheory, Source, UnifiedRecord

SERVERS: dict[str, str] = {
    "ml": "https://ml.qcarchive.molssi.org",
    "main": "https://api.qcarchive.molssi.org",
}
CORRECTION_PROGRAMS = frozenset({"dftd3", "dftd4", "gcp", "mp2d", "dftd3_mctc", "s-dftd3"})
UNSPECIFIED_LICENSE = "unspecified (QCArchive dataset; check its citation)"

_clients: dict[str, Any] = {}
_lock = threading.Lock()


def client(server: str):
    """取（并复用）某个公共服务器的 PortalClient。"""
    if server not in SERVERS:
        raise ValueError(f"未知 QCArchive 服务器 {server!r}，可选：{sorted(SERVERS)}")
    with _lock:
        if server not in _clients:
            from qcportal import PortalClient

            try:
                _clients[server] = PortalClient(SERVERS[server], show_motd=False)
            except Exception as e:
                raise SourceError(f"QCArchive {server}", f"连接失败：{e}") from e
        return _clients[server]


def license_for(dataset_name: str | None) -> str:
    # shortcut: 只认 SPICE 的 CC0 声明；别的数据集声明了许可时在这里补一条
    if dataset_name and dataset_name.strip().lower().startswith("spice"):
        return "CC0-1.0"
    return UNSPECIFIED_LICENSE


def parse_record_id(record_id: str) -> tuple[str, int]:
    prefix, sep, rest = record_id.partition(":")
    server = prefix.removeprefix("qcarchive-")
    if not sep or not prefix.startswith("qcarchive-") or server not in SERVERS or not rest.strip().isdigit():
        raise ValueError(f"record_id 须形如 qcarchive-ml:119038366 或 qcarchive-main:<编号>，实际 {record_id!r}")
    return server, int(rest)


def _spec_dict(name: str, spec: Any) -> dict[str, Any]:
    s = spec.specification
    return {
        "name": name,
        "program": s.program,
        "driver": str(getattr(s.driver, "value", s.driver)),
        "method": s.method,
        "basis": s.basis,
        "is_correction_only": s.program.lower() in CORRECTION_PROGRAMS,
    }


def _citation_doi(ds: Any) -> str | None:
    cites = (ds.extras or {}).get("citations") or []
    if isinstance(cites, list):
        for c in cites:
            if isinstance(c, dict) and c.get("doi"):
                return str(c["doi"])
    return None


def get_dataset(server: str, dataset: str | int):
    """按编号或准确名称取 singlepoint 数据集。"""
    c = client(server)
    try:
        if isinstance(dataset, int) or str(dataset).strip().isdigit():
            ds = c.get_dataset_by_id(int(dataset))
        else:
            ds = c.get_dataset("singlepoint", str(dataset).strip())
    except Exception as e:
        raise KeyError(f"QCArchive {server} 上找不到数据集 {dataset!r}：{e}") from e
    if ds.dataset_type != "singlepoint":
        raise ValueError(f"数据集 {ds.name!r} 是 {ds.dataset_type} 类型；目前只支持 singlepoint（能量/梯度）数据集")
    return ds


def dataset_summary(server: str, ds: Any) -> dict[str, Any]:
    extras = ds.extras or {}
    elements = extras.get("elements")
    if isinstance(elements, str):  # 服务器上常存成 "['C', 'H']" 这样的字符串
        elements = [e.strip(" '\"") for e in elements.strip("[]").split(",") if e.strip(" '\"")]
    return {
        "server": server,
        "dataset_id": ds.id,
        "name": ds.name,
        "record_count": ds.record_count,
        "description": (ds.description or extras.get("short_description") or "")[:300],
        "elements": sorted(elements) if isinstance(elements, list) else None,
        "doi": _citation_doi(ds),
        "license": license_for(ds.name),
        "specifications": [_spec_dict(n, s) for n, s in ds.specifications.items()],
    }


def list_datasets(server: str, query: str = "") -> list[dict[str, Any]]:
    """列出有记录的 singlepoint 数据集，按名称关键词（不分大小写）筛。"""
    q = query.strip().lower()
    out = []
    for d in client(server).list_datasets():
        if d.get("dataset_type") != "singlepoint" or not d.get("record_count"):
            continue
        if q and q not in str(d.get("dataset_name", "")).lower():
            continue
        out.append({"dataset_id": d.get("id"), "name": d.get("dataset_name"), "record_count": d.get("record_count")})
    return out


def record_to_unified(
    server: str,
    rec: Any,
    *,
    dataset_name: str | None = None,
    entry_name: str | None = None,
    specification_name: str | None = None,
    doi: str | None = None,
) -> UnifiedRecord:
    """qcportal 的 SinglepointRecord → UnifiedRecord（单位换算在这里做）。"""
    spec = rec.specification
    program = str(spec.program)
    if program.lower() in CORRECTION_PROGRAMS:
        raise ValueError(f"记录 {rec.id} 由 {program} 计算，只有色散/校正能量，不是总能量")
    status = str(getattr(rec.status, "value", rec.status))
    if status != "complete":
        raise ValueError(f"记录 {rec.id} 状态为 {status}，没有可用结果")
    props = rec.properties or {}
    energy = props.get("return_energy")
    if energy is None:
        raise ValueError(f"记录 {rec.id} 没有 return_energy")
    mol = rec.molecule
    symbols = list(mol.symbols)
    positions = units.length_to_angstrom([list(map(float, row)) for row in mol.geometry], "Bohr")
    kwargs: dict[str, Any] = {}
    raw_units = {"energy": "Hartree", "length": "Bohr"}
    driver = str(getattr(spec.driver, "value", spec.driver))
    if driver == "gradient" and rec.return_result is not None:
        flat = [float(v) for row in rec.return_result for v in (row if isinstance(row, (list, tuple)) else [row])]
        if len(flat) == 3 * len(symbols):
            grad = [flat[i : i + 3] for i in range(0, len(flat), 3)]
            kwargs["forces"] = [[-v for v in row] for row in units.force_to_ev_per_angstrom(grad, "Ha/Bohr")]
            raw_units["forces"] = "Hartree/Bohr (forces = -gradient)"
    provenance = getattr(rec, "provenance", None)
    keywords = dict(spec.keywords or {})
    reference = str(keywords.get("reference", "")).lower()
    spin = {"uhf": "unrestricted", "uks": "unrestricted", "rhf": "restricted", "rks": "restricted"}.get(reference, "unknown")
    return UnifiedRecord.from_atoms(
        Atoms(symbols=symbols, positions=positions, pbc=False),
        record_id=f"qcarchive-{server}:{rec.id}",
        charge=int(round(float(mol.molecular_charge))),
        multiplicity=int(round(float(mol.molecular_multiplicity))),
        energy=units.energy_to_ev(float(energy), "Ha"),
        energy_type=EnergyType.TOTAL,
        level_of_theory=LevelOfTheory(
            method=str(spec.method),
            basis_set=spec.basis,
            spin=spin,
            program=program,
            program_version=getattr(provenance, "version", None),
        ),
        source=Source(
            database=f"qcarchive-{server}",
            dataset_version=dataset_name,
            url=f"{SERVERS[server]}/api/v1/records/singlepoint/{rec.id}",
            doi=doi,
        ),
        license=license_for(dataset_name) if dataset_name else UNSPECIFIED_LICENSE,
        raw_units=raw_units,
        extras={
            "qcarchive_record_id": rec.id,
            "entry_name": entry_name,
            "specification_name": specification_name,
            "driver": driver,
            "molecular_formula": mol.get_molecular_formula() if hasattr(mol, "get_molecular_formula") else None,
            "keywords": {k: v for k, v in keywords.items() if isinstance(v, (str, int, float, bool))},
        },
        **kwargs,
    )


def get_record(record_id: str) -> UnifiedRecord:
    """按 qcarchive-<server>:<编号> 取一条 singlepoint 记录（不带数据集上下文，许可记为 unspecified）。"""
    server, rid = parse_record_id(record_id)
    rec = client(server).get_singlepoints(rid, missing_ok=True)
    if rec is None:
        raise KeyError(f"QCArchive {server} 上找不到 singlepoint 记录 {rid}")
    return record_to_unified(server, rec)


def check_specification(ds: Any, specification: str) -> dict[str, Any]:
    if specification not in ds.specifications:
        raise KeyError(f"数据集 {ds.name!r} 没有规格 {specification!r}，可选：{sorted(ds.specifications)}")
    spec = _spec_dict(specification, ds.specifications[specification])
    if spec["is_correction_only"]:
        raise ValueError(f"规格 {specification!r} 由 {spec['program']} 计算，只有色散/校正能量，不能当训练用的总能量")
    return spec


def iterate_records(server: str, ds: Any, specification: str, entry_names: list[str]) -> Iterator[tuple[str, UnifiedRecord | str]]:
    """逐条产出 (entry_name, 记录或跳过原因)。"""
    doi = _citation_doi(ds)
    for entry_name, _spec_name, rec in ds.iterate_records(
        entry_names=entry_names, specification_names=[specification], include=["molecule"]
    ):
        try:
            yield entry_name, record_to_unified(
                server, rec, dataset_name=ds.name, entry_name=entry_name, specification_name=specification, doi=doi
            )
        except ValueError as e:
            yield entry_name, str(e)
