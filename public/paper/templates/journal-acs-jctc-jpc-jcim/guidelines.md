# ACS Computational Chemistry Journals: Paper Writing Guidelines

These instructions help you write the LaTeX paper for American Chemical Society (ACS) journals in computational chemistry:

* **Journal of Chemical Theory and Computation (JCTC)**: the default target of this template;
* **The Journal of Physical Chemistry A, B and C (JPC A/B/C)**;
* **Journal of Chemical Information and Modeling (JCIM)**.

The template uses the official ACS LaTeX class `achemso` (v3.13g; the class, its journal configuration files and `achemso.bst` are in this folder). It produces the ACS submission manuscript: single column, 12 pt, double spaced, title block first, numbered superscript citations, and the TOC graphic printed on its own page at the end.

## Language
All manuscripts must be in English. Write in clear, formal scientific prose for computational and physical chemists.

## Choosing the Journal (for the person setting up the run, not for the writer)
The active class line is `\documentclass[journal=jctcce,manuscript=article]{achemso}` (JCTC). To target another journal, comment it out and uncomment one of the alternatives directly below it in `template.tex`:

| Journal | Class option | What the class changes |
|---|---|---|
| J. Chem. Theory Comput. | `journal=jctcce` | numbered sections; all authors listed in references |
| J. Phys. Chem. A | `journal=jpcafh` | unnumbered sections, title page on its own page, bold table captions |
| J. Phys. Chem. B | `journal=jpcbfk` | same as JPC A |
| J. Phys. Chem. C | `journal=jpccck` | same as JPC A |
| J. Chem. Inf. Model. | `journal=jcisd8` | unnumbered sections |

Keep `manuscript=article`. Adding `layout=twocolumn` to the options gives a two-column preview that looks like the printed journal; it is for previewing only, so ACS submissions use the default layout. All five lines compile with this template. The writer must not change the class line.

## Review Model and Author Information
These journals use single-blind peer review: author names are visible to referees, and the manuscript is not anonymized. This template uses one placeholder author with achemso's own macros, which must stay exactly as they are:

```latex
\author{A. Researcher}
\email{researcher@example.edu}
\affiliation{Department of Chemistry, Example University, City, Country}
```

`\email` marks the corresponding author with an asterisk and prints the contact e-mail under the affiliation. The class prints the title block automatically at `\begin{document}`, so `\maketitle` is not needed. Do not add authors, affiliations, `\phone`, `\fax`, `\altaffiliation`, `\thanks`, `\and`, or ORCID iDs (ACS says ORCID iDs must not be typed into the manuscript).

## Scope
* **JCTC** publishes new theories, methods and applications in quantum electronic structure, molecular dynamics and statistical mechanics, plus computational packages with innovative methods. It does not consider straightforward applications of well-established methods (DFT, traditional wave function theory, MD) to a single class of systems. It favors advances in theory, methodology and data science, so the paper must say clearly what is methodologically new and show it with benchmarks.
* **JPC A/B/C** publish physical chemistry. In practice, A covers molecules, spectroscopy, kinetics and dynamics, B covers biophysical and soft matter, liquids and solutions, and C covers energy conversion, materials, surfaces and nanostructures. Applications are welcome if they give physical insight.
* **JCIM** publishes new methods in chemical informatics and molecular modeling, including machine learning, docking, QSAR/QSPR, simulation and databases. It does not consider straightforward applications of docking to a single target without adequate experimental validation. New modeling approaches must be benchmarked on several different tasks.

## Article Types and Length
None of these journals sets a hard page limit for regular Articles. Be concise, and keep extended data in the Supporting Information.

* **JCTC**: Articles have no stated length limit. Letters are limited to 4 journal pages (16 double-spaced manuscript pages including all material), with a 75-word abstract. Reviews (~10,000 words) and Perspectives are by invitation or accepted proposal only.
* **JPC A/B/C**: Articles have no page limit ("as concise as possible"). Featured Articles are about 8 printed pages, and Comments about one page (1000 words). Letters go to J. Phys. Chem. Lett. instead.
* **JCIM**: Articles have no stated limit. Letters are limited to 4 journal pages (about 3500 words including references and graphics, with a 75-word abstract). Application Notes are at most 4000 words, excluding references. For length counting, a single-column image counts as 300 words and a double-column image as 600 words.

