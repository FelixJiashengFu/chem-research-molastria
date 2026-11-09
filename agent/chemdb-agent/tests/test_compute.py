"""计算工具（run_calculation、get_calculation、compute_status）：对着一个假的 MolAstria 计算接口，不联网。"""

import asyncio

import pytest
import requests
from fastmcp.exceptions import ToolError

from chemdb_agent import net, server
from chemdb_agent.adapters import molastria_compute as mc

KEY = "mola_" + "k" * 43
USAGE = {"used": 3, "limit": 100, "remaining": 97, "reset": 1900000000}


class Reply:
    def __init__(self, status, data):
        self.status_code, self._data = status, data

    def json(self):
        if self._data is None:
            raise ValueError("not json")
        return self._data


class FakeService:
    """记下每个请求；按路径回答，和 deploy/account-worker.js 的 /v1 一个样子。"""

    def __init__(self):
        self.calls = []
        self.polls = 0
        self.down = False

    def request(self, method, url, json=None, headers=None, timeout=None):
        path = url.split("/v1", 1)[1]
        self.calls.append((method, path, json, (headers or {}).get("Authorization")))
        if self.down:
            raise requests.ConnectionError("refused")
        err = lambda status, code, en, zh: Reply(status, {"error": {"code": code, "message": en, "message_zh": zh}})
        if path == "/status":
            return Reply(200, {"online": True, "checked": 1900000000, "gpu": "NVIDIA GeForce RTX 2080",
                               "uptime": {"window_days": 7, "ratio": 0.42, "samples": 600, "days": []}})
        if (headers or {}).get("Authorization") != f"Bearer {KEY}":
            return err(401, "unauthorized", "This API key is not valid", "这个 API key 无效或已撤销，在账号页可以重新生成")
        if path == "/models":
            return Reply(200, {"online": True, "gpu": "NVIDIA GeForce RTX 2080", "costs": {"opt": 1, "freq": 3}, "cost_with_thermo": 5,
                               "models": [{"id": "uma-s-1p2p1", "ready": True, "queue": 0, "charged": True, "jobs": ["sp", "opt"]}]})
        if path == "/me":
            return Reply(200, {"tier": "free", "usage": USAGE, "key": {"prefix": KEY[:10]}})
        if method == "POST" and path == "/jobs":
            if json.get("smiles") == "C1CC1":
                return Reply(200, {"status": "done", "cached": True, "result": {"energy_ev": -3200.1}, "cost": 1, "usage": USAGE})
            if json.get("smiles") == "busy":
                return err(429, "job_in_progress", "You already have a job queued or running", "你已经有一个任务在排队或计算，等它完成再提交下一个")
            if json.get("smiles") == "off":
                return err(503, "offline", "The site owner's GPU is offline right now", "站长的 GPU 现在离线，请稍后再试")
            if json.get("smiles") == "html":
                return Reply(403, None)
            return Reply(202, {"id": "0123456789abcdef", "status": "queued", "position": 1, "cost": 1, "usage": USAGE})
        if method == "GET" and path == "/jobs/0123456789abcdef":
            self.polls += 1
            if self.polls < 2:
                return Reply(200, {"id": "0123456789abcdef", "status": "running", "model": "uma-s-1p2p1", "job": "opt"})
            return Reply(200, {"id": "0123456789abcdef", "status": "done", "model": "uma-s-1p2p1", "job": "opt",
                               "result": {"energy_ev": -4215.5, "converged": True, "steps": 12}})
        if method == "GET" and path == "/jobs/bad0bad0bad0bad0":
            return Reply(200, {"id": "bad0bad0bad0bad0", "status": "error", "error": "could not build a 3D structure"})
        return err(404, "not_found", "No such job", "没有找到这个任务（完成后保留一小时）")


@pytest.fixture()
def service(monkeypatch):
    fake = FakeService()
    monkeypatch.setattr(net, "session", lambda: fake)
    monkeypatch.setattr(mc, "POLL_S", 0.01)
    monkeypatch.setenv("MOLASTRIA_API_KEY", KEY)
    monkeypatch.delenv("MOLASTRIA_API", raising=False)
    return fake


def call(name, args):
    return asyncio.run(server.mcp.call_tool(name, args)).structured_content


def test_run_submits_polls_and_returns_the_result(service):
    res = call("run_calculation", {"smiles": " CCO ", "job": "opt", "wait_s": 5})
    assert res["status"] == "ok" and res["job_status"] == "done"
    assert res["result"] == {"energy_ev": -4215.5, "converged": True, "steps": 12}
    assert res["cost"] == 1 and res["usage"]["remaining"] == 97, "提交时给的花费和剩余次数留在返回值里"
    assert service.calls[0] == ("POST", "/jobs", {"job": "opt", "model": "uma-s-1p2p1", "smiles": "CCO"}, f"Bearer {KEY}")
    assert [c[1] for c in service.calls[1:]] == ["/jobs/0123456789abcdef"] * 2


