#!/usr/bin/env python3
"""论文工坊的对照数据：用 PaperOrchestra Studio 原版的 Python 函数跑一遍样例，写成 tools/paper/fixtures.json，
tools/paper-test.mjs 拿 po-core.js / po-audit.js / po-flow.js 的结果逐项对照（中文结论逐字一样）。

用法：python3 tools/paper/fixtures.py [--src <paper-orchestra-studio 的路径>] [--check]
只用标准库；不跑编译、不联网。样例在 tools/paper/samples/（MolAstria 自己写的），另加 19 套模板的 template.tex。
"""
import difflib
import json
import os
import re
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "tools", "paper", "fixtures.json")
SAMPLES = os.path.join(ROOT, "tools", "paper", "samples")
TEMPLATES = os.path.join(ROOT, "public", "paper", "templates")

args = sys.argv[1:]
check = "--check" in args
src = os.environ.get("PO_REPO") or os.path.join(ROOT, "..", "paper-orchestra-studio")
if "--src" in args:
    src = args[args.index("--src") + 1]
PO = os.path.join(src, "paper-orchestra")
if not os.path.isdir(PO):
    raise SystemExit(f"找不到 PaperOrchestra Studio：{PO}（用 --src 或 PO_REPO 指定）")
sys.path.insert(0, PO)

from tools import submission_tools as st  # noqa: E402
from tools import latex_copilot as lc  # noqa: E402
from utils import citation_audit as ca  # noqa: E402
from utils.venue_profile import venue_note  # noqa: E402


def studio_function(name):
    """research_studio.py 里的一个函数（那个模块要 json_repair 等依赖，所以只取这个函数的源码，配 numpy / pandas 执行；
    画图的 matplotlib 换成什么都不做的替身）。"""
    import ast
    from unittest import mock
    import numpy as np
    import pandas as pd
    src = read(os.path.join(PO, "tools", "research_studio.py"))
    tree = ast.parse(src)
    env = {"np": np, "pd": pd, "os": os, "json": json, "re": re, "Any": object, "Dict": dict, "List": list}
    mpl = sys.modules.setdefault("matplotlib", mock.MagicMock())
    plt = mpl.pyplot = sys.modules.setdefault("matplotlib.pyplot", mock.MagicMock())
    plt.subplots.return_value = (mock.MagicMock(), mock.MagicMock())
    for node in tree.body:
        if isinstance(node, ast.FunctionDef) and node.name in (name, "_read_tabular_file"):
            exec(compile(ast.Module([node], []), "research_studio.py", "exec"), env)
    return env[name]


def read(path):
    with open(path, encoding="utf-8") as f:
        return f.read()


def venue_of(folder):
    p = os.path.join(folder, "venue.json")
    return json.load(open(p, encoding="utf-8")) if os.path.isfile(p) else None


def manuscript(text, venue):
    """cmd_manuscript_audit without the run folder."""
    lines = st.code_lines(text)
    code = "\n".join(c for _, c in lines)
    b_lines = st._body_lines(lines)
    body = "\n".join(c for _, c in b_lines)
    abstract_raw = st._extract_abstract_block(body)
    is_journal = bool(venue or re.search(r"\\bibliographystyle\s*\{\s*naturemag\s*\}", code)
                      or (re.search(r"\\section\*\s*\{\s*Methods\s*\}", body, re.I)
                          and re.search(r"\\section\*\s*\{\s*Data availability\s*\}", body, re.I)))
    checks = [
        st._audit_wordcount(body, abstract_raw, venue, is_journal),
        st._audit_ai_tells(b_lines, abstract_raw, body=body, is_journal=is_journal),
        st._audit_figure_refs(body, is_journal, code=code),
        st._audit_draft_markers(b_lines),
        st._audit_stats_reporting(body),
        st._audit_back_matter(body, code, is_journal, venue),
    ]
    return {"isJournal": is_journal, "checks": checks}


