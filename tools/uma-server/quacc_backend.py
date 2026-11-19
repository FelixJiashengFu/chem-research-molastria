"""quacc as one more lane of the MolAstria online models: small batches of molecules through quacc's recipes, and
quacc's bulk-to-slabs flow for fcc metals.

quacc (github.com/Quantum-Accelerators/quacc) is Andrew S. Rosen's ASE-based library of high-throughput workflows,
BSD 3-Clause licence (its copyright notice and licence text are in tools/uma-server/THIRD-PARTY-quacc.md). Nothing of
quacc is copied here: it is installed with pip into the model server's environment, this file calls its recipes, and
the results come back in quacc's own schemas (trimmed to what a web page shows). Using quacc says nothing about its
authors endorsing MolAstria.

Engines, all free to run on the owner's computer:
    quacc-gfn2   GFN2-xTB. quacc's tblite recipes (static_job, relax_job, freq_job) when the tblite package is there
                 (pip install tblite works on Linux and macOS); otherwise the same quacc Runner + Summarize /
                 VibSummarize calls, with the xtb program (xtb_backend.py) as the calculator. Windows takes the second
                 road, since tblite has no Windows wheel.
    quacc-psi4   Psi4 (LGPL-3.0, conda install psi4) through quacc's psi4 static_job: single points only. Psi4 only
                 comes from conda; when this environment cannot import it (the owner's uma-env is a plain venv),
                 server.py --psi4-python points at a conda environment with psi4 + quacc, and each molecule runs there
                 through psi4_worker.py (a new process per molecule, given the time left in the job).
    quacc-emt    ASE's effective-medium theory through quacc's EMT recipes: relax the bulk and its cell, cut the low-
                 index slabs with quacc's bulk_to_slabs_flow, relax each, and give the surface energies. EMT is a
                 teaching potential for seven fcc metals; quacc itself calls these recipes "mainly for demonstration".
ORCA has quacc recipes too, but ORCA is free for academic use only, so it is not run here; the Code Desk writes a
script that runs it on the visitor's own computer.

Every quacc job writes its files into a temporary folder that is removed afterwards (QUACC_RESULTS_DIR), so the
server's disk does not fill up. test_quacc_backend.py checks the helpers without quacc, and the real recipes (EMT
always, GFN2 when tblite or xtb is there) when quacc is installed.
"""
import io
import json
import math
import os
import subprocess
import sys
import tempfile
import threading
import time

import numpy as np

EV_A2_TO_J_M2 = 16.0217663  # 1 eV/Angstrom^2 in J/m^2
EMT_METALS = ("Al", "Cu", "Ag", "Au", "Ni", "Pd", "Pt")  # the fcc metals ASE's EMT is fitted to
RECIPES = ("static", "relax", "relax_freq")
PSI4_METHODS = ("hf", "b3lyp-d3bj", "pbe0", "wb97x-d")
PSI4_BASES = ("sto-3g", "6-31g*", "def2-svp")
MAX_ITEMS = 8  # molecules in one batch
PSI4_MAX_HEAVY = 12
OPT_FMAX, OPT_STEPS = 0.01, 500  # quacc's default fmax, fewer steps than its 1000
# Uses of the day per molecule (account-worker.js QUACC_ITEM_COST says the same)
ITEM_COST = {"static": 1, "relax": 1, "relax_freq": 3}
PSI4_ITEM_COST = 2


def quacc_version():
    """The installed quacc version, or "" when quacc is missing."""
    try:
        import quacc

        return quacc.__version__
    except Exception:  # noqa: BLE001 - not installed, or broken: the lane is reported as not ready
        return ""


def has_module(name):
    from importlib.util import find_spec

    try:
        return find_spec(name) is not None
    except (ImportError, ValueError):
        return False


def flow_cost(model, recipe, n_items):
    per = PSI4_ITEM_COST if model == "quacc-psi4" else ITEM_COST[recipe]
    return per * n_items


def surface_energy(e_slab, n_slab, e_bulk_per_atom, cell):
    """gamma = (E_slab - N E_bulk) / 2A in J/m^2, A the area spanned by the slab's first two cell vectors (two
    surfaces, top and bottom)."""
    cell = np.asarray(cell, float)
    area = float(np.linalg.norm(np.cross(cell[0], cell[1])))
    return (e_slab - n_slab * e_bulk_per_atom) / (2 * area) * EV_A2_TO_J_M2, area


