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
# The UMA checkpoints with the inorganic-materials task (omat) also do phonons of crystals (phon)
AM = ["uma-s-1p2p1", "uma-s-1p2"]
A = ["uma-s-1p2p1-ft-d4rev", "allscaip-md-conserving-all-omol", "allscaip-md-direct-all-omol"]
BM = ["uma-s-1p1"]
B = ["esen-sm-conserving-all-omol", "esen-sm-direct-all-omol", "esen-md-direct-all-omol", "mace-omol-0"]
C = ["mace-off23-small", "mace-off23-medium", "mace-off23-large", "ani-2x"]
D = ["mace-mdp"]
X = ["gfn2-xtb", "gfn2-xtb-alpb-water", "gfn1-xtb"]  # xTB with charges and spins, no ipea
XN = ["gfn-ff"]
P = ["openmm-amber14"]  # protein MD from a PDB ID
I = ["aimnet2"]  # AIMNet2: ions, but closed-shell only, so of the charge jobs only pa
# quacc recipes: a batch of molecules, or EMT bulk -> slabs. Only where quacc is installed (pip install quacc).
QUACC = bool(server.qb.quacc_version())
QF = ["quacc-gfn2", "quacc-psi4"] if QUACC else []
QS = ["quacc-emt"] if QUACC else []
# phonons (phonon_backend.py): phonopy, spglib and seekpath (pip install phonopy spglib seekpath); EMT is part of ASE
PHONOPY = bool(server.pb.versions())
PH = ["phonopy-emt"]
QUACC_ALL = {"quacc-gfn2", "quacc-psi4", "quacc-emt"}
G = ["dbcata"]  # DBCata: the fake server runs dbcata_worker.py in toy mode (dbcata_core.ToyEngine)
OC = ["molnextr"]  # MolNexTR: structure images -> SMILES; the fake server reads every image as TOY_SMILES
A_JOBS = ["sp", "opt", "freq", "conf", "scan", "md", "rxn", "ts", "neb", "ipea", "spin", "bde", "pa"]
BC_JOBS = ["sp", "opt", "freq", "conf", "scan", "md", "rxn", "ts", "neb"]
D_JOBS = ["polar", "ir"]
P_JOBS = ["pmd"]
X_JOBS = [j for j in A_JOBS if j != "ipea"]
I_JOBS = BC_JOBS + ["pa"]
GROUPS = ((AM, A_JOBS + ["phon"]), (A, A_JOBS), (BM, BC_JOBS + ["phon"]), (B, BC_JOBS), (C, BC_JOBS), (D, D_JOBS),
          (X, X_JOBS), (XN, BC_JOBS), (P, P_JOBS), (I, I_JOBS), (QF, ["qflow"]), (QS, ["qslab"]), (PH, ["phon"]),
          (OC, ["ocsr"]), (G, ["adsgen"]))


def live(jobs):
    """The jobs the fake server offers here: phon only where phonopy is installed."""
    return [j for j in jobs if j != "phon" or PHONOPY]

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
    "pmd": {"pdb_id", "chains", "residues", "atoms", "sequence", "fixes", "force_field", "platform", "openmm_version",
            "ps", "temperature_k", "timestep_fs", "energy_start_kj", "energy_minimised_kj", "ns_per_day", "series",
            "mean_temperature_k", "final_rmsd_a", "rmsf", "trajectory_pdb", "final_pdb", "seconds_total"},
    "qflow": {"recipe", "engine", "quacc_version", "items", "n_ok"},
    "ts": {"ts_steps", "ts_converged", "ts_fmax_ev_a", "method", "ts_energy_ev", "frequencies_cm1", "n_imag",
           "n_imag_significant", "imag_cm1", "is_first_order_saddle", "ts_xyz", "imag_mode", "irc", "profile",
           "path_xyz", "n_path_frames", "reaction_energy_kcal"},
    "qslab": {"element", "engine", "quacc_version", "max_index", "a_angstrom", "e_bulk_ev_atom", "bulk_converged",
              "slabs", "lowest"},
    "ocsr": {"engine", "version", "weights", "device", "items", "n_ok"},
    "phon": {"method", "versions", "source", "formula", "symmetry", "supercell", "n_supercell", "n_displacements",
             "displacement_a", "lattice_input", "relax", "lattice", "poscar", "max_residual_force_ev_a", "band", "dos",
             "thermal", "gamma_thz", "min_frequency_thz", "max_frequency_thz", "imaginary", "imag_threshold_thz",
             "n_imaginary_mesh"},
    "adsgen": {"system", "lattice", "slabs", "sites", "truncated", "distinct", "best", "best_ok", "reference", "engine",
               "seconds_worker"},
}
ADS_SITE = {"id", "termination", "kind", "atoms", "multiplicity", "xy", "dmae_init_gen", "flags", "confidence",
            "energy_sp_ev", "energy_ev", "e_bind_raw_ev", "e_ads_ev", "xyz", "ok", "rel_ev", "landing", "same_as"}
