/* 文献抽取的示范：sample-suzuki.svg（tools/extract-sample.mjs 画的，产率是编的）和每个智能体的一份事先写好的回答。
   “看示范”按钮用这些回答走一遍完整流水线：规划之后的核对、R 基团代入、条件归类、汇总、核对和打分都是现算的，
   只有模型那几步换成了这里的回答，所以不需要 AI key。tools/extract-test.mjs 检查它跑出来的六条反应都对。 */
(function (root) {
  'use strict';
  root.MOLASTRIA_EXTRACT_DEMO = {
    image: 'sample-suzuki.svg',
    caption: 'Scheme 1. Suzuki–Miyaura coupling of 4-bromoacetophenone (1) with arylboronic acids 2. Conditions: 1 (0.5 mmol), 2 (0.75 mmol), Pd(PPh3)4 (5 mol%), K2CO3 (2.0 equiv), toluene/H2O (4:1, 2.5 mL), 80 °C, 12 h, under N2. Isolated yields.',
    replies: {
      planner: { components: { scheme: true, standalone: false, scope_panel: false, rgroup_table: true, conditions: true, text: true }, note: 'One scheme with conditions on the arrow and a table of Ar values.' },
      template: {
        reactants: [{ label: '1', smiles: 'CC(=O)c1ccc(Br)cc1', name: '' }, { label: '2', smiles: 'OB(O)[*:1]', name: '' }],
        products: [{ label: '3', smiles: 'CC(=O)c1ccc([*:1])cc1', name: '' }],
        rgroups: [{ name: 'Ar', map: 1 }],
        arrow_text: ['Pd(PPh3)4 (5 mol%)', 'K2CO3 (2.0 equiv)', 'toluene/H2O (4:1), 80 °C, 12 h'],
        note: ''
      },
      rtable: {
        columns: ['Ar'],
        rows: [
          { label: '3a', values: { Ar: 'Ph' }, yield: '95' },
          { label: '3b', values: { Ar: '4-MeOC6H4' }, yield: '92' },
          { label: '3c', values: { Ar: '4-FC6H4' }, yield: '88' },
          { label: '3d', values: { Ar: '3,5-Me2C6H3' }, yield: '90' },
          { label: '3e', values: { Ar: '2-naphthyl' }, yield: '84' },
          { label: '3f', values: { Ar: '2-thienyl' }, yield: '76' }
        ],
        note: 'Yields are isolated yields (footnote a).'
      },
      conditions: {
        conditions: [
          { text: 'Pd(PPh3)4 (5 mol%)', role: 'catalyst', name: 'Pd(PPh3)4', amount: '5 mol%', smiles: '' },
          { text: 'K2CO3 (2.0 equiv)', role: 'base', name: 'K2CO3', amount: '2.0 equiv', smiles: '' },
          { text: 'toluene/H2O (4:1)', role: 'solvent', name: 'toluene/H2O', amount: '4:1', smiles: '' },
          { text: '80 °C', role: 'temperature', name: '', amount: '', smiles: '' },
          { text: '12 h', role: 'time', name: '', amount: '', smiles: '' }
        ],
        note: ''
      },
      text: {
        reactions: [],
        entities: [
          { text: '4-bromoacetophenone', type: 'compound' }, { text: 'arylboronic acids', type: 'compound' }, { text: 'Pd(PPh3)4', type: 'catalyst' },
          { text: 'K2CO3', type: 'reagent' }, { text: 'toluene/H2O', type: 'solvent' }, { text: '80 °C', type: 'condition' }, { text: '12 h', type: 'condition' }, { text: 'N2', type: 'condition' }
        ],
        note: 'The caption adds the scale and a nitrogen atmosphere.'
      },
      verify: { reactions: [] }
    }
  };
})(typeof window !== 'undefined' ? window : globalThis);
