/* 代码台“输出解读”里的红外光谱：把频率输出的棒状谱展宽成连续谱，能调半高宽、线型、频率校正因子和范围，叠上实验谱，下载 CSV / SVG。
   数学在 ir-core.js。用法：MolAstriaIR.mount(容器, r.ir, 程序名)。文字自带中英两版，标 translate="no"。 */
(() => {
  'use strict';
  const C = window.MOLASTRIA_IR_CORE;
  if (!C || window.MolAstriaIR) return;
  const en = document.documentElement.lang === 'en';
  const L = (zh, e) => (en ? e : zh);
  const esc = (s) => String(s ?? '').replace(/[&<>"']/g, (ch) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[ch]));
  const KEY = 'molastria-ir';
  const readPrefs = () => { try { const v = JSON.parse(localStorage.getItem(KEY) || '{}'); return v && typeof v === 'object' ? v : {}; } catch { return {}; } };
  const savePrefs = (p) => { try { localStorage.setItem(KEY, JSON.stringify(p)); } catch { /* private mode */ } };
  const EXP_WHY = {
    compressed: ['这份 JCAMP-DX 用的是压缩格式（SQZ/DIF），还读不了；在 NIST 等网站下载时选“文字（AFFN）”或另存为 CSV。', 'This JCAMP-DX file uses compressed data (SQZ/DIF), which is not supported yet; save it as CSV or plain AFFN.'],
    nodata: ['文件里没有找到谱图数据（##XYDATA 或 ##PEAK TABLE）。', 'No spectrum data (##XYDATA or ##PEAK TABLE) found in the file.'],
    bad: ['读不出两列数字。第一列是波数（cm⁻¹），第二列是吸光度或透过率。', 'Could not read two numeric columns: wavenumber (cm⁻¹) and absorbance or transmittance.']
  };

  function download(name, text, type) {
    const url = URL.createObjectURL(new Blob([text], { type: `${type};charset=utf-8` }));
    const a = Object.assign(document.createElement('a'), { href: url, download: name });
    document.body.append(a); a.click(); a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function mount(el, ir, prog = 'output') {
    const p = readPrefs();
    const st = { fwhm: Number(p.fwhm) || 20, shape: C.SHAPES.includes(p.shape) ? p.shape : 'lorentz', scale: Number(p.scale) || 1, from: 400, to: 4000, exp: null };
    const real = ir.filter((m) => m.freq > 0 && m.int > 0);
    const hiF = Math.max(0, ...real.map((m) => m.freq));
    st.to = hiF > 3300 ? 4000 : Math.max(1000, Math.ceil((hiF * 1.15) / 100) * 100);
    const imag = ir.filter((m) => m.freq < 0).length;
    el.className = 'ir-box';
    el.setAttribute('translate', 'no');
    el.innerHTML = `
      <div class="ir-head"><h4>${L('红外光谱', 'IR spectrum')}</h4><span class="ir-meta">${L(`${real.length} 个有强度的模式`, `${real.length} IR-active modes`)}${imag ? L(`，${imag} 个虚频不画`, `, ${imag} imaginary not drawn`) : ''}</span></div>
      <div class="ir-controls">
        <label>${L('半高宽', 'FWHM')} <input type="range" min="2" max="80" step="1" data-k="fwhm" value="${st.fwhm}"><output>${st.fwhm}</output> cm⁻¹</label>
        <label>${L('线型', 'Line shape')} <select data-k="shape"><option value="lorentz">${L('洛伦兹', 'Lorentzian')}</option><option value="gauss">${L('高斯', 'Gaussian')}</option></select></label>
        <label title="${L('谐振近似的频率普遍偏高，常乘一个校正因子，如 B3LYP/6-31G(d) 约 0.96', 'Harmonic frequencies run high; a scale factor such as ~0.96 for B3LYP/6-31G(d) is common')}">${L('校正因子', 'Scale factor')} <input type="number" min="0.5" max="1.5" step="0.001" data-k="scale" value="${st.scale}" inputmode="decimal"></label>
        <label>${L('范围', 'Range')} <input type="number" min="0" max="6000" step="50" data-k="from" value="${st.from}" inputmode="numeric"> – <input type="number" min="100" max="8000" step="50" data-k="to" value="${st.to}" inputmode="numeric"> cm⁻¹</label>
      </div>
      <figure class="ir-fig"><div class="ir-plot"></div><figcaption class="ir-cap"></figcaption></figure>
      <div class="ir-actions">
        <label class="ir-file">${L('叠加实验谱（JCAMP-DX 或 CSV）', 'Overlay an experimental spectrum (JCAMP-DX or CSV)')}<input type="file" accept=".jdx,.dx,.jcamp,.csv,.txt,.tsv"></label>
        <button type="button" data-act="clear" hidden>${L('去掉实验谱', 'Remove experiment')}</button>
        <button type="button" data-act="csv">${L('下载 CSV', 'Download CSV')}</button>
        <button type="button" data-act="svg">${L('下载 SVG', 'Download SVG')}</button>
        <span class="ir-msg" role="status" aria-live="polite"></span>
      </div>
      <details class="ir-table"><summary>${L('全部模式', 'All modes')}</summary><table><thead><tr><th>#</th><th>${L('频率', 'Frequency')} / cm⁻¹</th><th>${L('校正后', 'Scaled')}</th><th>${L('强度', 'Intensity')} / km mol⁻¹</th></tr></thead><tbody></tbody></table></details>`;
    el.querySelector('[data-k="shape"]').value = st.shape;
    const msg = (s, bad) => { const m = el.querySelector('.ir-msg'); m.textContent = s; m.dataset.bad = bad ? '1' : ''; };

    let last = null, lastSvg = '';
    function draw() {
      const spec = C.broaden(ir, { fwhm: st.fwhm, shape: st.shape, scale: st.scale, from: st.from, to: st.to, step: Math.max(0.5, (st.to - st.from) / 1200) });
      last = spec;
      const W = 640, H = 260, pl = 50, pr = 14, pt = 14, pb = 34;
      const X = (v) => pl + ((st.to - v) / (st.to - st.from)) * (W - pl - pr); // 红外谱习惯：高波数在左
      const norm = !!st.exp;
      const ymax = norm ? 1.08 : (spec.max || 1) * 1.1;
      const Y = (v) => pt + (1 - v / ymax) * (H - pt - pb);
      const yv = norm ? spec.y.map((v) => v / (spec.max || 1)) : spec.y;
      const path = spec.x.map((x, i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(yv[i]).toFixed(1)}`).join('');
      const intMax = Math.max(1e-9, ...spec.sticks.map((s) => s.int));
      const inRange = spec.sticks.filter((s) => s.freq >= st.from && s.freq <= st.to);
      const sticks = inRange.map((s) => `<line class="ir-stick" x1="${X(s.freq).toFixed(1)}" x2="${X(s.freq).toFixed(1)}" y1="${Y(0)}" y2="${(Y(0) - (s.int / intMax) * (H - pt - pb) * 0.32).toFixed(1)}"><title>${s.freq.toFixed(1)} cm⁻¹ · ${s.int.toFixed(2)} km/mol</title></line>`).join('');
      const labels = C.strongest(inRange, 6).map((s) => { const i = Math.min(spec.x.length - 1, Math.max(0, Math.round(((s.freq - st.from) / (st.to - st.from)) * (spec.x.length - 1)))); return `<text class="ir-pk" x="${X(s.freq).toFixed(1)}" y="${Math.max(pt + 9, Y(yv[i]) - 5).toFixed(1)}" text-anchor="middle">${Math.round(s.freq)}</text>`; }).join('');
      let expPath = '';
      if (st.exp) {
        const pts = st.exp.x.map((x, i) => [x, st.exp.y[i]]).filter(([x]) => x >= st.from && x <= st.to);
        const stride = Math.max(1, Math.floor(pts.length / 1500));
        expPath = pts.filter((_, i) => i % stride === 0).map(([x, y], i) => `${i ? 'L' : 'M'}${X(x).toFixed(1)},${Y(y).toFixed(1)}`).join('');
      }
      const ticks = [];
      const stepT = st.to - st.from > 2000 ? 500 : st.to - st.from > 800 ? 200 : 100;
      for (let v = Math.ceil(st.from / stepT) * stepT; v <= st.to; v += stepT) ticks.push(`<line class="ir-grid" x1="${X(v)}" x2="${X(v)}" y1="${pt}" y2="${Y(0)}"/><text class="ir-tick" x="${X(v)}" y="${H - pb + 15}" text-anchor="middle">${v}</text>`);
      const yLabel = norm ? L('归一化强度', 'Normalised intensity') : 'ε / L mol⁻¹ cm⁻¹';
      const yTicks = norm ? [0, 0.5, 1] : [0, spec.max / 2, spec.max].filter((v, i, a) => a.indexOf(v) === i);
      const yT = yTicks.map((v) => `<text class="ir-tick" x="${pl - 6}" y="${(Y(v) + 3).toFixed(1)}" text-anchor="end">${norm ? v : v >= 1000 ? v.toExponential(1) : v.toFixed(v < 10 ? 1 : 0)}</text>`).join('');
      lastSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${W} ${H}" class="ir-svg" role="img" aria-label="${esc(L('计算的红外光谱', 'Computed IR spectrum'))}">`
        + ticks.join('') + `<line class="ir-axis" x1="${pl}" x2="${W - pr}" y1="${Y(0)}" y2="${Y(0)}"/><line class="ir-axis" x1="${pl}" x2="${pl}" y1="${pt}" y2="${Y(0)}"/>`
        + yT + `<text class="ir-axl" x="${(pl + W - pr) / 2}" y="${H - 3}" text-anchor="middle">${L('波数', 'Wavenumber')} / cm⁻¹</text>`
        + `<text class="ir-axl" transform="translate(12 ${(pt + Y(0)) / 2}) rotate(-90)" text-anchor="middle">${esc(yLabel)}</text>`
        + sticks + (expPath ? `<path class="ir-exp" d="${expPath}"/>` : '') + `<path class="ir-curve" d="${path}"/>` + labels + '</svg>';
      el.querySelector('.ir-plot').innerHTML = lastSvg;
      el.querySelector('.ir-cap').textContent = L(
        `${prog} 的谐振频率${st.scale !== 1 ? `乘 ${st.scale}` : ''}，${st.shape === 'gauss' ? '高斯' : '洛伦兹'}线型、半高宽 ${st.fwhm} cm⁻¹ 展宽；金色竖线是每个模式（高度按强度）。${st.exp ? `虚线是实验谱${st.exp.title ? `（${st.exp.title}）` : ''}${st.exp.units === 'T' ? '，透过率已换成吸光度' : ''}，两条都归一到最高峰为 1。` : '纵轴是摩尔吸光系数，每个峰的面积等于 100 × 强度（km/mol），和半高宽无关。'}`,
        `${prog} harmonic frequencies${st.scale !== 1 ? ` × ${st.scale}` : ''}, ${st.shape === 'gauss' ? 'Gaussian' : 'Lorentzian'} broadening with FWHM ${st.fwhm} cm⁻¹; gold sticks are the modes (height by intensity). ${st.exp ? `The dashed line is the experiment${st.exp.title ? ` (${st.exp.title})` : ''}${st.exp.units === 'T' ? ', transmittance converted to absorbance' : ''}; both are normalised to a tallest peak of 1.` : 'The y axis is the molar absorption coefficient; each band’s area equals 100 × intensity (km/mol), whatever the width.'}`);
      el.querySelector('[data-act="clear"]').hidden = !st.exp;
    }
    const tbody = () => {
      el.querySelector('.ir-table tbody').innerHTML = ir.map((m, i) => `<tr${m.freq < 0 ? ' class="ir-imag"' : ''}><td>${i + 1}</td><td>${m.freq.toFixed(2)}</td><td>${m.freq > 0 ? (m.freq * st.scale).toFixed(1) : '—'}</td><td>${m.int.toFixed(3)}</td></tr>`).join('');
    };
    el.addEventListener('input', (e) => {
      const k = e.target.dataset?.k;
      if (!k) return;
      const v = k === 'shape' ? e.target.value : Number(e.target.value);
      if (k !== 'shape' && !Number.isFinite(v)) return;
      if (k === 'fwhm') e.target.nextElementSibling.textContent = v;
      if ((k === 'from' && v >= st.to - 50) || (k === 'to' && v <= st.from + 50)) return;
      if (k === 'scale' && (v < 0.5 || v > 1.5)) return;
      st[k] = v;
      if (k !== 'from' && k !== 'to') savePrefs({ fwhm: st.fwhm, shape: st.shape, scale: st.scale });
      draw();
      if (k === 'scale') tbody();
    });
    el.querySelector('.ir-file input').addEventListener('change', async (e) => {
      const f = e.target.files?.[0];
      e.target.value = '';
      if (!f) return;
      if (f.size > 8e6) { msg(L('文件太大（超过 8 MB）', 'File too large (over 8 MB)'), true); return; }
      const res = C.parseExperimental(await f.text());
      if (!res.ok) { msg(L(...EXP_WHY[res.why] || EXP_WHY.bad), true); return; }
      st.exp = { ...res, title: res.title || f.name };
      msg(L(`已叠上 ${f.name}（${res.x.length} 个点）`, `Overlaid ${f.name} (${res.x.length} points)`));
      draw();
    });
    el.addEventListener('click', (e) => {
      const a = e.target.closest('[data-act]')?.dataset.act;
      if (a === 'clear') { st.exp = null; msg(''); draw(); }
      else if (a === 'csv' && last) download(`${prog.toLowerCase()}-ir.csv`, C.toCSV(last), 'text/csv');
      else if (a === 'svg' && lastSvg) {
        const cs = getComputedStyle(el);
        const v = (n) => cs.getPropertyValue(n).trim() || '#333';
        const style = `<style>.ir-curve{fill:none;stroke:${v('--accent')};stroke-width:1.6}.ir-exp{fill:none;stroke:${v('--info')};stroke-width:1.3;stroke-dasharray:5 3}.ir-stick{stroke:${v('--gold')};stroke-width:1.2}.ir-axis{stroke:${v('--ink-2')}}.ir-grid{stroke:${v('--line')}}text{font:11px sans-serif;fill:${v('--ink-2')}}.ir-pk{fill:${v('--ink')};font-weight:600}</style>`;
        download(`${prog.toLowerCase()}-ir.svg`, lastSvg.replace(/(<svg[^>]*>)/, `$1${style}<rect width="100%" height="100%" fill="${v('--surface')}"/>`), 'image/svg+xml');
      }
    });
    tbody();
    draw();
  }

  window.MolAstriaIR = { mount };
})();
