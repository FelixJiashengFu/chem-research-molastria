"""Trial run of the online models with their real weights, one model per process, without HTTP or the secret.

It builds the same backends, ASE calculators, request checks (Service.parse) and calculations (Service.compute,
chemjobs) as server.py, with the same time limits, and appends one JSON line per job to --out: seconds, status and
the numbers worth a sanity check. The full results go to --out as well (one line each), so nothing is cached in this
folder. It does not touch a running server.py (no port, no cache file).

    python -X utf8 tools/uma-server/realrun.py --model uma-s-1p2p1 --plan basic --out C:\\path\\runs.jsonl
        [--mace-python D:\\ChemDraw\\mace-env\\Scripts\\python.exe] [--device auto|cuda|cpu]

Plans: basic (sp, opt, freq on water and methanol; polar and ir for MACE-MDP), full (every job of the model, with
the reference molecules), worst (a 30-heavy-atom molecule, default params, the heaviest jobs), hessian (freq plus
the raw Hessian's asymmetry and unprojected external modes, for the direct-force models).
"""
import argparse
import collections
import json
import os
import sys
import time
import traceback

os.environ.setdefault("HF_HUB_OFFLINE", "1")  # as start.ps1: the weights are already on this computer
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import chemjobs as cj  # noqa: E402
import server  # noqa: E402

WATER, METHANOL = "O", "CO"
# Triacontane: 30 heavy atoms (the limit) and 92 atoms in all, the most atoms 30 heavy atoms can carry, and as
# floppy as a molecule gets; C/H only, so every model knows it. C13-C14-C15-C16 is the middle dihedral.
WORST = "C" * 30


def plan(name, model):
    jobs = server.MODELS[model]["jobs"]
    out = []
    if name == "basic":
        if "sp" in jobs:
            for smi in (WATER, METHANOL):
                out += [(f"{job} {smi}", {"job": job, "smiles": smi}) for job in ("sp", "opt", "freq")]
        else:
            for smi in (WATER, METHANOL):
                out += [(f"{job} {smi}", {"job": job, "smiles": smi}) for job in ("polar", "ir")]
    elif name == "full":
        if "sp" in jobs:
            out += [
                ("sp water", {"job": "sp", "smiles": WATER}),
                ("opt water", {"job": "opt", "smiles": WATER}),
                ("freq water", {"job": "freq", "smiles": WATER, "params": {"symmetry": 2}}),
                ("freq CO2", {"job": "freq", "smiles": "O=C=O", "params": {"symmetry": 2}}),
                ("conf butane", {"job": "conf", "smiles": "CCCC"}),
                ("scan butane CCCC", {"job": "scan", "smiles": "CCCC", "params": {"atoms": [0, 1, 2, 3]}}),
                ("md methanol", {"job": "md", "smiles": METHANOL}),
                ("rxn ethylene hydration thermo", {"job": "rxn", "params": {"reaction": "C=C.O>>CCO", "thermo": True}}),
            ]
        if "ipea" in jobs:
            out += [
                ("ipea ethylene vertical", {"job": "ipea", "smiles": "C=C", "params": {"mode": "vertical"}}),
                ("ipea benzene vertical", {"job": "ipea", "smiles": "c1ccccc1", "params": {"mode": "vertical"}}),
                ("ipea ethanol adiabatic", {"job": "ipea", "smiles": "CCO"}),
                ("ipea water both", {"job": "ipea", "smiles": WATER, "params": {"mode": "both"}}),
                ("spin O2 1 vs 3", {"job": "spin", "smiles": "O=O", "params": {"spins": [1, 3]}}),
                ("bde CH3-H thermo", {"job": "bde", "smiles": "C", "params": {"bond": [0, 1], "thermo": True}}),
                ("bde ethane C-C thermo", {"job": "bde", "smiles": "CC", "params": {"bond": [0, 1], "thermo": True}}),
                ("pa NH3 thermo", {"job": "pa", "smiles": "N", "params": {"site": 0, "thermo": True}}),
                ("pa acetic acid deprotonate", {"job": "pa", "smiles": "CC(=O)O", "params": {"site": 3, "mode": "deprotonate"}}),
            ]
        if "polar" in jobs:
            out += [
                ("polar water", {"job": "polar", "smiles": WATER}),
                ("polar average propanol", {"job": "polar", "smiles": "CCCO", "params": {"average": True}}),
                ("ir water", {"job": "ir", "smiles": WATER}),
                ("ir CO2", {"job": "ir", "smiles": "O=C=O"}),
                ("ir methanol", {"job": "ir", "smiles": METHANOL}),
            ]
    elif name == "worst":
        if "sp" in jobs:
            out += [(f"{job} worst", {"job": job, "smiles": WORST}) for job in ("freq", "conf", "md")]
            out.append(("scan worst", {"job": "scan", "smiles": WORST, "params": {"atoms": [13, 14, 15, 16]}}))
        else:
            out += [("polar average worst", {"job": "polar", "smiles": WORST, "params": {"average": True}}),
                    ("ir worst", {"job": "ir", "smiles": WORST})]
    elif name == "hessian":  # Hessian quality, for the direct-force models above all
        out += [(f"freq {smi}", {"job": "freq", "smiles": smi}) for smi in ("CCO", "c1ccccc1", "CC(=O)NC")]
    else:
        raise SystemExit(f"unknown plan {name}")
    return out


