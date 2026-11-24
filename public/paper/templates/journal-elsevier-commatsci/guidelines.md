# Computational Materials Science (Elsevier): Paper Writing Guidelines

These instructions help you write the LaTeX paper for **Computational Materials Science** (Elsevier). The same template works for other Elsevier journals: only the `\journal{...}` line changes (see "Choosing the Journal").

The template uses Elsevier's official LaTeX class `elsarticle` (v3.3; `elsarticle.cls` and `elsarticle-num.bst` are in this folder). It produces Elsevier's submission manuscript: single column, 12 pt, A4, with the graphical abstract on page 1, the highlights on page 2, then the title page (title, author, affiliation, abstract, keywords), numbered sections and numbered references in square brackets. The page footer reads "Preprint submitted to Computational Materials Science".

## Language
All manuscripts must be in English. Write clear, formal scientific prose for computational materials scientists, physicists and chemists.

## Choosing the Journal (for the person setting up the run, not for the writer)
* To target another Elsevier journal, change only `\journal{Computational Materials Science}`. Then check that journal's Guide for Authors, because the abstract limit, highlights, graphical abstract and reference style differ between journals.
* For a two-column preview that looks like the printed journal, comment out `\documentclass[preprint,12pt]{elsarticle}` and uncomment `\documentclass[final,5p,times,twocolumn]{elsarticle}`. Both lines compile with this template. Submit the preprint layout. The guide for authors says double-column formatting is only allowed for LaTeX submissions.
* The writer must not change the class line.

## Review Model and Author Information
Computational Materials Science uses **single anonymized** (single-blind) review: referees see the author names, and the manuscript is not anonymized. The journal asks for each author's given and family names, affiliations marked with lower-case superscript letters, and the corresponding author's e-mail on the title page. This template uses one placeholder author with elsarticle's own macros. They must stay exactly as they are:

```latex
\author[inst1]{A. Researcher\corref{cor1}}
\ead{researcher@example.edu}
\cortext[cor1]{Corresponding author.}
\affiliation[inst1]{organization={Department of Chemistry, Example University},
            city={City},
            country={Country}}
```

* `\corref`/`\cortext` mark the corresponding author with an asterisk footnote.
* `\ead` prints the e-mail address in the footnote.
* `[inst1]` links the author to the affiliation (superscript "a").

Do not add authors, affiliations, `\fntext`, `\tnotetext`, ORCID iDs or present addresses.

## Scope
Computational Materials Science publishes papers that advance computational materials science with modern computational methods, alone or combined with experiment. The Guide for Authors states:

* Simulation papers **must contain new conceptual or computational advances**. A routine calculation on one more material is not enough: say clearly what is new (method, model, data set, physical insight) and why it matters. The guide strongly recommends an in-depth discussion of the impact, the physical properties and the motivation for the system studied.
* **Validation** of non-first-principles methods (interatomic potentials, machine-learned models, phase-field, CALPHAD, continuum models) and of their transferability must be part of every submission.
* **Data-driven and machine-learning papers** must provide data and code that follow the FAIR principles. Methodological papers without FAIR data and code are returned without review.
* Out of scope:
    * mainly experimental papers with some supporting theory;
    * biomolecules, drugs, bone and medical applications;
    * asphalt, cement, concrete and related materials.
* Small molecules or clusters, the design of structural components, device performance and transport-only studies are described as better suited to other journals. Frame such work in terms of the material: its structure, defects, phases and properties.

## Article Types and Length
The journal accepts **critical reviews, articles, letters and perspectives**. The Guide for Authors states **no word or page limit** for any type (check the current author guidelines before relying on that for letters).

**Target for this paper (a regular article):** aim for about 8–12 printed journal pages. That is roughly 5000–8000 words of main text with about 6–10 figures and tables. This is a writing target, not a journal rule. One two-column journal page holds about 2.5 pages of this 12 pt preprint layout, so expect a PDF of about 20–30 pages, including the graphical-abstract and highlights pages and the references. Do not shorten the methods or the validation to save space. Put extended data in the supplementary material.

