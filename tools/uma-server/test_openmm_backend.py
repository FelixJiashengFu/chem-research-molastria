"""openmm_backend.py: the analysis helpers and input checks with numpy only, and, when OpenMM and PDBFixer are
installed, a real 3 ps run of the villin headpiece (PDB 1VII, fixtures/1vii.pdb; REMARK lines dropped) on the CPU.

    python -X utf8 -m unittest tools/uma-server/test_openmm_backend.py -v
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import openmm_backend as ob  # noqa: E402

class Budget:  # chemjobs.Budget without ase: the helpers only call check() and progress()
    def __init__(self, limit=0):
        pass

    def check(self):
        pass

    def progress(self, done, total, note=""):
        pass


RNG = np.random.default_rng(7)
PTS = RNG.normal(size=(12, 3)) * 5


def rot(theta):
    c, s = np.cos(theta), np.sin(theta)
    return np.array([[c, -s, 0], [s, c, 0], [0, 0, 1]])


class Helpers(unittest.TestCase):
    def test_kabsch_ignores_rotation_and_translation(self):
        moved = PTS @ rot(1.1).T + [3, -2, 7]
        self.assertAlmostEqual(ob.kabsch_rmsd(moved, PTS), 0, places=10)
        np.testing.assert_allclose(ob.superpose(moved, PTS), PTS, atol=1e-10)

    def test_kabsch_no_reflection(self):
        mirror = PTS * [1, 1, -1]  # a mirror image cannot be rotated onto the original
        self.assertGreater(ob.kabsch_rmsd(mirror, PTS), 0.5)

    def test_kabsch_known_value(self):
        shifted = PTS.copy()
        shifted[0] += [0, 0, 1.0]  # one point moved: RMSD after fitting is below the unfitted sqrt(1/12)
        self.assertLess(ob.kabsch_rmsd(shifted, PTS), np.sqrt(1 / 12) + 1e-12)
        self.assertGreater(ob.kabsch_rmsd(shifted, PTS), 0)

    def test_radius_of_gyration(self):
        square = np.array([[1, 1, 0], [1, -1, 0], [-1, 1, 0], [-1, -1, 0]], float)
        self.assertAlmostEqual(ob.radius_of_gyration(square), np.sqrt(2))
        self.assertAlmostEqual(ob.radius_of_gyration(square @ rot(0.4).T + 9), np.sqrt(2))

    def test_rmsf(self):
        frames = [PTS @ rot(a).T for a in (0, 0.5, 1.0)]  # rigid copies: no fluctuation
        np.testing.assert_allclose(ob.rmsf(frames, PTS), 0, atol=1e-10)
        wobble = [PTS.copy() for _ in range(2)]
        wobble[0][3] += [0, 0, 1]
        wobble[1][3] -= [0, 0, 1]
        f = ob.rmsf(wobble, PTS)
        self.assertEqual(int(np.argmax(f)), 3)

    def test_pdb_lines(self):
        line = ob.pdb_atom_line(7, "CA", "GLY", "B", 12, (1.5, -2.25, 10.0), "C")
        self.assertEqual(len(line.rstrip("\n")), 78)
        self.assertEqual(line[12:16], " CA ")
        self.assertEqual((line[17:20], line[21], line[22:26]), ("GLY", "B", "  12"))
        self.assertEqual(float(line[30:38]), 1.5)
        models = ob.ca_models([("GLY", "A", 1), ("ALA", "A", 2)], [np.zeros((2, 3))] * 3, [1, 2, 3])
        self.assertEqual((models.count("MODEL "), models.count("ENDMDL"), models.count(" CA ")), (3, 3, 6))

    def test_check_request(self):
        ob.check_request("1L2Y", "", 20, 300)
        ob.check_request("6lu7", "AB", 1, 250)
        for args in (("1L2", "", 20, 300), ("0L2Y", "", 20, 300), ("1L2Y/../", "", 20, 300), (None, "", 20, 300),
                     ("1L2Y", "A;B", 20, 300), ("1L2Y", "", 0, 300), ("1L2Y", "", 101, 300), ("1L2Y", "", 20, 500)):
            with self.assertRaises(ob.ProteinError, msg=str(args)):
                ob.check_request(*args)

    def test_toy_run_shape(self):
        r = ob.toy_run("1VII", "", 5, 300, Budget(30))
        self.assertEqual(len(r["series"]), ob.FRAMES)
        self.assertEqual(r["trajectory_pdb"].count("MODEL "), ob.FRAMES)
        self.assertEqual(len(r["rmsf"]), r["residues"])


try:
    import openmm  # noqa: F401
    import pdbfixer  # noqa: F401
    HAVE = True
except ImportError:
    HAVE = False


@unittest.skipUnless(HAVE, "no openmm / pdbfixer")
class RealRun(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        with open(os.path.join(HERE, "fixtures", "1vii.pdb"), encoding="ascii") as f:
            cls.text = f.read()
        cls.r = ob.OpenMMBackend("CPU").run("1VII", "", 3, 300, Budget(600), text=cls.text)

    def test_structure(self):
        r = self.r
        self.assertEqual((r["residues"], r["chains"], r["sequence"]), (36, "A", "MLSDEDFKAVFGMTRSAFANLPLWKQQNLKKEKGLF"))
        self.assertEqual(r["atoms"], 596)  # NMR model with hydrogens, nothing to build
        self.assertEqual(r["platform"], "CPU")

    def test_dynamics(self):
        r = self.r
        self.assertLess(r["energy_minimised_kj"], r["energy_start_kj"])
        self.assertEqual(len(r["series"]), ob.FRAMES)
        self.assertAlmostEqual(r["series"][-1]["t_ps"], 3.0)
        self.assertTrue(200 < r["mean_temperature_k"] < 360, r["mean_temperature_k"])  # thermostat at 300 K, 3 ps
        self.assertLess(r["final_rmsd_a"], 3.0)  # a folded headpiece does not unfold in 3 ps
        self.assertTrue(8 < r["series"][-1]["rg_a"] < 11)
        self.assertEqual(len(r["rmsf"]), 36)
        ends = r["rmsf"][0]["a"] + r["rmsf"][-1]["a"]
        middle = sorted(x["a"] for x in r["rmsf"][10:26])[8]
        self.assertGreater(ends / 2, middle)  # the termini move more than the core

    def test_refusals(self):
        b = ob.OpenMMBackend("CPU")
        with self.assertRaises(ob.ProteinError):
            b.run("1VII", "B", 3, 300, Budget(60), text=self.text)
        with self.assertRaises(ob.ProteinError):
            b.run("1VII", "", 3, 300, Budget(60), text="HETATM    1  O   HOH A   1       0.000   0.000   0.000  1.00  0.00           O\nEND\n")


if __name__ == "__main__":
    unittest.main()
