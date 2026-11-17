const r = String.raw;
export default {
  id: 'frontier', level: 'frontier', demos: [],
  title: ['前沿和还没解决的问题', 'Frontiers and open problems'],
  summary: ['这一章不讲新方法，而是看几件引起很大关注的工作：蛋白质结构预测、大规模材料发现、合成规划和反应预测、语言模型代理，以及围绕它们的争论。共同的问题是：模型说“发现了”，要靠什么核对？', 'This chapter introduces no new method; it looks at a few high-profile pieces of work: protein structure prediction, large-scale materials discovery, synthesis planning and reaction prediction, language-model agents, and the disputes around them. The common question: when a model says “discovered”, what checks it?'],
  body: [
    { h: ['做成了的', 'What has worked'] },
    { list: [
      [r`**蛋白质结构预测。** AlphaFold 2 在 CASP14 的盲测里对多数目标给出了接近实验精度的结构 [@jumper2021]。它成功的条件值得注意：有几十年积累的、质量统一的实验结构数据库（PDB），有一个公认、严格、盲测的评估（CASP），模型里也写进了很多关于序列进化和几何的结构。化学的大多数问题这三条都不齐。`, r`**Protein structure prediction.** AlphaFold 2 gave structures close to experimental accuracy for most targets in the CASP14 blind test [@jumper2021]. The conditions for its success are worth noting: decades of uniformly curated experimental structures (the PDB), an accepted, strict, blind evaluation (CASP), and much built-in structure about sequence evolution and geometry. Most chemistry problems lack all three.`],
      [r`**合成规划和反应预测。** Segler 等人用蒙特卡洛树搜索加上从反应数据库学到的神经网络做逆合成规划，在双盲测试里化学家对它给出的路线和文献路线的偏好差不多 [@segler2018retro]。Molecular Transformer 把反应预测当成“从反应物的 SMILES 翻译成产物的 SMILES”，在标准数据集上的 top-1 准确率约 90%，还能给出可用的置信度 [@schwaller2019]。这类模型今天已经进了不少公司的日常工具链；但它们学到的是数据库里**写下来的**反应，失败的反应很少被记录。`, r`**Synthesis planning and reaction prediction.** Segler et al. combined Monte Carlo tree search with neural networks learnt from reaction databases for retrosynthesis, and in double-blind tests chemists preferred its routes about as often as literature routes [@segler2018retro]. The Molecular Transformer treats reaction prediction as “translating reactant SMILES into product SMILES”, reaching about 90 % top-1 accuracy on a standard dataset with usable confidence scores [@schwaller2019]. Such models are now in many companies’ everyday toolchains; but they learn the reactions that were **written down**, and failed reactions are rarely recorded.`],
    ] },
    { h: ['有争论的', 'What is disputed'] },
    [r`2023 年 GNoME 报告用图神经网络加主动学习筛出约 220 万个“稳定”晶体结构，其中约 38 万个在它算出的凸包上 [@merchant2023]；同一期的 A-Lab 报告自主合成了 41 个新化合物 [@szymanski2023]。之后有研究者指出：很多“新”结构是已知结构的有序化变体（真实材料里那些位置是无序的），A-Lab 用自动 X 射线衍射精修判断产物，有些判断经不起人工复核；Leeman 等人系统地讨论了这些问题，认为“新”和“合成成功”的标准都要更严格 [@leeman2024]。争论的焦点不在机器学习本身，而在“发现”的定义和核对：计算上稳定不等于能合成，衍射图样像不等于是那个结构。`,
     r`In 2023 GNoME reported screening about 2.2 million “stable” crystal structures with graph neural networks and active learning, about 380 000 of them on its computed convex hull [@merchant2023]; in the same issue the A-Lab reported autonomously synthesising 41 new compounds [@szymanski2023]. Researchers then pointed out that many “new” structures are ordered variants of known structures (those sites are disordered in real materials), and that some of the A-Lab’s product assignments, made by automated X-ray diffraction refinement, did not survive manual re-examination; Leeman et al. discussed these issues systematically and argued that the criteria for both “new” and “successfully synthesised” need to be stricter [@leeman2024]. The dispute is not about the machine learning as such, but about the definition and checking of “discovery”: computationally stable is not the same as synthesisable, and a diffraction pattern that looks right is not the same as the structure.`],
    { h: ['语言模型代理', 'Language-model agents'] },
    [r`Coscientist [@boiko2023] 和 ChemCrow [@bran2024] 展示了大语言模型可以把自然语言的请求拆成步骤、调用搜索和计算工具、生成机器人能执行的指令。它们最大的问题是：语言模型会很自信地给出错误的信息，而在实验室里一个错误的步骤可能带来危险；ChemCrow 的作者也报告，让语言模型给自己的答案打分时，它分不清对错，需要化学家评审。目前比较稳妥的看法是：代理擅长把已有工具串起来、减少重复劳动，但每一步的结论仍需要能独立检查的依据。`,
     r`Coscientist [@boiko2023] and ChemCrow [@bran2024] showed that large language models can break a natural-language request into steps, call search and calculation tools and produce instructions a robot can run. Their biggest problem is that language models state wrong information with confidence, and in a laboratory a wrong step can be dangerous; ChemCrow’s authors also report that when a language model grades its own answers it cannot tell right from wrong, so expert chemists had to judge. The safer view today is that agents are good at chaining existing tools and cutting repetitive work, but every conclusion still needs independently checkable grounds.`],
    { h: ['还没解决的', 'What is still open'] },
    { list: [
      [r`**分布外的预测。** 几乎所有模型在训练数据附近内插得好、外推得差（{{ch:eval}}）。怎样知道一个新分子是否“在外面”、在外面时给多大的误差棒，还没有通用的答案。`, r`**Out-of-distribution prediction.** Almost every model interpolates well near its training data and extrapolates badly ({{ch:eval}}). How to know whether a new molecule is “outside”, and what error bar to give it there, has no general answer.`],
      [r`**负面结果和数据质量。** 失败的实验很少发表，不同实验室的测量条件不一致；模型的上限常常是数据的上限，而不是方法的上限 [@butler2018]。`, r`**Negative results and data quality.** Failed experiments are rarely published, and measurement conditions differ between laboratories; a model’s ceiling is often the data’s ceiling, not the method’s [@butler2018].`],
      [r`**生成的东西能不能做出来。** 生成模型给出的分子很多难以合成（{{ch:gen}}）；把可合成性和真实的合成路线放进生成的目标里，是活跃的研究方向。`, r`**Can generated things be made?** Many molecules from generative models are hard to synthesise ({{ch:gen}}); putting synthesisability and real routes into the generative objective is an active area.`],
      [r`**评估的标准化。** 像 CASP 那样的盲测在化学的大多数子领域还没有；自驱实验室的“加速了多少倍”也缺少统一的比较方法 [@abolhasani2023]。`, r`**Standardised evaluation.** CASP-style blind tests do not exist in most areas of chemistry; claims that a self-driving lab “accelerated discovery by so many times” lack a common basis for comparison [@abolhasani2023].`],
    ] },
    { note: [r`**这本站里的其他地方。** 机器学习原子间势（等变网络、训练和部署）在 [[nequip/|NequIP]]；扩散模型和优化的数学在[[ai-math/|前沿 AI 数学]]；想动手试几个计算程序，见[[code/|开源代码台]]。`, r`**Elsewhere on this site.** Machine-learning interatomic potentials (equivariant networks, training and deployment) are in [[nequip/|NequIP]]; the mathematics of diffusion models and optimisation is in [[ai-math/|Frontier AI Maths]]; to try a few computational programs yourself, see the [[code/|Code Desk]].`], kind: 'info' },
  ],
  points: [
    [['AlphaFold 的条件', 'AlphaFold’s conditions'], ['统一的大数据库、严格的盲测、写进模型的结构；化学多数问题三条不齐。', 'A large uniform database, strict blind tests and built-in structure; most chemistry problems lack all three.'], 'history'],
    [['反应预测已在用', 'Reaction prediction is in use'], ['逆合成规划和 Molecular Transformer 已进了日常工具链。', 'Retrosynthesis planning and the Molecular Transformer are in everyday toolchains.'], 'tested'],
    [['“发现”需要核对', '“Discoveries” need checking'], ['GNoME 和 A-Lab 的“新”和“合成成功”受到质疑。', 'The “new” and “synthesised” of GNoME and the A-Lab have been questioned.'], 'disputed'],
    [['代理会自信地出错', 'Agents err confidently'], ['串联工具很有用，结论仍需独立依据。', 'Chaining tools is useful; conclusions still need independent grounds.'], 'frontier'],
    [['分布外预测', 'Out-of-distribution prediction'], ['怎样知道“在外面”、给多大的误差棒，仍没有通用答案。', 'How to know a point is “outside” and what error bar to give remains open.'], 'open'],
  ],
  math: [
    [r`\Delta E_{\text{hull}}(x) = E(x) - E_{\text{hull}}\big(\text{composition}(x)\big)`, ['离凸包的能量：0 表示热力学上稳定（在所用的计算方法下）；它不说能不能合成。', 'Energy above the hull: 0 means thermodynamically stable (at the level of theory used); it says nothing about synthesisability.']],
    [r`\text{top-}k = \frac{1}{N}\sum_{i=1}^{N}\mathbf 1\big[\,y_i \in \{\hat y_i^{(1)}, \dots, \hat y_i^{(k)}\}\,\big]`, ['反应预测的 top-k 准确率：真产物在模型给出的前 k 个候选里的比例。', 'Top-k accuracy in reaction prediction: the fraction of cases whose true product is among the model’s first k candidates.']],
    [r`\text{enrichment} = \frac{\text{hits}_{\text{selected}} / N_{\text{selected}}}{\text{hits}_{\text{all}} / N_{\text{all}}}`, ['富集因子：模型挑出来的里面命中率是随机挑的几倍；虚拟筛选常用的指标。', 'Enrichment factor: how many times the hit rate among the model’s picks exceeds that of random picks; a common virtual-screening metric.']],
  ],
  example: {
    q: [r`一个模型从 100 万个候选材料里挑出 1000 个“预计稳定”的，送去用 DFT 复核，其中 300 个确实在凸包上。全部候选里稳定的比例估计是 0.5%。富集因子是多少？这能说明模型“发现了 300 个新材料”吗？`, r`A model picks 1000 “predicted stable” materials from a million candidates; DFT re-checks show 300 really are on the hull. About 0.5 % of all candidates are thought to be stable. What is the enrichment factor? Does this show the model “discovered 300 new materials”?`],
    steps: [
      [r`挑出的命中率 $300 / 1000 = 30\%$；随机挑的命中率 $0.5\%$。`, r`Hit rate among picks: $300 / 1000 = 30\%$; for random picks, $0.5\%$.`],
      [r`富集因子 $= 30 / 0.5 = 60$：比随机筛选好 60 倍，作为筛选工具很有用。`, r`Enrichment factor $= 30 / 0.5 = 60$: sixty times better than random screening, a very useful filter.`],
      [r`但“在 DFT 凸包上”只说明在这个计算方法下热力学稳定。要说“新材料”，还要核对：它是不是已知结构的变体，有没有无序，能不能在实际条件下合成，合成出来的产物是不是真的是它。`, r`But “on the DFT hull” only means thermodynamically stable at that level of theory. To call it a “new material” one must still check whether it is a variant of a known structure, whether it is disordered, whether it can be made under real conditions, and whether what is made really is it.`],
    ],
    a: [r`富集因子 60，是一个很好的筛选结果；但它说明的是“值得去试的候选”，不是“发现”。从候选到材料，每一步都需要独立的核对，这正是 GNoME 和 A-Lab 争论的内容。`, r`An enrichment factor of 60 is an excellent screening result; but what it gives is “candidates worth trying”, not “discoveries”. Every step from candidate to material needs independent checking, which is exactly what the GNoME and A-Lab dispute is about.`],
  },
};
