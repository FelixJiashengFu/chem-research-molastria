#!/usr/bin/env python3
"""Reproduce the example numbers in handbook chapters 12-16 (public/atlas/content.js, guides-en.js).

    python3 tools/handbook-calcs.py              # all fast parts (about 2-3 minutes on 4 cores), prints JSON
    python3 tools/handbook-calcs.py ladder jw    # only some parts
    python3 tools/handbook-calcs.py silicon      # chapter 13's silicon band gap (about 20 minutes on 4 cores)

Needs PySCF (pip install pyscf; the chapters quote PySCF 2.15.0). tools/handbook-test.mjs runs the fast parts
when PySCF is installed and compares the results with the numbers printed in the chapters.

Parts:
  ladder    ch. 12  water / 6-31G: HF, MP2, CCSD, CCSD(T), FCI and the T1 diagnostic, at equilibrium and with both O-H doubled
  charges   ch. 14  water / B3LYP: Mulliken, Loewdin and IAO charges on O and the dipole moment in five basis sets
  crawford  ch. 15  water / STO-3G in the geometry of the Crawford programming projects; two definitions of B3LYP
  jw        ch. 16  H2, LiH, H2O / STO-3G mapped to qubits with Jordan-Wigner: Pauli terms, 1-norm, lowest eigenvalue vs FCI
  silicon   ch. 13  PBE band gap of silicon along Gamma-X (GTH pseudopotential, Gaussian basis): gth-dzvp with 4x4x4 and
                    6x6x6 k-points, gth-tzv2p with 4x4x4, so both the k-point and the basis-set change can be read off
"""
import itertools
import json
import sys

import numpy as np

HARTREE_EV = 27.211386245988


def water(r=0.9572, angle=104.52):
    th = np.deg2rad(angle) / 2
    return f'O 0 0 0; H 0 {r * np.sin(th):.6f} {r * np.cos(th):.6f}; H 0 {-r * np.sin(th):.6f} {r * np.cos(th):.6f}'


def ladder():
    from pyscf import gto, scf, mp, cc, fci
    out = {}
    for name, r in [('eq', 0.9572), ('stretched', 2 * 0.9572)]:
        mol = gto.M(atom=water(r), basis='6-31g', verbose=0)
        mf = scf.RHF(mol).run(conv_tol=1e-11)
        e_mp2 = mp.MP2(mf).run().e_tot
        mycc = cc.CCSD(mf)
        mycc.conv_tol = 1e-10
        mycc.run()
        e_t = mycc.ccsd_t()
        e_fci = fci.FCI(mf).kernel()[0]
        t1 = float(np.sqrt(2 * np.sum(mycc.t1 ** 2) / mol.nelectron))
        out[name] = dict(r=r, nao=mol.nao, hf=mf.e_tot, mp2=e_mp2, ccsd=mycc.e_tot, ccsdt=mycc.e_tot + e_t, fci=e_fci, t1=t1)
    return out


def charges():
    from pyscf import gto, dft
    from pyscf.lo import iao, orth
    rows = []
    for basis in ['sto-3g', 'def2-svp', 'def2-tzvp', 'aug-cc-pvtz', 'aug-cc-pvqz']:
        mol = gto.M(atom=water(), basis=basis, verbose=0)
        mf = dft.RKS(mol)
        mf.xc = 'b3lyp'  # PySCF >= 2.3: the VWN-RPA definition, same as Gaussian
        mf.conv_tol = 1e-10
        mf.kernel()
        dm = mf.make_rdm1()
        S = mol.intor('int1e_ovlp')
        labels = [lab[0] for lab in mol.ao_labels(fmt=False)]
        mulliken = mf.mulliken_pop(verbose=0)[1]
        s_half = np.linalg.inv(orth.lowdin(S))  # orth.lowdin(S) is S^-1/2
        pop = np.einsum('ij,jk,ki->i', s_half, dm, s_half)
        lowdin = [mol.atom_charge(a) - pop[[i for i, k in enumerate(labels) if k == a]].sum() for a in range(mol.natm)]
        c_occ = mf.mo_coeff[:, mf.mo_occ > 0]
        a = iao.iao(mol, c_occ)
        a = a @ orth.lowdin(a.T @ S @ a)
        pmol = iao.reference_mol(mol)
        plabels = [lab[0] for lab in pmol.ao_labels(fmt=False)]
        pop_iao = np.diag(a.T @ S @ dm @ S @ a)
        iao_q = [pmol.atom_charge(k) - pop_iao[[i for i, j in enumerate(plabels) if j == k]].sum() for k in range(pmol.natm)]
        rows.append(dict(basis=basis, nao=mol.nao, mulliken_O=float(mulliken[0]), lowdin_O=float(lowdin[0]), iao_O=float(iao_q[0]),
                         dipole_D=float(np.linalg.norm(mf.dip_moment(verbose=0)))))
    return rows


