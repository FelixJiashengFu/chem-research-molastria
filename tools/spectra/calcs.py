#!/usr/bin/env python3
"""Spectra Hall (public/spectra/): the computed spectra, done with PySCF.

For each molecule: RDKit builds a start geometry, B3LYP optimises it, and a numerical Hessian (central differences of
analytic gradients along a first set of modes, see refined_modes) gives harmonic frequencies and normal modes. The dipole and polarisability derivatives come from analytic gradients in a
small uniform electric field F (finite field: dmu/dR = -dg/dF, dalpha/dR = -d2g/dF2), projected on the modes:
  - the dipole derivative  -> infrared intensity (km/mol)
  - the polarisability derivative -> Raman activity (A^4/amu) and depolarisation ratio.
TDDFT (B3LYP and CAM-B3LYP) gives vertical singlet excitations for the UV-visible examples.

One JSON per molecule goes to tools/spectra/calc/ ; tools/spectra/build.mjs turns them into public/spectra/sp-computed.js.

  python tools/spectra/calcs.py vib            # all vibrational molecules that have no JSON yet
  python tools/spectra/calcs.py vib water co2  # only these
  python tools/spectra/calcs.py uv
Needs: pyscf >= 2.5, pyscf-properties, geometric, rdkit, numpy.  Takes about three hours on 4 cores.
"""
import json, os, sys, time, warnings
import numpy as np
warnings.filterwarnings('ignore')
from pyscf import gto, dft, lib
from pyscf.hessian import thermo

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'calc')
os.makedirs(OUT, exist_ok=True)

BOHR = 0.529177210903
AU_DIPOLE_DEBYE = 2.541746473
AU_POL_A3 = BOHR ** 3
IR_KM_MOL = 42.2561          # km/mol per (D/A)^2/amu
UNITS = {'freq': 'cm-1', 'ir': 'km/mol', 'raman': 'A^4/amu', 'redmass': 'amu'}

# id: (SMILES, basis, raman?)
VIB = {
    'h2':        ('[H][H]', 'def2-tzvpd', True),
    'n2':        ('N#N', 'def2-tzvpd', True),
    'o2':        (None, 'def2-tzvpd', True),      # triplet, built by hand below
    'co':        ('[C-]#[O+]', 'def2-tzvpd', True),
    'hcl':       ('Cl', 'def2-tzvpd', True),
    'water':     ('O', 'def2-tzvpd', True),
    'co2':       ('O=C=O', 'def2-tzvpd', True),
    'ammonia':   ('N', 'def2-tzvpd', True),
    'methane':   ('C', 'def2-tzvpd', True),
    'acetylene': ('C#C', 'def2-tzvpd', True),
    'ethylene':  ('C=C', 'def2-tzvpd', True),
    'formaldehyde': ('C=O', 'def2-tzvpd', True),
    'methanol':  ('CO', 'def2-tzvpd', True),
    'acetonitrile': ('CC#N', 'def2-tzvpd', True),
    'ccl4':      ('ClC(Cl)(Cl)Cl', 'def2-tzvpd', True),
    'chloroform': ('ClC(Cl)Cl', 'def2-tzvpd', True),
    'dcm':       ('ClCCl', 'def2-tzvpd', True),
    'ethanol':   ('CCO', 'def2-svpd', True),
    'acetone':   ('CC(C)=O', 'def2-svpd', True),
    'aceticacid': ('CC(O)=O', 'def2-svpd', True),
    'acetaldehyde': ('CC=O', 'def2-tzvpd', True),
    'benzene':   ('c1ccccc1', 'def2-svpd', True),
    'toluene':   ('Cc1ccccc1', 'def2-svpd', True),
    'ethylacetate': ('CCOC(C)=O', 'def2-svpd', True),
    'phenol':    ('Oc1ccccc1', 'def2-svpd', True),
    'benzaldehyde': ('O=Cc1ccccc1', 'def2-svpd', True),
    'acetamide': ('CC(N)=O', 'def2-svpd', True),
    'caffeine':  ('Cn1cnc2c1c(=O)n(C)c(=O)n2C', 'def2-svp', False),
}
UV = {
    'ethylene':  'C=C', 'butadiene': 'C=CC=C', 'hexatriene': 'C=C/C=C/C=C', 'octatetraene': 'C=C/C=C/C=C/C=C',
    'benzene': 'c1ccccc1', 'naphthalene': 'c1ccc2ccccc2c1', 'anthracene': 'c1ccc2cc3ccccc3cc2c1',
    'formaldehyde': 'C=O', 'acetone': 'CC(C)=O', 'pyridine': 'c1ccncc1', 'pna': 'Nc1ccc(cc1)[N+](=O)[O-]',
    'azobenzene': 'c1ccccc1/N=N/c1ccccc1', 'caffeine': 'Cn1cnc2c1c(=O)n(C)c(=O)n2C',
}

