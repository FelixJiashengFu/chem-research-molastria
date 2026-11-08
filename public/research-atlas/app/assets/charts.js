/* Small SVG chart kit for the Research Atlas (needs d3 v7). Thin marks, hairline grid, hover tooltips,
   colors read from CSS custom properties so light/dark both work. Every chart re-renders on resize/theme change. */
(function () {
  const RA = window.RA = window.RA || {};
  const css = n => getComputedStyle(document.documentElement).getPropertyValue(n).trim();
  RA.css = css;
  RA.col = v => (v && v.startsWith("--")) ? css(v) : v;
  const esc = s => String(s ?? "").replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
  RA.esc = esc;
  RA.fmt = { int: d3.format(","), k: v => v >= 10000 ? d3.format(".3~s")(v) : d3.format(",")(v), pct: v => (v == null ? "—" : d3.format(".1f")(v) + "%"), f1: d3.format(".1f"), f2: d3.format(".2f") };
  let tip;
  RA.tip = {
    show(html, e) {
      if (!tip) { tip = document.createElement("div"); tip.className = "viz-tip"; document.body.appendChild(tip); }
      tip.innerHTML = html; tip.hidden = false;
      const r = tip.getBoundingClientRect(), x = e.clientX + 14, y = e.clientY + 14;
      tip.style.left = Math.min(x, innerWidth - r.width - 8) + "px";
      tip.style.top = (y + r.height > innerHeight - 8 ? e.clientY - r.height - 10 : y) + "px";
    },
    hide() { if (tip) tip.hidden = true; }
  };
  const registry = [];
  const fit = (t, px, fs = 12.5) => { t = String(t); let w = 0, out = ""; for (const ch of t) { w += ch.charCodeAt(0) > 255 ? fs : fs * .58; if (w > px) return out + "…"; out += ch; } return t; };
  RA.reset = () => { registry.length = 0; };
  RA.mount = (el, draw) => { const run = () => { el.innerHTML = ""; draw(el, Math.max(260, el.clientWidth)); }; registry.push(run); run(); };
  let rt; addEventListener("resize", () => { clearTimeout(rt); rt = setTimeout(() => registry.forEach(f => f()), 120); });
  new MutationObserver(() => registry.forEach(f => f())).observe(document.documentElement, { attributes: true, attributeFilter: ["data-theme"] });
  matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => registry.forEach(f => f()));

  function svg(el, w, h) { return d3.select(el).append("svg").attr("width", w).attr("height", h).attr("viewBox", `0 0 ${w} ${h}`).style("font-family", css("--body")).style("display", "block"); }
  function gridY(g, y, w, fmt, ticks = 5) {
    const t = y.ticks(ticks);
    g.append("g").selectAll("line").data(t).join("line").attr("x1", 0).attr("x2", w).attr("y1", d => y(d) + .5).attr("y2", d => y(d) + .5).attr("stroke", css("--grid"));
    g.append("g").selectAll("text").data(t).join("text").attr("x", -8).attr("y", d => y(d)).attr("dy", "0.32em").attr("text-anchor", "end").attr("fill", css("--muted")).attr("font-size", 11).style("font-family", css("--mono")).text(fmt);
  }
  function legend(el, items) {
    if (items.length < 2) return;
    const d = document.createElement("div"); d.className = "legend";
    d.innerHTML = items.map(s => `<span><i style="background:${RA.col(s.color)}"></i>${esc(s.name)}</span>`).join("");
    el.prepend(d);
  }

  /* line chart: o = {x:[...], series:[{name,color,values,dash}], yFmt, h, xFmt, yMin, ref:{y,label}, endLabels, area} */
  RA.line = (el, o) => RA.mount(el, (el, W) => {
    legend(el, o.series);
    const H = o.h || 280, m = { t: 12, r: o.endLabels === false ? 16 : 64, b: 26, l: 46 }, w = W - m.l - m.r, h = H - m.t - m.b;
    const s = svg(el, W, H), g = s.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const x = d3.scaleLinear().domain(d3.extent(o.x)).range([0, w]);
    const all = o.series.flatMap(s => s.values.filter(v => v != null));
    const y = d3.scaleLinear().domain([o.yMin ?? 0, o.yMax ?? d3.max(all) * 1.06]).nice().range([h, 0]);
    const yf = o.yFmt || RA.fmt.k;
    gridY(g, y, w, yf);
    g.append("line").attr("x1", 0).attr("x2", w).attr("y1", h + .5).attr("y2", h + .5).attr("stroke", css("--axis"));
    const xt = x.ticks(Math.min(8, Math.floor(w / 60))).filter(Number.isInteger);
    g.append("g").selectAll("text").data(xt).join("text").attr("x", x).attr("y", h + 18).attr("text-anchor", "middle").attr("fill", css("--muted")).attr("font-size", 11).style("font-family", css("--mono")).text(o.xFmt || (d => d));
    if (o.ref) { g.append("line").attr("x1", 0).attr("x2", w).attr("y1", y(o.ref.y)).attr("y2", y(o.ref.y)).attr("stroke", css("--muted")).attr("stroke-dasharray", "0").attr("opacity", .6);
      g.append("text").attr("x", 4).attr("y", y(o.ref.y) - 5).attr("fill", css("--muted")).attr("font-size", 11).text(o.ref.label); }
    for (const se of o.series) {
      const pts = o.x.map((xv, i) => [xv, se.values[i]]).filter(p => p[1] != null);
      const c = RA.col(se.color);
      if (o.area) g.append("path").attr("d", d3.area().x(p => x(p[0])).y0(h).y1(p => y(p[1]))(pts)).attr("fill", c).attr("opacity", .1);
      g.append("path").attr("d", d3.line().x(p => x(p[0])).y(p => y(p[1]))(pts)).attr("fill", "none").attr("stroke", c).attr("stroke-width", se.w || 2).attr("stroke-linejoin", "round").attr("stroke-linecap", "round").attr("stroke-dasharray", se.dash || null);
      const last = pts[pts.length - 1];
      if (last) {
        g.append("circle").attr("cx", x(last[0])).attr("cy", y(last[1])).attr("r", 4).attr("fill", c).attr("stroke", css("--surface")).attr("stroke-width", 2);
        if (o.endLabels !== false) g.append("text").attr("x", x(last[0]) + 8).attr("y", y(last[1])).attr("dy", "0.32em").attr("font-size", 11.5).attr("fill", css("--ink-2")).text(se.short || se.name).attr("data-end", 1);
      }
    }
    // de-overlap end labels
    const ends = g.selectAll("text[data-end]").nodes().sort((a, b) => +a.getAttribute("y") - +b.getAttribute("y"));
    for (let i = 1; i < ends.length; i++) { const p = +ends[i - 1].getAttribute("y"), c = +ends[i].getAttribute("y"); if (c - p < 13) ends[i].setAttribute("y", p + 13); }
    const cross = g.append("line").attr("y1", 0).attr("y2", h).attr("stroke", css("--axis")).attr("opacity", 0);
    const dots = g.append("g");
    g.append("rect").attr("width", w).attr("height", h).attr("fill", "transparent")
      .on("mousemove", e => {
        const xv = Math.round(x.invert(d3.pointer(e)[0])), i = o.x.indexOf(xv); if (i < 0) return;
        cross.attr("x1", x(xv)).attr("x2", x(xv)).attr("opacity", 1);
        dots.selectAll("circle").data(o.series.filter(s => s.values[i] != null)).join("circle").attr("cx", x(xv)).attr("cy", s => y(s.values[i])).attr("r", 4).attr("fill", s => RA.col(s.color)).attr("stroke", css("--surface")).attr("stroke-width", 2);
        RA.tip.show(`<b>${o.xFmt ? o.xFmt(xv) : xv}</b>` + o.series.filter(s => s.values[i] != null).sort((a, b) => b.values[i] - a.values[i]).map(s => `<div><span class="dot" style="background:${RA.col(s.color)}"></span> ${esc(s.name)}：<span class="m">${yf(s.values[i])}</span></div>`).join(""), e);
      })
      .on("mouseleave", () => { cross.attr("opacity", 0); dots.selectAll("*").remove(); RA.tip.hide(); });
  });

  /* grouped horizontal bars: o = {cats:[{key,label}], series:[{key,name,color}], value(cat,ser), fmt, max} */
  RA.hbar = (el, o) => RA.mount(el, (el, W) => {
    legend(el, o.series);
    const ns = o.series.length, bh = Math.min(o.bar || 14, 24), gap = 2, band = ns * (bh + gap) + 12;
    const lw = Math.min(o.labelW || 170, W * .38), m = { t: 4, r: 58, b: 6, l: lw }, w = W - m.l - m.r, H = m.t + m.b + band * o.cats.length;
    const s = svg(el, W, H), g = s.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const max = o.max ?? d3.max(o.cats.flatMap(c => o.series.map(se => o.value(c, se) || 0)));
    const x = d3.scaleLinear().domain([0, max]).nice().range([0, w]);
    const f = o.fmt || RA.fmt.int;
    x.ticks(4).forEach(t => g.append("line").attr("x1", x(t) + .5).attr("x2", x(t) + .5).attr("y1", 0).attr("y2", H - m.t - m.b).attr("stroke", css("--grid")));
    if (o.ref != null) g.append("line").attr("x1", x(o.ref) + .5).attr("x2", x(o.ref) + .5).attr("y1", 0).attr("y2", H - m.t - m.b).attr("stroke", css("--muted")).attr("stroke-width", 1);
    o.cats.forEach((c, ci) => {
      const y0 = ci * band + 6;
      g.append("text").attr("x", -10).attr("y", y0 + (ns * (bh + gap)) / 2).attr("dy", "0.32em").attr("text-anchor", "end").attr("font-size", 12.5).attr("fill", css("--ink")).text(fit(c.label, lw - 14)).append("title").text(c.label);
      o.series.forEach((se, si) => {
        const v = o.value(c, se); if (v == null) return;
        const yy = y0 + si * (bh + gap), ww = Math.max(1, x(v)), r = Math.min(4, ww / 2);
        g.append("path").attr("d", `M0,${yy}H${ww - r}Q${ww},${yy} ${ww},${yy + r}V${yy + bh - r}Q${ww},${yy + bh} ${ww - r},${yy + bh}H0Z`).attr("fill", RA.col(se.color))
          .on("mousemove", e => RA.tip.show(`<b>${esc(c.label)}</b><div>${esc(se.name)}：<span class="m">${f(v)}</span></div>${o.extra ? o.extra(c, se) : ""}`, e)).on("mouseleave", RA.tip.hide);
        g.append("text").attr("x", ww + 5).attr("y", yy + bh / 2).attr("dy", "0.32em").attr("font-size", 11).attr("fill", css("--ink-2")).style("font-family", css("--mono")).text(f(v));
      });
    });
  });

  /* grouped columns: o = {cats:[{key,label}], series, value, fmt, h, yFmt} */
  RA.cols = (el, o) => RA.mount(el, (el, W) => {
    legend(el, o.series);
    const H = o.h || 260, m = { t: 12, r: 10, b: 30, l: 46 }, w = W - m.l - m.r, h = H - m.t - m.b;
    const s = svg(el, W, H), g = s.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const x0 = d3.scaleBand().domain(o.cats.map(c => c.key)).range([0, w]).paddingInner(.25).paddingOuter(.1);
    const ns = o.series.length, bw = Math.min(24, (x0.bandwidth() - (ns - 1) * 2) / ns);
    const y = d3.scaleLinear().domain([0, d3.max(o.cats.flatMap(c => o.series.map(se => o.value(c, se) || 0))) * 1.08]).nice().range([h, 0]);
    gridY(g, y, w, o.yFmt || RA.fmt.k);
    g.append("line").attr("x1", 0).attr("x2", w).attr("y1", h + .5).attr("y2", h + .5).attr("stroke", css("--axis"));
    const every = Math.ceil(o.cats.length / Math.max(1, Math.floor(w / 46)));
    o.cats.forEach((c, ci) => {
      const cx = x0(c.key) + (x0.bandwidth() - (ns * bw + (ns - 1) * 2)) / 2;
      if (c.label !== "" && (ci % every === 0 || o.allLabels)) g.append("text").attr("x", x0(c.key) + x0.bandwidth() / 2).attr("y", h + 18).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", css("--muted")).style("font-family", css("--mono")).text(c.label);
      o.series.forEach((se, si) => {
        const v = o.value(c, se) || 0, xx = cx + si * (bw + 2), hh = h - y(v), r = Math.min(4, hh / 2, bw / 2);
        g.append("path").attr("d", `M${xx},${h}V${y(v) + r}Q${xx},${y(v)} ${xx + r},${y(v)}H${xx + bw - r}Q${xx + bw},${y(v)} ${xx + bw},${y(v) + r}V${h}Z`).attr("fill", RA.col(se.color))
          .on("mousemove", e => RA.tip.show(`<b>${esc(c.tip || c.label)}</b><div>${esc(se.name)}：<span class="m">${(o.fmt || RA.fmt.int)(v)}</span></div>`, e)).on("mouseleave", RA.tip.hide);
      });
    });
  });

  /* 100% stacked horizontal bars: o = {rows:[{label, parts:[{name,color,v}]}]} */
  RA.stack = (el, o) => RA.mount(el, (el, W) => {
    legend(el, o.rows[0].parts);
    const bh = 22, lw = o.labelW || 70, m = { t: 4, r: 8, b: 4, l: lw }, w = W - m.l - m.r, H = m.t + m.b + o.rows.length * (bh + 18);
    const s = svg(el, W, H), g = s.append("g").attr("transform", `translate(${m.l},${m.t})`);
    o.rows.forEach((r, ri) => {
      const tot = d3.sum(r.parts, p => p.v), yy = ri * (bh + 18) + 6; let acc = 0;
      g.append("text").attr("x", -10).attr("y", yy + bh / 2).attr("dy", "0.32em").attr("text-anchor", "end").attr("font-size", 12.5).attr("fill", css("--ink")).text(r.label);
      r.parts.forEach(p => {
        const x0 = acc / tot * w, ww = Math.max(0, p.v / tot * w - 2); acc += p.v;
        g.append("rect").attr("x", x0).attr("y", yy).attr("width", ww).attr("height", bh).attr("rx", 3).attr("fill", RA.col(p.color))
          .on("mousemove", e => RA.tip.show(`<b>${esc(r.label)} · ${esc(p.name)}</b><div class="m">${RA.fmt.int(p.v)} · ${(100 * p.v / tot).toFixed(1)}%</div>`, e)).on("mouseleave", RA.tip.hide);
        const pct = 100 * p.v / tot, txt = pct.toFixed(0) + "%";
        if (ww > 34) g.append("text").attr("x", x0 + ww / 2).attr("y", yy + bh / 2).attr("dy", "0.32em").attr("text-anchor", "middle").attr("font-size", 11).attr("fill", p.dark ? "#0b0b0b" : "#fff").style("font-family", css("--mono")).style("pointer-events", "none").text(txt);
      });
    });
  });

  /* dumbbell: o = {cats:[{key,label}], a:{name,color,get}, b:{...}, fmt, domain} */
  RA.dumbbell = (el, o) => RA.mount(el, (el, W) => {
    legend(el, [o.a, o.b]);
    const lw = o.labelW || 170, m = { t: 22, r: 20, b: 8, l: lw }, w = W - m.l - m.r, row = 30, H = m.t + m.b + row * o.cats.length;
    const s = svg(el, W, H), g = s.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const vals = o.cats.flatMap(c => [o.a.get(c), o.b.get(c)]).filter(v => v != null);
    const x = d3.scaleLinear().domain(o.domain || [Math.min(0, d3.min(vals)), d3.max(vals)]).nice().range([0, w]);
    const f = o.fmt || RA.fmt.f1;
    x.ticks(6).forEach(t => { g.append("line").attr("x1", x(t) + .5).attr("x2", x(t) + .5).attr("y1", -4).attr("y2", H - m.t - m.b).attr("stroke", t === 0 ? css("--axis") : css("--grid"));
      g.append("text").attr("x", x(t)).attr("y", -9).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", css("--muted")).style("font-family", css("--mono")).text(f(t)); });
    o.cats.forEach((c, i) => {
      const yy = i * row + row / 2, va = o.a.get(c), vb = o.b.get(c);
      g.append("text").attr("x", -10).attr("y", yy).attr("dy", "0.32em").attr("text-anchor", "end").attr("font-size", 12.5).attr("fill", css("--ink")).text(fit(c.label, lw - 14)).append("title").text(c.label);
      if (va != null && vb != null) g.append("line").attr("x1", x(va)).attr("x2", x(vb)).attr("y1", yy).attr("y2", yy).attr("stroke", css("--axis")).attr("stroke-width", 2);
      for (const [se, v] of [[o.a, va], [o.b, vb]]) if (v != null)
        g.append("circle").attr("cx", x(v)).attr("cy", yy).attr("r", 6).attr("fill", RA.col(se.color)).attr("stroke", css("--surface")).attr("stroke-width", 2)
          .on("mousemove", e => RA.tip.show(`<b>${esc(c.label)}</b><div>${esc(o.a.name)}：<span class="m">${f(va)}</span></div><div>${esc(o.b.name)}：<span class="m">${f(vb)}</span></div>`, e)).on("mouseleave", RA.tip.hide);
    });
  });

  /* scatter: o = {points:[{x,y,r,color,label,tip,hl}], xLabel, yLabel, xLog, yLog, h} */
  RA.scatter = (el, o) => RA.mount(el, (el, W) => {
    if (o.legend) legend(el, o.legend);
    const H = o.h || 320, m = { t: 12, r: 16, b: 38, l: 56 }, w = W - m.l - m.r, h = H - m.t - m.b;
    const s = svg(el, W, H), g = s.append("g").attr("transform", `translate(${m.l},${m.t})`);
    const X = (o.xLog ? d3.scaleLog() : d3.scaleLinear()).domain(o.xDomain || d3.extent(o.points, p => p.x)).nice().range([0, w]);
    const Y = (o.yLog ? d3.scaleLog() : d3.scaleLinear()).domain(o.yDomain || d3.extent(o.points, p => p.y)).nice().range([h, 0]);
    const yt = Y.ticks(5), xt = X.ticks(6);
    const yf = o.yLog ? (d => [1, 2, 5].includes(+String(d)[0]) ? RA.fmt.k(d) : "") : RA.fmt.k, xf = o.xLog ? (d => [1, 2, 5].includes(+String(d)[0]) ? RA.fmt.k(d) : "") : RA.fmt.k;
    yt.forEach(t => { g.append("line").attr("x1", 0).attr("x2", w).attr("y1", Y(t)).attr("y2", Y(t)).attr("stroke", css("--grid")); g.append("text").attr("x", -8).attr("y", Y(t)).attr("dy", ".32em").attr("text-anchor", "end").attr("font-size", 11).attr("fill", css("--muted")).style("font-family", css("--mono")).text(yf(t)); });
    xt.forEach(t => { g.append("line").attr("y1", 0).attr("y2", h).attr("x1", X(t)).attr("x2", X(t)).attr("stroke", css("--grid")); g.append("text").attr("y", h + 16).attr("x", X(t)).attr("text-anchor", "middle").attr("font-size", 11).attr("fill", css("--muted")).style("font-family", css("--mono")).text(xf(t)); });
    g.append("text").attr("x", w).attr("y", h + 32).attr("text-anchor", "end").attr("font-size", 11.5).attr("fill", css("--ink-2")).text(o.xLabel);
    g.append("text").attr("x", 0).attr("y", -2).attr("font-size", 11.5).attr("fill", css("--ink-2")).text(o.yLabel);
    const pts = o.points.slice().sort((a, b) => (a.hl ? 1 : 0) - (b.hl ? 1 : 0));
    g.selectAll("circle").data(pts).join("circle").attr("cx", p => X(p.x)).attr("cy", p => Y(p.y)).attr("r", p => p.r || 4).attr("fill", p => RA.col(p.color)).attr("opacity", p => p.hl === false ? .35 : .9)
      .attr("stroke", css("--surface")).attr("stroke-width", 1.5).style("cursor", p => p.href ? "pointer" : null)
      .on("mousemove", (e, p) => RA.tip.show(p.tip, e)).on("mouseleave", RA.tip.hide).on("click", (e, p) => { if (p.href) location.href = p.href; });
    pts.filter(p => p.label).forEach(p => g.append("text").attr("x", X(p.x) + (p.r || 4) + 4).attr("y", Y(p.y)).attr("dy", ".32em").attr("font-size", 11).attr("fill", css("--ink-2")).style("pointer-events", "none").text(p.label));
  });
})();
