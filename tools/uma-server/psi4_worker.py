"""Psi4 single points for the MolAstria online service, in their own environment.

Psi4 is only distributed through conda, and the online service's environment (uma-env) is a plain venv, so Psi4 lives
in a conda environment of its own (with quacc installed there too). quacc_backend.py starts this script once per
molecule with that environment's Python, writes one JSON object to stdin and reads one JSON object from stdout.
It runs exactly the recipe the in-process road runs: quacc.recipes.psi4.core.static_job.

    {"op": "version"}                                                            -> {"ok": true, "psi4", "quacc"}
    {"op": "static", "symbols", "positions", "charge", "spin", "method", "basis",
     "mem": "4GB", "threads": 4}                                                 -> {"ok": true, "energy_ev", "symbols", "positions"}

Positions are in Angstrom, energies in eV. Any failure comes back as {"ok": false, "error": "..."}.
"""
import json
import os
import sys
import tempfile
import warnings

PROTOCOL = sys.stdout
sys.stdout = sys.stderr  # Psi4 and quacc print; only the one reply line goes to the protocol
warnings.filterwarnings("ignore")


def reply(obj):
    PROTOCOL.write(json.dumps(obj) + "\n")
    PROTOCOL.flush()


def versions():
    import psi4
    import quacc

    return {"psi4": psi4.__version__, "quacc": quacc.__version__}


def static(req):
    from ase import Atoms
    from quacc import change_settings
    from quacc.recipes.psi4.core import static_job

    atoms = Atoms(req["symbols"], positions=req["positions"])
    with tempfile.TemporaryDirectory(prefix="molastria-psi4-") as d:
        os.environ.setdefault("PSI_SCRATCH", d)
        with change_settings({"RESULTS_DIR": d, "GZIP_FILES": False, "CREATE_UNIQUE_DIR": True}):
            doc = static_job(atoms, charge=int(req["charge"]), spin_multiplicity=int(req["spin"]), method=req["method"],
                             basis=req["basis"], mem=req.get("mem", "4GB"), num_threads=int(req.get("threads", 4)))
    final = doc["atoms"]
    return {"energy_ev": float(doc["results"]["energy"]), "symbols": final.get_chemical_symbols(),
            "positions": final.get_positions().tolist()}


def main():
    try:
        req = json.loads(sys.stdin.readline() or "{}")
        op = req.get("op")
        if op == "version":
            reply({"ok": True, **versions()})
        elif op == "static":
            reply({"ok": True, **static(req)})
        else:
            reply({"ok": False, "error": f"unknown op {op!r}"})
    except Exception as e:  # noqa: BLE001 - every failure goes back to the service as text
        reply({"ok": False, "error": f"{type(e).__name__}: {e}"[:400]})


if __name__ == "__main__":
    main()
