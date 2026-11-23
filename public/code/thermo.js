/* 热化学面板：代码台“输出解读”和计算工作台“光谱与输出”读到频率输出后，在下面算 ZPE、H、T·S、G。数学在 thermo-core.js（GoodVibes 的移植）。
   用法：MolAstriaThermoUI.mount(容器, 输出全文, MolAstriaCode.parseOutput 的结果)。没有频率、或没有结构和质量，就什么也不画、返回 false。
   输出里没印转动对称数时，按结构判点群（按需载入 ../group-theory/gt-models.js 的 analyseXYZ）。
   文字自带中英两版，标 translate="no"。选项存 localStorage 的 molastria-thermo。 */
(() => {
  'use strict';
  const TH = window.MolAstriaThermo;
  if (!TH || window.MolAstriaThermoUI) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const KEY = 'molastria-thermo';
  const readPrefs = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
  const savePrefs = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* 隐私模式：只是下次不记得 */ } };
  const SRC = (document.currentScript && document.currentScript.src) || location.href;
  const GT_URL = new URL('../group-theory/gt-models.js', SRC).href;
  let gtLoading = null;
  function loadGroupModels() {
    if (window.MOLASTRIA_GROUP_MODELS) return Promise.resolve(window.MOLASTRIA_GROUP_MODELS);
    if (!gtLoading) gtLoading = new Promise((res, rej) => { const s = Object.assign(document.createElement('script'), { src: GT_URL, async: true }); s.onload = () => (window.MOLASTRIA_GROUP_MODELS ? res(window.MOLASTRIA_GROUP_MODELS) : rej(new Error('gt'))); s.onerror = rej; document.head.append(s); }).catch((e) => { gtLoading = null; throw e; });
    return gtLoading;
  }
  const PROG = { gaussian: 'Gaussian', orca: 'ORCA', xtb: 'xTB', psi4: 'Psi4', pyscf: 'PySCF', nwchem: 'NWChem', cp2k: 'CP2K', qchem: 'Q-Chem' };
  let uid = 0;

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function mount(el, text, parsed) {
    if (!parsed || !parsed.freqs || !parsed.freqs.length) { el.replaceChildren(); return false; }
    const info = TH.fromOutput(text, parsed);
    // 只有频率、没有结构和质量（多是摘录）：平动和转动没法算，整块不画，免得只剩一排控件和一行报错
    if (!TH.usable(info)) { el.replaceChildren(); return false; }
    const p = readPrefs();
    const id = `th${++uid}`;
    const st = {
      T: Number(p.T) > 0 ? Number(p.T) : 298.15, std: ['1atm', '1M', 'conc'].includes(p.std) ? p.std : '1atm', conc: Number(p.conc) > 0 ? Number(p.conc) : 1,
      qs: ['grimme', 'truhlar', 'rrho'].includes(p.qs) ? p.qs : 'grimme', sCutoff: Number(p.sCutoff) >= 0 ? Number(p.sCutoff) || 100 : 100, alpha: Number(p.alpha) > 0 ? Number(p.alpha) : 4,
      qh: !!p.qh, hCutoff: Number(p.hCutoff) > 0 ? Number(p.hCutoff) : 100, scale: Number(p.scale) > 0 ? Number(p.scale) : 1, zpeScale: '', invert: false, invertAt: -50,
      mult: info.mult || 1, sigma: info.sigma || 1, sigmaFrom: info.sigma ? 'output' : 'none', pg: info.pointGroup || '',
    };
    const nAtoms = (info.atoms || []).length;
    el.className = 'th-box';
    el.setAttribute('translate', 'no');
    el.id = el.id || `${id}-box`;
    el.innerHTML = `
      <div class="th-head"><h4>${L('热化学：ZPE、H、T·S、G', 'Thermochemistry: ZPE, H, T·S, G')}</h4><span class="th-meta">${esc(PROG[info.program] || info.program || '')} · ${L(`${info.freqs.length} 个频率`, `${info.freqs.length} frequencies`)}${nAtoms ? L(` · ${nAtoms} 个原子`, ` · ${nAtoms} atoms`) : ''}</span></div>
      <div class="th-controls">
        <label>${L('温度', 'Temperature')} <input type="number" min="1" max="5000" step="0.01" data-k="T" value="${st.T}" inputmode="decimal"> K</label>
        <label>${L('标准态', 'Standard state')} <select data-k="std"><option value="1atm">${L('1 atm 理想气体', '1 atm ideal gas')}</option><option value="1M">${L('1 mol/L（溶液）', '1 mol/L (solution)')}</option><option value="conc">${L('自定浓度', 'Custom concentration')}</option></select></label>
        <label data-show="conc">${L('浓度', 'Concentration')} <input type="number" min="0.000001" step="any" data-k="conc" value="${st.conc}" inputmode="decimal"> mol/L</label>
        <label>${L('熵', 'Entropy')} <select data-k="qs"><option value="grimme">${L('Grimme 准 RRHO', 'Grimme quasi-RRHO')}</option><option value="truhlar">${L('Truhlar：抬高低频', 'Truhlar: raise low modes')}</option><option value="rrho">${L('纯谐振子（RRHO）', 'Harmonic only (RRHO)')}</option></select></label>
        <label data-show="cut">${L('截止频率', 'Cutoff')} <input type="number" min="0" max="1000" step="1" data-k="sCutoff" value="${st.sCutoff}" inputmode="numeric"> cm⁻¹</label>
        <label data-show="alpha" title="${L('阻尼函数 1/(1 + (ν₀/ν)^α) 的指数，Grimme 用 4', 'Exponent of the damping 1/(1 + (ν₀/ν)^α); Grimme uses 4')}">α <input type="number" min="1" max="20" step="1" data-k="alpha" value="${st.alpha}" inputmode="numeric"></label>
        <label class="th-check"><input type="checkbox" data-k="qh"${st.qh ? ' checked' : ''}> ${L('Head-Gordon 准谐焓', 'Head-Gordon quasi-harmonic enthalpy')}</label>
        <label data-show="qh">${L('焓的截止频率', 'Enthalpy cutoff')} <input type="number" min="1" max="1000" step="1" data-k="hCutoff" value="${st.hCutoff}" inputmode="numeric"> cm⁻¹</label>
        <label title="${L('谐振频率普遍偏高，常乘一个校正因子；按方法和基组查 NIST CCCBDB 或 Truhlar 组的表', 'Harmonic frequencies run high; look up the factor for your method and basis in NIST CCCBDB or the Truhlar group database')}">${L('频率校正因子', 'Frequency scale factor')} <input type="number" min="0.5" max="1.5" step="0.001" data-k="scale" value="${st.scale}" inputmode="decimal"></label>
        <label>${L('ZPE 校正因子', 'ZPE scale factor')} <input type="number" min="0.5" max="1.5" step="0.001" data-k="zpeScale" placeholder="${L('同上', 'same')}" inputmode="decimal"></label>
        <label>${L('自旋多重度', 'Spin multiplicity')} <input type="number" min="1" max="20" step="1" data-k="mult" value="${st.mult}" inputmode="numeric"></label>
        <label>${L('转动对称数 σ', 'Rotational symmetry number σ')} <input type="number" min="1" max="120" step="1" data-k="sigma" value="${st.sigma}" inputmode="numeric"></label>
        <span class="th-sig" aria-live="polite"></span>
        <label class="th-check" data-show="imag"><input type="checkbox" data-k="invert"> ${L('把小虚频当实频，阈值', 'Treat small imaginary modes as real, above')} <input type="number" max="0" step="1" data-k="invertAt" value="${st.invertAt}" inputmode="numeric"> cm⁻¹</label>
      </div>
      <div class="th-result" aria-live="polite"></div>
      <details class="th-terms"><summary>${L('各项分解', 'Breakdown by contribution')}</summary><div class="th-termbox"></div></details>
      <div class="th-actions"><button type="button" data-act="csv">${L('下载 CSV', 'Download CSV')}</button><button type="button" data-act="copy">${L('复制结果', 'Copy the results')}</button><span class="th-msg" role="status"></span></div>
      <p class="th-note">${L('算法照 GoodVibes（Luchini, Alegre-Requena, Funes-Ardoiz, Paton, <i>F1000Research</i> 2020, 9, 291）逐式移植成 JavaScript，七份真实输出在八组选项下和 GoodVibes 4.4.0 的差都在 1×10⁻⁵ Eh 以内。理想气体、刚性转子、谐振子都是近似：溶液里的熵、构象和低频模式要另作考虑。',
        'The formulas are ported to JavaScript from GoodVibes (Luchini, Alegre-Requena, Funes-Ardoiz, Paton, <i>F1000Research</i> 2020, 9, 291); on seven real outputs under eight option sets it agrees with GoodVibes 4.4.0 to within 1×10⁻⁵ Eh. Ideal gas, rigid rotor and harmonic oscillator are approximations: solution entropy, conformers and soft modes need separate care.')}
        <a href="https://github.com/patonlab/GoodVibes" target="_blank" rel="noopener">GoodVibes <i class="ico-ext" aria-hidden="true"></i></a></p>`;
    const q = (s) => el.querySelector(s);
    const k = (name) => q(`[data-k="${name}"]`);
    k('std').value = st.std; k('qs').value = st.qs;
    const msg = (s) => { q('.th-msg').textContent = s; };
    const sigNote = () => {
      const s = q('.th-sig');
      const from = { output: L('程序印的', 'as printed by the program'), pg: L(`按结构判为 ${st.pg}`, `from the geometry: ${st.pg}`), user: L('手填', 'entered by hand'), none: L('默认 1', 'default 1'), big: L('分子太大，没判点群，默认 1', 'too large to check the point group; default 1'), fail: L('判点群失败，默认 1', 'point group check failed; default 1') }[st.sigmaFrom] || '';
      s.textContent = from ? `σ${L('：', ': ')}${from}${st.sigmaFrom === 'output' && st.pg ? L(`（${st.pg}）`, ` (${st.pg})`) : ''}` : '';
    };
    let last = null;
    const fmt = (v, d = 6) => (Number.isFinite(v) ? v.toFixed(d) : '—');
    function run() {
      for (const [name, show] of [['conc', st.std === 'conc'], ['cut', st.qs !== 'rrho'], ['alpha', st.qs === 'grimme'], ['qh', st.qh], ['imag', info.freqs.some((v) => v < 0)]]) q(`[data-show="${name}"]`).hidden = !show;
      const opts = { T: st.T, conc: st.std === '1atm' ? null : st.std === '1M' ? 1 : st.conc, qs: st.qs, sCutoff: st.sCutoff, alpha: st.alpha, qh: st.qh, hCutoff: st.hCutoff, scale: st.scale, zpeScale: st.zpeScale === '' ? null : Number(st.zpeScale), invert: st.invert ? st.invertAt : null };
      let r;
      try { r = TH.compute(TH.molOf(info, { mult: st.mult, sigma: st.sigma }), opts); } catch (e) { q('.th-result').innerHTML = `<p class="th-bad">${esc(L(e.message, e.message === '温度要大于 0 K' ? 'The temperature must be above 0 K' : e.message === '浓度要大于 0' ? 'The concentration must be above 0' : 'No geometry: translation and rotation cannot be computed'))}</p>`; last = null; return; }
      last = r;
      const kc = TH.KCAL, hasE = r.energy !== null;
      const qsName = { grimme: L('准 RRHO', 'quasi-RRHO'), truhlar: L('Truhlar', 'Truhlar'), rrho: 'RRHO' }[st.qs];
      const rows = [
        [L('电子能 E', 'Electronic energy E'), r.energy, null, null, info.energyLabel],
        ['ZPE', r.corr.zpe, null, r.corr.zpe, L('零点振动能', 'zero-point vibrational energy')],
        [`H(${st.T} K)`, r.H, st.qh ? r.qhH : null, r.corr.H, L('焓 = E + ZPE + 热能 + RT', 'enthalpy = E + ZPE + thermal + RT')],
        [`T·S`, r.TS, r.qhTS, null, L('熵项', 'entropy term')],
        [`G(${st.T} K)`, r.G, r.qhG, r.corr.G, L('吉布斯自由能', 'Gibbs free energy')],
      ];
      const head = `<tr><th></th><th>RRHO / Eh</th><th>${esc(qsName)}${st.qh ? ' + qh-H' : ''} / Eh</th><th>${L('校正', 'Correction')} / kcal mol⁻¹</th></tr>`;
      const body = rows.map(([name, a, b, c, note]) => `<tr><th scope="row">${esc(name)}<small>${esc(note || '')}</small></th><td class="th-num">${hasE || name === 'ZPE' || name === 'T·S' ? fmt(a) : '—'}</td><td class="th-num">${b === null ? '' : hasE || name === 'T·S' ? fmt(b) : '—'}</td><td class="th-num">${c === null ? '' : fmt(c * kc, 2)}</td></tr>`).join('');
      const qhCorr = r.corr.qhG * kc;
      const shift = TH.concCorrection(st.T, st.std === '1atm' ? 1 : opts.conc) * kc;
      const up = shift >= 0, mag = fmt(Math.abs(shift), 2);
      const stdNote = st.std === '1atm' ? L(`换成 1 mol/L 标准态，G ${up ? '加' : '减'} ${mag} kcal/mol`, `To 1 mol/L, ${up ? 'add' : 'subtract'} ${mag} kcal/mol ${up ? 'to' : 'from'} G`) : L(`已按 ${opts.conc} mol/L 算（G 比 1 atm ${up ? '高' : '低'} ${mag} kcal/mol）`, `Computed at ${opts.conc} mol/L (G is ${mag} kcal/mol ${up ? 'above' : 'below'} 1 atm)`);
      const facts = [
        r.monatomic ? L('单原子', 'single atom') : r.linear ? L('直线形分子', 'linear molecule') : L('非直线形', 'non-linear'),
        L(`质量 ${fmt(r.mass, 4)} amu`, `mass ${fmt(r.mass, 4)} amu`),
        r.rotTemps.length ? L(`转动温度 ${r.rotTemps.map((v) => fmt(v, 4)).join('、')} K`, `rotational temperatures ${r.rotTemps.map((v) => fmt(v, 4)).join(', ')} K`) : '',
        `σ = ${r.sigma}`, L(`多重度 ${r.mult}`, `multiplicity ${r.mult}`),
        r.low ? L(`${r.low} 个模式低于 100 cm⁻¹`, `${r.low} modes below 100 cm⁻¹`) : '',
      ].filter(Boolean);
      q('.th-result').innerHTML = `<div class="th-tablewrap"><table class="th-table"><thead>${head}</thead><tbody>${body}</tbody></table></div>`
        + `<p class="th-sum"><b>G − E = <span class="th-num" data-th="qhcorr">${fmt(qhCorr, 2)}</span> kcal/mol</b>${esc(L(`（${qsName}）`, ` (${qsName}) `))}· ${esc(stdNote)}</p>`
        + `<p class="th-facts">${facts.map(esc).join(' · ')}</p>`
        + (hasE ? '' : `<p class="th-bad">${esc(L('没读到电子能，只给校正量。', 'No electronic energy was found; only corrections are shown.'))}</p>`)
        + (r.warnings.length ? `<ul class="th-warn">${r.warnings.map((w) => `<li>${esc(en ? w.en : w.zh)}</li>`).join('')}</ul>` : '');
      const t = r.terms, kj = (v) => fmt(v / 1000, 3), js = (v) => fmt(v, 3);
      q('.th-termbox').innerHTML = `<div class="th-tablewrap"><table class="th-table small"><thead><tr><th></th><th>U / kJ mol⁻¹</th><th>S / J mol⁻¹ K⁻¹</th><th>${esc(qsName)} S</th></tr></thead><tbody>`
        + [[L('平动', 'Translation'), t.trans.U, t.trans.S, t.trans.S], [L('转动', 'Rotation'), t.rot.U, t.rot.S, t.rot.S], [L('振动（含 ZPE）', 'Vibration (incl. ZPE)'), t.vib.U, t.vib.S, t.vib.qhS], [L('电子（自旋）', 'Electronic (spin)'), 0, t.elec.S, t.elec.S]]
          .map(([n, u, s, s2]) => `<tr><th scope="row">${esc(n)}</th><td class="th-num">${kj(u)}</td><td class="th-num">${js(s)}</td><td class="th-num">${js(s2)}</td></tr>`).join('')
        + `</tbody></table></div>`
        + (r.modes.length ? `<details class="th-modes"><summary>${L('每个模式', 'Each mode')}</summary><div class="th-tablewrap"><table class="th-table small"><thead><tr><th>${L('频率', 'Frequency')} / cm⁻¹</th><th>S<sub>RRHO</sub></th><th>S<sub>${L('自由转子', 'free rotor')}</sub></th><th>${L('权重', 'Weight')}</th><th>${L('用的', 'Used')}</th></tr></thead><tbody>`
          + r.modes.map((m) => `<tr><td class="th-num">${fmt(m.freq, 1)}</td><td class="th-num">${js(m.sRRHO)}</td><td class="th-num">${js(m.sFree)}</td><td class="th-num">${fmt(m.weight, 3)}</td><td class="th-num">${js(m.s)}</td></tr>`).join('') + '</tbody></table></div></details>' : '');
      savePrefs({ T: st.T, std: st.std, conc: st.conc, qs: st.qs, sCutoff: st.sCutoff, alpha: st.alpha, qh: st.qh, hCutoff: st.hCutoff, scale: st.scale });
    }
    el.querySelector('.th-controls').addEventListener('input', (e) => {
      const name = e.target.dataset.k;
      if (!name) return;
      if (e.target.type === 'checkbox') st[name] = e.target.checked;
      else if (name === 'std' || name === 'qs') st[name] = e.target.value;
      else if (name === 'zpeScale') st.zpeScale = e.target.value.trim() === '' ? '' : Number(e.target.value);
      else { const v = Number(e.target.value); if (!Number.isFinite(v) || e.target.value === '') return; st[name] = v; }
      if (name === 'sigma') { st.sigmaFrom = 'user'; sigNote(); }
      run();
    });
    el.querySelector('.th-actions').addEventListener('click', async (e) => {
      const act = e.target.closest('button') && e.target.closest('button').dataset.act;
      if (!act || !last) return;
      const r = last, kc = TH.KCAL;
      // 没读到电子能时 r.H、r.G 只是校正量：E、H、G 留空，另给 H−E、G−E（Eh），免得被当成绝对能量
      const hasE = r.energy !== null, abs = (v) => (hasE ? v : null);
      const lines = [['quantity', 'RRHO_Eh', 'quasi_Eh'], ['E', r.energy, r.energy], ['ZPE', r.zpe, r.zpe], ['H', abs(r.H), abs(r.qhH)], ['T*S', r.TS, r.qhTS], ['G', abs(r.G), abs(r.qhG)],
        ['H-E', r.corr.H, r.corr.qhH], ['G-E', r.corr.G, r.corr.qhG], ['G-E_kcal_mol', r.corr.G * kc, r.corr.qhG * kc]];
      const meta = `# T=${r.T} K; ${r.standard === '1atm' ? 'standard state 1 atm' : `c=${r.conc} mol/L`}; entropy=${st.qs}${st.qs !== 'rrho' ? ` cutoff=${st.sCutoff}` : ''}; qh-H=${st.qh ? st.hCutoff : 'off'}; scale=${st.scale}; sigma=${r.sigma}; mult=${r.mult}; method after GoodVibes (MIT)`;
      const csv = [meta, ...lines.map((row) => row.map((v) => (typeof v === 'number' ? v.toFixed(8) : v ?? '')).join(','))].join('\n') + '\n';
      if (act === 'csv') download(`${info.program || 'output'}-thermo.csv`, csv, 'text/csv');
      else { try { await navigator.clipboard.writeText(csv); msg(L('已复制', 'Copied')); } catch { msg(L('浏览器不让复制，请用 CSV', 'The browser blocked copying; use the CSV')); } }
    });
    sigNote();
    run();
    // 输出里没印对称数：按结构判点群
    if (!info.sigma && nAtoms > 1) {
      if (nAtoms > 60) { st.sigmaFrom = 'big'; sigNote(); }
      else {
        q('.th-sig').textContent = L('σ：正在按结构判点群…', 'σ: checking the point group…');
        loadGroupModels().then((G) => {
          if (st.sigmaFrom === 'user') return;
          const a = G.analyseXYZ(info.atoms.map((x) => [x.el, x.x, x.y, x.z]), 0.03);
          const pg = a && a.res && a.res.pg;
          const s = pg ? TH.symmetryNumber(pg) : null;
          if (!s) { st.sigmaFrom = 'fail'; sigNote(); return; }
          st.pg = pg; st.sigma = s; st.sigmaFrom = 'pg'; k('sigma').value = s;
          sigNote(); run();
        }).catch(() => { st.sigmaFrom = 'fail'; sigNote(); });
      }
    }
    return true;
  }

  window.MolAstriaThermoUI = { mount };
})();
