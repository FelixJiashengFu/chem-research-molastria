"""schema.py + units.py 单元测试。验收线：两文件合计覆盖率 ≥ 90%，换算相对误差 < 1e-6。"""

import math
from io import StringIO

import pytest
from ase.build import bulk, molecule
from ase.io.extxyz import write_extxyz
from pydantic import ValidationError

from chemdb_agent import schema, units
from chemdb_agent.schema import EnergyType, LevelOfTheory, Source, UnifiedRecord


@pytest.fixture()
def si_atoms():
    return bulk("Si", "diamond", a=5.43)


@pytest.fixture()
def water_atoms():
    mol = molecule("H2O")
    mol.set_pbc(False)
    return mol


@pytest.fixture()
def lot():
    return LevelOfTheory(method="PBE", cutoff_ev=520.0, pseudopotential="PAW_PBE_54",
                         spin="spin-polarized", program="VASP", program_version="6.3.2")


@pytest.fixture()
def source():
    return Source(database="materials_project", dataset_version="2024.01", url="https://example.invalid/mp-149")


def make_record(atoms, lot, source, **kwargs):
    params = dict(record_id="mp:mp-149", energy=-10.0, energy_type=EnergyType.TOTAL,
                  level_of_theory=lot, source=source, license="CC-BY-4.0")
    if not atoms.get_pbc().any():
        params.update(charge=0, multiplicity=1)
    params.update(kwargs)
    return UnifiedRecord.from_atoms(atoms, **params)


# -- units：换算 ----------------------------------------------------------


def test_energy_hartree_exact():
    assert units.energy_to_ev(1.0, "Ha") == 27.211386
    assert units.energy_to_ev(2.0, "hartree") == pytest.approx(54.422772)


def test_energy_units_relative_error():
    # 与 CODATA 参考值的相对误差远小于 1e-6 验收线
    assert units.energy_to_ev(96.48533212, "kJ/mol") == pytest.approx(1.0, rel=1e-9)
    assert units.energy_to_ev(23.060547012, "kcal/mol") == pytest.approx(1.0, rel=1e-9)
    assert units.energy_to_ev(1000.0, "meV") == pytest.approx(1.0)
    assert units.energy_to_ev(2.0, "Ry") == pytest.approx(27.211386)
    assert units.energy_to_ev(1.602176634e-19, "J") == pytest.approx(1.0, rel=1e-9)


def test_units_case_insensitive_and_alias():
    assert units.energy_to_ev(1.0, "EV") == 1.0
    assert units.energy_to_ev(1.0, "eV") == 1.0
    assert units.length_to_angstrom(1.0, "A") == 1.0
    assert units.length_to_angstrom(1.0, "\u00e5") == 1.0  # Å
    assert units.force_to_ev_per_angstrom(1.0, "eV/A") == 1.0
    assert units.stress_to_ev_per_a3(1.0, "GPa") == pytest.approx(0.006241509074)


def test_length_force_stress_values():
    assert units.length_to_angstrom(1.0, "Bohr") == 0.529177
    assert units.length_to_angstrom(1.0, "nm") == 10.0
    assert units.length_to_angstrom(100.0, "pm") == 1.0
    assert units.force_to_ev_per_angstrom(1.0, "Ha/Bohr") == 51.42207
    assert units.force_to_ev_per_angstrom(96.48533212, "kJ/mol/angstrom") == pytest.approx(1.0, rel=1e-9)
    assert units.force_to_ev_per_angstrom(1.0, "N") == pytest.approx(6.241509074e8)
    assert units.stress_to_ev_per_a3(10.0, "kbar") == pytest.approx(0.006241509074)
    assert units.stress_to_ev_per_a3(1e9, "Pa") == pytest.approx(0.006241509074)


def test_convert_sequences_and_numpy():
    np = pytest.importorskip("numpy")
    out = units.energy_to_ev([1.0, [2.0]], "eV")
    assert out == [1.0, [2.0]]
    arr = units.force_to_ev_per_angstrom(np.array([[1.0, 0.0, 0.0]]), "eV/A")
    assert arr == [[1.0, 0.0, 0.0]]
    assert units.length_to_angstrom((1.0, 2.0), "A") == [1.0, 2.0]