def crawford():
    from pyscf import gto, scf, mp, dft
    geom = 'O 0 -0.143225816552 0; H 1.638036840407 1.136548822547 0; H -1.638036840407 1.136548822547 0'  # bohr, Project #3
    mol = gto.M(atom=geom, unit='Bohr', basis='sto-3g', verbose=0)
    mf = scf.RHF(mol).run(conv_tol=1e-12)
    out = dict(e_scf=mf.e_tot, e_mp2_corr=mp.MP2(mf).kernel()[0])
    big = gto.M(atom=geom, unit='Bohr', basis='def2-tzvp', verbose=0)
    for key, xc in [('b3lyp_vwnrpa', 'b3lyp'), ('b3lyp_vwn5', 'b3lyp5')]:
        ks = dft.RKS(big)
        ks.xc = xc
        ks.conv_tol = 1e-11
        out[key] = ks.kernel()
    out['b3lyp_diff_mEh'] = (out['b3lyp_vwnrpa'] - out['b3lyp_vwn5']) * 1000
    return out


# Jordan-Wigner with Pauli strings as tuples of 'I', 'X', 'Y', 'Z' (qubit p = spin orbital p).
PAULI = {('I', 'I'): (1, 'I'), ('I', 'X'): (1, 'X'), ('I', 'Y'): (1, 'Y'), ('I', 'Z'): (1, 'Z'),
         ('X', 'I'): (1, 'X'), ('Y', 'I'): (1, 'Y'), ('Z', 'I'): (1, 'Z'),
         ('X', 'X'): (1, 'I'), ('Y', 'Y'): (1, 'I'), ('Z', 'Z'): (1, 'I'),
         ('X', 'Y'): (1j, 'Z'), ('Y', 'X'): (-1j, 'Z'), ('Y', 'Z'): (1j, 'X'),
         ('Z', 'Y'): (-1j, 'X'), ('Z', 'X'): (1j, 'Y'), ('X', 'Z'): (-1j, 'Y')}


def _op_mul(A, B):
    out = {}
    for pa, ca in A.items():
        for pb, cb in B.items():
            phase, s = 1, []
            for x, y in zip(pa, pb):
                f, c = PAULI[(x, y)]
                phase *= f
                s.append(c)
            s = tuple(s)
            out[s] = out.get(s, 0) + phase * ca * cb
    return out


def _ladder_op(p, n, dagger):
    head, tail = ('Z',) * p, ('I',) * (n - p - 1)
    return {head + ('X',) + tail: 0.5, head + ('Y',) + tail: (-0.5j if dagger else 0.5j)}


