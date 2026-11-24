# The Journal of Chemical Physics (JCP) Paper Writing Guidelines

Below are the instructions to help you with the LaTeX paper writing process for a regular
Article in The Journal of Chemical Physics (AIP Publishing), written with REVTeX 4.2
(`\documentclass[aip,jcp,reprint,amsmath,amssymb]{revtex4-2}`). The paper reports
computational chemistry / chemical physics work.

## Journal and Scope
JCP publishes research in all areas of modern chemical physics and physical chemistry:
electronic structure theory, statistical mechanics, molecular dynamics and simulation methods,
spectroscopy, reaction dynamics and kinetics, condensed phases, interfaces, soft matter,
biophysical chemistry and machine learning for molecules and materials. The editors expect work
that is of interest to researchers in more than one subfield; narrowly specialized work belongs in
a more specialized journal. A JCP paper must contain significant new material: a new method, new
physical insight, or a careful benchmark that changes how others compute something. Present the
physics and chemistry behind the numbers, not only the numbers.

## Language
All manuscripts must be in English. Use a clear, precise, quantitative style. "We" is fine.
Use the past tense for what was done and the present tense for what the results and figures show.
Define every abbreviation at first use, once in the abstract and again in the main text.

## Review Model and Author Information
Review is single-anonymous: referees are anonymous, author names and affiliations are visible
(check the current author guidelines; AIP does not state the model on the pages listed under
Sources). Manuscripts usually go to two referees and the editors decide. The author block
is therefore printed, but it is a fixed placeholder (see Important Rules). Do not anonymize the
text and do not add real or invented names anywhere.

## Article Types and Length
* **Article** (the type this template is for): no length limit. The editors judge whether the
  length suits the content, so be concise. Recommended target (not a journal rule): about
  8-12 pages in this two-column `reprint` layout including figures, tables and references.
  Move long derivations, extra tables and coordinates to the supplementary material rather than
  padding the main text.
* **Communication**: at most 3500 words, not counting figures, equations, tables and references;
  preliminary reports of highly significant work that needs rapid publication.
* **Note**: a complete short report of at most two journal pages.
* **Comment / Response**: at most two journal pages each.
* Perspectives, Tutorials and Reviews are by invitation only. Do not write one.

