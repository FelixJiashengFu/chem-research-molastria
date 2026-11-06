"""MolAstria cloud batch, part 1: UMA IP / EA for every molecule in a CSV, in the AI Lab's import format.

Same definitions as the desktop runner (desktop/src-tauri/uma/runner.py, job "ipea") and the scripts the
Meta page writes, so the three give the same numbers: RDKit ETKDG (seed 42) + MMFF clean-up, each charge state
relaxed with UMA-S (LBFGS, fmax 0.02 eV/A), adiabatic IP = E(+1) - E(0) and EA = E(0) - E(-1) in eV, then UMA-M
single points on the UMA-S geometries for the AI Lab's model-disagreement rule.

    python batch_uma.py input.csv out/ [--device auto|cuda|cpu] [--no-m] [--limit N]

input.csv needs a smiles (or SMILES) column; a name or label column is used for file names. That is what the AI
Lab's candidate export and its results template contain. Writes
    out/uma_results.csv      one row per molecule; finished rows survive a crash and are skipped on a rerun
    out/geom/*.xyz           the relaxed neutral UMA-S geometries, listed in out/geom/index.csv, for batch_mace.py
Needs fairchem-core and rdkit, and a Hugging Face login with access to facebook/UMA.
"""
import argparse
import csv
import os
import re
import sys
import time

FIELDS = ["smiles", "name", "ip_uma_s", "ea_uma_s", "ip_uma_m", "ea_uma_m", "uma_seconds", "note"]


def read_molecules(path):
    with open(path, encoding="utf-8-sig", newline="") as f:
        rows = list(csv.DictReader(f))
    if not rows:
        sys.exit(f"{path}: no rows")
    key = next((k for k in rows[0] if k and k.strip().lower() in ("smiles", "canonical_smiles")), None)
    if not key:
        sys.exit(f"{path}: needs a smiles column (found: {', '.join(rows[0])})")
    name_key = next((k for k in rows[0] if k and k.strip().lower() in ("name", "label")), None)
    seen, out = set(), []
    for r in rows:
        smi = (r.get(key) or "").strip()
        if smi and smi not in seen:
            seen.add(smi)
            out.append((smi, ((r.get(name_key) or "").strip() if name_key else "") or f"mol{len(out) + 1}"))
    return out


def safe(name):
    return re.sub(r"[^A-Za-z0-9_.-]", "_", name)[:40] or "molecule"


def uma_settings():
    """fairchem's default settings compile the model with torch.compile, which needs Triton. Windows has no Triton,
    so there UMA runs the full-precision path without compilation ("batch"), slower but exact."""
    try:
        import triton  # noqa: F401
        return "default"
    except ImportError:
        return "batch"


