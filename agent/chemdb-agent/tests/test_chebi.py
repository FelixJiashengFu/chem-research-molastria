"""ChEBI 适配器（录制回放）。"""

import pytest
from conftest import make_vcr

from chemdb_agent.adapters import chebi

chebi_vcr = make_vcr()


def test_chebi_get_aspirin():
    with chebi_vcr.use_cassette("chebi_15365.yaml"):
        rec = chebi.get_record("CHEBI:15365")
    assert rec.record_id == "chebi:15365"
    assert rec.extras["molecular_formula"] == "C9H8O4"
    assert rec.extras["inchikey"] == "BSYNRYMUTXBXSQ-UHFFFAOYSA-N"
    assert len(rec.atoms) == 13 and rec.extras["heavy_atoms_only"]
    assert rec.charge == 0 and rec.multiplicity == 1 and rec.energy is None
    assert rec.license == "CC-BY-4.0"


def test_chebi_search_by_name():
    with chebi_vcr.use_cassette("chebi_search_caffeine.yaml"):
        recs = chebi.search_molecules("caffeine", by="name", limit=2)
    assert recs and all(r.record_id.startswith("chebi:") for r in recs)
    assert any(r.extras["molecular_formula"] == "C8H10N4O2" for r in recs)


def test_chebi_bad_args():
    with pytest.raises(ValueError, match="SMILES"):
        chebi.search_molecules("CCO", by="smiles")
    with pytest.raises(ValueError, match="ChEBI ID"):
        chebi.get_record("aspirin")
