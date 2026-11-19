// Six handshakes, the example story package (tools/packages/SPEC.md): 60 people on a ring, each knowing their four
// nearest; rewiring a few links at random makes everyone close while the ring still looks local (after Watts and
// Strogatz, Nature 1998). The network is an example, made and measured here (HELLO); nothing is typed in.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by src/build.mjs from the app's kit (tools/lbi/kit.js), the shared engine parts (tools/engine/) and the sets and
// engine files in src/: edit those, not this file.
HOST.register('hello', function (HOST) {
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
    // see-through is decided when the frame is drawn, from the opacity the material has then (sets may lower it again in
    // update()); non-normal blending (additive glows) always stays see-through. `transparent` is no program parameter in r128.
    Object.defineProperty(mat, 'transparent', { configurable: true, get: () => mat.opacity < 0.999 || mat.blending !== THREE.NormalBlending, set() {} });
    mat.userData.base = base;
    mat.opacity = base;
    set.fades.push(mat);
    return mat;
  }
  // A ShaderMaterial whose fragment alpha is uA times the named uniforms (and nothing per vertex or instance): it counts as
  // see-through only while that product is under 1, so solid models at full fade draw in the opaque pass, front to back.
  // `transparent` is not a program parameter in r128, so reading it live costs no recompile.
  function solid(mat, ...names) {
    const U = mat.uniforms;
    Object.defineProperty(mat, 'transparent', { configurable: true, get: () => { let a = U.uA.value; for (const n of names) a *= U[n].value; return a < 0.999; }, set() {} });
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
        m.depthWrite = o > 0.97 && m.userData.base > 0.97 && m.blending === THREE.NormalBlending;
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
  // Sends a Float32 attribute's used part (n items) to the graphics card only where it changed since it last went (the
  // topo story's v136 `upload`, here for every set that rewrites buffers each frame): the 32-bit words of the range against
  // a copy of what last went, the stretch from the first change to the last as the update range; nothing when it is the
  // same. A range set before and not sent yet is kept (three.js sets its count back to -1 once it has gone).
  function upload(attr, n) {
    const k = attr.itemSize, len = n * k, a = attr.array, R = attr.updateRange;
    if (!len) return;
    const w = attr.words || (attr.words = new Uint32Array(a.buffer, a.byteOffset, a.length)), s = attr.sent || (attr.sent = new Uint32Array(a.length));
    let i = 0, j = len - 1;
    if (attr.sentN === len) {
      while (i < len && w[i] === s[i]) i++;
      if (i === len) return;
      while (w[j] === s[j]) j--;
    }
    let o = i - i % k, e = j - j % k + k;
    s.set(w.subarray(o, e), o); attr.sentN = len;
    if (R.count !== -1) { e = Math.max(e, R.offset + R.count); o = Math.min(o, R.offset); }
    R.offset = o; R.count = e - o; attr.needsUpdate = true;
  }
  // ms a set on show may build in one frame when it is not built yet (the engine's budget, buildMs: about 1 ms in a headset,
  // so never under 2 here: a set wanted now must not take a minute; on a page the whole `ms`, buildMs being only 2 to 8 ms there)
  const showMs = (dt, ms) => (typeof buildMs === 'function' && typeof GL !== 'undefined' && GL.renderer && GL.renderer.xr && GL.renderer.xr.isPresenting ? Math.min(ms, Math.max(2, buildMs(dt))) : ms);
  // free GPU memory of a set (the engine calls this on dispose)
  function dispose(set) {
    set.group.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); m.dispose(); });
    });
  }
  return { THREE, smooth, clamp, lerp, prog, rng, gauss, v3, unit, rgb, ramp, U, GLSL, points, lines, fade, rim, solid, newSet,
    pointsGeo, linesGeo, tube, merge, paint, upload, showMs, dispose };
}
const K = makeKit(THREE);
const { smooth, clamp } = K;

// the package's key (its folder's name, from story.json) and its files' addresses: everything it loads goes through
// HOST.pkgUrl, which gives each file's address with its fingerprint (a changed file is fetched anew)
const KEY = 'hello';
const pkgUrl = file => (HOST.pkgUrl ? HOST.pkgUrl(KEY, file) : `packages/${KEY}/${file}`);
// what the index says about this package (its title, its files), or null
const pkgMeta = () => (HOST.packages && HOST.packages.get(KEY)) || (HOST.meta && HOST.meta(KEY)) || null;
// ================================================================== SETS ==
// Each set is one 3D scene of the story, centred on the origin. The story fades sets in and out and drives them
// through their params (see SETS.x.params); the set contract is tools/lbi/SPEC.md, "What a set exports".
const SETS = {};
// The example's network, after Watts and Strogatz (Nature, 1998): N people on a ring, each knowing the K/2 nearest on
// either side; each of those links may be rewired, keeping one end and moving the other to someone anywhere on the ring
// (a seeded draw, so every device and every run shows the same network). A link is rewired at probability p when its
// own draw u is below p, so raising p only adds shortcuts and lowering it takes them back. Every number the story and
// the panes quote is computed here, on this example (HELLO.stats, HELLO.path), never typed in.
const HELLO = (() => {
  const N = 60, K = 4, SEED = 20251119;
  // a small seeded generator (mulberry32)
  const rng = s => () => { s = (s + 0x6d2b79f5) | 0; let t = Math.imul(s ^ (s >>> 15), 1 | s); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const r = rng(SEED), ringD = (a, b) => { const d = Math.abs(a - b) % N; return Math.min(d, N - d); };
  // the links, in Watts and Strogatz's order (the nearest neighbours round the ring, then the next): i to j0 = i + d; u,
  // the draw that says when it is rewired; t, the new far end (never i, never one of i's own ring neighbours)
  const links = [];
  for (let d = 1; d <= K / 2; d++) for (let i = 0; i < N; i++) {
    const u = r();
    let t;
    do t = Math.floor(r() * N); while (ringD(i, t) <= K / 2);
    links.push({ i, j0: (i + d) % N, u, t });
  }
  // the rewiring level r (0..1, what the story keys and eases) and the probability p: p = (1000^r - 1) / 999, so the
  // small p where the change happens take most of the way (r 0.33 is about 1 %, 0.5 about 3 %, 0.67 about 10 %)
  const pOf = lv => (lv <= 0 ? 0 : lv >= 1 ? 1 : (Math.pow(1000, lv) - 1) / 999);
  const levelOf = p => (p <= 0 ? 0 : p >= 1 ? 1 : Math.log(1 + 999 * p) / Math.log(1000));
  links.forEach(L => { L.lv = levelOf(L.u); });
  // the network at p: each person's friends (sorted, no repeats), cached by how many links are rewired
  const cache = new Map();
  function graph(p) {
    const on = links.map(L => L.u < p), id = on.reduce((s, x, k) => (x ? s + ',' + k : s), '');
    if (cache.has(id)) return cache.get(id);
    const adj = Array.from({ length: N }, () => new Set());
    links.forEach((L, k) => { const j = on[k] ? L.t : L.j0; adj[L.i].add(j); adj[j].add(L.i); });
    const g = { adj: adj.map(s => [...s].sort((a, b) => a - b)), rewired: on.filter(Boolean).length, m: 0 };
    g.m = g.adj.reduce((s, a) => s + a.length, 0) / 2;
    cache.set(id, g);
    return g;
  }
  // hops from person a to everyone (breadth first); -1 where no chain of friends reaches
  function hops(g, a, prev) {
    const d = new Array(N).fill(-1), q = [a];
    d[a] = 0;
    for (let h = 0; h < q.length; h++) for (const j of g.adj[q[h]]) if (d[j] < 0) { d[j] = d[q[h]] + 1; if (prev) prev[j] = q[h]; q.push(j); }
    return d;
  }
  // the network's numbers at p: the average number of handshakes between two people (over the pairs that are linked at
  // all), the most (the network's diameter), how many pairs no chain links, and how often two of a person's friends know
  // each other (the clustering coefficient, averaged over everyone with two friends or more)
  const stats = p => {
    const g = graph(p);
    if (g.stats) return g.stats;
    let sum = 0, n = 0, most = 0, apart = 0, cl = 0, cn = 0;
    for (let a = 0; a < N; a++) {
      const d = hops(g, a);
      for (let b = a + 1; b < N; b++) if (d[b] < 0) apart++; else { sum += d[b]; n++; most = Math.max(most, d[b]); }
      const f = g.adj[a], k = f.length;
      if (k >= 2) {
        let t = 0;
        for (let x = 0; x < k; x++) for (let y = x + 1; y < k; y++) if (g.adj[f[x]].includes(f[y])) t++;
        cl += t / (k * (k - 1) / 2); cn++;
      }
    }
    return (g.stats = { avg: n ? sum / n : 0, most, apart, clust: cn ? cl / cn : 0, rewired: g.rewired, links: links.length, m: g.m });
  };
  // the shortest chain of friends from a to b at p (the first found, friends taken in order, so the same on every device),
  // as a list of people from a to b; null when there is none
  function path(p, a, b) {
    if (!(a >= 0 && a < N && b >= 0 && b < N)) return null;
    const g = graph(p), prev = new Array(N).fill(-1), d = hops(g, a, prev);
    if (d[b] < 0) return null;
    const out = [b];
    while (out[0] !== a) out.unshift(prev[out[0]]);
    return out;
  }
  // where person i stands: on a ring of radius 1, the first at the front, going round anticlockwise seen from above
  const pos = i => { const th = 2 * Math.PI * i / N; return [Math.sin(th), 0, Math.cos(th)]; };
  // the shape of a link from i to j, n + 1 points: a ring link stays on the ring (a chord), a shortcut arches over it,
  // the higher the longer
  function arc(i, j, n) {
    const a = pos(i), b = pos(j), c = Math.hypot(b[0] - a[0], b[2] - a[2]), up = ringD(i, j) <= K / 2 ? 0 : 0.75 * c, out = [];
    for (let s = 0; s <= n; s++) {
      const f = s / n;
      out.push([a[0] + (b[0] - a[0]) * f, up * 2 * f * (1 - f), a[2] + (b[2] - a[2]) * f]);
    }
    return out;
  }
  return { N, K, links, pOf, levelOf, graph, stats, path, pos, arc, ringD };
})();

// The ring set: the example's 60 people on a ring of radius 1 (HELLO), each with a link to the four nearest, and the
// shortcuts that rewiring makes, arching over the ring; in the middle a counter, a stack of discs as high as the
// average number of handshakes between two people (computed for the network on show).
// params: ring_people (0..1, the people appear round the ring), ring_links (0..1, their links drawn), ring_rw (the
// rewiring level 0..1: HELLO.pOf gives the probability; each link moves at its own level, its old line fading as the
// new arch grows), ring_count (0..1, the counter).
SETS.ring = function (K) {
  const { THREE, clamp, prog, rgb } = K;
  const set = K.newSet('ring');
  const H = HELLO, N = H.N, L = H.links, SEG = 16;
  const COL = { person: '#d8e6ff', ring: rgb('#5fa8ff'), short: rgb('#ffb43b'), disc: '#46d9ff' };
  // the people: lit balls, and a soft glow under each
  const ball = new THREE.SphereGeometry(0.034, 16, 12);
  const people = new THREE.InstancedMesh(ball, K.fade(set, new THREE.MeshStandardMaterial({ color: COL.person, roughness: 0.4, metalness: 0.05 })), N);
  set.group.add(people);
  const glow = K.pointsGeo(N);
  for (let i = 0; i < N; i++) { glow.attributes.position.array.set(H.pos(i), 3 * i); glow.attributes.aCol.array.set(rgb('#7fc4ff'), 3 * i); glow.attributes.aSize.array[i] = 0.16; }
  set.group.add(new THREE.Points(glow, K.points(set)));
  // the links: each one's ring line (one segment, a chord) and its shortcut (SEG segments, an arch), both drawn always,
  // their alpha set by how far the link has moved
  const lg = K.linesGeo(L.length * (1 + SEG)), LP = lg.attributes.position.array, LC = lg.attributes.aCol.array, LA = lg.attributes.aA.array, LT = lg.attributes.aT.array;
  L.forEach((l, k) => {
    const a = H.pos(l.i), b = H.pos(l.j0), o = k * (1 + SEG);
    LP.set([...a, ...b], 6 * o); LC.set([...COL.ring, ...COL.ring], 6 * o);
    const pts = H.arc(l.i, l.t, SEG);
    for (let s = 0; s < SEG; s++) { LP.set([...pts[s], ...pts[s + 1]], 6 * (o + 1 + s)); LC.set([...COL.short, ...COL.short], 6 * (o + 1 + s)); }
    // (the ring lines are revealed round the ring by ring_links: aT is the link's place)
    LT.fill(((l.i + (l.j0 === (l.i + 1) % N ? 0 : 0.5)) / N) * 0.98, 2 * o, 2 * o + 2);
  });
  const lm = K.lines(set);
  set.group.add(new THREE.LineSegments(lg, lm));
  // the counter: up to 16 discs, one per handshake (the last one a part), on a thin stem
  const DISC = 0.045, discs = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.11, 0.11, DISC * 0.7, 32), K.fade(set, new THREE.MeshStandardMaterial({ color: COL.disc, roughness: 0.35, metalness: 0.2, emissive: 0x0b3a4a })), 16);
  set.group.add(discs);
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), v = new THREE.Vector3(), sc = new THREE.Vector3();
  let cur = { p: 0, s: H.stats(0), count: 0 };
  function update(S) {
    const lv = clamp(S.ring_rw, 0, 1), p = H.pOf(lv), st = H.stats(p), show = clamp(S.ring_people, 0, 1);
    cur = { p, s: st, count: clamp(S.ring_count, 0, 1) };
    for (let i = 0; i < N; i++) {
      const a = prog(show, i / N * 0.85, i / N * 0.85 + 0.15);
      v.fromArray(H.pos(i)); sc.setScalar(Math.max(1e-4, a));
      people.setMatrixAt(i, m4.compose(v, q, sc));
      glow.attributes.aA.array[i] = 0.35 * a;
    }
    people.instanceMatrix.needsUpdate = true;
    K.upload(glow.attributes.aA, N);
    lm.uniforms.uReveal.value = clamp(S.ring_links, 0, 1);
    // each link: its ring line fades out and its arch grows from its own end as the level passes the link's own
    const reveal = clamp(S.ring_links, 0, 1);
    L.forEach((l, k) => {
      const f = clamp((lv - l.lv) / 0.04 + 0.5, 0, 1), o = k * (1 + SEG);
      LA[2 * o] = LA[2 * o + 1] = 0.75 * (1 - f);
      for (let s = 0; s < SEG; s++) { const g = clamp(f * SEG - s, 0, 1) * (reveal >= 0.999 ? 1 : 0); LA[2 * (o + 1 + s)] = LA[2 * (o + 1 + s) + 1] = 0.95 * g; }
    });
    K.upload(lg.attributes.aA, L.length * (1 + SEG) * 2);
    // the counter: as many discs as handshakes on average
    const h = st.avg * cur.count;
    for (let d = 0; d < 16; d++) {
      const part = clamp(h - d, 0, 1);
      v.set(0, DISC * (d + 0.5 * part), 0); sc.set(part > 0 ? 1 : 1e-4, Math.max(1e-4, part), part > 0 ? 1 : 1e-4);
      discs.setMatrixAt(d, m4.compose(v, q, sc));
    }
    discs.instanceMatrix.needsUpdate = true;
  }
  // picking: the person a ray (world coordinates) passes nearest, or -1
  const inv = new THREE.Matrix4(), ray = new THREE.Ray(), pp = new THREE.Vector3();
  function pick(rc) {
    inv.copy(set.group.matrixWorld).invert();
    ray.copy(rc.ray).applyMatrix4(inv);
    // (the one the ray passes closest: neighbours 0.1 apart can both be in reach seen from low down)
    let best = -1, bd = 0.07 * 0.07;
    for (let i = 0; i < N; i++) {
      const d = ray.distanceSqToPoint(pp.fromArray(H.pos(i)));
      if (d < bd && pp.sub(ray.origin).dot(ray.direction) > 0) { bd = d; best = i; }
    }
    return best;
  }
  const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
  return Object.assign(set, {
    params: { ring_a: 1, ring_people: 1, ring_links: 1, ring_rw: 0, ring_count: 1 },
    update,
    anchors: { centre: [0, 0, 0], front: H.pos(0), back: H.pos(30), top: () => [0, DISC * cur.s.avg * cur.count + 0.05, 0], side: [1.05, 0.05, 0.25] },
    labels: [{ text: () => [`${f1(cur.s.avg)} handshakes`, 'on average'], at: 'top', cls: 'cyn', alpha: S => prog(S.ring_count, 0.6, 1) }],
    cam: { default: [0, 34, 5.2, 0, 0.12, 0], top: [0, 78, 5.0, 0, 0, 0], low: [24, 9, 4.4, 0, 0.22, 0] },
    controls: [
      { key: 'rw', label: 'Rewired links', options: [['0', 'None'], ['0.01', '1%'], ['0.05', '5%'], ['0.1', '10%'], ['0.3', '30%'], ['1', 'All']] },
      { key: 'view', label: 'View', options: [['default', 'Tilted'], ['top', 'From above'], ['low', 'Low']] },
    ],
    explore(c) { return { ring_people: 1, ring_links: 1, ring_count: 1, ring_rw: H.levelOf(+c.rw || 0) }; },
    api: () => ({ pick, pos: i => H.pos(i), now: () => cur }),
  });
};

