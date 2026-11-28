// Protein crowds: up to a million balls in a cube, drawn two ways and culled four ways, with a read-out of what it costs.
// The balls: a made-up cloud (seeded, the same on every device) or the crowd of Back into the cell (packages/ppicell:
// PPI_STRUCTS' coarse balls of ubiquitin, calmodulin, actin, GAPDH and tubulin, CROWD's kinds, shares and colours),
// packed as crowd.js packs its cube but wrapping round the faces, so that copies of the one packed cube (each turned
// one of the cube's 24 ways) fill a bigger cube without a seam. Drawn as sphere impostors (one point each, a lit sphere
// with its true depth, as crowd.js draws them) or as instanced low-poly spheres (three levels of detail); both read the
// same balls, sorted into a grid of cells, each cell a contiguous range, so a draw is a run of cells. Culling (each a
// switch): cells out of view, detail by distance (far balls cheaper, sub-pixel ones thinned and the rest enlarged),
// front-to-back order, and cells hidden behind full ones (sets/cull.js). Everything is built in slices between frames.
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
  return { T, pack, ROTS, KINDS, SIDE, HALF };
})();

SETS.crowds = function (K) {
  const { THREE, clamp } = K;
  const set = K.newSet('crowds');
  const D = 1.2, HD = D / 2;   // (the cube's side in the scene, whatever it holds: more balls, smaller ones)
  const holder = new THREE.Group();
  set.group.add(holder);
  // the cube's edges
  const edges = new THREE.LineSegments(new THREE.EdgesGeometry(new THREE.BoxGeometry(D, D, D)), K.fade(set, new THREE.LineBasicMaterial({ color: 0x9fd8ff, transparent: true }), 0.45));
  holder.add(edges);
  const KC = CROWDS.KINDS.map(k => k.c), SHARE = CROWDS.KINDS.map(k => k.share);
  const W = 2048;   // (the textures' width: a ball's place in them is its number, row after row)
  const isGL2 = () => !!(GL.renderer && GL.renderer.capabilities.isWebGL2);

  // ------------------------------------------------------------ the balls, built in slices
  // build(n, what): a generator that yields every few thousand balls; its result R holds every ball sorted by cell:
  // P (x, y, z, r; floats), C (r, g, b, ambient occlusion; bytes), E (cell number low, high, phase, kind; bytes), each 4
  // a ball and W * rows long (the mesh's textures), and the grid: G cells a side, each cell's start, count, middle,
  // reach, mean radius, and its opacity (sets/cull.js) eroded
  function* build(n, what, seed) {
    const t0 = performance.now(), r = K.rng(seed);
    let N = 0, P, KD, PH;
    if (what === 1) {
      // the packed crowd: copies of the tile, each turned, cropped to a cube holding about n balls, scaled to D
      const T = CROWDS.T, S = CROWDS.SIDE, H = CROWDS.HALF, s = S * Math.cbrt(n / T.nb), h = s / 2, sc = D / s, A = Math.ceil(h / S + 0.5);
      const keep = [], m = [0, 0, 0];
      for (let a = -A; a <= A; a++) for (let b = -A; b <= A; b++) for (let c = -A; c <= A; c++) {
        if (Math.abs(a * S) - H > h || Math.abs(b * S) - H > h || Math.abs(c * S) - H > h) continue;
        const R3 = CROWDS.ROTS[Math.floor(K.rng(7 + (a + 50) * 10007 + (b + 50) * 101 + (c + 50))() * 24)];
        for (let i = 0; i < T.nm; i++) {
          for (let q = 0; q < 3; q++) m[q] = R3[q][0] * T.mc[3 * i] + R3[q][1] * T.mc[3 * i + 1] + R3[q][2] * T.mc[3 * i + 2];
          const x = a * S + m[0], y = b * S + m[1], z = c * S + m[2];
          if (Math.abs(x) < h && Math.abs(y) < h && Math.abs(z) < h) keep.push(i, x, y, z, R3);
        }
        yield;
      }
      for (let i = 0; i < keep.length; i += 5) N += T.m0[keep[i] + 1] - T.m0[keep[i]];
      P = new Float32Array(4 * N); KD = new Uint8Array(N); PH = new Uint8Array(N);
      let j = 0;
      for (let i = 0; i < keep.length; i += 5) {
        const mi = keep[i], R3 = keep[i + 4], ph = Math.floor(r() * 256);
        for (let b = T.m0[mi]; b < T.m0[mi + 1]; b++) {
          const ox = T.bo[4 * b], oy = T.bo[4 * b + 1], oz = T.bo[4 * b + 2];
          for (let q = 0; q < 3; q++) P[4 * j + q] = clamp((keep[i + 1 + q] + R3[q][0] * ox + R3[q][1] * oy + R3[q][2] * oz) * sc, -HD, HD);
          P[4 * j + 3] = T.bo[4 * b + 3] * sc; KD[j] = T.mk[mi]; PH[j] = ph; j++;
        }
        if ((i & 4095) === 0) yield;
      }
    } else {
      // the cloud: n balls at random in the cube, a fifth of it filled (they may overlap), kinds by CROWD's shares
      N = n; P = new Float32Array(4 * N); KD = new Uint8Array(N); PH = new Uint8Array(N);
      const r0 = D * Math.cbrt(0.2 / (N * 4.18879 * 1.09)), cum = SHARE.map((s, i) => SHARE.slice(0, i + 1).reduce((a, b) => a + b, 0));
      for (let i = 0; i < N; i++) {
        P[4 * i] = (r() - 0.5) * D; P[4 * i + 1] = (r() - 0.5) * D; P[4 * i + 2] = (r() - 0.5) * D; P[4 * i + 3] = r0 * (0.7 + 0.6 * r());
        const u = r() * cum[cum.length - 1];
        let k = 0;
        while (k < cum.length - 1 && u > cum[k]) k++;
        KD[i] = k; PH[i] = Math.floor(r() * 256);
        if ((i & 16383) === 0) yield;
      }
    }
    // the grid: about 1,500 balls a cell, 2 to 10 cells a side
    const G = clamp(Math.round(Math.cbrt(N / 1500)), 2, 10), NC = G * G * G, h = D / G, cellOf = new Uint16Array(N), count = new Uint32Array(NC);
    let rSum = 0;
    for (let i = 0; i < N; i++) {
      const c = Math.min(G - 1, Math.floor((P[4 * i] + HD) / h)) + G * (Math.min(G - 1, Math.floor((P[4 * i + 1] + HD) / h)) + G * Math.min(G - 1, Math.floor((P[4 * i + 2] + HD) / h)));
      cellOf[i] = c; count[c]++; rSum += P[4 * i + 3];
      if ((i & 32767) === 0) yield;
    }
    // ambient occlusion: how crowded each ball's neighbourhood is (a fine grid's counts, smoothed over 3 x 3 x 3), from
    // light at the cube's skin to dark deep inside
    const rm = rSum / Math.max(1, N), FG = clamp(Math.round(D / (3 * rm)), 4, 96), fh = D / FG, fc = new Float32Array(FG ** 3), fi = new Uint32Array(N);
    for (let i = 0; i < N; i++) {
      const c = Math.min(FG - 1, Math.floor((P[4 * i] + HD) / fh)) + FG * (Math.min(FG - 1, Math.floor((P[4 * i + 1] + HD) / fh)) + FG * Math.min(FG - 1, Math.floor((P[4 * i + 2] + HD) / fh)));
      fi[i] = c; fc[c]++;
      if ((i & 32767) === 0) yield;
    }
    for (let ax = 0, st = 1; ax < 3; ax++, st *= FG) {
      const src = fc.slice();
      for (let c = 0; c < fc.length; c++) {
        const q = Math.floor(c / st) % FG;
        fc[c] = src[c] + (q > 0 ? src[c - st] : 0) + (q < FG - 1 ? src[c + st] : 0);
      }
      yield;
    }
    const ref = 27 * N / FG ** 3;
    // sorted by cell, each cell's balls in a random order (so the first m of a cell are a fair sample of it: thinning)
    const start = new Uint32Array(NC + 1);
    for (let c = 0; c < NC; c++) start[c + 1] = start[c] + count[c];
    const fill = start.slice(0, NC), perm = new Uint32Array(N);
    for (let i = 0; i < N; i++) perm[fill[cellOf[i]]++] = i;
    for (let c = 0; c < NC; c++) {
      for (let j = start[c + 1] - 1; j > start[c]; j--) { const q = start[c] + Math.floor(r() * (j - start[c] + 1)), t = perm[j]; perm[j] = perm[q]; perm[q] = t; }
      if ((c & 15) === 0) yield;
    }
    const rows = Math.max(1, Math.ceil(N / W)), Pz = new Float32Array(4 * W * rows), C = new Uint8Array(4 * W * rows), Ez = new Uint8Array(4 * W * rows);
    for (let j = 0; j < N; j++) {
      const i = perm[j], c = cellOf[i], k = KD[i], col = KC[k];
      Pz[4 * j] = P[4 * i]; Pz[4 * j + 1] = P[4 * i + 1]; Pz[4 * j + 2] = P[4 * i + 2]; Pz[4 * j + 3] = P[4 * i + 3];
      C[4 * j] = col[0] * 255; C[4 * j + 1] = col[1] * 255; C[4 * j + 2] = col[2] * 255;
      C[4 * j + 3] = Math.round(255 * clamp(fc[fi[i]] / ref, 0, 1.25) / 1.25);
      Ez[4 * j] = c & 255; Ez[4 * j + 1] = c >> 8; Ez[4 * j + 2] = PH[i]; Ez[4 * j + 3] = k;
      if ((j & 32767) === 0) yield;
    }
    // each cell: its balls' middles' box, the reach beyond it, the mean radius and the opacity at size 1
    const cen = new Float32Array(3 * NC), rad = new Float32Array(NC), rMean = new Float32Array(NC), op = new Float32Array(NC);
    let maxR = 0;
    for (let c = 0; c < NC; c++) {
      const lo = [Infinity, Infinity, Infinity], hi = [-Infinity, -Infinity, -Infinity];
      let rs = 0, r2 = 0, rx = 0;
      for (let j = start[c]; j < start[c + 1]; j++) {
        for (let q = 0; q < 3; q++) { const v = Pz[4 * j + q]; if (v < lo[q]) lo[q] = v; if (v > hi[q]) hi[q] = v; }
        const rr = Pz[4 * j + 3]; rs += rr; r2 += rr * rr; if (rr > rx) rx = rr;
      }
      const m = count[c];
      if (!m) continue;
      for (let q = 0; q < 3; q++) cen[3 * c + q] = (lo[q] + hi[q]) / 2;
      rad[c] = Math.hypot(hi[0] - lo[0], hi[1] - lo[1], hi[2] - lo[2]) / 2; rMean[c] = rs / m; maxR = Math.max(maxR, rx);
      op[c] = m * Math.PI * (r2 / m) / (h * h);
      if ((c & 15) === 0) yield;
    }
    const kinds = KC.map(() => 0);
    for (let i = 0; i < N; i++) kinds[KD[i]]++;
    return { n: N, what, P: Pz, C, E: Ez, rows, G, NC, h, start, count, cen, rad, rMean, maxR, opE: CULL.erode(op, G), kinds,
      mols: what === 1 ? Math.round(N / (CROWDS.T.nb / CROWDS.T.nm)) : N, ms: Math.round(performance.now() - t0) };
  }

  // ------------------------------------------------------------ drawing: shaders
  // shared uniforms; each draw (a slot) adds its own: uK (the thinned balls' enlargement), uLodC (its detail's colour,
  // for Colour by detail) and, for the meshes, uBase (its first ball)
  const SU = { uA: set.uA, uT: { value: 0 }, uHalf: { value: 400 }, uSize: { value: 1 }, uJig: { value: 0.12 }, uAo: { value: 1 }, uColBy: { value: 0 },
    uShade: { value: 0 }, uPos: { value: null }, uColT: { value: null }, uExtT: { value: null }, uW: { value: W } };
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
  // them). Far: the same face, its depth the ball's front (no gl_FragDepth, so early depth rejection still works)
  const ptsV = near => `${VCOMMON}
attribute float aRad; attribute vec4 aCol, aExt;
varying vec3 vP; varying float vR;
void main() {
  float r = aRad * uSize * uK;
  vec4 mv = modelViewMatrix * vec4(position + jig(aExt.z, aRad * uSize), 1.0);
  float rr = r * length(modelViewMatrix[0].xyz);
  ${near ? '' : 'mv.z += rr;'}
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(2.0 * rr * projectionMatrix[1][1] * uHalf / max(-mv.z, 0.001), 1.0, 256.0);
  vC = ballCol(aCol, aExt); vP = mv.xyz; vR = rr;
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
  // number (uBase + gl_InstanceID: WebGL 2), so a draw of any run of balls needs no buffers of its own
  const meshV = `${VCOMMON}
uniform highp sampler2D uPos, uColT, uExtT; uniform int uBase, uW;
varying vec3 vN;
void main() {
  int id = uBase + gl_InstanceID;
  ivec2 uv = ivec2(id % uW, id / uW);
  vec4 P = texelFetch(uPos, uv, 0), col = texelFetch(uColT, uv, 0), ext = texelFetch(uExtT, uv, 0) * 255.0;
  float r = P.w * uSize * uK;
  vec4 mv = modelViewMatrix * vec4(P.xyz + jig(ext.z, P.w * uSize) + position * r, 1.0);
  vN = normalize(normalMatrix * position);
  gl_Position = projectionMatrix * mv;
  vC = ballCol(col, ext);
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
  // object sharing its pool's geometry, its own material (the same program), drawing one run of cells
  const GPU = { R: null, mode: -1, pts: null, mesh: null, tex: null, pools: [[], [], [], [], []] };
  const POOL_LOD = [0, 1, 0, 1, 2];   // (a pool's detail level, for its colour)
  function slot(pool) {
    const own = { uK: { value: 1 }, uLodC: { value: new THREE.Vector3(...LOD_COL[POOL_LOD[pool]]) }, uBase: { value: 0 } };
    const mesh = pool >= 2, near = pool === 0;
    const m = new THREE.ShaderMaterial({ uniforms: Object.assign({}, SU, own), vertexShader: mesh ? meshV : ptsV(near), fragmentShader: mesh ? meshF : ptsF(near),
      extensions: { fragDepth: near } });
    // (see-through only while the set fades, and then writing no depth, as crowd.js's balls)
    Object.defineProperty(m, 'transparent', { configurable: true, get: () => set.uA.value < 0.999, set() {} });
    Object.defineProperty(m, 'depthWrite', { configurable: true, get: () => set.uA.value >= 0.999, set() {} });
    const geo = mesh ? GPU.mesh[pool - 2] : GPU.pts;
    const o = mesh ? new THREE.Mesh(geo, m) : new THREE.Points(geo, m);
    o.frustumCulled = false; o.visible = false; o.userData = { s: 0, n: 0, own };
    // (its run, set just before it is drawn: the geometry is shared by the pool)
    o.onBeforeRender = function (r, sc, cam, g) { if (g.isInstancedBufferGeometry) g.instanceCount = this.userData.n; else { g.drawRange.start = this.userData.s; g.drawRange.count = this.userData.n; } };
    holder.add(o);
    GPU.pools[pool].push(o);
    return o;
  }
  function dropPools() {
    for (const p of GPU.pools) { for (const o of p) { holder.remove(o); o.material.dispose(); } p.length = 0; }
  }
  // the balls sent to the graphics card for one way of drawing (0 impostors: attributes; 1 meshes: textures); the other
  // way's copy is let go
  function upload(mode) {
    const R = GPU.R;
    dropPools();
    if (GPU.pts) { GPU.pts.dispose(); GPU.pts = null; }
    if (GPU.tex) { GPU.tex.forEach(t => t.dispose()); GPU.tex = null; SU.uPos.value = SU.uColT.value = SU.uExtT.value = null; }
    if (GPU.mesh) { GPU.mesh.forEach(g => g.dispose()); GPU.mesh = null; }
    GPU.mode = mode;
    if (!R) return;
    if (mode === 0) {
      const g = new THREE.BufferGeometry(), ib = new THREE.InterleavedBuffer(R.P, 4);
      g.setAttribute('position', new THREE.InterleavedBufferAttribute(ib, 3, 0)); g.setAttribute('aRad', new THREE.InterleavedBufferAttribute(ib, 1, 3));
      g.setAttribute('aCol', new THREE.BufferAttribute(R.C, 4, true)); g.setAttribute('aExt', new THREE.BufferAttribute(R.E, 4, false));
      g.setDrawRange(0, 0);
      GPU.pts = g;
    } else {
      const tex = (a, type) => { const t = new THREE.DataTexture(a, W, R.rows, THREE.RGBAFormat, type); t.minFilter = t.magFilter = THREE.NearestFilter; t.generateMipmaps = false; t.needsUpdate = true; return t; };
      GPU.tex = [tex(R.P, THREE.FloatType), tex(R.C, THREE.UnsignedByteType), tex(R.E, THREE.UnsignedByteType)];
      [SU.uPos.value, SU.uColT.value, SU.uExtT.value] = GPU.tex;
      GPU.mesh = [ico(2), ico(1), ico(0)];
    }
  }

  // ------------------------------------------------------------ culling, each frame
  // the eyes the cells are judged from: the page's camera, or a headset's two eyes (as three.js posed them for the last
  // frame: HOST.xrEyes, read only; their matrices, never a call on them); held (Hold the culling) they stay where they were
  const HOLD = { on: false, eyes: null }, FORCE = { lod: null };
  const _mi = new THREE.Matrix4(), _m = new THREE.Matrix4(), _v = new THREE.Vector3(), _f = [];
  function eyesNow() {
    const r = GL.renderer, out = [];
    if (r.xr.isPresenting) { for (const c of HOST.xrEyes || []) if (!c.isArrayCamera && c.projectionMatrix) out.push({ w: c.matrixWorld.clone(), p: c.projectionMatrix.clone(), xr: true }); }
    else out.push({ w: GL.camera.matrixWorld.clone(), p: GL.camera.projectionMatrix.clone(), xr: false });
    return out;
  }
  const CU = { tau: [], cell: null, lod: null, thin: null, ord: null, dist: null, runs: [] };
  const ST = { n: 0, cells: 0, cellsDrawn: 0, drawn: 0, draws: 0, tris: 0, out: 0, hidden: 0, thinOut: 0, perLod: [0, 0, 0], eyes: 0, building: 0, ms: 0, G: 0, what: 0, mode: 0, gl2: true, mols: 0, kinds: [] };
  // cull(o): which cells are drawn, at what detail and how many of their balls, then the runs of cells, then the slots
  function cull(o) {
    const R = GPU.R;
    if (!R || GPU.mode < 0) return;
    const NC = R.NC, G = R.G;
    if (!CU.cell || CU.cell.length !== NC) Object.assign(CU, { cell: new Uint8Array(NC), lod: new Uint8Array(NC), thin: new Uint32Array(NC), dist: new Float32Array(NC), ord: [] , tau: [] });
    if (HOLD.on && !HOLD.eyes) HOLD.eyes = eyesNow();
    const eyes = HOLD.on ? HOLD.eyes : eyesNow();
    holder.updateWorldMatrix(true, false);
    _mi.copy(holder.matrixWorld).invert();
    const sz = o.size, pad = R.maxR * sz * (1 + SU.uJig.value);
    // each eye: its frustum's planes and its place, in the cube's own frame
    const E = eyes.map((e, i) => {
      _m.copy(e.w).invert().premultiply(e.p).multiply(holder.matrixWorld);
      const fr = _f[i] || (_f[i] = new THREE.Frustum());
      fr.setFromProjectionMatrix(_m);
      _v.setFromMatrixPosition(e.w).applyMatrix4(_mi);
      return { fr, pos: _v.toArray(), p11: e.p.elements[5], xr: e.xr };
    });
    // (hidden cells: each eye's least depth in front of every cell, sets/cull.js; the opacity grows with the balls' size)
    if (o.hide && E.length) {
      const op = R.opE.map(v => v * sz * sz);
      E.forEach((e, i) => { CU.tau[i] = CU.tau[i] && CU.tau[i].length === NC ? CU.tau[i] : new Float32Array(NC); CULL.sweep(op, G, e.pos.map(v => (v + HD) / R.h), CU.tau[i]); });
    }
    const half = SU.uHalf.value, mesh = GPU.mode === 1;
    let out = 0, hidden = 0;
    for (let c = 0; c < NC; c++) {
      CU.cell[c] = 0;
      if (!R.count[c]) continue;
      const cx = R.cen[3 * c], cy = R.cen[3 * c + 1], cz = R.cen[3 * c + 2], rad = R.rad[c] + pad;
      let d = Infinity, seen = !E.length;
      for (const e of E) {
        const dd = Math.hypot(cx - e.pos[0], cy - e.pos[1], cz - e.pos[2]);
        d = Math.min(d, dd);
        // (a headset's eyes are a frame old: a margin of about 3 degrees and 2 cm)
        const m = rad + (e.xr ? 0.05 * dd + 0.02 : 0);
        if (!o.grid) { seen = true; continue; }
        let inside = true;
        for (const pl of e.fr.planes) if (pl.normal.x * cx + pl.normal.y * cy + pl.normal.z * cz + pl.constant < -m) { inside = false; break; }
        if (inside) seen = true;
      }
      if (!E.length) d = 1;
      if (!seen) { out++; continue; }
      if (o.hide && E.length && E.every((e, i) => CU.tau[i][c] > CULL.TAU)) { hidden++; continue; }
      CU.cell[c] = 1; CU.dist[c] = d;
      // detail: how big its balls are on screen (pixels of radius) at its nearest point (impostors: a near ball drawn flat
      // would show; thinning) and at its middle (meshes: a cell is one detail, and judged by its nearest point every cell
      // round the eye would take the finest)
      const k = R.rMean[c] * sz * (E.length ? E[0].p11 : 2) * half, px = k / Math.max(d - rad, 1e-3), pxm = k / Math.max(d, 1e-3);
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
    if (o.order) ord.sort((a, b) => CU.dist[a] - CU.dist[b]);
    // runs: neighbouring cells (in the balls' order) at the same detail, none of them thinned, drawn as one
    const runs = CU.runs;
    runs.length = 0;
    let cur = null;
    for (const c of ord) {
      const full = CU.thin[c] === R.count[c];
      if (cur && cur.full && full && c === cur.last + 1 && CU.lod[c] === cur.lod) { cur.last = c; cur.n += R.count[c]; continue; }
      cur = { s: R.start[c], n: CU.thin[c], lod: CU.lod[c], last: c, full, k: Math.sqrt(R.count[c] / CU.thin[c]) };
      runs.push(cur);
    }
    // the slots: each pool's first ones take the runs, the rest are hidden
    const used = [0, 0, 0, 0, 0];
    let drawn = 0, tris = 0, thinOut = 0;
    const perLod = [0, 0, 0];
    runs.forEach((ru, i) => {
      const pool = mesh ? 2 + ru.lod : ru.lod, P = GPU.pools[pool], ob = P[used[pool]] || slot(pool);
      used[pool]++;
      ob.visible = true; ob.userData.s = ru.s; ob.userData.n = ru.n; ob.renderOrder = o.order ? i : 0;
      const u = ob.userData.own;
      u.uK.value = ru.k; u.uBase.value = ru.s;
      u.uLodC.value.set(...(ru.k > 1.0001 ? THIN_COL : LOD_COL[POOL_LOD[pool]]));
      drawn += ru.n; perLod[POOL_LOD[pool]] += ru.n;
      if (mesh) tris += ru.n * GPU.mesh[ru.lod].tris;
    });
    GPU.pools.forEach((P, p) => { for (let j = used[p]; j < P.length; j++) P[j].visible = false; });
    for (const c of ord) thinOut += R.count[c] - CU.thin[c];
    Object.assign(ST, { cellsDrawn: ord.length, drawn, draws: runs.length, tris, out, hidden, thinOut, perLod, eyes: E.length });
  }

  // ------------------------------------------------------------ the set: what to build, and each frame
  const BUILD = { it: null, want: '', R: null, t0: 0 };
  const N_OPT = [1000, 10000, 30000, 100000, 300000, 1000000], fmtK = v => (v >= 1e6 ? v / 1e6 + 'M' : v >= 1000 ? v / 1000 + 'k' : String(v));
  const near = (list, x) => list.reduce((b, v) => (Math.abs(v - x) < Math.abs(b - x) ? v : b), list[0]);
  let statT = 0, freezeT = null;
  const FT = { ring: [], sum: 0 };
  return Object.assign(set, {
    // crowds_n balls; crowds_size their size; crowds_draw 0 impostors, 1 meshes; crowds_what 0 cloud, 1 packed proteins;
    // crowds_shade 0 lit, 1 flat, 2 outline; crowds_ao ambient shading; crowds_col 0 kind, 1 cell, 2 detail; and the four
    // culling switches: crowds_grid (cells out of view), crowds_lod (detail by distance), crowds_order (front to back),
    // crowds_hide (hidden cells)
    params: { crowds_a: 1, crowds_n: 100000, crowds_size: 1, crowds_draw: 0, crowds_what: 1, crowds_shade: 0, crowds_ao: 1, crowds_col: 0,
      crowds_grid: 1, crowds_lod: 1, crowds_order: 1, crowds_hide: 1 },
    update(S, t, dt) {
      const n = near(N_OPT, S.crowds_n), what = S.crowds_what >= 0.5 ? 1 : 0, mode = S.crowds_draw >= 0.5 && isGL2() ? 1 : 0, want = n + '|' + what;
      // a new crowd is built in slices (the frame's build budget, buildMs); the old one is drawn until it is done
      if (want !== BUILD.want) { BUILD.want = want; BUILD.it = build(n, what, 11 + n + 7 * what); BUILD.t0 = performance.now(); BUILD.n = n; }
      if (BUILD.it) {
        const t0 = performance.now(), ms = buildMs(dt);
        let r;
        while (!(r = BUILD.it.next()).done && performance.now() - t0 < ms);
        if (r.done) { GPU.R = r.value; BUILD.it = null; upload(mode); ST.ms = Math.round(performance.now() - BUILD.t0); if (set.onBuild) set.onBuild(); }
      }
      if (GPU.R && mode !== GPU.mode) upload(mode);
      SU.uT.value = freezeT === null ? t : freezeT;
      SU.uHalf.value = BALLS.half();
      SU.uSize.value = S.crowds_size; SU.uShade.value = Math.round(S.crowds_shade); SU.uAo.value = S.crowds_ao >= 0.5 ? 1 : 0; SU.uColBy.value = Math.round(S.crowds_col);
      cull({ size: S.crowds_size, grid: S.crowds_grid >= 0.5, lod: S.crowds_lod >= 0.5, order: S.crowds_order >= 0.5, hide: S.crowds_hide >= 0.5 });
      // the frame times of the last second, and the read-out (twice a second)
      // (the page's own clock: the frame's dt is capped at 0.1 s, so a slow frame would read as 10 a second)
      const now = performance.now(), fd = FT.last ? (now - FT.last) / 1000 : 0;
      FT.last = now;
      if (fd > 0 && fd < 5) { FT.ring.push(fd); FT.sum += fd; while (FT.sum > 1 && FT.ring.length > 1) FT.sum -= FT.ring.shift(); }
      const R = GPU.R;
      Object.assign(ST, { n: R ? R.n : 0, cells: R ? R.NC : 0, G: R ? R.G : 0, what: R ? R.what : what, mode: GPU.mode, gl2: isGL2(), mols: R ? R.mols : 0, kinds: R ? R.kinds : [],
        building: BUILD.it ? BUILD.n : 0, info: GL.renderer.info.render });
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
      hold(on) { HOLD.on = !!on; HOLD.eyes = null; }, held: () => HOLD.on,
      // for tests and the sweep: the jiggle stopped at a time (null: going again)
      freeze(t) { freezeT = t; },
      // for the sweep: every cell at one detail level (0 or 1; meshes 0 to 2), no thinning (null: by distance again)
      force(L) { FORCE.lod = L; },
      ready: () => !BUILD.it && !!GPU.R,
      kindNames: ['tubulin', 'GAPDH', 'actin', 'calmodulin', 'ubiquitin'],
    }),
    anchors: { centre: [0, 0, 0], corner: [HD, HD, HD], top: [0, HD + 0.08, 0] },
    labels: [],
    cam: { default: [32, 22, 3.4, 0, 0, 0], close: [40, 14, 1.25, 0.12, 0.05, 0.12], inside: [30, 6, 0.32, 0, 0, 0] },
    controls: [
      { key: 'n', label: 'Balls', options: N_OPT.map(v => [String(v), fmtK(v)]) },
      { key: 'what', label: 'What', options: [['1', 'Packed proteins'], ['0', 'Made-up cloud']] },
      { key: 'draw', label: 'Drawn as', options: [['0', 'Impostors'], ['1', 'Meshes']] },
      { key: 'size', label: 'Size', options: [['1', 'As packed'], ['0.6', 'Smaller'], ['1.4', 'Larger']] },
      { key: 'shade', label: 'Shading', options: [['0', 'Lit'], ['1', 'Flat'], ['2', 'Outline']] },
      { key: 'ao', label: 'Ambient shading', options: [['1', 'On'], ['0', 'Off']] },
      { key: 'col', label: 'Colour', options: [['0', 'By kind'], ['1', 'By cell'], ['2', 'By detail']] },
      { key: 'view', label: 'View', options: [['default', 'Outside'], ['close', 'Close'], ['inside', 'Inside']] },
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