**Target for this paper (a regular Article):** aim for about 8–12 journal pages, i.e. roughly 5000–8000 words of main text with about 6–10 figures and tables. This is a writing target, not a journal rule. JCTC equates one journal page with about four double-spaced manuscript pages, so in this template's layout the PDF will be about 30–45 pages including references and the TOC page. Do not shorten the methods or results to save space, because the journals do not count pages.

## Title and Abstract
* **Title**: specific and informative. JCTC and JCIM prefer 12 words or fewer. JPC asks for Title Case. Avoid "Investigation", "Study", "Novel", "First", "Facile" and "One Pot" (JPC guidance, good practice for all three). Avoid abbreviations in the title, except universally known ones such as DFT and MD.
* **Abstract**: one paragraph in the `abstract` environment.
    * JCTC and JCIM ask for an abstract of 3–4 sentences.
    * JPC A/B/C ask for 100–200 words.
    * Use 3–5 sentences and at most 200 words. It must be informative (what was done, the key quantitative result with units, the conclusion), not descriptive.
    * No citations, no references to figures, tables or sections, no equations and no graphics. Define every abbreviation at first use.

## Required Section Order
Use exactly the sections of `template.tex`, in this order:

1. Title, author, affiliation and e-mail (printed by the class)
2. Abstract
3. **Introduction**
4. **Computational Methods**
5. **Results and Discussion**
6. **Conclusions**
7. Data and Software Availability (unnumbered)
8. Supporting Information (`suppinfo` environment, unnumbered)
9. Acknowledgement (`acknowledgement` environment, unnumbered)
10. References (`\bibliography{references}`)
11. TOC graphic (`tocentry` environment; the class prints it on the last page)

There is **no separate Related Work section**. The literature context, the state of the art and the gap your work fills belong in the Introduction, and comparisons with earlier computed or measured values belong in Results and Discussion. The Introduction should go from the chemical problem, to what previous methods and studies achieved (with citations), to the remaining limitation, to what this work does and finds.

Section numbering is automatic: numbered for JCTC, unnumbered for JPC and JCIM. Never number headings by hand. Use `\subsection` for structure. Do not create a single orphan subsection, and do not use a subsection for a single paragraph.

For a method-development paper, structure Computational Methods with subsections such as **Theory** (the new method and its equations) and **Computational Details** (everything needed to reproduce the calculations). JPC also accepts the names "Theory" and "Computational Details" for this section, but keep the `\section` title of the template. If the study also contains measurements, describe them in a clearly titled subsection of Computational Methods.

## Writing the Computational Methods Reproducibly
ACS asks that every calculation integral to the study be described so that readers can reproduce it. This includes the software and its version, any modifications to the program or its parameters, the force field and the convergence criteria. Full details (structures, energies, frequencies) go in the Supporting Information in machine-readable form. Report only what the provided materials state. If a detail is missing, leave it out; do not guess it. Cite the original papers for every method, functional, basis set, dispersion correction, solvation model, force field and program.

**Electronic-structure calculations**
* Program and exact version (e.g. "ORCA 5.0.4", "Gaussian 16, Rev. C.01"). Mention any modified code.
* Method or functional, and basis set (with auxiliary or RI basis sets and effective core potentials for heavy elements).
* Dispersion correction (e.g. D3(BJ), D4, VV10) and its damping.
* Integration grid; SCF convergence and geometry-optimization thresholds.
* Spin state or multiplicity, and treatment of open shells (unrestricted or restricted, spin contamination).
* Relativistic treatment, if any.
* Frequency analysis: number of imaginary frequencies for minima and transition states; IRC checks.
* Thermochemistry: temperature, pressure or standard state (and conversion to 1 M), and the quasi-harmonic or low-frequency treatment.
* Solvation model (e.g. SMD, CPCM, COSMO), the solvent and its dielectric constant, and explicit solvent molecules.
* Wave-function reference methods: e.g. CCSD(T) or DLPNO-CCSD(T) with its PNO thresholds, complete basis set extrapolation scheme, counterpoise correction.

**Molecular simulations (MD, MC, QM/MM)**
* Program and version, force field and version, water model.
* Ligand parameterization (e.g. GAFF2 with AM1-BCC or RESP charges).
* System composition and box size, boundary conditions.
* Ensemble, thermostat and barostat with their coupling constants, time step, constraints.
* Nonbonded cutoff and long-range electrostatics (e.g. PME).
* Minimization and equilibration protocol.
* Production length and number of independent replicas.
* Enhanced-sampling parameters (collective variables, bias deposition, windows).
* QM/MM partitioning and boundary treatment.
* How convergence and statistical uncertainty were assessed (block averaging, standard error, bootstrapping).

