# npj Computational Materials Paper Writing Guidelines

Below are the instructions to help you with the LaTeX paper writing process for an **Article**
in *npj Computational Materials* (Springer Nature, npj Series). The paper reports computational
chemistry / computational materials science work. `template.tex` uses the standard `article`
class styled as a Nature-family submission manuscript: single column, 12 pt, A4,
unnumbered sans-serif headings, superscript numbered references (`naturemag.bst`) and
"Fig. 1" legends that open with a bold title sentence.

## This Template Is a Submission-Format Approximation
* npj journals do **not** require their house format at first submission: manuscripts "do not
  need to adhere to our formatting requirements at the point of initial submission". Text and
  figures go in as a single PDF or Word file. LaTeX source is only accepted at the acceptance
  stage; before that a compiled PDF is supplied. Formatting requirements are applied after peer
  review, before formal acceptance.
* So the compiled `template.pdf` is the referee copy. It is not the typeset journal layout and
  not Springer Nature's own LaTeX template (that template is not used here; see SOURCES.md).
  What matters is the content and the required structure below, and that every figure legend
  sits on the same page as its figure.

## Journal and Scope
npj Computational Materials publishes applied computational approaches to designing new materials
and understanding existing ones: theory and simulation methods for organic and inorganic materials,
prediction of structure and properties, materials fundamentals, behavior and degradation, studies
that combine computation with experimental validation, high-throughput computation and materials
data mining, machine learning and AI for materials design, and methods and fundamental theory for
materials modelling and informatics. It is fully open access. The readers are materials scientists,
chemists and physicists across subfields, so the paper must explain why the result matters for
materials, not only report numbers. Molecular quantum chemistry fits when it is tied to a material
or materials property (catalytic surfaces, battery electrolytes and electrodes, porous frameworks,
molecular crystals, polymers, 2D materials).

## Language
All manuscripts must be in English. Write clearly for a broad materials audience; "we" is fine.
Define every abbreviation at first use in the abstract and again in the main text. Use the past
tense for what was done and the present tense for what results and figures show.

## Review Model and Author Information
The npj Series uses **single-anonymized** peer review: referees are anonymous, authors are named.
Manuscripts typically go to two or three referees. Preprints do not compromise novelty. The author
block is therefore printed, but it is a fixed placeholder (see Important Rules). Do not anonymize
the text and do not add real or invented names anywhere.

## Article Types and Length
* **Article** (the type this template is for): title up to 15 words; abstract up to 150 words;
  the content-types page states no strict word or page limit for the main text; references are
  limited to 60 (not strictly enforced); each figure legend at most 350 words.
  Recommended target (not a journal rule): about 4,000-6,000 words of main text (Introduction to
  Discussion), 4-6 display items (figures and tables), which is roughly 12-20 pages in this
  single-column 12 pt layout including figures and references. Put convergence tests, extra
  tables and structures in the Supplementary Information, not the main text.
* **Brief Communication**: abstract up to 70 words, main text 1,000-1,500 words without
  subheadings (Methods have subheadings), about 20 references.
* Comment, Matters Arising, Perspective and Review have their own rules (abstract up to 70 words);
  do not write one of these with this template.

## Title
* At most 15 words. No punctuation, idioms or puns (so no colons, question marks or dashes used as
  separators).
* Specific and informative: name the material class or system and the finding or method, e.g.
  "Strain controls proton conduction in layered perovskite oxides". Avoid undefined acronyms,
  "novel" and "first", and never cite in the title. Sentence case is the Nature-family convention.

## Abstract
* One paragraph of at most **150 words**, no subheadings.
* No references or `\cite`, no displayed equations, no figures or tables (Nature-family
  convention; check the current author guidelines).
* State the problem and why it matters for materials, what was computed and how (method, level of
  theory or model), the key quantitative results with units, and the implication.
* Write it between the ABSTRACT marker lines inside the `abstract` environment.

## Required Structure and Section Order
The section headings are unnumbered (`\section*`), as in Nature-family journals. Refer to other
sections by name ("see Methods"), never with `\ref`.

