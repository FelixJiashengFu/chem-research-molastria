# -*- coding: utf-8 -*-
"""
ChemVis Hub 真实内容爬虫
========================
合规边界（写死在代码里，不靠自觉）：
- 只收录 标题 + <=180 字短摘要 + 原文链接 + 来源署名，不搬运全文、不镜像正文图片。
- 尊重 robots.txt：Sobereva 不抓 /search/ /feed/ /action/；X-MOL 不抓 /paper/search /news/search 等；
  本爬虫实际上只请求各站首页、公开目录页与分类页第一页，远比 robots 允许的范围更克制。
- 不绕过任何人机验证/WAF：检测到验证页立即停手，该站改用公开交叉引用或上次缓存，并在数据里如实标注 status。
- 礼貌延时：同站请求间隔 >=1.1s；X-MOL 每次刷新最多请求 1 次首页（其反爬极敏感）。
- 缓存保全：某站本次抓取失败时，保留 public/data.json 中该站旧条目，并把状态标为 cache，绝不用空数据覆盖。
运行： python crawler.py [--max-keinsci 300]
产物： public/data.json ，原始 HTML 缓存 cache/raw/*.html（仅本地留档，不对外发布正文）
"""
import argparse, hashlib, json, re, sys, time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from pathlib import Path
from urllib.parse import urljoin, quote

import requests
from bs4 import BeautifulSoup

ROOT = Path(__file__).resolve().parent
PUBLIC = ROOT.parent / "public" / "hub"
CACHE = ROOT / "cache" / "raw"
PROBE = ROOT / "_probe"  # 首次勘察时保存的真实快照，仅作 X-MOL/科音抓取失败时的兜底解析来源
PUBLIC.mkdir(parents=True, exist_ok=True)
CACHE.mkdir(parents=True, exist_ok=True)

UA = "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/126.0 Safari/537.36 ChemVisHub/1.0 (local aggregator; titles+links only)"
CAPTCHA_MARKERS = ["人机验证", "请完成以下操作", "验证您是真人", "滑动验证", "acw_sc__v2", "captcha", "are you a human", "bot verification"]
EXCERPT_MAX = 180

SESSION = requests.Session()
SESSION.headers.update({"User-Agent": UA, "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.7"})
_last_hit = {}

def polite(host, delay=1.15):
    now = time.time()
    wait = delay - (now - _last_hit.get(host, 0))
    if wait > 0:
        time.sleep(wait)
    _last_hit[host] = time.time()

def is_blocked(html, title_hint=""):
    low = (html[:6000] + title_hint).lower()
    return any(m.lower() in low for m in CAPTCHA_MARKERS)

def fetch(url, source_key, delay=1.15, timeout=22):
    """返回 (html, status) status: ok/blocked/error。成功时写 raw 缓存。"""
    from urllib.parse import urlparse
    polite(urlparse(url).netloc, delay)
    cache_name = source_key + "_" + hashlib.md5(url.encode()).hexdigest()[:10] + ".html"
    try:
        r = SESSION.get(url, timeout=timeout, allow_redirects=True)
        html = r.text or ""
        soup_title = ""
        try:
            soup_title = BeautifulSoup(html, "lxml").title.get_text(" ", strip=True) if "<title" in html.lower() else ""
        except Exception:
            pass
        if r.status_code >= 400 or is_blocked(html, soup_title):
            return load_cache(source_key, cache_name), ("blocked" if is_blocked(html, soup_title) else f"error-{r.status_code}")
        (CACHE / cache_name).write_text(html, encoding="utf-8")
        return html, "ok"
    except Exception as e:
        print(f"[fetch-error] {url} -> {e}", file=sys.stderr)
        return load_cache(source_key, cache_name), "error"

def load_cache(source_key, cache_name):
    p = CACHE / cache_name
    if p.exists():
        return p.read_text(encoding="utf-8", errors="ignore")
    return None

