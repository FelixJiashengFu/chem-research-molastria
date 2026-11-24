# *ACL / ACL Rolling Review Paper Writing Guidelines

Instructions for writing the LaTeX paper for an ARR submission (ACL, EMNLP, NAACL, EACL ...).
The ARR call for papers (https://aclrollingreview.org/cfp) and the venue's call win wherever they differ.

## General Setup
* **Document Class:** `\documentclass[11pt]{article}` with `\usepackage[review]{acl}` (anonymous, with line numbers).
* **Style Files:** `acl.sty` and `acl_natbib.bst`, unmodified. A4 paper, two columns.
* **Bibliography:** natbib; use `\citet{}` for textual and `\citep{}` for parenthetical citations.

## Anonymity (Crucial)
* ARR is double-blind: keep "Anonymous ACL submission", no acknowledgements, third-person self-citations,
  anonymised links only.

## Paper Length
* Long papers: up to **8 pages**; short papers: up to **4 pages**. References, the Limitations section,
  the ethics statement and appendices do not count.

## Required Sections
* **Limitations** (`\section*{Limitations}`) after the conclusion and before the references is mandatory;
  papers without it are desk-rejected.
* An optional ethics statement may follow it.
