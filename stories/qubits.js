// Tissue and time: how the body's organs are built from small working units, and how they change as we age. One H&E
// slide and what it shows, 24,945 slides of GTEx, the authors' method (H&E-UTAG: tiles, features, neighbours, domains),
// an atlas of 218 microanatomical domains, the network of organ architecture, what changes with age and with disease,
// and the contacts between domains. After Buljan I, Bago-Horvath Z, Rendeiro AF, "Systematic mapping of human tissue
// microanatomy reveals age-associated remodeling and resilience", bioRxiv 2025, doi 10.1101/2025.10.13.682110
// (CC BY-NC), the poster "Microanatomical organization of the human body and its changes with age" and the talk
// "Microanatomical principles of tissue organization and their change with age" (Iva Buljan, Rendeiro group; LBI for
// Network Medicine, CeMM, Medical University of Vienna), with Iva Buljan's network of organ architecture.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/micro/build.mjs from the tour's kit, the tour's PET body and tissue sets and the data, organ models,
// sets and engine parts in tools/micro: edit those, not this file.
HOST.register('micro', function (HOST) {
'use strict';
const D2R = Math.PI / 180;
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// =================================================================== KIT ==
// Shared helpers for the 3D sets (the tour's kit): makeKit(THREE) returns K.
function makeKit(THREE) {
  const smooth = x => (x <= 0 ? 0 : x >= 1 ? 1 : x * x * (3 - 2 * x));
  const clamp = (x, a, b) => (x < a ? a : x > b ? b : x);
  const lerp = (a, b, x) => a + (b - a) * x;
  // 0..1 progress of x through [a, b], smoothed
  const prog = (x, a, b) => smooth((x - a) / (b - a));
  // seeded random numbers: const r = rng(7); r() -> [0, 1)
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  // normally distributed numbers from a seeded rng
  const gauss = r => Math.sqrt(-2 * Math.log(1 - r())) * Math.cos(2 * Math.PI * r());
  // small vector helpers on plain arrays
  const v3 = {
    add: (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]],
    sub: (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]],
    mul: (a, s) => [a[0] * s, a[1] * s, a[2] * s],
    dot: (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2],
    cross: (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]],
    len: a => Math.hypot(a[0], a[1], a[2]),
    norm: a => { const l = Math.hypot(a[0], a[1], a[2]) || 1; return [a[0] / l, a[1] / l, a[2] / l]; },
    lerp: (a, b, x) => [a[0] + (b[0] - a[0]) * x, a[1] + (b[1] - a[1]) * x, a[2] + (b[2] - a[2]) * x],
    dist: (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]),
  };
  // a random unit vector
  const unit = r => { const z = r() * 2 - 1, t = r() * Math.PI * 2, s = Math.sqrt(1 - z * z); return [s * Math.cos(t), z, s * Math.sin(t)]; };
  // '#ff8800' or [r, g, b] (0..1) -> [r, g, b]
  const rgb = c => (Array.isArray(c) ? c : (n => [(n >> 16 & 255) / 255, (n >> 8 & 255) / 255, (n & 255) / 255])(parseInt(String(c).replace('#', ''), 16)));
  // colour ramp through stops [[t, [r,g,b]], ...]
  const ramp = (stops, t) => {
    if (t <= stops[0][0]) return stops[0][1].slice();
    for (let i = 1; i < stops.length; i++) if (t <= stops[i][0]) return v3.lerp(stops[i - 1][1], stops[i][1], (t - stops[i - 1][0]) / (stops[i][0] - stops[i - 1][0]));
    return stops[stops.length - 1][1].slice();
  };

  // Uniforms shared by every set material. The story engine keeps them current:
  // uPx = half the drawing-buffer height in pixels times the world scale (so point sizes are in local units),
  // uTime = the clock in seconds (story time while the story plays).
  const U = { uPx: { value: 400 }, uTime: { value: 0 } };
  const GLSL = `
uniform float uPx, uTime;
// point size in pixels for a point 'size' local units across (never vanishes)
float pointPx(float size, vec4 mv) { return clamp(size * uPx * projectionMatrix[1][1] / max(-mv.z, 0.01), 1.5, 160.0); }
`;
  // every ShaderMaterial of a set gets the set's own fade uniform uA (0..1)
  // Glowing round points. Geometry attributes: position, aCol (vec3), aSize (float, local units), aA (float alpha)
  // opts: additive (default true), uniforms (extra), vertex (extra GLSL run at the end of main, may change
  // gl_PointSize, vC, vA, or gl_Position), head (extra declarations), hard (crisp discs instead of glow)
  function points(set, opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: U.uPx, uTime: U.uTime }, opts.uniforms || {}),
      transparent: true, depthWrite: false, blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: GLSL + `
attribute vec3 aCol; attribute float aSize, aA;
uniform float uA;
varying vec3 vC; varying float vA;
${opts.head || ''}
void main() {
  vec3 pos = position;
  vC = aCol; vA = aA * uA;
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize, mv);
  ${opts.vertex || ''}
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `
varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  ${opts.hard ? 'float a = smoothstep(0.5, 0.42, d); vec3 col = vC;'
    : 'float core = smoothstep(0.5, 0.18, d), glow = pow(1.0 - d * 2.0, 1.6); float a = max(core * 0.85, glow * 0.6); vec3 col = mix(vC, vec3(1.0), smoothstep(0.22, 0.0, d) * 0.35);'}
  gl_FragColor = vec4(col, vA * a);
}`,
    });
    set.mats.push(m);
    return m;
  }
  // Lines (THREE.LineSegments). Attributes: position, aCol (vec3), aA (float alpha), aT (float 0..1, for reveals)
  // uniforms: uReveal (segments with aT > uReveal are hidden), plus opts.uniforms; opts.vertex as for points
  function lines(set, opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: U.uPx, uTime: U.uTime, uReveal: { value: 1 } }, opts.uniforms || {}),
      transparent: true, depthWrite: false, blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: GLSL + `
attribute vec3 aCol; attribute float aA, aT;
uniform float uA, uReveal;
varying vec3 vC; varying float vA;
${opts.head || ''}
void main() {
  vec3 pos = position;
  vC = aCol; vA = aA * uA * step(aT, uReveal + 0.0001);
  vec4 mv = modelViewMatrix * vec4(pos, 1.0);
  gl_Position = projectionMatrix * mv;
  ${opts.vertex || ''}
}`,
      fragmentShader: `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`,
    });
    set.mats.push(m);
    return m;
  }
  // Lit surfaces: any built-in material (MeshStandardMaterial, MeshLambertMaterial, MeshBasicMaterial ...).
  // The set's fade multiplies its opacity; base is the opacity at full fade-in.
  function fade(set, mat, base = 1) {
    mat.transparent = true;
    mat.userData.base = base;
    mat.opacity = base;
    set.fades.push(mat);
    return mat;
  }
  // a glassy bubble that glows at its rim (spheres, domes). opts: color, a0 (face-on alpha), a1 (rim alpha)
  function rim(set, opts = {}) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uC: { value: new THREE.Color(...rgb(opts.color || [0.4, 0.8, 1.0])) }, uK: { value: 1 },
        uA0: { value: opts.a0 === undefined ? 0.06 : opts.a0 }, uA1: { value: opts.a1 === undefined ? 0.7 : opts.a1 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: opts.additive === false ? THREE.NormalBlending : THREE.AdditiveBlending,
      vertexShader: `varying vec3 vN, vW;
void main() {
  vec4 p = vec4(position, 1.0); vec3 n = normal;
#ifdef USE_INSTANCING
  p = instanceMatrix * p; n = mat3(instanceMatrix) * n;
#endif
  vN = normalize((modelMatrix * vec4(n, 0.0)).xyz); vec4 w = modelMatrix * p; vW = w.xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`,
      fragmentShader: `uniform float uA, uA0, uA1, uK; uniform vec3 uC; varying vec3 vN, vW;
void main() {
  vec3 n = normalize(vN), v = normalize(cameraPosition - vW);
  float r = pow(1.0 - abs(dot(n, v)), 2.5);
  gl_FragColor = vec4(uC * (0.6 + 0.6 * r), (uA0 + uA1 * r) * uA * uK);
}`,
    });
    set.mats.push(m);
    return m;
  }
  // A new set: call at the start of makeSetXxx(K). Returns { group, uA, mats, fades, setAlpha(a) }
  function newSet(key) {
    const set = { key, group: new THREE.Group(), uA: { value: 1 }, mats: [], fades: [] };
    set.group.name = key;
    set.setAlpha = a => {
      set.uA.value = a;
      for (const m of set.fades) {
        const o = m.userData.base * a;
        m.opacity = o;
        m.depthWrite = o > 0.97 && m.userData.base > 0.97;
      }
      set.group.visible = a > 0.003;
    };
    return set;
  }
  // geometry for points: n points with position, aCol, aSize, aA (all zero; fill the arrays yourself)
  function pointsGeo(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aSize', new THREE.BufferAttribute(new Float32Array(n), 1));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n).fill(1), 1));
    return g;
  }
  // geometry for n line segments (2n vertices): position, aCol, aA (1), aT (0)
  function linesGeo(n) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    g.setAttribute('aCol', new THREE.BufferAttribute(new Float32Array(n * 6), 3));
    g.setAttribute('aA', new THREE.BufferAttribute(new Float32Array(n * 2).fill(1), 1));
    g.setAttribute('aT', new THREE.BufferAttribute(new Float32Array(n * 2), 1));
    return g;
  }
  // a smooth tube through points [[x,y,z], ...]
  function tube(pts, radius, tubular, radial, closed) {
    const curve = new THREE.CatmullRomCurve3(pts.map(p => new THREE.Vector3(p[0], p[1], p[2])), !!closed);
    return new THREE.TubeGeometry(curve, tubular || pts.length * 4, radius, radial || 6, !!closed);
  }
  // merge geometries that share the same attributes (indexed or not) into one
  function merge(list) {
    const geos = list.map(g => (g.index ? g.toNonIndexed() : g));
    const out = new THREE.BufferGeometry();
    for (const name of Object.keys(geos[0].attributes)) {
      const size = geos[0].attributes[name].itemSize;
      const arr = new Float32Array(geos.reduce((s, g) => s + g.attributes[name].count * size, 0));
      let o = 0;
      for (const g of geos) { arr.set(g.attributes[name].array, o); o += g.attributes[name].array.length; }
      out.setAttribute(name, new THREE.BufferAttribute(arr, size));
    }
    return out;
  }
  // give a geometry a constant vertex colour (for merged, vertexColors materials)
  function paint(geo, c) {
    const n = geo.attributes.position.count, a = new Float32Array(n * 3), col = rgb(c);
    for (let i = 0; i < n; i++) a.set(col, 3 * i);
    geo.setAttribute('color', new THREE.BufferAttribute(a, 3));
    return geo;
  }
  // free GPU memory of a set (the engine calls this on dispose)
  function dispose(set) {
    set.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }
  return { THREE, smooth, clamp, lerp, prog, rng, gauss, v3, unit, rgb, ramp, U, GLSL, points, lines, fade, rim, newSet,
    pointsGeo, linesGeo, tube, merge, paint, dispose };
}
const K = makeKit(THREE);
const { smooth, clamp } = K;

// ================================================================== SETS ==
// Each set is one 3D scene of the story, centred on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
// MICRO_DATA (the preprint's numbers and the network of organ architecture, tools/micro/sets/data.js) comes first, then
// the organs' small 3D models (ORGAN3D, tools/micro/sets/organs.js; SETS.organs there is the harness's gallery, not
// part of the story); the tour's PET body and tissue sets (SETS.body, SETS.tissue) are used unchanged.
const SETS = {};
// QMATH: the maths of the qubits story, computed live from small example networks (no real network data).
// Plain script: in stories/qubits.js it is pasted inside the story's closure (the build drops the module line at the
// end); in Node, require() or import it (tools/qubits/test-qmath.mjs checks it).
//
// What it does, in the order of the story:
// - example networks: the planted hypercube block model (8 groups of genes on the corners of a cube, after the authors'
//   synthetic check: 0.5 within a group, 0.04 between cube neighbors, 0.002 otherwise; here 40 genes a group) at three
//   strengths of mixing, and a random network with as many links as the clearest one; all seeded, so every device
//   builds the same ones;
// - the bisections: a stand-in for the authors' beam search (see cut()): spectral clustering into 2^L equal cells, then
//   the cube labelling that keeps the most coupling on one-bit hops; bisection q is bit q of the cell code, the first
//   bisection the most significant bit, so cells nest as prefixes; and random halvings to compare with;
// - the coarse operator A_c = P A P^T (P the normalized cell indicators), Sinkhorn-balanced over cells;
// - the Pauli decomposition of a 2^L x 2^L matrix over all 4^L strings by a Walsh-Hadamard transform, O(4^L L);
// - the algebras: the TFIM chain (X_q and Z_q Z_(q+1), closing to so(2L)) and so(2L+1) (plus the boundary Z on the top
//   qubit), closed under commutators of Pauli strings;
// - the residual ||A0 - Pi A0||_F / ||A0||_F of the traceless part, the reconstruction from the first k strings and its
//   error, and the angles of one Trotter step, theta = -2 c t.
//
// Pauli strings are indices k = (x << L) | z: bit q of x puts an X on qubit q, bit q of z a Z (both: Y). The string is
// sigma = i^|x & z| X^x Z^z, so (sigma)[b ^ x][b] = i^|x & z| (-1)^|z & b|. Qubit q is bit q of the cell index; q0 is
// the least significant bit, q(L-1) the first bisection. Names are written from the top qubit down: X2X1, Z0, Y2Y1.
const QMATH = (() => {
  // ------------------------------------------------------------------ helpers
  // the kit's seeded random numbers (the same sequence as K.rng)
  function rng(seed) {
    return () => {
      seed |= 0; seed = (seed + 0x6D2B79F5) | 0;
      let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }
  const pop = v => { let c = 0; while (v) { v &= v - 1; c++; } return c; };
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // ------------------------------------------------------------------ example networks
  // A network: { key, name, n, edges (Int32Array, pairs i<j), group (Int8Array, the planted corner of each gene, or
  // null), deg, nbr (CSR: off, adj) }. Genes are numbered in a shuffled order, so nothing can read the groups off it.
  function finish(key, name, n, list, group, note) {
    const edges = Int32Array.from(list), m = edges.length / 2, deg = new Int32Array(n);
    for (let e = 0; e < m; e++) { deg[edges[2 * e]]++; deg[edges[2 * e + 1]]++; }
    const off = new Int32Array(n + 1);
    for (let i = 0; i < n; i++) off[i + 1] = off[i] + deg[i];
    const adj = new Int32Array(2 * m), fill = off.slice(0, n);
    for (let e = 0; e < m; e++) { const a = edges[2 * e], b = edges[2 * e + 1]; adj[fill[a]++] = b; adj[fill[b]++] = a; }
    return { key, name, note, n, m, edges, group, deg, off, adj };
  }
  // the planted hypercube block model: 2^bits groups of per genes; a pair is linked with probability pin inside a group,
  // pnbr between groups one bit apart on the cube, pfar otherwise. Each may be a number or a function: pin(g),
  // pnbr(g, h, q) (q the bit they differ in), pfar(g, h) (g, h the groups' corners, 0 .. 2^bits - 1)
  function planted(o) {
    const bits = o.bits || 3, G = 1 << bits, per = o.per || 40, n = G * per, r = rng(o.seed || 1);
    const order = shuffle([...Array(n).keys()], r);   // gene id of the j-th member of the planted list
    const group = new Int8Array(n);
    for (let j = 0; j < n; j++) group[order[j]] = Math.floor(j / per);
    const f = v => (typeof v === 'function' ? v : () => v), pin = f(o.pin), pnbr = f(o.pnbr), pfar = f(o.pfar);
    const P = new Float64Array(G * G);
    for (let g = 0; g < G; g++) for (let h = 0; h < G; h++) {
      const x = g ^ h, d = pop(x);
      P[g * G + h] = d === 0 ? pin(g) : d === 1 ? pnbr(Math.min(g, h), Math.max(g, h), Math.log2(x)) : pfar(Math.min(g, h), Math.max(g, h));
    }
    const list = [];
    for (let a = 0; a < n; a++) for (let b = a + 1; b < n; b++) if (r() < P[group[a] * G + group[b]]) list.push(a, b);
    return finish(o.key, o.name, n, list, group, o.note);
  }
  // a random network (Erdos-Renyi) with a given number of links: no groups to find
  function random(o) {
    const n = o.n, r = rng(o.seed || 1), seen = new Set(), list = [];
    while (list.length < 2 * o.m) {
      const a = Math.floor(r() * n), b = Math.floor(r() * n);
      if (a === b) continue;
      const i = Math.min(a, b), j = Math.max(a, b);
      if (seen.has(i * n + j)) continue;
      seen.add(i * n + j); list.push(i, j);
    }
    return finish(o.key, o.name, n, list, null, o.note);
  }
  // the story's example networks (key, name, how it is made); built on first use and kept
  const sg = (g, q) => (g >> q & 1 ? -1 : 1);   // +1 where bit q of a corner is 0, -1 where it is 1
  const NETS = [
    { key: 'clear', name: 'Clear groups', kind: 'planted', per: 40, pin: 0.5, pnbr: 0.04, pfar: 0.002, seed: 11,
      note: '8 groups of 40 genes on a cube: linked with probability 0.5 inside a group, 0.04 between neighbors, 0.002 otherwise' },
    // (uneven, like a real network: some groups denser inside, hops along bit 1 strongest and stronger on the side
    // where bit 2 is 0, more links across one face diagonal than the other)
    { key: 'mixed', name: 'Uneven groups', kind: 'planted', per: 40, seed: 12,
      pin: g => 0.5 + 0.08 * sg(g, 2) * sg(g, 1) + 0.05 * sg(g, 2),
      pnbr: (g, h, q) => (q === 1 ? 0.14 + 0.04 * sg(g, 2) : q === 2 ? 0.09 : 0.07 + 0.03 * sg(g, 1)),
      pfar: (g, h) => ((g ^ h) === 6 ? (sg(g, 2) === sg(g, 1) ? 0.015 : 0.05) : (g ^ h) === 3 ? 0.03 : (g ^ h) === 5 ? 0.01 : 0.006),
      note: '8 groups of 40 genes on a cube, uneven: 0.37 to 0.63 inside a group, 0.04 to 0.18 between neighbors, 0.006 to 0.05 otherwise' },
    { key: 'blurred', name: 'Strong mixing', kind: 'planted', per: 40, pin: 0.5, pnbr: 0.25, pfar: 0.12, seed: 13,
      note: '8 groups of 40 genes on a cube: 0.5 inside a group, 0.25 between neighbors, 0.12 otherwise' },
    { key: 'random', name: 'Random network', kind: 'random', n: 320, seed: 14,
      note: '320 genes and as many links as the clear network, placed at random: no groups' },
  ];
  const DEFAULT = 'mixed';   // the story's network
  const cache = {};
  function network(key) {
    if (cache[key]) return cache[key];
    const s = NETS.find(x => x.key === key);
    if (!s) throw new Error('unknown network ' + key);
    const net = s.kind === 'planted' ? planted(s) : random(Object.assign({ m: network('clear').m }, s));
    return (cache[key] = net);
  }

  // ------------------------------------------------------------------ the bisections
  // The slowest modes: an orthonormal basis (n x k, column-major Float64Array) of the k leading eigenvectors of
  // (I + D^-1/2 A D^-1/2) / 2, by subspace iteration from a seeded start (the shift keeps the bulk below the groups').
  function modes(net, k, iters = 100, seed = 5) {
    const { n, off, adj, deg } = net, r = rng(seed), isd = new Float64Array(n);
    for (let i = 0; i < n; i++) isd[i] = deg[i] ? 1 / Math.sqrt(deg[i]) : 0;
    let Q = new Float64Array(n * k).map(() => r() - 0.5);
    let W = new Float64Array(n * k);
    const orth = M => {   // modified Gram-Schmidt on the columns
      for (let c = 0; c < k; c++) {
        const v = M.subarray(c * n, c * n + n);
        for (let p = 0; p < c; p++) { const u = M.subarray(p * n, p * n + n); let d = 0; for (let i = 0; i < n; i++) d += u[i] * v[i]; for (let i = 0; i < n; i++) v[i] -= d * u[i]; }
        let s = 0; for (let i = 0; i < n; i++) s += v[i] * v[i];
        s = Math.sqrt(s) || 1; for (let i = 0; i < n; i++) v[i] /= s;
      }
    };
    orth(Q);
    for (let it = 0; it < iters; it++) {
      for (let c = 0; c < k; c++) {
        const v = Q.subarray(c * n, c * n + n), w = W.subarray(c * n, c * n + n);
        for (let i = 0; i < n; i++) {
          let s = 0;
          for (let e = off[i]; e < off[i + 1]; e++) s += isd[adj[e]] * v[adj[e]];
          w[i] = 0.5 * (v[i] + isd[i] * s);
        }
      }
      orth(W); [Q, W] = [W, Q];
    }
    return Q;
  }
  // k-means on the rows of X (n x d, row-major), farthest-point start from the longest row, then balanced cells
  // (cap genes each: the gene with the most to lose takes its nearest cell with room first), then Lloyd steps with the cap
  function kmeansBalanced(X, n, d, k, cap) {
    const C = new Float64Array(k * d), lab = new Int32Array(n).fill(-1);
    const dist = (i, c) => { let s = 0; for (let j = 0; j < d; j++) { const t = X[i * d + j] - C[c * d + j]; s += t * t; } return s; };
    let first = 0, best = -1;
    for (let i = 0; i < n; i++) { let s = 0; for (let j = 0; j < d; j++) s += X[i * d + j] ** 2; if (s > best) { best = s; first = i; } }
    for (let j = 0; j < d; j++) C[j] = X[first * d + j];
    const md = new Float64Array(n).fill(Infinity);
    for (let c = 1; c < k; c++) {
      let far = 0, fd = -1;
      for (let i = 0; i < n; i++) { md[i] = Math.min(md[i], dist(i, c - 1)); if (md[i] > fd) { fd = md[i]; far = i; } }
      for (let j = 0; j < d; j++) C[c * d + j] = X[far * d + j];
    }
    const centroids = () => {
      C.fill(0); const cnt = new Int32Array(k);
      for (let i = 0; i < n; i++) { cnt[lab[i]]++; for (let j = 0; j < d; j++) C[lab[i] * d + j] += X[i * d + j]; }
      for (let c = 0; c < k; c++) for (let j = 0; j < d; j++) C[c * d + j] /= cnt[c] || 1;
    };
    // plain Lloyd steps first, so the centers find the groups
    for (let it = 0; it < 30; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) { let bc = 0, bd = Infinity; for (let c = 0; c < k; c++) { const t = dist(i, c); if (t < bd) { bd = t; bc = c; } } if (lab[i] !== bc) { lab[i] = bc; moved = true; } }
      centroids();
      if (!moved) break;
    }
    // then the balanced assignment, twice
    const D = new Float64Array(n * k);
    for (let round = 0; round < 3; round++) {
      for (let i = 0; i < n; i++) for (let c = 0; c < k; c++) D[i * k + c] = dist(i, c);
      const room = new Int32Array(k).fill(cap), done = new Uint8Array(n);
      lab.fill(-1);
      for (let left = n; left > 0; left--) {
        let gi = -1, gc = -1, gr = -Infinity;
        for (let i = 0; i < n; i++) {
          if (done[i]) continue;
          let b1 = Infinity, b2 = Infinity, bc = -1;
          for (let c = 0; c < k; c++) { if (!room[c]) continue; const t = D[i * k + c]; if (t < b1) { b2 = b1; b1 = t; bc = c; } else if (t < b2) b2 = t; }
          const reg = (b2 === Infinity ? 0 : b2 - b1);
          if (reg > gr || (reg === gr && i < gi)) { gr = reg; gi = i; gc = bc; }
        }
        lab[gi] = gc; done[gi] = 1; room[gc]--;
      }
      centroids();
    }
    return lab;
  }
  // links between groups: W[a][b] (a != b counted once per link each way, a == b twice per link inside)
  function groupLinks(net, lab, k) {
    const W = new Float64Array(k * k);
    for (let e = 0; e < net.m; e++) { const a = lab[net.edges[2 * e]], b = lab[net.edges[2 * e + 1]]; W[a * k + b]++; W[b * k + a]++; }
    return W;
  }
  // The cut: spectral clustering into 2^L equal cells, then the codes. Every way of giving the 8 cells the codes 000 to
  // 111 is tried (with the first group at 000: flipping a bit of every code changes nothing that counts, so 7! = 5,040
  // ways are enough); the one kept puts the most links on one-bit hops (cube edges), then the fewest across
  // the first bisection, then the second (ties: the first found). Returns the codes (Uint8Array, L bits a gene; L up to 3).
  // This is a stand-in for the authors' beam search: like theirs, its result is an ordered list of global bisections.
  function cut(net, L = 3) {
    const k = 1 << L, n = net.n;
    const Q = modes(net, k);
    // drop the trivial mode (its direction is sqrt(degree)), keep the rest, rows normalized
    const v0 = new Float64Array(n); let s0 = 0;
    for (let i = 0; i < n; i++) { v0[i] = Math.sqrt(net.deg[i]); s0 += net.deg[i]; }
    for (let i = 0; i < n; i++) v0[i] /= Math.sqrt(s0) || 1;
    for (let c = 0; c < k; c++) { const v = Q.subarray(c * n, c * n + n); let d = 0; for (let i = 0; i < n; i++) d += v0[i] * v[i]; for (let i = 0; i < n; i++) v[i] -= d * v0[i]; }
    const X = new Float64Array(n * k);
    for (let i = 0; i < n; i++) {
      let s = 0; for (let c = 0; c < k; c++) s += Q[c * n + i] ** 2;
      s = Math.sqrt(s) || 1; for (let c = 0; c < k; c++) X[i * k + c] = Q[c * n + i] / s;
    }
    const lab = kmeansBalanced(X, n, k, k, Math.ceil(n / k));
    const W = groupLinks(net, lab, k);
    // the labelling: cur[g] = the code of group g
    let best = null, bs = null;
    const used = new Uint8Array(k), cur = new Int32Array(k);
    const score = () => {
      let one = 0; const across = new Float64Array(L);
      for (let a = 0; a < k; a++) for (let b = a + 1; b < k; b++) {
        const w = W[a * k + b], x = cur[a] ^ cur[b];
        if (pop(x) === 1) one += w;
        for (let q = 0; q < L; q++) if (x >> q & 1) across[q] += w;
      }
      // (most on cube edges; then the fewest across the top bit, then the next)
      const s = [one]; for (let q = L - 1; q >= 0; q--) s.push(-across[q]);
      return s;
    };
    const better = (s, t) => { for (let i = 0; i < s.length; i++) { if (s[i] > t[i] + 1e-9) return true; if (s[i] < t[i] - 1e-9) return false; } return false; };
    used[0] = 1; cur[0] = 0;
    (function rec(g) {
      if (g === k) { const s = score(); if (!bs || better(s, bs)) { bs = s; best = Int32Array.from(cur); } return; }
      for (let c = 0; c < k; c++) if (!used[c]) { used[c] = 1; cur[g] = c; rec(g + 1); used[c] = 0; }
    })(1);
    const code = new Uint8Array(n);
    for (let i = 0; i < n; i++) code[i] = best[lab[i]];
    return code;
  }
  // random halvings: each bisection puts a random half of the genes on side 1 (the cells' sizes vary, as in the real
  // run's random baseline)
  function randomCut(net, L = 3, seed = 21) {
    const r = rng(seed), n = net.n, code = new Uint8Array(n);
    for (let q = L - 1; q >= 0; q--) {
      const ids = shuffle([...Array(n).keys()], r);
      for (let j = 0; j < n >> 1; j++) code[ids[j]] |= 1 << q;
    }
    return code;
  }
  // the codes at fewer bits: the first bisections only (cells nest as prefixes)
  const prefix = (code, Lfrom, Lto) => code.map(c => c >> (Lfrom - Lto));
  // how well a cut found the planted groups: the share of genes in their cell's most common group
  function purity(net, code, L) {
    if (!net.group) return null;
    const k = 1 << L, G = 1 << 3, cnt = new Int32Array(k * G);
    for (let i = 0; i < net.n; i++) cnt[code[i] * G + net.group[i]]++;
    let s = 0;
    for (let c = 0; c < k; c++) { let m = 0; for (let g = 0; g < G; g++) m = Math.max(m, cnt[c * G + g]); s += m; }
    return s / net.n;
  }
  const sizes = (code, L) => { const s = new Array(1 << L).fill(0); for (const c of code) s[c]++; return s; };

  // ------------------------------------------------------------------ the coarse operator
  // A_c = P A P^T with P[c][i] = 1/sqrt(|c|) for the genes of cell c: A_c[c][d] = links(c, d) / sqrt(|c| |d|), the
  // diagonal counting each link inside a cell twice (A is symmetric). N x N, row-major.
  function coarse(net, code, L) {
    const N = 1 << L, A = new Float64Array(N * N), sz = sizes(code, L);
    for (let e = 0; e < net.m; e++) { const a = code[net.edges[2 * e]], b = code[net.edges[2 * e + 1]]; A[a * N + b]++; A[b * N + a]++; }
    for (let a = 0; a < N; a++) for (let b = 0; b < N; b++) A[a * N + b] = sz[a] && sz[b] ? A[a * N + b] / Math.sqrt(sz[a] * sz[b]) : 0;
    return A;
  }
  // symmetric Sinkhorn balancing: diag(x) A diag(x) with every row (and column) summing to 1, x_i (A x)_i = 1
  // (empty cells stay zero)
  function sinkhorn(A, N, tol = 1e-13, max = 2000) {
    const x = new Float64Array(N), Ax = new Float64Array(N), live = [];
    for (let i = 0; i < N; i++) { let s = 0; for (let j = 0; j < N; j++) s += A[i * N + j]; if (s > 0) { live.push(i); x[i] = 1 / Math.sqrt(s); } }
    for (let it = 0; it < max; it++) {
      let err = 0;
      for (const i of live) { let s = 0; for (const j of live) s += A[i * N + j] * x[j]; Ax[i] = s; err = Math.max(err, Math.abs(x[i] * s - 1)); }
      if (err < tol) break;
      for (const i of live) x[i] = Math.sqrt(x[i] / Ax[i]);
    }
    const B = new Float64Array(N * N);
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) B[i * N + j] = x[i] * A[i * N + j] * x[j];
    return B;
  }
  // the share of the coupling between cells that runs along cube edges (cells one bit apart)
  function cubeShare(B, N) {
    let one = 0, all = 0;
    for (let a = 0; a < N; a++) for (let b = a + 1; b < N; b++) { all += B[a * N + b]; if (pop(a ^ b) === 1) one += B[a * N + b]; }
    return all ? one / all : 0;
  }

  // ------------------------------------------------------------------ Pauli strings
  const IM = [[1, 0], [0, 1], [-1, 0], [0, -1]];   // i^m
  // in-place Walsh-Hadamard transform: f[z] <- sum_j (-1)^|z & j| f[j]
  function wht(f) {
    for (let h = 1; h < f.length; h <<= 1) for (let i = 0; i < f.length; i += h << 1) for (let j = i; j < i + h; j++) {
      const a = f[j], b = f[j + h]; f[j] = a + b; f[j + h] = a - b;
    }
    return f;
  }
  // The weights c_k = tr(sigma_k M) / N of a real N x N matrix (N = 2^L) on all 4^L strings, O(4^L L): for each X part
  // x, f[j] = M[j][j ^ x], and tr(X^x Z^z M) = sum_j (-1)^|z & j| f[j] is f's Walsh-Hadamard transform at z.
  // Returns { re, im } (Float64Array(4^L)); im is zero for a symmetric M.
  function pauli(M, L) {
    const N = 1 << L, re = new Float64Array(N * N), im = new Float64Array(N * N), f = new Float64Array(N);
    for (let x = 0; x < N; x++) {
      for (let j = 0; j < N; j++) f[j] = M[j * N + (j ^ x)];
      wht(f);
      for (let z = 0; z < N; z++) {
        const ph = IM[pop(x & z) & 3];
        re[(x << L) | z] = ph[0] * f[z] / N; im[(x << L) | z] = ph[1] * f[z] / N;
      }
    }
    return { re, im };
  }
  // The matrix sum_k c_k sigma_k (c: { re, im } or a plain array of real weights; only the strings in 'only', if given).
  // Returns { re, im } (Float64Array(N * N), row-major).
  function fromPauli(c, L, only) {
    const N = 1 << L, re = new Float64Array(N * N), im = new Float64Array(N * N);
    const cr = c.re || c, ci = c.im || null;
    const add = k => {
      const x = k >> L, z = k & (N - 1), a = cr[k], b = ci ? ci[k] : 0;
      if (!a && !b) return;
      const ph = IM[pop(x & z) & 3];
      for (let col = 0; col < N; col++) {
        const s = pop(z & col) & 1 ? -1 : 1, pr = ph[0] * s, pi = ph[1] * s, row = col ^ x;
        re[row * N + col] += a * pr - b * pi; im[row * N + col] += a * pi + b * pr;
      }
    };
    if (only) for (const k of only) add(k); else for (let k = 0; k < N * N; k++) add(k);
    return { re, im };
  }
  // one entry of a string: (sigma_k)[row][col], as [re, im] (0 unless col = row ^ x)
  function entry(k, L, row, col) {
    const N = 1 << L, x = k >> L, z = k & (N - 1);
    if ((row ^ col) !== x) return [0, 0];
    const ph = IM[pop(x & z) & 3], s = pop(z & col) & 1 ? -1 : 1;
    return [ph[0] * s, ph[1] * s];
  }
  const SUB = '₀₁₂₃₄₅₆₇₈₉';
  // a string's name, top qubit first: 'X2X1' (opts.sub: 'X₂X₁'); the identity is 'I'
  function name(k, L, opts = {}) {
    const N = 1 << L, x = k >> L, z = k & (N - 1);
    let s = '';
    for (let q = L - 1; q >= 0; q--) {
      const a = x >> q & 1, b = z >> q & 1;
      if (!a && !b) continue;
      s += (a && b ? 'Y' : a ? 'X' : 'Z') + (opts.sub ? SUB[q] : q);
    }
    return s || 'I';
  }
  // the inverse of name(): 'X2X1' or 'Z₀' -> k
  function parse(s, L) {
    if (s === 'I') return 0;
    let x = 0, z = 0;
    const t = String(s).replace(/[₀-₉]/g, c => String(SUB.indexOf(c)));
    for (const m of t.matchAll(/([XYZ])(\d+)/g)) { const q = +m[2]; if (m[1] !== 'Z') x |= 1 << q; if (m[1] !== 'X') z |= 1 << q; }
    return (x << L) | z;
  }
  // which qubits a string acts on, and how: [{ q, p: 'X' | 'Y' | 'Z' }] top qubit first
  const parts = (k, L) => { const N = 1 << L, x = k >> L, z = k & (N - 1), out = []; for (let q = L - 1; q >= 0; q--) { const a = x >> q & 1, b = z >> q & 1; if (a || b) out.push({ q, p: a && b ? 'Y' : a ? 'X' : 'Z' }); } return out; };
  // a string's kind for drawing: 'loops' (diagonal: I and Z strings, self-loops of sign +1 or -1), 'hops' (it moves
  // the walker across x: cube edges for one bit, face diagonals for two, body diagonals for three)
  const kind = (k, L) => (k >> L ? 'hops' : 'loops');
  const ys = (k, L) => pop((k >> L) & k & ((1 << L) - 1));
  // two strings anticommute when their symplectic product is odd; their product is the string k1 ^ k2 (up to a phase)
  const anti = (a, b, L) => { const N = 1 << L, xa = a >> L, za = a & (N - 1), xb = b >> L, zb = b & (N - 1); return (pop(xa & zb) + pop(za & xb)) & 1; };

  // ------------------------------------------------------------------ the algebras
  // the closure of a set of strings under commutators: [P, Q] = 2 P Q when they anticommute (a string, up to a
  // phase), 0 when they commute. Returns the strings, sorted.
  function closure(gens, L) {
    const list = [...new Set(gens)], seen = new Set(list);
    for (let i = 0; i < list.length; i++) for (let j = 0; j < i; j++) {
      if (!anti(list[i], list[j], L)) continue;
      const p = list[i] ^ list[j];
      if (!seen.has(p)) { seen.add(p); list.push(p); }
    }
    return list.sort((a, b) => a - b);
  }
  // the generators: 'tfim' = X_q on every qubit and Z_q Z_(q+1) on neighbors (the TFIM chain, so(2L));
  // 'odd' = the same plus Z on the top qubit q(L-1) (so(2L+1)); in the circuit's order: X0 .. X(L-1), then
  // Z(L-1)Z(L-2) .. Z1Z0, then the boundary Z
  function generators(kindName, L) {
    const N = 1 << L, g = [];
    for (let q = 0; q < L; q++) g.push((1 << q) << L);
    for (let q = L - 2; q >= 0; q--) g.push((1 << q) | (1 << (q + 1)));
    if (kindName === 'odd') g.push(1 << (L - 1));
    return g.filter(k => k > 0 && k < N * N);
  }
  const ALG = { tfim: { label: L => `so(${2 * L})`, name: 'TFIM chain' }, odd: { label: L => `so(${2 * L + 1})`, name: 'TFIM chain with a boundary Z' } };
  const algCache = {};
  function algebra(kindName, L) {
    const id = kindName + L;
    if (algCache[id]) return algCache[id];
    const gens = generators(kindName, L), basis = closure(gens, L);
    return (algCache[id] = { kind: kindName, L, gens, basis, set: new Set(basis), dim: basis.length, label: ALG[kindName].label(L), name: ALG[kindName].name });
  }
  // the fit of weights c (from pauli()) to an algebra: the traceless part's squared norm T (sum over k != 0 of |c_k|^2),
  // the share inside the algebra's span, the share on its generators, and the residual sqrt(1 - inside), which is
  // ||A0 - Pi A0||_F / ||A0||_F (every string has the same norm, so the projection keeps the weights inside)
  function fit(c, L, alg) {
    const M = 1 << (2 * L), sq = k => c.re[k] * c.re[k] + (c.im ? c.im[k] * c.im[k] : 0);
    let T = 0, I = 0, G = 0;
    for (let k = 1; k < M; k++) T += sq(k);
    for (const k of alg.basis) if (k) I += sq(k);
    for (const k of alg.gens) G += sq(k);
    return { total: T, inside: T ? I / T : 1, gens: T ? G / T : 1, residual: T ? Math.sqrt(Math.max(0, 1 - I / T)) : 0 };
  }
  // the strings by weight, largest first (ties by index); zero weights left out
  function order(c, eps = 1e-12) {
    const M = c.re.length, ids = [];
    for (let k = 0; k < M; k++) if (Math.hypot(c.re[k], c.im ? c.im[k] : 0) > eps) ids.push(k);
    return ids.sort((a, b) => Math.hypot(c.re[b], c.im ? c.im[b] : 0) - Math.hypot(c.re[a], c.im ? c.im[a] : 0) || a - b);
  }
  // the matrix rebuilt from the first k strings of an order, and the error left: ||M - M_k||_F / ||M||_F
  const rebuild = (c, L, ord, k) => fromPauli(c, L, ord.slice(0, k));
  function errors(c, ord) {
    const sq = k => c.re[k] * c.re[k] + (c.im ? c.im[k] * c.im[k] : 0);
    let tot = 0; for (const k of ord) tot += sq(k);
    const out = [1]; let left = tot;
    for (const k of ord) { left -= sq(k); out.push(tot ? Math.sqrt(Math.max(0, left) / tot) : 0); }
    return out;   // out[j] = the error with the first j strings
  }
  // One Trotter step of e^(-iKt), K = I - A_c, on the generators: a gate R_P(theta) = exp(-i theta P / 2) per generator,
  // theta = -2 c_P t (with c_P = tr(P A_c) / 2^L); on the generator part it equals e^(+i A_c t) up to a global phase.
  function trotter(c, L, alg, t = 1) {
    return alg.gens.map(k => {
      const p = parts(k, L), type = p.length === 2 ? 'RZZ' : 'R' + p[0].p;
      return { k, name: name(k, L), type, qubits: p.map(o => o.q), c: c.re[k], theta: -2 * c.re[k] * t };
    });
  }

  // ------------------------------------------------------------------ a whole analysis
  // a network's cut (found or random, 3 bits, cached), its first L bits, A_c balanced, the weights and the fits
  const cuts = {};
  function cut3(netKey, how) {
    const id = netKey + ':' + how;
    if (!cuts[id]) { const net = network(netKey); cuts[id] = how === 'random' ? randomCut(net, 3) : cut(net, 3); }
    return cuts[id];
  }
  const anCache = {};
  function analyze(netKey, o = {}) {
    const L = o.L || 3, how = o.cut || 'found', id = `${netKey}:${how}:${L}`;
    if (anCache[id]) return anCache[id];
    const net = network(netKey), code = prefix(cut3(netKey, how), 3, L), N = 1 << L;
    const raw = coarse(net, code, L), Ac = sinkhorn(raw, N), c = pauli(Ac, L), ord = order(c);
    const algs = { tfim: algebra('tfim', L), odd: algebra('odd', L) };
    const fits = { tfim: fit(c, L, algs.tfim), odd: fit(c, L, algs.odd) };
    let cutLinks = 0;
    for (let e = 0; e < net.m; e++) if (code[net.edges[2 * e]] !== code[net.edges[2 * e + 1]]) cutLinks++;
    return (anCache[id] = {
      net: netKey, cut: how, L, N, code, sizes: sizes(code, L), purity: purity(net, code, L), raw, Ac, c, order: ord,
      errors: errors(c, ord), fits, cubeShare: cubeShare(Ac, N), cutShare: net.m ? cutLinks / net.m : 0,
      trotter: { tfim: trotter(c, L, algs.tfim), odd: trotter(c, L, algs.odd) },
    });
  }

  // ------------------------------------------------------------------ a layout for drawing
  // force-directed (Fruchterman-Reingold), seeded and deterministic: dim 2 or 3, positions in about [-1, 1]; 'init' (a
  // function gene -> [x, y, z]) seeds it. Returns a Float32Array(n * 3) (z = 0 in 2D).
  function layout(net, o = {}) {
    const n = net.n, dim = o.dim || 3, r = rng(o.seed || 3), P = new Float64Array(n * 3), F = new Float64Array(n * 3);
    for (let i = 0; i < n; i++) {
      const p = o.init ? o.init(i) : [r() * 2 - 1, r() * 2 - 1, dim === 3 ? r() * 2 - 1 : 0];
      for (let d = 0; d < 3; d++) P[3 * i + d] = d < dim ? p[d] + (r() - 0.5) * 0.02 : 0;
    }
    const iters = o.iters || 60, kk = (o.k || 1) * Math.pow((dim === 3 ? 8 : 4) / n, 1 / dim), grav = o.gravity || 0.1;
    let temp = o.temp || 0.2;
    for (let it = 0; it < iters; it++) {
      F.fill(0);
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
        const d2 = dx * dx + dy * dy + dz * dz + 1e-6, f = kk * kk / d2;
        F[3 * i] += dx * f; F[3 * i + 1] += dy * f; F[3 * i + 2] += dz * f;
        F[3 * j] -= dx * f; F[3 * j + 1] -= dy * f; F[3 * j + 2] -= dz * f;
      }
      for (let e = 0; e < net.m; e++) {
        const i = net.edges[2 * e], j = net.edges[2 * e + 1];
        const dx = P[3 * i] - P[3 * j], dy = P[3 * i + 1] - P[3 * j + 1], dz = P[3 * i + 2] - P[3 * j + 2];
        const d = Math.sqrt(dx * dx + dy * dy + dz * dz) + 1e-9, f = d / kk;
        F[3 * i] -= dx * f; F[3 * i + 1] -= dy * f; F[3 * i + 2] -= dz * f;
        F[3 * j] += dx * f; F[3 * j + 1] += dy * f; F[3 * j + 2] += dz * f;
      }
      for (let i = 0; i < n; i++) {
        for (let d = 0; d < dim; d++) F[3 * i + d] -= grav * P[3 * i + d] * n * kk;
        const l = Math.hypot(F[3 * i], F[3 * i + 1], F[3 * i + 2]) || 1, s = Math.min(l, temp) / l;
        for (let d = 0; d < dim; d++) P[3 * i + d] += F[3 * i + d] * s;
      }
      temp *= 0.95;
    }
    // centered and scaled to radius 1 (the 98th percentile)
    const cen = [0, 0, 0];
    for (let i = 0; i < n; i++) for (let d = 0; d < 3; d++) cen[d] += P[3 * i + d] / n;
    const rr = [];
    for (let i = 0; i < n; i++) { for (let d = 0; d < 3; d++) P[3 * i + d] -= cen[d]; rr.push(Math.hypot(P[3 * i], P[3 * i + 1], P[3 * i + 2])); }
    rr.sort((a, b) => a - b);
    const s = 1 / (rr[Math.floor(n * 0.98)] || 1);
    return Float32Array.from(P, v => v * s);
  }

  // ------------------------------------------------------------------ small facts for the text
  // the number of unordered pairs of n genes
  const pairs = n => n * (n - 1) / 2;
  // the dimension of so(m): m (m - 1) / 2; at L bits so(2L) has L(2L - 1), so(2L + 1) has L(2L + 1)
  const soDim = m => m * (m - 1) / 2;
  // the colors of the 8 cells (by code), the same in every set and pane
  const CELL_COLORS = ['#46d9ff', '#3ee08f', '#ffd166', '#ff8fd8', '#b9a6ff', '#7df0c8', '#ff9e6b', '#8fb8ff'];

  return {
    rng, pop, NETS, DEFAULT, network, planted, random, modes, cut, randomCut, prefix, purity, sizes, cut3,
    coarse, sinkhorn, cubeShare, wht, pauli, fromPauli, entry, name, parse, parts, kind, ys, anti,
    closure, generators, algebra, fit, order, rebuild, errors, trotter, analyze, layout, pairs, soDim, CELL_COLORS,
  };
})();

// QUBITS_DATA: the real run's numbers, typed in exactly as Joel Hancock's brief for this visualization gives them
// (21 Oct 2026, "Prompt: visualize network compression and the Pauli decomposition"; the brief's sections are named
// below). Everything else the story shows is computed live from example networks (QMATH, sets/qmath.js). The story
// says "in the real network" wherever it uses these numbers. American spelling in this story (the brief asks for it).
// Fields:
//   credit        who to credit: the method and the figures the story follows
//   network       the real network (brief, "1. The network"): STRING v12.5 physical protein interactions, combined
//                 score >= 500, mapped to HGNC gene symbols, largest connected component: genes
//   run           the full run (brief, "2. Bisections"): bits (8), cells (256), genes per cell (about 63); the picture
//                 uses 3 bits (8 cells)
//   cells3[]      the 3-bit cells of the main run { code, name (informal, read from gene families, not a GO
//                 enrichment), genes } (brief, "2. Bisections"); the owner chose example networks throughout, so the
//                 story need not show these
//   cubeShare     % of the coupling between cells on cube edges at 3 bits (brief, "3. The coarse operator")
//   weights3[]    the 3-bit A_c's largest Pauli weights, largest first [name, weight] (brief, "4. The Pauli
//                 decomposition"; the bottom row of the reference figure), and a tail not listed
//   outside3[]    the strings of weights3 outside so(7) (gray in the reference figure); I is the trace part
//   so7           at 3 bits: % of A_c's traceless weight on so(7)'s generators (gens) and in the whole algebra (whole)
//                 (brief, "5. Inside and outside the algebra")
//   residual      best residual by depth, main run, best algebra of the panel, ours and random partitions (bits 2..8;
//                 at 1 bit every partition has residual 0), and the best 8-bit variant (K = 256): 0.82
//   circuit       one Trotter step of e^(-iKt) at 3 bits in so(7) (brief, "Optional closing frame"): gates in time
//                 order { type, qubits, theta (rad) }, t, the convention
//   hamiltonian   the conventions (brief, "Conventions you must follow")
const QUBITS_DATA = {
  credit: 'Joel Hancock (the method and the figures it follows)',
  network: { source: 'STRING v12.5', kind: 'physical protein interactions', score: 500, mapping: 'HGNC gene symbols',
    component: 'largest connected component', genes: 16064 },
  run: { bits: 8, cells: 256, genesPerCell: 63, pictureBits: 3 },
  cells3: [
    { code: '000', name: 'Membrane signaling', genes: 2027 },
    { code: '001', name: 'RNA processing', genes: 2222 },
    { code: '010', name: 'Extracellular matrix', genes: 1954 },
    { code: '011', name: 'Folding and degradation', genes: 1987 },
    { code: '100', name: 'Olfaction and plasma', genes: 1953 },
    { code: '101', name: 'Cell cycle and ubiquitin', genes: 1928 },
    { code: '110', name: 'Respiratory chain', genes: 1987 },
    { code: '111', name: 'Gene expression', genes: 2006 },
  ],
  cubeShare: 61,
  weights3: [['I', 0.40], ['X1', 0.20], ['X2X1', 0.13], ['X2', 0.11], ['Z2Z1', 0.08], ['Y2Y1', 0.07], ['X0', 0.06],
    ['Z0', 0.05], ['X1X0', 0.04]],
  outside3: ['X2X1', 'Z0', 'X1X0'],
  so7: { gens: 66, whole: 73 },
  residual: {
    bits: [1, 2, 3, 4, 5, 6, 7, 8],
    ours: [0, 0.44, 0.52, 0.56, 0.68, 0.74, 0.81, 0.88],
    random: [0, 0.57, 0.75, 0.86, 0.92, 0.95, 0.97, 0.99],
    best8: 0.82, best8Variant: 'K = 256',
  },
  circuit: {
    bits: 3, algebra: 'so(7)', t: 1,
    gates: [
      { type: 'RX', qubits: [0], theta: -0.112 },
      { type: 'RX', qubits: [1], theta: -0.396 },
      { type: 'RX', qubits: [2], theta: -0.222 },
      { type: 'RZZ', qubits: [2, 1], theta: -0.163 },
      { type: 'RZZ', qubits: [1, 0], theta: 0.039 },
      { type: 'RZ', qubits: [2], theta: 0.029 },
    ],
    convention: 'theta = -2ct with c = tr(P A_c)/8 and R_P(theta) = exp(-i theta P/2); red for X-type gates, blue for Z-type, shaded by |theta|',
  },
  hamiltonian: { H: 'H = K + c V + rho R', K: 'K = I - A_c', V: 'V = -Diag(D)', R: 'R, the exchange operator between the two walkers (never written SWAP)' },
};

// QLOOK: the qubits story's shared look, used by its sets: lit, glowing tubes, rings and balls drawn as instanced
// meshes that a set refills every frame (a few hundred instances: cheap), plus soft halos. Solid or dashed (sign:
// solid +, dashed -), in the brief's visual language (purple edges, red and blue for +1 and -1).
// QLOOK(K, set) -> { tubes(max), rings(max), balls(max), boxes(max), halos(max), PURPLE, RED, BLUE, GRAY, ... }; each pool has
// begin(), add(...), end() (call end() after the adds: it sets the count and uploads), and .mesh (add it to a group).
const QLOOK = function (K, set) {
  const { THREE, rgb } = K;
  const FRAG = `
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  if (vD > 0.5 && fract(vU * vD) > 0.56) discard;   // dashed: a negative sign
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  vec3 l = normalize(vec3(-0.45, 0.55, 0.7));          // over the viewer's left shoulder, as the scene's light
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 28.0);
  vec3 col = vC * (0.3 + 0.5 * dif + 0.2 * hemi) + vC * rim * 0.9 + vec3(spec * 0.3);
  gl_FragColor = vec4(col, vA);
}`;
  const mat = vertex => {
    const m = new THREE.ShaderMaterial({ uniforms: { uA: set.uA }, vertexShader: vertex, fragmentShader: FRAG, transparent: true, side: THREE.DoubleSide });
    set.mats.push(m);
    return m;
  };
  const VTUBE = `
