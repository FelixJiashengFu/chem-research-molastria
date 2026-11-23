"""Tests of the DBCata lane without DBCata, torch or a GPU: dbcata_core.py (domain, structures, sites, heuristics,
DMAE, energies, the result), the worker's JSON-lines protocol in toy mode, and dbcata_domain_check.py on structures
the lane builds itself. DBCata's own model is not run here; that is checked on the site owner's computer (RUNBOOK,
"DBCata 通道").

    python3 tools/uma-server/test_dbcata.py
"""
import json
import os
import subprocess
import sys
import types
import unittest

import numpy as np

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import dbcata_core as core  # noqa: E402
import dbcata_domain_check as dcheck  # noqa: E402

try:
    import ase  # noqa: F401
    from ase.data import covalent_radii, atomic_numbers, reference_states
    HAVE_ASE = True
except ImportError:
    HAVE_ASE = False


def params(**kw):
    raw = dict(metal_a="Pt", metal_b="Ni", ratio=0.75, facet="111", adsorbate="OH")
    raw.update(kw)
    if raw["facet"] == "110":  # the builder still knows fcc(110), for these tests; the lane refuses it
        return dict(core.check(dict(raw, facet="111")), facet="110")
    return core.check(raw)


class Domain(unittest.TestCase):
    def test_canonical(self):
        p = params()
        self.assertEqual(p, {"metal_a": "Ni", "metal_b": "Pt", "ratio": 0.25, "facet": "111", "adsorbate": "OH",
                             "polish": True, "steps": 20, "lattice": "uma"})
        same = core.check(dict(metal_a="ni", metal_b="PT", ratio=0.25, facet="(111)", adsorbate="oh"))
        self.assertEqual(core.key(p), core.key(same))
        self.assertEqual(core.key(p), "ads:Ni|Pt|0.25|111|OH|20|uma|1")
        self.assertEqual(core.cost(p), 5)
        self.assertEqual(core.cost(params(polish=False)), 3)
        self.assertEqual(core.formula("Ni", "Pt", 0.25), "NiPt3")
        self.assertEqual(core.formula("Au", "Cu", 0.5), "AuCu")

    def test_refusals(self):
        cases = [
            (dict(metal_b="Pt"), "two different metals"),
            (dict(metal_a="Tc"), "radioactive"),
            (dict(metal_a="Hg"), "liquid"),
            (dict(metal_a="Na"), "not a metal of DBCata's training domain"),
            (dict(metal_a="Xyzzy"), "not an element symbol"),
            (dict(metal_a=None), "metal symbol"),
            (dict(ratio=0.3), "0.25, 0.5 or 0.75"),
            (dict(ratio=True), "0.25, 0.5 or 0.75"),
            (dict(ratio="0.5"), "0.25, 0.5 or 0.75"),
            (dict(facet="100"), "must be 111"),
            (dict(adsorbate="CO"), "12 adsorbates"),
            (dict(adsorbate="OOH"), "12 adsorbates"),
            (dict(steps=30), "20, 50 or 100"),
            (dict(steps=True), "20, 50 or 100"),
            (dict(polish="yes"), "true or false"),
            (dict(lattice="dft"), "uma"),
        ]
        for kw, why in cases:
            with self.assertRaises(core.DomainError, msg=kw) as cm:
                params(**kw)
            self.assertIn(why, str(cm.exception), kw)
        with self.assertRaises(core.DomainError):
            core.check(["Pt"])
        with self.assertRaises(core.DomainError) as cm:  # the training set has no fcc(110) (dbcata_domain_check.py)
            core.check(dict(metal_a="Pt", metal_b="Ni", ratio=0.75, facet="110", adsorbate="O"))
        self.assertIn("no fcc(110)", str(cm.exception))
        self.assertEqual(core.FACETS, ("111",))

    def test_uma_preset(self):
        """fairchem 2.25 (uma-env) has "batch"; 2.13 (DBCata's venv) only default and turbo, whose default does not
        compile; with Triton the default everywhere."""
        self.assertEqual(core.uma_setting({"default", "turbo", "batch"}, False), "batch")
        self.assertEqual(core.uma_setting({"default", "turbo"}, False), "default")
        self.assertEqual(core.uma_setting(None, False), "batch")
        self.assertEqual(core.uma_setting({"default", "turbo"}, True), "default")

    def test_lists(self):
        self.assertEqual(len(core.METALS), 31)
        self.assertEqual(len(core.ADSORBATES), 12)
        self.assertEqual(set(core.ADSORBATES), set(core.ADSORBATE_ATOMS))
        self.assertEqual(set(core.METALS), set(core.A_FCC))
        for name, atoms in core.ADSORBATE_ATOMS.items():  # binding atom first, at the origin, the rest above it
            self.assertEqual(atoms[0][1], (0, 0, 0), name)
            self.assertTrue(all(p[2] > 0 for _, p in atoms[1:]), name)
            self.assertEqual(dcheck.adsorbate_name([s for s, _ in atoms]), name)

    @unittest.skipUnless(HAVE_ASE, "ASE not installed")
    def test_tables_against_ase(self):
        for s, r in core.COVALENT.items():
            self.assertAlmostEqual(r, float(covalent_radii[atomic_numbers[s]]), 2, s)
        for s in core.METALS:
            st = reference_states[atomic_numbers[s]]
            if st and st.get("symmetry") == "fcc":
                self.assertAlmostEqual(core.A_FCC[s], st["a"], 2, s)
        # bond geometry of the templates
        for name, atoms in core.ADSORBATE_ATOMS.items():
            for s, p in atoms[1:]:
                self.assertTrue(0.9 < np.linalg.norm(p) < 1.4, name)