// The path set: the shortest chain of friends between two people of the ring (HELLO.path, on the network the ring set
// shows: it reads ring_rw), as a glowing tube that runs hop by hop along the links, the two people ringed.
// params: path_from, path_to (the two people, by number; -1 none: they jump, never ease), path_show (0..1, the hops
// drawn one after the other). Drawn over the ring set, in the same frame.
SETS.path = function (K) {
  const { THREE, clamp, rgb } = K;
  const set = K.newSet('path');
  const H = HELLO, N = H.N, SEG = 12, MAXH = 24;
  // the hops: short cylinders along each hop's shape (a chord on the ring, an arch for a shortcut)
  const tube = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.014, 0.014, 1, 8, 1, true), K.fade(set, new THREE.MeshBasicMaterial({ color: '#ff5ad9' })), MAXH * SEG);
  set.group.add(tube);
  // the two people, ringed (A cyan, B amber), and a glow on everyone the chain passes
  const ringG = new THREE.TorusGeometry(0.075, 0.009, 8, 40);
  const ends = [rgb('#46d9ff'), rgb('#ffb43b')].map(c => {
    const m = new THREE.Mesh(ringG, K.fade(set, new THREE.MeshBasicMaterial({ color: new THREE.Color(...c) })));
    m.rotation.x = Math.PI / 2; set.group.add(m); return m;
  });
  const glow = K.pointsGeo(MAXH + 1);
  for (let i = 0; i <= MAXH; i++) { glow.attributes.aCol.array.set(rgb('#ff8ae6'), 3 * i); glow.attributes.aSize.array[i] = 0.2; }
  set.group.add(new THREE.Points(glow, K.points(set)));
  const m4 = new THREE.Matrix4(), q = new THREE.Quaternion(), a = new THREE.Vector3(), b = new THREE.Vector3(), up = new THREE.Vector3(0, 1, 0), sc = new THREE.Vector3();
  const hide = new THREE.Matrix4().makeScale(1e-4, 1e-4, 1e-4);
  let cur = { path: null, from: -1, to: -1 };
  function update(S) {
    const p = H.pOf(clamp(S.ring_rw || 0, 0, 1)), from = Math.round(S.path_from), to = Math.round(S.path_to);
    const path = from >= 0 && to >= 0 && from !== to ? H.path(p, from, to) : null, hops = path ? Math.min(MAXH, path.length - 1) : 0;
    cur = { path, from, to };
    const shown = clamp(S.path_show, 0, 1) * hops;
    let n = 0;
    for (let h = 0; h < hops; h++) {
      const pts = H.arc(path[h], path[h + 1], SEG), f = clamp(shown - h, 0, 1);
      for (let s = 0; s < SEG; s++, n++) {
        const g = clamp(f * SEG - s, 0, 1);
        if (g <= 0) { tube.setMatrixAt(n, hide); continue; }
        a.fromArray(pts[s]); b.fromArray(pts[s + 1]); b.sub(a);
        const len = b.length() * g;
        q.setFromUnitVectors(up, b.normalize());
        a.addScaledVector(b, len / 2);
        tube.setMatrixAt(n, m4.compose(a, q, sc.set(1, len, 1)));
      }
    }
    for (; n < MAXH * SEG; n++) tube.setMatrixAt(n, hide);
    tube.instanceMatrix.needsUpdate = true;
    [from, to].forEach((i, k) => { ends[k].visible = i >= 0 && i < N; if (ends[k].visible) ends[k].position.fromArray(H.pos(i)); });
    for (let i = 0; i <= MAXH; i++) {
      const on = path && i <= hops && clamp(shown - i + 1, 0, 1) > 0;
      glow.attributes.aA.array[i] = on ? 0.55 : 0;
      if (on) glow.attributes.position.array.set(H.pos(path[i]), 3 * i);
    }
    glow.attributes.position.needsUpdate = true; glow.attributes.aA.needsUpdate = true;
  }
  const at = i => () => (i >= 0 && i < N ? H.pos(i).map((x, k) => (k === 1 ? x + 0.1 : x * 1.12)) : [0, 0, 0]);
  return Object.assign(set, {
    params: { path_a: 1, path_from: 0, path_to: 30, path_show: 1 },
    update,
    anchors: { a: () => at(cur.from)(), b: () => at(cur.to)() },
    labels: [
      { text: () => (cur.from >= 0 ? ['A', `person ${cur.from + 1}`] : ['', '']), at: 'a', cls: 'cyn', alpha: S => clamp(S.path_show * 4, 0, 1) },
      { text: () => (cur.to >= 0 ? ['B', cur.path ? `${cur.path.length - 1} handshakes from A` : `person ${cur.to + 1}`] : ['', '']), at: 'b', cls: 'amb', alpha: S => clamp(S.path_show * 4 - 3, 0, 1) },
    ],
    cam: { default: [0, 34, 5.2, 0, 0.12, 0] },
    api: () => ({ now: () => cur }),
  });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story (each sets/<name>.js defines SETS.<name>; list the files in build.mjs)