attribute vec3 aCol; attribute float aA, aDash;
uniform float uA;
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = -mv.xyz; vC = aCol; vA = aA * uA; vU = uv.y; vD = aDash;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const VRING = `
attribute vec2 aUV, aRr; attribute vec3 aCol; attribute float aA, aDash;
uniform float uA;
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  float cu = cos(aUV.x), su = sin(aUV.x), cv = cos(aUV.y), sv = sin(aUV.y), R = aRr.x + aRr.y * cv;
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(R * cu, R * su, aRr.y * sv, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * vec3(cv * cu, cv * su, sv));
  vV = -mv.xyz; vC = aCol; vA = aA * uA; vU = aUV.x / 6.2831853; vD = aDash;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  // per-instance attributes on an instanced mesh
  function pool(geo, material, max, extra) {
    const g = new THREE.BufferGeometry();
    for (const k in geo.attributes) g.setAttribute(k, geo.attributes[k]);
    g.setIndex(geo.index);
    const A = { aCol: 3, aA: 1, aDash: 1 };
    Object.assign(A, extra || {});
    const attrs = {};
    for (const k in A) { attrs[k] = new THREE.InstancedBufferAttribute(new Float32Array(max * A[k]), A[k]); attrs[k].setUsage(THREE.DynamicDrawUsage); g.setAttribute(k, attrs[k]); }
    const mesh = new THREE.InstancedMesh(g, material, max);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false; mesh.count = 0;
    const P = { mesh, attrs, n: 0, max };
    P.begin = () => { P.n = 0; };
    P.end = () => {
      mesh.count = P.n; mesh.instanceMatrix.needsUpdate = true;
      for (const k in attrs) { attrs[k].needsUpdate = true; }
    };
    P.put = (m, col, a, dash) => {
      if (P.n >= max) return -1;
      const i = P.n++;
      mesh.setMatrixAt(i, m);
      const c = Array.isArray(col) ? col : rgb(col);
      attrs.aCol.array[3 * i] = c[0]; attrs.aCol.array[3 * i + 1] = c[1]; attrs.aCol.array[3 * i + 2] = c[2];
      attrs.aA.array[i] = a; attrs.aDash.array[i] = dash || 0;
      return i;
    };
    return P;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);
  // tubes: open cylinders from a to b, radius r; dash = the number of dashes along it (0 solid)
  function tubes(max) {
    const P = pool(new THREE.CylinderGeometry(1, 1, 1, 10, 1, true), mat(VTUBE), max);
    P.add = (a, b, r, col, alpha, dash) => {
      _d.set(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
      const len = _d.length();
      if (len < 1e-6 || r <= 0 || alpha <= 0.004) return -1;
      _q.setFromUnitVectors(_y, _d.multiplyScalar(1 / len));
      _p.set((a[0] + b[0]) / 2, (a[1] + b[1]) / 2, (a[2] + b[2]) / 2);
      _m.compose(_p, _q, _s.set(r, len, r));
      return P.put(_m, col, alpha, dash ? Math.max(2, Math.round(dash)) : 0);
    };
    return P;
  }
  // rings: a torus around center c, its axis 'axis', major radius R, tube radius r; dash = dashes around it
  function rings(max) {
    const U = 40, V = 8, pos = [], uv = [], idx = [];
    for (let i = 0; i <= U; i++) for (let j = 0; j <= V; j++) { const u = i / U * Math.PI * 2, v = j / V * Math.PI * 2; uv.push(u, v); pos.push(Math.cos(u), Math.sin(u), 0); }
    for (let i = 0; i < U; i++) for (let j = 0; j < V; j++) { const a = i * (V + 1) + j, b = a + V + 1; idx.push(a, b, a + 1, b, b + 1, a + 1); }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('aUV', new THREE.Float32BufferAttribute(uv, 2));
    geo.setIndex(idx);
    const P = pool(geo, mat(VRING), max, { aRr: 2 });
    P.add = (c, axis, R, r, col, alpha, dash) => {
      if (R <= 0 || alpha <= 0.004) return -1;
      _d.set(axis[0], axis[1], axis[2]).normalize();
      _q.setFromUnitVectors(_z, _d);
      _m.compose(_p.set(c[0], c[1], c[2]), _q, _s.set(1, 1, 1));
      const i = P.put(_m, col, alpha, dash ? Math.max(4, Math.round(dash)) : 0);
      if (i >= 0) { P.attrs.aRr.array[2 * i] = R; P.attrs.aRr.array[2 * i + 1] = r; }
      return i;
    };
    return P;
  }
  // balls: lit spheres at p, radius r
  function balls(max) {
    const P = pool(new THREE.SphereGeometry(1, 16, 12), mat(VTUBE), max);
    P.add = (p, r, col, alpha) => {
      if (r <= 0 || alpha <= 0.004) return -1;
      _m.compose(_p.set(p[0], p[1], p[2]), _q.set(0, 0, 0, 1), _s.set(r, r, r));
      return P.put(_m, col, alpha, 0);
    };
    return P;
  }
  // boxes: lit blocks at p, sizes [sx, sy, sz] (gates)
  function boxes(max) {
    const P = pool(new THREE.BoxGeometry(1, 1, 1), mat(VTUBE), max);
    P.add = (p, sz, col, alpha) => {
      if (alpha <= 0.004) return -1;
      _m.compose(_p.set(p[0], p[1], p[2]), _q.set(0, 0, 0, 1), _s.set(sz[0], sz[1], sz[2]));
      return P.put(_m, col, alpha, 0);
    };
    return P;
  }
  // halos: soft additive glows (the kit's points), size in local units
  function halos(max) {
    const g = K.pointsGeo(max), m = K.points(set), pts = new THREE.Points(g, m);
    pts.frustumCulled = false;
    const P = { mesh: pts, n: 0 };
    const pa = g.attributes.position.array, ca = g.attributes.aCol.array, sa = g.attributes.aSize.array, aa = g.attributes.aA.array;
    P.begin = () => { P.n = 0; };
    P.add = (p, size, col, alpha) => {
      if (P.n >= max || alpha <= 0.004) return;
      const i = P.n++, c = Array.isArray(col) ? col : rgb(col);
      pa[3 * i] = p[0]; pa[3 * i + 1] = p[1]; pa[3 * i + 2] = p[2];
      ca[3 * i] = c[0]; ca[3 * i + 1] = c[1]; ca[3 * i + 2] = c[2];
      sa[i] = size; aa[i] = alpha;
    };
    P.end = () => {
      g.setDrawRange(0, P.n);
      for (const k of ['position', 'aCol', 'aSize', 'aA']) g.attributes[k].needsUpdate = true;
    };
    return P;
  }
  // depth writes only while the set is fully in (fading glass would hide what is behind it)
  const depth = () => { const on = set.uA.value > 0.97; for (const m of set.mats) if (m.blending === THREE.NormalBlending) m.depthWrite = on; };
  const mix = (a, b, t) => [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t, a[2] + (b[2] - a[2]) * t];
  return {
    tubes, rings, balls, boxes, halos, depth, mix,
    PURPLE: rgb('#9a90ff'), RED: rgb('#ff5a4b'), BLUE: rgb('#4d94ff'), GRAY: rgb('#5d6676'), INK: rgb('#e7eef8'),
    AMBER: rgb('#ffb43b'), CELL: QMATH.CELL_COLORS.map(rgb),
  };
};

// The pairs set of the qubits story: why look at pairs (genes, and the grid of all their pairs growing until it fills
// the view), the network drawn as a city map with two walkers (one per gene of a pair) wandering its streets and
// settling in the valleys (illustrative: the valleys stand for the data term V, which this story does not model), a
// tiny chip with three qubits, and the map folding into eight neighborhoods with three-digit codes (the cells of the
// example network's cut: QMATH, sets/qmath.js).
// The map is the story's example network (QMATH.DEFAULT) laid out flat (force-directed, seeded; its eight groups
// start on a ring in Gray-code order, so neighborhoods next to each other differ in one digit). Everything follows the
// params and t: the walkers' routes are planned at load and read off by time.
SETS.pairs = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rgb } = K;
  const set = K.newSet('pairs');
  const Q = QMATH, LK = QLOOK(K, set), PI = Math.PI;
  const NMAX = 240, Y0 = -0.3;   // the most genes in the grid of pairs; the map's ground level
  const spOf = nn => Math.min(0.16, 2.1 / nn);   // the grid's spacing: it keeps to about the view's size

  // ---------------------------------------------------------------- genes and the grid of their pairs
  // gene i sits on the diagonal at (x_i, y_i); the pair (i, j), i < j, at (x_i, y_j): a triangle that fills in as genes
  // are added (n from 6 to 240), its spacing shrinking so it keeps to the view
  const NP = NMAX * (NMAX - 1) / 2;
  const triU = { uN: { value: 6 }, uSp: { value: 0.16 }, uPairA: { value: 0 }, uGeneA: { value: 0 } };
  const triV = `
uniform float uN, uSp;
vec2 cellXY(float i, float j) { float w = (uN - 1.0) * uSp; return vec2(-0.5 * w + i * uSp, -0.5 * w + j * uSp); }`;
  const triMat = (geneRow) => {
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, triU),
      transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: K.GLSL + triV + `
attribute vec2 aIJ; attribute float aSeed;
uniform float uA, uPairA, uGeneA;
varying vec3 vC; varying float vA;
void main() {
  float i = aIJ.x, j = aIJ.y;
  vec2 xy = cellXY(i, j);
  vec4 mv = modelViewMatrix * vec4(xy, ${geneRow ? '0.01' : '0.0'}, 1.0);
  gl_Position = projectionMatrix * mv;
  float show = clamp(uN - j, 0.0, 1.0);
  ${geneRow
    ? 'vC = vec3(0.75, 0.95, 1.0); vA = uA * uGeneA * show; gl_PointSize = pointPx(max(uSp * 0.75, 0.014), mv);'
    : 'float tw = 0.7 + 0.3 * sin(uTime * 2.0 + aSeed * 60.0); vC = mix(vec3(0.55, 0.5, 1.0), vec3(0.35, 0.85, 1.0), aSeed); vA = uA * uPairA * show * tw * mix(1.0, 0.55, smoothstep(30.0, 200.0, uN)); gl_PointSize = pointPx(max(uSp * 0.5, 0.006), mv);'}
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.2, d) * 0.9, pow(1.0 - d * 2.0, 1.5) * 0.5); gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.2, 0.0, d) * 0.4), vA * a); }`,
    });
    set.mats.push(m);
    return m;
  };
  {
    const r = K.rng(5), ij = new Float32Array(NP * 2), sd = new Float32Array(NP);
    let o = 0;
    for (let j = 1; j < NMAX; j++) for (let i = 0; i < j; i++) { ij[2 * o] = i; ij[2 * o + 1] = j; sd[o++] = r(); }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NP * 3), 3));
    g.setAttribute('aIJ', new THREE.BufferAttribute(ij, 2)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const gg = new THREE.BufferGeometry(), gij = new Float32Array(NMAX * 2);
    for (let i = 0; i < NMAX; i++) { gij[2 * i] = i; gij[2 * i + 1] = i; }
    gg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(NMAX * 3), 3));
    gg.setAttribute('aIJ', new THREE.BufferAttribute(gij, 2)); gg.setAttribute('aSeed', new THREE.BufferAttribute(new Float32Array(NMAX), 1));
    const pp = new THREE.Points(g, triMat(false)), gp = new THREE.Points(gg, triMat(true));
    pp.frustumCulled = gp.frustumCulled = false;
    set.group.add(pp, gp);
  }

  // ---------------------------------------------------------------- the map
  const net = Q.network(Q.DEFAULT), A3 = Q.analyze(Q.DEFAULT, { L: 3 }), code = A3.code, n = net.n;
  const GRAY = [0, 1, 3, 2, 6, 7, 5, 4], ringOf = c => GRAY.indexOf(c);
  const hood = c => { const a = ringOf(c) / 8 * 2 * PI + PI / 8; return [0.66 * Math.cos(a), 0.66 * Math.sin(a)]; };
  const P = Q.layout(net, { dim: 2, iters: 50, seed: 9, init: g => { const h = hood(code[g]); return [h[0] * 0.8, h[1] * 0.8, 0]; } });
  const MP = new Float32Array(n * 2), FP = new Float32Array(n * 2);   // the map's places, and folded into the hoods
  const cen = [...Array(8)].map(() => [0, 0, 0]);
  for (let g = 0; g < n; g++) { MP[2 * g] = P[3 * g] * 1.02; MP[2 * g + 1] = P[3 * g + 1] * 1.02; const c = cen[code[g]]; c[0] += MP[2 * g]; c[1] += MP[2 * g + 1]; c[2]++; }
  for (let g = 0; g < n; g++) { const c = cen[code[g]], h = hood(code[g]); FP[2 * g] = h[0] + (MP[2 * g] - c[0] / c[2]) * 0.3; FP[2 * g + 1] = h[1] + (MP[2 * g + 1] - c[1] / c[2]) * 0.3; }
  // two valleys, on opposite sides of the map: around the best-linked gene of two cells far apart on the ring
  const best = c => { let b = -1; for (let g = 0; g < n; g++) if (code[g] === c && (b < 0 || net.deg[g] > net.deg[b])) b = g; return b; };
  const VG = [best(GRAY[1]), best(GRAY[5])], SIG = 0.17;
  const VC = VG.map(g => [MP[2 * g], MP[2 * g + 1]]);
  const mapU = { uDepth: { value: 0 }, uSig: { value: SIG }, uV0: { value: new THREE.Vector2(...VC[0]) }, uV1: { value: new THREE.Vector2(...VC[1]) },
    uFold: { value: 0 }, uMapA: { value: 0 }, uHood: { value: -1 }, uCol: { value: LK.CELL.map(c => new THREE.Color(...c)) } };
  const GROUND = `
uniform float uDepth, uSig, uFold, uMapA, uHood; uniform vec2 uV0, uV1; uniform vec3 uCol[8];
float well(vec2 p) { return exp(-dot(p - uV0, p - uV0) / (uSig * uSig)) + exp(-dot(p - uV1, p - uV1) / (uSig * uSig)); }
float ground(vec2 p) { return -uDepth * well(p); }`;
  const ground = (x, z) => { const D = mapU.uDepth.value, s2 = SIG * SIG; let w = 0; for (const v of VC) w += Math.exp(-((x - v[0]) ** 2 + (z - v[1]) ** 2) / s2); return Y0 - D * w; };
  const mapG = new THREE.Group(); mapG.position.y = Y0; set.group.add(mapG);
  // the ground: a disc of city blocks; the valleys dip and glow
  {
    const geo = new THREE.PlaneGeometry(2.7, 2.7, 96, 96); geo.rotateX(-PI / 2);
    const m = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA }, mapU), transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: GROUND + `
varying vec2 vP; varying float vW;
void main() { vP = position.xz; vW = well(vP); vec3 p = vec3(position.x, ground(vP), position.z); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0); }`,
      fragmentShader: `uniform float uA, uMapA, uDepth; varying vec2 vP; varying float vW;
void main() {
  float r = length(vP), edge = 1.0 - smoothstep(1.05, 1.3, r);
  vec2 g = abs(fract(vP * 9.0) - 0.5); float block = smoothstep(0.44, 0.5, max(g.x, g.y));
  vec3 col = mix(vec3(0.035, 0.05, 0.09), vec3(0.09, 0.12, 0.2), block * 0.6);
  float glow = clamp(vW, 0.0, 1.0) * clamp(uDepth * 9.0, 0.0, 1.0);
  col += vec3(1.0, 0.62, 0.18) * glow * 0.75;
  gl_FragColor = vec4(col, uA * uMapA * edge * (0.85 + 0.15 * glow));
}`,
    });
    set.mats.push(m);
    const mesh = new THREE.Mesh(geo, m); mesh.renderOrder = -1;
    mapG.add(mesh);
  }
  // streets and street lights (the links and the genes), on the ground, folding into the neighborhoods
  const streetV = `
attribute vec2 aMap, aFoldP; attribute float aCode;
vec3 placeOf() { vec2 p = mix(aMap, aFoldP, smoothstep(0.0, 1.0, uFold)); return vec3(p.x, ground(p) + 0.006, p.y); }`;
  {
    const m = net.m, a = new Float32Array(m * 4), f = new Float32Array(m * 4), c = new Float32Array(m * 2), o = new Float32Array(m * 2);
    for (let e = 0; e < m; e++) {
      const i = net.edges[2 * e], j = net.edges[2 * e + 1];
      a.set([MP[2 * i], MP[2 * i + 1], MP[2 * j], MP[2 * j + 1]], 4 * e); f.set([FP[2 * i], FP[2 * i + 1], FP[2 * j], FP[2 * j + 1]], 4 * e);
      c[2 * e] = code[i]; c[2 * e + 1] = code[j]; o[2 * e] = code[j]; o[2 * e + 1] = code[i];
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(m * 6), 3));
    g.setAttribute('aMap', new THREE.BufferAttribute(a, 2)); g.setAttribute('aFoldP', new THREE.BufferAttribute(f, 2));
    g.setAttribute('aCode', new THREE.BufferAttribute(c, 1)); g.setAttribute('aOther', new THREE.BufferAttribute(o, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA }, mapU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: GROUND + streetV + `
attribute float aOther; uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 p = placeOf(); gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  float same = 1.0 - step(0.5, abs(aCode - aOther)), w = clamp(well(p.xz), 0.0, 1.0) * clamp(uDepth * 9.0, 0.0, 1.0);
  vec3 c = mix(vec3(0.45, 0.5, 0.75), uCol[int(aCode + 0.5)], uFold * same);
  float hi = uHood < 0.0 ? 1.0 : (abs(aCode - uHood) < 0.5 && same > 0.5 ? 1.6 : 0.35);
  vC = mix(c, vec3(1.0, 0.7, 0.3), w * 0.8);
  vA = uA * uMapA * (0.07 + 0.08 * w) * (1.0 - 0.6 * uFold * (1.0 - same)) * hi;
}`,
      fragmentShader: 'varying vec3 vC; varying float vA; void main() { if (vA < 0.003) discard; gl_FragColor = vec4(vC, vA); }',
    });
    set.mats.push(mat);
    const ls = new THREE.LineSegments(g, mat); ls.frustumCulled = false; mapG.add(ls);
  }
  {
    const g = new THREE.BufferGeometry(), a = new Float32Array(n * 2), f = new Float32Array(n * 2), c = new Float32Array(n), sd = new Float32Array(n), r = K.rng(8);
    for (let i = 0; i < n; i++) { a[2 * i] = MP[2 * i]; a[2 * i + 1] = MP[2 * i + 1]; f[2 * i] = FP[2 * i]; f[2 * i + 1] = FP[2 * i + 1]; c[i] = code[i]; sd[i] = r(); }
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 3), 3));
    g.setAttribute('aMap', new THREE.BufferAttribute(a, 2)); g.setAttribute('aFoldP', new THREE.BufferAttribute(f, 2));
    g.setAttribute('aCode', new THREE.BufferAttribute(c, 1)); g.setAttribute('aSeed', new THREE.BufferAttribute(sd, 1));
    const mat = new THREE.ShaderMaterial({
      uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, mapU), transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
      vertexShader: K.GLSL + GROUND + streetV + `
