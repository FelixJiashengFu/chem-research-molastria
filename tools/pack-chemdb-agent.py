"""Pack agent/chemdb-agent into public/atlas/downloads/chemdb-agent.zip, reproducibly.

    python tools/pack-chemdb-agent.py              # writes public/atlas/downloads/chemdb-agent.zip
    python tools/pack-chemdb-agent.py --out x.zip  # somewhere else (e.g. to compare two builds)

The file list is what git would hold: tracked files plus untracked files that .gitignore does not exclude
(so .venv, __pycache__, data/, .env never get in). Entries are sorted and get a fixed timestamp and
permissions, so the same source gives the same zip byte for byte. Before writing, every file is checked
for local paths and key-looking strings; any hit aborts.
shortcut: deflate output comes from the zlib bundled with Python; a different zlib build could change the
bytes (not the contents) -- compare file hashes inside the zip if that ever matters.
"""

from __future__ import annotations

import argparse
import hashlib
import re
import subprocess
import sys
import zipfile
from pathlib import Path

ROOT = Path(__file__).resolve().parents[1]
SOURCE = Path("agent/chemdb-agent")
DEFAULT_OUT = ROOT / "public/atlas/downloads/chemdb-agent.zip"
TOP = "chemdb-agent"
STAMP = (1980, 1, 1, 0, 0, 0)

# Never ship these, whatever .gitignore says.
DENY_NAME = re.compile(r"(^|/)(\.env|\.venv|venv|__pycache__|\.pytest_cache|.*\.(pyc|db|sqlite|pem|key|tmp))(/|$)")
DENY_TEXT = [
    (re.compile(rb"[A-Za-z]:\\\\?(Users|ChemDraw)\\\\?"), "Windows user/project path"),
    (re.compile(rb"/(Users|home)/[a-z][a-z0-9_-]+/"), "home directory path"),
    (re.compile(rb"/mnt/[a-z]/"), "WSL drive path"),
    (re.compile(rb"\b(xox[abp]-[A-Za-z0-9-]{10,}|sk-[A-Za-z0-9]{20,}|hf_[A-Za-z0-9]{30,}|ghp_[A-Za-z0-9]{30,})"), "token"),
    (re.compile(rb"MP_API_KEY\s*=\s*[A-Za-z0-9]{32}"), "Materials Project key"),
]
# Recorded HTTP traffic must not carry session cookies or keys (tests/conftest.py strips them when recording).
DENY_CASSETTE = re.compile(rb"(?i)^\s*-?\s*(set-cookie|cookie|x-api-key|authorization):|mp-session=", re.M)


def files() -> list[str]:
    out = subprocess.run(
        ["git", "-C", str(ROOT), "ls-files", "--cached", "--others", "--exclude-standard", "-z", "--", SOURCE.as_posix()],
        check=True, capture_output=True,
    ).stdout.decode("utf-8")
    rels = sorted({p[len(SOURCE.as_posix()) + 1 :] for p in out.split("\0") if p and (ROOT / p).is_file()})
    if not rels:
        sys.exit(f"no files under {SOURCE}")
    return rels


def check(rels: list[str]) -> None:
    problems = []
    for rel in rels:
        if DENY_NAME.search(rel) and rel != ".env.example":
            problems.append(f"{rel}: file must not be packed")
            continue
        data = (ROOT / SOURCE / rel).read_bytes()
        rules = DENY_TEXT + ([(DENY_CASSETTE, "cookie or key header")] if rel.startswith("tests/cassettes/") else [])
        for pattern, what in rules:
            m = pattern.search(data)
            if m:
                problems.append(f"{rel}: {what} ({m.group(0)[:40]!r})")
    if problems:
        sys.exit("refusing to pack:\n  " + "\n  ".join(problems))


def pack(out: Path) -> None:
    rels = files()
    check(rels)
    out.parent.mkdir(parents=True, exist_ok=True)
    tmp = out.with_name(out.name + ".tmp")
    with zipfile.ZipFile(tmp, "w") as z:
        for rel in rels:
            info = zipfile.ZipInfo(f"{TOP}/{rel}", date_time=STAMP)
            info.create_system = 3  # same header on Windows and Unix
            info.external_attr = 0o100644 << 16
            info.compress_type = zipfile.ZIP_DEFLATED
            z.writestr(info, (ROOT / SOURCE / rel).read_bytes(), compresslevel=9)
    tmp.replace(out)
    digest = hashlib.sha256(out.read_bytes()).hexdigest()
    print(f"{out.relative_to(ROOT) if out.is_relative_to(ROOT) else out}: {len(rels)} files, {out.stat().st_size} bytes, sha256 {digest}")


if __name__ == "__main__":
    ap = argparse.ArgumentParser(description=__doc__.splitlines()[0])
    ap.add_argument("--out", type=Path, default=DEFAULT_OUT)
    pack(ap.parse_args().out.resolve())
