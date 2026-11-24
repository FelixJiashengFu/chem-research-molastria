#!/usr/bin/env python3
"""论文工坊的提示词：从 PaperOrchestra Studio（Apache-2.0）原样取出，写成 public/paper/po-prompts.js。

用法：python3 tools/paper/extract-prompts.py [--src <paper-orchestra-studio 的路径>] [--check]

只读源文件、不 import 任何依赖（用 ast 取模块级的字符串常量），所以不用装 PaperOrchestra 的环境。
Python 的 .format 占位符（{cutoff_date}、{{ }}）原样保留，由 po-core.js 的 fill() 按同样的规则替换。
"""
import ast
import json
import os
import sys

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", ".."))
OUT = os.path.join(ROOT, "public", "paper", "po-prompts.js")

args = sys.argv[1:]
check = "--check" in args
src = os.environ.get("PO_REPO") or os.path.join(ROOT, "..", "paper-orchestra-studio")
if "--src" in args:
    src = args[args.index("--src") + 1]
PO = os.path.join(src, "paper-orchestra")


def constants(rel):
    """Module-level NAME = <str expression> in a source file, evaluated with the other constants in scope."""
    tree = ast.parse(open(os.path.join(PO, rel), encoding="utf-8").read())
    found = {}
    for node in tree.body:
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and isinstance(node.targets[0], ast.Name):
            name = node.targets[0].id
            try:
                value = eval(compile(ast.Expression(node.value), rel, "eval"), {"__builtins__": {}}, dict(found))
            except Exception:  # noqa: BLE001  (an expression that needs a function call: not a prompt)
                continue
            if isinstance(value, (str, dict)):
                found[name] = value
    return found


shared = constants("utils/prompt_utils.py")
NO_LEAK = shared["UNIVERSAL_NO_LEAKAGE_PROMPT"]


def prompt(rel, name):
    tree = ast.parse(open(os.path.join(PO, rel), encoding="utf-8").read())
    for node in tree.body:
        if isinstance(node, ast.Assign) and getattr(node.targets[0], "id", None) == name:
            return eval(compile(ast.Expression(node.value), rel, "eval"), {"__builtins__": {}}, {"UNIVERSAL_NO_LEAKAGE_PROMPT": NO_LEAK})
    raise SystemExit(f"{rel} 里没有 {name}")


lit = constants("methods/agents/literature_review_agent.py")
rev = constants("autoraters/agent_review.py")

def flatten(node, src):
    """An f-string (or a sum of strings and f-strings) as pieces: {"t": literal} or {"x": the expression's source}."""
    if isinstance(node, ast.BinOp) and isinstance(node.op, ast.Add):
        return flatten(node.left, src) + flatten(node.right, src)
    if isinstance(node, ast.JoinedStr):
        out = []
        for v in node.values:
            if isinstance(v, ast.Constant):
                out.append({"t": v.value})
            else:
                if v.conversion != -1 or v.format_spec is not None:
                    raise SystemExit(f"不认识的 f-string 写法：{ast.get_source_segment(src, v)}")
                out.append({"x": ast.unparse(v.value)})
        return out
    if isinstance(node, ast.Constant) and isinstance(node.value, str):
        return [{"t": node.value}]
    return [{"x": ast.unparse(node)}]


def merged(parts):
    out = []
    for p in parts:
        if "t" in p and out and "t" in out[-1]:
            out[-1] = {"t": out[-1]["t"] + p["t"]}
        elif p != {"t": ""}:
            out.append(p)
    return out


def function(rel, name):
    src = open(os.path.join(PO, rel), encoding="utf-8").read()
    for node in ast.walk(ast.parse(src)):
        if isinstance(node, ast.FunctionDef) and node.name == name:
            return node, src
    raise SystemExit(f"{rel} 里没有函数 {name}")


def assigned(fn, src, target):
    """Every `target = <string expression>` in a function, in source order."""
    found = []
    for node in ast.walk(fn):
        if isinstance(node, ast.Assign) and len(node.targets) == 1 and getattr(node.targets[0], "id", None) == target:
            if isinstance(node.value, (ast.JoinedStr, ast.BinOp, ast.Constant)):
                found.append((node.lineno, merged(flatten(node.value, src))))
    return [p for _, p in sorted(found, key=lambda x: x[0])]


def system_instructions(fn):
    out = []
    for node in ast.walk(fn):
        if isinstance(node, ast.Dict):
            for k, v in zip(node.keys, node.values):
                if isinstance(k, ast.Constant) and k.value == "system_instruction" and isinstance(v, ast.Constant):
                    out.append((node.lineno, v.value))
    return [v for _, v in sorted(out)]