attribute float aSeed; uniform float uA; varying vec3 vC; varying float vA;
void main() {
  vec3 p = placeOf() + vec3(0.0, 0.012, 0.0); vec4 mv = modelViewMatrix * vec4(p, 1.0); gl_Position = projectionMatrix * mv;
  float w = clamp(well(p.xz), 0.0, 1.0) * clamp(uDepth * 9.0, 0.0, 1.0), hi = uHood < 0.0 ? 1.0 : (abs(aCode - uHood) < 0.5 ? 1.5 : 0.3);
  vC = mix(mix(vec3(0.8, 0.85, 1.0), uCol[int(aCode + 0.5)], uFold), vec3(1.0, 0.75, 0.35), w);
  vA = uA * uMapA * (0.75 + 0.25 * sin(uTime * 1.7 + aSeed * 50.0)) * hi;
  gl_PointSize = pointPx(0.022 + 0.01 * w, mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `varying vec3 vC; varying float vA;
void main() { vec2 c = gl_PointCoord - 0.5; float d = length(c); if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.2, d) * 0.9, pow(1.0 - d * 2.0, 1.5) * 0.5); gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.2, 0.0, d) * 0.4), vA * a); }`,
    });
    set.mats.push(mat);
    const pts = new THREE.Points(g, mat); pts.frustumCulled = false; mapG.add(pts);
  }

  // ---------------------------------------------------------------- the walkers: routes planned at load, read off by t
  const nbrs = g => Array.from(net.adj.subarray(net.off[g], net.off[g + 1]));
  function route(start, len, seed, inside) {
    const r = K.rng(seed), path = [start];
    for (let s = 1; s < len; s++) {
      const cur = path[s - 1], opts = nbrs(cur).filter(j => !inside || inside(j));
      path.push(opts.length ? opts[Math.floor(r() * opts.length)] : cur);
    }
    return path;
  }
  const inValley = v => g => Math.hypot(MP[2 * g] - VC[v][0], MP[2 * g + 1] - VC[v][1]) < SIG * 0.9;
  const startOf = c => { let b = 0; for (let g = 0; g < n; g++) if (code[g] === c) { b = g; break; } return b; };
  const W = [0, 1].map(w => ({ wander: route(startOf(GRAY[w ? 3 : 7]), 500, 101 + w), settled: route(VG[w], 300, 201 + w, inValley(w)) }));
  const SPEED = 1.15;
  const placeG = (g, fold) => { const x = lerp(MP[2 * g], FP[2 * g], fold), z = lerp(MP[2 * g + 1], FP[2 * g + 1], fold); return [x, ground(x, z), z]; };
  function along(path, t, fold) {
    const s = Math.max(0, t) * SPEED, i = Math.floor(s) % (path.length - 1), f = smooth(clamp((s - Math.floor(s)) * 1.4, 0, 1));
    const a = placeG(path[i], fold), b = placeG(path[i + 1], fold);
    return [lerp(a[0], b[0], f), lerp(a[1], b[1], f), lerp(a[2], b[2], f)];
  }
  const walkerAt = (w, t, settle, fold) => {
    const a = along(W[w].wander, t + w * 7.3, fold), b = along(W[w].settled, t * 0.6 + w * 3.1, fold), e = smooth(settle);
    const p = [lerp(a[0], b[0], e), 0, lerp(a[2], b[2], e)];
    p[1] = ground(p[0], p[2]) + 0.04;
    return p;
  };

  // ---------------------------------------------------------------- the chip: three qubits
  const CHIP = [1.32, -0.08, 0.36];
  const chip = new THREE.Group(); chip.position.set(...CHIP); chip.rotation.set(0.55, -0.35, 0); chip.scale.setScalar(1.35); set.group.add(chip);
  {
    const mk = (geo, col, o = {}) => { const m = K.fade(set, new THREE.MeshStandardMaterial(Object.assign({ color: col, metalness: 0.3, roughness: 0.55 }, o))); return new THREE.Mesh(geo, m); };
    chip.add(mk(new THREE.BoxGeometry(0.46, 0.035, 0.46), '#161d2c'));
    const die = mk(new THREE.BoxGeometry(0.32, 0.014, 0.32), '#2a3552', { metalness: 0.5, roughness: 0.35 }); die.position.y = 0.024; chip.add(die);
    const pads = [];
    for (let s = 0; s < 4; s++) for (let k = 0; k < 6; k++) {
      const u = -0.16 + k * 0.064, p = [[u, 0.2], [u, -0.2], [0.2, u], [-0.2, u]][s];
      const b = new THREE.BoxGeometry(0.036, 0.008, 0.036); b.translate(p[0], 0.021, p[1]); pads.push(b);
    }
    chip.add(mk(K.merge(pads), '#d9b45a', { metalness: 0.85, roughness: 0.3 }));
    const crosses = [];
    for (let q = 0; q < 3; q++) {
      const x = 0.09 - q * 0.09;   // q0 right, q2 left, as the cube's corners read
      const a = new THREE.BoxGeometry(0.075, 0.007, 0.02), b = new THREE.BoxGeometry(0.02, 0.007, 0.075);
      a.translate(x, 0.034, 0); b.translate(x, 0.034, 0); crosses.push(a, b);
      const c = new THREE.BoxGeometry(0.05, 0.004, 0.008); c.translate(x - 0.045, 0.033, 0); if (q < 2) crosses.push(c);
    }
    chip.add(mk(K.merge(crosses), '#c9d2ff', { metalness: 0.6, roughness: 0.25, emissive: '#3a3f8a' }));
  }
  const qubitAt = q => { const v = new THREE.Vector3(0.09 - q * 0.09, 0.05, 0).multiplyScalar(1.35); v.applyEuler(chip.rotation).add(chip.position); return [v.x, v.y, v.z]; };

  // ---------------------------------------------------------------- the frame's moving parts (instanced, refilled)
  const balls = LK.balls(16), halos = LK.halos(80), tubes = LK.tubes(80), rings = LK.rings(16);
  set.group.add(balls.mesh, halos.mesh, tubes.mesh, rings.mesh);
  const WCOL = [rgb('#ff5ad9'), rgb('#46d9ff')];
  const now = { walkers: [[0, 0, 0], [0, 0, 0]], n: 6, code: -1 };
  function update(S, t) {
    LK.depth();
    const genes = clamp(S.pairs_genes, 0, 1), grid = clamp(S.pairs_grid, 0, 1), map = clamp(S.pairs_map, 0, 1);
    const tri = genes * (1 - map);
    const nn = 6 * Math.pow(NMAX / 6, grid);
    now.n = nn;
    triU.uN.value = nn; triU.uSp.value = spOf(nn);
    triU.uGeneA.value = tri; triU.uPairA.value = tri * prog(grid, 0, 0.04);
    const fold = smooth(clamp(S.pairs_fold, 0, 1)), valley = clamp(S.pairs_valley, 0, 1), hoodK = Math.round(clamp(S.pairs_code, 0, 8)) - 1;
    now.code = hoodK;
    mapU.uMapA.value = map; mapU.uFold.value = fold; mapU.uDepth.value = 0.11 * valley; mapU.uHood.value = hoodK >= 0 ? hoodK : -1;
    mapG.visible = map > 0.003;
    balls.begin(); halos.begin(); tubes.begin(); rings.begin();
    // the walkers and their trails; the pair they settle on joined by an arc
    const walk = clamp(S.pairs_walk, 0, 1) * map, settle = clamp(S.pairs_settle, 0, 1);
    if (walk > 0.003) {
      for (let w = 0; w < 2; w++) {
        const p = walkerAt(w, t, settle, fold);
        now.walkers[w] = p;
        balls.add(p, 0.03, WCOL[w], walk);
        halos.add(p, 0.16, WCOL[w], 0.7 * walk);
        for (let j = 1; j <= 10; j++) halos.add(walkerAt(w, t - j * 0.07, settle, fold), 0.06 * (1 - j / 12), WCOL[w], 0.35 * walk * (1 - j / 11));
      }
      const arc = walk * prog(settle, 0.6, 1);
      if (arc > 0.01) {
        const a = now.walkers[0], b = now.walkers[1], pts = [];
        for (let j = 0; j <= 16; j++) { const u = j / 16; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * PI) * 0.45, lerp(a[2], b[2], u)]); }
        for (let j = 0; j < 16; j++) tubes.add(pts[j], pts[j + 1], 0.008, LK.AMBER, arc, 0);
        halos.add(pts[8], 0.22, LK.AMBER, 0.5 * arc);
      }
    }
    // the neighborhoods: a ring around each, in its cell's color; one picked lights up and its code shows on the chip
    const chipA = clamp(S.pairs_chip, 0, 1);
    if (fold > 0.01 && map > 0.01) for (let c = 0; c < 8; c++) {
      const h = hood(c), on = hoodK < 0 ? 1 : c === hoodK ? 1.4 : 0.35;
      rings.add([h[0], ground(h[0], h[1]) + 0.01, h[1]], [0, 1, 0], 0.16 * (c === hoodK ? 1.12 : 1), 0.006, LK.mix(LK.CELL[c], [1, 1, 1], c === hoodK ? 0.3 : 0), map * fold * Math.min(1, on), 0);
      if (c === hoodK) halos.add([h[0], ground(h[0], h[1]) + 0.03, h[1]], 0.5, LK.CELL[c], 0.35 * map * fold);
    }
    if (chipA > 0.01) {
      for (let q = 0; q < 3; q++) {
        const bit = hoodK >= 0 ? (hoodK >> q) & 1 : 0.5 + 0.5 * Math.sin(t * 2.2 + q * 2.1), p = qubitAt(q);
        halos.add(p, 0.09 + 0.06 * bit, LK.mix([0.5, 0.55, 1], [0.6, 1, 1], bit), chipA * (0.25 + 0.75 * bit));
        balls.add(p, 0.012, LK.mix([0.4, 0.45, 0.8], [0.85, 1, 1], bit), chipA);
      }
      if (hoodK >= 0 && fold > 0.5) {
        const a = qubitAt(1), h = hood(hoodK), b = [h[0], ground(h[0], h[1]) + 0.04, h[1]], pts = [];
        for (let j = 0; j <= 14; j++) { const u = j / 14; pts.push([lerp(a[0], b[0], u), lerp(a[1], b[1], u) + Math.sin(u * PI) * 0.3, lerp(a[2], b[2], u)]); }
        for (let j = 0; j < 14; j++) tubes.add(pts[j], pts[j + 1], 0.004, LK.CELL[hoodK], chipA * map * 0.8, 0);
      }
    }
    balls.end(); halos.end(); tubes.end(); rings.end();
    chip.visible = chipA > 0.003;
    chip.children.forEach(m => { if (m.material) m.material.opacity = m.material.userData.base * set.uA.value * chipA; });
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const codeStr = c => c.toString(2).padStart(3, '0');
  const anchors = {
    tri: [0, 0, 0], genes0: () => { const w = (now.n - 1) * spOf(now.n); return [-0.5 * w, -0.5 * w, 0]; },
    corner: () => { const w = (Math.min(now.n, 12) - 1) * spOf(now.n); return [-0.5 * w - 0.12, 0.5 * w + 0.16, 0]; },
    map: [0, Y0, 0], walker0: () => now.walkers[0], walker1: () => now.walkers[1],
    valley0: [VC[0][0], Y0 - 0.05, VC[0][1]], valley1: [VC[1][0], Y0 - 0.05, VC[1][1]],
    chip: CHIP, q2: () => qubitAt(2), q1: () => qubitAt(1), q0: () => qubitAt(0),
  };
  for (let c = 0; c < 8; c++) anchors['hood' + c] = (() => { const h = hood(c); return [h[0] + 0.12, Y0 + 0.06, h[1]]; })();
  const fmtN = v => Math.round(v).toLocaleString('en-US');
  const labels = [
    { text: () => { const g = Math.round(now.n); return [`${fmtN(g)} genes`, ` · ${fmtN(g * (g - 1) / 2)} pairs`]; }, at: 'corner', cls: 'cyn', alpha: S => clamp(S.pairs_genes, 0, 1) * (1 - clamp(S.pairs_map, 0, 1)) },
    { text: ['Walker 1', ''], at: 'walker0', cls: 'mag', minor: true, alpha: S => clamp(S.pairs_walk, 0, 1) * clamp(S.pairs_map, 0, 1) * (1 - prog(S.pairs_settle, 0.5, 1)) * (1 - clamp(S.pairs_fold, 0, 1)) },
    { text: ['Walker 2', ''], at: 'walker1', cls: 'cyn', minor: true, alpha: S => clamp(S.pairs_walk, 0, 1) * clamp(S.pairs_map, 0, 1) * (1 - prog(S.pairs_settle, 0.5, 1)) * (1 - clamp(S.pairs_fold, 0, 1)) },
    { text: ['Valley', ' · illustrative'], at: 'valley0', cls: 'amb', alpha: S => prog(S.pairs_valley, 0.5, 1) * clamp(S.pairs_map, 0, 1) * (1 - clamp(S.pairs_fold, 0, 1)) },
    // (with a neighborhood picked, the chip's label reads its code: the three qubits' states)
    { text: () => ['Three qubits', now.code >= 0 ? ' · ' + codeStr(now.code) : ''], at: 'chip', cls: '', alpha: S => prog(S.pairs_chip, 0.5, 1) },
  ];
  for (let c = 0; c < 8; c++) labels.push({ text: [codeStr(c), ''], at: 'hood' + c, cls: 'cyn', alpha: S => {
    const k = Math.round(clamp(S.pairs_code, 0, 8)) - 1;
    return prog(S.pairs_fold, 0.6, 1) * clamp(S.pairs_map, 0, 1) * (k < 0 || k === c ? 1 : 0.45);
  } });
  const cam = {
    default: [18, 46, 3.6, 0.15, -0.3, 0],
    grid: [0, 3, 3.5, 0, 0, 0],
    map: [18, 46, 3.4, 0, -0.3, 0],
    walkers: [24, 34, 2.6, 0, -0.3, 0],
    chip: [-12, 34, 3.7, 0.45, -0.25, 0.1],
    hoods: [6, 58, 3.9, 0.35, -0.3, 0.05],
  };
  const controls = [{ key: 'view', label: 'View', options: [['pairs', 'Pairs'], ['map', 'Map'], ['walkers', 'Walkers'], ['hoods', 'Neighborhoods']] }];
  function explore(c) {
    const v = c.view || 'pairs', m = v === 'pairs' ? 0 : 1;
    return {
      pairs_genes: 1, pairs_grid: v === 'pairs' ? 1 : 0, pairs_map: m, pairs_walk: v === 'walkers' ? 1 : 0, pairs_valley: v === 'walkers' ? 1 : 0,
      pairs_settle: v === 'walkers' ? clamp((c.t - 4) / 4, 0, 1) : 0, pairs_chip: v === 'hoods' ? 1 : 0, pairs_fold: v === 'hoods' ? 1 : 0,
      // (the neighborhoods take turns: each one's code on the chip's three qubits)
      pairs_code: v === 'hoods' ? 1 + Math.floor((c.t || 0) / 1.6) % 8 : 0,
    };
  }
  const API = { genes: n, links: net.m, codes: [...Array(8).keys()].map(codeStr), hood: c => hood(c), nmax: NMAX };
  return Object.assign(set, {
    params: { pairs_a: 1, pairs_genes: 1, pairs_grid: 0, pairs_map: 1, pairs_walk: 1, pairs_valley: 1, pairs_settle: 0, pairs_chip: 0, pairs_fold: 0, pairs_code: 0 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};

// The cube set of the qubits story: an example network cut in two, in four and in eight (each cut one digit of a
// gene's code; the cells at the corners of a cube), the coarse operator A_c on the cube (a loop at each corner, purple
// edges as wide as the coupling), Pauli strings as small cubes in a gallery with their weights, added one by one into
// the big cube while the error left shrinks, and the toolbox: the strings inside an algebra stay bright, the rest go
// gray and are dropped (the residual). Everything is computed live by QMATH (sets/qmath.js) from the example networks;
// nothing here is the real network's.
// Axes as in the reference figure: the first cut (the top bit) is left (0) / right (1), the second front (0) / back
// (1), the third top (0) / bottom (1); so X on the top qubit hops left-right, Z on it is +1 on the left, -1 on the right.
// Signs: solid +, dashed -; corners red for +1, blue for -1 where a string puts a loop there.
// The gene-level network moves in its shaders (positions from the params); the cube, the strings and the gallery are
// refilled every frame from the params (a few hundred instances). Only the switch of network, cut, bits, algebra or
// focused string eases in its own time (0.35 s; a seek or the first frame shows the new one at once).
SETS.cube = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rgb } = K;
  const set = K.newSet('cube');
  const Q = QMATH, LK = QLOOK(K, set);
  const NETS = Q.NETS, DEF = Math.max(0, NETS.findIndex(s => s.key === Q.DEFAULT));
  const H = 0.5, NB = 10, PI = Math.PI;
  const CUTS = ['found', 'random'], ALGS = ['tfim', 'odd'];
  // the corner of an L-bit code (h: half the cube's size)
  const corner = (c, L, h = H) => {
    const p = [0, 0, 0];
    for (let j = 0; j < L; j++) { const b = c >> (L - 1 - j) & 1; if (j === 0) p[0] = b ? h : -h; else if (j === 1) p[2] = b ? -h : h; else p[1] = b ? -h : h; }
    return p;
  };
  const codeStr = (c, L) => c.toString(2).padStart(L, '0');
  const cellCol = (c, L) => LK.CELL[c << (3 - L)];

  // ---------------------------------------------------------------- the gene-level network (one per example network,
  // built on first use or between frames)
  const GLSL = `
uniform float uBits, uGather, uH, uCut;
uniform vec3 uM0, uM1[2], uM2[4], uM3[8], uCol[8];
float bitOf(float c, float q) { return mod(floor(c / pow(2.0, q) + 0.001), 2.0); }
vec3 phases() { return vec3(smoothstep(0.0, 1.0, clamp(uBits, 0.0, 1.0)), smoothstep(0.0, 1.0, clamp(uBits - 1.0, 0.0, 1.0)), smoothstep(0.0, 1.0, clamp(uBits - 2.0, 0.0, 1.0))); }
vec3 movePos(vec3 p0, float c) {
  vec3 f = phases();
  float b2 = bitOf(c, 2.0), b1 = bitOf(c, 1.0), b0 = bitOf(c, 0.0);
  vec3 off = vec3((b2 > 0.5 ? 1.0 : -1.0) * f.x, (b0 > 0.5 ? -1.0 : 1.0) * f.z, (b1 > 0.5 ? -1.0 : 1.0) * f.y) * uH;
  vec3 m = mix(mix(mix(uM0, uM1[int(b2)], f.x), uM2[int(b2 * 2.0 + b1)], f.y), uM3[int(c + 0.5)], f.z);
  float s = mix(mix(mix(1.0, 0.55, f.x), 0.42, f.y), 0.32, f.z);
  return mix(off + (p0 - m) * s, off, uGather);
}
vec3 colOf(float c) {
  vec3 f = phases(), n = vec3(0.6, 0.58, 1.0);
  float b2 = bitOf(c, 2.0), b1 = bitOf(c, 1.0);
  return mix(mix(mix(n, uCol[int(b2 * 4.0)], f.x), uCol[int(b2 * 4.0 + b1 * 2.0)], f.y), uCol[int(c + 0.5)], f.z);
}`;
  const U = {
    uBits: { value: 0 }, uGather: { value: 0 }, uH: { value: H }, uCut: { value: 0 }, uLinkA: { value: 0.2 }, uGeneA: { value: 1 },
    uM0: { value: new THREE.Vector3() }, uM1: { value: [0, 1].map(() => new THREE.Vector3()) },
    uM2: { value: [0, 1, 2, 3].map(() => new THREE.Vector3()) }, uM3: { value: [...Array(8)].map(() => new THREE.Vector3()) },
    uCol: { value: LK.CELL.map(c => new THREE.Color(...c)) },
  };
  const geneMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA, uPx: K.U.uPx, uTime: K.U.uTime }, U),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: K.GLSL + GLSL + `
attribute float aCode, aCodeR, aSeed;
uniform float uA, uGeneA;
varying vec3 vC; varying float vA;
void main() {
  float c = uCut > 0.5 ? aCodeR : aCode;
  vec4 mv = modelViewMatrix * vec4(movePos(position, c), 1.0);
  vC = colOf(c); vA = uA * uGeneA * (1.0 - smoothstep(0.6, 1.0, uGather)) * (0.75 + 0.25 * sin(uTime * 1.3 + aSeed * 40.0));
  gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(0.03 * (1.0 - 0.4 * uGather), mv);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
varying vec3 vC; varying float vA;
void main() {
  vec2 c = gl_PointCoord - 0.5; float d = length(c);
  if (d > 0.5) discard;
  float a = max(smoothstep(0.5, 0.2, d) * 0.9, pow(1.0 - d * 2.0, 1.5) * 0.5);
  gl_FragColor = vec4(mix(vC, vec3(1.0), smoothstep(0.2, 0.0, d) * 0.4), vA * a);
}`,
  });
  set.mats.push(geneMat);
  const linkMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, U),
    transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
    vertexShader: GLSL + `
attribute float aCode, aCodeR, aOther, aOtherR;
uniform float uA, uLinkA;
varying vec3 vC; varying float vA;
void main() {
  float c = uCut > 0.5 ? aCodeR : aCode, o = uCut > 0.5 ? aOtherR : aOther;
  vec4 mv = modelViewMatrix * vec4(movePos(position, c), 1.0);
  gl_Position = projectionMatrix * mv;
  // a link across the cut being made flashes amber; links between cells dim once cut, links inside a cell take its color
  float flash = 0.0, across = 0.0;
  for (int k = 0; k < 3; k++) {
    float q = 2.0 - float(k), ph = clamp(uBits - float(k), 0.0, 1.0), diff = abs(bitOf(c, q) - bitOf(o, q));
    flash = max(flash, diff * sin(ph * 3.14159));
    across = max(across, diff * smoothstep(0.0, 1.0, ph));
  }
  vec3 base = mix(colOf(c), vec3(0.55, 0.55, 0.85), across);
  vC = mix(base, vec3(1.0, 0.72, 0.25), flash);
  vA = uA * uLinkA * (1.0 - 0.7 * across + 2.5 * flash) * (1.0 - smoothstep(0.3, 0.8, uGather));
}`,
    fragmentShader: `
varying vec3 vC; varying float vA;
void main() { if (vA < 0.004) discard; gl_FragColor = vec4(vC, vA); }`,
  });
  set.mats.push(linkMat);
  const NET = [];   // per network index: { built, an (found, random: 3-bit analyses), M: centroids per cut, pts, lns }
  const geneGroup = new THREE.Group();
  set.group.add(geneGroup);
  function buildNet(i) {
    if (NET[i]) return NET[i];
    const s = NETS[i], net = Q.network(s.key), n = net.n;
    const an = { found: Q.analyze(s.key, { L: 3, cut: 'found' }), random: Q.analyze(s.key, { L: 3, cut: 'random' }) };
    // the layout: force-directed in 3D, started from a loose ball (seeded)
    const P = Q.layout(net, { dim: 3, iters: 45, seed: 7 + i });
    for (let j = 0; j < P.length; j++) P[j] *= 0.78;
    // the centroids of each group at each level, per cut
    const M = {};
    for (const how of CUTS) {
      const code = an[how].code, acc = [[0, 0, 0, 0]], lv = [2, 4, 8].map(k => [...Array(k)].map(() => [0, 0, 0, 0]));
      for (let g = 0; g < n; g++) {
        const c = code[g], p = [P[3 * g], P[3 * g + 1], P[3 * g + 2]];
        const add = a => { a[0] += p[0]; a[1] += p[1]; a[2] += p[2]; a[3]++; };
        add(acc[0]); add(lv[0][c >> 2]); add(lv[1][c >> 1]); add(lv[2][c]);
      }
      const mean = a => (a[3] ? [a[0] / a[3], a[1] / a[3], a[2] / a[3]] : [0, 0, 0]);
      M[how] = { m0: mean(acc[0]), m1: lv[0].map(mean), m2: lv[1].map(mean), m3: lv[2].map(mean) };
    }
    const r = K.rng(31 + i), cf = an.found.code, cr = an.random.code;
    const pg = new THREE.BufferGeometry();
    pg.setAttribute('position', new THREE.BufferAttribute(Float32Array.from(P), 3));
    pg.setAttribute('aCode', new THREE.BufferAttribute(Float32Array.from(cf), 1));
    pg.setAttribute('aCodeR', new THREE.BufferAttribute(Float32Array.from(cr), 1));
    pg.setAttribute('aSeed', new THREE.BufferAttribute(Float32Array.from({ length: n }, () => r()), 1));
    const pts = new THREE.Points(pg, geneMat);
    const m = net.m, lp = new Float32Array(m * 6), a1 = new Float32Array(m * 2), a2 = new Float32Array(m * 2), o1 = new Float32Array(m * 2), o2 = new Float32Array(m * 2);
    for (let e = 0; e < m; e++) {
      const a = net.edges[2 * e], b = net.edges[2 * e + 1];
      lp.set([P[3 * a], P[3 * a + 1], P[3 * a + 2], P[3 * b], P[3 * b + 1], P[3 * b + 2]], 6 * e);
      a1[2 * e] = cf[a]; a1[2 * e + 1] = cf[b]; o1[2 * e] = cf[b]; o1[2 * e + 1] = cf[a];
      a2[2 * e] = cr[a]; a2[2 * e + 1] = cr[b]; o2[2 * e] = cr[b]; o2[2 * e + 1] = cr[a];
    }
    const lg = new THREE.BufferGeometry();
    lg.setAttribute('position', new THREE.BufferAttribute(lp, 3));
    lg.setAttribute('aCode', new THREE.BufferAttribute(a1, 1)); lg.setAttribute('aCodeR', new THREE.BufferAttribute(a2, 1));
    lg.setAttribute('aOther', new THREE.BufferAttribute(o1, 1)); lg.setAttribute('aOtherR', new THREE.BufferAttribute(o2, 1));
    const lns = new THREE.LineSegments(lg, linkMat);
    pts.frustumCulled = lns.frustumCulled = false;
    pts.visible = lns.visible = false;
    geneGroup.add(lns, pts);
    return (NET[i] = { an, M, pts, lns, m, linkA: Math.min(0.09, 0.09 * 4000 / m) });
  }
  buildNet(DEF);

  // ---------------------------------------------------------------- the cut planes (a glowing sheet at each cut)
  const planeMat = () => {
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uK: { value: 0 } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: 'varying vec2 vUv; void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
      fragmentShader: `uniform float uA, uK; varying vec2 vUv;
void main() {
  vec2 e = min(vUv, 1.0 - vUv); float edge = smoothstep(0.03, 0.0, min(e.x, e.y));
  vec2 g = abs(fract(vUv * 10.0) - 0.5); float grid = smoothstep(0.47, 0.5, max(g.x, g.y));
  gl_FragColor = vec4(vec3(0.75, 0.7, 1.0), uA * uK * (0.025 + 0.5 * edge + 0.1 * grid));
}`,
    });
    set.mats.push(m);
    return m;
  };
  const planes = [0, 1, 2].map(k => {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(1.6, 1.6), planeMat());
    if (k === 0) m.rotation.y = PI / 2; else if (k === 2) m.rotation.x = PI / 2;
    set.group.add(m);
    return m;
  });

  // ---------------------------------------------------------------- the cube, the strings and the gallery
  const tubes = LK.tubes(460), rings = LK.rings(150), balls = LK.balls(150), halos = LK.halos(60);
  set.group.add(tubes.mesh, rings.mesh, balls.mesh, halos.mesh);
  const up = [0, 1, 0], fwd = [0, 0, 1];
  const norm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
  const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  const add3 = (a, b, s = 1) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
  // a corner's loop: a ring just outside the corner, standing in the plane of the outward direction
  function loop(p, cen, scale, v, col, alpha) {
    if (Math.abs(v) < 0.015 || alpha < 0.01) return;
    const o = norm([p[0] - cen[0], p[1] - cen[1], p[2] - cen[2]]);
    let ax = cross(o, up); if (Math.hypot(...ax) < 0.3) ax = cross(o, fwd);
    const a = Math.min(1, Math.abs(v)), R = (0.03 + 0.06 * a) * scale, r = (0.004 + 0.007 * a) * scale;
    rings.add(add3(p, o, R + 0.02 * scale), norm(ax), R, r, col, alpha * clamp(Math.abs(v) * 6, 0, 1), v < 0 ? 12 : 0);
  }
  function edge(a, b, scale, v, col, alpha, ghost) {
    const w = Math.min(1, Math.abs(v));
    if (w < 0.012 || alpha < 0.01) return;
    const r = ghost ? (0.0035 + 0.006 * w) * scale : (0.004 + 0.022 * w) * scale, len = Math.hypot(b[0] - a[0], b[1] - a[1], b[2] - a[2]);
    tubes.add(a, b, r, col, alpha * clamp(w * 8, 0, 1), v < 0 ? len / (0.05 * scale) : 0);
  }
  // the cube's frame: thin gray edges and corner dots
  function frame(cen, h, L, alpha, dot) {
    const N = 1 << L, P = [];
    for (let c = 0; c < N; c++) P.push(add3(cen, corner(c, L, h)));
    for (let a = 0; a < N; a++) for (let q = 0; q < L; q++) { const b = a ^ (1 << q); if (b > a) tubes.add(P[a], P[b], 0.0028 * h / 0.12, LK.GRAY, alpha * 0.8, 0); }
    if (dot) for (let c = 0; c < N; c++) balls.add(P[c], dot, [0.75, 0.73, 0.95], alpha);
    return P;
  }
  // one Pauli string drawn on a cube centered at cen (half size h): hops as tubes, loops as rings, signs solid/dashed
  function drawString(k, L, cen, h, alpha, gray, bright) {
    const N = 1 << L, P = frame(cen, h, L, alpha * 0.8, 0.012 * h / 0.12), sc = h / H;
    const col = LK.mix(LK.PURPLE, LK.GRAY, gray), x = k >> L;
    for (let c = 0; c < N; c++) {
      if (x === 0) {
        const v = Q.entry(k, L, c, c)[0];
        loop(P[c], cen, sc * 1.25, v, col, alpha);
        balls.add(P[c], 0.022 * sc * 1.4, LK.mix(v > 0 ? LK.RED : LK.BLUE, LK.GRAY, gray), alpha);
      } else {
        const d = c ^ x;
        if (d > c) edge(P[c], P[d], sc * 1.1, Q.entry(k, L, d, c)[0], col, alpha);
      }
    }
    if (bright > 0.01) halos.add(cen, h * 3.2, LK.PURPLE, 0.35 * bright * alpha);
  }

  // ---------------------------------------------------------------- what to show: the analysis and its matrices
  const anOf = (ni, ci, L) => { buildNet(ni); return Q.analyze(NETS[ni].key, { L, cut: CUTS[ci] }); };
  // (kept matrices per analysis and algebra: the trace part and the strings inside)
  const keptCache = {};
  function kept(A, ai) {
    const id = `${A.net}:${A.cut}:${A.L}:${ai}`;
    if (!keptCache[id]) { const alg = Q.algebra(ALGS[ai], A.L); keptCache[id] = Q.fromPauli(A.c, A.L, [0, ...alg.basis.filter(k => k)]).re; }
    return keptCache[id];
  }
  const cur = { id: '', D: new Float64Array(64), G: new Float64Array(64), focus: -1, fa: 0, L: 3, first: true };
  function targets(S, A, L) {
    const N = 1 << L, D = new Float64Array(N * N), G = new Float64Array(N * N), ai = Math.round(clamp(S.cube_algebra, 0, 1));
    let vmax = 1e-9, dmax = 1e-9;
    for (let i = 0; i < N; i++) for (let j = 0; j < N; j++) { const v = A.Ac[i * N + j]; if (i === j) dmax = Math.max(dmax, Math.abs(v)); else vmax = Math.max(vmax, Math.abs(v)); }
    // the rebuilt sum: the first strings of the order, each as far as it has arrived
    const build = clamp(S.cube_build, 0, 1), sum = clamp(S.cube_sum, 0, NB), keep = clamp(S.cube_keep, 0, 1);
    const R = new Float64Array(N * N);
    if (build > 0) A.order.slice(0, NB).forEach((k, j) => {
      const w = smooth(clamp(sum - j, 0, 1));
      if (w <= 0) return;
      for (let c = 0; c < N; c++) { const x = k >> L, d = c ^ x; R[d * N + c] += w * A.c.re[k] * Q.entry(k, L, d, c)[0]; }
    });
    const Kp = keep > 0 ? kept(A, ai) : null;
    for (let i = 0; i < N * N; i++) {
      let v = lerp(A.Ac[i], R[i], build);
      if (Kp) v = lerp(v, Kp[i], keep);
      const diag = Math.floor(i / N) === i % N;
      D[i] = v / (diag ? dmax : vmax);
      G[i] = A.Ac[i] / (diag ? dmax : vmax);
    }
    return { D, G };
  }

  // ---------------------------------------------------------------- update
  const anchorsNow = { cube: [0, 0, 0], sc: 1, slots: [], gauge: [0, -0.8, 0] };
  const HB = 0.17;   // a brick's half size
  const slotPos = s => { const col = s % 5, row = s < 5 ? 0 : 1; return [col * 0.56, row ? -0.46 : 0.4, -0.2 * ((col - 2) / 2) ** 2]; };
  for (let s = 0; s < NB; s++) anchorsNow.slots.push(slotPos(s));
  let curA = null, curL = 3, curAlg = 1, curList = [], curLesson = false;
  // the lesson: the reference figure's top row, the strings' kinds one by one (no weights)
  const LESSON = ['I', 'X0', 'X1', 'X2', 'Z2', 'Z2X1', 'X2X1', 'Y2Y1'];
  const lessonOf = L => LESSON.filter(nm => !/\d/.test(nm) || Math.max(...nm.match(/\d/g).map(Number)) < L).map(nm => Q.parse(nm, L));
  function update(S, t, dt) {
    LK.depth();
    const ni = clamp(Math.round(S.cube_net), 0, NETS.length - 1), ci = clamp(Math.round(S.cube_cut), 0, 1);
    const bits = clamp(S.cube_bits, 0, 3), L = clamp(Math.round(bits), 1, 3), ai = Math.round(clamp(S.cube_algebra, 0, 1));
    const A = anOf(ni, ci, L);
    curA = A; curL = L; curAlg = ai;
    const NT = buildNet(ni), snap = cur.first || !(dt > 0) || dt > 0.25, ease = snap ? 1 : 1 - Math.exp(-dt * 8);
    cur.first = false;
    // the genes
    const genes = clamp(S.cube_genes, 0, 1), ac = clamp(S.cube_ac, 0, 1);
    NET.forEach((o, i) => { if (o) o.pts.visible = o.lns.visible = i === ni && genes > 0.003 && ac < 0.999; });
    const how = CUTS[ci], M = NT.M[how];
    U.uBits.value = bits; U.uGather.value = ac; U.uCut.value = ci;
    U.uGeneA.value = genes; U.uLinkA.value = NT.linkA * genes;
    U.uM0.value.set(...M.m0); M.m1.forEach((p, j) => U.uM1.value[j].set(...p)); M.m2.forEach((p, j) => U.uM2.value[j].set(...p)); M.m3.forEach((p, j) => U.uM3.value[j].set(...p));
    planes.forEach((m, k) => { const ph = clamp(bits - k, 0, 1); m.material.uniforms.uK.value = genes * Math.sin(ph * PI) * (1 - ac); m.visible = m.material.uniforms.uK.value > 0.003; });

    // the big cube: where, how big
    const br = smooth(clamp(S.cube_bricks, 0, 1)), cen = [lerp(0, -1.08, br), lerp(0, 0.02, br), 0], sc = lerp(1, 0.86, br);
    anchorsNow.cube = cen; anchorsNow.sc = sc;
    const N = 1 << L, h = H * sc;
    // the values shown, eased when the analysis, the algebra or the focus changes
    const id = `${ni}:${ci}:${L}`;
    if (id !== cur.id) { cur.id = id; if (cur.L !== L) { cur.D = new Float64Array(N * N); cur.G = new Float64Array(N * N); cur.L = L; } }
    const T = targets(S, A, L);
    const fk = Math.round(S.cube_focus), fon = fk >= 0 && fk < N * N ? 1 : 0;
    if (fon) cur.focus = fk;
    cur.fa = snap ? fon : cur.fa + (fon - cur.fa) * ease;
    for (let i = 0; i < N * N; i++) {
      let tv = T.D[i];
      if (cur.focus >= 0 && cur.focus < N * N && cur.fa > 0.001) {
        const r = Math.floor(i / N), c = i % N, sv = Q.entry(cur.focus, L, r, c)[0];
        tv = lerp(tv, sv, cur.fa);
      }
      cur.D[i] = snap ? tv : cur.D[i] + (tv - cur.D[i]) * ease;
      cur.G[i] = snap ? T.G[i] : cur.G[i] + (T.G[i] - cur.G[i]) * ease;
    }
    if (!fon && cur.fa < 0.002) cur.focus = -1;

    tubes.begin(); rings.begin(); balls.begin(); halos.begin();
    const cubeA = smooth(prog(ac, 0.35, 1));
    if (cubeA > 0.003) {
      const P = frame(cen, h, L, cubeA * 0.7, 0);
      const ghost = clamp(S.cube_build, 0, 1) * (1 - cur.fa) * 0.5;
      for (let a = 0; a < N; a++) {
        for (let b = a + 1; b < N; b++) {
          // (an edge grows from its middle as the cube comes in)
          const g = prog(ac, 0.55, 1), m = [(P[a][0] + P[b][0]) / 2, (P[a][1] + P[b][1]) / 2, (P[a][2] + P[b][2]) / 2];
          const pa = add3(m, [P[a][0] - m[0], P[a][1] - m[1], P[a][2] - m[2]], g), pb = add3(m, [P[b][0] - m[0], P[b][1] - m[1], P[b][2] - m[2]], g);
          edge(pa, pb, sc, cur.D[a * N + b], LK.PURPLE, cubeA, false);
          if (ghost > 0.01) edge(P[a], P[b], sc, cur.G[a * N + b], LK.GRAY, ghost, true);
        }
        loop(P[a], cen, sc, cur.D[a * N + a] * prog(ac, 0.6, 1), LK.PURPLE, cubeA);
        if (ghost > 0.01) loop(P[a], cen, sc * 1.02, cur.G[a * N + a], LK.GRAY, ghost * 0.6);
        // corners: the cell's color; red or blue where a focused string puts a +1 or -1 loop there
        const sv = cur.focus >= 0 && cur.focus < N * N ? Q.entry(cur.focus, L, a, a)[0] : 0;
        const cc = LK.mix(cellCol(a, L), sv > 0 ? LK.RED : LK.BLUE, Math.abs(sv) * cur.fa);
        balls.add(P[a], 0.045 * sc * prog(ac, 0.3, 0.8), cc, cubeA);
        halos.add(P[a], 0.2 * sc, cc, 0.45 * cubeA);
      }
    }
    // the gallery: the strings of the largest weights, as small cubes; outside the algebra gray once the toolbox is on
    const alg = Q.algebra(ALGS[ai], L), alw = clamp(S.cube_alg, 0, 1), sum = clamp(S.cube_sum, 0, NB);
    // (the gallery shows the lesson or the weighted strings; a switch crossfades through nothing at cube_lesson 0.5)
    const les = clamp(S.cube_lesson, 0, 1), list = les > 0.5 ? lessonOf(L) : A.order.slice(0, NB), swap = Math.abs(les - 0.5) * 2;
    curList = list; curLesson = les > 0.5;
    if (br > 0.003) list.forEach((k, s) => {
      const a = prog(S.cube_bricks, 0.3 + 0.045 * s, 0.55 + 0.045 * s) * smooth(swap), out = k !== 0 && !alg.set.has(k);
      if (a <= 0.003) return;
      const hit = cur.focus === k ? cur.fa : 0;
      drawString(k, L, slotPos(s), HB, a, out ? alw * 0.85 : 0, Math.max(hit, prog(sum - s, 0.6, 1) * 0.6 * (1 - prog(sum - s, 1.5, 3))));
      // the copy that flies into the big cube as the string is added
      const f = curLesson ? 0 : clamp(sum - s, 0, 1);
      if (f > 0.001 && f < 0.999) {
        const e = smooth(f), p = slotPos(s), q = [lerp(p[0], cen[0], e), lerp(p[1], cen[1], e) + Math.sin(e * PI) * 0.25, lerp(p[2], cen[2], e) + Math.sin(e * PI) * 0.2];
        drawString(k, L, q, lerp(HB, h, e), a * (1 - prog(f, 0.7, 1)), 0, 0.6);
      }
    });
    // the gauge under the big cube: the error left (while adding strings) or the residual (the toolbox)
    const build = clamp(S.cube_build, 0, 1), keep = clamp(S.cube_keep, 0, 1), gA = Math.max(build, keep) * cubeA * (1 - cur.fa);
    if (gA > 0.01) {
      const j = Math.floor(sum), err = lerp(A.errors[Math.min(j, A.errors.length - 1)], A.errors[Math.min(j + 1, A.errors.length - 1)], smooth(sum - j));
      const val = lerp(err, A.fits[ALGS[ai]].residual, keep), y = cen[1] - h - 0.3, x0 = cen[0] - 0.45 * sc, x1 = cen[0] + 0.45 * sc;
      anchorsNow.gauge = [x1 + 0.04, y + 0.02, 0];
      tubes.add([x0, y, 0], [x1, y, 0], 0.014 * sc, LK.GRAY, gA * 0.7, 0);
      if (val > 0.004) tubes.add([x0, y, 0], [lerp(x0, x1, clamp(val, 0, 1)), y, 0], 0.03 * sc, keep > 0.5 ? LK.AMBER : LK.PURPLE, gA, 0);
      for (let q = 0; q <= 4; q++) balls.add([lerp(x0, x1, q / 4), y, 0], 0.008 * sc, LK.INK, gA * 0.8);
    }
    tubes.end(); rings.end(); balls.end(); halos.end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const anchors = {
    genes: [0, 0, 0],
    cube: () => anchorsNow.cube,
    top: () => [anchorsNow.cube[0], anchorsNow.cube[1] + H * anchorsNow.sc + 0.2, 0],
    gallery: [1.12, 0, 0],
    gauge: () => anchorsNow.gauge,
    cut1: [0, 0.75, 0], cut2: [0.75, 0.1, 0], cut3: [0.75, 0, 0.5],
  };
  const cornerAt = (c, L) => () => { const p = add3(anchorsNow.cube, corner(c, L, H * anchorsNow.sc)), o = norm(corner(c, L)); return add3(p, o, 0.09); };
  for (let c = 0; c < 8; c++) anchors['c' + codeStr(c, 3)] = cornerAt(c, 3);
  for (let s = 0; s < NB; s++) anchors['brick' + s] = slotPos(s);
  const labels = [];
  // the codes at the corners, at the bits shown (hidden while the gallery is up)
  for (const L of [1, 2, 3]) for (let c = 0; c < 1 << L; c++) {
    labels.push({ text: [codeStr(c, L), ''], at: cornerAt(c, L), cls: 'cyn', alpha: S => {
      const b = clamp(S.cube_bits, 0, 3), on = L === 3 ? prog(b, 2.7, 3) : prog(b, L - 0.3, L) * (1 - prog(b, L + 0.05, L + 0.35));
      return on * Math.max(clamp(S.cube_genes, 0, 1) * prog(b, 0, 0.5), prog(S.cube_ac, 0.5, 0.8)) * (1 - prog(S.cube_bricks, 0, 0.3)) * (1 - cur.fa);
    } });
  }
  // the cuts as they are made: which digit each one is
  [['First cut', ' · digit q2'], ['Second cut', ' · digit q1'], ['Third cut', ' · digit q0']].forEach((tx, k) => labels.push({
    text: tx, at: 'cut' + (k + 1), cls: 'amb', alpha: S => clamp(S.cube_genes, 0, 1) * Math.sin(clamp(S.cube_bits - k, 0, 1) * PI) * (1 - clamp(S.cube_ac, 0, 1)) }));
  // the gallery's names and weights (text as a function: it follows the network shown; see SPEC.md, labels). A slot
  // has two labels: cyan for a string inside the algebra (or any string before the toolbox), plain for I and for
  // strings outside it once the toolbox is on.
  const fmtW = w => (w < 0 ? '−' : '') + Math.abs(w).toFixed(2);
  const slotK = s => (curA && s < curList.length ? curList[s] : -1);
  const outside = k => k > 0 && !Q.algebra(ALGS[curAlg], curL).set.has(k);
  for (let s = 0; s < NB; s++) {
    const at = [slotPos(s)[0] - 0.1, slotPos(s)[1] + HB + 0.1, slotPos(s)[2]];
    const text = () => { const k = slotK(s); return k < 0 ? ['', ''] : [Q.name(k, curL, { sub: true }), curLesson ? '' : ' ' + fmtW(curA.c.re[k])]; };
    const vis = S => (slotK(s) < 0 ? 0 : prog(S.cube_bricks, 0.35 + 0.045 * s, 0.6 + 0.045 * s) * smooth(Math.abs(clamp(S.cube_lesson, 0, 1) - 0.5) * 2));
    labels.push({ text, at, cls: 'cyn', minor: s >= 4, alpha: S => { const k = slotK(s); return k > 0 && !(outside(k) && S.cube_alg > 0.5) ? vis(S) : 0; } });
    labels.push({ text, at, cls: '', minor: s >= 4, alpha: S => { const k = slotK(s); return k === 0 || (outside(k) && S.cube_alg > 0.5) ? vis(S) * (k === 0 ? 1 : 0.8) : 0; } });
  }
  // the focused string's name and what it does, above the big cube
  const what = (k, L) => {
    const p = Q.parts(k, L), x = k >> L, nx = Q.pop(x);
    if (!p.length) return 'the same loop on every corner';
    if (!x) return 'loops of +1 and −1';
    if (p.length === 1) return 'hops along the cube’s edges';
    if (nx === 1) return 'hops with signs';
    return nx === 2 ? 'hops across face diagonals' : 'hops across body diagonals';
  };
  labels.push({ text: () => (cur.focus >= 0 ? [Q.name(cur.focus, cur.L, { sub: true }), ' · ' + what(cur.focus, cur.L)] : ['', '']), at: 'top', cls: 'mag',
    alpha: S => (cur.focus >= 0 ? cur.fa * prog(S.cube_ac, 0.5, 0.9) : 0) });
  labels.push({ text: ['Error left', ''], at: 'gauge', cls: '', alpha: S => clamp(S.cube_build, 0, 1) * (1 - clamp(S.cube_keep, 0, 1)) * prog(S.cube_ac, 0.6, 1) * (1 - cur.fa) });
  labels.push({ text: ['Residual', ' · the share dropped'], at: 'gauge', cls: 'amb', alpha: S => clamp(S.cube_keep, 0, 1) * prog(S.cube_ac, 0.6, 1) * (1 - cur.fa) });

  const cam = {
    default: [24, 16, 3.3, 0, 0, 0],
    genes: [30, 14, 3.6, 0, 0, 0],
    cube: [24, 16, 2.7, 0, 0.02, 0],
    bricks: [4, 8, 5.6, 0.45, -0.02, 0],
    gallery: [2, 6, 3.9, 1.12, -0.02, 0],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['genes', 'Genes'], ['cut', 'Cut'], ['cube', 'Cube'], ['bricks', 'Bricks'], ['toolbox', 'Toolbox']] },
    { key: 'net', label: 'Network', options: NETS.map((s, i) => [String(i), s.name]) },
    { key: 'cut', label: 'Cut', options: [['0', 'Found'], ['1', 'Random']] },
    { key: 'bits', label: 'Bits', options: [['3', '3'], ['2', '2'], ['1', '1']], when: v => v.view !== 'genes' },
    { key: 'alg', label: 'Algebra', options: [['1', 'so(2L+1)'], ['0', 'so(2L)']], when: v => v.view === 'toolbox' },
  ];
  function explore(c) {
    const v = c.view || 'genes', bits = v === 'genes' ? 0 : clamp(parseInt(c.bits, 10) || 3, 1, 3);
    return {
      cube_net: clamp(parseInt(c.net, 10) || 0, 0, NETS.length - 1), cube_cut: c.cut === '1' ? 1 : 0, cube_bits: bits,
      cube_genes: v === 'genes' || v === 'cut' ? 1 : 0, cube_ac: v === 'genes' || v === 'cut' ? 0 : 1,
      cube_bricks: v === 'bricks' || v === 'toolbox' ? 1 : 0, cube_lesson: 0, cube_build: 0, cube_sum: 0,
      cube_alg: v === 'toolbox' ? 1 : 0, cube_keep: v === 'toolbox' ? 1 : 0, cube_algebra: c.alg === '0' ? 0 : 1, cube_focus: -1,
    };
  }
  // picking: a gallery brick (its slot) or a corner of the big cube
  const _p = new THREE.Vector3(), _d = new THREE.Vector3();
  function pick(rc) {
    const ray = rc.ray;
    set.group.updateMatrixWorld();
    const M = set.group.matrixWorld, s0 = M.getMaxScaleOnAxis();
    let best = null, bt = Infinity;
    const test = (p, r, hit) => {
      _p.set(p[0], p[1], p[2]).applyMatrix4(M);
      const tt = _d.copy(_p).sub(ray.origin).dot(ray.direction), rr = r * s0;
      if (tt > 0 && tt < bt && ray.distanceSqToPoint(_p) < rr * rr) { bt = tt; best = hit; }
    };
    if (curA) {
      curList.forEach((k, s) => test(slotPos(s), HB * 1.5, { kind: 'brick', slot: s, k, name: Q.name(k, curL) }));
      for (let c = 0; c < 1 << curL; c++) test(add3(anchorsNow.cube, corner(c, curL, H * anchorsNow.sc)), 0.09, { kind: 'corner', code: codeStr(c, curL) });
    }
    return best;
  }
  const API = {
    nets: NETS.map((s, i) => ({ i, key: s.key, name: s.name, note: s.note })),
    defaultNet: DEF,
    // the analysis shown now (QMATH.analyze: sizes, purity, Ac, c, order, errors, fits, cubeShare, cutShare, trotter)
    analysis: () => curA,
    // any analysis: network index, cut ('found' | 'random'), bits
    analyze: (ni, cut, L) => anOf(clamp(ni | 0, 0, NETS.length - 1), cut === 'random' ? 1 : 0, clamp(L | 0, 1, 3)),
    // the gallery now: [{ slot, k, name, weight, inside }]
    bricks: () => (curA ? curList.map((k, s) => ({ slot: s, k, name: Q.name(k, curL), weight: curA.c.re[k], inside: k === 0 ? null : Q.algebra(ALGS[curAlg], curL).set.has(k) })) : []),
    lesson: L => lessonOf(clamp(L | 0, 1, 3)).map(k => Q.name(k, clamp(L | 0, 1, 3))),
    algebra: () => Q.algebra(ALGS[curAlg], curL),
    corner: (c, L) => corner(c, L),
    pick,
    NB,
  };
  // build the other networks between frames (one per call), or all at once for screenshots
  let nextBuild = 0;
  return Object.assign(set, {
    params: { cube_a: 1, cube_net: DEF, cube_cut: 0, cube_genes: 0, cube_bits: 3, cube_ac: 1, cube_bricks: 0, cube_lesson: 0, cube_build: 0, cube_sum: 0,
      cube_alg: 0, cube_keep: 0, cube_algebra: 1, cube_focus: -1 },
    update, anchors, labels, cam, controls, explore,
    idle() { while (nextBuild < NETS.length && NET[nextBuild]) nextBuild++; if (nextBuild < NETS.length) buildNet(nextBuild); },
    finish() { NETS.forEach((_, i) => buildNet(i)); },
    api: () => API,
  });
};

