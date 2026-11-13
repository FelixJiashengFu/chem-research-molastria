/* 小宠物的 3D 舞台：three.js（jsDelivr 按需载入，版本写死），把三个吉祥物按体素一块一块搭出来。
   造型照站长给的源文件（三个吉祥物交付包 source/index.html 的 makeBud / makeHex）：同样的格子、同样的颜色，
   只是拆成了几块（腿、手、眼睛、卷须、轨道上的小行星、四角星），这样能眨眼、蹦跳、转圈、睡觉。
   载不到 three.js 或者没有 WebGL 时 create() 抛错，pet.js 改用静态图片。 */
(() => {
  'use strict';
  const THREE_VERSION = '0.170.0';
  const THREE_SRC = `https://cdn.jsdelivr.net/npm/three@${THREE_VERSION}/build/three.module.min.js`;
  let loading = null;
  const load = () => {
    if (!loading) loading = import(THREE_SRC).catch((e) => { loading = null; throw e; });
    return loading;
  };

  const EYE = '#17151C', PINK = '#FF9EB5', CORAL = '#F29C7C';
  const PALS = {
    budi: { a: '#F8E9BC', b: '#D9A53C', G: '#2F9468', DG: '#1C6B4A', T: '#E9C36A', plain: false },
    'budi-plain': { a: '#F8E9BC', b: '#F8E9BC', G: '#2F9468', DG: '#2F9468', T: '#D9A53C', plain: true },
    // 两只按真花配的色（站长 2026-11-12 给的照片）：face 是脸上那块的颜色（深色身体上眼睛要看得见），base[i] 盖掉第 i 层的底色
    'budi-midnight': { a: '#361A55', b: '#EFE4B0', face: '#F4EBCB', G: '#2F9468', DG: '#1C6B4A', T: '#E6D59A', plain: false },
    'budi-rose': { a: '#DE3F7C', b: '#F383AB', face: '#FDF1F4', base: [0, 0, '#FDF1F4', '#FDF1F4', '#FDF1F4', '#FDF1F4', '#F6B3CA'], G: '#2F9468', DG: '#1C6B4A', T: '#9BC76A', plain: false },
  };

  function create(T, canvas, opts = {}) {
    const reduce = !!opts.reduce;
    const renderer = new T.WebGLRenderer({ canvas, antialias: true, alpha: true });
    renderer.setPixelRatio(Math.min(2, window.devicePixelRatio || 1));
    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = T.PCFSoftShadowMap;
    renderer.outputColorSpace = T.SRGBColorSpace;
    renderer.toneMapping = T.NeutralToneMapping;
    renderer.setClearColor(0x000000, 0);

    const scene = new T.Scene();
    const cam = new T.PerspectiveCamera(26, 1, 0.1, 400);
    const hemi = new T.HemisphereLight(0xfff8ee, 0xb9b2a6, 1.55);
    scene.add(hemi);
    const sun = new T.DirectionalLight(0xfff3e0, 2.4);
    sun.position.set(-14, 26, 16);
    sun.castShadow = true;
    sun.shadow.mapSize.set(1024, 1024);
    sun.shadow.bias = -0.0004;
    sun.shadow.normalBias = 0.05;
    Object.assign(sun.shadow.camera, { left: -18, right: 18, top: 26, bottom: -6, near: 1, far: 90 });
    scene.add(sun);
    const fill = new T.DirectionalLight(0xe9e6ff, 0.5);
    fill.position.set(18, 8, 10);
    scene.add(fill);

    const mats = new Map();
    const mat = (c, extra) => {
      const k = c + (extra ? JSON.stringify(extra) : '');
      if (!mats.has(k)) mats.set(k, new T.MeshStandardMaterial({ color: c, roughness: 0.86, metalness: 0, ...extra }));
      return mats.get(k);
    };
    const boxGeo = new T.BoxGeometry(1, 1, 1);
    const disposables = [boxGeo];

    // ── 体素积木：每一块（part）自己去掉相邻格子之间看不见的面，再按颜色合成一个网格；单独的小方块按颜色用 InstancedMesh。
    function Builder() {
      const parts = new Map();
      const part = (name, pivot = [0, 0, 0]) => {
        if (!parts.has(name)) parts.set(name, { pivot, vox: new Map(), boxes: [], extra: [] });
        return parts.get(name);
      };
      const K = (x, y, z) => `${Math.round(x * 2)},${Math.round(y * 2)},${Math.round(z * 2)}`;
      const vox = (p, x, y, z, c) => part(p).vox.set(K(x, y, z), { x, y, z, c });
      const box = (p, x, y, z, c, sx = 1, sy = 1, sz = 1, m) => part(p).boxes.push({ x, y, z, c, sx, sy, sz, m });
      const F = [[1, 0, 0], [-1, 0, 0], [0, 1, 0], [0, -1, 0], [0, 0, 1], [0, 0, -1]];
      function build() {
        const out = {};
        const root = new T.Group();
        for (const [name, pt] of parts) {
          const g = new T.Group();
          const [px, py, pz] = pt.pivot;
          g.position.set(px, py, pz);
          const byC = {};
          for (const v of pt.vox.values()) for (const [nx, ny, nz] of F) {
            if (pt.vox.has(K(v.x + nx, v.y + ny, v.z + nz))) continue;
            const arr = (byC[v.c] ||= { p: [], n: [] });
            const u = nx ? [0, 1, 0] : [1, 0, 0], w = nx || ny ? [0, 0, 1] : [0, 1, 0];
            const c = [v.x + nx / 2 - px, v.y + ny / 2 - py, v.z + nz / 2 - pz];
            const at = (su, sw) => [c[0] + u[0] * su / 2 + w[0] * sw / 2, c[1] + u[1] * su / 2 + w[1] * sw / 2, c[2] + u[2] * su / 2 + w[2] * sw / 2];
            let q = [at(-1, -1), at(1, -1), at(1, 1), at(-1, 1)];
            const e1 = q[1].map((a, i) => a - q[0][i]), e2 = q[2].map((a, i) => a - q[0][i]);
            const cr = [e1[1] * e2[2] - e1[2] * e2[1], e1[2] * e2[0] - e1[0] * e2[2], e1[0] * e2[1] - e1[1] * e2[0]];
            if (cr[0] * nx + cr[1] * ny + cr[2] * nz < 0) q = [q[0], q[3], q[2], q[1]];
            for (const i of [0, 1, 2, 0, 2, 3]) { arr.p.push(...q[i]); arr.n.push(nx, ny, nz); }
          }
          for (const [c, a] of Object.entries(byC)) {
            const geo = new T.BufferGeometry();
            geo.setAttribute('position', new T.Float32BufferAttribute(a.p, 3));
            geo.setAttribute('normal', new T.Float32BufferAttribute(a.n, 3));
            disposables.push(geo);
            const m = new T.Mesh(geo, mat(c));
            m.castShadow = m.receiveShadow = true;
            g.add(m);
          }
          const byBox = {};
          for (const b of pt.boxes) (byBox[b.c + (b.m ? JSON.stringify(b.m) : '')] ||= []).push(b);
          const dummy = new T.Object3D();
          for (const list of Object.values(byBox)) {
            const im = new T.InstancedMesh(boxGeo, mat(list[0].c, list[0].m), list.length);
            list.forEach((b, i) => {
              dummy.position.set(b.x - px, b.y - py, b.z - pz);
              dummy.scale.set(b.sx, b.sy, b.sz);
              dummy.updateMatrix();
              im.setMatrixAt(i, dummy.matrix);
            });
            im.castShadow = !list[0].m;
            im.receiveShadow = true;
            g.add(im);
          }
          for (const x of pt.extra) g.add(x);
          out[name] = g;
          root.add(g);
        }
        return { root, parts: out };
      }
      return { part, vox, box, build };
    }

    // ── 苞苞：照 makeBud 搭，腿、手、眼睛、腮红、卷须各是一块。
    function makeBud(kind) {
      const pal = PALS[kind] || PALS.budi;
      const B = Builder();
      const G = pal.G, DG = pal.DG;
      B.part('legL', [-1.5, 2, 0]); B.part('legR', [2.5, 2, 0]);
      for (const [lx, p] of [[-2.5, 'legL'], [1.5, 'legR']]) for (let y = 0; y < 2; y++) for (const dx of [0, 1]) for (const z of [-0.5, 0.5]) B.vox(p, lx + dx, y + 0.5, z, DG);
      const widths = [8, 8, 8, 8, 8, 8, 8, 7, 6, 5, 4, 3, 2], lean = [0, 0, 0, 0, 0, 0, 0, 0.5, 0.5, 1, 1, 1.5, 1.5];
      const y0 = 2, N = widths.length, top = y0 + N - 1;
      let tipC = 0;
      B.part('body');
      for (let i = 0; i < N; i++) {
        const w = widths[i], c = lean[i], y = y0 + i;
        for (let ix = 0; ix < w; ix++) for (let iz = 0; iz < w; iz++) {
          const x = c - w / 2 + ix + 0.5, z = -w / 2 + iz + 0.5;
          const ex = Math.abs(x - c), ez = Math.abs(z);
          if (w >= 5 && ex > w / 2 - 1 && ez > w / 2 - 1) continue;
          const front = iz === w - 1;
          const th = Math.atan2(z, x - c) / (2 * Math.PI);
          const v = ((th * 2 + i * 0.11) % 1 + 1) % 1;
          let col = v < 0.3 ? pal.b : pal.a;
          if (pal.base?.[i]) col = pal.base[i];
          if (i >= 4 && i <= 6 && front && Math.abs(x) < 3.6) col = pal.face || pal.a;
          if (i <= 1) col = G;
          if (i === 2) {
            const per = ex > w / 2 - 1.01 || ez > w / 2 - 1.01;
            const k = Math.round(x + 0.5) + Math.round(z + 0.5);
            if (per && ((k % 2) + 2) % 2 === 0) col = G;
          }
          B.vox('body', x, y + 0.5, z, col);
        }
        if (i === N - 1) tipC = c;
      }
      B.part('armL', [-4, 3.5, 0.5]); B.part('armR', [4, 3.5, 0.5]);
      for (const [s, p] of [[-1, 'armL'], [1, 'armR']]) { B.vox(p, s * 4.5, 3.5, 0.5, G); B.vox(p, s * 5.5, 3.5, 0.5, G); B.vox(p, s * 5.5, 4.5, 0.5, G); }
      const fz = 4.04;
      B.part('eyes', [0, 8.6, fz]);
      for (const ex of [-1.5, 1.5]) B.box('eyes', ex, 8.6, fz, EYE, 0.8, 1.15, 0.12);
      if (!pal.plain) { B.part('body'); for (const bx of [-2.6, 2.6]) B.box('body', bx, 7.45, fz, PINK, 1.0, 0.45, 0.1); }
      const s = 0.55, path = [[0, 0], [0, 1], [0.5, 1.6], [1.1, 2.0], [1.8, 2.0], [2.3, 1.6], [2.3, 1.0], [1.8, 0.7], [1.3, 0.9]];
      B.part('tendril', [tipC, top + 1, 0]);
      for (const [dx, dy] of path) B.box('tendril', tipC + dx, top + 1 + dy * s * 1.6 + 0.3, 0, pal.T, s, s, s);
      const built = B.build();
      // 配饰挂的位置：眼睛（护目镜）、头顶（学位帽、光环）、正面（吃东西的地方）
      built.anchor = { eyeY: 8.6, eyeZ: fz, eyeX: 1.5, bandW: 8.3, bandD: 8.3, topX: tipC, topY: top + 1, haloY: 18.5, haloR: 2.4, mouth: [0, 7.2, 4.6], lookY: 8.4, dist: 52, width: 12 };
      return built;
    }

    // ── 星环：照 makeHex 搭；轨道静止，上面的小行星沿着轨道走，四角星一闪一闪。
    function makeHex() {
      const B = Builder();
      const G1 = '#D9A53C', G2 = '#F0CB72', G3 = '#B98428';
      const R = 7.5, cy = 10, S3 = Math.sqrt(3);
      const inHex = (x, y, r) => Math.abs(x) <= S3 / 2 * r && Math.abs(y) <= r - Math.abs(x) / S3;
      const FACE = '#F8E9BC', GRN = '#14503A';
      B.part('body');
      for (let ix = -8; ix < 8; ix++) for (let iy = -8; iy < 8; iy++) {
        const x = ix + 0.5, y = iy + 0.5;
        if (!inHex(x, y, R)) continue;
        const rim = !inHex(x, y, R - 1.75), r = Math.hypot(x, y), ring = r >= 3.25 && r <= 4.45;
        for (const z of [-1.5, -0.5, 0.5, 1.5]) {
          let c = G1;
          if (!rim && z === 1.5) c = r < 3.25 ? FACE : ring ? G1 : GRN;
          if (!rim && z === -1.5) c = ring ? G1 : GRN;
          B.vox('body', x, cy + y, z, c);
        }
        if (rim || ring) { B.vox('body', x, cy + y, 2.5, G2); if (rim) B.vox('body', x, cy + y, -2.5, G2); }
      }
      B.part('legL', [-2, 4, 0]); B.part('legR', [3, 4, 0]);
      for (const [lx, p] of [[-3, 'legL'], [2, 'legR']]) for (let y = 0; y < 4; y++) for (const dx of [0, 1]) for (const z of [-0.5, 0.5]) B.vox(p, lx + dx + 0.5, y + 0.5, z, G3);
      B.part('armL', [-6, cy - 0.5, 0.5]); B.part('armR', [6, cy - 0.5, 0.5]);
      for (const [s, p] of [[-1, 'armL'], [1, 'armR']]) { B.vox(p, s * 6.5, cy - 0.5, 0.5, G3); B.vox(p, s * 7.5, cy - 0.5, 0.5, G3); B.vox(p, s * 7.5, cy + 0.5, 0.5, G3); }
      B.part('eyes', [0, cy + 0.45, 2.04]);
      for (const ex of [-1.5, 1.5]) B.box('eyes', ex, cy + 0.45, 2.04, EYE, 0.8, 1.15, 0.12);
      for (const bx of [-2.45, 2.45]) B.box('body', bx, cy - 0.75, 2.04, CORAL, 0.9, 0.42, 0.1);
      const a = 12.4, b = 7, ua = 22 * Math.PI / 180, u = [Math.cos(ua), Math.sin(ua), 0], vv = [0, -0.75, 0.66];
      const orb = (t) => [a * Math.cos(t) * u[0] + b * Math.sin(t) * vv[0], cy + a * Math.cos(t) * u[1] + b * Math.sin(t) * vv[1], a * Math.cos(t) * u[2] + b * Math.sin(t) * vv[2]];
      B.part('orbit');
      for (let i = 0; i < 150; i++) { const p = orb(i / 150 * 2 * Math.PI); B.box('orbit', p[0], p[1], p[2], G2, 0.5, 0.5, 0.5); }
      B.box('orbit', a * u[0] * 0.93, cy + a * u[1] * 0.93 - 2.6, 2.2, G2, 1, 1, 1);
      const p0 = orb(Math.PI);
      B.part('planet', p0);
      B.box('planet', p0[0], p0[1], p0[2], G1, 2, 2, 2);
      const q = 0.8, sx = 8.6, sy = cy + 8.2;
      B.part('star', [sx, sy, 0]);
      for (const [dx, dy] of [[0, 0], [0, 1], [0, 2], [0, -1], [0, -2], [1, 0], [2, 0], [-1, 0], [-2, 0]]) B.box('star', sx + dx * q, sy + dy * q, 0, G2, q, q, q);
      const built = B.build();
      built.orb = orb;
      built.anchor = { eyeY: cy + 0.45, eyeZ: 3.05, eyeX: 1.5, bandW: 13.2, bandD: 5.6, topX: 0, topY: cy + R + 0.1, haloY: cy + R + 3.4, haloR: 2.8, mouth: [0, cy - 1, 3.4], lookY: 10.5, dist: 64, width: 26 };
      return built;
    }

    // ── 配饰：护目镜、学位帽、星光环。
    function makeAcc(id, an) {
      const B = Builder();
      if (id === 'goggles') {
        const STRAP = '#1C6B4A', FRAME = '#B98428';
        B.part('acc');
        const y = an.eyeY, z = an.eyeZ + 0.25;
        B.box('acc', 0, y, z - 0.05, STRAP, an.bandW, 0.5, 0.25);
        B.box('acc', 0, y, -an.bandD / 2 - 0.15, STRAP, an.bandW, 0.5, 0.25);
        for (const s of [-1, 1]) B.box('acc', s * (an.bandW / 2), y, 0, STRAP, 0.25, 0.5, an.bandD + 0.3);
        for (const s of [-1, 1]) {
          const x = s * an.eyeX;
          B.box('acc', x, y + 0.95, z + 0.2, FRAME, 2.1, 0.3, 0.3);
          B.box('acc', x, y - 0.95, z + 0.2, FRAME, 2.1, 0.3, 0.3);
          B.box('acc', x - 0.9, y, z + 0.2, FRAME, 0.3, 2.2, 0.3);
          B.box('acc', x + 0.9, y, z + 0.2, FRAME, 0.3, 2.2, 0.3);
          B.box('acc', x, y, z + 0.2, '#9FD8F5', 1.5, 1.6, 0.08, { transparent: true, opacity: 0.38, roughness: 0.15 });
        }
      } else if (id === 'cap') {
        const INK = '#17151C', GOLD = '#E9C36A';
        B.part('acc', [an.topX, an.topY, 0]);
        const x = an.topX, y = an.topY;
        B.box('acc', x, y + 0.55, 0, INK, 2.8, 1.1, 2.8);
        B.box('acc', x, y + 1.25, 0, INK, 5.2, 0.32, 5.2);
        B.box('acc', x, y + 1.5, 0, GOLD, 0.5, 0.2, 0.5);
        for (let i = 0; i < 5; i++) B.box('acc', x + 0.25 + i * 0.5, y + 1.42, 0.25 + i * 0.5, GOLD, 0.25, 0.14, 0.25);
        for (let i = 0; i < 4; i++) B.box('acc', x + 2.45, y + 1.1 - i * 0.45, 2.45, GOLD, 0.24, 0.45, 0.24);
        B.box('acc', x + 2.45, y - 0.8, 2.45, GOLD, 0.45, 0.6, 0.45);
      } else if (id === 'halo') {
        const GOLD = '#F0CB72';
        B.part('acc', [an.topX, an.haloY, 0]);
        const n = 22;
        for (let i = 0; i < n; i++) {
          const t = i / n * 2 * Math.PI;
          B.box('acc', an.topX + Math.cos(t) * an.haloR, an.haloY, Math.sin(t) * an.haloR, GOLD, 0.45, 0.45, 0.45, { emissive: '#B98428', emissiveIntensity: 0.6 });
        }
        for (const t of [0.3, 2.4, 4.4]) B.box('acc', an.topX + Math.cos(t) * (an.haloR + 0.9), an.haloY + 0.7, Math.sin(t) * (an.haloR + 0.9), '#FFF4DA', 0.3, 0.3, 0.3, { emissive: '#F0CB72', emissiveIntensity: 0.9 });
      }
      return B.build().parts.acc;
    }

    // ── 零食和球。
    function makeSnack(id) {
      const g = new T.Group();
      if (id === 'water') {
        const o = new T.Mesh(boxGeo, mat('#E8505B')); o.scale.setScalar(1.4); g.add(o);
        const ang = 104.5 / 2 * Math.PI / 180;
        for (const s of [-1, 1]) { const h = new T.Mesh(boxGeo, mat('#F7F4EE')); h.scale.setScalar(0.85); h.position.set(s * Math.sin(ang) * 1.35, -Math.cos(ang) * 1.35, 0); g.add(h); }
      } else if (id === 'c60') {
        const geo = new T.IcosahedronGeometry(1.15, 1);
        disposables.push(geo);
        g.add(new T.Mesh(geo, mat('#34323C', { flatShading: true, roughness: 0.5 })));
      } else {
        for (let i = 0; i < 6; i++) { const t = i / 6 * 2 * Math.PI; const m = new T.Mesh(boxGeo, mat(i % 2 ? '#D9A53C' : '#F0CB72')); m.scale.setScalar(0.8); m.position.set(Math.cos(t) * 1.15, Math.sin(t) * 1.15, 0); g.add(m); }
        const c = new T.Mesh(boxGeo, mat('#F8E9BC')); c.scale.set(1.2, 1.2, 0.5); g.add(c);
      }
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      return g;
    }
    function makeBall() {
      const g = new T.Group();
      const geo = new T.SphereGeometry(0.7, 20, 14), ring = new T.TorusGeometry(1.25, 0.12, 8, 36);
      disposables.push(geo, ring);
      g.add(new T.Mesh(geo, mat('#F0CB72', { emissive: '#D9A53C', emissiveIntensity: 0.5 })));
      const r1 = new T.Mesh(ring, mat('#9FD8F5', { emissive: '#4A9BC4', emissiveIntensity: 0.4 })); r1.rotation.x = 1.1; g.add(r1);
      const r2 = new T.Mesh(ring, mat('#9FD8F5', { emissive: '#4A9BC4', emissiveIntensity: 0.4 })); r2.rotation.y = 1.2; g.add(r2);
      g.traverse((m) => { if (m.isMesh) m.castShadow = true; });
      return g;
    }

    // ── 脚下的小草地：一圈体素，阴影落在上面。
    const island = (() => {
      const cells = [];
      for (let x = -9; x <= 9; x++) for (let z = -7; z <= 7; z++) if ((x / 9.6) ** 2 + (z / 7.6) ** 2 <= 1) cells.push([x, z]);
      const im = new T.InstancedMesh(boxGeo, new T.MeshStandardMaterial({ roughness: 0.9 }), cells.length);
      disposables.push(im.material);
      const d = new T.Object3D(), col = new T.Color();
      cells.forEach(([x, z], i) => {
        const edge = (x / 9.6) ** 2 + (z / 7.6) ** 2 > 0.72;
        d.position.set(x, edge ? -0.62 : -0.5, z); d.scale.set(1, 1, 1); d.updateMatrix(); im.setMatrixAt(i, d.matrix);
        im.setColorAt(i, col.set((x * 7 + z * 13) % 5 === 0 ? '#3FA877' : edge ? '#1C6B4A' : (x + z) % 2 ? '#2F9468' : '#2A8A60'));
      });
      im.receiveShadow = true;
      return im;
    })();
    scene.add(island);

    // ── 状态
    let pet = null, kind = '', acc = '', accMesh = null, asleep = false, moodNow = 'ok';
    let anim = null, snack = null, ball = null;
    let yawUser = 0, yawLook = 0, yawNow = 0, lastTouch = 0, blinkAt = 0;
    const clock0 = performance.now();

    function setKind(k) {
      if (k === kind && pet) return;
      if (pet) scene.remove(pet.root);
      kind = k;
      pet = k === 'astra' ? makeHex() : makeBud(k);
      scene.add(pet.root);
      const a = acc; acc = ''; accMesh = null; setAcc(a);
      frame();
    }
    function setAcc(id) {
      if (accMesh) { accMesh.parent?.remove(accMesh); accMesh = null; }
      acc = id || '';
      if (acc && pet) { accMesh = makeAcc(acc, pet.anchor); pet.root.add(accMesh); }
      frame();
    }
    function setMood(m) { moodNow = m; asleep = m === 'sleeping'; }
    function play(type, arg) {
      if (snack) { scene.remove(snack); snack = null; }
      if (ball) { scene.remove(ball); ball = null; }
      const dur = { pet: 700, feed: 1700, play: 1900, levelup: 1300, wake: 600, sleep: 700, hello: 1100, refuse: 650 }[type] || 800;
      anim = { type, t0: performance.now(), dur: reduce ? Math.min(dur, 500) : dur };
      if (type === 'feed') { snack = makeSnack(arg); scene.add(snack); }
      if (type === 'play') { ball = makeBall(); scene.add(ball); }
      start();
    }

    // 摄像机：按画布的宽高比和配饰调整距离，整只宠物（连轨道和帽子）都在画面里。
    let W = 0, H = 0;
    function resize() {
      const r = canvas.getBoundingClientRect();
      W = Math.max(1, Math.round(r.width)); H = Math.max(1, Math.round(r.height));
      renderer.setSize(W, H, false);
      cam.aspect = W / H;
      cam.updateProjectionMatrix();
      frame();
    }
    function placeCam() {
      const an = pet.anchor;
      const lift = acc === 'halo' ? 1.6 : acc === 'cap' ? 0.9 : 0;
      const lookY = an.lookY + lift - 0.8;
      let dist = (an.dist + lift * 2) * 1.12;
      const needW = an.width / 2 + 4, halfW = Math.tan((cam.fov / 2) * Math.PI / 180) * dist * cam.aspect;
      if (halfW < needW) dist *= needW / halfW;
      const e = 13 * Math.PI / 180;
      cam.position.set(0, lookY + dist * Math.sin(e), dist * Math.cos(e));
      cam.lookAt(0, lookY, 0);
    }

    // ── 每一帧
    let raf = 0, visible = true;
    const ease = (x) => 1 - (1 - x) ** 3;
    function frame() { if (!raf && pet) raf = requestAnimationFrame(tick); }
    function start() { frame(); }
    function tick(now) {
      raf = 0;
      if (!pet) return;
      const t = (now - clock0) / 1000;
      const P = pet.parts, root = pet.root;
      let y = 0, sx = 1, sy = 1, spin = 0, tilt = 0, armL = 0, armR = 0, legL = 0, legR = 0;
      if (!reduce) {
        const br = asleep ? Math.sin(t * 1.4) * 0.018 : Math.sin(t * 2.3) * 0.016;
        sy += br; sx -= br / 2;
        if (moodNow === 'happy') { armL = Math.sin(t * 3.1) * 0.25; armR = -armL; }
        if (moodNow === 'hungry' || moodNow === 'sad') tilt = 0.06;
        if (asleep) tilt = 0.1;
      }
      if (anim) {
        const e = Math.min(1, (now - anim.t0) / anim.dur);
        const hop = (h, a = 0, b = 1) => { if (e < a || e > b) return; const k = (e - a) / (b - a); y += h * Math.sin(Math.PI * k); sy *= 1 - 0.12 * Math.cos(2 * Math.PI * k); sx *= 1 + 0.06 * Math.cos(2 * Math.PI * k); };
        if (anim.type === 'pet' || anim.type === 'wake') { hop(anim.type === 'pet' ? 2.2 : 1.2); armL = -0.6 * Math.sin(Math.PI * e); armR = -armL; }
        else if (anim.type === 'hello') { hop(2, 0, 0.5); hop(1.4, 0.5, 1); armR = -0.9 * Math.sin(Math.PI * e * 3); }
        else if (anim.type === 'refuse') { spin = 0.35 * Math.sin(e * Math.PI * 4) * (1 - e); }
        else if (anim.type === 'sleep') { sy *= 1 - 0.05 * ease(e); }
        else if (anim.type === 'levelup') { hop(4.5); spin = 2 * Math.PI * ease(e); armL = -1.2 * Math.sin(Math.PI * e); armR = -armL; }
        else if (anim.type === 'feed' && snack) {
          const m = pet.anchor.mouth;
          if (e < 0.45) { const k = ease(e / 0.45); snack.position.set(m[0], m[1] + 14 * (1 - k), m[2] + 3); snack.rotation.set(0, k * 6, 0.3); snack.scale.setScalar(1); }
          else { const k = Math.min(1, (e - 0.45) / 0.2); snack.position.set(m[0], m[1], m[2] + 3 - 2.4 * k); snack.scale.setScalar(Math.max(0.001, 1 - k)); }
          if (e > 0.6) { const k = (e - 0.6) / 0.4; sy *= 1 - 0.08 * Math.abs(Math.sin(k * Math.PI * 3)); sx *= 1 + 0.05 * Math.abs(Math.sin(k * Math.PI * 3)); }
        } else if (anim.type === 'play' && ball) {
          const an = pet.anchor, top = an.haloY + 2;
          if (e < 0.4) { const k = e / 0.4; ball.position.set(-12 + 12 * k, 4 + (top + 2 - 4) * Math.sin(Math.PI * k * 0.5) * 1.1, 6 - 6 * k); }
          else if (e < 0.75) { const k = (e - 0.4) / 0.35; ball.position.set(Math.sin(k * Math.PI * 2) * 3, top + 2 - 3 * k, Math.cos(k * Math.PI * 2) * 3); }
          else { const k = (e - 0.75) / 0.25; ball.position.set(0, top - 1 - (top - an.lookY) * k, 0); ball.scale.setScalar(Math.max(0.001, 1 - k)); }
          ball.rotation.y = t * 4; ball.rotation.x = t * 2.5;
          hop(4, 0.42, 0.95);
          if (e > 0.42 && e < 0.95) spin = 2 * Math.PI * ease((e - 0.42) / 0.53);
          legL = 0.4 * Math.sin(e * Math.PI * 6); legR = -legL;
        }
        if (e >= 1) {
          if (snack) { scene.remove(snack); snack = null; }
          if (ball) { scene.remove(ball); ball = null; }
          anim = null;
        }
      }
      // 视线：鼠标在舞台上时转过去看一点；拖动的角度过 4 秒慢慢回正。
      if (now - lastTouch > 4000) yawUser *= 0.94;
      const want = yawUser + (asleep ? 0 : yawLook);
      yawNow += (want - yawNow) * (reduce ? 1 : 0.12);
      root.position.y = y;
      root.scale.set(sx, sy, sx);
      root.rotation.set(tilt, yawNow + spin, 0);
      if (P.armL) P.armL.rotation.z = armL;
      if (P.armR) P.armR.rotation.z = armR;
      if (P.legL) P.legL.rotation.x = legL;
      if (P.legR) P.legR.rotation.x = legR;
      if (P.eyes) {
        if (!blinkAt) blinkAt = now + 2500 + Math.random() * 3000;
        let ey = 1;
        if (asleep) ey = 0.14;
        else if (!reduce && now > blinkAt) { const k = (now - blinkAt) / 160; if (k >= 1) blinkAt = now + 2500 + Math.random() * 3500; else ey = 1 - 0.85 * Math.sin(Math.PI * k); }
        P.eyes.scale.y = ey;
      }
      if (!reduce) {
        if (P.tendril) P.tendril.rotation.z = Math.sin(t * 1.7) * 0.12;
        if (P.planet && pet.orb) { const p = pet.orb(Math.PI + t * 0.35), p0 = pet.orb(Math.PI); P.planet.position.set(p0[0] + (p[0] - p0[0]), p[1], p[2]); P.planet.rotation.y = t; }
        if (P.star) { const k = 1 + 0.12 * Math.sin(t * 3.3); P.star.scale.set(k, k, k); P.star.rotation.z = Math.sin(t * 0.9) * 0.15; }
        if (accMesh && acc === 'halo') accMesh.rotation.y = t * 0.6;
      }
      placeCam();
      renderer.render(scene, cam);
      const moving = visible && (!reduce || anim);
      if (moving) raf = requestAnimationFrame(tick);
    }

    // ── 指针：拖动转身；轻点（没拖动）算摸摸。
    let down = null;
    const onDown = (e) => { down = { x: e.clientX, y: e.clientY, yaw: yawUser, moved: false }; lastTouch = performance.now(); try { canvas.setPointerCapture(e.pointerId); } catch { /* ignore */ } };
    const onMove = (e) => {
      const r = canvas.getBoundingClientRect();
      if (down) {
        const dx = e.clientX - down.x;
        if (Math.abs(dx) + Math.abs(e.clientY - down.y) > 6) down.moved = true;
        if (down.moved) { yawUser = down.yaw + dx * 0.012; lastTouch = performance.now(); frame(); }
      } else if (e.pointerType === 'mouse' && r.width) {
        yawLook = Math.max(-0.5, Math.min(0.5, ((e.clientX - r.left) / r.width - 0.5) * 1.1));
        frame();
      }
    };
    const onUp = (e) => {
      if (down && !down.moved) opts.onTap?.(e);
      down = null;
    };
    const onLeave = () => { yawLook = 0; frame(); };
    canvas.addEventListener('pointerdown', onDown);
    canvas.addEventListener('pointermove', onMove);
    canvas.addEventListener('pointerup', onUp);
    canvas.addEventListener('pointercancel', () => { down = null; });
    canvas.addEventListener('pointerleave', onLeave);
    const ro = new ResizeObserver(resize);
    ro.observe(canvas);
    const io = new IntersectionObserver((es) => { visible = es.some((x) => x.isIntersecting) && !document.hidden; frame(); });
    io.observe(canvas);
    const onVis = () => { visible = !document.hidden; frame(); };
    document.addEventListener('visibilitychange', onVis);

    function setTheme(dark) {
      hemi.groundColor.set(dark ? 0x6f8a7c : 0xb9b2a6);
      frame();
    }
    function dispose() {
      cancelAnimationFrame(raf); raf = 0; pet = null;
      ro.disconnect(); io.disconnect();
      document.removeEventListener('visibilitychange', onVis);
      for (const d of disposables) d.dispose?.();
      for (const m of mats.values()) m.dispose();
      renderer.dispose();
    }
    resize();
    return { setKind, setAcc, setMood, play, resize, setTheme, dispose, get kind() { return kind; }, get acc() { return acc; }, get busy() { return !!anim; } };
  }

  window.MolAstriaPet3D = { load, create, THREE_VERSION };
})();
