# Nature Article Paper Writing Guidelines

Below are the instructions for drafting an **Article** for *Nature* (Springer Nature, flagship).
`template.tex` uses the standard `article` class styled as a Nature submission manuscript: single
column, 12 pt, A4, unnumbered sans-serif headings, superscript numbered references (`naturemag.bst`)
and `Fig. 1` legends opening with a bold title sentence.

## Venue Fit and Readership
* **Flagship Nature** requires a broad conceptual advance that matters outside the immediate specialty
  and can be explained clearly to scientists across disciplines without heavy specialist scaffolding.
* Keep title, abstract (summary paragraph) and Introduction accessible to non-specialists. Define
  every abbreviation at first use in both the summary paragraph and main text.

## Review Model and Author Information
* *Nature* uses single-anonymized peer review unless double-blind review is explicitly requested.
  Keep the `A. Researcher` placeholder block unchanged; never invent real or fictional authors,
  affiliations, funding or grants.

## Length and Display Items
* **Title**: at most 75 characters (~15 words), declarative and low-jargon, no punctuation/colons/puns,
  sentence case, no citations or undefined acronyms.
* **Abstract (Summary Paragraph)**: one unreferenced paragraph of at most **200 words** (no `\cite`,
  no displayed equations). Follow the Nature summary order: 1–2 sentences of basic introduction for
  any scientist, 2–3 sentences of specific background, 1 sentence stating the gap/problem, 1 sentence
  summarizing the main finding ("Here we show..."), 2–3 sentences of key quantitative results, and
  1–2 sentences putting the result in general context.
* **Main text**: typically 2,500–3,500 words (up to ~5,000 words) across Introduction, Results and
  Discussion, with **4–6 main display items** (figures/tables). Supporting details and extended
  datasets belong in Extended Data or Supplementary Information (never invent nonexistent SI).

## Required Structure and Section Order
Section headings are unnumbered (`\section*`). Refer to other sections by name ("see Methods"),
never with `\ref`.
1. **Introduction**: concise, no subheadings, embeds the literature context (no separate Related Work).
2. **Results**: organized under short, informative `\subsection*` headings stating findings rather
   than experiment names. Each subsection owns a clear claim backed by quantitative evidence and
   figures/tables cited in numerical order.
3. **Discussion**: concise (typically 1–4 paragraphs), no subheadings, no separate Conclusions or
   Limitations section; covers significance, honest limitations and outlook.
4. **Methods**: at the end of the main text with short bold `\subsection*` headings, including a
   `Statistics and reproducibility` subsection reporting `n`, exact tests, error bar definitions and
   software versions present in the input materials.

Then the back matter in template order: **Data availability**, **Code availability**, References,
**Acknowledgements**, **Author contributions**, **Competing interests**, **Additional information**.

## Prose Style and Anti-AI Discipline
* Lead paragraphs with findings and mechanistic insight rather than defensive scaffolding or
  throat-clearing ("It is worth noting that...", "In this context...").
* Enforce strict punctuation restraint: **zero em-dashes and zero semicolons in the abstract**, and
  at most one em-dash or semicolon per body paragraph; never use paired em-dashes to bracket asides.
* Avoid AI-cliché vocabulary (`delve`, `tapestry`, `realm`, `holistic`, `underscore`, `pivotal`,
  `seamless`, `harness`, `intricate`, `pave the way`, `Taken together,`).
* Hedge once with calibrated confidence, not thrice. Report exact quantitative comparisons and units
  with SI spacing (`\SI`/`\qty` and `\ce` where appropriate).

## Figures and Tables
* Cite as `Fig.~\ref{fig:x}` ("Figure" at sentence start) and panels as `Fig. 1a`.
* Store all figures under `figures/` and reference them with the `figures/` prefix (e.g.,
  `\includegraphics[width=\linewidth]{figures/fig1.png}`).
* Nature artwork standards: single column 89 mm (3.5 in) or double column 183 mm (7.2 in), Arial or
  Helvetica sans-serif labels at 5–7 pt at final size, lines >= 0.5–1 pt, >= 300 dpi RGB, lowercase
  bold panel labels (`a, b, c`), colorblind-safe palettes (Okabe-Ito, viridis; no red-green contrast
  or rainbow maps).
* Every figure and table legend opens with a bold one-sentence title covering the whole display item
  (`\caption{\textbf{Title sentence.} Panel descriptions...}`), followed by <= 350 words explaining
  every panel and defining sample sizes `n` and error bars. Keep each caption inside its `figure`
  environment so it stays with the artwork.
* **Nature AI image policy**: final submitted figures must be real data plots or redrawn vector/code
  graphics, never unedited generative-AI illustrations.

## Back Matter and Nature Portfolio Preflight
* State only what the provided materials support; where details are absent, write exactly
  `To be completed by the authors.` instead of inventing repositories, DOIs, grants or author roles.
* **Data availability** and **Code availability** are mandatory. **Competing interests** is mandatory
  even when none exist. If generative AI assisted in drafting prose, disclose only actual use in
  two concise sentences in Methods (if applicable and confirmed by user materials; otherwise do not
  fabricate).

## Important Rules
* Keep `\documentclass[12pt,a4paper]{article}` and the whole preamble unchanged. Do not add
  `natbib`, `hyperref`, `cleveref`, `caption`, `subcaption`, `titlesec` or switch to `nature.cls`.
* Keep every figure file in `figures/` and always use the `figures/` prefix in `\includegraphics`.
* Keep the author placeholder (`A. Researcher\textsuperscript{1,$\ast$}`, affiliation, e-mail)
  verbatim; never invent real or fictional names, affiliations, funding, data or DOIs.
* Keep the section order Introduction, Results, Discussion, Methods and back matter order Data
  availability, Code availability, References, Acknowledgements, Author contributions, Competing
  interests, Additional information, preserving all `%%%%%%%%% ... %%%%%%%%%` markers.
* Do not add a separate Related Work section, Conclusions section, TOC graphic or graphical abstract.