def test_unsupported_unit_and_bad_type():
    with pytest.raises(ValueError, match="不支持的能量单位"):
        units.energy_to_ev(1.0, "furlong-energy")
    with pytest.raises(ValueError, match="不支持的长度单位"):
        units.length_to_angstrom(1.0, "lightyear")
    with pytest.raises(ValueError, match="不支持的力单位"):
        units.force_to_ev_per_angstrom(1.0, "kg")
    with pytest.raises(ValueError, match="不支持的应力单位"):
        units.stress_to_ev_per_a3(1.0, "psi")
    with pytest.raises(TypeError, match="无法换算"):
        units.energy_to_ev(object(), "eV")


# -- units：规范化 --------------------------------------------------------


def test_normalize_method_aliases():
    assert units.normalize_method("pbe") == "PBE"
    assert units.normalize_method(" R2SCAN ") == "R2SCAN"
    assert units.normalize_method("r\u00b2scan") == "R2SCAN"
    assert units.normalize_method("b3lyp") == "B3LYP"
    assert units.normalize_method("my-new-func") == "MY-NEW-FUNC"


def test_normalize_basis_dispersion_spin():
    assert units.normalize_basis(None) is None
    assert units.normalize_basis(" def2 TZVP ") == "def2TZVP"
    assert units.normalize_dispersion(None) is None
    assert units.normalize_dispersion("d3-bj") == "D3BJ"
    assert units.normalize_dispersion("custom-vdw") == "custom-vdw"
    assert units.normalize_spin("UKS") == "unrestricted"
    assert units.normalize_spin("collinear") == "spin-polarized"
    assert units.normalize_spin("weird") == "weird"


def test_program_major():
    assert units.program_major(None) is None
    assert units.program_major("6.3.2") == "6"
    assert units.program_major("7") == "7"


def test_theory_key_stable_under_aliases():
    base = dict(method="PBE", cutoff_ev=520, spin="spin-polarized", program="VASP",
                program_version="6.3.2", energy_type="total")
    assert units.theory_key(**base) == units.theory_key(
        method="pbe", cutoff_ev=520.0, spin="collinear", program="vasp",
        program_version="6.9.0", energy_type="TOTAL")
    assert units.theory_key(method="PBE") != units.theory_key(method="B3LYP", basis_set="def2-TZVP")
    assert units.theory_key(method="PBE") != units.theory_key(method="PBE", energy_correction="MP2020")
    assert units.theory_key(method="PBE") != units.theory_key(method="PBE", energy_type="formation_per_atom")
    assert units.theory_key(method="PBE", dispersion="D3BJ") == units.theory_key(
        method="PBE", dispersion="d3-bj")


def test_explain_key_difference():
    a = units.theory_key(method="PBE", cutoff_ev=520)
    b = units.theory_key(method="PBE", cutoff_ev=520)
    assert units.explain_key_difference(a, b) == "两键完全一致，可以混用"
    c = units.theory_key(method="B3LYP", basis_set="def2-TZVP")
    msg = units.explain_key_difference(a, c)
    assert "method" in msg and "basis_set" in msg and "cutoff_ev" in msg
    assert units.explain_key_difference("a|b", c) == "键格式无法解析，无法比较"


# -- schema --------------------------------------------------------------


def test_from_atoms_roundtrip_periodic(si_atoms, lot, source):
    rec = make_record(si_atoms, lot, source)
    assert rec.record_id == "mp:mp-149"
    assert rec.is_periodic
    assert len(rec.atoms) == len(si_atoms)
    assert rec.atoms.get_chemical_symbols() == si_atoms.get_chemical_symbols()


def test_from_atoms_molecule_requires_charge(water_atoms, lot, source):
    rec = make_record(water_atoms, lot, source, charge=0, multiplicity=1)
    assert not rec.is_periodic
    assert rec.charge == 0 and rec.multiplicity == 1
    with pytest.raises(ValidationError, match="charge"):
        UnifiedRecord.from_atoms(water_atoms, record_id="pubchem:962", energy=-1.0,
                                 energy_type=EnergyType.TOTAL, level_of_theory=lot,
                                 source=source, license="public-domain")


def test_record_id_pattern(si_atoms, lot, source):
    with pytest.raises(ValidationError):
        make_record(si_atoms, lot, source, record_id="mp-149")  # 缺来源前缀


