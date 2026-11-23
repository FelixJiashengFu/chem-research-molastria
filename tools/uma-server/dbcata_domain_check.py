"""Compare the DBCata lane's domain and structure building (dbcata_core.py) with DBCata's own data.

Run it on the site owner's computer, in DBCata's environment (the .pkl files are pickled torch_geometric Data
objects, so torch and torch_geometric must import), on the split downloaded from Figshare:

    D:\\ChemDraw\\DBCata\\.venv\\Scripts\\python.exe -X utf8 tools\\uma-server\\dbcata_domain_check.py D:\\ChemDraw\\DBCata\\data\\cathub\\val.pkl

It imports nothing from DBCata (MIT, like the rest of this folder) and only reads the file you give it (a pickle: give
it DBCata's own data, nothing from elsewhere). It prints what the data holds and how dbcata_core compares, and exits 1
when the data has something the lane would get wrong: an adsorbate outside ADSORBATES, a slab that is not
LAYERS x PER_LAYER atoms with FIXED_LAYERS x PER_LAYER fixed, or a metal outside METALS. The lattice constants, the
vacuum and the starting height of the adsorbate are reported, not judged: those are what to compare by eye
(dbcata_core builds from Vegard's law relaxed with UMA, the data from Catalysis-Hub's BEEF-vdW lattices).
"""
import collections
import json
import os
import pickle
import statistics
import sys

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import dbcata_core as core  # noqa: E402

SYMBOL = {z: s for s, z in core.ATOMIC_NUMBER.items()}


def arr(x):
    return np.asarray(x.detach().cpu().numpy() if hasattr(x, "detach") else x)


def adsorbate_name(symbols):
    """H2O, CH3, OH ... as dbcata_core names them (the heavy atom first)."""
    c = collections.Counter(symbols)
    heavy = [s for s in ("C", "N", "O", "S") if c.get(s)]
    if not heavy:
        return "H" * c.get("H", 0) if c.get("H", 0) > 1 else ("H" if c.get("H") else "")
    name = "".join(f"{s}{c[s] if c[s] > 1 else ''}" for s in heavy)
    h = c.get("H", 0)
    if name == "O" and h == 2:
        return "H2O"
    return name + ("H" + (str(h) if h > 1 else "") if h else "")


def one(d):
    z = arr(d.atomic_numbers).astype(int).reshape(-1)
    symbols = [SYMBOL.get(int(x), f"Z{int(x)}") for x in z]
    pos = arr(d.pos).reshape(-1, 3).astype(float)
    cell = arr(d.cell).reshape(3, 3).astype(float)
    fixed = arr(d.fixed).reshape(-1).astype(bool) if hasattr(d, "fixed") else np.zeros(len(z), bool)
    ads = np.array([s in core.ADS_ELEMENTS for s in symbols])
    slab = ~ads
    metals = sorted(set(np.array(symbols)[slab]))
    counts = collections.Counter(np.array(symbols)[slab])
    out = {"n": len(z), "n_slab": int(slab.sum()), "n_fixed": int(fixed.sum()), "fixed_slab_only": bool(not (fixed & ads).any()),
           "adsorbate": adsorbate_name([s for s, a in zip(symbols, ads) if a]), "metals": metals,
           "composition": dict(counts)}
    # in-plane cell: |a|, |b| and the angle say which facet (p(2x2) fcc(111): equal, 60 or 120 degrees)
    la, lb = np.linalg.norm(cell[0]), np.linalg.norm(cell[1])
    ang = float(np.degrees(np.arccos(np.clip(cell[0] @ cell[1] / (la * lb), -1, 1))))
    out["facet"] = "111" if abs(la - lb) < 0.05 * la and min(abs(ang - 60), abs(ang - 120)) < 3 else (
        "110" if abs(ang - 90) < 3 else f"? a={la:.2f} b={lb:.2f} gamma={ang:.0f}")
    # nearest-neighbour distance in the slab -> fcc-equivalent lattice constant a = sqrt(2) d
    sp = pos[slab]
    dist = core.distances(sp, cell)
    np.fill_diagonal(dist, np.inf)
    out["a_nn"] = float(np.median(dist.min(axis=1)) * np.sqrt(2))
    if len(metals) == 2 and out["n_slab"]:
        x = counts[metals[0]] / out["n_slab"]
        out["ratio"] = round(x, 3)
        if all(m in core.A_FCC for m in metals):  # from the slab's composition: a termination need not be the bulk's
            out["a_vegard"] = core.vegard(metals[0], metals[1], x)
    zs = sp[:, 2]
    out["thickness"] = float(zs.max() - zs.min())
    out["c"] = float(np.linalg.norm(cell[2]))
    if ads.any():
        top = float(zs.max())
        pa = pos[ads]
        lowest = int(np.argmin(pa[:, 2]))
        out["height"] = float(pa[lowest, 2] - top)  # binding atom above the top layer, in the initial structure
        dd = np.linalg.norm(((pa[lowest] - sp) @ np.linalg.inv(cell) - np.round((pa[lowest] - sp) @ np.linalg.inv(cell))) @ cell, axis=1)
        out["contact"] = float(dd.min())
    return out


