# DBCata

The online-model server's DBCata lane (model `dbcata`, job `adsgen`) uses
[DBCata](https://github.com/Songze1019/DBCata) by Songze Huo and Xiao-Ming Cao (Shanghai Jiao Tong University):

> S. Huo, X.-M. Cao, Accelerating high-throughput catalyst screening by direct generation of equilibrium adsorption
> structures. *Nat. Commun.* (2026). doi:[10.1038/s41467-026-79243-9](https://doi.org/10.1038/s41467-026-79243-9);
> preprint arXiv:[2512.15228](https://arxiv.org/abs/2512.15228).

DBCata's code is licensed under the **GNU General Public License v3.0** (`LICENSE` in its repository). Its trained
checkpoints and the Catalysis-Hub splits are on Figshare
(doi:[10.6084/m9.figshare.30882545](https://doi.org/10.6084/m9.figshare.30882545)); record version 5 gives their
licence as "GPL" without a version.

How MolAstria (MIT) keeps the two apart:

- **No DBCata source, checkpoint or data is in this repository**, in the website or in the desktop app. DBCata is a
  separate checkout on the site owner's computer (`--dbcata-dir`, e.g. `D:\ChemDraw\DBCata`) with its own Python
  environment (`--dbcata-python`).
- **`dbcata_worker.py` is the one file that imports DBCata**, and it is licensed GPL-3.0-or-later (its first line
  says so): together with DBCata it forms a GPL-3.0 program, whose complete source is DBCata's repository plus that
  file.
- `server.py` (MIT) starts the worker as a separate process and exchanges only JSON lines with it over stdin / stdout.
  `dbcata_core.py` and `dbcata_domain_check.py` (MIT) import neither DBCata nor torch: the structure building, the
  site search, the four chemical heuristics and the energy referencing there are written from the paper's
  description and from the AdsorbML / fairchem definitions (fairchem is MIT), not copied from DBCata or CatKit.
- The website only shows the worker's results (structures and numbers) and says on the page that they come from
  DBCata running on the site owner's GPU computer, under GPL-3.0, and are not part of this site.

Using DBCata implies no endorsement of MolAstria by its authors. The energies come from Meta's UMA (task `oc20`,
checkpoint `uma-s-1p1`) through fairchem, under the FAIR Chemistry licence the site owner accepted on Hugging Face.
