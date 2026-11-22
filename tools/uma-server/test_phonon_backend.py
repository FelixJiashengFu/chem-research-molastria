"""phonon_backend.py on a real calculator: copper with ASE's EMT through phonopy, end to end on the CPU (about two
seconds), plus the symmetry, the readers and the limits. Skipped where phonopy, spglib or seekpath is not installed.

    python -X utf8 -m unittest tools/uma-server/test_phonon_backend.py -v
"""
import os
import sys
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import chemjobs as cj  # noqa: E402
import phonon_backend as pb  # noqa: E402

SKIP = not pb.versions()
R = 8.314462618


def emt(symbols):
    from ase.calculators.emt import EMT

    return EMT()


@unittest.skipIf(SKIP, "phonopy, spglib or seekpath is not installed")
class CopperEMT(unittest.TestCase):
    @classmethod
    def setUpClass(cls):
        cls.r = pb.run_phonon({"preset": "Cu", "supercell": [3, 3, 3], "relax": True, "mesh": 16, "t_max": 1000},
                              emt, cj.Budget(300), "test", pb.EMT_METALS)

    def test_symmetry_and_cell(self):
        s = self.r["symmetry"]
        self.assertEqual((s["international"], s["number"], s["point_group"], s["crystal_system"]), ("Fm-3m", 225, "m-3m", "cubic"))
        self.assertEqual((s["n_conventional"], s["n_primitive"], self.r["n_supercell"], self.r["n_displacements"]), (4, 1, 108, 1))
        self.assertEqual(s["wyckoffs"], ["Cu:a"])
        # EMT copper relaxes to a = 3.590 A (its own minimum; experiment 3.615), symmetry kept, stress gone
        self.assertAlmostEqual(self.r["lattice"]["a"], 3.590, places=2)
        self.assertEqual(self.r["lattice"]["alpha"], 90.0)
        self.assertTrue(self.r["relax"]["converged"])
        self.assertLess(self.r["relax"]["max_stress_gpa"], 0.05)
        self.assertLess(self.r["relax"]["energy_ev"], self.r["relax"]["energy_before_ev"])
        self.assertLess(self.r["max_residual_force_ev_a"], 1e-6)  # every atom sits on an inversion centre
        self.assertTrue(self.r["poscar"].splitlines()[5].split() == ["Cu"])

    def test_acoustic_modes_and_stability(self):
        self.assertEqual(len(self.r["gamma_thz"]), 3)
        for f in self.r["gamma_thz"]:
            self.assertLess(abs(f), 1e-3)  # three acoustic branches go to zero at Gamma
        self.assertFalse(self.r["imaginary"])
        self.assertEqual(self.r["n_imaginary_mesh"], 0)
        self.assertGreater(self.r["min_frequency_thz"], pb.IMAG_THZ)

    def test_band_path(self):
        b = self.r["band"]
        self.assertEqual(b["n_bands"], 3)
        self.assertEqual([t["label"] for t in b["ticks"]], ["Γ", "X", "U|K", "Γ", "L", "W", "X"])  # seekpath's fcc path
        self.assertEqual([t["break"] for t in b["ticks"]], [False, False, True, False, False, False, False])
        xs = [x for seg in b["segments"] for x in seg["distances"]]
        self.assertEqual(xs, sorted(xs))
        first = b["segments"][0]  # Gamma -> X
        self.assertEqual((first["from"], first["to"]), ("Γ", "X"))
        at_x = sorted(first["frequencies_thz"][-1])
        # EMT copper at X: two transverse modes 5.4 THz, the longitudinal 8.0 THz (experiment about 5.1 and 7.3)
        self.assertAlmostEqual(at_x[0], at_x[1], places=3)
        self.assertTrue(5.0 < at_x[0] < 6.0 and 7.5 < at_x[2] < 8.5, at_x)
        self.assertAlmostEqual(self.r["max_frequency_thz"], max(max(r) for s in b["segments"] for r in s["frequencies_thz"]), places=4)

    def test_dos_and_thermal(self):
        d, t = self.r["dos"], self.r["thermal"]
        f, g = np.array(d["frequency_thz"]), np.array(d["dos"])
        # the total DOS integrates to 3 modes per primitive cell
        self.assertAlmostEqual(float(np.trapezoid(g, f)), 3.0, delta=0.05)
        self.assertEqual(t["atoms_per_cell"], 1)
        self.assertEqual(t["temperature_k"][0], 0.0)
        self.assertEqual(t["temperature_k"][-1], 1000.0)
        cv = t["heat_capacity_j_k_mol"]
        self.assertAlmostEqual(t["dulong_petit_j_k_mol"], 3 * R, places=2)
        self.assertAlmostEqual(cv[-1] / (3 * R), 1.0, delta=0.01)  # Dulong-Petit at 1000 K
        self.assertEqual(cv, sorted(cv))  # Cv rises monotonically
        self.assertEqual(cv[0], 0.0)
        self.assertGreater(t["zero_point_kj_mol"], 0.0)  # F(0) is the zero-point energy
        s = t["entropy_j_k_mol"]
        self.assertEqual(s, sorted(s))
        # copper's standard entropy is 33.2 J/(K mol) at 298 K; EMT's slightly stiffer lattice gives a little less
        s300 = s[t["temperature_k"].index(300.0)]
        self.assertTrue(28 < s300 < 34, s300)