// The chart set of the qubits story: the honest result (the real run's residual by depth, our cuts against random
// ones, from QUBITS_DATA: good at 2 to 4 bits, worse with every bit; at 8 bits most of the operator is outside the
// algebra), with the example network's own residuals at 1 to 3 bits computed live (QMATH), and the recipe as a
// circuit: one Trotter step at 3 bits in so(7), six gates on three wires (q2, q1, q0), time running down, red for
// X-type gates and blue for Z-type, shaded by |theta| (the real run's angles, or the example network's).
// The chart and the circuit share the origin: the story shows one or the other (chart_plot, chart_circuit).
SETS.chart = function (K) {
  const { THREE, clamp, lerp, prog, smooth, rgb } = K;
  const set = K.newSet('chart');
  const Q = QMATH, D = QUBITS_DATA, LK = QLOOK(K, set);
  const R = D.residual, NBIT = R.bits.length;
  const X = b => -1.0 + (b - 1) * (2.0 / (NBIT - 1)), Yr = r => -0.5 + r;   // bits 1..8 across, residual 0..1 up
  const ZO = 0.1, ZR = -0.1, ZB = -0.3;   // our cuts in front, random behind, the back panel
  const COL = { ours: rgb('#46d9ff'), rand: rgb('#8e98ab'), ex: LK.AMBER, grid: rgb('#34405a') };
  // the example network's residual at 1, 2 and 3 bits (its found cut; the better of so(2L) and so(2L+1), as the real
  // run reports the best algebra of its panel)
  const EX = [1, 2, 3].map(L => { const A = Q.analyze(Q.DEFAULT, { L }); return Math.min(A.fits.tfim.residual, A.fits.odd.residual); });
  // the circuit: gates in time order, one row each
  const exGates = Q.analyze(Q.DEFAULT, { L: 3 }).trotter.odd.map(g => ({ type: g.type, qubits: g.qubits, theta: g.theta }));
  const SRC = [D.circuit.gates, exGates];
  const WX = q => 0.4 - q * 0.4;   // wire x: q2 left, q0 right
  const ROWY = i => 0.6 - i * 0.24;
  const tubes = LK.tubes(160), balls = LK.balls(60), boxes = LK.boxes(20), halos = LK.halos(60), rings = LK.rings(12);
  set.group.add(tubes.mesh, balls.mesh, boxes.mesh, halos.mesh, rings.mesh);
  const now = { src: 0 };
  function series(vals, z, col, g, a, rad) {
    const n = vals.length, upto = g * (n - 1);
    for (let i = 0; i < n; i++) {
      const p = [X(i + 1), Yr(vals[i]), z], on = clamp(upto - i + 1, 0, 1);
      if (on <= 0) break;
      balls.add(p, rad * 1.9 * smooth(on), col, a);
      halos.add(p, rad * 9, col, 0.3 * a * on);
      tubes.add([p[0], Yr(0), z], p, rad * 0.35, col, a * 0.35 * on, 0);   // a stem down to the axis
      if (i < n - 1 && upto > i) {
        const f = clamp(upto - i, 0, 1), q = [X(i + 2), Yr(vals[i + 1]), z];
        tubes.add(p, [lerp(p[0], q[0], f), lerp(p[1], q[1], f), z], rad, col, a, 0);
      }
    }
  }
  function update(S, t) {
    LK.depth();
    const plot = clamp(S.chart_plot, 0, 1), circ = clamp(S.chart_circuit, 0, 1);
    tubes.begin(); balls.begin(); boxes.begin(); halos.begin(); rings.begin();
    if (plot > 0.003) {
      // the back panel: residual lines at 0, 0.25 .. 1, faint lines at each bit, the axis
      for (let k = 0; k <= 4; k++) tubes.add([X(1) - 0.08, Yr(k / 4), ZB], [X(NBIT) + 0.08, Yr(k / 4), ZB], k === 0 ? 0.005 : 0.0025, k === 0 ? LK.INK : COL.grid, plot * (k === 0 ? 0.7 : 0.8), k === 0 ? 0 : 0);
      for (let b = 1; b <= NBIT; b++) tubes.add([X(b), Yr(0), ZB], [X(b), Yr(1), ZB], 0.002, COL.grid, plot * 0.6, 0);
      tubes.add([X(1) - 0.08, Yr(0), ZO + 0.08], [X(1) - 0.08, Yr(0), ZB], 0.003, COL.grid, plot * 0.6, 0);
      tubes.add([X(NBIT) + 0.08, Yr(0), ZO + 0.08], [X(NBIT) + 0.08, Yr(0), ZB], 0.003, COL.grid, plot * 0.6, 0);
      const g = clamp(S.chart_grow, 0, 1);
      series(R.ours, ZO, COL.ours, g, plot, 0.011);
      const rnd = clamp(S.chart_rand, 0, 1);
      if (rnd > 0.003) series(R.random, ZR, COL.rand, g, plot * rnd, 0.009);
      const best = clamp(S.chart_best, 0, 1) * prog(g, 0.9, 1);
      if (best > 0.003) {
        const p = [X(NBIT), Yr(R.best8), ZO];
        rings.add(p, [0, 0, 1], 0.035, 0.005, COL.ours, plot * best, 10);
      }
      const ex = clamp(S.chart_ex, 0, 1);
      if (ex > 0.003) EX.forEach((r, i) => {
        const p = [X(i + 1), Yr(r), ZO + 0.12];
        rings.add(p, [0, 0, 1], 0.03, 0.006, COL.ex, plot * ex, 0);
        halos.add(p, 0.1, COL.ex, 0.3 * plot * ex);
        if (i < 2) tubes.add(p, [X(i + 2), Yr(EX[i + 1]), ZO + 0.12], 0.004, COL.ex, plot * ex * 0.7, 14);
      });
    }
    if (circ > 0.003) {
      const src = Math.round(clamp(S.chart_src, 0, 1)), G = SRC[src], mx = Math.max(...G.map(g => Math.abs(g.theta))) || 1;
      now.src = src;
      const shown = clamp(S.chart_gates, 0, G.length), run = clamp(S.chart_run, 0, 1);
      // the wires, and a time arrow down the left
      for (let q = 2; q >= 0; q--) { tubes.add([WX(q), 0.82, 0], [WX(q), -0.86, 0], 0.006, LK.INK, circ * 0.55, 0); balls.add([WX(q), 0.82, 0], 0.016, LK.INK, circ * 0.8); }
      tubes.add([-0.72, 0.72, 0], [-0.72, -0.78, 0], 0.004, COL.grid, circ * 0.9, 18);
      tubes.add([-0.72, -0.78, 0], [-0.7, -0.74, 0], 0.004, COL.grid, circ * 0.9, 0); tubes.add([-0.72, -0.78, 0], [-0.74, -0.74, 0], 0.004, COL.grid, circ * 0.9, 0);
      // pulses running down the wires (the state passing through the step); a gate glows as one passes
      const pulses = [0, 1, 2].map(q => 0.82 - ((t * 0.32 + q * 0.21) % 1) * 1.68);
      if (run > 0.01) for (let q = 0; q < 3; q++) halos.add([WX(q), pulses[q], 0.01], 0.09, [0.85, 0.95, 1], circ * run * 0.8);
      G.forEach((gt, i) => {
        const a = circ * smooth(clamp(shown - i, 0, 1));
        if (a <= 0.003) return;
        const y = ROWY(i), shade = 0.22 + 0.78 * Math.abs(gt.theta) / mx, xt = gt.type === 'RX';
        const base = xt ? LK.RED : LK.BLUE, col = LK.mix([0.1, 0.11, 0.16], base, shade);
        const flash = run * Math.max(...gt.qubits.map(q => Math.exp(-(((pulses[q] - y) / 0.06) ** 2))));
        const c2 = LK.mix(col, [1, 1, 1], 0.35 * flash);
        for (const q of gt.qubits) {
          boxes.add([WX(q), y, 0], [0.17, 0.13, 0.09], c2, a);
          halos.add([WX(q), y, 0.06], 0.28, base, a * (0.12 + 0.35 * shade) * (1 + flash));
        }
        if (gt.qubits.length === 2) tubes.add([WX(gt.qubits[0]), y, 0], [WX(gt.qubits[1]), y, 0], 0.018, c2, a, 0);
      });
    }
    tubes.end(); balls.end(); boxes.end(); halos.end(); rings.end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const anchors = {
    // (the series' labels sit along them, clear of each other and of the 8-bit end)
    chart: [0, 0, 0], ours: [X(5) + 0.02, Yr(R.ours[4]) - 0.1, ZO], rand: [X(3) - 0.05, Yr(R.random[2]) + 0.13, ZR],
    best8: [X(NBIT), Yr(R.best8), ZO], ex3: [X(3), Yr(EX[2]), ZO + 0.12], ours3: [X(3), Yr(R.ours[2]), ZO],
    axis: [X(1) - 0.1, Yr(1) + 0.08, ZB], bits: [X(NBIT) + 0.1, Yr(0) - 0.02, ZO],
    circuit: [0, 0, 0], top: [-0.78, 1.08, 0], time: [-0.72, 0.8, 0],
    q2: [WX(2), 0.9, 0], q1: [WX(1), 0.9, 0], q0: [WX(0), 0.9, 0],
  };
  const fmtT = v => (v < 0 ? '−' : '+') + Math.abs(v).toFixed(3);
  const plotOn = S => clamp(S.chart_plot, 0, 1);
  const labels = [
    { text: ['Our cuts', ' · real network'], at: 'ours', cls: 'cyn', alpha: S => plotOn(S) * prog(S.chart_grow, 0.85, 1) },
    { text: ['Random cuts', ''], at: 'rand', cls: '', alpha: S => plotOn(S) * prog(S.chart_grow, 0.85, 1) * clamp(S.chart_rand, 0, 1) },
    { text: ['Best 8-bit run', ` · ${R.best8.toFixed(2)}`], at: 'best8', cls: 'cyn', minor: true, alpha: S => plotOn(S) * clamp(S.chart_best, 0, 1) * prog(S.chart_grow, 0.95, 1) },
    { text: ['Example network', ' · computed here'], at: 'ex3', cls: 'amb', alpha: S => plotOn(S) * clamp(S.chart_ex, 0, 1) },
    { text: ['Residual', ' · 0 nothing lost, 1 all lost'], at: 'axis', cls: '', alpha: S => plotOn(S) * prog(S.chart_grow, 0, 0.2) },
    { text: ['Bits', ' · qubits per walker'], at: 'bits', cls: '', alpha: S => plotOn(S) * prog(S.chart_grow, 0, 0.2) },
  ];
  for (let b = 1; b <= NBIT; b++) labels.push({ text: [String(b), ''], at: [X(b) - 0.02, Yr(0) - 0.05, ZO], cls: '', minor: true, alpha: S => plotOn(S) * prog(S.chart_grow, (b - 1) / 8, b / 8) });
  const circOn = S => clamp(S.chart_circuit, 0, 1);
  labels.push({ text: () => ['One Trotter step', now.src ? ' · example network, so(7)' : ' · real network, so(7)'], at: 'top', cls: 'mag', alpha: circOn });
  for (const q of [2, 1, 0]) labels.push({ text: ['q' + q, ''], at: 'q' + q, cls: '', alpha: circOn });
  labels.push({ text: ['Time', ''], at: 'time', cls: '', minor: true, alpha: circOn });
  for (let i = 0; i < 6; i++) {
    const text = () => { const g = SRC[now.src][i]; return g ? [g.type, ' θ ' + fmtT(g.theta)] : ['', '']; };
    const at = () => { const g = SRC[now.src][i]; return [Math.max(...g.qubits.map(WX)) + 0.11, ROWY(i), 0]; };
    labels.push({ text, at, cls: SRC[0][i].type === 'RX' ? 'mag' : 'cyn', alpha: S => circOn(S) * clamp(S.chart_gates - i, 0, 1) });
  }
  const cam = { default: [0, 8, 3.9, 0.1, 0.02, 0], chart: [0, 8, 3.9, 0.1, 0.02, 0], circuit: [-14, 6, 4.1, 0.05, 0.03, 0] };
  const controls = [
    { key: 'view', label: 'View', options: [['chart', 'Chart'], ['circuit', 'Circuit']] },
    { key: 'ex', label: 'Example network', options: [['off', 'Off'], ['on', 'On']], when: v => v.view !== 'circuit' },
    { key: 'src', label: 'Angles', options: [['real', 'Real network'], ['ex', 'Example network']], when: v => v.view === 'circuit' },
  ];
  function explore(c) {
    const circ = c.view === 'circuit';
    return { chart_plot: circ ? 0 : 1, chart_circuit: circ ? 1 : 0, chart_grow: 1, chart_rand: 1, chart_best: 1, chart_ex: c.ex === 'on' ? 1 : 0,
      chart_gates: 6, chart_run: 1, chart_src: c.src === 'ex' ? 1 : 0 };
  }
  const API = { residual: R, example: EX.slice(), gates: SRC.map(g => g.map(x => Object.assign({}, x))) };
  return Object.assign(set, {
    params: { chart_a: 1, chart_plot: 1, chart_grow: 1, chart_rand: 1, chart_best: 1, chart_ex: 0, chart_circuit: 0, chart_gates: 6, chart_run: 1, chart_src: 0 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['body', 'tissue', 'slide', 'atlas', 'hier'];
// sets drawn in another set's frame: the slide's tiles and domains lie on the tour's tissue section, so the two always
// turn together (and show together)
const FRAME = { slide: 'tissue' };
const frameOf = k => FRAME[k] || k;
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 400);
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit sets share one sky light and a light from over your shoulder
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 0.85));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(GL.sun); scene.add(GL.sun.target);
  // stars
  const sr = K.rng(9), sp = new Float32Array(1800 * 3), sc = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const z = sr() * 2 - 1, t = sr() * Math.PI * 2, r = Math.sqrt(1 - z * z), b = 0.25 + 0.75 * Math.pow(sr(), 3);
    sp.set([150 * r * Math.cos(t), 150 * z, 150 * r * Math.sin(t)], 3 * i); sc.set([b, b, b * 1.05], 3 * i);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true }));
  scene.add(GL.stars);
  // the sets themselves, all hidden until the story fades them in
  GL.sets = {};
  for (const k of SET_ORDER) {
    const s = SETS[k](K);
    GL.sets[k] = s;
    GL.world.add(s.group);
    s.setAlpha(0);
  }
  // one colour per domain in every set: the atlas set's (from the talk's figures), handed to the sets that take it
  const dc = GL.sets.atlas.api && GL.sets.atlas.api().domainColour;
  if (dc) for (const k of SET_ORDER) { const A = GL.sets[k].api && GL.sets[k].api(), f = A && (A.useColours || A.recolour); if (f && k !== 'atlas') f(dc); }
  // the 29 organs of GTEx as points of light in the tour's body (the engine's own, in the body set's frame)
  GL.dots = makeDots();
  GL.sets.body.group.add(GL.dots.group);
}
// The organs' points: MICRO_DATA.organs' home points in the body, under the params dots (0..1, as far as the body shows)
// and dots_pick (an organ's index + 1, 0 none: it grows and glows white, the others dim a little, and the organ's small
// 3D model (ORGAN3D) floats out beside it, turning slowly, once the models are built). They twinkle gently.
const DOT_COL = '#ff9ec4';
function makeDots() {
  const set = K.newSet('dots'), O = MICRO_DATA.organs, n = O.length, g = K.pointsGeo(n);
  const P = g.attributes.position.array, C = g.attributes.aCol.array, Z = g.attributes.aSize.array, A = g.attributes.aA.array;
  O.forEach((o, i) => { P.set(o.pos, 3 * i); C.set(K.rgb(DOT_COL), 3 * i); Z[i] = 0.05; });
  const pts = new THREE.Points(g, K.points(set, { vertex: 'gl_PointSize *= 1.0 + 0.18 * sin(uTime * 2.3 + position.x * 53.0 + position.y * 31.0);' }));
  pts.renderOrder = 4;
  set.group.add(pts);
  let last = -1, pickT = 0;
  const _p = new THREE.Vector3();
  // the model: only the picked organ's (its geometry swapped when the pick changes, as soon as that model is built: it
  // is wanted first), placed and shown by its uniforms
  const oP = [new THREE.Vector4()], oQ = [new THREE.Vector4()], sh = ORGAN3D.shader(1);
  const om = new THREE.Mesh(new THREE.BufferGeometry(), new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uP: { value: oP }, uQ: { value: oQ },
    uTint: { value: new THREE.Color(...K.rgb(DOT_COL)) } }, vertexShader: sh.vertex, fragmentShader: sh.fragment, transparent: true }));
  set.mats.push(om.material);
  om.frustumCulled = false; om.renderOrder = 5; om.raycast = () => {}; om.visible = false;
  set.group.add(om);
  let omId = null;
  function model(id, t) {
    if (id !== omId) {
      const M = id && ORGAN3D.mesh(id);
      if (id && !M) return false;   // (wanted: built next)
      om.geometry.dispose();
      if (id && t - pickT > 0 && t - pickT < 9) pickT = t;   // (a model that came late grows from now; not after a seek)
      const mg = om.geometry = new THREE.BufferGeometry();
      if (M) {
        mg.setAttribute('position', new THREE.BufferAttribute(M.pos, 3)); mg.setAttribute('normal', new THREE.BufferAttribute(M.nrm, 3));
        mg.setAttribute('aCol', new THREE.BufferAttribute(M.col, 3)); mg.setAttribute('aSlot', new THREE.BufferAttribute(new Float32Array(M.pos.length / 3), 1));
        mg.setIndex(new THREE.BufferAttribute(M.idx, 1));
      }
      omId = id;
    }
    return !!id;
  }
  return Object.assign(set, {
    update(S, t) {
      const k = Math.round(S.dots_pick || 0);
      if (k !== last) {
        pickT = last < 0 ? t - 9 : t; last = k;
        O.forEach((o, i) => { const on = k === i + 1; Z[i] = on ? 0.11 : 0.05; A[i] = !k || on ? 1 : 0.45; C.set(K.rgb(on ? '#ffffff' : DOT_COL), 3 * i); });
        g.attributes.aSize.needsUpdate = g.attributes.aA.needsUpdate = g.attributes.aCol.needsUpdate = true;
      }
      if (t < pickT) pickT = t - 9;   // (a seek back: shown at once)
      // the picked organ's model grows out in front of the body, beside its point (left of it: its label runs right)
      const o = O[k - 1];
      om.visible = model(o ? ORGAN3D.idOf(o.name) : null, t);
      if (!om.visible) return;
      const gr = smooth(clamp((t - pickT) / 0.9, 0, 1));
      oQ[0].set(gr, 0.25, t * 0.5, 0);
      oP[0].set(o.pos[0] - 0.19 * gr, o.pos[1] + 0.03, o.pos[2] + 0.16 * gr, 0.075 * (0.3 + 0.7 * gr));
    },
    // the organ a ray passes closest to (within about 0.045 of its point, in the body's units), or -1
    pick(rc) {
      pts.updateMatrixWorld();
      let best = -1, bd = 0.045 * pts.matrixWorld.getMaxScaleOnAxis();
      O.forEach((o, i) => { _p.fromArray(o.pos).applyMatrix4(pts.matrixWorld); const d = rc.ray.distanceToPoint(_p); if (d < bd) { bd = d; best = i; } });
      return best;
    },
  });
}
// show each set as far as S fades it in, and let the visible ones update (the hidden ones idle); in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
    else if (s.idle) s.idle(dt);   // a hidden set may build in slices
  }
  // the organs' 3D models and their pictures build between frames from the start, one organ after another (the one a
  // pane or the body wants first): a short slice a frame in a headset (3 ms), elsewhere a quarter of the frame, 4 to
  // 8 ms (a little more where frames are slow anyway). Each picture goes into the HTML chips waiting for it as it is
  // done, and the headset's panels redraw on GL.orgV (at most twice a second while they come)
  if (!GL.orgDone) {
    ORGAN3D.driven = true;
    GL.orgDone = ORGAN3D.step(GL.renderer.xr.isPresenting ? 3 : clamp((dt || 0) * 250, 4, 8));
    const v = ORGAN3D.version();
    if (v !== GL.orgSeen) { GL.orgSeen = v; fillOrganPics(); }
    const now = performance.now();
    if (GL.orgDone || now - (GL.orgVT || 0) > 500) { GL.orgVT = now; GL.orgV = v; }
  }
  const da = (S.body_a || 0) * (S.dots || 0);
  GL.dots.setAlpha(da);
  if (da > 0.003) GL.dots.update(S, t);
}

// ---------------------------------------------------------------- camera --
// A view is [az, el, dist, tx, ty, tz]: look at the target (tx, ty, tz) from the
// direction az (around the vertical, degrees) and el (up, degrees), dist away.
const _vd = new THREE.Vector3(), _vt = new THREE.Vector3();
function viewDir(v, out) {
  const A = v[0] * D2R, E = clamp(v[1], -85, 85) * D2R;
  return out.set(Math.cos(E) * Math.sin(A), Math.sin(E), Math.cos(E) * Math.cos(A));
}
// on a screen narrower than square (a phone held upright) a wide view stands further back: GL.nf is the view's own
// factor (NARROW in the story; 1 for most views), taken in full at half as wide as tall
GL.nf = 1;
const narrowK = () => (GL.wide || !(GL.nf > 1) ? 1 : 1 + (GL.nf - 1) * clamp((1 - (GL.aspect || 1)) / 0.5, 0, 1));
// (v[7..9]: the target's shift clear of the side panel, FIT in the story; on a screen without a side panel it goes back)
function applyCamera(v) {
  const u = GL.wide ? 0 : 1;
  viewDir(v, _vd); _vt.set(v[3] - u * (v[7] || 0), v[4] - u * (v[8] || 0), v[5] - u * (v[9] || 0));
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1) * narrowK());
  GL.camera.up.set(0, 1, 0); GL.camera.lookAt(_vt);
}
// sets on show may keep the camera out of their solid parts (as the muscle story's supercomputer does): keepOut takes the camera's
// position in the set's own frame (t: story time, for the set's turn; null in explore mode) and returns it, moved if
// need be; still(p) says explore mode should stop swaying the view (GL.still, read next frame)
const _yA = new THREE.Vector3(0, 1, 0), _kp = new THREE.Vector3();
function keepCamera(S, t) {
  GL.still = false;
  for (const k of SET_ORDER) {
    const s = GL.sets[k];
    if (!s.keepOut || (S[k + '_a'] || 0) < 0.05) continue;
    const yaw = t === null ? 0 : setYaw(k, t) * D2R;
    _kp.copy(GL.camera.position).applyAxisAngle(_yA, -yaw);
    const p = [_kp.x, _kp.y, _kp.z], q = s.keepOut(p);
    if (s.still && s.still(q)) GL.still = true;
    if (q !== p) { GL.camera.position.copy(_kp.set(q[0], q[1], q[2]).applyAxisAngle(_yA, yaw)); GL.camera.lookAt(_vt); }
  }
}
function resize() {
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide; GL.aspect = w / h;
  if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  // (on a narrow screen held sideways the panel leaves only a strip above it, about 0.56 h - 122 px tall: the scene
  // stands back far enough to fit that strip, in full from 1.2 : 1 on; upright screens keep their own framing)
  const strip = Math.max(0.12, (0.56 * h - 122) / h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62, 0.9 / strip * clamp((w / h - 0.6) / 0.6, 0, 1));
  camera.updateProjectionMatrix();
}
// the sun comes from over the viewer's left shoulder; point sizes follow the screen (and the world's scale in a headset)
const LV = new THREE.Vector3(), _v2 = new THREE.Vector2();
function updateLight(xr) {
  LV.set(-0.5, 0.6, 1.0).normalize().applyQuaternion(xr ? XR.headQ : GL.camera.quaternion);
  GL.sun.position.copy(LV); GL.sun.target.position.set(0, 0, 0);
  if (xr) K.U.uPx.value = XR.viewH * 0.5 * XR.R;
  else K.U.uPx.value = GL.renderer.getDrawingBufferSize(_v2).y * 0.5;
}

// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [2.6, 2.4], [5.9, 4], [6.5, 4.6], [12.8, 7], [18.9, 10], [19.5, 10.6],  // Intro
  [29, 14], [29.7, 14.6], [30.5, 15.2], [41.4, 20.5], [50.4, 27], [60.8, 36.5], [64.1, 38.5],
  [66.9, 41.1], [71.1, 42.5], [73.6, 44.5], [78.4, 47], [79.1, 47.6],  // Slide
  [86.2, 50], [87.5, 51.2], [92.8, 55], [101.6, 63], [111.3, 71],  // Library
  [126.7, 85], [127.4, 85.6], [128.6, 86.5], [168.3, 122.6], [178.2, 126],  // Method
  [185.1, 130], [186.4, 131.18], [187.8, 131.2], [193.6, 136.5], [195.6, 138], [209.5, 150.6],
  [213.7, 151], [215.9, 153], [218.7, 155], [224.2, 160], [229.9, 163],  // Atlas
  [238, 170], [239.3, 171.2], [245.8, 176], [246.5, 176.6], [256, 179.5], [264.5, 184], [296, 212.6],  // Age
  [303.4, 215], [304.7, 216.2], [309.6, 220], [321.7, 231], [330.6, 237], [341.2, 244],  // Disease
  [347.8, 250], [349.1, 251.2], [355.6, 256], [374.3, 273], [380.8, 278], [381.5, 278.6],  // Contacts
  [403.5, 285], [404.2, 285.6], [405.4, 286.2], [406.1, 286.8], [413.9, 289.5], [423.3, 296],
  [423.9, 296.6], [442.7, 298.5], [445, 300.6], [456.2, 305],  // Next
];
// recording time -> original story time
function storyT(t) {
  const W = NARRATION_SYNC;
  if (t <= 0) return 0;
  for (let i = 1; i < W.length; i++) {
    if (t <= W[i][0]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return o0 + (o1 - o0) * (t - n0) / (n1 - n0); }
  }
  return W[W.length - 1][1] + (t - W[W.length - 1][0]);
}
// original story time -> recording time
function narrT(o) {
  const W = NARRATION_SYNC;
  for (let i = 1; i < W.length; i++) {
    if (o <= W[i][1]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); }
  }
  return W[W.length - 1][0] + (o - W[W.length - 1][1]);
}
let T_END = NARRATION_SYNC[NARRATION_SYNC.length - 1][0];
const CH = [
  { key: 'title', name: 'Intro', a: 0, b: 14 },
  { key: 'slide', name: 'Slide', a: 14, b: 50 },
  { key: 'library', name: 'Library', a: 50, b: 85 },
  { key: 'method', name: 'Method', a: 85, b: 130 },
  { key: 'atlas', name: 'Atlas', a: 130, b: 170 },
  { key: 'age', name: 'Age', a: 170, b: 215 },
  { key: 'pathology', name: 'Disease', a: 215, b: 250 },
  { key: 'contacts', name: 'Contacts', a: 250, b: 285 },
  { key: 'next', name: 'Next', a: 285, b: 305 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden
const DEF = {};
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
  DEF.dots = 0; DEF.dots_pick = 0;   // the engine's own organ points in the body (makeDots)
}
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i];
      return t1 <= t0 ? v1 : v0 + (v1 - v0) * smooth((t - t0) / (t1 - t0));
    }
  }
  return ks[ks.length - 1][1];
}
function storyState(t) {
  const s = {};
  for (const n in DEF) s[n] = evalTrack(n, t);
  return s;
}
const fadeVal = (t, a, b, d) => (t <= a || t >= b ? 0 : Math.min(smooth((t - a) / d), smooth((b - t) / d)));

