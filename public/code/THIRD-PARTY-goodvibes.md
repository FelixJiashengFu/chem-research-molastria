# GoodVibes

`thermo-core.js` 是 [GoodVibes](https://github.com/patonlab/GoodVibes)（Paton 研究组，MIT 许可）里热化学部分的 JavaScript 移植：
`goodvibes/thermo.py` 的各项贡献（平动、转动、振动、电子，Grimme 准 RRHO 熵、Truhlar 抬高低频、Head-Gordon 准谐焓、Bav）和
`goodvibes/io.py` 里由结构算转动惯量的做法与原子质量表。对照的是 GoodVibes 4.4.0（PyPI）。和它不同的地方：

- 点群到转动对称数的表用正确的值（S4、S6、S8、T、O、I 分别是 2、3、4、12、24、60），GoodVibes 4.4.0 的表（`goodvibes/thermo.py` 的 `pg_sm`）里这六个写的是 4、6、8、6、12、30；
- 读不到对称数时按结构判点群（站内群论栏目的 `group-theory/gt-models.js`），GoodVibes 要装 pymsym 才判；
- 直线形分子按转动惯量认（最小的转动惯量接近 0）；
- 不做 GoodVibes 的单点能校正（`--spc`）、ONIOM、溶剂自由体积（`--freespace`）、构象 Boltzmann 和势能面汇总。

`tools/thermo-test.mjs` 用 `tools/thermo-goodvibes.py`（在测试机上 `import goodvibes`，GoodVibes 的代码不进 `public/`）对照它的结果。

引用：G. Luchini, J. V. Alegre-Requena, I. Funes-Ardoiz, R. S. Paton, *GoodVibes: automated thermochemistry for heterogeneous computational chemistry data*, F1000Research 2020, 9, 291. doi:10.12688/f1000research.22758.1

## 许可证

```
Copyright 2017 Robert Paton, University of Oxford

Permission is hereby granted, free of charge, to any person obtaining a copy of this software and associated documentation files (the "Software"), to deal in the Software without restriction, including without limitation the rights to use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of the Software, and to permit persons to whom the Software is furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.
```
