// Does leaving out hidden cells (sets/cull.js) ever make a hole? Builds crowds, finds the cells CULL calls hidden from an
// eye (at the threshold a 1280 x 800 page uses, the lowest the app uses), then casts rays from the eye into the grid and
// checks that the first ball each ray meets lies in a cell that is drawn. The crowds: balls at random (even, and with a
// thin slab and an empty pocket), and the packed proteins built by the story's own code (sets/crowds.js: the tile
// packed, copies of it turned, sorted into cells, the opacity with each kind's shadow share) at their size, larger
// (the Size control's 1.4) and with far cells thinned and their balls enlarged as the detail switch draws them. Half of
// each trial's rays are aimed into hidden cells near the edge of what is hidden, where a hole would be. Also checks the
// sweep against a few cases worked by hand. A pass is evidence, not a proof: see the threshold's comment in cull.js.
// usage: node packages/crowds/src/test-cull.mjs   (exits 1 on a failure; about 10 s)
import fs from 'fs';
import path from 'path';
import vm from 'vm';
import { fileURLToPath } from 'url';
import { createRequire } from 'module';
const here = path.dirname(fileURLToPath(import.meta.url)), root = path.join(here, '..', '..', '..');
const require = createRequire(import.meta.url);
// the story's own code, as build.mjs pastes it: three.js, the kit, ppicell's structs.js and crowd.js up to its set,
// then cull.js and crowds.js
const THREE = require(path.join(root, 'three.min.js'));
const { makeKit } = require(path.join(root, 'tools', 'engine', 'kit.js'));
const strip = t => t.replace(/^if \(typeof module !== 'undefined'\) module\.exports = .*\n/m, '');
const crowdJs = fs.readFileSync(path.join(root, 'packages', 'ppicell', 'src', 'sets', 'crowd.js'), 'utf8');
const src = [strip(fs.readFileSync(path.join(root, 'packages', 'ppicell', 'src', 'sets', 'structs.js'), 'utf8')),
  crowdJs.slice(0, crowdJs.indexOf('\nSETS.crowd = function')),
  strip(fs.readFileSync(path.join(here, 'sets', 'cull.js'), 'utf8')), strip(fs.readFileSync(path.join(here, 'sets', 'crowds.js'), 'utf8')),
  ';({ CULL, CROWDS })'].join('\n');
const { CULL, CROWDS } = vm.runInNewContext(src, { THREE, SETS: {}, performance, console, Math, Float32Array });
const K = makeKit(THREE);
const TAU = CULL.tauFor(1280 * 800);
let bad = 0;
const ok = (c, m) => { if (!c) { bad++; console.log('FAIL', m); } else console.log('ok  ', m); };
const rng = K.rng;

// ---- by hand
{
  const G = 3, op = new Float32Array(27).fill(1), tau = new Float32Array(27);
  CULL.sweep(op, G, [-1.5, 1.5, 1.5], tau);
  ok(tau[0 + 3 * (1 + 3)] === 0 && tau[1 + 3 * (1 + 3)] === 1 && tau[2 + 3 * (1 + 3)] === 2, 'a row seen end on: 0, 1, 2 cells deep');
  CULL.sweep(op, G, [1.5, 1.5, 1.5], tau);
  ok(Math.max(...tau) === 0, 'the eye inside the middle cell: every other cell 0 deep (the eye\'s own cell is not charged: the eye may stand at its far face)');
  const G5 = 5, op5 = new Float32Array(125).fill(1), t5 = new Float32Array(125), at = (i, j, k) => t5[i + 5 * (j + 5 * k)];
  CULL.sweep(op5, G5, [2.9, 2.5, 2.5], t5);
  ok(at(2, 2, 2) === 0 && at(3, 2, 2) === 0 && at(4, 2, 2) === 1 && at(0, 2, 2) === 1 && at(4, 4, 4) === 1 && at(0, 0, 0) === 1, 'the eye in the middle of 5 x 5 x 5: the next ring 0 deep, the outer one 1 (one cell crossed)');
  const er = CULL.erode(op, G);
  ok(er[13] === 1 && er[0] === 0, 'eroded: only the middle cell keeps its opacity (the rest touch the outside)');
  ok(TAU > 18 && TAU < 19 && CULL.tauFor(2 * 1832 * 1920) > 20, `the threshold from the pixels: ${TAU.toFixed(1)} on a 1280 x 800 page, ${CULL.tauFor(2 * 1832 * 1920).toFixed(1)} for a Quest's two eyes`);
}