**Cheminformatics and machine learning (essential for JCIM)**
* Data sources with versions, and data curation steps. JCIM disfavors papers without a data-curation section.
* Train, validation and test splits (random, scaffold or time split), descriptors and features, and model architecture.
* Hyperparameter selection, baselines and evaluation metrics with uncertainties.
* Applicability domain (OECD principles for QSAR/QSPR).
* Benchmarking on several tasks.

**Benchmarks and errors**
* Name the reference data (experiment or high-level theory, with citations).
* Report the error statistics used (MAE, RMSE, maximum error, mean signed error) with units, and the sample size.
* Separate statistical uncertainty from method error.

## Units and Notation
* Use SI units. Energies in kcal/mol, kJ/mol, eV or hartree, distances in Å or pm, and times in fs, ps, ns or µs are all accepted in these journals. Pick **one energy unit** and use it consistently in text, tables and figures. If both appear, state the conversion (1 kcal/mol = 4.184 kJ/mol).
* Typeset quantities with siunitx macros provided by the template:
    * `\SI{1.5}{\kilo\calorie\per\mole}` or `\qty{298.15}{\kelvin}`;
    * `\si{...}` or `\unit{\kilo\joule\per\mole}` for a unit alone (e.g. in table headers or axis labels);
    * `\num{1.2e-3}` for numbers.
    The template adds `\calorie` and `\angstrom` (`\qty{1.62}{\angstrom}`). Atomic units `\hartree` and `\bohr` also work.
* Do not use `\sisetup`, `\DeclareSIUnit`, the `S` table column type or other advanced siunitx features. The template must also compile with its fallback definitions, which only cover `\SI`, `\si`, `\num`, `\qty`, `\unit`, `\SIrange`, `\qtyrange` and `\numrange` with common units.
* Chemical formulas, ions and reactions use mhchem syntax:
    * formulas: `\ce{H2O}`, `\ce{CO2}`;
    * ions: `\ce{Fe^2+}`, `\ce{SO4^2-}`;
    * reactions: `\ce{H2O + CO2 -> H2CO3}`, `\ce{A <=> B}`.
    Do not write formulas as `H$_2$O`, and do not put `\ce` inside `\mathrm`.
* Variables (energies $E$, free energies $\Delta G^{\ddagger}$, temperature $T$) are italic. Units, chemical element symbols, method names and descriptive subscripts are roman (`G_{\mathrm{TS}}`).
* Define every acronym at first use in the abstract and again in the main text (e.g. density functional theory (DFT)).
* Number displayed equations with `equation` and `\label{eq:...}`. Refer to them in ACS style as "eq~\ref{eq:barrier}" or "eqs~\ref{eq:a} and \ref{eq:b}". Refer to figures and tables as "Figure~\ref{fig:...}", "Table~\ref{tab:...}" and "Scheme~\ref{...}". Do not use `\cref` or `\autoref`, which are not loaded, or `\eqref`, which gives "(1)" instead of the ACS style "eq 1".

## Figures, Schemes and Tables
* All figures are in the `figures/` directory. Use every figure in the figures list, with the exact file name and extension, e.g. `\includegraphics[width=3.3in]{figures/energy_profile.png}`.
* ACS sizes are given for the final journal page. Single-column graphics are up to 3.33 in (240 pt) wide. Double-column graphics are 4.167–7 in (300–504 pt) wide. The maximum depth is 9.167 in (660 pt), including the caption.
* In this single-column manuscript, use `width=3.3in` for single-column figures and `width=\linewidth` (6.5 in) for wide, double-column ones.
* Lettering must be at least 4.5 pt at final size, and lines at least 0.5 pt. Use a sans-serif font (Arial or Helvetica) of about 6–8 pt at final size, consistent across figures.
* Resolution: at least 300 dpi for color images, 600 dpi for grayscale and 1200 dpi for line art.
* Color: use color-blind-safe palettes (Okabe–Ito, viridis or cividis). Never distinguish data by red versus green alone; add marker shapes, line styles or direct labels. Figures must remain readable in grayscale.
* Plots: label every axis with quantity and unit, e.g. "$\Delta G$ / kcal mol$^{-1}$". Use the same energy unit as the text. Do not put titles inside plot panels. Label panels (a), (b) and explain them in the caption.
* Captions: start with a short descriptive phrase, then define symbols, color codes and levels of theory. Do not write "Figure 1:" in the caption text. Figure captions go below the figure, and the class puts table titles above tables automatically.
* Molecular structures and reaction schemes can use the class's `scheme` and `chart` float environments (`\begin{scheme} ... \caption{...} \label{sch:...} \end{scheme}`).
* Tables:
    * use booktabs (`\toprule`, `\midrule`, `\bottomrule`; `\cmidrule` if needed), no vertical rules;
    * give a brief title (one phrase or sentence) and put details in footnotes below the table;
    * avoid merged or split cells;
    * put units in the column header, not in every cell;
    * report only numbers that are in the experimental log.
