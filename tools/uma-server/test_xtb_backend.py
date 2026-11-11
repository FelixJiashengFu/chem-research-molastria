"""xtb_backend.py: the parsers on xtb's own output (saved from xtb 6.7.1, GFN2-xTB, water), and, when an xtb executable
is found (PATH, MOLASTRIA_XTB or this Python environment), real runs through chemjobs: water's energy, an
optimisation and the force check against finite differences.

    python -X utf8 -m unittest tools/uma-server/test_xtb_backend.py -v
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import xtb_backend as xb  # noqa: E402

GRADIENT = """$grad
  cycle =      1    SCF energy =    -5.07037589727   |dE/dxyz| =  0.007795
    0.00000000000000      0.00000000000000      0.22109795658059      O
    0.00000000000000      1.43052267633767     -0.88250210019775      H
    0.00000000000000     -1.43052267633767     -0.88250210019775      H
   6.9537069531119E-18   3.0173302666004E-16   8.1366557984418E-04
  -1.3520935915472D-17  -5.4664373992516E-03  -4.0683278992196E-04
   6.5672289623606E-18   5.4664373992513E-03  -4.0683278992221E-04
$end
"""
OUTPUT = """
         3        2.0000           -0.5139957             -13.9865
         4        2.0000           -0.4475014             -12.1771 (HOMO)
         5                          0.0924565               2.5159 (LUMO)
         6                          0.2920349               7.9467
         :: HOMO-LUMO gap             14.693003302697 eV    ::
molecular dipole:
                 x           y           z       tot (Debye)
 q only:        0.000       0.000      -0.622
   full:       -0.000       0.000      -0.891       2.266
molecular quadrupole (traceless):
                xx          xy          yy          xz          yz          zz
   full:       -1.247      -0.000       1.421       0.000      -0.000      -0.173
          | HOMO-LUMO GAP              14.693003302697 eV   |
"""
WATER = (["O", "H", "H"], [[0, 0, 0.117], [0, 0.757, -0.467], [0, -0.757, -0.467]])


class Parsers(unittest.TestCase):
    def test_gradient(self):
        e, g = xb.parse_gradient(GRADIENT, 3)
        self.assertAlmostEqual(e, -5.07037589727)
        self.assertEqual(g.shape, (3, 3))
        self.assertAlmostEqual(g[1, 1], -5.4664373992516e-3)
        self.assertAlmostEqual(g[1, 0], -1.3520935915472e-17)  # Fortran D exponent

    def test_last_cycle_wins(self):
        two = GRADIENT.replace("$end\n", "") + GRADIENT.replace("$grad\n", "").replace("-5.07037589727", "-5.1")
        self.assertAlmostEqual(xb.parse_gradient(two, 3)[0], -5.1)

    def test_bad_gradient(self):
        with self.assertRaises(ValueError):
            xb.parse_gradient("$grad\n$end\n", 3)
        with self.assertRaises(ValueError):
            xb.parse_gradient(GRADIENT, 4)

    def test_properties(self):
        p = xb.parse_properties(OUTPUT)
        self.assertEqual(p, {"gap_ev": 14.693003302697, "dipole_debye": 2.266, "homo_ev": -12.1771, "lumo_ev": 2.5159})
        self.assertEqual(xb.parse_properties("GFN-FF has no orbitals"), {})

    def test_charges_and_xyz(self):
        self.assertEqual(xb.parse_charges("  -0.56\n 0.28\n 0.28\n", 3), [-0.56, 0.28, 0.28])
        self.assertIsNone(xb.parse_charges("-0.56\n", 3))
        self.assertTrue(xb.xyz_block(*WATER).startswith("3\nMolAstria\nO 0.0000000000"))

    def test_methods(self):
        self.assertEqual(set(xb.METHODS), {"gfn2-xtb", "gfn2-xtb-alpb-water", "gfn1-xtb", "gfn-ff"})


EXE = xb.find_xtb()


@unittest.skipUnless(EXE, "no xtb executable")
class RealXtb(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.b = xb.XtbBackend(EXE)

    def test_water_energy(self):
        e, f = self.b.ef("gfn2-xtb")(*WATER, 0, 1)
        self.assertAlmostEqual(e / xb.HARTREE_EV, -5.0704, places=3)  # GFN2-xTB water near this geometry
        self.assertEqual(np.asarray(f).shape, (3, 3))
        self.assertLess(abs(np.asarray(f).sum(axis=0)).max(), 1e-6)  # no net force

    def test_forces_are_minus_gradient(self):
        ef = self.b.ef("gfn2-xtb")
        sym, pos = WATER[0], np.array(WATER[1], float)
        _, f = ef(sym, pos, 0, 1)
        h = 1e-3
        for i, k in ((1, 1), (0, 2)):
            p, m = pos.copy(), pos.copy()
            p[i, k] += h
            m[i, k] -= h
            num = -(ef(sym, p, 0, 1)[0] - ef(sym, m, 0, 1)[0]) / (2 * h)
            self.assertAlmostEqual(f[i][k], num, delta=2e-3)

    def test_methods_and_charges(self):
        energies = {m: self.b.ef(m)(*WATER, 0, 1)[0] for m in xb.METHODS}
        self.assertEqual(len({round(e, 3) for e in energies.values()}), 4)  # four different methods
        self.assertLess(energies["gfn2-xtb-alpb-water"], energies["gfn2-xtb"])  # solvation lowers the energy
        e_cation, _ = self.b.ef("gfn2-xtb")(*WATER, 1, 2)
        self.assertGreater(e_cation, energies["gfn2-xtb"])

    def test_optimisation_and_properties(self):
        import chemjobs as cj

        st = cj.Structure(*WATER, 0, 1, "water")
        r = cj.run_opt(st, cj.EFCalculator(self.b.ef("gfn2-xtb")), cj.Budget(120), "water GFN2-xTB")
        self.assertTrue(r["converged"])
        sym, pos = cj.parse_xyz(r["xyz"])
        oh = np.linalg.norm(pos[1] - pos[0])
        self.assertAlmostEqual(oh, 0.959, delta=0.01)  # GFN2-xTB O-H about 0.96 A
        p = self.b.properties("gfn2-xtb", sym, pos, 0, 1)
        self.assertGreater(p["gap_ev"], 10)
        self.assertAlmostEqual(sum(p["charges"]), 0, places=2)
        self.assertGreater(p["dipole_debye"], 1.5)
        self.assertNotIn("gap_ev", self.b.properties("gfn-ff", sym, pos, 0, 1))


if __name__ == "__main__":
    unittest.main()
