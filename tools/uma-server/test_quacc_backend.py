"""quacc_backend.py: the helpers with numpy only (surface energy, Miller families, schema trimming, batch cost, the
quiet stdout), and, when quacc is installed, its real EMT recipes on copper and the GFN2 recipes on water (tblite, or
the xtb program when tblite is missing and xtb is on PATH); quacc-psi4 through psi4_worker.py with a stub worker,
and for real when MOLASTRIA_PSI4_PYTHON names a conda environment with psi4 and quacc.

    python -X utf8 -m unittest tools/uma-server/test_quacc_backend.py -v
"""
import io
import os
import sys
import threading
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import quacc_backend as qb  # noqa: E402

QUACC = bool(qb.quacc_version())


class Helpers(unittest.TestCase):
    def test_surface_energy(self):
        # a 2 x 3 Angstrom surface cell, slab 1 eV above four bulk atoms: (1 eV) / (2 * 6 A^2) = 1/12 eV/A^2
        gamma, area = qb.surface_energy(-3.0, 4, -1.0, [[2, 0, 0], [0, 3, 0], [0, 0, 20]])
        self.assertAlmostEqual(area, 6.0)
        self.assertAlmostEqual(gamma, qb.EV_A2_TO_J_M2 / 12)
        self.assertAlmostEqual(qb.EV_A2_TO_J_M2, 1.602176634e-19 / 1e-20, places=5)  # eV/A^2 -> J/m^2

    def test_miller(self):
        self.assertEqual(qb.canonical_miller((1, 0, -1)), [1, 1, 0])
        self.assertEqual(qb.canonical_miller((0, 0, 1)), [1, 0, 0])
        self.assertEqual(qb.miller_of({"slab_stats": {"miller_index": (1, 1, 1)}}), [1, 1, 1])
        self.assertIsNone(qb.miller_of({}))

    def test_cost(self):
        self.assertEqual(qb.flow_cost("quacc-gfn2", "relax_freq", 8), 24)
        self.assertEqual(qb.flow_cost("quacc-gfn2", "static", 3), 3)
        self.assertEqual(qb.flow_cost("quacc-psi4", "static", 4), 8)

    def test_trim(self):
        opt = {"results": {"energy": -1.5, "forces": [[0, 0, 0.03], [0.04, 0, 0]]}, "converged": True,
               "trajectory": [0, 1, 2, 3]}
        self.assertEqual(qb.trim_opt(opt), {"energy_ev": -1.5, "converged": True, "steps": 3, "fmax_ev_a": 0.04})
        freq = {"results": {"imag_vib_freqs": [-120.0], "vib_freqs": [1600.0, 3700.0], "n_imag": 1, "zpe": 0.33,
                            "enthalpy": -1.0, "entropy": 0.002, "gibbs_energy": -1.6},
                "parameters_thermo": {"temperature": 298.15, "sigma": 2, "spin_multiplicity": 1},
                "molecule_metadata": {"symmetry": {"point_group": "C2v"}}}
        t = qb.trim_freq(freq)
        self.assertEqual(t["frequencies_cm1"], [-120.0, 1600.0, 3700.0])  # imaginary ones negative, first
        self.assertEqual((t["n_imag"], t["symmetry_number"], t["point_group"], t["thermo_spin"]), (1, 2, "C2v", 1))
        self.assertEqual((t["h_ev"], t["s_ev_k"], t["g_ev"]), (-1.0, 0.002, -1.6))

    def test_quiet_threads(self):
        real = io.StringIO()
        q = qb._QuietThreads(real)
        q.write("seen\n")
        q.quiet.add(threading.get_ident())
        q.write("dropped\n")
        t = threading.Thread(target=lambda: q.write("other thread\n"))
        t.start()
        t.join()
        q.quiet.discard(threading.get_ident())
        self.assertEqual(real.getvalue(), "seen\nother thread\n")


class Budget:
    def check(self):
        pass

    def progress(self, *a):
        pass


@unittest.skipUnless(QUACC, "quacc is not installed (pip install quacc)")
class RealRecipes(unittest.TestCase):
    def test_emt_copper_slabs(self):
        r = qb.QuaccBackend().slabs("Cu", 1, Budget())
        self.assertAlmostEqual(r["a_angstrom"], 3.5895, places=3)  # ASE EMT copper, cell relaxed
        fam = {tuple(s["family"]): s["gamma_j_m2"] for s in r["slabs"]}
        self.assertEqual(set(fam), {(1, 1, 1), (1, 0, 0), (1, 1, 0)})
        self.assertLess(fam[(1, 1, 1)], fam[(1, 0, 0)])  # fcc: close-packed lowest, then (100), (110)
        self.assertLess(fam[(1, 0, 0)], fam[(1, 1, 0)])
        for s in r["slabs"]:
            self.assertTrue(0.5 < s["gamma_j_m2"] < 2.0, s)

    def test_gfn2_water(self):
        import xtb_backend as xb

        exe = xb.find_xtb()
        b = qb.QuaccBackend(xtb=xb.XtbBackend(exe) if exe else None)
        if not b.ready("quacc-gfn2"):
            self.skipTest("neither tblite nor the xtb program is installed")
        from ase.build import molecule

        w = molecule("H2O")
        r = b.flow("quacc-gfn2", [{"smiles": "O", "symbols": w.get_chemical_symbols(), "positions": w.get_positions(),
                                   "charge": 0, "spin": 1, "formula": "H2O"}], "relax_freq", {"fmax": 0.01}, Budget())
        row = r["items"][0]
        self.assertTrue(row["ok"], row)
        self.assertEqual(row["n_imag"], 0)
        self.assertEqual(len(row["frequencies_cm1"]), 3)
        # GFN2-xTB water: bend about 1540, stretches about 3640 / 3650 cm^-1 (tblite 0.5, xtb 6.7 agree within a few)
        self.assertAlmostEqual(row["frequencies_cm1"][0], 1539, delta=15)
        self.assertAlmostEqual(row["frequencies_cm1"][2], 3651, delta=25)
        self.assertEqual((row["point_group"], row["symmetry_number"]), ("C2v", 2))