## Title, Highlights, Graphical Abstract, Abstract and Keywords
* **Title** (`\title{...}`): concise and informative. Avoid abbreviations and formulae where possible. Sentence case, no full stop.
* **Highlights** (`highlights` environment, required by the journal at submission):
    * 3 to 5 `\item` lines, each **at most 85 characters including spaces**;
    * each highlight states one concrete finding or contribution, e.g. a number with its unit or a validated method;
    * no citations, no undefined abbreviations, no references to figures;
    * keep every highlight as an `\item`, because text without `\item` breaks the compile.
* **Graphical abstract** (`graphicalabstract` environment, required by the journal at submission): see "Graphical Abstract" below.
* **Abstract** (`abstract` environment):
    * one paragraph of **at most 250 words** (aim for 150–250);
    * state the purpose, the methods (level of theory or model), the main quantitative results with units, and the conclusion, and emphasize what is new;
    * it must stand alone: no citations (the guide says to avoid references, and if one is essential to cite author and year), no references to figures, tables or equations, and no displayed equations;
    * avoid non-standard or uncommon abbreviations, and define any essential abbreviation at first use, e.g. density functional theory (DFT).
* **Keywords** (`keyword` environment):
    * **1 to 7** keywords in English, separated by `\sep`, e.g. `Density functional theory \sep Phonons \sep Thermal conductivity`;
    * avoid long multi-word phrases and connecting words such as "and" or "of";
    * use abbreviations only if they are firmly established in the field (e.g. DFT).

## Required Section Order
Use exactly the sections of `template.tex`, in this order:

1. Graphical abstract and highlights (printed by the class on pages 1 and 2)
2. Title, author, affiliation and e-mail, abstract and keywords (printed by the class at `\end{frontmatter}`)
3. **1. Introduction**
4. **2. Computational methods**
5. **3. Results and discussion**
6. **4. Conclusions**
7. Back matter (unnumbered `\section*`), in this order:
    * CRediT authorship contribution statement;
    * Declaration of competing interest;
    * Declaration of generative AI and AI-assisted technologies in the manuscript preparation process;
    * Data availability;
    * Supplementary material;
    * Acknowledgements.
8. Appendices, only if needed (`\appendix`, then `\section{...}`; numbered A, B with Eq. (A.1), Table A.1)
9. References (`\bibliography{references}`)

There is **no separate Related Work section**. Literature context, the state of the art and the gap this work fills belong in the Introduction. Comparisons with earlier computed or measured values belong in Results and discussion. The Introduction goes from the materials problem, to what earlier methods and studies achieved (with citations), to the remaining limitation, to what this work does and finds.

Sections are numbered automatically (1, 2, ...; subsections 1.1, 1.1.1). Never number headings by hand. Use `\subsection` for structure, and do not create a single orphan subsection. Elsevier headings are in sentence case ("Results and discussion"). For a method-development paper, structure Computational methods with subsections such as "Theory" (the new model and its equations; the guide says it should lay the foundation for further work) and "Computational details" (everything needed to reproduce the calculations). If the study also uses experimental data, describe its source in a clearly titled subsection.

## Writing the Computational Methods Reproducibly
The journal expects referees to be able to reproduce the results, and it requires validation of non-first-principles methods. Describe every calculation that the conclusions rely on. Report only what the provided materials state. If a detail is missing, leave it out; do not guess it. Cite the original papers for every code, functional, pseudopotential library, basis set, dispersion correction, solvation model, interatomic potential and analysis tool.

**Electronic-structure (DFT and beyond) calculations of solids, surfaces and molecules**
* Code and exact version (e.g. "VASP 6.4.2", "Quantum ESPRESSO 7.2", "CP2K 2024.1", "ORCA 5.0.4"), and any modifications.
* Exchange–correlation functional (e.g. PBE, PBEsol, r2SCAN, HSE06), with the Hubbard U values and how they were chosen for DFT+U.
* Dispersion correction (e.g. D3(BJ), D4, rVV10).
* Core treatment and basis: PAW datasets or pseudopotentials with their library and version, and valence configurations. Give the plane-wave cutoff, or the Gaussian basis set (with auxiliary basis and effective core potentials).
* Brillouin-zone sampling (k-point mesh or density) and smearing method and width.
* Convergence criteria for the SCF energy, forces and stress; whether cell shape and volume were relaxed.
* Supercell size and how it was converged; vacuum thickness and dipole correction for slabs; finite-size corrections for charged defects.
* Spin polarization and magnetic ordering; spin–orbit coupling.
* Implicit solvation (e.g. VASPsol, SMD, CPCM) and the solvent, where relevant.
* Phonons and thermodynamics: method (finite displacement or DFPT), code (e.g. phonopy), supercell, and quasi-harmonic treatment. Transition states: NEB or climbing-image NEB with the number of images, and the force convergence.

