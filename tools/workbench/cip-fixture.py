"""R/S 和 E/Z 的参考答案：RDKit 从 SMILES 搭三维结构（ETKDG + MMFF），用它的新 CIP 标注器（Hanson 等 2018）标出构型。
页面上的标注只用三维坐标（先从键长推键级，再交给 OpenChemLib 算 CIP），tools/workbench-test.mjs 拿它对照这里的答案。
用法：python3 tools/workbench/cip-fixture.py（要 pip install rdkit）。写 tools/workbench/fixtures/cip.json。"""
import json, pathlib
from rdkit import Chem
from rdkit.Chem import AllChem, rdCIPLabeler

CASES = [
    ('L-alanine', 'N[C@@H](C)C(=O)O'),
    ('bromochlorofluoromethane', 'F[C@H](Cl)Br'),
    ('(R)-2-butanol', 'C[C@@H](O)CC'),
    ('3-methyl-1-pentene', 'C=C[C@@H](C)CC'),
    ('1-phenyl-2,2-dimethylpropane centre', 'C[C@H](c1ccccc1)C(C)(C)C'),
    ('mandelonitrile', 'N#C[C@H](O)c1ccccc1'),
    ('(S)-ibuprofen', 'CC(C)Cc1ccc(cc1)[C@H](C)C(=O)O'),
    ('menthol', 'CC(C)[C@@H]1CC[C@@H](C)C[C@H]1O'),
    ('beta-D-glucose', 'OC[C@H]1O[C@@H](O)[C@H](O)[C@@H](O)[C@@H]1O'),
    ('nitro alcohol', 'O=[N+]([O-])c1ccc(cc1)[C@H](C)O'),
    ('alanine zwitterion', 'C[C@H]([NH3+])C(=O)[O-]'),
    ('lactate anion', 'C[C@@H](O)C(=O)[O-]'),
    ('(E)-2-butene', 'C/C=C/C'),
    ('isocrotonic acid', 'C/C=C\\C(=O)O'),
    ('(E)-1,2-difluoroethene', 'F/C=C/F'),
    ('methyl phenyl sulfoxide', 'C[S@](=O)c1ccccc1'),
    ('carvone', 'CC1=CC[C@@H](CC1=O)C(C)=C'),
    ('thalidomide', 'O=C1CC[C@H](C(=O)N1)N1C(=O)c2ccccc2C1=O'),
]

out = []
for name, smi in CASES:
    m = Chem.AddHs(Chem.MolFromSmiles(smi))
    assert AllChem.EmbedMolecule(m, randomSeed=7) == 0, name
    AllChem.MMFFOptimizeMolecule(m, maxIters=2000)
    Chem.AssignStereochemistryFrom3D(m)
    rdCIPLabeler.AssignCIPLabels(m)
    conf = m.GetConformer()
    atoms = [[a.GetSymbol(), *[round(v, 5) for v in conf.GetAtomPosition(a.GetIdx())]] for a in m.GetAtoms()]
    centres = {str(a.GetIdx()): a.GetProp('_CIPCode') for a in m.GetAtoms() if a.HasProp('_CIPCode')}
    dbl = [[b.GetBeginAtomIdx(), b.GetEndAtomIdx(), b.GetProp('_CIPCode')] for b in m.GetBonds() if b.HasProp('_CIPCode')]
    out.append({'name': name, 'smiles': smi, 'charge': Chem.GetFormalCharge(m), 'atoms': atoms, 'centres': centres, 'bonds': dbl})
    print(f'{name:38s} {centres} {dbl}')

path = pathlib.Path(__file__).with_name('fixtures') / 'cip.json'
path.write_text(json.dumps({'source': 'RDKit ' + Chem.rdBase.rdkitVersion + ' new CIP labeler; geometries ETKDG (seed 7) + MMFF94', 'cases': out}, indent=1) + '\n')
print('wrote', path)