def clean(text, limit=None):
    t = re.sub(r"\s+", " ", (text or "").replace("\u00a0", " ")).strip()
    t = re.sub(r"^文/Sobereva@\S+\s*\d{4}-[A-Za-z]{3}-\d{1,2}\s*", "", t)
    if limit and len(t) > limit:
        t = t[:limit].rstrip("，。；、 ") + "…"
    return t

TAG_RULES = [
    ("Multiwfn", "Multiwfn"), ("波函数", "Multiwfn"), ("Gaussian", "Gaussian"), ("ORCA", "ORCA"),
    ("VASP", "VASP/第一性原理"), ("第一性原理", "VASP/第一性原理"), ("分子动力学", "分子动力学"),
    ("动力学模拟", "分子动力学"), ("GROMACS", "分子动力学"), ("LAMMPS", "分子动力学"),
    ("激发态", "激发态与光谱"), ("光谱", "激发态与光谱"), ("ECD", "激发态与光谱"), ("紫外", "激发态与光谱"),
    ("电荷", "电荷与静电势"), ("静电势", "电荷与静电势"), ("弱相互作用", "弱相互作用"), ("氢键", "弱相互作用"),
    ("碳环", "碳环与材料"), ("晶体", "碳环与材料"), ("材料", "碳环与材料"),
    ("机器学习", "AI与机器学习"), ("生成式AI", "AI与机器学习"), ("人工智能", "AI与机器学习"),
    ("频率", "振动与频率"), ("振动", "振动与频率"), ("动画", "站长随笔"), ("歌曲", "站长随笔"), ("音乐", "站长随笔"),
    ("培训班", "培训与公告"), ("购机", "硬件与购机"), ("显卡", "硬件与购机"), ("RTX", "硬件与购机"),
    ("DFT", "VASP/第一性原理"), ("density functional", "VASP/第一性原理"),
    ("molecular dynamics", "分子动力学"), ("cataly", "催化与反应"), ("reaction", "催化与反应"),
    ("battery", "电池与能源"), ("perovskite", "碳环与材料"), ("machine learning", "AI与机器学习"),
    ("neural network", "AI与机器学习"), ("photochem", "激发态与光谱"), ("spectroscop", "激发态与光谱"),
]
def tags_for(title, category=""):
    blob = title + " " + category
    tags = []
    for kw, tag in TAG_RULES:
        if kw.lower() in blob.lower() and tag not in tags:
            tags.append(tag)
    return tags[:3]

TYPE_DEFAULT_TAG = {"discipline": "文献频道", "software": "软件归档", "archive": "邮件列表归档",
                    "job": "学术招聘", "conference": "学术会议", "resource": "资源索引",
                    "tool": "平台工具", "qa": "论坛问答", "tutorial": "量子化学",
                    "preprint": "预印本", "paper": "期刊论文", "repo": "开源项目", "database": "数据库"}

def item(source, type_, title, url, excerpt="", date="", category="", extra=None):
    title = clean(title)
    if not title or len(title) < 3:
        return None
    d = {"id": hashlib.md5(url.encode()).hexdigest()[:12], "source": source, "type": type_,
         "title": title, "url": url, "excerpt": clean(excerpt, EXCERPT_MAX), "date": date or "",
         "category": category or "", "tags": (tags_for(title, category) or [TYPE_DEFAULT_TAG.get(type_, "量子化学")])}
    if extra:
        d.update(extra)
    return d

# ---------------- Sobereva ----------------
def parse_sob_articles(html, enriched):
    soup = BeautifulSoup(html, "lxml")
    for art in soup.select("article.post"):
        a = art.select_one("h2.post-title a")
        if not a:
            continue
        url = a.get("href", "")
        m = re.search(r"sobereva\.com/(\d+)", url)
        if not m:
            continue
        sid = m.group(1)
        tm = art.select_one("time")
        cat = art.select_one(".post-meta a[href*='/category/']")
        views = ""
        for li in art.select(".post-meta li"):
            t = li.get_text(" ", strip=True)
            if t.startswith("Views:"):
                views = t.replace("Views:", "").strip()
        body = art.select_one(".post-content")
        enriched[sid] = {
            "title": a.get_text(strip=True), "url": url,
            "date": (tm.get("datetime", "")[:10] if tm else ""),
            "category": (cat.get_text(strip=True) if cat else ""),
            "views": views,
            "excerpt": (body.get_text(" ", strip=True) if body else ""),
        }
    return enriched

