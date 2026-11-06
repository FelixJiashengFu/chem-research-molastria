"""NOMAD 原生接口（录制回放）：SI 单位换算、理论级别、找不到的条目。"""

import pytest
from conftest import make_vcr

from chemdb_agent import units
from chemdb_agent.adapters import nomad

nomad_vcr = make_vcr()


def test_nomad_search_gan_with_energy_and_forces():
    with nomad_vcr.use_cassette("nomad_gan.yaml"):
        recs = nomad.search_structures(formula="GaN", limit=3)
    assert recs
    for r in recs:
        assert r.record_id.startswith("nomad:")
        assert set(r.atoms.get_chemical_symbols()) == {"Ga", "N"}
        assert r.is_periodic and r.energy_type.value == "total"
        # 赝势程序每原子几 eV，全电子程序（如 exciting）每原子上万 eV；没换算的 J 值只有 1e-15 量级
        assert 1 < -r.energy / len(r.atoms) < 1e6
        assert r.raw_units["energy"] == "J" and r.raw_units["length"] == "m"
        assert r.license == "CC-BY-4.0"
        # 晶格常数在 Å 量级：m → Å 换算对了
        assert 2 < max(r.atoms.cell.lengths()) < 100
        assert r.level_of_theory.program


def test_nomad_get_record_roundtrip():
    with nomad_vcr.use_cassette("nomad_roundtrip.yaml"):
        rec = nomad.search_structures(elements=["Si"], limit=1)[0]
        same = nomad.get_record(rec.record_id)
    assert same.record_id == rec.record_id
    assert same.energy == pytest.approx(rec.energy)
    assert same.mix_key == rec.mix_key


def test_nomad_xc_and_cutoff_mapping():
    sec = {
        "dft": {"xc_functional": {"name": "GGA_C_PBE+GGA_X_PBE"}},
        "electrons_representation": [{"basis_set": [{"type": "plane waves", "scope": ["valence"], "cutoff": 1.9226119608e-16}]}],
    }
    assert nomad._method(sec) == "PBE"
    assert nomad._cutoff_ev(sec) == pytest.approx(units.energy_to_ev(1.9226119608e-16, "J"), abs=1e-3)
    sec["atom_parameters"] = [{"hubbard_kanamori_model": {"u_effective": 6.4e-19}}]
    assert nomad._method(sec) == "PBE+U"
    assert nomad._method({"dft": {"xc_functional": {"name": "GGA_X_PBE_SOL+GGA_C_PBE_SOL"}}}) == "PBEsol"


def test_nomad_unknown_entry():
    with nomad_vcr.use_cassette("nomad_unknown.yaml"):
        with pytest.raises(KeyError, match="找不到"):
            nomad.get_record("nomad:zzzz-not-an-entry-id")