1. **Introduction**: no subheadings. The literature context lives here; there is no separate
   Related Work section.
2. **Results**: divided by short, informative `\subsection*` headings (a heading can state the
   finding, e.g. "Learned potential reproduces strained energies").
3. **Discussion**: no subheadings. No separate Conclusions or Limitations section is permitted;
   summary, limitations and outlook belong in the Discussion.
4. **Methods**: at the end of the main text, divided by short bold `\subsection*` headings
   (e.g. "Electronic-structure calculations", "Molecular dynamics", "Machine-learning model",
   "Statistics and reproducibility"). All methods must be in the main manuscript; Supplementary
   Methods are not permitted.

Then the back matter, already in the template, in this order: **Data availability** (after
Methods, before References), **Code availability**, References, **Acknowledgements**,
**Author contributions**, **Competing interests**, **Additional information** (Supplementary
information sentence and correspondence line). Keep all headings and marker lines.

## Introduction
Explain the materials problem and why it matters, review prior experimental and computational work
precisely (cite the key methods, databases and benchmarks), identify the gap, and end with a short
paragraph stating what this work does and its main finding. No subheadings, no outline paragraph
("Section 2 describes...") since sections are unnumbered.

## Results
Lead with the most important result. Each subsection makes one point supported by a figure or
table. Compare quantitatively against reference calculations or experiment with error metrics,
explain the physical or chemical origin of trends, and cite every figure and table in numerical
order. Keep method details short here and point to Methods.

## Discussion
Interpret the results in the context of the field: what is new, how general it is, where the
method fails or was not tested (honest limitations), and what it enables next. One to four
paragraphs, no new results, no subheadings.

## Methods: How to Write Them Reproducibly
A reader must be able to repeat every calculation from Methods plus the Supplementary
Information. Report only what is in the provided materials (idea, experimental log); never fill
gaps with plausible-looking settings. If a detail is missing, leave it out.

* **Software**: every program with its exact version (e.g. "VASP 6.4.2", "Quantum ESPRESSO 7.2",
  "LAMMPS 2 Aug 2023", "ORCA 5.0.4", "PyTorch 2.1") and the reference the developers ask for, if it
  is in the reference list.
* **Electronic structure**: functional (with reference), Hubbard U values and how they were chosen,
  hybrid fraction, basis set or plane-wave kinetic-energy cutoff, pseudopotentials/PAW datasets and
  valence configurations, dispersion correction (D3(BJ), D4, rVV10, many-body dispersion),
  spin polarization and magnetic ordering, spin-orbit coupling.
* **Periodic models**: k-point mesh or spacing, smearing method and width, cell and supercell sizes,
  slab thickness, vacuum and fixed layers, dipole correction, defect charge corrections.
* **Convergence**: SCF energy threshold, force/stress thresholds for relaxations, how convergence
  with cutoff, k-points and supercell size was tested (report the tests in the SI).
* **Molecular calculations**: method, basis set, effective core potentials, integration grid,
  local-correlation thresholds, complete-basis-set extrapolation, stationary points characterized
  by frequencies (and IRC for transition states).
* **Solvation and electrochemistry**: implicit model (VASPsol, PCM, SMD, COSMO) and parameters or
  explicit solvent setup; reference electrode and potential scheme (e.g. computational hydrogen
  electrode).
* **Thermodynamics**: temperature, pressure, standard state, phonon/vibrational treatment
  (harmonic, quasi-harmonic), zero-point energy; say whether energies are electronic energies,
  enthalpies or free energies, and give reference states for formation energies.
* **Molecular dynamics and sampling**: force field or interatomic potential and version, system
  size and composition, ensemble, thermostat and barostat with coupling constants, time step,
  equilibration and production length, number of independent runs, enhanced-sampling settings and
  free-energy estimator.
* **Machine learning**: data source and level of theory, dataset size, train/validation/test split
  and how it avoids leakage (e.g. by composition or structure family), architecture, cutoff,
  hyperparameters and how they were tuned, training protocol, and held-out errors (energy per atom,
  forces, stresses) with uncertainty.
