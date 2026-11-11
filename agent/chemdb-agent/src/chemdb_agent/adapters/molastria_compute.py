"""MolAstria 计算接口（https://molastria.com/api/#compute）：用机器学习势提交计算并取结果。

和网站的在线模型是同一个队列：站长电脑上的一块 RTX 2080，尽力而为，可能离线，一个账号同时只能有一个任务。
key 是免费的，在 https://molastria.com/pro/account.html 登录后生成，放进环境变量 ``MOLASTRIA_API_KEY``。
MACE 系列是学术许可（ASL），不通过接口提供。

这里不走 :func:`chemdb_agent.net.request`：那边遇到 429 和 5xx 会重试，而这里的 429（次数用完、已有任务）和
503（电脑离线）重试没有意义，还会把一次请求拖成十几秒。
"""

from __future__ import annotations

import os
import time
from typing import Any, Callable

import requests

from chemdb_agent import net

SOURCE = "MolAstria 计算接口"
ACCOUNT_PAGE = "https://molastria.com/pro/account.html"
DOCS = "https://molastria.com/api/#compute"
MODELS = (
    "uma-s-1p2p1", "uma-s-1p2", "uma-s-1p2p1-ft-d4rev", "uma-s-1p1",
    "allscaip-md-conserving-all-omol", "allscaip-md-direct-all-omol",
    "esen-sm-conserving-all-omol", "esen-sm-direct-all-omol", "esen-md-direct-all-omol", "ani-2x",
    "gfn2-xtb", "gfn2-xtb-alpb-water", "gfn1-xtb", "gfn-ff", "openmm-amber14",
)
JOBS = ("sp", "opt", "freq", "conf", "scan", "md", "rxn", "ipea", "spin", "bde", "pa", "pmd")
POLL_S = 3.0
NOTE = "算力是站长电脑上的 RTX 2080，尽力而为，可能离线；不要用在有时限的任务上。"


def base_url() -> str:
    return os.environ.get("MOLASTRIA_API", "https://api.molastria.com/v1").rstrip("/")


def configured_key() -> str:
    return os.environ.get("MOLASTRIA_API_KEY", "").strip()


def _call(path: str, *, body: Any = None, key: bool = True) -> dict[str, Any]:
    headers = {}
    if key:
        k = configured_key()
        if not k:
            raise net.MissingKeyError(SOURCE, f"需要 API key：在 {ACCOUNT_PAGE} 用邮箱登录后生成（免费），放进环境变量 MOLASTRIA_API_KEY")
        headers["Authorization"] = f"Bearer {k}"
    url = base_url() + path
    try:
        resp = net.session().request("POST" if body is not None else "GET", url, json=body, headers=headers, timeout=net.timeout_s())
    except requests.Timeout:
        raise net.SourceError(SOURCE, f"超时（{net.timeout_s():g} 秒）") from None
    except requests.RequestException as e:
        raise net.SourceError(SOURCE, f"网络错误（{type(e).__name__}）") from None
    try:
        data = resp.json()
    except ValueError:
        data = None
    if not isinstance(data, dict):
        raise net.SourceError(SOURCE, f"HTTP {resp.status_code}，返回的不是 JSON", status=resp.status_code)
    if resp.status_code >= 400:
        err = data.get("error") if isinstance(data.get("error"), dict) else {}
        # 服务的报错带中文（message_zh）和给程序看的 code；两样都交给调用方。
        text = err.get("message_zh") or err.get("message") or f"HTTP {resp.status_code}"
        raise net.SourceError(SOURCE, f"{text}（{err.get('code') or resp.status_code}）", status=resp.status_code)
    return data


def status() -> dict[str, Any]:
    """电脑最近一次探测在不在线、最近 7 天的在线率。不用 key。"""
    return _call("/status", key=False)


def models() -> dict[str, Any]:
    """可用的模型、每个模型做哪些计算、每种计算花几次。"""
    return _call("/models")


def me() -> dict[str, Any]:
    """这个 key 的档位和今天的次数。"""
    return _call("/me")


def submit(*, job: str, model: str, smiles: str | None = None, xyz: str | None = None, charge: int | None = None,
           spin: int | None = None, params: dict[str, Any] | None = None) -> dict[str, Any]:
    body: dict[str, Any] = {"job": job, "model": model}
    for name, value in (("smiles", smiles), ("xyz", xyz), ("charge", charge), ("spin", spin), ("params", params)):
        if value is not None:
            body[name] = value
    return _call("/jobs", body=body)


def get(job_id: str) -> dict[str, Any]:
    return _call(f"/jobs/{job_id}")


def wait(job: dict[str, Any], wait_s: float, *, sleep: Callable[[float], None] = time.sleep) -> dict[str, Any]:
    """轮询到算完或等满 wait_s 秒；到时间还没算完就把当前状态原样返回（任务继续算）。"""
    deadline = time.monotonic() + max(0.0, wait_s)
    while job.get("status") in ("queued", "running") and job.get("id") and time.monotonic() < deadline:
        sleep(min(POLL_S, max(0.1, deadline - time.monotonic())))
        job = {**job, **get(job["id"])}
    return job
