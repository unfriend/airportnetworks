// Protein crowds: up to a million balls in a cube, drawn two ways and culled four ways, with a read-out of what it costs.
// The balls: a made-up cloud (seeded, the same on every device) or the crowd of Back into the cell (packages/ppicell:
// PPI_STRUCTS' coarse balls of ubiquitin, calmodulin, actin, GAPDH and tubulin, CROWD's kinds, shares and colours),
// packed as crowd.js packs its cube but wrapping round the faces, so that copies of the one packed cube (each turned
// one of the cube's 24 ways) fill a bigger cube without a seam. Drawn as sphere impostors (one point each, a lit sphere
// with its true depth, as crowd.js draws them) or as instanced low-poly spheres (three levels of detail); both read the
// same balls, sorted into a grid of cells, each cell a contiguous range, so a draw is a run of cells. Culling (each a
// switch): cells out of view, detail by distance (far balls cheaper, sub-pixel ones thinned and the rest enlarged),
// front-to-back order, and cells hidden behind full ones (sets/cull.js). Everything is built in slices between frames,
// and sent to the graphics card a piece a frame.
const CROWDS = (() => {
  const KINDS = CROWD.KINDS, SIDE = CROWD.SIDE, HALF = SIDE / 2, TOL = 0.9;   // (TOL: how far two balls may overlap, as crowd.js)
  const maxR = Math.max(...KINDS.flatMap(k => k.balls.map(b => b[3]))), NG = Math.max(3, Math.floor(SIDE / (2 * maxR))), CW = SIDE / NG;
  const rnd = (s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(31);
  // the tile: molecules (kind, middle) and their balls (offsets from the middle, already turned, and radius)
  const T = { done: false, ki: 0, n: 0, tries: 0, mk: [], mc: [], m0: [0], bo: [], wx: [], grid: Array.from({ length: NG * NG * NG }, () => []) };
  const wrap = v => v - SIDE * Math.floor((v + HALF) / SIDE);
  const gi = v => Math.min(NG - 1, Math.floor((wrap(v) + HALF) / CW));
  const near = d => d - SIDE * Math.round(d / SIDE);
  function fits(pts) {
    for (const [x, y, z, r] of pts) {
      const a = gi(x), b = gi(y), c = gi(z);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        const cell = T.grid[(a + dx + NG) % NG + NG * ((b + dy + NG) % NG + NG * ((c + dz + NG) % NG))];
        for (const j of cell) {
          const W = T.wx;
          if (Math.hypot(near(W[4 * j] - x), near(W[4 * j + 1] - y), near(W[4 * j + 2] - z)) < TOL * (W[4 * j + 3] + r)) return false;
        }
      }
    }
    return true;
  }
  const Q = new THREE.Quaternion(), V = new THREE.Vector3(), E = new THREE.Euler();
  // a slice of the packing (ms milliseconds): each molecule a random spot and turn, kept where none of its balls comes
  // too near another's (round the faces too); a kind stops at its share (CROWD's want) or after many misses in a row
  function pack(ms) {
    const t0 = performance.now();
    while (!T.done && performance.now() - t0 < ms) {
      const k = KINDS[T.ki];
      if (!k) { T.done = true; break; }
      if (T.n >= k.want || T.tries > 400) { T.ki++; T.n = 0; T.tries = 0; continue; }
      const c = [0, 1, 2].map(() => (rnd() * 2 - 1) * HALF);
      Q.setFromEuler(E.set(rnd() * 6.283, rnd() * 6.283, rnd() * 6.283));
      const off = k.balls.map(b => { V.set(b[0], b[1], b[2]).applyQuaternion(Q); return [V.x, V.y, V.z, b[3]]; });
      const pts = off.map(o => [c[0] + o[0], c[1] + o[1], c[2] + o[2], o[3]]);
      if (!fits(pts)) { T.tries++; continue; }
      T.tries = 0; T.n++;
      T.mk.push(T.ki); T.mc.push(...c);
      for (let i = 0; i < pts.length; i++) {
        const j = T.wx.length / 4, p = pts[i];
        T.wx.push(wrap(p[0]), wrap(p[1]), wrap(p[2]), p[3]); T.bo.push(...off[i]);
        T.grid[gi(p[0]) + NG * (gi(p[1]) + NG * gi(p[2]))].push(j);
      }
      T.m0.push(T.bo.length / 4);
    }
    if (T.done && T.grid) { T.grid = null; T.wx = null; T.nb = T.bo.length / 4; T.nm = T.mk.length; T.bo = new Float32Array(T.bo); T.mc = new Float32Array(T.mc); }
    return T.done;
  }
  // the cube's 24 turns, as matrices of -1, 0 and 1 (rows): every signed permutation of the axes that keeps handedness
  const ROTS = [];
  for (const p of [[0, 1, 2], [1, 2, 0], [2, 0, 1], [0, 2, 1], [2, 1, 0], [1, 0, 2]]) for (let s = 0; s < 8; s++) {
    const sg = [s & 1 ? -1 : 1, s & 2 ? -1 : 1, s & 4 ? -1 : 1], odd = p[0] === 0 ? p[1] !== 1 : p[0] === 1 ? p[1] !== 2 : p[1] !== 0;
    if ((sg[0] * sg[1] * sg[2] < 0) !== odd) continue;
    ROTS.push(p.map((a, r) => { const row = [0, 0, 0]; row[a] = sg[r]; return row; }));
  }
  // each kind's shadow share (sets/cull.js): the mean area its molecule hides, seen from 32 directions (its balls' discs
  // drawn on a fine grid across each), over the sum of its balls' discs. A molecule's balls overlap one another, so it
  // hides less than their discs add up to, and an opacity counting discs would call a packed crowd deeper than it is.
  // shadowOf(k, d): the area seen from direction d (0 to ND - 1), a slice of the build each
  const SHADOW = [], ND = 32;
  const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2], cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
  function shadowOf(k, d) {
    const B = k.balls, reach = Math.max(...B.map(b => Math.hypot(b[0], b[1], b[2]) + b[3]));
    const px = Math.min(...B.map(b => b[3])) / 6, M = Math.ceil(2 * reach / px) + 2, hit = new Uint8Array(M * M);
    const z = 1 - 2 * (d + 0.5) / ND, s = Math.sqrt(1 - z * z), a = d * 2.399963, n = [s * Math.cos(a), s * Math.sin(a), z];
    let u = cross(n, Math.abs(n[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0]);
    const ul = Math.hypot(u[0], u[1], u[2]); u = [u[0] / ul, u[1] / ul, u[2] / ul];
    const v = cross(n, u);
    let c = 0;
    for (const b of B) {
      const x = dot(b, u) + reach, y = dot(b, v) + reach, r = b[3], r2 = r * r;
      for (let j = Math.max(0, Math.floor((y - r) / px)); j <= Math.min(M - 1, Math.ceil((y + r) / px)); j++) {
        const dy = (j + 0.5) * px - y;
        for (let i = Math.max(0, Math.floor((x - r) / px)); i <= Math.min(M - 1, Math.ceil((x + r) / px)); i++) {
          const q = i + M * j, dx = (i + 0.5) * px - x;
          if (!hit[q] && dx * dx + dy * dy <= r2) { hit[q] = 1; c++; }
        }
      }
    }
    return c * px * px;
  }
  // ------------------------------------------------------------ the balls, built in slices
  // build(K, n, what, seed): a generator that yields after every small piece of work (a few hundred balls; the caller
  // stops at the frame's build budget); its result R holds every ball sorted by cell: P (x, y, z, r; floats), C (r, g,
  // b, ambient occlusion; bytes), E (cell number low, high, phase, kind; bytes), each 4 a ball and W * rows long (the
  // mesh's textures), and the grid: G cells a side, each cell's start, count, middle, reach, mean radius, and its
  // opacity (sets/cull.js) eroded. D: the cube's side in the scene, whatever it holds (more balls, smaller ones)
  const D = 1.2, HD = D / 2, W = 2048, KC = KINDS.map(k => k.c), SHARE = KINDS.map(k => k.share);
  function* build(K, n, what, seed) {
    const t0 = performance.now(), r = K.rng(seed), clamp = K.clamp;
    let N = 0, P, KD, PH, w = 0;
    if (what === 1) {
      while (SHADOW.length < KINDS.length) {
        const k = KINDS[SHADOW.length];
        let area = 0;
        for (let d = 0; d < ND; d++) { area += shadowOf(k, d); yield; }
        SHADOW.push(area / ND / k.balls.reduce((s, b) => s + Math.PI * b[3] * b[3], 0));
      }
      // the packed crowd: copies of the tile, each turned, cropped to a cube holding about n balls, scaled to D
      const S = SIDE, H = HALF, s = S * Math.cbrt(n / T.nb), h = s / 2, sc = D / s, A = Math.ceil(h / S + 0.5);
      const keep = [], m = [0, 0, 0];
      for (let a = -A; a <= A; a++) for (let b = -A; b <= A; b++) for (let c = -A; c <= A; c++) {
        if (Math.abs(a * S) - H > h || Math.abs(b * S) - H > h || Math.abs(c * S) - H > h) continue;
        const R3 = ROTS[Math.floor(K.rng(7 + (a + 50) * 10007 + (b + 50) * 101 + (c + 50))() * 24)];
        for (let i = 0; i < T.nm; i++) {
          for (let q = 0; q < 3; q++) m[q] = R3[q][0] * T.mc[3 * i] + R3[q][1] * T.mc[3 * i + 1] + R3[q][2] * T.mc[3 * i + 2];
          const x = a * S + m[0], y = b * S + m[1], z = c * S + m[2];
          if (Math.abs(x) < h && Math.abs(y) < h && Math.abs(z) < h) keep.push(i, x, y, z, R3);
          if ((++w & 511) === 0) yield;
        }
      }
      for (let i = 0; i < keep.length; i += 5) { N += T.m0[keep[i] + 1] - T.m0[keep[i]]; if ((++w & 16383) === 0) yield; }
      yield;
      P = new Float32Array(4 * N); KD = new Uint8Array(N); PH = new Uint8Array(N);
      yield;
      let j = 0;
      for (let i = 0; i < keep.length; i += 5) {
        const mi = keep[i], R3 = keep[i + 4], ph = Math.floor(r() * 256);
        for (let b = T.m0[mi]; b < T.m0[mi + 1]; b++) {
          const ox = T.bo[4 * b], oy = T.bo[4 * b + 1], oz = T.bo[4 * b + 2];
          for (let q = 0; q < 3; q++) P[4 * j + q] = clamp((keep[i + 1 + q] + R3[q][0] * ox + R3[q][1] * oy + R3[q][2] * oz) * sc, -HD, HD);
          P[4 * j + 3] = T.bo[4 * b + 3] * sc; KD[j] = T.mk[mi]; PH[j] = ph; j++;
        }
        if (((w += T.m0[mi + 1] - T.m0[mi]) & ~511) !== 0) { w = 0; yield; }   // (every 512 balls or so)
      }
    } else {
      // the cloud: n balls at random in the cube, a fifth of it filled (they may overlap), kinds by CROWD's shares
      N = n; P = new Float32Array(4 * N); KD = new Uint8Array(N); PH = new Uint8Array(N);
      yield;
      const r0 = D * Math.cbrt(0.2 / (N * 4.18879 * 1.09)), cum = SHARE.map((s, i) => SHARE.slice(0, i + 1).reduce((a, b) => a + b, 0));
      for (let i = 0; i < N; i++) {
        P[4 * i] = (r() - 0.5) * D; P[4 * i + 1] = (r() - 0.5) * D; P[4 * i + 2] = (r() - 0.5) * D; P[4 * i + 3] = r0 * (0.7 + 0.6 * r());
        const u = r() * cum[cum.length - 1];
        let k = 0;
        while (k < cum.length - 1 && u > cum[k]) k++;
        KD[i] = k; PH[i] = Math.floor(r() * 256);
        if ((i & 511) === 511) yield;
      }
    }
    // the grid: about 1,500 balls a cell, 2 to 10 cells a side
    const G = clamp(Math.round(Math.cbrt(N / 1500)), 2, 10), NC = G * G * G, h = D / G, cellOf = new Uint16Array(N), count = new Uint32Array(NC);
    // (a ball's cell on one axis: clamped both ways, since a ball clamped to the cube's side lies a float's rounding
    // outside it, and -1 would be the row before's far cell)
    const ix = (v, n, s) => Math.max(0, Math.min(n - 1, Math.floor((v + HD) / s)));
    let rSum = 0;
    for (let i = 0; i < N; i++) {
      const c = ix(P[4 * i], G, h) + G * (ix(P[4 * i + 1], G, h) + G * ix(P[4 * i + 2], G, h));
      cellOf[i] = c; count[c]++; rSum += P[4 * i + 3];
      if ((i & 1023) === 1023) yield;
    }
    // ambient occlusion: how crowded each ball's neighbourhood is (a fine grid's counts, smoothed over 3 x 3 x 3), from
    // light at the cube's skin to dark deep inside
    const rm = rSum / Math.max(1, N), FG = clamp(Math.round(D / (3 * rm)), 4, 96), fh = D / FG, fc = new Float32Array(FG ** 3), fi = new Uint32Array(N);
    yield;
    for (let i = 0; i < N; i++) {
      const c = ix(P[4 * i], FG, fh) + FG * (ix(P[4 * i + 1], FG, fh) + FG * ix(P[4 * i + 2], FG, fh));
      fi[i] = c; fc[c]++;
      if ((i & 1023) === 1023) yield;
    }
    const src = new Float32Array(fc.length);
    yield;
    for (let ax = 0, st = 1; ax < 3; ax++, st *= FG) {
      src.set(fc);
      yield;
      for (let c = 0; c < fc.length; c++) {
        const q = Math.floor(c / st) % FG;
        fc[c] = src[c] + (q > 0 ? src[c - st] : 0) + (q < FG - 1 ? src[c + st] : 0);
        if ((c & 4095) === 4095) yield;
      }
    }
    const ref = 27 * N / FG ** 3;
    // sorted by cell, each cell's balls in a random order (so the first m of a cell are a fair sample of it: thinning)
    const start = new Uint32Array(NC + 1);
    for (let c = 0; c < NC; c++) start[c + 1] = start[c] + count[c];
    const fill = start.slice(0, NC), perm = new Uint32Array(N);
    yield;
    for (let i = 0; i < N; i++) { perm[fill[cellOf[i]]++] = i; if ((i & 4095) === 4095) yield; }
    for (let c = 0; c < NC; c++) {
      for (let j = start[c + 1] - 1; j > start[c]; j--) {
        const q = start[c] + Math.floor(r() * (j - start[c] + 1)), t = perm[j]; perm[j] = perm[q]; perm[q] = t;
        if ((++w & 2047) === 0) yield;
      }
    }
    const rows = Math.max(1, Math.ceil(N / W)), Pz = new Float32Array(4 * W * rows);
    yield;
    const C = new Uint8Array(4 * W * rows), Ez = new Uint8Array(4 * W * rows);
    yield;
    for (let j = 0; j < N; j++) {
      const i = perm[j], c = cellOf[i], k = KD[i], col = KC[k];
      Pz[4 * j] = P[4 * i]; Pz[4 * j + 1] = P[4 * i + 1]; Pz[4 * j + 2] = P[4 * i + 2]; Pz[4 * j + 3] = P[4 * i + 3];
      C[4 * j] = col[0] * 255; C[4 * j + 1] = col[1] * 255; C[4 * j + 2] = col[2] * 255;
      C[4 * j + 3] = Math.round(255 * clamp(fc[fi[i]] / ref, 0, 1.25) / 1.25);
      Ez[4 * j] = c & 255; Ez[4 * j + 1] = c >> 8; Ez[4 * j + 2] = PH[i]; Ez[4 * j + 3] = k;
      if ((j & 511) === 511) yield;
    }
    // each cell: its balls' middles' box, the reach beyond it, the mean radius and the opacity at size 1 (each ball's
    // disc times its kind's shadow share: the packed crowd's molecules, sets/cull.js)
    const cen = new Float32Array(3 * NC), rad = new Float32Array(NC), rMean = new Float32Array(NC), rMax = new Float32Array(NC), op = new Float32Array(NC);
    const sh = what === 1 ? SHADOW : KINDS.map(() => 1), lo = [0, 0, 0], hi = [0, 0, 0];
    let maxR = 0;
    for (let c = 0; c < NC; c++) {
      lo[0] = lo[1] = lo[2] = Infinity; hi[0] = hi[1] = hi[2] = -Infinity;
      let rs = 0, r2 = 0, rx = 0;
      for (let j = start[c]; j < start[c + 1]; j++) {
        for (let q = 0; q < 3; q++) { const v = Pz[4 * j + q]; if (v < lo[q]) lo[q] = v; if (v > hi[q]) hi[q] = v; }
        const rr = Pz[4 * j + 3]; rs += rr; r2 += rr * rr * sh[Ez[4 * j + 3]]; if (rr > rx) rx = rr;
        if ((++w & 2047) === 0) yield;
      }
      const m = count[c];
      if (!m) continue;
      for (let q = 0; q < 3; q++) cen[3 * c + q] = (lo[q] + hi[q]) / 2;
      rad[c] = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2; rMean[c] = rs / m; rMax[c] = rx; maxR = Math.max(maxR, rx);
      op[c] = Math.PI * r2 / (h * h);
    }
    const kinds = KC.map(() => 0);
    for (let i = 0; i < N; i++) { kinds[KD[i]]++; if ((i & 16383) === 16383) yield; }
    return { n: N, what, P: Pz, C, E: Ez, rows, G, NC, h, start, count, cen, rad, rMean, rMax, maxR, opE: CULL.erode(op, G), kinds,
      mols: what === 1 ? Math.round(N / (T.nb / T.nm)) : N, ms: Math.round(performance.now() - t0) };
  }
  return { T, pack, ROTS, KINDS, SIDE, HALF, SHADOW, shadowOf, build, D, W };
})();

