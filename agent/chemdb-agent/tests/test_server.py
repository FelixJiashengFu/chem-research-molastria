"""MCP 工具层：查询链（录制回放）、缺 key、超时、导出路径、本地分片导出。"""

import asyncio
import json
import time

import pytest
from ase.io import read
from conftest import make_vcr
from fastmcp.exceptions import ToolError

from chemdb_agent import server

srv_vcr = make_vcr()


def call(name, args):
    return asyncio.run(server.mcp.call_tool(name, args)).structured_content


def test_chain_formula_to_record_to_extxyz(data_dir, monkeypatch):
    monkeypatch.delenv("MP_API_KEY", raising=False)
    with srv_vcr.use_cassette("srv_chain_gan.yaml"):
        res = call("search_structures", {"formula": "NGa", "databases": ["optimade-alexandria-pbe", "optimade-cod"], "limit": 2})
    assert res["status"] == "ok" and res["count"] >= 2
    by_db = {s["database"]: s for s in res["sources"]}
    assert by_db["optimade-cod"]["status"] == "ok"
    alex = [r for r in res["results"] if r["database"] == "optimade-alexandria-pbe"]
    assert alex and all(r["reduced_formula"] == "GaN" and r["has_energy"] for r in alex)
    cod = [r for r in res["results"] if r["database"] == "optimade-cod"]
    assert cod and not cod[0]["has_energy"]
    # get_record 走缓存，不联网（这里不开 cassette，联网就会失败）
    got = call("get_record", {"record_id": alex[0]["record_id"]})
    assert got["origin"] == "cache" and got["record"]["energy"] == alex[0]["energy_ev"]
    # 带能量的导出成功；混进纯结构记录被拒绝
    ids = [r["record_id"] for r in alex]
    out = call("export_training_set", {"record_ids": ids, "path": "gan.extxyz", "level_of_theory": alex[0]["theory_key"]})
    frames = read(out["path"], index=":")
    assert out["status"] == "ok" and len(frames) == out["n_records"] >= 1
    assert frames[0].get_potential_energy() == pytest.approx(alex[0]["energy_ev"])
    manifest = json.loads(open(out["manifest_path"], encoding="utf-8").read())
    assert manifest["records"][0]["database"] == "optimade-alexandria-pbe"
    assert manifest["records"][0]["license"] == "CC-BY-4.0"
    with pytest.raises(ToolError, match="没有能量"):
        call("export_training_set", {"record_ids": ids + [cod[0]["record_id"]], "path": "mixed.extxyz"})


def test_mp_without_key_reports_and_other_sources_still_answer(data_dir, monkeypatch):
    from pymatgen.core import SETTINGS

    monkeypatch.delenv("MP_API_KEY", raising=False)
    monkeypatch.setitem(SETTINGS, "PMG_MAPI_KEY", None)
    with srv_vcr.use_cassette("srv_chain_gan.yaml", allow_playback_repeats=True):
        res = call("search_structures", {"formula": "GaN", "databases": ["mp", "optimade-alexandria-pbe"], "limit": 2})
    mp_row = next(s for s in res["sources"] if s["database"] == "mp")
    assert mp_row["status"] == "missing_key" and "MP_API_KEY" in mp_row["message"]
    assert res["status"] == "partial" and res["count"] >= 1
    with pytest.raises(ToolError, match="MP_API_KEY"):
        call("get_record", {"record_id": "mp:mp-149"})
    # 默认组合不含 mp，并在 notes 里说明
    chosen, notes = server._expand_databases(None)
    assert "mp" not in chosen and any("MP_API_KEY" in n for n in notes)


def test_search_molecules_tool_pubchem(data_dir):
    vcr_old = make_vcr()
    with vcr_old.use_cassette("pubchem_caffeine.yaml"):
        res = call("search_molecules", {"query": "caffeine", "limit": 3})
    assert res["status"] == "ok" and res["results"][0]["record_id"] == "pubchem:2519"
    assert not res["results"][0]["has_energy"]


