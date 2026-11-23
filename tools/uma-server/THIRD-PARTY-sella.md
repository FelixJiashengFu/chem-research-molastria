# Sella

The online-model server's transition-state jobs (`tsjobs.py`: `ts` and `neb`) use
[Sella](https://github.com/zadorlab/sella) by Eric Hermes, Daniel Levine and contributors (Sandia National
Laboratories, Zádor group) for the saddle-point search and the intrinsic reaction coordinate.

Sella is licensed under the GNU Lesser General Public License, version 3 (LGPL-3.0). MolAstria uses it only as an
unmodified library: the owner's computer installs the released package (`pip install sella==2.6.0`) and `tsjobs.py`
imports `sella.Sella` and `sella.IRC` at run time. No Sella source code is copied into this repository, nothing of
Sella is redistributed with the website or the desktop app, and the package can be replaced by any other version
with the same interface. The licence text is in the installed package (`sella-*.dist-info/licenses/LICENSE`) and at
<https://github.com/zadorlab/sella/blob/master/LICENSE>; its header reads:

> Copyright 2019 National Technology & Engineering Solutions of Sandia, LLC (NTESS). Under the terms of Contract
> DE-NA0003525 with NTESS, the U.S. Government retains certain rights in this software.

Please cite Sella when you publish a result from these jobs: E. D. Hermes, K. Sargsyan, H. N. Najm, J. Zádor,
"Sella, an open-source automation-friendly molecular saddle point optimizer", J. Chem. Theory Comput. 18, 6974–6988
(2022), doi:10.1021/acs.jctc.2c00395; for the internal coordinates it works in: E. D. Hermes, K. Sargsyan, H. N. Najm, J. Zádor, "Geometry
optimization speedup through a geodesic approach to internal coordinates", J. Chem. Phys. 155, 094105 (2021),
doi:10.1063/5.0060146. Using Sella implies no endorsement of MolAstria by its authors.

Sella 2.x depends on JAX (Apache-2.0), installed with it by pip.

geomeTRIC is deliberately not used: its BSD licence carries a clause against inclusion in AI training sets, which a
public repository cannot honour for copied code. Should it ever be wanted, it may only be imported at run time on the
owner's computer, never copied here.