def crawl_sobereva():
    items, enriched, status = [], {}, "ok"
    html, st = fetch("http://sobereva.com/", "sob_home")
    if html and st == "ok":
        parse_sob_articles(html, enriched)
    elif st != "ok":
        status = st
    # 分类页第一页（robots 允许；每类只取一页）
    for cat_path in ["Multiwfn", "QC", "Modelling"]:
        h, s = fetch(f"http://sobereva.com/category/{cat_path}/", f"sob_cat_{cat_path}")
        if h and s == "ok":
            parse_sob_articles(h, enriched)
        time.sleep(0.2)
    # 全站目录：标题全量 + 科音交叉引用
    list_html, s = fetch("http://sobereva.com/list.html", "sob_list")
    keinsci_pairs = []
    if list_html and s == "ok":
        soup = BeautifulSoup(list_html, "lxml")
        content = soup.select_one(".post-content") or soup.body
        lines = [clean(x) for x in content.get_text("\n").split("\n")]
        lines = [x for x in lines if x]
        for i, line in enumerate(lines):
            m = re.fullmatch(r"http://sobereva\.com/(\d+)", line)
            if not m:
                continue
            sid = m.group(1)
            title = lines[i - 1] if i >= 1 and not lines[i - 1].startswith("http") else ""
            kei_url = ""
            for j in range(i + 1, min(i + 4, len(lines))):
                km = re.search(r"http://bbs\.keinsci\.com/thread-\d+-1-1\.html", lines[j])
                if km:
                    kei_url = km.group(0)
                    break
            if kei_url and title:
                keinsci_pairs.append({"title": title, "sob_id": sid, "keinsci_url": kei_url})
            e = enriched.get(sid, {})
            it = item("sobereva", "tutorial", e.get("title") or title, f"http://sobereva.com/{sid}",
                      e.get("excerpt", ""), e.get("date", ""), e.get("category", ""),
                      {"sob_id": int(sid), "views": e.get("views", ""), "keinsci_url": kei_url})
            if it:
                items.append(it)
    # 目录没抓到时退回首页/分类页的 enriched
    if not items:
        for sid, e in enriched.items():
            it = item("sobereva", "tutorial", e["title"], e["url"], e.get("excerpt", ""), e.get("date", ""), e.get("category", ""), {"sob_id": int(sid), "views": e.get("views", "")})
            if it:
                items.append(it)
    items.sort(key=lambda x: x.get("sob_id", 0), reverse=True)
    return items, keinsci_pairs, status

# ---------------- CCL ----------------
CCL_SKIP = ["send_message", "subscribe", "unsubscribe", "supporting", "privacy", "send_ccl", "be_supporting", "mailto:", "javascript:", "#", "searchccl", "htdig", "web-search"]
def ccl_type(url, title):
    u = url.lower()
    if "software" in u or "/cca/" in u: return "software"
    if "messages" in u: return "archive"
    if "jobs" in u: return "job"
    if "conference" in u: return "conference"
    if "announcements" in u: return "announcement"
    return "resource"

def harvest_links(html, base_url, source, default_type=None, cap=80):
    soup = BeautifulSoup(html, "lxml")
    out, seen = [], set()
    for a in soup.select("a[href]"):
        href = a.get("href", "").strip()
        title = clean(a.get_text(" ", strip=True))
        if not href or len(title) < 4 or len(title) > 140:
            continue
        if any(s in href.lower() for s in CCL_SKIP):
            continue
        url = urljoin(base_url, href)
        if url in seen or "ccl.net" not in url and not url.startswith("http"):
            # 保留 CCL 站内为主，外链只收资源型页面里出现的
            if "ccl.net" not in url:
                continue
        seen.add(url)
        t = default_type or ccl_type(url, title)
        it = item(source, t, title, url, "", "", "")
        if it:
            out.append(it)
        if len(out) >= cap:
            break
    return out

