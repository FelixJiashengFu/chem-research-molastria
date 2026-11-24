# 论文工坊的第三方来源 · Third-party notices for the Paper Studio

论文工坊（`public/paper/`）把 PaperOrchestra Studio 的功能在浏览器里重写了一遍。下面是用到的每一份别人的东西、它的许可证，以及我们怎么用的。
The Paper Studio (`public/paper/`) rebuilds the features of PaperOrchestra Studio in the browser. Below is every third-party item it uses, its licence, and how we use it.

## PaperOrchestra Studio 和 Google PaperOrchestra

- 来源 · Source: <https://github.com/FelixJiashengFu/paper-orchestra-studio>（`paper-orchestra/` 目录，核对时的提交 `cef9f16`，2026-11-24），fork 自 Google Research 的 PaperOrchestra <https://github.com/google-research/paper-orchestra>（commit `d9bae99`）。
- 版权 · Copyright 2026 Google LLC，以及 PaperOrchestra Studio 的作者。
- 许可证 · Licence: Apache License 2.0，全文在 [`LICENSE-Apache-2.0.txt`](LICENSE-Apache-2.0.txt)。

| 这里 · Here | 那边 · From | 怎么用 · How |
|---|---|---|
| `po-prompts.js`（生成的） | `methods/prompts/*.py`、`utils/prompt_utils.py`、`methods/agents/literature_review_agent.py`、`autoraters/agent_review.py`、`tools/research_studio.py`、`tools/latex_copilot.py` | 提示词原样取出（`tools/paper/extract-prompts.py` 用 `ast` 读源码），一个字没改 · prompts copied verbatim |
| `templates/`、`po-templates.js`（生成的） | `templates/` | 模板原样复制（`tools/paper-templates.mjs`），见下面“样式文件” · copied verbatim, see “Style files” |
| `po-core.js`、`po-audit.js`、`po-flow.js` | `methods/`、`utils/`（providers、pricing、venue_profile、citation_audit、scholar_utils）、`tools/submission_tools.py`、`tools/latex_copilot.py`、`tools/research_studio.py` | 照原版的逻辑用 JavaScript 重写（修改过的作品）；`tools/paper/fixtures.py` 跑原版的 Python 函数，`tools/paper-test.mjs` 逐项对照 · re-implemented in JavaScript (a modified work), checked against the original Python |

按 Apache-2.0 第 4 条：这里的 JavaScript 是修改过的作品，改动是“从 Python 改写成浏览器里的 JavaScript，并按浏览器的条件改了下面几处”：

- 审稿人读的是 LaTeX 源码，不是编译出来的 PDF；修改一步也只拿源码。
- 画图不跑 Python：模型给出图的规格（数据只能取自实验记录），浏览器按期刊插图的画法画成 PNG。
- 检索结果直接用；只有缺摘要的条目才按标题再查一次。
- 不在本机编译、不查 PDF 字体；改成导出 zip 和“在 Overleaf 打开”。
- 学术检索不用 arXiv 的接口（它不许网页跨域读取），OpenAlex 里有 arXiv 的预印本；引用核对改问 Crossref、OpenAlex、Semantic Scholar。
- 科研工坊的附件在浏览器里读成文字；CSV 不做 pandas 的数据概况，只放前 12000 个字符；附件清单不写本机路径。
- 没有搬：SSH / GPU 作业、Lean、Google Drive、图像生成的示意图、latexdiff 的 PDF、PubMed 和 CORE 检索。

## Lattice

- 来源 · Source: <https://github.com/leo1oel/lattice>（commit `c605832`），Copyright 2026 Leonardo and the Lattice contributors，Apache License 2.0。
- PaperOrchestra Studio 的 `tools/submission_tools.py`（双盲检查、编译日志诊断）和模板 `neurips2026`、`icml2026`、`aaai2027`、`acl`、`ieee-conference`、`acm-sigconf` 改编自 Lattice；`po-audit.js` 再从那里改写。Lattice 的 `gpui/`（GPL-3.0）和 Trellis（非商用许可）没有用。

## Nature-Paper-Skills