const SET_ORDER = ['ring', 'path'];
// sets drawn in another set's frame: the path lies on the ring, so the two always turn together
const FRAME = { path: 'ring' };
// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
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
// one set, built as a step of the load (LOAD) and hidden until the story fades it in; what a set needs built first (the
// PET scanner's vision row: its 3D organs) is built a slice a step until done (prep; the step runs again while it says no)
function buildSet(k) {
  if (SETS[k].prep && !SETS[k].prep(25)) return true;
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
const narrowK = () => ((GL.wide && !GL.bare) || !(GL.nf > 1) ? 1 : 1 + (GL.nf - 1) * clamp((1 - (GL.aspect || 1)) / 0.5, 0, 1));
// on a screen held sideways without the side panel (the panel below, the scene in a strip above it) a view may come
// closer and aim lower: v[10] and v[11] (LOW in the story), taken in full from 1.2 : 1 on (as GL.fit's strip)
const lowK = () => (GL.wide || GL.bare ? 0 : clamp(((GL.aspect || 1) - 0.6) / 0.6, 0, 1));
// (v[7..9]: the target's shift clear of the side panel, FIT in the story; on a screen without a side panel it goes back)
function applyCamera(v) {
  const u = GL.wide && !GL.bare ? 0 : 1, L = lowK(), lk = 1 + ((v[10] || 1) - 1) * L;
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
  GL.bare = !!(HOST.focus && HOST.focus());   // focus mode (the shell's): the 3D alone on the page, no panel to clear
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide; GL.aspect = w / h;
  if (GL.bare) camera.setViewOffset(w, h, 0, 0.05 * h, w, h);   // (its middle a little above the page's: more bar below)
  else if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  // (on a narrow screen held sideways the panel leaves only a strip above it, about 0.56 h - 122 px tall: the scene
  // stands back far enough to fit that strip, in full from 1.2 : 1 on; upright screens keep their own framing)
  // (STRIP_FIT: the story's own share of that, 0.9; 0 in the stories framed before it, which keep their framing there)
  const strip = Math.max(0.12, (0.56 * h - 122) / h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62, STRIP_FIT / strip * clamp((w / h - 0.6) / 0.6, 0, 1));
  // (focus mode: the page between the top bar, 48 px, and the bar and subtitles below, 126 px, about the scene's
  // middle at 0.45 h; at fit 1 a scene reaches about 0.95 of the screen's half height up and down, 1 to the sides)
  if (GL.bare) GL.fit = Math.max(1, 0.95 / Math.max(0.25, Math.min(0.45 * h - 48, 0.55 * h - 126) / (0.5 * h)), h / w);
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
// The chapters, on story time (seconds): a key, the name on the timeline, and where each begins and ends.
const CH = [
  { key: 'ring', name: 'Ring', a: 0, b: 24 },
  { key: 'far', name: 'Far', a: 24, b: 46 },
  { key: 'short', name: 'Shortcuts', a: 46, b: 72 },
  { key: 'small', name: 'Small world', a: 72, b: 94 },
];
// Narration timing: [time in the recording, story time] pairs. No recording (captions only): the story's own clock.
const NARRATION_SYNC = [[0, 0], [CH[CH.length - 1].b, CH[CH.length - 1].b]];
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
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; none keyed at an even pace or on a log scale (evalTrack)
const DEF_MORE = {}, LIN = new Set(), LOG = new Set();
const C = Object.fromEntries(CH.map(c => [c.key, c]));

// every param of every set, at rest; the sets themselves start hidden
const DEF = {};
// (DEF_MORE: params of the engine's own beside the sets'; LOG: params tweened on a log scale, the story's and the sets')
function buildDefaults() {
  for (const k of SET_ORDER) Object.assign(DEF, GL.sets[k].params);
  for (const k of SET_ORDER) DEF[k + '_a'] = 0;
  Object.assign(DEF, DEF_MORE);
  for (const k of SET_ORDER) for (const n of GL.sets[k].log || []) LOG.add(n);
}
const TR = {};
const key = (n, t, v) => { (TR[n] = TR[n] || []).push([t, v]); };
const ramp = (n, t0, t1, v0, v1) => { key(n, t0, v0); key(n, t1, v1); };
// a param at story time t, eased between its keys; LIN's run at an even pace, LOG's on a log scale (the story's logMix)
function evalTrack(n, t) {
  const ks = TR[n];
  if (!ks) return DEF[n];
  if (t <= ks[0][0]) return ks[0][1];
  for (let i = 1; i < ks.length; i++) {
    if (t <= ks[i][0]) {
      const [t0, v0] = ks[i - 1], [t1, v1] = ks[i], x = (t - t0) / (t1 - t0);
      if (t1 <= t0) return v1;
      return LOG.has(n) ? logMix(v0, v1, smooth(x)) : v0 + (v1 - v0) * (LIN.has(n) ? x : smooth(x));
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

const ST = { labels: [], items: [], stand: [] };   // (stand: the headset's stand views, see standView)
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
// each set's views nudged so they fit beside the side panel on a wide screen: none here
const FIT = {};
// how much further back a view stands on a phone held upright: the ring is wide
const NARROW = { ring: { default: 1.25, top: 1.25, low: 1.2 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on
// a light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
const CYAN = '#46d9ff', AMBER = '#ffb43b', MAGENTA = '#ff5ad9';
// ------------------------------------------------------------------ facts --
// The numbers the story quotes, computed from the example's network (HELLO) at the rewiring the story shows: none,
// a few shortcuts (P1) and all links (1); the two people across the ring are A = 1 and B = 31.
const P1 = 0.05, A0 = 0, B0 = 30;
const f1 = x => (Math.round(x * 10) / 10).toFixed(1);
const pct = x => `${Math.round(100 * x)}%`;
const FACTS = (() => {
  const H = HELLO, at = p => Object.assign({ hops: (H.path(p, A0, B0) || []).length - 1 }, H.stats(p));
  return { n: H.N, k: H.K, links: H.links.length, none: at(0), few: at(P1), all: at(1) };
})();

function buildStory() {
  const F = FACTS, Z = F.none, S1 = F.few, R = F.all, H = HELLO;
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // (the headset's panel cannot scroll: parts that take turns in one place, each fading out as the next comes)
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const html = {
    ring: `<h1 data-at="0.6">${esc(XR_TITLE)}</h1>
      <p class="lede" data-at="1.6">How a few shortcuts make a big world small</p>
      ${turns(`<p data-at="3" data-out="14.5">${cap(word(F.n))} people stand in a ring. Each one knows the ${word(F.k / 2)} people on either side: ${word(F.k)} friends each.</p>
        <p data-at="9" data-out="14.5">Friends of friends mostly know each other too, as in a village: ${pct(Z.clust)} of the pairs of anyone's friends are friends.</p>`,
      `<p data-at="15">How many handshakes link two people, on average? Count them along the friendships.</p>
        <p data-at="18" class="amber">Here: ${f1(Z.avg)}, the stack in the middle.</p>`)}`,
    far: `<h2 data-at="0.6">A long way round</h2>
      ${turns(`<p data-at="1.2" data-out="13.5">Take two people on opposite sides of the ring, A and B.</p>
        <p data-at="4" data-out="13.5">A message passed from friend to friend needs ${Z.hops} handshakes to get from A to B.</p>`,
      `<p data-at="14" class="amber">In a ring, the way across grows with its size: twice the people, twice the handshakes.</p>`)}`,
    short: `<h2 data-at="0.6">A few shortcuts</h2>
      ${turns(`<p data-at="1.2" data-out="15.5">Now a few people swap one friend for someone anywhere on the ring, picked at random.</p>
        <ul class="steps">${step(5, 15.5, AMBER, `${cap(word(S1.rewired))} of ${F.links} friendships`, 'move: each one a shortcut, arching over the ring')}</ul>`,
      `<p data-at="16" class="amber">The way from A to B drops to ${S1.hops} handshakes, and the average to ${f1(S1.avg)}.</p>
        <p data-at="19">Yet the ring still looks local: ${pct(S1.clust)} of friends' friends still know each other, against ${pct(Z.clust)} before.</p>`)}`,
    small: `<h2 data-at="0.6">Small worlds</h2>
      ${turns(`<p data-at="1.2" data-out="11.5">Rewire every link and the ring becomes a random tangle: ${f1(R.avg)} handshakes on average, but only ${pct(R.clust)} of friends' friends know each other.</p>`,
      `<p data-at="12">A few shortcuts are enough: close like a random network, local like a village. Duncan Watts and Steven Strogatz called this a small world.</p>
        <p data-at="16" class="amber">It helps explain why strangers are often only a few handshakes apart.</p>
        <p data-at="18.5"><button class="btn primary" id="btnGoExplore" type="button">Rewire it yourself</button></p>
        <p class="credits" data-at="19">An example network of ${F.n} people, made and measured here. After D. J. Watts and S. H. Strogatz, Collective dynamics of 'small-world' networks, Nature 393, 440 to 442 (1998).</p>`)}`,
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
    wp.push([t, ...v, ease, frameOf(k), narrowOf(k, name), fitShift(k, name)]);
  };
  // (the shortcuts' level: every link with a smaller draw has moved)
  const L1 = H.levelOf(P1);
  start({ ring_people: 0, ring_links: 0, ring_rw: 0, ring_count: 0, path_from: A0, path_to: B0, path_show: 0 });
  let a, b;
  // Sixty people in a ring, their links drawn round it, then the counter
  a = C.ring.a; b = C.ring.b;
  show('ring', 0.2, 1.5);
  ramp('ring_people', a + 2.5, a + 6.5, 0, 1);
  ramp('ring_links', a + 6, a + 10, 0, 1);
  ramp('ring_count', a + 15.5, a + 18, 0, 1);
  cam(a, 'ring', 'low', -30);
  cam(a + 9, 'ring', 'default', -12);
  cam(b - 0.5, 'ring', 'default', 6, 'spin');
  // A long way round: the chain from A to B, hop by hop
  a = C.far.a; b = C.far.b;
  show('path', a + 1, a + 2);
  ramp('path_show', a + 4, a + 12, 0, 1);
  cam(a + 3, 'ring', 'top', -4);
  cam(b - 0.5, 'ring', 'top', 6, 'spin');
  // A few shortcuts: the level rises to P1, each link moving at its own; the chain and the counter follow
  a = C.short.a; b = C.short.b;
  ramp('ring_rw', a + 5, a + 14, 0, L1);
  cam(a + 3, 'ring', 'low', -10);
  cam(a + 15, 'ring', 'default', 0);
  cam(b - 0.5, 'ring', 'default', 10, 'spin');
  // Small worlds: every link rewired, then back to a few
  a = C.small.a; b = C.small.b;
  ramp('ring_rw', a + 1, a + 7, L1, 1);
  ramp('ring_rw', a + 11, a + 15, 1, L1);
  cam(a + 2, 'ring', 'default', 4);
  cam(b, 'ring', 'default', 22, 'spin');
  // ---- sound effects (sfxCue: story time, a sound, where it comes from (set, anchor), its options)
  sfxCue(C.ring.a + 2.5, 'patter', 'ring', 'front', { dur: 4, gain: 0.3 });             // the people appear
  sfxCue(C.ring.a + 6, 'grow', 'ring', 'centre', { dur: 4, gain: 0.35 });               // their links
  sfxCue(C.ring.a + 15.5, 'rise', 'ring', 'top', { dur: 2.5, gain: 0.5 });              // the counter
  for (let h = 0; h < Z.hops; h += 3) sfxCue(C.far.a + 4 + 8 * h / Z.hops, 'pulse', 'path', 'a', { pitch: Math.pow(2, h / 24), gain: 0.4, seq: true });   // the chain, hop by hop
  // each shortcut as it moves (the level crossing its link's own)
  const rampAt = (t0, t1, v0, v1, v) => { let lo = 0, hi = 1; for (let i = 0; i < 24; i++) { const m = (lo + hi) / 2; if (v0 + (v1 - v0) * smooth(m) < v) lo = m; else hi = m; } return t0 + (t1 - t0) * lo; };
  H.links.filter(l => l.lv < L1).forEach((l, i) => sfxCue(rampAt(C.short.a + 5, C.short.a + 14, 0, L1, l.lv), 'snap', 'ring', 'centre', { pitch: Math.pow(2, i / 12), gain: 0.45 }));
  sfxCue(C.small.a + 1, 'whoosh', 'ring', 'centre', { dur: 6, pitch: 0.8 });              // every link rewired
  sfxCue(C.small.a + 11, 'whoosh', 'ring', 'centre', { dur: 4, pitch: 1.1 });             // and back to a few
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  label('ring', 'side', '<b>Four friends</b> · each', C.ring.a + 8, C.ring.a + 14.5, 'cyn');
}
// no set turns into another at a hand-over (buildCamera's MORPH)
const MORPH = {};
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set, narrow factor, FIT's target shift (, LOW's two)]; 'spin'
// segments turn at a steady pace.
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
      // (a set that the one before turns into, MORPH, takes its turn: the things of the one fly to the other's places)
      cur = { k: w[8], t0: w[0], c: cur && MORPH[w[8]] === cur.k ? cur.c : Math.abs(d) > 40 ? d : 0 };
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[9] || 1, ...w.slice(10)];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
// (sets in one frame share one turn: FRAME)
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
    // (a label's text may be a function: it follows what the set shows, and the pass story's language, see labelText)
    const fn = typeof L.text === 'function' ? L.text : null, [b, r] = fn ? fn() : L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${sfxSpan(r)}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1,
      fn, tx: fn ? b + '|' + r : '', none: !b && !r, cls: L.cls });
  }
}
// a label whose text is a function (a count, an age, a pick, a share, an angle ...) is read again while it shows and
// redrawn when it changes: the HTML label, and the headset's sprite (dropped, so it is made again)
function labelText(L) {
  if (!L.fn) return;
  const now = performance.now();
  if (L.tx && now - (L.tt || 0) < 100) return;   // (read at most ten times a second)
  L.tt = now;
  const [b, r] = L.fn(), s = b + '|' + r;
  if (s === L.tx) return;
  L.tx = s; L.none = !b && !r;
  L.el.innerHTML = `<b>${esc(b)}</b>${sfxSpan(r)}`;
  L.w = 0; L.nar = undefined; labelRedraw(L);
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
// where a label points, in the world's own coordinates (a life-size set through its holder, GL.life: the pass story's fish)
const _v = new THREE.Vector3();
function labelPos(L, out) {
  const p = anchorOf(L.set, L.at), g = GL.sets[L.set].group;
  out.set(p[0], p[1], p[2]).applyMatrix4(g.matrix);
  return g.parent === GL.life ? out.applyMatrix4(GL.life.matrix) : out;
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
  if (c === CH[0]) {   // (the first chapter's title arc, where it has one)
    const arc = $('#titleArc');
    if (arc) { arc.setAttribute('stroke-dashoffset', (1 - smooth((t - 0.5) / 2.2)).toFixed(3)); $('#titleDot').setAttribute('opacity', smooth((t - 2.5) / 0.4)); }
  }
}

// ------------------------------------------------------------- timeline UI --
function trackHTML() {
  const tr = $('#track');
  tr.innerHTML = '<div class="rail"></div><div class="done"></div>' + CH.slice(1).map(c =>
    `<div class="tick" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%"></div><div class="name" data-k="${c.key}" style="left:${(100 * c.na / T_END).toFixed(2)}%">${c.name}</div>`).join('') + '<div class="knob"></div>';
  tr.setAttribute('aria-valuemax', Math.round(T_END));
}
// (the track's ticks and names: trackHTML, the story's own where it makes them again)
function buildTimeline() {
  const tr = $('#track');
  trackHTML();
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
// Explore mode, one tab: rewire the ring (the ring set's own control, as chips), pick two people (on the ring, or the
// pair across it) and see the shortest chain of handshakes between them, with the network's numbers, computed as you
// choose (HELLO).
const SCENES = [
  ['ring', 'Ring', 'Sixty people, each knowing their four nearest; rewire some of the friendships at random.'],
];
const SCENE_SHORT = {};
const TABS = [['network', 'Network']];
const ctlsOf = k => GL.sets[k].controls || [];
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(ctlsOf(k).map(x => [x.key, ctlValue(k, x)])));
// a, b: the two people picked (by number, 0 to 59; null none); pickT: when the last was picked (the chain is drawn
// from then)
const X = { tab: 'network', scene: 'ring', ctl: { ring: { rw: '0.05' } }, t0: 0, turn: 'on', a: A0, b: B0, pickT: 0 };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['path_from', 'path_to']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a view option's camera: the cam view of the same name
const CAM_ALIAS = {};
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [al[v], v]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, 'view'); return !!c && ctlValue(k, c) === v; };
// what the sets know (their api()): the ring's picking
const API = {};
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];
const isPerson = i => Number.isInteger(i) && i >= 0 && i < HELLO.N;
// the network the chips ask for: its probability and numbers, and the chain from A to B
const rwP = () => Math.max(0, Math.min(1, +ctlValue('ring', ctlOf('ring', 'rw')) || 0));
const netNow = () => { const p = rwP(), s = HELLO.stats(p), path = isPerson(X.a) && isPerson(X.b) && X.a !== X.b ? HELLO.path(p, X.a, X.b) : null; return { p, s, path }; };

// what the scene and the picks ask for: the ring with the chips' rewiring, and over it the chain from A to B, drawn
// hop by hop from the moment it was picked
function exploreTargets(t = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = { t: (t - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  Object.assign(tg, { path_a: isPerson(X.a) ? 1 : 0, path_from: isPerson(X.a) ? X.a : -1, path_to: isPerson(X.b) ? X.b : -1, path_show: clamp((t - X.pickT) / 1500, 0, 1) });
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  // (LOG's params ease on their log scale, as in the story: logMix)
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : LOG.has(n) ? logMix(XS[n], tg[n], k) : XS[n] + (tg[n] - XS[n]) * k;
  // a gently swaying scene, unless you are steering it or a set asks for stillness
  if (X.turn === 'on' && !orbit.to && !orbit.held && !GL.still && !HOST.room.placing()) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 6 * Math.cos(X.sway * 0.25); }
  return XS;
}
// what the panes pick reaches the sets through their params (exploreTargets); here only the labels follow
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
// (sound effects: a control changed: the links move, or the view)
function ctlSound(k, key, v) {
  if (key === 'rw') sfxAct('snap', 'ring', 'centre', { pitch: 0.8 + 0.4 * Math.sqrt(+v || 0) }); else sfxAct('whoosh', k, null, { dur: 0.7, pitch: 1.1 });
}
// a view of a set, its scene brought up
function showView(k, v) { if (X.scene !== k) openScene(k); if (!viewIs(k, v)) setCtl(k, 'view', v); }
// fly the explore camera to view v (over dur seconds, orbit.dur unless given); any flight but the PET story's hand-over
// (hand) takes the camera from that hand-over (X.hand)
function flyTo(v, dur, hand) {
  if (X.hand && !hand) X.hand.flew = true;   // (another flight takes the camera: the hand-over leaves it be)
  orbit.d = dur || 0;
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now(); orbit.fast = false;
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / ((orbit.fast ? 0.25 : orbit.d || orbit.dur) * 1000)), f = orbit.from, t = orbit.to;   // fast: a view from the room
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) { orbit.to = null; orbit.fast = false; }
}
// fly to a point of the scene on show, keeping the direction you look from
function flyNear(p, d) { if (p) flyTo([orbit.cur[0], orbit.cur[1], d, p[0], p[1], p[2]]); }

// a control of a scene picked from a tab: its scene brought up
function sceneCtl(k, key, v) {
  if (X.scene !== k) openScene(k);
  setCtl(k, key, v);
}

// --------------------------------------------------------------- actions --
// the two people: a and b (null none). Picked by hand (ui true) the chain is drawn again from A; a shared room's pair
// arriving (ui false) shows at once.
function setPair(a, b, ui = true) {
  a = isPerson(a) ? a : null; b = isPerson(b) && b !== a ? b : null;
  if (a === X.a && b === X.b) return;
  X.a = a; X.b = b;
  X.pickT = ui ? performance.now() : 0;
  if (ui && a !== null) sfxAct('clink', 'ring', 'centre', { pitch: b === null ? 1 : 1.25 });   // (sound effects: a person picked)
  renderAll();
}
// a person picked on the ring: the first is A, the next B; a third starts again from A; picking A or B again lets go
function pickPerson(i) {
  if (!isPerson(i)) return;
  if (i === X.a) setPair(X.b, null);
  else if (i === X.b) setPair(X.a, null);
  else if (X.a === null || X.b !== null) setPair(i, null);
  else setPair(X.a, i);
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene, the ring's controls (its rewiring and
// view) and the two people. The camera is each person's own. v: the shape of this state (a package changes it only
// together with v, which apply checks).
const COLLAB_V = 1;
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
  return { v: COLLAB_V, tab: X.tab, scene: X.scene, ctl, a: X.a, b: X.b };
}
// show another person's state with the story's own setters (so both panels follow); every field is checked, and the
// camera stays where this person has it
function collabApply(v) {
  if (!v || typeof v !== 'object' || v.v !== COLLAB_V) return;
  if (TABS.some(t => t[0] === v.tab) && v.tab !== X.tab) showTab(v.tab);
  if (SCENES.some(s => s[0] === v.scene) && v.scene !== X.scene) openScene(v.scene);
  for (const [k] of SCENES) for (const c of ctlsOf(k)) {
    const x = v.ctl && v.ctl[k] && v.ctl[k][c.key];
    if (!c.options.some(o => o[0] === x) || ctlValue(k, c) === x) continue;
    if (k === X.scene) setCtl(k, c.key, x); else (X.ctl[k] = X.ctl[k] || {})[c.key] = x;
  }
  if ((v.a === null || isPerson(v.a)) && (v.b === null || isPerson(v.b))) setPair(v.a, v.b, false);
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
const who = i => (isPerson(i) ? `person ${i + 1}` : 'none');
// the network's numbers, as rows [name, value, more] for both panes
function statRows() {
  const { s, path } = netNow();
  return [['Handshakes', f1(s.avg), 'between two people, on average'], ['At most', String(s.most), 'the longest way between two'],
    ['Friends\' friends', pct(s.clust), 'who know each other'], ['Shortcuts', String(s.rewired), `of ${s.links} friendships moved`],
    ['A to B', path ? String(path.length - 1) : isPerson(X.a) && isPerson(X.b) ? 'no chain' : '–', path ? 'handshakes' : 'pick two people']]
    .concat(s.apart ? [['Apart', String(s.apart), 'pairs no chain links']] : []);
}
const NOTE = 'An example network of 60 people, made and measured here. After Watts and Strogatz (Nature, 1998).';
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    ${TABS.map(([k]) => `<div class="pane" id="pane-${k}" role="tabpanel"></div>`).join('')}`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => pickTab(b.dataset.tab)));
  // one click handler for the panes: buttons carry what they do in data attributes
  $('#explore').addEventListener('click', ev => {
    const b = ev.target.closest('[data-act]');
    if (!b) return;
    const v = b.dataset.v;
    ({
      scene: () => openScene(v),
      ctl: () => sceneCtl(b.dataset.scene || X.scene, b.dataset.ctl, v),
      across: () => setPair(A0, B0), clear: () => setPair(null, null),
    }[b.dataset.act] || (() => {}))();
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
// a tab picked by hand
function pickTab(k) { showTab(k); }
function renderAll() { renderNetwork(); updateExtraLabels(); }
function renderNetwork() {
  const pane = $('#pane-network');
  if (!pane) return;
  const ch = c => c.options.map(([v, n]) => chip(`data-act="ctl" data-scene="ring" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue('ring', c) === v)).join('');
  pane.innerHTML = `<p class="sub">Rewire some of the friendships at random, and pick two people on the ring to see the shortest chain of handshakes between them. Every number is computed as you choose.</p>
    <p class="grp-h">Rewired links</p><div class="chips">${ch(ctlOf('ring', 'rw'))}</div>
    <p class="grp-h">Two people (click them on the ring)</p>
    <div class="chips">${chip('disabled', 'A: ' + who(X.a), false, CYAN)}${chip('disabled', 'B: ' + who(X.b), false, AMBER)}</div>
    <div class="chips">${chip('data-act="across"', 'Across the ring', X.a === A0 && X.b === B0)}${chip('data-act="clear"', 'Clear', false)}</div>
    <dl class="stats">${statRows().map(([k, v, more]) => `<dt>${esc(k)}</dt><dd>${esc(v)}<small>${esc(more)}</small></dd>`).join('')}</dl>
    <p class="grp-h">View</p><div class="chips">${ch(ctlOf('ring', 'view'))}</div>
    <p class="note">${esc(NOTE)}</p>`;
}
// labels the panes add (none: the sets label their own picks)
function updateExtraLabels() {}


// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at: { person } on the ring, or null
function pickWith(rc) {
  if (APP.mode !== 'explore' || X.scene !== 'ring') return null;
  const i = api('ring').pick ? api('ring').pick(rc) : -1;
  return isPerson(i) ? { person: i } : null;
}
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip)
function pickPos(p) { return p && isPerson(p.person) ? HELLO.pos(p.person) : null; }
const pickText = p => {
  const i = p.person, g = HELLO.graph(rwP()), d = g.adj[i].length;
  return [`Person ${i + 1}`, `${d} friends${i === X.a ? ' · A' : i === X.b ? ' · B' : ''}`];
};
function choosePick(p) { if (p) pickPerson(p.person); }
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
// A and X do nothing (play and pause are on the panel). Hand tracking: point and pinch.
// (a story with headset state of its own adds it to XR in its own e5_xr.js, after this)
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
function xrPlace(v, dt) {
  if (xrPlaceLife(v)) return;   // (life size round you: the story's own placing)
  const d = Math.max(v[2], 0.05);
  _xq.setFromAxisAngle(_xX, clamp(v[1], -85, 85) * D2R).multiply(_xq2.setFromAxisAngle(_xY, -v[0] * D2R));
  const R0 = XR.baseR * clamp(Math.pow(3.6 / d, 0.85), 0.12, 10) * XR.size;   // (times the size your hands or the room gave it)
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
  XR.R = xrCap(R0, gx, gy, gz, dt);
  GL.world.scale.setScalar(XR.R);
  // the target lands on the placement point
  _xb.copy(XR.target).applyQuaternion(GL.world.quaternion).multiplyScalar(XR.R);
  GL.world.position.set(gx - _xb.x, gy - _xb.y, gz - _xb.z);
}
// a story shown life size round you places it itself here and says true; the others float in front of you
function xrPlaceLife() { return false; }
// the scene's scale, R0 as the view asks (a story that keeps its scene clear of your head caps it here)
function xrCap(R0) { return R0; }
// Recenter (the panel's button and the shell's menu, through recenter in the object the story returns): you in front of
// it again (anchored: Place again); at a station in a shared room the station's scene and panel go back where the story
// puts them instead, for everyone at its circle (the shell's HOST.room.recenter, refused while its story is locked)
function xrRecenterAsk() {
  if (HOST.room && HOST.room.recenter && HOST.room.placing && HOST.room.placing()) return HOST.room.recenter();
  if (HOST.anchor.on) HOST.anchor.again();
  XR.needRecenter = true;
  return true;
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0); XR.size = 1; XR.rot.identity(); xrLifeHome();
  if (XR.panelGroup) xrPanelPose(XR.panelHome.p, XR.panelHome.yaw);
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); XR.size = s.s || 1; xrSceneRot(s.q); if (XR.panelGroup) xrPanelPose(s.pp, s.pr, s.pq); }
  const yaw = new THREE.Euler().setFromQuaternion(XR.headQ, 'YXZ').y;
  GL.rig.position.copy(XR.head);
  GL.rig.quaternion.setFromAxisAngle(new THREE.Vector3(0, 1, 0), yaw);
}
// what a story keeps life size round you goes home too (Recenter, a new wearer)
function xrLifeHome() {}

// ------------------------------------------------- labels and free moving --
// The shell's headset settings, the same for everyone in a shared room (HOST.xr; read every frame, and a shell
// without them means labels on top and nothing free): the scene's small labels 'face' (on top: sprites turned to you,
// over everything), 'fixed' (in 3D: upright signs in the scene, turned to you) or 'hidden'; the cards (the story panels
// here, the station cards and name tags in the shell) the same three ways, independent of the labels (a shell without
// them: as the labels); free moving holds what the grip takes like a real object.
const xrLabelMode = () => (HOST.xr && HOST.xr.labels ? HOST.xr.labels() : 'face');
const xrCardMode = () => (HOST.xr && HOST.xr.cards ? HOST.xr.cards() : xrLabelMode());
const xrFreeOn = () => !!(HOST.xr && HOST.xr.free && HOST.xr.free());
const xrSig = () => (HOST.xr && HOST.xr.sig ? HOST.xr.sig() : '') + (HOST.panels && HOST.panels.sig ? HOST.panels.sig(XR_HERE) : '') + (xrAllHere() ? 'A' : '');
// the shell moving this headset with the sticks in VR (HOST.xr.walking): the story's own stick use waits meanwhile
const xrWalking = () => !!(HOST.xr && HOST.xr.walking && HOST.xr.walking());
// this story's panels in a headset (the shell's HOST.panels, each story its own; at a station in a shared room the
// station's, for everyone at that circle): 'shown', 'controls' (only the foot bar) or 'hidden' (neither: play and pause
// on the menu's Story tab); a shell without it: shown
const xrPanels = () => (HOST.panels && HOST.panels.get ? HOST.panels.get(XR_HERE) : 'shown');
// a headset in a shared room (the shell's HOST.room): no Stories screen there, a story runs only at its station (reached
// by walking into its circle), and away from one it is hidden, not pointable, paused and silent. A shell without
// HOST.room.away: as before (only at a station is the story the station's)
const xrRoomOnly = () => !!(HOST.room && HOST.room.away && HOST.room.inRoom());
const xrAway = () => !!(HOST.room && HOST.room.away && HOST.room.away());
// away a second from every station (v136): the story is hidden, paused and silent (xrUpdate hid it, its fades done), so
// the frame works nothing of it out, no sets, labels or panels, but xrBegin (the rays at the shell's things), the quiet
// narration and the render, and three.js leaves the hidden GL.world's matrices alone until the first frame back (a live
// simulation goes on from where it was); called after xrBegin in frame, every frame
const _xrNoWalk = () => {};
function xrIdle(xr, dt) {
  const away = xr && xrAway(), cards = xr && !away && !!XR.stories, kind = away ? 'a' : cards ? 'c' : '';
  if (kind !== XR.idleK) { XR.idleK = kind; XR.awayT = 0; }   // (away, then behind the cards: a second of full frames between)
  XR.awayT = kind ? (XR.awayT || 0) + dt : 0;
  const idle = XR.awayT > 1;
  if (idle !== (GL.world.updateMatrixWorld === _xrNoWalk)) {
    if (idle) { GL.world.updateMatrixWorld = _xrNoWalk; if (XR.onIdle) XR.onIdle(); } else { delete GL.world.updateMatrixWorld; if (XR.onWake) XR.onWake(); }
  }
  if (!idle) return false;
  // behind the Stories screen only its cards go on (they hover and draw: the part of xrUpdate that is theirs); away, nothing
  if (cards) { if (XR.landRev !== HOST.listRev) xrLandingCards(); XR.landN = 0; const now = performance.now(); for (const P of XR.panels) panelTick(P, now); for (const P of XR.land) { P.want = true; P.mesh.visible = !P.cap || P.nd > 0; } }
  audioSync(); GL.renderer.render(GL.scene, GL.camera); window.__frames = (window.__frames || 0) + 1;
  return true;
}
// the headset's own materials compiled in the load, not in the frame that first shows one (v137): a label's sprite, a 3D
// sign or panel, a panel on top, a controller's dot and ray. Kept (never disposed: a compiled program goes when the last
// material that uses it does), a handful of objects
function xrWarm() {
  try {
    const sc = new THREE.Scene(), t = new THREE.Texture(), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    sc.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })),
      new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })),
      new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.1 })),
      new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false })),
      new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, depthTest: false, depthWrite: false })));
    GL.renderer.compile(sc, GL.camera);
    XR.warmed = sc;
  } catch (e) { /* compiled on first use instead */ }
}
// an All stories circle in a shared room (the shell's HOST.room: cards, its live station shows its cards; allHere, it is
// one, its cards or a story picked there): the single-player Stories screen there, a card picking for everyone at the
// circle, and the story panel's Stories button back to the cards for them. A shell without them: as before
const xrCards = () => !!(HOST.room && HOST.room.cards && HOST.room.cards());
const xrAllHere = () => !!(HOST.room && HOST.room.allHere && HOST.room.allHere());
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
  XR.lm = xrLabelMode(); XR.cm = xrCardMode();
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
  grn: ['#c9ffe3', '#3ee08f'], cyn: ['#d2f6ff', '#46d9ff'], tl: ['#cbfff3', '#38e6c7'], tip: ['#e7eef8', '#46d9ff'] };   // (tl: teal, the pass story's cell map signals)
// a label's picture, shared by its sprite and its sign. One whose words change (a function's) keeps its canvas, texture,
// sprite and sign, and is drawn again in place (labelRedraw); its canvas has room for longer words, and a label too long
// for it is made again, wider
function labelWords(L) {
  if (L.txt) return L.txt;
  const b = L.el.querySelector('b'), bold = b ? b.textContent : '';
  return [bold, L.el.textContent.slice(bold.length).trim(), ['mag', 'amb', 'grn', 'cyn'].find(k => L.el.classList.contains(k)) || ''];
}
// the label drawn on cv at its left, its plate as wide as its words; fresh: cv sized for it (a function's label with room
// to spare), else cleared and drawn again, or false when its words no longer fit
function labelPaint(L, cv, fresh) {
  const [bold, rest, cls] = labelWords(L), ctx = cv.getContext('2d'), px = 34, H = 56, pad = 16, gap = bold && rest ? 10 : 0;
  ctx.font = vfont(px, 700); const wb = bold ? ctx.measureText(bold).width : 0;
  ctx.font = vfont(px); const wr = rest ? ctx.measureText(rest).width : 0;
  const w = Math.ceil(pad * 2 + wb + gap + wr);
  if (fresh) { cv.width = L.fn ? Math.ceil(w * 1.3 + 40) : w; cv.height = H; }
  else if (w > cv.width) return false;
  else ctx.clearRect(0, 0, cv.width, H);
  const [col, acc] = LBL_STYLE[cls] || LBL_STYLE[''];
  ctx.save(); rr(ctx, 0, 0, w, H, 8); ctx.clip();
  ctx.fillStyle = cls === 'tip' ? 'rgba(10,19,34,0.97)' : 'rgba(3,8,16,0.82)'; ctx.fillRect(0, 0, w, H);
  if (acc) { ctx.fillStyle = acc; ctx.fillRect(0, 0, 5, H); }
  ctx.restore();
  ctx.textBaseline = 'middle'; ctx.fillStyle = col;
  ctx.font = vfont(px, 700); ctx.fillText(bold, pad, H / 2 + 1);
  ctx.font = vfont(px); ctx.fillText(rest, pad + wb + gap, H / 2 + 1);
  return { cls };
}
function labelTex(L) {
  if (L.ltex) return L.ltex;
  const cv = document.createElement('canvas'), p = labelPaint(L, cv, true), tex = new THREE.CanvasTexture(cv);
  tex.anisotropy = 4;
  return (L.ltex = { tex, cv, aspect: cv.width / cv.height, tip: p.cls === 'tip' });
}
// a label whose words changed (labelText): its picture drawn again in place; too long for its canvas, dropped and made again
function labelRedraw(L) {
  const o = L.ltex;
  if (!o) return;
  if (labelPaint(L, o.cv, false)) o.tex.needsUpdate = true; else dropSprite(L);
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
  const hm = xrLabelH(sp);
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
  if (fixed) {
    // upright and turned to you, about the vertical only (the rig's frame): a sign in the scene, not a sprite on top
    _fv.copy(sp.position).applyMatrix4(GL.world.matrix);
    sp.quaternion.copy(XR.signL).multiply(_fq.setFromAxisAngle(_xY, Math.atan2(XR.signH.x - _fv.x, XR.signH.z - _fv.z)));
  }
}
// a label's height in the world's units: 2.1 cm (at arm's length)
function xrLabelH() { return 0.021 / XR.R; }
// what a controller points at in explore mode (its pick: pickText), labelled where the ray meets it
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

// ------------------------------------------------------------- picking --
// What a ray points at in explore mode (the story's pickWith), or null
const _prc = new THREE.Raycaster();
function pickRay(o, d) {
  if (APP.mode !== 'explore') return null;
  _prc.set(o, d);
  return pickWith(_prc);
}

// ----------------------------------------------------------- controllers --
function xrController(i) {
  const g = GL.renderer.xr.getController(i);
  const c = { i, g, src: null, hover: null, press: null, grab: null, wantPress: false, o: new THREE.Vector3(), d: new THREE.Vector3() };
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
  g.addEventListener('disconnected', () => { c.src = null; c.press = null; xrLetGo(c); c.hover = null; c.wantPress = false; c.dot.visible = false; });
  // presses are handled on the next frame, once the ray has its fresh pose
  g.addEventListener('selectstart', () => { c.wantPress = true; });
  g.addEventListener('selectend', () => { if (c.wantPress) { c.wantPress = false; xrPress(c); } xrRelease(c); });
  g.addEventListener('squeezestart', () => xrGrab(c, true));
  g.addEventListener('squeezeend', () => xrGrab(c, false));
  GL.scene.add(g);
  XR.ctrls.push(c);
}
// a hand lets go of what it holds (the grip up, the controller gone, locked meanwhile, the session over)
function xrLetGo(c) { c.grab = null; }
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
  } else xrPressScene(c, h);
}
// the trigger on the scene: dragging it turns it (explore mode); let go unmoved, it clicks what it was on
function xrPressScene(c, h) { c.press = Object.assign(startDrag(c), { kind: 'globe', i: h.i, pk: h.pk }); orbit.held = true; }
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
    }
  } else xrReleaseScene(c, p);
}
function xrReleaseScene(c, p) {
  if (p.kind === 'globe') orbit.held = false;
  if (!p.moved && p.pk) { buzz(c); xrClickPick(p.pk); }
}
function xrGrab(c, on) {
  xrLetGo(c);
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || h.menu || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind !== 'panel' && xrGrabScene(c, h)) return;   // (the story's own: refused, or taken)
  // the scene is held by its placement point (where the view's target sits), so a still hand moves nothing
  const p0 = h.kind === 'panel' ? XR.panelGroup.getWorldPosition(new THREE.Vector3()) : GL.rig.localToWorld(XR.globeBase.clone().add(XR.globeOff));
  c.grab = { target: h.kind === 'panel' ? 'panel' : 'globe', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1, r0: (h.kind === 'panel' ? XR.panelGroup.quaternion : XR.rot).clone() };
  buzz(c, 0.4, 25);
}
// the grip on the scene: the story may refuse it or take it (true), else the scene is carried
function xrGrabScene() { return false; }
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3(), _gr = new THREE.Quaternion();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it (moving freely,
// it also turns with your hand, about it: what you hold stays in your hand)
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
  // both hands on the scene resize it (xrResize, once a frame); when one lets go, the other carries on from there
  if (HOST.anchor.locked(G.target === 'panel' ? 'panel' : 'globe')) { xrLetGo(c); return; }   // locked meanwhile (a shared room's story lock: Lock this story)
  if (xrCarryScene(c, G, dt)) return;   // (something of the story's own in the hand)
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
// a grab of the story's own (xrGrabScene) carried: true when it was one
function xrCarryScene() { return false; }
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
  if (sh && sh.panel && XR[sh.panel]) { const P = XR[sh.panel]; hit = { kind: 'panel', P, x: sh.u * P.w, y: (1 - sh.v) * P.h, point: sh.point, menu: true }; dist = sh.dist; }   // (this panel in the shell's menu, its Story tab)
  else if (sh) { hit = sh; dist = sh.dist; }
  else if (xrAway()) hit = null;   // away from its station in a shared room: nothing of the story to point at
  else if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories) {
    hit = xrSceneHit(c);   // (the story's scene, or nothing)
    if (hit) dist = c.o.distanceTo(hit.point);
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu)
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  xrDrag(c);
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // thumbstick: spin and zoom the globe (not while the sticks move you: the shell's, xrWalking; nor the right stick while
  // a spaceship flies: that controller is the ship's, HOST.ships)
  const gp = c.src.gamepad;
  if (gp) {
    const ax = gp.axes.length >= 4 ? gp.axes[2] : 0, ay = gp.axes.length >= 4 ? gp.axes[3] : 0;
    if (APP.mode === 'explore' && !c.press && !c.grab && !xrWalking() && !(HOST.ships && HOST.ships.claims(c.src)) && xrSticks()) {
      if (Math.abs(ay) > 0.2) { orbit.to = null; orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ay * dt * 1.5), xrMinD(), 40); }
      if (Math.abs(ax) > 0.2) { orbit.to = null; orbit.cur[0] -= ax * dt * 60; }
    }
  }
  c.ray.scale.z = dist;
  if (hit) {
    c.dot.visible = true;
    c.dot.position.copy(hit.point);
    c.dot.lookAt(XR.head);
    c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head)));
  } else c.dot.visible = false;
}

