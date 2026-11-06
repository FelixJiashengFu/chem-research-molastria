"""导出训练集：extxyz 或 ASE 数据库，外加来源清单（manifest）。

- 记录已经是统一单位（能量 eV、长度 Å、力 eV/Å、应力 eV/Å³，ASE 号约定），写出时不再换算；
  用 ASE 的 SinglePointCalculator 挂上能量、力、应力，``ase.io.read`` 读回即可
  ``get_potential_energy()`` / ``get_forces()`` / ``get_stress()``。
- 导出前检查理论级别：所有记录的混用检查键（:attr:`UnifiedRecord.mix_key`，含方法、基组、
  截断能、赝势、色散、自旋、程序主版本、能量类型和能量修正）必须一致。不一致时报错并说明差在哪；
  用户可以用 ``level_of_theory`` 指定只导出哪一个键，或显式 ``allow_mixed=True``。
- 没有能量的纯结构记录不能进训练集，直接报错并列出。
- 清单写在数据文件旁边：``<文件名>.manifest.json``，逐条记录来源、理论级别、许可和获取时间。
"""

from __future__ import annotations

import hashlib
import json
from collections import Counter
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Literal

from ase.calculators.singlepoint import SinglePointCalculator

from chemdb_agent import __version__, units
from chemdb_agent.schema import UnifiedRecord

UNITS = {
    "energy": "eV",
    "length": "Angstrom",
    "forces": "eV/Angstrom",
    "stress": "eV/Angstrom^3 (ASE sign convention)",
}
_SUFFIXES = {"extxyz": (".extxyz", ".xyz"), "ase_db": (".db",)}
_NONCOMMERCIAL = ("-NC", "NONCOMMERCIAL")


class ExportError(ValueError):
    """导出被拒绝：理论级别不一致、没有能量、路径不对等。"""


def _manifest_path(path: Path) -> Path:
    return path.with_name(path.name + ".manifest.json")


def _atoms(rec: UnifiedRecord):
    atoms = rec.atoms
    atoms.calc = SinglePointCalculator(atoms, energy=rec.energy, forces=rec.forces, stress=rec.stress)
    info = {
        "record_id": rec.record_id,
        "database": rec.source.database,
        "energy_type": rec.energy_type.value if rec.energy_type else "none",
        "theory_key": rec.mix_key,
        "license": rec.license,
    }
    if rec.charge is not None:
        info["charge"] = rec.charge
    if rec.multiplicity is not None:
        info["multiplicity"] = rec.multiplicity
    if rec.energy_correction:
        info["energy_correction"] = rec.energy_correction
    atoms.info.update(info)
    return atoms, info


def _license_notes(licenses: Counter) -> list[str]:
    notes = []
    for lic, n in sorted(licenses.items()):
        upper = lic.upper()
        if any(tag in upper for tag in _NONCOMMERCIAL):
            notes.append(f"{n} 条记录的许可为 {lic}：仅限非商业用途")
        elif "-SA" in upper:
            notes.append(f"{n} 条记录的许可为 {lic}：再分发须用相同许可")
        elif upper.startswith("UNSPECIFIED") or upper.startswith("SEE-PROVIDER"):
            notes.append(f"{n} 条记录没有明确许可（{lic}）：发布前请到提供方核对")
    return notes