const ST = { labels: [], items: [] };
// a set's camera view by name (falls back to its default view)
// (with the story's own framing on top: FIT)
const view = (k, name) => {
  const c = GL.sets[k].cam, v = (c[name] || c.default).slice(), f = c[name] && FIT[k] && FIT[k][name];
  if (f) for (let i = 0; i < f.length; i++) v[i] += f[i];
  return v;
};
// the part of a view's FIT that moves its target clear of the side panel: on a screen without one (a phone, a narrow
// window) applyCamera takes it back, so the view stays centred there
const fitShift = (k, name) => { const f = GL.sets[k].cam[name] && FIT[k] && FIT[k][name]; return f ? [f[3] || 0, f[4] || 0, f[5] || 0] : [0, 0, 0]; };
// views whose parts reach under the side panel or off the right edge on a landscape screen: a little further back,
// or their target moved, so they fit beside the panel (added to the set's own view, in story and explore mode alike)
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline)
// (the section, 2.1 long, needs about 4 units' distance to fit right of the panel: further back, and moved right)
const SEC = [0, 0, 0.6, -0.22];
const FIT = { atlas: { default: [0, 0, 1.1, -0.22], library: [0, 0, 1.1, -0.22], atlas: [0, 0, 0.8, -0.35], focus: [0, 0, 0.55, -0.05, 0.0], volcano: [0, 0, 0.45, -0.2],
  curves: [0, 0, 1.1, -0.32], age: [0, 0, 0.45, -0.2] },
  body: { default: [0, 0, 0.55], front: [0, 0, 0.55] }, hier: { net: [0, 0, 0.35, 0, 0.05], default: [0, 0, 0.25, 0, 0.03] }, tissue: { default: SEC, section: SEC }, slide: { default: SEC, section: SEC, domains: SEC, age: SEC, tiles: [0, 0, 0.35, -0.25], close: [0, 0, 0.6, -0.14], group: [0, 0, 0.85, -0.17] } };
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen
const NARROW = { tissue: { section: 1.2, default: 1.2 }, slide: { default: 1.2, domains: 1.2, group: 1.25 }, atlas: { library: 1.1, default: 1.1, atlas: 1.2, volcano: 1.15, curves: 1.15 },
  hier: { net: 1.2, default: 1.2 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The preprint's numbers and Iva Buljan's network of organ architecture (MICRO_DATA), looked up once for the story and
// the panes. In the network, domains hang on tissue types (not on organs): an organ reaches its domains only through
// the tissue types it has, which other organs share.
const MD = (() => {
  const D = MICRO_DATA, N = D.graph.nodes, adj = N.map(() => new Set());
  for (const [a, b] of D.graph.edges) if (a !== b) { adj[a].add(b); adj[b].add(a); }
  const byName = (i, j) => N[i][0].localeCompare(N[j][0]);
  const nb = (i, level) => [...adj[i]].filter(j => N[j][1] === level).sort(byName);
  const atLevel = level => N.map((n, i) => i).filter(i => N[i][1] === level).sort(byName);
  const types = atLevel(2), domains = atLevel(3);
  const organs = D.organs.map((o, i) => {
    const node = N.findIndex(n => n[1] === 0 && n[0] === o.name), tis = node >= 0 ? nb(node, 1) : [];
    const ty = new Set(node >= 0 ? nb(node, 2) : []);
    tis.forEach(t => nb(t, 2).forEach(x => ty.add(x)));
    return Object.assign({ i, node, tissues: tis.map(t => N[t][0]), types: [...ty].sort(byName) }, o);
  });
  // a tissue type's domains, and the organs that have it (directly or through one of their tissues)
  const typeDomains = t => nb(t, 3);
  const typeOrgans = t => organs.filter(o => o.types.includes(t));
  const typeOfDomain = d => nb(d, 2)[0] ?? -1;
  return { D, N, adj, organs, types, domains, typeDomains, typeOrgans, typeOfDomain,
    organ: name => organs.find(o => o.name.toLowerCase() === String(name || '').toLowerCase()) || null,
    domain: name => domains.find(d => N[d][0].toLowerCase() === String(name || '').toLowerCase()) ?? -1,
    type: name => types.find(t => N[t][0].toLowerCase() === String(name || '').toLowerCase()) ?? -1 };
})();
const nodeName = i => (MD.N[i] ? MD.N[i][0] : '');
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
// a GTEx tissue's own part, for a list under its organ ('Adipose - Subcutaneous' under Adipose: 'Subcutaneous')
const tisShort = (t, organ) => (t.startsWith(organ + ' - ') ? t.slice(organ.length + 3) : t);
// the network's four levels and their colours (as in the talk's Figure 5)
const LEVEL_COL = ['#1f8a4c', '#7ccf7e', '#ef8f7a', '#5aa9ff'];
const levelName = l => (MICRO_DATA.levels || ['organ', 'tissue', 'tissue type', 'domain'])[l];
// what the sets know (their api()): the atlas's 40 tissues, the slide's domains, the network's nodes and contact organs
const setApi = k => (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null);
const API = {};
const api = k => API[k] || (API[k] = setApi(k) || {});
// a domain's colour, the same in every set (the atlas set's palette; else the slide's; else a fixed one by name)
const PAL = ['#ff9ec4', '#ffd166', '#4d94ff', '#3ee08f', '#c77dff', '#ff8a5b', '#46d9ff', '#f4a6ff', '#b8e05a', '#ff5a7a'];
function domCol(name) {
  for (const k of ['atlas', 'slide']) { const f = api(k).domainColour; if (f) { try { const c = f(name); if (c) return c; } catch (e) { /* the next */ } } }
  let h = 0; for (const ch of String(name)) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
  return PAL[h % PAL.length];
}
// an organ's section in the atlas (atlas_focus: a tissue's index + 1; 0 none): its own tissue, or its first
const atlasIdx = name => {
  const T = api('atlas').tissues || [], n = String(name || '').toLowerCase();
  const i = T.findIndex(t => t.toLowerCase() === n), j = i >= 0 ? i : T.findIndex(t => t.toLowerCase().startsWith(n + ' - '));
  return j + 1;
};
// the organ a tissue of the atlas belongs to
const tissueOrgan = t => { const s = String(t || ''); return MD.organs.find(o => s === o.name || s.startsWith(o.name + ' - ') || o.tissues.includes(s)) || null; };
// a node of the network set by name and level (hier_focus), or -1
const hierIdx = (name, level) => { const L = api('hier').nodes || []; const n = String(name || '').toLowerCase(); return L.findIndex(x => x.level === level && String(x.name).toLowerCase() === n); };
// a domain of the network on the slide (slide_focus: its index + 1; 0 none): the same name, or one that starts alike
// ('muscularis' and 'muscularis inner', 'lymphoid Peyer patches' and 'lymphoid')
function slideIdx(name) {
  const L = (api('slide').domains || []).map(x => String(x).toLowerCase()), n = String(name || '').toLowerCase();
  if (!n) return 0;
  let i = L.indexOf(n);
  if (i < 0) i = L.findIndex(x => x.startsWith(n + ' ') || n.startsWith(x + ' '));
  if (i < 0) i = L.findIndex(x => x.split(' ')[0] === n.split(' ')[0]);
  return i + 1;
}
// the network's domain a slide domain stands for (its name, or the one that starts alike), or ''
function slideDomain(k) {
  const s = String((api('slide').domains || [])[k] || '').toLowerCase();
  if (!s) return '';
  const D = MD.domains.map(d => nodeName(d));
  return D.find(n => n.toLowerCase() === s) || D.find(n => s.startsWith(n.toLowerCase() + ' ') || n.toLowerCase().startsWith(s + ' '))
    || D.find(n => n.toLowerCase().split(' ')[0] === s.split(' ')[0]) || '';
}
// the contact networks' organs (hier_organ: an index into them) and the preprint's findings for one of them
const contactIdx = re => Math.max(0, (api('hier').contactOrgans || []).findIndex(o => re.test((o && o.name) || o)));
// the talk's figures, when read: the domains drawn for a tissue ({ name, share }), else none. The figures name tissues
// their own way ('Artery coronary', 'Tibial nerve', 'Aorta'): a reading fits a GTEx tissue when all its words are in it
const words = s => String(s || '').toLowerCase().replace(/\(.*?\)/g, '').split(/[^a-z]+/).filter(Boolean);
const tidyDom = s => String(s).replace(/pathches/g, 'patches').replace(/adventita/g, 'adventitia').replace(/\bmedula\b/g, 'medulla').replace(/\s*\/\s*/g, ' and ');
// (a reading named only by its organ, 'Colon' or 'Heart', fits no tissue of an organ sampled at two sites: which one the
// talk shows is not said)
function figDomains(tissue) {
  const A = (MICRO_DATA.figures || {}).atlas, w = words(tissue), O = tissueOrgan(tissue);
  if (!Array.isArray(A) || !w.length) return [];
  const only = x => O && O.tissues.length > 1 && words(x).join() === words(O.name).join();
  const e = A.find(x => x && words(x.tissue).join() === w.join()) || A.find(x => x && words(x.tissue).length && !only(x.tissue) && words(x.tissue).every(q => w.includes(q)));
  return e && Array.isArray(e.domains) ? e.domains.filter(d => d && d.name && !/tissue edge/i.test(d.name)).map(d => ({ name: tidyDom(d.name), share: +d.share || 0 })) : [];
}

// ------------------------------------------------------------------ facts --
// Numbers and findings the story quotes, all from MICRO_DATA (a finding not there leaves its sentence out)
const FACTS = (() => {
  const D = MICRO_DATA, F = D.facts, fd = D.findings || {}, path = fd.pathology || [], inter = fd.interactions || [];
  const lv = [0, 0, 0, 0];
  D.graph.nodes.forEach(n => { lv[n[1]]++; });
  // the tissue type shared most widely: the one most organs have
  const wide = MD.types.map(t => ({ name: nodeName(t), organs: MD.typeOrgans(t).length })).sort((a, b) => b.organs - a.organs)[0] || null;
  const yr = /bioRxiv (\d{4})/.exec(D.source.preprint || '');
  return Object.assign({}, F, {
    tilesM: Math.round(F.tiles / 1e6), levels: lv, wide, year: yr ? +yr[1] : null,
    plaque: path.find(p => /plaque/i.test(p.kind)) || null, infarct: path.find(p => /infarct/i.test(p.kind)) || null,
    remodel: path.filter(p => !/plaque|infarct/i.test(p.kind)),
    colon: inter.find(x => /colon/i.test(x.organ) && x.a) || null, artery: inter.find(x => /arter/i.test(x.organ) && x.a) || null, inter,
    ex: D.examples || [], most: fd.most || '', connective: fd.connective || '', stable: fd.stable || '',
    figs: Object.keys(D.figures || {}),
  });
})();
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const pct = v => (Number.isFinite(+v) ? `${+v}%` : '–');
const signed = v => (v > 0 ? '+' : v < 0 ? '−' : '') + Math.abs(v);
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on a
// light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
// a worked example of change with age in a line: what it is, its share at both ages and per decade
const exText = x => `${x.note}; ${pct(x.from)} of the section at ${FACTS.ages[0]}, ${pct(x.to)} at ${FACTS.ages[1]} (${signed(x.perDecade)}% per decade)`;
const exName = x => `${cap(x.tissue)} · ${x.domain}`;
// a change in the contacts between two domains, in words
// where a finding is ('in arteries', 'in the heart')
const inOrgan = o => (/^arter/i.test(o) ? 'in arteries' : `in the ${String(o).toLowerCase()}`);
const where = x => (x.note && /arter/i.test(x.note) ? x.note : `the ${String(x.organ).toLowerCase()}`);
const meet = x => (x.a ? `${cap(x.a)} and ${x.b} meet ${x.dir > 0 ? 'more' : 'less'} with age in ${where(x)}` : `In ${where(x)}, ${x.note}`);

function buildStory() {
  const F = FACTS;
  // fade a set in over [t0, t1] and out over [t2, t3]; the slide always comes with the tissue section it lies on
  const show = (k, t0, t1, t2, t3) => {
    for (const s of k === 'slide' ? ['tissue', 'slide'] : [k]) { ramp(s + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(s + '_a', t2, t3, 1, 0); }
  };
  const hide = (k, t0, t1) => { for (const s of k === 'slide' ? ['tissue', 'slide'] : [k]) ramp(s + '_a', t0, t1, 1, 0); };
  // jump an index param (a domain, a tissue, an organ) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const sd = (...names) => names.reduce((f, n) => f || slideIdx(n), 0);   // slide_focus for a domain of the section (the first name it has)
  // atlas_focus for each worked example (the atlas set's own choice, else by name; the gut's is shown on the slide)
  const exI = F.ex.map((x, i) => (Array.isArray(api('atlas').examples) && api('atlas').examples[i] >= 0 ? api('atlas').examples[i] + 1 : atlasIdx(x.tissue)));
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  const exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const others = F.inter.filter(x => x !== F.colon && x !== F.artery).map(x => (x.a ? `${x.a} and ${x.b} meet ${x.dir > 0 ? 'more' : 'less'} in ${where(x)}` : `in ${where(x)}, ${x.note}`));
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Tissue and time</h1>
      <p class="lede" data-at="2.4">how organs are built, and how they age</p>
      <p data-at="4">How the body's organs are built from small working units, and how they change as we age.</p>
      <p data-at="7">Each point of light is one of the ${F.organs} organs whose tissue GTEx collected from ${fmt(F.donors)} people.</p>
      <p class="note" data-at="10">After a preprint${F.year ? ` (bioRxiv, ${F.year})` : ''}, a poster and a talk from the Rendeiro group: CeMM, the LBI for Network Medicine and the Medical University of Vienna.</p>`,
    slide: `<h2 data-at="0.6">One slide</h2>
      ${turns(`<p data-at="1.2" data-out="21.5">Take a thin slice of an organ, here the wall of the stomach, and stain it. This is H&amp;E (haematoxylin and eosin), the standard stain of pathology.</p>
        <p data-at="6.5" data-out="21.5">Haematoxylin colours the cells' nuclei purple-blue; eosin colours their cytoplasm and the fibres between them pink. White is fat, or empty space.</p>
        <p data-at="13" data-out="21.5">Close up, it is all cells. Yet they are not scattered at random: they are arranged in units that each do a job.</p>`,
      `<ul class="steps">
          ${step(22.5, 0, domCol('mucosa'), 'Mucosa', 'the lining: glands that make mucus and acid')}
          ${step(24.5, 0, domCol('submucosa'), 'Submucosa', 'loose tissue with blood vessels')}
          ${step(26.5, 0, domCol('inner circular smooth muscle'), 'Muscularis', 'layers of muscle, one around and one along, that move food on')}
          ${step(28.5, 0, domCol('lymphoid tissue'), 'Lymphoid patch', 'a cluster of immune cells')}
        </ul>
        <p data-at="30.5" class="amber">Such recurring arrangements are microanatomical domains: the units between cells and organs.</p>
        <p class="credits" data-at="33">Slides like this are cheap, plentiful and show a wide field. This section is drawn, not a real slide.</p>`)}`,
    library: `<h2 data-at="0.6">${fmt(F.slides)} slides</h2>
      <p data-at="1.2">GTEx (the Genotype-Tissue Expression project) collected tissue from ${fmt(F.donors)} people who died aged ${F.ages[0]} to ${F.ages[1]}.</p>
      <div class="facts"><div data-at="5"><b>${fmt(F.donors)}</b><small>people</small></div><div data-at="6.5"><b>${F.tissues}</b><small>tissues</small></div><div data-at="8"><b>${F.organs}</b><small>organs</small></div><div data-at="9.5"><b>${fmt(F.slides)}</b><small>slides</small></div></div>
      <p data-at="13">Each slide is one tissue of one person. Here each column is a tissue, and each row an age, the youngest at the bottom.</p>
      <p data-at="21" class="amber">Enough to compare how organs are built, and to see how that changes with age.</p>
      <p class="credits" data-at="27">${fmt(F.donorsAnalysed)} people's slides were analysed: median age ${F.medianAge}, ${pct(F.male)} men. The slides here are drawn, not the GTEx images.</p>`,
    method: `<h2 data-at="0.6">Finding the domains</h2>
      ${turns(`<ul class="steps">
          ${step(1.5, 36.5, '#46d9ff', '1 · Tiles', `each slide is cut into small squares (far smaller than drawn here): ${F.tilesM} million tiles in all`)}
          ${step(9.5, 36.5, '#46d9ff', '2 · Features', 'a deep-learning vision model describes each tile with a list of numbers (drawn here as 16 blocks of colour)')}
          ${step(17.5, 36.5, '#46d9ff', '3 · Neighbours', 'joined to its neighbours, each tile mixes in their descriptions: messages run along the links (message passing)')}
          ${step(26.5, 36.5, '#46d9ff', '4 · Domains', 'in a map of the mixed descriptions, alike tiles gather, across all slides: each group is a domain, and colours the slide')}
        </ul>`,
      `<p data-at="37">No labels needed: a pathologist named the domains afterwards. The method, ${esc(F.method)}, agrees with pathologists' notes (salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r}; r = 1 would be perfect).</p>
        <p data-at="41" class="amber">Now the tiles of every tissue in one map: alike tiles lie close together, coloured by domain.</p>`)}`,
    atlas: `<h2 data-at="0.6">An atlas of the body</h2>
      ${turns(`<p data-at="1.2" data-out="19.5">Across the ${F.tissues} tissues: ${F.domains} domains of ${F.types} types, in ${F.superclasses} classes.</p>
        <div class="facts"><div data-at="5" data-out="19.5"><b>${F.types}</b><small>types of domain</small></div><div data-at="6.5" data-out="19.5"><b>${pct(F.shared3)}</b><small>in three or more tissues</small></div><div data-at="8" data-out="19.5"><b>${pct(F.specific)}</b><small>in one tissue only</small></div></div>
        <p data-at="11" data-out="19.5">A few kinds recur in many tissues, such as connective tissue and blood vessels. Most belong to one tissue.</p>`,
      `<p data-at="20">Iva Buljan's network of organ architecture puts it together in four levels:</p>
        <ul class="legend">${[`${F.levels[0]} organs`, `their tissues, where an organ has several (${F.levels[1]})`, `${F.levels[2]} tissue types`, `${F.levels[3]} domains, as named in this map`].map((t, l) => `<li data-at="${21 + 2 * l}"><span class="sw" style="background:${LEVEL_COL[l]}"></span>${t}</li>`).join('')}</ul>
        ${F.wide ? `<p data-at="30" class="amber">${esc(cap(F.wide.name))} is the tissue type shared most widely: ${F.wide.organs} of the ${F.organs} organs have it.</p>` : ''}
        <p class="credits" data-at="33">The network as in the talk's Figure 5: domains hang on tissue types, and tissue types on organs and their tissues.</p>`)}`,
    age: `<h2 data-at="0.6">Age</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Of ${F.donorVars} things known about the donors, age is the strongest in explaining how their domains differ.</p>
        <p data-at="6" data-out="13.5" class="amber">${pct(F.ageChange)} of domains change with age (${F.agePairs[0]} of ${F.agePairs[1]} pairs of a domain and a tissue, where the domain covers more than ${pct(F.agePairsMin)}), mostly by less than ${pct(F.mostUnder)} per decade.</p>
        <p class="credits" data-at="9.5" data-out="13.5">Each bubble is a domain in a tissue: right, it grows with age; left, it shrinks; higher, the change is surer.</p>`,
      `<ul class="steps">${F.ex.map((x, i) => step(14 + 10 * i, 0, exCol[i], exName(x), esc(exText(x)))).join('')}</ul>
        <p data-at="42">${esc(F.connective)} ${esc(F.most)}</p>`)}`,
    pathology: `<h2 data-at="0.6">Disease</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">GTEx's pathologists noted what they saw on each slide: ${fmt(F.pathology.instances)} notes of ${F.pathology.kinds} kinds.</p>
        <ul class="steps">${[F.plaque, F.infarct].filter(Boolean).map((p, i) => step(5 + 4 * i, 15.5, i ? '#ff5a4b' : '#ffb43b', cap(p.kind), `${esc(inOrgan(p.organ))}: ${esc(p.note)}`)).join('')}</ul>`,
      `<p data-at="16" class="amber">Disease and healthy ageing often remodel different parts of a tissue: how much of a domain there is, its shape, or both.</p>
        ${F.remodel.length ? `<p data-at="22">For example: ${esc(F.remodel.map(p => `${p.kind} ${p.note}`).join('; '))}.</p>` : ''}
        <p class="credits" data-at="29">${F.figs.includes('trajectories') ? 'Curves read off the talk\'s figures.' : 'Curves drawn after the preprint\'s descriptions, not its data points.'}</p>`)}`,
    contacts: `<h2 data-at="0.6">Neighbours</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">Domains touch. Which ones meet, and how much, makes a network of contacts in each organ.</p>
        ${F.colon ? `<p data-at="6" data-out="16.5">${esc(meet(F.colon))}.</p>` : ''}`,
      `${F.artery ? `<p data-at="17">${esc(meet(F.artery))}.</p>` : ''}
        ${F.stable ? `<p data-at="23" class="amber">${esc(F.stable)}</p>` : ''}
        ${others.length ? `<p class="credits" data-at="28">Also: ${esc(others.join('; '))}. Contact networks drawn after the preprint's findings.</p>` : ''}`)}`,
    next: `<h2 data-at="0.6">Tissue and time</h2>
      ${turns(`<p data-at="1.2" data-out="10.5">A map of how the body is built, from cells to domains to organs, and of how it changes with age.</p>
        <p data-at="4.5" data-out="10.5" class="amber">It may help to study ageing itself, to spot early signs of disease in routine slides, and to compare organs on one scale.</p>`,
      `<p data-at="11">Preprint: Iva Buljan, Z. Bagó-Horváth and A. F. Rendeiro${F.year ? ` (bioRxiv, ${F.year})` : ''}. Poster and talk: Iva Buljan, of the Rendeiro group at CeMM (Research Center for Molecular Medicine of the Austrian Academy of Sciences), the LBI for Network Medicine and the Medical University of Vienna. Slides: ${esc(F.gtex)}.</p>
        <p data-at="13.5"><button class="btn primary" id="btnGoExplore" type="button">Explore the atlas</button></p>
        <p class="credits" data-at="15">Slides, sections and tiles are drawn, not the GTEx images; the domain maps, the volcano's other points and the contact networks are illustrative where the figures give no numbers.</p>`)}`,
  };

  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });

  // ------------------------------------------------------------ timeline keys
  const wp = [];
  // a camera waypoint at time t: a set's named view, turned by spin degrees, optionally nudged
  // (the tissue and the slide share one frame, so their waypoints turn them together)
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  start({ body_pet: 1, body_net: 0, body_state: 0, body_blank: 0, dots: 0, dots_pick: 0, tissue_graph: 0, tissue_mark: 0, tissue_embed: 0,
    slide_tiles: 0, slide_feat: 0, slide_adj: 0, slide_group: 0, slide_domain: 0, slide_age: 0, slide_focus: 0,
    atlas_lib: 0, atlas_map: 0, atlas_umap: 0, atlas_focus: 0, atlas_age: 0, atlas_volcano: 0, atlas_curves: 0,
    hier_grow: 0, hier_focus: -1, hier_contacts: 0, hier_organ: 0, hier_age: 0 });
  const stomach = MD.organs.findIndex(o => /stomach/i.test(o.name)) + 1;
  if (stomach) ORGAN3D.want(ORGAN3D.idOf(MD.organs[stomach - 1].name));   // (its model is the first the story shows: built first)
  let a, b;
  // Intro: the tour's PET body, the organs' points lighting up one by one
  a = C.title.a; b = C.title.b;
  show('body', 0.2, 2);
  ramp('dots', a + 3, a + 7, 0, 1);
  cam(a, 'body', 'front', -14);
  cam(b - 2.5, 'body', 'front', 8, 'spin');
  // One slide: into the stomach (its point glows), the section, close up, then its domains wash in, one by one
  a = C.slide.a; b = C.slide.b;
  jump('dots_pick', a - 2.5, 0, stomach);
  const st = (MD.organs[stomach - 1] || { pos: [0, 0, 0] }).pos;
  cam(a + 1.5, 'body', 'front', 4, null, [0, 0, -2.6, st[0], st[1], st[2]]);
  hide('body', a + 1.2, a + 3);
  show('slide', a + 1.8, a + 4);
  cam(a + 4, 'tissue', 'section', -8);
  cam(a + 11, 'tissue', 'section', 6, 'spin');
  cam(a + 15, 'tissue', 'zoom');
  cam(a + 20, 'tissue', 'zoom', 10, 'spin');
  cam(a + 23.5, 'slide', 'domains', -6);
  cam(b - 0.5, 'slide', 'domains', 6, 'spin');
  ramp('slide_domain', a + 22, a + 27, 0, 1);
  // (each glows as its line appears; one the section does not have is skipped; then all of them again)
  let f0 = 0;
  for (const [f, t] of [[sd('mucosa'), 22.5], [sd('submucosa'), 24.5], [sd('inner circular smooth muscle', 'muscularis'), 26.5], [sd('outer longitudinal smooth muscle'), 27.5],
    [sd('lymphoid tissue', 'lymphoid'), 28.5], [-1, 30.5]]) if (f && f !== f0) { const v = Math.max(0, f); jump('slide_focus', a + t, f0, v); f0 = v; }
  // 24,945 slides: the library, column by tissue, row by age
  a = C.library.a; b = C.library.b;
  hide('slide', a, a + 2);
  show('atlas', a + 0.5, a + 2.5);
  ramp('atlas_lib', a + 1, a + 14, 0, 1);
  // (the slides burst onto the wall; the camera goes along the rack up close, glass slides with their tissue, then
  // back to the whole wall)
  cam(a + 1, 'atlas', 'library', -12);
  cam(a + 6, 'atlas', 'shelf');
  cam(a + 11, 'atlas', 'shelf', 8, 'spin');
  cam(a + 16.5, 'atlas', 'library', -4);
  cam(b - 0.5, 'atlas', 'library', 12, 'spin');
  // Finding the domains: back at the section, the four steps, built as the tour builds its cell network: the tiles,
  // their features lighting up (16 blocks each), a network over them whose links carry messages, the lift into a map
  // of the mixed descriptions where alike tiles gather and take their domain's colour, and back down onto the slide;
  // then the tile cloud of all slides
  a = C.method.a; b = C.method.b;
  hide('atlas', a, a + 2);
  jump('slide_domain', a, 1, 0);
  show('slide', a + 0.5, a + 2.5, a + 37, a + 39);
  ramp('slide_tiles', a + 2, a + 8, 0, 1);
  ramp('slide_feat', a + 9.5, a + 15.5, 0, 1);
  ramp('slide_adj', a + 17.5, a + 24, 0, 1);
  ramp('slide_group', a + 26.5, a + 30.5, 0, 1);
  ramp('slide_group', a + 33, a + 35.5, 1, 2);
  ramp('slide_domain', a + 33.5, a + 36, 0, 1);
  cam(a + 2, 'slide', 'tiles', -8);
  cam(a + 8, 'slide', 'tiles', 4, 'spin');
  cam(a + 10.5, 'slide', 'matrix');
  cam(a + 16, 'slide', 'matrix', 6, 'spin');
  cam(a + 18.5, 'slide', 'close');
  cam(a + 25, 'slide', 'close', 8, 'spin');
  cam(a + 28.5, 'slide', 'group');
  cam(a + 33, 'slide', 'group', 6, 'spin');
  cam(a + 36, 'slide', 'domains');
  // (the sections come forward from the library's wall, and the tiles rise out of them)
  show('atlas', a + 37.5, a + 39.5);
  ramp('atlas_map', a + 37.5, a + 40, 0, 1);
  ramp('atlas_umap', a + 40, a + 44, 0, 1);
  cam(a + 39, 'atlas', 'umap', -10);
  cam(b - 0.5, 'atlas', 'umap', 25, 'spin');
  // An atlas of the body: a section per tissue; then the network of organ architecture growing level by level
  a = C.atlas.a; b = C.atlas.b;
  ramp('atlas_umap', a + 1, a + 4, 1, 0);
  cam(a + 2.5, 'atlas', 'atlas', -6);
  cam(a + 18, 'atlas', 'atlas', 8, 'spin');
  hide('atlas', a + 19, a + 21);
  show('hier', a + 19.5, a + 21.5);
  ramp('hier_grow', a + 21, a + 29, 0, 1);
  // (the tissue type shared most widely lights up with its line)
  const wideN = F.wide ? hierIdx(F.wide.name, 2) : -1;
  if (wideN >= 0) { jump('hier_focus', a + 30, -1, wideN); jump('hier_focus', b - 0.5, wideN, -1); }
  cam(a + 20.5, 'hier', 'net', -15);
  cam(b - 0.5, 'hier', 'net', 25, 'spin');
  // Age: the volcano; then the three examples in turn (the ovary, the gut on the slide, the pituitary)
  a = C.age.a; b = C.age.b;
  hide('hier', a, a + 2);
  show('atlas', a + 0.5, a + 2.5, a + 24, a + 26);
  ramp('atlas_volcano', a + 2, a + 8, 0, 1);
  cam(a + 2, 'atlas', 'volcano', -8);
  cam(a + 13, 'atlas', 'volcano', 6, 'spin');
  ramp('atlas_volcano', a + 14, a + 16, 1, 0);
  if (exI[0]) jump('atlas_focus', a + 14, 0, exI[0]);
  ramp('atlas_age', a + 17, a + 23, 0, 1);
  cam(a + 15.5, 'atlas', 'focus');
  cam(a + 23.5, 'atlas', 'focus', 8, 'spin');
  // (the gut's submucosa on the section: its share falls as the age goes from 20 to 70)
  jump('slide_tiles', a, 1, 0); jump('slide_adj', a, 1, 0); jump('slide_feat', a, 1, 0); jump('slide_group', a, 2, 0);
  show('slide', a + 24.5, a + 26.5, a + 34, a + 36);
  jump('slide_focus', a + 24, 0, sd('submucosa'));
  ramp('slide_age', a + 27, a + 33, 0, 1);
  cam(a + 25, 'slide', 'age', -6);
  cam(a + 33.5, 'slide', 'age', 6, 'spin');
  show('atlas', a + 34, a + 36);
  if (exI[0] || exI[2]) jump('atlas_focus', a + 30, exI[0], exI[2]);
  jump('atlas_age', a + 30, 1, 0);
  ramp('atlas_age', a + 37, a + 42, 0, 1);
  cam(a + 35, 'atlas', 'focus', -6);
  cam(b - 0.5, 'atlas', 'focus', 8, 'spin');
  // Disease: the trajectories over age
  a = C.pathology.a; b = C.pathology.b;
  ramp('atlas_curves', a + 1.5, a + 7, 0, 1);
  jump('atlas_focus', a + 2.6, exI[2], 0); jump('atlas_age', a + 2.6, 1, 0);
  cam(a + 2, 'atlas', 'curves', -6);
  cam(b - 0.5, 'atlas', 'curves', 8, 'spin');
  // Neighbours: the colon's domain contacts, then the coronary artery's, each from age 20 to 70
  a = C.contacts.a; b = C.contacts.b;
  hide('atlas', a, a + 2);
  jump('hier_contacts', a, 0, 1);
  jump('hier_organ', a, 0, contactIdx(/colon/i));
  show('hier', a + 0.5, a + 2.5);
  ramp('hier_age', a + 7, a + 14, 0, 1);
  // (the switch to the artery behind a short fade)
  ramp('hier_a', a + 15.5, a + 16.8, 1, 0); ramp('hier_a', a + 17.2, a + 18.6, 0, 1);
  jump('hier_organ', a + 17, contactIdx(/colon/i), contactIdx(/coronary|arter/i));
  jump('hier_age', a + 17, 1, 0);
  ramp('hier_age', a + 19, a + 26, 0, 1);
  cam(a + 2, 'hier', 'contacts', -10);
  cam(a + 16, 'hier', 'contacts', 6, 'spin');
  cam(a + 18, 'hier', 'contacts', -6);
  cam(b - 0.5, 'hier', 'contacts', 8, 'spin');
  // Tissue and time: the body and its organs again
  a = C.next.a; b = C.next.b;
  hide('hier', a, a + 2);
  show('body', a + 0.5, a + 2.5);
  jump('dots_pick', a, stomach, 0);
  cam(a + 1, 'body', 'front', -16);
  cam(b, 'body', 'front', 10, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  const at = (k, n) => () => anchorOf(k, n);
  const dotAt = name => (MD.organ(name) || { pos: [0, 0, 0] }).pos;
  a = C.title.a;
  label('body', dotAt('Brain'), `<b>${F.organs} organs</b>`, a + 7, C.slide.a - 3, 'mag');
  label('body', st, '<b>Stomach</b>', C.slide.a - 2.5, C.slide.a + 1.6, 'mag');
  a = C.slide.a;
  label('tissue', at('tissue', 'mucosa'), '<b>Nuclei</b>purple-blue: haematoxylin', a + 7, a + 13, 'amb');
  label('tissue', at('tissue', 'submucosa'), '<b>Fibres</b>pink: eosin', a + 8, a + 13, 'amb');
  label('tissue', at('tissue', 'vessel'), '<b>A blood vessel</b>', a + 9.5, a + 13, 'amb');
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor, FIT's target shift]; 'spin' segments turn at
// a steady pace.
// When the story hands over from one set to another, the new set is turned about its
// vertical axis so that its first view starts where the camera already is: a crossfade
// never swings the camera round. The set keeps that turn while it is on show (setYaw).
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  const turn = (w, deg) => {
    const r = deg * D2R, x = w[4], z = w[6], f = w[10], fx = f[0], fz = f[2];
    w[1] += deg; w[4] = x * Math.cos(r) + z * Math.sin(r); w[6] = -x * Math.sin(r) + z * Math.cos(r);
    f[0] = fx * Math.cos(r) + fz * Math.sin(r); f[2] = -fx * Math.sin(r) + fz * Math.cos(r);   // (the shift turns with it)
  };
  ST.yaw = [];
  let cur = null, prevAz = null;
  for (const w of wp) {
    if (!cur || w[8] !== cur.k) {
      const d = prevAz === null ? 0 : ((prevAz - w[1]) % 360 + 540) % 360 - 180;
      cur = { k: w[8], t0: w[0], c: Math.abs(d) > 40 ? d : 0 };
      ST.yaw.push(cur);
    }
    turn(w, cur.c);
    prevAz = w[1];
  }
  // keep turning the short way round between views
  let prev = null;
  ST.wp = wp.map(w => {
    let az = w[1];
    if (prev !== null) az += 360 * Math.round((prev - az) / 360);
    prev = az;
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, w[10]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (the tissue and the slide share one turn: one frame)
function setYaw(k, t) {
  let c = 0;
  const f = frameOf(k);
  for (const y of ST.yaw) if (y.k === f && y.t0 - 6 <= t) c = y.c;
  return c;
}
// 0..1 progress over a segment of length D: smoothstep, or for 'spin' segments a steady
// slow turn with short eased starts and stops (trapezoidal speed profile)
const smoothSeg = (t, D) => smooth(t / D);
function spinEase(t, D) {
  const r = Math.min(2.5, D / 3);
  if (t <= 0) return 0;
  if (t >= D) return 1;
  const v = 1 / (D - r); // cruise speed so the ramps plus cruise cover 0..1
  if (t < r) return v * t * t / (2 * r);
  if (t > D - r) return 1 - v * (D - t) * (D - t) / (2 * r);
  return v * (t - r / 2);
}
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, and FIT's target shift x, y, z]
function storyCam(t) {
  const wp = ST.wp, end = w => [w[1], w[2], w[3], w[4], w[5], w[6], w[8], ...w[9]];
  if (t <= wp[0][0]) return end(wp[0]);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1, f = p[9], g = q[9];
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[8] + (q[8] - p[8]) * x,
        f[0] + (g[0] - f[0]) * x, f[1] + (g[1] - f[1]) * x, f[2] + (g[2] - f[2]) * x];
    }
  }
  return end(wp[wp.length - 1]);
}

// ---------------------------------------------------------------- labels --
// Story labels are pinned to a set's anchor for a stretch of story time; each
// set also brings its own labels, shown whenever its params call for them.
const LBL = { story: ST.labels, sets: [], extra: [] };
function labelEl(html, cls) {
  const el = document.createElement('div');
  el.className = 'lbl ' + (cls || '');
  el.innerHTML = html;
  el.style.opacity = 0;
  $('#labels').appendChild(el);
  return el;
}
function label(set, at, html, tIn, tOut, cls) {
  if (typeof at === 'string' && (GL.sets[set].labels || []).some(L => L.at === at)) return; // the set labels this point itself
  ST.labels.push({ kind: 'story', el: labelEl(html, cls), set, at, tIn, tOut, o: -1 });
}
// a label's rest after its bold part; a long one (more than a mark such as ' · hub' or ' · 1.2×') gives way on narrow
// screens (placeLabels)
const sfxSpan = r => (!r ? '' : String(r).length > 8 ? `<span class="sx">${esc(r)}</span>` : esc(r));
function buildSetLabels() {
  for (const k of SET_ORDER) for (const L of GL.sets[k].labels || []) {
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1 });
  }
}
// a set label shows as far as its set is in and its own rule allows
// (labels a set marks as minor give way on narrow screens)
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  return (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
};
// where a label points, in the world's own coordinates
const _v = new THREE.Vector3();
function labelPos(L, out) {
  const p = anchorOf(L.set, L.at);
  return out.set(p[0], p[1], p[2]).applyMatrix4(GL.sets[L.set].group.matrix);
}
// labels on screen: pinned next to their point, nudged down where they would overlap, and
// kept clear of the side panel, the timeline and the edge of the screen
const _placed = [];
function placeLabels(list, alphaOf) {
  _placed.length = 0;
  const vis = [], W = window.innerWidth, H = window.innerHeight;
  const pr = $('#panel').getBoundingClientRect(), barTop = $('#bar').getBoundingClientRect().top || H;
  for (const L of list) {
    let o = Math.round(alphaOf(L) * 100) / 100, x = 0, y = 0;
    if (o > 0) {
      labelPos(L, _v).applyMatrix4(GL.world.matrixWorld).project(GL.camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) o = 0;
    }
    if (o > 0) {
      // (on a narrow screen a label's long rest is left out: the panel says it, and the scene there is small)
      if (L.nar !== !GL.wide) { L.nar = !GL.wide; const sx = L.el.querySelector('.sx'); if (sx) sx.style.display = L.nar ? 'none' : ''; L.w = 0; }
      if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
      const sx = (_v.x * 0.5 + 0.5) * W;
      x = sx + 9; y = (-_v.y * 0.5 + 0.5) * H - 11;
      if (pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) {
        // a point just beside the panel keeps its label next to the panel; one behind it shows none
        if (GL.wide && sx > pr.right - 40) x = pr.right + 6; else o = 0;
      }
      if (y + L.h > barTop - 4 || y < 50) o = 0;
      x = Math.max(6, Math.min(x, W - L.w - 6));
    }
    if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
    if (o <= 0) continue;
    vis.push([L, x, y]);
  }
  vis.sort((p, q) => p[2] - q[2]);
  for (const [L, x, y0] of vis) {
    let y = y0;
    for (let pass = 0; pass < 6; pass++) {
      const hit = _placed.find(r => x < r[0] + r[2] && r[0] < x + L.w && y < r[1] + r[3] && r[1] < y + L.h);
      if (!hit) break;
      y = hit[1] + hit[3] + 2;
    }
    _placed.push([x, y, L.w, L.h]);
    L.el.style.transform = `translate(${x.toFixed(1)}px, ${y.toFixed(1)}px)`;
  }
}

// ------------------------------------------------------------ panel update --
let curCh = null;
function updateStoryDOM(t) {
  const c = CH.find(c => t >= c.a && t < c.b) || CH[CH.length - 1];
  if (c !== curCh) {
    ST.items.forEach(it => it.sec.classList.toggle('on', it.ch === c));
    curCh = c;
    $('#panel').scrollTop = 0;
  }
  const it = ST.items.find(x => x.ch === c);
  let fresh = null;
  for (const e of it.els) {
    const o = Math.round(fadeVal(t, e.at, e.out, 0.6) * 100) / 100;
    if (o !== e.o) {
      if (e.o <= 0 && o > 0 && !e.el.classList.contains('credits')) fresh = e.el;
      e.el.style.opacity = o; e.o = o; e.el.style.visibility = o > 0 ? 'visible' : 'hidden';
    }
  }
  // on a short (phone) panel, scroll just far enough that a line that has just appeared is not below the fold
  if (fresh) {
    const p = $('#panel'), pr = p.getBoundingClientRect(), over = fresh.getBoundingClientRect().bottom - (pr.bottom - parseFloat(getComputedStyle(p).paddingBottom));
    if (over > 0) {
      // (a chapter's heading is shown whole or scrolled out of sight, never cut in half)
      const h = it.sec.querySelector('h1, h2'), hr = h && h.getBoundingClientRect(), edge = pr.top + p.clientTop + over;
      p.scrollTo({ top: p.scrollTop + over + (hr && hr.top < edge && hr.bottom > edge ? hr.bottom - edge + 4 : 0), behavior: 'smooth' });
    }
  }
  if (c.key === 'title') {
    const arc = $('#titleArc');
    if (arc) { arc.setAttribute('stroke-dashoffset', (1 - smooth((t - 0.5) / 2.2)).toFixed(3)); $('#titleDot').setAttribute('opacity', smooth((t - 2.5) / 0.4)); }
  }
}