ADS_POLISH = {"dmae_gen_final", "flags_polished", "steps", "converged"}
# what each molecule of a batch carries, by recipe
QITEM = {"smiles", "charge", "spin", "formula", "ok", "energy_ev", "xyz"}
QOPT = {"converged", "steps", "fmax_ev_a"}
QFREQ = {"frequencies_cm1", "n_imag", "zpe_ev", "temperature_k", "h_ev", "s_ev_k", "g_ev", "point_group",
         "symmetry_number", "thermo_spin"}
ITEMS = {
    ("freq", "thermo"): {"temperature_k", "h_corr_ev", "s_ev_k", "g_corr_ev", "h_ev", "g_ev"},
    ("conf", "conformers"): {"rank", "energy_ev", "rel_kcal", "weight", "xyz"},
    ("scan", "points"): {"angle_deg", "energy_ev", "rel_kcal", "converged"},
    ("md", "series"): {"t_fs", "epot_ev", "ekin_ev", "temperature_k"},
    ("pmd", "series"): {"t_ps", "epot_kj", "temperature_k", "rmsd_a", "rg_a"},
    ("pmd", "rmsf"): {"res", "chain", "a"},
    ("rxn", "species"): {"smiles", "side", "count", "charge", "spin", "energy_ev"},
    ("spin", "states"): {"spin", "energy_ev", "xyz"},
    ("bde", "fragments"): {"smiles", "spin", "energy_ev"},
    ("pa", "energies"): {"base_ev", "acid_ev"},
    ("ts", "profile"): {"s", "energy_ev", "rel_kcal"},
    ("neb", "profile"): {"s", "energy_ev", "rel_kcal"},
    ("ts", "irc"): {"forward", "reverse"},
    ("ocsr", "items"): {"index", "format", "width", "height", "ok", "smiles", "molfile", "confidence", "min_confidence",
                        "n_atoms", "n_bonds", "atoms", "valid", "canonical", "formula", "r_groups"},
    ("qslab", "slabs"): {"miller", "family", "atoms", "energy_ev", "area_a2", "gamma_j_m2", "gamma_ev_a2", "converged", "steps"},
    ("adsgen", "sites"): ADS_SITE | ADS_POLISH,
    ("adsgen", "slabs"): {"termination", "top", "composition", "energy_ev", "steps", "converged", "xyz"},
    ("adsgen", "lattice"): {"a_vegard", "a", "c", "method", "note"},
    ("adsgen", "reference"): {"scheme", "available", "refs_ev", "note"},
}
DEFAULTS = {
    "sp": {}, "ir": {}, "opt": {"fmax": 0.02}, "freq": {"temperature": 298.15, "symmetry": 1},
    "conf": {"n": 10, "temperature": 298.15, "window_kcal": 10.0},
    "md": {"temperature": 300.0, "timestep_fs": 0.5, "steps": 1000, "friction": 0.01},
    "ipea": {"mode": "adiabatic"}, "polar": {"average": False, "n": 8},
    "qslab": {"element": "Cu", "max_index": 1},
    "ts": {"fmax": 0.01, "irc": True, "irc_steps": 60},
    "adsgen": {"polish": True, "steps": 20, "lattice": "uma"},
}
PHON = {"supercell": [2, 2, 2], "displacement": 0.01, "relax": True, "mesh": 16, "t_max": 1000}
TS_GUESS = "3\nguess\nO 0 0 0\nH 0.1 0 0.95\nH 0 0 -0.95\n"  # the toy calculator: a bent triangle -> the linear saddle
NEB_R = "3\nreactant\nO 0 0 0\nH 0.9 0 0.3\nH -0.2 0 0.95\n"
NEB_P = "3\n\nO 0.00000000 0.00000000 0.00000000\nH -0.90000000 0.00000000 0.30000000\nH 0.20000000 0.00000000 0.95000000\n"
IRC_END = {"irc_steps", "irc_converged", "irc_note", "energy_ev", "relax_steps", "relax_converged", "fmax_ev_a",
           "barrier_kcal", "xyz"}
