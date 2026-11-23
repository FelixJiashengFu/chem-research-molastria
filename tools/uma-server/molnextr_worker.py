"""MolNexTR for the MolAstria online service, in its own environment: structure images -> SMILES and molfile.

MolNexTR (Yufan Chen et al., github.com/CYF2000127/MolNexTR, Apache License 2.0) pins timm 0.4.12, albumentations
1.1.0 and OpenNMT-py 2.2.0, which cannot share an environment with fairchem, so it gets its own (molnextr-env), like
MACE and AIMNet2. server.py starts this script with that environment's Python (--molnextr-python) and talks to it over
stdin/stdout, one JSON object per line; nothing else reaches it. The package is installed from its GitHub repository
at a fixed commit and called as a library; none of its code is copied here (docs/RUNBOOK.md, THIRD-PARTY-molnextr.md).

The weights (molnextr_best.pth, from the authors' Hugging Face dataset CYF200127/MolNexTR or Zenodo 13304899) are read
from MOLASTRIA_MOLNEXTR_WEIGHTS, else from MolNexTR's own pystow folder (~/.data/molnextr/molnextr_best.pth). This
script never downloads anything: molnextr_selftest.py --download fetches them once, by hand.

    {"op": "ping"}                     -> {"ok": true, "version", "device", "gpu", "weights", "weights_mb"}
    {"op": "ocsr", "images": [base64]} -> {"ok": true, "items": [one ocsr_backend.summarize() item per image]}

Images are checked again here (ocsr_backend.decode: PNG or JPEG by magic bytes, size limits) before OpenCV reads them.
"""
import json
import os
import sys
import time
import warnings

PROTOCOL = sys.stdout
sys.stdout = sys.stderr  # library prints (MolNexTR prints chiral centres) go to the service console, never into the protocol
warnings.filterwarnings("ignore")
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import ocsr_backend as ob  # noqa: E402


def version():
    try:
        from importlib.metadata import version as v

        return v("MolNexTR")
    except Exception:  # noqa: BLE001
        return ""


def weights_path():
    given = os.environ.get("MOLASTRIA_MOLNEXTR_WEIGHTS", "").strip()
    if given:
        return given
    return os.path.join(os.path.expanduser("~"), ".data", "molnextr", "molnextr_best.pth")


def to_rgb(data):
    """PNG / JPEG bytes -> an RGB array as MolNexTR's own predict_image_files makes it (cv2, BGR -> RGB)."""
    import cv2
    import numpy as np

    img = cv2.imdecode(np.frombuffer(data, np.uint8), cv2.IMREAD_COLOR)
    if img is None:
        raise ob.OcsrError("OpenCV cannot read this image")
    return cv2.cvtColor(img, cv2.COLOR_BGR2RGB)


def main():
    import torch
    from MolNexTR.model import molnextr

    device = os.environ.get("MOLASTRIA_MOLNEXTR_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
    gpu = torch.cuda.get_device_name(0) if device == "cuda" else ""
    path = weights_path()
    if not os.path.exists(path):
        raise SystemExit(f"MolNexTR weights not found at {path}: run molnextr_selftest.py --download, or set MOLASTRIA_MOLNEXTR_WEIGHTS")
    t = time.time()
    model = molnextr(path, torch.device(device))
    print(f"MolNexTR worker: loaded {os.path.basename(path)} on {device} in {time.time() - t:.1f} s", flush=True)
    info = {"version": version(), "device": device, "gpu": gpu, "weights": os.path.basename(path),
            "weights_mb": round(os.path.getsize(path) / 1e6, 1)}

    def handle(req):
        op = req.get("op")
        if op == "ping":
            return {"ok": True, **info}
        if op == "ocsr":
            images = req.get("images")
            if not (isinstance(images, list) and 1 <= len(images) <= ob.MAX_IMAGES):
                raise ValueError(f"images must be a list of 1 to {ob.MAX_IMAGES} base64 images")
            items, arrays, where = [None] * len(images), [], []
            for i, b64 in enumerate(images):
                try:
                    data, *_ = ob.decode(b64)
                    arrays.append(to_rgb(data))
                    where.append(i)
                except ob.OcsrError as e:
                    items[i] = {"ok": False, "error": str(e)}
            if arrays:
                with torch.no_grad():
                    preds = model.predict_images(arrays, return_atoms_bonds=True, return_confidence=True, batch_size=len(arrays))
                for i, pred in zip(where, preds):
                    items[i] = ob.summarize(pred)
            return {"ok": True, "items": items}
        raise ValueError(f"unknown op {op}")

    for line in sys.stdin:
        line = line.strip()
        if not line:
            continue
        try:
            reply = handle(json.loads(line))
        except Exception as e:  # noqa: BLE001 - reported to the service, which reports it to the visitor
            reply = {"ok": False, "error": f"{type(e).__name__}: {e}"[:300]}
        PROTOCOL.write(json.dumps(reply) + "\n")
        PROTOCOL.flush()


if __name__ == "__main__":
    main()
