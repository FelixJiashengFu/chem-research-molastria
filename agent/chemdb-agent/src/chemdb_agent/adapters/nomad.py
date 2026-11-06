"""NOMAD 原生接口适配器（#023）：带总能量、力、应力的周期体系计算 → UnifiedRecord。

与 OPTIMADE 的 ``nomad`` 提供方不同，这里走 NOMAD 自己的 API（2026-11-06 实测，免费无需 key）：
``POST /entries/archive/query`` 一次取回检索结果和每条的计算归档（最后一个构型、最后一步计算）。

NOMAD 归档一律用 SI 单位，这里按统一单位换算：能量 J → eV，坐标/晶格 m → Å，
力 N → eV/Å，应力 Pa → eV/Å³，平面波截断能 J → eV。NOMAD 的应力定义为能量对形变张量的
导数（与 ASE 同号），不改号。

理论级别：交换关联泛函取自 ``method.dft.xc_functional``（libxc 名称归并成 PBE、PBEsol 等），
程序与版本取自 ``run.program``，截断能取自价电子平面波基组。检到 Hubbard U 参数时方法记为
``+U``。只取 ``structural_type = bulk`` 的条目，分子与团簇不进来（它们缺电荷与多重度）。
许可：NOMAD 公开数据为 CC BY 4.0。
"""

from __future__ import annotations

from typing import Any

from ase import Atoms

from chemdb_agent import net, units
from chemdb_agent.adapters.optimade import formula_of_atoms, normalize_elements, normalize_formula
from chemdb_agent.schema import EnergyType, LevelOfTheory, Source, UnifiedRecord

API = "https://nomad-lab.eu/prod/v1/api/v1"
LICENSE = "CC-BY-4.0"

_REQUIRED: dict[str, Any] = {
    "run": {
        "system[-1]": {"atoms": "*"},
        "calculation[-1]": {"energy": {"total": "*"}, "forces": {"total": "*"}, "stress": {"total": "*"}},
        "program": "*",
        "method[-1]": {"dft": {"xc_functional": "*"}, "electrons_representation": "*", "atom_parameters": "*"},
    },
    "metadata": {"entry_id": "*", "upload_id": "*", "datasets": "*"},
    "results": {"material": {"chemical_formula_reduced": "*", "structural_type": "*"}},
}

_XC_NAMES: dict[frozenset[str], str] = {
    frozenset({"GGA_X_PBE", "GGA_C_PBE"}): "PBE",
    frozenset({"GGA_X_PBE_SOL", "GGA_C_PBE_SOL"}): "PBEsol",
    frozenset({"LDA_X", "LDA_C_PZ"}): "LDA",
    frozenset({"LDA_X", "LDA_C_PW"}): "LDA",
    frozenset({"GGA_X_PW91", "GGA_C_PW91"}): "PW91",
    frozenset({"MGGA_X_SCAN", "MGGA_C_SCAN"}): "SCAN",
    frozenset({"MGGA_X_R2SCAN", "MGGA_C_R2SCAN"}): "R2SCAN",
    frozenset({"HYB_GGA_XC_HSE06"}): "HSE06",
    frozenset({"HYB_GGA_XC_PBEH"}): "PBE0",
    frozenset({"HYB_GGA_XC_B3LYP"}): "B3LYP",
}


def _method(method_section: dict[str, Any]) -> str:
    xc = ((method_section.get("dft") or {}).get("xc_functional") or {})
    names = {n.strip() for n in str(xc.get("name") or "").split("+") if n.strip()}
    for part in ("exchange", "correlation", "hybrid", "contributions"):
        names |= {c.get("name") for c in xc.get(part) or [] if c.get("name")}
    method = _XC_NAMES.get(frozenset(names)) or ("+".join(sorted(names)) if names else "unknown")
    for ap in method_section.get("atom_parameters") or []:
        hub = ap.get("hubbard_kanamori_model") or {}
        if any(float(hub.get(k) or 0.0) != 0.0 for k in ("u", "u_effective", "j")):  # SI 单位（J），数值很小
            return method + "+U"
    return method


def _cutoff_ev(method_section: dict[str, Any]) -> float | None:
    for rep in method_section.get("electrons_representation") or []:
        for bs in rep.get("basis_set") or []:
            if bs.get("type") == "plane waves" and "valence" in (bs.get("scope") or []) and bs.get("cutoff"):
                return round(units.energy_to_ev(float(bs["cutoff"]), "J"), 3)
    return None