**Atomistic simulation (MD, Monte Carlo, kinetic Monte Carlo)**
* Code and version (e.g. LAMMPS release date).
* Interatomic potential or force field with its source and version (e.g. OpenKIM or NIST repository identifier). Reasons for choosing it, and its validation for the properties studied.
* System size and composition, boundary conditions, ensemble, thermostat and barostat with coupling constants, and time step.
* Equilibration and production lengths, and the number of independent runs or seeds.
* How averages, convergence and statistical uncertainties were obtained (block averaging, standard error, bootstrapping).

**Machine-learned interatomic potentials and data-driven models**
* Model type and code version (e.g. MACE, NequIP, GAP, DeePMD), with the cutoff radius and main hyperparameters.
* Training data: source, level of theory, number and kinds of configurations, active-learning procedure.
* Train, validation and test splits.
* Errors on energies (meV/atom), forces (meV/Å) and stresses on held-out data.
* Validation on properties not in the training set (transferability), and comparison with DFT or experiment.
* FAIR availability of data, code and trained models (mandatory for data-driven papers, see "Data availability").

**Mesoscale and continuum models (phase field, CALPHAD, crystal plasticity, FEM)**
* Governing equations, parameters with their sources, and the calibration procedure.
* Discretization, mesh or grid convergence, time integration and solver tolerances.

**Benchmarks and errors**
* Name the reference data (experiment or higher-level theory, with citations).
* Report error statistics (MAE, RMSE, maximum error) with units and the number of data points.
* Separate statistical uncertainty from model error. Do not claim more significant figures than the convergence supports.

## Units and Notation
The Guide for Authors has no units section, so these are the usual conventions of the field and of Elsevier:

* Use SI units and the accepted non-SI units of the field:
    * eV or eV/atom (or meV/atom) for energies of solids, and kJ/mol or kcal/mol for molecular thermochemistry;
    * Å or nm for distances, GPa for pressure and elastic constants, K for temperature, fs, ps or ns for time;
    * W m^-1 K^-1 for thermal conductivity.
* Pick **one energy unit** and use it consistently in text, tables and figures. If two units appear, give the conversion once (1 eV = 96.485 kJ/mol = 23.061 kcal/mol; 1 kcal/mol = 4.184 kJ/mol).
* Typeset quantities with the siunitx macros provided by the template:
    * `\qty{520}{\electronvolt}` or `\SI{1.5}{\kilo\calorie\per\mole}` for a number with its unit;
    * `\unit{\milli\electronvolt\per\atom}` or `\si{...}` for a unit alone (table headers, axis labels);
    * `\num{1e-6}` for a bare number.
* The template adds `\calorie`, `\atom` and `\angstrom` to siunitx (`\qty{0.01}{\electronvolt\per\angstrom}`).
* Do not use `\sisetup`, `\DeclareSIUnit`, the `S` table column or other advanced siunitx features. The template must also compile with its fallback definitions, which only cover `\SI`, `\si`, `\num`, `\qty`, `\unit`, `\SIrange`, `\qtyrange` and `\numrange` with common units.
* Chemical formulas, phases and reactions use mhchem syntax:
    * formulas: `\ce{TiO2}`, `\ce{LiFePO4}`, `\ce{Li_{x}CoO2}`;
    * ions: `\ce{Fe^3+}`;
    * reactions: `\ce{H2O + CO2 -> H2CO3}`.
    Do not write formulas as `TiO$_2$`, and do not put `\ce` inside `\mathrm`.
