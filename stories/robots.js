// The robot gang: robot vacuums that share a room with you. They follow one rule at a time - bump and turn, follow
// you, follow the one ahead - and who follows whom is a network: a star, or a chain. In a headset the room is your
// own, read from the headset's room setup. A short story, then the gang stays for as long as you do.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by tools/robots/build.mjs from the tour's kit and engine (adapted) and the set in tools/robots: edit those, not this file.
HOST.register('robots', function (HOST) {
'use strict';
const D2R = Math.PI / 180;
const $ = s => document.querySelector(s);
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
// The one set: the gang, its room and you, life size (1 unit is 1 m, the floor
// at y = 0). The story drives it through its params.
const SETS = {};
// The robot gang: robot vacuums that share a room with you. A live simulation: each robot is a disc on two wheels
// (differential drive: a speed and a turn rate, both eased) that follows one rule - go to the dock, bump and turn,
// follow you, follow the one ahead, keep away - and bumps off walls, furniture, the others and your feet.
// The room is a description (floor outline, walls, furniture footprints): the built-in living room on screens, or
// the headset's own room from its room setup, or a bare box round you. 1 unit is 1 m, the floor is y = 0.
// Like the flock, the simulation runs on: update depends on what came before, not only on the params and the time.
SETS.robots = function (K) {
  const { THREE, clamp, lerp, smooth, rng } = K;
  const set = K.newSet('robots');
  const TAU = Math.PI * 2, HALF = Math.PI / 2;
  const RR = 0.17, RA = 0.25, MAXN = 24, MAXW = 24, NPILE = 8, NBIT = 40, TL = 48;   // robot and player radius; most robots, walls with a cutaway, piles, bits a pile, trail points
  const R = rng(4711);
  const wrap = a => a - TAU * Math.floor((a + Math.PI) / TAU);
  const mat = o => { const m = new THREE.ShaderMaterial(Object.assign({ transparent: true, extensions: { derivatives: true } }, o)); set.mats.push(m); return m; };
  const GANG = ['#46d9ff', '#ff5ad9', '#ffb43b', '#3ee08f', '#ff5a4b', '#9d7bff'].map(K.rgb);

  // ---------------------------------------------------------------- polygons ([[x, z], ...])
  function inPoly(P, x, z) {
    let c = false;
    for (let i = 0, j = P.length - 1; i < P.length; j = i++) {
      const xi = P[i][0], zi = P[i][1], xj = P[j][0], zj = P[j][1];
      if ((zi > z) !== (zj > z) && x < (xj - xi) * (z - zi) / (zj - zi) + xi) c = !c;
    }
    return c;
  }
  function segDist(x, z, ax, az, bx, bz) {
    const ex = bx - ax, ez = bz - az, l = ex * ex + ez * ez;
    let u = l > 0 ? ((x - ax) * ex + (z - az) * ez) / l : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    return Math.hypot(x - ax - ex * u, z - az - ez * u);
  }
  // a rectangle w x d turned by ry about its middle (x, z) (three.js turn: local +z goes to (sin ry, cos ry))
  const rect = (x, z, w, d, ry) => [[-w / 2, -d / 2], [w / 2, -d / 2], [w / 2, d / 2], [-w / 2, d / 2]].map(([a, b]) => [x + a * Math.cos(ry) + b * Math.sin(ry), z - a * Math.sin(ry) + b * Math.cos(ry)]);
  const disc = (x, z, r, n) => { const o = []; for (let i = 0; i < n; i++) o.push([x + Math.cos(i / n * TAU) * r, z + Math.sin(i / n * TAU) * r]); return o; };

  // ---------------------------------------------------------------- shading, shared by everything solid
  // Lights live in the set's frame (so they turn with the room): a warm room light, the window's daylight, a warm
  // lamp, a sky and a ground. Real and box rooms get a plain neutral light instead.
  const LIT = {
    uKey: { value: new THREE.Vector3(0.42, 0.85, 0.32).normalize() }, uKeyC: { value: new THREE.Color() },
    uWin: { value: new THREE.Vector3(0.12, 0.45, -0.88).normalize() }, uWinC: { value: new THREE.Color() },
    uSkyC: { value: new THREE.Color() }, uGndC: { value: new THREE.Color() },
    uLampP: { value: new THREE.Vector3(-2.36, 1.48, -1.84) }, uLampC: { value: new THREE.Color() },
    uScan: { value: new THREE.Vector4(1, 6, 0, 0) }, uTime: K.U.uTime,
  };
  function lighting(kind) {
    const m = kind === 'model';
    LIT.uKeyC.value.setRGB(...(m ? [0.6, 0.56, 0.5] : [0.55, 0.55, 0.56]));
    LIT.uWinC.value.setRGB(...(m ? [0.1, 0.12, 0.15] : [0.05, 0.05, 0.05]));
    LIT.uSkyC.value.setRGB(...(m ? [0.54, 0.52, 0.5] : [0.55, 0.57, 0.6]));
    LIT.uGndC.value.setRGB(...(m ? [0.3, 0.23, 0.18] : [0.26, 0.26, 0.28]));
    LIT.uLampC.value.setRGB(...(m ? [0.6, 0.38, 0.18] : [0, 0, 0]));
  }
  const LV = `
uniform vec3 uKey, uWin, uLampP;
varying vec3 vPW, vPL, vNW, vNL, vKW, vWW, vUW, vLW;
void setLight(vec3 pL, vec3 nL) {
  vec4 w = modelMatrix * vec4(pL, 1.0); mat3 m = mat3(modelMatrix);
  vPW = w.xyz; vPL = pL; vNL = nL; vNW = normalize(m * nL);
  vKW = normalize(m * uKey); vWW = normalize(m * uWin); vUW = normalize(m * vec3(0.0, 1.0, 0.0));
  vLW = (modelMatrix * vec4(uLampP, 1.0)).xyz;
  gl_Position = projectionMatrix * viewMatrix * w;
}`;
  const LF = `
uniform vec3 uKeyC, uWinC, uSkyC, uGndC, uLampC; uniform float uA, uTime; uniform vec4 uScan;
varying vec3 vPW, vPL, vNW, vNL, vKW, vWW, vUW, vLW;
float hsh(vec2 p) { vec3 q = fract(vec3(p.xyx) * 0.1031); q += dot(q, q.yzx + 33.33); return fract((q.x + q.y) * q.z); }
float vno(vec2 p) { vec2 i = floor(p), f = fract(p); f = f * f * (3.0 - 2.0 * f);
  return mix(mix(hsh(i), hsh(i + vec2(1.0, 0.0)), f.x), mix(hsh(i + vec2(0.0, 1.0)), hsh(i + vec2(1.0, 1.0)), f.x), f.y); }
vec3 shade(vec3 base, vec3 N, float gloss, float ao) {
  vec3 V = normalize(cameraPosition - vPW);
  float up = dot(N, vUW), nv = max(dot(N, V), 0.0);
  vec3 amb = mix(uGndC, uSkyC, up * 0.5 + 0.5) * ao;
  float k = max(dot(N, vKW), 0.0), w = max(dot(N, vWW) * 0.6 + 0.4, 0.0);
  vec3 Lp = vLW - vPW; float ld = length(Lp) + 1e-3;
  float lamp = max(dot(N, Lp / ld) * 0.7 + 0.3, 0.0) / (1.0 + ld * ld * 1.6);
  vec3 c = base * (amb + uKeyC * k * mix(0.55, 1.0, ao) + uWinC * w * ao + uLampC * lamp + 0.1 * nv);
  vec3 H = normalize(vKW + V);
  float sp = pow(max(dot(N, H), 0.0), mix(12.0, 90.0, gloss)) * gloss;
  float fr = pow(1.0 - nv, 4.0);
  vec3 Rf = reflect(-V, N); float env = smoothstep(-0.3, 0.9, dot(Rf, vUW));
  c += uKeyC * sp * 0.55 + mix(uGndC * 0.5, uSkyC * 1.25, env) * (0.06 + fr * 0.55) * gloss * ao;
  return c;
}
// the room being found: a band of grid lines that sweeps out from where you stood, across the floor and up the walls
float scanGrid(vec3 p, vec3 n) {
  float s = uScan.x;
  if (s <= 0.001 || s >= 0.999) return 0.0;
  float d = length(p.xz - uScan.zw) + max(p.y, 0.0);
  float behind = s / 0.85 * uScan.y - d;
  if (behind < -0.15) return 0.0;
  vec3 q = p * 4.0, wd = fwidth(q) + 1e-4, g = abs(fract(q + 0.5) - 0.5) / wd, an = abs(n);
  float line = max(max((1.0 - an.x) * (1.0 - min(g.x, 1.0)), (1.0 - an.y) * (1.0 - min(g.y, 1.0))), (1.0 - an.z) * (1.0 - min(g.z, 1.0)));
  float front = exp(-behind * behind * 40.0), trail = step(0.0, behind) * exp(-behind * 0.7);
  return clamp(line * (0.18 + 0.82 * max(trail, front)) + front * 0.3, 0.0, 1.0) * (1.0 - smoothstep(0.85, 1.0, s));
}
const vec3 CYAN = vec3(0.27, 0.85, 1.0);
// a one-step dither, so smooth light (the lamp on the walls) does not band in 8-bit colour
vec3 dith(vec3 c) { return c + (hsh(gl_FragCoord.xy) - 0.5) / 255.0; }
vec4 over(vec4 b, vec3 c, float a) { float A = 1.0 - (1.0 - b.a) * (1.0 - a); return vec4(A > 0.0 ? (b.rgb * b.a * (1.0 - a) + c * a) / A : c, A); }`;

  // ---------------------------------------------------------------- geometry helpers
  // a box with rounded edges (radius r, m segments to each rounded edge), centred on the origin
  function rbox(w, h, d, r, m) {
    m = m || 2; r = Math.min(r, w / 2 - 1e-4, h / 2 - 1e-4, d / 2 - 1e-4);
    const hs = [w / 2, h / 2, d / 2], inn = hs.map(v => v - r);
    const ax = k => { const o = []; for (let j = 0; j <= m; j++) o.push(-hs[k] + r - r * Math.cos(j / m * HALF)); for (let j = m; j >= 0; j--) o.push(hs[k] - r + r * Math.cos(j / m * HALF)); return o; };
    const L = [ax(0), ax(1), ax(2)], pos = [], nor = [], idx = [];
    for (let a = 0; a < 3; a++) for (const s of [-1, 1]) {
      const b = (a + 1) % 3, c = (a + 2) % 3, LB = L[b], LC = L[c], base = pos.length / 3, nc = LC.length;
      for (let i = 0; i < LB.length; i++) for (let j = 0; j < nc; j++) {
        const p = [0, 0, 0]; p[a] = s * hs[a]; p[b] = LB[i]; p[c] = LC[j];
        const q = p.map((v, k) => clamp(v, -inn[k], inn[k])), n = [p[0] - q[0], p[1] - q[1], p[2] - q[2]], l = Math.hypot(n[0], n[1], n[2]) || 1;
        pos.push(q[0] + n[0] / l * r, q[1] + n[1] / l * r, q[2] + n[2] / l * r); nor.push(n[0] / l, n[1] / l, n[2] / l);
      }
      for (let i = 0; i < LB.length - 1; i++) for (let j = 0; j < nc - 1; j++) {
        const v0 = base + i * nc + j, v1 = v0 + nc, v2 = v1 + 1, v3 = v0 + 1;
        if (s > 0) idx.push(v0, v1, v2, v0, v2, v3); else idx.push(v0, v2, v1, v0, v3, v2);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(nor, 3)); g.setIndex(idx);
    return g;
  }
  // merge indexed geometries with the same attributes
  function merge(list) {
    let nv = 0, ni = 0;
    for (const g of list) { nv += g.attributes.position.count; ni += g.index.count; }
    const out = new THREE.BufferGeometry(), names = Object.keys(list[0].attributes), idx = new (nv > 65535 ? Uint32Array : Uint16Array)(ni), arr = {};
    for (const k of names) arr[k] = new Float32Array(nv * list[0].attributes[k].itemSize);
    let ov = 0, oi = 0;
    for (const g of list) {
      for (const k of names) arr[k].set(g.attributes[k].array, ov * g.attributes[k].itemSize);
      for (let i = 0; i < g.index.count; i++) idx[oi++] = g.index.array[i] + ov;
      ov += g.attributes.position.count;
    }
    for (const k of names) out.setAttribute(k, new THREE.BufferAttribute(arr[k], list[0].attributes[k].itemSize));
    out.setIndex(new THREE.BufferAttribute(idx, 1));
    return out;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _e = new THREE.Euler(), _p = new THREE.Vector3(), _s = new THREE.Vector3(1, 1, 1);
  function prep(g) {
    for (const k of Object.keys(g.attributes)) if (k !== 'position' && k !== 'normal') g.deleteAttribute(k);
    if (!g.index) { const a = []; for (let i = 0; i < g.attributes.position.count; i++) a.push(i); g.setIndex(a); }
    return g;
  }
  // a piece of the room moved into place (tilt rx, rz, then turn ry), with a colour and a kind for its shader
  function part(g, col, kind, x, y, z, ry, rx, rz, extra) {
    prep(g);
    _e.set(rx || 0, ry || 0, rz || 0, 'YXZ'); _q.setFromEuler(_e); _m.compose(_p.set(x || 0, y || 0, z || 0), _q, _s); g.applyMatrix4(_m);
    const n = g.attributes.position.count, c = K.rgb(col), ca = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) ca.set(c, i * 3);
    g.setAttribute('color', new THREE.BufferAttribute(ca, 3)); g.setAttribute('aK', new THREE.BufferAttribute(new Float32Array(n).fill(kind), 1));
    if (extra) for (const k in extra) g.setAttribute(k, new THREE.BufferAttribute(new Float32Array(n).fill(extra[k]), 1));
    return g;
  }
  function place(list, x, z, ry) { _e.set(0, ry || 0, 0); _q.setFromEuler(_e); _m.compose(_p.set(x, 0, z), _q, _s); for (const g of list) g.applyMatrix4(_m); return list; }
  // a two-sided copy (for leaves, the lamp shade): the back faces with the normals turned
  function twoSided(g) {
    const b = g.clone(), n = b.attributes.normal.array, ix = b.index.array;
    for (let i = 0; i < n.length; i++) n[i] = -n[i];
    for (let i = 0; i < ix.length; i += 3) { const t = ix[i + 1]; ix[i + 1] = ix[i + 2]; ix[i + 2] = t; }
    return [g, b];
  }

  // ---------------------------------------------------------------- the model living room
  const MW = 2.7, MD = 2.2, MH = 2.5, WI = 0.02, WT = 0.12;   // half width, half depth, height; the drawn walls stand 2 cm behind the robots' walls (the skirting); thickness
  const WIN = { x0: -0.5, x1: 1.1, y0: 0.85, y1: 2.15, z: -(MD + WI) };   // the window in the back wall
  const DOOR = { z0: 1.13, z1: 1.97, h: 2.03 };                            // the door in the left wall
  const FUR = {
    sofa: { x: -2.265, z: -0.12, ry: HALF, w: 2.0, d: 0.86 },
    chair: { x: 1.15, z: 0.85, ry: Math.atan2(-0.82 - 1.15, -0.12 - 0.85), w: 0.86, d: 0.84 },
    table: { x: -0.8, z: -0.12, ry: HALF, w: 1.1, d: 0.62 },
    shelf: { x: 2.525, z: -0.05, ry: -HALF, w: 1.2, d: 0.34, h: 0.95 },
    plant: { x: 2.3, z: -1.82, r: 0.19 },
    lamp: { x: -2.36, z: -1.84, r: 0.15 },
    rug: { x: -0.8, z: -0.12, w: 2.3, d: 1.6 },
  };
  function modelRoom() {
    const f = FUR, t = f.table, tc = rect(t.x, t.z, t.w, t.d, t.ry), legs = [];
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) {
      const lx = sx * (t.w / 2 - 0.05), lz = sz * (t.d / 2 - 0.05);
      legs.push({ poly: disc(t.x + lx * Math.cos(t.ry) + lz * Math.sin(t.ry), t.z - lx * Math.sin(t.ry) + lz * Math.cos(t.ry), 0.03, 6), h: 0.4, label: 'table leg' });
    }
    return {
      kind: 'model',
      floor: [[-MW, -MD], [MW, -MD], [MW, MD], [-MW, MD]],
      walls: [[-MW, -MD, MW, -MD, MH], [MW, -MD, MW, MD, MH], [MW, MD, -MW, MD, MH], [-MW, MD, -MW, -MD, MH]],
      blocks: [
        { poly: rect(f.sofa.x, f.sofa.z, f.sofa.w, f.sofa.d, f.sofa.ry), h: 0.82, label: 'couch' },
        { poly: rect(f.chair.x, f.chair.z, f.chair.w, f.chair.d, f.chair.ry), h: 0.85, label: 'couch' },
        { poly: rect(f.shelf.x, f.shelf.z, f.shelf.w, f.shelf.d, f.shelf.ry), h: f.shelf.h, label: 'storage' },
        { poly: disc(f.plant.x, f.plant.z, f.plant.r + 0.01, 10), h: 1.2, label: 'plant' },
        { poly: disc(f.lamp.x, f.lamp.z, f.lamp.r + 0.01, 10), h: 1.65, label: 'lamp' },
        { poly: tc, h: 0.42, under: 0.36, label: 'table' },   // robots pass under it (only its legs stop them); you do not
      ].concat(legs),
    };
  }
  // the avatar's stroll: a closed path through the open floor, round the table and the armchair
  const LOOP_MODEL = [[0.35, -1.2], [-0.8, -1.28], [-1.48, -0.78], [-1.5, 0.45], [-0.85, 1.22], [0.1, 1.6], [0.95, 1.9], [1.9, 1.72], [2.04, 0.95], [1.88, -0.78], [1.15, -1.22]];
  const LOOP_PAUSE = [3, 8];   // it stops for a moment at these points (by the sofa, by the bookcase)

  // furniture: each piece in its own frame (front towards +z, standing on y = 0), then placed
  function sofa() {
    const L = [], W = 2.0, D = 0.86, c = '#5d7d8a', c2 = '#68899a', leg = '#4a3424';
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(part(new THREE.CylinderGeometry(0.025, 0.02, 0.07, 8), leg, 1, sx * (W / 2 - 0.08), 0.035, sz * (D / 2 - 0.08)));
    L.push(part(rbox(W, 0.2, D, 0.05, 2), c, 0, 0, 0.17, 0));
    L.push(part(rbox(W, 0.52, 0.22, 0.07, 2), c, 0, 0, 0.53, -D / 2 + 0.11));
    for (const sx of [-1, 1]) L.push(part(rbox(0.2, 0.36, D, 0.07, 2), c, 0, sx * (W / 2 - 0.1), 0.45, 0));
    for (const sx of [-1, 1]) L.push(part(rbox(0.8, 0.15, 0.62, 0.06, 2), c2, 0, sx * 0.4, 0.34, 0.09));
    for (const sx of [-1, 1]) L.push(part(rbox(0.78, 0.42, 0.16, 0.07, 2), c2, 0, sx * 0.4, 0.6, -0.23, 0, -0.16));
    L.push(part(rbox(0.36, 0.34, 0.12, 0.07, 2), '#d9a441', 0, 0.56, 0.57, -0.07, -0.25, -0.22));
    L.push(part(rbox(0.33, 0.31, 0.12, 0.07, 2), '#c9694a', 0, -0.62, 0.55, -0.09, 0.3, -0.2));
    return L;
  }
  function armchair() {
    const L = [], W = 0.86, D = 0.84, c = '#c98f3e', c2 = '#d49c4c', leg = '#4a3424';
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(part(new THREE.CylinderGeometry(0.022, 0.018, 0.08, 8), leg, 1, sx * (W / 2 - 0.07), 0.04, sz * (D / 2 - 0.07)));
    L.push(part(rbox(W, 0.2, D, 0.05, 2), c, 0, 0, 0.18, 0));
    L.push(part(rbox(W, 0.54, 0.2, 0.07, 2), c, 0, 0, 0.55, -D / 2 + 0.1, 0, -0.06));
    for (const sx of [-1, 1]) L.push(part(rbox(0.16, 0.32, D, 0.07, 2), c, 0, sx * (W / 2 - 0.08), 0.44, 0));
    L.push(part(rbox(0.54, 0.14, 0.6, 0.06, 2), c2, 0, 0, 0.34, 0.08));
    L.push(part(rbox(0.3, 0.28, 0.11, 0.06, 2), '#5d7d8a', 0, 0.05, 0.55, -0.16, 0.2, -0.25));
    return L;
  }
  function coffeeTable() {
    const L = [], W = 1.1, D = 0.62, wood = '#b98a5a';
    L.push(part(rbox(W, 0.045, D, 0.018, 2), wood, 1, 0, 0.4, 0));
    for (const sx of [-1, 1]) for (const sz of [-1, 1]) L.push(part(new THREE.CylinderGeometry(0.022, 0.017, 0.38, 10), '#8a6440', 1, sx * (W / 2 - 0.05), 0.19, sz * (D / 2 - 0.05)));
    L.push(part(rbox(0.24, 0.035, 0.17, 0.006, 1), '#3f5d7a', 8, -0.22, 0.44, 0.04, 0.2));
    L.push(part(rbox(0.21, 0.03, 0.15, 0.006, 1), '#d8cbb2', 8, -0.21, 0.4725, 0.03, 0.05));
    L.push(part(new THREE.CylinderGeometry(0.04, 0.036, 0.09, 14), '#ece6da', 3, 0.22, 0.468, -0.08));
    L.push(part(new THREE.TorusGeometry(0.025, 0.007, 6, 10), '#ece6da', 3, 0.265, 0.47, -0.08, 0, 0, 0));
    L.push(part(new THREE.CylinderGeometry(0.11, 0.09, 0.025, 20), '#2f3b4a', 3, 0.15, 0.435, 0.12));
    for (let k = 0; k < 3; k++) L.push(part(new THREE.SphereGeometry(0.03, 10, 8), ['#e4a33a', '#d9612f', '#9bbf4a'][k], 3, 0.13 + k * 0.035, 0.475, 0.1 + (k % 2) * 0.03));
    return L;
  }
  function bookcase() {
    const L = [], W = 1.2, D = 0.34, H = 0.95, c = '#e8e2d6', r = rng(17);
    for (const sx of [-1, 1]) L.push(part(rbox(0.025, H, D, 0.006, 1), c, 2, sx * (W / 2 - 0.0125), H / 2, 0));
    L.push(part(rbox(W, 0.03, D, 0.008, 1), c, 2, 0, H - 0.015, 0));
    L.push(part(rbox(W - 0.05, 0.06, D - 0.02, 0.004, 1), c, 2, 0, 0.03, 0));
    L.push(part(rbox(W - 0.05, 0.022, D - 0.03, 0.004, 1), c, 2, 0, 0.48, 0));
    L.push(part(rbox(W - 0.05, H - 0.06, 0.012, 0.002, 1), '#d9d2c4', 2, 0, H / 2, -D / 2 + 0.006));
    const pal = ['#3f5d7a', '#c9694a', '#d9a441', '#6f8f6a', '#8a4f5e', '#d8cbb2', '#2f3b4a', '#a7b8c4', '#e9e1cf'];
    for (const y0 of [0.06, 0.491]) {
      let x = -W / 2 + 0.035;
      while (x < W / 2 - 0.06) {
        if (r() < 0.12) {   // a stack lying flat, or a gap with an ornament
          const n = 2 + Math.floor(r() * 3), w = 0.17 + r() * 0.05; let y = y0;
          if (x + w > W / 2 - 0.03) break;
          for (let k = 0; k < n; k++) { const h = 0.025 + r() * 0.02; L.push(part(new THREE.BoxGeometry(w, h, 0.2 + r() * 0.04), pal[Math.floor(r() * pal.length)], 8, x + w / 2 + (r() - 0.5) * 0.02, y + h / 2, 0.01, (r() - 0.5) * 0.2)); y += h; }
          x += w + 0.02; continue;
        }
        const w = 0.022 + r() * 0.024, h = 0.2 + r() * 0.17, tilt = r() < 0.08 ? 0.12 : 0;
        L.push(part(new THREE.BoxGeometry(w, h, 0.19 + r() * 0.06), pal[Math.floor(r() * pal.length)], 8, x + w / 2 + tilt * h * 0.5, y0 + h / 2 * Math.cos(tilt), 0.01, 0, 0, -tilt));
        x += w + 0.002 + tilt * h * 0.6;
      }
    }
    // on top: a vase with twigs and a framed picture
    L.push(part(new THREE.LatheGeometry([[0.0, 0], [0.05, 0], [0.065, 0.06], [0.05, 0.16], [0.03, 0.2], [0.034, 0.215]].map(p => new THREE.Vector2(p[0], p[1])), 16), '#3e6f74', 3, 0.35, H, 0));
    for (let k = 0; k < 3; k++) L.push(part(new THREE.CylinderGeometry(0.004, 0.005, 0.32, 4), '#5b4330', 1, 0.35 + (k - 1) * 0.03, H + 0.34, 0, 0, (k - 1) * 0.12, (k - 1) * 0.25));
    L.push(part(rbox(0.22, 0.28, 0.025, 0.006, 1), '#4a3424', 1, -0.3, H + 0.14, -0.06, 0.15, -0.12));
    L.push(part(new THREE.BoxGeometry(0.17, 0.22, 0.01), '#d9a441', 5, -0.3, H + 0.14, -0.045, 0.15, -0.12));
    return L;
  }
  function plant() {
    const L = [], r = rng(23);
    L.push(part(new THREE.LatheGeometry([[0.0, 0], [0.14, 0], [0.155, 0.01], [0.19, 0.33], [0.2, 0.36], [0.18, 0.365], [0.17, 0.34]].map(p => new THREE.Vector2(p[0], p[1])), 24), '#b8613e', 3, 0, 0, 0));
    L.push(part(new THREE.CircleGeometry(0.172, 20), '#3a2a1e', 9, 0, 0.335, 0, 0, -HALF));
    for (let k = 0; k < 15; k++) {
      // a leaf: a strip arching out and down from the soil, widest in its middle
      const a = k * 2.4 + r() * 0.5, len = 0.45 + r() * 0.35, rise = 0.45 + r() * 0.5, NS = 8, P = [], N = [], I = [];
      const dx = Math.cos(a), dz = Math.sin(a), sx = -dz, sz = dx, wmax = 0.07 + r() * 0.05;
      for (let i = 0; i <= NS; i++) {
        const u = i / NS, out = len * u, y = 0.35 + rise * Math.sin(u * 2.3) - u * u * 0.25, w = wmax * Math.pow(Math.sin(Math.PI * Math.min(1, u * 1.05 + 0.02)), 0.8);
        const cx = dx * out, cz = dz * out;
        P.push(cx - sx * w, y + w * 0.25, cz - sz * w, cx + sx * w, y + w * 0.25, cz + sz * w);
        const ty = rise * 2.3 * Math.cos(u * 2.3) - 2 * u * 0.25, tl = Math.hypot(len, ty), nx = -dx * ty / tl, ny = len / tl, nz = -dz * ty / tl;
        N.push(nx, ny, nz, nx, ny, nz);
        if (i < NS) I.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
      // keep the leaf's front facing up
      const tri = [0, 2, 1].map(j => new THREE.Vector3(P[I[j] * 3], P[I[j] * 3 + 1], P[I[j] * 3 + 2]));
      if (new THREE.Vector3().subVectors(tri[1], tri[0]).cross(new THREE.Vector3().subVectors(tri[2], tri[0])).y < 0) { for (let i = 0; i < I.length; i += 3) { const t = I[i + 1]; I[i + 1] = I[i + 2]; I[i + 2] = t; } g.setIndex(I); }
      const col = K.ramp([[0, K.rgb('#2f6a32')], [1, K.rgb('#62a04a')]], r());
      for (const s of twoSided(g)) L.push(part(s, col, 5, 0, 0, 0));
    }
    return L;
  }
  function floorLamp() {
    const L = [];
    L.push(part(new THREE.CylinderGeometry(0.15, 0.16, 0.025, 24), '#2b2b2e', 4, 0, 0.0125, 0));
    L.push(part(new THREE.CylinderGeometry(0.011, 0.011, 1.38, 8), '#b89055', 4, 0, 0.715, 0));
    const shade = prep(new THREE.CylinderGeometry(0.15, 0.21, 0.27, 28, 1, true));
    const [o, i] = twoSided(shade);
    L.push(part(o, '#f1e6d0', 6, 0, 1.5, 0), part(i, '#fff1d6', 7, 0, 1.5, 0));
    L.push(part(new THREE.SphereGeometry(0.04, 12, 8), '#fff4dc', 7, 0, 1.46, 0));
    return L;
  }

  // walls with their window, door, curtains and picture; every vertex knows its wall (aW), so a wall and all on it
  // can be cut down together (the doll's-house view)
  function modelWalls() {
    const L = [], paint = ['#c9cdb6', '#efe6d8', '#efe6d8', '#ede2d3'], outer = '#bdb4a8', cap = '#d6cfc4', trim = '#f4f0e8';
    const box = (x0, x1, y0, y1, z0, z1, w, col, kind) => part(new THREE.BoxGeometry(x1 - x0, y1 - y0, z1 - z0), col, kind, (x0 + x1) / 2, (y0 + y1) / 2, (z0 + z1) / 2, 0, 0, 0, { aW: w });
    // colour a wall box: its room side painted, its top the cut colour, the rest the outside colour
    const wallBox = (x0, x1, y0, y1, z0, z1, w, nx, nz) => {
      const g = box(x0, x1, y0, y1, z0, z1, w, outer, 0), n = g.attributes.normal.array, c = g.attributes.color.array, pc = K.rgb(paint[w]), cc = K.rgb(cap);
      for (let i = 0; i < n.length / 3; i++) {
        if (n[i * 3] * nx + n[i * 3 + 2] * nz > 0.5) c.set(pc, i * 3);
        else if (n[i * 3 + 1] > 0.5) { c.set(cc, i * 3); g.attributes.aK.array[i] = 7; }
      }
      return g;
    };
    const X0 = MW + WI, Z0 = MD + WI, X1 = X0 + WT, Z1 = Z0 + WT;
    // back wall (0), with the window
    L.push(wallBox(-X1, X1, 0, WIN.y0, -Z1, -Z0, 0, 0, 1), wallBox(-X1, X1, WIN.y1, MH, -Z1, -Z0, 0, 0, 1));
    L.push(wallBox(-X1, WIN.x0, WIN.y0, WIN.y1, -Z1, -Z0, 0, 0, 1), wallBox(WIN.x1, X1, WIN.y0, WIN.y1, -Z1, -Z0, 0, 0, 1));
    // the opening's sides, painted
    for (const [a, b] of [[WIN.x0, WIN.x0 + 0.001], [WIN.x1 - 0.001, WIN.x1]]) L.push(box(a, b, WIN.y0, WIN.y1, -Z1, -Z0, 0, paint[0], 0));
    L.push(box(WIN.x0, WIN.x1, WIN.y1 - 0.001, WIN.y1, -Z1, -Z0, 0, paint[0], 0));
    // window: trim, sill, sash and bars, glass
    const tz0 = -Z0, tz1 = -Z0 + 0.025;
    L.push(box(WIN.x0 - 0.07, WIN.x0, WIN.y0 - 0.02, WIN.y1 + 0.07, tz0, tz1, 0, trim, 1), box(WIN.x1, WIN.x1 + 0.07, WIN.y0 - 0.02, WIN.y1 + 0.07, tz0, tz1, 0, trim, 1));
    L.push(box(WIN.x0 - 0.07, WIN.x1 + 0.07, WIN.y1, WIN.y1 + 0.07, tz0, tz1, 0, trim, 1));
    L.push(box(WIN.x0 - 0.1, WIN.x1 + 0.1, WIN.y0 - 0.035, WIN.y0, -Z1 + 0.03, -Z0 + 0.07, 0, trim, 1));
    const gz = -Z0 - 0.06, xm = (WIN.x0 + WIN.x1) / 2, ym = 1.56;
    for (const [a, b, c, d] of [[WIN.x0, WIN.x0 + 0.045, WIN.y0, WIN.y1], [WIN.x1 - 0.045, WIN.x1, WIN.y0, WIN.y1], [WIN.x0, WIN.x1, WIN.y0, WIN.y0 + 0.045], [WIN.x0, WIN.x1, WIN.y1 - 0.045, WIN.y1],
      [xm - 0.02, xm + 0.02, WIN.y0, WIN.y1], [WIN.x0, WIN.x1, ym - 0.018, ym + 0.018]]) L.push(box(a, b, c, d, gz - 0.02, gz + 0.02, 0, trim, 1));
    L.push(part(new THREE.PlaneGeometry(WIN.x1 - WIN.x0, WIN.y1 - WIN.y0), '#ffffff', 2, xm, (WIN.y0 + WIN.y1) / 2, gz - 0.005, 0, 0, 0, { aW: 0 }));
    // curtains either side of the window, on a brass rail
    for (const [c0, c1] of [[WIN.x0 - 0.62, WIN.x0 - 0.04], [WIN.x1 + 0.04, WIN.x1 + 0.62]]) {
      const NS = 30, P = [], N = [], I = [], y0 = 0.17, y1 = 2.33;
      for (let i = 0; i <= NS; i++) {
        const u = i / NS, x = c0 + (c1 - c0) * u, ph = u * 7 * TAU / 2, z = -Z0 + 0.075 + 0.03 * Math.sin(ph), dz = 0.03 * Math.cos(ph) * 7 * Math.PI / (c1 - c0), l = Math.hypot(dz, 1);
        P.push(x, y0, z, x, y1, z); N.push(-dz / l, 0, 1 / l, -dz / l, 0, 1 / l);
        if (i < NS) I.push(2 * i, 2 * i + 2, 2 * i + 1, 2 * i + 1, 2 * i + 2, 2 * i + 3);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
      for (const s of twoSided(g)) L.push(part(s, '#e6d6bb', 3, 0, 0, 0, 0, 0, 0, { aW: 0 }));
    }
    L.push(part(new THREE.CylinderGeometry(0.012, 0.012, (WIN.x1 - WIN.x0) + 1.5, 8), '#b89055', 6, xm, 2.37, -Z0 + 0.075, 0, 0, HALF, { aW: 0 }));
    // right (1) and front (2) walls, plain
    L.push(wallBox(X0, X1, 0, MH, -Z0, Z0, 1, -1, 0), wallBox(-X1, X1, 0, MH, Z0, Z1, 2, 0, -1));
    // left wall (3), with the door and a picture over the sofa
    L.push(wallBox(-X1, -X0, 0, MH, -Z0, Z0, 3, 1, 0));
    const dx0 = -X0, dx1 = -X0 + 0.012;
    L.push(box(dx0, dx1, 0, DOOR.h, DOOR.z0, DOOR.z1, 3, '#e9e1d4', 4));
    for (const [y0, y1] of [[0.18, 0.92], [1.1, 1.86]]) {
      for (const [a, b, c, d] of [[y0, y1, DOOR.z0 + 0.12, DOOR.z0 + 0.14], [y0, y1, DOOR.z1 - 0.14, DOOR.z1 - 0.12], [y0, y0 + 0.02, DOOR.z0 + 0.12, DOOR.z1 - 0.12], [y1 - 0.02, y1, DOOR.z0 + 0.12, DOOR.z1 - 0.12]])
        L.push(box(dx1, dx1 + 0.008, a, b, c, d, 3, trim, 1));
    }
    L.push(box(dx0, dx0 + 0.018, 0, DOOR.h + 0.07, DOOR.z0 - 0.07, DOOR.z0, 3, trim, 1), box(dx0, dx0 + 0.018, 0, DOOR.h + 0.07, DOOR.z1, DOOR.z1 + 0.07, 3, trim, 1));
    L.push(box(dx0, dx0 + 0.018, DOOR.h, DOOR.h + 0.07, DOOR.z0 - 0.07, DOOR.z1 + 0.07, 3, trim, 1));
    L.push(part(new THREE.SphereGeometry(0.026, 12, 8), '#b89055', 6, dx1 + 0.05, 1.0, DOOR.z0 + 0.08, 0, 0, 0, { aW: 3 }));
    L.push(part(new THREE.CylinderGeometry(0.03, 0.03, 0.01, 14), '#b89055', 6, dx1 + 0.005, 1.0, DOOR.z0 + 0.08, 0, 0, HALF, { aW: 3 }));
    const pz = FUR.sofa.z, py = 1.5;
    L.push(box(dx0, dx0 + 0.03, py - 0.33, py + 0.33, pz - 0.46, pz + 0.46, 3, '#3b2c22', 1));
    L.push(box(dx0, dx0 + 0.034, py - 0.27, py + 0.27, pz - 0.4, pz + 0.4, 3, '#efe8da', 5));
    for (const [a, b, c] of [[0.05, 0.22, '#8fa6b4'], [-0.08, 0.05, '#d9a441'], [-0.22, -0.08, '#c9694a']]) L.push(box(dx0, dx0 + 0.036, py + a, py + b, pz - 0.34, pz + 0.34, 3, c, 5));
    L.push(part(new THREE.CylinderGeometry(0.075, 0.075, 0.004, 24), '#f4ead6', 5, dx0 + 0.038, py + 0.1, pz + 0.16, 0, 0, HALF, { aW: 3 }));
    // skirting boards (not across the door)
    const sk = 0.09, sd = 0.015;
    L.push(box(-X0, X0, 0, sk, -Z0, -Z0 + sd, 0, trim, 1), box(-X0, X0, 0, sk, Z0 - sd, Z0, 2, trim, 1));
    L.push(box(X0 - sd, X0, 0, sk, -Z0, Z0, 1, trim, 1));
    L.push(box(-X0, -X0 + sd, 0, sk, -Z0, DOOR.z0 - 0.07, 3, trim, 1), box(-X0, -X0 + sd, 0, sk, DOOR.z1 + 0.07, Z0, 3, trim, 1));
    return merge(L);
  }
  function modelFurniture() {
    const f = FUR, L = [];
    L.push(...place(sofa(), f.sofa.x, f.sofa.z, f.sofa.ry), ...place(armchair(), f.chair.x, f.chair.z, f.chair.ry));
    L.push(...place(coffeeTable(), f.table.x, f.table.z, f.table.ry), ...place(bookcase(), f.shelf.x, f.shelf.z, f.shelf.ry));
    L.push(...place(plant(), f.plant.x, f.plant.z, 0), ...place(floorLamp(), f.lamp.x, f.lamp.z, 0));
    return merge(L);
  }

  // ---------------------------------------------------------------- the floor's dust map
  // R: cleaned (0..255), G: shade near walls and under furniture (fixed per room), B: counts for coverage
  const MAP = { tex: null, data: null, w: 1, h: 1, x0: 0, z0: 0, cs: 0.025, count: 0, done: 0, dirty: false, age: 0, move: null };
  const uMap = { value: null }, uBox = { value: new THREE.Vector4(0, 0, 1, 1) };

  // ---------------------------------------------------------------- materials of the room
  const uRoom = { value: 1 }, uTwin = { value: 0 }, uTwinScan = { value: 0 }, uTrails = { value: 0 }, uCut = { value: new Array(MAXW + 1).fill(9) };   // the last slot: walls past MAXW, never cut
  const RIP = []; for (let k = 0; k < 8; k++) RIP.push(new THREE.Vector4(-1, 0, 9, 0));
  const uRip = { value: RIP };
  const floorMat = mat({
    uniforms: Object.assign({ uA: set.uA, uMap, uBox, uTrails, uRoom,
      uRug: { value: new THREE.Vector4(FUR.rug.x, FUR.rug.z, FUR.rug.w / 2, FUR.rug.d / 2) },
      uWinR: { value: new THREE.Vector4(WIN.x0, WIN.x1, WIN.y0, WIN.y1) }, uSun: { value: new THREE.Vector3(-0.2, 0.62, -0.76).normalize() } }, LIT),
    vertexShader: LV + `void main() { setLight(position, vec3(0.0, 1.0, 0.0)); }`,
    fragmentShader: LF + `
uniform sampler2D uMap; uniform vec4 uBox, uRug, uWinR; uniform vec3 uSun; uniform float uTrails, uRoom;
float sdRect(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
void main() {
  vec3 p = vPL;
  // oak planks along x, staggered, each its own shade, with grain and fine gaps
  float pw = 0.16, row = floor(p.z / pw), off = hsh(vec2(row, 3.1)) * 1.7, pl = 1.7;
  vec2 id = vec2(row, floor((p.x + off) / pl));
  float h1 = hsh(id), h2 = hsh(id + 7.3);
  vec3 col = mix(vec3(0.58, 0.39, 0.22), vec3(0.74, 0.53, 0.32), h1) * (0.93 + 0.07 * h2);
  float gz = fract(p.z / pw), gx = fract((p.x + off) / pl);
  float grain = vno(vec2(p.x * 1.6 + h1 * 40.0, gz * 7.0 + vno(vec2(p.x * 0.5 + h2 * 9.0, gz * 2.0)) * 3.0));
  col *= 0.86 + 0.22 * grain + 0.04 * vno(vec2(p.x * 30.0, p.z * 300.0));
  float ez = min(gz, 1.0 - gz) * pw, ex = min(gx, 1.0 - gx) * pl, aa = fwidth(p.z) + fwidth(p.x);
  col *= 1.0 - 0.4 * (1.0 - smoothstep(0.0, 0.0012 + aa, ez)) - 0.3 * (1.0 - smoothstep(0.0, 0.0012 + aa, ex));
  // the rug: cream with a terracotta border and a faint lattice
  vec2 rq = p.xz - uRug.xy; float rd = sdRect(rq, uRug.zw, 0.05), raa = fwidth(rd);
  if (rd < raa) {
    float e = -rd;
    vec3 rug = vec3(0.86, 0.79, 0.68);
    vec2 dq = vec2(rq.x + rq.y, rq.x - rq.y) * 3.2; vec2 dl = abs(fract(dq) - 0.5);
    rug = mix(rug, vec3(0.62, 0.66, 0.68), (1.0 - smoothstep(0.0, 0.05 + fwidth(dq.x), min(dl.x, dl.y))) * 0.5 * step(0.24, e));
    rug = mix(rug, vec3(0.74, 0.4, 0.29), smoothstep(0.055, 0.06, e) * (1.0 - smoothstep(0.15, 0.155, e)));
    rug = mix(rug, vec3(0.3, 0.38, 0.47), smoothstep(0.18, 0.185, e) * (1.0 - smoothstep(0.2, 0.205, e)));
    rug *= 0.92 + 0.12 * hsh(floor(p.xz * 420.0)) * hsh(floor(p.xz * 180.0) + 3.0);
    col = mix(col, rug, smoothstep(raa, -raa, rd));
  }
  vec4 m = texture2D(uMap, (p.xz - uBox.xy) * uBox.zw);
  float clean = m.r, dusty = 1.0 - clean, ao = mix(0.5, 1.0, m.g);
  ao *= 1.0 - 0.18 * (1.0 - smoothstep(0.0, 0.03, rd)) * step(0.0, rd);   // the rug's edge
  // dust: a pale film with specks, where no robot has been yet
  float dn = vno(p.xz * 5.0) * 0.6 + vno(p.xz * 23.0) * 0.4;
  vec3 grey = vec3(dot(col, vec3(0.33)));
  col = mix(col, mix(grey, col, 0.55) * 1.06 + 0.035, 0.75 * dusty * (0.8 + 0.4 * dn));   // dust: paler, greyer, flat
  float sk = hsh(floor(p.xz * 260.0));
  col = mix(col, vec3(0.9, 0.89, 0.86), step(0.986, sk) * 0.45 * dusty);
  col = mix(col, vec3(0.25, 0.22, 0.2), step(sk, 0.004) * 0.45 * dusty);
  vec3 lit = shade(col, normalize(vUW), mix(0.05, 0.16, clean), ao);
  // the cleaned trail as a map: a faint cyan, brightest along its edges
  float edge = clamp(fwidth(clean) * 5.0, 0.0, 1.0);
  lit = mix(lit, vec3(0.25, 0.78, 0.98), uTrails * clean * 0.26) + CYAN * edge * uTrails * 0.25;
  // daylight through the window: a patch of warm light on the floor, crossed by the window's bars
  float s = (-2.22 - p.z) / uSun.z; vec3 h = p + uSun * s;
  float sun = smoothstep(uWinR.x, uWinR.x + 0.06, h.x) * (1.0 - smoothstep(uWinR.y - 0.06, uWinR.y, h.x)) * smoothstep(uWinR.z, uWinR.z + 0.06, h.y) * (1.0 - smoothstep(uWinR.w - 0.06, uWinR.w, h.y));
  sun *= smoothstep(0.02, 0.05, abs(h.x - (uWinR.x + uWinR.y) * 0.5)) * smoothstep(0.018, 0.045, abs(h.y - 1.56));
  lit += col * vec3(1.0, 0.82, 0.6) * sun * 0.3 * smoothstep(0.3, 0.8, ao);
  float g = scanGrid(p, vec3(0.0, 1.0, 0.0));
  vec4 o = over(vec4(lit, 1.0), CYAN, g);
  gl_FragColor = vec4(dith(o.rgb), uA * uRoom);
}`,
  });
  // walls (model): paint, trim, glass with daylight, curtains, wood, the picture, brass; cut down when seen from outside
  const wallMat = mat({
    uniforms: Object.assign({ uA: set.uA, uRoom, uCut }, LIT),
    vertexShader: LV + `
attribute vec3 color; attribute float aK, aW; uniform float uCut[${MAXW + 1}];
varying vec3 vC; varying float vK, vCut;
void main() { vC = color; vK = aK; vCut = uCut[int(min(aW, ${MAXW}.0) + 0.5)]; setLight(position, normal); }`,
    fragmentShader: LF + `
uniform float uRoom; varying vec3 vC; varying float vK, vCut;
void main() {
  float cut = 1.0 - smoothstep(vCut - 0.09, vCut, vPL.y);
  if (cut < 0.01) discard;
  vec3 N = normalize(vNW), p = vPL, c;
  if (vK > 1.5 && vK < 2.5) {   // the window: a bright soft sky, a band of trees far off
    float y = (p.y - 0.85) / 1.3;
    c = mix(vec3(0.95, 0.93, 0.86), vec3(0.74, 0.85, 0.98), smoothstep(0.1, 1.0, y));
    float tr = smoothstep(0.02, 0.0, y - 0.22 - 0.12 * vno(vec2(p.x * 3.0, 1.0)) - 0.05 * vno(vec2(p.x * 11.0, 2.0)));
    c = mix(c, vec3(0.5, 0.62, 0.48), tr * 0.7);
    gl_FragColor = vec4(c, uA * uRoom * cut); return;
  }
  float gloss = vK < 0.5 ? 0.05 : vK < 1.5 ? 0.35 : vK < 3.5 ? 0.02 : vK < 4.5 ? 0.25 : vK < 5.5 ? 0.1 : vK < 6.5 ? 0.8 : 0.0;
  // shade in the corners and along the floor
  float dc = abs(N.z) > 0.5 ? 2.72 - abs(p.x) : 2.22 - abs(p.z);
  float ao = (0.62 + 0.38 * smoothstep(0.0, 0.55, p.y)) * (0.72 + 0.28 * smoothstep(0.0, 0.5, dc)) * (0.9 + 0.1 * smoothstep(2.5, 1.9, p.y));
  vec3 base = vC;
  if (vK < 0.5) base *= 0.97 + 0.03 * vno(p.xy * 8.0 + p.zy * 8.0);
  if (vK > 2.5 && vK < 3.5) base *= 0.9 + 0.1 * vno(vec2(p.x * 40.0, p.y * 2.0));
  c = shade(base, N, gloss, ao);
  if (vK > 2.5 && vK < 3.5) c += vec3(1.0, 0.85, 0.6) * 0.1;   // daylight through the curtains
  float g = scanGrid(p, vNL);
  vec4 o = over(vec4(c, 1.0), CYAN, g);
  gl_FragColor = vec4(dith(o.rgb), uA * uRoom * cut);
}`,
  });
  // furniture: fabric, wood, paint, ceramic, metal, leaves, the lamp's shade and bulb, books, soil
  const furMat = mat({
    uniforms: Object.assign({ uA: set.uA, uRoom }, LIT),
    vertexShader: LV + `
attribute vec3 color; attribute float aK; varying vec3 vC; varying float vK;
void main() { vC = color; vK = aK; setLight(position, normal); }`,
    fragmentShader: LF + `
uniform float uRoom; varying vec3 vC; varying float vK;
void main() {
  vec3 N = normalize(vNW), p = vPL, base = vC;
  float k = vK, gloss = k < 0.5 ? 0.04 : k < 1.5 ? 0.3 : k < 2.5 ? 0.15 : k < 3.5 ? 0.7 : k < 4.5 ? 0.85 : k < 5.5 ? 0.25 : k < 7.5 ? 0.0 : k < 8.5 ? 0.08 : 0.0;
  float ao = 0.55 + 0.45 * smoothstep(0.0, 0.35, p.y);
  if (k < 0.5) base *= 0.93 + 0.07 * vno(vec2(p.x + p.z, p.y) * 90.0);   // fabric weave
  if (k > 0.5 && k < 1.5) base *= 0.9 + 0.12 * vno(vec2((p.x + p.z) * 3.0, p.y * 40.0));
  vec3 c = shade(base, N, gloss, ao);
  if (k > 5.5 && k < 6.5) c = mix(c, vec3(1.0, 0.86, 0.62), 0.45);   // the lamp shade glows
  if (k > 6.5 && k < 7.5) c = vec3(1.0, 0.9, 0.7) * 1.15;
  float g = scanGrid(p, vNL);
  vec4 o = over(vec4(c, 1.0), CYAN, g);
  gl_FragColor = vec4(dith(o.rgb), uA * uRoom);
}`,
  });
  const MODEL = new THREE.Group(); set.group.add(MODEL);
  {
    const fl = new THREE.Mesh(new THREE.PlaneGeometry(2 * (MW + WI), 2 * (MD + WI)).rotateX(-HALF), floorMat);
    fl.renderOrder = 0; MODEL.add(fl);
    const fu = new THREE.Mesh(modelFurniture(), furMat); fu.renderOrder = 2; MODEL.add(fu);
    const wa = new THREE.Mesh(modelWalls(), wallMat); wa.renderOrder = 6; MODEL.add(wa);
    for (const o of MODEL.children) o.frustumCulled = false;
  }

  // ---------------------------------------------------------------- real and box rooms: a calm digital twin (VR) or lines of light (passthrough)
  const twinFloorMat = mat({
    uniforms: Object.assign({ uA: set.uA, uMap, uBox, uTrails, uRoom, uTwin, uTwinScan }, LIT),
    vertexShader: LV + `void main() { setLight(position, vec3(0.0, 1.0, 0.0)); }`,
    fragmentShader: LF + `
uniform sampler2D uMap; uniform vec4 uBox; uniform float uTrails, uRoom, uTwin, uTwinScan;
void main() {
  vec3 p = vPL;
  vec4 m = texture2D(uMap, (p.xz - uBox.xy) * uBox.zw);
  float clean = m.r, dusty = 1.0 - clean, ao = mix(0.55, 1.0, m.g);
  vec3 col = vec3(0.45, 0.46, 0.49) * (0.97 + 0.03 * vno(p.xz * 3.0));
  vec2 gq = p.xz * 2.0, gw = fwidth(gq), gl = abs(fract(gq + 0.5) - 0.5) / gw;
  col += 0.05 * (1.0 - min(min(gl.x, gl.y), 1.0));
  col = mix(col, col * 0.9 + 0.05, 0.6 * dusty);
  float sk = hsh(floor(p.xz * 230.0));
  col = mix(col, vec3(0.7), step(0.985, sk) * 0.3 * dusty);
  vec3 lit = shade(col, normalize(vUW), mix(0.1, 0.35, clean), ao);
  lit = mix(lit, vec3(0.25, 0.78, 0.98), uTrails * clean * 0.3);
  float aOp = uTwin * uRoom, aTr = clean * uTrails * 0.32 * (1.0 - uRoom);
  vec4 o = over(vec4(lit, aOp), CYAN, aTr);
  o = over(o, CYAN, scanGrid(p, vec3(0.0, 1.0, 0.0)) * uTwinScan);
  if (o.a < 0.004) discard;
  gl_FragColor = vec4(o.rgb, o.a * uA);
}`,
  });
  const twinWallMat = mat({
    side: THREE.DoubleSide,
    uniforms: Object.assign({ uA: set.uA, uRoom, uTwin, uTwinScan, uCut, uRip }, LIT),
    vertexShader: LV + `
attribute float aW, aU, aH; uniform float uCut[${MAXW + 1}]; varying float vW, vU, vH, vCut;
void main() { vW = aW; vU = aU; vH = aH; vCut = uCut[int(min(aW, ${MAXW}.0) + 0.5)]; setLight(position, normal); }`,
    fragmentShader: LF + `
uniform float uRoom, uTwin, uTwinScan; uniform vec4 uRip[8];
varying float vW, vU, vH, vCut;
void main() {
  vec3 p = vPL, N = normalize(vNW); if (!gl_FrontFacing) N = -N;
  float cut = 1.0 - smoothstep(vCut - 0.09, vCut, p.y);
  // the twin: pale walls, brighter at the top and at the floor
  float e = max(1.0 - smoothstep(0.0, 0.035, p.y), 1.0 - smoothstep(0.0, 0.035, vH - p.y));
  vec3 base = mix(vec3(0.8, 0.81, 0.84), vec3(1.0), e * 0.7);
  vec3 lit = shade(base, N, 0.05, 0.7 + 0.3 * smoothstep(0.0, 0.6, p.y)) + e * 0.12;
  vec4 o = vec4(lit, uTwin * uRoom * cut);
  // passthrough: a thin glowing line along the wall's foot, and ripples where robots bump it
  float pt = 1.0 - uRoom;
  if (pt > 0.0 && p.y < 0.7) {
    float line = exp(-p.y / 0.01) * 0.85 + exp(-p.y / 0.07) * 0.15, rip = 0.0;
    for (int k = 0; k < 8; k++) {
      vec4 r = uRip[k];
      if (abs(r.x - vW) < 0.5 && r.z < 0.8) {
        float d = length(vec2(vU - r.y, p.y * 1.3)), f = 0.06 + r.z * 1.3;
        rip += exp(-pow((d - f) / 0.045, 2.0)) * pow(1.0 - r.z / 0.8, 2.0) * exp(-d * 1.2) * r.w;
        rip += exp(-d * d * 200.0) * (1.0 - smoothstep(0.0, 0.25, r.z)) * r.w;
      }
    }
    o = over(o, CYAN, clamp((line + rip) * pt, 0.0, 1.0));
  }
  o = over(o, CYAN, scanGrid(p, vNL) * uTwinScan * cut);
  if (o.a < 0.004) discard;
  gl_FragColor = vec4(o.rgb, o.a * uA);
}`,
  });
  const twinBlockMat = mat({
    uniforms: Object.assign({ uA: set.uA, uRoom, uTwin, uTwinScan }, LIT),
    vertexShader: LV + `void main() { setLight(position, normal); }`,
    fragmentShader: LF + `
uniform float uRoom, uTwin, uTwinScan;
void main() {
  vec3 N = normalize(vNW), p = vPL;
  float top = smoothstep(0.3, 0.9, dot(N, normalize(vUW))), ed = smoothstep(0.2, 0.6, abs(dot(N, normalize(vUW)))) * (1.0 - top);
  vec3 lit = shade(mix(vec3(0.6, 0.63, 0.68), vec3(0.7, 0.72, 0.76), top), N, 0.15, 0.6 + 0.4 * smoothstep(0.0, 0.4, p.y)) + ed * 0.15;
  vec4 o = over(vec4(lit, uTwin * uRoom), CYAN, scanGrid(p, vNL) * uTwinScan);
  if (o.a < 0.004) discard;
  gl_FragColor = vec4(o.rgb, o.a * uA);
}`,
  });
  const TWIN = new THREE.Group(); set.group.add(TWIN);
  function buildTwin() {
    for (const o of TWIN.children.slice()) { o.geometry.dispose(); TWIN.remove(o); }
    const F = ROOM.floor;
    // floor
    {
      const tris = THREE.ShapeUtils.triangulateShape(F.map(p => new THREE.Vector2(p[0], p[1])), []), P = [], I = [];
      for (const p of F) P.push(p[0], 0.001, p[1]);
      for (const t of tris) {
        const a = F[t[0]], b = F[t[1]], c = F[t[2]], cy = (b[1] - a[1]) * (c[0] - a[0]) - (b[0] - a[0]) * (c[1] - a[1]);
        if (cy >= 0) I.push(t[0], t[1], t[2]); else I.push(t[0], t[2], t[1]);
      }
      const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setIndex(I);
      const m = new THREE.Mesh(g, twinFloorMat); m.renderOrder = 0; TWIN.add(m);
    }
    // walls
    {
      const P = [], N = [], A = [], U = [], Hh = [], I = [];
      WALLS.forEach((w, k) => {
        const b = P.length / 3;
        P.push(w.ax, 0, w.az, w.bx, 0, w.bz, w.bx, w.h, w.bz, w.ax, w.h, w.az);
        for (let i = 0; i < 4; i++) { N.push(w.nx, 0, w.nz); A.push(k); Hh.push(w.h); }
        U.push(0, w.len, w.len, 0);
        I.push(b, b + 1, b + 2, b, b + 2, b + 3);
      });
      if (I.length) {
        const g = new THREE.BufferGeometry();
        g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3));
        g.setAttribute('aW', new THREE.Float32BufferAttribute(A, 1)); g.setAttribute('aU', new THREE.Float32BufferAttribute(U, 1)); g.setAttribute('aH', new THREE.Float32BufferAttribute(Hh, 1));
        g.setIndex(I);
        const m = new THREE.Mesh(g, twinWallMat); m.renderOrder = 6; TWIN.add(m);
      }
    }
    // blocks: their footprints raised to their height, the top edge bevelled
    {
      const L = [];
      for (const b of BLOCKS) {
        // clockwise in (x, z), so the faces below look outward
        let poly = b.poly.slice(), ar = 0;
        for (let i = 0; i < poly.length; i++) { const q = poly[(i + 1) % poly.length]; ar += poly[i][0] * q[1] - q[0] * poly[i][1]; }
        if (ar > 0) poly = poly.reverse();
        const h = Math.max(0.02, b.h), bv = Math.min(0.03, h / 4), n = poly.length, cxm = poly.reduce((s, p) => s + p[0], 0) / n, czm = poly.reduce((s, p) => s + p[1], 0) / n;
        const inset = poly.map(p => { const dx = cxm - p[0], dz = czm - p[1], l = Math.hypot(dx, dz) || 1; return [p[0] + dx / l * Math.min(bv, l * 0.5), p[1] + dz / l * Math.min(bv, l * 0.5)]; });
        const P = [], N = [], I = [];
        for (let i = 0; i < n; i++) {
          const j = (i + 1) % n, a = poly[i], c = poly[j], ex = c[0] - a[0], ez = c[1] - a[1], l = Math.hypot(ex, ez) || 1, nx = -ez / l, nz = ex / l, s = P.length / 3;
          P.push(a[0], 0, a[1], c[0], 0, c[1], c[0], h - bv, c[1], a[0], h - bv, a[1]);
          for (let k = 0; k < 4; k++) N.push(nx, 0, nz);
          P.push(a[0], h - bv, a[1], c[0], h - bv, c[1], inset[j][0], h, inset[j][1], inset[i][0], h, inset[i][1]);
          for (let k = 0; k < 4; k++) N.push(nx * 0.7, 0.7, nz * 0.7);
          I.push(s, s + 1, s + 2, s, s + 2, s + 3, s + 4, s + 5, s + 6, s + 4, s + 6, s + 7);
        }
        const s = P.length / 3;
        for (const p of inset) { P.push(p[0], h, p[1]); N.push(0, 1, 0); }
        for (const t of THREE.ShapeUtils.triangulateShape(inset.map(p => new THREE.Vector2(p[0], p[1])), [])) {
          const a = inset[t[0]], bb = inset[t[1]], c = inset[t[2]], cy = (bb[1] - a[1]) * (c[0] - a[0]) - (bb[0] - a[0]) * (c[1] - a[1]);
          if (cy >= 0) I.push(s + t[0], s + t[1], s + t[2]); else I.push(s + t[0], s + t[2], s + t[1]);
        }
        const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('normal', new THREE.Float32BufferAttribute(N, 3)); g.setIndex(I);
        L.push(g);
      }
      if (L.length) { const m = new THREE.Mesh(merge(L), twinBlockMat); m.renderOrder = 2; TWIN.add(m); }
    }
    for (const o of TWIN.children) o.frustumCulled = false;
  }

  // ---------------------------------------------------------------- the room as the robots know it: colliders and a grid
  let ROOM = null, WALLS = [], BLOCKS = [], SG = new Float64Array(0), NSG = 0, SGA = new Float64Array(0), NSGA = 0;
  let FCX = 0, FCZ = 0, LONG = null, LOOP = [], LOOPL = [], LOOPT = 0, PAUSES = [];
  const NAV = { x0: 0, z0: 0, cs: 0.1, nx: 1, nz: 1, clr: new Float32Array(1), clrA: new Float32Array(1) };
  const cellOf = (x, z) => { const i = Math.floor((x - NAV.x0) / NAV.cs), j = Math.floor((z - NAV.z0) / NAV.cs); return i < 0 || j < 0 || i >= NAV.nx || j >= NAV.nz ? -1 : j * NAV.nx + i; };
  const ccx = c => NAV.x0 + (c % NAV.nx + 0.5) * NAV.cs, ccz = c => NAV.z0 + (Math.floor(c / NAV.nx) + 0.5) * NAV.cs;
  const clrAt = (x, z, A) => { const c = cellOf(x, z); return c < 0 ? -1 : (A || NAV.clr)[c]; };
  // bilinear clearance (for smooth wall avoidance and the floor's shade)
  function clrLerp(x, z, A) {
    const fx = (x - NAV.x0) / NAV.cs - 0.5, fz = (z - NAV.z0) / NAV.cs - 0.5, i = clamp(Math.floor(fx), 0, NAV.nx - 2), j = clamp(Math.floor(fz), 0, NAV.nz - 2), u = clamp(fx - i, 0, 1), v = clamp(fz - j, 0, 1), c = j * NAV.nx + i;
    return (A[c] * (1 - u) + A[c + 1] * u) * (1 - v) + (A[c + NAV.nx] * (1 - u) + A[c + NAV.nx + 1] * u) * v;
  }
  const onFloor = (x, z) => inPoly(ROOM.floor, x, z);
  const inBlock = (x, z, robot) => BLOCKS.some(b => (!robot || !b.pass) && inPoly(b.poly, x, z));
  function normRoom(r) {
    const o = { kind: r.kind || 'real', floor: (r.floor || []).map(p => [+p[0], +p[1]]), walls: (r.walls || []).map(w => [+w[0], +w[1], +w[2], +w[3], +(w[4] || 2.5)]),
      blocks: (r.blocks || []).filter(b => b && b.poly && b.poly.length > 2).map(b => ({ poly: b.poly.map(p => [+p[0], +p[1]]), h: +(b.h || 0.5), under: +(b.under || 0), label: b.label || '' })) };
    // no floor (or one too small or thin to be a floor) but walls: the hull of the wall ends; floor but no walls: its
    // edges, 2.5 m high (nearly straight runs of edges make one wall); neither: a 4 m x 5 m box round the origin
    const bad = F => F.length < 3 || area(F) < 1;
    if (bad(o.floor)) o.floor = o.walls.length ? hull(o.walls.flatMap(w => [[w[0], w[1]], [w[2], w[3]]])) : [];
    if (bad(o.floor)) { o.floor = [[-2, -2.5], [2, -2.5], [2, 2.5], [-2, 2.5]]; o.walls = []; }
    if (!o.walls.length) {
      const F = o.floor, n = F.length, dir = i => { const p = F[i], q = F[(i + 1) % n]; return Math.atan2(q[1] - p[1], q[0] - p[0]); };
      const bend = i => Math.abs(((dir(i) - dir((i + n - 1) % n)) % TAU + TAU + Math.PI) % TAU - Math.PI);
      let s0 = 0; for (let i = 0; i < n; i++) if (bend(i) > bend(s0)) s0 = i;   // start at the sharpest corner
      let a = F[s0];
      for (let k = 1; k <= n; k++) {
        const i = (s0 + k) % n;
        if (k < n && bend(i) < 0.05) continue;   // under 3 degrees: the same wall goes on
        o.walls.push([a[0], a[1], F[i][0], F[i][1], 2.5]); a = F[i];
      }
    }
    return o;
  }
  function area(P) { let a = 0; for (let i = 0; i < P.length; i++) { const p = P[i], q = P[(i + 1) % P.length]; a += p[0] * q[1] - q[0] * p[1]; } return Math.abs(a) / 2; }
  function hull(pts) {
    const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
    for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
    for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
    return lo.slice(0, -1).concat(up.slice(0, -1));
  }

  // the room as a key, to the centimetre: a headset reports the same room again and again
  const roomKey = o => JSON.stringify([o.kind, o.floor, o.walls, o.blocks.map(b => [b.poly, b.h, b.under])], (k, v) => typeof v === 'number' ? Math.round(v * 100) : v);
  let ROOMKEY = '';
  function setRoom(room, fallback) {
    const nr = normRoom(room), key = roomKey(nr);
    if (key === ROOMKEY && !MAP.move) return;   // nothing new: keep the cleaned floor, the paths and the avatar's way
    const keep = ROOM && ROOM.kind === nr.kind;   // the same kind of room, refined: the cleaned floor carries over
    ROOM = nr;
    const F = ROOM.floor;
    let x0 = Infinity, x1 = -Infinity, z0 = Infinity, z1 = -Infinity;
    for (const p of F) { x0 = Math.min(x0, p[0]); x1 = Math.max(x1, p[0]); z0 = Math.min(z0, p[1]); z1 = Math.max(z1, p[1]); }
    FCX = (x0 + x1) / 2; FCZ = (z0 + z1) / 2;
    // the side of an edge the floor is on
    const inward = (ax, az, bx, bz) => {
      const ex = bx - ax, ez = bz - az, l = Math.hypot(ex, ez) || 1, mx = (ax + bx) / 2, mz = (az + bz) / 2;
      let nx = -ez / l, nz = ex / l;
      const a = onFloor(mx + nx * 0.05, mz + nz * 0.05), b = onFloor(mx - nx * 0.05, mz - nz * 0.05);
      if ((!a && b) || (a === b && (FCX - mx) * nx + (FCZ - mz) * nz < 0)) { nx = -nx; nz = -nz; }
      return [nx, nz, l, a && b];
    };
    // a wall with floor on both sides (a partition) holds robots on whichever side they are
    WALLS = ROOM.walls.map(w => { const [nx, nz, len, two] = inward(w[0], w[1], w[2], w[3]); return { ax: w[0], az: w[1], bx: w[2], bz: w[3], h: w[4], nx, nz, len, two }; });
    BLOCKS = ROOM.blocks.map(b => Object.assign({ pass: b.under > 0.12 }, b));
    // colliders: [ax, az, bx, bz, nx, nz, wall, kind] - walls (kind 0; 3 two-sided), floor edges (1), block edges (2)
    const S = [], SA = [];
    WALLS.forEach((w, k) => { S.push(w.ax, w.az, w.bx, w.bz, w.nx, w.nz, k, w.two ? 3 : 0); SA.push(w.ax, w.az, w.bx, w.bz, w.nx, w.nz, k, w.two ? 3 : 0); });
    F.forEach((p, i) => { const q = F[(i + 1) % F.length], [nx, nz] = inward(p[0], p[1], q[0], q[1]); S.push(p[0], p[1], q[0], q[1], nx, nz, -1, 1); SA.push(p[0], p[1], q[0], q[1], nx, nz, -1, 1); });
    for (const b of BLOCKS) b.poly.forEach((p, i) => {
      const q = b.poly[(i + 1) % b.poly.length], ex = q[0] - p[0], ez = q[1] - p[1], l = Math.hypot(ex, ez) || 1, mx = (p[0] + q[0]) / 2, mz = (p[1] + q[1]) / 2;
      let nx = -ez / l, nz = ex / l; if (inPoly(b.poly, mx + nx * 0.01, mz + nz * 0.01)) { nx = -nx; nz = -nz; }
      if (!b.pass) S.push(p[0], p[1], q[0], q[1], nx, nz, -1, 2);
      SA.push(p[0], p[1], q[0], q[1], nx, nz, -1, 2);
    });
    SG = new Float64Array(S); NSG = S.length / 8; SGA = new Float64Array(SA); NSGA = SA.length / 8;
    // the grid: clearance (distance to the nearest collider; -1 off the floor or inside furniture) for robots and for you
    const cs = Math.max(0.1, (x1 - x0) / 140, (z1 - z0) / 140);
    Object.assign(NAV, { cs, x0: x0 - cs, z0: z0 - cs, nx: Math.ceil((x1 - x0) / cs) + 2, nz: Math.ceil((z1 - z0) / cs) + 2 });
    const n = NAV.nx * NAV.nz;
    NAV.clr = new Float32Array(n); NAV.clrA = new Float32Array(n);
    // clearance up to 1.2 m (all that is ever asked): each collider marks only the cells near it
    const CAP = 1.2;
    for (let c = 0; c < n; c++) {
      const x = ccx(c), z = ccz(c);
      if (!onFloor(x, z)) { NAV.clr[c] = NAV.clrA[c] = -1; continue; }
      NAV.clr[c] = inBlock(x, z, true) ? -1 : CAP;
      NAV.clrA[c] = inBlock(x, z, false) ? -1 : CAP;
    }
    const splat = (A, m, out) => {
      for (let k = 0; k < m; k++) {
        const o = k * 8, ax = A[o], az = A[o + 1], bx = A[o + 2], bz = A[o + 3];
        const i0 = Math.max(0, Math.floor((Math.min(ax, bx) - CAP - NAV.x0) / cs)), i1 = Math.min(NAV.nx - 1, Math.floor((Math.max(ax, bx) + CAP - NAV.x0) / cs));
        const j0 = Math.max(0, Math.floor((Math.min(az, bz) - CAP - NAV.z0) / cs)), j1 = Math.min(NAV.nz - 1, Math.floor((Math.max(az, bz) + CAP - NAV.z0) / cs));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
          const c = j * NAV.nx + i; if (out[c] <= 0) continue;
          const e = segDist(NAV.x0 + (i + 0.5) * cs, NAV.z0 + (j + 0.5) * cs, ax, az, bx, bz); if (e < out[c]) out[c] = e;
        }
      }
    };
    splat(SG, NSG, NAV.clr); splat(SGA, NSGA, NAV.clrA);
    // nowhere a robot fits (a sliver of a floor): a box room instead, and this room is not tried again
    if (!fallback && !NAV.clr.some(v => v >= RR + 0.05)) { setRoom({ kind: 'box' }, true); ROOMKEY = key; return; }
    ROOMKEY = key;
    FIELDS.length = 0; PF.at = -9; PF.cell = -2;
    buildMap(x0, x1, z0, z1, keep);
    buildTwin();
    lighting(ROOM.kind);
    MODEL.visible = ROOM.kind === 'model';
    // the longest wall carries the dock and the label
    LONG = WALLS.reduce((a, w) => (!a || w.len > a.len + 0.01 ? w : a), null);
    for (let k = 0; k < MAXW; k++) { CUT[k] = k < WALLS.length ? WALLS[k].h + 0.2 : 9; uCut.value[k] = CUT[k]; }
    // the stroll: the model room's own path; elsewhere a loop inside the floor
    if (ROOM.kind === 'model') { LOOP = LOOP_MODEL; PAUSES = LOOP_PAUSE; }
    else {
      LOOP = []; PAUSES = [2, 6];
      for (let i = 0; i < 8; i++) { const a = i / 8 * TAU; LOOP.push([FCX + Math.cos(a) * (x1 - x0) * 0.3, FCZ + Math.sin(a) * (z1 - z0) * 0.3]); }
    }
    buildLoop();
    // the scan sweeps out to the furthest corner and up the walls
    SCAN.r = 1;
    for (const w of WALLS) SCAN.r = Math.max(SCAN.r, Math.hypot(w.ax - FCX, w.az - FCZ) + w.h, Math.hypot(w.bx - FCX, w.bz - FCZ) + w.h);
    SCAN.r += 1.5;
    // robots, you and the crumbs that are now off the floor come back onto it
    for (let i = 0; i < MAXN; i++) if (LIVE[i]) putInside(i);
    if (clrAt(AV.x, AV.z, NAV.clrA) < RA) { const p = nearestFree(AV.x, AV.z, NAV.clrA, RA + 0.02); AV.x = p[0]; AV.z = p[1]; }
    AV.tx = null;
    for (const pl of PILES) if (pl && !onFloor(pl.x, pl.z)) dropPile(pl);
    for (const pl of PILES) if (pl) pl.F = null;
    slotsFor(N);
    if (RULE === 0) assignSlots();
  }
  // the nearest point with at least 'min' clearance (a cell's middle, or the point itself)
  function nearestFree(x, z, A, min) {
    if (clrAt(x, z, A) >= min) return [x, z];
    let best = -1, bd = Infinity;
    for (let c = 0; c < A.length; c++) if (A[c] >= min) { const d = (ccx(c) - x) ** 2 + (ccz(c) - z) ** 2; if (d < bd) { bd = d; best = c; } }
    return best < 0 ? [FCX, FCZ] : [ccx(best), ccz(best)];
  }
  function putInside(i) {
    if (isFinite(X[i]) && isFinite(Z[i]) && clrAt(X[i], Z[i]) >= 0.2 && onFloor(X[i], Z[i])) return;
    const p = nearestFree(X[i], Z[i], NAV.clr, 0.21); X[i] = p[0]; Z[i] = p[1];
  }

  // the dust map over the room's bounding box
  // (keep: what was cleaned stays cleaned where there is still floor, moved by a recentre's shift if there was one)
  function buildMap(x0, x1, z0, z1, keep) {
    const cs = Math.max(0.025, (x1 - x0) / 256, (z1 - z0) / 256), w = Math.ceil((x1 - x0) / cs / 4) * 4, h = Math.ceil((z1 - z0) / cs);
    const old = keep && MAP.data ? { D: MAP.data, w: MAP.w, h: MAP.h, x0: MAP.x0, z0: MAP.z0, cs: MAP.cs } : null, mv = MAP.move;
    Object.assign(MAP, { cs, w, h, x0, z0, done: 0, count: 0, dirty: true, age: 9, move: null });
    MAP.data = new Uint8Array(w * h * 4);
    for (let j = 0; j < h; j++) for (let i = 0; i < w; i++) {
      const x = x0 + (i + 0.5) * cs, z = z0 + (j + 0.5) * cs, o = (j * w + i) * 4;
      const fl = onFloor(x, z), cnt = fl && !inBlock(x, z, true);
      const c = fl ? clrLerp(x, z, NAV.clrA) : 0;
      MAP.data[o + 1] = Math.round(255 * smooth(c / 0.45));
      MAP.data[o + 2] = cnt ? 255 : 0; MAP.data[o + 3] = 255;
      if (cnt) MAP.count++;
      if (old && fl) {
        let ox = x, oz = z;
        if (mv) { const dx = x - mv[2], dz = z - mv[3]; ox = mv[0] * dx + mv[1] * dz; oz = -mv[1] * dx + mv[0] * dz; }
        const oi = Math.floor((ox - old.x0) / old.cs), oj = Math.floor((oz - old.z0) / old.cs);
        if (oi >= 0 && oj >= 0 && oi < old.w && oj < old.h && old.D[(oj * old.w + oi) * 4]) { MAP.data[o] = 255; if (cnt) MAP.done++; }
      }
    }
    if (MAP.tex) MAP.tex.dispose();
    MAP.tex = new THREE.DataTexture(MAP.data, w, h, THREE.RGBAFormat);
    MAP.tex.magFilter = MAP.tex.minFilter = THREE.LinearFilter; MAP.tex.generateMipmaps = false;
    MAP.tex.wrapS = MAP.tex.wrapT = THREE.ClampToEdgeWrapping; MAP.tex.needsUpdate = true;
    uMap.value = MAP.tex; uBox.value.set(x0, z0, 1 / (w * cs), 1 / (h * cs));
  }
  // a robot cleans a disc 0.16 m across its middle
  function clean(x, z) {
    const r = 0.16, cs = MAP.cs, i0 = Math.max(0, Math.floor((x - r - MAP.x0) / cs)), i1 = Math.min(MAP.w - 1, Math.floor((x + r - MAP.x0) / cs)),
      j0 = Math.max(0, Math.floor((z - r - MAP.z0) / cs)), j1 = Math.min(MAP.h - 1, Math.floor((z + r - MAP.z0) / cs)), D = MAP.data;
    for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) {
      const dx = MAP.x0 + (i + 0.5) * cs - x, dz = MAP.z0 + (j + 0.5) * cs - z, o = (j * MAP.w + i) * 4;
      if (dx * dx + dz * dz > r * r || D[o]) continue;
      D[o] = 255; MAP.dirty = true; if (D[o + 2]) MAP.done++;
    }
  }
  function dustAgain() { for (let o = 0; o < MAP.data.length; o += 4) MAP.data[o] = 0; MAP.done = 0; MAP.dirty = true; }

  // ---------------------------------------------------------------- paths: distance fields over the grid
  let HK = new Float32Array(1024), HV = new Int32Array(1024), HN = 0, HPK = 0;
  function hpush(k, v) {
    if (HN >= HK.length) { const a = new Float32Array(HK.length * 2), b = new Int32Array(HK.length * 2); a.set(HK); b.set(HV); HK = a; HV = b; }
    let i = HN++;
    while (i > 0) { const p = (i - 1) >> 1; if (HK[p] <= k) break; HK[i] = HK[p]; HV[i] = HV[p]; i = p; }
    HK[i] = k; HV[i] = v;
  }
  function hpop() {
    const v = HV[0]; HPK = HK[0]; HN--;
    if (HN > 0) {
      const lk = HK[HN], lv = HV[HN]; let i = 0;
      for (;;) { let c = 2 * i + 1; if (c >= HN) break; if (c + 1 < HN && HK[c + 1] < HK[c]) c++; if (HK[c] >= lk) break; HK[i] = HK[c]; HV[i] = HV[c]; i = c; }
      HK[i] = lk; HV[i] = lv;
    }
    return v;
  }
  // distances (m) from the seed cells through cells with at least 'min' clearance
  function field(seeds, A, min, out) {
    out = out && out.length === A.length ? out : new Float32Array(A.length);
    out.fill(Infinity); HN = 0;
    for (const s of seeds) if (s >= 0 && A[s] >= min && out[s] > 0) { out[s] = 0; hpush(0, s); }
    const nx = NAV.nx, nz = NAV.nz, cs = NAV.cs, dg = cs * Math.SQRT2;
    // distances are rounded as they are stored (Float32), or a cell whose stored value rounded up would be pushed
    // again on every visit and the heap would grow without end; the pop budget is a last guard
    let budget = 16 * A.length + 64;
    while (HN && budget--) {
      const c = hpop(), d = HPK;
      if (d > out[c]) continue;
      const i = c % nx, j = (c - i) / nx;
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        if (!di && !dj) continue;
        const ii = i + di, jj = j + dj;
        if (ii < 0 || jj < 0 || ii >= nx || jj >= nz) continue;
        const q = jj * nx + ii;
        if (A[q] < min || (di && dj && (A[j * nx + ii] < min || A[jj * nx + i] < min))) continue;
        const nd = Math.fround(d + (di && dj ? dg : cs));
        if (nd < out[q]) { out[q] = nd; hpush(nd, q); }
      }
    }
    return out;
  }
  // the seeds round a point: free cells within 'r', else the nearest free cell
  function seedsAt(x, z, A, min, r, into) {
    const out = into || [], k = Math.ceil(r / NAV.cs) + 1, c0 = cellOf(x, z);
    out.length = 0;
    const i0 = Math.floor((x - NAV.x0) / NAV.cs), j0 = Math.floor((z - NAV.z0) / NAV.cs);
    for (let j = j0 - k; j <= j0 + k; j++) for (let i = i0 - k; i <= i0 + k; i++) {
      if (i < 0 || j < 0 || i >= NAV.nx || j >= NAV.nz) continue;
      const c = j * NAV.nx + i; if (A[c] >= min && (ccx(c) - x) ** 2 + (ccz(c) - z) ** 2 <= r * r) out.push(c);
    }
    if (!out.length) { const p = nearestFree(x, z, A, min); out.push(cellOf(p[0], p[1])); }
    if (c0 >= 0 && A[c0] >= min && out.indexOf(c0) < 0) out.push(c0);
    return out;
  }
  // a straight way: every point along it has the clearance (the first and last bits may be tight)
  function los(x0, z0, x1, z1, A, min, skip) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz), n = Math.ceil(L / 0.05);
    for (let k = 1; k < n; k++) { const u = k / n, s = u * L; if (s < 0.12 || L - s < (skip || 0)) continue; if (clrAt(x0 + dx * u, z0 + dz * u, A) < min) return false; }
    return true;
  }
  // where to steer for a goal behind obstacles: down the field, as far along as can be seen
  function descend(F, A, min, x, z, out) {
    const c = cellOf(x, z); if (c < 0) return false;
    let cur = -1, cv = Infinity;
    const i0 = c % NAV.nx, j0 = (c - i0) / NAV.nx;
    for (let j = j0 - 1; j <= j0 + 1; j++) for (let i = i0 - 1; i <= i0 + 1; i++) { if (i < 0 || j < 0 || i >= NAV.nx || j >= NAV.nz) continue; const q = j * NAV.nx + i; if (F[q] < cv) { cv = F[q]; cur = q; } }
    if (!isFinite(cv)) return false;
    let aim = cur;
    for (let k = 0; k < 20; k++) {
      const i = cur % NAV.nx, j = (cur - i) / NAV.nx; let nb = -1, nv = F[cur];
      for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) { const ii = i + di, jj = j + dj; if (ii < 0 || jj < 0 || ii >= NAV.nx || jj >= NAV.nz) continue; const q = jj * NAV.nx + ii; if (F[q] < nv) { nv = F[q]; nb = q; } }
      if (nb < 0) break;
      cur = nb;
      if (los(x, z, ccx(cur), ccz(cur), A, min)) aim = cur;
    }
    out[0] = ccx(aim); out[1] = ccz(aim);
    return true;
  }
  const FIELDS = [];   // cached fields to fixed goals (dock, piles)
  const PF = { F: null, at: -9, cell: -2, seeds: [] };   // the field to the player

  // ---------------------------------------------------------------- the player: you, or the avatar walking for you
  const AV = { x: 0.65, z: -0.3, h: -2.2, v: 0, w: 0, show: true, ext: false, tx: null, tz: null, F: null, aim: [0, 0], nt: 0, direct: true,
    s: 0, onLoop: false, pause: 0, look: 0, ph: 0, amp: 0, bob: 0, eyeY: 1.6, vx: 0, vz: 0 };
  const PL = { x: AV.x, z: AV.z, vx: 0, vz: 0, ix: 0, iz: 0, yaw: AV.h };   // where the robots think you are
  const EYE = [3.1, 6.6, 4.4];       // the viewer's eye (see)
  function buildLoop() {
    // a smooth closed path (Catmull-Rom through the points), sampled every 5 cm, with the distance along it
    const P = LOOP, n = P.length, out = [];
    for (let i = 0; i < n; i++) {
      const p0 = P[(i - 1 + n) % n], p1 = P[i], p2 = P[(i + 1) % n], p3 = P[(i + 2) % n];
      for (let k = 0; k < 20; k++) {
        const t = k / 20, t2 = t * t, t3 = t2 * t;
        const f = (a, b, c, d) => 0.5 * (2 * b + (-a + c) * t + (2 * a - 5 * b + 4 * c - d) * t2 + (-a + 3 * b - 3 * c + d) * t3);
        out.push([f(p0[0], p1[0], p2[0], p3[0]), f(p0[1], p1[1], p2[1], p3[1]), k === 0 ? i : -1]);
      }
    }
    LOOPL = [0];
    for (let i = 1; i <= out.length; i++) LOOPL.push(LOOPL[i - 1] + Math.hypot(out[i % out.length][0] - out[i - 1][0], out[i % out.length][1] - out[i - 1][1]));
    LOOPT = LOOPL[out.length]; LOOP.pts = out;
    PAUSES.at = PAUSES.map(k => LOOPL[k * 20]);
  }
  function loopAt(s, out) {
    const P = LOOP.pts, n = P.length; s = ((s % LOOPT) + LOOPT) % LOOPT;
    let lo = 0, hi = n; while (hi - lo > 1) { const m = (lo + hi) >> 1; if (LOOPL[m] <= s) lo = m; else hi = m; }
    const u = (s - LOOPL[lo]) / (LOOPL[lo + 1] - LOOPL[lo] || 1), a = P[lo], b = P[(lo + 1) % n];
    out[0] = a[0] + (b[0] - a[0]) * u; out[1] = a[1] + (b[1] - a[1]) * u; return out;
  }
  function loopNear(x, z, s0, span) {   // the distance along the loop of its point nearest (x, z) (near s0 if given)
    const P = LOOP.pts; let best = 0, bd = Infinity;
    for (let i = 0; i < P.length; i++) {
      if (s0 !== undefined) { let ds = LOOPL[i] - s0; ds -= LOOPT * Math.round(ds / LOOPT); if (ds < -0.4 || ds > span) continue; }
      const d = (P[i][0] - x) ** 2 + (P[i][1] - z) ** 2; if (d < bd) { bd = d; best = i; }
    }
    return LOOPL[best];
  }
  const _a2 = [0, 0];
  function stepAvatar(h) {
    if (AV.ext) return;
    let gx = null, gz = null, vmax = 0, stop = 0;
    if (AV.tx !== null) {   // sent somewhere: there by the shortest way
      AV.nt -= h;
      const d = Math.hypot(AV.tx - AV.x, AV.tz - AV.z);
      if (AV.nt <= 0) { AV.nt = 0.1; AV.direct = los(AV.x, AV.z, AV.tx, AV.tz, NAV.clrA, RA + 0.01); if (!AV.direct && !descend(AV.F, NAV.clrA, RA + 0.01, AV.x, AV.z, AV.aim)) AV.direct = true; }
      if (AV.direct) { gx = AV.tx; gz = AV.tz; } else { gx = AV.aim[0]; gz = AV.aim[1]; }
      vmax = 1.1; stop = d;
      if (d < 0.04 && Math.abs(AV.v) < 0.05) AV.tx = null;
    } else if (WALK && LOOP.pts) {   // a stroll round the room, stopping twice to look about
      if (!AV.onLoop) { AV.s = loopNear(AV.x, AV.z); AV.onLoop = true; }
      AV.s = loopNear(AV.x, AV.z, AV.s, 1.2);
      if (AV.pause > 0) { AV.pause -= h; AV.look += h; }
      else {
        for (const ps of PAUSES.at) { let ds = ps - AV.s; ds -= LOOPT * Math.round(ds / LOOPT); if (ds > 0 && ds < 0.05 && AV.lastPause !== ps) { AV.pause = 1.6; AV.look = 0; AV.lastPause = ps; } }
        loopAt(AV.s + 0.55, _a2); gx = _a2[0]; gz = _a2[1]; vmax = 0.46; stop = 9;
      }
    } else AV.onLoop = false;
    let vd = 0, wd = 0, polite = 1;
    AV.ix = AV.iz = 0;
    if (gx !== null) {
      // step round robots in the way, as you would; wait for one that cannot move
      let dx = gx - AV.x, dz = gz - AV.z; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
      let sx = 0, sz = 0;
      for (let i = 0; i < N; i++) {
        if (LIVE[i] !== 1) continue;
        const ex = X[i] - AV.x, ez = Z[i] - AV.z, e = Math.hypot(ex, ez) || 1, ahead = (ex * dx + ez * dz) / e;
        if (e > 1.0 || ahead < 0.2 || e > dl + 0.3) continue;
        const sd = ex * -dz + ez * dx >= 0 ? -1 : 1, w = (1 - e) * ahead;
        sx += -dz * sd * w; sz += dx * sd * w;
        if (ahead > 0.6) polite = Math.min(polite, PIN[i] ? smooth((e - 0.44) / 0.3) : Math.max(0.3, smooth((e - 0.44) / 0.3)));
      }
      AV.ix = dx * vmax; AV.iz = dz * vmax;   // where it means to go (robots make way for that, even while it waits)
      dx += sx * 1.6; dz += sz * 1.6;
      const err = wrap(Math.atan2(dz, dx) - AV.h);
      wd = clamp(err * 5, -4, 4);
      vd = Math.min(vmax * Math.max(0.15, Math.cos(err)) * (Math.abs(err) > 1.6 && AV.v < 0.2 ? 0 : 1), Math.sqrt(2 * 1.6 * Math.max(0, stop)), 0.2 + 2.5 * stop);
    } else if (AV.pause > 0) wd = 0.9 * Math.sin(AV.look * 2.2);   // looking about
    vd *= polite;
    AV.v += clamp(vd - AV.v, -2.2 * h, 1.4 * h);
    AV.w += clamp(wd - AV.w, -14 * h, 14 * h);
    AV.h += AV.w * h;
    const ox = AV.x, oz = AV.z;
    AV.x += Math.cos(AV.h) * AV.v * h; AV.z += Math.sin(AV.h) * AV.v * h;
    // slide along walls and furniture
    for (let it = 0; it < 2; it++) for (let k = 0; k < NSGA; k++) pushOut(AV, SGA, k, RA);
    if (clrAt(AV.x, AV.z, NAV.clrA) < 0.1) { const p = nearestFree(AV.x, AV.z, NAV.clrA, RA + 0.02); AV.x = p[0]; AV.z = p[1]; }
    const sp = Math.hypot(AV.x - ox, AV.z - oz) / h;
    AV.vx = (AV.x - ox) / h; AV.vz = (AV.z - oz) / h;
    AV.ph += sp * h / 0.36 * Math.PI; AV.amp += (smooth(sp / 0.35) - AV.amp) * Math.min(1, h * 6);
    PL.x = AV.x; PL.z = AV.z;
  }
  // push a disc (o.x, o.z) of radius r out of collider k; returns the normal when it touched
  const PUSH = [0, 0, 0];
  function pushOut(o, A, k, r) {
    const b = k * 8, ax = A[b], az = A[b + 1], ex = A[b + 2] - ax, ez = A[b + 3] - az, l = ex * ex + ez * ez;
    let u = l > 0 ? ((o.x - ax) * ex + (o.z - az) * ez) / l : 0; u = u < 0 ? 0 : u > 1 ? 1 : u;
    const qx = ax + ex * u, qz = az + ez * u, dx = o.x - qx, dz = o.z - qz, d2 = dx * dx + dz * dz;
    if (d2 >= r * r) return false;
    const side = dx * A[b + 4] + dz * A[b + 5];
    let nx, nz, d = Math.sqrt(d2);
    if (d < 1e-6 || (side < 0 && u > 0 && u < 1 && A[b + 7] !== 3)) { nx = A[b + 4]; nz = A[b + 5]; o.x = qx + nx * r; o.z = qz + nz * r; }
    else { nx = dx / d; nz = dz / d; o.x = qx + nx * r; o.z = qz + nz * r; }
    PUSH[0] = nx; PUSH[1] = nz; PUSH[2] = u;
    return true;
  }

  // ---------------------------------------------------------------- robots: state
  const X = new Float64Array(MAXN), Z = new Float64Array(MAXN), H = new Float64Array(MAXN), V = new Float64Array(MAXN), W = new Float64Array(MAXN);
  const MODE = new Uint8Array(MAXN), AFTER = new Uint8Array(MAXN), TM = new Float64Array(MAXN), TH = new Float64Array(MAXN), BD = new Float64Array(MAXN);
  const AX = new Float64Array(MAXN), AZ = new Float64Array(MAXN), NT = new Float64Array(MAXN), DIRECT = new Uint8Array(MAXN), TURNING = new Uint8Array(MAXN);
  const SPT = new Float64Array(MAXN), SPD = new Float64Array(MAXN), DIST = new Float64Array(MAXN), SPIN = new Float64Array(MAXN), WAIT = new Float64Array(MAXN);
  const SQ = new Float64Array(MAXN), SQT = new Float64Array(MAXN), JOY = new Float64Array(MAXN), BLT = new Float64Array(MAXN), BLK = new Float64Array(MAXN), LID = new Float64Array(MAXN);
  const PUX = new Float64Array(MAXN), PUY = new Float64Array(MAXN), GLT = new Float64Array(MAXN), GLA = new Float64Array(MAXN), GLOW = new Float64Array(MAXN), FLASH = new Float64Array(MAXN);
  const WHY = new Int8Array(MAXN).fill(-1), BLOCKER = new Int8Array(MAXN).fill(-1), PIN = new Uint8Array(MAXN), PRES = new Float64Array(MAXN), LIVE = new Uint8Array(MAXN), PILE = new Int8Array(MAXN).fill(-1), SLOT = new Int16Array(MAXN).fill(-1);
  const GX = new Float64Array(MAXN), GZ = new Float64Array(MAXN), LX = new Float64Array(MAXN), LZ = new Float64Array(MAXN), BRA = new Float64Array(MAXN), BRS = new Float64Array(MAXN), ERR = new Float64Array(MAXN), WANT = new Float64Array(MAXN), LASTB = new Float64Array(MAXN);
  const TRX = new Float32Array(MAXN * TL), TRZ = new Float32Array(MAXN * TL), TRH = new Int16Array(MAXN), TRC = new Int16Array(MAXN);
  const M_DRIVE = 0, M_BACK = 1, M_TURN = 2, M_ESC = 3, M_SPIRAL = 4, M_REST = 5;
  for (let i = 0; i < MAXN; i++) {
    SPD[i] = 0.94 + R() * 0.12; DIST[i] = 0.65 + 0.042 * i + R() * 0.03; SPT[i] = 12 + R() * 25; SPIN[i] = R() < 0.5 ? -1 : 1;
    BLT[i] = 1 + R() * 4; GLT[i] = 2 + R() * 6; LID[i] = 0.4; LASTB[i] = -9;
  }
  let N = 0, RULE = 1, WALK = false, BUMPS = 0, simT = 0, tLast = null, dusts = 0, crumbsN = 0;
  const OBJ = { x: 0, z: 0 };
  const SLOTS = [];
  function trailPush(i) { const k = (TRH[i] + 1) % TL; TRX[i * TL + k] = X[i]; TRZ[i * TL + k] = Z[i]; TRH[i] = k; TRC[i] = Math.min(TL, TRC[i] + 1); }
  function trailReset(i) { TRC[i] = 0; TRH[i] = 0; trailPush(i); }
  // the point 'dist' back along robot j's path
  function trailPoint(j, dist, out) {
    let px = X[j], pz = Z[j], acc = 0;
    for (let n = 0; n < TRC[j]; n++) {
      const k = ((TRH[j] - n) % TL + TL) % TL, qx = TRX[j * TL + k], qz = TRZ[j * TL + k], d = Math.hypot(qx - px, qz - pz);
      if (acc + d >= dist && d > 1e-6) { const u = (dist - acc) / d; out[0] = px + (qx - px) * u; out[1] = pz + (qz - pz) * u; return out; }
      acc += d; px = qx; pz = qz;
    }
    out[0] = px; out[1] = pz; return out;
  }

  // the dock: a row of places along the longest wall, 0.3 m from it, 0.42 m apart; when that wall is full the row
  // goes on along the walls nearest it (rows behind one another would block the way in)
  function slotsFor(n) {
    SLOTS.length = 0;
    if (!LONG) return;
    const lm = [(LONG.ax + LONG.bx) / 2, (LONG.az + LONG.bz) / 2];
    const order = WALLS.slice().sort((a, b) => (a === LONG ? -1 : b === LONG ? 1 : Math.hypot((a.ax + a.bx) / 2 - lm[0], (a.az + a.bz) / 2 - lm[1]) - Math.hypot((b.ax + b.bx) / 2 - lm[0], (b.az + b.bz) / 2 - lm[1])));
    order.forEach((w, row) => {
      if (SLOTS.length >= n) return;
      const ux = (w.bx - w.ax) / w.len, uz = (w.bz - w.az) / w.len, runs = [];
      let s0 = null;
      const okAt = s => {
        const x = w.ax + ux * s + w.nx * 0.3, z = w.az + uz * s + w.nz * 0.3;
        return clrAt(x, z) >= 0.22 && onFloor(x, z) && !inBlock(x, z, true) && SLOTS.every(q => (q.x - x) ** 2 + (q.z - z) ** 2 >= 0.42 * 0.42 - 1e-6);
      };
      for (let s = 0.15; s <= w.len - 0.15 + 1e-6; s += 0.02) {
        const ok = okAt(s), last = s + 0.02 > w.len - 0.15 + 1e-6;
        if (ok && s0 === null) s0 = s;
        if ((!ok || last) && s0 !== null) { runs.push([s0, ok ? s : s - 0.02]); s0 = null; }
      }
      runs.sort((a, b) => Math.abs((a[0] + a[1]) / 2 - w.len / 2) - Math.abs((b[0] + b[1]) / 2 - w.len / 2));
      for (const [a, b] of runs) {
        const cap = Math.floor((b - a) / 0.42 + 1e-6) + 1, k = Math.min(n - SLOTS.length, cap); if (k <= 0) continue;
        const mid = clamp(w.len / 2, a + (k - 1) * 0.21, b - (k - 1) * 0.21);
        for (let j = 0; j < k; j++) { const s = mid + (j - (k - 1) / 2) * 0.42; SLOTS.push({ x: w.ax + ux * s + w.nx * 0.3, z: w.az + uz * s + w.nz * 0.3, row, s, h: Math.atan2(w.nz, w.nx) }); }
      }
    });
    // not enough wall: the rest anywhere open
    for (let tries = 0; SLOTS.length < n && tries < 400; tries++) {
      const p = nearestFree(FCX + (R() - 0.5) * 3, FCZ + (R() - 0.5) * 3, NAV.clr, 0.3);
      if (SLOTS.every(q => (q.x - p[0]) ** 2 + (q.z - p[1]) ** 2 >= 0.42 * 0.42)) SLOTS.push({ x: p[0], z: p[1], row: 99, s: 0, h: Math.atan2(FCZ - p[1], FCX - p[0]) });
    }
    while (SLOTS.length < n) SLOTS.push(Object.assign({}, SLOTS[SLOTS.length - 1] || { x: FCX, z: FCZ, row: 99, s: 0, h: 0 }));
  }
  // each robot to a place at the dock, in the order they stand round the room, so their ways in do not cross
  function assignSlots() {
    slotsFor(N);
    SLOT.fill(-1);
    const live = []; for (let i = 0; i < N; i++) if (LIVE[i] === 1) live.push(i);
    if (!live.length) return;
    const ang = (x, z) => Math.atan2(z - FCZ, x - FCX);
    const rs = live.slice().sort((a, b) => ang(X[a], Z[a]) - ang(X[b], Z[b]));
    const ss = SLOTS.map((q, k) => k).slice(0, Math.max(live.length, 0)).sort((a, b) => ang(SLOTS[a].x, SLOTS[a].z) - ang(SLOTS[b].x, SLOTS[b].z));
    let best = 0, bc = Infinity;
    for (let k = 0; k < rs.length; k++) {
      let c = 0; for (let j = 0; j < rs.length; j++) { const r = rs[(j + k) % rs.length], q = SLOTS[ss[j]]; c += Math.hypot(X[r] - q.x, Z[r] - q.z); }
      if (c < bc) { bc = c; best = k; }
    }
    for (let j = 0; j < rs.length; j++) SLOT[rs[(j + best) % rs.length]] = ss[j];
  }
  function spawn(i) {
    if (!SLOTS[i]) slotsFor(Math.max(N, i + 1));
    const s = SLOTS[Math.min(i, SLOTS.length - 1)];
    let x = s.x, z = s.z;
    for (let j = 0; j < MAXN; j++) if (j !== i && LIVE[j] && (X[j] - x) ** 2 + (Z[j] - z) ** 2 < 0.4 * 0.4) {   // taken: the nearest open spot
      let best = null, bd = Infinity;
      for (let c = 0; c < NAV.clr.length; c++) {
        if (NAV.clr[c] < 0.22) continue;
        const cx = ccx(c), cz = ccz(c); let ok = true;
        for (let q = 0; q < MAXN && ok; q++) if (q !== i && LIVE[q] && (X[q] - cx) ** 2 + (Z[q] - cz) ** 2 < 0.4 * 0.4) ok = false;
        const d = (cx - s.x) ** 2 + (cz - s.z) ** 2; if (ok && d < bd) { bd = d; best = [cx, cz]; }
      }
      if (best) { x = best[0]; z = best[1]; }
      break;
    }
    X[i] = x; Z[i] = z; H[i] = s.h; V[i] = W[i] = 0; MODE[i] = M_REST; LIVE[i] = 1; PRES[i] = Math.min(PRES[i], 0.01); PILE[i] = -1;
    LX[i] = x; LZ[i] = z; trailReset(i); NT[i] = 0;
  }
  function setCount(n) {
    if (n === N) return;
    const old = N; N = n;
    slotsFor(N);
    for (let i = 0; i < MAXN; i++) {
      if (i < N && LIVE[i] !== 1) spawn(i);
      if (i >= N && LIVE[i] === 1) { LIVE[i] = 2; PILE[i] = -1; }   // leaving: shrinks away
    }
    if (RULE === 0 || old === 0) assignSlots();
  }

  // ---------------------------------------------------------------- robots: behaviour
  const ACC = 1.2, DEC = 2.0, ALPHA = 12, WMAX = 2.8;
  // turn rate for a heading error: as fast as allowed, but able to stop in time (no overshoot)
  const turnFor = e => { const a = Math.abs(e); return Math.sign(e) * Math.min(WMAX, 6 * a, Math.sqrt(2 * ALPHA * 0.8 * a)); };
  const VW = [0, 0], DD = [0, 0];   // the wanted speed and turn rate; a wanted direction
  // bend a wanted direction d round walls and furniture close by, so a robot slides past them instead of bumping
  function avoid(x, z, d) {
    const c = clrLerp(x, z, NAV.clr); if (c > 0.34) return;
    const e = 0.05, gx = clrLerp(x + e, z, NAV.clr) - clrLerp(x - e, z, NAV.clr), gz = clrLerp(x, z + e, NAV.clr) - clrLerp(x, z - e, NAV.clr), gl = Math.hypot(gx, gz);
    if (gl < 1e-6) return;
    const nx = gx / gl, nz = gz / gl, wk = smooth((0.34 - c) / 0.14), into = d[0] * nx + d[1] * nz;
    if (into < 0) { d[0] -= into * nx * wk; d[1] -= into * nz * wk; }
  }
  function seek(i, ax, az, vmax, stop, sepK, forward, lead) {
    GX[i] = ax; GZ[i] = az;
    let dx = ax - X[i], dz = az - Z[i]; const dl = Math.hypot(dx, dz) || 1; dx /= dl; dz /= dl;
    if (sepK) {   // keep clear of others within 0.45 m
      let sx = 0, sz = 0;
      for (let j = 0; j < N; j++) {
        if (j === i || !LIVE[j] || (forward >= 0 && (j === forward))) continue;
        const ex = X[i] - X[j], ez = Z[i] - Z[j], e2 = ex * ex + ez * ez;
        if (e2 < 0.45 * 0.45 && e2 > 1e-8) { const e = Math.sqrt(e2), f = (0.45 - e) / 0.45 / e; sx += ex * f; sz += ez * f; }
      }
      dx += sx * sepK; dz += sz * sepK;
    }
    if (lead === undefined || forward >= 0) {   // going somewhere other than to you: round your feet
      const ex = X[i] - PL.x, ez = Z[i] - PL.z, e = Math.hypot(ex, ez);
      if (e < 0.75 && e > 1e-3) { const f = 1.5 * (0.75 - e) / 0.33 / e; dx += ex * f; dz += ez * f; }
    }
    DD[0] = dx; DD[1] = dz; avoid(X[i], Z[i], DD); dx = DD[0]; dz = DD[1];
    const err = wrap(Math.atan2(dz, dx) - H[i]); ERR[i] = err;
    VW[1] = turnFor(err);
    const l = Math.max(0, lead || 0), st = Math.max(0, stop);
    VW[0] = Math.min(vmax * Math.max(0, Math.cos(err)), Math.sqrt(l * l + 1.8 * st), l + 2.8 * st + 0.03);
  }
  function face(i, hd) {   // turn on the spot towards a heading, with a little slack so it settles
    const err = wrap(hd - H[i]); ERR[i] = err;
    if (Math.abs(err) > 0.35) TURNING[i] = 1; else if (Math.abs(err) < 0.06) TURNING[i] = 0;
    VW[0] = 0; VW[1] = TURNING[i] ? turnFor(err) : 0;
  }
  // slow down behind a robot that is in the way (not for bumping rules)
  function blockedAhead(i, skip) {
    const fx = Math.cos(H[i]), fz = Math.sin(H[i]); let k = 1, b = -1;
    for (let j = 0; j < N; j++) {
      if (j === i || !LIVE[j] || j === skip) continue;
      const ex = X[j] - X[i], ez = Z[j] - Z[i], e = Math.hypot(ex, ez);
      if (e < 0.52 && (ex * fx + ez * fz) > e * 0.5) { const q = smooth((e - 0.36) / 0.16); if (q < k) { k = q; b = j; } }
    }
    BLOCKER[i] = k < 0.3 ? b : -1;   // the one in the way (asked to step aside)
    return k;
  }
  // steer to a goal: straight there when the way is clear, else down the field (refreshed ten times a second)
  const AIM = [0, 0];
  function aimFor(i, F, gx, gz) {
    if (NT[i] <= 0) {
      NT[i] = 0.1;
      DIRECT[i] = !F || los(X[i], Z[i], gx, gz, NAV.clr, RR + 0.015, 0.3) ? 1 : 0;
      if (!DIRECT[i]) { if (descend(F, NAV.clr, RR + 0.015, X[i], Z[i], AIM)) { AX[i] = AIM[0]; AZ[i] = AIM[1]; } else DIRECT[i] = 1; }
    }
    if (DIRECT[i]) { OBJ.x = gx; OBJ.z = gz; } else { OBJ.x = AX[i]; OBJ.z = AZ[i]; }
    return OBJ;
  }
  function playerField() {
    const c = cellOf(PL.x, PL.z);
    if (PF.F && (c === PF.cell || simT - PF.at < 0.1)) return PF.F;
    PF.F = field(seedsAt(PL.x, PL.z, NAV.clr, RR + 0.03, 0.4, PF.seeds), NAV.clr, RR + 0.03, PF.F); PF.cell = c; PF.at = simT;
    return PF.F;
  }
  function goalField(key, x, z) {
    let f = FIELDS.find(o => o.key === key);
    if (!f) { f = { key, F: field(seedsAt(x, z, NAV.clr, RR + 0.03, 0.15), NAV.clr, RR + 0.03) }; FIELDS.push(f); if (FIELDS.length > 40) FIELDS.shift(); }
    return f.F;
  }
  function bump(i, nx, nz, why) {
    if (simT - LASTB[i] < 0.25 && MODE[i] !== M_DRIVE && MODE[i] !== M_SPIRAL && MODE[i] !== M_REST) return;
    BUMPS++; LASTB[i] = simT; WHY[i] = why;
    SQ[i] = 0.15; SQT[i] = 0.32; FLASH[i] = 1;
    V[i] = Math.min(V[i], 0);
    const base = Math.atan2(nz, nx), crumbs = PILE[i] >= 0;
    MODE[i] = M_BACK; BD[i] = 0.04; TM[i] = 0;
    if ((RULE === 1 || RULE === 4) && !crumbs) {
      // a random new heading within 80 degrees of the way out; tried again (up to six times) if there is no room along it
      let best = base, bs = -Infinity;
      for (let k = 0; k < 6; k++) {
        const a = base + (R() * 2 - 1) * 1.396, px = X[i] + Math.cos(a) * 0.4, pz = Z[i] + Math.sin(a) * 0.4;
        let sc = Math.min(clrLerp(px, pz, NAV.clr), 0.3);
        for (let j = 0; j < N; j++) if (j !== i && LIVE[j]) sc = Math.min(sc, Math.hypot(X[j] - px, Z[j] - pz) - 0.17);
        if (sc > bs) { bs = sc; best = a; }
        if (sc >= 0.22) break;
      }
      TH[i] = best; AFTER[i] = M_DRIVE;
    }
    else {   // towards the side nearer its goal, then a short drive before it steers for the goal again
      const g = Math.atan2(GZ[i] - Z[i], GX[i] - X[i]), a1 = base + 1.2, a2 = base - 1.2;
      TH[i] = Math.abs(wrap(a1 - g)) < Math.abs(wrap(a2 - g)) ? a1 : a2; AFTER[i] = M_ESC;
    }
  }
  const _t2 = [0, 0];
  const bouncy = i => PILE[i] < 0 && (RULE === 1 || RULE === 4);
  function think(i, h) {
    VW[0] = 0; VW[1] = 0; WANT[i] = 0;
    BLOCKER[i] = -1;
    const m = MODE[i];
    if (m === M_BACK) { VW[0] = -0.12; BD[i] -= Math.abs(V[i]) * h; TM[i] += h; if (BD[i] <= 0 || TM[i] > 0.7) { MODE[i] = M_TURN; TM[i] = 0; } WANT[i] = 1; return; }
    if (m === M_TURN) {
      const err = wrap(TH[i] - H[i]); ERR[i] = err; VW[1] = turnFor(err); TM[i] += h; WANT[i] = 1;
      if ((Math.abs(err) < 0.05 && Math.abs(W[i]) < 0.5) || TM[i] > 2.5) { MODE[i] = AFTER[i]; TM[i] = 0; }
      return;
    }
    if (m === M_ESC) {
      const err = wrap(TH[i] - H[i]); ERR[i] = err; VW[1] = turnFor(err); VW[0] = 0.28 * Math.max(0, Math.cos(err)); TM[i] += h; WANT[i] = 1;
      if (TM[i] > 0.4) { MODE[i] = M_DRIVE; TM[i] = 0; }
      return;
    }
    // another robot wants to come through: step aside, off its way
    if (!bouncy(i) && m !== M_BACK) for (let j = 0; j < N; j++) {
      if (j === i || BLOCKER[j] !== i || LIVE[j] !== 1) continue;
      const fx = Math.cos(H[j]), fz = Math.sin(H[j]), ex = X[i] - X[j], ez = Z[i] - Z[j], sd = ex * -fz + ez * fx >= 0 ? 1 : -1;
      DD[0] = -fz * sd + fx * 0.25; DD[1] = fx * sd + fz * 0.25; avoid(X[i], Z[i], DD);
      const err = wrap(Math.atan2(DD[1], DD[0]) - H[i]); ERR[i] = err;
      if (MODE[i] === M_REST) MODE[i] = M_DRIVE;
      VW[1] = turnFor(err); VW[0] = 0.3 * Math.max(0, Math.cos(err)) * blockedAhead(i, j); BLOCKER[i] = -1; WANT[i] = 0;
      return;
    }
    // you walk at it: out of your way, to the side (and a little ahead)
    {
      const ex = X[i] - PL.x, ez = Z[i] - PL.z, ed = Math.hypot(ex, ez) || 1, pv = Math.hypot(PL.ix, PL.iz);
      if (ed < 0.9 && pv > 0.2 && (PL.ix * ex + PL.iz * ez) / (pv * ed) > 0.5) {
        const px = -PL.iz / pv, pz = PL.ix / pv, sd = Math.sign(px * ex + pz * ez) || 1;
        DD[0] = px * sd + PL.ix / pv * 0.3 + ex / ed * 0.3; DD[1] = pz * sd + PL.iz / pv * 0.3 + ez / ed * 0.3; avoid(X[i], Z[i], DD);
        const err = wrap(Math.atan2(DD[1], DD[0]) - H[i]); ERR[i] = err;
        if (MODE[i] === M_REST || MODE[i] === M_SPIRAL) MODE[i] = M_DRIVE;
        VW[1] = turnFor(err); VW[0] = 0.45 * SPD[i] * Math.max(0, Math.cos(err)) * blockedAhead(i, -1); WANT[i] = VW[0] > 0.05 ? 1 : 0;
        return;
      }
    }
    // crumbs come first, whatever the rule
    if (PILE[i] >= 0) {
      const pl = PILES[PILE[i]];
      if (!pl || !pl.left) PILE[i] = -1;
      else {
        if (MODE[i] === M_REST || MODE[i] === M_SPIRAL) MODE[i] = M_DRIVE;
        let bx = pl.x, bz = pl.z;
        const dp = Math.hypot(pl.x - X[i], pl.z - Z[i]);
        if (dp < 0.6) { let bd = Infinity; for (let k = 0; k < NBIT; k++) { const q = pl.slot * NBIT + k; if (!CAL[q]) continue; const d = (CX[q] - X[i]) ** 2 + (CZ[q] - Z[i]) ** 2; if (d < bd) { bd = d; bx = CX[q]; bz = CZ[q]; } } }
        if (!pl.F) pl.F = field(seedsAt(pl.x, pl.z, NAV.clr, RR + 0.03, 0.3), NAV.clr, RR + 0.03);
        const c = cellOf(X[i], Z[i]);
        if (c >= 0 && !isFinite(pl.F[c]) && NAV.clr[c] >= RR + 0.03) { PILE[i] = -1; }   // cannot get there
        else {
          const o = aimFor(i, pl.F, bx, bz);
          seek(i, o.x, o.z, 0.38 * SPD[i], 9, 0.5, -1); VW[0] *= Math.max(0.25, blockedAhead(i, -1)); WANT[i] = 1;
          return;
        }
      }
    }
    if (RULE === 1 || (RULE === 4 && Math.hypot(PL.x - X[i], PL.z - Z[i]) > 1.8)) {   // bump and turn (keep away: slowly, while you are far)
      const slow = RULE === 4 ? 0.5 : 1;
      if (m === M_REST) MODE[i] = M_DRIVE;
      if (RULE === 1 && MODE[i] === M_DRIVE) { SPT[i] -= h; if (SPT[i] < 0) { if (clrAt(X[i], Z[i]) > 0.85 && blockedAhead(i, -1) > 0.99) { MODE[i] = M_SPIRAL; TM[i] = 0; SPIN[i] = -SPIN[i]; } SPT[i] = 20 + R() * 20; } }
      if (MODE[i] === M_SPIRAL) {
        TM[i] += h; const r = 0.12 + 0.05 * TM[i];
        VW[0] = 0.24 * SPD[i]; VW[1] = clamp(SPIN[i] * VW[0] / r, -WMAX, WMAX); WANT[i] = 1;
        if (TM[i] > 9 || RULE !== 1) MODE[i] = M_DRIVE;
        return;
      }
      VW[0] = 0.35 * slow * SPD[i]; VW[1] = 0; ERR[i] = 0; WANT[i] = 1;
      return;
    }
    if (MODE[i] === M_SPIRAL) MODE[i] = M_DRIVE;
    if (RULE === 4) {   // keep away: away from you, sliding along walls rather than into them
      if (m === M_REST) MODE[i] = M_DRIVE;
      const dx = X[i] - PL.x, dz = Z[i] - PL.z, d = Math.hypot(dx, dz) || 1;
      let fx = dx / d, fz = dz / d;
      const c = clrLerp(X[i], Z[i], NAV.clr), e = 0.06, gx = clrLerp(X[i] + e, Z[i], NAV.clr) - clrLerp(X[i] - e, Z[i], NAV.clr), gz = clrLerp(X[i], Z[i] + e, NAV.clr) - clrLerp(X[i], Z[i] - e, NAV.clr), gl = Math.hypot(gx, gz) || 1;
      const wk = smooth((0.55 - c) / 0.3), nx = gx / gl, nz = gz / gl;
      fx += nx * wk * 1.2; fz += nz * wk * 1.2;
      const into = fx * nx + fz * nz; if (into < 0) { fx -= into * nx * wk; fz -= into * nz * wk; }
      const fl = Math.hypot(fx, fz);
      if (fl < 0.25) { face(i, Math.atan2(dz, dx)); return; }   // cornered: stay, facing away
      const err = wrap(Math.atan2(fz, fx) - H[i]); ERR[i] = err;
      VW[1] = turnFor(err); VW[0] = 0.45 * SPD[i] * (0.65 + 0.35 * (1 - d / 1.8)) * Math.max(0, Math.cos(err)) * blockedAhead(i, -1); WANT[i] = VW[0] > 0.05 ? 1 : 0;
      return;
    }
    if (RULE === 0) {   // the dock
      const s = SLOTS[SLOT[i]];
      if (!s) { face(i, H[i]); return; }
      const dx = s.x - X[i], dz = s.z - Z[i], d = Math.hypot(dx, dz);
      if (m === M_REST) {
        if (d > 0.14) MODE[i] = M_DRIVE; else { face(i, s.h); return; }
      }
      if (d < 0.025) { MODE[i] = M_REST; TURNING[i] = 1; face(i, s.h); return; }
      // approach from the room side, through a point in front of the place; wait for the rows nearer the wall
      const ux = Math.cos(s.h), uz = Math.sin(s.h), along = -dx * ux - dz * uz, side = Math.abs(dx * uz - dz * ux);
      let gx = s.x, gz = s.z, stop = d;
      if (!(side < 0.1 && along > -0.05)) { gx = s.x + ux * 0.45; gz = s.z + uz * 0.45; stop = 9; }
      const o = aimFor(i, goalField('slot' + SLOT[i] + ':' + s.x.toFixed(2) + s.z.toFixed(2), gx, gz), gx, gz);
      seek(i, o.x, o.z, 0.35 * SPD[i], stop, 0.6, -1);
      const bk = blockedAhead(i, -1); VW[0] *= bk;
      if (bk < 0.05) { WAIT[i] += h; if (WAIT[i] > 2) { WAIT[i] = 0; bump(i, -Math.cos(H[i]), -Math.sin(H[i]), 3); } } else WAIT[i] = 0;
      if (stop < 0.03 && stop !== d) face(i, Math.atan2(s.z - Z[i], s.x - X[i]));
      WANT[i] = VW[0] > 0.02 || Math.abs(VW[1]) > 0.2 ? 1 : 0;
      return;
    }
    // follow you, or the one ahead (conga line)
    const chain = RULE === 3 && i > 0;
    if (chain) {
      const j = i - 1, dx = X[j] - X[i], dz = Z[j] - Z[i], dp = Math.hypot(dx, dz), want = 0.42;
      const lead = V[j] * (Math.cos(H[j]) * dx + Math.sin(H[j]) * dz) / (dp || 1);   // how fast the one ahead pulls away
      if (lead < -0.08 && dp < 0.65) {   // it is coming back this way: off its path, to the side
        const fx = Math.cos(H[j]), fz = Math.sin(H[j]), sd = (-dx) * -fz + (-dz) * fx >= 0 ? 1 : -1;
        DD[0] = -fz * sd + dx / (dp || 1) * -0.2; DD[1] = fx * sd + dz / (dp || 1) * -0.2; avoid(X[i], Z[i], DD);
        const err = wrap(Math.atan2(DD[1], DD[0]) - H[i]); ERR[i] = err;
        if (m === M_REST) MODE[i] = M_DRIVE;
        VW[1] = turnFor(err); VW[0] = 0.32 * Math.max(0, Math.cos(err)) * blockedAhead(i, j); BLOCKER[i] = -1; WANT[i] = 0;
        return;
      }
      if (m === M_REST) { if (dp > want + 0.14 || lead > 0.12) MODE[i] = M_DRIVE; else { face(i, Math.atan2(dz, dx)); return; } }
      if (dp < want + 0.03 && lead < 0.05) { MODE[i] = M_REST; face(i, Math.atan2(dz, dx)); return; }
      let o;
      if (dp > 1.0) o = aimFor(i, los(X[i], Z[i], X[j], Z[j], NAV.clr, RR + 0.015) ? null : playerField(), X[j], Z[j]);
      else { trailPoint(j, want, _t2); o = OBJ; OBJ.x = _t2[0]; OBJ.z = _t2[1]; }
      const e = dp - want;
      seek(i, o.x, o.z, (0.45 + 0.15 * smooth((e - 0.1) / 0.5)) * SPD[i], e, 0.35, j, lead);
      WANT[i] = 1;
      return;
    }
    const want = RULE === 3 ? 0.6 : DIST[i], dx = PL.x - X[i], dz = PL.z - Z[i], rho = Math.hypot(dx, dz), e = rho - want, toYou = Math.atan2(dz, dx);
    const lead = (PL.vx * dx + PL.vz * dz) / (rho || 1);
    if (m === M_REST) {
      TM[i] -= h;
      if ((e > 0.3 && TM[i] <= 0) || e < -0.18 || (lead > 0.15 && e > 0.05 && TM[i] <= 0)) MODE[i] = M_DRIVE;
      else { face(i, toYou); return; }
    }
    if (e < -0.12) {   // too close: back off, facing you; or, when you come at it, get out of the way
      const err = wrap(toYou - H[i]), coming = (AV.ext ? 0 : (AV.vx * -dx + AV.vz * -dz) / rho) > 0.15;
      if (Math.abs(err) < 1.2 && !coming && e > -0.35) { VW[1] = turnFor(err); VW[0] = -0.12 - 0.35 * clamp(-e - 0.12, 0, 0.25); ERR[i] = err; }
      else {
        // away from you and to the side you are passing
        let ax = -dx / rho, az = -dz / rho;
        if (coming) { const px = -AV.vz, pz = AV.vx, s = Math.sign(px * -dx + pz * -dz) || 1, pl = Math.hypot(px, pz) || 1; ax += px / pl * s * 0.9; az += pz / pl * s * 0.9; }
        const err2 = wrap(Math.atan2(az, ax) - H[i]); ERR[i] = err2; VW[1] = turnFor(err2); VW[0] = 0.4 * SPD[i] * Math.max(0, Math.cos(err2));
      }
      WANT[i] = 1;
      return;
    }
    if (e < 0.05 && lead < 0.08) { MODE[i] = M_REST; TM[i] = 0; face(i, toYou); return; }
    const o = aimFor(i, playerField(), PL.x, PL.z);
    seek(i, o.x, o.z, (0.45 + 0.15 * smooth((e - (RULE === 3 ? 0.1 : 0.4)) / (RULE === 3 ? 0.5 : 1.1))) * SPD[i], e, RULE === 3 ? 0.35 : 0.9, -1, lead);
    const bk = blockedAhead(i, RULE === 3 ? 1 : -1); VW[0] *= bk;   // the head of the line does not wait for its own follower
    if (bk < 0.1 && e < 2 && RULE === 2) { BLOCKER[i] = -1; MODE[i] = M_REST; TM[i] = 1; face(i, toYou); return; }   // queue behind the one in front, for a moment
    // the head of the line, boxed in by its own coil: after a moment, wriggle out sideways
    if (bk < 0.05) { WAIT[i] += h; if (WAIT[i] > 1.5) { WAIT[i] = 0; bump(i, -Math.cos(H[i]), -Math.sin(H[i]), 3); } } else WAIT[i] = 0;
    WANT[i] = 1;
  }

  // ---------------------------------------------------------------- crumbs
  const PILES = new Array(NPILE).fill(null), CX = new Float32Array(NPILE * NBIT), CZ = new Float32Array(NPILE * NBIT), CS = new Float32Array(NPILE * NBIT), CAL = new Uint8Array(NPILE * NBIT), CSC = new Float32Array(NPILE * NBIT);
  let pileAge = 0, lastPile = null;
  function dropPile(pl) {
    for (let k = 0; k < NBIT; k++) CAL[pl.slot * NBIT + k] = 0;
    for (let i = 0; i < MAXN; i++) if (PILE[i] === pl.slot) PILE[i] = -1;
    PILES[pl.slot] = null;
  }
  function spill(x, z) {
    if (!ROOM || !onFloor(x, z)) return false;
    const p = clrAt(x, z) >= 0.24 && !inBlock(x, z, true) ? [x, z] : nearestFree(x, z, NAV.clr, 0.24);
    // a free slot, or the oldest pile goes
    let slot = PILES.indexOf(null);
    if (slot < 0) { let ob = 0; for (let k = 1; k < NPILE; k++) if (PILES[k].age < PILES[ob].age) ob = k; dropPile(PILES[ob]); slot = ob; }
    const r = rng(1000 + pileAge * 7), n = 30 + Math.floor(r() * 11), pl = { slot, x: p[0], z: p[1], left: n, age: pileAge++, F: null, t: simT };
    for (let k = 0; k < NBIT; k++) {
      const q = slot * NBIT + k; CAL[q] = k < n ? 1 : 0; CSC[q] = 0;
      const a = r() * TAU, d = 0.2 * Math.pow(r(), 0.7);
      CX[q] = pl.x + Math.cos(a) * d; CZ[q] = pl.z + Math.sin(a) * d; CS[q] = 0.008 + r() * 0.012;
    }
    PILES[slot] = pl; lastPile = pl;
    // it draws the nearest one or two robots (by the way there)
    pl.F = field(seedsAt(pl.x, pl.z, NAV.clr, RR + 0.03, 0.3), NAV.clr, RR + 0.03);
    const cand = [];
    for (let i = 0; i < N; i++) { if (!LIVE[i] || LIVE[i] === 2 || PILE[i] >= 0) continue; const c = cellOf(X[i], Z[i]); let d = c >= 0 ? pl.F[c] : Infinity; if (!isFinite(d)) d = 50 + Math.hypot(X[i] - pl.x, Z[i] - pl.z); cand.push([d, i]); }
    cand.sort((a, b) => a[0] - b[0]);
    for (let k = 0; k < Math.min(N >= 3 ? 2 : 1, cand.length); k++) { const i = cand[k][1]; PILE[i] = slot; NT[i] = 0; if (MODE[i] === M_REST || MODE[i] === M_SPIRAL) MODE[i] = M_DRIVE; }
    return true;
  }
  // the story's piles: on open floor, 1-2 m from you, in front of you if possible (returns the spot, or null)
  function spillNear() {
    const yaw = AV.ext ? PL.yaw : AV.h;
    let best = null, bs = -Infinity;
    for (let k = 0; k < 60; k++) {
      const a = yaw + (R() - 0.5) * Math.PI * 1.6, d = 1 + R(), x = PL.x + Math.cos(a) * d, z = PL.z + Math.sin(a) * d;
      if (!onFloor(x, z)) continue;
      const c = clrAt(x, z); if (c < 0.3) continue;
      const sc = Math.min(c, 0.8) - Math.abs(wrap(a - yaw)) * 0.15;
      if (sc > bs) { bs = sc; best = [x, z]; }
    }
    if (!best) best = nearestFree(PL.x + Math.cos(yaw) * 1.3, PL.z + Math.sin(yaw) * 1.3, NAV.clr, 0.3);
    return spill(best[0], best[1]) ? best : null;
  }

  // ---------------------------------------------------------------- one step of the gang
  const RIPS = []; let ripK = 0;
  function ripple(w, u) { RIPS[ripK] = { w, u, t: simT }; ripK = (ripK + 1) % 8; }
  function step(h) {
    simT += h;
    stepAvatar(h);
    if (PL.lx !== undefined) { PL.vx += ((PL.x - PL.lx) / h - PL.vx) * Math.min(1, h * 8); PL.vz += ((PL.z - PL.lz) / h - PL.vz) * Math.min(1, h * 8); }
    PL.lx = PL.x; PL.lz = PL.z;
    // the way you are going: your steps in a headset; the avatar's intent on a screen
    if (AV.ext) { PL.ix = PL.vx; PL.iz = PL.vz; } else { PL.ix = Math.hypot(AV.ix, AV.iz) > Math.hypot(PL.vx, PL.vz) ? AV.ix : PL.vx; PL.iz = Math.hypot(AV.ix, AV.iz) > Math.hypot(PL.vx, PL.vz) ? AV.iz : PL.vz; }
    if (AV.ext) { /* the engine sets PL */ }
    for (let i = 0; i < MAXN; i++) {
      if (!LIVE[i]) continue;
      if (LIVE[i] === 2) { PRES[i] -= h / 0.35; if (PRES[i] <= 0) { PRES[i] = 0; LIVE[i] = 0; } continue; }
      PRES[i] = Math.min(1, PRES[i] + h / 0.45);
      NT[i] -= h;
      think(i, h);
      // differential drive: speed and turn rate eased towards what is wanted
      const vd = clamp(VW[0], -0.3, 0.6), wd = clamp(VW[1], -WMAX, WMAX), ac = Math.abs(vd) < Math.abs(V[i]) || vd * V[i] < 0 ? DEC : ACC;
      V[i] += clamp(vd - V[i], -ac * h, ac * h);
      W[i] += clamp(wd - W[i], -ALPHA * h, ALPHA * h);
      H[i] += W[i] * h;
      X[i] += Math.cos(H[i]) * V[i] * h; Z[i] += Math.sin(H[i]) * V[i] * h;
    }
    collide();
    for (let i = 0; i < N; i++) {
      if (LIVE[i] !== 1) continue;
      if ((X[i] - LX[i]) ** 2 + (Z[i] - LZ[i]) ** 2 > 0.012 * 0.012) { clean(X[i], Z[i]); LX[i] = X[i]; LZ[i] = Z[i]; }
      const k = TRH[i] + i * TL;
      if ((X[i] - TRX[k]) ** 2 + (Z[i] - TRZ[k]) ** 2 > 0.04 * 0.04) trailPush(i);
      eat(i);
    }
    // a robot whose numbers went bad (they should not) starts again at the dock rather than being lost for good
    for (let i = 0; i < MAXN; i++) if (LIVE[i] && !(isFinite(X[i]) && isFinite(Z[i]) && isFinite(H[i]) && isFinite(V[i]) && isFinite(W[i]))) {
      if (LIVE[i] === 1) spawn(i); else { LIVE[i] = 0; PRES[i] = 0; X[i] = Z[i] = H[i] = V[i] = W[i] = 0; }
    }
  }
  const O1 = { x: 0, z: 0 };
  const CROWD = new Uint8Array(MAXN);
  function collide() {
    // how many others are close: in a crowd, robots that are going somewhere jostle rather than bump and turn
    for (let i = 0; i < MAXN; i++) { CROWD[i] = 0; if (!LIVE[i]) continue; for (let j = 0; j < MAXN; j++) if (j !== i && LIVE[j] && (X[i] - X[j]) ** 2 + (Z[i] - Z[j]) ** 2 < 0.25) CROWD[i]++; }
    for (let it = 0; it < 3; it++) {
      // robot against robot: both give way
      for (let i = 0; i < MAXN; i++) {
        if (!LIVE[i] || PRES[i] < 0.3) continue;
        for (let j = i + 1; j < MAXN; j++) {
          if (!LIVE[j] || PRES[j] < 0.3) continue;
          const dx = X[i] - X[j], dz = Z[i] - Z[j], d2 = dx * dx + dz * dz, m = 2 * RR;
          if (d2 >= m * m) continue;
          const d = Math.sqrt(d2) || 1e-4, nx = d2 > 1e-10 ? dx / d : 1, nz = d2 > 1e-10 ? dz / d : 0, ov = m - d;
          // a robot at rest gives way less than one on the move
          const ri = (MODE[i] === M_REST ? 0.3 : 1) * (PIN[i] ? 0.05 : 1), rj = (MODE[j] === M_REST ? 0.3 : 1) * (PIN[j] ? 0.05 : 1), si = ri / (ri + rj);
          X[i] += nx * ov * si; Z[i] += nz * ov * si; X[j] -= nx * ov * (1 - si); Z[j] -= nz * ov * (1 - si);
          if (it === 0) {   // robots going somewhere only bump-and-turn when they meet another head on
            if (V[i] > 0.03 && -(nx * Math.cos(H[i]) + nz * Math.sin(H[i])) > (bouncy(i) ? 0.5 : 0.85) && (bouncy(i) || (V[i] > 0.15 && CROWD[i] < 2))) bump(i, nx, nz, 0);
            if (V[j] > 0.03 && (nx * Math.cos(H[j]) + nz * Math.sin(H[j])) > (bouncy(j) ? 0.5 : 0.85) && (bouncy(j) || (V[j] > 0.15 && CROWD[j] < 2))) bump(j, -nx, -nz, 0);
          }
        }
        // against you
        const dx = X[i] - PL.x, dz = Z[i] - PL.z, d2 = dx * dx + dz * dz, m = RR + RA;
        if (d2 < m * m) {
          const d = Math.sqrt(d2) || 1e-4, nx = dx / d, nz = dz / d;
          // a robot pressed against something fixed cannot give way: the avatar does (you, in a headset, cannot)
          let held = PIN[i];
          for (let j = 0; j < MAXN && !held; j++) if (j !== i && LIVE[j] && (X[j] - X[i]) ** 2 + (Z[j] - Z[i]) ** 2 < 0.355 * 0.355) held = 1;
          if (held && !AV.ext) { AV.x = PL.x = X[i] - nx * m; AV.z = PL.z = Z[i] - nz * m; }
          else { X[i] = PL.x + nx * m; Z[i] = PL.z + nz * m; }
          if (it === 0 && V[i] > 0.03 && -(nx * Math.cos(H[i]) + nz * Math.sin(H[i])) > 0.5) bump(i, nx, nz, 1);
        }
      }
      // against walls, floor edges and furniture (only near them: the grid knows where that is)
      for (let i = 0; i < MAXN; i++) {
        if (!LIVE[i]) continue;
        if (it === 0) PIN[i] = 0;
        if (clrAt(X[i], Z[i]) > RR + 0.09) continue;
        O1.x = X[i]; O1.z = Z[i];
        for (let k = 0; k < NSG; k++) {
          if (!pushOut(O1, SG, k, RR)) continue;
          PIN[i] = 1;   // pressed against something that does not move: the others give way
          if (it === 0 && V[i] > 0.02 && -(PUSH[0] * Math.cos(H[i]) + PUSH[1] * Math.sin(H[i])) > 0.2 && LIVE[i] === 1) {
            bump(i, PUSH[0], PUSH[1], 2);
            const w = SG[k * 8 + 6]; if (w >= 0) ripple(w, PUSH[2] * WALLS[w].len);
          }
        }
        X[i] = O1.x; Z[i] = O1.z;
      }
    }
    // never off the floor, never inside furniture
    for (let i = 0; i < MAXN; i++) if (LIVE[i] && clrAt(X[i], Z[i]) < 0.12 && (!onFloor(X[i], Z[i]) || inBlock(X[i], Z[i], true))) { const p = nearestFree(X[i], Z[i], NAV.clr, 0.2); X[i] = p[0]; Z[i] = p[1]; }
  }
  function eat(i) {
    for (const pl of PILES) {
      if (!pl || !pl.left || (X[i] - pl.x) ** 2 + (Z[i] - pl.z) ** 2 > 0.4 * 0.4) continue;
      for (let k = 0; k < NBIT; k++) {
        const q = pl.slot * NBIT + k;
        if (CAL[q] === 1 && (CX[q] - X[i]) ** 2 + (CZ[q] - Z[i]) ** 2 < 0.15 * 0.15) { CAL[q] = 2; pl.left--; JOY[i] = 0.6; }
      }
      if (!pl.left) { for (let j = 0; j < MAXN; j++) if (PILE[j] === pl.slot) PILE[j] = -1; pl.done = simT; }
    }
  }

  // ---------------------------------------------------------------- drawing the robots
  // body: a lathe from the underside up the side, the light ring round the top edge, the LED ring, the glossy top,
  // the button; parts: 0 body, 1 ring, 2 top, 3 button, 4 bumper, 5 LED
  function bodyGeo() {
    const prof = [[0, 0.012, 0], [0.145, 0.012, 0], [0.16, 0.016, 0], [0.167, 0.026, 0], [0.168, 0.06, 0], [0.166, 0.068, 0],
      [0.166, 0.068, 1], [0.161, 0.077, 1], [0.153, 0.084, 1], [0.143, 0.088, 1],
      [0.143, 0.088, 5], [0.138, 0.0893, 5], [0.129, 0.0893, 5],
      [0.129, 0.0893, 2], [0.1, 0.0905, 2], [0.06, 0.0915, 2], [0.036, 0.092, 2],
      [0.036, 0.092, 3], [0.033, 0.0955, 3], [0.026, 0.0975, 3], [0.0, 0.098, 3]];
    const body = prep(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 40));
    const np = prof.length, pa = new Float32Array(body.attributes.position.count);
    for (let v = 0; v < pa.length; v++) pa[v] = prof[v % np][2];
    body.setAttribute('aP', new THREE.BufferAttribute(pa, 1));
    const bp = [[0.169, 0.02], [0.1745, 0.026], [0.1755, 0.058], [0.17, 0.066]];
    const bump = prep(new THREE.LatheGeometry(bp.map(p => new THREE.Vector2(p[0], p[1])), 20, -1.62, 3.24));
    bump.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(bump.attributes.position.count).fill(4), 1));
    return merge([body, bump]);
  }
  // the face: a small sloped visor at the front of the top, where the eyes shine (uv: across, and up the slope)
  function visorGeo() {
    const NS = 12, rf = 0.142, rb = 0.088, y0 = 0.087, y1 = 0.117, hw = 0.066, P = [], UV = [], I = [];
    const at = (x, r, y) => [x, y, Math.sqrt(Math.max(r * r - x * x, 0))];
    const quad = (a, b, c, d, ua, ub, uc, ud) => { const s = P.length / 3; P.push(...a, ...b, ...c, ...d); UV.push(...ua, ...ub, ...uc, ...ud); I.push(s, s + 1, s + 2, s, s + 2, s + 3); };
    for (let k = 0; k < NS; k++) {
      const xa = -hw + 2 * hw * k / NS, xb = -hw + 2 * hw * (k + 1) / NS;
      quad(at(xa, rf, y0), at(xb, rf, y0), at(xb, rb, y1), at(xa, rb, y1), [k / NS, 0], [(k + 1) / NS, 0], [(k + 1) / NS, 1], [k / NS, 1]);
      quad(at(xb, rb, y1), at(xb, rb - 0.006, 0.089), at(xa, rb - 0.006, 0.089), at(xa, rb, y1), [0.5, -1], [0.5, -1], [0.5, -1], [0.5, -1]);
    }
    for (const s of [-1, 1]) {
      const f = at(s * hw, rf, y0), b = at(s * hw, rb, y1), c = at(s * hw, rb - 0.006, 0.089), st = P.length / 3;
      P.push(...f, ...b, ...c); UV.push(0.5, -1, 0.5, -1, 0.5, -1);
      if (s > 0) I.push(st, st + 2, st + 1); else I.push(st, st + 1, st + 2);
    }
    const g = new THREE.BufferGeometry(); g.setAttribute('position', new THREE.Float32BufferAttribute(P, 3)); g.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2)); g.setIndex(I);
    g.computeVertexNormals();
    return g;
  }
  // the side brush: a hub and three bristles
  function brushGeo() {
    const L = [prep(new THREE.CylinderGeometry(0.012, 0.012, 0.006, 10))];
    for (let k = 0; k < 3; k++) { const g = prep(new THREE.BoxGeometry(0.068, 0.0025, 0.004)); g.translate(0.036, 0, 0); g.rotateY(k * TAU / 3); L.push(g); }
    return merge(L);
  }
  const IA = new Float32Array(MAXN * 4), IB = new Float32Array(MAXN * 4), IC = new Float32Array(MAXN * 4), ID = new Float32Array(MAXN * 4);
  const aIA = new THREE.InstancedBufferAttribute(IA, 4), aIB = new THREE.InstancedBufferAttribute(IB, 4), aIC = new THREE.InstancedBufferAttribute(IC, 4), aID = new THREE.InstancedBufferAttribute(ID, 4);
  for (const a of [aIA, aIB, aIC, aID]) a.setUsage(THREE.DynamicDrawUsage);
  const INST = `
attribute vec4 iA, iB, iC, iD;
vec3 toSet(vec3 p) { float th = 1.5707963 - iA.z, c = cos(th), s = sin(th); return vec3(p.x * c + p.z * s + iA.x, p.y, -p.x * s + p.z * c + iA.y); }
vec3 dirToSet(vec3 n) { float th = 1.5707963 - iA.z, c = cos(th), s = sin(th); return vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c); }`;
  const inst = (g, names) => { const o = new THREE.InstancedBufferGeometry().copy(g); for (const k of names) o.setAttribute(k, { iA: aIA, iB: aIB, iC: aIC, iD: aID }[k]); o.instanceCount = 0; return o; };
  const bodyMat = mat({
    uniforms: Object.assign({ uA: set.uA }, LIT),
    vertexShader: LV + INST + `
attribute float aP; varying float vP; varying vec4 vB; varying vec3 vLoc;
void main() {
  vec3 p = position;
  if (aP > 3.5 && aP < 4.5) p.z -= iC.x * 0.012 * max(p.z / 0.17, 0.0);   // the bumper gives on a bump
  vLoc = p; vP = aP; vB = iB;
  setLight(toSet(p * iA.w), dirToSet(normal));
}`,
    fragmentShader: LF + `
varying float vP; varying vec4 vB; varying vec3 vLoc;
void main() {
  vec3 N = normalize(vNW), base, emit = vec3(0.0); float gloss, ao = 1.0;
  if (vP < 0.5) { base = vec3(0.1, 0.105, 0.12); gloss = 0.3; ao = 0.45 + 0.55 * smoothstep(0.012, 0.075, vLoc.y); }
  else if (vP < 1.5) { base = vec3(0.6, 0.62, 0.66); gloss = 0.65; }
  else if (vP < 2.5) { base = vec3(0.03, 0.032, 0.04); gloss = 1.0; }
  else if (vP < 3.5) { base = vec3(0.34, 0.35, 0.38); gloss = 0.6; float r = length(vLoc.xz); emit = vB.rgb * 0.5 * (1.0 - smoothstep(0.004, 0.007, abs(r - 0.017))) * vB.a; }
  else if (vP < 4.5) { base = vec3(0.3, 0.31, 0.34); gloss = 0.25; ao = 0.7 + 0.3 * smoothstep(0.02, 0.06, vLoc.y); }
  else { base = vec3(0.04); gloss = 0.3; emit = vB.rgb * (0.25 + 1.15 * vB.a); }
  vec3 c = shade(base, N, gloss, ao) + emit;
  if (vP > 1.5 && vP < 2.5) {   // the glossy top: a soft sheen of the room above, stronger at a glancing angle, fine circular brushing
    vec3 V = normalize(cameraPosition - vPW), Rf = reflect(-V, N);
    float fr = pow(1.0 - max(dot(N, V), 0.0), 3.0), r = length(vLoc.xz);
    c += vec3(0.15, 0.16, 0.18) * pow(max(dot(Rf, normalize(vUW)), 0.0), 2.0) * (0.25 + 0.75 * fr) * (0.92 + 0.08 * sin(r * 900.0));
    c += uKeyC * pow(max(dot(N, normalize(vKW + V)), 0.0), 24.0) * 0.12;
  }
  gl_FragColor = vec4(c, uA);
}`,
  });
  const visorMat = mat({
    uniforms: Object.assign({ uA: set.uA }, LIT),
    vertexShader: LV + INST + `
varying vec2 vUv; varying vec4 vB, vC, vD;
void main() { vUv = uv; vB = iB; vC = iC; vD = iD; setLight(toSet(position * iA.w), dirToSet(normal)); }`,
    fragmentShader: LF + `
varying vec2 vUv; varying vec4 vB, vC, vD;
float sdBox(vec2 p, vec2 b, float r) { vec2 d = abs(p) - b + r; return length(max(d, 0.0)) + min(max(d.x, d.y), 0.0) - r; }
float sdSeg(vec2 p, vec2 a, vec2 b) { vec2 pa = p - a, ba = b - a; float h = clamp(dot(pa, ba) / dot(ba, ba), 0.0, 1.0); return length(pa - ba * h); }
void main() {
  vec3 N = normalize(vNW);
  vec3 col = shade(vec3(0.015, 0.016, 0.02), N, 1.0, 1.0);
  if (vUv.y >= 0.0) {
    // two LED eyes (in metres on the face; +y up the slope). Open: rounded, the lid closing from the top;
    // squint: > <; joy: ^ ^. Pupils look where the robot is going (or at you).
    vec2 q = vec2((vUv.x - 0.5) * 0.132, (vUv.y - 0.5) * 0.062);
    float px = fwidth(q.x) * 1.2 + 1e-4, lit = 0.0, halo = 0.0, pup = 0.0, gl = 0.0, lid = vC.y;
    for (int k = 0; k < 2; k++) {
      float sd = k == 0 ? -1.0 : 1.0;
      vec2 e = q - vec2(sd * 0.029, 0.0);
      float hw = 0.0135, hh = 0.0165;
      // open: a rounded, slightly tall eye; closing, it becomes a smiling crescent (the eye less a copy of itself
      // moved up), so a sleepy robot looks content, not cross
      float eye = sdBox(e, vec2(hw, hh), 0.0125);
      float dOpen = max(eye, -sdBox(e - vec2(0.0, (1.0 - lid) * 2.25 * hh), vec2(hw, hh), 0.0125));
      vec2 m = vec2(e.x * -sd, e.y);
      float dSq = min(sdSeg(m, vec2(-0.009, 0.009), vec2(0.008, 0.0)), sdSeg(m, vec2(0.008, 0.0), vec2(-0.009, -0.009))) - 0.0032;
      float dJoy = max(abs(length(e - vec2(0.0, -0.008)) - 0.011) - 0.0033, -(e.y + 0.005));
      float d = mix(mix(dOpen, dSq, vC.z), dJoy, vC.w * (1.0 - vC.z));
      float a = 1.0 - smoothstep(-px, px, d);
      lit = max(lit, a); halo += exp(-max(d, 0.0) / 0.0035) * 0.5;
      // the pupil, with a glint; it hides as the eye closes
      vec2 pc = vec2(vD.x * 0.0058, vD.y * 0.0062);
      float show = a * (1.0 - smoothstep(0.15, 0.35, lid)) * (1.0 - vC.z) * (1.0 - vC.w), pd = length(e - pc);
      pup = max(pup, show * (1.0 - smoothstep(0.0068 - px, 0.0068 + px, pd)));
      gl = max(gl, show * (1.0 - smoothstep(0.0018 - px, 0.0018 + px, length(e - pc - vec2(0.0024, 0.0028)))));
    }
    vec3 ec = mix(vec3(0.9, 0.97, 1.0), vB.rgb, 0.1);
    col += mix(vB.rgb, vec3(1.0), 0.4) * min(halo, 1.0) * 0.4 * (1.0 - lit);
    col = mix(col, ec * 1.2, lit);
    col = mix(col, vec3(0.04, 0.05, 0.09), pup * 0.95);
    col = mix(col, vec3(1.0), gl);
  }
  gl_FragColor = vec4(col, uA);
}`,
  });
  const brushMat = mat({
    uniforms: Object.assign({ uA: set.uA }, LIT),
    vertexShader: LV + INST + `
void main() {
  float a = iD.z, c = cos(a), s = sin(a);
  vec3 p = vec3(position.x * c + position.z * s, position.y, -position.x * s + position.z * c) + vec3(-0.112, 0.006, 0.098);
  vec3 n = vec3(normal.x * c + normal.z * s, normal.y, -normal.x * s + normal.z * c);
  setLight(toSet(p * iA.w), dirToSet(n));
}`,
    fragmentShader: LF + `void main() { gl_FragColor = vec4(shade(vec3(0.16, 0.16, 0.18), normalize(vNW), 0.2, 1.0), uA); }`,
  });
  const bodyMesh = new THREE.Mesh(inst(bodyGeo(), ['iA', 'iB', 'iC']), bodyMat);
  const visorMesh = new THREE.Mesh(inst(visorGeo(), ['iA', 'iB', 'iC', 'iD']), visorMat);
  const brushMesh = new THREE.Mesh(inst(brushGeo(), ['iA', 'iD']), brushMat);
  for (const m of [bodyMesh, visorMesh, brushMesh]) { m.frustumCulled = false; m.renderOrder = 3; set.group.add(m); }
  const RGEO = [bodyMesh.geometry, visorMesh.geometry, brushMesh.geometry];

  // soft shadows under the robots and the avatar
  const SA = new Float32Array((MAXN + 1) * 4), aSA = new THREE.InstancedBufferAttribute(SA, 4); aSA.setUsage(THREE.DynamicDrawUsage);
  const shGeo = new THREE.InstancedBufferGeometry().copy(prep(new THREE.PlaneGeometry(2, 2).rotateX(-HALF)));
  shGeo.setAttribute('sA', aSA); shGeo.instanceCount = 0;
  const shMat = mat({
    depthWrite: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4,
    uniforms: { uA: set.uA },
    vertexShader: `attribute vec4 sA; varying vec2 vQ; varying float vS;
void main() { vQ = position.xz; vS = sA.w; gl_Position = projectionMatrix * modelViewMatrix * vec4(position.x * sA.z + sA.x, 0.002, position.z * sA.z + sA.y, 1.0); }`,
    fragmentShader: `uniform float uA; varying vec2 vQ; varying float vS;
void main() { float r = length(vQ); float a = pow(1.0 - smoothstep(0.25, 1.0, r), 1.6) * vS; if (a < 0.004) discard; gl_FragColor = vec4(0.03, 0.02, 0.015, a * uA); }`,
  });
  const shMesh = new THREE.Mesh(shGeo, shMat); shMesh.frustumCulled = false; shMesh.renderOrder = 1; set.group.add(shMesh);

  // crumbs: little golden bits
  const CA = new Float32Array(NPILE * NBIT * 4), CB = new Float32Array(NPILE * NBIT * 4), aCA = new THREE.InstancedBufferAttribute(CA, 4), aCB = new THREE.InstancedBufferAttribute(CB, 4);
  aCA.setUsage(THREE.DynamicDrawUsage); aCB.setUsage(THREE.DynamicDrawUsage);
  const crGeo = new THREE.InstancedBufferGeometry().copy(prep(new THREE.IcosahedronGeometry(1, 0)));
  crGeo.setAttribute('cA', aCA); crGeo.setAttribute('cB', aCB); crGeo.instanceCount = NPILE * NBIT;
  const crMat = mat({
    uniforms: Object.assign({ uA: set.uA }, LIT),
    vertexShader: LV + `attribute vec4 cA, cB; varying float vSh;
void main() {
  float a = cB.x, c = cos(a), s = sin(a);
  vec3 p = position * vec3(1.0, 0.6, 0.8), n = normal;
  p = vec3(p.x * c + p.z * s, p.y, -p.x * s + p.z * c); n = vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c);
  vSh = cB.y;
  setLight(p * cA.w * cB.z + vec3(cA.x, cA.w * 0.5 * cB.z, cA.z), n);
}`,
    fragmentShader: LF + `varying float vSh; void main() { gl_FragColor = vec4(shade(mix(vec3(0.7, 0.45, 0.2), vec3(0.95, 0.75, 0.42), vSh), normalize(vNW), 0.3, 1.0) + vec3(0.06, 0.04, 0.0), uA); }`,
  });
  const crMesh = new THREE.Mesh(crGeo, crMat); crMesh.frustumCulled = false; crMesh.renderOrder = 3; set.group.add(crMesh);

  // the network: a line from each robot to whom it follows, a bright dot at the follower's end; pulses run along it
  const NLS = 10, lnGeo = K.linesGeo(MAXN * NLS), lnMat = K.lines(set, { vertex: 'vA *= 0.4 + 0.6 * smoothstep(0.55, 1.0, fract(aT * 1.2 - uTime * 0.8));' });
  const lnMesh = new THREE.LineSegments(lnGeo, lnMat); lnMesh.frustumCulled = false; lnMesh.renderOrder = 7; set.group.add(lnMesh);
  for (let i = 0; i < MAXN * NLS * 2; i++) lnGeo.attributes.aCol.array.set([0.3, 0.85, 1.0], i * 3);
  const NB = 40, dtGeo = K.pointsGeo(MAXN * (NB + 1)), dtMat = K.points(set, {}), dtMesh = new THREE.Points(dtGeo, dtMat);
  dtMesh.frustumCulled = false; dtMesh.renderOrder = 7; set.group.add(dtMesh);
  for (let i = 0; i < MAXN * (NB + 1); i++) { dtGeo.attributes.aCol.array.set([0.4, 0.9, 1.0], i * 3); dtGeo.attributes.aSize.array[i] = i < MAXN ? 0.07 : 0.042; }

  // ---------------------------------------------------------------- the avatar
  function avatarGeo() {
    const L = [], tag = (g, p) => { prep(g); g.setAttribute('aP', new THREE.BufferAttribute(new Float32Array(g.attributes.position.count).fill(p), 1)); return g; };
    const prof = [[0, 0.1], [0.1, 0.1], [0.135, 0.16], [0.155, 0.42], [0.17, 0.8], [0.185, 1.04], [0.19, 1.2], [0.18, 1.29], [0.14, 1.36], [0.075, 1.41], [0.05, 1.44], [0, 1.45]];
    L.push(tag(new THREE.LatheGeometry(prof.map(p => new THREE.Vector2(p[0], p[1])), 28), 0));
    L.push(tag(new THREE.SphereGeometry(0.125, 24, 16).translate(0, 1.565, 0), 1));
    for (const s of [1, -1]) {   // arms hang from the shoulders
      const g = new THREE.CylinderGeometry(0.042, 0.038, 0.46, 10).translate(0, -0.23, 0);
      const e = new THREE.SphereGeometry(0.04, 10, 8).translate(0, -0.46, 0), t = new THREE.SphereGeometry(0.044, 10, 8);
      for (const q of [g, e, t]) { q.rotateZ(s * 0.08); q.translate(s * 0.215, 1.31, 0); L.push(tag(q, s > 0 ? 2 : 3)); }
    }
    for (const s of [1, -1]) L.push(tag(rbox(0.1, 0.07, 0.2, 0.035, 2).translate(s * 0.085, 0.035, 0.03), s > 0 ? 4 : 5));
    return merge(L);
  }
  const uAv = { value: new THREE.Vector4(0, 0, 0, 0) }, uGait = { value: new THREE.Vector4(0, 0, 0, 0) };
  const avMat = mat({
    uniforms: Object.assign({ uA: set.uA, uAv, uGait }, LIT),
    vertexShader: LV + `
attribute float aP; uniform vec4 uAv, uGait; varying float vP; varying vec3 vLoc;
void main() {
  vec3 p = position, n = normal; float ph = uGait.x, amp = uGait.y;
  if (aP > 1.5 && aP < 3.5) {   // arms swing from the shoulders, against the legs
    float sd = aP < 2.5 ? 1.0 : -1.0, a = -sin(ph) * amp * 0.42 * sd, c = cos(a), s = sin(a);
    vec3 q = p - vec3(0.0, 1.31, 0.0);
    p = vec3(0.0, 1.31, 0.0) + vec3(q.x, q.y * c - q.z * s, q.y * s + q.z * c); n = vec3(n.x, n.y * c - n.z * s, n.y * s + n.z * c);
  }
  if (aP > 3.5) {   // feet step in turn
    float sd = aP < 4.5 ? 1.0 : -1.0, st = sin(ph) * sd;
    p.z += st * 0.13 * amp; p.y += max(0.0, cos(ph) * sd) * 0.05 * amp;
  } else {
    p.y += uAv.w;
    float r = sin(ph) * 0.035 * amp, lean = uGait.z;   // sway side to side, lean into the walk
    p = vec3(p.x * cos(r) - (p.y - 0.1) * sin(r), 0.1 + p.x * sin(r) + (p.y - 0.1) * cos(r), p.z + (p.y - 0.1) * lean);
  }
  vLoc = position; vP = aP;
  float th = 1.5707963 - uAv.z, c = cos(th), s = sin(th);
  setLight(vec3(p.x * c + p.z * s + uAv.x, p.y, -p.x * s + p.z * c + uAv.y), vec3(n.x * c + n.z * s, n.y, -n.x * s + n.z * c));
}`,
    fragmentShader: LF + `
varying float vP; varying vec3 vLoc;
void main() {
  vec3 N = normalize(vNW), V = normalize(cameraPosition - vPW);
  vec3 base = vP > 0.5 && vP < 1.5 ? vec3(0.8, 0.84, 0.9) : vP > 3.5 ? vec3(0.32, 0.36, 0.44) : vec3(0.55, 0.63, 0.75);
  if (vP > 0.5 && vP < 1.5) {   // two small dark eyes
    vec3 q = vLoc - vec3(0.0, 1.575, 0.0);
    for (int k = 0; k < 2; k++) { vec3 e = normalize(vec3(k == 0 ? 0.045 : -0.045, 0.0, 0.118)); base = mix(base, vec3(0.12, 0.14, 0.2), 1.0 - smoothstep(0.012, 0.016, length(q - e * 0.125))); }
  }
  vec3 c = shade(base, N, 0.25, 0.75 + 0.25 * smoothstep(0.1, 0.5, vLoc.y)) + pow(1.0 - max(dot(N, V), 0.0), 3.0) * vec3(0.16, 0.2, 0.26);
  gl_FragColor = vec4(c, uA);
}`,
  });
  const avMesh = new THREE.Mesh(avatarGeo(), avMat); avMesh.frustumCulled = false; avMesh.renderOrder = 3; set.group.add(avMesh);

  // ---------------------------------------------------------------- params, update, drawing
  const CUT = new Array(MAXW).fill(9);
  const SCAN = { r: 6, x: 0, z: 0, s: 1 };
  const params = { robots_a: 1, robots_rule: 1, robots_n: 6, robots_trails: 0, robots_links: 0, robots_scan: 1, robots_room: 1, robots_walk: 0, robots_dust: 0, robots_crumbs: 0 };
  function update(S, t, dt) {
    let d = dt === undefined ? (tLast === null ? 0 : t - tLast) : dt;
    tLast = t; d = clamp(d || 0, 0, 0.1);
    const rule = clamp(Math.round(S.robots_rule), 0, 4);
    if (rule !== RULE) { RULE = rule; for (let i = 0; i < MAXN; i++) { NT[i] = 0; if (MODE[i] === M_REST) MODE[i] = M_DRIVE; } if (RULE === 0) assignSlots(); if (RULE === 3) for (let i = 0; i < MAXN; i++) trailReset(i); }
    setCount(clamp(Math.round(S.robots_n), 1, MAXN));
    const du = Math.floor(S.robots_dust + 1e-6); if (du > dusts) dustAgain(); dusts = du;
    const cr = Math.floor(S.robots_crumbs + 1e-6); if (cr > crumbsN) spillNear(); crumbsN = cr;
    WALK = S.robots_walk > 0.5 && !AV.ext;
    // the simulation, in steps of at most 1/60 s
    if (d > 0) { const n = Math.ceil(d * 60 - 1e-6), h = d / n; for (let k = 0; k < n; k++) step(h); }
    draw(S, d);
  }
  function draw(S, d) {
    const room = uRoom.value = clamp(S.robots_room, 0, 1), model = ROOM.kind === 'model';
    uTrails.value = clamp(S.robots_trails, 0, 1);
    uTwin.value = model ? 0 : 1; uTwinScan.value = model ? 1 - room : 1;
    MODEL.visible = model && room > 0.003;
    TWIN.visible = !model || room < 0.997;
    // the scan: from where you stand when it starts
    const sc = clamp(S.robots_scan, 0, 1);
    if (sc < 0.02 || SCAN.s >= 0.999 && sc < 0.999) { SCAN.x = model ? FCX : PL.x; SCAN.z = model ? FCZ : PL.z; }
    SCAN.s = sc; LIT.uScan.value.set(sc, SCAN.r, SCAN.x, SCAN.z);
    // the doll's house: a wall whose outside faces your eye drops to skirting height
    const inside = onFloor(EYE[0], EYE[2]);
    for (let k = 0; k < WALLS.length && k < MAXW; k++) {
      const w = WALLS[k], out = (EYE[0] - (w.ax + w.bx) / 2) * -w.nx + (EYE[2] - (w.az + w.bz) / 2) * -w.nz;
      const low = out > 0.05 && !(inside && EYE[1] < w.h);
      const target = low ? 0.25 : w.h + 0.2;
      CUT[k] += (target - CUT[k]) * (1 - Math.exp(-(d || 0.016) * 4));
      uCut.value[k] = CUT[k];
    }
    // ripples on the walls (passthrough)
    for (let k = 0; k < 8; k++) { const r = RIPS[k]; if (r) RIP[k].set(r.w, r.u, simT - r.t, 1); else RIP[k].set(-1, 0, 9, 0); }
    // robots
    let top = 0, gl = 0;
    for (let i = 0; i < MAXN; i++) {
      if (!LIVE[i] && PRES[i] <= 0) { IA[i * 4 + 3] = 0; continue; }
      top = i + 1;
      // eyes: blink now and then, squint after a bump, smile when eating; look where they go, or at you
      SQ[i] = Math.max(0, SQ[i] - d); SQT[i] = Math.max(0, SQT[i] - d); JOY[i] = Math.max(0, JOY[i] - d); FLASH[i] = Math.max(0, FLASH[i] - d * 2.5);
      BLT[i] -= d; if (BLT[i] < 0) { BLK[i] = 0.16; BLT[i] = 2 + R() * 5 * (1 + (i % 3) * 0.3); } BLK[i] = Math.max(0, BLK[i] - d);
      GLT[i] -= d; if (GLT[i] < 0) { GLA[i] = 1 + R() * 1.5; GLT[i] = 4 + R() * 8; } GLA[i] = Math.max(0, GLA[i] - d);
      const asleep = RULE === 0 && MODE[i] === M_REST && PILE[i] < 0;
      const lid0 = asleep ? 0.45 : 0.04, blink = BLK[i] > 0 ? Math.sin(BLK[i] / 0.16 * Math.PI) : 0;
      LID[i] += (lid0 - LID[i]) * Math.min(1, d * 3);
      let tx = clamp(-ERR[i] * 0.9, -1, 1), ty = -0.3;
      const fx = Math.cos(H[i]), fz = Math.sin(H[i]);
      const lookYou = GLA[i] > 0 || (MODE[i] === M_REST && RULE >= 2) || asleep;
      if (lookYou) {
        // at the eye (the viewer), or at the avatar's head when the robot waits for you
        const ex = (GLA[i] > 0 || AV.ext ? EYE[0] : PL.x) - X[i], ez = (GLA[i] > 0 || AV.ext ? EYE[2] : PL.z) - Z[i], ey = (GLA[i] > 0 || AV.ext ? EYE[1] : 1.6) - 0.1, el = Math.hypot(ex, ez) || 1;
        tx = clamp(-(ex * -fz + ez * fx) / el * 1.2, -1, 1); ty = clamp(Math.atan2(ey, el) / 0.9 - 0.2, -0.5, 1);
        if ((ex * fx + ez * fz) < -0.3 * el) { tx *= 0.3; ty = -0.2; }   // behind: no
      }
      PUX[i] += (tx - PUX[i]) * Math.min(1, d * 7); PUY[i] += (ty - PUY[i]) * Math.min(1, d * 7);
      // the LED ring: steady while working, breathing slowly at the dock, a flash on a bump
      const glow = asleep ? 0.25 + 0.4 * Math.pow(Math.sin(simT * 1.1 + i * 0.7), 2) : 0.85 + 0.15 * FLASH[i];
      GLOW[i] += (glow - GLOW[i]) * Math.min(1, d * 4);
      BRS[i] += ((Math.abs(V[i]) > 0.03 || Math.abs(W[i]) > 0.3 ? 26 : 0) - BRS[i]) * Math.min(1, d * 3); BRA[i] += BRS[i] * d;
      const p = PRES[i], sc2 = LIVE[i] === 2 ? smooth(p) : p < 1 ? 1 + 2.70158 * Math.pow(p - 1, 3) + 1.70158 * Math.pow(p - 1, 2) : 1;
      const c = GANG[i % 6], o = i * 4;
      IA[o] = X[i]; IA[o + 1] = Z[i]; IA[o + 2] = H[i]; IA[o + 3] = Math.max(0, sc2);
      IB[o] = c[0]; IB[o + 1] = c[1]; IB[o + 2] = c[2]; IB[o + 3] = GLOW[i];
      IC[o] = SQ[i] > 0 ? Math.sin(SQ[i] / 0.15 * Math.PI) : 0; IC[o + 1] = Math.max(LID[i], blink) * (SQT[i] > 0 || JOY[i] > 0 ? 0 : 1);
      IC[o + 2] = SQT[i] > 0 ? smooth(Math.min(1, SQT[i] / 0.08)) : 0; IC[o + 3] = JOY[i] > 0 ? smooth(Math.min(1, JOY[i] / 0.12)) : 0;
      ID[o] = PUX[i]; ID[o + 1] = PUY[i]; ID[o + 2] = BRA[i];
      SA[gl * 4] = X[i]; SA[gl * 4 + 1] = Z[i]; SA[gl * 4 + 2] = 0.26 * Math.max(0, sc2); SA[gl * 4 + 3] = 0.55; gl++;
    }
    for (const g of RGEO) g.instanceCount = top;
    aIA.needsUpdate = aIB.needsUpdate = aIC.needsUpdate = aID.needsUpdate = true;
    // the avatar
    avMesh.visible = !AV.ext && AV.show && !AV.hidden;
    if (avMesh.visible) {
      AV.bob = Math.abs(Math.sin(AV.ph)) * 0.022 * AV.amp;
      uAv.value.set(AV.x, AV.z, AV.h, AV.bob); uGait.value.set(AV.ph, AV.amp, 0.06 * AV.amp, 0);
      SA[gl * 4] = AV.x; SA[gl * 4 + 1] = AV.z; SA[gl * 4 + 2] = 0.42; SA[gl * 4 + 3] = 0.5; gl++;
    }
    shGeo.instanceCount = gl; aSA.needsUpdate = true;
    // crumbs: pop in when spilled, shrink away when eaten
    for (let q = 0; q < NPILE * NBIT; q++) {
      const want = CAL[q] === 1 ? 1 : 0; CSC[q] += (want - CSC[q]) * Math.min(1, d * (want ? 8 : 14));
      if (CAL[q] === 2 && CSC[q] < 0.02) CAL[q] = 0;
      CA[q * 4] = CX[q]; CA[q * 4 + 1] = 0; CA[q * 4 + 2] = CZ[q]; CA[q * 4 + 3] = CS[q];
      CB[q * 4] = q * 2.399; CB[q * 4 + 1] = (q * 0.618) % 1; CB[q * 4 + 2] = CSC[q];
    }
    aCA.needsUpdate = aCB.needsUpdate = true;
    // links
    const la = clamp(S.robots_links, 0, 1);
    lnMesh.visible = dtMesh.visible = la > 0.01 && (RULE === 2 || RULE === 3);
    if (lnMesh.visible) {
      const pa = lnGeo.attributes.position.array, aa = lnGeo.attributes.aA.array, at = lnGeo.attributes.aT.array, dp = dtGeo.attributes.position.array, da = dtGeo.attributes.aA.array;
      let n = 0;
      for (let i = 0; i < MAXN; i++) {
        da[i] = 0;
        if (LIVE[i] !== 1 || i >= N) { for (let k = 0; k < NB; k++) da[MAXN + i * NB + k] = 0; continue; }
        let tx, tz, ty = 0.25;
        if (RULE === 3 && i > 0) { tx = X[i - 1]; tz = Z[i - 1]; } else { tx = PL.x; tz = PL.z; ty = 0.25; }
        const a = la * Math.min(1, PRES[i]) * (PILE[i] >= 0 ? 0.35 : 1), L = Math.hypot(tx - X[i], tz - Z[i]);
        let px = X[i], py = 0.25, pz = Z[i];
        for (let k = 1; k <= NLS; k++) {
          const u = k / NLS, x = lerp(X[i], tx, u), z = lerp(Z[i], tz, u), y = lerp(0.25, ty, u) + Math.sin(u * Math.PI) * Math.min(0.12, L * 0.08);
          const o = n * 6; pa[o] = px; pa[o + 1] = py; pa[o + 2] = pz; pa[o + 3] = x; pa[o + 4] = y; pa[o + 5] = z;
          aa[n * 2] = aa[n * 2 + 1] = a * 0.85; at[n * 2] = (k - 1) / NLS; at[n * 2 + 1] = u; n++;
          px = x; py = y; pz = z;
        }
        dp[i * 3] = X[i]; dp[i * 3 + 1] = 0.25; dp[i * 3 + 2] = Z[i]; da[i] = a;
        // beads every 9 cm, flowing towards the one it follows
        const nb = Math.min(NB, Math.floor(L / 0.09)), ph = (simT * 0.5 / 0.09) % 1;
        for (let k = 0; k < NB; k++) {
          const q = MAXN + i * NB + k;
          if (k >= nb) { da[q] = 0; continue; }
          const u = (k + ph) / (nb || 1), x = lerp(X[i], tx, u), z = lerp(Z[i], tz, u), y = lerp(0.25, ty, u) + Math.sin(u * Math.PI) * Math.min(0.12, L * 0.08);
          dp[q * 3] = x; dp[q * 3 + 1] = y; dp[q * 3 + 2] = z; da[q] = a * smooth(u / 0.15) * smooth((1 - u) / 0.12) * 0.9;
        }
      }
      lnGeo.setDrawRange(0, n * 2);
      lnGeo.attributes.position.needsUpdate = lnGeo.attributes.aA.needsUpdate = lnGeo.attributes.aT.needsUpdate = true;
      dtGeo.attributes.position.needsUpdate = dtGeo.attributes.aA.needsUpdate = true;
    }
    // the dust map goes to the GPU at most ten times a second
    MAP.age += d;
    if (MAP.dirty && MAP.age >= 0.1) { MAP.tex.needsUpdate = true; MAP.dirty = false; MAP.age = 0; }
  }

  // ---------------------------------------------------------------- start: the model room, six robots at the dock
  setRoom(modelRoom());
  setCount(6);
  assignSlots();
  for (let i = 0; i < N; i++) { const s = SLOTS[SLOT[i]]; X[i] = s.x; Z[i] = s.z; H[i] = s.h; MODE[i] = M_REST; PRES[i] = 1; LX[i] = X[i]; LZ[i] = Z[i]; trailReset(i); }
  draw(params, 0);

  // ---------------------------------------------------------------- exports
  const gang = () => { let x = 0, z = 0, n = 0; for (let i = 0; i < N; i++) if (LIVE[i] === 1) { x += X[i]; z += Z[i]; n++; } return n ? [x / n, 0.3, z / n] : [FCX, 0.3, FCZ]; };
  const anchors = {
    floor: () => [FCX, 0.02, FCZ],
    wall: () => (LONG ? [(LONG.ax + LONG.bx) / 2 + LONG.nx * 0.02, Math.min(1.3, LONG.h * 0.55), (LONG.az + LONG.bz) / 2 + LONG.nz * 0.02] : [FCX, 1.3, FCZ]),
    dock: () => { const s = SLOTS.filter(q => q.row === 0); if (!s.length) return [FCX, 0.1, FCZ]; return [s.reduce((a, q) => a + q.x, 0) / s.length, 0.1, s.reduce((a, q) => a + q.z, 0) / s.length]; },
    you: () => [PL.x, AV.ext ? EYE[1] : 1.7, PL.z],
    gang,
    lead: () => [X[0], 0.3, Z[0]],
    crumbs: () => (lastPile ? [lastPile.x, 0.05, lastPile.z] : [FCX, 0.05, FCZ]),
  };
  const scanA = S => smooth((S.robots_scan - 0.15) / 0.05) * smooth((0.9 - S.robots_scan) / 0.05);
  const labels = [
    { text: ['Floor', ''], at: 'floor', cls: 'cyn', alpha: scanA },
    { text: ['Wall', ''], at: 'wall', cls: 'cyn', alpha: scanA },
    { text: ['You', ''], at: () => [PL.x, 1.95, PL.z], cls: 'amb', alpha: S => (!AV.ext && AV.show ? smooth((S.robots_links - 0.5) / 0.3) : 0) },
  ];
  const cam = {
    default: [35, 52, 7.8, 0, 0.1, 0.15],
    low: [25, 6, 1.7, 0, 0.1, 0],
    eyes: [0, -18, 0.3, 0, 1.6, 0],
  };
  const controls = [
    { key: 'view', label: 'View', options: [['default', 'Above'], ['low', 'Low down'], ['eyes', 'Your eyes']] },
    { key: 'rule', label: 'Rule', options: [['follow', 'Follow me'], ['chain', 'Conga line'], ['flee', 'Keep away'], ['bounce', 'Bump and turn']] },
    { key: 'robots', label: 'Robots', options: [['6', '6'], ['12', '12'], ['24', '24']] },
    { key: 'trails', label: 'Floor', options: [['off', 'Off'], ['on', 'Cleaned floor']] },
    { key: 'links', label: 'Network', options: [['off', 'Off'], ['on', 'Who follows whom']] },
  ];
  const RULES = { dock: 0, bounce: 1, follow: 2, chain: 3, flee: 4 };
  function explore(c) {
    return { robots_rule: c.rule in RULES ? RULES[c.rule] : 2, robots_n: +c.robots || 6, robots_trails: c.trails === 'on' ? 1 : 0, robots_links: c.links === 'on' ? 1 : 0, robots_walk: 0 };
  }
  // you: in a headset, your head on the floor (show false); yaw as three.js turns about y (0 faces -z)
  function player(x, z, yaw, show) {
    PL.x = x; PL.z = z; PL.yaw = Math.atan2(-Math.cos(yaw || 0), -Math.sin(yaw || 0));
    if (show) { AV.ext = false; AV.show = true; AV.x = x; AV.z = z; AV.h = PL.yaw; AV.v = 0; AV.tx = null; }
    else { AV.ext = true; AV.show = false; }
  }
  function walkTo(x, z) {
    if (!ROOM || !onFloor(x, z)) return false;
    AV.ext = false; AV.show = true;
    const p = clrAt(x, z, NAV.clrA) >= RA + 0.02 ? [x, z] : nearestFree(x, z, NAV.clrA, RA + 0.03);
    AV.tx = p[0]; AV.tz = p[1]; AV.nt = 0;
    AV.F = field(seedsAt(p[0], p[1], NAV.clrA, RA + 0.01, 0.15), NAV.clrA, RA + 0.01, AV.F);
    return p;
  }
  function floorPoint(o, d) {
    if (!(d[1] < -1e-6) || !ROOM) return null;
    const t = -o[1] / d[1]; if (t < 0) return null;
    const x = o[0] + d[0] * t, z = o[2] + d[2] * t;
    return onFloor(x, z) && !inBlock(x, z, true) ? [x, z] : null;
  }
  // the avatar for the engine's "Your eyes" view: hide it (show false) and read where its head is and which way it faces
  function avatar(show) {
    if (show !== undefined) AV.hidden = !show;
    return { x: AV.x, z: AV.z, head: [AV.x + Math.cos(AV.h) * 0.06, 1.6 + AV.bob, AV.z + Math.sin(AV.h) * 0.06], forward: [Math.cos(AV.h), 0, Math.sin(AV.h)],
      yaw: Math.atan2(-Math.cos(AV.h), -Math.sin(AV.h)), walking: Math.abs(AV.v) > 0.05, shown: !AV.ext && AV.show && !AV.hidden };
  }
  function see(eye) { if (eye) { EYE[0] = eye[0]; EYE[1] = eye[1]; EYE[2] = eye[2]; } }
  // the headset's coordinates changed (a recentre): carry the gang, its trails, the piles and you along
  // (x' = c x - s z + tx, z' = s x + c z + tz); the next setRoom moves the cleaned floor the same way.
  // c null: nobody knows how things moved, so the robots start again from the dock and the piles are swept up.
  function shift(c, s, tx, tz) {
    if (!(isFinite(c) && isFinite(s) && isFinite(tx) && isFinite(tz))) {
      for (const pl of PILES) if (pl) dropPile(pl);
      for (let i = 0; i < MAXN; i++) if (LIVE[i] === 1) spawn(i); else if (LIVE[i]) { LIVE[i] = 0; PRES[i] = 0; }
      return;
    }
    const l = Math.hypot(c, s) || 1; c /= l; s /= l;
    const mv = (A, B, k) => { const x = A[k], z = B[k]; A[k] = c * x - s * z + tx; B[k] = s * x + c * z + tz; }, da = Math.atan2(s, c);
    for (let i = 0; i < MAXN; i++) { mv(X, Z, i); mv(LX, LZ, i); mv(AX, AZ, i); mv(GX, GZ, i); H[i] += da; NT[i] = 0; }
    for (let k = 0; k < MAXN * TL; k++) mv(TRX, TRZ, k);
    for (let k = 0; k < NPILE * NBIT; k++) mv(CX, CZ, k);
    for (const pl of PILES) if (pl) { const x = pl.x; pl.x = c * x - s * pl.z + tx; pl.z = s * x + c * pl.z + tz; pl.F = null; }
    for (const o of [PL, AV]) { const x = o.x; o.x = c * x - s * o.z + tx; o.z = s * x + c * o.z + tz; }
    PL.lx = PL.x; PL.lz = PL.z; AV.h += da; AV.tx = null;
    // the floor map: after an earlier shift not yet applied, the two make one
    const m = MAP.move;
    MAP.move = m ? [c * m[0] - s * m[1], s * m[0] + c * m[1], c * m[2] - s * m[3] + tx, s * m[2] + c * m[3] + tz] : [c, s, tx, tz];
  }
  function state() {
    const rs = [];
    for (let i = 0; i < MAXN; i++) if (LIVE[i]) rs.push({ i, x: X[i], z: Z[i], h: H[i], v: V[i], w: W[i], mode: MODE[i], live: LIVE[i], pile: PILE[i], slot: SLOT[i], want: WANT[i], why: WHY[i], goal: [GX[i], GZ[i]] });
    return { robots: rs, n: N, rule: RULE, bumps: BUMPS, t: simT, coverage: MAP.count ? MAP.done / MAP.count : 0,
      piles: PILES.filter(Boolean).map(p => ({ x: p.x, z: p.z, left: p.left, t: p.t, done: p.done })),
      player: { x: PL.x, z: PL.z, avatar: !AV.ext && AV.show, h: AV.h, v: AV.v, target: AV.tx === null ? null : [AV.tx, AV.tz] },
      room: { kind: ROOM.kind, walls: WALLS.length, blocks: BLOCKS.length, floor: ROOM.floor }, slots: SLOTS.map(s => [s.x, s.z, s.row]) };
  }
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore,
    setRoom, modelRoom, room: () => ROOM, player, walkTo, crumbs: spill, crumbsNear: spillNear, floorPoint, see, avatar, shift,
    coverage: () => (MAP.count ? MAP.done / MAP.count : 0), robots: () => N, bumps: () => BUMPS, state });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['robots'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(50, 1, 0.03, 200);   // a room: robots at your feet, nothing far away
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // the set lights itself in its shaders; these are for built-in lit materials, should any appear
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 0.85));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(GL.sun); scene.add(GL.sun.target);
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
// The screen camera, in the set's frame (on a screen the world is not moved or turned). g (0..1) pulls the target
// onto the gang, followed smoothly (the low view keeps the robots in the picture); low down the camera stays inside
// the room (the walls nearest you drop only to skirting height, which would hide the floor from there) and always
// above the floor. "Your eyes" (CAMV.e) blends to the avatar's head, looking lazily at the gang.
const CAMV = { gx: null, gz: null, e: 0, look: null, hold: 0, off: 0, daz: 0 };
const _cp = new THREE.Vector3(), _cq = new THREE.Quaternion(), _cm = new THREE.Matrix4(), _cU = new THREE.Vector3(0, 1, 0);
const _ep = new THREE.Vector3(), _eq = new THREE.Quaternion(), _ee = new THREE.Euler(0, 0, 0, 'YXZ');
// a point well inside the floor (and outside furniture): the low camera's place
function inRoom(x, z) {
  const F = GL.sets.robots, r = 0.16;
  for (const [ox, oz] of [[0, 0], [r, 0], [-r, 0], [0, r], [0, -r]]) if (!F.floorPoint([x + ox, 1, z + oz], [0, -1, 0])) return false;
  return true;
}
function gangStep(dt) {
  const c = GL.sets.robots.anchors.gang(), k = CAMV.gx === null ? 1 : 1 - Math.exp(-dt * 1.4);
  if (CAMV.gx === null) { CAMV.gx = c[0]; CAMV.gz = c[2]; }
  CAMV.gx += (c[0] - CAMV.gx) * k; CAMV.gz += (c[2] - CAMV.gz) * k;
}
// low down, the camera looks past you rather than into your legs: it comes round (eased) to the nearest side from
// which the avatar is not in the way between it and the gang (or, failing that, is furthest from the camera)
const AZ_TRY = [0, 20, -20, 40, -40, 60, -60, 90, -90, 120, -120, 150, -150, 180];
function youGap(v, g, off) {
  const a = GL.sets.robots.avatar();
  if (!a.shown) return 9;
  const A = (v[0] + off) * D2R, d = Math.min(2.2, v[2]), ex = Math.sin(A), ez = Math.cos(A);
  const tx = v[3] + (CAMV.gx - v[3]) * g, tz = v[5] + (CAMV.gz - v[5]) * g;
  const u = clamp((a.x - tx) * ex + (a.z - tz) * ez, Math.min(0.5, d), d);   // you may stand by the gang, not by the camera
  return Math.hypot(a.x - tx - ex * u, a.z - tz - ez * u);
}
// ... and not through furniture taller than the line of sight there (an armchair filling the picture)
function sightBlocked(v, g, off) {
  const B = GL.sets.robots.room().blocks;
  if (!B.length) return false;
  const A = (v[0] + off) * D2R, E = lowEl(v, g) * D2R, d = lowDist(v, g), ex = Math.sin(A) * Math.cos(E), ez = Math.cos(A) * Math.cos(E), ey = Math.sin(E);
  const tx = v[3] + (CAMV.gx - v[3]) * g, tz = v[5] + (CAMV.gz - v[5]) * g;
  for (let u = 0.3; u < d; u += 0.1) {
    const x = tx + ex * u, z = tz + ez * u, y = 0.1 + ey * u;
    for (const b of B) if (!(b.under > 0.12) && b.h > y && inPoly2(b.poly, x, z)) return true;
  }
  return false;
}
// on a narrow screen the picture is a strip above the panel: low down, the camera stands a little further back and
// higher, so the strip shows the gang and the room round it rather than a patch of rug
const lowEl = (v, g) => v[1] + (GL.wide ? 0 : 5 * g);
const lowDist = (v, g) => v[2] * (1 + ((GL.fit || 1) - 1) * (1 - g)) * (GL.wide ? 1 : 1 + 0.35 * g);   // the fit frames the room; low down there is nothing to frame
function orbitPose(v, g, dt) {
  if (g > 0.3) {
    if (youGap(v, g, CAMV.off) < 0.5 || sightBlocked(v, g, CAMV.off)) {
      let best = 0, bg = -9;
      for (const o of AZ_TRY) {
        const q = youGap(v, g, o), s = sightBlocked(v, g, o);
        if (q >= 0.5 && !s) { best = o; break; }
        if (q - (s ? 1 : 0) > bg) { bg = q - (s ? 1 : 0); best = o; }
      }
      CAMV.off = best;
    }
  } else CAMV.off = 0;
  CAMV.daz += (CAMV.off - CAMV.daz) * (dt ? 1 - Math.exp(-dt * 1.2) : 1);
  const vv = [v[0] + CAMV.daz * g, lowEl(v, g), v[2]];
  _vt.set(v[3] + (CAMV.gx - v[3]) * g, v[4] + (0.1 - v[4]) * g, v[5] + (CAMV.gz - v[5]) * g);
  viewDir(vv, _vd);
  let d = lowDist(v, g);
  for (let k = 0; k < 14; k++) {
    _cp.copy(_vt).addScaledVector(_vd, d);
    if (_cp.y > 0.8 || d < 0.35 || inRoom(_cp.x, _cp.z)) break;
    d *= 0.88;
  }
  _cp.y = Math.max(_cp.y, 0.12);   // never under the floor
  _cm.lookAt(_cp, _vt, _cU); _cq.setFromRotationMatrix(_cm);
}
// the avatar's eyes: a dead zone and eased turns (as the flock's camera), so the view does not chase every robot
function eyesPose(dt) {
  const F = GL.sets.robots, a = F.avatar(), h = a.head, c = F.anchors.gang();
  const dx = c[0] - h[0], dz = c[2] - h[2], hd = Math.hypot(dx, dz) + 1e-6;
  let az = Math.atan2(-dx, -dz) / D2R;
  const el = clamp(Math.atan2(0.15 - h[1], hd) / D2R, -62, 0);
  if (!CAMV.look) CAMV.look = { az: a.yaw / D2R, el: -28, wa: 0, we: 0 };
  const L = CAMV.look;
  az += 360 * Math.round((L.az - az) / 360);
  if (CAMV.hold > 0) { CAMV.hold -= dt; L.wa = L.we = 0; }
  else {
    const hw = Math.atan(Math.tan(GL.camera.fov * D2R / 2) * GL.camera.aspect) / D2R;
    track(L, 'az', 'wa', az, clamp(hw * 0.45, 6, 22), 2.5, 50, dt); track(L, 'el', 'we', el, 8, 2.5, 30, dt);
  }
  _ep.set(h[0], h[1], h[2]);
  _eq.setFromEuler(_ee.set(L.el * D2R, L.az * D2R, 0, 'YXZ'));
}
// v: the orbit [az, el, dist, tx, ty, tz]; g: how far its target is on the gang; eyes: the avatar's eyes wanted
function applyView(v, g, eyes, dt) {
  gangStep(dt);
  CAMV.e += ((eyes ? 1 : 0) - CAMV.e) * (dt ? 1 - Math.exp(-dt * 2.2) : 1);
  if (CAMV.e < 0.002) CAMV.e = 0;
  if (!eyes && CAMV.e === 0) CAMV.look = null;
  const s = smooth(CAMV.e);
  orbitPose(v, g, dt);
  if (s > 0) {
    eyesPose(dt);
    _cp.lerp(_ep, s); _cq.slerp(_eq, s);
  }
  GL.camera.position.copy(_cp); GL.camera.quaternion.copy(_cq);
  GL.sets.robots.avatar(!(eyes && CAMV.e > 0.55));   // your own body is out of the way in your eyes
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
  // on a narrow screen the panel covers the lower part: the room is framed in the strip above it
  const strip = Math.max(0.12, (0.56 * h - 122) / h);
  GL.fit = wide ? Math.max(1, 1.55 / (w / h)) : Math.max(1.15, 1 / strip, 1.2 / (w / h));
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
const lazy = (d, dz) => Math.sign(d) * Math.max(0, Math.abs(d) - dz);
// turn o[x] towards g: the speed it wants grows with the error beyond the dead zone; its speed o[w] eases there
function track(o, x, w, g, dz, gain, top, dt) {
  const want = clamp(lazy(g - o[x], dz) * gain, -top, top);
  o[w] += (want - o[w]) * (1 - Math.exp(-dt * 4));
  o[x] += o[w] * dt;
}

// ------------------------------------------------------------- the gang --
// The gang needs to know where you are: in a headset your head (standing on the floor below it, facing where you
// look); on a screen the avatar walks for you and the camera is only an eye (for the doll's-house walls and the
// robots' glances). Positions go into the set's own frame, which a headset room may move and turn.
const _sv = new THREE.Vector3(), _sm = new THREE.Matrix4(), _sf = new THREE.Vector3();
function tellRobots(xr) {
  const s = GL.sets.robots;
  GL.world.updateMatrixWorld(true);
  _sm.copy(s.group.matrixWorld).invert();
  if (xr || (XR.on && XRR.kind)) {
    const head = _sv.copy(XR.head).applyMatrix4(_sm);
    _sf.set(0, 0, -1).applyQuaternion(XR.headQ).transformDirection(_sm);
    s.player(head.x, head.z, Math.atan2(-_sf.x, -_sf.z), false);
    s.see(head.toArray());
  } else s.see(_sv.copy(GL.camera.position).applyMatrix4(_sm).toArray());
}

// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Until a narration is recorded, the table sets the
// pace: node tools/pace.mjs writes it from the words on the panel (each stretch
// between two cues lasts long enough to read what appeared at its start; run
// it again after the text changes). A recording replaces it with its own times.
const NARRATION_SYNC = [
  [0, 0], [5.1, 4.6], [17.6, 9],                      // Robot gang
  [23.9, 14], [24.6, 14.6], [25.9, 15.2], [36.5, 21], [43.7, 27],  // Bump and turn
  [51.4, 34], [52.1, 34.6], [52.9, 35.2], [60.6, 41],  // Follow me
  [74.9, 54], [76.2, 55.18], [77.2, 55.2], [84.5, 61], [91.1, 67],  // Follow the one ahead
  [104.2, 74], [104.9, 74.6], [105.7, 75.2], [109.6, 77], [121.4, 84],  // Your gang
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
  { key: 'title', name: 'Robot gang', a: 0, b: 14 },
  { key: 'bump', name: 'Bump and turn', a: 14, b: 34 },
  { key: 'follow', name: 'Follow me', a: 34, b: 54 },
  { key: 'chain', name: 'Follow the one ahead', a: 54, b: 74 },
  { key: 'gang', name: 'Your gang', a: 74, b: 84 },
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
const NUMW = ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
const cap = s => s.charAt(0).toUpperCase() + s.slice(1);
// live numbers in the story text (data-live), filled every frame from the set
const LIVE = {
  cov: () => Math.round(GL.sets.robots.coverage() * 100) + ' %',
  n: () => String(GL.sets.robots.robots()),
};
let liveEls = [];

function buildStory() {
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  const n = Math.round(DEF.robots_n), many = cap(NUMW[n] || String(n));
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--cyan)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--cyan)"/><circle cx="352" cy="36" r="4.5" fill="var(--cyan)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">Robot gang</h1>
      <p class="lede" data-at="2.4">vacuums in your room</p>
      <p data-at="4">${many} robot vacuums share a room with you. In a headset it is your own room: the headset knows your floor and walls from its room setup, and so do they.</p>
      <p class="note" data-at="9" data-xr="Walk about: the robots know where you are. Point at the floor and pull the trigger to spill crumbs.">On a screen you stand in a model living room. Click the floor to walk.</p>`,
    bump: `<h2 data-at="0.6">Bump and turn</h2>
      <p data-at="1.2">Early robot vacuums had no map of the room. Much of the time they simply drove until they bumped into something, turned, and drove on.</p>
      <p data-at="7">Nobody plans a route, yet the floor gets clean: so far the gang has cleaned <b data-live="cov">0 %</b> of it.</p>
      <p data-at="13">Bouncing at random reaches every corner in the end, but the last patches take longest.</p>`,
    follow: `<h2 data-at="0.6">Follow me</h2>
      <p data-at="1.2">Now give each robot one rule: follow you, keep a little distance, and keep clear of the others.</p>
      <p data-at="7" class="amber">Draw who follows whom and you get a network: you in the middle, a link to every robot. A star.</p>`,
    chain: `<h2 data-at="0.6">Follow the one ahead</h2>
      <p data-at="1.2">Rewire the network. Each robot follows the one in front of it; only the first follows you.</p>
      <p data-at="7">Same robots, same rule, a different network: the gang becomes a line.</p>
      <p class="credits" data-at="13">Swarms of robots are often steered like this: each watches a few others, and the network of who follows whom shapes the group (Olfati-Saber, Fax and Murray, Proceedings of the IEEE 2007).</p>`,
    gang: `<h2 data-at="0.6">Your gang</h2>
      <p data-at="1.2">The gang stays for as long as you do.</p>
      <p data-at="3" data-xr="Change the rule, add robots, show the cleaned floor, or spill crumbs: point at the floor and pull the trigger. Walk about and the gang follows.">Change the rule, add robots, show the cleaned floor, or spill crumbs: click the floor to walk; in a headset, point at the floor and pull the trigger.</p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  liveEls = Array.from(story.querySelectorAll('[data-live]')).map(el => ({ el, f: LIVE[el.dataset.live], v: '' }));
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c === CH[CH.length - 1] ? Infinity : c.b - 0.05, o: -1 })),
      grow: [] });
  });
  // ------------------------------------------------------------ keyframes and camera
  const wp = [];
  // a waypoint: a view of the set (the low view keeps its target on the gang), turned by spin degrees
  const cam = (t, k, name, spin, ease) => {
    const v = view(k, name);
    v[0] += spin || 0;
    wp.push([t, ...v, name === 'low' ? 1 : 0, ease, k]);
  };
  const jump = (n, t, v0, v1) => { key(n, t - 0.01, v0); key(n, t, v1); };
  show('robots', 0, 1);
  // the room is found; the gang sleeps at the dock
  key('robots_n', 0, n);
  key('robots_rule', 0, 0);
  ramp('robots_scan', 2, 11, 0, 1);
  // bump and turn on a dusty floor; the cleaned floor shows as a map
  jump('robots_rule', C.bump.a, 0, 1);
  jump('robots_dust', C.bump.a, 0, 1);
  ramp('robots_trails', C.bump.a + 1, C.bump.a + 3, 0, 1);
  // follow you as you stroll: a star
  jump('robots_rule', C.follow.a, 1, 2);
  jump('robots_walk', C.follow.a, 0, 1);
  ramp('robots_trails', C.follow.a, C.follow.a + 2, 1, 0);
  ramp('robots_links', C.follow.a + 6, C.follow.a + 8, 0, 1);
  // follow the one ahead: a chain; crumbs on the floor
  jump('robots_rule', C.chain.a, 2, 3);
  jump('robots_crumbs', C.chain.a + 12, 0, 1);
  // the gang gathers round you again; you stand still
  jump('robots_rule', C.gang.a, 3, 2);
  jump('robots_walk', C.gang.a, 1, 0);
  ramp('robots_links', C.gang.a, C.gang.a + 2, 1, 0);
  label('robots', 'dock', '<b>Dock</b>', 10.4, C.bump.a + 0.5, 'grn');
  label('robots', 'crumbs', '<b>Crumbs</b>', C.chain.a + 12.3, C.chain.a + 17, 'amb');
  // the doll's house from above, drifting slowly; down among the robots for a while as they bounce about
  cam(0, 'robots', 'default', -12);
  cam(C.bump.a, 'robots', 'default', 0, 'spin');
  cam(C.bump.a + 3.5, 'robots', 'default', 4, 'spin');
  cam(C.bump.a + 6.5, 'robots', 'low', 0);
  cam(C.bump.a + 12.5, 'robots', 'low', 25, 'spin');
  cam(C.bump.a + 16, 'robots', 'default', 8);
  cam(C.follow.a, 'robots', 'default', 12, 'spin');
  cam(C.chain.a, 'robots', 'default', 24, 'spin');
  cam(C.gang.a, 'robots', 'default', 10, 'spin');
  cam(C.gang.b, 'robots', 'default', 0, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, g, ease, set]; 'spin' segments turn at a steady pace.
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
    if (!cur || w[9] !== cur.k) {
      const d = prevAz === null ? 0 : ((prevAz - w[1]) % 360 + 540) % 360 - 180;
      cur = { k: w[9], t0: w[0], c: Math.abs(d) > 40 ? d : 0 };
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
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7], w[8]];
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
// the story's camera at t: [az, el, dist, tx, ty, tz, g] (g: how far the target is on the gang)
function storyCam(t) {
  const wp = ST.wp;
  if (t <= wp[0][0]) return wp[0].slice(1, 8);
  for (let i = 1; i < wp.length; i++) {
    if (t <= wp[i][0]) {
      const p = wp[i - 1], q = wp[i], x = q[0] > p[0] ? (q[8] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]) : 1;
      return [p[1] + (q[1] - p[1]) * x, p[2] + (q[2] - p[2]) * x, Math.exp(Math.log(p[3]) + (Math.log(q[3]) - Math.log(p[3])) * x),
        p[4] + (q[4] - p[4]) * x, p[5] + (q[5] - p[5]) * x, p[6] + (q[6] - p[6]) * x, p[7] + (q[7] - p[7]) * x];
    }
  }
  return wp[wp.length - 1].slice(1, 8);
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
// the live numbers: written only when they change (the headset panel redraws on that too, see sigMain)
function updateLive() {
  let s = '';
  for (const L of liveEls) {
    const v = L.f();
    if (v !== L.v) { L.v = v; L.el.textContent = v; }
    s += v + ';';
  }
  return s;
}
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
// Explore mode: the gang stays for as long as you do. Its controls choose the view, the rule (and so the network of
// who follows whom), how many robots, the cleaned floor and the links; buttons spill crumbs and make the floor dusty
// again. A click on the floor walks you there (in a headset the trigger on the floor spills crumbs).
const SCENES = [
  ['robots', 'The gang', 'Robot vacuums in a model living room. Click the floor to walk there; drag to look around.'],
];
const TABS = [['scenes', 'The gang']];
const X = { tab: 'scenes', scene: 'robots', ctl: {}, t0: 0, turn: 'on', g: 0 };
const XS = {};
const orbit = { cur: [35, 52, 7.8, 0, 0.1, 0.15], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const viewNow = () => ctlValue('robots', GL.sets.robots.controls[0]);

// what the controls ask for (the counters - dust, crumbs - only move when a button is pressed)
const COUNTERS = new Set(['robots_dust', 'robots_crumbs']);
function exploreTargets(now = performance.now()) {
  const s = GL.sets[X.scene], tg = Object.assign({}, s.params);
  tg[X.scene + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(X.scene, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const out = {};
  for (const n in DEF) out[n] = COUNTERS.has(n) ? XS[n] : n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
const STEP = new Set(['robots_rule', 'robots_n', 'robots_walk', 'robots_dust', 'robots_crumbs']);   // whole numbers jump, they do not ease
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
  // the low view's target eases onto the gang
  X.g += ((viewNow() === 'low' ? 1 : 0) - X.g) * (1 - Math.exp(-dt * 2.5));
  // from above, the view drifts slowly round unless you are steering it
  if (X.turn === 'on' && viewNow() === 'default' && !orbit.to && !orbit.held) { X.sway = (X.sway || 0) + dt; orbit.cur[0] += dt * 3 * Math.cos(X.sway * 0.15); }
  updateExploreLive();
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
  if (key === 'view') { CAMV.hold = 0; if (s.cam && s.cam[v] && v !== 'eyes') flyTo(view(k, v)); }
  if (c) renderScenes();
}
// the buttons: a pile of crumbs 1-2 m from you (the set picks the spot), a dusty floor again; in a shared room the
// others at the station get both too (effects: the pile at the same spot)
function spillCrumbs() { const p = GL.sets.robots.crumbsNear(); if (p) crumbsOut(p[0], p[1]); }
const dustNow = () => { XS.robots_dust = Math.floor(XS.robots_dust || 0) + 1; };
function dustAgain() { dustNow(); HOST.collab.effect('dust'); }
// shared rooms: the controls everyone at the station sees alike (the view is each person's own camera, the walk their own)
const SHARED_CTL = ['rule', 'robots', 'trails', 'links'];
// shared rooms: life size in a headset, so no view places anything there (none to share)
function collabView() { return null; }
function collabSetView() { /* nothing to set */ }
function collabState() {
  return Object.fromEntries(GL.sets.robots.controls.filter(c => SHARED_CTL.includes(c.key)).map(c => [c.key, ctlValue('robots', c)]));
}
function collabApply(v) {
  for (const c of GL.sets.robots.controls) {
    const x = v && v[c.key];
    if (SHARED_CTL.includes(c.key) && c.options.some(o => o[0] === x) && ctlValue('robots', c) !== x) setCtl('robots', c.key, x);
  }
}
// A pile spilled here, sent to the others at the station: in a headset with the room frame in room coordinates (a real
// room is the same floor for everyone), otherwise in the set's frame, which is the station's (the model room, or the
// virtual room that hangs on the rig at the station). Played there without sending it again.
const _kp = new THREE.Vector3(), _ks = new THREE.Vector3(), _kY = new THREE.Vector3(0, 1, 0);
function crumbsOut(x, z) {
  const F = GL.sets.robots;
  if (!XR.on || !HOST.room.aligned) { HOST.collab.effect('crumbs', { x, z, f: 'station' }); return; }
  const r = HOST.room.toRoom(F.group.localToWorld(_kp.set(x, 0, z)));
  HOST.collab.effect('crumbs', { x: r.x, z: r.z, f: 'room' });
}
function crumbsIn(d) {
  const F = GL.sets.robots, L = HOST.collab.live(), room = XR.on && HOST.room.aligned;
  if (!d || !isFinite(d.x) || !isFinite(d.z)) return false;
  const p = _kp.set(+d.x, 0, +d.z), spot = L ? _ks.set(L.x, 0, L.z) : null;
  if (d.f === 'room' && room) F.group.worldToLocal(p.copy(HOST.room.toLocal(p)));
  else if (d.f === 'room') { if (!spot) return false; p.sub(spot).applyAxisAngle(_kY, -L.yaw); }   // no room frame here: the station's
  else if (room && XRR.kind === 'real' && spot) F.group.worldToLocal(p.copy(HOST.room.toLocal(p.applyAxisAngle(_kY, L.yaw).add(spot))));
  return F.crumbs(p.x, p.z);
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

// the live line under the buttons, as text for the page and the headset panel
const liveLine = () => `Cleaned: ${Math.round(GL.sets.robots.coverage() * 100)} % of the floor · ${GL.sets.robots.robots()} robots`;
let liveShown = '';
function updateExploreLive() {
  const s = liveLine(), el = $('#rbLive');
  if (s !== liveShown && el) { el.textContent = s; liveShown = s; }
}
function buildExplore() {
  $('#explore').innerHTML = `<div class="pane on" id="pane-scenes" role="region" aria-label="The gang"></div>`;
  $('#pane-scenes').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.ctl) setCtl(X.scene, b.dataset.ctl, b.dataset.v);
    else if (b.dataset.act === 'crumbs') spillCrumbs();
    else if (b.dataset.act === 'dust') dustAgain();
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
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  pane.innerHTML = `<h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => `<button type="button" data-ctl="${c.key}" data-v="${v}" aria-pressed="${ctlValue(X.scene, c) === v}"${ctlValue(X.scene, c) === v ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(n)}</button>`).join('')}</div>`).join('')}
    <div class="actions"><button class="btn primary" type="button" data-act="crumbs">Spill crumbs</button> <button class="btn" type="button" data-act="dust">Dust again</button></div>
    <p class="sub" id="rbLive" aria-live="off">${esc(liveLine())}</p>`;
  liveShown = '';
}
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
// A click (no drag) on the floor walks you there; a drag turns the view (in your eyes: your head); the wheel or a
// pinch zooms. Over the floor the pointer shows you can click.
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _inv = new THREE.Matrix4(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
// where a point on the screen lands on the floor, in the set's frame: [x, z] or null
function floorAt(mx, my) {
  const F = GL.sets.robots;
  if (GL.renderer.xr.isPresenting) return null;
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  GL.camera.updateMatrixWorld();
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(F.group.matrixWorld).invert();
  _ro.copy(_rc.ray.origin).applyMatrix4(_inv); _rd.copy(_rc.ray.direction).transformDirection(_inv);
  return F.floorPoint(_ro.toArray(), _rd.toArray());
}
function walkHere(mx, my) {
  const p = floorAt(mx, my);
  return p ? GL.sets.robots.walkTo(p[0], p[1]) : false;
}
function bindCanvas() {
  const cv = GL.canvas, pts = new Map();
  let down = null, pinch = 0, cursor = '';
  const setCursor = c => { if (c !== cursor) { cv.style.cursor = c; cursor = c; } };
  setCursor('grab');
  cv.addEventListener('pointerdown', ev => {
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    cv.setPointerCapture(ev.pointerId);
    down = { x: ev.clientX, y: ev.clientY, moved: false };
    orbit.held = true;
    if (pts.size === 2) { const [a, b] = [...pts.values()]; pinch = Math.hypot(a[0] - b[0], a[1] - b[1]); }
  });
  cv.addEventListener('pointermove', ev => {
    if (!pts.has(ev.pointerId)) {   // hovering: a pointer over the floor
      if (ev.pointerType === 'mouse') setCursor(floorAt(ev.clientX, ev.clientY) ? 'pointer' : APP.mode === 'explore' ? 'grab' : 'default');
      return;
    }
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (APP.mode !== 'explore') return;
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0 && viewNow() !== 'eyes') orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.4, 30);
      pinch = d; down.moved = true; return;
    }
    if (down && down.moved) {
      setCursor('grabbing');
      if (viewNow() === 'eyes' && CAMV.look) {
        // in your eyes you turn your head (drag the room along); the gaze goes back to the gang a little later
        CAMV.look.az += dx * 0.16; CAMV.look.el = clamp(CAMV.look.el + dy * 0.16, -80, 35); CAMV.hold = 3;
      } else {
        orbit.to = null;
        orbit.cur[0] -= dx * 0.25; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.25, 2, 85);
      }
    }
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (down && !down.moved && ev.type === 'pointerup' && pts.size === 0) walkHere(ev.clientX, ev.clientY);
    if (!pts.size) { down = null; orbit.held = false; setCursor(APP.mode === 'explore' ? 'grab' : 'default'); }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore' || viewNow() === 'eyes') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.4, 30);
  }, { passive: false });
}
// ================================================================= WEBXR ==
// Headset mode (built for Meta Quest, works in any WebXR browser). The gang
// drives on your own floor, life size: the room comes from the headset's room
// setup (plane and mesh detection), or is a virtual room round you. The side
// panel is redrawn on a canvas you point at, and labels become sprites.
// Controllers: point and pull the trigger to click, or at the floor to spill
// crumbs; the grip moves the panel; A/X plays and pauses the story. Hand
// tracking: point and pinch.
const XR = {
  on: false, mode: null, session: null, needRecenter: false, fov: false, fontOK: 0, clear: true,
  head: new THREE.Vector3(), headQ: new THREE.Quaternion(), globeOff: new THREE.Vector3(), size: 1, globeBase: new THREE.Vector3(), camLocal: new THREE.Vector3(0, 0, 5),
  baseR: 0.36, R: 0.36, viewH: 1600, hitR: 1, target: new THREE.Vector3(),
  ctrls: [], panels: [], main: null, foot: null, tip: null, tipI: -1, elInfo: null,
  kbd: { open: false, q: '' }, pf: -1, pt: -1, pick: 'from',
};
const _xd = new THREE.Vector3(), _xp = new THREE.Vector3(), _xq = new THREE.Quaternion();
const _xq2 = new THREE.Quaternion(), _xm = new THREE.Matrix4(), _xinv = new THREE.Matrix4();
const _xa = new THREE.Vector3(), _xb = new THREE.Vector3(), _xc = new THREE.Vector3(), _xz = new THREE.Vector3(0, 0, 1);

// ------------------------------------------------------------ scene pose --
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
const _xT = new THREE.Matrix4(), _xR = new THREE.Matrix4();
// The gang is life size, on your floor. Your own room (kind 'real') is fixed in the reference space: the world's frame
// is the reference space moved down to the floor, so the world hangs under the rig by the rig's inverse (the rig
// carries the panels and may be anchored or recentred; the real room must not move with it). A virtual room ('box',
// 'model') hangs on the rig like the flock's land: a standing eye height (1.6 m) below where your head was when the
// place was set, facing where you faced, so an anchor keeps it in place too. Views do not move it, and this never
// moves GL.rig itself.
function xrPlace() {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  const eye = 1.6;
  if (XRR.kind === 'real') {
    GL.rig.updateMatrix();
    _xR.copy(GL.rig.matrix).invert().multiply(_xT.makeTranslation(0, XRR.floorY, 0));
    _xR.decompose(GL.world.position, GL.world.quaternion, GL.world.scale);
    XR.globeBase.copy(GL.world.position);
  } else {
    GL.world.quaternion.identity();
    GL.world.scale.setScalar(1);
    GL.world.position.set(0, -eye, 0);
    XR.globeBase.set(0, -eye, 0);
  }
}

// -------------------------------------------------------------- the room --
// Your room, from the headset's room setup (WebXR plane and mesh detection; Quest labels each plane and volume):
// the floor (its outline and height), the walls (segments at floor level, with their height) and the furniture the
// robots cannot drive into (footprints and heights; tables and desks are left out, the robots go under them, and so
// is furniture raised off the floor). Read every frame but cheaply: the room is read again when the planes or meshes
// (or their lastChangedTime) change, and once a second besides (poses can move without that, and a first read may
// come before tracking has found them), at most twice a second, or at once after the reference space was reset; the
// set skips a room that has not changed, so the cleaned floor stays. Nothing found (no feature, no room setup, or
// nothing yet): a virtual room round you, the model living room in VR, a bare 4 m x 5 m box in passthrough.
// Everything goes to the set in its own frame (x and z as in the reference space, y up from the floor).
const XRR = { kind: '', t: 0, t0: 0, floorY: 0, reset: false, move: null, capture: false, seen: [], ns: 0, dirty: false, clear: null, walls: 0, blocks: 0 };
const ROOM_SKIP = new Set(['door frame', 'window frame', 'wall art', 'invisible wall face', 'global mesh']);
const ROOM_BLOCK = new Set(['couch', 'storage', 'bed', 'other']);
const ROOM_UNDER = new Set(['table', 'desk']);   // the robots go under these
const BOX_ROOM = { kind: 'box', floor: [[-2, -2.5], [2, -2.5], [2, 2.5], [-2, 2.5]] };   // 4 m x 5 m round you, the long side ahead
const _rm = new THREE.Matrix4(), _rv = new THREE.Vector3(), _rq = new THREE.Quaternion(), _rs = new THREE.Vector3(1, 1, 1);
const semantic = o => { try { return String(o.semanticLabel || '').toLowerCase(); } catch (e) { return ''; } };
// is a feature on? (older browsers do not say: try it, and catch)
function xrFeature(f) {
  const ef = XR.session && XR.session.enabledFeatures;
  if (!ef) return true;
  try { return Array.from(ef).indexOf(f) >= 0; } catch (e) { return true; }
}
function xrDetected(frame, k) {
  try { const s = frame && frame[k]; return s && typeof s.forEach === 'function' ? s : null; } catch (e) { return null; }   // Chromium throws when the feature is off
}
function poseMatrix(frame, space, ref) {
  let pose = null;
  try { pose = space && frame.getPose(space, ref); } catch (e) { pose = null; }
  if (!pose) return null;
  const p = pose.transform.position, q = pose.transform.orientation;
  return _rm.compose(_rv.set(p.x, p.y, p.z), _rq.set(q.x, q.y, q.z, q.w), _rs);
}
function hull2(pts) {
  const P = pts.slice().sort((a, b) => a[0] - b[0] || a[1] - b[1]), cr = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]), lo = [], up = [];
  for (const p of P) { while (lo.length >= 2 && cr(lo[lo.length - 2], lo[lo.length - 1], p) <= 0) lo.pop(); lo.push(p); }
  for (let i = P.length - 1; i >= 0; i--) { const p = P[i]; while (up.length >= 2 && cr(up[up.length - 2], up[up.length - 1], p) <= 0) up.pop(); up.push(p); }
  return lo.slice(0, -1).concat(up.slice(0, -1));
}
const area2 = P => { let a = 0; for (let i = 0, j = P.length - 1; i < P.length; j = i++) a += (P[j][0] + P[i][0]) * (P[j][1] - P[i][1]); return Math.abs(a) / 2; };
const inPoly2 = (P, x, z) => { let c = false; for (let i = 0, j = P.length - 1; i < P.length; j = i++) { const a = P[i], b = P[j]; if ((a[1] > z) !== (b[1] > z) && x < (b[0] - a[0]) * (z - a[1]) / (b[1] - a[1]) + a[0]) c = !c; } return c; };
// the planes and meshes there are, with their lastChangedTime, kept in place (no strings or closures each frame)
function xrSeen(o) {
  const L = XRR.seen, k = XRR.ns, t = o.lastChangedTime || 0;
  if (L[k] !== o || L[k + 1] !== t) { L[k] = o; L[k + 1] = t; XRR.dirty = true; }
  XRR.ns = k + 2;
}
// the reference space was reset (a recentre): the room comes again in new coordinates; the event's transform (where
// the new origin is in the old coordinates) tells the set how to carry the gang along
function xrOnReset(ev) {
  XR.needRecenter = true; XRR.reset = true;
  try { XRR.move = ev && ev.transform ? Array.from(ev.transform.inverse.matrix) : null; } catch (e) { XRR.move = null; }
}
function xrRoom(frame, ref) {
  const now = performance.now();
  if (!XRR.t0) XRR.t0 = now;
  const planes = xrFeature('plane-detection') ? xrDetected(frame, 'detectedPlanes') : null;
  const meshes = xrFeature('mesh-detection') ? xrDetected(frame, 'detectedMeshes') : null;
  XRR.ns = 0;
  if (planes) planes.forEach(xrSeen);
  if (meshes) meshes.forEach(xrSeen);
  if (XRR.seen.length !== XRR.ns) { XRR.seen.length = XRR.ns; XRR.dirty = true; }
  if (XRR.clear !== XR.clear) { XRR.clear = XR.clear; XRR.dirty = true; }
  const again = XRR.ns > 0 && now - XRR.t > 1000;   // planes there: look again once a second
  if (!XRR.dirty && !XRR.reset && !again) return;
  if (XRR.kind && !XRR.reset && now - XRR.t < 500) return;   // at most twice a second
  const wasReset = XRR.reset, F = GL.sets.robots;
  XRR.t = now; XRR.reset = false; XRR.dirty = false;
  // after a recentre your own room's robots, piles and cleaned floor move with the coordinates (or, not knowing
  // how they moved, the robots start again from the dock once the room is read)
  let redock = false;
  if (wasReset && XRR.kind === 'real') { const m = XRR.move; if (m) F.shift(m[0], m[2], m[12], m[14]); else redock = true; }
  XRR.move = null;
  const room = (planes || meshes) && ref ? xrReadRoom(frame, ref, planes, meshes) : null;
  if (room) {
    if (XRR.kind !== 'real' || Math.abs(room.floorY - XRR.floorY) > 0.01) XRR.floorY = room.floorY;   // no millimetre jitter
    XRR.kind = 'real';
    F.setRoom(room);
    if (redock) F.shift(null);
    XRR.walls = room.walls.length; XRR.blocks = room.blocks.length;   // what the headset found (not the walls made from the floor)
  } else if (XRR.kind === 'real' && !wasReset) {
    // the planes went missing for a moment (tracking): keep the room we had, it is still where it was
  } else {
    const kind = XR.clear ? 'model' : 'box';
    if (XRR.kind !== kind && (kind === 'box' || F.room().kind !== 'model')) F.setRoom(kind === 'model' ? F.modelRoom() : BOX_ROOM);
    XRR.kind = kind; XRR.walls = XRR.blocks = 0;
  }
}
// the room in the set's frame, or null when there is not enough of it (no floor, and fewer than two walls)
function xrReadRoom(frame, ref, planes, meshes) {
  const P = [];
  if (planes) planes.forEach(pl => {
    const lab = semantic(pl);
    if (ROOM_SKIP.has(lab)) return;
    let poly = null;
    try { poly = pl.polygon; } catch (e) { poly = null; }
    if (!poly || poly.length < 3) return;
    const M = poseMatrix(frame, pl.planeSpace, ref);
    if (!M) return;
    const pts = Array.from(poly, p => _rv.set(p.x, p.y, p.z).applyMatrix4(M).toArray());
    const n = _rv.set(0, 1, 0).transformDirection(M).toArray();   // the plane's normal is its space's +y
    let y0 = Infinity, y1 = -Infinity;
    for (const p of pts) { y0 = Math.min(y0, p[1]); y1 = Math.max(y1, p[1]); }
    const hor = pl.orientation === 'horizontal' || (pl.orientation !== 'vertical' && Math.abs(n[1]) > 0.8);
    P.push({ lab, hor, n, pts, y0, y1, xz: pts.map(p => [p[0], p[2]]) });
  });
  const headY = XR.head.y;
  // the floor: the plane labelled so (the largest), else the lowest large plane facing up, over a metre below your head
  let fl = null;
  for (const p of P) if (p.hor && p.lab === 'floor' && (!fl || area2(p.xz) > area2(fl.xz))) fl = p;
  if (!fl) for (const p of P) if (p.hor && !p.lab && p.n[1] > 0.7 && p.y1 < headY - 1 && area2(p.xz) > 1 && (!fl || p.y0 < fl.y0)) fl = p;
  // the walls: labelled so, or unlabelled vertical planes taller than 1.5 m
  const W = P.filter(p => !p.hor && (p.lab === 'wall' || (!p.lab && p.y1 - p.y0 > 1.5)));
  const floorY = fl ? fl.pts.reduce((a, q) => a + q[1], 0) / fl.pts.length : W.length ? Math.min(...W.map(w => w.y0)) : headY - 1.6;
  const walls = [];
  for (const w of W) {
    // the segment between the polygon's two extreme points along the wall, at floor level
    const ux = w.n[2], uz = -w.n[0], ul = Math.hypot(ux, uz);
    if (ul < 1e-3) continue;
    let cx = 0, cz = 0, s0 = Infinity, s1 = -Infinity;
    for (const q of w.xz) { cx += q[0] / w.xz.length; cz += q[1] / w.xz.length; }
    for (const q of w.xz) { const s = ((q[0] - cx) * ux + (q[1] - cz) * uz) / ul; s0 = Math.min(s0, s); s1 = Math.max(s1, s); }
    if (s1 - s0 < 0.2) continue;
    walls.push([cx + ux / ul * s0, cz + uz / ul * s0, cx + ux / ul * s1, cz + uz / ul * s1, Math.max(0.5, w.y1 - floorY)]);
  }
  let floor = fl ? fl.xz : [];
  if (!fl) {
    if (walls.length < 2) return null;
    floor = hull2(walls.flatMap(w => [[w[0], w[1]], [w[2], w[3]]]));
    if (floor.length < 3 || area2(floor) < 1) return null;
  }
  const fa = area2(floor), blocks = [];
  // furniture from detected volumes: their footprint's hull and their top above the floor (none huge, none taller than 2.2 m)
  if (meshes) meshes.forEach(m => {
    const lab = semantic(m);
    if (ROOM_SKIP.has(lab) || ROOM_UNDER.has(lab)) return;
    let v = null;
    try { v = m.vertices; } catch (e) { v = null; }
    if (!v || v.length < 9 || v.length > 6000) return;
    const M = poseMatrix(frame, m.meshSpace, ref);
    if (!M) return;
    const xz = [];
    let top = -Infinity, bot = Infinity;
    for (let i = 0; i + 2 < v.length; i += 3) { _rv.set(v[i], v[i + 1], v[i + 2]).applyMatrix4(M); xz.push([_rv.x, _rv.z]); top = Math.max(top, _rv.y - floorY); bot = Math.min(bot, _rv.y - floorY); }
    const poly = hull2(xz);
    if (poly.length < 3 || top < 0.05 || top > 2.2 || area2(poly) > fa / 3) return;
    blocks.push({ poly, h: top, under: bot > 0.12 ? bot : 0, label: lab || 'other' });   // raised (a wall shelf, a screen): robots pass under
  });
  // furniture from labelled horizontal planes (seats, cupboards, beds), unless a volume has it already
  for (const p of P) {
    if (!p.hor || p === fl || !ROOM_BLOCK.has(p.lab)) continue;
    const top = p.pts.reduce((a, q) => a + q[1], 0) / p.pts.length - floorY;
    if (top < 0.05 || top > 1.3) continue;
    const cx = p.xz.reduce((a, q) => a + q[0], 0) / p.xz.length, cz = p.xz.reduce((a, q) => a + q[1], 0) / p.xz.length;
    if (blocks.some(b => inPoly2(b.poly, cx, cz))) continue;
    blocks.push({ poly: p.xz, h: top, label: p.lab });
  }
  return { kind: 'real', floor, walls, blocks, floorY };
}
// what the panel says about the room
function roomLine() {
  if (XRR.kind === 'real') {
    const w = XRR.walls, b = XRR.blocks;
    return `Your room: floor, ${w ? w + ' wall' + (w === 1 ? '' : 's') : 'no walls found (its edges hold)'}, ${b} piece${b === 1 ? '' : 's'} of furniture`;
  }
  if (!XRR.kind) return '';
  if ((xrFeature('plane-detection') || xrFeature('mesh-detection')) && performance.now() - XRR.t0 < 4000) return 'Finding your room …';
  return 'No room setup found: a virtual room round you';
}
// Quest can run its room setup from the page, once a session
const canCapture = () => XRR.kind !== 'real' && !XRR.capture && !!(XR.session && typeof XR.session.initiateRoomCapture === 'function');
function roomCapture() {
  if (!canCapture()) return;
  XRR.capture = true;
  try { const p = XR.session.initiateRoomCapture(); if (p && p.catch) p.catch(() => {}); } catch (e) { /* not now */ }
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
  } else if (h.kind === 'floor' && !XR.stories) {   // the trigger on the floor spills crumbs there
    c.press = { kind: 'floor' };
    if (GL.sets.robots.crumbs(h.x, h.z)) { buzz(c, 0.5, 40); crumbsOut(h.x, h.z); }
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
  if (XR.stories || HOST.anchor.locked(h.kind)) return; // the Stories screen stays put, and so does an anchored place (in a shared room: only at its station, unless locked)
  if (h.kind !== 'panel') return;   // the room stays where it is: only the panel moves
  const p0 = XR.panelGroup.getWorldPosition(new THREE.Vector3());
  c.grab = { target: 'panel', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
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
  } else if (!XR.stories && GL.world.visible) {
    // the floor: where the ray meets it, in the set's frame (the dot lies on the floor there)
    const F = GL.sets.robots;
    _sm.copy(F.group.matrixWorld).invert();
    const fp = F.floorPoint(_xa.copy(c.o).applyMatrix4(_sm).toArray(), _xb.copy(c.d).transformDirection(_sm).toArray());
    if (fp) {
      const w = F.group.localToWorld(_xc.set(fp[0], 0.005, fp[1]));
      hit = { kind: 'floor', x: fp[0], z: fp[1], point: w.clone() };
      dist = w.distanceTo(c.o);
    }
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
    if (hit.kind === 'floor') { c.dot.quaternion.setFromAxisAngle(_xX, -Math.PI / 2); c.dot.scale.setScalar(0.008 * Math.max(0.5, c.dot.position.distanceTo(XR.head))); }
    else { c.dot.lookAt(XR.head); c.dot.scale.setScalar(0.005 * Math.max(0.3, c.dot.position.distanceTo(XR.head))); }
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
    // the room (once the head is known: a virtual room is placed round it), then the world on it
    xrRoom(frame, ref);
  }
  xrPlace();
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
    if (ref && ref.addEventListener) ref.addEventListener('reset', xrOnReset);
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
  // the room is read afresh in each session (the first frame with a head pose places it)
  Object.assign(XRR, { kind: '', sig: '', t: 0, t0: 0, reset: false, capture: false, walls: 0, blocks: 0 });
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
  // keep the cell and the panel where they were in the story before
  const p = HOST.xrPose;
  if (p) {
    XR.needRecenter = false;
    GL.rig.position.copy(p.rp); GL.rig.quaternion.copy(p.rq);
    XR.globeOff.copy(p.off); XR.size = p.s || 1;
    XR.panelGroup.position.copy(p.pp); XR.panelGroup.rotation.set(0, p.pr, 0);
  }
  const ref = GL.renderer.xr.getReferenceSpace();
  if (ref && ref.addEventListener) ref.addEventListener('reset', xrOnReset);
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
  GL.world.visible = true;
  // back on the screen: the model living room, with you standing in it
  const F = GL.sets.robots;
  if (F.room().kind !== 'model') F.setRoom(F.modelRoom());
  Object.assign(XRR, { kind: '', t0: 0, ns: 0, reset: false, move: null, capture: false, clear: null }); XRR.seen.length = 0;   // a new session finds its room afresh
  F.player(0.65, -0.3, Math.atan2(-Math.cos(-2.2), -Math.sin(-2.2)), true);
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
    let s = 's' + audioLabel() + (HOST.room && HOST.room.inRoom() ? 'r' + HOST.room.gripHint : '') + (curCh ? curCh.key : '') + updateLive() + (canCapture() ? roomLine() : '');
    if (it) {
      for (const e of it.els) s += Math.round(Math.max(0, e.o) * 3);
      for (const g of it.grow) s += Math.round(Math.max(0, g.s) * 6);
      if (curCh.key === 'title') s += $('#titleArc').getAttribute('stroke-dashoffset').slice(0, 3) + $('#titleDot').getAttribute('opacity').slice(0, 3);
    }
    return s;
  }
  return ['x', audioLabel(), X.scene, JSON.stringify(X.ctl[X.scene] || {}), liveLine(), roomLine(), canCapture()].join('|');
}
const XR_HERE = 'robots';
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
    // apart at 1.7 m (0.382 m apart, the outer ones 58° to the side), eleven 0.206 rad apart at 1.85 m (0.381 m apart,
    // the outer ones 59° to the side), twelve 0.19 rad apart at 2 m (0.38 m apart, the outer ones 60° to the side),
    // thirteen 0.177 rad apart at 2.15 m (0.381 m apart, the outer ones 61° to the side)
    const n = HOST.list.length, a = (k - (n - 1) / 2) * (n > 12 ? 0.177 : n > 11 ? 0.19 : n > 10 ? 0.206 : n > 9 ? 0.225 : n > 8 ? 0.245 : n > 7 ? 0.272 : 0.31), d = n > 12 ? 2.15 : n > 11 ? 2 : n > 10 ? 1.85 : n > 9 ? 1.7 : n > 8 ? 1.55 : n > 7 ? 1.4 : 1.25;
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
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(`Networks, in ${['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen'][HOST.list.length - 1] || HOST.list.length} stories`, 48, 44);
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
  ctx.fillText(fitText(ctx, 'Robot gang', x - 40), 40, 36);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, HOST.room && HOST.room.inRoom() ? HOST.room.gripHint : HOST.anchor.on ? 'Trigger (or pinch): use buttons, or point at the floor to spill crumbs. A or X: play and pause. Anchored: to move the panel, use Place again on the Stories screen.' : 'Trigger (or pinch): use buttons, or point at the floor to spill crumbs. Grip: move this panel. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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
  // a virtual room stands in for yours: say so, and offer the headset's room setup (where there is space for it)
  if (canCapture() && y + 150 < P.h - 110) {
    y += 10 + textBlock(ctx, roomLine(), x, y + 10, W, 24, 33, VC.amber, 400, 2) + 10;
    vButton(ctx, P, 'room:setup', x, y, 320, 56, 'Set up your room', roomCapture, { px: 24 });
  }
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


// explore: the gang's pane, mirroring the HTML one (no view control: in a headset you look about yourself),
// with what the headset found of your room
function drawExplorePane(ctx, P, x, y, W) {
  const sc = SCENES[0], s = GL.sets.robots;
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink; ctx.fillText(sc[1], x, y);
  y += 50;
  y += textBlock(ctx, 'Robot vacuums on your floor. Point at the floor and pull the trigger to spill crumbs there.', x, y, W, 25, 35, VC.muted, 400, 3) + 14;
  const rl = roomLine();
  if (rl) y += textBlock(ctx, rl, x, y, W, 24, 33, XRR.kind === 'real' ? VC.green : VC.amber, 400, 2) + 10;
  if (canCapture()) { vButton(ctx, P, 'room:setup', x, y, 320, 56, 'Set up your room', roomCapture, { px: 24 }); y += 72; }
  y += 6;
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
  if (y + 60 < bottom) {
    vButton(ctx, P, 'crumbs', x, y, 280, 60, 'Spill crumbs', spillCrumbs, { px: 24, primary: true });
    vButton(ctx, P, 'dust', x + 296, y, 240, 60, 'Dust again', dustAgain, { px: 24 });
    y += 84;
  }
  if (y + 30 < bottom) textBlock(ctx, liveLine(), x, y, W, 24, 33, VC.ink, 400, 1);
}
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x';
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
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('The gang stays for as long as you do.', 28, 58);
}


// ------------------------------------------------------------- narration --
// ------------------------------------------------------------- narration --
// Optional voice-over: put an MP3 at audio/narration-robots.mp3.
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently. The sound engine is the shell's
// (HOST.audio): one engine for the whole app, unlocked by the first tap or click
// and kept running across stories and headset sessions.
let AUD = null;
function audioInit() {
  AUD = HOST.audio.narration('audio/narration-robots.mp3', {
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
    // carry on from what the story shows (its look, the robots where they are), then the explore defaults:
    // follow me, six robots, no cleaned floor, no links, the view from above
    const ts = storyT(this.t), S = storyState(ts);
    for (const n in DEF) XS[n] = S[n];
    const v = storyCam(ts);
    orbit.cur = v.slice(0, 6); orbit.to = null; X.g = v[6];
    X.scene = 'robots'; X.t0 = performance.now();
    X.ctl.robots = { view: 'default', rule: 'follow', robots: '6', trails: 'off', links: 'off' };
    flyTo(view('robots', 'default'));
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

// for tests and screenshots (sweep.mjs): run the gang through the story from t0 to t1, or on in explore mode for a
// number of seconds, in steps of a tenth of a second without drawing (the robots' past is what makes the picture)
function simStory(t0, t1) {
  for (let t = t0; t < t1 - 1e-6; t += 0.1) {
    const v = storyCam(t);
    applyView(v, v[6], false, 0.1); tellRobots(false); updateSets(storyState(t), t, Math.min(0.1, t1 - t), true);
  }
}
function simExplore(sec) {
  for (let k = 0; k < sec * 10; k++) {
    const S = exploreStep(0.1, performance.now());
    orbitStep(performance.now()); applyView(orbit.cur, X.g, viewNow() === 'eyes', 0.1); tellRobots(false); updateSets(S, 0, 0.1, false);
  }
}

let lastNow = 0;
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
    if (!xr) { const v = storyCam(ts); applyView(v, v[6], false, dt); }
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (!xr) applyView(orbit.cur, X.g, viewNow() === 'eyes', dt);
  }
  K.U.uTime.value = (performance.now() / 1000) % 3600;   // the robots live on while the story is paused
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  if (XR.on && !XR.clear) S = Object.assign({}, S, { robots_room: 0 });   // passthrough: your own room, overlays only
  tellRobots(xr);
  updateSets(S, tSet, dt, APP.mode === 'story');
  updateLive();
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
    // #robots&explore&rule=chain&robots=12&trails=on&links=on&view=low (any control by its key);
    // &crumbs spills a pile near you, &walk=x,z walks you there
    orbit.cur = view(X.scene, 'default'); orbit.to = null;
    // controls after the default view, so a control's own view wins
    const s = GL.sets[X.scene];
    // (the story's own key comes first in the hash and is also a control here: robots=12)
    for (const c of s.controls || []) { const v = hp.getAll(c.key).filter(Boolean).pop(); if (v) setCtl(X.scene, c.key, v); }
    if (hp.get('walk')) { const w = hp.get('walk').split(',').map(Number); if (w.length === 2 && w.every(isFinite)) s.walkTo(w[0], w[1]); }
    if (hp.has('crumbs')) spillCrumbs();
    if (hp.has('now')) { Object.assign(XS, exploreTargets()); orbit.cur = orbit.to || orbit.cur; orbit.to = null; X.g = viewNow() === 'low' ? 1 : 0; if (viewNow() === 'eyes') CAMV.e = 1; }
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
  // shared rooms (shared.js): the clock is APP's, the shared state the gang's controls, crumbs and dust effects (the
  // robots themselves run on each device)
  collab: {
    APP, scene: () => GL.scene, state: collabState, apply: collabApply, view: collabView, setView: collabSetView,
    effect(type, d) { if (type === 'crumbs') crumbsIn(d); else if (type === 'dust') dustNow(); },
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
