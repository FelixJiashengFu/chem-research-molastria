"""ocsr_backend.py (the pure part of the MolNexTR lane) and, where a MolNexTR environment is given, molnextr_worker.py
for real.

    python -X utf8 -m unittest tools/uma-server/test_ocsr_backend.py -v
    MOLASTRIA_MOLNEXTR_PYTHON=/path/to/molnextr-env/python  ... the same, plus the worker through server.MolnextrBackend

The worker test builds a MolNexTR with random weights (a checkpoint with no tensors: the package loads it with
strict=False), so it checks the protocol, the package's API at the pinned commit and the size guard, not the
recognition itself; the real weights are checked on the owner's computer with molnextr_selftest.py.
"""
import base64
import io
import json
import os
import struct
import subprocess
import sys
import tempfile
import unittest
import zlib

HERE = os.path.dirname(os.path.abspath(__file__))
sys.path.insert(0, HERE)
import ocsr_backend as ob  # noqa: E402

try:
    from rdkit import Chem
except ImportError:  # the pure tests still run
    Chem = None


def png(w, h):
    """A white w x h PNG written by hand (no Pillow needed)."""
    raw = b"".join(b"\x00" + b"\xff" * (3 * w) for _ in range(h))
    chunk = lambda t, d: struct.pack(">I", len(d)) + t + d + struct.pack(">I", zlib.crc32(t + d) & 0xFFFFFFFF)  # noqa: E731
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", struct.pack(">IIBBBBB", w, h, 8, 2, 0, 0, 0)) + chunk(b"IDAT", zlib.compress(raw)) + chunk(b"IEND", b"")


def jpeg_header(w, h):
    """The first bytes of a baseline JPEG: SOI, an APP0 segment, then SOF0 with the size."""
    app0 = b"\xff\xe0" + struct.pack(">H", 16) + b"JFIF\x00\x01\x01\x00\x00\x01\x00\x01\x00\x00"
    sof = b"\xff\xc0" + struct.pack(">HBHHB", 11, 8, h, w, 1) + b"\x01\x11\x00"
    return b"\xff\xd8" + app0 + sof + b"\xff\xd9"


b64 = lambda data: base64.b64encode(data).decode()  # noqa: E731


