# -*- coding: utf-8 -*-
"""Offline tests for the crawler's parsers and the stale-source fallback. No network.
Run: python -m unittest discover -s maintenance -p "test_*.py"
"""
import json
import unittest
import xml.etree.ElementTree as ET

import crawler as c


RSS = """<?xml version="1.0" encoding="UTF-8"?>
<rss version="2.0" xmlns:dc="http://purl.org/dc/elements/1.1/"><channel><title>Blog</title>
<item><title>Schr&#246;dinger &amp; DFT: &lt;i&gt;ab initio&lt;/i&gt; π-stacking</title>
  <link>https://blog.example.org/a</link><pubDate>Tue, 03 Nov 2026 10:00:00 +0000</pubDate>
  <author>noreply@blogger.com (Jan Jensen)</author>
  <description><![CDATA[<p>We compare <b>CCSD(T)</b> &hellip; with 中文 text</p>]]></description></item>
<item><title>Same post again</title><link>https://blog.example.org/a</link></item>
<item><title>No link</title></item>
<item><title>Postdoc position in electronic structure</title><link>https://blog.example.org/b</link>
  <dc:creator>Ann Smith</dc:creator><pubDate>not a date</pubDate></item>
</channel></rss>"""

ATOM = """<?xml version="1.0" encoding="utf-8"?><feed xmlns="http://www.w3.org/2005/Atom">
<entry><title>Let the Agents Do the Benchmarking</title><link rel="alternate" href="https://pw.example.io/p1"/>
<published>2026-10-01T08:00:00+00:00</published><author><name>Pat Walters</name></author>
<summary>Docking and QSAR benchmarks</summary></entry></feed>"""


class Text(unittest.TestCase):
    def test_plain_unescapes_entities_and_strips_tags(self):
        self.assertEqual(c.clean(c.plain("What&#39;s the &quot;best&quot; <i>functional</i>&hellip;")), "What's the \"best\" functional …")
        self.assertEqual(c.clean(c.plain("Schr&ouml;dinger&#8217;s π")), "Schrödinger’s π")
        self.assertEqual(c.clean(c.plain("two-dimensional&amp;#xD;convection and a &amp;lt; b")), "two-dimensional convection and a &lt; b")

    def test_english_topics(self):
        self.assertIn("Gaussian", c.tags_en("ONIOM NMR Gaussian 16 error"))
        self.assertIn("安装与报错", c.tags_en("ONIOM NMR Gaussian 16 error"))
        self.assertNotIn("Gaussian", c.tags_en("Gaussian process regression of potential energy surfaces"))
        self.assertEqual(c.tags_en("GROMACS NPT equilibration")[0], "分子动力学")
        self.assertEqual(c.tags_en("Lunch menu"), [])
        it = c.item("x", "qa", "Hello world thread", "https://e.org/1")
        self.assertEqual(it["tags"], ["论坛问答"])  # no topic -> the type's default tag
        zh = c.item("x", "qa", "Gaussian 计算激发态", "https://e.org/2")
        self.assertEqual(zh["tags"], c.tags_for("Gaussian 计算激发态"))  # Chinese titles keep the old rules

    def test_event_type(self):
        self.assertEqual(c.event_type("PhD position in DFT"), "job")
        self.assertEqual(c.event_type("Summer School on Molecular Simulation"), "conference")
        self.assertEqual(c.event_type("Meet our new fellow"), "announcement")


