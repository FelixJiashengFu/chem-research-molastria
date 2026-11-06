"""The calculations of the MolAstria online models, each written once against an ASE calculator.

server.py turns every model into one ASE calculator (fairchem, TorchANI, or a proxy to the MACE process) and calls
the run_* functions below; test_chemjobs.py calls them with toy calculators whose answers are known. Nothing here
loads a model. Units: energy eV (names ending in _kcal: kcal/mol), length Angstrom, frequencies cm^-1 (imaginary
ones negative), dipoles e*Angstrom inside, debye in results.
"""
import io
import math
import time
from collections import Counter

import numpy as np
from ase import Atoms, units
from ase.calculators.calculator import Calculator, all_changes
from ase.data import atomic_numbers, chemical_symbols, covalent_radii
from ase.optimize import LBFGS

EV_TO_KCAL = 23.060548  # kcal/mol per eV
E_A_TO_DEBYE = 4.803204  # 1 e*Angstrom in debye
POL_TO_A3 = 14.399645  # 1 e*Angstrom^2/V as a polarizability volume, in Angstrom^3 (e^2 / 4 pi eps0 in eV*Angstrom)
# IR intensity A = N_A pi / (3 c^2) * (1 / 4 pi eps0) * |d mu / dQ|^2. With d mu / dQ in e / sqrt(amu) this is
# 974.88 km/mol per (e^2 / amu): 42.2561 km/mol per (D/Angstrom)^2/amu (the factor ASE's Infrared uses) times 4.803204^2.
IR_KM_MOL = 42.2561 * E_A_TO_DEBYE ** 2
# Vibrational energy hbar * omega in eV from an eigenvalue of the mass-weighted Hessian in eV / (Angstrom^2 amu).
HBAR_OMEGA = units._hbar * 1e10 / math.sqrt(units._e * units._amu)
MAX_STEPS = 400  # optimiser steps per structure
OPT_FMAX = 0.02  # eV/Angstrom, as before
FREQ_FMAX = 0.005  # tighter optimisation before a Hessian
HESSIAN_DELTA = 0.01  # Angstrom, central differences
MAX_XYZ_ATOMS, MAX_XYZ_CHARS, MAX_COORD, MIN_DISTANCE = 120, 12000, 100.0, 0.5
MAX_SPECIES = 6
_SYMBOLS = {s.lower(): s for s in chemical_symbols[1:]}


class JobTimeout(Exception):
    pass


class Budget:
    """Time limit and progress of one job. The loops call check() between force evaluations and optimiser or MD steps,
    so a long job stops itself (cooperatively) once its limit has passed."""

    def __init__(self, limit=0.0, report=None):
        self.limit, self.report, self.start = limit, report, time.time()

    def check(self):
        if self.limit and time.time() - self.start > self.limit:
            raise JobTimeout(f"the job took longer than its time limit of {self.limit:g} s")

    def progress(self, done, total, note=""):
        self.check()
        if self.report:
            self.report({"done": int(done), "total": int(total), "note": note})


class EFCalculator(Calculator):
    """An ASE calculator around ef(symbols, positions, charge, spin) -> (energy eV, forces eV/Angstrom). Charge and
    spin multiplicity are read from atoms.info, and a change in them counts as a new system (ASE's own cache only
    compares positions and numbers, which would hand a cation the neutral's energy)."""

    implemented_properties = ["energy", "free_energy", "forces"]

    def __init__(self, ef):
        super().__init__()
        self.ef = ef

    def check_state(self, atoms, tol=1e-15):
        changes = super().check_state(atoms, tol)
        if self.atoms is not None and _qs(self.atoms) != _qs(atoms):
            changes.append("info")
        return changes

    def calculate(self, atoms=None, properties=("energy",), system_changes=all_changes):
        super().calculate(atoms, properties, system_changes)
        q, s = _qs(self.atoms)
        e, f = self.ef(self.atoms.get_chemical_symbols(), self.atoms.get_positions(), q, s)
        self.results = {"energy": float(e), "free_energy": float(e), "forces": np.asarray(f, float).reshape(-1, 3)}


def _qs(atoms):
    return int(atoms.info.get("charge", 0)), int(atoms.info.get("spin", 1))


class Structure:
    """One input molecule: symbols, positions, charge, spin multiplicity, a title for XYZ comments and, for SMILES
    input, the RDKit molecule with explicit hydrogens (atom order = positions)."""

    def __init__(self, symbols, positions, charge=0, spin=1, title="", mol=None):
        self.symbols, self.positions = list(symbols), np.asarray(positions, float).reshape(-1, 3)
        self.charge, self.spin, self.title, self.mol = int(charge), int(spin), title, mol


