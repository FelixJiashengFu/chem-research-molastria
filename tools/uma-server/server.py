"""MolAstria online models: the site owner's GPU, open to visitors through the account service.

Runs on the owner's computer in the UMA environment. Cloudflare Tunnel connects it to the account Worker
(deploy/account-worker.js, routes /uma/*), which checks the calling site, limits jobs per visitor, decides who may
use which model (ANI-2x is for Pro members, the rest is free), counts the jobs, blocks embargoed regions and adds the
shared secret; this service accepts nothing without that secret and listens on 127.0.0.1 only.

    python -X utf8 tools/uma-server/server.py [--port 8765] [--device auto|cuda|cpu] [--mace-python PATH] [--xtb PATH]

Models: the fairchem checkpoints (UMA-S 1.2.1, 1.2, 1.2.1 D4rev, 1.1; eSEN and AllScAIP trained on OMol25) and
ANI-2x (TorchANI) run in this process; MACE-OFF23 small / medium / large,
MACE-OMOL-0 and MACE-MDP run in mace_worker.py under the MACE environment's Python (--mace-python), because
mace-torch and fairchem need different e3nn versions. GFN2-xTB (also with ALPB water), GFN1-xTB and GFN-FF run the
xtb program (grimme-lab/xtb, LGPL-3.0) once per energy and gradient on the CPU (xtb_backend.py; --xtb or found on
PATH / in this Python environment). A model whose package or environment is missing is simply
reported as not ready. Every model is one ASE calculator (charge and spin multiplicity in atoms.info), and every
calculation is written once against that calculator in chemjobs.py.

Queues: every model has its own queue and computes one job at a time, so a model serves one visitor at a time.
Four lanes run side by side: the fairchem models (they take turns on one GPU worker; UMA-S 1.2.1 stays loaded, two
others are kept), ANI-2x, the MACE models (one GPU process, taking turns) and xTB (the CPU). A visitor has at
most one job waiting or running at a time (the account service passes a hashed visitor id, never the IP).
Finished jobs are cached by model, job, input (canonical SMILES or a hash of the XYZ), charge, spin and params.

The secret is read from tools/uma-server/secret.local (written by new-secret.mjs, kept out of git) or from the
environment variable MOLASTRIA_UMA_SECRET (with --fake the environment variable comes first, for tests).

API v3 (JSON; every request carries the header X-MolAstria-Key):
    GET  /health      {ok, api: 3, ready, model, device, gpu, queue, running, done, cached, models: {id: {ready, jobs, queue, running}}}
    POST /jobs        {model, job, smiles? | xyz?, charge?, spin?, params?, who?}  ->  {id, status, position} or a cached result
                      job: sp opt freq conf scan md rxn ipea spin bde pa polar ir. The old form {smiles, model?, job:
                      ipea | opt | polar, charge?, spin?} (the desktop app's Meta page) works as before.
    GET  /jobs/<id>   {id, status: queued | running | done | error, position, progress?: {done, total, note}, result?, error?}

Same definitions as the desktop runner and the Meta page scripts: RDKit ETKDG (seed 42) + MMFF, then the model,
LBFGS to fmax 0.02 eV/A; adiabatic IP = E(+1) - E(0) and EA = E(0) - E(-1) in eV, each charge state relaxed.
"polar" (MACE-MDP) relaxes with MACE-OFF23 medium and predicts the dipole and polarizability on that geometry.
"""
import argparse
import collections
import hashlib
import hmac
import json
import math
import os
import queue as queue_mod
import re
import secrets
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

import numpy as np

import chemjobs as cj
import xtb_backend as xb

HERE = os.path.dirname(os.path.abspath(__file__))
UMA = "uma-s-1p2p1"
OFF_ELEMENTS = ("H", "C", "N", "O", "F", "P", "S", "Cl", "Br", "I")
OMOL_ELEMENTS = tuple(cj.chemical_symbols[1:84])  # H to Bi, the elements of OMol25
# Jobs by kind of model: A takes charges and spin states, B and C neutral closed-shell molecules only, D is MACE-MDP.
A_JOBS = ("sp", "opt", "freq", "conf", "scan", "md", "rxn", "ipea", "spin", "bde", "pa")
B_JOBS = ("sp", "opt", "freq", "conf", "scan", "md", "rxn")
D_JOBS = ("polar", "ir")
# xTB takes charges and spin states, but its IP / EA are far off (measured 2026-11-11 with xtb 6.7.1, adiabatic, at
# the ETKDG start: GFN2 benzene / ethanol / water 14.2 / 14.4 / 18.1 eV, GFN1 15.0 / 15.9 / 20.5 eV; experiment about
# 9.2 / 10.5 / 12.6 eV; the methods were never fitted to vertical charge changes), so no ipea. GFN-FF has no spin.
X_JOBS = tuple(j for j in A_JOBS if j != "ipea")
JOBS = A_JOBS + D_JOBS
SMILES_JOBS = ("conf", "rxn", "bde", "pa")  # and polar with params.average
INDEX_JOBS = ("scan", "bde", "pa")  # params name atoms by index
TIME_LIMITS = {"sp": 120, "opt": 120}  # seconds; every other job 600
DEFAULT_LIMIT = 600


