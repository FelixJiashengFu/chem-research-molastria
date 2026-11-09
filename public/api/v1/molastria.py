"""MolAstria for Python: one file, no dependencies (Python 3.8+).

    curl -O https://molastria.com/api/v1/molastria.py

Calculations with machine-learned potentials (needs a free API key from https://molastria.com/pro/account.html):

    import molastria
    mol = molastria.Compute()                      # the key comes from the environment variable MOLASTRIA_KEY
    result = mol.run(smiles="CCO", job="opt")      # submit, wait, return the result
    print(result["energy_ev"])

    job = mol.submit(smiles="CCO", job="freq", model="uma-s-1p2p1")   # or step by step
    job = mol.wait(job)                            # polls until it is done; raises JobFailed if the calculation fails
    mol.me(); mol.models(); molastria.status()     # what is left today; models and costs; is the GPU on (no key)

Open data (no key): molastria.load("journals") returns a dataset exactly as served.

From a shell:  python molastria.py run CCO --job opt     python molastria.py status     python molastria.py models

The compute is the RTX 2080 in the site owner's computer: best effort, and it may be offline. Do not build anything with a
deadline on it. Documentation: https://molastria.com/api/#compute    Data: CC BY 4.0.    This file: MIT.
"""

import json
import os
import sys
import time
import urllib.error
import urllib.request

__version__ = "1.0.0"
__all__ = ["Compute", "MolAstriaError", "JobFailed", "load", "status", "DATASETS"]

API = "https://api.molastria.com/v1"
DATA = "https://molastria.com/api/v1"
DATASETS = ("resources", "journals", "scimodels", "videos", "terms", "index")
# The service's firewall refuses urllib's default User-Agent (403), so every request names this client.
USER_AGENT = "molastria-python/" + __version__


class MolAstriaError(Exception):
    """The service refused a request. `code` is for programs: unauthorized, quota_exceeded, job_in_progress, offline,
    api_busy, licence, invalid_request, not_found, too_many_requests, region, unavailable, network."""

    def __init__(self, message, code="error", status=0, message_zh=""):
        super().__init__(message)
        self.code, self.status, self.message_zh = code, status, message_zh or message


class JobFailed(MolAstriaError):
    """The job was accepted and the calculation itself failed (for example the structure could not be built)."""

    def __init__(self, job):
        super().__init__(str(job.get("error") or "the calculation failed"), code="job_failed")
        self.job = job


def _request(url, key=None, body=None, timeout=30, user_agent=USER_AGENT):
    headers = {"User-Agent": user_agent, "Accept": "application/json"}
    if key:
        headers["Authorization"] = "Bearer " + key
    if body is not None:
        headers["Content-Type"] = "application/json"
    req = urllib.request.Request(url, data=None if body is None else json.dumps(body).encode(), headers=headers)
    try:
        with urllib.request.urlopen(req, timeout=timeout) as res:
            return json.load(res)
    except urllib.error.HTTPError as e:
        try:
            err = json.load(e).get("error") or {}
        except ValueError:  # not our JSON: a proxy or firewall answered
            err = {}
        if not isinstance(err, dict):
            err = {"message": str(err)}
        raise MolAstriaError(err.get("message") or "HTTP %d from %s" % (e.code, url), err.get("code") or "error",
                             e.code, err.get("message_zh") or "") from None
    except (urllib.error.URLError, TimeoutError, ValueError) as e:
        raise MolAstriaError("could not reach %s: %s" % (url, getattr(e, "reason", e)), "network") from None


def load(name, base=DATA):
    """A dataset of the open data API exactly as served: resources, journals, scimodels, videos, terms or index."""
    if name not in DATASETS:
        raise ValueError("no dataset %r (have %s)" % (name, ", ".join(DATASETS)))
    return _request("%s/%s.json" % (base.rstrip("/"), name))


def status(base=API):
    """Whether the GPU answered the last probe, and how often it was online over the last 7 days. Needs no key."""
    return _request(base.rstrip("/") + "/status")