# ---- input ---------------------------------------------------------------------------------------------------
def parse_xyz(text):
    """Standard XYZ text -> (symbols, positions). Raises ValueError with a reason a visitor can act on."""
    if not isinstance(text, str) or not text.strip():
        raise ValueError("xyz must be XYZ text")
    if len(text) > MAX_XYZ_CHARS:
        raise ValueError(f"xyz is longer than {MAX_XYZ_CHARS} characters")
    lines = text.strip().splitlines()
    try:
        n = int(lines[0].strip())
    except ValueError:
        raise ValueError("the first XYZ line must be the number of atoms") from None
    if not 1 <= n <= MAX_XYZ_ATOMS:
        raise ValueError(f"xyz must have 1 to {MAX_XYZ_ATOMS} atoms")
    atom_lines, rest = lines[2:2 + n], lines[2 + n:]
    if len(atom_lines) != n or any(line.strip() for line in rest):
        raise ValueError(f"xyz must have exactly {n} atom lines after the comment line")
    symbols, positions = [], []
    for line in atom_lines:
        parts = line.split()
        if len(parts) != 4:
            raise ValueError("each XYZ atom line must be: element x y z")
        symbol = _SYMBOLS.get(parts[0].lower())
        if not symbol:
            raise ValueError(f"unknown element in xyz: {parts[0][:8]}")
        try:
            xyz = [float(v) for v in parts[1:]]
        except ValueError:
            raise ValueError("XYZ coordinates must be numbers") from None
        if not all(math.isfinite(v) and abs(v) <= MAX_COORD for v in xyz):
            raise ValueError(f"XYZ coordinates must be finite and within {MAX_COORD:g} Angstrom of the origin")
        symbols.append(symbol)
        positions.append(xyz)
    positions = np.array(positions)
    if n > 1 and min_distance(positions) <= MIN_DISTANCE:
        raise ValueError(f"two atoms in xyz are {MIN_DISTANCE} Angstrom or closer")
    return symbols, positions


def min_distance(positions):
    d = np.linalg.norm(positions[:, None] - positions[None], axis=-1)
    np.fill_diagonal(d, np.inf)
    return float(d.min())


def electrons(symbols, charge):
    return sum(atomic_numbers[s] for s in symbols) - int(charge)


def spin_fits(symbols, charge, spin):
    """A multiplicity 2S+1 needs spin-1 unpaired electrons of the same parity as the electron count."""
    n = electrons(symbols, charge)
    return n >= 0 and spin - 1 <= n and (n - (spin - 1)) % 2 == 0


def xyz_text(symbols, positions, comment=""):
    buf = io.StringIO()
    Atoms(symbols, positions=positions).write(buf, format="xyz", comment=comment)
    return buf.getvalue()


def _rdkit():
    from rdkit import Chem, RDLogger

    RDLogger.DisableLog("rdApp.*")
    return Chem


def smiles_of(mol):
    Chem = _rdkit()
    return Chem.MolToSmiles(Chem.RemoveHs(mol))


def species_of(mol_h):
    """(charge, spin multiplicity) a molecule's SMILES implies: formal charges and radical electrons."""
    radicals = sum(a.GetNumRadicalElectrons() for a in mol_h.GetAtoms())
    return sum(a.GetFormalCharge() for a in mol_h.GetAtoms()), radicals + 1


def embed(mol_h, seed=42):
    """RDKit ETKDG (seed 42) + MMFF, as before. Returns (symbols, positions); mol_h keeps the conformer."""
    from rdkit.Chem import AllChem

    params = AllChem.ETKDGv3()
    params.randomSeed = seed
    if AllChem.EmbedMolecule(mol_h, params) != 0:
        raise RuntimeError("RDKit could not build a 3D structure")
    if AllChem.MMFFHasAllMoleculeParams(mol_h):
        AllChem.MMFFOptimizeMolecule(mol_h)
    return [a.GetSymbol() for a in mol_h.GetAtoms()], mol_h.GetConformer().GetPositions()


def embed_many(mol_h, n, seed=42):
    """n ETKDG conformers (seed 42, near-identical ones pruned by RDKit) + MMFF -> list of positions."""
    from rdkit.Chem import AllChem

    params = AllChem.ETKDGv3()
    params.randomSeed = seed
    params.pruneRmsThresh = 0.1
    ids = list(AllChem.EmbedMultipleConfs(mol_h, numConfs=int(n), params=params))
    if not ids:
        raise RuntimeError("RDKit could not build a 3D structure")
    if AllChem.MMFFHasAllMoleculeParams(mol_h):
        AllChem.MMFFOptimizeMoleculeConfs(mol_h)
    return [mol_h.GetConformer(i).GetPositions() for i in ids]


def parse_reaction(text, smiles_ok=None):
    """Reaction SMILES 'A.B>>C.D' -> (species, canonical reaction). A repeated species is its stoichiometric
    coefficient. species: [{smiles, side, count, charge, spin}] in order of first appearance; checks that elements
    (hydrogens included) and charge are conserved."""
    Chem = _rdkit()
    if not isinstance(text, str) or not text or len(text) > 400:
        raise ValueError("params.reaction must be a reaction SMILES of at most 400 characters")
    parts = text.split(">>")
    if len(parts) != 2:
        raise ValueError("params.reaction must look like A.B>>C.D")
    entries, canonical_sides = [], []
    for side, part in zip(("reactant", "product"), parts):
        tokens = part.split(".")
        if not all(t.strip() for t in tokens):
            raise ValueError("params.reaction needs at least one species on each side and no empty species")
        names = []
        for token in tokens:
            token = token.strip()
            if smiles_ok and not smiles_ok(token):
                raise ValueError("a species in params.reaction has unsupported characters or is too long")
            mol = Chem.MolFromSmiles(token)
            if mol is None:
                raise ValueError(f"RDKit cannot parse the species {token[:40]}")
            mol_h = Chem.AddHs(mol)
            names.append(Chem.MolToSmiles(mol))
            entries.append((side, names[-1], mol_h))
        canonical_sides.append(".".join(names))
    if len(entries) > MAX_SPECIES:
        raise ValueError(f"params.reaction may have at most {MAX_SPECIES} species in all")
    elements, charge = {"reactant": Counter(), "product": Counter()}, {"reactant": 0, "product": 0}
    species = {}
    for side, name, mol_h in entries:
        elements[side].update(a.GetSymbol() for a in mol_h.GetAtoms())
        q, s = species_of(mol_h)
        charge[side] += q
        key = (name, side)
        if key not in species:
            species[key] = {"smiles": name, "side": side, "count": 0, "charge": q, "spin": s}
        species[key]["count"] += 1
    if elements["reactant"] != elements["product"]:
        raise ValueError("params.reaction does not conserve the elements (hydrogens included)")
    if charge["reactant"] != charge["product"]:
        raise ValueError("params.reaction does not conserve the charge")
    return list(species.values()), ">>".join(canonical_sides)


