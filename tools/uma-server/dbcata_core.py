"""DBCata lane of the MolAstria online models: everything that does not need DBCata itself (MIT, like the rest of
this folder). server.py checks requests with it; dbcata_worker.py (GPL-3.0, the only file that imports DBCata) uses
it to build the structures before DBCata and to judge and assemble the results after; the fake server runs it with a
toy engine. Nothing here imports torch, DBCata, fairchem or pymatgen, so test_dbcata.py runs it anywhere with numpy.

DBCata (Huo & Cao, Nat. Commun. 2026, doi:10.1038/s41467-026-79243-9; github.com/Songze1019/DBCata, GPL-3.0) is a
periodic Brownian-bridge diffusion model with a PaiNN network that maps an unrelaxed adsorbate-slab structure to a
near-DFT-relaxed one. It was trained on one narrow kind of system, and this lane accepts only that kind:

    MamunHighT2019 (Catalysis-Hub, BEEF-vdW): fcc binary alloys A3B / AB / AB3 (L1_2 and L1_0 orderings), 3-layer
    slabs with the bottom 2 layers fixed and 10 A of vacuum, and the 12 adsorbates H, C, CH, CH2, CH3, N, NH, O, OH,
    H2O, S, SH. The paper names (111) and (110) facets, but dbcata_domain_check.py on DBCata's own validation set
    (14,728 structures, 2026-11-22) found (111) slabs only: L1_2 (111), pure-metal A1 (111) and L1_0 (111) with c/a
    anywhere from about 0.55 to 1.3 (at c/a = 1/sqrt 2 the L1_0 cell is the B2 / bcc one, so about 1,900 of those slabs
    look like bcc(110); none has the rectangular fcc(110) cell). So this lane offers (111) only. The paper's own alloy screen (its section 2.4) used 3d / 4d / 5d transition
    metals and Al, Ga, In, Tl at ratios 0.25 / 0.5 / 0.75. We take that element list without Tc (radioactive), Hg
    (liquid at room temperature) and La (not counted as a 5d transition metal here).

How a request becomes structures (the paper's section 4.2.3, rewritten here; no CatKit or DBCata code is copied):
  * bulk: L1_2 for ratios 0.25 / 0.75 (A3B, AB3), L1_0 for 0.5 (AB), in the conventional cell. The paper took the
    optimised lattice constants from Catalysis-Hub (BEEF-vdW); we do not have those offline, so the start is Vegard's
    law over each element's fcc-equivalent lattice constant (A_FCC: (4 V)^(1/3) from the experimental volume per atom
    in ASE's reference states), and the worker then relaxes the cell with UMA's omat task (PBE, which is also the level
    of the Materials Project bulks OC20 was built on). Either way the number used is in the result.
  * slab: the conventional lattice cut along (111), in-plane cell with four atoms per layer (p(2x2) of fcc(111)),
    three atomic layers, bottom two fixed, 10 A of vacuum on each side. (FACET_CELL still knows the rectangular
    fcc(110) cut, which the tests use; the lane does not offer it.) Every distinct termination (which layer is on top) is a slab of its own.
  * sites: periodic Delaunay triangulation of the top layer: atoms (top), edge midpoints (bridge), triangle centroids
    (hollow; fcc / hcp on (111)), reduced to symmetry-distinct sites by their distances to the slab atoms. The binding
    atom is placed 1.5 A above the site, the molecule's axis along the surface normal.

After DBCata: the four chemical heuristics of the paper (atom collision below 0.8 x the sum of covalent radii,
adsorbate dissociation, desorption, surface reconstruction; the last three as AdsorbML / fairchem's
DetectTrajAnomaly define them, written here from those definitions), DMAE (the paper's eq. 16, minimum-image
distances), and the energies from UMA's oc20 task. UMA-OC20 predicts total energies (fairchem docs, "Expert adsorption
energies"), so E_ads = E(adslab) - E(clean slab, relaxed with the same model) - sum of OC20's per-atom gas references
(H -3.477, C -7.282, N -8.083, O -7.204 eV: linear combinations of H2O, H2, N2 and CO). OC20 has no reference for S,
so for S and SH only E(adslab) - E(slab) is given, which ranks the sites but is no adsorption energy.
"""
import json
import math
import time

import numpy as np

METALS_3D = ("Sc", "Ti", "V", "Cr", "Mn", "Fe", "Co", "Ni", "Cu", "Zn")
METALS_4D = ("Y", "Zr", "Nb", "Mo", "Ru", "Rh", "Pd", "Ag", "Cd")
METALS_5D = ("Hf", "Ta", "W", "Re", "Os", "Ir", "Pt", "Au")
METALS_P = ("Al", "Ga", "In", "Tl")
METALS = METALS_3D + METALS_4D + METALS_5D + METALS_P
# Elements someone may well try, and why they are not offered
LEFT_OUT = {
    "Tc": "Tc is radioactive and left out",
    "Hg": "Hg is a liquid at room temperature, so an ordered fcc alloy surface of it means little; left out",
    "La": "La is not among the 3d / 4d / 5d transition metals of the paper's screen",
}
RATIOS = (0.25, 0.5, 0.75)  # atomic fraction of metal_a
FACETS = ("111",)  # the training set has no fcc(110): see the module docstring
ADSORBATES = ("H", "C", "CH", "CH2", "CH3", "N", "NH", "O", "OH", "H2O", "S", "SH")
STEPS = (20, 50, 100)  # DBCata's sampling steps; the paper: 20 gives the same DMAE as 100 (0.0353 vs 0.0349 A)
LATTICE = ("uma", "vegard")
LAYERS, FIXED_LAYERS, VACUUM, HEIGHT = 3, 2, 10.0, 1.5
MAX_SITES = 32  # structures in one job, all terminations together
FMAX = 0.05  # eV/A, the paper's L-BFGS criterion
POLISH_STEPS, SLAB_STEPS, BULK_STEPS = 100, 300, 200
COLLISION = 0.8  # x the sum of covalent radii (the paper's section 4.2.2)
ADS_BOND = 1.25  # adsorbate-adsorbate bonds below 1.25 x the radii (ASE's 1.0 misses C-H at 1.09 A: 0.76 + 0.31)
DESORPTION, SURFACE_CUSHION = 1.5, 1.5  # AdsorbML's multipliers
LATTICE_DRIFT = 0.08  # a relaxed lattice constant further than 8 % from Vegard's is not trusted
OC20_REFS = {"H": -3.477, "C": -7.282, "N": -8.083, "O": -7.204}
ADS_ELEMENTS = ("H", "C", "N", "O", "S")
COST = {False: 3, True: 5}  # uses of the day without / with the UMA polish (account-worker.js says the same)