def crawl_ccl():
    items, status = [], "ok"
    pages = [
        ("https://server.ccl.net/chemistry/resources/index.shtml", "ccl_resources", None),
        ("https://server.ccl.net/chemistry/resources/software/index.shtml", "ccl_software", "software"),
        ("https://server.ccl.net/chemistry/resources/messages/index.shtml", "ccl_messages", "archive"),
        ("https://server.ccl.net/chemistry/announcements/jobs/index.shtml", "ccl_jobs", "job"),
        ("https://server.ccl.net/chemistry/announcements/conferences/index.shtml", "ccl_conf", "conference"),
    ]
    ok_any = False
    for url, key, dtype in pages:
        h, s = fetch(url, key)
        if h and s == "ok":
            ok_any = True
            items.extend(harvest_links(h, url, "ccl", dtype, cap=45))
        elif s != "ok":
            status = s
    # 去重 + 去掉过泛的导航词
    seen, uniq = set(), []
    bad_titles = {"resources", "software archive", "list archive", "search ccl"}
    for it in items:
        if it["url"] in seen or it["title"].lower() in bad_titles:
            continue
        seen.add(it["url"]); uniq.append(it)
    return uniq[:160], ("ok" if ok_any else status)

# ---------------- X-MOL ----------------
def parse_xmol(html, status_label):
    soup = BeautifulSoup(html, "lxml")
    items, seen = [], set()
    for a in soup.select("a[href]"):
        href = a.get("href", "")
        title = clean(a.get_text(" ", strip=True))
        if not title or len(title) < 2:
            continue
        url = urljoin("https://www.x-mol.com/", href)
        if url in seen:
            continue
        if href.startswith("/paper/search"):
            seen.add(url)
            it = item("xmol", "tool", title, url, "X-MOL 文献检索入口（原站直达，本站不抓取该页）", "", "平台工具")
            if it: items.append(it)
        elif href == "/chem" or href.startswith("/paper/"):
            seen.add(url)
            it = item("xmol", "discipline", f"X-MOL 学科频道 · {title}", url, "X-MOL 文献学科频道入口（原站直达）", "", "文献频道")
            if it: items.append(it)
        elif href.startswith("/news/") or href in ("/zd", "/8Paper/list"):
            seen.add(url)
            it = item("xmol", "tool", title, url, "X-MOL 平台工具/资讯入口（原站直达）", "", "平台工具")
            if it: items.append(it)
    text = soup.get_text(" ", strip=True)
    stats = re.findall(r"[\d,]+\+?\s*(?:篇文章|个学术公众号|本期刊|位作者)", text)
    return items[:70], stats

def crawl_xmol():
    html, st = fetch("https://www.x-mol.com/", "xmol_home", delay=1.2)
    if html and st == "ok":
        items, stats = parse_xmol(html, "ok")
        return items, "ok", stats
    # 兜底：首次勘察保存的真实首页快照（同一天抓取，文件时间即快照时间）
    snap = PROBE / "xmol.html"
    if snap.exists():
        items, stats = parse_xmol(snap.read_text(encoding="utf-8", errors="ignore"), "snapshot")
        return items, "snapshot", stats
    return [], st, []

# ---------------- Keinsci ----------------
def crawl_keinsci(pairs, max_n):
    html, st = fetch("http://bbs.keinsci.com/forum.php", "keinsci_home")
    direct = []
    if html and st == "ok":
        soup = BeautifulSoup(html, "lxml")
        for a in soup.select("a[href*='thread-']"):
            title = clean(a.get("title") or a.get_text(" ", strip=True))
            url = urljoin("http://bbs.keinsci.com/", a.get("href"))
            it = item("keinsci", "qa", title, url, "计算化学公社论坛帖（直抓）", "", "论坛")
            if it: direct.append(it)
        if direct:
            return direct[:max_n], "ok"
    # 合规兜底：Sobereva 官方目录公开列出的科音帖交叉引用（真实标题+真实帖链接）
    items = []
    for p in pairs[:max_n]:
        it = item("keinsci", "qa", p["title"], p["keinsci_url"],
                  "该文在计算化学公社的讨论帖（经 Sobereva 官方博文目录交叉引用收录，原站直抓被 WAF 人机验证拦截）",
                  "", "论坛镜像索引", {"mirror": "sobereva-list", "sob_url": f"http://sobereva.com/{p['sob_id']}"})
        if it: items.append(it)
    return items, ("mirror" if items else st)


