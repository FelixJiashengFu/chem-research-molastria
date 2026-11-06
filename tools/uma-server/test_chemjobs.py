"""Tests of chemjobs.py with toy ASE calculators whose answers are known. No model is loaded.

    D:\\ChemDraw\\uma-env\\Scripts\\python.exe -X utf8 -m unittest discover -s tools/uma-server -p "test_*.py" -v
"""
import math
import os
import sys
import unittest

import numpy as np

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import chemjobs as cj  # noqa: E402

# SI constants for the analytic answers, independent of ASE's unit module.
E_CHARGE, AMU, C_CM = 1.602176634e-19, 1.66053906660e-27, 2.99792458e10


def wavenumber(lam):
    """Eigenvalue of a mass-weighted Hessian in eV/(A^2 amu) -> cm^-1."""
    return math.sqrt(lam * E_CHARGE / 1e-20 / AMU) / (2 * math.pi * C_CM)


def springs(pairs, offset=None):
    """Harmonic springs [(i, j, k eV/A^2, r0 A)]; offset(q, s) -> extra energy."""
    def ef(symbols, positions, q, s):
        p = np.asarray(positions, float)
        e, f = 0.0, np.zeros_like(p)
        for i, j, k, r0 in pairs:
            d = p[i] - p[j]
            r = np.linalg.norm(d)
            e += 0.5 * k * (r - r0) ** 2
            g = k * (r - r0) * d / r
            f[i] -= g
            f[j] += g
        return e + (offset(q, s) if offset else 0.0), f
    return ef


def analytic_wavenumbers(positions, masses, pairs):
    """Exact Hessian of the springs at their minimum, mass-weighted; the non-zero modes in cm^-1, ascending."""
    n = len(positions)
    h = np.zeros((3 * n, 3 * n))
    for i, j, k, _ in pairs:
        u = positions[i] - positions[j]
        block = k * np.outer(u, u) / (u @ u)
        for a, b, sgn in ((i, i, 1), (j, j, 1), (i, j, -1), (j, i, -1)):
            h[3 * a:3 * a + 3, 3 * b:3 * b + 3] += sgn * block
    m = np.sqrt(np.repeat(masses, 3))
    lam = np.linalg.eigvalsh(h / np.outer(m, m))
    return sorted(wavenumber(x) for x in lam if x > 1e-6)


def by_composition(symbols, positions, q, s):
    """Energy from the composition, charge and spin only (no forces): -1 per H, -0.5 per atom, +0.3 per charge,
    +0.7 per unpaired electron."""
    return -1.0 * symbols.count("H") - 0.5 * len(symbols) + 0.3 * q + 0.7 * (s - 1), np.zeros((len(symbols), 3))


def structure(symbols, positions, q=0, s=1, mol=None):
    return cj.Structure(symbols, positions, q, s, "test", mol)


def from_smiles(smiles):
    Chem = cj._rdkit()
    mol_h = Chem.AddHs(Chem.MolFromSmiles(smiles))
    symbols, pos = cj.embed(Chem.Mol(mol_h))
    return structure(symbols, pos, *cj.species_of(mol_h), mol=mol_h)


BUDGET = cj.Budget()