* Crystal directions and planes: `[110]` and `(111)`, or `$\langle 111\rangle$` and `$\{110\}$`. Space groups in italics with the number, e.g. `$Fm\bar{3}m$` (No. 225).
* The guide asks for variables in italics, the solidus for small fractions (X/Y), and exp for powers of e. Units, element symbols, method names and descriptive subscripts are roman (`E_{\mathrm{f}}`, `E_{\mathrm{m}}`).
* Define each abbreviation at first use, once in the abstract and again in the main text.
* Number displayed equations with `equation` and `\label{eq:...}`, numbered consecutively. Refer to them in Elsevier style as `Eq.~\eqref{eq:x}` ("Eq. (1)"). Refer to figures as `Fig.~\ref{fig:x}` ("Fig. 1"), tables as `Table~\ref{tab:x}` and sections as `Section~\ref{sec:x}`. Do not use `\cref` or `\autoref`, which are not loaded.

## Figures and Tables
* All figures are in the `figures/` directory. Use every figure in the figures list with the exact file name and extension, e.g. `\includegraphics[width=\linewidth]{figures/phonon_dispersion.png}`.
* Elsevier print sizes:
    * single column 90 mm (255 pt);
    * 1.5 column 140 mm (397 pt);
    * full width 190 mm (539 pt).
* In this preprint layout the text block is 13.7 cm wide. Use `width=\linewidth` for figures that will be full width in the journal, and `width=0.65\linewidth` (about 9 cm) for figures that will be single column. Use the `figure` environment with `[tb]` or `[htbp]` placement.
* Lettering at final printed size: about 7 pt for normal text, with subscripts and superscripts no smaller than 6 pt. The lettering should not vary much in size between panels and figures. Use one sans-serif font (e.g. Arial or Helvetica) throughout.
* Resolution:
    * photographs and renderings at least 300 dpi (1063 px wide for one column, 2244 px for full width);
    * bitmap line drawings at least 1000 dpi;
    * vector graphics (PDF/EPS) with embedded fonts are preferred for plots.
* Color: RGB color space. Use color-blind-safe palettes (Okabe–Ito, viridis, cividis), never distinguish data by red versus green alone (add markers, line styles or direct labels), and keep figures readable in grayscale.
* Plots: label every axis with quantity and unit, e.g. "Energy / eV atom$^{-1}$", in the same energy unit as the text. No titles inside panels. Label panels (a), (b) and explain them in the caption. Do not merge unrelated graphs into one figure. For crystal structures, give the projection direction and a color key for the elements.
* Captions: a brief title (not shown on the figure itself), then a description that explains every symbol, abbreviation, color and level of theory. Do not write "Figure 1:" in the caption text; the class adds it. Captions go below figures, and table captions go above tables.
* AI-generated images: under Elsevier policy, AI tools must not fabricate or alter data in figures. Schematic diagrams made with AI tools need the tool named in the caption.
* Tables:
    * editable LaTeX tables only, never images;
    * booktabs rules (`\toprule`, `\midrule`, `\cmidrule`, `\bottomrule`), no vertical rules and no shading;
    * table notes go below the table body;
    * give units in column headers (e.g. `$E_\mathrm{f}$ (eV)`);
    * cite every table in the text, number tables in order of appearance, and do not repeat data shown in figures.

Example code for a figure and a table:
```latex
\begin{figure}[tb]
  \centering
  \includegraphics[width=0.65\linewidth]{figures/energy_volume.png}
  \caption{Energy--volume curves of bcc, fcc and hcp W from DFT (PBE).
  Energies are relative to the bcc minimum.}
  \label{fig:eos}
\end{figure}

\begin{table}[tb]
  \centering
  \caption{Vacancy formation and migration energies (eV) in bcc W.}
  \label{tab:defects}
  \begin{tabular}{@{}lcc@{}}
    \toprule
    Method & $E_\mathrm{f}$ & $E_\mathrm{m}$ \\
    \midrule
    DFT (PBE) & 3.27 & 1.73 \\
    MACE      & 3.22 & 1.70 \\
    \bottomrule
  \end{tabular}
\end{table}
```

## Graphical Abstract
The journal requires a graphical abstract: one image that summarizes the paper's main result for readers scanning the table of contents.