def test_structure_must_be_valid_single_extxyz(si_atoms, lot, source):
    base = dict(record_id="mp:mp-149", energy=-10.0, energy_type=EnergyType.TOTAL,
                level_of_theory=lot, source=source, license="CC-BY-4.0")
    with pytest.raises(ValidationError, match="合法 extxyz"):
        UnifiedRecord(structure="not an xyz file", **base)
    buf = StringIO()
    write_extxyz(buf, si_atoms)
    two = buf.getvalue() + buf.getvalue()
    with pytest.raises(ValidationError, match="恰好包含 1 个构型"):
        UnifiedRecord(structure=two, **base)
    empty = '0\nProperties=species:S:1:pos:R:3 pbc="F F F"\n'
    with pytest.raises(ValidationError, match="不包含任何原子"):
        UnifiedRecord(structure=empty, charge=0, multiplicity=1, **base)


def test_forces_stress_shape_checked(si_atoms, lot, source):
    natoms = len(si_atoms)
    forces = [[0.0, 0.0, 0.1]] * natoms
    rec = make_record(si_atoms, lot, source, forces=forces, stress=[[0.0] * 3] * 3)
    assert len(rec.forces) == natoms
    with pytest.raises(ValidationError, match=rf"forces 形状必须为 \({natoms},3\)"):
        make_record(si_atoms, lot, source, forces=[[0.0, 0.0, 0.0]])
    with pytest.raises(ValidationError, match=rf"forces 形状必须为 \({natoms},3\)"):
        make_record(si_atoms, lot, source, forces=[[0.0, 0.0]] * natoms)
    with pytest.raises(ValidationError, match=r"stress 形状必须为 \(3,3\)"):
        make_record(si_atoms, lot, source, stress=[[0.0, 0.0]])
    with pytest.raises(ValidationError, match=r"stress 形状必须为 \(3,3\)"):
        make_record(si_atoms, lot, source, stress=[[0.0] * 3] * 3 + [[0.0] * 3])


def test_mix_key_tracks_theory_and_correction(si_atoms, lot, source):
    rec = make_record(si_atoms, lot, source)
    assert rec.mix_key == units.theory_key(
        method="PBE", cutoff_ev=520.0, pseudopotential="PAW_PBE_54",
        spin="spin-polarized", program="VASP", program_version="6.3.2",
        energy_type="total")
    rec2 = make_record(si_atoms, lot, source, energy_correction="MP2020 compatibility")
    assert rec2.mix_key != rec.mix_key


def test_extras_and_raw_units_passthrough(si_atoms, lot, source):
    rec = make_record(si_atoms, lot, source, raw_units={"energy": "eV", "length": "Angstrom"},
                      extras={"band_gap": 1.1})
    assert rec.raw_units["energy"] == "eV"
    assert rec.extras["band_gap"] == 1.1
    assert rec.source.retrieved_at is not None


def test_energy_optional_for_structure_only_sources(si_atoms, lot, source):
    rec = UnifiedRecord.from_atoms(si_atoms, record_id="optimade-aflow:1", energy=None,
                                   energy_type=None, level_of_theory=lot,
                                   source=source, license="AFLOW-ToU")
    assert rec.energy is None and rec.energy_type is None
    assert rec.mix_key.endswith("|none|-")
    with pytest.raises(ValidationError, match="同有同无"):
        UnifiedRecord.from_atoms(si_atoms, record_id="x:1", energy=-1.0, energy_type=None,
                                 level_of_theory=lot, source=source, license="L")
    with pytest.raises(ValidationError, match="同有同无"):
        UnifiedRecord.from_atoms(si_atoms, record_id="x:1", energy=None,
                                 energy_type=EnergyType.TOTAL, level_of_theory=lot,
                                 source=source, license="L")
    with pytest.raises(ValidationError, match="energy_correction 需要 energy"):
        UnifiedRecord.from_atoms(si_atoms, record_id="x:1", energy=None, energy_type=None,
                                 energy_correction="MP2020", level_of_theory=lot,
                                 source=source, license="L")


def test_extra_fields_rejected(si_atoms, lot, source):
    with pytest.raises(ValidationError):
        make_record(si_atoms, lot, source, bogus_field=1)
    with pytest.raises(ValidationError):
        LevelOfTheory(method="PBE", bogus=1)