// the scene counts as a ball around the view's target; a pick counts if the ray passes close (pickRay): a pick with a
// point of its own is marked there, else the ball's surface
function xrBallHit(c) {
  const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
  _xc.copy(oL).sub(XR.target);
  const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
  const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
  const pk = pickRay(c.o, c.d);
  if (!(t > 0 || pk)) return null;
  const q = pk ? pickPos(pk) : null;
  if (q) _xp.set(q[0], q[1], q[2]).applyMatrix4(GL.sets[X.scene].group.matrixWorld);
  else _xp.copy(dL).multiplyScalar(t > 0 ? t : Math.max(0, _xc.copy(XR.target).sub(oL).dot(dL))).add(oL).applyMatrix4(GL.world.matrixWorld);
  return { kind: 'globe', i: -1, pk, point: _xp.clone() };
}
// what of the scene a controller points at (xrPoint, once no panel is nearer), or null
function xrSceneHit(c) { return xrBallHit(c); }
// a press on the scene held: dragging turns it
function xrDrag(c) { if (c.press && c.press.kind === 'globe') dragGlobe(c, c.press); }
// whether the thumbstick spins and zooms the scene now (explore mode, nothing held)
function xrSticks() { return true; }
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
    // (at an All stories circle its cards are the Stories screen, opened as the panel's Stories button opens it, and they
    // close once a story is picked there or the headset walks into another circle)
    if (xrCards() && !XR.stories) { XR.stories = true; XR.inStory = false; XR.kbd.open = false; APP.playing = false; }
    if (XR.stories && !xrCards() && (roomOnly || (HOST.collab.mine() && HOST.room.placing()))) xrLandingClose();
  }
  xrPosed(frame, ref, pose);
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
  if (xrAway() || xrCards()) { APP.playing = false; SLIDE.tail = null; }
  xrPointed(frame, ref);
  for (const P of XR.panels) {
    let hv = null;
    for (const c of XR.ctrls) {
      if (c.hover && c.hover.kind === 'panel' && c.hover.P === P) { const r = P.at(c.hover.x, c.hover.y); if (r) hv = r.id; }
    }
    P.hover = hv;
  }
}
// once the head's pose is read (pose: null without one), before the panels are drawn: a story's own room or place
function xrPosed() {}
// once the controllers have pointed (xrPoint): what a story's own pointing lights up
function xrPointed() {}
function xrUpdate(S) {
  // the Stories screen replaces the story's panels and hides the story
  const land = !!XR.stories, away = xrAway();   // (away from its station in a shared room: the story hidden, only the shell's things)
  if (XR.land) {
    if (XR.landRev !== HOST.listRev) xrLandingCards();   // a story added while the app runs: its card joins the rows
    for (const P of XR.land) { P.want = land; P.mesh.visible = land && (!P.cap || P.nd > 0); }   // (a card not drawn yet waits: panelTick)
    // cards hidden: no story panel at all, in story and explore mode (the Stories screen, the shell's menu and its
    // clock stay, and its Story tab plays); cards in 3D: the panels stand in the scene, as the labels' signs do (the
    // labels have their own setting). And this story's panels (xrPanels): controls only keeps just the foot bar, hidden
    // neither
    const pm = xrPanels(), pv = !land && !away && XR.cm !== 'hidden';
    XR.main.want = XR.main.mesh.visible = pv && pm === 'shown';   // (want: what xrUpdate shows; a panel it does not show is not drawn, panelTick)
    XR.foot.want = XR.foot.mesh.visible = pv && pm !== 'hidden';
    panelDepth(XR.main, XR.cm === 'fixed'); panelDepth(XR.foot, XR.cm === 'fixed');
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
    if (!story) placeLabelXR(L, xrExtraAlpha(L), S);
    else hideLabelXR(L);
  }
  xrTip(S);
  const now = performance.now();
  XR.landN = 0;   // (the Stories screen's cards drawn for the first time this frame: panelTick)
  for (const P of XR.panels) panelTick(P, now);
}
// how much an explore label of the story's own (LBL.extra) shows in the headset
function xrExtraAlpha() { return 1; }

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
    session = await (HOST.xr.request ? HOST.xr.request(mode) : navigator.xr.requestSession(mode, { optionalFeatures: HOST.xr.features(mode) }));
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
    if (ref && ref.addEventListener) ref.addEventListener('reset', xrOnReset);
  } catch (err) {
    console.error(err);
    xrMsg('Could not start the headset view: ' + (err && err.message ? err.message : err));
    try { await session.end(); } catch (e) { /* already ended */ }
    if (XR.on) xrEnded();
  }
}
// the reference space was reset (the headset recentred): the scene comes in front of you again
function xrOnReset() { XR.needRecenter = true; }
function xrEnterScene() {
  XR.stories = false;
  XR.on = true; XR.needRecenter = true; XR.fov = false; XR.tipI = -1;
  XR.free = xrFreeOn(); XR.lm = xrLabelMode(); XR.cm = xrCardMode();   // (as the shell has them: nothing to turn off or on at the first frame)
  document.body.classList.add('xr');
  GL.rig.position.set(0, 0, 0); GL.rig.quaternion.identity();
  XR.clear = !(XR.session.environmentBlendMode && XR.session.environmentBlendMode !== 'opaque') && XR.mode !== 'immersive-ar';
  applyTheme();
  xrStars(true);
  for (const P of XR.panels) { P.mesh.visible = true; P.last = ''; }
  XR.kbd.open = false;
  xrOnEnter();
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
// a headset session begins (xrEnterScene): a story's own headset state from the page's
function xrOnEnter() {}
// the stars in the headset (on) and back on the page: in a headset bigger, and only in VR
function xrStars(on) {
  if (on) { GL.stars.visible = XR.clear; GL.stars.material.size = 2.2; }
  else { GL.stars.visible = true; GL.stars.material.size = 1.3; }
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
  for (const c of XR.ctrls) { c.press = null; xrLetGo(c); c.wantPress = false; }
  xrLifeHome();
  // in a shared room the story and its place stay (at its station the room's clock and state go on applying; away from
  // one a new wearer walks up to a station: no Stories screen in a room)
  if (HOST.collab.mine() || xrRoomOnly()) { lastNow = 0; return; }
  APP.enterStory(0); APP.playing = false; audioSync();
  XR.stories = true; XR.inStory = false; // a new wearer lands in the Stories screen
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
  if (ref && ref.addEventListener) ref.addEventListener('reset', xrOnReset);
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
  for (const c of XR.ctrls) { c.g.visible = false; c.dot.visible = false; c.press = null; xrLetGo(c); c.hover = null; c.src = null; }
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) { hideLabelXR(L); L.o = -1; }
  if (XR.tip) dropSprite(XR.tip);
  XR.tip = null; XR.tipI = -1;
  XR.clear = true;
  xrStars(false);
  GL.world.visible = true;
  xrOnEnd();
  for (const P of XR.land || []) P.mesh.visible = false;
  // left the headset from the Stories screen, or away from a station in a shared room (its story hidden and paused
  // there): back to the Stories screen on the page
  if (XR.stories || away) { XR.stories = false; HOST.openPicker(); }
  applyTheme();
  resize();
}
// the headset session is over (xrEnded): a story's own headset state put back for the page
function xrOnEnd() {}
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
// a story panel in the scene or on top, as the cards setting says: in 3D, it stands in the scene as the labels' signs do
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
// redraw only when what the panel shows has changed (texture uploads are not free). Not while xrUpdate keeps it hidden (P.want false; v137;
// the menu's Story tab shows the story's two panels, so those go on while it does: HOST.collab.mirroring, and a shell
// without it keeps them going); a card of the Stories screen not drawn yet waits its turn, two first draws a frame at
// most (XR.landN, counted from xrUpdate), so opening the screen is not sixteen cards and 35 MB in one frame; and a text
// fade alone sends only the rows that moved (panelFade, panelSend)
function panelTick(P, now, force) {
  if (!force && P.want === false && !((P === XR.main || P === XR.foot) && (!HOST.collab.mirroring || HOST.collab.mirroring()))) return;
  const sg = P.sig(), k = sg.indexOf('\u0001'), base = (k < 0 ? sg : sg.slice(0, k)) + '|' + P.hover + '|' + XR.fontOK, s = k < 0 ? base : base + sg.slice(k);
  if (s === P.last || (!force && now - P.t < 60)) return;
  if (P.cap && !P.nd && !force && XR.landN >= 2) return;
  P.t = now;
  const R = P.last && base === P.base && P.fb ? panelFade(P) : null;
  P.last = s; P.base = base; P.fb = null;
  const ctx = P.ctx;
  ctx.setTransform(1, 0, 0, 1, 0, 0);
  ctx.clearRect(0, 0, P.w, P.h);
  ctx.globalAlpha = 1; ctx.textBaseline = 'top'; ctx.textAlign = 'left';
  P.regions = [];
  panelPaint(ctx, P);
  P.nd = (P.nd || 0) + 1;
  if (P.cap && P.nd === 1) XR.landN++;
  if (!R) P.tex.needsUpdate = true; else if (R.length) panelSend(P, R);
}
function panelPaint(ctx, P) {
  rr(ctx, 0, 0, P.w, P.h, 26);
  ctx.fillStyle = XR.clear ? VC.bg : 'rgba(8,15,28,0.97)';
  ctx.fill();
  P.draw(ctx, P);
}
// text fades alone (v137; the part of a signature after \u0001, see sigMain): drawStoryPane keeps each element's band of
// rows and the fades it follows (P.fb). The card is drawn whole into its canvas as ever (so it is exactly what a full
// redraw makes), but only the rows of the elements whose fade moved are sent to the texture (panelSend, texSubImage2D
// and the mipmaps), not the whole card (1.2 MP for every step of every line's fade). Null: send it whole (most of it moved)
const FADE = { pad: 8, most: 0.85 };
let FADECV = null;
function panelFade(P) {
  const R = [];
  for (const b of P.fb) {
    let moved = false;
    for (const d of b.d) if (storyOpacity(d.el) !== d.q) moved = true;
    if (!moved) continue;
    const y0 = Math.max(0, Math.floor(b.y0 - FADE.pad)), y1 = Math.min(P.h, Math.ceil(b.y1 + FADE.pad)), last = R[R.length - 1];
    if (y1 <= y0) continue;
    if (last && y0 <= last[1] + last[3]) last[3] = Math.max(last[3], y1 - last[1]); else R.push([0, y0, P.w, y1 - y0]);
  }
  return R.reduce((n, r) => n + r[3], 0) > FADE.most * P.h ? null : R;
}
// the rows panelFade found, copied from the card's canvas to a small one and sent as they are
function panelSend(P, R) {
  const cv = FADECV = FADECV || document.createElement('canvas');
  R.forEach((r, k) => {
    if (cv.width !== r[2] || cv.height !== r[3]) { cv.width = r[2]; cv.height = r[3]; }
    const c = cv.getContext('2d');
    c.setTransform(1, 0, 0, 1, 0, 0); c.globalAlpha = 1; c.clearRect(0, 0, r[2], r[3]); c.drawImage(P.cv, r[0], r[1], r[2], r[3], 0, 0, r[2], r[3]);
    panelPatch(P, cv, r[0], r[1], k < R.length - 1);   // (its mipmaps made once, after the last)
  });
  P.faded = (P.faded || 0) + 1;
}
// a part of a panel (a canvas of its size, drawn at x, y on the panel's) sent to its texture on its own (texSubImage2D,
// then its mipmaps), not the whole card. A texture not on the GPU yet, or with the whole card still to go there, takes
// it as it goes; one without WebGL2 (a mipmapped texture of any size) is sent whole
function panelPatch(P, cv, x, y, noMip) {
  const R = GL.renderer, T = P.tex;
  try {
    const gl = R.getContext(), pr = R.properties.get(T), wt = pr && pr.__webglTexture;
    if (!wt || pr.__version !== T.version) return;   // (its upload to come carries the card as it is now)
    if (!R.capabilities.isWebGL2) { T.needsUpdate = true; return; }
    R.state.bindTexture(gl.TEXTURE_2D, wt);
    gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, T.flipY); gl.pixelStorei(gl.UNPACK_PREMULTIPLY_ALPHA_WEBGL, T.premultiplyAlpha); gl.pixelStorei(gl.UNPACK_ALIGNMENT, 4);
    gl.texSubImage2D(gl.TEXTURE_2D, 0, x, T.flipY ? P.h - y - cv.height : y, gl.RGBA, gl.UNSIGNED_BYTE, cv);
    if (!noMip && T.generateMipmaps && T.minFilter !== THREE.NearestFilter && T.minFilter !== THREE.LinearFilter) gl.generateMipmap(gl.TEXTURE_2D);
    P.patched = (P.patched || 0) + 1;
    P.patchPx = (P.patchPx || 0) + cv.width * cv.height;
  } catch (e) { T.needsUpdate = true; }
}