def test_unknown_database_and_empty_query(data_dir):
    with pytest.raises(ToolError, match="未知数据库"):
        call("search_structures", {"elements": ["Si"], "databases": ["optimade-nope"]})
    with pytest.raises(ToolError, match="formula 或 elements"):
        call("search_structures", {})


def test_slow_source_times_out_without_blocking_others(monkeypatch):
    monkeypatch.setattr(server, "source_timeout_s", lambda: 0.3)
    t0 = time.monotonic()
    out = server._run_sources({"slow": lambda: time.sleep(2) or [], "fast": lambda: [1]})
    assert time.monotonic() - t0 < 1.5
    assert out["slow"][0] == "timeout" and "CHEMDB_SOURCE_TIMEOUT" in out["slow"][1]
    assert out["fast"] == ("ok", [1])


def test_export_path_must_stay_in_data_dir(data_dir, tmp_path_factory):
    outside = tmp_path_factory.mktemp("outside") / "x.extxyz"
    with pytest.raises(ValueError, match="数据目录"):
        server._export_path(str(outside))
    with pytest.raises(ValueError, match="数据目录"):
        server._export_path("../../escape.extxyz")
    assert server._export_path("sub/a.extxyz") == (data_dir / "exports" / "sub" / "a.extxyz").resolve()
    with pytest.raises(ToolError, match="二选一"):
        call("export_training_set", {"record_ids": ["x:1"], "dataset": "d"})


def test_export_local_dataset_and_find_local(data_dir):
    from test_local_catalog_net_cache import rec, write

    write(data_dir, 0, [rec(0), rec(2)])
    out = call("export_training_set", {"dataset": "SPICE T", "path": "spice.extxyz"})
    assert out["n_records"] == 2
    frames = read(out["path"], index=":")
    assert [f.info["record_id"] for f in frames] == ["qcarchive-ml:1000", "qcarchive-ml:1002"]
    got = call("get_record", {"record_id": "qcarchive-ml:1002"})
    assert got["origin"] == "local"
    st = call("catalog_status", {})
    assert st["local_catalog"]["n_records"] == 2


def test_empty_results_are_explained():
    out = server._report({"optimade-cod": ("ok", []), "nomad": ("ok", [])}, [])
    assert out["status"] == "ok" and out["count"] == 0
    assert any("没有匹配结果" in n for n in out["notes"])


def test_shard_size_gate_then_download(data_dir, monkeypatch):
    """估计超过上限时只返回估计值；confirm=true 才下载并登记到本地目录。"""
    from types import SimpleNamespace

    from test_local_catalog_net_cache import rec

    from chemdb_agent.adapters import qcarchive

    ds = SimpleNamespace(id=9, name="SPICE T", entry_names=[f"e{i}" for i in range(5)])
    monkeypatch.setattr(qcarchive, "get_dataset", lambda server_, dataset: ds)
    monkeypatch.setattr(qcarchive, "check_specification", lambda d, s: {"program": "psi4", "driver": "gradient", "method": "wb97m-d3bj", "basis": "def2-tzvppd"})
    monkeypatch.setattr(qcarchive, "iterate_records", lambda server_, d, s, names: ((n, rec(int(n[1:]))) for n in names))
    monkeypatch.setattr(server, "SHARD_CONFIRM_BYTES", 100)
    args = {"dataset": "9", "specification": "wb97m-d3bj/def2-tzvppd", "start": 1, "count": 3}
    gate = call("fetch_dataset_shard", args)
    assert gate["status"] == "needs_confirmation" and gate["entries"] == 3 and gate["estimated_bytes"] > 100
    assert call("catalog_status", {})["local_catalog"]["n_records"] == 0
    done = call("fetch_dataset_shard", {**args, "confirm": True})
    assert done["status"] == "ok" and done["n_records"] == 3 and done["license"] == "CC0-1.0"
    assert done["file"].endswith("0000001-0000003.jsonl")
    with pytest.raises(ToolError, match="超出范围"):
        call("fetch_dataset_shard", {**args, "start": 99})
