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
import argparse, hashlib, html as htmllib, json, re, sys, time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from email.utils import parsedate_to_datetime
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
CAPTCHA_MARKERS = ["人机验证", "请完成以下操作", "验证您是真人", "滑动验证", "acw_sc__v2", "captcha", "are you a human", "bot verification",
                   "verify you're human", "verify you are human", "just a moment..."]
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
        try:  # 只有网页才找 <title>；JSON 和 RSS 不用 HTML 解析器读
            if "<title" in html.lower() and "html" in r.headers.get("content-type", "html"):
                soup_title = BeautifulSoup(html, "lxml").title.get_text(" ", strip=True)
        except Exception:
            pass
        blocked = is_blocked(html, soup_title) or bool(r.headers.get("cf-mitigated"))  # Cloudflare 验证页
        if r.status_code >= 400 or blocked:
            return load_cache(source_key, cache_name), ("blocked" if blocked else f"error-{r.status_code}")
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

def plain(text):
    """API 与 RSS 字段里的 HTML 转纯文本：去标签、解实体（&amp;、&#39;、&hellip; 等），供 clean() 再整理空白。"""
    t = re.sub(r"<(script|style)[\s\S]*?</\1>", " ", text or "", flags=re.I)
    t = htmllib.unescape(re.sub(r"<[^>]+>", " ", t))
    # Crossref 摘要里有双重转义的 &amp;#xD;：再解一次剩下的数字实体（只解数字的，免得把文字里的 &lt; 变成尖括号）
    return re.sub(r"&#(?:x[0-9a-fA-F]+|\d+);", lambda m: htmllib.unescape(m.group(0)), t)

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
                    "preprint": "预印本", "paper": "期刊论文", "repo": "开源项目", "database": "数据库",
                    "announcement": "培训与公告"}

# 英文条目（标题里没有汉字）按标题、分类和摘要归进站内已有的中文主题；越具体的放越前，最多取 3 个。
HAN = re.compile(r"[\u3400-\u9fff]")
EN_TOPICS = [(t, re.compile(p, re.I)) for t, p in [
    ("Multiwfn", r"\bMultiwfn\b"),
    ("ORCA", r"\bORCA\b"),
    ("Gaussian", r"\bGaussian(?: ?(?:09|16))?\b(?![- ]?(?:process|basis|type|function|orbital|smearing|distribution|mixture|approximation|kernel|regression|noise|broaden|blur|filter|random|wave|beam|pulse|charge|densit|fit|width|shape|curve|peak))"),
    ("AI与机器学习", r"machine[- ]learn|neural[- ]net|deep[- ]learn|graph neural|\bGNNs?\b|transformer|language model|\bLLMs?\b|generative|active learning|interatomic potential|\bMLIPs?\b|\bMACE\b|NequIP|DeePMD|foundation model|\bAI\b|artificial intelligence|Bayesian optimi|diffusion model|equivariant"),
    ("分子动力学", r"molecular dynamics|\bMD (?:simulation|run|trajector)|force[- ]?fields?|coarse[- ]grain|metadynamics|enhanced sampling|umbrella sampling|replica exchange|free[- ]energy perturbation|alchemical|\bGROMACS\b|\bLAMMPS\b|OpenMM|\bAMBER\b|CHARMM|\bNAMD\b|\bPLUMED\b|trajector|thermostat|\bNPT\b|\bNVT\b|\bgmx\b"),
    ("激发态与光谱", r"excited[- ]states?|TD-?DFT|photo(?:physic|chemi|excit|lumin)|absorption spectr|fluorescen|phosphorescen|spectr(?:a|um|oscop)|vibronic|\bNMR\b|UV[- ]?vis|Raman|\bECD\b|circular dichroism|\bEPR\b|X-ray absorption"),
    ("催化与反应", r"cataly|reaction mechanism|transition[- ]states?|activation (?:barrier|energ)|reaction (?:path|coordinate|barrier)|\bIRC\b|\bNEB\b|nudged elastic|kinetic|reactivity"),
    ("振动与频率", r"vibrational|frequenc|normal modes?|phonons?|anharmonic|thermochemi|zero[- ]point"),
    ("弱相互作用", r"non-?covalent|dispersion|hydrogen[- ]bond|halogen[- ]bond|van der waals|\bSAPT\b|energy decomposition|[πp]i[- ]stacking|intermolecular interaction"),
    ("电荷与静电势", r"electrostatic potential|partial charges?|atomic charges?|population analysis|\bRESP\b|Mulliken|Hirshfeld|\bBader\b|charge (?:transfer|density|analysis)"),
    ("VASP/第一性原理", r"\bVASP\b|plane[- ]wave|first[- ]principles|periodic (?:DFT|system|boundar)|band (?:structure|gap)|\bslabs?\b|surface adsorption|Quantum ESPRESSO|\bCP2K\b|pseudopotential|DFT\+U|k-points?|supercell|density of states|\bABINIT\b|\bSIESTA\b|\bGPAW\b"),
    ("电池与能源", r"batter(?:y|ies)|electrolyte|lithium|Li-ion|sodium-ion|energy storage|solar cell|photovoltaic|fuel cell|hydrogen storage"),
    ("化学信息与建模", r"cheminformatic|\bRDKit\b|\bSMILES\b|fingerprint|QSAR|virtual screening|docking|drug discovery|drug design|molecular similarity|InChI|chemical space|Open ?Babel|ChEMBL|PubChem|ADMET|retrosynth"),
    ("碳环与材料", r"\bmaterials?\b|perovskite|metal[- ]organic framework|\bMOFs?\b|zeolite|graphene|2D material|alloys?\b|polymers?\b|crystal|amorphous|nanoparticle|oxides?\b|semiconductor"),
    ("安装与报错", r"\binstall|compil|\bcmake\b|\berrors?\b|segmentation fault|\bcrash|\bfails?\b|failed|failing|\bbugs?\b|not working|\bconda\b|\bpip\b|\bMPI\b|\bCUDA\b"),
    ("量子化学", r"\bDFT\b|density[- ]functional|ab initio|coupled[- ]cluster|CCSD|CASSCF|CASPT2|NEVPT2|multireference|quantum[- ]chemi|electronic[- ]structure|wave ?functions?|basis sets?|Hartree[- ]Fock|\bMP2\b|\bPsi4\b|PySCF|Q-Chem|\bSCF\b|functionals?\b|geometry optimi|\bxtb\b|GFN\d?|semi-?empirical|orbitals?\b|DFTB"),
]]
def tags_en(text):
    return [t for t, rx in EN_TOPICS if rx.search(text)][:3]