def start_geometry(smiles):
    from rdkit import Chem
    from rdkit.Chem import AllChem
    m = Chem.AddHs(Chem.MolFromSmiles(smiles))
    if m.GetNumAtoms() == 2:
        return [(m.GetAtomWithIdx(0).GetSymbol(), (0, 0, 0)), (m.GetAtomWithIdx(1).GetSymbol(), (0, 0, 1.1))]
    AllChem.EmbedMolecule(m, randomSeed=7)
    try: AllChem.MMFFOptimizeMolecule(m, maxIters=2000)
    except Exception: pass
    c = m.GetConformer()
    return [(a.GetSymbol(), tuple(c.GetAtomPosition(a.GetIdx()))) for a in m.GetAtoms()]

def make_mf(atoms, basis, spin=0, xc='b3lyp'):
    mol = gto.M(atom=atoms, basis=basis, unit='Angstrom', spin=spin, verbose=0)
    mf = (dft.UKS(mol) if spin else dft.RKS(mol)).density_fit()
    mf.xc = xc
    mf.grids.atom_grid = (75, 302)
    mf.conv_tol = 1e-10
    mf.max_cycle = 200
    return mol, mf

def optimise(atoms, basis, spin=0, pre=True):
    from pyscf.geomopt.geometric_solver import optimize
    params = {'convergence_energy': 1e-7, 'convergence_grms': 1e-5, 'convergence_gmax': 3e-5, 'convergence_drms': 4e-4, 'convergence_dmax': 6e-4}
    for b in (['def2-svp'] if len(atoms) > 6 and pre and basis != 'def2-svp' else []) + [basis]:   # a cheap first pass for the larger ones
        mol, mf = make_mf(atoms, b, spin)
        eq = optimize(mf, maxsteps=200, **params)
        atoms = [(eq.atom_symbol(i), tuple(eq.atom_coords(unit='Angstrom')[i])) for i in range(eq.natm)]
    return atoms

def polarisability(mf):
    if mf.mol.spin:
        from pyscf.prop.polarizability.uks import Polarizability
    else:
        from pyscf.prop.polarizability.rks import Polarizability
    return np.asarray(Polarizability(mf).polarizability()) * AU_POL_A3

HARTREE_J, AMU_KG, C_CM = 4.3597447222071e-18, 1.66053906660e-27, 2.99792458e10
WAVENUMBER = (HARTREE_J / (1e-20 * AMU_KG)) ** 0.5 / (2 * np.pi * C_CM)   # cm-1 per sqrt(Hartree A^-2 amu^-1)
STEP_Q = 0.01        # A amu^1/2: displacement along each mode for the numerical Hessian

