"""冒烟测试：骨架可导入、十二个工具已注册且参数都有说明、离线工具可调用。

工具调用走 fastmcp 的 MCP 层（mcp.call_tool），与客户端实际调用路径一致。
"""

import asyncio

import pytest
from fastmcp.exceptions import ToolError

from chemdb_agent import __version__, server, units

EXPECTED_TOOLS = sorted(
    [
        "search_structures",
        "get_record",
        "search_molecules",
        "find_qm_data",
        "get_basis",
        "catalog_status",
        "fetch_dataset_shard",
        "export_training_set",
        "search_resources",
        "run_calculation",
        "get_calculation",
        "compute_status",
    ]
)


def test_version():
    assert __version__ == "0.3.0"


def test_units_constants():
    assert units.HARTREE_TO_EV == 27.211386
    assert units.BOHR_TO_ANGSTROM == 0.529177
    assert units.HARTREE_PER_BOHR_TO_EV_PER_ANGSTROM == 51.42207


def test_all_tools_registered_with_described_parameters():
    tools = asyncio.run(server.mcp.list_tools())
    assert sorted(t.name for t in tools) == EXPECTED_TOOLS
    for t in tools:
        assert t.description and len(t.description) > 20, t.name
        props = t.parameters.get("properties", {})
        for name, schema in props.items():
            assert schema.get("description"), f"{t.name}.{name} 缺参数说明"


def test_catalog_status_ok(data_dir, monkeypatch):
    monkeypatch.delenv("MP_API_KEY", raising=False)
    res = asyncio.run(server.mcp.call_tool("catalog_status", {}))
    sc = res.structured_content
    assert sc["status"] == "ok" and sc["version"] == "0.3.0"
    assert sc["data_dir"] == str(data_dir)
    ids = {s["id"] for s in sc["sources"]}
    assert {"mp", "nomad", "optimade-alexandria-pbe", "chebi", "qcarchive-ml", "bse"} <= ids
    assert len([i for i in ids if i.startswith("optimade-")]) == 15
    assert sc["local_catalog"]["n_records"] == 0


def test_search_resources_tool():
    res = asyncio.run(server.mcp.call_tool("search_resources", {"integration": "optimade"}))
    assert res.structured_content["count"] == 6
    names = {r["name"] for r in res.structured_content["results"]}
    assert {"AFLOW", "OQMD", "JARVIS", "Materials Cloud", "Alexandria"} <= names


def test_get_basis_tool():
    res = asyncio.run(server.mcp.call_tool("get_basis", {"basis_name": "def2-SVP", "elements": ["H", "O"]}))
    assert res.structured_content["status"] == "ok"
    assert "O" in res.structured_content["text"]


def test_unknown_record_prefix_is_a_tool_error(data_dir):
    with pytest.raises(ToolError, match="不认识的 record_id 前缀"):
        asyncio.run(server.mcp.call_tool("get_record", {"record_id": "zzz:1"}))
