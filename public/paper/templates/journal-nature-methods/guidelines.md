# Nature Methods Paper Writing Guidelines

Below are the instructions for drafting an **Article** (or **Resource** / **Analysis**) for
*Nature Methods* (Springer Nature). `template.tex` uses the standard `article` class styled as a
Nature Portfolio submission manuscript: single column, 12 pt, A4, unnumbered sans-serif headings,
superscript numbered references (`naturemag.bst`) and `Fig. 1` legends opening with a bold title sentence.

## Venue Fit and Readership
* *Nature Methods* prioritizes **enabling power**: a new assay, computational method, algorithm,
  platform or community resource that solves a real bottleneck for biologists and researchers.
* Write for a broad biologist/method-adopter audience rather than only specialists in your algorithm
  or instrument subfield.
* Make legible five core pillars in Results: (1) technical advance over existing methods,
  (2) systematic benchmarking against credible baselines on fair metrics, (3) protocol/software
  reproducibility, (4) demonstrated general utility beyond one narrow showcase, and (5) compelling
  application showing why the method matters.

## Review Model and Author Information
* Single-anonymized peer review by default. Keep the `A. Researcher` placeholder block verbatim;
  never invent authors, affiliations, funding, DOIs or software links.

## Length and Display Items
* **Title**: at most 15 words, declarative, no punctuation/colons/puns, no "novel" or "first".
* **Abstract**: one unreferenced paragraph of at most **150 words** (no `\cite`, no displayed
  equations). State the methodological gap, the principle of the method, quantitative benchmark
  gains with units/error bounds, and the biological/scientific utility enabled.
* **Main text**: typically ~3,000–4,500 words across Introduction, Results and Discussion, with
  **4–6 main figures/tables** (60–70 references typical). Keep Supplementary Methods out: all core
  methods belong in `Methods`.

## Required Structure and Section Order
Unnumbered headings (`\section*`); refer to sections by name ("see Methods"), never with `\ref`.
1. **Introduction**: concise, no subheadings, includes literature review and baseline context (no
   separate Related Work section).
2. **Results**: organized under short informative `\subsection*` headings stating findings (design
   principle → validation & baseline benchmarks → generalization/robustness → biological/real-world
   application).
3. **Discussion**: concise, no subheadings, no separate Conclusions or Limitations section; covers
   practical scope, failure modes, computational/experimental trade-offs and outlook.
4. **Methods**: complete, step-by-step reproducible details under bold `\subsection*` headings,
   including software/package versions, hyperparameters, dataset splits (leakage prevention),
   baseline comparison settings, and `Statistics and reproducibility`.

Then back matter in template order: **Data availability**, **Code availability**, References,
**Acknowledgements**, **Author contributions**, **Competing interests**, **Additional information**.

## Prose Style and Anti-AI Discipline
* Lead paragraphs with claims and quantitative comparisons, not defensive hedges or throat-clearing.
* Strict punctuation budget: **zero em-dashes and zero semicolons in the abstract**, and at most
  one em-dash or semicolon per body paragraph; never bracket asides with paired em-dashes.
* Avoid AI clichés (`delve`, `tapestry`, `realm`, `holistic`, `underscore`, `pivotal`, `seamless`,
  `harness`, `intricate`, `pave the way`, `Taken together,`).
* Hedge once with calibrated precision; report sample size `n`, exact tests, error bar definitions
  and uncertainty intervals wherever inferential or benchmark comparisons appear.

## Figures and Tables
* Cite as `Fig.~\ref{fig:x}` ("Figure" at sentence start) and panels as `Fig. 1a`.
* Store all figures under `figures/` and include the `figures/` prefix in `\includegraphics` (e.g.
  `\includegraphics[width=\linewidth]{figures/fig1.png}`).
* Artwork standards: single column 89 mm (3.5 in) or double column 183 mm (7.2 in), Arial or
  Helvetica sans-serif labels 5–7 pt at final size, lines >= 0.5–1 pt, >= 300 dpi RGB, lowercase
  bold panel labels (`a, b, c`), colorblind-safe palettes (Okabe-Ito, viridis; no red-green
  contrast or rainbow scales).
* Every figure/table caption starts with `\caption{\textbf{Brief title sentence.} ...}` followed by
  <= 350 words detailing each panel, sample size `n` and error bars.
* **Nature AI image policy**: never use unedited generative-AI artwork for final figures; use data
  plots or clean vector/code diagrams.

## Back Matter and Preflight Discipline
* **Code availability** and **Data availability** are critical for *Nature Methods*. Report only
  repositories, versions and DOIs present in the provided materials; otherwise write
  `To be completed by the authors.`.

## Important Rules
* Keep `\documentclass[12pt,a4paper]{article}` and the entire preamble unchanged; do not add
  `natbib`, `hyperref`, `cleveref`, `caption`, `subcaption`, `titlesec` or switch to `nature.cls`.
* Keep every figure file in `figures/` and always use the `figures/` prefix in `\includegraphics`.
* Keep the author placeholder (`A. Researcher\textsuperscript{1,$\ast$}`, affiliation, e-mail)
  verbatim; never fabricate names, grants, DOIs, software versions or benchmark numbers.
* Keep the exact section order Introduction, Results, Discussion, Methods and back matter order
  Data availability, Code availability, References, Acknowledgements, Author contributions,
  Competing interests, Additional information, keeping all `%%%%%%%%% ... %%%%%%%%%` markers.
* Do not add a separate Related Work section, Conclusions section, TOC graphic or graphical abstract.