// ------------------------------------------------------------- timeline UI --
function buildTimeline() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div>' + CH.slice(1).map(c =>
    `<div class="tick" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%"></div><div class="name" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%">${c.name}</div>`).join('') + '<div class="knob"></div>';
  tr.setAttribute('aria-valuemax', Math.round(T_END));
  const seekAt = ev => {
    const r = tr.getBoundingClientRect();
    APP.seek(clamp((ev.clientX - r.left) / r.width, 0, 1) * T_END);
  };
  let drag = false;
  tr.addEventListener('pointerdown', ev => { drag = true; tr.setPointerCapture(ev.pointerId); seekAt(ev); });
  tr.addEventListener('pointermove', ev => { if (drag) seekAt(ev); });
  tr.addEventListener('pointerup', () => { drag = false; });
  tr.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowRight') { APP.seek(APP.t + 5); ev.preventDefault(); }
    if (ev.key === 'ArrowLeft') { APP.seek(APP.t - 5); ev.preventDefault(); }
  });
  $('#play').addEventListener('click', () => APP.togglePlay());
  // slideshow: Next and this story's switch, in the shell's row at the foot of the panel (an older shell has none)
  if ($('#slides')) { $('#btnNext').addEventListener('click', slideNext); $('#btnSlides').addEventListener('click', slideToggle); }
  if ($('#btnNextBar')) $('#btnNextBar').addEventListener('click', slideNext);   // Next beside Play (phones)
}
const ICON_PLAY = '<svg viewBox="0 0 16 16"><path d="M4 2.5v11l9-5.5z"/></svg>';
const ICON_PAUSE = '<svg viewBox="0 0 16 16"><path d="M3.5 2.5h3v11h-3zM9.5 2.5h3v11h-3z"/></svg>';
let lastTick = -1;
function updateTimeline(t, playing) {
  const p = (100 * t / T_END).toFixed(2);
  if (p !== lastTick) {
    $('#track .done').style.width = p + '%';
    $('#track .knob').style.left = p + '%';
    $('#track').setAttribute('aria-valuenow', Math.round(t));
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    $('#clock').textContent = m(t) + ' / ' + m(T_END);
    const c = CH.find(c => t >= c.na && t < c.nb) || CH[CH.length - 1];
    document.querySelectorAll('#track .name').forEach(n => n.classList.toggle('cur', n.dataset.k === c.key));
    lastTick = p;
  }
  const want = playing ? 'pause' : 'play';
  const btn = $('#play');
  if (btn.dataset.s !== want) { btn.innerHTML = playing ? ICON_PAUSE : ICON_PLAY; btn.dataset.s = want; btn.setAttribute('aria-label', playing ? 'Pause' : 'Play'); }
  slideDOM();
}

// ================================================================ EXPLORE ==
// Explore mode: the organs and their tissues, the domains and their tissue types, what changes with age, the method in
// four steps; or any scene with its own controls.
const SCENES = [
  ['body', 'Body', `The ${FACTS.organs} organs whose tissue GTEx collected, as points of light on a body drawn from a PET scan (the tour's body).`],
  ['slide', 'Section', 'One H&E-stained section of stomach wall (the tour\'s tissue, drawn), with the method\'s tiles, features and neighbours, and its domains at 20 and at 70.'],
  ['atlas', 'Library and atlas', `The slide library (${fmt(FACTS.slides)} slides), a section per tissue with its domains, the tiles in one map, what changes with age and the pathology curves.`],
  ['hier', 'Network', 'Iva Buljan\'s network of organ architecture: organs, tissues, tissue types and domains; and one organ\'s domain contacts at 20 and at 70.'],
];
const SCENE_SHORT = { atlas: 'Atlas' };
const TABS = [['organs', 'Organs'], ['domains', 'Domains'], ['age', 'Age'], ['method', 'Method'], ['scenes', 'Scenes']];
// the tour's body set: its network and its disease scan are the tour's illustration, so this story leaves them out;
// the sets' own Age controls give way to the story's age slider (X.age), which drives them all
const HIDE_CTL = { body: ['view', 'state', 'tracer'] };
const isAge = c => /^age$/i.test(c.key) || /^age$/i.test(c.label || '');
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !(HIDE_CTL[k] || []).includes(c.key) && !isAge(c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries((GL.sets[k].controls || []).map(x => [x.key, isAge(x) ? ageOpt(x) : ctlValue(k, x)])));
const AGE0 = FACTS.ages[0], AGE1 = FACTS.ages[1];
const X = { tab: 'organs', scene: 'atlas', ctl: {}, t0: 0, turn: 'on', organ: null, domain: null, age: AGE0, step: 1, kind: null };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['slide_focus', 'atlas_focus', 'hier_focus', 'hier_organ', 'dots_pick']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a control's option whose key or name matches re (the sets name their own options)
const optKey = (k, key, re) => { const c = ctlOf(k, key), o = c && c.options.find(([v, n]) => re.test(v) || re.test(n)); return o ? o[0] : null; };
// the age slider as a set's own Age option (the one nearest X.age)
const ageOpt = c => { let b = c.options[0][0], bd = Infinity; for (const [v, n] of c.options) { const a = parseFloat(n) || parseFloat(v), d = Math.abs(a - X.age); if (d < bd) { bd = d; b = v; } } return b; };
const ageF = () => clamp((X.age - AGE0) / (AGE1 - AGE0), 0, 1);
// a view option's camera: the cam view of the same name, or the one its name stands for
const CAM_ALIAS = { atlas: { tiles: 'umap', age: 'volcano', pathology: 'curves', section: 'focus' }, slide: { section: 'default', features: 'matrix', neighbours: 'close', groups: 'group', age: 'domains' },
  hier: { network: 'net' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {}, vc = ctlOf(k, 'view'), o = vc && vc.options.find(x => x[0] === v), n = o ? String(o[1]).toLowerCase() : '';
  // the atlas with a section brought forward: the section alone, or beside the volcano or the curves
  if (k === 'atlas' && X.organ && atlasIdx(X.organ)) { if (VIEW.map.test(v) && c.focus) return 'focus'; if ((VIEW.volcano.test(v) || VIEW.curves.test(v)) && c.age) return 'age'; }
  // (the atlas's age camera is for the volcano beside a section; the volcano alone has its own)
  if (k === 'atlas' && v === 'age' && c.volcano) return 'volcano';
  for (const x of [v, al[v], n, al[n]]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set, by its key or its name
const viewIs = (k, re) => { const c = ctlOf(k, 'view'); if (!c) return false; const v = ctlValue(k, c), o = c.options.find(x => x[0] === v); return re.test(v) || !!(o && re.test(o[1])); };
// the views the panes ask for, by what they show
const VIEW = { lib: /lib/i, map: /^atlas$/i, umap: /tile|umap/i, volcano: /volcano|^age$/i, curves: /patho|curve/i, net: /net/i, contacts: /contact/i,
  section: /section/i, sAge: /^age$/i };
// the method's four steps and the slide's views that show them
const STEPS = [
  ['Tiles', /tile/i, () => `Each slide is cut into small squares: ${FACTS.tilesM} million tiles in all.`],
  ['Features', /feat/i, () => 'A deep-learning vision model describes each tile with a list of numbers, its features.'],
  ['Neighbours', /neigh/i, () => 'Each tile mixes in the features of the tiles around it (message passing), so it knows its surroundings.'],
  ['Domains', /group/i, () => 'Tiles with similar mixed features are grouped, across all slides: in a map of their features, alike tiles gather. A pathologist then names each group: a domain.'],
];
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const afterUpdate = f => { NEXT.push(f); };
// the organ picked (X.organ: an organ's name, or one of its GTEx tissues'), and the worked examples' organs
const organOf = v => (v ? MD.organ(v) || tissueOrgan(v) : null);
const exOrgan = i => { const x = FACTS.ex[i]; return x && atlasIdx(x.tissue) ? (api('atlas').tissues || [])[atlasIdx(x.tissue) - 1] : null; };
// the worked example on show (-1 none): its section in the atlas with the age slider, or the gut's on the slide
const exOn = () => FACTS.ex.findIndex((x, i) => (exOrgan(i) ? X.scene === 'atlas' && X.organ === exOrgan(i) && viewIs('atlas', VIEW.map)
  : X.scene === 'slide' && viewIs('slide', VIEW.sAge) && X.domain === x.domain));

// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  // the slide's tiles and domains lie on the tour's tissue section: wherever the slide shows, the section shows too
  if (k === 'slide') Object.assign(tg, GL.sets.tissue.params, { tissue_a: 1 });
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = isAge(ct) ? ageOpt(ct) : ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const ag = ageF(), O = organOf(X.organ);
  tg.dots = 0; tg.dots_pick = 0;
  if (k === 'body') { tg.body_net = 0; tg.body_state = 0; tg.dots = 1; tg.dots_pick = O ? O.i + 1 : 0; }   // never the tour's own network or disease scan
  if (k === 'slide') { if (viewIs('slide', /age|domain/i)) tg.slide_age = ag; tg.slide_focus = X.domain ? slideIdx(X.domain) : 0; }
  if (k === 'atlas') { tg.atlas_focus = X.organ ? atlasIdx(X.organ) : 0; tg.atlas_age = ag; }
  if (k === 'hier') {
    const d = X.domain ? hierIdx(X.domain, 3) : -1, t = O && X.organ !== O.name ? hierIdx(X.organ, 1) : -1;
    tg.hier_focus = d >= 0 ? d : t >= 0 ? t : O ? hierIdx(O.name, 0) : X.kind ? hierIdx(X.kind, 2) : -1;
    tg.hier_age = ag;
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (k === 'tissue') k = 'slide';   // (the section is shown with the slide)
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) flyTo(view(k, viewCam(k) || 'default'));
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view of one of the method's steps is that step
  if (k === 'slide' && key === 'view') { const i = STEPS.findIndex(s => viewIs('slide', s[1])); if (i >= 0) X.step = i + 1; }
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// a view of a set by what it shows (VIEW), its scene brought up
function showView(k, re) { if (X.scene !== k) openScene(k); const v = optKey(k, 'view', re); if (v && ctlValue(k, ctlOf(k, 'view')) !== v) setCtl(k, 'view', v); }
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now(); orbit.fast = false;
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / ((orbit.fast ? 0.25 : orbit.dur) * 1000)), f = orbit.from, t = orbit.to;   // fast: a view from the room
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) { orbit.to = null; orbit.fast = false; }
}
// fly to a point of the scene on show, keeping the direction you look from
function flyNear(p, d) { if (p) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// --------------------------------------------------------------- actions --
// Each setter changes its own field only when called with ui false (a shared room's state arriving); picked by
// hand (ui true) it also brings up the scene and the view that show it.
// an organ, or one of its tissues (null none): its section comes forward in the atlas, it lights up in the network
// and in the body
function selectOrgan(v, ui = true) {
  const O = organOf(v);
  X.organ = O ? (MD.organ(v) ? O.name : (O.tissues.find(t => t.toLowerCase() === String(v).toLowerCase()) || O.name)) : null;
  if (X.organ) X.domain = null;
  if (ui && X.organ) {
    if (X.scene === 'body') afterUpdate(() => { if (X.organ && organOf(X.organ) === O) flyNear(O.pos, Math.min(orbit.cur[2], 1.6)); });
    else if (X.scene !== 'hier' || !viewIs('hier', VIEW.net)) { if (atlasIdx(X.organ)) { if (!(X.scene === 'atlas' && (viewIs('atlas', VIEW.volcano) || viewIs('atlas', VIEW.curves)))) showView('atlas', VIEW.map); flyTo(view('atlas', viewCam('atlas') || 'focus')); } }
  }
  if (ui && !X.organ && X.scene === 'atlas') flyTo(view('atlas', viewCam('atlas') || 'default'));   // (back from the section)
  pushState(); renderAll();
}
// a domain of the network (null none): it lights up in the network, and on the section if it is one of its domains
function selectDomain(v, ui = true) {
  const d = v ? MD.domain(v) : -1;
  X.domain = d >= 0 ? nodeName(d) : null;
  if (X.domain) { X.organ = null; X.kind = nodeName(MD.typeOfDomain(d)) || X.kind; }
  if (ui && X.domain && !(X.scene === 'slide' && slideIdx(X.domain))) showView('hier', VIEW.net);
  pushState(); renderAll();
}
// a tissue type: the Domains panes list its domains (this device's own choice, not shared)
function pickKind(v) { X.kind = MD.type(v) >= 0 ? nodeName(MD.type(v)) : null; renderAll(); }
// the age (20 to 70): the sections, the domains on the slide and the contacts follow it
function setAge(v, ui = false) {
  X.age = Math.round(clamp(+v, AGE0, AGE1));
  // (moved by hand where nothing shows the age: the gut's example on the slide)
  if (ui && !(X.scene === 'slide' && viewIs('slide', /age|domain/i)) && !(X.scene === 'atlas' && X.organ && viewIs('atlas', VIEW.map)) && !(X.scene === 'hier' && viewIs('hier', VIEW.contacts))) showExample(FACTS.ex.findIndex((x, i) => !exOrgan(i)), false);
  syncAge();
}
// one of the method's four steps (1 to 4): the section with that step's view
function setStep(n, ui = true) {
  X.step = clamp(n | 0, 1, STEPS.length);
  if (ui) showView('slide', STEPS[X.step - 1][1]);
  renderAll();
}
// a worked example of change with age: its section in the atlas (or on the slide), at 70 unless asked otherwise
function showExample(i, to70 = true) {
  const x = FACTS.ex[i];
  if (!x) return;
  if (exOrgan(i)) { X.domain = null; X.organ = exOrgan(i); showView('atlas', VIEW.map); flyTo(view('atlas', viewCam('atlas') || 'focus')); }
  else { X.organ = null; const d = MD.domain(x.domain); X.domain = d >= 0 ? nodeName(d) : null; showView('slide', VIEW.sAge); }
  if (to70) X.age = AGE1;
  pushState(); renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls, the organ (or
// tissue), the domain, the age and the method's step. The tissue type listed in the Domains panes, the search and the
// camera are each person's own.
// shared rooms: the scene's view in a headset at a station (explore mode), which turns and sizes it in the room:
// shared (HOST.collab), so everyone there sees it alike; null while it flies somewhere (a pick, a view arriving)
function collabView() {
  if (APP.mode !== 'explore' || orbit.to) return null;
  const c = orbit.cur, r = (x, k) => Math.round(x * k) / k;
  return [r((((c[0] + 180) % 360) + 360) % 360 - 180, 10), r(c[1], 10), r(c[2], 100), r(c[3], 100), r(c[4], 100), r(c[5], 100)];
}
function collabSetView(v) {
  if (APP.mode !== 'explore' || !Array.isArray(v) || v.length !== 6 || !v.every(Number.isFinite)) return;
  const c = orbit.cur, to = v.slice();
  to[0] += 360 * Math.round((c[0] - to[0]) / 360);
  Object.assign(orbit, { from: c.slice(), to, t0: performance.now(), fast: true });   // a short glide there
}
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, organ: X.organ, domain: X.domain, age: X.age, step: X.step };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and
// the camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  // the scene and its controls; a view flies to its own camera as it does here
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  // then the picks (after the views, which may set the step: the room's step wins)
  if ((v.organ === null || (typeof v.organ === 'string' && organOf(v.organ))) && v.organ !== X.organ) selectOrgan(v.organ, false);
  if ((v.domain === null || (typeof v.domain === 'string' && MD.domain(v.domain) >= 0)) && v.domain !== X.domain) selectDomain(v.domain, false);
  if (Number.isInteger(v.age) && v.age >= AGE0 && v.age <= AGE1 && v.age !== X.age) setAge(v.age);
  if (Number.isInteger(v.step) && v.step >= 1 && v.step <= STEPS.length && v.step !== X.step) setStep(v.step, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
// each organ's small 3D model (ORGAN3D, sets/organs.js) as a picture for the panes: drawn once at 64 px, shown at 20 to
// 30. The models and pictures build between frames from the start (updateSets), the ones a pane asks for first; until
// an organ's picture is drawn its chip keeps the place with a soft dot, and the picture goes in as it comes
// (fillOrganPics), so nothing is drawn again all at once
const orgPic = o => (o && ORGAN3D.idOf(o.name)) || null;
const ORG_DOT = 'radial-gradient(circle,rgba(255,158,196,.55) 0 22%,rgba(255,158,196,0) 46%)';
const iconImg = (o, px) => {
  const id = orgPic(o), u = id ? ORGAN3D.picUrl(id) : '', s = px || 22;
  return id ? `<span class="o3"${u ? '' : ` data-org="${id}"`} aria-hidden="true" style="display:inline-block;width:${s}px;height:${s}px;vertical-align:-6px;margin-right:5px;background:${u ? `url(${u})` : ORG_DOT} center/contain no-repeat"></span>` : '';
};
function fillOrganPics() {
  for (const el of document.querySelectorAll('span.o3[data-org]')) {
    const u = ORGAN3D.picUrl(el.dataset.org);
    if (u) { el.style.background = `url(${u}) center/contain no-repeat`; el.removeAttribute('data-org'); }
  }
}
const link = (act, v, text) => `<button type="button" data-act="${act}" data-v="${esc(v)}" style="border:0;background:none;padding:0;font:inherit;color:var(--cyan);text-decoration:underline;cursor:pointer">${text}</button>`;
let DQ = '';   // the Domains pane's search (this page's own)
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v, n = v !== undefined && v !== '' && !isNaN(+v) ? +v : v;
    ({
      organ: () => selectOrgan(organOf(v) && organOf(v) === organOf(X.organ) && MD.organ(v) ? null : v), tis: () => selectOrgan(v),
      domain: () => selectDomain(v === X.domain ? null : v), kind: () => { pickKind(v); if (X.tab !== 'domains') showTab('domains'); },
      ex: () => showExample(n), view: () => { const [k, r] = v.split(':'); showView(k, VIEW[r]); }, step: () => setStep(n),
      scene: () => openScene(v), ctl: () => setCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
    }[b.dataset.act] || (() => {}))();
  });
  // the age slider and the domains' search change in place, so a drag or typing is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const el = ev.target;
    if (el.dataset.age !== undefined) setAge(+el.value, true);
    else if (el.id === 'domq') { DQ = el.value; filterDomains(); }
  });
  renderAll();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => {
    const b = ev.target.closest('[data-v]'), seg = b && b.closest('[data-ctl]');
    if (seg && seg.dataset.ctl === 'turn') setTurn(b.dataset.v);
  });
  showTab(X.tab);
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  // (five tabs overflow a phone's panel: the row scrolls so the chosen one shows)
  const tb = $('#explore .tabs'), on = tb && tb.querySelector(`[data-tab="${k}"]`);
  if (on) { const r = on.getBoundingClientRect(), q = tb.getBoundingClientRect(); if (r.width && (r.left < q.left || r.right > q.right)) tb.scrollLeft += r.left - q.left - 8; }
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  updateExtraLabels();
}
// a tab picked by hand brings up the scene it talks about (a shared room's tab arriving does not: its scene comes with it)
function pickTab(k) {
  showTab(k);
  if (k === 'organs' && X.scene === 'slide') { if (X.organ && atlasIdx(X.organ)) showView('atlas', VIEW.map); else openScene('body'); }
  if (k === 'domains' && X.scene !== 'hier' && !(X.scene === 'slide' && X.domain && slideIdx(X.domain))) showView('hier', VIEW.net);
  if (k === 'age' && !(exOn() >= 0 || (X.scene === 'atlas' && (viewIs('atlas', VIEW.volcano) || viewIs('atlas', VIEW.curves))) || (X.scene === 'hier' && viewIs('hier', VIEW.contacts)))) showView('atlas', VIEW.volcano);
  if (k === 'method') setStep(X.step);
}
function renderAll() { renderOrgans(); renderDomains(); renderAge(); renderMethod(); renderScenes(); updateExtraLabels(); }
function renderOrgans() {
  const pane = $('#pane-organs');
  if (!pane) return;
  const O = organOf(X.organ);
  let h = `<p class="sub">The ${FACTS.organs} organs whose tissue GTEx collected. Pick one: its section, its tissues and its place in the network.</p>
    <div class="chips">${MD.organs.map(o => chip(`data-act="organ" data-v="${esc(o.name)}"`, iconImg(o) + esc(o.name), O === o)).join('')}</div>`;
  if (O) {
    const tis = O.tissues.length ? O.tissues : [O.name], fd = figDomains(X.organ !== O.name ? X.organ : tis[0]);
    h += `<h3>${iconImg(O, 26)}${esc(O.name)}</h3>
      <p class="grp-h">${tis.length > 1 ? `Its ${word(tis.length)} tissues in GTEx: pick one to see its section` : 'One tissue in GTEx'}</p>
      <div class="chips">${tis.map(t => chip(`data-act="tis" data-v="${esc(t)}"`, esc(tisShort(t, O.name)), X.organ === t || (tis.length > 1 && X.organ === O.name && t === tis[0]), LEVEL_COL[1])).join('')}</div>
      <p class="grp-h">Its tissue types in the network</p>
      <div class="chips">${O.types.map(t => chip(`data-act="kind" data-v="${esc(nodeName(t))}"`, `${esc(cap(nodeName(t)))} <small>${MD.typeDomains(t).length}</small>`, false, LEVEL_COL[2])).join('')}</div>
      <p class="sub">The number is how many domains hang on that tissue type in the network (shared with other organs). Pick a type to see them.</p>
      ${fd.length ? `<p class="grp-h">Domains of ${esc(tisShort(X.organ !== O.name ? X.organ : tis[0], O.name))} in the talk's atlas (approximate share, read off the talk's figure)</p><div class="chips">${fd.map(d => (MD.domain(d.name) >= 0 ? chip(`data-act="domain" data-v="${esc(nodeName(MD.domain(d.name)))}"`, `${esc(cap(d.name))} <small>${shareTxt(d.share)}</small>`, false, domCol(d.name))
        : `<span class="empty" style="display:inline-flex;align-items:center;padding:6px 8px"><span class="sw" style="background:${swCol(domCol(d.name))};margin-right:6px"></span>${esc(cap(d.name))}&nbsp;<small>${shareTxt(d.share)}</small></span>`)).join('')}</div>` : ''}
      <p class="grp-h">Show it</p><div class="chips">${chip('data-act="view" data-v="atlas:map"', 'Its section', X.scene === 'atlas' && viewIs('atlas', VIEW.map))}${chip('data-act="view" data-v="hier:net"', 'In the network', X.scene === 'hier' && viewIs('hier', VIEW.net))}${chip('data-act="scene" data-v="body"', 'In the body', X.scene === 'body')}</div>`;
  } else h += '<p class="empty">Point at an organ\'s light in the body, a section in the atlas or a node of the network to pick it there.</p>';
  pane.innerHTML = h;
}
function renderDomains() {
  const pane = $('#pane-domains');
  if (!pane) return;
  const d = X.domain ? MD.domain(X.domain) : -1, t = d >= 0 ? MD.typeOfDomain(d) : -1;
  let h = `<p class="sub">The network's ${MD.domains.length} domains (as named in this map), by the tissue type they belong to. Pick one, or search.</p>`;
  if (d >= 0) {
    const org = t >= 0 ? MD.typeOrgans(t) : [], si = slideIdx(X.domain);
    h += `<h3><span class="sw" style="display:inline-block;width:14px;height:14px;border-radius:3px;background:${domCol(X.domain)};margin-right:8px"></span>${esc(cap(X.domain))}</h3>
      <dl class="stats"><dt>Tissue type</dt><dd style="font-size:16px">${t >= 0 ? link('kind', nodeName(t), esc(cap(nodeName(t)))) : '–'}</dd>
      <dt>Organs with it</dt><dd>${org.length}<small>organs have ${t >= 0 ? esc(nodeName(t)) : 'its tissue type'}; the network does not say which of them have this domain</small></dd></dl>
      <div class="chips">${org.map(o => chip(`data-act="organ" data-v="${esc(o.name)}"`, iconImg(o) + esc(o.name), false)).join('')}</div>
      <p class="grp-h">Show it</p><div class="chips">${chip('data-act="view" data-v="hier:net"', 'In the network', X.scene === 'hier')}${si ? chip('data-act="view" data-v="slide:sAge"', 'On the section', X.scene === 'slide') : ''}</div>`;
  }
  h += `<input type="search" id="domq" placeholder="Search the domains" aria-label="Search the domains" value="${esc(DQ)}" style="width:100%;margin:12px 0 4px;padding:8px 10px;border-radius:8px;border:1px solid var(--line);background:transparent;color:var(--ink);font:inherit">
    <div id="domList">${MD.types.filter(x => MD.typeDomains(x).length).map(x => `<div data-grp><p class="grp-h"${X.kind === nodeName(x) ? ' style="color:var(--ink)"' : ''}><span class="sw" style="display:inline-block;width:10px;height:10px;border-radius:2px;background:${LEVEL_COL[2]};margin-right:6px"></span>${esc(cap(nodeName(x)))}</p>
      <div class="chips">${MD.typeDomains(x).map(y => chip(`data-act="domain" data-v="${esc(nodeName(y))}" data-name="${esc(nodeName(y).toLowerCase())}"`, esc(cap(nodeName(y))), y === d, domCol(nodeName(y)))).join('')}</div></div>`).join('')}</div>
    <p class="note">Domain colours are the same in every scene. Point at a domain on the section or a node of the network to pick it there.</p>`;
  pane.innerHTML = h;
  filterDomains();
}
// the search: domains whose name holds it (and the groups that still hold any)
function filterDomains() {
  const q = DQ.trim().toLowerCase();
  document.querySelectorAll('#domList [data-grp]').forEach(g => {
    let any = false;
    g.querySelectorAll('[data-name]').forEach(b => { const on = !q || b.dataset.name.includes(q); b.style.display = on ? '' : 'none'; any = any || on; });
    g.style.display = any ? '' : 'none';
  });
}
function renderAge() {
  const pane = $('#pane-age');
  if (!pane) return;
  const F = FACTS, e = exOn(), exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  pane.innerHTML = `<p class="sub">Age is the strongest of ${F.donorVars} things known about the donors. ${pct(F.ageChange)} of domains change with it, mostly by less than ${pct(F.mostUnder)} per decade. Pick an example, or move the age.</p>
    <p class="grp-h">Worked examples</p><div class="chips">${F.ex.map((x, i) => chip(`data-act="ex" data-v="${i}"`, esc(exName(x)), e === i, exCol[i])).join('')}</div>
    ${e >= 0 ? `<p class="sub">${esc(cap(exText(F.ex[e])))}.</p>` : ''}
    <p class="grp-h">Age <b data-agev style="margin-left:auto;color:var(--ink)">${X.age}</b></p><input type="range" data-age min="${AGE0}" max="${AGE1}" step="1" value="${X.age}" aria-label="Age" style="accent-color:#ffb43b">
    <p class="grp-h">Across the body</p><div class="chips">${chip('data-act="view" data-v="atlas:volcano"', 'What changes', X.scene === 'atlas' && viewIs('atlas', VIEW.volcano))}${chip('data-act="view" data-v="atlas:curves"', 'Pathology', X.scene === 'atlas' && viewIs('atlas', VIEW.curves))}${chip('data-act="view" data-v="hier:contacts"', 'Contacts', X.scene === 'hier' && viewIs('hier', VIEW.contacts))}</div>
    <p class="note">${esc(F.connective)} ${esc(F.most)}${F.plaque ? ` ${esc(cap(F.plaque.kind))} ${esc(inOrgan(F.plaque.organ))} ${esc(F.plaque.note)}` : ''}${F.infarct ? `; ${esc(F.infarct.kind)} ${esc(inOrgan(F.infarct.organ))} ${esc(F.infarct.note)}` : ''}.</p>`;
}
// the age's readouts and slider, in place (a drag is not cut short)
function syncAge() {
  document.querySelectorAll('[data-agev]').forEach(el => { el.textContent = X.age; });
  document.querySelectorAll('input[data-age]').forEach(el => { if (document.activeElement !== el) el.value = X.age; });
}
function renderMethod() {
  const pane = $('#pane-method');
  if (!pane) return;
  const F = FACTS, s = STEPS[X.step - 1];
  pane.innerHTML = `<p class="sub">How ${esc(F.method)} finds domains in ${fmt(F.slides)} slides without being told what to look for, in four steps.</p>
    <div class="chips">${STEPS.map(([n], i) => chip(`data-act="step" data-v="${i + 1}"`, `${i + 1} · ${n}`, X.step === i + 1 && X.scene === 'slide')).join('')}</div>
    <h3>${X.step} · ${s[0]}</h3><p>${esc(s[2]())}</p>
    <div class="actions">${X.step > 1 ? chip(`data-act="step" data-v="${X.step - 1}"`, 'Back', false) : ''}${X.step < STEPS.length ? chip(`data-act="step" data-v="${X.step + 1}"`, 'Next', false) : ''}</div>
    <p class="grp-h">Then</p><div class="chips">${chip('data-act="view" data-v="atlas:umap"', 'The tiles in one map', X.scene === 'atlas' && viewIs('atlas', VIEW.umap))}${chip('data-act="view" data-v="atlas:map"', 'The atlas', X.scene === 'atlas' && viewIs('atlas', VIEW.map))}</div>
    <p class="note">It agrees with pathologists' notes: salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r} (1 would be perfect). The result: ${F.domains} domains of ${F.types} types.</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${ageHere() ? `<p class="grp-h">Age <b data-agev style="margin-left:auto;color:var(--ink)">${X.age}</b></p><input type="range" data-age min="${AGE0}" max="${AGE1}" step="1" value="${X.age}" aria-label="Age" style="accent-color:#ffb43b">` : ''}
    ${X.organ && X.scene !== 'slide' && !contactsOn() ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(X.organ)} (Organs tab).</p>` : X.domain && !contactsOn() ? `<p class="sub" style="margin-top:10px">Also shown: ${esc(cap(X.domain))} (Domains tab).</p>` : ''}`;
}
// a share read off the talk's figure, by eye: under half a percent is shown as <1%
const shareTxt = f => (f * 100 < 0.5 ? '&lt;1%' : Math.round(f * 100) + '%');
// the network's contacts: one organ's own contact network (the hier set's Organ control), not the organ or domain picked
const contactsOn = () => X.scene === 'hier' && viewIs('hier', VIEW.contacts);
// the scene on show changes with the age (the slider belongs with it)
const ageHere = () => (X.scene === 'slide' && viewIs('slide', /age|domain/i)) || (X.scene === 'atlas' && !!X.organ && viewIs('atlas', VIEW.map)) || (X.scene === 'hier' && viewIs('hier', VIEW.contacts));
// labels the panes add (the sets label their own picks: the atlas names its focused section, the network its focused node)
let XL = null;
function updateExtraLabels() {
  const O = organOf(X.organ), sig = [APP.mode, X.scene, X.organ].join('|');
  if (sig === XL) return;
  XL = sig;
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  if (APP.mode !== 'explore') return;
  // the organ picked, at its point in the body
  if (X.scene === 'body' && O) LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(O.name)}</b>`, 'mag'), set: 'body', at: O.pos.slice(), o: -1, txt: [O.name, '', 'mag'] });
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { organ } (an organ or one of its
// tissues), { domain }, { kind } (a tissue type) or { sdom } (a domain of the section not in the network), or null
function pickWith(rc) {
  if (APP.mode !== 'explore') return null;
  const k = X.scene;
  if (k === 'body') { const i = GL.dots.pick(rc); return i >= 0 ? { organ: MD.organs[i].name } : null; }
  const A = api(k);
  if (!A.pick) return null;
  let r = -1;
  try { r = A.pick(rc); } catch (e) { return null; }
  if (!(r >= 0)) return null;
  if (k === 'atlas') { const t = (A.tissues || [])[r]; return t && organOf(t) ? { organ: t } : null; }
  if (k === 'hier') {
    const n = (A.nodes || [])[r];
    if (!n) return null;
    if (n.level === 3) { const d = MD.domain(n.name); return d >= 0 ? { domain: nodeName(d) } : null; }
    if (n.level === 2) return MD.type(n.name) >= 0 ? { kind: nodeName(MD.type(n.name)) } : null;
    return organOf(n.name) ? { organ: n.name } : null;
  }
  if (k === 'slide') { const d = slideDomain(r); return d ? { domain: d } : (A.domains || [])[r] ? { sdom: A.domains[r] } : null; }
  return null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  if (p && p.organ && X.scene === 'body') { const O = organOf(p.organ); return O ? O.pos.slice() : null; }
  return null;
}
const pickText = p => (p.organ ? (MD.organ(p.organ) ? [p.organ, 'organ'] : [tisShort(p.organ, organOf(p.organ).name), `tissue of the ${organOf(p.organ).name.toLowerCase()}`])
  : p.domain ? [cap(p.domain), nodeName(MD.typeOfDomain(MD.domain(p.domain))) || 'domain'] : p.kind ? [cap(p.kind), 'tissue type'] : [cap(p.sdom), 'on this section']);
function choosePick(p) {
  if (!p) return;
  if (p.organ) { if (X.tab !== 'organs') showTab('organs'); selectOrgan(p.organ === X.organ ? null : p.organ, false); }
  else if (p.domain) { if (X.tab !== 'domains') showTab('domains'); selectDomain(p.domain === X.domain ? null : p.domain, false); }
  else if (p.kind) { showTab('domains'); pickKind(p.kind); }
}
function bindCanvas() {
  const cv = GL.canvas, tip = $('#tip'), pts = new Map();
  let down = null, pinch = 0;
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    const explore = APP.mode === 'explore';
    if (pts.has(ev.pointerId) && explore) {
      const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
      pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
      if (pts.size === 2) {
        const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
        if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.05, 40);
        pinch = d; down.moved = true; return;
      }
      if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
      if (down && down.moved) {
        orbit.to = null;
        orbit.cur[0] -= dx * 0.25; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, -80, 80);
      }
      tip.style.opacity = 0;
      return;
    }
    if (!explore || ev.pointerType === 'touch') { tip.style.opacity = 0; return; }
    const p = pickAt(ev.clientX, ev.clientY);
    cv.style.cursor = p && !p.sdom ? 'pointer' : 'grab';
    if (p) {
      const [b, r] = pickText(p);
      tip.innerHTML = `<b>${esc(b)}</b>${esc(r)}`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') choosePick(pickAt(ev.clientX, ev.clientY));
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.05, 40);
  }, { passive: false });
}
// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). Each scene
// floats in front of you as an object: the story's camera moves become
// rotations and scaling of the scene, the side panel is redrawn on a canvas you
// point at, and labels become sprites. Controllers: point and pull the trigger
// to click, drag the scene with the trigger or grip, thumbstick spins and zooms,
// A/X plays and pauses the story. Hand tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' },
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------ scene pose --
// Turn a story/orbit view [az, el, dist, tx, ty, tz] into a pose for the
// floating scene: the side the camera looks from faces you, "up" stays up, the
// target sits in front of you, and closer views make the scene bigger.
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
function xrPlace(v) {
  const d = Math.max(v[2], 0.05);
  _xq.setFromAxisAngle(_xX, clamp(v[1], -85, 85) * D2R).multiply(_xq2.setFromAxisAngle(_xY, -v[0] * D2R));
  XR.R = XR.baseR * clamp(Math.pow(3.6 / d, 0.85), 0.12, 10) * XR.size;   // (times the size your hands or the room gave it)
  XR.hitR = 1.15 * d / 3.6;
  XR.target.set(v[3], v[4], v[5]);
  // a little right of centre and below eye level, leaving room for the panel on the left
  const dc = 1.2, cx = 0.3, cy = -0.2;
  // plus wherever you have moved it with the grip; the story's focus side keeps facing you
  const gx = cx + XR.globeOff.x, gy = cy + XR.globeOff.y, gz = -dc + XR.globeOff.z;
  XR.globeBase.set(cx, cy, -dc);
  _xq2.setFromUnitVectors(_xz, _xa.set(-gx, -gy, -gz).normalize());
  GL.world.quaternion.copy(_xq2).multiply(_xq);
  GL.world.scale.setScalar(XR.R);
  // the target lands on the placement point
  _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(XR.R);
  GL.world.position.set(gx - _xb.x, gy - _xb.y, gz - _xb.z);
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0); XR.size = 1;
  if (XR.panelGroup) { XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.set(0, XR.panelHome.yaw, 0); }
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); XR.size = s.s || 1; if (XR.panelGroup) { XR.panelGroup.position.fromArray(s.pp); XR.panelGroup.rotation.set(0, s.pr, 0); } }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ---------------------------------------------------------------- labels --
const LBL_STYLE = { '': ['#f2f6fc', null], mag: ['#ffd2f4', '#ff5ad9'], amb: ['#ffe2b0', '#ffb43b'],
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tip: ['#e7eef8', '#46d9ff'] };
function labelSprite(L) {
  if (L.sprite) return L.sprite;
  let bold, rest, cls;
  if (L.txt) [bold, rest, cls] = L.txt;
  else {
    const b = L.el.querySelector('b');
    bold = b ? b.textContent : ''; rest = L.el.textContent.slice(bold.length).trim();
    cls = ['mag', 'amb', 'grn', 'cyn'].find(k => L.el.classList.contains(k)) || '';
  }
  const px = 34, H = 56, pad = 16, gap = bold && rest ? 10 : 0;
  const cv = document.createElement('canvas'), ctx = cv.getContext('2d');
  ctx.font = vfont(px, 700); const wb = bold ? ctx.measureText(bold).width : 0;
  ctx.font = vfont(px); const wr = rest ? ctx.measureText(rest).width : 0;
  cv.width = Math.ceil(pad * 2 + wb + gap + wr); cv.height = H;
  const [col, acc] = LBL_STYLE[cls] || LBL_STYLE[''];
  ctx.save(); rr(ctx, 0, 0, cv.width, H, 8); ctx.clip();
  ctx.fillStyle = cls === 'tip' ? 'rgba(10,19,34,0.97)' : 'rgba(3,8,16,0.82)'; ctx.fillRect(0, 0, cv.width, H);
  if (acc) { ctx.fillStyle = acc; ctx.fillRect(0, 0, 5, H); }
  ctx.restore();
  ctx.textBaseline = 'middle'; ctx.fillStyle = col;
  ctx.font = vfont(px, 700); ctx.fillText(bold, pad, H / 2 + 1);
  ctx.font = vfont(px); ctx.fillText(rest, pad + wb + gap, H / 2 + 1);
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = cls === 'tip' ? 11 : 10;
  sp.userData.aspect = cv.width / H;
  sp.center.set(-0.35 / sp.userData.aspect, 0.5);
  GL.world.add(sp);
  return (L.sprite = sp);
}
function dropSprite(L) {
  const sp = L && L.sprite;
  if (!sp) return;
  if (sp.parent) sp.parent.remove(sp);
  sp.material.map.dispose(); sp.material.dispose();
  L.sprite = null;
}
function placeLabelXR(L, alpha, S) {
  if (alpha <= 0.001) { if (L.sprite) L.sprite.visible = false; return; }
  const sp = labelSprite(L), o = alpha;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  labelPos(L, sp.position);
  const hm = 0.021 / XR.R;
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
}
// the organ, tissue or domain a controller points at, labelled where the ray meets it
function xrTip(S) {
  let h = null;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.pk) { h = c.hover; break; }
  const id = h ? JSON.stringify(h.pk) + X.scene : '';
  if (id !== XR.tipI) {
    XR.tipI = id;
    if (XR.tip) dropSprite(XR.tip);
    XR.tip = h ? { set: X.scene, at: [0, 0, 0], txt: [...pickText(h.pk), 'tip'] } : null;
  }
  if (XR.tip) { GL.sets[XR.tip.set].group.worldToLocal(_xp.copy(h.point)); XR.tip.at = [_xp.x, _xp.y, _xp.z]; placeLabelXR(XR.tip, 1, S); }
}

