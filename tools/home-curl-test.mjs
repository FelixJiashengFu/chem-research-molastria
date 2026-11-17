// Tests for the page curl of the book of figures on the home page (public/home-curl-models.js): the paper does not
// stretch, the pulled point lands under the finger, the leaf stays bound at the spine, and a finished turn is out of sight.
//   node --test tools/home-curl-test.mjs
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';

const box = { window: {} };
vm.runInNewContext(readFileSync(new URL('../public/home-curl-models.js', import.meta.url), 'utf8'), box);
const C = box.window.MOLASTRIA_CURL;
const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg || ''} ${a} vs ${b}`);
const W = 600, H = 720;
const PULLS = [[[W, 600], [420, 560]], [[W, 600], [100, 520]], [[W, 300], [-200, 300]], [[W, 700], [250, 380]], [[W, 80], [300, 260]], [[W, 650], [580, 640]]];

test('the pulled point lands where it is pulled to (once the paper has gone over the roll)', () => {
  for (const [G, F] of PULLS) {
    const f = C.fold(G, F, W), dist = Math.hypot(G[0] - F[0], G[1] - F[1]);
    const n = [G[0] - F[0], G[1] - F[1]].map((v) => v / dist);
    if (Math.abs(n[1]) > 0.5 + 1e-12 || dist <= Math.PI * f.R) continue; // a steep pull is straightened; see below
    const p = C.map(f, ...G);
    near(p[0], F[0], 1e-9, 'x'); near(p[1], F[1], 1e-9, 'y'); near(p[2], 2 * f.R, 1e-12, 'face down on top');
    assert.equal(p[3], -1);
  }
});

test('the fold never slants more than 30° from the spine', () => {
  for (const [G, F] of PULLS) { const f = C.fold(G, F, W); near(Math.hypot(f.nx, f.ny), 1, 1e-12); assert.ok(Math.abs(f.ny) <= 0.5 + 1e-12 && f.nx > 0); }
});

test('paper does not stretch: lengths across the fold are kept, lengths along it too', () => {
  for (const [G, F] of PULLS) {
    const f = C.fold(G, F, W);
    // A path straight across the fold (along n), from well before it to well beyond the roll.
    const s0 = -50, s1 = Math.PI * f.R + 120, steps = 4000;
    let len = 0, prev = null;
    for (let k = 0; k <= steps; k++) {
      const s = s0 + (s1 - s0) * k / steps, q = C.map(f, f.lx + f.nx * s, f.ly + f.ny * s);
      if (prev) len += Math.hypot(q[0] - prev[0], q[1] - prev[1], q[2] - prev[2]);
      prev = q;
    }
    near(len, s1 - s0, 1e-3 * (s1 - s0), 'across');
    // Along the fold line (any offset): every point moves by the same vector, so distances stay.
    for (const s of [0.3 * f.R, 2 * f.R, Math.PI * f.R + 40]) {
      const a = C.map(f, f.lx + f.nx * s, f.ly + f.ny * s), b = C.map(f, f.lx + f.nx * s - f.ny * 90, f.ly + f.ny * s + f.nx * 90);
      near(Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]), 90, 1e-9, 'along');
    }
  }
});

test('before the fold the page lies flat and untouched; on the roll it rises to 2R and turns over', () => {
  const f = C.fold([W, 600], [300, 600], W);
  for (const [x, y] of [[0, 0], [10, 700], [f.lx - 1, 300]]) assert.deepEqual([...C.map(f, x, y)], [x, y, 0, 1]);
  const top = C.map(f, f.lx + Math.PI * f.R / 2, 300); near(top[2], f.R, 1e-9); near(top[3], 0, 1e-12, 'edge-on at the top of the roll');
  near(top[0], f.lx + f.R, 1e-9, 'the roll reaches out by R');
  assert.equal(C.fold([W, 600], [W, 600], W), null, 'nothing pulled, nothing curls');
});

test('a finished turn leaves nothing on the page; a pull from the start leaves the page as it was', () => {
  const { G } = C.path(0, W, H), f = C.fold(G, C.gone(G), W);
  for (let i = 0; i <= 40; i++) for (let j = 0; j <= 40; j++) assert.ok(C.map(f, i / 40 * W, j / 40 * H)[0] < 0, 'out of sight past the spine');
  const p0 = C.path(0, W, H), p1 = C.path(1, W, H);
  assert.deepEqual([...p0.F], [...p0.G]); near(p1.F[0], -W, 1e-9); near(p1.F[1], p1.G[1], 1e-9);
  // Along the way the roll moves steadily across: progress grows with u.
  let last = -1; for (let u = 0; u <= 1.0001; u += 0.05) { const p = C.path(u, W, H), pr = C.progress(p.G, p.F, W); assert.ok(pr >= last); last = pr; }
});

test('a finger: the free edge follows it, stays bound at the spine, and the release finishes or falls back', () => {
  // Pulling left from near the right edge.
  let p = C.pull(1, W, H, 560, 500, 560, 500); near(p.F[0], W, 0.5, 'at the edge'); near(p.F[1], 500, 0); assert.deepEqual([...p.G], [W, 500]);
  p = C.pull(1, W, H, 560, 500, 360, 470); near(p.F[0], W - 300, 1e-9); near(p.F[1], 500 - 30 * 0.85, 1e-9);
  // However far the hand goes, the pulled point stays within W of the spine point at its height.
  for (const [x, y] of [[-900, 500], [-300, -800], [100, 2000], [-50, 1200]]) {
    for (const dir of [1, -1]) { const q = C.pull(dir, W, H, 300, 500, x, y); assert.ok(Math.hypot(q.F[0], q.F[1] - q.G[1]) <= W + 1e-9); assert.ok(q.F[0] < W); }
  }
  // Back: the previous page starts beyond the spine and comes over as the hand moves right.
  p = C.pull(-1, W, H, 40, 300, 40, 300); near(p.F[0], -W, 1e-9);
  p = C.pull(-1, W, H, 40, 300, 440, 300); near(p.F[0], 0, 1e-9);
  // Release: far enough or a flick finishes; a little way, or a flick back, falls back.
  assert.equal(C.settle(0.5, 0), true); assert.equal(C.settle(0.1, 0), false); assert.equal(C.settle(0.1, 0.6), true);
  assert.equal(C.settle(0.5, -0.5), false);
});

test('the mesh: a grid of the whole page, flat when nothing is pulled', () => {
  const g = C.grid(4, 3); assert.equal(g.uv.length, 5 * 4 * 2); assert.equal(g.idx.length, 4 * 3 * 6); assert.ok(Math.max(...g.idx) === 19);
  const out = C.mesh(null, g.uv, W, H, new Float32Array(80));
  assert.deepEqual([...out.slice(-4)], [W, H, 0, 1]);
});
