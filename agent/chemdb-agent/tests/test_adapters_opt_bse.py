"""OPTIMADE（录制回放）+ BSE（本地离线）适配器测试。"""

import pytest
from conftest import make_vcr

from chemdb_agent.adapters import basis
from chemdb_agent.adapters import optimade as opt

opt_vcr = make_vcr()

# 每个提供方一条小查询：多数用单质 Si；GNoME 与 MC2D 没有 Si 单质，用 Mo-S
PROVIDER_QUERIES = {p: ["Si"] for p in opt.PROVIDERS}
PROVIDER_QUERIES.update({"gnome": ["Mo", "S"], "mc2d": ["Mo", "S"]})


@pytest.mark.parametrize("provider", sorted(opt.PROVIDERS))
def test_every_provider_answers(provider):
    from pathlib import Path

    from chemdb_agent.net import SourceError

    elements = PROVIDER_QUERIES[provider]
    cassette = Path(opt_vcr.cassette_library_dir) / f"opt_{provider}.yaml"
    recorded = cassette.exists()
    try:
        with opt_vcr.use_cassette(cassette.name):
            recs = opt.search_structures(elements=elements, providers=[provider], limit=2)
    except SourceError as e:
        if recorded:
            raise
        cassette.unlink(missing_ok=True)  # 不把一盘 502 或断网录进仓库
        pytest.skip(f"{provider} 没有 cassette，录制时端点不可用：{e}")
    assert 1 <= len(recs) <= 2, provider
    for r in recs:
        assert r.record_id.startswith(f"optimade-{provider}:")
        assert r.is_periodic
        assert set(r.atoms.get_chemical_symbols()) == set(elements)
        assert r.source.database == f"optimade-{provider}"
        assert r.license == opt.LICENSES.get(provider, "see-provider-terms")
        if provider in opt.ENERGY_FIELDS:
            assert r.energy is not None and r.energy_type.value == "total"
            assert r.level_of_theory.method == opt.ENERGY_FIELDS[provider].method
        else:
            assert r.energy is None and r.level_of_theory.method == "unknown"


def test_formula_spellings_are_equivalent():
    assert opt.normalize_formula("NaCl") == "ClNa"
    assert opt.normalize_formula("ClNa") == "ClNa"
    assert opt.normalize_formula("Na2Cl2") == "ClNa"
    assert opt.normalize_formula(" Fe2 O3 ") == "Fe2O3"
    assert opt.normalize_formula("(CH3)2O") == "C2H6O"
    assert opt.normalize_formula("SiO2") == opt.normalize_formula("O2Si") == "O2Si"
    with pytest.raises(ValueError, match="非整数"):
        opt.normalize_formula("Fe0.5O")
    assert opt.normalize_elements(["si", "O", "SI"]) == ["O", "Si"]
    with pytest.raises(ValueError, match="不是元素符号"):
        opt.normalize_elements(["Xx"])


def test_formula_server_side_and_client_side_filter():
    # Alexandria 支持按约化式检索；COD 不支持（501），改元素过滤后本地按组成筛
    with opt_vcr.use_cassette("opt_formula_gan.yaml"):
        alex = opt.search_structures(formula="NGa", providers=["alexandria-pbe"], limit=3)
        cod = opt.search_structures(formula="Ga2N2", providers=["cod"], limit=3)
    for recs in (alex, cod):
        assert recs
        assert all(opt.formula_of_atoms(r.atoms) == "GaN" for r in recs)


def test_alexandria_energy_forces_stress_units():
    with opt_vcr.use_cassette("opt_formula_gan.yaml"):
        rec = opt.search_structures(formula="GaN", providers=["alexandria-pbe"], limit=3)[0]
    assert rec.energy_type.value == "total" and rec.energy < 0
    assert rec.forces is not None and len(rec.forces) == len(rec.atoms)
    assert rec.stress is not None and len(rec.stress) == 3
    assert rec.raw_units["stress"].startswith("kbar")
    assert rec.level_of_theory.program == "VASP"
    assert "hull_distance" in str(rec.extras)


