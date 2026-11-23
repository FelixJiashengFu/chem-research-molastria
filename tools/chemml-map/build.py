"""化学机器学习 · 结构–性质图（/chem-ml/#c-eval 的 Chemiscope 演示）的数据：枚举一组小分子，算三维结构和性质。

    python3 tools/chemml-map/build.py            # 全部重算（4 核约 10 分钟），写 tools/chemml-map/molecules.json
    python3 tools/chemml-map/build.py --limit 20 # 只算前 20 个，试跑用

然后运行 node tools/chemml-map.mjs，把 molecules.json 和指纹、主成分拼成 public/chem-ml/cml-map-data.js。

分子从哪里来：不取任何外部数据集。下面的 SCAFFOLDS（14 个母核，标出接取代基的位置）× SUBS（17 个取代基）
由这个脚本自己枚举，再加对位二取代苯；全部是教科书里常见的简单分子。所以数据的来源和许可证只有一个：MolAstria 自己算的，CC BY 4.0。

三维结构：RDKit ETKDGv3（固定随机种子）→ MMFF94 优化 → GFN2-xTB 优化（tblite 的 Python 接口算能量和梯度，
ASE 的 BFGS，fmax 0.03 eV/Å，最多 400 步）。性质：在 GFN2-xTB 优化后的结构上做一次单点，读 HOMO、LUMO、能隙、偶极矩；
另用 RDKit 算分子量、Crippen logP、TPSA、氢键给体 / 受体、可旋转键、重原子数、sp³ 碳比例和 Bemis–Murcko 骨架。

依赖：pip install rdkit tblite ase numpy（版本记进输出的 meta）。tblite 是 LGPL-3.0，只在这台机器上当库调用，不进仓库。
"""
import argparse
import json
import os
import sys
import time
from concurrent.futures import ProcessPoolExecutor
from importlib.metadata import version

import numpy as np
from rdkit import Chem
from rdkit.Chem import AllChem, Crippen, Descriptors, Lipinski, rdMolDescriptors
from rdkit.Chem.Scaffolds import MurckoScaffold

HERE = os.path.dirname(os.path.abspath(__file__))
OUT = os.path.join(HERE, 'molecules.json')
HARTREE_EV = 27.211386245988
AU_DEBYE = 2.541746473

# 母核：key、中文名、英文名、带 [*:1]（以及 [*:2]）的 SMILES
SCAFFOLDS = [
    ('benzene', '苯', 'benzene', 'c1ccc([*:1])cc1'),
    ('pyridine', '吡啶（4 位）', 'pyridine (4-)', 'n1ccc([*:1])cc1'),
    ('pyrimidine', '嘧啶（5 位）', 'pyrimidine (5-)', 'c1ncc([*:1])cn1'),
    ('thiophene', '噻吩（2 位）', 'thiophene (2-)', 's1cccc1[*:1]'),
    ('furan', '呋喃（2 位）', 'furan (2-)', 'o1cccc1[*:1]'),
    ('pyrrole', '吡咯（N 上）', 'pyrrole (N-)', 'c1ccn([*:1])c1'),
    ('naphthalene', '萘（2 位）', 'naphthalene (2-)', 'c1ccc2cc([*:1])ccc2c1'),
    ('indole', '吲哚（5 位）', 'indole (5-)', 'c1cc2[nH]ccc2cc1[*:1]'),
    ('cyclohexane', '环己烷', 'cyclohexane', 'C1CCC([*:1])CC1'),
    ('cyclopentane', '环戊烷', 'cyclopentane', 'C1CCC([*:1])C1'),
    ('piperidine', '哌啶（4 位）', 'piperidine (4-)', 'C1CNCCC1[*:1]'),
    ('oxane', '四氢吡喃（4 位）', 'oxane (4-)', 'C1COCCC1[*:1]'),
    ('propyl', '正丙基（无环）', 'n-propyl (acyclic)', 'CCC[*:1]'),
    ('isobutyl', '异丁基（无环）', 'isobutyl (acyclic)', 'CC(C)C[*:1]'),
]
# 取代基：key、SMILES 片段（接在 [*] 上）
SUBS = [
    ('H', '[H]'), ('F', 'F'), ('Cl', 'Cl'), ('Br', 'Br'), ('Me', 'C'), ('Et', 'CC'), ('OH', 'O'), ('OMe', 'OC'),
    ('NH2', 'N'), ('NMe2', 'N(C)C'), ('CN', 'C#N'), ('NO2', '[N+](=O)[O-]'), ('CF3', 'C(F)(F)F'),
    ('COOH', 'C(=O)O'), ('CHO', 'C=O'), ('COMe', 'C(C)=O'), ('CONH2', 'C(N)=O'),
]
# 对位二取代苯用的取代基
PARA = ['F', 'Cl', 'Me', 'OH', 'OMe', 'NH2', 'NMe2', 'CN', 'NO2', 'CHO']