class Frequencies(unittest.TestCase):
    def test_diatomic(self):
        pairs = [(0, 1, 40.0, 1.128)]
        st = structure(["C", "O"], [[0, 0, 0], [0, 0, 1.15]])
        r = cj.run_freq(st, cj.EFCalculator(springs(pairs)), BUDGET, "CO")
        masses = cj.Atoms(["C", "O"]).get_masses()
        mu = masses[0] * masses[1] / masses.sum()
        expected = wavenumber(40.0 / mu)
        self.assertEqual(len(r["frequencies_cm1"]), 1)
        self.assertAlmostEqual(r["frequencies_cm1"][0], expected, delta=0.5)
        self.assertTrue(r["linear"])
        self.assertEqual(r["n_imag"], 0)
        hc_cm = 6.62607015e-34 * C_CM / E_CHARGE  # eV per cm^-1
        self.assertAlmostEqual(r["zpe_ev"], 0.5 * expected * hc_cm, places=4)

    def test_bent_triatomic(self):
        ang = math.radians(104.5)
        pos = np.array([[0, 0, 0], [0.96, 0, 0], [0.96 * math.cos(ang), 0.96 * math.sin(ang), 0]])
        hh = float(np.linalg.norm(pos[1] - pos[2]))
        pairs = [(0, 1, 50.0, 0.96), (0, 2, 50.0, 0.96), (1, 2, 5.0, hh)]
        st = structure(["O", "H", "H"], pos)
        r = cj.run_freq(st, cj.EFCalculator(springs(pairs)), BUDGET, "water")
        exact = analytic_wavenumbers(pos, cj.Atoms(["O", "H", "H"]).get_masses(), pairs)
        self.assertFalse(r["linear"])
        self.assertEqual(len(r["frequencies_cm1"]), 3)
        for got, want in zip(sorted(r["frequencies_cm1"]), exact):
            self.assertAlmostEqual(got, want, delta=0.5)

    def test_linear_triatomic(self):
        pairs = [(0, 1, 60.0, 1.16), (0, 2, 60.0, 1.16)]
        st = structure(["C", "O", "O"], [[0, 0, 0], [0, 0, 1.16], [0, 0, -1.16]])
        r = cj.run_freq(st, cj.EFCalculator(springs(pairs)), BUDGET, "CO2")
        m = cj.Atoms(["C", "O"]).get_masses()
        sym = wavenumber(60.0 / m[1])
        asym = wavenumber(60.0 * (1 + 2 * m[1] / m[0]) / m[1])
        self.assertTrue(r["linear"])
        self.assertEqual(len(r["frequencies_cm1"]), 4)  # 3N - 5; the two bends have no restoring force here
        top = sorted(r["frequencies_cm1"])[-2:]
        self.assertAlmostEqual(top[0], sym, delta=0.5)
        self.assertAlmostEqual(top[1], asym, delta=0.5)

    def test_imaginary_mode_is_negative(self):
        # a spring pushing the atoms apart around a maximum: the only mode is imaginary
        def ef(symbols, positions, q, s):
            p = np.asarray(positions)
            d = p[0] - p[1]
            r = np.linalg.norm(d)
            g = -10.0 * (r - 1.0) * d / r
            return -5.0 * (r - 1.0) ** 2, np.array([-g, g])
        atoms = cj.new_atoms(["H", "H"], [[0, 0, 0], [0, 0, 1.0]], 0, 1, cj.EFCalculator(ef))
        vib = cj.vibrations(atoms, BUDGET)
        self.assertLess(vib["cm1"][0], 0)


class Thermo(unittest.TestCase):
    def test_against_ase(self):
        from ase.thermochemistry import IdealGasThermo

        ang = math.radians(104.5)
        pos = np.array([[0, 0, 0], [0.96, 0, 0], [0.96 * math.cos(ang), 0.96 * math.sin(ang), 0]])
        hh = float(np.linalg.norm(pos[1] - pos[2]))
        pairs = [(0, 1, 50.0, 0.96), (0, 2, 50.0, 0.96), (1, 2, 5.0, hh)]
        r = cj.run_freq(structure(["O", "H", "H"], pos), cj.EFCalculator(springs(pairs)), BUDGET, "w", 400.0, 2)
        hc_cm = 6.62607015e-34 * C_CM / E_CHARGE
        exact = [x * hc_cm for x in analytic_wavenumbers(pos, cj.Atoms(["O", "H", "H"]).get_masses(), pairs)]
        ref = IdealGasThermo(exact, "nonlinear", potentialenergy=0.0, atoms=cj.Atoms(["O", "H", "H"], positions=pos),
                             symmetrynumber=2, spin=0, vib_selection="all")
        t = r["thermo"]
        self.assertEqual(t["temperature_k"], 400.0)
        self.assertAlmostEqual(t["h_corr_ev"], ref.get_enthalpy(400.0, verbose=False), places=4)
        self.assertAlmostEqual(t["s_ev_k"], ref.get_entropy(400.0, 101325.0, verbose=False), places=7)
        self.assertAlmostEqual(t["g_corr_ev"], ref.get_gibbs_energy(400.0, 101325.0, verbose=False), places=4)
        self.assertAlmostEqual(t["g_ev"], t["h_ev"] - 400.0 * t["s_ev_k"], places=5)
        self.assertAlmostEqual(t["h_ev"] - r["energy_ev"], t["h_corr_ev"], places=5)

    def test_monatomic(self):
        r = cj.run_freq(structure(["Ar"], [[0, 0, 0]]), cj.EFCalculator(springs([])), BUDGET, "Ar")
        self.assertEqual(r["frequencies_cm1"], [])
        self.assertFalse(r["linear"])
        self.assertEqual(r["zpe_ev"], 0.0)
        self.assertAlmostEqual(r["thermo"]["h_corr_ev"], 2.5 * cj.units.kB * 298.15, places=6)  # translation + pV