def blind(text):
    """cmd_blind without the PDF part."""
    lines = st.code_lines(text)
    code = "\n".join(c for _, c in lines)
    venue, is_blind, why = st.detect_venue(code)
    out = {"venue": venue, "doubleBlind": is_blind, "why": why, "checks": []}
    if not (venue and is_blind):
        return out

    def hits(regex):
        return [f"第 {n} 行：{c.strip()[:120]}" for n, c in lines if regex.search(c)]

    m = re.search(r"\\author\b", code)
    authors = st.braced_arg(code, m.end())[0] if m else ""
    plain = re.sub(r"\\[A-Za-z@]+|[{}\\]", " ", authors)
    if authors and not st.ANON_NAMES.search(authors) and plain.strip():
        out["checks"].append(st.row("authors", "fail", "", "", [plain.strip()[:200]]))
    else:
        out["checks"].append(st.row("authors", "ok", ""))
    for id_, rx, bad in (("thanks", re.compile(r"\\thanks\s*\{"), "fail"), ("ack", st.ACK_RE, "fail"),
                         ("links", st.ACCOUNT_RE, "warn"), ("self-cite", st.SELF_CITE_RE, "warn")):
        h = hits(rx)
        out["checks"].append(st.row(id_, bad if h else "ok", "", "", h))
    pa = hits(re.compile(r"pdfauthor\s*="))
    if pa:
        out["checks"].append(st.row("pdfauthor", "fail", "", "", pa))
    return out


def digest(v):
    """大的结果只存哈希：JSON（ensure_ascii=False、紧凑分隔符）的 SHA-256，JS 那边用 JSON.stringify 算同一个。"""
    import hashlib
    return hashlib.sha256(json.dumps(v, ensure_ascii=False, separators=(",", ":")).encode("utf-8")).hexdigest()


def tex_case(name, text, venue):
    stripped, comments = st.strip_comments(text)
    abs_block = st._extract_abstract_block(text)
    abs_clean = st._clean_prose_block(abs_block).strip() if abs_block else ""
    intro = st._extract_intro_block(text)
    intro_clean = st._clean_prose_block(intro).strip() if intro else ""
    return {
        "name": name,
        "venue": venue,
        "stripComments": {"text": digest(stripped), "comments": comments if not name.startswith("templates/") else digest(comments)},
        "codeLines": digest(st.code_lines(text)),
        "manuscript": manuscript(text, venue),
        "blind": blind(text),
        "abstract": abs_clean,
        "intro": intro_clean,
        "abstractAudit": st.audit_text_draft(abs_clean, "abstract") if abs_clean else None,
        "introAudit": st.audit_text_draft(intro_clean, "introduction") if intro_clean else None,
        "abstractFields": lc._diagnose_abstract_fields(abs_clean) if abs_clean else None,
        "sentences": digest(st._split_sentences(st._clean_prose_block(text))),
    }


cases = []
for f in sorted(os.listdir(SAMPLES)):
    if f.endswith(".tex"):
        cases.append(tex_case(f, read(os.path.join(SAMPLES, f)), None))
templates = sorted(d for d in os.listdir(TEMPLATES) if os.path.isdir(os.path.join(TEMPLATES, d)))
for d in templates:
    cases.append(tex_case(f"templates/{d}", read(os.path.join(TEMPLATES, d, "template.tex")), venue_of(os.path.join(TEMPLATES, d))))

ROLES = ["outline", "literature", "writing", "refinement", "review", "meta_review"]
venue_notes = {"texts": [], "byTemplate": {}}
for d in templates:
    v = venue_of(os.path.join(TEMPLATES, d))
    profile = v if isinstance(v, dict) and v.get("kind") == "journal" else None
    row = {}
    for r in ROLES:
        note = venue_note(profile, r)
        # 一套期刊模板留全文（出错时看得出差在哪），其余只留哈希
        keep = note if d == "journal-nature" or not note else digest(note)
        if keep not in venue_notes["texts"]:
            venue_notes["texts"].append(keep)
        row[r] = venue_notes["texts"].index(keep)
    venue_notes["byTemplate"][d] = row

log = read(os.path.join(SAMPLES, "compile.log"))
bib = read(os.path.join(SAMPLES, "refs.bib"))
cites_tex = read(os.path.join(SAMPLES, "cites.tex"))
cited_list, star = ca.parse_citations(cites_tex)

