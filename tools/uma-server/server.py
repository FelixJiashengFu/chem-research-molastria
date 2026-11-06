"""MolAstria online models: the site owner's GPU, open to visitors through the account service.

Runs on the owner's computer in the UMA environment. Cloudflare Tunnel connects it to the account Worker
(deploy/account-worker.js, routes /uma/*), which checks the calling site, limits jobs per visitor, decides who may
use which model (ANI-2x is for Pro members, the rest is free), blocks embargoed regions and adds the shared secret;
this service accepts nothing without that secret and listens on 127.0.0.1 only.

    python -X utf8 tools/uma-server/server.py [--port 8765] [--device auto|cuda|cpu] [--mace-python PATH]

Models: the fairchem checkpoints (UMA-S 1.2.1, 1.2, 1.2.1 D4rev, 1.1; eSEN and AllScAIP trained on OMol25) and
ANI-2x (TorchANI) run in this process; MACE-OFF23 small / medium / large,
MACE-OMOL-0 and MACE-MDP run in mace_worker.py under the MACE environment's Python (--mace-python), because
mace-torch and fairchem need different e3nn versions. A model whose package or environment is missing is simply
reported as not ready.

Queues: every model has its own queue and computes one job at a time, so a model serves one visitor at a time.
Three lanes run side by side: the fairchem models (they take turns on one GPU worker; UMA-S 1.2.1 stays loaded, two
others are kept), ANI-2x, and the MACE models (one GPU process, taking turns). A visitor has at
most one job waiting or running at a time (the account service passes a hashed visitor id, never the IP).
Finished molecules are cached by canonical SMILES and answered at once.

The secret is read from tools/uma-server/secret.local (written by new-secret.mjs, kept out of git) or from the
environment variable MOLASTRIA_UMA_SECRET.

API (JSON; every request carries the header X-MolAstria-Key):
    GET  /health      {ok, ready, model, device, gpu, queue, running, done, cached, models: {id: {ready, jobs, queue, running}}}
    POST /jobs        {smiles, model?, job: "ipea" | "opt" | "polar", charge?, spin?, who?}  ->  {id, status, position} or a cached result
    GET  /jobs/<id>   {id, status: queued | running | done | error, position, result?, error?}

Same definitions as the desktop runner and the Meta page scripts: RDKit ETKDG (seed 42) + MMFF, then the model,
LBFGS to fmax 0.02 eV/A; adiabatic IP = E(+1) - E(0) and EA = E(0) - E(-1) in eV, each charge state relaxed.
"polar" (MACE-MDP) relaxes with MACE-OFF23 medium and predicts the dipole and polarizability on that geometry.
"""
import argparse
import collections
import hmac
import io
import json
import os
import queue as queue_mod
import re
import secrets
import subprocess
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
UMA = "uma-s-1p2p1"
OFF_ELEMENTS = ("H", "C", "N", "O", "F", "P", "S", "Cl", "Br", "I")
# id -> name, lane (which worker computes it), jobs, whether charged / open-shell input is allowed, elements (None: any).
# Which models offer IP / EA was decided by vertical IPs at the ETKDG geometry, measured on 2026-11-05 (benzene /
# ethanol / water; experiment about 9.2 / 10.5 / 12.6 eV). Models whose charge-state energies came out unreliable
# take neutral closed-shell molecules only, so a "cation" never silently returns a neutral answer:
#   UMA-S 1.2 9.27 / 10.57 / 12.61, AllScAIP-md conserving 9.28 / 10.57 / 12.53, direct 9.38 / 10.55 / 12.65;
#   UMA-S 1.2.1 9.28 / 10.56 / 6.41 and its D4rev fine-tune 9.38 / 10.66 / 6.11 (water too low; offered, with a note);
#   UMA-S 1.1 9.26 / 5.11 / 5.89, eSEN-sm conserving 9.21 / 4.84 / 0.03, eSEN direct models about 0, MACE-OMOL-0
#   9.11 / 5.02 / 0.04: neutral only. UMA-M 1.1 (an 11 GB checkpoint) does not fit this computer (15 GB RAM, 8 GB GPU).
def _fair(name, ipea):
    jobs = ("ipea", "opt") if ipea else ("opt",)
    return {"name": name, "lane": "fair", "jobs": jobs, "charged": ipea, "elements": None}


