"""MP + PubChem 适配器测试。首次运行联网录制 cassette，之后离线回放。

录制 MP cassette 需要 MP_API_KEY（放 .env）；回放不需要。
"""

import os

import vcr

from chemdb_agent.adapters import materials_project as mp
from chemdb_agent.adapters import pubchem

CASSETTE_DIR = "tests/cassettes"

mp_vcr = vcr.VCR(
    cassette_library_dir=CASSETTE_DIR,
    record_mode="once",
    filter_headers=["x-api-key", "X-API-KEY", "authorization"],
    filter_query_parameters=["api_key", "API_KEY", "token"],
)

pubchem_vcr = vcr.VCR(cassette_library_dir=CASSETTE_DIR, record_mode="once")

# 回放不需要真 key（请求头不参与匹配），但适配器没有 key 就不联网，所以回放时给一个 32 位占位串
API_KEY = os.environ.get("MP_API_KEY") or "0" * 32


def test_mp_get_record():
    with mp_vcr.use_cassette("mp_get_mp149.yaml"):
        rec = mp.get_record("mp-149", api_key=API_KEY)
    assert rec.record_id == "mp:mp-149"
    assert rec.is_periodic
    assert rec.extras["formula_pretty"] == "Si"
    assert rec.energy == 0.0  # 单质形成能
    assert rec.energy_type.value == "formation_per_atom"
    assert rec.energy_correction == "MP compatibility"
    assert rec.level_of_theory.method in ("PBE", "R2SCAN", "unknown")
    assert rec.mix_key  # 可产键


def test_mp_get_record_with_prefix():
    with mp_vcr.use_cassette("mp_get_mp149.yaml"):
        rec = mp.get_record("mp:mp-149", api_key=API_KEY)
    assert rec.record_id == "mp:mp-149"


def test_mp_search_formula_limit():
    with mp_vcr.use_cassette("mp_search_si.yaml"):
        recs = mp.search_structures(formula="Si", limit=3, api_key=API_KEY)
    assert 1 <= len(recs) <= 3
    assert all(r.record_id.startswith("mp:mp-") for r in recs)
    assert all(r.energy_type.value == "formation_per_atom" for r in recs)


def test_mp_search_chemsys_filter():
    with mp_vcr.use_cassette("mp_search_limno.yaml"):
        recs = mp.search_structures(chemsys="Li-Mn-O", energy_above_hull_max=0.025,
                                   limit=5, api_key=API_KEY)
    assert len(recs) >= 1
    assert all(r.extras["energy_above_hull"] <= 0.025 + 1e-9 for r in recs)


def test_mp_search_requires_query():
    try:
        mp.search_structures(api_key=API_KEY)
    except ValueError as e:
        assert "formula" in str(e)
    else:
        raise AssertionError("expected ValueError")


def test_mp_unknown_id():
    with mp_vcr.use_cassette("mp_get_unknown.yaml"):
        try:
            mp.get_record("mp-999999999", api_key=API_KEY)
        except KeyError as e:
            assert "mp-999999999" in str(e)
        else:
            raise AssertionError("expected KeyError")


def test_pubchem_search_name():
    with pubchem_vcr.use_cassette("pubchem_caffeine.yaml"):
        recs = pubchem.search_molecules("caffeine", by="name", limit=3)
    assert len(recs) >= 1
    rec = recs[0]
    assert rec.record_id == "pubchem:2519"
    assert rec.extras["molecular_formula"] == "C8H10N4O2"
    assert rec.charge == 0 and rec.multiplicity == 1
    assert rec.energy is None  # PubChem 不给能量
    assert not rec.is_periodic


def test_pubchem_search_smiles():
    with pubchem_vcr.use_cassette("pubchem_ethanol.yaml"):
        recs = pubchem.search_molecules("CCO", by="smiles")
    assert recs[0].extras["molecular_formula"] == "C2H6O"


def test_pubchem_search_inchikey():
    with pubchem_vcr.use_cassette("pubchem_aspirin_key.yaml"):
        recs = pubchem.search_molecules("BSYNRYMUTXBXSQ-UHFFFAOYSA-N", by="inchikey")
    assert recs[0].record_id == "pubchem:2244"


def test_pubchem_get_record():
    with pubchem_vcr.use_cassette("pubchem_2244.yaml"):
        rec = pubchem.get_record("2244")
    assert rec.extras["molecular_formula"] == "C9H8O4"


def test_pubchem_not_found():
    with pubchem_vcr.use_cassette("pubchem_notfound.yaml"):
        try:
            pubchem.search_molecules("zzzz-not-a-real-molecule-xyz", by="name")
        except ValueError as e:
            assert "找不到" in str(e)
        else:
            raise AssertionError("expected ValueError")


def test_pubchem_bad_namespace():
    try:
        pubchem.search_molecules("CCO", by="formula")
    except ValueError as e:
        assert "name、smiles、inchikey" in str(e)
    else:
        raise AssertionError("expected ValueError")


def test_mp_without_key_is_a_clear_error_not_a_crash(monkeypatch):
    from pymatgen.core import SETTINGS

    from chemdb_agent.net import MissingKeyError

    monkeypatch.delenv("MP_API_KEY", raising=False)
    monkeypatch.setitem(SETTINGS, "PMG_MAPI_KEY", None)
    try:
        mp.get_record("mp-149")
    except MissingKeyError as e:
        assert "MP_API_KEY" in str(e) and "optimade-mp" in str(e)
    else:
        raise AssertionError("expected MissingKeyError")
    try:
        mp.search_structures(formula="Si")
    except MissingKeyError:
        pass
    else:
        raise AssertionError("expected MissingKeyError")