* Place every figure and table after its first mention, and before the Conclusions.

## TOC Graphic
ACS journals publish a table-of-contents (TOC) or abstract graphic with research articles. It is required for JPC Articles, and the JCTC and JCIM guidelines also specify one (check the current author guidelines).

* **Size**: 3.25 in × 1.75 in (approximately 8.25 cm × 4.45 cm), landscape. This is the size given in the ACS (J. Phys. Chem. Lett.) submission checklist, and it is exactly the frame achemso draws (check the current author guidelines for the specific journal).
* Use minimal text, all of it legible at that size. It must not contain offensive material. If it reuses published material, copyright permission may be needed.
* It is printed by the class under the heading "TOC Graphic" on the last page. Do not reference it in the text.

**How the writer fills the placeholder.** The `tocentry` block of `template.tex` reads:

```latex
\begin{tocentry}
\IfFileExists{figures/toc_graphic.png}{%
  \vfill
  \centering
  \includegraphics[width=3.25in,height=1.7in,keepaspectratio]{figures/toc_graphic.png}\par
  \vfill
}{%
  ... placeholder box ...
}
\end{tocentry}
```

1. If the figures list contains `toc_graphic.png`, leave the block exactly as it is.
2. Otherwise choose the single most representative figure already in `figures/`. This is the one that conveys the main result or concept at a glance, such as an overview scheme, a key structure or a summary energy profile. Prefer a wide, landscape figure with little text.
3. Replace **both** occurrences of `figures/toc_graphic.png` with that file, e.g. `figures/fig_overview.png`, using the exact file name and extension. Keep the `\IfFileExists` wrapper, the placeholder branch and the size options `width=3.25in,height=1.7in,keepaspectratio`, which scale it to fit the frame. Add no caption, label, citation or extra text.
4. If no figure is suitable, keep the block unchanged so the placeholder stays. For example, every figure may be a dense multi-panel plot or a table-like chart that would be unreadable at 3.25 in. The authors will supply the graphic.
5. The chosen figure is still used normally in the main text.

## References and Citations
* Citations are numbered superscripts in order of first citation (achemso style, set by the class). Write `\cite{key}` directly after the word, before punctuation, with no space: `as shown previously\cite{key}.` The class (natmove) moves the number after the period or comma automatically.
* For several sources, use `\cite{a,b,c}`, which is sorted and compressed to 1–3. Use one reference per citation number, as ACS asks. To name authors, write "Grimme and co-workers\cite{key}". To refer to a number in running text, write "ref~\citenum{key}". Do not use `\citet` or `\citep`.
* Use only keys that exist in `references.bib` or `citation_map.json`. Never invent keys.
* Keep `\bibliography{references}`. The class sets the style (`achemso.bst`) and ignores any `\bibliographystyle` command, so do not add one.
* ACS requires complete references with titles. The style prints "Author, A. B.; Author, C. D. Title. *Journal* **Year**, *Volume*, Pages."
* Do not cite in the abstract. Cite software and force fields as well as methods.

## Required Back Matter
The template has these blocks after the Conclusions. Fill each one only with what the provided materials state. If they say nothing, write "To be completed by the authors." Never invent repositories, DOIs, URLs, grant numbers, funders or names.

* **Data and Software Availability**:
    * JCIM's Data and Software Availability requirements apply to all papers since 1 January 2021 (editorial doi:10.1021/acs.jcim.0c01389; check the current author guidelines for the exact items).
    * JCTC and JCIM follow the ACS Research Data Policy Level 2, which requires a Data Availability Statement at submission. JPC strongly encourages public data.
    * State where the data supporting the conclusions are (repository and identifier, or the Supporting Information), which software was used (name and version), whether it is commercial, open source or available from the authors, and where custom code and input files are available.
    * The exact placement and wording of the Data Availability Statement in the manuscript may differ between journals (check the current author guidelines).
