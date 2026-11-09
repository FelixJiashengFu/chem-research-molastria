"""用真正的 MCP 客户端经标准输入输出启动服务器：握手、列工具、调用离线工具（不联网）。"""

import asyncio
import os
import sys

from fastmcp import Client
from fastmcp.client.transports import StdioTransport

from test_smoke import EXPECTED_TOOLS


def test_stdio_handshake_lists_tools_and_calls(tmp_path):
    env = {**os.environ, "CHEMDB_DATA_DIR": str(tmp_path), "PYTHONUTF8": "1"}
    env.pop("MP_API_KEY", None)
    transport = StdioTransport(command=sys.executable, args=["-m", "chemdb_agent.server"], env=env, cwd=str(tmp_path))

    async def run():
        # legacy：走经典的 initialize 握手（Claude Desktop 等客户端用的就是它）
        async with Client(transport, timeout=60, mode="legacy") as client:
            init = client.initialize_result
            tools = await client.list_tools()
            status = await client.call_tool("catalog_status", {})
            basis = await client.call_tool("get_basis", {"basis_name": "def2-SVP", "elements": ["C"], "fmt": "psi4"})
            bad = await client.call_tool("get_record", {"record_id": "zzz:1"}, raise_on_error=False)
            return init, tools, status, basis, bad

    init, tools, status, basis, bad = asyncio.run(run())
    assert init.serverInfo.name == "chemdb-agent" and init.serverInfo.version == "0.3.0"
    assert sorted(t.name for t in tools) == EXPECTED_TOOLS
    assert all(p.get("description") for t in tools for p in t.inputSchema.get("properties", {}).values())
    assert status.structured_content["data_dir"] == str(tmp_path)
    assert basis.structured_content["fmt"] == "psi4"
    assert bad.is_error and "不认识的 record_id 前缀" in bad.content[0].text