def _to_record(entry_id: str, archive: dict[str, Any]) -> UnifiedRecord:
    runs = archive.get("run") or []
    run = next((r for r in reversed(runs) if r.get("calculation") and r.get("system")), None)
    if run is None:
        raise ValueError(f"NOMAD 条目 {entry_id} 没有计算结果")
    atoms_sec = (run["system"][-1].get("atoms") or {})
    calc = run["calculation"][-1]
    labels = atoms_sec.get("labels") or []
    positions = atoms_sec.get("positions") or []
    if not labels or len(labels) != len(positions):
        raise ValueError(f"NOMAD 条目 {entry_id} 的原子坐标不完整")
    lattice = atoms_sec.get("lattice_vectors")
    pbc = atoms_sec.get("periodic") or [lattice is not None] * 3
    atoms = Atoms(
        symbols=labels,
        positions=units.length_to_angstrom(positions, "m"),
        cell=units.length_to_angstrom(lattice, "m") if lattice else None,
        pbc=pbc,
    )
    if not atoms.pbc.any():
        raise ValueError(f"非周期条目（{entry_id}）：不是晶体结构")
    energy = ((calc.get("energy") or {}).get("total") or {}).get("value")
    if energy is None:
        raise ValueError(f"NOMAD 条目 {entry_id} 没有总能量")
    kwargs: dict[str, Any] = {"energy": units.energy_to_ev(float(energy), "J"), "energy_type": EnergyType.TOTAL}
    raw_units = {"energy": "J", "length": "m"}
    forces = ((calc.get("forces") or {}).get("total") or {}).get("value")
    if forces is not None and len(forces) == len(atoms):
        kwargs["forces"] = units.force_to_ev_per_angstrom(forces, "N")
        raw_units["forces"] = "N"
    stress = ((calc.get("stress") or {}).get("total") or {}).get("value")
    if stress is not None and len(stress) == 3:
        kwargs["stress"] = units.stress_to_ev_per_a3(stress, "Pa")
        raw_units["stress"] = "Pa (dE/dstrain, ASE sign)"
    method_section = (run.get("method") or [{}])[-1]
    program = run.get("program") or {}
    version = str(program.get("version") or "").split()
    meta = archive.get("metadata") or {}
    material = ((archive.get("results") or {}).get("material") or {})
    return UnifiedRecord.from_atoms(
        atoms,
        record_id=f"nomad:{entry_id}",
        level_of_theory=LevelOfTheory(
            method=_method(method_section),
            cutoff_ev=_cutoff_ev(method_section),
            spin="unknown",
            program=program.get("name"),
            program_version=version[0] if version else None,
        ),
        source=Source(database="nomad", url=f"https://nomad-lab.eu/prod/v1/gui/entry/id/{entry_id}"),
        license=LICENSE,
        raw_units=raw_units,
        extras={
            "upload_id": meta.get("upload_id"),
            "datasets": [d.get("dataset_name") for d in meta.get("datasets") or [] if isinstance(d, dict)],
            "formula_reduced": material.get("chemical_formula_reduced"),
            "program_version_full": program.get("version"),
        },
        **kwargs,
    )


def search_structures(formula: str | None = None, elements: list[str] | None = None, limit: int = 5) -> list[UnifiedRecord]:
    """查带总能量的周期体系计算。``formula`` 优先于 ``elements``；结果在本地再核对组成。"""
    target = normalize_formula(formula) if formula is not None else None
    if target is not None:
        from pymatgen.core import Composition

        elements = sorted(Composition(target).get_el_amt_dict())
    if not elements:
        raise ValueError("请至少给出 formula、elements 中的一个")
    elements = normalize_elements(elements)
    query: dict[str, Any] = {
        "results.material.elements:all": elements,
        "results.material.n_elements": len(elements),
        "results.material.structural_type": "bulk",
        "quantities:all": ["run.calculation.energy.total.value"],
    }
    if target is not None:
        query["results.material.chemical_formula_reduced"] = target
    body = {"owner": "visible", "query": query, "pagination": {"page_size": max(1, min(limit, 50))}, "required": _REQUIRED}
    data = net.request("NOMAD", f"{API}/entries/archive/query", method="POST", json_body=body)
    records = []
    for d in data.get("data") or []:
        try:
            rec = _to_record(d["entry_id"], d.get("archive") or {})
        except ValueError:
            continue  # 计算不完整或不是晶体的条目跳过
        if target is not None and formula_of_atoms(rec.atoms) != target:
            continue
        records.append(rec)
    return records[:limit]


def get_record(entry_id: str) -> UnifiedRecord:
    """按 NOMAD entry_id（可带 nomad: 前缀）取一条记录。"""
    eid = entry_id.removeprefix("nomad:")
    try:
        data = net.request("NOMAD", f"{API}/entries/{eid}/archive/query", method="POST", json_body={"required": _REQUIRED})
    except net.SourceError as e:
        if e.status == 404:
            raise KeyError(f"NOMAD 里找不到 {eid}（或不是公开条目）") from e
        raise
    return _to_record(eid, (data.get("data") or {}).get("archive") or {})