STUB = """
import json, sys, time
req = json.loads(sys.stdin.readline())
print("psi4 chatter that must not break the protocol")
if req["op"] == "version":
    print(json.dumps({"ok": True, "psi4": "1.11-stub", "quacc": "1.10.0"}))
elif req.get("method") == "slow":
    time.sleep(30)
elif req.get("method") == "bad":
    print(json.dumps({"ok": False, "error": "PsiException: SCF did not converge"}))
else:
    n = len(req["symbols"])
    print(json.dumps({"ok": True, "energy_ev": -2000.0 - n + req["charge"], "symbols": req["symbols"],
                      "positions": req["positions"]}))
"""


@unittest.skipUnless(QUACC, "quacc is not installed (pip install quacc)")
class Psi4Worker(unittest.TestCase):
    """quacc-psi4 through psi4_worker.py in another environment (a stub worker run by this Python)."""

    def setUp(self):
        import tempfile

        self.dir = tempfile.TemporaryDirectory()
        self.stub = os.path.join(self.dir.name, "stub_worker.py")
        with open(self.stub, "w", encoding="utf-8") as f:
            f.write(STUB)
        self.old, qb.QuaccBackend.WORKER = qb.QuaccBackend.WORKER, self.stub

    def tearDown(self):
        qb.QuaccBackend.WORKER = self.old
        self.dir.cleanup()

    def backend(self, python=None):
        b = qb.QuaccBackend(psi4_python=python if python is not None else sys.executable)
        if b.psi4:
            self.skipTest("psi4 imports in this environment, so the worker road is not taken")
        return b

    def item(self):
        return {"smiles": "O", "symbols": ["O", "H", "H"], "positions": [[0, 0, 0], [0, 0, 0.96], [0.93, 0, -0.24]],
                "charge": 0, "spin": 1, "formula": "H2O"}

    def test_ready_and_batch(self):
        b = self.backend()
        self.assertTrue(b.ready("quacc-psi4"))
        r = b.flow("quacc-psi4", [self.item()], "static", {"method": "hf", "basis": "sto-3g"}, Budget())
        self.assertEqual(r["engine"], "Psi4 1.11-stub hf/sto-3g (quacc.recipes.psi4)")
        row = r["items"][0]
        self.assertTrue(row["ok"], row)
        self.assertEqual(row["energy_ev"], -2003.0)
        self.assertTrue(row["xyz"].startswith("3\n"))

    def test_failure_is_one_row(self):
        r = self.backend().flow("quacc-psi4", [self.item(), self.item()], "static", {"method": "bad", "basis": "sto-3g"},
                                Budget())
        self.assertEqual(r["n_ok"], 0)
        self.assertIn("SCF did not converge", r["items"][0]["error"])

    def test_time_limit(self):
        import chemjobs as cj

        b = self.backend()
        with self.assertRaises(cj.JobTimeout):
            b.flow("quacc-psi4", [self.item()], "static", {"method": "slow", "basis": "sto-3g"}, cj.Budget(limit=2))

    def test_missing_environment_stays_off(self):
        b = self.backend(os.path.join(self.dir.name, "no-such-python.exe"))
        self.assertFalse(b.ready("quacc-psi4"))
        self.assertTrue(b.psi4_error)


@unittest.skipUnless(QUACC and os.environ.get("MOLASTRIA_PSI4_PYTHON"), "set MOLASTRIA_PSI4_PYTHON to a conda env with psi4 + quacc")
class RealPsi4Worker(unittest.TestCase):
    def test_water_hf_sto3g(self):
        b = qb.QuaccBackend(psi4_python=os.environ["MOLASTRIA_PSI4_PYTHON"])
        self.assertTrue(b.ready("quacc-psi4"), b.psi4_error)
        it = {"smiles": "O", "symbols": ["O", "H", "H"],
              "positions": [[0, 0, 0.1173], [0, 0.7572, -0.4692], [0, -0.7572, -0.4692]], "charge": 0, "spin": 1}
        row = b.flow("quacc-psi4", [it], "static", {"method": "hf", "basis": "sto-3g"}, Budget())["items"][0]
        self.assertTrue(row["ok"], row)
        self.assertAlmostEqual(row["energy_ev"] / 27.211386, -74.96, delta=0.02)  # RHF/STO-3G water, about -74.96 Eh


if __name__ == "__main__":
    unittest.main()