// ---------------------------------------------------- picking an organ --
// The organ, tissue or domain a ray points at in explore mode (see pickWith), or null
const _prc = new THREE.Raycaster();
function pickRay(o, d) {
  if (APP.mode !== 'explore') return null;
  _prc.set(o, d);
  return pickWith(_prc);
}

// ----------------------------------------------------------- controllers --
function xrController(i) {
  const g = GL.renderer.xr.getController(i);
  const c = { i, g, src: null, hover: null, press: null, grab: null, wantPress: false, b4: false, o: new THREE.Vector3(), d: new THREE.Vector3() };
  const geo = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
  c.ray = new THREE.Line(geo, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, opacity: 0.55, depthTest: false, depthWrite: false }));
  c.ray.renderOrder = 60;
  g.add(c.ray);
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.006, 12, 8), new THREE.MeshBasicMaterial({ color: 0x9fe8ff }));
  g.add(tip);
  c.dot = new THREE.Mesh(new THREE.CircleGeometry(1, 24), new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, depthWrite: false }));
  c.dot.renderOrder = 61; c.dot.visible = false;
  GL.scene.add(c.dot);
  g.visible = false;
  g.addEventListener('connected', e => { c.src = e.data; c.ray.visible = e.data.targetRayMode !== 'screen'; });
  g.addEventListener('disconnected', () => { c.src = null; c.press = null; c.grab = null; c.hover = null; c.wantPress = false; c.dot.visible = false; });
  // presses are handled on the next frame, once the ray has its fresh pose
  g.addEventListener('selectstart', () => { c.wantPress = true; });
  g.addEventListener('selectend', () => { if (c.wantPress) { c.wantPress = false; xrPress(c); } xrRelease(c); });
  g.addEventListener('squeezestart', () => xrGrab(c, true));
  g.addEventListener('squeezeend', () => xrGrab(c, false));
  GL.scene.add(g);
  XR.ctrls.push(c);
}
function buzz(c, s, ms) {
  try {
    const a = c.src && c.src.gamepad && c.src.gamepad.hapticActuators;
    if (a && a[0] && a[0].pulse) a[0].pulse(s || 0.3, ms || 18);
  } catch (e) { /* no haptics */ }
}
function rayAngles(c) {
  _xd.copy(c.d).applyQuaternion(_xq.copy(GL.rig.quaternion).invert());
  return [Math.atan2(_xd.x, -_xd.z), Math.asin(clamp(_xd.y, -1, 1))];
}
function startDrag(c) {
  const [az, el] = rayAngles(c), centre = _xp.setFromMatrixPosition(GL.world.matrixWorld);
  return { az, el, az0: az, el0: el, moved: false, k: Math.max(0.6, (c.o.distanceTo(centre) - XR.R) / XR.R) };
}
// dragging moves the globe surface along with the ray (explore mode only)
function dragGlobe(c, st) {
  const [az, el] = rayAngles(c);
  if (!st.moved) {
    if (Math.hypot(az - st.az0, el - st.el0) < 0.025) return;
    st.moved = true;
  }
  let da = az - st.az;
  da -= Math.round(da / (2 * Math.PI)) * 2 * Math.PI;
  const de = el - st.el;
  st.az = az; st.el = el;
  if (APP.mode !== 'explore') return;
  orbit.to = null;
  const kd = st.k / D2R;
  orbit.cur[0] -= da * kd;
  orbit.cur[1] = clamp(orbit.cur[1] - de * kd, -80, 80);
}
function xrPress(c) {
  const h = c.hover;
  c.press = null;
  if (!h) return;
  if (h.kind === 'shell') { HOST.collab.press(c.i); return; }   // the shared room's panel, previews, calibration
  if (h.kind === 'panel') {
    const r = h.P.at(h.x, h.y);
    if (!r) return;
    c.press = { kind: 'panel', P: h.P, id: r.id, r };
    if (r.drag) { r.drag(h.x, h.y); buzz(c, 0.2, 12); }
  } else { c.press = Object.assign(startDrag(c), { kind: 'globe', i: h.i, pk: h.pk }); orbit.held = true; }
}
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'globe') orbit.held = false;
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      if (r && r.id === p.id && r.fn) { buzz(c); r.fn(); }
    }
  } else if (!p.moved && p.pk) { buzz(c); xrClickPick(p.pk); }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  // the scene is held by its placement point (where the view's target sits), so a still hand moves nothing
  const p0 = h.kind === 'panel' ? XR.panelGroup.getWorldPosition(new THREE.Vector3()) : GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff));
  c.grab = { target: h.kind === 'panel' ? 'panel' : 'globe', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1 };
  buzz(c, 0.4, 25);
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { c.grab = null; return; }   // locked meanwhile (a shared room's layout lock)
  const o = G.target === 'globe' ? XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'globe' && k.src && k.g.visible) : null;
  if (o) { if (c.i > o.i) xrResize(o, c); return; }
  if (G.two) { G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.p0.copy(GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff))); G.reach = 1; }
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  const lenMax = 4;
  if (_gv.length() > lenMax) _gv.setLength(lenMax);
  _gv.applyQuaternion(_gq).add(c.o);
  GL.rig.worldToLocal(_gv);
  if (G.target === 'globe') XR.globeOff.copy(_gv).sub(XR.globeBase);
  else {
    XR.panelGroup.position.copy(_gv);
    GL.rig.worldToLocal(_gh.copy(XR.head));
    XR.panelGroup.rotation.set(0, Math.atan2(_gh.x - _gv.x, _gh.z - _gv.z), 0); // keep it upright, facing you
  }
}
// both hands on the scene: it grows and shrinks with the distance between them (a quarter to four times the
// story's own size) and moves with their middle
function xrResize(a, b) {
  const d = a.o.distanceTo(b.o);
  _gv.copy(a.o).add(b.o).multiplyScalar(0.5);
  GL.rig.worldToLocal(_gv);
  const T = a.grab.two || (a.grab.two = b.grab.two = { d0: Math.max(0.05, d), s0: XR.size, m0: _gv.clone(), off0: XR.globeOff.clone() });
  XR.size = clamp(T.s0 * d / T.d0, 0.25, 4);
  XR.globeOff.copy(T.off0).add(_gv).sub(T.m0);
}
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; c.grab = null; return; }   // (a controller gone lets go)
  c.o.setFromMatrixPosition(g.matrix);
  c.d.set(0, 0, -1).transformDirection(g.matrix);
  let hit = null, dist = 2.5;
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  // then the shared room's own things (its panel, the other stations, a calibration), if nearer than a panel
  const sh = HOST.collab.ray(c.i, c.o, c.d, hs.length ? hs[0].distance : Infinity);
  if (sh) { hit = sh; dist = sh.dist; }
  else if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories) {
    // the scene counts as a ball around the view's target; an organ or a domain counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const pk = pickRay(c.o, c.d);
    if (t > 0 || pk) {
      // an organ's point is marked where it is; else the ball's surface
      const q = pk ? pickPos(pk) : null;
      if (q) _xp.set(q[0], q[1], q[2]).applyMatrix4(GL.sets[X.scene].group.matrixWorld);
      else _xp.copy(dL).multiplyScalar(t > 0 ? t : Math.max(0, _xc.copy(XR.target).sub(oL).dot(dL))).add(oL).applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i: -1, pk, point: _xp.clone() };
      dist = c.o.distanceTo(_xp);
    }
  }
  c.hover = hit;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.press && c.press.kind === 'globe') dragGlobe(c, c.press);
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // thumbstick: spin and zoom the globe; A/X: play or pause the story
  const gp = c.src.gamepad;
  if (gp) {
    const ax = gp.axes.length >= 4 ? gp.axes[2] : 0, ay = gp.axes.length >= 4 ? gp.axes[3] : 0;
    if (APP.mode === 'explore' && !c.press && !c.grab) {
      if (Math.abs(ay) > 0.2) { orbit.to = null; orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ay * dt * 1.5), xrMinD(), 40); }
      if (Math.abs(ax) > 0.2) { orbit.to = null; orbit.cur[0] -= ax * dt * 60; }
    }
    const b4 = !!(gp.buttons[4] && gp.buttons[4].pressed);
    if (b4 && !c.b4 && APP.mode === 'story') APP.togglePlay();
    c.b4 = b4;
  }
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

// ---------------------------------------------------------------- frames --
const _xUp = new THREE.Vector3(0, 1, 0);
function xrBegin(frame, dt) {
  const ref = GL.renderer.xr.getReferenceSpace();
  const pose = frame && ref ? frame.getViewerPose(ref) : null;
  if (pose) {
    const p = pose.transform.position, q = pose.transform.orientation;
    XR.head.set(p.x, p.y, p.z); XR.headQ.set(q.x, q.y, q.z, q.w);
    if (XR.needRecenter) { if (!HOST.anchor.held()) xrRecenter(); XR.needRecenter = false; } // an anchored place stays put
    // anchored: the spot in the room carries the frame that holds the panels, the Stories screen and the scene
    // (asked only once the headset has a pose, so a new anchor goes where things really are)
    const A = HOST.anchor.frame(frame, ref);
    if (A) { GL.rig.position.fromArray(A.p); GL.rig.quaternion.setFromAxisAngle(_xUp, A.yaw); }
    // at its station in a shared room a story is the station's: its Stories screen closes (the panel offers none there)
    if (XR.stories && HOST.collab.mine() && HOST.room.placing()) xrLandingClose();
  }
  const bl = XR.session && XR.session.renderState.baseLayer;
  if (bl) {
    if (bl.framebufferHeight) XR.viewH = bl.framebufferHeight;
    if (!XR.fov) {
      XR.fov = true;
      try { if ('fixedFoveation' in bl) bl.fixedFoveation = 0.5; } catch (e) { /* not supported */ }
    }
  }
  GL.rig.updateMatrixWorld(true);
  _xinv.copy(GL.world.matrixWorld).invert();
  for (const c of XR.ctrls) xrPoint(c, dt);
  for (const P of XR.panels) {
    let hv = null;
    for (const c of XR.ctrls) {
      if (c.hover && c.hover.kind === 'panel' && c.hover.P === P) { const r = P.at(c.hover.x, c.hover.y); if (r) hv = r.id; }
    }
    P.hover = hv;
  }
}
function xrUpdate(S) {
  // the Stories screen replaces the story's panels and hides the story
  const land = !!XR.stories;
  if (XR.land) {
    // Sound check takes the place of the story cards while it is open
    for (const P of XR.land) P.mesh.visible = land && (P === XR.land[0] || !XR.soundCheck);
    XR.snd.mesh.visible = land && !!XR.soundCheck;
    XR.main.mesh.visible = XR.foot.mesh.visible = !land;
  }
  GL.world.visible = !land;
  if (land !== XR.landShown) { XR.landShown = land; HOST.setUrl(land); }
  GL.rig.updateMatrixWorld(true);
  XR.camLocal.copy(XR.head);
  GL.world.worldToLocal(XR.camLocal);
  const story = APP.mode === 'story';
  for (const L of ST.labels) {
    if (story) placeLabelXR(L, fadeVal(storyT(APP.t), L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0), S);
    else if (L.sprite) L.sprite.visible = false;
  }
  for (const L of LBL.sets) placeLabelXR(L, setLabelAlpha(L, S), S);
  for (const L of LBL.extra) {
    if (!story) placeLabelXR(L, 1, S);
    else if (L.sprite) L.sprite.visible = false;
  }
  xrTip(S);
  const now = performance.now();
  for (const P of XR.panels) panelTick(P, now);
}

// ---------------------------------------------------------- explore glue --
function xrClickPick(pk) {
  if (APP.mode !== 'explore') return;
  XR.kbd.open = false;
  choosePick(pk);
}
// how close the headset may zoom: as close as the scene's own closest view, else 0.9 (closer, the scene would surround your head)
const xrMinD = () => Math.min(0.9, ...Object.values(GL.sets[X.scene].cam || {}).map(v => +v[2] || 9));
function xrZoom(f) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = c.slice(); orbit.to[2] = clamp(c[2] * f, xrMinD(), 40);
  orbit.t0 = performance.now();
}

// --------------------------------------------------------------- session --
function xrMsg(text) {
  const el = $('#xrmsg');
  el.textContent = text; el.style.display = 'block';
  clearTimeout(xrMsg.t);
  xrMsg.t = setTimeout(() => { el.style.display = 'none'; }, 6000);
}
async function xrStart(mode) {
  if (XR.session || !navigator.xr) return;
  let session;
  try {
    session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'hand-tracking', 'anchors', 'plane-detection', 'mesh-detection', 'shared'] });
  } catch (err) {
    HOST.landingVR = false;
    xrMsg(`Could not start ${mode === 'immersive-ar' ? 'AR' : 'VR'}: ${err && err.message ? err.message : err}`);
    return;
  }
  XR.session = session; XR.mode = mode;
  HOST.session = session; HOST.mode = mode;
  session.addEventListener('visibilitychange', xrVisibility);
  xrEnterScene();
  try {
    GL.renderer.xr.setReferenceSpaceType('local');
    await GL.renderer.xr.setSession(session);
    const ref = GL.renderer.xr.getReferenceSpace();
    if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
  } catch (err) {
    console.error(err);
    xrMsg('Could not start the headset view: ' + (err && err.message ? err.message : err));
    try { await session.end(); } catch (e) { /* already ended */ }
    if (XR.on) xrEnded();
  }
}
function xrEnterScene() {
  XR.stories = false;
  XR.on = true; XR.needRecenter = true; XR.fov = false; XR.tipI = -1;
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  GL.stars.visible = XR.clear;
  GL.stars.material.size = 2.2;
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.o = -1;
  // every headset session starts the story from the top; entered from the start screen, it shows the Stories menu first
  const fromStart = HOST.picking || HOST.landingVR;
  HOST.landingVR = false;
  HOST.closePicker();
  if (fromStart) { APP.enterStory(0); APP.playing = false; XR.stories = true; XR.inStory = false; audioSync(); }
  else { XR.inStory = true; if (APP.mode === 'story') APP.playing = true; } // already in a story: carry on where you were
  $('#tip').style.opacity = 0;
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.el.style.opacity = 0;
  if (document.fonts && !XR.fontOK) {
    Promise.all([document.fonts.load(vfont(30, 700)), document.fonts.load(vfont(30))]).then(() => {
      XR.fontOK = 1;
      [...ST.labels, ...LBL.sets, ...LBL.extra].forEach(dropSprite);
    }).catch(() => {});
  }
}
// Headset taken off (or put to sleep) for more than a few seconds: treat the next
// wearer as a new visitor. Restart the story and place everything in front of them
// (when anchored, everything stays at its spot in the room).
const XR_AWAY_MS = 3000;
function xrVisibility() {
  const v = XR.session && XR.session.visibilityState;
  if (v === 'hidden') { if (!XR.hiddenAt) XR.hiddenAt = performance.now(); }
  else if (v === 'visible' && XR.hiddenAt) {
    const away = performance.now() - XR.hiddenAt;
    XR.hiddenAt = 0;
    if (away > XR_AWAY_MS) xrFreshStart();
  }
  audioSync();
}
function xrFreshStart() {
  XR.kbd.open = false; XR.kbd.q = '';
  for (const c of XR.ctrls) { c.press = null; c.grab = null; c.wantPress = false; }
  // at a shared room's station the story and its place stay: the room's clock and state go on applying
  if (HOST.collab.mine()) { lastNow = 0; return; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; XR.soundCheck = false; // a new wearer lands in the Stories screen
  XR.needRecenter = true; // uses the new wearer's head position and direction on the next frame
  lastNow = 0;
}
// a story picked inside the headset takes over the running session
function xrAdopt() {
  XR.session = HOST.session; XR.mode = HOST.mode;
  XR.session.addEventListener('visibilitychange', xrVisibility);
  XR.ctrls.forEach((c, i) => { const s = HOST.inputs[i]; if (s) { c.src = s; c.ray.visible = s.targetRayMode !== 'screen'; } });
  xrEnterScene();
  // keep the scene and the panel where they were in the story before
  const p = HOST.xrPose;
  if (p) {
    XR.needRecenter = false;
    GL.rig.position.copy(p.rp); GL.rig.quaternion.copy(p.rq);
    XR.globeOff.copy(p.off); XR.size = p.s || 1;
    XR.panelGroup.position.copy(p.pp); XR.panelGroup.rotation.set(0, p.pr, 0);
  }
  const ref = GL.renderer.xr.getReferenceSpace();
  if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
}
function xrEnded() {
  if (!XR.on) return;
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; c.grab = null; c.hover = null; c.src = null; }
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { if (L.sprite) L.sprite.visible = false; L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.stars.visible = true; GL.stars.material.size = 1.3;
  GL.world.visible = true;
  for (const P of XR.land || []) P.mesh.visible = false;
  if (XR.snd) XR.snd.mesh.visible = false;
  XR.soundCheck = false;
  // left the headset from the Stories screen: back to the Stories screen on the page
  if (XR.stories) { XR.stories = false; HOST.openPicker(); }
  applyTheme();
  resize();
}
function xrSetup() {
  XR.raycaster = new THREE.Raycaster();
  // panel 0.62 m wide, about 40 degrees to the left and facing you
  const mw = 0.62, px = -0.56, py = 0.04, pz = -0.86, yaw = Math.atan2(-px, -pz);
  XR.main = makePanel(1024, 1200, mw, drawMain, sigMain);
  XR.foot = makePanel(1024, 176, mw, drawFoot, sigFoot);
  XR.panelGroup = new THREE.Group();
  XR.panelHome = { p: new THREE.Vector3(px, py, pz), yaw };
  XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.y = yaw;
  GL.rig.add(XR.panelGroup);
  XR.foot.mesh.position.set(0, -(mw * 1200 / 1024) / 2 - 0.012 - (mw * 176 / 1024) / 2, 0);
  for (const P of [XR.main, XR.foot]) { XR.panelGroup.add(P.mesh); XR.panels.push(P); }
  XR.panelMeshes = XR.panels.map(P => P.mesh);
  xrLandingSetup();
  for (let i = 0; i < 2; i++) xrController(i);
  GL.renderer.xr.addEventListener('sessionend', xrEnded);
  $('#btnVR').addEventListener('click', () => xrStart('immersive-vr'));
  $('#btnAR').addEventListener('click', () => xrStart('immersive-ar'));
  if (!navigator.xr) {
    if (/OculusBrowser|Quest|Pico|Wolvic/i.test(navigator.userAgent)) xrMsg('Open this page over https:// to view it in VR.');
    return;
  }
  navigator.xr.isSessionSupported('immersive-vr').then(vr => {
    if (vr) $('#btnVR').hidden = false;
    // headsets support both; phones only AR, which this layout is not made for
    return navigator.xr.isSessionSupported('immersive-ar').then(ar => { if (ar && vr) $('#btnAR').hidden = false; });
  }).catch(() => {});
}

// ------------------------------------------------------------ VR panels --
// The HTML side panel can't be shown inside a headset, so it is redrawn on a
// canvas texture. Each draw records clickable regions for the controller ray.
const VC = { bg: 'rgba(8,15,28,0.95)', ink: '#e7eef8', muted: '#95a6bd', faint: '#6c7d94', line: 'rgba(149,166,189,0.22)',
  chip: 'rgba(149,166,189,0.13)', chipHi: 'rgba(149,166,189,0.30)', on: 'rgba(70,217,255,0.20)', cyan: '#46d9ff',
  magenta: '#ff5ad9', amber: '#ffb43b', red: '#ff5a4b', green: '#3ee08f' };
const vfont = (px, w) => `${w || 400} ${px}px B612, "Segoe UI", "Helvetica Neue", Arial, sans-serif`;
const cssColor = s => { const m = /var\(--(\w+)\)/.exec(s || ''); return m ? VC[m[1]] || VC.ink : s || VC.ink; };
function rr(ctx, x, y, w, h, r) {
  r = Math.min(r, w / 2, h / 2);
  ctx.beginPath();
  ctx.moveTo(x + r, y);
  ctx.arcTo(x + w, y, x + w, y + h, r); ctx.arcTo(x + w, y + h, x, y + h, r);
  ctx.arcTo(x, y + h, x, y, r); ctx.arcTo(x, y, x + w, y, r);
  ctx.closePath();
}
function wrapLines(ctx, text, maxW) {
  const words = String(text).split(/\s+/).filter(Boolean), lines = [];
  let cur = '';
  for (const w of words) {
    const t = cur ? cur + ' ' + w : w;
    if (cur && ctx.measureText(t).width > maxW) { lines.push(cur); cur = w; } else cur = t;
  }
  if (cur) lines.push(cur);
  return lines;
}
// draws wrapped text (textBaseline top), returns its height
function textBlock(ctx, text, x, y, maxW, px, lh, color, weight, maxLines) {
  ctx.font = vfont(px, weight);
  ctx.fillStyle = color || VC.ink;
  let L = wrapLines(ctx, text, maxW);
  if (maxLines && L.length > maxLines) { L = L.slice(0, maxLines); L[maxLines - 1] += '…'; }
  L.forEach((l, k) => ctx.fillText(l, x, y + k * lh));
  return L.length * lh;
}
function fitText(ctx, text, maxW) {
  if (ctx.measureText(text).width <= maxW) return text;
  let t = text;
  while (t.length > 1 && ctx.measureText(t + '…').width > maxW) t = t.slice(0, -1);
  return t + '…';
}
function vButton(ctx, P, id, x, y, w, h, label, fn, o = {}) {
  const hov = P.hover === id;
  rr(ctx, x, y, w, h, o.r !== undefined ? o.r : 10);
  ctx.fillStyle = o.primary ? (hov ? '#8ce9ff' : VC.cyan) : o.on ? VC.on : hov ? VC.chipHi : VC.chip;
  ctx.fill();
  if (o.on || (hov && !o.primary)) { ctx.lineWidth = 2; ctx.strokeStyle = o.on ? VC.cyan : 'rgba(149,166,189,0.55)'; ctx.stroke(); }
  if (label) {
    ctx.font = vfont(o.px || 25, o.bold || o.on || o.primary ? 700 : 400);
    ctx.fillStyle = o.primary ? '#04131c' : o.color || VC.ink;
    ctx.textBaseline = 'middle';
    if (o.left) ctx.fillText(fitText(ctx, label, w - 28), x + 16, y + h / 2 + 1);
    else { ctx.textAlign = 'center'; ctx.fillText(fitText(ctx, label, w - 16), x + w / 2, y + h / 2 + 1); ctx.textAlign = 'left'; }
    ctx.textBaseline = 'top';
  }
  if (fn) P.regions.push({ id, x, y, w, h, fn });
}
function swatch(ctx, x, y, s, color) { rr(ctx, x, y, s, s, 4); ctx.fillStyle = color; ctx.fill(); }
function makePanel(w, h, mw, draw, sig) {
  const cv = document.createElement('canvas');
  cv.width = w; cv.height = h;
  const tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = Math.min(8, GL.renderer.capabilities.getMaxAnisotropy());
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(mw, mw * h / w),
    new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthTest: false, depthWrite: false }));
  mesh.renderOrder = 50;
  mesh.visible = false;
  const P = { w, h, cv, ctx: cv.getContext('2d'), tex, mesh, draw, sig, regions: [], hover: null, last: '', t: 0 };
  P.at = (x, y) => {
    for (let k = P.regions.length - 1; k >= 0; k--) {
      const r = P.regions[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  };
  return P;
}
// redraw only when what the panel shows has changed (texture uploads are not free)
function panelTick(P, now) {
  const s = P.sig() + '|' + P.hover + '|' + XR.fontOK;
  if (s === P.last || now - P.t < 60) return;
  P.last = s; P.t = now;
  const ctx = P.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, P.w, P.h);
  ctx.globalAlpha = 1; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  P.regions = [];
  rr(ctx, 0, 0, P.w, P.h, 26);
  ctx.fillStyle = XR.clear ? VC.bg : 'rgba(8,15,28,0.97)';
  ctx.fill();
  P.draw(ctx, P);
  P.tex.needsUpdate = true;
}

// ------------------------------------------------------------ main panel --
function sigMain() {
  if (XR.stories) return 'stories' + audioLabel();
  if (APP.mode === 'story') {
    const it = ST.items.find(x => x.ch === curCh);
    let s = 's' + audioLabel() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
  return ['x', audioLabel(), X.tab, X.scene, JSON.stringify(X.ctl), X.organ, X.domain, X.age, X.step, X.kind, GL.orgV || 0].join('|');
}
const XR_HERE = 'micro';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// floating in an arc in front of you while the story itself is hidden.
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel() + HOST.repeat + XR.soundCheck + HOST.audio.muted + HOST.anchor.status());
  head.mesh.position.set(0, 0.36, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head);
  HOST.list.forEach((s, k) => {
    // cards 0.36 m wide on an arc: seven 0.31 rad apart at 1.25 m (neighbours 0.386 m apart, the outer ones 53° to the
    // side), eight 0.272 rad apart at 1.4 m (0.379 m apart, the outer ones 55° to the side), nine 0.245 rad apart at
    // 1.55 m (0.379 m apart, the outer ones 56° to the side), ten 0.225 rad
    // apart at 1.7 m (0.382 m apart, the outer ones 58° to the side)
    const n = HOST.list.length, a = (k - (n - 1) / 2) * (n > 9 ? 0.225 : n > 8 ? 0.245 : n > 7 ? 0.272 : 0.31), d = n > 9 ? 1.7 : n > 8 ? 1.55 : n > 7 ? 1.4 : 1.25;
    const P = makePanel(640, 820, 0.36, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, -0.105, -Math.cos(a) * d);   // top edge 0.126 m up, under the header
    P.mesh.rotation.y = -a;
    XR.landGroup.add(P.mesh); XR.land.push(P);
  });
  for (const P of XR.land) XR.panels.push(P);
  // Sound check (opened from the header), in the place of the story cards
  XR.snd = makePanel(1400, 860, 1.02, drawSoundCheck, () => (XR.snd.mesh.visible ? 'snd' + Math.floor(performance.now() / 500) : 'off'));
  XR.snd.mesh.position.set(0, -0.17, -1.2);
  XR.landGroup.add(XR.snd.mesh); XR.panels.push(XR.snd);
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// leave the Stories screen: back into this story (resumed, or started if it never ran)
function xrLandingClose() {
  XR.stories = false;
  // at a shared room's station the story goes on as the room has it: a restart here would restart it for everyone
  if (!XR.inStory && !HOST.collab.mine()) APP.enterStory(0);
  XR.inStory = true;
  if (APP.mode === 'story') APP.playing = true;
}
function drawLandHead(ctx, P) {
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
  // anchored: where the place stands, in place of the hint
  const an = HOST.anchor.status();
  textBlock(ctx, an || 'The same ideas, very different networks. Point at a story and pull the trigger (or pinch).', 48, 128, 860, 27, 38, an ? VC.ink : VC.muted, 400, 2);
  // the sound, before a story starts: its state (press to start it, or to turn the narration off and on) and Sound check
  const sl = audioLabel() || (HOST.audio.muted ? 'Sound off' : 'Sound');
  vButton(ctx, P, 'land:sound', 48, 212, 300, 64, sl, () => audioToggle(), { on: sl === 'Sound on', px: 25 });
  vButton(ctx, P, 'land:check', 362, 212, 250, 64, 'Sound check', () => { XR.soundCheck = !XR.soundCheck; }, { on: !!XR.soundCheck, px: 25 });
  // Anchor: keep the scenes and panels at this spot in the room, for every story (pressing it lit turns it off)
  vButton(ctx, P, 'land:anchor', 626, 212, 200, 64, 'Anchor', () => HOST.anchor.set(!HOST.anchor.on), { on: HOST.anchor.on, px: 25 });
  let x = P.w - 44;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 40, w, 64, label, fn, o); x -= 14; };
  hb('exit', 'Exit', () => { if (XR.session) XR.session.end(); }, 110, { px: 27 });
  // anchored, Recenter becomes Place again: everything in front of you, then anchored there
  if (HOST.anchor.on) hb('again', 'Place again', () => { HOST.anchor.again(); XR.needRecenter = true; }, 210, { px: 27 });
  else hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 170, { px: 27 });
  if (XR.inStory) vButton(ctx, P, 'back', P.w - 44 - 294, 128, 294, 64, 'Back to the story', xrLandingClose, { px: 26 });
  // Repeat: all stories one after another, or the one you pick again and again (pressing a lit one turns it off)
  vButton(ctx, P, 'rep:all', P.w - 44 - 414, 212, 200, 64, 'Repeat all', () => HOST.toggleRepeat('all'), { on: HOST.repeat === 'all', px: 26 });
  vButton(ctx, P, 'rep:one', P.w - 44 - 200, 212, 200, 64, 'Repeat one', () => HOST.toggleRepeat('one'), { on: HOST.repeat === 'one', px: 26 });
}
// Sound check in the headset: test beeps through each engine, the engine choice, and what is going on
function drawSoundCheck(ctx, P) {
  const x = 48, W = P.w - 96;
  ctx.font = vfont(46, 700); ctx.fillStyle = VC.ink; ctx.fillText('Sound check', x, 36);
  vButton(ctx, P, 'snd:close', P.w - 44 - 160, 30, 160, 60, 'Close', () => { XR.soundCheck = false; }, { px: 25 });
  let y = 100 + textBlock(ctx, 'No narration? Press both beeps. If you hear only one, choose that way to play.', x, 100, W, 27, 37, VC.muted, 400, 2) + 14;
  const bw = (W - 16) / 2, cw = (W - 48) / 4, p = HOST.audio.pref;
  vButton(ctx, P, 'snd:beepW', x, y, bw, 70, 'Beep through Web Audio', () => HOST.audio.beep('webaudio'), { px: 26 });
  vButton(ctx, P, 'snd:beepM', x + bw + 16, y, bw, 70, 'Beep through an audio element', () => HOST.audio.beep('media'), { px: 26 });
  y += 86;
  [['auto', 'Automatic'], ['webaudio', 'Web Audio'], ['media', 'Audio element']].forEach(([k, l], i) =>
    vButton(ctx, P, 'snd:' + k, x + i * (cw + 16), y, cw, 62, l, () => HOST.audio.setEngine(k), { on: p === k, px: 24 }));
  vButton(ctx, P, 'snd:reset', x + 3 * (cw + 16), y, cw, 62, 'Reset', () => HOST.audio.reset(), { px: 24 });
  y += 84;
  for (const line of HOST.audio.report()) {
    if (y > P.h - 44) break;
    y += textBlock(ctx, line, x, y, W, 22, 30, VC.muted, 400, 2) + 4;
  }
}
function drawLandCard(ctx, P, s) {
  const here = s.key === XR_HERE, id = 'card', hov = P.hover === id;
  rr(ctx, 8, 8, P.w - 16, P.h - 16, 22);
  ctx.lineWidth = 4; ctx.strokeStyle = hov ? s.col : here && XR.inStory ? 'rgba(70,217,255,0.6)' : 'rgba(140,170,210,0.3)'; ctx.stroke();
  ctx.fillStyle = s.col; ctx.fillRect(8, 8, P.w - 16, 10);
  ctx.font = vfont(28, 700); ctx.fillStyle = s.col; ctx.fillText(s.kick.toUpperCase(), 48, 64);
  ctx.font = vfont(72, 700); ctx.fillStyle = VC.ink; ctx.fillText(s.title, 46, 112);
  textBlock(ctx, s.desc, 48, 222, P.w - 96, 31, 45, VC.muted, 400, 7);
  ctx.font = vfont(26); ctx.fillStyle = VC.faint; ctx.fillText(s.len, 48, P.h - 196);
  const label = here && XR.inStory ? 'Resume' : 'Start';
  vButton(ctx, P, 'go', 48, P.h - 140, P.w - 96, 92, label, null, { primary: true, px: 34 });
  P.regions.push({ id, x: 0, y: 0, w: P.w, h: P.h, fn: () => (here ? xrLandingClose() : HOST.go(s.key)) });
}
function drawStoriesPane(ctx, P, x, y, W) {
  y += textBlock(ctx, 'Choose a story', x, y, W, 46, 54, VC.ink, 700) + 6;
  y += textBlock(ctx, 'The same ideas, very different networks. Pick one; you stay in the headset view.', x, y, W, 25, 35, VC.muted) + 22;
  // fit the cards above the Back button (the list grew to four)
  const h = Math.min(210, Math.floor((P.h - 96 - y) / XR_STORIES.length) - 18);
  for (const { key: k, kick, title, desc, col } of XR_STORIES) {
    const here = k === XR_HERE;
    vButton(ctx, P, 'story:' + k, x, y, W, h, '', () => { if (here) XR.stories = false; else HOST.go(k); }, { on: here, r: 14 });
    ctx.font = vfont(21, 700); ctx.fillStyle = col; ctx.fillText(kick.toUpperCase(), x + 26, y + 22);
    ctx.font = vfont(38, 700); ctx.fillStyle = VC.ink; ctx.fillText(title, x + 26, y + 54);
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; }
    textBlock(ctx, desc, x + 26, y + 100, W - 52, 24, 33, VC.muted, 400, 2);
    y += h + 18;
  }
  vButton(ctx, P, 'story:close', x, y + 4, 220, 60, 'Back', () => { XR.stories = false; }, { px: 25 });
}
function drawMain(ctx, P) {
  const story = APP.mode === 'story';
  let x = P.w - 36;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 26, w, 54, label, fn, o); x -= 12; };
  // (Exit is on the shell's Shared panel, at hand on the left controller)
  if (AUD && AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.on(), px: 23 });
  if (!HOST.anchor.on) hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 140); // anchored: nothing moves
  // at a shared room's station each station keeps its story: another story is another station, so no Stories button
  if (!(HOST.room && HOST.room.placing())) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink;
  ctx.fillText(fitText(ctx, 'Tissue and time', x - 40), 40, 36);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again on the Stories screen.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
  } else drawExplorePane(ctx, P, 40, 120, P.w - 80);
}

// story: draw the current chapter straight from its HTML, with the same timing
const STY = {
  H1: { px: 84, lh: 90, w: 700, mb: 22 }, H2: { px: 62, lh: 70, w: 700, mb: 24 },
  p: { px: 35, lh: 50, mb: 20, c: 'ink' }, lede: { px: 39, lh: 52, mb: 24, c: 'muted' }, note: { px: 29, lh: 41, mb: 16, c: 'muted' },
  caption: { px: 25, lh: 34, mb: 12, c: 'muted' }, credits: { px: 24, lh: 34, mb: 12, c: 'muted' }, step: { px: 25, lh: 34, mb: 8, c: 'faint' },
};
function storyOpacity(el) {
  if (!XR.elInfo) { XR.elInfo = new Map(); ST.items.forEach(it => it.els.forEach(e => XR.elInfo.set(e.el, e))); }
  const e = XR.elInfo.get(el);
  return e ? Math.round(Math.max(0, e.o) * 3) / 3 : 1;
}
function drawStoryPane(ctx, P, x, y, W) {
  const it = ST.items.find(i => i.ch === curCh) || ST.items[0];
  for (const el of it.sec.children) y = drawStoryEl(ctx, P, el, x, y, W, 1);
  ctx.globalAlpha = 1;
}
function drawStoryEl(ctx, P, el, x, y, W, pa) {
  const a = pa * storyOpacity(el), tag = el.tagName.toUpperCase(), cl = el.classList;
  ctx.globalAlpha = a;
  let h = 0;
  if (tag === 'SVG') {
    // the title's route arc, drawn as it grows
    const k = 1.5, arc = el.querySelector('#titleArc'), dot = el.querySelector('#titleDot');
    const prog = arc ? clamp(1 - parseFloat(arc.getAttribute('stroke-dashoffset') || '1'), 0, 1) : 1;
    const dA = dot ? parseFloat(dot.getAttribute('opacity') || '0') : 1;
    const p0 = [x + 8 * k, y + 36 * k], c1 = [x + 180 * k, y - 16 * k], p1 = [x + 352 * k, y + 36 * k];
    const bz = (s, j) => (1 - s) * (1 - s) * p0[j] + 2 * (1 - s) * s * c1[j] + s * s * p1[j];
    ctx.strokeStyle = VC.amber; ctx.lineWidth = 3.3; ctx.lineCap = 'round';
    if (prog > 0.002) {
      ctx.beginPath(); ctx.moveTo(p0[0], p0[1]);
      for (let n = 1; n <= 48; n++) { const s = prog * n / 48; ctx.lineTo(bz(s, 0), bz(s, 1)); }
      ctx.stroke();
    }
    ctx.fillStyle = VC.amber;
    ctx.beginPath(); ctx.arc(p0[0], p0[1], 4.5 * k, 0, 7); ctx.fill();
    ctx.globalAlpha = a * Math.round(dA * 4) / 4;
    ctx.beginPath(); ctx.arc(p1[0], p1[1], 4.5 * k, 0, 7); ctx.fill();
    h = 44 * k + 8;
  } else if (tag === 'H1' || tag === 'H2') {
    const s = STY[tag];
    h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, VC.ink, s.w) + s.mb;
  } else if (tag === 'P') {
    const btn = el.querySelector('button');
    if (btn) {
      if (a > 0.3) vButton(ctx, P, 'goExplore', x, y, 380, 68, btn.textContent, () => APP.enterExplore(), { primary: true, px: 27 });
      h = 68 + 22;
    } else {
      const s = cl.contains('lede') ? STY.lede : cl.contains('note') ? STY.note : cl.contains('caption') ? STY.caption
        : cl.contains('credits') ? STY.credits : cl.contains('step') ? STY.step : STY.p;
      const col = ['amber', 'magenta', 'green', 'red', 'cyan'].find(c => cl.contains(c));
      h = textBlock(ctx, el.textContent, x, y, W, s.px, s.lh, col ? VC[col] : VC[s.c], s.w) + s.mb;
    }
  } else if (cl.contains('big')) {
    const col = ['magenta', 'cyan', 'green', 'amber', 'red'].find(c => cl.contains(c));
    const small = el.querySelector('small'), all = el.textContent;
    const main = (small ? all.slice(0, all.length - small.textContent.length) : all).trim();
    ctx.font = vfont(96, 700); ctx.fillStyle = col ? VC[col] : VC.ink;
    ctx.fillText(main, x, y + 2);
    if (small) { const w = ctx.measureText(main).width; ctx.font = vfont(32); ctx.fillStyle = VC.muted; ctx.fillText(small.textContent, x + w + 16, y + 52); }
    h = 112;
  } else if (cl.contains('bars')) {
    const bars = [...el.children], n = bars.length, gap = 8, bw = (W - gap * (n - 1)) / n, top = y + 28, bh = 150;
    bars.forEach((b, k) => {
      const v = b.querySelector('.v'), f = b.querySelector('.fill'), kk = b.querySelector('.k');
      const hp = parseFloat(f.style.height) || 0, m = /scaleY\(([\d.]+)\)/.exec(f.style.transform || '');
      const s = m ? Math.round(parseFloat(m[1]) * 6) / 6 : 1, full = bh * hp / 100, bx = x + k * (bw + gap);
      ctx.fillStyle = cssColor(f.style.background || f.style.backgroundColor);
      if (s > 0) ctx.fillRect(bx, top + bh - full * s, bw, full * s);
      ctx.font = vfont(21); ctx.textAlign = 'center';
      ctx.fillStyle = VC.ink;
      if (v && v.textContent) ctx.fillText(v.textContent, bx + bw / 2, top + bh - full - 24);
      ctx.fillStyle = b.classList.contains('hl') ? VC.ink : VC.muted;
      if (kk) ctx.fillText(kk.textContent, bx + bw / 2, top + bh + 8);
      ctx.textAlign = 'left';
    });
    h = 28 + bh + 44;
  } else if (tag === 'UL' && cl.contains('legend')) {
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const sw = li.querySelector('.sw');
      swatch(ctx, x, yy + 10, 24, sw ? cssColor(sw.style.background) : VC.ink);
      ctx.font = vfont(30); ctx.fillStyle = VC.ink;
      ctx.fillText(li.textContent.trim(), x + 40, yy + 5);
      yy += 46;
    }
    h = yy - y + 12;
  } else if (cl.contains('facts')) {
    // a row of big numbers, each fading in on its own
    const cells = [...el.children], cw = W / cells.length;
    cells.forEach((c, k) => {
      ctx.globalAlpha = a * storyOpacity(c);
      const b = c.querySelector('b'), sm = c.querySelector('small');
      ctx.font = vfont(50, 700); ctx.fillStyle = b && b.dataset.col ? b.dataset.col : b && b.style.color && !/\(/.test(b.style.color) ? b.style.color : VC.amber; ctx.fillText(fitText(ctx, b ? b.textContent : '', cw - 16), x + k * cw, y);
      if (sm) textBlock(ctx, sm.textContent, x + k * cw, y + 68, cw - 16, 25, 32, VC.muted, 400, 2);
    });
    h = 68 + 64 + 18;
  } else if (tag === 'UL' && cl.contains('steps')) {
    // points with a bold name over a line of text, each fading in on its own
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const b = li.querySelector('b'), bold = b ? b.textContent : '', rest = li.textContent.slice(bold.length).trim();
      const col = li.dataset.col || cssColor(li.style.borderLeftColor) || VC.amber;   // an organ's point in its own colour (the HTML's is mixed for a light panel)
      const hh = 36 + textBlock(ctx, rest, x + 22, yy + 40, W - 22, 28, 38, VC.ink, 400, 4);
      ctx.fillStyle = col; ctx.fillRect(x, yy + 4, 5, hh);
      ctx.font = vfont(30, 700); ctx.fillStyle = col; ctx.fillText(bold, x + 22, yy);
      yy += hh + 16;
    }
    h = yy - y + 8;
  } else if (tag === 'UL' && cl.contains('concepts')) {
    let cx = x, cy = y;
    ctx.font = vfont(27);
    for (const li of el.children) {
      const t = li.textContent, w = ctx.measureText(t).width + 28;
      if (cx + w > x + W) { cx = x; cy += 54; }
      rr(ctx, cx, cy, w, 46, 6); ctx.fillStyle = VC.chip; ctx.fill();
      ctx.fillStyle = VC.ink; ctx.fillText(t, cx + 14, cy + 9);
      cx += w + 9;
    }
    h = cy - y + 46 + 26;
  } else if (tag === 'DIV' && el.style.display === 'grid') {
    // a grid of overlapping parts (one fades out as the next fades in)
    let mh = 0;
    for (const c of el.children) mh = Math.max(mh, drawStoryEl(ctx, P, c, x, y, W, a) - y);
    h = mh;
  } else if (tag === 'DIV') {
    // one part of such a grid: its paragraphs one under another
    let yy = y;
    for (const c of el.children) yy = drawStoryEl(ctx, P, c, x, yy, W, a);
    h = yy - y;
  } else if (el.textContent.trim()) {
    h = textBlock(ctx, el.textContent, x, y, W, 26, 38, VC.ink) + 14;
  }
  ctx.globalAlpha = 1;
  return y + h;
}


