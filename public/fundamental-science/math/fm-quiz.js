/* 数学基础与探索 · 动手算一算：每门学科两道写公式作答的题，由 ../../viewer/formula-check.js 判分。
   每道题：q 题面（中英），tex 题面下的公式（可选），answer 标准答案（LaTeX，顶层逗号分开的是不计顺序的多个值），
   alt 其他算对的写法，vars 答案里的变量和取样范围（'int' 正整数，[lo, hi] 实数区间，'+' 正实数），defs 可以换着用的量（如 h = 2πħ），
   wrong 常见错误（1–3 个，各带针对性的提示），hint 错两次后的总提示，steps 解答（中英文字或 LaTeX）。
   每个答案和每个常见错误都手算过，并由 tools/formula-check-test.mjs 独立地数值核对（积分、对角化、极小化等）。
   题面和解答里的公式写成 LaTeX（math），由 tools/fundamental-math.mjs 转成 MathML，结果在 fm-quiz-math.js（生成的文件，不要手改）。 */
(() => {
  'use strict';
  const T = (zh, en) => ({ zh, en });
  const R = String.raw;

  const items = {
    la: [
      {
        id: 'la-1',
        q: T('乙烯 π 体系的 Hückel 矩阵如下（α 是库仑积分，β < 0 是共振积分）。它的两个本征值是什么？用逗号隔开。',
          'The Hückel matrix of the ethylene π system is shown below (α is the Coulomb integral, β < 0 the resonance integral). What are its two eigenvalues? Separate them with a comma.'),
        tex: R`H=\begin{pmatrix}\alpha&\beta\\ \beta&\alpha\end{pmatrix}`,
        answer: R`\alpha+\beta,\alpha-\beta`,
        vars: { alpha: [-2, 2], beta: [-2, -0.3] },
        wrong: [
          { a: R`\alpha,\alpha`, hint: T('对角元不是本征值：非对角的 β 把两个能级推开了。解 det(H − λI) = 0。', 'The diagonal entries are not the eigenvalues: the off-diagonal β pushes the two levels apart. Solve det(H − λI) = 0.') },
          { a: R`\alpha^2-\beta^2`, hint: T('这是行列式 det H，也就是两个本征值的乘积，不是本征值本身。', 'That is the determinant det H, the product of the two eigenvalues, not the eigenvalues themselves.') },
        ],
        hint: T('写出特征方程 (α − λ)² − β² = 0。', 'Write the characteristic equation (α − λ)² − β² = 0.'),
        steps: [
          R`\det(H-\lambda I)=(\alpha-\lambda)^2-\beta^2=0`,
          T('所以 α − λ = ±β：', 'So α − λ = ±β:'),
          R`\lambda=\alpha\pm\beta`,
          T('β < 0，所以 α + β 更低，是成键轨道；α − β 是反键轨道。', 'Since β < 0, α + β is the lower, bonding orbital and α − β the antibonding one.'),
        ],
      },
      {
        id: 'la-2',
        q: T('4 个电子放进 8 个自旋轨道，满足泡利原理的 Slater 行列式一共有多少个？',
          'How many Slater determinants (Pauli-allowed configurations) are there for 4 electrons in 8 spin orbitals?'),
        answer: R`70`,
        alt: [R`\binom{8}{4}`],
        wrong: [
          { a: R`4096`, hint: T('电子不能占同一个自旋轨道，也不可区分：不是 8⁴，而是从 8 个里选出 4 个被占据的。', 'Electrons cannot share a spin orbital and are indistinguishable: it is not 8⁴ but a choice of which 4 of the 8 are occupied.') },
          { a: R`1680`, hint: T('8 × 7 × 6 × 5 把同一组轨道的不同排列算了 4! = 24 次；交换行列式的两行只变号，是同一个态。', '8 × 7 × 6 × 5 counts each set of orbitals 4! = 24 times; swapping two rows of a determinant only flips its sign, so it is the same state.') },
          { a: R`256`, hint: T('2⁸ 数的是任意电子数的占据方式（0 到 8 个电子都算）；这里电子数固定是 4。', '2⁸ counts occupations for any number of electrons (0 to 8); here the electron number is fixed at 4.') },
        ],
        hint: T('这是组合数：从 8 个自旋轨道里选 4 个。', 'This is a binomial coefficient: choose 4 of the 8 spin orbitals.'),
        steps: [
          R`\binom{8}{4}=\frac{8!}{4!\,4!}=70`,
          T('全组态相互作用（Full CI）的维数就是这样数出来的，随轨道数指数增长。', 'This is how the dimension of full configuration interaction is counted; it grows exponentially with the number of orbitals.'),
        ],
      },
    ],
    fa: [
      {
        id: 'fa-1',
        q: T('把 ψ(x) = c e^{−a|x|}（a > 0，x 取全体实数）归一化。正的常数 c 是多少？',
          'Normalise ψ(x) = c e^{−a|x|} (a > 0, x over the whole real line). What is the positive constant c?'),
        tex: R`\int_{-\infty}^{\infty}|\psi(x)|^2\,dx=1`,
        answer: R`\sqrt{a}`,
        vars: { a: '+' },
        wrong: [
          { a: R`\sqrt{2a}`, hint: T('只积了半条轴（x > 0）：|x| 让两边对称，全轴的积分是半轴的两倍。', 'You integrated over half the line (x > 0) only: |x| makes the two sides symmetric, so the full integral is twice the half-line one.') },
          { a: R`\frac{a}{2}`, hint: T('要归一化的是 |ψ|² 的积分，不是 |ψ| 的积分。', 'It is the integral of |ψ|² that must be 1, not the integral of |ψ|.') },
          { a: R`a`, hint: T('算出来的是 c² = a，最后别忘了开方。', 'What you get is c² = a; do not forget the square root.') },
        ],
        hint: T('|ψ|² = c² e^{−2a|x|}，分成 x < 0 和 x > 0 两段，每段的积分是 1/(2a)。', '|ψ|² = c² e^{−2a|x|}; split it into x < 0 and x > 0, and each half integrates to 1/(2a).'),
        steps: [
          R`\int_{-\infty}^{\infty}c^2e^{-2a|x|}\,dx=2c^2\int_0^{\infty}e^{-2ax}\,dx=\frac{c^2}{a}`,
          T('令它等于 1：', 'Set it equal to 1:'),
          R`c=\sqrt{a}`,
        ],
      },
      {
        id: 'fa-2',
        q: T('积分算子 (Kf)(x) = ∫₀¹ x y f(y) dy 作用在 L²(0, 1) 上。它唯一不为零的本征值是多少？',
          'The integral operator (Kf)(x) = ∫₀¹ x y f(y) dy acts on L²(0, 1). What is its only nonzero eigenvalue?'),
        answer: R`\frac{1}{3}`,
        wrong: [
          { a: R`\frac{1}{2}`, hint: T('½ 是 ∫₀¹ y dy；本征函数是 f(x) = x 本身，要算 ∫₀¹ y · y dy。', '½ is ∫₀¹ y dy; the eigenfunction is f(x) = x itself, so you need ∫₀¹ y · y dy.') },
          { a: R`\frac{1}{4}`, hint: T('¼ 是把核 K(x, y) = xy 对 x 和 y 都积了一遍；本征值要从 Kf = λf 求。', '¼ is the kernel K(x, y) = xy integrated over both x and y; the eigenvalue comes from Kf = λf.') },
        ],
        hint: T('Kf 总是正比于 x，所以试 f(x) = x，看 Kf 是它的几倍。', 'Kf is always a multiple of x, so try f(x) = x and see what multiple of it Kf is.'),
        steps: [
          R`(Kf)(x)=x\int_0^1 y\,f(y)\,dy`,
          T('Kf 总是 x 的倍数，所以本征函数只能是 f(x) = x：', 'Kf is always a multiple of x, so the eigenfunction must be f(x) = x:'),
          R`(Kx)(x)=x\int_0^1 y^2\,dy=\frac{1}{3}\,x`,
          T('这是秩为 1 的算子，其余本征值都是 0。', 'This is a rank-one operator; all other eigenvalues are 0.'),
        ],
      },
    ],
    gr: [
      {
        id: 'gr-1',
        q: T('水分子（C₂ᵥ，分子在 yz 平面）9 个笛卡尔位移的可约表示 Γ₃N 的特征标如下。B₂ 的特征标是 (1, −1, −1, 1)。用约化公式算 Γ₃N 里 B₂ 出现几次。',
          'The characters of the reducible representation Γ₃N of the 9 Cartesian displacements of water (C₂ᵥ, molecule in the yz plane) are below. The characters of B₂ are (1, −1, −1, 1). Use the reduction formula to find how many times B₂ occurs in Γ₃N.'),
        tex: R`\chi_{3N}:\quad E=9,\quad C_2=-1,\quad \sigma_v(xz)=1,\quad \sigma_v'(yz)=3`,
        answer: R`3`,
        wrong: [
          { a: R`12`, hint: T('约化公式前面有 1/|G|：C₂ᵥ 有 4 个对称操作，要除以 4。', 'The reduction formula has a 1/|G| in front: C₂ᵥ has 4 operations, so divide by 4.') },
          { a: R`2`, hint: T('2 是 B₁ 的次数：B₁ 的特征标是 (1, −1, 1, −1)，B₂ 是 (1, −1, −1, 1)。', '2 is the multiplicity of B₁, whose characters are (1, −1, 1, −1); B₂ has (1, −1, −1, 1).') },
          { a: R`1`, hint: T('1 是振动里 B₂ 的个数（反对称伸缩）；题目问的是全部 9 个位移，还没减去平动和转动。', '1 is the number of B₂ vibrations (the antisymmetric stretch); the question asks about all 9 displacements, before removing translations and rotations.') },
        ],
        hint: T('n(B₂) = (1/|G|) Σ_R χ_{B₂}(R) χ(R)：四个操作各乘一次再相加。', 'n(B₂) = (1/|G|) Σ_R χ_{B₂}(R) χ(R): multiply for each of the four operations and add.'),
        steps: [
          R`n(B_2)=\frac{1}{4}\left[9\cdot1+(-1)(-1)+1\cdot(-1)+3\cdot1\right]=3`,
          T('同样算出 Γ₃N = 3A₁ + A₂ + 2B₁ + 3B₂。减去平动（A₁ + B₁ + B₂）和转动（A₂ + B₁ + B₂），振动是 2A₁ + B₂：两个对称振动，一个反对称伸缩。',
            'In the same way Γ₃N = 3A₁ + A₂ + 2B₁ + 3B₂. Removing translations (A₁ + B₁ + B₂) and rotations (A₂ + B₁ + B₂) leaves the vibrations 2A₁ + B₂: two symmetric modes and one antisymmetric stretch.'),
        ],
      },
      {
        id: 'gr-2',
        q: T('p 电子的轨道角动量 l = 1 与自旋 s = ½ 耦合。总角动量量子数 j 可以取哪些值？用逗号隔开。',
          'A p electron has orbital angular momentum l = 1 and spin s = ½. Which values can the total angular momentum quantum number j take? Separate them with commas.'),
        answer: R`\frac{1}{2},\frac{3}{2}`,
        wrong: [
          { a: R`\frac{1}{2},1,\frac{3}{2}`, hint: T('j 从 |l − s| 到 l + s，每次跳 1，不是跳 ½：½ 的下一个是 3/2。', 'j runs from |l − s| to l + s in steps of 1, not ½: after ½ comes 3/2.') },
          { a: R`\frac{3}{2}`, hint: T('l + s 只是最大值；自旋和轨道反平行时 j = |l − s| = ½。', 'l + s is only the largest value; with spin and orbit antiparallel, j = |l − s| = ½.') },
        ],
        hint: T('Clebsch–Gordan 级数：j = |l − s|, |l − s| + 1, …, l + s。', 'The Clebsch–Gordan series: j = |l − s|, |l − s| + 1, …, l + s.'),
        steps: [
          R`j\in\{\,|l-s|,\ \dots,\ l+s\,\}=\left\{\tfrac{1}{2},\ \tfrac{3}{2}\right\}`,
          T('维数核对：(2l + 1)(2s + 1) = 3 × 2 = 6 = 2 + 4。这就是 p 能级的旋轨分裂 ²P₁/₂ 和 ²P₃/₂。',
            'Dimension check: (2l + 1)(2s + 1) = 3 × 2 = 6 = 2 + 4. This is the spin–orbit splitting of a p level into ²P₁/₂ and ²P₃/₂.'),
        ],
      },
    ],
    dg: [
      {
        id: 'dg-1',
        q: T('自旋 ½ 一直处在与磁场同向的本征态（下式）。磁场方向绕 z 轴转一圈，扫出半顶角为 θ 的圆锥。按下式的定义，贝里相位 γ 是多少？',
          'A spin ½ stays in the eigenstate aligned with the magnetic field (below). The field direction goes once around the z axis, sweeping a cone of half-angle θ. With the definition below, what is the Berry phase γ?'),
        tex: R`|\psi\rangle=\begin{pmatrix}\cos\frac{\theta}{2}\\ e^{i\varphi}\sin\frac{\theta}{2}\end{pmatrix},\qquad \gamma=i\oint\langle\psi|\partial_\varphi\psi\rangle\,d\varphi`,
        answer: R`-\pi(1-\cos\theta)`,
        alt: [R`\pi(1+\cos\theta)`],
        vars: { theta: [0.2, 2.9] },
        wrong: [
          { a: R`-2\pi(1-\cos\theta)`, hint: T('这是立体角 Ω 本身；自旋 ½ 的贝里相位是 −Ω/2。', 'That is the solid angle Ω itself; for spin ½ the Berry phase is −Ω/2.') },
          { a: R`\pi(1-\cos\theta)`, hint: T('符号反了：按 γ = i∮⟨ψ|∂ψ⟩，与磁场同向的态得到 −Ω/2；+Ω/2 属于反向的那个本征态。', 'The sign is flipped: with γ = i∮⟨ψ|∂ψ⟩ the state aligned with the field gets −Ω/2; +Ω/2 belongs to the anti-aligned eigenstate.') },
          { a: R`-\pi(1+\cos\theta)`, hint: T('差 2π 后它等于 π(1 − cos θ)：符号反了，与磁场同向的态应得 −Ω/2。', 'Up to 2π this equals π(1 − cos θ): the sign is flipped, since the aligned state gets −Ω/2.') },
        ],
        hint: T('先算 ⟨ψ|∂ψ/∂φ⟩，它不依赖 φ；再乘 2π 和前面的 i。', 'First work out ⟨ψ|∂ψ/∂φ⟩, which does not depend on φ; then multiply by 2π and the i in front.'),
        steps: [
          R`\langle\psi|\partial_\varphi\psi\rangle=i\sin^2\frac{\theta}{2}`,
          R`\gamma=i\cdot i\sin^2\frac{\theta}{2}\cdot2\pi=-2\pi\sin^2\frac{\theta}{2}=-\pi(1-\cos\theta)`,
          T('也就是 −Ω/2，Ω = 2π(1 − cos θ) 是圆锥对球心张的立体角。贝里相位只确定到 2π 的整数倍，所以 π(1 + cos θ) 也算对。',
            'That is −Ω/2, where Ω = 2π(1 − cos θ) is the solid angle of the cone. A Berry phase is only defined up to multiples of 2π, so π(1 + cos θ) also counts as correct.'),
        ],
      },
      {
        id: 'dg-2',
        q: T('实对称的两态哈密顿量如下，参数 φ 从 0 走到 2π，绕锥形交叉点一圈。把低能本征矢连续地跟着走，回到起点时它获得的贝里相位是多少？',
          'A real symmetric two-state Hamiltonian is shown below; the parameter φ goes from 0 to 2π, once around the conical intersection. Following the lower eigenvector continuously, what Berry phase has it picked up when it returns?'),
        tex: R`H(\varphi)=\begin{pmatrix}\cos\varphi&\sin\varphi\\ \sin\varphi&-\cos\varphi\end{pmatrix}`,
        answer: R`\pi`,
        alt: [R`-\pi`],
        wrong: [
          { a: R`0`, hint: T('实矩阵的本征矢可以取成实数，却不能连续地取成单值的：跟着走一圈，它变成了自己的负数，−1 = e^{iπ}。', 'The eigenvectors of a real matrix can be chosen real, but not continuous and single-valued at once: after one loop it has become minus itself, and −1 = e^{iπ}.') },
          { a: R`2\pi`, hint: T('2π 等于没有相位（e^{2πi} = 1）；但跟着走一圈后本征矢变成了 −v，相位是 π。', '2π is no phase at all (e^{2πi} = 1); but after one loop the eigenvector has become −v, a phase of π.') },
        ],
        hint: T('把低能本征矢写成 (−sin(φ/2), cos(φ/2))，看 φ = 2π 时它变成什么。', 'Write the lower eigenvector as (−sin(φ/2), cos(φ/2)) and see what it becomes at φ = 2π.'),
        steps: [
          R`v_-(\varphi)=\begin{pmatrix}-\sin\frac{\varphi}{2}\\ \cos\frac{\varphi}{2}\end{pmatrix},\qquad v_-(2\pi)=-v_-(0)`,
          T('绕一圈本征矢变号，−1 = e^{iπ}，贝里相位是 π（只确定到 2π 的整数倍，写 −π 也对）。这就是 Herzberg 和 Longuet-Higgins 指出的符号变化：绕过锥形交叉点的电子波函数要变号。',
            'One loop flips the sign of the eigenvector, −1 = e^{iπ}, so the Berry phase is π (defined up to multiples of 2π, so −π is also right). This is the sign change pointed out by Herzberg and Longuet-Higgins: the electronic wavefunction changes sign around a conical intersection.'),
        ],
      },
    ],
    pr: [
      {
        id: 'pr-1',
        q: T('W_t 是标准布朗运动（W₀ = 0）。用伊藤公式写出 d(W_t²)，再求期望 E[W_t²]。',
          'W_t is standard Brownian motion (W₀ = 0). Use Itô\'s formula for d(W_t²), then find the expectation E[W_t²].'),
        answer: R`t`,
        vars: { t: '+' },
        wrong: [
          { a: R`0`, hint: T('普通的链式法则给 d(W²) = 2W dW，期望是 0；伊藤公式还多一项 ½ · 2 · dt = dt。', 'The ordinary chain rule gives d(W²) = 2W dW with zero mean; Itô\'s formula adds the term ½ · 2 · dt = dt.') },
          { a: R`t^2`, hint: T('把 dW 当成和 dt 同阶了：实际上 (dW)² = dt，W_t 的典型大小是 √t。', 'That treats dW as if it were of order dt: in fact (dW)² = dt, and W_t is typically of size √t.') },
        ],
        hint: T('伊藤公式：d f(W) = f′(W) dW + ½ f″(W) dt，而伊藤积分 ∫ W dW 的期望是 0。', 'Itô\'s formula: d f(W) = f′(W) dW + ½ f″(W) dt, and the Itô integral ∫ W dW has zero mean.'),
        steps: [
          R`d(W_t^2)=2W_t\,dW_t+dt`,
          R`\mathbb{E}[W_t^2]=2\,\mathbb{E}\!\left[\int_0^t W_s\,dW_s\right]+t=t`,
        ],
      },
      {
        id: 'pr-2',
        q: T('一个量子比特只有退相位，林德布拉德方程如下（跳跃算符 L = √κ σ_z，没有哈密顿量）。非对角元 ρ₀₁(t) 等于 ρ₀₁(0) 乘以什么？',
          'A qubit undergoes pure dephasing, with the Lindblad equation below (jump operator L = √κ σ_z, no Hamiltonian). The off-diagonal element ρ₀₁(t) equals ρ₀₁(0) times what?'),
        tex: R`\dot\rho=\kappa\left(\sigma_z\rho\,\sigma_z-\rho\right)`,
        answer: R`e^{-2\kappa t}`,
        vars: { kappa: '+', t: '+' },
        wrong: [
          { a: R`e^{-\kappa t}`, hint: T('σ_z ρ σ_z 把非对角元变号，所以 κ(σ_z ρ σ_z − ρ) 的非对角元是 −2κρ₀₁，不是 −κρ₀₁。', 'σ_z ρ σ_z flips the sign of the off-diagonal elements, so the off-diagonal part of κ(σ_z ρ σ_z − ρ) is −2κρ₀₁, not −κρ₀₁.') },
          { a: R`1`, hint: T('对角元（布居）不变，非对角元（相干）却会衰减：σ_z ρ σ_z 让它们变号。', 'The diagonal elements (populations) stay fixed, but the off-diagonal ones (coherences) decay: σ_z ρ σ_z flips their sign.') },
        ],
        hint: T('写出非对角元的方程：σ_z ρ σ_z 的 (0, 1) 元等于 −ρ₀₁。', 'Write the equation for the off-diagonal element: the (0, 1) element of σ_z ρ σ_z is −ρ₀₁.'),
        steps: [
          R`(\sigma_z\rho\,\sigma_z)_{01}=-\rho_{01}\ \Rightarrow\ \dot\rho_{01}=-2\kappa\,\rho_{01}`,
          R`\rho_{01}(t)=e^{-2\kappa t}\rho_{01}(0)`,
          T('对角元不变：只有相干衰减，T₂ = 1/(2κ)。', 'The diagonal stays fixed: only the coherence decays, with T₂ = 1/(2κ).'),
        ],
      },
    ],
    na: [
      {
        id: 'na-1',
        q: T('对称矩阵 A 如下。它的 2-范数条件数 κ₂(A) 是多少？',
          'The symmetric matrix A is shown below. What is its 2-norm condition number κ₂(A)?'),
        tex: R`A=\begin{pmatrix}5&4\\ 4&5\end{pmatrix}`,
        answer: R`9`,
        wrong: [
          { a: R`\frac{1}{9}`, hint: T('条件数是最大奇异值除以最小奇异值，总是 ≥ 1。', 'The condition number is the largest singular value over the smallest, so it is always ≥ 1.') },
          { a: R`\frac{5}{4}`, hint: T('要比的是本征值（对称矩阵的奇异值就是本征值的绝对值），不是矩阵元。', 'Compare eigenvalues (for a symmetric matrix the singular values are their absolute values), not matrix entries.') },
          { a: R`3`, hint: T('3 是 Cholesky 因子 L 的条件数，等于 √κ(A)；A 本身是 9。', '3 is the condition number of the Cholesky factor L, which is √κ(A); for A itself it is 9.') },
        ],
        hint: T('对称正定矩阵的 κ₂ = λ_max / λ_min；这个矩阵的本征矢是 (1, 1) 和 (1, −1)。', 'For a symmetric positive definite matrix κ₂ = λ_max / λ_min; the eigenvectors here are (1, 1) and (1, −1).'),
        steps: [
          R`A\begin{pmatrix}1\\1\end{pmatrix}=9\begin{pmatrix}1\\1\end{pmatrix},\qquad A\begin{pmatrix}1\\-1\end{pmatrix}=\begin{pmatrix}1\\-1\end{pmatrix}`,
          R`\kappa_2(A)=\frac{\lambda_{\max}}{\lambda_{\min}}=\frac{9}{1}=9`,
          T('解 Ax = b 时，右端项的相对误差最多被放大 9 倍。', 'Solving Ax = b, a relative error in b is amplified at most 9 times.'),
        ],
      },
      {
        id: 'na-2',
        q: T('某个量用步长 h 算得 a，用 h/2 算得 b，误差是 Ch² + O(h⁴)。理查森外推给出的改进值是多少？用 a、b 表示。',
          'A quantity computed with step h gives a, and with step h/2 gives b; the error is Ch² + O(h⁴). What improved value does Richardson extrapolation give, in terms of a and b?'),
        answer: R`\frac{4b-a}{3}`,
        vars: { a: '+', b: '+' },
        wrong: [
          { a: R`2b-a`, hint: T('2b − a 是误差 ∝ h 时的外推；误差 ∝ h² 时，步长减半误差变成原来的 1/4。', '2b − a is the extrapolation for an error ∝ h; with an error ∝ h², halving the step divides the error by 4.') },
          { a: R`\frac{a+b}{2}`, hint: T('取平均消不掉误差：两个误差同号，大小差 4 倍。', 'Averaging does not cancel the error: both errors have the same sign and differ by a factor of 4.') },
          { a: R`\frac{4a-b}{3}`, hint: T('a 和 b 弄反了：权重 4 要给步长小、更准的 b。', 'a and b are swapped: the weight 4 goes to b, the more accurate value with the smaller step.') },
        ],
        hint: T('设真值为 I：a = I + Ch²，b = I + Ch²/4，消去 C。', 'Let the exact value be I: a = I + Ch², b = I + Ch²/4; eliminate C.'),
        steps: [
          R`a=I+Ch^2,\qquad b=I+\frac{Ch^2}{4}`,
          R`4b-a=3I+O(h^4)\ \Rightarrow\ I\approx\frac{4b-a}{3}`,
        ],
      },
    ],
    var: [
      {
        id: 'var-1',
        q: T('氦原子用两个 1s 轨道（有效核电荷 ζ）的乘积作试探函数，变分能量如下（单位 hartree，Z = 2）。使能量最低的 ζ 是多少？',
          'For helium, take the product of two 1s orbitals with effective nuclear charge ζ as the trial function; the variational energy is below (in hartree, Z = 2). Which ζ gives the lowest energy?'),
        tex: R`E(\zeta)=\zeta^2-2Z\zeta+\frac{5}{8}\zeta`,
        answer: R`\frac{27}{16}`,
        wrong: [
          { a: R`2`, hint: T('ζ = Z 是不考虑两个电子互相屏蔽的结果；求 dE/dζ = 0。', 'ζ = Z ignores how the two electrons screen each other; solve dE/dζ = 0.') },
          { a: R`\frac{27}{8}`, hint: T('dE/dζ = 2ζ − 27/8，零点还要除以 2。', 'dE/dζ = 2ζ − 27/8, so the zero still needs dividing by 2.') },
          { a: R`\frac{5}{16}`, hint: T('5/16 是屏蔽常数 Z − ζ；题目问的是 ζ 本身。', '5/16 is the screening constant Z − ζ; the question asks for ζ itself.') },
        ],
        hint: T('合并同类项：E(ζ) = ζ² − (27/8)ζ，对 ζ 求导令其为零。', 'Collect terms: E(ζ) = ζ² − (27/8)ζ, then set the derivative to zero.'),
        steps: [
          R`E(\zeta)=\zeta^2-\frac{27}{8}\zeta,\qquad \frac{dE}{d\zeta}=2\zeta-\frac{27}{8}=0`,
          R`\zeta^*=\frac{27}{16}=Z-\frac{5}{16},\qquad E(\zeta^*)=-\left(\frac{27}{16}\right)^2\approx-2.848\ E_h`,
          T('精确的非相对论值约为 −2.9037 E_h：变分能量总在它上面，差的部分是电子关联。', 'The exact nonrelativistic value is about −2.9037 E_h: the variational energy always lies above it, and the gap is electron correlation.'),
        ],
      },
      {
        id: 'var-2',
        q: T('一维谐振子 H = −½ d²/dx² + ½ x²（ħ = m = ω = 1），试探函数 ψ = e^{−αx²}（α > 0）。能量期望值 E(α) 是多少？',
          'For the oscillator H = −½ d²/dx² + ½ x² (ħ = m = ω = 1) take the trial function ψ = e^{−αx²} (α > 0). What is the energy expectation E(α)?'),
        answer: R`\frac{\alpha}{2}+\frac{1}{8\alpha}`,
        vars: { alpha: '+' },
        wrong: [
          { a: R`\frac{\alpha}{2}+\frac{1}{4\alpha}`, hint: T('⟨x²⟩ 要用 |ψ|² = e^{−2αx²} 算，等于 1/(4α)，再乘势能前面的 ½：势能是 1/(8α)。', 'Compute ⟨x²⟩ with |ψ|² = e^{−2αx²}, giving 1/(4α), then include the ½ of the potential: ⟨V⟩ = 1/(8α).') },
          { a: R`\alpha+\frac{1}{8\alpha}`, hint: T('⟨p²⟩ = α，动能算符前面还有 ½：⟨T⟩ = α/2。', '⟨p²⟩ = α, and the kinetic operator has a ½ in front: ⟨T⟩ = α/2.') },
        ],
        hint: T('⟨p²⟩ = α，⟨x²⟩ = 1/(4α)（用 |ψ|² = e^{−2αx²} 的高斯积分）。', '⟨p²⟩ = α and ⟨x²⟩ = 1/(4α) (Gaussian integrals with |ψ|² = e^{−2αx²}).'),
        steps: [
          R`\langle T\rangle=\frac{1}{2}\langle p^2\rangle=\frac{\alpha}{2},\qquad \langle V\rangle=\frac{1}{2}\langle x^2\rangle=\frac{1}{8\alpha}`,
          R`E(\alpha)=\frac{\alpha}{2}+\frac{1}{8\alpha}\ \ge\ E\!\left(\tfrac{1}{2}\right)=\frac{1}{2}`,
          T('最小值正好是精确的基态能量 ½，因为 α = ½ 的高斯函数就是真正的基态。', 'The minimum is exactly the true ground-state energy ½, because the Gaussian with α = ½ is the true ground state.'),
        ],
      },
    ],
    oa: [
      {
        id: 'oa-1',
        q: T('量子比特 H = (Δ/2) σ_z（Δ > 0）处在逆温度 β 的热平衡态 ρ = e^{−βH}/Z。⟨σ_z⟩ = Tr(ρ σ_z) 是多少？',
          'A qubit H = (Δ/2) σ_z (Δ > 0) is in the thermal state ρ = e^{−βH}/Z at inverse temperature β. What is ⟨σ_z⟩ = Tr(ρ σ_z)?'),
        answer: R`-\tanh\left(\frac{\beta\Delta}{2}\right)`,
        vars: { beta: '+', Delta: '+' },
        wrong: [
          { a: R`\tanh\left(\frac{\beta\Delta}{2}\right)`, hint: T('看符号：σ_z = +1 的态能量是 +Δ/2，更高，布居更少，所以 ⟨σ_z⟩ < 0。', 'Check the sign: the σ_z = +1 state has energy +Δ/2, which is higher and less populated, so ⟨σ_z⟩ < 0.') },
          { a: R`-\tanh(\beta\Delta)`, hint: T('两个能级相差 Δ，但各自是 ±Δ/2：指数里是 βΔ/2。', 'The levels are Δ apart but sit at ±Δ/2: the exponent is βΔ/2.') },
        ],
        hint: T('两个能级是 ±Δ/2，Z = 2 cosh(βΔ/2)。', 'The two levels are ±Δ/2, and Z = 2 cosh(βΔ/2).'),
        steps: [
          R`Z=e^{-\beta\Delta/2}+e^{\beta\Delta/2}=2\cosh\frac{\beta\Delta}{2}`,
          R`\langle\sigma_z\rangle=\frac{e^{-\beta\Delta/2}-e^{\beta\Delta/2}}{Z}=-\tanh\frac{\beta\Delta}{2}`,
          T('高温（β → 0）时趋于 0，低温时趋于 −1（全在下能级）。这个 Gibbs 态就是该动力学的 KMS 态。', 'At high temperature (β → 0) it goes to 0, at low temperature to −1 (all in the lower level). This Gibbs state is the KMS state of the dynamics.'),
        ],
      },
      {
        id: 'oa-2',
        q: T('矩阵 N 如下。它的算子范数 ‖N‖ 是多少？',
          'The matrix N is shown below. What is its operator norm ‖N‖?'),
        tex: R`N=\begin{pmatrix}0&2\\ 0&0\end{pmatrix}`,
        answer: R`2`,
        wrong: [
          { a: R`0`, hint: T('0 是谱半径（本征值都是 0）；不正规的矩阵，范数可以远大于谱半径。', '0 is the spectral radius (all eigenvalues are 0); for a non-normal matrix the norm can be far larger than the spectral radius.') },
          { a: R`4`, hint: T('4 是 N*N 的最大本征值，还要开方：‖N‖ = ‖N*N‖^{1/2}（C* 恒等式）。', '4 is the largest eigenvalue of N*N; take the square root: ‖N‖ = ‖N*N‖^{1/2} (the C* identity).') },
        ],
        hint: T('用 C* 恒等式 ‖N*N‖ = ‖N‖²。', 'Use the C* identity ‖N*N‖ = ‖N‖².'),
        steps: [
          R`N^*N=\begin{pmatrix}0&0\\ 0&4\end{pmatrix}`,
          R`\|N\|=\sqrt{\|N^*N\|}=2,\qquad \sigma(N)=\{0\}`,
        ],
      },
    ],
    tn: [
      {
        id: 'tn-1',
        q: T('两比特态 |ψ⟩ = √p |00⟩ + √(1 − p) |11⟩（0 < p < 1）。用自然对数，纠缠熵 S = −Tr ρ_A ln ρ_A 是多少？',
          'For the two-qubit state |ψ⟩ = √p |00⟩ + √(1 − p) |11⟩ (0 < p < 1), what is the entanglement entropy S = −Tr ρ_A ln ρ_A, with natural logarithms?'),
        answer: R`-p\ln p-(1-p)\ln(1-p)`,
        vars: { p: [0.05, 0.95] },
        wrong: [
          { a: R`-\sqrt{p}\ln\sqrt{p}-\sqrt{1-p}\ln\sqrt{1-p}`, hint: T('熵要用 ρ_A 的本征值，也就是 Schmidt 系数的平方 p 和 1 − p，不是系数 √p 本身。', 'The entropy uses the eigenvalues of ρ_A, the squared Schmidt coefficients p and 1 − p, not the coefficients √p themselves.') },
          { a: R`-p\ln p`, hint: T('漏了第二个本征值 1 − p 的那一项。', 'The term for the second eigenvalue, 1 − p, is missing.') },
          { a: R`\frac{-p\ln p-(1-p)\ln(1-p)}{\ln2}`, hint: T('这是以 2 为底（单位是比特）；题目要的是自然对数。', 'That is in base 2 (bits); the question asks for natural logarithms.') },
        ],
        hint: T('先求约化密度矩阵：ρ_A = Tr_B |ψ⟩⟨ψ| = diag(p, 1 − p)。', 'ρ_A = Tr_B |ψ⟩⟨ψ| = diag(p, 1 − p).'),
        steps: [
          R`\rho_A=\operatorname{Tr}_B|\psi\rangle\langle\psi|=\begin{pmatrix}p&0\\ 0&1-p\end{pmatrix}`,
          R`S=-p\ln p-(1-p)\ln(1-p)`,
          T('p = ½ 时最大，S = ln 2：一个 Bell 对。', 'It is largest at p = ½, where S = ln 2: one Bell pair.'),
        ],
      },
      {
        id: 'tn-2',
        q: T('一次 SVD 截断：Schmidt 系数（奇异值）是 0.8、0.5、0.3、√0.02（已归一化，平方和为 1）。只保留最大的 D = 2 个，舍弃权重（截断误差 ‖ψ − ψ̃‖²）是多少？',
          'An SVD truncation: the Schmidt coefficients (singular values) are 0.8, 0.5, 0.3 and √0.02 (normalised, their squares sum to 1). Keeping only the largest D = 2, what is the discarded weight (truncation error ‖ψ − ψ̃‖²)?'),
        answer: R`0.11`,
        wrong: [
          { a: R`0.3+\sqrt{0.02}`, hint: T('舍弃权重是丢掉的奇异值的平方和，不是奇异值之和。', 'The discarded weight is the sum of the squares of the dropped singular values, not their sum.') },
          { a: R`0.89`, hint: T('0.89 是保留下来的权重；截断误差是 1 − 0.89。', '0.89 is the weight that is kept; the truncation error is 1 − 0.89.') },
          { a: R`0.02`, hint: T('D = 2 保留两个，要丢掉 0.3 和 √0.02 两个，不只是最小的那个。', 'D = 2 keeps two, so both 0.3 and √0.02 are dropped, not just the smallest.') },
        ],
        hint: T('保留 0.8 和 0.5，舍弃 0.3 和 √0.02，把舍弃的平方加起来。', 'Keep 0.8 and 0.5, drop 0.3 and √0.02, and add up the squares of the dropped ones.'),
        steps: [
          R`\varepsilon=\sum_{k>D}s_k^2=0.3^2+0.02=0.11`,
          T('DMRG 每一步报告的截断误差（truncation error）就是这个数；保留的权重是 0.64 + 0.25 = 0.89。', 'This is the truncation error that DMRG reports at every step; the kept weight is 0.64 + 0.25 = 0.89.'),
        ],
      },
    ],
    mt: [
      {
        id: 'mt-1',
        q: T('用控制收敛定理求下面的极限。',
          'Use the dominated convergence theorem to find the limit below.'),
        tex: R`\lim_{n\to\infty}\int_0^\infty\frac{n\sin(x/n)}{x\,(1+x^2)}\,dx`,
        answer: R`\frac{\pi}{2}`,
        wrong: [
          { a: R`0`, hint: T('sin(x/n) → 0，但前面乘了 n：n sin(x/n) → x，不是 0。', 'sin(x/n) → 0, but it is multiplied by n: n sin(x/n) → x, not 0.') },
          { a: R`\pi`, hint: T('∫ dx/(1 + x²) 从 −∞ 积到 ∞ 才是 π；这里从 0 积起，是 π/2。', '∫ dx/(1 + x²) is π only from −∞ to ∞; starting at 0 it is π/2.') },
        ],
        hint: T('先求被积函数的逐点极限，再用 |n sin(x/n)| ≤ x 找控制函数。', 'Find the pointwise limit of the integrand first, then use |n sin(x/n)| ≤ x for a dominating function.'),
        steps: [
          R`\frac{n\sin(x/n)}{x(1+x^2)}\ \longrightarrow\ \frac{1}{1+x^2},\qquad \left|\frac{n\sin(x/n)}{x(1+x^2)}\right|\le\frac{1}{1+x^2}`,
          R`\lim_{n\to\infty}\int_0^\infty\frac{n\sin(x/n)}{x(1+x^2)}\,dx=\int_0^\infty\frac{dx}{1+x^2}=\frac{\pi}{2}`,
        ],
      },
      {
        id: 'mt-2',
        q: T('f(x) = x^{−a}（a > 0）定义在区间 (0, 1) 上。a 小于多少时 f ∈ L²(0, 1)？写出这个临界值。',
          'f(x) = x^{−a} (a > 0) on the interval (0, 1). Below which value of a is f in L²(0, 1)? Give the critical value.'),
        answer: R`\frac{1}{2}`,
        wrong: [
          { a: R`1`, hint: T('a < 1 是 f ∈ L¹ 的条件；L² 看的是 |f|² = x^{−2a}，要 2a < 1。', 'a < 1 is the condition for f ∈ L¹; L² looks at |f|² = x^{−2a}, which needs 2a < 1.') },
          { a: R`0`, hint: T('L² 函数不必有界：x^{−1/4} 在 0 处发散，平方却可积。', 'An L² function need not be bounded: x^{−1/4} blows up at 0, yet its square is integrable.') },
        ],
        hint: T('∫₀¹ x^{−2a} dx 在 2a < 1 时收敛。', '∫₀¹ x^{−2a} dx converges when 2a < 1.'),
        steps: [
          R`\int_0^1 x^{-2a}\,dx=\frac{1}{1-2a}\quad(2a<1)`,
          T('所以临界值是 a = ½。量子力学里判断在原点发散的波函数是否平方可积（三维要带上体积元 r² dr），用的就是这种比较。', 'So the critical value is a = ½. Deciding whether a wavefunction that diverges at the origin is square-integrable in quantum mechanics (in 3D with the volume element r² dr) uses exactly this comparison.'),
        ],
      },
    ],
  };

  // 题面和解答里的公式交给 tools/fundamental-math.mjs 转成 MathML：题号 → 题面公式，题号:k → 第 k 步
  const math = {};
  for (const list of Object.values(items)) {
    for (const q of list) {
      if (q.tex) math[q.id] = [q.tex, true];
      q.steps.forEach((s, k) => { if (typeof s === 'string') math[`${q.id}:${k}`] = [s, true]; });
    }
  }

  window.MOLASTRIA_FM_QUIZ = { checked: '2026-11-10', items, math };
})();