* **Supporting Information** (`suppinfo` environment, printed as "Supporting Information"): a brief, non-sentence description of each file with its file type. For example, "Cartesian coordinates of all optimized structures (XYZ); benchmark error statistics, convergence tests and additional figures (PDF)". Writing only "Figures S1–S3" is not sufficient. It appears before the Acknowledgement and References.
* **Acknowledgement** (`acknowledgement` environment):
    * funding sources with grant or award numbers;
    * computing resources;
    * people who helped;
    * any use of AI tools for text or image generation, saying when and how they were used, as ACS requires.
    Optional citation and land acknowledgment statements also go here.
* **Conflict of interest** is collected through the submission system. If there is none, ACS publishes "The authors declare no competing financial interest." Do not add a separate section for it.
* **Author contributions** are not required in the manuscript by these journals' guidelines, and with a single placeholder author none are needed. Do not add them.

## Supporting Information Usage
* Move material the reader does not need to follow the argument to the SI:
    * full Cartesian coordinates and absolute energies;
    * extended benchmark tables, convergence and parameter tests;
    * additional spectra or trajectories analyses;
    * representative input files;
    * force-field parameters.
* The main text must remain complete and understandable without the SI.
* SI items are numbered Figure S1, Table S1 and so on. Refer to them in plain text ("see Table S2 in the Supporting Information"). Do not use `\ref` for them, because they are not in this document.
* Do not create SI content that the materials do not support.

## Style for These Journals
Write a concise, quantitative physical-chemistry narrative.
* State the chemical question first, then the methodological advance, then the evidence.
* Give numbers with units and a sensible number of significant figures, and compare them with reference data.
* Distinguish clearly between computed and experimental values, and between observed trends and interpretation.
* Discuss the limitations of the model chemistry, such as functional dependence, basis-set incompleteness, sampling, the solvation approximation or the size of the training set.
* Avoid promotional language.
* Use "we" sparingly and consistently, and the past tense for what was done.

## Important Rules
* Keep the `\documentclass[journal=jctcce,manuscript=article]{achemso}` line, its commented alternatives and every package line in the preamble unchanged. Do not add packages (in particular hyperref, cleveref, natbib, cite, geometry, setspace, times or fontenc), because the class already handles layout, fonts and citations. Do not remove the `\IfFileExists` guards or the fallback `\providecommand` definitions.
* Keep `\bibliography{references}` and add no `\bibliographystyle`.
* For consistent compilation, all figures are in the `figures` directory. Always include the `figures/` prefix in `\includegraphics` (e.g. `figures/figure_1.png`, not `figure_1.png`).
* Always keep the author placeholder exactly as in `template.tex`: `\author{A. Researcher}`, `\email{researcher@example.edu}`, `\affiliation{Department of Chemistry, Example University, City, Country}` (A. Researcher, Department of Chemistry, Example University, City, Country, researcher@example.edu). Never invent real or fictional authors, affiliations, e-mails, ORCID iDs, funding, grant numbers, data, repositories, DOIs or software versions.
* Do not add a Related Work section, and do not add sections the template does not have. The literature review belongs in the Introduction.
* Keep the `%%%%%%%%% ... %%%%%%%%%` marker lines around each section body.
* Keep the `tocentry`, `suppinfo` and `acknowledgement` environments and the Data and Software Availability section. Fill the TOC block only as described in the TOC Graphic section.
* Keep `\ce{...}` and unit syntax compilable: balanced braces, mhchem version 4 syntax, siunitx unit macros such as `\kilo\calorie\per\mole`, no `S` columns, no `\sisetup`.
* Do not write `\maketitle`, `\thanks` or `\and`, and do not number headings manually.
* Escape LaTeX special characters (`%`, `&`, `_`, `#`) in text and tables.

## Sources
* JCTC Author Guidelines (last updated 8 October 2026): https://researcher-resources.acs.org/publish/author_guidelines?coden=jctcce
* J. Phys. Chem. C Author Guidelines (JPC A/B/C share these guidelines): https://researcher-resources.acs.org/publish/author_guidelines?coden=jpccck and https://researcher-resources.acs.org/publish/author_guidelines?coden=jpcbfk
* JCIM Author Guidelines (last updated 9 November 2026): https://researcher-resources.acs.org/publish/author_guidelines?coden=jcisd8
* TOC graphic size (J. Phys. Chem. Lett. submission checklist): https://researcher-resources.acs.org/publish/author_guidelines?coden=jpclcd
* ACS guidance on TOC graphics: https://axial.acs.org/publishing/graphics-and-tables
* achemso class v3.13g (TeX Live 2023), documentation on CTAN: https://ctan.org/pkg/achemso
