/* 物理疆界图 · 双摆演示的数学（纯函数，不碰 DOM；tools/realms-test.mjs 检验）。pr.js 在打开“分析力学”或“混沌”节点时才加载这个文件。
   两根无质量的刚性杆，末端各挂一个质点。状态 y = [θ₁, θ₂, ω₁, ω₂]，角度从竖直向下量起；参数 p = { m1, m2, l1, l2, g }。
   拉格朗日量 L = ½(m₁+m₂)l₁²ω₁² + ½m₂l₂²ω₂² + m₂l₁l₂ω₁ω₂cos(θ₁−θ₂) + (m₁+m₂)gl₁cosθ₁ + m₂gl₂cosθ₂，
   欧拉–拉格朗日方程解出角加速度（deriv），用经典四阶 Runge–Kutta 积分（rk4）。能量 E = T + V 守恒，演示用它的漂移检验积分步长。 */
(() => {
  'use strict';
  const M = {};

  M.DEFAULTS = { m1: 1, m2: 1, l1: 1, l2: 1, g: 9.81 };

  // dy/dt：两个角加速度由 2×2 质量矩阵直接解出
  M.deriv = ([t1, t2, w1, w2], { m1, m2, l1, l2, g }) => {
    const d = t1 - t2, s = Math.sin(d), c = Math.cos(d), den = 2 * m1 + m2 - m2 * Math.cos(2 * d);
    const a1 = (-g * (2 * m1 + m2) * Math.sin(t1) - m2 * g * Math.sin(t1 - 2 * t2) - 2 * s * m2 * (w2 * w2 * l2 + w1 * w1 * l1 * c)) / (l1 * den);
    const a2 = (2 * s * (w1 * w1 * l1 * (m1 + m2) + g * (m1 + m2) * Math.cos(t1) + w2 * w2 * l2 * m2 * c)) / (l2 * den);
    return [w1, w2, a1, a2];
  };

  // 一步 RK4
  M.rk4 = (y, h, p) => {
    const k1 = M.deriv(y, p);
    const k2 = M.deriv(y.map((v, i) => v + 0.5 * h * k1[i]), p);
    const k3 = M.deriv(y.map((v, i) => v + 0.5 * h * k2[i]), p);
    const k4 = M.deriv(y.map((v, i) => v + h * k3[i]), p);
    return y.map((v, i) => v + (h / 6) * (k1[i] + 2 * k2[i] + 2 * k3[i] + k4[i]));
  };
  // 积分 steps 步，返回终态
  M.run = (y, h, steps, p) => { let s = y; for (let i = 0; i < steps; i++) s = M.rk4(s, h, p); return s; };

  // 总能量（势能零点在悬挂点）与它的自然尺度 (m₁+m₂)gl₁ + m₂gl₂，漂移按这个尺度报告
  M.energy = ([t1, t2, w1, w2], { m1, m2, l1, l2, g }) =>
    0.5 * (m1 + m2) * l1 * l1 * w1 * w1 + 0.5 * m2 * l2 * l2 * w2 * w2 + m2 * l1 * l2 * w1 * w2 * Math.cos(t1 - t2)
    - (m1 + m2) * g * l1 * Math.cos(t1) - m2 * g * l2 * Math.cos(t2);
  M.energyScale = ({ m1, m2, l1, l2, g }) => (m1 + m2) * g * l1 + m2 * g * l2;

  // 两个质点的位置（x 向右、y 向上，悬挂点在原点）
  M.positions = ([t1, t2], { l1, l2 }) => {
    const x1 = l1 * Math.sin(t1), y1 = -l1 * Math.cos(t1);
    return [x1, y1, x1 + l2 * Math.sin(t2), y1 - l2 * Math.cos(t2)];
  };

  // 把角度差折回 (−π, π]；两个双摆在角度空间里的距离
  const wrap = (a) => a - 2 * Math.PI * Math.round(a / (2 * Math.PI));
  M.separation = (a, b) => Math.hypot(wrap(a[0] - b[0]), wrap(a[1] - b[1]));

  // 小角度近似下的两个简正模：M θ̈ = −K θ，M = [[(m₁+m₂)l₁², m₂l₁l₂], [m₂l₁l₂, m₂l₂²]]，K = diag((m₁+m₂)gl₁, m₂gl₂)。
  // 返回 ω²（从小到大）和对应的振型 θ₂/θ₁。等质量、等长时 ω² = (g/l)(2 ∓ √2)，振型 ±√2。
  M.normalModes = ({ m1, m2, l1, l2, g }) => {
    const a = (m1 + m2) * l1 * l1, b = m2 * l1 * l2, c = m2 * l2 * l2, k1 = (m1 + m2) * g * l1, k2 = m2 * g * l2;
    // det(K − ω²M) = 0：(ac − b²)x² − (k1c + k2a)x + k1k2 = 0
    const A = a * c - b * b, B = -(k1 * c + k2 * a), Cc = k1 * k2, disc = Math.sqrt(B * B - 4 * A * Cc);
    const xs = [(-B - disc) / (2 * A), (-B + disc) / (2 * A)];
    return xs.map((x) => ({ omega2: x, shape: (k1 - x * a) / (x * b) }));
  };

  if (typeof window !== 'undefined') window.MOLASTRIA_REALMS_MODELS = M;
  if (typeof module !== 'undefined') module.exports = M;
})();
