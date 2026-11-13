// Tests for the Frontier AI Mathematics section (/ai-math/): the demo models against analytic
// results and against the numerical record printed in the notes, and the content's integrity
// (both languages, formulas, references, demos, cross-links).
//   node --test tools/ai-math-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const read = (file) => readFileSync(new URL(`../public/ai-math/${file}`, import.meta.url), 'utf8');
const box = { window: {} };
for (const f of ['aim-models.js', 'aim-data.js', 'aim-topics.js', 'aim-math.js', 'aim-demos-a.js', 'aim-demos-b.js', 'aim-demos-c.js']) vm.runInNewContext(read(f), box);
const M = box.window.MOLASTRIA_AIM_MODELS, D = box.window.MOLASTRIA_AIM, MATH = box.window.MOLASTRIA_AIM_MATH;
const close = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} vs ${b}`);
const rel = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol * Math.abs(b), `${msg}: ${a} vs ${b}`);
const items = [...D.topics, ...D.appendices];

// ── 讲义的核验记录（附录 K 和“验证记录”一页） ─────────────────────────────
test('record: Euler / Heun endpoint errors of the Gaussian flow match the notes to four digits', () => {
  const now = M.flowErrors();
  assert.equal(now.length, M.RECORD.flow.length);
  now.forEach((r, i) => { const [n, e, h] = M.RECORD.flow[i]; assert.equal(r.n, n); rel(r.euler, e, 6e-4, `Euler n=${n}`); rel(r.heun, h, 6e-4, `Heun n=${n}`); });
  // 收敛阶：步数翻倍，Euler 误差约减半，Heun 约降到四分之一
  for (let i = 3; i < now.length; i++) { rel(now[i - 1].euler / now[i].euler, 2, 0.05, 'Euler is first order'); rel(now[i - 1].heun / now[i].heun, 4, 0.1, 'Heun is second order'); }
});
test('record: group-mean baseline shrinks the gradient by (1 − 1/G); leave-one-out does not', () => {
  close(M.groupMeanGradient(0.3, 4), M.RECORD.groupMean, 1e-12, 'p = 0.3, G = 4');
  for (const p of [0.1, 0.3, 0.7]) for (const G of [2, 3, 4, 6]) {
    close(M.groupMeanGradient(p, G), p * (1 - p) * (1 - 1 / G), 1e-12, `group mean p=${p} G=${G}`);
    close(M.groupMeanGradient(p, G, true), p * (1 - p), 1e-12, `leave-one-out p=${p} G=${G}`);
  }
});
test('record: attention backward pass agrees with central differences; flow path derivative equals the velocity', () => {
  for (const seed of [37, 1, 20261112]) { const r = M.attnGradCheck(seed); assert.ok(r.rel < 1e-7, `seed ${seed}: ${r.rel}`); }
  assert.ok(M.flowDerivativeGap() < 1e-8);
  const P = M.sinkhornNormalize(M.positiveMatrix(6), 200);
  assert.ok(M.marginResidual(P) < 1e-12, 'Sinkhorn makes rows and columns sum to 1');
  close(M.specNorm(P), 1, 1e-9, 'a doubly stochastic matrix has spectral norm 1');
});

// ── 各主题演示的数学 ──────────────────────────────────────────────────────
test('basics: rng is reproducible, softmax sums to 1 and is shift invariant, lgamma, LoRA fraction', () => {
  const a = M.rng(5), b = M.rng(5); for (let i = 0; i < 5; i++) assert.equal(a(), b());
  const s = M.softmax([1, 2, 3]), t = M.softmax([101, 102, 103]);
  close(s.reduce((x, y) => x + y, 0), 1, 1e-15, 'sum'); s.forEach((v, i) => close(v, t[i], 1e-12, 'shift'));
  close(M.lgamma(5), Math.log(24), 1e-9, 'Γ(5) = 24'); close(M.lgamma(0.5), 0.5 * Math.log(Math.PI), 1e-9, 'Γ(½) = √π');
  close(M.loraFraction(4096, 4096, 8), 16 / 4096, 1e-15, 'r(m+n)/mn');
});
test('attention: the worked example of the notes, the Jacobian, the causal mask', () => {
  const r = M.attention([1, 0], [[1, 0], [0, 1], [1, 1]], [[1, 0], [0, 2], [1, 1]]);
  [0.401, 0.198, 0.401].forEach((v, i) => close(r.weights[i], v, 6e-4, `weight ${i}`));
  close(r.out[0], 0.802, 6e-4, 'output x'); close(r.out[1], 0.797, 6e-4, 'output y');
  const J = M.softmaxJacobian(r.weights);
  J.forEach((row) => close(row.reduce((x, y) => x + y, 0), 0, 1e-15, 'Jacobian rows sum to 0'));
  const W = M.causalWeights([[1, 9, 9], [0, 1, 9], [2, 0, 1]]);
  assert.equal(W[0][1], 0); assert.equal(W[1][2], 0); W.forEach((row) => close(row.reduce((x, y) => x + y, 0), 1, 1e-12, 'row sum'));
});
test('RoPE depends only on the relative position; Newton–Schulz pushes singular values to 1', () => {
  const q = [0.8, -0.3], k = [0.2, 1.1];
  for (const [m, n] of [[3, 1], [10, 8], [105, 103]]) close(M.ropeDot(q, k, m, n, 0.37), M.ropeRel(q, k, n - m, 0.37), 1e-12, `m=${m}, n=${n}`);
  M.newtonSchulz([3, 1.5, 0.6], 12).forEach((v) => close(v, 1, 1e-3, 'orthogonalised'));
});
test('information: KL closed forms against quadrature; natural-gradient step sits on the KL ellipse', () => {
  for (const [mu, sd] of [[0, 1], [1, 0.5], [-2, 2]]) close(M.gaussKLnumeric(mu, sd), M.gaussKL(mu, sd), 1e-5, `KL(N(${mu},${sd}²)‖N(0,1))`);
  close(M.bernKL(0.3, 0.3), 0, 1e-15, 'KL(p‖p)'); assert.ok(M.bernKL(0.3, 0.31) > 0);
  rel(M.bernKL(0.3, 0.3 + 1e-3), 0.5 * 1e-6 / (0.3 * 0.7), 5e-3, 'second-order KL with F = 1/(p(1−p))');
  for (const [a, b, ang, g, delta] of [[4, 0.5, 0.5, [0.5, 0.87], 0.3], [1, 1, 0, [1, 0], 0.1], [9, 0.2, 1.2, [-0.3, 0.6], 0.05]]) {
    const F = M.fisher2(a, b, ang), step = M.naturalStep(F, g, delta), gd = (d) => g[0] * d[0] + g[1] * d[1];
    close(0.5 * M.quadForm(F, step), delta, 1e-12, 'the step lies on ½ΔᵀFΔ = δ');
    // 同一条 KL 线上，沿 −g 的一步降得不会更多
    const q = M.quadForm(F, g), sg = Math.sqrt((2 * delta) / q), plain = [-sg * g[0], -sg * g[1]];
    close(0.5 * M.quadForm(F, plain), delta, 1e-12, 'the −g step lies on the same ellipse');
    assert.ok(gd(step) <= gd(plain) + 1e-12, 'the natural step lowers the linearised loss at least as much');
  }
});
test('diffusion and flows: schedule, OU variance, Gaussian flow', () => {
  const ab = M.alphaBar(); assert.equal(ab.length, 1001); assert.equal(ab[0], 1);
  assert.ok(ab[1000] > 3e-5 && ab[1000] < 5e-5, `ᾱ_T = ${ab[1000]}`);
  for (let i = 1; i < ab.length; i++) assert.ok(ab[i] < ab[i - 1]);
  close(M.ouVar(0, 0.9, 0.8), 1, 1e-15, 'v(0)'); close(M.ouVar(50, 0.9, 0.8), 0.64 / 1.8, 1e-12, 'stationary variance g²/2θ');
  close(M.ouVar(3, 0.9, 0.8), 0.3585, 5e-4, 'the notes’ v(T)');
  close(M.flowExact(1, 1), 2.5, 1e-15, 'x₁ = 2 + 0.5 z'); close(M.flowVar(1), 0.25, 1e-15, 'Var X₁');
  const m = M.flowMinStd(); close(m.t, 0.8, 1e-12, 'narrowest time'); close(m.sd, Math.sqrt(0.2), 1e-12, 'narrowest sd');
  for (const [z0, r, t] of [[1, 0.2, 0.9], [-0.7, 0, 0.5], [2, 0.4, 0.6]]) { const res = M.meanFlowResidual(z0, r, t); assert.ok(Math.abs(typeof res === 'number' ? res : res.residual) < 1e-6, `MeanFlow identity at r=${r}, t=${t}`); }
  close(M.contractLogP(0.4, 1.3, 0.7) - Math.log(M.contractDensity(0.4 * Math.exp(-0.7 * 1.3), 1.3, 0.7)), 0, 1e-12, 'log-density along a contracting flow grows by λt');
  const post = M.gaussPosterior(0, 1, 2, 1); close(post.mean, 1, 1e-15, 'posterior mean'); close(post.sd, Math.SQRT1_2, 1e-15, 'posterior sd');
});
test('decisions: bandit baseline, PPO clip, tilted policy, DPO, value iteration', () => {
  for (const b of [0, 0.3, 0.7, 1]) close(M.banditStats(0.3, b).mean, 0.21, 1e-12, `unbiased for b=${b}`);
  const best = M.banditStats(0.3, 0.7).variance; for (const b of [0, 0.5, 0.9]) assert.ok(M.banditStats(0.3, b).variance > best, 'b = 1 − p has least variance');
  assert.equal(M.ppoClip(1.5, 1, 0.2), 1.2); assert.equal(M.ppoClip(1.5, -1, 0.2), -1.5); assert.equal(M.ppoClip(0.5, 1, 0.2), 0.5); assert.equal(M.ppoClip(0.5, -1, 0.2), -0.8);
  const ref = [0.5, 0.3, 0.2], rw = [0, 1, -1], pi = M.tiltPolicy(ref, rw, 1);
  [0.360, 0.587, 0.053].forEach((v, i) => close(pi[i], v, 6e-4, `π*[${i}]`));
  const top = M.regObjective(pi, ref, rw, 1), r = M.rng(9);
  for (let k = 0; k < 200; k++) { const w = [r() + 1e-3, r() + 1e-3, r() + 1e-3], z = w[0] + w[1] + w[2]; assert.ok(M.regObjective(w.map((v) => v / z), ref, rw, 1) <= top + 1e-12, 'π* maximises the regularised objective'); }
  close(M.dpoLoss(0), Math.log(2), 1e-15, '−log σ(0)'); close(M.dpoLoss(1), 0.3133, 1e-4, '−log σ(1)');
  const vi = M.valueIteration(6, 0.9, 80); for (let i = 1; i < vi.gaps.length; i++) assert.ok(vi.gaps[i] <= 0.9 * vi.gaps[i - 1] + 1e-12, 'γ-contraction');
});
test('theory: pass@k, conformal quantile, scaling optimum, Grönwall bound, equivariance', () => {
  close(M.passAtK(0.2, 10), 1 - 0.8 ** 10, 1e-15, 'independent samples');
  const sc = Array.from({ length: 19 }, (_, i) => i + 1);
  assert.equal(M.conformalQuantile(sc, 0.1), 18); assert.equal(M.conformalQuantile(sc.slice(0, 5), 0.1), Infinity);
  const o = { Linf: 1.7, a: 400, alpha: 0.34, b: 410, beta: 0.28, k: 6 }, C = 1e21, opt = M.scalingOpt(C, o);
  for (const f of [0.5, 0.8, 1.25, 2]) assert.ok(M.scalingLoss(opt.N * f, C, o) > opt.loss, `N* is the minimum (×${f})`);
  close(M.gronwall(1, 0, 0.1, 0.2), 0.3, 1e-15, 'L = 0'); close(M.gronwall(1, 2, 0.1, 0), 0.1 * Math.exp(2), 1e-12, 'δ = 0');
  for (const [L, e0, d] of [[1, 0.05, 0.1], [3, 0, 0.2], [0.5, 0.1, 0]]) { const tr = M.gronwallExample(L, e0, d, 400); tr.forEach((e, k) => assert.ok(e <= M.gronwall(k / 400, L, e0, d) + 1e-6, `bound holds L=${L} at step ${k}`)); }
  const r = M.rng(3), X = Array.from({ length: 5 }, () => [M.gauss(r), M.gauss(r)]);
  assert.ok(M.equivarianceError(X, 1.1) < 1e-10); assert.ok(M.equivarianceError(X, 0.4, true) < 1e-10);
});

// ── 内容 ──────────────────────────────────────────────────────────────────
const both = (o, where) => { assert.ok(o && typeof o.zh === 'string' && o.zh.trim() && typeof o.en === 'string' && o.en.trim(), `${where}: needs zh and en`); assert.ok(!/[一-鿿]/.test(o.en), `${where}: Chinese left in the English text`); };
test('content: 44 topics in 7 parts and 12 appendices, each complete in both languages', () => {
  assert.equal(D.topics.length, 44); assert.equal(D.appendices.length, 12); assert.equal(D.parts.length, 8);
  assert.deepEqual(Array.from(D.topics, (t) => t.id), Array.from({ length: 44 }, (_, i) => String(i + 1).padStart(2, '0')));
  assert.deepEqual(Array.from(D.appendices, (t) => t.id), [...'ABCDEFGHIJKL']);
  const parts = new Set(D.parts.map((p) => p.id));
  for (const p of D.parts) { both(p.title, `part ${p.id}`); both(p.text, `part ${p.id} text`); assert.ok(items.some((t) => t.part === p.id), `part ${p.id} is empty`); }
  for (const t of items) {
    assert.ok(parts.has(t.part), `${t.id}: part`); assert.ok(D.kinds[t.kind], `${t.id}: kind ${t.kind}`);
    for (const k of ['title', 'lead', 'take', 'src']) both(t[k], `${t.id}.${k}`);
    assert.ok(t.secs.length >= 2, `${t.id}: sections`); t.secs.forEach((s, i) => { both(s.h, `${t.id} sec ${i}`); both(s.p, `${t.id} sec ${i}`); });
  }
});
test('content: every formula is used once and has MathML; 130 in all', () => {
  const keys = Object.keys(D.math); assert.equal(keys.length, 130);
  const used = items.flatMap((t) => Array.from(t.math)); assert.deepEqual([...used].sort(), [...keys].sort());
  for (const k of keys) assert.ok(/^<math/.test(MATH[k]), `${k}: MathML missing (run node tools/fundamental-math.mjs ai-math/)`);
  for (const t of items) assert.ok(t.math.length >= 1, `${t.id}: no formula`);
});
test('content: every topic has its own demo, appendices point at existing ones', () => {
  const demos = {}, any = () => any, K = new Proxy({ M, en: false, L: (a) => (Array.isArray(a) ? a[0] : a), D }, { get: (o, k) => (k in o ? o[k] : any) });
  for (const reg of box.window.MOLASTRIA_AIM_DEMOS) reg(K, demos);
  for (const t of D.topics) assert.ok(demos[t.demo || t.id], `topic ${t.id}: no demo`);
  for (const t of D.appendices) { assert.ok(demos[t.demo || t.id], `appendix ${t.id}: no demo`); if (t.demo2) assert.ok(demos[t.demo2], `appendix ${t.id}: demo2`); }
  for (const [id, d] of Object.entries(demos)) {
    assert.equal(d.title.length, 2, `demo ${id}: title`); assert.ok(!/[一-鿿]/.test(d.title[1]), `demo ${id}: English title`);
    if (id !== '43' && id !== 'L') assert.ok(d.note && d.note.length === 2 && d.note[0] && d.note[1], `demo ${id}: says what the model is and is not`); // 43 和 L 是导航图，没有模型
    assert.equal(typeof d.draw, 'function', `demo ${id}: draw`);
    for (const c of d.ctl || []) { const [, label, min, max, step, init] = c; assert.equal(label.length, 2); assert.ok(min < max && step > 0 && init >= min && init <= max, `demo ${id}: slider ${c[0]}`); }
  }
});
test('content: references are numbered 1–40 as in the notes, each has a link, and every citation resolves', () => {
  const nums = Array.from(D.refs.filter((r) => r.n), (r) => r.n); assert.deepEqual(nums, Array.from({ length: 40 }, (_, i) => i + 1));
  const ids = new Set(D.refs.map((r) => r.id)); assert.equal(ids.size, D.refs.length);
  for (const r of D.refs) { assert.ok(r.title && r.authors && r.year >= 1900 && r.year <= 2026, r.id); assert.ok(r.arxiv || r.doi || r.url, `${r.id}: no link`); both(r.note, `ref ${r.id}`); if (r.arxiv) assert.match(r.arxiv, /^\d{4}\.\d{4,5}$/, r.id); }
  for (const t of items) for (const lang of ['zh', 'en']) {
    for (const m of t.src[lang].matchAll(/\[([\d,\s–-]+)\]/g)) for (const n of m[1].split(/[,\s]+/).filter(Boolean)) { const [a, b = a] = n.split(/[–-]/).map(Number); assert.ok(a >= 1 && b <= 40 && a <= b, `${t.id}: citation [${m[1]}]`); }
  }
});
test('content: quiz, threads, reading checklist and the audit are complete and point at real items', () => {
  const idset = new Set(items.map((t) => t.id));
  assert.equal(D.quiz.length, 10); for (const [q, a, to] of D.quiz) { both(q, 'quiz'); both(a, 'quiz'); assert.ok(idset.has(to), `quiz → ${to}`); }
  assert.equal(D.threads.length, 5);
  for (const k of ['done', 'notDone', 'changed']) { assert.ok(D.audit[k].length >= 2, `audit.${k}`); D.audit[k].forEach((x, i) => both(x, `audit.${k}[${i}]`)); }
  assert.match(D.checked, /^\d{4}-\d{2}-\d{2}$/);
  // 讲义里“见附录 X”“主题 NN”的互相引用都指向存在的条目
  for (const t of items) for (const s of [t.lead, t.take, t.src, ...t.secs.map((x) => x.p)]) for (const m of s.zh.matchAll(/附录 ([A-L])/g)) assert.ok(idset.has(m[1]), `${t.id} → 附录 ${m[1]}`);
});
