"""ChEBI 适配器（#005）：EBI 化学本体库 → UnifiedRecord（record_id="chebi:<数字>"）。

API（ChEBI 2.0 公共接口，2026-11-06 实测，免费无需 key）：
- 名称检索：``/es_search/?term=...``（全文相关性排序）；InChIKey 精确值也走这里再核对；
- 化合物：``/compound/<id>/``（名称、SMILES、InChIKey、分子式、电荷）；
- 结构：``/molfile/<id>/``——二维重原子坐标（与 ChEMBL 一样，不是三维构象），因此
  ``energy`` 为 None（纯结构记录，进不了训练集）。多重度无字段，一律 assumed。
- 许可：ChEBI 数据为 CC BY 4.0。
"""

from __future__ import annotations

import io

from ase.io import read as ase_read

from chemdb_agent import net
from chemdb_agent.schema import LevelOfTheory, Source, UnifiedRecord

BASE_URL = "https://www.ebi.ac.uk/chebi/backend/api/public"
REQUEST_INTERVAL_S = 0.34
LICENSE = "CC-BY-4.0"


def _get(path: str, params: dict | None = None, *, as_json: bool = True):
    return net.request("ChEBI", f"{BASE_URL}{path}", params=params, min_interval=REQUEST_INTERVAL_S, as_json=as_json)


def _chebi_number(chebi_id: str) -> str:
    num = chebi_id.removeprefix("chebi:").upper().removeprefix("CHEBI:").strip()
    if not num.isdigit():
        raise ValueError(f"ChEBI ID 须形如 15365 或 CHEBI:15365，实际 {chebi_id!r}")
    return num


def get_record(chebi_id: str) -> UnifiedRecord:
    """按 ChEBI ID（15365、CHEBI:15365 或 chebi:15365）取一条记录。"""
    num = _chebi_number(chebi_id)
    try:
        compound = _get(f"/compound/{num}/")
        molfile = _get(f"/molfile/{num}/", as_json=False)
    except net.SourceError as e:
        if e.status == 404:
            raise KeyError(f"ChEBI 里找不到 CHEBI:{num}，或该条目没有结构") from e
        raise
    try:
        atoms = ase_read(io.StringIO(molfile), format="sdf")
    except Exception as e:
        raise ValueError(f"CHEBI:{num} 的 molfile 无法解析（可能是带 R 基团的泛指结构）：{e}") from e
    data = compound.get("chemical_data") or {}
    structure = compound.get("default_structure") or {}
    charge = data.get("charge")
    return UnifiedRecord.from_atoms(
        atoms,
        record_id=f"chebi:{num}",
        charge=int(charge) if charge is not None else 0,
        multiplicity=1,
        level_of_theory=LevelOfTheory(method="unknown", spin="unknown", program="ChEBI"),
        source=Source(database="chebi", url=f"https://www.ebi.ac.uk/chebi/CHEBI:{num}"),
        license=LICENSE,
        raw_units={"length": "Angstrom"},
        extras={
            "name": compound.get("name"),
            "molecular_formula": data.get("formula"),
            "smiles": structure.get("smiles"),
            "inchikey": structure.get("standard_inchi_key"),
            "stars": compound.get("stars"),
            "coordinate_type": "2D",
            "heavy_atoms_only": "H" not in atoms.get_chemical_symbols(),
            "charge_basis": "ChEBI chemical_data.charge" if charge is not None else "ChEBI 未给电荷，按中性记 0",
            "multiplicity_assumed": True,
        },
    )


def search_molecules(query: str, by: str = "name", limit: int = 5) -> list[UnifiedRecord]:
    """按名称或 InChIKey 检索。ChEBI 没有按 SMILES 的精确检索，by="smiles" 会明确报错。"""
    if by not in ("name", "inchikey"):
        raise ValueError(f"ChEBI 只支持 by=name 或 by=inchikey，实际 {by!r}；按 SMILES 请用 pubchem 或 chembl")
    data = _get("/es_search/", {"term": query, "size": max(limit * 2, 5) if by == "inchikey" else limit})
    hits = [h.get("_source", {}) for h in data.get("results", [])]
    if by == "inchikey":
        hits = [h for h in hits if (h.get("inchikey") or "").upper() == query.strip().upper()]
    records = []
    for h in hits[:limit]:
        accession = h.get("chebi_accession")
        if not accession:
            continue
        try:
            records.append(get_record(accession))
        except (KeyError, ValueError):
            continue  # 无结构或泛指结构的条目不冒充记录
    return records
