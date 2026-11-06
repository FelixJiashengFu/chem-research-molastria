"""Materials Project 适配器（官方 mp_api）。

能量语义（实施计划第 4 节）：MP 的能量经过 GGA/GGA+U/r²SCAN 兼容性校正，
不能与原始总能量混用。因此：

- ``energy`` 取 ``formation_energy_per_atom``，``energy_type`` 为
  ``FORMATION_PER_ATOM``，并用 ``energy_correction="MP compatibility"`` 标注；
- 方法取自结构来源任务的 ``run_type``（GGA→PBE 等）；查不到时记 ``unknown``
  并在 extras 保留原始值——宁可过度拆分，绝不悄悄混用。

MP 通用设置（官方文档）：VASP、截断能 520 eV、PAW PBE 54 赝势、自旋极化。

需要用户自己的 ``MP_API_KEY``（环境变量、``.env`` 或 pymatgen 的 ``PMG_MAPI_KEY``）。
没有配置时抛 :class:`~chemdb_agent.net.MissingKeyError`，不去联网；不想注册时可改用
OPTIMADE 的 ``mp`` 提供方（只有结构，没有能量）。
"""

from __future__ import annotations

import os
from typing import Any

from pymatgen.io.ase import AseAtomsAdaptor

from chemdb_agent.net import MissingKeyError, SourceError
from chemdb_agent.schema import EnergyType, LevelOfTheory, Source, UnifiedRecord

MP_LICENSE = "MP-ToU (cite Materials Project)"
MP_CUTOFF_EV = 520.0
MP_PSEUDO = "PAW_PBE_54"

_RUN_TYPE_TO_METHOD: dict[str, str] = {
    "GGA": "PBE",
    "GGA+U": "PBE+U",
    "SCAN": "SCAN",
    "R2SCAN": "R2SCAN",
    "HSE": "HSE06",
}

_SUMMARY_FIELDS = [
    "material_id",
    "formula_pretty",
    "structure",
    "formation_energy_per_atom",
    "energy_per_atom",
    "energy_above_hull",
    "band_gap",
    "theoretical",
    "total_magnetization",
    "origins",
]


MISSING_KEY_MESSAGE = (
    "需要 MP_API_KEY。到 https://next-gen.materialsproject.org/api 免费注册后申请，"
    "写进项目目录的 .env 或环境变量，再重启 MCP 服务器；不想注册时可用 optimade-mp（只有结构，没有能量）。"
)


def configured_key(api_key: str | None = None) -> str | None:
    """按 mp_api 的查找顺序取 key：参数、环境变量 MP_API_KEY、pymatgen 设置 PMG_MAPI_KEY。"""
    if api_key or os.environ.get("MP_API_KEY"):
        return api_key or os.environ["MP_API_KEY"]
    from pymatgen.core import SETTINGS

    return SETTINGS.get("PMG_MAPI_KEY") or None


def _get_client(api_key: str | None = None):
    from mp_api.client import MPRester
    from mp_api.client.core import MPRestError

    key = configured_key(api_key)
    if not key:
        raise MissingKeyError("Materials Project", MISSING_KEY_MESSAGE)
    try:
        return MPRester(api_key=key)
    except MPRestError as e:
        raise SourceError("Materials Project", f"API key 无效：{e}") from e


def _run_types(mpr, task_ids: list[str]) -> dict[str, str]:
    """批量查任务 run_type。失败则返回空（方法记 unknown）。"""
    if not task_ids:
        return {}
    try:
        tasks = mpr.materials.tasks.search(task_ids=task_ids, fields=["task_id", "run_type"])
    except Exception:
        return {}
    out = {}
    for t in tasks:
        tid = t.task_id if isinstance(t.task_id, str) else str(t.task_id)
        out[tid] = str(t.run_type) if t.run_type is not None else "unknown"
    return out


def _to_record(doc: Any, run_type: str | None) -> UnifiedRecord:
    method = _RUN_TYPE_TO_METHOD.get(run_type or "", "unknown")
    atoms = AseAtomsAdaptor.get_atoms(doc.structure)
    material_id = str(doc.material_id)
    extras: dict[str, Any] = {
        "formula_pretty": doc.formula_pretty,
        "energy_per_atom_mp": doc.energy_per_atom,
        "energy_above_hull": doc.energy_above_hull,
        "band_gap": doc.band_gap,
        "theoretical": doc.theoretical,
        "total_magnetization": doc.total_magnetization,
    }
    if method == "unknown":
        extras["mp_run_type"] = run_type
    return UnifiedRecord.from_atoms(
        atoms,
        record_id=f"mp:{material_id}",
        energy=doc.formation_energy_per_atom,
        energy_type=EnergyType.FORMATION_PER_ATOM,
        energy_correction="MP compatibility",
        level_of_theory=LevelOfTheory(
            method=method,
            cutoff_ev=MP_CUTOFF_EV,
            pseudopotential=MP_PSEUDO,
            spin="spin-polarized",
            program="VASP",
        ),
        source=Source(
            database="materials_project",
            url=f"https://next-gen.materialsproject.org/materials/{material_id}",
        ),
        license=MP_LICENSE,
        raw_units={"energy": "eV", "length": "Angstrom"},
        extras=extras,
    )


def search_structures(
    formula: str | None = None,
    chemsys: str | None = None,
    elements: list[str] | None = None,
    energy_above_hull_max: float | None = None,
    band_gap_min: float | None = None,
    band_gap_max: float | None = None,
    limit: int = 50,
    api_key: str | None = None,
) -> list[UnifiedRecord]:
    """按化学式/体系/元素查 MP，返回统一记录（默认最多 50 条）。"""
    if formula is None and chemsys is None and elements is None:
        raise ValueError("请至少给出 formula、chemsys、elements 中的一个")
    with _get_client(api_key) as mpr:
        docs = mpr.materials.summary.search(
            formula=formula,
            chemsys=chemsys,
            elements=elements,
            energy_above_hull=(None, energy_above_hull_max) if energy_above_hull_max is not None else None,
            band_gap=(band_gap_min, band_gap_max)
            if band_gap_min is not None or band_gap_max is not None
            else None,
            fields=_SUMMARY_FIELDS,
            num_chunks=1,
            chunk_size=limit,
        )
        docs = list(docs)[:limit]
        task_ids = [
            str(o.task_id) for d in docs for o in (d.origins or [])[:1] if o.task_id
        ]
        run_types = _run_types(mpr, task_ids)
        records = []
        for d in docs:
            tid = str(d.origins[0].task_id) if d.origins and d.origins[0].task_id else None
            records.append(_to_record(d, run_types.get(tid) if tid else None))
        return records


def get_record(material_id: str, api_key: str | None = None) -> UnifiedRecord:
    """按 mp-id（如 mp-149，可带或不带 mp: 前缀）取单条统一记录。"""
    mid = material_id.removeprefix("mp:")
    with _get_client(api_key) as mpr:
        docs = mpr.materials.summary.search(material_ids=[mid], fields=_SUMMARY_FIELDS)
        if not docs:
            raise KeyError(f"MP 里找不到 {mid}")
        d = docs[0]
        tid = str(d.origins[0].task_id) if d.origins and d.origins[0].task_id else None
        run_types = _run_types(mpr, [tid] if tid else [])
        return _to_record(d, run_types.get(tid) if tid else None)