// ------------------------------------------------------------ main panel --
// what the main panel shows, so it is drawn again only when that changes: the story (and what the story's own
// sigMainS() adds: '' for most), or explore mode (the story's sigMainX())
function sigMain() {
  if (XR.stories) return 'stories' + audioLabel();
  if (APP.mode !== 'story') return sigMainX();
  const it = ST.items.find(x => x.ch === curCh);
  let s = 's' + audioLabel() + xrSig() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '') + sigMainS();
  if (it) {
    for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
    // (the title's route arc as it grows, in the chapter that has it)
    const arc = it.sec.querySelector('#titleArc'), dot = it.sec.querySelector('#titleDot');
    if (arc && dot) s += arc.getAttribute('stroke-dashoffset').slice(0, 3) + dot.getAttribute('opacity').slice(0, 3);
    s += '\u0001';   // what follows is the text fades alone: panelFade draws only the bands that moved
    for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
  }
  return s;
}
// the story's own part of the main panel's signature (sigMain): '' (nothing beyond the chapter and its lines)
const sigMainS = () => '';
// explore mode in the main panel's signature: everything its panes show (drawn again only when this changes)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), X.a, X.b].join('|');
}
// the station's story (slideshow, sound effects, shared rooms) and the panel's title: story.json's
const XR_HERE = KEY;
const XR_TITLE = (pkgMeta() || {}).title || KEY;
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 4, XR_STEP_COL = 'var(--amber)';
const FLOW_BOLD = true;
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// in two rows on an arc in front of you while the story itself is hidden.
// Its heights over your eyes (the rig): the header's middle, and the middles of the cards' two rows (0.461 m tall,
// 0.05 m apart, the upper one's top 0.03 m under the header), so it reaches from 0.56 m above your eyes to 0.61 m below
const XR_LAND = { head: 0.475, rows: [0.13, -0.38] };
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  // the header: the title, a hint and Back to the story (the sound, Sound check, Anchor, Exit, Recenter and Repeat are
  // in the shell's menu, which a stick's click opens)
  const head = makePanel(1400, 236, 1.02, drawLandHead, () => 'h' + XR.inStory + xrCards() + HOST.anchor.status() + HOST.list.length);
  head.mesh.position.set(0, XR_LAND.head, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head); XR.panels.push(head);
  xrLandingCards();
}
// One card per story, 0.36 m wide, in two rows on one arc, as the All stories circle's icon has them: the first half of
// the stories (rounded up) in the upper row, in the list's order, the rest under them, a shorter row centred. In a row
// neighbours stand 0.381 m apart and the outer ones at most 62° to the side (eight: 0.306 rad apart at 1.25 m), never
// nearer than 1.25 m (a few stories stand closer together in angle). Built again when the shell's list of stories
// changes while the app runs (HOST.listRev: a story added in a release gets its card)
function xrLandingCards() {
  for (const P of XR.land.splice(1)) {
    XR.landGroup.remove(P.mesh); XR.panels.splice(XR.panels.indexOf(P), 1);
    P.tex.dispose(); P.mesh.geometry.dispose(); P.mesh.material.dispose();
  }
  const n = HOST.list.length, per = Math.ceil(n / 2), d = Math.max(1.25, per > 1 ? 0.1905 / Math.sin(1.085 / (per - 1)) : 0), step = 2 * Math.asin(0.1905 / d);
  XR.landRev = HOST.listRev;
  HOST.list.forEach((s, k) => {
    const row = k < per ? 0 : 1, m = row ? n - per : per, a = (k - row * per - (m - 1) / 2) * step;
    const P = makePanel(640, 820, 0.36, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + (s.key === XR_HERE ? XR.inStory : '') + s.key);
    P.cap = true;   // (a card: shown once drawn, its first draw at most two a frame; panelTick)
    P.mesh.position.set(Math.sin(a) * d, XR_LAND.rows[row], -Math.cos(a) * d);
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
  // (the sound, Sound check, Anchor, Exit, Recenter or Place again, and Repeat are the shell's menu's, for every story)
  if (XR.inStory && !xrCards()) vButton(ctx, P, 'back', P.w - 44 - 294, 128, 294, 64, 'Back to the story', xrLandingClose, { px: 26 });
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
  P.regions.push({ id, x: 0, y: 0, w: P.w, h: P.h, fn: () => (here && !xrCards() ? xrLandingClose() : HOST.go(s.key)) });
}
function drawStoriesPane(ctx, P, x, y, W) {
  y += textBlock(ctx, 'Choose a story', x, y, W, 46, 54, VC.ink, 700) + 6;
  y += textBlock(ctx, 'The same ideas, very different networks. Pick one; you stay in the headset view.', x, y, W, 25, 35, VC.muted) + 22;
  // fit the cards above the Back button (the list grew to four)
  const h = Math.min(210, Math.floor((P.h - 96 - y) / XR_STORIES.length) - 18);
  for (const { key: k, kick, title, desc, col } of XR_STORIES) {
    const here = k === XR_HERE;
    vButton(ctx, P, 'story:' + k, x, y, W, h, '', () => { if (here && !xrCards()) XR.stories = false; else HOST.go(k); }, { on: here, r: 14 });
    let yw = 0;   // the kicker stops short of 'You are here' beside it
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; yw = ctx.measureText('You are here').width + 20; }
    fitTitle(ctx, kick.toUpperCase(), x + 26, y + 22, W - 52 - yw, 21, 26, col, 700, 17);
    fitTitle(ctx, title, x + 26, y + 54, W - 52, 38, 44, VC.ink, 700, 30);
    textBlock(ctx, desc, x + 26, y + 100, W - 52, 24, 33, VC.muted, 400, 2);
    y += h + 18;
  }
  if (!xrCards()) vButton(ctx, P, 'story:close', x, y + 4, 220, 60, 'Back', () => { XR.stories = false; }, { px: 25 });
}
// under the story: what the trigger and the grip do (in a shared room the room's own hint instead: drawMain)
const xrHint = () => (HOST.anchor.on ? 'Trigger (or pinch): use buttons. Anchored: to move things, use Place again in the menu.' : XR.free ? 'Trigger (or pinch): use buttons. Grip: hold the scene or this panel to move and turn it; both grips on the scene resize it.' : 'Trigger (or pinch): use buttons. Grip: move the scene or this panel; both grips on the scene resize it.');
// the main panel: the buttons and the story's name (XR_TITLE) on top; under them the Stories screen, the story (with
// the story's xrHint() at its foot) or explore mode
function drawMain(ctx, P) {
  const story = APP.mode === 'story';
  let x = P.w - 36;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 26, w, 54, label, fn, o); x -= 12; };
  // (Exit is on the shell's Shared panel, at hand on the left controller)
  if (AUD && AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.on(), px: 23 });
  if (!HOST.anchor.on) hb('recenter', 'Recenter', xrRecenterAsk, 140); // anchored: nothing moves
  // in a shared room no Stories button: each station keeps its story, and another story is another station (walk into
  // its circle)
  if (!(HOST.room && HOST.room.placing()) && !xrRoomOnly()) hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  else if (xrAllHere() && !XR.stories) hb('stories', 'Stories', () => HOST.room.allBack(), 130);   // (an All stories circle: back to its cards, for everyone there)
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  // the story's name, smaller when the buttons leave it less room
  fitTitle(ctx, XR_TITLE, 40, 36, x - 40, 30, 36, VC.ink, 700, 24);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : xrHint(), 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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
  const e = XR.elInfo.get(el), q = e ? Math.round(Math.max(0, e.o) * 3) / 3 : 1;
  if (FADEB && e) FADEB.d.push({ el, q });   // (drawStoryPane: the fades this element's band follows, panelFade)
  return q;
}
let FADEB = null;
function drawStoryPane(ctx, P, x, y, W) {
  const it = ST.items.find(i => i.ch === curCh) || ST.items[0];
  P.fb = [];   // (each element's band of rows and the fades it follows: panelFade)
  for (const el of it.sec.children) { const b = FADEB = { y0: y, y1: y, d: [] }; y = drawStoryEl(ctx, P, el, x, y, W, 1); b.y1 = y; P.fb.push(b); }
  FADEB = null;
  ctx.globalAlpha = 1;
}
// one element of the story's HTML on the headset's panel. Each story says how its points (ul.steps) look there:
// XR_STEP_LINES, a point's lines of text at most, and XR_STEP_COL, the colour of a point without one of its own (a CSS
// colour; '' is ink). A paragraph's data-xr, where it has one, is its text in a headset (the robots' room).
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
      h = textBlock(ctx, el.dataset.xr || el.textContent, x, y, W, s.px, s.lh, col ? VC[col] : VC[s.c], s.w) + s.mb;
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
      const col = li.dataset.col || cssColor(li.style.borderLeftColor || XR_STEP_COL);   // a point in its own colour (the HTML's is mixed for a light panel)
      const hh = 36 + textBlock(ctx, rest, x + 22, yy + 40, W - 22, 28, 38, VC.ink, 400, XR_STEP_LINES);
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


// explore: tabs and panes mirroring the HTML ones (a tab picked with the story's pickTab; its pane drawn by the
// story's drawTabPane)
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
  drawTabPane(ctx, P, x, y, W, P.h - 34);
}
// explore mode's pane for each tab (drawExplorePane): the headset's twin of renderNetwork
function drawTabPane(ctx, P, x, y, W, bottom) { drawNetworkPane(ctx, P, x, y, W, bottom); }
// buttons that wrap like the HTML chips: items -> { id, label, on, col, ink, icon, fn } (no fn: a plain chip; an icon is
// drawn by the story's flowIcon(ctx, it, x, y, h): the PET story's organs, the microanatomy story's organ models). Where
// a story's FLOW_BOLD is false (the muscle story's), a chip is measured in the font the one before it was drawn in.
function flow(ctx, P, items, x, y, W, maxY, o = {}) {
  const px = o.px || 22, h = o.h || 44, gap = 8;
  let cx = x, cy = y;
  ctx.font = vfont(px);
  for (const it of items) {
    if (FLOW_BOLD) ctx.font = vfont(px, it.on ? 700 : 400);   // (a lit chip's bold label is wider)
    const sw = it.icon ? h - 10 : it.col ? 22 : 0, w = Math.min(W, ctx.measureText(it.label).width + 26 + sw);
    if (cx + w > x + W) { cx = x; cy += h + gap; }
    if (cy + h > maxY) break;
    vButton(ctx, P, it.id, cx, cy, w, h, '', it.fn, { r: 6, on: it.on });
    if (it.icon) flowIcon(ctx, it, cx, cy, h);
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
// rows of a name (muted) and its value (ink), as the HTML's dl.stats
function stats(ctx, x, y, W, rows) {
  let yy = y;
  for (const [k, v, more] of rows) {
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(k, x, yy + 3);
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(v, x + 220, yy);
    if (more) { const w = ctx.measureText(v).width; ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, more, W - 240 - w), x + 236 + w, yy + 4); }
    yy += 38;
  }
  return yy - y;
}
function drawNetworkPane(ctx, P, x, y, W, bottom) {
  const ch = c => c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue('ring', c) === v, fn: () => sceneCtl('ring', c.key, v) }));
  y += textBlock(ctx, 'Rewire some of the friendships at random, and point at two people on the ring to see the shortest chain of handshakes between them.', x, y, W, 23, 32, VC.muted, 400, 3) + 12;
  y += head(ctx, x, y, 'Rewired links');
  y += flow(ctx, P, ch(ctlOf('ring', 'rw')), x, y, W, bottom, { px: 24, h: 56 }) + 14;
  y += head(ctx, x, y, 'Two people (press on them)');
  y += flow(ctx, P, [{ id: 'who:a', label: 'A: ' + who(X.a), col: CYAN }, { id: 'who:b', label: 'B: ' + who(X.b), col: AMBER },
    { id: 'across', label: 'Across the ring', on: X.a === A0 && X.b === B0, fn: () => setPair(A0, B0) }, { id: 'clear', label: 'Clear', fn: () => setPair(null, null) }], x, y, W, bottom, { px: 22, h: 50 }) + 16;
  y += stats(ctx, x, y, W, statRows()) + 10;
  y += head(ctx, x, y, 'View');
  y += flow(ctx, P, ch(ctlOf('ring', 'view')), x, y, W, bottom, { px: 22, h: 50 }) + 14;
  if (y + 40 < bottom) textBlock(ctx, NOTE, x, y, W, 21, 29, VC.faint, 400, Math.max(1, Math.min(2, Math.floor((bottom - y) / 29))));
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.floor(APP.t) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + X.turn;
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
    arrFoot(ctx, x0, x1, ty);   // (an arrangement's skipped chapters, greyed)
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t / T_END, ty + 3, P.hover === 'track' ? 16 : 13, 0, 7); ctx.fillStyle = VC.cyan; ctx.fill();
    P.regions.push({ id: 'track', x: x0 - 10, y: 66, w: x1 - x0 + 20, h: 80, drag: px => APP.seek(clamp((px - x0) / (x1 - x0), 0, 1) * T_END) });
    return;
  }
  drawFootX(ctx, P);   // (explore mode: the story's own footer)
}
// explore mode's footer: turn, zoom and the whole scene
function drawFootX(ctx, P) {
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Turn', 28, 58);
  vButton(ctx, P, 'turn:on', 100, 40, 90, 56, 'On', () => setTurn('on'), { on: X.turn === 'on', px: 22 });
  vButton(ctx, P, 'turn:off', 198, 40, 90, 56, 'Off', () => setTurn('off'), { on: X.turn === 'off', px: 22 });
  ctx.fillText('Zoom', 330, 58);
  vButton(ctx, P, 'z-', 404, 40, 56, 56, '−', () => xrZoom(1.3), { px: 28 });
  vButton(ctx, P, 'z+', 466, 40, 56, 56, '+', () => xrZoom(1 / 1.3), { px: 28 });
  vButton(ctx, P, 'home', 560, 40, 230, 56, 'Whole scene', () => flyTo(view(X.scene, 'default')), { px: 22 });
}
// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 where the story's narrationFile() says (audio/narration-<key>.mp3).
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
const AUD_HOOKS = {
  // a recording longer than the story stretches the timeline
  ready(d) {
    ARR.d = d; d = arrTl(d);   // (on the timeline: an arrangement's chapters may be longer or shorter)
    if (d + 1 <= T_END) return;
    T_END = d + 1;
    document.querySelectorAll('#track .tick, #track .name').forEach(el => {
      const c = C[el.dataset.k]; if (c) el.style.left = (100 * c.na / T_END).toFixed(2) + '%';
    });
    $('#track').setAttribute('aria-valuemax', Math.round(T_END)); lastTick = -1; arrTrack();
  },
  error() { xrMsg('The narration file could not be played. Export it as a standard MP3 and upload it again.'); },
};
// ------------------------------------------------------------- narration --
// Captions only by default. A recording, audio/narration.mp3 in the package (and NARRATION_SYNC in e3_story.js to
// match it), is played as soon as the index lists it (node tools/packages/scan.mjs): no file, no request for one.
const narrationFile = () => pkgUrl('audio/narration.mp3');
const hasNarration = () => { const m = pkgMeta(); return !!(m && m.files && m.files['audio/narration.mp3']); };
// (the shared audioInit, only when there is a recording: AUD stays null without one, and the lines that would play it
// do nothing, as in the design room)
function audioInit() {
  if (!hasNarration() && !ARR.url) return;
  AUD = HOST.audio.narration(arrVoice(), AUD_HOOKS);   // (an arrangement's recording, or the story's own)
  // react at once to play/pause, seeks, chapter jumps and mode changes
  for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {
    const f = APP[name];
    APP[name] = function (...args) { const r = f.apply(APP, args); if (AUD) { AUD.seeked(); audioSync(); } return r; };   // (AUD: a copy's recording may come and go)
  }
}
// the narration plays while the story plays (at a slideshow stop, a voice may finish its chapter: slideSound)
// (an arrangement whose chapters are longer or shorter plays each line from its cue: arrSync)
function audioSync() { if (AUD) { const [w, t] = slideSound(); if (ARR.R) arrSync(w, t); else AUD.sync(w, t); } }
// while it plays, the narration is the clock: the story follows it
function audioFollow() { if (AUD && !SLIDE.tail) APP.t = ARR.R ? arrFollow(APP.t) : AUD.follow(APP.t); }
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
      if (ARR.sk && ARR.sk.has(i)) continue;   // (a chapter an arrangement skips has no stop)
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
  const p = AUD && AUD.pos ? arrTl(AUD.pos()) : null, e = slideVoice(i);
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
    let best = SET_ORDER[0], ba = 0;
    for (const k of SET_ORDER) { const a = Math.max(S[k + '_a'], 0.9 * S2[k + '_a']); if (a > ba + 0.01 && SCENES.some(s => s[0] === k)) { ba = a; best = k; } }
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
        for (const c2 of s.controls || []) c[c2.key] = c2 === ct ? v : ctlValue(best, c2);
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a')) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    // the story's two people carry over (shown at once), or the pair across the ring
    if (S.path_a > 0.5) { X.a = Math.round(S.path_from); X.b = Math.round(S.path_to); } else { X.a = A0; X.b = B0; }
    X.pickT = 0;
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    showTab(X.tab); pushState(); renderAll();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    NEXT.length = 0; pushState();
    $('#tip').style.opacity = 0;
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