class Feeds(unittest.TestCase):
    def test_rss(self):
        items = c.parse_feed(RSS, "cch", "CCH", "tutorial")
        self.assertEqual([i["url"] for i in items], ["https://blog.example.org/a", "https://blog.example.org/a", "https://blog.example.org/b"])
        a = items[0]
        self.assertEqual(a["title"], "Schrödinger & DFT: ab initio π-stacking")
        self.assertEqual(a["date"], "2026-11-03")
        self.assertEqual(a["authors"], "Jan Jensen")
        self.assertEqual(a["excerpt"], "We compare CCSD(T) … with 中文 text")
        self.assertEqual(a["category"], "CCH")
        self.assertIn("量子化学", a["tags"])
        self.assertEqual(items[2]["date"], "")  # unreadable date is left empty
        self.assertEqual(c.parse_feed(RSS, "molssi", "MolSSI", c.event_type)[2]["type"], "job")

    def test_skip_pattern(self):
        real = c.fetch
        try:
            c.fetch = lambda url, key, delay=0, timeout=0: (RSS, "ok")
            items, st = c.crawl_feeds("mmb", [("https://e.org/feed", "MMB", "tutorial", 10, 1, r"^Postdoc")])
            self.assertEqual((st, [i["url"] for i in items]), ("ok", ["https://blog.example.org/a"]))
        finally:
            c.fetch = real

    def test_duplicates_dropped_once(self):
        out, seen = [], set()
        c._add_new(out, c.parse_feed(RSS, "cch", "CCH"), seen)
        c._add_new(out, c.parse_feed(RSS, "cch", "CCH"), seen)
        self.assertEqual(len(out), 2)

    def test_atom_and_bad_xml(self):
        a = c.parse_feed(ATOM, "cheminf", "Practical Cheminformatics")[0]
        self.assertEqual((a["url"], a["date"], a["authors"]), ("https://pw.example.io/p1", "2026-10-01", "Pat Walters"))
        self.assertIn("化学信息与建模", a["tags"])
        self.assertEqual(c.parse_feed("<rss><channel></channel></rss>", "x", "x"), [])
        with self.assertRaises(ET.ParseError):
            c.parse_feed("<html>not a feed", "x", "x")

    def test_failed_feed_is_an_error_not_a_crash(self):
        real = c.fetch
        try:
            c.fetch = lambda url, key, delay=0, timeout=0: (None, "error-503")
            self.assertEqual(c.crawl_feeds("cch", [("https://e.org/feed", "CCH", "tutorial", 10, 2)]), ([], "error"))
            c.fetch = lambda url, key, delay=0, timeout=0: ("<html>Just a page", "ok")
            self.assertEqual(c.crawl_feeds("cch", [("https://e.org/feed", "CCH", "tutorial", 10, 2)]), ([], "error"))
        finally:
            c.fetch = real