* Elsevier's size is an image of at least 1328 × 531 pixels (w × h), or proportionally more, readable at **13 cm × 5 cm** (w × h). That is a wide, short landscape strip, about 2.5 : 1.
* Preferred file types are TIFF, EPS, PDF or MS Office files. A PNG from `figures/` is fine for this LaTeX draft, and the authors upload the final file separately at submission.
* Elsevier forbids general-purpose generative AI image tools for graphical abstracts.

The template prints it with the class's `graphicalabstract` environment on its own page before the title page. The block reads `figures/toc_graphic.png` if that file exists and otherwise shows a framed placeholder box with the required size.

How to fill it:
1. Choose the single most representative figure already in `figures/`: the one that best shows the main result, e.g. the key structure, energy profile, phase diagram or parity plot. Prefer a landscape figure with large labels and little text.
2. In the `graphicalabstract` block of `template.tex`, replace **both** occurrences of `figures/toc_graphic.png` with that file name (e.g. `figures/phase_diagram.png`). Keep `width=13cm,height=5cm,keepaspectratio`, which scales it to the required size.
3. Keep the placeholder (`\fbox`) branch of `\IfFileExists` unchanged. It is used if the file is missing.
4. If no existing figure suits a 13 cm × 5 cm strip, leave the block exactly as it is: the placeholder stays, and the authors supply the graphic.
5. Never invent a figure, draw a new one with TikZ, or include a file that is not in `figures/`.

## References
* Cite with `\cite{key}` using only keys in `references.bib`. Citations print as numbers in square brackets, [1] or [1,2], numbered in the order of first citation, as Computational Materials Science requires.
* Do not use `\citet` or `\citep` with author names. Cite the work as a number, e.g. "Perdew et al. [1] showed ...", or "as shown previously [1]".
* The bibliography style is `elsarticle-num` (Elsevier numbered style: initials before surnames, title in sentence case, journal, volume, year and pages). Keep `\bibliographystyle{elsarticle-num}` and `\bibliography{references}`.
* The style changes titles to sentence case. In `references.bib`, protect acronyms and formulas with braces, e.g. `title={{MACE}: Higher order ...}` or `{TiO$_2$}`.
* The journal accepts any consistent style at submission and applies its own at proof. Journal names should be abbreviated according to the ISSN List of Title Word Abbreviations (LTWA).
* Cite the original papers for methods, codes, potentials and data sets (e.g. the Materials Project or other databases) that you used.

## Back Matter Statements
Write each statement only from what the provided materials (idea, experimental log) say. If the materials do not give the information, write "To be completed by the authors." Never invent funding, grant numbers, repositories, DOIs, contributions or conflicts.

* **CRediT authorship contribution statement**: required. List each author with their roles from the CRediT taxonomy:
    * Conceptualization, Methodology, Software, Validation, Formal analysis, Investigation, Resources, Data Curation;
    * Writing - Original Draft, Writing - Review & Editing;
    * Visualization, Supervision, Project administration, Funding acquisition.

  Format: `\textbf{A. Researcher:} Conceptualization, Methodology, Software.` If the materials do not state the roles, write "To be completed by the authors."
