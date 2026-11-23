"""Phonons of a crystal for the MolAstria online models: phonopy finite displacements, written once against an ASE
calculator (UMA's inorganic-materials task "omat" on the GPU, or ASE's EMT on the CPU).

One job, phon:
  crystal (a preset, or POSCAR / CIF text) -> spglib: space group, standardised conventional cell -> optionally relaxed
  (positions and cell, symmetry kept with ASE's FixSymmetry) -> phonopy: supercell, symmetry-reduced displacements ->
  forces from the calculator (the perfect supercell's residual forces subtracted) -> force constants (symmetrised) ->
  band structure along the seekpath path, total DOS on a Gamma-centred mesh, thermal properties (Cv, S, F vs T),
  and a flag for imaginary modes (a dynamically unstable structure, or a supercell too small).

phonopy (BSD-3-Clause), spglib (BSD-3-Clause) and seekpath (MIT) are imported as unmodified libraries
(pip install phonopy spglib seekpath) and called at run time; none of their code is copied here (THIRD-PARTY-phonopy.md).

Units: frequencies in THz (1 THz = 33.35641 cm^-1 = 4.135667 meV), as phonopy gives them, imaginary ones negative;
thermal properties per mole of primitive cells (phonopy's convention): F in kJ/mol, S and Cv in J/(K mol).
The limits here are the same as in deploy/account-worker.js and public/code/phonon-core.js (tools/phonon-job-test.mjs).
"""
import io
import warnings

import numpy as np

MAX_TEXT = 8000  # characters of POSCAR / CIF text
MAX_CELL_ATOMS = 32  # atoms in the standardised conventional cell
MAX_SUPERCELL_ATOMS = 216  # atoms in the supercell (6 x 6 x 6 fcc primitive, or 3 x 3 x 3 of an 8-atom cell)
MAX_DISPLACEMENTS = 48  # symmetry-reduced displaced supercells, each one force call
SUPERCELL_MAX = 4  # each of the three diagonal multipliers
DISP = (0.005, 0.05, 0.01)  # displacement distance in Angstrom: lowest, highest, default
MESH = (4, 32, 16)  # the DOS / thermal mesh along each reciprocal axis
TMAX = (100, 2000, 1000)  # K, highest temperature of the thermal properties
SYMPREC = 1e-3  # Angstrom, spglib's tolerance for the space group
RELAX_FMAX, RELAX_STEPS = 1e-3, 300  # eV/Angstrom; the relaxation also brings the stress near zero
IMAG_THZ = -0.05  # a frequency below this counts as imaginary (the acoustic modes at Gamma are about 1e-6 THz)
THZ_TO_CM1, THZ_TO_MEV = 33.35641, 4.135667
EMT_METALS = ("Al", "Cu", "Ag", "Au", "Ni", "Pd", "Pt")  # the fcc metals ASE's EMT is fitted to (quacc_backend too)
FORMATS = ("poscar", "cif")

# Presets: conventional cubic cells at the experimental room-temperature lattice constant (Angstrom), built with
# ase.build.bulk(..., cubic=True). The relaxation (on by default) moves them to each calculator's own minimum.
PRESETS = {
    "Cu": ("fcc", 3.615), "Al": ("fcc", 4.050), "Ag": ("fcc", 4.086), "Au": ("fcc", 4.078),
    "Ni": ("fcc", 3.524), "Pd": ("fcc", 3.891), "Pt": ("fcc", 3.924),
    "Si": ("diamond", 5.431), "C": ("diamond", 3.567),
    "NaCl": ("rocksalt", 5.640), "MgO": ("rocksalt", 4.212),
}


class PhononError(ValueError):
    """A crystal or parameter this job does not take; the message goes back to the visitor."""


def versions():
    """{'phonopy': ..., 'spglib': ..., 'seekpath': ...}, or {} when one of the three is missing (the job is off)."""
    try:
        from importlib.metadata import version

        return {p: version(p) for p in ("phonopy", "spglib", "seekpath")}
    except Exception:  # noqa: BLE001 - not installed
        return {}


def preset_atoms(name):
    from ase.build import bulk

    if name not in PRESETS:
        raise PhononError(f"no preset {name!r}; presets: {', '.join(PRESETS)}")
    kind, a = PRESETS[name]
    return bulk(name, kind, a=a, cubic=True)


