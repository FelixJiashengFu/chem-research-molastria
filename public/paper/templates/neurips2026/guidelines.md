# NeurIPS 2026 Paper Writing Guidelines

Instructions for writing the LaTeX paper for NeurIPS 2026. The official call for papers
(https://neurips.cc/Conferences/2026/CallForPapers) wins wherever it differs from this file.

## General Setup
* **Document Class:** `\documentclass{article}` with `\usepackage{neurips_2026}` (no option = anonymous submission).
* **Style File:** use `neurips_2026.sty` unmodified. Do not change margins, fonts or spacing.
* **Bibliography:** natbib is loaded by the style; use `\citet{}` for textual and `\citep{}` for parenthetical citations, with `\bibliographystyle{plainnat}`.

## Anonymity (Crucial)
* NeurIPS is double-blind. Keep the anonymous author block; do not add names, affiliations, acknowledgements or funding.
* Cite your own prior work in the third person. Do not link to non-anonymous repositories.

## Paper Length
* Main text (including figures and tables): typically **9 pages**. References, the NeurIPS paper checklist and appendices do not count.

## Structure and Style
* One-paragraph abstract.
* Section headings are numbered; use sentence case or title case consistently.
* Figures and tables must be legible in print; put captions below figures and above tables.
* Use `booktabs` rules for tables (no vertical lines).
