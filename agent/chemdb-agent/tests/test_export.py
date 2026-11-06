"""导出层：extxyz / ASE db 读回核对能量、力、应力、单位与来源清单；理论级别检查。"""

import json

import numpy as np
import pytest
from ase.build import bulk, molecule
from ase.io import read

from chemdb_agent import export, units
from chemdb_agent.schema import EnergyType, LevelOfTheory, Source, UnifiedRecord

PBE = LevelOfTheory(method="PBE", cutoff_ev=520.0, pseudopotential="PAW_PBE_54", spin="spin-polarized", program="VASP")
WB97 = LevelOfTheory(method="wb97m-d3bj", basis_set="def2-tzvppd", program="psi4", program_version="1.8.1")


def crystal(i, lot=PBE, **kw):
    atoms = bulk("Si", "diamond", a=5.43 + 0.01 * i)
    params = dict(
        record_id=f"test:si-{i}", energy=-10.8 - 0.01 * i, energy_type=EnergyType.TOTAL,
        forces=[[0.01 * i, 0.0, -0.02]] * len(atoms), stress=[[0.001, 0.0, 0.0], [0.0, 0.002, 0.0], [0.0, 0.0, 0.003]],
        level_of_theory=lot, source=Source(database="test", url=f"https://example.invalid/si-{i}"), license="CC-BY-4.0",
    )
    params.update(kw)
    return UnifiedRecord.from_atoms(atoms, **params)


def water_from_hartree():
    """QCArchive 风格的原始单位：Hartree 与 Hartree/Bohr，换算后进记录。"""
    mol = molecule("H2O")
    grad = [[0.001, 0.0, 0.0], [0.0, -0.002, 0.0], [0.0, 0.0, 0.003]]
    return UnifiedRecord.from_atoms(
        mol, record_id="qcarchive-ml:1", charge=0, multiplicity=1,
        energy=units.energy_to_ev(-76.4, "Ha"), energy_type=EnergyType.TOTAL,
        forces=[[-v for v in row] for row in units.force_to_ev_per_angstrom(grad, "Ha/Bohr")],
        level_of_theory=WB97, source=Source(database="qcarchive-ml", dataset_version="SPICE test"),
        license="CC0-1.0", raw_units={"energy": "Hartree", "forces": "Hartree/Bohr"},
    )


def test_extxyz_roundtrip_values_units_and_manifest(tmp_path):
    recs = [crystal(i) for i in range(3)]
    out = export.export_training_set(recs, tmp_path / "si.extxyz")
    assert out["n_records"] == 3 and out["licenses"] == {"CC-BY-4.0": 3}
    frames = read(tmp_path / "si.extxyz", index=":")
    assert len(frames) == 3
    for rec, atoms in zip(recs, frames):
        assert atoms.get_potential_energy() == pytest.approx(rec.energy)
        assert np.allclose(atoms.get_forces(), rec.forces)
        voigt = atoms.get_stress()  # ASE 给 Voigt 六分量 xx yy zz yz xz xy
        assert voigt[:3].tolist() == pytest.approx([0.001, 0.002, 0.003])
        assert atoms.info["record_id"] == rec.record_id
        assert atoms.info["theory_key"] == rec.mix_key
        assert atoms.info["license"] == "CC-BY-4.0"
    manifest = json.loads((tmp_path / "si.extxyz.manifest.json").read_text(encoding="utf-8"))
    assert manifest["units"]["energy"] == "eV" and manifest["units"]["forces"] == "eV/Angstrom"
    assert manifest["n_records"] == 3 and not manifest["mixed_level_of_theory"]
    row = manifest["records"][0]
    assert row["record_id"] == "test:si-0" and row["url"] == "https://example.invalid/si-0"
    assert row["level_of_theory"]["method"] == "PBE" and row["license"] == "CC-BY-4.0"
    assert row["retrieved_at"] and row["has_forces"] and row["has_stress"]