def read_structure(text, fmt):
    """POSCAR (VASP 5 with element names) or CIF text -> ASE Atoms, periodic in all three directions."""
    from ase.io import read

    if not isinstance(text, str) or not text.strip():
        raise PhononError("the structure text is empty")
    if len(text) > MAX_TEXT:
        raise PhononError(f"the structure text is longer than {MAX_TEXT} characters")
    if fmt not in FORMATS:
        raise PhononError(f"format must be one of {', '.join(FORMATS)}")
    try:
        atoms = read(io.StringIO(text), format="vasp" if fmt == "poscar" else "cif")
    except Exception as e:  # noqa: BLE001 - visitors send broken files; say so in one line
        raise PhononError(f"could not read the {fmt.upper()} text: {type(e).__name__}: {str(e)[:160]}") from None
    if isinstance(atoms, list):
        atoms = atoms[0]
    if len(atoms) == 0:
        raise PhononError("the structure has no atoms")
    if atoms.cell.rank < 3 or abs(atoms.get_volume()) < 1.0:
        raise PhononError("the structure needs a three-dimensional cell (three lattice vectors)")
    atoms.pbc = True
    return atoms


def _cell(atoms):
    return (np.array(atoms.cell[:]), atoms.get_scaled_positions(), atoms.numbers)


def symmetry(atoms, symprec=SYMPREC):
    """spglib's space group of the structure and its standardised conventional cell (as ASE Atoms)."""
    import spglib
    from ase import Atoms

    ds = spglib.get_symmetry_dataset(_cell(atoms), symprec=symprec)
    if ds is None:
        raise PhononError("spglib found no symmetry: the cell or the positions are broken")
    lattice, positions, numbers = spglib.standardize_cell(_cell(atoms), to_primitive=False, no_idealize=False, symprec=symprec)
    std = Atoms(numbers=numbers, cell=lattice, scaled_positions=positions, pbc=True)
    prim = spglib.standardize_cell(_cell(atoms), to_primitive=True, no_idealize=False, symprec=symprec)
    info = {"international": ds.international, "number": int(ds.number), "hall": ds.hall,
            "point_group": ds.pointgroup, "crystal_system": _system(int(ds.number)),
            "wyckoffs": sorted(set(f"{s}:{w}" for s, w in zip(std.get_chemical_symbols(), _wyckoffs(std, symprec)))),
            "n_input": len(atoms), "n_conventional": len(std), "n_primitive": len(prim[2])}
    return std, info


def _wyckoffs(atoms, symprec):
    import spglib

    return list(spglib.get_symmetry_dataset(_cell(atoms), symprec=symprec).wyckoffs)


def _system(n):
    for top, name in ((2, "triclinic"), (15, "monoclinic"), (74, "orthorhombic"), (142, "tetragonal"),
                      (167, "trigonal"), (194, "hexagonal"), (230, "cubic")):
        if n <= top:
            return name
    return ""


def _lattice(atoms):
    a, b, c, al, be, ga = atoms.cell.cellpar()
    return {k: round(float(v), 5) for k, v in zip(("a", "b", "c", "alpha", "beta", "gamma"), (a, b, c, al, be, ga))}


def _phonopy(atoms, supercell, distance):
    from phonopy import Phonopy
    from phonopy.structure.atoms import PhonopyAtoms

    unit = PhonopyAtoms(symbols=atoms.get_chemical_symbols(), cell=np.array(atoms.cell[:]),
                        scaled_positions=atoms.get_scaled_positions())
    with warnings.catch_warnings():  # phonopy 4 warns that "auto" is now its default; it is what we want
        warnings.simplefilter("ignore")
        ph = Phonopy(unit, supercell_matrix=np.diag(supercell), primitive_matrix="auto", symprec=SYMPREC)
    ph.generate_displacements(distance=distance, is_plusminus="auto")
    return ph


def prepare(p, elements=None):
    """Checks a job's params before it is queued and builds what the run starts from:
    {atoms (standardised conventional cell), symmetry, supercell, n_supercell, n_displacements}.
    elements: the symbols the calculator takes (EMT: its seven metals), or None for any."""
    if p.get("preset"):
        atoms, source = preset_atoms(p["preset"]), f"preset {p['preset']}"
    else:
        atoms, source = read_structure(p.get("structure"), p.get("format", "poscar")), p.get("format", "poscar").upper()
    bad = sorted(set(atoms.get_chemical_symbols()) - set(elements)) if elements is not None else []
    if bad:
        raise PhononError(f"this calculator does not take {', '.join(bad)} (it takes {', '.join(elements)})")
    if len(atoms) > 4 * MAX_CELL_ATOMS:
        raise PhononError(f"the cell has {len(atoms)} atoms; at most {MAX_CELL_ATOMS} after standardisation")
    std, sym = symmetry(atoms)
    if len(std) > MAX_CELL_ATOMS:
        raise PhononError(f"the standardised conventional cell has {len(std)} atoms; this job takes at most {MAX_CELL_ATOMS}")
    sc = [int(x) for x in p.get("supercell", [2, 2, 2])]
    if len(sc) != 3 or not all(1 <= x <= SUPERCELL_MAX for x in sc):
        raise PhononError(f"the supercell is three whole numbers from 1 to {SUPERCELL_MAX}")
    n_super = len(std) * sc[0] * sc[1] * sc[2]
    if n_super > MAX_SUPERCELL_ATOMS:
        raise PhononError(f"the supercell would have {n_super} atoms ({len(std)} in the conventional cell x "
                          f"{sc[0]}x{sc[1]}x{sc[2]}); at most {MAX_SUPERCELL_ATOMS}")
    ph = _phonopy(std, sc, float(p.get("displacement", DISP[2])))
    n_disp = len(ph.supercells_with_displacements)
    if n_disp > MAX_DISPLACEMENTS:
        raise PhononError(f"{sym['international']} with this cell needs {n_disp} displaced supercells; at most "
                          f"{MAX_DISPLACEMENTS} (a crystal with more symmetry, or fewer atoms in the cell)")
    return {"atoms": std, "symmetry": sym, "supercell": sc, "n_supercell": n_super, "n_displacements": n_disp,
            "source": source, "formula": std.get_chemical_formula("hill", empirical=True)}


