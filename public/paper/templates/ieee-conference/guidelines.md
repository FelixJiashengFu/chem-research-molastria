# IEEE Conference Paper Writing Guidelines

Instructions for writing the LaTeX paper for an IEEE conference using IEEEtran. The specific conference's
call for papers wins wherever it differs from this file (page limits and anonymity vary by conference).

## General Setup
* **Document Class:** `\documentclass[conference]{IEEEtran}`; some Computer Society conferences ask for `[conference,compsoc]`.
* **Class / style:** `IEEEtran.cls` and `IEEEtran.bst`, unmodified (LPPL forbids editing them in place).
* **Citations:** numeric, via the `cite` package: `\cite{a,b}` gives [1], [2]. Do not use natbib commands (`\citet`, `\citep`).
* `\bibliographystyle{IEEEtran}`.

## Authors
* IEEE conferences are often single-blind; if the call says double-blind, replace the author block with "Anonymous Authors".

## Paper Length
* Typically **6 pages** including references, with up to 2 extra pages for a fee; check the conference.

## Structure and Style
* Abstract (no citations, no math if possible) followed by `IEEEkeywords`.
* Two columns; figures sized to `\columnwidth`, `figure*` for full width; captions below figures, above tables.
* Use "Fig. 1" in text, and IEEE-style capitalised section headings.
