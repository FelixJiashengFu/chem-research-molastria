# Mol* (molstar)

The macromolecule viewer (`public/viewer/molstar.js`) loads the viewer build of
[Mol*](https://github.com/molstar/molstar) (npm package `molstar`, version 5.13.1) from jsDelivr when a visitor opens it:
`build/viewer/molstar.js` and one of its theme stylesheets (`build/viewer/theme/light.css` or `dark.css`).
MolAstria does not copy Mol*'s source into this repository; the end-to-end tests serve the same files from
`tools/e2e/node_modules/molstar` (a devDependency). `public/viewer/molstar-core.js` is MolAstria's own code (PDB
reading and writing, RMSF to B factor, the elastic network toy model) and contains no Mol* code.

When using Mol* in a publication, its authors ask that you cite: D. Sehnal et al., "Mol* Viewer: modern web app for 3D
visualization and analysis of large biomolecular structures", Nucleic Acids Research 49 (2021) W431–W437,
doi:10.1093/nar/gkab314. Using Mol* implies no endorsement of MolAstria by its authors.

Its licence text, as shipped in molstar 5.13.1 (`LICENSE`), is reproduced below.

---

The MIT License

    Copyright (c) 2017 - now, Mol* contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.