# 标题相似度和逐行比较：几组固定的字符串
pairs = [
    ("Attention Is All You Need", "Attention is all you need."),
    ("Machine-Learned Potentials for Reactive Chemistry", "Machine learned potentials for reactive chemical dynamics"),
    ("abcd", "bcde"),
    ("", ""),
    ("A short title", "Completely different words here"),
    ("x" * 250 + "y" * 30, "y" * 30 + "x" * 240),
]
ratio = [[a, b, difflib.SequenceMatcher(None, st.norm_title(a), st.norm_title(b)).ratio() if st.norm_title(a) and st.norm_title(b) else 0.0] for a, b in pairs]
raw_ratio = [[a, b, difflib.SequenceMatcher(None, a, b).ratio()] for a, b in pairs]
old_lines = read(os.path.join(SAMPLES, "conference.tex")).splitlines()
new_lines = list(old_lines)
new_lines[3] = "% removed pdfauthor"
del new_lines[20:23]
new_lines.insert(40, "\\section{Discussion}")
new_lines.append("% end")
long_old = [f"line {i % 7}" for i in range(260)]
long_new = [x for i, x in enumerate(long_old) if i % 37 != 5] + ["tail"]
diffs = [
    {"a": old_lines, "b": new_lines, "out": list(difflib.unified_diff(old_lines, new_lines, "main.tex", "main.tex (AI 修订)", lineterm="", n=2))},
    {"a": long_old, "b": long_new, "out": list(difflib.unified_diff(long_old, long_new, "a", "b", lineterm="", n=3))},
]

def benchmark(path):
    import tempfile
    out = studio_function("_run_numpy_math_benchmark")([path], tempfile.mkdtemp())
    out.pop("chartPath", None)
    return out


# ── 提示词：原版拼出来的样子 ───────────────────────────────────────────────
# LaTeX 助手和摘要改写：原版的 cmd_edit / cmd_polish_abstract 真跑一遍，大模型换成记下提示词、给固定回答的替身。
import argparse  # noqa: E402
import tempfile  # noqa: E402
import types  # noqa: E402

calls = []
reply_box = {"text": ""}


def fake_llm(prompt, model_name, generation_configs, result_parsing_func):
    calls.append({"prompt": prompt, "system": generation_configs.get("system_instruction")})
    return {"parsed_response": reply_box["text"]}


fake = types.ModuleType("utils.llm_backend_utils")
fake.call_llm_with_text_prompt = fake_llm
fake.has_any_llm_credentials = lambda: True
fake.resolve_task_model = lambda requested, task: "fake-model"
sys.modules["utils.llm_backend_utils"] = fake
banana = types.ModuleType("utils.paper_banana_utils")
banana.identity_parse = lambda x: x
sys.modules["utils.paper_banana_utils"] = banana

conference = read(os.path.join(SAMPLES, "conference.tex"))
odd = "\\section{A}\r\nline two\u2028line three\x0cfour\nfive\x85six\n\nlast without newline"
copilot_cases = [
    {"name": "conference.tex", "source": conference, "instruction": "  Tighten the abstract  ", "start": 5, "end": 9, "error": "! Undefined control sequence." + "x" * 3100 + "😀",
     "reply": "Here you go:\n```latex\nNEW LINE A\nNEW LINE B\n```\nDone."},
    {"name": "conference.tex", "source": conference, "instruction": "Center every table", "start": None, "end": None, "error": "",
     "reply": "```tex\n" + conference.rstrip("\n").replace("\\begin{table}", "\\begin{table}\\centering") + "\n```"},
    {"name": "conference.tex", "source": conference, "instruction": "fix", "start": 3, "end": 99999, "error": "", "reply": "\\documentclass{article}\n\\begin{document}x\\end{document}"},
    {"name": "odd.tex", "source": odd, "instruction": "rewrite line 2", "start": 2, "end": 3, "error": "", "reply": "```latex\nREPLACED\n```"},
    {"name": "odd.tex", "source": odd, "instruction": "last", "start": 7, "end": 8, "error": "", "reply": "```\nNEW END\n```"},
]
copilot = []
for case in copilot_cases:
    d = tempfile.mkdtemp()
    path = os.path.join(d, case["name"])
    with open(path, "w", encoding="utf-8", newline="") as f:
        f.write(case["source"])
    reply_box["text"] = case["reply"]
    calls.clear()
    out = lc.cmd_edit(argparse.Namespace(file=path, instruction=case["instruction"], selection_start=case["start"], selection_end=case["end"],
                                         error_log=case["error"], model="auto"))
    copilot.append({**case, "prompt": calls[0]["prompt"], "system": calls[0]["system"], "revised": out["revisedContent"], "diff": out["diff"],
                    "changedLines": out["changedLines"], "summary": out["summary"]})

