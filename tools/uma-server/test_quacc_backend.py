"""quacc_backend.py: the helpers with numpy only (surface energy, Miller families, schema trimming, batch cost, the
quiet stdout), and, when quacc is installed, its real EMT recipes on copper and the GFN2 recipes on water (tblite, or
the xtb program when tblite is missing and xtb is on PATH).

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


if __name__ == "__main__":
    unittest.main()
