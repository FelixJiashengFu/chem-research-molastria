const r = String.raw;
export default {
  id: 'why', level: 'tested', demos: ['lc'],
  title: ['化学里的机器学习：任务、数据和基线', 'Machine learning in chemistry: tasks, data and baselines'],
  summary: ['机器学习在化学里做的是三件事：预测、决策、生成。这一章先讲预测：它从 1964 年的 QSAR 一路演变而来，数据从哪里来、有多少、有多脏，以及为什么每个模型都必须先打过几个笨基线。演示里同一份数据跑四种模型的学习曲线，看“多一倍数据能换来多少精度”。', 'Machine learning does three jobs in chemistry: prediction, decision and generation. This chapter starts with prediction: how it grew out of the QSAR of 1964, where the data come from, how much there is and how dirty it is, and why every model must first beat a few dumb baselines. The demo runs learning curves for four models on one dataset to see how much accuracy doubling the data buys.'],
  body: [
    [r`化学家用数据建模型，比“机器学习”这个词老得多。1964 年 Hansch 和 Fujita 把一系列化合物的生物活性写成两个物理常数的线性组合：表示疏水性的 $\pi$ 和表示电子效应的 Hammett $\sigma$，用最小二乘拟合出系数，再拿去预测还没合成的同系物 [@hansch1964]。这就是**定量构效关系**（QSAR）：输入是描述分子的数（描述符），输出是性质，中间是一个从数据里拟合出来的函数。今天的机器学习只是把“描述符”换成了更丰富的表示，把“线性组合”换成了更灵活的函数，基本的形状没有变。`,
     r`Chemists built models from data long before the phrase “machine learning”. In 1964 Hansch and Fujita wrote the biological activity of a series of compounds as a linear combination of two physical constants: $\pi$ for hydrophobicity and the Hammett $\sigma$ for electronic effects, fitted the coefficients by least squares, and used them to predict homologues not yet made [@hansch1964]. This is **quantitative structure–activity relationship** modelling (QSAR): the input is numbers describing a molecule (descriptors), the output a property, and in between a function fitted to data. Today’s machine learning has replaced “descriptors” by richer representations and “linear combination” by more flexible functions, but the basic shape is unchanged.`],
    { h: ['三种任务', 'Three jobs'] },
    { list: [
      [r`**预测**：给一个分子或一个反应条件，估计一个数（溶解度、带隙、产率、毒性、原子化能）或一个类别（有没有活性）。这是监督学习：有一批“输入—答案”的数据对，学一个函数 $f: x \mapsto y$。第二到四章和第九章。`, r`**Prediction**: given a molecule or reaction conditions, estimate a number (solubility, band gap, yield, toxicity, atomisation energy) or a class (active or not). This is supervised learning: from data pairs “input → answer”, learn a function $f: x \mapsto y$. Chapters 2 to 4 and 9.`],
      [r`**决策**：预测不完美时，下一个实验或计算做什么最划算。贝叶斯优化（求最好的条件）和主动学习（求最准的模型）都是这一类，关键是模型要知道自己哪里不确定。第五、六、八章。`, r`**Decision**: with imperfect predictions, which experiment or calculation is the best next move. Bayesian optimisation (find the best conditions) and active learning (get the most accurate model) both belong here, and both need the model to know where it is uncertain. Chapters 5, 6 and 8.`],
      [r`**生成**：不在已有的候选里挑，而是直接提出新的分子、材料或合成路线。第七章。`, r`**Generation**: instead of choosing among existing candidates, propose new molecules, materials or synthetic routes. Chapter 7.`],
    ] },
    { h: ['数据：从哪里来，有多少', 'Data: where it comes from and how much'] },
    [r`化学数据有两种来源，性质很不一样。**计算数据**（DFT、耦合簇）干净、一致、量大：QM9 有 13.4 万个最多 9 个重原子的小分子在 B3LYP 下的结构和十几种性质 [@ramakrishnan2014]，是最常用的基准。**实验数据**少、贵、杂：不同实验室的测量条件不同，同一个化合物的溶解度可以差一个数量级，失败的反应常常不发表。MoleculeNet 把一批公开数据集整理成统一的基准，并且为每个数据集推荐了划分方法和评价指标 [@wu2018]。综述可以看 [@butler2018]（分子和材料）和 [@vonlilienfeld2020]（以量子化学为基础的方法）。`,
     r`Chemical data come from two sources of very different character. **Computed data** (DFT, coupled cluster) are clean, consistent and plentiful: QM9 holds B3LYP structures and a dozen properties for 134 000 small molecules with up to 9 heavy atoms [@ramakrishnan2014], and is the most used benchmark. **Experimental data** are scarce, expensive and messy: conditions differ between laboratories, the solubility of one compound can vary by an order of magnitude, and failed reactions are rarely published. MoleculeNet gathered public datasets into a uniform benchmark and recommended a split and a metric for each [@wu2018]. For reviews see [@butler2018] (molecules and materials) and [@vonlilienfeld2020] (methods built on quantum chemistry).`],
    { note: [r`**一个能说明数据有多重要的例子。** 在 QM9 上，用十几万个分子训练的模型预测很多性质，和 DFT 参考值之间的误差已经小于 B3LYP 本身和实验之间的典型误差 [@faber2017]。这句话的意思是“模型学会了 DFT”，不是“模型比实验准”：再往下就要更好的参考数据了。`, r`**An example of how much data matters.** On QM9, models trained on about a hundred thousand molecules predict many properties with errors against the DFT reference that are smaller than B3LYP’s own typical error against experiment [@faber2017]. This means “the model has learned DFT”, not “the model beats experiment”: further progress needs better reference data.`], kind: 'info' },
    { h: ['学习曲线和基线', 'Learning curves and baselines'] },
    [r`衡量一个方法最有用的一张图是**学习曲线**：测试误差对训练集大小 $N$，画在双对数坐标上。对一个合适的模型，误差大致按幂律 $\varepsilon \approx a N^{-b}$ 下降，直线的斜率 $b$ 说明“学得有多快”，截距 $a$ 说明表示有多好；碰到数据本身的噪声后曲线变平。两个方法比较时，只看一个 $N$ 上的数字不够：小数据时赢的方法，大数据时可能输。`,
     r`The most useful single plot for judging a method is the **learning curve**: test error against training-set size $N$ on log–log axes. For a suitable model the error falls roughly as a power law $\varepsilon \approx a N^{-b}$; the slope $b$ says how fast it learns and the intercept $a$ how good the representation is, and the curve flattens once it hits the noise in the data. Comparing two methods at a single $N$ is not enough: a method that wins on small data may lose on large data.`],
    { demo: 'lc' },
    [r`同样重要的是**基线**。“永远猜训练集的平均值”是最低的一条；线性回归和 $k$ 近邻是几乎不用调的第二条和第三条。一个新模型如果没有明显打过它们，就不要急着解释它学到了什么化学。QSAR 领域很早就总结出一套建模规矩：留一份从不碰的外部测试集，标出模型的适用域，和简单模型比较 [@tropsha2010]。这些规矩今天依然有效，第九章专门讲它们常怎样被违反。`,
     r`Just as important are **baselines**. “Always guess the training mean” is the lowest; linear regression and $k$-nearest neighbours, which need almost no tuning, are the second and third. If a new model does not clearly beat them, do not rush to explain what chemistry it has learned. The QSAR field long ago settled on modelling rules: keep an external test set you never touch, state the model’s applicability domain, and compare with simple models [@tropsha2010]. They still hold today, and chapter 9 is about how they are commonly broken.`],
  ],
  points: [
    [['QSAR 是源头', 'QSAR is the origin'], ['描述符 → 拟合的函数 → 性质，这个结构从 1964 年用到今天。', 'Descriptors → fitted function → property: the structure used since 1964.'], 'history'],
    [['三种任务', 'Three jobs'], ['预测、决策、生成；后两者都要求模型给出可信的不确定度。', 'Prediction, decision, generation; the latter two need trustworthy uncertainty.'], 'approx'],
    [['计算数据和实验数据', 'Computed versus experimental data'], ['计算数据干净而多，实验数据少而杂；在一种上训练好的模型不一定能迁移到另一种。', 'Computed data are clean and plentiful, experimental data scarce and messy; a model good on one does not necessarily transfer to the other.'], 'tested'],
    [['学习曲线', 'Learning curves'], ['误差通常按 N 的幂律下降；比较方法要比整条曲线。', 'Error usually falls as a power of N; compare methods along the whole curve.'], 'tested'],
    [['先打基线', 'Beat the baselines first'], ['平均值、线性回归、k 近邻；打不过就不要解释。', 'Mean, linear regression, k-NN; if you cannot beat them, do not interpret.'], 'approx'],
  ],
  math: [
    [r`\log \frac{1}{C} = a\,\pi + b\,\sigma + c`, ['Hansch 方程：C 是产生同样生物效应所需的浓度。', 'The Hansch equation: C is the concentration needed for a given biological effect.']],
    [r`\varepsilon(N) \approx a\,N^{-b}`, ['学习曲线的幂律形式；b 是双对数图上的斜率。', 'The power-law form of a learning curve; b is the slope on a log–log plot.']],
    [r`\mathrm{MAE} = \frac{1}{n}\sum_{i=1}^{n}|y_i - \hat y_i|, \qquad R^2 = 1 - \frac{\sum_i (y_i - \hat y_i)^2}{\sum_i (y_i - \bar y)^2}`, ['平均绝对误差和决定系数；R² = 0 就是“和猜平均值一样”。', 'Mean absolute error and the coefficient of determination; R² = 0 means “as good as guessing the mean”.']],
  ],
  example: {
    q: [r`一个模型在 $N = 1000$ 时 MAE 是 2.0 kcal/mol，$N = 4000$ 时是 1.0 kcal/mol。如果幂律一直成立，要达到 0.5 kcal/mol 大约需要多少数据？`, r`A model has MAE 2.0 kcal/mol at $N = 1000$ and 1.0 kcal/mol at $N = 4000$. If the power law keeps holding, roughly how much data is needed for 0.5 kcal/mol?`],
    steps: [
      [r`数据翻 4 倍，误差减半：$4^{-b} = 1/2$，所以 $b = \tfrac12$。`, r`Four times the data halves the error: $4^{-b} = 1/2$, so $b = \tfrac12$.`],
      [r`再减半一次又要 4 倍数据：$N = 16\,000$。`, r`Halving once more needs four times the data again: $N = 16\,000$.`],
      [r`检查：$2.0 \times (16\,000/1000)^{-1/2} = 2.0/4 = 0.5$。`, r`Check: $2.0 \times (16\,000/1000)^{-1/2} = 2.0/4 = 0.5$.`],
    ],
    a: [r`约 16 000 个数据点。斜率 $\tfrac12$ 意味着每多一位精度要 100 倍的数据，这就是为什么好的表示（让截距更低）比多收数据常常更划算。前提是参考数据本身的误差小于 0.5 kcal/mol，否则曲线会先变平。`, r`About 16 000 points. A slope of $\tfrac12$ means each extra digit of accuracy costs 100 times the data, which is why a better representation (lowering the intercept) often pays more than collecting more data. This assumes the reference data are themselves accurate to better than 0.5 kcal/mol; otherwise the curve flattens first.`],
  },
};
