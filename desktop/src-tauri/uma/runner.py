"""MolAstria desktop: built-in UMA runner.

The desktop app runs this file with the user's own Python. It never receives code from the page,
only a JSON file of parameters the app has already checked (SMILES, name, job, model, device,
charge, spin, with_m).

  python -u runner.py --probe quick  Python version and which packages exist, without importing them
  python -u runner.py --probe        full report: torch and CUDA, fairchem, RDKit, Hugging Face access
  python -u runner.py params.json    run one job in the current folder

Lines starting with "@@" are read by the app: "@@STEP text", "@@RESULT {json}", "@@ERROR {json}".
The calculations are the same as the scripts made on https://molastria.com/meta/#uma.
"""
import json
import os
import sys
import time

EV_KCAL = 23.0605  # kcal/mol per eV


def emit(tag, payload):
    text = payload if isinstance(payload, str) else json.dumps(payload, ensure_ascii=False)
    print(f"@@{tag} {text}", flush=True)


def probe(quick=False):
    info = {"python": sys.version.split()[0], "executable": sys.executable}
    if quick:
        import importlib.util

        for mod in ("torch", "fairchem", "rdkit"):
            info["has_" + mod] = importlib.util.find_spec(mod) is not None
        emit("PROBE", info)
        return
    try:
        import torch

        info["torch"] = torch.__version__
        info["cuda"] = bool(torch.cuda.is_available())
        info["hip"] = bool(getattr(torch.version, "hip", None))
        info["mps"] = bool(getattr(torch.backends, "mps", None) and torch.backends.mps.is_available())
        if info["cuda"]:
            info["gpu"] = torch.cuda.get_device_name(0)
    except Exception as e:  # noqa: BLE001 - reported to the user as-is
        info["torch_error"] = str(e)[:300]
    try:
        import fairchem.core

        info["fairchem"] = getattr(fairchem.core, "__version__", "") or "installed"
    except Exception as e:  # noqa: BLE001
        info["fairchem_error"] = str(e)[:300]
    try:
        import rdkit

        info["rdkit"] = rdkit.__version__
    except Exception as e:  # noqa: BLE001
        info["rdkit_error"] = str(e)[:300]
    try:
        from huggingface_hub import get_token

        info["hf_login"] = bool(get_token())
    except Exception:  # noqa: BLE001
        info["hf_login"] = False
    # Access to the gated facebook/UMA repository: True, False, or None when it could not be checked.
    info["uma_access"] = None
    if info.get("hf_login"):
        try:
            from huggingface_hub import auth_check

            auth_check("facebook/UMA")
            info["uma_access"] = True
        except Exception as e:  # noqa: BLE001
            name = type(e).__name__
            if name in ("GatedRepoError", "RepositoryNotFoundError", "HfHubHTTPError"):
                info["uma_access"] = False
            info["uma_access_detail"] = f"{name}: {str(e)[:200]}"
    emit("PROBE", info)


