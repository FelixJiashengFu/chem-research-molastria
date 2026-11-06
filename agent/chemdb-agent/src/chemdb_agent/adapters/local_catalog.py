"""本地数据目录：下载的分片文件 + sqlite 元数据索引。

目录结构（都在数据目录下）::

    shards/<来源>/<数据集编号>-<数据集名>/<规格>/<起点>-<终点>.jsonl            每行一条 UnifiedRecord
    shards/<来源>/<数据集编号>-<数据集名>/<规格>/<起点>-<终点>.manifest.json    来源、许可、理论级别、校验和
    catalog.sqlite                                                              索引，只存元数据

分片里的每条记录保留自己的来源、理论级别、许可和获取时间。索引可以随时由 manifest 重建
（:func:`rebuild_index`），所以复制别人的 shards/ 目录过来也能直接用。
"""

from __future__ import annotations

import hashlib
import json
import re
import sqlite3
from contextlib import closing
from datetime import datetime, timezone
from pathlib import Path
from typing import Any

from chemdb_agent import __version__
from chemdb_agent.schema import UnifiedRecord

SHARD_DIR = "shards"
_SCHEMA = """
CREATE TABLE IF NOT EXISTS shards (
  shard_id TEXT PRIMARY KEY, source TEXT, dataset TEXT, dataset_id TEXT, specification TEXT,
  path TEXT, n_records INTEGER, license TEXT, theory_keys TEXT, created_at TEXT
);
CREATE TABLE IF NOT EXISTS records (
  record_id TEXT PRIMARY KEY, shard_id TEXT, line INTEGER, formula TEXT, elements TEXT,
  natoms INTEGER, has_energy INTEGER, theory_key TEXT
);
"""


def _slug(text: str) -> str:
    return re.sub(r"[^A-Za-z0-9._-]+", "-", str(text)).strip("-.")[:80] or "x"


def _connect(root: Path) -> sqlite3.Connection:
    root.mkdir(parents=True, exist_ok=True)
    conn = sqlite3.connect(root / "catalog.sqlite", timeout=10)
    conn.executescript(_SCHEMA)
    return conn


def _index(conn: sqlite3.Connection, manifest: dict[str, Any], records: list[UnifiedRecord]) -> None:
    conn.execute(
        "INSERT OR REPLACE INTO shards VALUES (?,?,?,?,?,?,?,?,?,?)",
        (
            manifest["shard_id"], manifest["source"], manifest["dataset"], str(manifest["dataset_id"]),
            manifest["specification"], str(Path(manifest["file"])), manifest["n_records"], manifest["license"],
            json.dumps(manifest["theory_keys"], ensure_ascii=False), manifest["created_at"],
        ),
    )
    conn.execute("DELETE FROM records WHERE shard_id = ?", (manifest["shard_id"],))
    conn.executemany(
        "INSERT OR REPLACE INTO records VALUES (?,?,?,?,?,?,?,?)",
        [
            (
                r.record_id, manifest["shard_id"], i, r.atoms.get_chemical_formula(),
                "," + ",".join(sorted(set(r.atoms.get_chemical_symbols()))) + ",", len(r.atoms),
                int(r.energy is not None), r.mix_key,
            )
            for i, r in enumerate(records)
        ],
    )


def write_shard(
    root: Path,
    *,
    source: str,
    dataset: str,
    dataset_id: str | int,
    specification: str,
    start: int,
    records: list[UnifiedRecord],
    license: str,
    level_of_theory: dict[str, Any],
    notes: list[str] | None = None,
) -> dict[str, Any]:
    """写一个分片（jsonl + manifest）并登记到索引；返回 manifest。"""
    if not records:
        raise ValueError("没有可写入的记录")
    rel_dir = Path(SHARD_DIR) / _slug(source) / f"{_slug(str(dataset_id))}-{_slug(dataset)}" / _slug(specification)
    stem = f"{start:07d}-{start + len(records) - 1:07d}"
    out_dir = root / rel_dir
    out_dir.mkdir(parents=True, exist_ok=True)
    data_path = out_dir / f"{stem}.jsonl"
    text = "".join(r.model_dump_json() + "\n" for r in records)
    tmp = data_path.with_suffix(".jsonl.tmp")
    tmp.write_text(text, encoding="utf-8")
    tmp.replace(data_path)
    theory_keys: dict[str, int] = {}
    for r in records:
        theory_keys[r.mix_key] = theory_keys.get(r.mix_key, 0) + 1
    manifest = {
        "shard_id": f"{_slug(source)}/{_slug(str(dataset_id))}/{_slug(specification)}/{stem}",
        "source": source,
        "dataset": dataset,
        "dataset_id": dataset_id,
        "specification": specification,
        "start": start,
        "n_records": len(records),
        "file": str((rel_dir / data_path.name).as_posix()),
        "sha256": hashlib.sha256(text.encode("utf-8")).hexdigest(),
        "license": license,
        "level_of_theory": level_of_theory,
        "theory_keys": theory_keys,
        "created_at": datetime.now(timezone.utc).isoformat(timespec="seconds"),
        "chemdb_agent": __version__,
        "notes": notes or [],
    }
    (out_dir / f"{stem}.manifest.json").write_text(json.dumps(manifest, ensure_ascii=False, indent=1), encoding="utf-8")
    with closing(_connect(root)) as conn, conn:
        _index(conn, manifest, records)
    return manifest