* **Declaration of competing interest**: required (authors also complete Elsevier's declarations tool). If the materials state there are no competing interests, use Elsevier's standard sentence: "The authors declare that they have no known competing financial interests or personal relationships that could have appeared to influence the work reported in this paper." (the wording of Elsevier's declarations tool; check the current author guidelines) Otherwise write "To be completed by the authors."
* **Declaration of generative AI and AI-assisted technologies in the manuscript preparation process**: required by Elsevier when generative AI was used to prepare the manuscript, and this draft is produced with an AI writing pipeline. Keep the section and use Elsevier's template sentence with the bracketed fields left for the authors: "During the preparation of this work the author(s) used [NAME OF TOOL / SERVICE] in order to [REASON]. After using this tool/service, the author(s) reviewed and edited the content as needed and take(s) full responsibility for the content of the published article."
* **Data availability**: the journal requires research data (including code and models) to be deposited in a relevant repository and cited, or a statement explaining why they cannot be shared. Data-driven papers must provide FAIR data and code, e.g. code on GitHub and data on Zenodo, or a Docker container. Name the repository and identifier only if the materials give them. Use `\url{...}` for links.
* **Supplementary material**: see below. If the materials mention no supplementary files, write "To be completed by the authors."
* **Acknowledgements**: people who helped with the research, and funding sources with grant numbers. Elsevier asks authors to disclose all funding; with no specific funding, the suggested sentence is "This research did not receive any specific grant from funding agencies in the public, commercial, or not-for-profit sectors." Use either only as stated in the materials; otherwise write "To be completed by the authors." The guide places Acknowledgements directly before the reference list.

## Supplementary Material
* Put extended data in the supplementary material: convergence tests, full benchmark tables, additional structures, NEB paths, training-set details, input files and coordinates (CIF/POSCAR or XYZ).
* Cite every supplementary item in the text, e.g. "(Fig. S1 in the supplementary material)", "Table S2".
* In the "Supplementary material" section, give a concise, descriptive caption for each supplementary file.
* Supplementary files are published online as supplied (they are not typeset). They are not part of this LaTeX file: do not create them, and do not refer to supplementary items that the materials do not support.
* Everything needed to follow the main argument must stay in the main text.

## Important Rules
* **Class and packages:** keep `\documentclass[preprint,12pt]{elsarticle}`, `\journal{...}` and the whole package block unchanged.
    * Do not add packages; in particular, do not add natbib, cite, geometry, hyperref, cleveref, a font package or `\usepackage{mhchem}` again.
    * Do not change the `\IfFileExists` guards or fallback definitions.
* **Figures directory:** all figures are in `figures/`. Always include the `figures/` prefix in `\includegraphics` (e.g. `figures/figure_1.png`, not `figure_1.png`), or the build fails to find them.
* **Author placeholder:** keep the author block exactly as it is: A. Researcher, Department of Chemistry, Example University, City, Country, researcher@example.edu, marked as corresponding author with `\corref{cor1}`, `\cortext[cor1]{Corresponding author.}` and `\ead{researcher@example.edu}`.
* **No invention:** do not invent authors, affiliations, funding, grant numbers, repositories, DOIs, data, or numerical results that are not in the provided materials.
* **No Related Work section:** literature context goes in the Introduction. Do not add sections that `template.tex` does not have; `\subsection` inside them is fine.
* **Frontmatter:** keep the `frontmatter` block with its `graphicalabstract`, `highlights` (3–5 `\item` lines, at most 85 characters each), `abstract` (at most 250 words, no citations) and `keyword` (1–7 keywords separated by `\sep`) environments.
    * In the graphical abstract, change only the file name (both occurrences) as described above, and keep the placeholder branch.
* **Back matter:** keep all six unnumbered back-matter sections in their order, and keep `\bibliographystyle{elsarticle-num}` and `\bibliography{references}`.
* **Compilable chemistry and units:** use `\ce{...}` for formulas and `\qty`/`\SI`/`\unit`/`\si`/`\num` for quantities with standard siunitx unit macros (plus `\calorie`, `\atom`, `\angstrom`). Do not use `\sisetup`, `\DeclareSIUnit` or `S` columns. Escape `%`, `&`, `_` and `#` in text.
* **Cross-references:** use `\ref`/`\eqref` with "Fig.", "Table", "Eq." and "Section". Every figure, table and equation you label must be referenced in the text.

## Sources
Rules checked on 18 November 2026 against:
* Computational Materials Science, Guide for Authors: https://www.sciencedirect.com/journal/computational-materials-science/publish/guide-for-authors
* Elsevier, Artwork sizing: https://www.elsevier.com/authors/policies-and-guidelines/artwork-and-media-instructions/artwork-sizing
* Elsevier, Artwork formats checklist: https://www.elsevier.com/about/policies-and-standards/author/artwork-and-media-instructions/artwork-formats-checklist
* Elsevier, CRediT author statement: https://www.elsevier.com/authors/policies-and-guidelines/credit-author-statement
* Elsevier, Generative AI policies for journals: https://www.elsevier.com/about/policies-and-standards/generative-ai-policies-for-journals
* Elsevier, LaTeX instructions: https://www.elsevier.com/authors/policies-and-guidelines/latex-instructions
* elsarticle class on CTAN: https://ctan.org/pkg/elsarticle