# id -> name, lane (which worker computes it), jobs, whether charged / open-shell input is allowed, elements, direct.
# Which models offer IP / EA was decided by vertical IPs at the ETKDG geometry, measured on 2026-11-05 (benzene /
# ethanol / water; experiment about 9.2 / 10.5 / 12.6 eV). Models whose charge-state energies came out unreliable
# take neutral closed-shell molecules only, so a "cation" never silently returns a neutral answer:
#   UMA-S 1.2 9.27 / 10.57 / 12.61, AllScAIP-md conserving 9.28 / 10.57 / 12.53, direct 9.38 / 10.55 / 12.65;
#   UMA-S 1.2.1 9.28 / 10.56 / 6.41 and its D4rev fine-tune 9.38 / 10.66 / 6.11 (water too low; offered, with a note);
#   UMA-S 1.1 9.26 / 5.11 / 5.89, eSEN-sm conserving 9.21 / 4.84 / 0.03, eSEN direct models about 0, MACE-OMOL-0
#   9.11 / 5.02 / 0.04: neutral only. UMA-M 1.1 (an 11 GB checkpoint) does not fit this computer (15 GB RAM, 8 GB GPU).
# "direct" models predict forces directly instead of as the energy gradient; their results say so.
def _fair(name, charged, direct=False):
    return {"name": name, "lane": "fair", "jobs": A_JOBS if charged else B_JOBS, "charged": charged,
            "elements": OMOL_ELEMENTS, "direct": direct}


def _mace(name, jobs, elements):
    return {"name": name, "lane": "mace", "jobs": jobs, "charged": False, "elements": elements, "direct": False}


MODELS = {
    UMA: _fair("UMA-S 1.2.1", True),
    "uma-s-1p2": _fair("UMA-S 1.2", True),
    "uma-s-1p2p1-ft-d4rev": _fair("UMA-S 1.2.1 D4rev", True),
    "uma-s-1p1": _fair("UMA-S 1.1", False),
    "allscaip-md-conserving-all-omol": _fair("AllScAIP-md conserving (OMol25)", True),
    "allscaip-md-direct-all-omol": _fair("AllScAIP-md direct (OMol25)", True, direct=True),
    "esen-sm-conserving-all-omol": _fair("eSEN-sm conserving (OMol25)", False),
    "esen-sm-direct-all-omol": _fair("eSEN-sm direct (OMol25)", False, direct=True),
    "esen-md-direct-all-omol": _fair("eSEN-md direct (OMol25)", False, direct=True),
    "ani-2x": {"name": "ANI-2x", "lane": "ani", "jobs": B_JOBS, "charged": False,
               "elements": ("H", "C", "N", "O", "F", "S", "Cl"), "direct": False},
    "mace-off23-small": _mace("MACE-OFF23 small", B_JOBS, OFF_ELEMENTS),
    "mace-off23-medium": _mace("MACE-OFF23 medium", B_JOBS, OFF_ELEMENTS),
    "mace-off23-large": _mace("MACE-OFF23 large", B_JOBS, OFF_ELEMENTS),
    "mace-omol-0": _mace("MACE-OMOL-0", B_JOBS, OMOL_ELEMENTS),  # 83 elements, H to Bi
    "mace-mdp": _mace("MACE-MDP", D_JOBS, OFF_ELEMENTS),
    # GFN2 / GFN1 parametrise H to Rn (Z 1-86); GFN-FF too. Elements past Bi rarely matter and keep the list as OMol25.
    "gfn2-xtb": {"name": "GFN2-xTB", "lane": "xtb", "jobs": X_JOBS, "charged": True, "elements": OMOL_ELEMENTS, "direct": False},
    "gfn2-xtb-alpb-water": {"name": "GFN2-xTB (ALPB water)", "lane": "xtb", "jobs": X_JOBS, "charged": True,
                            "elements": OMOL_ELEMENTS, "direct": False},
    "gfn1-xtb": {"name": "GFN1-xTB", "lane": "xtb", "jobs": X_JOBS, "charged": True, "elements": OMOL_ELEMENTS, "direct": False},
    "gfn-ff": {"name": "GFN-FF", "lane": "xtb", "jobs": B_JOBS, "charged": False, "elements": OMOL_ELEMENTS, "direct": False},
}
SMILES_OK = re.compile(r"^[A-Za-z0-9@+\-\[\]()=#$%/\\.:~*]{1,200}$")
WHO_OK = re.compile(r"^[0-9a-f]{16}$")
MAX_HEAVY, MAX_ATOMS, MAX_QUEUE = 30, 120, 25
MAX_BODY = 32768  # bytes; an XYZ of 120 atoms fits easily
MACE_TIMEOUT = 900  # seconds one MACE call may take before its process is restarted


class BadRequest(ValueError):
    pass


def uma_settings():
    """fairchem's default settings compile the model with torch.compile, which needs Triton. Windows has no Triton,
    so there UMA runs the full-precision path without compilation ("batch"), slower but exact."""
    try:
        import triton  # noqa: F401
        return "default"
    except ImportError:
        return "batch"


def read_secret(prefer_env=False):
    env = os.environ.get("MOLASTRIA_UMA_SECRET", "").strip()
    if prefer_env and env:
        return env
    path = os.path.join(HERE, "secret.local")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            value = f.read().strip()
        if value:
            return value
    return env


