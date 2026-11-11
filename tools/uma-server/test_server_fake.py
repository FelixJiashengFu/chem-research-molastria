"""Starts server.py --fake on a free port with a temporary key and checks the API v3 contract: one job for every
model x job, the exact result fields, the refusals, and the old request form. No model is loaded (the fake mode runs
the real calculations of chemjobs.py on a toy calculator).

    D:\\ChemDraw\\uma-env\\Scripts\\python.exe -X utf8 -m unittest discover -s tools/uma-server -p "test_*.py" -v
"""
import json
import os
import secrets
import shutil
import socket
import subprocess
import sys
import tempfile
import time
import unittest
import urllib.error
import urllib.request

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import server  # noqa: E402

UMA = "uma-s-1p2p1"
DIRECT = {"allscaip-md-direct-all-omol", "esen-sm-direct-all-omol", "esen-md-direct-all-omol"}
A = ["uma-s-1p2p1", "uma-s-1p2", "uma-s-1p2p1-ft-d4rev", "allscaip-md-conserving-all-omol", "allscaip-md-direct-all-omol"]
B = ["uma-s-1p1", "esen-sm-conserving-all-omol", "esen-sm-direct-all-omol", "esen-md-direct-all-omol", "mace-omol-0"]
C = ["mace-off23-small", "mace-off23-medium", "mace-off23-large", "ani-2x"]
D = ["mace-mdp"]
X = ["gfn2-xtb", "gfn2-xtb-alpb-water", "gfn1-xtb"]  # xTB with charges and spins, no ipea
XN = ["gfn-ff"]
A_JOBS = ["sp", "opt", "freq", "conf", "scan", "md", "rxn", "ipea", "spin", "bde", "pa"]
BC_JOBS = ["sp", "opt", "freq", "conf", "scan", "md", "rxn"]
D_JOBS = ["polar", "ir"]
X_JOBS = [j for j in A_JOBS if j != "ipea"]
GROUPS = ((A, A_JOBS), (B, BC_JOBS), (C, BC_JOBS), (D, D_JOBS), (X, X_JOBS), (XN, BC_JOBS))

COMMON = {"model", "job", "smiles", "charge", "spin", "params", "seconds", "xyz", "fake"}
FIELDS = {
    "sp": {"energy_ev", "forces_ev_a", "fmax_ev_a"},
    "opt": {"energy_ev", "steps", "converged", "fmax_ev_a"},
    "freq": {"energy_ev", "steps", "frequencies_cm1", "n_imag", "zpe_ev", "linear", "thermo"},
    "conf": {"conformers", "n_generated", "n_unique", "temperature_k"},
    "scan": {"atoms", "points"},
    "md": {"series", "mean_temperature_k"},
    "rxn": {"reaction", "species", "delta_e_ev", "delta_e_kcal"},
    "ipea": {"energy_ev", "steps", "mode"},  # steps: kept from the old results
    "spin": {"states", "gap_ev", "gap_kcal", "vertical_gap_ev"},
    "bde": {"bond", "parent_energy_ev", "fragments", "bde_ev", "bde_kcal"},
    "pa": {"site", "mode", "energies", "value_ev", "value_kcal"},
    "polar": {"geometry_model", "energy_ev", "steps", "dipole_debye", "dipole_vector", "polarizability_a3",
              "polarizability_tensor_a3"},
    "ir": {"geometry_model", "frequencies_cm1", "ir_intensity_km_mol", "raman_activity_a4_amu", "n_imag"},
}
ITEMS = {
    ("freq", "thermo"): {"temperature_k", "h_corr_ev", "s_ev_k", "g_corr_ev", "h_ev", "g_ev"},
    ("conf", "conformers"): {"rank", "energy_ev", "rel_kcal", "weight", "xyz"},
    ("scan", "points"): {"angle_deg", "energy_ev", "rel_kcal", "converged"},
    ("md", "series"): {"t_fs", "epot_ev", "ekin_ev", "temperature_k"},
    ("rxn", "species"): {"smiles", "side", "count", "charge", "spin", "energy_ev"},
    ("spin", "states"): {"spin", "energy_ev", "xyz"},
    ("bde", "fragments"): {"smiles", "spin", "energy_ev"},
    ("pa", "energies"): {"base_ev", "acid_ev"},
}
DEFAULTS = {
    "sp": {}, "ir": {}, "opt": {"fmax": 0.02}, "freq": {"temperature": 298.15, "symmetry": 1},
    "conf": {"n": 10, "temperature": 298.15, "window_kcal": 10.0},
    "md": {"temperature": 300.0, "timestep_fs": 0.5, "steps": 1000, "friction": 0.01},
    "ipea": {"mode": "adiabatic"}, "polar": {"average": False, "n": 8},
}
# One request per job (small parameters where they cost time). Ethanol, CCO: heavy atoms C0 C1 O2, then H3-H5 on C0,
# H6 H7 on C1, H8 on O2.
REQUESTS = {
    "sp": {"smiles": "CCO"}, "opt": {"smiles": "CCO"}, "freq": {"smiles": "CCO"},
    "conf": {"smiles": "CCCC", "params": {"n": 3}},
    "scan": {"smiles": "CCO", "params": {"atoms": [0, 1, 2, 8], "points": 4}},
    "md": {"smiles": "CCO", "params": {"steps": 100}},
    "rxn": {"params": {"reaction": "C=C.O>>CCO"}},
    "ipea": {"smiles": "CCO"}, "spin": {"smiles": "O=O"}, "bde": {"smiles": "CCO", "params": {"bond": [1, 2]}},
    "pa": {"smiles": "CCO", "params": {"site": 2}}, "polar": {"smiles": "CCO"}, "ir": {"smiles": "CCO"},
}