def bde_fragments(mol_h, i, j):
    """Homolysis of the bond i-j (indices after AddHs): each end keeps one electron of the bond as a radical.
    Returns [{smiles, charge, spin, atoms}] for the two fragments; atoms are indices into mol_h, in fragment order."""
    Chem = _rdkit()
    n = mol_h.GetNumAtoms()
    if not (0 <= i < n and 0 <= j < n) or i == j:
        raise ValueError("params.bond must be two different atom indices of the molecule")
    bond = mol_h.GetBondBetweenAtoms(int(i), int(j))
    if bond is None:
        raise ValueError(f"atoms {i} and {j} are not bonded")
    if bond.IsInRing():
        raise ValueError("params.bond must not be a ring bond (breaking it gives one fragment)")
    if bond.GetBondType() != Chem.BondType.SINGLE:
        raise ValueError("params.bond must be a single bond")
    rw = Chem.RWMol(mol_h)
    rw.RemoveBond(int(i), int(j))
    for k in (i, j):
        atom = rw.GetAtomWithIdx(int(k))
        atom.SetNumRadicalElectrons(atom.GetNumRadicalElectrons() + 1)
        atom.SetNoImplicit(True)
    broken = rw.GetMol()
    Chem.SanitizeMol(broken)
    mapping = []
    frags = Chem.GetMolFrags(broken, asMols=True, fragsMolAtomMapping=mapping)
    out = []
    for frag, atoms in zip(frags, mapping):
        q, s = species_of(frag)
        out.append({"smiles": smiles_of(frag), "charge": q, "spin": s, "atoms": list(atoms), "mol": frag})
    return out


def pa_partner(mol_h, site, mode):
    """The other species of a proton affinity: protonate adds an H to heavy atom `site` (charge + 1), deprotonate
    removes one of its H atoms (charge - 1). Returns {mol, smiles, delta, drop} where drop is the removed H index
    (deprotonate; the partner's atoms are mol_h's minus that one, in order) or None (protonate: new H at the end)."""
    Chem = _rdkit()
    heavy = mol_h.GetNumHeavyAtoms()
    if not 0 <= site < heavy:
        raise ValueError(f"params.site must be a heavy-atom index from 0 to {heavy - 1}")
    rw = Chem.RWMol(mol_h)
    atom = rw.GetAtomWithIdx(int(site))
    drop = None
    if mode == "protonate":
        h = rw.AddAtom(Chem.Atom(1))
        rw.AddBond(int(site), h, Chem.BondType.SINGLE)
        atom.SetFormalCharge(atom.GetFormalCharge() + 1)
        delta = 1
    else:
        hs = [n.GetIdx() for n in atom.GetNeighbors() if n.GetAtomicNum() == 1]
        if not hs:
            raise ValueError(f"atom {site} has no hydrogen to remove")
        drop = max(hs)
        atom.SetFormalCharge(atom.GetFormalCharge() - 1)
        rw.RemoveAtom(drop)
        delta = -1
    atom = rw.GetAtomWithIdx(int(site))
    atom.SetNoImplicit(True)
    partner = rw.GetMol()
    try:
        Chem.SanitizeMol(partner)
    except Exception:  # noqa: BLE001 - RDKit raises several kinds for an impossible valence
        raise ValueError(f"atom {site} cannot be {'protonated' if mode == 'protonate' else 'deprotonated'}") from None
    return {"mol": partner, "smiles": smiles_of(partner), "delta": delta, "drop": drop}


def bonded(symbols, positions, scale=1.2):
    """Covalent bonds by distance: closer than 1.2 x the sum of the covalent radii."""
    r = covalent_radii[[atomic_numbers[s] for s in symbols]]
    d = np.linalg.norm(positions[:, None] - positions[None], axis=-1)
    b = d < scale * (r[:, None] + r[None])
    np.fill_diagonal(b, False)
    return b


# ---- building blocks ---------------------------------------------------------------------------------------------
def new_atoms(symbols, positions, charge, spin, calc):
    atoms = Atoms(symbols, positions=np.asarray(positions, float))
    atoms.info.update({"charge": int(charge), "spin": int(spin)})
    calc.reset()
    atoms.calc = calc
    return atoms


def max_force(atoms):
    f = atoms.get_forces()
    return float(np.sqrt((f ** 2).sum(axis=1)).max())


def relax(atoms, budget, fmax=OPT_FMAX, steps=MAX_STEPS):
    """LBFGS to fmax (eV/Angstrom) -> (energy, steps, converged)."""
    opt = LBFGS(atoms, logfile=None)
    opt.attach(budget.check)
    converged = bool(opt.run(fmax=fmax, steps=steps))
    return float(atoms.get_potential_energy()), int(opt.nsteps), converged


def is_linear(atoms):
    if len(atoms) == 2:
        return True
    moments = np.sort(atoms.get_moments_of_inertia())
    return bool(moments[0] < 1e-3 * moments[2])