# ---- params --------------------------------------------------------------------------------------------------------
def _number(p, key, lo, hi, default, integer=False):
    v = p.get(key, default)
    ok = isinstance(v, (int, float)) and not isinstance(v, bool) and math.isfinite(v) and lo <= v <= hi
    if not ok or (integer and v != int(v)):
        raise BadRequest(f"params.{key} must be {'an integer' if integer else 'a number'} from {lo:g} to {hi:g}")
    return int(v) if integer else float(v)


def _flag(p, key, default=False):
    v = p.get(key, default)
    if not isinstance(v, bool):
        raise BadRequest(f"params.{key} must be true or false")
    return v


def _choice(p, key, options, default):
    v = p.get(key, default)
    if v not in options:
        raise BadRequest(f"params.{key} must be one of: {', '.join(options)}")
    return v


def _indices(p, key, length):
    v = p.get(key)
    if not (isinstance(v, list) and len(v) == length and
            all(isinstance(x, int) and not isinstance(x, bool) and x >= 0 for x in v) and len(set(v)) == length):
        raise BadRequest(f"params.{key} must be {length} different non-negative integers")
    return [int(x) for x in v]


def job_params(job, raw):
    """The request's params for one job, checked against the allowed ranges, with defaults filled in. Unknown keys
    are ignored. Checks that need the molecule (atom indices, spin parity) come later."""
    if not isinstance(raw, dict):
        raise BadRequest("params must be an object")
    temperature = lambda: _number(raw, "temperature", 10, 2000, 298.15)  # noqa: E731
    if job == "opt":
        return {"fmax": _number(raw, "fmax", 0.001, 0.1, 0.02)}
    if job == "freq":
        return {"temperature": temperature(), "symmetry": _number(raw, "symmetry", 1, 24, 1, True)}
    if job == "conf":
        return {"n": _number(raw, "n", 2, 30, 10, True), "temperature": temperature(),
                "window_kcal": _number(raw, "window_kcal", 1, 30, 10)}
    if job == "scan":
        out = {"atoms": _indices(raw, "atoms", 4), "start": _number(raw, "start", -360, 360, -180),
               "end": _number(raw, "end", -360, 360, 180), "points": _number(raw, "points", 3, 24, 13, True)}
        if out["end"] <= out["start"]:
            raise BadRequest("params.end must be greater than params.start")
        return out
    if job == "md":
        return {"temperature": _number(raw, "temperature", 10, 1500, 300), "timestep_fs": _number(raw, "timestep_fs", 0.1, 2.0, 0.5),
                "steps": _number(raw, "steps", 100, 2000, 1000, True), "friction": _number(raw, "friction", 0.001, 0.1, 0.01)}
    if job == "rxn":
        reaction = raw.get("reaction")
        if not isinstance(reaction, str) or not reaction.strip() or len(reaction) > 400:
            raise BadRequest("params.reaction must be a reaction SMILES (A.B>>C.D) of at most 400 characters")
        return {"reaction": reaction.strip(), "thermo": _flag(raw, "thermo"), "temperature": temperature()}
    if job == "ipea":
        return {"mode": _choice(raw, "mode", ("vertical", "adiabatic", "both"), "adiabatic")}
    if job == "spin":
        if "spins" not in raw:
            return {"spins": None}  # the two lowest multiplicities that fit the electron count, filled in later
        v = raw["spins"]
        if not (isinstance(v, list) and len(v) == 2 and all(isinstance(x, int) and not isinstance(x, bool) and 1 <= x <= 4 for x in v)
                and v[0] != v[1]):
            raise BadRequest("params.spins must be two different multiplicities from 1 to 4")
        return {"spins": [int(x) for x in v]}
    if job == "bde":
        return {"bond": _indices(raw, "bond", 2), "thermo": _flag(raw, "thermo"), "temperature": temperature()}
    if job == "pa":
        site = raw.get("site")
        if not (isinstance(site, int) and not isinstance(site, bool) and site >= 0):
            raise BadRequest("params.site must be a non-negative integer (a heavy-atom index)")
        return {"site": site, "mode": _choice(raw, "mode", ("protonate", "deprotonate"), "protonate"),
                "thermo": _flag(raw, "thermo"), "temperature": temperature()}
    if job == "polar":
        return {"average": _flag(raw, "average"), "n": _number(raw, "n", 2, 20, 8, True)}
    return {}  # sp, ir