MODELS = {
    UMA: _fair("UMA-S 1.2.1", True),
    "uma-s-1p2": _fair("UMA-S 1.2", True),
    "uma-s-1p2p1-ft-d4rev": _fair("UMA-S 1.2.1 D4rev", True),
    "uma-s-1p1": _fair("UMA-S 1.1", False),
    "allscaip-md-conserving-all-omol": _fair("AllScAIP-md conserving (OMol25)", True),
    "allscaip-md-direct-all-omol": _fair("AllScAIP-md direct (OMol25)", True),
    "esen-sm-conserving-all-omol": _fair("eSEN-sm conserving (OMol25)", False),
    "esen-sm-direct-all-omol": _fair("eSEN-sm direct (OMol25)", False),
    "esen-md-direct-all-omol": _fair("eSEN-md direct (OMol25)", False),
    "ani-2x": {"name": "ANI-2x", "lane": "ani", "jobs": ("opt",), "charged": False,
               "elements": ("H", "C", "N", "O", "F", "S", "Cl")},
    "mace-off23-small": {"name": "MACE-OFF23 small", "lane": "mace", "jobs": ("opt",), "charged": False, "elements": OFF_ELEMENTS},
    "mace-off23-medium": {"name": "MACE-OFF23 medium", "lane": "mace", "jobs": ("opt",), "charged": False, "elements": OFF_ELEMENTS},
    "mace-off23-large": {"name": "MACE-OFF23 large", "lane": "mace", "jobs": ("opt",), "charged": False, "elements": OFF_ELEMENTS},
    "mace-omol-0": {"name": "MACE-OMOL-0", "lane": "mace", "jobs": ("opt",), "charged": False, "elements": None},  # 83 elements, H to Bi
    "mace-mdp": {"name": "MACE-MDP", "lane": "mace", "jobs": ("polar",), "charged": False, "elements": OFF_ELEMENTS},
}
JOBS = ("ipea", "opt", "polar")
SMILES_OK = re.compile(r"^[A-Za-z0-9@+\-\[\]()=#$%/\\.:~*]{1,200}$")
WHO_OK = re.compile(r"^[0-9a-f]{16}$")
MAX_HEAVY, MAX_ATOMS, MAX_QUEUE, MAX_STEPS = 30, 120, 25, 400
MACE_TIMEOUT = 900  # seconds one MACE call may take before its process is restarted
E_A_TO_DEBYE = 4.803204  # 1 e*Angstrom in debye
POL_TO_A3 = 14.399645  # 1 e*Angstrom^2/V as a polarizability volume, in Angstrom^3 (e^2 / 4 pi eps0 in eV*Angstrom)


def uma_settings():
    """fairchem's default settings compile the model with torch.compile, which needs Triton. Windows has no Triton,
    so there UMA runs the full-precision path without compilation ("batch"), slower but exact."""
    try:
        import triton  # noqa: F401
        return "default"
    except ImportError:
        return "batch"


def read_secret():
    path = os.path.join(HERE, "secret.local")
    if os.path.exists(path):
        with open(path, encoding="utf-8") as f:
            value = f.read().strip()
        if value:
            return value
    return os.environ.get("MOLASTRIA_UMA_SECRET", "").strip()


def lbfgs(atoms):
    from ase.optimize import LBFGS

    opt = LBFGS(atoms, logfile=None)
    opt.run(fmax=0.02, steps=MAX_STEPS)
    return atoms.get_positions().tolist(), float(atoms.get_potential_energy()), int(opt.nsteps)


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

    def relax(self, model, symbols, positions, q, s):
        from ase import Atoms
        from fairchem.core import FAIRChemCalculator

        atoms = Atoms(symbols, positions=positions)
        atoms.info.update({"charge": q, "spin": s})
        atoms.calc = FAIRChemCalculator(self.unit(model), task_name="omol")
        return lbfgs(atoms)


class AniBackend:
    def __init__(self, device):
        import torchani

        self.model = torchani.models.ANI2x(periodic_table_index=True).to(device)

    def relax(self, model, symbols, positions, q, s):
        from ase import Atoms

        atoms = Atoms(symbols, positions=positions)
        atoms.calc = self.model.ase()
        return lbfgs(atoms)


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

    def relax(self, model, symbols, positions, q, s):
        r = self.call({"op": "relax", "model": model, "symbols": symbols, "positions": positions, "charge": q, "spin": s})
        return r["positions"], float(r["energy_ev"]), int(r["steps"])

    def polar(self, symbols, positions):
        return self.call({"op": "polar", "model": "mace-mdp", "symbols": symbols, "positions": positions})


