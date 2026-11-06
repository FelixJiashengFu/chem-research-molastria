"""MolAstria UMA service: the site owner's GPU, open to every visitor through the account service.

Runs on the owner's computer in the UMA environment. Cloudflare Tunnel connects it to the account Worker
(deploy/account-worker.js, routes /uma/*), which checks the calling site, limits jobs per visitor, blocks
embargoed regions and adds the shared secret; this service accepts nothing without that secret and listens on
127.0.0.1 only. Jobs run one at a time on the GPU; finished molecules are cached and answered at once.

    python tools/uma-server/server.py [--port 8765] [--device auto|cuda|cpu]

The secret is read from tools/uma-server/secret.local (written by new-secret.mjs, kept out of git) or from the
environment variable MOLASTRIA_UMA_SECRET. Needs fairchem-core and rdkit, and a Hugging Face login that can
download facebook/UMA.

API (JSON; every request carries the header X-MolAstria-Key):
    GET  /health      {ok, ready, model, device, gpu, queue, running, done, cached}
    POST /jobs        {smiles, job: "ipea" | "opt", charge?, spin?}  ->  {id, status, position} or a cached result
    GET  /jobs/<id>   {id, status: queued | running | done | error, position, result?, error?}

Same definitions as the desktop runner and the Meta page scripts: RDKit ETKDG (seed 42) + MMFF, UMA-S 1.2.1 (task
"omol"), LBFGS to fmax 0.02 eV/A; adiabatic IP = E(+1) - E(0) and EA = E(0) - E(-1) in eV.
"""
import argparse
import collections
import hmac
import io
import json
import os
import re
import secrets
import sys
import threading
import time
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
MODEL = "uma-s-1p2p1"
JOBS = ("ipea", "opt")
SMILES_OK = re.compile(r"^[A-Za-z0-9@+\-\[\]()=#$%/\\.:~*]{1,200}$")
MAX_HEAVY, MAX_ATOMS, MAX_QUEUE, MAX_STEPS = 30, 120, 25, 400


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