# ---- the backends: each turns a model into ef(symbols, positions, charge, spin) -> (energy, forces) -----------------
class FairchemBackend:
    """The fairchem checkpoints (UMA, eSEN, AllScAIP). UMA-S 1.2.1 stays loaded; the others are loaded when asked
    for and the least recently used one is dropped, so at most KEEP of them share the 8 GB GPU with it."""

    KEEP = 2

    def __init__(self, device):
        self.device, self.units = device, collections.OrderedDict()
        self.unit(UMA)

    def unit(self, model):
        if model in self.units:
            self.units.move_to_end(model)
            return self.units[model]
        import torch
        from fairchem.core import pretrained_mlip

        while sum(1 for m in self.units if m != UMA) >= self.KEEP:
            drop = next(m for m in self.units if m != UMA)
            del self.units[drop]
            if self.device == "cuda":
                torch.cuda.empty_cache()
        t = time.time()
        self.units[model] = pretrained_mlip.get_predict_unit(model, device=self.device, inference_settings=uma_settings())
        print(f"  loaded {model} in {time.time() - t:.1f} s", flush=True)
        return self.units[model]

    def ef(self, model):
        from ase import Atoms
        from ase.calculators.calculator import all_changes
        from fairchem.core import FAIRChemCalculator

        calc = FAIRChemCalculator(self.unit(model), task_name="omol")

        def ef(symbols, positions, q, s):
            atoms = Atoms(symbols, positions=positions)
            atoms.info.update({"charge": q, "spin": s})
            calc.calculate(atoms, ["energy", "forces"], all_changes)
            return calc.results["energy"], calc.results["forces"]

        return ef


class AniBackend:
    def __init__(self, device):
        import torchani

        self.model = torchani.models.ANI2x(periodic_table_index=True).to(device)

    def ef(self, model):
        from ase import Atoms
        from ase.calculators.calculator import all_changes

        calc = self.model.ase()

        def ef(symbols, positions, q, s):  # neutral closed-shell only, checked on submission
            atoms = Atoms(symbols, positions=positions)
            calc.calculate(atoms, ["energy", "forces"], all_changes)
            return calc.results["energy"], calc.results["forces"]

        return ef


class MaceBackend:
    """mace_worker.py in the MACE environment, one JSON line per request; restarted if it dies or hangs."""

    def __init__(self, python):
        self.python, self.proc, self.lines = python, None, None
        self.info = self.call({"op": "ping"}, timeout=180)

    def start(self):
        env = dict(os.environ, PYTHONUTF8="1")
        self.proc = subprocess.Popen([self.python, "-X", "utf8", "-u", os.path.join(HERE, "mace_worker.py")],
                                     stdin=subprocess.PIPE, stdout=subprocess.PIPE, stderr=None, env=env,
                                     text=True, encoding="utf-8", bufsize=1)
        self.lines = queue_mod.Queue()
        proc, lines = self.proc, self.lines

        def read():
            for line in proc.stdout:
                lines.put(line)
            lines.put(None)  # the process ended

        threading.Thread(target=read, daemon=True).start()

    def call(self, req, timeout=MACE_TIMEOUT):
        if self.proc is None or self.proc.poll() is not None:
            self.start()
        self.proc.stdin.write(json.dumps(req) + "\n")
        self.proc.stdin.flush()
        try:
            line = self.lines.get(timeout=timeout)
        except queue_mod.Empty:
            self.proc.kill()
            self.proc = None
            raise RuntimeError(f"the MACE process took longer than {timeout} s and was restarted")
        if line is None:
            self.proc = None
            raise RuntimeError("the MACE process stopped; it starts again with the next job")
        reply = json.loads(line)
        if not reply.get("ok"):
            raise RuntimeError(reply.get("error") or "MACE failed")
        return reply

    def ef(self, model):
        def ef(symbols, positions, q, s):
            r = self.call({"op": "calc", "model": model, "symbols": list(symbols),
                           "positions": [[float(x) for x in row] for row in positions], "charge": q, "spin": s})
            return float(r["energy_ev"]), r["forces"]

        return ef

    def dp(self, symbols, positions):
        """MACE-MDP dipole in e*A and polarizability converted from e*A^2/V to a volume in A^3."""
        r = self.call({"op": "polar", "model": "mace-mdp", "symbols": list(symbols),
                       "positions": [[float(x) for x in row] for row in positions]})
        return np.array(r["dipole"], float), np.array(r["polarizability"], float) * cj.POL_TO_A3


