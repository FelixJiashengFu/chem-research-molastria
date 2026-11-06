"""ChEMBL 适配器（#043）：药物/生物活性小分子 → UnifiedRecord（record_id="chembl:…"）。

API（2026-10-27 实测）：
- REST：``https://www.ebi.ac.uk/chembl/api/data/molecule.json``，免费无需 key。
- 名称精确查：``pref_name__iexact=ASPIRIN`` → CHEMBL25；查不到再退回
  ``molecule/search.json?q=`` 全文检索（相关性排序，不保证第一条）。
- SMILES 精确查：``molecule_structures__canonical_smiles__iexact=...``；
  InChIKey 精确查：``molecule_structures__standard_inchi_key__iexact=...``。
- 结构取 ``molecule_structures.molfile``——注意是无氢的 2D 重原子坐标
  （阿司匹林 13 个重原子），与 PubChem 的 3D 全原子坐标不同，extras 里标注；
  因此 ``energy`` 为 None（纯结构记录，进不了训练集，同 PubChem 约定）。
- 电荷：API 不直接给形式电荷，从 molfile 的 ``M  CHG`` 行求和；
  没有则记 0 并注明依据；多重度无字段，一律 assumed（同 PubChem 约定）。
- 许可：ChEMBL 数据为 CC BY-SA 3.0。
"""

from __future__ import annotations

import io
import re

from ase.io import read as ase_read

from chemdb_agent import net
from chemdb_agent.schema import LevelOfTheory, Source, UnifiedRecord

BASE_URL = "https://www.ebi.ac.uk/chembl/api/data"
REQUEST_INTERVAL_S = 0.34  # 礼貌限速；ChEMBL 未公布硬阈值

_CHG_RE = re.compile(r"^M\s+CHG\s+\d+\s+(.*)$")


def _get(path: str, params: dict | None = None) -> dict:
    """带礼貌限速的 GET；5xx/网络错误退避重试（实测 EBI 偶发 500 HTML 页），
    4xx 立即报错。最终失败抛 :class:`~chemdb_agent.net.SourceError`（含 HTTP 状态码）。"""
    return net.request("ChEMBL", f"{BASE_URL}{path}", params=params or {}, min_interval=REQUEST_INTERVAL_S)


def parse_molfile_charge(molfile: str) -> int:
    """从 molfile 的 M  CHG 行求总形式电荷；没有该行返回 0。"""
    total = 0
    for line in molfile.splitlines():
        m = _CHG_RE.match(line.strip())
        if m:
            nums = [int(x) for x in m.group(1).split()]
            total += sum(nums[1::2])  # 成对出现：原子序号, 电荷
    return total


def _to_record(mol: dict) -> UnifiedRecord:
    structures = mol.get("molecule_structures") or {}
    molfile = structures.get("molfile")
    chembl_id = mol["molecule_chembl_id"]
    if not molfile:
        raise ValueError(f"ChEMBL 记录 {chembl_id} 没有 molfile 结构，无法构造统一记录")
    props = mol.get("molecule_properties") or {}
    atoms = ase_read(io.StringIO(molfile), format="sdf")
    charge = parse_molfile_charge(molfile)
    charge_basis = "molfile M CHG 行求和" if charge else "molfile 无 M CHG 行，按中性记 0"
    return UnifiedRecord.from_atoms(
        atoms,
        record_id=f"chembl:{chembl_id}",
        charge=charge,
        multiplicity=1,
        level_of_theory=LevelOfTheory(
            method="unknown",
            spin="unknown",
            program="ChEMBL",
        ),
        source=Source(
            database="chembl",
            url=f"https://www.ebi.ac.uk/chembl/compound_report_card/{chembl_id}/",
        ),
        license="CC-BY-SA-3.0",
        raw_units={"length": "Angstrom"},
        extras={
            "molecular_formula": props.get("full_molformula"),
            "pref_name": mol.get("pref_name"),
            "smiles": structures.get("canonical_smiles"),
            "inchikey": structures.get("standard_inchi_key"),
            "molecule_type": mol.get("molecule_type"),
            "max_phase": mol.get("max_phase"),
            "mw_freebase": props.get("mw_freebase"),
            "alogp": props.get("alogp"),
            "hba": props.get("hba"),
            "hbd": props.get("hbd"),
            "psa": props.get("psa"),
            "qed_weighted": props.get("qed_weighted"),
            "coordinate_type": "2D",
            "heavy_atoms_only": True,
            "charge_basis": charge_basis,
            "multiplicity_assumed": True,
        },
    )


def get_record(chembl_id: str) -> UnifiedRecord:
    """按 ChEMBL ID（如 CHEMBL25，可带 chembl: 前缀）取一条记录。"""
    chembl_id = chembl_id.removeprefix("chembl:")
    return _to_record(_get(f"/molecule/{chembl_id}.json"))


def search_molecules(query: str, by: str = "name", limit: int = 10) -> list[UnifiedRecord]:
    """检索分子并归一为 UnifiedRecord 列表（无 molfile 的条目跳过）。

    by: ``name``（先 pref_name 精确匹配，落空退全文检索）/ ``smiles`` / ``inchikey``。
    """
    if by == "name":
        data = _get("/molecule.json", {"pref_name__iexact": query, "limit": limit})
        mols = data.get("molecules", [])
        if not mols:
            data = _get("/molecule/search.json", {"q": query, "limit": limit})
            mols = data.get("molecules", [])
    elif by == "smiles":
        data = _get("/molecule.json",
                    {"molecule_structures__canonical_smiles__iexact": query, "limit": limit})
        mols = data.get("molecules", [])
    elif by == "inchikey":
        data = _get("/molecule.json",
                    {"molecule_structures__standard_inchi_key__iexact": query, "limit": limit})
        mols = data.get("molecules", [])
    else:
        raise ValueError(f"不支持的检索方式 by={by!r}，可选 name/smiles/inchikey")
    records = []
    for m in mols[:limit]:
        try:
            records.append(_to_record(m))
        except ValueError:
            continue  # 无结构的条目不冒充记录
    return records