def attach(core, subs):
    """把取代基接到 [*:k] 上，返回 RDKit 的规范 SMILES（不带显式 H）。"""
    smi = core
    if subs == ['[H]'] and 'n([*:1])' in core:
        smi = core.replace('n([*:1])', '[nH]')  # 母体吡咯：N 上是 H
    for k, s in enumerate(subs, 1):
        frag = '' if s == '[H]' else s
        smi = smi.replace(f'([*:{k}])', f'({frag})' if frag else '').replace(f'[*:{k}]', f'({frag})' if frag else '')
    m = Chem.MolFromSmiles(smi)
    if m is None:
        raise ValueError(f'读不通：{smi}')
    return Chem.MolToSmiles(m)


def enumerate_molecules():
    sub = dict(SUBS)
    seen, out = set(), []
    for key, zh, en, core in SCAFFOLDS:
        for sk, s in SUBS:
            if key == 'pyrrole' and sk in ('F', 'Cl', 'Br', 'OH', 'OMe', 'NH2', 'NMe2', 'NO2', 'CN'):
                continue  # N–卤素、N–O、N–N、N–CN 的吡咯不稳定或不常见，跳过
            smi = attach(core, [s])
            if smi in seen:
                continue
            seen.add(smi)
            out.append({'smiles': smi, 'family': key, 'subs': [sk]})
    core = 'c1cc([*:1])ccc1[*:2]'
    for i, a in enumerate(PARA):
        for b in PARA[i:]:
            smi = attach(core, [sub[a], sub[b]])
            if smi in seen:
                continue
            seen.add(smi)
            out.append({'smiles': smi, 'family': 'benzene', 'subs': [a, b]})
    return out


def rdkit_props(m):
    scaf = MurckoScaffold.MurckoScaffoldSmiles(mol=m)
    return {
        'mw': round(Descriptors.MolWt(m), 3),
        'logp': round(Crippen.MolLogP(m), 3),
        'tpsa': round(rdMolDescriptors.CalcTPSA(m), 2),
        'hbd': Lipinski.NumHDonors(m),
        'hba': Lipinski.NumHAcceptors(m),
        'rotb': rdMolDescriptors.CalcNumRotatableBonds(m),
        'heavy': m.GetNumHeavyAtoms(),
        'fsp3': round(rdMolDescriptors.CalcFractionCSP3(m), 3),
        'rings': rdMolDescriptors.CalcNumRings(m),
        'murcko': scaf,
    }