# fcc-equivalent lattice constant (A) = (4 V)^(1/3), V the experimental volume per atom of the element's own crystal
# (ASE's reference states; alpha-Mn 8.89^3 / 58 atoms and alpha-Ga 19.58 A^3, whose cells ASE does not list in full).
# test_dbcata.py recomputes this table from ASE.
A_FCC = {
    "Sc": 4.643, "Ti": 4.133, "V": 3.805, "Cr": 3.629, "Mn": 3.646, "Fe": 3.616, "Co": 3.542, "Ni": 3.52, "Cu": 3.61,
    "Zn": 3.926, "Y": 5.096, "Zr": 4.53, "Nb": 4.158, "Mo": 3.969, "Ru": 3.78, "Rh": 3.8, "Pd": 3.89, "Ag": 4.09,
    "Cd": 4.422, "Hf": 4.478, "Ta": 4.17, "W": 3.981, "Re": 3.889, "Os": 3.832, "Ir": 3.84, "Pt": 3.92, "Au": 4.08,
    "Al": 4.05, "Ga": 4.278, "In": 4.703, "Tl": 4.859,
}
# Covalent radii (A), Cordero et al. 2008 as in ase.data.covalent_radii
COVALENT = {
    "H": 0.31, "C": 0.76, "N": 0.71, "O": 0.66, "S": 1.05,
    "Sc": 1.7, "Ti": 1.6, "V": 1.53, "Cr": 1.39, "Mn": 1.39, "Fe": 1.32, "Co": 1.26, "Ni": 1.24, "Cu": 1.32, "Zn": 1.22,
    "Y": 1.9, "Zr": 1.75, "Nb": 1.64, "Mo": 1.54, "Ru": 1.46, "Rh": 1.42, "Pd": 1.39, "Ag": 1.45, "Cd": 1.44,
    "Hf": 1.75, "Ta": 1.7, "W": 1.62, "Re": 1.51, "Os": 1.44, "Ir": 1.41, "Pt": 1.36, "Au": 1.36,
    "Al": 1.21, "Ga": 1.22, "In": 1.42, "Tl": 1.45,
}
ATOMIC_NUMBER = {
    "H": 1, "C": 6, "N": 7, "O": 8, "S": 16, "Al": 13, "Sc": 21, "Ti": 22, "V": 23, "Cr": 24, "Mn": 25, "Fe": 26,
    "Co": 27, "Ni": 28, "Cu": 29, "Zn": 30, "Ga": 31, "Y": 39, "Zr": 40, "Nb": 41, "Mo": 42, "Ru": 44, "Rh": 45,
    "Pd": 46, "Ag": 47, "Cd": 48, "In": 49, "Hf": 72, "Ta": 73, "W": 74, "Re": 75, "Os": 76, "Ir": 77, "Pt": 78,
    "Au": 79, "Tl": 81,
}

# Adsorbates: the binding atom first, at the origin; the molecule points up (+z), away from the surface.
def _up(r, polar_deg, azimuth_deg=0.0):
    t, p = math.radians(polar_deg), math.radians(azimuth_deg)
    return (r * math.sin(t) * math.cos(p), r * math.sin(t) * math.sin(p), r * math.cos(t))


ADSORBATE_ATOMS = {
    "H": [("H", (0, 0, 0))], "C": [("C", (0, 0, 0))], "N": [("N", (0, 0, 0))], "O": [("O", (0, 0, 0))],
    "S": [("S", (0, 0, 0))],
    "CH": [("C", (0, 0, 0)), ("H", (0, 0, 1.09))],
    "NH": [("N", (0, 0, 0)), ("H", (0, 0, 1.02))],
    "OH": [("O", (0, 0, 0)), ("H", (0, 0, 0.97))],
    "SH": [("S", (0, 0, 0)), ("H", (0, 0, 1.34))],
    # H-C-H 109.5 degrees, both hydrogens up
    "CH2": [("C", (0, 0, 0)), ("H", _up(1.09, 54.75, 0)), ("H", _up(1.09, 54.75, 180))],
    # the missing fourth bond points down at the surface: each C-H 70.53 degrees from +z
    "CH3": [("C", (0, 0, 0))] + [("H", _up(1.09, 70.53, a)) for a in (0, 120, 240)],
    # bound through O, H-O-H 104.5 degrees, both hydrogens up
    "H2O": [("O", (0, 0, 0)), ("H", _up(0.97, 52.25, 0)), ("H", _up(0.97, 52.25, 180))],
}


class DomainError(ValueError):
    """A request outside what DBCata was trained on; the message says why."""


# ---- requests -------------------------------------------------------------------------------------------------------
def _metal(raw, key):
    v = raw.get(key)
    if not isinstance(v, str) or not v.strip():
        raise DomainError(f"params.{key} must be a metal symbol such as Pt")
    v = v.strip()
    v = v[:1].upper() + v[1:].lower()
    if v in METALS:
        return v
    why = LEFT_OUT.get(v) or (f"{v} is not a metal of DBCata's training domain" if len(v) <= 3 else "not an element symbol")
    raise DomainError(f"params.{key}: {why}. DBCata only knows fcc binary alloys of the 3d / 4d / 5d transition metals "
                      f"and Al, Ga, In, Tl: {', '.join(METALS)}")