def test_mp_u_rule_splits_oxides_of_transition_metals():
    from ase.build import bulk

    assert opt._needs_mp_u(bulk("FeO", "rocksalt", a=4.3))
    assert not opt._needs_mp_u(bulk("Si", "diamond", a=5.43))
    a = {"_alexandria_energy": -10.0, "_alexandria_stress_tensor": [[10.0, 0, 0], [0, 10.0, 0], [0, 0, 10.0]]}
    kwargs, lot, raw, extras = opt._energy_kwargs("alexandria-pbe", a, bulk("FeO", "rocksalt", a=4.3))
    assert lot.method == "PBE+U" and "hubbard_u_inferred" in extras
    # 10 kbar（VASP 号约定，压为正）→ ASE 约定取负：-10 × 0.1 GPa × 0.006241509 eV/Å³/GPa
    assert kwargs["stress"][0][0] == pytest.approx(-0.006241509074)


def test_optimade_get_record_roundtrip():
    with opt_vcr.use_cassette("opt_roundtrip.yaml"):
        recs = opt.search_structures(elements=["Si"], providers=["aflow"], limit=1)
        assert len(recs) == 1
        same = opt.get_record(recs[0].record_id)
    assert same.record_id == recs[0].record_id
    assert same.atoms.get_chemical_symbols() == recs[0].atoms.get_chemical_symbols()


def test_optimade_get_unknown():
    with opt_vcr.use_cassette("opt_unknown.yaml"):
        with pytest.raises(KeyError, match="definitely-not-an-id-zzz"):
            opt.get_record("optimade-aflow:definitely-not-an-id-zzz")


def test_page_limit_cap_is_retried(monkeypatch):
    from chemdb_agent import net

    calls = []

    def fake(source, url, params=None, **kw):
        calls.append(params["page_limit"])
        if params["page_limit"] > 10:
            raise net.SourceError(source, "HTTP 403：maximum value of 'page_limit' exceeded: 30 > 10", status=403)
        return {"data": []}

    monkeypatch.setattr(opt.net, "request", fake)
    assert opt._query("aflow", 'id="x"', 30) == []
    assert calls == [30, 10]
    calls.clear()
    assert opt._query("cod", 'id="x"', 30) == [] and calls == [10]  # 已知上限直接用


def test_optimade_filter_quotes_are_escaped():
    assert opt._quote('a"b\\c') == '"a\\"b\\\\c"'


def test_optimade_bad_args():
    for fn in (lambda: opt.search_structures(),
               lambda: opt.search_structures(elements=["Si"], providers=["nope"]),
               lambda: opt.get_record("mp:mp-149"),
               lambda: opt.get_record("optimade-nope:1")):
        with pytest.raises(ValueError):
            fn()
    with pytest.raises(ValueError, match="无法解析"):
        opt.search_structures(formula="NotAFormula!!")


def test_bse_orca_def2svp():
    res = basis.get_basis("def2-SVP", ["H", "O"], fmt="orca")
    assert "H" in res.text and "O" in res.text
    assert not res.has_ecp  # 轻元素无 ECP
    assert res.fmt == "orca"


def test_bse_tzvp_ecp_for_pt():
    # 验收任务 3 的预演：Fe/Pt 的 def2-TZVP，Pt 应带 ECP
    res = basis.get_basis("def2-TZVP", ["Fe", "Pt"], fmt="orca")
    assert res.has_ecp
    assert "iron" in res.text.lower() and "platinum" in res.text.lower()  # ORCA 用全名


def test_bse_fmt_mapping():
    res = basis.get_basis("def2-SVP", ["H"], fmt="pyscf")
    assert res.notes and "NWChem" in res.notes[0]
    res = basis.get_basis("def2-SVP", ["H"], fmt="gaussian")
    assert "%" in res.text or "H" in res.text


def test_bse_errors():
    with pytest.raises(ValueError, match="未知格式"):
        basis.get_basis("def2-SVP", ["H"], fmt="vasp")
    with pytest.raises(ValueError, match="不能为空"):
        basis.get_basis("def2-SVP", [])
    with pytest.raises(ValueError, match="取基组失败"):
        basis.get_basis("not-a-real-basis-xyz", ["H"])
