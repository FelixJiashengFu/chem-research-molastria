"""Sample files for the workbench page (public/workbench/samples/), so every tab can be tried without
one's own output files.
- formaldehyde.molden: B3LYP/def2-SVP orbitals written by PySCF (for the orbital, density and level-diagram tools).
- water-dimer.molden: B3LYP/def2-SVP, S22 geometry (for IGMH on the real density).
- dvb-*.out: real Gaussian 16 and ORCA 5 outputs of divinylbenzene copied unchanged from cclib's regression data
  (https://github.com/cclib/cclib, BSD-3-Clause, copyright the cclib development team; see NOTICE.txt).
Run: python tools/workbench/samples.py /path/to/cclib   (the cclib path is only needed for the dvb files)."""
import sys, shutil, pathlib
from pyscf import gto, dft
from pyscf.tools import molden

out = pathlib.Path(__file__).resolve().parents[2] / "public" / "workbench" / "samples"
out.mkdir(parents=True, exist_ok=True)
mol = gto.M(atom="C 0 0 -0.5265; O 0 0 0.6795; H 0 0.9374 -1.1135; H 0 -0.9374 -1.1135", basis="def2-svp", verbose=0)
mf = dft.RKS(mol, xc="b3lyp").run()
molden.from_scf(mf, str(out / "formaldehyde.molden"))
print("formaldehyde", mol.nao, mf.e_tot)
# water dimer (S22 geometry, same as the page's example) for IGMH on the real density
w2 = """O -1.551007 -0.114520 0.000000; H -1.934259 0.762503 0.000000; H -0.599677 0.040712 0.000000;
O 1.350625 0.111469 0.000000; H 1.680398 -0.373741 -0.758561; H 1.680398 -0.373741 0.758561"""
mol = gto.M(atom=w2, basis="def2-svp", verbose=0)
mf = dft.RKS(mol, xc="b3lyp").run()
molden.from_scf(mf, str(out / "water-dimer.molden"))
print("water dimer", mol.nao, mf.e_tot)

if len(sys.argv) > 1:
    src = pathlib.Path(sys.argv[1]) / "data"
    files = {
        "dvb-raman-g16.out": "Gaussian/basicGaussian16/dvb_raman.out",
        "dvb-td-g16.out": "Gaussian/basicGaussian16/dvb_td.out",
        "dvb-opt-g16.out": "Gaussian/basicGaussian16/dvb_gopt.out",
        "dvb-raman-orca5.out": "ORCA/basicORCA5.0/dvb_raman.out",
    }
    for dst, rel in files.items():
        shutil.copyfile(src / rel, out / dst)
    shutil.copyfile(pathlib.Path(sys.argv[1]) / "LICENSE", out / "cclib-LICENSE.txt")
    print("copied", list(files))
