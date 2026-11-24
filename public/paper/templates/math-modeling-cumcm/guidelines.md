# CUMCM / 电工杯 Mathematical Modeling Contest Guidelines

Designed for national mathematical modeling competitions (CUMCM / 电工杯): dual-engine XeLaTeX (`ctex`)/pdfLaTeX support, GB/T 7714 sequential references (`unsrt`), separated abstract page, centered tables, exploratory analysis, multi-model benchmarking, and sensitivity verification.

## Contest Standards
* Separate the contest abstract page from Section 1 (`\newpage`).
* Present clear model assumptions and centered notation/metric tables.
* Support every chosen model with quantitative side-by-side comparison metrics (MAE, RMSE, MAPE, $R^2$) and feature-importance/sensitivity verification.

## Important Rules
* Keep all generated charts in `figures/` and reference them with the `figures/` prefix.
* Keep `\documentclass[12pt,a4paper]{article}` and the XeLaTeX/pdfLaTeX preamble intact.
* Report only verified execution results from your modeling pipeline.