- 来源 · Source: <https://github.com/Boom5426/Nature-Paper-Skills>，MIT 和 Apache-2.0。
- 期刊模板的 venue profile 和 guidelines、`venue_note` 的写作规则、稿件体检的几项（AI 写作痕迹、图表引用、字数、统计报告、数据可用性声明）改编自它（经 PaperOrchestra Studio）。

## Best-Paper-Writing-Skill

- 来源 · Source: <https://github.com/gulucaptain/Best-Paper-Writing-Skill>，**CC BY 4.0**（<https://creativecommons.org/licenses/by/4.0/>），作者 gulucaptain。
- 改编了什么（经 PaperOrchestra Studio，再由我们改写成 JavaScript）：句法层面的 AI 节奏指标（句尾分词、对比句、短句连串、数字预算）和会议图表检查（`po-audit.js` 的 `auditTextDraft` 和稿件体检的两项）；提示词里 L1–L8 论文类型 × 动机的路由、结论强度阶梯、Figure 1 的类型选择（`po-prompts.js`，原样）；摘要逐句改写的对照表（LaTeX 助手的“改写摘要”）。
- 改动：从 Python 改写成 JavaScript，界面文字改写成中英两版。它的 `references/exemplars/` 里受版权保护的论文片段没有复制。

## 样式文件 · Style files

`templates/` 里只放许可证写清楚、可以再发布的文件：

| 文件 · Files | 许可证 · Licence |
|---|---|
| `template.tex`、`guidelines.md`、`references.bib`、`venue.json`、`journal-rsc-pccp/pccp-approx.sty` | PaperOrchestra Studio 自己写的，Apache-2.0（`ieee-conference/template.tex` 改编自 `bare_conf.tex`，LPPL 1.3） |
| `IEEEtran.cls`、`IEEEtran.bst` | LPPL 1.3，Michael Shell 等，未修改 |
| `achemso.cls`、`achemso.bst`、`natmove.sty`、`achemso-*.cfg` | LPPL 1.3c 或更新，Joseph Wright（achemso 3.13g），未修改 |
| `revtex4-2.cls`、`aip4-2.rtx`、`aps10pt4-2.rtx`、`aps12pt4-2.rtx`、`revsymb4-2.sty`、`aipnum4-2.bst` | LPPL 1.3c（REVTeX 4.2f，APS / AIP），未修改 |
| `textcase.sty` | LPPL，David Carlisle，未修改 |
| `elsarticle.cls`、`elsarticle-num.bst` | LPPL 1.2 或更新，Elsevier Ltd，未修改 |
| `naturemag.bst` | LPPL（CTAN `nature` 包），未修改 |
| `rsc.bst` | LPPL 1.3c 或更新，Joseph Wright，未修改 |
| `aaai2027.bst`、`acl_natbib.bst`、`icml2026.bst`、`ieeenat_fullname.bst`、`iclr2025_conference.bst` | 文件头写明 LPPL（由 Patrick W. Daly 的 merlin.mbs / plainnat 生成），未修改 |
| `iclr2025/fancyhdr.sty`、`iclr2025/natbib.sty` | LPPL，未修改 |

LPPL 只允许原样再发布；改动的话要换文件名，所以这些文件都不要直接改。

**没有放进来的**：会议自己的样式文件没有写许可证（`neurips_2026.sty`、`icml2026.sty`、`iclr2025_conference.sty`、`math_commands.tex`、`cvpr.sty`、`preamble.tex`、`aaai2027.sty`、`acl.sty`），公开仓库不能放。论文工坊导出这些模板时写明缺哪个文件、去哪个官方地址下载（`po-templates.js` 的 `missing`）。ACM 的 `acmart` 在 TeX Live 和 Overleaf 里自带。

## 运行时从网上载入的 · Loaded at run time

- pdf.js 6.4.299（读 PDF 的文字和作者字段）：从 jsDelivr 按需载入，Apache-2.0；读 PDF 和 Word 的文字借用站内 `ai/ai.js` 的读文件功能。
- 报告里的公式和 Mermaid 流程图按源码显示，没有载入 KaTeX 或 Mermaid。