NEB_KEYS = {"images", "neb_steps", "neb_converged", "ci_steps", "ci_converged", "highest_image", "energies_rel_kcal",
            "reactant_energy_ev", "product_energy_ev", "reactant_relaxed", "product_relaxed", "band_xyz"}
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
    "pmd": {"params": {"pdb_id": "1VII", "ps": 5}},
    "qflow": {"params": {"items": ["CCO", "O"]}},
    "qslab": {"params": {"element": "Cu"}},
    "phon": {"params": {"preset": "Cu", "mesh": 8, "t_max": 300}},
    "ts": {"xyz": TS_GUESS, "params": {"irc_steps": 15}},
    "ocsr": {"params": {"images": []}},  # filled below with two drawn-size PNGs
    "neb": {"xyz": NEB_R, "params": {"product_xyz": NEB_P, "images": 3, "irc_steps": 15}},
    # canonical already (metals in alphabetical order), so the params come back as sent
    "adsgen": {"params": {"metal_a": "Ni", "metal_b": "Pt", "ratio": 0.25, "facet": "111", "adsorbate": "OH"}},
}
FIELDS["neb"] = FIELDS["ts"] | {"neb"}


def png_b64(w, h):
    """A white w x h PNG in base64, written by hand."""
    import base64
    import struct
    import zlib
    raw = b"".join(b"\x00" + b"\xff" * (3 * w) for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)  # noqa: E731
    return base64.b64encode(b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0))
                            + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")).decode()


REQUESTS["ocsr"]["params"]["images"] = [png_b64(120, 80), png_b64(64, 64)]


