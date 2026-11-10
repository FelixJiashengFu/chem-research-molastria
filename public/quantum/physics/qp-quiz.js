/* 量子嘉年华 · 量子物理 · 动手算一算：每章两三道写公式作答的题，由 ../../viewer/formula-check.js 判分。
   格式和 ../../fundamental-science/math/fm-quiz.js 一样：q 题面（中英），tex 题面下的公式（可选），answer 标准答案（LaTeX，顶层逗号分开的是不计顺序的多个值），
   alt 其他算对的写法，vars 答案里的变量和取样范围（'int' 正整数，[lo, hi] 实数区间，'+' 正实数），defs 可以换着用的量（如 h = 2πħ），
   wrong 常见错误（1–3 个，各带针对性的提示），hint 错两次后的总提示，steps 解答（中英文字或 LaTeX）。
   每个答案和每个常见错误都手算过，并由 tools/formula-check-test.mjs 独立地数值核对。
   公式由 tools/fundamental-math.mjs 转成 MathML，结果在 qp-quiz-math.js（生成的文件，不要手改）。 */
(() => {
  'use strict';
  const T = (zh, en) => ({ zh, en });
  const R = String.raw;
  const H = { h: R`2\pi\hbar` }; // 用 h 或 ħ 写都算对

  const items = {
    birth: [
      {
        id: 'birth-1',
        q: T('光子被静止的自由电子散射（康普顿效应）。散射后波长的增加量 Δλ 最大是多少？用 h、m_e、c 表示。',
          'A photon scatters off a free electron at rest (the Compton effect). What is the largest possible increase Δλ of its wavelength, in terms of h, m_e and c?'),
        answer: R`\frac{2h}{m_ec}`,
        vars: { h: '+', m_e: '+', c: '+' },
        defs: { hbar: R`\frac{h}{2\pi}` },
        wrong: [
          { a: R`\frac{h}{m_ec}`, hint: T('h/(m_e c) 是康普顿波长，对应 θ = 90°；背向散射 θ = 180° 时 1 − cos θ = 2。', 'h/(m_e c) is the Compton wavelength, reached at θ = 90°; for back-scattering, θ = 180°, 1 − cos θ = 2.') },
          { a: R`\frac{2h}{m_ec^2}`, hint: T('量纲不对：h/(m_e c²) 的单位是秒，不是长度。', 'The units are off: h/(m_e c²) is a time, not a length.') },
        ],
        hint: T('Δλ = (h/m_e c)(1 − cos θ)，看 θ 取多少时它最大。', 'Δλ = (h/m_e c)(1 − cos θ); which θ makes it largest?'),
        steps: [
          R`\Delta\lambda=\frac{h}{m_ec}(1-\cos\theta)`,
          R`\Delta\lambda_{\max}=\frac{2h}{m_ec}\approx4.85\ \text{pm}\qquad(\theta=\pi)`,
        ],
      },
      {
        id: 'birth-2',
        q: T('氢原子的能级 E_n = −R_y/n²（R_y ≈ 13.6 eV）。电子从 n = 3 跃迁到 n = 2，放出的光子能量是多少？用 R_y 表示。',
          'The hydrogen levels are E_n = −R_y/n² (R_y ≈ 13.6 eV). When the electron drops from n = 3 to n = 2, what is the energy of the emitted photon, in terms of R_y?'),
        answer: R`\frac{5}{36}R_y`,
        vars: { R_y: '+' },
        wrong: [
          { a: R`\frac{1}{6}R_y`, hint: T('能级正比于 1/n²，不是 1/n：要算 1/4 − 1/9，不是 1/2 − 1/3。', 'The levels go as 1/n², not 1/n: compute 1/4 − 1/9, not 1/2 − 1/3.') },
          { a: R`\frac{13}{36}R_y`, hint: T('光子带走的是两个能级之差，不是和：1/4 − 1/9。', 'The photon carries the difference of the two levels, not their sum: 1/4 − 1/9.') },
          { a: R`-\frac{5}{36}R_y`, hint: T('E₂ − E₃ 是负的（电子能量降低），光子的能量取正值 E₃ − E₂。', 'E₂ − E₃ is negative (the electron loses energy); the photon energy is the positive E₃ − E₂.') },
        ],
        hint: T('光子能量等于 E₃ − E₂ = R_y(1/4 − 1/9)。', 'E₃ − E₂ = R_y(1/4 − 1/9).'),
        steps: [
          R`E_3-E_2=R_y\left(\frac{1}{2^2}-\frac{1}{3^2}\right)=\frac{5}{36}R_y\approx1.89\ \text{eV}`,
          T('对应的波长约 656 nm，是巴耳末系的 Hα 红线。', 'The wavelength is about 656 nm: the red Hα line of the Balmer series.'),
        ],
      },
    ],
    wave: [
      {
        id: 'wave-1',
        q: T('质量 m 的粒子在宽度 L 的一维无限深势阱里（0 < x < L）。第 n 个能级 E_n 是多少？',
          'A particle of mass m is in a one-dimensional infinite well of width L (0 < x < L). What is the n-th energy level E_n?'),
        answer: R`\frac{n^2\pi^2\hbar^2}{2mL^2}`,
        vars: { n: 'int', hbar: '+', m: '+', L: '+' },
        defs: H,
        wrong: [
          { a: R`\frac{n^2\pi^2\hbar^2}{8mL^2}`, hint: T('n²h²/(8mL²) 里用的是 h；换成 ħ 时 h² = 4π²ħ²，分母变成 2mL²。', 'n²h²/(8mL²) uses h; in terms of ħ, h² = 4π²ħ², so the denominator becomes 2mL².') },
          { a: R`\frac{n^2\pi^2\hbar^2}{mL^2}`, hint: T('动能是 p²/(2m)，别漏了 2。', 'The kinetic energy is p²/(2m); do not drop the 2.') },
          { a: R`\frac{n^2\hbar^2}{2mL^2}`, hint: T('k_n = nπ/L，平方后有 π²。', 'k_n = nπ/L, so squaring gives a π².') },
        ],
        hint: T('边界条件 ψ(0) = ψ(L) = 0 给出 k = nπ/L，能量 E = ħ²k²/(2m)。', 'The boundary conditions ψ(0) = ψ(L) = 0 give k = nπ/L, and E = ħ²k²/(2m).'),
        steps: [
          R`\psi_n(x)\propto\sin\frac{n\pi x}{L},\qquad k_n=\frac{n\pi}{L}`,
          R`E_n=\frac{\hbar^2k_n^2}{2m}=\frac{n^2\pi^2\hbar^2}{2mL^2}=\frac{n^2h^2}{8mL^2}`,
        ],
      },
      {
        id: 'wave-2',
        q: T('同一个势阱的本征函数 ψ_n(x) = A sin(nπx/L)。取 A > 0，归一化常数 A 是多少？',
          'The eigenfunctions of the same well are ψ_n(x) = A sin(nπx/L). Taking A > 0, what is the normalisation constant A?'),
        answer: R`\sqrt{\frac{2}{L}}`,
        vars: { L: '+' },
        wrong: [
          { a: R`\frac{2}{L}`, hint: T('算出来的是 A² = 2/L，还要开方。', 'What you found is A² = 2/L; take the square root.') },
          { a: R`\frac{1}{\sqrt{L}}`, hint: T('sin² 在阱里的平均值是 ½，不是 1：∫₀ᴸ sin²(nπx/L) dx = L/2。', 'The average of sin² across the well is ½, not 1: ∫₀ᴸ sin²(nπx/L) dx = L/2.') },
        ],
        hint: T('要用到积分 ∫₀ᴸ sin²(nπx/L) dx = L/2。', '∫₀ᴸ sin²(nπx/L) dx = L/2.'),
        steps: [
          R`\int_0^L A^2\sin^2\frac{n\pi x}{L}\,dx=\frac{A^2L}{2}=1`,
          R`A=\sqrt{\frac{2}{L}}`,
        ],
      },
    ],
    ops: [
      {
        id: 'ops-1',
        q: T('质量 m、频率 ω 的谐振子处在基态 |0⟩。⟨x²⟩ 是多少？',
          'A harmonic oscillator of mass m and frequency ω is in its ground state |0⟩. What is ⟨x²⟩?'),
        answer: R`\frac{\hbar}{2m\omega}`,
        vars: { hbar: '+', m: '+', omega: '+' },
        wrong: [
          { a: R`\frac{\hbar}{m\omega}`, hint: T('x = √(ħ/2mω)(a + a†)，系数里有一个 2。', 'x = √(ħ/2mω)(a + a†): there is a 2 in the prefactor.') },
          { a: R`0`, hint: T('⟨x⟩ = 0 不代表 ⟨x²⟩ = 0：基态有零点涨落。', '⟨x⟩ = 0 does not make ⟨x²⟩ = 0: the ground state has zero-point fluctuations.') },
          { a: R`\frac{\hbar\omega}{2}`, hint: T('ħω/2 是基态能量；题目问的是 ⟨x²⟩，量纲是长度的平方。', 'ħω/2 is the ground-state energy; the question asks for ⟨x²⟩, a length squared.') },
        ],
        hint: T('用 x = √(ħ/2mω)(a + a†) 和 a|0⟩ = 0。', 'Use x = √(ħ/2mω)(a + a†) and a|0⟩ = 0.'),
        steps: [
          R`x=\sqrt{\frac{\hbar}{2m\omega}}\left(a+a^\dagger\right)`,
          R`\langle0|x^2|0\rangle=\frac{\hbar}{2m\omega}\langle0|a\,a^\dagger|0\rangle=\frac{\hbar}{2m\omega}`,
          T('也可以用位力定理：⟨V⟩ = ½mω²⟨x²⟩ = E₀/2 = ħω/4。', 'Or use the virial theorem: ⟨V⟩ = ½mω²⟨x²⟩ = E₀/2 = ħω/4.'),
        ],
      },
      {
        id: 'ops-2',
        q: T('已知 [x, p] = iħ。对易子 [x, p²] 是多少？',
          'Given [x, p] = iħ, what is the commutator [x, p²]?'),
        answer: R`2i\hbar p`,
        vars: { hbar: '+', p: '+' },
        wrong: [
          { a: R`0`, hint: T('x 和 p 不对易：[x, p²] = [x, p]p + p[x, p]。', 'x and p do not commute: [x, p²] = [x, p]p + p[x, p].') },
          { a: R`i\hbar p`, hint: T('两项各给一个 iħp：[x, p]p + p[x, p] = 2iħp。', 'Each of the two terms gives iħp: [x, p]p + p[x, p] = 2iħp.') },
          { a: R`2\hbar p`, hint: T('[x, p] = iħ，别丢了 i：两个厄米算符的对易子是反厄米的。', '[x, p] = iħ, so keep the i: the commutator of two Hermitian operators is anti-Hermitian.') },
        ],
        hint: T('用 [A, BC] = [A, B]C + B[A, C]。', 'Use [A, BC] = [A, B]C + B[A, C].'),
        steps: [
          R`[x,p^2]=[x,p]\,p+p\,[x,p]=2i\hbar\,p`,
          T('一般地 [x, f(p)] = iħ f′(p)。', 'In general [x, f(p)] = iħ f′(p).'),
        ],
      },
    ],
    ang: [
      {
        id: 'ang-1',
        q: T('d 轨道（l = 2）上的电子，L² 的本征值是多少？',
          'For an electron in a d orbital (l = 2), what is the eigenvalue of L²?'),
        answer: R`6\hbar^2`,
        vars: { hbar: '+' },
        wrong: [
          { a: R`4\hbar^2`, hint: T('L² 的本征值是 l(l + 1)ħ²，不是 l²ħ²。', 'The eigenvalue of L² is l(l + 1)ħ², not l²ħ².') },
          { a: R`6\hbar`, hint: T('L² 的单位是 ħ²。', 'L² comes in units of ħ².') },
          { a: R`2\hbar`, hint: T('2ħ 是 L_z 的最大值 mħ；L² 是 l(l + 1)ħ²。', '2ħ is the largest value of L_z, mħ; L² is l(l + 1)ħ².') },
        ],
        hint: T('球谐函数满足 L² Y_lm = l(l + 1)ħ² Y_lm。', 'L² Y_lm = l(l + 1)ħ² Y_lm.'),
        steps: [
          R`L^2\,Y_{2m}=2(2+1)\hbar^2\,Y_{2m}=6\hbar^2\,Y_{2m}`,
          T('|L| = √6 ħ ≈ 2.45ħ，比 L_z 的最大值 2ħ 大：角动量不能完全指向 z 轴。', '|L| = √6 ħ ≈ 2.45ħ, more than the largest L_z of 2ħ: the angular momentum can never point exactly along z.'),
        ],
      },
      {
        id: 'ang-2',
        q: T('氢原子基态 ψ₁ₛ = e^{−r/a₀}/√(πa₀³)。电子到原子核的平均距离 ⟨r⟩ 是多少？',
          'The hydrogen ground state is ψ₁ₛ = e^{−r/a₀}/√(πa₀³). What is the mean distance ⟨r⟩ of the electron from the nucleus?'),
        answer: R`\frac{3}{2}a_0`,
        vars: { a_0: '+' },
        wrong: [
          { a: R`a_0`, hint: T('a₀ 是最概然半径（r²|ψ|² 的峰值）；平均值要更大一些。', 'a₀ is the most probable radius (the peak of r²|ψ|²); the mean is somewhat larger.') },
          { a: R`\frac{a_0}{2}`, hint: T('径向积分要带上体积元 r²：⟨r⟩ = ∫ r |ψ|² 4πr² dr。', 'The radial integral needs the volume element r²: ⟨r⟩ = ∫ r |ψ|² 4πr² dr.') },
        ],
        hint: T('⟨r⟩ = (4/a₀³) ∫₀^∞ r³ e^{−2r/a₀} dr，再用 ∫₀^∞ rⁿ e^{−βr} dr = n!/β^{n+1}。', '⟨r⟩ = (4/a₀³) ∫₀^∞ r³ e^{−2r/a₀} dr; then use ∫₀^∞ rⁿ e^{−βr} dr = n!/β^{n+1}.'),
        steps: [
          R`\langle r\rangle=\frac{4}{a_0^3}\int_0^\infty r^3e^{-2r/a_0}\,dr=\frac{4}{a_0^3}\cdot\frac{3!}{(2/a_0)^4}=\frac{3}{2}a_0`,
        ],
      },
      {
        id: 'ang-3',
        q: T('不计自旋，氢原子主量子数为 n 的能级简并度是多少？',
          'Ignoring spin, what is the degeneracy of the hydrogen level with principal quantum number n?'),
        answer: R`n^2`,
        vars: { n: 'int' },
        wrong: [
          { a: R`2n^2`, hint: T('2n² 把自旋也算进去了；题目不计自旋。', '2n² includes spin; the question leaves spin out.') },
          { a: R`2n-1`, hint: T('2n − 1 只是 l = n − 1 一个子壳层的 2l + 1；还要对 l = 0, …, n − 1 求和。', '2n − 1 is 2l + 1 for the single subshell l = n − 1; you still need to sum over l = 0, …, n − 1.') },
          { a: R`n`, hint: T('n 只数了 l 的个数；每个 l 还有 2l + 1 个 m。', 'n only counts the values of l; each l has 2l + 1 values of m.') },
        ],
        hint: T('l = 0, 1, …, n − 1，每个 l 有 2l + 1 个 m。', 'l = 0, 1, …, n − 1, and each l has 2l + 1 values of m.'),
        steps: [
          R`\sum_{l=0}^{n-1}(2l+1)=n^2`,
          T('能量只依赖 n 而不依赖 l，是库仑势特有的“偶然”简并，背后是 SO(4) 对称性；多电子原子里它被打破。', 'The energy depends on n but not on l: an "accidental" degeneracy special to the Coulomb potential, rooted in an SO(4) symmetry, and broken in many-electron atoms.'),
        ],
      },
    ],
    approx: [
      {
        id: 'approx-1',
        q: T('质量 m、频率 ω 的谐振子基态加上微扰 H′ = λx⁴。一阶能量修正 E⁽¹⁾ 是多少？',
          'A perturbation H′ = λx⁴ is added to a harmonic oscillator of mass m and frequency ω in its ground state. What is the first-order energy correction E⁽¹⁾?'),
        answer: R`\frac{3\lambda\hbar^2}{4m^2\omega^2}`,
        vars: { lambda: '+', hbar: '+', m: '+', omega: '+' },
        wrong: [
          { a: R`\frac{\lambda\hbar^2}{4m^2\omega^2}`, hint: T('⟨x⁴⟩ 不是 ⟨x²⟩²：高斯分布的四阶矩是 3σ⁴。', '⟨x⁴⟩ is not ⟨x²⟩²: the fourth moment of a Gaussian is 3σ⁴.') },
          { a: R`\frac{3\lambda\hbar^2}{m^2\omega^2}`, hint: T('σ² = ħ/(2mω)，平方后分母是 4m²ω²。', 'σ² = ħ/(2mω), so squaring it puts 4m²ω² in the denominator.') },
        ],
        hint: T('基态的位置分布是方差 σ² = ħ/(2mω) 的高斯分布，而高斯分布的 ⟨x⁴⟩ = 3σ⁴。', 'In the ground state x is Gaussian with variance σ² = ħ/(2mω), and a Gaussian has ⟨x⁴⟩ = 3σ⁴.'),
        steps: [
          R`E^{(1)}=\lambda\langle0|x^4|0\rangle=3\lambda\left(\frac{\hbar}{2m\omega}\right)^2=\frac{3\lambda\hbar^2}{4m^2\omega^2}`,
        ],
      },
      {
        id: 'approx-2',
        q: T('H₀ = diag(0, Δ)（Δ > 0），微扰 V 只有非对角元 v（实数）。较低能级的二阶能量修正是多少？',
          'H₀ = diag(0, Δ) (Δ > 0) and the perturbation V has only the off-diagonal element v (real). What is the second-order energy correction of the lower level?'),
        answer: R`-\frac{v^2}{\Delta}`,
        vars: { v: '+', Delta: '+' },
        wrong: [
          { a: R`\frac{v^2}{\Delta}`, hint: T('二阶修正的分母是 E₀ − E₁ = −Δ < 0：基态总是被往下推。', 'The second-order denominator is E₀ − E₁ = −Δ < 0: the ground state is always pushed down.') },
          { a: R`0`, hint: T('一阶修正 ⟨0|V|0⟩ = 0，但二阶修正不是零。', 'The first-order correction ⟨0|V|0⟩ is zero, but the second-order one is not.') },
          { a: R`-\frac{v}{\Delta}`, hint: T('二阶修正里是 |V₁₀|²，要平方；结果的量纲也应该是能量。', 'The second-order term has |V₁₀|², squared; the result must also have units of energy.') },
        ],
        hint: T('二阶微扰公式：E⁽²⁾ = Σ_k |⟨k|V|0⟩|² / (E₀ − E_k)。', 'E⁽²⁾ = Σ_k |⟨k|V|0⟩|² / (E₀ − E_k).'),
        steps: [
          R`E_0^{(2)}=\frac{|\langle1|V|0\rangle|^2}{E_0-E_1}=-\frac{v^2}{\Delta}`,
          T('精确解 (Δ − √(Δ² + 4v²))/2 展开到 v² 正是这个结果。', 'Expanding the exact result (Δ − √(Δ² + 4v²))/2 to order v² gives exactly this.'),
        ],
      },
    ],
    ident: [
      {
        id: 'ident-1',
        q: T('两个不相互作用、无自旋的全同费米子（质量 m）在宽度 L 的一维无限深势阱里。体系的基态能量是多少？',
          'Two non-interacting, spinless identical fermions of mass m are in a one-dimensional infinite well of width L. What is the ground-state energy of the system?'),
        answer: R`\frac{5\pi^2\hbar^2}{2mL^2}`,
        vars: { hbar: '+', m: '+', L: '+' },
        defs: H,
        wrong: [
          { a: R`\frac{\pi^2\hbar^2}{mL^2}`, hint: T('两个全同费米子不能都在 n = 1（泡利原理）：第二个只能去 n = 2。', 'Two identical fermions cannot both sit in n = 1 (Pauli principle): the second has to go to n = 2.') },
          { a: R`\frac{2\pi^2\hbar^2}{mL^2}`, hint: T('这只是 n = 2 那个粒子的能量 4E₁，还要加上 n = 1 的 E₁。', 'That is only the energy 4E₁ of the particle in n = 2; add the E₁ of the one in n = 1.') },
        ],
        hint: T('E_n = n²E₁，E₁ = π²ħ²/(2mL²)；两个费米子占据两个不同的能级。', 'E_n = n²E₁ with E₁ = π²ħ²/(2mL²); the two fermions occupy two different levels.'),
        steps: [
          R`E=E_1+E_2=(1^2+2^2)\frac{\pi^2\hbar^2}{2mL^2}=\frac{5\pi^2\hbar^2}{2mL^2}`,
          T('如果是玻色子，两个都可以在 n = 1，能量是 2E₁ = π²ħ²/(mL²)。', 'Two bosons could both be in n = 1, with energy 2E₁ = π²ħ²/(mL²).'),
        ],
      },
      {
        id: 'ident-2',
        q: T('费米–狄拉克分布如下。在 ε − μ = k_B T ln 3 处，占据数 f 是多少？',
          'The Fermi–Dirac distribution is below. What is the occupation f at ε − μ = k_B T ln 3?'),
        tex: R`f(\varepsilon)=\frac{1}{e^{(\varepsilon-\mu)/k_BT}+1}`,
        answer: R`\frac{1}{4}`,
        wrong: [
          { a: R`\frac{1}{2}`, hint: T('½ 是 ε = μ 处的费米分布，也是玻色–爱因斯坦分布 1/(e^x − 1) 在这里的值；费米–狄拉克是 1/(e^x + 1)，e^x = 3。', '½ is the Fermi distribution at ε = μ, and also the Bose–Einstein value 1/(e^x − 1) here; Fermi–Dirac is 1/(e^x + 1) with e^x = 3.') },
          { a: R`\frac{1}{3}`, hint: T('1/3 是玻尔兹曼因子 e^{−(ε−μ)/k_B T}；费米–狄拉克分布的分母还有 +1。', '1/3 is the Boltzmann factor e^{−(ε−μ)/k_B T}; the Fermi–Dirac denominator also has a +1.') },
        ],
        hint: T('代入后指数是 e^{ln 3} = 3。', 'e^{ln 3} = 3.'),
        steps: [
          R`f=\frac{1}{e^{\ln3}+1}=\frac{1}{3+1}=\frac{1}{4}`,
        ],
      },
    ],
    ent: [
      {
        id: 'ent-1',
        q: T('CHSH 组合如下，每个测量结果取 ±1。量子力学允许的 |S| 最大是多少？',
          'The CHSH combination is below, and every measurement outcome is ±1. What is the largest |S| quantum mechanics allows?'),
        tex: R`S=\langle A_1B_1\rangle+\langle A_1B_2\rangle+\langle A_2B_1\rangle-\langle A_2B_2\rangle`,
        answer: R`2\sqrt{2}`,
        wrong: [
          { a: R`2`, hint: T('2 是局域隐变量理论（经典）的上限；量子力学可以超过它。', '2 is the bound for local hidden variables (classical); quantum mechanics can exceed it.') },
          { a: R`4`, hint: T('4 是代数上的最大值（每项 ±1）；要超越量子力学的“PR 盒”才能达到。', '4 is the algebraic maximum (each term ±1); reaching it needs a "PR box" beyond quantum mechanics.') },
        ],
        hint: T('取 |Φ⁺⟩，A 的两个测量方向相差 90°，B 的两个方向放在它们中间，各差 45°。', 'Take |Φ⁺⟩, with A\'s two measurement directions 90° apart and B\'s two directions in between, 45° from each.'),
        steps: [
          R`E(a,b)=\cos(\theta_a-\theta_b)\quad\text{for }|\Phi^+\rangle,\qquad \theta_{A_1}=0,\ \theta_{A_2}=\tfrac{\pi}{2},\ \theta_{B_1}=\tfrac{\pi}{4},\ \theta_{B_2}=-\tfrac{\pi}{4}`,
          R`S=3\cos\frac{\pi}{4}-\cos\frac{3\pi}{4}=2\sqrt{2}`,
          T('这就是 Tsirelson 上限（1980）：经典 ≤ 2 < 2√2 ≤ 4。', 'This is the Tsirelson bound (1980): classical ≤ 2 < 2√2 ≤ 4.'),
        ],
      },
      {
        id: 'ent-2',
        q: T('两比特态 |ψ⟩ = cos θ |00⟩ + sin θ |11⟩（0 < θ < π/2）。约化密度矩阵 ρ_A 的两个本征值是什么？用逗号隔开。',
          'For the two-qubit state |ψ⟩ = cos θ |00⟩ + sin θ |11⟩ (0 < θ < π/2), what are the two eigenvalues of the reduced density matrix ρ_A? Separate them with a comma.'),
        answer: R`\cos^2\theta,\sin^2\theta`,
        vars: { theta: [0.1, 1.4] },
        wrong: [
          { a: R`\cos\theta,\sin\theta`, hint: T('Schmidt 系数是 cos θ 和 sin θ，ρ_A 的本征值是它们的平方。', 'The Schmidt coefficients are cos θ and sin θ; the eigenvalues of ρ_A are their squares.') },
          { a: R`1,0`, hint: T('这个态是纠缠的，约化态是混合态，不是纯态。', 'This state is entangled, so the reduced state is mixed, not pure.') },
        ],
        hint: T('ρ_A = Tr_B |ψ⟩⟨ψ|：交叉项 |00⟩⟨11| 在求偏迹时消失。', 'ρ_A = Tr_B |ψ⟩⟨ψ|: the cross term |00⟩⟨11| disappears in the partial trace.'),
        steps: [
          R`\rho_A=\cos^2\theta\,|0\rangle\langle0|+\sin^2\theta\,|1\rangle\langle1|`,
          T('两个本征值之和为 1；θ = π/4 时都是 ½，纠缠最大。', 'The eigenvalues add up to 1; at θ = π/4 both are ½, maximal entanglement.'),
        ],
      },
    ],
    open: [
      {
        id: 'open-1',
        q: T('量子比特 ρ = (I + r·σ)/2，布洛赫矢量的长度 |r| = r。纯度 Tr ρ² 是多少？',
          'A qubit ρ = (I + r·σ)/2 has a Bloch vector of length |r| = r. What is its purity Tr ρ²?'),
        answer: R`\frac{1+r^2}{2}`,
        vars: { r: [0.1, 0.95] },
        wrong: [
          { a: R`\frac{1+r}{2}`, hint: T('那是 ρ 的较大本征值；纯度是两个本征值 (1 ± r)/2 的平方和。', 'That is the larger eigenvalue of ρ; the purity is the sum of the squares of both eigenvalues (1 ± r)/2.') },
          { a: R`r^2`, hint: T('r = 0（完全混合）时纯度是 ½，不是 0。', 'At r = 0 (maximally mixed) the purity is ½, not 0.') },
          { a: R`1`, hint: T('只有 r = 1（在布洛赫球面上）才是纯态，纯度为 1。', 'Only r = 1 (on the Bloch sphere) is a pure state, with purity 1.') },
        ],
        hint: T('泡利矩阵满足 Tr σ_i = 0，Tr(σ_i σ_j) = 2δ_ij。', 'Tr σ_i = 0 and Tr(σ_i σ_j) = 2δ_ij.'),
        steps: [
          R`\operatorname{Tr}\rho^2=\frac{1}{4}\operatorname{Tr}\left(I+2\,\vec r\cdot\vec\sigma+(\vec r\cdot\vec\sigma)^2\right)=\frac{1}{4}\left(2+2r^2\right)=\frac{1+r^2}{2}`,
        ],
      },
      {
        id: 'open-2',
        q: T('相干项按 |ρ₀₁(t)| = |ρ₀₁(0)| e^{−t/T₂} 衰减。经过多长时间降到一半？',
          'A coherence decays as |ρ₀₁(t)| = |ρ₀₁(0)| e^{−t/T₂}. After how long has it fallen to half?'),
        answer: R`T_2\ln2`,
        vars: { T_2: '+' },
        wrong: [
          { a: R`T_2`, hint: T('t = T₂ 时降到 1/e ≈ 0.37，不是一半。', 'At t = T₂ it has fallen to 1/e ≈ 0.37, not half.') },
          { a: R`\frac{T_2}{2}`, hint: T('e^{−t/T₂} = ½ 要取对数：t = T₂ ln 2 ≈ 0.69 T₂。', 'Solving e^{−t/T₂} = ½ needs a logarithm: t = T₂ ln 2 ≈ 0.69 T₂.') },
        ],
        hint: T('解 e^{−t/T₂} = ½。', 'Solve e^{−t/T₂} = ½.'),
        steps: [
          R`e^{-t/T_2}=\frac{1}{2}\ \Rightarrow\ t=T_2\ln2\approx0.693\,T_2`,
        ],
      },
    ],
    scat: [
      {
        id: 'scat-1',
        q: T('低能（ka ≪ 1）粒子被半径 a 的硬球散射。总截面 σ 是多少？',
          'A low-energy particle (ka ≪ 1) scatters off a hard sphere of radius a. What is the total cross-section σ?'),
        answer: R`4\pi a^2`,
        vars: { a: '+' },
        wrong: [
          { a: R`\pi a^2`, hint: T('πa² 是经典的几何截面；低能量子散射只有 s 波，δ₀ = −ka，σ = (4π/k²) sin²δ₀ → 4πa²。', 'πa² is the classical geometric cross-section; low-energy quantum scattering is pure s-wave, δ₀ = −ka, σ = (4π/k²) sin²δ₀ → 4πa².') },
          { a: R`2\pi a^2`, hint: T('2πa² 是高能极限（含衍射峰）的结果；低能时是 4πa²。', '2πa² is the high-energy limit (including the diffraction peak); at low energy it is 4πa².') },
        ],
        hint: T('只有 s 波：δ₀ = −ka，σ = (4π/k²) sin²δ₀。', 'Only the s wave matters: δ₀ = −ka and σ = (4π/k²) sin²δ₀.'),
        steps: [
          R`\delta_0=-ka,\qquad \sigma=\frac{4\pi}{k^2}\sin^2\delta_0\ \xrightarrow{\ ka\to0\ }\ 4\pi a^2`,
          T('是经典几何截面 πa² 的四倍。', 'Four times the classical geometric cross-section πa².'),
        ],
      },
      {
        id: 'scat-2',
        q: T('汤川势 V(r) = V₀ e^{−μr}/r。一阶玻恩近似下的散射振幅 f(q) 是多少？q 是动量转移的大小，粒子质量 m。',
          'For the Yukawa potential V(r) = V₀ e^{−μr}/r, what is the scattering amplitude f(q) in the first Born approximation? q is the magnitude of the momentum transfer and m the particle mass.'),
        answer: R`-\frac{2mV_0}{\hbar^2(\mu^2+q^2)}`,
        vars: { m: '+', V_0: '+', hbar: '+', mu: '+', q: '+' },
        wrong: [
          { a: R`\frac{2mV_0}{\hbar^2(\mu^2+q^2)}`, hint: T('玻恩振幅前面有负号：f = −(m/2πħ²)∫e^{−iq·r}V d³r，排斥势（V₀ > 0）给出负的 f。', 'The Born amplitude carries a minus sign: f = −(m/2πħ²)∫e^{−iq·r}V d³r, so a repulsive potential (V₀ > 0) gives a negative f.') },
          { a: R`-\frac{mV_0}{2\pi\hbar^2(\mu^2+q^2)}`, hint: T('e^{−μr}/r 的傅里叶变换是 4π/(μ² + q²)，不是 1/(μ² + q²)：漏了 4π。', 'The Fourier transform of e^{−μr}/r is 4π/(μ² + q²), not 1/(μ² + q²): the 4π is missing.') },
        ],
        hint: T('f = −(m/2πħ²) Ṽ(q)，而 ∫ e^{−iq·r} e^{−μr}/r d³r = 4π/(μ² + q²)。', 'f = −(m/2πħ²) Ṽ(q), and ∫ e^{−iq·r} e^{−μr}/r d³r = 4π/(μ² + q²).'),
        steps: [
          R`f^{(1)}(q)=-\frac{m}{2\pi\hbar^2}\int e^{-i\vec q\cdot\vec r}\,V(r)\,d^3r=-\frac{m}{2\pi\hbar^2}\cdot\frac{4\pi V_0}{\mu^2+q^2}=-\frac{2mV_0}{\hbar^2(\mu^2+q^2)}`,
          T('μ → 0 时得到库仑散射的卢瑟福公式。', 'As μ → 0 this gives the Rutherford formula for Coulomb scattering.'),
        ],
      },
    ],
    rel: [
      {
        id: 'rel-1',
        q: T('Dirac 理论里氢原子的能级如下。n = 2 时 2P₃/₂ 和 2P₁/₂ 之间的精细结构劈裂是多少？用精细结构常数 α 和哈特里能量 E_h 表示。',
          'In Dirac theory the hydrogen levels are as below. For n = 2, what is the fine-structure splitting between 2P₃/₂ and 2P₁/₂, in terms of the fine-structure constant α and the hartree energy E_h?'),
        tex: R`E_{nj}\approx-\frac{E_h}{2n^2}\left[1+\frac{\alpha^2}{n^2}\left(\frac{n}{j+\frac{1}{2}}-\frac{3}{4}\right)\right]`,
        answer: R`\frac{\alpha^2E_h}{32}`,
        vars: { alpha: '+', E_h: '+' },
        wrong: [
          { a: R`-\frac{\alpha^2E_h}{32}`, hint: T('j = 3/2 的能级更高，劈裂取正值。', 'The j = 3/2 level lies higher, so the splitting is positive.') },
          { a: R`\frac{\alpha^2E_h}{8}`, hint: T('n² 出现了两次：E_h/(2n²) 和 α²/n² 里都要代 n = 2。', 'n² appears twice: put n = 2 into both E_h/(2n²) and α²/n².') },
        ],
        hint: T('只有 n/(j + ½) 一项依赖 j：j = ½ 时是 2，j = 3/2 时是 1。', 'Only n/(j + ½) depends on j: it is 2 for j = ½ and 1 for j = 3/2.'),
        steps: [
          R`\Delta E=\frac{E_h}{2n^2}\cdot\frac{\alpha^2}{n^2}\left(\frac{n}{1}-\frac{n}{2}\right)\Big|_{n=2}=\frac{\alpha^2E_h}{32}\approx0.365\ \text{cm}^{-1}\approx10.9\ \text{GHz}`,
          T('2S₁/₂ 和 2P₁/₂ 在 Dirac 理论里简并，实际还差约 1.06 GHz 的兰姆位移，那是量子电动力学效应。', '2S₁/₂ and 2P₁/₂ are degenerate in Dirac theory; in reality they differ by the Lamb shift of about 1.06 GHz, a quantum-electrodynamics effect.'),
        ],
      },
      {
        id: 'rel-2',
        q: T('自由的 Dirac 粒子（质量 m，动量 p）H = cα·p + βmc²。它的能量本征值有哪些？用逗号隔开。',
          'For a free Dirac particle (mass m, momentum p), H = cα·p + βmc². What are its energy eigenvalues? Separate them with commas.'),
        answer: R`\sqrt{p^2c^2+m^2c^4},-\sqrt{p^2c^2+m^2c^4}`,
        vars: { p: '+', c: '+', m: '+' },
        wrong: [
          { a: R`\sqrt{p^2c^2+m^2c^4}`, hint: T('Dirac 方程还有负能解：H² = (p²c² + m²c⁴)I，两个符号都出现，各二重简并（自旋）。', 'The Dirac equation also has negative-energy solutions: H² = (p²c² + m²c⁴)I, so both signs occur, each twice (spin).') },
          { a: R`pc+mc^2,-pc-mc^2`, hint: T('能量不是 pc 和 mc² 直接相加：E² = p²c² + m²c⁴。', 'The energy is not pc plus mc²: E² = p²c² + m²c⁴.') },
          { a: R`mc^2+\frac{p^2}{2m}`, hint: T('那是正能解在非相对论极限下的展开；题目要的是精确结果，而且还有负能解。', 'That is the nonrelativistic expansion of the positive-energy branch; the question wants the exact result, and there is a negative branch as well.') },
        ],
        hint: T('利用 α_i、β 两两反对易且平方为 1，算 H²。', 'Use that the α_i and β anticommute pairwise and square to 1, and compute H².'),
        steps: [
          R`H^2=c^2p^2+m^2c^4\qquad\left(\{\alpha_i,\alpha_j\}=2\delta_{ij},\ \{\alpha_i,\beta\}=0,\ \beta^2=1\right)`,
          R`E=\pm\sqrt{p^2c^2+m^2c^4}`,
          T('负能解让 Dirac 预言了正电子。', 'The negative-energy solutions led Dirac to predict the positron.'),
        ],
      },
    ],
    cond: [
      {
        id: 'cond-1',
        q: T('一维原子链（晶格常数 a），每个原子一个轨道，在位能 α，最近邻跃迁积分 β。紧束缚能带 E(k) 是多少？',
          'A one-dimensional chain of atoms (lattice constant a) has one orbital per atom, on-site energy α and nearest-neighbour hopping β. What is the tight-binding band E(k)?'),
        answer: R`\alpha+2\beta\cos(ka)`,
        vars: { alpha: [-2, 2], beta: [-2, -0.3], k: '+', a: '+' },
        wrong: [
          { a: R`\alpha+\beta\cos(ka)`, hint: T('每个原子有左右两个近邻，各贡献 βe^{±ika}，加起来是 2β cos ka。', 'Each atom has two neighbours, left and right, contributing βe^{±ika}; together that is 2β cos ka.') },
          { a: R`\alpha+2\beta\sin(ka)`, hint: T('e^{ika} + e^{−ika} = 2 cos ka，不是 sin。', 'e^{ika} + e^{−ika} = 2 cos ka, not sin.') },
        ],
        hint: T('布洛赫态 ψ_k = Σ_n e^{ikna} φ_n，代入 Hψ = Eψ。', 'Put the Bloch state ψ_k = Σ_n e^{ikna} φ_n into Hψ = Eψ.'),
        steps: [
          R`E(k)=\alpha+\beta\left(e^{ika}+e^{-ika}\right)=\alpha+2\beta\cos(ka)`,
          T('带宽 4|β|。它和 N → ∞ 的环状多烯的 Hückel 能级是同一个式子。', 'The bandwidth is 4|β|. It is the same expression as the Hückel levels of a cyclic polyene with N → ∞.'),
        ],
      },
      {
        id: 'cond-2',
        q: T('三维自由电子气，电子数密度为 n（计入自旋）。费米波矢 k_F 是多少？',
          'A three-dimensional free electron gas has electron density n (spin included). What is the Fermi wavevector k_F?'),
        answer: R`(3\pi^2n)^{1/3}`,
        vars: { n: '+' },
        wrong: [
          { a: R`(6\pi^2n)^{1/3}`, hint: T('每个 k 点可以放自旋相反的两个电子：n = 2 · (4πk_F³/3)/(2π)³。', 'Each k point holds two electrons of opposite spin: n = 2 · (4πk_F³/3)/(2π)³.') },
          { a: R`(3\pi^2n)^{1/2}`, hint: T('三维费米球的体积正比于 k_F³，要开立方。', 'The volume of a 3D Fermi sphere goes as k_F³, so take a cube root.') },
        ],
        hint: T('费米球里的状态数：2 × (4πk_F³/3) × V/(2π)³ = N。', 'Count the states in the Fermi sphere: 2 × (4πk_F³/3) × V/(2π)³ = N.'),
        steps: [
          R`n=2\cdot\frac{\frac{4}{3}\pi k_F^3}{(2\pi)^3}=\frac{k_F^3}{3\pi^2}`,
          R`k_F=\left(3\pi^2n\right)^{1/3}`,
          T('铜（n ≈ 8.5 × 10²⁸ m⁻³）的 k_F ≈ 1.36 × 10¹⁰ m⁻¹，费米能约 7 eV。', 'For copper (n ≈ 8.5 × 10²⁸ m⁻³), k_F ≈ 1.36 × 10¹⁰ m⁻¹ and the Fermi energy is about 7 eV.'),
        ],
      },
    ],
    optics: [
      {
        id: 'optics-1',
        q: T('两能级原子被共振光驱动，拉比频率 Ω，激发态概率 P_e(t) = sin²(Ωt/2)。从基态出发，多长时间后第一次完全布居反转（π 脉冲）？',
          'A two-level atom is driven on resonance with Rabi frequency Ω, so the excited-state probability is P_e(t) = sin²(Ωt/2). Starting in the ground state, when is the population first fully inverted (a π pulse)?'),
        answer: R`\frac{\pi}{\Omega}`,
        vars: { Omega: '+' },
        wrong: [
          { a: R`\frac{2\pi}{\Omega}`, hint: T('那是一个完整的拉比周期（2π 脉冲），原子又回到了基态。', 'That is a full Rabi cycle (a 2π pulse): the atom is back in the ground state.') },
          { a: R`\frac{\pi}{2\Omega}`, hint: T('那是 π/2 脉冲，得到的是等权叠加态。', 'That is a π/2 pulse, which gives an equal superposition.') },
        ],
        hint: T('sin²(Ωt/2) = 1 要求 Ωt/2 = π/2。', 'sin²(Ωt/2) = 1 needs Ωt/2 = π/2.'),
        steps: [
          R`P_e(t)=\sin^2\frac{\Omega t}{2}=1\ \Rightarrow\ t_\pi=\frac{\pi}{\Omega}`,
        ],
      },
      {
        id: 'optics-2',
        q: T('Jaynes–Cummings 模型，原子与腔共振，耦合 ħg(a σ₊ + a† σ₋)。单激发的两个态 |e, 0⟩、|g, 1⟩ 劈裂成两个缀饰态，它们的角频率差（真空拉比劈裂）是多少？',
          'In the Jaynes–Cummings model with atom and cavity on resonance and coupling ħg(a σ₊ + a† σ₋), the single-excitation states |e, 0⟩ and |g, 1⟩ split into two dressed states. What is their angular-frequency difference (the vacuum Rabi splitting)?'),
        answer: R`2g`,
        vars: { g: '+' },
        wrong: [
          { a: R`0`, hint: T('没有耦合时两个态简并，但耦合 ħg 把它们推开了。', 'Without coupling the two states are degenerate, but the coupling ħg pushes them apart.') },
          { a: R`g`, hint: T('2 × 2 矩阵 [[0, ħg], [ħg, 0]] 的本征值是 ±ħg，两者之差是 2ħg。', 'The 2 × 2 matrix [[0, ħg], [ħg, 0]] has eigenvalues ±ħg, which differ by 2ħg.') },
          { a: R`2\sqrt{2}g`, hint: T('2√2 g 是双激发流形（|e, 1⟩、|g, 2⟩，耦合 g√2）的劈裂；单激发是 2g。', '2√2 g is the splitting of the two-excitation manifold (|e, 1⟩, |g, 2⟩, coupling g√2); the single-excitation one is 2g.') },
        ],
        hint: T('在 {|e, 0⟩, |g, 1⟩} 里写出 2 × 2 的哈密顿量矩阵。', 'Write the 2 × 2 Hamiltonian matrix in {|e, 0⟩, |g, 1⟩}.'),
        steps: [
          R`H_1=\hbar\begin{pmatrix}\omega&g\\ g&\omega\end{pmatrix},\qquad E_\pm=\hbar(\omega\pm g)`,
          T('角频率差是 2g；第 n 个激发流形的劈裂是 2g√n。', 'The angular-frequency difference is 2g; the n-th excitation manifold splits by 2g√n.'),
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

  window.MOLASTRIA_QP_QUIZ = { checked: '2026-11-10', items, math };
})();
