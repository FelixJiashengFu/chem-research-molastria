"""MP 官方 MCP 服务器冒烟测试（阶段 0）。

不断言真实查询结果（需要 MP_API_KEY 与联网），只验证：
1. mp-api 版本 ≥ 0.46.0（自带 MCP 服务器的版本）；
2. MCP 模块可导入、能列出工具。
联网的真实查询放到每周一次的手动冒烟测试。
"""

import asyncio
import importlib
from importlib.metadata import version


def _parse(ver: str) -> tuple:
    parts = []
    for x in ver.split("."):
        digits = "".join(ch for ch in x if ch.isdigit())
        parts.append(int(digits) if digits else 0)
    return tuple(parts)


def test_mp_api_version():
    ver = version("mp-api")
    assert _parse(ver) >= (0, 46), f"mp-api {ver} < 0.46.0，自带 MCP 服务器不可用"


def test_mp_mcp_lists_tools():
    """MP MCP 服务器能启动并列出工具（不需要 API key）。"""
    mcp_mod = importlib.import_module("mp_api.mcp.server")
    mcp = getattr(mcp_mod, "mcp", None)
    assert mcp is not None, "mp_api.mcp.server 里找不到 mcp 服务器对象"
    tools = asyncio.run(mcp.list_tools())
    names = sorted(t.name for t in tools)
    assert len(names) > 0, "MP MCP 服务器没有注册任何工具"
    print("MP MCP tools:", names)