def select_records(
    records: list[UnifiedRecord], level_of_theory: str | None = None, allow_mixed: bool = False
) -> tuple[list[UnifiedRecord], dict[str, int], list[str]]:
    """按理论级别检查与筛选；返回 (选中记录, 各键计数, 被排除的 record_id)。"""
    if not records:
        raise ExportError("没有记录可导出")
    no_energy = [r.record_id for r in records if r.energy is None]
    if no_energy:
        shown = "、".join(no_energy[:5]) + ("…" if len(no_energy) > 5 else "")
        raise ExportError(
            f"{len(no_energy)} 条记录没有能量（纯结构记录，例如 OPTIMADE 结构库、PubChem、ChEMBL），"
            f"不能进训练集：{shown}"
        )
    counts = Counter(r.mix_key for r in records)
    if level_of_theory:
        chosen = [r for r in records if r.mix_key == level_of_theory]
        if not chosen:
            listed = "；".join(f"{k}（{n} 条）" for k, n in counts.most_common())
            raise ExportError(f"没有记录的理论级别键等于 {level_of_theory!r}。现有的键：{listed}")
        excluded = [r.record_id for r in records if r.mix_key != level_of_theory]
        return chosen, dict(counts), excluded
    if len(counts) > 1 and not allow_mixed:
        (k1, n1), (k2, n2) = counts.most_common(2)
        raise ExportError(
            f"记录的理论级别不一致（{len(counts)} 种）。最多的两种：{k1}（{n1} 条）与 {k2}（{n2} 条），"
            f"{units.explain_key_difference(k1, k2)}。请用 level_of_theory 指定其中一个键只导出它，"
            "或确认要混用时设 allow_mixed=true。"
        )
    return list(records), dict(counts), []


def export_training_set(
    records: list[UnifiedRecord],
    path: Path,
    fmt: Literal["extxyz", "ase_db"] = "extxyz",
    *,
    level_of_theory: str | None = None,
    allow_mixed: bool = False,
    overwrite: bool = False,
) -> dict[str, Any]:
    """写出训练集与 manifest，返回摘要。"""
    if fmt not in _SUFFIXES:
        raise ExportError(f"未知格式 {fmt!r}，可选：extxyz、ase_db")
    path = Path(path)
    if path.suffix.lower() not in _SUFFIXES[fmt]:
        raise ExportError(f"{fmt} 文件的扩展名应为 {'/'.join(_SUFFIXES[fmt])}，实际 {path.name!r}")
    manifest_path = _manifest_path(path)
    if (path.exists() or manifest_path.exists()) and not overwrite:
        raise ExportError(f"{path} 已存在；换个文件名，或设 overwrite=true 覆盖")
    chosen, counts, excluded = select_records(records, level_of_theory, allow_mixed)
    path.parent.mkdir(parents=True, exist_ok=True)
    pairs = [_atoms(r) for r in chosen]
    tmp = path.with_name(path.name + ".tmp")
    if tmp.exists():
        tmp.unlink()
    if fmt == "extxyz":
        from ase.io import write

        write(tmp, [a for a, _ in pairs], format="extxyz")
    else:
        import ase.db

        with ase.db.connect(tmp, type="db") as db:
            for atoms, info in pairs:
                db.write(atoms, key_value_pairs={k: v for k, v in info.items() if isinstance(v, (str, int, float))})
    tmp.replace(path)
    licenses = Counter(r.license for r in chosen)
    manifest = {
        "chemdb_agent": __version__,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "file": path.name,
        "format": fmt,
        "sha256": hashlib.sha256(path.read_bytes()).hexdigest(),
        "n_records": len(chosen),
        "units": UNITS,
        "theory_keys": {k: n for k, n in counts.items() if any(r.mix_key == k for r in chosen)},
        "mixed_level_of_theory": len({r.mix_key for r in chosen}) > 1,
        "excluded_record_ids": excluded,
        "licenses": dict(licenses),
        "license_notes": _license_notes(licenses),
        "records": [
            {
                "record_id": r.record_id,
                "database": r.source.database,
                "dataset_version": r.source.dataset_version,
                "url": r.source.url,
                "doi": r.source.doi,
                "retrieved_at": r.source.retrieved_at.isoformat(),
                "license": r.license,
                "level_of_theory": r.level_of_theory.model_dump(),
                "theory_key": r.mix_key,
                "energy_type": r.energy_type.value if r.energy_type else None,
                "energy_correction": r.energy_correction,
                "has_forces": r.forces is not None,
                "has_stress": r.stress is not None,
                "raw_units": r.raw_units,
            }
            for r in chosen
        ],
    }
    manifest_path.write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    return {
        "path": str(path),
        "manifest_path": str(manifest_path),
        "format": fmt,
        "n_records": len(chosen),
        "n_excluded": len(excluded),
        "theory_keys": manifest["theory_keys"],
        "licenses": manifest["licenses"],
        "license_notes": manifest["license_notes"],
    }
