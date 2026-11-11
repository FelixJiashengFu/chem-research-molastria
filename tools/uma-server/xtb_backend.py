"""xTB (grimme-lab/xtb, LGPL-3.0) as one more MolAstria online model: the xtb program, called once per energy and
gradient, so every job in chemjobs.py (optimisation, frequencies, conformers, scans, MD, reactions, IP/EA ...) works
with GFN2-xTB, GFN1-xTB and GFN-FF exactly as with the machine-learned models.

Nothing here imports the program: server.py finds the executable (--xtb, MOLASTRIA_XTB, the Python environment,
PATH) and hands it to XtbBackend. test_xtb_backend.py checks the parsers on saved output and, when an xtb executable
is on PATH, a real water molecule.

Units: xtb works in Hartree and bohr; ef() returns eV and eV/Angstrom like every other backend.
"""
import os
import re
import shutil
import subprocess
import sys
import tempfile

import numpy as np

HARTREE_EV = 27.211386245988
BOHR_A = 0.529177210903
# model id -> the xtb command-line flags of that method (and implicit solvent)
METHODS = {
    "gfn2-xtb": ["--gfn", "2"],
    "gfn2-xtb-alpb-water": ["--gfn", "2", "--alpb", "water"],
    "gfn1-xtb": ["--gfn", "1"],
    "gfn-ff": ["--gfnff"],
}
TIMEOUT = 300  # seconds one xtb call may take
THREADS = "4"  # xtb runs on the CPU next to the GPU models; leave the rest of the cores to them


def find_xtb(given=""):
    """The xtb executable: the --xtb argument, MOLASTRIA_XTB, the running Python's environment (conda installs xtb
    into Library/bin on Windows and bin elsewhere), then PATH. "" when there is none."""
    names = ("xtb.exe", "xtb") if os.name == "nt" else ("xtb",)
    for path in (given, os.environ.get("MOLASTRIA_XTB", "")):
        if path and os.path.isfile(path):
            return path
    for folder in (os.path.join(sys.prefix, "Library", "bin"), os.path.join(sys.prefix, "bin"),
                   os.path.join(sys.prefix, "Scripts")):
        for n in names:
            p = os.path.join(folder, n)
            if os.path.isfile(p):
                return p
    return shutil.which("xtb") or ""


def xyz_block(symbols, positions):
    rows = "".join(f"{s} {x:.10f} {y:.10f} {z:.10f}\n" for s, (x, y, z) in zip(symbols, np.asarray(positions, float)))
    return f"{len(symbols)}\nMolAstria\n{rows}"


def parse_gradient(text, n):
    """Energy (Hartree) and gradient (Hartree/bohr, n x 3) from xtb's Turbomole-style "gradient" file: the last
    cycle's energy line, then n coordinate lines and n gradient lines (Fortran D exponents allowed)."""
    lines = [ln for ln in text.replace("\r", "").split("\n") if ln.strip()]
    cycles = [i for i, ln in enumerate(lines) if "cycle" in ln and "energy" in ln.lower()]
    if not cycles:
        raise ValueError("xtb wrote no energy to its gradient file")
    i = cycles[-1]
    m = re.search(r"energy\s*=\s*(-?[\d.]+(?:[EeDd][-+]?\d+)?)", lines[i], re.I)
    if not m:
        raise ValueError("cannot read the energy in the gradient file")
    energy = float(m.group(1).replace("D", "E").replace("d", "e"))
    grad_lines = lines[i + 1 + n:i + 1 + 2 * n]
    if len(grad_lines) != n:
        raise ValueError("the gradient file has fewer lines than atoms")
    grad = np.array([[float(x.replace("D", "E").replace("d", "e")) for x in ln.split()[:3]] for ln in grad_lines])
    return energy, grad


def parse_properties(out):
    """What a single point prints besides the energy: HOMO-LUMO gap (eV), dipole (debye), Mulliken / CM5 charges are
    in the "charges" file instead. Missing items are left out (GFN-FF has no orbitals)."""
    props = {}
    m = re.findall(r"HOMO-LUMO GAP\s+(-?[\d.]+)\s*eV", out)
    if m:
        props["gap_ev"] = float(m[-1])
    # "molecular dipole:" block, the "full:" line: x y z |mu| in debye
    m = re.search(r"molecular dipole:.*?full:\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)\s+(-?[\d.]+)", out, re.S)
    if m:
        props["dipole_debye"] = float(m.group(4))
    orb = re.findall(r"^\s*\d+\s+[\d.]+\s+(-?[\d.]+)\s+(-?[\d.]+)\s+\(HOMO\)\s*$", out, re.M)
    if orb:
        props["homo_ev"] = float(orb[-1][1])
    orb = re.findall(r"^\s*\d+\s+(?:[\d.]+\s+)?(-?[\d.]+)\s+(-?[\d.]+)\s+\(LUMO\)\s*$", out, re.M)
    if orb:
        props["lumo_ev"] = float(orb[-1][1])
    return props


def parse_charges(text, n):
    vals = [float(x) for x in text.split()[:n]]
    return vals if len(vals) == n else None


class XtbBackend:
    """One xtb run per call in a fresh temporary folder (xtb appends to its files, so folders are never reused)."""

    def __init__(self, exe):
        self.exe = exe
        r = subprocess.run([exe, "--version"], capture_output=True, text=True, timeout=60, env=self.env())
        m = re.search(r"version\s+(\d+\.\d+\.\d+)", r.stdout + r.stderr)
        self.version = m.group(1) if m else "unknown"

    @staticmethod
    def env():
        return dict(os.environ, OMP_NUM_THREADS=THREADS, MKL_NUM_THREADS=THREADS, OMP_STACKSIZE="1G")

    def run(self, model, symbols, positions, q, s, extra=()):
        n = len(symbols)
        with tempfile.TemporaryDirectory(prefix="molastria-xtb-") as d:
            with open(os.path.join(d, "in.xyz"), "w", encoding="ascii") as f:
                f.write(xyz_block(symbols, positions))
            cmd = [self.exe, "in.xyz", *METHODS[model], "--chrg", str(int(q)), "--uhf", str(int(s) - 1), *extra]
            r = subprocess.run(cmd, cwd=d, capture_output=True, text=True, timeout=TIMEOUT, env=self.env(),
                               encoding="utf-8", errors="replace")
            out = r.stdout + r.stderr
            if r.returncode != 0 or "normal termination" not in out:
                tail = " ".join(ln.strip() for ln in out.strip().splitlines()[-4:])
                raise RuntimeError(f"xtb failed: {tail[-240:]}")
            files = {}
            for name in ("gradient", "charges"):
                p = os.path.join(d, name)
                if os.path.exists(p):
                    with open(p, encoding="utf-8", errors="replace") as f:
                        files[name] = f.read()
            return out, files, n

    def ef(self, model):
        def ef(symbols, positions, q, s):
            _, files, n = self.run(model, symbols, positions, q, s, ("--grad",))
            if "gradient" not in files:
                raise RuntimeError("xtb wrote no gradient file")
            e, g = parse_gradient(files["gradient"], n)
            return e * HARTREE_EV, -g * HARTREE_EV / BOHR_A

        return ef

    def properties(self, model, symbols, positions, q, s):
        """Single-point extras for the result: gap, frontier orbitals, dipole, atomic charges."""
        out, files, n = self.run(model, symbols, positions, q, s)
        props = parse_properties(out)
        if "charges" in files:
            ch = parse_charges(files["charges"], n)
            if ch:
                props["charges"] = [round(c, 4) for c in ch]
        props["xtb_version"] = self.version
        return props