def check(raw):
    """A request's params -> the canonical params (metals in alphabetical order, ratio the fraction of metal_a).
    Raises DomainError with the reason when anything is outside DBCata's training domain."""
    if not isinstance(raw, dict):
        raise DomainError("params must be an object")
    a, b = _metal(raw, "metal_a"), _metal(raw, "metal_b")
    if a == b:
        raise DomainError("params.metal_a and params.metal_b must be two different metals: DBCata was trained on binary "
                          "alloys (A3B, AB, AB3), not on pure metals")
    x = raw.get("ratio")
    ok = isinstance(x, (int, float)) and not isinstance(x, bool) and any(abs(x - r) < 1e-9 for r in RATIOS)
    if not ok:
        raise DomainError("params.ratio must be 0.25, 0.5 or 0.75 (the atomic fraction of metal_a: AB3, AB or A3B), the "
                          "three compositions DBCata was trained on")
    x = min(RATIOS, key=lambda r: abs(r - x))
    facet = str(raw.get("facet", "")).strip().strip("()")
    if facet not in FACETS:
        raise DomainError("params.facet must be 111: DBCata's training set has (111) slabs only (L1_2, L1_0 and pure "
                          "metals); it has no fcc(110)")
    ads = raw.get("adsorbate")
    hit = next((n for n in ADSORBATES if isinstance(ads, str) and n.lower() == ads.strip().lower()), None)
    if not hit:
        raise DomainError(f"params.adsorbate must be one of the 12 adsorbates DBCata was trained on: {', '.join(ADSORBATES)}")
    polish = raw.get("polish", True)
    if not isinstance(polish, bool):
        raise DomainError("params.polish must be true or false")
    steps = raw.get("steps", 20)
    if steps not in STEPS or isinstance(steps, bool):
        raise DomainError("params.steps must be 20, 50 or 100 (DBCata's sampling steps)")
    lattice = raw.get("lattice", "uma")
    if lattice not in LATTICE:
        raise DomainError("params.lattice must be uma (Vegard's estimate relaxed with UMA's omat task) or vegard")
    if a > b:  # A0.25 B0.75 is B0.75 A0.25: one canonical form, so the cache finds it either way
        a, b, x = b, a, 1.0 - x
    return {"metal_a": a, "metal_b": b, "ratio": x, "facet": facet, "adsorbate": hit, "polish": polish,
            "steps": int(steps), "lattice": lattice}


def key(params):
    """The cache key of canonical params."""
    p = params
    return f"ads:{p['metal_a']}|{p['metal_b']}|{p['ratio']:g}|{p['facet']}|{p['adsorbate']}|{p['steps']}|{p['lattice']}|{int(p['polish'])}"


def cost(params):
    return COST[bool(params.get("polish", True))]


def formula(a, b, x):
    """Pt3Ni, PtNi, PtNi3 (metal_a first)."""
    return {0.75: f"{a}3{b}", 0.5: f"{a}{b}", 0.25: f"{a}{b}3"}[x]


def counts_formula(symbols):
    """Ni3Pt9-style: elements in alphabetical order, the count after each (1 left out)."""
    c = {}
    for s in symbols:
        c[s] = c.get(s, 0) + 1
    return "".join(f"{s}{n if n > 1 else ''}" for s, n in sorted(c.items()))


def vegard(a, b, x):
    return x * A_FCC[a] + (1 - x) * A_FCC[b]


# ---- bulk and slabs -------------------------------------------------------------------------------------------------
def bulk(a, b, x, lat, c=None):
    """The conventional cell: L1_2 (A3B with B on the corners, or AB3) or L1_0 (A and B layers alternating along c)."""
    if x == 0.5:
        frac = [(0, 0, 0), (0.5, 0.5, 0), (0.5, 0, 0.5), (0, 0.5, 0.5)]
        return {"structure": "L1_0", "cell": np.diag([lat, lat, c or lat]), "frac": np.array(frac, float),
                "symbols": [a, a, b, b]}
    major, minor = (a, b) if x == 0.75 else (b, a)
    frac = [(0, 0, 0), (0, 0.5, 0.5), (0.5, 0, 0.5), (0.5, 0.5, 0)]
    return {"structure": "L1_2", "cell": np.eye(3) * lat, "frac": np.array(frac, float), "symbols": [minor] + [major] * 3}


# in-plane lattice vectors (in conventional-cell units, with how many times each is repeated); u x v points along +hkl
FACET_CELL = {"111": {"hkl": (1, 1, 1), "u": (1, -1, 0), "v": (1, 0, -1), "rep": (1, 1)},
              "110": {"hkl": (1, 1, 0), "u": (0, 0, 1), "v": (1, -1, 0), "rep": (2, 1)}}
PER_LAYER = 4


