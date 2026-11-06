"""ChEMBL 适配器测试（录制回放 + 电荷解析纯单元）。"""

import vcr

from chemdb_agent.adapters import chembl

chembl_vcr = vcr.VCR(cassette_library_dir="tests/cassettes", record_mode="once")


def test_chembl_charge_parser():
    molfile = "x\n\n  2  1  0  0  0  0  0  0  0  0999 V2000\nM  CHG  2   1   1   2  -1\nM  END\n"
    assert chembl.parse_molfile_charge(molfile) == 0
    assert chembl.parse_molfile_charge("no charge lines\n") == 0
    molfile2 = "x\nM  CHG  1   3  -2\nM  END\n"
    assert chembl.parse_molfile_charge(molfile2) == -2


def test_chembl_search_aspirin_by_name():
    with chembl_vcr.use_cassette("chembl_aspirin.yaml"):
        recs = chembl.search_molecules("aspirin", by="name", limit=5)
    assert len(recs) >= 1
    rec = recs[0]
    assert rec.record_id == "chembl:CHEMBL25"
    assert rec.extras["molecular_formula"] == "C9H8O4"
    assert len(rec.atoms) == 13  # molfile 只有重原子
    assert set(rec.atoms.get_chemical_symbols()) <= {"C", "O"}
    assert rec.charge == 0 and rec.multiplicity == 1
    assert rec.energy is None
    assert rec.extras["heavy_atoms_only"] is True
    assert rec.license == "CC-BY-SA-3.0"
    assert rec.source.database == "chembl"


def test_chembl_search_by_smiles_and_get_record():
    with chembl_vcr.use_cassette("chembl_smiles.yaml"):
        recs = chembl.search_molecules("CC(=O)Oc1ccccc1C(=O)O", by="smiles", limit=5)
        assert recs and recs[0].record_id == "chembl:CHEMBL25"
        rec = chembl.get_record("CHEMBL25")
    assert rec.record_id == "chembl:CHEMBL25"
    assert rec.extras["inchikey"] == "BSYNRYMUTXBXSQ-UHFFFAOYSA-N"


def test_chembl_bad_by():
    try:
        chembl.search_molecules("x", by="cas")
    except ValueError as e:
        assert "name/smiles/inchikey" in str(e)
    else:
        raise AssertionError("expected ValueError")
