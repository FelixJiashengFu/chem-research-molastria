"""统一记录模型：所有适配器都返回这一种记录。

字段清单见实施计划第 4 节（TABLE1）。设计要点：

- ``structure`` 存 extxyz 文本（Å），构造时即用 ASE 解析校验，保证随时可转 Atoms。
- ``level_of_theory`` 与 ``source`` 必填——缺了就不能导出（导出层在阶段 3 强制执行）。
- 分子（无周期性）必须给 ``charge`` 与 ``multiplicity``；周期体系可空。
- ``forces``/``stress`` 若给出，必须与结构原子数/3x3 对齐。
- ``energy_correction`` 单独标注 MP 兼容性校正等能量修正，不与原始总能量混用；
  它是 :meth:`UnifiedRecord.mix_key` 的一部分。
"""

from __future__ import annotations

from datetime import datetime, timezone
from enum import Enum
from io import StringIO
from typing import Any

from ase import Atoms
from ase.io import read as ase_read
from ase.io.extxyz import write_extxyz
from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from chemdb_agent import units


def _parse_extxyz_frames(text: str) -> list[Atoms]:
    """解析 extxyz 全部帧。read_extxyz 默认只读首帧，这里用 index=":" 全读。"""
    return ase_read(StringIO(text), format="extxyz", index=":")


class EnergyType(str, Enum):
    """能量类型。不同类型永不混进同一个训练集。"""

    TOTAL = "total"
    FORMATION_PER_ATOM = "formation_per_atom"
    ATOMIZATION = "atomization"
    BINDING = "binding"


class LevelOfTheory(BaseModel):
    """理论级别：方法、基组或截断能+赝势、色散校正、自旋处理、程序及版本。"""

    model_config = ConfigDict(extra="forbid")

    method: str = Field(..., description="电子结构方法，如 PBE、B3LYP、HF")
    basis_set: str | None = Field(default=None, description="基组，如 def2-TZVP")
    cutoff_ev: float | None = Field(default=None, description="平面波截断能，eV")
    pseudopotential: str | None = Field(default=None, description="赝势族，如 PAW_PBE_54")
    dispersion: str | None = Field(default=None, description="色散校正，如 D3BJ；无则为 None")
    spin: str = Field(default="unknown", description="自旋处理，如 restricted/unrestricted/spin-polarized")
    program: str | None = Field(default=None, description="计算程序，如 VASP、ORCA")
    program_version: str | None = Field(default=None, description="程序版本，如 6.3.2（键里只取主版本）")


class Source(BaseModel):
    """数据来源：库名、版本、链接、获取时间。"""

    model_config = ConfigDict(extra="forbid")

    database: str = Field(..., description="数据库名，如 materials_project、pubchem")
    dataset_version: str | None = Field(default=None, description="数据集版本")
    url: str | None = Field(default=None, description="记录链接")
    doi: str | None = Field(default=None, description="DOI")
    retrieved_at: datetime = Field(
        default_factory=lambda: datetime.now(timezone.utc), description="获取时间（UTC）"
    )