class Structures(unittest.TestCase):
    def build(self, a, b, x, facet, ads="O"):
        p = params(metal_a=a, metal_b=b, ratio=x, facet=facet, adsorbate=ads)
        return core.build(p, core.vegard(p["metal_a"], p["metal_b"], p["ratio"]))

    def test_slabs_are_the_training_kind(self):
        """CatHub / Mamun: 12 slab atoms, 8 of them fixed, 3 layers, bimetallic."""
        for a, b, x, facet in (("Pt", "Ni", 0.75, "111"), ("Pt", "Ni", 0.75, "110"), ("Au", "Cu", 0.5, "111"),
                               ("Au", "Cu", 0.5, "110"), ("Ga", "Pd", 0.25, "111")):
            built = self.build(a, b, x, facet)
            for slab in built["slabs"]:
                self.assertEqual(len(slab["symbols"]), 12)
                self.assertEqual(sum(slab["fixed"]), 8)
                self.assertEqual(len({round(z, 2) for z in slab["positions"][:, 2]}), 3)
                self.assertEqual(sum(t == 1 for t in slab["tags"]), 4)
                self.assertAlmostEqual(slab["cell"][2, 2] - np.ptp(slab["positions"][:, 2]), 2 * core.VACUUM)
            for it in built["items"]:
                # The start is DBCata's kind of input, binding atom 1.5 A over the site point: on a top site that is
                # closer than 0.8 x the covalent radii (O-Ni 1.52 A), which DBCata then corrects. Nothing else.
                f = core.flags(it["atoms"], it["atoms"]["positions"])
                self.assertEqual(f, ["collision"] if f and it["site"]["kind"] == "top" else [], (a, b, facet, it["site"]))

    def test_terminations_and_sites(self):
        # NiPt3 (L1_2): (111) has one termination (every layer Ni1Pt3), (110) two (Ni2Pt2 and Pt4 on top)
        b = self.build("Pt", "Ni", 0.75, "111")
        self.assertEqual(len(b["slabs"]), 1)
        kinds = [s["site"]["kind"] for s in b["items"]]
        self.assertEqual(len(kinds), 9)
        self.assertEqual(kinds.count("top"), 2)
        self.assertEqual({k for k in kinds if k.startswith("hollow")}, {"hollow-fcc", "hollow-hcp"})
        mult = sum(it["site"]["multiplicity"] for it in b["items"])
        self.assertEqual(mult, 4 + 12 + 4 + 4)  # p(2x2): 4 tops, 12 bridges, 4 fcc and 4 hcp hollows
        b = self.build("Pt", "Ni", 0.75, "110")
        self.assertEqual(sorted(s["top"] for s in b["slabs"]), ["Ni2Pt2", "Pt4"])
        self.assertEqual(len(b["items"]), 16)
        b = self.build("Au", "Cu", 0.5, "110")
        self.assertEqual(sorted(s["top"] for s in b["slabs"]), ["Au4", "Cu4"])
        self.assertFalse(b["truncated"])

    def test_ideal_lattice_has_no_slab_flags(self):
        """NiTa sits below 0.8 x the covalent sum in the ideal lattice; AuPt has no pair within 1.0 x. Neither may make
        the clean, unmoved slab look collided, and a lifted top atom must still count as reconstructed."""
        for a, b, x in (("Ni", "Ta", 0.5), ("Au", "Pt", 0.5), ("Au", "Ag", 0.5), ("Pt", "Ni", 0.75), ("Y", "Al", 0.25)):
            for facet in ("111", "110"):
                built = self.build(a, b, x, facet)
                it = next(i for i in built["items"] if i["site"]["kind"] != "top")
                at = it["atoms"]
                self.assertNotIn("collision", core.flags(at, at["positions"]), (a, b, facet))
                self.assertNotIn("reconstructed", core.flags(at, at["positions"]), (a, b, facet))
                tags = np.array(at["tags"])
                pos = at["positions"].copy()
                pos[tags == 1] += (0, 0, 2.0)
                pos[tags == 2] += (0, 0, 2.0)
                self.assertIn("reconstructed", core.flags(at, pos), (a, b, facet))

    def test_hollows_kept_when_c_differs_from_a(self):
        """An L1_0 cell relaxed with c != a still has fcc and hcp hollows on (111)."""
        p = params(metal_a="Au", metal_b="Cu", ratio=0.5, facet="111", adsorbate="O")
        a = core.vegard(p["metal_a"], p["metal_b"], p["ratio"])
        kinds = {it["site"]["kind"] for it in core.build(p, a, 1.03 * a)["items"]}
        self.assertTrue({"hollow-fcc", "hollow-hcp"} <= kinds, kinds)
        p = params(metal_a="Au", metal_b="Cu", ratio=0.5, facet="110", adsorbate="O")  # not offered, still built
        kinds = {it["site"]["kind"] for it in core.build(p, a, 1.03 * a)["items"]}
        self.assertFalse({"hollow-fcc", "hollow-hcp"} & kinds, kinds)

    def test_site_height(self):
        b = self.build("Au", "Cu", 0.5, "111", "CH3")
        for it in b["items"]:
            at = it["atoms"]
            tags = np.array(at["tags"])
            z_top = at["positions"][tags == 1, 2].mean()
            self.assertAlmostEqual(at["positions"][tags == 2][0, 2] - z_top, core.HEIGHT)
            self.assertEqual(len(at["symbols"]), 16)


