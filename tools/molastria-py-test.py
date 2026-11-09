"""Tests for public/api/v1/molastria.py against a stand-in for the compute API on localhost.
    python3 tools/molastria-py-test.py
"""
import importlib.util
import io
import json
import os
import sys
import threading
import unittest
from contextlib import redirect_stderr, redirect_stdout
from http.server import BaseHTTPRequestHandler, ThreadingHTTPServer

HERE = os.path.dirname(os.path.abspath(__file__))
spec = importlib.util.spec_from_file_location("molastria", os.path.join(HERE, "..", "public", "api", "v1", "molastria.py"))
molastria = importlib.util.module_from_spec(spec)
spec.loader.exec_module(molastria)

KEY = "mola_" + "k" * 43
seen = []      # (method, path, user agent, authorization, body)
polls = {}     # job id -> how many times it was asked for
USAGE = {"used": 1, "limit": 100, "remaining": 99, "reset": 1900000000}


class Service(BaseHTTPRequestHandler):
    def log_message(self, *a):
        pass

    def answer(self, status, data, raw=None):
        body = raw if raw is not None else json.dumps(data).encode()
        self.send_response(status)
        self.send_header("Content-Type", "application/json")
        self.send_header("Content-Length", str(len(body)))
        self.end_headers()
        self.wfile.write(body)

    def handle_any(self, method):
        n = int(self.headers.get("Content-Length") or 0)
        body = json.loads(self.rfile.read(n)) if n else None
        seen.append((method, self.path, self.headers.get("User-Agent"), self.headers.get("Authorization"), body))
        fail = lambda status, code, en, zh: self.answer(status, {"error": {"code": code, "message": en, "message_zh": zh}})
        if (self.headers.get("User-Agent") or "").startswith("Python-urllib"):  # what the real firewall does
            return self.answer(403, None, b"<html>blocked</html>")
        if self.path == "/v1/status":
            return self.answer(200, {"online": True, "uptime": {"ratio": 0.5, "samples": 96, "days": []}})
        if self.path == "/data/journals.json":
            return self.answer(200, {"count": 1, "items": [{"id": "jctc"}]})
        if self.headers.get("Authorization") != "Bearer " + KEY:
            return fail(401, "unauthorized", "This API key is not valid or has been revoked", "这个 API key 无效或已撤销")
        if self.path == "/v1/me":
            return self.answer(200, {"tier": "free", "usage": USAGE, "key": {"prefix": KEY[:10]}})
        if self.path == "/v1/models":
            return self.answer(200, {"online": True, "models": [{"id": "uma-s-1p2p1"}], "costs": {"opt": 1}})
        if method == "POST" and self.path == "/v1/jobs":
            if body.get("smiles") == "cached":
                return self.answer(200, {"status": "done", "cached": True, "result": {"energy_ev": -1.0}, "cost": 1, "usage": USAGE})
            if body.get("model", "").startswith("mace"):
                return fail(403, "licence", "The MACE models are not offered through the API", "MACE 不通过 API 提供")
            if body.get("smiles") == "offline":
                return fail(503, "offline", "The site owner's GPU is offline right now, try again later", "站长的 GPU 现在离线")
            jid = "bad0bad0bad0bad0" if body.get("smiles") == "broken" else "0123456789abcdef"
            return self.answer(202, {"id": jid, "status": "queued", "position": 1, "cost": 1, "usage": USAGE})
        if method == "GET" and self.path.startswith("/v1/jobs/"):
            jid = self.path.rsplit("/", 1)[1]
            polls[jid] = polls.get(jid, 0) + 1
            if jid == "bad0bad0bad0bad0":
                return self.answer(200, {"id": jid, "status": "error", "error": "could not build a 3D structure"})
            if jid == "ffffffffffffffff":
                return self.answer(200, {"id": jid, "status": "running"})
            if polls[jid] < 3:
                return self.answer(200, {"id": jid, "status": "running" if polls[jid] == 2 else "queued"})
            return self.answer(200, {"id": jid, "status": "done", "result": {"energy_ev": -4215.5, "converged": True}})
        fail(404, "not_found", "No such endpoint", "没有这个接口")

    def do_GET(self):
        self.handle_any("GET")

    def do_POST(self):
        self.handle_any("POST")


server = ThreadingHTTPServer(("127.0.0.1", 0), Service)
threading.Thread(target=server.serve_forever, daemon=True).start()
BASE = "http://127.0.0.1:%d" % server.server_port
API = BASE + "/v1"