## Title
JCP's author instructions give no title length limit. Write a specific, informative title that
names the system and the method or finding (for example "Proton transfer barriers in
\ce{CO2} hydration from ..."). Avoid undefined acronyms, avoid "novel"/"first" claims, and do not
put citations in the title. The class sets the title in bold; capitalize like a heading (title case).

## Abstract
* One paragraph of at most 250 words.
* No displayed equations, no footnotes, no references or `\cite`, no graphics, no tables.
* Inline math and `\ce{...}` are allowed but keep them minimal.
* State the problem, what was computed and how (method, level of theory), the key quantitative
  results (with numbers and units), and why they matter.
* The abstract environment stays where it is in `template.tex`, before `\maketitle`
  (REVTeX requires this).

## Required Structure and Section Order
AIP order: title, authors, affiliations, abstract, main text, conclusion, supplementary material,
acknowledgments, author declarations, data availability statement, appendixes, references.
In this template the numbered sections are:

1. **Introduction**: the literature context lives here; there is no separate Related Work section.
2. **Theory** (optional): only if the paper derives or extends a theory or model. Otherwise delete
   the section together with its marker lines.
3. **Computational Methods**
4. **Results and Discussion** (subsections allowed)
5. **Conclusions**

Then the unnumbered back matter, already in the template, in this order: Supplementary Material,
Acknowledgments, Author Declarations (Conflict of Interest; Author Contributions), Data
Availability, optional Appendix, References. REVTeX prints section headings in capitals with Roman
numerals ("I. INTRODUCTION"); write `\section{...}` titles in normal title case.
If a subsection is created, create at least two in that section.

## Introduction
Motivate the chemical or physical problem, review prior experimental and computational work
(cite the key papers and benchmarks), identify the gap precisely, and end with what this paper does
and how the paper is organized. Treat earlier work fairly and specifically ("the D3 correction of
Ref. 2 reduces ..."), not as a list of citations.

## Computational Methods: How to Write Them Reproducibly
A reader must be able to repeat every calculation from this section plus the supplementary
material. Report only what is in the provided materials (idea, experimental log); never fill
gaps with plausible-looking settings. If a detail is missing, leave it out.

* **Software**: every program with its exact version (e.g. "ORCA 5.0.4", "Gaussian 16 Rev. C.01",
  "GROMACS 2023.2") and the citation the developers ask for if it is in the reference list.
* **Electronic structure**: method or functional (with reference), basis set (and auxiliary/RI
  basis, effective core potentials for heavy elements), dispersion correction (D3(BJ), D4, VV10, ...),
  integration grid, relativistic treatment, frozen core, local-correlation thresholds
  (e.g. DLPNO "TightPNO"), complete-basis-set extrapolation scheme, counterpoise correction.
* **Convergence**: SCF energy/density thresholds, geometry optimization criteria (energy, gradient,
  displacement), how stationary points were characterized (number of imaginary frequencies,
  IRC for transition states).
* **Thermochemistry**: temperature, pressure, standard state, frequency scaling factor,
  quasi-harmonic or rigid-rotor treatment; state whether energies are electronic energies,
  ZPE-corrected, enthalpies or Gibbs free energies.
* **Solvation**: implicit model (PCM, SMD, COSMO, ...), solvent and parameters, or the number of
  explicit solvent molecules and how they were placed.
* **Periodic calculations**: plane-wave cutoff, k-point mesh, pseudopotentials/PAW, smearing,
  cell and slab/vacuum dimensions.
* **Molecular dynamics and sampling**: force field and version (e.g. CHARMM36m, GAFF2, OPLS-AA),
  water model, ligand parametrization, system composition and box size, ensemble, thermostat and
  barostat with coupling constants, time step, constraints, electrostatics (PME, cutoffs),
  equilibration and production length, number of independent replicas, enhanced-sampling settings
  (umbrella windows, metadynamics bias), free-energy estimator (WHAM, MBAR, TI).
* **Machine-learned potentials**: origin, size and level of theory of the training data,
  train/validation/test split, architecture and key hyperparameters, cutoff radius, and held-out
  energy and force errors.
* **Benchmarks and statistics**: reference data and their level of theory (e.g. CCSD(T)/CBS,
  a named benchmark set), error metrics (MAE/MAD, RMSD, maximum error, sign convention), and how
  statistical uncertainties were computed (block averaging, bootstrap, standard error over replicas).
* **New potential energy surfaces**: JCP requires an archive (e.g. `PES.tar`) with a program that
  generates the potential, the compiler and its version, and example input and output that reproduce
  key results; it is published as supplementary material. Mention it in the Supplementary Material
  section only if it really exists.

## Results and Discussion
Lead with the main result. Compare against reference data or experiment quantitatively, give
uncertainties or error bars, and explain the physical origin of trends (interactions, electronic
structure, entropy, sampling). Discuss limitations of the methods honestly. Refer to every figure
and table in the text in numerical order.

## Conclusions
Summarize the main quantitative findings and their significance in one to three paragraphs; state
limitations and concrete next steps. Do not introduce new results or citations here.

## Mathematics and Equations
* Number displayed equations; REVTeX numbers them on the right. Appendix equations are numbered
  (A1), (A2), ... automatically after `\appendix`.
```latex
\begin{equation}
  \Delta E^{\ddagger} = E_{\mathrm{TS}} - E_{\mathrm{RC}}
  \label{eq:barrier}
\end{equation}
```
* Refer to equations as "Eq.~\eqref{eq:barrier}" (prints "Eq. (1)"), "Eqs.~(1) and (2)".
* Use `\times` for multiplication, not a center dot (except for scalar products of vectors); use a
  solidus (a/b) for fractions in running text and `\exp(...)` for complicated exponents.
* Vectors and matrices in bold: `\bm{r}`. Use `\mathrm{}` for descriptive subscripts
  ($E_{\mathrm{TS}}$, not $E_{TS}$).

## Units, Notation and Chemical Formulas
* Use SI units or units accepted for use with SI. Common chemistry practice is accepted in JCP:
  Å for distances, cm$^{-1}$ for vibrational frequencies, eV for excitation and band energies,
  atomic units ($E_\mathrm{h}$, $a_0$) in theory sections if stated.
* Choose kcal/mol or kJ/mol and use it consistently in text, tables and figures (give the other in
  parentheses once if helpful). Never mix them in one table.
* Write quantities with siunitx: `\SI{1.5}{\kilo\calorie\per\mole}` or `\qty{1.5}{\kilo\calorie\per\mole}`
  (prints "1.5 kcal/mol"), `\si{\kilo\joule\per\mole}` for a bare unit, `\num{3e-4}` for numbers,
  `\SI{298.15}{\kelvin}`, `\SI{2.0}{\femto\second}`, `\SI{1.09}{\angstrom}`, `\SI{3000}{\wavenumber}`,
  `\SI{2.1}{\debye}`, `\SI{0.1}{\molar}`. The template declares the extra units `\calorie`, `\angstrom`,
  `\molar`, `\debye`, `\atm` and `\wavenumber`. Use postfix powers (`\metre\cubed`,
  `\centi\metre\tothe{-1}`).
* Write chemical formulas and reactions with mhchem: `\ce{H2O}`, `\ce{CO2}`, `\ce{NH4+}`,
  `\ce{SO4^2-}`, `\ce{H2O + CO2 -> H2CO3}`, `\ce{A <=> B}`.
* REVTeX capitalizes section headings: in a heading write `\NoCaseChange{\ce{NaCl}}`, otherwise
  `\ce{NaCl}` prints as "NACL". Prefer headings without formulas.
* Variables in italics, labels and units upright, a space between number and unit (siunitx does this).

## Figures
* Number figures 1, 2, 3 in order of first mention; refer to them as "Fig.~\ref{fig:pes}",
  "Figs.~\ref{fig:a} and \ref{fig:b}", and panels as "Fig. 2(a)". The class prints "FIG. 1." captions.
* Every figure needs a self-contained caption (what is plotted, method, units, line/marker legend)
  and must be cited in the text. Place the `figure` environment right after the paragraph that first
  cites it, with `[t]` or `[htbp]`, and keep all figures before the Conclusions.
* Sizes: one-column figures at most 3.37 in (8.5 cm) wide, two-column figures at most 6.69 in (17 cm)
  wide, at most 8.25 in (21.1 cm) tall. In LaTeX use
  `\includegraphics[width=\linewidth]{figures/<file>}` inside `figure` (one column) and
  `\includegraphics[width=0.95\textwidth]{figures/<file>}` inside `figure*` (two columns).
* Lettering at least 8 pt at final size, lines at least 0.5 pt, embedded fonts; label panels
  (a), (b), ... Resolution at final size: 600 dpi for line art and combinations, 264 dpi for
  grayscale halftones, 300 dpi for color (RGB).
* Color is free online but print is black and white: choose colors that stay distinguishable in
  grayscale and for color-blind readers (e.g. Okabe-Ito or viridis palettes), and also vary line
  style or marker shape so that no information is carried by color alone.
* Multi-panel figures: combine the panels into one image file, or place several `\includegraphics`
  side by side with (a)/(b) explained in the caption. Do not load `subcaption`.

```latex
\begin{figure}[t]
  \centering
  \includegraphics[width=\linewidth]{figures/fig1.png}
  \caption{Potential energy curves along the C--O distance from CCSD(T) (solid),
  B3LYP-D3(BJ) (dashed) and the neural network potential (dotted).}
  \label{fig:pes}
\end{figure}
```

## Tables
* Tables are numbered with Roman numerals (TABLE I, II, ...) automatically; refer to them as
  "Table~\ref{tab:barriers}". The caption goes above the table body (put `\caption` first).
* Units belong in the column headings, e.g. "$\Delta E^{\ddagger}$ (kcal/mol)". Unaltered
  program output is not acceptable as a table.
* Use REVTeX's `ruledtabular` environment (AIP style, full-width double rules) or booktabs rules
  (`\toprule`, `\midrule`, `\bottomrule`), not both in the same table and no vertical lines.
  For decimal alignment use dcolumn (`D{.}{.}{2.2}`) or plain `r`/`c` columns; do not use siunitx
  `S` columns. Wide tables use `table*`.

```latex
\begin{table}[t]
  \caption{Barrier heights $\Delta E^{\ddagger}$ (kcal/mol) with $n$ explicit water molecules.}
  \label{tab:barriers}
  \begin{ruledtabular}
  \begin{tabular}{lccc}
    $n$ & CCSD(T) & B3LYP-D3(BJ) & SchNet \\
    \colrule
    0 & 49.8 & 48.1 & 50.6 \\
    1 & 29.5 & 28.0 & 30.2 \\
  \end{tabular}
  \end{ruledtabular}
\end{table}
```

## Highlight Image (no TOC graphic, no graphical abstract)
JCP manuscripts have no table-of-contents graphic, graphical abstract or highlights block, and
none must be added to `template.tex`. AIP accepts an optional highlight image as a separate upload
(8.0139 in wide x 6.2739 in high, at least 300 dpi); if none is supplied, **Fig. 1 is used**.
So the writer's job is: make Fig. 1 the most representative figure already in `figures/` (the one
that best shows the system and the main result), i.e. cite that figure first. Do not create,
draw or reference a separate `toc_graphic` file in the manuscript; a `figures/toc_graphic.*`
file, if present, is ignored.

## References and Citations
* References are numbered in order of first citation and printed as superscripts; the class
  selects `aipnum4-2.bst` automatically. Keep `\bibliography{references}` and do not add
  `\bibliographystyle` or a manual `thebibliography`.
* Cite with `\cite{key}` or `\cite{key1,key2}` (ranges are compressed automatically) using only
  keys that exist in `references.bib`. Put `\cite` directly after the word or the punctuation it
  belongs to, with no space: "... dispersion correction.\cite{key}" or "Becke,\cite{key} ...".
* A superscript cannot be a noun. When the reference is part of the sentence, write
  "Ref.~\onlinecite{key}" or "Refs.~\onlinecite{key1,key2}" (prints "Ref. 3"), or name the authors:
  "Grimme et al.\cite{key} showed ...". Never write "in \cite{key}".
* Printed format (AIP numbered): `A. D. Becke, "Density-functional thermochemistry. III. ...,"
  J. Chem. Phys. 98, 5648-5652 (1993).` The style sentence-cases article titles; protect acronyms
  and formulas with braces (`{DFT}`, `{CO2}`) if you edit `references.bib` yourself.
* Do not use `\footnote`: AIP does not permit text footnotes (REVTeX would move them into the
  reference list). Put remarks in the text.
* Prefer published sources. If unpublished work is cited, AIP asks for a preprint to be uploaded for
  the referees. Datasets get their own reference (creators, year, title, publisher, DOI).

## Supplementary Material
* Long tables, Cartesian coordinates of all stationary points, extra figures, convergence tests and
  input files belong in the supplementary material (a separate PDF, deposited by AIP with a DOI).
* In the text refer to it only with the phrase "supplementary material", e.g. "see the
  supplementary material". Do not number its items as if they were in the paper unless the
  provided materials define that numbering.
* The "Supplementary Material" section after the Conclusions briefly lists what it contains
  ("See the supplementary material for Cartesian coordinates of all optimized structures and ...").
  Describe only material that really exists in the provided inputs. If there is none, delete that
  section with its marker lines and do not mention supplementary material anywhere.

## Back Matter: Acknowledgments, Author Declarations, Data Availability
These statements are required by AIP Publishing and must stay in this order and with these headings.
* **Acknowledgments** (`acknowledgments` environment): thank only people, facilities, computing
  centers and funders named in the provided materials, with grant numbers only if given. Never invent
  funding agencies or grant numbers. If nothing is provided, write "To be completed by the authors."
  rather than an assumed or fabricated statement.
* **Conflict of Interest**: required even when there is none. If the materials state that there is
  no conflict, use AIP's wording for a single author: "The author has no conflicts to disclose."
  If they say nothing, write "To be completed by the authors."
* **Author Contributions**: a CRediT (NISO Contributor Roles Taxonomy) statement is required.
  For the single placeholder author use the AIP format with degree in parentheses, listing only roles
  supported by the work done, e.g.
  `\textbf{A. Researcher}: Conceptualization (lead); Methodology (lead); Software (lead);
  Investigation (lead); Formal analysis (lead); Writing -- original draft (lead);
  Writing -- review \& editing (lead).`
  (format as printed in recent AIP articles; check the current author guidelines).
  CRediT roles: Conceptualization, Data curation, Formal analysis, Funding acquisition,
  Investigation, Methodology, Project administration, Resources, Software, Supervision, Validation,
  Visualization, Writing -- original draft, Writing -- review \& editing.
* **Ethics Approval**: only for research with human participants or animals; omit for
  computational work.
* **Data Availability**: required for every manuscript. Pick the AIP template sentence that matches
  the provided materials; do not invent repositories, DOIs or accession numbers:
  * "The data that support the findings of this study are available from the corresponding author
    upon reasonable request." (only if the materials say so)
  * "The data that support the findings of this study are available within the article [and its
    supplementary material]."
  * "The data that support the findings of this study are openly available in [repository name]
    at http://doi.org/[doi], reference number [reference number]." (only with a real DOI)
  * "Data sharing is not applicable to this article as no new data were created or analyzed in this
    study." (purely theoretical papers)
  * If the materials say nothing about data availability, write "To be completed by the authors."