class InfraredRaman(unittest.TestCase):
    def setUp(self):
        self.pairs = [(0, 1, 30.0, 1.27)]
        self.st = structure(["H", "Cl"], [[0, 0, 0], [0, 0, 1.27]])
        m = cj.Atoms(["H", "Cl"]).get_masses()
        self.mu = m[0] * m[1] / m.sum()

    def run_with(self, polar):
        def dp(symbols, positions):  # charges +0.2 / -0.2 e: d mu / d r = 0.2 e along the bond
            p = np.asarray(positions)
            r = np.linalg.norm(p[1] - p[0])
            return 0.2 * p[0] - 0.2 * p[1], polar(r, (p[1] - p[0]) / r)
        return cj.run_ir(self.st, cj.EFCalculator(springs(self.pairs)), dp, BUDGET)

    def test_conversion_factor(self):
        self.assertAlmostEqual(cj.IR_KM_MOL, 974.88, delta=0.05)

    def test_isotropic(self):
        r = self.run_with(lambda r, n: 2.0 * np.eye(3) + 0.8 * (r - 1.27) * np.eye(3))
        self.assertEqual(r["geometry_model"], "mace-off23-medium")
        self.assertAlmostEqual(r["frequencies_cm1"][0], wavenumber(30.0 / self.mu), delta=0.5)
        self.assertAlmostEqual(r["ir_intensity_km_mol"][0], cj.IR_KM_MOL * 0.2 ** 2 / self.mu, delta=0.01)
        self.assertAlmostEqual(r["raman_activity_a4_amu"][0], 45 * 0.8 ** 2 / self.mu, delta=0.01)

    def test_anisotropic(self):
        r = self.run_with(lambda r, n: 2.0 * np.eye(3) + 0.8 * (r - 1.27) * np.outer(n, n))
        # a' = beta / 3, gamma'^2 = beta^2 per unit bond stretch: S = 45 beta^2/9 + 7 beta^2 = 12 beta^2 (/ mu)
        self.assertAlmostEqual(r["raman_activity_a4_amu"][0], 12 * 0.8 ** 2 / self.mu, delta=0.01)


