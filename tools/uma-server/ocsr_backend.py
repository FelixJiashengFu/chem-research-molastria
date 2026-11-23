"""Structure images -> SMILES for the MolAstria online service (job "ocsr", model "molnextr"): the pure part.

MolNexTR (Chen et al., J. Cheminform. 16, 141 (2024); github.com/CYF2000127/MolNexTR, Apache-2.0) reads a drawn
molecule and returns its graph: atoms with 2D positions, bonds, a molfile and a SMILES, and with return_confidence a
score for every atom and bond. It runs in molnextr_worker.py under its own environment (molnextr-env: it pins
timm 0.4.12, albumentations 1.1.0 and OpenNMT-py 2.2.0, which do not install next to fairchem). This module holds what
both sides need and what can be tested without torch: the limits, reading the image header (PNG or JPEG only, by
their magic bytes, never by what the request says), the summary of one prediction, the RDKit check on the service
side, and the toy predictor of server.py --fake. Nothing here imports MolNexTR or copies its code.

The limits are the same in deploy/account-worker.js (OCSR) and public/extract/ocsr-core.js (LIMITS);
tools/ocsr-test.mjs compares the three.
"""
import base64
import binascii
import hashlib
import math
import re

MODEL = "molnextr"
MAX_IMAGES = 8  # crops in one job
MAX_BYTES = 150000  # one image, decoded
MAX_TOTAL = 400000  # all images of one job, decoded
MAX_SIDE = 2000  # pixels; MolNexTR resizes every image to 384 x 384 anyway
MIN_SIDE = 16
MAX_SMILES = 400  # a longer prediction is not a drawn molecule (random weights give thousands of characters)
MAX_ATOMS = 150  # atoms MolNexTR may predict for one image before the answer counts as noise
MAX_MOLFILE = 40000
ITEM_COST = 1  # uses of the day per image (deploy/account-worker.js UMA_COST.ocsr)
B64 = re.compile(r"^[A-Za-z0-9+/]+={0,2}$")
FORMATS = ("png", "jpeg")


class OcsrError(ValueError):
    pass


def image_size(data):
    """(format, width, height) from a PNG or JPEG header; OcsrError for anything else."""
    if data[:8] == b"\x89PNG\r\n\x1a\n":
        if len(data) < 24 or data[12:16] != b"IHDR":
            raise OcsrError("a broken PNG (no IHDR chunk)")
        return "png", int.from_bytes(data[16:20], "big"), int.from_bytes(data[20:24], "big")
    if data[:3] == b"\xff\xd8\xff":
        i = 2
        while i + 9 < len(data):
            if data[i] != 0xFF:
                i += 1
                continue
            marker = data[i + 1]
            if marker in (0xD8, 0x01) or 0xD0 <= marker <= 0xD7:  # no length field
                i += 2
                continue
            length = int.from_bytes(data[i + 2:i + 4], "big")
            # SOF0-SOF15 carry the size, except DHT (C4), JPG (C8) and DAC (CC)
            if 0xC0 <= marker <= 0xCF and marker not in (0xC4, 0xC8, 0xCC):
                return "jpeg", int.from_bytes(data[i + 7:i + 9], "big"), int.from_bytes(data[i + 5:i + 7], "big")
            if length < 2:
                break
            i += 2 + length
        raise OcsrError("a JPEG without a frame header")
    raise OcsrError("only PNG and JPEG images are read")


def decode(b64):
    """One request image (base64, no data: prefix) -> (bytes, format, width, height). Checks every limit."""
    if not isinstance(b64, str) or not b64 or len(b64) > (MAX_BYTES + 2) // 3 * 4 or not B64.match(b64):
        raise OcsrError(f"each image must be base64 text of at most {MAX_BYTES} bytes once decoded")
    try:
        data = base64.b64decode(b64, validate=True)
    except (binascii.Error, ValueError):
        raise OcsrError("an image is not valid base64") from None
    if len(data) > MAX_BYTES:
        raise OcsrError(f"each image may have at most {MAX_BYTES} bytes")
    fmt, w, h = image_size(data)
    if not (MIN_SIDE <= w <= MAX_SIDE and MIN_SIDE <= h <= MAX_SIDE):
        raise OcsrError(f"each image must be {MIN_SIDE} to {MAX_SIDE} pixels on each side (this one is {w} x {h})")
    return data, fmt, w, h


def check_images(images):
    """params.images -> [(bytes, format, width, height)], or OcsrError. The total is limited too."""
    if not (isinstance(images, list) and 1 <= len(images) <= MAX_IMAGES):
        raise OcsrError(f"params.images must be a list of 1 to {MAX_IMAGES} base64 PNG or JPEG images")
    out = []
    for i, b64 in enumerate(images):
        try:
            out.append(decode(b64))
        except OcsrError as e:
            raise OcsrError(f"image {i + 1}: {e}") from None
    if sum(len(x[0]) for x in out) > MAX_TOTAL:
        raise OcsrError(f"the images of one job may have at most {MAX_TOTAL} bytes together")
    return out


