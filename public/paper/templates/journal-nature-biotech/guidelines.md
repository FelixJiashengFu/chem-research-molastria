# Nature Biotechnology Paper Writing Guidelines

Below are the instructions for drafting an **Article** (or **Resource**) for *Nature Biotechnology*
(Springer Nature). `template.tex` uses the standard `article` class styled as a Nature Portfolio
submission manuscript: single column, 12 pt, A4, unnumbered sans-serif headings, superscript
numbered references (`naturemag.bst`) and `Fig. 1` legends opening with a bold title sentence.

## Venue Fit and Readership
* *Nature Biotechnology* emphasizes **biotechnology significance**: enabling capability,
  engineering depth, platform utility, translational relevance or community-scale resource value.
* Distinguish clearly whether the manuscript is an **Article** (substantial engineered platform and
  multi-claim biological validation) or a **Resource** (broadly reusable dataset, atlas or tool).
* Make clear why the advance matters for biotechnology, bioengineering or medicine rather than only
  a narrow technical benchmark.

## Review Model and Author Information
* Single-anonymized peer review by default. Keep the `A. Researcher` placeholder block verbatim;
  never invent authors, affiliations, funding, patents, grants or DOIs.

## Length and Display Items
* **Title**: at most 15 words, declarative, no punctuation/colons/puns, no "novel" or "first".
* **Abstract**: one unreferenced paragraph of at most **150 words** (no `\cite`, no displayed
  equations). Summarize the biotechnological bottleneck, the engineered system or resource, key
  quantitative performance and validation metrics, and translational/community significance.
* **Main text**: typically ~3,000–4,500 words across Introduction, Results and Discussion, with
  **4–6 main figures/tables** (~60 references typical). Keep Supplementary Methods out: core methods
  belong in `Methods`.

## Required Structure and Section Order
Unnumbered headings (`\section*`); refer to sections by name ("see Methods"), never with `\ref`.
1. **Introduction**: concise, no subheadings, carries literature and engineering context (no
   separate Related Work section).
2. **Results**: organized under short informative `\subsection*` headings stating findings (system
   design → orthogonal validation & quantitative benchmarks → robustness/scalability →
   translational or biological application).
3. **Discussion**: concise, no subheadings, no separate Conclusions or Limitations section; covers
   translational path, scalability, safety/constraints, honest limitations and outlook.
4. **Methods**: full reproducible experimental, bioengineering and computational details under short
   bold `\subsection*` headings, including `Statistics and reproducibility`.

Then back matter in template order: **Data availability**, **Code availability**, References,
**Acknowledgements**, **Author contributions**, **Competing interests**, **Additional information**.

## Prose Style and Anti-AI Discipline
* Lead paragraphs with engineering or biological findings, not defensive caveats or throat-clearing.
* Strict punctuation budget: **zero em-dashes and zero semicolons in the abstract**, and at most
  one em-dash or semicolon per body paragraph; never use paired em-dashes for parentheticals.
* Avoid AI clichés (`delve`, `tapestry`, `realm`, `holistic`, `underscore`, `pivotal`, `seamless`,
  `harness`, `intricate`, `pave the way`, `Taken together,`).
* Hedge once with calibrated precision; report sample size `n`, exact tests, error bar definitions
  and confidence/error bounds wherever statistical or translational claims appear.

## Figures and Tables
* Cite as `Fig.~\ref{fig:x}` ("Figure" at sentence start) and panels as `Fig. 1a`.
* Store all figures under `figures/` and always use the `figures/` prefix in `\includegraphics`
  (e.g. `\includegraphics[width=\linewidth]{figures/fig1.png}`).
* Artwork standards: single column 89 mm (3.5 in) or double column 183 mm (7.2 in), Arial or
  Helvetica sans-serif labels 5–7 pt at final size, lines >= 0.5–1 pt, >= 300 dpi RGB, lowercase
  bold panel labels (`a, b, c`), colorblind-safe palettes (Okabe-Ito, viridis; no red-green
  contrast or rainbow maps).
* Every figure/table caption starts with `\caption{\textbf{Brief title sentence.} ...}` followed by
  <= 350 words detailing each panel, sample size `n` and error bars.
* **Nature AI image policy**: never submit unedited generative-AI artwork as final manuscript figures.

## Back Matter and Preflight Discipline
* **Competing interests** (especially patents, equity or commercial disclosures), **Data
  availability** and **Code availability** are mandatory. State only what the provided materials
  support; otherwise write `To be completed by the authors.`.

## Important Rules
* Keep `\documentclass[12pt,a4paper]{article}` and the entire preamble unchanged; do not add
  `natbib`, `hyperref`, `cleveref`, `caption`, `subcaption`, `titlesec` or switch to `nature.cls`.
* Keep every figure file in `figures/` and always use the `figures/` prefix in `\includegraphics`.
* Keep the author placeholder (`A. Researcher\textsuperscript{1,$\ast$}`, affiliation, e-mail)
  verbatim; never fabricate names, patents, grants, DOIs, software versions or validation data.
* Keep the exact section order Introduction, Results, Discussion, Methods and back matter order
  Data availability, Code availability, References, Acknowledgements, Author contributions,
  Competing interests, Additional information, keeping all `%%%%%%%%% ... %%%%%%%%%` markers.
* Do not add a separate Related Work section, Conclusions section, TOC graphic or graphical abstract.
