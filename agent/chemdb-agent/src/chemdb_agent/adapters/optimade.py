"""OPTIMADE 适配器：按 OPTIMADE v1 规范直接请求各家 /v1/structures。

- 共用 :mod:`chemdb_agent.net`：超时、重试和清楚的报错。0.1.0 经 optimade 客户端库，
  它的类级结果缓存会跨查询累积、提供方报错被吞，0.2.0 改为直接 HTTP。
- 化学式按 OPTIMADE ``chemical_formula_reduced`` 的约定规范化（元素按字母序、约去公约数、
  系数 1 省略），所以 ``NaCl``、``ClNa``、``Na2Cl2`` 等价。不支持按该字段检索的提供方
  （AFLOW、COD，2026-11-06 实测）改用元素过滤，结果一律在本地再核对组成，不符的丢弃。
- 带计算能量的提供方见 :data:`ENERGY_FIELDS`，其余返回纯结构记录（能量为 None，进不了训练集）。
- 部分占据位点取首个元素并在 extras 标注 ``partial_occupancy``。
- 端点状态（2026-11-06 按 providers.optimade.org 的列表逐个实测）：下列 15 个库可用；
  TCOD 与 MPDS 不给原子坐标（MPDS 另需授权），MPDD、Matterverse、MPOD 超时，CMR 返回 404，
  AtomGPT 返回非 JSON，PSDI 各子库对测试查询无结构，均未接入。OQMD 时好时坏（同一天里既有
  20 秒的正常返回，也有连续 502）。
- 每页上限各家不同（COD 为 10）：超了就按提供方报出的上限重试一次。
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from functools import reduce
from math import gcd
from typing import Any

from ase import Atoms
from ase.data import chemical_symbols
from pymatgen.core import Composition

from chemdb_agent import net, units
from chemdb_agent.adapters.materials_project import MP_LICENSE
from chemdb_agent.schema import EnergyType, LevelOfTheory, Source, UnifiedRecord

PROVIDERS: dict[str, str] = {
    "aflow": "https://aflow.org/API/optimade",
    "cod": "https://www.crystallography.net/cod/optimade",
    "nomad": "https://nomad-lab.eu/prod/v1/optimade",
    "jarvis": "https://jarvis.nist.gov/optimade/jarvisdft",
    # Materials Cloud 本体是索引元数据库，结构取其 MC3D（PBE-v1）子库
    "materialscloud": "https://optimade.materialscloud.org/main/mc3d-pbe-v1",
    # 0.2.0 新增
    "alexandria-pbe": "https://alexandria.icams.rub.de/pbe",
    "alexandria-pbesol": "https://alexandria.icams.rub.de/pbesol",
    "mp": "https://optimade.materialsproject.org",  # 无需 MP_API_KEY，只有结构
    "oqmd": "https://oqmd.org/optimade",  # 慢且不稳：实测单次查询约 20 秒，有时连续 502
    "mc3d-pbesol": "https://optimade.materialscloud.org/main/mc3d-pbesol-v2",
    "mc2d": "https://optimade.materialscloud.org/main/mc2d",
    "odbx": "https://optimade-misc.odbx.science",
    "gnome": "https://optimade-gnome.odbx.science",
    "omdb": "http://optimade.openmaterialsdb.se",  # 提供方只有 http
    "twodmatpedia": "http://optimade.2dmatpedia.org",  # 提供方只有 http
}

# 各家 /v1/info 都没有 license 字段，下表取自提供方自己的说明；查不到的记 see-provider-terms
LICENSES: dict[str, str] = {
    "aflow": "AFLOW-ToU",
    "cod": "CC0-1.0",
    "nomad": "CC-BY-4.0",
    "alexandria-pbe": "CC-BY-4.0",
    "alexandria-pbesol": "CC-BY-4.0",
    "oqmd": "CC-BY-4.0",
    "mp": MP_LICENSE,
    "gnome": "CC-BY-NC-4.0",
}

# 按 chemical_formula_reduced 检索会报错的提供方（COD 返回 501，AFLOW 返回非规范响应）
NO_FORMULA_FILTER = frozenset({"aflow", "cod"})
# 已知的每页上限（COD 实测 10）；没列的提供方超限时按报错里的上限重试
PAGE_LIMIT_MAX: dict[str, int] = {"cod": 10}
_PAGE_LIMIT_RE = re.compile(r"page_limit\D*\d+\s*>\s*(\d+)")

# 只用 v1.0/v1.1 标准字段；COD 不点名就不给坐标
RESPONSE_FIELDS: list[str] = [
    "elements",
    "nelements",
    "chemical_formula_reduced",
    "chemical_formula_hill",
    "dimension_types",
    "nsites",
    "lattice_vectors",
    "cartesian_site_positions",
    "species_at_sites",
    "species",
]

# Materials Project 的 GGA+U 规则：含 O 或 F，且含下列过渡金属之一
_MP_U_ANIONS = frozenset({"O", "F"})
_MP_U_METALS = frozenset({"Co", "Cr", "Fe", "Mn", "Mo", "Ni", "V", "W"})


@dataclass(frozen=True)
class EnergyFields:
    """提供方的能量字段。单位取自各家 /v1/info/structures 的声明（2026-11-06）。"""

    energy: str  # 每个晶胞的总能量，eV
    method: str
    program: str
    forces: str | None = None  # eV/Å
    stress: str | None = None  # kbar，VASP 的号约定（压为正），换成 ASE 约定要取负
    mp_u_rule: bool = False  # 与 MP 参数兼容的库：按 MP 规则把可能用了 +U 的体系单独标出
    extras: tuple[str, ...] = ()


ENERGY_FIELDS: dict[str, EnergyFields] = {
    "alexandria-pbe": EnergyFields(
        "_alexandria_energy", "PBE", "VASP", forces="_alexandria_forces", stress="_alexandria_stress_tensor",
        mp_u_rule=True, extras=("_alexandria_formation_energy_per_atom", "_alexandria_hull_distance"),
    ),
    "alexandria-pbesol": EnergyFields(
        "_alexandria_energy", "PBEsol", "VASP", forces="_alexandria_forces", stress="_alexandria_stress_tensor",
        mp_u_rule=True, extras=("_alexandria_formation_energy_per_atom", "_alexandria_hull_distance"),
    ),
    "materialscloud": EnergyFields("_mcloud_total_energy", "PBE", "Quantum ESPRESSO"),
    "mc3d-pbesol": EnergyFields("_mcloud_total_energy", "PBEsol", "Quantum ESPRESSO"),
}


# -- 化学式与元素 ----------------------------------------------------------


def normalize_formula(formula: str) -> str:
    """化学式 → OPTIMADE 约化式（字母序、约去公约数、系数 1 省略），如 Na2Cl2 → ClNa。"""
    text = formula.strip().replace(" ", "")
    try:
        comp = Composition(text)
        amounts = comp.get_el_amt_dict()
    except Exception as e:
        raise ValueError(f"化学式 {formula!r} 无法解析：{e}") from e
    if not amounts:
        raise ValueError(f"化学式 {formula!r} 无法解析：没有元素")
    if any(abs(n - round(n)) > 1e-6 for n in amounts.values()):
        raise ValueError(f"化学式 {formula!r} 含非整数计量，OPTIMADE 只能查整数计量的约化式")
    counts = {el: int(round(n)) for el, n in amounts.items()}
    g = reduce(gcd, counts.values())
    return "".join(f"{el}{n // g if n // g != 1 else ''}" for el, n in sorted(counts.items()))


def formula_of_atoms(atoms: Atoms) -> str:
    return normalize_formula(atoms.get_chemical_formula(mode="hill"))


def normalize_elements(elements: list[str]) -> list[str]:
    """元素符号规范化（si/SI → Si）并去重排序；不是元素符号就报错。"""
    out = set()
    for el in elements:
        sym = el.strip().capitalize()
        if sym not in chemical_symbols or sym == "X":
            raise ValueError(f"{el!r} 不是元素符号")
        out.add(sym)
    return sorted(out)


def _quote(value: str) -> str:
    """OPTIMADE 过滤语言的字符串字面量（转义反斜杠与双引号）。"""
    return '"' + value.replace("\\", "\\\\").replace('"', '\\"') + '"'


def _elements_filter(elements: list[str]) -> str:
    quoted = ", ".join(_quote(el) for el in elements)
    return f"elements HAS ALL {quoted} AND nelements={len(elements)}"


# -- 解析 ------------------------------------------------------------------


def _attributes_to_atoms(a: dict[str, Any]) -> tuple[Atoms, bool]:
    """OPTIMADE 属性 → ASE Atoms。返回 (atoms, 是否含部分占据)。"""
    species = {sp["name"]: sp.get("chemical_symbols", [sp["name"]]) for sp in a.get("species") or []}
    symbols: list[str] = []
    partial = False
    for site in a.get("species_at_sites") or []:
        syms = species.get(site, [site])
        symbols.append(syms[0])
        if len(syms) > 1:
            partial = True
    for sp in a.get("species") or []:
        conc = sp.get("concentration", [1.0])
        if any(c < 1.0 - 1e-9 for c in conc):
            partial = True
    positions = a.get("cartesian_site_positions") or []
    if len(symbols) != len(positions):
        raise ValueError(f"位点数不一致：{len(symbols)} 个 species_at_sites 对 {len(positions)} 组坐标")
    cell = a.get("lattice_vectors")
    dim_types = a.get("dimension_types") or [1, 1, 1]
    pbc = [bool(d) for d in dim_types[:3]]
    return Atoms(symbols=symbols, positions=positions, cell=cell, pbc=pbc), partial


def _needs_mp_u(atoms: Atoms) -> bool:
    els = set(atoms.get_chemical_symbols())
    return bool(els & _MP_U_ANIONS) and bool(els & _MP_U_METALS)


def _energy_kwargs(provider: str, a: dict[str, Any], atoms: Atoms) -> tuple[dict[str, Any], LevelOfTheory, dict, dict]:
    """取能量/力/应力并换成统一单位；没有能量时返回纯结构的理论级别。"""
    spec = ENERGY_FIELDS.get(provider)
    raw_units = {"length": "Angstrom"}
    extras: dict[str, Any] = {}
    if spec is None or a.get(spec.energy) is None:
        return {}, LevelOfTheory(method="unknown", spin="unknown"), raw_units, extras
    method = spec.method
    if spec.mp_u_rule and _needs_mp_u(atoms):
        # 提供方没有 U 字段；与 MP 参数兼容即按 MP 规则推断，单独成键，绝不与无 U 的混在一起
        method += "+U"
        extras["hubbard_u_inferred"] = "按 Materials Project 的 GGA+U 规则推断（提供方未给出 U 字段）"
    kwargs: dict[str, Any] = {
        "energy": units.energy_to_ev(a[spec.energy], "eV"),
        "energy_type": EnergyType.TOTAL,
    }
    raw_units["energy"] = "eV (per cell)"
    forces = a.get(spec.forces) if spec.forces else None
    if forces is not None and len(forces) == len(atoms):
        kwargs["forces"] = units.force_to_ev_per_angstrom(forces, "eV/Angstrom")
        raw_units["forces"] = "eV/Angstrom"
    stress = a.get(spec.stress) if spec.stress else None
    if stress is not None and len(stress) == 3:
        kwargs["stress"] = [[-v for v in row] for row in units.stress_to_ev_per_a3(stress, "kbar")]
        raw_units["stress"] = "kbar (VASP sign; negated to ASE convention)"
    for field in spec.extras:
        if a.get(field) is not None:
            extras[field.lstrip("_")] = a[field]
    lot = LevelOfTheory(method=method, program=spec.program, spin="unknown")
    return kwargs, lot, raw_units, extras


def _to_record(provider: str, item: dict[str, Any]) -> UnifiedRecord:
    a = item.get("attributes", item)
    entry_id = str(item.get("id", "?"))
    atoms, partial = _attributes_to_atoms(a)
    if not atoms.pbc.any():
        # 分子/团簇条目：统一记录要求分子必须给 charge/multiplicity，
        # 材料库不提供这两个量，不能瞎填——明确报错，由检索层跳过。
        raise ValueError(f"非周期条目（{entry_id}）：dimension_types 全 0，不是晶体结构")
    if len(atoms) == 0:
        raise ValueError(f"条目 {entry_id} 没有原子坐标")
    energy_kwargs, lot, raw_units, energy_extras = _energy_kwargs(provider, a, atoms)
    base_url = PROVIDERS[provider]
    return UnifiedRecord.from_atoms(
        atoms,
        record_id=f"optimade-{provider}:{entry_id}",
        level_of_theory=lot,
        source=Source(database=f"optimade-{provider}", url=f"{base_url}/v1/structures/{entry_id}"),
        license=LICENSES.get(provider, "see-provider-terms"),
        raw_units=raw_units,
        extras={
            "formula_reduced": a.get("chemical_formula_reduced"),
            "formula_hill": a.get("chemical_formula_hill"),
            "nsites": a.get("nsites"),
            "partial_occupancy": partial,
            **energy_extras,
        },
        **energy_kwargs,
    )


# -- 查询 ------------------------------------------------------------------


def _fields(provider: str) -> list[str]:
    spec = ENERGY_FIELDS.get(provider)
    if spec is None:
        return RESPONSE_FIELDS
    extra = [f for f in (spec.energy, spec.forces, spec.stress, *spec.extras) if f]
    return RESPONSE_FIELDS + extra


def _query(provider: str, optimade_filter: str, limit: int) -> list[dict[str, Any]]:
    limit = min(limit, PAGE_LIMIT_MAX.get(provider, limit))
    params = {"filter": optimade_filter, "page_limit": limit, "response_fields": ",".join(_fields(provider))}
    url = f"{PROVIDERS[provider]}/v1/structures"
    try:
        data = net.request(f"OPTIMADE {provider}", url, params=params)
    except net.SourceError as e:
        cap = _PAGE_LIMIT_RE.search(str(e))
        if not cap or int(cap.group(1)) >= limit:
            raise
        params["page_limit"] = int(cap.group(1))
        data = net.request(f"OPTIMADE {provider}", url, params=params)
    items = data.get("data") if isinstance(data, dict) else None
    if not isinstance(items, list):
        errors = data.get("errors") if isinstance(data, dict) else None
        detail = errors[0].get("detail") if isinstance(errors, list) and errors and isinstance(errors[0], dict) else data
        raise net.SourceError(f"OPTIMADE {provider}", f"响应里没有 data：{str(detail)[:200]}")
    return items[:limit]


def search_structures(
    formula: str | None = None,
    elements: list[str] | None = None,
    providers: tuple[str, ...] | list[str] = ("aflow", "cod"),
    limit: int = 50,
) -> list[UnifiedRecord]:
    """跨 OPTIMADE 提供方查晶体结构。``formula`` 优先于 ``elements``。"""
    unknown = [p for p in providers if p not in PROVIDERS]
    if unknown:
        raise ValueError(f"未知 OPTIMADE 提供方 {unknown}，可选：{sorted(PROVIDERS)}")
    target = normalize_formula(formula) if formula is not None else None
    if target is not None:
        elements = sorted(Composition(target).get_el_amt_dict())
    if not elements:
        raise ValueError("请至少给出 formula、elements 中的一个")
    elements = normalize_elements(elements)
    per = max(1, limit // max(1, len(providers)))
    records: list[UnifiedRecord] = []
    for provider in providers:
        server_side = target is not None and provider not in NO_FORMULA_FILTER
        query_filter = f"chemical_formula_reduced={_quote(target)}" if server_side else _elements_filter(elements)
        if provider == "nomad":
            # NOMAD 混有分子/团簇条目；dimension_types 在 NOMAD 不可检索（实测 400），用 nperiodic_dimensions
            query_filter += " AND nperiodic_dimensions>=1"
        # 本地筛化学式时多取一些，免得第一页全是别的计量比
        fetch = per if target is None or server_side else min(100, per * 10)
        kept = 0
        for item in _query(provider, query_filter, fetch):
            try:
                rec = _to_record(provider, item)
            except ValueError as e:
                if "非周期条目" in str(e) or "没有原子坐标" in str(e):
                    continue  # 个别提供方混入的团簇/空条目跳过，不冒充晶体
                raise ValueError(f"提供方 {provider} 的条目无法转换：{e}") from e
            if target is not None and formula_of_atoms(rec.atoms) != target:
                continue  # 提供方的约化式与真实组成不符，或元素过滤取到了别的计量比
            records.append(rec)
            kept += 1
            if kept >= per:
                break
    return records[:limit]


def get_record(record_id: str) -> UnifiedRecord:
    """按 optimade-<provider>:<id> 取单条记录。"""
    prefix, sep, entry_id = record_id.partition(":")
    if not sep or not prefix.startswith("optimade-") or not entry_id:
        raise ValueError(f"record_id 须形如 optimade-aflow:<id>，实际 {record_id!r}")
    provider = prefix.removeprefix("optimade-")
    if provider not in PROVIDERS:
        raise ValueError(f"未知 OPTIMADE 提供方 {provider!r}，可选：{sorted(PROVIDERS)}")
    items = _query(provider, f"id={_quote(entry_id)}", 1)
    if not items:
        raise KeyError(f"{provider} 里找不到 {entry_id}")
    return _to_record(provider, items[0])