* **Appendix** (optional): after Data Availability and before the references; use `\appendix`
  followed by `\section{...}`.

## Important Rules
* Keep the document class line `\documentclass[aip,jcp,reprint,amsmath,amssymb]{revtex4-2}` and all
  preamble lines (packages, unit declarations and fallbacks) unchanged. Do not add packages; in
  particular not `geometry`, `caption`, `subcaption`, `natbib`, `cite`, `hyperref`, `cleveref` or font
  packages: REVTeX already provides citations, captions and the journal layout, and these packages
  override them. (The only permitted change is `reprint` to `preprint` if a single-column review
  copy is explicitly requested.)
* For consistent compilation across environments, all figures reside in the `figures` directory.
  Always include the `figures/` prefix in `\includegraphics` (e.g. `figures/fig1.png`, never
  `fig1.png`).
* Keep the author placeholder exactly as in `template.tex`:
  `\author{A. Researcher}`,
  `\email[Author to whom correspondence should be addressed: ]{researcher@example.edu}`,
  `\affiliation{Department of Chemistry, Example University, City, Country}`.
  Do not add authors, ORCID IDs, `\homepage` or `\altaffiliation`.
* Do not invent authors, affiliations, funding, grant numbers, software versions, computational
  settings, data, repositories or DOIs. Use only what the provided materials contain.
