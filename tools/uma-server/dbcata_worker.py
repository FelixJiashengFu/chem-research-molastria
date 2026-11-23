# SPDX-License-Identifier: GPL-3.0-or-later
"""DBCata for the MolAstria online models, in its own environment and its own process.

This one file is licensed GPL-3.0-or-later, not MIT like the rest of MolAstria: it imports DBCata
(github.com/Songze1019/DBCata, Huo & Cao, GPL-3.0) and calls its model, so the program it forms with DBCata is
GPL-3.0. Nothing of DBCata is copied into this repository; DBCata is a separate checkout on the site owner's computer
(--dbcata-dir) with its own Python environment (--dbcata-python). server.py (MIT) starts this script as a separate
process and only exchanges JSON lines with it over stdin / stdout. See THIRD-PARTY-DBCata.md.

    {"op": "ping"}                          -> {"ok": true, "engine": {...}}   (loads DBCata, the classifier, UMA)
    {"op": "run", "params": {...}, "limit": seconds}
        -> zero or more {"progress": {"done", "total", "note"}} lines, then {"ok": true, "result": {...}}

params are the canonical params of dbcata_core.check (checked again here). Any failure is {"ok": false, "error"}.
What happens to a request (structures, heuristics, energies, the result) is in dbcata_core.py; this file only adds the
engine: DBCata's own sampler (trainer.pl_cart.pl_module_cart.validate_sample, the ODE with eta = 0, as in the
paper's notebook) and its anomaly classifier (trainer.pl_verify.pl_module_v.compute_confidence) when that checkpoint
is there, and UMA through fairchem: task omat for the bulk cell, task oc20 for slabs and adsorbate-slab structures.

Configuration (environment variables; server.py passes its flags on):
    MOLASTRIA_DBCATA_DIR      the DBCata checkout (required): its model/, trainer/, dataset/ and checkpoints/
    MOLASTRIA_DBCATA_CKPT     the generator checkpoint (default: the one .ckpt in checkpoints/ that loads as
                              pl_module_cart; with several, the one named like the paper's notebook, epoch=999)
    MOLASTRIA_DBCATA_BC_CKPT  the classifier checkpoint (default: a .ckpt in checkpoints/ that loads as pl_module_v;
                              none: no confidence, only the four heuristics)
    MOLASTRIA_DBCATA_UMA      the UMA checkpoint: a fairchem model name (default uma-s-1p1, as in the paper's
                              notebook) or a path to a .pt file (with iso_atom_elem_refs.yaml next to it, if any)
    MOLASTRIA_DBCATA_DEVICE   cuda or cpu (default: cuda when there is one)
    MOLASTRIA_DBCATA_TOY=1    tests only: no torch, no DBCata; dbcata_core.ToyEngine's made-up numbers
"""
import glob
import json
import os
import sys
import time
import warnings

PROTOCOL = sys.stdout
sys.stdout = sys.stderr  # tqdm, Lightning and fairchem print; only protocol lines go to server.py
warnings.filterwarnings("ignore")
HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbcata_core as core  # noqa: E402

BATCH = 128  # measured on the site owner's RTX 2080: about 4.5 ms a structure, 1 GB


def send(obj):
    PROTOCOL.write(json.dumps(obj) + "\n")
    PROTOCOL.flush()


def uma_settings():
    """As server.py: fairchem compiles with torch.compile by default, which needs Triton (none on Windows)."""
    try:
        import triton  # noqa: F401
        return "default"
    except ImportError:
        return "batch"


