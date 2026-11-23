# 热化学的测试样本

`tools/thermo-test.mjs` 用这些真实频率输出核对 `public/code/thermo-core.js`（GoodVibes 的 JS 移植）。每个文件都是摘录：
原文的行按原来的顺序留下，数字一个没改；删行的办法是一段一段试着删，只要真的 GoodVibes 4.4.0（两组选项）和代码台的读法 + 热化学算出的结果都不变就删掉，所以剩下的正好是两边要用的行。

| 文件 | 来源 |
| --- | --- |
| `gaussian-h2o.out`、`gaussian-hcn-triplet.out`、`gaussian-al-atom.out`、`gaussian-allene.out` | GoodVibes 自带的例子 `goodvibes/examples/H2O.out`、`HCN_triplet.out`、`Al_298K.out`、`allene.out`（Gaussian 09；MIT 许可，Copyright 2017 Robert Paton, University of Oxford）。水（C2v，σ = 2）、三重态 HCN（直线形，一个虚频）、铝原子（单原子，二重态）、丙二烯（D2d，σ = 4） |
| `gaussian16-dvb-freq.out`、`orca5-dvb-freq.out`、`nwchem7-dvb-freq.out` | [cclib](https://github.com/cclib/cclib) 回归数据 `data/Gaussian/basicGaussian16/dvb_ir.out`、`data/ORCA/basicORCA5.0/dvb_ir.out`、`data/NWChem/basicNWChem7.0/dvb_ir.out`（BSD-3-Clause，© cclib 的作者们），二乙烯基苯（C2h）的频率计算 |
| `goodvibes-ref.json` | `python3 tools/thermo-goodvibes.py` 在八组选项下跑 GoodVibes 4.4.0（`pip install goodvibes==4.4.0`）得到的数字，2026-11-22 生成 |

Q-Chem、Psi4、xTB、PySCF、CP2K 的输出没有对照：GoodVibes 读不了前四种里的大部分（Q-Chem 的 dvb_ir 它读不到能量），xTB 的频率输出云端会话里没能真跑出来。这些程序的热化学用的是同一套公式，只是输入（频率、结构、多重度）从代码台的读法来。