def _layers(blk, facet, periods=8):
    """Atomic layers of the bulk cut along the facet, bottom first: (height, [(symbol, frac2d)]), and the 2D cell."""
    cell, F = np.asarray(blk["cell"], float), FACET_CELL[facet]
    v1 = F["rep"][0] * (np.array(F["u"], float) @ cell)
    v2 = F["rep"][1] * (np.array(F["v"], float) @ cell)
    g = np.array(F["hkl"], float) @ np.linalg.inv(cell).T  # reciprocal vector (no 2 pi): planes 1/|g| apart
    n = g / np.linalg.norm(g)
    ex = v1 / np.linalg.norm(v1)
    ey = np.cross(n, ex)
    c2 = np.array([[v1 @ ex, v1 @ ey], [v2 @ ex, v2 @ ey]])
    if abs(c2[0, 1]) > 1e-9 or c2[1, 1] <= 0 or abs(v1 @ n) > 1e-9 or abs(v2 @ n) > 1e-9:
        raise ValueError("bad surface cell")
    inv2 = np.linalg.inv(c2)
    hmax = periods / np.linalg.norm(g)
    found = {}
    r = range(-7, 8)
    shifts = np.array([(i, j, k) for i in r for j in r for k in r], float)
    for f, s in zip(blk["frac"], blk["symbols"]):
        pos = (shifts + f) @ cell
        h = pos @ n
        keep = (h > -1e-6) & (h < hmax - 1e-6)
        for p, hh in zip(pos[keep], h[keep]):
            fr = np.array([p @ ex, p @ ey]) @ inv2
            fr = np.round(fr - np.floor(fr + 1e-7), 6) % 1.0
            found[(round(float(hh), 4), round(float(fr[0]), 4), round(float(fr[1]), 4))] = s
    heights = sorted({k[0] for k in found})
    layers = []
    for hh in heights:
        atoms = [(s, np.array(k[1:])) for k, s in found.items() if k[0] == hh]
        layers.append((hh, sorted(atoms, key=lambda t: (t[1][0], t[1][1], t[0]))))
    if any(len(at) != PER_LAYER for _, at in layers):
        raise ValueError(f"expected {PER_LAYER} atoms in every layer")
    return layers, c2


def _env(points, symbols, cell, at, cutoff):
    """Sorted (symbol, distance) of the atoms within cutoff of `at`, periodic in the surface plane."""
    out = []
    for i in (-2, -1, 0, 1, 2):
        for j in (-2, -1, 0, 1, 2):
            d = np.linalg.norm(points + i * cell[0] + j * cell[1] - at, axis=1)
            out += [(s, float(x)) for s, x in zip(symbols, d) if 1e-6 < x < cutoff]
    return sorted(out)


def _same(e1, e2, tol=0.02):
    """Two environments (lists from _env) alike within tol: equivalent atoms or sites."""
    return len(e1) == len(e2) and all(a[0] == b[0] and abs(a[1] - b[1]) < tol for a, b in zip(e1, e2))


def slabs(blk, facet):
    """Every distinct termination as a 3-layer slab: {symbols, positions, cell, tags (0 fixed, 1 top layer), fixed,
    top (composition of the top layer), composition}. Positions: bottom layer at z = VACUUM."""
    layers, c2 = _layers(blk, facet)
    out, seen = [], []
    for i in range(len(layers) - LAYERS + 1):
        win = layers[i:i + LAYERS]
        h0 = win[0][0]
        symbols, pos, tags = [], [], []
        for k, (hh, atoms) in enumerate(win):
            for s, fr in atoms:
                xy = fr @ c2
                symbols.append(s)
                pos.append((xy[0], xy[1], hh - h0 + VACUUM))
                tags.append(1 if k == LAYERS - 1 else 0)
        pos = np.array(pos)
        height = win[-1][0] - h0 + 2 * VACUUM
        cell = np.array([[c2[0, 0], c2[0, 1], 0.0], [c2[1, 0], c2[1, 1], 0.0], [0.0, 0.0, height]])
        top = [j for j, t in enumerate(tags) if t == 1]
        comp = tuple(counts_formula([s for s, _ in at]) for _, at in win)
        envs = sorted((_env(pos, symbols, cell, pos[j], 4.5) for j in top), key=lambda e: [(s, round(x, 1)) for s, x in e])
        if any(comp == c0 and all(_same(x, y) for x, y in zip(envs, e0)) for c0, e0 in seen):
            continue
        seen.append((comp, envs))
        out.append({"symbols": symbols, "positions": pos, "cell": cell, "tags": tags,
                    "fixed": [t == 0 for t in tags], "top": counts_formula([symbols[j] for j in top]),
                    "composition": counts_formula(symbols)})
        if len(out) == 4:
            break
    return out


# ---- adsorption sites -----------------------------------------------------------------------------------------------
def _circumcircle(a, b, c):
    d = 2 * (a[0] * (b[1] - c[1]) + b[0] * (c[1] - a[1]) + c[0] * (a[1] - b[1]))
    if abs(d) < 1e-9:
        return None, None
    aa, bb, cc = a @ a, b @ b, c @ c
    ux = (aa * (b[1] - c[1]) + bb * (c[1] - a[1]) + cc * (a[1] - b[1])) / d
    uy = (aa * (c[0] - b[0]) + bb * (a[0] - c[0]) + cc * (b[0] - a[0])) / d
    u = np.array([ux, uy])
    return u, float((a - u) @ (a - u))


def delaunay_periodic(points, c2):
    """Delaunay triangles of 2D points periodic in the cell c2 (rows): the points and their 8 neighbouring images,
    every triangle whose circumcircle has no point strictly inside. Co-circular points (a rectangle) give every
    triangulation, which the symmetry reduction afterwards folds together. Returns (all points, triangles)."""
    q = np.array([p + i * c2[0] + j * c2[1] for i in (-1, 0, 1) for j in (-1, 0, 1) for p in points])
    tris = []
    n = len(q)
    for i in range(n):
        for j in range(i + 1, n):
            for k in range(j + 1, n):
                u, r2 = _circumcircle(q[i], q[j], q[k])
                if u is None or r2 > (np.linalg.norm(c2[0]) + np.linalg.norm(c2[1])) ** 2:
                    continue
                d2 = np.sum((q - u) ** 2, axis=1)
                d2[[i, j, k]] = np.inf
                if np.all(d2 > r2 * (1 - 1e-6)):  # on the circle is allowed, inside is not
                    tris.append((i, j, k))
    return q, tris


def _home(xy, inv2):
    fr = xy @ inv2
    return bool(np.all(fr > -1e-6) and np.all(fr < 1 - 1e-6))


