"""单位换算与理论级别规范化。

换算常数（实施计划第 4 节）：
- 1 Hartree = 27.211386 eV
- 1 Bohr = 0.529177 Å
- 1 Hartree/Bohr = 51.42207 eV/Å

所有换算函数接受标量或数组（list/tuple/numpy 数组），返回 float 或嵌套 list。
单位名大小写不敏感（``eV``/``EV``/``ev`` 均可）。
"""

from __future__ import annotations

from collections.abc import Sequence
from typing import Any

HARTREE_TO_EV = 27.211386
BOHR_TO_ANGSTROM = 0.529177
HARTREE_PER_BOHR_TO_EV_PER_ANGSTROM = 51.42207

# 1 eV 对应的各单位数值（CODATA 2018 量级，满足 1e-6 相对误差验收线）
_EV_PER_KJ_MOL = 1.0 / 96.48533212
_EV_PER_KCAL_MOL = 1.0 / 23.060547012
_EV_PER_JOULE = 1.0 / 1.602176634e-19
_EV_PER_A3_PER_GPA = 0.006241509074
_NEWTON_TO_EV_PER_A = 6.241509074e8

_ENERGY_TO_EV: dict[str, float] = {
    "ev": 1.0,
    "mev": 1e-3,
    "ha": HARTREE_TO_EV,
    "hartree": HARTREE_TO_EV,
    "hartrees": HARTREE_TO_EV,
    "ry": HARTREE_TO_EV / 2.0,
    "rydberg": HARTREE_TO_EV / 2.0,
    "kj/mol": _EV_PER_KJ_MOL,
    "kj_mol": _EV_PER_KJ_MOL,
    "kcal/mol": _EV_PER_KCAL_MOL,
    "kcal_mol": _EV_PER_KCAL_MOL,
    "j": _EV_PER_JOULE,
    "joule": _EV_PER_JOULE,
}

_LENGTH_TO_A: dict[str, float] = {
    "angstrom": 1.0,
    "a": 1.0,
    "\u00e5": 1.0,  # Å
    "bohr": BOHR_TO_ANGSTROM,
    "a0": BOHR_TO_ANGSTROM,
    "nm": 10.0,
    "pm": 0.01,
    "m": 1e10,
}

_FORCE_TO_EV_PER_A: dict[str, float] = {
    "ev/angstrom": 1.0,
    "ev/a": 1.0,
    "ha/bohr": HARTREE_PER_BOHR_TO_EV_PER_ANGSTROM,
    "hartree/bohr": HARTREE_PER_BOHR_TO_EV_PER_ANGSTROM,
    "kj/mol/angstrom": _EV_PER_KJ_MOL,
    "n": _NEWTON_TO_EV_PER_A,
    "newton": _NEWTON_TO_EV_PER_A,
}

_STRESS_TO_EV_PER_A3: dict[str, float] = {
    "ev/angstrom^3": 1.0,
    "ev/a^3": 1.0,
    "gpa": _EV_PER_A3_PER_GPA,
    "kbar": _EV_PER_A3_PER_GPA / 10.0,
    "bar": _EV_PER_A3_PER_GPA / 1e4,
    "pa": _EV_PER_A3_PER_GPA / 1e9,
}


def _normalize_unit(unit: str) -> str:
    return unit.strip().lower().replace("\u00e5", "a").replace("angstr\u00f6m", "angstrom")


def _factor(unit: str, table: dict[str, float], kind: str) -> float:
    key = _normalize_unit(unit)
    if key not in table:
        supported = ", ".join(sorted(table))
        raise ValueError(f"不支持的{kind}单位 {unit!r}，支持：{supported}")
    return table[key]


def _apply(value: Any, factor: float) -> Any:
    if isinstance(value, (int, float)):
        return float(value) * factor
    if isinstance(value, Sequence) and not isinstance(value, (str, bytes)):
        return [_apply(v, factor) for v in value]
    tolist = getattr(value, "tolist", None)  # numpy 数组等
    if callable(tolist):
        return _apply(tolist(), factor)
    raise TypeError(f"无法换算的值类型：{type(value).__name__}")


def energy_to_ev(value: Any, unit: str) -> Any:
    """能量 → eV。"""
    return _apply(value, _factor(unit, _ENERGY_TO_EV, "能量"))


def length_to_angstrom(value: Any, unit: str) -> Any:
    """长度 → Å。"""
    return _apply(value, _factor(unit, _LENGTH_TO_A, "长度"))


def force_to_ev_per_angstrom(value: Any, unit: str) -> Any:
    """力 → eV/Å。"""
    return _apply(value, _factor(unit, _FORCE_TO_EV_PER_A, "力"))


def stress_to_ev_per_a3(value: Any, unit: str) -> Any:
    """应力 → eV/Å³。"""
    return _apply(value, _factor(unit, _STRESS_TO_EV_PER_A3, "应力"))


# -- 理论级别规范化 ------------------------------------------------------