* **Benchmarks and statistics**: reference data and their level of theory or experimental source,
  error metrics (MAE, RMSE, maximum error, sign convention), what error bars mean (s.d., s.e.m.,
  confidence interval), the number of samples n, and how uncertainties were estimated (bootstrap,
  block averaging, independent replicas).

## Mathematics and Equations
* Number displayed equations with `equation` (or `align`) and refer to them as
  "Eq.~(\ref{eq:energy})".
```latex
\begin{equation}
  E_{\mathrm{f}} = E_{\mathrm{defect}} - E_{\mathrm{bulk}} - \sum_i n_i \mu_i
  \label{eq:formation}
\end{equation}
```
* Vectors in bold upright (`\mathbf{r}`), descriptive subscripts upright (`E_{\mathrm{f}}`).
  Keep heavy derivations in the Methods or the Supplementary Information.

## Units, Notation and Chemical Formulas
* SI nomenclature with a single space between number and unit. Common materials units are fine:
  eV, eV/atom, meV/atom, Å, GPa, K, fs. Choose kcal/mol or kJ/mol (or eV) for reaction energies and
  use it consistently in text, tables and figures; never mix them in one table.
* Write quantities with siunitx: `\SI{1.5}{\kilo\calorie\per\mole}` or `\qty{1.5}{\kilo\calorie\per\mole}`
  (prints "1.5 kcal mol^-1"), `\SI{4.1}{\milli\electronvolt\per\atom}`, `\SI{520}{\electronvolt}`,
  `\SI{0.01}{\electronvolt\per\angstrom}`, `\SI{300}{\kelvin}`, `\SI{1}{\femto\second}`,
  `\si{\giga\pascal}` for a bare unit. The template declares `\calorie`, `\angstrom` and `\atom`.
* npj separates thousands with commas (1,000). Write large counts as `1,200` in text (not
  `\num{1200}`).
* Chemical formulas and reactions with mhchem: `\ce{LiCoO2}`, `\ce{MoS2}`, `\ce{H2O + CO2 -> H2CO3}`,
  `\ce{Li+}`, `\ce{SO4^2-}`. Formulas in headings are fine (headings are not capitalized).
* Refer to compounds consistently by name (preferably IUPAC), formula, abbreviation or bold
  numeral, as npj asks.

## Figures
* Number figures in order of first mention and cite them as "Fig.~\ref{fig:x}" ("Figure" at the start
  of a sentence), panels as "Fig. 2a". Every figure must be cited in the text.
* Legend: `\caption{\textbf{Brief title sentence.} Description...}`. The title summarizes the whole
  figure and does not refer to a single panel; the body (at most 350 words) describes each panel
  (a, b, c ...) in turn and spells out symbols in words ("circles, PBE; squares, learned potential").
  The template prints "Fig. 1" in bold before it. The legend must be on the same page as the figure,
  so keep the caption inside the `figure` environment.
* Place each `figure` right after the paragraph that first cites it, with `[htbp]`. Width: the text
  block is about 16 cm wide; use `width=0.8\linewidth` for a single plot and `width=\linewidth` for
  multi-panel figures, always with the `figures/` prefix:
```latex
\begin{figure}[htbp]
  \centering
  \includegraphics[width=0.8\linewidth]{figures/fig1.png}
  \caption{\textbf{Energy along a uniaxial strain path.} Circles, PBE reference energies;
  squares, learned potential. Lines are guides to the eye.}
  \label{fig:strain}
\end{figure}
```
* Artwork rules (npj): prepared to fit A4 page width; text in Arial or Helvetica at about 8 pt at
  final size (symbol font for Greek letters); thinnest lines at least 1 pt; at least 300 dpi, RGB;
  panel labels as lowercase bold letters (a, b, c); multi-panel figures combined into one image.
  In the typeset journal, figures are about 88 mm (one column) or 180 mm (two columns) wide
  (Nature-family standard; check the current author guidelines).
