"""OpenMM (openmm/openmm, MIT) as the online models' protein lane: a short molecular-dynamics run of a protein from
the PDB in implicit water, on the owner's GPU.

    structure:  files.rcsb.org/download/<ID>.pdb, first model, the chains asked for; PDBFixer (MIT) replaces
                nonstandard residues, removes ligands and water, builds missing atoms and internal gaps of at most
                MAX_GAP residues, and adds hydrogens at pH 7
    force field: Amber ff14SB (amber14-all.xml) + GBSA-OBC2 implicit water (implicit/obc2.xml), cutoff 2 nm,
                bonds to hydrogen constrained
    run:        energy minimisation, then Langevin dynamics (LangevinMiddleIntegrator, 1/ps friction, 2 fs steps,
                velocities from seed 42) at the temperature asked for
    result:     energies, temperature, Cα RMSD from the minimised structure and radius of gyration over time,
                per-residue Cα RMSF, a Cα trajectory and the final structure (heavy atoms) as PDB text

Implicit solvent and a few tens of picoseconds show how stable a fold is and which loops move; they are not a
production simulation (no explicit water, no ions, no equilibration protocol). The page says so.

The analysis helpers (Kabsch RMSD, radius of gyration, RMSF, PDB writing, input checks) need only numpy and are
tested without OpenMM in test_openmm_backend.py; the simulation itself runs when OpenMM and PDBFixer are installed.
"""
import io
import math
import re
import time
import urllib.request

import numpy as np

PDB_ID = re.compile(r"^[1-9][A-Za-z0-9]{3}$")
CHAINS = re.compile(r"^[A-Za-z0-9]{1,8}$")
MAX_RESIDUES = 300  # after the chains are chosen; about 5000 atoms with hydrogens
MAX_ATOMS = 6000
MAX_GAP = 20  # missing residues inside a chain that PDBFixer may build; more and the structure is refused
MAX_DOWNLOAD = 8 * 1024 * 1024
FRAMES = 25
PS_DEFAULT, PS_MAX = 20, 100
STEP_FS = 2.0
AMINO = {"ALA", "ARG", "ASN", "ASP", "CYS", "GLN", "GLU", "GLY", "HIS", "ILE", "LEU", "LYS", "MET", "PHE", "PRO",
         "SER", "THR", "TRP", "TYR", "VAL", "HID", "HIE", "HIP", "CYX", "ASH", "GLH", "LYN", "ACE", "NME"}
ONE = {"ALA": "A", "ARG": "R", "ASN": "N", "ASP": "D", "CYS": "C", "GLN": "Q", "GLU": "E", "GLY": "G", "HIS": "H",
       "ILE": "I", "LEU": "L", "LYS": "K", "MET": "M", "PHE": "F", "PRO": "P", "SER": "S", "THR": "T", "TRP": "W",
       "TYR": "Y", "VAL": "V", "HID": "H", "HIE": "H", "HIP": "H", "CYX": "C", "ASH": "D", "GLH": "E", "LYN": "K"}


class ProteinError(ValueError):
    """The structure cannot be simulated; the message goes back to the visitor."""