def pick_device(want):
    import torch

    if want in ("auto", "cuda") and torch.cuda.is_available():
        kind = "AMD ROCm" if getattr(torch.version, "hip", None) else "NVIDIA CUDA"
        print(f"GPU: {torch.cuda.get_device_name(0)} ({kind})", flush=True)
        return "cuda"
    if want == "cuda":
        print("No usable GPU in this Python; running on the CPU", flush=True)
    return "cpu"


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("input")
    ap.add_argument("out")
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--model", default="uma-s-1p2p1")
    ap.add_argument("--no-m", action="store_true", help="skip the UMA-M single points")
    ap.add_argument("--limit", type=int, default=0, help="only the first N molecules")
    args = ap.parse_args()

    molecules = read_molecules(args.input)
    if args.limit:
        molecules = molecules[: args.limit]
    os.makedirs(os.path.join(args.out, "geom"), exist_ok=True)
    result_path = os.path.join(args.out, "uma_results.csv")
    done = set()
    if os.path.exists(result_path):
        with open(result_path, encoding="utf-8", newline="") as f:
            done = {r["smiles"] for r in csv.DictReader(f) if r.get("ip_uma_s")}
    todo = [(i, s, n) for i, (s, n) in enumerate(molecules, 1) if s not in done]
    print(f"{len(molecules)} molecules, {len(done & {s for s, _ in molecules})} already done, {len(todo)} to run", flush=True)
    if not todo:
        return 0

    from ase import Atoms
    from ase.optimize import LBFGS
    from rdkit import Chem, RDLogger
    from rdkit.Chem import AllChem, Descriptors

    RDLogger.DisableLog("rdApp.*")
    from fairchem.core import FAIRChemCalculator, pretrained_mlip

    device = pick_device(args.device)

    def load(model):
        t = time.time()
        print(f"Loading {model} on {device} (the first run downloads the checkpoint from Hugging Face)", flush=True)
        unit = pretrained_mlip.get_predict_unit(model, device=device, inference_settings=uma_settings())
        print(f"{model} ready in {time.time() - t:.0f} s", flush=True)
        return unit

    try:
        predictor = load(args.model)
        predictor_m = None if args.no_m else load("uma-m-1p1")
    except Exception as e:  # noqa: BLE001
        text = f"{type(e).__name__}: {e}"
        if any(k in text for k in ("GatedRepo", "401", "403", "gated", "Unauthorized", "token")):
            sys.exit("Hugging Face refused the UMA download. Log in once on this machine with a read token that can see "
                     "facebook/UMA:  hf auth login   (then run again)\n" + text[:600])
        raise

    def embed(smiles):
        mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
        p = AllChem.ETKDGv3()
        p.randomSeed = 42
        if AllChem.EmbedMolecule(mol, p) != 0:
            raise RuntimeError("RDKit could not build a 3D structure")
        if AllChem.MMFFHasAllMoleculeParams(mol):
            AllChem.MMFFOptimizeMolecule(mol)
        spin = Descriptors.NumRadicalElectrons(mol) + 1
        return Atoms([a.GetSymbol() for a in mol.GetAtoms()], positions=mol.GetConformer().GetPositions()), spin

    def relax(atoms, q, s, fmax=0.02, steps=500):
        atoms = atoms.copy()
        atoms.info.update({"charge": q, "spin": s})
        atoms.calc = FAIRChemCalculator(predictor, task_name="omol")
        LBFGS(atoms, logfile=None).run(fmax=fmax, steps=steps)
        return atoms, atoms.get_potential_energy()

    def single_point(atoms):
        atoms = atoms.copy()  # keeps the charge and spin in atoms.info
        atoms.calc = FAIRChemCalculator(predictor_m, task_name="omol")
        return atoms.get_potential_energy()

    new_file = not os.path.exists(result_path)
    with open(result_path, "a", encoding="utf-8", newline="") as f:
        w = csv.DictWriter(f, fieldnames=FIELDS)
        if new_file:
            w.writeheader()
        for i, smiles, name in todo:
            t = time.time()
            row = {"smiles": smiles, "name": name}
            try:
                if Chem.MolFromSmiles(smiles) is None:
                    raise ValueError("RDKit cannot parse this SMILES")
                start, spin = embed(smiles)
                ion = 2 if spin == 1 else spin - 1
                neutral, e0 = relax(start, 0, spin)
                cation, e_cat = relax(neutral, 1, ion)
                anion, e_an = relax(neutral, -1, ion)
                row.update(ip_uma_s=round(e_cat - e0, 4), ea_uma_s=round(e0 - e_an, 4))
                if predictor_m is not None:
                    m0, m_cat, m_an = (single_point(a) for a in (neutral, cation, anion))
                    row.update(ip_uma_m=round(m_cat - m0, 4), ea_uma_m=round(m0 - m_an, 4))
                xyz = f"{i:04d}_{safe(name)}_neutral.xyz"
                neutral.write(os.path.join(args.out, "geom", xyz), format="extxyz")
                index = os.path.join(args.out, "geom", "index.csv")
                with open(index, "a", encoding="utf-8", newline="") as g:
                    gw = csv.writer(g)
                    if g.tell() == 0:
                        gw.writerow(["file", "smiles", "name"])
                    gw.writerow([xyz, smiles, name])
            except Exception as e:  # noqa: BLE001 - one bad molecule should not stop the batch
                row["note"] = f"uma: {type(e).__name__}: {e}"[:300]
            row["uma_seconds"] = round(time.time() - t, 1)
            w.writerow(row)
            f.flush()
            print(f"[{i}/{len(molecules)}] {name}: IP {row.get('ip_uma_s', '-')} EA {row.get('ea_uma_s', '-')} "
                  f"(UMA-M {row.get('ip_uma_m', '-')} / {row.get('ea_uma_m', '-')}) {row['uma_seconds']} s"
                  + (f"  {row['note']}" if row.get("note") else ""), flush=True)
    return 0


if __name__ == "__main__":
    sys.exit(main())
