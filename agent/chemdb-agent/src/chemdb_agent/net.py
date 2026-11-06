"""共用 HTTP：超时、重试、礼貌限速和写给人看的报错。

- 超时默认 30 秒，环境变量 ``CHEMDB_HTTP_TIMEOUT`` 可改；
- 网络错误、超时、HTTP 5xx 与 429 退避重试（共 3 次）；其余 4xx 立即报错；
- 报错统一为 :class:`SourceError`，消息里带数据源名、HTTP 状态和服务器给的原因。
"""

from __future__ import annotations

import os
import threading
import time
from typing import Any
from urllib.parse import urlsplit

import requests

from chemdb_agent import __version__

USER_AGENT = f"chemdb-agent/{__version__} (+https://molastria.com)"
RETRIES = 3

_session: requests.Session | None = None
_lock = threading.Lock()
_next_slot: dict[str, float] = {}


class SourceError(RuntimeError):
    """数据源不可用或报错。消息写给人看：哪个源、发生了什么。"""

    def __init__(self, source: str, message: str, *, status: int | None = None) -> None:
        super().__init__(f"{source}：{message}")
        self.source = source
        self.status = status


class MissingKeyError(SourceError):
    """需要用户自己配置的 API key 没有配置。"""


def timeout_s() -> float:
    """单次 HTTP 请求的超时（秒）。"""
    try:
        return max(1.0, float(os.environ.get("CHEMDB_HTTP_TIMEOUT", "30")))
    except ValueError:
        return 30.0


def session() -> requests.Session:
    global _session
    if _session is None:
        s = requests.Session()
        s.headers["User-Agent"] = USER_AGENT
        _session = s
    return _session


def _throttle(host: str, min_interval: float) -> None:
    """同一主机两次请求至少间隔 min_interval 秒（多线程安全）。"""
    if min_interval <= 0:
        return
    with _lock:
        now = time.monotonic()
        slot = max(now, _next_slot.get(host, 0.0))
        _next_slot[host] = slot + min_interval
    if slot > now:
        time.sleep(slot - now)


def _detail(resp: requests.Response) -> str:
    """从错误响应里取服务器给的原因（OPTIMADE errors / NOMAD detail / 纯文本）。"""
    try:
        body = resp.json()
    except ValueError:
        text = resp.text.strip()
        return f"：{text[:160]}" if text and not text.lstrip().startswith("<") else ""
    if isinstance(body, dict):
        errors = body.get("errors")
        if isinstance(errors, list) and errors and isinstance(errors[0], dict):
            return f"：{str(errors[0].get('detail') or errors[0].get('title') or errors[0])[:200]}"
        if body.get("detail"):
            return f"：{str(body['detail'])[:200]}"
    return ""


def _short(url: str) -> str:
    parts = urlsplit(url)
    return f"{parts.netloc}{parts.path}"


def request(
    source: str,
    url: str,
    *,
    method: str = "GET",
    params: dict[str, Any] | None = None,
    json_body: Any = None,
    min_interval: float = 0.0,
    retries: int = RETRIES,
    as_json: bool = True,
) -> Any:
    """发请求并返回 JSON（或 ``as_json=False`` 时返回文本）。失败抛 :class:`SourceError`。"""
    host = urlsplit(url).netloc
    last = ""
    for attempt in range(retries):
        _throttle(host, min_interval)
        wait = 1.0 * (attempt + 1)
        try:
            resp = session().request(method, url, params=params, json=json_body, timeout=timeout_s())
        except requests.Timeout:
            last = f"超时（{timeout_s():g} 秒）"
        except requests.RequestException as e:
            last = f"网络错误（{type(e).__name__}）"
        else:
            if resp.status_code == 200:
                if not as_json:
                    return resp.text
                try:
                    return resp.json()
                except ValueError:
                    raise SourceError(source, f"返回的不是 JSON（{_short(url)}）", status=200) from None
            detail = _detail(resp)
            if resp.status_code < 500 and resp.status_code != 429:
                raise SourceError(source, f"HTTP {resp.status_code}{detail}（{_short(url)}）", status=resp.status_code)
            last = f"HTTP {resp.status_code}{detail}"
            retry_after = resp.headers.get("Retry-After", "")
            if resp.status_code == 429 and retry_after.isdigit():
                wait = min(10.0, float(retry_after))
        if attempt < retries - 1:
            time.sleep(wait)
    raise SourceError(source, f"{retries} 次尝试均失败：{last}（{_short(url)}）")
