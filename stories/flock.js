// A flock: starlings at dusk, flying all around you, each following the seven nearest to it, so the flock is a
// network that changes from moment to moment. A short story, then the flock flies on for as long as you stay.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/flock/build.mjs from the tour's kit and engine (adapted) and the set in tools/flock: edit those, not this file.
HOST.register('flock', function (HOST) {
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
// The one set: the flock, its sky and its land, life size (1 unit is 1 m), the
// viewer standing at the origin. The story drives it through its params.
const SETS = {};
// A murmuration: starlings at dusk, flying all around you. A live simulation: each bird matches the heading of its
// seven nearest neighbours (as starlings do, whatever the distance), keeps its distance, follows the flock's
// wandering roosts round the viewer, steers clear of the viewer's head and hands, and flees a falcon. Alarm passes
// from bird to neighbour, so a wave runs through the flock (the birds bank, and their wings show as dark bands).
// Life size: 1 unit is 1 m, the viewer stands at the origin, the ground is y = 0, the sun sets towards -z.
// The simulation is the one part of a set that is not a pure function of the params and the time: it runs on.
SETS.flock = function (K) {
  const { THREE, clamp, lerp, rng } = K;
  const set = K.newSet('flock');
  const TAU = Math.PI * 2;

  // ---------------------------------------------------------------- the sky, shared by the sky, the land and the birds
  const SUN = new THREE.Vector3(0.18, 0.045, -1).normalize();
  const SKY = `
uniform vec3 uSun;
float hsh(vec2 p) { return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453); }
float vno(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }
// dusk: deep blue overhead, a warm band low down (strongest towards the sun), the sun's glow, streaks of cloud
vec3 skyCol(vec3 d) {
  float y = max(d.y, 0.0), s = max(dot(d, uSun), 0.0);
  vec3 c = mix(vec3(0.33, 0.39, 0.6), vec3(0.07, 0.11, 0.26), pow(y, 0.55));
  float low = pow(1.0 - y, 6.0);
  c = mix(c, mix(vec3(0.82, 0.5, 0.48), vec3(1.0, 0.62, 0.36), s * s), low * (0.45 + 0.55 * s));
  c += vec3(1.0, 0.72, 0.45) * (pow(s, 900.0) * 3.0 + pow(s, 24.0) * 0.4 + pow(s, 5.0) * 0.12);
  float band = smoothstep(0.015, 0.06, y) * (1.0 - smoothstep(0.12, 0.3, y));
  if (band > 0.0) {
    vec2 q = vec2(atan(d.z, d.x) * 5.0, y * 38.0);
    float n = vno(q * vec2(1.0, 0.5)) * 0.6 + vno(q * vec2(2.3, 1.1) + 7.0) * 0.4;
    float cl = smoothstep(0.55, 0.8, n) * band;
    c = mix(c, mix(vec3(0.42, 0.33, 0.45), vec3(1.0, 0.6, 0.45), pow(s, 3.0)), cl * 0.75);
  }
  return c;
}
// the haze where the land meets the sky, in the direction d
vec3 hazeCol(vec3 d) { return skyCol(normalize(vec3(d.x, 0.004, d.z))); }
`;
  const U = { uSun: { value: SUN }, uSky: { value: 1 }, uLag: { value: 0 } };
  const mat = o => { const m = new THREE.ShaderMaterial(o); set.mats.push(m); return m; };
  const ENV = [];   // the sky, the land, the trees and the reeds: hidden in passthrough, where your room takes their place

  // sky dome
  {
    const m = mat({
      uniforms: Object.assign({ uA: set.uA }, U), side: THREE.BackSide, depthWrite: false, transparent: true,
      vertexShader: `varying vec3 vD; void main() { vD = position; vec4 p = projectionMatrix * modelViewMatrix * vec4(position, 1.0); gl_Position = vec4(p.xy, p.w * 0.99999, p.w); }`,
      fragmentShader: SKY + `uniform float uA, uSky; varying vec3 vD;
void main() { vec3 d = normalize(vD); gl_FragColor = vec4(skyCol(d), uA * uSky); }`,
    });
    const sky = new THREE.Mesh(new THREE.SphereGeometry(900, 48, 24), m);
    sky.renderOrder = -2; sky.frustumCulled = false; set.group.add(sky); ENV.push(sky);
  }
  // the land: a dark field running into the haze, a lake towards the sunset that mirrors the sky, a line of trees
  {
    const m = mat({
      uniforms: Object.assign({ uA: set.uA }, U), transparent: true, depthWrite: false,
      vertexShader: `varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: SKY + `uniform float uA, uSky, uTimeW; varying vec3 vW;
void main() {
  vec3 e = cameraPosition, v = vW - e; float dist = length(v.xz); vec3 d = normalize(v);
  float n = vno(vW.xz * 0.02) * 0.6 + vno(vW.xz * 0.11) * 0.3 + vno(vW.xz * 0.9) * 0.1;
  vec3 c = mix(vec3(0.035, 0.045, 0.04), vec3(0.075, 0.07, 0.055), n);
  // the lake: beyond 45 m towards the sun, its shore wandering
  float lk = smoothstep(0.0, 18.0, -vW.z - 45.0 - (vno(vW.xz * 0.012) - 0.5) * 70.0) * smoothstep(-260.0, -140.0, -abs(vW.x));
  if (lk > 0.0) {
    vec3 r = reflect(d, vec3(0.0, 1.0, 0.0)); r.xz += (vno(vW.xz * 0.6 + uTimeW * 0.4) - 0.5) * 0.02;
    vec3 w = skyCol(normalize(r)) * 0.72 + vec3(0.02, 0.025, 0.04);
    c = mix(c, w, lk);
  }
  c = mix(c, hazeCol(d), 1.0 - exp(-dist * 0.0035));
  gl_FragColor = vec4(c, uA * uSky);
}`,
    });
    m.uniforms.uTimeW = K.U.uTime;
    const g = new THREE.CircleGeometry(880, 96).rotateX(-Math.PI / 2);
    const land = new THREE.Mesh(g, m); land.renderOrder = -1; land.frustumCulled = false; set.group.add(land); ENV.push(land);
    // the tree line: a ring of dark crowns of varying height, hazy with distance
    const R = rng(77), NS = 720, P = [], idx = [];
    for (let i = 0; i <= NS; i++) {
      const a = i / NS * TAU, r = 620 + 40 * Math.sin(a * 3 + 1);
      const hgt = Math.max(0, 6 + 10 * Math.sin(a * 7) * Math.sin(a * 13 + 2) + (R() - 0.5) * 8 + (Math.abs(Math.sin(a * 2.5)) < 0.15 ? -14 : 0));
      P.push(Math.cos(a) * r, -1, Math.sin(a) * r, Math.cos(a) * r, hgt, Math.sin(a) * r);
      if (i < NS) idx.push(2 * i, 2 * i + 1, 2 * i + 2, 2 * i + 1, 2 * i + 3, 2 * i + 2);
    }
    const tg = new THREE.BufferGeometry(); tg.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3)); tg.setIndex(idx);
    const tm = mat({
      uniforms: Object.assign({ uA: set.uA }, U), transparent: true, depthWrite: false, side: THREE.DoubleSide,
      vertexShader: `varying vec3 vW; void main() { vW = (modelMatrix * vec4(position, 1.0)).xyz; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: SKY + `uniform float uA, uSky; varying vec3 vW;
void main() { vec3 d = normalize(vW - cameraPosition); gl_FragColor = vec4(mix(vec3(0.03, 0.035, 0.05), hazeCol(d), 0.62), uA * uSky); }`,
    });
    const trees = new THREE.Mesh(tg, tm); trees.renderOrder = -1; trees.frustumCulled = false; set.group.add(trees); ENV.push(trees);
  }
  // reeds and grass round where you stand, swaying (a sense of scale, and ground under your feet)
  {
    const R = rng(5), NB = 2600, P = [], A = [];
    for (let i = 0; i < NB; i++) {
      const r = 2.2 + Math.pow(R(), 0.7) * 30, a = R() * TAU, x = Math.cos(a) * r, z = Math.sin(a) * r;
      const h = (0.35 + R() * 0.9) * (r > 10 ? 1.4 : 1), w = 0.012 + R() * 0.02, lean = (R() - 0.5) * 0.5, ry = R() * TAU;
      const cx = Math.cos(ry) * w, cz = Math.sin(ry) * w, ph = R() * TAU;
      P.push(x - cx, 0, z - cz, x + cx, 0, z + cz, x + lean * h * 0.3, h, z + lean * h * 0.2);
      A.push(0, ph, 0, ph, 1, ph);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(P), 3));
    g.setAttribute('aS', new THREE.BufferAttribute(new Float32Array(A), 2));
    const m = mat({
      uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, U), transparent: true, side: THREE.DoubleSide,
      vertexShader: `attribute vec2 aS; uniform float uTime; varying vec3 vW; varying float vH;
void main() { vec3 p = position; float s = aS.x * aS.x;
  p.x += s * (0.06 * sin(uTime * 1.3 + aS.y + p.z * 0.2) + 0.05); p.z += s * 0.03 * sin(uTime * 1.1 + aS.y * 1.7);
  vW = (modelMatrix * vec4(p, 1.0)).xyz; vH = aS.x; gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0); }`,
      fragmentShader: SKY + `uniform float uA, uSky; varying vec3 vW; varying float vH;
void main() { vec3 d = normalize(vW - cameraPosition);
  vec3 c = mix(vec3(0.03, 0.035, 0.025), vec3(0.16, 0.12, 0.08), vH) + hazeCol(d) * 0.18 * vH;
  c = mix(c, hazeCol(d), 1.0 - exp(-length(vW.xz - cameraPosition.xz) * 0.0035));
  gl_FragColor = vec4(c, uA * uSky); }`,
    });
    const reeds = new THREE.Mesh(g, m); reeds.frustumCulled = false; set.group.add(reeds); ENV.push(reeds);
  }

  // ---------------------------------------------------------------- the birds: a live simulation
  const MAXN = 400, KN = 7;                        // most birds; neighbours each bird follows
  const P = new Float32Array(MAXN * 3), V = new Float32Array(MAXN * 3), ACC = new Float32Array(MAXN * 3);
  const AL = new Float32Array(MAXN), AL2 = new Float32Array(MAXN), BK = new Float32Array(MAXN), PH = new Float32Array(MAXN), GR = new Float32Array(MAXN);
  const NB = new Int32Array(MAXN * KN), NBC = new Uint8Array(MAXN);
  const R = rng(1903);
  let N = 200;
  const spawn = (i, c) => {
    const a = R() * TAU, r = 3 + R() * 6, e = (R() - 0.5) * 4;
    P[i * 3] = c[0] + Math.cos(a) * r; P[i * 3 + 1] = Math.max(4, c[1] + e); P[i * 3 + 2] = c[2] + Math.sin(a) * r;
    V[i * 3] = -Math.sin(a) * 9; V[i * 3 + 1] = 0; V[i * 3 + 2] = Math.cos(a) * 9;
    AL[i] = 0; BK[i] = 0; PH[i] = R() * TAU; GR[i] = R();
  };
  for (let i = 0; i < MAXN; i++) spawn(i, [0, 9, -14]);
  // the viewer (head and hands, in this set's frame; the engine updates them) and the falcon
  const ME = { head: [0, 1.6, 0], hands: [], c: [0, 0] };
  const FAL = { on: false, p: [0, 0, 0], v: [0, 0, 0], t: 0, pass: 0, next: 30, aim: null };

  // where the flock likes to be: a roost point in front of the viewer (towards the sunset) that wanders slowly
  // left and right, in and out, up and down, and every 88 s comes in low and close for about ten seconds, so the
  // flock flies round the viewer (first at 72 s of flight: the story's last chapter, as the flock warms up for
  // 6 s); two more points near it pull parts of the flock aside, so it stretches and folds
  const roost = (k, t, out) => {
    const th = -Math.PI / 2 + 1.1 * Math.sin(t * 0.037) + 0.7 * Math.sin(t * 0.059 - 0.3) + t * 0.012, sw = Math.pow(Math.max(0, Math.sin(t * 0.071 - 3.54)), 10);
    const r = lerp(16 + 3 * Math.sin(t * 0.061), 2, sw), h = lerp(9 + 3 * Math.sin(t * 0.083 + 2), 5, sw);
    if (!k) SW = sw;
    out[0] = ME.c[0] + Math.cos(th) * r; out[1] = h; out[2] = ME.c[1] + Math.sin(th) * r;
    if (k) {   // the satellites: 3-9 m off the main point, turning round it
      const a = t * (0.23 + 0.07 * k) * (k === 1 ? 1 : -1) + k * 2.4, o = 6 + 3 * Math.sin(t * 0.05 * k + k);
      out[0] += Math.cos(a) * o; out[1] += Math.sin(a * 0.7 + k) * o * 0.4; out[2] += Math.sin(a) * o;
    }
    return out;
  };
  // and the flock's whim: a heading that turns now left, now right (slow waves of turning), climbing and diving a
  // little, which the whole flock leans towards; so it wheels and doubles back instead of circling
  const whim = t => {
    const a = -Math.PI / 2 - 2.9 * Math.cos(t * 0.31) - 1.13 * Math.cos(t * 0.53 + 2) + 0.9 * Math.sin(t * 0.13);
    return [Math.cos(a), 0.18 * Math.sin(t * 0.27) + 0.1 * Math.sin(t * 0.71 + 1), Math.sin(a)];
  };
  const RT = [[0, 0, 0], [0, 0, 0], [0, 0, 0]];
  let SW = 0;   // how far into a swoop
  const CEN = [0, 9, -14];   // the middle of the flock's main body (centre())

  // a grid of cells round the viewer for the neighbour search (birds beyond its edge share the edge cells)
  const CS = 1.1, GX = 72, GY = 34, GZ = 72, NC = GX * GY * GZ, cnt = new Int32Array(NC), start = new Int32Array(NC), mark = new Int32Array(NC), ids = new Int32Array(MAXN), key = new Float64Array(MAXN);
  let stamp = 0;
  const gx = x => clamp(Math.floor((x - ME.c[0]) / CS) + GX / 2, 0, GX - 1), gy = y => clamp(Math.floor(y / CS), 0, GY - 1), gz = z => clamp(Math.floor((z - ME.c[1]) / CS) + GZ / 2, 0, GZ - 1);
  const bd = new Float32Array(KN), bj = new Int32Array(KN);
  // the 27 cells round a bird, nearest first, so most far ones can be skipped once seven close birds are found
  const ORD = [];
  for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) ORD.push([dx, dy, dz, Math.abs(dx) + Math.abs(dy) + Math.abs(dz)]);
  ORD.sort((a, b) => a[3] - b[3]);
  function neighbours() {
    // the birds sorted by cell; only the cells in use are written (marked with this step's stamp)
    stamp++;
    for (let i = 0; i < N; i++) key[i] = ((gx(P[i * 3]) * GY + gy(P[i * 3 + 1])) * GZ + gz(P[i * 3 + 2])) * 4096 + i;
    const ks = key.subarray(0, N); ks.sort();
    for (let q = 0; q < N; q++) { const h = Math.floor(ks[q] / 4096); ids[q] = ks[q] - h * 4096; if (mark[h] !== stamp) { mark[h] = stamp; start[h] = q; cnt[h] = 0; } cnt[h]++; }
    for (let i = 0; i < N; i++) {
      const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2], cx = gx(x), cy = gy(y), cz = gz(z);
      // where the bird sits in its cell (for the distance to the cells round it)
      const fx = x - (ME.c[0] + (cx - GX / 2) * CS), fy = y - cy * CS, fz = z - (ME.c[1] + (cz - GZ / 2) * CS);
      let nb = 0;
      for (let o = 0; o < 27; o++) {
        const dx = ORD[o][0], dy = ORD[o][1], dz = ORD[o][2], ix = cx + dx, iy = cy + dy, iz = cz + dz;
        if (ix < 0 || iy < 0 || iz < 0 || ix >= GX || iy >= GY || iz >= GZ) continue;
        if (nb === KN) {
          const ex = dx < 0 ? fx : dx > 0 ? CS - fx : 0, ey = dy < 0 ? fy : dy > 0 ? CS - fy : 0, ez = dz < 0 ? fz : dz > 0 ? CS - fz : 0;
          if (Math.max(ex, 0) ** 2 + Math.max(ey, 0) ** 2 + Math.max(ez, 0) ** 2 >= bd[KN - 1]) continue;
        }
        const h = (ix * GY + iy) * GZ + iz;
        if (mark[h] !== stamp) continue;
        for (let q = start[h], e = start[h] + cnt[h]; q < e; q++) {
          const j = ids[q]; if (j === i) continue;
          const ex = P[j * 3] - x, ey = P[j * 3 + 1] - y, ez = P[j * 3 + 2] - z, d2 = ex * ex + ey * ey + ez * ez;
          if (nb === KN && d2 >= bd[KN - 1]) continue;
          let k = nb < KN ? nb++ : KN - 1;
          while (k > 0 && bd[k - 1] > d2) { bd[k] = bd[k - 1]; bj[k] = bj[k - 1]; k--; }
          bd[k] = d2; bj[k] = j;
        }
      }
      NBC[i] = nb; for (let k = 0; k < nb; k++) NB[i * KN + k] = bj[k];
    }
  }
  // one step of the flock
  const V0 = 8.5, KR = 0.16, KH = 0.6, EDGE = 24;   // cruising speed; the pulls of the roost and the whim; how far the flock may roam
  function step(dt, t, S) {
    neighbours();
    for (let k = 0; k < 3; k++) roost(k, t, RT[k]);
    const hx = ME.head[0], hy = ME.head[1], hz = ME.head[2];
    let gcx = 0, gcy = 0, gcz = 0;
    for (let i = 0; i < N; i++) { gcx += P[i * 3]; gcy += P[i * 3 + 1]; gcz += P[i * 3 + 2]; }
    gcx /= N; gcy /= N; gcz /= N;
    // the pull to the roost acts on the flock as a whole (on its middle), so the flock moves as one body
    const rpx = RT[0][0] - gcx, rpy = RT[0][1] - gcy, rpz = RT[0][2] - gcz, rpl = Math.hypot(rpx, rpy, rpz) + 1e-3, rpf = KR * (1 + 3 * SW) * Math.min(rpl, 30) / rpl, kh = KH * (1 - 0.8 * SW);   // in a swoop the roost wins
    const H = whim(t), hvx = H[0] * V0, hvy = H[1] * V0, hvz = H[2] * V0;
    for (let i = 0; i < N; i++) {
      const i3 = i * 3, x = P[i3], y = P[i3 + 1], z = P[i3 + 2], vx = V[i3], vy = V[i3 + 1], vz = V[i3 + 2];
      let ax = 0, ay = 0, az = 0;
      // the seven nearest: match their heading, keep a little apart, stay with them
      const nb = NBC[i];
      if (nb) {
        let mvx = 0, mvy = 0, mvz = 0, mx = 0, my = 0, mz = 0, amax = 0;
        for (let k = 0; k < nb; k++) {
          const j = NB[i * KN + k], j3 = j * 3, ex = x - P[j3], ey = y - P[j3 + 1], ez = z - P[j3 + 2], d2 = ex * ex + ey * ey + ez * ez + 1e-4;
          mvx += V[j3]; mvy += V[j3 + 1]; mvz += V[j3 + 2]; mx += P[j3]; my += P[j3 + 1]; mz += P[j3 + 2];
          if (d2 < 1.8) { const f = 2.6 * (1.8 - d2) / d2; ax += ex * f; ay += ey * f; az += ez * f; }
          if (AL[j] > amax) amax = AL[j];
        }
        const ia = 1 / nb, al = 1 + 2 * AL[i];
        ax += (mvx * ia - vx) * 2.2 * al; ay += (mvy * ia - vy) * 2.2 * al; az += (mvz * ia - vz) * 2.2 * al;
        ax += (mx * ia - x) * 1.0; ay += (my * ia - y) * 1.0; az += (mz * ia - z) * 1.0;
        // alarm passes from neighbour to neighbour, a little weaker each time, at the pace of a turn
        const tgt = Math.max(AL[i] * Math.exp(-dt * 0.9), amax * 0.93);
        AL2[i] = AL[i] + (tgt - AL[i]) * Math.min(1, dt * 14);
      } else AL2[i] = AL[i] * Math.exp(-dt * 0.9);
      // the roost and the whim; and a few birds lean towards a satellite instead (the lean changing slowly)
      const w = (GR[i] + t * 0.013) % 1, k = w < 0.8 ? 0 : w < 0.9 ? 1 : 2, rk = RT[k];
      ax += rpx * rpf + (rk[0] - RT[0][0]) * 0.3 + (hvx - vx) * kh; ay += rpy * rpf + (rk[1] - RT[0][1]) * 0.3 + (hvy - vy) * kh; az += rpz * rpf + (rk[2] - RT[0][2]) * 0.3 + (hvz - vz) * kh;
      // and the flock as a whole holds together
      ax += (gcx - x) * 0.28; ay += (gcy - y) * 0.28; az += (gcz - z) * 0.28;
      // keep round the viewer: not too far, not too close, not too low
      const ox = x - ME.c[0], oz = z - ME.c[1], od = Math.hypot(ox, oz) + 1e-3;
      if (od > EDGE) { const f = (od - EDGE) * 1.2 / od; ax -= ox * f; az -= oz * f; }
      if (y < 3.5) ay += (3.5 - y) * 6; if (y > 34) ay -= (y - 34) * 2;
      // the viewer's head and hands: give them a wide berth
      const qx = x - hx, qy = y - hy, qz = z - hz, qd = Math.hypot(qx, qy, qz) + 1e-3;
      if (qd < 2.6) { const f = 40 * (2.6 - qd) / (2.6 * qd); ax += qx * f; ay += qy * f + (2.6 - qd) * 5; az += qz * f; }
      for (const hd of ME.hands) { const ux = x - hd[0], uy = y - hd[1], uz = z - hd[2], ud = Math.hypot(ux, uy, uz) + 1e-3; if (ud < 2.2) { const f = 30 * (2.2 - ud) / (2.2 * ud); ax += ux * f; ay += uy * f; az += uz * f; } }
      // the falcon: those it nears flee, and raise the alarm
      if (FAL.on) {
        const fx = x - FAL.p[0], fy = y - FAL.p[1], fz = z - FAL.p[2], fd = Math.hypot(fx, fy, fz) + 1e-3;
        if (fd < 8) { const f = 40 * (8 - fd) / (8 * fd); ax += fx * f; ay += fy * f; az += fz * f; AL2[i] = Math.max(AL2[i], 1 - fd / 8 * 0.5); }
      }
      // speed: back towards cruising, faster when alarmed
      const sp = Math.hypot(vx, vy, vz) + 1e-3, want = V0 * (1 + 0.35 * AL[i]);
      ax += vx / sp * (want - sp) * 1.5; ay += vy / sp * (want - sp) * 1.5 - vy * 0.6; az += vz / sp * (want - sp) * 1.5;
      ACC[i3] = ax; ACC[i3 + 1] = ay; ACC[i3 + 2] = az;
    }
    for (let i = 0; i < N; i++) {
      const i3 = i * 3;
      let ax = ACC[i3], ay = ACC[i3 + 1], az = ACC[i3 + 2];
      const al = Math.hypot(ax, ay, az), lim = 60 + 80 * AL2[i];
      if (al > lim) { ax *= lim / al; ay *= lim / al; az *= lim / al; }
      const vx = V[i3] + ax * dt, vy = V[i3 + 1] + ay * dt, vz = V[i3 + 2] + az * dt, sp = Math.hypot(vx, vy, vz), s = sp > 16 ? 16 / sp : sp < 5 ? 5 / sp : 1;
      // bank into turns (the sideways part of the acceleration), and roll hard when alarmed
      const fx = vx / sp, fz = vz / sp, side = (ax * -fz + az * fx) / 9.8;
      const roll = clamp(-side * 0.7, -1.2, 1.2) + AL2[i] * 0.95;   // alarmed birds all roll the same way: a dark band
      BK[i] += (roll - BK[i]) * Math.min(1, dt * 6);
      V[i3] = vx * s; V[i3 + 1] = vy * s; V[i3 + 2] = vz * s;
      P[i3] += V[i3] * dt; P[i3 + 1] += V[i3 + 1] * dt; P[i3 + 2] += V[i3 + 2] * dt;
      AL[i] = AL2[i];
    }
    centre();
    // the falcon: in fast from afar, one stoop straight through the thick of the flock, then up and away
    if (FAL.on) {
      FAL.t += dt;
      let tx, ty, tz;
      const hunting = !FAL.pass && FAL.t < 6, through = FAL.pass && FAL.t < FAL.pass + 1.2;
      if (hunting) {   // home on the flock's main body (or where it was sent)
        tx = CEN[0]; ty = CEN[1]; tz = CEN[2];
        if (FAL.aim && FAL.t < 1.5) { tx = FAL.aim[0]; ty = FAL.aim[1]; tz = FAL.aim[2]; }
        if (Math.hypot(CEN[0] - FAL.p[0], CEN[1] - FAL.p[1], CEN[2] - FAL.p[2]) < 4) FAL.pass = FAL.t;
      } else if (through) { tx = FAL.p[0] + FAL.v[0]; ty = Math.max(FAL.p[1] + FAL.v[1], 6); tz = FAL.p[2] + FAL.v[2]; }
      else { tx = FAL.p[0] + FAL.v[0] * 3; ty = FAL.p[1] + 30; tz = FAL.p[2] + FAL.v[2] * 3; }
      const dx = tx - FAL.p[0], dy = ty - FAL.p[1], dz = tz - FAL.p[2], dl = Math.hypot(dx, dy, dz) + 1e-3, sp = hunting || through ? 26 : 18;
      for (let c = 0; c < 3; c++) { FAL.v[c] += ([dx, dy, dz][c] / dl * sp - FAL.v[c]) * Math.min(1, dt * 2.2); FAL.p[c] += FAL.v[c] * dt; }
      if (FAL.p[1] < 2) { FAL.p[1] = 2; FAL.v[1] = Math.max(FAL.v[1], 0); }   // never into the ground
      if (FAL.t > 10) { FAL.on = false; FAL.aim = null; }
    }
  }
  function launch(aim) {
    const a = R() * TAU, from = aim ? Math.atan2(aim[2] - ME.c[1], aim[0] - ME.c[0]) + Math.PI * (0.7 + R() * 0.6) : a;
    FAL.p = [ME.c[0] + Math.cos(from) * 70, 30 + R() * 15, ME.c[1] + Math.sin(from) * 70];
    FAL.v = [-Math.cos(from) * 20, -4, -Math.sin(from) * 20];
    FAL.on = true; FAL.t = 0; FAL.pass = 0; FAL.aim = aim || null;
  }

  // drawing: one instanced batch of birds; a body and two pointed wings that flap and glide, banking with the bird
  function birdGeo(span, len) {
    // x right, y up, z forward; aW: 0 body, else the wing (sign the side, size how far out)
    const w = span / 2, L = len;
    const V3 = [
      [0, 0, 0.55 * L, 0], [0.07 * L, 0, 0.05 * L, 0], [-0.07 * L, 0, 0.05 * L, 0], [0, 0.06 * L, 0.1 * L, 0], [0, -0.05 * L, 0.05 * L, 0], [0, 0, -0.35 * L, 0],   // body
      [-0.13 * L, 0.0, -0.5 * L, 0], [0.13 * L, 0.0, -0.5 * L, 0],                                                                                         // a short, square tail
      [0.05 * L, 0, 0.24 * L, 0.25], [0.05 * L, 0, -0.2 * L, 0.25], [w * 0.5, 0, 0.1 * L, 0.6], [w, 0, -0.28 * L, 1],                                // right wing: broad, triangular
      [-0.05 * L, 0, 0.24 * L, -0.25], [-0.05 * L, 0, -0.2 * L, -0.25], [-w * 0.5, 0, 0.1 * L, -0.6], [-w, 0, -0.28 * L, -1],                         // left wing
    ];
    const T = [0, 1, 3, 0, 3, 2, 0, 4, 1, 0, 2, 4, 1, 5, 3, 3, 5, 2, 1, 4, 5, 2, 5, 4, 5, 6, 7,
      8, 9, 10, 9, 11, 10, 12, 14, 13, 13, 14, 15];
    const g = new THREE.InstancedBufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(V3.flatMap(v => v.slice(0, 3))), 3));
    g.setAttribute('aW', new THREE.BufferAttribute(new Float32Array(V3.map(v => v[3])), 1));
    g.setIndex(T);
    return g;
  }
  const birdMat = (flapHz, sheen) => mat({
    uniforms: Object.assign({ uA: set.uA, uTime: K.U.uTime }, U), transparent: true, side: THREE.DoubleSide,
    vertexShader: `attribute float aW; attribute vec3 iP, iV; attribute vec3 iB;
uniform float uTime, uLag; varying vec3 vW; varying float vSh, vRim;
void main() {
  vec3 f = normalize(iV + vec3(0.0, 1e-4, 0.0));
  vec3 r = normalize(cross(f, vec3(0.0, 1.0, 0.0)) + vec3(1e-5, 0.0, 0.0)), u = cross(r, f);
  float b = iB.x; vec3 r2 = r * cos(b) + u * sin(b), u2 = cross(r2, f);
  // flap and glide: fast beats, now and then a glide with the wings held out; faster when alarmed
  float glide = smoothstep(0.25, 0.75, sin(uTime * 0.9 + iB.z * 3.1));
  float ph = uTime * ${flapHz.toFixed(2)} * (1.0 + 0.5 * iB.y) + iB.z;
  float flap = sin(ph) * (1.0 - 0.85 * glide) - 0.12 * glide;
  vec3 p = position; float s = abs(aW);
  p.y += flap * 0.5 * s * abs(p.x) / max(s, 1e-3) * step(0.01, s);
  p.x *= 1.0 - 0.18 * flap * flap * step(0.5, s);
  vec3 w = iP + iV * uLag + r2 * p.x + u2 * p.y + f * p.z;
  vW = (modelMatrix * vec4(w, 1.0)).xyz;
  vec3 toE = normalize(cameraPosition - vW);
  vSh = abs(dot(u2, toE));          // how much of its wing area faces you (banking shows the dark side)
  vRim = 1.0 - vSh;
  gl_Position = projectionMatrix * viewMatrix * vec4(vW, 1.0);
}`,
    fragmentShader: SKY + `uniform float uA; varying vec3 vW; varying float vSh, vRim;
void main() {
  vec3 d = normalize(vW - cameraPosition); float dist = length(vW - cameraPosition);
  vec3 c = mix(vec3(0.045, 0.04, 0.05), vec3(0.015, 0.012, 0.02), vSh);
  c += ${sheen} * vRim * 0.35 + skyCol(reflect(d, vec3(0.0, 1.0, 0.0))) * 0.05;
  c = mix(c, skyCol(d) * 0.9, 1.0 - exp(-dist * 0.004));   // further birds pale into the sky
  gl_FragColor = vec4(c, uA);
}`,
  });
  const bg = birdGeo(0.4, 0.22), iB = new Float32Array(MAXN * 3);
  const aP = new THREE.InstancedBufferAttribute(P, 3), aV = new THREE.InstancedBufferAttribute(V, 3), aB = new THREE.InstancedBufferAttribute(iB, 3);
  for (const a of [aP, aV, aB]) a.setUsage(THREE.DynamicDrawUsage);
  bg.setAttribute('iP', aP); bg.setAttribute('iV', aV); bg.setAttribute('iB', aB);
  const birds = new THREE.Mesh(bg, birdMat(7.5, 'vec3(0.16, 0.12, 0.22)'));
  birds.frustumCulled = false; birds.renderOrder = 2; set.group.add(birds);
  // the falcon: one larger bird, longer pointed wings, slower deeper beats
  const fg = birdGeo(1.0, 0.42), fP = new THREE.InstancedBufferAttribute(new Float32Array(3), 3), fV = new THREE.InstancedBufferAttribute(new Float32Array(3), 3), fB = new THREE.InstancedBufferAttribute(new Float32Array(3), 3);
  fg.setAttribute('iP', fP); fg.setAttribute('iV', fV); fg.setAttribute('iB', fB); fg.instanceCount = 1;
  const falcon = new THREE.Mesh(fg, birdMat(4.2, 'vec3(0.2, 0.17, 0.14)'));
  falcon.frustumCulled = false; falcon.renderOrder = 2; set.group.add(falcon);
  // the network: each bird to the seven it follows
  const lg = K.linesGeo(MAXN * KN), lm = K.lines(set, { additive: true }), net = new THREE.LineSegments(lg, lm);
  net.frustumCulled = false; net.renderOrder = 3; set.group.add(net);
  for (let i = 0; i < MAXN * KN * 2; i++) lg.attributes.aCol.array.set([0.35, 0.85, 1.0], i * 3);

  function draw(S) {
    for (let i = 0; i < N; i++) { iB[i * 3] = BK[i]; iB[i * 3 + 1] = AL[i]; iB[i * 3 + 2] = PH[i]; }
    bg.instanceCount = N;
    aP.needsUpdate = aV.needsUpdate = aB.needsUpdate = true;
    falcon.visible = FAL.on;
    if (FAL.on) { fP.array.set(FAL.p); fV.array.set(FAL.v); fB.array.set([0, 0, 1.3]); fP.needsUpdate = fV.needsUpdate = fB.needsUpdate = true; }
    const la = clamp(S.flock_links, 0, 1);
    net.visible = la > 0.01;
    if (net.visible) {
      const pa = lg.attributes.position.array, aa = lg.attributes.aA.array, hx = ME.head[0], hy = ME.head[1], hz = ME.head[2];
      let n = 0;
      for (let i = 0; i < N; i++) {
        const i3 = i * 3, dd = Math.hypot(P[i3] - hx, P[i3 + 1] - hy, P[i3 + 2] - hz), a = la * 0.55 * clamp(1.4 - dd / 40, 0.15, 1);
        for (let k = 0; k < NBC[i]; k++) {
          const j3 = NB[i * KN + k] * 3;
          pa[n * 6] = P[i3]; pa[n * 6 + 1] = P[i3 + 1]; pa[n * 6 + 2] = P[i3 + 2];
          pa[n * 6 + 3] = P[j3]; pa[n * 6 + 4] = P[j3 + 1]; pa[n * 6 + 5] = P[j3 + 2];
          aa[n * 2] = aa[n * 2 + 1] = a; n++;
        }
      }
      lg.setDrawRange(0, n * 2);
      lg.attributes.position.needsUpdate = true; lg.attributes.aA.needsUpdate = true;
    }
  }

  // ---------------------------------------------------------------- params, update, exports
  // the middle of the flock's main body: a few steps of mean shift (the birds within 9 m, from where the body was
  // last), so a flock split by the falcon is not looked for in the empty sky between its parts
  function middle() { let x = 0, y = 0, z = 0; for (let i = 0; i < N; i++) { x += P[i * 3]; y += P[i * 3 + 1]; z += P[i * 3 + 2]; } return [x / N, y / N, z / N]; }
  function centre() {
    let c = CEN;
    for (let it = 0; it < 2; it++) {
      let sx = 0, sy = 0, sz = 0, n = 0;
      for (let i = 0; i < N; i++) {
        const x = P[i * 3], y = P[i * 3 + 1], z = P[i * 3 + 2];
        if ((x - c[0]) ** 2 + (y - c[1]) ** 2 + (z - c[2]) ** 2 < 81) { sx += x; sy += y; sz += z; n++; }
      }
      c = n < N * 0.15 ? middle() : [sx / n, sy / n, sz / n];   // lost: start again from the middle of all
    }
    CEN[0] = c[0]; CEN[1] = c[1]; CEN[2] = c[2];
  }
  const params = { flock_a: 1, flock_birds: 200, flock_links: 0, flock_sky: 1, flock_falcon: 1, flock_hunt: 0 };
  let tLast = null, hunts = 0, tSim = 0, acc = 0;
  const SIM = 1 / 30;   // the flock moves in steps of a thirtieth of a second; between them the birds glide on (uLag)
  function update(S, t, dt) {
    const sky = U.uSky.value = clamp(S.flock_sky, 0, 1);
    for (const m of ENV) m.visible = sky > 0.003;
    // without the sky (passthrough) the flock flies in your room, at a third of life size
    set.group.scale.setScalar(sky > 0.5 ? 1 : 0.3);
    // more or fewer birds: new ones join beside a bird already flying
    const want = clamp(Math.round(S.flock_birds), 50, MAXN);
    if (want > N) for (let i = N; i < want; i++) { const j = Math.floor(R() * N) * 3; spawn(i, [P[j], P[j + 1], P[j + 2]]); }
    N = want;
    // the story (or a button) sends a falcon each time flock_hunt passes a whole number
    const h = Math.floor(S.flock_hunt + 1e-6);
    if (h > hunts && !FAL.on) launch(null);
    hunts = h;
    let d = dt === undefined ? (tLast === null ? 0 : t - tLast) : dt;
    tLast = t;
    d = clamp(d, 0, 0.1);
    // now and then a falcon comes on its own
    if (S.flock_falcon > 0.5 && !FAL.on) { FAL.next -= d; if (FAL.next < 0) { launch(null); FAL.next = 40 + R() * 40; } }
    acc = Math.min(acc + d, 0.2);
    let stepped = false;
    while (acc >= SIM) { acc -= SIM; tSim += SIM; step(SIM, tSim, S); stepped = true; }
    if (stepped) draw(S);
    U.uLag.value = acc;
  }
  // warm up, so the flock is already in the air when the scene first shows; then move it to its roost, in front
  for (let k = 0; k < 180; k++) { tSim += SIM; step(SIM, tSim, params); }
  {
    const c = middle();
    roost(0, tSim, RT[0]);
    for (let i = 0; i < MAXN; i++) { P[i * 3] += RT[0][0] - c[0]; P[i * 3 + 1] += RT[0][1] - c[1]; P[i * 3 + 2] += RT[0][2] - c[2]; }
    CEN[0] = RT[0][0]; CEN[1] = RT[0][1]; CEN[2] = RT[0][2]; centre();
  }
  draw(params);

  const anchors = { flock: () => [CEN[0], CEN[1] + 3, CEN[2]],   // 3 m above the body: where the camera aims
    falcon: () => (FAL.on ? [FAL.p[0], FAL.p[1] + 1.5, FAL.p[2]] : [0, -100, 0]) };
  const labels = [
    { text: ['Falcon', ''], at: 'falcon', cls: 'amb', alpha: () => (FAL.on && FAL.t < 6 ? 1 : 0) },
  ];
  // views: [az, el, dist, tx, ty, tz]. Among them: standing in the field, looking a little up (the target is just in
  // front of your eyes, so the camera stands where you do); from afar: the whole flock round the spot you stood on
  const cam = {
    default: [0, -26, 0.25, 0, 1.6, 0],
    up: [30, -48, 0.25, 0, 1.6, 0],
    afar: [20, 6, 17, 0, 9, -4],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['default', 'Follow the flock'], ['free', 'Look around'], ['afar', 'From afar']] },
    { key: 'birds', label: 'Birds', options: [['200', '200'], ['100', '100'], ['400', '400']] },
    { key: 'links', label: 'Network', options: [['off', 'Off'], ['on', 'Who follows whom']] },
    { key: 'falcon', label: 'Falcon', options: [['some', 'Now and then'], ['off', 'Off']] },
  ];
  function explore(c) {
    return { flock_birds: +c.birds || 200, flock_links: c.links === 'on' ? 1 : 0, flock_falcon: c.falcon === 'off' ? 0 : 1 };
  }
  // the engine tells the flock where you are (head and hands, in this set's frame), and sends a falcon where you point
  function see(head, hands) {
    ME.head = head; ME.hands = hands || [];
    ME.c[0] += (head[0] - ME.c[0]) * 0.02; ME.c[1] += (head[2] - ME.c[1]) * 0.02;
  }
  function scatter(dir) {
    if (FAL.on) return false;
    launch(dir ? [ME.head[0] + dir[0] * 20, Math.max(6, ME.head[1] + dir[1] * 20), ME.head[2] + dir[2] * 20] : null);
    return true;
  }
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore, see, scatter,
    birds: () => N, falconOn: () => FAL.on, state: () => ({ P, V, AL, N, NB, NBC, me: ME, falcon: FAL }) });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['flock'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 2000);   // standing among the birds: a wide view, out to the sky
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // lit sets (the computer, the complex, buildings ...) share one sky light and a light from over your shoulder
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
  scene.add(GL.stars); GL.stars.visible = false;   // the flock has its own sky
  // the sets themselves, all hidden until the story fades them in
  GL.sets = {};
  for (const k of SET_ORDER) {
    const s = SETS[k](K);
    GL.sets[k] = s;
    GL.world.add(s.group);
    s.setAlpha(0);
  }
}
// show each set as far as S fades it in, and let the visible ones update; in the story a set
// may be turned to meet the camera (see buildCamera)
function updateSets(S, t, dt, story) {
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
    s.group.rotation.y = story ? setYaw(k, t) * D2R : 0;
    s.setAlpha(a);
    if (a > 0.003) s.update(S, t, dt);
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
function applyCamera(v) {
  viewDir(v, _vd); _vt.set(v[3], v[4], v[5]);
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * (GL.fit || 1));
  GL.camera.position.y = Math.max(GL.camera.position.y, 0.4);   // never under the ground
  GL.camera.up.set(0, 1, 0); GL.camera.lookAt(_vt);
}
function resize() {
  if (GL.renderer.xr.isPresenting) return;
  const w = window.innerWidth, h = window.innerHeight, { renderer, camera } = GL;
  renderer.setSize(w, h, false);
  camera.aspect = w / h;
  const wide = w >= 900;
  GL.wide = wide;
  if (wide) camera.setViewOffset(w, h, -0.14 * w, 0, w, h);
  else camera.setViewOffset(w, h, 0, 0.21 * h, w, h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1.5 / (w / h) * 0.62);
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

// ----------------------------------------------------------- the flock --
// The flock is all round you. On a screen the camera, standing where you stand, turns to keep it in view as you
// would turn your head: it lets the flock wander a little first, and eases into and out of each turn, at up to
// 50 degrees a second. From afar it keeps the flock in the middle; flying out
// to a far view or back it keeps the flock framed and comes round to the view's own side at up to 60 degrees a
// second. keep: return the followed view as it is now (when you take over the camera).
const FOL = { az: null, el: -20, wa: 0, we: 0, tx: 0, ty: 8, tz: -10, vz: null, ve: 0 };
const lazy = (d, dz) => Math.sign(d) * Math.max(0, Math.abs(d) - dz);
// turn o[x] towards g: the speed it wants grows with the error beyond the dead zone; its speed o[w] eases there
function track(o, x, w, g, dz, gain, top, dt) {
  const want = clamp(lazy(g - o[x], dz) * gain, -top, top);
  o[w] += (want - o[w]) * (1 - Math.exp(-dt * 4));
  o[x] += o[w] * dt;
}
function followView(v, dt, keep) {
  dt = keep ? 0 : dt || 0;
  const c = GL.sets.flock.anchors.flock(), k = 1 - Math.exp(-dt * 1.2);
  const dx = c[0] - v[3], dy = c[1] - 3 - v[4], dz = c[2] - v[5], h = Math.hypot(dx, dz) + 1e-6;
  // the camera looks along -dir(az, el): it faces the flock at az = atan2(-dx, -dz), el = -atan(dy / h)
  let az = Math.atan2(-dx, -dz) / D2R;
  const el = clamp(-Math.atan2(dy, h) / D2R, -70, 8);
  if (FOL.az === null) { FOL.az = az; FOL.el = el; FOL.wa = FOL.we = 0; FOL.tx = c[0]; FOL.ty = c[1] - 3; FOL.tz = c[2]; }
  az += 360 * Math.round((FOL.az - az) / 360);
  // the dead zone: about half the way to the edge of the picture (narrow on a phone held upright)
  const hw = Math.atan(Math.tan(GL.camera.fov * D2R / 2) * GL.camera.aspect) / D2R;
  // below the picture's middle the side panel covers a narrow screen: there the flock is held a little higher
  track(FOL, 'az', 'wa', az, clamp(hw * 0.45, 6, 22), 2.5, 50, dt); track(FOL, 'el', 'we', el + (GL.wide ? 0 : 5), 6, 2.5, 30, dt);
  FOL.tx += (c[0] - FOL.tx) * k; FOL.ty += (c[1] - 3 - FOL.ty) * k; FOL.tz += (c[2] - FOL.tz) * k;
  // FOL.az winds on as the flock circles: blend from the turn nearest the view's own, or the camera whirls
  const fa = FOL.az + 360 * Math.round((v[0] - FOL.az) / 360);
  const w = smooth((v[2] - 0.6) / 2.4);   // 0 close up (turn to the flock), 1 from afar (aim at it)
  let va = fa + (v[0] - fa) * w;
  const ve = FOL.el + (v[1] - FOL.el) * w;
  if (keep || FOL.vz === null) { FOL.vz = va; FOL.ve = ve; }
  else {
    va += 360 * Math.round((FOL.vz - va) / 360);
    FOL.vz += clamp(va - FOL.vz, -60 * dt, 60 * dt); FOL.ve += clamp(ve - FOL.ve, -40 * dt, 40 * dt);
  }
  return [FOL.vz, FOL.ve, v[2], v[3] + (FOL.tx - v[3]) * w, v[4] + (FOL.ty - v[4]) * w, v[5] + (FOL.tz - v[5]) * w];
}
// the flock steers clear of you: your head and hands, in the flock's own frame. On a screen you stand at the
// middle of the field (not where the camera is: from afar the flock would follow the camera away)
const _sv = new THREE.Vector3(), _sm = new THREE.Matrix4();
function tellFlock(xr) {
  const s = GL.sets.flock;
  GL.world.updateMatrixWorld(true);
  _sm.copy(s.group.matrixWorld).invert();
  const head = xr ? _sv.copy(XR.head).applyMatrix4(_sm).toArray() : [0, 1.6, 0];
  const hands = xr ? XR.ctrls.filter(c => c.src && c.g.visible).map(c => _sv.copy(c.o).applyMatrix4(_sm).toArray()) : [];
  s.see(head, hands);
}

// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Edit here if you record a narration.
const NARRATION_SYNC = [
  [0, 0], [72, 72],
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
  { key: 'title', name: 'Intro', a: 0, b: 18 },
  { key: 'seven', name: 'Seven', a: 18, b: 40 },
  { key: 'wave', name: 'Wave', a: 40, b: 62 },
  { key: 'around', name: 'Around you', a: 62, b: 72 },
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

const ST = { labels: [], items: [] };
// a set's camera view by name (falls back to its default view)
const view = (k, name) => { const c = GL.sets[k].cam; return (c[name] || c.default).slice(); };
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

function buildStory() {
  const F = GL.sets.flock;
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--cyan)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--cyan)"/><circle cx="352" cy="36" r="4.5" fill="var(--cyan)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">A flock</h1>
      <p class="lede" data-at="2.4">of starlings at dusk</p>
      <p data-at="4">Before they settle for the night, starlings gather in flocks of hundreds or thousands and sweep across the sky together. These ${fmt(F.birds())} fly all around you.</p>
      <p class="note" data-at="10">In a headset, look around: they never leave. On a screen the view follows them.</p>`,
    seven: `<h2 data-at="0.6">Seven neighbours</h2>
      <p data-at="1.2">No bird leads. Each one keeps track of about seven of its nearest neighbours, however near or far they are, and matches their heading and speed.</p>
      <p data-at="7" class="amber">Draw each bird's link to the seven it follows, and the flock is a network: every bird a node, every link one bird watching another.</p>
      <p data-at="14">The links change from moment to moment, as birds change places.</p>
      <p class="credits" data-at="16">Ballerini et al., PNAS 2008: starlings follow a set number of neighbours, not all birds within a set distance.</p>`,
    wave: `<h2 data-at="0.6">A wave</h2>
      <p data-at="1.2">A falcon dives in. The birds nearest it turn away, their neighbours follow them, and theirs: a wave of turning runs through the whole flock.</p>
      <p data-at="9">The dark bands you see are birds banking together, their wings edge on or full on to you.</p>
      <p data-at="14">Because every bird is linked to its neighbours, a turn can spread across the whole flock, however big it is.</p>
      <p class="credits" data-at="16">Cavagna et al., PNAS 2010; Procaccini et al., Animal Behaviour 2011. The flock here is a simulation.</p>`,
    around: `<h2 data-at="0.6">All around you</h2>
      <p data-at="1.2">The flock flies on for as long as you stay.</p>
      <p data-at="3">Change the number of birds, show who follows whom, or send a falcon: click the sky, or point and pull the trigger in a headset.</p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });
  // ------------------------------------------------------------ keyframes and camera
  const wp = [];
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease, k]);
  };
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  show('flock', 0, 1.5);
  key('flock_falcon', 0, 0);                        // in the story the falcon comes when the story says
  ramp('flock_links', C.seven.a + 7, C.seven.a + 9, 0, 1);
  ramp('flock_links', C.wave.a - 2, C.wave.a, 1, 0);
  jump('flock_hunt', C.wave.a + 1, 0, 1);
  // standing among them (the camera turns to the flock); from afar while the wave runs; back among them
  cam(0, 'flock', 'default');
  cam(C.wave.a + 3, 'flock', 'default');
  cam(C.wave.a + 7, 'flock', 'afar');
  cam(C.wave.b - 4, 'flock', 'afar', 20, 'spin');
  cam(C.around.a + 2, 'flock', 'default');
  cam(C.around.b, 'flock', 'default');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease, set]; 'spin' segments turn at a steady pace.