* Do not add a Related Work section; the literature review belongs in the Introduction.
* Keep `\ce{...}` and unit syntax compilable: only `\ce`, `\pu`, `\SI`/`\qty`, `\si`/`\unit`,
  `\num`, `\SIrange`/`\qtyrange`, `\numrange`, `\ang`, with balanced braces and siunitx unit macros
  or literal units (`\SI{1.5}{kcal/mol}` also works); no siunitx `S` table columns; wrap formulas in
  headings in `\NoCaseChange{...}`.
* The abstract (at most 250 words, no citations, no displayed equations) stays before `\maketitle`.
* No `\footnote`; no citations used as nouns (use `Ref.~\onlinecite{...}`).
* Keep the section marker lines (`%%%%%%%%% ... %%%%%%%%%`) and the back-matter order:
  Supplementary Material, Acknowledgments, Author Declarations (Conflict of Interest, Author
  Contributions), Data Availability, Appendix, References.
* Do not add a TOC graphic, graphical abstract or highlights; Fig. 1 serves as the highlight image.
* Make sure all figures and tables appear before the Conclusions section, unless placed in an Appendix.

## Sources
* AIP Publishing author instructions (abstract, section order, figures, references, author
  declarations, data availability, supplementary material, highlight image, JCP Communications and
  PES rules): https://publishing.aip.org/resources/researchers/author-instructions/
* JCP editorial policies (article types and lengths, scope, review by two referees, PES archive):
  https://pubs.aip.org/aip/jcp/pages/policies
* JCP journal home page (scope): https://pubs.aip.org/aip/jcp
* AIP LaTeX template on Overleaf (REVTeX options, `preprint` used for peer review):
  https://www.overleaf.com/latex/templates/template-for-submission-to-aip-journals/wdmsvzfjgvyj
* REVTeX 4.2: https://journals.aps.org/revtex/
* Not verified from an official page and marked above: the review model and the exact CRediT print
  format. Units/notation and Computational Methods advice are general good practice, not quoted
  journal rules.