def _candidates(pos, symbols, tags, cell):
    """Every top, bridge and hollow point of the top layer (tag 1) in the home cell: [(kind, xy, elements)]. Works
    on a relaxed slab too: the second layer is the slab atoms (tag 0) within 0.6 A of the highest of them."""
    c2 = cell[:2, :2]
    inv2 = np.linalg.inv(c2)
    top = [i for i, t in enumerate(tags) if t == 1]
    under = [i for i, t in enumerate(tags) if t == 0]
    z2 = max(pos[i, 2] for i in under)
    second = [i for i in under if abs(pos[i, 2] - z2) < 0.6]
    pts = pos[top, :2]
    q, tris = delaunay_periodic(pts, c2)
    qsym = [symbols[top[m % len(top)]] for m in range(len(q))]
    cand = [("top", p.copy(), [symbols[top[m]]]) for m, p in enumerate(pts)]  # (kind, xy, elements)
    mids = []  # [midpoint, pairs, length]
    for t in tris:
        for a, b in ((t[0], t[1]), (t[1], t[2]), (t[0], t[2])):
            mid = (q[a] + q[b]) / 2
            if not _home(mid, inv2):
                continue
            hit = next((m for m in mids if np.linalg.norm(m[0] - mid) < 1e-3), None)
            pair = (min(a, b), max(a, b))
            if hit:
                if not any(np.allclose(q[x] - q[y], q[pair[0]] - q[pair[1]]) or np.allclose(q[x] - q[y], q[pair[1]] - q[pair[0]])
                           for x, y in hit[1]):
                    hit[1].append(pair)  # another edge through the same point: the two diagonals of a rectangle
            else:
                mids.append([mid, [pair], float(np.linalg.norm(q[a] - q[b]))])
    dmin = min(m[2] for m in mids)
    for mid, pairs, length in mids:
        a, b = pairs[0]
        kind = "hollow-4" if len(pairs) > 1 else ("bridge" if length < 1.25 * dmin else "long-bridge")
        els = sorted({qsym[x] for p in pairs for x in p}) if len(pairs) > 1 else sorted([qsym[a], qsym[b]])
        cand.append((kind, mid, els))
    hexagonal = _hexagonal(c2)
    for t in tris:
        cen = q[list(t)].mean(axis=0)
        if not _home(cen, inv2):
            continue
        kind = "hollow"
        if hexagonal:  # (111): a second-layer atom right below makes it an hcp hollow
            kind = "hollow-hcp" if any(_pbc2(pos[i, :2] - cen, c2) < 0.5 for i in second) else "hollow-fcc"
        cand.append((kind, cen, sorted(qsym[m] for m in t)))
    return cand


def sites(slab):
    """Symmetry-distinct adsorption sites on the top layer: {kind, xy, atoms (elements around it), multiplicity}."""
    cell = slab["cell"]
    c2 = cell[:2, :2]
    pos, symbols, tags = slab["positions"], slab["symbols"], slab["tags"]
    z_top = float(np.mean(pos[[i for i, t in enumerate(tags) if t == 1], 2]))
    cand = _candidates(pos, symbols, tags, cell)
    # one site per equivalence class: the same distances to the same elements of the slab
    out, envs = [], []
    for kind, xy, els in cand:
        e = _env(pos, symbols, cell, np.array([xy[0], xy[1], z_top + HEIGHT]), 5.5)
        k = next((m for m, (s, e0) in enumerate(zip(out, envs)) if s["kind"] == kind and _same(e, e0)), None)
        if k is not None:
            if _pbc2(xy - out[k]["xy"], c2) > 0.05:
                out[k]["multiplicity"] += 1
            continue
        out.append({"kind": kind, "xy": np.array(xy, float), "atoms": "-".join(els), "multiplicity": 1})
        envs.append(e)
    order = {"top": 0, "bridge": 1, "long-bridge": 2, "hollow-fcc": 3, "hollow-hcp": 4, "hollow": 5, "hollow-4": 6}
    out.sort(key=lambda s: (order[s["kind"]], s["atoms"]))
    return out


def _hexagonal(c2, tol=0.1):
    """(111)-like surface cell: two nearly equal vectors at 60 or 120 degrees. A relative tolerance, because an
    L1_0 cell relaxed with c != a is slightly off; the rectangular (110) cell (cos gamma = 0) is still rejected."""
    a, b = np.linalg.norm(c2[0]), np.linalg.norm(c2[1])
    return abs(a - b) / max(a, b) < tol and abs(abs(c2[0] @ c2[1]) / (a * b) - 0.5) < tol


def _pbc2(d, c2):
    inv2 = np.linalg.inv(c2)
    fr = d @ inv2
    fr -= np.round(fr)
    best = np.inf
    for i in (-1, 0, 1):
        for j in (-1, 0, 1):
            best = min(best, np.linalg.norm((fr + (i, j)) @ c2))
    return best


def place(slab, site, adsorbate):
    """The slab with the adsorbate's binding atom HEIGHT above the site; adsorbate atoms carry tag 2."""
    pos = slab["positions"]
    z_top = float(np.mean(pos[[i for i, t in enumerate(slab["tags"]) if t == 1], 2]))
    origin = np.array([site["xy"][0], site["xy"][1], z_top + HEIGHT])
    ads = ADSORBATE_ATOMS[adsorbate]
    return {"symbols": list(slab["symbols"]) + [s for s, _ in ads],
            "positions": np.vstack([pos, np.array([p for _, p in ads], float) + origin]),
            "cell": slab["cell"].copy(), "tags": list(slab["tags"]) + [2] * len(ads),
            "fixed": list(slab["fixed"]) + [False] * len(ads)}


def build(params, lat, c=None):
    """All the structures of one request: {bulk, slabs, items: [{termination, site, atoms}], truncated}."""
    p = params
    blk = bulk(p["metal_a"], p["metal_b"], p["ratio"], lat, c)
    terms = slabs(blk, p["facet"])
    items = []
    for t, slab in enumerate(terms):
        for s in sites(slab):
            items.append({"termination": t, "site": s, "atoms": place(slab, s, p["adsorbate"])})
    return {"bulk": blk, "slabs": terms, "items": items[:MAX_SITES], "truncated": len(items) > MAX_SITES}


