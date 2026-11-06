"""测试共用：录制回放的 VCR 配置、隔离的数据目录。

cassette 第一次运行时联网录制，之后离线回放（record_mode="once"）。录制时去掉
API key、Cookie 与 Set-Cookie，不让会话信息进仓库。
"""

from __future__ import annotations

from pathlib import Path

import pytest
import vcr

CASSETTES = str(Path(__file__).parent / "cassettes")
_DROP_RESPONSE_HEADERS = {"set-cookie", "cf-ray", "report-to", "nel"}


def _scrub_response(response):
    headers = response.get("headers", {})
    for name in list(headers):
        if name.lower() in _DROP_RESPONSE_HEADERS:
            del headers[name]
    return response


def make_vcr(**kwargs) -> vcr.VCR:
    return vcr.VCR(
        cassette_library_dir=CASSETTES,
        record_mode="once",
        filter_headers=["x-api-key", "X-API-KEY", "authorization", "cookie"],
        filter_query_parameters=["api_key", "API_KEY", "token"],
        before_record_response=_scrub_response,
        decode_compressed_response=True,
        **kwargs,
    )


@pytest.fixture()
def data_dir(tmp_path, monkeypatch):
    """服务器的数据目录指向临时目录（缓存、本地分片、导出都在这里）。"""
    from chemdb_agent import server

    monkeypatch.setattr(server, "DATA_DIR", tmp_path)
    return tmp_path


class _TickingTime:
    """qcportal 按每批耗时调下一批大小，耗时为 0 会除零（回放 cassette 时一批可能不到 1 ms）。
    测试里让它看到的 time.time() 每次至少前进 1 ms，其余函数照用真的 time 模块。"""

    def __init__(self):
        import time

        self._time = time
        self._last = time.time()

    def time(self):
        self._last = max(self._last + 1e-3, self._time.time())
        return self._last

    def __getattr__(self, name):
        return getattr(self._time, name)


@pytest.fixture(autouse=True)
def _fresh_qcarchive_clients(monkeypatch):
    """每个测试新建 PortalClient，连接请求才会录进各自的 cassette。"""
    import qcportal.utils

    from chemdb_agent.adapters import qcarchive

    monkeypatch.setattr(qcportal.utils, "time", _TickingTime())
    qcarchive._clients.clear()
    yield
    qcarchive._clients.clear()
