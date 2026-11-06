"""PubChem 适配器（PUG-REST / pubchempy）。

- 优先取 3D 构象（PubChem3D 经 MMFF94 优化的计算几何），缺 3D 时退回 2D 并标注。
- PubChem 不给计算能量：``energy`` 为 None（纯结构记录，进不了训练集）。
- 自旋多重度未知：默认 1 并在 extras 标注 ``multiplicity_assumed``。
- 遵守限速：请求间隔 ≥ 0.3 秒（约 3 次/秒，低于 5 次/秒上限）。
"""

from __future__ import annotations

import time
from typing import Any

from ase import Atoms

from chemdb_agent.schema import LevelOfTheory, Source, UnifiedRecord

_MIN_INTERVAL_S = 0.3
_last_request_ts = 0.0


def _throttle() -> None:
    global _last_request_ts
    wait = _MIN_INTERVAL_S - (time.monotonic() - _last_request_ts)
    if wait > 0:
        time.sleep(wait)
    _last_request_ts = time.monotonic()


def _fetch(query: str, namespace: str) -> list[Any]:
    import pubchempy as pcp

    _throttle()
    try:
        compounds = pcp.get_compounds(query, namespace, record_type="3d")
    except Exception:
        compounds = []
    if not compounds:
        _throttle()
        compounds = pcp.get_compounds(query, namespace, record_type="2d")
    return compounds


def _properties(cid: int) -> dict:
    """取分子性质（3D 记录里性质常缺失，单独补一次 PUG 查询）。"""
    import pubchempy as pcp

    _throttle()
    try:
        res = pcp.get_properties(
            ["MolecularFormula", "Charge", "IUPACName", "InChIKey", "ConnectivitySMILES"],
            cid,
            "cid",
        )
    except Exception:
        return {}
    return res[0] if res else {}


def _to_record(c: Any) -> UnifiedRecord:
    atoms_list = c.atoms or []
    symbols = [a.element for a in atoms_list]
    positions = [(a.x or 0.0, a.y or 0.0, a.z or 0.0) for a in atoms_list]
    coord_type = "3D" if getattr(c, "coordinate_type", "2d") == "3d" else "2D"
    is_3d = coord_type == "3D"
    props = _properties(c.cid)
    atoms = Atoms(symbols=symbols, positions=positions, pbc=False)
    return UnifiedRecord.from_atoms(
        atoms,
        record_id=f"pubchem:{c.cid}",
        charge=int(props.get("Charge", c.charge or 0) or 0),
        multiplicity=1,
        level_of_theory=LevelOfTheory(
            method="MMFF94" if is_3d else "unknown",
            spin="unknown",
            program="PubChem3D" if is_3d else "PubChem",
        ),
        source=Source(
            database="pubchem",
            url=f"https://pubchem.ncbi.nlm.nih.gov/compound/{c.cid}",
        ),
        license="public-domain",
        raw_units={"length": "Angstrom"},
        extras={
            "molecular_formula": props.get("MolecularFormula") or c.molecular_formula,
            "iupac_name": props.get("IUPACName") or getattr(c, "iupac_name", None),
            "smiles": props.get("ConnectivitySMILES") or getattr(c, "smiles", None),
            "inchikey": props.get("InChIKey") or getattr(c, "inchikey", None),
            "coordinate_type": coord_type,
            "multiplicity_assumed": True,
        },
    )


def search_molecules(query: str, by: str = "name", limit: int = 10) -> list[UnifiedRecord]:
    """按名称/SMILES/InChIKey 查分子。``by`` 取 name、smiles、inchikey 之一。"""
    namespace = {"name": "name", "smiles": "smiles", "inchikey": "inchikey"}.get(by)
    if namespace is None:
        raise ValueError(f"by 须为 name、smiles、inchikey 之一，实际 {by!r}")
    compounds = _fetch(query, namespace)
    if not compounds:
        raise ValueError(f"PubChem 里找不到 {by}={query!r}，换个名称、SMILES 或 InChIKey 再试")
    return [_to_record(c) for c in compounds[:limit]]


def get_record(cid: str) -> UnifiedRecord:
    """按 CID（如 2244，可带 pubchem: 前缀）取单条记录。"""
    import pubchempy as pcp

    cid = cid.removeprefix("pubchem:")
    _throttle()
    try:
        c = pcp.Compound.from_cid(cid, record_type="3d")
    except Exception:
        _throttle()
        c = pcp.Compound.from_cid(cid, record_type="2d")
    return _to_record(c)