class Pure(unittest.TestCase):
    def test_headers(self):
        self.assertEqual(ob.image_size(png(300, 120)), ("png", 300, 120))
        self.assertEqual(ob.image_size(jpeg_header(640, 480)), ("jpeg", 640, 480))
        for bad in (b"GIF89a....", b"<svg xmlns='http://www.w3.org/2000/svg'/>", b"\x89PNG\r\n\x1a\n\x00\x00", b"\xff\xd8\xff\xe0\x00\x10"):
            with self.assertRaises(ob.OcsrError):
                ob.image_size(bad)

    def test_decode_limits(self):
        data, fmt, w, h = ob.decode(b64(png(64, 40)))
        self.assertEqual((fmt, w, h), ("png", 64, 40))
        with self.assertRaises(ob.OcsrError):
            ob.decode("data:image/png;base64," + b64(png(64, 40)))  # the page sends bare base64
        with self.assertRaises(ob.OcsrError):
            ob.decode(b64(png(8, 40)))  # too small
        with self.assertRaises(ob.OcsrError):
            ob.decode(b64(jpeg_header(ob.MAX_SIDE + 1, 50)))  # too large a side
        with self.assertRaises(ob.OcsrError):
            ob.decode("A" * ((ob.MAX_BYTES + 2) // 3 * 4 + 4))
        with self.assertRaises(ob.OcsrError):
            ob.decode("not base64!")
        with self.assertRaises(ob.OcsrError):
            ob.check_images([])
        with self.assertRaises(ob.OcsrError):
            ob.check_images([b64(png(32, 32))] * (ob.MAX_IMAGES + 1))
        many = b64(b"\x89PNG\r\n\x1a\n" + struct.pack(">I", 13) + b"IHDR" + struct.pack(">II", 64, 64) + b"\x00" * (ob.MAX_BYTES - 24))
        with self.assertRaisesRegex(ob.OcsrError, "together"):
            ob.check_images([many] * 3)  # each under the limit, together over it
        self.assertNotEqual(ob.digest(ob.check_images([b64(png(32, 32))])), ob.digest(ob.check_images([b64(png(33, 32))])))

    def test_summarize(self):
        pred = {"predicted_smiles": "CCO", "predicted_molfile": "\n  x\n",
                "atom_sets": [{"atom_symbol": "C", "coords": (0.1, 0.2), "confidence": 0.9},
                              {"atom_symbol": "C", "coords": (0.5, 0.2), "confidence": 0.9},
                              {"atom_symbol": "O", "coords": (0.9, 0.2), "confidence": 0.4}],
                "bond_sets": [{"bond_type": "single", "endpoints": (0, 1), "confidence": 0.9},
                              {"bond_type": "single", "endpoints": (1, 2), "confidence": 0.9}]}
        it = ob.summarize(pred)
        self.assertTrue(it["ok"])
        self.assertAlmostEqual(it["confidence"], round((0.9 ** 4 * 0.4) ** 0.2, 4))  # geometric mean of five scores
        self.assertEqual((it["min_confidence"], it["n_atoms"], it["n_bonds"]), (0.4, 3, 2))
        self.assertEqual(it["atoms"][2], {"symbol": "O", "x": 0.9, "y": 0.2, "confidence": 0.4})
        json.dumps(it)
        # what random weights produce: hundreds of atoms and a SMILES of thousands of characters
        noise = {"predicted_smiles": "*" + "1" * 2000, "atom_sets": [{"atom_symbol": "Y", "coords": (0.6, 0.8), "confidence": 0.01}] * 300}
        it = ob.summarize(noise)
        self.assertFalse(it["ok"])
        self.assertIn("too large", it["error"])
        self.assertNotIn("smiles", it)
        self.assertFalse(ob.summarize({"predicted_smiles": ""})["ok"])
        self.assertIsNone(ob.summarize({"predicted_smiles": "C"})["confidence"])  # no scores asked for

    @unittest.skipIf(Chem is None, "needs RDKit")
    def test_finish_and_toy(self):
        it = ob.finish(ob.summarize({"predicted_smiles": "OC(C)C"}), Chem)
        self.assertEqual((it["valid"], it["canonical"], it["formula"], it["r_groups"]), (True, "CC(C)O", "C3H8O", 0))
        it = ob.finish(ob.summarize({"predicted_smiles": "*c1ccccc1"}), Chem)
        self.assertEqual(it["r_groups"], 1)
        it = ob.finish(ob.summarize({"predicted_smiles": "C1CC"}), Chem)  # an unclosed ring
        self.assertEqual((it["ok"], it["valid"]), (True, False))
        decoded = ob.check_images([b64(png(40, 30)), b64(png(50, 30))])
        r = ob.result([ob.finish(x, Chem) for x in ob.toy_predict(decoded, Chem)], decoded, {"version": "fake"})
        self.assertEqual((r["engine"], r["n_ok"], [x["index"] for x in r["items"]]), ("MolNexTR", 2, [0, 1]))
        self.assertEqual((r["items"][1]["width"], r["items"][1]["canonical"]), (50, "CC(=O)c1ccc(Br)cc1"))
        self.assertIn("V2000", r["items"][0]["molfile"])


MNX = os.environ.get("MOLASTRIA_MOLNEXTR_PYTHON", "")


@unittest.skipUnless(MNX, "set MOLASTRIA_MOLNEXTR_PYTHON to a Python with MolNexTR")
class Worker(unittest.TestCase):
    """The real worker process with random weights, through server.MolnextrBackend."""

    @classmethod
    def setUpClass(cls):
        cls.tmp = tempfile.mkdtemp(prefix="molastria-mnx-")
        weights = os.path.join(cls.tmp, "random.pth")
        subprocess.run([MNX, "-c", "import sys, torch; torch.save({'args': {'formats': ['chartok_coords', 'edges']}, "
                        "'encoder': {}, 'decoder': {}}, sys.argv[1])", weights], check=True)
        os.environ["MOLASTRIA_MOLNEXTR_WEIGHTS"] = weights
        os.environ.setdefault("MOLASTRIA_MOLNEXTR_DEVICE", "cpu")
        import server

        cls.backend = server.MolnextrBackend(MNX)

    @classmethod
    def tearDownClass(cls):
        if cls.backend.proc:
            cls.backend.proc.kill()

    def test_ping(self):
        info = self.backend.info
        self.assertEqual((info["weights"], info["device"]), ("random.pth", "cpu"))
        self.assertTrue(info["version"])

    def test_recognise(self):
        from PIL import Image

        buf = io.BytesIO()
        Image.new("RGB", (300, 200), "white").save(buf, "JPEG")
        items = self.backend.recognise([b64(png(120, 80)), b64(buf.getvalue()), "aGVsbG8="], timeout=600)
        self.assertEqual(len(items), 3)
        self.assertEqual(items[2], {"ok": False, "error": "only PNG and JPEG images are read"})
        for it in items[:2]:  # random weights: either refused as noise, or a summary with every field
            self.assertIn("ok", it)
            if it["ok"]:
                self.assertTrue({"smiles", "molfile", "confidence", "min_confidence", "atoms"} <= set(it))
            else:
                self.assertIn("error", it)
        json.dumps(items)


if __name__ == "__main__":
    unittest.main()