def vibrations(atoms, budget, extra=None, delta=HESSIAN_DELTA):
    """Harmonic analysis at the current geometry. Hessian by central differences of the forces (delta Angstrom),
    mass-weighted, with translations and rotations projected out. extra(positions) -> array is evaluated on the
    same displaced structures and its Cartesian derivatives returned (IR / Raman).
    Returns {geometry, cm1, energies, modes, extra}: modes[:, k] is the Cartesian displacement per unit of the
    normal coordinate Q_k (Angstrom sqrt(amu)), i.e. dx/dQ in 1/sqrt(amu)."""
    n = len(atoms)
    pos0 = atoms.get_positions()
    masses = atoms.get_masses()
    if n == 1:
        return {"geometry": "monatomic", "cm1": np.zeros(0), "energies": np.zeros(0), "modes": np.zeros((3, 0)),
                "extra": None}
    hess = np.zeros((3 * n, 3 * n))
    dx = None
    for k in range(3 * n):
        i, a = divmod(k, 3)
        forces, values = [], []
        for sign in (1, -1):
            p = pos0.copy()
            p[i, a] += sign * delta
            atoms.set_positions(p)
            forces.append(atoms.get_forces().ravel())
            if extra:
                values.append(np.asarray(extra(p), float).ravel())
        hess[k] = -(forces[0] - forces[1]) / (2 * delta)
        if extra:
            if dx is None:
                dx = np.zeros((3 * n, values[0].size))
            dx[k] = (values[0] - values[1]) / (2 * delta)
        budget.progress(k + 1, 3 * n, "displaced structures")
    atoms.set_positions(pos0)
    hess = 0.5 * (hess + hess.T)
    linear = is_linear(atoms)
    sqrt_m = np.sqrt(np.repeat(masses, 3))
    hm = hess / np.outer(sqrt_m, sqrt_m)
    r = pos0 - masses @ pos0 / masses.sum()
    external = []
    for a in range(3):
        t = np.zeros((n, 3))
        t[:, a] = 1.0
        external.append((t * np.sqrt(masses)[:, None]).ravel())
    for a in range(3):
        axis = np.zeros(3)
        axis[a] = 1.0
        external.append((np.cross(axis, r) * np.sqrt(masses)[:, None]).ravel())
    u, _, _ = np.linalg.svd(np.array(external).T, full_matrices=True)
    internal = u[:, 5 if linear else 6:]  # orthonormal basis of the vibrations in mass-weighted coordinates
    w, v = np.linalg.eigh(internal.T @ hm @ internal)
    energies = HBAR_OMEGA * np.sign(w) * np.sqrt(np.abs(w))
    return {"geometry": "linear" if linear else "nonlinear", "cm1": energies / units.invcm, "energies": energies,
            "modes": (internal @ v) / sqrt_m[:, None], "extra": dx}


def thermo_of(atoms, energies, geometry, e_pot, temperature, symmetry=1, spin=1):
    """Ideal-gas, rigid-rotor, harmonic-oscillator thermochemistry with ASE's IdealGasThermo at 1 atm. Imaginary
    (and numerically zero) modes are left out."""
    from ase.thermochemistry import IdealGasThermo

    real = [float(e) for e in energies if e > 1e-6]
    th = IdealGasThermo(real, geometry, potentialenergy=e_pot, atoms=atoms, symmetrynumber=int(symmetry),
                        spin=(spin - 1) / 2, vib_selection="all")
    h = float(th.get_enthalpy(temperature, verbose=False))
    s = float(th.get_entropy(temperature, 101325.0, verbose=False))
    g = h - temperature * s
    return {"temperature_k": temperature, "h_corr_ev": round(h - e_pot, 6), "s_ev_k": round(s, 9),
            "g_corr_ev": round(g - e_pot, 6), "h_ev": round(h, 6), "g_ev": round(g, 6)}


def _minimum(symbols, positions, charge, spin, calc, budget, thermo=False, temperature=298.15):
    """Relaxed energy of one species; with thermo also its harmonic enthalpy and free energy (symmetry number 1)."""
    atoms = new_atoms(symbols, positions, charge, spin, calc)
    e, steps, converged = relax(atoms, budget, FREQ_FMAX if thermo else OPT_FMAX)
    out = {"e": e, "positions": atoms.get_positions(), "steps": steps, "converged": converged}
    if thermo:
        vib = vibrations(atoms, budget)
        th = thermo_of(atoms, vib["energies"], vib["geometry"], e, temperature, 1, spin)
        out.update(h=th["h_ev"], g=th["g_ev"])
    return out


def kabsch_rmsd(p, q):
    p, q = p - p.mean(axis=0), q - q.mean(axis=0)
    u, _, vt = np.linalg.svd(p.T @ q)
    d = np.sign(np.linalg.det(u @ vt))
    rot = u @ np.diag([1.0, 1.0, d]) @ vt
    return float(np.sqrt(((p @ rot - q) ** 2).sum() / len(p)))


def unique_conformers(found, symbols, e_tol_kcal=0.1, rmsd_tol=0.5):
    """found: [(energy, positions, ...)]. Sorted by energy; a structure within e_tol_kcal and rmsd_tol (heavy atoms,
    best rigid fit, no mirror images) of one already kept is a duplicate."""
    heavy = [i for i, s in enumerate(symbols) if s != "H"]
    if len(heavy) < 2:
        heavy = list(range(len(symbols)))
    kept = []
    for item in sorted(found, key=lambda x: x[0]):
        if not any(abs(item[0] - k[0]) * EV_TO_KCAL <= e_tol_kcal and
                   kabsch_rmsd(item[1][heavy], k[1][heavy]) <= rmsd_tol for k in kept):
            kept.append(item)
    return kept