def _label(s):
    """phonopy's LaTeX labels ($\\Gamma$, $\\mathrm{X}$, $\\mathrm{X_1}$) -> plain text (Γ, X, X₁)."""
    s = str(s).replace("$", "").replace("\\mathrm{", "").replace("}", "").replace("{", "")
    s = s.replace("\\Gamma", "Γ").replace("GAMMA", "Γ").replace("\\Sigma", "Σ").replace("\\Delta", "Δ").replace("\\Lambda", "Λ")
    return s.replace("_0", "₀").replace("_1", "₁").replace("_2", "₂").replace("_", "")


def _r(x, d=4):
    return round(float(x), d)


def _relax(atoms, calc, budget):
    from ase.constraints import FixSymmetry
    from ase.filters import FrechetCellFilter
    from ase.optimize import BFGS

    atoms = atoms.copy()
    atoms.calc = calc
    e0 = float(atoms.get_potential_energy())
    v0 = float(atoms.get_volume())
    atoms.set_constraint(FixSymmetry(atoms, symprec=SYMPREC))
    opt = BFGS(FrechetCellFilter(atoms), logfile=None)
    opt.attach(budget.check)
    converged = bool(opt.run(fmax=RELAX_FMAX, steps=RELAX_STEPS))
    stress = atoms.get_stress(voigt=True)
    atoms.set_constraint()
    out = {"steps": int(opt.nsteps), "converged": converged, "energy_before_ev": _r(e0, 6),
           "energy_ev": _r(atoms.get_potential_energy(), 6), "volume_before_a3": _r(v0, 4), "volume_a3": _r(atoms.get_volume(), 4),
           "max_stress_gpa": _r(float(np.abs(stress[:3]).max()) * 160.21766, 4)}
    return atoms, out


def _poscar(atoms, comment):
    from ase.io import write

    buf = io.StringIO()
    write(buf, atoms, format="vasp", direct=True, sort=True)
    return comment[:70] + "\n" + buf.getvalue().split("\n", 1)[1]


