"""Basis Set Exchange 适配器（本地离线）。

返回基组/ECP 文本（不是 UnifiedRecord：基组没有结构与能量）。
PySCF 无原生格式，用与其兼容的 NWChem 格式并在 notes 标注。
"""

from __future__ import annotations

from dataclasses import dataclass, field

FMT_MAP: dict[str, str] = {
    "orca": "orca",
    "gaussian": "gaussian94",
    "cp2k": "cp2k",
    "pyscf": "nwchem",  # PySCF 可读 NWChem 格式
    "psi4": "psi4",
    "nwchem": "nwchem",
    "json": "json",
    "molpro": "molpro",
    "qchem": "qchem",
    "turbomole": "turbomole",
}


@dataclass
class BasisResult:
    """基组查询结果。"""

    name: str
    elements: list[str]
    fmt: str
    text: str
    has_ecp: bool
    basis_version: str | None = None
    notes: list[str] = field(default_factory=list)


def _basis_version() -> str | None:
    try:
        import basis_set_exchange as bse

        meta = bse.get_metadata()
        return str(meta.get("version", meta.get("revision", ""))) or None
    except Exception:
        return None


def get_basis(name: str, elements: list[str], fmt: str = "orca") -> BasisResult:
    """取基组与配套 ECP 文本。``fmt`` 见 ``FMT_MAP``（orca/gaussian/cp2k/pyscf/…）。"""
    import basis_set_exchange as bse

    bse_fmt = FMT_MAP.get(fmt.strip().lower())
    if bse_fmt is None:
        raise ValueError(f"未知格式 {fmt!r}，可选：{sorted(FMT_MAP)}")
    if not elements:
        raise ValueError("elements 不能为空，至少给一个元素符号，如 ['Fe', 'Pt']")
    notes: list[str] = []
    if fmt.strip().lower() == "pyscf":
        notes.append("BSE 无 PySCF 原生格式，返回与其兼容的 NWChem 格式")
    try:
        text = bse.get_basis(name, elements=elements, fmt=bse_fmt, header=False)
    except Exception as e:
        try:
            available = bse.get_basis_names()
            hint = f"；基组库共 {len(available)} 个，如 {', '.join(sorted(available)[:5])}…"
        except Exception:
            hint = ""
        raise ValueError(f"取基组失败（name={name!r}）：{e}{hint}") from e
    return BasisResult(
        name=name,
        elements=list(elements),
        fmt=fmt.strip().lower(),
        text=text,
        has_ecp="ecp" in text.lower(),
        basis_version=_basis_version(),
        notes=notes,
    )
