// The mutation machine: DNA's changes as a quantum circuit. DNA as a text in four letters, copied with mutations; a
// family tree in 3D whose branches are as long as the change along them; each letter in two qubits; a rule of change
// (a substitution model) as a path through a pyramid of mixes; the compiler that turns it into a machine of gears, one
// per branch (the copy, the turn and the circuit); letters that work together in an RNA stem, and the coupling that
// keeps their pairs; and the ancestor of three species rebuilt three ways. After the poster "Converting Mutation into a
// Machinery: DNA Substitution Models as Quantum Circuits" by Enes Berk Sakalli and Arndt von Haeseler (a draft of 26 Oct
// 2026) and Enes's answers to our questions. The numbers drawn are examples, computed here (MMATH), as in the authors'
// own test; the poster's own numbers (MUT_DATA) appear only where the story says "in the authors' test".
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/mutation/build.mjs from the tour's kit and the maths, data, look, sets and engine parts in
// tools/mutation: edit those, not this file.
HOST.register('mutation', function (HOST) {
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
// MMATH (the maths, computed live from example numbers), MUT_DATA (the poster's numbers, typed in) and MLOOK (the
// story's lit tubes, rings, balls, tiles, qubits and gears) come first, then the sets: letters, tree, rule, stem.
const SETS = {};
// MMATH: the maths of the mutation story, computed live from example numbers, as in the authors' own test (Enes Berk
// Sakalli: "for a test of the method these example numbers are fine, but for a real result they should be estimated
// from real sequences"). The poster's own numbers are MUT_DATA (sets/data.js); the story shows them only as "in the
// authors' test".
// Plain script: in stories/mutation.js it is pasted inside the story's closure before MUT_DATA (the build drops the
// module line at the end), so it reads MUT_DATA only when a function is called, never while it loads; in Node,
// require() or import it (tools/mutation/test-mmath.mjs checks it), with a copy of the few poster's facts it needs.
//
// What it does, in the order of the story:
// - letters are indices 0..3 for A, C, G, T; a letter's two qubits are its two bits, the first qubit the high bit
//   (A |00>, C |01>, G |10>, T |11>, as on the poster);
// - substitution models (GTR, and two simpler ones): the rate matrix Q, scaled so the mean rate is 1 (a branch length
//   is then the expected number of swaps per letter), and P(t) = e^(Qt) from the symmetric eigen-decomposition of
//   Pi^(1/2) Q Pi^(-1/2) (Jacobi); the mix along a path, and its point in the pyramid of mixes;
// - the two qubits of a mix (amplitudes, Bloch vectors from the reduced density matrices, seeded read-outs);
// - the circuit for one branch: a copy (two CNOTs) and a turn (two uniformly controlled RY rotations whose angles come
//   from P(t)), its decomposition into single-qubit RY turns and CNOTs (the Gray-code construction), and a small
//   state-vector simulator that checks it gives row `parent` of P(t);
// - the family tree in 3D, with every mutation simulated exactly under the model, and the poster's species tree;
// - pairs of letters: a reversible 16-state pair model, its P(t), the independent and the coupled stand-in, and the
//   rebuild of the ancestral stem by Felsenstein's pruning, sampled.
//
// The example values, and why. They were chosen so the example tells the poster's story in the same direction (the
// order letter by letter < exact < coupled is designed in, as the SPEC asks); none was tuned to hit its numbers:
// - the story's model ('uneven', GTR): exchangeabilities AC 1.0, AG 3.6, AT 0.7, CG 1.1, CT 4.2, GT 0.9: transitions
//   (A<->G, C<->T) swap several times as readily as the other swaps, as in real DNA; long-run shares A 0.32, C 0.18,
//   G 0.24, T 0.26: A the most common, as on the poster's picture of the pyramid. 'even' (JC69) and 'transitions'
//   (K80, kappa 4) are the textbook simpler rules.
// - the path: T_PATH = 1.6 swaps per letter, points 1 to 3 at 0.15, 0.45 and 1.0. From corner A the story's mix has
//   come about 17 %, 41 % and 65 % of the way to the long-run mix at the three points and 78 % at T_PATH (even the
//   simplest rule leaves 13 % at 1.6; the slow part here is purines against pyrimidines, as those swaps are rarer).
// - the family tree: branch lengths seeded between 0.15 and 0.45 swaps per letter for the first split, 0.1 and 0.5 for
//   the second and 0.05 and 0.6 for the tips, so the crown is about as tall as it is wide.
// - the species tree ((s1, s2), s3): root to n1 0.25, n1 to s1 0.2, n1 to s2 0.3, root to s3 0.45: long enough for the
//   1 to 5 changed letters (of 12) that set the species apart from the true ancestor in Figure 5, short enough that
//   the stem is still recognisably one stem.
// - the pair model: w = 8, the poster's (matching pairs eight times as likely); both letters changing at once at a
//   tenth of the product of their single rates (dbl = 0.1: rare, but allowed, as the poster says).
// - the coupled circuit: the poster does not give its parts in detail, so Pcoupled is OUR STAND-IN for it (the story
//   says so wherever it shows): the independent turn, then a step that weights every resulting pair by w if it matches
//   and renormalises, on every branch however short. Its root's prior is our choice too: its own long-run mix (where
//   its machine settles, branch after branch, at the tree's mean branch length), which favours pairs more than the
//   exact model's (94 % of pairs matching against 83 %). We kept it because that makes the stand-in favour pairs too
//   strongly, as the authors found of theirs, and so keeps the poster's order: with the exact model's mix as its prior
//   it would rebuild hardly more intact ancestors than letter by letter (12 % against 11 %) and far fewer than the
//   exact model (31 %), since each branch's weighting makes the species' broken pairs unlikely from a matching root.
// In this example (the story's model, w = 8) the exact chance that all six pairs of the rebuilt ancestor match is about
// 11 % letter by letter, 31 % with the exact pair model and 45 % with the coupled stand-in (2,000 sampled with seed 1:
// 10.9 %, 30.0 % and 46.1 %), and the long-run chance that all six match (allSixPrior) is about a third (0.33). The
// poster's test gives 10 %, 20 % and 43 %, and about a quarter. That the stand-in's 45 % lands near the authors' 43 %
// is chance: only its place above the exact model was chosen, no value was fitted to its size, and the story shows the
// poster's numbers only as the poster's.
const MMATH = (() => {
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
  // a number in [0, 1) from two integers, the same on every device (a read-out by index, a site's own stream)
  function hash(a, b) {
    let t = (Math.imul(a | 0, 0x9E3779B1) ^ Math.imul((b | 0) + 0x632BE5AB, 0x85EBCA77)) + 0x6D2B79F5 | 0;
    t = Math.imul(t ^ (t >>> 15), 1 | t);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const seedOf = (a, b) => Math.floor(hash(a, b) * 4294967296) | 0;
  const pop = v => { let c = 0; while (v) { v &= v - 1; c++; } return c; };
  const shuffle = (a, r) => { for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };

  // the poster's facts: MUT_DATA when it is loaded (read at call time: in the story it is pasted after this file),
  // else this copy of what the maths needs (the test checks the two agree)
  const COPY = {
    fig1: { ancestor: 'ACGTTAGC' },
    test: {
      species: { s1: { top: 'ATTACT', bottom: 'CGATAG' }, s2: { top: 'ATTACT', bottom: 'CTTTGA' }, s3: { top: 'GTTACT', bottom: 'TGAGGC' } },
      n: 2000, pairs: 6, w: 8,
    },
  };
  function data() {
    try { return typeof MUT_DATA !== 'undefined' ? MUT_DATA : COPY; } catch (e) { return COPY; }   // (not yet initialised)
  }

  // ------------------------------------------------------------------ letters
  const LETTERS = 'ACGT';
  const CODES = ['00', '01', '10', '11'];
  const KETS = CODES.map(c => `|${c}⟩`);
  const idx = ch => LETTERS.indexOf(ch);
  const bits = i => [i >> 1, i & 1];                     // [first qubit, second qubit]
  const toIdx = s => Uint8Array.from(s, idx);
  const toStr = a => Array.from(a, i => LETTERS[i]).join('');

  // ------------------------------------------------------------------ linear algebra
  // eigen-decomposition of a symmetric n x n matrix by cyclic Jacobi rotations: { vals, vecs } with eigenvector k in
  // column k (vecs[i * n + k])
  function eigSym(A, n) {
    const a = Float64Array.from(A), v = new Float64Array(n * n);
    for (let i = 0; i < n; i++) v[i * n + i] = 1;
    for (let sweep = 0; sweep < 100; sweep++) {
      let off = 0;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) off += a[p * n + q] * a[p * n + q];
      if (off < 1e-32) break;
      for (let p = 0; p < n - 1; p++) for (let q = p + 1; q < n; q++) {
        const apq = a[p * n + q];
        if (Math.abs(apq) < 1e-300) continue;
        const th = (a[q * n + q] - a[p * n + p]) / (2 * apq);
        const t = (th >= 0 ? 1 : -1) / (Math.abs(th) + Math.sqrt(th * th + 1)), c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const kp = a[k * n + p], kq = a[k * n + q]; a[k * n + p] = c * kp - s * kq; a[k * n + q] = s * kp + c * kq; }
        for (let k = 0; k < n; k++) { const pk = a[p * n + k], qk = a[q * n + k]; a[p * n + k] = c * pk - s * qk; a[q * n + k] = s * pk + c * qk; }
        for (let k = 0; k < n; k++) { const kp = v[k * n + p], kq = v[k * n + q]; v[k * n + p] = c * kp - s * kq; v[k * n + q] = s * kp + c * kq; }
      }
    }
    const vals = new Float64Array(n);
    for (let i = 0; i < n; i++) vals[i] = a[i * n + i];
    return { vals, vecs: v };
  }
  // a reversible rate matrix Q (n x n, row to column) with long-run shares pi, ready for e^(Qt): S = Pi^(1/2) Q
  // Pi^(-1/2) is symmetric, S = V L V^T, so e^(Qt) = Pi^(-1/2) V e^(Lt) V^T Pi^(1/2) = U e^(Lt) W
  function prepRev(Q, pi, n) {
    const sq = Float64Array.from(pi, Math.sqrt), S = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) S[i * n + j] = sq[i] * Q[i * n + j] / sq[j];
    for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) S[i * n + j] = S[j * n + i] = (S[i * n + j] + S[j * n + i]) / 2;
    const { vals, vecs } = eigSym(S, n), U = new Float64Array(n * n), W = new Float64Array(n * n);
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) { U[i * n + k] = vecs[i * n + k] / sq[i]; W[k * n + i] = vecs[i * n + k] * sq[i]; }
    return { n, vals, U, W, ex: new Float64Array(n) };
  }
  // row r of e^(Qt) into out (from out[o]); exactly the identity at t = 0, never below 0 (rounding)
  function expRow(e, r, t, out, o = 0) {
    const n = e.n;
    if (!(t > 0)) { for (let j = 0; j < n; j++) out[o + j] = j === r ? 1 : 0; return out; }
    for (let k = 0; k < n; k++) e.ex[k] = Math.exp(e.vals[k] * t);
    for (let j = 0; j < n; j++) {
      let s = 0;
      for (let k = 0; k < n; k++) s += e.U[r * n + k] * e.ex[k] * e.W[k * n + j];
      out[o + j] = s > 0 ? s : 0;
    }
    return out;
  }
  function expAll(e, t, out) {
    const n = e.n;
    out = out || new Float64Array(n * n);
    for (let r = 0; r < n; r++) expRow(e, r, t, out, r * n);
    return out;
  }

  // ------------------------------------------------------------------ substitution models
  // r: exchangeabilities in the order AC, AG, AT, CG, CT, GT; pi: long-run shares of A, C, G, T
  const MODELS = [
    { key: 'even', name: 'All swaps alike', note: 'Every letter swaps for every other equally readily, and all four are equally common in the long run (JC69).',
      r: [1, 1, 1, 1, 1, 1], pi: [0.25, 0.25, 0.25, 0.25] },
    { key: 'transitions', name: 'A↔G and C↔T faster', note: 'A and G swap, and C and T swap, four times as readily as other pairs of letters; all four equally common in the long run (K80, κ = 4).',
      r: [1, 4, 1, 1, 4, 1], pi: [0.25, 0.25, 0.25, 0.25] },
    { key: 'uneven', name: 'The story\'s example', note: 'Each pair of letters swaps at its own rate, and the letters differ in how common they are in the long run (GTR). Example numbers.',
      r: [1.0, 3.6, 0.7, 1.1, 4.2, 0.9], pi: [0.32, 0.18, 0.24, 0.26] },
  ];
  const DEFAULT = 'uneven';
  const PAIRS6 = [[0, 1], [0, 2], [0, 3], [1, 2], [1, 3], [2, 3]];   // the order of r
  // a model by key, by index (0 even, 1 transitions, 2 uneven) or as an object ({ r, pi })
  function model(m) {
    if (m == null) m = DEFAULT;
    if (typeof m === 'number') return MODELS[m] || MODELS[2];
    if (typeof m === 'string') return MODELS.find(x => x.key === m) || MODELS[2];
    return m;
  }
  const prepCache = new Map(), objCache = new WeakMap();
  // per model: the scaled Q, its long-run shares, mu (the unscaled mean rate) and its eigen-decomposition
  function prep(m) {
    const mo = model(m), hit = mo.key ? prepCache.get(mo.key) : objCache.get(mo);
    if (hit) return hit;
    const ps = mo.pi.reduce((a, b) => a + b, 0), pi = Float64Array.from(mo.pi, v => v / ps), Qm = new Float64Array(16);
    PAIRS6.forEach(([i, j], k) => { Qm[i * 4 + j] = mo.r[k] * pi[j]; Qm[j * 4 + i] = mo.r[k] * pi[i]; });
    let mu = 0;
    for (let i = 0; i < 4; i++) { let s = 0; for (let j = 0; j < 4; j++) if (j !== i) s += Qm[i * 4 + j]; Qm[i * 5] = -s; mu += pi[i] * s; }
    for (let k = 0; k < 16; k++) Qm[k] /= mu;
    const e = { model: mo, Q: Qm, pi, mu, eig: prepRev(Qm, pi, 4) };
    if (mo.key) prepCache.set(mo.key, e); else objCache.set(mo, e);
    return e;
  }
  // the 4 x 4 rate matrix (row i to column j), mean rate sum pi_i (-Q_ii) = 1
  const Q = m => Float64Array.from(prep(m).Q);
  const pi = m => Float64Array.from(prep(m).pi);
  // P(t) = e^(Qt): the chance a letter i becomes j along a branch of length t
  const P = (m, t, out) => expAll(prep(m).eig, t, out);

  // ------------------------------------------------------------------ the path and the pyramid
  const T_PATH = 1.6, POINTS = [0.15, 0.45, 1.0];
  // the mix after t, starting from the pure letter `start` (row `start` of P(t)); per frame: give it out
  const path = (m, start, t, out) => expRow(prep(m).eig, start, t, out || new Float64Array(4));
  // a regular tetrahedron of edge 1.6 centred on the origin: A at the top, C front left, G at the back, T front right
  // (the story faces +z)
  const CORNERS = (() => {
    const E = 1.6, R = E * Math.sqrt(6) / 4, b = E / Math.sqrt(3), y = -R / 3;
    return [[0, R, 0], [-E / 2, y, b / 2], [0, y, -b], [E / 2, y, b / 2]];
  })();
  function simplex(p, out) {
    out = out || [0, 0, 0];
    out[0] = out[1] = out[2] = 0;
    for (let i = 0; i < 4; i++) for (let d = 0; d < 3; d++) out[d] += p[i] * CORNERS[i][d];
    return out;
  }

  // ------------------------------------------------------------------ qubits
  const amps = p => Array.from(p, v => Math.sqrt(Math.max(v, 0)));
  // the two qubits' Bloch vectors of the state sum sqrt(p_i) |i>: x, y, z of the first qubit, then of the second
  // (y is 0: the amplitudes are real; z +1 is 0, up; length 1 for a pure letter, shorter when the two depend on each
  // other)
  function bloch(p, out) {
    out = out || new Float64Array(6);
    const a0 = Math.sqrt(Math.max(p[0], 0)), a1 = Math.sqrt(Math.max(p[1], 0)), a2 = Math.sqrt(Math.max(p[2], 0)), a3 = Math.sqrt(Math.max(p[3], 0));
    const n = (a0 * a0 + a1 * a1 + a2 * a2 + a3 * a3) || 1;
    out[0] = 2 * (a0 * a2 + a1 * a3) / n; out[1] = 0; out[2] = (a0 * a0 + a1 * a1 - a2 * a2 - a3 * a3) / n;
    out[3] = 2 * (a0 * a1 + a2 * a3) / n; out[4] = 0; out[5] = (a0 * a0 + a2 * a2 - a1 * a1 - a3 * a3) / n;
    return out;
  }
  // the k-th read-out of the mix p (a letter index): the same on every device for the same seed and k
  function sample(p, seed, k) {
    const s = p[0] + p[1] + p[2] + p[3];
    let u = hash(seed, k) * s;
    for (let i = 0; i < 3; i++) { if (u < p[i]) return i; u -= p[i]; }
    return 3;
  }

  // ------------------------------------------------------------------ the circuit for one branch
  // wires top to bottom: the parent's two qubits p1, p0, the child's c1, c0; a basis state is 8 p1 + 4 p0 + 2 c1 + c0
  const WIRES = ['p1', 'p0', 'c1', 'c0'];
  const bitOf = w => 3 - WIRES.indexOf(w);
  // the RY angle that turns |b> into sqrt(a0)|0> + sqrt(a1)|1> (a0, a1 >= 0, up to a common factor; 0 when both are 0)
  const ryTo = (b, a0, a1) => (b ? -2 * Math.atan2(Math.sqrt(a0), Math.sqrt(a1)) : 2 * Math.atan2(Math.sqrt(a1), Math.sqrt(a0))) || 0;
  const P16 = new Float64Array(16), A12 = new Float64Array(12);
  // the turn's 12 angles at branch length t: [0..3] c1's by the parent's letter i, [4..11] c0's by 2 i + c1. After the
  // copy the child is |i>; these take it to sum_j sqrt(P_ij(t)) |j> with non-negative amplitudes: all 0 at t = 0
  function angles(m, t, out) {
    out = out || new Float64Array(12);
    const Pm = P(m, t, P16);
    for (let i = 0; i < 4; i++) {
      const r = i * 4, b1 = i >> 1, b0 = i & 1;
      out[i] = ryTo(b1, Pm[r] + Pm[r + 1], Pm[r + 2] + Pm[r + 3]);
      for (let c = 0; c < 2; c++) out[4 + 2 * i + c] = ryTo(b0, Pm[r + 2 * c], Pm[r + 2 * c + 1]);
    }
    return out;
  }
  // the circuit: the copy (two CNOTs), then the turn (two uniformly controlled RY rotations)
  function circuit(m, t) {
    const a = angles(m, t);
    return {
      wires: WIRES.slice(), t,
      gates: [
        { type: 'CNOT', part: 'copy', ctrl: 'p1', tgt: 'c1' },
        { type: 'CNOT', part: 'copy', ctrl: 'p0', tgt: 'c0' },
        { type: 'MRY', part: 'turn', tgt: 'c1', ctrls: ['p1', 'p0'], thetas: Array.from(a.subarray(0, 4)) },
        { type: 'MRY', part: 'turn', tgt: 'c0', ctrls: ['p1', 'p0', 'c1'], thetas: Array.from(a.subarray(4, 12)) },
      ],
    };
  }
  // a gate as single-qubit RY turns and CNOTs: a uniformly controlled RY with k controls becomes 2^k RY and 2^k CNOT
  // (the Gray-code construction): RY(alpha_j) then a CNOT from the control whose bit changes between gray(j) and
  // gray(j + 1), so control state x turns by sum_j (-1)^|x & gray(j)| alpha_j; alpha solves that for the thetas
  function decompose(g) {
    if (g.type !== 'MRY') return [Object.assign({}, g)];
    const k = g.ctrls.length, N = 1 << k, gray = j => j ^ (j >> 1), out = [];
    for (let j = 0; j < N; j++) {
      let a = 0;
      for (let x = 0; x < N; x++) a += (pop(x & gray(j)) & 1 ? -1 : 1) * g.thetas[x];
      out.push({ type: 'RY', part: g.part, tgt: g.tgt, theta: a / N });
      const d = gray(j) ^ gray((j + 1) % N);
      if (d) out.push({ type: 'CNOT', part: g.part, ctrl: g.ctrls[k - 1 - Math.log2(d)], tgt: g.tgt });
    }
    return out;
  }
  // runs gates on a 4-qubit state vector (real amplitudes: every gate here is real)
  function run(gates, st) {
    for (const g of gates) {
      const tb = 1 << bitOf(g.tgt);
      for (let s = 0; s < 16; s++) {
        if (s & tb) continue;
        const s1 = s | tb;
        if (g.type === 'CNOT') { if (s & (1 << bitOf(g.ctrl))) { const v = st[s]; st[s] = st[s1]; st[s1] = v; } continue; }
        let th = g.theta;
        if (g.type === 'MRY') { let x = 0; for (const c of g.ctrls) x = 2 * x + (s >> bitOf(c) & 1); th = g.thetas[x]; }
        const c = Math.cos(th / 2), sn = Math.sin(th / 2), v0 = st[s], v1 = st[s1];
        st[s] = c * v0 - sn * v1; st[s1] = sn * v0 + c * v1;
      }
    }
    return st;
  }
  // the child's read-out chances when the parent is the letter `parent`: a state-vector run of the circuit (simple:
  // of its decomposition); equals row `parent` of P(t)
  function simulate(m, t, parent, simple) {
    let gates = circuit(m, t).gates;
    if (simple) gates = gates.flatMap(decompose);
    const st = new Float64Array(16), out = new Float64Array(4);
    st[parent << 2] = 1;
    run(gates, st);
    for (let s = 0; s < 16; s++) out[s & 3] += st[s] * st[s];
    return out;
  }
  // one number for the gears: the mean |theta| of the turn, each c0 angle weighted by the share of the state it acts
  // on (in a plain mean the angles for the c1 value not yet reached would jump at t = 0+, though they act on nothing);
  // 0 at t = 0, growing with t
  function turnAngle(m, t) {
    const a = angles(m, t, A12), Pm = P16;
    let s = 0;
    for (let i = 0; i < 4; i++) {
      const r = i * 4, q0 = Pm[r] + Pm[r + 1], q1 = Pm[r + 2] + Pm[r + 3];
      s += (Math.abs(a[i]) + q0 * Math.abs(a[4 + 2 * i]) + q1 * Math.abs(a[5 + 2 * i])) / 2;
    }
    return s / 4;
  }

  // ------------------------------------------------------------------ trees
  // nodes { id, parent (-1 at the root), len (expected swaps per letter on the branch into it), kids, pos: [x, y, z],
  // depth, tip (index or -1), seq, branch (index of the branch into it, -1 at the root) }; branches { id, from, to, len,
  // depth, muts }. Branch b leads into node b + 1 (nodes are numbered level by level).
  const ROOT = [0, -1, 0], RISE = 1.6, TOP = 1.2;
  function node(nodes, parent, depth, az, rad) {
    const id = nodes.length;
    nodes.push({ id, parent, len: 0, kids: [], pos: [0, 0, 0], depth, tip: -1, seq: '', branch: id - 1, az, rad });
    if (parent >= 0) nodes[parent].kids.push(id);
    return id;
  }
  function place(nodes, unit) {
    for (const n of nodes) {
      if (n.parent < 0) { n.pos = ROOT.slice(); continue; }
      const p = nodes[n.parent];
      n.pos = [n.rad * Math.cos(n.az), p.pos[1] + n.len * unit, n.rad * Math.sin(n.az)];
    }
  }
  // the family tree: three levels of splits (8 tips, 14 branches). Layout: the root at (0, -1, 0); a child sits above
  // its parent by its branch length x 1.6 (heights are change: tips end at different heights; less than 1.6 only when
  // a tall seed would pass y = 1.2) and out from the vertical axis, farther the deeper (radii about 0.38, 0.78, 1.12);
  // the first split along x, each deeper split round its parent's direction (+-45 then +-22.5 degrees, a little
  // seeded jitter), so the eight tips stand evenly round the vertical: a round crown, never in a plane. The speed
  // scales the branch lengths (and the mutations) but not the drawing, so a tree keeps its shape: tree.unit is the
  // drawn height of one swap per letter.
  function familyTree(seed = 1, speed = 1, m = DEFAULT) {
    const r = rng(seed), e = prep(m), nodes = [], LEN = [[0.15, 0.45], [0.1, 0.5], [0.05, 0.6]];
    const RAD = [0, 0.38, 0.78, 1.12], SPREAD = [0, Math.PI / 2, Math.PI / 4, Math.PI / 8];
    const root = node(nodes, -1, 0, Math.PI / 2, 0);
    for (let d = 1; d <= 3; d++) {
      for (const p of nodes.filter(n => n.depth === d - 1)) for (const side of [-1, 1]) {
        const lo = LEN[d - 1][0], hi = LEN[d - 1][1], len = lo + (hi - lo) * r();
        const az = p.az + side * SPREAD[d] + (r() - 0.5) * 0.24, rad = RAD[d] * (1 + (r() - 0.5) * 0.1);
        nodes[node(nodes, p.id, d, az, rad)].len = len;
      }
    }
    let tip = 0, deep = 0;
    for (const n of nodes) {
      if (!n.kids.length) n.tip = tip++;
      n.path = n.parent < 0 ? 0 : nodes[n.parent].path + n.len;
      deep = Math.max(deep, n.path);
    }
    const unit = Math.min(RISE, (TOP - ROOT[1]) / deep);
    place(nodes, unit);
    // the mutations: each site follows the model exactly (waiting times and jumps of the Markov chain) along the branch,
    // from its own seeded stream
    const Qm = e.Q, branches = [];
    nodes[root].seq = data().fig1.ancestor;
    for (const n of nodes) {
      delete n.path;
      if (n.parent < 0) continue;
      n.len *= speed;
      const b = n.id - 1, from = toIdx(nodes[n.parent].seq), muts = [];
      for (let site = 0; site < from.length; site++) {
        const rs = rng(seedOf(seed * 131 + b, site));
        let x = from[site], tau = 0;
        for (;;) {
          const rate = -Qm[x * 5];
          tau += -Math.log(1 - rs()) / rate;
          if (tau >= n.len) break;
          let u = rs() * rate, y = 0;
          for (y = 0; y < 4; y++) { if (y === x) continue; if (u < Qm[x * 4 + y]) break; u -= Qm[x * 4 + y]; }
          if (y > 3) y = x === 3 ? 2 : 3;   // (rounding at the very end)
          muts.push({ at: tau / n.len, site, from: x, to: y });
          x = y;
        }
        from[site] = x;
      }
      muts.sort((a, c) => a.at - c.at);
      n.seq = toStr(from);
      branches.push({ id: b, from: n.parent, to: n.id, len: n.len, depth: n.depth, muts });
    }
    // a long and a short branch to point at: the longest whose swaps are at least three quarters of what its length
    // leads one to expect, and the shortest with at most that many (chance can give a long branch one swap and a short
    // one four; the story's point is the expected count)
    const byLen = branches.slice().sort((a, b) => a.len - b.len), L = nodes[root].seq.length;
    const long = byLen.slice().reverse().find(b => b.muts.length >= 0.75 * b.len * L) || byLen[byLen.length - 1];
    const short = byLen.find(b => b.muts.length <= Math.max(1, b.len * L) && b.muts.length < long.muts.length) || byLen[0];
    return { kind: 'family', seed, speed, model: e.model.key, nodes, branches, root, tips: tip, unit: unit / speed,
      longest: byLen[byLen.length - 1].id, shortest: byLen[0].id, highlight: { long: long.id, short: short.id } };
  }
  // the poster's species tree ((s1, s2), s3) with example branch lengths, laid out the same way: the root's split along
  // a line from front right to back left, n1's two tips round the vertical from it, so the three tips stand about 120
  // degrees apart (s1 front left, s2 at the back, s3 front right); the tips' stems are Figure 5's
  function speciesTree() {
    const sp = data().test.species, nodes = [], deg = Math.PI / 180;
    const root = node(nodes, -1, 0, 0, 0);
    const n1 = node(nodes, root, 1, 210 * deg, 0.42), s3 = node(nodes, root, 1, 30 * deg, 0.9);
    const s1 = node(nodes, n1, 2, 150 * deg, 0.9), s2 = node(nodes, n1, 2, 270 * deg, 0.9);
    const LEN = { [n1]: 0.25, [s3]: 0.45, [s1]: 0.2, [s2]: 0.3 }, NAME = ['root', 'n1', 's3', 's1', 's2'];
    for (const n of nodes) { n.len = LEN[n.id] || 0; n.name = NAME[n.id]; n.seq = null; }
    place(nodes, RISE);
    [[s1, 's1'], [s2, 's2'], [s3, 's3']].forEach(([id, k], i) => {
      const n = nodes[id];
      n.tip = i; n.stem = { top: sp[k].top, bottom: sp[k].bottom }; n.seq = sp[k].top + sp[k].bottom;
    });
    const branches = nodes.filter(n => n.parent >= 0).map(n => ({ id: n.id - 1, from: n.parent, to: n.id, len: n.len, depth: n.depth, muts: [] }));
    return { kind: 'species', nodes, branches, root, tips: 3, unit: RISE, tipIds: [s1, s2, s3] };
  }
  const br = (tree, b) => (typeof b === 'number' ? tree.branches[b] : b);
  // a point on a branch's smooth curve (u 0 at the parent, 1 at the child): it leaves the parent upwards, bends
  // outwards and arrives nearly upright (a cubic Bezier, monotone in height)
  function curve(tree, b, u, out) {
    const B = br(tree, b), p0 = tree.nodes[B.from].pos, p3 = tree.nodes[B.to].pos, dy = p3[1] - p0[1], v = 1 - u;
    const w0 = v * v * v, w1 = 3 * v * v * u, w2 = 3 * v * u * u, w3 = u * u * u;
    out = out || [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const c1 = p0[d] + (d === 1 ? 0.5 * dy : 0), c2 = d === 1 ? p3[1] - 0.35 * dy : p3[d] - 0.15 * (p3[d] - p0[d]);
      out[d] = w0 * p0[d] + w1 * c1 + w2 * c2 + w3 * p3[d];
    }
    return out;
  }
  // its direction there (not normalised)
  function tangent(tree, b, u, out) {
    const B = br(tree, b), p0 = tree.nodes[B.from].pos, p3 = tree.nodes[B.to].pos, dy = p3[1] - p0[1], v = 1 - u;
    out = out || [0, 0, 0];
    for (let d = 0; d < 3; d++) {
      const c1 = p0[d] + (d === 1 ? 0.5 * dy : 0), c2 = d === 1 ? p3[1] - 0.35 * dy : p3[d] - 0.15 * (p3[d] - p0[d]);
      out[d] = 3 * v * v * (c1 - p0[d]) + 6 * v * u * (c2 - c1) + 3 * u * u * (p3[d] - c2);
    }
    return out;
  }
  // the sequence riding up branch b at u (its mutations up to there applied): letter indices into out
  function seqAt(tree, b, u, out) {
    const B = br(tree, b), s = tree.nodes[B.from].seq;
    out = out || new Uint8Array(s.length);
    for (let i = 0; i < s.length; i++) out[i] = idx(s[i]);
    for (const mu of B.muts) { if (mu.at > u) break; out[mu.site] = mu.to; }
    return out;
  }

  // ------------------------------------------------------------------ pairs
  // the pairs that hold: A-T, C-G, G-T, both ways round
  const OKS = new Uint8Array(16);
  [[0, 3], [1, 2], [2, 3]].forEach(([x, y]) => { OKS[4 * x + y] = OKS[4 * y + x] = 1; });
  const ok = (x, y) => OKS[4 * (typeof x === 'string' ? idx(x) : x) + (typeof y === 'string' ? idx(y) : y)] === 1;
  const pairState = (x, y) => 4 * x + y;
  // the pairs of a stem that do not hold (0-based)
  const brokenPairs = (top, bottom) => [...top].map((c, i) => (ok(c, bottom[i]) ? -1 : i)).filter(i => i >= 0);
  const pairCache = new Map();
  const mkey = m => { const mo = model(m); return mo.key || JSON.stringify([mo.r, mo.pi]); };
  // a reversible pair model on the 16 states 4x + y: long-run share pi_xy ~ pi_x pi_y m(xy), m = w for a matching pair
  // and 1 otherwise; one letter changing: Q_xx' sqrt(m(x'y) / m(xy)) (Q the single letters' scaled rates); both at
  // once: dbl Q_xx' Q_yy' sqrt(m(x'y') / m(xy)); detailed balance holds by construction; scaled so the expected number
  // of letter changes per letter per unit time is 1 at the long-run mix. -> { Q (256), pi (16), w, dbl, eig }
  function pairModel(m, w = 8, dbl = 0.1) {
    const key = `${mkey(m)}|${w}|${dbl}`;
    if (pairCache.has(key)) return pairCache.get(key);
    const e = prep(m), q = e.Q, mm = s => (OKS[s] ? w : 1), Qp = new Float64Array(256), pp = new Float64Array(16);
    let z = 0;
    for (let s = 0; s < 16; s++) z += (pp[s] = e.pi[s >> 2] * e.pi[s & 3] * mm(s));
    for (let s = 0; s < 16; s++) pp[s] /= z;
    let changes = 0;
    for (let s = 0; s < 16; s++) {
      const x = s >> 2, y = s & 3;
      for (let s2 = 0; s2 < 16; s2++) {
        if (s2 === s) continue;
        const x2 = s2 >> 2, y2 = s2 & 3, f = Math.sqrt(mm(s2) / mm(s));
        const rate = y2 === y ? q[x * 4 + x2] * f : x2 === x ? q[y * 4 + y2] * f : dbl * q[x * 4 + x2] * q[y * 4 + y2] * f;
        Qp[s * 16 + s2] = rate;
        changes += pp[s] * rate * ((x !== x2) + (y !== y2)) / 2;
      }
    }
    for (let s = 0; s < 16; s++) {
      let sum = 0;
      for (let s2 = 0; s2 < 16; s2++) if (s2 !== s) sum += (Qp[s * 16 + s2] /= changes);
      Qp[s * 17] = -sum;
    }
    const pm = { Q: Qp, pi: pp, w, dbl, eig: prepRev(Qp, pp, 16) };
    pairCache.set(key, pm);
    return pm;
  }
  // e^(Q t) of the pair model (16 x 16, row to column)
  const Ppair = (m, w = 8, t = 0, dbl = 0.1, out) => expAll(pairModel(m, w, dbl).eig, t, out);
  const P4 = new Float64Array(16);
  // letter by letter: P(t) (x) P(t)
  function Pindep(m, t, out) {
    out = out || new Float64Array(256);
    const p = P(m, t, P4);
    for (let s = 0; s < 16; s++) for (let s2 = 0; s2 < 16; s2++) out[s * 16 + s2] = p[(s >> 2) * 4 + (s2 >> 2)] * p[(s & 3) * 4 + (s2 & 3)];
    return out;
  }
  // OUR STAND-IN for the authors' coupled circuit: the independent turn, then a coupling that weights each resulting
  // pair by w if it matches and normalises each row, so every branch favours matching pairs w times, however short it
  // is: too strongly, by design, as the authors found of theirs
  function Pcoupled(m, w = 8, t = 0, out) {
    out = Pindep(m, t, out);
    for (let s = 0; s < 16; s++) {
      let z = 0;
      for (let s2 = 0; s2 < 16; s2++) z += (out[s * 16 + s2] *= OKS[s2] ? w : 1);
      for (let s2 = 0; s2 < 16; s2++) out[s * 16 + s2] /= z;
    }
    return out;
  }
  // the long-run share of matching pairs, and the chance that all six pairs of a stem match
  function matchShare(m, w = 8) {
    const p = pairModel(m, w).pi;
    let s = 0;
    for (let k = 0; k < 16; k++) if (OKS[k]) s += p[k];
    return s;
  }
  const allSixPrior = (m, w = 8) => Math.pow(matchShare(m, w), data().test.pairs || 6);

  // ------------------------------------------------------------------ rebuilding the ancestor
  const METHODS = ['indep', 'coupled', 'exact'];
  // a method's 16 x 16 matrix for a branch, and its long-run mix (the root's prior)
  function trans(method, m, w, t, dbl) {
    return method === 'indep' ? Pindep(m, t) : method === 'coupled' ? Pcoupled(m, w, t) : Ppair(m, w, t, dbl);
  }
  // the long-run mix of a step M (n x n, rows sum to 1): pi M = pi, sum pi = 1 (Gauss-Jordan elimination)
  function stationary(M, n = 16) {
    const c1 = n + 1, A = new Float64Array(n * c1);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) A[i * c1 + j] = i === n - 1 ? 1 : M[j * n + i] - (i === j ? 1 : 0);
      A[i * c1 + n] = i === n - 1 ? 1 : 0;
    }
    for (let c = 0; c < n; c++) {
      let p = c;
      for (let r = c + 1; r < n; r++) if (Math.abs(A[r * c1 + c]) > Math.abs(A[p * c1 + c])) p = r;
      if (p !== c) for (let k = 0; k <= n; k++) { const v = A[c * c1 + k]; A[c * c1 + k] = A[p * c1 + k]; A[p * c1 + k] = v; }
      for (let r = 0; r < n; r++) {
        if (r === c) continue;
        const f = A[r * c1 + c] / A[c * c1 + c];
        if (f) for (let k = c; k <= n; k++) A[r * c1 + k] -= f * A[c * c1 + k];
      }
    }
    const out = new Float64Array(n);
    for (let i = 0; i < n; i++) out[i] = Math.max(A[i * c1 + n] / A[i * c1 + i], 0);
    return out;
  }
  // a method's long-run mix, the root's prior: letter by letter pi_x pi_y; the exact pair model's pi_xy; the coupled
  // stand-in's, where its machine settles when run branch after branch (its step differs with the branch length: here
  // at the tree's mean branch length, tbar). Every step weights matching pairs by w again, on top of where it began,
  // so that mix favours them more than the exact model's (on short steps it nears pi_x pi_y w^2 instead of
  // pi_x pi_y w): part of how the stand-in favours pairs too strongly. A choice, kept for that (see the header): with
  // the exact model's mix as its prior it would rebuild hardly more intact ancestors than letter by letter from Figure
  // 5's stems (12 % against 11 %), far fewer than the exact model (31 %): each branch's weighting makes the species'
  // broken pairs unlikely from a matching root, which counts against matching ancestors.
  function prior(method, m, w = 8, dbl = 0.1, tbar = 0.3) {
    if (method === 'exact') return pairModel(m, w, dbl).pi;
    if (method === 'coupled') return stationary(Pcoupled(m, w, tbar));
    const p = prep(m).pi, out = new Float64Array(16);
    for (let s = 0; s < 16; s++) out[s] = p[s >> 2] * p[s & 3];
    return out;
  }
  const rebuildCache = new Map();
  // the ancestor of the species tree's stems rebuilt by one method: per pair the posterior over the 16 root states
  // (Felsenstein's pruning with the method's matrix on every branch, its long-run mix as the prior), n ancestors
  // sampled from it (seeded), how many have all six pairs matching, and the exact chance of that
  // -> { method, post (Float64Array(6 x 16)), pairOk (6: each pair's chance to match), samples (Uint8Array(n x 6) of
  //    pair states), good (Uint8Array(n): 1 if all six match), intact, share, expected, best: { top, bottom } }
  function rebuild(method, o = {}) {
    const d = data().test, mo = model(o.model), w = o.w == null ? d.w : o.w, n = o.n == null ? d.n : o.n;
    const seed = o.seed == null ? 1 : o.seed, dbl = o.dbl == null ? 0.1 : o.dbl;
    const key = `${method}|${mkey(mo)}|${w}|${n}|${seed}|${dbl}`;
    if (rebuildCache.has(key)) return rebuildCache.get(key);
    const tr = speciesTree(), N = tr.nodes.length, mats = tr.nodes.map(nd => (nd.parent < 0 ? null : trans(method, mo, w, nd.len, dbl)));
    const tbar = tr.branches.reduce((a, b) => a + b.len, 0) / tr.branches.length;
    const pri = prior(method, mo, w, dbl, tbar), K = tr.nodes.find(nd => nd.stem).stem.top.length;
    const post = new Float64Array(K * 16), pairOk = new Float64Array(K), L = new Float64Array(N * 16);
    let top = '', bottom = '', expected = 1;
    for (let i = 0; i < K; i++) {
      for (let a = N - 1; a >= 0; a--) {   // children are numbered after their parents
        const nd = tr.nodes[a];
        if (nd.stem) { const st = pairState(idx(nd.stem.top[i]), idx(nd.stem.bottom[i])); for (let s = 0; s < 16; s++) L[a * 16 + s] = s === st ? 1 : 0; continue; }
        for (let s = 0; s < 16; s++) L[a * 16 + s] = 1;
        for (const c of nd.kids) {
          const M = mats[c];
          for (let s = 0; s < 16; s++) { let v = 0; for (let s2 = 0; s2 < 16; s2++) v += M[s * 16 + s2] * L[c * 16 + s2]; L[a * 16 + s] *= v; }
        }
      }
      let z = 0, bs = 0;
      for (let s = 0; s < 16; s++) z += (post[i * 16 + s] = pri[s] * L[tr.root * 16 + s]);
      for (let s = 0; s < 16; s++) { post[i * 16 + s] /= z; if (OKS[s]) pairOk[i] += post[i * 16 + s]; if (post[i * 16 + s] > post[i * 16 + bs]) bs = s; }
      top += LETTERS[bs >> 2]; bottom += LETTERS[bs & 3];
      expected *= pairOk[i];
    }
    const r = rng(seed), samples = new Uint8Array(n * K), good = new Uint8Array(n);
    let intact = 0;
    for (let k = 0; k < n; k++) {
      let all = 1;
      for (let i = 0; i < K; i++) {
        let u = r(), s = 0;
        for (; s < 15; s++) { u -= post[i * 16 + s]; if (u < 0) break; }
        samples[k * K + i] = s;
        if (!OKS[s]) all = 0;
      }
      good[k] = all; intact += all;
    }
    const res = { method, model: mo.key, w, n, seed, dbl, pairs: K, prior: pri, post, pairOk, samples, good, intact, share: intact / n, expected, best: { top, bottom } };
    rebuildCache.set(key, res);
    return res;
  }
  // n ancestors with exactly round(share x n) of them intact, for showing the authors' shares with plausible broken
  // pairs: the intact ones drawn from the method's posterior given that all six pairs match, the rest from it given at
  // least one broken (the story's model, w = 8); which ones are intact is shuffled (seeded)
  function crowd(method, share, n = 2000, seed = 1) {
    const R = rebuild(method, { n: 1 }), K = R.pairs, post = R.post, r = rng(seedOf(seed, 7 + METHODS.indexOf(method)));
    const k = Math.round(share * n), order = shuffle([...Array(n).keys()], r), samples = new Uint8Array(n * K), good = new Uint8Array(n);
    const draw = (i, onlyOk) => {
      let z = 0;
      for (let s = 0; s < 16; s++) if (!onlyOk || OKS[s]) z += post[i * 16 + s];
      let u = r() * z, s = 0;
      for (; s < 15; s++) { if (onlyOk && !OKS[s]) continue; u -= post[i * 16 + s]; if (u < 0) break; }
      while (onlyOk && !OKS[s]) s--;   // (rounding at the very end: the last matching state)
      return s;
    };
    for (let j = 0; j < n; j++) {
      const a = order[j], intact = j < k;
      for (let tries = 0; ; tries++) {
        let all = 1;
        for (let i = 0; i < K; i++) { const s = draw(i, intact); samples[a * K + i] = s; if (!OKS[s]) all = 0; }
        if (intact || !all) break;
        if (tries > 200) { samples[a * K] = 0; break; }   // (A-A: broken, should a posterior ever hold only pairs)
      }
      good[a] = intact ? 1 : 0;
    }
    return { method, n, pairs: K, samples, good, intact: k, share: k / n };
  }
  // the combinations a model of k linked letters must track, and the qubits that hold them
  const combos = k => Math.pow(4, k);
  const qubits = k => 2 * k;

  return {
    rng, hash, pop, data, LETTERS, CODES, KETS, idx, bits, toIdx, toStr,
    MODELS, DEFAULT, model, Q, pi, P, T_PATH, POINTS, path, CORNERS, simplex,
    amps, bloch, sample, WIRES, angles, circuit, decompose, run, simulate, turnAngle,
    familyTree, speciesTree, curve, tangent, seqAt,
    OKS, ok, pairState, brokenPairs, pairModel, Ppair, Pindep, Pcoupled, matchShare, allSixPrior,
    METHODS, prior, stationary, rebuild, crowd, combos, qubits, eigSym,
  };
})();

// MUT_DATA: the poster's numbers, typed in exactly from "Converting Mutation into a Machinery: DNA Substitution Models
// as Quantum Circuits" by Enes Berk Sakalli and Arndt von Haeseler (a draft of 26 Oct 2026, not in the repository) and
// from Enes's answers to our questions (27 Oct 2026). Everything else the story shows is computed live from example
// numbers (MMATH, sets/mmath.js). The story says "in the authors' test" wherever it uses these numbers. British spelling.
// Fields:
//   poster        the title, the authors and their institutes, the date of the draft, the six references (shortened, in
//                 the poster's order: [1] is refs[0])
//   fig1          Figure 1: the ancestor and its two descendants, and the swaps that make them (1-based positions,
//                 [position, from, to]); codes, the two qubits of each letter (|01> means first 0, then 1)
//   test          Figure 5 and the result (section "Result"): a synthetic stem of six pairs in three species, drawn as
//                 two rows: top the outgoing half 5' to 3', left to right; bottom the returning half under it, so top[i]
//                 pairs with bottom[i] (the loop is at the right end). broken: the pairs the figure marks as broken
//                 (1-based). tree: the species tree, the root the ancestor. truth: the true ancestor. rebuilt: one
//                 rebuilt ancestor per method, as the figure shows them. n: ancestors rebuilt per method; pairs: pairs
//                 in the stem; w: how much more likely a matching pair is than a mismatched one (the poster, and Enes:
//                 "eight times more likely than mismatched pairs"); intact: the share of rebuilt ancestors with all six
//                 pairs matching, per method (indep: letter by letter, coupled: the circuit with coupling, exact: the
//                 exact pair model); allSixPrior: Enes's words for how many ancestors have all six pairs matching
//                 (words only: no number was given)
//   pairsOk       the pairs that hold in a stem (the poster: A-T, C-G and G-T), both ways round
//   count         the combinations a pair model must track (the poster, "Result"): 16 for a pair, about a million for
//                 ten linked letters, against two qubits a letter (20 for ten)
const MUT_DATA = {
  poster: {
    title: 'Converting Mutation into a Machinery: DNA Substitution Models as Quantum Circuits',
    authors: [
      { name: 'Enes Berk Sakalli', inst: 'Ludwig Boltzmann Institute for Network Medicine at the University of Vienna' },
      { name: 'Arndt von Haeseler', inst: 'Center for Integrative Bioinformatics Vienna (CIBIV), Max Perutz Labs, University of Vienna and Medical University of Vienna' },
    ],
    date: '26 Oct 2026 (draft)',
    refs: [
      'Hadfield et al., Nextstrain, Bioinformatics 2018',
      'Arenas and Posada, Curr HIV Res 2010',
      'Schöniger and von Haeseler, Mol Phylogenet Evol 1994',
      'Doria-Rose et al., J Virol 2005',
      'Rolland et al., J Virol 2007',
      'Li et al., Oncogene 2026',
    ],
  },
  fig1: {
    ancestor: 'ACGTTAGC', d1: 'ACGTCGGC', d2: 'ACATTAGT',
    swaps: { d1: [[5, 'T', 'C'], [6, 'A', 'G']], d2: [[3, 'G', 'A'], [8, 'C', 'T']] },
    codes: { A: '00', C: '01', G: '10', T: '11' },
  },
  test: {
    species: {
      s1: { top: 'ATTACT', bottom: 'CGATAG', broken: [1, 5] },
      s2: { top: 'ATTACT', bottom: 'CTTTGA', broken: [1, 2, 3] },
      s3: { top: 'GTTACT', bottom: 'TGAGGC', broken: [4, 6] },
    },
    tree: '((s1, s2), s3)',
    truth: { top: 'GTTACT', bottom: 'TGATGC', broken: [6] },
    rebuilt: {
      indep: { top: 'ATTACT', bottom: 'CGATGC', broken: [1, 6] },
      coupled: { top: 'GTTACT', bottom: 'TGATGA', broken: [] },
      exact: { top: 'ATTACT', bottom: 'CGATGA', broken: [1] },
    },
    n: 2000, pairs: 6, w: 8,
    intact: { indep: 0.10, coupled: 0.43, exact: 0.20 },
    allSixPrior: 'about a quarter',
  },
  pairsOk: ['AT', 'TA', 'CG', 'GC', 'GT', 'TG'],
  count: { pair: 16, ten: 'about a million', tenQubits: 20 },
};

// MLOOK: the shared look of the mutation story's sets, grown from the qubits story's QLOOK. Lit, glowing shapes drawn as
// instanced meshes that a set refills every frame (a few hundred instances: cheap), soft halos, and the story's own
// pieces: letter tiles, arrowheads, glass spheres, qubits and the machine's gears. Colours are the poster's, the
// Okabe-Ito palette: A orange, C sky blue, G yellow, T pink; the machine blue with bright rims; time and branch length
// green; a pair that holds white, a broken one red.
//
// const LK = MLOOK(K, set)   (K the kit; set from K.newSet: every material fades with the set's uA)
// Units: positions and sizes in the set's local units, angles in radians, colours [r, g, b] (0..1) or '#rrggbb'
// (arrays avoid an allocation per add), alpha 0..1 (an instance at or under 0.004 is skipped).
// Every pool: const P = LK.<pool>(max); set.group.add(P.mesh) once; then every frame P.begin(), P.add(...) (at most max
// times: more are dropped; add returns the instance's index or -1), P.end() (sets the count, uploads, and hides the
// mesh while it is empty, so an empty pool costs no draw call). Nothing is allocated per add: reuse arrays and options.
// Triangles per instance: tube 20, cone 48, tile 200, ball 352, ring 640, glass 952, gear about 1,550 (a qubit about
// 2,800 with its glass, two rings, ball, tubes and cone); each pool is one draw call (gears two).
//
// From the qubits story, unchanged in use:
//   tubes(max).add(a, b, r, col, alpha, dash)          an open cylinder from point a to point b, radius r; dash: the
//                                                     number of dashes along it (0 solid)
//   rings(max).add(c, axis, R, r, col, alpha, dash)    a torus round c across 'axis' (any length), radius R, tube r
//   balls(max).add(p, r, col, alpha)                   a lit sphere
//   boxes(max).add(p, [sx, sy, sz], col, alpha)        a lit block, axis-aligned, sizes across
//   halos(max).add(p, size, col, alpha)                a soft additive glow (the kit's points), size across
//   depth()                                            call once per frame: depth writes only while the set is fully in
// New for this story:
//   cones(max).add(base, dir, length, r, col, alpha)   an arrowhead: a base disc of radius r at 'base', its tip at
//                                                     base + unit(dir) * length
//   glass(max).add(p, r, col, alpha)                   a glass sphere: clear face-on, glowing at its rim (additive)
//   tiles(max).add(p, q, size, letter, alpha, frame, glow, col)
//       A letter tile: a rounded block 'size' wide and high and 0.24 size thick, in the letter's colour, with the letter
//       in dark ink on both faces (read the right way round from either side). q: a THREE.Quaternion or [x, y, z, w]
//       that turns the tile from facing +z (the letter upright along +y), or null to face the camera, kept upright.
//       letter: 0..3 for A C G T, 4 '?', 5 '0', 6 '1' (GLYPHS). frame 0..1: the white thick frame (a letter that
//       differs). glow 0..1: lit from inside. col (optional): another colour for the block (default LCOL[letter]).
//   gears(max, teeth = 12).add(c, axis, R, angle, col, alpha, opts)
//       The machine's gear: a toothed rim (tips at R, roots at 0.8 R, 0.22 R thick, bright chamfered edges) round a
//       recessed web with the hub's dot in a circle on both faces; it lies across 'axis' and is turned by 'angle' about
//       it. opts: true (or { pair: true }) for the coupling gear, a double white band across both faces (the poster's
//       sign for a pair's two letters); { rim, glow }: the bright edges' colour (default RIM for BLUE, else a lighter
//       col) and 0..1 lit from inside. Pass a constant object. Two gears of one size and tooth count mesh with their
//       centres 2 * P.pitchR * R apart (P.pitchR = 0.9) when one is turned half a tooth (P.pitch / 2) further and they
//       turn opposite ways. The returned index is within its kind (plain or coupling). P.mesh is a group of two meshes.
//   qubit(pools, c, R, bloch, alpha, opts)
//       Draws one qubit from the pools { glass, rings, tubes, cones, balls, halos } (a missing pool's part is left
//       out; without glass the ball is a faint lit sphere): a glass ball of radius R at c, its equator ring, a faint
//       vertical axis, the 0 mark above (a small ring) and the 1 mark below (a small stroke with a flag), and the arrow
//       from the centre (a tube and a cone) whose length is the Bloch vector's (R for a pure state; a dashed trace
//       carries on to the sphere when it is shorter, as when two qubits depend on each other; no arrow under 0.04).
//       bloch: [x, y, z] with z +1 for |0> (up) and -1 for |1> (down); x is drawn along +x, y along -z. opts (all
//       optional; pass a constant object): at (offset into bloch, e.g. 3 for the second qubit of MMATH.bloch's six
//       numbers), col (the arrow, default INK), tint (glass, ring and axis, default GLASS), glow 0..1 (the arrow's
//       halo), spin (radians: turns the arrow round the vertical, the coin spinning), marks (false: no 0 and 1),
//       face ([x, y, z] the side the marks face, default +z), tip (an array that receives the arrow's tip).
// Colours ([r, g, b]): LCOL[0..4] (A C G T and the grey of '?'), LHEX (A C G T as '#rrggbb', for HTML), BLUE (gears),
// RIM (their bright edges), GREEN (time, branch length), GREENLIT (green where it must glow), RED (a broken pair),
// WHITE (a pair that holds, frames), INK (light marks), DARK (the tiles' ink), GREY, CYAN (highlights), AMBER, GLASS.
// Helpers: LETTERS 'ACGT', GLYPHS 'ACGT?01', mix(a, b, t, out) (out optional, else a new array), quat(out, axis, angle)
// (a quaternion [x, y, z, w] about 'axis' into out, for tiles), ID (no turn: [0, 0, 0, 1]).
const MLOOK = function (K, set) {
  const { THREE, rgb } = K;
  const LIGHT = 'vec3 l = normalize(vec3(-0.45, 0.55, 0.7));   // over the viewer\'s left shoulder, as the scene\'s light';
  const FRAG = `
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  if (vD > 0.5 && fract(vU * vD) > 0.56) discard;   // dashed
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 28.0);
  vec3 col = vC * (0.3 + 0.5 * dif + 0.2 * hemi) + vC * rim * 0.9 + vec3(spec * 0.3);
  gl_FragColor = vec4(col, vA);
}`;
  // (opts: side, blending; additive materials keep depth writes off, so depth() leaves them alone)
  const mat = (vertex, frag, opts = {}) => {
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({ uA: set.uA }, opts.uniforms || {}), vertexShader: vertex, fragmentShader: frag || FRAG,
      transparent: true, side: opts.side === undefined ? THREE.DoubleSide : opts.side, blending: opts.blending || THREE.NormalBlending, depthWrite: !opts.blending });
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
    mesh.frustumCulled = false; mesh.count = 0; mesh.visible = false;
    const P = { mesh, attrs, n: 0, max };
    P.begin = () => { P.n = 0; };
    P.end = () => {
      mesh.count = P.n; mesh.visible = P.n > 0; mesh.instanceMatrix.needsUpdate = true;
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
  // a small mesh builder for the tiles and gears: vertices [x, y, z, nx, ny, nz, ...extras]; each triangle is wound
  // to face its vertices' normals (so front faces are outside, whatever order the code lists them in)
  function builder(extra) {
    const pos = [], nrm = [], ex = extra.map(() => []);
    const push = v => {
      pos.push(v[0], v[1], v[2]); nrm.push(v[3], v[4], v[5]);
      let o = 6;
      extra.forEach((e, j) => { for (let k = 0; k < e[1]; k++) ex[j].push(v[o++]); });
    };
    const tri = (a, b, c) => {
      const ux = b[0] - a[0], uy = b[1] - a[1], uz = b[2] - a[2], vx = c[0] - a[0], vy = c[1] - a[1], vz = c[2] - a[2];
      const gx = uy * vz - uz * vy, gy = uz * vx - ux * vz, gz = ux * vy - uy * vx;
      if (gx * gx + gy * gy + gz * gz < 1e-14) return;
      if (gx * (a[3] + b[3] + c[3]) + gy * (a[4] + b[4] + c[4]) + gz * (a[5] + b[5] + c[5]) < 0) { push(a); push(c); push(b); } else { push(a); push(b); push(c); }
    };
    return {
      tri, quad: (a, b, c, d) => { tri(a, b, c); tri(a, c, d); },
      geo() {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
        g.setAttribute('normal', new THREE.Float32BufferAttribute(nrm, 3));
        extra.forEach((e, j) => g.setAttribute(e[0], new THREE.Float32BufferAttribute(ex[j], e[1])));
        return g;
      },
    };
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _s = new THREE.Vector3(), _p = new THREE.Vector3(), _d = new THREE.Vector3(), _y = new THREE.Vector3(0, 1, 0), _z = new THREE.Vector3(0, 0, 1);
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
  // rings: a torus around centre c, its axis 'axis', major radius R, tube radius r; dash = dashes around it
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
  // boxes: lit blocks at p, sizes [sx, sy, sz]
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
    pts.frustumCulled = false; pts.visible = false;
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
      g.setDrawRange(0, P.n); pts.visible = P.n > 0;
      for (const k of ['position', 'aCol', 'aSize', 'aA']) g.attributes[k].needsUpdate = true;
    };
    return P;
  }

  // ---------------------------------------------------------------- arrowheads and glass
  // cones: a base disc of radius r at 'base', the tip at base + unit(dir) * length
  function cones(max) {
    const geo = new THREE.ConeGeometry(1, 1, 16, 1, false);
    geo.translate(0, 0.5, 0);
    const P = pool(geo, mat(VTUBE, null, { side: THREE.FrontSide }), max);
    P.add = (base, dir, length, r, col, alpha) => {
      _d.set(dir[0], dir[1], dir[2]);
      const l = _d.length();
      if (l < 1e-9 || length <= 0 || r <= 0 || alpha <= 0.004) return -1;
      _q.setFromUnitVectors(_y, _d.multiplyScalar(1 / l));
      _m.compose(_p.set(base[0], base[1], base[2]), _q, _s.set(r, length, r));
      return P.put(_m, col, alpha, 0);
    };
    return P;
  }
  // glass: clear face-on, a glowing rim and a small highlight; the far side's rim shows through, fainter
  const FGLASS = `
varying vec3 vC, vN, vV; varying float vA, vU, vD;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  float f = gl_FrontFacing ? 1.0 : 0.4;
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float r = pow(1.0 - abs(dot(n, v)), 2.4), spec = gl_FrontFacing ? pow(max(dot(reflect(-l, n), v), 0.0), 60.0) : 0.0;
  gl_FragColor = vec4(vC * (0.3 + 1.1 * r) + vec3(spec), vA * (f * (0.05 + 0.75 * r) + 0.7 * spec));
}`;
  function glass(max) {
    const P = pool(new THREE.SphereGeometry(1, 28, 18), mat(VTUBE, FGLASS, { blending: THREE.AdditiveBlending }), max);
    P.mesh.renderOrder = 1;   // (after the solid pieces, so its glow lies over what is inside and behind)
    P.add = (p, r, col, alpha) => {
      if (r <= 0 || alpha <= 0.004) return -1;
      _m.compose(_p.set(p[0], p[1], p[2]), _q.set(0, 0, 0, 1), _s.set(r, r, r));
      return P.put(_m, col, alpha, 0);
    };
    return P;
  }

  // ---------------------------------------------------------------- letter tiles
  // The glyphs in one canvas texture: eight square cells side by side (A C G T ? 0 1 and one spare), white on clear,
  // read as a mask in the shader. Drawn once per page and shared by the story's sets.
  const GLYPHS = 'ACGT?01', CELL = 256, CELLS = 8;
  function atlas() {
    if (MLOOK.atlas && MLOOK.atlas.image) return MLOOK.atlas;
    const cv = document.createElement('canvas');
    cv.width = CELL * CELLS; cv.height = CELL;
    const g = cv.getContext('2d');
    g.fillStyle = '#fff'; g.textAlign = 'center'; g.textBaseline = 'alphabetic';
    g.font = `bold ${Math.round(CELL * 0.66)}px "Helvetica Neue", Helvetica, Arial, "Liberation Sans", "DejaVu Sans", sans-serif`;
    for (let i = 0; i < GLYPHS.length; i++) {
      // (centred on its ink, not on the font's em box)
      const m = g.measureText(GLYPHS[i]), asc = m.actualBoundingBoxAscent || CELL * 0.48, desc = m.actualBoundingBoxDescent || 0;
      g.fillText(GLYPHS[i], (i + 0.5) * CELL, CELL / 2 + (asc - desc) / 2);
    }
    const t = new THREE.CanvasTexture(cv);
    t.anisotropy = 4;
    return (MLOOK.atlas = t);
  }
  // A rounded block: the outline a square of side 1 with corners of radius 0.2, its edge a half-round of radius 0.12
  // (the thickness 0.24), flat faces in front and behind. uv runs across each face as seen from its own side, so the
  // letter reads the right way round from behind too.
  function tileGeo() {
    const B = builder([['uv', 2], ['aFace', 1]]), b = 0.12, rc = 0.2, CS = 4, PS = 4, O = [];
    const cen = [[0.3, 0.3], [-0.3, 0.3], [-0.3, -0.3], [0.3, -0.3]];
    for (let j = 0; j < 4; j++) for (let s = 0; s <= CS; s++) {
      const a = (j + s / CS) * Math.PI / 2;
      O.push([cen[j][0] + rc * Math.cos(a), cen[j][1] + rc * Math.sin(a), Math.cos(a), Math.sin(a)]);
    }
    const n = O.length;
    const rimV = (i, k) => {
      const [x, y, mx, my] = O[i], f = k / PS * Math.PI, s = Math.sin(f), c = Math.cos(f), px = x - mx * b * (1 - s), py = y - my * b * (1 - s);
      return [px, py, b * c, mx * s, my * s, c, px + 0.5, py + 0.5, 0];
    };
    for (let k = 0; k < PS; k++) for (let i = 0; i < n; i++) { const j = (i + 1) % n; B.quad(rimV(i, k), rimV(j, k), rimV(j, k + 1), rimV(i, k + 1)); }
    for (const z of [1, -1]) {
      const fv = (x, y) => [x, y, b * z, 0, 0, z, z > 0 ? x + 0.5 : 0.5 - x, y + 0.5, 1], C = fv(0, 0);
      for (let i = 0; i < n; i++) { const a = O[i], c = O[(i + 1) % n]; B.tri(C, fv(a[0] - a[2] * b, a[1] - a[3] * b), fv(c[0] - c[2] * b, c[1] - c[3] * b)); }
    }
    return B.geo();
  }
  const VTILE = `
attribute vec3 aCol; attribute float aA, aLetter, aFrame, aGlow, aBill, aFace;
uniform float uA;
varying vec3 vC, vN, vV; varying vec2 vUv; varying float vA, vL, vF, vG, vFace;
void main() {
  vec4 mv; vec3 n;
  if (aBill > 0.5) {
    // facing the camera, kept upright: a frame from the tile's centre towards the eye
    mat4 mi = modelMatrix * instanceMatrix;
    vec3 c = mi[3].xyz, d = cameraPosition - c;
    d = dot(d, d) > 1e-10 ? normalize(d) : vec3(0.0, 0.0, 1.0);
    vec3 r = cross(vec3(0.0, 1.0, 0.0), d);
    r = dot(r, r) > 1e-8 ? normalize(r) : vec3(1.0, 0.0, 0.0);
    mat3 B = mat3(r, cross(d, r), d);
    mv = viewMatrix * vec4(c + B * position * length(mi[0].xyz), 1.0);
    n = mat3(viewMatrix) * (B * normal);
  } else {
    mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
    n = normalMatrix * mat3(instanceMatrix) * normal;
  }
  vN = normalize(n); vV = -mv.xyz; vC = aCol; vA = aA * uA; vUv = uv; vL = aLetter; vF = aFrame; vG = aGlow; vFace = aFace;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const FTILE = `
uniform sampler2D uMap; uniform vec3 uInk, uWhite;
varying vec3 vC, vN, vV; varying vec2 vUv; varying float vA, vL, vF, vG, vFace;
float box(vec2 p, float b, float r) { vec2 q = abs(p) - b + r; return length(max(q, 0.0)) + min(max(q.x, q.y), 0.0) - r; }
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.4), spec = pow(max(dot(reflect(-l, n), v), 0.0), 24.0);
  // the frame: the whole rounded edge, and a band just inside it on the faces
  float fr = vF * (vFace > 0.5 ? smoothstep(-0.008, 0.008, box(vUv - 0.5, 0.33, 0.07)) : 1.0);
  vec3 body = mix(vC, uWhite, fr);
  vec3 col = body * (0.62 + 0.36 * dif + 0.14 * hemi + 0.75 * vG) + body * rim * 0.55 + vec3(spec * 0.22);
  if (vFace > 0.5) col = mix(col, uInk, texture2D(uMap, vec2((vL + vUv.x) / ${CELLS}.0, vUv.y)).a);
  gl_FragColor = vec4(col, vA);
}`;
  function tiles(max) {
    const m = mat(VTILE, FTILE, { side: THREE.FrontSide, uniforms: { uMap: { value: atlas() }, uInk: { value: new THREE.Color(...DARK) }, uWhite: { value: new THREE.Color(...WHITE) } } });
    const P = pool(tileGeo(), m, max, { aLetter: 1, aFrame: 1, aGlow: 1, aBill: 1 }), A = P.attrs;
    P.add = (p, q, size, letter, alpha, frame, glow, col) => {
      if (size <= 0 || alpha <= 0.004) return -1;
      const L = letter > 0 ? Math.min(GLYPHS.length - 1, letter | 0) : 0;
      if (!q) _q.set(0, 0, 0, 1); else if (q.isQuaternion) _q.copy(q); else _q.set(q[0], q[1], q[2], q[3]);
      _m.compose(_p.set(p[0], p[1], p[2]), _q, _s.set(size, size, size));
      const i = P.put(_m, col || LCOL[Math.min(L, 4)] || LCOL[4], alpha, 0);
      if (i >= 0) { A.aLetter.array[i] = L; A.aFrame.array[i] = frame || 0; A.aGlow.array[i] = glow || 0; A.aBill.array[i] = q ? 0 : 1; }
      return i;
    };
    return P;
  }

  // ---------------------------------------------------------------- the machine's gears
  // parts (aPart): 0 body, 1 walls, 2 the bright chamfered edges, 3 the hub, 4 the coupling's white bands
  const VGEAR = `
attribute vec3 aCol, aRim; attribute float aA, aGlow, aPart;
uniform float uA;
varying vec3 vC, vR, vN, vV; varying float vA, vP, vG;
void main() {
  vec4 mv = modelViewMatrix * instanceMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * mat3(instanceMatrix) * normal);
  vV = -mv.xyz; vC = aCol; vR = aRim; vA = aA * uA; vP = aPart; vG = aGlow;
  gl_Position = projectionMatrix * mv;
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`;
  const FGEAR = `
uniform vec3 uWhite;
varying vec3 vC, vR, vN, vV; varying float vA, vP, vG;
void main() {
  vec3 n = normalize(vN), v = normalize(vV);
  if (!gl_FrontFacing) n = -n;
  ${LIGHT}
  float dif = max(dot(n, l), 0.0), hemi = 0.5 + 0.5 * n.y;
  float rim = pow(1.0 - abs(dot(n, v)), 2.2), spec = pow(max(dot(reflect(-l, n), v), 0.0), 30.0);
  vec3 c = vP > 3.5 ? uWhite : mix(vC, vR, vP > 1.5 ? 1.0 : vP > 0.5 ? 0.4 : 0.0);
  float e = vP > 1.5 ? 0.3 : 0.0;   // the bright edges, the hub and the bands glow a little
  vec3 col = c * (0.32 + 0.55 * dif + 0.18 * hemi + e) + vR * rim * 0.7 + vec3(spec * 0.35) + vR * vG * 0.55;
  gl_FragColor = vec4(col, vA);
}`;
  // one gear of radius 1 in the xy plane, its axis z
  function gearGeo(teeth, pair) {
    const B = builder([['aPart', 1]]), TAU = Math.PI * 2;
    const rr = 0.8, rt = 1, ra = 0.6, hz = 0.11, ch = 0.03, hw = 0.05, SEG = 32;
    // the toothed outline, counter-clockwise, and the same inset by the chamfer (mitred at the corners)
    const O = [];
    for (let k = 0; k < teeth; k++) for (const [f, r] of [[0, rr], [0.14, rt], [0.36, rt], [0.5, rr], [0.75, rr]]) {
      const a = (k + f) / teeth * TAU; O.push([r * Math.cos(a), r * Math.sin(a)]);
    }
    const n = O.length;
    const SN = O.map((p, i) => { const q = O[(i + 1) % n], l = Math.hypot(q[0] - p[0], q[1] - p[1]); return [(q[1] - p[1]) / l, -(q[0] - p[0]) / l]; });
    const I = O.map((p, i) => { const a = SN[(i + n - 1) % n], b = SN[i], d = 1 + a[0] * b[0] + a[1] * b[1]; return [p[0] - ch * (a[0] + b[0]) / d, p[1] - ch * (a[1] + b[1]) / d]; });
    const ang = I.map(p => Math.atan2(p[1], p[0]));
    const V = (x, y, z, nx, ny, nz, k) => [x, y, z, nx, ny, nz, k];
    const ring = (r0, r1, z0, z1, s, k) => {   // a raised ring (r0 0: a disc) on the face, side s
      for (let i = 0; i < SEG; i++) {
        const a = i / SEG * TAU, b = (i + 1) / SEG * TAU, ca = Math.cos(a), sa = Math.sin(a), cb = Math.cos(b), sb = Math.sin(b);
        B.quad(V(r0 * ca, r0 * sa, s * z1, 0, 0, s, k), V(r0 * cb, r0 * sb, s * z1, 0, 0, s, k), V(r1 * cb, r1 * sb, s * z1, 0, 0, s, k), V(r1 * ca, r1 * sa, s * z1, 0, 0, s, k));
        B.quad(V(r1 * ca, r1 * sa, s * z0, ca, sa, 0, k), V(r1 * cb, r1 * sb, s * z0, cb, sb, 0, k), V(r1 * cb, r1 * sb, s * z1, cb, sb, 0, k), V(r1 * ca, r1 * sa, s * z1, ca, sa, 0, k));
        if (r0 > 0) B.quad(V(r0 * ca, r0 * sa, s * z0, -ca, -sa, 0, k), V(r0 * cb, r0 * sb, s * z0, -cb, -sb, 0, k), V(r0 * cb, r0 * sb, s * z1, -cb, -sb, 0, k), V(r0 * ca, r0 * sa, s * z1, -ca, -sa, 0, k));
      }
    };
    const box = (x0, x1, y0, y1, z0, z1, k) => {
      const P = [[x0, y0, z0], [x1, y0, z0], [x1, y1, z0], [x0, y1, z0], [x0, y0, z1], [x1, y0, z1], [x1, y1, z1], [x0, y1, z1]];
      const F = [[0, 1, 2, 3, 0, 0, -1], [4, 5, 6, 7, 0, 0, 1], [0, 1, 5, 4, 0, -1, 0], [3, 2, 6, 7, 0, 1, 0], [0, 3, 7, 4, -1, 0, 0], [1, 2, 6, 5, 1, 0, 0]];
      for (const f of F) B.quad(...[0, 1, 2, 3].map(j => V(...P[f[j]], f[4], f[5], f[6], k)));
    };
    for (const s of [1, -1]) {
      for (let i = 0; i < n; i++) {
        const j = (i + 1) % n, ci = Math.cos(ang[i]), si = Math.sin(ang[i]), cj = Math.cos(ang[j]), sj = Math.sin(ang[j]), m = SN[i], h = Math.SQRT1_2;
        // the rim's face, from the inner circle to the inset outline; the chamfer down to the toothed wall
        B.quad(V(ra * ci, ra * si, s * hz, 0, 0, s, 0), V(ra * cj, ra * sj, s * hz, 0, 0, s, 0), V(I[j][0], I[j][1], s * hz, 0, 0, s, 0), V(I[i][0], I[i][1], s * hz, 0, 0, s, 0));
        B.quad(V(I[i][0], I[i][1], s * hz, m[0] * h, m[1] * h, s * h, 2), V(I[j][0], I[j][1], s * hz, m[0] * h, m[1] * h, s * h, 2),
          V(O[j][0], O[j][1], s * (hz - ch), m[0] * h, m[1] * h, s * h, 2), V(O[i][0], O[i][1], s * (hz - ch), m[0] * h, m[1] * h, s * h, 2));
        // the rim's inner wall down to the web, and the web
        B.quad(V(ra * ci, ra * si, s * hw, -ci, -si, 0, 1), V(ra * cj, ra * sj, s * hw, -cj, -sj, 0, 1), V(ra * cj, ra * sj, s * hz, -cj, -sj, 0, 1), V(ra * ci, ra * si, s * hz, -ci, -si, 0, 1));
        B.tri(V(0, 0, s * hw, 0, 0, s, 0), V(ra * ci, ra * si, s * hw, 0, 0, s, 0), V(ra * cj, ra * sj, s * hw, 0, 0, s, 0));
      }
      // the hub: a dot in a circle; the coupling gear's smaller, between its two bands
      if (pair) { ring(0.12, 0.17, hw, hw + 0.04, s, 3); ring(0, 0.06, hw, hw + 0.05, s, 3); }
      else { ring(0.19, 0.27, hw, hw + 0.04, s, 3); ring(0, 0.085, hw, hw + 0.05, s, 3); }
      if (pair) for (const y of [-0.31, 0.31]) box(-0.7, 0.7, y - 0.05, y + 0.05, s > 0 ? hz - 0.02 : -hz - 0.03, s > 0 ? hz + 0.03 : -hz + 0.02, 4);
    }
    // the toothed wall
    for (let i = 0; i < n; i++) {
      const j = (i + 1) % n, m = SN[i], z = hz - ch;
      B.quad(V(O[i][0], O[i][1], z, m[0], m[1], 0, 1), V(O[j][0], O[j][1], z, m[0], m[1], 0, 1), V(O[j][0], O[j][1], -z, m[0], m[1], 0, 1), V(O[i][0], O[i][1], -z, m[0], m[1], 0, 1));
    }
    return B.geo();
  }
  const _rim = [0, 0, 0];
  function gears(max, teeth = 12) {
    const m = mat(VGEAR, FGEAR, { side: THREE.FrontSide, uniforms: { uWhite: { value: new THREE.Color(...WHITE) } } }), X = { aRim: 3, aGlow: 1 };
    const plain = pool(gearGeo(teeth, false), m, max, X), pair = pool(gearGeo(teeth, true), m, max, X), group = new THREE.Group();
    group.add(plain.mesh, pair.mesh);
    const P = { mesh: group, plain, pair, max, pitch: Math.PI * 2 / teeth, pitchR: 0.9 };
    P.begin = () => { plain.begin(); pair.begin(); };
    P.end = () => { plain.end(); pair.end(); };
    P.add = (c, axis, R, angle, col, alpha, opts) => {
      if (R <= 0 || alpha <= 0.004) return -1;
      const two = opts === true || !!(opts && opts.pair), Q = two ? pair : plain;
      _d.set(axis[0], axis[1], axis[2]).normalize();
      _q.setFromUnitVectors(_z, _d).multiply(_q2.setFromAxisAngle(_z, angle));
      _m.compose(_p.set(c[0], c[1], c[2]), _q, _s.set(R, R, R));
      const cc = Array.isArray(col) ? col : rgb(col), i = Q.put(_m, cc, alpha, 0);
      if (i < 0) return i;
      let r = opts && opts.rim;
      if (!r && cc === BLUE) r = RIM;
      if (!r) {   // a lighter, fuller version of the colour
        for (let k = 0; k < 3; k++) _rim[k] = cc[k] + (1 - cc[k]) * 0.3;
        const mx = Math.max(_rim[0], _rim[1], _rim[2], 1e-3);
        for (let k = 0; k < 3; k++) _rim[k] /= mx;
        r = _rim;
      } else if (!Array.isArray(r)) r = rgb(r);
      const a = Q.attrs.aRim.array;
      a[3 * i] = r[0]; a[3 * i + 1] = r[1]; a[3 * i + 2] = r[2];
      Q.attrs.aGlow.array[i] = (opts && opts.glow) || 0;
      return i;
    };
    return P;
  }

  // ---------------------------------------------------------------- a qubit
  const NONE = {}, UP = [0, 1, 0], FRONT = [0, 0, 1], _a = [0, 0, 0], _b = [0, 0, 0], _l = [0, 0, 0];
  const at = (out, c, x, y, z) => { out[0] = c[0] + x; out[1] = c[1] + y; out[2] = c[2] + z; return out; };
  function qubit(pools, c, R, bloch, alpha, opts) {
    if (R <= 0 || alpha <= 0.004) return;
    const o = opts || NONE, k = o.at || 0, tint = o.tint || GLASS, col = o.col || INK, glow = o.glow || 0;
    const { glass: gl, rings: rg, tubes: tb, cones: cn, balls: bl, halos: hl } = pools;
    // the glass ball, its equator and its faint axis
    if (gl) gl.add(c, R, tint, alpha); else if (bl) bl.add(c, R, tint, 0.1 * alpha);
    if (rg) rg.add(c, UP, R, R * 0.016, tint, 0.6 * alpha);
    if (tb) tb.add(at(_a, c, 0, -R, 0), at(_b, c, 0, R, 0), R * 0.009, tint, 0.4 * alpha);
    // 0 above, 1 below, facing 'face'
    if (o.marks !== false) {
      const f = o.face || FRONT;
      _l[0] = f[1] * UP[2] - f[2] * UP[1]; _l[1] = f[2] * UP[0] - f[0] * UP[2]; _l[2] = f[0] * UP[1] - f[1] * UP[0];
      const ll = Math.hypot(_l[0], _l[1], _l[2]) || 1, w = R * 0.026;
      if (rg) rg.add(at(_a, c, 0, R * 1.27, 0), f, R * 0.08, w, INK, 0.85 * alpha);
      if (tb) {
        tb.add(at(_a, c, 0, -R * 1.16, 0), at(_b, c, 0, -R * 1.4, 0), w, INK, 0.85 * alpha);
        tb.add(at(_a, c, 0, -R * 1.16, 0), at(_b, c, _l[0] / ll * R * 0.08, -R * 1.22, _l[2] / ll * R * 0.08), w, INK, 0.85 * alpha);
      }
    }
    // the arrow: Bloch x along +x, z up, y along -z; turned round the vertical by spin
    let bx = bloch[k], by = bloch[k + 1], bz = bloch[k + 2];
    if (o.spin) { const cs = Math.cos(o.spin), sn = Math.sin(o.spin), x = bx * cs - by * sn; by = bx * sn + by * cs; bx = x; }
    const len = Math.min(1, Math.hypot(bx, by, bz)), L = len * R;
    if (len < 0.04) {
      if (bl) bl.add(c, R * 0.075, col, alpha);
      if (o.tip) at(o.tip, c, 0, 0, 0);
      return;
    }
    const dx = bx / len, dy = bz / len, dz = -by / len, h = Math.min(R * 0.32, L * 0.6), hr = R * 0.13 * Math.min(1, L / (R * 0.35));
    if (bl) bl.add(c, R * 0.075, col, alpha);
    at(_a, c, dx * (L - h), dy * (L - h), dz * (L - h));
    if (tb && L - h > R * 0.02) tb.add(c, _a, R * 0.048, col, alpha);
    _b[0] = dx; _b[1] = dy; _b[2] = dz;
    if (cn) cn.add(_a, _b, h, hr, col, alpha);
    at(_a, c, dx * L, dy * L, dz * L);
    if (o.tip) { o.tip[0] = _a[0]; o.tip[1] = _a[1]; o.tip[2] = _a[2]; }
    // shorter than the sphere: a dashed trace on to it
    if (tb && len < 0.96) tb.add(_a, at(_b, c, dx * R, dy * R, dz * R), R * 0.012, col, 0.35 * alpha, Math.max(2, Math.round((1 - len) * 8)));
    if (hl) hl.add(_a, R * (0.35 + 0.5 * glow), col, (0.2 + 0.6 * glow) * alpha);
  }

  // depth writes only while the set is fully in (fading glass would hide what is behind it)
  const depth = () => { const on = set.uA.value > 0.97; for (const m of set.mats) if (m.blending === THREE.NormalBlending) m.depthWrite = on; };
  const mix = (a, b, t, out) => { const o = out || [0, 0, 0]; o[0] = a[0] + (b[0] - a[0]) * t; o[1] = a[1] + (b[1] - a[1]) * t; o[2] = a[2] + (b[2] - a[2]) * t; return o; };
  const quat = (out, axis, angle) => {
    const l = Math.hypot(axis[0], axis[1], axis[2]) || 1, s = Math.sin(angle / 2) / l;
    out[0] = axis[0] * s; out[1] = axis[1] * s; out[2] = axis[2] * s; out[3] = Math.cos(angle / 2); return out;
  };
  const LHEX = ['#e69f00', '#56b4e9', '#f0e442', '#cc79a7'];
  const LCOL = LHEX.concat('#9aa8bd').map(rgb);
  const BLUE = rgb('#0072b2'), RIM = rgb('#4fb0ff'), WHITE = rgb('#f2f6ff'), DARK = rgb('#0b1322'), INK = rgb('#e7eef8'), GLASS = rgb('#8cc6ff');
  return {
    tubes, rings, balls, boxes, halos, cones, glass, tiles, gears, qubit, depth, mix, quat, ID: [0, 0, 0, 1],
    LETTERS: 'ACGT', GLYPHS, LHEX, LCOL, BLUE, RIM, WHITE, DARK, INK, GLASS,
    GREEN: rgb('#009e73'), GREENLIT: rgb('#3fd6a6'), RED: rgb('#ff5a4b'), GREY: rgb('#5d6676'), CYAN: rgb('#46d9ff'), AMBER: rgb('#ffb43b'),
  };
};

// The letters set of the mutation story (chapters 1 and 3): DNA as a text in four letters. A double helix of 24 base
// pairs turns slowly (rungs in the letters' colours, A-T and C-G); eight letters of its top strand peel away and
// straighten into a row of tiles, the ancestor of Figure 1 (MUT_DATA.fig1); two copies slide out of it and in each
// two letters swap with a flash (the tile turns over and comes back framed white: descendant 1's T->C at 5 and A->G at
// 6, then descendant 2's G->A at 3 and C->T at 8). Then the ancestor's first tile comes forward and opens into its two
// qubits (glass spheres, arrows up for 0 and down for 1); the four codes in turn (A |00>, C |01>, G |10>, T |11>); the
// arrows tilt into a mix (by default the rule's mix at point 2: MMATH.path(uneven, A, POINTS[1])), the tile turns
// into a '?' with a ring in four colours (the mix's shares); and the read-outs: the arrows spin like a coin, land on a
// letter, a small tile pops out and falls onto its pile (MMATH.sample by index, so seeking gives the same piles); four
// piles, one per letter, grow as tall as the chances.
// Everything follows the params and t; only the switch of code (a step param) eases in its own time (0.6 s; a seek or
// the first frame shows the new code at once), as the qubits story's cube does.
SETS.letters = function (K) {
  const { THREE, clamp, lerp, prog, smooth } = K;
  const set = K.newSet('letters');
  const M = MMATH, D = MUT_DATA, LK = MLOOK(K, set);
  const PI = Math.PI, TAU = PI * 2;
  const ANC = M.toIdx(D.fig1.ancestor), NL = ANC.length;
  // the two copies of Figure 1: their swaps (MUT_DATA gives 1-based positions)
  const COPIES = ['d1', 'd2'].map(k => ({ key: k, seq: M.toIdx(D.fig1[k]),
    swaps: D.fig1.swaps[k].map(([pos, a, b]) => ({ j: pos - 1, from: M.idx(a), to: M.idx(b) })) }));
  COPIES.forEach(C => { C.at = new Int8Array(NL).fill(-1); C.swaps.forEach((x, w) => { C.at[x.j] = w; }); });
  const RULE = M.model(M.DEFAULT), EVEN = new Float64Array([0.25, 0.25, 0.25, 0.25]);
  const READ_MAX = 400;   // the most read-outs the piles hold (explore: read out 1 or 100 more)

  // ---------------------------------------------------------------- the helix
  // B-DNA's proportions: 10.5 pairs a turn, the two strands 140 degrees apart round the axis (the grooves). The axis
  // runs along x; the top strand carries the ancestor's eight letters at bases AT .. AT + 7, the rest seeded.
  const NBP = 24, AT = 8, RISE = 0.096, HR = 0.27, TWIST = TAU / 10.5, GROOVE = PI * 0.78, SUB = 3, SPIN = 0.3;
  const X0 = -(NBP - 1) / 2 * RISE, SEQ = new Uint8Array(NBP), rr = K.rng(11);
  for (let k = 0; k < NBP; k++) SEQ[k] = k >= AT && k < AT + NL ? ANC[k - AT] : Math.floor(rr() * 4);
  // (A-T and C-G: the partner of letter i is 3 - i)
  const hp = (s, u, spin, out) => {
    const a = u * TWIST + spin + (s ? GROOVE : 0);
    out[0] = X0 + u * RISE; out[1] = HR * Math.cos(a); out[2] = HR * Math.sin(a);
    return out;
  };
  const BONE = [0.62, 0.72, 0.9];

  // ---------------------------------------------------------------- the rows: the ancestor and its two copies
  // fanned out a little in depth, each copy lower and further forward (a family in the making)
  const Y = new THREE.Vector3(0, 1, 0), SP = 0.2, TS = 0.17, XAX = [1, 0, 0], UP = [0, 1, 0];
  const ROWS = [{ c: [0, 0.52, -0.12], yaw: 0 }, { c: [-0.26, 0.04, 0.16], yaw: 0.2 }, { c: [0.26, -0.44, 0.44], yaw: -0.2 }];
  ROWS.forEach(R => {
    R.q = new THREE.Quaternion().setFromAxisAngle(Y, R.yaw);
    R.pos = [...Array(NL)].map((_, j) => [R.c[0] + Math.cos(R.yaw) * (j - 3.5) * SP, R.c[1], R.c[2] - Math.sin(R.yaw) * (j - 3.5) * SP]);
    // the strand behind the tiles
    R.back = R.pos.map(p => [p[0] - Math.sin(R.yaw) * 0.05, p[1], p[2] - Math.cos(R.yaw) * 0.05]);
  });

  // ---------------------------------------------------------------- the qubits and the piles
  const HERO = [0, 0.64, 0.3], HS = 0.28, QP = [[-0.42, 0.04, 0.3], [0.42, 0.04, 0.3]], QR = 0.25;
  const PILE_X = [-0.63, -0.21, 0.21, 0.63], PILE_Y = -1.04, PILE_Z = 0.5, PT = 0.09, TH = PT * 0.24 + 0.004;
  const QFLAT = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -PI / 2);

  const tubes = LK.tubes(340), balls = LK.balls(110), tiles = LK.tiles(440), glass = LK.glass(2), rings = LK.rings(16),
    cones = LK.cones(2), halos = LK.halos(40);
  set.group.add(tubes.mesh, balls.mesh, tiles.mesh, glass.mesh, rings.mesh, cones.mesh, halos.mesh);
  const QPOOLS = { glass, rings, tubes, cones, balls, halos };

  // scratch (nothing is allocated per frame)
  const _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _d = [0, 0, 0], _e = [0, 0, 0], _f = [0, 0, 0];
  const _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _qr = new THREE.Quaternion(), _m4 = new THREE.Matrix4();
  const _vx = new THREE.Vector3(), _vy = new THREE.Vector3(), _vz = new THREE.Vector3();
  const lerp3 = (out, a, b, s) => { out[0] = a[0] + (b[0] - a[0]) * s; out[1] = a[1] + (b[1] - a[1]) * s; out[2] = a[2] + (b[2] - a[2]) * s; return out; };
  // a quaternion that turns a tile to face along n with its letter's top along u (u perpendicular to n)
  function faceQ(out, n, u) {
    _vz.set(n[0], n[1], n[2]).normalize(); _vy.set(u[0], u[1], u[2]).normalize(); _vx.crossVectors(_vy, _vz);
    _m4.makeBasis(_vx, _vy, _vz);
    return out.setFromRotationMatrix(_m4);
  }
  // a ring of 48 short tubes round c (across 'axis'), split into four arcs as long as the shares p (A at the top,
  // then C, G, T clockwise as seen from the axis' side)
  const RING_N = 48, _u = [0, 0, 0], _v = [0, 0, 0];
  function shareRing(c, axis, R, r, p, alpha) {
    if (alpha <= 0.004) return;
    const al = Math.hypot(axis[0], axis[1], axis[2]) || 1, ax = axis[0] / al, ay = axis[1] / al, az = axis[2] / al;
    // u: up, kept perpendicular to the axis; v = u x axis (clockwise seen from the axis' side)
    let ux = -ay * ax, uy = 1 - ay * ay, uz = -ay * az;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = uy * az - uz * ay, vy = uz * ax - ux * az, vz = ux * ay - uy * ax;
    const tot = (p[0] + p[1] + p[2] + p[3]) || 1;
    let L = 0, edge = p[0] / tot;
    for (let s = 0; s < RING_N; s++) {
      const f = (s + 0.5) / RING_N;
      while (L < 3 && f > edge) { L++; edge += p[L] / tot; }
      const a0 = s / RING_N * TAU, a1 = (s + 1) / RING_N * TAU;
      _u[0] = c[0] + R * (Math.cos(a0) * ux + Math.sin(a0) * vx); _u[1] = c[1] + R * (Math.cos(a0) * uy + Math.sin(a0) * vy); _u[2] = c[2] + R * (Math.cos(a0) * uz + Math.sin(a0) * vz);
      _v[0] = c[0] + R * (Math.cos(a1) * ux + Math.sin(a1) * vx); _v[1] = c[1] + R * (Math.cos(a1) * uy + Math.sin(a1) * vy); _v[2] = c[2] + R * (Math.cos(a1) * uz + Math.sin(a1) * vz);
      tubes.add(_u, _v, r, LK.LCOL[L], alpha, 0);
    }
  }
  // the switch of code eases in its own time (see the header)
  const sw = { from: 0, to: 0, k: 1, first: true }, heroQ = new THREE.Quaternion(), RING_AX = [0, 0, 1];
  // what the anchors and labels read (kept current by update)
  const now = { code: 0, mixed: 0, heroS: HS, heroA: 1, p: new Float64Array(4), counts: new Uint16Array(4), n: 0, layers: new Float64Array(4), F: 1, hero: HERO.slice(),
    q: [QP[0].slice(), QP[1].slice()], qr: QR, open: 0 };
  const pMix = new Float64Array(4), pCode = new Float64Array(4), pShow = new Float64Array(4), bl = new Float64Array(6);
  const QO = [{ at: 0, col: LK.INK, glow: 0, spin: 0 }, { at: 3, col: LK.INK, glow: 0, spin: 0 }];
  // the mix being read: the rule's mix after a branch of length tm from letter c, or the even mix
  function targetMix(S, c, out) {
    if (Math.round(S.letters_target) === 1) { out.set(EVEN); return out; }
    return M.path(RULE, c, clamp(S.letters_time, 0, 3), out);
  }

  function update(S, t, dt) {
    LK.depth();
    tubes.begin(); balls.begin(); tiles.begin(); glass.begin(); rings.begin(); cones.begin(); halos.begin();
    const spin = t * SPIN, hA = clamp(S.letters_helix, 0, 1), peel = clamp(S.letters_peel, 0, 1), op = clamp(S.letters_open, 0, 1);
    const rowsA = 1 - prog(op, 0.05, 0.5);
    now.open = op;

    // ---- the helix: the partner strand, its rungs, and the top strand where it has not peeled away
    const peelJ = j => prog(peel, 0.25 + 0.05 * j, 0.65 + 0.05 * j), growJ = j => prog(peel, 0.02 * j, 0.25 + 0.02 * j);
    if (hA > 0.004 || peel > 0) {
      for (let k = 0; k < NBP; k++) {
        const pj = k - AT, isP = pj >= 0 && pj < NL, g = isP ? growJ(pj) : 0, m = isP ? peelJ(pj) : 0;
        hp(0, k, spin, _a); hp(1, k, spin, _b);
        // rungs: two halves in the letters' colours, a small gap between them
        if (hA > 0.004) {
          lerp3(_c, _a, _b, 0.47); lerp3(_d, _b, _a, 0.47);
          if (g < 0.999) { tubes.add(_a, _c, 0.024, LK.LCOL[SEQ[k]], hA * (1 - g), 0); balls.add(_c, 0.024, LK.LCOL[SEQ[k]], hA * (1 - g)); }
          tubes.add(_b, _d, 0.024, LK.LCOL[3 - SEQ[k]], hA, 0); balls.add(_d, 0.024, LK.LCOL[3 - SEQ[k]], hA);
          balls.add(_b, 0.034, BONE, hA);
          if (m < 0.999) balls.add(_a, 0.034, BONE, hA * (1 - m));
        }
        // the backbones: smooth helical tubes (the peeling part straightens towards its row)
        if (k < NBP - 1) for (let s = 0; s < SUB; s++) {
          const u0 = k + s / SUB, u1 = k + (s + 1) / SUB;
          if (hA > 0.004) tubes.add(hp(1, u0, spin, _c), hp(1, u1, spin, _d), 0.02, BONE, hA, 0);
          const q0 = k - AT + s / SUB, q1 = k - AT + (s + 1) / SUB, in0 = q0 >= 0 && q0 <= NL - 1, in1 = q1 >= 0 && q1 <= NL - 1;
          hp(0, u0, spin, _c); hp(0, u1, spin, _d);
          if (in0 && in1) {
            // the peeling stretch: each point eases from the helix to the line behind the row
            const ja = Math.floor(q0), fa = q0 - ja, jb = Math.min(NL - 1, ja + 1);
            const ma = lerp(peelJ(ja), peelJ(jb), fa), m1 = lerp(peelJ(Math.floor(q1)), peelJ(Math.min(NL - 1, Math.floor(q1) + 1)), q1 - Math.floor(q1));
            lerp3(_e, ROWS[0].back[ja], ROWS[0].back[jb], fa); lerp3(_c, _c, _e, smooth(ma));
            const jc = Math.floor(q1), jd = Math.min(NL - 1, jc + 1);
            lerp3(_f, ROWS[0].back[jc], ROWS[0].back[jd], q1 - jc); lerp3(_d, _d, _f, smooth(m1));
            const a = Math.max(hA, Math.min(ma, m1)) * lerp(1, rowsA, Math.min(ma, m1));
            tubes.add(_c, _d, 0.02, BONE, a, 0);
          } else if (in0 || in1) {
            tubes.add(_c, _d, 0.02, BONE, hA * (1 - peelJ(in0 ? NL - 1 : 0)), 0);   // (the break where the strand leaves)
          } else if (hA > 0.004) tubes.add(_c, _d, 0.02, BONE, hA, 0);
        }
      }
    }

    // ---- the ancestor's tiles: they grow out of their rungs, peel away and line up (the first may come forward)
    const heroK = prog(op, 0, 0.45);
    for (let j = 0; j < NL; j++) {
      const k = AT + j, g = growJ(j), m = smooth(peelJ(j));
      let al = g * Math.max(hA, m), size = lerp(0.1 * g, TS, m);
      hp(0, k, spin, _a); hp(1, k, spin, _b); lerp3(_c, _a, _b, 0.25);
      _d[0] = 0; _d[1] = _b[1] - _a[1]; _d[2] = _b[2] - _a[2];
      faceQ(_q, XAX, _d);
      _q.slerp(ROWS[0].q, m);
      lerp3(_e, _c, ROWS[0].pos[j], m); _e[2] += 0.22 * Math.sin(PI * m);
      if (j === 0 && op > 0) {
        // the hero: forward, bigger, facing you (drawn with its qubits below)
        lerp3(now.hero, _e, HERO, smooth(heroK)); now.hero[2] += 0.25 * Math.sin(PI * heroK);
        now.heroS = lerp(size, HS, smooth(heroK)); now.heroA = lerp(al, 1, heroK);
        heroQ.copy(_q).slerp(_qr.set(0, 0, 0, 1), heroK);
        continue;
      }
      if (al * rowsA > 0.004) tiles.add(_e, _q, size, ANC[j], al * rowsA, 0, 0);
    }
    // the row's strand, once lined up, stays with it

    // ---- the copies: slide out of the ancestor's row, then two letters swap in each
    for (let c = 0; c < 2; c++) {
      const cp = clamp(S[c ? 'letters_copy2' : 'letters_copy1'], 0, 1), mu = clamp(S[c ? 'letters_mut2' : 'letters_mut1'], 0, 1), R = ROWS[c + 1];
      const ca = prog(cp, 0, 0.12) * rowsA;
      if (ca <= 0.004) continue;
      // the copy's way: a faint green trace from the ancestor (time passing)
      _a[0] = ROWS[0].c[0]; _a[1] = ROWS[0].c[1] - 0.11; _a[2] = ROWS[0].c[2];
      _b[0] = lerp(_a[0], R.c[0], prog(cp, 0, 0.8)); _b[1] = lerp(_a[1], R.c[1] + 0.11, prog(cp, 0, 0.8)); _b[2] = lerp(_a[2], R.c[2], prog(cp, 0, 0.8));
      tubes.add(_a, _b, 0.006, LK.GREENLIT, 0.5 * ca, 9);
      for (let j = 0; j < NL; j++) {
        const s = smooth(prog(cp, 0.03 * j, 0.75 + 0.03 * j));
        lerp3(_e, ROWS[0].pos[j], R.pos[j], s); _e[2] += 0.16 * Math.sin(PI * s);
        _q.copy(ROWS[0].q).slerp(R.q, s);
        let L = ANC[j], frame = 0, glow = 0;
        const si = c ? 1 : 0, w = COPIES[si].at[j];
        if (w >= 0) {
          const f = prog(mu, w * 0.5 + 0.05, w * 0.5 + 0.42), sp = COPIES[si].swaps[w];
          L = f < 0.5 ? sp.from : sp.to; frame = prog(f, 0.55, 0.9); glow = 0.9 * Math.sin(PI * f);
          _q.multiply(_q2.setFromAxisAngle(Y, PI * f));   // the tile turns over and shows its new letter
          if (f > 0.02 && f < 0.98) {
            halos.add(_e, 0.35 + 0.4 * f, LK.LCOL[sp.to], 0.8 * Math.sin(PI * f) * ca);
            _b[0] = Math.sin(R.yaw); _b[1] = 0; _b[2] = Math.cos(R.yaw);
            rings.add(_e, _b, 0.1 + 0.22 * f, 0.008, LK.WHITE, (1 - f) * ca, 0);
          }
        }
        tiles.add(_e, _q, TS, L, ca, frame, glow);
        if (j < NL - 1) {
          const s2 = smooth(prog(cp, 0.03 * (j + 1), 0.75 + 0.03 * (j + 1)));
          tubes.add(lerp3(_a, ROWS[0].back[j], R.back[j], s), lerp3(_b, ROWS[0].back[j + 1], R.back[j + 1], s2), 0.014, BONE, ca * prog(cp, 0.7, 1), 0);
        }
      }
    }

    // ---- the hero tile and its two qubits
    const mixL = clamp(S.letters_mix, 0, 1), target = clamp(Math.round(S.letters_code), 0, 3);
    {
      const snap = sw.first || !(dt > 0) || dt > 0.25;
      sw.first = false;
      if (target !== sw.to) { if (sw.k >= 0.5) sw.from = sw.to; sw.to = target; sw.k = snap ? 1 : 0; }
      else sw.k = snap ? 1 : Math.min(1, sw.k + dt / 0.6);
    }
    const ks = smooth(sw.k);
    // the code shown, qubit by qubit (each arrow turns on its own: no mix of the two while the code changes)
    const th1 = PI * lerp(sw.from >> 1, sw.to >> 1, ks), th2 = PI * lerp(sw.from & 1, sw.to & 1, ks);
    const c1 = Math.cos(th1 / 2), s1 = Math.sin(th1 / 2), c2 = Math.cos(th2 / 2), s2 = Math.sin(th2 / 2);
    pCode[0] = c1 * c1 * c2 * c2; pCode[1] = c1 * c1 * s2 * s2; pCode[2] = s1 * s1 * c2 * c2; pCode[3] = s1 * s1 * s2 * s2;
    targetMix(S, sw.to, pMix);
    for (let i = 0; i < 4; i++) now.p[i] = pShow[i] = lerp(pCode[i], pMix[i], mixL);
    now.code = sw.to; now.mixed = mixL;

    // read-outs: read-out k (1-based) plays while letters_reads runs from k - 1 to k
    const reads = clamp(S.letters_reads, 0, READ_MAX), kNow = Math.ceil(reads - 1e-6), fNow = kNow >= 1 ? reads - (kNow - 1) : 1;
    const seed = Math.round(S.letters_seed) || 1, nDone = fNow >= 0.95 ? kNow : kNow - 1;
    const cnt = now.counts;
    cnt[0] = cnt[1] = cnt[2] = cnt[3] = 0;
    let flyL = -1, flySlot = 0;
    for (let k = 1; k <= kNow; k++) {
      const L = M.sample(pShow, seed, k);
      if (k === kNow && fNow < 0.95) { flyL = L; flySlot = cnt[L]; break; }
      cnt[L]++;
    }
    now.n = nDone;
    const F = kNow <= 30 ? 1 : kNow <= 120 ? 2 : kNow <= 270 ? 3 : 4;   // (tiles a layer, a side: the piles stay low)
    now.F = F;
    let spinA = 0, coll = 0;
    if (flyL >= 0) {
      spinA = 4 * PI * smooth(prog(fNow, 0, 0.36));   // (whole turns: the arrows come back where they were)
      coll = prog(fNow, 0.3, 0.46) * (1 - prog(fNow, 0.62, 0.95));
      // the arrows land on the letter read, then return to the mix (a fresh copy for the next read-out)
      for (let i = 0; i < 4; i++) pShow[i] = lerp(pShow[i], i === flyL ? 1 : 0, coll);
    }

    const qa = prog(op, 0.35, 1);
    if (op > 0.004) {
      // the tile: the code shown, or '?' once mixed (it turns over at each change)
      const mixFlip = prog(mixL, 0.25, 0.75), turn = PI * (ks < 1 ? ks : 0) + PI * mixFlip;
      const L = mixFlip >= 0.5 ? 4 : ks < 0.5 ? sw.from : sw.to;
      _q.copy(heroQ).multiply(_q2.setFromAxisAngle(Y, turn));
      const pop = flyL >= 0 ? Math.sin(PI * prog(fNow, 0.36, 0.56)) : 0;
      tiles.add(now.hero, _q, now.heroS, L, now.heroA, 0, 0.15 + 0.5 * pop);
      shareRing(now.hero, RING_AX, HS * 0.82, 0.011, now.p, now.heroA * prog(mixL, 0.4, 1));
      // the qubits open out of the tile
      for (let q = 0; q < 2; q++) {
        lerp3(now.q[q], now.hero, QP[q], smooth(qa));
        const R = QR * smooth(qa);
        now.qr = R;
        M.bloch(pShow, bl);
        QO[q].spin = spinA; QO[q].glow = 0.25 + 0.6 * coll;
        if (R > 0.01) LK.qubit(QPOOLS, now.q[q], R, bl, qa, QO[q]);
      }
    }

    // ---- the piles: one per letter, tiles lying flat, as many as were read
    const pileA = prog(reads, 0, 0.6) * qa, g = F, cell = PT * 1.08;
    const slotPos = (L, m, out) => {
      const per = g * g, layer = Math.floor(m / per), c = m % per;
      out[0] = PILE_X[L] + (c % g - (g - 1) / 2) * cell; out[1] = PILE_Y + (layer + 0.5) * TH; out[2] = PILE_Z + (Math.floor(c / g) - (g - 1) / 2) * cell;
      return out;
    };
    if (pileA > 0.004) {
      for (let L = 0; L < 4; L++) {
        _a[0] = PILE_X[L]; _a[1] = PILE_Y - 0.004; _a[2] = PILE_Z;
        rings.add(_a, UP, 0.08 + 0.05 * (g - 1), 0.006, LK.LCOL[L], 0.7 * pileA, 0);
        for (let m = 0; m < cnt[L]; m++) {
          slotPos(L, m, _b);
          _q.copy(QFLAT).premultiply(_q2.setFromAxisAngle(Y, (M.hash(L * 4096 + m, 3) - 0.5) * 0.4));
          tiles.add(_b, _q, PT, L, pileA, 0, 0);
        }
        now.layers[L] = Math.ceil(cnt[L] / (g * g));
      }
    }
    // the read-out in flight: it pops out of the tile and falls onto its pile
    if (flyL >= 0 && qa > 0.004) {
      const s = smooth(prog(fNow, 0.46, 0.95)), sz = lerp(0.14, PT, s);
      slotPos(flyL, flySlot, _b);
      _c[0] = now.hero[0]; _c[1] = now.hero[1] - 0.2; _c[2] = now.hero[2] + 0.18;   // (out of the tile's front)
      lerp3(_a, _c, _b, s); _a[1] += 0.3 * Math.sin(PI * s); _a[2] += 0.2 * Math.sin(PI * s);
      _q.set(0, 0, 0, 1).slerp(QFLAT, s);
      const pa = prog(fNow, 0.4, 0.5) * qa;
      tiles.add(_a, _q, sz, flyL, pa, 0, 0.5 * (1 - s));
      halos.add(_a, 0.25, LK.LCOL[flyL], 0.5 * pa * (1 - s));
    }

    tubes.end(); balls.end(); tiles.end(); glass.end(); rings.end(); cones.end(); halos.end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const rowEnd = R => [R.pos[0][0] - 0.1 * Math.cos(R.yaw), R.pos[0][1] + 0.19, R.pos[0][2] + 0.1 * Math.sin(R.yaw)];   // (above the row's start)
  const _t = [0, 0, 0];
  const anchors = {
    helix: [X0 + 3 * RISE, HR + 0.1, 0], centre: [0, 0, 0],
    ancestor: rowEnd(ROWS[0]), copy1: rowEnd(ROWS[1]), copy2: rowEnd(ROWS[2]),
    ancMid: ROWS[0].c.slice(), copy1Mid: ROWS[1].c.slice(), copy2Mid: ROWS[2].c.slice(),
    swap1: ROWS[1].pos[COPIES[0].swaps[0].j].slice(), swap2: ROWS[2].pos[COPIES[1].swaps[0].j].slice(),
    tile: () => [now.hero[0] + HS * 0.62, now.hero[1] + 0.04, now.hero[2]],
    qubit1: () => [now.q[0][0] - 0.06, now.q[0][1] - now.qr * 1.55, now.q[0][2]],
    qubit2: () => [now.q[1][0] - 0.06, now.q[1][1] - now.qr * 1.55, now.q[1][2]],
    piles: [0, PILE_Y + 0.02, PILE_Z + 0.3],
  };
  for (let L = 0; L < 4; L++) anchors['pile' + M.LETTERS[L]] = () => { _t[0] = PILE_X[L] - 0.03; _t[1] = PILE_Y + now.layers[L] * TH + 0.06; _t[2] = PILE_Z; return _t.slice(); };
  const swapsTxt = c => ' · ' + COPIES[c].swaps.map(s => `${M.LETTERS[s.from]}→${M.LETTERS[s.to]}`).join(', ');
  const rowsOn = S => 1 - prog(S.letters_open, 0.05, 0.4);
  const labels = [
    { text: ['DNA', ' · two strands of letter pairs'], at: 'helix', cls: 'cyn', alpha: S => clamp(S.letters_helix, 0, 1) * (1 - prog(S.letters_peel, 0, 0.3)) },
    { text: ['Ancestor', ''], at: 'ancestor', cls: '', alpha: S => prog(S.letters_peel, 0.85, 1) * rowsOn(S) },
    { text: ['Copy 1', swapsTxt(0)], at: 'copy1', cls: 'grn', alpha: S => prog(S.letters_copy1, 0.6, 1) * rowsOn(S) * prog(S.letters_mut1, 0, 0.05) },
    { text: ['Copy 2', swapsTxt(1)], at: 'copy2', cls: 'grn', alpha: S => prog(S.letters_copy2, 0.6, 1) * rowsOn(S) * prog(S.letters_mut2, 0, 0.05) },
    { text: () => (now.mixed > 0.5 ? ['A mix', ' of all four letters'] : [M.KETS[now.code], ' · ' + M.LETTERS[now.code]]), at: 'tile', cls: 'cyn', alpha: S => prog(S.letters_open, 0.6, 1) },
    { text: ['First qubit', ''], at: 'qubit1', cls: '', alpha: S => prog(S.letters_open, 0.7, 1) * (1 - prog(S.letters_reads, 0, 0.5)) },
    { text: ['Second qubit', ''], at: 'qubit2', cls: '', alpha: S => prog(S.letters_open, 0.7, 1) * (1 - prog(S.letters_reads, 0, 0.5)) },
  ];
  for (let L = 0; L < 4; L++) {
    labels.push({ text: () => [M.LETTERS[L], ' · ' + now.counts[L]], at: 'pile' + M.LETTERS[L], cls: '', minor: false,
      alpha: S => prog(S.letters_reads, 0.3, 1) * prog(S.letters_open, 0.8, 1) });
  }
  const cam = {
    default: [0, 9, 3.5, 0, 0.05, 0],
    helix: [-26, 14, 3.0, 0, 0, 0],
    peel: [8, 12, 3.4, 0, 0.18, 0.05],
    rows: [12, 10, 3.7, 0, 0.04, 0.12],
    qubits: [0, 6, 2.9, 0, 0.2, 0.3],
    reads: [0, 12, 3.95, 0, -0.14, 0.35],
  };
  const MIXES = [['A', 'A'], ['C', 'C'], ['G', 'G'], ['T', 'T'], ['even', 'Even'], ['rule', 'The rule\'s mix']];
  const controls = [
    { key: 'view', label: 'View', options: [['helix', 'Helix'], ['copies', 'Copies'], ['qubits', 'Qubits']] },
    { key: 'mix', label: 'Letter or mix', options: MIXES, when: v => v.view === 'qubits' },
    { key: 'time', label: 'Branch length', options: [['0.15', '0.15'], ['0.45', '0.45'], ['1', '1'], ['1.6', '1.6']], when: v => v.view === 'qubits' && v.mix === 'rule' },
  ];
  // c.reads (how many read-outs, from the engine's Letters tab) and c.seed (read again) are optional
  function explore(c) {
    const v = c.view || 'qubits', q = v === 'qubits', mix = c.mix || 'A', li = M.LETTERS.indexOf(mix);
    const tm = parseFloat(c.time);
    return {
      letters_helix: v === 'helix' ? 1 : 0, letters_peel: v === 'helix' ? 0 : 1,
      letters_copy1: v === 'copies' ? 1 : 0, letters_mut1: v === 'copies' ? 1 : 0, letters_copy2: v === 'copies' ? 1 : 0, letters_mut2: v === 'copies' ? 1 : 0,
      letters_open: q ? 1 : 0, letters_code: li >= 0 ? li : 0, letters_mix: li >= 0 ? 0 : 1, letters_target: mix === 'even' ? 1 : 0,
      letters_time: isFinite(tm) ? clamp(tm, 0, 3) : M.POINTS[1],
      letters_reads: q ? clamp(+c.reads || 0, 0, READ_MAX) : 0, letters_seed: Math.max(1, Math.round(+c.seed || 1)),
    };
  }
  // what the engine's Letters tab reads: the mix shown, the piles, and the chances of any choice
  const API = {
    READ_MAX,
    mix: () => Array.from(now.p),
    counts: () => Array.from(now.counts),
    reads: () => now.n,
    chances: (mix, time) => {
      const li = M.LETTERS.indexOf(mix);
      if (li >= 0) return [0, 1, 2, 3].map(i => (i === li ? 1 : 0));
      if (mix === 'even') return Array.from(EVEN);
      return Array.from(M.path(RULE, 0, isFinite(+time) ? +time : M.POINTS[1]));
    },
    bloch: mix => Array.from(M.bloch(API.chances(mix))),
  };
  return Object.assign(set, {
    params: { letters_a: 1, letters_helix: 1, letters_peel: 0, letters_copy1: 0, letters_mut1: 0, letters_copy2: 0, letters_mut2: 0,
      letters_open: 0, letters_code: 0, letters_mix: 0, letters_target: 0, letters_time: M.POINTS[1], letters_reads: 0, letters_seed: 1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};

// The tree set of the mutation story: the family tree in 3D (MMATH.familyTree: three levels of splits, eight tips, every
// mutation simulated exactly under the story's example model) and the poster's species tree ((s1, s2), s3;
// MMATH.speciesTree), crossfading. Branches are glass tubes, thick at the root and thin towards the tips, with a soft
// glowing core; they grow from the root as a level of change rises through the crown (heights are change: a branch rises
// by its length in expected swaps per letter), and the ancestor's eight letters ride up every branch as a small row of
// tiles: where a mutation happens it flashes, the letter changes (framed white: it differs from the ancestor) and a band
// in the new letter's colour stays on the branch. The tips show their sequences. A long and a short branch can be lit
// with their lengths; a gear sits on every branch (the circuit for one branch, turned as far as MMATH.turnAngle says),
// packets flow up through them and the tips write new sequences that follow the rule. On the species tree the gears are
// coupling gears and a glass "?" waits at the root. The stems at the species' tips are the stem set's (same frame).
// Everything follows the params and t. Rows of tiles turn round the vertical to face the viewer as one (the camera seen
// at the last frame), as the look's single tiles do.
SETS.tree = function (K) {
  const { THREE, clamp, lerp, prog } = K;
  const set = K.newSet('tree');
  const M = MMATH, LK = MLOOK(K, set), PI = Math.PI, UP = [0, 1, 0];
  const MODEL = M.DEFAULT, SPEEDS = [0.5, 1, 2, 4];
  const RAD = [0.046, 0.032, 0.023, 0.015];        // a branch's radius where each depth starts (it thins as it climbs)
  const SRAD = [0.05, 0.036, 0.026];               // the species tree's (two levels)
  const GEAR_U = 0.3, GEAR_R = [0.064, 0.054, 0.046], SGEAR_R = [0.075, 0.062];
  const NS = 32, RS = 10;                          // samples along a branch, sides round it
  const TS = 0.038, TP = 0.044, LIFT = 0.06, OUT = 0.035;   // the rows of letters: tile size, pitch, above and before the branch
  const FLASH = 0.12;                              // how far up a branch (in u) a mutation's flash lasts
  const RISE = 0.55, GAP = 1.1;                    // the machines' packets: rise per second, the height between two
  const L8 = 8;

  // ---------------------------------------------------------------- a curve's height and where it reaches a height
  // (MMATH.curve's height: a cubic Bezier through y0, y0 + dy / 2, y3 - 0.35 dy, y3, so it rises monotonically)
  function yAt(tr, b, u) {
    const B = tr.branches[b], y0 = tr.nodes[B.from].pos[1], y3 = tr.nodes[B.to].pos[1], dy = y3 - y0, v = 1 - u;
    return v * v * v * y0 + 3 * v * v * u * (y0 + 0.5 * dy) + 3 * v * u * u * (y3 - 0.35 * dy) + u * u * u * y3;
  }
  function uAt(tr, b, h) {
    const B = tr.branches[b], y0 = tr.nodes[B.from].pos[1], y3 = tr.nodes[B.to].pos[1];
    if (h <= y0) return 0;
    if (h >= y3) return 1;
    let lo = 0, hi = 1;
    for (let k = 0; k < 18; k++) { const m = (lo + hi) / 2; if (yAt(tr, b, m) < h) lo = m; else hi = m; }
    return (lo + hi) / 2;
  }

  // ---------------------------------------------------------------- the branches: glass tubes with a glowing core
  // one merged mesh per tree: per branch an outer shell and a thin core (aCore), aU along it (0 at the parent), aB its
  // index; per-branch uniforms: how far it has grown (uG, in u), its colour (uC) and brightness (uL)
  function branchMat(n) {
    const m = new THREE.ShaderMaterial({
      uniforms: { uA: set.uA, uK: { value: 1 }, uG: { value: new Float32Array(n) }, uL: { value: new Float32Array(n) },
        uC: { value: Array.from({ length: n }, () => new THREE.Vector3(1, 1, 1)) } },
      transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending,
      vertexShader: `
#define NBR ${n}
attribute float aU, aB, aCore;
uniform float uA, uK, uG[NBR], uL[NBR]; uniform vec3 uC[NBR];
varying vec3 vN, vV, vC; varying float vA, vU, vCore, vF;
void main() {
  int b = int(aB + 0.5);
  float g = uG[b];
  vC = uC[b]; vA = uA * uK * uL[b]; vU = g - aU; vCore = aCore;
  vF = (1.0 - smoothstep(0.0, 0.07, g - aU)) * step(g, 0.999);   // the growing tip glows
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vN = normalize(normalMatrix * normal); vV = -mv.xyz;
  gl_Position = projectionMatrix * mv;
  if (g <= 0.0 || vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
      fragmentShader: `
varying vec3 vN, vV, vC; varying float vA, vU, vCore, vF;
void main() {
  if (vU < 0.0) discard;
  vec3 n = normalize(vN), v = normalize(vV);
  float f = gl_FrontFacing ? 1.0 : 0.4, r = pow(1.0 - abs(dot(n, v)), 2.0);
  vec3 col; float a;
  if (vCore > 0.5) { col = mix(vC, vec3(1.0), 0.4) * (0.8 + 0.8 * vF); a = vA * f * (0.38 + 0.3 * (1.0 - r) + 0.5 * vF); }
  else { col = vC * (0.32 + 1.3 * r) + vec3(0.85, 1.0, 1.0) * vF * 0.7; a = vA * f * (0.05 + 0.75 * r + 0.35 * vF); }
  gl_FragColor = vec4(col, a);
}`,
    });
    set.mats.push(m);
    return m;
  }
  function branchGeo(tr, rad) {
    const nb = tr.branches.length, ring = (NS + 1) * RS, nv = nb * 2 * ring;
    const pos = new Float32Array(nv * 3), nrm = new Float32Array(nv * 3), au = new Float32Array(nv), ab = new Float32Array(nv), ac = new Float32Array(nv), idx = [];
    const p = [0, 0, 0], tg = [0, 0, 0], T = new THREE.Vector3(), N = new THREE.Vector3(), B = new THREE.Vector3();
    for (const br of tr.branches) {
      const r0 = rad[br.depth - 1], r1 = rad[br.depth];
      for (let i = 0; i <= NS; i++) {
        const u = i / NS;
        M.curve(tr, br.id, u, p); M.tangent(tr, br.id, u, tg);
        T.set(tg[0], tg[1], tg[2]).normalize();
        if (i === 0) N.set(1, 0, 0);
        N.addScaledVector(T, -N.dot(T)).normalize();   // carried along the curve, so the tube never twists
        B.crossVectors(T, N);
        const r = lerp(r0, r1, u) * (1 + 0.25 * Math.pow(1 - u, 6) * (br.depth === 1 ? 1 : 0));   // (a little flare at the root)
        for (let c = 0; c < 2; c++) for (let j = 0; j < RS; j++) {
          const a = j / RS * 2 * PI, cx = Math.cos(a), sx = Math.sin(a), rr = c ? r * 0.3 : r, v = (br.id * 2 + c) * ring + i * RS + j;
          const nx = cx * N.x + sx * B.x, ny = cx * N.y + sx * B.y, nz = cx * N.z + sx * B.z;
          pos[3 * v] = p[0] + nx * rr; pos[3 * v + 1] = p[1] + ny * rr; pos[3 * v + 2] = p[2] + nz * rr;
          nrm[3 * v] = nx; nrm[3 * v + 1] = ny; nrm[3 * v + 2] = nz;
          au[v] = u; ab[v] = br.id; ac[v] = c;
        }
      }
      for (let c = 0; c < 2; c++) for (let i = 0; i < NS; i++) for (let j = 0; j < RS; j++) {
        const o = (br.id * 2 + c) * ring, a = o + i * RS + j, b = o + i * RS + (j + 1) % RS, cc = a + RS, d = b + RS;
        idx.push(a, b, cc, b, d, cc);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    g.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
    g.setAttribute('aU', new THREE.BufferAttribute(au, 1));
    g.setAttribute('aB', new THREE.BufferAttribute(ab, 1));
    g.setAttribute('aCore', new THREE.BufferAttribute(ac, 1));
    g.setIndex(idx);
    return g;
  }
  const famMat = branchMat(14), spMat = branchMat(4);
  const famMesh = new THREE.Mesh(new THREE.BufferGeometry(), famMat), spMesh = new THREE.Mesh(new THREE.BufferGeometry(), spMat);
  famMesh.frustumCulled = spMesh.frustumCulled = false;
  famMesh.renderOrder = spMesh.renderOrder = 1;   // (after the solid pieces: glass glows over what is behind it, never hides it)
  set.group.add(famMesh, spMesh);

  // ---------------------------------------------------------------- the trees
  const SP = M.speciesTree();
  spMesh.geometry = branchGeo(SP, SRAD);
  const geoBySeed = new Map(), trees = new Map();
  // a family tree by seed and speed (the speed changes the lengths and the mutations, never the drawing)
  function family(seed, speed) {
    const key = `${seed}|${speed}`;
    let F = trees.get(key);
    if (F) return F;
    const tr = M.familyTree(seed, speed, MODEL);
    if (!geoBySeed.has(seed)) {
      // (explore can ask for any number of trees: keep the last few, free the rest)
      for (const [k, g] of geoBySeed) {
        if (geoBySeed.size < 6) break;
        if (g === famMesh.geometry) continue;
        g.dispose(); geoBySeed.delete(k);
        for (const [tk, T] of trees) if (T.seed === k) trees.delete(tk);
      }
      geoBySeed.set(seed, branchGeo(tr, RAD));
    }
    const anc = M.toIdx(tr.nodes[tr.root].seq), P = tr.branches.map(b => M.P(MODEL, b.len));
    const top = Math.max(...tr.nodes.map(n => n.pos[1]));
    const turn = tr.branches.map(b => M.turnAngle(MODEL, b.len));
    F = { tr, seed, speed, geo: geoBySeed.get(seed), anc, P, top, turn, idx: tr.nodes.map(n => M.toIdx(n.seq)) };
    trees.set(key, F);
    return F;
  }
  const spTurn = SP.branches.map(b => M.turnAngle(MODEL, b.len)), spTop = Math.max(...SP.nodes.map(n => n.pos[1]));

  // the sequences a packet of the machines writes (packet k): every branch's child read out letter by letter from row
  // `parent` of P(len) (MMATH.sample, seeded by the packet, the branch and the tree), parents before children. A small
  // ring of the last few packets, so nothing is allocated while they flow
  const PK = Array.from({ length: 8 }, () => ({ F: null, k: -1, seqs: Array.from({ length: 15 }, () => new Uint8Array(L8)) }));
  let pkNext = 0;
  function packet(F, k) {
    for (let i = 0; i < PK.length; i++) if (PK[i].F === F && PK[i].k === k) return PK[i].seqs;
    const e = PK[pkNext]; pkNext = (pkNext + 1) % PK.length;
    e.F = F; e.k = k;
    e.seqs[0].set(F.anc);
    for (const b of F.tr.branches) {
      const par = e.seqs[b.from], ch = e.seqs[b.to], Pm = F.P[b.id];
      for (let s = 0; s < L8; s++) ch[s] = M.sample(Pm.subarray(par[s] * 4, par[s] * 4 + 4), k * 7919 + b.id * 131 + F.seed * 104729 + 17, s);
    }
    return e.seqs;
  }

  // ---------------------------------------------------------------- the pieces drawn every frame
  const tiles = LK.tiles(210), tubes = LK.tubes(80), balls = LK.balls(60), halos = LK.halos(170), rings = LK.rings(70), glass = LK.glass(4), gears = LK.gears(20);
  set.group.add(tiles.mesh, tubes.mesh, balls.mesh, halos.mesh, rings.mesh, glass.mesh, gears.mesh);
  // the camera, seen as the last frame was drawn (rows of tiles turn to face it)
  const camW = new THREE.Vector3(0, 0, 40), camL = new THREE.Vector3();
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const probe = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    probe.frustumCulled = false;
    probe.onBeforeRender = (r, s, cam) => { camW.setFromMatrixPosition(cam.matrixWorld); };   // (no vertices: never drawn)
    set.group.add(probe);
  }
  const yawTo = (p) => Math.atan2(camL.x - p[0], camL.z - p[2]);

  const _p = [0, 0, 0], _t = [0, 0, 0], _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _q = [0, 0, 0, 1], _s = new Uint8Array(L8), _col = [0, 0, 0];
  const WHITE = LK.WHITE, GLASSC = [0.55, 0.78, 1.0], HOT = [0.75, 0.95, 1.0];
  const OPT_PAIR = { pair: true }, OPT_PICK = { glow: 0.9, rim: LK.CYAN }, OPT_PAIRPICK = { pair: true, glow: 0.9, rim: LK.CYAN };
  // a row of eight letters centred at c, turned to face the viewer; letters differing from the ancestor framed white,
  // glow (per site, or null) lights the tiles that just changed
  function row(c, seq, anc, alpha, glow, size) {
    const yaw = yawTo(c), cx = Math.cos(yaw), sz = -Math.sin(yaw), sp = (size || TS) / TS * TP;
    LK.quat(_q, UP, yaw);
    for (let s = 0; s < L8; s++) {
      const o = (s - 3.5) * sp;
      _a[0] = c[0] + cx * o; _a[1] = c[1]; _a[2] = c[2] + sz * o;
      tiles.add(_a, _q, size || TS, seq[s], alpha, seq[s] !== anc[s] ? 1 : 0, glow ? glow[s] : 0);
    }
  }
  // a point lifted above p and moved a little towards the viewer (where a row hangs)
  function rowAt(p, out) {
    const yaw = yawTo(p);
    out[0] = p[0] + Math.sin(yaw) * OUT; out[1] = p[1] + LIFT; out[2] = p[2] + Math.cos(yaw) * OUT;
    return out;
  }
  const GL = new Float32Array(L8);
  // how far a branch rises (its length): a dashed line out at the parent's height, then up to the child, with ticks
  function rise(tr, b, col, a) {
    const B = tr.branches[b], p0 = tr.nodes[B.from].pos, p1 = tr.nodes[B.to].pos;
    _a[0] = p1[0]; _a[1] = p0[1]; _a[2] = p1[2];
    tubes.add(p0, _a, 0.0045, col, 0.7 * a, 10);
    tubes.add(_a, p1, 0.007, col, 0.95 * a, 0);
    for (let k = 0; k < 2; k++) {
      const y = k ? p1[1] : p0[1];
      _b[0] = p1[0] - 0.04; _b[1] = y; _b[2] = p1[2]; _c[0] = p1[0] + 0.04; _c[1] = y; _c[2] = p1[2];
      tubes.add(_b, _c, 0.006, col, 0.95 * a, 0);
    }
  }
  // a gear on every branch grown past it (a machine per branch): turned as far as its branch is long, and turning on
  // while the machines run (faster on longer branches)
  function drawGears(tr, us, turn, alpha, radii, pair, pickF, gearA, flow, t) {
    const wind = prog(gearA, 0.25, 1);
    for (const B of tr.branches) {
      if (us[B.id] < GEAR_U) continue;
      const b = B.id, picked = b === pickF, a = alpha * (pickF >= 0 && !picked ? 0.45 : 1);
      if (a <= 0.003) continue;
      M.curve(tr, b, GEAR_U, _p); M.tangent(tr, b, GEAR_U, _t);
      const ang = 2.4 * turn[b] * wind + flow * t * 1.6 * turn[b];
      gears.add(_p, _t, radii[B.depth - 1], ang, LK.BLUE, a, pair ? (picked ? OPT_PAIRPICK : OPT_PAIR) : (picked ? OPT_PICK : undefined));
    }
  }
  // the packets flowing up: one every GAP of height, rising RISE a second, a bead where each crosses a grown branch
  function beads(tr, us, top, alpha, t) {
    for (let k = Math.floor(t * RISE / GAP); k >= 0; k--) {
      const hk = -1 + t * RISE - k * GAP;
      if (hk > top + 0.05) break;
      for (const B of tr.branches) {
        if (us[B.id] < 1) continue;
        const y0 = tr.nodes[B.from].pos[1], y1 = tr.nodes[B.to].pos[1];
        if (hk <= y0 || hk > y1) continue;
        M.curve(tr, B.id, uAt(tr, B.id, hk), _p);
        balls.add(_p, 0.017, WHITE, alpha);
        halos.add(_p, 0.12, LK.CYAN, 0.7 * alpha);
      }
    }
  }

  // what the frame shows now (for anchors, labels and the api)
  const now = { F: null, u: new Float32Array(14), su: new Float32Array(4), h: -1, pick: -1, hiA: 0, fam: 1, sp: 0 };
  now.F = family(1, 1);
  famMesh.geometry = now.F.geo;
  const branchMid = (tr, b, out) => M.curve(tr, b, 0.5, out);

  function update(S, t) {
    LK.depth();
    set.group.updateMatrixWorld();
    camL.copy(camW); set.group.worldToLocal(camL);
    const sp = clamp(S.tree_species, 0, 1), fa = 1 - sp, sa = sp;
    const seed = Math.max(1, Math.round(S.tree_seed)), speed = SPEEDS[clamp(Math.round(S.tree_speed), 0, SPEEDS.length - 1)];
    const F = now.F.seed === seed && now.F.speed === speed ? now.F : family(seed, speed), tr = F.tr;
    if (famMesh.geometry !== F.geo) famMesh.geometry = F.geo;
    now.F = F; now.fam = fa; now.sp = sa;
    const grow = clamp(S.tree_grow, 0, 1), seqA = clamp(S.tree_seq, 0, 1), hi = clamp(S.tree_hi, 0, 1);
    const gearA = clamp(S.tree_gears, 0, 1), flow = clamp(S.tree_flow, 0, 1), qA = clamp(S.tree_q, 0, 1);
    const pick = Math.round(S.tree_pick), pickF = pick >= 0 && pick < tr.branches.length ? pick : -1;
    now.pick = pickF; now.hiA = hi;
    // the level of change reached: it rises from the root past the highest tip
    const h = -1 + grow * (Math.max(F.top, spTop) + 1.001);
    now.h = h;
    tiles.begin(); tubes.begin(); balls.begin(); halos.begin(); rings.begin(); glass.begin(); gears.begin();

    // ---- the family tree
    const U = famMat.uniforms, HL = tr.highlight, focus = pickF >= 0 ? 1 : hi;
    famMat.uniforms.uK.value = fa; famMesh.visible = fa > 0.003;
    for (const B of tr.branches) {
      const b = B.id, u = uAt(tr, b, h), lit = pickF >= 0 ? b === pickF : (b === HL.long || b === HL.short);
      now.u[b] = u;
      U.uG.value[b] = u;
      U.uL.value[b] = lit ? 1 + 0.4 * focus : 1 - 0.62 * focus;
      const c = lit ? LK.mix(GLASSC, pickF >= 0 ? LK.CYAN : LK.GREENLIT, focus, _col) : GLASSC;
      U.uC.value[b].set(c[0], c[1], c[2]);
    }
    if (fa > 0.003) {
      const anc = F.anc;
      // the root, the ancestor's letters round it, the nodes reached
      glass.add(tr.nodes[tr.root].pos, 0.055, HOT, fa * 0.9);
      halos.add(tr.nodes[tr.root].pos, 0.32, HOT, fa * 0.45);
      if (seqA > 0.003) {
        const yaw = yawTo(tr.nodes[tr.root].pos), R0 = 0.25, dA = TP * 2.05 / R0;
        for (let s = 0; s < L8; s++) {
          const a = yaw + (s - 3.5) * dA;
          _a[0] = Math.sin(a) * R0; _a[1] = -1.06; _a[2] = Math.cos(a) * R0;
          LK.quat(_q, UP, a);
          tiles.add(_a, _q, TS * 2, anc[s], fa * seqA, 0, 0.15);
        }
      }
      for (const n of tr.nodes) {
        if (n.parent < 0 || now.u[n.branch] < 1) continue;
        const tip = n.tip >= 0;
        balls.add(n.pos, tip ? 0.016 : 0.022, HOT, fa);
        halos.add(n.pos, tip ? 0.09 : 0.14, HOT, fa * 0.45);
      }
      // the level of change rising through the crown
      const lv = Math.sin(PI * clamp(grow, 0, 1)) * fa;
      _a[0] = 0; _a[1] = h; _a[2] = 0;
      if (lv > 0.01) rings.add(_a, UP, 1.28, 0.004, LK.GREEN, 0.6 * lv, 56);
      // growing tips, mutation bands and flashes, and the letters riding up
      const flowOn = flow > 0.003;
      for (const B of tr.branches) {
        const b = B.id, u = now.u[b];
        if (u <= 0) continue;
        const lit = pickF >= 0 ? b === pickF : (b === HL.long || b === HL.short), dim = lit ? 1 : 1 - 0.55 * focus;
        if (u < 1) { M.curve(tr, b, u, _p); halos.add(_p, 0.13, HOT, 0.8 * fa); }
        GL.fill(0);
        for (const mu of B.muts) {
          if (mu.at > u) break;
          M.curve(tr, b, mu.at, _p); M.tangent(tr, b, mu.at, _t);
          const r = lerp(RAD[B.depth - 1], RAD[B.depth], mu.at) * 1.35;
          rings.add(_p, _t, r, 0.0055, LK.LCOL[mu.to], fa * dim, 0);
          const x = (u - mu.at) / FLASH;
          if (x < 1 && u < 1) {
            halos.add(_p, 0.16 + 0.22 * x, LK.LCOL[mu.to], fa * (1 - x) * 0.95);
            halos.add(_p, 0.07, WHITE, fa * (1 - x));
            GL[mu.site] = Math.max(GL[mu.site], 1 - x);
          }
        }
        if (seqA > 0.003 && u < 1 && !flowOn) {
          M.curve(tr, b, u, _p);
          row(rowAt(_p, _c), M.seqAt(tr, b, u, _s), anc, fa * seqA, GL);
        }
      }
      // the tips' sequences: the tree's own, or while the machines run the last packet that reached each tip
      if (seqA > 0.003) for (const n of tr.nodes) {
        if (n.tip < 0 || now.u[n.branch] < 1) continue;
        let seq = F.idx[n.id], g = null;
        if (flowOn) {
          const k = Math.floor((t * RISE - (n.pos[1] + 1)) / GAP);
          if (k >= 0) {
            seq = packet(F, k)[n.id];
            const age = ((t * RISE - (n.pos[1] + 1)) / GAP - k) * GAP / RISE;   // seconds since it arrived
            GL.fill(Math.max(0, 1 - age / 0.6)); g = GL;
          }
        }
        row(rowAt(n.pos, _c), seq, anc, fa * seqA, g);
      }
      // the long and the short branch (or the picked one): how far each rises, in green (cyan when picked)
      if (focus > 0.01) {
        if (pickF >= 0) rise(tr, pickF, LK.CYAN, focus * fa);
        else { rise(tr, HL.long, LK.GREENLIT, focus * fa); rise(tr, HL.short, LK.GREENLIT, focus * fa); }
      }
    }

    // ---- the species tree
    spMat.uniforms.uK.value = sa; spMesh.visible = sa > 0.003;
    for (const B of SP.branches) {
      const u = uAt(SP, B.id, h);
      now.su[B.id] = u;
      spMat.uniforms.uG.value[B.id] = u; spMat.uniforms.uL.value[B.id] = 1;
      spMat.uniforms.uC.value[B.id].set(GLASSC[0], GLASSC[1], GLASSC[2]);
    }
    if (sa > 0.003) {
      const root = SP.nodes[SP.root].pos;
      halos.add(root, 0.32, HOT, sa * 0.45 * (1 - qA));
      for (const n of SP.nodes) {
        if (n.parent < 0 || now.su[n.branch] < 1) continue;
        balls.add(n.pos, n.tip >= 0 ? 0.02 : 0.026, HOT, sa);
        halos.add(n.pos, 0.14, HOT, sa * 0.45);
      }
      for (const B of SP.branches) { const u = now.su[B.id]; if (u > 0 && u < 1) { M.curve(SP, B.id, u, _p); halos.add(_p, 0.13, HOT, 0.8 * sa); } }
      // the unknown ancestor: a glass "?" at the root
      if (qA > 0.003) {
        _a[0] = root[0]; _a[1] = root[1] + 0.02; _a[2] = root[2];
        glass.add(_a, 0.12, LK.CYAN, sa * qA);
        tiles.add(_a, null, 0.11, 4, sa * qA, 0, 0.55 + 0.25 * Math.sin(t * 2.4));
        halos.add(_a, 0.45, LK.CYAN, 0.35 * sa * qA);
      } else glass.add(root, 0.055, HOT, sa * 0.9);
    }

    // ---- the machines: a gear on every branch (coupling gears on the species tree), packets flowing up through them
    if (gearA > 0.003) {
      if (fa > 0.003) drawGears(tr, now.u, F.turn, fa * gearA, GEAR_R, false, pickF, gearA, flow, t);
      if (sa > 0.003) drawGears(SP, now.su, spTurn, sa * gearA, SGEAR_R, true, -1, gearA, flow, t);
    }
    if (flow > 0.003) {
      if (fa > 0.003) beads(tr, now.u, F.top, fa * flow, t);
      if (sa > 0.003) beads(SP, now.su, spTop, sa * flow, t);
    }
    tiles.end(); tubes.end(); balls.end(); halos.end(); rings.end(); glass.end(); gears.end();
  }

  // ---------------------------------------------------------------- anchors, labels, views
  const mid = b => () => { const o = [0, 0, 0]; branchMid(now.F.tr, b(), o); return o; };
  const tipNode = j => now.F.tr.nodes.find(n => n.tip === j);
  const anchors = {
    root: [0, -1, 0], below: [0, -1.18, 0.12], crown: () => [0, now.F.top, 0], level: () => [1.28, now.h, 0],
    long: mid(() => now.F.tr.highlight.long), short: mid(() => now.F.tr.highlight.short),
    pick: mid(() => Math.max(0, now.pick)),
    gear: () => { const o = [0, 0, 0]; M.curve(now.F.tr, 0, GEAR_U, o); o[0] += 0.07; return o; },
    tips: () => { const n = tipNode(2) || tipNode(0); return [n.pos[0], n.pos[1] + 0.12, n.pos[2]]; },
    q: [0, -0.86, 0], n1: SP.nodes[1].pos, sgear: () => { const o = [0, 0, 0]; M.curve(SP, 2, GEAR_U, o); o[1] += 0.08; return o; },
  };
  for (let j = 0; j < 8; j++) anchors['tip' + j] = () => { const n = tipNode(j); return [n.pos[0], n.pos[1] + 0.12, n.pos[2]]; };
  SP.tipIds.forEach((id, j) => { anchors['s' + (j + 1)] = SP.nodes[id].pos; });
  const fmt2 = v => v.toFixed(2);
  const swaps = n => `${n} swap${n === 1 ? '' : 's'}`;
  const lenTag = b => { const B = now.F.tr.branches[b]; return [`${fmt2(B.len)} swaps per letter`, ` · ${swaps(B.muts.length)} here`]; };
  const labels = [
    { text: () => ['Ancestor', ' · ' + now.F.tr.nodes[now.F.tr.root].seq], at: 'below', cls: 'cyn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * clamp(S.tree_seq, 0, 1) * (1 - prog(S.tree_grow, 0.55, 0.8)) * (1 - clamp(S.tree_hi, 0, 1)) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: ['Descendants', ' · their sequences today'], at: 'tips', cls: '',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * clamp(S.tree_seq, 0, 1) * prog(S.tree_grow, 0.92, 1) * (1 - clamp(S.tree_hi, 0, 1)) * (1 - clamp(S.tree_gears, 0, 1)) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: () => lenTag(now.F.tr.highlight.long), at: 'long', cls: 'grn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * prog(S.tree_hi, 0.4, 1) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: () => lenTag(now.F.tr.highlight.short), at: 'short', cls: 'grn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * prog(S.tree_hi, 0.4, 1) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    { text: () => { const b = Math.max(0, now.pick), t = lenTag(b); return [`Branch ${b + 1}`, ` · ${t[0]} · ${swaps(now.F.tr.branches[b].muts.length)}`]; }, at: 'pick', cls: 'cyn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * (Math.round(S.tree_pick) >= 0 ? 1 : 0) },
    { text: ['One machine per branch', ''], at: 'gear', cls: 'cyn',
      alpha: S => (1 - clamp(S.tree_species, 0, 1)) * prog(S.tree_gears, 0.5, 1) * (Math.round(S.tree_pick) >= 0 ? 0 : 1) },
    // (it gives way once the stem set's fields come: the story shows the two sets together)
    { text: ['Coupling gears', ' · one per branch'], at: 'sgear', cls: 'cyn',
      alpha: S => clamp(S.tree_species, 0, 1) * prog(S.tree_gears, 0.5, 1) * (1 - clamp(S.tree_flow, 0, 1)) * (1 - prog(S.stem_fields || 0, 0, 0.3)) },
    { text: ['?', ' · their shared ancestor'], at: 'q', cls: 'amb', alpha: S => clamp(S.tree_species, 0, 1) * prog(S.tree_q, 0.4, 1) },
  ];
  // views: the family tree whole, from low as it grows, the crown, the long and the short branch (the story's tree,
  // seed 1), the machines, standing tall in a headset, looking up from the root; the species tree
  const T1 = family(1, 1).tr, lp = [0, 0, 0], spt = [0, 0, 0];
  branchMid(T1, T1.highlight.long, lp); branchMid(T1, T1.highlight.short, spt);
  const pairView = (() => {
    // look across the line from one to the other, from the front side, so both stand clear at the sides
    const dx = lp[0] - spt[0], dz = lp[2] - spt[2];
    let az = Math.atan2(-dz, dx) * 180 / PI;
    if (Math.cos(az * PI / 180) < 0) az += 180;
    // (aimed a little right of their middle: the tags run to the right of their branches)
    const a = az * PI / 180, cx = (lp[0] + spt[0]) / 2 + 0.45 * Math.cos(a), cz = (lp[2] + spt[2]) / 2 - 0.45 * Math.sin(a);
    return [Math.round(((az + 540) % 360) - 180), 14, 4.6, +cx.toFixed(2), +((lp[1] + spt[1]) / 2).toFixed(2), +cz.toFixed(2)];
  })();
  const near = p => { const az = Math.atan2(p[0], p[2]) * 180 / PI; return [Math.round(az + 12), 12, 2.4, +p[0].toFixed(2), +p[1].toFixed(2), +p[2].toFixed(2)]; };
  const cam = {
    default: [24, 12, 5.0, 0, -0.02, 0],
    grow: [18, 5, 4.6, 0, -0.32, 0],
    crown: [30, 30, 4.5, 0, 0.42, 0],
    pair: pairView, long: near(lp), short: near(spt),
    gears: [28, 14, 3.9, 0, -0.28, 0],
    stand: [20, 0, 1.5, 0, 0.15, 0],
    up: [200, -62, 2.2, 0, 0.3, 0.05],
    species: [18, 16, 3.9, 0, -0.42, 0.1],
    what: [8, 14, 4.3, 0.16, -0.36, 0],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['tree', 'Family tree'], ['machines', 'Machines'], ['species', 'Species tree']] },
    { key: 'seed', label: 'Tree', options: [['1', '1'], ['2', '2'], ['3', '3'], ['4', '4'], ['5', '5']] },
    { key: 'speed', label: 'Letters change', options: [['0', 'Slowly'], ['1', 'As in the story'], ['2', 'Twice as fast'], ['3', 'Four times']] },
    { key: 'run', label: 'Machines', options: [['off', 'Still'], ['on', 'Running']] },
  ];
  function explore(c) {
    const v = c.view || 'tree', sp = v === 'species' ? 1 : 0;
    return {
      tree_species: sp, tree_grow: 1, tree_seq: 1, tree_hi: 0, tree_gears: v === 'tree' ? 0 : 1, tree_flow: v !== 'tree' && c.run === 'on' ? 1 : 0,
      tree_q: sp, tree_seed: Math.max(1, parseInt(c.seed, 10) || 1), tree_speed: c.speed == null ? 1 : clamp(parseInt(c.speed, 10) || 0, 0, 3), tree_pick: -1,
    };
  }

  // ---------------------------------------------------------------- picking and what explore reads
  const _v = new THREE.Vector3(), _w = new THREE.Vector3();
  // the branch a ray (a THREE.Raycaster in world coordinates) points at, on the tree on show
  function pick(rc) {
    const ray = rc.ray, species = now.sp > 0.5, tr = species ? SP : now.F.tr, us = species ? now.su : now.u;
    set.group.updateMatrixWorld();
    const Mw = set.group.matrixWorld, s0 = Mw.getMaxScaleOnAxis(), p = [0, 0, 0];
    let best = null, bt = Infinity;
    for (const B of tr.branches) {
      if (us[B.id] <= 0) continue;
      for (let i = 1; i <= 16; i++) {
        const u = i / 16 * us[B.id];
        M.curve(tr, B.id, u, p);
        _v.set(p[0], p[1], p[2]).applyMatrix4(Mw);
        const d = _w.copy(_v).sub(ray.origin).dot(ray.direction), r = 0.07 * s0;
        if (d > 0 && d < bt && ray.distanceSqToPoint(_v) < r * r) { bt = d; best = { kind: 'branch', b: B.id, species }; }
      }
    }
    return best;
  }
  // a branch in words: its length, its swaps (1-based sites), its gear's turn and the circuit's angles at that length
  function branch(b, species) {
    const tr = species ? SP : now.F.tr, B = tr.branches[b];
    if (!B) return null;
    return {
      b, species: !!species, depth: B.depth, len: B.len, from: tr.nodes[B.from].seq, to: tr.nodes[B.to].seq,
      swaps: B.muts.length, muts: B.muts.map(m => ({ at: m.at, site: m.site + 1, from: M.LETTERS[m.from], to: M.LETTERS[m.to] })),
      turn: M.turnAngle(MODEL, B.len), angles: Array.from(M.angles(MODEL, B.len)),
    };
  }
  const API = {
    speeds: SPEEDS, model: MODEL, tree: () => now.F.tr, species: () => SP, highlight: () => now.F.tr.highlight,
    branch, pick, mid: (b, species) => branchMid(species ? SP : now.F.tr, b, [0, 0, 0]), tips: () => now.F.tr.nodes.filter(n => n.tip >= 0).map(n => ({ tip: n.tip, seq: n.seq, pos: n.pos })),
  };
  return Object.assign(set, {
    params: { tree_a: 1, tree_species: 0, tree_grow: 1, tree_seq: 1, tree_hi: 0, tree_gears: 0, tree_flow: 0, tree_q: 0, tree_seed: 1, tree_speed: 1, tree_pick: -1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};

// The rule set of the mutation story (chapters 4 and 5): a substitution model, and the machine a compiler makes of it.
// Four letter balls at the corners of a pyramid (MMATH.CORNERS: A at the top, C front left, G at the back, T front
// right), as big as each letter's long-run share, joined both ways by curved arrows as thick as the rate from one
// letter to the other (MMATH.Q; light runs along them, faster where the rate is higher). The pyramid forms (glass
// faces, glowing edges, a tile at each corner), the balls shrink into its corners, and the mix of the four letters
// becomes a glowing point with a ring in four colours (its shares) that starts at a corner and glides along its path
// (MMATH.path, t from 0 towards T_PATH), a green trail behind it, points 1 to 3 marked, the long-run mix a dashed ring
// it settles towards. Then the pyramid drops into the compiler (a squat drum with a gear on its top) and out comes the
// machine for one branch: the parent's tile and its two qubits on the left; the copy (a press lifts the parent's
// letter and stamps it onto the child, and the child's two qubits take the parent's arrows); the turn (the child's
// qubits sit in two gears driven by a green branch-length dial; the arrows tilt as MMATH.bloch of the child's mix, and
// a small pyramid beside them shows that mix moving along the same path); and below it the circuit itself, in 3D:
// four wires (the parent's p1, p0, the child's c1, c0), the two copy gates, the two turn blocks with their controls,
// pulses running along the wires, and on request the blocks opened into their simple steps (MMATH.decompose: turns
// of one qubit and links of two). Every number is computed live by MMATH from the example models.
// Everything follows the params and t; only a switch of model, start or parent letter (step params) eases in its own
// time (0.6 s; a seek or the first frame shows the new one at once), as the qubits story's cube does.
SETS.rule = function (K) {
  const { THREE, clamp, lerp, prog, smooth } = K;
  const set = K.newSet('rule');
  const M = MMATH, LK = MLOOK(K, set);
  const PI = Math.PI, TAU = PI * 2;
  const CN = M.CORNERS, NM = M.MODELS.length;
  const QS = M.MODELS.map((_, i) => M.Q(i)), PIS = M.MODELS.map((_, i) => M.pi(i));
  let QREF = 0;
  QS.forEach(q => { for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j) QREF = Math.max(QREF, q[i * 4 + j]); });
  const GEAR_K = 1.6;   // the gears turn 1.6 times the turn's mean angle (so a long branch turns them about 120 degrees)
  const VIEW_AX = [0, 0.35, 1];   // rings that face the usual view, a little from above
  const UP = [0, 1, 0], FRONT = [0, 0, 1];
  const METAL = [0.42, 0.52, 0.68], DIM = [0.1, 0.12, 0.17];

  // ---------------------------------------------------------------- the machine's layout
  const DRUM = [0, -0.6, 0], DR = 0.48, DH = 0.3;
  const XP = -1.05, XC = -0.15;   // the parent's column, the child's
  const PAR_T = [XP, 0.88, 0], CHD_T = [XC, 0.88, 0], MT = 0.17;
  const QR = 0.12, GR = 0.19, GAP = 2 * 0.9 * GR;   // qubits, gears (meshing gears' centres 1.8 R apart)
  const PQ = [[XP, 0.52, 0], [XP, 0.52 - GAP, 0]], CQ = [[XC, 0.52, 0.06], [XC, 0.52 - GAP, 0.06]];
  const GC = [[XC, 0.52, -0.05], [XC, 0.52 - GAP, -0.05]], GD = [XC + GAP, 0.52, -0.05];
  const MINI = [0.8, 0.45, 0], MS = 0.24, ZB = -0.22, FRAME_X = [XP, XC, GD[0]];   // the small pyramid; the machine's back frame
  const RAIL_Y = 1.12, HEAD_REST = [(XP + XC) / 2, 1.05], HEAD_DOWN = 0.985;
  // the circuit: wires p1, p0, c1, c0 top to bottom
  const WY = [-0.3, -0.47, -0.64, -0.81], XL = -1.1, XR = 1.12, WIRE = { p1: 0, p0: 1, c1: 2, c0: 3 };
  const XCOPY = [-0.85, -0.7], XB = [-0.24, 0.48], BW = [0.3, 0.42], BH = 0.14;
  // the turn blocks' simple steps (the structure is the same for every branch: MMATH.decompose of the circuit's two
  // turn blocks; only the RY angles change, computed below without allocating)
  const STEPS = M.circuit(M.DEFAULT, 0.5).gates.filter(g => g.type === 'MRY').map((g, b) => {
    const k = g.ctrls.length, N = 1 << k, gray = j => j ^ (j >> 1), list = M.decompose(g);
    const sign = new Float64Array(N * N);   // RY j's angle = sum_x sign[j N + x] theta_x / N
    for (let j = 0; j < N; j++) for (let x = 0; x < N; x++) sign[j * N + x] = M.pop(x & gray(j)) & 1 ? -1 : 1;
    let ry = 0;
    const items = list.map(s => (s.type === 'RY' ? { ry: ry++, w: WIRE[s.tgt] } : { ctrl: WIRE[s.ctrl], w: WIRE[s.tgt] }));
    const x0 = b ? 0.08 : -0.5, x1 = b ? 1.08 : 0.0;
    items.forEach((it, i) => { it.x = lerp(x0, x1, (i + 0.5) / items.length); });
    return { N, sign, items, tgt: WIRE[g.tgt], ctrls: g.ctrls.map(c => WIRE[c]) };
  });
  const NRY = STEPS.reduce((a, s) => a + s.N, 0), NCX = STEPS.reduce((a, s) => a + s.items.length - s.N, 0);

  // ---------------------------------------------------------------- pools and meshes
  const tubes = LK.tubes(780), cones = LK.cones(24), balls = LK.balls(80), halos = LK.halos(100), rings = LK.rings(48),
    tiles = LK.tiles(24), gears = LK.gears(8), glass = LK.glass(6), boxes = LK.boxes(32);
  set.group.add(tubes.mesh, cones.mesh, balls.mesh, halos.mesh, rings.mesh, tiles.mesh, gears.mesh, glass.mesh, boxes.mesh);
  const QPOOLS = { glass, rings, tubes, cones, balls, halos };
  // the pyramid's glass faces (the big one and the machine's small copy)
  const faceGeo = new THREE.BufferGeometry();
  {
    const F = [[0, 1, 3], [0, 3, 2], [0, 2, 1], [1, 2, 3]], pos = [];
    F.forEach(f => f.forEach(i => pos.push(...CN[i])));
    faceGeo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    faceGeo.computeVertexNormals();
  }
  const faces = [0, 1].map(() => {
    const m = new THREE.Mesh(faceGeo, K.rim(set, { color: '#7fbfff', a0: 0.05, a1: 0.3 }));
    m.visible = false; set.group.add(m);
    return m;
  });
  // the compiler: a squat drum, lit
  const drumMat = new THREE.MeshStandardMaterial({ color: 0x123563, metalness: 0.45, roughness: 0.38, emissive: 0x071b38, transparent: true });
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1, 1, 1, 48, 1, false), drumMat);
  drum.visible = false; set.group.add(drum);

  // scratch (nothing is allocated per frame)
  const _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _d = [0, 0, 0], _e = [0, 0, 0], _col = [0, 0, 0];
  const pA = new Float64Array(4), pB = new Float64Array(4), pM = new Float64Array(4), bl = new Float64Array(6), ang = new Float64Array(12);
  const YV = new THREE.Vector3(0, 1, 0);
  const lerp3 = (out, a, b, s) => { out[0] = a[0] + (b[0] - a[0]) * s; out[1] = a[1] + (b[1] - a[1]) * s; out[2] = a[2] + (b[2] - a[2]) * s; return out; };
  const set3 = (out, x, y, z) => { out[0] = x; out[1] = y; out[2] = z; return out; };
  // a point of the pyramid placed at centre c with scale s
  const tr = (out, T, p) => set3(out, T.c[0] + T.s * p[0], T.c[1] + T.s * p[1], T.c[2] + T.s * p[2]);
  const BIG = { c: [0, 0, 0], s: 1 }, SMALL = { c: MINI.slice(), s: MS };

  // a ring of short tubes split into four arcs as long as the shares p (A from the top, then C, G, T clockwise)
  const RING_N = 48, _u = [0, 0, 0], _v = [0, 0, 0];
  function shareRing(c, axis, R, r, p, alpha) {
    if (alpha <= 0.004 || R <= 0) return;
    const al = Math.hypot(axis[0], axis[1], axis[2]) || 1, ax = axis[0] / al, ay = axis[1] / al, az = axis[2] / al;
    let ux = -ay * ax, uy = 1 - ay * ay, uz = -ay * az;
    const ul = Math.hypot(ux, uy, uz) || 1; ux /= ul; uy /= ul; uz /= ul;
    const vx = uy * az - uz * ay, vy = uz * ax - ux * az, vz = ux * ay - uy * ax;
    const tot = (p[0] + p[1] + p[2] + p[3]) || 1;
    let L = 0, edge = p[0] / tot;
    for (let s = 0; s < RING_N; s++) {
      const f = (s + 0.5) / RING_N;
      while (L < 3 && f > edge) { L++; edge += p[L] / tot; }
      const a0 = s / RING_N * TAU, a1 = (s + 1) / RING_N * TAU;
      set3(_u, c[0] + R * (Math.cos(a0) * ux + Math.sin(a0) * vx), c[1] + R * (Math.cos(a0) * uy + Math.sin(a0) * vy), c[2] + R * (Math.cos(a0) * uz + Math.sin(a0) * vz));
      set3(_v, c[0] + R * (Math.cos(a1) * ux + Math.sin(a1) * vx), c[1] + R * (Math.cos(a1) * uy + Math.sin(a1) * vy), c[2] + R * (Math.cos(a1) * uz + Math.sin(a1) * vz));
      tubes.add(_u, _v, r, LK.LCOL[L], alpha, 0);
    }
  }
  // a switch of step params eases in its own time: { from: [..], to: [..], k }
  const mkSwitch = n => ({ from: new Array(n).fill(0), to: new Array(n).fill(-1), k: 1 });
  function step(sw, v0, v1, snap, dt) {
    if (v0 !== sw.to[0] || v1 !== sw.to[1]) {
      const first = sw.to[0] < 0;
      if (first) { sw.from[0] = v0; sw.from[1] = v1; } else if (sw.k >= 0.5) { sw.from[0] = sw.to[0]; sw.from[1] = sw.to[1]; }
      sw.to[0] = v0; sw.to[1] = v1;
      sw.k = snap || first ? 1 : 0;
    } else sw.k = snap ? 1 : Math.min(1, sw.k + dt / 0.6);
    return smooth(sw.k);
  }
  const SWP = mkSwitch(2), SWM = mkSwitch(2);   // (model, start) for the pyramid; (model, parent) for the machine
  // the mix after t from the switch's letter, eased between the old and the new choice
  function mixAt(sw, ks, t, out) {
    M.path(sw.from[0], sw.from[1], t, pA); M.path(sw.to[0], sw.to[1], t, pB);
    for (let i = 0; i < 4; i++) out[i] = lerp(pA[i], pB[i], ks);
    return out;
  }
  const turnAt = (sw, ks, t) => lerp(M.turnAngle(sw.from[0], t), M.turnAngle(sw.to[0], t), ks);
  const piAt = (sw, ks, i) => lerp(PIS[sw.from[0]][i], PIS[sw.to[0]][i], ks);
  // a pure letter's two qubits, each arrow turned on its own while the letter changes (no mix of the two meanwhile)
  function letterBloch(a, b, k, out) {
    const t1 = PI * lerp(a >> 1, b >> 1, k), t2 = PI * lerp(a & 1, b & 1, k);
    out[0] = Math.sin(t1); out[1] = 0; out[2] = Math.cos(t1); out[3] = Math.sin(t2); out[4] = 0; out[5] = Math.cos(t2);
    return out;
  }

  // what the anchors and labels read (kept current by update)
  const now = { big: BIG, mix: [0, 0, 0], pts: [[0, 0, 0], [0, 0, 0], [0, 0, 0]], longrun: [0, 0, 0], t: 1, tEff: 0, model: 2, start: 0, parent: 0,
    ang: new Float64Array(12), fast: [0, 0, 0], head: HEAD_REST.slice(), gearsA: 0 };

  // ---- the pyramid (the big one, or the machine's small copy): edges, faces, corner tiles, the path and the mix
  const ED = [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1]];
  function pyramid(T, a, form, mesh, sw, ks, tMix, pathA, small) {
    if (a <= 0.004) { mesh.visible = false; return; }
    const s = T.s, er = small ? 0.006 : 0.009;
    // the edges grow from the corners to their middles
    const eg = prog(form, 0, 0.6);
    if (eg > 0.004) for (let e = 0; e < 6; e++) {
      const i = ED[e][0], j = ED[e][1];
      tr(_a, T, CN[i]); tr(_b, T, CN[j]); lerp3(_c, _a, _b, 0.5 * eg); lerp3(_d, _b, _a, 0.5 * eg);
      tubes.add(_a, _c, er, LK.RIM, a * 0.9, 0); tubes.add(_b, _d, er, LK.RIM, a * 0.9, 0);
    }
    const fa = prog(form, 0.3, 1) * a;
    mesh.visible = fa > 0.004;
    mesh.position.set(T.c[0], T.c[1], T.c[2]); mesh.scale.setScalar(s);
    mesh.material.uniforms.uK.value = fa;
    // the corners: a tile with the letter (facing you), a glow
    const ta = prog(form, 0.5, 1) * a;
    for (let i = 0; i < 4; i++) {
      tr(_a, T, CN[i]);
      const l = Math.hypot(CN[i][0], CN[i][1], CN[i][2]);
      const k = small ? T.s / MS : T.s;   // (the corners shrink with the pyramid as it drops into the compiler)
      for (let d = 0; d < 3; d++) _b[d] = _a[d] + CN[i][d] / l * (small ? 0.06 : 0.13) * k;
      if (ta > 0.004) tiles.add(_b, null, (small ? 0.075 : 0.17) * k, i, ta, 0, 0.1);
      halos.add(_a, (small ? 0.12 : 0.22) * k, LK.LCOL[i], 0.35 * fa);
    }
    if (pathA <= 0.004) return;
    // the path: the whole of it faint and dashed, the part travelled bright green, points 1 to 3, the long-run mix
    const tEnd = Math.max(M.T_PATH, tMix), NT = small ? 36 : 64;
    mixAt(sw, ks, 0, pM); M.simplex(pM, _c); tr(_a, T, _c);
    for (let k = 1; k <= NT; k++) {
      const tk = tEnd * k / NT;
      mixAt(sw, ks, tk, pM); M.simplex(pM, _c); tr(_b, T, _c);
      if (tk <= tMix + 1e-9) tubes.add(_a, _b, small ? 0.006 : 0.009, LK.GREENLIT, pathA * (0.35 + 0.65 * tk / Math.max(tMix, 1e-3)), 0);
      else if (tEnd * (k - 1) / NT < tMix) {   // (the stretch the point is on: bright up to it)
        mixAt(sw, ks, tMix, pM); M.simplex(pM, _c); tr(_d, T, _c);
        tubes.add(_a, _d, small ? 0.006 : 0.009, LK.GREENLIT, pathA, 0);
      } else if (k % 2 === 0) tubes.add(_a, _b, small ? 0.003 : 0.004, LK.GREEN, pathA * 0.4, 0);   // (ahead: dashed)
      _a[0] = _b[0]; _a[1] = _b[1]; _a[2] = _b[2];
    }
    if (!small) for (let k = 0; k < 3; k++) {
      mixAt(sw, ks, M.POINTS[k], pM); M.simplex(pM, _c); tr(now.pts[k], T, _c);
      const passed = tMix >= M.POINTS[k] - 1e-6;
      rings.add(now.pts[k], VIEW_AX, 0.032, 0.006, LK.WHITE, pathA * (passed ? 1 : 0.4), 0);
    }
    // the long-run mix: a dashed ring the point settles towards
    for (let i = 0; i < 4; i++) pM[i] = piAt(sw, ks, i);
    M.simplex(pM, _c); tr(_d, T, _c);
    if (!small) set3(now.longrun, _d[0], _d[1], _d[2]);
    rings.add(_d, VIEW_AX, small ? 0.03 : 0.065, small ? 0.004 : 0.006, LK.CYAN, pathA * 0.9, small ? 10 : 16);
    balls.add(_d, small ? 0.008 : 0.014, LK.CYAN, pathA * 0.9);
    // the mix now: a glowing point, its ring of shares, and a thread to each corner as strong as its share
    mixAt(sw, ks, tMix, pM); M.simplex(pM, _c); tr(_e, T, _c);
    if (!small) set3(now.mix, _e[0], _e[1], _e[2]);
    balls.add(_e, small ? 0.016 : 0.034, LK.WHITE, pathA);
    halos.add(_e, small ? 0.14 : 0.3, LK.WHITE, 0.55 * pathA);
    shareRing(_e, VIEW_AX, small ? 0.04 : 0.08, small ? 0.006 : 0.011, pM, pathA);
    if (!small) for (let i = 0; i < 4; i++) {
      tr(_a, T, CN[i]);
      tubes.add(_e, _a, 0.0015 + 0.008 * pM[i], LK.LCOL[i], 0.4 * pathA * (0.3 + 0.7 * pM[i]), 0);
    }
  }

  // ---- the rule itself: balls at the corners as big as the long-run shares, arrows as thick as the rates
  // a point on the quadratic curve through _a, _b (control), _c
  function bez(u, out) {
    const v = 1 - u;
    return set3(out, v * v * _a[0] + 2 * u * v * _b[0] + u * u * _c[0], v * v * _a[1] + 2 * u * v * _b[1] + u * u * _c[1], v * v * _a[2] + 2 * u * v * _b[2] + u * u * _c[2]);
  }
  function rates(S, t, a, form, ks) {
    const grow = prog(clamp(S.rule_balls, 0, 1), 0.2, 1), arA = a * (1 - prog(form, 0, 0.5)), flow = clamp(S.rule_flow, 0, 1);
    const shrink = 1 - 0.85 * prog(form, 0.1, 0.8), qF = QS[SWP.from[0]], qT = QS[SWP.to[0]];
    let bi = 0, bj = 1, best = -1;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) if (i !== j && qT[i * 4 + j] > best) { best = qT[i * 4 + j]; bi = i; bj = j; }
    for (let i = 0; i < 4; i++) {
      const r = 0.34 * Math.sqrt(piAt(SWP, ks, i)) * smooth(prog(clamp(S.rule_balls, 0, 1), 0, 0.5)) * shrink;
      balls.add(CN[i], r, LK.LCOL[i], a);
      halos.add(CN[i], r * 3.5, LK.LCOL[i], 0.25 * a * shrink);
    }
    if (arA <= 0.004 || grow <= 0.004) return;
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      if (i === j) continue;
      const q = lerp(qF[i * 4 + j], qT[i * 4 + j], ks), rad = 0.004 + 0.024 * q / QREF;
      const ri = 0.34 * Math.sqrt(piAt(SWP, ks, i)), rj = 0.34 * Math.sqrt(piAt(SWP, ks, j));
      // a quadratic curve bulging to its own side (i -> j and j -> i on opposite sides: a two-way street)
      const dx = CN[j][0] - CN[i][0], dy = CN[j][1] - CN[i][1], dz = CN[j][2] - CN[i][2], dl = Math.hypot(dx, dy, dz);
      const ux = dx / dl, uy = dy / dl, uz = dz / dl;
      const mx = (CN[i][0] + CN[j][0]) / 2, my = (CN[i][1] + CN[j][1]) / 2, mz = (CN[i][2] + CN[j][2]) / 2, ml = Math.hypot(mx, my, mz);
      const ox = mx / ml, oy = my / ml, oz = mz / ml;
      let sx = uy * oz - uz * oy, sy = uz * ox - ux * oz, sz = ux * oy - uy * ox;
      const sl = Math.hypot(sx, sy, sz); sx /= sl; sy /= sl; sz /= sl;
      set3(_a, CN[i][0] + ux * (ri + 0.04), CN[i][1] + uy * (ri + 0.04), CN[i][2] + uz * (ri + 0.04));
      set3(_c, CN[j][0] - ux * (rj + 0.1), CN[j][1] - uy * (rj + 0.1), CN[j][2] - uz * (rj + 0.1));
      set3(_b, mx + sx * 0.17 + ox * 0.05, my + sy * 0.17 + oy * 0.05, mz + sz * 0.17 + oz * 0.05);
      const NS = 12, uMax = grow;
      bez(0, _d);
      for (let s = 1; s <= NS; s++) {
        const u = Math.min(uMax, s / NS);
        bez(u, _e);
        tubes.add(_d, _e, rad, LK.mix(LK.LCOL[i], LK.LCOL[j], u, _col), arA, 0);
        _d[0] = _e[0]; _d[1] = _e[1]; _d[2] = _e[2];
        if (u >= uMax) break;
      }
      if (uMax > 0.98) {
        bez(1, _d); set3(_e, 2 * (_c[0] - _b[0]), 2 * (_c[1] - _b[1]), 2 * (_c[2] - _b[2]));
        cones.add(_d, _e, 0.075, rad * 1.6 + 0.014, LK.LCOL[j], arA);
        if (i === bi && j === bj) bez(0.5, now.fast);
      }
      // light running along it, quicker where the rate is higher
      if (flow > 0.004) for (let b = 0; b < 3; b++) {
        const u = ((t * (0.12 + 0.55 * q / QREF) + b / 3 + i * 0.13 + j * 0.07) % 1);
        if (u > uMax) continue;
        bez(u, _d);
        halos.add(_d, 0.05 + 0.1 * q / QREF, LK.mix(LK.LCOL[i], LK.LCOL[j], u, _col), 0.7 * arA * flow * Math.sin(PI * u));
      }
    }
  }

  // ---- the machine for one branch
  const PO = [{ at: 0, col: LK.INK }, { at: 3, col: LK.INK }], CO = [{ at: 0, col: LK.INK, glow: 0 }, { at: 3, col: LK.INK, glow: 0 }];
  const GOPT = { glow: 0 }, DOPT = { rim: null, glow: 0.2 }, TILE_Q = new THREE.Quaternion();
  // a part of the machine flies out of the drum: where it is, and how far out (0..1)
  function fly(m, d0, place, o) { const s = smooth(prog(m, d0, d0 + 0.5)); lerp3(o, DRUM, place, s); o[1] += 0.25 * Math.sin(PI * s); return s; }
  // a bump 0 -> 1 -> 0 while the copy runs from a to b
  const dip = (cp, a, b) => Math.sin(PI * clamp((cp - a) / (b - a), 0, 1));
  function machine(S, t, mA, ks) {
    const m = clamp(S.rule_machine, 0, 1), cp = clamp(S.rule_copy, 0, 1), tm = clamp(S.rule_time, 0, 3);
    const par = SWM.to[1], parF = SWM.from[1], tEff = tm * prog(cp, 0.85, 1);
    now.tEff = tEff;
    // the parent: its tile and its two qubits
    let s = fly(m, 0, PAR_T, _a);
    TILE_Q.setFromAxisAngle(YV, PI * (ks < 1 ? ks : 0));
    if (s > 0.01) tiles.add(_a, TILE_Q, MT * s, ks < 0.5 ? parF : par, mA, 0, 0.1);
    letterBloch(parF, par, ks, bl);
    for (let q = 0; q < 2; q++) { s = fly(m, 0.05 + 0.04 * q, PQ[q], _b); if (s > 0.01) LK.qubit(QPOOLS, _b, QR * s, bl, mA, PO[q]); }
    // the back frame: posts from the parent's qubits and axles from the gears into uprights behind, standing on one
    // crossbar under the machine (one machine; clear of the copy's two lines in front)
    const fa = mA * prog(m, 0.45, 0.9), yb = PQ[1][1] - QR - 0.08;
    if (fa > 0.004) {
      for (let q = 0; q < 2; q++) {
        tubes.add(set3(_c, XP, PQ[q][1], -QR), set3(_d, XP, PQ[q][1], ZB), 0.012, METAL, fa, 0);
        tubes.add(set3(_c, XC, GC[q][1], GC[q][2]), set3(_d, XC, GC[q][1], ZB), 0.022, METAL, fa, 0);
      }
      tubes.add(set3(_c, GD[0], GD[1], GD[2]), set3(_d, GD[0], GD[1], ZB), 0.022, METAL, fa, 0);
      for (let f = 0; f < 3; f++) {
        const x = FRAME_X[f];
        tubes.add(set3(_c, x, PQ[0][1], ZB), set3(_d, x, yb, ZB), 0.014, METAL, 0.8 * fa, 0);
        balls.add(_d, 0.022, METAL, fa);
      }
      tubes.add(set3(_c, XP, yb, ZB), set3(_d, GD[0], yb, ZB), 0.014, METAL, 0.8 * fa, 0);
    }
    // the gears: the child's two, and the green dial that drives them (meshing: each turned the other way)
    const ga = GEAR_K * turnAt(SWM, ks, tEff);
    now.gearsA = ga;
    for (let g = 0; g < 2; g++) { s = fly(m, 0.15 + 0.05 * g, GC[g], _b); if (s > 0.01) gears.add(_b, FRONT, GR * s, g ? -ga : ga, LK.BLUE, mA, GOPT); }
    s = fly(m, 0.25, GD, _b);
    if (s > 0.01) {
      DOPT.rim = LK.GREENLIT;
      gears.add(_b, FRONT, GR * s, -ga, LK.GREEN, mA, DOPT);
      // its scale: ticks where the needle points after branches of 0, 0.25, 0.5, 1 and 2, the arc swept so far
      const R = (GR + 0.07) * s, z = _b[2] + 0.04, nd = PI / 2 - ga, dA = mA * prog(cp, 0.6, 1);
      for (let d = 0; d < DIAL.length; d++) {
        const a = PI / 2 - GEAR_K * turnAt(SWM, ks, DIAL[d]);
        set3(_c, _b[0] + R * Math.cos(a), _b[1] + R * Math.sin(a), z); set3(_d, _b[0] + (R + 0.04) * Math.cos(a), _b[1] + (R + 0.04) * Math.sin(a), z);
        tubes.add(_c, _d, 0.005, LK.GREENLIT, dA * 0.9, 0);
      }
      const amax = GEAR_K * turnAt(SWM, ks, 3), NSEG = 28;
      for (let k = 0; k < NSEG; k++) {
        const a0 = PI / 2 - amax * k / NSEG, a1 = PI / 2 - amax * (k + 1) / NSEG, lit = a1 >= nd - 1e-6;
        set3(_c, _b[0] + R * Math.cos(a0), _b[1] + R * Math.sin(a0), z); set3(_d, _b[0] + R * Math.cos(a1), _b[1] + R * Math.sin(a1), z);
        tubes.add(_c, _d, lit ? 0.009 : 0.004, lit ? LK.GREENLIT : LK.GREEN, dA * (lit ? 1 : 0.45), 0);
      }
      // the needle, fixed on the dial's gear
      set3(_c, _b[0] + (R - 0.02) * Math.cos(nd), _b[1] + (R - 0.02) * Math.sin(nd), z + 0.01);
      set3(_d, _b[0], _b[1], z + 0.01);
      tubes.add(_d, _c, 0.008, LK.GREENLIT, dA, 0);
      balls.add(_d, 0.02, LK.GREENLIT, dA);
      halos.add(_c, 0.12, LK.GREENLIT, 0.6 * dA);
    }
    // the press: a rail, a carriage, a head that lifts the parent's letter and stamps it onto the child
    const pa = mA * prog(m, 0.4, 0.8);
    const hx = cp < 0.12 ? lerp(HEAD_REST[0], PAR_T[0], smooth(cp / 0.12)) : cp < 0.28 ? PAR_T[0] : cp < 0.5 ? lerp(PAR_T[0], CHD_T[0], smooth((cp - 0.28) / 0.22))
      : cp < 0.66 ? CHD_T[0] : lerp(CHD_T[0], HEAD_REST[0], smooth((cp - 0.66) / 0.19));
    const hy = HEAD_REST[1] - (HEAD_REST[1] - HEAD_DOWN) * (dip(cp, 0.12, 0.28) + dip(cp, 0.5, 0.66));
    now.head[0] = hx; now.head[1] = hy;
    if (pa > 0.004) {
      tubes.add(set3(_c, PAR_T[0] - 0.12, RAIL_Y, 0), set3(_d, CHD_T[0] + 0.12, RAIL_Y, 0), 0.012, METAL, pa, 0);
      boxes.add(set3(_c, hx, RAIL_Y, 0), SZ_CAR, METAL, pa);
      tubes.add(set3(_c, hx, RAIL_Y, 0), set3(_d, hx, hy, 0), 0.011, METAL, pa, 0);
      boxes.add(set3(_c, hx, hy, 0), SZ_HEAD, LK.BLUE, pa);
      // the letter it carries
      if (cp > 0.17 && cp < 0.58) { set3(_c, hx, hy - 0.025 - MT * 0.5 - 0.005, 0); tiles.add(_c, LK.ID, MT, par, pa, 0, 0.2); }
    }
    // the child: a dim '?' until the stamp; then the parent's letter; '?' with its ring of shares once it turns
    s = fly(m, 0.1, CHD_T, _a);
    const stamped = prog(cp, 0.56, 0.6), tf = prog(tEff, 0, 0.12);
    M.path(SWM.to[0], par, tEff, pM);
    if (SWM.k < 1) { mixAt(SWM, ks, tEff, pM); }
    TILE_Q.setFromAxisAngle(YV, PI * tf);
    if (s > 0.01) {
      const L = stamped < 0.5 || tf >= 0.5 ? 4 : par;
      tiles.add(_a, TILE_Q, MT * s, L, mA * (0.35 + 0.65 * stamped), 0, 0.1 + 0.6 * dip(cp, 0.55, 0.7));
      shareRing(_a, FRONT, MT * 0.85, 0.008, pM, mA * prog(tEff, 0.04, 0.2));
      if (cp > 0.55 && cp < 0.75) halos.add(_a, 0.5, LK.LCOL[par], 0.8 * dip(cp, 0.55, 0.75) * mA);
    }
    // the copy reaches the child's qubits along the two lines from the parent's (one per qubit)
    const kc = prog(cp, 0.66, 0.82);
    for (let q = 0; q < 2; q++) {
      set3(_c, PQ[q][0] + QR, PQ[q][1], 0.06); set3(_d, CQ[q][0] - QR, CQ[q][1], 0.06);
      tubes.add(_c, _d, 0.004, LK.INK, 0.3 * mA * prog(m, 0.5, 1), 0);
      if (cp > 0.58 && cp < 0.84) { const u = prog(cp, 0.58, 0.8); lerp3(_e, _c, _d, u); halos.add(_e, 0.16, LK.CYAN, mA * Math.sin(PI * u)); }
    }
    // its qubits: up (|00>) before the copy, the parent's arrows after it, then turned to the child's mix
    if (tEff > 1e-4 || kc >= 1) M.bloch(pM, bl); else letterBloch(0, par, kc, bl);
    for (let q = 0; q < 2; q++) {
      s = fly(m, 0.2 + 0.04 * q, CQ[q], _b);
      CO[q].glow = 0.2 + 0.6 * dip(cp, 0.66, 0.84);
      if (s > 0.01) LK.qubit(QPOOLS, _b, QR * s, bl, mA, CO[q]);
    }
    // the small pyramid: the child's mix on the rule's path from the parent's corner
    s = fly(m, 0.3, MINI, SMALL.c); SMALL.s = MS * s;
    pyramid(SMALL, mA * (s > 0.01 ? 1 : 0), 1, faces[1], SWM, ks, tEff, mA * prog(cp, 0.8, 1), true);
  }
  const DIAL = [0, 0.25, 0.5, 1, 2];

  // ---- the circuit, under the machine
  const XPOS = [0, 0, 0, 0], SZ_CAR = [0.1, 0.05, 0.06], SZ_HEAD = [0.22, 0.05, 0.13], SZ_BLOCK = [0.3, BH, 0.08], SZ_RY = [0.056, 0.09, 0.05];
  let RUN = 1;
  // a gate glows as a pulse on its wire passes it
  const flash = (w, x) => RUN * Math.exp(-(((XPOS[w] - x) / 0.06) ** 2));
  function circuit(S, t, cA, ks) {
    const grow = prog(cA, 0, 0.6), xe = lerp(XL, XR, grow), simple = clamp(S.rule_simple, 0, 1), run = clamp(S.rule_run, 0, 1);
    const par = SWM.to[1];
    // the turn's angles now (the child's two blocks; the simple steps' angles from all of them)
    M.angles(SWM.to[0], now.tEff, ang);
    if (SWM.k < 1) { M.angles(SWM.from[0], now.tEff, now.ang); for (let i = 0; i < 12; i++) ang[i] = lerp(now.ang[i], ang[i], ks); }
    now.ang.set(ang);
    // pulses along the wires; a gate glows as one passes it
    for (let w = 0; w < 4; w++) XPOS[w] = XL + ((t * 0.26 + w * 0.17) % 1) * (XR - XL);
    RUN = run;
    for (let w = 0; w < 4; w++) {
      tubes.add(set3(_a, XL, WY[w], 0), set3(_b, xe, WY[w], 0), 0.006, LK.INK, 0.5 * cA, 0);
      if (run > 0.004 && XPOS[w] < xe) halos.add(set3(_a, XPOS[w], WY[w], 0.01), 0.1, [0.85, 0.95, 1], 0.8 * cA * run);
    }
    // the inputs: the parent's two bits, the child's two zeros
    const ia = cA * prog(grow, 0, 0.3);
    for (let w = 0; w < 4; w++) tiles.add(set3(_a, XL - 0.09, WY[w], 0), null, 0.1, w === 0 ? 5 + (par >> 1) : w === 1 ? 5 + (par & 1) : 5, ia, 0, 0, w < 2 ? LK.LCOL[par] : LK.GREY);
    // the copy: two CNOTs (a dot on the parent's wire, a target on the child's)
    const copyA = cA * prog(grow, 0.15, 0.35);
    for (let g = 0; g < 2; g++) {
      const x = XCOPY[g], wc = g, wt = g + 2, f = 1 + 1.5 * flash(wt, x);
      tubes.add(set3(_a, x, WY[wc], 0), set3(_b, x, WY[wt] - 0.038, 0), 0.006, LK.WHITE, copyA, 0);
      balls.add(set3(_a, x, WY[wc], 0), 0.022, LK.WHITE, copyA);
      rings.add(set3(_a, x, WY[wt], 0), FRONT, 0.038, 0.006, LK.WHITE, copyA, 0);
      tubes.add(set3(_a, x - 0.038, WY[wt], 0), set3(_b, x + 0.038, WY[wt], 0), 0.005, LK.WHITE, copyA, 0);
      halos.add(set3(_a, x, WY[wt], 0.02), 0.16, LK.CYAN, 0.25 * copyA * f);
    }
    // the turn: two blocks (c1's controlled by the parent, c0's by the parent and c1), each with a gear turning
    const blockA = cA * prog(grow, 0.35, 0.7) * (1 - smooth(simple));
    for (let b = 0; b < 2; b++) {
      const st = STEPS[b], x = XB[b], wt = st.tgt, f = flash(wt, x);
      if (blockA > 0.004) {
        SZ_BLOCK[0] = BW[b] * (1 - 0.6 * simple);
        boxes.add(set3(_a, x, WY[wt], 0), SZ_BLOCK, LK.mix(LK.BLUE, LK.RIM, 0.25 * f, _col), blockA);
        halos.add(set3(_a, x, WY[wt], 0.05), 0.35, LK.RIM, (0.15 + 0.3 * f) * blockA);
        gears.add(set3(_a, x, WY[wt], 0.05), FRONT, 0.055, (b ? -1 : 1) * now.gearsA, LK.BLUE, blockA, GOPT);
        let top = WY[wt];
        for (let c = 0; c < st.ctrls.length; c++) {
          const w = st.ctrls[c];
          balls.add(set3(_a, x, WY[w], 0), 0.026, LK.RIM, blockA);
          top = Math.max(top, WY[w]);
        }
        tubes.add(set3(_a, x, top, 0), set3(_b, x, WY[wt] + BH / 2, 0), 0.007, LK.RIM, blockA, 0);
      }
      // the simple steps: turns of one qubit (shaded by how far they turn, a needle at the angle) and links of two
      const sa = cA * prog(grow, 0.35, 0.7) * smooth(simple);
      if (sa <= 0.004) continue;
      const th0 = b ? 4 : 0;
      let mx = 1e-6;
      for (let j = 0; j < st.N; j++) { let v = 0; for (let xx = 0; xx < st.N; xx++) v += st.sign[j * st.N + xx] * ang[th0 + xx]; mx = Math.max(mx, Math.abs(v / st.N)); }
      for (let n = 0; n < st.items.length; n++) {
        const it = st.items[n];
        const xi = lerp(x, it.x, smooth(simple)), fl = flash(it.w, xi);
        if (it.ry !== undefined) {
          let v = 0; for (let xx = 0; xx < st.N; xx++) v += st.sign[it.ry * st.N + xx] * ang[th0 + xx];
          v /= st.N;
          const sh = 0.4 + 0.6 * Math.abs(v) / Math.max(mx, 0.35);
          boxes.add(set3(_a, xi, WY[it.w], 0), SZ_RY, LK.mix(DIM, LK.mix(LK.BLUE, LK.RIM, 0.3 * fl, _e), sh, _col), sa);
          // (a needle on its face, turned by its angle)
          set3(_a, xi - 0.034 * Math.sin(v), WY[it.w] - 0.034 * Math.cos(v), 0.03); set3(_b, xi + 0.034 * Math.sin(v), WY[it.w] + 0.034 * Math.cos(v), 0.03);
          tubes.add(_a, _b, 0.005, LK.WHITE, sa, 0);
        } else {
          const dn = WY[it.w] < WY[it.ctrl] ? 1 : -1;
          tubes.add(set3(_a, xi, WY[it.ctrl], 0), set3(_b, xi, WY[it.w] + dn * 0.022, 0), 0.004, LK.WHITE, sa, 0);
          balls.add(set3(_a, xi, WY[it.ctrl], 0), 0.014, LK.WHITE, sa);
          rings.add(set3(_a, xi, WY[it.w], 0), FRONT, 0.022, 0.004, LK.WHITE, sa, 0);
          if (fl > 0.05) halos.add(_a, 0.1, LK.CYAN, 0.4 * fl * sa);
        }
      }
    }
  }

  function update(S, t, dt) {
    LK.depth();
    tubes.begin(); cones.begin(); balls.begin(); halos.begin(); rings.begin(); tiles.begin(); gears.begin(); glass.begin(); boxes.begin();
    const snap = !(dt > 0) || dt > 0.25;
    const mi = clamp(Math.round(S.rule_model), 0, NM - 1), st = clamp(Math.round(S.rule_start), 0, 3), pr = clamp(Math.round(S.rule_parent), 0, 3);
    const ksP = step(SWP, mi, st, snap, dt), ksM = step(SWM, mi, pr, snap, dt);
    now.model = mi; now.start = st; now.parent = pr;
    const comp = clamp(S.rule_compile, 0, 1), mach = clamp(S.rule_machine, 0, 1), form = clamp(S.rule_pyr, 0, 1);
    const tm = clamp(S.rule_time, 0, 3);
    now.t = tm;

    // ---- the rule and the pyramid (shrinking and dropping into the compiler as it runs)
    const bigA = 1 - prog(comp, 0.55, 0.8);
    if (bigA > 0.004) {
      const d1 = smooth(prog(comp, 0, 0.4)), d2 = smooth(prog(comp, 0.4, 0.8));
      set3(BIG.c, 0, lerp(lerp(0, 0.25, d1), DRUM[1] + DH / 2, d2), 0);
      BIG.s = lerp(lerp(1, 0.42, d1), 0.04, d2);
      if (comp <= 0.004) rates(S, t, bigA, form, ksP);
      pyramid(BIG, bigA, form, faces[0], SWP, ksP, tm, bigA * clamp(S.rule_path, 0, 1), false);
    } else faces[0].visible = false;

    // ---- the compiler: a drum whose gear spins faster as the rule goes in and the machine comes out
    const drA = prog(comp, 0, 0.3) * (1 - prog(mach, 0.45, 0.9)), dS = smooth(prog(comp, 0, 0.3)) * (1 - 0.3 * smooth(prog(mach, 0.45, 0.9)));
    drum.visible = drA > 0.004;
    if (drum.visible) {
      drum.position.set(DRUM[0], DRUM[1], DRUM[2]); drum.scale.set(DR * dS, DH * dS, DR * dS);
      drumMat.opacity = drA * set.uA.value; drumMat.depthWrite = drumMat.opacity > 0.97;
      const spin = t * 0.5 + 7 * smooth(prog(comp, 0.45, 1)) + 7 * smooth(prog(mach, 0, 0.6)), glow = prog(comp, 0.5, 0.8) * (1 - prog(mach, 0.3, 0.8));
      DOPT_DRUM.glow = 0.2 + 0.8 * glow;
      gears.add(set3(_a, DRUM[0], DRUM[1] + DH * dS / 2 + 0.035 * dS, DRUM[2]), UP, 0.36 * dS, spin, LK.BLUE, drA, DOPT_DRUM);
      rings.add(set3(_a, DRUM[0], DRUM[1] + DH * dS / 2, DRUM[2]), UP, DR * dS, 0.012, LK.RIM, drA, 0);
      rings.add(set3(_a, DRUM[0], DRUM[1] - DH * dS / 2, DRUM[2]), UP, DR * dS, 0.01, LK.RIM, 0.6 * drA, 0);
      halos.add(set3(_a, DRUM[0], DRUM[1] + DH * dS / 2 + 0.05, DRUM[2]), 1.1 * dS, LK.RIM, 0.35 * glow * drA);
    }

    // ---- the machine, and the circuit under it
    const mA = prog(mach, 0.05, 0.6);
    if (mach > 0.004) machine(S, t, mA, ksM);
    else { faces[1].visible = false; now.tEff = 0; }
    const cA = mA * clamp(S.rule_circuit, 0, 1);
    if (cA > 0.004) circuit(S, t, cA, ksM);

    tubes.end(); cones.end(); balls.end(); halos.end(); rings.end(); tiles.end(); gears.end(); glass.end(); boxes.end();
  }
  const DOPT_DRUM = { glow: 0.2 };

  // ---------------------------------------------------------------- anchors, labels, views
  const corner = i => () => { const l = Math.hypot(...CN[i]); return [BIG.c[0] + BIG.s * CN[i][0] * (1 + 0.24 / l) + 0.06, BIG.c[1] + BIG.s * CN[i][1] * (1 + 0.24 / l), BIG.c[2] + BIG.s * CN[i][2] * (1 + 0.24 / l)]; };
  const anchors = {
    pyramid: [0, 0.2, 0], ballA: () => [CN[0][0] + 0.2, CN[0][1] + 0.04, CN[0][2]], fast: () => now.fast.slice(),
    cA: corner(0), cC: corner(1), cG: corner(2), cT: corner(3),
    mix: () => [now.mix[0] + 0.1, now.mix[1] + 0.02, now.mix[2]], longrun: () => [now.longrun[0] + 0.08, now.longrun[1] - 0.06, now.longrun[2]],
    p1: () => [now.pts[0][0] + 0.04, now.pts[0][1] + 0.04, now.pts[0][2]], p2: () => [now.pts[1][0] + 0.04, now.pts[1][1] + 0.04, now.pts[1][2]],
    p3: () => [now.pts[2][0] + 0.04, now.pts[2][1] + 0.04, now.pts[2][2]],
    compiler: [DR + 0.05, DRUM[1], 0],
    parent: [PAR_T[0] + MT * 0.62, PAR_T[1] + 0.03, 0], child: [CHD_T[0] + MT * 0.62, CHD_T[1] + 0.03, 0], press: () => [now.head[0] + 0.13, now.head[1] + 0.05, 0],
    gears: [XC - 0.12, GC[1][1] - GR - 0.1, 0.06], dial: [GD[0] + 0.08, GD[1] - GR - 0.17, 0], mini: [MINI[0] - 0.12, MINI[1] + MS * 1.25, 0],
    machine: [0, 0.5, 0], circuit: [0, -0.55, 0],
    wireParent: [XL - 0.62, (WY[0] + WY[1]) / 2 + 0.02, 0], wireChild: [XL - 0.62, (WY[2] + WY[3]) / 2 + 0.02, 0],
    copyGates: [XCOPY[0] - 0.04, WY[0] + 0.1, 0], turn1: [XB[0] - BW[0] / 2, WY[3] - 0.11, 0], turn2: [XB[1] - BW[1] / 2 + 0.12, WY[3] - 0.11, 0],
    steps: [0.1, WY[0] + 0.12, 0],
  };
  const deg = v => `${Math.round(Math.abs(v) * 180 / PI)}°`;
  const pyrOn = S => 1 - prog(S.rule_compile, 0.3, 0.6);
  const mOn = S => prog(S.rule_machine, 0.6, 1), cOn = S => prog(S.rule_circuit, 0.5, 1) * mOn(S), simpleOn = S => prog(S.rule_simple, 0.4, 1);
  const labels = [
    { text: ['Thicker arrow', ' · swaps more readily'], at: 'fast', cls: '', alpha: S => prog(S.rule_balls, 0.85, 1) * (1 - prog(S.rule_pyr, 0, 0.3)) * pyrOn(S) },
    { text: ['Bigger ball', ' · more common in the long run'], at: 'ballA', cls: '', alpha: S => prog(S.rule_balls, 0.4, 0.8) * (1 - prog(S.rule_pyr, 0, 0.3)) * pyrOn(S) },
  ];
  ['cA', 'cC', 'cG', 'cT'].forEach((a, i) => labels.push({ text: [M.KETS[i], ''], at: a, cls: '', minor: true,
    alpha: S => prog(S.rule_pyr, 0.6, 1) * (1 - prog(S.rule_path, 0.1, 0.4)) * pyrOn(S) }));
  ['p1', 'p2', 'p3'].forEach((a, k) => labels.push({ text: [String(k + 1), ''], at: a, cls: 'grn', minor: true,
    alpha: S => prog(S.rule_path, 0.5, 1) * prog(S.rule_time, M.POINTS[k] - 0.05, M.POINTS[k]) * pyrOn(S) }));
  labels.push(
    { text: () => ['The mix', ` · after ${now.t.toFixed(2)} swaps per letter`], at: 'mix', cls: 'cyn', alpha: S => prog(S.rule_path, 0.5, 1) * pyrOn(S) },
    { text: ['Long-run mix', ''], at: 'longrun', cls: 'cyn', alpha: S => prog(S.rule_path, 0.5, 1) * pyrOn(S) * prog(S.rule_time, 0.3, 0.8) },
    { text: ['Compiler', ' · a rule in, a circuit out'], at: 'compiler', cls: '', alpha: S => prog(S.rule_compile, 0.2, 0.5) * (1 - prog(S.rule_machine, 0.3, 0.7)) },
    { text: ['Parent', ''], at: 'parent', cls: '', alpha: S => mOn(S) * (1 - cOn(S)) },
    { text: ['Child', ''], at: 'child', cls: '', alpha: S => mOn(S) * (1 - cOn(S)) },
    { text: ['Copy', ' · the parent’s letter onto the child'], at: 'press', cls: 'cyn', alpha: S => mOn(S) * prog(S.rule_copy, 0.03, 0.12) * (1 - prog(S.rule_copy, 0.85, 0.95)) * (1 - cOn(S)) },
    { text: ['Turn', ' · as far as the branch is long'], at: 'gears', cls: 'cyn', alpha: S => mOn(S) * prog(S.rule_copy, 0.9, 1) * prog(S.rule_time, 0.02, 0.12) * (1 - cOn(S)) },
    { text: () => ['Branch length', ` · ${now.t.toFixed(2)} swaps per letter`], at: 'dial', cls: 'grn', alpha: S => mOn(S) * prog(S.rule_copy, 0.85, 1) * (1 - simpleOn(S)) },
    { text: ['The child’s mix', ' · the same path'], at: 'mini', cls: '', alpha: S => mOn(S) * prog(S.rule_copy, 0.9, 1) * prog(S.rule_time, 0.02, 0.12) * (1 - cOn(S)) },
    { text: ['Parent', ' p1, p0'], at: 'wireParent', cls: '', minor: true, alpha: cOn },
    { text: ['Child', ' c1, c0'], at: 'wireChild', cls: '', minor: true, alpha: cOn },
    { text: ['Copy', ' · two CNOT gates'], at: 'copyGates', cls: 'cyn', alpha: S => cOn(S) * (1 - simpleOn(S)) },
    { text: () => ['c1 turns', ' ' + deg(now.ang[now.parent])], at: 'turn1', cls: 'cyn', alpha: S => cOn(S) * (1 - simpleOn(S)) },
    { text: () => ['c0 turns', ` ${deg(now.ang[4 + 2 * now.parent])} or ${deg(now.ang[5 + 2 * now.parent])}, as c1 is 0 or 1`], at: 'turn2', cls: 'cyn', alpha: S => cOn(S) * (1 - simpleOn(S)) },
    { text: ['Simple steps', ` · ${NRY} turns of one qubit, ${NCX} links`], at: 'steps', cls: 'cyn', alpha: S => cOn(S) * simpleOn(S) },
  );
  const cam = {
    default: [-26, 20, 4.0, 0, 0.3, 0],
    rates: [16, 12, 4.0, 0, 0.32, 0],
    pyramid: [-22, 16, 3.9, 0, 0.3, 0],
    path: [-32, 22, 4.3, 0, 0.28, 0],
    compiler: [0, 20, 3.9, 0, -0.12, 0],
    machine: [0, 8, 3.3, -0.1, 0.52, 0],
    copy: [0, 8, 2.5, (XP + XC) / 2, 0.68, 0],
    turn: [12, 6, 2.9, 0.05, 0.42, 0],
    circuit: [0, 6, 4.4, -0.15, 0.12, 0],
    steps: [0, 4, 3.5, -0.05, -0.5, 0],
  };
  const LETTER_OPTS = M.LETTERS.split('').map(l => [l, l]);
  const controls = [
    { key: 'view', label: 'View', options: [['rule', 'Rule'], ['path', 'Path'], ['machine', 'Machine'], ['circuit', 'Circuit'], ['steps', 'Simple steps']] },
    { key: 'model', label: 'Rule', options: M.MODELS.map(m => [m.key, m.name]) },
    { key: 'start', label: 'Start', options: LETTER_OPTS, when: v => v.view === 'path' },
    { key: 'parent', label: 'Parent', options: LETTER_OPTS, when: v => v.view === 'machine' || v.view === 'circuit' || v.view === 'steps' },
    { key: 'time', label: 'Branch length', options: [['0.15', '0.15'], ['0.45', '0.45'], ['1', '1'], ['1.6', '1.6'], ['2', '2']], when: v => v.view !== 'rule' },
  ];
  function explore(c) {
    const v = c.view || 'path', mk = M.MODELS.findIndex(m => m.key === c.model), mach = v === 'machine' || v === 'circuit' || v === 'steps';
    const tm = parseFloat(c.time), li = l => Math.max(0, M.LETTERS.indexOf(l || 'A'));
    return {
      rule_balls: 1, rule_flow: 1, rule_pyr: v === 'rule' ? 0 : 1, rule_path: v === 'rule' ? 0 : 1,
      rule_time: isFinite(tm) ? clamp(tm, 0, 2) : 1, rule_model: mk >= 0 ? mk : M.MODELS.findIndex(m => m.key === M.DEFAULT),
      rule_start: li(c.start), rule_parent: li(c.parent),
      rule_compile: mach ? 1 : 0, rule_machine: mach ? 1 : 0, rule_copy: 1,
      rule_circuit: v === 'circuit' || v === 'steps' ? 1 : 0, rule_simple: v === 'steps' ? 1 : 0, rule_run: 1,
    };
  }
  // what the engine's Rule tab reads: live numbers for the model, branch length and letters chosen
  const API = {
    models: M.MODELS.map((m, i) => ({ i, key: m.key, name: m.name, note: m.note })),
    // the mix after t from letter `start` under model mi
    mix: (mi, start, t) => Array.from(M.path(mi, start, t)),
    longRun: mi => Array.from(PIS[mi]),
    rates: mi => Array.from(QS[mi]),
    // the circuit for a branch: angles (radians) for parent letter `par`: c1's, and c0's for c1 = 0 and 1
    angles: (mi, t, par) => { const a = M.angles(mi, t); return { c1: a[par], c0: [a[4 + 2 * par], a[5 + 2 * par]] }; },
    turn: (mi, t) => M.turnAngle(mi, t),
    steps: () => ({ turns: NRY, links: NCX, copy: 2 }),
    shown: () => ({ model: now.model, start: now.start, parent: now.parent, t: now.t }),
  };
  return Object.assign(set, {
    params: { rule_a: 1, rule_balls: 1, rule_flow: 1, rule_pyr: 1, rule_path: 1, rule_time: 1, rule_model: M.MODELS.findIndex(m => m.key === M.DEFAULT),
      rule_start: 0, rule_compile: 0, rule_machine: 0, rule_parent: 0, rule_copy: 1, rule_circuit: 0, rule_simple: 0, rule_run: 1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};

// The stem set of the mutation story, in the tree set's frame. Chapter 6, at the origin while the tree is hidden: an RNA
// strand (the coupled example's fully paired stem: its top half, four loop letters GAAA, its bottom half read back)
// folds back on itself into a stem, a ladder of six pairs twisted as RNA stems are (about 11 pairs a turn) with the loop
// on top and white rungs; one letter changes alone and its rung snaps (a red cross, the stem bulging there); the
// coupling comes (a coupling gear on the pair: its two letters change together) and the pair changes both letters at
// once and holds; beside it the count: a pair's 16 combinations as a 4 x 4 square of tile pairs (the matching ones
// lit), three letters' 64 as a cube, ten letters' 1,048,576 as a vast cloud of points, against 20 qubits, two per letter.
// Chapter 7, with the species tree: the three species' stems at its tips (Figure 5, broken pairs as red crosses),
// three fields of 2,000 rebuilt ancestors in front of the root (one per method, each a tiny stem: lit in the letters'
// colours when all six pairs hold, dim with its broken rungs red otherwise; the poster's shares in the story, MMATH's
// rebuild live in explore), and the true ancestor big at the root beside the three rebuilt examples (letters that
// differ from it framed white). Everything follows the params and t; the small stems turn round the vertical to face
// the viewer (the camera seen at the last frame), the tiny ones in their shader.
SETS.stem = function (K) {
  const { THREE, clamp, lerp, prog, smooth } = K;
  const set = K.newSet('stem');
  const M = MMATH, D = MUT_DATA.test, LK = MLOOK(K, set), PI = Math.PI, UP = [0, 1, 0];
  const idx = M.toIdx, LC = LK.LCOL;
  const METHODS = M.METHODS, ORDER = ['indep', 'exact', 'coupled'];   // the fields left to right: the poster's 10, 20, 43 %
  const NAME = { indep: 'Letter by letter', exact: 'Exact pair model', coupled: 'Coupled circuit' };
  const NAME_LIVE = { indep: 'Letter by letter', exact: 'Exact pair model', coupled: 'Coupling, our stand-in' };

  // ---------------------------------------------------------------- the close-up: a strand folding into a stem
  const EX = D.rebuilt.coupled, LOOP = 'GAAA';                         // GTTACT / TGATGA: all six pairs hold
  const STRAND = idx(EX.top + LOOP + [...EX.bottom].reverse().join(''));
  const NL = STRAND.length, BI = 4;                                    // pair 5 (index 4) breaks and is coupled
  const SPC = 0.15, TSC = 0.108, HEND = 0.5, RR = 0.235, TW = 2 * PI / 11, LL = 4 * SPC, RHO = LL / PI;
  const pairOf = k => (k < 6 ? k : k >= NL - 6 ? NL - 1 - k : -1), sideOf = k => (k < 6 ? -1 : k >= NL - 6 ? 1 : 0);
  const CP = Array.from({ length: NL }, () => [0, 0, 0]), CDIR = Array.from({ length: 6 }, () => [0, 0, 0]);
  // where each letter is at fold f: a straight row (0), a hairpin folding round its loop (to 0.55), twisting into the
  // stem (to 1: 11 pairs a turn, pair BI square to the story's view and the loop in line with the top pair, so the
  // pair that breaks and the loop read; the lowest pairs turn away, as in any helix); bulge pushes pair BI's letters
  // apart
  function layout(f, bulge) {
    const fA = smooth(clamp(f / 0.55, 0, 1)), fB = smooth(clamp((f - 0.5) / 0.5, 0, 1)), al = PI * fA, H = HEND * fA;
    const g = lerp(1, RR / RHO, fB);
    for (let k = 0; k < NL; k++) {
      const s = (k - (NL - 1) / 2) * SPC;
      let x, y;
      if (al < 1e-4) { x = s; y = H; } else {
        const rho = LL / al;
        if (Math.abs(s) <= LL / 2) { const th = s / rho; x = rho * Math.sin(th); y = H - rho * (1 - Math.cos(th)); }
        else {
          const sg = s > 0 ? 1 : -1, te = sg * al / 2, d = Math.abs(s) - LL / 2;
          x = rho * Math.sin(te) + sg * d * Math.cos(al / 2); y = H - rho * (1 - Math.cos(te)) - d * Math.sin(al / 2);
        }
      }
      const i = pairOf(k), ph = fB * ((i >= 0 ? i : 5) - BI) * TW, c = Math.cos(ph), sn = Math.sin(ph);
      let xx = x * g;
      if (i === BI) xx += sideOf(k) * bulge;
      CP[k][0] = xx * c; CP[k][1] = y; CP[k][2] = -xx * sn;
      if (i >= 0) { CDIR[i][0] = c; CDIR[i][1] = 0; CDIR[i][2] = -sn; }
    }
  }

  // ---------------------------------------------------------------- the count: 16, 64, about a million, 20 qubits
  const CS = [1.18, 0.1, 0], PQ = 0.2, CC = [1.2, 0.2, -2.7], QY = -0.88, QZ = 0.3;
  const CUBE = [], CUBEC = [];
  for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) for (let k = 0; k < 4; k++) {
    CUBE.push([i, j, k]);
    CUBEC.push([0, 1, 2].map(d => (LC[i][d] + LC[j][d] + LC[k][d]) / 3));
  }
  const DIMC = LC.map(c => LK.mix(c, LK.GREY, 0.6));
  const NCLOUD = 60000;
  let cloud, cloudU;
  {
    const g = K.pointsGeo(NCLOUD), pa = g.attributes.position.array, ca = g.attributes.aCol.array, sa = g.attributes.aSize.array, aa = g.attributes.aA.array;
    const dl = new Float32Array(NCLOUD), r = K.rng(61);
    for (let n = 0; n < NCLOUD; n++) {
      // a vast soft cloud, densest at its middle, flattened a little
      const u = K.unit(r), rad = 0.2 + 2.4 * Math.pow(r(), 0.6);
      pa[3 * n] = CC[0] + u[0] * rad * 1.15; pa[3 * n + 1] = CC[1] + u[1] * rad * 0.62; pa[3 * n + 2] = CC[2] + u[2] * rad;
      const c = LC[Math.floor(r() * 4)];
      ca[3 * n] = c[0]; ca[3 * n + 1] = c[1]; ca[3 * n + 2] = c[2];
      sa[n] = 0.012 + 0.016 * r(); aa[n] = 0.1 + 0.22 * r(); dl[n] = r();
    }
    g.setAttribute('aDelay', new THREE.BufferAttribute(dl, 1));
    cloudU = { uExp: { value: 0 }, uCloudA: { value: 0 }, uC0: { value: new THREE.Vector3(CS[0], CS[1], CS[2] - 1.5 * PQ) } };
    const m = K.points(set, { uniforms: cloudU, head: 'attribute float aDelay; uniform float uExp, uCloudA; uniform vec3 uC0;',
      vertex: `float e = smoothstep(aDelay * 0.55, aDelay * 0.55 + 0.45, uExp);
  mv = modelViewMatrix * vec4(mix(uC0, position, e), 1.0); gl_Position = projectionMatrix * mv;
  gl_PointSize = pointPx(aSize * (0.6 + 0.4 * e), mv); vA *= uCloudA * (0.35 + 0.65 * e);
  if (vA < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);` });
    cloud = new THREE.Points(g, m);
    cloud.frustumCulled = false; cloud.visible = false;
    set.group.add(cloud);
  }
  // the qubits: two per letter for ten letters, each pair holding a letter's mix (the rule's, from that letter, at
  // point 2 of its path: MMATH.path and bloch), so they lean as qubits that hold a mix do
  const QB = [];
  for (let l = 0; l < 10; l++) {
    const p = M.path(M.DEFAULT, l % 4, M.POINTS[(l >> 2) % 3]), b = M.bloch(p);
    for (let q = 0; q < 2; q++) QB.push({ c: [1.0 + (l - 4.5) * 0.275 + (q - 0.5) * 0.125, QY, QZ], b, at: 3 * q });
  }

  // ---------------------------------------------------------------- chapter 7: where things stand
  const SPT = M.speciesTree();
  const SPECIES = ['s1', 's2', 's3'].map((k, j) => {
    const n = SPT.nodes[SPT.tipIds[j]], st = D.species[k];
    return { key: k, base: [n.pos[0], n.pos[1] + 0.05, n.pos[2]], top: idx(st.top), bottom: idx(st.bottom), broken: M.brokenPairs(st.top, st.bottom).length };
  });
  const TRUTH = { top: idx(D.truth.top), bottom: idx(D.truth.bottom), broken: M.brokenPairs(D.truth.top, D.truth.bottom).length };
  const TBASE = [0, -0.99, 0.2], FX = [-1.22, 0, 1.22], FZ = 1.2, FW = 1.02, FD = 0.7, COLS = 50, ROWS = 40, N = 2000, EZ = 1.8;
  const EXB = FX.map(x => [x, -0.99, EZ]);   // where the rebuilt examples stand: before their fields

  // ---------------------------------------------------------------- the fields: 3 x 2,000 tiny stems, one instanced quad each
  // each a tiny upright ladder drawn in its shader (rails, six rungs in its two letters' colours, a loop), turned
  // round the vertical to face the viewer (the camera in the set's frame, set per eye just before it is drawn); it
  // sprouts at its own moment (aInfo.y) as the fields grow, and moves to its sorted slot (all six holding first, from
  // the front) as uSort goes to 1
  const NF = 3 * N;
  const fieldU = { uCam: { value: new THREE.Vector3(0, 0, 40) }, uGrow: { value: 0 }, uSort: { value: 0 }, uK: { value: new THREE.Vector3(1, 1, 1) },
    uW: { value: 0.03 }, uH: { value: 0.088 }, uL0: { value: new THREE.Color(...LC[0]) }, uL1: { value: new THREE.Color(...LC[1]) },
    uL2: { value: new THREE.Color(...LC[2]) }, uL3: { value: new THREE.Color(...LC[3]) }, uRed: { value: new THREE.Color(...LK.RED) }, uRail: { value: new THREE.Color(0.78, 0.86, 1.0) } };
  const fieldGeo = new THREE.InstancedBufferGeometry();
  const FA = {};
  {
    const q = new THREE.PlaneGeometry(1, 1); q.translate(0, 0.5, 0);
    fieldGeo.setAttribute('position', q.attributes.position); fieldGeo.setIndex(q.index);
    for (const [k, n] of [['aPos', 3], ['aSort', 3], ['aPA', 3], ['aPB', 3], ['aInfo', 4]]) {
      FA[k] = new THREE.InstancedBufferAttribute(new Float32Array(NF * n), n);
      fieldGeo.setAttribute(k, FA[k]);
    }
    fieldGeo.instanceCount = NF;
    // the slots: a 50 x 40 grid per field (slot 0 at the front left), a little jitter; who sprouts when
    const r = K.rng(29), SLOT = new Float32Array(N * 3);
    for (let s = 0; s < N; s++) {
      const c = s % COLS, w = Math.floor(s / COLS);
      SLOT[3 * s] = (c - (COLS - 1) / 2 + (r() - 0.5) * 0.5) * FW / COLS;
      SLOT[3 * s + 1] = -1;
      SLOT[3 * s + 2] = FZ + FD / 2 - (w + 0.5 + (r() - 0.5) * 0.5) * FD / ROWS;
    }
    FA.SLOT = SLOT;
    const info = FA.aInfo.array;
    for (let f = 0; f < 3; f++) for (let a = 0; a < N; a++) { const i = f * N + a; info[4 * i + 1] = r(); info[4 * i + 2] = f; info[4 * i + 3] = r(); }
  }
  const fieldMat = new THREE.ShaderMaterial({
    uniforms: Object.assign({ uA: set.uA }, fieldU), transparent: true, side: THREE.DoubleSide,
    vertexShader: `
attribute vec3 aPos, aSort, aPA, aPB; attribute vec4 aInfo;
uniform vec3 uCam, uK; uniform float uA, uGrow, uSort, uW, uH;
varying vec2 vUv; varying vec3 vPA, vPB; varying float vGood, vK, vPh;
void main() {
  vec3 c = mix(aPos, aSort, smoothstep(0.0, 1.0, clamp(uSort * 1.3 - aInfo.w * 0.3, 0.0, 1.0)));
  float s = clamp((uGrow * 1.18 - aInfo.y) / 0.18, 0.0, 1.0);
  vec3 d = uCam - c; d.y = 0.0;
  d = dot(d, d) > 1e-8 ? normalize(d) : vec3(0.0, 0.0, 1.0);
  vec3 r = vec3(d.z, 0.0, -d.x);
  vec3 p = c + r * position.x * uW + vec3(0.0, position.y * uH * s, 0.0);
  vUv = vec2(position.x * 2.0, position.y); vPA = aPA; vPB = aPB; vGood = aInfo.x;
  vK = aInfo.z < 0.5 ? uK.x : aInfo.z < 1.5 ? uK.y : uK.z;
  vPh = aInfo.w * 6.2831853 + atan(d.x, d.z);
  gl_Position = projectionMatrix * modelViewMatrix * vec4(p, 1.0);
  if (s <= 0.0 || uA * vK < 0.004) gl_Position = vec4(2.0, 2.0, 2.0, 1.0);
}`,
    fragmentShader: `
uniform float uA; uniform vec3 uL0, uL1, uL2, uL3, uRed, uRail;
varying vec2 vUv; varying vec3 vPA, vPB; varying float vGood, vK, vPh;
vec3 lc(float k) { return k < 0.5 ? uL0 : k < 1.5 ? uL1 : k < 2.5 ? uL2 : uL3; }
float pairAt(float j) { return j < 0.5 ? vPA.x : j < 1.5 ? vPA.y : j < 2.5 ? vPA.z : j < 3.5 ? vPB.x : j < 4.5 ? vPB.y : vPB.z; }
// A-T, T-A, C-G, G-C, G-T, T-G (pair states 4x + y)
float holds(float s) { return (abs(s - 3.0) < 0.5 || abs(s - 12.0) < 0.5 || abs(s - 6.0) < 0.5 || abs(s - 9.0) < 0.5 || abs(s - 11.0) < 0.5 || abs(s - 14.0) < 0.5) ? 1.0 : 0.0; }
void main() {
  float y = vUv.y * 7.2, x = vUv.x;                 // across -1..1; six rungs between y 0.35 and 6.35, the loop above
  float hw = 0.32 + 0.68 * abs(cos(vPh + y * 0.57)); // the ladder's half width as seen: it twists, 11 pairs a turn
  vec3 col = vec3(0.0); float on = 0.0;
  if (y > 0.2 && y < 6.35 && abs(abs(x) - hw) < 0.15) { col = uRail; on = 1.0; }
  if (y >= 6.35) { float r = length(vec2(x / hw, (y - 6.35) / 0.8)); if (abs(r - 1.0) < 0.26) { col = uRail; on = 1.0; } }
  float j = floor(y - 0.35), fy = y - 0.35 - j;
  if (j >= 0.0 && j < 6.0 && abs(fy - 0.5) < 0.3 && abs(x) < hw) {
    float s = pairAt(j);
    if (holds(s) > 0.5) { col = x < 0.0 ? lc(floor(s / 4.0 + 0.01)) : lc(mod(s + 0.01, 4.0)); on = 2.0; } else { col = uRed; on = 3.0; }
  }
  if (on < 0.5) discard;
  float b = on > 2.5 ? 0.8 : vGood > 0.5 ? (on > 1.5 ? 1.45 : 0.8) : 0.24;   // all six hold: bright; else dim, its broken rungs red
  gl_FragColor = vec4(col * b * vK, uA);
}`,
  });
  set.mats.push(fieldMat);
  const fields = new THREE.Mesh(fieldGeo, fieldMat);
  fields.frustumCulled = false; fields.visible = false;
  fields.onBeforeRender = (r, s, cam) => {
    // the camera in the set's frame, per eye
    fieldU.uCam.value.setFromMatrixPosition(cam.matrixWorld);
    fields.worldToLocal(fieldU.uCam.value);
  };
  set.group.add(fields);

  // the rebuilt ancestors shown: the poster's shares (src 0: MMATH.crowd, exactly round(share x 2,000) with all six
  // pairs, the rest from that method's posterior with at least one broken), or the example computed live (src 1:
  // MMATH.rebuild with this w and seed); filled into the fields when the source, w or seed changes
  const dataCache = new Map();
  function dataOf(src, w, seed) {
    const key = `${src}|${w}|${seed}`;
    let R = dataCache.get(key);
    if (R) return R;
    R = {};
    for (const m of METHODS) {
      if (src === 1) { const r = M.rebuild(m, { w, seed, n: N }); R[m] = { samples: r.samples, good: r.good, intact: r.intact, share: r.share, expected: r.expected, best: r.best }; }
      else { const r = M.crowd(m, D.intact[m], N, seed); R[m] = { samples: r.samples, good: r.good, intact: r.intact, share: r.share, expected: null, best: D.rebuilt[m] }; }
      R[m].bestIdx = { top: idx(R[m].best.top), bottom: idx(R[m].best.bottom) };
      R[m].broken = M.brokenPairs(R[m].best.top, R[m].best.bottom).length;
    }
    if (dataCache.size > 12) dataCache.delete(dataCache.keys().next().value);
    dataCache.set(key, R);
    return R;
  }
  let fieldKey = null;   // the data the fields hold now
  function fillFields(R) {
    const ps = FA.aPos.array, so = FA.aSort.array, pa = FA.aPA.array, pb = FA.aPB.array, info = FA.aInfo.array, SL = FA.SLOT;
    ORDER.forEach((m, f) => {
      const d = R[m], r = K.rng(101 + f), perm = [...Array(N).keys()];
      for (let i = N - 1; i > 0; i--) { const j = Math.floor(r() * (i + 1)); const v = perm[i]; perm[i] = perm[j]; perm[j] = v; }
      // sorted: the ones with all six pairs holding take the front slots, in their random order
      const bySlot = perm.map((s, a) => [s, a]).sort((x, y) => x[0] - y[0]);
      let k = 0;
      const rank = new Int32Array(N);
      for (const [, a] of bySlot) if (d.good[a]) rank[a] = k++;
      for (const [, a] of bySlot) if (!d.good[a]) rank[a] = k++;
      for (let a = 0; a < N; a++) {
        const i = f * N + a, s0 = perm[a], s1 = rank[a];
        ps[3 * i] = FX[f] + SL[3 * s0]; ps[3 * i + 1] = SL[3 * s0 + 1]; ps[3 * i + 2] = SL[3 * s0 + 2];
        so[3 * i] = FX[f] + SL[3 * s1]; so[3 * i + 1] = SL[3 * s1 + 1]; so[3 * i + 2] = SL[3 * s1 + 2];
        for (let p = 0; p < 3; p++) { pa[3 * i + p] = d.samples[a * 6 + p]; pb[3 * i + p] = d.samples[a * 6 + 3 + p]; }
        info[4 * i] = d.good[a];
      }
    });
    for (const k of ['aPos', 'aSort', 'aPA', 'aPB', 'aInfo']) FA[k].needsUpdate = true;
  }

  // ---------------------------------------------------------------- the pieces drawn every frame
  const tiles = LK.tiles(170), tubes = LK.tubes(330), balls = LK.balls(40), halos = LK.halos(90), rings = LK.rings(30), boxes = LK.boxes(72),
    glass = LK.glass(24), cones = LK.cones(24), gears = LK.gears(2);
  set.group.add(tiles.mesh, tubes.mesh, balls.mesh, halos.mesh, rings.mesh, boxes.mesh, glass.mesh, cones.mesh, gears.mesh);
  const QPOOLS = { glass, rings, tubes, cones, balls, halos };
  const camW = new THREE.Vector3(0, 0, 40), camL = new THREE.Vector3();
  {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([], 3));
    const probe = new THREE.Mesh(g, new THREE.MeshBasicMaterial());
    probe.frustumCulled = false;
    probe.onBeforeRender = (r, s, cam) => { camW.setFromMatrixPosition(cam.matrixWorld); };   // (no vertices: never drawn)
    set.group.add(probe);
  }
  const yawTo = p => Math.atan2(camL.x - p[0], camL.z - p[2]);
  const _a = [0, 0, 0], _b = [0, 0, 0], _c = [0, 0, 0], _d = [0, 0, 0], _e = [0, 0, 0], _q = [0, 0, 0, 1], _col = [0, 0, 0];
  const L6 = Array.from({ length: 6 }, () => [0, 0, 0]), R6 = Array.from({ length: 6 }, () => [0, 0, 0]);
  const RAIL = [0.5, 0.64, 0.9], WHITE = LK.WHITE, OPT_PAIR = { pair: true, glow: 0.35 };
  const add3 = (o, a, b, s) => { o[0] = a[0] + b[0] * s; o[1] = a[1] + b[1] * s; o[2] = a[2] + b[2] * s; return o; };
  // a red cross where a rung would be (a broken pair): two strokes across the rung's middle m, in the plane of the
  // rung's direction e and up, half size h
  function cross(m, e, h, a) {
    for (let sg = -1; sg <= 1; sg += 2) {
      _d[0] = m[0] + e[0] * h * sg; _d[1] = m[1] + h; _d[2] = m[2] + e[2] * h * sg;
      _e[0] = m[0] - e[0] * h * sg; _e[1] = m[1] - h; _e[2] = m[2] - e[2] * h * sg;
      tubes.add(_d, _e, h * 0.16, LK.RED, a, 0);
    }
  }
  // a small stem standing at base: six pairs s apart (top[i] left, bottom[i] right as you look), a backbone and an
  // empty loop on top; it faces the viewer, twisted gently; ref (top and bottom of another stem): letters that differ
  // from it framed white (by refA)
  function smallStem(base, s, top, bottom, a, ref, refA) {
    if (a <= 0.003) return;
    const yaw = yawTo(base), ts = s * 0.8, hw = s * 1.35;
    for (let i = 0; i < 6; i++) {
      const ph = yaw + (i - 2.5) * 0.16, ex = Math.cos(ph), ez = -Math.sin(ph), y = base[1] + s * (i + 0.6);
      L6[i][0] = base[0] - ex * hw; L6[i][1] = y; L6[i][2] = base[2] - ez * hw;
      R6[i][0] = base[0] + ex * hw; R6[i][1] = y; R6[i][2] = base[2] + ez * hw;
      LK.quat(_q, UP, ph);
      const ft = ref && top[i] !== ref.top[i] ? refA : 0, fb = ref && bottom[i] !== ref.bottom[i] ? refA : 0;
      tiles.add(L6[i], _q, ts, top[i], a, ft, 0);
      tiles.add(R6[i], _q, ts, bottom[i], a, fb, 0);
      _b[0] = ex; _b[1] = 0; _b[2] = ez;
      if (M.ok(top[i], bottom[i])) tubes.add(add3(_c, L6[i], _b, ts * 0.55), add3(_d, R6[i], _b, -ts * 0.55), s * 0.075, WHITE, a, 0);
      else { _a[0] = base[0]; _a[1] = y; _a[2] = base[2]; cross(_a, _b, s * 0.32, a); }
      if (i > 0) { tubes.add(L6[i - 1], L6[i], s * 0.06, RAIL, 0.8 * a, 0); tubes.add(R6[i - 1], R6[i], s * 0.06, RAIL, 0.8 * a, 0); }
    }
    // the loop: an arc over the top pair
    const c0 = base[0], cy = L6[5][1] + s * 0.25, c2 = base[2], ph = yaw + 2.5 * 0.16, ex = Math.cos(ph), ez = -Math.sin(ph);
    _c[0] = L6[5][0]; _c[1] = L6[5][1]; _c[2] = L6[5][2];
    for (let k = 1; k <= 7; k++) {
      const th = PI * (1 - k / 7), cs = Math.cos(th) * hw;
      _d[0] = c0 + ex * cs; _d[1] = cy + Math.sin(th) * hw * 0.9; _d[2] = c2 + ez * cs;
      if (k === 7) { _d[0] = R6[5][0]; _d[1] = R6[5][1]; _d[2] = R6[5][2]; }
      tubes.add(_c, _d, s * 0.06, RAIL, 0.8 * a, 0);
      _c[0] = _d[0]; _c[1] = _d[1]; _c[2] = _d[2];
    }
  }

  // what the frame shows now (anchors, labels, the api)
  const now = { R: null, src: 0, w: 8, seed: 1, method: -1, top: STRAND.slice(), gear: [0, 0, 0], brk: [0, 0, 0] };
  const ORIG = STRAND.slice(), cur = new Uint8Array(NL);

  function update(S, t) {
    LK.depth();
    set.group.updateMatrixWorld();
    camL.copy(camW); set.group.worldToLocal(camL);
    tiles.begin(); tubes.begin(); balls.begin(); halos.begin(); rings.begin(); boxes.begin(); glass.begin(); cones.begin(); gears.begin();

    // ---- the close-up
    const strand = clamp(S.stem_strand, 0, 1), fold = clamp(S.stem_fold, 0, 1), brk = clamp(S.stem_break, 0, 1);
    const coup = clamp(S.stem_couple, 0, 1), both = clamp(S.stem_both, 0, 1);
    if (strand > 0.003) {
      layout(fold, 0.075 * prog(brk, 0.5, 0.9) * (both >= 0.5 ? 0 : 1));
      cur.set(ORIG);
      const kt = BI, kb = NL - 1 - BI;   // pair BI's two letters in the strand
      if (both >= 0.5) { cur[kt] = 3; cur[kb] = 0; } else if (brk >= 0.5) cur[kt] = 0;   // C-G to T-A together; C to A alone
      const flipA = Math.max(1 - Math.abs(brk - 0.5) / 0.12, 1 - Math.abs(both - 0.5) / 0.12, 0);
      const rungA = strand * prog(fold, 0.75, 1);
      for (let k = 0; k < NL; k++) {
        const a = strand * prog(strand, k / NL * 0.8, k / NL * 0.8 + 0.2);
        const hot = (k === kt && (Math.abs(brk - 0.5) < 0.12 || Math.abs(both - 0.5) < 0.12)) || (k === kb && Math.abs(both - 0.5) < 0.12) ? flipA : 0;
        tiles.add(CP[k], null, TSC, cur[k], a, cur[k] !== ORIG[k] ? 1 : 0, hot);
        if (hot > 0.01) halos.add(CP[k], 0.5, LC[cur[k]], 0.8 * hot * a);
        if (k > 0) tubes.add(CP[k - 1], CP[k], 0.016, RAIL, 0.85 * Math.min(a, strand), 0);
      }
      // the rungs: white where the pair holds; pair BI snaps when it breaks (two stubs pull back, a red cross)
      for (let i = 0; i < 6 && rungA > 0.003; i++) {
        const A = CP[i], B = CP[NL - 1 - i], e = CDIR[i], holds = M.ok(cur[i], cur[NL - 1 - i]);
        add3(_c, A, e, TSC * 0.55); add3(_d, B, e, -TSC * 0.55);
        if (i === BI) { _a[0] = (A[0] + B[0]) / 2; _a[1] = (A[1] + B[1]) / 2; _a[2] = (A[2] + B[2]) / 2; now.brk[0] = B[0] + 0.08; now.brk[1] = B[1]; now.brk[2] = B[2]; now.gear[0] = _a[0]; now.gear[1] = _a[1]; now.gear[2] = _a[2]; }
        if (holds) {
          const lit = i === BI ? prog(both, 0.5, 0.8) : 0;
          tubes.add(_c, _d, 0.014, LK.mix(WHITE, LK.CYAN, lit, _col), rungA, 0);
          if (lit > 0.01) halos.add(_a, 0.3, LK.CYAN, 0.5 * lit * rungA);
        } else {
          const snap = prog(brk, 0.5, 0.75), stub = 0.5 * (1 - snap);
          _e[0] = lerp(_c[0], _d[0], stub); _e[1] = lerp(_c[1], _d[1], stub); _e[2] = lerp(_c[2], _d[2], stub);
          if (stub > 0.01) tubes.add(_c, _e, 0.014, WHITE, rungA, 0);
          _e[0] = lerp(_d[0], _c[0], stub); _e[1] = lerp(_d[1], _c[1], stub); _e[2] = lerp(_d[2], _c[2], stub);
          if (stub > 0.01) tubes.add(_d, _e, 0.014, WHITE, rungA, 0);
          cross(_a, e, 0.05, rungA * prog(brk, 0.55, 0.85));
        }
      }
      // the coupling: a coupling gear over pair BI's rung, its double band along the rung (the poster's sign for a
      // pair's two letters), winding in as it comes and turning half round as both letters change
      if (coup > 0.003) {
        const e = CDIR[BI];
        _b[0] = -e[2]; _b[1] = 0; _b[2] = e[0];   // across the rung, level: the gear's axis
        add3(_a, now.gear, _b, 0.045);
        gears.add(_a, _b, 0.11, PI * smooth(both) - 1.4 * (1 - coup), LK.BLUE, strand * coup * rungA, OPT_PAIR);
      }
    }

    // ---- the count
    const cnt = clamp(S.stem_count, 0, 3), qa = clamp(S.stem_qubits, 0, 1);
    const sqA = prog(cnt, 0, 0.7), ext = smooth(clamp(cnt - 1, 0, 1)), cl = clamp(cnt - 2, 0, 1);
    if (sqA > 0.003) {
      LK.quat(_q, UP, 0);
      for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
        const ok = M.OKS[4 * i + j] === 1, a = sqA * prog(sqA, (4 * i + j) / 16 * 0.6, (4 * i + j) / 16 * 0.6 + 0.4) * (1 - ext) * (1 - cl);
        if (a <= 0.003) continue;
        _a[0] = CS[0] + (j - 1.5) * PQ - 0.039; _a[1] = CS[1] + (1.5 - i) * PQ; _a[2] = CS[2];
        tiles.add(_a, _q, 0.072, i, a, 0, ok ? 0.45 : 0, ok ? null : DIMC[i]);
        _a[0] += 0.078;
        tiles.add(_a, _q, 0.072, j, a, 0, ok ? 0.45 : 0, ok ? null : DIMC[j]);
        if (ok) { _a[0] -= 0.039; halos.add(_a, 0.2, WHITE, 0.25 * a); }
      }
      // the cube: the square grows back into four layers (the third letter); then it bursts into the cloud
      const ca = sqA * prog(ext, 0, 0.3) * (1 - prog(cl, 0, 0.6));
      if (ca > 0.003) for (let n = 0; n < 64; n++) {
        const [i, j, k] = CUBE[n];
        _a[0] = CS[0] + (j - 1.5) * PQ; _a[1] = CS[1] + (1.5 - i) * PQ; _a[2] = CS[2] - k * PQ * ext;
        boxes.add(_a, CELL, CUBEC[n], ca * (k === 0 ? 1 : prog(ext, 0.2 * k, 0.2 * k + 0.4)));
      }
    }
    cloudU.uExp.value = smooth(cl); cloudU.uCloudA.value = prog(cl, 0, 0.25); cloud.visible = cl > 0.003;
    if (qa > 0.003) for (let n = 0; n < QB.length; n++) {
      const Q = QB[n], a = qa * prog(qa, n / QB.length * 0.6, n / QB.length * 0.6 + 0.4);
      LK.qubit(QPOOLS, Q.c, 0.054, Q.b, a, Q.at ? QOPT1 : QOPT0);
    }

    // ---- chapter 7: the species' stems, the fields, the true ancestor and the rebuilt examples
    const spA = clamp(S.stem_species, 0, 1), fl = clamp(S.stem_fields, 0, 1), tr = clamp(S.stem_truth, 0, 1), exA = clamp(S.stem_examples, 0, 1);
    const src = Math.round(S.stem_src) === 1 ? 1 : 0, w = clamp(Math.round(S.stem_w), 1, 30), seed = Math.max(1, Math.round(S.stem_seed));
    const meth = Math.round(S.stem_method);
    now.src = src; now.w = w; now.seed = seed; now.method = meth >= 0 && meth < 3 ? meth : -1;
    const same = now.R && now.Rsrc === src && now.Rw === w && now.Rseed === seed;
    const R = same ? now.R : (fl > 0.003 || exA > 0.003) ? dataOf(src, w, seed) : now.R;
    if (R && !same && (fl > 0.003 || exA > 0.003)) { now.R = R; now.Rsrc = src; now.Rw = w; now.Rseed = seed; }
    for (let j = 0; j < 3; j++) {
      const P = SPECIES[j];
      smallStem(P.base, 0.07, P.top, P.bottom, spA * prog(spA, j * 0.2, j * 0.2 + 0.6), TRUTH, tr);
    }
    if (fl > 0.003) {
      if (fieldKey !== R) { fillFields(R); fieldKey = R; }
      fieldU.uGrow.value = fl; fieldU.uSort.value = clamp(S.stem_sort, 0, 1);
      fieldU.uK.value.set(fieldK(ORDER[0], exA), fieldK(ORDER[1], exA), fieldK(ORDER[2], exA));
      // a dark bed under each field
      for (let f = 0; f < 3; f++) { _a[0] = FX[f]; _a[1] = -1.006; _a[2] = FZ; boxes.add(_a, BED, BEDC, 0.75 * prog(fl, 0, 0.15)); }
    }
    fields.visible = fl > 0.003;
    if (tr > 0.003) {
      smallStem(TBASE, 0.12, TRUTH.top, TRUTH.bottom, tr, null, 0);
      halos.add(TBASE, 0.6, LK.AMBER, 0.25 * tr);
    }
    if (exA > 0.003 && R) for (let f = 0; f < 3; f++) {
      const m = ORDER[f];
      smallStem(EXB[f], 0.085, R[m].bestIdx.top, R[m].bestIdx.bottom, exA * prog(exA, f * 0.2, f * 0.2 + 0.6), TRUTH, 1);
    }
    tiles.end(); tubes.end(); balls.end(); halos.end(); rings.end(); boxes.end(); glass.end(); cones.end(); gears.end();
  }
  const QOPT0 = { col: LK.INK, glow: 0.3, marks: false }, QOPT1 = { at: 3, col: LK.INK, glow: 0.3, marks: false };
  const BED = [FW + 0.08, 0.008, FD + 0.08], BEDC = [0.05, 0.08, 0.14], CELL = [PQ * 0.52, PQ * 0.52, PQ * 0.52];
  // a field's brightness: dimmer when another method is picked, and while the examples stand in front
  const fieldK = (m, exA) => (now.method < 0 || METHODS[now.method] === m ? 1 : 0.32) * (1 - 0.55 * exA);

  // ---------------------------------------------------------------- anchors, labels, views
  const pct = v => `${Math.round(v * 100)} %`;
  const nb = n => `${n} broken pair${n === 1 ? '' : 's'}`;
  const anchors = {
    stem: [0, 0, 0], loop: [0.12, 0.62, 0], top: [0.3, 0.45, 0], brk: () => now.brk, gear: () => [now.gear[0] + 0.1, now.gear[1] + 0.06, now.gear[2]],
    square: [CS[0] - 0.42, CS[1] + 0.48, 0], cube: [CS[0] - 0.42, CS[1] + 0.52, -0.3], cloud: [CC[0] - 0.5, CC[1] + 1.25, CC[2] + 0.4], qubits: [QB[0].c[0] - 0.06, QY - 0.13, QZ],
    truth: [TBASE[0] + 0.2, TBASE[1] + 0.92, TBASE[2]], root: [0, -1, 0],
  };
  SPECIES.forEach((P, j) => { anchors['sp' + (j + 1)] = [P.base[0] + 0.1, P.base[1] + 0.62, P.base[2]]; });
  ORDER.forEach((m, f) => {
    // (behind the outer fields, before the middle one: three tags side by side would touch on a narrow screen)
    anchors['field_' + m] = f === 1 ? [FX[f] - FW / 2 + 0.02, -0.97, FZ + FD / 2 + 0.06] : [FX[f] - FW / 2 + 0.02, -0.93, FZ - FD / 2 - 0.02];
    anchors['ex_' + m] = [FX[f] - (f === 2 ? 0.55 : 0.4), -0.22, EZ];
  });
  const share = m => {
    const R = now.R;
    if (!R) return '';
    return now.src === 1 ? ` · ${pct(R[m].share)} here` : ` · ${pct(D.intact[m])} intact`;
  };
  const brk0 = MMATH.LETTERS[ORIG[BI]];
  const labels = [
    { text: ['A stem', ' · six pairs and a loop'], at: 'top', cls: '',
      alpha: S => clamp(S.stem_strand, 0, 1) * prog(S.stem_fold, 0.85, 1) * (1 - prog(S.stem_break, 0, 0.3)) * (1 - prog(S.stem_couple, 0, 0.3)) * (1 - prog(S.stem_count, 0, 0.4)) },
    { text: ['Pair broken', ` · ${brk0} became A alone`], at: 'brk', cls: 'amb',
      alpha: S => clamp(S.stem_strand, 0, 1) * prog(S.stem_break, 0.6, 0.9) * (S.stem_both >= 0.5 ? 0 : 1) * (1 - prog(S.stem_count, 0, 0.4)) },
    { text: ['Coupled', ' · both letters change together'], at: 'gear', cls: 'cyn',
      alpha: S => clamp(S.stem_strand, 0, 1) * prog(S.stem_couple, 0.5, 1) * (1 - prog(S.stem_both, 0.35, 0.6)) * (1 - prog(S.stem_break, 0.3, 0.6)) * (1 - prog(S.stem_count, 0, 0.4)) },
    { text: [`${brk0}–${MMATH.LETTERS[ORIG[NL - 1 - BI]]} became T–A`, ' · the pair holds'], at: 'gear', cls: 'cyn',
      alpha: S => clamp(S.stem_strand, 0, 1) * prog(S.stem_both, 0.6, 0.9) * (1 - prog(S.stem_count, 0, 0.4)) },
    { text: [`${M.combos(2)} combinations`, ' · a pair of letters'], at: 'square', cls: 'cyn', alpha: S => prog(S.stem_count, 0.3, 0.8) * (1 - prog(S.stem_count, 1.15, 1.5)) },
    { text: [`${M.combos(3)} combinations`, ' · three letters'], at: 'cube', cls: 'cyn', alpha: S => prog(S.stem_count, 1.5, 1.9) * (1 - prog(S.stem_count, 2.15, 2.5)) },
    { text: ['About a million', ` · ten letters: ${M.combos(10).toLocaleString('en-GB')}`], at: 'cloud', cls: 'amb', alpha: S => prog(S.stem_count, 2.5, 2.9) },
    { text: [`${M.qubits(10)} qubits`, ' · two per letter, for all ten'], at: 'qubits', cls: 'grn', alpha: S => prog(S.stem_qubits, 0.5, 1) },
  ];
  SPECIES.forEach((P, j) => labels.push({ text: [`Species ${j + 1}`, ` · ${nb(P.broken)}`], at: 'sp' + (j + 1), cls: '',
    alpha: S => prog(S.stem_species, 0.4 + 0.15 * j, 0.7 + 0.15 * j) * (1 - prog(S.stem_fields, 0.1, 0.3)) }));
  // (a field's tag comes as the story names it: stem_named counts the fields named so far, left to right)
  ORDER.forEach((m, f) => labels.push({ text: () => [now.src === 1 ? NAME_LIVE[m] : NAME[m], share(m)], at: 'field_' + m, cls: m === 'coupled' ? 'cyn' : m === 'exact' ? 'grn' : '',
    alpha: S => prog(S.stem_fields, 0.3, 0.7) * clamp(S.stem_named - f, 0, 1) * (1 - prog(S.stem_examples, 0.1, 0.5)) * (Math.round(S.stem_method) < 0 || METHODS[Math.round(S.stem_method)] === m ? 1 : 0.5) }));
  labels.push({ text: ['True ancestor', ` · ${nb(TRUTH.broken)}`], at: 'truth', cls: 'amb', alpha: S => prog(S.stem_truth, 0.5, 1) });
  ORDER.forEach(m => labels.push({ text: () => [now.src === 1 ? NAME_LIVE[m] : NAME[m], now.R ? ` · ${now.R[m].broken || 'none'} broken` : ''], at: 'ex_' + m, cls: m === 'coupled' ? 'cyn' : m === 'exact' ? 'grn' : '',
    alpha: S => prog(S.stem_examples, 0.5, 1) }));
  const cam = {
    default: [16, 6, 3.4, 0, 0, 0],
    strand: [0, 4, 4.4, 0, 0.1, 0],
    fold: [14, 8, 3.2, 0, 0.02, 0],
    break: [24, 6, 2.3, 0.12, 0.12, 0],
    count: [-12, 10, 5.4, 0.85, -0.1, -0.15],
    cloud: [-10, 12, 8.4, 1.0, 0.0, -1.4],
    species: [18, 16, 3.9, 0, -0.38, 0.1],
    fields: [0, 30, 4.6, 0, -0.95, 1.15],
    compare: [0, 27, 4.7, 0.14, -0.5, 0.9],
    what: [8, 14, 4.3, 0.16, -0.36, 0],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['stem', 'Stem'], ['count', 'Count'], ['rebuild', 'Rebuild'], ['compare', 'Compare']] },
    { key: 'src', label: 'Numbers', options: [['test', 'The authors\' test'], ['live', 'This example']] },
    { key: 'w', label: 'Pair favour', options: [['1', '1'], ['4', '4'], ['8', '8'], ['16', '16'], ['30', '30']] },
    { key: 'method', label: 'Method', options: [['all', 'All three'], ['indep', 'Letter by letter'], ['exact', 'Exact'], ['coupled', 'Coupling']] },
  ];
  function explore(c) {
    const v = c.view || 'stem', rb = v === 'rebuild' || v === 'compare', close = v === 'stem' || v === 'count';
    return {
      stem_strand: close ? 1 : 0, stem_fold: 1, stem_break: 0, stem_couple: v === 'stem' ? 1 : 0, stem_both: v === 'stem' ? 1 : 0,
      stem_count: v === 'count' ? 3 : 0, stem_qubits: v === 'count' ? 1 : 0,
      stem_species: rb ? 1 : 0, stem_fields: rb ? 1 : 0, stem_named: 3, stem_sort: v === 'compare' ? 1 : 0, stem_truth: v === 'compare' ? 1 : 0, stem_examples: v === 'compare' ? 1 : 0,
      stem_src: c.src === 'live' ? 1 : 0, stem_w: clamp(parseInt(c.w, 10) || 8, 1, 30), stem_seed: 1,
      stem_method: c.method && c.method !== 'all' ? METHODS.indexOf(c.method) : -1,
    };
  }

  // ---------------------------------------------------------------- picking and what explore reads
  const _v = new THREE.Vector3(), _w = new THREE.Vector3(), _ray = new THREE.Ray(), _inv = new THREE.Matrix4();
  // what a ray (a THREE.Raycaster in world coordinates) points at: a field ({ kind: 'field', method }) or a stem
  // ({ kind: 'stem', which: 'truth' | 'indep' | 'exact' | 'coupled' | 's1' | 's2' | 's3' }), or null
  function pick(rc) {
    set.group.updateMatrixWorld();
    const Mw = set.group.matrixWorld, s0 = Mw.getMaxScaleOnAxis(), ray = rc.ray;
    let best = null, bt = Infinity;
    const test = (p, r, hit) => {
      _v.set(p[0], p[1], p[2]).applyMatrix4(Mw);
      const d = _w.copy(_v).sub(ray.origin).dot(ray.direction), rr = r * s0;
      if (d > 0 && d < bt && ray.distanceSqToPoint(_v) < rr * rr) { bt = d; best = hit; }
    };
    const vis = set.group.visible;
    if (!vis) return null;
    if (fields.visible) {
      // the fields lie on the floor of the frame (y -1): where the ray meets it
      _ray.copy(ray).applyMatrix4(_inv.copy(Mw).invert());
      const t = (-0.97 - _ray.origin.y) / _ray.direction.y;
      if (t > 0) {
        _ray.at(t, _v);
        ORDER.forEach((m, f) => {
          if (Math.abs(_v.x - FX[f]) < FW / 2 + 0.03 && Math.abs(_v.z - FZ) < FD / 2 + 0.03) {
            _w.copy(_v).applyMatrix4(Mw);
            const d = _w.sub(ray.origin).dot(ray.direction);
            if (d < bt) { bt = d; best = { kind: 'field', method: m }; }
          }
        });
      }
    }
    if (now.R && fields.visible) ORDER.forEach((m, f) => test([FX[f], -0.68, EZ], 0.2, { kind: 'stem', which: m }));
    test([TBASE[0], TBASE[1] + 0.4, TBASE[2]], 0.28, { kind: 'stem', which: 'truth' });
    SPECIES.forEach(P => test([P.base[0], P.base[1] + 0.25, P.base[2]], 0.2, { kind: 'stem', which: P.key }));
    return best;
  }
  const API = {
    methods: ORDER, names: NAME, namesLive: NAME_LIVE, strand: M.toStr(STRAND), loop: LOOP, pair: BI,
    truth: D.truth, species: D.species, count: { pair: M.combos(2), three: M.combos(3), ten: M.combos(10), qubits: M.qubits(10) },
    // the rebuild for a source (0 the authors' test, 1 this example live), pair favour w and seed: per method
    // { share, intact, expected (live only), best: { top, bottom }, broken }
    results: (src = now.src, w = now.w, seed = now.seed) => {
      const R = dataOf(src ? 1 : 0, w, seed), o = {};
      for (const m of METHODS) o[m] = { share: R[m].share, intact: R[m].intact, n: N, expected: R[m].expected, best: R[m].best, broken: R[m].broken };
      return o;
    },
    pick,
  };
  return Object.assign(set, {
    params: { stem_a: 1, stem_strand: 1, stem_fold: 1, stem_break: 0, stem_couple: 0, stem_both: 0, stem_count: 0, stem_qubits: 0,
      stem_species: 0, stem_fields: 0, stem_named: 3, stem_sort: 0, stem_truth: 0, stem_examples: 0, stem_src: 0, stem_w: 8, stem_seed: 1, stem_method: -1 },
    update, anchors, labels, cam, controls, explore,
    api: () => API,
  });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['letters', 'tree', 'rule', 'stem'];
// sets drawn in another set's frame: the stems stand on the species tree's tips and their fields in front of its root,
// so the two always turn together
const FRAME = { stem: 'tree' };
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
  // the sets themselves: each built on its own, a step of the load (buildSet, LOAD)
  GL.sets = {};
}
// one set, built as a step of the load (LOAD) and hidden until the story fades it in
function buildSet(k) {
  const s = SETS[k](K);
  GL.sets[k] = s;
  GL.world.add(s.group);
  s.setAlpha(0);
}
// once every set is built (a step of the load): what joins them (nothing here)
function sceneJoin() {}
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
// on a screen held sideways without the side panel (the panel below, the scene in a strip above it) a view may come
// closer and aim lower: v[10] and v[11] (LOW in the story), taken in full from 1.2 : 1 on (as GL.fit's strip)
const lowK = () => (GL.wide ? 0 : clamp(((GL.aspect || 1) - 0.6) / 0.6, 0, 1));
// (v[7..9]: the target's shift clear of the side panel, FIT in the story; on a screen without a side panel it goes back)
function applyCamera(v) {
  const u = GL.wide ? 0 : 1, L = lowK(), lk = 1 + ((v[10] || 1) - 1) * L;
  viewDir(v, _vd); _vt.set(v[3] - u * (v[7] || 0), v[4] - u * (v[8] || 0) + L * (v[11] || 0), v[5] - u * (v[9] || 0));
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1) * narrowK() * lk);
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
  [0, 0], [2.6, 2.4], [5.2, 4], [5.8, 4.6], [10.7, 6.5], [18.3, 13], [19, 13.6], [25.1, 15],
  [31.2, 20.5], [34.6, 23], [35.2, 23.6],             // Letters
  [43.9, 26], [44.6, 26.6], [45.8, 27.2], [71.6, 50.6], [79.4, 51.5], [80.1, 52.1], [83.2, 52.5],
  [86.1, 55.1], [101.1, 57], [101.8, 57.6],           // Family tree
  [110.4, 60], [111.1, 60.6], [112.4, 61.2], [120.4, 66], [134.7, 79], [143.2, 84], [149.6, 88],
  [150.2, 88.6], [156.4, 91], [157, 91.6],            // Qubits
  [170.8, 96], [171.5, 96.6], [172.3, 97.2], [173, 97.8], [176.5, 99], [179.9, 102], [184.3, 106],
  [194.9, 113], [202.6, 118], [211.1, 124], [216.6, 128],  // The rule
  [229.7, 134], [230.4, 134.6], [231.2, 135.2], [244.2, 147], [254, 154], [261.6, 160.5],
  [270.5, 168.6], [275, 170], [275.6, 170.6],         // Machine
  [305.1, 180], [306.4, 181.18], [307.4, 181.2], [337.6, 208.6], [342.4, 209], [346.8, 213],
  [349.4, 215], [350, 215.6], [351.9, 216], [352.6, 216.6],  // Pairs
  [371.4, 218], [372.1, 218.6], [373.4, 219.2], [387.4, 232], [393.8, 236], [403.7, 245],
  [411.3, 249], [412, 249.6], [421.5, 253], [422.2, 253.6], [430, 256],  // Rebuild
  [446.6, 264], [447.9, 265.18], [448.9, 265.2], [458.7, 270], [459.3, 270.6], [468, 273],
  [468.7, 273.6], [479, 278], [479.7, 278.6], [495.6, 280], [497.3, 281.6], [510.2, 282], [519, 290],  // What for
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
  { key: 'title', name: 'Letters', a: 0, b: 26 },
  { key: 'tree', name: 'Family tree', a: 26, b: 60 },
  { key: 'qubits', name: 'Qubits', a: 60, b: 96 },
  { key: 'rule', name: 'The rule', a: 96, b: 134 },
  { key: 'machine', name: 'Machine', a: 134, b: 180 },
  { key: 'pairs', name: 'Pairs', a: 180, b: 218 },
  { key: 'rebuild', name: 'Rebuild', a: 218, b: 264 },
  { key: 'what', name: 'What for', a: 264, b: 290 },
];
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden
const DEF = {};
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
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

const ST = { labels: [], items: [], stand: [] };
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
// (measured at 1280 x 760: each view's parts between the panel's right edge and the screen's, above the timeline; the
// sets' own views fill a whole screen, so most stand back a little and move their target left of the parts' middle)
const FIT = {
  letters: { default: [0, 0, 0.7, -0.22, -0.06, 0], helix: [0, 0, 1.1, -0.17, -0.03, -0.08], peel: [0, 0, 0.6, -0.17, -0.03, 0.02],
    rows: [0, 0, 0.45, -0.32, -0.09, 0.06], qubits: [0, 0, 0.1, -0.13, 0.08, 0], reads: [0, 0, 0.25, -0.22, 0.02, 0] },
  tree: { default: [0, 0, 0.1, -0.26, -0.23, 0.11], grow: [0, 0, 1.4, -0.28, 0.24, 0.09], crown: [0, 0, 0.3, -0.24, -0.3, 0.14],
    pair: [0, 0, 0.5, -0.51, -0.54, 0.53], gears: [0, 0, 1.45, -0.24, 0.02, 0.13], species: [0, 0, 0.65, -0.35, -0.1, 0.12],
    what: [0, 0, 0.1, -0.5, -0.1, 0.08] },
  rule: { default: [0, 0, 0.35, -0.1, -0.12, -0.05], rates: [0, 0, 2.6, -0.32, -0.07, 0.09], pyramid: [0, 0, 0.6, -0.05, -0.13, -0.02],
    path: [0, 0, 0.35, -0.09, -0.12, -0.06], compiler: [0, 0, 0.35, -0.23, 0.16, 0], machine: [0, 0, 1.1, 0.03, 0.05, 0],
    copy: [0, 0, 1.65, 0.37, -0.1, 0], turn: [0, 0, 1.15, -0.18, 0.15, 0.04], circuit: [0, 0, 0.5, -0.2, -0.05, 0], steps: [0, 0, 0.5, -0.15, 0.2, 0] },
  stem: { default: [0, 0, 0.1, -0.2, -0.03, 0.06], strand: [0, 0, 0.45, -0.21, -0.09, 0], fold: [0, 0, 0.1, -0.18, -0.06, 0.05],
    break: [0, 0, 0.3, -0.22, -0.14, 0.1], count: [0, 0, 0.1, -0.61, 0.02, -0.13], cloud: [0, 0, 1.75, -0.63, 0.24, -0.11],
    fields: [0, 0, 1.85, -0.29, 0.8, 0], compare: [0, 0, 1.8, -0.46, 0.23, 0] },
};
// how much further back a view stands on a phone held upright (see narrowK): the wide ones, whose parts reach
// across the screen (measured at 390 x 760: the machine's close-ups and the pyramid beside them, the circuit, the tree
// seen across its two branches, the straight strand, the fields)
const NARROW = { letters: { default: 1.1, peel: 1.1 }, tree: { pair: 1.35, gears: 1.06, what: 1.06 },
  rule: { copy: 1.6, turn: 1.18, circuit: 1.1 }, stem: { strand: 1.4, fold: 1.2, fields: 1.12, compare: 1.22 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// on a screen held sideways but too narrow for the side panel (the panel below, the scene in a strip above it, see
// lowK) the tall family tree comes closer and is centred in the strip: [distance factor, the target's shift up]
// (measured at 640 x 400: about as tall as the strip, as the qubits story's map stands there)
const LOW = { tree: { default: [0.72, -0.3], grow: [0.62, 0], crown: [0.72, 0], pair: [0.69, -0.68], gears: [0.67, -0.1] } };
const LOW1 = [1, 0];
const lowOf = (k, name) => (LOW[k] && LOW[k][name]) || LOW1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

// ------------------------------------------------------------------- data --
// The maths (MMATH) on the story's example numbers, and the poster's numbers (MUT_DATA), looked up once for the story
// and the panes. The examples' numbers are computed here, never typed in; the poster's are used only where the text
// says "in the authors' test".
const M = MMATH, D = MUT_DATA, TD = D.test;
const MI = Math.max(0, M.MODELS.findIndex(m => m.key === M.DEFAULT));   // the story's rule (rule_model)
const LET = M.LETTERS, KET = M.KETS;
const f2 = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const pct = v => (Number.isFinite(+v) ? `${Math.round(100 * v)} %` : '–');
const deg = v => `${Math.round(Math.abs(v) * 180 / Math.PI)}°`;   // how far a turn goes (its size, not its direction)
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
const swapsN = n => `${n} swap${n === 1 ? '' : 's'}`;
const brokenN = n => (n ? `${n} broken pair${n === 1 ? '' : 's'}` : 'no broken pair');
// a big count in words: 1,048,576 is 'about a million'
const aboutN = n => { const m = Math.round(n / 1e6); return m === 1 ? 'about a million' : m > 1 ? `about ${word(m)} million` : fmt(n); };
// four chances in words: 'A 71 %, C 5 %, G 19 % and T 6 %'
const chancesText = p => listOf(Array.from(p).map((v, i) => `${LET[i]} ${pct(v)}`));
// how far a mix has come from its pure letter towards the long-run mix (the pyramid is an affine picture of the four
// chances, so the share of the distance is the same there)
const wayOf = (p, pi, s) => {
  let d = 0, d0 = 0;
  for (let i = 0; i < 4; i++) { d += (p[i] - pi[i]) ** 2; d0 += ((i === s ? 1 : 0) - pi[i]) ** 2; }
  return 1 - Math.sqrt(d / (d0 || 1));
};
// the arrows of a letter's two qubits, in words
const codeWords = i => [['up', 'up'], ['up', 'down'], ['down', 'up'], ['down', 'down']][i].map((w, k) => `${k ? 'second' : 'first'} ${w}`).join(', ');

// ------------------------------------------------------------------ facts --
// Numbers the story quotes: the examples' computed here, the authors' test's from MUT_DATA
const FACTS = (() => {
  const sw = k => D.fig1.swaps[k].map(([at, a, b]) => `${a}→${b} at letter ${at}`);
  // the letters' mix (the rule's after point 2, from A) and the story's 24 read-outs (seed 1, as letters_reads)
  const mix = Array.from(M.path(MI, 0, M.POINTS[1])), reads = [0, 0, 0, 0], nReads = 24;
  for (let k = 1; k <= nReads; k++) reads[M.sample(mix, 1, k)]++;
  const pi = Array.from(M.pi(MI)), r = M.MODELS[MI].r, top = pi.indexOf(Math.max(...pi));
  // the family tree (seed 1, the story's speed): its long and short branch
  const tr = M.familyTree(1, 1), L = tr.branches[tr.highlight.long], S = tr.branches[tr.highlight.short];
  // the machine as the story shows it at the end of its turn: parent G after 1 swap per letter
  const par = 2, t = 1, a = M.angles(MI, t), circ = M.circuit(MI, t), simple = circ.gates.filter(g => g.type === 'MRY').flatMap(M.decompose);
  // the count: how many letters the story links at most (ten), and the pairs that hold (each once: A–T, C–G, G–T)
  const TEN = 10, held = D.pairsOk.filter(p => p[0] < p[1]);
  return {
    anc: D.fig1.ancestor, d1: D.fig1.d1, d2: D.fig1.d2, sw1: sw('d1'), sw2: sw('d2'), n: D.fig1.ancestor.length,
    mix, reads, nReads, point: M.POINTS[1],
    pi, top, fast: ((r[1] + r[4]) / 2) / ((r[0] + r[2] + r[3] + r[5]) / 4),   // transitions against the other swaps
    points: M.POINTS, tPath: M.T_PATH, ways: M.POINTS.concat(M.T_PATH).map(x => wayOf(M.path(MI, 0, x), pi, 0)),
    branches: tr.branches.length, tips: tr.nodes.filter(n => n.tip >= 0).length,
    long: { len: L.len, swaps: L.muts.length }, short: { len: S.len, swaps: S.muts.length },
    turn: { t, par, c1: a[par], c0: [a[4 + 2 * par], a[5 + 2 * par]] },
    ry: simple.filter(g => g.type === 'RY').length, cx: simple.filter(g => g.type === 'CNOT').length,
    wires: circ.wires.length, copies: circ.gates.filter(g => g.type === 'CNOT').length, blocks: circ.gates.filter(g => g.type === 'MRY').length,
    perLetter: M.qubits(1), perLink: M.combos(1), held,
    ten: TEN, combos: { pair: M.combos(2), three: M.combos(3), ten: M.combos(TEN) }, qubits10: M.qubits(TEN),
    species: Object.keys(TD.species).length, truthBroken: M.brokenPairs(TD.truth.top, TD.truth.bottom).length,
    authors: D.poster.authors, refs: D.poster.refs,
  };
})();
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on
// a light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
// the poster's letters (the Okabe-Ito palette, as the sets draw them), the machine's blue, time's green
const LCOL = ['#e69f00', '#56b4e9', '#f0e442', '#cc79a7'];
const BLUE = '#4fb0ff', GREEN = '#3fd6a6', CYAN = '#46d9ff', AMBER = '#ffb43b', RED = '#ff5a4b', GREY = '#8e98ab';
// the three ways of rebuilding, as the stem set colours their fields' tags, and as the story names them
const METHOD_COL = { indep: GREY, exact: GREEN, coupled: CYAN };
const METHOD_SAY = { indep: 'Letter by letter', exact: 'The exact pair calculation', coupled: 'With the coupled circuit' };

function buildStory() {
  const F = FACTS;
  // the fields of rebuilt ancestors left to right (the shares in ascending order): the text names them in this order
  const FIELDS = GL.sets.stem.api().methods;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const hide = (k, t0, t1) => ramp(k + '_a', t0, t1, 1, 0);
  // jump an index param (a letter, a method) at time t
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // a big number in a colour of its own (the headset's canvas reads data-col)
  const big = (col, v) => `<b data-col="${col}" style="color:${inkCol(col)}">${v}</b>`;
  // ------------------------------------------------------------ panel copy
  // parts of a chapter that take turns in one place, each fading out (data-out) as the next comes: the headset's
  // panel cannot scroll, so no chapter shows more than fits at once
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const W = word(TD.pairs), A1 = F.authors[0], A2 = F.authors[1];
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--red)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--red)"/><circle cx="352" cy="36" r="4.5" fill="var(--red)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">The mutation machine</h1>
      <p class="lede" data-at="2.4">DNA's changes as a quantum circuit</p>
      ${turns(`<p data-at="4" data-out="12.5">DNA is a text written in ${word(LET.length)} letters: ${listOf([...LET])}.</p>
        <p data-at="6.5" data-out="12.5" class="amber">Every time it is copied, now and then a letter is swapped for another. That is a mutation.</p>`,
      `<p data-at="13">Here an ancestor's ${word(F.n)} letters, ${F.anc}, are copied twice, and ${F.sw1.length === F.sw2.length ? `each copy swaps ${word(F.sw1.length)} of them` : `the first copy swaps ${word(F.sw1.length)} of them and the second ${word(F.sw2.length)}`}.</p>
        <ul class="steps">
          ${step(15, 0, GREEN, `Copy 1 · ${F.d1}`, esc(listOf(F.sw1)))}
          ${step(20.5, 0, GREEN, `Copy 2 · ${F.d2}`, esc(listOf(F.sw2)))}
        </ul>
        <p class="credits" data-at="23">After the poster by Enes Berk Sakalli and Arndt von Haeseler. The numbers drawn are examples, as in the authors' own test.</p>`)}`,
    tree: `<h2 data-at="0.6">A family tree</h2>
      ${turns(`<p data-at="1.2" data-out="23.5">Copied over many generations, one text becomes many: a family tree.</p>
        <p data-at="6" data-out="23.5">Where two branches part lived a shared ancestor.</p>
        <p data-at="11" data-out="23.5" class="amber">Each copy carries the letters up its branch. Where one flashes, a letter was swapped.</p>`,
      `<p data-at="24">A branch's length says how much changed along it: the expected number of swaps per letter, which grows with time.</p>
        <div class="facts"><div data-at="25.5">${big(GREEN, f2(F.long.len))}<small>swaps per letter on a long branch: ${swapsN(F.long.swaps)} here</small></div><div data-at="26.5">${big(GREEN, f2(F.short.len))}<small>on a short one: ${swapsN(F.short.swaps)}</small></div></div>
        <p class="note" data-at="28.5">Chance gives more or fewer swaps; the length is what to expect. Trees like this trace viruses as they spread [1] and how a tumour grew from one cancer cell [6], and the rule of change they assume matters [2].</p>
        <p class="credits" data-at="31">The tree's ${F.branches} branches and their swaps are examples, simulated with the story's rule. Heights are change: each branch rises by its length.</p>`)}`,
    qubits: `<h2 data-at="0.6">Letters as qubits</h2>
      ${turns(`<p data-at="1.2" data-out="18.5">A quantum computer can hold each letter in ${word(F.perLetter)} qubits, drawn as arrows on spheres: up is 0, down is 1.</p>
        <ul class="steps">${[0, 1, 2, 3].map(i => step(6 + 3 * i, 18.5, LCOL[i], `${LET[i]} is ${KET[i]}`, codeWords(i))).join('')}</ul>`,
      `<p data-at="19">Tilt the arrows and the ${word(F.perLetter)} qubits hold a mix of all ${word(LET.length)} letters at once, like a spinning coin.</p>
        <p data-at="24">Reading them out makes the coin land on one letter, each with its own chance.</p>
        <p data-at="28" class="amber">Here the chances are ${chancesText(F.mix)}; ${F.nReads} read-outs gave ${listOf(F.reads.map((n, i) => `${n} ${LET[i]}`))}.</p>
        <p class="note" data-at="31">|01⟩ means first 0, then 1. An arrow shorter than its sphere means the ${word(F.perLetter)} qubits depend on each other. This mix is where the rule of the next chapter takes an A after ${F.point} swaps per letter.</p>`)}`,
    rule: `<h2 data-at="0.6">The rule</h2>
      ${turns(`<p data-at="1.2" data-out="16.5">A substitution model is the rule for how letters change:</p>
        <ul class="steps">
          ${step(3, 16.5, BLUE, 'Thicker arrows', 'how readily one letter swaps for another')}
          ${step(6, 16.5, AMBER, 'Bigger balls', 'how common each letter is in the long run')}
        </ul>
        <p class="note" data-at="10" data-out="16.5">Here A↔G and C↔T swap about ${word(Math.round(F.fast))} times as readily as the other pairs, and ${LET[F.top]} is the most common letter in the long run (${pct(F.pi[F.top])}).</p>`,
      `<p data-at="17">Every mix of the four letters is a point in this pyramid, the pure letters at its corners.</p>
        <p data-at="22" class="amber">Start at A, and as time goes on the rule moves the mix along a path towards the long-run mix.</p>
        <p data-at="28">After ${listOf(F.points.map(String))} swaps per letter it has come ${listOf(F.ways.slice(0, 3).map(pct))} of the way; after ${F.tPath}, ${pct(F.ways[3])}.</p>
        <p class="note" data-at="32">The most general standard rule is GTR, the general time-reversible model. The mix follows p(t) = p(0) e^(Qt), a dynamical system: Q holds the rates. The rates and shares here are examples.</p>`)}`,
    machine: `<h2 data-at="0.6">The machine</h2>
      ${turns(`<p data-at="1.2" data-out="25.5">A compiler turns the rule into a quantum circuit: a machine of gears for one branch.</p>
        <ul class="steps">
          ${step(8, 25.5, CYAN, '1 · Copy', 'the parent\'s letter is stamped onto the child')}
          ${step(13, 25.5, GREEN, '2 · Turn', 'the child\'s qubits turn: the longer the branch, the further, and the child\'s mix lands where the rule\'s path is at that time')}
          ${step(20, 25.5, BLUE, '3 · The circuit', `${word(F.wires)} wires, the parent's ${word(F.perLetter)} qubits and the child's, with ${word(F.copies)} copy gates and ${word(F.blocks)} turn blocks`)}
        </ul>`,
      `<p data-at="26.5">One machine per branch, joined into the tree.</p>
        <p data-at="34" class="amber">Read at the tips, it writes new sequences that follow the rule.</p>
        <p class="note" data-at="36">The copy is ${word(F.copies)} CNOT gates. The turn is a few rotations of single qubits plus steps that link two qubits, so it depends on the parent's letter: for a ${LET[F.turn.par]} after ${F.turn.t} swap per letter, c1, the child's first qubit, turns ${deg(F.turn.c1)} and c0, its second, ${deg(F.turn.c0[0])} or ${deg(F.turn.c0[1])}. How far each step turns depends only on the branch length; the steps are the same on every branch: ${F.ry} turns of one qubit and ${F.cx} links.</p>`)}`,
    pairs: `<h2 data-at="0.6">Letters that work together</h2>
      ${turns(`<p data-at="1.2" data-out="27.5">Letters often act together.</p>
        <p data-at="4" data-out="27.5">An RNA strand folds back on itself into a stem, held by pairs: ${F.held.map(p => `${p[0]} with ${p[1]}`).join(', ')}.</p>
        <p data-at="14" data-out="27.5" class="amber">If one letter changes alone, its pair breaks.</p>
        <p data-at="21" data-out="27.5">Coupling lets the two letters of a pair change together, so the pair holds.</p>`,
      `<p data-at="28">Models of pairs exist, but each linked letter multiplies the combinations by ${word(F.perLink)}.</p>
        <div class="facts"><div data-at="29">${big(CYAN, fmt(F.combos.pair))}<small>combinations for a pair</small></div><div data-at="33">${big(AMBER, fmt(F.combos.ten))}<small>for ${word(F.ten)} letters: ${aboutN(F.combos.ten)}</small></div><div data-at="35">${big(GREEN, F.qubits10)}<small>qubits for ${word(F.ten)}: ${word(F.perLetter)} per letter</small></div></div>
        <p class="note" data-at="36">T stands for RNA's U here, as on the poster. On every branch the coupling acts on both letters of a pair beside the turn: changes that keep a pair are more likely (${word(TD.w)} times, in the authors' example), and both letters may change at once [3].</p>`)}`,
    rebuild: `<h2 data-at="0.6">Rebuilding the ancestor</h2>
      ${turns(`<p data-at="1.2" data-out="26.5">${cap(word(F.species))} species carry the same stem, each changed in its own way.</p>
        <p data-at="7" data-out="26.5" class="amber">What did their shared ancestor have?</p>
        <p data-at="14" data-out="26.5">Rebuild it ${fmt(TD.n)} times with each method, and count the ancestors whose ${W} pairs all hold:</p>
        <ul class="steps">${FIELDS.map((m, i) => step(18 + 3 * i, 26.5, METHOD_COL[m], METHOD_SAY[m], `${pct(TD.intact[m])}${i ? '' : ' of them'}`)).join('')}</ul>`,
      `<p data-at="27" class="amber">So the coupling favours pairs too strongly: its ancestors look believable, but its percentages are not true chances.</p>
        <p data-at="31">And a broken pair is normal: the true ancestor here has ${word(F.truthBroken)}, and only ${esc(TD.allSixPrior)} of ancestors have all ${W} pairs matched.</p>
        <p data-at="35">One rebuilt ancestor of each method stands before its field; white frames mark letters that differ from the true one.</p>
        <p class="note" data-at="38">In the authors' test: a made-up stem of ${W} pairs in ${word(F.species)} species, ${fmt(TD.n)} rebuilt ancestors per method, matching pairs ${word(TD.w)} times as likely as mismatched ones. The shares are theirs; which stems are intact is drawn for the picture.</p>`)}`,
    what: `<h2 data-at="0.6">What it is for</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Rebuilding ancestors is how researchers brought back old virus proteins for vaccine research [4, 5] and trace how a tumour grew from one cancer cell [6].</p>
        <p data-at="6" data-out="13.5" class="amber">This circuit turns a rule of letter change into a machine a quantum computer can run, and couples letters that change together.</p>
        <p class="note" data-at="9" data-out="13.5">For now it handles one letter or one pair at a time, on simulated data. For real results the numbers would be estimated from real sequences.</p>`,
      `<p data-at="14">After the poster by ${esc(A1.name)} (${esc(A1.inst)}) and ${esc(A2.name)} (${esc(A2.inst)}).</p>
        <p data-at="16"><button class="btn primary" id="btnGoExplore" type="button">Explore the machine</button></p>
        <p class="credits" data-at="17">${F.refs.map((r, i) => `[${i + 1}] ${esc(r)}.`).join(' ')}</p>
        <p class="credits" data-at="18">The numbers drawn are examples, computed here; numbers said to be from the authors' test are theirs.</p>`)}`,
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
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name), lowOf(k, name)]);
  };
  start({ letters_helix: 1, letters_peel: 0, letters_copy1: 0, letters_mut1: 0, letters_copy2: 0, letters_mut2: 0, letters_open: 0, letters_code: 0,
    letters_mix: 0, letters_target: 0, letters_time: M.POINTS[1], letters_reads: 0, letters_seed: 1,
    tree_species: 0, tree_grow: 0, tree_seq: 1, tree_hi: 0, tree_gears: 0, tree_flow: 0, tree_q: 0, tree_seed: 1, tree_speed: 1, tree_pick: -1,
    rule_balls: 0, rule_flow: 1, rule_pyr: 0, rule_path: 0, rule_time: 0, rule_model: MI, rule_start: 0, rule_compile: 0, rule_machine: 0,
    rule_parent: F.turn.par, rule_copy: 0, rule_circuit: 0, rule_simple: 0, rule_run: 1,
    stem_strand: 0, stem_fold: 0, stem_break: 0, stem_couple: 0, stem_both: 0, stem_count: 0, stem_qubits: 0, stem_species: 0, stem_fields: 0,
    stem_named: 0, stem_sort: 0, stem_truth: 0, stem_examples: 0, stem_src: 0, stem_w: TD.w, stem_seed: 1, stem_method: -1 });
  let a, b;
  // A text in four letters: the helix turning, its top strand peeling into the ancestor's row, two copies with swaps
  a = C.title.a; b = C.title.b;
  show('letters', 0.2, 2, b - 1, b + 1);
  ramp('letters_peel', a + 6, a + 11, 0, 1);
  ramp('letters_helix', a + 11, a + 14, 1, 0);
  ramp('letters_copy1', a + 13, a + 15, 0, 1);
  ramp('letters_mut1', a + 15, a + 18, 0, 1);
  ramp('letters_copy2', a + 18.5, a + 20.5, 0, 1);
  ramp('letters_mut2', a + 20.5, a + 23.5, 0, 1);
  cam(a, 'letters', 'default', -8);
  cam(a + 5.5, 'letters', 'default', 2, 'spin');
  cam(a + 10, 'letters', 'peel', 0);
  cam(a + 14, 'letters', 'rows', -6);
  cam(b - 0.5, 'letters', 'rows', 6, 'spin');
  // A family tree: it grows from its root, the letters riding up, mutations flashing; a long and a short branch
  a = C.tree.a; b = C.tree.b;
  show('tree', a, a + 2, b - 2, b);
  ramp('tree_grow', a + 4, a + 24, 0, 1);
  ramp('tree_hi', a + 24, a + 27, 0, 1);
  ramp('tree_hi', b - 3, b - 1, 1, 0);
  ST.stand.push([a + 1, a + 4, b - 2.5, b]);   // (in a headset: once the letters have gone, until the qubits come)
  cam(a + 1.5, 'tree', 'grow', -10);
  cam(a + 22, 'tree', 'grow', 30, 'spin');
  cam(a + 25, 'tree', 'pair', -4);
  cam(b - 0.5, 'tree', 'pair', 6, 'spin');
  // Letters as qubits: the ancestor's first tile opens into two qubits, the four codes, the tilt into a mix, read-outs
  a = C.qubits.a; b = C.qubits.b;
  show('letters', a, a + 2, b - 1, b + 1);
  ramp('letters_open', a + 2, a + 6, 0, 1);
  [1, 2, 3].forEach(i => jump('letters_code', a + 6 + 3 * i, i - 1, i));
  jump('letters_code', a + 18, 3, 0);
  ramp('letters_mix', a + 19, a + 22, 0, 1);
  ramp('letters_reads', a + 24, a + 28, 0, 4);
  ramp('letters_reads', a + 28, a + 34, 4, F.nReads);
  cam(a + 0.5, 'letters', 'rows', -4);
  cam(a + 3.5, 'letters', 'qubits', -6);
  cam(a + 23, 'letters', 'qubits', 6, 'spin');
  cam(a + 25.5, 'letters', 'reads', -3);
  cam(b - 0.5, 'letters', 'reads', 4, 'spin');
  // The rule: balls and arrows, the pyramid of mixes, the path from A towards the long-run mix
  a = C.rule.a; b = C.rule.b;
  show('rule', a, a + 2);
  ramp('rule_balls', a + 1, a + 6, 0, 1);
  ramp('rule_pyr', a + 16, a + 21, 0, 1);
  ramp('rule_path', a + 22, a + 24, 0, 1);
  ramp('rule_time', a + 24, a + 35, 0, M.T_PATH);
  cam(a + 1, 'rule', 'rates', -8);
  cam(a + 15, 'rule', 'rates', 10, 'spin');
  cam(a + 18, 'rule', 'pyramid', -4);
  cam(a + 23, 'rule', 'path', -6);
  cam(b - 0.5, 'rule', 'path', 10, 'spin');
  // The machine: the compiler, the copy, the turn, the circuit; then one machine per branch of the family tree
  a = C.machine.a; b = C.machine.b;
  ramp('rule_time', a, a + 2, M.T_PATH, 0);
  ramp('rule_compile', a, a + 4, 0, 1);
  ramp('rule_machine', a + 4, a + 8, 0, 1);
  ramp('rule_copy', a + 8, a + 13, 0, 1);
  ramp('rule_time', a + 13, a + 20, 0, F.turn.t);
  ramp('rule_circuit', a + 20, a + 23, 0, 1);
  hide('rule', a + 25.5, a + 27.5);
  show('tree', a + 26.5, a + 29, b - 2, b);
  ramp('tree_gears', a + 29, a + 32, 0, 1);
  ramp('tree_flow', a + 34, a + 36, 0, 1);
  ramp('tree_flow', b - 3, b - 1, 1, 0);
  ST.stand.push([a + 27.5, a + 30.5, b - 2.5, b]);   // (in a headset: once the circuit has gone, until the stem comes)
  cam(a + 1.5, 'rule', 'compiler', -4);
  cam(a + 5.5, 'rule', 'machine', 0);
  cam(a + 8.5, 'rule', 'copy', -2);
  cam(a + 13, 'rule', 'copy', 2, 'spin');
  cam(a + 14.5, 'rule', 'turn', -4);
  cam(a + 20, 'rule', 'turn', 4, 'spin');
  cam(a + 21.5, 'rule', 'circuit', -2);
  cam(a + 25, 'rule', 'circuit', 3, 'spin');
  cam(a + 28, 'tree', 'gears', -10);
  cam(b - 0.5, 'tree', 'gears', 14, 'spin');
  // Letters that work together: the strand folds into a stem, a pair breaks, the coupling keeps one, the count
  a = C.pairs.a; b = C.pairs.b;
  show('stem', a, a + 2, b - 2, b);
  ramp('stem_strand', a + 1, a + 5, 0, 1);
  ramp('stem_fold', a + 6, a + 12, 0, 1);
  ramp('stem_break', a + 14, a + 17, 0, 1);
  ramp('stem_break', a + 20, a + 21, 1, 0);
  ramp('stem_couple', a + 21, a + 23, 0, 1);
  ramp('stem_both', a + 24, a + 26, 0, 1);
  ramp('stem_count', a + 28, a + 30, 0, 1);
  ramp('stem_count', a + 31, a + 32.5, 1, 2);
  ramp('stem_count', a + 33, a + 35, 2, 3);
  ramp('stem_qubits', a + 34, a + 36, 0, 1);
  cam(a + 1.5, 'stem', 'strand', 20);
  cam(a + 6.5, 'stem', 'fold', 6);
  cam(a + 13, 'stem', 'fold', -4, 'spin');
  cam(a + 15, 'stem', 'break', -6);
  cam(a + 27, 'stem', 'break', 8, 'spin');
  cam(a + 29, 'stem', 'count', 0);
  cam(a + 32.5, 'stem', 'count', 4, 'spin');
  cam(a + 34.5, 'stem', 'cloud', 0);
  cam(b - 0.5, 'stem', 'cloud', 4, 'spin');
  // Rebuilding the ancestor: the species tree and its stems, the "?", three fields of rebuilt ancestors, their
  // shares, the true ancestor and one rebuilt example per method (the close-up's params jump while the stem set is out)
  a = C.rebuild.a; b = C.rebuild.b;
  jump('tree_species', a - 1, 0, 1); jump('tree_grow', a - 1, 1, 0); jump('tree_gears', a - 1, 1, 0);
  jump('stem_strand', a + 0.5, 1, 0); jump('stem_count', a + 0.5, 3, 0); jump('stem_qubits', a + 0.5, 1, 0);
  show('tree', a, a + 3);
  ramp('tree_grow', a, a + 6, 0, 1);
  ramp('tree_q', a + 1, a + 4, 0, 1);
  ramp('tree_gears', a + 3, a + 6, 0, 1);
  show('stem', a + 3, a + 5);
  ramp('stem_species', a + 6, a + 11, 0, 1);
  ramp('stem_fields', a + 14, a + 24, 0, 1);
  // each field lit, and its tag shown, as the text names it (its step's data-at), left to right
  FIELDS.forEach((m, i) => {
    jump('stem_method', a + 18 + 3 * i, i ? M.METHODS.indexOf(FIELDS[i - 1]) : -1, M.METHODS.indexOf(m));
    ramp('stem_named', a + 18 + 3 * i, a + 18.6 + 3 * i, i, i + 1);
  });
  jump('stem_method', a + 27, M.METHODS.indexOf(FIELDS[FIELDS.length - 1]), -1);
  ramp('stem_sort', a + 25, a + 28, 0, 1);
  ramp('tree_q', a + 30, a + 33, 1, 0);
  ramp('stem_truth', a + 31, a + 34, 0, 1);
  ramp('stem_examples', a + 35, a + 39, 0, 1);
  cam(a + 1.5, 'tree', 'species', -8);
  cam(a + 12, 'tree', 'species', 6, 'spin');
  cam(a + 15, 'stem', 'fields', -4);
  cam(a + 29, 'stem', 'fields', 4, 'spin');
  cam(a + 32, 'stem', 'compare', -3);
  cam(b - 0.5, 'stem', 'compare', 4, 'spin');
  // What it is for: the species tree, its machines running, the species' stems
  a = C.what.a; b = C.what.b;
  for (const n of ['stem_fields', 'stem_examples', 'stem_truth']) ramp(n, a, a + 2, 1, 0);
  ramp('tree_flow', a + 2, a + 6, 0, 1);
  cam(a + 2, 'tree', 'what', -6);
  cam(b - 0.5, 'tree', 'what', 16, 'spin');
  // ---- sound effects (sfxCue: story time, a sound, where it comes from, its options; sfxHold: a continuous sound),
  // beside the keys above: a cue just before the line it goes with, textures under the voice soft; sequences from the
  // keys (when a ramp reaches a share)
  const rampAt = (t0, t1, f) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (smooth(m) < f) lo = m; else hi = m; } return t0 + (t1 - t0) * lo; };
  a = C.title.a;
  sfxCue(a + 0.3, 'rise', 'letters', 'helix', { gain: 0.5 });                        // the helix
  sfxCue(a + 6, 'whoosh', 'letters', 'ancestor', { dur: 5, pitch: 1.1 });            // the strand peels into the ancestor's row
  sfxCue(a + 12.8, 'patter', 'letters', 'copy1', { dur: 2, gain: 0.4 });             // copy one
  sfxCue(a + 15.2, 'pick', 'letters', 'swap1', { pitch: 1.5 });                      // a swap
  sfxCue(a + 18.4, 'patter', 'letters', 'copy2', { dur: 2, gain: 0.4 });             // copy two
  sfxCue(a + 20.7, 'pick', 'letters', 'swap2', { pitch: 1.5 });                      // a swap
  a = C.tree.a;
  sfxCue(a + 4, 'grow', 'tree', 'root', { dur: 18, pitch: 0.9, gain: 0.35 });        // the family tree grows
  sfxCue(a + 23.8, 'ping', 'tree', 'long');                                          // a long and a short branch
  a = C.qubits.a;
  sfxCue(a + 2, 'whoosh', 'letters', 'tile', { dur: 1.5 });                          // a tile opens into two qubits
  for (let i = 0; i < 4; i++) sfxCue(a + 5.8 + 3 * i, 'step', 'letters', 'qubit1', { pitch: Math.pow(2, 2 * i / 12), seq: true });   // the four codes
  sfxCue(a + 18.8, 'whoosh', 'letters', 'qubit2', { pitch: 1.3 });                   // the tilt into a mix
  for (let k = 1; k <= 4; k++) sfxCue(rampAt(a + 24, a + 28, k / 4), 'step', 'letters', 'piles', { pitch: 1.2, gain: 0.5, seq: true });   // the first read-outs, one by one
  sfxCue(a + 28.3, 'patter', 'letters', 'piles', { dur: 5.7, gain: 0.3 });           // then many pile up
  a = C.rule.a;
  sfxCue(a + 1, 'grow', 'rule', 'pyramid', { dur: 5 });                              // balls and arrows
  sfxCue(a + 16, 'rise', 'rule', 'pyramid', { dur: 5 });                             // the pyramid of mixes
  sfxCue(a + 21.8, 'pick', 'rule', 'ballA');                                         // the path starts at A
  sfxCue(a + 35, 'ping', 'rule', 'mix');                                             // it nears the long-run mix
  a = C.machine.a;
  sfxCue(a + 0.3, 'ratchet', 'rule', 'compiler', { n: 8, dur: 4 });                  // the compiler
  sfxCue(a + 4, 'rise', 'rule', 'machine', { dur: 4 });                              // the machine
  sfxCue(a + 7.8, 'whoosh', 'rule', 'copyGates');                                    // the copy
  sfxHold(a + 13, a + 20, 'machine', 'rule', 'turn1', { pitch: 1.2, gain: 0.3 });    // the turn
  sfxCue(a + 19.8, 'link', 'rule', 'circuit');                                       // the circuit
  sfxCue(a + 29, 'ratchet', 'tree', 'crown', { n: 14, dur: 3 });                     // a machine on every branch
  sfxCue(a + 33.8, 'patter', 'tree', 'tips', { dur: 2, pitch: 1.3, gain: 0.3 });     // read at the tips
  a = C.pairs.a;
  sfxCue(a + 6, 'whoosh', 'stem', 'stem', { dur: 6, pitch: 0.8 });                   // the strand folds into a stem
  sfxCue(a + 13.8, 'snap', 'stem', 'brk');                                           // a pair breaks
  sfxCue(a + 20.8, 'link', 'stem', 'gear');                                          // the coupling keeps one
  [28, 31, 33].forEach((s, i) => sfxCue(a + s, 'step', 'stem', 'square', { pitch: Math.pow(2, 3 * i / 12), seq: true }));   // the count of combinations
  a = C.rebuild.a;
  sfxCue(a + 0.3, 'grow', 'tree', 'n1', { dur: 6 });                                 // the species tree
  sfxCue(a + 14, 'patter', 'stem', 'cloud', { dur: 10, gain: 0.3 });                 // fields of rebuilt ancestors
  FIELDS.forEach((m, i) => sfxCue(a + 17.8 + 3 * i, 'step', 'stem', 'field_' + m, { pitch: Math.pow(2, 2 * i / 12) }));   // each field lit
  sfxCue(a + 30.8, 'ping', 'stem', 'truth');                                         // the true ancestor
  a = C.what.a;
  sfxCue(a + 2, 'ratchet', 'tree', 'crown', { n: 10, dur: 4, gain: 0.25 });          // the machines running
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  a = C.machine.a;
  label('tree', 'tip2', '<b>New sequences</b> · read at the tips', a + 35, C.machine.b - 2, 'cyn');
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor, FIT's target shift, LOW]; 'spin' segments turn at
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, w[10], w[11]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (the tree and the stem share one turn: one frame)
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
// the story's view at time t: [az, el, dist, tx, ty, tz, narrow factor, FIT's target shift x, y, z, and LOW's two]
// (in a headset the family tree stands tall while it is the scene, see standView)
const storyCam = t => (XR.on ? standView(storyView(t), standW(t)) : storyView(t));
function storyView(t) {
  const wp = ST.wp, end = w => [w[1], w[2], w[3], w[4], w[5], w[6], w[8], ...w[9], ...w[10]];
  if (t <= wp[0][0]) return end(wp[0]);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1, f = p[9], g = q[9], l = p[10], m = q[10];
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[8] + (q[8] - p[8]) * x,
        f[0] + (g[0] - f[0]) * x, f[1] + (g[1] - f[1]) * x, f[2] + (g[2] - f[2]) * x, l[0] + (m[0] - l[0]) * x, l[1] + (m[1] - l[1]) * x];
    }
  }
  return end(wp[wp.length - 1]);
}

// In a headset the family tree stands tall in front of you while it is the scene (chapter 2, and the machines of
// chapter 5): the story's view eases into the tree set's `stand` (about 1.5 m tall, its root low, its crown above your
// eyes), keeping the story's turn; the species tree of chapters 7 and 8 stays at table size. Its axis stands STAND_BACK
// (in the set's units) further off than the view's target, so that nothing of it, the level ring and the rows of
// letters riding up included, comes within 0.35 m of your eyes (measured with the story's turns: 0.44 m at the
// closest). The weight follows the story's time alone, so at a shared-room station everyone sees the same size. On a
// screen nothing changes.
const STAND_BACK = 0.2;
// ST.stand: [t0, t1, t2, t3], in over t0..t1 and out over t2..t3 (story time)
const standW = t => ST.stand.reduce((w, [t0, t1, t2, t3]) => Math.max(w, Math.min(smooth((t - t0) / (t1 - t0)), smooth((t3 - t) / (t3 - t2)))), 0);
function standView(v, w) {
  if (w <= 0) return v;
  const s = view('tree', 'stand'), A = v[0] * D2R;
  s[3] += STAND_BACK * Math.sin(A); s[5] += STAND_BACK * Math.cos(A);   // (towards you: the target nearer, the axis further)
  v[1] += (s[1] - v[1]) * w;
  v[2] = Math.exp(Math.log(v[2]) + (Math.log(s[2]) - Math.log(v[2])) * w);
  for (let i = 3; i < 6; i++) v[i] += (s[i] - v[i]) * w;
  return v;
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
    // (a label's text may be a function: it follows what the set shows, see labelText)
    const fn = typeof L.text === 'function' ? L.text : null, [b, r] = fn ? fn() : L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1,
      fn, tx: fn ? b + '|' + r : '', none: !b && !r });
  }
}
// a label whose text is a function (a pile's count, a branch's length, a field's share, a turn's angle) is read again
// while it shows and redrawn when it changes: the HTML label, and the headset's sprite (dropped, so it is made again)
function labelText(L) {
  if (!L.fn) return;
  const [b, r] = L.fn(), s = b + '|' + r;
  if (s === L.tx) return;
  L.tx = s; L.none = !b && !r;
  L.el.innerHTML = `<b>${esc(b)}</b>${sfxSpan(r)}`;
  L.w = 0; L.nar = undefined; dropSprite(L);
}
// a set label shows as far as its set is in and its own rule allows
// (labels a set marks as minor give way on narrow screens)
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  const v = (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
  if (v > 0) labelText(L);
  return L.none ? 0 : v;
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
// Explore mode: a letter or a mix in two qubits and its read-outs (Letters), the rule, its path and the machine for
// one branch (Rule), the family tree and its machines (Tree), the stem rebuilt three ways (Stem); or any scene with its
// own controls (Scenes).
const SCENES = [
  ['letters', 'Letters', 'DNA\'s double helix, the ancestor\'s eight letters and two copies with swaps; then one letter in two qubits, its four codes, a mix of all four and its read-outs piling up.'],
  ['tree', 'Tree', 'A family tree in 3D, every swap simulated with the story\'s example rule; one machine per branch; and the species tree of the authors\' test.'],
  ['rule', 'Rule and machine', 'A rule of change as balls and arrows, the pyramid of mixes and the path through it; the machine for one branch (the copy and the turn) and its circuit.'],
  ['stem', 'Stem', 'An RNA stem: a pair breaking, the coupling that keeps it, the combinations a model of pairs must track; the ancestor of three species rebuilt three ways.'],
];
const SCENE_SHORT = { rule: 'Rule' };
const TABS = [['letters', 'Letters'], ['rule', 'Rule'], ['tree', 'Tree'], ['stem', 'Stem'], ['scenes', 'Scenes']];
// the branch length (time) and the pair favour (w) are sliders the panes hold themselves (X.time, X.w): the sets'
// controls of those names only say when one applies
const isNum = c => c.key === 'time' || c.key === 'w';
const ctlsOf = k => (GL.sets[k].controls || []).filter(c => !isNum(c));
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries((GL.sets[k].controls || []).map(x => [x.key, isNum(x) ? numOf(x.key) : ctlValue(k, x)])));
// whether a scene's slider applies now
const numShown = (k, key) => { const c = (GL.sets[k].controls || []).find(x => x.key === key); return !!c && ctlShown(k, c) && (key !== 'w' || stemLive()); };   // (w only for the example computed live)
const numOf = key => (key === 'w' ? X.w : X.time);
// (explore opens on the rule's machine; each scene starts on the story's own choices)
const X = { tab: 'rule', scene: 'rule', t0: 0, turn: 'on',
  ctl: { letters: { view: 'qubits', mix: 'rule' }, rule: { view: 'path', model: M.DEFAULT, start: 'A', parent: 'G' }, tree: { view: 'tree', seed: '1', speed: '1', run: 'off' },
    stem: { view: 'rebuild', src: 'test', method: 'all' } },
  time: 1, reads: 0, rseed: 1, branch: -1, w: TD.w, sseed: 1 };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['letters_code', 'letters_target', 'letters_seed', 'rule_model', 'rule_start', 'rule_parent', 'tree_seed', 'tree_speed', 'tree_pick',
  'stem_src', 'stem_w', 'stem_seed', 'stem_method']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a view option's camera: the one it stands for, or the cam view of the same name
const CAM_ALIAS = { letters: { copies: 'rows', qubits: 'reads' }, rule: { rule: 'rates' }, tree: { tree: 'default', machines: 'gears' },
  stem: { stem: 'default', count: 'cloud', rebuild: 'fields' } };
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [al[v], v]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, 'view'); return !!c && ctlValue(k, c) === v; };
// what the sets know (their api()): the letters' chances, the rule's angles, the tree's branches and picking, the
// stem's rebuilds and picking
const API = {};
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
// work for the next frame, once the sets have drawn what was just picked
const NEXT = [];
// what the panes choose, by name
const letMix = () => ctlValue('letters', ctlOf('letters', 'mix'));
const ruleModel = () => Math.max(0, M.MODELS.findIndex(m => m.key === ctlValue('rule', ctlOf('rule', 'model'))));
const letterOf = key => Math.max(0, LET.indexOf(ctlValue('rule', ctlOf('rule', key))));
const ruleView = () => ctlValue('rule', ctlOf('rule', 'view'));
const machineOn = () => ['machine', 'circuit', 'steps'].includes(ruleView());
const treeView = () => ctlValue('tree', ctlOf('tree', 'view'));
const treeSeed = () => Math.max(1, parseInt(ctlValue('tree', ctlOf('tree', 'seed')), 10) || 1);
// the family tree chosen (the tree set draws the same: MMATH.familyTree by seed and speed), kept for the panes
const TREES = new Map();
function treeNow() {
  const sp = (api('tree').speeds || [0.5, 1, 2, 4])[clamp(parseInt(ctlValue('tree', ctlOf('tree', 'speed')), 10) || 0, 0, 3)], k = treeSeed() + '|' + sp;
  if (!TREES.has(k)) { if (TREES.size > 7) TREES.delete(TREES.keys().next().value); TREES.set(k, M.familyTree(treeSeed(), sp)); }
  return TREES.get(k);
}
const stemView = () => ctlValue('stem', ctlOf('stem', 'view'));
const stemLive = () => ctlValue('stem', ctlOf('stem', 'src')) === 'live';
const stemMethod = () => ctlValue('stem', ctlOf('stem', 'method'));
const READ_MAX = () => api('letters').READ_MAX || 400;
// the four chances of the letter or mix chosen, and how a read-out of it comes out (MMATH.sample by index, 1-based,
// as the letters set draws them)
const letChances = () => (api('letters').chances ? api('letters').chances(letMix(), X.time) : [1, 0, 0, 0]);
function readCounts(n = X.reads) {
  const p = letChances(), c = [0, 0, 0, 0];
  for (let k = 1; k <= n; k++) c[M.sample(p, X.rseed, k)]++;
  return c;
}

// the controls a set's explore() reads: its own, with the panes' numbers (the branch length, the pair favour, the
// read-outs and their seed)
function ctlArgs(k, now) {
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of GL.sets[k].controls || []) c[ct.key] = isNum(ct) ? numOf(ct.key) : ctlValue(k, ct);
  if (k === 'letters') { c.reads = X.reads; c.seed = X.rseed; }
  return c;
}
// what the chosen scene and its controls ask for: that set fully in, every other set out; then what the panes pick
// (the branch picked, the rebuild's seed); the species tree shows its stems, and the rebuilt fields stand under it
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = ctlArgs(k, now);
  if (s.explore) Object.assign(tg, s.explore(c));
  if (k === 'tree') {
    if (c.view !== 'species') tg.tree_pick = X.branch;
    else Object.assign(tg, { stem_a: 1, stem_strand: 0, stem_count: 0, stem_qubits: 0, stem_species: 1, stem_fields: 0, stem_sort: 0, stem_truth: 0, stem_examples: 0 });
  }
  if (k === 'stem') {
    tg.stem_seed = X.sseed;
    if (c.view === 'rebuild' || c.view === 'compare') {
      Object.assign(tg, GL.sets.tree.params, { tree_a: 1, tree_species: 1, tree_grow: 1, tree_seq: 1, tree_hi: 0, tree_gears: 1, tree_flow: 0,
        tree_q: c.view === 'rebuild' ? 1 : 0, tree_pick: -1 });
    }
  }
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) {
    // read-outs play one by one (about one a second), many at once quickly; fewer (cleared, a new mix) at once
    if (n === 'letters_reads') { const g = tg[n], v = XS[n]; XS[n] = g <= v ? g : Math.min(g, v + dt * Math.max(0.9, (g - v) * 2.5)); continue; }
    XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  }
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets)
function pushState() { updateExtraLabels(); }
function openScene(k, fly = true) {
  if (!GL.sets[k] || !SCENES.some(s => s[0] === k)) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (fly && !same) { flyTo(view(k, viewCam(k) || 'default')); sfxAct('whoosh', k, null, { dur: 0.8 }); }   // (sound effects: another scene)
  renderAll();
}
function setCtl(k, key, v) {
  const c = ctlOf(k, key);
  if (!c || !c.options.some(o => o[0] === v)) return;
  if (ctlValue(k, c) !== v) ctlSound(k, key, v);
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  // a view has its own best camera
  if (key === 'view' && k === X.scene) { const n = camFor(k, v); flyTo(view(k, n || 'default')); }
  renderAll();
}
// (sound effects: a control changed: another rule or tree grows, the machines start, a field or a letter is picked)
function ctlSound(k, key, v) {
  const o = key === 'view' ? ['whoosh', k, null, { dur: 0.7, pitch: 1.1 }] : key === 'model' ? ['grow', k, 'pyramid', { dur: 1.5 }]
    : key === 'seed' ? ['grow', k, 'root', { dur: 1.5, pitch: 0.9 }] : key === 'run' ? (v === 'on' ? ['ratchet', k, 'crown', { n: 6, dur: 1.5 }] : null)
    : key === 'method' ? ['pick', k, v !== 'all' ? 'field_' + v : 'cloud'] : key === 'start' || key === 'parent' || key === 'mix' ? ['pick', k, null, { pitch: 1.3 }] : ['step', k, null];
  if (o) sfxAct(...o);
}
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, 'view', v); }
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
// the branch length (0 to 2 swaps per letter, to the hundredth): the rule's path and machine, the letters' rule mix
function setTime(v, ui = true) {
  const t = clamp(Math.round(+v * 100) / 100, 0, 2);
  if (!Number.isFinite(t) || t === X.time) return;
  if (Math.floor(t * 4) !== Math.floor(X.time * 4)) sfxAct('step', X.scene, null, { pitch: Math.pow(2, t / 2) });   // (sound effects: each quarter crossed)
  X.time = t;
  if (ui && letMix() === 'rule') X.reads = 0;   // (another mix: its read-outs start again)
  syncNums();
}
// the pair favour w (1 to 30): how much more likely a matching pair is, in the example computed live
function setW(v, ui = true) {
  const w = clamp(Math.round(+v) || 1, 1, 30);
  if (w === X.w) return;
  sfxAct('step', 'stem', 'gear', { pitch: Math.pow(2, Math.log(w) / Math.log(30)) });   // (sound effects: the pair favour, higher the stronger)
  X.w = w;
  if (ui && !stemLive()) { (X.ctl.stem = X.ctl.stem || {}).src = 'live'; renderAll(); return; }   // (the authors' test is w = 8)
  syncNums();
}
// a letter or a mix in the two qubits, from the Letters tab: its read-outs start again
function setMix(v) {
  if (!ctlOf('letters', 'mix').options.some(o => o[0] === v)) return;
  if (!(X.scene === 'letters' && viewIs('letters', 'qubits'))) showView('letters', 'qubits');
  if (v !== letMix()) X.reads = 0;
  setCtl('letters', 'mix', v);
}
// read out n more (up to the piles' most), or clear them (0); read again: a new seed, the piles cleared
function readOut(n, ui = true) {
  const r0 = X.reads;
  X.reads = n > 0 ? clamp(X.reads + n, 0, READ_MAX()) : 0;
  if (X.reads > r0) sfxAct(...(X.reads - r0 > 1 ? ['patter', 'letters', 'piles', { dur: 1.5 }] : ['step', 'letters', 'piles', { pitch: 1.2 }]));   // (sound effects: one read-out, or many)
  if (ui && !(X.scene === 'letters' && viewIs('letters', 'qubits'))) showView('letters', 'qubits');
  renderAll();
}
function readAgain() { X.rseed = X.rseed % 999 + 1; X.reads = 0; renderAll(); }
// a branch of the family tree (-1 none): lit, its rise measured, its machine lit
function selectBranch(b, ui = true) {
  const n = treeNow().branches.length;
  const was = X.branch;
  X.branch = Number.isInteger(b) && b >= 0 && b < n ? b : -1;
  if (X.branch >= 0 && X.branch !== was) sfxAct('pick', 'tree', 'crown');   // (sound effects: a branch picked)
  if (ui && X.branch >= 0 && !(X.scene === 'tree' && treeView() !== 'species')) { if (X.scene !== 'tree') openScene('tree'); if (treeView() === 'species') setCtl('tree', 'view', 'tree'); }
  renderAll();
}
// a new family tree: the next of the five
function nextTree() { const o = ctlOf('tree', 'seed').options, i = o.findIndex(x => x[0] === ctlValue('tree', ctlOf('tree', 'seed'))); X.branch = -1; sceneCtl('tree', 'seed', o[(i + 1) % o.length][0]); }
// rebuild again: another 2,000 ancestors per method (this example, live)
function rebuildAgain() { sfxAct('patter', 'stem', 'cloud', { dur: 1.5 }); X.sseed = X.sseed % 999 + 1; if (!stemLive()) (X.ctl.stem = X.ctl.stem || {}).src = 'live'; if (X.scene !== 'stem') openScene('stem'); renderAll(); }
// a control of a scene picked from a tab: its scene brought up (a new tree drops the branch picked)
function sceneCtl(k, key, v) {
  if (X.scene !== k) openScene(k);
  if (k === 'tree' && (key === 'seed' || key === 'speed') && ctlValue(k, ctlOf(k, key)) !== v) X.branch = -1;
  if (k === 'letters' && key === 'mix' && letMix() !== v) X.reads = 0;
  setCtl(k, key, v);
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every scene's controls (the letter or
// mix, the rule, its start and parent letters, the tree and how fast its letters change, the source and the method
// among them), the branch length, the read-outs and their seed, the branch picked, the pair favour and the rebuild's
// seed. The camera is each person's own, and so is how far the read-outs have played.
// shared rooms: the scene's view in a headset at a station (explore mode), which turns and sizes it in the room:
// shared (HOST.collab), so everyone there sees it alike; null while it flies somewhere (a pick, a view arriving)
function collabView() {
  if (APP.mode !== 'explore' || orbit.to) return null;
  const c = orbit.cur, r = (x, k) => Math.round(x * k) / k;
  return [r((((c[0] + 180) % 360) + 360) % 360 - 180, 10), r(c[1], 10), r(c[2], 100), r(c[3], 100), r(c[4], 100), r(c[5], 100)];
}
function collabSetView(v, now) {
  if (APP.mode !== 'explore' || !Array.isArray(v) || v.length !== 6 || !v.every(Number.isFinite)) return;
  const c = orbit.cur, to = v.slice();
  to[0] += 360 * Math.round((c[0] - to[0]) / 360);
  if (now) { orbit.cur = to; orbit.to = null; return; }   // someone else turning it: there at once (shared.js smooths it)
  Object.assign(orbit, { from: c.slice(), to, t0: performance.now(), fast: true });   // a short glide there
}
function collabState() {
  const ctl = {};
  for (const [k] of SCENES) ctl[k] = Object.fromEntries(ctlsOf(k).map(c => [c.key, ctlValue(k, c)]));
  return { tab: X.tab, scene: X.scene, ctl, time: X.time, reads: X.reads, rseed: X.rseed, branch: X.branch, w: X.w, sseed: X.sseed };
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
  // then the numbers and the picks
  const int = (x, lo, hi) => Number.isInteger(x) && x >= lo && x <= hi;
  if (Number.isFinite(v.time) && v.time >= 0 && v.time <= 2 && v.time !== X.time) setTime(v.time, false);
  if (int(v.reads, 0, READ_MAX())) X.reads = v.reads;
  if (int(v.rseed, 1, 999)) X.rseed = v.rseed;
  if (int(v.branch, -1, 63) && v.branch !== X.branch) selectBranch(v.branch, false);
  if (int(v.w, 1, 30) && v.w !== X.w) setW(v.w, false);
  if (int(v.sseed, 1, 999)) X.sseed = v.sseed;
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
// the letters and mixes the Letters tab offers, with their colours (a mix has none)
const MIXES = () => ctlOf('letters', 'mix').options;
const mixCol = v => (LET.indexOf(v) >= 0 ? LCOL[LET.indexOf(v)] : null);
const LETTER_CHIPS = LET.split('').map((l, i) => [l, l, LCOL[i]]);
// a slider the panes hold (the branch length or the pair favour), with its value; it changes in place, so a drag is not
// cut short by a redraw
const NUM = { time: { label: 'Branch length', min: 0, max: 2, step: 0.01, col: GREEN, text: v => `${v.toFixed(2)} swaps per letter` },
  w: { label: 'Pair favour', min: 1, max: 30, step: 1, col: CYAN, text: v => `matching pairs ${v} × as likely` } };
const slider = key => { const o = NUM[key], v = numOf(key);
  return `<p class="grp-h">${o.label} <b data-numv="${key}" style="margin-left:auto;color:var(--ink)">${esc(o.text(v))}</b></p>
    <input type="range" data-num="${key}" min="${o.min}" max="${o.max}" step="${o.step}" value="${v}" aria-label="${o.label}" style="accent-color:${o.col}">`; };
const statsHtml = rows => `<dl class="stats">${rows.map(([k, v, more]) => `<dt>${esc(k)}</dt><dd>${esc(v)}${more ? `<small>${esc(more)}</small>` : ''}</dd>`).join('')}</dl>`;
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler per pane: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({
      view: () => { const [k, w] = v.split(':'); showView(k, w); }, scene: () => openScene(v),
      ctl: () => sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
      mix: () => setMix(v), read: () => readOut(+v), again: () => readAgain(),
      branch: () => selectBranch(+v === X.branch ? -1 : +v), tree: () => nextTree(), rebuild: () => rebuildAgain(),
      cam: () => { if (X.scene !== 'tree') openScene('tree'); flyTo(view('tree', v)); },
    }[b.dataset.act] || (() => {}))();
  });
  // the sliders change in place, so a drag is not cut short by a redraw
  $('#explore').addEventListener('input', ev => {
    const k = ev.target.dataset.num;
    if (k === 'time') setTime(+ev.target.value, true); else if (k === 'w') setW(+ev.target.value, true);
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
  if (k === 'letters' && X.scene !== 'letters') showView('letters', 'qubits');
  if ((k === 'rule' || k === 'tree' || k === 'stem') && X.scene !== k) openScene(k);
}
function renderAll() { renderLetters(); renderRule(); renderTree(); renderStem(); renderScenes(); updateExtraLabels(); }
// the numbers that follow a slider, redrawn in place (the sliders themselves keep still while dragged)
function syncNums() {
  for (const k in NUM) {
    document.querySelectorAll(`[data-numv="${k}"]`).forEach(el => { el.textContent = NUM[k].text(numOf(k)); });
    document.querySelectorAll(`input[data-num="${k}"]`).forEach(el => { if (document.activeElement !== el) el.value = numOf(k); });
  }
  const live = { letters: lettersLive, rule: ruleLive, stem: stemLiveHtml };
  for (const k in live) document.querySelectorAll(`[data-live="${k}"]`).forEach(el => { el.innerHTML = live[k](); });
}

// what a letter or a mix holds: its chances, its two arrows, its read-outs so far (in words, for both panels)
function lettersInfo() {
  const p = letChances(), b = M.bloch(p), mix = letMix(), li = LET.indexOf(mix), cnt = readCounts();
  const len = k => Math.hypot(b[3 * k], b[3 * k + 2]);
  return {
    what: li >= 0 ? `${LET[li]} is ${KET[li]}: ${codeWords(li)}.` : mix === 'even' ? 'An even mix: a quarter each.' : `The rule's mix after ${X.time.toFixed(2)} swaps per letter, from A.`,
    chances: chancesText(p),
    arrows: li >= 0 ? 'both as long as the sphere' : `${len(0).toFixed(2)} and ${len(1).toFixed(2)} of the sphere`,
    reads: X.reads ? `${X.reads} read-out${X.reads === 1 ? '' : 's'}: ${LET.split('').map((l, i) => `${l} ${cnt[i]}`).join(', ')}` : 'none yet',
  };
}
const lettersLive = () => { const I = lettersInfo(); return `<p class="sub">${esc(I.what)}</p>${statsHtml([['Chances', I.chances], ['Arrows', I.arrows], ['Read out', I.reads]])}`; };
function renderLetters() {
  const pane = $('#pane-letters');
  if (!pane) return;
  const mix = letMix(), on = X.scene === 'letters' && viewIs('letters', 'qubits');
  pane.innerHTML = `<p class="sub">A quantum computer holds each letter in two qubits, drawn as arrows on spheres: up is 0, down is 1. Pick a letter or a mix, then read it out.</p>
    <p class="grp-h">Letter or mix</p><div class="chips">${MIXES().map(([v, n]) => chip(`data-act="mix" data-v="${v}"`, esc(n), on && mix === v, mixCol(v))).join('')}</div>
    ${mix === 'rule' ? slider('time') : ''}
    <div data-live="letters">${lettersLive()}</div>
    <p class="grp-h">Read out</p><div class="chips">${chip('data-act="read" data-v="1"', '1 more', false)}${chip('data-act="read" data-v="100"', '100 more', false)}${chip('data-act="read" data-v="0"', 'Clear', false)}${chip('data-act="again"', 'Read again', false)}</div>
    <p class="grp-h">Show</p><div class="chips">${[['helix', 'The helix'], ['copies', 'The copies'], ['qubits', 'The qubits']].map(([v, n]) => chip(`data-act="view" data-v="letters:${v}"`, n, X.scene === 'letters' && viewIs('letters', v))).join('')}</div>
    <p class="note">Each read-out lands on one letter, by its chance: the piles grow roughly as tall as the chances. |01⟩ means first 0, then 1; an arrow shorter than its sphere means the two qubits depend on each other.</p>`;
}

// the rule, its path and the machine, in words (computed here for the rule, branch length and letters chosen)
function ruleInfo() {
  const mi = ruleModel(), mo = M.MODELS[mi], A = api('rule'), t = X.time, v = ruleView();
  const pi = A.longRun ? A.longRun(mi) : Array.from(M.pi(mi)), r = mo.r, NAMES = ['A↔C', 'A↔G', 'A↔T', 'C↔G', 'C↔T', 'G↔T'];
  const ord = r.map((x, i) => [x, NAMES[i]]).sort((p, q) => q[0] - p[0]), even = ord[0][0] === ord[5][0];
  const rows = [['Long run', chancesText(pi)], ['Swaps', even ? 'all alike' : `${ord[0][1]} and ${ord[1][1]} most readily`, even ? '' : `${ord[5][1]} least`]];
  if (v === 'path') {
    const s = letterOf('start'), p = A.mix ? A.mix(mi, s, t) : Array.from(M.path(mi, s, t));
    rows.push(['The mix', chancesText(p), `after ${t.toFixed(2)} swaps per letter`], ['On its way', pct(wayOf(p, pi, s)), 'of the way to the long-run mix']);
  }
  if (machineOn()) {
    const par = letterOf('parent'), g = A.angles ? A.angles(mi, t, par) : { c1: 0, c0: [0, 0] }, st = A.steps ? A.steps() : { turns: 12, links: 12, copy: 2 };
    rows.push(['The child', chancesText(Array.from(M.path(mi, par, t))), `parent ${LET[par]}, after ${t.toFixed(2)}`],
      ['c1 turns', deg(g.c1)], ['c0 turns', `${deg(g.c0[0])} or ${deg(g.c0[1])}`, 'as c1 is 0 or 1'], ['The gears', deg(M.turnAngle(mi, t)), 'the turn on average']);
    if (v === 'steps') rows.push(['Simple steps', `${st.turns} turns, ${st.links} links`, `plus the copy's ${st.copy} CNOTs`]);
  }
  return { note: mo.note, rows };
}
const ruleLive = () => statsHtml(ruleInfo().rows);
function renderRule() {
  const pane = $('#pane-rule');
  if (!pane) return;
  const mi = ruleModel(), v = ruleView(), on = X.scene === 'rule';
  const ch = (key, opts, cur) => opts.map(([o, n, col]) => chip(`data-act="ctl" data-scene="rule" data-ctl="${key}" data-v="${o}"`, esc(n), cur === o, col)).join('');
  pane.innerHTML = `<p class="sub">A rule of change (a substitution model): how readily each letter swaps for another, and how common each is in the long run. The rates are examples; every number here is computed as you choose.</p>
    <p class="grp-h">Rule</p><div class="chips">${ch('model', M.MODELS.map(m => [m.key, m.name]), M.MODELS[mi].key)}</div>
    <p class="sub">${esc(M.MODELS[mi].note)}</p>
    <p class="grp-h">Show</p><div class="chips">${ctlOf('rule', 'view').options.map(([o, n]) => chip(`data-act="view" data-v="rule:${o}"`, esc(n), on && v === o)).join('')}</div>
    ${v === 'path' ? `<p class="grp-h">Start</p><div class="chips">${ch('start', LETTER_CHIPS, LET[letterOf('start')])}</div>` : ''}
    ${machineOn() ? `<p class="grp-h">Parent's letter</p><div class="chips">${ch('parent', LETTER_CHIPS, LET[letterOf('parent')])}</div>` : ''}
    ${v !== 'rule' ? slider('time') : ''}
    <div data-live="rule">${ruleLive()}</div>
    <p class="note">${machineOn() ? 'The copy is two CNOT gates. The turn is rotations of single qubits plus steps that link two qubits, so it depends on the parent\'s letter. How far each step turns depends only on the branch length; the steps are the same on every branch.' : 'Every mix of the four letters is a point in the pyramid, the pure letters at its corners; over time the rule moves it along a path towards the long-run mix. The most general standard rule is GTR.'}</p>`;
}

// a branch of the family tree in words (its length, swaps and machine), for both panels
function branchInfo(b) {
  const tr = treeNow(), B = tr.branches[b];
  if (!B) return null;
  return { head: `Branch ${b + 1} · ${f2(B.len)} swaps per letter · ${swapsN(B.muts.length)}`,
    muts: B.muts.length ? B.muts.map(m => `${LET[m.from]}→${LET[m.to]} at letter ${m.site + 1}`).join(', ') : 'no swap on this branch',
    seqs: `${tr.nodes[B.from].seq} → ${tr.nodes[B.to].seq}`, turn: `its machine turns ${deg(M.turnAngle(M.DEFAULT, B.len))} on average` };
}
function renderTree() {
  const pane = $('#pane-tree');
  if (!pane) return;
  const v = treeView(), on = X.scene === 'tree', tr = treeNow(), I = X.branch >= 0 && v !== 'species' ? branchInfo(X.branch) : null;
  const ch = (key, cur) => ctlOf('tree', key).options.map(([o, n]) => chip(`data-act="ctl" data-scene="tree" data-ctl="${key}" data-v="${o}"`, esc(n), cur === o)).join('');
  pane.innerHTML = `<p class="sub">A family tree of ${word(tr.nodes.filter(n => n.tip >= 0).length)} descendants of one ancestor, ${esc(tr.nodes[tr.root].seq)}, every swap simulated with the story's example rule. Heights are change: each branch rises by its length.</p>
    <p class="grp-h">Show</p><div class="chips">${ctlOf('tree', 'view').options.map(([o, n]) => chip(`data-act="view" data-v="tree:${o}"`, esc(n), on && v === o)).join('')}</div>
    <p class="grp-h">Tree</p><div class="chips">${ch('seed', ctlValue('tree', ctlOf('tree', 'seed')))}${chip('data-act="tree"', 'New tree', false)}</div>
    <p class="grp-h">Letters change</p><div class="chips">${ch('speed', ctlValue('tree', ctlOf('tree', 'speed')))}</div>
    ${v !== 'tree' ? `<p class="grp-h">Machines</p><div class="chips">${ch('run', ctlValue('tree', ctlOf('tree', 'run')))}</div>` : ''}
    <p class="grp-h">Look</p><div class="chips">${[['default', 'The whole tree'], ['stand', 'Stand in it'], ['up', 'Up from the root']].map(([c, n]) => chip(`data-act="cam" data-v="${c}"`, n, false)).join('')}</div>
    ${v !== 'species' ? `<p class="grp-h">Branch</p><div class="chips">${tr.branches.map((B, i) => chip(`data-act="branch" data-v="${i}"`, String(i + 1), X.branch === i, B.muts.length ? null : GREY)).join('')}</div>
      ${I ? `<h3>${esc(I.head)}</h3><p class="sub">${esc(cap(I.muts))}. ${esc(I.seqs)}; ${esc(I.turn)}.</p>` : '<p class="sub">Pick a branch (click it, or point and pull the trigger): its length, its swaps and its machine.</p>'}`
      : '<p class="sub">The species tree of the authors\' test, ((1, 2), 3), with example branch lengths, and their stems at its tips. A coupling gear on each branch. See the Stem tab.</p>'}
    <p class="note">One machine per branch: the steps are the same on every branch, only how far they turn changes with its length. Chance gives a branch more or fewer swaps than its length leads one to expect.</p>`;
}

// the rebuild in words: per method its share of intact ancestors, the true ancestor and the examples
const STEM_ORDER = ['indep', 'exact', 'coupled'];   // (as the fields stand, left to right: the shares in ascending order)
function stemInfo() {
  const live = stemLive(), A = api('stem'), R = A.results ? A.results(live ? 1 : 0, X.w, X.sseed) : null, names = (live ? A.namesLive : A.names) || {};
  const rows = STEM_ORDER.map(m => {
    const r = R && R[m];
    return [names[m] || m, r ? (live ? `${pct(r.share)} here` : `${pct(r.share)} intact`) : '–', r && live && r.expected != null ? `exact chance ${pct(r.expected)}` : '', m];
  });
  const ex = STEM_ORDER.map(m => { const r = R && R[m]; return r ? [names[m] || m, `${r.best.top} / ${r.best.bottom}`, brokenN(r.broken), m] : null; }).filter(Boolean);
  return { live, rows, ex, truth: `${TD.truth.top} / ${TD.truth.bottom}`, truthB: brokenN(FACTS.truthBroken) };
}
const stemLiveHtml = () => { const I = stemInfo(); return `${statsHtml(I.rows.map(r => r.slice(0, 3)))}
  <p class="grp-h">The true ancestor and one rebuilt each</p>${statsHtml([['True', I.truth, I.truthB]].concat(I.ex.map(r => r.slice(0, 3))))}`; };
function renderStem() {
  const pane = $('#pane-stem');
  if (!pane) return;
  const v = stemView(), on = X.scene === 'stem', live = stemLive(), me = stemMethod();
  pane.innerHTML = `<p class="sub">Three species carry one RNA stem of ${word(TD.pairs)} pairs. Rebuild their shared ancestor ${fmt(TD.n)} times with each method, and count the ancestors whose ${word(TD.pairs)} pairs all hold.</p>
    <p class="grp-h">Show</p><div class="chips">${ctlOf('stem', 'view').options.map(([o, n]) => chip(`data-act="view" data-v="stem:${o}"`, esc(n), on && v === o)).join('')}</div>
    <p class="grp-h">Numbers</p><div class="chips">${ctlOf('stem', 'src').options.map(([o, n]) => chip(`data-act="ctl" data-scene="stem" data-ctl="src" data-v="${o}"`, esc(n), ctlValue('stem', ctlOf('stem', 'src')) === o)).join('')}</div>
    ${live ? `${slider('w')}<div class="chips">${chip('data-act="rebuild"', 'Rebuild again', false)}</div>` : `<p class="sub">The authors' test: ${fmt(TD.n)} rebuilt ancestors per method, matching pairs ${word(TD.w)} times as likely as mismatched ones.</p>`}
    <p class="grp-h">Method</p><div class="chips">${ctlOf('stem', 'method').options.map(([o, n]) => chip(`data-act="ctl" data-scene="stem" data-ctl="method" data-v="${o}"`, esc(n), me === o, METHOD_COL[o])).join('')}</div>
    <div data-live="stem">${stemLiveHtml()}</div>
    <p class="note">The coupled circuit favours matching pairs too strongly: its ancestors look believable, but its percentages are not true chances. A broken pair is normal: only ${esc(TD.allSixPrior)} of ancestors have all ${word(TD.pairs)} pairs matched (the authors). ${live ? 'Computed here with the story\'s example rule; the coupling is our stand-in for the authors\' circuit.' : 'In the authors\' test the shares are theirs; which stems are intact is drawn for the picture.'}</p>`;
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => chip(`data-act="scene" data-v="${k}"`, esc(n), k === X.scene)).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${ctlsOf(X.scene).filter(c => ctlShown(X.scene, c)).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('')}
    ${Object.keys(NUM).filter(key => numShown(X.scene, key)).map(slider).join('')}`;
}
// labels the panes add (none: the sets label their own picks, the tree its branch, the stem its fields)
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show: { branch } (of the family tree),
// { sbranch } (of the species tree), { field } (a method's field) or { stem } (a species', the truth's or a method's
// example), or null
function pickWith(rc) {
  if (APP.mode !== 'explore') return null;
  const sp = X.scene === 'tree' && treeView() === 'species', fields = X.scene === 'stem' && (viewIs('stem', 'rebuild') || viewIs('stem', 'compare'));
  let r = null;
  try {
    if (sp || fields) r = api('stem').pick ? api('stem').pick(rc) : null;
    if (!r && X.scene === 'tree') r = api('tree').pick ? api('tree').pick(rc) : null;
  } catch (e) { return null; }
  if (!r) return null;
  return r.kind === 'branch' ? (r.species ? { sbranch: r.b } : { branch: r.b }) : r.kind === 'field' ? { field: r.method } : r.kind === 'stem' ? { stem: r.which } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null (then where the ray meets the scene)
function pickPos(p) {
  if (X.scene !== 'tree' || !api('tree').mid) return null;
  return p.branch !== undefined ? api('tree').mid(p.branch, false) : p.sbranch !== undefined ? api('tree').mid(p.sbranch, true) : null;
}
const SPECIES_NAME = { s1: 'Species 1', s2: 'Species 2', s3: 'Species 3', n1: 'The ancestor of species 1 and 2' };
function pickText(p) {
  const A = api('tree'), S = api('stem'), names = (stemLive() ? S.namesLive : S.names) || {};
  if (p.branch !== undefined) { const B = treeNow().branches[p.branch]; return B ? [`Branch ${p.branch + 1}`, `${f2(B.len)} swaps per letter · ${swapsN(B.muts.length)}`] : ['', '']; }
  if (p.sbranch !== undefined) {
    const sp = A.species(), B = sp.branches[p.sbranch], n = B && sp.nodes[B.to];
    return B ? [`To ${(SPECIES_NAME[n.name] || 'a species').replace(/^The/, 'the')}`, `${f2(B.len)} swaps per letter (an example)`] : ['', ''];
  }
  if (p.field) { const r = S.results()[p.field]; return [names[p.field] || p.field, stemLive() ? `${pct(r.share)} intact here` : `${pct(r.share)} intact in the authors' test`]; }
  if (p.stem === 'truth') return ['True ancestor', `${TD.truth.top} / ${TD.truth.bottom} · ${brokenN(FACTS.truthBroken)}`];
  if (TD.species[p.stem]) { const s = TD.species[p.stem]; return [SPECIES_NAME[p.stem], `${s.top} / ${s.bottom} · ${brokenN(M.brokenPairs(s.top, s.bottom).length)}`]; }
  const r = S.results()[p.stem];
  return r ? [names[p.stem] || p.stem, `${r.best.top} / ${r.best.bottom} · ${brokenN(r.broken)}`] : ['', ''];
}
// a click (or the trigger) on a branch picks it; on a field, lights its method (again: all three)
function choosePick(p) {
  if (!p) return;
  if (p.branch !== undefined) { if (X.tab !== 'tree') showTab('tree'); selectBranch(p.branch === X.branch ? -1 : p.branch, false); }
  else if (p.field) { if (X.tab !== 'stem') showTab('stem'); sceneCtl('stem', 'method', stemMethod() === p.field ? 'all' : p.field); }
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
// point at, and labels become sprites on top or signs in the scene. Controllers: point and pull the trigger
// to click, drag the scene with the trigger or grip, thumbstick spins and zooms,
// A/X plays and pauses the story. Hand tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  rot: new THREE.Quaternion(), free: false, lm: 'face', signL: new THREE.Quaternion(), signH: new THREE.Vector3(),
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
  // plus wherever you have moved it with the grip; the story's focus side keeps facing you (moving freely, it keeps
  // the turn its home place gives it, times the turn you gave it, XR.rot)
  const gx = cx + XR.globeOff.x, gy = cy + XR.globeOff.y, gz = -dc + XR.globeOff.z;
  XR.globeBase.set(cx, cy, -dc);
  xrFace(_xq2, gx, gy, gz);
  GL.world.quaternion.copy(_xq2).multiply(_xq);
  GL.world.scale.setScalar(XR.R);
  // the target lands on the placement point
  _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(XR.R);
  GL.world.position.set(gx - _xb.x, gy - _xb.y, gz - _xb.z);
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0); XR.size = 1; XR.rot.identity();
  if (XR.panelGroup) xrPanelPose(XR.panelHome.p, XR.panelHome.yaw);
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); XR.size = s.s || 1; xrSceneRot(s.q); if (XR.panelGroup) xrPanelPose(s.pp, s.pr, s.pq); }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}

// ------------------------------------------------- labels and free moving --
// The shell's two headset settings, the same for everyone in a shared room (HOST.xr; read every frame, and a shell
// without them means labels on top and nothing free): labels 'face' (on top: sprites turned to you, over everything),
// 'fixed' (in 3D: upright signs in the scene, turned to you) or 'hidden'; free moving holds what the grip takes like a
// real object.
const xrLabelMode = () => (HOST.xr && HOST.xr.labels ? HOST.xr.labels() : 'face');
const xrFreeOn = () => !!(HOST.xr && HOST.xr.free && HOST.xr.free());
const xrSig = () => (HOST.xr && HOST.xr.sig ? HOST.xr.sig() : '') + (HOST.panels && HOST.panels.sig ? HOST.panels.sig(XR_HERE) : '');
// this story's panels in a headset (the shell's HOST.panels, each story its own; at a station in a shared room the
// station's, for everyone at that circle): 'shown', 'controls' (only the foot bar) or 'hidden' (neither: A or X still
// plays); a shell without it: shown
const xrPanels = () => (HOST.panels && HOST.panels.get ? HOST.panels.get(XR_HERE) : 'shown');
// a headset in a shared room (the shell's HOST.room): no Stories screen there, a story runs only at its station (reached
// by walking into its circle), and away from one it is hidden, not pointable, paused and silent. A shell without
// HOST.room.away: as before (only at a station is the story the station's)
const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());
const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());
// the line on show, for the shell's subtitles in a headset (HOST.xr.subs, drawn by shared.js): the chapter on show's cues
// (ST.items: els with at and out), the story time now, the chapter's end and narrT (to the clock's time); null in
// explore mode, on the Stories screen and away from a station
const xrCaption = () => {
  if (APP.mode !== 'story' || XR.stories || xrAway()) return null;
  const s = storyT(APP.t), c = CH.find(x => s >= x.a && s < x.b) || CH[CH.length - 1], it = ST.items.find(x => x.ch === c);
  return it ? { s, end: c.b, els: it.els, narrT } : null;
};
const _fq = new THREE.Quaternion(), _fv = new THREE.Vector3();
// the yaw of a turn: where its front (+z) points along the floor (def when it points straight up or down)
function yawOf(q, def) { _fv.set(0, 0, 1).applyQuaternion(q); return Math.hypot(_fv.x, _fv.z) < 1e-4 ? +def || 0 : Math.atan2(_fv.x, _fv.z); }
// a turn from the shell or the room ([x, y, z, w] or a quaternion) into q; false when there is none
function xrQ(v, q) {
  if (v && v.isQuaternion) { q.copy(v); return true; }
  if (!Array.isArray(v) || v.length !== 4 || !v.every(Number.isFinite) || !v.some(x => x)) return false;
  q.fromArray(v).normalize();
  return true;
}
// the scene's own turn (free moving only: otherwise it faces you)
function xrSceneRot(q) { if (!(xrFreeOn() && xrQ(q, XR.rot))) XR.rot.identity(); }
// the story panel at p in the rig, upright at yaw, or (free moving) held at the turn q
function xrPanelPose(p, yaw, q) {
  const g = XR.panelGroup;
  if (p && p.isVector3) g.position.copy(p); else if (p) g.position.fromArray(p);
  if (!(xrFreeOn() && xrQ(q, g.quaternion))) g.rotation.set(0, +yaw || 0, 0);
}
// a turn of the hand (in the room) as a turn in the rig's frame, where the scene and the panel hang
function xrRigTurn(q, out) { return out.copy(GL.rig.quaternion).invert().multiply(q).multiply(_fq.copy(GL.rig.quaternion)); }
// the scene's facing, into q: from its placement point (gx, gy, gz) towards you; moving freely, from its home place,
// then turned by XR.rot
function xrFace(q, gx, gy, gz) {
  if (XR.free) _fv.copy(XR.globeBase).negate(); else _fv.set(-gx, -gy, -gz);
  q.setFromUnitVectors(_xz, _fv.normalize());
  if (XR.free) q.premultiply(XR.rot);
  return q;
}
// once a frame: the settings as they are now; free moving turned off gives the scene back its facing and stands the
// panel up again (its yaw kept), and turned on it keeps the scene's facing as it is (no jump)
function xrSettings() {
  XR.lm = xrLabelMode();
  const free = xrFreeOn();
  if (free === XR.free) return;
  if (!free) { XR.rot.identity(); XR.panelGroup.rotation.set(0, yawOf(XR.panelGroup.quaternion, 0), 0); }
  else if (XR.globeOff.lengthSq() > 1e-8) {
    _fv.copy(XR.globeBase).add(XR.globeOff).negate().normalize();
    XR.rot.setFromUnitVectors(_xz, _fv).multiply(_fq.setFromUnitVectors(_xz, _fv.copy(XR.globeBase).negate().normalize()).invert());
  } else XR.rot.identity();
  XR.free = free;
}

// ---------------------------------------------------------------- labels --
const LBL_STYLE = { '': ['#f2f6fc', null], mag: ['#ffd2f4', '#ff5ad9'], amb: ['#ffe2b0', '#ffb43b'],
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tip: ['#e7eef8', '#46d9ff'] };
// a label's picture, shared by its sprite and its sign
function labelTex(L) {
  if (L.ltex) return L.ltex;
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
  return (L.ltex = { tex, aspect: cv.width / H, tip: cls === 'tip' });
}
// labels on top: a sprite turned to you, drawn over everything, beside its point
function labelSprite(L) {
  if (L.sprite) return L.sprite;
  const t = labelTex(L);
  const sp = new THREE.Sprite(new THREE.SpriteMaterial({ map: t.tex, transparent: true, depthTest: false, depthWrite: false }));
  sp.renderOrder = t.tip ? 11 : 10;
  sp.userData.aspect = t.aspect;
  sp.center.set(-0.35 / sp.userData.aspect, 0.5);
  GL.world.add(sp);
  return (L.sprite = sp);
}
// labels in 3D: a flat sign at the sprite's place and size, turned to you each frame, readable from both sides (a quad facing +z and one facing
// -z with its picture flipped, so its text never reads mirrored), in the scene's depth: what stands in front of it
// hides it, and it hides what is behind it (drawn first of the see-through things; its clear corners cut away)
function labelSign(L) {
  if (L.sign) return L.sign;
  const t = labelTex(L), a = 0.35 / t.aspect, b = a + 1;   // (in its width, as the sprite's centre)
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.Float32BufferAttribute([a, -0.5, 0, b, -0.5, 0, b, 0.5, 0, a, 0.5, 0, a, -0.5, 0, b, -0.5, 0, b, 0.5, 0, a, 0.5, 0], 3));
  g.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 1, 1, 0, 1, 1, 0, 0, 0, 0, 1, 1, 1], 2));
  g.setIndex([0, 1, 2, 0, 2, 3, 4, 6, 5, 4, 7, 6]);
  const sg = new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t.tex, transparent: true, alphaTest: 0.1 }));
  sg.renderOrder = -1;
  sg.userData.aspect = t.aspect;
  GL.world.add(sg);
  return (L.sign = sg);
}
function dropSprite(L) {
  if (!L) return;
  for (const k of ['sprite', 'sign']) {
    const o = L[k];
    if (!o) continue;
    if (o.parent) o.parent.remove(o);
    if (k === 'sign') o.geometry.dispose();
    o.material.dispose();
    L[k] = null;
  }
  if (L.ltex) { L.ltex.tex.dispose(); L.ltex = null; }
}
function hideLabelXR(L) { if (L.sprite) L.sprite.visible = false; if (L.sign) L.sign.visible = false; }
function placeLabelXR(L, alpha, S) {
  // on top (a sprite), in 3D (a sign) or hidden, as the shell's setting says; the pointer's tip is always a sprite
  const m = L === XR.tip ? 'face' : XR.lm, fixed = m === 'fixed';
  if (alpha <= 0.001 || m === 'hidden') { hideLabelXR(L); return; }
  if (fixed ? L.sprite : L.sign) (fixed ? L.sprite : L.sign).visible = false;
  const sp = fixed ? labelSign(L) : labelSprite(L), o = alpha;
  sp.visible = o > 0.01;
  sp.material.opacity = o;
  labelPos(L, sp.position);
  const hm = 0.021 / XR.R;
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
  if (fixed) {
    // upright and turned to you, about the vertical only (the rig's frame): a sign in the scene, not a sprite on top
    _fv.copy(sp.position).applyMatrix4(GL.world.matrix);
    sp.quaternion.copy(XR.signL).multiply(_fq.setFromAxisAngle(_xY, Math.atan2(XR.signH.x - _fv.x, XR.signH.z - _fv.z)));
  }
}
// the branch, the field or the stem a controller points at, labelled where the ray meets it
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

// --------------------------------------------------- picking a branch --
// The branch, the field or the stem a ray points at in explore mode (see pickWith), or null
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
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
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
    o0: c.o.clone(), p0, reach: 1, r0: (h.kind === 'panel' ? XR.panelGroup.quaternion : XR.rot).clone() };
  buzz(c, 0.4, 25);
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3(), _gr = new THREE.Quaternion();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it (moving freely,
// it also turns with your hand, about it: what you hold stays in your hand)
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { c.grab = null; return; }   // locked meanwhile (a shared room's story lock: Lock this story)
  const o = G.target === 'globe' ? XR.ctrls.find(k => k !== c && k.grab && k.grab.target === 'globe' && k.src && k.g.visible) : null;
  if (o) { if (c.i > o.i) xrResize(o, c); return; }
  if (G.two) { G.two = null; G.q0.setFromRotationMatrix(c.g.matrix).invert(); G.o0.copy(c.o); G.p0.copy(GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff))); G.reach = 1; G.r0.copy(XR.rot); }
  if (gp && gp.axes.length >= 4 && Math.abs(gp.axes[3]) > 0.2) G.reach = clamp(G.reach * Math.exp(gp.axes[3] * dt * 1.5), 0.15, 6);
  _gq.setFromRotationMatrix(c.g.matrix).multiply(G.q0);
  _gv.copy(G.p0).sub(G.o0).multiplyScalar(G.reach);
  const lenMax = 4;
  if (_gv.length() > lenMax) _gv.setLength(lenMax);
  _gv.applyQuaternion(_gq).add(c.o);
  GL.rig.worldToLocal(_gv);
  if (G.target === 'globe') {
    XR.globeOff.copy(_gv).sub(XR.globeBase);
    if (XR.free) XR.rot.copy(xrRigTurn(_gq, _gr)).multiply(G.r0);
  } else {
    XR.panelGroup.position.copy(_gv);
    if (XR.free) { XR.panelGroup.quaternion.copy(xrRigTurn(_gq, _gr)).multiply(G.r0); return; }   // held as it is: it may tilt
    GL.rig.worldToLocal(_gh.copy(XR.head));
    XR.panelGroup.rotation.set(0, Math.atan2(_gh.x - _gv.x, _gh.z - _gv.z), 0); // keep it upright, facing you
  }
}
// both hands on the scene: it grows and shrinks with the distance between them (a quarter to four times the
// story's own size) and moves with their middle; moving freely, the line between them turns it about their middle
function xrResize(a, b) {
  const d = a.o.distanceTo(b.o);
  _gv.copy(a.o).add(b.o).multiplyScalar(0.5);
  GL.rig.worldToLocal(_gv);
  _gh.copy(b.o).sub(a.o).applyQuaternion(_gr.copy(GL.rig.quaternion).invert()).normalize();   // (in the rig's frame)
  const T = a.grab.two || (a.grab.two = b.grab.two = { d0: Math.max(0.05, d), s0: XR.size, m0: _gv.clone(), off0: XR.globeOff.clone(), l0: _gh.clone(), r0: XR.rot.clone() });
  XR.size = clamp(T.s0 * d / T.d0, 0.25, 4);
  XR.globeOff.copy(T.off0).add(_gv).sub(T.m0);
  if (!XR.free) return;
  _gq.setFromUnitVectors(T.l0, _gh);
  XR.rot.copy(_gq).multiply(T.r0);
  XR.globeOff.copy(XR.globeBase).add(T.off0).sub(T.m0).applyQuaternion(_gq).add(_gv).sub(XR.globeBase);
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
  else if (xrAway()) hit = null;   // away from its station in a shared room: nothing of the story to point at
  else if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories) {
    // the scene counts as a ball around the view's target; a branch or a stem counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const pk = pickRay(c.o, c.d);
    if (t > 0 || pk) {
      // a pick with a point of its own is marked there; else the ball's surface
      const q = pk ? pickPos(pk) : null;
      if (q) _xp.set(q[0], q[1], q[2]).applyMatrix4(GL.sets[X.scene].group.matrixWorld);
      else _xp.copy(dL).multiplyScalar(t > 0 ? t : Math.max(0, _xc.copy(XR.target).sub(oL).dot(dL))).add(oL).applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i: -1, pk, point: _xp.clone() };
      dist = c.o.distanceTo(_xp);
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
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
  xrSettings();
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
    // in a shared room no Stories screen: a story is reached by walking into its station's circle, and at its station it
    // is the station's (a shell without HOST.room.away: only there); leaving the room brings it back, as for a new wearer
    const roomOnly = xrRoomOnly();
    if (XR.inRoom && !roomOnly) xrFreshStart();
    XR.inRoom = roomOnly;
    if (XR.stories && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();
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
  // away from its station in a shared room the story waits, silent (hidden in xrUpdate, not pointable in xrPoint); a
  // pause made here is not the room's (the shell takes no clock or state from a headset that is not at a station)
  if (xrAway()) { APP.playing = false; SLIDE.tail = null; }
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
  const land = !!XR.stories, away = xrAway();   // (away from its station in a shared room: the story hidden, only the shell's things)
  if (XR.land) {
    if (XR.landRev !== HOST.listRev) xrLandingCards();   // a story added while the app runs: its card joins the arc
    // Sound check takes the place of the story cards while it is open
    for (const P of XR.land) P.mesh.visible = land && (P === XR.land[0] || !XR.soundCheck);
    XR.snd.mesh.visible = land && !!XR.soundCheck;
    // labels hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and A or X still plays); labels in 3D: the panels stand in the scene, as the labels' signs do. And
    // this story's panels (xrPanels): controls only keeps just the foot bar, hidden neither
    const pm = xrPanels(), pv = !land && !away && XR.lm !== 'hidden';
    XR.main.mesh.visible = pv && pm === 'shown';
    XR.foot.mesh.visible = pv && pm !== 'hidden';
    panelDepth(XR.main, XR.lm === 'fixed'); panelDepth(XR.foot, XR.lm === 'fixed');
  }
  GL.world.visible = !land && !away;
  if (land !== XR.landShown) { XR.landShown = land; HOST.setUrl(land); }
  GL.rig.updateMatrixWorld(true);
  XR.camLocal.copy(XR.head);
  GL.world.worldToLocal(XR.camLocal);
  // labels in 3D: each sign turns to you (placeLabelXR) from the world's frame back to the rig's, where your head is
  XR.signL.copy(GL.world.quaternion).invert();
  GL.rig.worldToLocal(XR.signH.copy(XR.head));
  const story = APP.mode === 'story';
  for (const L of ST.labels) {
    if (story) placeLabelXR(L, fadeVal(storyT(APP.t), L.tIn, L.tOut, 0.5) * (S[L.set + '_a'] > 0.5 ? 1 : 0), S);
    else hideLabelXR(L);
  }
  for (const L of LBL.sets) placeLabelXR(L, setLabelAlpha(L, S), S);
  for (const L of LBL.extra) {
    if (!story) placeLabelXR(L, 1, S);
    else hideLabelXR(L);
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
    session = await navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) });
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
  XR.free = xrFreeOn(); XR.lm = xrLabelMode();   // (as the shell has them: nothing to turn off or on at the first frame)
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
  // (not in a shared room: there a story is reached by walking into its station's circle)
  XR.inRoom = xrRoomOnly();
  const fromStart = (HOST.picking || HOST.landingVR) && !XR.inRoom;
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
  // in a shared room the story and its place stay (at its station the room's clock and state go on applying; away from
  // one a new wearer walks up to a station: no Stories screen in a room)
  if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }
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
    XR.globeOff.copy(p.off); XR.size = p.s || 1; xrSceneRot(p.rot || p.q);
    xrPanelPose(p.pp, p.pr, p.pq);
  }
  const ref = GL.renderer.xr.getReferenceSpace();
  if (ref && ref.addEventListener) ref.addEventListener('reset', () => { XR.needRecenter = true; });
}
function xrEnded() {
  if (!XR.on) return;
  const away = xrAway();   // (asked while the session is still the shell's)
  XR.on = false; XR.session = null; XR.mode = null; XR.hiddenAt = 0;
  HOST.session = null;
  document.body.classList.remove('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  GL.world.position.set(0, 0, 0); GL.world.quaternion.identity(); GL.world.scale.setScalar(1);
  for (const P of XR.panels) P.mesh.visible = false;
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; c.grab = null; c.hover = null; c.src = null; }
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { hideLabelXR(L); L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  GL.stars.visible = true; GL.stars.material.size = 1.3;
  GL.world.visible = true;
  for (const P of XR.land || []) P.mesh.visible = false;
  if (XR.snd) XR.snd.mesh.visible = false;
  XR.soundCheck = false;
  // left the headset from the Stories screen, or away from a station in a shared room (its story hidden and paused
  // there): back to the Stories screen on the page
  if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }
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
// a title (textBaseline top): its own size when it fits, else smaller to fit, down to min, on the same baseline;
// below that, with two, on two lines split where they are most even (as large as fits); else cut short at min.
// Returns its height: lh for one line, lh plus a line for two.
function fitTitle(ctx, text, x, y, maxW, px, lh, color, weight, min, two) {
  text = String(text); ctx.fillStyle = color || VC.ink;
  const size = L => {   // the largest size from px down to min at which every line fits, else 0
    ctx.font = vfont(px, weight);
    let s = Math.min(px, Math.floor(px * maxW / Math.max(...L.map(l => ctx.measureText(l).width))));
    for (; s >= min; s--) { ctx.font = vfont(s, weight); if (L.every(l => ctx.measureText(l).width <= maxW)) return s; }
    return 0;
  };
  let s = size([text]);
  if (!s && two) {
    const wd = text.split(' ');
    let L = null, m = Infinity;
    ctx.font = vfont(px, weight);
    for (let k = 1; k < wd.length; k++) {
      const p = [wd.slice(0, k).join(' '), wd.slice(k).join(' ')], v = Math.max(...p.map(l => ctx.measureText(l).width));
      if (v < m) { m = v; L = p; }
    }
    if (L && (s = size(L))) {
      const y0 = y + Math.round((px - s) * 0.8), l2 = Math.round(lh * s / px);
      L.forEach((l, k) => ctx.fillText(l, x, y0 + k * l2));
      return lh + l2;
    }
  }
  s = s || min; ctx.font = vfont(s, weight);
  ctx.fillText(fitText(ctx, text, maxW), x, y + Math.round((px - s) * 0.8));   // (B612's baseline is 0.8 of its size down)
  return lh;
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
  const P = { w, h, cv, ctx: cv.getContext('2d'), tex, mesh, draw, sig, regions: [], hover: null, last: '', t: 0, inScene: false };
  P.at = (x, y) => {
    for (let k = P.regions.length - 1; k >= 0; k--) {
      const r = P.regions[k];
      if (x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h) return r;
    }
    return null;
  };
  return P;
}
// a story panel in the scene or on top, as the labels are: labels in 3D, it stands in the scene as their signs do
// (depth-tested and writing depth, drawn first of the see-through things, its clear corners cut away), so what stands
// in front of it hides it and it hides what is behind it; otherwise it is drawn over everything. Set only when that
// changes (a new alphaTest needs the material built again)
function panelDepth(P, inScene) {
  if (P.inScene === inScene) return;
  const m = P.mesh.material;
  P.inScene = m.depthTest = m.depthWrite = inScene;
  m.alphaTest = inScene ? 0.1 : 0; m.needsUpdate = true;
  P.mesh.renderOrder = inScene ? -1 : 50;
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
    let s = 's' + audioLabel() + xrSig() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.time, X.reads, X.rseed, X.branch, X.w, X.sseed, XR.on].join('|');
}
const XR_HERE = 'mutation';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// floating in an arc in front of you while the story itself is hidden.
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel() + HOST.repeat + XR.soundCheck + HOST.audio.muted + HOST.anchor.status() + HOST.list.length);
  head.mesh.position.set(0, 0.36, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head); XR.panels.push(head);
  xrLandingCards();
  // Sound check (opened from the header), in the place of the story cards
  XR.snd = makePanel(1400, 860, 1.02, drawSoundCheck, () => (XR.snd.mesh.visible ? 'snd' + Math.floor(performance.now() / 500) : 'off'));
  XR.snd.mesh.position.set(0, -0.17, -1.2);
  XR.landGroup.add(XR.snd.mesh); XR.panels.push(XR.snd);
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// One card per story, 0.36 m wide, on an arc for any number of stories: neighbours 0.381 m apart and the outer ones at
// most 62° to the side (fifteen: 0.155 rad apart at 2.46 m), never nearer than 1.25 m (a few stories stand closer
// together in angle). Built again when the shell's list of stories changes while the app runs (HOST.listRev: a story
// added in a release gets its card)
function xrLandingCards() {
  for (const P of XR.land.splice(1)) {
    XR.landGroup.remove(P.mesh); XR.panels.splice(XR.panels.indexOf(P), 1);
    P.tex.dispose(); P.mesh.geometry.dispose(); P.mesh.material.dispose();
  }
  const n = HOST.list.length, d = Math.max(1.25, n > 1 ? 0.1905 / Math.sin(1.085 / (n - 1)) : 0), step = 2 * Math.asin(0.1905 / d);
  XR.landRev = HOST.listRev;
  HOST.list.forEach((s, k) => {
    const a = (k - (n - 1) / 2) * step;
    const P = makePanel(640, 820, 0.36, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, -0.105, -Math.cos(a) * d);   // top edge 0.126 m up, under the header
    P.mesh.rotation.y = -a;
    XR.landGroup.add(P.mesh); XR.land.push(P); XR.panels.push(P);
  });
  XR.panelMeshes = XR.panels.map(P => P.mesh);
}
// leave the Stories screen: back into this story (resumed, or started if it never ran)
function xrLandingClose() {
  XR.stories = false;
  // at a shared room's station the story goes on as the room has it: a restart here would restart it for everyone (in
  // a room a story runs only at its station, on the station's clock)
  if (!XR.inStory && !HOST.collab.mine() && !xrRoomOnly()) APP.enterStory(0);
  XR.inStory = true;
  if (APP.mode === 'story' && !xrRoomOnly()) APP.playing = true;
}
function drawLandHead(ctx, P) {
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen',
    'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
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
  fitTitle(ctx, s.kick.toUpperCase(), 48, 64, P.w - 96, 28, 34, s.col, 700, 22);
  // a long title shrinks a little, else takes two lines and the description moves down (ending above the length)
  const dy = 112 + fitTitle(ctx, s.title, 46, 112, P.w - 94, 72, 78, VC.ink, 700, 58, true) + 32;
  textBlock(ctx, s.desc, 48, dy, P.w - 96, 31, 45, VC.muted, 400, Math.min(7, Math.floor((P.h - 243 - dy) / 45) + 1));
  ctx.font = vfont(26); ctx.fillStyle = VC.faint; ctx.fillText(fitText(ctx, s.len, P.w - 96), 48, P.h - 196);
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
    let yw = 0;   // the kicker stops short of 'You are here' beside it
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; yw = ctx.measureText('You are here').width + 20; }
    fitTitle(ctx, kick.toUpperCase(), x + 26, y + 22, W - 52 - yw, 21, 26, col, 700, 17);
    fitTitle(ctx, title, x + 26, y + 54, W - 52, 38, 44, VC.ink, 700, 30);
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
  // in a shared room no Stories button: each station keeps its story, and another story is another station (walk into
  // its circle)
  if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, 'The mutation machine', 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again on the Stories screen.' : XR.free ? 'Trigger (or pinch): use buttons. Grip: hold the scene or this panel to move and turn it; both grips on the scene resize it. A or X: play and pause.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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
  ({ letters: drawLettersPane, rule: drawRulePane, tree: drawTreePane, stem: drawStemPane, scenes: drawScenesPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
// buttons that wrap like the HTML chips: items -> { id, label, on, col, ink, fn } (no fn: a plain chip)
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  for (const it of items) {
    ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
    const sw = it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.col) swatch(ctx, cx + 12, cy + h / 2 - 7, 14, it.col);
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
// rows of a name (muted) and its value (ink), as the HTML's dl.stats
// (kw: the names' column, wider where they are long, as the rebuild's methods)
function stats(ctx, x, y, W, rows, kw = 220) {
  let yy = y;
  for (const [k, v, more] of rows) {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, k, kw - 10), x, yy + 3);
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + kw, yy);
    if (more) { const w = ctx.measureText(v).width; ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, more, W - kw - 20 - w), x + kw + 16 + w, yy + 4); }
    yy += 38;
  }
  return yy - y;
}
// a slider the panes hold (the branch length or the pair favour): its name, its value and the slider under them
function numRow(ctx, P, key, x, y, W) {
  const o = NUM[key], v = numOf(key);
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(o.label, x, y + 2);
  ctx.font = vfont(24, 700); ctx.fillStyle = VC.ink; ctx.textAlign = 'right'; ctx.fillText(o.text(v), x + W, y); ctx.textAlign = 'left';
  vSlider(ctx, P, 'num:' + key, x + 14, y + 28, W - 28, v, o.min, o.max, o.col, val => (key === 'w' ? setW(val, true) : setTime(val, true)));
  return 28 + 48 + 12;
}
// a closing note in the room left, if any
const footNote = (ctx, text, x, y, W, bottom) => { if (y + 60 < bottom) textBlock(ctx, text, x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(4, Math.floor((bottom - y) / 29)))); };
function drawLettersPane(ctx, P, x, y, W, bottom) {
  const I = lettersInfo(), mix = letMix(), on = X.scene === 'letters' && viewIs('letters', 'qubits');
  y += textBlock(ctx, 'A quantum computer holds each letter in two qubits, arrows on spheres: up is 0, down is 1. Pick a letter or a mix, then read it out.', x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'Letter or mix');
  y += flow(ctx, P, MIXES().map(([v, n]) => ({ id: 'mix:' + v, label: n, on: on && mix === v, col: mixCol(v), fn: () => setMix(v) })), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  if (mix === 'rule') y += numRow(ctx, P, 'time', x, y, W);
  y += textBlock(ctx, I.what, x, y, W, 24, 32, VC.ink, 400, 2) + 10;
  y += stats(ctx, x, y, W, [['Chances', I.chances], ['Arrows', I.arrows], ['Read out', I.reads]]) + 12;
  y += head(ctx, x, y, 'Read out');
  y += flow(ctx, P, [['1', '1 more'], ['100', '100 more'], ['0', 'Clear']].map(([v, n]) => ({ id: 'read:' + v, label: n, fn: () => readOut(+v) }))
    .concat([{ id: 'again', label: 'Read again', fn: readAgain }]), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, [['helix', 'The helix'], ['copies', 'The copies'], ['qubits', 'The qubits']].map(([v, n]) => ({ id: 'v:' + v, label: n, on: X.scene === 'letters' && viewIs('letters', v), fn: () => showView('letters', v) })), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  footNote(ctx, 'Each read-out lands on one letter, by its chance: the piles grow roughly as tall as the chances. |01⟩ means first 0, then 1.', x, y, W, bottom);
}
function drawRulePane(ctx, P, x, y, W, bottom) {
  const mi = ruleModel(), v = ruleView(), on = X.scene === 'rule', I = ruleInfo();
  const letters = key => LETTER_CHIPS.map(([l, n, col]) => ({ id: key + ':' + l, label: n, col, on: LET[letterOf(key)] === l, fn: () => sceneCtl('rule', key, l) }));
  y += textBlock(ctx, 'A rule of change: how readily each letter swaps for another, and how common each is in the long run. Example rates, computed as you choose.', x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'Rule');
  y += flow(ctx, P, M.MODELS.map((m, i) => ({ id: 'model:' + m.key, label: m.name, on: i === mi, fn: () => sceneCtl('rule', 'model', m.key) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlOf('rule', 'view').options.map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && v === o, fn: () => showView('rule', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (v === 'path') { y += head(ctx, x, y, 'Start'); y += flow(ctx, P, letters('start'), x, y, W, bottom, { px: 22, h: 50 }) + 12; }
  if (machineOn()) { y += head(ctx, x, y, 'Parent\'s letter'); y += flow(ctx, P, letters('parent'), x, y, W, bottom, { px: 22, h: 50 }) + 12; }
  if (v !== 'rule') y += numRow(ctx, P, 'time', x, y, W);
  y += stats(ctx, x, y, W, I.rows) + 12;
  footNote(ctx, machineOn() ? 'The copy is two CNOT gates; the turn is rotations of single qubits plus steps that link two qubits, so it depends on the parent\'s letter. The angles depend only on the branch length.'
    : cap(I.note), x, y, W, bottom);
}
function drawTreePane(ctx, P, x, y, W, bottom) {
  const v = treeView(), on = X.scene === 'tree', tr = treeNow(), I = X.branch >= 0 && v !== 'species' ? branchInfo(X.branch) : null;
  const opts = key => ctlOf('tree', key).options.map(([o, n]) => ({ id: key + ':' + o, label: n, on: ctlValue('tree', ctlOf('tree', key)) === o, fn: () => sceneCtl('tree', key, o) }));
  y += textBlock(ctx, `A family tree from one ancestor, ${tr.nodes[tr.root].seq}, every swap simulated with the story's example rule. Heights are change: each branch rises by its length.`, x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlOf('tree', 'view').options.map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && v === o, fn: () => showView('tree', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Tree');
  y += flow(ctx, P, opts('seed').concat([{ id: 'newtree', label: 'New tree', fn: nextTree }]), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Letters change');
  y += flow(ctx, P, opts('speed'), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (v !== 'tree') { y += head(ctx, x, y, 'Machines'); y += flow(ctx, P, opts('run'), x, y, W, bottom, { px: 22, h: 50 }) + 12; }
  // (in a headset the view from below would tip the tree over: stand in it instead)
  y += head(ctx, x, y, 'Look');
  y += flow(ctx, P, [['default', 'The whole tree'], ['stand', 'Stand in it']].concat(XR.on ? [] : [['up', 'Up from the root']])
    .map(([c, n]) => ({ id: 'cam:' + c, label: n, fn: () => { if (X.scene !== 'tree') openScene('tree'); flyTo(view('tree', c)); } })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (v === 'species') { textBlock(ctx, 'The species tree of the authors\' test, ((1, 2), 3), with example branch lengths, and their stems at its tips; a coupling gear on each branch. See the Stem tab.', x, y, W, 23, 32, VC.ink, 400, 3); return; }
  y += head(ctx, x, y, 'Branch (or point at one and pull the trigger)');
  y += flow(ctx, P, tr.branches.map((B, i) => ({ id: 'br:' + i, label: String(i + 1), on: X.branch === i, ink: B.muts.length ? VC.ink : VC.muted, fn: () => selectBranch(X.branch === i ? -1 : i) })), x, y, W, bottom, { px: 21, h: 46 }) + 12;
  if (I) {
    y += textBlock(ctx, I.head, x, y, W, 27, 36, VC.ink, 700, 1) + 4;
    y += textBlock(ctx, `${cap(I.muts)}. ${I.seqs}; ${I.turn}.`, x, y, W, 23, 31, VC.ink, 400, 3) + 10;
  }
  footNote(ctx, 'One machine per branch: the same steps on every branch, only how far they turn changes with its length.', x, y, W, bottom);
}
function drawStemPane(ctx, P, x, y, W, bottom) {
  const v = stemView(), on = X.scene === 'stem', live = stemLive(), me = stemMethod(), I = stemInfo();
  y += textBlock(ctx, `Three species carry one RNA stem of ${word(TD.pairs)} pairs. Rebuild their ancestor ${fmt(TD.n)} times with each method; count those whose ${word(TD.pairs)} pairs all hold.`, x, y, W, 23, 32, VC.muted, 400, 2) + 10;
  y += head(ctx, x, y, 'Show');
  y += flow(ctx, P, ctlOf('stem', 'view').options.map(([o, n]) => ({ id: 'v:' + o, label: n, on: on && v === o, fn: () => showView('stem', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  y += head(ctx, x, y, 'Numbers');
  y += flow(ctx, P, ctlOf('stem', 'src').options.map(([o, n]) => ({ id: 'src:' + o, label: n, on: ctlValue('stem', ctlOf('stem', 'src')) === o, fn: () => sceneCtl('stem', 'src', o) }))
    .concat(live ? [{ id: 'rebuild', label: 'Rebuild again', fn: rebuildAgain }] : []), x, y, W, bottom, { px: 22, h: 50 }) + 12;
  if (live) y += numRow(ctx, P, 'w', x, y, W);
  y += head(ctx, x, y, 'Method');
  y += flow(ctx, P, ctlOf('stem', 'method').options.map(([o, n]) => ({ id: 'm:' + o, label: n, col: METHOD_COL[o], on: me === o, fn: () => sceneCtl('stem', 'method', o) })), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  // (the methods named as on the page's pane)
  y += stats(ctx, x, y, W, I.rows.map(r => r.slice(0, 3)), 280) + 8;
  y += head(ctx, x, y, 'The true ancestor and one rebuilt each');
  y += stats(ctx, x, y, W, [['True', I.truth, I.truthB]].concat(I.ex.map(r => r.slice(0, 3))), 280) + 10;
  footNote(ctx, `The coupled circuit favours matching pairs too strongly: believable ancestors, but its percentages are not true chances. Only ${TD.allSixPrior} of ancestors have all ${word(TD.pairs)} pairs matched.${live ? ' The coupling here is our stand-in for the authors\' circuit.' : ''}`, x, y, W, bottom);
}
// the four scenes, and the chosen scene's own controls (its sliders too)
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
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => sceneCtl(X.scene, c.key, v) })), x, y, W, bottom, { px: 24, h: 56 }) + 24;
  }
  for (const key of Object.keys(NUM).filter(k => numShown(X.scene, k))) if (y + 90 < bottom) y += numRow(ctx, P, key, x, y, W);
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
// Optional voice-over: put an MP3 at audio/narration-mutation.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-mutation.mp3', {
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
const SLIDE = { at: -1, go: -1, last: 0, lt: 0, lp: false, tail: null, from: 0 };
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
  SLIDE.from = from;   // (the sound effects' cues cross by the same rule: sfxStep)
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

// ---------------------------------------------------------- sound effects --
// Sounds inside the story (the shell's HOST.sfx, sfx.js; phase 2). Cues are set beside the keys in buildStory, in story
// time (sfxCue), and play as the clock crosses them while the story plays, by the slideshow's crossing rule
// (SLIDE.from): the same cues at the same moment on every device at a station, none on a jump, a scrub, a slideshow
// stop's seek or a late joiner's start. A span (sfxHold) keeps a continuous sound while the clock is inside it and
// playing. Explore and headset actions call sfxAct (explore mode only) or sfxPlay where the story already handles them.
// A sound comes from a place (a set's anchor, sfxPos): in a headset through an HRTF panner, on a screen panned by where
// it shows. An older shell (no HOST.sfx, or a sound it does not know) plays nothing. Never in collab.state(): each
// device plays its own. SFXQ.log keeps what was asked for (also when nothing can play: before a tap), for the tests
const SFXQ = { cues: [], spans: [], hi: -1, t: 0, n: 0, log: [], quiet: 0 };   // quiet: a room's state being applied (silent)
const sfxCue = (t, name, set, at, o) => { SFXQ.cues.push({ t, n: Math.max(0.05, narrT(t)), name, set, at, o: o || {} }); };
const sfxHold = (t0, t1, name, set, at, o) => { SFXQ.spans.push({ id: XR_HERE + '.' + SFXQ.spans.length, t0, t1, n0: narrT(t0), n1: narrT(t1), name, set, at, o: o || {} }); };
const sfxN = () => SFXQ.n + (HOST.sfx && HOST.sfx.count ? HOST.sfx.count() : 0);
const _sfv = new THREE.Vector3();
// where a sound comes from: [x, y, z] in the scene's (the reference space's) coordinates and, on a screen, a pan
function sfxWhere(set, at) {
  if (set === 'world') { if (!at) return {}; if (Array.isArray(at)) _sfv.fromArray(at); else _sfv.copy(at); }   // a point already in the scene's coordinates (a ray's hit)
  else if (!sfxPos(set, at, _sfv)) return {};
  const o = { at: [_sfv.x, _sfv.y, _sfv.z] };
  if (!(XR.on && GL.renderer.xr.isPresenting)) { _sfv.project(GL.camera); o.pan = clamp(_sfv.x, -1, 1) * 0.6 * (_sfv.z > 1 ? -1 : 1); }
  return o;
}
function sfxPlay(name, set, at, o) {
  SFXQ.n++;
  if (name !== 'hover') { SFXQ.log.push([name, Math.round(APP.t * 100) / 100, APP.mode]); if (SFXQ.log.length > 64) SFXQ.log.shift(); }
  if (!HOST.sfx || !HOST.sfx.play) return null;
  try { return HOST.sfx.play(name, Object.assign(sfxWhere(set, at), o)); } catch (e) { return null; }
}
// nothing of the story sounds while it is hidden: behind a Stories screen (page or headset), or a headset away from its station
const sfxHidden = () => !!(HOST.picking || XR.stories || xrAway());
// an explore action's sound (a pick, a result, a knockout): only in explore mode (a room's state applied while the story
// plays is silent)
const sfxAct = (name, set, at, o) => (APP.mode === 'explore' && !SFXQ.quiet && !sfxHidden() ? sfxPlay(name, set, at, o) : null);
// every frame, right after slideStep (`was`: the story was playing as the frame began): the cues crossed since the
// slideshow's `from` (at most 1.5 s back: the narration's clock can leap ahead as it starts after a jump, and its cues
// then play a moment late, not a burst of old ones; never twice: the narration or a room's clock may pull the clock back
// a hair, SFXQ.hi, forgotten once the clock is put back further), the spans the clock is in, and the live parts
// (sfxLive, where a story has them)
function sfxStep(was, dt) {
  const t = APP.t, from = SLIDE.from, quiet = APP.mode !== 'story' || sfxHidden();
  if (from < SFXQ.t - 0.5 || t < SFXQ.hi - 0.5) SFXQ.hi = -1;   // back to earlier: Replay, Repeat, a jump back
  if (was && !quiet && t > from) {
    const hi = SFXQ.hi;
    for (const c of SFXQ.cues) if (c.n > from && c.n <= t && c.n > hi && t - c.n < 1.5) { SFXQ.hi = Math.max(SFXQ.hi, c.n); sfxPlay(c.name, c.set, c.at, c.o); }
  }
  if (APP.playing && !quiet && HOST.sfx && HOST.sfx.drone) {
    for (const s of SFXQ.spans) if (t >= s.n0 && t < s.n1) { try { HOST.sfx.drone(s.id, s.name, Object.assign(sfxWhere(s.set, s.at), s.o)); } catch (e) { /* an older shell */ } }
  }
  if (typeof sfxLive === 'function' && !sfxHidden()) sfxLive(dt);
  SFXQ.t = t;
}
// a sound's place (sound effects): a set's anchor (a name, a function, or [x, y, z] in its frame) in the scene's
// coordinates; no set: GL.world's origin. Sets may hang under a life-size holder: each group's own world matrix
function sfxPos(set, at, out) {
  const s = set && GL.sets[set];
  if (!s) out.set(0, 0, 0).applyMatrix4(GL.world.matrixWorld);
  else { const p = anchorOf(set, at); out.set(p[0], p[1], p[2]).applyMatrix4(s.group.matrixWorld); }
  return isFinite(out.x + out.y + out.z);
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
    let best = 'letters', ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01) { ba = a; best = k; } }
    if (best === 'tree' && S.stem_a > 0.5 && S.stem_fields + S.stem_truth > 0.1) best = 'stem';   // (the rebuilt fields stand under the species tree)
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(0, 6), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = v; orbit.to = null;
    // (in a headset the tall tree's axis stood a little further off than the view's target, see standView: explore
    // turns a scene round its target, so the target glides back onto the axis)
    const sb = XR.on && best === 'tree' ? standW(ts) * STAND_BACK : 0;
    if (sb > 0) { const A = v[0] * D2R; flyTo([v[0], v[1], v[2], v[3] - sb * Math.sin(A), v[4], v[5] - sb * Math.cos(A)]); }
    X.scene = best; X.t0 = performance.now();
    // the story's numbers carry over to the panes first (the branch length, the read-outs, the pair favour), so the
    // controls are matched with them
    if (best === 'letters') { X.time = clamp(Math.round(S.letters_time * 100) / 100, 0, 2); X.rseed = Math.max(1, Math.round(S.letters_seed)); }
    if (best === 'rule') X.time = clamp(Math.round(S.rule_time * 100) / 100, 0, 2);
    X.reads = best === 'letters' && S.letters_open > 0.5 ? clamp(Math.round(S.letters_reads), 0, READ_MAX()) : 0;
    X.branch = -1; X.w = clamp(Math.round(S.stem_w), 1, 30) || TD.w; X.sseed = 1;
    // and pick the scene's controls that come closest to what the story was showing
    const s = GL.sets[best];
    X.ctl[best] = {};
    for (const ct of ctlsOf(best)) {
      let bo = ct.options[0][0], bd = Infinity;
      for (const [v] of ct.options) {
        const c = ctlArgs(best, 0);
        c.t = 1e3; c[ct.key] = v;
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a') && !/_reads$|_seed$|_pick$/.test(n)) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    X.tab = best;
    // from the last chapter (the story's end, or its Explore button): the machine, in the Rule tab
    if (ts >= C.what.a) openStart();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    // the story shows its scenes as it tells them: no picked branch, no read-outs of explore's own
    X.branch = -1; X.reads = 0; NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

// explore mode's start: the machine for one branch as the story left it (the story's rule, a G after 1 swap per letter),
// in the Rule tab
function openStart() {
  openScene('rule', false);
  X.ctl.rule = Object.assign(X.ctl.rule || {}, { view: 'machine', model: M.DEFAULT, parent: LET[FACTS.turn.par] });
  X.time = FACTS.turn.t; X.branch = -1;
  X.tab = 'rule'; showTab('rule');
  orbit.cur = view('rule', viewCam('rule') || 'default'); orbit.to = null;
  renderAll();
}

let lastNow = 0;
const EXV = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0, 1, 0];   // explore's view for applyCamera: orbit.cur, then FIT's and LOW's, eased
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  let S, tSet;
  const t0 = APP.t;
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
  }
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  sfxStep(was, dt);   // sound effects: the cues the clock crossed, the spans it is in, the live sounds
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
    const lo = lowOf(X.scene, vn); EXV[10] += (lo[0] - EXV[10]) * ke; EXV[11] += (lo[1] - EXV[11]) * ke;
    orbitStep(xr ? pn : now);
    for (let i = 0; i < 6; i++) EXV[i] = orbit.cur[i];
    if (xr) xrPlace(orbit.cur); else { applyCamera(EXV); keepCamera(S, null); }
  }
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  // what explore mode asked to do once the sets show its pick
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
// The story builds in steps, each a task of its own (LOAD): the scene, then each set (built, then its shaders compiled
// a slice at a time: warm), what joins the sets, the story, explore mode and the panels. Between the steps the page
// shows how far it is and a headset draws the shell's loading scene (HOST.progress); the next step runs from a timer,
// not an animation frame (the window's frames stop in a headset). A step that returns true runs again. The shared-room
// hooks see the scene only once all of it is built (collab.scene). A failure while the scene is built says that WebGL
// is missing, as before.
const LOAD = { steps: [], i: 0, t: 0, gone: false, done: false, warm: null, seen: new Set(), ms: [] };
function init() {
  const S = LOAD.steps, n = SET_ORDER.length;
  S.push(['Setting up the scene', () => buildScene($('#gl')), true]);
  SET_ORDER.forEach((k, i) => { const l = `Building the scenes: ${i + 1} of ${n}`; S.push([l, () => buildSet(k), true], [l, () => warm(GL.sets[k].group)]); });
  S.push(['Putting the scenes together', sceneJoin, true], ['Putting the scenes together', () => warm(GL.scene)],
    ['Writing the story', () => {
      resize();
      window.addEventListener('resize', resize);
      buildDefaults(); Object.assign(XS, DEF);
      for (const k of SET_ORDER) GL.sets[k].setAlpha(0);
      buildStory(); buildSetLabels(); buildTimeline();
    }],
    ['Setting up explore mode', () => { buildExplore(); bindCanvas(); }],
    ['Making the headset panels', () => { audioInit(); xrSetup(); LOAD.done = true; initEnd(); }]);
  if (HOST.progress) HOST.progress(0, S.length, S[0][0]);
  loadStep();
}
// (short steps run on in one task, as each yield costs a frame; a step left half done, or 40 ms gone, yields)
function loadStep() {
  LOAD.t = 0;
  const t0 = performance.now();
  while (!LOAD.gone && LOAD.i < LOAD.steps.length) {
    const [label, fn, scene] = LOAD.steps[LOAD.i], t1 = performance.now();
    let more = false;
    try { more = fn() === true; } catch (err) {
      if (!scene) throw err;
      console.error(err);
      $('#nogl').style.display = 'grid';
      $('#loading').classList.add('gone');
      return;
    }
    LOAD.ms.push([label, Math.round(performance.now() - t1)]);
    if (!more) LOAD.i++;
    const n = LOAD.steps.length, next = LOAD.steps[LOAD.i];
    if (HOST.progress) HOST.progress(LOAD.i + (LOAD.warm ? LOAD.warm.i / LOAD.warm.list.length : 0), n, next ? next[0] : '');
    if (more || performance.now() - t0 > 40) break;
  }
  if (!LOAD.gone && LOAD.i < LOAD.steps.length) LOAD.t = setTimeout(loadStep, 0);
}
// shaders compiled now, so a set's first appearance does not stall the story: each material once (LOAD.seen), with
// the scene's lights as when it is drawn (renderer.compile on a stand-in scene that holds the lights and one object,
// not its children), until a slice has taken 50 ms; true while some are left
function warm(root) {
  const t0 = performance.now();
  if (!LOAD.warm) {
    const list = [];
    root.traverse(o => {
      const id = o.material && [].concat(o.material).map(m => m.uuid).join() + (o.isInstancedMesh ? 'i' : '') + (o.isSkinnedMesh ? 's' : '');
      if (id && !LOAD.seen.has(id)) { LOAD.seen.add(id); list.push(o); }
    });
    LOAD.warm = { list, i: 0, sc: new THREE.Scene() };
  }
  const W = LOAD.warm, lights = GL.scene.children.filter(o => o.isLight);
  try {
    while (W.i < W.list.length && performance.now() - t0 < 50) {
      const o = W.list[W.i++];
      W.sc.children = lights.concat({ traverse: f => f(o), traverseVisible() {} });
      GL.renderer.compile(W.sc, GL.camera);
    }
  } catch (e) { W.i = W.list.length; /* compiled on first use instead */ }
  W.sc.children = [];
  if (W.i < W.list.length) return true;
  LOAD.warm = null;
  return false;
}
// the rest of the start, the load's last step: the story's listeners, a link's place, the frame loop
function initEnd() {
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
    // #mutation&explore&scene=tree&view=up (a scene; view: an option by its key or name, or a camera of the scene by
    // name), &tab=letters|rule|tree|stem|scenes (picked by hand: its scene comes up), any control by its key (mix=G,
    // model=even, start=C, parent=T, seed=3, speed=2, run=on, src=live, method=coupled; by option or name), &time=0.8
    // (the branch length), &reads=100 (read-outs), &branch=5 (1 to 14), &w=20 (the pair favour), &rebuild=2 (its seed)
    const sc = hp.get('scene'), tb = hp.get('tab'), tabOK = TABS.some(t => t[0] === tb);
    if (sc && GL.sets[sc]) { openScene(sc, false); showTab(tabOK ? tb : 'scenes'); }
    else if (tabOK) { pickTab(tb); if (tb === 'letters' && !hp.get('view')) showView('letters', 'qubits'); }   // (the Letters tab is about the qubits)
    else if (!hp.has('t')) openStart();   // straight in: the machine
    // (a start letter asks for the path, a parent letter for the machine, unless a view is given)
    if (!hp.get('view') && X.scene === 'rule' && hp.get('start')) setCtl('rule', 'view', 'path');
    if (!hp.get('view') && X.scene === 'rule' && hp.get('parent') && !machineOn()) setCtl('rule', 'view', 'machine');
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    // every scene's controls but the view by their keys (no two scenes share one), then the view of the scene on show
    const opt = (k, c, q) => c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q || camFor(k, v) === q || (CAM_ALIAS[k] || {})[v] === q);
    for (const [k] of SCENES) for (const c of ctlsOf(k)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.key !== 'view' && opt(k, c, q);
      if (o) { if (k === X.scene) setCtl(k, c.key, o[0]); else (X.ctl[k] = X.ctl[k] || {})[c.key] = o[0]; }
    }
    const vq = String(hp.get('view') || '').toLowerCase(), vc = ctlOf(X.scene, 'view'), vo = vq && vc && opt(X.scene, vc, vq);
    if (vo) setCtl(X.scene, 'view', vo[0]);
    else if (vq && (GL.sets[X.scene].cam || {})[vq]) { orbit.cur = view(X.scene, vq); orbit.to = null; }   // a camera of its own (the tree's up, stand)
    if (hp.get('time') && Number.isFinite(+hp.get('time'))) setTime(+hp.get('time'), false);
    if (hp.get('reads') && Number.isFinite(+hp.get('reads'))) X.reads = clamp(Math.round(+hp.get('reads')), 0, READ_MAX());
    if (hp.get('branch') && Number.isFinite(+hp.get('branch'))) selectBranch(Math.round(+hp.get('branch')) - 1, false);
    if (hp.get('w') && Number.isFinite(+hp.get('w'))) setW(+hp.get('w'), !hp.get('src'));
    if (hp.get('rebuild') && Number.isFinite(+hp.get('rebuild'))) X.sseed = clamp(Math.round(+hp.get('rebuild')), 1, 999);
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
    renderAll();
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  LOAD.t = setTimeout(() => $('#loading').classList.add('gone'), 120);   // (dispose clears it: a story picked meanwhile keeps its loading screen)
}
LOAD.t = setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the explore panes, and there are no effects
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    LOAD.gone = true; clearTimeout(LOAD.t); clearTimeout(xrMsg.t);
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