def boltzmann(energies, temperature):
    e = np.asarray(energies, float)
    w = np.exp(-(e - e.min()) / (units.kB * temperature))
    return w / w.sum()


def conformer_search(st, calc, budget, n, fmax=OPT_FMAX):
    """ETKDG conformers relaxed with the model -> (unique [(energy, positions, steps)] lowest first, n generated)."""
    Chem = _rdkit()
    starts = embed_many(Chem.Mol(st.mol), n)
    found = []
    for k, pos in enumerate(starts):
        atoms = new_atoms(st.symbols, pos, st.charge, st.spin, calc)
        e, steps, _ = relax(atoms, budget, fmax)
        found.append((e, atoms.get_positions(), steps))
        budget.progress(k + 1, len(starts), "conformers")
    return unique_conformers(found, st.symbols), len(starts)


def _r(x, digits=6):
    return round(float(x), digits)


# ---- the jobs ----------------------------------------------------------------------------------------------------
def run_sp(st, calc, budget, label):
    atoms = new_atoms(st.symbols, st.positions, st.charge, st.spin, calc)
    e = float(atoms.get_potential_energy())
    f = atoms.get_forces()
    return {"energy_ev": _r(e), "forces_ev_a": [[_r(x) for x in row] for row in f], "fmax_ev_a": _r(max_force(atoms)),
            "xyz": xyz_text(st.symbols, st.positions, f"{label} E = {e:.6f} eV")}


def run_opt(st, calc, budget, label, fmax=OPT_FMAX):
    atoms = new_atoms(st.symbols, st.positions, st.charge, st.spin, calc)
    e, steps, converged = relax(atoms, budget, fmax)
    return {"energy_ev": _r(e), "steps": steps, "converged": converged, "fmax_ev_a": _r(max_force(atoms)),
            "xyz": xyz_text(st.symbols, atoms.get_positions(), f"{label} E = {e:.6f} eV")}


def run_freq(st, calc, budget, label, temperature=298.15, symmetry=1):
    atoms = new_atoms(st.symbols, st.positions, st.charge, st.spin, calc)
    e, steps, _ = relax(atoms, budget, FREQ_FMAX)
    vib = vibrations(atoms, budget)
    cm1 = [round(float(x), 2) for x in vib["cm1"]]
    return {"energy_ev": _r(e), "steps": steps, "frequencies_cm1": cm1, "n_imag": sum(1 for x in cm1 if x < 0),
            "zpe_ev": _r(0.5 * sum(x for x in vib["energies"] if x > 0)), "linear": vib["geometry"] == "linear",
            "thermo": thermo_of(atoms, vib["energies"], vib["geometry"], e, temperature, symmetry, st.spin),
            "xyz": xyz_text(st.symbols, atoms.get_positions(), f"{label} E = {e:.6f} eV")}


def run_conf(st, calc, budget, label, n=10, temperature=298.15, window_kcal=10.0):
    uniq, n_generated = conformer_search(st, calc, budget, n)
    e_min = uniq[0][0]
    shown = [u for u in uniq if (u[0] - e_min) * EV_TO_KCAL <= window_kcal]
    weights = boltzmann([u[0] for u in shown], temperature)
    conformers, frames = [], []
    for rank, ((e, pos, _), w) in enumerate(zip(shown, weights), 1):
        text = xyz_text(st.symbols, pos, f"{label} conformer {rank} E = {e:.6f} eV")
        frames.append(text)
        conformers.append({"rank": rank, "energy_ev": _r(e), "rel_kcal": round((e - e_min) * EV_TO_KCAL, 3),
                           "weight": round(float(w), 4), "xyz": text})
    return {"conformers": conformers, "n_generated": n_generated, "n_unique": len(uniq), "temperature_k": temperature,
            "xyz": "".join(frames)}


def rotating_side(symbols, positions, j, k, l):
    """Atoms that move with l when the dihedral about j-k turns: k's side of the bond. In a ring only l moves."""
    b = bonded(symbols, positions)
    seen, todo = {k}, [k]
    while todo:
        a = todo.pop()
        for nb in np.nonzero(b[a])[0]:
            nb = int(nb)
            if nb not in seen and not (a == k and nb == j):
                seen.add(nb)
                todo.append(nb)
    if j in seen:
        return [l]
    return sorted(seen - {k})


def run_scan(st, calc, budget, label, atoms_idx, start=-180.0, end=180.0, points=13, fmax=OPT_FMAX):
    """Relaxed dihedral scan: at each angle the dihedral is set (rotating k's side) and held with FixInternals while
    everything else relaxes; each point starts from the previous one."""
    from ase.constraints import FixInternals

    i, j, k, l = (int(x) for x in atoms_idx)
    atoms = new_atoms(st.symbols, st.positions, st.charge, st.spin, calc)
    mask = rotating_side(st.symbols, st.positions, j, k, l)
    rows, frames = [], []
    for n, angle in enumerate(np.linspace(start, end, int(points))):
        atoms.set_constraint()
        atoms.set_dihedral(i, j, k, l, float(angle) % 360.0, indices=mask)
        atoms.set_constraint(FixInternals(dihedrals_deg=[[float(angle) % 360.0, [i, j, k, l]]]))
        e, steps, converged = relax(atoms, budget, fmax)
        rows.append({"angle_deg": round(float(angle), 4), "energy_ev": _r(e), "converged": converged})
        frames.append(xyz_text(st.symbols, atoms.get_positions(), f"{label} dihedral {angle:.2f} deg E = {e:.6f} eV"))
        budget.progress(n + 1, points, "scan points")
    atoms.set_constraint()
    e_min = min(r["energy_ev"] for r in rows)
    for r in rows:
        r["rel_kcal"] = round((r["energy_ev"] - e_min) * EV_TO_KCAL, 3)
    return {"atoms": [i, j, k, l], "points": rows, "xyz": "".join(frames)}