polish = []
for name in ("conference.tex", "journal-long.tex"):
    reply_box["text"] = '```json\n{"revisedAbstract": "We predict barriers with 3.1 kcal/mol error.", "changeTable": [{"original": "a", "revised": "b"}]}\n```'
    calls.clear()
    out = lc.cmd_polish_abstract(argparse.Namespace(mode="rewrite", text="", intro_text="", file=os.path.join(SAMPLES, name), run_dir="", model="auto"))
    polish.append({"name": name, "prompt": calls[0]["prompt"], "system": calls[0]["system"], "abstract": out["abstract"], "beforeAudit": out["beforeAudit"],
                   "afterAudit": out["afterAudit"], "missingFields": out["missingFields"], "summary": out["summary"]})

# 检索词和科研工坊的五个 SOP：拼提示词的 f-string 在大函数里（要联网、要读附件），所以只取那一句，用同样的变量求值。
import ast  # noqa: E402


def fstrings(rel, fn_name, target):
    src = read(os.path.join(PO, rel))
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.FunctionDef) and node.name == fn_name:
            fn = node
            break
    found = []
    for node in ast.walk(fn):
        if isinstance(node, ast.If) and isinstance(node.test, ast.Compare) and getattr(node.test.left, "id", None) == "sop":
            for stmt in node.body:
                if isinstance(stmt, ast.Assign) and getattr(stmt.targets[0], "id", None) == target:
                    found.append((node.test.comparators[0].value, stmt.value))
        elif isinstance(node, ast.Assign) and getattr(node.targets[0], "id", None) == target and fn_name != "cmd_run_sop":
            found.append((None, node.value))
    return found


def evaluate(node, ns):
    return eval(compile(ast.Expression(node), "prompt", "eval"), {"json": json, "__builtins__": __builtins__}, ns)


query_node = fstrings("methods/agents/literature_review_agent.py", "_discover_candidates_via_scholar_apis", "query_prompt")[0][1]
query = []
for task in [{"search_type": "exploration", "focus": "machine-learned potentials for reaction barriers", "context": "Hook: speed. Gap: accuracy"},
             {"focus": "Vaswani et al. (Attention Is All You Need)", "context": "Must-have citation"}]:
    query.append({"task": task, "core": "barriers are expensive", "cutoff": "2025-06",
                  "prompt": evaluate(query_node, {"task": task, "core_problem": "barriers are expensive", "cutoff_date": "2025-06"})})

