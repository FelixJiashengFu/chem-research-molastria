"""QCArchive（录制回放）：数据集列表、规格、记录换算（Hartree/Bohr → eV/Å）、校正程序拒绝。"""

import pytest
from conftest import make_vcr

from chemdb_agent.adapters import qcarchive as qca

qca_vcr = make_vcr()
WATER = 385  # SPICE Water Clusters v1.0：1000 条，wB97M-D3BJ/def2-TZVPPD，gradient
MONOMERS = 340  # SPICE DES Monomers v1.1：小分子，含 psi4 与 dftd3 规格（cassette 小）


def test_list_and_summarize_spice_water():
    with qca_vcr.use_cassette("qca_water_summary.yaml"):
        hits = qca.list_datasets("ml", "spice water clusters")
        ds = qca.get_dataset("ml", WATER)
        summ = qca.dataset_summary("ml", ds)
    assert any(h["dataset_id"] == WATER for h in hits)
    assert summ["name"] == "SPICE Water Clusters v1.0"
    assert summ["license"] == "CC0-1.0"
    spec = summ["specifications"][0]
    assert spec["method"] == "wb97m-d3bj" and spec["basis"] == "def2-tzvppd" and spec["driver"] == "gradient"
    assert not spec["is_correction_only"]


def test_record_units_forces_and_correction_refusal():
    with qca_vcr.use_cassette("qca_monomer_records.yaml"):
        ds = qca.get_dataset("ml", MONOMERS)
        specs = {n: s.specification for n, s in ds.specifications.items()}
        psi4, dftd3 = "spec_4", "spec_6"  # spec_3 与 spec_4 同为 wB97M-D3BJ，记录挂在 spec_4 上
        assert specs[psi4].method == "wb97m-d3bj" and specs[dftd3].program == "dftd3"
        names = ["brc1ccccc1-0", "brc1ccccc1-1"]  # 直接点名，免得把 5.6 万个条目名录进 cassette
        good = list(qca.iterate_records("ml", ds, psi4, names))
        corr = list(qca.iterate_records("ml", ds, dftd3, names[:1]))
    recs = [r for _, r in good]
    assert len(recs) == 2 and all(not isinstance(r, str) for r in recs)
    r = recs[0]
    assert r.record_id.startswith("qcarchive-ml:")
    assert r.charge == 0 and r.multiplicity == 1 and not r.is_periodic
    assert r.raw_units == {"energy": "Hartree", "length": "Bohr", "forces": "Hartree/Bohr (forces = -gradient)"}
    assert r.source.dataset_version == ds.name and r.license == "CC0-1.0" and r.source.doi
    assert r.level_of_theory.basis_set == "def2-tzvppd" and r.level_of_theory.program == "psi4"
    assert r.level_of_theory.program_version  # 取自 provenance
    # 溴苯约 -2800 Hartree；没换算的值只有几千，换算后每原子上千 eV
    assert 1000 < -r.energy / len(r.atoms) < 1e5
    assert len(r.forces) == len(r.atoms) == 12
    # 最近邻是 C–H / C–C / C–Br 键，0.9–2.0 Å：Bohr → Å 换算对了（没换算会大 1.9 倍）
    d = min(r.atoms.get_distances(0, list(range(1, len(r.atoms)))))
    assert 0.9 < d < 2.0
    # dftd3 规格只给色散校正：整个规格和单条记录都拒绝
    assert corr and isinstance(corr[0][1], str) and "校正能量" in corr[0][1]
    with pytest.raises(ValueError, match="校正能量"):
        qca.check_specification(ds, dftd3)
    with pytest.raises(KeyError, match="没有规格"):
        qca.check_specification(ds, "no-such-spec")


def test_get_record_by_id():
    with qca_vcr.use_cassette("qca_get_record.yaml"):
        r = qca.get_record("qcarchive-ml:111559325")
    assert r.record_id == "qcarchive-ml:111559325"
    assert r.license.startswith("unspecified")  # 不带数据集上下文
    assert r.energy is not None and r.forces is not None and len(r.atoms) == 12


def test_parse_record_id_and_license():
    assert qca.parse_record_id("qcarchive-main:12") == ("main", 12)
    for bad in ("qcarchive:12", "qcarchive-ml:abc", "qcarchive-xx:1"):
        with pytest.raises(ValueError):
            qca.parse_record_id(bad)
    assert qca.license_for("SPICE PubChem Set 1 Single Points Dataset v1.2") == "CC0-1.0"
    assert qca.license_for("QM9").startswith("unspecified")