class Checks(unittest.TestCase):
    def setUp(self):
        p = params(adsorbate="OH")
        self.built = core.build(p, core.vegard(p["metal_a"], p["metal_b"], p["ratio"]))
        self.at = next(it["atoms"] for it in self.built["items"] if it["site"]["kind"] == "hollow-fcc")
        self.pos = self.at["positions"].copy()
        tags = np.array(self.at["tags"])
        self.o, self.h = np.nonzero(tags == 2)[0]
        self.top = np.nonzero(tags == 1)[0]

    def moved(self, i, dv):
        pos = self.pos.copy()
        pos[i] += dv
        return pos

    def test_good_structure_has_no_flags(self):
        pos = self.moved([self.o, self.h], (0, 0, -0.4))  # O about 1.1 A over the hollow, still no collision
        self.assertEqual(core.flags(self.at, pos), [])

    def test_collision(self):
        pos = self.pos.copy()
        pos[self.o] = pos[self.top[0]] + (0, 0, 0.9)
        pos[self.h] = pos[self.o] + (0, 0, 0.97)
        self.assertIn("collision", core.flags(self.at, pos))

    def test_dissociated(self):
        self.assertEqual(core.flags(self.at, self.moved(self.h, (2.0, 0, -1.0))), ["dissociated"])

    def test_desorbed(self):
        self.assertEqual(core.flags(self.at, self.moved([self.o, self.h], (0, 0, 4.0))), ["desorbed"])

    def test_reconstructed(self):
        pos = self.moved(self.top[0], (0, 0, 1.6))
        pos[[self.o, self.h]] += (0, 0, -0.3)
        self.assertIn("reconstructed", core.flags(self.at, pos))

    def test_dmae(self):
        cell = self.at["cell"]
        self.assertEqual(core.dmae(self.pos, self.pos, cell), 0.0)
        self.assertAlmostEqual(core.dmae(self.pos, self.pos + (1.3, -0.7, 2.0), cell), 0.0, 9)
        wrapped = self.pos.copy()
        wrapped[self.o] += cell[0]  # the same structure, one atom in the next cell
        self.assertAlmostEqual(core.dmae(self.pos, wrapped, cell), 0.0, 9)
        self.assertTrue(np.allclose(core.unwrap(wrapped, self.pos, cell), self.pos))
        # minimum image: two atoms near opposite faces of a 10 A cube are 1 A apart
        d = core.distances([[0.5, 5, 5], [9.5, 5, 5]], np.eye(3) * 10)
        self.assertAlmostEqual(d[0, 1], 1.0)
        n = len(self.pos)
        shift = self.moved(self.o, (0, 0, 0.1))
        changed = np.abs(core.distances(self.pos, cell) - core.distances(shift, cell)).sum()
        self.assertAlmostEqual(core.dmae(self.pos, shift, cell), changed / n ** 2)

    def test_reference(self):
        e = core.adsorption_energy(-100.0, -90.0, "OH")
        self.assertAlmostEqual(e, -100.0 + 90.0 + 7.204 + 3.477)
        self.assertAlmostEqual(core.adsorption_energy(-100.0, -90.0, "CH3"), -10.0 + 7.282 + 3 * 3.477)
        self.assertAlmostEqual(core.adsorption_energy(-100.0, -90.0, "H2O"), -10.0 + 7.204 + 2 * 3.477)
        self.assertIsNone(core.adsorption_energy(-100.0, -90.0, "S"))
        self.assertIsNone(core.adsorption_energy(-100.0, -90.0, "SH"))

    def test_extxyz(self):
        text = core.extxyz(self.at["symbols"], self.pos, self.at["cell"], frame="initial", energy=-1.5)
        lines = text.splitlines()
        self.assertEqual(int(lines[0]), len(self.pos))
        self.assertIn('Lattice="', lines[1])
        self.assertIn('frame="initial"', lines[1])
        if HAVE_ASE:
            import io

            from ase.io import read

            atoms = read(io.StringIO(text), format="extxyz")
            self.assertTrue(np.allclose(atoms.get_positions(), self.pos, atol=1e-5))
            self.assertTrue(np.allclose(atoms.cell[:], self.at["cell"], atol=1e-5))


