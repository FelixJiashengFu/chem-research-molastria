/* 期刊发表：从研究到发表的指导（中文 zh 与英文 en 两版，章节 id 一一对应）。
   正文是 MolAstria 自己写的经验总结；各期刊、出版社的具体规定一律链到官方页面，以官方页面为准。核对日期见 checked。 */
window.MOLASTRIA_JOURNALS_GUIDE = {
  checked: '2026-11-06',
  zh: [
    { id: 'g-map', title: '总览：一篇计算化学论文的完整路线', html: `
<p>一篇论文从想法到上线，大致要经过下面几步。每一步都有能交出来的东西，做完一步就把它存好，后面写作和回复审稿意见时会反复用到。</p>
<ol>
<li><b>选题与文献调研</b>：写下要回答的问题、它为什么重要、为什么现在能用计算回答。交付物：一页研究计划和一张文献对照表。</li>
<li><b>方法选择与基准</b>：在小体系上比较几种方法，选定精度够用、算得动的方案。交付物：基准表（误差、耗时）。</li>
<li><b>生产计算</b>：按固定流程批量计算，所有输入、输出和脚本放进版本管理。交付物：完整的原始数据和处理脚本。</li>
<li><b>整理数据与图表</b>：从原始数据自动生成表格和图，结构文件导出为通用格式。交付物：图表、SI 草稿、数据包。</li>
<li><b>写作</b>：先定图表和结论，再写结果、方法、引言，最后写摘要和题目。</li>
<li><b>选刊与投稿</b>：按范围、文章类型、篇幅、开放获取费用和数据要求选 2–3 个候选期刊，按第一志愿的作者指南准备文件。</li>
<li><b>审稿与修改</b>：逐条回复，补算，必要时转投。</li>
<li><b>接收以后</b>：校样、版权或许可协议、公开数据和代码、更新预印本链接。</li>
</ol>
<div class="jr-note">本页上半部分的期刊目录只写在期刊或出版社官网能核实的内容，每条都附出处和核对日期。下面各章是通用做法；遇到具体规定（字数、模板、数据要求、费用），一律以目标期刊的作者指南为准。</div>` },

    { id: 'g-topic', title: '选题与文献调研', html: `
<h3>先问四个问题</h3>
<ul>
<li><b>新不新</b>：同样的体系、同样的性质，有没有人用同等或更高水平的方法算过？</li>
<li><b>重不重要</b>：结果会改变谁的判断？实验组、方法开发者还是做材料设计的人？</li>
<li><b>计算能不能回答</b>：需要的精度（例如反应能垒误差在 1 kcal/mol 量级还是 5 kcal/mol 量级）现有方法能不能达到？</li>
<li><b>算不算得动</b>：体系大小、构象数、采样长度和你的机时是否匹配？</li>
</ul>
<h3>文献调研的做法</h3>
<ol>
<li>中英文各列一组关键词（体系名、性质、方法名、常见缩写），在 Web of Science、Scopus、Google Scholar 检索；中文工作再查中国知网。</li>
<li>先读近几年的综述（例如 Chem. Rev.、WIREs Comput. Mol. Sci.、Acc. Chem. Res.），再顺着引用往前、往后追。</li>
<li>预印本平台（ChemRxiv、arXiv physics.chem-ph）往往比期刊早几个月，可以用 <a href="../radar/index.html">MolAstria 预印本雷达</a>定期看。</li>
<li>建一张文献对照表：体系、方法与基组、计算的性质、与实验或高精度参考的误差、数据和代码是否公开。这张表后面会直接用在引言和讨论里。</li>
<li>查有没有可以拿来验证的实验数据或高精度参考数据（基准数据集、晶体结构、光谱）。没有验证手段的预测，审稿时很难通过。</li>
</ol>
<h3>早点看目标期刊的范围</h3>
<p>不少期刊明确写了不收的类型，例如 JCTC 不收用成熟方法计算单一类体系的直接应用，TCA 把常规 QSAR、对接和分子动力学应用视为范围外，Computational Materials Science 会直接拒掉用标准力场、只报告常规平均量的分子动力学。选题阶段就对照这些条款，可以避免做完才发现没地方投。各刊原话见上面期刊目录里的“收稿范围与偏好”。</p>
<h3>给自己定两个目标</h3>
<p>“最小可发表结果”是什么，“理想结果”又是什么。前者保证项目不会落空，后者决定能冲多高的期刊。</p>` },

    { id: 'g-methods', title: '方法选择与基准', html: `
<p>审稿人最常问的是“为什么用这个方法、它在你的体系上可靠吗”。答案要来自你自己的基准测试，而不是“文献里常用”。</p>
<h3>密度泛函</h3>
<ul>
<li>先查大规模基准的结论，例如 GMTKN55 数据库对上百种泛函的评测（<a href="https://doi.org/10.1039/C7CP04913G">Goerigk 等, PCCP 2017</a>），以及面向日常分子计算的推荐流程（<a href="https://doi.org/10.1002/anie.202205735">Bursch 等, Angew. Chem. Int. Ed. 2022</a>）。</li>
<li>不要不假思索地沿用多年前的“默认组合”；在你的体系上用几个代表性泛函（不同 Jacob 阶梯层级）对比，再选定。</li>
<li>性质不同，最合适的泛函也不同：热化学、能垒、非共价作用、激发态、过渡金属自旋态要分别考虑。</li>
</ul>
<h3>色散校正</h3>
<p>大多数泛函需要加色散校正。写清楚用的是哪一版：D3 零阻尼还是 BJ 阻尼（<a href="https://doi.org/10.1063/1.3382344">D3</a>、<a href="https://doi.org/10.1002/jcc.21759">BJ 阻尼</a>），还是 <a href="https://doi.org/10.1063/1.5090222">D4</a>。只写“加了 D3”不够。</p>
<h3>基组</h3>
<ul>
<li>常用 def2 系列（<a href="https://doi.org/10.1039/b508541a">Weigend 与 Ahlrichs, PCCP 2005</a>）或 Dunning 相关一致基组；基组数据可以从 <a href="https://www.basissetexchange.org/">Basis Set Exchange</a> 下载并注明版本。</li>
<li>做基组收敛测试：至少在代表性结构上比较两档基组，看关键能量差变化多少。</li>
<li>弱相互作用要考虑基组重叠误差（counterpoise 校正或足够大的基组）；重元素写明用的赝势。</li>
</ul>
<h3>溶剂</h3>
<ul>
<li>隐式溶剂模型（如 <a href="https://doi.org/10.1021/jp810292n">SMD</a>、PCM 类）适合体相溶剂效应；涉及特定氢键或配位的，考虑加几个显式溶剂分子。</li>
<li>计算溶液中的自由能时注意标准态：气相 1 atm 与溶液 1 mol/L 之间的换算，298 K 下约 1.89 kcal/mol，常被漏掉。</li>
<li>写清楚溶剂模型是只做单点还是也用于结构优化。</li>
</ul>
<h3>构象搜索</h3>
<p>柔性分子的能量和性质对构象很敏感。用系统搜索或元动力学类工具（例如 <a href="https://doi.org/10.1063/5.0197592">CREST</a>）找低能构象，再用更高水平重新优化；报告搜索方法、能量窗口、保留的构象数，以及是否做了玻尔兹曼加权。</p>
<h3>收敛与频率检查</h3>
<ul>
<li>写明 SCF 和几何优化的收敛判据、积分格点。</li>
<li>每个优化结构都要算频率：极小点没有虚频，过渡态有且只有一个虚频，并用 IRC 确认它连接的反应物和产物。</li>
<li>热化学要写温度、压力，以及低频振动怎么处理（例如准刚性转子–谐振子近似）。</li>
<li>开壳层体系检查自旋污染（⟨S²⟩），必要时做波函数稳定性分析；怀疑有强多参考特征时报告诊断量，并考虑多参考方法。</li>
</ul>
<h3>高精度参考与周期体系</h3>
<p>需要参考值时，可在小模型上用耦合簇（如 CCSD(T) 或其局域近似）并做基组外推，写清阈值。周期体系要报告平面波截断能、k 点网格、展宽方法和赝势，并给出收敛测试。</p>
<h3>机器学习势的适用范围</h3>
<ul>
<li>先看模型训练数据：用的是哪一级 DFT、覆盖哪些元素、电荷和自旋态、结构类型（分子、表面、体相）。超出训练分布的预测不可靠。</li>
<li>在你的体系上抽一批结构，用 DFT 单点核对能量和受力；分子动力学检查能量守恒和长时间稳定性。</li>
<li>带电荷或开壳层的性质（电离能、电子亲和能、自旋态能隙）要单独验证，不同模型差别可能很大。</li>
<li>写清模型名称、版本或权重文件、使用的软件包版本。可以先用 <a href="../models/index.html">MolAstria 模型接口</a>快速比较几个模型，但重要结论用 DFT 或实验核对。</li>
<li>机器学习本身的报告规范可参考 <a href="https://doi.org/10.1038/s41557-021-00716-z">Artrith 等, Nat. Chem. 2021</a>。</li>
</ul>
<h3>基准测试怎么做</h3>
<p>选一个小而有代表性的验证集，参考值来自实验或更高水平计算；报告平均绝对误差、最大误差和耗时；不要在同一批数据上既调参又评测。把基准结果放进 SI，正文用一两句话说明选择理由。</p>` },

    { id: 'g-repro', title: '可复现性：软件、输入、坐标与数据存放', html: `
<p>计算工作的可复现性要求越来越具体。比如 ACS 的 JPC 系列要求写明程序和版本、参数改动和收敛判据，并把结构、能量、频率放到可在线获取的地方；ChemPhysChem 和 Angewandte Chemie 要求给出所有驻点的坐标和绝对能量；Digital Discovery 要求审稿期间就能访问代码和数据。各刊原文见期刊目录的“数据、代码与坐标”一栏。</p>
<h3>要保存并公开的东西</h3>
<ul>
<li><b>软件</b>：名称、准确版本号，必要时写编译选项或补丁；自编代码给出仓库地址和存档 DOI。</li>
<li><b>输入</b>：每类计算至少一个完整输入文件；批量流程附上生成输入的脚本。</li>
<li><b>坐标</b>：所有报告结构的笛卡尔坐标（XYZ 等机器可读格式），注明电荷、自旋多重度和对应的能量。</li>
<li><b>能量与热化学</b>：电子能（Hartree）、零点能、热校正、自由能，单位写清。</li>
<li><b>分子动力学</b>：力场及版本、参数文件、体系组成、系综、恒温恒压方法、平衡和采样时长、随机种子。</li>
<li><b>机器学习</b>：训练、验证、测试的划分方式和数据，超参数，训练代码，模型权重。</li>
</ul>
<h3>FAIR 原则</h3>
<p>数据要可查找、可访问、可互操作、可重用（<a href="https://doi.org/10.1038/sdata.2016.18">Wilkinson 等, Sci. Data 2016</a>；<a href="https://www.gofair.foundation/fair-principles">GO FAIR 的说明</a>）。实际做法是：放在有持久标识符（DOI）的知识库，附说明文件（README），用开放格式，并写明许可。</p>
<h3>放在哪里</h3>
<ul>
<li><a href="https://zenodo.org/">Zenodo</a>：通用知识库，任何文件都能存，发 DOI，支持版本。</li>
<li><a href="https://nomad-lab.eu/">NOMAD</a>：面向材料和计算化学的原始计算数据，能解析很多程序的输出。</li>
<li><a href="https://www.iochem-bd.org/">ioChem-BD</a>：计算化学结果的管理和发布平台，适合把一篇论文的全部计算整理成集合公开。</li>
<li><a href="https://www.materialscloud.org/">Materials Cloud</a>：材料模拟的数据存档与工作流记录。</li>
<li>实验晶体结构存 <a href="https://www.ccdc.cam.ac.uk/">CCDC</a>；其他领域的知识库可在 <a href="https://www.re3data.org/">re3data</a> 和 <a href="https://fairsharing.org/">FAIRsharing</a> 查。</li>
</ul>
<h3>许可与引用</h3>
<p>数据常用 CC BY 4.0 或 CC0，代码用 OSI 认可的开源许可（如 MIT、BSD、GPL）。在参考文献里像引论文一样引用数据集和软件的 DOI。审稿期间不想公开的，可以给审稿人私密链接，具体看期刊是否允许（例如 Scientific Data 允许投稿时用临时可匿名下载的链接）。</p>
<h3>数据可用性声明怎么写</h3>
<p>写清三件事：数据在哪里（知识库名称和 DOI）、包括什么、有什么限制。没有公开的说明原因和获取方式。很多期刊在投稿时就要求这段声明（ACS 第 2 级政策的期刊、Nature Portfolio、RSC、Wiley 的多数期刊、Physical Review 系列等）。</p>` },

    { id: 'g-details', title: '计算细节怎么写：一份可以逐项核对的清单', html: `
<p>“Computational Details”这一节要让同行不看你的输入文件也能复现主要结果。投稿前对照下面的清单逐项打勾。</p>
<h3>通用</h3>
<ul class="jr-check">
<li>所有程序的名称、版本，并引用程序本身和方法的原始文献</li>
<li>每一类计算用的方法、泛函、色散校正版本、基组（及赝势）</li>
<li>结构优化的收敛判据、积分格点、SCF 收敛阈值</li>
<li>溶剂模型、溶剂名称，以及溶剂只用于单点还是也用于优化</li>
<li>频率计算：确认极小点无虚频、过渡态一个虚频；IRC 是否做过</li>
<li>热化学：温度、压力、标准态换算、低频振动处理方法</li>
<li>构象搜索方法、能量窗口、保留数目、是否玻尔兹曼加权</li>
<li>开壳层：自旋多重度、⟨S²⟩、稳定性分析，必要时多参考诊断</li>
<li>能量的定义（ΔE、ΔH 还是 ΔG）和单位，在图表标题里也写清</li>
<li>所有结构的坐标和能量在 SI 中，并有机器可读文件</li>
</ul>
<h3>周期体系</h3>
<ul class="jr-check">
<li>赝势或 PAW 数据集、截断能、k 点网格、展宽方法和宽度</li>
<li>晶胞是否优化，固定了哪些原子，表面模型的层数和真空层厚度</li>
<li>截断能和 k 点的收敛测试结果</li>
</ul>
<h3>分子动力学与自由能</h3>
<ul class="jr-check">
<li>力场名称和版本，自定义参数的来源和文件</li>
<li>体系大小、组成、边界条件、长程静电处理</li>
<li>系综、恒温器和恒压器、步长、约束算法</li>
<li>平衡时长、采样时长、重复次数和随机种子，误差怎么估计</li>
</ul>
<h3>机器学习</h3>
<ul class="jr-check">
<li>数据来源和参考计算水平，数据划分方法（避免泄漏）</li>
<li>模型结构、超参数和选择方法，训练代码和权重</li>
<li>测试集上的误差，与基线方法的对比，适用范围的说明</li>
</ul>
<h3>一个写法示例（占位内容请换成你自己的）</h3>
<pre>结构优化和频率计算使用 &lt;程序&gt; &lt;版本&gt;，方法为 &lt;泛函&gt;-&lt;色散校正&gt;/&lt;基组&gt;，
积分格点 &lt;格点&gt;，优化收敛判据为 &lt;判据&gt;。频率分析确认所有极小点没有虚频，
每个过渡态只有一个虚频，并用 IRC 计算确认其连接的极小点。单点能在
&lt;更高水平方法&gt;/&lt;基组&gt; 下计算，溶剂效应用 &lt;溶剂模型&gt;（&lt;溶剂&gt;）。
吉布斯自由能在 298.15 K、1 mol/L 标准态下给出，低频振动用 &lt;处理方法&gt;。
构象由 &lt;工具&gt; 搜索，保留 &lt;能量窗口&gt; 内的构象并重新优化。
全部结构的坐标和能量见 SI，原始输入输出存于 &lt;知识库&gt;（DOI: &lt;…&gt;）。</pre>
<p>不同期刊对这一节的位置和名称要求不同（有的放在正文末尾的 Methods，有的放在 SI），以作者指南为准。IUPAC 对计算结果报告也有两份规范，ACS 的 JPC 系列在作者指南里引用了它们（<a href="https://doi.org/10.1351/pac199870102047">Pure Appl. Chem. 1998, 70, 2047</a>；<a href="https://doi.org/10.1351/pac199870041015">Pure Appl. Chem. 1998, 70, 1015</a>）。</p>` },

    { id: 'g-figures', title: '图表', html: `
<ul>
<li><b>一张图只讲一件事</b>。先想好读者看完要记住哪个结论，再决定画什么。</li>
<li><b>能量图</b>：写明参考零点、画的是 ΔE 还是 ΔG、温度和计算水平；数值保留合理位数（通常 0.1 kcal/mol 或 0.01 eV 已足够，不要暗示超过方法精度的准确性）。</li>
<li><b>结构图</b>：统一原子配色和视角，标出关键键长或角度，过渡态标出成键和断键距离；必要时附原子编号以便和 SI 对应。</li>
<li><b>颜色</b>：选色盲友好的配色，不只靠颜色区分曲线（同时用线型或标记）；深色背景和浅色背景都检查一遍。</li>
<li><b>格式</b>：曲线和示意图用矢量格式；位图按期刊要求的分辨率导出。各刊有自己的尺寸和分辨率规定，例如 ACS 作者指南附录 2 专门讲图形准备。</li>
<li><b>表格</b>：列出单位、误差统计和参考值来源；同一个量在全文用同一单位。</li>
<li><b>目录图（TOC / 图形摘要）</b>：很多期刊要求，尺寸和文字长度各不相同，按作者指南做。</li>
<li><b>可追溯</b>：图由脚本从原始数据生成，脚本和数据一起存档；修改图像要如实说明，不能删除或添加数据点。</li>
</ul>` },

    { id: 'g-writing', title: '论文结构与写作', html: `
<h3>推荐的写作顺序</h3>
<p>图表 → 结果与讨论 → 计算方法 → 引言 → 结论 → 摘要 → 题目。先把证据摆好，再写怎么引出问题，最后浓缩成摘要和题目。</p>
<h3>各部分要点</h3>
<ul>
<li><b>题目</b>：具体、有信息量，包含体系、方法和主要发现中的关键词。避免空洞的修饰词；有的期刊明确禁止某些词，例如 JACS 不允许题目里出现“First”“Novel”或系列编号。</li>
<li><b>摘要</b>：问题、做法、最重要的一两个数字、意义。字数上限各刊不同（JCTC 的 Letter 只有 75 词，JACS 约 250 词），提前确认。</li>
<li><b>引言</b>：从大问题收窄到具体空白，说明前人做到哪里、还缺什么，最后一段写清本文的贡献。引用要全面，不能只引自己的工作。</li>
<li><b>方法</b>：按上一章的清单写，细节多的放 SI，但正文要让读者知道关键选择和理由。</li>
<li><b>结果与讨论</b>：每段开头先说结论，再给证据；与实验或高精度参考比较；主动讨论误差来源和方法局限。</li>
<li><b>结论</b>：不要重复摘要，写这项工作改变了什么、还有哪些问题没解决。</li>
<li><b>SI</b>：开头放目录，按正文顺序编号（表 S1、图 S1……），坐标和能量放在易于复制的格式里，并按期刊要求在正文里列出每个 SI 文件的内容。</li>
</ul>
<h3>语言</h3>
<ul>
<li>一句话只说一件事；术语和缩写第一次出现时给出全称，全文保持一致。</li>
<li>结论的强度和证据相符，避免“证明”“首次”这类难以支撑的说法。</li>
<li>数值带单位和不确定度；有效数字和方法精度一致。</li>
<li>英文不熟练时，先用简单句写准确，再请同行或语言编辑润色；用 AI 工具辅助写作要遵守期刊政策并按要求披露（见“学术伦理”一章）。</li>
</ul>` },

    { id: 'g-choose', title: '怎么选刊', html: `
<h3>按顺序核对</h3>
<ol>
<li><b>范围</b>：读期刊的 Aims &amp; Scope 和最近几期目录，看有没有同类工作；特别注意“明确不收”的条款（见期刊目录的“收稿范围与偏好”）。</li>
<li><b>文章类型和篇幅</b>：你的结果更适合快报还是完整论文？字数、图表数和摘要长度能不能满足？</li>
<li><b>读者</b>：方法开发者（JCTC、JCP、JCC）、物理化学读者（JPC、PCCP）、材料读者（npj Comput. Mater.、PRB）还是全领域读者（JACS、Angew.、Nature Chem.）？</li>
<li><b>开放获取与费用</b>：期刊是混合、完全开放还是钻石开放？APC 多少？你的单位或资助方有没有出版社协议？资助方是否要求开放获取？</li>
<li><b>预印本与数据政策</b>：是否接受已发预印本、是否要求投稿时公开数据和代码。</li>
<li><b>速度</b>：只参考官网公布的数字（期刊目录里“官网公布的数字”一栏注明了出处和日期），不同文章类型差别可能很大。</li>
</ol>
<p>可以用本页的筛选：先按类别和文章类型缩小范围，再按开放获取方式筛，最后逐个打开详情读出处。</p>
<h3>影响因子、CiteScore 与分区是什么</h3>
<ul>
<li><b>期刊影响因子（JIF）</b>：Clarivate 每年在 <a href="https://jcr.clarivate.com/">Journal Citation Reports（JCR）</a>中发布，大致是期刊前两年发表的文章在当年被引用的平均次数。JCR 还按学科类别把期刊分成 Q1–Q4 四个分区。通常要通过所在单位的订阅查询。</li>
<li><b>CiteScore</b>：Elsevier 的 Scopus 发布的指标，按四年窗口计算，可在 <a href="https://www.scopus.com/sources.uri">Scopus Sources</a> 查询。</li>
<li><b>中科院分区</b>：中国科学院文献情报中心发布的期刊分区表，把期刊分为 1–4 区，有大类和小类之分，国内很多单位用它作评价参考。它不在期刊官网上，本页不写具体分区；请通过所在单位图书馆或分区表官方渠道查询，并以单位认可的版本和年份为准。</li>
</ul>
<p>这些指标描述的是期刊整体的引用情况，不代表单篇论文的质量，不同学科之间也不能直接比较。投稿前先确认所在单位的评价规则用哪个版本。</p>
<h3>防范掠夺性期刊</h3>
<p>收到“快速发表”的约稿邮件要警惕。用 <a href="https://thinkchecksubmit.org/">Think. Check. Submit.</a> 的清单核对出版社；开放获取期刊可查是否收录在 <a href="https://doaj.org/">DOAJ</a>。</p>
<h3>准备 2–3 个候选</h3>
<p>按“冲一冲 / 最合适 / 稳妥”排好顺序。很多出版社有转投机制，被拒后可以把稿件和审稿意见转到同社的其他期刊（例如 ACS 的 Manuscript Transfer、Wiley 的 Refer &amp; Transfer）。</p>` },

    { id: 'g-cover', title: 'Cover letter（投稿信）', html: `
<p>编辑先看投稿信再决定要不要读全文、送不送审。它要在一页之内说清楚：你做了什么、为什么重要、为什么适合这本期刊。有的期刊对投稿信有明确要求，例如 ACS 期刊的作者指南要求每份投稿都附投稿信，JACS 的 Communication 要在信里说明紧迫性和重要性，ACS 期刊要求在信里说明是否发过预印本。</p>
<h3>结构</h3>
<ol>
<li>称呼编辑；稿件题目和文章类型。</li>
<li>一段话讲主要发现，最好带一个关键数字。</li>
<li>为什么这本期刊的读者会关心；与已有工作相比新在哪里（引用一两篇最相关的文献）。</li>
<li>声明：稿件未在别处发表或审稿；是否发过预印本（附链接）；相关的在审稿件；利益冲突；数据可用性。</li>
<li>推荐或回避的审稿人（如果期刊在信里收集这些信息）。</li>
<li>通讯作者署名和联系方式。</li>
</ol>
<h3>骨架示例（按你的情况改写）</h3>
<pre>尊敬的 &lt;编辑姓名&gt; 编辑：

我们提交稿件《&lt;题目&gt;》，申请作为 &lt;文章类型&gt; 在 &lt;期刊&gt; 发表。

&lt;一两句话：研究的问题和主要发现，带一个关键数字&gt;。

这项工作与 &lt;期刊&gt; 的读者相关，因为 &lt;理由&gt;。与 &lt;最相关的已有工作&gt; 相比，
本文 &lt;新的方法 / 新的认识 / 更高的精度&gt;。

本稿件未在其他期刊发表或审稿中。稿件的预印本已发布于 &lt;平台与 DOI&gt;（如适用）。
作者声明没有利益冲突 / 声明如下：&lt;…&gt;。数据与代码见 &lt;知识库与 DOI&gt;。

此致
&lt;通讯作者姓名、单位、邮箱&gt;</pre>
<p>不要把摘要原样复制进投稿信，也不要夸大；编辑每天读很多封，具体、诚实最有效。</p>` },

    { id: 'g-reviewers', title: '推荐审稿人', html: `
<ul>
<li><b>选谁</b>：近几年发表过密切相关工作的活跃研究者，最好分布在不同国家和机构。</li>
<li><b>不选谁</b>：同单位的人、近年的合作者、导师或学生，以及有任何实际或潜在利益冲突的人。ACS 的作者指南就明确建议不要推荐同单位或有利益冲突的人，并尽量提供机构邮箱。</li>
<li><b>写理由</b>：每位写一句为什么合适（例如“发展了本文所用的方法”）。</li>
<li><b>回避名单</b>：可以请求回避个别审稿人，简要说明理由；不少期刊会尽量尊重（例如 IJQC 的作者指南写明编辑一般会尊重排除请求）。</li>
<li><b>真实可查</b>：只提供真实、公开可查的联系方式。伪造审稿人或审稿意见属于严重学术不端，会导致撤稿。</li>
</ul>
<p>推荐审稿人通常是选填项，编辑会参考但不一定采用。</p>` },

    { id: 'g-submit', title: '投稿流程', html: `
<h3>投稿前准备的文件</h3>
<ul class="jr-check">
<li>正文（按期刊要求或允许的自由格式，图表嵌入或单独上传）</li>
<li>Supporting Information（单独文件，内容说明齐全）</li>
<li>投稿信</li>
<li>目录图或图形摘要（如要求）</li>
<li>数据可用性声明、利益冲突声明、作者贡献（例如 CRediT）、资助信息</li>
<li>全部作者的姓名、单位、邮箱，最好都有 ORCID</li>
<li>推荐 / 回避审稿人名单（如要求）</li>
<li>已发表图片的转载许可（如有）</li>
</ul>
<h3>投稿系统</h3>
<p>各出版社的系统不同：ACS 用 ACS Publishing Center，Wiley 用 Research Exchange，RSC、Taylor &amp; Francis 以及不少中国期刊用 ScholarOne Manuscripts，Springer Nature 有自己的投稿系统，APS 用 Submission Server。期刊目录里每种期刊的“投稿系统”链接已经核对过。</p>
<h3>一般步骤</h3>
<ol>
<li>注册或用 ORCID 登录，选择期刊和文章类型。</li>
<li>填写题目、摘要、关键词、作者和单位。</li>
<li>上传文件并标注类型（正文、SI、图、投稿信）；LaTeX 投稿常要求同时上传编译好的 PDF。</li>
<li>回答声明类问题（伦理、利益冲突、数据、预印本）。</li>
<li>检查系统生成的 PDF：公式、希腊字母、图片、上下标都要看一遍，再提交。</li>
</ol>
<h3>投稿以后</h3>
<p>一般先经过编辑部的技术检查（文件不全会被退回补交），再由编辑决定是否送审；不少稿件在这一步就被直接拒稿（desk reject）。送审后通常有两位或更多审稿人，最终给出接收、小修、大修或拒稿的决定。状态长时间不变时，可以按期刊给出的联系方式礼貌询问。</p>` },

    { id: 'g-response', title: '审稿意见逐条回复', html: `
<h3>原则</h3>
<ul>
<li>每一条都回复，不跳过、不合并成“已按意见修改”。</li>
<li>先感谢，再引用原意见，再回答，最后写明改了哪里（页码、行号、图表编号）。</li>
<li>能用数据回答的就补算；补算结果放进 SI 并在回复里概括。</li>
<li>不同意时说明理由并给证据，语气平和；即使不改，也可以在正文里加一句说明以免读者误解。</li>
<li>按期刊要求标出修改（修订模式或高亮），并准备一份干净版。</li>
<li>多位审稿人意见冲突时，说明你采用了哪种处理以及原因，必要时请编辑裁决。</li>
</ul>
<h3>示例结构</h3>
<pre>回复审稿意见（稿件编号 &lt;编号&gt;）

致编辑：感谢编辑和审稿人的意见。主要修改有：
(1) 补充了 &lt;…&gt; 的基准测试（新表 S4）；
(2) 重写了第 3.2 节关于 &lt;…&gt; 的讨论；
(3) 在 SI 中补充了全部过渡态的坐标与 IRC 结果。

审稿人 1
意见 1.1：「&lt;原文照录&gt;」
回复：感谢指出。我们用 &lt;方法&gt; 重新计算了 &lt;…&gt;，结果显示 &lt;…&gt;（新表 S4），
结论不变。
修改：正文第 6 页第 12–18 行；SI 第 S3 节。

意见 1.2：「&lt;原文照录&gt;」
回复：我们理解审稿人的担心。但 &lt;理由&gt;，证据见 &lt;图 / 数据&gt;。为避免误解，
我们在正文第 4 页加了一句说明。
修改：正文第 4 页第 5–7 行。

审稿人 2
意见 2.1：……</pre>` },

    { id: 'g-revise', title: '修改、拒稿与转投', html: `
<ul>
<li><b>修改期限</b>：决定信里会写返修期限；需要更多时间时尽早联系编辑说明原因。</li>
<li><b>拒稿以后</b>：先分清是范围不合（换刊即可）、新意不足（需要补充工作或换定位）还是方法问题（必须改进）。审稿意见即使来自被拒的期刊，也值得认真吸收。</li>
<li><b>转投</b>：可以使用出版社的转投服务，稿件、作者信息和已有审稿意见可能一起转过去（ACS、Wiley、RSC、Springer Nature 都有此类机制，以各自页面为准）。转投前按新期刊的格式和篇幅调整。</li>
<li><b>不要一稿多投</b>：同一时间只能投一个期刊。</li>
<li><b>重投同一期刊</b>：如果是此前被拒稿件的修改版，须在投稿信里说明并解释主要变化（例如 Angewandte Chemie 的作者须知有此要求）。</li>
<li><b>申诉</b>：只有在你能提出新的证据或明确指出评审中的事实错误时才考虑，按期刊公布的申诉途径提交。</li>
</ul>` },

    { id: 'g-accept', title: '接收以后：校样、版权与许可', html: `
<h3>校样</h3>
<p>接收后会收到校样（例如 ACS 用 ACS Direct Correct，Wiley 期刊的说明里提到 PDF 标注工具）。逐项核对作者姓名和单位、资助编号、公式、希腊字母、单位、上下标、表格对齐、图片、参考文献。校样阶段只改错误，不加新内容。返回时限通常很短，以邮件通知为准。</p>
<h3>版权转让还是许可</h3>
<ul>
<li><b>订阅出版</b>：一般签版权转让或独占许可协议（例如 Wiley 的 Copyright Transfer Agreement、ACS 的 Journal Publishing Agreement），协议规定了你能怎样分享各个版本。</li>
<li><b>开放获取</b>：作者保留版权，以知识共享许可发布。常见的有：
<ul>
<li><a href="https://creativecommons.org/licenses/by/4.0/">CC BY</a>：任何人可复制、改编、商用，只需署名。很多资助方要求这个许可。</li>
<li>CC BY-NC：不允许商用。</li>
<li>CC BY-NC-ND：不允许商用，也不允许改编。</li>
</ul>
各许可的完整说明见 <a href="https://creativecommons.org/cc-licenses/">Creative Commons 官网</a>。</li>
</ul>
<h3>三个版本能怎么分享</h3>
<p>预印本（投稿前的作者稿）、接收稿（审稿修改后、排版前）和正式版（期刊排版后）的分享规则不同，而且各出版社不一样，例如 Elsevier 允许随时随地分享预印本，AIP Publishing 对各版本放在哪里有逐项规定，ACS 提供零禁运或 12 个月后的绿色开放选项。以出版社的分享政策页为准（期刊目录各条的“开放获取”和“预印本政策”附了链接）。</p>
<h3>发表以后</h3>
<ul>
<li>在预印本页面加上正式文章 DOI。</li>
<li>把数据和代码的 DOI 链接到论文，在 ORCID 里更新作品。</li>
<li>发现错误及时联系期刊发更正。</li>
</ul>` },

    { id: 'g-oa', title: '开放获取与资助方要求', html: `
<h3>几种模式</h3>
<ul>
<li><b>金色开放</b>：正式版在期刊上免费阅读，通常由作者、单位或资助方付文章处理费（APC）。</li>
<li><b>混合期刊</b>：订阅期刊，单篇文章可付费开放。</li>
<li><b>钻石开放</b>：作者和读者都不付费，例如本页收录的 CCS Chemistry、LiveCoMS。</li>
<li><b>绿色开放</b>：把接收稿或预印本存到知识库，按出版社规定可能有禁运期。</li>
</ul>
<h3>费用谁来付</h3>
<p>先查单位是否与出版社签有开放获取协议（转换协议），很多情况下作者不用自己付 APC。各出版社网站都有查询工具。本页期刊目录只列出官网明确写出的 APC，并注明核对日期；价格会变，以付费时官网为准。</p>
<h3>资助方要求</h3>
<ul>
<li>欧洲等地的很多资助方加入了 <a href="https://www.coalition-s.org/">cOAlition S（Plan S）</a>，要求即时开放并使用 CC BY 等许可，可用 <a href="https://journalcheckertool.org/">Journal Checker Tool</a> 查某个期刊是否合规。</li>
<li>国内资助方（例如国家自然科学基金委员会）对成果提交和开放获取也有规定，以资助合同和资助方官网的最新通知为准。</li>
<li>期刊和出版社的版权与自存档政策可以用 <a href="https://openpolicyfinder.jisc.ac.uk/">Open Policy Finder</a> 查询。</li>
</ul>` },

    { id: 'g-preprint', title: '预印本', html: `
<h3>好处与风险</h3>
<ul>
<li>好处：确立优先权、早得到反馈、让工作更早被看到和引用。</li>
<li>风险：预印本公开后，审稿中的匿名性无法保证（Taylor &amp; Francis 的 Molecular Physics 作者须知就有这样的提醒），想选双盲审稿时尤其要考虑；少数期刊的规定可能把网上公开过的稿件视为已发表，例如《化学学报》投稿须知写明不接受在互联网等媒介公开发表过的工作，发预印本前应先确认。</li>
</ul>
<h3>发在哪里</h3>
<ul>
<li><b>ChemRxiv</b>：化学的主要预印本平台，发布前不经同行评审但会筛查。</li>
<li><b>arXiv physics.chem-ph</b>：理论和计算化学常用，投稿经版主审核，需要为每个版本选定不可撤销的许可。</li>
</ul>
<h3>操作要点</h3>
<ul>
<li>投稿前查目标期刊的预印本政策（期刊目录每条都有“预印本政策”）。例如 ACS 期刊允许投稿前发初稿，并要求在投稿信里说明；RSC 只允许在 ChemRxiv 上放修改后的版本，且须是接收前的版本。</li>
<li>选许可时想清楚以后的用途；AIP Publishing 建议预印本至少用 CC BY-NC。</li>
<li>发表后在预印本上链接正式 DOI。</li>
<li>引用他人预印本时写清平台、年份、“preprint”和带版本号的 DOI。</li>
</ul>
<p>可以用 <a href="../radar/index.html">MolAstria 预印本雷达</a>跟踪同行的新预印本。</p>` },

    { id: 'g-ethics', title: '学术伦理', html: `
<h3>COPE 与出版社政策</h3>
<p><a href="https://publicationethics.org/">出版伦理委员会（COPE）</a>为编辑和出版社提供处理学术不端的指南和流程图，本页收录的大多数出版社在伦理政策里引用 COPE。投稿前读一遍目标出版社的伦理准则（例如 <a href="https://researcher-resources.acs.org/publish/ethical_guidelines">ACS 伦理准则</a>、<a href="https://authorservices.wiley.com/ethics-guidelines/index.html">Wiley 出版伦理指南</a>）。</p>
<h3>署名与贡献</h3>
<ul>
<li>作者应对工作有实质贡献、同意投稿版本并对内容负责；只提供机时或经费的人放在致谢。</li>
<li>用 <a href="https://credit.niso.org/">CRediT</a> 的 14 种角色描述每位作者的贡献（概念、数据整理、形式分析、软件、验证、写作初稿、审阅与编辑等），越来越多的期刊要求或接受这种写法。</li>
<li>每位作者注册 <a href="https://orcid.org/">ORCID</a>，投稿时关联。</li>
</ul>
<h3>利益冲突</h3>
<p>如实声明经济利益（例如资助方、专利、商业软件的关系）和非经济利益。没有也要明确写“无”（例如 ChemPhysChem 要求无冲突时也要声明）。</p>
<h3>常见不端行为</h3>
<ul>
<li>伪造、篡改数据，选择性报告结果。</li>
<li>抄袭和未注明的文字重复使用；把一项工作拆成多篇“香肠式”发表（JCP 的政策就要求不要把相关结果分散到多篇稿件）。</li>
<li>一稿多投、重复发表。</li>
<li>操纵引用、伪造审稿人。</li>
</ul>
<h3>AI 工具的使用</h3>
<p>各出版社都已发布政策，共同点是 AI 不能当作者、作者对全部内容负责，但披露要求不一样：</p>
<ul>
<li><a href="https://researcher-resources.acs.org/publish/aipolicy">ACS</a>：用 AI 生成文字或图像要在致谢中说明何时、如何使用，较多的使用要在方法部分详细说明。</li>
<li><a href="https://www.elsevier.com/about/policies-and-standards/generative-ai-policies-for-journals">Elsevier</a>：在稿件中单独写一段 AI 声明，写明工具名称、用途和人工监督程度，声明会随文章发表。</li>
<li><a href="https://publishing.aip.org/resources/researchers/policies-and-ethics/ai-policy/">AIP Publishing</a>：只用于改善可读性不需要披露；用于分析数据或图像、设计实验、提取或综合信息时，要在方法部分写明工具名称、版本、用途和原因。</li>
<li><a href="https://www.nature.com/nature-portfolio/editorial-policies/ai">Nature Portfolio</a>：按不同用途分别说明是否允许、是否需要披露。</li>
<li><a href="https://authorservices.wiley.com/ethics-guidelines/index.html">Wiley</a>、<a href="https://www.rsc.org/publishing/journals/processes-and-policies/guiding-principles-for-artificial-intelligence">RSC</a>、<a href="https://journals.aps.org/authors/appropriate-use-ai-tools">APS</a> 也各有政策页，例如 Wiley 要求作者核查 AI 工具的使用条款，确认它不主张内容的所有权。</li>
</ul>
<p>审稿人同样受约束：很多出版社规定审稿人不能把未发表稿件上传到生成式 AI 工具（例如 Nature Portfolio 同行评审政策有专门一节）。</p>` },

    { id: 'g-reject', title: '常见拒稿原因', html: `
<ol>
<li><b>不在范围内</b>：没读 Aims &amp; Scope，或期刊明确不收这类工作（例如成熟方法的常规应用、单一靶标的对接、标准力场的常规分子动力学）。</li>
<li><b>新意或洞见不足</b>：只是换了体系重复已知做法，没有新的方法、新的认识或新的预测。JPC 系列把“新的物理洞见”作为核心标准。</li>
<li><b>方法没有验证</b>：没有基准测试，泛函或模型选择缺乏理由，误差范围不清。</li>
<li><b>与实验脱节</b>：能和实验比较却没有比较，或预测无法检验。《化学学报》对计算类稿件就要求结果与实验有较好的相关性。</li>
<li><b>细节不全、不可复现</b>：缺坐标、能量、收敛判据或软件版本；数据和代码不公开（Digital Discovery、JCIM 等对此有硬性要求）。</li>
<li><b>结论过度</b>：结论强于证据，或忽略明显的反例和误差。</li>
<li><b>文章类型或篇幅不对</b>：快报内容太多、完整论文论证不足，或超出字数和图表限制。</li>
<li><b>写作和格式问题</b>：逻辑不清、语言障碍影响理解、文件不全导致技术退回。</li>
<li><b>伦理问题</b>：重复发表、文字重复、未披露的利益冲突或 AI 使用。</li>
</ol>
<p>投稿前请一位不在项目里的同行按这份清单读一遍，比审稿人发现问题要便宜得多。</p>` },
  ],
  en: [
    { id: 'g-map', title: 'Overview: the full path of a computational chemistry paper', html: `
<p>A paper goes through roughly the steps below. Each step produces something you can hand over; save it as you go, because you will reuse it when writing and when answering reviewers.</p>
<ol>
<li><b>Topic and literature</b>: write down the question, why it matters and why computation can answer it now. Output: a one-page plan and a literature table.</li>
<li><b>Method choice and benchmarks</b>: compare a few methods on small systems and pick one that is accurate enough and affordable. Output: a benchmark table (errors, cost).</li>
<li><b>Production calculations</b>: run a fixed workflow and keep every input, output and script under version control. Output: complete raw data and processing scripts.</li>
<li><b>Data and figures</b>: generate tables and figures from the raw data with scripts, and export structures in common formats. Output: figures, a draft SI, a data package.</li>
<li><b>Writing</b>: settle figures and conclusions first, then results, methods and introduction, and finally the abstract and title.</li>
<li><b>Choosing a journal and submitting</b>: shortlist 2–3 journals by scope, article type, length, open access cost and data rules, and prepare files to the first choice's guidelines.</li>
<li><b>Review and revision</b>: answer point by point, run extra calculations, transfer if needed.</li>
<li><b>After acceptance</b>: proofs, the copyright or licence agreement, public data and code, and an updated preprint link.</li>
</ol>
<div class="jr-note">The journal directory above contains only what can be verified on the journal or publisher site, with a source and check date for every item. The chapters here describe general practice; for specific rules (word limits, templates, data requirements, fees) the target journal's guidelines always win.</div>` },

    { id: 'g-topic', title: 'Choosing a topic and reading the literature', html: `
<h3>Ask four questions first</h3>
<ul>
<li><b>Is it new?</b> Has anyone computed the same property for the same system at the same or a higher level?</li>
<li><b>Does it matter?</b> Whose decisions will the result change: experimentalists, method developers, materials designers?</li>
<li><b>Can computation answer it?</b> Can current methods reach the accuracy you need (barriers to about 1 kcal/mol, or is 5 kcal/mol enough)?</li>
<li><b>Can you afford it?</b> Do system size, number of conformers, sampling length and your compute budget match?</li>
</ul>
<h3>How to search</h3>
<ol>
<li>Build keyword sets (system names, properties, method names, common abbreviations) and search Web of Science, Scopus and Google Scholar; for work published in Chinese, also search CNKI.</li>
<li>Read recent reviews first (for example Chem. Rev., WIREs Comput. Mol. Sci., Acc. Chem. Res.), then follow citations backwards and forwards.</li>
<li>Preprint servers (ChemRxiv, arXiv physics.chem-ph) are often months ahead of journals; the <a href="../radar/index.html">MolAstria Preprint Radar</a> can watch them for you.</li>
<li>Keep a literature table: system, method and basis, property, error against experiment or a high-level reference, whether data and code are public. You will reuse it in the introduction and discussion.</li>
<li>Check what experimental or high-level reference data exist for validation (benchmark sets, crystal structures, spectra). Predictions with no way to check them are hard to get past review.</li>
</ol>
<h3>Look at journal scope early</h3>
<p>Many journals state what they do not take. JCTC does not consider straightforward applications of established methods to a single class of systems, TCA treats routine QSAR, docking and MD applications as out of scope, and Computational Materials Science rejects without review MD with standard force fields that only reports conventional averages. Checking these clauses while choosing the topic saves you from finishing a project with nowhere to send it. The exact wording is under "Scope" in the journal directory above.</p>
<h3>Set two goals</h3>
<p>Define the minimum publishable result and the ideal result. The first keeps the project from failing; the second decides how high you can aim.</p>` },

    { id: 'g-methods', title: 'Choosing and benchmarking methods', html: `
<p>The question reviewers ask most is "why this method, and is it reliable for your system?" The answer should come from your own benchmarks, not from "it is common in the literature".</p>
<h3>Density functionals</h3>
<ul>
<li>Start from large benchmark studies, such as the GMTKN55 assessment of hundreds of functionals (<a href="https://doi.org/10.1039/C7CP04913G">Goerigk et al., PCCP 2017</a>) and the best-practice protocols for routine molecular work (<a href="https://doi.org/10.1002/anie.202205735">Bursch et al., Angew. Chem. Int. Ed. 2022</a>).</li>
<li>Do not reuse an old default combination out of habit; compare several representative functionals (from different rungs) on your system before deciding.</li>
<li>The best functional depends on the property: thermochemistry, barriers, noncovalent interactions, excited states and transition-metal spin states need separate thought.</li>
</ul>
<h3>Dispersion corrections</h3>
<p>Most functionals need one. Say exactly which: D3 with zero or Becke–Johnson damping (<a href="https://doi.org/10.1063/1.3382344">D3</a>, <a href="https://doi.org/10.1002/jcc.21759">BJ damping</a>) or <a href="https://doi.org/10.1063/1.5090222">D4</a>. "D3 was added" is not enough.</p>
<h3>Basis sets</h3>
<ul>
<li>The def2 family (<a href="https://doi.org/10.1039/b508541a">Weigend and Ahlrichs, PCCP 2005</a>) and Dunning correlation-consistent sets are common; download basis data from the <a href="https://www.basissetexchange.org/">Basis Set Exchange</a> and note the version.</li>
<li>Test basis convergence: compare at least two levels on representative structures and see how much the key energy differences move.</li>
<li>For weak interactions consider basis set superposition error (counterpoise or a large enough basis); for heavy elements, state the effective core potentials.</li>
</ul>
<h3>Solvent</h3>
<ul>
<li>Implicit models (such as <a href="https://doi.org/10.1021/jp810292n">SMD</a> or PCM variants) capture bulk effects; for specific hydrogen bonding or coordination, add a few explicit solvent molecules.</li>
<li>Watch the standard state in solution free energies: converting from 1 atm (gas) to 1 mol/L (solution) is about 1.89 kcal/mol at 298 K and is often forgotten.</li>
<li>Say whether the solvent model was used only for single points or also for optimizations.</li>
</ul>
<h3>Conformer searches</h3>
<p>Energies and properties of flexible molecules depend strongly on conformation. Use systematic or metadynamics-style tools (for example <a href="https://doi.org/10.1063/5.0197592">CREST</a>) to find low-energy conformers and re-optimize them at a higher level; report the search method, energy window, number kept and whether you Boltzmann-weighted.</p>
<h3>Convergence and frequency checks</h3>
<ul>
<li>State SCF and geometry convergence criteria and the integration grid.</li>
<li>Run frequencies on every optimized structure: minima have no imaginary frequency, transition states exactly one, confirmed by IRC to connect the right minima.</li>
<li>For thermochemistry, give temperature, pressure and how low-frequency modes were treated (for example a quasi-rigid-rotor harmonic oscillator).</li>
<li>For open-shell systems check spin contamination (⟨S²⟩) and wavefunction stability; if strong multireference character is suspected, report diagnostics and consider multireference methods.</li>
</ul>
<h3>High-level references and periodic systems</h3>
<p>For reference values, use coupled cluster (such as CCSD(T) or a local approximation) on small models with basis set extrapolation, and state the thresholds. For periodic systems report the plane-wave cutoff, k-point mesh, smearing and pseudopotentials, with convergence tests.</p>
<h3>Where machine-learned potentials apply</h3>
<ul>
<li>Check the training data first: which DFT level, which elements, charge and spin states, and structure types (molecules, surfaces, bulk). Predictions outside that distribution are unreliable.</li>
<li>Take a sample of your own structures and check energies and forces with DFT single points; in MD, check energy conservation and long-run stability.</li>
<li>Validate charged or open-shell properties (ionization energies, electron affinities, spin gaps) separately; models can differ widely.</li>
<li>Give the model name, version or weights file and the package versions. The <a href="../models/index.html">MolAstria model API</a> lets you compare several models quickly, but check important conclusions with DFT or experiment.</li>
<li>For reporting machine learning itself, see <a href="https://doi.org/10.1038/s41557-021-00716-z">Artrith et al., Nat. Chem. 2021</a>.</li>
</ul>
<h3>How to benchmark</h3>
<p>Pick a small, representative validation set with references from experiment or higher-level theory; report mean absolute error, maximum error and cost; never tune and evaluate on the same data. Put the benchmark in the SI and justify the choice in a sentence or two in the main text.</p>` },

    { id: 'g-repro', title: 'Reproducibility: software, inputs, coordinates and data', html: `
<p>Journals are increasingly specific about reproducibility. ACS's JPC journals ask for program and version, parameter changes and convergence criteria, with structures, energies and frequencies available online; ChemPhysChem and Angewandte Chemie ask for coordinates and absolute energies of all stationary points; Digital Discovery requires code and data to be accessible during review. The exact rules are under "Data, code and coordinates" in the journal directory.</p>
<h3>What to keep and publish</h3>
<ul>
<li><b>Software</b>: name and exact version, with build options or patches if relevant; for your own code, a repository and an archived DOI.</li>
<li><b>Inputs</b>: at least one complete input per type of calculation; for batch workflows, the scripts that generate inputs.</li>
<li><b>Coordinates</b>: Cartesian coordinates of every reported structure in a machine-readable format (such as XYZ), with charge, multiplicity and the matching energy.</li>
<li><b>Energies and thermochemistry</b>: electronic energies (Hartree), zero-point energies, thermal corrections and free energies, with units.</li>
<li><b>Molecular dynamics</b>: force field and version, parameter files, composition, ensemble, thermostat and barostat, equilibration and sampling time, random seeds.</li>
<li><b>Machine learning</b>: the data and how they were split into training, validation and test sets, hyperparameters, training code and model weights.</li>
</ul>
<h3>FAIR principles</h3>
<p>Data should be findable, accessible, interoperable and reusable (<a href="https://doi.org/10.1038/sdata.2016.18">Wilkinson et al., Sci. Data 2016</a>; <a href="https://www.gofair.foundation/fair-principles">GO FAIR overview</a>). In practice: a repository with a persistent identifier (DOI), a README, open formats and a stated licence.</p>
<h3>Where to put it</h3>
<ul>
<li><a href="https://zenodo.org/">Zenodo</a>: a general repository for any files, with DOIs and versioning.</li>
<li><a href="https://nomad-lab.eu/">NOMAD</a>: raw materials and computational chemistry data, with parsers for many codes' outputs.</li>
<li><a href="https://www.iochem-bd.org/">ioChem-BD</a>: a platform to manage and publish computational chemistry results, handy for releasing all calculations of one paper as a collection.</li>
<li><a href="https://www.materialscloud.org/">Materials Cloud</a>: archiving of materials simulation data and workflows.</li>
<li>Experimental crystal structures go to the <a href="https://www.ccdc.cam.ac.uk/">CCDC</a>; find other repositories in <a href="https://www.re3data.org/">re3data</a> and <a href="https://fairsharing.org/">FAIRsharing</a>.</li>
</ul>
<h3>Licences and citation</h3>
<p>Data commonly use CC BY 4.0 or CC0; code uses an OSI-approved licence (such as MIT, BSD or GPL). Cite datasets and software DOIs in the references like papers. If data cannot be public during review, give reviewers a private link where the journal allows it (Scientific Data, for example, accepts a temporary anonymous download link at submission).</p>
<h3>Writing the data availability statement</h3>
<p>Say where the data are (repository and DOI), what they contain and any restrictions. If something is not public, say why and how to get it. Many journals require the statement at submission (ACS journals at Level 2, Nature Portfolio, RSC, most Wiley journals, the Physical Review journals and others).</p>` },

    { id: 'g-details', title: 'Writing the computational details: a checklist', html: `
<p>The "Computational Details" section should let a peer reproduce the main results without opening your input files. Tick through this list before submitting.</p>
<h3>General</h3>
<ul class="jr-check">
<li>Names and versions of all programs, citing the programs and the original method papers</li>
<li>Method, functional, dispersion version, basis set (and ECPs) for each type of calculation</li>
<li>Geometry convergence criteria, integration grid, SCF thresholds</li>
<li>Solvent model and solvent, and whether it was used for single points only or also for optimizations</li>
<li>Frequencies: minima without imaginary modes, transition states with one; whether IRC was run</li>
<li>Thermochemistry: temperature, pressure, standard-state conversion, low-frequency treatment</li>
<li>Conformer search: method, energy window, number kept, Boltzmann weighting</li>
<li>Open shell: multiplicity, ⟨S²⟩, stability analysis, multireference diagnostics if needed</li>
<li>Which energy is shown (ΔE, ΔH or ΔG) and its unit, also in figure and table captions</li>
<li>Coordinates and energies of all structures in the SI, plus machine-readable files</li>
</ul>
<h3>Periodic systems</h3>
<ul class="jr-check">
<li>Pseudopotentials or PAW datasets, cutoff energy, k-point mesh, smearing method and width</li>
<li>Whether the cell was relaxed, which atoms were fixed, slab thickness and vacuum</li>
<li>Convergence tests for cutoff and k-points</li>
</ul>
<h3>Molecular dynamics and free energies</h3>
<ul class="jr-check">
<li>Force field and version, origin and files of any custom parameters</li>
<li>System size and composition, boundary conditions, long-range electrostatics</li>
<li>Ensemble, thermostat and barostat, time step, constraints</li>
<li>Equilibration and sampling time, number of repeats and seeds, how errors were estimated</li>
</ul>
<h3>Machine learning</h3>
<ul class="jr-check">
<li>Data sources and reference level of theory, splitting method (avoid leakage)</li>
<li>Architecture, hyperparameters and how they were chosen, training code and weights</li>
<li>Test-set errors, comparison with baselines, statement of the applicability domain</li>
</ul>
<h3>An example (replace the placeholders with your own)</h3>
<pre>Geometries were optimized and frequencies computed with &lt;program&gt; &lt;version&gt; at the
&lt;functional&gt;-&lt;dispersion&gt;/&lt;basis&gt; level, with a &lt;grid&gt; integration grid and &lt;criteria&gt;
convergence criteria. Frequency analysis confirmed that all minima have no imaginary
frequency and each transition state exactly one; IRC calculations confirmed the connected
minima. Single-point energies were computed at &lt;higher level&gt;/&lt;basis&gt;, with solvation
from &lt;solvent model&gt; (&lt;solvent&gt;). Gibbs energies are given at 298.15 K and a 1 mol/L
standard state, with low-frequency modes treated by &lt;method&gt;. Conformers were searched
with &lt;tool&gt; and those within &lt;window&gt; were re-optimized. Coordinates and energies of all
structures are in the SI; raw inputs and outputs are in &lt;repository&gt; (DOI: &lt;…&gt;).</pre>
<p>Journals differ on where this section goes (a Methods section at the end, or the SI) and what it is called; follow the guidelines. IUPAC has two guidelines on reporting computational results, cited in the ACS JPC guidelines (<a href="https://doi.org/10.1351/pac199870102047">Pure Appl. Chem. 1998, 70, 2047</a>; <a href="https://doi.org/10.1351/pac199870041015">Pure Appl. Chem. 1998, 70, 1015</a>).</p>` },

    { id: 'g-figures', title: 'Figures and tables', html: `
<ul>
<li><b>One message per figure.</b> Decide what the reader should remember, then decide what to draw.</li>
<li><b>Energy diagrams</b>: state the zero, whether ΔE or ΔG is plotted, the temperature and the level of theory; keep sensible precision (0.1 kcal/mol or 0.01 eV is usually enough; do not imply accuracy beyond the method).</li>
<li><b>Structures</b>: use consistent atom colours and viewpoints, label key distances or angles, show forming and breaking bonds in transition states, and add atom numbers when they link to the SI.</li>
<li><b>Colour</b>: use colour-blind-safe palettes and do not rely on colour alone (vary line styles or markers); check on light and dark backgrounds.</li>
<li><b>Formats</b>: vector formats for plots and schemes; bitmaps at the resolution the journal asks for. Journals set their own sizes and resolutions; Appendix 2 of the ACS guidelines, for example, covers graphics preparation.</li>
<li><b>Tables</b>: give units, error statistics and the source of reference values; use one unit for a quantity throughout.</li>
<li><b>TOC graphics / graphical abstracts</b>: many journals require one, with their own size and text limits.</li>
<li><b>Traceability</b>: generate figures by script from raw data and archive both; disclose any image adjustment and never add or remove data points.</li>
</ul>` },

    { id: 'g-writing', title: 'Structure and writing', html: `
<h3>A useful writing order</h3>
<p>Figures → results and discussion → methods → introduction → conclusions → abstract → title. Lay out the evidence first, then how the question arises, and condense it into the abstract and title last.</p>
<h3>Section by section</h3>
<ul>
<li><b>Title</b>: specific and informative, with keywords for the system, method and main finding. Avoid empty modifiers; some journals ban words outright (JACS does not allow "First", "Novel" or series numbers in titles).</li>
<li><b>Abstract</b>: the problem, the approach, the one or two most important numbers, the significance. Limits differ (75 words for JCTC Letters, about 250 for JACS), so check first.</li>
<li><b>Introduction</b>: narrow from the broad problem to the gap, say what earlier work achieved and what is missing, and state your contribution in the last paragraph. Cite fairly, not just your own work.</li>
<li><b>Methods</b>: follow the checklist in the previous chapter; move bulk detail to the SI, but keep the key choices and reasons in the main text.</li>
<li><b>Results and discussion</b>: open each paragraph with the finding, then the evidence; compare with experiment or high-level references; discuss error sources and limitations yourself.</li>
<li><b>Conclusions</b>: do not repeat the abstract; say what the work changes and what remains open.</li>
<li><b>SI</b>: start with a table of contents, number items in main-text order (Table S1, Figure S1…), give coordinates and energies in copyable form, and list the content of each SI file in the main text if the journal asks.</li>
</ul>
<h3>Language</h3>
<ul>
<li>One idea per sentence; define terms and abbreviations at first use and keep them consistent.</li>
<li>Match the strength of claims to the evidence; avoid "prove" or "first" unless you can back them.</li>
<li>Give numbers with units and uncertainties, with precision that matches the method.</li>
<li>If English is hard for you, write simple accurate sentences first and then get help from a colleague or a language editor; if you use AI tools, follow the journal's policy and disclose as required (see the ethics chapter).</li>
</ul>` },

    { id: 'g-choose', title: 'Choosing a journal', html: `
<h3>Check in this order</h3>
<ol>
<li><b>Scope</b>: read the Aims &amp; Scope and recent tables of contents for similar work, and watch for explicit exclusions (see "Scope" in the directory).</li>
<li><b>Article type and length</b>: is the result a letter or a full paper? Can you meet the word, figure and abstract limits?</li>
<li><b>Readers</b>: method developers (JCTC, JCP, JCC), physical chemists (JPC, PCCP), materials scientists (npj Comput. Mater., PRB) or all chemists (JACS, Angew., Nature Chem.)?</li>
<li><b>Open access and cost</b>: hybrid, fully open or diamond? What is the APC? Does your institution or funder have a publisher agreement, and does the funder require open access?</li>
<li><b>Preprint and data policies</b>: are preprints accepted, and must data and code be public at submission?</li>
<li><b>Speed</b>: use only figures published on the official site (the directory's "Figures stated on the official site" gives source and date); they can differ a lot by article type.</li>
</ol>
<p>Use the filters on this page: narrow by category and article type, then by open access model, and open the details to read the sources.</p>
<h3>Impact factors, CiteScore and quartiles</h3>
<ul>
<li><b>Journal Impact Factor (JIF)</b>: published each year by Clarivate in <a href="https://jcr.clarivate.com/">Journal Citation Reports (JCR)</a>, roughly the average number of citations in a year to items the journal published in the previous two years. JCR also ranks journals into quartiles Q1–Q4 within subject categories. Access usually comes through an institutional subscription.</li>
<li><b>CiteScore</b>: Elsevier Scopus's metric over a four-year window, searchable in <a href="https://www.scopus.com/sources.uri">Scopus Sources</a>.</li>
<li><b>CAS journal ranking (中科院分区)</b>: a ranking table published by the National Science Library of the Chinese Academy of Sciences, which puts journals in tiers 1–4 within broad and narrow categories; many Chinese institutions use it for evaluation. It is not on journal websites, so this page gives no tiers; check through your library or the official channel, and use the edition your institution recognizes.</li>
</ul>
<p>These metrics describe a journal's citations as a whole, not the quality of a single paper, and are not comparable across fields. Check which edition your institution's rules use before relying on them.</p>
<h3>Avoid predatory journals</h3>
<p>Be wary of e-mails promising fast publication. Check the publisher with <a href="https://thinkchecksubmit.org/">Think. Check. Submit.</a>; for open access journals, see whether they are listed in <a href="https://doaj.org/">DOAJ</a>.</p>
<h3>Keep 2–3 candidates</h3>
<p>Rank them as ambitious, best fit and safe. Many publishers offer transfers, so a declined manuscript can move to a sister journal with its reviews (for example ACS Manuscript Transfer and Wiley Refer &amp; Transfer).</p>` },

    { id: 'g-cover', title: 'The cover letter', html: `
<p>Editors read the cover letter before deciding whether to read on and send the paper out. In one page it should say what you did, why it matters and why it fits this journal. Some journals have explicit requirements: ACS guidelines require a cover letter with every submission, JACS Communications must explain their urgency and significance in it, and ACS journals ask you to mention preprints there.</p>
<h3>Structure</h3>
<ol>
<li>Address the editor; give the title and article type.</li>
<li>One paragraph on the main finding, ideally with a key number.</li>
<li>Why this journal's readers will care, and what is new compared with earlier work (cite the one or two closest papers).</li>
<li>Declarations: not published or under review elsewhere; any preprint (with link); related manuscripts under review; conflicts of interest; data availability.</li>
<li>Suggested or excluded reviewers, if the journal collects them in the letter.</li>
<li>The corresponding author's name and contact details.</li>
</ol>
<h3>A skeleton (adapt it)</h3>
<pre>Dear Dr &lt;editor&gt;,

We submit our manuscript "&lt;title&gt;" for consideration as a &lt;article type&gt; in &lt;journal&gt;.

&lt;One or two sentences: the question and the main finding, with a key number&gt;.

The work is relevant to readers of &lt;journal&gt; because &lt;reason&gt;. Compared with
&lt;closest earlier work&gt;, it &lt;new method / new understanding / higher accuracy&gt;.

The manuscript is not published or under consideration elsewhere. A preprint is available
at &lt;server and DOI&gt; (if applicable). The authors declare no competing interests / declare
the following: &lt;…&gt;. Data and code are available at &lt;repository and DOI&gt;.

Sincerely,
&lt;corresponding author, affiliation, e-mail&gt;</pre>
<p>Do not paste the abstract or oversell; editors read many letters a day, and specific, honest letters work best.</p>` },

    { id: 'g-reviewers', title: 'Suggesting reviewers', html: `
<ul>
<li><b>Whom to suggest</b>: active researchers who published closely related work in recent years, ideally from different countries and institutions.</li>
<li><b>Whom not to</b>: people at your institution, recent collaborators, advisers or students, and anyone with a real or perceived conflict of interest. The ACS guidelines say exactly this and ask for institutional e-mail addresses.</li>
<li><b>Give reasons</b>: one line per person on why they fit (for example "developed the method used here").</li>
<li><b>Exclusions</b>: you may ask to exclude a few reviewers with a brief reason; many journals try to honour it (the IJQC guidelines say editors normally do).</li>
<li><b>Real and verifiable</b>: give only real, publicly verifiable contacts. Fake reviewers or reports are serious misconduct and lead to retractions.</li>
</ul>
<p>Reviewer suggestions are usually optional, and editors may not use them.</p>` },

    { id: 'g-submit', title: 'The submission process', html: `
<h3>Files to prepare</h3>
<ul class="jr-check">
<li>Main text (in the journal format or an allowed free format, with figures embedded or separate)</li>
<li>Supporting Information (separate file, with contents described)</li>
<li>Cover letter</li>
<li>TOC graphic or graphical abstract, if required</li>
<li>Data availability, competing interests, author contributions (for example CRediT) and funding statements</li>
<li>Names, affiliations and e-mails of all authors, ideally with ORCID iDs</li>
<li>Suggested / excluded reviewers, if requested</li>
<li>Permissions for reused figures, if any</li>
</ul>
<h3>Submission systems</h3>
<p>They differ by publisher: ACS uses the ACS Publishing Center, Wiley uses Research Exchange, RSC, Taylor &amp; Francis and many Chinese journals use ScholarOne Manuscripts, Springer Nature has its own system, and APS uses its Submission Server. The "Submission system" links in the directory have been checked.</p>
<h3>Typical steps</h3>
<ol>
<li>Register or log in with ORCID, then choose the journal and article type.</li>
<li>Enter title, abstract, keywords, authors and affiliations.</li>
<li>Upload and label files (main text, SI, figures, cover letter); LaTeX submissions often need a compiled PDF too.</li>
<li>Answer the declarations (ethics, conflicts, data, preprints).</li>
<li>Check the generated PDF (equations, Greek letters, figures, sub- and superscripts) before submitting.</li>
</ol>
<h3>After submission</h3>
<p>The editorial office usually runs a technical check first (incomplete files come back to you), then an editor decides whether to send it for review; many papers are declined at this stage (desk rejection). Reviewed papers usually get two or more reviewers and a decision of accept, minor revision, major revision or reject. If the status does not change for a long time, ask politely through the journal's contact route.</p>` },

    { id: 'g-response', title: 'Answering reviewers point by point', html: `
<h3>Principles</h3>
<ul>
<li>Answer every point; do not skip or lump them into "revised as suggested".</li>
<li>Thank, quote the comment, answer, then say what changed and where (page, line, figure or table).</li>
<li>Answer with data where you can; put new calculations in the SI and summarize them in the reply.</li>
<li>If you disagree, give reasons and evidence calmly; even without changes, a sentence in the text can prevent the same misunderstanding in readers.</li>
<li>Mark changes as the journal asks (tracked changes or highlighting) and also prepare a clean version.</li>
<li>When reviewers disagree with each other, say what you did and why, and ask the editor to decide if needed.</li>
</ul>
<h3>Example structure</h3>
<pre>Response to reviewers (manuscript &lt;ID&gt;)

To the editor: we thank the editor and reviewers. The main changes are:
(1) a new benchmark of &lt;…&gt; (new Table S4);
(2) a rewritten discussion of &lt;…&gt; in Section 3.2;
(3) coordinates and IRC results for all transition states added to the SI.

Reviewer 1
Comment 1.1: "&lt;quoted verbatim&gt;"
Response: Thank you for raising this. We recomputed &lt;…&gt; with &lt;method&gt;; the results
show &lt;…&gt; (new Table S4) and the conclusion is unchanged.
Changes: main text p. 6, lines 12–18; SI Section S3.

Comment 1.2: "&lt;quoted verbatim&gt;"
Response: We understand the concern. However, &lt;reason&gt;, as shown by &lt;figure / data&gt;.
To avoid misunderstanding we added a sentence on p. 4.
Changes: main text p. 4, lines 5–7.

Reviewer 2
Comment 2.1: …</pre>` },

    { id: 'g-revise', title: 'Revisions, rejection and transfers', html: `
<ul>
<li><b>Deadlines</b>: the decision letter gives a revision deadline; if you need more time, tell the editor early and say why.</li>
<li><b>After a rejection</b>: work out whether it was scope (change journal), novelty (add work or reframe) or method (must be fixed). Reviews from a journal that declined you are still worth taking seriously.</li>
<li><b>Transfers</b>: publisher transfer services may move the manuscript, author data and existing reviews (ACS, Wiley, RSC and Springer Nature all have such schemes; see their pages). Adjust to the new journal's format and length first.</li>
<li><b>One journal at a time</b>: never submit to two journals at once.</li>
<li><b>Resubmitting to the same journal</b>: if it is a revised version of a declined paper, say so in the cover letter and explain the main changes (the Angewandte Chemie notice to authors requires this, for example).</li>
<li><b>Appeals</b>: only with new evidence or a clear factual error in the review, through the journal's published route.</li>
</ul>` },

    { id: 'g-accept', title: 'After acceptance: proofs, copyright and licences', html: `
<h3>Proofs</h3>
<p>You will receive proofs (for example through ACS Direct Correct; Wiley journals mention a PDF annotation tool). Check author names and affiliations, grant numbers, equations, Greek letters, units, sub- and superscripts, table alignment, figures and references. Correct errors only; do not add content. Turnaround is usually short, so follow the e-mail.</p>
<h3>Copyright transfer or licence</h3>
<ul>
<li><b>Subscription publishing</b>: usually a copyright transfer or exclusive licence (for example Wiley's Copyright Transfer Agreement or the ACS Journal Publishing Agreement), which sets how you may share each version.</li>
<li><b>Open access</b>: you keep copyright and the article is published under a Creative Commons licence:
<ul>
<li><a href="https://creativecommons.org/licenses/by/4.0/">CC BY</a>: anyone may copy, adapt and use commercially with attribution. Many funders require it.</li>
<li>CC BY-NC: no commercial use.</li>
<li>CC BY-NC-ND: no commercial use and no derivatives.</li>
</ul>
Full descriptions are on the <a href="https://creativecommons.org/cc-licenses/">Creative Commons site</a>.</li>
</ul>
<h3>Sharing the three versions</h3>
<p>The preprint (author version before review), the accepted manuscript (after review, before typesetting) and the version of record follow different rules that vary by publisher: Elsevier lets you share a preprint anywhere at any time, AIP Publishing specifies where each version may go, and ACS offers zero-embargo or 12-month green options. Follow the publisher's sharing policy (linked under "Open access" and "Preprint policy" in the directory).</p>
<h3>After publication</h3>
<ul>
<li>Add the DOI of the article to your preprint.</li>
<li>Link data and code DOIs to the paper and update your ORCID record.</li>
<li>If you find an error, contact the journal promptly about a correction.</li>
</ul>` },

    { id: 'g-oa', title: 'Open access and funder requirements', html: `
<h3>Models</h3>
<ul>
<li><b>Gold</b>: the version of record is free to read on the journal site, usually paid for by an article processing charge (APC) from the author, institution or funder.</li>
<li><b>Hybrid</b>: a subscription journal where single articles can be made open for a fee.</li>
<li><b>Diamond</b>: free for authors and readers, such as CCS Chemistry and LiveCoMS in this directory.</li>
<li><b>Green</b>: the accepted manuscript or preprint in a repository, possibly after an embargo set by the publisher.</li>
</ul>
<h3>Who pays</h3>
<p>Check whether your institution has an open access (transformative) agreement with the publisher; often authors pay nothing themselves. Publisher sites have lookup tools. This directory lists only APCs stated explicitly on official pages, with the check date; prices change, so check the site when you pay.</p>
<h3>Funder requirements</h3>
<ul>
<li>Many funders, especially in Europe, belong to <a href="https://www.coalition-s.org/">cOAlition S (Plan S)</a> and require immediate open access under licences such as CC BY; the <a href="https://journalcheckertool.org/">Journal Checker Tool</a> tells you whether a journal complies.</li>
<li>Chinese funders (such as the National Natural Science Foundation of China) also have rules on depositing outputs and open access; follow your grant terms and the funder's latest notices.</li>
<li>Journal and publisher copyright and self-archiving policies can be looked up in <a href="https://openpolicyfinder.jisc.ac.uk/">Open Policy Finder</a>.</li>
</ul>` },

    { id: 'g-preprint', title: 'Preprints', html: `
<h3>Benefits and risks</h3>
<ul>
<li>Benefits: priority, early feedback, earlier visibility and citations.</li>
<li>Risks: once a preprint is public, anonymity in review cannot be guaranteed (the Taylor &amp; Francis Molecular Physics instructions say so), which matters if you want double-anonymous review; a few journals may treat anything posted online as published. The Acta Chimica Sinica notice, for example, says it does not accept work already published on the Internet, so check before posting.</li>
</ul>
<h3>Where to post</h3>
<ul>
<li><b>ChemRxiv</b>: the main chemistry preprint server; content is screened but not peer reviewed before posting.</li>
<li><b>arXiv physics.chem-ph</b>: common for theoretical and computational chemistry; submissions are moderated, and each version gets an irrevocable licence chosen at submission.</li>
</ul>
<h3>Practical points</h3>
<ul>
<li>Check the target journal's preprint policy before posting (each directory entry has one). ACS journals allow an initial draft before submission and ask you to mention it in the cover letter; RSC allows a revised version only on ChemRxiv and only before acceptance.</li>
<li>Think about later reuse when choosing a licence; AIP Publishing asks for at least CC BY-NC on preprints.</li>
<li>After publication, link the preprint to the published DOI.</li>
<li>When citing others' preprints, give the server, year, the word "preprint" and the versioned DOI.</li>
</ul>
<p>The <a href="../radar/index.html">MolAstria Preprint Radar</a> can follow new preprints in your field.</p>` },

    { id: 'g-ethics', title: 'Research ethics', html: `
<h3>COPE and publisher policies</h3>
<p>The <a href="https://publicationethics.org/">Committee on Publication Ethics (COPE)</a> gives editors and publishers guidance and flowcharts for handling misconduct, and most publishers in this directory cite COPE in their ethics policies. Read the target publisher's ethics guidelines before submitting (for example the <a href="https://researcher-resources.acs.org/publish/ethical_guidelines">ACS Ethical Guidelines</a> and <a href="https://authorservices.wiley.com/ethics-guidelines/index.html">Wiley's publishing ethics guidelines</a>).</p>
<h3>Authorship and contributions</h3>
<ul>
<li>Authors make a substantial contribution, approve the submitted version and take responsibility for it; people who only provided compute time or funding go in the acknowledgments.</li>
<li>Describe each author's contribution with the 14 <a href="https://credit.niso.org/">CRediT</a> roles (conceptualization, data curation, formal analysis, software, validation, writing – original draft, writing – review &amp; editing and others); more and more journals require or accept it.</li>
<li>Every author should have an <a href="https://orcid.org/">ORCID</a> iD linked at submission.</li>
</ul>
<h3>Conflicts of interest</h3>
<p>Declare financial interests (funders, patents, ties to commercial software) and non-financial ones honestly. If there are none, say so explicitly (ChemPhysChem, for example, asks for a statement even then).</p>
<h3>Common misconduct</h3>
<ul>
<li>Fabricating or falsifying data, or reporting results selectively.</li>
<li>Plagiarism and undisclosed text recycling; splitting one study into many papers (the JCP policy asks authors not to spread related results over several manuscripts).</li>
<li>Duplicate submission and duplicate publication.</li>
<li>Citation manipulation and fake reviewers.</li>
</ul>
<h3>Using AI tools</h3>
<p>Every publisher now has a policy. They agree that AI cannot be an author and that authors are responsible for everything, but disclosure rules differ:</p>
<ul>
<li><a href="https://researcher-resources.acs.org/publish/aipolicy">ACS</a>: disclose AI-generated text or images in the Acknowledgment section (when and how), with full details in the Methods for substantial use.</li>
<li><a href="https://www.elsevier.com/about/policies-and-standards/generative-ai-policies-for-journals">Elsevier</a>: a separate AI declaration in the manuscript naming the tool, its purpose and the degree of human oversight; it is published with the article.</li>
<li><a href="https://publishing.aip.org/resources/researchers/policies-and-ethics/ai-policy/">AIP Publishing</a>: no disclosure needed for improving readability; for analysing data or images, designing experiments, or extracting or synthesizing information, describe the tool (name, version, maker), its use and the reason in the Methods.</li>
<li><a href="https://www.nature.com/nature-portfolio/editorial-policies/ai">Nature Portfolio</a>: sets out, use by use, what is permitted and what must be disclosed.</li>
<li><a href="https://authorservices.wiley.com/ethics-guidelines/index.html">Wiley</a>, <a href="https://www.rsc.org/publishing/journals/processes-and-policies/guiding-principles-for-artificial-intelligence">RSC</a> and <a href="https://journals.aps.org/authors/appropriate-use-ai-tools">APS</a> have their own pages; Wiley, for example, asks authors to check an AI tool's terms to make sure it claims no ownership of their content.</li>
</ul>
<p>Reviewers are bound too: many publishers forbid uploading unpublished manuscripts to generative AI tools (the Nature Portfolio peer review policy has a section on it, for example).</p>` },

    { id: 'g-reject', title: 'Common reasons for rejection', html: `
<ol>
<li><b>Out of scope</b>: the Aims &amp; Scope were not read, or the journal explicitly excludes this kind of work (routine applications of established methods, docking against a single target, routine MD with standard force fields).</li>
<li><b>Not enough novelty or insight</b>: a known approach repeated on another system, with no new method, understanding or prediction. The JPC journals make new physical insight their key criterion.</li>
<li><b>No validation</b>: no benchmark, no reason for the functional or model, unclear error bars.</li>
<li><b>No link to experiment</b>: comparison was possible but missing, or predictions cannot be tested. Acta Chimica Sinica, for instance, requires computational results to agree well with experiment.</li>
<li><b>Missing details, not reproducible</b>: no coordinates, energies, convergence criteria or software versions; data and code not public (Digital Discovery and JCIM have firm requirements).</li>
<li><b>Overclaiming</b>: conclusions stronger than the evidence, or obvious counterexamples and errors ignored.</li>
<li><b>Wrong type or length</b>: a letter overloaded with content, a full paper with thin evidence, or limits on words and figures exceeded.</li>
<li><b>Writing and format</b>: unclear logic, language that gets in the way, or incomplete files returned at the technical check.</li>
<li><b>Ethics</b>: duplicate publication, text recycling, undisclosed conflicts or AI use.</li>
</ol>
<p>Before submitting, ask a colleague outside the project to read it against this list; it is much cheaper than a reviewer finding the problems.</p>` },
  ],
};