def expected_keys(model, job, params):
    keys = COMMON | FIELDS[job]
    if job == "rxn" and params.get("thermo"):
        keys |= {"delta_g_ev", "delta_g_kcal", "temperature_k"}
    if job == "ipea":
        if params["mode"] in ("adiabatic", "both"):
            keys |= {"ip_ev", "ea_ev"} | ({"ip_uma_s", "ea_uma_s"} if model == UMA else set())
        if params["mode"] in ("vertical", "both"):
            keys |= {"ip_vertical_ev", "ea_vertical_ev"}
    if job == "bde" and params.get("thermo"):
        keys |= {"bdh298_kcal"}
    if job == "pa" and params.get("thermo"):
        keys |= {"enthalpy_kcal"}
    if job == "polar" and params.get("average"):
        keys |= {"conformers", "weights"}
    if model in DIRECT:
        keys |= {"direct_forces"}
    return keys


def free_port():
    with socket.socket() as s:
        s.bind(("127.0.0.1", 0))
        return s.getsockname()[1]


class FakeServer(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.key = secrets.token_hex(32)  # a temporary key for this run only
        cls.tmp = tempfile.mkdtemp(prefix="molastria-fake-")
        cls.port = free_port()
        cls.log = open(os.path.join(cls.tmp, "server.log"), "w", encoding="utf-8")
        env = dict(os.environ, MOLASTRIA_UMA_SECRET=cls.key, PYTHONUTF8="1")
        cls.proc = subprocess.Popen([sys.executable, "-X", "utf8", "-u", os.path.join(HERE, "server.py"), "--fake",
                                     "--port", str(cls.port), "--cache", os.path.join(cls.tmp, "cache.json")],
                                    env=env, stdout=cls.log, stderr=subprocess.STDOUT)
        deadline = time.time() + 60
        while True:
            try:
                status, h = cls.call("GET", "/health")
                if status == 200 and h["ok"]:
                    break
            except OSError:
                pass
            if time.time() > deadline or cls.proc.poll() is not None:
                raise RuntimeError("the fake server did not start")
            time.sleep(0.3)

    @classmethod
    def tearDownClass(cls):
        cls.proc.terminate()
        cls.proc.wait(10)
        cls.log.close()
        shutil.rmtree(cls.tmp, ignore_errors=True)

    @classmethod
    def call(cls, method, path, body=None, key=None):
        data = json.dumps(body).encode() if body is not None else None
        req = urllib.request.Request(f"http://127.0.0.1:{cls.port}{path}", data=data, method=method,
                                     headers={"X-MolAstria-Key": cls.key if key is None else key,
                                              "Content-Type": "application/json"})
        try:
            with urllib.request.urlopen(req, timeout=30) as r:
                return r.status, json.loads(r.read())
        except urllib.error.HTTPError as e:
            return e.code, json.loads(e.read())

    def run_job(self, body):
        status, data = self.call("POST", "/jobs", body)
        self.assertIn(status, (200, 202), f"{body}: {status} {data}")
        if status == 200:
            return data["result"]
        deadline = time.time() + 300
        while data["status"] in ("queued", "running"):
            self.assertLess(time.time(), deadline, f"{body} did not finish")
            time.sleep(0.1)
            status, data = self.call("GET", f"/jobs/{data['id']}")
            self.assertEqual(status, 200)
        self.assertEqual(data["status"], "done", f"{body}: {data.get('error')}")
        return data["result"]

    def refused(self, body, status=400, text=""):
        got, data = self.call("POST", "/jobs", body)
        self.assertEqual(got, status, f"{body}: {data}")
        self.assertIn(text, data.get("error", ""))

    def check_result(self, model, job, r, params):
        self.assertEqual(set(r), expected_keys(model, job, params), f"{model} {job}")
        self.assertEqual((r["model"], r["job"], r["fake"]), (model, job, True))
        self.assertEqual(r["params"], params)
        for (j, field), keys in ITEMS.items():
            if j != job:
                continue
            value = r[field]
            for item in value if isinstance(value, list) else [value]:
                want = keys | ({"g_ev"} if (job, params.get("thermo")) == ("rxn", True) else set())
                self.assertEqual(set(item), want, f"{model} {job} {field}")
        if job == "conf":
            self.assertEqual(r["xyz"].count("conformer"), len(r["conformers"]))
        if job == "scan":
            self.assertEqual(len(r["points"]), params["points"])
            self.assertEqual(r["xyz"].count("dihedral"), params["points"])
        if job == "md":
            self.assertLessEqual(len(r["series"]), 200)
            self.assertLessEqual(r["xyz"].count(" t = "), 100)
        if job in ("ir",):
            self.assertEqual(len(r["frequencies_cm1"]), len(r["ir_intensity_km_mol"]))
            self.assertEqual(len(r["frequencies_cm1"]), len(r["raman_activity_a4_amu"]))

    # ---- the matrix -----------------------------------------------------------------------------------------------
    def test_health(self):
        status, h = self.call("GET", "/health")
        self.assertEqual(status, 200)
        self.assertEqual(h["api"], 3)
        for group, jobs in GROUPS:
            for model in group:
                self.assertEqual(h["models"][model]["jobs"], jobs, model)
                self.assertTrue(h["models"][model]["ready"])
        self.assertEqual(set(h["models"]), set(A + B + C + D + X + XN))
        for key in ("ok", "ready", "model", "device", "gpu", "queue", "running", "done", "cached", "models"):
            self.assertIn(key, h)

    def test_every_model_and_job(self):
        count = 0
        for group, jobs in GROUPS:
            for model in group:
                for job in jobs:
                    body = dict(REQUESTS[job], model=model, job=job)
                    r = self.run_job(body)
                    params = dict(DEFAULTS.get(job, {}))
                    params.update(self.full_params(job, body.get("params", {})))
                    self.check_result(model, job, r, params)
                    count += 1
        self.assertEqual(count, 5 * 11 + 9 * 7 + 2 + 3 * 10 + 7)

    @staticmethod
    def full_params(job, given):
        out = dict(given)
        if job == "scan":
            out = {"start": -180.0, "end": 180.0, "points": 13, **given}
        if job == "rxn":
            out = {"thermo": False, "temperature": 298.15, **given}
        if job == "spin":
            out = {"spins": [1, 3], **given}
        if job in ("bde", "pa"):
            out = {"thermo": False, "temperature": 298.15, **given}
            if job == "pa":
                out.setdefault("mode", "protonate")
        return out

    def test_options(self):
        r = self.run_job({"model": UMA, "job": "ipea", "smiles": "CCO", "params": {"mode": "both"}})
        self.check_result(UMA, "ipea", r, {"mode": "both"})
        r = self.run_job({"model": "uma-s-1p2", "job": "ipea", "smiles": "CCO", "params": {"mode": "vertical"}})
        self.check_result("uma-s-1p2", "ipea", r, {"mode": "vertical"})
        r = self.run_job({"model": UMA, "job": "rxn", "params": {"reaction": "[CH3].[CH3]>>CC", "thermo": True}})
        self.check_result(UMA, "rxn", r, {"reaction": "[CH3].[CH3]>>CC", "thermo": True, "temperature": 298.15})
        self.assertEqual(r["species"][0]["count"], 2)
        self.assertIsNone(r["smiles"])
        r = self.run_job({"model": UMA, "job": "bde", "smiles": "CCO", "params": {"bond": [0, 1], "thermo": True}})
        self.check_result(UMA, "bde", r, {"bond": [0, 1], "thermo": True, "temperature": 298.15})
        self.assertEqual([f["spin"] for f in r["fragments"]], [2, 2])
        r = self.run_job({"model": UMA, "job": "pa", "smiles": "CC(=O)O",
                          "params": {"site": 3, "mode": "deprotonate", "thermo": True, "temperature": 350}})
        self.check_result(UMA, "pa", r, {"site": 3, "mode": "deprotonate", "thermo": True, "temperature": 350.0})
        r = self.run_job({"model": "mace-mdp", "job": "polar", "smiles": "CCCO", "params": {"average": True, "n": 3}})
        self.check_result("mace-mdp", "polar", r, {"average": True, "n": 3})
        self.assertEqual(len(r["weights"]), r["conformers"])
        r = self.run_job({"model": UMA, "job": "spin", "smiles": "[CH3]", "params": {"spins": [4, 2]}})
        self.assertEqual([s["spin"] for s in r["states"]], [4, 2])
        r = self.run_job({"model": UMA, "job": "freq", "smiles": "CCO", "params": {"temperature": 500, "symmetry": 3, "x": 1}})
        self.assertEqual(r["params"], {"temperature": 500.0, "symmetry": 3})  # unknown keys are ignored
        self.assertEqual(r["thermo"]["temperature_k"], 500.0)

    def test_neighbouring_inputs(self):
        r = self.run_job({"model": UMA, "job": "freq", "xyz": "1\nargon\nAr 0 0 0\n"})  # one atom
        self.assertEqual((r["frequencies_cm1"], r["linear"], r["smiles"]), ([], False, None))
        r = self.run_job({"model": UMA, "job": "sp", "xyz": "1\n\nH 0 0 0", "charge": 0})  # odd electrons: doublet
        self.assertEqual(r["spin"], 2)
        r = self.run_job({"model": "mace-off23-small", "job": "freq", "xyz": "3\nCO2\nC 0 0 0\nO 0 0 1.16\nO 0 0 -1.16"})
        self.assertTrue(r["linear"])
        self.assertEqual(len(r["frequencies_cm1"]), 4)
        r = self.run_job({"model": "ani-2x", "job": "freq", "smiles": "[H][H]"})  # only hydrogen
        self.assertEqual(len(r["frequencies_cm1"]), 1)
        many = "120\nlargest allowed\n" + "".join(f"H {i % 10 * 1.0} {i // 10 % 10 * 1.0} {i // 100 * 1.0}\n" for i in range(120))
        r = self.run_job({"model": "esen-sm-conserving-all-omol", "job": "sp", "xyz": many})
        self.assertEqual(len(r["forces_ev_a"]), 120)
        r = self.run_job({"model": UMA, "job": "opt", "xyz": "\n  3  \r\n  water  \r\n o \t0 0 0 \r\n H 0.96 0 0\r\nh -0.24 0.93 0\r\n\r\n"})
        self.assertTrue(r["xyz"].startswith("3\n"))
        r = self.run_job({"model": UMA, "job": "ipea", "xyz": "3\n\nO 0 0 0\nH 0.96 0 0\nH -0.24 0.93 0", "charge": 1})
        self.assertEqual((r["charge"], r["spin"]), (1, 2))  # charged XYZ input: the default multiplicity fits
        r = self.run_job({"model": "mace-omol-0", "job": "sp", "smiles": "[SiH4]"})
        self.assertIn("energy_ev", r)
        r = self.run_job({"model": "mace-off23-large", "job": "opt", "smiles": "CCBr"})
        self.assertIn("energy_ev", r)
        r = self.run_job({"model": UMA, "job": "scan", "smiles": "OCCO",
                          "params": {"atoms": [0, 1, 2, 3], "start": 0, "end": 360, "points": 3}})
        self.assertEqual([p["angle_deg"] for p in r["points"]], [0.0, 180.0, 360.0])
        r = self.run_job({"model": UMA, "job": "conf", "smiles": "C", "params": {"n": 2}})  # rigid molecule
        self.assertEqual(len(r["conformers"]), 1)
        r = self.run_job({"model": UMA, "job": "bde", "smiles": "C", "params": {"bond": [0, 1]}})  # gives an H atom
        self.assertEqual(sorted(f["smiles"] for f in r["fragments"]), ["[CH3]", "[H]"])
        r = self.run_job({"model": UMA, "job": "md", "smiles": "CCO", "params": {"steps": 2000, "timestep_fs": 0.1}})
        self.assertEqual((len(r["series"]), r["xyz"].count(" t = ")), (200, 100))

    def test_refusals(self):
        self.refused({"model": "nope", "job": "sp", "smiles": "C"}, text="unknown model")
        self.refused({"model": "mace-mdp", "job": "sp", "smiles": "C"}, text="supports only")
        self.refused({"model": "mace-off23-small", "job": "ipea", "smiles": "C"}, text="supports only")
        self.refused({"model": "uma-s-1p1", "job": "bde", "smiles": "CC", "params": {"bond": [0, 1]}}, text="supports only")
        self.refused({"model": "uma-s-1p1", "job": "sp", "smiles": "C", "charge": 1}, text="neutral closed-shell")
        self.refused({"model": "ani-2x", "job": "opt", "smiles": "[NH4+]"}, text="neutral closed-shell")
        self.refused({"model": "mace-off23-small", "job": "sp", "smiles": "[CH3]"}, text="neutral closed-shell")
        self.refused({"model": "esen-sm-direct-all-omol", "job": "sp", "xyz": "1\n\nH 0 0 0"}, text="neutral closed-shell")
        self.refused({"model": "mace-omol-0", "job": "rxn", "params": {"reaction": "[CH3].[CH3]>>CC"}}, text="neutral closed-shell")
        self.refused({"model": "ani-2x", "job": "sp", "smiles": "P"}, text="does not know P")
        self.refused({"model": "mace-off23-small", "job": "sp", "xyz": "1\n\nNa 0 0 0"}, text="does not know Na")
        self.refused({"model": UMA, "job": "sp", "xyz": "1\n\nRn 0 0 0"}, text="does not know Rn")
        self.refused({"model": UMA, "job": "conf", "xyz": "1\n\nH 0 0 0"}, text="needs a SMILES")
        self.refused({"model": UMA, "job": "pa", "xyz": "1\n\nH 0 0 0", "params": {"site": 0}}, text="needs a SMILES")
        self.refused({"model": "mace-mdp", "job": "polar", "xyz": "2\n\nH 0 0 0\nH 0 0 0.74", "params": {"average": True}},
                     text="needs a SMILES")
        self.refused({"model": UMA, "job": "sp", "smiles": "C", "xyz": "1\n\nH 0 0 0"}, text="exactly one")
        self.refused({"model": UMA, "job": "sp"}, text="exactly one")
        self.refused({"model": UMA, "job": "rxn", "smiles": "C", "params": {"reaction": "C>>C"}}, text="params.reaction")
        self.refused({"model": UMA, "job": "rxn"}, text="params.reaction")
        self.refused({"model": UMA, "job": "rxn", "params": {"reaction": "C=C>>CCO"}}, text="conserve the elements")
        self.refused({"model": UMA, "job": "rxn", "params": {"reaction": "[NH4+]>>N.[H]"}}, text="conserve the charge")
        self.refused({"model": UMA, "job": "rxn", "params": {"reaction": "C.C.C.C>>C.C.C"}}, text="at most 6")
        for params, text in (({"fmax": 0.5}, "params.fmax"), ({"fmax": "0.02"}, "params.fmax"), ({"fmax": True}, "params.fmax")):
            self.refused({"model": UMA, "job": "opt", "smiles": "C", "params": params}, text=text)
        self.refused({"model": UMA, "job": "opt", "smiles": "C", "params": [1]}, text="params must be an object")
        self.refused({"model": UMA, "job": "md", "smiles": "C", "params": {"steps": 5000}}, text="params.steps")
        self.refused({"model": UMA, "job": "md", "smiles": "C", "params": {"steps": 150.5}}, text="params.steps")
        self.refused({"model": UMA, "job": "md", "smiles": "C", "params": {"temperature": 1600}}, text="params.temperature")
        self.refused({"model": UMA, "job": "freq", "smiles": "C", "params": {"symmetry": 25}}, text="params.symmetry")
        self.refused({"model": UMA, "job": "conf", "smiles": "CC", "params": {"n": 31}}, text="params.n")
        self.refused({"model": UMA, "job": "scan", "smiles": "CCCC", "params": {"atoms": [0, 1, 1, 3]}}, text="params.atoms")
        self.refused({"model": UMA, "job": "scan", "smiles": "CCCC", "params": {"atoms": [0, 1, 2, 14]}}, text="below 14")
        self.refused({"model": UMA, "job": "scan", "smiles": "CCCC"}, text="params.atoms")
        self.refused({"model": UMA, "job": "scan", "smiles": "CCCC", "params": {"atoms": [0, 1, 2, 3], "start": 10, "end": 10}},
                     text="greater than")
        self.refused({"model": UMA, "job": "scan", "smiles": "CCCC", "params": {"atoms": [0, 1, 2, 3], "points": 25}},
                     text="params.points")
        self.refused({"model": UMA, "job": "ipea", "smiles": "C", "params": {"mode": "sideways"}}, text="params.mode")
        self.refused({"model": UMA, "job": "spin", "smiles": "C", "params": {"spins": [1, 2]}}, text="fit the number")
        self.refused({"model": UMA, "job": "spin", "smiles": "C", "params": {"spins": [3, 3]}}, text="params.spins")
        self.refused({"model": UMA, "job": "spin", "smiles": "C", "params": {"spins": [1, 5]}}, text="params.spins")
        self.refused({"model": UMA, "job": "bde", "smiles": "C1CCCCC1", "params": {"bond": [0, 1]}}, text="ring bond")
        self.refused({"model": UMA, "job": "bde", "smiles": "C=C", "params": {"bond": [0, 1]}}, text="single bond")
        self.refused({"model": UMA, "job": "bde", "smiles": "CCC", "params": {"bond": [0, 2]}}, text="not bonded")
        self.refused({"model": UMA, "job": "bde", "smiles": "CC"}, text="params.bond")
        self.refused({"model": UMA, "job": "bde", "smiles": "CC", "charge": 1, "params": {"bond": [0, 1]}}, text="implies")
        self.refused({"model": UMA, "job": "pa", "smiles": "C", "params": {"site": 0}}, text="cannot be protonated")
        self.refused({"model": UMA, "job": "pa", "smiles": "CC(=O)O", "params": {"site": 2, "mode": "deprotonate"}},
                     text="no hydrogen")
        self.refused({"model": UMA, "job": "pa", "smiles": "N", "params": {"site": 1}}, text="params.site")
        self.refused({"model": UMA, "job": "pa", "smiles": "N", "charge": 2, "params": {"site": 0}}, text="within -2..2")
        self.refused({"model": UMA, "job": "sp", "smiles": "C", "charge": 3}, text="charge must be")
        self.refused({"model": UMA, "job": "sp", "xyz": "2\n\nH 0 0 0\nH 0 0 0.74", "spin": 2}, text="do not fit")
        self.refused({"model": UMA, "job": "sp", "xyz": "2\n\nH 0 0 0\nH 0 0 0.3"}, text="closer")
        self.refused({"model": UMA, "job": "sp", "xyz": "121\n\n" + "H 0 0 0\n" * 121}, text="1 to 120")
        self.refused({"model": UMA, "job": "sp", "smiles": "C" * 31}, text="at most 30 heavy atoms")
        self.refused({"model": UMA, "job": "sp", "smiles": "C(", "who": "0123456789abcdef"}, text="cannot parse")
        self.refused({"model": UMA, "job": "sp", "smiles": "C", "who": "bad"}, text="bad visitor id")

    def test_key(self):
        status, data = self.call("GET", "/health", key="")
        self.assertEqual((status, data), (401, {"error": "unauthorized"}))
        status, _ = self.call("POST", "/jobs", {"smiles": "C"}, key="x" * 64)
        self.assertEqual(status, 401)
        req = urllib.request.Request(f"http://127.0.0.1:{self.port}/health")  # no header at all
        with self.assertRaises(urllib.error.HTTPError) as ctx:
            urllib.request.urlopen(req, timeout=10)
        self.assertEqual(ctx.exception.code, 401)

    def test_one_job_per_visitor(self):
        who = secrets.token_hex(8)
        status, first = self.call("POST", "/jobs", {"model": UMA, "job": "md", "smiles": "CCCCCCCC", "who": who,
                                                    "params": {"steps": 2000}})
        self.assertEqual(status, 202)
        self.refused({"model": UMA, "job": "sp", "smiles": "N", "who": who}, 429, "one job at a time")
        deadline = time.time() + 120
        saw_progress = False
        while first["status"] in ("queued", "running") and time.time() < deadline:
            time.sleep(0.05)
            _, first = self.call("GET", f"/jobs/{first['id']}")
            saw_progress = saw_progress or "progress" in first
        self.assertEqual(first["status"], "done")
        self.assertTrue(saw_progress)
        status, again = self.call("POST", "/jobs", {"model": UMA, "job": "md", "smiles": "CCCCCCCC", "who": who,
                                                    "params": {"steps": 2000}})
        self.assertEqual((status, again.get("cached")), (200, True))

    def test_old_requests(self):
        """The desktop app's Meta page (0.1.11) sends {smiles, model, job, charge, spin}: same fields as before."""
        old = {"model", "job", "smiles", "charge", "spin", "energy_ev", "steps", "xyz", "seconds", "fake"}
        r = self.run_job({"smiles": "OCC", "model": UMA, "job": "ipea", "charge": 0, "spin": 1})
        self.assertLessEqual(old | {"ip_ev", "ea_ev", "ip_uma_s", "ea_uma_s"}, set(r))
        self.assertEqual((r["smiles"], r["charge"], r["spin"], r["ip_ev"]), ("CCO", 0, 1, r["ip_uma_s"]))
        r = self.run_job({"smiles": "CCO", "model": "allscaip-md-conserving-all-omol", "job": "ipea"})
        self.assertNotIn("ip_uma_s", r)
        r = self.run_job({"smiles": "c1ccccc1"})  # model and job default to UMA-S 1.2.1 and ipea
        self.assertEqual((r["model"], r["job"]), (UMA, "ipea"))
        r = self.run_job({"smiles": "CCO", "model": "mace-off23-small", "job": "opt", "charge": 0, "spin": 1})
        self.assertLessEqual(old, set(r))
        r = self.run_job({"smiles": "CCO", "model": "mace-mdp", "job": "polar", "charge": 0, "spin": 1})
        self.assertLessEqual(old | {"geometry_model", "dipole_debye", "dipole_vector", "polarizability_a3",
                                    "polarizability_tensor_a3"}, set(r))
        self.assertEqual(r["geometry_model"], "mace-off23-medium")
        self.refused({"smiles": "C", "model": "mace-off23-small", "job": "ipea"}, text="supports only: sp, opt")
        self.refused({"smiles": "C", "model": "gfn2-xtb", "job": "ipea"}, text="supports only: sp, opt")
        self.refused({"smiles": "[NH4+]", "model": "gfn-ff", "job": "sp"}, text="neutral closed-shell")
        r = self.run_job({"model": "gfn2-xtb", "job": "opt", "smiles": "[NH4+]"})  # xTB takes ions
        self.assertEqual(r["charge"], 1)


class Contract(unittest.TestCase):
    def test_model_table(self):
        for group, jobs in GROUPS:
            for model in group:
                self.assertEqual(list(server.MODELS[model]["jobs"]), jobs, model)
                self.assertEqual(server.MODELS[model]["charged"], group is A or group is X, model)
                self.assertEqual(server.MODELS[model]["direct"], model in DIRECT, model)
        self.assertEqual(len(server.MODELS), 19)
        self.assertEqual(server.TIME_LIMITS, {"sp": 120, "opt": 120})
        self.assertEqual(server.DEFAULT_LIMIT, 600)

    def test_mace_proxy(self):
        """The MACE models reach chemjobs as an ASE calculator through mace_worker.py's 'calc' op (stubbed here)."""
        sent = []

        def call(req, timeout=None):
            sent.append(req)
            if req["op"] == "calc":
                return {"ok": True, "energy_ev": -1.5 * req["charge"] - 2.0, "forces": [[0.0, 0.0, 0.1]] * len(req["symbols"])}
            return {"ok": True, "dipole": [0.1, 0.0, 0.0], "polarizability": [[1.0, 0, 0], [0, 2.0, 0], [0, 0, 3.0]]}

        backend = server.MaceBackend.__new__(server.MaceBackend)
        backend.call = call
        calc = server.cj.EFCalculator(backend.ef("mace-off23-small"))
        atoms = server.cj.new_atoms(["H", "H"], server.np.array([[0, 0, 0], [0, 0, 0.74]]), 1, 2, calc)
        self.assertEqual(atoms.get_potential_energy(), -3.5)
        self.assertEqual(atoms.get_forces().tolist(), [[0.0, 0.0, 0.1]] * 2)
        self.assertEqual(sent[-1], {"op": "calc", "model": "mace-off23-small", "symbols": ["H", "H"],
                                    "positions": [[0.0, 0.0, 0.0], [0.0, 0.0, 0.74]], "charge": 1, "spin": 2})
        json.dumps(sent)  # plain JSON, no numpy types
        d, a = backend.dp(["H", "H"], server.np.array([[0, 0, 0], [0, 0, 0.74]]))
        self.assertEqual(sent[-1]["op"], "polar")
        self.assertAlmostEqual(float(a[2, 2]), 3.0 * server.cj.POL_TO_A3)  # e*A^2/V -> A^3
        self.assertEqual(d.tolist(), [0.1, 0.0, 0.0])

    def test_param_defaults(self):
        for job, want in DEFAULTS.items():
            self.assertEqual(server.job_params(job, {}), want, job)


if __name__ == "__main__":
    unittest.main()