pool_items = [
    {"title": "Reaction barriers from machine learning", "authors": "A. Smith, B. Lee", "year": 2024, "venue": "J. Chem. Phys.", "doi": "10.1/x",
     "url": "https://doi.org/10.1/x", "abstract": "We learn barriers. " * 40 + "末尾中文😀", "notes": "", "readDepth": "abstract_only", "gb7714": "SMITH A. X[J].", "bibtex": "@article{x}"},
    {"title": "第二篇：催化反应网络", "authors": "王 小明", "year": 2023, "venue": "化学学报", "doi": "", "url": "", "abstract": "摘要" * 300,
     "notes": "笔记", "readDepth": "full_read", "gb7714": "王小明. 催化[J].", "bibtex": ""},
]
sop_inputs = [
    {"topic": "  Barrier prediction  ", "notes": " keep it short ", "prefs": " Prefer SI units ", "attached": "正" * 9999 + "😀" + "尾" * 4500,
     "manifest": [{"name": "paper.pdf", "sha256": "ab" * 32, "chars": 12000}], "pool": pool_items,
     "extra": {"timeframe": "4 周", "discipline": "物理化学", "equipment": "1 GPU", "targetLevel": "复现表 2", "repoUrl": "https://github.com/x/y"}, "bench": "bench.csv"},
    {"topic": "", "notes": "", "prefs": "", "attached": "", "manifest": [], "pool": [], "extra": {}, "bench": None},
]
sops = {"inputs": [], "prompts": []}
for n_in, inp in enumerate(sop_inputs):
    bench = benchmark(os.path.join(SAMPLES, inp["bench"])) if inp["bench"] else {}
    prefs_md = inp["prefs"].strip()
    ns = {
        "topic": inp["topic"].strip(), "notes": inp["notes"].strip(),
        "prefs_block": f"\n\n### Persistent Research Preferences & Long-Term Memory\n{prefs_md}\n" if prefs_md else "",
        "attached_text": inp["attached"], "resource_manifest": inp["manifest"], "lit_pool": inp["pool"], "bench": bench,
        "timeframe": inp["extra"].get("timeframe") or "2-3 周", "discipline": inp["extra"].get("discipline") or "",
        "equipment": inp["extra"].get("equipment") or "", "target_level": inp["extra"].get("targetLevel") or "重新实现核心算法并用可控/替代基准定量验证",
        "repo_url": inp["extra"].get("repoUrl") or "",
    }
    for sop, node in fstrings("tools/research_studio.py", "cmd_run_sop", "prompt"):
        text = evaluate(node, ns)
        sops["prompts"].append({"sop": sop, "input": n_in, "prompt": text if n_in else digest(text), "length": len(text)})
    sops["inputs"].append({**inp, "bench": bench})


# Python 的 round 和 json.dumps：po-core.js 的 pyRoundN、po-flow.js 的 pyJSON 照着做。
round_cases = [[x, n, round(x, n)] for x, n in [(0.12345, 4), (2.675, 2), (1.00005, 4), (0.125, 2), (0.375, 2), (-0.125, 2),
                                                 (2.5, 0), (3.5, 0), (-2.5, 0), (1e-7, 4), (123.456789, 2), (0.0, 3), (-0.0004, 3)]]
# JS 分不出 3 和 3.0，所以这里只放 Python 和 JS 写法一样的数（整数、非整数的小数）。
json_values = [{"a": 1, "b": [2.5, None, True, False], "中文": "引号\"和\\反斜杠\n换行\t", "e": 1e-7, "big": 1.5e21, "neg": -7,
                "nested": {"x": [], "y": {}, "z": [[]]}, "u": "\u2028\u00e9\U0001F600\x7f\x01"}, [0.1, 1 / 3, 2 / 3, 123456.789, 1e16 + 2], "plain", []]
pyjson = [[v, ind, asc, json.dumps(v, indent=ind, ensure_ascii=asc)] for v in json_values for ind in (None, 1, 4) for asc in (True, False)]

data = {
    "cases": cases,
    "venueNotes": venue_notes,
    "log": {"parsed": st.parse_log(log, "main.tex"), "unwrapped": st.unwrap_log(log)},
    "bib": {"parsed": ca.parse_bib(bib), "cited": cited_list, "star": star,
            "citedBib": ca.cited_bib_text([("refs.bib", bib)], set(cited_list))[0],
            "citedCount": ca.cited_bib_text([("refs.bib", bib)], set(cited_list))[1]},
    "ratio": ratio,
    "rawRatio": raw_ratio,
    "diffs": diffs,
    "cleanLatex": [[x, ca.clean_latex_text(x)] for x in ["\\emph{Deep} {Learning}~for \\textit{all}", "", "  a  b "]],
    "copilot": copilot,
    "polish": polish,
    "query": query,
    "sops": sops,
    "benchmark": [[f, benchmark(os.path.join(SAMPLES, f))] for f in ("bench.csv",)],
    "round": round_cases,
    "pyjson": pyjson,
    "surname": [[x, st.first_author_surname(x)] for x in ["Smith, John and Lee, Ann", "Ann Lee", "{\\'E}mile Zola and X", ""]],
}
text = json.dumps(data, ensure_ascii=False, separators=(",", ":")) + "\n"
if check:
    if not os.path.isfile(OUT) or read(OUT) != text:
        raise SystemExit("tools/paper/fixtures.json 不是最新的（运行 python3 tools/paper/fixtures.py）")
    print("对照数据是最新的")
else:
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"写好了 {len(cases)} 份样例的对照数据")