def test_hartree_record_exports_in_ev(tmp_path):
    rec = water_from_hartree()
    export.export_training_set([rec], tmp_path / "w.xyz")
    atoms = read(tmp_path / "w.xyz")
    assert atoms.get_potential_energy() == pytest.approx(-76.4 * 27.211386)
    assert atoms.get_forces()[0][0] == pytest.approx(-0.001 * 51.42207)
    assert atoms.info["charge"] == 0 and atoms.info["multiplicity"] == 1
    m = json.loads((tmp_path / "w.xyz.manifest.json").read_text(encoding="utf-8"))
    assert m["records"][0]["raw_units"]["energy"] == "Hartree"
    assert m["records"][0]["dataset_version"] == "SPICE test"


def test_mixed_level_of_theory_is_refused_with_reason(tmp_path):
    other = LevelOfTheory(method="PBEsol", cutoff_ev=520.0, pseudopotential="PAW_PBE_54", spin="spin-polarized", program="VASP")
    recs = [crystal(0), crystal(1), crystal(2, lot=other)]
    with pytest.raises(export.ExportError, match="理论级别不一致") as e:
        export.export_training_set(recs, tmp_path / "x.extxyz")
    assert "method: PBE ≠ PBEsol" in str(e.value)
    assert not (tmp_path / "x.extxyz").exists()
    # 指定一个键只导出它
    out = export.export_training_set(recs, tmp_path / "x.extxyz", level_of_theory=recs[0].mix_key)
    assert out["n_records"] == 2 and out["n_excluded"] == 1
    # 显式允许混用
    out = export.export_training_set(recs, tmp_path / "y.extxyz", allow_mixed=True)
    m = json.loads((tmp_path / "y.extxyz.manifest.json").read_text(encoding="utf-8"))
    assert out["n_records"] == 3 and m["mixed_level_of_theory"]
    with pytest.raises(export.ExportError, match="现有的键"):
        export.export_training_set(recs, tmp_path / "z.extxyz", level_of_theory="nope")


def test_energy_correction_and_energy_type_split_keys(tmp_path):
    a = crystal(0)
    b = crystal(1, energy_type=EnergyType.FORMATION_PER_ATOM)
    c = crystal(2, energy_correction="MP compatibility")
    for pair in ((a, b), (a, c)):
        with pytest.raises(export.ExportError, match="理论级别不一致"):
            export.export_training_set(list(pair), tmp_path / "p.extxyz")


def test_structure_only_records_are_refused(tmp_path):
    rec = crystal(0, energy=None, energy_type=None, forces=None, stress=None, record_id="optimade-cod:1")
    with pytest.raises(export.ExportError, match="没有能量.*optimade-cod:1"):
        export.export_training_set([rec, crystal(1)], tmp_path / "s.extxyz")


def test_overwrite_suffix_and_empty(tmp_path):
    export.export_training_set([crystal(0)], tmp_path / "a.extxyz")
    with pytest.raises(export.ExportError, match="已存在"):
        export.export_training_set([crystal(0)], tmp_path / "a.extxyz")
    export.export_training_set([crystal(1)], tmp_path / "a.extxyz", overwrite=True)
    assert read(tmp_path / "a.extxyz").info["record_id"] == "test:si-1"
    with pytest.raises(export.ExportError, match="扩展名"):
        export.export_training_set([crystal(0)], tmp_path / "a.db", fmt="extxyz")
    with pytest.raises(export.ExportError, match="没有记录"):
        export.export_training_set([], tmp_path / "e.extxyz")


def test_ase_db_roundtrip(tmp_path):
    import ase.db

    recs = [crystal(0), crystal(1)]
    export.export_training_set(recs, tmp_path / "t.db", fmt="ase_db")
    db = ase.db.connect(tmp_path / "t.db")
    rows = list(db.select())
    assert len(rows) == 2
    assert rows[0].energy == pytest.approx(recs[0].energy)
    assert np.allclose(rows[0].forces, recs[0].forces)
    assert rows[0].record_id == "test:si-0" and rows[0].license == "CC-BY-4.0"


def test_license_notes():
    from collections import Counter

    notes = export._license_notes(Counter({"CC-BY-NC-4.0": 2, "CC-BY-SA-3.0": 1, "unspecified (x)": 1, "CC0-1.0": 3}))
    assert any("非商业" in n for n in notes)
    assert any("相同许可" in n for n in notes)
    assert any("没有明确许可" in n for n in notes)
    assert len(notes) == 3