def summary(rows):
    def dist(key):
        v = [r[key] for r in rows if key in r]
        if not v:
            return None
        return {"min": round(min(v), 3), "median": round(statistics.median(v), 3), "max": round(max(v), 3)}

    ads = collections.Counter(r["adsorbate"] for r in rows)
    metals = collections.Counter(m for r in rows for m in r["metals"])
    drift = [abs(r["a_nn"] - r["a_vegard"]) / r["a_vegard"] for r in rows if "a_vegard" in r]
    return {"structures": len(rows),
            "slab_atoms": dict(collections.Counter(r["n_slab"] for r in rows)),
            "fixed_atoms": dict(collections.Counter(r["n_fixed"] for r in rows)),
            "fixed_adsorbate_atoms": sum(1 for r in rows if not r["fixed_slab_only"]),
            "facets": dict(collections.Counter(r["facet"] for r in rows)),
            "ratios": dict(collections.Counter(r.get("ratio") for r in rows)),
            "n_metals": dict(collections.Counter(len(r["metals"]) for r in rows)),
            "adsorbates": dict(ads), "metals": dict(metals),
            "a_nn": dist("a_nn"), "vegard_relative_difference": ({"median": round(statistics.median(drift), 4),
                                                                   "max": round(max(drift), 4)} if drift else None),
            "thickness": dist("thickness"), "c": dist("c"), "vacuum": dist("vacuum"),
            "initial_height": dist("height"), "initial_contact": dist("contact")}


def main():
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    with open(sys.argv[1], "rb") as f:
        data = pickle.load(f)
    rows = [one(d) for d in data]
    for r in rows:
        r["vacuum"] = r["c"] - r["thickness"]
    s = summary(rows)
    print(json.dumps(s, indent=1, default=str))
    problems = []
    outside = sorted(set(s["adsorbates"]) - set(core.ADSORBATES))
    if outside:
        problems.append(f"adsorbates the lane does not offer: {outside}")
    missing = sorted(set(core.ADSORBATES) - set(s["adsorbates"]))
    if missing:
        problems.append(f"adsorbates the lane offers but the data lacks: {missing}")
    want_slab, want_fixed = core.LAYERS * core.PER_LAYER, core.FIXED_LAYERS * core.PER_LAYER
    if set(s["slab_atoms"]) != {want_slab}:
        problems.append(f"slab sizes {s['slab_atoms']}, the lane builds {want_slab}")
    if set(s["fixed_atoms"]) != {want_fixed}:
        problems.append(f"fixed atoms {s['fixed_atoms']}, the lane fixes {want_fixed}")
    if s["fixed_adsorbate_atoms"]:
        problems.append(f"{s['fixed_adsorbate_atoms']} structures fix adsorbate atoms")
    odd = sorted(set(s["metals"]) - set(core.METALS))
    if odd:
        print(f"note: metals in the data the lane leaves out: {odd} (dbcata_core.LEFT_OUT says why, or add them)")
    unused = sorted(set(core.METALS) - set(s["metals"]))
    if unused:
        problems.append(f"metals the lane offers but the data never has: {unused}")
    print(f"dbcata_core: slab {want_slab} atoms ({want_fixed} fixed), vacuum {core.VACUUM} A on each side "
          f"(c - thickness = {2 * core.VACUUM} A), binding atom {core.HEIGHT} A above the top layer")
    for p in problems:
        print("PROBLEM: " + p)
    sys.exit(1 if problems else 0)


if __name__ == "__main__":
    main()
