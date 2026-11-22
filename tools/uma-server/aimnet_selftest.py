"""Self-test for AIMNet2 before it is offered online (docs/RUNBOOK.md, "加一个在线模型": test the charge states first).

Runs on the owner's computer with the UMA environment's Python (rdkit, ase, the server's own modules) and talks to
aimnet_worker.py in aimnet-env exactly as server.py does:

    python -X utf8 tools/uma-server/aimnet_selftest.py --aimnet-python D:\\ChemDraw\\aimnet-env\\Scripts\\python.exe

Three checks, printed as a table; the exit code is 0 only when checks 1 and 2 pass:

1. The closed-shell model refuses a radical. AIMNet2 (wB97M-D3) reads the charge but not the multiplicity, so a doublet
   would silently come back as the closed-shell state; the worker and server.py must refuse it.
2. Charged closed-shell energetics: gas-phase proton affinities (298 K enthalpies, chemjobs.run_pa with thermo, the
   same code the "pa" job runs) of ammonia, water, methanol and pyridine, and the gas-phase acidity of acetic acid,
   against experiment (NIST Chemistry WebBook, Hunter & Lias 1998 and Bartmess). Pass: every value within 5 kcal/mol.
3. Informational, not part of the verdict: vertical IPs at the ETKDG geometry (benzene / ethanol / water, as measured
   for the other models on 2026-11-05; experiment about 9.2 / 10.5 / 12.6 eV) with the open-shell AIMNet2-NSE model.
   They say whether an "aimnet2-nse" model could later offer IP / EA; the online "aimnet2" does not do them.

--fake replaces the worker with the toy calculator, to check the script itself without any model.
"""
import argparse
import os
import sys
import time

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import chemjobs as cj  # noqa: E402

# (name, SMILES, heavy-atom site, mode, experiment kcal/mol)
PA = [
    ("NH3 -> NH4+", "N", 0, "protonate", 204.0),
    ("H2O -> H3O+", "O", 0, "protonate", 165.2),
    ("CH3OH -> CH3OH2+", "CO", 1, "protonate", 180.3),
    ("pyridine -> pyridinium", "c1ccncc1", 3, "protonate", 222.3),
    ("CH3COOH -> CH3COO- (acidity)", "CC(=O)O", 3, "deprotonate", 348.1),
]
PA_TOL = 5.0  # kcal/mol
IP = [("benzene", "c1ccccc1", 9.2), ("ethanol", "CCO", 10.5), ("water", "O", 12.6)]
IP_TOL = 0.5  # eV


def structure(smiles):
    Chem = cj._rdkit()
    mol_h = Chem.AddHs(Chem.MolFromSmiles(smiles))
    symbols, positions = cj.embed(Chem.Mol(mol_h))
    q, s = cj.species_of(mol_h)
    return cj.Structure(symbols, positions, q, s, smiles, mol_h)


def main():
    ap = argparse.ArgumentParser(description=__doc__.split("\n\n")[0])
    ap.add_argument("--aimnet-python", default=os.environ.get("MOLASTRIA_AIMNET_PYTHON", ""))
    ap.add_argument("--fake", action="store_true", help="the toy calculator instead of AIMNet2 (checks this script only)")
    ap.add_argument("--skip-ip", action="store_true", help="leave out the informational vertical IPs")
    args = ap.parse_args()
    if args.fake:
        def ef_for(model):
            def ef(symbols, positions, q, s):
                if model == "aimnet2" and s != 1:
                    raise RuntimeError("AIMNet2 (wB97M-D3) is a closed-shell model: spin multiplicity 1 only")
                return cj.toy_ef(symbols, positions, q, s)
            return ef
        print("--fake: toy calculator, the numbers mean nothing")
    else:
        if not args.aimnet_python:
            sys.exit("Give --aimnet-python (the python.exe of aimnet-env) or set MOLASTRIA_AIMNET_PYTHON.")
        from server import AimnetBackend

        t = time.time()
        backend = AimnetBackend(args.aimnet_python)
        info = backend.info
        print(f"aimnet {info.get('version')} on {info.get('device')} {info.get('gpu', '')} (worker up in {time.time() - t:.0f} s)")
        ef_for = backend.ef
    ok = True

    # 1. a radical is refused
    water = structure("O")
    try:
        ef_for("aimnet2")(water.symbols, water.positions, 1, 2)
        print("1. FAIL: the closed-shell model computed a doublet cation instead of refusing it")
        ok = False
    except RuntimeError as e:
        print(f"1. ok: a doublet is refused ({e})")

    # 2. proton affinities and an acidity, enthalpies at 298.15 K
    calc = cj.EFCalculator(ef_for("aimnet2"))
    print(f"2. proton affinities / acidity at 298.15 K (kcal/mol), pass within {PA_TOL}:")
    print(f"   {'':32} {'AIMNet2':>8} {'exp.':>7} {'diff':>6}")
    for name, smi, site, mode, exp in PA:
        st = structure(smi)
        partner = cj.pa_partner(st.mol, site, mode)
        r = cj.run_pa(st, partner, calc, cj.Budget(900), smi, site, mode, thermo=True)
        diff = r["enthalpy_kcal"] - exp
        good = abs(diff) <= PA_TOL
        ok = ok and good
        print(f"   {name:32} {r['enthalpy_kcal']:8.1f} {exp:7.1f} {diff:+6.1f}  {'ok' if good else 'FAIL'}")

    # 3. vertical IPs with the open-shell sibling (informational)
    if not args.skip_ip:
        nse = cj.EFCalculator(ef_for("aimnet2-nse"))
        print(f"3. vertical IPs at the ETKDG geometry, AIMNet2-NSE (eV; informational, within {IP_TOL} would allow IP / EA):")
        for name, smi, exp in IP:
            st = structure(smi)
            e0 = cj.new_atoms(st.symbols, st.positions, 0, 1, nse).get_potential_energy()
            e1 = cj.new_atoms(st.symbols, st.positions, 1, 2, nse).get_potential_energy()
            ip = e1 - e0
            print(f"   {name:10} {ip:6.2f} (exp. about {exp}) {'within' if abs(ip - exp) <= IP_TOL else 'outside'}")

    print("verdict: " + ("AIMNet2 may be offered (closed-shell, ions allowed, no IP / EA)." if ok else
                         "do not offer AIMNet2 yet; keep it off (start without --aimnet-python)."))
    return 0 if ok else 1


if __name__ == "__main__":
    sys.exit(main())