def miller_of(info):
    m = (info or {}).get("slab_stats", {}).get("miller_index")
    return [int(x) for x in m] if m is not None else None


def canonical_miller(m):
    """(1, 0, -1) and (1, 1, 0) are the same family in a cubic crystal: sorted absolute values, largest first."""
    return sorted((abs(int(x)) for x in m), reverse=True)


def _f(x, digits=6):
    x = float(x)
    return round(x, digits) if math.isfinite(x) else None


def xyz_text(atoms, comment=""):
    rows = "".join(f"{s} {x:.6f} {y:.6f} {z:.6f}\n" for s, (x, y, z) in zip(atoms.get_chemical_symbols(), atoms.get_positions()))
    return f"{len(atoms)}\n{comment}\n{rows}"


def trim_opt(doc):
    """quacc's OptSchema -> the fields the page shows."""
    res = doc["results"]
    forces = np.asarray(res.get("forces", np.zeros((1, 3))), float).reshape(-1, 3)
    return {"energy_ev": _f(res["energy"]), "converged": bool(doc.get("converged", True)),
            "steps": len(doc.get("trajectory") or []) - 1 if doc.get("trajectory") is not None else 0,
            "fmax_ev_a": _f(np.linalg.norm(forces, axis=1).max())}


def trim_freq(doc):
    """quacc's VibThermoSchema -> frequencies (imaginary ones negative) and the ideal-gas thermochemistry."""
    res, thermo = doc["results"], doc.get("parameters_thermo") or {}
    imag = [-abs(float(np.imag(x)) or abs(float(np.real(x)))) for x in res.get("imag_vib_freqs") or []]
    freqs = imag + [float(np.real(x)) for x in res.get("vib_freqs") or []]
    out = {"frequencies_cm1": [round(x, 2) for x in freqs], "n_imag": int(res.get("n_imag", len(imag))),
           "zpe_ev": _f(res.get("zpe", 0.0)), "temperature_k": _f(thermo.get("temperature", 298.15), 2)}
    for key, name in (("enthalpy", "h_ev"), ("entropy", "s_ev_k"), ("gibbs_energy", "g_ev")):
        if key in res:
            out[name] = _f(res[key], 8 if key == "entropy" else 6)
    meta = (doc.get("molecule_metadata") or {}).get("symmetry") or {}
    if meta.get("point_group"):
        out["point_group"] = str(meta["point_group"])
    if thermo.get("sigma") is not None:
        out["symmetry_number"] = int(thermo["sigma"])
    if thermo.get("spin_multiplicity") is not None:
        out["thermo_spin"] = int(thermo["spin_multiplicity"])
    return out


def spin_thermo(fdoc, atoms, spin, energy, temperature):
    """quacc reads the spin multiplicity for the ideal-gas entropy from the calculator's magnetic moment, which neither
    tblite nor the xtb program reports, so a radical would get S_elec = 0. Redo the thermochemistry with quacc's own
    ThermoSummarize and the multiplicity the SMILES implies."""
    if int(spin) == 1:
        return fdoc
    from quacc.schemas.thermo import ThermoSummarize

    t = ThermoSummarize(atoms, fdoc["results"]["vib_freqs_raw"], energy=energy).ideal_gas(
        temperature=temperature, pressure=1.0, spin_multiplicity=int(spin))
    fdoc = dict(fdoc)
    fdoc["results"] = {**fdoc["results"], **{k: t["results"][k] for k in ("enthalpy", "entropy", "gibbs_energy")}}
    fdoc["parameters_thermo"] = {**(fdoc.get("parameters_thermo") or {}), **t["parameters_thermo"]}
    return fdoc


class _QuietThreads(io.TextIOBase):
    """ASE's thermochemistry prints its tables to stdout. This stands in for sys.stdout and drops what the threads
    registered in `quiet` write, so the other lanes' one-line job reports still reach the console."""

    def __init__(self, real):
        self.real, self.quiet = real, set()

    def write(self, text):
        return len(text) if threading.get_ident() in self.quiet else self.real.write(text)

    def flush(self):
        self.real.flush()