def run_phonon(p, calc_for, budget, label="", elements=None):
    """The whole job; p holds the checked params (job_params in server.py), calc_for(symbols) gives the ASE calculator
    (one instance, used for every cell). Returns the result's fields."""
    prep = prepare(p, elements)
    atoms, sc = prep["atoms"], prep["supercell"]
    calc = calc_for(atoms.get_chemical_symbols())
    out = {"method": "spglib standardised conventional cell -> phonopy finite displacements (symmetry-reduced, "
                     "residual forces subtracted) -> force constants -> seekpath band path, Gamma-centred mesh DOS",
           "versions": versions(), "source": prep["source"], "formula": prep["formula"], "symmetry": prep["symmetry"],
           "supercell": sc, "n_supercell": prep["n_supercell"], "n_displacements": prep["n_displacements"],
           "displacement_a": float(p.get("displacement", DISP[2])), "lattice_input": _lattice(atoms)}
    total = prep["n_displacements"] + 1 + (1 if p.get("relax", True) else 0)
    budget.progress(0, total, "symmetry")
    if p.get("relax", True):
        atoms, out["relax"] = _relax(atoms, calc, budget)
        budget.progress(1, total, "relaxed")
    out["lattice"] = _lattice(atoms)
    out["poscar"] = _poscar(atoms, f"{prep['formula']} {label}".strip())
    from ase import Atoms

    ph = _phonopy(atoms, sc, out["displacement_a"])

    def forces(cell):
        at = Atoms(cell.symbols, cell=np.array(cell.cell), scaled_positions=cell.scaled_positions, pbc=True)
        at.calc = calc
        f = np.array(at.get_forces())
        budget.check()
        return f

    residual = forces(ph.supercell)
    done = total - prep["n_displacements"]
    budget.progress(done, total, "forces")
    sets = []
    for k, cell in enumerate(ph.supercells_with_displacements):
        sets.append(forces(cell) - residual)
        budget.progress(done + k + 1, total, "forces")
    out["max_residual_force_ev_a"] = _r(float(np.linalg.norm(residual, axis=1).max()), 5)
    ph.forces = np.array(sets)
    ph.produce_force_constants()
    ph.symmetrize_force_constants()

    n_bands = 3 * len(ph.primitive)
    npoints = 41 if n_bands <= 24 else 21
    ph.auto_band_structure(npoints=npoints, with_eigenvectors=False, plot=False)
    bs = ph.band_structure
    labels = [_label(x) for x in (bs.labels or [])]
    segments, ticks, li = [], [], 0
    conns = list(bs.path_connections)
    for i, (dist, freq) in enumerate(zip(bs.distances, bs.frequencies)):
        dist, freq = np.asarray(dist), np.asarray(freq)
        start = labels[li] if li < len(labels) else ""
        end = labels[li + 1] if li + 1 < len(labels) else ""
        li += 1 if conns[i] else 2  # a break: the next segment starts at a new label
        segments.append({"from": start, "to": end, "distances": [_r(x, 5) for x in dist],
                         "frequencies_thz": [[_r(v) for v in row] for row in freq]})
        brk = bool(i and not conns[i - 1])  # a jump in the path: the tick carries both labels, "U|K"
        ticks.append({"x": _r(dist[0], 5), "label": f"{segments[-2]['to']}|{start}" if brk else start, "break": brk})
    if segments:
        ticks.append({"x": segments[-1]["distances"][-1], "label": segments[-1]["to"], "break": False})
    out["band"] = {"segments": segments, "ticks": ticks, "n_bands": n_bands, "labels": labels}

    m = int(p.get("mesh", MESH[2]))
    ph.run_mesh([m, m, m], is_gamma_center=True)
    mesh_f = np.asarray(ph.mesh.frequencies)
    ph.run_total_dos()
    dos = ph.total_dos
    out["dos"] = {"mesh": [m, m, m], "frequency_thz": [_r(x) for x in dos.frequency_points],
                  "dos": [_r(x, 5) for x in dos.dos]}
    tmax = int(p.get("t_max", TMAX[2]))
    step = 10 if tmax <= 1000 else 20
    with warnings.catch_warnings():  # the three acoustic modes at Gamma are about 1e-7 THz; phonopy says so each time
        warnings.simplefilter("ignore")
        ph.run_thermal_properties(t_min=0, t_max=tmax, t_step=step)
    tp = ph.thermal_properties
    n_prim = len(ph.primitive)
    out["thermal"] = {"per": "mole of primitive cells", "atoms_per_cell": n_prim,
                      "temperature_k": [_r(x, 1) for x in tp.temperatures],
                      "free_energy_kj_mol": [_r(x) for x in tp.free_energy],
                      "entropy_j_k_mol": [_r(x) for x in tp.entropy],
                      "heat_capacity_j_k_mol": [_r(x) for x in tp.heat_capacity],
                      "dulong_petit_j_k_mol": _r(3 * n_prim * 8.314462618, 3),
                      "zero_point_kj_mol": _r(tp.free_energy[0])}

    band_f = np.concatenate([np.asarray(f).ravel() for f in bs.frequencies]) if segments else np.zeros(1)
    ph.run_qpoints([[0, 0, 0]])
    gamma = np.sort(np.asarray(ph.qpoints.frequencies)[0])
    low = float(min(band_f.min(), mesh_f.min()))
    out.update({"gamma_thz": [_r(x) for x in gamma], "min_frequency_thz": _r(low), "max_frequency_thz": _r(float(band_f.max())),
                "imaginary": low < IMAG_THZ, "imag_threshold_thz": IMAG_THZ,
                "n_imaginary_mesh": int((mesh_f < IMAG_THZ).sum())})
    return out


def toy_calculator(atoms_symbols):
    """--fake only: EMT when every element is one of its metals, otherwise a Lennard-Jones toy. Numbers mean nothing
    for anything but EMT's metals."""
    if set(atoms_symbols) <= set(EMT_METALS):
        from ase.calculators.emt import EMT

        return EMT()
    from ase.calculators.lj import LennardJones

    return LennardJones(sigma=2.2, epsilon=0.05, rc=6.0, smooth=True)


