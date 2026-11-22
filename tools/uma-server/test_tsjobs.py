"""tsjobs.py on a real method: HCN <-> HNC with GFN2-xTB through tblite (pip install tblite), the textbook
isomerisation with one imaginary mode. Skipped where Sella or tblite is not installed.

    python -X utf8 -m unittest tools/uma-server/test_tsjobs.py -v
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import chemjobs as cj  # noqa: E402
import tsjobs as tj  # noqa: E402

try:
    from tblite.ase import TBLite
except ImportError:
    TBLite = None
SKIP = not (tj.sella_version() and TBLite)


def gfn2(symbols, positions, charge, spin):
    from ase import Atoms

    atoms = Atoms(symbols, positions=positions)
    atoms.calc = TBLite(method="GFN2-xTB", charge=charge, multiplicity=spin, verbosity=0)
    return atoms.get_potential_energy(), atoms.get_forces()


def make():
    return cj.EFCalculator(gfn2)


def hydrogen_on(positions):
    """'C' when the H sits on carbon (HCN), 'N' when on nitrogen (HNC)."""
    h, c, n = positions
    return "C" if np.linalg.norm(h - c) < np.linalg.norm(h - n) else "N"


def frames(xyz):
    out, lines = [], xyz.splitlines()
    i = 0
    while i < len(lines):
        n = int(lines[i])
        out.append(np.array([[float(v) for v in ln.split()[1:4]] for ln in lines[i + 2:i + 2 + n]]))
        i += 2 + n
    return out


@unittest.skipIf(SKIP, "sella or tblite is not installed")
class HcnIsomerisation(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        guess = cj.Structure(["H", "C", "N"], [[0.6, 1.0, 0.0], [0.0, 0.0, 0.0], [1.17, 0.0, 0.0]])
        cls.ts = tj.run_ts(guess, make(), cj.Budget(600), "HCN", irc_steps=60)
        react = cj.Structure(["H", "C", "N"], [[-1.0, 0.3, 0.0], [0.0, 0.0, 0.0], [1.16, 0.0, 0.0]])
        product = np.array([[2.1, 0.3, 0.0], [0.0, 0.0, 0.0], [1.17, 0.0, 0.0]])
        cls.neb = tj.run_neb(react, product, make, cj.Budget(600), "HCN", images=5)

    def test_saddle(self):
        r = self.ts
        self.assertTrue(r["ts_converged"])
        self.assertLessEqual(r["ts_fmax_ev_a"], tj.TS_FMAX)
        self.assertTrue(r["is_first_order_saddle"])
        self.assertEqual(r["n_imag_significant"], 1)
        self.assertLess(r["imag_cm1"], -1000)  # GFN2-xTB about -1426 cm^-1: the H swinging between C and N
        self.assertEqual(len(r["frequencies_cm1"]), 3)  # 3N - 6
        # the imaginary mode moves the hydrogen most
        self.assertEqual(int(np.argmax(np.linalg.norm(np.array(r["imag_mode"]), axis=1))), 0)

    def test_irc_joins_the_two_isomers(self):
        r = self.ts
        ends = {d: frames(r["irc"][d]["xyz"])[0] for d in ("forward", "reverse")}
        self.assertEqual({hydrogen_on(p) for p in ends.values()}, {"C", "N"})
        for d in ("forward", "reverse"):
            self.assertTrue(r["irc"][d]["relax_converged"], d)
            self.assertGreater(r["irc"][d]["barrier_kcal"], 10, d)
        e = {hydrogen_on(ends[d]): r["irc"][d]["energy_ev"] for d in ends}
        # HNC above HCN; experiment about 15 kcal/mol, GFN2-xTB about 20
        self.assertGreater((e["N"] - e["C"]) * cj.EV_TO_KCAL, 5)
        self.assertLess((e["N"] - e["C"]) * cj.EV_TO_KCAL, 30)
        self.assertAlmostEqual(abs(r["reaction_energy_kcal"]), (e["N"] - e["C"]) * cj.EV_TO_KCAL, places=2)

    def test_profile(self):
        p = self.ts["profile"]
        s = [x["s"] for x in p]
        self.assertEqual(s, sorted(s))
        top = max(p, key=lambda x: x["energy_ev"])
        self.assertEqual(top["s"], 0.0)  # the TS is the highest point of its own IRC
        self.assertAlmostEqual(top["rel_kcal"], 0.0, places=6)
        path = frames(self.ts["path_xyz"])
        self.assertEqual(len(path), self.ts["n_path_frames"])
        self.assertEqual({hydrogen_on(path[0]), hydrogen_on(path[-1])}, {"C", "N"})

    def test_neb_finds_the_same_ts(self):
        r = self.neb
        self.assertTrue(r["neb"]["ci_converged"])
        self.assertTrue(r["is_first_order_saddle"])
        self.assertAlmostEqual(r["ts_energy_ev"], self.ts["ts_energy_ev"], places=3)
        band = r["neb"]["energies_rel_kcal"]
        self.assertEqual(len(band), 7)
        # the climbing image already sits close to the saddle Sella refines
        self.assertLess(abs(max(band) - (r["ts_energy_ev"] - r["neb"]["reactant_energy_ev"]) * cj.EV_TO_KCAL), 2.0)
        self.assertEqual(band[0], 0.0)


class Helpers(unittest.TestCase):
    def test_thin(self):
        self.assertEqual(tj._thin(5, 30), [0, 1, 2, 3, 4])
        t = tj._thin(100, 30)
        self.assertLessEqual(len(t), 30)
        self.assertEqual((t[0], t[-1]), (0, 99))

    def test_mass_weighted_length(self):
        a = np.zeros((2, 3))
        b = a.copy()
        b[1, 0] = 0.5
        self.assertAlmostEqual(tj._mw_length([a, b], [1.0, 4.0])[0], 1.0)  # 0.5 Angstrom * sqrt(4 amu)


if __name__ == "__main__":
    unittest.main()