# ---------------- arXiv（官方 API） ----------------
ARXIV_NS = {"a": "http://www.w3.org/2005/Atom", "arxiv": "http://arxiv.org/schemas/atom"}
def crawl_arxiv():
    items, seen, status = [], set(), "ok"
    for cat, n in [("physics.chem-ph", 35), ("physics.comp-ph", 15)]:
        url = (f"https://export.arxiv.org/api/query?search_query=cat:{cat}"
               f"&start=0&max_results={n}&sortBy=submittedDate&sortOrder=descending")
        text, st = fetch(url, f"arxiv_{cat.split('.')[-1]}", delay=1.2)
        if not text or st != "ok":
            status = st
            continue
        try:
            root = ET.fromstring(text)
        except Exception as e:
            print(f"[arxiv-parse] {cat} -> {e}", file=sys.stderr)
            status = "error"
            continue
        for entry in root.findall("a:entry", ARXIV_NS):
            abs_url = (entry.findtext("a:id", "", ARXIV_NS) or "").strip()
            title = clean(entry.findtext("a:title", "", ARXIV_NS))
            if not abs_url or abs_url in seen or not title:
                continue
            seen.add(abs_url)
            authors = [clean(a.findtext("a:name", "", ARXIV_NS)) for a in entry.findall("a:author", ARXIV_NS)]
            primary = entry.find("arxiv:primary_category", ARXIV_NS)
            cat_label = primary.get("term") if primary is not None else cat
            arxiv_id = abs_url.rsplit("/", 1)[-1]
            it = item("arxiv", "preprint", title, abs_url,
                      clean(entry.findtext("a:summary", "", ARXIV_NS)),
                      (entry.findtext("a:published", "", ARXIV_NS) or "")[:10], cat_label,
                      {"authors": "、".join([a for a in authors[:3] if a]) + (" 等" if len(authors) > 3 else ""),
                       "metric": f"arXiv:{arxiv_id}"})
            if it:
                items.append(it)
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items[:50], status

# ---------------- Crossref（官方 API，期刊最新论文元数据） ----------------
CROSSREF_JOURNALS = [
    ("1549-9618", "J. Chem. Theory Comput."),
    ("0021-9606", "J. Chem. Phys."),
    ("1463-9076", "Phys. Chem. Chem. Phys."),
    ("1948-7185", "J. Phys. Chem. Lett."),
]
def _crossref_date(w):
    for key in ("published", "published-online", "issued", "created"):
        parts = ((w.get(key) or {}).get("date-parts") or [[None]])[0]
        if parts and parts[0]:
            y = parts[0]
            m = parts[1] if len(parts) > 1 and parts[1] else 1
            d = parts[2] if len(parts) > 2 and parts[2] else 1
            return f"{y:04d}-{m:02d}-{d:02d}"
    return ""
