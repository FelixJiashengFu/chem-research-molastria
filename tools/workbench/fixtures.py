"""Reference data for tools/workbench-test.mjs: Molden files written by PySCF and the exact values of
orbitals, density and its gradient and Hessian at fixed points (PySCF eval_gto), so the browser's Molden reader and Gaussian-basis
evaluator can be checked number for number. Run: python tools/workbench/fixtures.py
Also writes a small cube file (density of water on a coarse grid) to test the cube reader."""
import json, pathlib
import numpy as np
from pyscf import gto, scf
from pyscf.tools import molden, cubegen

here = pathlib.Path(__file__).resolve().parent / "fixtures"
here.mkdir(exist_ok=True)
rng = np.random.default_rng(7)
water = "O 0 0 0.1173; H 0 0.7572 -0.4692; H 0 -0.7572 -0.4692"
cases = [
    ("water-tz", dict(atom=water, basis="cc-pvtz"), False),
    ("water-tz-cart", dict(atom=water, basis="cc-pvtz", cart=True), False),
    ("ne-qz", dict(atom="Ne 0 0 0", basis="cc-pvqz"), False),
    ("oh-radical", dict(atom="O 0 0 0; H 0 0 0.97", basis="def2-svp", spin=1), True),
]
out = {}
for name, kw, uhf in cases:
    mol = gto.M(verbose=0, **kw)
    mf = (scf.UHF(mol) if uhf else scf.RHF(mol)).run()
    path = here / f"{name}.molden"
    molden.from_scf(mf, str(path))
    pts = rng.uniform(-2.5, 2.5, size=(12, 3))  # bohr
    ao = mol.eval_gto("GTOval", pts)  # cart=True molecules evaluate Cartesian functions here
    if uhf:
        ca, cb = mf.mo_coeff
        na, nb = mol.nelec
        rho = np.einsum("pi,pi->p", ao @ ca[:, :na], ao @ ca[:, :na]) + np.einsum("pi,pi->p", ao @ cb[:, :nb], ao @ cb[:, :nb])
        homo = int(na - 1)
        mo = (ao @ ca[:, homo]).tolist()
        e_homo = float(mf.mo_energy[0][homo])
    else:
        nocc = mol.nelectron // 2
        rho = 2 * np.einsum("pi,pi->p", ao @ mf.mo_coeff[:, :nocc], ao @ mf.mo_coeff[:, :nocc])
        homo = nocc - 1
        mo = (ao @ mf.mo_coeff[:, homo]).tolist()
        e_homo = float(mf.mo_energy[homo])
    # gradient and Hessian of rho from the density matrix (checks the derivatives used for IGMH and sign(lambda2)rho)
    dm = mf.make_rdm1()
    dm = dm[0] + dm[1] if uhf else dm
    d2 = mol.eval_gto("GTOval_cart_deriv2" if mol.cart else "GTOval_sph_deriv2", pts)  # value, x, y, z, xx, xy, xz, yy, yz, zz
    v = d2[0]
    grad = [2 * np.einsum("pi,ij,pj->p", d2[k], dm, v) for k in (1, 2, 3)]
    pair = {"xx": (4, 1, 1), "yy": (7, 2, 2), "zz": (9, 3, 3), "xy": (5, 1, 2), "xz": (6, 1, 3), "yz": (8, 2, 3)}
    hess = {k: (2 * np.einsum("pi,ij,pj->p", d2[a], dm, v) + 2 * np.einsum("pi,ij,pj->p", d2[b], dm, d2[c])).tolist() for k, (a, b, c) in pair.items()}
    out[name] = {"molden": path.name, "points_bohr": pts.tolist(), "rho": rho.tolist(), "homo_index": homo, "homo": mo,
                 "homo_energy": e_homo, "nelec": int(mol.nelectron), "nbas": int(mol.nao), "e_tot": float(mf.e_tot),
                 "grad": np.array(grad).T.tolist(), "hess": hess}
    if name == "water-tz":
        cubegen.density(mol, str(here / "water-density.cube"), mf.make_rdm1(), nx=24, ny=24, nz=24)
        out[name]["cube"] = "water-density.cube"
(here / "reference.json").write_text(json.dumps(out, indent=1))
print({k: (v["nbas"], v["e_tot"]) for k, v in out.items()})