// When the story hands over from one set to another, the new set is turned about its
// vertical axis so that its first view starts where the camera already is: a crossfade
// never swings the camera round. The set keeps that turn while it is on show (setYaw).
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  const turn = (w, deg) => {
    const r = deg * D2R, x = w[4], z = w[6];
    w[1] += deg; w[4] = x * Math.cos(r) + z * Math.sin(r); w[6] = -x * Math.sin(r) + z * Math.cos(r);
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7]];
  });
}
// the turn a set has at story time t: that of its latest stay on show (it starts fading in a little before its first view)
function setYaw(k, t) {
  let c = 0;
  for (const y of ST.yaw) if (y.k === k && y.t0 - 6 <= t) c = y.c;
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
function storyCam(t) {
  const wp = ST.wp;
  if (t <= wp[0][0]) return wp[0].slice(1, 7);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1;
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x];
    }
  }
  return wp[wp.length - 1].slice(1, 7);
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
function buildSetLabels() {
  for (const k of SET_ORDER) for (const L of GL.sets[k].labels || []) {
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${esc(r || '')}`, L.cls), set: k, at: L.at, alpha: L.alpha, minor: !!L.minor, o: -1 });
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
      if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
      const sx = (_v.x * 0.5 + 0.5) * W;
      x = sx + 9; y = (-_v.y * 0.5 + 0.5) * H - 11;
      if (pr.width && y + L.h > pr.top && y < pr.bottom && x < pr.right + 6) {
        // a point just beside the panel keeps its label next to the panel; one behind it shows none
        if (GL.wide && sx > pr.right - 40) x = pr.right + 6; else o = 0;
      }
      if (y + L.h > barTop - 4 || y < 50) o = 0;
      x = Math.min(x, W - L.w - 6);
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
    const p = $('#panel'), over = fresh.getBoundingClientRect().bottom - (p.getBoundingClientRect().bottom - parseFloat(getComputedStyle(p).paddingBottom));
    if (over > 0) p.scrollTo({ top: p.scrollTop + over, behavior: 'smooth' });
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
}

// ================================================================ EXPLORE ==
// Explore mode: the flock flies on for as long as you stay. Its controls choose the view, how many birds, the
// network of who follows whom, and whether a falcon comes now and then; a click on the sky (or the trigger in a
// headset) sends one where you point.
const SCENES = [
  ['flock', 'Flock', 'Starlings at dusk, all around you. Each bird follows the seven nearest to it. Click the sky to send a falcon; drag to look around.'],
];
const TABS = [['scenes', 'Flock']];
const X = { tab: 'scenes', scene: 'flock', ctl: {}, t0: 0, turn: 'on' };
const XS = {};
const orbit = { cur: [0, -26, 0.25, 0, 1.6, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
// the camera follows the flock unless you look around yourself
const following = () => APP.mode === 'story' || ctlValue('flock', GL.sets.flock.controls[0]) !== 'free';

// what the controls ask for
function exploreTargets(now = performance.now()) {
  const s = GL.sets[X.scene], tg = Object.assign({}, s.params);
  tg[X.scene + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(X.scene, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
const STEP = new Set(['flock_birds', 'flock_hunt']);   // counts jump, they do not ease
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  const fo = GL.sets.flock.falconOn();
  if (fo !== X.fo) { X.fo = fo; renderScenes(); }   // the falcon button follows the falcon
  // looking around by yourself, the view drifts slowly round unless you are steering it
  if (X.turn === 'on' && !following() && !orbit.to && !orbit.held) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 4 * Math.cos(X.sway * 0.2); }
  return XS;
}
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  X.scene = k; X.t0 = performance.now();
  if (fly) flyTo(view(k, 'default'));
  renderScenes();
}
function setCtl(k, key, v) {
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key);
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  if (key === 'view' && s.cam && s.cam[v]) flyTo(view(k, v));
  if (c) renderScenes();
}
// send a falcon (dir: where you point, in the flock's frame; none: from anywhere); in a shared room the others
// at this station see it too (an effect); true if one went
function sendFalcon(dir) {
  if (!GL.sets.flock.scatter(dir || null)) return false;
  renderScenes();
  HOST.collab.effect('falcon', { dir: dir || null });
  return true;
}
// shared rooms: the controls everyone at the station sees alike (the view is each person's own camera)
const SHARED_CTL = ['birds', 'links', 'falcon'];
function collabState() {
  return Object.fromEntries(GL.sets.flock.controls.filter(c => SHARED_CTL.includes(c.key)).map(c => [c.key, ctlValue('flock', c)]));
}
function collabApply(v) {
  for (const c of GL.sets.flock.controls) {
    const x = v && v[c.key];
    if (SHARED_CTL.includes(c.key) && c.options.some(o => o[0] === x) && ctlValue('flock', c) !== x) setCtl('flock', c.key, x);
  }
}
function flyTo(v) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = v.slice();
  orbit.to[0] = v[0] + 360 * Math.round((c[0] - v[0]) / 360);
  orbit.t0 = performance.now();
}
function orbitStep(now) {
  if (!orbit.to) return;
  const x = smooth((now - orbit.t0) / (orbit.dur * 1000)), f = orbit.from, t = orbit.to;
  orbit.cur = f.map((v, k) => (k === 2 ? Math.exp(Math.log(v) + (Math.log(t[k]) - Math.log(v)) * x) : v + (t[k] - v) * x));
  if (x >= 1) orbit.to = null;
}

function buildExplore() {
  $('#explore').innerHTML = `<div class="pane on" id="pane-scenes" role="region" aria-label="The flock"></div>`;
  $('#pane-scenes').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.ctl) setCtl(X.scene, b.dataset.ctl, b.dataset.v);
    else if (b.dataset.falcon !== undefined) sendFalcon(null);
  });
  renderScenes();
  $('#viewctl').innerHTML = `<div class="grp"><span>Drift</span><div class="seg" data-ctl="turn" role="group" aria-label="Drift">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) setTurn(b.dataset.v); });
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) { X.tab = k; }
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene], busy = s.falconOn && s.falconOn();
  pane.innerHTML = `<h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => `<button type="button" data-ctl="${c.key}" data-v="${v}" aria-pressed="${ctlValue(X.scene, c) === v}"${ctlValue(X.scene, c) === v ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(n)}</button>`).join('')}</div>`).join('')}
    <div class="actions"><button class="btn primary" type="button" data-falcon${busy ? ' disabled' : ''}>${busy ? 'A falcon is hunting' : 'Send a falcon'}</button></div>`;
}
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _inv = new THREE.Matrix4(), _rd = new THREE.Vector3();
// the direction a click points, in the flock's frame
function rayDir(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(GL.sets.flock.group.matrixWorld).invert();
  return _rd.copy(_rc.ray.direction).transformDirection(_inv).toArray();
}
function bindCanvas() {
  const cv = GL.canvas, pts = new Map();
  let down = null, pinch = 0;
  cv.style.cursor = 'grab';
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId) || APP.mode !== 'explore') return;
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.2, 60);
      pinch = d; down.moved = true; return;
    }
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (down && down.moved) {
      // dragging takes the camera from the flock: from then on you look around yourself
      if (following()) { orbit.cur = followView(orbit.cur, 0, true); setCtl('flock', 'view', 'free'); }
      orbit.to = null;
      // close up you stand still and turn your head (drag the sky along); from afar you circle the flock
      const near = orbit.cur[2] < 1, s = near ? -0.18 : 0.25;
      orbit.cur[0] += dx * (near ? 0.18 : -0.25); orbit.cur[1] = clamp(orbit.cur[1] + dy * s, -80, 80);
    }
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') sendFalcon(rayDir(ev.clientX, ev.clientY));
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.2, 60);
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
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from',
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------ scene pose --
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
// The flock is life size round you: the land under your feet (the frame hangs at your head, so the land is a
// standing eye height below it: the reference space is 'local', so the floor is not known), the sunset ahead of
// where you faced when the place was set; views do not move it.
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  const eye = 1.6;
  GL.world.quaternion.identity();
  GL.world.scale.setScalar(1);
  GL.world.position.set(0, -eye, 0);
  XR.globeBase.set(0, -eye, 0);
}
function xrRecenter() {
  XR.globeOff.set(0, 0, 0);
  if (XR.panelGroup) { XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.set(0, XR.panelHome.yaw, 0); }
  // anchored: the scene and the panel go back where they were saved with the place
  const s = HOST.anchor.saved();
  if (s) { XR.globeOff.fromArray(s.off); if (XR.panelGroup) { XR.panelGroup.position.fromArray(s.pp); XR.panelGroup.rotation.set(0, s.pr, 0); } }
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
  const hm = 0.021 * Math.max(1, sp.position.distanceTo(XR.camLocal));   // the same size to the eye, near or far
  sp.scale.set(hm * sp.userData.aspect, hm, 1);
}
function xrTip() {}

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
  } else if (h.kind === 'sky' && !XR.stories) {   // the trigger on the sky sends a falcon where you point
    c.press = { kind: 'sky' };
    _sm.copy(GL.sets.flock.group.matrixWorld).invert();
    if (sendFalcon(_xb.copy(c.d).transformDirection(_sm).toArray())) buzz(c, 0.5, 40);
  }
}
function xrRelease(c) {
  const p = c.press;
  c.press = null;
  if (!p) return;
  if (p.kind === 'panel') {
    if (p.r.drag) return;
    const h = c.hover;
    if (h && h.kind === 'panel' && h.P === p.P) {
      const r = h.P.at(h.x, h.y);
      if (r && r.id === p.id && r.fn) { buzz(c); r.fn(); }
    }
  }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (a station: only its panel moves)
  if (h.kind !== 'panel') return;   // the field and the sky stay where they are: only the panel moves
  const p0 = XR.panelGroup.getWorldPosition(new THREE.Vector3());
  c.grab = { target: 'panel', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0, reach: 1 };
  buzz(c, 0.4, 25);
}
const _gq = new THREE.Quaternion(), _gv = new THREE.Vector3(), _gh = new THREE.Vector3();
// the grabbed object keeps its offset from the controller, so moving or turning your hand carries it
function carry(c, dt) {
  const G = c.grab, gp = c.src.gamepad;
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
function xrPoint(c, dt) {
  const g = c.g;
  if (!c.src || !g.visible) { c.hover = null; c.dot.visible = false; return; }
  c.o.setFromMatrixPosition(g.matrix);
  c.d.set(0, 0, -1).transformDirection(g.matrix);
  let hit = null, dist = 2.5;
  // the shared room's own things (its panel, the other stations, a calibration) come first
  const sh = HOST.collab.ray(c.i, c.o, c.d);
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = sh ? [] : XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  if (sh) { hit = sh; dist = sh.dist; }
  else if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories) {
    // anywhere else is the sky (the dot sits far out along the ray)
    hit = { kind: 'sky', point: _xp.copy(c.d).multiplyScalar(6).add(c.o).clone() };
    dist = 6;
  }
  c.hover = hit;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
  // A/X: play or pause the story
  const gp = c.src.gamepad;
  if (gp) {
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
  // keep the cell and the panel where they were in the story before
  const p = HOST.xrPose;
  if (p) {
    XR.needRecenter = false;
    GL.rig.position.copy(p.rp); GL.rig.quaternion.copy(p.rq);
    XR.globeOff.copy(p.off);
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
  GL.stars.visible = false;   // the sky has no stars yet
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
    let s = 's' + audioLabel() + (curCh ? curCh.key : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
  return ['x', audioLabel(), X.scene, JSON.stringify(X.ctl[X.scene] || {}), GL.sets.flock.falconOn()].join('|');
}
const XR_HERE = 'flock';
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
    // seven cards 0.36 m wide on an arc: neighbours 2 d sin(0.155) = 0.386 m apart, the outer ones 53° to the side
    const a = (k - (HOST.list.length - 1) / 2) * 0.31, d = 1.25;
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
  if (!XR.inStory) APP.enterStory(0);
  XR.inStory = true;
  if (APP.mode === 'story') APP.playing = true;
}
function drawLandHead(ctx, P) {
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
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
  hb('exit', 'Exit', () => { if (XR.session) XR.session.end(); }, 96);
  if (AUD && AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.on(), px: 23 });
  if (!HOST.anchor.on) hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 140); // anchored: nothing moves
  hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink;
  ctx.fillText(fitText(ctx, 'Flock', x - 40), 40, 36);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.anchor.on ? 'Trigger (or pinch): use buttons. A or X: play and pause. Anchored: to move things, use Place again on the Stories screen.' : 'Trigger (or pinch): use buttons, or point at the sky to send a falcon. Grip: move this panel. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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
      ctx.font = vfont(50, 700); ctx.fillStyle = VC.amber; ctx.fillText(fitText(ctx, b ? b.textContent : '', cw - 16), x + k * cw, y);
      if (sm) textBlock(ctx, sm.textContent, x + k * cw, y + 68, cw - 16, 25, 32, VC.muted, 400, 2);
    });
    h = 68 + 64 + 18;
  } else if (tag === 'UL' && cl.contains('steps')) {
    // points with a bold name over a line of text, each fading in on its own
    let yy = y;
    for (const li of el.children) {
      ctx.globalAlpha = a * storyOpacity(li);
      const b = li.querySelector('b'), bold = b ? b.textContent : '', rest = li.textContent.slice(bold.length).trim();
      const hh = 36 + textBlock(ctx, rest, x + 22, yy + 40, W - 22, 28, 38, VC.ink, 400, 3);
      ctx.fillStyle = VC.amber; ctx.fillRect(x, yy + 4, 5, hh);
      ctx.font = vfont(30, 700); ctx.fillStyle = VC.amber; ctx.fillText(bold, x + 22, yy);
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
  } else if (tag === 'DIV') {
    // a grid of overlapping paragraphs (one fades out as the next fades in)
    let mh = 0;
    for (const c of el.children) mh = Math.max(mh, drawStoryEl(ctx, P, c, x, y, W, a) - y);
    h = mh;
  } else if (el.textContent.trim()) {
    h = textBlock(ctx, el.textContent, x, y, W, 26, 38, VC.ink) + 14;
  }
  ctx.globalAlpha = 1;
  return y + h;
}


// explore: the flock's pane, mirroring the HTML one
function drawExplorePane(ctx, P, x, y, W) {
  const sc = SCENES[0], s = GL.sets.flock, busy = s.falconOn();
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink; ctx.fillText(sc[1], x, y);
  y += 50;
  y += textBlock(ctx, 'Starlings at dusk, all around you. Each bird follows the seven nearest to it. Point at the sky and pull the trigger to send a falcon.', x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  const bottom = P.h - 34;
  for (const c of s.controls || []) {
    if (c.key === 'view') continue;   // in a headset you look around yourself
    if (y + 110 > bottom) break;
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y);
    y += 36;
    let bx = x, by = y;
    ctx.font = vfont(24);
    for (const [v, n] of c.options) {
      const w = Math.max(110, ctx.measureText(n).width + 40);
      if (bx + w > x + W) { bx = x; by += 66; }
      vButton(ctx, P, 'ctl:' + c.key + ':' + v, bx, by, w, 56, n, () => setCtl(X.scene, c.key, v), { on: ctlValue(X.scene, c) === v, px: 24 });
      bx += w + 10;
    }
    y = by + 80;
  }
  if (y + 60 < bottom) vButton(ctx, P, 'falcon', x, y, 300, 60, busy ? 'A falcon is hunting' : 'Send a falcon', () => sendFalcon(null), { px: 24, on: busy });
}
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') : 'x';
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
    ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(CH[ci].name, x0, 40);
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.textAlign = 'right'; ctx.fillText(m(t) + ' / ' + m(T_END), x1, 44); ctx.textAlign = 'left';
    rr(ctx, x0, ty, x1 - x0, 6, 3); ctx.fillStyle = 'rgba(160,178,202,0.28)'; ctx.fill();
    rr(ctx, x0, ty, (x1 - x0) * t / T_END, 6, 3); ctx.fillStyle = VC.cyan; ctx.fill();
    ctx.fillStyle = 'rgba(160,178,202,0.6)';
    for (const c of CH.slice(1)) ctx.fillRect(x0 + (x1 - x0) * c.na / T_END - 1, ty - 8, 2, 22);
    ctx.beginPath(); ctx.arc(x0 + (x1 - x0) * t / T_END, ty + 3, P.hover === 'track' ? 16 : 13, 0, 7); ctx.fillStyle = VC.cyan; ctx.fill();
    P.regions.push({ id: 'track', x: x0 - 10, y: 66, w: x1 - x0 + 20, h: 80, drag: px => APP.seek(clamp((px - x0) / (x1 - x0), 0, 1) * T_END) });
    return;
  }
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('The flock flies on for as long as you stay.', 28, 58);
}


// ------------------------------------------------------------- narration --
// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 at audio/narration-flock.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-flock.mp3', {
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
// the narration plays while the story plays
function audioSync() { if (AUD) AUD.sync(APP.mode === 'story' && APP.playing, APP.t); }
// while it plays, the narration is the clock: the story follows it
function audioFollow() { if (AUD) APP.t = AUD.follow(APP.t); }
function audioLabel() { return AUD ? AUD.label() : ''; }
function audioToggle() { HOST.audio.toggle(); }

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
    let best = 'flock', ba = 0;
    for (const k of SET_ORDER) if (S[k + '_a'] > ba + 0.01) { ba = S[k + '_a']; best = k; }
    // the story's view, taken back into the set's own frame (explore shows sets unturned)
    const v = storyCam(ts).slice(), r = -setYaw(best, ts) * D2R, x = v[3], z = v[5];
    v[0] += r / D2R; v[3] = x * Math.cos(r) + z * Math.sin(r); v[5] = -x * Math.sin(r) + z * Math.cos(r);
    orbit.cur = followView(v, 0, true); orbit.to = null;   // as the camera was, following the flock
    X.scene = best; X.t0 = performance.now();
    // and pick the scene's controls that come closest to what the story was showing
    const s = GL.sets[best];
    X.ctl[best] = {};
    for (const ct of s.controls || []) {
      let bo = ct.options[0][0], bd = Infinity;
      for (const [v] of ct.options) {
        const c = { t: 1e3 };
        for (const c2 of s.controls) c[c2.key] = c2 === ct ? v : ctlValue(best, c2);
        const tg = s.explore ? s.explore(c) : {};
        let d = 0;
        for (const n in tg) if (n in S && !n.endsWith('_a')) d += (tg[n] - S[n]) ** 2;
        if (d < bd) { bd = d; bo = v; }
      }
      X.ctl[best][ct.key] = bo;
    }
    X.ctl.flock.falcon = 'some'; X.ctl.flock.view = 'default';   // the story keeps its falcon to itself; explore lets them come
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    renderScenes();
    updateExtraLabels();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    this.t = t || 0; this.playing = true; curCh = null;
  },
};

let lastNow = 0;
function frame(now, xrFrame) {
  const dt = lastNow ? Math.min(0.1, Math.max(0, (now - lastNow) / 1000)) : 0;
  lastNow = now;
  const xr = XR.on && GL.renderer.xr.isPresenting;
  if (xr) xrBegin(xrFrame, dt);
  let S, tSet;
  if (APP.mode === 'story' && APP.playing) {
    APP.t += dt;
    audioFollow();
    // the end: Repeat (shell) starts this story or the next one again, else explore mode opens
    if (APP.t >= T_END) { APP.t = T_END; if (HOST.ended()) APP.playing = false; else APP.enterExplore(); }
  }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    if (xr) xrPlace(storyCam(ts)); else applyCamera(followView(storyCam(ts), dt));
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (xr) xrPlace(orbit.cur); else applyCamera(following() ? followView(orbit.cur, dt) : orbit.cur);
  }
  K.U.uTime.value = (performance.now() / 1000) % 3600;   // wings and reeds move on while the story is paused
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (XR.on && !XR.clear) S = Object.assign({}, S, { flock_sky: 0 });   // passthrough: the birds fly in your room
  tellFlock(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
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
    // #flock&explore&view=afar&birds=400&links=on&falcon=off (any control by its key); &hunt sends a falcon
    if (hp.get('scene')) openScene(hp.get('scene'), false);
    orbit.cur = view(X.scene, 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    const s = GL.sets[X.scene];
    for (const c of s.controls || []) if (hp.get(c.key)) setCtl(X.scene, c.key, hp.get(c.key));
    if (hp.has('hunt')) sendFalcon(null);
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; }
  }
  GL.renderer.setAnimationLoop(frame); // also drives the headset's frame loop
  if (HOST.session && GL.renderer.xr.isPresenting) xrAdopt();
  setTimeout(() => $('#loading').classList.add('gone'), 120);
}
setTimeout(init, 40);

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(),
    pp: XR.panelGroup.position.clone(), pr: XR.panelGroup.rotation.y } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state the explore controls, the falcon an effect
  collab: {
    APP, scene: () => GL.scene, state: collabState, apply: collabApply,
    effect(type, d) { if (type === 'falcon' && GL.sets.flock.scatter((d && d.dir) || null)) renderScenes(); },
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw) { XR.panelGroup.position.fromArray(p); XR.panelGroup.rotation.set(0, yaw, 0); },
  },
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