// explore: tabs and panes mirroring the HTML ones
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(24, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 10, y + 58, tw - 20, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => pickTab(k) });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 88;
  const bottom = P.h - 34;
  ({ organs: drawOrgansPane, domains: drawDomainsPane, age: drawAgePane, method: drawMethodPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, icon (an organ's model: ORGAN3D id), fn }
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  ctx.font = vfont(px);
  for (const it of items) {
    ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
    const sw = it.icon ? h - 10 : it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.icon) {   // (its picture, or a soft dot while it is drawn)
      const c = ORGAN3D.pic(it.icon), q = h - 8;
      if (c) ctx.drawImage(c, cx + 7, cy + 4, q, q);
      else { ctx.beginPath(); ctx.arc(cx + 7 + q / 2, cy + 4 + q / 2, q * 0.16, 0, 7); ctx.fillStyle = 'rgba(255,158,196,0.6)'; ctx.fill(); }
    }
    else if (it.col) swatch(ctx, cx + 12, cy + h / 2 - 7, 14, it.col);
    ctx.font = vfont(px, it.on ? 700 : 400); ctx.fillStyle = it.ink || VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(fitText(ctx, it.label, w - 26 - sw), cx + 13 + sw, cy + h / 2 + 1); ctx.textBaseline = 'top';
    cx += w + gap;
  }
  return cy + h - y;
}
const head = (ctx, x, y, t) => { ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(t, x, y); return 34; };
// a slider: a track from lo to hi, its knob at v; dragging it calls set(value)
function vSlider(ctx, P, id, x, y, w, v, lo, hi, col, set) {
  const f = clamp((v - lo) / (hi - lo), 0, 1);
  rr(ctx, x, y + 21, w, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.3)'; ctx.fill();
  rr(ctx, x, y + 21, w * f, 6, 3); ctx.fillStyle = col; ctx.fill();
  ctx.beginPath(); ctx.arc(x + w * f, y + 24, P.hover === id ? 16 : 13, 0, 7); ctx.fillStyle = col; ctx.fill();
  P.regions.push({ id, x: x - 16, y, w: w + 32, h: 48, drag: px => set(lo + clamp((px - x) / w, 0, 1) * (hi - lo)) });
}
// the age slider with its readout (20 to 70)
function drawAge(ctx, P, x, y, W) {
  ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle'; ctx.fillText('Age', x, y + 25);
  ctx.font = vfont(26, 700); ctx.textAlign = 'right'; ctx.fillText(String(X.age), x + W, y + 25); ctx.textAlign = 'left'; ctx.textBaseline = 'top';
  vSlider(ctx, P, 'age', x + 80, y, W - 160, X.age, AGE0, AGE1, VC.amber, v => setAge(v, true));
  return 60;
}
function drawOrgansPane(ctx, P, x, y, W, bottom) {
  const O = organOf(X.organ);
  y += flow(ctx, P, MD.organs.map(o => ({ id: 'org:' + o.name, label: o.name, icon: orgPic(o), on: O === o, fn: () => selectOrgan(O === o ? null : o.name) })), x, y, W, bottom, { px: 20, h: 42 }) + 18;
  if (!O) { textBlock(ctx, `The ${FACTS.organs} organs whose tissue GTEx collected. Pick one, or point at an organ's light in the body, a section in the atlas or a node of the network and pull the trigger (or pinch).`, x, y, W, 26, 38, VC.muted); return; }
  const oi = orgPic(O), oc = oi && ORGAN3D.pic(oi);
  if (oc) ctx.drawImage(oc, x - 4, y - 6, 58, 58);
  y += textBlock(ctx, O.name, x + (oc ? 60 : 0), y + 2, W - 60, 38, 46, VC.ink, 700, 1) + 10;
  const tis = O.tissues.length ? O.tissues : [O.name];
  y += head(ctx, x, y, tis.length > 1 ? `Its ${word(tis.length)} tissues in GTEx: pick one to see its section` : 'One tissue in GTEx');
  y += flow(ctx, P, tis.map(t => ({ id: 'tis:' + t, label: tisShort(t, O.name), col: LEVEL_COL[1], on: X.organ === t || (tis.length > 1 && X.organ === O.name && t === tis[0]), fn: () => selectOrgan(t) })), x, y, W, bottom, { px: 21, h: 44 }) + 14;
  y += head(ctx, x, y, 'Its tissue types in the network (domains on each)');
  y += flow(ctx, P, O.types.map(t => ({ id: 'kind:' + t, label: `${cap(nodeName(t))} · ${MD.typeDomains(t).length}`, col: LEVEL_COL[2], fn: () => { pickKind(nodeName(t)); showTab('domains'); } })), x, y, W, bottom, { px: 21, h: 44 }) + 14;
  if (y + 100 > bottom) return;
  y += head(ctx, x, y, 'Show it');
  flow(ctx, P, [{ id: 'sh:map', label: 'Its section', on: X.scene === 'atlas' && viewIs('atlas', VIEW.map), fn: () => showView('atlas', VIEW.map) },
    { id: 'sh:net', label: 'In the network', on: X.scene === 'hier' && viewIs('hier', VIEW.net), fn: () => showView('hier', VIEW.net) },
    { id: 'sh:body', label: 'In the body', on: X.scene === 'body', fn: () => openScene('body') }], x, y, W, bottom, { px: 22, h: 50 });
}
function drawDomainsPane(ctx, P, x, y, W, bottom) {
  const d = X.domain ? MD.domain(X.domain) : -1, td = d >= 0 ? MD.typeOfDomain(d) : -1;
  // the tissue type listed: the one picked here, else the domain's
  const kinds = MD.types.filter(t => MD.typeDomains(t).length), kt = X.kind && MD.type(X.kind) >= 0 ? MD.type(X.kind) : td >= 0 ? td : kinds[0];
  y += head(ctx, x, y, 'Tissue types: pick one, then a domain');
  y += flow(ctx, P, kinds.map(t => ({ id: 'kind:' + t, label: cap(nodeName(t)), col: LEVEL_COL[2], on: t === kt, fn: () => pickKind(nodeName(t)) })), x, y, W, bottom, { px: 20, h: 42 }) + 16;
  y += head(ctx, x, y, `${cap(nodeName(kt))}: its ${MD.typeDomains(kt).length} domains in this map`);
  y += flow(ctx, P, MD.typeDomains(kt).map(j => ({ id: 'dom:' + j, label: cap(nodeName(j)), col: domCol(nodeName(j)), on: j === d, fn: () => selectDomain(j === d ? null : nodeName(j)) })), x, y, W, bottom - 220, { px: 20, h: 42 }) + 18;
  if (d < 0) { textBlock(ctx, 'Or point at a domain on the section or a node of the network and pull the trigger (or pinch).', x, y, W, 24, 34, VC.muted, 400, 2); return; }
  ctx.fillStyle = VC.line; ctx.fillRect(x, y, W, 2); y += 14;
  swatch(ctx, x, y + 10, 26, domCol(X.domain));
  y += textBlock(ctx, cap(X.domain), x + 40, y + 2, W - 40, 34, 42, VC.ink, 700, 1) + 6;
  const org = td >= 0 ? MD.typeOrgans(td) : [];
  y += textBlock(ctx, td >= 0 ? `Tissue type: ${nodeName(td)}. ${org.length} organs have ${nodeName(td)}; the network does not say which of them have this domain: ${listOf(org.map(o => o.name))}.` : 'Tissue type: –.', x, y, W, 22, 30, VC.muted, 400, clamp(Math.floor((bottom - y - 70) / 30), 3, 5)) + 10;   // (the organs' list as far as there is room)
  const si = slideIdx(X.domain);
  flow(ctx, P, [{ id: 'sh:net', label: 'In the network', on: X.scene === 'hier', fn: () => showView('hier', VIEW.net) }].concat(si ? [{ id: 'sh:slide', label: 'On the section', on: X.scene === 'slide', fn: () => showView('slide', VIEW.sAge) }] : []), x, y, W, bottom, { px: 22, h: 50 });
}
function drawAgePane(ctx, P, x, y, W, bottom) {
  const F = FACTS, e = exOn(), exCol = ['#ff9ec4', '#ffd166', '#c77dff'];
  y += textBlock(ctx, `Age is the strongest of ${F.donorVars} things known about the donors. ${pct(F.ageChange)} of domains change with it, mostly by less than ${pct(F.mostUnder)} per decade.`, x, y, W, 24, 33, VC.muted, 400, 3) + 12;
  y += head(ctx, x, y, 'Worked examples');
  y += flow(ctx, P, F.ex.map((q, i) => ({ id: 'ex:' + i, label: exName(q), col: exCol[i], on: e === i, fn: () => showExample(i) })), x, y, W, bottom, { px: 22, h: 50 }) + 10;
  if (e >= 0) y += textBlock(ctx, cap(exText(F.ex[e])) + '.', x, y, W, 23, 32, VC.ink, 400, 3) + 10;
  y += drawAge(ctx, P, x, y, W) + 14;
  y += head(ctx, x, y, 'Across the body');
  y += flow(ctx, P, [{ id: 'v:volcano', label: 'What changes', on: X.scene === 'atlas' && viewIs('atlas', VIEW.volcano), fn: () => showView('atlas', VIEW.volcano) },
    { id: 'v:curves', label: 'Pathology', on: X.scene === 'atlas' && viewIs('atlas', VIEW.curves), fn: () => showView('atlas', VIEW.curves) },
    { id: 'v:contacts', label: 'Contacts', on: X.scene === 'hier' && viewIs('hier', VIEW.contacts), fn: () => showView('hier', VIEW.contacts) }], x, y, W, bottom, { px: 22, h: 50 }) + 16;
  if (y + 70 < bottom) textBlock(ctx, `${F.connective} ${F.most}`, x, y, W, 21, 29, VC.faint, 400, 3);
}
function drawMethodPane(ctx, P, x, y, W, bottom) {
  const F = FACTS, s = STEPS[X.step - 1];
  y += textBlock(ctx, `How ${F.method} finds domains in ${fmt(F.slides)} slides without being told what to look for, in four steps.`, x, y, W, 24, 33, VC.muted, 400, 2) + 14;
  const sw = (W - 3 * 12) / 4;
  STEPS.forEach(([n], i) => vButton(ctx, P, 'step:' + i, x + i * (sw + 12), y, sw, 60, `${i + 1} · ${n}`, () => setStep(i + 1), { on: X.step === i + 1 && X.scene === 'slide', px: 22 }));
  y += 84;
  y += textBlock(ctx, `${X.step} · ${s[0]}`, x, y, W, 38, 46, VC.ink, 700, 1) + 6;
  y += textBlock(ctx, s[2](), x, y, W, 27, 38, VC.ink, 400, 4) + 18;
  if (X.step > 1) vButton(ctx, P, 'step:back', x, y, 160, 56, 'Back', () => setStep(X.step - 1), { px: 23 });
  if (X.step < STEPS.length) vButton(ctx, P, 'step:next', x + 172, y, 160, 56, 'Next', () => setStep(X.step + 1), { px: 23 });
  y += 80;
  y += head(ctx, x, y, 'Then');
  y += flow(ctx, P, [{ id: 'v:umap', label: 'The tiles in one map', on: X.scene === 'atlas' && viewIs('atlas', VIEW.umap), fn: () => showView('atlas', VIEW.umap) },
    { id: 'v:map', label: 'The atlas', on: X.scene === 'atlas' && viewIs('atlas', VIEW.map), fn: () => showView('atlas', VIEW.map) }], x, y, W, bottom, { px: 22, h: 50 }) + 18;
  if (y + 70 < bottom) textBlock(ctx, `It agrees with pathologists' notes: salivary gland r = ${F.bench.salivary.r}, stomach mucosa r = ${F.bench.stomach.r} (1 would be perfect). The result: ${F.domains} domains of ${F.types} types.`, x, y, W, 21, 29, VC.faint, 400, 3);
}
// the four scenes, and the chosen scene's own controls (and the age, where the scene shows it)
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12 * (SCENES.length - 1)) / SCENES.length;
  SCENES.forEach(([k, n], j) => vButton(ctx, P, 'scene:' + k, x + j * (cw + 12), y, cw, 56, SCENE_SHORT[k] || n, () => openScene(k), { on: X.scene === k, px: 22 }));
  y += 76;
  const sc = SCENES.find(s => s[0] === X.scene);
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c))) {
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  if (ageHere() && y + 70 < bottom) drawAge(ctx, P, x, y, W);
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + X.turn;
}
function drawFoot(ctx, P) {
  if (APP.mode === 'story') {
    const playing = APP.playing, bx = 28, by = 40;
    vButton(ctx, P, 'play', bx, by, 96, 96, '', () => APP.togglePlay(), { r: 48 });
    ctx.fillStyle = VC.ink;
    if (playing) { ctx.fillRect(bx + 34, by + 30, 10, 36); ctx.fillRect(bx + 52, by + 30, 10, 36); }
    else { ctx.beginPath(); ctx.moveTo(bx + 38, by + 26); ctx.lineTo(bx + 38, by + 70); ctx.lineTo(bx + 72, by + 48); ctx.closePath(); ctx.fill(); }
    const t = APP.t, ci = Math.max(0, CH.findIndex(c => t >= c.na && t < c.nb));
    const tri = (cx, cy, dir) => { ctx.beginPath(); ctx.moveTo(cx - 9 * dir, cy - 13); ctx.lineTo(cx - 9 * dir, cy + 13); ctx.lineTo(cx + 9 * dir, cy); ctx.closePath(); ctx.fill(); };
    vButton(ctx, P, 'prev', 140, 52, 78, 72, '', () => APP.seek(t > CH[ci].na + 2 || ci === 0 ? CH[ci].na : CH[ci - 1].na));
    ctx.fillStyle = VC.ink; tri(171, 88, -1); ctx.fillRect(184, 75, 5, 26);
    vButton(ctx, P, 'next', 228, 52, 78, 72, '', () => APP.seek(ci < CH.length - 1 ? CH[ci + 1].na : T_END - 0.01));
    ctx.fillStyle = VC.ink; tri(262, 88, 1); ctx.fillRect(271, 75, 5, 26);
    const x0 = 344, x1 = P.w - 40, ty = 100;
    const m = s => Math.floor(s / 60) + ':' + String(Math.floor(s % 60)).padStart(2, '0');
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(m(t) + ' / ' + m(T_END), x1, 44); ctx.textAlign = 'left';
    // this story's Slideshow switch, left of the clock (placed for the longest clock, so it never shifts)
    const sx = x1 - ctx.measureText(m(T_END) + ' / ' + m(T_END)).width - 220;
    if (HOST.slides) vButton(ctx, P, 'slides', sx, 26, 198, 42, 'Slideshow: ' + (slidesOn() ? 'on' : 'off'), slideToggle, { on: slidesOn(), px: 20 });
    // slideshow: waiting at the end of a chapter, Next in the place of the chapter's name (the panel above has it)
    if (SLIDE.at >= 0) vButton(ctx, P, 'slideNext', x0, 16, 180, 48, 'Next', slideNext, { primary: true, px: 28 });
    else { ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, CH[ci].name, (HOST.slides ? sx : x1 - 160) - 16 - x0), x0, 40); }
    rr(ctx, x0, ty, x1 - x0, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.28)'; ctx.fill();
    rr(ctx, x0, ty, (x1 - x0) * t / T_END, 6, 3); ctx.fillStyle = VC.cyan; ctx.fill();
    ctx.fillStyle = 'rgba(160,178,202,0.6)';
    for (const c of CH.slice(1)) ctx.fillRect(x0 + (x1 - x0) * c.na / T_END - 1, ty - 8, 2, 22);
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t / T_END, ty + 3, P.hover === 'track' ? 16 : 13, 0, 7); ctx.fillStyle = VC.cyan; ctx.fill();
    P.regions.push({ id: 'track', x: x0 - 10, y: 66, w: x1 - x0 + 20, h: 80, drag: px => APP.seek(clamp((px - x0) / (x1 - x0), 0, 1) * T_END) });
    return;
  }
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Turn', 28, 58);
  vButton(ctx, P, 'turn:on', 100, 40, 90, 56, 'On', () => setTurn('on'), { on: X.turn === 'on', px: 22 });
  vButton(ctx, P, 'turn:off', 198, 40, 90, 56, 'Off', () => setTurn('off'), { on: X.turn === 'off', px: 22 });
  ctx.fillText('Zoom', 330, 58);
  vButton(ctx, P, 'z-', 404, 40, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', 466, 40, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
  vButton(ctx, P, 'home', 560, 40, 230, 56, 'Whole scene', () => flyTo(view(X.scene, 'default')), { px: 22 });
}


// ------------------------------------------------------------- narration --
// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 at audio/narration-micro.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-micro.mp3', {
    // a recording longer than the story stretches the timeline
    ready(d) {
      if (d + 1 <= T_END) return;
      T_END = d + 1;
      document.querySelectorAll('#track .tick, #track .name').forEach(el => {
        const c = C[el.dataset.k]; if (c) el.style.left = (100 * c.na / T_END).toFixed(2) + '%';
      });
      $('#track').setAttribute('aria-valuemax', Math.round(T_END)); lastTick = -1;
    },
    error() { xrMsg('The narration file could not be played. Export it as a standard MP3 and upload it again.'); },
  });
  // react at once to play/pause, seeks, chapter jumps and mode changes
  for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {
    const f = APP[name];
    APP[name] = function (...args) { const r = f.apply(APP, args); AUD.seeked(); audioSync(); return r; };
  }
}
// the narration plays while the story plays (at a slideshow stop, a voice may finish its chapter: slideSound)
function audioSync() { if (AUD) AUD.sync(...slideSound()); }
// while it plays, the narration is the clock: the story follows it
function audioFollow() { if (AUD && !SLIDE.tail) APP.t = AUD.follow(APP.t); }
function audioLabel() { return AUD ? AUD.label() : ''; }
function audioToggle() { HOST.audio.toggle(); }

// ------------------------------------------------------------- slideshow --
// Slideshow (HOST.slides: on for this story, or for all): the story waits at the end of each chapter, all its text
// shown, until Next (or Play) goes on. The stop is a pause and a seek, Next a play, so in a shared room they reach
// the station's clock like a pause and a play by hand, at the same t on every device.
const SLIDE = { at: -1, go: -1, last: 0, lt: 0, lp: false, tail: null };
const slidesOn = () => !!(HOST.slides && HOST.slides.on(XR_HERE));
// where chapter i waits: just before its text starts to fade out (0.65 s before its end in story time), on the
// recording's clock; the same on every device
const slideStop = i => narrT(CH[i].b - 0.7);
// a chapter's last words can run on past that point (the airports' by up to 2.4 s): a story with a recording says
// where each chapter's voice ends in it (NARRATION_ENDS, seconds by chapter key), and the voice finishes there while
// the story waits (slideSound); a story without one pauses the narration with the clock
const slideVoice = i => (typeof NARRATION_ENDS === 'object' && +NARRATION_ENDS[CH[i].key]) || 0;
// every frame, once the clock has moved on from t0: crossing a stop while playing stops there, and a story paused just
// now, while playing up to 0.25 s before a stop (a room's pause lands that close), waits at it too (SLIDE.at, which
// shows Next); a clock put near a stop while paused (a scrub) stays where it was put, unless right on it. In a shared
// room the station's clock also moves a playing story on between frames (catching up): a step since the last frame
// no longer than the time that passed (and the room's 0.25 s drift) counts as playing on too; a jump does not
function slideStep(t0) {
  const was = SLIDE.at, now = performance.now(), st = HOST.collab && HOST.collab.live && HOST.collab.live();
  const from = st && st.story === XR_HERE && SLIDE.lp && APP.t >= SLIDE.last && APP.t - SLIDE.last < (now - SLIDE.lt) / 1000 + 0.35 ? SLIDE.last : t0;
  SLIDE.at = -1;
  if (slidesOn() && APP.mode === 'story') {
    for (let i = 0; i < CH.length; i++) {
      const s = slideStop(i);
      if (APP.playing && i !== SLIDE.go && from < s && APP.t >= s) { slideTail(i, APP.t); APP.playing = false; APP.seek(s); }
      else if (!APP.playing && SLIDE.lp && APP.t >= s - 0.25 && APP.t < s) slideTail(i, APP.t);
      else if (APP.playing || Math.abs(APP.t - s) > 0.002) continue;
      APP.t = s; SLIDE.at = i; break;
    }
    // gone on from a stop: it stays passed while the clock is near it (the narration may pull the clock back a hair)
    if (was >= 0 && APP.playing) SLIDE.go = was;
    else if (SLIDE.go >= 0 && Math.abs(APP.t - slideStop(SLIDE.go)) > 1) SLIDE.go = -1;
  } else SLIDE.go = -1;
  // a voice finishing its chapter: done once the story is back where the voice ended, or elsewhere
  const T = SLIDE.tail;
  if (T && (APP.mode !== 'story' || HOST.picking || APP.t < T.s - 0.01 || APP.t >= T.v)) SLIDE.tail = null;
  SLIDE.last = APP.t; SLIDE.lt = now; SLIDE.lp = APP.mode === 'story' && APP.playing;
}
// at the stop of chapter i the voice plays on from where the sound is (the story's clock, t, can lag it) to where the
// chapter's words end; a sound already past them stops there, and keeps quiet until the story is back there
function slideTail(i, t) {
  const p = AUD && AUD.pos ? AUD.pos() : null, e = slideVoice(i);
  // (only a sound that is with the story: right after a jump it still says where it was before)
  const near = p !== null && Math.abs(p - t) < 1.5;
  if (near) t = p;
  SLIDE.tail = e > t || near ? { s: slideStop(i), v: Math.max(e, t), t, at: performance.now() } : null;
}
// what the narration plays (audioSync): the story's clock while it plays; while a voice finishes its chapter, its own
// clock up to the chapter's voice end, then nothing until the story, gone on from the stop, is back there. So nothing
// is cut or said twice, and the story does not follow the voice meanwhile (audioFollow)
function slideSound() {
  const T = SLIDE.tail, v = T ? T.t + (performance.now() - T.at) / 1000 : 0;
  return T ? [APP.mode === 'story' && v < T.v, Math.min(v, T.v)] : [APP.mode === 'story' && APP.playing, APP.t];
}
function slideNext() { if (SLIDE.at >= 0) APP.togglePlay(); }
function slideToggle() { if (HOST.slides) HOST.slides.set(XR_HERE, !slidesOn()); }
const slideSig = () => (HOST.slides ? HOST.slides.sig() : '') + SLIDE.at;
// the page: Next while the story waits (index.html's row at the foot of the panel, brought into sight as far as the
// chapter's top allows; on a phone, beside Play in the bar instead) and the switch
function slideDOM() {
  const row = $('#slides');
  if (!row || !HOST.slides) return;
  const on = slidesOn(), s = SLIDE.at + '' + on, nb = $('#btnNext'), bar = $('#btnNextBar');
  if (row.dataset.s === s) return;
  row.dataset.s = s; row.hidden = false;
  nb.hidden = SLIDE.at < 0;
  if (bar) bar.hidden = SLIDE.at < 0;
  const b = $('#btnSlides');
  b.textContent = 'Slideshow: ' + (on ? 'on' : 'off'); b.setAttribute('aria-pressed', on ? 'true' : 'false');
  if (SLIDE.at < 0 || !nb.offsetParent) return;
  const p = $('#panel'), r = p.getBoundingClientRect(), cs = getComputedStyle(p), sec = $('#story .ch.on');
  const over = Math.min(row.getBoundingClientRect().bottom - (r.bottom - parseFloat(cs.paddingBottom)), sec ? sec.getBoundingClientRect().top - r.top - parseFloat(cs.paddingTop) : 0);
  if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
}

// ================================================================== APP ==
const APP = {
  mode: 'story', t: 0, playing: true,
  seek(t) { this.t = clamp(t, 0, T_END - 0.01); if (this.mode !== 'story') this.enterStory(this.t); },
  togglePlay() { if (this.mode !== 'story') return; if (this.t >= T_END - 0.05) this.t = 0; this.playing = !this.playing; },
  enterExplore() {
    if (this.mode === 'explore') return;
    this.mode = 'explore';
    document.body.classList.add('exploring');
    $('#btnMode').textContent = 'Replay story';
    // carry on from what the story shows: its look, its camera, its scene
    const ts = storyT(this.t), S = storyState(ts);
    for (const n in DEF) XS[n] = S[n];
    // (the set on show, or the one about to come: a short fade between two of the same set's views shows none)
    const S2 = storyState(Math.min(ts + 1.5, T_END));
    let best = 'atlas', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
    if (best === 'tissue') best = 'slide';   // (the section is shown with the slide)
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(0, 6), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
    X.scene = best; X.t0 = performance.now();
    // and pick the scene's controls that come closest to what the story was showing
    const s = GL.sets[best];
    X.ctl[best] = {};
    for (const ct of ctlsOf(best)) {
      let bo = ct.options[0][0], bd = Infinity;
      for (const [v] of ct.options) {
        const c = { t: 1e3 };
        for (const c2 of s.controls || []) c[c2.key] = c2 === ct ? v : isAge(c2) ? ageOpt(c2) : ctlValue(best, c2);
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a') && !/_age$|_focus$/.test(n)) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    // (a set that remembers what it showed last is told the chosen controls, long settled, twice)
    if (s.explore) { const c = { t: 1e3 }; for (const c2 of s.controls || []) c[c2.key] = isAge(c2) ? ageOpt(c2) : ctlValue(best, c2); s.explore(c); s.explore(c); }
    // the story's picks carry over to the panes: the section's domain, the atlas's tissue, the age
    X.organ = null; X.domain = null; X.kind = null;
    const ag = best === 'atlas' ? S.atlas_age : best === 'slide' ? S.slide_age : best === 'hier' ? S.hier_age : 0;
    X.age = Math.round(AGE0 + clamp(ag || 0, 0, 1) * (AGE1 - AGE0));
    if (best === 'atlas' && S.atlas_focus > 0.5 && S.atlas_map > 0.5) { const t = (api('atlas').tissues || [])[Math.round(S.atlas_focus) - 1]; if (t && organOf(t)) X.organ = t; }
    if (best === 'slide' && S.slide_focus > 0.5) { const d = slideDomain(Math.round(S.slide_focus) - 1); if (d) X.domain = d; }
    if (best === 'hier' && S.hier_focus > -0.5) { const n = (api('hier').nodes || [])[Math.round(S.hier_focus)]; if (n && n.level === 2) X.kind = n.name; }
    // (the section's domains as the story showed them: at an age, or by themselves)
    if (best === 'slide' && S.slide_domain > 0.5) { const v = optKey('slide', 'view', S.slide_age > 0.02 ? VIEW.sAge : /domain/i); if (v) X.ctl.slide.view = v; }
    if (best === 'slide') { const i = STEPS.findIndex(q => viewIs('slide', q[1])); if (i >= 0) X.step = i + 1; }
    X.tab = best === 'slide' ? (viewIs('slide', /age/i) ? 'age' : viewIs('slide', /domain/i) ? 'domains' : 'method')
      : best === 'atlas' ? (X.organ && exOn() >= 0 || viewIs('atlas', VIEW.volcano) || viewIs('atlas', VIEW.curves) ? 'age' : viewIs('atlas', VIEW.umap) ? 'method' : 'organs')
      : best === 'hier' ? (viewIs('hier', VIEW.contacts) ? 'age' : 'domains') : 'organs';
    // from the last chapter (the story's end, or its Explore button): the atlas, in the Organs tab
    if (ts >= C.next.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no picked organ or domain
    X.organ = null; X.domain = null; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the atlas, a section per tissue, in the Organs tab
function openStart() {
  openScene('atlas', false);
  const v = optKey('atlas', 'view', VIEW.map);
  if (v) (X.ctl.atlas = X.ctl.atlas || {}).view = v;
  X.tab = 'organs'; showTab('organs');
  orbit.cur = view('atlas', viewCam('atlas') || 'default'); orbit.to = null;
  renderAll();
}

let lastNow = 0;
const EXV = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0];   // explore's view for applyCamera: orbit.cur, then FIT's eased shift
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  let S, tSet;
  const t0 = APP.t;
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  // the end: Repeat (shell) starts this story or the next one again, else explore mode opens
  if (APP.mode === 'story' && APP.playing && APP.t >= T_END) { APP.t = T_END; if (HOST.ended()) APP.playing = false; else APP.enterExplore(); }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    const v = storyCam(ts);
    GL.nf = v[6];
    if (xr) xrPlace(v); else { applyCamera(v); keepCamera(S, ts); }
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    // (a wide view stands further back on a phone held upright, and its target's shift clear of the side panel, FIT,
    // goes back where there is none: both eased as the views change)
    const vn = viewCam(X.scene) || 'default', fs = fitShift(X.scene, vn), ke = 1 - Math.exp(-dt * 3);
    GL.nf += (narrowOf(X.scene, vn) - GL.nf) * ke;
    for (let i = 0; i < 3; i++) EXV[7 + i] += (fs[i] - EXV[7 + i]) * ke;
    orbitStep(xr ? pn : now);
    for (let i = 0; i < 6; i++) EXV[i] = orbit.cur[i];
    if (xr) xrPlace(orbit.cur); else { applyCamera(EXV); keepCamera(S, null); }
  }
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  // what explore mode asked to do once the sets show its pick (a flight to an organ's point)
  if (NEXT.length) { const fs = NEXT.splice(0); if (APP.mode === 'explore') for (const f of fs) f(); }
  if (xr) xrUpdate(S);
  GL.renderer.render(GL.scene, GL.camera);
  if (!xr) {
    GL.world.updateMatrixWorld(true);
    if (APP.mode === 'story') placeLabels(LBL.storyAll, L => (L.kind === 'story' ? fadeVal(ts, L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0) : setLabelAlpha(L, S)));
    else placeLabels(LBL.exploreAll(), L => (L.kind === 'set' ? setLabelAlpha(L, S) : 1));
  }
  window.__frames = (window.__frames || 0) + 1;
}
function applyTheme() {
  if (!GL.renderer) return;
  if (XR.on && !XR.clear) GL.renderer.setClearColor(0x000000, 0); // passthrough AR shows the room
  else GL.renderer.setClearColor(new THREE.Color(css('--scene') || '#040912'), 1);
}
function init() {
  try {
    buildScene($('#gl'));
  } catch (err) {
    console.error(err);
    $('#nogl').style.display = 'grid';
    $('#loading').classList.add('gone');
    return;
  }
  resize();
  window.addEventListener('resize', resize);
  buildDefaults(); Object.assign(XS, DEF);
  // compile every set's shaders now, so a scene's first appearance does not stall the story
  try {
    for (const k of SET_ORDER) GL.sets[k].group.visible = true;
    GL.renderer.compile(GL.scene, GL.camera);
  } catch (e) { /* compiled on first use instead */ }
  for (const k of SET_ORDER) GL.sets[k].setAlpha(0);
  buildStory(); buildSetLabels(); buildTimeline(); buildExplore(); bindCanvas(); audioInit(); xrSetup();
  LBL.storyAll = ST.labels.concat(LBL.sets);
  LBL.exploreAll = () => LBL.sets.concat(LBL.extra);
  applyTheme();
  matchMedia('(prefers-color-scheme: dark)').addEventListener('change', applyTheme);
  (GL.mo = new MutationObserver(applyTheme)).observe(document.documentElement, { attributes: true, attributeFilter: ['data-theme'] });
  $('#btnMode').addEventListener('click', () => (APP.mode === 'story' ? APP.enterExplore() : APP.enterStory(0)));
  document.addEventListener('click', ev => { if (ev.target.id === 'btnGoExplore') APP.enterExplore(); });
  document.addEventListener('keydown', ev => {
    if (ev.target.closest('input, textarea')) return;
    if (ev.key === ' ' && APP.mode === 'story' && !ev.target.closest('button')) { APP.togglePlay(); ev.preventDefault(); }
  });
  APP.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the start screen pauses the story; picking this story again starts it from the top
  if (HOST.picking) APP.playing = false;
  window.addEventListener('storypause', () => { APP.playing = false; });
  window.addEventListener('storyrestart', () => { APP.enterStory(0); APP.playing = true; });
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.has('t')) { APP.t = clamp(parseFloat(hp.get('t')) || 0, 0, T_END - 0.01); APP.playing = false; }
  if (hp.has('explore')) {
    APP.enterExplore();
    // #micro&explore&scene=atlas&view=volcano (any control of a scene by its key, or an option by its name or camera),
    // &tab=organs|domains|age|method|scenes, &organ=Ovary (an organ or one of its GTEx tissues), &domain=submucosa,
    // &age=70, &step=2 (the method's step), &example=0 (a worked example of change with age)
    const sc = hp.get('scene');
    if (sc && GL.sets[sc]) { openScene(sc, false); showTab('scenes'); }
    else if (!hp.has('t')) openStart();   // straight in: the atlas
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    for (const c of ctlsOf(X.scene)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q || camFor(X.scene, v) === q || (CAM_ALIAS[X.scene] || {})[v] === q);
      if (o) setCtl(X.scene, c.key, o[0]);
    }
    if (organOf(hp.get('organ'))) { showTab('organs'); selectOrgan(hp.get('organ')); }
    if (hp.get('domain') && MD.domain(hp.get('domain')) >= 0) { showTab('domains'); selectDomain(hp.get('domain')); }
    if (hp.get('example') !== null && FACTS.ex[+hp.get('example')]) { showTab('age'); showExample(+hp.get('example')); }
    if (hp.get('age') && Number.isFinite(+hp.get('age'))) setAge(+hp.get('age'));
    if (hp.get('step') && Number.isFinite(+hp.get('step'))) { showTab('method'); setStep(+hp.get('step')); }
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) {
      if (sc || hp.get('organ') || hp.get('domain') || hp.get('step')) showTab(hp.get('tab')); else pickTab(hp.get('tab'));
    }
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
    renderAll();
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  setTimeout(() => $('#loading').classList.add('gone'), 120);
}
const initT = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: XR.panelGroup.rotation.y } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the explore panes, and there are no effects
  collab: {
    APP, scene: () => GL.scene, state: collabState, apply: collabApply, view: collabView, setView: collabSetView,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw) { XR.panelGroup.position.fromArray(p); XR.panelGroup.rotation.set(0, yaw, 0); },
    place(o, s) { XR.globeOff.fromArray(o); XR.size = s; },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    clearTimeout(initT); clearTimeout(xrMsg.t);
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