class Apis(unittest.TestCase):
    def test_discourse(self):
        data = {"users": [{"id": 7, "username": "ana"}], "topic_list": {"topics": [
            {"id": 1, "slug": "welcome", "title": "Welcome", "pinned": True},
            {"id": 2, "slug": "site", "title": "Site feedback thread", "category_id": 9},
            {"id": 3, "slug": "npt-crash", "title": "NPT run crashes &amp; dies", "category_id": 5, "created_at": "2026-11-01T00:00:00Z",
             "posts_count": 4, "views": 50, "tags": [{"name": "mdrun"}], "posters": [{"user_id": 7, "description": "Original Poster, Most Recent Poster"}]},
            {"id": 4, "slug": "topic", "title": "How to cite the program?", "category_id": 1, "posts_count": 1, "tags": None}]}}
        items = c.parse_discourse(data, "https://forum.example.org", {5: "User discussions", 9: "Site feedback", 1: "Uncategorized"}, "f", "分子动力学")
        self.assertEqual([i["url"] for i in items], ["https://forum.example.org/t/npt-crash/3", "https://forum.example.org/t/topic/4"])
        t = items[0]
        self.assertEqual((t["title"], t["authors"], t["date"], t["category"], t["metric"]),
                         ("NPT run crashes & dies", "ana", "2026-11-01", "User discussions · mdrun", "💬 3 · 👁 50"))
        self.assertIn("分子动力学", t["tags"])
        self.assertEqual(items[1]["tags"], ["分子动力学"])  # forum topic replaces the generic 论坛问答
        self.assertEqual(items[1]["category"], "")

    def test_stackexchange(self):
        data = {"items": [{"title": "Why is my &quot;SCF&quot; not converging?", "link": "https://mattermodeling.stackexchange.com/questions/1/x",
                           "creation_date": 1793836800, "score": 3, "answer_count": 1, "tags": ["dft", "vasp"],
                           "owner": {"display_name": "Jos&#233;"}, "body": "<p>I use <code>ISMEAR=0</code></p>"},
                          {"title": "no link"}]}
        items = c.parse_stackexchange(data, "mattermodeling")
        self.assertEqual(len(items), 1)
        q = items[0]
        self.assertEqual((q["title"], q["authors"], q["date"], q["metric"], q["category"]),
                         ('Why is my "SCF" not converging?', "José", "2026-11-05", "▲ 3 · 💬 1", "dft · vasp"))
        self.assertEqual(c.parse_stackexchange({}, "x"), [])

    def test_releases(self):
        data = [{"name": "", "tag_name": "v1.0rc", "prerelease": True, "html_url": "https://github.com/o/r/releases/tag/rc"},
                {"name": "Quantum ESPRESSO", "tag_name": "qe-7.5", "html_url": "https://github.com/o/r/releases/tag/qe-7.5",
                 "published_at": "2026-07-09T00:00:00Z", "body": "## Fixes\n* [bug fixes](https://x) in **pw.x**", "author": {"login": "dev"}},
                {"name": "2026_09_2 (Q3 2026) Release", "tag_name": "Release_2026_09_2", "html_url": "https://github.com/o/r/releases/tag/b",
                 "published_at": "2026-11-05T00:00:00Z", "body": ""}]
        qe = c.parse_releases(data, "Quantum ESPRESSO", "QEF/q-e")
        self.assertEqual([i["title"] for i in qe], ["Quantum ESPRESSO qe-7.5", "Quantum ESPRESSO 2026_09_2 (Q3 2026) Release"])
        self.assertEqual(qe[0]["excerpt"], "Fixes bug fixes in pw.x")
        self.assertNotIn("安装与报错", qe[0]["tags"])
        self.assertEqual(c.parse_releases({"message": "API rate limit exceeded"}, "x", "o/r"), [])


class Fallback(unittest.TestCase):
    def test_failed_source_keeps_last_snapshot(self):
        prev = {"sources": [{"id": "matsci", "fetchedAt": "2026-10-29T13:00:00+00:00"},
                            {"id": "chemrxiv", "name": "ChemRxiv", "status": "ok", "fetchedAt": "2026-10-29T13:05:00+00:00"}],
                "items": [{"source": "matsci", "url": "https://matsci.org/t/a/1", "title": "old"},
                          {"source": "chemrxiv", "url": "https://doi.org/10.26434/x", "title": "preprint"}]}
        fresh = {"arxiv": ([{"source": "arxiv", "url": "https://arxiv.org/abs/1", "title": "p"},
                            {"source": "arxiv", "url": "https://arxiv.org/abs/1", "title": "p again"}], "ok"),
                 "matsci": ([], "error-503")}
        sources, items = c.assemble(fresh, prev, "2026-11-05T13:00:00+00:00")
        by = {s["id"]: s for s in sources}
        self.assertEqual((by["matsci"]["status"], by["matsci"]["usedCache"], by["matsci"]["fetchedAt"], by["matsci"]["itemCount"]),
                         ("cache", True, "2026-10-29T13:00:00+00:00", 1))
        self.assertEqual(by["arxiv"]["itemCount"], 1)  # duplicate URL dropped
        ids = [s["id"] for s in sources]
        self.assertEqual(ids[ids.index("arxiv") + 1], "chemrxiv")  # carried forward for tools/hub-chemrxiv.ts
        self.assertEqual(by["chemrxiv"]["status"], "cache")
        self.assertEqual(by["psi4forum"]["itemCount"], 0)  # never fetched and no cache: check-catalogue refuses it
        self.assertEqual(sorted(i["url"] for i in items), ["https://arxiv.org/abs/1", "https://doi.org/10.26434/x", "https://matsci.org/t/a/1"])


if __name__ == "__main__":
    unittest.main()