SETS.crowds = function (K) {
  const { THREE, clamp } = K;
  const set = K.newSet('crowds');
  const D = CROWDS.D, HD = D / 2;   // (the cube's side in the scene, whatever it holds: more balls, smaller ones)
  const holder = new THREE.Group();
  set.group.add(holder);
  // the cube's edges
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(D, D, D)), K.fade(set, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true }), 0.45));
  holder.add(edges);
  const W = CROWDS.W;   // (the textures' width: a ball's place in them is its number, row after row)
  const isGL2 = () => !!(GL.renderer && GL.renderer.capabilities.isWebGL2);
  // what this graphics card allows, read once: the largest point (ALIASED_POINT_SIZE_RANGE, often 1,023 pixels; a
  // bigger one would be drawn at that size, its ball shrunk), writing a point's depth (gl_FragDepth: WebGL 2, or WebGL
  // 1's EXT_frag_depth) and instancing without textures (WebGL 2, or ANGLE_instanced_arrays)
  const CAP = { read: false, pt: 256, dev: 256, fd: true, inst: true };
  function caps() {
    if (CAP.read || !GL.renderer) return CAP;
    const r = GL.renderer, gl = r.getContext(), gl2 = isGL2();
    let range = null;
    try { range = gl.getParameter(gl.ALIASED_POINT_SIZE_RANGE); } catch (e) { /* none */ }
    CAP.dev = CAP.pt = range && range[1] > 0 ? range[1] : 64;
    CAP.fd = gl2 || r.extensions.has('EXT_frag_depth');
    CAP.inst = gl2 || r.extensions.has('ANGLE_instanced_arrays');
    CAP.read = true;
    return CAP;
  }
  // (the build's yields: things to keep for the story's dispose, which frees every geometry and texture it finds in the
  // scene: a kept geometry or texture hangs on an empty object in the holder until it is let go)
  function keep(g, tex) {
    const o = new THREE.Object3D();
    o.visible = false;
    if (g) o.geometry = g;
    if (tex) o.geometry = { dispose: () => tex.dispose() };   // (a texture, freed as a geometry would be: no material to compile)
    holder.add(o);
    return o;
  }
  function letGo(o) { if (!o) return; holder.remove(o); if (o.geometry) o.geometry.dispose(); }

  // ------------------------------------------------------------ drawing: shaders
  // shared uniforms; each draw (a slot) adds its own: uK (the thinned balls' enlargement), uLodC (its detail's colour,
  // for Colour by detail) and, for the meshes, uBase (its first ball). uEyeA, uEyeB, uCapK2: the impostors leave out
  // every ball nearer an eye than sqrt(uCapK2) times its radius (drawn as meshes instead: a point that big would pass
  // the card's limit)
  const SU = { uA: set.uA, uT: { value: 0 }, uHalf: { value: 400 }, uSize: { value: 1 }, uJig: { value: 0.12 }, uAo: { value: 1 }, uColBy: { value: 0 },
    uShade: { value: 0 }, uPos: { value: null }, uColT: { value: null }, uExtT: { value: null }, uW: { value: W }, uPtMax: { value: 256 },
    uEyeA: { value: new THREE.Vector3() }, uEyeB: { value: new THREE.Vector3() }, uCapK2: { value: 0 } };
  // a ball's colour (by kind, by cell or by detail) and its ambient shade; its jiggle (as crowd.js's, a share of its radius)
  const VCOMMON = `
uniform float uT, uHalf, uSize, uK, uJig, uAo, uColBy; uniform vec3 uLodC;
varying vec3 vC;
vec3 hue(float h) { return clamp(abs(mod(h * 6.0 + vec3(0.0, 4.0, 2.0), 6.0) - 3.0) - 1.0, 0.0, 1.0); }
vec3 ballCol(vec4 col, vec4 ext) {
  float cell = ext.x + 256.0 * ext.y;
  vec3 c = uColBy < 0.5 ? col.rgb : uColBy < 1.5 ? mix(vec3(0.55), hue(fract(cell * 0.6180339)), 0.65) : uLodC;
  return c * mix(1.0, 1.0 - 0.6 * col.a, uAo);
}
vec3 jig(float ph, float r) { ph *= 0.0246; return uJig * r * vec3(sin(uT * 1.7 + ph), sin(uT * 1.3 + ph * 2.1), sin(uT * 1.9 + ph * 0.7)); }`;
  // the shading of a ball's point at normal n (view space): lit (a key light, a little shine and rim), flat (its colour
  // alone) or outline (flat, ringed in dark at its edge: d is how near the edge, 0 middle to 1 edge)
  const FSHADE = `
uniform float uShade, uA;
vec3 shade(vec3 c, vec3 n, float d) {
  if (uShade > 1.5) return c * (d > 0.78 ? 0.16 : 1.0);
  if (uShade > 0.5) return c;
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float diff = max(dot(n, L), 0.0), spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0), rim = pow(1.0 - n.z, 2.0);
  return c * (0.42 + 0.62 * diff) * (0.78 + 0.22 * n.z) + 0.22 * spec + 0.18 * rim * c;
}`;
  // the impostor: a point as big as the ball on screen. Near (true depth): its round face shaded and its depth written
  // where the sphere's surface is (gl_FragDepth: the graphics card can no longer reject hidden pixels before shading
  // them). Far: the same face, its depth the ball's front (no gl_FragDepth, so early depth rejection still works). A ball
  // within sqrt(uCapK2) radii of an eye is left out (its mesh is drawn); a point is never bigger than uPtMax (the card's
  // limit: a ball drawn smaller then, its depth too)
  const ptsV = near => `${VCOMMON}
uniform float uPtMax, uCapK2; uniform vec3 uEyeA, uEyeB;
attribute float aRad; attribute vec4 aCol, aExt;
varying vec3 vP; varying float vR;
void main() {
  vec3 qa = position - uEyeA, qb = position - uEyeB;
  if (min(dot(qa, qa), dot(qb, qb)) < uCapK2 * aRad * aRad * uSize * uSize) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; vC = vec3(0.0); vP = vec3(0.0); vR = 0.0; return; }
  float r = aRad * uSize * uK;
  vec4 mv = modelViewMatrix * vec4(position + jig(aExt.z, aRad * uSize), 1.0);
  float rr = r * length(modelViewMatrix[0].xyz);
  ${near ? '' : 'mv.z += rr;'}
  gl_Position = projectionMatrix * mv;
  float px = 2.0 * rr * projectionMatrix[1][1] * uHalf / max(-mv.z, 0.001);
  gl_PointSize = clamp(px, 1.0, uPtMax);
  vC = ballCol(aCol, aExt); vP = mv.xyz; vR = rr * min(1.0, uPtMax / max(px, 1.0));
}`;
  const ptsF = near => `${FSHADE}
uniform mat4 projectionMatrix;   // (three.js declares it only in the vertex shader)
varying vec3 vC, vP; varying float vR;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0; c.y = -c.y;
  float d2 = dot(c, c);
  if (d2 > 1.0) discard;
  vec3 n = vec3(c, sqrt(1.0 - d2));
  ${near ? 'vec4 clip = projectionMatrix * vec4(vP + n * vR, 1.0); gl_FragDepthEXT = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);' : ''}
  gl_FragColor = vec4(shade(vC, n, d2), uA);
}`;
  // the mesh: a low-poly sphere drawn once a ball (instanced); a ball's place, colour and phase read from textures by its
  // number (uBase + gl_InstanceID: WebGL 2), so a draw of any run of balls needs no buffers of its own. The very near
  // impostors' meshes read theirs from attributes of their own instead (meshNearV: any WebGL)
  const MESHB = `
  float r = P.w * uSize * uK;
  vec4 mv = modelViewMatrix * vec4(P.xyz + jig(ext.z, P.w * uSize) + position * r, 1.0);
  vN = normalize(normalMatrix * position);
  gl_Position = projectionMatrix * mv;
  vC = ballCol(col, ext);`;
  const meshV = `${VCOMMON}
uniform highp sampler2D uPos, uColT, uExtT; uniform int uBase, uW;
varying vec3 vN;
void main() {
  int id = uBase + gl_InstanceID;
  ivec2 uv = ivec2(id % uW, id / uW);
  vec4 P = texelFetch(uPos, uv, 0), col = texelFetch(uColT, uv, 0), ext = texelFetch(uExtT, uv, 0) * 255.0;${MESHB}
}`;
  const meshNearV = `${VCOMMON}
attribute vec4 iP, iC, iE;
varying vec3 vN;
void main() {
  vec4 P = iP, col = iC, ext = iE;${MESHB}
}`;
  const meshF = `${FSHADE}
varying vec3 vC, vN;
void main() {
  vec3 n = normalize(vN);
  gl_FragColor = vec4(shade(vC, n, 1.0 - n.z * n.z), uA);
}`;
  // an icosphere with its corners shared (an index): detail 0, 1, 2 -> 20, 80, 320 triangles
  function ico(detail) {
    const t = (1 + Math.sqrt(5)) / 2, v = [[-1, t, 0], [1, t, 0], [-1, -t, 0], [1, -t, 0], [0, -1, t], [0, 1, t], [0, -1, -t], [0, 1, -t], [t, 0, -1], [t, 0, 1], [-t, 0, -1], [-t, 0, 1]].map(p => K.v3.norm(p));
    let f = [[0, 11, 5], [0, 5, 1], [0, 1, 7], [0, 7, 10], [0, 10, 11], [1, 5, 9], [5, 11, 4], [11, 10, 2], [10, 7, 6], [7, 1, 8], [3, 9, 4], [3, 4, 2], [3, 2, 6], [3, 6, 8], [3, 8, 9], [4, 9, 5], [2, 4, 11], [6, 2, 10], [8, 6, 7], [9, 8, 1]];
    for (let d = 0; d < detail; d++) {
      const mid = new Map(), m = (a, b) => { const k = a < b ? a + ',' + b : b + ',' + a; if (!mid.has(k)) { mid.set(k, v.length); v.push(K.v3.norm(K.v3.lerp(v[a], v[b], 0.5))); } return mid.get(k); };
      f = f.flatMap(([a, b, c]) => { const ab = m(a, b), bc = m(b, c), ca = m(c, a); return [[a, ab, ca], [b, bc, ab], [c, ca, bc], [ab, bc, ca]]; });
    }
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(v.flat(), 3));
    g.setIndex(f.flat());
    g.instanceCount = 0;
    g._maxInstanceCount = Infinity;   // (three.js r128 takes the count from an instanced attribute; these have none)
    g.tris = f.length;
    return g;
  }
  const LOD_COL = [[0.27, 0.85, 1.0], [1.0, 0.72, 0.25], [1.0, 0.36, 0.85]], THIN_COL = [1.0, 0.42, 0.36];
  // the draws: pools of slots, one pool per way and detail (impostor near, far; mesh 320, 80, 20 triangles), each slot an
  // object sharing its pool's geometry (an impostor slot: the piece of the balls its run lies in), its own material
  // (the same program), drawing one run of cells. The meshes' spheres are made once; the balls' buffers (impostors: a
  // geometry a piece of CH balls) or textures (meshes) come with each crowd
  const CH = 1 << 17;
  const GPU = { R: null, mode: -1, chunks: null, tex: null, keep: [], next: null, pools: [[], [], [], [], []] };
  const MESH = [ico(2), ico(1), ico(0)];
  MESH.forEach(g => keep(g));
  const POOL_LOD = [0, 1, 0, 1, 2];   // (a pool's detail level, for its colour)
  function slot(pool) {
    const own = { uK: { value: 1 }, uLodC: { value: new THREE.Vector3(...LOD_COL[POOL_LOD[pool]]) }, uBase: { value: 0 } };
    const mesh = pool >= 2, near = pool === 0 && caps().fd;
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({}, SU, own), vertexShader: mesh ? meshV : ptsV(near), fragmentShader: mesh ? meshF : ptsF(near),
      extensions: { fragDepth: near } });
    // (see-through only while the set fades, and then writing no depth, as crowd.js's balls)
    Object.defineProperty(m, 'transparent', { configurable: true, get: () => set.uA.value < 0.999, set() {} });
    Object.defineProperty(m, 'depthWrite', { configurable: true, get: () => set.uA.value >= 0.999, set() {} });
    const geo = mesh ? MESH[pool - 2] : GPU.chunks[0];
    const o = mesh ? new THREE.Mesh(geo, m) : new THREE.Points(geo, m);
    o.frustumCulled = false; o.visible = false; o.userData = { s: 0, n: 0, own };
    // (its run, set just before it is drawn: the geometry is shared by the pool)
    o.onBeforeRender = function (r, sc, cam, g) { if (g.isInstancedBufferGeometry) g.instanceCount = this.userData.n; else { g.drawRange.start = this.userData.s; g.drawRange.count = this.userData.n; } };
    holder.add(o);
    GPU.pools[pool].push(o);
    return o;
  }
  // the very near balls of the impostors, as meshes of 320 triangles: their balls copied each frame into attributes of
  // their own (a few hundred at most: those nearer an eye than a point can be drawn big), grown when they do not fit
  const NEAR = { cap: 0, g: null, o: null, k: null, n: 0 }, NEAR_AT = ['iP', 'iC', 'iE'];
  function nearGrow(cap) {
    if (NEAR.k) letGo(NEAR.k);
    const g = new THREE.InstancedBufferGeometry(), src = MESH[0];
    g.setAttribute('position', src.attributes.position.clone()); g.setIndex(src.index.clone());   // (its own copies: letting it go frees its buffers)
    const at = (a, norm) => new THREE.InstancedBufferAttribute(a, 4, norm).setUsage(THREE.DynamicDrawUsage);
    g.setAttribute('iP', at(new Float32Array(4 * cap), false)); g.setAttribute('iC', at(new Uint8Array(4 * cap), true)); g.setAttribute('iE', at(new Uint8Array(4 * cap), false));
    g.instanceCount = 0;
    NEAR.cap = cap; NEAR.g = g; NEAR.k = keep(g);
    if (!NEAR.o) {
      const own = { uK: { value: 1 }, uLodC: { value: new THREE.Vector3(...LOD_COL[0]) }, uBase: { value: 0 } };
      const m = new THREE.ShaderMaterial({ uniforms: Object.assign({}, SU, own), vertexShader: meshNearV, fragmentShader: meshF });
      Object.defineProperty(m, 'transparent', { configurable: true, get: () => set.uA.value < 0.999, set() {} });
      Object.defineProperty(m, 'depthWrite', { configurable: true, get: () => set.uA.value >= 0.999, set() {} });
      NEAR.o = new THREE.Mesh(g, m);
      NEAR.o.frustumCulled = false; NEAR.o.visible = false;
      holder.add(NEAR.o);
    }
    NEAR.o.geometry = g;
  }

  // ------------------------------------------------------------ the balls sent to the graphics card, a piece a frame
  // A built crowd, or a change between impostors and meshes, makes the new way's buffers (impostors: a geometry a piece
  // of CH balls, 3 MB) or textures (meshes: three), then sends one of them to the card each frame (a piece's buffers by
  // drawing none of its points, unseen, into a 1 x 1 target, as the engine's prime does; a texture by initTexture); the
  // old crowd is drawn until the last is up, then let go. (The meshes' float texture is one piece: 16 MB at a million.)
  const PR = { sc: null, cam: null, rt: null, o: null };
  function prime(x) {
    const r = GL.renderer;
    if (x.isTexture) { r.initTexture(x); return; }
    if (!PR.sc) {
      PR.sc = new THREE.Scene(); PR.cam = new THREE.PerspectiveCamera(); PR.rt = new THREE.WebGLRenderTarget(1, 1);
      PR.o = new THREE.Points(x, new THREE.ShaderMaterial({ vertexShader: 'void main() { gl_Position = vec4(position, 1.0); }', fragmentShader: 'void main() { gl_FragColor = vec4(0.0); }' }));
      PR.o.frustumCulled = false; PR.sc.add(PR.o);
    }
    PR.o.geometry = x;
    const was = r.getRenderTarget(), xr = r.xr.enabled, ac = r.autoClear;
    r.xr.enabled = false; r.autoClear = false;
    try { r.setRenderTarget(PR.rt); r.render(PR.sc, PR.cam); } finally { r.setRenderTarget(was); r.xr.enabled = xr; r.autoClear = ac; }
  }
  function stage(R, mode) {
    const old = GPU.next;
    if (old) old.keep.forEach(letGo);
    const nx = { R, mode, chunks: null, tex: null, keep: [], q: [] };
    if (mode === 0) {
      nx.chunks = [];
      for (let a = 0; a < R.n; a += CH) {
        const b = Math.min(R.n, a + CH), g = new THREE.BufferGeometry(), ib = new THREE.InterleavedBuffer(R.P.subarray(4 * a, 4 * b), 4);
        g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0)); g.setAttribute('aRad', new THREE.InterleavedBufferAttribute(ib, 1, 3));
        g.setAttribute('aCol', new THREE.BufferAttribute(R.C.subarray(4 * a, 4 * b), 4, true)); g.setAttribute('aExt', new THREE.BufferAttribute(R.E.subarray(4 * a, 4 * b), 4, false));
        g.setDrawRange(0, 0);
        nx.chunks.push(g); nx.keep.push(keep(g)); nx.q.push(g);
      }
    } else {
      const tex = (a, type) => { const t = new THREE.DataTexture(a, W, R.rows, THREE.RGBAFormat, type); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
      nx.tex = [tex(R.P, THREE.FloatType), tex(R.C, THREE.UnsignedByteType), tex(R.E, THREE.UnsignedByteType)];
      nx.tex.forEach(t => { nx.keep.push(keep(null, t)); nx.q.push(t); });
    }
    GPU.next = nx;
  }
  // one piece a frame; the last one up, the new crowd takes over (the old one's let go, the slots reused)
  function stageStep() {
    const nx = GPU.next;
    if (!nx) return;
    if (nx.q.length) { try { prime(nx.q.shift()); } catch (e) { console.warn('crowds: sending to the card', e); nx.q.length = 0; } if (nx.q.length) return; }
    GPU.keep.forEach(letGo);
    Object.assign(GPU, { R: nx.R, mode: nx.mode, chunks: nx.chunks, tex: nx.tex, keep: nx.keep, next: null });
    if (nx.tex) [SU.uPos.value, SU.uColT.value, SU.uExtT.value] = nx.tex;
    else SU.uPos.value = SU.uColT.value = SU.uExtT.value = null;
    for (const p of GPU.pools) for (const o of p) { o.visible = false; if (o.isPoints && nx.chunks) o.geometry = nx.chunks[0]; }
    CU.ready = false;
  }

  // ------------------------------------------------------------ culling, each frame
  // the eyes the cells are judged from: the page's camera, or a headset's eyes as three.js posed them for the last frame
  // (the shell's HOST.xrEyes, v228: three.js's ArrayCamera and its eyes; read only, their matrices, never a call on
  // them); held (Hold the culling) they stay where they were. Nothing here is made a frame: the eyes, their frustums,
  // the sweep's depths, the runs and the read-out are kept and written over.
  const HOLD = { on: false, n: 0 }, FORCE = { lod: null };
  const eyeRec = () => ({ w: new THREE.Matrix4(), p: new THREE.Matrix4(), xr: false, fr: new THREE.Frustum(), pos: [0, 0, 0], cell: [0, 0, 0], p11: 2 });
  const EYE = [eyeRec(), eyeRec()], HELD = [eyeRec(), eyeRec()];
  const XS = { session: null, frames: 0, cams: null, missing: false };
  const findArr = c => { if (c && c.isArrayCamera) XS.cams = c.cameras; };
  // the eyes now (into EYE): their number, 0 while a headset's are not yet known (-1: none known, and none will be)
  function eyesNow() {
    const r = GL.renderer;
    if (!r.xr.isPresenting) { XS.session = null; EYE[0].w.copy(GL.camera.matrixWorld); EYE[0].p.copy(GL.camera.projectionMatrix); EYE[0].xr = false; return 1; }
    const s = r.xr.getSession();
    if (s !== XS.session) { XS.session = s; XS.frames = 0; }
    XS.frames++;
    // (three.js writes the eyes' matrices while it draws a frame: before this session's first frame is drawn they hold
    // another session's or none)
    if (!HOST.xrEyes) { XS.missing = true; return -1; }
    XS.missing = false;
    if (XS.frames < 2) return 0;
    XS.cams = null;
    HOST.xrEyes.forEach(findArr);
    const cams = XS.cams || [];
    let n = 0;
    for (let i = 0; i < cams.length && n < 2; i++) {
      const c = cams[i];
      if (!c || !c.projectionMatrix) continue;
      EYE[n].w.copy(c.matrixWorld); EYE[n].p.copy(c.projectionMatrix); EYE[n].xr = true; n++;
    }
    return n;
  }
  const CU = { tau: [], cell: null, lod: null, thin: null, ord: null, dist: null, op: null, runs: [], nRuns: 0, ready: false };
  const MOT = { a: 0, l: 0, f: [0, 0, 0], p: [0, 0, 0], has: false };
  const CT = { sum: 0, n: 0, max: 0 };
  const ST = { n: 0, cells: 0, cellsDrawn: 0, drawn: 0, draws: 0, tris: 0, out: 0, hidden: 0, thinOut: 0, perLod: [0, 0, 0], eyes: 0, noEyes: false, building: 0, ms: 0, G: 0, what: 0, mode: 0,
    gl2: true, fd: true, mols: 0, kinds: [], near: 0, ptMax: 256, ptDev: 256, nearOff: false, tau: 0, fading: false, cullMs: 0 };
  const _mi = new THREE.Matrix4(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), used = [0, 0, 0, 0, 0];
  // (front to back: the drawn cells sorted by distance in place, a Shell sort: Array.sort may make a work array a frame)
  function sortByDist(a) {
    const d = CU.dist, n = a.length;
    let g = 1;
    while (g < n / 3) g = 3 * g + 1;
    for (; g > 0; g = (g - 1) / 3) for (let i = g; i < n; i++) {
      const v = a[i], dv = d[v];
      let j = i;
      while (j >= g && d[a[j - g]] > dv) { a[j] = a[j - g]; j -= g; }
      a[j] = v;
    }
  }
  const KMAX = 1 / Math.sqrt(0.02), SQ3 = Math.sqrt(3);
  // cull(o, dt): which cells are drawn, at what detail and how many of their balls, then the runs of cells, then the slots
  function cull(o, dt) {
    const R = GPU.R;
    if (!R || GPU.mode < 0) return;
    const t0 = performance.now(), NC = R.NC, G = R.G, mesh = GPU.mode === 1, cap = caps();
    if (!CU.cell || CU.cell.length !== NC) Object.assign(CU, { cell: new Uint8Array(NC), lod: new Uint8Array(NC), thin: new Uint32Array(NC), dist: new Float32Array(NC), op: new Float32Array(NC), ord: [], tau: [] });
    // the eyes: now, or held
    let nE = eyesNow(), E = EYE;
    ST.noEyes = nE < 0;
    if (nE === 0 && CU.ready) return;   // (a headset's first frame: what was decided last frame is drawn again)
    if (nE < 0) nE = 0;
    if (HOLD.on) {
      if (!HOLD.n && nE) { for (let i = 0; i < nE; i++) { HELD[i].w.copy(EYE[i].w); HELD[i].p.copy(EYE[i].p); HELD[i].xr = EYE[i].xr; } HOLD.n = nE; }
      if (HOLD.n) { E = HELD; nE = HOLD.n; }
    }
    holder.updateWorldMatrix(true, false);
    _mi.copy(holder.matrixWorld).invert();
    // each eye: its frustum's planes and its place, in the cube's own frame
    for (let i = 0; i < nE; i++) {
      const e = E[i];
      _m.copy(e.w).invert().premultiply(e.p).multiply(holder.matrixWorld);
      e.fr.setFromProjectionMatrix(_m);
      _v.setFromMatrixPosition(e.w).applyMatrix4(_mi);
      e.pos[0] = _v.x; e.pos[1] = _v.y; e.pos[2] = _v.z; e.p11 = e.p.elements[5];
      for (let q = 0; q < 3; q++) e.cell[q] = (e.pos[q] + HD) / R.h;
    }
    // a headset's eyes are a frame old, and the frame is shown a little later still: the margin is 3 degrees and 2 cm,
    // plus twice how far the head turned and moved in the last frame (decaying, so a turn's end is covered too)
    if (nE && E[0].xr && E === EYE) {
      const el = E[0].w.elements, fx = -el[8], fy = -el[9], fz = -el[10], fl = Math.hypot(fx, fy, fz) || 1;
      if (MOT.has) {
        const c = (fx * MOT.f[0] + fy * MOT.f[1] + fz * MOT.f[2]) / fl;
        MOT.a = Math.max(Math.acos(clamp(c, -1, 1)), MOT.a * 0.7);
        MOT.l = Math.max(Math.hypot(E[0].pos[0] - MOT.p[0], E[0].pos[1] - MOT.p[1], E[0].pos[2] - MOT.p[2]), MOT.l * 0.7);
      }
      MOT.f[0] = fx / fl; MOT.f[1] = fy / fl; MOT.f[2] = fz / fl; MOT.p[0] = E[0].pos[0]; MOT.p[1] = E[0].pos[1]; MOT.p[2] = E[0].pos[2]; MOT.has = true;
    } else MOT.has = false;
    const angM = Math.tan(Math.min(0.7, 0.0524 + 2 * MOT.a)), linM = 0.02 / Math.max(1e-6, holder.matrixWorld.getMaxScaleOnAxis()) + 2 * MOT.l;
    // the reach of a ball beyond its cell's box: its radius, its jiggle (up to sqrt(3) * uJig of its radius) and, with
    // detail on, a thinned cell's enlargement (up to KMAX times)
    const sz = o.size, pad = R.maxR * sz * ((o.lod ? KMAX : 1) + SQ3 * SU.uJig.value);
    // (hidden cells: each eye's least depth in front of every cell, sets/cull.js; the opacity grows with the balls' size.
    // Not while the set fades: its balls are see-through then)
    const fading = set.uA.value < 0.999, hide = o.hide && nE > 0 && !fading;
    let TAU = 0;
    if (hide) {
      const op = CU.op;
      for (let c = 0; c < NC; c++) op[c] = R.opE[c] * sz * sz;
      for (let i = 0; i < nE; i++) {
        if (!CU.tau[i] || CU.tau[i].length !== NC) CU.tau[i] = new Float32Array(NC);
        CULL.sweep(op, G, E[i].cell, CU.tau[i]);
      }
      // the threshold from the pixels drawn a frame (both eyes' in a headset: sets/cull.js, tauFor)
      const r = GL.renderer, s = r.xr.isPresenting && r.xr.getSession(), bl = s && s.renderState && s.renderState.baseLayer;
      TAU = CULL.tauFor(bl && bl.framebufferWidth ? bl.framebufferWidth * bl.framebufferHeight : r.domElement.width * r.domElement.height);
    }
    const half = SU.uHalf.value;
    let out = 0, hidden = 0;
    for (let c = 0; c < NC; c++) {
      CU.cell[c] = 0;
      if (!R.count[c]) continue;
      const cx = R.cen[3 * c], cy = R.cen[3 * c + 1], cz = R.cen[3 * c + 2], rad = R.rad[c] + pad, radD = R.rad[c] + R.maxR * sz;
      let d = Infinity, seen = !nE;
      for (let i = 0; i < nE; i++) {
        const e = E[i], dd = Math.hypot(cx - e.pos[0], cy - e.pos[1], cz - e.pos[2]);
        d = Math.min(d, dd);
        if (!o.grid) { seen = true; continue; }
        const m = rad + (e.xr ? angM * dd + linM : 0);
        let inside = true;
        for (const pl of e.fr.planes) if (pl.normal.x * cx + pl.normal.y * cy + pl.normal.z * cz + pl.constant < -m) { inside = false; break; }
        if (inside) seen = true;
      }
      if (!nE) d = 1;
      if (!seen) { out++; continue; }
      if (hide) {
        let all = true;
        for (let i = 0; i < nE; i++) if (!(CU.tau[i][c] > TAU)) { all = false; break; }
        if (all) { hidden++; continue; }
      }
      CU.cell[c] = 1; CU.dist[c] = d;
      // detail: how big its balls are on screen (pixels of radius) at its nearest point (impostors: a near ball drawn flat
      // would show; thinning) and at its middle (meshes: a cell is one detail, and judged by its nearest point every cell
      // round the eye would take the finest)
      const k = R.rMean[c] * sz * (nE ? E[0].p11 : 2) * half, px = k / Math.max(d - radD, 1e-3), pxm = k / Math.max(d, 1e-3);
      let L = mesh ? 1 : 0, f = 1;
      if (o.lod) {
        L = mesh ? (pxm >= 30 ? 0 : pxm >= 6 ? 1 : 2) : (px >= 4 ? 0 : 1);
        if (px < 1.5) f = Math.max(0.02, (px / 1.5) * (px / 1.5));
      }
      if (FORCE.lod !== null) { L = FORCE.lod; f = 1; }
      CU.lod[c] = L; CU.thin[c] = f < 1 ? Math.max(1, Math.round(f * R.count[c])) : R.count[c];
    }
    // the order: front to back, or the cells' own
    const ord = CU.ord;
    ord.length = 0;
    for (let c = 0; c < NC; c++) if (CU.cell[c]) ord.push(c);
    if (o.order) sortByDist(ord);
    // runs: neighbouring cells (in the balls' order) at the same detail, none of them thinned, drawn as one
    const runs = CU.runs;
    let nr = 0, cur = null;
    for (let q = 0; q < ord.length; q++) {
      const c = ord[q], full = CU.thin[c] === R.count[c];
      if (cur && cur.full && full && c === cur.last + 1 && CU.lod[c] === cur.lod) { cur.last = c; cur.n += R.count[c]; continue; }
      cur = runs[nr] || (runs[nr] = { s: 0, n: 0, lod: 0, last: 0, full: true, k: 1 });
      nr++;
      cur.s = R.start[c]; cur.n = CU.thin[c]; cur.lod = CU.lod[c]; cur.last = c; cur.full = full; cur.k = Math.sqrt(R.count[c] / CU.thin[c]);
    }
    // the slots: each pool's first ones take the runs (an impostor run split where the pieces of the buffers meet), the
    // rest are hidden. Front to back is the slots' renderOrder; while the set fades (see-through) back to front
    used.fill(0);
    let drawn = 0, tris = 0, thinOut = 0, draws = 0;
    const perLod = ST.perLod;
    perLod[0] = perLod[1] = perLod[2] = 0;
    for (let i = 0; i < nr; i++) {
      const ru = runs[i], pool = mesh ? 2 + ru.lod : ru.lod, P = GPU.pools[pool], col = ru.k > 1.0001 ? THIN_COL : LOD_COL[POOL_LOD[pool]];
      let s = ru.s, n = ru.n;
      while (n > 0) {
        const ci = mesh ? 0 : (s / CH) | 0, m = mesh ? n : Math.min(n, (ci + 1) * CH - s);
        const ob = P[used[pool]] || slot(pool);
        used[pool]++;
        if (!mesh) ob.geometry = GPU.chunks[ci];
        ob.visible = true; ob.userData.s = mesh ? s : s - ci * CH; ob.userData.n = m;
        ob.renderOrder = o.order ? (fading ? 1e6 - draws : draws) : 0;
        const u = ob.userData.own;
        u.uK.value = ru.k; u.uBase.value = s;
        u.uLodC.value.set(col[0], col[1], col[2]);
        s += m; n -= m; draws++;
      }
      drawn += ru.n; perLod[POOL_LOD[pool]] += ru.n;
      if (mesh) tris += ru.n * MESH[ru.lod].tris;
    }
    for (let p = 0; p < 5; p++) { const P = GPU.pools[p]; for (let j = used[p]; j < P.length; j++) P[j].visible = false; }
    for (let q = 0; q < ord.length; q++) thinOut += R.count[ord[q]] - CU.thin[ord[q]];
    // the very near balls (impostors): a point stops at the card's limit (ptMax pixels across), so every ball nearer an
    // eye than a point that big could be is left out of the points by their shader and drawn here as a mesh instead:
    // nearer than kc times its radius, kc = 2 * p11 * half / ptMax (where it fills ptMax straight ahead) times f, for a
    // ball off to the side, whose point is sized by its depth alone (f = 1 / cos of the frustum's widest corner, from
    // each eye's projection: about 1.3 on a page, 2 in a headset)
    let nearN = 0;
    SU.uPtMax.value = cap.pt;
    if (!mesh && nE && cap.inst) {
      let kc = 0;
      for (let i = 0; i < nE; i++) {
        const pe = E[i].p.elements, tx = (1 + Math.abs(pe[8])) / pe[0], ty = (1 + Math.abs(pe[9])) / pe[5];
        kc = Math.max(kc, 2 * pe[5] * half / cap.pt * Math.sqrt(1 + tx * tx + ty * ty));
      }
      const k2 = kc * kc, ea = E[0].pos, eb = E[nE > 1 ? 1 : 0].pos;
      SU.uEyeA.value.set(ea[0], ea[1], ea[2]); SU.uEyeB.value.set(eb[0], eb[1], eb[2]); SU.uCapK2.value = k2;
      nearN = nearFill(R, ea, eb, kc, k2, sz);
      if (nearN > NEAR.cap) { nearGrow(1 << Math.ceil(Math.log2(nearN))); nearN = nearFill(R, ea, eb, kc, k2, sz); }
    } else SU.uCapK2.value = 0;
    if (NEAR.o) {
      NEAR.o.visible = nearN > 0; NEAR.g.instanceCount = nearN; NEAR.o.renderOrder = o.order ? (fading ? 1e6 + 1 : -1) : 0;
      if (nearN) for (let q = 0; q < 3; q++) { const a = NEAR.g.attributes[NEAR_AT[q]]; a.updateRange.offset = 0; a.updateRange.count = 4 * nearN; a.needsUpdate = true; }
    }
    CU.ready = true;
    ST.cellsDrawn = ord.length; ST.drawn = drawn; ST.draws = draws + (nearN ? 1 : 0); ST.tris = tris + nearN * MESH[0].tris; ST.out = out; ST.hidden = hidden; ST.thinOut = thinOut;
    ST.eyes = nE; ST.near = nearN; ST.ptMax = cap.pt; ST.ptDev = cap.dev; ST.nearOff = !mesh && !cap.inst; ST.tau = TAU; ST.fading = fading;
    const ms = performance.now() - t0;
    CT.sum += ms; CT.n++; if (ms > CT.max) CT.max = ms;
    ST.cullMs = ST.cullMs * 0.9 + ms * 0.1;
  }
  // the balls of drawn cells near enough an eye copied into the near meshes' attributes (as many as fit; the count of
  // all of them returned)
  function nearFill(R, ea, eb, kc, k2, sz) {
    let n = 0;
    const cap = NEAR.cap, P = R.P, Cb = R.C, Eb = R.E, iP = NEAR.g && NEAR.g.attributes.iP.array, iC = NEAR.g && NEAR.g.attributes.iC.array, iE = NEAR.g && NEAR.g.attributes.iE.array;
    for (let c = 0; c < R.NC; c++) {
      if (!CU.cell[c]) continue;
      const cx = R.cen[3 * c], cy = R.cen[3 * c + 1], cz = R.cen[3 * c + 2], rr = R.rad[c] + kc * R.rMax[c] * sz;
      if (Math.hypot(cx - ea[0], cy - ea[1], cz - ea[2]) > rr && Math.hypot(cx - eb[0], cy - eb[1], cz - eb[2]) > rr) continue;
      for (let j = R.start[c], j1 = R.start[c + 1]; j < j1; j++) {
        const x = P[4 * j], y = P[4 * j + 1], z = P[4 * j + 2];
        const da = (x - ea[0]) ** 2 + (y - ea[1]) ** 2 + (z - ea[2]) ** 2, db = (x - eb[0]) ** 2 + (y - eb[1]) ** 2 + (z - eb[2]) ** 2;
        if (Math.min(da, db) >= k2 * P[4 * j + 3] * P[4 * j + 3] * sz * sz) continue;
        if (n < cap) for (let q = 0; q < 4; q++) { iP[4 * n + q] = P[4 * j + q]; iC[4 * n + q] = Cb[4 * j + q]; iE[4 * n + q] = Eb[4 * j + q]; }
        n++;
      }
    }
    return n;
  }

  // ------------------------------------------------------------ the set: what to build, and each frame
  const BUILD = { it: null, n: -1, what: -1, t0: 0 };
  const N_OPT = [1000, 10000, 30000, 100000, 300000, 1000000], fmtK = v => (v >= 1e6 ? v / 1e6 + 'M' : v >= 1000 ? v / 1000 + 'k' : String(v));
  const near = x => { let b = N_OPT[0]; for (const v of N_OPT) if (Math.abs(v - x) < Math.abs(b - x)) b = v; return b; };
  let statT = 0, freezeT = null;
  const FT = { ring: [], sum: 0, last: 0 };
  const CO = { size: 1, grid: true, lod: true, order: true, hide: true };
  return Object.assign(set, {
    // crowds_n balls; crowds_size their size; crowds_draw 0 impostors, 1 meshes; crowds_what 0 cloud, 1 packed proteins;
    // crowds_shade 0 lit, 1 flat, 2 outline; crowds_ao ambient shading; crowds_col 0 kind, 1 cell, 2 detail; and the four
    // culling switches: crowds_grid (cells out of view), crowds_lod (detail by distance), crowds_order (front to back),
    // crowds_hide (hidden cells)
    params: { crowds_a: 1, crowds_n: 100000, crowds_size: 1, crowds_draw: 0, crowds_what: 1, crowds_shade: 0, crowds_ao: 1, crowds_col: 0,
      crowds_grid: 1, crowds_lod: 1, crowds_order: 1, crowds_hide: 1 },
    update(S, t, dt) {
      const n = near(S.crowds_n), what = S.crowds_what >= 0.5 ? 1 : 0, mode = S.crowds_draw >= 0.5 && isGL2() ? 1 : 0;
      // a new crowd is built in slices (the frame's build budget, buildMs); the old one is drawn until it is done and
      // sent to the card
      if (n !== BUILD.n || what !== BUILD.what) { BUILD.n = n; BUILD.what = what; BUILD.it = CROWDS.build(K, n, what, 11 + n + 7 * what); BUILD.t0 = performance.now(); }
      if (BUILD.it) {
        const t0 = performance.now(), ms = buildMs(dt);
        let r;
        while (!(r = BUILD.it.next()).done && performance.now() - t0 < ms);
        if (r.done) { BUILD.it = null; stage(r.value, mode); }
      } else if (GPU.R && !GPU.next && mode !== GPU.mode) stage(GPU.R, mode);
      else if (GPU.next && GPU.next.mode !== mode) stage(GPU.next.R, mode);
      if (GPU.next) {
        const was = GPU.R;
        stageStep();
        if (GPU.R !== was) { ST.ms = Math.round(performance.now() - BUILD.t0); if (set.onBuild) set.onBuild(); }
      }
      SU.uT.value = freezeT === null ? t : freezeT;
      SU.uHalf.value = BALLS.half();
      SU.uSize.value = S.crowds_size; SU.uShade.value = Math.round(S.crowds_shade); SU.uAo.value = S.crowds_ao >= 0.5 ? 1 : 0; SU.uColBy.value = Math.round(S.crowds_col);
      CO.size = S.crowds_size; CO.grid = S.crowds_grid >= 0.5; CO.lod = S.crowds_lod >= 0.5; CO.order = S.crowds_order >= 0.5; CO.hide = S.crowds_hide >= 0.5;
      cull(CO, dt);
      // the frame times of the last second, and the read-out (twice a second)
      // (the page's own clock: the frame's dt is capped at 0.1 s, so a slow frame would read as 10 a second)
      const now = performance.now(), fd = FT.last ? (now - FT.last) / 1000 : 0;
      FT.last = now;
      if (fd > 0 && fd < 5) { FT.ring.push(fd); FT.sum += fd; while (FT.sum > 1 && FT.ring.length > 1) FT.sum -= FT.ring.shift(); }
      const R = GPU.R;
      ST.n = R ? R.n : 0; ST.cells = R ? R.NC : 0; ST.G = R ? R.G : 0; ST.what = R ? R.what : what; ST.mode = GPU.mode; ST.gl2 = isGL2(); ST.fd = caps().fd;
      ST.mols = R ? R.mols : 0; ST.kinds = R ? R.kinds : ST.kinds; ST.building = BUILD.it || GPU.next ? BUILD.n : 0; ST.info = GL.renderer.info.render;
      statT += dt;
      if (statT > 0.5 && set.onStats) { statT = 0; set.onStats(); }
    },
    // what is built and drawn now (the panes' read-out): counts, the last frame's draw calls, and the frame times
    stats: () => {
      const ft = FT.ring.length ? FT.ring : [0], mean = FT.sum / ft.length, worst = Math.max(...ft), I = ST.info || {};
      return Object.assign({}, ST, { fps: mean > 0 ? 1 / mean : 0, ms: ST.ms, mean: mean * 1000, worst: worst * 1000, calls: I.calls || 0, pts: I.points || 0, triAll: I.triangles || 0 });
    },
    api: () => ({
      // Hold the culling: the eyes it judges from stay where they are now (walk out and see what is drawn); per device
      hold(on) { HOLD.on = !!on; HOLD.n = 0; }, held: () => HOLD.on,
      // for tests and the sweep: the jiggle stopped at a time (null: going again)
      freeze(t) { freezeT = t; },
      // for the sweep: every cell at one detail level (0 or 1; meshes 0 to 2), no thinning (null: by distance again)
      force(L) { FORCE.lod = L; },
      // for tests: the points' limit in pixels, as a card with a smaller one would have it (null: the card's own)
      ptMax(px) { caps(); CAP.pt = px ? Math.min(px, CAP.dev) : CAP.dev; },
      // for the sweep: the culling pass's own time on the CPU since the last call (ms: mean, worst, frames)
      cullTime() { const r = { mean: CT.n ? CT.sum / CT.n : 0, max: CT.max, n: CT.n }; CT.sum = CT.n = CT.max = 0; return r; },
      ready: () => !BUILD.it && !GPU.next && !!GPU.R,
      kindNames: ['tubulin', 'GAPDH', 'actin', 'calmodulin', 'ubiquitin'],
    }),
    anchors: { centre: [0, 0, 0], corner: [HD, HD, HD], top: [0, HD + 0.08, 0] },
    labels: [],
    cam: { default: [32, 22, 3.4, 0, 0, 0], close: [40, 14, 1.25, 0.12, 0.05, 0.12], inside: [30, 6, 0.32, 0, 0, 0], far: [32, 22, 14, 0, 0, 0] },
    controls: [
      { key: 'n', label: 'Balls', options: N_OPT.map(v => [String(v), fmtK(v)]) },
      { key: 'what', label: 'What', options: [['1', 'Packed proteins'], ['0', 'Made-up cloud']] },
      { key: 'draw', label: 'Drawn as', options: [['0', 'Impostors'], ['1', 'Meshes']] },
      { key: 'size', label: 'Size', options: [['1', 'As packed'], ['0.6', 'Smaller'], ['1.4', 'Larger']] },
      { key: 'shade', label: 'Shading', options: [['0', 'Lit'], ['1', 'Flat'], ['2', 'Outline']] },
      { key: 'ao', label: 'Ambient shading', options: [['1', 'On'], ['0', 'Off']] },
      { key: 'col', label: 'Colour', options: [['0', 'By kind'], ['1', 'By cell'], ['2', 'By detail']] },
      { key: 'view', label: 'View', options: [['default', 'Outside'], ['close', 'Close'], ['inside', 'Inside'], ['far', 'Far']] },
      { key: 'grid', label: 'Cells out of view', tab: 'cull', options: [['1', 'Left out'], ['0', 'Drawn']] },
      { key: 'lod', label: 'Detail by distance', tab: 'cull', options: [['1', 'On'], ['0', 'Off']] },
      { key: 'order', label: 'Front to back', tab: 'cull', options: [['1', 'On'], ['0', 'Off']] },
      { key: 'hide', label: 'Hidden cells', tab: 'cull', options: [['1', 'Left out'], ['0', 'Drawn']] },
    ],
    explore(c) {
      const on = (v, d) => (v === undefined ? d : v === '1' ? 1 : 0);
      return { crowds_n: +c.n || 1000, crowds_what: on(c.what, 1), crowds_draw: +c.draw || 0, crowds_size: +c.size || 1, crowds_shade: +c.shade || 0,
        crowds_ao: on(c.ao, 1), crowds_col: +c.col || 0, crowds_grid: on(c.grid, 1), crowds_lod: on(c.lod, 1), crowds_order: on(c.order, 1), crowds_hide: on(c.hide, 1) };
    },
  });
};
// the tile is packed while the story loads, a slice a step (buildSet runs this until it says done)
SETS.crowds.prep = ms => CROWDS.pack(ms || 25);