def expected_keys(model, job, params):
    # a protein comes back as PDB text; a quacc batch has one XYZ per molecule, a slab job none
    keys = (COMMON - {"xyz"} if job in ("pmd", "qflow", "qslab", "phon", "ocsr", "adsgen") else COMMON) | FIELDS[job]
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
        if job == "pmd":
            self.assertEqual(r["trajectory_pdb"].count("MODEL "), len(r["series"]))
            self.assertEqual(len(r["rmsf"]), r["residues"])
        if job in ("ts", "neb"):
            for side in r["irc"].values():
                self.assertEqual(set(side), IRC_END)
            self.assertEqual(r["path_xyz"].count(" s = "), r["n_path_frames"])
            self.assertEqual(len(r["imag_mode"]), 3)
            s = [p["s"] for p in r["profile"]]
            self.assertEqual(s, sorted(s))  # reverse end -> TS (s = 0) -> forward end
            self.assertIn(0.0, s)
            if job == "neb":
                self.assertEqual(set(r["neb"]), NEB_KEYS)
                self.assertEqual(len(r["neb"]["energies_rel_kcal"]), params["images"] + 2)
                self.assertEqual(r["neb"]["band_xyz"].count("NEB image"), params["images"] + 2)
        if job == "phon":  # the fake server's calculator is EMT for copper: real numbers
            self.assertEqual((r["symmetry"]["international"], r["symmetry"]["number"]), ("Fm-3m", 225))
            self.assertEqual((r["n_supercell"], r["n_displacements"], r["thermal"]["atoms_per_cell"]), (32, 1, 1))
            self.assertFalse(r["imaginary"])
            self.assertTrue(all(abs(f) < 0.01 for f in r["gamma_thz"]))
            self.assertEqual(r["band"]["ticks"][0]["label"], "Γ")
            self.assertEqual(len(r["thermal"]["temperature_k"]), len(r["thermal"]["heat_capacity_j_k_mol"]))
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
                self.assertEqual(h["models"][model]["jobs"], live(jobs), model)
                self.assertEqual(h["models"][model]["ready"], model not in PH or PHONOPY, model)
        self.assertEqual(set(h["models"]) - (QUACC_ALL - set(QF + QS)),
                         set(AM + A + BM + B + C + D + X + XN + P + I + QF + QS + PH + OC + G))
        for key in ("ok", "ready", "model", "device", "gpu", "queue", "running", "done", "cached", "models"):
            self.assertIn(key, h)

    def test_every_model_and_job(self):
        count = 0
        for group, jobs in GROUPS:
            for model in group:
                for job in live(jobs):
                    body = dict(REQUESTS[job], model=model, job=job)
                    r = self.run_job(body)
                    params = dict(DEFAULTS.get(job, {}))
                    params.update(self.full_params(job, body.get("params", {})))
                    if model == "quacc-psi4":  # single points only, with the default level of theory
                        params.update(recipe="static", method="b3lyp-d3bj", basis="def2-svp")
                    self.check_result(model, job, r, params)
                    count += 1
        self.assertEqual(count, 5 * 13 + 9 * 9 + 2 + 3 * 12 + 9 + 1 + 10 + (3 if QUACC else 0) + (4 if PHONOPY else 0) + 1 + 1)

    @staticmethod
    def full_params(job, given):
        out = dict(given)
        if job == "scan":
            out = {"start": -180.0, "end": 180.0, "points": 13, **given}
        if job == "rxn":
            out = {"thermo": False, "temperature": 298.15, **given}
        if job == "spin":
            out = {"spins": [1, 3], **given}
        if job == "pmd":
            out = {"chains": "", "temperature": 300.0, **given}
        if job == "qflow":
            out = {"recipe": "relax", "fmax": 0.01, "temperature": 298.15, **given}
        if job in ("ts", "neb"):
            out = {"fmax": 0.01, "irc": True, "irc_steps": 60, **given}
        if job == "phon":
            out = {**PHON, **given}
        if job == "ocsr":  # the images are not echoed back, only how many there were
            out = {"n_images": len(given["images"])}
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

    @unittest.skipUnless(QUACC, "quacc is not installed")
    def test_quacc(self):
        """A batch through each recipe (the toy calculator through quacc's own Runner and schemas), Psi4 forced to
        single points, and the EMT slabs of copper (real: EMT is part of ASE)."""
        for recipe, extra in (("static", set()), ("relax", QOPT), ("relax_freq", QOPT | QFREQ)):
            r = self.run_job({"model": "quacc-gfn2", "job": "qflow",
                              "params": {"items": ["OCC", "[CH3]", "[NH4+]"], "recipe": recipe}})
            self.assertEqual([i["smiles"] for i in r["items"]], ["CCO", "[CH3]", "[NH4+]"])  # canonical
            self.assertEqual([(i["charge"], i["spin"]) for i in r["items"]], [(0, 1), (0, 2), (1, 1)])
            self.assertEqual(r["n_ok"], 3)
            for item in r["items"]:
                self.assertEqual(set(item), QITEM | extra, recipe)
            self.assertEqual(r["items"][0]["formula"], "C2H6O")
            if recipe == "relax_freq":
                self.assertEqual(r["items"][1]["thermo_spin"], 2)  # the radical's electronic entropy
        r = self.run_job({"model": "quacc-psi4", "job": "qflow", "params": {"items": ["O"], "recipe": "relax_freq"}})
        self.assertEqual((r["recipe"], r["params"]["method"], r["params"]["basis"]), ("static", "b3lyp-d3bj", "def2-svp"))
        self.assertEqual(set(r["items"][0]), QITEM)
        r = self.run_job({"model": "quacc-emt", "job": "qslab", "params": {"element": "Cu"}})
        self.assertEqual([s["family"] for s in r["slabs"]], [[1, 1, 1], [1, 0, 0], [1, 1, 0]])  # fcc: 111 lowest
        self.assertAlmostEqual(r["a_angstrom"], 3.59, places=2)  # EMT copper
        self.assertEqual(r["lowest"], [1, 1, 1])

    @unittest.skipUnless(QUACC, "quacc is not installed")
    def test_quacc_refusals(self):
        self.refused({"model": "quacc-gfn2", "job": "qflow", "smiles": "C", "params": {"items": ["C"]}}, text="params.items")
        self.refused({"model": "quacc-gfn2", "job": "qflow"}, text="params.items")
        self.refused({"model": "quacc-gfn2", "job": "qflow", "params": {"items": []}}, text="params.items")
        self.refused({"model": "quacc-gfn2", "job": "qflow", "params": {"items": ["C"] * 9}}, text="1 to 8")
        self.refused({"model": "quacc-gfn2", "job": "qflow", "params": {"items": ["C", "C("]}}, text="cannot parse")
        self.refused({"model": "quacc-gfn2", "job": "qflow", "params": {"items": ["C" * 31]}}, text="at most 30 heavy")
        self.refused({"model": "quacc-psi4", "job": "qflow", "params": {"items": ["C" * 13]}}, text="at most 12 heavy")
        self.refused({"model": "quacc-psi4", "job": "qflow", "params": {"items": ["[Rb+]"]}}, text="does not know Rb")
        self.refused({"model": "quacc-gfn2", "job": "qflow", "params": {"items": ["C"], "recipe": "md"}}, text="params.recipe")
        self.refused({"model": "quacc-psi4", "job": "qflow", "params": {"items": ["C"], "method": "ccsd(t)"}}, text="params.method")
        self.refused({"model": "quacc-gfn2", "job": "qslab", "params": {"element": "Cu"}}, text="supports only")
        self.refused({"model": "quacc-emt", "job": "qslab", "params": {"element": "Fe"}}, text="params.element")
        self.refused({"model": "quacc-emt", "job": "qslab", "params": {"element": "Cu", "max_index": 3}}, text="params.max_index")
        self.refused({"model": "quacc-emt", "job": "qslab", "xyz": "1\n\nCu 0 0 0", "params": {"element": "Cu"}}, text="params.element")

    def test_dbcata(self):
        """The whole lane in toy mode: the worker process, the protocol, the structures and the result."""
        body = {"model": "dbcata", "job": "adsgen",
                "params": {"metal_a": "Au", "metal_b": "Cu", "ratio": 0.5, "facet": "111", "adsorbate": "H2O"}}
        r = self.run_job(body)
        self.assertEqual(r["engine"]["dbcata"], "toy")
        self.assertEqual(r["system"]["formula"], "AuCu")
        self.assertEqual(sorted(s["top"] for s in r["slabs"]), ["Au2Cu2"])
        self.assertEqual(r["distinct"], sum(s["same_as"] is None for s in r["sites"]))
        self.assertTrue(r["reference"]["available"])
        self.assertIn(r["best"], [s["id"] for s in r["sites"]])
        for s in r["sites"]:
            self.assertEqual(s["xyz"].count("Lattice="), 3)
        # the same system in the other order is the same job: cached
        status, again = self.call("POST", "/jobs", dict(body, params={"metal_a": "cu", "metal_b": "AU", "ratio": 0.5,
                                                                        "facet": "(111)", "adsorbate": "h2o"}))
        self.assertEqual((status, again.get("cached")), (200, True))
        r = self.run_job({"model": "dbcata", "job": "adsgen",
                          "params": {"metal_a": "Pd", "metal_b": "Ga", "ratio": 0.75, "facet": "111", "adsorbate": "S",
                                     "polish": False, "steps": 50, "lattice": "vegard"}})
        self.assertEqual(r["params"], {"metal_a": "Ga", "metal_b": "Pd", "ratio": 0.25, "facet": "111", "adsorbate": "S",
                                       "polish": False, "steps": 50, "lattice": "vegard"})
        self.assertFalse(r["reference"]["available"])
        for s in r["sites"]:
            self.assertEqual(set(s), ADS_SITE)
            self.assertIsNone(s["e_ads_ev"])

    def test_dbcata_refusals(self):
        ok = {"metal_a": "Ni", "metal_b": "Pt", "ratio": 0.25, "facet": "111", "adsorbate": "OH"}
        for change, text in (({"metal_a": "Tc"}, "radioactive"), ({"metal_b": "Ni"}, "two different metals"),
                             ({"metal_a": "Na"}, "training domain"), ({"ratio": 0.4}, "0.25, 0.5 or 0.75"),
                             ({"facet": "110"}, "no fcc(110)"), ({"adsorbate": "CO"}, "12 adsorbates"),
                             ({"steps": 10}, "params.steps"), ({"polish": 1}, "params.polish"),
                             ({"lattice": "pbe"}, "params.lattice")):
            self.refused({"model": "dbcata", "job": "adsgen", "params": dict(ok, **change)}, text=text)
        self.refused({"model": "dbcata", "job": "adsgen"}, text="params.metal_a")
        self.refused({"model": "dbcata", "job": "adsgen", "params": [1]}, text="params must be an object")
        self.refused({"model": "dbcata", "job": "adsgen", "smiles": "O", "params": ok}, text="takes no smiles or xyz")
        self.refused({"model": "dbcata", "job": "adsgen", "xyz": "1\n\nO 0 0 0", "params": ok}, text="takes no smiles or xyz")
        self.refused({"model": "dbcata", "job": "sp", "smiles": "O"}, text="supports only: adsgen")
        self.refused({"model": UMA, "job": "adsgen", "params": ok}, text="supports only")

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
        # protein MD: a PDB ID in params, nothing else
        self.refused({"model": "openmm-amber14", "job": "pmd", "smiles": "C", "params": {"pdb_id": "1VII"}}, text="in params")
        self.refused({"model": "openmm-amber14", "job": "pmd"}, text="params.pdb_id")
        for params, text in (({"pdb_id": "1VI"}, "params.pdb_id"), ({"pdb_id": "0VII"}, "params.pdb_id"),
                             ({"pdb_id": "1VII; rm"}, "params.pdb_id"), ({"pdb_id": "1VII", "chains": "A B"}, "params.chains"),
                             ({"pdb_id": "1VII", "ps": 500}, "params.ps"), ({"pdb_id": "1VII", "temperature": 600}, "params.temperature")):
            self.refused({"model": "openmm-amber14", "job": "pmd", "params": params}, text=text)
        self.refused({"model": "openmm-amber14", "job": "opt", "smiles": "C"}, text="supports only")
        self.refused({"model": UMA, "job": "pmd", "params": {"pdb_id": "1VII"}}, text="supports only")
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

    def test_closed_shell_refusals(self):
        """AIMNet2 takes ions but no radicals: SMILES, XYZ and reaction species."""
        self.refused({"model": "aimnet2", "job": "opt", "smiles": "[CH3]"}, text="closed-shell")
        self.refused({"model": "aimnet2", "job": "opt", "smiles": "C", "charge": 1, "spin": 2}, text="closed-shell")
        self.refused({"model": "aimnet2", "job": "sp", "xyz": "3\n\nO 0 0 0\nH 0 0 0.96\nH 0.93 0 -0.24", "charge": 1, "spin": 2}, text="closed-shell")
        self.refused({"model": "aimnet2", "job": "rxn", "params": {"reaction": "[CH3].[CH3]>>CC"}}, text="closed-shell")
        self.refused({"model": "aimnet2", "job": "ipea", "smiles": "CCO"}, text="supports only")
        self.refused({"model": "aimnet2", "job": "sp", "smiles": "[Na+]"}, text="does not know Na")
        r = self.run_job({"model": "aimnet2", "job": "opt", "smiles": "CC(=O)[O-]"})
        self.assertEqual((r["charge"], r["spin"]), (-1, 1))  # an anion, closed-shell: fine

    def test_ts_refusals(self):
        self.refused({"model": UMA, "job": "ts", "smiles": "CCO"}, text="needs coordinates")
        self.refused({"model": UMA, "job": "neb", "smiles": "CCO", "params": {"product_xyz": NEB_P}}, text="needs coordinates")
        self.refused({"model": UMA, "job": "ts", "xyz": "1\n\nH 0 0 0"}, text="at least 2 atoms")
        big = "51\n\n" + "".join(f"H {i % 10 * 1.0} {i // 10 * 1.0} 0\n" for i in range(51))
        self.refused({"model": UMA, "job": "ts", "xyz": big}, text="at most 50 atoms")
        self.refused({"model": UMA, "job": "neb", "xyz": NEB_R}, text="params.product_xyz")
        self.refused({"model": UMA, "job": "neb", "xyz": NEB_R, "params": {"product_xyz": "2\n\nO 0 0 0\nH 0 0 1"}},
                     text="same atoms")
        self.refused({"model": UMA, "job": "neb", "xyz": NEB_R, "params": {"product_xyz": NEB_P.replace("\nO ", "\nS ")}},
                     text="same atoms")
        self.refused({"model": UMA, "job": "neb", "xyz": NEB_R, "params": {"product_xyz": "3\n\nO 0 0 0\nH 0 0 x\nH 1 0 0"}},
                     text="product_xyz:")
        self.refused({"model": UMA, "job": "neb", "xyz": NEB_R, "params": {"product_xyz": NEB_P, "images": 12}}, text="params.images")
        self.refused({"model": UMA, "job": "ts", "xyz": TS_GUESS, "params": {"irc_steps": 500}}, text="params.irc_steps")
        self.refused({"model": UMA, "job": "ts", "xyz": TS_GUESS, "params": {"fmax": 0.08}}, text="params.fmax")
        self.refused({"model": UMA, "job": "ts", "xyz": TS_GUESS, "params": {"irc": "yes"}}, text="params.irc")
        self.refused({"model": "mace-mdp", "job": "ts", "xyz": TS_GUESS}, text="supports only")
        self.refused({"model": "ani-2x", "job": "ts", "xyz": TS_GUESS, "charge": 1}, text="neutral closed-shell")
        r = self.run_job({"model": "gfn2-xtb", "job": "ts", "xyz": TS_GUESS, "params": {"irc": False}})
        self.assertNotIn("irc", r)
        self.assertIn("imag_cm1", r)

    @unittest.skipUnless(PHONOPY, "phonopy / spglib / seekpath are not installed")
    def test_ocsr(self):
        """Structure images: the toy reading, the cache, the larger body only this job may send, the refusals."""
        images = [png_b64(200, 120)]
        r = self.run_job({"model": "molnextr", "job": "ocsr", "params": {"images": images}})
        it = r["items"][0]
        self.assertEqual((it["canonical"], it["formula"], it["valid"], it["format"], it["width"], it["height"]),
                         ("CC(=O)c1ccc(Br)cc1", "C8H7BrO", True, "png", 200, 120))
        self.assertTrue(0 < it["min_confidence"] <= it["confidence"] <= 1)
        self.assertEqual((r["engine"], r["n_ok"], r["params"]), ("MolNexTR", 1, {"n_images": 1}))
        status, again = self.call("POST", "/jobs", {"model": "molnextr", "job": "ocsr", "params": {"images": images}})
        self.assertEqual((status, again.get("cached")), (200, True))
        # a photo-sized crop: more than MAX_BODY, accepted for ocsr only
        import base64
        import random
        rnd = random.Random(7)
        noisy = base64.b64decode(png_b64(32, 32))
        big = base64.b64encode(noisy[:33] + bytes(rnd.randrange(256) for _ in range(100000)) + noisy[-12:]).decode()
        self.assertGreater(len(big), server.MAX_BODY)
        status, data = self.call("POST", "/jobs", {"model": "molnextr", "job": "ocsr", "params": {"images": [big]}})
        self.assertIn(status, (200, 202), data)  # the header is a PNG's; the toy reader does not decode the pixels
        status, data = self.call("POST", "/jobs", {"model": UMA, "job": "sp", "smiles": "C", "params": {"note": big}})
        self.assertEqual(status, 413)
        gif = base64.b64encode(b"GIF89a" + b"\x00" * 30).decode()
        self.refused({"model": "molnextr", "job": "ocsr", "params": {"images": [gif]}}, text="only PNG and JPEG")
        self.refused({"model": "molnextr", "job": "ocsr", "params": {"images": []}}, text="params.images")
        self.refused({"model": "molnextr", "job": "ocsr", "params": {"images": images * 9}}, text="params.images")
        self.refused({"model": "molnextr", "job": "ocsr", "smiles": "CCO", "params": {"images": images}}, text="not smiles or xyz")
        self.refused({"model": "molnextr", "job": "ocsr", "charge": 1, "params": {"images": images}}, text="no charge or spin")
        self.refused({"model": "molnextr", "job": "ocsr", "params": {"images": ["data:image/png;base64," + images[0]]}}, text="base64")
        self.refused({"model": "molnextr", "job": "sp", "smiles": "CCO"})
        self.refused({"model": UMA, "job": "ocsr", "params": {"images": images}})

    def test_phonons(self):
        """A crystal as POSCAR text and as CIF, the same answer either way, and the refusals before anything is queued."""
        poscar = "Cu fcc\n1.0\n0 1.8 1.8\n1.8 0 1.8\n1.8 1.8 0\nCu\n1\nDirect\n0 0 0\n"
        r = self.run_job({"model": "phonopy-emt", "job": "phon", "params": {"structure": poscar, "format": "poscar",
                                                                             "supercell": [2, 2, 2], "relax": False, "mesh": 8}})
        # the primitive cell is standardised to the conventional one first: 4 atoms, 2 x 2 x 2 -> 32
        self.assertEqual((r["symmetry"]["n_input"], r["symmetry"]["n_conventional"], r["n_supercell"]), (1, 4, 32))
        self.assertNotIn("relax", r)
        cif = ("data_Cu\n_cell_length_a 3.6\n_cell_length_b 3.6\n_cell_length_c 3.6\n_cell_angle_alpha 90\n"
               "_cell_angle_beta 90\n_cell_angle_gamma 90\n_symmetry_space_group_name_H-M 'F m -3 m'\n"
               "loop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n"
               "_atom_site_fract_z\nCu1 Cu 0 0 0\n")
        r2 = self.run_job({"model": "phonopy-emt", "job": "phon", "params": {"structure": cif, "format": "cif",
                                                                              "relax": False, "mesh": 8}})
        self.assertEqual(r2["n_supercell"], 32)
        self.assertAlmostEqual(r2["max_frequency_thz"], r["max_frequency_thz"], places=3)  # a = 3.6 both times
        pm = "phonopy-emt"
        self.refused({"model": pm, "job": "phon"}, text="exactly one of params.preset")
        self.refused({"model": pm, "job": "phon", "params": {"preset": "Cu", "structure": poscar}}, text="exactly one")
        self.refused({"model": pm, "job": "phon", "params": {"preset": "Fe"}}, text="params.preset")
        self.refused({"model": pm, "job": "phon", "params": {"preset": "NaCl"}}, text="does not take Cl, Na")
        self.refused({"model": pm, "job": "phon", "params": {"preset": "Cu", "supercell": [5, 1, 1]}}, text="params.supercell")
        self.refused({"model": pm, "job": "phon", "params": {"preset": "Cu", "supercell": [4, 4, 4]}}, text="at most 216")
        self.refused({"model": pm, "job": "phon", "params": {"preset": "Cu", "displacement": 0.2}}, text="params.displacement")
        self.refused({"model": pm, "job": "phon", "params": {"preset": "Cu", "mesh": 64}}, text="params.mesh")
        self.refused({"model": pm, "job": "phon", "params": {"preset": "Cu", "t_max": 5000}}, text="params.t_max")
        self.refused({"model": pm, "job": "phon", "params": {"structure": "not a poscar"}}, text="could not read")
        self.refused({"model": pm, "job": "phon", "params": {"structure": poscar, "format": "xyz"}}, text="params.format")
        self.refused({"model": pm, "job": "phon", "smiles": "C", "params": {"preset": "Cu"}}, text="not smiles or xyz")
        self.refused({"model": UMA, "job": "phon", "charge": 1, "params": {"preset": "Si"}}, text="no charge or spin")
        self.refused({"model": "esen-sm-conserving-all-omol", "job": "phon", "params": {"preset": "Si"}}, text="supports only")
        # a cell without symmetry: 16 atoms in P1 need 3 x 16 x 2 = 96 displaced supercells
        rng = __import__("random").Random(7)
        p1 = "P1\n1.0\n5.1 0 0\n0.3 5.3 0\n0.2 0.4 5.6\nCu\n16\nDirect\n" + "".join(
            f"{rng.random():.4f} {rng.random():.4f} {rng.random():.4f}\n" for _ in range(16))
        self.refused({"model": pm, "job": "phon", "params": {"structure": p1, "supercell": [1, 1, 1]}}, text="at most 48")

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
                self.assertEqual(server.MODELS[model]["charged"], group in (A, AM) or group is X or group is QF or group is I, model)
                self.assertEqual(bool(server.MODELS[model].get("closed")), group is I, model)
                self.assertEqual(server.MODELS[model]["direct"], model in DIRECT, model)
        # quacc's models are in the table even where quacc is not installed (they are then not ready)
        self.assertEqual(set(server.MODELS), set(AM + A + BM + B + C + D + X + XN + P + I + PH + OC + G) | QUACC_ALL)
        self.assertEqual(len(server.MODELS), 27)
        self.assertEqual(server.TIME_LIMITS, {"sp": 120, "opt": 120, "pmd": 900, "qflow": 900, "qslab": 300, "ts": 900, "neb": 1200,
                                              "phon": 900, "ocsr": 120, "adsgen": 900})
        self.assertEqual(server.DEFAULT_LIMIT, 600)
    def test_aimnet_proxy(self):
        """AIMNet2 reaches chemjobs through aimnet_worker.py with the same JSON lines as MACE (stubbed here)."""
        sent = []

        def call(req, timeout=None):
            sent.append(req)
            return {"ok": True, "energy_ev": -10.0 + req["charge"], "forces": [[0.0, 0.1, 0.0]] * len(req["symbols"]), "charges": []}

        backend = server.AimnetBackend.__new__(server.AimnetBackend)
        backend.call = call
        self.assertEqual((backend.SCRIPT, backend.NAME), ("aimnet_worker.py", "AIMNet2"))
        calc = server.cj.EFCalculator(backend.ef("aimnet2"))
        atoms = server.cj.new_atoms(["N", "H", "H", "H", "H"], server.np.zeros((5, 3)) + server.np.arange(5)[:, None], 1, 1, calc)
        self.assertEqual(atoms.get_potential_energy(), -9.0)
        self.assertEqual(sent[-1]["model"], "aimnet2")
        self.assertEqual((sent[-1]["charge"], sent[-1]["spin"]), (1, 1))
        with self.assertRaises(RuntimeError):
            backend.dp(["H"], server.np.zeros((1, 3)))
        # the elements the server checks are the worker's own list
        import aimnet_worker
        self.assertEqual(server.AIMNET_ELEMENTS, aimnet_worker.ELEMENTS)
        self.assertEqual(tuple(server.MODELS["aimnet2"]["elements"]), aimnet_worker.ELEMENTS)

    def test_dbcata_backend(self):
        """The worker process: progress reaches the job's budget, running out of time kills the process (the GPU stops
        at once), and the next job starts a new one."""
        backend = server.DbcataBackend(sys.executable, toy=True)
        self.assertEqual(backend.info["dbcata"], "toy")
        seen = []
        p = server.dc.check({"metal_a": "Cu", "metal_b": "Au", "ratio": 0.5, "facet": "111", "adsorbate": "O"})
        r = backend.run(p, server.cj.Budget(300, seen.append))
        self.assertEqual(r["system"]["formula"], "AuCu")
        self.assertEqual(seen[-1]["note"], "done")
        self.assertEqual(seen[-1]["done"], seen[-1]["total"])
        first = backend.proc
        with self.assertRaises(server.cj.JobTimeout):
            budget = server.cj.Budget(300, None)
            budget.start -= 299.99  # the limit passes at the first progress line
            backend.run(p, budget)
        self.assertIsNone(backend.proc)
        self.assertIsNotNone(first.wait(10))
        self.assertEqual(backend.run(p, server.cj.Budget(300, None))["system"]["formula"], "AuCu")
        with self.assertRaises(RuntimeError) as cm:
            backend.call({"op": "run", "params": {"metal_a": "Au"}}, timeout=60)
        self.assertIn("params.metal_b", str(cm.exception))
        backend.kill()

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
            given = REQUESTS[job].get("params", {}) if job == "adsgen" else {}  # adsgen has required params
            self.assertEqual(server.job_params(job, given), {**given, **want}, job)
        self.assertEqual(server.job_params("phon", {"preset": "Cu"}), {**PHON, "preset": "Cu"})


if __name__ == "__main__":
    unittest.main()