# Research Studio 的五个 SOP：if / elif sop == "<名字>" 里的 prompt = f"..."。
sop_fn, sop_src = function("tools/research_studio.py", "cmd_run_sop")
SOPS = {}
for node in ast.walk(sop_fn):
    if isinstance(node, ast.If) and isinstance(node.test, ast.Compare) and getattr(node.test.left, "id", None) == "sop" \
            and isinstance(node.test.comparators[0], ast.Constant):
        name = node.test.comparators[0].value
        for stmt in node.body:
            if isinstance(stmt, ast.Assign) and getattr(stmt.targets[0], "id", None) == "prompt":
                SOPS[name] = merged(flatten(stmt.value, sop_src))
if sorted(SOPS) != ["lit_review", "math_modeling", "paper_reading", "reproduction", "topic_ideation"]:
    raise SystemExit(f"research_studio.py 的 SOP 变了：{sorted(SOPS)}")

q_fn, q_src = function("methods/agents/literature_review_agent.py", "_discover_candidates_via_scholar_apis")
edit_fn, edit_src = function("tools/latex_copilot.py", "cmd_edit")
pol_fn, pol_src = function("tools/latex_copilot.py", "cmd_polish_abstract")
edit_prompts = assigned(edit_fn, edit_src, "prompt")
if len(edit_prompts) != 2:
    raise SystemExit("latex_copilot.cmd_edit 应该有两段提示词（选中几行 / 整个文件）")

P = {
    "noLeakage": NO_LEAK,
    "outline": prompt("methods/prompts/outline_agent.py", "outline_agent_system_prompt"),
    "literature": prompt("methods/prompts/literature_review_agent.py", "literature_review_agent_writter_prompt"),
    "sectionWriting": prompt("methods/prompts/section_writing_agent.py", "section_writing_agent_prompt"),
    "refinement": prompt("methods/prompts/content_refinement_agent.py", "content_refinement_agent_system_prompt"),
    "relevance": lit["_RELEVANCE_PROMPT"],
    "reviewScores": {str(k): v for k, v in rev["SCORE_CALCULATION"].items()},
    "reviewInstructions": rev["AGENTREVIEW_INSTRUCTIONS"],
    "metaReviewer": rev["meta_reviewer_system_prompt"],
    # 下面几段是 f-string：{"t": 原文} 和 {"x": Python 表达式的源码}，po-core.js 的 render() 按表达式源码代入。
    "sop": SOPS,
    "sopSystem": system_instructions(sop_fn)[0],
    "queryGeneration": assigned(q_fn, q_src, "query_prompt")[0],
    "copilotScoped": edit_prompts[0],
    "copilotWhole": edit_prompts[1],
    "copilotSystem": system_instructions(edit_fn)[0],
    "polishAbstract": assigned(pol_fn, pol_src, "prompt")[0],
    "polishSystem": system_instructions(pol_fn)[0],
}

header = """/* 生成的文件，不要手改：python3 tools/paper/extract-prompts.py
   提示词原样取自 PaperOrchestra Studio（github.com/FelixJiashengFu/paper-orchestra-studio，paper-orchestra/ 目录），
   它 fork 自 Google Research 的 PaperOrchestra（github.com/google-research/paper-orchestra）。
   Copyright 2026 Google LLC，以及 PaperOrchestra Studio 的作者；Apache License 2.0（全文在 public/paper/LICENSE-Apache-2.0.txt）。
   部分写作规则改编自 Nature-Paper-Skills（MIT / Apache-2.0）和 Best-Paper-Writing-Skill（CC BY 4.0），出处见 THIRD-PARTY-paper-orchestra.md。
   Python 的 .format 占位符（{cutoff_date}、{{ }}）原样保留，由 po-core.js 的 fill() 替换。 */
"""
text = header + "(function (root) {\n  const PROMPTS = " + json.dumps(P, ensure_ascii=False, indent=1) + ";\n" \
    "  if (typeof module === 'object' && module.exports) module.exports = PROMPTS;\n" \
    "  else root.MOLASTRIA_PAPER_PROMPTS = PROMPTS;\n})(typeof self !== 'undefined' ? self : this);\n"

if check:
    if not os.path.isfile(OUT) or open(OUT, encoding="utf-8").read() != text:
        raise SystemExit("public/paper/po-prompts.js 不是最新的（运行 python3 tools/paper/extract-prompts.py）")
    print("提示词是最新的")
else:
    with open(OUT, "w", encoding="utf-8") as f:
        f.write(text)
    print(f"写好了 {len(P)} 段提示词")
