#!/usr/bin/env python3
"""Spectra Hall (public/spectra/): the measured spectra.

Copies a hand-picked list of records out of two open collections into public/spectra/sp-measured.js,
keeping the licence, authors and accession of every record:

  MassBank-data  https://github.com/MassBank/MassBank-data   (each record has its own licence; only CC BY and CC0 records are taken)
  OpenSpecy      https://github.com/wincowgerDEV/OpenSpecy-package  (CC BY 4.0; one file inside is PNNL data marked public domain)

  git clone --depth 1 --filter=blob:none https://github.com/MassBank/MassBank-data.git
  git clone --depth 1 https://github.com/wincowgerDEV/OpenSpecy-package.git
  python tools/spectra/measured.py <MassBank-data dir> <OpenSpecy-package dir>

A record whose licence is anything other than CC BY or CC0 stops the script.
"""
import json, os, re, subprocess, sys

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, '..', '..', 'public', 'spectra', 'sp-measured.js')
E = 'Empa_Air_Pollution/MSBNK-Empa_Air_Pollution-EAP__%s.txt'
J = 'MSSJ/MSBNK-MSSJ-%s.txt'
L = 'LCSB/MSBNK-LCSB-%s.txt'

# our id -> record file.  Order is the order on the page.
MS = {
    # electron ionisation, 70 eV (GC-EI-TOF, Empa)
    'ei-toluene': E % 'TOLUENE', 'ei-benzene': E % 'BENZENE', 'ei-chlorobenzene': E % 'CHLOROBENZENE', 'ei-fluorobenzene': E % 'FLUOROBENZENE',
    'ei-hexane': E % 'N_HEXANE', 'ei-heptane': E % 'N_HEPTANE', 'ei-decane': E % 'DECANE', 'ei-propane': E % 'PROPANE', 'ei-ethane': E % 'ETHANE',
    'ei-isopentane': E % '2_METHYLBUTANE',
    'ei-ch3cl': E % 'CH3CL', 'ei-dcm': E % 'CH2CL2', 'ei-chloroform': E % 'CHCL3', 'ei-ccl4': E % 'CCL4',
    'ei-ch3br': E % 'CH3BR', 'ei-ch2br2': E % 'CH2BR2', 'ei-ch3i': E % 'CH3I',
    'ei-tce': E % 'TCE', 'ei-pce': E % 'PCE', 'ei-cfc11': E % 'CFC_11', 'ei-cfc12': E % 'CFC_12', 'ei-hfc134a': E % 'HFC_134A',
    'ei-sf6': E % 'SF6', 'ei-acetaldehyde': E % 'ACETALDEHYDE', 'ei-cos': E % 'COS', 'ei-halon1211': E % 'H_1211',
    # electron ionisation on a quadrupole (Shimadzu) and on a sector instrument (RIKEN)
    'ei-lindane': J % 'MSJ01058', 'ei-benzylether': J % 'MSJ00559',
    # field ionisation of the same compound
    'fi-benzylether': J % 'MSJ00560',
    # chemical ionisation with NO+
    'ci-hexane': J % 'MSJ00084', 'ci-dodecane': J % 'MSJ00085', 'ci-benzene': J % 'MSJ00090',
    # fast atom bombardment, atmospheric-pressure chemical ionisation, MALDI
    'fab-glycerol': J % 'MSJ00059', 'dart-azulene': J % 'MSJ00082', 'maldi-pc': J % 'MSJ00181',
    # electrospray + Orbitrap MS/MS (LCSB): caffeine at six collision energies, then one spectrum each for the LC run
    'esi-caffeine-15': L % 'LU119901', 'esi-caffeine-30': L % 'LU119902', 'esi-caffeine-45': L % 'LU119903',
    'esi-caffeine-60': L % 'LU119904', 'esi-caffeine-75': L % 'LU119905', 'esi-caffeine-90': L % 'LU119906',
    'esi-cotinine': L % 'LU051102', 'esi-theobromine': L % 'LU094103', 'esi-theophylline': L % 'LU111802',
    'esi-propranolol': L % 'LU124802', 'esi-reserpine': L % 'LU101303', 'esi-carbamazepine': L % 'LU126602', 'esi-atrazine': L % 'LU071802',
    'esi-warfarin': L % 'LU037702', 'esi-diclofenac': L % 'LU018601', 'esi-ibuprofen': L % 'LU128351', 'esi-progesterone': L % 'LU055002',
}

def field(t, key):
    m = re.search(r'^' + re.escape(key) + r':? (.*)$', t, re.M)
    return m.group(1).strip() if m else ''

def num(s):
    m = re.search(r'-?\d+(\.\d+)?', s or '')
    return float(m.group(0)) if m else None

