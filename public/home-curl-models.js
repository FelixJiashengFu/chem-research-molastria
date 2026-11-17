/* The geometry of a page that curls like paper (used by home-curl.js for the book of figures on the home page; pure
   functions, tested by tools/home-curl-test.mjs).

   Page coordinates: x to the right, y down, in CSS pixels; the spine is the left edge x = 0, the free edge is x = W.
   A turn is described by two points: G, the point of the free edge that is being pulled, and F, where it is now.
   The paper is rolled over a cylinder of radius R whose axis lies on the page:
     n  = the unit vector from F towards G (the direction in which the rolled part lies), its slant limited;
     L  = a point on the fold line, the line where the paper leaves the table;
     d  = (p − L)·n, the distance of a page point p beyond the fold line.
   d ≤ 0: the paper is flat. 0 < d < πR: it runs round the cylinder, at angle θ = d/R: it lands at d' = R sin θ, at
   height z = R(1 − cos θ). d ≥ πR: it has come all the way over and lies face down at height 2R, at d' = πR − d.
   Every such map keeps lengths (paper does not stretch), and L is chosen so that G lands exactly on F. */
(function (root) {
  'use strict';
  const PI = Math.PI;
  const clamp = (x, a, b) => Math.min(b, Math.max(a, x));
  const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a), 0, 1); return t * t * (3 - 2 * t); };
  const SLANT = 0.5; // |n_y| at most: the fold never tilts more than 30° from the spine

  // The cylinder's radius: small while the corner has just lifted, then a steady roll (about a tenth of the page).
  const radius = (dist, W) => Math.max(1.5, clamp(W * 0.1, 22, 64) * smooth(0, W * 0.45, dist));

  // The fold for a pull from G to F on a W-wide page, or null while nothing has lifted.
  function fold(G, F, W) {
    let nx = G[0] - F[0], ny = G[1] - F[1];
    const dist = Math.hypot(nx, ny);
    if (dist < 0.5 || nx <= 0) return null;
    nx /= dist; ny /= dist;
    if (Math.abs(ny) > SLANT) { ny = Math.sign(ny) * SLANT; nx = Math.sqrt(1 - SLANT * SLANT); }
    const R = radius(dist, W), pull = (G[0] - F[0]) * nx + (G[1] - F[1]) * ny; // the pull measured along n
    const dG = (pull + PI * R) / 2;
    return { nx, ny, lx: G[0] - nx * dG, ly: G[1] - ny * dG, R };
  }

  // Where page point (x, y) goes: [x', y', z, nz], nz the z part of the paper's front normal (1 flat, −1 face down).
  function map(f, x, y) {
    if (!f) return [x, y, 0, 1];
    const d = (x - f.lx) * f.nx + (y - f.ly) * f.ny;
    if (d <= 0) return [x, y, 0, 1];
    let e, z, nz;
    if (d < PI * f.R) { const th = d / f.R; e = f.R * Math.sin(th); z = f.R * (1 - Math.cos(th)); nz = Math.cos(th); }
    else { e = PI * f.R - d; z = 2 * f.R; nz = -1; }
    return [x + f.nx * (e - d), y + f.ny * (e - d), z, nz];
  }

  // The pulled point for a finger. Forward (dir 1): the free edge was taken at height y0 and follows the finger to the
  // left, a little faster than the finger (k), so a swipe across the page is a whole turn. Back (dir −1): the previous
  // page comes in from beyond the spine. Either way the pulled point stays within reach of the spine (|F − S| ≤ W, S the
  // spine point at the same height), as a leaf bound into a book must.
  const K = 1.5;
  function pull(dir, W, H, x0, y0, x, y) {
    const gy = clamp(y0, 0, H), G = [W, gy];
    let fx = dir > 0 ? W + (x - x0) * K : -W + (x - x0) * K, fy = gy + (y - y0) * 0.85;
    fx = clamp(fx, -W, W - 0.5); fy = clamp(fy, -0.25 * H, 1.25 * H);
    const dx = fx, dy = fy - gy, r = Math.hypot(dx, dy);
    if (r > W) { fx = dx / r * W; fy = gy + dy / r * W; }
    return { G, F: [fx, fy] };
  }

  // How far a turn has got: 0 flat on the right, 1 gone over the spine.
  const progress = (G, F, W) => clamp((G[0] - F[0]) / (2 * W), 0, 1);
  // Finish the turn, or let the page fall back? p: progress in the direction of the turn; v: finger speed (px/ms,
  // positive in the direction of the turn).
  const settle = (p, v) => (v > 0.35 || (p > 0.3 && v > -0.2));

  // The pulled point for a turn played on its own (arrows, keys, the timer): the lower corner lifts, rises a little
  // as it crosses, and lands flat beyond the spine. u: 0 … 1.
  function path(u, W, H) {
    const G = [W, H * 0.88];
    return { G, F: [W - u * 2 * W, G[1] - Math.sin(u * PI) * H * 0.14] };
  }
  // The point where the page is out of sight (F mirrored through the spine).
  const gone = (G) => [-G[0], G[1]];

  // A grid of cols × rows cells over a W × H page: positions (x, y), texture coordinates and triangle indices.
  function grid(cols, rows) {
    const uv = new Float32Array((cols + 1) * (rows + 1) * 2), idx = new Uint16Array(cols * rows * 6);
    let k = 0;
    for (let j = 0; j <= rows; j++) for (let i = 0; i <= cols; i++) { uv[k++] = i / cols; uv[k++] = j / rows; }
    k = 0;
    for (let j = 0; j < rows; j++) for (let i = 0; i < cols; i++) {
      const a = j * (cols + 1) + i, b = a + 1, c = a + cols + 1, d = c + 1;
      idx[k++] = a; idx[k++] = b; idx[k++] = c; idx[k++] = b; idx[k++] = d; idx[k++] = c;
    }
    return { uv, idx };
  }
  // Fill out[] with x', y', z, nz for every grid point under the fold f.
  function mesh(f, uv, W, H, out) {
    for (let i = 0, k = 0; i < uv.length; i += 2, k += 4) {
      const p = map(f, uv[i] * W, uv[i + 1] * H);
      out[k] = p[0]; out[k + 1] = p[1]; out[k + 2] = p[2]; out[k + 3] = p[3];
    }
    return out;
  }

  root.MOLASTRIA_CURL = { fold, map, pull, progress, settle, path, gone, grid, mesh, radius };
})(typeof window !== 'undefined' ? window : globalThis);
