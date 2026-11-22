"""AIMNet2 through aimnet_worker.py, the real model: only where MOLASTRIA_AIMNET_PYTHON names a Python with
pip install "aimnet[ase]" (the weights download on first use). Runs with the UMA environment's Python, like server.py:

    set MOLASTRIA_AIMNET_PYTHON=D:\\ChemDraw\\aimnet-env\\Scripts\\python.exe
    python -X utf8 -m unittest tools/uma-server/test_aimnet_worker.py -v
"""
import os
import sys
import unittest

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import chemjobs as cj  # noqa: E402
import server  # noqa: E402
import tsjobs as tj  # noqa: E402

PY = os.environ.get("MOLASTRIA_AIMNET_PYTHON", "")


@unittest.skipUnless(PY, "MOLASTRIA_AIMNET_PYTHON is not set")
class RealAimnet(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.backend = server.AimnetBackend(PY)
        cls.calc = lambda self=None: cj.EFCalculator(cls.backend.ef("aimnet2"))

    def test_ping(self):
        info = self.backend.info
        self.assertIn("aimnet2", info["models"])
        self.assertEqual(tuple(info["elements"]), server.AIMNET_ELEMENTS)
        self.assertTrue(info["version"])

    def test_water(self):
        e, f = self.backend.ef("aimnet2")(["O", "H", "H"], [[0, 0, 0], [0, 0, 0.96], [0.93, 0, -0.24]], 0, 1)
        self.assertAlmostEqual(e / 27.211386, -76.4, delta=0.2)  # wB97M/def2-TZVPP total energy of water, about -76.43 Eh
        self.assertEqual(len(f), 3)

    def test_radical_refused(self):
        with self.assertRaises(RuntimeError):
            self.backend.ef("aimnet2")(["O", "H", "H"], [[0, 0, 0], [0, 0, 0.96], [0.93, 0, -0.24]], 1, 2)

    def test_ammonium_optimises(self):
        st = cj.Structure(["N", "H", "H", "H", "H"], [[0, 0, 0], [0.6, 0.6, 0.6], [-0.6, -0.6, 0.6], [-0.6, 0.6, -0.6],
                                                       [0.6, -0.6, -0.6]], 1, 1, "NH4+")
        r = cj.run_opt(st, self.calc(), cj.Budget(120), "NH4+", 0.01)
        self.assertTrue(r["converged"])
        n, *hs = cj.parse_xyz(r["xyz"])[1]
        for h in hs:
            self.assertAlmostEqual(float(((h - n) ** 2).sum() ** 0.5), 1.03, delta=0.03)  # N-H in NH4+ about 1.03 A

    @unittest.skipUnless(tj.sella_version(), "sella is not installed")
    def test_hcn_transition_state(self):
        guess = cj.Structure(["H", "C", "N"], [[0.6, 1.0, 0.0], [0.0, 0.0, 0.0], [1.17, 0.0, 0.0]])
        r = tj.run_ts(guess, self.calc(), cj.Budget(300), "HCN", irc=False)
        self.assertTrue(r["is_first_order_saddle"])
        self.assertLess(r["imag_cm1"], -800)


if __name__ == "__main__":
    unittest.main()