def jordan_wigner(mol):
    """Qubit Hamiltonian of an RHF molecule: dict Pauli string -> coefficient, plus the RHF object."""
    from pyscf import scf, ao2mo
    mf = scf.RHF(mol).run(conv_tol=1e-11)
    C = mf.mo_coeff
    nmo = C.shape[1]
    h = C.T @ mf.get_hcore() @ C
    eri = ao2mo.restore(1, ao2mo.kernel(mol, C), nmo)  # chemists' (pq|rs)
    n = 2 * nmo
    H = {('I',) * n: mol.energy_nuc()}
    cr = [_ladder_op(p, n, True) for p in range(n)]
    an = [_ladder_op(p, n, False) for p in range(n)]

    def add(T, c):
        for s, v in T.items():
            H[s] = H.get(s, 0) + c * v

    for p, q in itertools.product(range(n), repeat=2):  # sum_pq h_pq a+_p a_q
        if p % 2 == q % 2 and abs(h[p // 2, q // 2]) > 1e-12:
            add(_op_mul(cr[p], an[q]), h[p // 2, q // 2])
    cc_pairs = {(p, q): _op_mul(cr[p], cr[q]) for p, q in itertools.product(range(n), repeat=2) if p != q}
    aa_pairs = {(s, r): _op_mul(an[s], an[r]) for s, r in itertools.product(range(n), repeat=2) if s != r}
    for p, q, r, s in itertools.product(range(n), repeat=4):  # 1/2 sum <pq|rs> a+_p a+_q a_s a_r, <pq|rs> = (pr|qs)
        if p == q or r == s or p % 2 != r % 2 or q % 2 != s % 2:
            continue
        v = eri[p // 2, r // 2, q // 2, s // 2]
        if abs(v) > 1e-12:
            add(_op_mul(cc_pairs[(p, q)], aa_pairs[(s, r)]), 0.5 * v)
    return {k: v for k, v in H.items() if abs(v) > 1e-10}, mf


def _to_matrix(H, n):
    P = {'I': np.eye(2), 'X': np.array([[0, 1], [1, 0]]), 'Y': np.array([[0, -1j], [1j, 0]]), 'Z': np.diag([1, -1])}
    M = np.zeros((2 ** n, 2 ** n), complex)
    for s, c in H.items():
        m = np.array([[1.0]])
        for ch in s:
            m = np.kron(m, P[ch])
        M += c * m
    return M


def jw():
    from pyscf import gto, fci
    out = {}
    for name, atom in [('H2', 'H 0 0 0; H 0 0 0.74'), ('LiH', 'Li 0 0 0; H 0 0 1.5949'), ('H2O', water())]:
        mol = gto.M(atom=atom, basis='sto-3g', verbose=0)
        H, mf = jordan_wigner(mol)
        n = 2 * mf.mo_coeff.shape[1]
        row = dict(qubits=n, pauli_terms=len(H), lam=float(sum(abs(v) for k, v in H.items() if set(k) != {'I'})), hf=mf.e_tot)
        if n <= 12:
            # Lowest eigenvalue over the whole Fock space; for these neutral molecules it is the N-electron ground state.
            row['fci'] = float(fci.FCI(mf).kernel()[0])
            row['lowest_eig'] = float(np.linalg.eigvalsh(_to_matrix(H, n))[0])
        out[name] = row
    return out


def silicon(basis='gth-dzvp', nk=6):
    from pyscf.pbc import gto, dft
    a = 5.431
    cell = gto.Cell()
    cell.atom = f'Si 0 0 0; Si {a / 4} {a / 4} {a / 4}'
    cell.a = np.array([[0, a / 2, a / 2], [a / 2, 0, a / 2], [a / 2, a / 2, 0]])
    cell.basis, cell.pseudo, cell.verbose = basis, 'gth-pbe', 0
    cell.build()
    mf = dft.KRKS(cell, cell.make_kpts([nk] * 3)).density_fit()
    mf.xc, mf.conv_tol = 'pbe', 1e-9
    mf.kernel()
    b = cell.reciprocal_vectors()  # bohr^-1
    X = 0.5 * (b[0] + b[1])  # = 2 pi / a (0, 0, 1)
    s = np.linspace(0, 1, 21)
    e = np.array(mf.get_bands(np.array([x * X for x in s]))[0]) * HARTREE_EV
    nocc = cell.nelectron // 2
    vbm = e[:, nocc - 1].max()
    cb = e[:, nocc] - vbm
    return dict(basis=basis, kmesh=nk, indirect_gap_eV=float(cb.min()), cbm_fraction_GX=float(s[cb.argmin()]), direct_gap_Gamma_eV=float(cb[0]))


PARTS = {'ladder': ladder, 'charges': charges, 'crawford': crawford, 'jw': jw}

if __name__ == '__main__':
    names = sys.argv[1:] or list(PARTS)
    result = {}
    for name in names:
        if name == 'silicon':
            result['silicon'] = [silicon('gth-dzvp', 4), silicon('gth-dzvp', 6), silicon('gth-tzv2p', 4)]
        else:
            result[name] = PARTS[name]()
    print(json.dumps(result, indent=1))