_METHOD_ALIASES: dict[str, str] = {
    "lda": "LDA",
    "pbe": "PBE",
    "pb-esol": "PBEsol",
    "pbesol": "PBEsol",
    "pw91": "PW91",
    "blyp": "BLYP",
    "bp86": "BP86",
    "tpss": "TPSS",
    "scan": "SCAN",
    "r2scan": "R2SCAN",
    "r\u00b2scan": "R2SCAN",
    "hse03": "HSE03",
    "hse06": "HSE06",
    "pbe0": "PBE0",
    "b3lyp": "B3LYP",
    "b3pw91": "B3PW91",
    "m06": "M06",
    "m06-2x": "M06-2X",
    "wb97x-d": "WB97X-D",
    "hf": "HF",
    "mp2": "MP2",
    "ccsd": "CCSD",
    "ccsd(t)": "CCSD(T)",
    "dftb": "DFTB",
    "dftb3": "DFTB3",
    "reaxff": "ReaxFF",
    "eam": "EAM",
    "lj": "LJ",
}

_SPIN_ALIASES: dict[str, str] = {
    "restricted": "restricted",
    "rks": "restricted",
    "rhf": "restricted",
    "unrestricted": "unrestricted",
    "uks": "unrestricted",
    "uhf": "unrestricted",
    "spin-polarized": "spin-polarized",
    "spin polarized": "spin-polarized",
    "collinear": "spin-polarized",
    "noncollinear": "noncollinear",
    "non-collinear": "noncollinear",
    "spin-orbit": "spin-orbit",
    "soc": "spin-orbit",
    "unknown": "unknown",
}

_DISPERSION_ALIASES: dict[str, str] = {
    "d2": "D2",
    "d3": "D3",
    "d3zero": "D3Zero",
    "d3-zero": "D3Zero",
    "d3bj": "D3BJ",
    "d3-bj": "D3BJ",
    "d4": "D4",
    "ts": "TS",
    "mbd": "MBD",
    "vv10": "VV10",
    "none": "none",
}


def normalize_method(method: str) -> str:
    """方法名规范化：别名统一，否则去空格转大写。"""
    key = method.strip().lower().replace(" ", "").replace("_", "")
    return _METHOD_ALIASES.get(key, method.strip().upper().replace(" ", ""))


def normalize_basis(basis: str | None) -> str | None:
    """基组名规范化：去空格，保留原大小写习惯（如 def2-TZVP）。"""
    if basis is None:
        return None
    return basis.strip().replace(" ", "")


def normalize_dispersion(dispersion: str | None) -> str | None:
    """色散校正规范化；None 表示无校正。"""
    if dispersion is None:
        return None
    key = dispersion.strip().lower().replace(" ", "").replace("_", "")
    return _DISPERSION_ALIASES.get(key, dispersion.strip())


def normalize_spin(spin: str) -> str:
    """自旋处理规范化。"""
    key = spin.strip().lower().replace("_", " ")
    return _SPIN_ALIASES.get(key, spin.strip().lower())


def program_major(version: str | None) -> str | None:
    """程序版本取主版本（"6.3.2" → "6"），键里只区分主版本。"""
    if version is None:
        return None
    return version.strip().split(".")[0]


def _fmt_cutoff(cutoff_ev: float | None) -> str:
    if cutoff_ev is None:
        return "-"
    return f"{float(cutoff_ev):g}"


def theory_key(
    *,
    method: str,
    basis_set: str | None = None,
    cutoff_ev: float | None = None,
    pseudopotential: str | None = None,
    dispersion: str | None = None,
    spin: str = "unknown",
    program: str | None = None,
    program_version: str | None = None,
    energy_type: str = "total",
    energy_correction: str | None = None,
) -> str:
    """生成混用检查键：同一训练集只允许一个键。

    显式 ``allow_mixed=True`` 才能混用（导出层在阶段 3 实现，本函数只产键）。
    """
    parts = [
        normalize_method(method),
        normalize_basis(basis_set) or "-",
        _fmt_cutoff(cutoff_ev),
        (pseudopotential or "-").strip(),
        normalize_dispersion(dispersion) or "-",
        normalize_spin(spin),
        (program.strip().lower() if program else "-"),
        (program_major(program_version) or "-"),
        energy_type.strip().lower(),
        (energy_correction.strip() if energy_correction else "-"),
    ]
    return "|".join(parts)


_KEY_LABELS = [
    "method",
    "basis_set",
    "cutoff_ev",
    "pseudopotential",
    "dispersion",
    "spin",
    "program",
    "program_major",
    "energy_type",
    "energy_correction",
]


def explain_key_difference(key_a: str, key_b: str) -> str:
    """解释两个混用检查键的差异（导出拒绝时给原因用）。"""
    pa, pb = key_a.split("|"), key_b.split("|")
    if len(pa) != len(_KEY_LABELS) or len(pb) != len(_KEY_LABELS):
        return "键格式无法解析，无法比较"
    diffs = [f"{label}: {a} ≠ {b}" for label, a, b in zip(_KEY_LABELS, pa, pb) if a != b]
    if not diffs:
        return "两键完全一致，可以混用"
    return "理论级别不一致：" + "；".join(diffs)
