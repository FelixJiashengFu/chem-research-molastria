# PCCP (Royal Society of Chemistry) Paper Writing Guidelines

These instructions help you write the LaTeX paper for **Physical Chemistry Chemical Physics (PCCP)**, published by the Royal Society of Chemistry (RSC), as a computational or theoretical chemistry full paper.

The template has these parts:
* the standard `article` class;
* `pccp-approx.sty`, a layout package written for this repository: two columns on A4, 8.3 cm columns, 9 pt Charter text, sans-serif headings, a framed title and abstract block, "Fig. 1" captions, and the table of contents entry printed at the end;
* `rsc.bst` from CTAN, which gives RSC's numbered superscript citations under "Notes and references".

**This is an approximation of the RSC template, not the official RSC template.** The official template is on Overleaf. The PCCP author guidelines say template use is optional, and they accept article text as "a Word, PDF or LaTeX file (if you use LaTeX, please also include a PDF version)". RSC retypesets accepted articles, so this layout is acceptable for initial submission under the current guidelines, as long as the native LaTeX files and the PDF are both uploaded (check the current author guidelines).

## Language
All manuscripts must be in English; use one spelling convention (UK or US) consistently. Write formal, concise scientific prose for physical chemists and chemical physicists.

## Review Model and Author Information
PCCP uses single-anonymised peer review: referees see the authors' names, and the manuscript is not anonymized. Authors may also opt in to transparent peer review, which publishes the reports. The template has one placeholder author, which must stay exactly as it is:

```latex
\author{A. Researcher}
\affiliation{Department of Chemistry, Example University, City, Country}
\email{researcher@example.edu}
```

The layout prints this as "A. Researcher*a", the RSC way of marking the corresponding author with an asterisk. The affiliation and e-mail go in footnote *a* on page 1. Do not add authors, affiliations, `\thanks`, `\and`, ORCID iDs or extra footnote marks.

## Scope
* PCCP publishes "high quality research in physical chemistry, chemical physics and biophysical chemistry", and full papers must "demonstrate significant new insight into physical chemistry".
* Computational and theoretical work is a large part of the journal. Typical subjects are:
    * electronic structure;
    * spectroscopy;
    * reaction dynamics and kinetics;
    * molecular simulation;
    * surfaces and materials;
    * machine-learned potentials.
* The paper must show what new physical or chemical insight, or what methodological advance, the calculations give. A routine application of a standard method to one more system, with no new insight, is unlikely to be accepted.

## Article Types and Length
* **Full papers (Articles)**: "There are no restrictions on the length of a paper." This template is for a full paper.
* **Communications**: urgent reports of highly original work, with a justification for urgency. RSC recommends at most four printed journal pages.
* **Perspectives and Reviews**: typically 6–20 pages (shorter Perspectives of 3–4 pages are also considered).
* **Comments**: these discuss previously published PCCP work.

**Target for this paper:** aim for about 8–10 journal pages in this template's two-column layout. That is roughly 5000–7500 words of main text with 6–10 figures and tables, plus references. This is a sensible writing target, not a journal rule. Do not cut methods or results to save space; move only supporting detail to the ESI.

## Title and Abstract
* **Title**: "Keep it as short as possible", informative and specific.
    * Use general terms for compounds and procedures rather than specialised nomenclature.
    * Avoid non-standard abbreviations and symbols.
    * Use sentence case: capitalize only the first word and proper nouns.
    * Chemical formulas in the title use `\ce{...}`.
* **Abstract**: a single paragraph of "around 50 to 250 words" between the ABSTRACT markers.
    * Summarise the main findings and why they matter, with the key quantitative result and its units.
    * Avoid detailed methods.
    * Do not put citations, figure or table references, or equations in the abstract.
    * Define any abbreviation you use.
    * Aim for 150–200 words.

## Required Section Order
The template has these blocks in this order. Keep the marker lines (`%%%%%%%%% ... %%%%%%%%%`) and fill only the bodies.