# ---- pure helpers (numpy only) ---------------------------------------------------------------------------------
def kabsch_rmsd(a, b):
    """RMSD (same units as the input) of point set a onto b after the best rotation and translation (Kabsch)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    a0, b0 = a - a.mean(0), b - b.mean(0)
    u, _, vt = np.linalg.svd(a0.T @ b0)
    d = np.sign(np.linalg.det(u @ vt))
    r = u @ np.diag([1, 1, d]) @ vt
    return float(np.sqrt(((a0 @ r - b0) ** 2).sum(1).mean()))


def superpose(a, b):
    """a moved onto b (best rotation and translation)."""
    a, b = np.asarray(a, float), np.asarray(b, float)
    a0, bc = a - a.mean(0), b.mean(0)
    u, _, vt = np.linalg.svd(a0.T @ (b - bc))
    d = np.sign(np.linalg.det(u @ vt))
    return a0 @ (u @ np.diag([1, 1, d]) @ vt) + bc


def radius_of_gyration(x):
    x = np.asarray(x, float)
    return float(np.sqrt(((x - x.mean(0)) ** 2).sum(1).mean()))


def rmsf(frames, ref):
    """Per-point fluctuation about the mean after superposing every frame on ref."""
    fit = np.array([superpose(f, ref) for f in frames])
    return np.sqrt(((fit - fit.mean(0)) ** 2).sum(2).mean(0))


def pdb_atom_line(serial, name, resname, chain, resseq, xyz, element):
    name = f" {name:<3}" if len(name) < 4 else name[:4]
    x, y, z = xyz
    return (f"ATOM  {serial % 100000:>5} {name} {resname:>3} {chain[:1] or 'A'}{resseq % 10000:>4}    "
            f"{x:8.3f}{y:8.3f}{z:8.3f}  1.00  0.00          {element:>2}\n")


def ca_models(residues, frames, times_ps):
    """A multi-model PDB of the Cα atoms: one MODEL per frame. residues: [(resname, chain, resseq)]."""
    out = []
    for k, (f, t) in enumerate(zip(frames, times_ps)):
        out.append(f"MODEL     {k + 1:>4}\nREMARK   t = {t:.1f} ps\n")
        out += [pdb_atom_line(i + 1, "CA", rn, ch, rs, xyz, "C") for i, ((rn, ch, rs), xyz) in enumerate(zip(residues, f))]
        out.append("ENDMDL\n")
    return "".join(out) + "END\n"


def check_request(pdb_id, chains, ps, temperature):
    if not isinstance(pdb_id, str) or not PDB_ID.match(pdb_id):
        raise ProteinError("pdb_id must be a four-character PDB ID such as 1L2Y")
    if chains not in (None, "") and (not isinstance(chains, str) or not CHAINS.match(chains)):
        raise ProteinError("chains must be chain letters such as A or AB")
    if not (isinstance(ps, (int, float)) and 1 <= ps <= PS_MAX):
        raise ProteinError(f"ps must be 1..{PS_MAX}")
    if not (isinstance(temperature, (int, float)) and 250 <= temperature <= 400):
        raise ProteinError("temperature must be 250..400 K")


# ---- the structure ---------------------------------------------------------------------------------------------
def fetch_pdb(pdb_id, timeout=30):
    """The entry's PDB file from RCSB. Large entries have no .pdb file (only mmCIF): they are too big here anyway."""
    req = urllib.request.Request(f"https://files.rcsb.org/download/{pdb_id.upper()}.pdb",
                                 headers={"User-Agent": "molastria-uma-server"})
    try:
        with urllib.request.urlopen(req, timeout=timeout) as r:
            data = r.read(MAX_DOWNLOAD + 1)
    except urllib.error.HTTPError as e:
        raise ProteinError(f"RCSB has no PDB-format file for {pdb_id.upper()} (HTTP {e.code}); "
                           "very large entries are mmCIF only") from None
    except OSError as e:
        raise RuntimeError(f"cannot download {pdb_id.upper()} from RCSB: {e}") from None
    if len(data) > MAX_DOWNLOAD:
        raise ProteinError(f"{pdb_id.upper()} is larger than {MAX_DOWNLOAD // 1048576} MB")
    return data.decode("ascii", errors="replace")


def prepare(text, chains=""):
    """PDBFixer on the first model: keep the chains asked for (all protein chains when none are given), repair,
    hydrogens at pH 7. Returns (topology, positions, notes)."""
    from openmm import app
    from pdbfixer import PDBFixer

    fixer = PDBFixer(pdbfile=io.StringIO(text))
    names = [c.id for c in fixer.topology.chains()]
    protein = [c.id for c in fixer.topology.chains() if any(r.name in AMINO or r.name in ONE for r in c.residues())]
    want = list(dict.fromkeys(chains)) if chains else list(dict.fromkeys(protein))
    unknown = [c for c in want if c not in names]
    if unknown:
        raise ProteinError(f"no chain {', '.join(unknown)} in this entry (chains: {', '.join(dict.fromkeys(names))})")
    if not want:
        raise ProteinError("this entry has no protein chain")
    fixer.removeChains([i for i, c in enumerate(fixer.topology.chains()) if c.id not in want])
    notes = {}
    fixer.findMissingResidues()
    chain_list = list(fixer.topology.chains())
    # build only gaps inside a chain; missing termini are left off (they are usually disordered tails)
    inner = {k: v for k, v in fixer.missingResidues.items() if 0 < k[1] < len(list(chain_list[k[0]].residues()))}
    gap = sum(len(v) for v in inner.values())
    if gap > MAX_GAP:
        raise ProteinError(f"{gap} residues are missing inside the chains (at most {MAX_GAP} can be built)")
    fixer.missingResidues = inner
    notes["built_residues"] = gap
    fixer.findNonstandardResidues()
    notes["replaced"] = [f"{r.name}{r.id}→{s}" for r, s in fixer.nonstandardResidues][:20]
    fixer.replaceNonstandardResidues()
    before = sum(1 for r in fixer.topology.residues() if r.name not in AMINO and r.name not in ONE)
    fixer.removeHeterogens(keepWater=False)
    notes["removed_heterogens"] = before
    fixer.findMissingAtoms()
    notes["built_atoms"] = sum(len(v) for v in fixer.missingAtoms.values()) + sum(len(v) for v in fixer.missingTerminals.values())
    fixer.addMissingAtoms()
    fixer.addMissingHydrogens(7.0)
    top = fixer.topology
    n_res = sum(1 for r in top.residues() if r.name in ONE)
    if n_res > MAX_RESIDUES or top.getNumAtoms() > MAX_ATOMS:
        raise ProteinError(f"{n_res} residues and {top.getNumAtoms()} atoms: at most {MAX_RESIDUES} residues and "
                           f"{MAX_ATOMS} atoms (choose fewer chains)")
    notes["chains"] = "".join(want)
    return top, fixer.positions, notes


