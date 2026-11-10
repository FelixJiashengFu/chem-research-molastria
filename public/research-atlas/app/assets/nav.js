/* Research Atlas site navigation. Include with <script src="<root>/assets/nav.js" data-root="<root>" defer>.
   Content pages (body[data-nav=bar]) get a sticky glass bar; full-screen tools get a floating glass menu.
   Every module in the bar, and every school in the "大学" list, can be dragged to a new position;
   the order is kept per browser (localStorage) and shared with the home page and the schools hub. */
(function () {
  const me = document.currentScript, root = (me && me.dataset.root) || ".";
  const R = p => root.replace(/\/$/, "") + "/" + p;
  // [key, number, name, path]
  const NAV = [
    ["schools", "01", "大学", "schools/"],
    ["na-map", "02", "北美量化地图", "na-quantum-chem-map/"],
    ["na-top20", "03", "北美 Top 20", "top20/"],
    ["cn-map", "04", "中国量化地图", "cn-quantum-chem-map/"],
    ["cn-top20", "05", "中国 Top 20", "cn-top20/"],
    ["compare", "06", "中美对比", "compare/"],
    ["companies", "07", "中美企业", "na-companies/"],
  ];
  // [key, Chinese name, English name, country, path or null while being built]
  const SCHOOLS = [
    ["uoft", "多伦多大学", "University of Toronto", "CA", "uoft/"],
    ["stanford", "斯坦福大学", "Stanford University", "US", "stanford/"],
    ["waterloo", "滑铁卢大学", "University of Waterloo", "CA", "waterloo/"],
    ["uiuc", "伊利诺伊大学厄巴纳-香槟分校", "University of Illinois Urbana-Champaign", "US", "uiuc/"],
    ["udem", "蒙特利尔大学", "Université de Montréal", "CA", "udem/"],
    ["mcmaster", "麦克马斯特大学", "McMaster University", "CA", "mcmaster/"],
    ["ualberta", "阿尔伯塔大学", "University of Alberta", "CA", "ualberta/"],
    ["umich", "密歇根大学", "University of Michigan", "US", "umich/"],
    ["ucsb", "加州大学圣塔芭芭拉分校", "UC Santa Barbara", "US", "ucsb/"],
    ["mcgill", "麦吉尔大学", "McGill University", "CA", "mcgill/"],
    ["ucla", "加州大学洛杉矶分校", "UCLA", "US", "ucla/"],
    ["utaustin", "得克萨斯大学奥斯汀分校", "UT Austin", "US", "utaustin/"],
    ["upenn", "宾夕法尼亚大学", "University of Pennsylvania", "US", "upenn/"],
    ["northwestern", "西北大学", "Northwestern University", "US", "northwestern/"],
    ["ubc", "不列颠哥伦比亚大学", "University of British Columbia", "CA", "ubc/"],
    ["mit", "麻省理工学院", "MIT", "US", "schools/mit/"],
    ["harvard", "哈佛大学", "Harvard University", "US", "schools/harvard/"],
    ["caltech", "加州理工学院", "Caltech", "US", "schools/caltech/"],
    ["berkeley", "加州大学伯克利分校", "UC Berkeley", "US", "schools/berkeley/"],
    ["princeton", "普林斯顿大学", "Princeton University", "US", "schools/princeton/"],
    ["uchicago", "芝加哥大学", "University of Chicago", "US", "schools/uchicago/"],
    ["columbia", "哥伦比亚大学", "Columbia University", "US", "schools/columbia/"],
    ["yale", "耶鲁大学", "Yale University", "US", "schools/yale/"],
    ["cornell", "康奈尔大学", "Cornell University", "US", "schools/cornell/"],
    ["tsinghua", "清华大学", "Tsinghua University", "CN", "schools/tsinghua/"],
    ["pku", "北京大学", "Peking University", "CN", "schools/pku/"],
    ["ustc", "中国科学技术大学", "USTC", "CN", "schools/ustc/"],
    ["fudan", "复旦大学", "Fudan University", "CN", "schools/fudan/"],
    ["sjtu", "上海交通大学", "Shanghai Jiao Tong University", "CN", "schools/sjtu/"],
    ["zju", "浙江大学", "Zhejiang University", "CN", "schools/zju/"],
    ["nju", "南京大学", "Nanjing University", "CN", "schools/nju/"],
    ["whu", "武汉大学", "Wuhan University", "CN", "schools/whu/"],
    ["sysu", "中山大学", "Sun Yat-sen University", "CN", "schools/sysu/"],
  ];
  const FLAG = { US: "美", CA: "加", CN: "中" };

  /* ---------- persisted order ---------- */
  const store = {
    get(k) { try { return JSON.parse(localStorage.getItem("ra-order-" + k) || "null"); } catch (e) { return null; } },
    set(k, v) { try { v ? localStorage.setItem("ra-order-" + k, JSON.stringify(v)) : localStorage.removeItem("ra-order-" + k); } catch (e) {} },
  };
  function ordered(list, k) {
    const o = store.get(k); if (!Array.isArray(o)) return list.slice();
    const pos = new Map(o.map((key, i) => [key, i]));
    return list.slice().sort((a, b) => (pos.has(a[0]) ? pos.get(a[0]) : 999 + list.indexOf(a)) - (pos.has(b[0]) ? pos.get(b[0]) : 999 + list.indexOf(b)));
  }
  function save(k, keys) { store.set(k, keys); dispatchEvent(new CustomEvent("ra-order", { detail: { list: k, keys } })); }
  function reset(k) { store.set(k, null); dispatchEvent(new CustomEvent("ra-order", { detail: { list: k, keys: null } })); }

  /* ---------- drag to reorder (mouse: drag; touch/pen: long-press then drag) ---------- */
  let dragging = false;
  addEventListener("touchmove", e => { if (dragging) e.preventDefault(); }, { passive: false });
  function sortable(box, sel, onEnd) {
    box.addEventListener("pointerdown", e => {
      const it = e.target.closest(sel);
      if (!it || !box.contains(it) || e.button > 0 || e.target.closest("[data-nodrag]")) return;
      const touch = e.pointerType !== "mouse", sx = e.clientX, sy = e.clientY;
      let started = false, timer = null, tx = 0, ty = 0, gx = 0, gy = 0;
      const items = () => [...box.querySelectorAll(sel)].filter(n => n.parentNode === it.parentNode);
      const begin = () => {
        started = dragging = true;
        const r = it.getBoundingClientRect(); gx = sx - r.left; gy = sy - r.top;
        it.classList.add("ra-lift"); box.classList.add("ra-sorting");
        if (navigator.vibrate && touch) try { navigator.vibrate(8); } catch (_) {}
      };
      const place = (x, y) => {
        it.style.transform = "none"; const r = it.getBoundingClientRect();
        tx = x - gx - r.left; ty = y - gy - r.top; it.style.transform = `translate(${tx}px,${ty}px) scale(1.04)`;
      };
      const flip = (fn) => {
        const sib = items().filter(n => n !== it), before = new Map(sib.map(n => [n, n.getBoundingClientRect()]));
        fn();
        for (const n of sib) {
          const a = before.get(n), b = n.getBoundingClientRect(), dx = a.left - b.left, dy = a.top - b.top;
          if (!dx && !dy) continue;
          n.style.transition = "none"; n.style.transform = `translate(${dx}px,${dy}px)`;
          requestAnimationFrame(() => { n.style.transition = "transform .28s cubic-bezier(.2,.9,.3,1.2)"; n.style.transform = ""; });
        }
      };
      const move = ev => {
        if (!started) {
          if (Math.hypot(ev.clientX - sx, ev.clientY - sy) > (touch ? 10 : 5)) { if (touch) return end(); begin(); } else return;
        }
        ev.preventDefault();
        it.style.pointerEvents = "none";
        const over = document.elementFromPoint(ev.clientX, ev.clientY), tgt = over && over.closest(sel);
        it.style.pointerEvents = "";
        if (tgt && tgt !== it && tgt.parentNode === it.parentNode) {
          const L = items(), a = L.indexOf(it), b = L.indexOf(tgt);
          flip(() => tgt.parentNode.insertBefore(it, a < b ? tgt.nextSibling : tgt));
        }
        place(ev.clientX, ev.clientY);
      };
      const end = () => {
        clearTimeout(timer);
        removeEventListener("pointermove", move); removeEventListener("pointerup", end); removeEventListener("pointercancel", end);
        if (!started) return;
        dragging = false; box.classList.remove("ra-sorting");
        it.style.transition = "transform .3s cubic-bezier(.2,.9,.3,1.25)"; it.style.transform = "";
        setTimeout(() => { it.classList.remove("ra-lift"); it.style.transition = ""; }, 300);
        const stop = ev => { ev.preventDefault(); ev.stopPropagation(); };
        addEventListener("click", stop, { capture: true, once: true }); setTimeout(() => removeEventListener("click", stop, true), 60);
        onEnd(items().map(n => n.dataset.key));
      };
      if (touch) timer = setTimeout(() => { begin(); place(sx, sy); }, 320);
      addEventListener("pointermove", move, { passive: false }); addEventListener("pointerup", end); addEventListener("pointercancel", end);
    });
    box.addEventListener("contextmenu", e => { if (dragging || e.target.closest(sel)) e.pointerType !== "mouse" && e.preventDefault(); });
    box.addEventListener("dragstart", e => e.preventDefault());
  }

  /* ---------- styles: liquid glass ---------- */
  const css = `
  :root{--glass:color-mix(in srgb,var(--raise,#fff) 58%,transparent);--glass-2:color-mix(in srgb,var(--raise,#fff) 78%,transparent);--glass-edge:rgba(255,255,255,.65);--glass-shade:rgba(20,30,40,.10);--glass-hi:rgba(255,255,255,.75)}
  @media (prefers-color-scheme:dark){:root:not([data-theme="light"]){--glass:color-mix(in srgb,var(--raise,#1a242a) 52%,transparent);--glass-2:color-mix(in srgb,var(--raise,#1a242a) 80%,transparent);--glass-edge:rgba(255,255,255,.14);--glass-shade:rgba(0,0,0,.45);--glass-hi:rgba(255,255,255,.16)}}
  :root[data-theme="dark"]{--glass:color-mix(in srgb,var(--raise,#1a242a) 52%,transparent);--glass-2:color-mix(in srgb,var(--raise,#1a242a) 80%,transparent);--glass-edge:rgba(255,255,255,.14);--glass-shade:rgba(0,0,0,.45);--glass-hi:rgba(255,255,255,.16)}
  .ra-glass{background:var(--glass);-webkit-backdrop-filter:blur(22px) saturate(185%);backdrop-filter:blur(22px) saturate(185%);border:1px solid var(--glass-edge);box-shadow:inset 0 1px 0 var(--glass-hi),inset 0 -1px 0 rgba(0,0,0,.04),0 10px 30px var(--glass-shade)}
  .ra-bar{position:sticky;top:0;z-index:40;font-family:var(--body,system-ui);padding:8px 12px 0}
  .ra-bar .in{max-width:1180px;margin:0 auto;padding:0 8px 0 16px;display:flex;align-items:center;gap:14px;height:50px;border-radius:18px}
  .ra-brand{font:900 16px var(--display,serif);color:var(--ink,#1d262c)!important;white-space:nowrap;letter-spacing:.02em;text-decoration:none!important}
  .ra-brand span{color:var(--accent,#1f5f8b)}
  .ra-links{display:flex;gap:4px;overflow-x:auto;scrollbar-width:none;flex:1;padding:4px 2px;position:relative}
  .ra-links::-webkit-scrollbar{display:none}
  .ra-pill{white-space:nowrap;font-size:13px;color:var(--ink-2,#48545c);padding:6px 11px;border-radius:99px;text-decoration:none!important;border:1px solid transparent;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;cursor:grab;position:relative;background:transparent;font-family:inherit;display:inline-flex;align-items:center;gap:2px}
  .ra-pill i{font:500 10.5px var(--mono,monospace);font-style:normal;color:var(--muted,#6b767d);margin-right:4px}
  .ra-pill:hover{background:var(--glass-2);border-color:var(--glass-edge)}
  .ra-pill[aria-current]{color:var(--accent,#1f5f8b);background:var(--glass-2);border-color:var(--glass-edge);box-shadow:inset 0 1px 0 var(--glass-hi),0 2px 8px var(--glass-shade)}
  .ra-pill .car{font-size:9px;margin-left:4px;opacity:.7;transition:transform .2s}
  .ra-pill[aria-expanded="true"] .car{transform:rotate(180deg)}
  .ra-lift{z-index:5;cursor:grabbing!important;background:var(--glass-2)!important;border-color:var(--glass-edge)!important;box-shadow:inset 0 1px 0 var(--glass-hi),0 18px 40px var(--glass-shade)!important;-webkit-backdrop-filter:blur(26px) saturate(200%);backdrop-filter:blur(26px) saturate(200%)}
  .ra-sorting{cursor:grabbing}
  .ra-theme{font:500 12px var(--body,system-ui);border:1px solid var(--glass-edge);background:var(--glass-2);color:var(--ink,#1d262c);border-radius:99px;width:34px;height:32px;cursor:pointer;flex:none}
  .ra-pop{position:fixed;z-index:70;width:min(360px,calc(100vw - 24px));max-height:min(70vh,620px);overflow:auto;border-radius:20px;padding:10px;font-family:var(--body,system-ui);overscroll-behavior:contain}
  .ra-pop[hidden]{display:none}
  .ra-pop .hd{display:flex;justify-content:space-between;align-items:baseline;padding:4px 8px 8px;font-size:12px;color:var(--muted,#6b767d)}
  .ra-pop .hd b{font:600 15px var(--display,serif);color:var(--ink,#1d262c)}
  .ra-pop .ft{display:flex;justify-content:space-between;gap:8px;padding:8px 6px 2px;font-size:12.5px}
  .ra-pop .ft a,.ra-pop .ft button{color:var(--accent,#1f5f8b);background:none;border:0;font:inherit;cursor:pointer;padding:4px}
  .ra-sch{list-style:none;margin:0;padding:0;display:flex;flex-direction:column;gap:4px}
  .ra-sch li{display:flex;align-items:center;gap:10px;padding:8px 10px;border-radius:14px;border:1px solid transparent;cursor:grab;user-select:none;-webkit-user-select:none;-webkit-touch-callout:none;position:relative}
  .ra-sch li:hover{background:var(--glass-2);border-color:var(--glass-edge)}
  .ra-sch .fl{flex:none;width:24px;height:24px;border-radius:50%;display:grid;place-items:center;font-size:11px;font-weight:700;color:#fff}
  .ra-sch .fl.US{background:var(--us,#2a78d6)}.ra-sch .fl.CA{background:var(--ca,#1baf7a)}.ra-sch .fl.CN{background:var(--cn,#e0542a)}
  .ra-sch .nm{flex:1;min-width:0;line-height:1.3}
  .ra-sch .nm a,.ra-sch .nm span.t{font-size:14px;color:var(--ink,#1d262c);text-decoration:none}
  .ra-sch .nm small{display:block;font-size:11px;color:var(--muted,#6b767d);white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
  .ra-sch .st{font-size:10.5px;padding:1px 7px;border-radius:99px;border:1px solid var(--line,#dedbd2);color:var(--muted,#6b767d);white-space:nowrap}
  .ra-sch .st.on{color:var(--accent,#1f5f8b);border-color:var(--accent,#1f5f8b)}
  .ra-sch .grip{color:var(--muted,#6b767d);opacity:.55;font-size:13px;letter-spacing:-2px}
  .ra-sch li[aria-current] .nm a{color:var(--accent,#1f5f8b);font-weight:500}
  .ra-fab{position:fixed;z-index:60;left:50%;transform:translateX(-50%);top:calc(10px + env(safe-area-inset-top,0px));font-family:var(--body,system-ui)}
  .ra-fab>button{font:500 12.5px var(--body,system-ui);color:var(--ink,#1d262c);border-radius:99px;padding:6px 14px;cursor:pointer}
  .ra-fab .menu{position:absolute;top:40px;left:50%;transform:translateX(-50%);border-radius:18px;padding:8px;min-width:240px;max-height:80vh;overflow:auto}
  .ra-fab .menu .ra-links{flex-direction:column;overflow:visible;padding:0}
  .ra-fab .menu .ra-pill{display:flex;padding:8px 10px;border-radius:12px;font-size:13.5px;color:var(--ink,#1d262c)}
  .ra-fab .menu .ra-pop{position:static;width:auto;max-height:none;box-shadow:none;border:0;background:transparent;backdrop-filter:none;-webkit-backdrop-filter:none;padding:2px 0 6px 10px}
  .ra-fab .menu .home{display:block;padding:8px 10px;font-size:13.5px;color:var(--ink,#1d262c);text-decoration:none;border-radius:12px}
  .ra-fab .menu .home i{font:500 10.5px var(--mono,monospace);font-style:normal;color:var(--muted,#6b767d);margin-right:4px}
  .ra-fab .menu .tip{font-size:11px;color:var(--muted,#6b767d);padding:6px 10px 2px}
  .ra-fab.inline{position:relative;left:auto;top:auto;transform:none;z-index:60}.ra-fab.inline .menu{left:0;transform:none}
  @media (max-width:760px){.ra-fab:not(.inline){left:10px;transform:none}.ra-fab .menu{left:0;transform:none}.ra-bar{padding:6px 6px 0}.ra-bar .in{gap:8px;padding-left:12px}.ra-brand{font-size:14px}}
  html[data-embed] #themeBtn{display:none}
  html[data-i18n=pending] body{visibility:hidden}
  html[data-ra-font]{--body:var(--ra-font)!important;--display:var(--ra-font)!important}
  html[data-ra-font] body,html[data-ra-font] body :is(p,li,td,th,h1,h2,h3,h4,span,a,button,input,select,label,div,figcaption,small,b,strong,em):not(.mono,.mono *,code,pre,.n){font-family:var(--ra-font)}
  @media (prefers-reduced-motion:reduce){.ra-pill,.ra-sch li{transition:none!important}}`;
  const st = document.createElement("style"); st.textContent = css; document.head.appendChild(st);

  const here = location.pathname.replace(/index\.html$/, "");
  const isCur = p => { const a = document.createElement("a"); a.href = R(p || "./"); const ap = a.pathname.replace(/index\.html$/, ""); return p ? here.startsWith(ap) : here === ap; };
  const curSchool = () => SCHOOLS.find(s => s[4] && isCur(s[4]));

  function pills() {
    return ordered(NAV, "nav").map(([k, no, nm, p]) => k === "schools"
      ? `<button type="button" class="ra-pill" data-key="${k}" aria-haspopup="true" aria-expanded="false"${isCur(p) || curSchool() ? ' aria-current="page"' : ""}><i>${no}</i>${nm}<span class="car">▾</span></button>`
      : `<a class="ra-pill" data-key="${k}" href="${R(p)}"${isCur(p) ? ' aria-current="page"' : ""}><i>${no}</i>${nm}</a>`).join("");
  }
  function schoolItems() {
    const cs = curSchool();
    return ordered(SCHOOLS, "schools").map(([k, zh, en, cc, p]) => `<li data-key="${k}"${cs && cs[0] === k ? ' aria-current="page"' : ""}><span class="fl ${cc}">${FLAG[cc]}</span>
      <span class="nm">${p ? `<a href="${R(p)}">${zh}</a>` : `<a href="${R("schools/#" + k)}">${zh}</a>`}<small>${en}</small></span>
      <span class="st${p ? " on" : ""}">${p ? "已上线" : "建设中"}</span><span class="grip" aria-hidden="true">⋮⋮</span></li>`).join("");
  }
  function schoolPanel() {
    const pop = document.createElement("div"); pop.className = "ra-pop ra-glass"; pop.hidden = true;
    const paint = () => {
      pop.innerHTML = `<div class="hd"><b>选择学校</b><span>按住拖动可排序</span></div><ul class="ra-sch">${schoolItems()}</ul>
        <div class="ft"><a href="${R("schools/")}">全部 ${SCHOOLS.length} 所学校 →</a><button type="button" data-reset>恢复默认顺序</button></div>`;
      pop.querySelector("[data-reset]").onclick = e => { e.stopPropagation(); reset("schools"); };
    };
    paint();
    sortable(pop, ".ra-sch li", keys => save("schools", keys));
    pop.addEventListener("click", e => {
      if (e.target.closest("a, button")) return;
      const li = e.target.closest(".ra-sch li"); if (li) { const a = li.querySelector("a"); a && (location.href = a.href); }
    });
    addEventListener("ra-order", e => { if (e.detail.list === "schools" && !dragging) paint(); });
    return pop;
  }
  function wireLinks(box, pop, mode) {
    sortable(box, ".ra-pill", keys => save("nav", keys));
    const btn = () => box.querySelector('[data-key="schools"]');
    const open = v => {
      const b = btn(); pop.hidden = !v; b && b.setAttribute("aria-expanded", v);
      if (v && mode === "bar") {
        const r = b.getBoundingClientRect(), w = pop.offsetWidth;
        pop.style.top = (r.bottom + 10) + "px"; pop.style.left = Math.max(12, Math.min(innerWidth - w - 12, r.left - 10)) + "px";
      }
      if (v && mode === "menu") b.after(pop);
    };
    box.addEventListener("click", e => { const b = e.target.closest('[data-key="schools"]'); if (b) { e.stopPropagation(); open(pop.hidden); } });
    if (mode === "bar") {
      document.addEventListener("click", e => { if (!pop.contains(e.target)) open(false); });
      addEventListener("resize", () => open(false)); addEventListener("scroll", () => { if (!pop.hidden) open(true); }, { passive: true });
      addEventListener("keydown", e => { if (e.key === "Escape") open(false); });
    }
    addEventListener("ra-order", e => {
      if (e.detail.list !== "nav" || dragging) return;
      const wasOpen = !pop.hidden; box.innerHTML = pills(); if (mode === "menu" && wasOpen) open(true);
    });
  }
  function themeBtn() {
    const b = document.createElement("button"); b.className = "ra-theme"; b.setAttribute("aria-label", "切换深浅色");
    const cur = () => document.documentElement.dataset.theme || (matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light");
    const paint = () => b.textContent = cur() === "dark" ? "浅" : "深";
    b.onclick = () => { const t = cur() === "dark" ? "light" : "dark"; document.documentElement.dataset.theme = t; try { localStorage.setItem("ra-theme", t); } catch (e) {} paint(); };
    paint(); return b;
  }
  // Embedded in a host site's frame (MolAstria's /research-atlas/). The host owns light/dark, the language and the
  // typeface. It passes them in the first address (?embed=1&lang=…&theme=…&font=…, kept for the tab in sessionStorage
  // so links inside the frame keep them) and later as postMessage {type:"ra-host", …}; reading the parent directly
  // would fail in the desktop app, where the host page and this copy have different origins.
  const H = document.documentElement;
  const host = (() => {
    if (window.parent === window) return null;
    let s = null;
    try {
      const q = new URLSearchParams(location.search);
      if (q.get("embed") === "1") { s = { lang: q.get("lang") || "", theme: q.get("theme") || "", font: q.get("font") || "" }; sessionStorage.setItem("ra-host", JSON.stringify(s)); }
      else s = JSON.parse(sessionStorage.getItem("ra-host") || "null");
    } catch (e) {}
    if (!s) try { const d = window.parent.document; if (d.body.dataset.section) s = { lang: d.documentElement.lang === "en" ? "en" : "", theme: d.documentElement.dataset.theme || "", font: d.documentElement.dataset.font || "" }; } catch (e) {}
    return s;
  })();
  const embedded = !!host;
  const FONTS = { system: 'system-ui,-apple-system,"Segoe UI","PingFang SC","Microsoft YaHei",sans-serif', serif: '"Songti SC","Noto Serif SC","Source Han Serif SC",STSong,SimSun,Georgia,serif', kai: '"Kaiti SC",STKaiti,KaiTi,"Kaiti TC",serif' };
  function applyHost(s) {
    if (s.theme === "dark" || s.theme === "light") H.dataset.theme = s.theme; else delete H.dataset.theme;
    const f = FONTS[s.font];
    if (f) { H.dataset.raFont = s.font; H.style.setProperty("--ra-font", f); } else { delete H.dataset.raFont; H.style.removeProperty("--ra-font"); }
  }
  // English: the host's i18n.js translates this page with the atlas dictionary (assets/i18n-en.js), the same
  // runtime every MolAstria page uses. Both sit next to this copy on the host, so the paths are relative to nav.js.
  function english() {
    H.lang = "en"; H.dataset.i18n = "pending";
    setTimeout(() => { delete H.dataset.i18n; }, 3000);
    document.addEventListener("chemhub:i18n", () => { delete H.dataset.i18n; }, { once: true });
    const base = me ? me.src : location.href;
    const add = (src, next) => { const s = document.createElement("script"); s.src = new URL(src, base).href; s.onload = next; s.onerror = () => { delete H.dataset.i18n; }; document.head.appendChild(s); };
    add("i18n-en.js", () => add("../../../i18n.js"));
  }
  if (embedded) {
    H.dataset.embed = "1";
    applyHost(host);
    if (host.lang === "en") english();
    addEventListener("message", e => {
      const d = e.data;
      if (e.source !== window.parent || !d || d.type !== "ra-host") return;
      const next = { lang: d.lang || "", theme: d.theme || "", font: d.font || "" };
      try { sessionStorage.setItem("ra-host", JSON.stringify(next)); } catch (err) {}
      applyHost(next);
      if ((next.lang === "en") !== (H.lang === "en")) location.reload();
    });
  } else try { const t = localStorage.getItem("ra-theme"); if (t) H.dataset.theme = t; } catch (e) {}
  function mount() {
    const pop = schoolPanel();
    if (document.body.dataset.nav === "bar") {
      const bar = document.createElement("nav"); bar.className = "ra-bar"; bar.setAttribute("aria-label", "站点导航");
      bar.innerHTML = `<div class="in ra-glass"><a class="ra-brand" href="${R("./")}">中美<span>·</span>研究图谱</a><div class="ra-links">${pills()}</div></div>`;
      if (!embedded) bar.querySelector(".in").appendChild(themeBtn());
      document.body.prepend(bar); document.body.appendChild(pop);
      wireLinks(bar.querySelector(".ra-links"), pop, "bar");
    } else {
      const f = document.createElement("div"); f.className = "ra-fab";
      f.innerHTML = `<button class="ra-glass" aria-expanded="false" aria-haspopup="true">☰ 研究图谱 · 导航</button><div class="menu ra-glass" hidden>
        <a class="home" href="${R("./")}"><i>00</i>首页</a><div class="ra-links">${pills()}</div><div class="tip">按住拖动可调整顺序</div></div>`;
      const b = f.querySelector("button"), m = f.querySelector(".menu");
      b.onclick = e => { e.stopPropagation(); m.hidden = !m.hidden; b.setAttribute("aria-expanded", !m.hidden); };
      m.addEventListener("click", e => { if (!e.target.closest("a")) e.stopPropagation(); });
      pop.addEventListener("click", e => { if (!e.target.closest("a")) e.stopPropagation(); });
      document.addEventListener("click", () => { m.hidden = true; b.setAttribute("aria-expanded", "false"); });
      const hd = document.body.dataset.nav === "inline" && document.querySelector("header");
      if (hd) { f.classList.add("inline"); b.textContent = "☰ 研究图谱"; hd.prepend(f); } else document.body.appendChild(f);
      wireLinks(m.querySelector(".ra-links"), pop, "menu");
    }
  }
  window.RA_NAV = { NAV, SCHOOLS, FLAG, R, ordered, save, reset, sortable, isCur };
  document.readyState === "loading" ? document.addEventListener("DOMContentLoaded", mount) : mount();
})();