def record(root, rel):
    t = open(os.path.join(root, rel), encoding='utf-8').read()
    lic = field(t, 'LICENSE')
    if lic not in ('CC BY', 'CC0'):
        sys.exit(f'{rel}: licence is "{lic}", not CC BY or CC0')
    peaks = []
    block = t.split('PK$PEAK:')[1].split('\n')[1:]
    for line in block:
        p = line.split()
        if len(p) >= 3 and line.startswith('  '):
            peaks.append([round(float(p[0]), 4), int(float(p[2]))])
    peaks = [p for p in peaks if p[1] >= 1]
    if len(peaks) > 80:   # very long peak lists: keep the 80 strongest (the page says so under the figure)
        keep = sorted(peaks, key=lambda p: -p[1])[:80]
        total = len(peaks); peaks = sorted(keep)
    else:
        total = None
    names = re.findall(r'^CH\$NAME: (.*)$', t, re.M)
    out = {
        'acc': field(t, 'ACCESSION'), 'title': field(t, 'RECORD_TITLE'), 'names': names[:2], 'formula': field(t, 'CH$FORMULA'),
        'mass': num(field(t, 'CH$EXACT_MASS')), 'smiles': field(t, 'CH$SMILES'), 'cas': field(t, 'CH$LINK: CAS'),
        'lic': lic, 'authors': field(t, 'AUTHORS'), 'copyright': field(t, 'COPYRIGHT'), 'date': field(t, 'DATE'),
        'inst': field(t, 'AC$INSTRUMENT'), 'type': field(t, 'AC$INSTRUMENT_TYPE'),
        'ms': field(t, 'AC$MASS_SPECTROMETRY: MS_TYPE'), 'mode': field(t, 'AC$MASS_SPECTROMETRY: ION_MODE').upper(),
        'ion': field(t, 'AC$MASS_SPECTROMETRY: IONIZATION'), 'frag': field(t, 'AC$MASS_SPECTROMETRY: FRAGMENTATION_MODE'),
        'ce': field(t, 'AC$MASS_SPECTROMETRY: COLLISION_ENERGY'), 'res': field(t, 'AC$MASS_SPECTROMETRY: RESOLUTION'),
        'matrix': field(t, 'AC$MASS_SPECTROMETRY: MATRIX'),
        'prec': num(field(t, 'MS$FOCUSED_ION: PRECURSOR_M/Z')), 'adduct': field(t, 'MS$FOCUSED_ION: PRECURSOR_TYPE'),
        'rt': num(field(t, 'AC$CHROMATOGRAPHY: RETENTION_TIME')), 'ri': num(field(t, 'AC$CHROMATOGRAPHY: KOVATS_RTI')),
        'column': field(t, 'AC$CHROMATOGRAPHY: COLUMN_NAME'), 'gradient': field(t, 'AC$CHROMATOGRAPHY: FLOW_GRADIENT'),
        'peaks': peaks, 'of': total,
    }
    return {k: v for k, v in out.items() if v not in ('', None, {}, [])}

def jcamp_xy(path, lo, hi, every):
    t = open(path, encoding='latin-1').read()
    yf = float(re.search(r'##YFACTOR=(\S+)', t).group(1)); dx = float(re.search(r'##DELTAX=(\S+)', t).group(1))
    xs, ys = [], []
    for line in t.split('##XYDATA=(X++(Y..Y))')[1].split('##END')[0].strip().split('\n'):
        p = re.findall(r'[+-]?\d+\.?\d*', line)
        x0 = float(p[0])
        for i, v in enumerate(p[1:]):
            xs.append(x0 + i * dx); ys.append(float(v) * yf)
    pts = [(x, y) for x, y in zip(xs, ys) if lo <= x <= hi][::every]
    return [round(x, 1) for x, _ in pts], [round(y, 4) for _, y in pts]

def main():
    mb, osp = sys.argv[1], sys.argv[2]
    rev = lambda d: subprocess.run(['git', '-C', d, 'log', '-1', '--format=%H %cs'], capture_output=True, text=True).stdout.split()
    ms = {k: record(mb, v) for k, v in MS.items()}
    hd = [l.split(',') for l in open(os.path.join(osp, 'inst/extdata/raman_hdpe.csv')).read().strip().split('\n')[1:]]
    nx, ny = jcamp_xy(os.path.join(osp, 'inst/extdata/fitr_nitrocellulose.jdx'), 600, 4000, 3)
    xy = {
        'raman-hdpe': {'x': [float(a) for a, _ in hd], 'y': [float(b) for _, b in hd], 'xunit': 'cm-1', 'yunit': 'counts',
                       'what': 'Raman spectrum of high-density polyethylene', 'by': 'Horiba Scientific', 'lic': 'CC BY 4.0',
                       'from': 'OpenSpecy package, inst/extdata/raman_hdpe.csv', 'doi': '10.1021/acs.analchem.1c00123'},
        'ir-nitrocellulose': {'x': nx, 'y': ny, 'xunit': 'cm-1', 'yunit': 'hemispherical reflectance',
                              'what': 'Diffuse-reflectance infrared spectrum of nitrocellulose (solid), Bruker FTIR with integrating sphere, 4 cm-1',
                              'by': 'Pacific Northwest National Laboratory (IARPA contract), March 2017', 'lic': 'Public domain',
                              'from': 'OpenSpecy package, inst/extdata/fitr_nitrocellulose.jdx (every third point, 600-4000 cm-1)'},
    }
    mrev, orev = rev(mb), rev(osp)
    data = {'sources': {
        'massbank': {'name': 'MassBank', 'url': 'https://github.com/MassBank/MassBank-data', 'commit': mrev[0], 'date': mrev[1], 'record': 'https://massbank.eu/MassBank/RecordDisplay?id='},
        'openspecy': {'name': 'OpenSpecy', 'url': 'https://github.com/wincowgerDEV/OpenSpecy-package', 'commit': orev[0], 'date': orev[1], 'lic': 'CC BY 4.0'}},
        'ms': ms, 'xy': xy}
    js = ('// Generated by tools/spectra/measured.py: do not edit by hand.\n'
          '// Measured spectra copied from MassBank (per-record licence, CC BY or CC0) and OpenSpecy (CC BY 4.0; the nitrocellulose spectrum is PNNL data marked public domain).\n'
          '// These records keep their own licences; they are not covered by the MIT licence of this repository.\n'
          'window.MOLASTRIA_SPECTRA_MEASURED = ' + json.dumps(data, ensure_ascii=False, separators=(',', ':')) + ';\n')
    os.makedirs(os.path.dirname(OUT), exist_ok=True)
    open(OUT, 'w', encoding='utf-8').write(js)
    print(f'{len(ms)} mass spectra, {len(xy)} xy spectra, {len(js) // 1024} KB')

if __name__ == '__main__':
    main()