1. Title, author and **abstract** (framed block at the top of page 1)
2. **ESI footnote** (`\esinote{...}`), printed as the dagger footnote to the title
3. **Table of contents entry** (`tocentry`), stored here and printed at the end of the PDF
4. `\section{Introduction}`: sets the scene. It contains the literature review and the gap this work fills, and ends with the aims of the paper. There is **no separate Related Work section** in PCCP; put all literature context here.
5. `\section{Computational details}`: the RSC "Experimental" section for computational work (see below).
6. `\section{Results and discussion}`: the main section. Use `\subsection{...}` (sentence case) to structure it.
7. `\section{Conclusions}`: RSC says "The conclusions should not summarise information already present in the article or abstract". State the significance, the limitations and the outlook in one or two paragraphs.
8. Unnumbered back matter in RSC order: **Author contributions**, **Conflicts of interest**, **Data availability**, **Acknowledgements**.
9. **Notes and references** (the bibliography).

Headings use sentence case, for example "Results and discussion" and "Effect of the solvation model". The layout numbers them automatically (1, 2.1, ...), so do not number headings by hand. Subsections are fine. Use subsubsections sparingly.

## Writing the Computational Details Reproducibly
RSC's experimental reporting guidance says: "Authors should provide sufficient information to enable readers to reproduce any computational results." Write the section so another group could repeat every number in the paper. Report only what the provided materials state. Never invent versions, settings or parameters.

* **Software**:
    * Give each program's name and exact version, e.g. ORCA 5.0.4, Gaussian 16 Rev. C.01, VASP 6.3, GROMACS 2023.2 or CP2K 2023.1, and cite it in the references.
    * RSC asks that generally available software be "properly cited", together with "the methods upon which the software is based".
* **Electronic structure**:
    * the level of theory: the functional, or the wave-function method with its approximations (e.g. DLPNO thresholds, frozen core);
    * the basis set, with the ECPs used for heavy elements and any auxiliary basis or RI/density-fitting approximation;
    * the dispersion correction (e.g. D3(BJ), D4);
    * the solvation model and solvent (e.g. SMD or CPCM, water);
    * the integration grid, which RSC explicitly asks for;
    * the SCF and geometry convergence criteria;
    * for periodic calculations: the k-point mesh, plane-wave cutoff, pseudopotentials or PAW datasets, smearing and cell relaxation.
* **Stationary points**:
    * State how minima and transition states were characterised, i.e. the number of imaginary frequencies, and give the imaginary frequency of each TS.
    * Say whether IRC calculations were run, and note any shoulders in the IRC.
    * Give the standard state, temperature and pressure used for the thermochemistry, and any quasi-harmonic or concentration corrections.
* **Simulations**:
    * the force field and its version, with the water model and any modified or new parameters;
    * the ensemble, thermostat and barostat with their coupling constants;
    * the time step and constraints;
    * the cutoffs and the long-range electrostatics method;
    * the system size and box;
    * the equilibration and production lengths, the number of independent replicas, and how statistical uncertainties were estimated (e.g. block averaging);
    * for enhanced sampling: the collective variables and the bias parameters.
* **Machine learning**:
    * the architecture and hyperparameters;
    * the training, validation and test data with their sizes and splits;
    * the reference level of theory;
    * the error metrics on held-out data.
* **Benchmarks**:
    * State the reference data, i.e. the higher-level method such as CCSD(T)/CBS or the experimental values, with their sources.
    * Give the error statistics used, e.g. MAE, RMSD or maximum error, in the same units as the results.
* **Data RSC asks for**:
    * As a minimum, papers reporting QM work should include the atomic coordinates, energies and number of imaginary frequencies.
    * All relevant total energies (potential energies, enthalpies, Gibbs free energies), taken directly from the output files.
    * These go in the ESI or a repository. Say in the text where they are.

Start the section with the standard methods used throughout, then give the details specific to each part of the study. Use `\subsection{...}` if there are several distinct methods.

## Units and Notation
* Use SI units, or units accepted alongside SI, with a space between number and unit. Write quantities with siunitx:
    * `\SI{1.5}{\kilo\calorie\per\mole}` or `\qty{6.3}{\kilo\joule\per\mole}`, printed as kJ mol⁻¹, the RSC style;
    * `\SI{298.15}{\kelvin}`, `\SI{1.16}{\angstrom}`, `\SI{-0.52}{\electronvolt}`, `\SI{3e-4}{\hartree\per\bohr}`;
    * units alone: `\si{\kilo\joule\per\mole}` or `\unit{...}`;
    * numbers: `\num{1.2e-3}`;
    * ranges: `\SIrange{1}{3}{\nano\second}`.
