// Outer MolAstria UI controller for /particles/: manages preset injection into Particle HIVE localStorage,
// WebGPU status detection, language sync, guide drawer, and iframe reload.
(function () {
  'use strict';

  var api = window.MOLASTRIA_PARTICLES;
  if (!api) return;

  var root = document.documentElement;
  var bar = document.getElementById('pt-bar');
  var summary = document.getElementById('pt-summary');
  var frame = document.getElementById('particles-frame');
  var drawer = document.getElementById('pt-drawer');
  if (!bar || !summary || !frame || !drawer) return;

  var appUrl = 'app/index.html';
  var gpuState = { state: 'checking', labelZh: '检测 WebGPU…', labelEn: 'Checking WebGPU…', detail: '' };
  var drawerOpen = false;
  var copiedTimer = null;

  function isEn() {
    return root.lang === 'en';
  }

  function L(zh, en) {
    return isEn() ? en : zh;
  }

  function esc(s) {
    return String(s).replace(/[&<>"']/g, function (c) {
      return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c];
    });
  }

  function findPreset(id) {
    if (!id) return null;
    for (var i = 0; i < api.PRESETS.length; i++) {
      if (api.PRESETS[i].id === id) return api.PRESETS[i];
    }
    return null;
  }

  function requestedPresetId() {
    var m = /[?&]preset=([a-z0-9-]+)/i.exec(location.search);
    if (m && findPreset(m[1])) return m[1];
    var h = (location.hash || '').replace(/^#\/?/, '');
    if (h && findPreset(h)) return h;
    return null;
  }

  function currentActivePreset() {
    var activeId = api.activePresetId(localStorage);
    return findPreset(activeId);
  }

  function reloadFrame() {
    try {
      if (frame.contentWindow && frame.src) {
        frame.contentWindow.location.replace(appUrl);
        return;
      }
    } catch (_) {
      // Fallback to assigning src below.
    }
    frame.src = appUrl;
  }

  function selectPreset(id, shouldReload) {
    var preset = findPreset(id);
    if (!preset) return;
    api.applyPresetToStorage(localStorage, preset);
    if (typeof window.MolAstriaActivity === 'function') {
      try { window.MolAstriaActivity('play'); } catch (_) {}
    }
    render();
    if (shouldReload) reloadFrame();
  }

  function resetToDefault() {
    api.clearRecentPreset(localStorage);
    render();
    reloadFrame();
  }

  function initStorageAndFrame() {
    var requested = requestedPresetId();
    if (requested) {
      api.applyPresetToStorage(localStorage, findPreset(requested));
    } else if (localStorage.getItem(api.STORAGE_KEYS.RECENT_KEY) === null) {
      // First visit: seed the Lennard-Jones Argon fluid so Particle HIVE starts with an active interaction.
      api.applyPresetToStorage(localStorage, api.PRESETS[0]);
    }
    render();
    frame.src = appUrl;
  }

  function render() {
    var active = currentActivePreset();
    var presetButtons = api.PRESETS.map(function (p) {
      var on = active && active.id === p.id;
      return (
        '<button type="button" class="pt-preset' + (on ? ' is-active' : '') + '"' +
        ' data-preset="' + esc(p.id) + '" aria-pressed="' + (on ? 'true' : 'false') + '">' +
        '<span>' + esc(L(p.nameZh, p.nameEn)) + '</span>' +
        '<small>' + esc(L(p.tagZh, p.tagEn)) + '</small>' +
        '</button>'
      );
    }).join('');

    bar.innerHTML =
      '<div class="pt-head">' +
        '<h1 class="pt-title">' + esc(L('GPU 粒子力场', 'GPU Particle HIVE')) + '</h1>' +
        '<span class="pt-gpu-pill" data-state="' + esc(gpuState.state) + '" title="' + esc(gpuState.detail || '') + '">' +
          esc(L(gpuState.labelZh, gpuState.labelEn)) +
        '</span>' +
      '</div>' +
      '<div class="pt-presets" role="group" aria-label="' + esc(L('物理与化学模拟预设', 'Physics & chemistry simulation presets')) + '">' +
        presetButtons +
      '</div>' +
      '<div class="pt-actions">' +
        '<button type="button" class="pt-btn" id="pt-reset">' + esc(L('恢复默认', 'Reset')) + '</button>' +
        '<button type="button" class="pt-btn" id="pt-guide" aria-expanded="' + (drawerOpen ? 'true' : 'false') + '" aria-controls="pt-drawer">' +
          esc(L('指南与 YAML', 'Guide & YAML')) +
        '</button>' +
        '<a class="pt-btn" href="' + appUrl + '" target="_blank" rel="noopener">' +
          esc(L('新窗口', 'Standalone')) + ' <i class="ico-ext" aria-hidden="true"></i>' +
        '</a>' +
      '</div>';

    if (active) {
      summary.innerHTML =
        '<span><strong>' + esc(L(active.nameZh, active.nameEn)) + '</strong> · ' +
        esc(L(active.summaryZh, active.summaryEn)) + '</span>' +
        '<span class="pt-summary-note">' +
          esc(L('在右侧内置面板中可实时调节力场参数、颜色、聚簇检测与速率统计', 'Use in-canvas panels to tweak live parameters, coloring, clustering, and MSQV stats')) +
        '</span>';
    } else {
      summary.innerHTML =
        '<span><strong>' + esc(L('当前：内置默认或自定义 YAML 配置', 'Active: built-in default or custom YAML project')) + '</strong> · ' +
        esc(L('点击上方预设即可一键注入经典力场算例，或在画布内置 Projects / Config file 中自由编辑。', 'Pick any preset above or edit your own YAML in the built-in Projects / Config file panels.')) +
        '</span>';
    }

    renderDrawer(active);
  }

  function renderDrawer(active) {
    drawer.hidden = !drawerOpen;
    if (!drawerOpen) return;

    var shownPreset = active || api.PRESETS[0];
    drawer.innerHTML =
      '<div class="pt-drawer-head">' +
        '<h2>' + esc(L('Particle HIVE 使用指南与力场原理', 'Particle HIVE Guide & Force Models')) + '</h2>' +
        '<button type="button" class="pt-close" id="pt-close" aria-label="' + esc(L('关闭指南', 'Close guide')) + '">&times;</button>' +
      '</div>' +
      '<section class="pt-sec">' +
        '<h3>' + esc(L('1. 如何在内置面板里交互', '1. Interactive Controls Inside the Canvas')) + '</h3>' +
        '<ul>' +
          '<li>' + L(
            '<strong>视角操作：</strong>2D 模式下中键/右键拖拽平移、滚轮缩放；3D 预设（三维 LJ 混合流体）支持鼠标拖拽旋转视角。',
            '<strong>Camera:</strong> Pan/zoom in 2D presets with drag and scroll; orbit in 3D in the <em>3D LJ Mixture</em> preset.'
          ) + '</li>' +
          '<li>' + L(
            '<strong>Live Parameters &amp; Config file：</strong>左侧栏支持边算边改 <code>count</code>、<code>dT</code>、力场系数或直接编辑 YAML 并重新应用。',
            '<strong>Live Parameters &amp; Config file:</strong> Edit particle count, time step <code>dT</code>, force constants, or full YAML live from the left sidebar.'
          ) + '</li>' +
          '<li>' + L(
            '<strong>Visual options &amp; Simulation Stats：</strong>右侧栏可按粒子类型、速率或受力大小着色，启用 DBSCAN 簇检测与实时均方速率（MSQV）曲线。',
            '<strong>Visual options &amp; Simulation Stats:</strong> Color by type/velocity/force, enable DBSCAN cluster detection, and inspect live MSQV statistics.'
          ) + '</li>' +
        '</ul>' +
      '</section>' +
      '<section class="pt-sec">' +
        '<h3>' + esc(L('2. GPU 计算管线与势函数', '2. GPU Compute Pipeline & Potentials')) + '</h3>' +
        '<p>' + L(
          '每帧在 WebGPU 计算着色器中依次执行：网格空间哈希分桶 &rarr; GPU 双调排序（Bitonic Sort）&rarr; 局部邻域遍历求力与速度 Verlet 积分 &rarr; 粒子渲染。',
          'Each frame runs in WebGPU compute shaders: uniform spatial grid hashing &rarr; GPU bitonic sort &rarr; neighbor-list force accumulation &amp; Velocity Verlet integration &rarr; instanced rendering.'
        ) + '</p>' +
        '<ul>' +
          '<li><code>lennardJones</code>: 24&epsilon;[2(&sigma;/r)<sup>12</sup> &minus; (&sigma;/r)<sup>6</sup>]/r &nbsp;' + esc(L('（稀有气体与非极性液体）', '(noble gases & non-polar fluids)')) + '</li>' +
          '<li><code>morse</code>: &minus;2aD<sub>e</sub>e<sup>&minus;a(r&minus;r<sub>e</sub>)</sup>(1 &minus; e<sup>&minus;a(r&minus;r<sub>e</sub>)</sup>) &nbsp;' + esc(L('（短程成键与自组装）', '(short-range bonding & assembly)')) + '</li>' +
          '<li><code>tersoff_simple</code>: ' + esc(L('依赖局部配位数的简化键序多体势', 'coordination-dependent simplified bond-order many-body potential')) + '</li>' +
          '<li><code>gravity</code>: ' + esc(L('沿 y 轴施加恒定外场重力', 'constant vertical external field along y')) + '</li>' +
        '</ul>' +
      '</section>' +
      '<section class="pt-sec">' +
        '<div class="pt-yaml-head">' +
          '<h3>' + esc(L('3. 当前预设 YAML：', '3. Active Preset YAML: ') + shownPreset.filename) + '</h3>' +
          '<button type="button" class="pt-btn" id="pt-copy-yaml">' + esc(L('复制 YAML', 'Copy YAML')) + '</button>' +
        '</div>' +
        '<pre class="pt-yaml">' + esc(shownPreset.yaml) + '</pre>' +
      '</section>' +
      '<section class="pt-sec">' +
        '<h3>' + esc(L('延伸阅读 · MolAstria 相关模块', 'Further Reading on MolAstria')) + '</h3>' +
        '<div class="pt-links">' +
          '<a class="pt-chip-link" href="../md/index.html">' + esc(L('分子动力学与自由能十章', 'MD & Free Energy (10 Chapters)')) + '</a>' +
          '<a class="pt-chip-link" href="../workbench/index.html">' + esc(L('计算化学工作台', 'Computational Workbench')) + '</a>' +
        '</div>' +
      '</section>' +
      '<div class="pt-credit">' +
        L(
          '致谢与许可：模拟内核集成了 Danielle Voznyy 开源的 <a href="https://github.com/0ffz/particle-hive" target="_blank" rel="noopener">0ffz/particle-hive <i class="ico-ext" aria-hidden="true"></i></a>（<a href="app/LICENSE" target="_blank" rel="noopener">MIT 协议</a>），并包含 MolAstria 贡献的归约越界修复、粒子簇映射修复、网格归一化与 WebGPU 自检优化（上游 PR #11）。',
          'Attribution &amp; License: Powered by <a href="https://github.com/0ffz/particle-hive" target="_blank" rel="noopener">0ffz/particle-hive <i class="ico-ext" aria-hidden="true"></i></a> by Danielle Voznyy (<a href="app/LICENSE" target="_blank" rel="noopener">MIT License</a>), enhanced with GPU reduction bounds fixes, cluster index mapping, wall-bounds safety, and WebGPU pre-check UX (upstream PR #11).'
        ) +
      '</div>';
  }

  bar.addEventListener('click', function (ev) {
    var presetBtn = ev.target.closest('[data-preset]');
    if (presetBtn) {
      selectPreset(presetBtn.getAttribute('data-preset'), true);
      return;
    }
    if (ev.target.closest('#pt-reset')) {
      resetToDefault();
      return;
    }
    if (ev.target.closest('#pt-guide')) {
      drawerOpen = !drawerOpen;
      render();
    }
  });

  drawer.addEventListener('click', function (ev) {
    if (ev.target.closest('#pt-close')) {
      drawerOpen = false;
      render();
      return;
    }
    var copyBtn = ev.target.closest('#pt-copy-yaml');
    if (copyBtn) {
      var shownPreset = currentActivePreset() || api.PRESETS[0];
      if (navigator.clipboard && typeof navigator.clipboard.writeText === 'function') {
        navigator.clipboard.writeText(shownPreset.yaml).then(function () {
          copyBtn.textContent = L('已复制', 'Copied');
          clearTimeout(copiedTimer);
          copiedTimer = setTimeout(function () {
            if (drawerOpen) renderDrawer(currentActivePreset());
          }, 1500);
        }).catch(function () {});
      }
    }
  });

  document.addEventListener('keydown', function (ev) {
    if (ev.key === 'Escape' && drawerOpen) {
      drawerOpen = false;
      render();
    }
  });

  new MutationObserver(function () { render(); }).observe(root, { attributes: true, attributeFilter: ['lang'] });

  (async function probeWebGpu() {
    if (!navigator.gpu || typeof navigator.gpu.requestAdapter !== 'function') {
      gpuState = {
        state: 'warn',
        labelZh: '浏览器未开启 WebGPU',
        labelEn: 'WebGPU Unavailable',
        detail: 'Requires Chrome, Edge, Brave, or Firefox with WebGPU enabled',
      };
      render();
      return;
    }
    try {
      var adapter = await navigator.gpu.requestAdapter();
      if (!adapter) {
        gpuState = {
          state: 'warn',
          labelZh: '无可用 GPU 适配器',
          labelEn: 'No GPU Adapter',
          detail: 'navigator.gpu.requestAdapter() returned null',
        };
      } else {
        var info = adapter.info || {};
        var name = info.description || info.architecture || info.vendor || '';
        gpuState = {
          state: 'ok',
          labelZh: 'WebGPU 就绪',
          labelEn: 'WebGPU Ready',
          detail: name,
        };
      }
    } catch (e) {
      gpuState = {
        state: 'warn',
        labelZh: 'WebGPU 受限',
        labelEn: 'WebGPU Error',
        detail: String(e && e.message || e),
      };
    }
    render();
  })();

  initStorageAndFrame();
})();
