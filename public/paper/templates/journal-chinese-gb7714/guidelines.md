# Chinese Journal (GB/T 7714 Style) Paper Writing Guidelines

This template models standard Chinese peer-reviewed journal conventions (e.g., *Journal of Computers* / 计算机学报 / 中文核心期刊) using sequential numbered citations (`unsrt`, GB/T 7714-2015 order) and clean bilingual abstract separation.

## Citations and Anti-Fabrication
* Cite strictly from verified entries in `references.bib`; order citations sequentially (`[1]`, `[2]`, ...).
* In literature review sections, draft the analytical synthesis before finalizing the research background so background claims stay grounded in read sources.

## Prose Style
* Write cohesive, multi-sentence academic paragraphs with explicit logical transitions (avoid fragmented 1-2 sentence chatty bullets in prose).
* Keep the Chinese and English abstract blocks cleanly separated from the main body text (`\newpage` or explicit page break before Section 1 when preparing Chinese submissions).

## Figures
* Store all figures under `figures/` and include them with the `figures/` prefix, e.g., `\includegraphics[width=0.9\linewidth]{figures/fig1.jpg}`.

## Important Rules
* Keep `\documentclass[11pt,a4paper]{article}` and the XeLaTeX/pdfLaTeX dual-engine preamble intact.
* Keep the author placeholder `A. Researcher` unchanged; never fabricate real authors or grants.
* Store all figures inside `figures/` and reference them with `figures/`.
* Follow the exact section order: `Introduction`, `Methods`, `Results and Discussion`, `Conclusions` (literature review belongs inside `Introduction`, no separate `Related Work` section).
