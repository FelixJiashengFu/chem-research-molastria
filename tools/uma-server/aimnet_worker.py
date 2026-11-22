"""AIMNet2 for the MolAstria online service, in its own environment.

AIMNet2 (isayevlab/aimnetcentral, MIT, pip install "aimnet[ase]") needs torch 2.10 or later, warp-lang and NVIDIA's
nvalchemi-toolkit-ops; fairchem in the UMA environment pins an older torch, so AIMNet2 gets its own environment
(aimnet-env) like MACE. server.py starts this script with that environment's Python (--aimnet-python) and talks to it
over stdin/stdout, one JSON object per line; nothing else reaches it. The calculations themselves (optimisation,
frequencies, MD, transition states, ...) run in server.py, which uses "calc" as an ASE calculator.

The model is "aimnet2" of the aimnet package: the first member of the wB97M-D3 ensemble (aimnet2-wb97m-d3_0), trained on
wB97M-D3(BJ)/def2-TZVPP data for neutral and charged closed-shell molecules of 14 elements (H, B, C, N, O, F, Si, P,
S, Cl, As, Se, Br, I). It reads the total charge but not the spin multiplicity, so server.py sends closed-shell
molecules only (multiplicity 1). The weights come from the package's own address on first use and stay in its cache.

    {"op": "ping"}                                                        -> {"ok": true, "models": [...], "version", ...}
    {"op": "calc", "model", "symbols", "positions", "charge", "spin"}     -> {"ok": true, "energy_ev", "forces", "charges"}

Positions are in Angstrom, energies in eV, forces in eV/Angstrom; charges are AIMNet2's atomic partial charges (e).
"""
import json
import os
import sys
import time
import warnings

PROTOCOL = sys.stdout
sys.stdout = sys.stderr  # library prints go to the service console, never into the protocol
warnings.filterwarnings("ignore")

# id -> the aimnet package's model name. aimnet2-nse (open-shell) is only for aimnet_selftest.py's vertical IPs:
# server.py does not offer it, so visitors never reach it.
MODELS = {"aimnet2": "aimnet2", "aimnet2-nse": "aimnet2-nse"}
CLOSED = {"aimnet2"}  # reads the charge, ignores the multiplicity
ELEMENTS = ("H", "B", "C", "N", "O", "F", "Si", "P", "S", "Cl", "As", "Se", "Br", "I")


def version():
    try:
        from importlib.metadata import version as v

        return v("aimnet")
    except Exception:  # noqa: BLE001
        return ""


def main():
    import torch
    from aimnet.calculators import AIMNet2ASE, AIMNet2Calculator
    from ase import Atoms

    device = os.environ.get("MOLASTRIA_AIMNET_DEVICE") or ("cuda" if torch.cuda.is_available() else "cpu")
    gpu = torch.cuda.get_device_name(0) if device == "cuda" else ""
    loaded = {}

    def calculator(mid):
        if mid not in MODELS:
            raise ValueError(f"unknown model {mid}")
        if mid not in loaded:
            t = time.time()
            base = AIMNet2Calculator(MODELS[mid], device=device)
            loaded[mid] = AIMNet2ASE(base, charge=0, mult=1)
            print(f"AIMNet2 worker: loaded {mid} on {device} in {time.time() - t:.1f} s", flush=True)
        return loaded[mid]

    def handle(req):
        op = req.get("op")
        if op == "ping":
            return {"ok": True, "models": list(MODELS), "device": device, "gpu": gpu, "version": version(),
                    "elements": list(ELEMENTS)}
        if op == "calc":
            spin = int(req.get("spin", 1))
            if req.get("model") in CLOSED and spin != 1:
                raise ValueError("AIMNet2 (wB97M-D3) is a closed-shell model: spin multiplicity 1 only")
            calc = calculator(req["model"])
            atoms = Atoms(req["symbols"], positions=req["positions"])
            atoms.info.update({"charge": int(req.get("charge", 0)), "mult": spin})
            atoms.calc = calc
            energy = float(atoms.get_potential_energy())  # always computed afresh: the server keeps its own cache
            forces = atoms.get_forces()
            try:
                charges = [float(x) for x in calc.get_charges()]
            except Exception:  # noqa: BLE001 - partial charges are a bonus
                charges = []
            return {"ok": True, "energy_ev": energy, "forces": [[float(x) for x in row] for row in forces.tolist()],
                    "charges": charges}
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
