"""MACE models for the MolAstria online service, in their own environment.

mace-torch pins e3nn 0.4.4 and fairchem needs e3nn 0.5 or later, so the MACE models cannot share the UMA
environment. server.py starts this script with the MACE environment's Python and talks to it over stdin/stdout,
one JSON object per line; nothing else reaches it. It only loads the official MACE weights (MACE-OFF23, MACE-OMOL-0,
MACE-MDP: Academic Software License, academic non-commercial use) from the mace cache folder, downloading a
missing one from its official address once. The calculations themselves (optimisation, frequencies, MD, ...) run in
server.py, which uses "calc" as an ASE calculator.

    {"op": "ping"}                                                        -> {"ok": true, "models": [...]}
    {"op": "calc", "model", "symbols", "positions", "charge", "spin"}     -> {"ok": true, "energy_ev", "forces"}
    {"op": "polar", "model": "mace-mdp", "symbols", "positions"}          -> {"ok": true, "dipole", "polarizability"}

Positions are in Angstrom, forces in eV/Angstrom; dipole in e*A and polarizability in e*A^2/V (MACE-MDP's own units).
"""
import json
import os
import sys
import time
import warnings
from collections import OrderedDict

PROTOCOL = sys.stdout
sys.stdout = sys.stderr  # library prints go to the service console, never into the protocol
warnings.filterwarnings("ignore")

KEEP_LOADED = 3  # models kept in GPU memory at once; the least recently used one is dropped

# id -> (loader, model argument)
MODELS = {
    "mace-off23-small": ("off", "small"),
    "mace-off23-medium": ("off", "medium"),
    "mace-off23-large": ("off", "large"),
    "mace-omol-0": ("omol", "extra_large"),
    "mace-mdp": ("mdp", None),
}


def main():
    import torch
    from ase import Atoms
    from mace.calculators import foundations_models as fm

    device = os.environ.get("MOLASTRIA_MACE_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
    # float64, as MACE recommends for geometry optimisation and finite-difference Hessians; for molecules this small
    # it costs only a second or two.
    dtype = os.environ.get("MOLASTRIA_MACE_DTYPE") or "float64"
    gpu = torch.cuda.get_device_name(0) if device == "cuda" else ""
    loaded = OrderedDict()

    def calculator(mid):
        if mid in loaded:
            loaded.move_to_end(mid)
            return loaded[mid]
        if mid not in MODELS:
            raise ValueError(f"unknown model {mid}")
        while len(loaded) >= KEEP_LOADED:
            loaded.popitem(last=False)
            if device == "cuda":
                torch.cuda.empty_cache()
        kind, arg = MODELS[mid]
        t = time.time()
        if kind == "off":
            calc = fm.mace_off(model=arg, device=device, default_dtype=dtype)
        elif kind == "omol":
            calc = fm.mace_omol(model=arg, device=device, default_dtype=dtype)
        else:
            calc = fm.mace_mdp(device=device, default_dtype=dtype)
        print(f"MACE worker: loaded {mid} on {device} ({dtype}) in {time.time() - t:.1f} s", flush=True)
        loaded[mid] = calc
        return calc

    def atoms_from(req):
        atoms = Atoms(req["symbols"], positions=req["positions"])
        atoms.info.update({"charge": int(req.get("charge", 0)), "spin": int(req.get("spin", 1))})
        return atoms

    def handle(req):
        op = req.get("op")
        if op == "ping":
            return {"ok": True, "models": list(MODELS), "device": device, "gpu": gpu, "dtype": dtype}
        if op == "calc":
            if req.get("model") == "mace-mdp":
                raise ValueError("MACE-MDP predicts dipoles and polarizabilities, not energies or forces")
            calc = calculator(req["model"])
            calc.calculate(atoms_from(req))  # always computed afresh: the server keeps its own cache
            return {"ok": True, "energy_ev": float(calc.results["energy"]),
                    "forces": [[float(x) for x in row] for row in calc.results["forces"].reshape(-1, 3).tolist()]}
        if op == "polar":
            calc = calculator("mace-mdp")
            atoms = atoms_from(req)
            calc.calculate(atoms)
            dipole = [float(x) for x in list(calc.results["dipole"])[:3]]
            pol = [[float(x) for x in row] for row in calc.results["polarizability"].reshape(3, 3).tolist()]
            return {"ok": True, "dipole": dipole, "polarizability": pol}
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