class Service:
    def __init__(self, device, cache_path, fake=False, mace_python="", xtb=""):
        self.device_wanted, self.cache_path, self.fake, self.mace_python = device, cache_path, fake, mace_python
        self.xtb = xtb
        self.device, self.gpu = "", ""
        self.backends, self.errors = {}, {}
        self.loading = True
        self.lock = threading.Lock()
        self.queues = {lane: collections.deque() for lane in ("fair", "ani", "mace", "xtb")}
        self.wakes = {lane: threading.Event() for lane in self.queues}
        self.running = {lane: None for lane in self.queues}
        self.jobs = {}
        self.done = 0
        self.cache = {}
        if os.path.exists(cache_path):
            try:
                with open(cache_path, encoding="utf-8") as f:
                    self.cache = json.load(f)
            except (OSError, ValueError):
                self.cache = {}
        threading.Thread(target=self.load, daemon=True).start()

    # ---- loading --------------------------------------------------------------------------------------------
    def load(self):
        if self.fake:  # for tests: no models; a toy calculator, numbers marked as made up
            self.device = "fake"
            self.backends = {lane: None for lane in self.queues}
        else:
            import torch

            if self.device_wanted in ("auto", "cuda") and torch.cuda.is_available():
                self.device, self.gpu = "cuda", torch.cuda.get_device_name(0)
            else:
                self.device = "cpu"
            for lane, make in (("fair", lambda: FairchemBackend(self.device)), ("ani", lambda: AniBackend(self.device)),
                               ("mace", lambda: MaceBackend(self.mace_python) if self.mace_python else None)):
                if lane == "mace" and not self.mace_python:
                    self.errors[lane] = "no MACE environment (start with --mace-python)"
                    continue
                print(f"Loading the {lane} models on {self.device} {self.gpu}".rstrip(), flush=True)
                try:
                    self.backends[lane] = make()
                except Exception as e:  # noqa: BLE001 - that lane is reported as not ready, the others still work
                    self.errors[lane] = f"{type(e).__name__}: {e}"[:400]
                    print(f"  not available: {self.errors[lane]}", flush=True)
            exe = xb.find_xtb(self.xtb)
            if not exe:
                self.errors["xtb"] = "no xtb program (install xtb, or start with --xtb PATH)"
            else:
                try:
                    self.backends["xtb"] = xb.XtbBackend(exe)
                    print(f"xTB {self.backends['xtb'].version}: {exe}", flush=True)
                except Exception as e:  # noqa: BLE001
                    self.errors["xtb"] = f"{type(e).__name__}: {e}"[:400]
        self.loading = False
        for lane in self.backends:
            threading.Thread(target=self.work, args=(lane,), daemon=True).start()
        print("Ready: " + ", ".join(m for m, v in MODELS.items() if v["lane"] in self.backends), flush=True)

    def ready(self, model):
        return MODELS[model]["lane"] in self.backends

    def calculator(self, model):
        """The model as one ASE calculator."""
        if self.fake:
            return cj.EFCalculator(cj.toy_ef)
        return cj.EFCalculator(self.backends[MODELS[model]["lane"]].ef(model))

    def dp(self):
        return cj.toy_dp if self.fake else self.backends["mace"].dp

    # ---- the workers, one per lane ----------------------------------------------------------------------------
    def work(self, lane):
        while True:
            self.wakes[lane].wait(5)
            self.wakes[lane].clear()
            while True:
                with self.lock:
                    q = self.queues[lane]
                    if not q:
                        break
                    jid = q.popleft()
                    job = self.jobs.get(jid)
                    if not job:
                        continue
                    job["status"], job["started"] = "running", time.time()
                    self.running[lane] = jid
                spec = job["spec"]

                def report(progress, job=job):
                    with self.lock:
                        job["progress"] = progress

                try:
                    result = self.compute(spec, cj.Budget(TIME_LIMITS.get(spec["job"], DEFAULT_LIMIT), report))
                    with self.lock:
                        job.update(status="done", result=result)
                        self.cache[job["key"]] = result
                        self.done += 1
                    self.save_cache()
                except Exception as e:  # noqa: BLE001 - one bad molecule must not stop the service
                    with self.lock:
                        job.update(status="error", error=f"{type(e).__name__}: {e}"[:300])
                finally:
                    with self.lock:
                        self.running[lane] = None
                        job["finished"] = time.time()
                print(f"{job['status']}: {spec['model']} {spec['job']} {spec['smiles'] or ('xyz' if spec['xyz'] else '')} "
                      f"({job['finished'] - job['started']:.1f} s)", flush=True)
            self.prune()

    def compute(self, spec, budget):
        Chem = cj._rdkit()
        model, job, q, s, prm = spec["model"], spec["job"], spec["charge"], spec["spin"], spec["params"]
        t = time.time()
        out = {"model": model, "job": job, "smiles": spec["smiles"], "charge": q, "spin": s, "params": prm}
        st = None
        if spec["xyz"]:
            symbols, positions = cj.parse_xyz(spec["xyz"])
            st = cj.Structure(symbols, positions, q, s, "XYZ input")
        elif spec["source"]:
            mol_h = Chem.AddHs(Chem.MolFromSmiles(spec["source"]))
            symbols, positions = cj.embed(Chem.Mol(mol_h))
            st = cj.Structure(symbols, positions, q, s, spec["smiles"], mol_h)
        label = f"{st.title} {MODELS[model]['name']}" if st else ""
        if job in D_JOBS:
            geo = self.calculator("mace-off23-medium")
            if job == "polar":
                r = cj.run_polar(st, geo, self.dp(), budget, prm["average"], prm["n"])
            else:
                r = cj.run_ir(st, geo, self.dp(), budget)
        else:
            calc = self.calculator(model)
            if job == "sp":
                r = cj.run_sp(st, calc, budget, label)
            elif job == "opt":
                r = cj.run_opt(st, calc, budget, label, prm["fmax"])
            elif job == "freq":
                r = cj.run_freq(st, calc, budget, label, prm["temperature"], prm["symmetry"])
            elif job == "conf":
                r = cj.run_conf(st, calc, budget, label, prm["n"], prm["temperature"], prm["window_kcal"])
            elif job == "scan":
                r = cj.run_scan(st, calc, budget, label, prm["atoms"], prm["start"], prm["end"], prm["points"])
            elif job == "md":
                r = cj.run_md(st, calc, budget, label, prm["temperature"], prm["timestep_fs"], prm["steps"], prm["friction"])
            elif job == "rxn":
                species, _ = cj.parse_reaction(prm["reaction"])
                r = cj.run_rxn(species, calc, budget, prm["thermo"], prm["temperature"])
                r["reaction"] = prm["reaction"]
            elif job == "ipea":
                r = cj.run_ipea(st, calc, budget, label, prm["mode"])
            elif job == "spin":
                r = cj.run_spin(st, calc, budget, label, prm["spins"])
            elif job == "bde":
                frags = cj.bde_fragments(st.mol, *prm["bond"])
                r = cj.run_bde(st, frags, calc, budget, label, prm["bond"], prm["thermo"], prm["temperature"])
            elif job == "pa":
                partner = cj.pa_partner(st.mol, prm["site"], prm["mode"])
                r = cj.run_pa(st, partner, calc, budget, label, prm["site"], prm["mode"], prm["thermo"], prm["temperature"])
            else:
                raise ValueError(f"unknown job {job}")
        out.update(r)
        if MODELS[model]["lane"] == "xtb" and job in ("sp", "opt") and not self.fake:
            # what the xtb run prints besides the energy, on the final structure: gap, frontier orbitals, dipole, charges
            symbols, positions = cj.parse_xyz(out["xyz"])
            out["xtb"] = self.backends["xtb"].properties(model, symbols, positions, q, s)
        if job == "ipea" and model == UMA and "ip_ev" in out:  # the AI Lab's column names
            out.update(ip_uma_s=out["ip_ev"], ea_uma_s=out["ea_ev"])
        if MODELS[model]["direct"]:
            out["direct_forces"] = True
        if self.fake:
            out["fake"] = True
        out["seconds"] = round(time.time() - t, 1)
        return out

    def save_cache(self):
        with self.lock:
            data = json.dumps(self.cache)
        tmp = self.cache_path + ".tmp"
        with open(tmp, "w", encoding="utf-8") as f:
            f.write(data)
        os.replace(tmp, self.cache_path)

    def prune(self):
        cutoff = time.time() - 3600
        with self.lock:
            for jid in [j for j, v in self.jobs.items() if v.get("finished", time.time()) < cutoff]:
                del self.jobs[jid]

    # ---- requests -------------------------------------------------------------------------------------------
    def parse(self, body):
        """A request -> the job's spec {model, job, smiles, xyz, charge, spin, params, input}. Raises BadRequest."""
        from rdkit.Chem import Descriptors

        Chem = cj._rdkit()  # visitors send broken SMILES; the reply says so, the console stays readable
        model, job = str(body.get("model") or UMA), str(body.get("job", "ipea"))
        m = MODELS[model]
        smiles, xyz = body.get("smiles"), body.get("xyz")
        has_smiles, has_xyz = smiles not in (None, ""), xyz not in (None, "")
        params = job_params(job, body.get("params") if body.get("params") is not None else {})
        if job == "rxn":
            if has_smiles or has_xyz:
                raise BadRequest("rxn takes the reaction in params.reaction, not smiles or xyz")
        elif has_smiles == has_xyz:
            raise BadRequest("give exactly one of smiles and xyz")
        if has_xyz and (job in SMILES_JOBS or (job == "polar" and params["average"])):
            raise BadRequest(f"{job}{' with average' if job == 'polar' else ''} needs a SMILES, not xyz")

        def charge_spin(default_charge, default_spin):
            try:
                charge = int(body.get("charge", default_charge))
                spin = int(body.get("spin", default_spin(charge)))
            except (TypeError, ValueError):
                raise BadRequest("charge and spin must be integers") from None
            if not (-2 <= charge <= 2 and 1 <= spin <= 4):
                raise BadRequest("charge must be -2..2 and spin multiplicity 1..4")
            return charge, spin

        def check_elements(found):
            outside = sorted(set(found) - set(m["elements"]))
            if outside:
                raise BadRequest(f"{m['name']} does not know {', '.join(outside)}")

        spec = {"model": model, "job": job, "smiles": None, "source": None, "xyz": None}
        mol_h, symbols = None, None
        if job == "rxn":
            species, canonical = self.reaction(params["reaction"], m)
            params["reaction"] = canonical
            charge = sum(sp["charge"] * sp["count"] for sp in species if sp["side"] == "reactant")
            spec.update(charge=charge, spin=None, input="rxn")
        elif has_smiles:
            smiles = str(smiles).strip()
            if not SMILES_OK.match(smiles):
                raise BadRequest("SMILES has unsupported characters or is too long")
            mol = Chem.MolFromSmiles(smiles)
            if mol is None:
                raise BadRequest("RDKit cannot parse this SMILES")
            mol_h = Chem.AddHs(mol)
            if mol.GetNumHeavyAtoms() > MAX_HEAVY or mol_h.GetNumAtoms() > MAX_ATOMS:
                raise BadRequest(f"at most {MAX_HEAVY} heavy atoms and {MAX_ATOMS} atoms in all")
            check_elements(a.GetSymbol() for a in mol.GetAtoms())
            radicals = Descriptors.NumRadicalElectrons(mol)
            charge, spin = charge_spin(Chem.GetFormalCharge(mol), lambda _: radicals + 1)
            if not m["charged"] and (charge != 0 or spin != 1 or radicals):
                raise BadRequest(f"{m['name']} handles neutral closed-shell molecules only")
            canonical = Chem.MolToSmiles(mol)
            symbols = [a.GetSymbol() for a in mol_h.GetAtoms()]
            # Atom indices in params follow the SMILES as sent, so those jobs build the molecule from it (and cache
            # by it); the others from the canonical SMILES, as before.
            source = smiles if job in INDEX_JOBS else canonical
            spec.update(smiles=canonical, source=source, charge=charge, spin=spin,
                        input=canonical if source == canonical else f"{canonical}@{source}")
        else:
            try:
                symbols, positions = cj.parse_xyz(xyz)
            except ValueError as e:
                raise BadRequest(str(e)) from None
            check_elements(symbols)
            charge, spin = charge_spin(0, lambda q: 1 if cj.electrons(symbols, q) % 2 == 0 else 2)
            if not cj.spin_fits(symbols, charge, spin):
                raise BadRequest("this charge and spin multiplicity do not fit the number of electrons")
            if not m["charged"] and (charge != 0 or spin != 1):
                raise BadRequest(f"{m['name']} handles neutral closed-shell molecules only")
            text = "".join(f"{s} {x:.8f} {y:.8f} {z:.8f}\n" for s, (x, y, z) in zip(symbols, positions))
            spec.update(xyz=f"{len(symbols)}\n\n{text}", charge=charge, spin=spin,
                        input="xyz:" + hashlib.sha256(text.encode()).hexdigest())
        n_atoms = len(symbols) if symbols else 0
        if job == "scan" and max(params["atoms"]) >= n_atoms:
            raise BadRequest(f"params.atoms must be atom indices below {n_atoms}")
        if job == "spin":
            if params["spins"] is None:
                params["spins"] = [1, 3] if cj.electrons(symbols, spec["charge"]) % 2 == 0 else [2, 4]
            if not all(cj.spin_fits(symbols, spec["charge"], x) for x in params["spins"]):
                raise BadRequest("params.spins must fit the number of electrons (odd multiplicities for an even count)")
        if job == "bde":
            if (spec["charge"], spec["spin"]) != cj.species_of(mol_h):
                raise BadRequest("bde takes the charge and spin the SMILES implies")
            try:
                cj.bde_fragments(mol_h, *params["bond"])
            except ValueError as e:
                raise BadRequest(str(e)) from None
        if job == "pa":
            try:
                partner = cj.pa_partner(mol_h, params["site"], params["mode"])
            except ValueError as e:
                raise BadRequest(str(e)) from None
            if not -2 <= spec["charge"] + partner["delta"] <= 2:
                raise BadRequest("the charge after the proton moves must stay within -2..2")
        spec["params"] = params
        return spec

    def reaction(self, text, m):
        Chem = cj._rdkit()
        try:
            species, canonical = cj.parse_reaction(text, lambda s: bool(SMILES_OK.match(s)))
        except ValueError as e:
            raise BadRequest(str(e)) from None
        for sp in species:
            mol = Chem.MolFromSmiles(sp["smiles"])
            if mol.GetNumHeavyAtoms() > MAX_HEAVY or Chem.AddHs(mol).GetNumAtoms() > MAX_ATOMS:
                raise BadRequest(f"each species may have at most {MAX_HEAVY} heavy atoms and {MAX_ATOMS} atoms in all")
            outside = sorted({a.GetSymbol() for a in mol.GetAtoms()} - set(m["elements"]))
            if outside:
                raise BadRequest(f"{m['name']} does not know {', '.join(outside)}")
            if not m["charged"] and (sp["charge"] != 0 or sp["spin"] != 1):
                raise BadRequest(f"{m['name']} handles neutral closed-shell species only ({sp['smiles']})")
            if not (-2 <= sp["charge"] <= 2 and 1 <= sp["spin"] <= 4):
                raise BadRequest(f"each species needs charge -2..2 and spin multiplicity 1..4 ({sp['smiles']})")
        return species, canonical

    def submit(self, body):
        model, job = str(body.get("model") or UMA), str(body.get("job", "ipea"))
        who = str(body.get("who") or "")
        if model not in MODELS:
            return 400, {"error": "unknown model"}
        m = MODELS[model]
        if job not in m["jobs"]:
            return 400, {"error": f"{m['name']} supports only: {', '.join(m['jobs'])}"}
        if not self.ready(model):
            return 503, {"error": "the model is still loading" if self.loading else f"{m['name']} is not available on this computer"}
        if who and not WHO_OK.match(who):
            return 400, {"error": "bad visitor id"}
        try:
            spec = self.parse(body)
        except BadRequest as e:
            return 400, {"error": str(e)}
        # v3: input, charge, spin and params all decide the answer; results cached before v3 lack the new fields.
        key = "|".join(["v3", model, job, spec.pop("input"), str(spec["charge"]), str(spec["spin"]),
                        json.dumps(spec["params"], sort_keys=True)])
        lane = m["lane"]
        with self.lock:
            if key in self.cache:
                return 200, {"status": "done", "cached": True, "result": self.cache[key]}
            for jid, v in self.jobs.items():  # the same job already waiting or running
                if v["key"] == key and v["status"] in ("queued", "running"):
                    return 202, self.view(jid)
            if who and any(v.get("who") == who and v["status"] in ("queued", "running") for v in self.jobs.values()):
                return 429, {"error": "one job at a time: wait for your current job to finish"}
            if len(self.queues[lane]) >= MAX_QUEUE:
                return 503, {"error": "the queue is full, try again in a few minutes"}
            jid = secrets.token_hex(8)
            self.jobs[jid] = {"key": key, "who": who, "status": "queued", "created": time.time(), "lane": lane, "spec": spec}
            self.queues[lane].append(jid)
        self.wakes[lane].set()
        return 202, self.view(jid)

    def view(self, jid):
        v = self.jobs.get(jid)
        if not v:
            return None
        out = {"id": jid, "status": v["status"], "model": v["spec"]["model"], "job": v["spec"]["job"],
               "smiles": v["spec"]["smiles"]}
        if v["status"] == "queued":
            q = self.queues[v["lane"]]
            # jobs ahead in this model's lane, plus the one it is computing now
            out["position"] = (list(q).index(jid) + 1 if jid in q else 0) + (1 if self.running[v["lane"]] else 0)
        if v["status"] == "running" and v.get("progress"):
            out["progress"] = v["progress"]
        if v["status"] == "done":
            out["result"] = v["result"]
        if v["status"] == "error":
            out["error"] = v["error"]
        return out

    def health(self):
        with self.lock:
            models = {}
            for mid, m in MODELS.items():
                lane = m["lane"]
                waiting = sum(1 for j in self.queues[lane] if self.jobs.get(j, {}).get("spec", {}).get("model") == mid)
                run = self.running[lane]
                models[mid] = {"ready": lane in self.backends, "jobs": list(m["jobs"]), "queue": waiting,
                               "running": bool(run and self.jobs.get(run, {}).get("spec", {}).get("model") == mid)}
            return {"ok": not self.loading and bool(self.backends), "api": 3, "ready": bool(self.backends),
                    "loading": self.loading, "errors": self.errors, "model": UMA, "device": self.device, "gpu": self.gpu,
                    "queue": sum(len(q) for q in self.queues.values()), "running": any(self.running.values()),
                    "done": self.done, "cached": len(self.cache), "models": models}