def _read_shard(root: Path, rel_file: str) -> list[UnifiedRecord]:
    path = root / rel_file
    return [UnifiedRecord.model_validate_json(line) for line in path.read_text(encoding="utf-8").splitlines() if line.strip()]


def rebuild_index(root: Path) -> int:
    """按 shards/ 下的 manifest 重建索引；返回登记的分片数。"""
    manifests = sorted((root / SHARD_DIR).rglob("*.manifest.json")) if (root / SHARD_DIR).exists() else []
    with closing(_connect(root)) as conn, conn:
        conn.execute("DELETE FROM shards")
        conn.execute("DELETE FROM records")
        for mpath in manifests:
            manifest = json.loads(mpath.read_text(encoding="utf-8"))
            _index(conn, manifest, _read_shard(root, manifest["file"]))
    return len(manifests)


def get(root: Path, record_id: str) -> UnifiedRecord | None:
    """按 record_id 从本地分片读一条记录；本地没有返回 None。"""
    if not (root / "catalog.sqlite").exists():
        return None
    with closing(_connect(root)) as conn:
        row = conn.execute(
            "SELECT s.path, r.line FROM records r JOIN shards s ON s.shard_id = r.shard_id WHERE r.record_id = ?",
            (record_id,),
        ).fetchone()
    if row is None:
        return None
    with open(root / row[0], encoding="utf-8") as f:
        for i, line in enumerate(f):
            if i == row[1]:
                return UnifiedRecord.model_validate_json(line)
    return None


def load_dataset(root: Path, dataset: str) -> list[UnifiedRecord]:
    """按数据集名称、数据集编号或 shard_id 取本地全部记录。"""
    with closing(_connect(root)) as conn:
        rows = conn.execute(
            "SELECT path FROM shards WHERE dataset = ? OR dataset_id = ? OR shard_id = ? ORDER BY shard_id",
            (dataset, dataset, dataset),
        ).fetchall()
    if not rows:
        raise KeyError(f"本地目录里没有数据集或分片 {dataset!r}；先用 fetch_dataset_shard 下载，或查 catalog_status")
    out: list[UnifiedRecord] = []
    for (path,) in rows:
        out.extend(_read_shard(root, path))
    return out


def search(root: Path, elements: list[str] | None = None, theory_key: str | None = None, limit: int = 20) -> dict[str, Any]:
    """在本地索引里按元素（全包含）和理论级别键筛，返回按数据集汇总的计数与样本编号。"""
    if not (root / "catalog.sqlite").exists():
        return {"n_records": 0, "datasets": []}
    sql = "SELECT s.dataset, s.dataset_id, s.source, r.theory_key, COUNT(*), MIN(r.record_id) FROM records r JOIN shards s ON s.shard_id = r.shard_id WHERE 1=1"
    args: list[Any] = []
    for el in elements or []:
        sql += " AND r.elements LIKE ?"
        args.append(f"%,{el},%")
    if theory_key:
        sql += " AND r.theory_key = ?"
        args.append(theory_key)
    sql += " GROUP BY s.dataset, s.dataset_id, s.source, r.theory_key ORDER BY COUNT(*) DESC LIMIT ?"
    args.append(limit)
    with closing(_connect(root)) as conn:
        rows = conn.execute(sql, args).fetchall()
    datasets = [
        {"dataset": d, "dataset_id": i, "source": s, "theory_key": k, "n_records": n, "sample_record_id": rid}
        for d, i, s, k, n, rid in rows
    ]
    return {"n_records": sum(d["n_records"] for d in datasets), "datasets": datasets}


def stats(root: Path) -> dict[str, Any]:
    """本地目录概况（catalog_status 用）。索引缺失但有分片时先重建。"""
    if not (root / "catalog.sqlite").exists() and (root / SHARD_DIR).exists():
        rebuild_index(root)
    if not (root / "catalog.sqlite").exists():
        return {"n_shards": 0, "n_records": 0, "shards": []}
    with closing(_connect(root)) as conn:
        rows = conn.execute(
            "SELECT shard_id, source, dataset, specification, n_records, license, path FROM shards ORDER BY shard_id"
        ).fetchall()
    shards = []
    for sid, src, ds, spec, n, lic, path in rows:
        p = root / path
        shards.append({
            "shard_id": sid, "source": src, "dataset": ds, "specification": spec, "n_records": n,
            "license": lic, "size_bytes": p.stat().st_size if p.exists() else None,
        })
    return {"n_shards": len(shards), "n_records": sum(s["n_records"] for s in shards), "shards": shards}
