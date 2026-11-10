"""资源目录：MolAstria 开放数据接口的资源目录（与网站的数据库目录同一份，现有 228 条、17 类）。

条目在同目录的 ``resources.json`` 里，由仓库的 ``tools/build-api.mjs`` 从网站数据生成，
和 https://molastria.com/api/v1/resources.json 同源（那里另有英文说明）；不要手改。
随包安装，离线可用。``integration`` 为本仓库的接入状态：

- ``adapter``：已有独立适配器，可直接返回 UnifiedRecord / 基组文本；
- ``optimade``：已接入 adapters.optimade 的 PROVIDERS，可参与跨库检索；
- ``stub``：适配器文件为阶段占位，尚未实现；
- ``catalog``：仅收录导航信息（软件、社区、订阅库或待评估 API 的库），
  不冒充已接入——需要时按现有适配器模式新增。
"""

from __future__ import annotations

import json
from importlib import resources as _files

_DATA = json.loads(_files.files(__package__).joinpath("resources.json").read_text(encoding="utf-8"))

#: 目录的核对日期与公开地址。
UPDATED: str = _DATA["updated"]
SOURCE: str = _DATA["source"]
RESOURCES: list[dict] = _DATA["resources"]


CATEGORIES: list[str] = sorted({r["category"] for r in RESOURCES},
                               key=lambda c: next(r["category_code"] for r in RESOURCES if r["category"] == c))


def all_resources() -> list[dict]:
    """全部资源（按导航编号）。"""
    return list(RESOURCES)


def by_number(number: int) -> dict:
    """按导航编号取一条；找不到抛 KeyError。"""
    for r in RESOURCES:
        if r["number"] == number:
            return r
    raise KeyError(f"资源编号 {number} 不存在（有效范围 1–{len(RESOURCES)}）")


def by_category(category: str) -> list[dict]:
    """按类别名（如「材料与晶体结构」）取资源。"""
    return [r for r in RESOURCES if r["category"] == category]


def integrated() -> list[dict]:
    """已真正接入（adapter / optimade）的资源。"""
    return [r for r in RESOURCES if r["integration"] in ("adapter", "optimade")]


def search_resources(query: str = "", category: str | None = None,
                     integration: str | None = None) -> list[dict]:
    """按关键词（名称/描述/链接）、类别、接入状态检索资源目录。"""
    q = query.strip().lower()
    out = []
    for r in RESOURCES:
        if category and r["category"] != category:
            continue
        if integration and r["integration"] != integration:
            continue
        if q and q not in (r["name"] + " " + r["description"] + " " + r["url"]).lower():
            continue
        out.append(r)
    return out