def hessian_check(svc, model, smiles):
    """Raw finite-difference Hessian at the freq job's geometry: relative asymmetry |H - H^T| / |H| and the six
    lowest frequencies BEFORE translations and rotations are projected out (all near 0 for a clean Hessian)."""
    import numpy as np
    from ase import units

    Chem = cj._rdkit()
    mol_h = Chem.AddHs(Chem.MolFromSmiles(smiles))
    symbols, pos = cj.embed(Chem.Mol(mol_h))
    atoms = cj.new_atoms(symbols, pos, 0, 1, svc.calculator(model))
    cj.relax(atoms, cj.Budget(600), cj.FREQ_FMAX)
    p0, n = atoms.get_positions(), len(atoms)
    h = np.zeros((3 * n, 3 * n))
    for k in range(3 * n):
        f = []
        for sign in (1, -1):
            p = p0.copy()
            p[k // 3, k % 3] += sign * cj.HESSIAN_DELTA
            atoms.set_positions(p)
            f.append(atoms.get_forces().ravel())
        h[k] = -(f[0] - f[1]) / (2 * cj.HESSIAN_DELTA)
    asym = float(np.linalg.norm(h - h.T) / np.linalg.norm(h))
    m = np.sqrt(np.repeat(atoms.get_masses(), 3))
    w = np.linalg.eigvalsh(0.5 * (h + h.T) / np.outer(m, m))
    cm = np.sign(w) * np.sqrt(np.abs(w)) * cj.HBAR_OMEGA / units.invcm
    return {"asymmetry": round(asym, 5), "unprojected_lowest6_cm1": [round(float(x), 1) for x in sorted(cm, key=abs)[:6]]}


def summary(r):
    """The numbers worth a sanity check, per job."""
    job = r["job"]
    keep = {}
    for k in ("energy_ev", "steps", "converged", "fmax_ev_a", "n_imag", "zpe_ev", "linear", "n_generated", "n_unique",
              "mean_temperature_k", "delta_e_kcal", "delta_g_kcal", "ip_ev", "ea_ev", "ip_vertical_ev",
              "ea_vertical_ev", "gap_ev", "gap_kcal", "vertical_gap_ev", "bde_kcal", "bdh298_kcal", "value_kcal",
              "enthalpy_kcal", "dipole_debye", "polarizability_a3", "conformers", "direct_forces"):
        if k in r and not isinstance(r[k], list):
            keep[k] = r[k]
    if "frequencies_cm1" in r:
        f = r["frequencies_cm1"]
        keep["freq_lowest"] = f[:3]
        keep["freq_highest"] = f[-3:]
    if job == "ir":
        keep["ir_strongest"] = sorted(zip(r["ir_intensity_km_mol"], r["frequencies_cm1"]), reverse=True)[:3]
        keep["raman_strongest"] = sorted(zip(r["raman_activity_a4_amu"], r["frequencies_cm1"]), reverse=True)[:2]
    if job == "conf":
        keep["conformers"] = len(r["conformers"])
        keep["rel_kcal"] = [c["rel_kcal"] for c in r["conformers"]][:6]
    if job == "scan":
        keep["rel_kcal"] = [p["rel_kcal"] for p in r["points"]]
        keep["all_converged"] = all(p["converged"] for p in r["points"])
    if job == "md":
        keep["epot_drift_ev"] = round(r["series"][-1]["epot_ev"] - r["series"][0]["epot_ev"], 4)
    if job == "freq":
        keep["g_corr_ev"] = r["thermo"]["g_corr_ev"]
    if job == "conf" and "temperature_k" in r:
        keep["temperature_k"] = r["temperature_k"]
    return keep


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--model", required=True, choices=list(server.MODELS))
    ap.add_argument("--plan", required=True, choices=["basic", "full", "worst", "hessian"])
    ap.add_argument("--out", required=True)
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--mace-python", default="")
    ap.add_argument("--only", default="", help="run only the jobs whose label contains this text")
    args = ap.parse_args()
    if os.name == "nt" and not sys.flags.utf8_mode:
        sys.exit("Start Python in UTF-8 mode (-X utf8).")
    import torch

    device = "cuda" if args.device in ("auto", "cuda") and torch.cuda.is_available() else "cpu"
    gpu = torch.cuda.get_device_name(0) if device == "cuda" else ""
    m = server.MODELS[args.model]
    t = time.time()
    if m["lane"] == "fair":
        backend = server.FairchemBackend.__new__(server.FairchemBackend)  # without UMA-S 1.2.1 preloaded
        backend.device, backend.units = device, collections.OrderedDict()
        backend.unit(args.model)
    elif m["lane"] == "ani":
        backend = server.AniBackend(device)
    else:
        if not args.mace_python:
            sys.exit("MACE models need --mace-python")
        os.environ["MOLASTRIA_MACE_DEVICE"] = device
        backend = server.MaceBackend(args.mace_python)
        warm = "mace-off23-medium" if args.model == "mace-mdp" else args.model
        backend.call({"op": "calc", "model": warm, "symbols": ["H", "H"], "positions": [[0, 0, 0], [0, 0, 0.74]],
                      "charge": 0, "spin": 1})
        if args.model == "mace-mdp":
            backend.dp(["H", "H"], [[0, 0, 0], [0, 0, 0.74]])
    load = round(time.time() - t, 1)
    svc = server.Service.__new__(server.Service)
    svc.fake, svc.backends = False, {m["lane"]: backend}
    with open(args.out, "a", encoding="utf-8") as out:
        out.write(json.dumps({"kind": "load", "model": args.model, "device": device, "gpu": gpu, "load_s": load}) + "\n")
        out.flush()
        print(f"{args.model}: loaded on {device} {gpu} in {load} s", flush=True)
        for label, body in plan(args.plan, args.model):
            if args.only and args.only not in label:
                continue
            body = dict(body, model=args.model)
            limit = server.TIME_LIMITS.get(body["job"], server.DEFAULT_LIMIT)
            rec = {"kind": "job", "model": args.model, "plan": args.plan, "label": label, "job": body["job"], "limit_s": limit}
            t = time.time()
            try:
                spec = svc.parse(body)
                spec.pop("input")
                r = svc.compute(spec, cj.Budget(limit))
                rec.update(status="done", summary=summary(r), result=r)
                if args.plan == "hessian":
                    rec["seconds_job"] = round(time.time() - t, 1)
                    rec["summary"].update(hessian_check(svc, args.model, body["smiles"]))
            except Exception as e:  # noqa: BLE001 - recorded, the run goes on
                rec.update(status="error", error=f"{type(e).__name__}: {e}"[:400], trace=traceback.format_exc()[-1500:])
            rec["seconds"] = round(time.time() - t, 1)
            rec["within_limit"] = rec["status"] == "done" and rec["seconds"] <= limit
            if device == "cuda":
                rec["gpu_mem_peak_mb"] = int(torch.cuda.max_memory_allocated() / 2 ** 20)
            out.write(json.dumps(rec) + "\n")
            out.flush()
            print(f"  {label}: {rec['status']} {rec['seconds']} s {rec.get('summary', rec.get('error'))}", flush=True)


if __name__ == "__main__":
    main()