def crawl_crossref():
    items, seen, status = [], set(), "ok"
    for issn, short in CROSSREF_JOURNALS:
        url = (f"https://api.crossref.org/journals/{issn}/works?sort=published&order=desc&rows=12"
               f"&select=DOI,title,published,published-online,issued,author,URL,container-title,abstract")
        text, st = fetch(url, f"crossref_{issn}", delay=1.2)
        if not text or st != "ok":
            status = st
            continue
        try:
            works = (json.loads(text).get("message") or {}).get("items") or []
        except Exception as e:
            print(f"[crossref-parse] {issn} -> {e}", file=sys.stderr)
            status = "error"
            continue
        for w in works:
            doi = (w.get("DOI") or "").strip()
            titles = w.get("title") or []
            title = clean(titles[0] if titles else "")
            if not doi or doi in seen or not title:
                continue
            if any(k in title.lower() for k in ("masthead", "editorial board", "issue publication", "front cover", "back cover")):
                continue  # 期刊卷首/封面类非论文元数据，不收录
            seen.add(doi)
            authors = []
            for a in (w.get("author") or [])[:3]:
                nm = clean(((a.get("given") or "") + " " + (a.get("family") or "")).strip())
                if nm:
                    authors.append(nm)
            abstract = re.sub(r"^s*Abstracts*", "", re.sub(r"<[^>]+>", " ", w.get("abstract") or ""), flags=re.I)
            journal = clean(((w.get("container-title") or [short])[0]))
            it = item("crossref", "paper", title, f"https://doi.org/{doi}", abstract,
                      _crossref_date(w), journal,
                      {"authors": "、".join(authors) + (" 等" if len(w.get("author") or []) > 3 else ""),
                       "metric": f"DOI:{doi}"})
            if it:
                items.append(it)
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items[:48], status

# ---------------- GitHub（官方 API，开源项目） ----------------
def crawl_github():
    items, by_name, status = [], {}, "ok"
    for topic, n in [("computational-chemistry", 25), ("quantum-chemistry", 15), ("molecular-dynamics", 15)]:
        url = f"https://api.github.com/search/repositories?q=topic%3A{topic}&sort=stars&order=desc&per_page={n}"
        text, st = fetch(url, f"github_{topic}", delay=2.0)
        if not text or st != "ok":
            status = st
            continue
        try:
            repos = json.loads(text).get("items") or []
        except Exception as e:
            print(f"[github-parse] {topic} -> {e}", file=sys.stderr)
            status = "error"
            continue
        for r in repos:
            name = r.get("full_name") or ""
            if not name or name in by_name:
                continue
            it = item("github", "repo", name, r.get("html_url") or "",
                      clean(r.get("description") or ""), (r.get("updated_at") or "")[:10],
                      (r.get("language") or "开源项目"),
                      {"metric": f"Star {r.get('stargazers_count', 0)}", "stars": r.get("stargazers_count", 0),
                       "authors": r.get("owner", {}).get("login", "")})
            if it:
                by_name[name] = it
    items = sorted(by_name.values(), key=lambda x: x.get("stars", 0), reverse=True)[:40]
    return items, status

