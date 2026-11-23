// Curated chemistry & physics presets + Particle HIVE localStorage helpers for /particles/.
// Works both in browser (<script src="particles-presets.js">) and in Node.js tests.
(function (root) {
  'use strict';

  var STORAGE_KEYS = {
    PROJECT_PREFIX: 'paths/',
    RECENT_KEY: 'recentProjectPaths',
  };

  var PRESETS = [
    {
      id: 'argon-lj',
      filename: 'argon-lj.yml',
      tagZh: '2D · LJ',
      tagEn: '2D · LJ',
      nameZh: '氩原子 LJ 流体',
      nameEn: 'Argon LJ Fluid',
      summaryZh: '4,096 个粒子受 Lennard-Jones 12-6 势与速度重标恒温控制，直观观察近程排斥与中程范德华凝聚。',
      summaryEn: '4,096 particles under a Lennard-Jones 12-6 potential with gentle velocity rescaling, balancing short-range repulsion and van der Waals cohesion.',
      yaml: [
        'simulation:',
        '  count: 4096',
        '  minGridSize: 8.0',
        '  dT: 0.004',
        '  conversionRate: 50',
        '  maxVelocity: 2.5',
        '  maxForce: 50000.0',
        '  targetVelocity: 0.35',
        '  targetVelocityStrength: 0.08',
        '  threeDimensions: false',
        '  passesPerFrame: 60',
        '  size:',
        '    width: 1000',
        '    height: 1000',
        'particles:',
        '  argon:',
        '    color: 6ad1ff',
        '    radius: 2.2',
        '    distribution: 1',
        'interactions:',
        '  lennardJones:',
        '    argon-argon: { sigma: 3.6, epsilon: 1.8 }',
      ].join('\n'),
    },
    {
      id: 'morse-assembly',
      filename: 'morse-assembly.yml',
      tagZh: '2D · Morse',
      tagEn: '2D · Morse',
      nameZh: '双组分自组装',
      nameEn: 'Morse Self-Assembly',
      summaryZh: '12,288 个配体与单体粒子按不同平衡键长 re 发生莫尔斯吸引，自发形成有序团簇与界面。',
      summaryEn: '12,288 ligand and monomer particles interact through asymmetric Morse wells, self-assembling into ordered clusters and interfaces.',
      yaml: [
        'simulation:',
        '  count: 12288',
        '  minGridSize: 5.0',
        '  dT: 0.05',
        '  conversionRate: 50',
        '  maxVelocity: 3.0',
        '  maxForce: 100000.0',
        '  threeDimensions: false',
        '  passesPerFrame: 40',
        '  size:',
        '    width: 2400',
        '    height: 2400',
        '    depth: 1000',
        'particles:',
        '  ligand:',
        '    color: f4f7fb',
        '    radius: 2.0',
        '    distribution: 2',
        '  monomer:',
        '    color: ff5d5d',
        '    radius: 2.0',
        '    distribution: 1',
        'interactions:',
        '  morse:',
        '    ligand-monomer: { De: 5.0, a: 1.0, re: 3.0 }',
        '    ligand-ligand: { De: 5.0, a: 1.0, re: 5.0 }',
        '    monomer-monomer: { De: 5.0, a: 1.0, re: 5.0 }',
      ].join('\n'),
    },
    {
      id: 'tersoff-covalent',
      filename: 'tersoff-covalent.yml',
      tagZh: '2D · 多体势',
      tagEn: '2D · Many-Body',
      nameZh: 'Tersoff 共价网络',
      nameEn: 'Tersoff Network',
      summaryZh: '基于局部配位数调制键级 b_ij 的简化 Tersoff 键序势：配位数升高会减弱单键吸引，形成稀疏共价骨架。',
      summaryEn: 'Simplified Tersoff bond-order potential modulated by local coordination count: higher neighbor density weakens attraction to favor open networks.',
      yaml: [
        'simulation:',
        '  count: 1024',
        '  minGridSize: 5.0',
        '  dT: 0.01',
        '  conversionRate: 50',
        '  maxVelocity: 1.0',
        '  maxForce: 100000.0',
        '  threeDimensions: false',
        '  passesPerFrame: 50',
        '  size:',
        '    width: 1000',
        '    height: 1000',
        'particles:',
        '  silicon:',
        '    color: ffd166',
        '    radius: 2.2',
        '    distribution: 1',
        'interactions:',
        '  tersoff_simple:',
        '    silicon-silicon: { beta: 0.33675, n: 22.956, A: 3264.7, B: 95.373, lambda1: 3.2394, lambda2: 1.3258 }',
      ].join('\n'),
    },
    {
      id: 'gravity-condensation',
      filename: 'gravity-condensation.yml',
      tagZh: '2D · 重力+Morse',
      tagEn: '2D · Gravity',
      nameZh: '重力沉降与凝聚',
      nameEn: 'Gravity & Condensation',
      summaryZh: '8,192 个粒子同时受向下恒定重力场与短程莫尔斯吸引，观察微液滴沉降、融合与壁面堆积。',
      summaryEn: '8,192 particles combine constant downward gravity with short-range Morse attraction to form settling, coalescing droplets.',
      yaml: [
        'simulation:',
        '  count: 8192',
        '  minGridSize: 4.0',
        '  dT: 0.005',
        '  maxVelocity: 1.5',
        '  maxForce: 100000.0',
        '  threeDimensions: false',
        '  passesPerFrame: 80',
        '  size:',
        '    width: 1000',
        '    height: 1000',
        'particles:',
        '  droplet:',
        '    color: 8bf2b2',
        '    radius: 2.0',
        '    distribution: 1',
        'interactions:',
        '  gravity:',
        '    droplet: { force: 0.005 }',
        '  morse:',
        '    droplet-droplet: { De: 0.1, a: 20.0, re: 5.0 }',
      ].join('\n'),
    },
    {
      id: '3d-gas',
      filename: '3d-lj-box.yml',
      tagZh: '3D · 混合气体',
      tagEn: '3D · Mixture',
      nameZh: '三维 LJ 混合流体',
      nameEn: '3D LJ Mixture',
      summaryZh: '开启 threeDimensions 的 4,096 粒子双组分立方模拟盒，可用鼠标拖拽环绕观察三维相分离与热运动。',
      summaryEn: '4,096-particle 3D binary Lennard-Jones box (threeDimensions: true) with mouse orbit camera for exploring 3D clustering.',
      yaml: [
        'simulation:',
        '  count: 4096',
        '  minGridSize: 8.0',
        '  dT: 0.004',
        '  maxVelocity: 2.5',
        '  maxForce: 50000.0',
        '  targetVelocity: 0.5',
        '  targetVelocityStrength: 0.05',
        '  threeDimensions: true',
        '  passesPerFrame: 40',
        '  size:',
        '    width: 220',
        '    height: 220',
        '    depth: 220',
        'particles:',
        '  gas:',
        '    color: a992ff',
        '    radius: 1.8',
        '    distribution: 1',
        '  heavy:',
        '    color: ffae57',
        '    radius: 2.4',
        '    distribution: 0.35',
        'interactions:',
        '  lennardJones:',
        '    gas-gas: { sigma: 3.0, epsilon: 1.0 }',
        '    gas-heavy: { sigma: 3.6, epsilon: 1.6 }',
        '    heavy-heavy: { sigma: 4.2, epsilon: 2.2 }',
      ].join('\n'),
    },
  ];

  function parseRecentProjectsYaml(raw) {
    if (!raw || typeof raw !== 'string') return [];
    var trimmed = raw.trim();
    if (!trimmed || trimmed === '[]') return [];
    var out = [];
    var lines = trimmed.split(/\r?\n/);
    for (var i = 0; i < lines.length; i++) {
      var m = /^\s*-\s+(.+?)\s*$/.exec(lines[i]);
      if (!m) continue;
      var item = m[1].trim();
      if ((item[0] === '"' && item[item.length - 1] === '"') || (item[0] === "'" && item[item.length - 1] === "'")) {
        item = item.slice(1, -1).replace(/\\"/g, '"').replace(/\\'/g, "'");
      }
      if (item && out.indexOf(item) < 0) out.push(item);
    }
    return out;
  }

  function encodeRecentProjectsYaml(paths) {
    if (!paths || !paths.length) return '[]';
    var unique = [];
    for (var i = 0; i < paths.length; i++) {
      var p = String(paths[i] || '').trim();
      if (p && unique.indexOf(p) < 0) unique.push(p);
    }
    if (!unique.length) return '[]';
    return unique.map(function (p) {
      return '- "' + p.replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
    }).join('\n');
  }

  function buildPresetStoragePatch(preset, existingRecentYaml) {
    if (!preset || !preset.filename || !preset.yaml) {
      throw new Error('Invalid preset object');
    }
    var prev = parseRecentProjectsYaml(existingRecentYaml);
    var next = [preset.filename].concat(prev.filter(function (p) { return p !== preset.filename; }));
    return {
      projectKey: STORAGE_KEYS.PROJECT_PREFIX + preset.filename,
      yaml: preset.yaml,
      recentKey: STORAGE_KEYS.RECENT_KEY,
      recentYaml: encodeRecentProjectsYaml(next),
    };
  }

  function applyPresetToStorage(storage, preset) {
    var existing = storage.getItem(STORAGE_KEYS.RECENT_KEY);
    var patch = buildPresetStoragePatch(preset, existing);
    storage.setItem(patch.projectKey, patch.yaml);
    storage.setItem(patch.recentKey, patch.recentYaml);
    return patch;
  }

  function clearRecentPreset(storage) {
    storage.setItem(STORAGE_KEYS.RECENT_KEY, '[]');
  }

  function activePresetId(storage) {
    var recent = parseRecentProjectsYaml(storage.getItem(STORAGE_KEYS.RECENT_KEY));
    if (!recent.length) return null;
    for (var i = 0; i < PRESETS.length; i++) {
      if (PRESETS[i].filename === recent[0]) return PRESETS[i].id;
    }
    return null;
  }

  var api = {
    STORAGE_KEYS: STORAGE_KEYS,
    PRESETS: PRESETS,
    parseRecentProjectsYaml: parseRecentProjectsYaml,
    encodeRecentProjectsYaml: encodeRecentProjectsYaml,
    buildPresetStoragePatch: buildPresetStoragePatch,
    applyPresetToStorage: applyPresetToStorage,
    clearRecentPreset: clearRecentPreset,
    activePresetId: activePresetId,
  };

  root.MOLASTRIA_PARTICLES = api;
  if (typeof module !== 'undefined' && module.exports) {
    module.exports = api;
  }
})(typeof window !== 'undefined' ? window : globalThis);