class Run(unittest.TestCase):
    def test_toy_run(self):
        notes = []
        p = params(metal_a="Pt", metal_b="Ni", ratio=0.75, facet="111", adsorbate="OH")
        r = core.run(p, core.ToyEngine(), progress=notes.append)
        self.assertEqual(r["system"]["formula"], "NiPt3")
        self.assertEqual(r["lattice"]["method"], "uma-omat")
        self.assertEqual(len(r["sites"]), 9)
        self.assertEqual(len(r["slabs"]), 1)
        self.assertTrue(r["reference"]["available"])
        self.assertEqual(r["reference"]["refs_ev"], {"H": -3.477, "O": -7.204})
        self.assertIn(r["best"], [s["id"] for s in r["sites"]])
        best = r["sites"][r["best"]]
        self.assertEqual(best["rel_ev"], 0.0)
        self.assertTrue(all(s["rel_ev"] >= 0 for s in r["sites"] if s["ok"]))
        for s in r["sites"]:
            self.assertEqual(s["xyz"].count("Lattice="), 3)  # initial, DBCata, DBCata + UMA
            self.assertIsNotNone(s["e_ads_ev"])
            self.assertAlmostEqual(s["e_ads_ev"], s["e_bind_raw_ev"] + 7.204 + 3.477, 3)
        self.assertEqual(notes[-1]["note"], "done")
        self.assertLess(len(json.dumps(r)), 60000)
        # the toy lifts every adsorbate straight up: each one lands where it started, and no two sites coincide
        for s in r["sites"]:
            self.assertEqual((s["landing"]["kind"], s["landing"]["atoms"]), (s["kind"], s["atoms"]), s["id"])
            self.assertIsNone(s["same_as"])
        self.assertEqual(r["distinct"], 9)

    def test_sites_that_end_at_one_place(self):
        """DBCata moved O from several starting sites to one hollow on the site owner's Pt3Ni(111) trial; the result
        must say which sites coincide and where each one ended, not only where it started."""
        class Funnel(core.ToyEngine):
            def generate(self, structures, steps):
                out = super().generate(structures, steps)
                for i in (1, 2, 3):  # sites 1-3 (bridges) all end where site 4 (a hollow) ends
                    out[i] = out[4].copy()
                return out

        r = core.run(params(adsorbate="O", polish=False), Funnel())
        sites = r["sites"]
        for i in (1, 2, 3):
            self.assertEqual(sites[i]["same_as"], 1 if i > 1 else None, i)
            self.assertEqual(sites[i]["landing"], sites[4]["landing"])
        self.assertEqual(sites[4]["same_as"], 1)
        self.assertEqual(r["distinct"], 9 - 3)
        self.assertNotEqual(sites[1]["landing"]["kind"], sites[1]["kind"])
        box = np.eye(3) * 10

        def it(t, xyz, e, kind="hollow-fcc", atoms="Pt-Pt-Pt", ok=True):
            return {"termination": t, "position": np.array(xyz, float), "energy": e, "cell": box,
                    "landing": {"kind": kind, "atoms": atoms}, "ok": ok}
        self.assertEqual(core.same_place([it(0, (0, 0, 0), 0.0, "top"), it(0, (9.95, 0, 0), 0.005, "bridge"),
                                          it(1, (0, 0, 0), 0.0), it(0, (0, 0, 0), 0.5)]),
                         [None, 0, None, None], "minimum image, same termination, same energy")
        self.assertEqual(core.same_place([it(0, (1, 1, 0), 0.0), it(0, (6, 3, 0), 0.004), it(0, (6, 3, 0), 0.004, "hollow-hcp")]),
                         [None, 0, None], "equivalent copies of one hollow, several A apart, are one place")
        self.assertEqual(core.same_place([it(0, (1, 1, 0), 0.0, "none", ""), it(0, (6, 3, 0), 0.0, "none", "")]),
                         [None, None], "two desorbed molecules far apart are not one place")
        self.assertEqual(core.same_place([it(0, (0, 0, 0), 0.0, ok=False), it(0, (0, 0, 0), 0.0), it(0, (0, 0, 0), 0.0)]),
                         [1, None, 1], "the first reliable site leads, not a flagged one")
        self.assertEqual(core.same_place([it(0, (0, 0, 0), 0.0, ok=False), it(0, (0, 0, 0), 0.0, ok=False)]), [None, 0])

    def test_landing_is_by_position_in_the_plane(self):
        """Low adsorbates, off-centre ones and unequal bonds (short M-O to an early metal, long Pt-O) stay in their
        hollow; an equivalent copy of a site lands as that site; a molecule far above the surface touches nothing."""
        for a, b, x in (("Pt", "Ni", 0.75), ("Pt", "Y", 0.75), ("Pt", "Sc", 0.75), ("Pt", "Zr", 0.75), ("Au", "Ti", 0.75)):
            built = Structures.build(self, a, b, x, "111")
            for item in built["items"]:
                at, site = item["atoms"], item["site"]
                pos = np.array(at["positions"], float)
                k = next(i for i, t in enumerate(at["tags"]) if t == 2)
                z_top = float(np.mean([pos[i, 2] for i, t in enumerate(at["tags"]) if t == 1]))
                shift = pos[k].copy()
                for h, off in ((0.9, (0.2, 0.0)), (1.2, (0.0, -0.25)), (2.0, (0.15, 0.15))):
                    moved = pos.copy()
                    moved[at["tags"].index(2):] += np.array([site["xy"][0] + off[0], site["xy"][1] + off[1], z_top + h]) - shift
                    got = core.landing(at, moved)
                    if site["kind"].startswith("hollow"):
                        self.assertEqual((got["kind"], got["atoms"]), (site["kind"], site["atoms"]), (a, b, site, h, off))
                    elif off == (0.15, 0.15) or site["kind"] == "top":
                        self.assertEqual(got["kind"], site["kind"], (a, b, site, h, off))
                far = pos.copy()
                far[at["tags"].index(2):] += np.array([0, 0, 6.0])
                self.assertEqual(core.landing(at, far), {"kind": "none", "atoms": ""})
        # every copy of a site with multiplicity > 1 lands as that site
        at0 = Structures.build(self, "Pt", "Ni", 0.75, "111")["items"][0]["atoms"]
        n = at0["tags"].index(2)
        slab = {"positions": np.array(at0["positions"], float)[:n], "symbols": at0["symbols"][:n], "tags": at0["tags"][:n], "cell": np.asarray(at0["cell"], float)}
        z_top = float(np.mean([slab["positions"][i, 2] for i, t in enumerate(slab["tags"]) if t == 1]))
        copies = 0
        for kind, xy, els in core._candidates(slab["positions"], slab["symbols"], slab["tags"], slab["cell"]):
            pos = np.vstack([slab["positions"], [xy[0], xy[1], z_top + 1.1]])
            got = core.landing(dict(at0, symbols=slab["symbols"] + ["O"], tags=slab["tags"] + [2]), pos)
            self.assertEqual((got["kind"], got["atoms"]), (kind, "-".join(els)))
            copies += 1
        self.assertEqual(copies, sum(s["multiplicity"] for s in core.sites(slab)))

    def test_without_polish_and_with_sulfur(self):
        r = core.run(params(adsorbate="SH", polish=False, lattice="vegard"), core.ToyEngine())
        self.assertEqual(r["lattice"]["method"], "vegard")
        self.assertFalse(r["reference"]["available"])
        for s in r["sites"]:
            self.assertEqual(s["xyz"].count("Lattice="), 2)
            self.assertIsNone(s["e_ads_ev"])
            self.assertIsNotNone(s["e_bind_raw_ev"])
            self.assertNotIn("flags_polished", s)

    def test_lattice_drift_falls_back(self):
        class Drifting(core.ToyEngine):
            def lattice(self, blk):
                return float(blk["cell"][0, 0]) * 1.2, None

        class Broken(core.ToyEngine):
            def lattice(self, blk):
                raise RuntimeError("no")

        for engine, why in ((Drifting(), "moved more than"), (Broken(), "failed")):
            r = core.run(params(), engine)
            self.assertEqual(r["lattice"]["method"], "vegard")
            self.assertIn(why, r["lattice"]["note"])

    def test_flagged_sites_are_not_best(self):
        class Desorbing(core.ToyEngine):
            def generate(self, structures, steps):
                out = super().generate(structures, steps)
                out[0][np.array(structures[0]["tags"]) == 2, 2] += 6.0  # site 0 flies off
                return out

        r = core.run(params(polish=False), Desorbing())
        self.assertEqual(r["sites"][0]["flags"], ["desorbed"])
        self.assertFalse(r["sites"][0]["ok"])
        self.assertNotEqual(r["best"], 0)
        self.assertTrue(r["best_ok"])

    def test_time_limit(self):
        with self.assertRaises(TimeoutError):
            core.run(params(), core.ToyEngine(), limit=1e-9)