class Client(unittest.TestCase):
    def setUp(self):
        seen.clear()
        polls.clear()
        self.mol = molastria.Compute(KEY, base=API)

    def test_run_submits_waits_and_returns_the_result(self):
        result = self.mol.run(smiles="CCO", job="opt", poll=0.01)
        self.assertEqual(result, {"energy_ev": -4215.5, "converged": True})
        self.assertEqual(seen[0][:2], ("POST", "/v1/jobs"))
        self.assertEqual(seen[0][4], {"job": "opt", "model": "uma-s-1p2p1", "smiles": "CCO"}, "only the fields that were given")
        self.assertEqual([s[1] for s in seen[1:]], ["/v1/jobs/0123456789abcdef"] * 3, "polled until done")
        self.assertEqual(self.mol.usage["remaining"], 99)

    def test_every_request_names_the_client_and_carries_the_key(self):
        self.mol.me(); self.mol.models(); self.mol.submit(smiles="CCO"); self.mol.get("0123456789abcdef")
        for _, _, agent, auth, _ in seen:
            self.assertTrue(agent.startswith("molastria-python/"), "urllib's own User-Agent is refused by the firewall")
            self.assertEqual(auth, "Bearer " + KEY)
        # ...and the stand-in does refuse urllib's default, the way the real service does.
        with self.assertRaises(molastria.MolAstriaError) as e:
            molastria._request(API + "/status", user_agent="Python-urllib/3.12")
        self.assertEqual((e.exception.status, e.exception.code), (403, "error"))
        self.assertIn("HTTP 403", str(e.exception), "an answer that is not the service's JSON still gives a clear error")

    def test_optional_fields_and_step_by_step(self):
        job = self.mol.submit(xyz="3\n\nO 0 0 0\nH 0 0 1\nH 1 0 0\n", job="ipea", charge=1, spin=2, params={"mode": "vertical"})
        self.assertEqual(seen[0][4], {"job": "ipea", "model": "uma-s-1p2p1", "xyz": "3\n\nO 0 0 0\nH 0 0 1\nH 1 0 0\n", "charge": 1, "spin": 2, "params": {"mode": "vertical"}})
        steps = []
        done = self.mol.wait(job, poll=0.01, progress=lambda j: steps.append(j["status"]))
        self.assertEqual((done["status"], steps), ("done", ["queued", "running", "done"]))

    def test_a_cached_result_needs_no_polling(self):
        self.assertEqual(self.mol.run(smiles="cached"), {"energy_ev": -1.0})
        self.assertEqual(len(seen), 1)

    def test_refusals_carry_the_code_and_both_languages(self):
        for smiles, model, code, status in (("offline", "uma-s-1p2p1", "offline", 503), ("CCO", "mace-off23-small", "licence", 403)):
            with self.assertRaises(molastria.MolAstriaError) as e:
                self.mol.submit(smiles=smiles, model=model)
            self.assertEqual((e.exception.code, e.exception.status), (code, status))
            self.assertTrue(str(e.exception).isascii() and not e.exception.message_zh.isascii())
        with self.assertRaises(molastria.MolAstriaError) as e:
            molastria.Compute("mola_wrong", base=API).me()
        self.assertEqual(e.exception.code, "unauthorized")

    def test_a_failed_calculation_and_a_slow_one(self):
        with self.assertRaises(molastria.JobFailed) as e:
            self.mol.run(smiles="broken", poll=0.01)
        self.assertEqual((str(e.exception), e.exception.code, e.exception.job["id"]), ("could not build a 3D structure", "job_failed", "bad0bad0bad0bad0"))
        with self.assertRaises(molastria.MolAstriaError) as e:
            self.mol.wait({"id": "ffffffffffffffff", "status": "queued"}, poll=0.01, timeout=0.05)
        self.assertEqual(e.exception.code, "timeout")

    def test_no_key_and_no_network(self):
        old = os.environ.pop("MOLASTRIA_KEY", None)
        try:
            with self.assertRaises(molastria.MolAstriaError) as e:
                molastria.Compute(base=API)
            self.assertEqual(e.exception.code, "unauthorized")
            os.environ["MOLASTRIA_KEY"] = KEY
            self.assertEqual(molastria.Compute(base=API).me()["tier"], "free", "the key comes from the environment")
        finally:
            os.environ.pop("MOLASTRIA_KEY", None)
            if old:
                os.environ["MOLASTRIA_KEY"] = old
        with self.assertRaises(molastria.MolAstriaError) as e:
            molastria.Compute(KEY, base="http://127.0.0.1:9/v1", timeout=2).me()
        self.assertEqual(e.exception.code, "network")

    def test_status_and_open_data_need_no_key(self):
        self.assertEqual(molastria.status(base=API)["uptime"]["ratio"], 0.5)
        self.assertEqual(molastria.load("journals", base=BASE + "/data")["items"][0]["id"], "jctc")
        self.assertEqual([s[3] for s in seen], [None, None], "no key is sent where none is needed")
        with self.assertRaises(ValueError):
            molastria.load("passwords")

    def test_the_command_line(self):
        out, err = io.StringIO(), io.StringIO()
        old_api, molastria.API = molastria.API, API
        os.environ["MOLASTRIA_KEY"] = KEY
        try:
            # Defaults are bound when the functions are defined, so the command line is pointed at the stand-in here.
            molastria.Compute.__init__.__defaults__ = (None, API, 30)
            molastria.status.__defaults__ = (API,)
            with redirect_stdout(out), redirect_stderr(err):
                self.assertEqual(molastria._main(["run", "CCO", "--job", "opt", "--params", '{"fmax": 0.02}']), 0)
                self.assertEqual(molastria._main(["status"]), 0)
                self.assertEqual(molastria._main(["run", "CCO", "--model", "mace-off23-small"]), 1)
        finally:
            molastria.Compute.__init__.__defaults__ = (None, old_api, 30)
            molastria.status.__defaults__ = (old_api,)
            molastria.API = old_api
            os.environ.pop("MOLASTRIA_KEY", None)
        self.assertIn('"energy_ev": -4215.5', out.getvalue())
        self.assertIn('"online": true', out.getvalue())
        self.assertEqual(err.getvalue().strip(), "licence: The MACE models are not offered through the API")
        self.assertEqual(seen[0][4]["params"], {"fmax": 0.02})

    def test_the_documentation_matches(self):
        self.assertEqual(molastria.API, "https://api.molastria.com/v1")
        self.assertEqual(molastria.DATA, "https://molastria.com/api/v1")
        self.assertIn("RTX 2080", molastria.__doc__)
        self.assertIn("may be offline", molastria.__doc__)


if __name__ == "__main__":
    unittest.main(verbosity=1)