def item(source, type_, title, url, excerpt="", date="", category="", extra=None):
    title = clean(title)
    if not title or len(title) < 3:
        return None
    excerpt = clean(excerpt, EXCERPT_MAX)
    tags = tags_for(title, category) if HAN.search(title) else tags_en(f"{title} | {category} | {excerpt}")
    d = {"id": hashlib.md5(url.encode()).hexdigest()[:12], "source": source, "type": type_,
         "title": title, "url": url, "excerpt": excerpt, "date": date or "",
         "category": category or "", "tags": (tags or [TYPE_DEFAULT_TAG.get(type_, "量子化学")])}
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
    # 计算物理只取摘要里讲分子或化学的（arXiv 查询语法：AND / OR / 括号）
    comp_chem = "cat:physics.comp-ph AND (abs:molecular OR abs:molecule OR abs:molecules OR abs:chemical OR abs:chemistry)"
    for cat, q, n in [("physics.chem-ph", "cat:physics.chem-ph", 60), ("physics.comp-ph", comp_chem, 40)]:
        url = (f"https://export.arxiv.org/api/query?search_query={quote(q)}"
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
    return items[:100], status

# ---------------- Crossref（官方 API，期刊最新论文元数据） ----------------
# ISSN, 简称, 是否综合期刊。综合期刊（实验论文也多）多取一些，只留标题或摘要里明确是理论/计算的。2026-11-06 逐个实测有数据。
CROSSREF_JOURNALS = [
    ("1549-9618", "J. Chem. Theory Comput.", False),
    ("1549-9596", "J. Chem. Inf. Model.", False),
    ("0192-8651", "J. Comput. Chem.", False),
    ("1759-0876", "WIREs Comput. Mol. Sci.", False),
    ("1432-881X", "Theor. Chem. Acc.", False),
    ("0020-7608", "Int. J. Quantum Chem.", False),
    ("2210-271X", "Comput. Theor. Chem.", False),
    ("1610-2940", "J. Mol. Model.", False),
    ("1093-3263", "J. Mol. Graph. Model.", False),
    ("0920-654X", "J. Comput.-Aided Mol. Des.", False),
    ("1758-2946", "J. Cheminform.", False),
    ("2635-098X", "Digital Discovery", False),
    ("2057-3960", "npj Comput. Mater.", False),
    ("2632-2153", "Mach. Learn.: Sci. Technol.", False),
    ("2516-1075", "Electron. Struct.", False),
    ("0021-9606", "J. Chem. Phys.", True),
    ("1463-9076", "Phys. Chem. Chem. Phys.", True),
    ("1948-7185", "J. Phys. Chem. Lett.", True),
    ("1089-5639", "J. Phys. Chem. A", True),
    ("1520-6106", "J. Phys. Chem. B", True),
    ("1932-7447", "J. Phys. Chem. C", True),
    ("0026-8976", "Mol. Phys.", True),
]
CROSSREF_PER_JOURNAL, CROSSREF_CAP = 8, 180
# 与 tools/hub-chemrxiv.ts 的 STRONG 同一组词：综合期刊的论文要命中至少一个
COMPUTATIONAL = re.compile(r"\b(DFT|TD-?DFT|density[- ]functional|ab initio|first[- ]principles|coupled[- ]cluster|CCSD|CASSCF|CASPT2|NEVPT2|multireference|quantum[- ]chemi\w*|electronic[- ]structure|molecular dynamics|MD simulations?|force[- ]fields?|metadynamics|enhanced sampling|QM/MM|free[- ]energy (?:perturbation|calculations?|surfaces?)|semi-?empirical|GFN\d?-?xTB|xTB|basis sets?|wave ?functions?|machine[- ]learn\w*|neural networks?|interatomic potentials?|computational(?:ly)?|in silico|theoretical(?:ly)?|simulations?|calculations?|Monte Carlo|docking)\b", re.I)
def _crossref_date(w):
    # 先用在线发表日期；纸版期号日期常在未来（如 2027-01），晚于今天的跳过
    today = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    for key in ("published-online", "published", "issued", "created"):
        parts = ((w.get(key) or {}).get("date-parts") or [[None]])[0]
        if parts and parts[0]:
            y = parts[0]
            m = parts[1] if len(parts) > 1 and parts[1] else 1
            d = parts[2] if len(parts) > 2 and parts[2] else 1
            if f"{y:04d}-{m:02d}-{d:02d}" <= today:
                return f"{y:04d}-{m:02d}-{d:02d}"
    return ""
def crawl_crossref():
    items, seen, status, ok_any = [], set(), "ok", False
    for issn, short, broad in CROSSREF_JOURNALS:
        url = (f"https://api.crossref.org/journals/{issn}/works?sort=published&order=desc&rows={40 if broad else 14}"
               f"&select=DOI,title,published,published-online,issued,created,author,URL,container-title,abstract")
        text, st = fetch(url, f"crossref_{issn}", delay=1.2)
        if not text or st != "ok":
            status = "partial"
            continue
        try:
            works = (json.loads(text).get("message") or {}).get("items") or []
        except Exception as e:
            print(f"[crossref-parse] {issn} -> {e}", file=sys.stderr)
            status = "partial"
            continue
        ok_any, kept = True, 0
        for w in works:
            doi = (w.get("DOI") or "").strip()
            titles = w.get("title") or []
            title = clean(plain(titles[0] if titles else ""))
            if not doi or doi in seen or not title:
                continue
            if any(k in title.lower() for k in ("masthead", "editorial board", "issue publication", "front cover", "back cover", "issue information", "table of contents", "cover image", "correction to", "erratum")):
                continue  # 期刊卷首/封面类非论文元数据，不收录
            if broad and not COMPUTATIONAL.search(f"{title} {plain(w.get('abstract') or '')}"):
                continue
            if kept >= CROSSREF_PER_JOURNAL:
                break
            kept += 1
            seen.add(doi)
            authors = []
            for a in (w.get("author") or [])[:3]:
                nm = clean(((a.get("given") or "") + " " + (a.get("family") or "")).strip())
                if nm:
                    authors.append(nm)
            abstract = re.sub(r"^\s*Abstract\s*", "", plain(w.get("abstract") or "").strip(), flags=re.I)
            journal = clean(plain((w.get("container-title") or [short])[0]))
            it = item("crossref", "paper", title, f"https://doi.org/{doi}", abstract,
                      _crossref_date(w), journal,
                      {"authors": "、".join(authors) + (" 等" if len(w.get("author") or []) > 3 else ""),
                       "metric": f"DOI:{doi}"})
            if it:
                items.append(it)
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    return items[:CROSSREF_CAP], (status if ok_any else "error")

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

# ---------------- 国际社区、博客与发布说明（官方 API、Discourse 公开 JSON、RSS/Atom） ----------------
# 每个来源都有条数上限（见 INTL_CRAWLERS），控制快照体积；2026-11-06 逐个实测可用、robots.txt 允许。
ATOM, DC = "{http://www.w3.org/2005/Atom}", "{http://purl.org/dc/elements/1.1/}"

def _date(s):
    """RSS 的 RFC 822 日期或 Atom/ISO 日期 -> YYYY-MM-DD；认不出就留空。"""
    s = (s or "").strip()
    if re.match(r"\d{4}-\d{2}-\d{2}", s):
        return s[:10]
    try:
        return parsedate_to_datetime(s).strftime("%Y-%m-%d")
    except Exception:
        return ""

def _add_new(items, batch, seen):
    for it in batch:
        if it["url"] not in seen:
            seen.add(it["url"]); items.append(it)

def event_type(title):
    """新闻/活动类订阅：标题像招聘的算 job，像会议/学校/研讨会的算 conference，其余是公告。"""
    t = title.lower()
    if re.search(r"\b(ph\.?d|postdoc|post-doc|positions?|fellowships?|vacanc|jobs?|hiring|faculty|studentships?|research (?:associate|scientist|engineer|software engineer))\b", t):
        return "job"
    if re.search(r"\b(workshops?|schools?|conferences?|symposi|hackathons?|webinars?|meetings?|seminars?|training|courses?|summit)\b", t):
        return "conference"
    return "announcement"

def parse_feed(text, source, label, type_="tutorial", limit=50, skip=None):
    """RSS 2.0 或 Atom -> 条目；label（博客名）写进 category；标题匹配 skip 正则的跳过。坏 XML 抛 ET.ParseError，由调用方记为失败。"""
    root = ET.fromstring(text.encode("utf-8") if isinstance(text, str) else text)
    out = []
    for e in root.findall(".//item") or root.findall(f".//{ATOM}entry"):
        if e.tag == "item":
            title, link = e.findtext("title", ""), e.findtext("link", "")
            body = e.findtext("description", "") or e.findtext("{http://purl.org/rss/1.0/modules/content/}encoded", "")
            date = _date(e.findtext("pubDate", "") or e.findtext(f"{DC}date", ""))
            author = e.findtext(f"{DC}creator", "") or e.findtext("author", "")
        else:
            title = e.findtext(f"{ATOM}title", "")
            link = next((l.get("href", "") for l in e.findall(f"{ATOM}link") if l.get("rel", "alternate") == "alternate"), "")
            body = e.findtext(f"{ATOM}summary", "") or e.findtext(f"{ATOM}content", "")
            date = _date(e.findtext(f"{ATOM}published", "") or e.findtext(f"{ATOM}updated", ""))
            author = e.findtext(f"{ATOM}author/{ATOM}name", "")
        m = re.search(r"\(([^)]+)\)", author or "")  # Blogger 写成 "noreply@blogger.com (Jan Jensen)"
        author = clean(plain(m.group(1) if m and "@" in author else author))
        link, title = (link or "").strip(), plain(title)
        if not link.startswith(("http://", "https://")) or (skip and re.search(skip, title)):
            continue
        it = item(source, type_(title) if callable(type_) else type_, title, link, plain(body), date, label,
                  {"authors": author} if author else None)
        if it:
            out.append(it)
        if len(out) >= limit:
            break
    return out

def crawl_feeds(source, feeds):
    """feeds: [(url, 博客名, 类型或 event_type, 每个订阅最多几条, 最多翻几页[, 跳过的标题正则])]；WordPress 用 ?paged=N 翻页。"""
    items, seen, failed = [], set(), 0
    for url, label, type_, per_feed, pages, *skip in feeds:
        got = []
        for page in range(1, pages + 1):
            u = url if page == 1 else f"{url}{'&' if '?' in url else '?'}paged={page}"
            text, st = fetch(u, source, delay=1.2)
            if not text or st != "ok":
                failed += page == 1
                break
            try:
                batch = parse_feed(text, source, label, type_, per_feed, *skip)
            except ET.ParseError as e:
                print(f"[feed-parse] {u} -> {e}", file=sys.stderr)
                failed += page == 1
                break
            _add_new(got, batch, seen)
            if len(got) >= per_feed or not batch:
                break
        items += got[:per_feed]
    status = "error" if failed == len(feeds) else ("partial" if failed else "ok")
    return items, status

def parse_discourse(data, base, cats, source, topic=""):
    """topic：只讨论一个程序的论坛（如 GROMACS 论坛）给每帖补上这个主题，标题里认不出主题的帖子也能归类。"""
    out = []
    users = {u.get("id"): u.get("username", "") for u in data.get("users") or []}
    for t in (data.get("topic_list") or {}).get("topics") or []:
        if t.get("pinned") or t.get("pinned_globally") or not t.get("id") or not t.get("slug"):
            continue  # 置顶的版规、欢迎帖不是讨论
        cat = cats.get(t.get("category_id"), "")
        if re.search(r"feedback|^meta$", cat, re.I):
            continue
        tags = [x if isinstance(x, str) else (x or {}).get("name", "") for x in t.get("tags") or []]
        op = next((users.get(p.get("user_id"), "") for p in t.get("posters") or [] if "Original Poster" in (p.get("description") or "")), "")
        it = item(source, "qa", plain(t.get("title", "")), f"{base}/t/{t['slug']}/{t['id']}", plain(t.get("excerpt") or ""),
                  (t.get("created_at") or "")[:10], " · ".join(x for x in [cat, *tags[:3]] if x and "uncategori" not in x.lower()),
                  {"authors": op, "metric": f"💬 {max(0, (t.get('posts_count') or 1) - 1)} · 👁 {t.get('views', 0)}"})
        if it and topic and topic not in it["tags"]:
            it["tags"] = [x for x in it["tags"] if x != TYPE_DEFAULT_TAG["qa"]][:2] + [topic]
        if it:
            out.append(it)
    return out

def crawl_discourse(source, base, pages, cap, topic=""):
    cats = {}
    text, st = fetch(f"{base}/categories.json?include_subcategories=true", f"{source}_cats", delay=1.2)
    try:
        for c in (json.loads(text)["category_list"]["categories"] if text and st == "ok" else []):
            cats[c["id"]] = c["name"]
            for s in c.get("subcategory_list") or []:
                cats[s["id"]] = s["name"] if c["name"].lower() in s["name"].lower() else f"{c['name']} / {s['name']}"
    except Exception as e:  # 没有分类名也能用，只是卡片上少一行分类
        print(f"[discourse-cats] {base} -> {e}", file=sys.stderr)
    items, seen, status = [], set(), "ok"
    for page in range(pages):
        text, st = fetch(f"{base}/latest.json?page={page}", f"{source}_latest", delay=1.2)
        if not text or st != "ok":
            status = "partial" if items else st
            break
        try:
            batch = parse_discourse(json.loads(text), base, cats, source, topic)
        except Exception as e:
            print(f"[discourse-parse] {base} page {page} -> {e}", file=sys.stderr)
            status = "partial" if items else "error"
            break
        _add_new(items, batch, seen)
        if len(items) >= cap:
            break
    return items[:cap], status

def parse_stackexchange(data, source):
    out = []
    for q in data.get("items") or []:
        link, ts = q.get("link") or "", q.get("creation_date")
        if not link.startswith("https://"):
            continue
        tags = q.get("tags") or []
        it = item(source, "qa", plain(q.get("title", "")), link, plain(q.get("body") or ""),
                  datetime.fromtimestamp(ts, timezone.utc).strftime("%Y-%m-%d") if ts else "", " · ".join(tags[:4]),
                  {"authors": clean(plain((q.get("owner") or {}).get("display_name", ""))),
                   "metric": f"▲ {q.get('score', 0)} · 💬 {q.get('answer_count', 0)}"})
        if it:
            out.append(it)
    return out

def crawl_stackexchange(source, site, tagged, cap):
    """Stack Exchange 官方 API（免 key 每 IP 每天 300 次，这里每周 1 次）。内容为 CC BY-SA，卡片保留作者与原帖链接。"""
    url = (f"https://api.stackexchange.com/2.3/questions?order=desc&sort=creation&site={site}&pagesize={cap}&filter=withbody"
           + (f"&tagged={quote(tagged)}" if tagged else ""))
    text, st = fetch(url, source, delay=1.2)
    if not text or st != "ok":
        return [], st
    data = json.loads(text)
    if data.get("error_id"):
        print(f"[stackexchange] {site} -> {data.get('error_name')}: {data.get('error_message')}", file=sys.stderr)
        return [], "error"
    return parse_stackexchange(data, source)[:cap], "ok"

# 显示名, 仓库；每个仓库取最近 3 个正式版本（跳过草稿和预发布）
RELEASE_REPOS = [
    ("xtb", "grimme-lab/xtb"), ("tblite", "tblite/tblite"), ("PySCF", "pyscf/pyscf"), ("Psi4", "psi4/psi4"), ("NWChem", "nwchemgit/nwchem"),
    ("CP2K", "cp2k/cp2k"), ("Quantum ESPRESSO", "QEF/q-e"), ("DFTB+", "dftbplus/dftbplus"), ("Wannier90", "wannier-developers/wannier90"),
    ("OpenMM", "openmm/openmm"), ("LAMMPS", "lammps/lammps"), ("PLUMED", "plumed/plumed2"), ("MDAnalysis", "MDAnalysis/mdanalysis"),
    ("MDTraj", "mdtraj/mdtraj"), ("OpenFF Toolkit", "openforcefield/openff-toolkit"), ("MACE", "ACEsuit/mace"), ("DeePMD-kit", "deepmodeling/deepmd-kit"),
    ("RDKit", "rdkit/rdkit"), ("Open Babel", "openbabel/openbabel"), ("Avogadro", "OpenChemistry/avogadrolibs"), ("pymatgen", "materialsproject/pymatgen"),
    ("AiiDA", "aiidateam/aiida-core"),
]
def parse_releases(data, label, repo, n=3):
    out = []
    for r in data if isinstance(data, list) else []:
        if r.get("draft") or r.get("prerelease"):
            continue
        name, tag = clean(r.get("name") or ""), clean(r.get("tag_name") or "")
        if not re.search(r"\d", name):
            name = f"{name} {tag}".strip()  # 有的版本名不带版本号（如 "Quantum ESPRESSO"）
        title = name if label.lower() in name.lower() else f"{label} {name}"
        body = re.sub(r"\[([^\]]+)\]\([^)]+\)", r"\1", r.get("body") or "")  # Markdown 链接只留文字
        it = item("ghrel", "software", title, r.get("html_url") or "", re.sub(r"[#*`>]+", " ", plain(body)),
                  (r.get("published_at") or "")[:10], f"GitHub · {repo}",
                  {"metric": r.get("tag_name") or "", "authors": (r.get("author") or {}).get("login", "")})
        if it and it["url"].startswith("https://github.com/"):
            it["tags"] = [t for t in it["tags"] if t != "安装与报错"] or [TYPE_DEFAULT_TAG["software"]]  # 发布说明里的 "bug fixes" 不是报错求助
            out.append(it)
        if len(out) >= n:
            break
    return out

def crawl_releases():
    items, failed = [], 0
    for label, repo in RELEASE_REPOS:
        text, st = fetch(f"https://api.github.com/repos/{repo}/releases?per_page=6", "ghrel", delay=1.0)
        try:
            batch = parse_releases(json.loads(text), label, repo) if text and st == "ok" else None
        except ValueError:
            batch = None
        if batch is None:
            failed += 1
            continue
        items += batch
    items.sort(key=lambda x: x.get("date", ""), reverse=True)
    status = "error" if failed == len(RELEASE_REPOS) else ("partial" if failed else "ok")
    return items[:66], status

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
    # 2026-11-06 补充的国际主流程序与数据库，逐站实测可达。和讲解手册目录（atlas）里同一个网站的，名称和网址照抄 atlas，
    # 合并时归成一条。未收录：GAMESS、WIEN2k（证书链不完整）、DL_POLY（404）、HOOMD-blue、Jmol、Materials Project（403）、ZINC（真人验证页）。
    ("Q-Chem", "https://www.q-chem.com", "量子化学软件", "software"),
    ("Molpro", "https://www.molpro.net/", "量子化学软件", "software"),
    ("TURBOMOLE", "https://www.turbomole.org/", "量子化学软件", "software"),
    ("CFOUR", "https://cfour.uni-mainz.de/cfour/", "量子化学软件", "software"),
    ("MRCC", "https://www.mrcc.hu/", "量子化学软件", "software"),
    ("Dalton", "https://daltonprogram.org/", "量子化学软件", "software"),
    ("OpenMolcas", "https://gitlab.com/Molcas/OpenMolcas", "量子化学软件", "software"),
    ("MOPAC", "https://openmopac.net/", "量子化学软件", "software"),
    ("CREST", "https://crest-lab.github.io/crest-docs/", "量子化学软件", "software"),
    ("QMCPACK", "https://qmcpack.org/", "量子化学软件", "software"),
    ("libxc", "https://libxc.gitlab.io", "量子化学软件", "software"),
    ("SIESTA", "https://siesta-project.org/siesta/", "周期与第一性原理", "software"),
    ("GPAW", "https://gpaw.readthedocs.io/", "周期与第一性原理", "software"),
    ("FHI-aims", "https://fhi-aims.org/", "周期与第一性原理", "software"),
    ("CASTEP", "https://www.castep.org/", "周期与第一性原理", "software"),
    ("CRYSTAL", "https://www.crystal.unito.it/", "周期与第一性原理", "software"),
    ("Octopus", "https://octopus-code.org/", "周期与第一性原理", "software"),
    ("Yambo", "https://www.yambo-code.eu/", "周期与第一性原理", "software"),
    ("BerkeleyGW", "https://berkeleygw.org/", "周期与第一性原理", "software"),
    ("Wannier90", "https://wannier.org/", "周期与第一性原理", "software"),
    ("phonopy", "https://phonopy.github.io/phonopy/", "周期与第一性原理", "software"),
    ("JDFTx", "https://jdftx.org/", "周期与第一性原理", "software"),
    ("NAMD", "https://www.ks.uiuc.edu/Research/namd/", "分子动力学", "software"),
    ("CHARMM", "https://www.charmm.org/", "分子动力学", "software"),
    ("Tinker", "https://dasher.wustl.edu/tinker/", "分子动力学", "software"),
    ("GPUMD", "https://gpumd.org/", "分子动力学", "software"),
    ("MDAnalysis", "https://www.mdanalysis.org/", "分子动力学", "tool"),
    ("MDTraj", "https://www.mdtraj.org/", "分子动力学", "tool"),
    ("Packmol", "https://m3g.github.io/packmol/", "分子动力学", "tool"),
    ("Open Force Field", "https://openforcefield.org/", "分子动力学", "tool"),
    ("MACE", "https://mace-docs.readthedocs.io/", "分子动力学", "software"),
    ("DeePMD-kit", "https://docs.deepmodeling.com/projects/deepmd/", "分子动力学", "software"),
    ("VMD", "https://www.ks.uiuc.edu/Research/vmd/", "化学信息与建模", "software"),
    ("PyMOL", "https://pymol.org/", "化学信息与建模", "software"),
    ("ChimeraX", "https://www.cgl.ucsf.edu/chimerax/", "化学信息与建模", "software"),
    ("VESTA", "https://jp-minerals.org/vesta/en/", "化学信息与建模", "software"),
    ("CDK", "https://cdk.github.io/", "化学信息与建模", "software"),
    ("cclib", "https://cclib.github.io/", "化学信息与建模", "tool"),
    ("AutoDock Vina", "https://vina.scripps.edu", "化学信息与建模", "software"),
    ("DeepChem / MoleculeNet", "https://deepchem.io", "化学信息与建模", "software"),
    ("PubChem", "https://pubchem.ncbi.nlm.nih.gov", "数据库与平台", "database"),
    ("ChEMBL", "https://www.ebi.ac.uk/chembl", "数据库与平台", "database"),
    ("ChemSpider", "https://www.chemspider.com", "数据库与平台", "database"),
    ("Protein Data Bank", "https://www.rcsb.org", "数据库与平台", "database"),
    ("Cambridge Structural Database", "https://www.ccdc.cam.ac.uk", "数据库与平台", "database"),
    ("Crystallography Open Database", "https://www.crystallography.net/cod", "数据库与平台", "database"),
    ("OQMD", "https://www.oqmd.org", "数据库与平台", "database"),
    ("AFLOW", "https://aflow.org", "数据库与平台", "database"),
    ("JARVIS", "https://jarvis.nist.gov", "数据库与平台", "database"),
    ("QCArchive", "https://qcarchive.molssi.org", "数据库与平台", "database"),
    ("Catalysis-Hub", "https://www.catalysis-hub.org", "数据库与平台", "database"),
    ("MolSSI", "https://molssi.org", "数据库与平台", "tool"),
]
def crawl_resdir(prev=()):
    """prev：上次快照里的目录条目。某个官网这次打不开时沿用它上次的条目，目录不会因一个网站临时故障而缺一行。"""
    items, failed = [], []
    for name, url, category, type_ in OFFICIALS:
        slug = re.sub(r"[^a-z0-9]+", "_", name.lower()).strip("_")
        html, st = fetch(url, f"res_{slug}")
        if not html or st != "ok":
            failed.append(name)
            items += [p for p in prev if p.get("url") == url][:1]
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
    ok = len(OFFICIALS) - len(failed)
    status = "ok" if ok >= len(OFFICIALS) * 0.7 else ("partial" if ok else "error")
    if failed:
        print(f"[resdir] failed (kept last snapshot's entry if any): {failed}", file=sys.stderr)
    return (items if ok else []), status