let lastNow = 0;
const EXV = [0, 0, 1, 0, 0, 0, 1, 0, 0, 0];   // explore's view for applyCamera: orbit.cur, then FIT's eased shift
const frameLife = () => false, frameLow = () => {}, frameFloor = () => {};   // (frame: nothing life size, low or on a floor)
// a frame of the story or of explore mode. The story's hooks: frameLife() (a life-size view, which stands neither further
// back nor shifted: the PET scanner's), frameLow(vn, ke) (more of explore's view eased: LOW, where the story has it) and
// frameFloor(S) (passthrough: the story's own floor hidden)
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  if (xrIdle(xr, dt)) return;   // (away from every station a second: only the rays, the quiet narration and the render)
  let S, tSet;
  const t0 = APP.t;
  const was = APP.mode === 'story' && APP.playing;   // (sound effects: the story was playing as the frame began)
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
    arrSkip();   // (an arrangement's skipped chapters: playing jumps over them)
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
    // (neither for a life-size view: the story's frameLife; and the story's own eased views: frameLow)
    const vn = viewCam(X.scene) || 'default', life = frameLife(), fs = life ? [0, 0, 0] : fitShift(X.scene, vn), ke = 1 - Math.exp(-dt * 3);
    GL.nf += ((life ? 1 : narrowOf(X.scene, vn)) - GL.nf) * ke;
    for (let i = 0; i < 3; i++) EXV[7 + i] += (fs[i] - EXV[7 + i]) * ke;
    frameLow(vn, ke);
    orbitStep(xr ? pn : now);
    for (let i = 0; i < 6; i++) EXV[i] = orbit.cur[i];
    if (xr) xrPlace(orbit.cur); else { applyCamera(EXV); keepCamera(S, null); }
  }
  frameFloor(S);   // (in passthrough the room's own floor, where the story has one of its own)
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  arrPlace();   // (an arrangement's places, on top of what the story does with its sets)
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
      arrLoad();   // (the story's arrangement, where it has one: tools/engine/SPEC.md)
    }],
    ['Setting up explore mode', () => { buildExplore(); bindCanvas(); }],
    ['Making the headset panels', () => { audioInit(); xrSetup(); xrWarm(); LOAD.done = true; initEnd(); }]);
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
    // #hello&explore&rw=0.1 (or 10%: the rewired links)&view=top, &a=1&b=31 (the two people), &tab=network, &now (no easing)
    const sc = hp.get('scene');
    if (sc && GL.sets[sc]) openScene(sc, false);
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    for (const c of ctlsOf(X.scene)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q);
      if (o) setCtl(X.scene, c.key, o[0]);
    }
    // &a=1&b=31: the two people, by their number on the ring (1 to 60; 0 none)
    if (hp.has('a') || hp.has('b')) setPair(parseInt(hp.get('a'), 10) - 1, parseInt(hp.get('b'), 10) - 1, false);
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) pickTab(hp.get('tab'));
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
    renderAll();
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  LOAD.t = setTimeout(() => $('#loading').classList.add('gone'), 120);   // (dispose clears it: a story picked meanwhile keeps its loading screen)
}
LOAD.t = setTimeout(init, 40);

// ---------------------------------------------------------- arrangements --
// An arrangement (tools/engine/SPEC.md): plain data laid over the story's own timeline, retimed and rearranged, never
// code. arrModel() is the story's own timeline as data; arrApply(A) lays A over it by writing again, from a copy of the
// story's own taken the first time (arrSnap), what buildStory built: TR's keys, the camera's waypoints and the sets'
// turns (ST.wp, ST.yaw, ST.stand), the panel's points and their words (ST.items), the labels (ST.labels), the sound
// cues (SFXQ), CH, NARRATION_SYNC, NARRATION_ENDS and T_END. The rest of the engine reads those as ever, and
// arrApply(null) puts the story's own back exactly. Without an arrangement the frame's hooks (arrSkip, arrPlace) and the
// narration's (arrSync, arrFollow, arrTl) do nothing. Three clocks: story time; the timeline's (APP.t: the recording's,
// until an arrangement makes a chapter longer or shorter); and the recording's (ARR.R maps the timeline onto it).
const ARR = { o: null, A: null, built: false, pend: undefined, name: '', M: null, R: null, sk: null, pl: null, tx: [], seg: -1, d: 0, url: '', want: '', vk: 0, tk: false };
const ARR_NUM = /\d+(?:[.,]\d+)*/g;
// a piecewise linear map through the points (xs, ys), at slope 1 beyond them
function arrPw(xs, ys, x) {
  const n = xs.length;
  if (x <= xs[0]) return ys[0] + (x - xs[0]);
  for (let i = 1; i < n; i++) if (x <= xs[i]) return xs[i] > xs[i - 1] ? ys[i - 1] + (ys[i] - ys[i - 1]) * (x - xs[i - 1]) / (xs[i] - xs[i - 1]) : ys[i];
  return ys[n - 1] + (x - xs[n - 1]);
}
// story time, the story's own -> arranged (the chapters' lengths), and back
const arrM = s => (ARR.M ? arrPw(ARR.M[0], ARR.M[1], s) : s);
const arrUnM = s => (ARR.M ? arrPw(ARR.M[1], ARR.M[0], s) : s);
// narrT on a table W of [recording, story] pairs
function arrNarrT(W, o) {
  for (let i = 1; i < W.length; i++) if (o <= W[i][1]) { const [n0, o0] = W[i - 1], [n1, o1] = W[i]; return n0 + (n1 - n0) * (o - o0) / (o1 - o0); }
  return W[W.length - 1][0] + (o - W[W.length - 1][1]);
}
// an element's words as plain text: its text nodes (on the panel, none inside another of its points), a space between
// two in different elements that would otherwise run together ('<b>Nuclei</b>purple-blue': 'Nuclei purple-blue')
function arrText(el, own) {
  const nodes = [], w = document.createTreeWalker(el, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) if (n.data.trim() && (!own || n.parentElement.closest('[data-at]') === el)) nodes.push(n);
  const parts = nodes.map(n => n.data), seps = nodes.map((n, i) => (i && n.parentNode !== nodes[i - 1].parentNode && !/\s$/.test(parts[i - 1]) && !/^\s/.test(parts[i]) ? ' ' : ''));
  return { el, nodes, parts, seps, text: parts.map((p, i) => seps[i] + p).join(''), xr: el.dataset ? el.dataset.xr : undefined, L: null, added: null };
}
// new words for it (null: its own back): only what changed is written, into the text node where the change starts, so
// the bold and the colours stay where they were
function arrSetText(T, s) {
  if (T.L) { T.L.w = 0; T.L.nar = undefined; if (typeof dropSprite === 'function') dropSprite(T.L); }   // (measured and drawn again)
  if (s === null) {
    T.nodes.forEach((n, i) => { n.data = T.parts[i]; });
    if (T.added) T.added.data = '';
    if (T.xr !== undefined) T.el.dataset.xr = T.xr;
    return;
  }
  if (T.xr !== undefined) delete T.el.dataset.xr;   // (the headset shows the new words too, not its own version of the old)
  if (!T.nodes.length) { if (!T.added) T.added = T.el.appendChild(document.createTextNode('')); T.added.data = s; return; }
  const old = T.text;
  let p = 0, q = 0;
  while (p < old.length && p < s.length && old[p] === s[p]) p++;
  while (q < old.length - p && q < s.length - p && old[old.length - 1 - q] === s[s.length - 1 - q]) q++;
  const e = old.length - q, mid = s.slice(p, s.length - q);
  let pos = 0, put = false;
  T.nodes.forEach((n, i) => {
    pos += T.seps[i].length;
    const a = pos, part = T.parts[i], b = (pos += part.length);
    let d = part.slice(0, clamp(p - a, 0, part.length));
    if (!put && b >= p) { d += mid; put = true; }
    n.data = d + part.slice(clamp(e - a, 0, part.length));
  });
}
const arrNums = s => s.match(ARR_NUM) || [];
// {1}, {2} ... in an arrangement's words: the story's own numbers, as it has them now
const arrFill = (s, own) => { const nums = arrNums(own); return s.replace(/\{(\d+)\}/g, (m, k) => (nums[k - 1] !== undefined ? nums[k - 1] : m)); };
// words compared with their numbers left out: the story's numbers come from its data and may change
const arrShape = s => String(s).replace(ARR_NUM, '#').replace(/\s+/g, ' ').trim();
function arrSnapItems(o) {
  o.items = ST.items.map(it => it.els.map(e => ({ at: e.at, out: e.out, end: e.out === it.ch.b - 0.05, T: arrText(e.el, true) })));
}
// the story's own, as buildStory made it, taken once (before anything is moved)
function arrSnap() {
  if (ARR.o) return ARR.o;
  const o = ARR.o = { sync: NARRATION_SYNC.map(p => p.slice()), ends: typeof NARRATION_ENDS === 'object' && NARRATION_ENDS ? Object.assign({}, NARRATION_ENDS) : null,
    ch: CH.map(c => [c.a, c.b]), tr: {}, wp: ST.wp.map(w => w[0]), yaw: [], stand: (ST.stand || []).map(s => s.slice()),
    labels: ST.labels.map(L => ({ t0: L.tIn, t1: L.tOut, T: Object.assign(arrText(L.el), { L }) })), cues: SFXQ.cues.map(c => c.t), spans: SFXQ.spans.map(s => [s.t0, s.t1]) };
  for (const n in TR) o.tr[n] = TR[n].map(k => k[0]);
  arrSnapItems(o);
  // each set's turn (buildCamera) starts with a waypoint, and moves with it
  let j = 0;
  for (const y of ST.yaw || []) {
    while (j < o.wp.length && o.wp[j] < y.t0) j++;
    o.yaw.push([y.t0, j < o.wp.length && o.wp[j] === y.t0 ? j++ : -1]);
  }
  return o;
}
const arrShow = n => n.endsWith('_a') && !!GL.sets[n.slice(0, -2)];
const arrSetOf = n => (arrShow(n) ? n.slice(0, -2) : SET_ORDER.find(k => n in (GL.sets[k].params || {})) || null);
// the story's own timeline as data (tools/engine/SPEC.md, "The model"), or null before the story is built
function arrModel() {
  if (!ARR.built) return null;
  const o = arrSnap(), yaw = ST.yaw || [];
  const camLabel = i => { let k = ''; yaw.forEach((y, n) => { if (o.yaw[n][1] >= 0 && o.yaw[n][1] <= i) k = y.k; }); return k + (ST.wp[i].includes('spin') ? ' (turning)' : ''); };
  return { v: 1, key: XR_HERE, len: o.ch[o.ch.length - 1][1],
    chapters: CH.map((c, i) => ({ key: c.key, name: c.name, a: o.ch[i][0], b: o.ch[i][1] })),
    sync: o.sync.map(p => p.slice()),
    narration: typeof narrationFile === 'function' && !(typeof hasNarration === 'function' && !hasNarration()) ? narrationFile() : null,
    tracks: Object.keys(o.tr).map(n => ({ id: 'p:' + n, name: n, set: arrSetOf(n), kind: arrShow(n) ? 'show' : typeof STEP !== 'undefined' && STEP.has(n) ? 'step' : 'param',
      keys: o.tr[n].map((t, i) => ({ i, t, v: TR[n][i][1] })) })),
    camera: o.wp.map((t, i) => ({ i, t, label: camLabel(i) })),
    captions: ST.items.flatMap((it, ci) => it.els.map((e, i) => { const q = o.items[ci][i]; return { id: it.ch.key + ':' + i, ch: it.ch.key, i, at: q.at, text: q.T.text, tokens: arrNums(q.T.text) }; })),
    labels: o.labels.map((L, i) => ({ id: 'l' + i, t0: L.t0, t1: L.t1, text: L.T.text })),
    cues: o.cues.map((t, i) => ({ i, t, name: SFXQ.cues[i].name })),
    sets: SET_ORDER.map(k => ({ key: k, name: (typeof SCENES !== 'undefined' && (SCENES.find(s => s[0] === k) || [])[1]) || k })) };
}
// a run of times (a track's keys, the waypoints: [t, ...] each) with some moved, in order, each clamped between its
// neighbours
function arrMove(list, mv) {
  for (const i of Object.keys(mv).map(Number).sort((x, y) => x - y)) {
    const lo = i > 0 ? list[i - 1][0] : -Infinity, hi = i < list.length - 1 ? list[i + 1][0] : Infinity;
    list[i][0] = clamp(mv[i], lo, hi);
  }
}
const arrSyncOk = W => Array.isArray(W) && W.length >= 2 && W.every((p, i) => Array.isArray(p) && p.length >= 2 && Number.isFinite(p[0]) && Number.isFinite(p[1]) && p[0] >= 0 && p[1] >= 0
  && (!i || (p[0] > W[i - 1][0] && p[1] > W[i - 1][1])));