# ---------------- 官方软件与数据库目录（逐站抓首页标题/meta 描述） ----------------
OFFICIALS = [
    # 名称, 官网, 分类, 类型 —— 2026-10-27 逐站实测（Materials Project 首页 403 Cloudflare，未收录；见 README）
    ("ORCA", "https://www.faccts.de/orca/", "量子化学软件", "software"),
    ("Gaussian", "https://gaussian.com/", "量子化学软件", "software"),
    ("Psi4", "https://psicode.org/", "量子化学软件", "software"),
    ("PySCF", "https://pyscf.org/", "量子化学软件", "software"),
    ("NWChem", "https://nwchemgit.github.io/", "量子化学软件", "software"),
    ("Multiwfn", "http://sobereva.com/multiwfn/", "量子化学软件", "software"),
    ("xTB", "https://xtb-docs.readthedocs.io/en/latest/", "量子化学软件", "software"),
    ("DFTB+", "https://dftbplus.org/", "量子化学软件", "software"),
    ("VASP", "https://www.vasp.at/", "周期与第一性原理", "software"),
    ("Quantum ESPRESSO", "https://www.quantum-espresso.org/", "周期与第一性原理", "software"),
    ("CP2K", "https://www.cp2k.org/", "周期与第一性原理", "software"),
    ("ABINIT", "https://www.abinit.org/", "周期与第一性原理", "software"),
    ("LAMMPS", "https://www.lammps.org/", "分子动力学", "software"),
    ("GROMACS", "https://www.gromacs.org/", "分子动力学", "software"),
    ("OpenMM", "https://openmm.org/", "分子动力学", "software"),
    ("Amber", "https://ambermd.org/", "分子动力学", "software"),
    ("PLUMED", "https://www.plumed.org/", "分子动力学", "tool"),
    ("RDKit", "https://www.rdkit.org/", "化学信息与建模", "software"),
    ("Open Babel", "https://openbabel.org/", "化学信息与建模", "software"),
    ("Avogadro", "https://avogadro.cc/", "化学信息与建模", "software"),
    ("ASE", "https://ase-lib.org/", "化学信息与建模", "software"),
    ("pymatgen", "https://pymatgen.org/", "化学信息与建模", "software"),
    ("Basis Set Exchange", "https://www.basissetexchange.org/", "数据库与平台", "database"),
    ("NIST Chemistry WebBook", "https://webbook.nist.gov/chemistry/", "数据库与平台", "database"),
    ("CCCBDB", "https://cccbdb.nist.gov/", "数据库与平台", "database"),
    ("NOMAD", "https://nomad-lab.eu/", "数据库与平台", "database"),
    ("Materials Cloud", "https://www.materialscloud.org/", "数据库与平台", "database"),
    ("AiiDA", "https://www.aiida.net/", "数据库与平台", "tool"),
    ("OVITO", "https://www.ovito.org/", "数据库与平台", "tool"),
]
def crawl_resdir():
    items, failed = [], []
    for name, url, category, type_ in OFFICIALS:
        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        html, st = fetch(url, f"res_{slug}")
        if not html or st != "ok":
            failed.append(name)
            continue
        soup = BeautifulSoup(html, "lxml")
        site_title = clean(soup.title.get_text(" ", strip=True) if soup.title else "")
        desc = ""
        for attrs in ({"attrs": {"name": "description"}}, {"attrs": {"property": "og:description"}}):
            tag = soup.find("meta", **attrs)
            if tag and tag.get("content"):
                desc = clean(tag.get("content"))
                break
        excerpt = desc or site_title
        it = item("resdir", type_, name, url, excerpt, "", category,
                  {"metric": site_title[:80] if site_title else ""})
        if it:
            it["tags"] = [category]  # 目录条目以官网分类为主题标签，避免落入“软件归档”等兜底标签
            items.append(it)
    status = "ok" if len(items) >= 20 else ("partial" if items else "error")
    if failed:
        print(f"[resdir] failed/skipped: {failed}", file=sys.stderr)
    return items, status

