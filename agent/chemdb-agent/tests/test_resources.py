"""资源目录（与 MolAstria 网站同一份）测试：纯离线。"""

from chemdb_agent.catalog import resources as res


def test_resources_count_and_numbers():
    allr = res.all_resources()
    assert len(allr) == 253
    assert [r["number"] for r in allr] == list(range(1, 254))
    assert res.UPDATED and res.SOURCE.startswith("https://molastria.com/api/v1/")
    assert all(r["name"] and r["url"].startswith("http") and r["access"] for r in allr)


def test_resources_categories():
    assert len(res.CATEGORIES) == 17
    counts = {c: len(res.by_category(c)) for c in res.CATEGORIES}
    assert counts["综合化合物与化学信息"] == 7
    assert counts["材料与晶体结构"] == 15
    assert counts["软件、平台与计算入口"] == 34
    assert counts["社区与中文入口"] == 4
    assert counts["科学领域语言模型与多模态基础模型"] == 27
    assert sum(counts.values()) == 253


def test_resources_integrated_mapping():
    integrated = {r["number"]: r for r in res.integrated()}
    assert len(integrated) == 13
    # 独立适配器（0.2.0 新增 ChEBI、NOMAD 原生接口、QCArchive）
    for n in (1, 5, 17, 20, 23, 43, 76):
        assert integrated[n]["integration"] == "adapter", n
    assert integrated[76]["name"] == "QCArchive"
    # 经 OPTIMADE 接入（0.2.0 新增 OQMD、Alexandria）
    for n in (21, 22, 24, 25, 29, 74):
        assert integrated[n]["integration"] == "optimade", n
    # 其余不得冒充已接入
    assert not res.search_resources("", integration="stub")
    assert res.by_number(2)["integration"] == "catalog"  # ChemSpider 要 key
    assert res.by_number(4)["integration"] == "catalog"  # NIST WebBook 没有正式 API
    assert res.by_number(32)["integration"] == "catalog"  # Catalysis-Hub 接口 404


def test_resources_details_point_at_real_modules():
    import importlib

    for r in res.integrated():
        if r["integration"] == "adapter":
            module = r["detail"].split("（")[0]
            importlib.import_module(module)
        else:
            import re

            from chemdb_agent.adapters.optimade import PROVIDERS

            for provider in re.findall(r"provider=([a-z0-9-]+)", r["detail"]):
                assert provider in PROVIDERS, r["detail"]


def test_resources_search():
    hits = res.search_resources("NOMAD")
    assert any(r["number"] == 23 for r in hits)
    hits = res.search_resources("", integration="optimade")
    assert len(hits) == 6
    hits = res.search_resources("", category="药物、生物活性与化学空间")
    assert len(hits) == 10 and all(r["category_code"] == "05" for r in hits)
    try:
        res.by_number(999)
    except KeyError:
        pass
    else:
        raise AssertionError("expected KeyError")