* Choose **one energy unit**, kJ mol⁻¹ or kcal mol⁻¹, and use it throughout the text, tables and figure axes. Use eV for band gaps, adsorption energies on surfaces and excitation energies where that is the convention. If you convert, state the factor once.
* Report a sensible number of significant figures. RSC asks for "the correct number of significant figures". Give uncertainties where they exist.
* Write chemical formulas, ions and reactions with mhchem version 4: `\ce{H2O}`, `\ce{CO2}`, `\ce{[Fe(CN)6]^{3-}}`, `\ce{H2O + CO2 -> H2CO3}`, `\ce{A <=> B}`. Never type formulas as plain text such as H2O.
* Variables are italic, as in `$E$`, `$T$` and `$\Delta G^{\ddagger}$`. Labels and subscripts that are words are upright, as in `$E_{\mathrm{TS}}$`. Define every non-standard abbreviation at first use, separately in the abstract and in the main text.
* Number displayed equations with `\begin{equation} ... \label{eq:name} \end{equation}`. Refer to them as "eqn (1)" (RSC style), i.e. `eqn~(\ref{eq:name})`.

## Figures, Schemes and Tables
* **Sizes**: figures must fit "either single column (8.3 cm) or double column (17.1 cm) width".
    * In this template, a single-column figure is `\begin{figure}[t] ... \includegraphics[width=\linewidth]{figures/...}`.
    * A double-column figure is `\begin{figure*}[t] ... \includegraphics[width=\textwidth]{figures/...}`.
* Figures should be prepared at the final size with legible lettering. RSC asks for chemical-structure labels in Arial/Helvetica 7 pt. Use 6–8 pt sans-serif labels and lines at least 0.5 pt. RSC asks for 600 dpi or better for the final TIFF artwork. The template accepts PNG, JPG or PDF from `figures/`.
* Axis labels give the quantity and unit in the same unit as the text, e.g. "Δ*G* / kJ mol⁻¹". Put no titles inside panels. Label panels (a), (b), ...
* **Colour** is free online and in print. Use colour-blind-safe palettes, such as Okabe–Ito or viridis, and add markers, line styles or labels so that no information depends on red versus green alone.
* **Captions** start with a short descriptive phrase. The layout prints "Fig. 1" and "Table 1". Refer to figures as `Fig.~\ref{fig:x}` and to tables as `Table~\ref{tab:x}`. Every figure and table must be referred to in the text.
* **Tables** use booktabs (`\toprule`, `\midrule`, `\bottomrule`) with no vertical rules. Put `\caption` **before** the `tabular`, because RSC table captions go above the table. Give units in the column headings. Example:

```latex
\begin{table}[t]
  \caption{Reaction barriers (kJ mol$^{-1}$) for \ce{CO2(H2O)_n} clusters.}
  \label{tab:barriers}
  \centering
  \begin{tabular}{@{}lcc@{}}
    \toprule
    $n$ & PBE0-D3(BJ) & CCSD(T) \\
    \midrule
    1 & 201.7 & 209.6 \\
    2 & 131.8 & 133.9 \\
    \bottomrule
  \end{tabular}
\end{table}
```

* Use `table*` for a table that needs the full page width. Use the float placement `[t]` or `[htbp]`.

## Table of Contents Entry (Graphical Abstract)
PCCP requires a table of contents entry. It is submitted at the revision stage, and this template already includes it. RSC specifies:
* **Graphic**: maximum 8 cm wide × 4 cm high. It should be simple but informative, without large amounts of text, and colour is encouraged. It must be original, unpublished artwork. RSC wants the final file as TIFF at 600 dpi or more, which the authors will supply.
* **Text**: 1–2 sentences, at most 250 characters including spaces, that highlight the novelty of the work. Write it between the `TOC TEXT` markers. Do not cite or refer to figures in it.

The layout prints the entry at the end of the PDF under "Table of contents entry". Do not reference it in the main text.

**How the writer fills the placeholder.** The `tocentry` block reads:

```latex
\begin{tocentry}
\IfFileExists{figures/toc_graphic.png}{%
  \includegraphics[width=8cm,height=4cm,keepaspectratio]{figures/toc_graphic.png}%
}{%
  \fbox{... Graphical abstract placeholder ...}%
}\par\medskip
%%%%%%%%% TOC TEXT %%%%%%%%%
Table of contents text here.
%%%%%%%%% TOC TEXT %%%%%%%%%
\end{tocentry}
```

