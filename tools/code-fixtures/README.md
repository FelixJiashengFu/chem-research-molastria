# 代码台输出解读的测试样本

`tools/code-test.mjs` 用这些真实输出检查 `public/code/code-core.js` 的 NWChem、CP2K、Q-Chem 读法。每个文件都是摘录：只留读法要用的行和它们前后几行，数字一个没改。

| 文件 | 来源 |
| --- | --- |
| `nwchem-*.out` | NWChem 7.2.2（Ubuntu 的 `nwchem` 包），输入由代码台生成，2026-11-10 在云端会话里真跑。`-scf-fail` 把 DFT 的迭代上限改成 2，`-opt-fail` 把优化步数上限改成 2，`-input-error` 在 `scf` 段里写了一个不存在的指令 |
| `cp2k-*.out` | CP2K 2026.2（conda-forge 的 `cp2k`，MPICH 版），输入由代码台生成，同一天真跑。`-scf-fail` 把 `MAX_SCF` 改成 3，`-opt-fail` 把 `MAX_ITER` 改成 2，`-input-abort` 是 `GFN_TYPE 2`（CP2K 2026.2 不认，代码台已改成 `GFN_TYPE TBLITE`） |
| `qchem-*.out`、`qchem6-*.out` | [cclib](https://github.com/cclib/cclib) 的回归数据 `data/QChem/basicQChem5.4`、`basicQChem6.0`（BSD-3-Clause，© cclib 的作者们），Q-Chem 5.4 和 6.0 的真实输出 |

Q-Chem 是商业软件，云端会话里没有，所以它的样本只能用 cclib 收的这些；报错（`Q-Chem fatal error occurred`）没有真实样本，测试里是照官方手册的格式写的一段。

重新生成 NWChem 和 CP2K 的样本：见 `docs/RUNBOOK.md`“代码台：重做输出样本”。