// ---- rays. A crowd: balls (x, y, z, r) in cell units (the grid G cells a side from 0 to G), each ball's cell, each
// cell's opacity at size 1 (the app's: count * pi * mean(r^2) * shadow / h^2, h = 1 here), and the drawn balls (all,
// or the thinned ones' survivors enlarged)
function cast(name, { G, B, cellOf, op, eye, sz = 1, rays, seed, drawn, none }) {
  const R = rng(seed), opS = op.map(v => v * sz * sz), tau = new Float32Array(G ** 3);
  CULL.sweep(CULL.erode(opS, G), G, eye, tau);
  const hidden = tau.map(t => (t > TAU ? 1 : 0)), nh = hidden.reduce((s, v) => s + v, 0);
  // the hidden cells nearest the edge (the least deep), where rays are aimed half the time
  const edge = [];
  for (let c = 0; c < G ** 3; c++) if (hidden[c]) edge.push(c);
  edge.sort((a, b) => tau[a] - tau[b]);
  edge.length = Math.min(edge.length, Math.max(4, Math.ceil(edge.length / 4)));
  // a fine hash of the drawn balls (every fine cell a ball's box touches)
  const list = drawn || B.map((_, i) => i), F = 4 * G, fs2 = G / F, fine = Array.from({ length: F ** 3 }, () => []);
  let rx = 0;
  for (const b of list) {
    const [x, y, z, r0] = B[b], r = r0 * sz;
    rx = Math.max(rx, r);
    for (let k = Math.max(0, Math.floor((z - r) / fs2)); k <= Math.min(F - 1, Math.floor((z + r) / fs2)); k++)
      for (let j = Math.max(0, Math.floor((y - r) / fs2)); j <= Math.min(F - 1, Math.floor((y + r) / fs2)); j++)
        for (let i = Math.max(0, Math.floor((x - r) / fs2)); i <= Math.min(F - 1, Math.floor((x + r) / fs2)); i++) fine[i + F * (j + F * k)].push(b);
  }
  // the first ball a ray from the eye meets (marching the fine cells), or -1
  function first(d) {
    let t0 = 0, t1 = Infinity;
    for (let a = 0; a < 3; a++) {
      if (Math.abs(d[a]) < 1e-12) { if (eye[a] < 0 || eye[a] > G) return -1; continue; }
      let u = (0 - eye[a]) / d[a], v = (G - eye[a]) / d[a];
      if (u > v) [u, v] = [v, u];
      t0 = Math.max(t0, u); t1 = Math.min(t1, v);
    }
    if (t0 > t1) return -1;
    const step = fs2 * 0.25, seen = new Set();
    let best = -1, bt = Infinity;
    for (let t = t0; t <= t1 + step; t += step) {
      const x = eye[0] + d[0] * t, y = eye[1] + d[1] * t, z = eye[2] + d[2] * t;
      const i = Math.min(F - 1, Math.max(0, Math.floor(x / fs2))), j = Math.min(F - 1, Math.max(0, Math.floor(y / fs2))), k = Math.min(F - 1, Math.max(0, Math.floor(z / fs2)));
      for (const b of fine[i + F * (j + F * k)]) {
        if (seen.has(b)) continue;
        seen.add(b);
        const [bx, by, bz, r0] = B[b], r = r0 * sz, ox = bx - eye[0], oy = by - eye[1], oz = bz - eye[2];
        const tc = ox * d[0] + oy * d[1] + oz * d[2], q = ox * ox + oy * oy + oz * oz - tc * tc;
        if (q > r * r) continue;
        const th = tc - Math.sqrt(r * r - q);
        if (th > 0 && th < bt) { bt = th; best = b; }
      }
      if (best >= 0 && bt <= t - Math.max(2 * rx, 2 * step)) return best;   // (no ball not yet met can be nearer)
    }
    return best;
  }
  let holes = 0, hits = 0, aimed = 0;
  for (let n2 = 0; n2 < rays; n2++) {
    // half aimed at a random point of the grid (so every cell gets rays), half into a hidden cell near the edge
    let p;
    if (n2 & 1 && edge.length) { const c = edge[Math.floor(R() * edge.length)]; p = [c % G + R(), Math.floor(c / G) % G + R(), Math.floor(c / G / G) + R()]; aimed++; }
    else p = [R() * G, R() * G, R() * G];
    const d = [p[0] - eye[0], p[1] - eye[1], p[2] - eye[2]], l = Math.hypot(...d);
    const b = first(d.map(v => v / l));
    if (b < 0) continue;
    hits++;
    if (hidden[cellOf[b]]) holes++;
  }
  ok((nh > 0 || none) && holes === 0, `${name}: ${list.length} balls drawn, ${nh} of ${G ** 3} cells hidden (threshold ${TAU.toFixed(1)}), ${hits} rays hit a ball (${aimed} aimed at the hidden edge), ${holes} of them first in a hidden cell`);
}