1. If the figures list contains `toc_graphic.png`, leave the graphic part exactly as it is.
2. Otherwise, choose the single most representative figure already in `figures/`. That is the figure that conveys the main result or concept at a glance, such as an overview scheme, a key structure or a summary energy profile. Prefer a wide, landscape figure with little text.
3. Replace **both** occurrences of `figures/toc_graphic.png` with that file's exact name, e.g. `figures/fig_overview.png`. Keep the `\IfFileExists` wrapper, the placeholder branch and the options `width=8cm,height=4cm,keepaspectratio`, which scale the figure to fit the 8 cm × 4 cm limit. Add no caption, label or citation.
4. If no figure is suitable, keep the block unchanged so the placeholder box stays, and the authors will supply the artwork. A figure is unsuitable if, for example, every figure is a dense multi-panel plot that would be unreadable at 8 cm × 4 cm.
5. Always replace `Table of contents text here.` with the 1–2 sentence text described above.

## ESI Footnote
`\esinote{...}` prints the page-1 dagger footnote "†Electronic supplementary information (ESI) available: *your text* See DOI: ...". RSC's current pages and Overleaf template say "Supplementary Information (SI)" instead, and RSC sets the final wording. Replace `ESI contents here.` with one sentence that lists what the supplementary file contains, for example "Cartesian coordinates, absolute energies and imaginary frequencies of all stationary points; benchmark tables; convergence tests." Name only material the paper actually defers to the ESI. If the materials support none, write "To be completed by the authors." In the text, refer to it as "(Table S1, ESI†)" or "see the ESI†". Do not use `\ref` for ESI items.

## References and Citations
* RSC uses numbered superscript citations in order of first citation (Vancouver style), and natbib sorts and compresses them, e.g. 1–3. Put `\cite{key}` directly after the word or punctuation it belongs to, with no space before it. Published RSC articles place the number after commas and full stops, as in `... dispersion corrections.\cite{key}`. For several sources, write `\cite{a,b,c}`.
* To name authors, write "Grimme and co-workers\cite{key}". To give a number in running text, write "ref.~\citenum{key}". Do not use `\citet` or `\citep`.
* Use only keys that exist in `references.bib` or `citation_map.json`. Never invent keys. Do not cite in the abstract or in the table of contents text.
* Keep `\bibliographystyle{rsc}` and `\bibliography{references}`. `rsc.bst` prints entries in RSC format: "A. Name, B. Name and C. Name, *Journal*, year, **volume**, pages." Article titles are omitted, as in RSC journals. RSC asks for CASSI journal abbreviations. The generated `references.bib` may contain full names, which is acceptable for submission.
* Cite the software, force fields and basis sets as well as the methods.

## Required Back Matter
These unnumbered sections follow the Conclusions in this order. Fill each one only with what the provided materials state. If they say nothing, write "To be completed by the authors." Never invent names, grants, funders, repositories, DOIs or URLs.

* **Author contributions**:
    * RSC strongly encourages this section for research articles and recommends CRediT roles, explained concisely.
    * With the single placeholder author, write only roles that the materials support, e.g. "A. Researcher: conceptualization, investigation, writing – original draft." Otherwise write "To be completed by the authors."
* **Conflicts of interest**:
    * Required for all manuscripts.
    * If the materials report none, use RSC's wording: "There are no conflicts to declare."
* **Data availability**:
    * Required for all articles. It goes after the conflicts of interest and before the acknowledgements.
    * State where the data supporting the article are, i.e. a repository with a persistent identifier, such as Zenodo, ioChem-BD, NOMAD or Materials Cloud, or the ESI. Give full URLs, not embedded links.
    * Say where code and input files are. RSC's template wording is: "The code for [description of software] can be found at [URL to code location]." Cite the specific release.
    * RSC says "Data are available upon request from the authors" is generally not acceptable.
* **Acknowledgements**:
    * "Keep this section as brief as possible."
    * Include funding with grant numbers, computing resources, and help from people not listed as authors, all only as stated in the materials.
    * Any use of AI tools must be declared here.

## Supporting Information (ESI) Usage
* Move material the reader does not need in order to follow the argument to the ESI:
    * Cartesian coordinates (also as .xyz files, which RSC encourages);
    * absolute energies and thermochemical corrections;
    * extended benchmark tables;
    * convergence and sensitivity tests;
    * force-field parameters;
    * additional spectra and trajectory analyses;
    * representative input files.
