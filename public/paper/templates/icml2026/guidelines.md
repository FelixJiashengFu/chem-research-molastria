# ICML 2026 Paper Writing Guidelines

Instructions for writing the LaTeX paper for ICML 2026. The official call for papers
(https://icml.cc/Conferences/2026/CallForPapers) wins wherever it differs from this file.

## General Setup
* **Document Class:** `\documentclass{article}` with `\usepackage{icml2026}` (no option = anonymous submission).
* **Style Files:** `icml2026.sty` and `icml2026.bst`, unmodified. The layout is two columns.
* The title block uses `\icmltitle`, `\icmlauthorlist`, `\icmlauthor`, `\icmlaffiliation` inside `\twocolumn[...]`; keep that structure.
* **Bibliography:** natbib author-year; use `\citet{}` and `\citep{}`, `\bibliographystyle{icml2026}`.

## Anonymity (Crucial)
* ICML is double-blind: keep the anonymous author block, no acknowledgements, third-person self-citations.

## Paper Length
* Main body: typically **8 pages**; references and appendices are unlimited (appendices after the references, same PDF).
* An "Impact Statement" section before the references is expected and does not count toward the limit.

## Structure and Style
* One-paragraph abstract (4–6 sentences).
* In two-column layout, size single-column figures to `\columnwidth`; use `figure*` for full width.