def run_md(st, calc, budget, label, temperature=300.0, timestep_fs=0.5, steps=1000, friction=0.01):
    """Langevin NVT from Maxwell-Boltzmann velocities (seed 42). A short relaxation first (fmax 0.05, at most 200
    steps), so a strained starting structure does not heat the run."""
    from ase.md.langevin import Langevin
    from ase.md.velocitydistribution import Stationary, thermalize_momenta

    atoms = new_atoms(st.symbols, st.positions, st.charge, st.spin, calc)
    relax(atoms, budget, 0.05, 200)
    rng = np.random.default_rng(42)
    thermalize_momenta(atoms, temperature, rng=rng)  # Maxwell-Boltzmann
    Stationary(atoms)
    dyn = Langevin(atoms, timestep_fs * units.fs, temperature_K=temperature, friction=friction / units.fs,
                   fixcm=False, rng=rng)
    every, frame_every = math.ceil(steps / 200), math.ceil(steps / 100)  # at most 200 points and 100 frames
    series, frames = [], []

    def record():
        step = dyn.nsteps
        if step == 0:
            return
        if step % every == 0:
            series.append({"t_fs": round(step * timestep_fs, 3), "epot_ev": _r(atoms.get_potential_energy()),
                           "ekin_ev": _r(atoms.get_kinetic_energy()), "temperature_k": round(float(atoms.get_temperature()), 2)})
            budget.progress(step, steps, "MD steps")
        if step % frame_every == 0:
            frames.append(xyz_text(st.symbols, atoms.get_positions(), f"{label} t = {step * timestep_fs:.1f} fs"))

    dyn.attach(record, interval=1)
    dyn.run(int(steps))
    mean_t = sum(p["temperature_k"] for p in series) / len(series) if series else 0.0
    return {"series": series, "mean_temperature_k": round(mean_t, 2), "xyz": "".join(frames)}


def run_rxn(species, calc, budget, thermo=False, temperature=298.15):
    """Reaction energy (and free energy) from each species relaxed once: sum over products minus reactants."""
    Chem = _rdkit()
    done, rows, frames = {}, [], []
    for n, sp in enumerate(species):
        key = (sp["smiles"], sp["charge"], sp["spin"])
        if key not in done:
            symbols, pos = embed(Chem.AddHs(Chem.MolFromSmiles(sp["smiles"])))
            done[key] = (symbols, _minimum(symbols, pos, sp["charge"], sp["spin"], calc, budget, thermo, temperature))
            frames.append(xyz_text(symbols, done[key][1]["positions"], f"{sp['smiles']} E = {done[key][1]['e']:.6f} eV"))
        r = done[key][1]
        row = {k: sp[k] for k in ("smiles", "side", "count", "charge", "spin")}
        row["energy_ev"] = _r(r["e"])
        if thermo:
            row["g_ev"] = _r(r["g"])
        rows.append(row)
        budget.progress(n + 1, len(species), "species")
    sign = {"reactant": -1, "product": 1}
    de = sum(sign[s["side"]] * s["count"] * done[(s["smiles"], s["charge"], s["spin"])][1]["e"] for s in species)
    out = {"species": rows, "delta_e_ev": round(de, 4), "delta_e_kcal": round(de * EV_TO_KCAL, 2), "xyz": "".join(frames)}
    if thermo:
        dg = sum(sign[s["side"]] * s["count"] * done[(s["smiles"], s["charge"], s["spin"])][1]["g"] for s in species)
        out.update(delta_g_ev=round(dg, 4), delta_g_kcal=round(dg * EV_TO_KCAL, 2), temperature_k=temperature)
    return out


def run_ipea(st, calc, budget, label, mode="adiabatic"):
    """IP = E(q+1) - E(q) and EA = E(q) - E(q-1) in eV. Adiabatic: each ion relaxed from the neutral's minimum (as
    before); vertical: the ions at the neutral's minimum. Ions are doublets for a singlet, else multiplicity - 1."""
    q, s = st.charge, st.spin
    atoms = new_atoms(st.symbols, st.positions, q, s, calc)
    e0, steps, _ = relax(atoms, budget)
    pos = atoms.get_positions()
    ion = 2 if s == 1 else s - 1
    out = {"energy_ev": _r(e0), "steps": steps, "mode": mode, "xyz": xyz_text(st.symbols, pos, f"{label} E = {e0:.6f} eV")}
    if mode in ("adiabatic", "both"):
        e_cat, _, _ = relax(new_atoms(st.symbols, pos, q + 1, ion, calc), budget)
        e_an, _, _ = relax(new_atoms(st.symbols, pos, q - 1, ion, calc), budget)
        out.update(ip_ev=round(e_cat - e0, 4), ea_ev=round(e0 - e_an, 4))
    if mode in ("vertical", "both"):
        e_cat = new_atoms(st.symbols, pos, q + 1, ion, calc).get_potential_energy()
        e_an = new_atoms(st.symbols, pos, q - 1, ion, calc).get_potential_energy()
        out.update(ip_vertical_ev=round(e_cat - e0, 4), ea_vertical_ev=round(e0 - e_an, 4))
    return out