@unittest.skipIf(SKIP, "phonopy, spglib or seekpath is not installed")
class Structures(unittest.TestCase):
    def test_presets(self):
        want = {"Cu": ("Fm-3m", 4, 1), "Al": ("Fm-3m", 4, 1), "Si": ("Fd-3m", 8, 1), "C": ("Fd-3m", 8, 1),
                "NaCl": ("Fm-3m", 8, 2), "MgO": ("Fm-3m", 8, 2)}
        for name, (sg, n, disp) in want.items():
            p = pb.prepare({"preset": name, "supercell": [2, 2, 2]})
            self.assertEqual((p["symmetry"]["international"], len(p["atoms"]), p["n_displacements"]), (sg, n, disp), name)
            self.assertEqual(p["n_supercell"], 8 * n)
        self.assertEqual(set(pb.PRESETS) - set(want), {"Ag", "Au", "Ni", "Pd", "Pt"})

    def test_cif_with_symmetry_operations(self):
        # rock salt given only by its two sites and the space group: ASE expands it to the 8-atom conventional cell
        cif = ("data_NaCl\n_cell_length_a 5.64\n_cell_length_b 5.64\n_cell_length_c 5.64\n_cell_angle_alpha 90\n"
               "_cell_angle_beta 90\n_cell_angle_gamma 90\n_symmetry_space_group_name_H-M 'F m -3 m'\n_symmetry_Int_Tables_number 225\n"
               "loop_\n_atom_site_label\n_atom_site_type_symbol\n_atom_site_fract_x\n_atom_site_fract_y\n_atom_site_fract_z\n"
               "Na1 Na 0 0 0\nCl1 Cl 0.5 0.5 0.5\n")
        p = pb.prepare({"structure": cif, "format": "cif", "supercell": [2, 2, 2]})
        self.assertEqual((p["symmetry"]["number"], len(p["atoms"]), p["formula"]), (225, 8, "ClNa"))
        self.assertEqual(p["symmetry"]["wyckoffs"], ["Cl:b", "Na:a"])

    def test_poscar_primitive_and_noise(self):
        # a primitive Si cell with 0.0005 A of noise: spglib (symprec 1e-3) still finds Fd-3m and idealises it
        poscar = ("Si\n1.0\n0 2.7155 2.7155\n2.7155 0 2.7155\n2.7155 2.7155 0\nSi\n2\nCartesian\n"
                  "0 0 0.0005\n1.35775 1.35775 1.35775\n")
        p = pb.prepare({"structure": poscar, "format": "poscar", "supercell": [1, 1, 1]})
        self.assertEqual((p["symmetry"]["international"], p["symmetry"]["n_input"], len(p["atoms"])), ("Fd-3m", 2, 8))
        self.assertAlmostEqual(p["atoms"].cell.cellpar()[0], 5.431, places=3)

    def test_limits(self):
        with self.assertRaisesRegex(pb.PhononError, "at most 216"):
            pb.prepare({"preset": "Si", "supercell": [3, 3, 4]})  # 8 x 36 = 288 atoms
        self.assertEqual(pb.prepare({"preset": "Si", "supercell": [3, 3, 3]})["n_supercell"], 216)
        with self.assertRaisesRegex(pb.PhononError, "does not take Si"):
            pb.prepare({"preset": "Si"}, pb.EMT_METALS)
        with self.assertRaisesRegex(pb.PhononError, "three whole numbers"):
            pb.prepare({"preset": "Cu", "supercell": [0, 1, 1]})
        with self.assertRaisesRegex(pb.PhononError, "three-dimensional cell"):
            pb.read_structure("flat\n1.0\n3 0 0\n0 3 0\n0 0 0\nCu\n1\nDirect\n0 0 0\n", "poscar")
        with self.assertRaisesRegex(pb.PhononError, "longer than"):
            pb.read_structure("x" * (pb.MAX_TEXT + 1), "poscar")

    def test_labels(self):
        self.assertEqual([pb._label(x) for x in ("$\\Gamma$", "$\\mathrm{X}$", "$\\mathrm{X_1}$", "GAMMA")], ["Γ", "X", "X₁", "Γ"])


if __name__ == "__main__":
    unittest.main()