# ---- geometry checks ------------------------------------------------------------------------------------------------
_SHIFTS = np.array([(i, j, k) for i in (-1, 0, 1) for j in (-1, 0, 1) for k in (-1, 0, 1)], float)


def distances(positions, cell):
    """All interatomic distances by the minimum-image convention, periodic along all three cell vectors (as DBCata's
    own DMAE, ASE's get_all_distances(mic=True))."""
    pos, cell = np.asarray(positions, float), np.asarray(cell, float)
    inv = np.linalg.inv(cell)
    d = pos[None, :, :] - pos[:, None, :]
    fr = d @ inv
    fr -= np.round(fr)
    best = np.full(fr.shape[:2], np.inf)
    for s in _SHIFTS:
        best = np.minimum(best, np.linalg.norm((fr + s) @ cell, axis=-1))
    return best


def dmae(pos1, pos2, cell):
    """DMAE = 1/N^2 sum_ij |d1_ij - d2_ij| (the paper's eq. 16), minimum-image distances."""
    return float(np.mean(np.abs(distances(pos1, cell) - distances(pos2, cell))))


def unwrap(positions, reference, cell):
    """Each atom moved to the periodic image closest to its reference position (for pictures: DBCata wraps
    fractional coordinates into the cell)."""
    pos, ref, cell = np.asarray(positions, float), np.asarray(reference, float), np.asarray(cell, float)
    fr = (pos - ref) @ np.linalg.inv(cell)
    return ref + (fr - np.round(fr)) @ cell


def _radii(symbols):
    return np.array([COVALENT[s] for s in symbols])


def bonded(symbols, positions, cell, mult):
    r = _radii(symbols)
    d = distances(positions, cell)
    b = d < mult * (r[:, None] + r[None, :])
    np.fill_diagonal(b, False)
    return b


def _components(adj):
    n, seen, count = len(adj), set(), 0
    for i in range(n):
        if i in seen:
            continue
        count += 1
        todo = [i]
        seen.add(i)
        while todo:
            k = todo.pop()
            for j in np.nonzero(adj[k])[0]:
                if j not in seen:
                    seen.add(int(j))
                    todo.append(int(j))
    return count


def flags(initial, positions, reference_slab=None):
    """The four chemical heuristics of the paper on a structure (initial: the input structure, with tags; positions:
    the structure to judge). reference_slab: positions of the slab atoms to compare the surface with (the relaxed
    clean slab; default the initial slab). Returns the names of the problems found, empty when none."""
    symbols, cell, tags = initial["symbols"], initial["cell"], np.array(initial["tags"])
    pos = np.asarray(positions, float)
    ads, slab = np.nonzero(tags == 2)[0], np.nonzero(tags != 2)[0]
    out = []
    r = _radii(symbols)
    d = distances(pos, cell)
    close = d < COLLISION * (r[:, None] + r[None, :])
    np.fill_diagonal(close, False)
    # adsorbate-adsorbate and adsorbate-slab pairs against covalent radii; slab-slab pairs against their own starting
    # distances, because some in-domain alloys (e.g. NiTa) already sit below 0.8 x the radii sum in the ideal lattice
    d0 = distances(np.asarray(initial["positions"], float), cell)
    ssx = np.ix_(slab, slab)
    squeezed = (d[ssx] < COLLISION * d0[ssx]) & ~np.eye(len(slab), dtype=bool)
    if close[ads].any() or squeezed.any():
        out.append("collision")
    sa = [symbols[i] for i in ads]
    if len(ads) > 1:
        before = _components(bonded(sa, initial["positions"][ads], cell, ADS_BOND))
        if _components(bonded(sa, pos[ads], cell, ADS_BOND)) > before:
            out.append("dissociated")
    touch = d[np.ix_(ads, slab)] < DESORPTION * (r[ads][:, None] + r[slab][None, :])
    if not touch.any():
        out.append("desorbed")
    ss = [symbols[i] for i in slab]
    ref = initial["positions"][slab] if reference_slab is None else np.asarray(reference_slab, float)
    # a bond is a pair within the covalent sum, but never less than the reference slab's own first shell (on about a
    # fifth of the alloys no metal-metal pair is within 1.0 x the covalent sum, which would make the test blind);
    # the 1.5 x cushion stays on the plain covalent sum so a lifted surface atom is still caught
    rs = _radii(ss)
    cov = rs[:, None] + rs[None, :]
    dr = distances(ref, cell); np.fill_diagonal(dr, np.inf)
    dn = distances(pos[slab], cell); np.fill_diagonal(dn, np.inf)
    base = np.maximum(cov, 1.1 * dr.min())
    now, now_c = dn < base, dn < SURFACE_CUSHION * cov
    was, was_c = dr < base, dr < SURFACE_CUSHION * cov
    if (now & ~was_c).any() or (was & ~now_c).any():
        out.append("reconstructed")
    return out


LANDING_BOND = 1.3  # the binding atom touches the surface: some top-layer atom within 1.3 x the sum of covalent radii
SAME_XYZ, SAME_EV = 0.2, 0.01  # two sites ended at one place: binding atoms within 0.2 A, or the same kind of site, and energies within 0.01 eV


