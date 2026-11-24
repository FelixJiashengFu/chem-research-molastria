/* 生成的文件，不要手改：node tools/paper-templates.mjs（从 PaperOrchestra Studio 的 paper-orchestra/templates/ 复制，Apache-2.0；
   样式文件各自的许可证见 public/paper/THIRD-PARTY-paper-orchestra.md）。每个模板：文件清单（大小、SHA-256 前 16 位）、
   期刊模板的 venue.json、没有放进来的会议样式文件和官方下载地址。 */
(function (root) {
  const TEMPLATES = [
 {
  "id": "journal-nature",
  "kind": "journal",
  "zh": "Nature",
  "en": "Nature",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 6393,
    "sha": "803cb3ce2a024d48"
   },
   {
    "name": "naturemag.bst",
    "bytes": 34867,
    "sha": "fed4788763dedb10"
   },
   {
    "name": "references.bib",
    "bytes": 1056,
    "sha": "70b8dc74d5a66a39"
   },
   {
    "name": "template.tex",
    "bytes": 7765,
    "sha": "bd39d5e6181b566d"
   },
   {
    "name": "venue.json",
    "bytes": 2561,
    "sha": "f1ce907040b01c6a"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "Nature",
   "short_name": "Nature",
   "field": "multidisciplinary natural and computational sciences",
   "review_model": "single-blind",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Results",
    "Discussion",
    "Methods"
   ],
   "abstract_limit": "200 words, single unreferenced summary paragraph written for non-specialists (broad context, specific problem, key advance, quantitative findings, broader implication)",
   "writing_style": "Flagship Nature style for a broad multidisciplinary readership: low-jargon title (at most 75 characters / ~15 words) and summary paragraph accessible outside the immediate subfield; concise unheaded Introduction carrying literature context; Results organized under short informative subheadings that state findings rather than experiments; concise Discussion without subheadings covering significance, honest limitations and outlook (no separate Conclusions section); full reproducible Methods at the end; superscript numbered references.",
   "reviewer_focus": "Referees judge whether the work delivers a conceptual advance of broad scientific significance outside one narrow specialty, backed by rigorous controls, independent validation, complete statistical reporting (n, exact test, effect size/CI) and transparent limitations without overclaiming.",
   "figure_style": "Nature Portfolio figure standards: single column 89 mm (3.5 in) or double column 183 mm (7.2 in) width, Arial or Helvetica sans-serif lettering at 5-7 pt at final size, lines >= 0.5-1 pt, at least 300 dpi RGB, lowercase bold panel labels (a, b, c) and colorblind-safe Okabe-Ito or viridis palettes without red-green contrast or rainbow scales. Each legend opens with a bold one-sentence title covering the whole figure followed by <= 350 words describing every panel and defining error bars/n. No AI-generated artwork in final figures.",
   "extras": [
    "Data availability statement after Methods (mandatory; no invented repositories or DOIs)",
    "Code availability statement",
    "Acknowledgements including funding (no invented grants)",
    "Author contributions by initials (A.R.)",
    "Competing interests statement (mandatory, even if none)",
    "Reporting summary / statistics & reproducibility subsection in Methods",
    "Nature AI-use disclosure in Methods only if generative AI assisted manuscript drafting (do not invent)",
    "Bold title sentence at the start of every figure and table legend",
    "No TOC graphic or graphical abstract"
   ]
  }
 },
 {
  "id": "journal-nature-methods",
  "kind": "journal",
  "zh": "Nature Methods",
  "en": "Nature Methods",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 5783,
    "sha": "dc293ea40637e5dd"
   },
   {
    "name": "naturemag.bst",
    "bytes": 34867,
    "sha": "fed4788763dedb10"
   },
   {
    "name": "references.bib",
    "bytes": 1056,
    "sha": "70b8dc74d5a66a39"
   },
   {
    "name": "template.tex",
    "bytes": 7872,
    "sha": "e6c6865343ee80df"
   },
   {
    "name": "venue.json",
    "bytes": 2868,
    "sha": "f7c1a89283d8a589"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "Nature Methods",
   "short_name": "Nat. Methods",
   "field": "experimental and computational methodology in life and biomedical sciences",
   "review_model": "single-blind",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Results",
    "Discussion",
    "Methods"
   ],
   "abstract_limit": "150 words, one unreferenced paragraph without subheadings (technical advance, enabling power, quantitative benchmark vs baselines, demonstrated utility)",
   "writing_style": "Nature Methods style addressed to experimental and computational biologists who will adopt the method: concise unheaded Introduction framing existing bottlenecks and methodological advance; Results organized under informative finding-driven subheadings covering technical development, rigorous benchmarking against credible baselines, generalizability across systems and compelling biological application; concise unheaded Discussion covering scope, failure modes and limitations (no separate Conclusions); comprehensive reproducible Methods and protocol details; superscript numbered references.",
   "reviewer_focus": "Referees weigh whether the method delivers clear enabling power over state-of-the-art alternatives, credible head-to-head benchmarking on representative baselines, demonstrated general utility beyond one narrow showcase, full reproducibility (parameters, code/data/protocol availability, compute or experimental constraints), and complete statistical reporting (n, exact test, effect size/CI) without overclaiming.",
   "figure_style": "Nature Portfolio figure standards: single column 89 mm (3.5 in) or double column 183 mm (7.2 in) width, Arial or Helvetica sans-serif lettering at 5-7 pt at final size, lines >= 0.5-1 pt, at least 300 dpi RGB, lowercase bold panel labels (a, b, c) and colorblind-safe Okabe-Ito or viridis palettes without red-green contrast or rainbow scales. Each legend opens with a bold one-sentence title followed by <= 350 words explaining every panel and defining error bars/n. Workflow schematics must clearly trace data/assay flow; no AI-generated artwork in final figures.",
   "extras": [
    "Data availability statement after Methods (mandatory; no invented repositories or DOIs)",
    "Code availability statement (mandatory for computational/software methods; state only provided repos)",
    "Acknowledgements including funding (no invented grants)",
    "Author contributions by initials (A.R.)",
    "Competing interests statement (mandatory, even if none)",
    "Reporting summary / statistics & reproducibility subsection in Methods",
    "Nature AI-use disclosure in Methods only if generative AI assisted manuscript drafting (do not invent)",
    "Bold title sentence at the start of every figure and table legend",
    "No TOC graphic or graphical abstract"
   ]
  }
 },
 {
  "id": "journal-nature-biotech",
  "kind": "journal",
  "zh": "Nature Biotechnology",
  "en": "Nature Biotechnology",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 5588,
    "sha": "b64565542c4aaa2a"
   },
   {
    "name": "naturemag.bst",
    "bytes": 34867,
    "sha": "fed4788763dedb10"
   },
   {
    "name": "references.bib",
    "bytes": 1056,
    "sha": "70b8dc74d5a66a39"
   },
   {
    "name": "template.tex",
    "bytes": 7898,
    "sha": "9c377aa4027afbd8"
   },
   {
    "name": "venue.json",
    "bytes": 2832,
    "sha": "e87d77b39336d021"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "Nature Biotechnology",
   "short_name": "Nat. Biotechnol.",
   "field": "biotechnology, bioengineering, translational biology and computational platforms",
   "review_model": "single-blind",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Results",
    "Discussion",
    "Methods"
   ],
   "abstract_limit": "150 words, one unreferenced paragraph without subheadings (biotechnological bottleneck, engineered platform/resource, quantitative validation, translational or community impact)",
   "writing_style": "Nature Biotechnology style emphasizing enabling biotechnology significance, engineering depth, platform utility and translational relevance: concise unheaded Introduction framing the biological/engineering challenge and state of the art; Results organized under short finding-driven subheadings moving from platform design and mechanistic characterization to quantitative validation and translational/community utility; concise unheaded Discussion covering scalability, limitations, safety/regulatory considerations and outlook (no separate Conclusions); full Methods; superscript numbered references.",
   "reviewer_focus": "Referees weigh whether the advance has genuine biotechnology, medical or bioengineering significance beyond a single narrow benchmark, whether platform/resource claims are substantiated across realistic biological complexity and orthogonal assays, full reproducibility and data/code accessibility, and complete statistical reporting (n, exact test, effect size/CI) without overclaiming.",
   "figure_style": "Nature Portfolio figure standards: single column 89 mm (3.5 in) or double column 183 mm (7.2 in) width, Arial or Helvetica sans-serif lettering at 5-7 pt at final size, lines >= 0.5-1 pt, at least 300 dpi RGB, lowercase bold panel labels (a, b, c) and colorblind-safe Okabe-Ito or viridis palettes without red-green contrast or rainbow scales. Each legend opens with a bold one-sentence title followed by <= 350 words explaining every panel and defining error bars/n. No AI-generated artwork in final figures.",
   "extras": [
    "Data availability statement after Methods (mandatory; no invented repositories or DOIs)",
    "Code availability statement (mandatory for computational/software platforms; state only provided repos)",
    "Acknowledgements including funding (no invented grants)",
    "Author contributions by initials (A.R.)",
    "Competing interests statement (mandatory, even if none)",
    "Reporting summary / statistics & reproducibility subsection in Methods",
    "Nature AI-use disclosure in Methods only if generative AI assisted manuscript drafting (do not invent)",
    "Bold title sentence at the start of every figure and table legend",
    "No TOC graphic or graphical abstract"
   ]
  }
 },
 {
  "id": "journal-npj-compmater",
  "kind": "journal",
  "zh": "npj Computational Materials",
  "en": "npj Computational Materials",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 22170,
    "sha": "ddec4c03ceda1cf7"
   },
   {
    "name": "naturemag.bst",
    "bytes": 34867,
    "sha": "fed4788763dedb10"
   },
   {
    "name": "references.bib",
    "bytes": 1056,
    "sha": "70b8dc74d5a66a39"
   },
   {
    "name": "template.tex",
    "bytes": 9296,
    "sha": "c1bbfd100f7d7389"
   },
   {
    "name": "venue.json",
    "bytes": 2490,
    "sha": "2e23885b84d328ba"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "npj Computational Materials",
   "short_name": "npj Comput. Mater.",
   "field": "computational materials science and computational chemistry",
   "review_model": "single-blind",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Results",
    "Discussion",
    "Methods"
   ],
   "abstract_limit": "150 words, one paragraph without subheadings, no references",
   "writing_style": "Nature-family style for a broad materials audience: a concise Introduction without subheadings that carries the literature context, Results organized under short informative subheadings that state findings, and a Discussion without subheadings that also holds limitations and outlook (no Conclusions section). All methods sit in a Methods section at the end with short bold subheadings, references are superscript numbers in order of citation, and units follow SI with a space between number and unit.",
   "reviewer_focus": "Referees judge whether the computational work gives new insight into or design rules for real materials and is of interest beyond one subfield, not a routine calculation. They check that the methods (functional, U values, cutoffs, k-points, force fields, ML training data and splits) are adequate, converged and fully reported, that predictions are validated against experiment or higher-level references with quantified errors, and that data and code are available for reproduction.",
   "figure_style": "Figures fit A4 page width with Arial or Helvetica lettering of about 8 pt, lines of at least 1 pt, at least 300 dpi RGB, lowercase bold panel labels (a, b, c) and color-blind-safe colors without red-green contrast or rainbow scales. Each legend starts with a bold one-sentence title covering the whole figure, followed by at most 350 words describing each panel, and stays on the same page as its figure.",
   "extras": [
    "Data availability statement after Methods (mandatory; no invented repositories or DOIs)",
    "Code availability statement",
    "Acknowledgements including funding (no separate funding statement; no invented grants)",
    "Author contributions by initials (A.R.)",
    "Competing interests statement (mandatory, even if none)",
    "Additional information: one Supplementary Information sentence (single merged PDF, no Supplementary Methods) or delete it",
    "Bold title sentence at the start of every figure and table legend",
    "No TOC graphic or graphical abstract"
   ]
  }
 },
 {
  "id": "journal-acs-jctc-jpc-jcim",
  "kind": "journal",
  "zh": "ACS：JCTC / JPC A·B·C / JCIM",
  "en": "ACS: JCTC / JPC A·B·C / JCIM",
  "files": [
   {
    "name": "achemso-jacsat.cfg",
    "bytes": 4428,
    "sha": "a2b78a6bfe6fa5c7"
   },
   {
    "name": "achemso-jcisd8.cfg",
    "bytes": 2171,
    "sha": "78805ed0681536a8"
   },
   {
    "name": "achemso-jctcce.cfg",
    "bytes": 2185,
    "sha": "8137c5cb5e6cf331"
   },
   {
    "name": "achemso-jpcafh.cfg",
    "bytes": 2315,
    "sha": "8c144fde476aac1a"
   },
   {
    "name": "achemso-jpcbfk.cfg",
    "bytes": 2315,
    "sha": "771d25cf2eb61015"
   },
   {
    "name": "achemso-jpccck.cfg",
    "bytes": 2315,
    "sha": "08bf0094829048d8"
   },
   {
    "name": "achemso.bst",
    "bytes": 30297,
    "sha": "900e4cc5d72e8b88"
   },
   {
    "name": "achemso.cls",
    "bytes": 38618,
    "sha": "3cb9b6e084c29f20"
   },
   {
    "name": "guidelines.md",
    "bytes": 24478,
    "sha": "4b8009b287dfaad0"
   },
   {
    "name": "natmove.sty",
    "bytes": 4397,
    "sha": "e2a52864be3c0a61"
   },
   {
    "name": "references.bib",
    "bytes": 1105,
    "sha": "acf3e38e3d933b77"
   },
   {
    "name": "template.tex",
    "bytes": 6825,
    "sha": "614bd5162b9e02e8"
   },
   {
    "name": "venue.json",
    "bytes": 2485,
    "sha": "77708048431b64d8"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "Journal of Chemical Theory and Computation (default); The Journal of Physical Chemistry A/B/C; Journal of Chemical Information and Modeling",
   "short_name": "ACS JCTC / JPC A/B/C / JCIM",
   "field": "computational and theoretical chemistry",
   "review_model": "single-blind",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Computational Methods",
    "Results and Discussion",
    "Conclusions"
   ],
   "abstract_limit": "one paragraph of 3-4 sentences (JCTC, JCIM) or 100-200 words (JPC A/B/C); at most 200 words, no citations, no figure or table references, no equations",
   "writing_style": "Concise, quantitative physical-chemistry prose for computational chemists: state the chemical problem, the methodological advance and the evidence, with every number given in consistent units and compared with reference data. Methods are reported so that the calculations can be reproduced (software and version, level of theory or force field, basis set, dispersion and solvation treatment, convergence criteria, sampling). Numbered superscript ACS citations, mhchem formulas and SI-style units; no promotional language.",
   "reviewer_focus": "Referees judge whether the work is a genuine advance in theory, method or physical insight rather than a routine application of standard DFT or MD to one system, and whether new methods are benchmarked against high-level or experimental reference data on several systems or tasks. They check that the computational protocol is complete and reproducible, that errors and statistical uncertainty are quantified, that conclusions do not overreach the model chemistry, and that data and software availability is stated (mandatory at JCIM).",
   "figure_style": "ACS sizes at final print size: single column up to 3.33 in (240 pt), double column 4.167-7 in, lettering at least 4.5 pt, lines at least 0.5 pt, 300 dpi color. Use sans-serif labels with axis quantities and units consistent with the text (e.g. kcal/mol), color-blind-safe palettes with markers or line styles, and no titles inside panels.",
   "extras": [
    "TOC graphic in the tocentry environment (3.25 in x 1.75 in): reuse the most representative figure from figures/, or keep the placeholder",
    "Data and Software Availability section",
    "Supporting Information file descriptions in the suppinfo environment",
    "Acknowledgement environment (funding and AI-tool disclosure, only as stated in the materials)"
   ]
  }
 },
 {
  "id": "journal-aip-jcp",
  "kind": "journal",
  "zh": "AIP：J. Chem. Phys.",
  "en": "AIP: J. Chem. Phys.",
  "files": [
   {
    "name": "aip4-2.rtx",
    "bytes": 31338,
    "sha": "c9be497e89fcdc0a"
   },
   {
    "name": "aipnum4-2.bst",
    "bytes": 68586,
    "sha": "e69b7e6656784ef6"
   },
   {
    "name": "aps10pt4-2.rtx",
    "bytes": 4721,
    "sha": "0cc5d7fab6ffd59b"
   },
   {
    "name": "aps12pt4-2.rtx",
    "bytes": 4805,
    "sha": "ed800427c862eee9"
   },
   {
    "name": "guidelines.md",
    "bytes": 22149,
    "sha": "8d66a9009844694c"
   },
   {
    "name": "references.bib",
    "bytes": 1025,
    "sha": "c7b40beca6b9ea33"
   },
   {
    "name": "revsymb4-2.sty",
    "bytes": 5569,
    "sha": "7614d7446d929f49"
   },
   {
    "name": "revtex4-2.cls",
    "bytes": 202907,
    "sha": "58727044fa47fff2"
   },
   {
    "name": "template.tex",
    "bytes": 6969,
    "sha": "cf901359dac07fb5"
   },
   {
    "name": "textcase.sty",
    "bytes": 3050,
    "sha": "3c5b15cec4eab4be"
   },
   {
    "name": "venue.json",
    "bytes": 2451,
    "sha": "34c7a92c3fc7bac1"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "The Journal of Chemical Physics",
   "short_name": "JCP",
   "field": "computational chemistry and chemical physics",
   "review_model": "single-blind",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Theory",
    "Computational Methods",
    "Results and Discussion",
    "Conclusions"
   ],
   "abstract_limit": "one paragraph, at most 250 words; no references, displayed equations, footnotes, graphics or tables",
   "writing_style": "Precise, quantitative physical-chemistry prose for readers across the subfields of chemical physics: every claim is backed by numbers with units and uncertainties, and trends are explained by the underlying physics. Literature context belongs in the Introduction, and the methods are reported in enough detail to reproduce every calculation. AIP conventions apply: superscript numbered citations (written out as Ref N when used as a noun), figures numbered 1, 2, 3 and tables I, II, III, and no footnotes.",
   "reviewer_focus": "Referees judge whether the work is significant new chemical physics of interest beyond one subfield, not a routine application. They check that the level of theory, basis sets, dispersion and solvation treatment, sampling and convergence are adequate and fully specified, that results are validated against high-level references or experiment with error statistics, and that conclusions follow from the data.",
   "figure_style": "Single-column figures at most 3.37 in (8.5 cm) wide and two-column figures at most 6.69 in (17 cm), with lettering of at least 8 pt, lines of at least 0.5 pt and panels labeled (a), (b). Color is free online but print is grayscale, so use color-blind-safe palettes together with distinct line styles or markers.",
   "extras": [
    "Supplementary Material section after Conclusions (only if supplementary material exists; refer to it as 'supplementary material')",
    "Acknowledgments in the acknowledgments environment (no invented funding)",
    "Author Declarations: Conflict of Interest statement (required even if none)",
    "Author Declarations: Author Contributions as a CRediT statement",
    "Data Availability statement using an AIP template sentence",
    "Corresponding-author footnote via \\email on the fixed author placeholder",
    "No TOC graphic or graphical abstract: Fig. 1 is used as the highlight image, so cite the most representative figure first"
   ]
  }
 },
 {
  "id": "journal-rsc-pccp",
  "kind": "journal",
  "zh": "RSC：PCCP",
  "en": "RSC: PCCP",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 23107,
    "sha": "9e0b7f70f32c7da7"
   },
   {
    "name": "pccp-approx.sty",
    "bytes": 19406,
    "sha": "1a552bfb166ec3db"
   },
   {
    "name": "references.bib",
    "bytes": 1042,
    "sha": "55a7bebde3bb3517"
   },
   {
    "name": "rsc.bst",
    "bytes": 27885,
    "sha": "1ef18fdc813b75f0"
   },
   {
    "name": "template.tex",
    "bytes": 5339,
    "sha": "96ce1a94d3a1f88b"
   },
   {
    "name": "venue.json",
    "bytes": 2665,
    "sha": "3b4dee5f197c5459"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "Physical Chemistry Chemical Physics (Royal Society of Chemistry)",
   "short_name": "RSC PCCP",
   "field": "computational and theoretical physical chemistry",
   "review_model": "single-blind (single-anonymised; optional transparent peer review)",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Computational details",
    "Results and discussion",
    "Conclusions"
   ],
   "abstract_limit": "single paragraph of about 50-250 words (aim for 150-200), no citations",
   "writing_style": "Concise, quantitative physical-chemistry prose for a readership that spans experiment and theory: state the physical question and the new insight, then the evidence, with every number in consistent SI-style units (one of kJ mol-1 or kcal mol-1 throughout) and a sensible number of significant figures. Sentence-case headings, RSC numbered superscript citations, \\ce formulas, 'Fig. 1' and 'eqn (1)' cross-references, and no promotional language. Computational details are reported so that every result can be reproduced.",
   "reviewer_focus": "Referees judge whether the work gives significant new insight into physical chemistry rather than a routine application of standard DFT or MD to one more system. They check that the level of theory, basis set, dispersion and solvation treatment, sampling and convergence are complete and justified, that results are benchmarked against experiment or high-level reference data with quantified errors, and that conclusions do not overreach the model. Coordinates, energies and a data availability statement pointing to the ESI or a repository are expected.",
   "figure_style": "Figures fit one column (8.3 cm) or two columns (17.1 cm) at final size, with legible 6-8 pt sans-serif labels (Arial/Helvetica 7 pt for structures), axis quantities with units matching the text, and colour-blind-safe palettes with markers or line styles. Captions read 'Fig. 1 ...' below figures, and table captions go above booktabs tables.",
   "extras": [
    "Table of contents entry (graphical abstract) in tocentry: 8 cm x 4 cm image reusing the most representative figure from figures/, or keep the placeholder, plus 1-2 sentences of at most 250 characters",
    "ESI footnote text in \\esinote{...} listing the supplementary contents",
    "Author contributions section (CRediT roles, only as stated in the materials)",
    "Conflicts of interest section ('There are no conflicts to declare.' if none)",
    "Data availability section (repository or ESI, full URLs, no 'available on request')",
    "Acknowledgements section (funding, computing resources, AI-tool use, only as stated)"
   ]
  }
 },
 {
  "id": "journal-elsevier-commatsci",
  "kind": "journal",
  "zh": "Elsevier：Comput. Mater. Sci.",
  "en": "Elsevier: Comput. Mater. Sci.",
  "files": [
   {
    "name": "elsarticle-num.bst",
    "bytes": 29462,
    "sha": "aaf9bce5453a0c19"
   },
   {
    "name": "elsarticle.cls",
    "bytes": 44541,
    "sha": "23a341acd0e35c20"
   },
   {
    "name": "guidelines.md",
    "bytes": 27280,
    "sha": "0b66d05314f5f355"
   },
   {
    "name": "references.bib",
    "bytes": 1022,
    "sha": "ff14c0c609dd5115"
   },
   {
    "name": "template.tex",
    "bytes": 8245,
    "sha": "e29c0420585b1249"
   },
   {
    "name": "venue.json",
    "bytes": 3416,
    "sha": "3b53c47738586632"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "Computational Materials Science (Elsevier; other Elsevier journals by changing \\journal{...})",
   "short_name": "Comput. Mater. Sci.",
   "field": "computational materials science (atomistic, electronic-structure, data-driven and multiscale materials modelling)",
   "review_model": "single-blind (single anonymized)",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Computational methods",
    "Results and discussion",
    "Conclusions"
   ],
   "abstract_limit": "at most 250 words in one paragraph; no citations (if essential, author and year), no figure, table or equation references, no undefined non-standard abbreviations",
   "writing_style": "Concise, quantitative prose for computational materials scientists: state the materials problem, the conceptual or computational advance and the validated evidence, with every number in consistent SI-style units (eV/atom, GPa, K) and compared with experiment or higher-level theory. Methods are reported so that referees can reproduce them (code and version, functional or interatomic potential, pseudopotentials, cutoffs, k-points, convergence criteria, system size and sampling). Elsevier conventions: numbered sections in sentence case, numbered citations in square brackets, 'Fig. 1', 'Eq. (1)', mhchem formulas; no promotional language.",
   "reviewer_focus": "Referees judge whether the paper contains a new conceptual or computational advance rather than a routine simulation of one more material, and whether non-first-principles methods (interatomic and machine-learned potentials, phase-field, CALPHAD, continuum models) are validated and shown to be transferable. They check that the computational protocol is complete and reproducible, that convergence and uncertainties are quantified, that results are compared with experiment or higher-level theory, that the physical motivation and impact are discussed in depth, and that data and code are available (FAIR data and code are mandatory for data-driven papers).",
   "figure_style": "Elsevier sizes: single column 90 mm, 1.5 column 140 mm, full width 190 mm; lettering about 7 pt at print size (sub/superscripts at least 6 pt), RGB, at least 300 dpi for images and 1000 dpi for bitmap line art, vector plots preferred. Label axes with quantity and unit, use color-blind-safe palettes with markers or line styles, no titles inside panels, and captions that define every symbol and level of theory.",
   "extras": [
    "Graphical abstract in the graphicalabstract environment (13 cm x 5 cm, at least 1328 x 531 px): reuse the most representative figure from figures/ by replacing both occurrences of figures/toc_graphic.png, or keep the placeholder",
    "Highlights in the highlights environment: 3-5 \\item lines, each at most 85 characters including spaces",
    "Keywords in the keyword environment: 1-7 keywords separated by \\sep",
    "CRediT authorship contribution statement",
    "Declaration of competing interest",
    "Declaration of generative AI and AI-assisted technologies in the manuscript preparation process (Elsevier template sentence, bracketed fields left for the authors)",
    "Data availability statement (repository deposit or reason data cannot be shared; FAIR data and code for data-driven work)",
    "Supplementary material captions",
    "Acknowledgements (including funding, only as stated in the materials)"
   ]
  }
 },
 {
  "id": "journal-chinese-gb7714",
  "kind": "journal",
  "zh": "中文期刊（GB/T 7714）",
  "en": "Chinese journal (GB/T 7714)",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 1592,
    "sha": "8749274ed08dc2f4"
   },
   {
    "name": "references.bib",
    "bytes": 247,
    "sha": "29f2eb1249d91abd"
   },
   {
    "name": "template.tex",
    "bytes": 1705,
    "sha": "7c5b6144a2f803fc"
   },
   {
    "name": "venue.json",
    "bytes": 1609,
    "sha": "47a0a42bb29b9ff2"
   }
  ],
  "missing": [],
  "venue": {
   "kind": "journal",
   "venue_name": "Chinese Journal (GB/T 7714)",
   "short_name": "Chinese-GB7714",
   "field": "computer science, engineering and applied sciences (Chinese / bilingual)",
   "review_model": "single-blind",
   "separate_related_work_section": false,
   "section_order": [
    "Introduction",
    "Methods",
    "Results and Discussion",
    "Conclusions"
   ],
   "abstract_limit": "Chinese abstract (300-400 characters) paired with a mirrored English abstract (~200-250 words), each separated cleanly",
   "writing_style": "Formal Chinese academic journal style (e.g., Journal of Computers / 计算机学报): cohesive paragraph-based exposition rather than two-sentence chatty fragments; clear mathematical definitions, theorem/algorithm structure, and GB/T 7714-2015 numbered reference ordering [1], [2], [3]. Keep the bilingual abstract blocks separated cleanly before the main body.",
   "reviewer_focus": "Sound problem formulation, complete literature grounding ordered sequentially, reproducible experimental protocol, quantitative ablation comparisons, and honest discussion of limitations without fabricated citations.",
   "figure_style": "High-contrast serif/sans-serif figure typography legible at 8 cm single-column or 16 cm double-column width, >= 300 dpi, explicit physical/statistical units on axes, colorblind-safe Okabe-Ito palette.",
   "extras": [
    "Chinese Abstract + Keywords and mirrored English Abstract + Keywords on clean separated blocks",
    "GB/T 7714-2015 sequential numbered bibliography (unsrt)",
    "Data and code availability note at end of manuscript"
   ]
  }
 },
 {
  "id": "neurips2026",
  "kind": "conference",
  "zh": "NeurIPS 2026",
  "en": "NeurIPS 2026",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 1275,
    "sha": "c66c5642657e3765"
   },
   {
    "name": "references.bib",
    "bytes": 629,
    "sha": "cdd86e7d4c31854d"
   },
   {
    "name": "template.tex",
    "bytes": 1767,
    "sha": "85f41daf0347400c"
   }
  ],
  "missing": [
   {
    "file": "neurips_2026.sty",
    "url": "https://media.neurips.cc/Conferences/NeurIPS2026/Formatting_Instructions_For_NeurIPS_2026.zip"
   }
  ]
 },
 {
  "id": "icml2026",
  "kind": "conference",
  "zh": "ICML 2026",
  "en": "ICML 2026",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 1217,
    "sha": "94e10bb0c7668925"
   },
   {
    "name": "icml2026.bst",
    "bytes": 27147,
    "sha": "0ec3d5eb9b02efb7"
   },
   {
    "name": "references.bib",
    "bytes": 629,
    "sha": "cdd86e7d4c31854d"
   },
   {
    "name": "template.tex",
    "bytes": 1927,
    "sha": "7ae56743e9cd09e8"
   }
  ],
  "missing": [
   {
    "file": "icml2026.sty",
    "url": "https://media.icml.cc/Conferences/ICML2026/Styles/icml2026.zip"
   }
  ]
 },
 {
  "id": "iclr2025",
  "kind": "conference",
  "zh": "ICLR 2025",
  "en": "ICLR 2025",
  "files": [
   {
    "name": "fancyhdr.sty",
    "bytes": 21006,
    "sha": "b2fe599152ac8018"
   },
   {
    "name": "guidelines.md",
    "bytes": 5045,
    "sha": "6a049cf6aa7b3f67"
   },
   {
    "name": "iclr2025_conference.bst",
    "bytes": 28413,
    "sha": "197ad2cfb04152d9"
   },
   {
    "name": "natbib.sty",
    "bytes": 46400,
    "sha": "086e8f22ceb63402"
   },
   {
    "name": "references.bib",
    "bytes": 652,
    "sha": "e0fa2c1bd3391e9f"
   },
   {
    "name": "template.tex",
    "bytes": 1631,
    "sha": "98d18d944fb98af4"
   }
  ],
  "missing": [
   {
    "file": "iclr2025_conference.sty",
    "url": "https://github.com/ICLR/Master-Template"
   },
   {
    "file": "math_commands.tex",
    "url": "https://github.com/ICLR/Master-Template"
   }
  ]
 },
 {
  "id": "cvpr2025",
  "kind": "conference",
  "zh": "CVPR 2025",
  "en": "CVPR 2025",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 8988,
    "sha": "9b2efce82c9476b5"
   },
   {
    "name": "ieeenat_fullname.bst",
    "bytes": 28348,
    "sha": "4877c30f96ccef29"
   },
   {
    "name": "references.bib",
    "bytes": 3082,
    "sha": "ab3e52e97086897c"
   },
   {
    "name": "template.tex",
    "bytes": 1792,
    "sha": "ba9e4a4538c7dada"
   }
  ],
  "missing": [
   {
    "file": "cvpr.sty",
    "url": "https://github.com/cvpr-org/author-kit"
   },
   {
    "file": "preamble.tex",
    "url": "https://github.com/cvpr-org/author-kit"
   }
  ]
 },
 {
  "id": "aaai2027",
  "kind": "conference",
  "zh": "AAAI 2027",
  "en": "AAAI 2027",
  "files": [
   {
    "name": "aaai2027.bst",
    "bytes": 30207,
    "sha": "5db7765ba99de5c1"
   },
   {
    "name": "guidelines.md",
    "bytes": 1147,
    "sha": "6a14b07d1067a994"
   },
   {
    "name": "references.bib",
    "bytes": 629,
    "sha": "cdd86e7d4c31854d"
   },
   {
    "name": "template.tex",
    "bytes": 1856,
    "sha": "b55f82d138768fff"
   }
  ],
  "missing": [
   {
    "file": "aaai2027.sty",
    "url": "https://aaai.org/authorkit27/"
   }
  ]
 },
 {
  "id": "acl",
  "kind": "conference",
  "zh": "ACL / ARR",
  "en": "ACL / ARR",
  "files": [
   {
    "name": "acl_natbib.bst",
    "bytes": 45442,
    "sha": "6fbb306202290f4b"
   },
   {
    "name": "guidelines.md",
    "bytes": 1116,
    "sha": "39aa4dbd4ceb6261"
   },
   {
    "name": "references.bib",
    "bytes": 629,
    "sha": "cdd86e7d4c31854d"
   },
   {
    "name": "template.tex",
    "bytes": 1863,
    "sha": "32a3f7be2a16755e"
   }
  ],
  "missing": [
   {
    "file": "acl.sty",
    "url": "https://github.com/acl-org/acl-style-files"
   }
  ]
 },
 {
  "id": "ieee-conference",
  "kind": "conference",
  "zh": "IEEE 会议",
  "en": "IEEE conference",
  "files": [
   {
    "name": "IEEEtran.bst",
    "bytes": 57748,
    "sha": "314f0ece704568fa"
   },
   {
    "name": "IEEEtran.cls",
    "bytes": 281957,
    "sha": "da751920a317ed31"
   },
   {
    "name": "guidelines.md",
    "bytes": 1205,
    "sha": "77c101336cd4d22a"
   },
   {
    "name": "references.bib",
    "bytes": 629,
    "sha": "cdd86e7d4c31854d"
   },
   {
    "name": "template.tex",
    "bytes": 1709,
    "sha": "90c858393c32c40a"
   }
  ],
  "missing": []
 },
 {
  "id": "acm-sigconf",
  "kind": "conference",
  "zh": "ACM sigconf（acmart，TeX Live 自带）",
  "en": "ACM sigconf (acmart, in TeX Live)",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 1116,
    "sha": "94f101fefb875778"
   },
   {
    "name": "references.bib",
    "bytes": 629,
    "sha": "cdd86e7d4c31854d"
   },
   {
    "name": "template.tex",
    "bytes": 1955,
    "sha": "0e42c443d44e356d"
   }
  ],
  "missing": []
 },
 {
  "id": "math-modeling-mcm",
  "kind": "contest",
  "zh": "美赛 MCM / ICM",
  "en": "MCM / ICM contest",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 1071,
    "sha": "0b0adbe73d6c9512"
   },
   {
    "name": "references.bib",
    "bytes": 137,
    "sha": "b74d6271c664d70b"
   },
   {
    "name": "template.tex",
    "bytes": 2166,
    "sha": "903a15daca55115b"
   }
  ],
  "missing": []
 },
 {
  "id": "math-modeling-cumcm",
  "kind": "contest",
  "zh": "国赛 CUMCM",
  "en": "CUMCM contest",
  "files": [
   {
    "name": "guidelines.md",
    "bytes": 930,
    "sha": "73fba7f143b3a060"
   },
   {
    "name": "references.bib",
    "bytes": 247,
    "sha": "29f2eb1249d91abd"
   },
   {
    "name": "template.tex",
    "bytes": 2402,
    "sha": "cf82f1ce344ae117"
   }
  ],
  "missing": []
 }
];
  if (typeof module === 'object' && module.exports) module.exports = TEMPLATES;
  else root.MOLASTRIA_PAPER_TEMPLATES = TEMPLATES;
})(typeof self !== 'undefined' ? self : this);