def run_spin(st, calc, budget, label, spins):
    """Two spin states, each relaxed from the input: adiabatic gap E(m2) - E(m1); vertical gap with m2 at m1's minimum."""
    states = []
    for m in spins:
        atoms = new_atoms(st.symbols, st.positions, st.charge, m, calc)
        e, _, _ = relax(atoms, budget)
        states.append({"spin": int(m), "energy_ev": _r(e), "positions": atoms.get_positions(), "e": e})
        budget.progress(len(states), 2, "spin states")
    e1 = states[0]["e"]
    e_vert = new_atoms(st.symbols, states[0]["positions"], st.charge, spins[1], calc).get_potential_energy()
    gap = states[1]["e"] - e1
    for state in states:
        pos, e = state.pop("positions"), state.pop("e")
        state["xyz"] = xyz_text(st.symbols, pos, f"{label} multiplicity {state['spin']} E = {e:.6f} eV")
    return {"states": states, "gap_ev": round(gap, 4), "gap_kcal": round(gap * EV_TO_KCAL, 2),
            "vertical_gap_ev": round(float(e_vert) - e1, 4), "xyz": states[0]["xyz"]}


def run_bde(st, fragments, calc, budget, label, bond, thermo=False, temperature=298.15):
    """Homolytic bond dissociation energy: E(fragment 1) + E(fragment 2) - E(parent), each relaxed; the fragments
    start from the parent's minimum. With thermo also the enthalpy difference at `temperature`."""
    parent = _minimum(st.symbols, st.positions, st.charge, st.spin, calc, budget, thermo, temperature)
    done, rows = {}, []
    for f in fragments:
        key = (f["smiles"], f["charge"], f["spin"])
        if key not in done:
            symbols = [st.symbols[a] for a in f["atoms"]]
            done[key] = _minimum(symbols, parent["positions"][f["atoms"]], f["charge"], f["spin"], calc, budget,
                                 thermo, temperature)
        rows.append({"smiles": f["smiles"], "spin": f["spin"], "energy_ev": _r(done[key]["e"])})
    picked = [done[(f["smiles"], f["charge"], f["spin"])] for f in fragments]
    bde = sum(r["e"] for r in picked) - parent["e"]
    out = {"bond": [int(b) for b in bond], "parent_energy_ev": _r(parent["e"]), "fragments": rows,
           "bde_ev": round(bde, 4), "bde_kcal": round(bde * EV_TO_KCAL, 2),
           "xyz": xyz_text(st.symbols, parent["positions"], f"{label} E = {parent['e']:.6f} eV")}
    if thermo:
        out["bdh298_kcal"] = round((sum(r["h"] for r in picked) - parent["h"]) * EV_TO_KCAL, 2)
    return out


def run_pa(st, partner, calc, budget, label, site, mode="protonate", thermo=False, temperature=298.15):
    """Proton affinity from electronic energies, E(base) - E(acid): protonate gives PA = E(B) - E(BH+) (the input is
    the base), deprotonate gives E(A-) - E(AH) (the input is the acid). The deprotonated species starts from the
    input's minimum without the removed H; a protonated one is built afresh by ETKDG + MMFF. With thermo the
    enthalpy version, including the proton's 5/2 RT."""
    me = _minimum(st.symbols, st.positions, st.charge, st.spin, calc, budget, thermo, temperature)
    pmol = partner["mol"]
    p_symbols = [a.GetSymbol() for a in pmol.GetAtoms()]
    if partner["drop"] is None:
        _, p_pos = embed(pmol)
    else:
        p_pos = np.delete(me["positions"], partner["drop"], axis=0)
    other = _minimum(p_symbols, p_pos, st.charge + partner["delta"], st.spin, calc, budget, thermo, temperature)
    base, acid = (me, other) if mode == "protonate" else (other, me)
    value = base["e"] - acid["e"]
    out = {"site": int(site), "mode": mode, "energies": {"base_ev": _r(base["e"]), "acid_ev": _r(acid["e"])},
           "value_ev": round(value, 4), "value_kcal": round(value * EV_TO_KCAL, 2),
           "xyz": xyz_text(st.symbols, me["positions"], f"{label} E = {me['e']:.6f} eV")}
    if thermo:
        out["enthalpy_kcal"] = round((base["h"] + 2.5 * units.kB * temperature - acid["h"]) * EV_TO_KCAL, 2)
    return out


def polar_props(dp, symbols, positions):
    """MACE-MDP-style dipole (e*Angstrom) and polarizability (Angstrom^3) -> the result fields, rounded as before."""
    d, a = dp(symbols, positions)
    pol = [[round(float(x), 4) for x in row] for row in np.reshape(a, (3, 3))]
    dip = [round(float(x) * E_A_TO_DEBYE, 4) for x in np.ravel(d)[:3]]
    return {"dipole_debye": round(sum(x * x for x in dip) ** 0.5, 4), "dipole_vector": dip,
            "polarizability_a3": round((pol[0][0] + pol[1][1] + pol[2][2]) / 3, 4), "polarizability_tensor_a3": pol}


