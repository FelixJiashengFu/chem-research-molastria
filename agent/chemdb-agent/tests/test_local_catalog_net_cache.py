"""本地目录索引、共用 HTTP（重试/超时/报错）与缓存：纯离线。"""

import json
import time

import pytest
import requests
from ase.build import molecule

from chemdb_agent import cache, net
from chemdb_agent.adapters import local_catalog as lc
from chemdb_agent.schema import EnergyType, LevelOfTheory, Source, UnifiedRecord


def rec(i, method="wb97m-d3bj"):
    mol = molecule("H2O" if i % 2 == 0 else "CH4")
    return UnifiedRecord.from_atoms(
        mol, record_id=f"qcarchive-ml:{1000 + i}", charge=0, multiplicity=1, energy=-2000.0 - i,
        energy_type=EnergyType.TOTAL, level_of_theory=LevelOfTheory(method=method, basis_set="def2-tzvppd", program="psi4"),
        source=Source(database="qcarchive-ml", dataset_version="SPICE T"), license="CC0-1.0",
    )


def write(root, start, records, dataset="SPICE T", dsid=9):
    return lc.write_shard(root, source="qcarchive-ml", dataset=dataset, dataset_id=dsid, specification="wb97m-d3bj/def2-tzvppd",
                          start=start, records=records, license="CC0-1.0", level_of_theory={"method": "wb97m-d3bj"})


def test_write_get_search_load(tmp_path):
    m1 = write(tmp_path, 0, [rec(0), rec(1)])
    write(tmp_path, 2, [rec(2)])
    assert m1["n_records"] == 2 and m1["file"].endswith("0000000-0000001.jsonl")
    assert (tmp_path / m1["file"]).exists()
    manifest = json.loads((tmp_path / m1["file"].replace(".jsonl", ".manifest.json")).read_text(encoding="utf-8"))
    assert manifest["license"] == "CC0-1.0" and manifest["sha256"]
    got = lc.get(tmp_path, "qcarchive-ml:1001")
    assert got is not None and got.energy == -2001.0 and got.source.dataset_version == "SPICE T"
    assert lc.get(tmp_path, "qcarchive-ml:9999") is None
    assert len(lc.load_dataset(tmp_path, "SPICE T")) == 3
    assert len(lc.load_dataset(tmp_path, "9")) == 3
    hits = lc.search(tmp_path, elements=["C"])
    assert hits["n_records"] == 1
    st = lc.stats(tmp_path)
    assert st["n_shards"] == 2 and st["n_records"] == 3 and st["shards"][0]["size_bytes"] > 0
    with pytest.raises(KeyError, match="fetch_dataset_shard"):
        lc.load_dataset(tmp_path, "nope")
    with pytest.raises(ValueError):
        write(tmp_path, 5, [])


def test_rebuild_index_from_manifests(tmp_path):
    write(tmp_path, 0, [rec(0), rec(1)])
    (tmp_path / "catalog.sqlite").unlink()
    assert lc.get(tmp_path, "qcarchive-ml:1000") is None
    assert lc.stats(tmp_path)["n_records"] == 2  # 索引缺失时 stats 先重建
    assert lc.get(tmp_path, "qcarchive-ml:1000") is not None


class FakeResp:
    def __init__(self, code, body=None, text="", headers=None):
        self.status_code, self._body, self.text, self.headers = code, body, text, headers or {}

    def json(self):
        if self._body is None:
            raise ValueError("no json")
        return self._body


def fake_session(monkeypatch, responses):
    calls = []

    def request(method, url, **kw):
        calls.append((method, url, kw.get("timeout")))
        r = responses.pop(0)
        if isinstance(r, Exception):
            raise r
        return r

    monkeypatch.setattr(net.session(), "request", request)
    monkeypatch.setattr(net.time, "sleep", lambda s: None)
    return calls


def test_net_retries_5xx_then_succeeds(monkeypatch):
    calls = fake_session(monkeypatch, [FakeResp(502, text="<html>bad gateway</html>"), requests.ConnectionError(), FakeResp(200, {"ok": 1})])
    assert net.request("X", "https://x.invalid/a") == {"ok": 1}
    assert len(calls) == 3 and calls[0][2] == net.timeout_s()


def test_net_4xx_is_immediate_with_server_reason(monkeypatch):
    calls = fake_session(monkeypatch, [FakeResp(400, {"errors": [{"detail": "bad filter"}]})])
    with pytest.raises(net.SourceError, match="HTTP 400：bad filter") as e:
        net.request("OPTIMADE x", "https://x.invalid/v1/structures")
    assert e.value.status == 400 and len(calls) == 1


def test_net_gives_up_after_timeouts(monkeypatch):
    monkeypatch.setenv("CHEMDB_HTTP_TIMEOUT", "7")
    fake_session(monkeypatch, [requests.Timeout(), requests.Timeout(), requests.Timeout()])
    with pytest.raises(net.SourceError, match="3 次尝试均失败：超时（7 秒）"):
        net.request("NOMAD", "https://x.invalid/api")


def test_net_non_json_and_text(monkeypatch):
    fake_session(monkeypatch, [FakeResp(200, None, text="<html>"), FakeResp(200, None, text="M  END")])
    with pytest.raises(net.SourceError, match="不是 JSON"):
        net.request("X", "https://x.invalid/a")
    assert net.request("X", "https://x.invalid/b", as_json=False) == "M  END"


def test_cache_ttl(tmp_path, monkeypatch):
    c = cache.Cache(tmp_path)
    c.put("record:a", {"x": 1})
    assert c.get("record:a") == {"x": 1}
    assert c.stats()["entries"] == 1
    monkeypatch.setenv("CHEMDB_CACHE_TTL", "0")
    assert c.get("record:a") is None
    monkeypatch.setenv("CHEMDB_CACHE_TTL", "1")
    real = time.time
    monkeypatch.setattr(cache.time, "time", lambda: real() + 5)
    assert c.get("record:a") is None
    assert c.get("record:missing") is None