def landing(atoms, positions):
    """Where the adsorbate's binding atom ended up: {kind, atoms}, named like the starting sites (top, bridge,
    hollow-fcc, ...), or kind "none" when no top-layer atom is within LANDING_BOND x the covalent sum. The kind is
    that of the top, bridge or hollow point of the final top layer nearest to the binding atom in the surface plane,
    so neither the height nor unequal bond lengths (a short Ni-O and a long Pt-O) change it. DBCata and the polish
    can move an adsorbate away from the site it started on, so the result says both."""
    symbols, tags, cell = atoms["symbols"], atoms["tags"], np.asarray(atoms["cell"], float)
    pos = np.asarray(positions, float)
    b = next(i for i, t in enumerate(tags) if t == 2)
    top = [i for i, t in enumerate(tags) if t == 1]
    d = distances(pos, cell)[b]
    if all(d[i] >= LANDING_BOND * (COVALENT[symbols[b]] + COVALENT[symbols[i]]) for i in top):
        return {"kind": "none", "atoms": ""}
    c2 = cell[:2, :2]
    kind, _, els = min(_candidates(pos, symbols, tags, cell), key=lambda c: _pbc2(c[1] - pos[b, :2], c2))
    return {"kind": kind, "atoms": "-".join(els)}


def same_place(items):
    """items: [{termination, position (of the binding atom), energy, cell, landing, ok}] -> for each, the index of
    the item that leads the group of items that ended at the same place, or None for a leader. Same place: same
    termination, energies within SAME_EV, and either binding atoms within SAME_XYZ by the minimum image or the same
    landing (kind and atoms; an equivalent copy of one hollow sits several A from the copy another site went to).
    The leader is the group's first ok item (its first item when none is ok), so a reliable row is never shown as
    a copy of a flagged one."""
    def same(x, y):
        if x["termination"] != y["termination"] or abs(x["energy"] - y["energy"]) >= SAME_EV:
            return False
        if distances(np.array([x["position"], y["position"]]), x["cell"])[0, 1] < SAME_XYZ:
            return True
        return x["landing"]["kind"] != "none" and x["landing"] == y["landing"]

    groups = []
    for j, it in enumerate(items):
        g = next((g for g in groups if same(items[g[0]], it)), None)
        if g is None:
            groups.append([j])
        else:
            g.append(j)
    out = [None] * len(items)
    for g in groups:
        lead = next((k for k in g if items[k].get("ok", True)), g[0])
        for k in g:
            out[k] = None if k == lead else lead
    return out


def uma_setting(names, have_triton):
    """fairchem's inference preset: "default" with Triton (it compiles); without (Windows) "batch" (no compile, full
    precision), as server.py, but fairchem 2.13 (DBCata's environment) has only "default" and "turbo", and its
    "default" does not compile, so that one. names: the presets this fairchem has (None: not known)."""
    if have_triton:
        return "default"
    if names is None or "batch" in names:
        return "batch"
    return "default"


def adsorption_energy(e_adslab, e_slab, adsorbate):
    """E(adslab) - E(slab) - sum of OC20's gas references, or None when OC20 has no reference (S)."""
    els = [s for s, _ in ADSORBATE_ATOMS[adsorbate]]
    if any(s not in OC20_REFS for s in els):
        return None
    return e_adslab - e_slab - sum(OC20_REFS[s] for s in els)


# ---- output ---------------------------------------------------------------------------------------------------------
def extxyz(symbols, positions, cell, **info):
    """One extended-XYZ frame (ASE reads the lattice; plain XYZ readers take the second line as a comment)."""
    lat = " ".join(f"{x:.6f}" for x in np.asarray(cell, float).reshape(-1))
    extra = "".join(f" {k}={json.dumps(v) if isinstance(v, str) else v}" for k, v in info.items() if v is not None)
    rows = "".join(f"{s} {x:.6f} {y:.6f} {z:.6f}\n" for s, (x, y, z) in zip(symbols, np.asarray(positions, float)))
    return f'{len(symbols)}\nLattice="{lat}" Properties=species:S:1:pos:R:3 pbc="T T T"{extra}\n{rows}'


def _r(x, d=4):
    return None if x is None or not math.isfinite(x) else round(float(x), d)