def run_polar(st, geo_calc, dp, budget, average=False, n=8, temperature=298.15):
    """Dipole and polarizability on the geometry relaxed with geo_calc (MACE-OFF23 medium). average: over a
    conformer search with geo_calc, Boltzmann-weighted at 298.15 K; the vector, tensor and xyz are the lowest one's."""
    out = {"geometry_model": "mace-off23-medium"}
    if not average:
        atoms = new_atoms(st.symbols, st.positions, 0, 1, geo_calc)
        e, steps, _ = relax(atoms, budget)
        out.update(energy_ev=_r(e), steps=steps, **polar_props(dp, st.symbols, atoms.get_positions()),
                   xyz=xyz_text(st.symbols, atoms.get_positions(), f"{st.title} relaxed with MACE-OFF23 medium"))
        return out
    uniq, _ = conformer_search(Structure(st.symbols, st.positions, 0, 1, st.title, st.mol), geo_calc, budget, n)
    e_min = uniq[0][0]
    uniq = [u for u in uniq if (u[0] - e_min) * EV_TO_KCAL <= 10.0]
    weights = boltzmann([u[0] for u in uniq], temperature)
    props = [polar_props(dp, st.symbols, u[1]) for u in uniq]
    e, pos, steps = uniq[0]
    out.update(energy_ev=_r(e), steps=steps, **props[0],
               xyz=xyz_text(st.symbols, pos, f"{st.title} lowest conformer, MACE-OFF23 medium"))
    out.update(dipole_debye=round(float(sum(w * p["dipole_debye"] for w, p in zip(weights, props))), 4),
               polarizability_a3=round(float(sum(w * p["polarizability_a3"] for w, p in zip(weights, props))), 4),
               conformers=len(uniq), weights=[round(float(w), 4) for w in weights])
    return out


def run_ir(st, geo_calc, dp, budget):
    """IR intensities and Raman activities. geo_calc (MACE-OFF23 medium) relaxes (fmax 0.005) and gives the Hessian;
    dp (MACE-MDP) gives the dipole and polarizability on the same displaced structures. Per normal mode Q_k:
      d mu / dQ_k = sum_i (d mu / dx_i) dx_i/dQ_k              (e / sqrt(amu)),  A_k = 974.88 |d mu/dQ_k|^2 km/mol
      d alpha / dQ_k likewise                               (Angstrom^2 / sqrt(amu), alpha as a volume in Angstrom^3)
      Raman activity S_k = 45 a'^2 + 7 gamma'^2 in Angstrom^4/amu, a' = trace/3,
      gamma'^2 = ((xx-yy)^2 + (yy-zz)^2 + (zz-xx)^2 + 6 (xy^2 + yz^2 + zx^2)) / 2."""
    atoms = new_atoms(st.symbols, st.positions, 0, 1, geo_calc)
    e, _, _ = relax(atoms, budget, FREQ_FMAX)

    def extra(p):
        d, a = dp(st.symbols, p)
        return np.concatenate([np.ravel(d)[:3], np.ravel(a)[:9]])

    vib = vibrations(atoms, budget, extra)
    cm1 = [round(float(x), 2) for x in vib["cm1"]]
    ir, raman = [], []
    if vib["extra"] is not None:
        dmu, dal = vib["extra"][:, :3], vib["extra"][:, 3:].reshape(-1, 3, 3)
        for k in range(vib["modes"].shape[1]):
            c = vib["modes"][:, k]
            mu_q = c @ dmu
            a_q = np.einsum("k,kij->ij", c, dal)
            a_q = 0.5 * (a_q + a_q.T)
            mean = np.trace(a_q) / 3
            gamma2 = 0.5 * ((a_q[0, 0] - a_q[1, 1]) ** 2 + (a_q[1, 1] - a_q[2, 2]) ** 2 + (a_q[2, 2] - a_q[0, 0]) ** 2
                            + 6 * (a_q[0, 1] ** 2 + a_q[1, 2] ** 2 + a_q[2, 0] ** 2))
            ir.append(round(float(IR_KM_MOL * mu_q @ mu_q), 3))
            raman.append(round(float(45 * mean ** 2 + 7 * gamma2), 3))
    return {"geometry_model": "mace-off23-medium", "frequencies_cm1": cm1, "ir_intensity_km_mol": ir,
            "raman_activity_a4_amu": raman, "n_imag": sum(1 for x in cm1 if x < 0),
            "xyz": xyz_text(st.symbols, atoms.get_positions(), f"{st.title} MACE-OFF23 medium E = {e:.6f} eV")}


# ---- --fake ------------------------------------------------------------------------------------------------------
def toy_ef(symbols, positions, charge, spin):
    """--fake only: a Lennard-Jones toy (well depth 0.2 eV at the sum of the covalent radii between every pair) plus
    made-up atom, charge and spin terms. Fast, smooth and reproducible; the numbers mean nothing."""
    z = np.array([atomic_numbers[s] for s in symbols])
    pos = np.asarray(positions, float)
    sigma = (covalent_radii[z][:, None] + covalent_radii[z][None]) / 2 ** (1 / 6)
    vec = pos[:, None] - pos[None]
    r = np.linalg.norm(vec, axis=-1)
    np.fill_diagonal(r, np.inf)
    sr6 = (sigma / r) ** 6
    eps = 0.2
    e = 0.5 * float((4 * eps * (sr6 ** 2 - sr6)).sum())
    de_dr = 4 * eps * (-12 * sr6 ** 2 + 6 * sr6) / r
    forces = -(de_dr[:, :, None] * vec / r[:, :, None]).sum(axis=1)
    e += -10.0 * float(z.sum()) + 6.0 * charge + 0.4 * charge ** 2 + 0.25 * (spin - 1)
    return e, forces


def toy_dp(symbols, positions):
    """--fake only: dipole from made-up fixed charges (e*Angstrom) and a made-up polarizability (Angstrom^3)."""
    z = np.array([atomic_numbers[s] for s in symbols])
    pos = np.asarray(positions, float)
    q = (z % 3 - 1) * 0.1
    q = q - q.mean()
    r = pos - pos.mean(axis=0)
    return q @ pos, 0.8 * len(z) * np.eye(3) + 0.05 * r.T @ r