class Scan(unittest.TestCase):
    def test_dihedral_held(self):
        # four carbons tied by springs (all pairs) to a reference with a 60 degree dihedral: the 1-4 spring pulls
        # the dihedral back, so only the constraint keeps it at each scan angle.
        ref = cj.Atoms("C4", positions=[[0, 0, 0], [1.5, 0, 0], [2.0, 1.4, 0], [3.5, 1.4, 0]])
        ref.set_dihedral(0, 1, 2, 3, 60.0, indices=[3])
        p = ref.get_positions()
        pairs = [(i, j, 20.0, float(np.linalg.norm(p[i] - p[j]))) for i in range(4) for j in range(i + 1, 4)]
        st = structure(["C"] * 4, p)
        r = cj.run_scan(st, cj.EFCalculator(springs(pairs)), BUDGET, "chain", [0, 1, 2, 3], -120, 120, 3)
        self.assertEqual([x["angle_deg"] for x in r["points"]], [-120.0, 0.0, 120.0])
        frames = r["xyz"].strip().split("\n4\n")
        self.assertEqual(len(frames), 3)
        for point, frame in zip(r["points"], frames):
            lines = frame.strip().splitlines()[-4:]
            pos = [[float(v) for v in line.split()[1:]] for line in lines]
            got = cj.Atoms("C4", positions=pos).get_dihedral(0, 1, 2, 3)
            diff = (got - point["angle_deg"] + 180) % 360 - 180
            self.assertLess(abs(diff), 0.5, f"dihedral {got} for target {point['angle_deg']}")
            self.assertTrue(point["converged"])
        self.assertEqual(min(x["rel_kcal"] for x in r["points"]), 0.0)
        self.assertGreater(max(x["rel_kcal"] for x in r["points"]), 1.0)  # the springs resisted

    def test_ring_rotates_only_the_last_atom(self):
        st = from_smiles("C1CCCCC1")
        self.assertEqual(cj.rotating_side(st.symbols, st.positions, 1, 2, 3), [3])
        st = from_smiles("CCCC")
        side = cj.rotating_side(st.symbols, st.positions, 1, 2, 3)
        self.assertIn(3, side)
        self.assertNotIn(1, side)
        self.assertNotIn(0, side)


class Conformers(unittest.TestCase):
    def test_dedup(self):
        rng = np.random.default_rng(1)
        a = rng.normal(size=(6, 3)) * 1.5
        rot = cj.Atoms("C6", positions=a)
        rot.rotate(70, "z")
        rot.rotate(25, "x")
        copy = rot.get_positions() + [3.0, -1.0, 2.0]
        far = a + rng.normal(size=(6, 3))
        mirror = a * [-1, 1, 1]
        kcal = 1 / cj.EV_TO_KCAL
        found = [(0.0, a), (0.01 * kcal, copy), (0.05 * kcal, far), (5 * kcal, a.copy()), (0.0, mirror)]
        kept = cj.unique_conformers(found, ["C"] * 6)
        self.assertEqual(len(kept), 4)  # the rotated, shifted copy is a duplicate; the mirror image is not
        self.assertEqual([round(k[0] / kcal, 2) for k in kept], [0.0, 0.0, 0.05, 5.0])

    def test_boltzmann(self):
        w = cj.boltzmann([0.0, 0.05, 0.2], 300.0)
        self.assertAlmostEqual(float(w.sum()), 1.0, places=12)
        self.assertAlmostEqual(float(w[1] / w[0]), math.exp(-0.05 / (cj.units.kB * 300.0)), places=10)

    def test_conf_job(self):
        st = from_smiles("CCCC")
        r = cj.run_conf(st, cj.EFCalculator(cj.toy_ef), BUDGET, "butane", 4, 298.15, 10)
        self.assertGreaterEqual(r["n_generated"], 1)
        self.assertEqual(len(r["conformers"]), r["xyz"].count("conformer"))
        self.assertAlmostEqual(sum(c["weight"] for c in r["conformers"]), 1.0, places=3)
        self.assertEqual(r["conformers"][0]["rel_kcal"], 0.0)


class Reactions(unittest.TestCase):
    def test_conservation(self):
        species, canonical = cj.parse_reaction("C=C.O>>CCO")
        self.assertEqual(canonical, "C=C.O>>CCO")
        self.assertEqual([(s["smiles"], s["side"], s["count"]) for s in species],
                         [("C=C", "reactant", 1), ("O", "reactant", 1), ("CCO", "product", 1)])
        species, _ = cj.parse_reaction("[H][H].[H][H].O=O>>O.O")
        self.assertEqual([(s["smiles"], s["count"]) for s in species], [("[H][H]", 2), ("O=O", 1), ("O", 2)])
        cj.parse_reaction("[NH4+]>>N.[H+]")
        with self.assertRaisesRegex(ValueError, "charge"):
            cj.parse_reaction("[NH4+]>>N.[H]")
        for bad in ("C=C>>CCO", "[NH4+]>>N", "CC", "C>>", ">>C", "C..C>>CC", "C>>C>>C", "C.C.C.C>>C.C.C", "Q>>Q", ""):
            with self.assertRaises(ValueError, msg=bad):
                cj.parse_reaction(bad)

    def test_reaction_energy(self):
        species, _ = cj.parse_reaction("[CH3].[CH3]>>CC")
        r = cj.run_rxn(species, cj.EFCalculator(by_composition), BUDGET)
        # 2 x (-3 - 2 + 0.7) for the methyl radicals, -6 - 4 for ethane
        self.assertAlmostEqual(r["delta_e_ev"], -1.4, places=6)
        self.assertEqual(r["species"][0]["count"], 2)
        self.assertEqual(r["species"][0]["spin"], 2)
        r = cj.run_rxn(species, cj.EFCalculator(by_composition), BUDGET, thermo=True)
        self.assertIn("delta_g_ev", r)
        self.assertIn("g_ev", r["species"][0])