def compute(rec):
    """一个分子：ETKDG → MMFF → GFN2-xTB 优化 → 单点性质。在子进程里跑。"""
    from ase import Atoms
    from ase.calculators.calculator import Calculator, all_changes
    from ase.optimize import BFGS
    from tblite.interface import Calculator as XTB

    BOHR = 0.529177210903

    class GFN2(Calculator):
        implemented_properties = ['energy', 'forces']

        def calculate(self, atoms=None, properties=('energy',), system_changes=all_changes):
            super().calculate(atoms, properties, system_changes)
            x = XTB('GFN2-xTB', atoms.numbers, atoms.positions / BOHR, charge=0, uhf=0)
            x.set('verbosity', 0)
            r = x.singlepoint()
            self.results['energy'] = r.get('energy') * HARTREE_EV
            self.results['forces'] = -r.get('gradient') * HARTREE_EV / BOHR
            self.last = r

    t0 = time.time()
    m = Chem.AddHs(Chem.MolFromSmiles(rec['smiles']))
    p = AllChem.ETKDGv3()
    p.randomSeed = 20261123
    if AllChem.EmbedMolecule(m, p) != 0:
        raise RuntimeError(f'ETKDG 失败：{rec["smiles"]}')
    AllChem.MMFFOptimizeMolecule(m, maxIters=2000)
    nums = [a.GetAtomicNum() for a in m.GetAtoms()]
    pos = m.GetConformer().GetPositions()
    atoms = Atoms(numbers=nums, positions=pos)
    calc = GFN2()
    atoms.calc = calc
    opt = BFGS(atoms, logfile=None)
    converged = bool(opt.run(fmax=0.03, steps=400))
    fmax = float(np.sqrt((atoms.get_forces() ** 2).sum(axis=1)).max())
    r = calc.last
    eps, occ = r.get('orbital-energies'), r.get('orbital-occupations')
    homo_i = int(np.where(occ > 1e-3)[0].max())
    homo, lumo = eps[homo_i] * HARTREE_EV, eps[homo_i + 1] * HARTREE_EV
    dip = float(np.linalg.norm(r.get('dipole')) * AU_DEBYE)
    out = dict(rec)
    out.update({
        'elements': [a.GetSymbol() for a in m.GetAtoms()],
        'xyz': [[round(float(v), 4) for v in row] for row in atoms.positions],
        'energy_eh': round(float(r.get('energy')), 8),
        'homo': round(float(homo), 4), 'lumo': round(float(lumo), 4), 'gap': round(float(lumo - homo), 4),
        'dipole': round(dip, 4),
        'opt': {'converged': converged, 'steps': int(opt.nsteps), 'fmax': round(fmax, 4)},
        'seconds': round(time.time() - t0, 2),
    })
    out.update(rdkit_props(Chem.MolFromSmiles(rec['smiles'])))
    return out


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--limit', type=int, default=0)
    ap.add_argument('--jobs', type=int, default=os.cpu_count() or 1)
    a = ap.parse_args()
    mols = enumerate_molecules()
    if a.limit:
        mols = mols[: a.limit]
    print(f'{len(mols)} 个分子，{a.jobs} 个进程', file=sys.stderr)
    os.environ.setdefault('OMP_NUM_THREADS', '1')
    res = []
    with ProcessPoolExecutor(a.jobs) as ex:
        for i, r in enumerate(ex.map(compute, mols, chunksize=2)):
            res.append(r)
            if i % 20 == 0:
                print(f'  {i + 1}/{len(mols)} {r["smiles"]} gap {r["gap"]:.2f} eV  {r["seconds"]} s', file=sys.stderr)
    meta = {
        'name': ['小分子结构–性质图', 'Small-molecule structure–property map'],
        'licence': 'CC BY 4.0',
        'source': ['MolAstria 自己枚举、自己算（tools/chemml-map/build.py），不取外部数据集。', 'Enumerated and computed by MolAstria (tools/chemml-map/build.py); no external dataset.'],
        'enumeration': {'scaffolds': [[k, zh, en, s] for k, zh, en, s in SCAFFOLDS], 'subs': [[k, s] for k, s in SUBS], 'para': PARA},
        'method': {
            'embed': 'RDKit ETKDGv3, randomSeed 20261123',
            'preopt': 'MMFF94 (RDKit), maxIters 2000',
            'opt': 'GFN2-xTB (tblite) + ASE BFGS, fmax 0.03 eV/Å, ≤ 400 steps',
            'props': 'GFN2-xTB single point at the optimised geometry: HOMO, LUMO, gap (eV), dipole (D); RDKit: MW, Crippen logP, TPSA, HBD, HBA, rotatable bonds, heavy atoms, Fsp3, Murcko scaffold',
        },
        'versions': {k: version(k) for k in ('rdkit', 'tblite', 'ase', 'numpy')},
        'python': sys.version.split()[0],
        'date': time.strftime('%Y-%m-%d'),
    }
    with open(OUT, 'w', encoding='utf-8') as f:
        f.write('{\n "meta": ' + json.dumps(meta, ensure_ascii=False) + ',\n "molecules": [\n')
        f.write(',\n'.join('  ' + json.dumps(r, ensure_ascii=False, separators=(',', ':')) for r in res))
        f.write('\n ]\n}\n')
    bad = [r['smiles'] for r in res if not r['opt']['converged']]
    print(f'写好 {OUT}：{len(res)} 个分子，没收敛 {len(bad)} 个 {bad[:5]}', file=sys.stderr)


if __name__ == '__main__':
    main()
