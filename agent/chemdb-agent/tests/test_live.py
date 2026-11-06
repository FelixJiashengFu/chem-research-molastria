"""真实联网冒烟测试：每个不要 key 的数据源跑一次小查询，再经标准输入输出走完整查询链。

默认跳过；手动运行（在项目目录里）：

    CHEMDB_LIVE=1 python -m pytest tests/test_live.py -v -s

Materials Project 只有配置了 MP_API_KEY 才跑。每条检查打印一行 LIVE 摘要，便于留档。
"""

import asyncio
import json
import os
import sys
import time

import pytest

pytestmark = [pytest.mark.live, pytest.mark.skipif(not os.environ.get("CHEMDB_LIVE"), reason="设置 CHEMDB_LIVE=1 才联网")]


def log(name, t0, **info):
    print("LIVE", json.dumps({"check": name, "secs": round(time.monotonic() - t0, 1), **info}, ensure_ascii=False))


from chemdb_agent.adapters.optimade import PROVIDERS  # noqa: E402

QUERIES = {p: ["Si"] for p in PROVIDERS}
QUERIES.update({"gnome": ["Mo", "S"], "mc2d": ["Mo", "S"]})


@pytest.mark.parametrize("provider", sorted(PROVIDERS))
def test_live_optimade(provider):
    from chemdb_agent.adapters import optimade

    t0 = time.monotonic()
    recs = optimade.search_structures(elements=QUERIES[provider], providers=[provider], limit=2)
    assert recs
    log(f"optimade-{provider}", t0, n=len(recs), first=recs[0].record_id, formula=recs[0].atoms.get_chemical_formula(),
        energy_ev=recs[0].energy)


def test_live_optimade_formula_variants():
    from chemdb_agent.adapters import optimade

    t0 = time.monotonic()
    a = optimade.search_structures(formula="SiO2", providers=["mp"], limit=3)
    b = optimade.search_structures(formula="O2Si", providers=["mp"], limit=3)
    assert [r.record_id for r in a] == [r.record_id for r in b] and a
    log("formula SiO2 == O2Si (optimade-mp)", t0, ids=[r.record_id for r in a])


def test_live_nomad():
    from chemdb_agent.adapters import nomad

    t0 = time.monotonic()
    recs = nomad.search_structures(formula="GaN", limit=2)
    assert recs and recs[0].energy is not None
    log("nomad", t0, n=len(recs), first=recs[0].record_id, energy_ev=recs[0].energy, lot=recs[0].mix_key,
        has_forces=recs[0].forces is not None)


@pytest.mark.parametrize("db,by,query", [("pubchem", "name", "caffeine"), ("chembl", "name", "aspirin"), ("chebi", "name", "caffeine")])
def test_live_molecules(db, by, query):
    import importlib

    mod = importlib.import_module(f"chemdb_agent.adapters.{db}")
    t0 = time.monotonic()
    recs = mod.search_molecules(query, by=by, limit=2)
    assert recs
    log(db, t0, n=len(recs), first=recs[0].record_id, formula=recs[0].extras.get("molecular_formula"))


@pytest.mark.parametrize("server", ["ml", "main"])
def test_live_qcarchive(server):
    from chemdb_agent.adapters import qcarchive

    t0 = time.monotonic()
    names = qcarchive.list_datasets(server, "")
    assert names
    ds = qcarchive.get_dataset(server, names[0]["dataset_id"])
    log(f"qcarchive-{server}", t0, n_datasets=len(names), first=ds.name, specs=len(ds.specifications))


@pytest.mark.skipif(not os.environ.get("MP_API_KEY"), reason="没有 MP_API_KEY")
def test_live_materials_project():
    from chemdb_agent.adapters import materials_project as mp

    t0 = time.monotonic()
    rec = mp.get_record("mp-149")
    log("mp", t0, record=rec.record_id, energy=rec.energy)


def test_live_mcp_stdio_chains(tmp_path):
    """经标准输入输出：化学式查晶体 → get_record → 导出 extxyz；名称查分子 → 取结构；查基组；QCArchive 分片 → 导出。"""
    from ase.io import read
    from fastmcp import Client
    from fastmcp.client.transports import StdioTransport

    env = {**os.environ, "CHEMDB_DATA_DIR": str(tmp_path), "PYTHONUTF8": "1"}
    transport = StdioTransport(command=sys.executable, args=["-m", "chemdb_agent.server"], env=env, cwd=str(tmp_path))

    async def run():
        out = {}
        async with Client(transport, timeout=300) as c:
            t0 = time.monotonic()
            s = (await c.call_tool("search_structures", {"formula": "GaN", "databases": ["optimade-alexandria-pbe", "nomad", "optimade-cod"], "limit": 2})).structured_content
            alex = [r for r in s["results"] if r["database"] == "optimade-alexandria-pbe"]
            rec = (await c.call_tool("get_record", {"record_id": alex[0]["record_id"]})).structured_content
            ex = (await c.call_tool("export_training_set", {"record_ids": [r["record_id"] for r in alex], "path": "gan.extxyz",
                                                            "level_of_theory": alex[0]["theory_key"]})).structured_content
            out["crystal"] = {"secs": round(time.monotonic() - t0, 1), "sources": s["sources"], "record_origin": rec["origin"], "export": ex}
            t0 = time.monotonic()
            m = (await c.call_tool("search_molecules", {"query": "aspirin", "databases": ["pubchem", "chembl", "chebi"], "limit": 1})).structured_content
            mol = (await c.call_tool("get_record", {"record_id": m["results"][0]["record_id"]})).structured_content
            out["molecule"] = {"secs": round(time.monotonic() - t0, 1), "sources": m["sources"], "first": m["results"][0]["record_id"],
                               "natoms": mol["summary"]["natoms"]}
            b = (await c.call_tool("get_basis", {"basis_name": "def2-TZVP", "elements": ["Fe", "Pt"], "fmt": "orca"})).structured_content
            out["basis"] = {"has_ecp": b["has_ecp"], "chars": len(b["text"])}
            t0 = time.monotonic()
            q = (await c.call_tool("find_qm_data", {"query": "SPICE Water Clusters", "limit": 2})).structured_content
            ds = q["datasets"][0]
            sh = (await c.call_tool("fetch_dataset_shard", {"dataset": str(ds["dataset_id"]), "specification": ds["specifications"][0]["name"],
                                                            "count": 3})).structured_content
            ex2 = (await c.call_tool("export_training_set", {"dataset": ds["name"], "path": "water.extxyz"})).structured_content
            out["qm"] = {"secs": round(time.monotonic() - t0, 1), "dataset": ds["name"], "shard": sh, "export": ex2}
        return out

    out = asyncio.run(run())
    frames = read(out["crystal"]["export"]["path"], index=":")
    water = read(out["qm"]["export"]["path"], index=":")
    assert frames and water and out["basis"]["has_ecp"]
    assert water[0].get_forces().shape == (len(water[0]), 3)
    print("LIVE", json.dumps({"check": "mcp-stdio-chains", **out,
                              "crystal_energy_ev": frames[0].get_potential_energy(), "water_energy_ev": water[0].get_potential_energy()},
                             ensure_ascii=False, default=str))