class Compute:
    """The compute API. One job at a time per account; uses come from the account's daily allowance."""

    def __init__(self, key=None, base=API, timeout=30):
        self.key = key or os.environ.get("MOLASTRIA_KEY") or ""
        if not self.key:
            raise MolAstriaError("no API key: pass key=... or set MOLASTRIA_KEY (make one at "
                                 "https://molastria.com/pro/account.html)", "unauthorized")
        self.base, self.timeout = base.rstrip("/"), timeout
        self.usage = None  # {"used", "limit", "remaining", "reset"} after the first submit() or me()

    def _call(self, path, body=None):
        return _request(self.base + path, self.key, body, self.timeout)

    def me(self):
        """The key's tier and today's uses: {"tier", "usage": {"used", "limit", "remaining", "reset"}, "key"}."""
        out = self._call("/me")
        self.usage = out.get("usage")
        return out

    def models(self):
        """The models, what each can calculate, what each calculation costs, and whether the GPU is online."""
        return self._call("/models")

    def submit(self, smiles=None, job="opt", model="uma-s-1p2p1", xyz=None, charge=None, spin=None, params=None):
        """Queue a calculation and return at once: {"id", "status", "position", "cost", "usage"}. A result the service
        has already computed comes back finished ({"status": "done", "cached": True, "result": ...})."""
        body = {"job": job, "model": model}
        for name, value in (("smiles", smiles), ("xyz", xyz), ("charge", charge), ("spin", spin), ("params", params)):
            if value is not None:
                body[name] = value
        out = self._call("/jobs", body)
        self.usage = out.get("usage") or self.usage
        return out

    def get(self, job):
        """The current state of a job (the dict from submit(), or its id)."""
        return self._call("/jobs/" + (job["id"] if isinstance(job, dict) else str(job)))

    def wait(self, job, poll=3.0, timeout=900.0, progress=None):
        """Poll until the job is done and return it. Raises JobFailed if the calculation fails and MolAstriaError
        (code "timeout") after `timeout` seconds; the job keeps running and get() can still fetch it for an hour.
        `progress`, if given, is called with the job after every poll."""
        deadline = time.monotonic() + timeout
        while job.get("status") in ("queued", "running"):
            if time.monotonic() > deadline:
                raise MolAstriaError("job %s is still %s after %g s" % (job.get("id"), job["status"], timeout), "timeout")
            time.sleep(poll)
            job = self.get(job)
            if progress:
                progress(job)
        if job.get("status") != "done":
            raise JobFailed(job)
        return job

    def run(self, smiles=None, job="opt", model="uma-s-1p2p1", poll=3.0, timeout=900.0, **fields):
        """submit() and wait() in one call; returns the result itself."""
        return self.wait(self.submit(smiles=smiles, job=job, model=model, **fields), poll=poll, timeout=timeout)["result"]


def _main(argv):
    import argparse

    ap = argparse.ArgumentParser(prog="molastria.py", description="MolAstria compute API from a shell. The key is read "
                                 "from MOLASTRIA_KEY. Best effort: one home GPU, it may be offline.")
    sub = ap.add_subparsers(dest="cmd", required=True)
    run = sub.add_parser("run", help="run one calculation and print the result as JSON")
    run.add_argument("smiles")
    run.add_argument("--job", default="opt")
    run.add_argument("--model", default="uma-s-1p2p1")
    run.add_argument("--charge", type=int)
    run.add_argument("--spin", type=int)
    run.add_argument("--params", type=json.loads, help='JSON, e.g. \'{"fmax": 0.02}\'')
    for name, text in (("status", "is the GPU on, and how often it was over 7 days (no key)"), ("models", "models, jobs "
                       "and costs"), ("me", "what is left today")):
        sub.add_parser(name, help=text)
    args = ap.parse_args(argv)
    try:
        if args.cmd == "status":
            out = status()
        elif args.cmd == "run":
            out = Compute().run(args.smiles, job=args.job, model=args.model, charge=args.charge, spin=args.spin,
                                params=args.params)
        else:
            out = getattr(Compute(), args.cmd)()
    except MolAstriaError as e:
        print("%s: %s" % (e.code, e), file=sys.stderr)
        return 1
    print(json.dumps(out, indent=2, ensure_ascii=False))
    return 0


if __name__ == "__main__":
    sys.exit(_main(sys.argv[1:]))