class Worker(unittest.TestCase):
    def talk(self, lines, toy=True, extra_env=None):
        env = dict(os.environ, PYTHONUTF8="1")
        env.pop("MOLASTRIA_DBCATA_TOY", None)
        if toy:
            env["MOLASTRIA_DBCATA_TOY"] = "1"
        env.update(extra_env or {})
        out = subprocess.run([sys.executable, "-X", "utf8", os.path.join(HERE, "dbcata_worker.py")],
                             input="".join(json.dumps(x) + "\n" for x in lines), capture_output=True, text=True,
                             encoding="utf-8", env=env, timeout=300)
        return [json.loads(x) for x in out.stdout.splitlines() if x.strip()]

    def test_protocol(self):
        replies = self.talk([{"op": "ping"},
                             {"op": "run", "params": {"metal_a": "Cu", "metal_b": "Au", "ratio": 0.5, "facet": "111",
                                                      "adsorbate": "CH3", "polish": False}},
                             {"op": "run", "params": {"metal_a": "Cu", "metal_b": "Cu"}},
                             {"op": "nope"}])
        self.assertEqual(replies[0], {"ok": True, "engine": core.ToyEngine().info()})
        progress = [r["progress"] for r in replies if "progress" in r]
        self.assertEqual(progress[-1]["note"], "done")
        final = [r for r in replies if "progress" not in r]
        self.assertEqual(len(final), 4)
        result = final[1]["result"]
        self.assertEqual(result["system"]["formula"], "AuCu")
        self.assertEqual(sorted(s["top"] for s in result["slabs"]), ["Au2Cu2"])
        self.assertIn("seconds_worker", result)
        self.assertFalse(final[2]["ok"])
        self.assertIn("two different metals", final[2]["error"])
        self.assertFalse(final[3]["ok"])

    def test_not_configured(self):
        """Without DBCata (here: no torch, or no checkout) every request gets an error line; nothing crashes."""
        replies = self.talk([{"op": "ping"}, {"op": "ping"}], toy=False,
                            extra_env={"MOLASTRIA_DBCATA_DIR": os.path.join(HERE, "no-such-dbcata")})
        self.assertEqual(len(replies), 2)
        self.assertTrue(all(not r["ok"] for r in replies))
        self.assertTrue(any(w in replies[0]["error"] for w in ("No module named", "no DBCata checkout")), replies[0])

    def test_license_header(self):
        with open(os.path.join(HERE, "dbcata_worker.py"), encoding="utf-8") as f:
            self.assertEqual(f.readline().strip(), "# SPDX-License-Identifier: GPL-3.0-or-later")
        for name in ("dbcata_core.py", "server.py", "dbcata_domain_check.py"):  # MIT, and none of them imports DBCata
            with open(os.path.join(HERE, name), encoding="utf-8") as f:
                text = f.read()
            self.assertNotIn("GPL-3.0-or-later", text.splitlines()[0])
            for mod in ("trainer.", "from model", "import model", "pl_module"):
                self.assertNotIn(mod, text.replace("dbcata_worker", ""), name)
        self.assertTrue(os.path.exists(os.path.join(HERE, "THIRD-PARTY-DBCata.md")))


