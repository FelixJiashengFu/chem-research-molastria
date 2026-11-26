/* 生成的文件，不要手改：node tools/nmr-walkthrough-sync.mjs --src <nmr-walkthrough 的路径>。
   内容来自站长的 nmr-walkthrough（https://github.com/FelixJiashengFu/nmr-walkthrough，MIT）：讲解方法 STYLE-GUIDE.md、数据格式 SCHEMA.md、三个示例。
   示例里的每个位移、J 值和相关峰都来自各自 sources 所列的实测数据。 */
window.MOLASTRIA_NMRW_GUIDE = {
 "upstream": {
  "repo": "https://github.com/FelixJiashengFu/nmr-walkthrough",
  "version": "1.1.0",
  "commit": "b076ef7",
  "license": "MIT",
  "playerSha": "498ac8f669d36d79"
 },
 "guide": "# NMR 分步讲解风格指南 / NMR walkthrough style guide\n\n学自 nmr.tips 的解答写法（其印刷版解答的 1D、2D、偶合、综合四册，以及网页版\"点一下出一步\"的幻灯片形式）。只学方法，不抄题目、文字和图。\nLearned from how nmr.tips writes its solutions (the printed 1D, 2D, coupling and mixed sets, and the click-to-advance slide format of the web version). Method only: no problems, wording or figures are copied.\n\n## 0. 底线：数据必须真实 / Ground rule: the data must be real\n\n- 每一个位移、J 值、相关峰，都必须来自用户自己的谱图或峰表，或者来自注明出处的实测数据。凭记忆写出来的\"差不多的数\"不算数据。\n  Every shift, J value and cross peak must come from the user's own spectra or peak list, or from a cited measured source. A plausible number recalled from memory is not data.\n- 动笔前先找来源，逐项核对；两份独立来源互相对一下更好。来源写进 `sources`，并写清每个来源具体给了哪些值。\n  Find the source before writing and check item by item; two independent sources are better. List them in `sources`, stating exactly which values each one gives.\n- 来源没给、但画图需要的值（常见的是 J 的赫兹数和 2D 里\"理应有\"的相关峰），用 `est`、`Jest`、`expected` 标出来，页面会显示 ≈ 和 *，并在该步的\"核对\"里说明。\n  Values the source lacks but the picture needs (typically J in Hz and \"should be there\" 2D peaks) are flagged with `est`, `Jest`, `expected`; the page shows ≈ and *, and the step's check says so.\n- 来源里没有的谱（例如 NOESY）不要画。可以说\"这个实验能直接证明\"，但不能假装做过。\n  Do not draw a spectrum the source lacks (a NOESY, for example). Say that the experiment would prove the point; do not pretend it was run.\n- 来源本身可能有错（学生报告尤其如此）。对不上的地方写明，不要悄悄\"修正\"成自己觉得对的数。\n  Sources can be wrong, student reports especially. State the mismatch; do not silently replace it with the number you believe.\n- 谱线形状是程序按峰表画的示意图。位移是真的，峰形不是原始谱。\n  Line shapes are drawn by the program from the peak list. The shifts are real; the shapes are not the raw spectrum.\n\n## 1. 核心：一次点击 = 一个推理动作 / One click = one reasoning move\n\n每一步固定四拍，对应播放器的四个字段。\nEvery step has the same four beats, matching four fields of the player.\n\n| 拍 Beat | 字段 | 写什么 What to write |\n|---|---|---|\n| 观察 Observe | `text` | 只说谱图上看得见的：δ、积分、裂分、J、哪个交叉峰。Only what is visible: δ, integral, multiplicity, J, which cross peak. |\n| 依据 Rule | `rule` | 用到的规律，并给参考值。例：\"³J(E) ≈ 15 Hz，³J(Z) ≈ 10 Hz\"。HMBC 要把键的路径写出来：\"H–C(1')–O–C(1)，三根键\"。The rule used, with reference values. For HMBC write the bond path out. |\n| 结论 So | `so` | 只加一个推论：一个片段、一根键、一个归属。Exactly one inference: a fragment, a bond, an assignment. |\n| 核对 Check | `check` | 留有余地或交叉验证：\"指向 E\"而不是\"证明 E\"；这个位移现在还不可靠，等取代基确定再说。Hedge or cross-check: \"points to E\", not \"proves E\". |\n\n每步 2 到 4 句。一题 8 到 16 步。\n2 to 4 sentences per step. 8 to 16 steps per problem.\n\n## 2. 推理顺序 / Order of reasoning\n\n1. **分子式与不饱和度** Formula and DBE. 把算式写在 `board` 上。\n2. **清点氢谱** Inventory of the ¹H spectrum: 有几组信号，积分比写成 1 : 1 : 2 : 3 : 3，加起来是否等于分子式的 H 数。\n3. **先排除不属于样品的峰** Set aside what is not the compound: 溶剂（CDCl₃ 中 CHCl₃ 约 7.26）、水（CDCl₃ 中约 1.55）、积分不成整数的杂质峰，并说明理由。\n4. **选入口信号并说明为什么** Pick the entry signal and say why: 积分、裂分、位移三样都不含糊的那个（常是甲基双峰或三重峰），或者只有一种可能位置的独特多重峰。\n5. **由偶合搭片段** Build fragments from couplings, 一步一个片段。J 相同的两组峰是邻居。\n6. **碳谱和 DEPT** ¹³C / DEPT: 数碳、看对称性、由位移认官能团。\n7. **HSQC**：给每个 H 配上 C。还没定位置时先用字母 a、b、c 暂称，结构清楚后再编号。没有交叉峰的碳是季碳。\n8. **COSY**：按\"对角峰 → 交叉峰 → 对角峰\"一个峰一个峰地走，把链写成 H-4 → H-3 → H-2。对角线两侧信息相同。没有后续交叉峰说明链到头了。\n9. **HMBC**：一次只用一个关键相关，跨过季碳和杂原子把片段接起来，其余的峰留到最后做交叉检查。\n10. **立体化学** Stereochemistry: 由 J 值（E/Z，直立/平伏约 10 Hz）或 NOE。\n11. **有歧义就比较候选结构** Compare candidates when ambiguous: 列出 a)、b)、c)，用位移增量估算或\"应该出现却没出现的峰\"逐个排除，最后写\"只剩下……\"。增量法只给参考值，要说明。\n12. **收尾核对** Final check: 原子数、不饱和度、每个峰都归属，写出化合物名称。数据确实定不了的地方要直说，并建议能解决它的实验（例如选择性 1D TOCSY）。\n\n## 3. 抓细节 / Fine points that make it work\n\n- **没看到的峰也是证据** Predicted absences count: 先预言\"这个峰在 COSY 里应当看不到\"，再去确认。但只在预期峰本应很强时才可靠。\n- **陷阱要点名** Name the traps: 非对映异位的 CH₂、假五重峰和假六重峰（两个 J 恰好接近）、屋顶效应和高级谱、¹⁹F 或 ³¹P 带来的额外裂分、偶然重叠（重叠不一定就是高级谱）。\n- **拥挤区域就放大** Zoom into crowded regions，不要让读者在全谱里找。\n- **数字的写法** Numbers: ¹H 的 δ 写两位小数（低场仪器一位），¹³C 一位或两位，J 用 Hz 写一位小数，统一用小数点。拿不准的写\"t?\"，不要装作确定。\n- **表格跟着推理长** A running table: 列顺序为 δ、裂分和 J、积分、归属，行按 δ 从大到小，归属一栏随着步骤逐行填上。\n- **交叉峰的叫法** Cross-peak names: COSY 写 H3/H4，HSQC 和 HMBC 写 H3/C1。\n- **让读者先想** Make the reader predict: 关键一步先用 `ask` 抛出问题，再点一下才给答案。\n- **语气** Tone: 像助教在黑板前讲，直接、口语化，可以有一点幽默；该提醒就提醒（\"这里要小心\"）。\n- **用对称性省力** Use symmetry: 有 C₂ 轴就只讲半个分子，但要说出来。\n\n## 4. 画面规则 / Screen rules\n\n- 当前这一步在谱图上高亮，结论同时出现在结构上，两边一起动。\n- 结构是长出来的：没推出来的原子和键不画，新出现的部分用强调色。\n- 颜色固定：COSY 蓝，HSQC 绿，HMBC 橙，NOE 紫。箭头从 H 所在的碳指向相关的碳。\n- 一屏学完：平板和电脑上整页不滚动，谱图在左，结构、讲解和按钮在右，归属表和全文放在谱图上方的标签里。\n- 每步都有中文和英文，文字可切换中文、英文、双语。朗读每次只读一种语言（中文或英文），用设备系统自带的语音。\n- 谱图若是模拟或示意的，在页脚写明。\n",
 "schema": "Pass one JSON object. Text fields accept a plain string or `{ \"zh\": \"...\", \"en\": \"...\" }` (use both). In text, `_{3}` is a subscript, `^{13}` a superscript and `**x**` bold.\n\n```\n{\n  title, shortTitle?, formula?, prompt?, note?, answer?,      // answer is shown only on the step marked final\n  sources: [{ label, url?, covers? }],                         // where the numbers were measured; covers says exactly which values each source gives. Shown under the table and the transcript. For the user's own spectra use the file or handout name as label (url optional)\n  lang?: \"both\" | \"zh\" | \"en\",                                 // starting language, default both\n  molecule: {\n    atoms: [{ id, x, y, label?, el?, num?, numBelow?, numAt?: [dx, dy] }],  // x,y in any unit, y grows downward; label like \"CH3\"; label \"\" draws a bare vertex (ring carbons); numAt places the number, in px\n    bonds: [{ a, b, order?: 1|2|3, id? }]                      // a bond WITH an id stays hidden until a step reveals it\n  },\n  spectra: [\n    { id, kind: \"1d\", nucleus: \"1H\" | \"13C\" | ..., mhz?, range: [hi, lo], name?,\n      peaks: [{ id, ppm, mult?: \"s|d|t|q|quint|sext|sept|m|br\" or combos like \"dq\", J?: [Hz,...], nH?, type?: \"CH3\", intensity?, lw?,\n                est?: true,     // this shift is a typical literature value, not read from the cited spectrum: shown as \"≈\"\n                Jest?: true }]  // same for J: shown as \"J ≈\"\n    },\n    { id, kind: \"2d\", type: \"COSY\" | \"HSQC\" | \"HMBC\" | \"TOCSY\" | \"NOESY\",\n      x: { nucleus, range: [hi, lo], ref?: <1D spectrum id drawn as projection> }, y: { ... },\n      peaks: [{ id, x, y, label?, weak?, expected?: true }] }   // expected: predicted from the structure, not listed by the source: grey dashed ring, label gets \"*\"\n                       // COSY/TOCSY/NOESY: give one side, the mirror and diagonal are drawn for you\n  ],\n  steps: [{\n    title,                      // what this click is about\n    ask?,                       // question shown first; the next click reveals the rest\n    text,                       // OBSERVE: what is seen in the highlighted region\n    rule?,                      // RULE: the rule or reference value used\n    so,                         // SO: the one inference this step adds\n    check?,                     // CHECK: hedge, cross-check or trap\n    board?: [lines],            // equations, e.g. the DBE calculation\n    spectrum?: <spectrum id>,   // omit for a formula-only step\n    zoom?: [hi, lo] | { x: [hi, lo], y: [hi, lo] },\n    peaks?: [peak ids],         // highlighted in the spectrum and the table\n    atoms?: [atom ids],         // ringed on the structure\n    arrows?: [{ from, to, kind: \"cosy\" | \"hsqc\" | \"hmbc\" | \"noe\", bend?: 1 | -1 }],\n    reveal?: { atoms?: [ids], bonds?: [bond ids] },   // the structure grows; nothing is drawn before it is deduced\n    assign?: { <peak id>: \"H-3\" },                     // fills the running assignment table\n    final?: true                // last step: shows the answer\n  }]\n}\n```\n\nPeak ids must be unique across all spectra. Bonds without an id appear as soon as both atoms are revealed.\n\n\n## Data must be real\n\nEvery shift, J value and cross peak in a spec must come from the user's own spectra or peak list, or from a cited measured source listed in `sources`. Never fill a gap from memory and present it as measured. If a value is needed for the picture but the source does not give it, set `est` / `Jest` / `expected` so the page marks it, and say so in that step's `check`. Do not draw a spectrum type (NOESY, COSY ...) that the source does not contain. A spec without `sources` is rejected by validate and build. Only when the user explicitly accepts unverified data, set `unverified: true`; the page then shows a red \"unverified\" notice.\n",
 "examples": [
  {
   "id": "ethyl-crotonate",
   "spec": {
    "title": {
     "zh": "由 1D 与 2D NMR 推出 C_{6}H_{10}O_{2} 的结构",
     "en": "Solving C_{6}H_{10}O_{2} from 1D and 2D NMR"
    },
    "shortTitle": "Ethyl crotonate NMR walkthrough",
    "formula": "C6H10O2",
    "prompt": {
     "zh": "CDCl_{3} 中测得 ^{1}H、^{13}C、HSQC、COSY、HMBC。推出结构并归属每一个峰。",
     "en": "^{1}H, ^{13}C, HSQC, COSY and HMBC in CDCl_{3}. Deduce the structure and assign every peak."
    },
    "note": {
     "zh": "位移取自上面所列来源的实测值（CDCl_{3}）。带 ≈ 的 J 值和 C-3 的位移是文献典型值。",
     "en": "Shifts are the measured values from the sources listed (CDCl_{3}). J values marked ≈ and the C-3 shift are typical literature values."
    },
    "answer": {
     "zh": "答案：(E)-丁-2-烯酸乙酯（巴豆酸乙酯）",
     "en": "Answer: ethyl (E)-but-2-enoate (ethyl crotonate)"
    },
    "molecule": {
     "atoms": [
      {
       "id": "C4",
       "x": 0,
       "y": 0.5,
       "label": "CH3",
       "num": "4"
      },
      {
       "id": "C3",
       "x": 1,
       "y": 0,
       "label": "CH",
       "num": "3"
      },
      {
       "id": "C2",
       "x": 2,
       "y": 0.5,
       "label": "CH",
       "num": "2",
       "numBelow": true
      },
      {
       "id": "C1",
       "x": 3,
       "y": 0,
       "label": "C",
       "num": "1",
       "numBelow": true
      },
      {
       "id": "O1",
       "x": 3,
       "y": -1,
       "label": "O"
      },
      {
       "id": "O2",
       "x": 4,
       "y": 0.5,
       "label": "O"
      },
      {
       "id": "C5",
       "x": 5,
       "y": 0,
       "label": "CH2",
       "num": "1'"
      },
      {
       "id": "C6",
       "x": 6,
       "y": 0.5,
       "label": "CH3",
       "num": "2'"
      }
     ],
     "bonds": [
      {
       "a": "C4",
       "b": "C3"
      },
      {
       "a": "C3",
       "b": "C2",
       "order": 2
      },
      {
       "a": "C2",
       "b": "C1",
       "id": "b12"
      },
      {
       "a": "C1",
       "b": "O1",
       "order": 2
      },
      {
       "a": "C1",
       "b": "O2",
       "id": "b1o"
      },
      {
       "a": "O2",
       "b": "C5"
      },
      {
       "a": "C5",
       "b": "C6"
      }
     ]
    },
    "spectra": [
     {
      "id": "h1",
      "kind": "1d",
      "nucleus": "1H",
      "mhz": 400,
      "range": [
       7.6,
       0.6
      ],
      "peaks": [
       {
        "id": "hA",
        "ppm": 6.98,
        "mult": "dq",
        "J": [
         15.5,
         6.9
        ],
        "nH": 1,
        "Jest": true
       },
       {
        "id": "hB",
        "ppm": 5.84,
        "mult": "dq",
        "J": [
         15.5,
         1.7
        ],
        "nH": 1,
        "Jest": true
       },
       {
        "id": "hC",
        "ppm": 4.18,
        "mult": "q",
        "J": [
         7.1
        ],
        "nH": 2,
        "Jest": true
       },
       {
        "id": "hD",
        "ppm": 1.88,
        "mult": "dd",
        "J": [
         6.9,
         1.7
        ],
        "nH": 3,
        "Jest": true
       },
       {
        "id": "hE",
        "ppm": 1.28,
        "mult": "t",
        "J": [
         7.1
        ],
        "nH": 3,
        "Jest": true
       }
      ]
     },
     {
      "id": "c13",
      "kind": "1d",
      "nucleus": "13C",
      "mhz": 100,
      "range": [
       180,
       0
      ],
      "peaks": [
       {
        "id": "cA",
        "ppm": 166.6,
        "type": "C",
        "intensity": 0.5
       },
       {
        "id": "cB",
        "ppm": 144.5,
        "type": "CH",
        "est": true
       },
       {
        "id": "cC",
        "ppm": 122.8,
        "type": "CH"
       },
       {
        "id": "cD",
        "ppm": 60.1,
        "type": "CH2"
       },
       {
        "id": "cE",
        "ppm": 17.9,
        "type": "CH3"
       },
       {
        "id": "cF",
        "ppm": 14.3,
        "type": "CH3"
       }
      ]
     },
     {
      "id": "hsqc",
      "kind": "2d",
      "type": "HSQC",
      "x": {
       "nucleus": "1H",
       "range": [
        7.6,
        0.6
       ],
       "ref": "h1"
      },
      "y": {
       "nucleus": "13C",
       "range": [
        180,
        0
       ],
       "ref": "c13"
      },
      "peaks": [
       {
        "id": "q1",
        "x": 6.98,
        "y": 144.5,
        "label": "6.98 / 144.5",
        "expected": true
       },
       {
        "id": "q2",
        "x": 5.84,
        "y": 122.8,
        "label": "5.84 / 122.8"
       },
       {
        "id": "q3",
        "x": 4.18,
        "y": 60.1,
        "label": "4.18 / 60.1"
       },
       {
        "id": "q4",
        "x": 1.88,
        "y": 17.9,
        "label": "1.88 / 17.9"
       },
       {
        "id": "q5",
        "x": 1.28,
        "y": 14.3,
        "label": "1.28 / 14.3"
       }
      ]
     },
     {
      "id": "cosy",
      "kind": "2d",
      "type": "COSY",
      "x": {
       "nucleus": "1H",
       "range": [
        7.6,
        0.6
       ],
       "ref": "h1"
      },
      "y": {
       "nucleus": "1H",
       "range": [
        7.6,
        0.6
       ],
       "ref": "h1"
      },
      "peaks": [
       {
        "id": "k1",
        "x": 4.18,
        "y": 1.28,
        "label": "H1'/H2'"
       },
       {
        "id": "k2",
        "x": 6.98,
        "y": 1.88,
        "label": "H3/H4"
       },
       {
        "id": "k3",
        "x": 6.98,
        "y": 5.84,
        "label": "H3/H2"
       },
       {
        "id": "k4",
        "x": 5.84,
        "y": 1.88,
        "label": "H2/H4 (⁴J)",
        "weak": true
       }
      ]
     },
     {
      "id": "hmbc",
      "kind": "2d",
      "type": "HMBC",
      "x": {
       "nucleus": "1H",
       "range": [
        7.6,
        0.6
       ],
       "ref": "h1"
      },
      "y": {
       "nucleus": "13C",
       "range": [
        180,
        0
       ],
       "ref": "c13"
      },
      "peaks": [
       {
        "id": "m1",
        "x": 4.18,
        "y": 166.6,
        "label": "H1'/C1"
       },
       {
        "id": "m2",
        "x": 4.18,
        "y": 14.3,
        "label": "H1'/C2'"
       },
       {
        "id": "m3",
        "x": 1.28,
        "y": 60.1,
        "label": "H2'/C1'",
        "expected": true
       },
       {
        "id": "m4",
        "x": 5.84,
        "y": 166.6,
        "label": "H2/C1",
        "expected": true
       },
       {
        "id": "m5",
        "x": 6.98,
        "y": 166.6,
        "label": "H3/C1",
        "expected": true
       },
       {
        "id": "m6",
        "x": 1.88,
        "y": 144.5,
        "label": "H4/C3",
        "expected": true
       },
       {
        "id": "m7",
        "x": 1.88,
        "y": 122.8,
        "label": "H4/C2",
        "expected": true
       },
       {
        "id": "m8",
        "x": 5.84,
        "y": 17.9,
        "label": "H2/C4",
        "expected": true
       }
      ]
     }
    ],
    "steps": [
     {
      "title": {
       "zh": "先算不饱和度",
       "en": "Start with the degrees of unsaturation"
      },
      "text": {
       "zh": "动谱图之前先看分子式 C_{6}H_{10}O_{2}，它告诉我们要找几个环或双键。",
       "en": "Before touching a spectrum, read the formula C_{6}H_{10}O_{2}. It tells us how many rings or double bonds to look for."
      },
      "board": [
       "DBE = (2×6 + 2 − 10) / 2 = 2"
      ],
      "so": {
       "zh": "两个不饱和度：后面必须找到两个双键，或一个环加一个双键。",
       "en": "Two degrees of unsaturation: we must find two double bonds, or one ring plus one double bond."
      }
     },
     {
      "title": {
       "zh": "清点氢谱",
       "en": "Take stock of the proton spectrum"
      },
      "spectrum": "h1",
      "peaks": [
       "hA",
       "hB",
       "hC",
       "hD",
       "hE"
      ],
      "text": {
       "zh": "氢谱可以分出 5 组信号，从低场到高场积分比为 1 : 1 : 2 : 3 : 3。",
       "en": "The proton spectrum separates into 5 signal groups. From low to high field the integrals are 1 : 1 : 2 : 3 : 3."
      },
      "so": {
       "zh": "加起来正好 10 个 H，和分子式一致，没有多余的杂质峰需要排除。",
       "en": "That adds up to 10 H, matching the formula, so no signal has to be set aside as an impurity."
      }
     },
     {
      "title": {
       "zh": "从最好认的信号入手",
       "en": "Enter through the easiest signal"
      },
      "spectrum": "h1",
      "zoom": [
       4.6,
       0.9
      ],
      "peaks": [
       "hC",
       "hE"
      ],
      "ask": {
       "zh": "一个 2H 四重峰加一个 3H 三重峰，J 相同。这是什么片段？",
       "en": "A 2H quartet and a 3H triplet share the same J. Which fragment is this?"
      },
      "text": {
       "zh": "δ 4.18（q，2H）和 δ 1.28（t，3H）的 J 都是 7.1 Hz。从这里开始，是因为积分、裂分和位移三样都毫不含糊。",
       "en": "δ 4.18 (q, 2H) and δ 1.28 (t, 3H) both show J = 7.1 Hz. We start here because integral, multiplicity and shift are all unambiguous."
      },
      "rule": {
       "zh": "n + 1 规律：CH_{2} 被 3 个邻位 H 裂成四重峰，CH_{3} 被 2 个邻位 H 裂成三重峰。烷基 CH_{2} 出现在 4.2 ppm 说明它直接连 O。",
       "en": "n + 1 rule: three neighbours split the CH_{2} into a quartet, two neighbours split the CH_{3} into a triplet. An alkyl CH_{2} at 4.2 ppm must sit on oxygen."
      },
      "so": {
       "zh": "得到第一个片段：乙氧基 –O–CH_{2}–CH_{3}。",
       "en": "First fragment: an ethoxy group, –O–CH_{2}–CH_{3}."
      },
      "reveal": {
       "atoms": [
        "O2",
        "C5",
        "C6"
       ]
      },
      "atoms": [
       "C5",
       "C6"
      ],
      "assign": {
       "hC": "H-1'",
       "hE": "H-2'"
      }
     },
     {
      "title": {
       "zh": "两个烯氢",
       "en": "Two olefinic protons"
      },
      "spectrum": "h1",
      "zoom": [
       7.4,
       5.5
      ],
      "peaks": [
       "hA",
       "hB"
      ],
      "text": {
       "zh": "δ 6.98 和 δ 5.84 各 1H，都落在烯氢区，而且两者共有一个 15.5 Hz 的大偶合。",
       "en": "δ 6.98 and δ 5.84 are 1H each, both in the alkene region, and they share one large coupling of 15.5 Hz."
      },
      "so": {
       "zh": "它们互为邻位：片段 –CH=CH–，用掉第一个不饱和度。",
       "en": "They are neighbours: a –CH=CH– unit, which uses the first degree of unsaturation."
      },
      "reveal": {
       "atoms": [
        "C3",
        "C2"
       ]
      },
      "atoms": [
       "C3",
       "C2"
      ]
     },
     {
      "title": {
       "zh": "用 J 值定双键构型",
       "en": "Read the alkene geometry from J"
      },
      "spectrum": "h1",
      "zoom": [
       7.12,
       6.82
      ],
      "peaks": [
       "hA"
      ],
      "ask": {
       "zh": "15.5 Hz 的邻位偶合，是 E 还是 Z？",
       "en": "A vicinal coupling of 15.5 Hz: E or Z?"
      },
      "text": {
       "zh": "把 δ 6.98 放大：它是 dq，先被 15.5 Hz 裂成两半，每一半再被 6.9 Hz 裂成四重峰。",
       "en": "Zoom into δ 6.98: a dq, split in two by 15.5 Hz, and each half split into a quartet by 6.9 Hz."
      },
      "rule": {
       "zh": "参考值：^{3}J_{E} ≈ 15 Hz，^{3}J_{Z} ≈ 10 Hz。",
       "en": "Reference values: ^{3}J_{E} ≈ 15 Hz, ^{3}J_{Z} ≈ 10 Hz."
      },
      "so": {
       "zh": "15.5 Hz 指向 E 构型。那个 6.9 Hz 的四重峰说明这个 CH 旁边还有一个 CH_{3}。",
       "en": "15.5 Hz points to the E isomer. The 6.9 Hz quartet says this CH also has a CH_{3} next to it."
      },
      "check": {
       "zh": "15.5、6.9、1.7 Hz 是反式巴豆酸酯的文献典型值。所引的实测报告只描述了裂分形状（\"一大一小的偶合\"），没有给出数值，所以表里写成 J ≈。",
       "en": "15.5, 6.9 and 1.7 Hz are typical literature values for trans-crotonates. The cited measured report only describes the shapes (one large and one small coupling) and gives no numbers, so the table shows J ≈."
      }
     },
     {
      "title": {
       "zh": "双键上的甲基",
       "en": "The methyl on the double bond"
      },
      "spectrum": "h1",
      "zoom": [
       2.08,
       1.68
      ],
      "peaks": [
       "hD"
      ],
      "text": {
       "zh": "δ 1.88（3H）是 dd：6.9 Hz 对上了刚才 δ 6.98 的四重峰，另一个 1.7 Hz 很小。",
       "en": "δ 1.88 (3H) is a dd: 6.9 Hz matches the quartet seen at δ 6.98, and the second coupling is only 1.7 Hz."
      },
      "rule": {
       "zh": "1–2 Hz 的小偶合是典型的烯丙位 ^{4}J，隔着双键传到另一个烯氢。",
       "en": "A small 1–2 Hz coupling is a typical allylic ^{4}J, carried across the double bond to the other olefinic H."
      },
      "so": {
       "zh": "第二个片段：CH_{3}–CH=CH–，其中 δ 6.98 是挨着甲基的 H-3，δ 5.84 是 H-2。",
       "en": "Second fragment: CH_{3}–CH=CH–, where δ 6.98 is H-3 next to the methyl and δ 5.84 is H-2."
      },
      "reveal": {
       "atoms": [
        "C4"
       ]
      },
      "atoms": [
       "C4",
       "C3"
      ],
      "assign": {
       "hD": "H-4",
       "hA": "H-3",
       "hB": "H-2"
      }
     },
     {
      "title": {
       "zh": "碳谱：数碳，找官能团",
       "en": "Carbon spectrum: count carbons, spot the functional group"
      },
      "spectrum": "c13",
      "peaks": [
       "cA"
      ],
      "text": {
       "zh": "碳谱有 6 个峰，正好 6 个碳，没有对称性。两个片段只用了 5 个碳，剩下的是 δ 166.6。",
       "en": "Six carbon signals for six carbons, so no symmetry. Our two fragments account for five carbons. The one left is δ 166.6."
      },
      "rule": {
       "zh": "165–175 ppm 是酯或羧酸的 C=O，酮和醛要到 190 ppm 以上。",
       "en": "165–175 ppm is an ester or acid C=O. Ketones and aldehydes appear above 190 ppm."
      },
      "so": {
       "zh": "酯羰基，正好用掉第二个不饱和度和第二个 O。",
       "en": "An ester carbonyl, which uses the second degree of unsaturation and the second oxygen."
      },
      "reveal": {
       "atoms": [
        "C1",
        "O1"
       ]
      },
      "atoms": [
       "C1"
      ],
      "assign": {
       "cA": "C-1"
      },
      "check": {
       "zh": "C-3 的 ≈144.5 是文献典型值：所引报告的碳谱表在这一行印错了。其余 5 个碳是实测值。",
       "en": "≈144.5 for C-3 is a typical literature value: the cited report's carbon table is misprinted in that row. The other five carbons are measured."
      }
     },
     {
      "title": {
       "zh": "HSQC：给每个 H 找到它的 C",
       "en": "HSQC: give every H its carbon"
      },
      "spectrum": "hsqc",
      "peaks": [
       "q1",
       "q2",
       "q3",
       "q4",
       "q5"
      ],
      "text": {
       "zh": "HSQC 的每个交叉峰是一对直接相连的 H 和 C。从氢向下读到碳，逐个配对。",
       "en": "Each HSQC cross peak is one directly bonded H–C pair. Read down from each proton to its carbon."
      },
      "so": {
       "zh": "五个带氢的碳全部归属。δ 166.6 没有任何交叉峰，确认它是不带 H 的季碳。",
       "en": "All five protonated carbons are assigned. δ 166.6 has no cross peak at all, confirming a carbon without H."
      },
      "assign": {
       "cB": "C-3",
       "cC": "C-2",
       "cD": "C-1'",
       "cE": "C-4",
       "cF": "C-2'"
      }
     },
     {
      "title": {
       "zh": "COSY：沿着偶合走一遍",
       "en": "COSY: walk along the couplings"
      },
      "spectrum": "cosy",
      "peaks": [
       "k2",
       "k3",
       "k4"
      ],
      "text": {
       "zh": "读法是对角峰 → 交叉峰 → 对角峰。从 H-4（1.88）出发走到 H-3（6.98），再走到 H-2（5.84）。H-4 与 H-2 之间还有一个弱峰。",
       "en": "Read it as diagonal → cross peak → diagonal. From H-4 (1.88) we reach H-3 (6.98), then H-2 (5.84). A weak peak also links H-4 and H-2."
      },
      "rule": {
       "zh": "对角线上方和下方的交叉峰是同一个信息，读一侧就够。",
       "en": "Cross peaks above and below the diagonal carry the same information. Read one side."
      },
      "so": {
       "zh": "自旋体系 A：H-4 – H-3 – H-2，和氢谱的裂分完全吻合。",
       "en": "Spin system A: H-4 – H-3 – H-2, in full agreement with the 1D splittings."
      },
      "arrows": [
       {
        "from": "C4",
        "to": "C3",
        "kind": "cosy"
       },
       {
        "from": "C3",
        "to": "C2",
        "kind": "cosy"
       }
      ],
      "atoms": [
       "C4",
       "C3",
       "C2"
      ]
     },
     {
      "title": {
       "zh": "COSY 也告诉我们哪里断开",
       "en": "COSY also shows where the chain stops"
      },
      "spectrum": "cosy",
      "peaks": [
       "k1"
      ],
      "text": {
       "zh": "乙基的 4.18 只和 1.28 相关，与烯氢、甲基之间没有任何交叉峰。",
       "en": "The ethyl CH_{2} at 4.18 correlates only with 1.28. There is no cross peak to the olefinic protons or to the other methyl."
      },
      "so": {
       "zh": "两个自旋体系互相孤立，中间隔着没有 H 的原子。要把它们接起来，必须用 HMBC。",
       "en": "The two spin systems are isolated, separated by atoms that carry no H. Joining them needs HMBC."
      },
      "check": {
       "zh": "没看到的峰也是证据，但只有在预期峰应当很强时才可靠。",
       "en": "A missing peak is evidence too, but only where the expected peak should be strong."
      },
      "arrows": [
       {
        "from": "C5",
        "to": "C6",
        "kind": "cosy"
       }
      ],
      "atoms": [
       "C5",
       "C6"
      ]
     },
     {
      "title": {
       "zh": "HMBC：乙氧基接在哪",
       "en": "HMBC: where the ethoxy group attaches"
      },
      "spectrum": "hmbc",
      "zoom": {
       "x": [
        4.8,
        0.8
       ],
       "y": [
        180,
        0
       ]
      },
      "peaks": [
       "m1"
      ],
      "ask": {
       "zh": "OCH_{2} 的氢如果能看到羰基碳，中间隔了几根键？",
       "en": "If the OCH_{2} protons see the carbonyl carbon, how many bonds lie between them?"
      },
      "text": {
       "zh": "H-1'（4.18）与 δ 166.6 有交叉峰。",
       "en": "H-1' (4.18) shows a cross peak to δ 166.6."
      },
      "rule": {
       "zh": "HMBC 显示 2–3 根键的 H–C 相关。这里的路径是 H–C(1')–O–C(1)，三根键。",
       "en": "HMBC shows H–C correlations over 2–3 bonds. Here the path is H–C(1')–O–C(1), three bonds."
      },
      "so": {
       "zh": "乙氧基通过 O 接在羰基上：–C(=O)–O–CH_{2}CH_{3}，是乙酯。",
       "en": "The ethoxy group is attached to the carbonyl through O: –C(=O)–O–CH_{2}CH_{3}, an ethyl ester."
      },
      "reveal": {
       "bonds": [
        "b1o"
       ]
      },
      "arrows": [
       {
        "from": "C5",
        "to": "C1",
        "kind": "hmbc"
       }
      ],
      "atoms": [
       "C1"
      ]
     },
     {
      "title": {
       "zh": "HMBC：烯基接在哪",
       "en": "HMBC: where the alkene attaches"
      },
      "spectrum": "hmbc",
      "zoom": {
       "x": [
        7.6,
        5.2
       ],
       "y": [
        180,
        100
       ]
      },
      "peaks": [
       "m4",
       "m5"
      ],
      "text": {
       "zh": "H-2（5.84）和 H-3（6.98）也都与 δ 166.6 相关。",
       "en": "H-2 (5.84) and H-3 (6.98) both correlate to δ 166.6 as well."
      },
      "rule": {
       "zh": "H-2 到 C-1 是两根键，H-3 到 C-1 是三根键，都在 HMBC 的范围内。",
       "en": "H-2 to C-1 is two bonds and H-3 to C-1 is three bonds. Both are within HMBC range."
      },
      "so": {
       "zh": "C-2 直接连羰基。两个片段在 C-1 汇合，骨架完成。",
       "en": "C-2 is bonded to the carbonyl. Both fragments meet at C-1 and the skeleton is complete."
      },
      "check": {
       "zh": "注意：这两个交叉峰是按结构预期画的（灰色虚线圈，标 *），所引来源的正文没有逐个列出它们。位移的解释是：与 C=O 共轭使 β 位的 H-3 去屏蔽到 6.98，α 位的 H-2 留在 5.84。",
       "en": "Note: these two cross peaks are drawn as expected from the structure (grey dashed rings, marked *). The cited sources do not list them individually. The shifts fit: conjugation with C=O deshields the β proton H-3 to 6.98, while the α proton H-2 stays at 5.84."
      },
      "reveal": {
       "bonds": [
        "b12"
       ]
      },
      "arrows": [
       {
        "from": "C2",
        "to": "C1",
        "kind": "hmbc"
       },
       {
        "from": "C3",
        "to": "C1",
        "kind": "hmbc",
        "bend": -1
       }
      ],
      "atoms": [
       "C1"
      ]
     },
     {
      "title": {
       "zh": "用剩下的 HMBC 峰交叉检查",
       "en": "Cross-check with the remaining HMBC peaks"
      },
      "spectrum": "hmbc",
      "peaks": [
       "m2",
       "m3",
       "m6",
       "m7",
       "m8"
      ],
      "text": {
       "zh": "其余的峰都应当能在结构上找到 2–3 键的路径：H-4 到 C-3 和 C-2，H-2 到 C-4，H-1' 到 C-2'，H-2' 到 C-1'。其中只有 H-1'/C-2' 是来源明确列出的，其余按结构预期。",
       "en": "Every remaining peak should have a 2–3 bond path in the structure: H-4 to C-3 and C-2, H-2 to C-4, H-1' to C-2', H-2' to C-1'. Only H-1'/C-2' is listed explicitly by a source. The rest are expected from the structure."
      },
      "so": {
       "zh": "预期的相关峰与结构没有矛盾。拿到自己的 HMBC 谱时，要逐个对一遍。",
       "en": "The expected correlations are consistent with the structure. With your own HMBC spectrum, tick them off one by one."
      },
      "arrows": [
       {
        "from": "C4",
        "to": "C2",
        "kind": "hmbc"
       },
       {
        "from": "C2",
        "to": "C4",
        "kind": "hmbc",
        "bend": -1
       },
       {
        "from": "C6",
        "to": "C5",
        "kind": "hmbc"
       }
      ]
     },
     {
      "title": {
       "zh": "最后核对",
       "en": "Final check"
      },
      "spectrum": "h1",
      "peaks": [],
      "final": true,
      "text": {
       "zh": "回头核对：C_{6}H_{10}O_{2} 的原子都用上了，两个不饱和度是 C=C 和 C=O，5 个氢信号和 6 个碳信号全部归属，J = 15.5 Hz 给出 E 构型。",
       "en": "Check back: every atom of C_{6}H_{10}O_{2} is used, the two degrees of unsaturation are C=C and C=O, all 5 proton and 6 carbon signals are assigned, and J = 15.5 Hz gives the E geometry."
      },
      "so": {
       "zh": "结构确定：(E)-丁-2-烯酸乙酯。",
       "en": "The structure is settled: ethyl (E)-but-2-enoate."
      }
     }
    ],
    "sources": [
     {
      "label": "University of Utah, Dept. of Chemistry: ethyl trans-crotonate NMR report (500 MHz)",
      "url": "https://www.chemistry.utah.edu/wp-content/uploads/sites/15/2024/11/ethyltranscrotonate.pdf",
      "covers": {
       "zh": "实测：全部 5 个 ^{1}H 位移（6.978、5.841、4.180、1.877、1.282）和 5 个 ^{13}C 位移（166.58、122.79、60.08、17.92、14.26），裂分形状，以及 COSY 的 4 个相关（含 H-4/H-2 的弱峰）。该报告没有给出 J 的数值；它的碳谱表把 C-3 误印为 77.017（溶剂峰的位置），所以 C-3 的 144.5 不是出自这份实测。",
       "en": "Measured: all five ^{1}H shifts (6.978, 5.841, 4.180, 1.877, 1.282) and five ^{13}C shifts (166.58, 122.79, 60.08, 17.92, 14.26), the multiplet shapes, and the four COSY correlations (including the weak H-4/H-2 peak). The report gives no J values in Hz, and its carbon table misprints C-3 as 77.017 (the solvent position), so 144.5 for C-3 is not from this measurement."
      }
     },
     {
      "label": "Magritek Spinsolve case study: ethyl crotonate (60 MHz, CDCl3)",
      "url": "https://magritek.com/wp-content/uploads/2020/06/Case-Study-Spinsolve-Ethylcrotonate.pdf",
      "covers": {
       "zh": "实测：HMBC 中 OCH_{2} 的氢与羰基碳和 CH_{3} 碳相关；COSY 的相关。",
       "en": "Measured: the HMBC correlations from the OCH_{2} protons to the carbonyl carbon and to the CH_{3} carbon; the COSY correlations."
      }
     }
    ]
   }
  },
  {
   "id": "vanillin",
   "spec": {
    "title": {
     "zh": "由 1D 与 2D NMR 推出 C_{8}H_{8}O_{3} 的结构",
     "en": "Solving C_{8}H_{8}O_{3} from 1D and 2D NMR"
    },
    "shortTitle": "C8H8O3 NMR walkthrough",
    "formula": "C8H8O3",
    "prompt": {
     "zh": "CDCl_{3} 中测得 ^{1}H、^{13}C、HMQC、HMBC（500 MHz）。推出结构，说明三个取代基各在哪个位置，并归属每一个峰。",
     "en": "^{1}H, ^{13}C, HMQC and HMBC in CDCl_{3} (500 MHz). Deduce the structure, place each of the three substituents, and assign every peak."
    },
    "note": {
     "zh": "全部位移和 HMQC、HMBC 相关都取自下面所列来源的实测数据。带 ≈ 的 J 值是文献典型值。",
     "en": "All shifts and the HMQC and HMBC correlations are measured data from the source listed below. J values marked ≈ are typical literature values."
    },
    "answer": {
     "zh": "答案：4-羟基-3-甲氧基苯甲醛（香草醛）",
     "en": "Answer: 4-hydroxy-3-methoxybenzaldehyde (vanillin)"
    },
    "sources": [
     {
      "label": "University of Utah, Dept. of Chemistry: vanillin NMR report (500 MHz, CDCl3, 100 mM, TMS)",
      "url": "https://www.chemistry.utah.edu/wp-content/uploads/sites/15/2024/11/vanillin.pdf",
      "covers": {
       "zh": "实测：6 个 ^{1}H 位移（9.83、7.43、7.27 溶剂、7.05、6.29、3.97），8 个 ^{13}C 位移（191.0、151.7、147.2、129.9、127.6、114.4、108.7、56.1）和溶剂的 77.0；HMQC：7.05 的 H 连 114.4，7.43 处有两个 H，OH 不与任何碳相关；HMBC：3.97 只与 147.2 相关，6.29 与 114.4、147.2、151.7 相关，9.83 与 108.7、129.9 相关。该报告没有给出 J 的数值，也没有 NOESY。",
       "en": "Measured: six ^{1}H shifts (9.83, 7.43, 7.27 solvent, 7.05, 6.29, 3.97), eight ^{13}C shifts (191.0, 151.7, 147.2, 129.9, 127.6, 114.4, 108.7, 56.1) plus the solvent at 77.0; HMQC: the 7.05 proton sits on 114.4, two protons lie at 7.43, and the OH correlates with no carbon; HMBC: 3.97 correlates only with 147.2, 6.29 with 114.4, 147.2 and 151.7, and 9.83 with 108.7 and 129.9. The report gives no J values in Hz and no NOESY."
      }
     },
     {
      "label": "UNC Pembroke: vanillin assignment sheet",
      "url": "https://www.uncp.edu/sites/default/files/2024-04/vanillin_1.pdf",
      "covers": {
       "zh": "第二份独立数据，用来交叉核对：^{13}C 191.06、151.92、147.22、129.41、127.29、114.46、108.89、55.80，与上面相差都在 0.5 ppm 以内；并记录 7.03 处的双峰线距约 9 Hz（未注明场强）。",
       "en": "A second, independent data set used as a cross-check: ^{13}C 191.06, 151.92, 147.22, 129.41, 127.29, 114.46, 108.89, 55.80, all within 0.5 ppm of the values above; it also records a doublet near 7.03 with a spacing of about 9 Hz (field strength not stated)."
      }
     }
    ],
    "molecule": {
     "atoms": [
      {
       "id": "C1",
       "x": -1,
       "y": 0,
       "label": "",
       "num": "1",
       "numAt": [
        12,
        0
       ]
      },
      {
       "id": "C2",
       "x": -0.5,
       "y": -0.866,
       "label": "",
       "num": "2",
       "numAt": [
        6,
        10.4
       ]
      },
      {
       "id": "C3",
       "x": 0.5,
       "y": -0.866,
       "label": "",
       "num": "3",
       "numAt": [
        -6,
        10.4
       ]
      },
      {
       "id": "C4",
       "x": 1,
       "y": 0,
       "label": "",
       "num": "4",
       "numAt": [
        -12,
        0
       ]
      },
      {
       "id": "C5",
       "x": 0.5,
       "y": 0.866,
       "label": "",
       "num": "5",
       "numAt": [
        -6,
        -10.4
       ]
      },
      {
       "id": "C6",
       "x": -0.5,
       "y": 0.866,
       "label": "",
       "num": "6",
       "numAt": [
        6,
        -10.4
       ]
      },
      {
       "id": "C7",
       "x": -2,
       "y": 0,
       "label": "CHO"
      },
      {
       "id": "O3",
       "x": 1,
       "y": -1.732,
       "label": "O"
      },
      {
       "id": "C8",
       "x": 2,
       "y": -1.732,
       "label": "CH3"
      },
      {
       "id": "O4",
       "x": 2,
       "y": 0,
       "label": "OH"
      }
     ],
     "bonds": [
      {
       "a": "C1",
       "b": "C2",
       "order": 2
      },
      {
       "a": "C2",
       "b": "C3"
      },
      {
       "a": "C3",
       "b": "C4",
       "order": 2
      },
      {
       "a": "C4",
       "b": "C5"
      },
      {
       "a": "C5",
       "b": "C6",
       "order": 2
      },
      {
       "a": "C6",
       "b": "C1"
      },
      {
       "a": "C1",
       "b": "C7"
      },
      {
       "a": "C3",
       "b": "O3"
      },
      {
       "a": "O3",
       "b": "C8"
      },
      {
       "a": "C4",
       "b": "O4"
      }
     ]
    },
    "spectra": [
     {
      "id": "h1",
      "kind": "1d",
      "nucleus": "1H",
      "mhz": 500,
      "range": [
       10.4,
       3.4
      ],
      "peaks": [
       {
        "id": "hCHO",
        "ppm": 9.83,
        "mult": "s",
        "nH": 1
       },
       {
        "id": "hF",
        "ppm": 7.43,
        "mult": "m",
        "nH": 2,
        "lw": 9
       },
       {
        "id": "hS",
        "ppm": 7.27,
        "mult": "s",
        "intensity": 0.25
       },
       {
        "id": "hD",
        "ppm": 7.05,
        "mult": "d",
        "J": [
         8.2
        ],
        "Jest": true,
        "nH": 1
       },
       {
        "id": "hOH",
        "ppm": 6.29,
        "mult": "s",
        "nH": 1,
        "lw": 3
       },
       {
        "id": "hOMe",
        "ppm": 3.97,
        "mult": "s",
        "nH": 3
       }
      ]
     },
     {
      "id": "c13",
      "kind": "1d",
      "nucleus": "13C",
      "mhz": 125,
      "range": [
       200,
       45
      ],
      "peaks": [
       {
        "id": "c191",
        "ppm": 191,
        "type": "CH"
       },
       {
        "id": "c152",
        "ppm": 151.7,
        "type": "C",
        "intensity": 0.5
       },
       {
        "id": "c147",
        "ppm": 147.2,
        "type": "C",
        "intensity": 0.5
       },
       {
        "id": "c130",
        "ppm": 129.9,
        "type": "C",
        "intensity": 0.5
       },
       {
        "id": "c128",
        "ppm": 127.6,
        "type": "CH"
       },
       {
        "id": "c114",
        "ppm": 114.4,
        "type": "CH"
       },
       {
        "id": "c109",
        "ppm": 108.7,
        "type": "CH"
       },
       {
        "id": "cS",
        "ppm": 77,
        "mult": "t",
        "J": [
         32
        ],
        "Jest": true,
        "type": "",
        "intensity": 2.2
       },
       {
        "id": "c56",
        "ppm": 56.1,
        "type": "CH3"
       }
      ]
     },
     {
      "id": "hmqc",
      "kind": "2d",
      "type": "HMQC",
      "x": {
       "nucleus": "1H",
       "range": [
        10.4,
        3.4
       ],
       "ref": "h1"
      },
      "y": {
       "nucleus": "13C",
       "range": [
        200,
        45
       ],
       "ref": "c13"
      },
      "peaks": [
       {
        "id": "q1",
        "x": 7.43,
        "y": 127.6,
        "label": "7.43 / 127.6"
       },
       {
        "id": "q2",
        "x": 7.43,
        "y": 108.7,
        "label": "7.43 / 108.7"
       },
       {
        "id": "q3",
        "x": 7.05,
        "y": 114.4,
        "label": "7.05 / 114.4"
       },
       {
        "id": "q4",
        "x": 9.83,
        "y": 191,
        "label": "9.83 / 191.0",
        "expected": true
       },
       {
        "id": "q5",
        "x": 3.97,
        "y": 56.1,
        "label": "3.97 / 56.1",
        "expected": true
       }
      ]
     },
     {
      "id": "hmbc",
      "kind": "2d",
      "type": "HMBC",
      "x": {
       "nucleus": "1H",
       "range": [
        10.4,
        3.4
       ],
       "ref": "h1"
      },
      "y": {
       "nucleus": "13C",
       "range": [
        200,
        45
       ],
       "ref": "c13"
      },
      "peaks": [
       {
        "id": "m1",
        "x": 9.83,
        "y": 129.9,
        "label": "9.83 / 129.9"
       },
       {
        "id": "m2",
        "x": 9.83,
        "y": 108.7,
        "label": "9.83 / 108.7"
       },
       {
        "id": "m3",
        "x": 3.97,
        "y": 147.2,
        "label": "3.97 / 147.2"
       },
       {
        "id": "m4",
        "x": 6.29,
        "y": 151.7,
        "label": "OH / 151.7"
       },
       {
        "id": "m5",
        "x": 6.29,
        "y": 147.2,
        "label": "OH / 147.2"
       },
       {
        "id": "m6",
        "x": 6.29,
        "y": 114.4,
        "label": "OH / 114.4"
       }
      ]
     }
    ],
    "steps": [
     {
      "title": {
       "zh": "不饱和度：5",
       "en": "Degrees of unsaturation: 5"
      },
      "text": {
       "zh": "C_{8}H_{8}O_{3} 的不饱和度是 5。只有 8 个碳却有 5 个不饱和度，这个数字本身就在提示结构类型。",
       "en": "C_{8}H_{8}O_{3} has 5 degrees of unsaturation. Five on only eight carbons is itself a hint about the structure type."
      },
      "board": [
       "DBE = (2×8 + 2 − 8) / 2 = 5",
       "5 = 4 (benzene ring) + 1"
      ],
      "rule": {
       "zh": "一个苯环占 4 个不饱和度（3 个 C=C 加 1 个环）。",
       "en": "A benzene ring accounts for 4 (three C=C plus one ring)."
      },
      "so": {
       "zh": "很可能是一个苯环，再加一个双键或一个环。先当作假设，后面用谱图验证。",
       "en": "Probably one benzene ring plus one more double bond or ring. Keep it as a hypothesis to test."
      }
     },
     {
      "title": {
       "zh": "清点氢谱：6 组峰",
       "en": "Proton inventory: 6 signal groups"
      },
      "spectrum": "h1",
      "peaks": [
       "hCHO",
       "hF",
       "hS",
       "hD",
       "hOH",
       "hOMe"
      ],
      "text": {
       "zh": "TMS 之外有 6 组峰：9.83、7.43、7.27、7.05、6.29、3.97。3.97 的峰面积接近其他峰的三倍；7.43 处是两个 H 叠在一起。",
       "en": "Besides TMS there are 6 signal groups: 9.83, 7.43, 7.27, 7.05, 6.29, 3.97. The 3.97 signal has nearly three times the area of the others, and two H coincide at 7.43."
      },
      "so": {
       "zh": "1 + 2 + 1 + 1 + 3 = 8H 已经够数，7.27 的小峰是多出来的，下一步先处理它。",
       "en": "1 + 2 + 1 + 1 + 3 = 8H is already complete, so the small signal at 7.27 is surplus. It is dealt with next."
      }
     },
     {
      "title": {
       "zh": "芳香区里混着一个溶剂峰",
       "en": "A solvent peak hiding in the aromatic region"
      },
      "spectrum": "h1",
      "zoom": [
       7.62,
       6.88
      ],
      "peaks": [
       "hS"
      ],
      "ask": {
       "zh": "δ 7.27 的小单峰正好落在芳香区。它是样品的峰吗？",
       "en": "The small singlet at δ 7.27 sits right in the aromatic region. Does it belong to the sample?"
      },
      "text": {
       "zh": "δ 7.27 是一个面积很小的尖锐单峰，夹在 7.43 和 7.05 之间。",
       "en": "δ 7.27 is a sharp singlet of small area, sitting between 7.43 and 7.05."
      },
      "rule": {
       "zh": "CDCl_{3} 里残余的 CHCl_{3} 出现在 7.26–7.27 ppm。它的面积不成整数比，也和别的峰没有偶合。",
       "en": "Residual CHCl_{3} in CDCl_{3} appears at 7.26–7.27 ppm. Its area is not an integer ratio and it couples to nothing."
      },
      "so": {
       "zh": "7.27 是溶剂峰，排除。真正的芳氢只有 7.43（2H）和 7.05（1H），共 3 个。",
       "en": "7.27 is the solvent and is excluded. The true aromatic protons are 7.43 (2H) and 7.05 (1H), three in total."
      },
      "check": {
       "zh": "做芳香族化合物时，CDCl_{3} 的残余峰最容易被误算成一个芳氢。",
       "en": "With aromatic compounds, the residual CDCl_{3} peak is the one most easily miscounted as an aromatic H."
      },
      "assign": {
       "hS": "CHCl3"
      }
     },
     {
      "title": {
       "zh": "入口信号：3H 单峰",
       "en": "Entry signal: the 3H singlet"
      },
      "spectrum": "h1",
      "zoom": [
       4.5,
       3.5
      ],
      "peaks": [
       "hOMe"
      ],
      "text": {
       "zh": "δ 3.97 是 3H 单峰。从它入手，因为积分、裂分、位移三样都不含糊。",
       "en": "δ 3.97 is a 3H singlet. We enter here because integral, multiplicity and shift are all unambiguous."
      },
      "rule": {
       "zh": "单峰说明邻位没有 H；3.7–4.0 ppm 的甲基连在 O 上。",
       "en": "A singlet means no neighbouring H. A methyl at 3.7–4.0 ppm sits on oxygen."
      },
      "so": {
       "zh": "片段一：–OCH_{3}。",
       "en": "Fragment 1: –OCH_{3}."
      },
      "check": {
       "zh": "它是芳基甲基醚还是甲酯，现在还分不清，等碳谱再判断。",
       "en": "Aryl methyl ether or methyl ester cannot be told apart yet. The carbon spectrum will decide."
      },
      "assign": {
       "hOMe": "OCH3"
      }
     },
     {
      "title": {
       "zh": "两个孤立的 1H 单峰",
       "en": "Two isolated 1H singlets"
      },
      "spectrum": "h1",
      "zoom": [
       10.3,
       5.9
      ],
      "peaks": [
       "hCHO",
       "hOH"
      ],
      "ask": {
       "zh": "δ 9.83 和 δ 6.29 各 1H，都是单峰。哪个连在碳上，哪个连在氧上？怎么验证？",
       "en": "δ 9.83 and δ 6.29 are 1H singlets. Which is on carbon and which on oxygen, and how would you test it?"
      },
      "text": {
       "zh": "δ 9.83 在很低场；δ 6.29 的位置不属于任何常见的 C–H 类型。",
       "en": "δ 9.83 lies at very low field. δ 6.29 fits no common C–H type."
      },
      "rule": {
       "zh": "9.5–10 ppm 的单峰是醛基 H。酚羟基在 CDCl_{3} 里常在 5–7 ppm，位置随浓度和温度移动。",
       "en": "A singlet at 9.5–10 ppm is an aldehyde H. A phenol OH in CDCl_{3} is often at 5–7 ppm and moves with concentration and temperature."
      },
      "so": {
       "zh": "片段二：–CHO（它就是第 5 个不饱和度）。片段三：–OH，暂定。三个 O 正好用完。",
       "en": "Fragment 2: –CHO, which is the fifth degree of unsaturation. Fragment 3: –OH, tentatively. All three oxygens are used."
      },
      "check": {
       "zh": "OH 只是暂定。HMQC 可以检验：连在氧上的 H 不会与任何碳出现交叉峰。",
       "en": "The OH is only tentative. HMQC can test it: a proton on oxygen shows no cross peak to any carbon."
      },
      "assign": {
       "hCHO": "CHO",
       "hOH": "OH"
      }
     },
     {
      "title": {
       "zh": "芳香区：1D 读不出取代模式",
       "en": "Aromatic region: 1D cannot give the pattern"
      },
      "spectrum": "h1",
      "zoom": [
       7.62,
       6.88
      ],
      "peaks": [
       "hF",
       "hD"
      ],
      "text": {
       "zh": "δ 7.05 是清楚的双峰（1H）。δ 7.43 是 2H，但两个 H 的位移几乎相同，挤成一团，裂分读不出来。",
       "en": "δ 7.05 is a clean doublet (1H). δ 7.43 is 2H, but the two protons have almost the same shift and merge into one lump whose splitting cannot be read."
      },
      "rule": {
       "zh": "苯环参考值：邻位 ^{3}J ≈ 7–9 Hz，间位 ^{4}J ≈ 1–3 Hz。7.05 的双峰裂距是邻位大小，说明这个 H 恰好有一个邻位 H。",
       "en": "Benzene reference values: ortho ^{3}J ≈ 7–9 Hz, meta ^{4}J ≈ 1–3 Hz. The doublet at 7.05 has an ortho-sized spacing, so this H has exactly one ortho H neighbour."
      },
      "so": {
       "zh": "苯环上有 3 个 H 和 3 个取代基，其中至少两个 H 相邻。具体怎么排，这张谱定不了。",
       "en": "The ring has 3 H and 3 substituents, and at least two H are adjacent. This spectrum cannot fix the exact arrangement."
      },
      "check": {
       "zh": "这里是偶然重叠，不要硬读 7.43 的峰形。J ≈ 8 Hz 是典型值：所引报告只写了\"双峰\"，第二份数据记录的线距约 9 Hz。",
       "en": "This is accidental overlap, so do not force a reading of the 7.43 lump. J ≈ 8 Hz is a typical value: the cited report only says doublet, and the second data set records a spacing of about 9 Hz."
      }
     },
     {
      "title": {
       "zh": "碳谱：数碳，认官能团",
       "en": "Carbon spectrum: count carbons, read functional groups"
      },
      "spectrum": "c13",
      "peaks": [
       "c191",
       "c152",
       "c147",
       "c56",
       "cS"
      ],
      "text": {
       "zh": "除去 δ 77.0 的三重峰（CDCl_{3}，D 的 I = 1，2nI + 1 = 3），正好 8 个碳。191.0 是羰基，151.7 和 147.2 是连 O 的芳碳，56.1 是 OCH_{3}。",
       "en": "Leaving out the triplet at δ 77.0 (CDCl_{3}; D has I = 1, so 2nI + 1 = 3), there are exactly 8 carbons. 191.0 is a carbonyl, 151.7 and 147.2 are aromatic carbons on oxygen, 56.1 is the OCH_{3}."
      },
      "rule": {
       "zh": "醛、酮羰基在 190 ppm 以上，酯在 165–175。芳基甲基醚的 OCH_{3} 约 55–56，甲酯约 51–52。",
       "en": "Aldehyde and ketone C=O appear above 190 ppm, esters at 165–175. An aryl methyl ether OCH_{3} is near 55–56, a methyl ester near 51–52."
      },
      "so": {
       "zh": "191.0 排除了酯，56.1 说明是 Ar–OCH_{3}。8 个碳没有对称性：6 个芳碳各不相同。",
       "en": "191.0 rules out an ester and 56.1 means Ar–OCH_{3}. Eight carbons with no symmetry: all six ring carbons differ."
      },
      "assign": {
       "cS": "CDCl3",
       "c56": "OCH3",
       "c191": "CHO"
      }
     },
     {
      "title": {
       "zh": "HMQC：把叠在一起的两个 H 分开",
       "en": "HMQC: separating the two overlapping protons"
      },
      "spectrum": "hmqc",
      "zoom": {
       "x": [
        7.7,
        6.8
       ],
       "y": [
        135,
        102
       ]
      },
      "peaks": [
       "q1",
       "q2",
       "q3"
      ],
      "ask": {
       "zh": "7.43 那一团在氢谱里分不开。换到碳这一维，会发生什么？",
       "en": "The lump at 7.43 cannot be separated in the proton spectrum. What happens along the carbon axis?"
      },
      "text": {
       "zh": "7.05 的 H 连在 114.4 上。7.43 这一列出现两个交叉峰，分别对着 127.6 和 108.7。6.29 的 H 没有任何交叉峰。",
       "en": "The 7.05 proton sits on 114.4. The 7.43 column shows two cross peaks, to 127.6 and to 108.7. The 6.29 proton has no cross peak at all."
      },
      "rule": {
       "zh": "HMQC（和 HSQC 一样）只显示直接相连的 H–C。两个 H 的氢位移相同，但它们的碳相差近 20 ppm，在碳维上自然分开。",
       "en": "HMQC, like HSQC, shows only directly bonded H–C pairs. The two protons share a proton shift, but their carbons differ by almost 20 ppm and separate along the carbon axis."
      },
      "so": {
       "zh": "7.43 确实是两个不同的 CH。带氢的芳碳：127.6、114.4、108.7；不带氢的：151.7、147.2、129.9。6.29 确认是 OH。",
       "en": "7.43 really is two different CH groups. Protonated ring carbons: 127.6, 114.4, 108.7. Non-protonated: 151.7, 147.2, 129.9. The 6.29 signal is confirmed as OH."
      },
      "check": {
       "zh": "灰色虚线圈（9.83/191.0 和 3.97/56.1）是按归属预期的相关峰，所引报告的正文没有逐个写出。",
       "en": "The grey dashed rings (9.83/191.0 and 3.97/56.1) are correlations expected from the assignment. The cited report does not spell them out."
      }
     },
     {
      "title": {
       "zh": "手里的零件，和 10 种拼法",
       "en": "The parts in hand, and 10 ways to combine them"
      },
      "text": {
       "zh": "零件齐了：一个带 3 个 H 的苯环，加上 CHO、OCH_{3}、OH 三个取代基。",
       "en": "All parts are known: a benzene ring with 3 H, plus the substituents CHO, OCH_{3} and OH."
      },
      "board": [
       "ring:  3 × CH   127.6   114.4   108.7",
       "       3 × C    151.7   147.2   129.9",
       "subst: CHO (9.83 / 191.0)",
       "       OCH3 (3.97 / 56.1)",
       "       OH  (6.29)"
      ],
      "rule": {
       "zh": "带三个不同取代基的苯有 10 种位置异构体。",
       "en": "A benzene ring with three different substituents has 10 positional isomers."
      },
      "so": {
       "zh": "1D 谱和 HMQC 都定不了位置。需要 HMBC：它能从取代基上的 H 看到环上的碳。",
       "en": "Neither the 1D spectra nor HMQC can fix the positions. HMBC is needed: it lets the substituent protons see the ring carbons."
      }
     },
     {
      "title": {
       "zh": "HMBC：甲氧基连在哪个碳上",
       "en": "HMBC: which carbon carries the methoxy group"
      },
      "spectrum": "hmbc",
      "zoom": {
       "x": [
        4.6,
        3.4
       ],
       "y": [
        160,
        138
       ]
      },
      "peaks": [
       "m3"
      ],
      "text": {
       "zh": "OCH_{3} 的 H（3.97）只与一个碳相关：147.2。",
       "en": "The OCH_{3} protons (3.97) correlate with one carbon only: 147.2."
      },
      "rule": {
       "zh": "路径 H–C–O–C(芳) 是三根键，这是甲氧基的 H 能到达的唯一环碳。",
       "en": "The path H–C–O–C(aryl) is three bonds, and that is the only ring carbon the methoxy protons can reach."
      },
      "so": {
       "zh": "147.2 就是带 OCH_{3} 的碳。于是另一个连 O 的芳碳 151.7 带的是 OH。",
       "en": "147.2 is the carbon bearing OCH_{3}. The other oxygenated ring carbon, 151.7, therefore bears the OH."
      },
      "assign": {
       "c147": "C–OCH3",
       "c152": "C–OH"
      }
     },
     {
      "title": {
       "zh": "HMBC：让 OH 的氢来定位",
       "en": "HMBC: let the OH proton do the locating"
      },
      "spectrum": "hmbc",
      "zoom": {
       "x": [
        6.9,
        5.7
       ],
       "y": [
        160,
        105
       ]
      },
      "peaks": [
       "m4",
       "m5",
       "m6"
      ],
      "ask": {
       "zh": "OH 的 H 通过 2–3 根键能看到哪几个碳？",
       "en": "Which carbons can the OH proton see over 2–3 bonds?"
      },
      "text": {
       "zh": "OH（6.29）与三个碳相关：151.7、147.2 和 114.4。",
       "en": "The OH (6.29) correlates with three carbons: 151.7, 147.2 and 114.4."
      },
      "rule": {
       "zh": "H–O–C 是两根键（它自己的碳），H–O–C–C 是三根键（两个邻位碳）。所以 OH 看到的正好是本位碳和左右两个邻居。",
       "en": "H–O–C is two bonds (its own carbon) and H–O–C–C is three bonds (the two ortho carbons). The OH therefore sees exactly its own carbon and both neighbours."
      },
      "so": {
       "zh": "151.7（C–OH）的两个邻居是 147.2 和 114.4。也就是说：OCH_{3} 和 OH 相邻，OH 的另一侧是带着 7.05 那个 H 的 CH。",
       "en": "The neighbours of 151.7 (C–OH) are 147.2 and 114.4. So OCH_{3} and OH are adjacent, and on the other side of the OH is the CH that carries the 7.05 proton."
      },
      "check": {
       "zh": "OH 的 HMBC 峰不是每次都能看到：交换太快时会消失。这份谱里看到了，是很有用的证据。",
       "en": "HMBC peaks from an OH are not always visible: fast exchange wipes them out. Here they are seen, and they are valuable evidence."
      },
      "reveal": {
       "atoms": [
        "C3",
        "O3",
        "C8",
        "C4",
        "O4",
        "C5"
       ]
      },
      "atoms": [
       "C3",
       "C5"
      ],
      "arrows": [
       {
        "from": "O4",
        "to": "C3",
        "kind": "hmbc"
       },
       {
        "from": "O4",
        "to": "C5",
        "kind": "hmbc",
        "bend": 1
       }
      ],
      "assign": {
       "hD": "H-5",
       "c114": "C-5",
       "c147": "C-3",
       "c152": "C-4"
      }
     },
     {
      "title": {
       "zh": "HMBC：醛基接在哪",
       "en": "HMBC: where the aldehyde attaches"
      },
      "spectrum": "hmbc",
      "zoom": {
       "x": [
        10.3,
        9.3
       ],
       "y": [
        140,
        100
       ]
      },
      "peaks": [
       "m1",
       "m2"
      ],
      "text": {
       "zh": "醛基 H（9.83）与 129.9 和 108.7 相关。129.9 不带 H，108.7 是一个 CH。",
       "en": "The aldehyde H (9.83) correlates with 129.9 and 108.7. 129.9 carries no H, and 108.7 is a CH."
      },
      "rule": {
       "zh": "H–C(=O)–C 是两根键，到达醛基所连的环碳；再多一根键到它的邻位碳。",
       "en": "H–C(=O)–C is two bonds and reaches the ring carbon bearing the CHO. One more bond reaches the carbons ortho to it."
      },
      "so": {
       "zh": "带 CHO 的环碳是 129.9，它的一个邻位是 108.7 的 CH。最后一个不带 H 的碳也有了着落。",
       "en": "The ring carbon bearing CHO is 129.9, and one of its neighbours is the CH at 108.7. The last non-protonated carbon is now placed."
      },
      "assign": {
       "c130": "C-1"
      }
     },
     {
      "title": {
       "zh": "拼环：只剩两个候选",
       "en": "Closing the ring: two candidates left"
      },
      "spectrum": "h1",
      "zoom": [
       7.62,
       6.88
      ],
      "peaks": [
       "hD"
      ],
      "ask": {
       "zh": "环上已有 C-3(OCH_{3})–C-4(OH)–C-5(H)。7.05 的 H-5 是邻位双峰，所以下一个是 CH。剩下 C(CHO) 和一个 CH，有几种接法？",
       "en": "The ring so far reads C-3(OCH_{3})–C-4(OH)–C-5(H). H-5 at 7.05 is an ortho doublet, so the next atom is a CH. A C(CHO) and one CH remain. How many ways can they close the ring?"
      },
      "text": {
       "zh": "两种。A：C-5H–C-6H–C-1(CHO)–C-2H–C-3，CHO 两侧都是 CH。B：C-5H–CH–CH–C(CHO)–C-3，三个 CH 连成一排，CHO 紧挨着 OCH_{3} 的碳。两者都符合前面所有的 HMBC。",
       "en": "Two. A: C-5H–C-6H–C-1(CHO)–C-2H–C-3, with CH on both sides of the CHO. B: C-5H–CH–CH–C(CHO)–C-3, three CH in a row with the CHO next to the OCH_{3} carbon. Both fit every HMBC peak so far."
      },
      "so": {
       "zh": "10 种异构体只剩 A 和 B。区别只有一处：CHO 的环碳挨着 OCH_{3} 的碳（B），还是隔着一个 CH（A）。",
       "en": "Of the 10 isomers only A and B remain. They differ in one place: the CHO carbon is either next to the OCH_{3} carbon (B) or separated from it by a CH (A)."
      }
     },
     {
      "title": {
       "zh": "用碳位移在 A 和 B 之间取舍",
       "en": "Choosing between A and B by carbon shifts"
      },
      "spectrum": "c13",
      "zoom": [
       135,
       50
      ],
      "peaks": [
       "c56",
       "c109"
      ],
      "text": {
       "zh": "回到碳谱看两个数：OCH_{3} 的碳在 56.1；醛基 H 在 HMBC 里看到的那个 CH 在 108.7，是所有芳碳里最高场的。",
       "en": "Back to the carbon spectrum for two numbers: the OCH_{3} carbon is at 56.1, and the CH that the aldehyde H sees in HMBC is at 108.7, the most shielded of all ring carbons."
      },
      "rule": {
       "zh": "两条位移规律。其一：芳基 OCH_{3} 两侧都有取代基时，它的碳在 60–62 ppm；至少一侧是 H 时在 55–56 ppm。其二：芳环 CH 要屏蔽到 110 ppm 以下，通常要紧挨着一个连 O 的碳。",
       "en": "Two shift rules. First: an aryl OCH_{3} flanked by substituents on both sides has its carbon at 60–62 ppm; with an H on at least one side it is at 55–56 ppm. Second: an aromatic CH shielded below 110 ppm normally sits next to an oxygen-bearing carbon."
      },
      "so": {
       "zh": "OCH_{3} 在 56.1：它旁边必须有一个 CH，B 排除。108.7 的 CH 夹在 C-1 和 C-3 之间，正是 A 里的 C-2。结构是 A。",
       "en": "The OCH_{3} is at 56.1, so it must have a CH beside it, and B is ruled out. The CH at 108.7 lies between C-1 and C-3, which is C-2 in A. The structure is A."
      },
      "check": {
       "zh": "这一步用的是位移规律，属于\"指向\"而不是直接证明。直接的证明是 NOE：OCH_{3} 应当与 H-2 相关。所引数据里没有 NOESY，所以这里不画。",
       "en": "This step uses shift rules, so it points to A but is not a direct proof. The direct proof would be an NOE from OCH_{3} to H-2. The cited data contain no NOESY, so none is drawn here."
      },
      "reveal": {
       "atoms": [
        "C6",
        "C1",
        "C7",
        "C2"
       ]
      },
      "atoms": [
       "C2"
      ],
      "assign": {
       "c109": "C-2",
       "c128": "C-6",
       "hF": "H-2 + H-6"
      }
     },
     {
      "title": {
       "zh": "最后核对",
       "en": "Final check"
      },
      "spectrum": "h1",
      "peaks": [],
      "final": true,
      "text": {
       "zh": "核对：C_{8}H_{8}O_{3} 的原子全部用上；5 个不饱和度 = 苯环 4 + C=O 1；5 组样品的氢信号（8H）和 8 个碳全部归属，溶剂峰已说明。6 个实测 HMBC 相关在结构上都是 2 或 3 根键。",
       "en": "Check: every atom of C_{8}H_{8}O_{3} is used; 5 degrees of unsaturation = 4 for the ring + 1 for C=O; all 5 sample proton signals (8H) and 8 carbons are assigned, and the solvent is accounted for. All six measured HMBC correlations span 2 or 3 bonds in the structure."
      },
      "so": {
       "zh": "结构确定：4-羟基-3-甲氧基苯甲醛，也就是香草醛。",
       "en": "The structure is settled: 4-hydroxy-3-methoxybenzaldehyde, better known as vanillin."
      },
      "check": {
       "zh": "想把 H-2 和 H-6 分开看，可以换溶剂（例如 DMSO-d_{6}）重测。",
       "en": "To see H-2 and H-6 separately, the sample can be re-measured in another solvent such as DMSO-d_{6}."
      }
     }
    ]
   }
  },
  {
   "id": "ibuprofen",
   "spec": {
    "title": {
     "zh": "由 60 MHz 台式 NMR 推出 C_{13}H_{18}O_{2} 的结构",
     "en": "Solving C_{13}H_{18}O_{2} from 60 MHz benchtop NMR"
    },
    "shortTitle": "C13H18O2 NMR walkthrough",
    "formula": "C13H18O2",
    "prompt": {
     "zh": "在 CDCl_{3} 中用 60 MHz 台式仪器测得 ^{1}H、^{13}C、COSY、HSQC-ME 和 HMBC。推出结构并归属每一个峰。",
     "en": "^{1}H, ^{13}C, COSY, HSQC-ME and HMBC measured in CDCl_{3} on a 60 MHz benchtop instrument. Deduce the structure and assign every peak."
    },
    "note": {
     "zh": "位移、J 值、积分和正文写明的相关峰都取自下面所列的实测数据。带 ≈ 或 * 的是来源没有逐个写出的值。",
     "en": "Shifts, J values, integrals and the correlations stated in the text are measured data from the source below. Items marked ≈ or * are not spelled out by the source."
    },
    "answer": {
     "zh": "答案：2-[4-(2-甲基丙基)苯基]丙酸（布洛芬）",
     "en": "Answer: 2-[4-(2-methylpropyl)phenyl]propanoic acid (ibuprofen)"
    },
    "sources": [
     {
      "label": "Oxford Instruments application note: Structural Elucidation by Benchtop NMR Spectroscopy, Ibuprofen (X-Pulse; 1H 60 MHz, 13C 15 MHz, 40 °C, 1 mol/L in CDCl3)",
      "url": "https://nmr.oxinst.com/assets/uploads/MagRes/App%20Notes/X-Pulse/App-Note-Structural-Elucidation-by-Benchtop-NMR-Spectroscopy-Ibuprofen.pdf",
      "covers": {
       "zh": "实测：7 组 ^{1}H 信号的位移、裂分、J 和积分（11.94 s 1H；7.46–6.83 m 4H；3.69 q 7.1 Hz 1H；2.44 d 6.7 Hz 2H；1.89 多重峰 6.7 和 6.3 Hz 1H；1.48 d 7.2 Hz 3H；0.88 d 6.3 Hz 6H）；9 个 ^{13}C 位移及各自的碳数（181.36、140.93、137.19、129.51 ×2、127.43 ×2、45.21 ×2、30.25、22.51 ×2、18.21）。COSY：4-CH_{3} 与 3-CH 相关，9-CH_{2}、10-CH、11-CH_{3} 三者之间相关（包括四键的 9/11）。HSQC-ME：δ_{C} 45.2 同时与 3.69 和 2.44 的 H 相关；CH、CH_{3} 为正相位，CH_{2} 为负相位。HMBC：3.69 的 H 与 127.4（芳 CH）和 137.2（芳季碳）相关。原子编号沿用该文。其余相关峰只出现在该文的图中，本页按结构预期画出并用 * 标明。",
       "en": "Measured: shift, multiplicity, J and integral of the seven ^{1}H signals (11.94 s 1H; 7.46–6.83 m 4H; 3.69 q 7.1 Hz 1H; 2.44 d 6.7 Hz 2H; 1.89 multiplet 6.7 and 6.3 Hz 1H; 1.48 d 7.2 Hz 3H; 0.88 d 6.3 Hz 6H); nine ^{13}C shifts with their carbon counts (181.36, 140.93, 137.19, 129.51 ×2, 127.43 ×2, 45.21 ×2, 30.25, 22.51 ×2, 18.21). COSY: 4-CH_{3} with 3-CH, and among 9-CH_{2}, 10-CH and 11-CH_{3} (including the four-bond 9/11 pair). HSQC-ME: δ_{C} 45.2 correlates with both the 3.69 and the 2.44 protons; CH and CH_{3} have positive phase, CH_{2} negative. HMBC: the 3.69 proton correlates with 127.4 (aromatic CH) and 137.2 (aromatic quaternary C). Atom numbering follows the note. Other correlations appear only in its figures; here they are drawn as expected from the structure and marked *."
      }
     }
    ],
    "molecule": {
     "atoms": [
      {
       "id": "C5",
       "x": -1,
       "y": 0,
       "label": "",
       "num": "5",
       "numAt": [
        12,
        0
       ]
      },
      {
       "id": "C6",
       "x": -0.5,
       "y": -0.866,
       "label": "",
       "num": "6",
       "numAt": [
        6,
        10.4
       ]
      },
      {
       "id": "C7",
       "x": 0.5,
       "y": -0.866,
       "label": "",
       "num": "7",
       "numAt": [
        -6,
        10.4
       ]
      },
      {
       "id": "C8",
       "x": 1,
       "y": 0,
       "label": "",
       "num": "8",
       "numAt": [
        -12,
        0
       ]
      },
      {
       "id": "C7b",
       "x": 0.5,
       "y": 0.866,
       "label": "",
       "num": "7",
       "numAt": [
        -6,
        -10.4
       ]
      },
      {
       "id": "C6b",
       "x": -0.5,
       "y": 0.866,
       "label": "",
       "num": "6",
       "numAt": [
        6,
        -10.4
       ]
      },
      {
       "id": "C3",
       "x": -2,
       "y": 0,
       "label": "CH",
       "num": "3",
       "numBelow": true
      },
      {
       "id": "C4",
       "x": -2.5,
       "y": -0.866,
       "label": "CH3",
       "num": "4"
      },
      {
       "id": "C2",
       "x": -2.5,
       "y": 0.866,
       "label": "COOH",
       "num": "2"
      },
      {
       "id": "C9",
       "x": 2,
       "y": 0,
       "label": "CH2",
       "num": "9",
       "numBelow": true
      },
      {
       "id": "C10",
       "x": 2.5,
       "y": -0.866,
       "label": "CH",
       "num": "10"
      },
      {
       "id": "C11",
       "x": 3.5,
       "y": -0.866,
       "label": "CH3",
       "num": "11"
      },
      {
       "id": "C11b",
       "x": 2,
       "y": -1.732,
       "label": "CH3",
       "num": "11",
       "numAt": [
        -22,
        0
       ]
      }
     ],
     "bonds": [
      {
       "a": "C5",
       "b": "C6",
       "order": 2
      },
      {
       "a": "C6",
       "b": "C7"
      },
      {
       "a": "C7",
       "b": "C8",
       "order": 2
      },
      {
       "a": "C8",
       "b": "C7b"
      },
      {
       "a": "C7b",
       "b": "C6b",
       "order": 2
      },
      {
       "a": "C6b",
       "b": "C5"
      },
      {
       "a": "C5",
       "b": "C3"
      },
      {
       "a": "C3",
       "b": "C4"
      },
      {
       "a": "C3",
       "b": "C2"
      },
      {
       "a": "C8",
       "b": "C9"
      },
      {
       "a": "C9",
       "b": "C10"
      },
      {
       "a": "C10",
       "b": "C11"
      },
      {
       "a": "C10",
       "b": "C11b"
      }
     ]
    },
    "spectra": [
     {
      "id": "h1",
      "kind": "1d",
      "nucleus": "1H",
      "mhz": 60,
      "range": [
       12.8,
       0.2
      ],
      "peaks": [
       {
        "id": "hOH",
        "ppm": 11.94,
        "mult": "s",
        "nH": 1,
        "lw": 4
       },
       {
        "id": "hAr",
        "ppm": 7.15,
        "est": true,
        "mult": "m",
        "nH": 4,
        "lw": 16
       },
       {
        "id": "h3",
        "ppm": 3.69,
        "mult": "q",
        "J": [
         7.1
        ],
        "nH": 1
       },
       {
        "id": "h9",
        "ppm": 2.44,
        "mult": "d",
        "J": [
         6.7
        ],
        "nH": 2
       },
       {
        "id": "h10",
        "ppm": 1.89,
        "mult": "septt",
        "J": [
         6.3,
         6.7
        ],
        "nH": 1
       },
       {
        "id": "h4",
        "ppm": 1.48,
        "mult": "d",
        "J": [
         7.2
        ],
        "nH": 3
       },
       {
        "id": "h11",
        "ppm": 0.88,
        "mult": "d",
        "J": [
         6.3
        ],
        "nH": 6
       }
      ]
     },
     {
      "id": "c13",
      "kind": "1d",
      "nucleus": "13C",
      "mhz": 15,
      "range": [
       190,
       10
      ],
      "peaks": [
       {
        "id": "c181",
        "ppm": 181.4,
        "type": "C",
        "intensity": 0.5
       },
       {
        "id": "c141",
        "ppm": 140.9,
        "type": "C",
        "intensity": 0.5
       },
       {
        "id": "c137",
        "ppm": 137.2,
        "type": "C",
        "intensity": 0.5
       },
       {
        "id": "c130",
        "ppm": 129.5,
        "type": "CH",
        "intensity": 2
       },
       {
        "id": "c127",
        "ppm": 127.4,
        "type": "CH",
        "intensity": 2
       },
       {
        "id": "cS",
        "ppm": 77,
        "est": true,
        "mult": "t",
        "J": [
         32
        ],
        "Jest": true,
        "type": "",
        "intensity": 1.6
       },
       {
        "id": "c45",
        "ppm": 45.2,
        "type": "CH + CH2",
        "intensity": 2
       },
       {
        "id": "c30",
        "ppm": 30.3,
        "type": "CH"
       },
       {
        "id": "c23",
        "ppm": 22.5,
        "type": "CH3",
        "intensity": 2
       },
       {
        "id": "c18",
        "ppm": 18.2,
        "type": "CH3"
       }
      ]
     },
     {
      "id": "cosy",
      "kind": "2d",
      "type": "COSY",
      "x": {
       "nucleus": "1H",
       "range": [
        4.2,
        0.4
       ],
       "ref": "h1"
      },
      "y": {
       "nucleus": "1H",
       "range": [
        4.2,
        0.4
       ],
       "ref": "h1"
      },
      "peaks": [
       {
        "id": "k1",
        "x": 3.69,
        "y": 1.48,
        "label": "H3/H4"
       },
       {
        "id": "k2",
        "x": 2.44,
        "y": 1.89,
        "label": "H9/H10"
       },
       {
        "id": "k3",
        "x": 1.89,
        "y": 0.88,
        "label": "H10/H11"
       },
       {
        "id": "k4",
        "x": 2.44,
        "y": 0.88,
        "label": "H9/H11 (⁴J)",
        "weak": true
       }
      ]
     },
     {
      "id": "hsqc",
      "kind": "2d",
      "type": "HSQC",
      "name": "HSQC-ME",
      "x": {
       "nucleus": "1H",
       "range": [
        8,
        0.3
       ],
       "ref": "h1"
      },
      "y": {
       "nucleus": "13C",
       "range": [
        150,
        10
       ],
       "ref": "c13"
      },
      "peaks": [
       {
        "id": "q1",
        "x": 3.69,
        "y": 45.2,
        "label": "H3/C 45.2"
       },
       {
        "id": "q2",
        "x": 2.44,
        "y": 45.2,
        "label": "H9/C 45.2"
       },
       {
        "id": "q3",
        "x": 1.89,
        "y": 30.3,
        "label": "1.89 / 30.3",
        "expected": true
       },
       {
        "id": "q4",
        "x": 1.48,
        "y": 18.2,
        "label": "1.48 / 18.2",
        "expected": true
       },
       {
        "id": "q5",
        "x": 0.88,
        "y": 22.5,
        "label": "0.88 / 22.5",
        "expected": true
       },
       {
        "id": "q6",
        "x": 7.15,
        "y": 127.4,
        "label": "ArH / 127.4",
        "expected": true
       },
       {
        "id": "q7",
        "x": 7.15,
        "y": 129.5,
        "label": "ArH / 129.5",
        "expected": true
       }
      ]
     },
     {
      "id": "hmbc",
      "kind": "2d",
      "type": "HMBC",
      "x": {
       "nucleus": "1H",
       "range": [
        8,
        0.3
       ],
       "ref": "h1"
      },
      "y": {
       "nucleus": "13C",
       "range": [
        190,
        10
       ],
       "ref": "c13"
      },
      "peaks": [
       {
        "id": "m1",
        "x": 3.69,
        "y": 127.4,
        "label": "H3/C 127.4"
       },
       {
        "id": "m2",
        "x": 3.69,
        "y": 137.2,
        "label": "H3/C 137.2"
       },
       {
        "id": "m3",
        "x": 2.44,
        "y": 140.9,
        "label": "H9/C 140.9",
        "expected": true
       },
       {
        "id": "m4",
        "x": 2.44,
        "y": 129.5,
        "label": "H9/C 129.5",
        "expected": true
       }
      ]
     }
    ],
    "steps": [
     {
      "title": {
       "zh": "不饱和度：5",
       "en": "Degrees of unsaturation: 5"
      },
      "text": {
       "zh": "C_{13}H_{18}O_{2} 的不饱和度是 5。",
       "en": "C_{13}H_{18}O_{2} has 5 degrees of unsaturation."
      },
      "board": [
       "DBE = (2×13 + 2 − 18) / 2 = 5",
       "5 = 4 (benzene ring) + 1"
      ],
      "rule": {
       "zh": "一个苯环占 4 个（3 个 C=C 加 1 个环）。",
       "en": "A benzene ring accounts for 4 (three C=C plus one ring)."
      },
      "so": {
       "zh": "假设：一个苯环，再加一个双键或环。两个 O 提示可能是 C=O。",
       "en": "Hypothesis: one benzene ring plus one more double bond or ring. Two oxygens hint at a C=O."
      }
     },
     {
      "title": {
       "zh": "清点氢谱：7 组峰，18 个 H",
       "en": "Proton inventory: 7 groups, 18 H"
      },
      "spectrum": "h1",
      "peaks": [
       "hOH",
       "hAr",
       "h3",
       "h9",
       "h10",
       "h4",
       "h11"
      ],
      "text": {
       "zh": "7 组信号，积分比 1 : 4 : 1 : 2 : 1 : 3 : 6，加起来正好 18H。",
       "en": "Seven signal groups with integrals 1 : 4 : 1 : 2 : 1 : 3 : 6, which sum to exactly 18H."
      },
      "rule": {
       "zh": "这是 60 MHz 的谱：1 ppm 只有 60 Hz，所以 7 Hz 的裂分在图上看起来比高场仪器上宽得多。",
       "en": "This is a 60 MHz spectrum: 1 ppm is only 60 Hz, so a 7 Hz splitting looks much wider on the ppm axis than at high field."
      },
      "so": {
       "zh": "所有 H 都有着落，没有多余的峰。高场一侧有四组清楚的裂分，是好入口。",
       "en": "Every H is accounted for and nothing is left over. The four clean multiplets at high field are a good way in."
      }
     },
     {
      "title": {
       "zh": "δ 11.94：最低场的那个 H",
       "en": "δ 11.94: the proton at lowest field"
      },
      "spectrum": "h1",
      "zoom": [
       12.8,
       10.6
      ],
      "peaks": [
       "hOH"
      ],
      "ask": {
       "zh": "1H 单峰出现在 δ 11.94。什么样的 H 会跑到这么低场？",
       "en": "A 1H singlet at δ 11.94. What kind of proton appears this far downfield?"
      },
      "text": {
       "zh": "δ 11.94，单峰，1H。",
       "en": "δ 11.94, singlet, 1H."
      },
      "rule": {
       "zh": "羧酸的 O–H 在 10–13 ppm；醛基 H 在 9.5–10，够不到这里。",
       "en": "A carboxylic acid O–H appears at 10–13 ppm. An aldehyde H sits at 9.5–10 and does not reach this far."
      },
      "so": {
       "zh": "片段：–COOH。它用掉两个 O，C=O 正好是第 5 个不饱和度。",
       "en": "Fragment: –COOH. It uses both oxygens, and its C=O is the fifth degree of unsaturation."
      },
      "check": {
       "zh": "还要碳谱里有一个 175–185 ppm 的羰基来配合。",
       "en": "A carbonyl at 175–185 ppm in the carbon spectrum must back this up."
      },
      "assign": {
       "hOH": "1-OH"
      }
     },
     {
      "title": {
       "zh": "入口信号：6H 双峰",
       "en": "Entry signal: the 6H doublet"
      },
      "spectrum": "h1",
      "zoom": [
       1.25,
       0.5
      ],
      "peaks": [
       "h11"
      ],
      "text": {
       "zh": "δ 0.88，双峰，J = 6.3 Hz，6H。",
       "en": "δ 0.88, doublet, J = 6.3 Hz, 6H."
      },
      "rule": {
       "zh": "6H 出现在同一个位移，是两个等价的 CH_{3}。双峰说明它们都只挨着 1 个 H。",
       "en": "Six H at one shift means two equivalent CH_{3} groups. A doublet means each has exactly one H neighbour."
      },
      "so": {
       "zh": "片段：(CH_{3})_{2}CH–，异丙基。",
       "en": "Fragment: (CH_{3})_{2}CH–, an isopropyl group."
      },
      "reveal": {
       "atoms": [
        "C11",
        "C11b",
        "C10"
       ]
      },
      "atoms": [
       "C11",
       "C11b"
      ],
      "assign": {
       "h11": "H-11"
      }
     },
     {
      "title": {
       "zh": "δ 1.89：数一数邻居",
       "en": "δ 1.89: count the neighbours"
      },
      "spectrum": "h1",
      "zoom": [
       2.42,
       1.36
      ],
      "peaks": [
       "h10"
      ],
      "ask": {
       "zh": "异丙基的 CH 已经有 6 个甲基 H 做邻居。这个 1H 的多重峰线数很多，另一侧还有几个 H？",
       "en": "The isopropyl CH already has six methyl H as neighbours. This 1H multiplet has many lines. How many more H are on its other side?"
      },
      "text": {
       "zh": "δ 1.89，1H，多重峰，含两个偶合常数：6.3 Hz 和 6.7 Hz。",
       "en": "δ 1.89, 1H, a multiplet containing two couplings: 6.3 Hz and 6.7 Hz."
      },
      "rule": {
       "zh": "偶合常数成对出现：6.3 Hz 和 0.88 的甲基双峰相同，6.7 Hz 属于另一组邻居。两个 J 接近时，n 个邻居给出大约 n + 1 条线。",
       "en": "Couplings come in pairs: 6.3 Hz matches the methyl doublet at 0.88, and 6.7 Hz belongs to another set of neighbours. With similar J values, n neighbours give about n + 1 lines."
      },
      "so": {
       "zh": "这个 CH 一侧是 6 个甲基 H，另一侧还有邻居，其 J 为 6.7 Hz。去找谁也带着 6.7 Hz。",
       "en": "This CH has six methyl H on one side and further neighbours with J = 6.7 Hz on the other. Next, find the signal that also carries 6.7 Hz."
      },
      "check": {
       "zh": "来源把这个峰记作 qt。按结构它是七重峰再裂成三重峰（6 + 2 个邻居），因为两个 J 接近，看起来像九重峰。外侧的线很弱，容易数少。",
       "en": "The source labels this signal qt. From the structure it is a septet of triplets (6 + 2 neighbours), which looks like a nonet because the two J values are close. The outer lines are weak and easily missed."
      },
      "atoms": [
       "C10"
      ],
      "assign": {
       "h10": "H-10"
      }
     },
     {
      "title": {
       "zh": "δ 2.44：把链接长一节",
       "en": "δ 2.44: extending the chain"
      },
      "spectrum": "h1",
      "zoom": [
       2.8,
       2.1
      ],
      "peaks": [
       "h9"
      ],
      "text": {
       "zh": "δ 2.44，双峰，J = 6.7 Hz，2H。",
       "en": "δ 2.44, doublet, J = 6.7 Hz, 2H."
      },
      "rule": {
       "zh": "6.7 Hz 正是 1.89 那个 CH 的另一个偶合常数。CH_{2} 只裂成双峰，说明它另一侧连的原子上没有 H。烷基 CH_{2} 在 2.3–2.7 ppm，通常连着芳环或羰基。",
       "en": "6.7 Hz is exactly the other coupling of the CH at 1.89. A CH_{2} that is only a doublet has no H on the atom at its other side. An alkyl CH_{2} at 2.3–2.7 ppm normally sits on an aromatic ring or a carbonyl."
      },
      "so": {
       "zh": "片段：(CH_{3})_{2}CH–CH_{2}–，异丁基，另一端连着一个不带 H 的 sp^{2} 碳。",
       "en": "Fragment: (CH_{3})_{2}CH–CH_{2}–, an isobutyl group whose far end sits on an sp^{2} carbon without H."
      },
      "check": {
       "zh": "是芳环还是羰基，现在还定不了。",
       "en": "Ring or carbonyl cannot be decided yet."
      },
      "reveal": {
       "atoms": [
        "C9"
       ]
      },
      "atoms": [
       "C9"
      ],
      "assign": {
       "h9": "H-9"
      }
     },
     {
      "title": {
       "zh": "第二个自旋体系：四重峰配双峰",
       "en": "A second spin system: quartet plus doublet"
      },
      "spectrum": "h1",
      "zoom": [
       4.1,
       1.2
      ],
      "peaks": [
       "h3",
       "h4"
      ],
      "text": {
       "zh": "δ 3.69，四重峰，J = 7.1 Hz，1H。δ 1.48，双峰，J = 7.2 Hz，3H。",
       "en": "δ 3.69, quartet, J = 7.1 Hz, 1H. δ 1.48, doublet, J = 7.2 Hz, 3H."
      },
      "rule": {
       "zh": "四重峰 = 3 个邻居，双峰 = 1 个邻居，J 又相同：这是 CH–CH_{3}。普通烷基 CH 在 1.5 ppm 左右，移到 3.7 说明它同时连着两个吸电子基团。",
       "en": "A quartet means 3 neighbours and a doublet 1 neighbour, with the same J: this is CH–CH_{3}. An ordinary alkyl CH is near 1.5 ppm, so 3.7 means it carries two electron-withdrawing groups."
      },
      "so": {
       "zh": "片段：CH_{3}–CH<。这个 CH 除了甲基之外，另外两根键连的原子都不带 H。",
       "en": "Fragment: CH_{3}–CH<. Apart from the methyl, the other two bonds of this CH go to atoms without H."
      },
      "check": {
       "zh": "7.1 和 7.2 Hz 是同一个偶合，差 0.1 Hz 在读数误差之内。",
       "en": "7.1 and 7.2 Hz are the same coupling. A 0.1 Hz difference is within reading error."
      },
      "reveal": {
       "atoms": [
        "C3",
        "C4"
       ]
      },
      "atoms": [
       "C3",
       "C4"
      ],
      "assign": {
       "h3": "H-3",
       "h4": "H-4"
      }
     },
     {
      "title": {
       "zh": "芳香区：60 MHz 下读不出花样",
       "en": "Aromatic region: no readable pattern at 60 MHz"
      },
      "spectrum": "h1",
      "zoom": [
       8,
       6.3
      ],
      "peaks": [
       "hAr"
      ],
      "text": {
       "zh": "δ 7.46–6.83 是一团多重峰，4H。",
       "en": "δ 7.46–6.83 is one multiplet lump, 4H."
      },
      "rule": {
       "zh": "苯环上 4 个 H 就是二取代苯。当两组 H 的位移差（以 Hz 计）和 J 差不多大时，谱是二级的，不能按 n + 1 规则读。60 MHz 下 0.2 ppm 只有 12 Hz，和邻位 J（约 8 Hz）同一量级。",
       "en": "Four ring H means a disubstituted benzene. When the shift difference in Hz is comparable to J, the spectrum is second order and the n + 1 rule fails. At 60 MHz, 0.2 ppm is only 12 Hz, the same order as an ortho J of about 8 Hz."
      },
      "so": {
       "zh": "片段：–C_{6}H_{4}–。邻、间、对哪一种，氢谱定不了，交给碳谱。",
       "en": "Fragment: –C_{6}H_{4}–. Ortho, meta or para cannot be decided from the proton spectrum. The carbon spectrum will do it."
      },
      "check": {
       "zh": "图上把这团峰画在范围的中点 7.15 附近，峰形只是示意。",
       "en": "The lump is drawn near 7.15, the midpoint of the reported range. Its shape is schematic only."
      },
      "assign": {
       "hAr": "H-6, H-7"
      }
     },
     {
      "title": {
       "zh": "碳谱：13 个碳只有 9 个峰",
       "en": "Carbon spectrum: 13 carbons, only 9 signals"
      },
      "spectrum": "c13",
      "peaks": [
       "c181",
       "c141",
       "c137",
       "c130",
       "c127"
      ],
      "ask": {
       "zh": "芳香区只有 4 个碳信号，其中 129.5 和 127.4 各是 2 个碳。邻、间、对二取代苯分别应该有几个芳碳信号？",
       "en": "The aromatic region has only 4 carbon signals, and 129.5 and 127.4 are 2 carbons each. How many aromatic carbon signals would ortho, meta and para disubstituted benzenes give?"
      },
      "text": {
       "zh": "除去 CDCl_{3} 的三重峰，共 9 个信号。181.4 是羧基；140.9 和 137.2 是不带 H 的芳碳；129.5 和 127.4 是芳 CH，各 2 个碳。",
       "en": "Apart from the CDCl_{3} triplet there are 9 signals. 181.4 is the carboxyl carbon; 140.9 and 137.2 are aromatic carbons without H; 129.5 and 127.4 are aromatic CH, 2 carbons each."
      },
      "rule": {
       "zh": "两个取代基不同时：邻位和间位二取代苯有 6 个芳碳信号，对位有一条对称轴，只有 4 个（2 个季碳，2 个各含 2 碳的 CH）。",
       "en": "With two different substituents, ortho and meta disubstituted benzenes show 6 aromatic carbon signals. Para has a symmetry axis and shows only 4: two quaternary carbons and two CH signals of 2 carbons each."
      },
      "so": {
       "zh": "苯环是对位二取代。181.4 也印证了 –COOH。",
       "en": "The ring is para-disubstituted. The 181.4 signal also confirms –COOH."
      },
      "check": {
       "zh": "来源没有给出 CDCl_{3} 三重峰的位移，图上按通常的 77.0 画，并标了 ≈。",
       "en": "The source gives no shift for the CDCl_{3} triplet. It is drawn at the usual 77.0 and marked ≈."
      },
      "assign": {
       "c181": "C-2 (COOH)",
       "cS": "CDCl3"
      }
     },
     {
      "title": {
       "zh": "HSQC-ME：δ 45.2 其实是两个碳",
       "en": "HSQC-ME: δ 45.2 is really two carbons"
      },
      "spectrum": "hsqc",
      "zoom": {
       "x": [
        4.3,
        0.4
       ],
       "y": [
        52,
        12
       ]
      },
      "peaks": [
       "q1",
       "q2"
      ],
      "ask": {
       "zh": "脂肪区只有 4 个碳信号（45.2、30.3、22.5、18.2），但我们已经找到 5 种带 H 的脂肪碳。少的那个去哪了？",
       "en": "The aliphatic region shows only 4 carbon signals (45.2, 30.3, 22.5, 18.2), yet we have found 5 kinds of protonated aliphatic carbon. Where is the missing one?"
      },
      "text": {
       "zh": "δ_{C} 45.2 这一行有两个交叉峰：一个对着 3.69 的 H，一个对着 2.44 的 H。两个峰的相位相反。",
       "en": "The row at δ_{C} 45.2 has two cross peaks: one to the proton at 3.69 and one to the protons at 2.44. The two peaks have opposite phase."
      },
      "rule": {
       "zh": "HSQC 只显示直接相连的 H–C。多重度编辑的 HSQC-ME 里，CH 和 CH_{3} 是正相位，CH_{2} 是负相位。",
       "en": "HSQC shows only directly bonded H–C pairs. In multiplicity-edited HSQC-ME, CH and CH_{3} have positive phase and CH_{2} negative."
      },
      "so": {
       "zh": "C-3（CH）和 C-9（CH_{2}）的位移碰巧都是 45.2。碳数：1 + 1 + 1 + 2 + 2 + 2 + 1 + 2 + 1 = 13，齐了。",
       "en": "C-3 (a CH) and C-9 (a CH_{2}) happen to share the shift 45.2. Carbon count: 1 + 1 + 1 + 2 + 2 + 2 + 1 + 2 + 1 = 13, complete."
      },
      "check": {
       "zh": "这是偶然重叠。一维碳谱上只看到一个稍高的峰，没有 2D 很容易漏掉一个碳。带 * 的灰色虚线圈是按归属预期的相关峰，来源只在图里给出。",
       "en": "This is accidental overlap. The 1D carbon spectrum shows just one slightly taller peak, and without 2D a carbon is easily lost. The grey dashed rings marked * are correlations expected from the assignment, given by the source only in a figure."
      },
      "assign": {
       "c45": "C-3 + C-9",
       "c30": "C-10",
       "c23": "C-11",
       "c18": "C-4"
      }
     },
     {
      "title": {
       "zh": "COSY：两个互不相通的自旋体系",
       "en": "COSY: two spin systems that do not talk to each other"
      },
      "spectrum": "cosy",
      "peaks": [
       "k1",
       "k2",
       "k3",
       "k4"
      ],
      "text": {
       "zh": "H-3 只与 H-4 相关。H-9、H-10、H-11 三者之间互相相关，其中 H-9/H-11 是隔四根键的弱峰。两组之间没有任何交叉峰。",
       "en": "H-3 correlates only with H-4. H-9, H-10 and H-11 correlate among themselves, the H-9/H-11 peak being a weak four-bond one. No cross peak links the two groups."
      },
      "rule": {
       "zh": "COSY 沿着 H–H 偶合走，读法是 对角线 → 交叉峰 → 对角线。偶合链遇到不带 H 的原子就断。",
       "en": "COSY follows H–H coupling and is read diagonal → cross peak → diagonal. A coupling chain stops at any atom without H."
      },
      "so": {
       "zh": "体系 A：CH_{3}–CH（4–3）。体系 B：CH_{2}–CH–(CH_{3})_{2}（9–10–11）。两者之间隔着不带 H 的原子，与一维谱的裂分完全一致。",
       "en": "System A: CH_{3}–CH (4–3). System B: CH_{2}–CH–(CH_{3})_{2} (9–10–11). Atoms without H separate them, in full agreement with the 1D splittings."
      },
      "arrows": [
       {
        "from": "C4",
        "to": "C3",
        "kind": "cosy"
       },
       {
        "from": "C9",
        "to": "C10",
        "kind": "cosy"
       },
       {
        "from": "C10",
        "to": "C11",
        "kind": "cosy",
        "bend": -1
       }
      ]
     },
     {
      "title": {
       "zh": "拼装：零件只有一种接法",
       "en": "Assembly: the parts fit only one way"
      },
      "ask": {
       "zh": "四个零件：CH_{3}–CH<、(CH_{3})_{2}CH–CH_{2}–、对位的 –C_{6}H_{4}–、–COOH。能拼出几种骨架？",
       "en": "Four parts: CH_{3}–CH<, (CH_{3})_{2}CH–CH_{2}–, a para –C_{6}H_{4}–, and –COOH. How many skeletons can they make?"
      },
      "text": {
       "zh": "数一数每个零件还空着几根键。",
       "en": "Count the free bonds on each part."
      },
      "board": [
       "CH3–CH<             2 free bonds",
       "(CH3)2CH–CH2–       1",
       "–C6H4– (para)       2",
       "–COOH               1"
      ],
      "rule": {
       "zh": "CH_{2} 是双峰，所以它不能连 CH-3（否则会多裂一次）；H-3 是四重峰，同理。于是 CH-3 的两根空键只能给苯环和 COOH。",
       "en": "The CH_{2} is a doublet, so it cannot be bonded to CH-3, which would split it further. H-3 is a quartet, so the same holds in reverse. The two free bonds of CH-3 can therefore only go to the ring and to COOH."
      },
      "so": {
       "zh": "只剩一种：CH-3 同时连苯环和 COOH，异丁基的 CH_{2} 连在苯环的对位。",
       "en": "Only one arrangement is left: CH-3 carries both the ring and COOH, and the isobutyl CH_{2} sits on the ring para to it."
      },
      "check": {
       "zh": "位移也对得上：2.44 是苄位 CH_{2} 的典型位置，3.69 符合同时连着芳环和羧基的 CH。下一步用 HMBC 直接验证 CH-3 连在环上。",
       "en": "The shifts agree: 2.44 is typical of a benzylic CH_{2}, and 3.69 fits a CH bearing both an aryl ring and a carboxyl group. HMBC next tests directly that CH-3 sits on the ring."
      },
      "reveal": {
       "atoms": [
        "C2",
        "C5",
        "C6",
        "C7",
        "C8",
        "C7b",
        "C6b"
       ]
      }
     },
     {
      "title": {
       "zh": "HMBC：验证连接，并分清两组芳碳",
       "en": "HMBC: confirming the link and telling the ring carbons apart"
      },
      "spectrum": "hmbc",
      "zoom": {
       "x": [
        4.4,
        2
       ],
       "y": [
        150,
        120
       ]
      },
      "peaks": [
       "m1",
       "m2"
      ],
      "text": {
       "zh": "H-3（3.69）与两个芳碳相关：137.2（不带 H）和 127.4（CH）。",
       "en": "H-3 (3.69) correlates with two aromatic carbons: 137.2 (no H) and 127.4 (a CH)."
      },
      "rule": {
       "zh": "HMBC 显示 2–3 根键的 H–C。H-3 到它所连的环碳是两根键，到这个环碳的两个邻位 CH 是三根键。",
       "en": "HMBC shows H–C pairs 2–3 bonds apart. From H-3 it is two bonds to the ring carbon it sits on and three bonds to the two CH carbons ortho to that."
      },
      "so": {
       "zh": "CH-3 确实连在环上。137.2 是 C-5，127.4 是 C-6。剩下的 140.9 就是连着 CH_{2} 的 C-8，129.5 是 C-7。",
       "en": "CH-3 is indeed on the ring. 137.2 is C-5 and 127.4 is C-6. That leaves 140.9 as C-8, the carbon bearing the CH_{2}, and 129.5 as C-7."
      },
      "check": {
       "zh": "C-8 和 C-7 是用排除法定的。直接的证据应当是 H-9 与 140.9、129.5 的 HMBC 相关（图中带 * 的灰色虚线圈），来源正文没有逐个写出。",
       "en": "C-8 and C-7 are assigned by elimination. The direct evidence would be HMBC peaks from H-9 to 140.9 and 129.5, shown as grey dashed rings marked *. The source text does not spell them out."
      },
      "atoms": [
       "C5",
       "C6",
       "C6b"
      ],
      "arrows": [
       {
        "from": "C3",
        "to": "C5",
        "kind": "hmbc"
       },
       {
        "from": "C3",
        "to": "C6",
        "kind": "hmbc",
        "bend": -1
       }
      ],
      "assign": {
       "c137": "C-5",
       "c127": "C-6",
       "c141": "C-8",
       "c130": "C-7"
      }
     },
     {
      "title": {
       "zh": "最后核对",
       "en": "Final check"
      },
      "spectrum": "h1",
      "peaks": [],
      "final": true,
      "text": {
       "zh": "核对：13 个 C、18 个 H、2 个 O 全部用上；5 个不饱和度 = 苯环 4 + C=O 1；7 组氢信号和 9 个碳信号全部归属。",
       "en": "Check: all 13 C, 18 H and 2 O are used; 5 degrees of unsaturation = 4 for the ring + 1 for C=O; all 7 proton signals and 9 carbon signals are assigned."
      },
      "so": {
       "zh": "结构确定：2-[4-(2-甲基丙基)苯基]丙酸，也就是布洛芬。",
       "en": "The structure is settled: 2-[4-(2-methylpropyl)phenyl]propanoic acid, better known as ibuprofen."
      },
      "check": {
       "zh": "C-3 是手性碳，但普通 NMR 分不出两个对映体，所以这里不能说是 R 还是 S。",
       "en": "C-3 is a stereocentre, but ordinary NMR cannot tell the two enantiomers apart, so R or S cannot be stated here."
      }
     }
    ]
   }
  }
 ]
};
