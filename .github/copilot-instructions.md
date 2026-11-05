# Instructions for GitHub Copilot

This repository has one source of truth for how to work in it: read `CLAUDE.md` first, then the files under `docs/` it points to. In short:

- The site in `public/` is plain JavaScript with no framework or build step; follow the style of the files next to the one you edit.
- Chinese is the source language of the interface. New interface text is written in Chinese, then `tools/i18n-extract.ts` and `tools/i18n-translate.ts` produce the English dictionary. Do not edit `public/i18n/en.js` by hand.
- Generated files are never edited by hand: `public/radar/app/`, `public/qchem/app/`, `public/hub/data.*`, `public/merged-data.*` (rebuilt by `maintenance/` and `tools/hub-chemrxiv.ts`, weekly by `.github/workflows/refresh-data.yml`).
- Colours come from the CSS variables in `public/shared-nav.css`; check light and dark themes.
- Real keys and secrets never go into the repository. The repository is public.
- New features get a check in `tools/e2e/run.mjs`.