* Color: avoid red and green for contrast and avoid rainbow color scales. Use color-blind-safe
  palettes (Okabe-Ito, viridis, cividis) and vary markers or line styles as well.
* Do not load `subcaption` or other packages; combine panels into one image file instead.

## Tables
* Number tables in order of citation and cite them as "Table~\ref{tab:x}". The caption goes above the
  table and also starts with a bold title sentence; units belong in the column headings.
* Use booktabs rules (`\toprule`, `\midrule`, `\bottomrule`), no vertical lines; no siunitx `S`
  columns. npj places tables at the end of the text in the final files, but in this compiled
  referee PDF keep each table near its first citation. State in the legend what error values mean
  (s.d., s.e.m.) when statistics are reported.
```latex
\begin{table}[htbp]
  \centering
  \caption{\textbf{Errors of the learned potential.} Mean absolute errors relative to PBE.}
  \label{tab:mae}
  \begin{tabular}{lcc}
    \toprule
    Subset & Energy (meV/atom) & Force (meV/\AA) \\
    \midrule
    Equilibrium & 2.1 & 45 \\
    Strained    & 4.1 & 71 \\
    \bottomrule
  \end{tabular}
\end{table}
```

## TOC Graphic / Graphical Abstract
npj Computational Materials articles have **no TOC graphic, graphical abstract or highlights**, and
none must be added to `template.tex`. A `figures/toc_graphic.*` file, if present, is ignored.
The figure that best represents the work should simply be Fig. 1 or the first figure cited in
Results.

## References and Citations
* References are numbered in order of first citation (text, then Methods, tables and figure
  legends) and printed as superscripts by `naturemag.bst` and `cite.sty`. Keep
  `\bibliographystyle{naturemag}` and `\bibliography{references}` where they are (after Code
  availability); do not write a manual `thebibliography`.
* Cite with `\cite{key}` or `\cite{key1,key2,key3}` (ranges are compressed) using only keys that
  exist in `references.bib`. Put the citation directly after the word or the punctuation, with no
  space before it: "... in the gradient approximation\cite{key}." (the full stop is moved in front
  of the superscript automatically) or "SchNet\cite{key} learns ...".
* A superscript cannot be a noun. Instead of "in ref. 3", name the authors or the method
  ("Perdew et al.\cite{key} showed ...", "the PBE functional\cite{key}"). Never write
  "in \cite{key}" or "ref.~\cite{key}".
* Printed format (Nature style): `Perdew, J. P., Burke, K. & Ernzerhof, M. Generalized gradient
  approximation made simple. Phys. Rev. Lett. 77, 3865-3868 (1996).` with italic journal and bold
  volume; more than five authors become "First, A. et al.". One publication per number.
* Web addresses go in the text in parentheses, not in the reference list. Datasets and software
  with DOIs may be cited as references.
* At most about 60 references for an Article.
* No footnotes; put remarks in the text.

## Supplementary Information
* All supplementary material cited in the paper goes in one separate, merged PDF (convergence tests,
  extra figures and tables, structures). Large tables go in separate "Supplementary Data" files.
  Supplementary Methods are not permitted: all methods stay in Methods.
* Refer to items as "Supplementary Fig. 1", "Supplementary Table 1", "Supplementary Note 1"
  (Nature-family convention). Mention only material that really exists in the provided inputs.
* In "Additional information", replace the placeholder with one sentence describing the
  Supplementary Information, e.g. "The online version contains Supplementary Information
  (convergence tests and relaxed structures)." If there is none, delete that sentence and do not
  mention supplementary material anywhere.

