"""MolAstria cloud batch, part 2: MACE-OFF23 as an independent check on the UMA neutral geometries.

MACE-OFF23 (Kovacs et al., trained on SPICE at wB97M-D3(BJ)/def2-TZVPPD) is a different architecture trained on
different data from UMA, but it only covers neutral molecules made of H C N O F P S Cl Br I. For every neutral
geometry that batch_uma.py wrote it reports
    mace_rmsd    heavy-atom RMSD (A) after MACE relaxes that geometry, aligned with the Kabsch algorithm
    mace_erelax  how much energy MACE gains by relaxing it (eV): small when both models put the minimum in the
                 same place; stiff bond stretches cost little energy, a different structure costs a lot
    mace_fmax    the largest MACE force on the UMA geometry (eV/A), for reference only: stiff bonds make it large
                 even for tiny bond-length differences
and writes out/results.csv: uma_results.csv plus these columns, ready to drop into the AI Lab, which turns large
values into a reliability flag.

    python batch_mace.py out/ [--model medium] [--device auto|cuda|cpu]

Runs in its own environment: mace-torch pins e3nn 0.4.4 and fairchem needs e3nn >= 0.5. MACE-OFF23 is released
under the Academic Software License (non-commercial use); check its terms before using it in a paid service.
"""
import argparse
import csv
import os
import sys
import time

import numpy as np

MACE_ELEMENTS = {"H", "C", "N", "O", "F", "P", "S", "Cl", "Br", "I"}


def kabsch_rmsd(a, b):
    """RMSD between two matched point sets after the best rotation and translation."""
    a = a - a.mean(axis=0)
    b = b - b.mean(axis=0)
    u, _, vt = np.linalg.svd(a.T @ b)
    d = np.sign(np.linalg.det(u @ vt))
    r = u @ np.diag([1.0, 1.0, d]) @ vt
    return float(np.sqrt(((a @ r - b) ** 2).sum(axis=1).mean()))


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("out")
    ap.add_argument("--model", default="medium", choices=["small", "medium", "large"])
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    args = ap.parse_args()

    with open(os.path.join(args.out, "uma_results.csv"), encoding="utf-8", newline="") as f:
        rows = list(csv.DictReader(f))
    index_path = os.path.join(args.out, "geom", "index.csv")
    geoms = {}
    if os.path.exists(index_path):
        with open(index_path, encoding="utf-8", newline="") as f:
            geoms = {r["smiles"]: os.path.join(args.out, "geom", r["file"]) for r in csv.DictReader(f)}

    import torch
    from ase.io import read
    from ase.optimize import LBFGS
    from mace.calculators import mace_off

    device = "cuda" if args.device in ("auto", "cuda") and torch.cuda.is_available() else "cpu"
    t = time.time()
    calc = mace_off(model=args.model, device=device, default_dtype="float64")
    print(f"MACE-OFF23 {args.model} ready on {device} in {time.time() - t:.0f} s", flush=True)

    for n, row in enumerate(rows, 1):
        row.setdefault("note", "")
        path = geoms.get(row["smiles"])
        if not path or not os.path.exists(path):
            continue
        atoms = read(path, format="extxyz")
        symbols = set(atoms.get_chemical_symbols())
        outside = sorted(symbols - MACE_ELEMENTS)
        if outside:
            row["note"] = "; ".join(x for x in (row["note"], f"mace: elements outside MACE-OFF23 ({' '.join(outside)})") if x)
            continue
        t = time.time()
        try:
            atoms.calc = calc
            row["mace_fmax"] = round(float(np.linalg.norm(atoms.get_forces(), axis=1).max()), 4)
            e_start = atoms.get_potential_energy()
            start = atoms.get_positions().copy()
            LBFGS(atoms, logfile=None).run(fmax=0.02, steps=500)
            row["mace_erelax"] = round(float(e_start - atoms.get_potential_energy()), 4)
            heavy = np.array([s != "H" for s in atoms.get_chemical_symbols()])
            if heavy.sum() < 3:
                heavy[:] = True
            row["mace_rmsd"] = round(kabsch_rmsd(start[heavy], atoms.get_positions()[heavy]), 4)
        except Exception as e:  # noqa: BLE001
            row["note"] = "; ".join(x for x in (row["note"], f"mace: {type(e).__name__}: {e}"[:200]) if x)
        print(f"[{n}/{len(rows)}] {row['name']}: MACE RMSD {row.get('mace_rmsd', '-')} A, "
              f"relaxation {row.get('mace_erelax', '-')} eV, fmax {row.get('mace_fmax', '-')} eV/A ({time.time() - t:.1f} s)", flush=True)

    fields = list(rows[0].keys()) if rows else []
    for extra in ("mace_rmsd", "mace_erelax", "mace_fmax", "note"):
        if extra not in fields:
            fields.append(extra)
    out = os.path.join(args.out, "results.csv")
    with open(out, "w", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=fields)
        w.writeheader()
        w.writerows(rows)
    checked = sum(1 for r in rows if r.get("mace_rmsd") not in (None, ""))
    print(f"Wrote {out}: {len(rows)} molecules, {checked} checked with MACE-OFF23", flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