def best_platform():
    import openmm as mm

    names = [mm.Platform.getPlatform(i).getName() for i in range(mm.Platform.getNumPlatforms())]
    for n in ("CUDA", "OpenCL", "CPU"):
        if n in names:
            return n
    return "Reference"


class OpenMMBackend:
    def __init__(self, platform=""):
        import openmm
        import pdbfixer  # noqa: F401 - checked here so a missing package shows as "not available"

        self.version = openmm.__version__
        self.platform = platform or best_platform()

    def run(self, pdb_id, chains, ps, temperature, budget, text=None):
        """The whole job. text: the PDB file (tests); otherwise downloaded from RCSB."""
        import openmm as mm
        from openmm import app, unit

        check_request(pdb_id, chains, ps, temperature)
        t0 = time.time()
        text = text if text is not None else fetch_pdb(pdb_id)
        budget.progress(0, 1, "preparing the structure")
        top, pos, notes = prepare(text, chains)
        ff = app.ForceField("amber14-all.xml", "implicit/obc2.xml")
        try:
            system = ff.createSystem(top, nonbondedMethod=app.CutoffNonPeriodic, nonbondedCutoff=2 * unit.nanometer,
                                     constraints=app.HBonds)
        except ValueError as e:
            raise ProteinError(f"the force field cannot describe this structure: {str(e)[:200]}") from None
        integ = mm.LangevinMiddleIntegrator(temperature * unit.kelvin, 1 / unit.picosecond, STEP_FS * unit.femtoseconds)
        integ.setRandomNumberSeed(42)
        platform = mm.Platform.getPlatformByName(self.platform)
        props = {"Precision": "mixed"} if self.platform in ("CUDA", "OpenCL") else {}
        sim = app.Simulation(top, system, integ, platform, props)
        sim.context.setPositions(pos)
        e0 = sim.context.getState(getEnergy=True).getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
        sim.minimizeEnergy(maxIterations=1000)
        e1 = sim.context.getState(getEnergy=True).getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole)
        sim.context.setVelocitiesToTemperature(temperature * unit.kelvin, 42)
        budget.check()

        atoms = list(top.atoms())
        ca = [a.index for a in atoms if a.name == "CA" and a.residue.name in ONE]
        residues = [(atoms[i].residue.name, atoms[i].residue.chain.id, int(atoms[i].residue.id)) for i in ca]
        heavy = [a for a in atoms if a.element is not None and a.element.symbol != "H"]
        dof = 3 * system.getNumParticles() - system.getNumConstraints() - 3  # CMMotionRemover takes 3
        kb = unit.MOLAR_GAS_CONSTANT_R.value_in_unit(unit.kilojoule_per_mole / unit.kelvin)

        def snap():
            st = sim.context.getState(getPositions=True, getEnergy=True)
            x = st.getPositions(asNumpy=True).value_in_unit(unit.angstrom)
            return (x, st.getPotentialEnergy().value_in_unit(unit.kilojoule_per_mole),
                    st.getKineticEnergy().value_in_unit(unit.kilojoule_per_mole))

        x_min, _, _ = snap()
        ref = x_min[ca]
        steps = int(round(ps * 1000 / STEP_FS))
        chunk = max(1, steps // FRAMES)
        frames, series, done, t_md = [], [], 0, time.time()
        while done < steps:
            n = min(chunk, steps - done)
            sim.step(n)
            done += n
            x, epot, ekin = snap()
            frames.append(x[ca])
            series.append({"t_ps": round(done * STEP_FS / 1000, 3), "epot_kj": round(epot, 2),
                           "temperature_k": round(2 * ekin / (dof * kb), 1),
                           "rmsd_a": round(kabsch_rmsd(x[ca], ref), 3), "rg_a": round(radius_of_gyration(x[ca]), 3)})
            budget.progress(done, steps, "MD steps")
        md_seconds = time.time() - t_md
        x_end, _, _ = snap()
        fl = rmsf(frames, ref)
        final = "".join(pdb_atom_line(i + 1, a.name, a.residue.name, a.residue.chain.id, int(a.residue.id), x_end[a.index],
                                      a.element.symbol) for i, a in enumerate(heavy)) + "END\n"
        times = [s["t_ps"] for s in series]
        half = series[len(series) // 2:]
        return {
            "pdb_id": pdb_id.upper(), "chains": notes["chains"], "residues": len(ca), "atoms": top.getNumAtoms(),
            "sequence": "".join(ONE.get(r[0], "X") for r in residues),
            "fixes": {k: notes[k] for k in ("built_residues", "built_atoms", "replaced", "removed_heterogens")},
            "force_field": "Amber ff14SB + GBSA-OBC2 (implicit water)", "platform": self.platform,
            "openmm_version": self.version, "ps": ps, "temperature_k": temperature, "timestep_fs": STEP_FS,
            "energy_start_kj": round(e0, 1), "energy_minimised_kj": round(e1, 1),
            "ns_per_day": round(ps / 1000 / md_seconds * 86400, 1) if md_seconds > 0 else None,
            "series": series,
            "mean_temperature_k": round(sum(s["temperature_k"] for s in half) / len(half), 1),
            "final_rmsd_a": series[-1]["rmsd_a"],
            "rmsf": [{"res": f"{rn}{rs}", "chain": ch, "a": round(float(v), 3)} for (rn, ch, rs), v in zip(residues, fl)],
            "trajectory_pdb": ca_models(residues, frames, times),
            "final_pdb": final,
            "seconds_total": round(time.time() - t0, 1),
        }


def toy_run(pdb_id, chains, ps, temperature, budget):
    """--fake only: made-up numbers with the real shape, no OpenMM. A three-residue 'protein' wobbling."""
    check_request(pdb_id, chains, ps, temperature)
    residues = [("MET", "A", 1), ("GLY", "A", 2), ("LYS", "A", 3)]
    base = np.array([[0.0, 0.0, 0.0], [3.8, 0.0, 0.0], [7.6, 0.0, 0.0]])
    frames, series = [], []
    for k in range(FRAMES):
        t = (k + 1) * ps / FRAMES
        f = base + 0.3 * np.sin(np.arange(9).reshape(3, 3) + k)
        frames.append(f)
        series.append({"t_ps": round(t, 3), "epot_kj": round(-1000 - 5 * math.sin(k), 2), "temperature_k": temperature,
                       "rmsd_a": round(kabsch_rmsd(f, base), 3), "rg_a": round(radius_of_gyration(f), 3)})
        budget.progress(k + 1, FRAMES, "MD steps")
    return {"pdb_id": pdb_id.upper(), "chains": chains or "A", "residues": 3, "atoms": 40, "sequence": "MGK",
            "fixes": {"built_residues": 0, "built_atoms": 0, "replaced": [], "removed_heterogens": 0},
            "force_field": "Amber ff14SB + GBSA-OBC2 (implicit water)", "platform": "fake", "openmm_version": "fake",
            "ps": ps, "temperature_k": temperature, "timestep_fs": STEP_FS, "energy_start_kj": -500.0,
            "energy_minimised_kj": -1000.0, "ns_per_day": 100.0, "series": series, "mean_temperature_k": temperature,
            "final_rmsd_a": series[-1]["rmsd_a"],
            "rmsf": [{"res": f"{r[0]}{r[2]}", "chain": "A", "a": round(float(v), 3)}
                     for r, v in zip(residues, rmsf(frames, base))],
            "trajectory_pdb": ca_models(residues, frames, [s["t_ps"] for s in series]),
            "final_pdb": "".join(pdb_atom_line(i + 1, "CA", r[0], "A", r[2], base[i], "C") for i, r in enumerate(residues)) + "END\n",
            "seconds_total": 0.0}
