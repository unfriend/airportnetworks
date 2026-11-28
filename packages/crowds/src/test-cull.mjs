// Does leaving out hidden cells (sets/cull.js) ever make a hole? Scatters balls at random in a grid of cells (even, and
// with a thin slab and an empty pocket), finds the cells CULL calls hidden from an eye, then casts rays from the eye in
// every direction into the grid and checks that the first ball each ray meets lies in a cell that is drawn. Also checks
// the sweep against a few cases worked by hand.
// usage: node packages/crowds/src/test-cull.mjs   (exits 1 on a failure)
import { createRequire } from 'module';
const require = createRequire(import.meta.url);
const CULL = require('./sets/cull.js');
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
// seeded random numbers (the kit's)
const rng = seed => () => { seed |= 0; seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };

// ---- by hand: a 3-cell row, the eye beyond its first cell
{
  const G = 3, op = new Float32Array(27).fill(1), tau = new Float32Array(27);
  CULL.sweep(op, G, [-1.5, 1.5, 1.5], tau);
  ok(tau[0 + 3 * (1 + 3)] === 0 && tau[1 + 3 * (1 + 3)] === 1 && tau[2 + 3 * (1 + 3)] === 2, 'a row seen end on: 0, 1, 2 cells deep');
  CULL.sweep(op, G, [1.5, 1.5, 1.5], tau);
  ok(tau[13] === 0 && Math.max(...tau) === 1, 'the eye inside the middle cell: every other cell 1 deep');
  const er = CULL.erode(op, G);
  ok(er[13] === 1 && er[0] === 0, 'eroded: only the middle cell keeps its opacity (the rest touch the outside)');
}

// ---- rays: balls in a grid of G cells of side 1, the first hit of each ray must be in a cell that is drawn
function trial(name, { G, perCell, r, eye, uneven, rays, seed }) {
  const R = rng(seed), bx = [], cellOf = [];
  const dens = (x, y, z) => (uneven && x > 4.5 && x < 5.2 ? 0.35 : 1) * (uneven && Math.hypot(x - 2.5, y - 5, z - 5) < 1.3 ? 0 : 1);
  const n = Math.round(perCell * G * G * G);
  for (let b = 0; b < n; b++) {
    const x = R() * G, y = R() * G, z = R() * G;
    if (R() > dens(x, y, z)) continue;
    bx.push(x, y, z);
    cellOf.push(Math.floor(x) + G * (Math.floor(y) + G * Math.floor(z)));
  }
  const NB = bx.length / 3, count = new Float32Array(G ** 3);
  for (const c of cellOf) count[c]++;
  const op = count.map(c => c * Math.PI * r * r), tau = new Float32Array(G ** 3);
  CULL.sweep(CULL.erode(op, G), G, eye, tau);
  const hidden = tau.map(t => (t > CULL.TAU ? 1 : 0)), nh = hidden.reduce((s, v) => s + v, 0);
  // a fine hash of the balls (every fine cell a ball's box touches)
  const F = 4 * G, fs = G / F, fine = Array.from({ length: F ** 3 }, () => []);
  for (let b = 0; b < NB; b++) {
    const x = bx[3 * b], y = bx[3 * b + 1], z = bx[3 * b + 2];
    for (let k = Math.max(0, Math.floor((z - r) / fs)); k <= Math.min(F - 1, Math.floor((z + r) / fs)); k++)
      for (let j = Math.max(0, Math.floor((y - r) / fs)); j <= Math.min(F - 1, Math.floor((y + r) / fs)); j++)
        for (let i = Math.max(0, Math.floor((x - r) / fs)); i <= Math.min(F - 1, Math.floor((x + r) / fs)); i++) fine[i + F * (j + F * k)].push(b);
  }
  // the first ball a ray from the eye meets (marching the fine cells), or -1
  function first(d) {
    // where the ray enters the grid's box
    let t0 = 0, t1 = Infinity;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-12) { if (eye[a] < 0 || eye[a] > G) return -1; continue; }
      let u = (0 - eye[a]) / d[a], v = (G - eye[a]) / d[a];
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    }
    if (t0 > t1) return -1;
    const step = fs * 0.25, seen = new Set();
    for (let t = t0; t <= t1 + step; t += step) {
      const x = eye[0] + d[0] * t, y = eye[1] + d[1] * t, z = eye[2] + d[2] * t;
      const i = Math.min(F - 1, Math.max(0, Math.floor(x / fs))), j = Math.min(F - 1, Math.max(0, Math.floor(y / fs))), k = Math.min(F - 1, Math.max(0, Math.floor(z / fs)));
      let best = -1, bt = Infinity;
      for (const b of fine[i + F * (j + F * k)]) {
        if (seen.has(b)) continue;
        const ox = bx[3 * b] - eye[0], oy = bx[3 * b + 1] - eye[1], oz = bx[3 * b + 2] - eye[2];
        const tc = ox * d[0] + oy * d[1] + oz * d[2], q = ox * ox + oy * oy + oz * oz - tc * tc;
        if (q > r * r) { seen.add(b); continue; }
        const th = tc - Math.sqrt(r * r - q);
        if (th > 0 && th < bt) { bt = th; best = b; }
      }
      if (best >= 0 && bt <= t + step * 2) return best;   // (a hit before the march has gone past it)
    }
    return -1;
  }
  let holes = 0, hits = 0;
  for (let n2 = 0; n2 < rays; n2++) {
    // aimed at a point of the grid at random (so every cell gets rays)
    const p = [R() * G, R() * G, R() * G], d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], l = Math.hypot(...d);
    const b = first(d.map(v => v / l));
    if (b < 0) continue;
    hits++;
    if (hidden[cellOf[b]]) holes++;
  }
  ok(nh > 0 && holes === 0, `${name}: ${NB} balls, ${nh} of ${G ** 3} cells hidden, ${hits} rays hit a ball, ${holes} of them first in a hidden cell`);
}
trial('even crowd, eye outside', { G: 10, perCell: 700, r: 0.05, eye: [-2.3, 4.7, 11.6], rays: 12000, seed: 3 });
trial('even crowd, eye inside', { G: 10, perCell: 700, r: 0.05, eye: [4.4, 5.1, 3.2], rays: 12000, seed: 5 });
trial('thin slab and an empty pocket', { G: 10, perCell: 600, r: 0.05, eye: [-1.5, 5.5, 4.9], uneven: true, rays: 16000, seed: 9 });
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