// ---- random crowds: balls of one radius at random in G cells of side 1
function randomCrowd({ G, perCell, r, uneven, seed }) {
  const R = rng(seed), B = [], cellOf = [];
  const dens = (x, y, z) => (uneven && x > 4.5 && x < 5.2 ? 0.35 : 1) * (uneven && Math.hypot(x - 2.5, y - 5, z - 5) < 1.3 ? 0 : 1);
  const n = Math.round(perCell * G * G * G);
  for (let b = 0; b < n; b++) {
    const x = R() * G, y = R() * G, z = R() * G;
    if (R() > dens(x, y, z)) continue;
    B.push([x, y, z, r]);
    cellOf.push(Math.floor(x) + G * (Math.floor(y) + G * Math.floor(z)));
  }
  const op = new Float32Array(G ** 3);
  for (const c of cellOf) op[c] += Math.PI * r * r;
  return { G, B, cellOf, op };
}
cast('random crowd, eye outside', { ...randomCrowd({ G: 10, perCell: 700, r: 0.05, seed: 3 }), eye: [-2.3, 4.7, 11.6], rays: 12000, seed: 3 });
cast('random crowd, eye inside', { ...randomCrowd({ G: 10, perCell: 700, r: 0.05, seed: 5 }), eye: [4.4, 5.1, 3.2], rays: 12000, seed: 5 });
// a dense crowd, each cell opaque on its own (opacity about 24, more than the threshold: a coarser grid or denser balls
// than the app's, whose cells are about 2 to 10), the eye inside at its cell's face: the cells next to the eye's are in
// plain view. Charging the eye's own cell (the first version) hid them: this trial is the one that catches it
cast('dense random crowd, eye inside at its cell\'s face', { ...randomCrowd({ G: 6, perCell: 3056, r: 0.05, seed: 7 }), eye: [2.98, 3.4, 2.6], rays: 12000, seed: 7 });
cast('random crowd, a thin slab and an empty pocket', { ...randomCrowd({ G: 10, perCell: 900, r: 0.05, uneven: true, seed: 9 }), eye: [-1.5, 5.5, 4.9], rays: 16000, seed: 9 });

// ---- the packed proteins, built as the story builds them (a million balls: a grid of 9 a side)
const t0 = Date.now();
while (!CROWDS.pack(1000));
const it = CROWDS.build(K, 1000000, 1, 11 + 1000000 + 7);
let st;
while (!(st = it.next()).done);
const P = st.value, G = P.G, h = P.h, HD = CROWDS.D / 2;
// in cell units
const B = [], cellOf = [];
for (let j = 0; j < P.n; j++) {
  B.push([(P.P[4 * j] + HD) / h, (P.P[4 * j + 1] + HD) / h, (P.P[4 * j + 2] + HD) / h, P.P[4 * j + 3] / h]);
  cellOf.push(P.E[4 * j] + 256 * P.E[4 * j + 1]);
}
// the opacity as the app has it before erosion (the build keeps only the eroded one): each ball's disc times its kind's
// shadow share
const op = new Float32Array(G ** 3);
for (let j = 0; j < P.n; j++) op[cellOf[j]] += Math.PI * B[j][3] * B[j][3] * CROWDS.SHADOW[P.E[4 * j + 3]];
const er = CULL.erode(op, G);
ok(er.every((v, c) => Math.abs(v - P.opE[c]) <= 1e-4 * Math.max(1, v)), `the packed crowd: ${P.n} balls, ${G} cells a side, built in ${((Date.now() - t0) / 1000).toFixed(1)} s; this test's opacity is the build's (shadow shares ${CROWDS.SHADOW.map(v => v.toFixed(2)).join(', ')}; a cell's about ${op[Math.floor(G / 2) * (1 + G + G * G)].toFixed(1)})`);
const pk = { G, B, cellOf, op };
// at the packed size a line crosses at most about 9 cells of about 2 each: under the threshold, so nothing may be hidden
// (none: true); these two trials are the ones the first version failed (it charged the eye's own cell and counted every
// ball's disc, so it hid cells a line could see into)
cast('packed proteins, eye outside', { ...pk, eye: [-1.7, 3.4, 8.2], rays: 20000, seed: 21, none: true });
// the eye inside, near the cube's side and at the far face of its cell (where charging its own cell would credit a line
// with a cell it does not cross)
cast('packed proteins, eye inside at its cell\'s face', { ...pk, eye: [1.97, 4.5, 4.03], rays: 40000, seed: 22, none: true });
// larger (the Size control's 1.4: twice the opacity), where cells are hidden
cast('packed proteins, larger, eye outside', { ...pk, sz: 1.4, eye: [-1.7, 3.4, 8.2], rays: 20000, seed: 23 });
cast('packed proteins, larger, eye inside at its cell\'s face', { ...pk, sz: 1.4, eye: [1.97, 4.5, 4.03], rays: 40000, seed: 24 });
// thinned: every cell beyond the first slab from the eye keeps a quarter of its balls (the first, as the app draws
// them: each cell's balls are in a random order), each twice as big, as the detail switch draws far cells
{
  const thin = [];
  for (let c = 0; c < G ** 3; c++) {
    const s0 = P.start[c], n = P.count[c], m = c % G >= 1 ? Math.max(1, Math.round(n / 4)) : n;
    for (let j = s0; j < s0 + m; j++) thin.push(j);
  }
  const B2 = B.map((b, j) => (cellOf[j] % G >= 1 ? [b[0], b[1], b[2], b[3] * 2] : b));
  cast('packed proteins, larger, far cells thinned to a quarter and enlarged', { ...pk, B: B2, drawn: thin, sz: 1.4, eye: [-1.2, 2.6, 3.4], rays: 20000, seed: 25 });
}
console.log(bad ? `${bad} failed` : 'all passed');
process.exit(bad ? 1 : 0);