def test_cached_result_and_optional_fields(service):
    res = call("run_calculation", {"smiles": "C1CC1", "job": "sp"})
    assert res["status"] == "ok" and res["cached"] is True and res["result"]["energy_ev"] == -3200.1
    assert len(service.calls) == 1, "缓存的结果不用轮询"
    call("run_calculation", {"xyz": "1\n\nHe 0 0 0\n", "job": "ipea", "charge": 1, "spin": 2, "params": {"mode": "vertical"}, "wait_s": 0})
    assert service.calls[-1][2] == {"job": "ipea", "model": "uma-s-1p2p1", "xyz": "1\n\nHe 0 0 0\n", "charge": 1, "spin": 2, "params": {"mode": "vertical"}}


def test_not_done_in_time_returns_the_job_id(service):
    res = call("run_calculation", {"smiles": "CCO", "wait_s": 0})
    assert res["status"] == "pending" and res["job_id"] == "0123456789abcdef" and "get_calculation" in res["next"]
    assert len(service.calls) == 1
    got = call("get_calculation", {"job_id": "0123456789ABCDEF", "wait_s": 5})
    assert got["status"] == "ok" and got["result"]["steps"] == 12
    failed = call("get_calculation", {"job_id": "bad0bad0bad0bad0", "wait_s": 0})
    assert failed["status"] == "error" and failed["error"] == "could not build a 3D structure"


def test_refusals_are_told_plainly_and_not_retried(service):
    for smiles, text in (("busy", "你已经有一个任务在排队或计算"), ("off", "站长的 GPU 现在离线")):
        before = len(service.calls)
        with pytest.raises(ToolError, match=text):
            call("run_calculation", {"smiles": smiles})
        assert len(service.calls) == before + 1, "429 和 503 不重试"
    with pytest.raises(ToolError, match="offline"):
        call("run_calculation", {"smiles": "off"})
    with pytest.raises(ToolError, match="HTTP 403"):
        call("run_calculation", {"smiles": "html"})
    with pytest.raises(ToolError, match="没有找到这个任务"):
        call("get_calculation", {"job_id": "f" * 16})
    service.down = True
    with pytest.raises(ToolError, match="网络错误"):
        call("run_calculation", {"smiles": "CCO"})


def test_bad_arguments_never_reach_the_service(service):
    for args, text in (({}, "smiles 和 xyz"), ({"smiles": "CCO", "xyz": "1\n\nHe 0 0 0\n"}, "smiles 和 xyz")):
        with pytest.raises(ToolError, match=text):
            call("run_calculation", args)
    with pytest.raises(ToolError, match="16 位十六进制"):
        call("get_calculation", {"job_id": "../me"})
    with pytest.raises(Exception, match="(?i)literal|valid"):  # 学术许可的模型不在可选值里，参数校验就拒绝
        call("run_calculation", {"smiles": "CCO", "model": "mace-off23-small"})
    assert service.calls == []
    # 反应能：物种在 params.reaction 里，不用 smiles
    call("run_calculation", {"job": "rxn", "params": {"reaction": "CC=C.[H][H]>>CCC"}, "wait_s": 0})
    assert service.calls[-1][2] == {"job": "rxn", "model": "uma-s-1p2p1", "params": {"reaction": "CC=C.[H][H]>>CCC"}}


def test_without_a_key(service, monkeypatch):
    monkeypatch.delenv("MOLASTRIA_API_KEY")
    with pytest.raises(ToolError, match="MOLASTRIA_API_KEY"):
        call("run_calculation", {"smiles": "CCO"})
    assert service.calls == [], "没有 key 时不发请求"
    st = call("compute_status", {})
    assert st["status"] == "ok" and st["key_configured"] is False and "account.html" in st["key_hint"]
    assert st["online"] is True and st["uptime"]["ratio"] == 0.42, "在线状态不用 key"
    assert service.calls == [("GET", "/status", None, None)]


def test_status_with_a_key(service):
    st = call("compute_status", {})
    assert st["key_configured"] and st["tier"] == "free" and st["usage"]["remaining"] == 97
    assert st["models"][0]["jobs"] == ["sp", "opt"] and st["costs"] == {"opt": 1, "freq": 3}
    assert "RTX 2080" in st["note"] and "可能离线" in st["note"]
    service.down = True
    with pytest.raises(ToolError, match="网络错误"):
        call("compute_status", {})


def test_base_url_can_point_elsewhere(service, monkeypatch):
    monkeypatch.setenv("MOLASTRIA_API", "http://127.0.0.1:8787/v1/")
    assert mc.base_url() == "http://127.0.0.1:8787/v1"