class Service:
    def __init__(self, device, cache_path, fake=False, mace_python=""):
        self.device_wanted, self.cache_path, self.fake, self.mace_python = device, cache_path, fake, mace_python
        self.device, self.gpu = "", ""
        self.backends, self.errors = {}, {}
        self.loading = True
        self.lock = threading.Lock()
        self.queues = {lane: collections.deque() for lane in ("fair", "ani", "mace")}
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
        if self.fake:  # for tests: no models, made-up numbers marked as such
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
        self.loading = False
        for lane in self.backends:
            threading.Thread(target=self.work, args=(lane,), daemon=True).start()
        print("Ready: " + ", ".join(m for m, v in MODELS.items() if v["lane"] in self.backends), flush=True)

    def ready(self, model):
        return MODELS[model]["lane"] in self.backends

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
                try:
                    result = self.compute(job["params"])
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
                p = job["params"]
                print(f"{job['status']}: {p['model']} {p['job']} {p['smiles']} ({job['finished'] - job['started']:.1f} s)", flush=True)
            self.prune()

    def compute(self, p):
        model, job, q, s = p["model"], p["job"], p["charge"], p["spin"]
        out = {"model": model, "job": job, "smiles": p["smiles"], "charge": q, "spin": s}
        if self.fake:
            time.sleep(0.3)
            h = sum(map(ord, p["smiles"])) % 100 / 100
            out.update(energy_ev=-1000 - h, steps=1, xyz="", seconds=0.3, fake=True)
            if job == "ipea":
                out.update(ip_ev=round(10 + h, 4), ea_ev=round(-0.5 + h, 4))
                if model == UMA:
                    out.update(ip_uma_s=out["ip_ev"], ea_uma_s=out["ea_ev"])
            if job == "polar":
                out.update(geometry_model="mace-off23-medium", dipole_debye=round(4 + h, 3), dipole_vector=[1.0, 0.0, 0.0],
                           polarizability_a3=round(6 + h, 3), polarizability_tensor_a3=[[6 + h, 0, 0], [0, 6 + h, 0], [0, 0, 6 + h]])
            return out
        from rdkit import Chem
        from rdkit.Chem import AllChem

        t = time.time()
        mol = Chem.AddHs(Chem.MolFromSmiles(p["smiles"]))
        params = AllChem.ETKDGv3()
        params.randomSeed = 42
        if AllChem.EmbedMolecule(mol, params) != 0:
            raise RuntimeError("RDKit could not build a 3D structure")
        if AllChem.MMFFHasAllMoleculeParams(mol):
            AllChem.MMFFOptimizeMolecule(mol)
        symbols = [a.GetSymbol() for a in mol.GetAtoms()]
        start = mol.GetConformer().GetPositions().tolist()
        backend = self.backends[MODELS[model]["lane"]]

        def xyz(positions, comment):
            from ase import Atoms

            buf = io.StringIO()
            Atoms(symbols, positions=positions).write(buf, format="xyz", comment=comment)
            return buf.getvalue()

        if job == "polar":
            pos, e0, steps = backend.relax("mace-off23-medium", symbols, start, 0, 1)
            r = backend.polar(symbols, pos)
            pol = [[round(x * POL_TO_A3, 4) for x in row] for row in r["polarizability"]]
            dip = [round(x * E_A_TO_DEBYE, 4) for x in r["dipole"]]
            out.update(geometry_model="mace-off23-medium", energy_ev=round(e0, 6), steps=steps,
                       dipole_debye=round(sum(x * x for x in dip) ** 0.5, 4), dipole_vector=dip,
                       polarizability_a3=round((pol[0][0] + pol[1][1] + pol[2][2]) / 3, 4), polarizability_tensor_a3=pol,
                       xyz=xyz(pos, f"{p['smiles']} relaxed with MACE-OFF23 medium"))
        else:
            pos, e0, steps = backend.relax(model, symbols, start, q, s)
            out.update(energy_ev=round(e0, 6), steps=steps, xyz=xyz(pos, f"{p['smiles']} {MODELS[model]['name']} E = {e0:.6f} eV"))
            if job == "ipea":
                ion = 2 if s == 1 else s - 1
                _, e_cat, _ = backend.relax(model, symbols, pos, q + 1, ion)
                _, e_an, _ = backend.relax(model, symbols, pos, q - 1, ion)
                out.update(ip_ev=round(e_cat - e0, 4), ea_ev=round(e0 - e_an, 4))
                if model == UMA:  # the AI Lab's column names
                    out.update(ip_uma_s=out["ip_ev"], ea_uma_s=out["ea_ev"])
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
    def submit(self, body):
        from rdkit import Chem, RDLogger
        from rdkit.Chem import Descriptors

        RDLogger.DisableLog("rdApp.*")  # visitors send broken SMILES; the reply says so, the console stays readable

        smiles = str(body.get("smiles", "")).strip()
        model = str(body.get("model") or UMA)
        job = str(body.get("job", "ipea"))
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
        if not SMILES_OK.match(smiles):
            return 400, {"error": "SMILES has unsupported characters or is too long"}
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return 400, {"error": "RDKit cannot parse this SMILES"}
        heavy = mol.GetNumHeavyAtoms()
        total = Chem.AddHs(mol).GetNumAtoms()
        if heavy > MAX_HEAVY or total > MAX_ATOMS:
            return 400, {"error": f"at most {MAX_HEAVY} heavy atoms and {MAX_ATOMS} atoms in all"}
        if m["elements"]:
            outside = sorted({a.GetSymbol() for a in mol.GetAtoms()} - set(m["elements"]))
            if outside:
                return 400, {"error": f"{m['name']} does not know {', '.join(outside)}"}
        try:
            charge = int(body.get("charge", Chem.GetFormalCharge(mol)))
            spin = int(body.get("spin", Descriptors.NumRadicalElectrons(mol) + 1))
        except (TypeError, ValueError):
            return 400, {"error": "charge and spin must be integers"}
        if not (-2 <= charge <= 2 and 1 <= spin <= 4):
            return 400, {"error": "charge must be -2..2 and spin multiplicity 1..4"}
        if not m["charged"] and (charge != 0 or spin != 1 or Descriptors.NumRadicalElectrons(mol)):
            return 400, {"error": f"{m['name']} handles neutral closed-shell molecules only"}
        canonical = Chem.MolToSmiles(mol)
        key = f"{model}|{job}|{canonical}|{charge}|{spin}"
        lane = m["lane"]
        with self.lock:
            if key in self.cache:
                return 200, {"status": "done", "cached": True, "result": self.cache[key]}
            for jid, v in self.jobs.items():  # the same molecule already waiting or running
                if v["key"] == key and v["status"] in ("queued", "running"):
                    return 202, self.view(jid)
            if who and any(v.get("who") == who and v["status"] in ("queued", "running") for v in self.jobs.values()):
                return 429, {"error": "one job at a time: wait for your current job to finish"}
            if len(self.queues[lane]) >= MAX_QUEUE:
                return 503, {"error": "the queue is full, try again in a few minutes"}
            jid = secrets.token_hex(8)
            self.jobs[jid] = {"key": key, "who": who, "status": "queued", "created": time.time(), "lane": lane,
                              "params": {"smiles": canonical, "model": model, "job": job, "charge": charge, "spin": spin}}
            self.queues[lane].append(jid)
        self.wakes[lane].set()
        return 202, self.view(jid)

    def view(self, jid):
        v = self.jobs.get(jid)
        if not v:
            return None
        out = {"id": jid, "status": v["status"], "model": v["params"]["model"], "job": v["params"]["job"],
               "smiles": v["params"]["smiles"]}
        if v["status"] == "queued":
            q = self.queues[v["lane"]]
            # jobs ahead in this model's lane, plus the one it is computing now
            out["position"] = (list(q).index(jid) + 1 if jid in q else 0) + (1 if self.running[v["lane"]] else 0)
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
                waiting = sum(1 for j in self.queues[lane] if self.jobs.get(j, {}).get("params", {}).get("model") == mid)
                run = self.running[lane]
                models[mid] = {"ready": lane in self.backends, "jobs": list(m["jobs"]), "queue": waiting,
                               "running": bool(run and self.jobs.get(run, {}).get("params", {}).get("model") == mid)}
            return {"ok": not self.loading and bool(self.backends), "ready": bool(self.backends), "loading": self.loading,
                    "errors": self.errors, "model": UMA, "device": self.device, "gpu": self.gpu,
                    "queue": sum(len(q) for q in self.queues.values()), "running": any(self.running.values()),
                    "done": self.done, "cached": len(self.cache), "models": models}


def make_handler(service, secret):
    class Handler(BaseHTTPRequestHandler):
        server_version = "MolAstriaModels/2"
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
            if n > 8192:
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
    ap.add_argument("--cache", default="", help="result cache (default cache.local.json; cache.fake.local.json with --fake)")
    ap.add_argument("--fake", action="store_true", help="tests only: no models, made-up numbers")
    args = ap.parse_args()
    if os.name == "nt" and not sys.flags.utf8_mode:
        sys.exit("Start Python in UTF-8 mode (python -X utf8 ...), as start.ps1 does: otherwise fairchem reads its data files with the local code page and fails.")
    secret = read_secret()
    if len(secret) < 32:
        sys.exit("No secret: run  node tools/uma-server/new-secret.mjs  first (it also gives the account service the same value).")
    cache = args.cache or os.path.join(HERE, "cache.fake.local.json" if args.fake else "cache.local.json")
    service = Service(args.device, cache, fake=args.fake, mace_python=args.mace_python)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(service, secret))
    print(f"MolAstria online models on http://127.0.0.1:{args.port} (only reachable through the tunnel and the account service)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
