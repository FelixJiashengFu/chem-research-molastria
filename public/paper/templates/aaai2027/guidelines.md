# AAAI-27 Paper Writing Guidelines

Instructions for writing the LaTeX paper for AAAI-27. The official author kit
(https://aaai.org/authorkit27/) and call for papers win wherever they differ from this file.

## General Setup
* **Document Class:** `\documentclass[letterpaper]{article}` with `\usepackage[submission]{aaai2027}`.
* **Fixed preamble:** the lines marked `% fixed` must stay exactly as they are. AAAI rejects papers that
  change the style, margins, fonts or spacing, or that use `\vspace` tricks to gain room.
* Do not load packages the kit forbids (its instructions list them; e.g. `geometry`, `fullpage`, `titlesec`).
* **Bibliography:** natbib author-year via `aaai2027.bst`; use `\citet{}` and `\citep{}`.

## Anonymity (Crucial)
* The `[submission]` option anonymises the paper. Keep "Anonymous Submission"; no acknowledgements; third-person self-citations.

## Paper Length
* Typically **7 pages** of technical content plus up to 2 pages of references only (check the year's call).

## Structure and Style
* Two columns; keep `\setcounter{secnumdepth}{1}` as in the template.
* Abstract: one paragraph, roughly 150–200 words.