# 国际来源：来源 id -> 抓取函数（括号里的数字是条数上限）
INTL_CRAWLERS = {
    "mattermodeling": lambda: crawl_stackexchange("mattermodeling", "mattermodeling", "", 80),
    "chemse": lambda: crawl_stackexchange("chemse", "chemistry", "computational-chemistry", 80),
    "matsci": lambda: crawl_discourse("matsci", "https://matsci.org", 3, 90),
    "psi4forum": lambda: crawl_discourse("psi4forum", "https://forum.psicode.org", 2, 40, "量子化学"),
    "gromacsforum": lambda: crawl_discourse("gromacsforum", "https://gromacs.bioexcel.eu", 3, 90, "分子动力学"),
    "avogadro": lambda: crawl_discourse("avogadro", "https://discuss.avogadro.cc", 2, 40, "化学信息与建模"),
    "aiida": lambda: crawl_discourse("aiida", "https://aiida.discourse.group", 2, 40),
    "cch": lambda: crawl_feeds("cch", [("https://compchemhighlights.blogspot.com/feeds/posts/default?alt=rss&max-results=50", "Computational Chemistry Highlights", "tutorial", 50, 1)]),
    # 每月的 "Computational Chemistry Highlight: … issue" 只是转告 CCH 新一期，CCH 本身已是来源
    "mmb": lambda: crawl_feeds("mmb", [("https://molecularmodelingbasics.blogspot.com/feeds/posts/default?alt=rss&max-results=150", "Molecular Modeling Basics", "tutorial", 40, 1, r"^Computational Chemistry Highlights?:")]),
    "rzepa": lambda: crawl_feeds("rzepa", [("https://www.ch.imperial.ac.uk/rzepa/blog/?feed=rss2", "Henry Rzepa", "tutorial", 60, 1)]),
    "cheminf": lambda: crawl_feeds("cheminf", [
        ("https://greglandrum.github.io/rdkit-blog/index.xml", "RDKit blog", "tutorial", 12, 1),
        ("https://patwalters.github.io/feed.xml", "Practical Cheminformatics", "tutorial", 10, 1),
        ("https://baoilleach.blogspot.com/feeds/posts/default?alt=rss&max-results=12", "Noel O'Blog", "tutorial", 12, 1),
        ("https://chembl.blogspot.com/feeds/posts/default?alt=rss&max-results=12", "ChEMBL blog", "tutorial", 12, 1),
        ("https://macinchem.org/feed/", "Macs in Chemistry", "tutorial", 12, 2),
        ("https://iwatobipen.wordpress.com/feed/", "Is life worth living?", "tutorial", 10, 1)]),
    "molssi": lambda: crawl_feeds("molssi", [("https://molssi.org/feed/", "MolSSI", event_type, 30, 3)]),
    "psik": lambda: crawl_feeds("psik", [("https://psi-k.net/feed/", "Psi-k", event_type, 40, 4)]),
    "ghrel": crawl_releases,
}