class UnifiedRecord(BaseModel):
    """跨库统一记录。能量 eV、长度 Å、力 eV/Å、应力 eV/Å³。"""

    model_config = ConfigDict(extra="forbid")

    record_id: str = Field(..., pattern=r"^[^:\s]+:[^:\s].*$", description="来源:原始ID，如 mp:mp-149")
    structure: str = Field(..., description="extxyz 文本（单个构型，坐标 Å）")
    charge: int | None = Field(default=None, description="总电荷；分子必填")
    multiplicity: int | None = Field(default=None, description="自旋多重度；分子必填")
    energy: float | None = Field(default=None, description="能量数值，eV；纯结构来源为 None")
    energy_type: EnergyType | None = Field(default=None, description="能量类型；与 energy 同有同无")
    energy_correction: str | None = Field(
        default=None, description="能量修正标注，如 MP2020 compatibility；None 表示原始能量"
    )
    forces: list[list[float]] | None = Field(default=None, description="原子受力，eV/Å，形状 (natoms,3)")
    stress: list[list[float]] | None = Field(default=None, description="应力，eV/Å³，形状 (3,3)")
    level_of_theory: LevelOfTheory
    source: Source
    license: str = Field(..., description="许可，如 CC-BY-4.0")
    raw_units: dict[str, str] = Field(default_factory=dict, description="原始单位（审计用）")
    extras: dict[str, Any] = Field(default_factory=dict, description="适配器透传的额外字段")

    # -- 构造与转换 ------------------------------------------------------

    @classmethod
    def from_atoms(
        cls,
        atoms: Atoms,
        *,
        record_id: str,
        energy: float | None = None,
        energy_type: EnergyType | None = None,
        level_of_theory: LevelOfTheory,
        source: Source,
        license: str,
        **kwargs: Any,
    ) -> "UnifiedRecord":
        """从 ASE Atoms 构造记录（extxyz 序列化由本方法完成）。"""
        buf = StringIO()
        write_extxyz(buf, atoms)
        return cls(
            record_id=record_id,
            structure=buf.getvalue(),
            energy=energy,
            energy_type=energy_type,
            level_of_theory=level_of_theory,
            source=source,
            license=license,
            **kwargs,
        )

    @property
    def atoms(self) -> Atoms:
        """结构对应的 ASE Atoms（坐标 Å）。构造时已校验，此处必能解析。"""
        images = _parse_extxyz_frames(self.structure)
        return images[0]

    @property
    def is_periodic(self) -> bool:
        """是否有任一方向的周期性。"""
        return bool(self.atoms.get_pbc().any())

    @property
    def mix_key(self) -> str:
        """混用检查键：同一训练集只允许一个键（加理论级别+能量类型+修正标注）。"""
        lot = self.level_of_theory
        return units.theory_key(
            method=lot.method,
            basis_set=lot.basis_set,
            cutoff_ev=lot.cutoff_ev,
            pseudopotential=lot.pseudopotential,
            dispersion=lot.dispersion,
            spin=lot.spin,
            program=lot.program,
            program_version=lot.program_version,
            energy_type=self.energy_type.value if self.energy_type else "none",
            energy_correction=self.energy_correction,
        )

    # -- 校验 ------------------------------------------------------------

    @field_validator("structure")
    @classmethod
    def _structure_must_be_single_extxyz(cls, v: str) -> str:
        try:
            images = _parse_extxyz_frames(v)
        except Exception as e:
            raise ValueError(f"structure 不是合法 extxyz：{e}") from e
        if len(images) != 1:
            raise ValueError(f"structure 必须恰好包含 1 个构型，实际 {len(images)} 个")
        if len(images[0]) == 0:
            raise ValueError("structure 不包含任何原子")
        return v

    @model_validator(mode="after")
    def _check_consistency(self) -> "UnifiedRecord":
        atoms = self.atoms  # structure 字段校验已保证可解析
        natoms = len(atoms)
        if self.forces is not None:
            if len(self.forces) != natoms or any(len(f) != 3 for f in self.forces):
                raise ValueError(
                    f"forces 形状必须为 ({natoms},3)，"
                    f"实际 ({len(self.forces)},{len(self.forces[0]) if self.forces else '?'})"
                )
        if self.stress is not None:
            if len(self.stress) != 3 or any(len(row) != 3 for row in self.stress):
                raise ValueError("stress 形状必须为 (3,3)")
        if (self.energy is None) != (self.energy_type is None):
            raise ValueError("energy 与 energy_type 必须同有同无")
        if self.energy_correction is not None and self.energy is None:
            raise ValueError("energy_correction 需要 energy 非空")
        if not self.is_periodic and (self.charge is None or self.multiplicity is None):
            raise ValueError("分子（无周期性）必须给出 charge 与 multiplicity")
        return self