def refined_modes(mol, mf, basis, spin):
    """Harmonic frequencies and normal modes from a numerical Hessian.

    PySCF's analytic DFT Hessian leaves out the response of the integration grid. For bending modes of heavy atoms
    that error is large and does not go away with a finer grid (dichloromethane, CCl2 scissor: 401 cm-1 on a (75,302)
    grid, 273 on (99,590), 152 on the default grid; energy differences give 282, experiment is 282). So the analytic
    Hessian is used only for a first set of modes; the Hessian is then rebuilt in that basis by central differences of
    analytic gradients (which do include the grid response) and diagonalised again."""
    hess = mf.Hessian().kernel()
    res = thermo.harmonic_analysis(mol, hess, imaginary_freq=False)
    modes = np.asarray(res['norm_mode'])            # (nmode, natm, 3): dx/dQ, mass-weighted orthonormal
    first = np.asarray(res['freq_wavenumber']).real
    coords = mol.atom_coords(unit='Angstrom')
    syms = [mol.atom_symbol(i) for i in range(mol.natm)]
    dm0 = mf.make_rdm1()
    def grad(xyz):
        _, m2 = make_mf([(s, tuple(x)) for s, x in zip(syms, xyz)], basis, spin)
        m2.kernel(dm0=dm0)
        assert m2.converged
        g = m2.nuc_grad_method(); g.verbose = 0; g.grid_response = True
        return np.asarray(g.kernel()) / BOHR        # Hartree / A
    n = len(modes)
    hq = np.zeros((n, n))
    for k in range(n):
        dg = (grad(coords + STEP_Q * modes[k]) - grad(coords - STEP_Q * modes[k])) / (2 * STEP_Q)
        hq[k] = np.einsum('ax,lax->l', dg, modes)   # Hartree A^-2 amu^-1
    asym = float(np.abs(hq - hq.T).max())
    w, u = np.linalg.eigh((hq + hq.T) / 2)
    freqs = np.sign(w) * np.sqrt(np.abs(w)) * WAVENUMBER
    new = np.einsum('kj,kax->jax', u, modes)
    redm = 1.0 / np.einsum('jax,jax->j', new, new)
    return freqs, new, redm, first, asym

FIELD = 0.004        # a.u. (about 2e9 V/m)
FAR = 400.0          # bohr: where the two point charges that make the field sit

def field_gradient(atoms, basis, spin, fvec, dm0=None):
    """Analytic gradient (Hartree/bohr) in a uniform field fvec * FIELD, made by distant point charges."""
    from pyscf import qmmm
    mol, mf = make_mf(atoms, basis, spin)
    mf.conv_tol = 1e-11
    centre = mol.atom_coords().mean(axis=0)
    q = FIELD * FAR * FAR / 2
    pts, chg = [], []
    for i in range(3):
        if fvec[i]:
            e = np.zeros(3); e[i] = 1.0
            pts += [centre - FAR * e, centre + FAR * e]; chg += [fvec[i] * q, -fvec[i] * q]   # field 2q/FAR^2 along +e
    if pts: mf = qmmm.mm_charge(mf, np.array(pts), np.array(chg), unit='Bohr')
    mf.kernel(dm0=dm0)
    assert mf.converged
    g = mf.nuc_grad_method(); g.verbose = 0
    return np.asarray(g.kernel()), mf