# 显示顺序：中文社区 · 国际问答与论坛 · 国际博客与新闻 · 论文 · 软件与目录。lang 区分中文与国际来源（页面上的构成图用）。
SOURCES_META = [
    {"id": "keinsci", "name": "计算化学公社", "url": "http://bbs.keinsci.com/", "role": "海量真实问答、报错求解、教程帖的主战场", "color": "#2f7f73", "lang": "zh"},
    {"id": "sobereva", "name": "Sobereva 博客", "url": "http://sobereva.com/", "role": "Multiwfn 深度长文、方法论与官方博文目录", "color": "#6e5aa8", "lang": "zh"},
    {"id": "xmol", "name": "X-MOL 学术平台", "url": "https://www.x-mol.com/", "role": "文献追踪、学科频道与学术工具", "color": "#3f8a4f", "lang": "zh"},
    {"id": "ccl", "name": "CCL 计算化学列表", "url": "https://www.ccl.net/chemistry/", "role": "历史最久的邮件列表归档、软件与资源索引", "color": "#b07a1e", "lang": "en"},
    {"id": "mattermodeling", "name": "Matter Modeling Stack Exchange", "url": "https://mattermodeling.stackexchange.com/", "role": "材料与分子模拟问答社区的最新提问（Stack Exchange 官方 API；内容为 CC BY-SA，作者与原帖见卡片）", "color": "#8a4f9e", "lang": "en"},
    {"id": "chemse", "name": "Chemistry Stack Exchange · 计算化学", "url": "https://chemistry.stackexchange.com/questions/tagged/computational-chemistry", "role": "化学问答社区 computational-chemistry 标签的最新提问（Stack Exchange 官方 API；CC BY-SA）", "color": "#b24a3a", "lang": "en"},
    {"id": "matsci", "name": "matsci.org 材料模拟论坛", "url": "https://matsci.org/", "role": "LAMMPS、OVITO、pymatgen、Materials Project、ASE、NOMAD 等程序的官方论坛（Discourse 公开 JSON 接口）", "color": "#2b6a9f", "lang": "en"},
    {"id": "psi4forum", "name": "Psi4 论坛", "url": "https://forum.psicode.org/", "role": "Psi4 量子化学程序的官方论坛（Discourse 公开 JSON 接口）", "color": "#6a7f1c", "lang": "en"},
    {"id": "gromacsforum", "name": "GROMACS 论坛", "url": "https://gromacs.bioexcel.eu/", "role": "GROMACS 分子动力学程序的官方论坛（Discourse 公开 JSON 接口）", "color": "#a3620f", "lang": "en"},
    {"id": "avogadro", "name": "Avogadro 论坛", "url": "https://discuss.avogadro.cc/", "role": "Avogadro 分子编辑器的官方论坛（Discourse 公开 JSON 接口）", "color": "#4f7f3a", "lang": "en"},
    {"id": "aiida", "name": "AiiDA 论坛", "url": "https://aiida.discourse.group/", "role": "AiiDA 计算工作流平台的官方论坛（Discourse 公开 JSON 接口）", "color": "#5a5fb0", "lang": "en"},
    {"id": "cch", "name": "Computational Chemistry Highlights", "url": "https://compchemhighlights.blogspot.com/", "role": "计算化学新论文的精选点评（Jan Jensen 等编辑，博客 RSS）", "color": "#7d4e2c", "lang": "en"},
    {"id": "mmb", "name": "Molecular Modeling Basics", "url": "https://molecularmodelingbasics.blogspot.com/", "role": "Jan Jensen 的分子模拟教学与研究博客（博客 RSS）", "color": "#4f6d8f", "lang": "en"},
    {"id": "rzepa", "name": "Henry Rzepa 博客", "url": "https://www.ch.imperial.ac.uk/rzepa/blog/", "role": "帝国理工 Henry Rzepa 关于化学结构、反应机理与计算的博客（博客 RSS）", "color": "#8c3b5c", "lang": "en"},
    {"id": "cheminf", "name": "化学信息学博客", "url": "https://greglandrum.github.io/rdkit-blog/", "role": "RDKit 博客、Pat Walters、Noel O'Boyle、ChEMBL、Macs in Chemistry、iwatobipen 的最新文章（各博客 RSS）", "color": "#a33f73", "lang": "en"},
    {"id": "molssi", "name": "MolSSI 新闻与活动", "url": "https://molssi.org/", "role": "美国分子科学软件研究所的新闻、研讨会、培训与职位（官网 RSS）", "color": "#1f6f8b", "lang": "en"},
    {"id": "psik", "name": "Psi-k 社区公告", "url": "https://psi-k.net/", "role": "欧洲电子结构计算社区的职位、研讨会与学校公告（官网 RSS）", "color": "#6f5a2e", "lang": "en"},
    {"id": "arxiv", "name": "arXiv 化学物理", "url": "https://arxiv.org/list/physics.chem-ph/recent", "role": "化学物理最新预印本，加上计算物理里讲分子与化学的部分（arXiv 官方 API，按提交时间倒序）", "color": "#b0414f", "lang": "en"},
    {"id": "crossref", "name": "最新期刊论文 · Crossref", "url": "https://www.crossref.org/", "role": "JCTC、JCIM、JCC、WIREs CMS、npj Comput. Mater.、Digital Discovery 等 22 种期刊的最新论文元数据；JCP、PCCP、JPC A/B/C 等综合期刊只收理论与计算类（Crossref 官方 API，DOI 直达）", "color": "#3d6fa8", "lang": "en"},
    {"id": "github", "name": "GitHub 开源项目", "url": "https://github.com/topics/computational-chemistry", "role": "计算化学开源软件与工具库（GitHub 官方 API，按 Star 排序）", "color": "#4c535c", "lang": "en"},
    {"id": "ghrel", "name": "主流程序发布说明", "url": "https://github.com/", "role": "xtb、PySCF、Psi4、CP2K、OpenMM、LAMMPS、RDKit、MACE 等 22 个开源程序的最新正式版本（GitHub 官方 API）", "color": "#3b4a6b", "lang": "en"},
    {"id": "resdir", "name": "官方软件与数据库", "url": "", "role": "主流软件官网与权威数据库目录（逐站实测可达才收录，点卡片进各官网）", "color": "#2f7d8c", "lang": "en"},
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
    prev_resdir = [it for it in prev.get("items", []) if it.get("source") == "resdir"]

    def run(label, fn, *a):
        """一个来源出错（网络、接口改版、坏数据）只让它这次落空、沿用上周条目，不影响其他来源。"""
        print(f"[{label}] ...")
        try:
            return fn(*a)
        except Exception as e:
            print(f"      {label} failed: {type(e).__name__}: {e}", file=sys.stderr)
            return None

    sob_items, pairs, sob_status = run("sobereva", crawl_sobereva) or ([], [], "error")
    xmol_items, xmol_status, xmol_stats = run("xmol", crawl_xmol) or ([], "error", [])
    fresh = {"sobereva": (sob_items, sob_status), "xmol": (xmol_items, xmol_status),
             "keinsci": run("keinsci", crawl_keinsci, pairs, args.max_keinsci) or ([], "error")}
    for sid, fn in [("ccl", crawl_ccl), ("arxiv", crawl_arxiv), ("crossref", crawl_crossref), ("github", crawl_github),
                    ("resdir", lambda: crawl_resdir(prev_resdir)), *INTL_CRAWLERS.items()]:
        fresh[sid] = run(sid, fn) or ([], "error")
    for sid, (items, st) in fresh.items():
        print(f"      {sid:15} items={len(items):4} status={st}")
    sources, uniq = assemble(fresh, prev, now)
    out = {"generatedAt": now, "generator": "crawler.py (titles+short excerpts+links only)",
           "xmolHomepageStats": xmol_stats, "sources": sources, "items": uniq,
           "compliance": "仅收录标题、短摘要与原文链接；只用官方 API（arXiv/Crossref/GitHub/Stack Exchange）、Discourse 论坛的公开 JSON 接口和 RSS/Atom 订阅；不绕过人机验证；尊重 robots.txt（如小木虫论坛被 robots 禁止，故不收录其帖子）；Stack Exchange 内容为 CC BY-SA，卡片保留作者与原帖链接；各站状态如实标注。"}
    data_path.write_text(json.dumps(out, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"DONE total={len(uniq)} -> {data_path}")

def assemble(fresh, prev, now):
    """fresh: {来源 id: (本次条目, 状态)}；prev: 上次的 data.json。返回 (sources, 去重后的 items)。
    本次没抓到条目的来源沿用上次的条目（状态 cache，时间标上次）；上次有、这里不抓的来源（ChemRxiv）原样带过去。"""
    prev_by_source, prev_sources = {}, {s["id"]: s for s in prev.get("sources", [])}
    for it in prev.get("items", []):
        prev_by_source.setdefault(it["source"], []).append(it)
    status_detail = {
        "ok": "直抓成功", "blocked": "被人机验证/WAF 拦截", "snapshot": "使用同日真实首页快照",
        "mirror": "经 Sobereva 官方目录交叉引用", "cache": "本次失败，保留上次缓存",
        "partial": "部分抓取成功（其余站点不可达已跳过）",
    }
    all_items, sources = [], []
    for meta in SOURCES_META:
        sid = meta["id"]
        items, st = fresh.get(sid, ([], "error"))
        used_cache, fetched = False, now
        if not items and prev_by_source.get(sid):
            items, st, used_cache = prev_by_source[sid], "cache", True
            fetched = prev_sources.get(sid, {}).get("fetchedAt", now)  # 缓存条目标上次真正抓到的时间
        all_items.extend(items)
        sources.append({**meta, "status": st, "statusLabel": status_detail.get(st, st),
                        "fetchedAt": fetched, "itemCount": len(items), "usedCache": used_cache})
    # 由其他脚本写入的来源（ChemRxiv 由 tools/hub-chemrxiv.ts 刷新）先沿用上周条目；那个脚本成功时会整体替换它
    known = {m["id"] for m in SOURCES_META}
    for sid, s in prev_sources.items():
        if sid not in known and prev_by_source.get(sid):
            at = next((i + 1 for i, x in enumerate(sources) if x["id"] == "arxiv"), len(sources))
            sources.insert(at, {**s, "status": "cache", "statusLabel": status_detail["cache"], "usedCache": True,
                                "itemCount": len(prev_by_source[sid])})
            all_items.extend(prev_by_source[sid])
    # 全局去重（同 URL 只留一条，科音镜像与 Sobereva 原文是不同 URL，不冲突）
    seen, uniq = set(), []
    for it in all_items:
        if it["url"] in seen: continue
        seen.add(it["url"]); uniq.append(it)
    for s in sources:
        s["itemCount"] = sum(it["source"] == s["id"] for it in uniq)
    return sources, uniq

if __name__ == "__main__":
    main()
