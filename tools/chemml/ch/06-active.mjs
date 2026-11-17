const r = String.raw;
export default {
  id: 'active', level: 'approx', demos: ['active'],
  title: ['主动学习：让模型自己挑要标注的数据', 'Active learning: letting the model choose what to label'],
  summary: ['贝叶斯优化要找最好的点，主动学习要的是最准的模型：在候选池里挑出“学了最有用”的那几个去做计算或实验。这一章讲不确定度采样、委员会查询和集成，在机器学习势的训练里怎样用，以及一个容易忽略的陷阱：不确定度本身靠不靠得住。', 'Bayesian optimisation looks for the best point; active learning wants the most accurate model, picking from a candidate pool the few points most useful to learn from and sending them for calculation or experiment. This chapter covers uncertainty sampling, query by committee and ensembles, how they are used to train machine-learning potentials, and an easily overlooked trap: whether the uncertainty itself can be trusted.'],
  body: [
    [r`很多化学数据贵在“标注”上：候选分子或构型可以随便生成几百万个，但每个都要算一次 DFT 或做一次实验才知道答案。**主动学习**的循环是：用已有的标注训练模型 → 在未标注的候选池里按某个准则挑出最“有价值”的一批 → 标注 → 加进训练集 → 重复。和贝叶斯优化（{{ch:bo}}）的结构一样，区别在目标：贝叶斯优化要找 $f$ 的最大值，主动学习要让模型在整个空间里都准。`,
     r`Much chemical data is expensive at the “labelling” step: millions of candidate molecules or configurations can be generated at will, but each needs a DFT calculation or an experiment for its answer. The **active learning** loop is: train on the labels so far → pick the most “valuable” batch from the unlabelled pool by some criterion → label them → add them to the training set → repeat. It has the same structure as Bayesian optimisation ({{ch:bo}}); the difference is the goal: Bayesian optimisation seeks the maximum of $f$, active learning wants the model accurate across the whole space.`],
    { h: ['挑哪些点', 'Which points to pick'] },
    { list: [
      [r`**不确定度采样**：挑模型预测方差最大的点。用高斯过程时最自然（{{ch:gp}}）。`, r`**Uncertainty sampling**: pick the points where the model’s predictive variance is largest. Most natural with Gaussian processes ({{ch:gp}}).`],
      [r`**委员会查询**（QBC）：训练几个不同的模型（不同的初始化、不同的数据子集），挑它们意见最不一致的点 [@seung1992]。神经网络没有现成的方差，常用几个独立训练的网络组成的**深度集成**来估计不确定度 [@lakshminarayanan2017]。`, r`**Query by committee** (QBC): train several different models (different initialisations, different subsets of data) and pick where they disagree most [@seung1992]. Neural networks have no built-in variance, so a **deep ensemble** of independently trained networks is a common uncertainty estimate [@lakshminarayanan2017].`],
      [r`**外推度量**：不看预测，只看候选点离训练数据有多“远”。Podryabinkin 和 Shapeev 为线性参数化的原子间势提出按 D-最优设计挑构型：一个新构型如果会让描述符矩阵的行列式明显变大，就说明它在外推 [@podryabinkin2017]。`, r`**Extrapolation measures**: ignore the prediction and look only at how “far” a candidate is from the training data. For linearly parametrised interatomic potentials, Podryabinkin and Shapeev pick configurations by D-optimal design: a new configuration that would markedly increase the determinant of the descriptor matrix is an extrapolation [@podryabinkin2017].`],
    ] },
    { demo: 'active' },
    [r`演示里有一个值得记住的结果：高斯过程的后验方差**只取决于点在哪里**，不取决于 $y$ 的值。如果模型的长度尺度不随数据调整，“挑方差最大的点”就只是把点均匀铺开（空间填充），它看不到台阶在哪里。只有当超参数随着新数据更新（发现台阶后长度变短），方差才会在难学的区域变大，策略才真正“主动”。神经网络集成没有这个性质：成员的分歧和 $y$ 有关，但它们的分歧也未必和真实误差成正比（{{ch:eval}}）。`,
     r`The demo has a result worth remembering: a Gaussian process’s posterior variance **depends only on where the points are**, not on the values of $y$. If the model’s length scale is not updated with the data, “pick the largest variance” just spreads points evenly (space filling) and never sees where the step is. Only when the hyperparameters are updated with new data (the length shortens once the step is found) does the variance grow in the hard region, and the strategy become truly “active”. Neural-network ensembles lack this property: their disagreement does depend on $y$, but it is not necessarily proportional to the real error either ({{ch:eval}}).`],
    { h: ['在机器学习势里', 'In machine-learning potentials'] },
    [r`主动学习最成功的化学应用之一是训练原子间势。分子动力学会跑到训练数据里没有的构型，模型在那里给出的力可能完全错，模拟随之崩掉。做法是边跑边看：每一步估一下不确定度（集成的分歧或外推度量），超过阈值就停下，把这个构型送去算 DFT、加进训练集、重新训练。ANI 的作者用这种方法从大量候选里挑出数据，用远少于随机采样的数据量训练出了更准的势：论文的题目就叫“少即是多” [@smith2018]。这一套怎样嵌进今天的等变势的训练，见[[nequip/#c-practice|NequIP · 训练和部署]]。`,
     r`One of active learning’s greatest chemical successes is training interatomic potentials. Molecular dynamics wanders into configurations absent from the training data, where the model’s forces can be completely wrong and the simulation blows up. The fix is to watch as you go: estimate the uncertainty at each step (ensemble disagreement or an extrapolation measure), stop when it exceeds a threshold, send that configuration for DFT, add it to the training set and retrain. ANI’s authors used this to pick data from a large pool and trained a more accurate potential from far less data than random sampling: the paper is titled “Less is more” [@smith2018]. How this fits into training today’s equivariant potentials is in [[nequip/#c-practice|NequIP · training and deployment]].`],
    { note: [r`**主动学习不总是赢。** 文献里有不少报告说，在某些数据集上主动学习只比随机采样好一点，甚至更差：不确定度估计不准时，模型会反复挑离群点或者有标注错误的点；挑出来的数据分布和要预测的分布不一样，测试误差反而上升。比较时要和随机采样在同样的预算下、多个随机种子上比。`, r`**Active learning does not always win.** Many reports find that on some datasets active learning is only slightly better than random sampling, or even worse: with poor uncertainty estimates the model keeps picking outliers or mislabelled points, and the chosen data follow a different distribution from the one to be predicted, so the test error can rise. Compare against random sampling at the same budget and over several random seeds.`], kind: 'warn' },
  ],
  points: [
    [['目标是整个空间都准', 'The goal is accuracy everywhere'], ['和贝叶斯优化结构相同，目标不同。', 'Same structure as Bayesian optimisation, different goal.'], 'approx'],
    [['GP 方差与 y 无关', 'GP variance is independent of y'], ['超参数不随数据更新时，方差采样就是空间填充。', 'Without updating the hyperparameters, variance sampling is space filling.'], 'proved'],
    [['集成估不确定度', 'Ensembles estimate uncertainty'], ['几个独立训练的网络的分歧；简单、常用，但不一定校准。', 'Disagreement among independently trained networks; simple and common, but not necessarily calibrated.'], 'tested'],
    [['训练势的主力方法', 'A workhorse for training potentials'], ['边跑分子动力学边挑构型，比随机采样省很多 DFT。', 'Picking configurations during molecular dynamics saves much DFT over random sampling.'], 'tested'],
    [['不总比随机好', 'Not always better than random'], ['不确定度不准、分布偏移时可能更差。', 'With poor uncertainty or distribution shift it can be worse.'], 'disputed'],
  ],
  math: [
    [r`x_{\text{next}} = \arg\max_{x \in \mathcal U}\ \sigma^2(x)`, ['不确定度采样：在未标注池 𝒰 里挑后验方差最大的点。', 'Uncertainty sampling: pick the point of largest posterior variance in the unlabelled pool 𝒰.']],
    [r`\sigma^2_{\text{ens}}(x) = \frac{1}{M}\sum_{m=1}^{M}\big(\hat y_m(x) - \bar y(x)\big)^2`, ['M 个模型的集成：用预测的分散当不确定度。', 'An ensemble of M models: the spread of predictions as the uncertainty.']],
    [r`\gamma(x) = \max_j \big|\big(\mathbf b(x)^\top A^{-1}\big)_j\big|`, ['外推等级（MaxVol 的写法）：b 是新构型的基函数值，A 是选定的训练构型构成的方阵；γ > 1 说明在外推。', 'The extrapolation grade (MaxVol form): b holds the basis-function values of the new configuration and A is the square matrix of selected training configurations; γ > 1 signals extrapolation.']],
  ],
  example: {
    q: [r`一个集成有 5 个神经网络，对某个构型的能量预测分别是 −10.02、−10.05、−9.98、−10.40、−10.01 eV。阈值是 0.1 eV 的标准差，要不要把它送去算 DFT？`, r`An ensemble of 5 networks predicts energies of −10.02, −10.05, −9.98, −10.40 and −10.01 eV for one configuration. With a threshold standard deviation of 0.1 eV, should it be sent for DFT?`],
    steps: [
      [r`平均值 $\bar y = -10.092$ eV。`, r`Mean $\bar y = -10.092$ eV.`],
      [r`偏差的平方：0.0052、0.0018、0.0123、0.0949、0.0068，平均 0.0242，标准差 $\approx 0.156$ eV。`, r`Squared deviations: 0.0052, 0.0018, 0.0123, 0.0949, 0.0068, mean 0.0242, standard deviation $\approx 0.156$ eV.`],
      [r`去掉第四个网络，其余四个的标准差只有约 0.025 eV。`, r`Without the fourth network, the remaining four have a standard deviation of only about 0.025 eV.`],
    ],
    a: [r`超过阈值，要送去算 DFT。但要注意，分歧几乎全来自一个成员：这可能是那个网络训练得不好，也可能是这个构型真的落在训练数据外面。集成的不确定度只说“它们意见不一”，不说谁对；实际流程里常常把阈值设在能量**每原子**或力的分歧上，并在验证集上标定过（{{ch:eval}}）。`, r`It exceeds the threshold, so yes. But note that nearly all the disagreement comes from one member: that network may simply be poorly trained, or the configuration really lies outside the training data. Ensemble uncertainty says only “they disagree”, not who is right; practical workflows usually set the threshold on per-atom energy or force disagreement, calibrated on a validation set ({{ch:eval}}).`],
  },
};