class Engine:
    """DBCata + UMA. Loaded once; every request then reuses the models."""

    def __init__(self):
        import numpy as np  # noqa: F401
        import torch

        self.torch = torch
        self.dir = os.path.abspath(os.environ.get("MOLASTRIA_DBCATA_DIR", ""))
        if not os.path.isdir(os.path.join(self.dir, "model")) or not os.path.isdir(os.path.join(self.dir, "trainer")):
            raise RuntimeError(f"no DBCata checkout at {self.dir!r} (MOLASTRIA_DBCATA_DIR or --dbcata-dir)")
        sys.path.insert(0, self.dir)
        want = os.environ.get("MOLASTRIA_DBCATA_DEVICE", "")
        self.device = torch.device(want or ("cuda" if torch.cuda.is_available() else "cpu"))
        self._safe_globals()
        self.gen, self.gen_path = self._generator()
        self.bc, self.bc_path = self._classifier()
        self.uma_name = os.environ.get("MOLASTRIA_DBCATA_UMA", "") or "uma-s-1p1"
        self.oc20, self.omat = self._uma()
        self.versions = self._versions()

    # ---- loading ----------------------------------------------------------------------------------------------------
    def _safe_globals(self):
        """torch 2.6 loads checkpoints with weights_only=True: DBCata's networks are stored in the hyperparameters, so
        their classes must be allowed by name (the paper's notebook does this for AdsPaiNN)."""
        allowed = []
        try:
            import model.net as net

            allowed = [getattr(net, n) for n in ("AdsPaiNN", "PaiNN", "FTPaiNN", "EGNN") if hasattr(net, n)]
        except Exception:  # noqa: BLE001 - the load below says what is wrong
            pass
        if allowed and hasattr(self.torch.serialization, "add_safe_globals"):
            self.torch.serialization.add_safe_globals(allowed)

    def _ckpts(self):
        return sorted(glob.glob(os.path.join(self.dir, "checkpoints", "**", "*.ckpt"), recursive=True))

    def _load(self, cls, path):
        m = cls.load_from_checkpoint(path, map_location=self.device)
        m.to(self.device)
        m.eval()
        return m

    def _generator(self):
        from trainer.pl_cart import pl_module_cart

        given = os.environ.get("MOLASTRIA_DBCATA_CKPT", "")
        if given:
            return self._load(pl_module_cart, given), given
        found = []
        for path in self._ckpts():
            try:
                found.append((path, self._load(pl_module_cart, path)))
            except Exception:  # noqa: BLE001 - another kind of checkpoint (the classifier)
                continue
        if not found:
            raise RuntimeError(f"no DBCata generator checkpoint in {os.path.join(self.dir, 'checkpoints')} (download it from "
                               "Figshare, doi:10.6084/m9.figshare.30882545, or set MOLASTRIA_DBCATA_CKPT)")
        if len(found) > 1:
            named = [f for f in found if "epoch=999" in os.path.basename(f[0])]
            if len(named) != 1:
                raise RuntimeError("several generator checkpoints: " + ", ".join(os.path.basename(f[0]) for f in found)
                                   + "; choose one with MOLASTRIA_DBCATA_CKPT (--dbcata-ckpt)")
            found = named
        return found[0][1], found[0][0]

    def _classifier(self):
        try:
            from trainer.pl_verify import pl_module_v
        except Exception:  # noqa: BLE001 - no classifier module: heuristics only
            return None, None
        given = os.environ.get("MOLASTRIA_DBCATA_BC_CKPT", "")
        if given:
            return self._load(pl_module_v, given), given
        for path in self._ckpts():
            if path == self.gen_path:
                continue
            try:
                return self._load(pl_module_v, path), path
            except Exception:  # noqa: BLE001
                continue
        return None, None

    def _uma(self):
        from fairchem.core import FAIRChemCalculator

        name = self.uma_name
        dev = "cuda" if self.device.type == "cuda" else "cpu"
        if name.endswith(".pt"):
            from fairchem.core.units.mlip_unit import load_predict_unit

            refs = os.path.join(os.path.dirname(name), "iso_atom_elem_refs.yaml")
            kw = {}
            if os.path.exists(refs):
                from omegaconf import OmegaConf

                kw["atom_refs"] = OmegaConf.load(refs)
            unit = load_predict_unit(name, device=dev, inference_settings=uma_settings(), **kw)
        else:
            from fairchem.core import pretrained_mlip

            unit = pretrained_mlip.get_predict_unit(name, device=dev, inference_settings=uma_settings())
        return FAIRChemCalculator(unit, task_name="oc20"), FAIRChemCalculator(unit, task_name="omat")

    def _versions(self):
        out = {"torch": self.torch.__version__}
        for mod in ("fairchem.core", "torch_geometric", "lightning", "ase"):
            try:
                m = __import__(mod, fromlist=["__version__"])
                out[mod.split(".")[0]] = getattr(m, "__version__", "")
            except Exception:  # noqa: BLE001
                pass
        try:  # which DBCata: the commit of the checkout, when it is a git clone
            head = open(os.path.join(self.dir, ".git", "HEAD"), encoding="utf-8").read().strip()
            if head.startswith("ref: "):
                head = open(os.path.join(self.dir, ".git", *head[5:].split("/")), encoding="utf-8").read().strip()
            out["dbcata_commit"] = head[:12]
        except OSError:
            pass
        return out

    def info(self):
        gpu = self.torch.cuda.get_device_name(0) if self.device.type == "cuda" else ""
        return {"dbcata": self.versions.get("dbcata_commit", "checkout"), "checkpoint": os.path.basename(self.gen_path),
                "classifier": os.path.basename(self.bc_path) if self.bc_path else None, "uma": os.path.basename(self.uma_name),
                "task": "oc20", "device": self.device.type, "gpu": gpu, "versions": self.versions}

    # ---- the engine dbcata_core.run calls ----------------------------------------------------------------------------
    def _atoms(self, s, positions=None):
        from ase import Atoms
        from ase.constraints import FixAtoms

        atoms = Atoms(s["symbols"], positions=s["positions"] if positions is None else positions, cell=s["cell"], pbc=True)
        atoms.set_constraint(FixAtoms(indices=[i for i, f in enumerate(s["fixed"]) if f]))
        return atoms

    def lattice(self, blk):
        from ase import Atoms
        from ase.filters import FrechetCellFilter
        from ase.optimize import LBFGS

        atoms = Atoms(blk["symbols"], scaled_positions=blk["frac"], cell=blk["cell"], pbc=True)
        atoms.calc = self.omat
        cubic = blk["structure"] == "L1_2"
        LBFGS(FrechetCellFilter(atoms, hydrostatic_strain=cubic), logfile=None).run(fmax=0.02, steps=core.BULK_STEPS)
        a, b, c = atoms.cell.lengths()
        return float((a + b) / 2), (None if cubic else float(c))

    def _data(self, structures, generated=None):
        from torch_geometric.data import Data

        torch, out = self.torch, []
        for k, s in enumerate(structures):
            d = Data(atomic_numbers=torch.tensor([core.ATOMIC_NUMBER[x] for x in s["symbols"]], dtype=torch.long),
                     pos=torch.tensor(s["positions"], dtype=torch.float32),
                     cell=torch.tensor(s["cell"], dtype=torch.float32).unsqueeze(0),
                     fixed=torch.tensor(s["fixed"], dtype=torch.bool), natoms=torch.tensor([len(s["symbols"])]))
            if generated is not None:
                d.pos_generated = torch.tensor(generated[k], dtype=torch.float32)
                d.label = torch.zeros(1)  # the classifier's forward computes a loss against a label; unused here
            out.append(d)
        return out

    def _loader(self, data):
        from dataset import DatasetFromList
        from torch_geometric.loader import DataLoader

        return DataLoader(DatasetFromList(data), batch_size=BATCH, shuffle=False, num_workers=0)

    def generate(self, structures, steps):
        """DBCata's sampler as its InferenceModel runs it, without swallowing a failed batch."""
        flow = self.gen.flow
        flow.utils_config["sample_steps"] = int(steps)
        flow.utils_config["eta"] = 0.0  # the deterministic ODE, as in the paper's notebook
        flow.register_schedule()
        flow.to(self.device)
        out = []
        with self.torch.no_grad():
            for batch in self._loader(self._data(structures)):
                batch = batch.to(self.device)
                pos = self.gen.validate_sample(batch)[0].detach().cpu().numpy()
                counts = self.torch.bincount(batch.batch).cpu().tolist()
                start = 0
                for n in counts:
                    out.append(pos[start:start + n])
                    start += n
        if len(out) != len(structures):
            raise RuntimeError("DBCata returned a different number of structures than it was given")
        return out

    def confidence(self, structures, generated):
        if self.bc is None:
            return None
        out = []
        with self.torch.no_grad():
            for batch in self._loader(self._data(structures, generated)):
                batch = batch.to(self.device)
                out += [float(x) for x in self.bc.compute_confidence(batch).detach().cpu().reshape(-1)]
        return out

    def energy(self, s, positions):
        atoms = self._atoms(s, positions)
        atoms.calc = self.oc20
        return float(atoms.get_potential_energy())

    def relax(self, s, fmax, steps):
        import numpy as np
        from ase.optimize import LBFGS

        atoms = self._atoms(s)
        atoms.calc = self.oc20
        dyn = LBFGS(atoms, logfile=None)
        dyn.run(fmax=fmax, steps=steps)
        forces = atoms.get_forces()  # constrained atoms come back with zero force
        return {"positions": atoms.get_positions(), "energy": float(atoms.get_potential_energy()),
                "steps": int(dyn.get_number_of_steps()),
                "converged": bool(float(np.linalg.norm(forces, axis=1).max()) <= fmax + 1e-9)}


def main():
    engine = None
    toy = os.environ.get("MOLASTRIA_DBCATA_TOY") == "1"
    for line in sys.stdin:
        line = line.lstrip("﻿").strip()
        if not line:
            continue
        try:
            req = json.loads(line)
            if engine is None:
                engine = core.ToyEngine() if toy else Engine()
            op = req.get("op")
            if op == "ping":
                send({"ok": True, "engine": engine.info()})
            elif op == "run":
                params = core.check(req.get("params"))
                t = time.time()
                result = core.run(params, engine, progress=lambda p: send({"progress": p}), limit=float(req.get("limit") or 0))
                result["seconds_worker"] = round(time.time() - t, 2)
                send({"ok": True, "result": result})
            else:
                send({"ok": False, "error": f"unknown op {op!r}"})
        except Exception as e:  # noqa: BLE001 - every failure goes back to the service as text
            send({"ok": False, "error": f"{type(e).__name__}: {e}"[:400]})


if __name__ == "__main__":
    main()