* The main text must remain complete without the ESI.
* Number ESI items Fig. S1, Table S1 and so on, and refer to them in plain text.
* References cited only in the ESI may be listed at the end of the reference list.
* Do not create ESI content that the materials do not support.

## Style for PCCP
Write a quantitative physical-chemistry narrative for an audience that spans experiment and theory.
* State the physical question and the insight first, then the evidence.
* Interpret computed numbers physically. Compare them with experiment or high-level reference data whenever possible, and give errors in consistent units.
* Discuss the limitations of the model: functional and basis-set dependence, sampling, the solvation approximation and the size of the model system.
* Separate observations from interpretation.
* Avoid promotional words such as "novel", "first", "unprecedented" and "remarkable".
* Use the past tense for what was done and the present tense for general conclusions.

## Important Rules
* Keep `\documentclass[10pt,a4paper,twoside,twocolumn]{article}`, `\usepackage{pccp-approx}` and every package line in the preamble unchanged. Do not remove the `\IfFileExists` guards or the `\providecommand` fallbacks.
* Do not add packages. In particular, do not add `hyperref`, `cleveref`, `cite`, `natbib` options, `geometry`, `fontenc`, `times`, `caption`, `titlesec`, `sectsty`, `fancyhdr` or `multicol`, because `pccp-approx.sty` already sets the layout, fonts, captions, links and citations. Do not modify `pccp-approx.sty` or `rsc.bst`.
* Keep `\bibliographystyle{rsc}` and `\bibliography{references}`.
* For consistent compilation, all figures are in the `figures` directory. Always include the `figures/` prefix in `\includegraphics` (e.g. `figures/figure_1.png`, not `figure_1.png`).
* Always keep the author placeholder exactly as in `template.tex`: `\author{A. Researcher}`, `\affiliation{Department of Chemistry, Example University, City, Country}`, `\email{researcher@example.edu}` (A. Researcher, Department of Chemistry, Example University, City, Country, researcher@example.edu). Never invent real or fictional authors, affiliations, e-mails, ORCID iDs, funding, grant numbers, data, repositories, DOIs or software versions.
* Do not add a Related Work section, and do not add top-level sections the template does not have. The literature review belongs in the Introduction.
* Keep the `%%%%%%%%% ... %%%%%%%%%` marker lines, the `\maketitle` line, the `abstract`, `\esinote` and `tocentry` blocks, and the four back-matter sections. Fill the TOC block only as described above.
* Keep `\ce{...}` and unit syntax compilable:
    * use balanced braces and mhchem version 4 syntax;
    * use siunitx unit macros such as `\kilo\joule\per\mole`, or a plain unit string inside `\si{...}`;
    * do not use `S` table columns or `\sisetup`, because these have no fallback when siunitx is missing.
* Do not write `\thanks` or `\and`, and do not number headings manually.
* Escape LaTeX special characters (`%`, `&`, `_`, `#`) in text and tables.

## Sources
* PCCP author guidelines covering article types and length, abstract, section order, table of contents entry, data availability, conflicts of interest, author contributions, Vancouver references, peer review and file formats: https://www.rsc.org/publishing/publish-with-us/publish-a-journal-article/pccp
* RSC figures, graphics and images guidance (column widths 8.3 cm and 17.1 cm, 600 dpi, 7 pt Arial labels, graphical abstract 8 cm × 4 cm and 250 characters): https://www.rsc.org/journals-books-databases/author-and-reviewer-hub/authors-information/prepare-and-format/figures-graphics-images
* RSC experimental reporting requirements (computational studies): https://www.rsc.org/publishing/publish-with-us/publish-a-journal-article/experimental-reporting
* RSC data sharing guidance (data availability statements, computational data repositories): https://www.rsc.org/publishing/publish-with-us/publish-a-journal-article/data-sharing
* Official RSC LaTeX template for PCCP on Overleaf (the layout this template approximates): https://www.overleaf.com/latex/templates/royal-society-of-chemistry-template-for-preparing-your-submission-to-pccp-physical-chemistry-chemical-physics-using-overleaf/ysqhjvszpxzk
* `rsc.bst` (CTAN `rsc` bundle v3.1f): https://ctan.org/pkg/rsc
