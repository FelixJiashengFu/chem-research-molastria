# ACM Conference (sigconf) Paper Writing Guidelines

Instructions for writing the LaTeX paper for an ACM conference with the `acmart` class in `sigconf` format.
The conference's call for papers wins wherever it differs from this file.

## General Setup
* **Document Class:** `\documentclass[sigconf,review,anonymous]{acmart}` for an anonymous submission.
* acmart comes with TeX Live (MacTeX); no style file ships with this template.
* **Order matters:** title, authors, `\begin{abstract}...\end{abstract}`, CCS concepts and keywords all go
  **before** `\maketitle`.
* **Bibliography:** `\bibliographystyle{ACM-Reference-Format}`; author-year via natbib (`\citet`, `\citep`) or numeric `\cite`.

## Anonymity
* `anonymous` hides the authors; also avoid acknowledgements and non-anonymous links.

## Paper Length
* Varies by conference (commonly 10–12 pages excluding references in sigconf); check the call.

## Structure and Style
* Do not change fonts, margins or the class options beyond those documented by acmart.
* Generate CCS concepts at https://dl.acm.org/ccs and replace the placeholder `\ccsdesc` line.