class Service:
    def __init__(self, device, cache_path, fake=False):
        self.device_wanted, self.cache_path, self.fake = device, cache_path, fake
        self.ready, self.error, self.device, self.gpu = False, "", "", ""
        self.lock = threading.Lock()
        self.queue = collections.deque()
        self.jobs = {}
        self.running = None
        self.done = 0
        self.wake = threading.Event()
        self.cache = {}
        if os.path.exists(cache_path):
            try:
                with open(cache_path, encoding="utf-8") as f:
                    self.cache = json.load(f)
            except (OSError, ValueError):
                self.cache = {}
        threading.Thread(target=self.work, daemon=True).start()

    # ---- the GPU worker -------------------------------------------------------------------------------------
    def load(self):
        if self.fake:  # for tests: no model, made-up numbers marked as such
            self.device, self.ready = "fake", True
            return
        import torch
        from fairchem.core import pretrained_mlip

        if self.device_wanted in ("auto", "cuda") and torch.cuda.is_available():
            self.device, self.gpu = "cuda", torch.cuda.get_device_name(0)
        else:
            self.device = "cpu"
        print(f"Loading {MODEL} on {self.device} {self.gpu} ({uma_settings()} settings)".strip(), flush=True)
        self.settings = uma_settings()
        self.predictor = pretrained_mlip.get_predict_unit(MODEL, device=self.device, inference_settings=self.settings)
        self.ready = True
        print("Ready", flush=True)

    def work(self):
        try:
            self.load()
        except Exception as e:  # noqa: BLE001 - reported through /health
            self.error = f"{type(e).__name__}: {e}"[:400]
            print(f"Could not load {MODEL}: {self.error}", flush=True)
            return
        while True:
            self.wake.wait(5)
            self.wake.clear()
            while True:
                with self.lock:
                    if not self.queue:
                        break
                    jid = self.queue.popleft()
                    job = self.jobs.get(jid)
                    if not job:
                        continue
                    job["status"], job["started"] = "running", time.time()
                    self.running = jid
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
                        self.running = None
                        job["finished"] = time.time()
                print(f"{job['status']}: {job['params']['job']} {job['params']['smiles']} "
                      f"({job['finished'] - job['started']:.1f} s)", flush=True)
            self.prune()

    def compute(self, p):
        if self.fake:
            time.sleep(0.3)
            h = sum(map(ord, p["smiles"])) % 100 / 100
            out = {"model": MODEL, "job": p["job"], "smiles": p["smiles"], "charge": p["charge"], "spin": p["spin"],
                   "energy_ev": -1000 - h, "steps": 1, "xyz": "", "seconds": 0.3, "fake": True}
            if p["job"] == "ipea":
                out.update(ip_uma_s=round(10 + h, 4), ea_uma_s=round(-0.5 + h, 4))
            return out
        from ase import Atoms
        from ase.optimize import LBFGS
        from fairchem.core import FAIRChemCalculator
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
        start = Atoms([a.GetSymbol() for a in mol.GetAtoms()], positions=mol.GetConformer().GetPositions())

        def relax(atoms, q, s):
            atoms = atoms.copy()
            atoms.info.update({"charge": q, "spin": s})
            atoms.calc = FAIRChemCalculator(self.predictor, task_name="omol")
            opt = LBFGS(atoms, logfile=None)
            opt.run(fmax=0.02, steps=MAX_STEPS)
            return atoms, float(atoms.get_potential_energy()), opt.nsteps

        def xyz(atoms):
            buf = io.StringIO()
            atoms.write(buf, format="xyz")
            return buf.getvalue()

        q, s = p["charge"], p["spin"]
        neutral, e0, steps = relax(start, q, s)
        out = {"model": MODEL, "job": p["job"], "smiles": p["smiles"], "charge": q, "spin": s,
               "energy_ev": round(e0, 6), "steps": steps, "xyz": xyz(neutral)}
        if p["job"] == "ipea":
            ion = 2 if s == 1 else s - 1
            _, e_cat, _ = relax(neutral, q + 1, ion)
            _, e_an, _ = relax(neutral, q - 1, ion)
            out.update(ip_uma_s=round(e_cat - e0, 4), ea_uma_s=round(e0 - e_an, 4))
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
        job = str(body.get("job", "ipea"))
        if job not in JOBS:
            return 400, {"error": "job must be ipea or opt"}
        if not SMILES_OK.match(smiles):
            return 400, {"error": "SMILES has unsupported characters or is too long"}
        mol = Chem.MolFromSmiles(smiles)
        if mol is None:
            return 400, {"error": "RDKit cannot parse this SMILES"}
        heavy = mol.GetNumHeavyAtoms()
        total = Chem.AddHs(mol).GetNumAtoms()
        if heavy > MAX_HEAVY or total > MAX_ATOMS:
            return 400, {"error": f"at most {MAX_HEAVY} heavy atoms and {MAX_ATOMS} atoms in all"}
        try:
            charge = int(body.get("charge", Chem.GetFormalCharge(mol)))
            spin = int(body.get("spin", Descriptors.NumRadicalElectrons(mol) + 1))
        except (TypeError, ValueError):
            return 400, {"error": "charge and spin must be integers"}
        if not (-2 <= charge <= 2 and 1 <= spin <= 4):
            return 400, {"error": "charge must be -2..2 and spin multiplicity 1..4"}
        canonical = Chem.MolToSmiles(mol)
        key = f"{MODEL}|{job}|{canonical}|{charge}|{spin}"
        with self.lock:
            if key in self.cache:
                return 200, {"status": "done", "cached": True, "result": self.cache[key]}
            for jid, v in self.jobs.items():  # the same molecule already waiting or running
                if v["key"] == key and v["status"] in ("queued", "running"):
                    return 202, self.view(jid)
            if len(self.queue) >= MAX_QUEUE:
                return 503, {"error": "the queue is full, try again in a few minutes"}
            jid = secrets.token_hex(8)
            self.jobs[jid] = {"key": key, "status": "queued", "created": time.time(),
                              "params": {"smiles": canonical, "job": job, "charge": charge, "spin": spin}}
            self.queue.append(jid)
        self.wake.set()
        return 202, self.view(jid)

    def view(self, jid):
        v = self.jobs.get(jid)
        if not v:
            return None
        out = {"id": jid, "status": v["status"], "job": v["params"]["job"], "smiles": v["params"]["smiles"]}
        if v["status"] == "queued":
            out["position"] = list(self.queue).index(jid) + 1 if jid in self.queue else 0
        if v["status"] == "done":
            out["result"] = v["result"]
        if v["status"] == "error":
            out["error"] = v["error"]
        return out

    def health(self):
        with self.lock:
            return {"ok": not self.error, "ready": self.ready, "error": self.error, "model": MODEL, "device": self.device,
                    "gpu": self.gpu, "queue": len(self.queue), "running": self.running is not None,
                    "done": self.done, "cached": len(self.cache)}


def make_handler(service, secret):
    class Handler(BaseHTTPRequestHandler):
        server_version = "MolAstriaUMA/1"
        timeout = 15  # seconds a connection may stay idle; a stalled client cannot hold a thread

        def log_message(self, fmt, *args):  # quiet; the worker prints one line per job
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
            if not service.ready:
                return self.reply(503, {"error": service.error or "the model is still loading"})
            status, data = service.submit(body if isinstance(body, dict) else {})
            self.reply(status, data)

    return Handler


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--port", type=int, default=8765)
    ap.add_argument("--device", default="auto", choices=["auto", "cuda", "cpu"])
    ap.add_argument("--cache", default="", help="result cache (default cache.local.json; cache.fake.local.json with --fake)")
    ap.add_argument("--fake", action="store_true", help="tests only: no model, made-up numbers")
    args = ap.parse_args()
    if os.name == "nt" and not sys.flags.utf8_mode:
        sys.exit("Start Python in UTF-8 mode (python -X utf8 ...), as start.ps1 does: otherwise fairchem reads its data files with the local code page and fails.")
    secret = read_secret()
    if len(secret) < 32:
        sys.exit("No secret: run  node tools/uma-server/new-secret.mjs  first (it also gives the account service the same value).")
    cache = args.cache or os.path.join(HERE, "cache.fake.local.json" if args.fake else "cache.local.json")
    service = Service(args.device, cache, fake=args.fake)
    server = ThreadingHTTPServer(("127.0.0.1", args.port), make_handler(service, secret))
    print(f"MolAstria UMA service on http://127.0.0.1:{args.port} (only reachable through the tunnel and the account service)", flush=True)
    try:
        server.serve_forever()
    except KeyboardInterrupt:
        pass


if __name__ == "__main__":
    main()