def vib(name):
    smiles, basis, raman = VIB[name]
    t0 = time.time()
    spin = 2 if name == 'o2' else 0
    atoms = [('O', (0, 0, 0)), ('O', (0, 0, 1.21))] if name == 'o2' else start_geometry(smiles)
    atoms = optimise(atoms, basis, spin)
    mol, mf = make_mf(atoms, basis, spin)
    e = mf.kernel()
    assert mf.converged
    freqs, modes, redm, first, asym = refined_modes(mol, mf, basis, spin)   # modes: (nmode, natm, 3), dx/dQ (|mode|^2 = 1/reduced mass)
    coords = mol.atom_coords(unit='Angstrom')
    syms = [mol.atom_symbol(i) for i in range(mol.natm)]
    dm0 = mf.make_rdm1()
    ax = np.eye(3)
    g0, _ = field_gradient(atoms, basis, spin, (0, 0, 0), dm0)
    gp = [field_gradient(atoms, basis, spin, ax[i], dm0)[0] for i in range(3)]
    gm = [field_gradient(atoms, basis, spin, -ax[i], dm0)[0] for i in range(3)]
    dmu = np.array([-(gp[i] - gm[i]) / (2 * FIELD) for i in range(3)])            # d mu_i / d R, a.u. (e)
    dmu *= AU_DIPOLE_DEBYE / BOHR                                                 # -> D / A
    dal = None
    if raman:
        dal = np.zeros((3, 3) + g0.shape)
        for i in range(3):
            dal[i, i] = -(gp[i] + gm[i] - 2 * g0) / FIELD ** 2
        for i, j in ((0, 1), (0, 2), (1, 2)):
            gpp = field_gradient(atoms, basis, spin, ax[i] + ax[j], dm0)[0]
            gmm = field_gradient(atoms, basis, spin, -ax[i] - ax[j], dm0)[0]
            dal[i, j] = dal[j, i] = -(gpp + gmm - gp[i] - gm[i] - gp[j] - gm[j] + 2 * g0) / (2 * FIELD ** 2)
        dal *= BOHR ** 2                                                         # -> A^2
    out = []
    for k, f in enumerate(freqs):
        d = np.einsum('iax,ax->i', dmu, modes[k])                         # D A^-1 amu^-1/2
        rec = {'freq': round(float(f), 2), 'ir': round(float(IR_KM_MOL * d @ d), 4), 'redmass': round(float(redm[k]), 4)}
        if raman:
            da = np.einsum('ijax,ax->ij', dal, modes[k])                  # A^2 amu^-1/2
            a = np.trace(da) / 3
            g2 = 0.5 * ((da[0, 0] - da[1, 1]) ** 2 + (da[1, 1] - da[2, 2]) ** 2 + (da[2, 2] - da[0, 0]) ** 2
                        + 6 * (da[0, 1] ** 2 + da[0, 2] ** 2 + da[1, 2] ** 2))
            act = 45 * a * a + 7 * g2
            rec['raman'] = round(float(act), 4)
            rec['depol'] = round(float(3 * g2 / (45 * a * a + 4 * g2)), 4) if act > 1e-9 else None
        out.append(rec)
    dip0 = np.asarray(mf.dip_moment(unit='Debye', verbose=0))
    data = {'id': name, 'smiles': smiles, 'method': 'B3LYP', 'basis': basis, 'program': 'PySCF ' + __import__('pyscf').__version__,
            'energy': round(float(e), 8), 'dipole': round(float(np.linalg.norm(dip0)), 4),
            'alpha_iso': round(float(np.trace(polarisability(mf)) / 3), 4) if raman else None,
            'geometry': [[s, *[round(float(v), 5) for v in x]] for s, x in zip(syms, coords)],
            'deriv': 'field', 'hessian': 'numerical', 'analytic_freq': [round(float(v), 1) for v in first], 'hessian_asymmetry': asym, 'units': UNITS, 'modes': out, 'seconds': round(time.time() - t0)}
    json.dump(data, open(os.path.join(OUT, f'vib-{name}.json'), 'w'), indent=1)
    print(f'vib {name}: {len(out)} modes, {data["seconds"]} s', flush=True)

def uv(name):
    t0 = time.time()
    basis = 'def2-tzvp'
    gbasis = 'def2-svp' if len(start_geometry(UV[name])) > 12 else basis      # geometry: SVP for the larger ones
    atoms = optimise(start_geometry(UV[name]), gbasis, pre=False)
    res = {}
    for xc in ('b3lyp', 'cam-b3lyp'):
        mol, mf = make_mf(atoms, basis, xc=xc)
        mf.kernel(); assert mf.converged
        td = mf.TDDFT(); td.nstates = 8
        td.kernel()
        fosc = td.oscillator_strength(gauge='length')
        res[xc] = [{'ev': round(float(e * 27.211386245988), 4), 'f': round(float(f), 5), 'conv': bool(c)} for e, f, c in zip(td.e, fosc, td.converged)]
    data = {'id': name, 'smiles': UV[name], 'basis': basis, 'geometry_method': 'B3LYP/' + gbasis, 'program': 'PySCF ' + __import__('pyscf').__version__,
            'geometry': [[s, *[round(float(v), 5) for v in x]] for s, x in atoms], 'states': res, 'seconds': round(time.time() - t0)}
    json.dump(data, open(os.path.join(OUT, f'uv-{name}.json'), 'w'), indent=1)
    print(f'uv {name}: {data["seconds"]} s', flush=True)

if __name__ == '__main__':
    lib.num_threads(int(os.environ.get('OMP_NUM_THREADS', '4')))
    kind = sys.argv[1] if len(sys.argv) > 1 else 'vib'
    names = sys.argv[2:] or list(VIB if kind == 'vib' else UV)
    for n in names:
        if os.path.exists(os.path.join(OUT, f'{kind}-{n}.json')) and len(sys.argv) <= 2: continue
        try:
            (vib if kind == 'vib' else uv)(n)
        except Exception as ex:
            print(f'FAILED {kind} {n}: {ex!r}', flush=True)