def _quiet():
    if not isinstance(sys.stdout, _QuietThreads):
        sys.stdout = _QuietThreads(sys.stdout)
    return sys.stdout


class QuaccBackend:
    """Runs quacc recipes. xtb is an xtb_backend.XtbBackend (or None), used for GFN2 when tblite is missing."""

    WORKER = os.path.join(os.path.dirname(os.path.abspath(__file__)), "psi4_worker.py")

    def __init__(self, xtb=None, toy_ef=None, psi4_python=""):
        self.version = quacc_version()
        if not self.version:
            raise RuntimeError("quacc is not installed in this environment (pip install quacc)")
        import logging

        logging.getLogger("quacc").setLevel(logging.WARNING)  # quacc logs every run folder at INFO
        self.toy_ef = toy_ef  # --fake: the toy calculator through quacc's Runner instead of a real engine
        self.tblite = has_module("tblite") and toy_ef is None
        self.psi4 = has_module("psi4") and toy_ef is None
        self.xtb = xtb
        # Psi4 only comes from conda, so on a plain venv it runs in its own environment through psi4_worker.py
        self.psi4_python, self.psi4_worker_version, self.psi4_error = "", "", ""
        self._psi4_try = psi4_python
        if psi4_python and not self.psi4 and toy_ef is None:
            try:
                v = self._worker({"op": "version"}, timeout=180)
                self.psi4_python, self.psi4_worker_version = psi4_python, v["psi4"]
            except Exception as e:  # noqa: BLE001 - quacc-psi4 stays off; the reason shows in /health errors
                self.psi4_error = f"{type(e).__name__}: {e}"[:400]

    def ready(self, model):
        if model == "quacc-emt":
            return True
        if model == "quacc-gfn2":
            return bool(self.toy_ef or self.tblite or self.xtb)
        if model == "quacc-psi4":
            return bool(self.toy_ef or self.psi4 or self.psi4_python)
        return False

    def gfn2_engine(self):
        if self.toy_ef:
            return "toy calculator (--fake) through quacc's Runner"
        if self.tblite:
            import tblite

            return f"tblite {getattr(tblite, '__version__', '')} (quacc.recipes.tblite)".replace("  ", " ")
        return f"xtb {self.xtb.version} program through quacc's Runner"

    # ---- one molecule ---------------------------------------------------------------------------------------
    def _calc(self, charge, spin):
        """An ASE calculator for the generic road (toy or the xtb program); charge and spin in atoms.info."""
        import chemjobs as cj

        if self.toy_ef:
            return cj.EFCalculator(self.toy_ef)
        return cj.EFCalculator(self.xtb.ef("gfn2-xtb"))

    def _worker(self, req, timeout=None):
        """One request to psi4_worker.py in the Psi4 environment; a new process each time (Psi4 keeps global state)."""
        python = self.psi4_python or self._psi4_try
        try:
            p = subprocess.run([python, "-X", "utf8", self.WORKER], input=json.dumps(req) + "\n", capture_output=True,
                               text=True, timeout=timeout, encoding="utf-8")
        except subprocess.TimeoutExpired:
            import chemjobs as cj

            raise cj.JobTimeout(f"Psi4 took longer than the {timeout:.0f} s left for this job") from None
        lines = [x for x in p.stdout.splitlines() if x.strip()]
        if not lines:
            raise RuntimeError(f"psi4 worker gave no answer (exit {p.returncode}): {p.stderr.strip()[-300:]}")
        out = json.loads(lines[-1])
        if not out.get("ok"):
            raise RuntimeError(out.get("error") or "psi4 worker failed")
        return out

    def molecule(self, model, atoms, recipe, charge, spin, prm, hook, timeout=None):
        """One molecule through one recipe. Returns the trimmed result (energy, converged, steps, fmax, frequencies,
        thermochemistry, final XYZ)."""
        from quacc import change_settings

        atoms = atoms.copy()
        atoms.info.update({"charge": int(charge), "spin": int(spin)})
        opt = {"fmax": prm.get("fmax", OPT_FMAX), "max_steps": OPT_STEPS, "fn_hook": hook}
        temperature = prm.get("temperature", 298.15)
        with tempfile.TemporaryDirectory(prefix="molastria-quacc-") as d, \
                change_settings({"RESULTS_DIR": d, "GZIP_FILES": False, "CREATE_UNIQUE_DIR": True}):
            if model == "quacc-psi4" and not self.toy_ef and not self.psi4 and self.psi4_python:
                from ase import Atoms

                r = self._worker({"op": "static", "symbols": atoms.get_chemical_symbols(),
                                  "positions": atoms.get_positions().tolist(), "charge": int(charge), "spin": int(spin),
                                  "method": prm["method"], "basis": prm["basis"], "mem": "4GB", "threads": 4},
                                 timeout=timeout)
                out = {"energy_ev": _f(r["energy_ev"])}
                final = Atoms(r["symbols"], positions=r["positions"])
            elif model == "quacc-psi4" and not self.toy_ef:
                from quacc.recipes.psi4.core import static_job

                doc = static_job(atoms, charge=int(charge), spin_multiplicity=int(spin), method=prm["method"],
                                 basis=prm["basis"], mem="4GB", num_threads=4)
                out = {"energy_ev": _f(doc["results"]["energy"])}
                final = doc["atoms"]
            elif self.tblite and model == "quacc-gfn2":
                from quacc.recipes.tblite import core as tb

                kw = {"method": "GFN2-xTB", "charge": int(charge), "multiplicity": int(spin), "verbosity": 0}
                if recipe == "static":
                    doc = tb.static_job(atoms, **kw)
                    out, final = {"energy_ev": _f(doc["results"]["energy"])}, doc["atoms"]
                else:
                    doc = tb.relax_job(atoms, opt_params=opt, **kw)
                    out, final = trim_opt(doc), doc["atoms"]
                    if recipe == "relax_freq":
                        fdoc = tb.freq_job(final, energy=doc["results"]["energy"], temperature=temperature, **kw)
                        out.update(trim_freq(spin_thermo(fdoc, final, spin, doc["results"]["energy"], temperature)))
            else:  # the same calls quacc's recipes make, with this computer's calculator
                from quacc.runners.ase import Runner
                from quacc.schemas.ase import Summarize, VibSummarize

                calc = self._calc(charge, spin)
                if recipe == "static":
                    final = Runner(atoms, calc).run_calc()
                    doc = Summarize(additional_fields={"name": "GFN2-xTB Static"}).run(final, atoms)
                    out = {"energy_ev": _f(doc["results"]["energy"])}
                else:
                    dyn = Runner(atoms, calc).run_opt(**opt)
                    doc = Summarize(additional_fields={"name": "GFN2-xTB Relax"}).opt(dyn)
                    out, final = trim_opt(doc), doc["atoms"]
                    if recipe == "relax_freq":
                        final.info.update({"charge": int(charge), "spin": int(spin)})
                        vib = Runner(final, self._calc(charge, spin)).run_vib()
                        fdoc = VibSummarize(vib, additional_fields={"name": "GFN2-xTB Frequency and Thermo"}) \
                            .vib_and_thermo("ideal_gas", energy=doc["results"]["energy"], temperature=temperature)
                        out.update(trim_freq(spin_thermo(fdoc, final, spin, doc["results"]["energy"], temperature)))
                final = doc["atoms"] if recipe == "static" else final
        out["xyz"] = xyz_text(final, f"quacc {recipe} E = {out['energy_ev']} eV")
        return out

    def flow(self, model, items, recipe, prm, budget):
        """A batch: every molecule through the same recipe, one after another. items: [{smiles, symbols, positions,
        charge, spin}]. One molecule that fails does not stop the others."""
        from ase import Atoms

        out = _quiet()
        out.quiet.add(threading.get_ident())
        try:
            return self._flow(model, items, recipe, prm, budget, Atoms)
        finally:
            out.quiet.discard(threading.get_ident())

    def _flow(self, model, items, recipe, prm, budget, Atoms):
        done = []
        total = len(items)
        for i, it in enumerate(items):
            budget.progress(i, total, it["smiles"])

            def hook(_dyn, i=i, it=it):
                budget.check()

            row = {"smiles": it["smiles"], "charge": it["charge"], "spin": it["spin"], "formula": it.get("formula", "")}
            try:
                left = budget.limit - (time.time() - budget.start) if getattr(budget, "limit", 0) else None
                row.update(self.molecule(model, Atoms(it["symbols"], positions=it["positions"]), recipe, it["charge"],
                                         it["spin"], prm, hook, timeout=max(1.0, left) if left is not None else None))
                row["ok"] = True
            except Exception as e:  # noqa: BLE001 - recorded on this row; a time-out stops the batch below
                if type(e).__name__ == "JobTimeout":
                    raise
                row.update(ok=False, error=f"{type(e).__name__}: {e}"[:240])
            done.append(row)
        budget.progress(total, total, "")
        engine = (f"Psi4 {self.psi4_version()} {prm['method']}/{prm['basis']} (quacc.recipes.psi4)"
                  if model == "quacc-psi4" and not self.toy_ef else self.gfn2_engine())
        return {"recipe": recipe, "engine": engine, "quacc_version": self.version, "items": done,
                "n_ok": sum(1 for r in done if r["ok"])}

    def psi4_version(self):
        if self.psi4_worker_version and not self.psi4:
            return self.psi4_worker_version
        try:
            import psi4

            return psi4.__version__
        except Exception:  # noqa: BLE001
            return ""

    # ---- bulk -> slabs (EMT) --------------------------------------------------------------------------------
    def slabs(self, element, max_index, budget):
        out = _quiet()
        out.quiet.add(threading.get_ident())
        try:
            return self._slabs(element, max_index, budget)
        finally:
            out.quiet.discard(threading.get_ident())

    def _slabs(self, element, max_index, budget):
        """quacc's EMT recipes: relax the conventional fcc cell (with the cell), cut every slab family up to
        max_index with bulk_to_slabs_flow, relax the slabs, and give gamma per surface."""
        from ase.build import bulk
        from quacc import change_settings
        from quacc.recipes.emt.core import relax_job
        from quacc.recipes.emt.slabs import bulk_to_slabs_flow

        budget.progress(0, 2, "bulk")
        hook = lambda _dyn: budget.check()  # noqa: E731
        with tempfile.TemporaryDirectory(prefix="molastria-quacc-") as d, \
                change_settings({"RESULTS_DIR": d, "GZIP_FILES": False, "CREATE_UNIQUE_DIR": True}):
            b = relax_job(bulk(element, "fcc", cubic=True), relax_cell=True, opt_params={"fn_hook": hook, "max_steps": OPT_STEPS})
            atoms_b = b["atoms"]
            e_atom = float(b["results"]["energy"]) / len(atoms_b)
            budget.progress(1, 2, "slabs")
            flow = bulk_to_slabs_flow(atoms_b, run_static=False,
                                      make_slabs_kwargs={"max_index": int(max_index)},
                                      job_params={"relax_job": {"opt_params": {"fn_hook": hook, "max_steps": OPT_STEPS}}})
        rows = []
        for doc in flow["relax"]:
            at = doc["atoms"]
            gamma, area = surface_energy(float(doc["results"]["energy"]), len(at), e_atom, at.cell)
            m = miller_of(at.info)
            rows.append({"miller": m, "family": canonical_miller(m) if m else None, "atoms": len(at),
                         "energy_ev": _f(doc["results"]["energy"]), "area_a2": _f(area, 3),
                         "gamma_j_m2": _f(gamma, 4), "gamma_ev_a2": _f(gamma / EV_A2_TO_J_M2, 6),
                         "converged": bool(doc.get("converged", True)),
                         "steps": max(0, len(doc.get("trajectory") or []) - 1)})
        rows.sort(key=lambda r: (r["gamma_j_m2"] is None, r["gamma_j_m2"]))
        budget.progress(2, 2, "")
        a = float(np.linalg.norm(atoms_b.cell[0]))
        return {"element": element, "engine": "ASE EMT (quacc.recipes.emt)", "quacc_version": self.version,
                "max_index": int(max_index), "a_angstrom": _f(a, 4), "e_bulk_ev_atom": _f(e_atom),
                "bulk_converged": bool(b.get("converged", True)), "slabs": rows,
                "lowest": rows[0]["family"] if rows else None}
