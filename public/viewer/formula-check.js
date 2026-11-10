/* 公式答题：读者把答案写成公式，判成“对 / 犯了第 k 种常见错误 / 不对”，常见错误给针对性的提示（Oppia 的做法），
   错两次给一条总提示，错三次或者自己要求时显示解答。
   输入框用 MathLive（MIT，https://github.com/arnog/mathlive），判等用 Compute Engine（MIT，https://github.com/cortex-js/compute-engine），
   版本写死，题目块第一次进入视野时才从 jsDelivr 载入 MathLive，获得焦点时才载入 Compute Engine，做法和实验室载入 RDKit.js 一样。
   载不到 MathLive 时退回普通文本框（ASCII 数学，如 sqrt(2/L)、n^2*pi^2*hbar^2/(2*m*L^2)），载不到 Compute Engine 时用本文件自带的小解析器。
   判分：先试 Compute Engine 的符号相等，再在几组随机取值上比较数值（跳过参考答案不可求值的点，带相对容差）。
   解析和求值都放在传进来的 engine 里（parse / evaluate / 可选的 equal），所以 tools/formula-check-test.mjs 在 node 里不用 npm 包也能测判分逻辑。
   页面用法：<div data-fq="MOLASTRIA_FM_QUIZ" data-fq-item="la" data-fq-store="molastria-fm-quiz"></div>，本文件载入时自动挂上，
   题目在 window.MOLASTRIA_FM_QUIZ.items.la，解答里的公式（MathML）在 window.MOLASTRIA_FM_QUIZ_MATH（tools/fundamental-math.mjs 生成）。
   答对的题号存在 data-fq-store 指定的 localStorage 键里。window.MolAstriaFormulaCheck；在 node 里 module.exports 只导出纯函数。 */