def run(params, engine, progress=None, limit=0.0):
    """One request from start to end with an engine that provides lattice(), generate(), confidence(), energy() and
    relax() (dbcata_worker.py: DBCata and UMA; ToyEngine: made-up numbers for tests). Returns the result."""
    t0 = time.time()

    def step(done, total, note):
        if limit and time.time() - t0 > limit:
            raise TimeoutError(f"the job took longer than its time limit of {limit:g} s")
        if progress:
            progress({"done": int(done), "total": int(total), "note": note})

    p = params
    a0 = vegard(p["metal_a"], p["metal_b"], p["ratio"])
    lat = {"a_vegard": round(a0, 4), "a": round(a0, 4), "c": None, "method": "vegard", "note": None}
    if p["lattice"] == "uma":
        step(0, 1, "bulk lattice")
        blk0 = bulk(p["metal_a"], p["metal_b"], p["ratio"], a0)
        try:
            a, c = engine.lattice(blk0)
            if abs(a / a0 - 1) > LATTICE_DRIFT or (c and abs(c / a0 - 1) > LATTICE_DRIFT):
                lat["note"] = f"the UMA-relaxed cell (a = {a:.3f} A) moved more than {LATTICE_DRIFT:.0%} from Vegard's estimate; Vegard's is used"
            else:
                lat.update(a=round(float(a), 4), c=round(float(c), 4) if c and p["ratio"] == 0.5 else None, method="uma-omat")
        except Exception as e:  # noqa: BLE001 - the estimate still makes a structure
            lat["note"] = f"the bulk relaxation failed ({type(e).__name__}); Vegard's estimate is used"
    built = build(p, lat["a"], lat["c"])
    items, terms = built["items"], built["slabs"]
    n = len(items)
    step(0, n, "DBCata")
    gen = engine.generate([it["atoms"] for it in items], p["steps"])
    conf = engine.confidence([it["atoms"] for it in items], gen)
    slab_out = []
    for t, slab in enumerate(terms):
        step(0, n, f"clean slab {t + 1}/{len(terms)}")
        r = engine.relax(slab, FMAX, SLAB_STEPS)
        slab_out.append({"termination": t, "top": slab["top"], "composition": slab["composition"],
                         "energy_ev": _r(r["energy"], 5), "steps": r["steps"], "converged": r["converged"],
                         "positions": r["positions"],
                         "xyz": extxyz(slab["symbols"], r["positions"], slab["cell"], energy=_r(r["energy"], 5))})
    sites_out, ends = [], []
    for i, it in enumerate(items):
        step(i, n, f"UMA {i + 1}/{n}")
        at, g = it["atoms"], unwrap(gen[i], it["atoms"]["positions"], it["atoms"]["cell"])
        ref_slab = slab_out[it["termination"]]["positions"]
        e_sp = engine.energy(at, g)
        site = {"id": i, "termination": it["termination"], "kind": it["site"]["kind"], "atoms": it["site"]["atoms"],
                "multiplicity": it["site"]["multiplicity"], "xy": [round(float(v), 4) for v in it["site"]["xy"]],
                "dmae_init_gen": _r(dmae(at["positions"], g, at["cell"])), "flags": flags(at, g, ref_slab),
                "confidence": _r(conf[i], 3) if conf is not None else None, "energy_sp_ev": _r(e_sp, 5)}
        frames = [extxyz(at["symbols"], at["positions"], at["cell"], frame="initial"),
                  extxyz(at["symbols"], g, at["cell"], frame="DBCata", energy=_r(e_sp, 5))]
        e_final, fin = e_sp, g
        if p["polish"]:
            r = engine.relax(dict(at, positions=g), FMAX, POLISH_STEPS)
            fin = unwrap(r["positions"], g, at["cell"])
            e_final = r["energy"]
            site.update(dmae_gen_final=_r(dmae(g, fin, at["cell"])), flags_polished=flags(at, fin, ref_slab),
                        steps=r["steps"], converged=r["converged"])
            frames.append(extxyz(at["symbols"], fin, at["cell"], frame="DBCata+UMA", energy=_r(e_final, 5)))
        e_slab = slab_out[it["termination"]]["energy_ev"]
        b = next(k for k, t in enumerate(at["tags"]) if t == 2)
        site["landing"] = landing(at, fin)
        ends.append({"termination": it["termination"], "position": np.asarray(fin, float)[b], "energy": float(e_final),
                     "cell": at["cell"], "landing": site["landing"]})
        site.update(energy_ev=_r(e_final, 5), e_bind_raw_ev=_r(e_final - e_slab),
                    e_ads_ev=_r(adsorption_energy(e_final, e_slab, p["adsorbate"])), xyz="".join(frames))
        site["ok"] = not site["flags"] and not site.get("flags_polished") and (site["confidence"] is None or site["confidence"] >= 0.5)
        ends[-1]["ok"] = site["ok"]
        sites_out.append(site)
    step(n, n, "done")
    for s, k in zip(sites_out, same_place(ends)):
        s["same_as"] = sites_out[k]["id"] if k is not None else None
    pool = [s for s in sites_out if s["ok"]] or sites_out
    best = min(pool, key=lambda s: s["e_bind_raw_ev"]) if pool else None
    for s in sites_out:
        s["rel_ev"] = _r(s["e_bind_raw_ev"] - best["e_bind_raw_ev"]) if best else None
    for s in slab_out:
        del s["positions"]
    refs = all(e in OC20_REFS for e, _ in ADSORBATE_ATOMS[p["adsorbate"]])
    return {
        "system": {"metal_a": p["metal_a"], "metal_b": p["metal_b"], "ratio": p["ratio"], "facet": p["facet"],
                   "adsorbate": p["adsorbate"], "formula": formula(p["metal_a"], p["metal_b"], p["ratio"]),
                   "structure": built["bulk"]["structure"]},
        "lattice": lat, "slabs": slab_out, "sites": sites_out, "truncated": built["truncated"],
        "distinct": sum(1 for s in sites_out if s["same_as"] is None),
        "best": best["id"] if best else None, "best_ok": bool(best and best["ok"]),
        "reference": {"scheme": "oc20", "available": refs, "refs_ev": {k: OC20_REFS[k] for k in sorted({e for e, _ in ADSORBATE_ATOMS[p['adsorbate']]}) if k in OC20_REFS},
                      "note": None if refs else "OC20 has no gas-phase reference for S: e_ads_ev is null, e_bind_raw_ev = E(adslab) - E(slab) ranks the sites"},
        "engine": engine.info(),
    }


class ToyEngine:
    """Made-up numbers in the shape of the real ones, for the fake server and the tests: 'generation' lifts the
    adsorbate to 1.9 A above its site and wiggles the top layer, the 'energy' is a sum of Morse-like pair terms."""

    def info(self):
        return {"dbcata": "toy", "checkpoint": None, "classifier": None, "uma": None, "task": "oc20", "device": "none"}

    def lattice(self, blk):
        a = float(blk["cell"][0, 0]) * 1.01
        return a, (a if blk["structure"] == "L1_0" else None)

    def generate(self, structures, steps):
        out = []
        for s in structures:
            pos = np.array(s["positions"], float)
            tags = np.array(s["tags"])
            ads, top = tags == 2, tags == 1
            pos[ads, 2] += 0.4
            pos[top, 2] += 0.02
            out.append(pos)
        return out

    def confidence(self, structures, generated):
        return [max(0.0, 1.0 - 4 * dmae(s["positions"], g, s["cell"])) for s, g in zip(structures, generated)]

    def energy(self, atoms, positions):
        symbols = atoms["symbols"]
        d = distances(positions, atoms["cell"])
        r = _radii(symbols)
        r0 = r[:, None] + r[None, :]
        e = np.where(d > 0, (1 - np.exp(-(d - r0))) ** 2 - 1, 0.0)
        return float(np.sum(np.triu(e, 1)))

    def relax(self, atoms, fmax, steps):
        pos = np.array(atoms["positions"], float)
        return {"positions": pos, "energy": self.energy(atoms, pos), "steps": 0, "converged": True}
