"""记录缓存：sqlite 文件，按键存 JSON，带过期时间。

缓存放在数据目录下的 ``cache.sqlite``。过期时间默认 7 天，环境变量
``CHEMDB_CACHE_TTL``（秒）可改，设为 0 即不读缓存。
"""

from __future__ import annotations

import json
import os
import sqlite3
import time
from contextlib import closing
from pathlib import Path
from typing import Any

DEFAULT_TTL_S = 7 * 24 * 3600


def ttl_s() -> float:
    try:
        return max(0.0, float(os.environ.get("CHEMDB_CACHE_TTL", DEFAULT_TTL_S)))
    except ValueError:
        return float(DEFAULT_TTL_S)


class Cache:
    def __init__(self, root: Path) -> None:
        self.path = Path(root) / "cache.sqlite"

    def _connect(self) -> sqlite3.Connection:
        self.path.parent.mkdir(parents=True, exist_ok=True)
        conn = sqlite3.connect(self.path, timeout=10)
        conn.execute("CREATE TABLE IF NOT EXISTS cache (key TEXT PRIMARY KEY, value TEXT NOT NULL, created REAL NOT NULL)")
        return conn

    def get(self, key: str) -> Any | None:
        ttl = ttl_s()
        if ttl <= 0:
            return None
        with closing(self._connect()) as conn:
            row = conn.execute("SELECT value, created FROM cache WHERE key = ?", (key,)).fetchone()
        if row is None or time.time() - row[1] > ttl:
            return None
        return json.loads(row[0])

    def put(self, key: str, value: Any) -> None:
        text = json.dumps(value, ensure_ascii=False)
        with closing(self._connect()) as conn, conn:
            conn.execute("INSERT OR REPLACE INTO cache (key, value, created) VALUES (?, ?, ?)", (key, text, time.time()))

    def stats(self) -> dict[str, Any]:
        if not self.path.exists():
            return {"path": str(self.path), "entries": 0, "ttl_s": ttl_s()}
        with closing(self._connect()) as conn:
            n = conn.execute("SELECT COUNT(*) FROM cache").fetchone()[0]
        return {"path": str(self.path), "entries": n, "ttl_s": ttl_s()}
