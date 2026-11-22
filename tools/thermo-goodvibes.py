"""Reference numbers for tools/thermo-test.mjs: run the real GoodVibes on every fixture in tools/thermo-fixtures/
under a set of options and write tools/thermo-fixtures/goodvibes-ref.json.

    pip install goodvibes==4.4.0
    python3 tools/thermo-goodvibes.py            # rewrite the JSON
    python3 tools/thermo-goodvibes.py --print    # print it, don't write (the node test uses this to see if the JSON is current)

GoodVibes (MIT, (c) 2017 Robert Paton) is only imported here, on the machine that runs the test; none of its code is in public/.
"""
import json, os, sys, warnings

warnings.simplefilter('ignore')
import goodvibes  # noqa: E402
from goodvibes.thermo import calc_bbe, ThermoOptions  # noqa: E402

HERE = os.path.dirname(os.path.abspath(__file__))
FIX = os.path.join(HERE, 'thermo-fixtures')

# name -> (ThermoOptions kwargs, the same options in thermo-core.js terms)
CASES = {
    'rrho-grimme': ({}, {}),
    'T350-1M': ({'temperature': 350.0, 'concentration': 1.0}, {'T': 350, 'conc': 1}),
    'truhlar-100': ({'QS': 'truhlar'}, {'qs': 'truhlar'}),
    'qh-150-s50': ({'QH': True, 'h_freq_cutoff': 150.0, 's_freq_cutoff': 50.0}, {'qh': True, 'hCutoff': 150, 'sCutoff': 50}),
    'scale-0.97': ({'freq_scale_factor': 0.97}, {'scale': 0.97}),
    'scale-0.97-zpe-0.98': ({'freq_scale_factor': 0.97, 'zpe_scale_factor': 0.98}, {'scale': 0.97, 'zpeScale': 0.98}),
    'invert-1500': ({'invert': -1500.0}, {'invert': -1500}),
    'bav-conf-T200': ({'inertia': 'conf', 'temperature': 200.0}, {'bav': 'mol', 'T': 200}),
}
KEYS = ['scf_energy', 'zpe', 'enthalpy', 'qh_enthalpy', 'entropy', 'qh_entropy', 'gibbs_free_energy', 'qh_gibbs_free_energy']


def run():
    out = {'goodvibes': getattr(goodvibes, '__version__', '?'), 'cases': {k: v[1] for k, v in CASES.items()}, 'files': {}}
    for f in sorted(os.listdir(FIX)):
        if not f.endswith('.out'):
            continue
        path = os.path.join(FIX, f)
        rows = {}
        for name, (kw, _) in CASES.items():
            o = {'freq_scale_factor': 1.0, **kw}
            b = calc_bbe.from_options(path, ThermoOptions(**o))
            T = o.get('temperature', 298.15)
            row = {k: float(getattr(b, k)) for k in KEYS}
            row['TS'] = T * row['entropy']
            row['qh_TS'] = T * row['qh_entropy']
            row['symmno'] = int(b.symmno)
            row['mult'] = int(b.multiplicity)
            row['im'] = [float(x) for x in b.im_frequency_wn]
            row['inverted'] = [float(x) for x in b.inverted_freqs]
            rows[name] = row
        out['files'][f] = rows
    return out


if __name__ == '__main__':
    text = json.dumps(run(), indent=1, sort_keys=True) + '\n'
    if '--print' in sys.argv:
        sys.stdout.write(text)
    else:
        open(os.path.join(FIX, 'goodvibes-ref.json'), 'w').write(text)
        print('wrote', os.path.join(FIX, 'goodvibes-ref.json'))