SOURCES_META = [
    {"id": "keinsci", "name": "计算化学公社", "url": "http://bbs.keinsci.com/", "role": "海量真实问答、报错求解、教程帖的主战场", "color": "#22d3ee"},
    {"id": "sobereva", "name": "Sobereva 博客", "url": "http://sobereva.com/", "role": "Multiwfn 深度长文、方法论与官方博文目录", "color": "#a78bfa"},
    {"id": "xmol", "name": "X-MOL 学术平台", "url": "https://www.x-mol.com/", "role": "文献追踪、学科频道与学术工具", "color": "#34d399"},
    {"id": "ccl", "name": "CCL 计算化学列表", "url": "https://www.ccl.net/chemistry/", "role": "历史最久的邮件列表归档、软件与资源索引", "color": "#fbbf24"},
    {"id": "arxiv", "name": "arXiv 化学物理", "url": "https://arxiv.org/list/physics.chem-ph/recent", "role": "化学物理/计算物理最新预印本（arXiv 官方 API，按提交时间倒序）", "color": "#fb7185"},
    {"id": "crossref", "name": "最新期刊论文 · Crossref", "url": "https://www.crossref.org/", "role": "JCTC、JCP、PCCP、JPCL 最新论文元数据（Crossref 官方 API，DOI 直达）", "color": "#60a5fa"},
    {"id": "github", "name": "GitHub 开源项目", "url": "https://github.com/topics/computational-chemistry", "role": "计算化学开源软件与工具库（GitHub 官方 API，按 Star 排序）", "color": "#e2e8f0"},
    {"id": "resdir", "name": "官方软件与数据库", "url": "", "role": "主流软件官网与权威数据库目录（逐站实测可达才收录，点卡片进各官网）", "color": "#2dd4bf"},
]

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--max-keinsci", type=int, default=300)
    args = ap.parse_args()
    now = datetime.now(timezone.utc).astimezone().isoformat(timespec="seconds")
    prev = {}
    data_path = PUBLIC / "data.json"
    if data_path.exists():
        try:
            prev = json.loads(data_path.read_text(encoding="utf-8"))
        except Exception:
            prev = {}
    prev_by_source = {}
    for it in prev.get("items", []):
        prev_by_source.setdefault(it["source"], []).append(it)

    print("[1/8] Sobereva ...")
    sob_items, pairs, sob_status = crawl_sobereva()
    print(f"      sobereva items={len(sob_items)} status={sob_status} keinsci_pairs={len(pairs)}")
    print("[2/8] CCL ...")
    ccl_items, ccl_status = crawl_ccl()
    print(f"      ccl items={len(ccl_items)} status={ccl_status}")
    print("[3/8] X-MOL ...")
    xmol_items, xmol_status, xmol_stats = crawl_xmol()
    print(f"      xmol items={len(xmol_items)} status={xmol_status} stats={xmol_stats}")
    print("[4/8] Keinsci ...")
    kei_items, kei_status = crawl_keinsci(pairs, args.max_keinsci)
    print(f"      keinsci items={len(kei_items)} status={kei_status}")
    print("[5/8] arXiv API ...")
    arxiv_items, arxiv_status = crawl_arxiv()
    print(f"      arxiv items={len(arxiv_items)} status={arxiv_status}")
    print("[6/8] Crossref API ...")
    cross_items, cross_status = crawl_crossref()
    print(f"      crossref items={len(cross_items)} status={cross_status}")
    print("[7/8] GitHub API ...")
    gh_items, gh_status = crawl_github()
    print(f"      github items={len(gh_items)} status={gh_status}")
    print("[8/8] Official software/database directory ...")
    res_items, res_status = crawl_resdir()
    print(f"      resdir items={len(res_items)} status={res_status}")

    fresh = {"sobereva": (sob_items, sob_status), "ccl": (ccl_items, ccl_status),
             "xmol": (xmol_items, xmol_status), "keinsci": (kei_items, kei_status),
             "arxiv": (arxiv_items, arxiv_status), "crossref": (cross_items, cross_status),
             "github": (gh_items, gh_status), "resdir": (res_items, res_status)}
    status_detail = {
        "ok": "直抓成功", "blocked": "被人机验证/WAF 拦截", "snapshot": "使用同日真实首页快照",
        "mirror": "经 Sobereva 官方目录交叉引用", "cache": "本次失败，保留上次缓存",
        "partial": "部分抓取成功（其余站点不可达已跳过）",
    }
    all_items, sources = [], []
    for meta in SOURCES_META:
        sid = meta["id"]
        items, st = fresh[sid]
        used_cache = False
        if not items and prev_by_source.get(sid):
            items, st, used_cache = prev_by_source[sid], "cache", True
        all_items.extend(items)
        sources.append({**meta, "status": st, "statusLabel": status_detail.get(st, st),
                        "fetchedAt": now, "itemCount": len(items), "usedCache": used_cache})
    # 全局去重（同 URL 只留一条，科音镜像与 Sobereva 原文是不同 URL，不冲突）
    seen, uniq = set(), []
    for it in all_items:
        if it["url"] in seen: continue
        seen.add(it["url"]); uniq.append(it)
    out = {"generatedAt": now, "generator": "crawler.py (titles+short excerpts+links only)",
           "xmolHomepageStats": xmol_stats, "sources": sources, "items": uniq,
           "compliance": "仅收录标题、短摘要与原文链接；优先官方 API（arXiv/Crossref/GitHub）；不绕过人机验证；尊重 robots.txt（如小木虫论坛被 robots 禁止，故不收录其帖子）；各站状态如实标注。"}
    data_path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"DONE total={len(uniq)} -> {data_path}")

if __name__ == "__main__":
    main()