def digest(decoded):
    """The cache key part for a job's images: the same pictures give the same answer."""
    h = hashlib.sha256()
    for data, *_ in decoded:
        h.update(hashlib.sha256(data).digest())
    return h.hexdigest()


def _score(v):
    try:
        x = float(v)
    except (TypeError, ValueError):
        return None
    return min(1.0, max(0.0, x)) if math.isfinite(x) else None


def summarize(pred):
    """One MolNexTR prediction (predict_images(..., return_atoms_bonds=True, return_confidence=True)) -> the item the
    service returns. confidence is the geometric mean of every atom and bond score (independent of the molecule's
    size); min_confidence is the weakest one. Neither is calibrated as a probability of being right."""
    smiles = str(pred.get("predicted_smiles") or "").strip()
    molfile = str(pred.get("predicted_molfile") or "")
    atoms = list(pred.get("atom_sets") or [])
    bonds = list(pred.get("bond_sets") or [])
    if len(atoms) > MAX_ATOMS or len(smiles) > MAX_SMILES:
        return {"ok": False, "error": f"MolNexTR predicted {len(atoms)} atoms ({len(smiles)} SMILES characters): too large for one drawn molecule",
                "n_atoms": len(atoms), "n_bonds": len(bonds)}
    scores = [s for s in (_score(a.get("confidence")) for a in atoms + bonds) if s is not None]
    conf = math.exp(sum(math.log(max(s, 1e-6)) for s in scores) / len(scores)) if scores else None
    item = {"ok": bool(smiles), "smiles": smiles, "molfile": molfile if len(molfile) <= MAX_MOLFILE else "",
            "confidence": round(conf, 4) if conf is not None else None,
            "min_confidence": round(min(scores), 4) if scores else None,
            "n_atoms": len(atoms), "n_bonds": len(bonds),
            "atoms": [{"symbol": str(a.get("atom_symbol", a.get("symbol", ""))),
                       "x": round(float((a.get("coords") or (0, 0))[0]), 3), "y": round(float((a.get("coords") or (0, 0))[1]), 3),
                       **({"confidence": round(_score(a.get("confidence")), 3)} if _score(a.get("confidence")) is not None else {})}
                      for a in atoms]}
    if not smiles:
        item["error"] = "MolNexTR gave no SMILES for this image"
    return item


def finish(item, Chem):
    """The service side: RDKit reads the predicted SMILES; canonical form, formula, whether R groups (*) remain."""
    if not item.get("ok"):
        return item
    from rdkit.Chem import rdMolDescriptors

    mol = Chem.MolFromSmiles(item["smiles"])
    if mol is None:
        item.update(valid=False, canonical="", formula="", r_groups=0)
        return item
    item.update(valid=True, canonical=Chem.MolToSmiles(mol), formula=rdMolDescriptors.CalcMolFormula(mol),
                r_groups=sum(1 for a in mol.GetAtoms() if a.GetAtomicNum() == 0))
    return item


# server.py --fake: no MolNexTR; every image is read as 4-bromoacetophenone (the sample figure's reactant 1),
# with made-up confidences, so the page and the tests can follow the whole path.
TOY_SMILES = "CC(=O)c1ccc(Br)cc1"


def toy_predict(decoded, Chem):
    mol = Chem.MolFromSmiles(TOY_SMILES)
    from rdkit.Chem import AllChem

    AllChem.Compute2DCoords(mol)
    conf = mol.GetConformer()
    xs = [conf.GetAtomPosition(i) for i in range(mol.GetNumAtoms())]
    lo_x, hi_x = min(p.x for p in xs), max(p.x for p in xs)
    lo_y, hi_y = min(p.y for p in xs), max(p.y for p in xs)
    atoms = [{"atom_number": str(i), "atom_symbol": a.GetSymbol(), "confidence": 0.97,
              "coords": ((xs[i].x - lo_x) / (hi_x - lo_x or 1), (hi_y - xs[i].y) / (hi_y - lo_y or 1))}
             for i, a in enumerate(mol.GetAtoms())]
    bonds = [{"bond_type": "single", "endpoints": (b.GetBeginAtomIdx(), b.GetEndAtomIdx()), "confidence": 0.99}
             for b in mol.GetBonds()]
    pred = {"predicted_smiles": TOY_SMILES, "predicted_molfile": Chem.MolToMolBlock(mol), "atom_sets": atoms, "bond_sets": bonds}
    return [summarize(pred) for _ in decoded]


def result(items, decoded, info):
    """The job's result: one item per image, in the order sent, with the image's format and size."""
    out = []
    for i, (item, (_, fmt, w, h)) in enumerate(zip(items, decoded)):
        out.append({"index": i, "format": fmt, "width": w, "height": h, **item})
    return {"engine": "MolNexTR", "version": info.get("version", ""), "weights": info.get("weights", ""),
            "device": info.get("device", ""), "items": out, "n_ok": sum(1 for x in out if x.get("ok") and x.get("valid", True))}