def run(params):
    from ase import Atoms
    from ase.optimize import LBFGS
    from rdkit import Chem
    from rdkit.Chem import AllChem

    smiles, name, job = params["smiles"], params["name"], params["job"]
    model, device = params["model"], params["device"]
    charge, spin = int(params["charge"]), int(params["spin"])

    import torch

    # fairchem accepts only "cuda" and "cpu". AMD cards appear as "cuda" in the ROCm build of PyTorch;
    # Apple GPUs (MPS) are not supported by fairchem yet, so a Mac runs on its CPU.
    want = device
    if want in ("auto", "cuda", "rocm") and torch.cuda.is_available():
        kind = "AMD ROCm" if getattr(torch.version, "hip", None) else "NVIDIA CUDA"
        emit("STEP", f"Using the GPU: {torch.cuda.get_device_name(0)} ({kind})")
        device = "cuda"
    else:
        if want in ("cuda", "rocm"):
            emit("STEP", "No usable GPU in this Python; running on the CPU instead")
        elif want == "apple":
            emit("STEP", "fairchem does not support Apple GPUs (MPS) yet; running on the CPU")
        device = "cpu"

    from fairchem.core import FAIRChemCalculator, pretrained_mlip

    def load(model_name, **kw):
        emit("STEP", f"Loading {model_name} on {device} (the first run downloads the checkpoint from Hugging Face)")
        t = time.time()
        unit = pretrained_mlip.get_predict_unit(model_name, device=device, inference_settings=uma_settings(), **kw)
        emit("STEP", f"{model_name} ready in {time.time() - t:.0f} s")
        return unit

    seed = int(time.time()) % 2_000_000_000 if job == "md" else None
    predictor = load(model, **({"seed": seed} if seed is not None else {}))

    def embed(seed=42):
        mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
        p = AllChem.ETKDGv3()
        p.randomSeed = seed
        if AllChem.EmbedMolecule(mol, p) != 0:
            raise RuntimeError(f"RDKit could not build a 3D structure for {smiles}")
        if AllChem.MMFFHasAllMoleculeParams(mol):
            AllChem.MMFFOptimizeMolecule(mol)
        return Atoms([a.GetSymbol() for a in mol.GetAtoms()], positions=mol.GetConformer().GetPositions())

    def relax(atoms, q, s, label, fmax=0.02, steps=500):
        atoms = atoms.copy()
        atoms.info.update({"charge": q, "spin": s})
        atoms.calc = FAIRChemCalculator(predictor, task_name="omol")
        t = time.time()
        opt = LBFGS(atoms, logfile=None)
        opt.run(fmax=fmax, steps=steps)
        energy = atoms.get_potential_energy()
        print(f"{label}: charge {q:+d}, multiplicity {s}, {opt.nsteps} steps, E = {energy:.6f} eV ({time.time() - t:.1f} s)", flush=True)
        return atoms, energy

    files = []
    if job == "opt":
        atoms, energy = relax(embed(), charge, spin, "optimised")
        atoms.write(f"{name}_uma.xyz")
        files.append(f"{name}_uma.xyz")
        emit("RESULT", {"job": job, "model": model, "energy_ev": round(energy, 6), "files": files})
        return

    if job == "conf":
        mol = Chem.AddHs(Chem.MolFromSmiles(smiles))
        p = AllChem.ETKDGv3()
        p.randomSeed = 42
        ids = list(AllChem.EmbedMultipleConfs(mol, 20, p))
        if not ids:
            raise RuntimeError(f"RDKit could not build conformers for {smiles}")
        if AllChem.MMFFHasAllMoleculeParams(mol):
            AllChem.MMFFOptimizeMoleculeConfs(mol)
        symbols = [a.GetSymbol() for a in mol.GetAtoms()]
        emit("STEP", f"Optimising {len(ids)} conformers")
        found = []
        for cid in ids:
            start = Atoms(symbols, positions=mol.GetConformer(cid).GetPositions())
            atoms, energy = relax(start, charge, spin, f"conformer {cid}")
            found.append((energy, cid, atoms))
        found.sort(key=lambda x: x[0])
        e_min = found[0][0]
        found[0][2].write(f"{name}_lowest.xyz")
        files.append(f"{name}_lowest.xyz")
        rel = [round((e - e_min) * EV_KCAL, 2) for e, _, _ in found]
        emit("RESULT", {"job": job, "model": model, "energy_ev": round(e_min, 6), "relative_kcal": rel, "files": files})
        return

    if job == "md":
        from ase import units
        from ase.io import Trajectory
        from ase.md.langevin import Langevin
        from ase.md.velocitydistribution import MaxwellBoltzmannDistribution

        atoms, _ = relax(embed(), charge, spin, "start structure", fmax=0.05)
        MaxwellBoltzmannDistribution(atoms, temperature_K=300)
        dyn = Langevin(atoms, timestep=0.5 * units.fs, temperature_K=300, friction=0.01 / units.fs)
        traj = Trajectory(f"{name}_md.traj", "w", atoms)
        dyn.attach(traj.write, interval=10)
        dyn.attach(lambda: print(f"step {dyn.get_number_of_steps():5d}  T = {atoms.get_temperature():6.1f} K  E = {atoms.get_total_energy():.4f} eV", flush=True), interval=100)
        emit("STEP", "Running 2000 steps of 0.5 fs (1 ps) at 300 K")
        dyn.run(2000)
        traj.close()
        files.append(f"{name}_md.traj")
        emit("RESULT", {"job": job, "model": model, "steps": 2000, "files": files})
        return

    # job == "ipea": adiabatic IP = E(+1) - E(0) and EA = E(0) - E(-1), each state relaxed on its own (eV),
    # the definitions the MolAstria AI Lab uses for its Tier 1 columns.
    col = {"uma-s-1p2p1": "uma_s", "uma-m-1p1": "uma_m", "uma-s-1p2p1-ft-d4rev": "d4rev"}[model]
    ion = 2 if spin == 1 else spin - 1
    neutral, e0 = relax(embed(), charge, spin, "neutral")
    cation, e_cat = relax(neutral, charge + 1, ion, "cation")
    anion, e_an = relax(neutral, charge - 1, ion, "anion")
    row = {"smiles": smiles, "name": name, f"ip_{col}": round(e_cat - e0, 4), f"ea_{col}": round(e0 - e_an, 4)}
    if params.get("with_m") and model == "uma-s-1p2p1":
        predictor_m = load("uma-m-1p1")

        def single_point(atoms):
            atoms = atoms.copy()  # keeps the charge and spin in atoms.info
            atoms.calc = FAIRChemCalculator(predictor_m, task_name="omol")
            return atoms.get_potential_energy()

        emit("STEP", "UMA-M single points on the UMA-S geometries")
        m0, m_cat, m_an = (single_point(a) for a in (neutral, cation, anion))
        row["ip_uma_m"] = round(m_cat - m0, 4)
        row["ea_uma_m"] = round(m0 - m_an, 4)
    for atoms, state in ((neutral, "neutral"), (cation, "cation"), (anion, "anion")):
        atoms.write(f"{name}_{state}.xyz")
        files.append(f"{name}_{state}.xyz")
    with open("uma_results.csv", "w", encoding="utf-8", newline="") as f:
        f.write(",".join(row) + "\n" + ",".join(str(v) for v in row.values()) + "\n")
    files.append("uma_results.csv")
    emit("RESULT", {"job": job, "model": model, "row": row, "files": files})


def uma_settings():
    """fairchem's default settings compile the model with torch.compile, which needs Triton. Windows has no Triton,
    so there UMA runs the full-precision path without compilation ("batch"), slower but exact."""
    try:
        import triton  # noqa: F401
        return "default"
    except ImportError:
        return "batch"


def main():
    if len(sys.argv) > 1 and sys.argv[1] == "--probe":
        probe(quick=sys.argv[2:3] == ["quick"])
        return 0
    with open(sys.argv[1], encoding="utf-8") as f:
        params = json.load(f)
    started = time.time()
    try:
        run(params)
    except Exception as e:  # noqa: BLE001 - the app shows the message and a hint
        text = f"{type(e).__name__}: {e}"
        gated = any(k in text for k in ("GatedRepo", "401", "403", "gated", "Unauthorized"))
        emit("ERROR", {"kind": "hf_access" if gated else "run", "message": text[:1500]})
        return 1
    emit("STEP", f"Finished in {time.time() - started:.0f} s")
    return 0


if __name__ == "__main__":
    os.environ.setdefault("TQDM_MININTERVAL", "1")
    sys.exit(main())