class DomainCheck(unittest.TestCase):
    """dbcata_domain_check.py reads DBCata's data; on the lane's own structures it must find the lane's domain."""

    def test_own_structures(self):
        rows = []
        for a, b, x, facet, ads in (("Pt", "Ni", 0.75, "111", "OH"), ("Au", "Cu", 0.5, "110", "H2O"),
                                    ("Ga", "Pd", 0.25, "111", "CH2")):
            p = params(metal_a=a, metal_b=b, ratio=x, facet=facet, adsorbate=ads)
            lat = core.vegard(p["metal_a"], p["metal_b"], p["ratio"])
            for it in core.build(p, lat)["items"][:3]:
                at = it["atoms"]
                d = types.SimpleNamespace(atomic_numbers=np.array([core.ATOMIC_NUMBER[s] for s in at["symbols"]]),
                                          pos=at["positions"], cell=at["cell"][None], fixed=np.array(at["fixed"], float))
                r = dcheck.one(d)
                r["vacuum"] = r["c"] - r["thickness"]
                self.assertEqual((r["n_slab"], r["n_fixed"]), (12, 8))
                self.assertEqual(r["adsorbate"], ads)
                self.assertEqual(r["facet"], facet)
                self.assertAlmostEqual(r["a_nn"], lat, 2)
                self.assertLess(abs(r["a_vegard"] / lat - 1), 0.03)  # from the slab's composition, not the bulk's
                self.assertAlmostEqual(r["height"], core.HEIGHT, 6)
                self.assertAlmostEqual(r["vacuum"], 2 * core.VACUUM, 6)
                rows.append(r)
        s = dcheck.summary(rows)
        self.assertEqual(s["slab_atoms"], {12: len(rows)})
        self.assertEqual(s["fixed_adsorbate_atoms"], 0)


if __name__ == "__main__":
    unittest.main()