// lay arrangement A over the story (null: back to its own); returns { dropped: [ids] }: the edits not applied, as
// '<field>:<id>' ('keys:p:atlas_a#3', 'captions:atlas:2', 'chapters:slide', 'place:hier', 'camera:4', 'cues:2', 'labels:l0'),
// 'sync', 'narration', or 'key' (another story's arrangement: nothing applied). name: the copy's, for its recording
// (HOST.arrange.url); at the load HOST.arrange.current gives it
function arrApply(A, name) {
  if (!ARR.built) { ARR.pend = A || null; if (name) ARR.name = name; return { dropped: [] }; }
  if (name) ARR.name = name;
  if (!A && !ARR.A) return { dropped: [] };
  const o = arrSnap(), drop = [], s0 = arrUnM(storyT(APP.t)), t0 = APP.t;   // (where the story is, in its own time)
  // 1. the story's own
  CH.forEach((c, i) => { c.a = o.ch[i][0]; c.b = o.ch[i][1]; });
  for (const n in o.tr) o.tr[n].forEach((t, i) => { TR[n][i][0] = t; });
  ST.wp.forEach((w, i) => { w[0] = o.wp[i]; });
  (ST.stand || []).forEach((s, i) => { for (let k = 0; k < 4; k++) s[k] = o.stand[i][k]; });
  ST.items.forEach((it, ci) => it.els.forEach((e, i) => { const q = o.items[ci][i]; e.at = q.at; e.out = q.out; }));
  ST.labels.forEach((L, i) => { L.tIn = o.labels[i].t0; L.tOut = o.labels[i].t1; });
  SFXQ.cues.forEach((c, i) => { c.t = o.cues[i]; });
  SFXQ.spans.forEach((s, i) => { s.t0 = o.spans[i][0]; s.t1 = o.spans[i][1]; });
  for (const T of ARR.tx) arrSetText(T, null);
  ARR.tx = []; ARR.M = ARR.R = ARR.sk = null; ARR.seg = -1;
  let sync = o.sync, want = '', place = null;
  if (A && (typeof A !== 'object' || (A.key && A.key !== XR_HERE))) { drop.push('key'); A = null; }
  if (A) {
    const num = v => typeof v === 'number' && Number.isFinite(v), same = (v, t) => num(v) && Math.abs(v - t) < 1e-3;
    const ent = x => (x && typeof x === 'object' && !Array.isArray(x) ? Object.entries(x) : []), ok = e => !!e && typeof e === 'object';
    // 2. keyframes, waypoints, cues, the panel's points and the labels moved or rewritten (story time); each names
    // what it changed from (was): one that no longer matches the story's own is dropped
    const mv = {};
    for (const [id, e] of ent(A.keys)) {
      const m = /^p:(.+)#(\d+)$/.exec(id), n = m && m[1], i = m ? +m[2] : -1;
      if (!n || !o.tr[n] || i >= o.tr[n].length || !ok(e) || !num(e.t) || !same(e.was, o.tr[n][i])) { drop.push('keys:' + id); continue; }
      (mv[n] = mv[n] || {})[i] = e.t;
    }
    for (const n in mv) arrMove(TR[n], mv[n]);
    const mc = {};
    for (const [i, e] of ent(A.camera)) {
      if (!/^\d+$/.test(i) || +i >= o.wp.length || !ok(e) || !num(e.t) || !same(e.was, o.wp[+i])) { drop.push('camera:' + i); continue; }
      mc[+i] = e.t;
    }
    arrMove(ST.wp, mc);
    for (const [i, e] of ent(A.cues)) {
      if (!/^\d+$/.test(i) || +i >= o.cues.length || !ok(e) || !num(e.t) || !same(e.was, o.cues[+i])) { drop.push('cues:' + i); continue; }
      SFXQ.cues[+i].t = Math.max(0, e.t);
    }
    for (const [id, e] of ent(A.captions)) {
      const m = /^(.+):(\d+)$/.exec(id), ci = m ? CH.findIndex(c => c.key === m[1]) : -1, q = ci >= 0 && o.items[ci] ? o.items[ci][+m[2]] : null;
      let bad = !q || !ok(e) || (e.text === undefined && e.at === undefined);
      if (!bad && e.text !== undefined) {
        if (typeof e.text === 'string' && typeof e.was === 'string' && arrShape(e.was) === arrShape(q.T.text)) { arrSetText(q.T, arrFill(e.text, q.T.text)); ARR.tx.push(q.T); }
        else bad = true;
      }
      if (!bad && e.at !== undefined) {
        // (its time stays in its chapter, before its own end)
        if (num(e.at) && same(e.wasAt, q.at)) ST.items[ci].els[+m[2]].at = clamp(e.at, o.ch[ci][0], Math.max(o.ch[ci][0], q.out - 0.1)); else bad = true;
      }
      if (bad) drop.push('captions:' + id);
    }
    for (const [id, e] of ent(A.labels)) {
      const m = /^l(\d+)$/.exec(id), L = m && o.labels[+m[1]];
      if (!L || !ok(e) || typeof e.text !== 'string' || typeof e.was !== 'string' || arrShape(e.was) !== arrShape(L.T.text)) { drop.push('labels:' + id); continue; }
      arrSetText(L.T, arrFill(e.text, L.T.text)); ARR.tx.push(L.T);
    }
    // 3, 4. chapters stretched or squeezed to a new length (story time), or skipped
    const lens = o.ch.map(([a, b]) => b - a), sk = new Set();
    const tidy = o.ch.every(([a, b], i) => b > a && (!i || a >= o.ch[i - 1][1] - 1e-9));
    let stretch = false;
    for (const [k, e] of ent(A.chapters)) {
      const i = CH.findIndex(c => c.key === k);
      if (i < 0 || !ok(e)) { drop.push('chapters:' + k); continue; }
      if (e.len !== undefined) {
        if (num(e.len) && e.len >= 0.1 && e.len <= 36000 && tidy) { if (Math.abs(e.len - lens[i]) > 1e-6) { lens[i] = e.len; stretch = true; } } else drop.push('chapters:' + k);
      }
      if (e.skip === true) sk.add(i);
    }
    ARR.sk = sk.size ? sk : null;
    // 5. the narration's timing replaced (story time, before the chapters' lengths), and its recording
    if (A.sync !== undefined) { if (arrSyncOk(A.sync)) sync = A.sync.map(p => [p[0], p[1]]); else drop.push('sync'); }
    if (A.narration !== undefined) {
      if (typeof A.narration === 'string' && A.narration && !/\.\.|^\/|\\|:/.test(A.narration) && HOST.arrange && HOST.arrange.url && ARR.name) want = A.narration;
      else drop.push('narration');
    }
    if (stretch) {
      // every time inside a chapter scaled with it and everything after it moved on (M, story time); on the timeline
      // each chapter's span of the recording scaled alike (Q), so it plays longer or shorter as the timeline shows
      const map = (bnd, len) => {
        const xs = [], ys = [];
        bnd.forEach(([a, b], i) => {
          if (!xs.length) { xs.push(a); ys.push(a); } else if (a > xs[xs.length - 1]) { ys.push(ys[ys.length - 1] + a - xs[xs.length - 1]); xs.push(a); }
          ys.push(ys[ys.length - 1] + len(i, a, b)); xs.push(b);
        });
        return [xs, ys];
      };
      ARR.M = map(o.ch, i => lens[i]);
      // (the narration's timing gets a point at each chapter's ends, so no line spans two chapters' scales)
      const base = sync.slice();
      for (const [a, b] of o.ch) for (const s of [a, b]) if (!base.some(p => Math.abs(p[1] - s) < 1e-9)) base.push([arrNarrT(sync, s), s]);
      base.sort((p, r) => p[1] - r[1]);
      const Q = map(o.ch.map(([a, b]) => [arrNarrT(base, a), arrNarrT(base, b)]), (i, a, b) => (b - a) * lens[i] / (o.ch[i][1] - o.ch[i][0]));
      sync = base.map(([r, s]) => [arrPw(Q[0], Q[1], r), arrM(s)]);
      ARR.R = { rho: sync.map(p => p[0]), rec: base.map(p => p[0]) };
    }
    // 6. places: each set moved, turned and scaled on top of what the story does with it (arrPlace, every frame)
    for (const [k, p] of ent(A.place)) {
      if (!GL.sets[k] || !Array.isArray(p) || p.length < 5 || !p.slice(0, 5).every(num) || p[4] <= 0) { drop.push('place:' + k); continue; }
      (place = place || {})[k] = p.slice(0, 5);
    }
  }
  // the times: the chapters' map over everything, then the narration's table and what follows it on the timeline
  if (ARR.M) {
    for (const n in TR) for (const k of TR[n]) k[0] = arrM(k[0]);
    for (const w of ST.wp) w[0] = arrM(w[0]);
    for (const s of ST.stand || []) for (let k = 0; k < 4; k++) s[k] = arrM(s[k]);
    ST.items.forEach((it, ci) => it.els.forEach((e, i) => { e.at = arrM(e.at); e.out = o.items[ci][i].end ? arrM(o.ch[ci][1]) - 0.05 : arrM(e.out); }));
    for (const L of ST.labels) { L.tIn = arrM(L.tIn); L.tOut = arrM(L.tOut); }
    for (const c of SFXQ.cues) c.t = arrM(c.t);
    for (const s of SFXQ.spans) { s.t0 = arrM(s.t0); s.t1 = arrM(s.t1); }
    CH.forEach((c, i) => { c.a = arrM(o.ch[i][0]); c.b = arrM(o.ch[i][1]); });
  }
  (ST.yaw || []).forEach((y, i) => { const [t, j] = o.yaw[i]; y.t0 = j >= 0 ? ST.wp[j][0] : arrM(t); });
  NARRATION_SYNC.length = 0;
  for (const p of sync) NARRATION_SYNC.push(p.slice());
  if (o.ends) for (const k in o.ends) NARRATION_ENDS[k] = want ? 0 : arrTl(o.ends[k]);   // (a recording of the copy's own: where its lines end is not known)
  CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); });
  for (const c of SFXQ.cues) c.n = Math.max(0.05, narrT(c.t));
  for (const s of SFXQ.spans) { s.n0 = narrT(s.t0); s.n1 = narrT(s.t1); }
  ARR.A = A || null;
  arrPlaces(place);
  arrEnd();
  // the story keeps its place: the same moment of the story, on the new timeline
  const t = clamp(narrT(arrM(s0)), 0, Math.max(0, T_END - 0.01));
  if (Math.abs(t - t0) > 1e-6) { APP.t = t; if (AUD) AUD.seeked(); }
  // the recording: the copy's (fetched from the relay with the password: HOST.arrange.url), or the story's own
  if (want !== ARR.want || !want) {
    const vk = ++ARR.vk;
    ARR.want = want; ARR.url = '';
    if (want) Promise.resolve(HOST.arrange.url(ARR.name, want)).then(u => { if (vk === ARR.vk && typeof u === 'string' && u) { ARR.url = u; arrVoiceSwap(); } }, () => {});
    arrVoiceSwap();
  }
  if (XR.main) XR.main.last = '';   // (the headset's panels drawn again: their words or chapters may have changed)
  if (XR.foot) XR.foot.last = '';
  return { dropped: drop };
}
// the timeline's end: the narration's last point, or the recording's end if that is later (AUD_HOOKS.ready); its marks
function arrEnd() {
  const W = NARRATION_SYNC;
  T_END = W[W.length - 1][0];
  if (ARR.d && arrTl(ARR.d) + 1 > T_END) T_END = arrTl(ARR.d) + 1;
  if (typeof trackHTML === 'function' && $('#track')) trackHTML();
  lastTick = -1;
  arrTrack();
}
// the timeline's skipped chapters, greyed (and their names struck through)
function arrTrack() {
  const tr = $('#track');
  if (!tr || (!ARR.sk && !ARR.tk)) return;
  tr.querySelectorAll('.arrskip').forEach(e => e.remove());
  tr.querySelectorAll('.name').forEach(n => { n.style.opacity = ''; n.style.textDecoration = ''; });
  ARR.tk = !!ARR.sk;
  if (!ARR.sk) return;
  const knob = tr.querySelector('.knob');
  for (const i of ARR.sk) {
    const c = CH[i], d = document.createElement('div'), n = tr.querySelector(`.name[data-k="${c.key}"]`);
    d.className = 'rail arrskip';
    d.style.cssText = `left:${(100 * c.na / T_END).toFixed(2)}%;right:auto;width:${(100 * Math.max(0, c.nb - c.na) / T_END).toFixed(2)}%;`
      + 'background:repeating-linear-gradient(135deg,rgba(8,12,20,0.9) 0 3px,rgba(160,178,202,0.35) 3px 6px);pointer-events:none';
    tr.insertBefore(d, knob);
    if (n) { n.style.opacity = '0.45'; n.style.textDecoration = 'line-through'; }
  }
}
// the headset's timeline (drawFoot): the skipped chapters greyed over its rail
function arrFoot(ctx, x0, x1, ty) {
  if (!ARR.sk) return;
  ctx.fillStyle = 'rgba(8,15,28,0.8)';
  for (const i of ARR.sk) { const c = CH[i]; ctx.fillRect(x0 + (x1 - x0) * c.na / T_END, ty - 3, (x1 - x0) * Math.max(0, c.nb - c.na) / T_END, 12); }
}
// playing on into a skipped chapter jumps to the next one not skipped (the narration with it: APP.seek), and plays none
// of the sound cues it passes
function arrSkip() {
  const K = ARR.sk;
  if (!K || APP.mode !== 'story' || !APP.playing) return;
  const t = APP.t, i = CH.findIndex(c => t >= c.na && t < c.nb);
  if (i < 0 || !K.has(i)) return;
  let j = i;
  while (j < CH.length && K.has(j)) j++;
  APP.seek(j < CH.length ? CH[j].na + 0.02 : T_END);
  SFXQ.hi = APP.t;
}
// places: [dx, dy, dz, turn (degrees about up), scale] on a set's group, on top of where the story puts it. Each number
// of its position, turn and size the story wrote since the last frame is that number's base; one left as this wrote it
// keeps its base (the pass story's sea writes its height alone, and a set's turn is written every frame)
const _aq = new THREE.Quaternion(), _ay = new THREE.Vector3(0, 1, 0), _ae = new THREE.Euler();
const arrNow = g => [g.position.x, g.position.y, g.position.z, g.rotation.x, g.rotation.y, g.rotation.z, g.scale.x, g.scale.y, g.scale.z];
function arrPlaces(place) {
  const P = ARR.pl || {};
  for (const k in P) P[k].v = null;   // (back where the story puts it, at the next frame)
  for (const k in place || {}) { P[k] = P[k] || { b: null, w: null }; P[k].v = place[k]; }
  ARR.pl = Object.keys(P).length ? P : null;
}
function arrPlace() {
  const P = ARR.pl;
  if (!P) return;
  for (const k in P) {
    const p = P[k], g = GL.sets[k].group, c = arrNow(g);
    p.b = c.map((x, i) => (p.w && x === p.w[i] ? p.b[i] : x));
    const v = p.v, b = p.b;
    if (!v) { g.position.set(b[0], b[1], b[2]); g.rotation.set(b[3], b[4], b[5]); g.scale.set(b[6], b[7], b[8]); delete P[k]; continue; }
    g.position.set(b[0] + v[0], b[1] + v[1], b[2] + v[2]);
    // (a set the story turns only about up, as most do, keeps a plain turn; else the turn is laid on its own)
    if (!b[3] && !b[5]) g.rotation.set(0, b[4] + v[3] * D2R, 0);
    else g.quaternion.setFromEuler(_ae.set(b[3], b[4], b[5], g.rotation.order)).premultiply(_aq.setFromAxisAngle(_ay, v[3] * D2R));
    g.scale.set(b[6] * v[4], b[7] * v[4], b[8] * v[4]);
    p.w = arrNow(g);
  }
  if (!Object.keys(P).length) ARR.pl = null;
}
// the narration on a timeline whose chapters are longer or shorter (ARR.R): each line of the recording (a stretch
// between two points of the narration's timing) plays from its cue at its own pace; a longer stretch waits quietly after
// it, a shorter one cuts it. arrRec: the line at the timeline's t and the recording's second there (-1: quiet)
function arrRec(t) {
  const P = ARR.R.rho, Q = ARR.R.rec, n = P.length;
  if (t < P[0]) return { j: -1, r: Q[0] + t - P[0] };
  for (let j = 0; j < n - 1; j++) if (t < P[j + 1]) { const d = t - P[j]; return { j, r: d < Q[j + 1] - Q[j] ? Q[j] + d : -1 }; }
  return { j: n - 1, r: Q[n - 1] + t - P[n - 1] };
}
// a second of the recording on the timeline (the same second without an arrangement that changes it)
function arrTl(r) {
  const R = ARR.R;
  if (!R || r === null) return r;
  const P = R.rho, Q = R.rec, n = Q.length;
  if (r < Q[0]) return P[0] + r - Q[0];
  for (let j = 0; j < n - 1; j++) if (r < Q[j + 1]) return P[j] + Math.min(r - Q[j], P[j + 1] - P[j]);
  return P[n - 1] + r - Q[n - 1];
}
function arrSync(want, t) {
  const q = arrRec(t);
  if (q.j !== ARR.seg) { ARR.seg = q.j; AUD.seeked(); }   // (a new line: the sound goes to where it starts)
  AUD.sync(want && q.r >= 0, Math.max(0, q.r));
}
function arrFollow(t) {
  const q = arrRec(t);
  if (q.r < 0 || q.j !== ARR.seg) return t;   // (quiet, or a line the sound has not gone to yet: the story's own clock)
  const r = AUD.follow(q.r);
  return Math.abs(r - q.r) < 0.6 ? t + r - q.r : arrTl(r);
}
// the recording: the copy's (once its address is known), or the story's own (narrationFile)
// (a package without a recording of its own has none: hasNarration)
const arrVoice = () => ARR.url || (typeof narrationFile === 'function' && !(typeof hasNarration === 'function' && !hasNarration()) ? narrationFile() : '');
function arrVoiceSwap() {
  if (!LOAD.done || typeof AUD_HOOKS === 'undefined') return;   // (while loading, audioInit takes arrVoice(); the design room has no recording)
  const url = arrVoice();
  if (!url && AUD) { AUD.sync(false, 0); AUD = null; ARR.d = 0; arrEnd(); }   // (a copy's recording gone from a package without one: quiet again)
  if (!url || (AUD && AUD.url === url)) return;
  if (!AUD) for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {   // (a package without a recording of its own: audioInit's lines)
    const f = APP[name];
    APP[name] = function (...args) { const r = f.apply(APP, args); if (AUD) { AUD.seeked(); audioSync(); } return r; };
  }
  AUD = HOST.audio.narration(url, AUD_HOOKS);
  ARR.d = 0; ARR.seg = -1;
  arrEnd();
  AUD.seeked(); audioSync();
}
// at the load, once the story is written: the arrangement given before then, or the one the shell holds for this story
// (HOST.arrange.current); one that fails leaves the story as its own
function arrLoad() {
  ARR.built = true;
  try {
    const cur = HOST.arrange && HOST.arrange.current ? HOST.arrange.current(XR_HERE) : null;
    if (cur && cur.name && !ARR.name) ARR.name = cur.name;
    const A = ARR.pend !== undefined ? ARR.pend : cur && cur.A;
    ARR.pend = undefined;
    if (A) arrApply(A);
  } catch (e) { console.warn('arrangement not applied', e); }
}
// the story's side of an arrangement: arrange in the object the story returns
const ARR_API = { model: arrModel, apply: arrApply, get: () => ARR.A };

// what the app shell needs to change story (the same contract as stories/<key>.js)
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  recenter: xrRecenterAsk,
  panels: () => (XR.main && XR.foot ? { main: XR.main, foot: XR.foot } : null),   // (for the shell's menu, its Story tab)
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the explore panes, and there are no effects
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // arrangements (tools/engine/SPEC.md): the story's own timeline as data, an arrangement laid over it, the one laid
  arrange: ARR_API,
  // for tests and the browser console: HOST.cur.peek('APP.t')
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
