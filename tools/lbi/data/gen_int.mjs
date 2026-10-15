// Generates the embedded data block of sets/int.js from proteins.json.
// usage (from the repository root): node tools/lbi/data/extract_proteins.mjs, then node tools/lbi/data/gen_int.mjs
// Writes the block between the '// <data>' and '// </data>' markers in sets/int.js (or prints it if the markers are missing).
// Embedded: the 254 curated proteins (symbol, name, role, module, essential), their 375 interactions,
// a 3D layout of each curated module (local coordinates, flattest axis = y) and of the 13-node ATP synthase network.
import fs from 'fs';
const here = new URL('..', import.meta.url).pathname;
const d = JSON.parse(fs.readFileSync(here + 'data/proteins.json', 'utf8'));

// deterministic random numbers (same generator as K.rng)
function rng(seed) {
  return () => {
    seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const AL = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz_$';
const enc2 = n => AL[(n >> 6) & 63] + AL[n & 63];
const q12 = v => Math.max(0, Math.min(4095, Math.round((v + 1.6) / 3.2 * 4095)));

// 3D force layout (Fruchterman-Reingold with gravity), then rotate so the flattest axis is y, RMS radius 1
function layout(n, edges, seed) {
  const r = rng(seed), P = [];
  for (let i = 0; i < n; i++) P.push([r() - 0.5, r() - 0.5, r() - 0.5]);
  const k = 0.5;
  for (let it = 0; it < 600; it++) {
    const F = P.map(() => [0, 0, 0]), temp = 0.12 * (1 - it / 600) + 0.004;
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
      const dx = P[i][0] - P[j][0], dy = P[i][1] - P[j][1], dz = P[i][2] - P[j][2];
      const d2 = dx * dx + dy * dy + dz * dz + 1e-4, f = k * k / d2;
      F[i][0] += dx * f; F[i][1] += dy * f; F[i][2] += dz * f;
      F[j][0] -= dx * f; F[j][1] -= dy * f; F[j][2] -= dz * f;
    }
    for (const [a, b] of edges) {
      const dx = P[a][0] - P[b][0], dy = P[a][1] - P[b][1], dz = P[a][2] - P[b][2];
      const dd = Math.hypot(dx, dy, dz) + 1e-6, f = dd / k;
      F[a][0] -= dx * f; F[a][1] -= dy * f; F[a][2] -= dz * f;
      F[b][0] += dx * f; F[b][1] += dy * f; F[b][2] += dz * f;
    }
    for (let i = 0; i < n; i++) {
      for (let c = 0; c < 3; c++) F[i][c] -= P[i][c] * 0.6;
      const l = Math.hypot(...F[i]) + 1e-9, s = Math.min(l, temp) / l;
      for (let c = 0; c < 3; c++) P[i][c] += F[i][c] * s;
    }
  }
  // centre, PCA (Jacobi), RMS radius 1
  const m = [0, 0, 0];
  for (const p of P) for (let c = 0; c < 3; c++) m[c] += p[c] / n;
  for (const p of P) for (let c = 0; c < 3; c++) p[c] -= m[c];
  const C = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  for (const p of P) for (let a = 0; a < 3; a++) for (let b = 0; b < 3; b++) C[a][b] += p[a] * p[b];
  const V = [[1, 0, 0], [0, 1, 0], [0, 0, 1]], A = C.map(r => r.slice());
  for (let sweep = 0; sweep < 30; sweep++) for (let p = 0; p < 2; p++) for (let q = p + 1; q < 3; q++) {
    if (Math.abs(A[p][q]) < 1e-12) continue;
    const th = 0.5 * Math.atan2(2 * A[p][q], A[q][q] - A[p][p]), c = Math.cos(th), s = Math.sin(th);
    for (let k2 = 0; k2 < 3; k2++) { const ap = A[k2][p], aq = A[k2][q]; A[k2][p] = c * ap - s * aq; A[k2][q] = s * ap + c * aq; }
    for (let k2 = 0; k2 < 3; k2++) { const ap = A[p][k2], aq = A[q][k2]; A[p][k2] = c * ap - s * aq; A[q][k2] = s * ap + c * aq; }
    for (let k2 = 0; k2 < 3; k2++) { const vp = V[k2][p], vq = V[k2][q]; V[k2][p] = c * vp - s * vq; V[k2][q] = s * vp + c * vq; }
  }
  const ev = [0, 1, 2].sort((a, b) => A[b][b] - A[a][a]);   // largest, middle, smallest
  const ax = [ev[0], ev[2], ev[1]];                            // x = largest, y = smallest, z = middle
  let out = P.map(p => ax.map(e => p[0] * V[0][e] + p[1] * V[1][e] + p[2] * V[2][e]));
  const rms = Math.sqrt(out.reduce((s, p) => s + p[0] * p[0] + p[1] * p[1] + p[2] * p[2], 0) / n) || 1;
  out = out.map(p => p.map(v => v / rms));
  return out;
}

// curated proteins
const nodes = d.nodes;
const esc = s => s.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
for (const n of nodes) for (const s of [n.sym, n.name, n.role]) if (/[|;]/.test(s)) throw new Error('separator in ' + s);
const coreTxt = nodes.map(n => [n.sym, n.name === n.sym ? '' : n.name, n.role, n.module, n.essential ? 1 : 0].join('|')).join(';');
const edgeTxt = d.edges.map(([a, b]) => enc2(a) + enc2(b)).join('');
// module-local layouts
const local = new Array(nodes.length);
for (let m = 0; m < 10; m++) {
  const mem = nodes.filter(n => n.module === m).map(n => n.i), idx = new Map(mem.map((g, k) => [g, k]));
  const ed = d.edges.filter(([a, b]) => idx.has(a) && idx.has(b)).map(([a, b]) => [idx.get(a), idx.get(b)]);
  const L = layout(mem.length, ed, 11 + m);
  mem.forEach((g, k) => { local[g] = L[k]; });
}
const posTxt = local.map(p => p.map(v => enc2(q12(v))).join('')).join('');
// ATP synthase
const ATP = ['ATP5A1', 'ATP5B', 'ATPAF1', 'ATPAF2', 'ATP5C1', 'ATP5D', 'ATP5E', 'ATP5F1', 'ATP5O', 'MT-ATP6', 'ATP5G1', 'ATP5G2', 'ATP5G3'];
const ATP_E = ('ATP5A1-ATP5B ATP5A1-ATP5C1 ATP5B-ATP5C1 ATP5C1-ATP5D ATP5C1-ATP5E ATP5D-ATP5E ATP5C1-ATP5G1 ATP5E-ATP5G1 ' +
  'ATP5D-ATP5G2 ATP5G1-ATP5G2 ATP5G2-ATP5G3 ATP5G1-ATP5G3 ATP5G3-MT-ATP6 ATP5G2-MT-ATP6 MT-ATP6-ATP5F1 ' +
  'ATP5F1-ATP5O ATP5O-ATP5A1 ATP5O-ATP5B ATP5F1-ATP5A1 ATPAF1-ATP5B ATPAF2-ATP5A1').split(' ')
  .map(s => { const k = s.indexOf('-', s.startsWith('MT-') ? 3 : 0); return [ATP.indexOf(s.slice(0, k)), ATP.indexOf(s.slice(k + 1))]; });
if (ATP_E.length !== 21 || ATP_E.some(e => e[0] < 0 || e[1] < 0)) throw new Error('ATP edges ' + JSON.stringify(ATP_E));
// ATP synthase drawn like the complex seen from the side (slide 15), in 3D so it holds up from any angle: the alpha and
// beta nodes sit across the axis in the head with OSCP as its cap over the peripheral-stalk side, the assembly factors
// hang outside the head on opposite sides, gamma runs down the axis to delta and epsilon at its foot, the three c nodes
// sit on a ring around the axis at the bottom (120 degrees apart), subunit a beside the ring between two of them, and
// subunit b up the side behind. x across, y up, z towards the 'atp' view (which looks along -z).
// ring(deg, r, y): deg runs from +x towards the back (-z); subunit b and subunit a sit at the back right
const ring = (deg, r, y) => [r * Math.cos(deg * Math.PI / 180), y, -r * Math.sin(deg * Math.PI / 180)];
const ATP_XYZ = { ATP5A1: [-0.32, 0.62, -0.2], ATP5B: [0.32, 0.62, 0.2], ATPAF1: [0.76, 0.92, 0.48], ATPAF2: [-0.74, 0.9, -0.5],
  ATP5C1: [0, 0.16, 0.04], ATP5D: [0.2, -0.24, -0.08], ATP5E: [-0.2, -0.3, 0.14], ATP5F1: [0.66, 0.14, -0.5], ATP5O: [0.16, 1.06, -0.36],
  'MT-ATP6': ring(30, 0.84, -0.7), ATP5G1: ring(210, 0.4, -0.78), ATP5G2: ring(90, 0.4, -0.74), ATP5G3: ring(-30, 0.4, -0.72) };
// layout() order is x, y (flattest), z: here y carries the depth and z the height
const atpL = ATP.map(s => [ATP_XYZ[s][0], ATP_XYZ[s][2], ATP_XYZ[s][1] - 0.15]);
const atpPos = atpL.map(p => p.map(v => enc2(q12(v))).join('')).join('');

const mods = d.modules.map(m => `['${esc(m.name)}', '${m.css}']`).reduce((o, m, k) => o + (k ? (k % 3 ? ', ' : ',\n    ') : '') + m, '');
const wrap = (s, w = 110) => { const out = []; for (let i = 0; i < s.length; i += w) out.push(s.slice(i, i + w)); return out.map(x => `'${esc(x)}'`).join(' +\n    '); };
const block = `  // generated by tools/gen_int.mjs from proteins.json (the app's network-medicine story): do not edit by hand
  // CORE: 'SYM|name (empty = symbol)|role|module|essential' per protein, ';' between proteins
  const CORE = ${wrap(coreTxt)};
  // the 375 curated interactions, 2+2 characters per pair (base-64 indices into CORE)
  const CORE_E = ${wrap(edgeTxt)};
  // module-local 3D layouts, 3 x 2 characters per protein (12 bits each, -1.6..1.6, RMS radius 1, flattest axis y)
  const CORE_P = ${wrap(posTxt)};
  const MODS = [${mods}];
  const ATP = ${JSON.stringify(ATP).replace(/"/g, "'").replace(/,/g, ', ')};
  const ATP_E = ${JSON.stringify(ATP_E).replace(/,/g, ', ')};
  const ATP_P = '${atpPos}';
`;
const file = here + 'sets/int.js';
let src = fs.existsSync(file) ? fs.readFileSync(file, 'utf8') : '';
const a = src.indexOf('  // <data>\n'), b = src.indexOf('  // </data>');
if (a >= 0 && b > a) {
  src = src.slice(0, a) + '  // <data>\n' + block + src.slice(b);
  fs.writeFileSync(file, src);
  console.log('wrote data block,', block.length, 'bytes');
} else { console.log(block); console.error('markers not found; printed the block'); }