def make_handler(service, secret):
    class Handler(BaseHTTPRequestHandler):
        server_version = "MolAstriaModels/3"
        timeout = 15  # seconds a connection may stay idle; a stalled client cannot hold a thread

        def log_message(self, fmt, *args):  # quiet; the workers print one line per job
            pass

        def reply(self, status, data):
            raw = json.dumps(data).encode("utf-8")
            self.send_response(status)
            self.send_header("Content-Type", "application/json")
            self.send_header("Content-Length", str(len(raw)))
            self.end_headers()
            self.wfile.write(raw)

        def allowed(self):
            given = self.headers.get("X-MolAstria-Key", "")
            if secret and hmac.compare_digest(given.encode(), secret.encode()):
                return True
            self.reply(401, {"error": "unauthorized"})
            return False

        def do_GET(self):
            if not self.allowed():
                return
            if self.path == "/health":
                return self.reply(200, service.health())
            m = re.fullmatch(r"/jobs/([0-9a-f]{16})", self.path)
            if m:
                with service.lock:
                    v = service.view(m.group(1))
                return self.reply(200, v) if v else self.reply(404, {"error": "no such job (finished jobs are kept for an hour)"})
            self.reply(404, {"error": "not found"})

        def do_POST(self):
            if not self.allowed():
                return
            if self.path != "/jobs":
                return self.reply(404, {"error": "not found"})
            n = int(self.headers.get("Content-Length") or 0)
            if n > MAX_BODY:
                return self.reply(413, {"error": "request too large"})
            try:
                body = json.loads(self.rfile.read(n) or b"{}")
            except ValueError:
                return self.reply(400, {"error": "not JSON"})
            status, data = service.submit(body if isinstance(body, dict) else {})
            self.reply(status, data)

    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--mace-python", default=os.environ.get("MOLASTRIA_MACE_PYTHON", ""),
                    help="python.exe of the environment with mace-torch (the MACE models are off without it)")
    ap.add_argument("--xtb", default="", help="the xtb executable (default: MOLASTRIA_XTB, this Python environment, PATH)")
    ap.add_argument("--cache", default="", help="result cache (default cache.local.json; cache.fake.local.json with --fake)")
    ap.add_argument("--fake", action="store_true", help="tests only: no models, a toy calculator, made-up numbers")
    args = ap.parse_args()
    if os.name == "nt" and not sys.flags.utf8_mode:
        sys.exit("Start Python in UTF-8 mode (python -X utf8 ...), as start.ps1 does: otherwise fairchem reads its data files with the local code page and fails.")
    secret = read_secret(prefer_env=args.fake)
    if len(secret) < 32:
        sys.exit("No secret: run  node tools/uma-server/new-secret.mjs  first (it also gives the account service the same value).")
    cache = args.cache or os.path.join(HERE, "cache.fake.local.json" if args.fake else "cache.local.json")
    service = Service(args.device, cache, fake=args.fake, mace_python=args.mace_python, xtb=args.xtb)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(service, secret))
    print(f"MolAstria online models on http://127.0.0.1:{args.port} (only reachable through the tunnel and the account service)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