## Back Matter Statements
These are required by npj and must stay in this order with these headings. Each statement may
only say what the provided materials say. Where the materials say nothing, write exactly
"To be completed by the authors." (the pipeline's convention) instead of an assumed statement.
* **Data availability** (mandatory): how the minimum dataset needed to reproduce the results can be
  accessed. Name a repository and DOI only if the provided materials give one. Typical wordings
  when the materials support them: "The data that support the findings of this study are
  available in [repository] at [DOI]." or "All data supporting the findings of this study are
  available within the paper and its Supplementary Information."
* **Code availability** (npj asks for a statement on whether and how code can be accessed): name
  the code and a repository only if given. If only published third-party software was used, say
  so and name it with versions.
* **Acknowledgements**: brief; funding (with grant numbers) belongs here because npj has no separate
  funding statement. Use only people, facilities, computing centers and funders named in the
  provided materials. Never invent agencies or grant numbers.
* **Author contributions** (mandatory): by initials. For the single placeholder author, e.g.
  "A.R. conceived the study, performed the calculations, analysed the results and wrote the
  manuscript." (list only work that the materials show was done).
* **Competing interests** (mandatory, even if none): state what the materials say, e.g.
  "The author declares no competing interests."; otherwise "To be completed by the authors."
* **Additional information**: the Supplementary information sentence and the fixed
  "Correspondence and requests for materials should be addressed to A. Researcher." line.

## Important Rules
* Keep `\documentclass[12pt,a4paper]{article}` and the whole preamble (packages, unit
  declarations, fallbacks, layout code) unchanged. Do not add packages; in particular not
  `natbib`, `hyperref`, `cleveref`, `caption`, `subcaption`, `titlesec`, `geometry` options or font
  packages, which would break the citation, heading and legend setup. Do not switch to
  `nature.cls` (it discards `\includegraphics` and breaks figure references).
* For consistent compilation across environments, all figures reside in the `figures` directory.
  Always include the `figures/` prefix in `\includegraphics` (e.g. `figures/fig1.png`, never
  `fig1.png`).
* Keep the author placeholder exactly as in `template.tex`: `\author{A. Researcher\textsuperscript{1,$\ast$}}`,
  the `affiliations` item "Department of Chemistry, Example University, City, Country" and the line
  "Corresponding author. e-mail: researcher@example.edu". Do not add authors, ORCID IDs or
  affiliations.
* Do not invent authors, affiliations, funding, grant numbers, software versions, computational
  settings, data, repositories, DOIs or supplementary material. Use only what the provided
  materials contain.
* Do not add a Related Work section; the literature review belongs in the Introduction. Do not add a
  Conclusions or Limitations section; that content belongs in the Discussion.
* Keep the section order Introduction, Results, Discussion, Methods, and the back matter order Data
  availability, Code availability, References, Acknowledgements, Author contributions, Competing
  interests, Additional information. Keep the marker lines (`%%%%%%%%% ... %%%%%%%%%`).
* Keep `\ce{...}` and unit syntax compilable: only `\ce`, `\SI`/`\qty`, `\si`/`\unit`, `\num`,
  `\SIrange`/`\qtyrange`, `\numrange`, with balanced braces and siunitx unit macros (or literal
  units such as `\SI{1.5}{kcal/mol}`); no siunitx `S` table columns.
* Title at most 15 words without punctuation; abstract at most 150 words with no citations;
  every figure legend starts with a bold title sentence and stays with its figure.
* Do not add a TOC graphic, graphical abstract or highlights.

## Sources
* Aims and scope: https://www.nature.com/npjcompumats/aims
* Content types (Article title 15 words, abstract 150 words, section structure and subheadings,
  60 references, 350-word legends, required statements, Methods only in the main file):
  https://www.nature.com/npjcompumats/content-types
* Submission guidelines (no formatting needed at initial submission, single PDF or Word, LaTeX at
  acceptance, references, figure legends, artwork, units, Supplementary Information, Data and Code
  availability, acknowledgements): https://www.nature.com/npjcompumats/for-authors-and-referees/submission-guidelines
* Editorial process (single-anonymized review, two or three referees, preprints):
  https://www.nature.com/npjcompumats/for-authors-and-referees/editorial-process
* Guide to authors (author contributions by initials, competing interests, data availability):
  https://www.nature.com/npjcompumats/for-authors-and-referees/guide-to-authors
* Not verified from an official npj page and marked above: the no-citation rule for the abstract,
  the 88/180 mm typeset figure widths. The word and page targets and the Methods checklist are
  recommendations, not journal rules.