class BondDissociation(unittest.TestCase):
    def frags(self, smiles, i, j):
        st = from_smiles(smiles)
        return st, cj.bde_fragments(st.mol, i, j)

    def test_fragments(self):
        _, f = self.frags("CC", 0, 1)
        self.assertEqual([(x["smiles"], x["spin"], x["charge"]) for x in f], [("[CH3]", 2, 0), ("[CH3]", 2, 0)])
        _, f = self.frags("C", 0, 1)  # a C-H bond
        self.assertEqual(sorted((x["smiles"], x["spin"]) for x in f), [("[CH3]", 2), ("[H]", 2)])
        _, f = self.frags("CO", 0, 1)
        self.assertEqual(sorted(x["smiles"] for x in f), ["[CH3]", "[OH]"])
        self.assertEqual(sorted(len(x["atoms"]) for x in f), [2, 4])
        for smiles, i, j in (("C1CCCCC1", 0, 1), ("C=C", 0, 1), ("CCC", 0, 2), ("CC", 0, 0), ("CC", 0, 99)):
            with self.assertRaises(ValueError, msg=smiles):
                self.frags(smiles, i, j)

    def test_bde(self):
        st, f = self.frags("CC", 0, 1)
        r = cj.run_bde(st, f, cj.EFCalculator(by_composition), BUDGET, "ethane", [0, 1])
        self.assertAlmostEqual(r["bde_ev"], 1.4, places=6)  # two unpaired electrons appear
        self.assertAlmostEqual(r["bde_kcal"], round(1.4 * cj.EV_TO_KCAL, 2))
        st, f = self.frags("C", 0, 1)
        r = cj.run_bde(st, f, cj.EFCalculator(by_composition), BUDGET, "methane", [0, 1], thermo=True)
        self.assertIn("bdh298_kcal", r)


class ProtonAffinity(unittest.TestCase):
    def test_sites(self):
        st = from_smiles("N")
        p = cj.pa_partner(st.mol, 0, "protonate")
        self.assertEqual((p["smiles"], p["delta"], p["drop"]), ("[NH4+]", 1, None))
        st = from_smiles("CC(=O)O")
        p = cj.pa_partner(st.mol, 3, "deprotonate")
        self.assertEqual((p["smiles"], p["delta"]), ("CC(=O)[O-]", -1))
        self.assertEqual(st.symbols[p["drop"]], "H")
        self.assertTrue(st.mol.GetBondBetweenAtoms(3, p["drop"]))
        p = cj.pa_partner(from_smiles("c1ccncc1").mol, 3, "protonate")
        self.assertEqual(p["smiles"], "c1cc[nH+]cc1")
        for smiles, site, mode in (("CC(=O)O", 2, "deprotonate"), ("C", 0, "protonate"), ("N", 1, "protonate"),
                                   ("N", 5, "protonate")):
            with self.assertRaises(ValueError, msg=smiles):
                cj.pa_partner(from_smiles(smiles).mol, site, mode)

    def test_values(self):
        calc = cj.EFCalculator(by_composition)
        st = from_smiles("N")
        r = cj.run_pa(st, cj.pa_partner(st.mol, 0, "protonate"), calc, BUDGET, "NH3", 0)
        # B = NH3: -3 - 2 = -5; BH+ = NH4+: -4 - 2.5 + 0.3 = -6.2; PA = E(B) - E(BH+) = 1.2
        self.assertEqual(r["energies"], {"base_ev": -5.0, "acid_ev": -6.2})
        self.assertAlmostEqual(r["value_ev"], 1.2, places=6)
        st = from_smiles("CC(=O)O")
        r = cj.run_pa(st, cj.pa_partner(st.mol, 3, "deprotonate"), calc, BUDGET, "AcOH", 3, "deprotonate", thermo=True)
        # AH: -4 - 4 = -8; A-: -3 - 3.5 - 0.3 = -6.8; E(A-) - E(AH) = 1.2
        self.assertEqual(r["energies"], {"base_ev": -6.8, "acid_ev": -8.0})
        self.assertAlmostEqual(r["value_ev"], 1.2, places=6)
        self.assertIn("enthalpy_kcal", r)