(function (root) {
  'use strict';

  const MATHLIVE_VERSION = '0.111.1';
  const CE_VERSION = '0.69.1';
  const MATHLIVE_SRC = `https://cdn.jsdelivr.net/npm/mathlive@${MATHLIVE_VERSION}/mathlive.min.js`;
  const MATHLIVE_FONTS = `https://cdn.jsdelivr.net/npm/mathlive@${MATHLIVE_VERSION}/fonts`; // 动态载入时 MathLive 自己算出的字体路径不对
  const CE_SRC = `https://cdn.jsdelivr.net/npm/@cortex-js/compute-engine@${CE_VERSION}/dist/compute-engine.min.esm.js`;

  // ── 复数（[实部, 虚部]）───────────────────────────────────────────────
  const cabs = (a) => Math.hypot(a[0], a[1]);
  const cadd = (a, b) => [a[0] + b[0], a[1] + b[1]];
  const csub = (a, b) => [a[0] - b[0], a[1] - b[1]];
  const cmul = (a, b) => [a[0] * b[0] - a[1] * b[1], a[0] * b[1] + a[1] * b[0]];
  const cdiv = (a, b) => { const d = b[0] * b[0] + b[1] * b[1]; return [(a[0] * b[0] + a[1] * b[1]) / d, (a[1] * b[0] - a[0] * b[1]) / d]; };
  const cexp = (a) => { const r = Math.exp(a[0]); return a[1] === 0 ? [r, 0] : [r * Math.cos(a[1]), r * Math.sin(a[1])]; };
  const clog = (a) => (a[1] === 0 && a[0] > 0 ? [Math.log(a[0]), 0] : [Math.log(cabs(a)), Math.atan2(a[1], a[0])]);
  const csqrt = (a) => {
    if (a[1] === 0) return a[0] >= 0 ? [Math.sqrt(a[0]), 0] : [0, Math.sqrt(-a[0])];
    const r = cabs(a), re = Math.sqrt((r + a[0]) / 2);
    return [re, a[1] / (2 * re)];
  };
  const cpow = (a, b) => {
    if (b[1] === 0 && Number.isInteger(b[0]) && Math.abs(b[0]) <= 64) {
      let r = [1, 0], base = a, n = Math.abs(b[0]);
      while (n) { if (n & 1) r = cmul(r, base); base = cmul(base, base); n >>= 1; }
      return b[0] < 0 ? cdiv([1, 0], r) : r;
    }
    if (a[1] === 0 && b[1] === 0 && a[0] >= 0) return [Math.pow(a[0], b[0]), 0];
    if (a[0] === 0 && a[1] === 0) return b[0] > 0 ? [0, 0] : [NaN, NaN];
    return cexp(cmul(b, clog(a)));
  };
  const csin = (a) => [Math.sin(a[0]) * Math.cosh(a[1]), Math.cos(a[0]) * Math.sinh(a[1])];
  const ccos = (a) => [Math.cos(a[0]) * Math.cosh(a[1]), -Math.sin(a[0]) * Math.sinh(a[1])];
  const csinh = (a) => [Math.sinh(a[0]) * Math.cos(a[1]), Math.cosh(a[0]) * Math.sin(a[1])];
  const ccosh = (a) => [Math.cosh(a[0]) * Math.cos(a[1]), Math.sinh(a[0]) * Math.sin(a[1])];
  const realOnly = (f) => (a) => (Math.abs(a[1]) < 1e-14 ? [f(a[0]), 0] : [NaN, NaN]);
  const intOf = (a) => (Math.abs(a[1]) < 1e-12 && Math.abs(a[0] - Math.round(a[0])) < 1e-9 ? Math.round(a[0]) : NaN);
  const factorial = (n) => { if (!(n >= 0) || n > 170) return NaN; let r = 1; for (let k = 2; k <= n; k++) r *= k; return r; };
  const binom = (n, k) => { if (!(n >= 0) || !(k >= 0) || k > n) return k > n && k >= 0 && n >= 0 ? 0 : NaN; let r = 1; for (let j = 1; j <= k; j++) r = (r * (n - k + j)) / j; return Math.round(r); };
  const FUNCS = {
    sqrt: csqrt, cbrt: (a) => (a[1] === 0 ? [Math.cbrt(a[0]), 0] : cpow(a, [1 / 3, 0])), exp: cexp, ln: clog, log: clog,
    sin: csin, cos: ccos, tan: (a) => cdiv(csin(a), ccos(a)), cot: (a) => cdiv(ccos(a), csin(a)), sec: (a) => cdiv([1, 0], ccos(a)), csc: (a) => cdiv([1, 0], csin(a)),
    sinh: csinh, cosh: ccosh, tanh: (a) => cdiv(csinh(a), ccosh(a)),
    arcsin: realOnly(Math.asin), arccos: realOnly(Math.acos), arctan: realOnly(Math.atan), asin: realOnly(Math.asin), acos: realOnly(Math.acos), atan: realOnly(Math.atan),
    abs: (a) => [cabs(a), 0],
  };

  // ── 本文件自带的小解析器：ASCII 数学和常用的 LaTeX ────────────────────
  const GREEK = 'alpha beta gamma delta epsilon varepsilon zeta eta theta vartheta iota kappa lambda mu nu xi omicron rho varrho sigma tau upsilon phi varphi chi psi omega Gamma Delta Theta Lambda Xi Sigma Upsilon Phi Psi Omega ell'.split(' ');
  const NAMES = [...Object.keys(FUNCS), 'binom', 'pi', 'hbar', ...GREEK].sort((a, b) => b.length - a.length);
  const UNI_GREEK = { α: 'alpha', β: 'beta', γ: 'gamma', δ: 'delta', ε: 'epsilon', ζ: 'zeta', η: 'eta', θ: 'theta', ι: 'iota', κ: 'kappa', λ: 'lambda', μ: 'mu', ν: 'nu', ξ: 'xi', ρ: 'rho', σ: 'sigma', τ: 'tau', υ: 'upsilon', φ: 'phi', ϕ: 'phi', χ: 'chi', ψ: 'psi', ω: 'omega', Γ: 'Gamma', Δ: 'Delta', Θ: 'Theta', Λ: 'Lambda', Ξ: 'Xi', Σ: 'Sigma', Φ: 'Phi', Ψ: 'Psi', Ω: 'Omega', π: 'pi', ħ: 'hbar', ℏ: 'hbar', ℓ: 'ell' };
  const UNI_OPS = { '·': '*', '×': '*', '⋅': '*', '∗': '*', '÷': '/', '−': '-', '–': '-', '√': ' sqrt ', '²': '^2', '³': '^3', '⁴': '^4', '½': '(1/2)', '（': '(', '）': ')', '，': ',', '±': '+-' };
  const SPACE_CMD = new Set([',', ';', ':', '!', ' ', 'quad', 'qquad', 'displaystyle', 'textstyle', 'limits', 'nolimits']);
  const SIZE_CMD = new Set(['left', 'right', 'mleft', 'mright', 'bigl', 'bigr', 'Bigl', 'Bigr', 'biggl', 'biggr', 'big', 'Big', 'bigg', 'Bigg']);
  const TEXT_CMD = new Set(['mathrm', 'mathit', 'mathsf', 'mathbf', 'boldsymbol', 'bm', 'text', 'textrm', 'textit', 'operatorname', 'hat', 'widehat', 'vec']);

  /** 常用的 LaTeX 换成上面解析器能读的 ASCII（\frac{a}{b} → ((a)/(b))，下标留成 _{…} 拼进名字）。不认识的命令直接报错。 */
  function latexToAscii(src) {
    const s = String(src ?? '').replace(/\{,\}/g, '.'); // MathLive 把小数逗号写成 {,}
    let i = 0;
    const out = [];
    const absStack = [];
    const group = () => { // 读一个 {…}，返回里面的原文
      let depth = 0; const start = i;
      for (; i < s.length; i++) {
        if (s[i] === '\\') { i++; continue; }
        if (s[i] === '{') depth++;
        else if (s[i] === '}' && --depth === 0) { i++; return s.slice(start + 1, i - 1); }
      }
      throw new Error('unbalanced {');
    };
    const command = () => { // 读 \ 后面的命令名
      i++;
      const m = /^[A-Za-z]+/.exec(s.slice(i));
      if (m) { i += m[0].length; return m[0]; }
      return s[i++] ?? '';
    };
    const arg = () => { // 一个参数：{…}、\命令 或 单个字符
      while (s[i] === ' ') i++;
      if (s[i] === '{') return latexToAscii(group());
      if (s[i] === '\\') { const st = i; command(); return latexToAscii(s.slice(st, i)); }
      if (i >= s.length) throw new Error('missing argument');
      return s[i++];
    };
    const delimiter = (side) => { // \left 之后的括号
      while (s[i] === ' ') i++;
      let d = s[i];
      if (d === '\\') d = command(); else i++;
      if (d === '(' || d === '[' || d === '{' || d === 'lbrace' || d === 'lbrack') return '(';
      if (d === ')' || d === ']' || d === '}' || d === 'rbrace' || d === 'rbrack') return ')';
      if (d === '|' || d === 'vert' || d === 'lvert' || d === 'rvert') { if (side === 'left') { absStack.push(1); return ' abs('; } absStack.pop(); return ')'; }
      if (d === '.') return '';
      throw new Error(`unsupported delimiter ${d}`);
    };
    while (i < s.length) {
      const c = s[i];
      if (c === '\\') {
        const name = command();
        if (name === 'frac' || name === 'dfrac' || name === 'tfrac' || name === 'cfrac') { const a = arg(), b = arg(); out.push(`((${a})/(${b}))`); }
        else if (name === 'sqrt') {
          while (s[i] === ' ') i++;
          if (s[i] === '[') { const k = s.indexOf(']', i); const n = latexToAscii(s.slice(i + 1, k)); i = k + 1; out.push(`((${arg()})^(1/(${n})))`); }
          else out.push(` sqrt(${arg()})`);
        }
        else if (name === 'binom' || name === 'dbinom' || name === 'tbinom') { const a = arg(), b = arg(); out.push(` binom((${a}),(${b}))`); }
        else if (name === 'left' || name === 'mleft') out.push(delimiter('left'));
        else if (name === 'right' || name === 'mright') out.push(delimiter('right'));
        else if (SIZE_CMD.has(name)) out.push(delimiter(/l$/.test(name) ? 'left' : 'right'));
        else if (name === 'cdot' || name === 'times' || name === 'ast') out.push('*');
        else if (name === 'div') out.push('/');
        else if (SPACE_CMD.has(name)) out.push(' ');
        else if (name === '{' || name === 'lbrace') out.push('(');
        else if (name === '}' || name === 'rbrace') out.push(')');
        else if (name === 'hbar' || name === 'hslash') out.push(' hbar ');
        else if (name === 'pi') out.push(' pi ');
        else if (name === 'exponentialE') out.push(' e ');
        else if (name === 'imaginaryI') out.push(' i ');
        else if (name === 'placeholder') throw new Error('placeholder');
        else if (TEXT_CMD.has(name)) { const t = arg().replace(/\s+/g, ''); out.push(` ${t} `); }
        else if (GREEK.includes(name) || FUNCS[name]) out.push(` ${name} `);
        else throw new Error(`unsupported \\${name}`);
      } else if (c === '{') out.push(`(${latexToAscii(group())})`);
      else if (c === '}') throw new Error('unbalanced }');
      else if (c === '^') { // ^{…}、^\alpha、^2 照 LaTeX 只取一个参数；ASCII 的 ^-1、^(1/3) 原样交给解析器
        i++;
        while (s[i] === ' ') i++;
        if (s[i] === '{' || s[i] === '\\' || /[A-Za-z0-9]/.test(s[i] || '')) out.push(`^(${arg()})`); else out.push('^');
      }
      else if (c === '_') { i++; out.push(`_{${arg().replace(/[\s()]/g, '')}}`); }
      else if (c === '~') { i++; out.push(' '); }
      else if (c === '&') throw new Error('alignment');
      else { out.push(c); i++; }
    }
    if (absStack.length) throw new Error('unbalanced |');
    return out.join('');
  }

  /** 把一串字母拆成已知的名字（函数、常数、希腊字母）和单个字母：mL → m·L，pin → π·n，hbar → ħ。 */
  function splitName(run) {
    const parts = [];
    for (let p = 0; p < run.length;) {
      const hit = NAMES.find((n) => run.startsWith(n, p));
      if (hit) { parts.push(hit); p += hit.length; } else { parts.push(run[p]); p++; }
    }
    return parts;
  }

  function tokenize(src) {
    const s = String(src).replace(/[Ͱ-Ͽħℏℓ]/g, (c) => (UNI_GREEK[c] ? ` ${UNI_GREEK[c]} ` : c)).replace(/[·×⋅∗÷−–√²³⁴½（），±]/g, (c) => UNI_OPS[c]);
    const out = [];
    let i = 0;
    while (i < s.length) {
      const c = s[i];
      if (/\s/.test(c)) { i++; continue; }
      if (/[0-9.]/.test(c)) {
        const m = /^(\d+\.?\d*|\.\d+)/.exec(s.slice(i));
        if (!m) throw new Error('bad number');
        out.push({ t: 'num', v: parseFloat(m[1]) }); i += m[1].length; continue;
      }
      if (/[A-Za-z]/.test(c)) {
        const run = /^[A-Za-z]+/.exec(s.slice(i))[0];
        i += run.length;
        const parts = splitName(run);
        let j = i;
        while (s[j] === ' ') j++;
        if (s[j] === '_') {
          j++;
          let sub;
          if (s[j] === '{') { const k = s.indexOf('}', j); if (k < 0) throw new Error('bad subscript'); sub = s.slice(j + 1, k).replace(/\s/g, ''); j = k + 1; } else { sub = s[j] || ''; j++; }
          if (!/^[A-Za-z0-9]+$/.test(sub)) throw new Error('bad subscript');
          parts[parts.length - 1] += `_${sub}`;
          i = j;
        }
        for (const p of parts) out.push(FUNCS[p] || p === 'binom' ? { t: 'fn', name: p } : { t: 'id', name: p });
        continue;
      }
      if (c === '[') { out.push({ t: 'op', v: '(' }); i++; continue; }
      if (c === ']') { out.push({ t: 'op', v: ')' }); i++; continue; }
      if ('+-*/^(),!|'.includes(c)) { out.push({ t: 'op', v: c }); i++; continue; }
      throw new Error(`unexpected ${c}`);
    }
    return out;
  }

  const CONSTS = { pi: [Math.PI, 0], e: [Math.E, 0], i: [0, 1] };
  /** 解析 ASCII 数学：隐式乘法比显式的 * 和 / 结合得紧（1/2m = 1/(2m)），乘方右结合，-x^2 = -(x^2)。返回 { fn(scope) → [re, im], symbols }。 */
  function parseAscii(src) {
    const toks = tokenize(src);
    if (!toks.length) throw new Error('empty');
    let p = 0, inAbs = 0;
    const symbols = new Set();
    const peek = () => toks[p];
    const isOp = (t, v) => !!t && t.t === 'op' && t.v === v;
    const starts = (t) => !!t && (t.t === 'num' || t.t === 'id' || t.t === 'fn' || isOp(t, '(') || (isOp(t, '|') && !inAbs));
    const expect = (v) => { if (!isOp(toks[p++], v)) throw new Error(`expected ${v}`); };
    const N = (k, ...a) => ({ k, a });
    function expr() {
      let a = term();
      for (;;) { const t = peek(); if (isOp(t, '+')) { p++; a = N('add', a, term()); } else if (isOp(t, '-')) { p++; a = N('sub', a, term()); } else return a; }
    }
    function term() {
      let a = implicit();
      for (;;) { const t = peek(); if (isOp(t, '*')) { p++; a = N('mul', a, implicit()); } else if (isOp(t, '/')) { p++; a = N('div', a, implicit()); } else return a; }
    }
    function implicit() { let a = unary(); while (starts(peek())) a = N('mul', a, power()); return a; }
    function unary() {
      const t = peek();
      if (isOp(t, '-')) { p++; return N('neg', unary()); }
      if (isOp(t, '+')) { p++; return unary(); }
      return power();
    }
    function power() { const b = postfix(); if (isOp(peek(), '^')) { p++; return N('pow', b, unary()); } return b; }
    function postfix() { let a = primary(); while (isOp(peek(), '!')) { p++; a = N('fact', a); } return a; }
    // 不带括号的函数参数：一个乘方，再连上后面不是函数的因子（\ln 2x = ln(2x)，\cos\theta\sin\theta = cos θ · sin θ）
    function fnArg() { let a = power(); while (starts(peek()) && peek().t !== 'fn') a = N('mul', a, power()); return a; }
    function primary() {
      const t = toks[p++];
      if (!t) throw new Error('unexpected end');
      if (t.t === 'num') return N('num', t.v);
      if (t.t === 'id') { if (!CONSTS[t.name]) symbols.add(t.name); return N('sym', t.name); }
      if (isOp(t, '(')) { const a = expr(); expect(')'); return a; }
      if (isOp(t, '|') && !inAbs) { inAbs++; const a = expr(); inAbs--; expect('|'); return N('fn', 'abs', [a]); }
      if (t.t === 'fn') {
        let ex = null;
        if (isOp(peek(), '^')) { p++; ex = unary(); }
        let args;
        if (isOp(peek(), '(')) {
          p++;
          const save = inAbs; inAbs = 0;
          args = [expr()];
          while (isOp(peek(), ',')) { p++; args.push(expr()); }
          inAbs = save;
          expect(')');
        } else args = [fnArg()];
        if ((t.name === 'binom') !== (args.length === 2)) throw new Error(`${t.name}: wrong number of arguments`);
        const f = N('fn', t.name, args);
        return ex ? N('pow', f, ex) : f;
      }
      throw new Error('unexpected token');
    }
    const tree = expr();
    if (p < toks.length) throw new Error('trailing input');
    const ev = (n, s) => {
      const [x, y] = n.a;
      switch (n.k) {
        case 'num': return [x, 0];
        case 'sym': return CONSTS[x] || (Object.prototype.hasOwnProperty.call(s, x) ? [s[x], 0] : [NaN, NaN]);
        case 'add': return cadd(ev(x, s), ev(y, s));
        case 'sub': return csub(ev(x, s), ev(y, s));
        case 'mul': return cmul(ev(x, s), ev(y, s));
        case 'div': return cdiv(ev(x, s), ev(y, s));
        case 'neg': { const v = ev(x, s); return [-v[0], -v[1]]; }
        case 'pow': return cpow(ev(x, s), ev(y, s));
        case 'fact': return [factorial(intOf(ev(x, s))), 0];
        case 'fn': {
          const args = y.map((a) => ev(a, s));
          if (x === 'binom') return [binom(intOf(args[0]), intOf(args[1])), 0];
          return FUNCS[x](args[0]);
        }
        default: return [NaN, NaN];
      }
    };
    return { fn: (scope) => ev(tree, scope || {}), symbols };
  }

  /** 本文件自带的引擎：LaTeX 和 ASCII 都先过 latexToAscii（纯 ASCII 原样通过），再解析。 */
  const basicEngine = {
    name: 'basic',
    parse(src) { return parseAscii(latexToAscii(src)); },
    evaluate(x, scope) { return x.fn(scope); },
  };

  // Compute Engine 的符号名换成本文件用的名字：\hbar 在 CE 里叫 hBar
  const CANON = { hBar: 'hbar', epsilonSymbol: 'epsilon', varepsilon: 'epsilon', vartheta: 'theta', varphi: 'phi', varrho: 'rho' };
  const canon = (name) => { const n = String(name).replace(/[\\{}\s]/g, ''); return CANON[n] || n; };
  /** 把一个 ComputeEngine 实例包成判分用的 engine。 */
  function ceEngine(ce) {
    return {
      name: 'ce',
      parse(src) {
        const e = ce.parse(src);
        if (!e || e.isValid === false) throw new Error('syntax');
        const names = new Map();
        for (const n of e.unknowns || []) names.set(canon(n), n);
        return { e, names, symbols: new Set(names.keys()) };
      },
      evaluate(x, scope) {
        const subs = {};
        for (const [c, n] of x.names) if (Object.prototype.hasOwnProperty.call(scope, c)) subs[n] = scope[c];
        const v = x.e.subs(subs).N();
        return [Number(v.re), Number(v.im)];
      },
      equal(a, b) { return a.e.isEqual(b.e); },
    };
  }

  // ── 把输入拆成值：逗号分隔的列表、λ = …、± ──────────────────────────
  const OPEN = '{([', CLOSE = '})]';
  function splitTop(s) {
    const parts = [];
    let depth = 0, start = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (c === '\\' && /[{}]/.test(s[i + 1] || '')) { depth += s[i + 1] === '{' ? 1 : -1; i++; continue; }
      if (OPEN.includes(c)) depth++;
      else if (CLOSE.includes(c)) depth--;
      else if ((c === ',' || c === ';' || c === '，') && depth === 0) { parts.push(s.slice(start, i)); start = i + 1; }
    }
    parts.push(s.slice(start));
    return parts;
  }
  const balanced = (s) => { let d = 0; for (let i = 0; i < s.length; i++) { const c = s[i]; if (c === '\\' && /[{}]/.test(s[i + 1] || '')) { d += s[i + 1] === '{' ? 1 : -1; i++; } else if (OPEN.includes(c)) d++; else if (CLOSE.includes(c)) d--; if (d < 0) return false; } return d === 0; };
  const WRAPS = [['\\left\\{', '\\right\\}'], ['\\left(', '\\right)'], ['\\left[', '\\right]'], ['\\mleft(', '\\mright)'], ['\\{', '\\}'], ['\\lbrace', '\\rbrace'], ['(', ')'], ['[', ']'], ['{', '}']];
  /** 去掉把整个列表包起来的括号：\{1, 3\}、(1, 3)。 */
  function unwrap(s) {
    for (const [o, c] of WRAPS) {
      if (s.startsWith(o) && s.endsWith(c)) {
        const inner = s.slice(o.length, s.length - c.length);
        if (balanced(inner) && splitTop(inner).length > 1) return inner;
      }
    }
    return s;
  }
  /** λ₁ = 3 → 3：取最后一个顶层的 = 或 ≈ 后面的部分。 */
  function stripLhs(s) {
    let depth = 0, cut = -1, len = 0;
    for (let i = 0; i < s.length; i++) {
      const c = s[i];
      if (OPEN.includes(c)) depth++;
      else if (CLOSE.includes(c)) depth--;
      else if (depth === 0) {
        if (c === '=' || c === '≈') { cut = i; len = 1; }
        else if (s.startsWith('\\approx', i)) { cut = i; len = 7; }
      }
    }
    return cut < 0 ? s : s.slice(cut + len);
  }
  /** a \pm b → [a + b, a − b]（ASCII 写 +- 或 ±）。 */
  function expandPm(s) {
    if (!/\\pm|\\mp|±|\+-/.test(s)) return [s];
    return [['+', '-'], ['-', '+']].map(([pm, mp]) => s.replace(/\\pm(?![a-z])|±|\+-/g, pm).replace(/\\mp(?![a-z])/g, mp));
  }
  /** 帽子、粗体之类的修饰去掉：\hat{p} → p。 */
  const undecorate = (s) => s.replace(/\\(?:hat|widehat|vec|boldsymbol|mathbf|bm)\s*\{([^{}]*)\}/g, ' $1').replace(/\\(?:hat|widehat|vec)\s*([A-Za-z])/g, ' $1').replace(/\\(?:displaystyle|textstyle)/g, '');
  function pieces(src) {
    let s = undecorate(String(src ?? '').trim()).replace(/^\$+|\$+$/g, '').replace(/(\\[,;:! ]|\\q?quad|~|\s)+$/g, '').replace(/[.。]$/, '').trim();
    s = unwrap(s);
    return splitTop(s).flatMap((p) => expandPm(stripLhs(p).trim())).map((p) => p.trim()).filter(Boolean);
  }
  const hasPlaceholder = (s) => /\\placeholder|⬚/.test(String(s ?? ''));

  // ── 取样与比较 ────────────────────────────────────────────────────────
  const DEFAULT_RANGE = [0.6, 2.4];
  const N_POINTS = 10, MIN_POINTS = 4, CLOSE_TOL = 5e-3;
  function rng(seed) {
    let a = seed >>> 0;
    return () => { a = (a + 0x6D2B79F5) >>> 0; let t = a; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  }
  const hash = (s) => { let h = 2166136261; for (const ch of String(s)) { h ^= ch.codePointAt(0); h = Math.imul(h, 16777619); } return h >>> 0; };
  /** 一个变量的随机取值：'int' 取 1–8 的整数，[lo, hi] 取区间里的实数，其他取 0.6–2.4（物理量默认是正的）。 */
  function sampleValue(spec, rand) {
    if (spec === 'int') return 1 + Math.floor(rand() * 8);
    const [lo, hi] = Array.isArray(spec) ? spec : DEFAULT_RANGE;
    return lo + (hi - lo) * rand();
  }
  const finite = (v) => Array.isArray(v) && Number.isFinite(v[0]) && Number.isFinite(v[1]);
  const near = (a, b, rtol) => Math.hypot(a[0] - b[0], a[1] - b[1]) <= rtol * Math.max(cabs(a), cabs(b)) + 1e-12;
  function makePoints(names, q, engine, defs, seed) {
    const rand = rng(seed);
    const pts = [];
    for (let k = 0; k < N_POINTS; k++) {
      const s = {};
      for (const n of names) if (!defs.has(n)) s[n] = sampleValue(q.vars?.[n], rand);
      for (const [n, x] of defs) { try { s[n] = engine.evaluate(x, s)[0]; } catch { s[n] = NaN; } }
      pts.push(s);
    }
    return pts;
  }
  /** cand 和参考答案 ref 在取样点上都相等吗？参考答案在某点不可求值（奇点、定义域外）就跳过这一点。 */
  function agree(engine, ref, cand, points, rtol) {
    let used = 0;
    for (const p of points) {
      let a, b;
      try { a = engine.evaluate(ref, p); } catch { continue; }
      if (!finite(a)) continue;
      try { b = engine.evaluate(cand, p); } catch { return false; }
      if (!finite(b) || !near(a, b, rtol)) return false;
      used++;
    }
    return used >= MIN_POINTS;
  }
  function same(engine, ref, cand, points, rtol, symbolic) {
    if (symbolic && engine.equal) { try { if (engine.equal(ref, cand) === true) return true; } catch { /* fall back to numbers */ } }
    return agree(engine, ref, cand, points, rtol);
  }
  /** 两个值的列表不计顺序地一一相等。 */
  function sameList(engine, refs, cands, points, rtol, symbolic) {
    if (refs.length !== cands.length) return false;
    const used = new Array(refs.length).fill(false);
    return cands.every((c) => {
      const j = refs.findIndex((r, k) => !used[k] && same(engine, r, c, points, rtol, symbolic));
      if (j < 0) return false;
      used[j] = true;
      return true;
    });
  }
  const symbolsOf = (list) => list.flatMap((x) => [...x.symbols]);

  const caches = new WeakMap();
  /** 题目数据按 engine 解析一次：答案、等价写法、常见错误、定义（如 h = 2πħ）。数据有错就抛出。 */
  function compile(q, engine) {
    let byQ = caches.get(engine);
    if (!byQ) { byQ = new WeakMap(); caches.set(engine, byQ); }
    if (byQ.has(q)) return byQ.get(q);
    const P = (src) => { const ps = pieces(src); if (!ps.length) throw new Error(`${q.id}: empty`); return ps.map((p) => engine.parse(p)); };
    const defs = new Map(Object.entries(q.defs || {}).map(([k, v]) => [k, engine.parse(v)]));
    const c = { answer: P(q.answer), alts: (q.alt || []).map(P), wrong: (q.wrong || []).map((w) => P(w.a)), defs };
    c.allowed = new Set([...Object.keys(q.vars || {}), ...defs.keys(), ...symbolsOf(c.answer), ...c.alts.flatMap(symbolsOf), ...c.wrong.flatMap(symbolsOf), ...[...defs.values()].flatMap((x) => [...x.symbols])]);
    c.needed = new Set(symbolsOf(c.answer));
    byQ.set(q, c);
    return c;
  }

  /**
   * 判一次答案。q：{ id, answer, alt?, vars?, defs?, wrong: [{ a, hint }], tol? }；engine：见上。
   * 返回 { verdict }：empty | placeholder | syntax | correct | misconception（带 index）| symbols（多出来的符号）|
   * missing（缺的符号）| count（应有几个值，expected）| close（只差在小数位）| wrong。
   */
  function check(input, q, engine, opts = {}) {
    const raw = String(input ?? '').trim();
    if (!raw) return { verdict: 'empty' };
    if (hasPlaceholder(raw)) return { verdict: 'placeholder' };
    const c = compile(q, engine);
    let mine;
    try {
      const ps = pieces(raw);
      if (!ps.length) return { verdict: 'empty' };
      mine = ps.map((p) => engine.parse(p));
    } catch { return { verdict: 'syntax' }; }
    const syms = new Set(symbolsOf(mine));
    const names = [...new Set([...c.allowed, ...syms])].sort();
    const points = makePoints(names, q, engine, c.defs, opts.seed ?? hash(q.id || q.answer));
    const rtol = q.tol ?? 1e-6;
    if ([c.answer, ...c.alts].some((ans) => sameList(engine, ans, mine, points, rtol, true))) return { verdict: 'correct' };
    const k = c.wrong.findIndex((w) => sameList(engine, w, mine, points, rtol, false));
    if (k >= 0) return { verdict: 'misconception', index: k };
    const extra = [...syms].filter((s) => !c.allowed.has(s));
    if (extra.length) return { verdict: 'symbols', symbols: extra };
    const covered = new Set(syms);
    for (const s of syms) if (c.defs.has(s)) for (const t of c.defs.get(s).symbols) covered.add(t);
    for (const [d, x] of c.defs) if ([...x.symbols].every((t) => covered.has(t))) covered.add(d);
    const missing = [...c.needed].filter((s) => !covered.has(s));
    if (missing.length) return { verdict: 'missing', symbols: missing };
    if (mine.length !== c.answer.length) return { verdict: 'count', expected: c.answer.length };
    if (/\d[.,]\d|\.\d|\{,\}/.test(raw) && sameList(engine, c.answer, mine, points, CLOSE_TOL, false)) return { verdict: 'close' };
    return { verdict: 'wrong' };
  }

  // 符号的显示：hbar → ħ，k_B → k<sub>B</sub>；插入按钮用的 LaTeX
  const PRETTY = { hbar: 'ħ', alpha: 'α', beta: 'β', delta: 'δ', epsilon: 'ε', eta: 'η', theta: 'θ', kappa: 'κ', lambda: 'λ', mu: 'μ', nu: 'ν', xi: 'ξ', rho: 'ρ', sigma: 'σ', tau: 'τ', phi: 'φ', chi: 'χ', psi: 'ψ', omega: 'ω', Delta: 'Δ', Theta: 'Θ', Lambda: 'Λ', Sigma: 'Σ', Phi: 'Φ', Psi: 'Ψ', Omega: 'Ω', ell: 'ℓ' };
  const splitSub = (name) => { const k = name.indexOf('_'); return k < 0 ? [name, ''] : [name.slice(0, k), name.slice(k + 1)]; };
  const symbolText = (name) => { const [b, sub] = splitSub(name); return (PRETTY[b] || b) + (sub ? `_${sub}` : ''); };
  const symbolLatex = (name) => { const [b, sub] = splitSub(name); const base = PRETTY[b] ? `\\${b}` : b; return sub ? `${base}_{${sub}}` : base; };
  const needsKey = (name) => { const [b, sub] = splitSub(name); return !!PRETTY[b] || !!sub; };

  const pure = { MATHLIVE_VERSION, CE_VERSION, MATHLIVE_SRC, CE_SRC, latexToAscii, parseAscii, basicEngine, ceEngine, canon, pieces, splitTop, stripLhs, expandPm, unwrap, hasPlaceholder, sampleValue, rng, check, compile, symbolText, symbolLatex, needsKey };
  if (typeof module === 'object' && module.exports) { module.exports = pure; return; }

  // ── 浏览器 ──────────────────────────────────────────────────────────────
  const doc = root.document;
  const esc = (v) => String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  // 题面里的 x^{…}、E_n、k_B 写成上下标（和 fm.js、qp.js 的写法一样）
  const rich = (s) => esc(s)
    .replace(/\^\{([^}]*)\}/g, '<sup>$1</sup>')
    .replace(/([\p{L}0-9ħ])_(\{[^}]*\}|[A-Za-z0-9αβ]+)/gu, (_, a, b) => `${a}<sub>${b.replace(/[{}]/g, '')}</sub>`);
  const isEn = () => doc.documentElement.lang === 'en';
  const store = {
    get(k) { try { const v = JSON.parse(localStorage.getItem(k) || '[]'); return Array.isArray(v) ? v : []; } catch { return []; } },
    set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch { /* private mode */ } },
  };

  let mathlive = null, ce = null, mode = null; // mode：'math'（MathLive）或 'text'（普通文本框）
  /** 载入 MathLive（只载一次），它会注册 <math-field>。 */
  function loadMathLive() {
    if (root.MathLive?.MathfieldElement) return Promise.resolve(root.MathLive);
    if (mathlive) return mathlive;
    mathlive = new Promise((resolve, reject) => {
      const s = doc.createElement('script');
      s.src = MATHLIVE_SRC; s.async = true; s.crossOrigin = 'anonymous';
      s.onload = () => (root.MathLive?.MathfieldElement ? resolve(root.MathLive) : reject(new Error('MathLive 载入后不可用')));
      s.onerror = () => reject(new Error('MathLive 载入失败（需要联网访问 cdn.jsdelivr.net）'));
      doc.head.append(s);
    });
    return mathlive;
  }
  /** 载入 Compute Engine（只载一次），失败后下次再试。 */
  function loadCE() {
    if (ce) return ce;
    ce = import(CE_SRC).then((m) => ceEngine(new m.ComputeEngine())).catch((e) => { ce = null; throw e; });
    return ce;
  }
  const timeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), ms))]);

  const dark = () => { const t = doc.documentElement.dataset.theme; return t === 'dark' || (t !== 'light' && matchMedia('(prefers-color-scheme: dark)').matches); };
  // MathLive 的虚拟键盘看 body[theme]；站点的主题在 html[data-theme]
  const syncTheme = () => { if (doc.body) doc.body.setAttribute('theme', dark() ? 'dark' : 'light'); };

  const blocks = new Set();
  function mount(el, items, opts = {}) {
    if (!el || el.dataset.fqOn) return;
    el.dataset.fqOn = '1';
    const en = isEn(), lang = en ? 'en' : 'zh-CN';
    const L = (zh, e) => esc(en ? e : zh);
    const tx = (t) => (t ? (en ? t.en : t.zh) : '');
    const MATH = opts.math || {}, TEX = opts.tex || {};
    const solved = new Set(store.get(opts.store));
    const formula = (key, tex) => (MATH[key] ? `<div class="fs-formula" tabindex="0">${MATH[key]}</div>` : `<pre class="fs-formula fs-tex">${esc(TEX[key]?.[0] ?? tex ?? '')}</pre>`);
    const varsLine = (q) => {
      const vs = Object.keys(q.vars || {});
      if (!vs.length) return '';
      const defs = Object.keys(q.defs || {});
      return `<p class="fq-vars">${L('可用的符号：', 'Symbols you can use: ')}${vs.map((v) => `<span class="fq-sym">${rich(symbolText(v))}</span>`).join(', ')}${defs.length ? L(`（也可以用 ${defs.map(symbolText).join('、')}）`, ` (or ${defs.map(symbolText).join(', ')})`) : ''}</p>`;
    };
    el.setAttribute('translate', 'no');
    el.setAttribute('lang', lang);
    el.classList.add('fq');
    el.innerHTML = `<h4 class="fq-h">${L('动手算一算', 'Work it out')}</h4>
      <p class="fq-lead">${L('把答案写成公式，按“检查”或回车。答案和常见错误对上时会给针对性的提示；错两次后多一条总提示，错三次后显示解答，也可以随时点“显示解答”。', 'Type the answer as a formula and press Check or Enter. If it matches a common mistake you get a hint aimed at that mistake; after two tries a general nudge appears, after three the worked answer (or open it any time).')}</p>
      <p class="fq-help">${L('分式用 /，乘方用 ^，下标用 _，根号输入 sqrt；在手机和平板上点输入框会弹出数学键盘。', 'Type / for a fraction, ^ for a power, _ for a subscript and sqrt for a root; on phones and tablets a maths keyboard appears when you tap the box.')}</p>
      <p class="fq-note" hidden></p>
      <ol class="fq-list">${items.map((q, i) => `<li class="fq-item" id="fq-${esc(q.id)}" data-q="${esc(q.id)}">
        <div class="fq-q"><span class="fq-n" aria-hidden="true">${i + 1}</span><p>${rich(tx(q.q))}${solved.has(q.id) ? ` <span class="fq-done">${L('已答对过', 'Solved before')}</span>` : ''}</p></div>
        ${q.tex ? formula(q.id, q.tex) : ''}${varsLine(q)}
        <div class="fq-row"><div class="fq-box"><span class="fq-wait">${L('公式输入框载入中…', 'Loading the formula box…')}</span></div><button type="button" class="button primary fq-check">${L('检查', 'Check')}</button></div>
        <div class="fq-keys" hidden></div>
        <p class="fq-fb" role="status" aria-live="polite"></p>
        <p class="fq-hint" hidden></p>
        <p class="fq-more"><button type="button" class="button fq-show" aria-expanded="false" aria-controls="fq-${esc(q.id)}-sol">${L('显示解答', 'Show worked answer')}</button></p>
        <div class="fq-sol" id="fq-${esc(q.id)}-sol" hidden><p class="fq-sol-h">${L('解答', 'Worked answer')}</p>${(q.steps || []).map((s, k) => (typeof s === 'string' ? formula(`${q.id}:${k}`, s) : `<p>${rich(tx(s))}</p>`)).join('')}</div>
      </li>`).join('')}</ol>`;

    const byId = new Map(items.map((q) => [q.id, q]));
    const state = new Map(); // li → { q, read, tries, last }
    for (const li of el.querySelectorAll('.fq-item')) state.set(li, { q: byId.get(li.dataset.q), read: null, tries: 0, last: null });
    const note = el.querySelector('.fq-note');
    const showNote = (zh, e) => { note.textContent = en ? e : zh; note.hidden = false; };
    const setFb = (li, kind, html) => { const fb = li.querySelector('.fq-fb'); fb.dataset.state = kind; fb.innerHTML = html; };
    const openSol = (li, open) => {
      const sol = li.querySelector('.fq-sol'), b = li.querySelector('.fq-show');
      sol.hidden = !open; b.setAttribute('aria-expanded', String(open));
      b.textContent = open ? (en ? 'Hide worked answer' : '收起解答') : (en ? 'Show worked answer' : '显示解答');
    };

    // 输入框：MathLive 或普通文本框
    const build = (kind) => {
      if (el.dataset.fqInput) return;
      el.dataset.fqInput = kind;
      if (kind === 'text') showNote('公式输入框没有载入（需要联网访问 cdn.jsdelivr.net），改用普通文本框：乘号写 *，除号写 /，乘方写 ^，例如 n^2*pi^2*hbar^2/(2*m*L^2)、sqrt(2/L)、e^(-2*kappa*t)。希腊字母和 ħ 用下面的按钮或直接写名字（alpha、hbar）。',
        'The formula box did not load (it needs cdn.jsdelivr.net), so this is a plain text box: write * for times, / for divide and ^ for powers, e.g. n^2*pi^2*hbar^2/(2*m*L^2), sqrt(2/L), e^(-2*kappa*t). Use the buttons below or type the names (alpha, hbar) for Greek letters and ħ.');
      let n = 0;
      for (const [li, st] of state) {
        n++;
        const box = li.querySelector('.fq-box');
        const label = en ? `Your answer to question ${n}` : `第 ${n} 题的答案`;
        let field;
        if (kind === 'math') {
          field = new root.MathLive.MathfieldElement();
          field.className = 'fq-mf';
          field.setAttribute('aria-label', label);
          try { field.mathVirtualKeyboardPolicy = 'auto'; field.smartMode = false; } catch { /* older MathLive */ }
          st.read = () => field.value;
          st.insert = (k) => { field.executeCommand(['insert', k.latex]); field.focus(); };
        } else {
          field = doc.createElement('input');
          Object.assign(field, { type: 'text', className: 'fq-text', autocomplete: 'off', spellcheck: false });
          field.setAttribute('autocapitalize', 'off');
          field.setAttribute('aria-label', label);
          field.placeholder = en ? 'e.g. sqrt(2/L)' : '例如 sqrt(2/L)';
          st.read = () => field.value;
          st.insert = (k) => { const a = field.selectionStart ?? field.value.length, b = field.selectionEnd ?? a; field.setRangeText(k.ascii, a, b, 'end'); field.focus(); };
        }
        field.addEventListener('keydown', (e) => { if (e.key === 'Enter' && !e.shiftKey && !e.isComposing) { e.preventDefault(); grade(li); } });
        field.addEventListener('focus', () => { loadCE().catch(() => {}); });
        box.replaceChildren(field);
        const keys = Object.keys(st.q.vars || {}).concat(Object.keys(st.q.defs || {})).filter(needsKey).map((v) => ({ text: symbolText(v), latex: symbolLatex(v), ascii: v }));
        if (keys.length) {
          const row = li.querySelector('.fq-keys');
          row.innerHTML = keys.map((k, j) => `<button type="button" class="fq-key" data-k="${j}" aria-label="${esc((en ? 'Insert ' : '插入 ') + k.text)}">${rich(k.text)}</button>`).join('');
          row.hidden = false;
          row.addEventListener('pointerdown', (e) => { if (e.target.closest('.fq-key')) e.preventDefault(); });
          row.addEventListener('click', (e) => { const b = e.target.closest('.fq-key'); if (b) st.insert(keys[Number(b.dataset.k)]); });
        }
      }
    };
    const upgrade = () => {
      if (el.dataset.fqInput || el.dataset.fqLoading) return;
      if (mode) { build(mode); return; }
      el.dataset.fqLoading = '1';
      timeout(loadMathLive(), 20000).then((ML) => {
        if (!mode) {
          mode = 'math';
          try { ML.MathfieldElement.fontsDirectory = MATHLIVE_FONTS; ML.MathfieldElement.soundsDirectory = null; } catch { /* keep defaults */ }
          syncTheme();
          new MutationObserver(syncTheme).observe(doc.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
        }
      }, () => { if (!mode) mode = 'text'; }).then(() => { for (const b of blocks) if (b.isConnected && b.dataset.fqSeen) b.fqBuild(mode); });
    };
    el.fqBuild = build;
    blocks.add(el);

    const io = 'IntersectionObserver' in root ? new IntersectionObserver((ents) => { if (ents.some((x) => x.isIntersecting)) { io.disconnect(); el.dataset.fqSeen = '1'; upgrade(); } }, { rootMargin: '300px 0px' }) : null;
    if (io) io.observe(el); else { el.dataset.fqSeen = '1'; upgrade(); }
    el.addEventListener('focusin', () => { el.dataset.fqSeen = '1'; upgrade(); loadCE().catch(() => {}); });

    // 判分与反馈
    const plural = (n) => (n === 1 ? L('这道题只要一个答案。', 'This question wants a single answer.') : L(`这道题要 ${n} 个值，用逗号隔开。`, `This question wants ${n} values, separated by commas.`));
    const symList = (list) => list.map((s) => `<span class="fq-sym">${rich(symbolText(s))}</span>`).join(en ? ', ' : '、');
    async function grade(li) {
      const st = state.get(li);
      if (!st.read) { setFb(li, 'info', L('公式输入框还在载入，请稍等。', 'The formula box is still loading; one moment.')); upgrade(); return; }
      const value = st.read();
      let engine = basicEngine;
      if (el.dataset.fqInput === 'math') {
        setFb(li, 'info', L('正在判分…', 'Checking…'));
        try { engine = await timeout(loadCE(), 25000); } catch {
          engine = basicEngine;
          showNote('公式引擎没有载入（需要联网访问 cdn.jsdelivr.net），改用本站自带的简单判分；写法太复杂时可能读不出来。', 'The formula engine did not load (it needs cdn.jsdelivr.net), so a simpler built-in grader is used; very elaborate input may not be readable.');
        }
      }
      let r;
      try { r = check(value, st.q, engine); } catch { r = { verdict: 'error' }; }
      const v = r.verdict;
      const graded = ['correct', 'misconception', 'symbols', 'missing', 'count', 'close', 'wrong'].includes(v);
      if (graded && v !== 'correct' && value !== st.last) st.tries++;
      if (graded) st.last = value;
      const msg = {
        empty: ['info', L('先写下你的答案。', 'Type your answer first.')],
        placeholder: ['info', L('还有空着的方框没有填。', 'There is still an empty box to fill in.')],
        syntax: ['info', L('这个式子读不出来：检查括号、分式和上下标。', 'Could not read this expression: check brackets, fractions and sub- or superscripts.')],
        error: ['bad', L('这道题的数据有问题，暂时判不了分。', 'This question has a data problem and cannot be graded right now.')],
        correct: ['ok', L('答对了。', 'Correct.')],
        misconception: ['hint', `${L('提示：', 'Hint: ')}${rich(tx(st.q.wrong?.[r.index]?.hint))}`],
        symbols: ['hint', `${L('你的答案里有题目没有用到的符号：', 'Your answer uses symbols the question does not: ')}${symList(r.symbols || [])}${L('。', '.')}`],
        missing: ['hint', `${L('答案里应该出现：', 'The answer should contain: ')}${symList(r.symbols || [])}${L('。', '.')}`],
        count: ['hint', plural(r.expected)],
        close: ['hint', L('数值很接近，但请写出精确的形式（分数、根号、π 之类）。', 'Close in value, but please give the exact form (fractions, roots, π and so on).')],
        wrong: ['bad', L('还不对。', 'Not yet.')],
      }[v];
      setFb(li, msg[0], msg[1]);
      const hint = li.querySelector('.fq-hint');
      if (v === 'correct') {
        hint.hidden = true;
        if (!solved.has(st.q.id) && opts.store) { // 同一页的其他题目块也写这个键：先读最新的再合并
          solved.add(st.q.id);
          store.set(opts.store, [...new Set([...store.get(opts.store), st.q.id])]);
        }
        return;
      }
      if (graded && st.tries >= 2 && st.q.hint) { hint.innerHTML = `${L('再想想：', 'A nudge: ')}${rich(tx(st.q.hint))}`; hint.hidden = false; }
      if (graded && st.tries >= 3 && li.querySelector('.fq-sol').hidden) {
        openSol(li, true);
        setFb(li, msg[0], `${msg[1]} ${L('已经试了三次，下面是解答；看完可以再试一次。', 'Three tries: the worked answer is below, and you can still try again.')}`);
      }
    }
    el.addEventListener('click', (e) => {
      const li = e.target.closest('.fq-item'); if (!li) return;
      if (e.target.closest('.fq-check')) grade(li);
      else if (e.target.closest('.fq-show')) openSol(li, li.querySelector('.fq-sol').hidden);
    });
  }

  /** 挂上页面里所有 [data-fq] 容器。 */
  function autoMount() {
    for (const el of doc.querySelectorAll('[data-fq]')) {
      const data = root[el.dataset.fq], items = data?.items?.[el.dataset.fqItem];
      if (!items?.length) { el.hidden = true; continue; }
      mount(el, items, { math: root[`${el.dataset.fq}_MATH`] || {}, tex: data.math || {}, store: el.dataset.fqStore || '' });
    }
  }

  root.MolAstriaFormulaCheck = { ...pure, loadMathLive, loadCE, mount, autoMount };
  if (doc.readyState === 'loading') doc.addEventListener('DOMContentLoaded', autoMount); else autoMount();
})(typeof window !== 'undefined' ? window : globalThis);
