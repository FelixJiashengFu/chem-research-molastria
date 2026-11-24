# MCM / ICM Mathematical Modeling Paper Writing Guidelines

This template targets COMAP MCM/ICM contest papers requiring a self-contained Summary Sheet, explicit assumptions & notation table, exploratory data analysis, multi-model comparison with quantitative metrics, and rigorous sensitivity/robustness analysis.

## Structure & Contest Standards
* Keep the Summary Sheet (`abstract`) crisp (under 1 page): problem, modeling pipeline, verified numerical metrics, and actionable insights.
* Center all variable notation and model comparison tables cleanly with `booktabs` (`\toprule`, `\midrule`, `\bottomrule`).
* Include explicit ablation or multi-model comparisons (e.g., baseline linear/ARIMA vs ensemble/ML models with MAE, RMSE, MAPE, $R^2$) and parameter perturbation sensitivity checks.

## Important Rules
* Keep all figures in `figures/` and always cite them with the `figures/` prefix.
* Keep all numerical metrics faithful to the verified experimental execution logs.
* Do not invent team control numbers, institutional affiliations, or external references.