class ChargeStates(unittest.TestCase):
    R0, C = {0: 0.74, 1: 1.06, -1: 0.90}, {0: 0.0, 1: 15.0, -1: -0.5}

    def ef(self, symbols, positions, q, s):
        return springs([(0, 1, 30.0, self.R0[q])], lambda q_, s_: self.C[q_])(symbols, positions, q, s)

    def test_vertical_and_adiabatic(self):
        st = structure(["H", "H"], [[0, 0, 0], [0, 0, 0.8]])
        r = cj.run_ipea(st, cj.EFCalculator(self.ef), BUDGET, "H2", "both")
        self.assertAlmostEqual(r["ip_ev"], 15.0, places=3)
        self.assertAlmostEqual(r["ip_vertical_ev"], 15.0 + 0.5 * 30 * (0.74 - 1.06) ** 2, places=3)
        self.assertAlmostEqual(r["ea_ev"], 0.5, places=3)
        self.assertAlmostEqual(r["ea_vertical_ev"], 0.5 - 0.5 * 30 * (0.74 - 0.90) ** 2, places=3)
        self.assertGreaterEqual(r["ip_vertical_ev"], r["ip_ev"])
        self.assertLessEqual(r["ea_vertical_ev"], r["ea_ev"])
        only = cj.run_ipea(st, cj.EFCalculator(self.ef), BUDGET, "H2", "vertical")
        self.assertNotIn("ip_ev", only)
        self.assertEqual(only["ip_vertical_ev"], r["ip_vertical_ev"])

    def test_spin_gap(self):
        r0, c = {1: 0.74, 3: 1.0}, {1: 0.0, 3: 2.0}

        def ef(symbols, positions, q, s):
            return springs([(0, 1, 30.0, r0[s])], lambda q_, s_: c[s_])(symbols, positions, q, s)

        r = cj.run_spin(structure(["H", "H"], [[0, 0, 0], [0, 0, 0.8]]), cj.EFCalculator(ef), BUDGET, "H2", [1, 3])
        self.assertAlmostEqual(r["gap_ev"], 2.0, places=3)
        self.assertAlmostEqual(r["vertical_gap_ev"], 2.0 + 0.5 * 30 * 0.26 ** 2, places=3)
        self.assertEqual([s["spin"] for s in r["states"]], [1, 3])

    def test_calculator_sees_charge(self):
        calc = cj.EFCalculator(self.ef)
        atoms = cj.new_atoms(["H", "H"], [[0, 0, 0], [0, 0, 0.74]], 0, 1, calc)
        self.assertAlmostEqual(atoms.get_potential_energy(), 0.0)
        atoms.info["charge"] = 1  # same positions, other charge: must not come from the cache
        self.assertAlmostEqual(atoms.get_potential_energy(), 15.0 + 0.5 * 30 * 0.32 ** 2)

    def test_spin_fits(self):
        self.assertTrue(cj.spin_fits(["O", "H", "H"], 0, 1))
        self.assertTrue(cj.spin_fits(["O", "H", "H"], 0, 3))
        self.assertFalse(cj.spin_fits(["O", "H", "H"], 0, 2))
        self.assertTrue(cj.spin_fits(["O", "H", "H"], 1, 2))
        self.assertFalse(cj.spin_fits(["H"], 1, 2))  # a bare proton has no electron to be unpaired


