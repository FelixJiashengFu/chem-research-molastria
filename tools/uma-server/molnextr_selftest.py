"""Self-test for MolNexTR before the "molnextr" lane is offered online (docs/RUNBOOK.md, "MolNexTR 结构识别").

Runs with the MolNexTR environment's own Python (it has torch, RDKit and Pillow) and talks to molnextr_worker.py over
stdin/stdout exactly as server.py does:

    D:\\ChemDraw\\molnextr-env\\Scripts\\python.exe -X utf8 tools/uma-server/molnextr_selftest.py --download
    D:\\ChemDraw\\molnextr-env\\Scripts\\python.exe -X utf8 tools/uma-server/molnextr_selftest.py

--download fetches the authors' weights once (molnextr_best.pth, about 0.3 GB, from their Hugging Face dataset
CYF200127/MolNexTR) into MolNexTR's own folder (~/.data/molnextr/) with pystow, the same place the package itself
uses; the service never downloads anything. The package was installed from
https://github.com/CYF2000127/MolNexTR at commit 6f6502b4ed9733dba8b1ee45d2da474576683194 (THIRD-PARTY-molnextr.md).

The test: RDKit draws eight molecules (simple to moderately hard: rings, heteroatoms, a halogen, a charge, a
stereocentre), each is sent as a PNG, and MolNexTR's SMILES is compared with the original by RDKit canonical SMILES
(stereo counted only where the drawing has a wedge). It prints a table with the confidence and the time, the weights'
size and SHA-256 (compare with the release), and the device. Exit code 0 when at least 7 of 8 are read exactly.
"""
import argparse
import base64
import hashlib
import io
import json
import os
import subprocess
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
COMMIT = "6f6502b4ed9733dba8b1ee45d2da474576683194"
URL = "https://huggingface.co/datasets/CYF200127/MolNexTR/resolve/main/molnextr_best.pth"
MOLECULES = [  # (name, SMILES)
    ("benzene", "c1ccccc1"),
    ("4-bromoacetophenone", "CC(=O)c1ccc(Br)cc1"),
    ("aspirin", "CC(=O)Oc1ccccc1C(=O)O"),
    ("caffeine", "Cn1cnc2c1c(=O)n(C)c(=O)n2C"),
    ("ibuprofen", "CC(C)Cc1ccc(cc1)C(C)C(=O)O"),
    ("4-methoxybiphenyl", "COc1ccc(-c2ccccc2)cc1"),
    ("N-methylpyridinium", "C[n+]1ccccc1"),
    ("(S)-alanine", "C[C@H](N)C(=O)O"),
]
NEED = 7


def default_weights():
    return os.environ.get("MOLASTRIA_MOLNEXTR_WEIGHTS", "").strip() or os.path.join(os.path.expanduser("~"), ".data", "molnextr", "molnextr_best.pth")


def sha256(path):
    h = hashlib.sha256()
    with open(path, "rb") as f:
        for block in iter(lambda: f.read(1 << 20), b""):
            h.update(block)
    return h.hexdigest()


def draw(smiles, size=(420, 300)):
    from rdkit import Chem
    from rdkit.Chem import Draw

    mol = Chem.MolFromSmiles(smiles)
    buf = io.BytesIO()
    Draw.MolToImage(mol, size=size).save(buf, "PNG")
    return base64.b64encode(buf.getvalue()).decode()


def canon(smiles, stereo=True):
    from rdkit import Chem

    mol = Chem.MolFromSmiles(smiles or "")
    return Chem.MolToSmiles(mol, isomericSmiles=stereo) if mol else None


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--download", action="store_true", help="fetch molnextr_best.pth from the authors' Hugging Face dataset first")
    ap.add_argument("--weights", default=default_weights(), help="the checkpoint (default: MOLASTRIA_MOLNEXTR_WEIGHTS or ~/.data/molnextr/molnextr_best.pth)")
    ap.add_argument("--device", default="", help="cuda or cpu (default: cuda when available)")
    args = ap.parse_args()

    try:
        from importlib.metadata import version, distribution

        info = json.loads(distribution("MolNexTR").read_text("direct_url.json") or "{}")
        commit = info.get("vcs_info", {}).get("commit_id", "")
        print(f"MolNexTR {version('MolNexTR')} from {info.get('url', '?')} @ {commit or '?'}")
        if commit and commit != COMMIT:
            print(f"  note: the service was tested with commit {COMMIT}")
    except Exception as e:  # noqa: BLE001
        raise SystemExit(f"MolNexTR is not installed in this Python ({sys.executable}): {e}")

    if args.download:
        import pystow

        path = str(pystow.ensure("molnextr", url=URL))
        print(f"downloaded to {path}")
        if os.path.abspath(path) != os.path.abspath(args.weights):
            print(f"  set MOLASTRIA_MOLNEXTR_WEIGHTS={path} for the service")
            args.weights = path
    if not os.path.exists(args.weights):
        raise SystemExit(f"no weights at {args.weights}: run with --download, or give --weights")
    print(f"weights {args.weights}: {os.path.getsize(args.weights) / 1e6:.1f} MB, sha256 {sha256(args.weights)}")

    env = dict(os.environ, MOLASTRIA_MOLNEXTR_WEIGHTS=args.weights, PYTHONUTF8="1")
    if args.device:
        env["MOLASTRIA_MOLNEXTR_DEVICE"] = args.device
    proc = subprocess.Popen([sys.executable, "-X", "utf8", os.path.join(HERE, "molnextr_worker.py")], env=env,
                            stdin=subprocess.PIPE, stdout=subprocess.PIPE, text=True, encoding="utf-8")

    def ask(req):
        proc.stdin.write(json.dumps(req) + "\n")
        proc.stdin.flush()
        line = proc.stdout.readline()
        if not line:
            raise SystemExit("the worker stopped (see the messages above)")
        reply = json.loads(line)
        if not reply.get("ok"):
            raise SystemExit(f"worker error: {reply.get('error')}")
        return reply

    try:
        t = time.time()
        ping = ask({"op": "ping"})
        print(f"device {ping['device']}{' (' + ping['gpu'] + ')' if ping.get('gpu') else ''}, loaded in {time.time() - t:.1f} s")
        images = [draw(s) for _, s in MOLECULES]
        t = time.time()
        items = ask({"op": "ocsr", "images": images})["items"]
        seconds = time.time() - t
    finally:
        proc.stdin.close()
        proc.wait(30)

    good = 0
    print(f"\n{'molecule':22} {'ok':3} {'conf':>5} {'min':>5}  read as")
    for (name, smi), it in zip(MOLECULES, items):
        stereo = "@" in smi
        hit = it.get("ok") and canon(it.get("smiles"), stereo) == canon(smi, stereo)
        good += bool(hit)
        conf = f"{it['confidence']:.2f}" if it.get("confidence") is not None else "  -"
        low = f"{it['min_confidence']:.2f}" if it.get("min_confidence") is not None else "  -"
        print(f"{name:22} {'yes' if hit else 'NO':3} {conf:>5} {low:>5}  {it.get('smiles') or it.get('error', '')}")
    print(f"\n{good} / {len(MOLECULES)} read exactly, {seconds:.1f} s for all {len(MOLECULES)} images ({seconds / len(MOLECULES):.2f} s each)")
    ok = good >= NEED
    print("PASS: the molnextr lane can be offered" if ok else f"FAIL: fewer than {NEED} exact; do not start the service with --molnextr-python yet")
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
