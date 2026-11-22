"""Excerpts of real program outputs for tools/workbench-test.mjs, cut from cclib's regression data
(https://github.com/cclib/cclib, data/Gaussian/basicGaussian16 and data/ORCA/basicORCA5.0 / basicORCA6.0,
BSD-3-Clause, © the cclib authors). Only the lines the workbench readers use are kept, numbers unchanged.
cclib-ref.json holds what cclib 1.8.1 reads from the full files (ORCA 6 is not read by cclib 1.8.1, so the
test compares ORCA 6 with the ORCA 5 run of the same molecule instead).
Run: python tools/workbench/cclib-excerpt.py /path/to/cclib (needs `pip install cclib`)."""
import sys, json, re, logging, pathlib
src = pathlib.Path(sys.argv[1]) / "data"
dst = pathlib.Path(__file__).resolve().parent / "fixtures" / "cclib"
dst.mkdir(parents=True, exist_ok=True)

def block(lines, start_re, stop):
    out = []
    for i, l in enumerate(lines):
        if re.search(start_re, l):
            out.append(i)
    if not out:
        return []
    i = out[-1]
    return lines[i:i + stop]

def g16_scan(lines):
    keep = [l for l in lines if l.lstrip().startswith("#")][:3]
    seg_starts = [i for i, l in enumerate(lines) if "Stationary point found" in l]
    prev = 0
    for s in seg_starts:
        seg = lines[prev:s]
        e = [l for l in seg if "SCF Done" in l]
        o = [i for i, l in enumerate(seg) if "Standard orientation:" in l]
        if o:
            j = o[-1]
            k = j + 5
            while k < len(seg) and re.match(r"^\s*\d+\s+\d+\s+-?\d+\s+-?\d+\.\d+", seg[k]):
                k += 1
            keep += seg[j:k + 1]
        if e:
            keep.append(e[-1])
        keep.append(lines[s])
        prev = s + 1
    return keep

jobs = {
    "g16-td.out": ("Gaussian/basicGaussian16/dvb_td.out", lambda L: [l for l in L if "Excited State" in l]),
    "orca5-td.out": ("ORCA/basicORCA5.0/dvb_td.out", lambda L: block(L, r"ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC", 20)),
    "orca6-td.out": ("ORCA/basicORCA6.0/dvb_td.out", lambda L: block(L, r"ABSORPTION SPECTRUM VIA TRANSITION ELECTRIC", 20)),
    "g16-raman.out": ("Gaussian/basicGaussian16/dvb_raman.out", lambda L: [l for l in L if re.match(r"^\s*(Frequencies --|Raman Activ --|IR Inten\s+--)(?!-)", l)]),
    "orca5-raman.out": ("ORCA/basicORCA5.0/dvb_raman.out", lambda L: block(L, r"^RAMAN SPECTRUM", 66)),
    "orca6-raman.out": ("ORCA/basicORCA6.0/dvb_raman.out", lambda L: block(L, r"^RAMAN SPECTRUM", 66)),
    "g16-scan.log": ("Gaussian/basicGaussian16/dvb_scan_relaxed.log", g16_scan),
    "orca5-scan.out": ("ORCA/basicORCA5.0/dvb_scan_relaxed.out", lambda L: block(L, r"The Calculated Surface using the 'Actual Energy'", 16)),
    "orca6-scan.out": ("ORCA/basicORCA6.0/dvb_scan_relaxed.out", lambda L: block(L, r"The Calculated Surface using the 'Actual Energy'", 16)),
    "orca5-sp.out": ("ORCA/basicORCA5.0/dvb_sp.out", lambda L: block(L, r"^ORBITAL ENERGIES", 70)),
    "orca5-sp-un.out": ("ORCA/basicORCA5.0/dvb_sp_un.out", lambda L: block(L, r"^ORBITAL ENERGIES", 140)),
    "g16-sp.out": ("Gaussian/basicGaussian16/dvb_sp.out", lambda L: [l for l in L if re.match(r"^\s*(Alpha|Beta)\s+(occ|virt)\. eigenvalues", l)]),
    "g16-un-sp.log": ("Gaussian/basicGaussian16/dvb_un_sp.log", lambda L: [l for l in L if re.match(r"^\s*(Alpha|Beta)\s+(occ|virt)\. eigenvalues", l)]),
}
for name, (path, fn) in jobs.items():
    L = (src / path).read_text(errors="replace").replace("\r", "").split("\n")
    (dst / name).write_text("\n".join(fn(L)) + "\n")

import cclib
ref = {}
for name, (path, _) in jobs.items():
    if "orca6" in name:
        continue
    d = cclib.io.ccread(str(src / path), loglevel=logging.CRITICAL)
    r = {}
    for a in ["etenergies", "etoscs", "vibfreqs", "vibramans", "scanenergies", "moenergies", "homos"]:
        v = getattr(d, a, None)
        if v is not None:
            r[a] = [x.tolist() for x in v] if a == "moenergies" else (v.tolist() if hasattr(v, "tolist") else list(v))
    ref[name] = r
(dst / "cclib-ref.json").write_text(json.dumps(ref))
print({p.name: p.stat().st_size for p in sorted(dst.iterdir())})
