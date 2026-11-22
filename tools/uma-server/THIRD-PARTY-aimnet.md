# AIMNet2

The online model `aimnet2` runs [AIMNet2](https://github.com/isayevlab/aimnetcentral) (the `aimnet` package) by
Roman Zubatyuk, Dylan Anstine, Olexandr Isayev and contributors (Isayev lab, Carnegie Mellon University).

AIMNet2 is licensed under the MIT License. MolAstria uses it only as an unmodified library: the owner's computer
installs the released package into its own environment (`pip install "aimnet[ase]==0.2.6"` in `aimnet-env`), and
`aimnet_worker.py` imports `aimnet.calculators.AIMNet2Calculator` and `AIMNet2ASE` at run time. No AIMNet2 source code
and no model weights are copied into this repository or shipped with the website or the desktop app; the package
downloads the weights (`aimnet2_wb97m_d3_0.pt`, and `aimnet2nse_wb97m_0.pt` for the self-test) from its own address on
first use. The licence text is in the installed package (`aimnet-*.dist-info/licenses/LICENSE`) and at
<https://github.com/isayevlab/aimnetcentral/blob/main/LICENSE>; its notice reads:

> MIT License
>
> Copyright (c) 2024, Roman Zubatyuk
>
> Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated
> documentation files (the "Software"), to deal in the Software without restriction, including without limitation the
> rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit
> persons to whom the Software is furnished to do so, subject to the following conditions:
>
> The above copyright notice and this permission notice shall be included in all copies or substantial portions of the
> Software.
>
> THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE
> WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
> COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR
> OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

Please cite AIMNet2 when you publish a result from this model: D. M. Anstine, R. Zubatyuk, O. Isayev, "AIMNet2: a
neural network potential to meet your neutral, charged, organic, and elemental-organic needs", Chem. Sci. 16,
10228–10244 (2025), doi:10.1039/D4SC08572H. Using AIMNet2 implies no endorsement of MolAstria by its authors.

The `aimnet` package itself depends on PyTorch (BSD-3-Clause), NVIDIA Warp (`warp-lang`, Apache-2.0) and
`nvalchemi-toolkit-ops` (Apache-2.0), installed with it by pip into `aimnet-env` only.

What the online model does and does not do: `aimnet2` is the closed-shell wB97M-D3 model, so it takes neutral and
charged molecules with multiplicity 1 (ions yes, radicals no). The server, the account service and the page each
refuse an open-shell request, because the model ignores the multiplicity and would silently return the closed-shell
state. The open-shell sibling `aimnet2-nse` is loaded only by `aimnet_selftest.py` for its informational vertical IPs.