class Dynamics(unittest.TestCase):
    def test_md(self):
        st = structure(["H", "H"], [[0, 0, 0], [0, 0, 0.74]])
        calc = cj.EFCalculator(springs([(0, 1, 30.0, 0.74)]))
        r = cj.run_md(st, calc, BUDGET, "H2", 300.0, 0.5, 1000, 0.01)
        self.assertEqual(len(r["series"]), 200)
        self.assertEqual(r["xyz"].count("t = "), 100)
        self.assertEqual(r["series"][-1]["t_fs"], 500.0)
        self.assertGreater(r["mean_temperature_k"], 0)
        again = cj.run_md(st, calc, BUDGET, "H2", 300.0, 0.5, 1000, 0.01)
        self.assertEqual(r["series"], again["series"])  # seeded
        short = cj.run_md(st, calc, BUDGET, "H2", 300.0, 0.5, 150, 0.01)
        self.assertEqual(len(short["series"]), 150)
        self.assertEqual(short["xyz"].count("t = "), 75)


class Limits(unittest.TestCase):
    def test_timeout(self):
        budget = cj.Budget(limit=1e-9)
        st = structure(["H", "H"], [[0, 0, 0], [0, 0, 1.2]])
        with self.assertRaises(cj.JobTimeout) as ctx:
            cj.run_opt(st, cj.EFCalculator(springs([(0, 1, 30.0, 0.74)])), budget, "H2")
        self.assertIn("time limit", str(ctx.exception))

    def test_progress(self):
        seen = []
        budget = cj.Budget(limit=60, report=seen.append)
        cj.run_freq(structure(["H", "H"], [[0, 0, 0], [0, 0, 0.74]]), cj.EFCalculator(springs([(0, 1, 30.0, 0.74)])),
                    budget, "H2")
        self.assertEqual(seen[-1], {"done": 6, "total": 6, "note": "displaced structures"})


class Xyz(unittest.TestCase):
    def test_good(self):
        symbols, pos = cj.parse_xyz("  3 \r\n water, with spaces \r\n O\t0 0 0\n  h  0.96 0.0 0.0  \nH -0.24 0.93 0\n\n\n")
        self.assertEqual(symbols, ["O", "H", "H"])
        self.assertEqual(pos.shape, (3, 3))
        symbols, _ = cj.parse_xyz("1\n\nAr 0 0 0")
        self.assertEqual(symbols, ["Ar"])
        cj.parse_xyz("2\nscientific\nCl 1e-1 0 0\nCL -1.9E0 0 0")
        many = "120\n\n" + "".join(f"H {i % 10 * 1.0} {i // 10 % 10 * 1.0} {i // 100 * 1.0}\n" for i in range(120))
        self.assertEqual(len(cj.parse_xyz(many)[0]), 120)

    def test_bad(self):
        cases = {
            "not text": 5, "empty": "  \n ", "no count": "H 0 0 0\n", "zero atoms": "0\n\n",
            "too many atoms": "121\n\n" + "H 0 0 0\n" * 121, "missing comment line": "1\nH 0 0 0",
            "too few lines": "2\n\nH 0 0 0\n", "extra atom line": "1\n\nH 0 0 0\nH 0 0 1\n",
            "unknown element": "1\n\nXx 0 0 0", "number as element": "1\n\n1 0 0 0",
            "letters as coordinate": "1\n\nH 0 a 0", "nan": "1\n\nH nan 0 0", "inf": "1\n\nH inf 0 0",
            "far away": "1\n\nH 100.5 0 0", "five columns": "1\n\nH 0 0 0 0", "three columns": "1\n\nH 0 0",
            "too close": "2\n\nH 0 0 0\nH 0 0 0.5", "too long": "1\n" + "x" * 12000 + "\nH 0 0 0",
        }
        for name, text in cases.items():
            with self.assertRaises(ValueError, msg=name):
                cj.parse_xyz(text)


if __name__ == "__main__":
    unittest.main()
