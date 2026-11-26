// The tutorial: a robot guide stands in your room and shows you how the app works in a headset (pointing, playing a
// story, explore mode, the menu, Recenter, shared rooms), then explore mode is practice: seven small tasks.
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by packages/tutorial/src/build.mjs from the tour's kit and engine (adapted) and the script and set in packages/tutorial/src:
// edit those, not this file.
HOST.register('tutorial', function (HOST) {
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

// ================================================================== SETS ==
// The guide's script (its timeline as data and its evaluator) and the one set: the guide, its props and the room,
// life size (1 unit is 1 m), the viewer standing at the origin. The story drives it through its clock.
const SETS = {};
// The guide's timeline (SCRIPT) and its evaluator (evalGuide): plain maths, no THREE, so a Node test can load it
// (packages/tutorial/src/test-script.mjs). Everything the guide and its props do is a pure function of a clock: the story's
// (story seconds) or the practice's (seconds of this device's own), so a seek, a late joiner or a pause gives the same
// pose. live (the viewer's head and ray, the panel's places) only turns the head and aims the end's pointing.
// The set's frame: floor y = 0, 1 unit = 1 m, the viewer's start at x = z = 0, ahead along -z, right +x.
// The guide's own frame (gestures): its head's floor point, x its left, y up, z its forward.
const GUIDE = (function () {
  const D = Math.PI / 180;
  const mk = b => [+(2.4 * Math.sin(b * D)).toFixed(3), +(-2.4 * Math.cos(b * D)).toFixed(3)];
  const PLACE = {
    home: [0.35, -2.0], m0: mk(-10), m1: mk(2), m2: mk(14), m3: mk(26), m4: mk(38),
    glide: [1.85, -2.0], copy: [1.25, -2.1], lost: [1.25, -2.0], end: [-0.15, -1.7],
  };
  const MARKS = [PLACE.m0, PLACE.m1, PLACE.m2, PLACE.m3, PLACE.m4];
  // the network: the badge (hub 0 and A, B, C: 1 to 3) and six more (a, b, c: 4 to 6 on A, B, C; d, e, f: 7 to 9 on
  // the hub); unit places round its centre, NET.R metres a unit once grown (the badge 0.7 m across)
  const NET = {
    C: [-0.05, 1.3, -1.25], R: 0.35,
    U: [[0, 0, 0], [0, 0.95, 0.12], [-0.83, -0.47, -0.08], [0.83, -0.47, 0.06],
      [0.32, 1.42, -0.22], [-1.36, -0.62, 0.24], [1.3, -0.78, -0.26], [-0.74, 0.56, -0.45], [0.8, 0.5, 0.42], [0.06, -0.92, -0.48]],
    L: [[0, 1], [0, 2], [0, 3], [1, 2], [2, 3], [3, 1], [1, 4], [2, 5], [3, 6], [0, 7], [0, 8], [0, 9]],
    NAME: ['Hub', 'Node', 'Node', 'Node', 'Leaf', 'Leaf', 'Leaf', 'Leaf', 'Leaf', 'Leaf'],
  };
  const PT = [-0.6, 1.5, -1.8];          // the pointing target (chapter 2)
  const EYE = 1.61, SHOULDER = [0.18, 1.4, -0.03];
  // the chapters, in story seconds (the engine's CH is made from these)
  const CH = [
    { key: 'hello', name: 'Hello', a: 0, b: 25 },
    { key: 'point', name: 'Pointing', a: 25, b: 48 },
    { key: 'play', name: 'Playing a story', a: 48, b: 73 },
    { key: 'explore', name: 'Exploring', a: 73, b: 98 },
    { key: 'menu', name: 'The menu', a: 98, b: 124 },
    { key: 'recenter', name: 'Recenter', a: 124, b: 140 },
    { key: 'together', name: 'Together', a: 140, b: 166 },
    { key: 'end', name: 'Your turn', a: 166, b: 187 },
  ];
  // where the main panel's buttons hang on a page (no headset): its home beside a standing viewer, 1.6 m eyes
  const PANEL_PAGE = { stories: [-0.47, 1.98, -0.66], sound: [-0.36, 1.98, -0.58], recenter: [-0.42, 1.98, -0.62], foot: [-0.56, 1.22, -0.86],
    play: [-0.75, 1.22, -0.98], next: [-0.65, 1.22, -0.92], prev: [-0.69, 1.22, -0.95], top: [-0.56, 1.95, -0.86] };
  const ALL = [1, 2, 3, 4, 5, 6, 7, 8];
  return { D, PLACE, MARKS, NET, PT, EYE, SHOULDER, CH, PANEL_PAGE, ALL, T_END: 187, COL: [0.91, 0.93, 0.97], COPY_COL: [1, 0.7, 0.28] };
})();

// ------------------------------------------------------------------ the script, chapter by chapter (relative seconds)
// Each actor (the guide, the copy) has tracks: mv [t0, t1, place, kind: walk | glide | snap | shift], yaw [t, deg, dur]
// (deg from facing the viewer's start; { abs: deg } a heading in the set's frame: 0 along +z), face [t, w], look
// [t, target], eye [t, h], nod [t, n], sweep [t], tilt [t0, t1, deg], l and r [t0, t1, gesture, args, in, out],
// parts [t, 'dark' | 'light' | 'hide' | 'show', ids], [t, 'flash', part], [t, 'power', p, dur]. Props: ray [t0, t1],
// target [t0, t1], lit [t0, t1], marks t, line [t0, t1], net { leave, grow, links, sprout }, dim [t, a, dur], beads
// [t, 'fist'], signals [t, node], menu [t0, t1, kind, opts], trails [t0, t1], card [t0, t1], floor [t0, t1, a0, a1],
// quiet [t0, t1] (the labels hidden), ntag [t0, t1, node], tags [t0, t1, text], copyOn [t0, t1], name [t0, t1].
const SCRIPT = {
  hello: {
    g: {
      mv: [[0, 0, 'home', 'snap']], yaw: [[0, 0, 0]], face: [[0, 1]], look: [[0, 'you']],
      eye: [[12.8, 1.59], [13.3, 1.61]], sweep: [6.4, 12.4],
      l: [[8.2, 11.02, 'tpose', null, 0.15], [20.4, 21.4, 'palms']],
      r: [[8.2, 11.02, 'tpose', null, 0.15], [12.6, 15.6, 'wave', 3], [20.4, 21.4, 'palms']],
      parts: [[0, 'dark', GUIDE.ALL], [0, 'power', 0.12, 0], [0, 'show', [1, 2]],
        [3.0, 'light', [8]], [3.0, 'flash', 8], [3.6, 'light', [7]], [3.6, 'flash', 7], [4.2, 'light', [5]], [4.2, 'flash', 5],
        [4.7, 'light', [6]], [4.7, 'flash', 6], [5.1, 'light', [1, 2]], [5.1, 'flash', 1], [5.5, 'light', [4]], [5.5, 'flash', 4],
        [6.0, 'light', [3]], [6.0, 'flash', 3], [3.0, 'power', 1, 3.0],
        [8.6, 'flash', 7], [9.2, 'flash', 5], [9.8, 'flash', 6], [10.3, 'flash', 4]],
    },
    floor: [[0, 0.01, 0, 0], [6.0, 7.5, 0, 1]], marks: -1, net: { leave: -1 },
    tags: [[8.2, 10.8, 'Calibrating'], [10.8, 12.8, 'Calibration done']],
  },
  point: {
    g: {
      look: [[5.0, 'target'], [6.2, 'ray'], [11.8, 'target'], [17.2, 'ray'], [23, 'you']],
      tilt: [[13.2, 15.6, 6]],
      r: [[0.9, 17.2, 'point', [[0, [1.0, 2.35, -0.7]], [4.6, [1.0, 2.35, -0.7]], [5.4, GUIDE.PT], [6.0, GUIDE.PT], [8.8, 'panel:top'],
        [11.6, GUIDE.PT], [12.4, [GUIDE.PT[0] + 0.04, GUIDE.PT[1], GUIDE.PT[2]]], [15.6, [GUIDE.PT[0] + 0.04, GUIDE.PT[1], GUIDE.PT[2]]], [15.8, GUIDE.PT]], 0.3, 0.3]],
    },
    ray: [[1.2, 17.2]], target: [[5.0, 23]], lit: [[15.8, 17.2]],
    tags: [[13.2, 16.0, 'Correcting: 4 cm left']],
  },
  play: {
    g: {
      face: [[0.9, 0], [22.0, 1]], yaw: [[1.0, 180, 1.5], [5.2, 0, 1.5]], look: [[0.9, 'fwd'], [5.2, 'you'], [8.8, 'panel:foot'], [12.4, 'you']],
      mv: [[6.8, 8.6, 'm0', 'walk'], [13.2, 14.3, 'm1', 'walk'], [15.6, 16.7, 'm2', 'walk'], [18.0, 19.1, 'm3', 'walk'], [20.4, 21.5, 'm4', 'walk']],
      nod: [[22.6, 1]],
      r: [[8.8, 12.4, 'point', [[0, 'panel:foot'], [1.6, 'panel:play'], [2.8, 'panel:next']]]],
      parts: [[2.6, 'flash', 2], [3.0, 'hide', [2]], [8.6, 'flash', 7], [14.3, 'flash', 7], [16.7, 'flash', 7], [19.1, 'flash', 7], [21.5, 'flash', 7]],
    },
    ray: [[9.0, 12.3]], marks: 3.0, line: [4.9, 5.6],
  },
  explore: {
    g: {
      mv: [[1.0, 3.0, 'home', 'walk']], face: [[0, 1]],
      look: [[4.2, 'net'], [9.8, 'node:7'], [10.8, 'node:5'], [11.8, 'node:8'], [12.8, 'node:0'], [17.2, 'net'], [19.0, 'you'], [20.0, 'node:4'], [21.4, 'you']],
      r: [[3.2, 4.0, 'tapChest'], [13.2, 17.2, 'point', 'node:0', 0.9, 0.3]],
      parts: [[4.2, 'hide', [1]], [14.6, 'flash', 6]],
    },
    ray: [[13.6, 17.2]],
    net: { leave: 4.2, grow: [5.8, 8.8], links: [6.0, 6.5, 7.0, 7.5, 8.0, 8.5], sprout: [9.6, 12.6] },
    beads: [[14.6, 'fist']], signals: [[15.2, 0], [20.0, 4]], ntag: [[15.0, 18.0, 0]],
    tags: [[9.0, 11.6, 'Network deployed']],
  },
  menu: {
    g: {
      look: [[1.8, 'menu'], [12.4, 'you'], [12.8, 'arm'], [15.8, 'you'], [16.2, 'menu'], [18.4, 'fwd'], [24.0, 'you']],
      face: [[18.4, 0], [24.0, 1]],
      yaw: [[20.6, 30, 0.12], [21.4, 60, 0.12], [22.0, 0, 0.6]],
      mv: [[18.6, 19.5, 'glide', 'glide'], [22.4, 23.3, 'home', 'glide']],
      r: [[1.8, 3.0, 'stick'], [3.0, 12.2, 'present'], [12.8, 13.8, 'tapArm'], [14.8, 15.8, 'tapArm'], [16.2, 18.2, 'present']],
      l: [[12.8, 13.8, 'forearm'], [14.8, 15.8, 'forearm']],
      parts: [[13.1, 'flash', 6], [15.1, 'flash', 6], [18.6, 'flash', 8], [19.0, 'flash', 8], [22.4, 'flash', 8], [22.8, 'flash', 8]],
    },
    dim: [[0, 0.4, 2]],
    menu: [[3.0, 12.2, 'settings', { tab: 8.0, rows: [8.6, 9.2, 9.8, 10.6] }], [16.2, 18.2, 'sticks']],
    quiet: [[13.2, 14.8]], trails: [[18.5, 19.7], [22.3, 23.5]],
    tags: [[12.8, 13.6, 'Labels: hidden']],
  },
  recenter: {
    g: {
      face: [[0.9, 0], [9.8, 1]],
      yaw: [[1.0, { abs: 90 }, 0.8], [7.2, 60, 0.15], [7.45, 30, 0.15], [7.7, 0, 0.15]],
      mv: [[1.8, 3.6, 'lost', 'walk'], [7.8, 9.6, 'home', 'walk']],
      look: [[1.0, 'fwd'], [3.8, { yaw: -40, pitch: 5 }], [5.0, { yaw: 40, pitch: 0 }], [6.2, { yaw: -15, pitch: -5 }], [7.0, 'fwd'], [7.8, 'you']],
      eye: [[10.0, 1.6], [10.3, 1.61]],
      l: [[10.0, 10.5, 'hang', null, 0.12]], r: [[10.0, 10.5, 'hang', null, 0.12]],
    },
  },
  together: {
    g: {
      nod: [[19.4, 1], [20.4, 1]], look: [[10.2, 'copy'], [13.0, 'you'], [23.6, 'copyPlace'], [24.6, 'you']],
      parts: [[9.6, 'flash', 5], [9.85, 'flash', 3]],
    },
    c: {
      mv: [[0, 0, 'home', 'snap'], [10.4, 12.4, 'copy', 'walk']], face: [[0, 1]], yaw: [[0, 0, 0]], look: [[0, 'you']],
      nod: [[19.4, 1], [20.4, 1]],
      parts: [[0, 'dark', GUIDE.ALL], [0, 'power', 0, 0], [10.4, 'power', 1, 1.6],
        [10.4, 'light', [8]], [10.6, 'light', [7]], [10.85, 'light', [5]], [11.1, 'light', [6]], [11.35, 'light', [1, 2]], [11.6, 'light', [4]], [11.85, 'light', [3]],
        [21.8, 'dark', [3]], [22.0, 'dark', [4]], [22.2, 'dark', [1, 2]], [22.4, 'dark', [5]], [22.6, 'dark', [6]], [22.8, 'dark', [7]], [23.0, 'dark', [8]],
        [23.0, 'power', 0, 0.8]],
    },
    copyOn: [[10.0, 23.8]], name: [[11.0, 21.8]],
    tags: [[10.6, 13.0, 'Copy created'], [23.0, 25.5, 'Copy removed']],
  },
  end: {
    g: {
      mv: [[1.0, 2.6, 'end', 'walk'], [8.4, 10.0, 'home', 'walk']],
      face: [[2.6, 0], [8.4, 1]], yaw: [[2.6, { abs: -20 }, 0.4], [8.4, 0, 0.8]],
      look: [[2.8, 'panel:stories'], [4.9, 'card'], [6.0, 'panel:stories'], [8.0, 'you']],
      r: [[2.8, 8.0, 'point', 'panel:stories'], [10.2, 11.6, 'wave', 2], [12.8, 13.4, 'hang', null, 0.12]],
      l: [[4.8, 8.0, 'present', null, 0.3], [12.8, 13.4, 'hang', null, 0.12]],
      parts: [[14.4, 'dark', [6]], [15.0, 'dark', [5]], [15.6, 'dark', [1, 2]], [16.2, 'dark', [7]], [16.8, 'dark', [8]], [17.4, 'dark', [4]],
        [18.4, 'dark', [3]], [18.6, 'light', [3]], [18.8, 'dark', [3]], [19.0, 'light', [3]], [19.6, 'dark', [3]], [14.4, 'power', 0.12, 5.2]],
    },
    ray: [[3.0, 8.0]], card: [[4.8, 8.0]],
    tags: [[13.0, 16.8, 'Powering down']],
  },
};

// ------------------------------------------------------------------ compiling: chapter times made absolute
function compileScript(script, ch) {
  const G = { g: actorTracks(), c: actorTracks(), ray: [], target: [], lit: [], marks: -1e9, line: [-1e9, -1e9], net: { leave: -1e9, grow: [-1e9, -1e9], links: [], sprout: [-1e9, -1e9] },
    dim: [], beads: [], signals: [], menu: [], trails: [], card: [], floor: [], quiet: [], ntag: [], tags: [], copyOn: [], name: [], end: 0 };
  const sh = (a, x) => (typeof x === 'number' ? x + a : x);
  for (const c of ch) {
    const s = script[c.key];
    if (!s) continue;
    const a = c.a;
    for (const who of ['g', 'c']) {
      const T = s[who];
      if (!T) continue;
      for (const k in T) for (const e of T[k]) {
        if (k === 'sweep') { G[who].sweep.push(e + a); continue; }
        const n = e.slice();
        n[0] += a;
        if (['mv', 'l', 'r', 'tilt'].includes(k)) n[1] += a;
        if ((k === 'l' || k === 'r') && Array.isArray(n[3]) && Array.isArray(n[3][0])) n[3] = n[3].map(([t, tg]) => [t + n[0], tg]);
        G[who][k].push(n);
      }
    }
    for (const k of ['ray', 'target', 'lit', 'trails', 'card', 'quiet', 'ntag', 'tags', 'copyOn', 'name']) for (const e of s[k] || []) { const n = e.slice(); n[0] += a; n[1] += a; G[k].push(n); }
    for (const k of ['dim', 'beads', 'signals']) for (const e of s[k] || []) { const n = e.slice(); n[0] += a; G[k].push(n); }
    for (const e of s.menu || []) { const o = Object.assign({}, e[3] || {}); if (o.tab !== undefined) o.tab += a; if (o.rows) o.rows = o.rows.map(x => x + a); G.menu.push([e[0] + a, e[1] + a, e[2], o]); }
    for (const e of s.floor || []) G.floor.push([e[0] + a, e[1] + a, e[2], e[3]]);
    if (s.marks >= 0) G.marks = s.marks + a;
    if (s.line) G.line = [s.line[0] + a, s.line[1] + a];
    if (s.net && s.net.leave >= 0) G.net = { leave: s.net.leave + a, grow: s.net.grow.map(x => x + a), links: s.net.links.map(x => x + a), sprout: s.net.sprout.map(x => x + a) };
    G.end = Math.max(G.end, c.b);
  }
  sortG(G);
  return G;
}
function actorTracks() { return { mv: [], yaw: [], face: [], look: [], eye: [], nod: [], sweep: [], tilt: [], l: [], r: [], parts: [] }; }
function sortG(G) {
  for (const who of ['g', 'c']) for (const k in G[who]) G[who][k].sort((x, y) => (k === 'sweep' ? x - y : x[0] - y[0]));
  for (const k of ['ray', 'target', 'lit', 'dim', 'beads', 'signals', 'menu', 'trails', 'card', 'floor', 'quiet', 'ntag', 'tags', 'copyOn', 'name']) G[k].sort((x, y) => x[0] - y[0]);
}

// ------------------------------------------------------------------ easing and small maths
const gClamp = (x, a, b) => Math.max(a, Math.min(b, x));
const gSmooth = x => { x = gClamp(x, 0, 1); return x * x * (3 - 2 * x); };
const gOut3 = x => { x = gClamp(x, 0, 1); return 1 - (1 - x) * (1 - x) * (1 - x); };
const gWrap = a => ((a + 180) % 360 + 360) % 360 - 180;   // degrees into -180 .. 180
const gLerp = (a, b, x) => a + (b - a) * x;
const gV = (a, b, x) => [a[0] + (b[0] - a[0]) * x, a[1] + (b[1] - a[1]) * x, a[2] + (b[2] - a[2]) * x];
const gNorm = v => { const l = Math.hypot(v[0], v[1], v[2]) || 1; return [v[0] / l, v[1] / l, v[2] / l]; };
// distance along a move of length L over T s at time x s: constant speed with ramps of r s at each end
function gTrap(x, T, L, r) {
  if (T <= 0) return L;
  r = Math.min(r, T / 2);
  const v = L / (T - r);
  if (x <= 0) return 0;
  if (x >= T) return L;
  if (x < r) return v * x * x / (2 * r);
  if (x > T - r) return L - v * (T - x) * (T - x) / (2 * r);
  return v * (r / 2 + x - r);
}
const RAMP = { walk: 0.3, glide: 0.1, snap: 0.075, shift: 0.4 };
// a move's cruise speed (m/s, story time) and its length
function moveSpeed(from, m) {
  const p = GUIDE.PLACE[m[2]] || m[2], L = Math.hypot(p[0] - from[0], p[1] - from[1]), T = m[1] - m[0], r = Math.min(RAMP[m[3]] || 0.3, T / 2);
  return { L, T, v: T > 0 ? L / (T - r) : 0 };
}
// where an actor stands (the floor point under its head) at t, and how far it has walked (for the bob)
function gPos(A, t) {
  let p = GUIDE.PLACE.home, walked = 0;
  for (const m of A.mv) {
    const q = GUIDE.PLACE[m[2]] || m[2];
    if (t < m[0]) break;
    const L = Math.hypot(q[0] - p[0], q[1] - p[1]);
    if (m[3] === 'snap' && m[1] <= m[0]) { p = q; continue; }
    const T = Math.max(m[1] - m[0], m[3] === 'snap' ? 0.15 : 0), d = gTrap(t - m[0], T, L, RAMP[m[3]] || 0.3);
    if (m[3] === 'walk') walked += d;
    if (t < m[0] + T) { const k = L > 0 ? d / L : 1, x = t - m[0]; return { p: [gLerp(p[0], q[0], k), gLerp(p[1], q[1], k)], walked, moving: m[3], env: m[3] === 'walk' ? gSmooth(Math.min(x, T - x) / 0.35) : 0 }; }
    p = q;
  }
  return { p, walked, moving: '', env: 0 };
}
const gBearing = (p, to) => Math.atan2(to[0] - p[0], to[2] - p[1]) / GUIDE.D;   // the heading (deg) from p (x, z) towards to (x, y, z)
// the turn: eased in and out over most of its length (the owner, 21 November 2026: less robotic), then a small
// overshoot of 1.5 degrees settling in 0.3 s
function gTurn(t, k0, v0, v1, dur) {
  const x = t - k0, d = v1 - v0;
  if (x <= 0) return v0;
  if (x < dur) return v0 + d * (dur > 0 ? gTrap(x, dur, 1, dur * 0.4) : 1);
  const y = x - dur;
  return y < 0.3 && Math.abs(d) > 5 ? v1 + Math.sign(d) * 1.5 * Math.sin(Math.PI * y / 0.3) * (1 - y / 0.3) : v1;
}
// a target's place in the set's frame (live: the viewer's head and ray, the panel's buttons)
function gTarget(tg, t, live, G) {
  if (Array.isArray(tg)) return tg;
  if (typeof tg !== 'string') return null;
  if (tg === 'you') return live.head;
  if (tg === 'target') return GUIDE.PT;
  if (tg === 'net') return GUIDE.NET.C;
  if (tg === 'ray') return live.ray || GUIDE.PT;
  if (tg === 'copy') return G && G.copyHead ? G.copyHead : [GUIDE.PLACE.copy[0], 1.6, GUIDE.PLACE.copy[1]];
  if (tg === 'copyPlace') return [GUIDE.PLACE.copy[0], 1.3, GUIDE.PLACE.copy[1]];
  if (tg.startsWith('panel:')) { const k = tg.slice(6); return (live.panel && live.panel[k]) || GUIDE.PANEL_PAGE[k] || GUIDE.PANEL_PAGE.top; }
  if (tg.startsWith('node:')) return gNode(+tg.slice(5));
  if (tg.startsWith('mark:')) { const m = GUIDE.MARKS[+tg.slice(5)]; return [m[0], 0, m[1]]; }
  return null;
}
const gNode = i => { const u = GUIDE.NET.U[i] || [0, 0, 0], C = GUIDE.NET.C, R = GUIDE.NET.R; return [C[0] + u[0] * R, C[1] + u[1] * R, C[2] + u[2] * R]; };
// a point in the set's frame into the actor's own (origin its floor point, x its left, z its forward)
function gLocal(P, h, q) {
  const s = Math.sin(h * GUIDE.D), c = Math.cos(h * GUIDE.D), dx = q[0] - P[0], dz = q[2] - P[1];
  return [dx * c - dz * s, q[1], dx * s + dz * c];
}
// a gesture's wrist and aim (the actor's frame); side 0 left, 1 right
function gGesture(g, side, args, t, t0, P, h, live, G) {
  const sg = side ? -1 : 1, sh = [sg * GUIDE.SHOULDER[0], GUIDE.SHOULDER[1], GUIDE.SHOULDER[2]];
  switch (g) {
    case 'tpose': return { w: [sg * 0.725, 1.41, 0], a: [sg, 0, 0] };
    case 'wave': {
      const s = Math.tanh(3 * Math.sin(2 * Math.PI * 1.6 * (t - t0))) / Math.tanh(3);
      return { w: [sg * 0.36 + 0.08 * s, 1.62, 0.12], a: [sg * 0.25 + 0.1 * s, 1, 0.1] };
    }
    case 'palms': return { w: [sg * 0.27, 1.45, 0.3], a: [sg * 0.25, 0.85, 0.45] };
    case 'tapChest': return { w: [sg * 0.04, 1.33, 0.22], a: [0, 0, -1] };
    case 'forearm': return { w: [sg * 0.1, 1.15, 0.38], a: [-sg * 0.3, 0, 1] };
    case 'tapArm': return { w: [-sg * 0.02, 1.22, 0.3], a: [-sg * 0.6, -0.7, 0.25] };
    case 'stick': { const m = (t - t0) / 1.2, press = m > 0.4 && m < 0.65 ? 0.02 : 0; return { w: [sg * 0.15, 1.05 - press, 0.3], a: [0, -0.5, 1] }; }
    case 'present': return { w: [sg * 0.3, 1.25, 0.35], a: [0, Math.sin(20 * GUIDE.D), Math.cos(20 * GUIDE.D)] };
    case 'point': case 'aimOff': {
      let tg = args;
      if (Array.isArray(args) && Array.isArray(args[0])) {
        // keyframes [[t, target] ...]: eased from one to the next
        let i = 0;
        while (i + 1 < args.length && t >= args[i + 1][0]) i++;
        const a = gTarget(args[i][1], t, live, G), b = i + 1 < args.length ? gTarget(args[i + 1][1], t, live, G) : a;
        const span = i + 1 < args.length ? args[i + 1][0] - args[i][0] : 1, x = i + 1 < args.length ? gSmooth((t - args[i][0]) / span) : 0;
        tg = gV(a, b, x);
      } else tg = gTarget(args, t, live, G);
      const q = gLocal(P, h, tg || GUIDE.PT), d = gNorm([q[0] - sh[0], q[1] - sh[1], q[2] - sh[2]]);
      return { w: [sh[0] + 0.5 * d[0], sh[1] + 0.5 * d[1], sh[2] + 0.5 * d[2]], a: d, at: tg };
    }
    default: return { w: [sg * 0.21, 0.87, 0.02], a: [0, -1, 0] };   // hang (where bodies.js puts a hand given none)
  }
}
// the hanging hands carry this frame's life (gLifeHands, set by evalActor: the arms' swing on a walk and their drift)
let gLifeHands = [[0, 0, 0], [0, 0, 0]];
const HANG = side => { const o = gLifeHands[side]; return { w: [(side ? -1 : 1) * 0.21 + o[0], 0.87 + o[1], 0.02 + o[2]], a: [0, -1, 0] }; };
// life: never quite still (the owner, 21 November 2026: "not stand totally still"): breathing, a slow weight shift,
// small drifts of the head and the hands, a side-to-side sway and the arms swinging on a walk. Sums of slow sines, a
// pure function of t (a seek, a pause or a late joiner gives the same pose), damped while the robot is powered down.
const gWave = (t, f, ph) => Math.sin(2 * Math.PI * f * t + ph);
function gLife(t, ph, pos, power) {
  const k = gSmooth((power - 0.15) / 0.6), still = 1 - pos.env, step = Math.PI * pos.walked / 0.35;
  const breath = gWave(t, 0.22, ph);
  const shift = (0.7 * gWave(t, 0.11, ph + 1) + 0.3 * gWave(t, 0.27, ph + 2)) * still;   // -1 .. 1, the weight from foot to foot
  return {
    // the head's offset in its own frame (x its left, z its forward), its yaw, pitch and roll (degrees)
    dx: (0.012 * shift + 0.014 * Math.sin(step) * pos.env) * k, dz: 0.005 * gWave(t, 0.07, ph + 3) * still * k,
    dy: (0.004 * breath - 0.006 * shift * shift - 0.014 * Math.abs(Math.sin(step)) * pos.env) * k,
    yaw: (2.2 * gWave(t, 0.13, ph + 4) + 1.2 * gWave(t, 0.31, ph + 5)) * k,
    pitch: (1.4 * gWave(t, 0.17, ph + 6) + 0.6 * breath) * k,
    roll: (1.2 * gWave(t, 0.09, ph + 7) - 1.6 * shift + 1.5 * Math.sin(step) * pos.env) * k,
    breath: 0.003 * breath * k,
    hands: [0, 1].map(s => { const sw = (s ? -1 : 1) * Math.sin(step) * pos.env, sg = s ? -1 : 1;
      return [(sg * 0.012 + 0.008 * gWave(t, 0.12, ph + 8 + s * 2)) * k, 0.02 * Math.abs(sw) * k,
        (0.10 * sw + 0.012 * gWave(t, 0.15, ph + 9 + s * 3) * still) * k]; }),
  };
}
const gMix = (A, B, x) => ({ w: gV(A.w, B.w, x), a: gNorm(gV(A.a, B.a, x)), at: x > 0.5 ? B.at : A.at });
// a hand at t: the latest span begun, eased in from where the hand was as it began, and out to hanging after it
function gHand(spans, i, side, t, P, h, live, G) {
  while (i >= 0 && t < spans[i][0]) i--;
  if (i < 0) return HANG(side);
  const s = spans[i], din = s[4] || 0.18, dout = s[5] || 0.18;
  const from = gHand(spans, i - 1, side, s[0], P, h, live, G);
  if (t <= s[1]) return gMix(from, gGesture(s[2], side, s[3], t, s[0], P, h, live, G), gOut3((t - s[0]) / din));
  const at = gMix(from, gGesture(s[2], side, s[3], s[1], s[0], P, h, live, G), gOut3((s[1] - s[0]) / din));
  return gMix(at, HANG(side), gOut3((t - s[1]) / dout));
}
// the parts at t: hidden and dark masks, power, and the latest flash
function gParts(list, t) {
  let hide = 0, dark = 0, pw = 1, p0 = 1, pt = -1, pd = 0, pv = 1, flash = null;
  const bits = ids => ids.reduce((m, i) => m | (1 << i), 0);
  for (const e of list) {
    if (e[0] > t) break;
    if (e[1] === 'hide') hide |= bits(e[2]);
    else if (e[1] === 'show') hide &= ~bits(e[2]);
    else if (e[1] === 'dark') dark |= bits(e[2]);
    else if (e[1] === 'light') dark &= ~bits(e[2]);
    else if (e[1] === 'flash') { const a = 1 - (t - e[0]) / 0.35; flash = a > 0 ? [e[2], Math.min(0.99, a)] : flash && flash[1] > 0 ? flash : null; }
    else if (e[1] === 'power') { p0 = pt < 0 ? pv : gLerp(p0, pv, gClamp((e[0] - pt) / (pd || 1e-6), 0, 1)); pt = e[0]; pd = e[3]; pv = e[2]; }
  }
  if (pt >= 0) pw = pd > 0 ? gLerp(p0, pv, gClamp((t - pt) / pd, 0, 1)) : pv;
  return { hide, dark, power: pw, flash };
}
// a value track [t, v] eased (smooth) over d s from the value before
function gEase(list, t, d, v) {
  for (const e of list) {
    if (e[0] > t) break;
    v = gLerp(v, e[1], gSmooth((t - e[0]) / d));
  }
  return v;
}

// ------------------------------------------------------------------ one actor at t
function evalActor(A, t, live, G) {
  const pos = gPos(A, t), P = pos.p, base = gBearing(P, [0, 0, 0]), parts = gParts(A.parts, t);
  const life = gLife(t, G && A === G.c ? 2.3 : 0, pos, parts.power);
  // its heading: the scripted turns (from facing the viewer's start), then blended towards the viewer's live head
  const rel = gTurnValue(A.yaw, t);
  const face = gEase(A.face, t, 0.4, 1);
  const toYou = gBearing(P, live.head);
  let heading = base + rel;
  heading += gWrap(toYou - heading) * face;
  // eye height, with the life's breathing, weight shift and the bob of a walk
  const eye = gEase(A.eye, t, 0.3, GUIDE.EYE) + life.dy;
  // the look: towards its target (at most 80 degrees off the heading), eased between targets over 0.25 s
  const headP = [P[0], eye, P[1]];
  const lookOf = tg => {
    if (tg === 'fwd' || !tg) return [0, 0];
    if (typeof tg === 'object' && !Array.isArray(tg)) return [tg.yaw || 0, tg.pitch || 0];
    if (tg === 'menu' || tg === 'card' || tg === 'arm') return tg === 'arm' ? [-25, -40] : [-20, -22];
    const q = gTarget(tg, t, live, G);
    if (!q) return [0, 0];
    const dx = q[0] - headP[0], dy = q[1] - headP[1], dz = q[2] - headP[2];
    return [gClamp(gWrap(Math.atan2(dx, dz) / GUIDE.D - heading), -80, 80), gClamp(Math.atan2(dy, Math.hypot(dx, dz)) / GUIDE.D, -60, 50)];
  };
  let ly = 0, lp = 0;
  {
    let i = -1;
    for (let k = 0; k < A.look.length && A.look[k][0] <= t; k++) i = k;
    if (i >= 0) {
      const cur = lookOf(A.look[i][1]), prev = i > 0 ? lookOf(A.look[i - 1][1]) : [0, 0], x = gSmooth((t - A.look[i][0]) / 0.4);
      ly = gLerp(prev[0], cur[0], x); lp = gLerp(prev[1], cur[1], x);
    }
  }
  // nods, the visor's sweep, a puzzled tilt
  let nod = 0, sweep = 0, roll = 0;
  for (const e of A.nod) { const x = t - e[0]; if (x >= 0 && x < e[1] * 0.28) { const y = x % 0.28; nod = -14 * (y < 0.14 ? gSmooth(y / 0.14) : 1 - gSmooth((y - 0.14) / 0.14)); } }
  for (const s of A.sweep) { const x = t - s; if (x >= 0 && x < 0.6) sweep = x < 0.15 ? -15 * gSmooth(x / 0.15) : x < 0.45 ? -15 + 30 * gSmooth((x - 0.15) / 0.3) : 15 - 15 * gSmooth((x - 0.45) / 0.15); }
  for (const e of A.tilt) { const x = t - e[0]; if (x >= 0 && t <= e[1] + 0.3) roll = e[2] * Math.min(gSmooth(x / 0.3), gSmooth((e[1] + 0.3 - t) / 0.3)); }
  const hy = heading + ly + sweep + life.yaw, hp = lp + nod + life.pitch;
  roll += life.roll;
  // the head pose: [x, y, z, qx, qy, qz, qw], looking along its -z: a turn (hy + 180) about y, then pitch, then roll
  const q = qMul(qMul(qAxis(0, 1, 0, (hy + 180) * GUIDE.D), qAxis(1, 0, 0, hp * GUIDE.D)), qAxis(0, 0, 1, roll * GUIDE.D));
  gLifeHands = life.hands;
  const hands = [0, 1].map(s => gHand(s ? A.r : A.l, (s ? A.r : A.l).length - 1, s, t, P, heading, live, G));
  gLifeHands = [[0, 0, 0], [0, 0, 0]];
  for (const h of hands) h.w[1] += life.breath;
  // (the head's sway in the set's frame; the floor point P stays where the script puts it)
  const hs = Math.sin(heading * GUIDE.D), hc = Math.cos(heading * GUIDE.D);
  const hx = P[0] + life.dx * hc + life.dz * hs, hz = P[1] - life.dx * hs + life.dz * hc;
  return { p: P, heading, eye, head: [hx, eye, hz, q[0], q[1], q[2], q[3]], hands, hide: parts.hide, dark: parts.dark, power: parts.power, flash: parts.flash,
    moving: pos.moving, look: [hy, hp] };
}
// a yaw track's relative heading at t (each key turns from where the last left it)
function gTurnValue(list, t) {
  let v = 0, out = 0;
  for (const e of list) {
    if (e[0] > t) break;
    const want = typeof e[1] === 'object' ? e._rel : e[1];
    out = gTurn(t, e[0], v, want, e[2]);
    v = want;
  }
  return out;
}
const qAxis = (x, y, z, a) => { const s = Math.sin(a / 2); return [x * s, y * s, z * s, Math.cos(a / 2)]; };
const qMul = (a, b) => [a[3] * b[0] + a[0] * b[3] + a[1] * b[2] - a[2] * b[1], a[3] * b[1] - a[0] * b[2] + a[1] * b[3] + a[2] * b[0],
  a[3] * b[2] + a[0] * b[1] - a[1] * b[0] + a[2] * b[3], a[3] * b[3] - a[0] * b[0] - a[1] * b[1] - a[2] * b[2]];
// absolute headings in yaw tracks resolved once (relative to facing the viewer's start where the turn ends)
function resolveYaw(A) {
  for (const e of A.yaw) if (typeof e[1] === 'object') e._rel = gWrap(e[1].abs - gBearing(gPos(A, e[0] + e[2]).p, [0, 0, 0]));
}

// ------------------------------------------------------------------ the whole frame at t
const LIVE0 = { head: [0, 1.6, 0], ray: null, panel: null, room: false };
function evalGuide(G, t, live) {
  live = live || LIVE0;
  if (!G.resolved) { resolveYaw(G.g); resolveYaw(G.c); G.resolved = true; }
  const on = list => list.some(e => t >= e[0] && t <= e[1]);
  const fade = (list, din, dout) => list.reduce((a, e) => Math.max(a, Math.min(gSmooth((t - e[0]) / din), gSmooth((e[1] + dout - t) / dout))), 0);
  const copyA = fade(G.copyOn, 0.01, 0.01) > 0 ? evalActor(G.c, t, live, G) : null;
  G.copyHead = copyA ? copyA.head.slice(0, 3) : null;
  const F = { t, g: evalActor(G.g, t, live, G), c: copyA };
  F.ray = fade(G.ray, 0.3, 0.2);
  F.target = fade(G.target, 0.3, 0.3);
  F.lit = on(G.lit);
  F.marks = t - G.marks;   // seconds since the markers left the spine
  F.line = gSmooth((t - G.line[0]) / Math.max(0.01, G.line[1] - G.line[0]));
  const N = G.net;
  F.net = { fly: gClamp((t - N.leave) / 1.6, 0, 1), left: t >= N.leave, grow: gSmooth((t - N.grow[0]) / Math.max(0.01, N.grow[1] - N.grow[0])),
    links: N.links.map(x => gSmooth((t - x) / 0.3)), sprout: gSmooth((t - N.sprout[0]) / Math.max(0.01, N.sprout[1] - N.sprout[0])) };
  F.net.dim = gEaseD(G.dim, t, 1);
  F.beads = beadsAt(G, t, F.net.sprout > 0.5);
  F.menu = null;
  for (const m of G.menu) if (t >= m[0] - 0.01 && t <= m[1] + 0.3) {
    const a = Math.min(gSmooth((t - m[0]) / 0.3), gSmooth((m[1] + 0.3 - t) / 0.3));
    F.menu = { a, kind: m[2], tab: m[3].tab !== undefined && t >= m[3].tab, rows: (m[3].rows || []).map(x => (t >= x ? 1 : 0)), shown: m[3].tab === undefined || t >= m[3].tab };
  }
  F.trails = on(G.trails);
  F.card = fade(G.card, 0.3, 0.3);
  F.floor = 1;
  for (const e of G.floor) if (t >= e[0]) F.floor = gLerp(e[2], e[3], gSmooth((t - e[0]) / Math.max(0.01, e[1] - e[0])));
  F.quiet = on(G.quiet);
  F.ntag = -1;
  for (const e of G.ntag) if (t >= e[0] && t <= e[1]) F.ntag = e[2];
  F.tag = null; F.tagA = 0;
  for (const e of G.tags) if (t >= e[0] && t <= e[1] + 0.2) { F.tag = e[2]; F.tagA = Math.min(gSmooth((t - e[0]) / 0.2), gSmooth((e[1] + 0.2 - t) / 0.2)); }
  F.name = on(G.name);
  F.copyA = fade(G.copyOn, 0.01, 0.01);
  return F;
}
function gEaseD(list, t, v) {
  for (const e of list) { if (e[0] > t) break; v = gLerp(v, e[1], gSmooth((t - e[0]) / Math.max(0.01, e[2]))); }
  return v;
}
// the signals: from a node, hop by hop (breadth first) along the links there are, a bead a link in 0.35 s; and a bead
// from the fist to the hub (0.4 s). Beads [from, to, x (0 to 1)]; from 'fist' is the right fist
function beadsAt(G, t, grown) {
  const out = [], n = grown ? 10 : 4, links = GUIDE.NET.L.filter(l => l[0] < n && l[1] < n);
  for (const b of G.beads) { const x = (t - b[0]) / 0.4; if (x >= 0 && x <= 1) out.push(['fist', 0, x]); }
  for (const s of G.signals) {
    const x0 = t - s[0];
    if (x0 < 0 || x0 > 2.5) continue;
    const lv = gLevels(s[1], links, n);
    for (const [a, b] of links) {
      let u = a, v = b;
      if (lv[b] < lv[a]) { u = b; v = a; }
      if (lv[v] !== lv[u] + 1) continue;
      const x = (x0 - lv[u] * 0.35) / 0.35;
      if (x >= 0 && x <= 1) out.push([u, v, x]);
    }
  }
  return out;
}
function gLevels(src, links, n) {
  const lv = new Array(n).fill(99);
  if (!(src >= 0 && src < n)) return lv;
  lv[src] = 0;
  const q = [src];
  while (q.length) { const u = q.shift(); for (const [a, b] of links) { const v = a === u ? b : b === u ? a : -1; if (v >= 0 && lv[v] > lv[u] + 1) { lv[v] = lv[u] + 1; q.push(v); } } }
  return lv;
}
// how long a signal from a node takes to reach the furthest node (s), for signalOn
const signalSpan = (src, grown) => { const n = grown ? 10 : 4, lv = gLevels(src, GUIDE.NET.L.filter(l => l[0] < n && l[1] < n), n); return Math.max(...lv.filter(x => x < 99)) * 0.35; };

// The guide: a robot (the people's street-armour figure, bodies.js, posed by ik.js) driven by the script (sets/script.js:
// SCRIPT, evalGuide) instead of a person, and the props it makes from its own body: the ray from its fist, a target,
// five markers from its spine, the network from its chest badge, a mini menu, a copy of itself, boot trails, a card,
// status tags. Life size: 1 unit is 1 m, the floor y = 0, the viewer's start at the origin looking along -z.
// Everything is a pure function of a clock (the story's, or practice's own), so seeking works; the solver's state is
// warmed again after a jump. Where bodies cannot be drawn (no float textures in a vertex shader, or an older shell) a
// plain figure of boxes and cylinders stands in, in the same head and hand frames.
SETS.guide = function (K) {
  const { THREE, clamp, lerp } = K;
  const set = K.newSet('guide');
  const V3 = () => new THREE.Vector3(), D = Math.PI / 180, NET = GUIDE.NET;
  const params = { guide_clock: 0, guide_mode: 0, guide_net: 1 };
  let G = compileScript(SCRIPT, GUIDE.CH);
  // ------------------------------------------------------------------ the figures: bodies.js, else the plain figure
  const FIG = { kind: 'wait', S: null, B: [null, null], asked: performance.now(), dead: false, last: [null, null], plain: null, fail: '' };
  const forcePlain = typeof location !== 'undefined' && /[?&#]nofvt\b/.test(location.search + location.hash);
  function usePlain(why) {
    if (FIG.kind === 'plain' || FIG.dead) return;
    FIG.kind = 'plain'; FIG.fail = why || '';
    if (FIG.S) { FIG.S.dispose(); FIG.S = null; }
    FIG.plain = [plainFigure(GUIDE.COL), plainFigure(GUIDE.COPY_COL)];
    for (const p of FIG.plain) set.group.add(p.g);
  }
  // ------------------------------------------------------------------ materials
  const mat = (o, base) => K.fade(set, new THREE.MeshBasicMaterial(Object.assign({ transparent: true }, o)), base === undefined ? 1 : base);
  const lam = (o, base) => K.fade(set, new THREE.MeshLambertMaterial(Object.assign({ transparent: true }, o)), base === undefined ? 1 : base);
  const op = (m, x) => { m.opacity = m.userData.base * set.uA.value * clamp(x, 0, 1); };
  const add = (g, m, ro) => { const o = new THREE.Mesh(g, m); if (ro) o.renderOrder = ro; set.group.add(o); return o; };
  const CYAN = 0x46d9ff, PEARL = 0xe8eef8, AMBER = 0xffb347;
  // additive light that leaves the layer's alpha alone (as bodies.js's halo and the ships' ADD): AdditiveBlending also adds
  // alpha, so in AR a fading glow's whole shape went opaque over the passthrough, a black patch (the owner, 24 November 2026)
  const ADD = { blending: THREE.CustomBlending, blendEquation: THREE.AddEquation, blendSrc: THREE.SrcAlphaFactor, blendDst: THREE.OneFactor,
    blendEquationAlpha: THREE.AddEquation, blendSrcAlpha: THREE.ZeroFactor, blendDstAlpha: THREE.OneFactor };
  // ------------------------------------------------------------------ the room: a dark floor with a grid fading out from 3 m (VR and the page)
  const floorMat = K.fade(set, new THREE.ShaderMaterial({
    uniforms: { uA: set.uA, uG: { value: 0 } }, transparent: true, depthWrite: false,
    vertexShader: 'varying vec2 vP; void main() { vP = position.xy; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: `uniform float uA, uG; varying vec2 vP;
void main() {
  float r = length(vP), e = 1.0 - smoothstep(3.4, 4.0, r);
  vec2 g = abs(fract(vP / 0.5 + 0.5) - 0.5) * 0.5 / fwidth(vP);
  float line = (1.0 - smoothstep(0.0, 1.0, min(g.x, g.y))) * uG * (1.0 - smoothstep(1.5, 3.0, r));
  gl_FragColor = vec4(mix(vec3(0.016, 0.03, 0.05), vec3(0.32, 0.4, 0.5), line * 0.55), (0.96 * e) * uA);
}`, extensions: { derivatives: true },
  }));
  const floor = add(new THREE.CircleGeometry(4, 64), floorMat, -2);
  floor.rotation.x = -Math.PI / 2; floor.position.y = -0.002;
  // soft contact shadows under each figure
  const shTex = (() => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d'), gr = x.createRadialGradient(32, 32, 2, 32, 32, 31);
    gr.addColorStop(0, 'rgba(0,0,0,0.55)'); gr.addColorStop(1, 'rgba(0,0,0,0)'); x.fillStyle = gr; x.fillRect(0, 0, 64, 64); return new THREE.CanvasTexture(c); })();
  const shadows = [0, 1].map(() => { const m = add(new THREE.PlaneGeometry(0.75, 0.75), mat({ map: shTex, depthWrite: false }), -1); m.rotation.x = -Math.PI / 2; m.position.y = 0.003; return m; });
  // ------------------------------------------------------------------ the ray, its dot, the target
  const rayGeo = new THREE.CylinderGeometry(0.003, 0.003, 1, 8, 1, true); rayGeo.translate(0, 0.5, 0);
  const rayMat = K.fade(set, new THREE.ShaderMaterial({ uniforms: { uA: set.uA, uK: { value: 1 } }, transparent: true, depthWrite: false, ...ADD,
    vertexShader: 'varying float vY; void main() { vY = position.y; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }',
    fragmentShader: 'uniform float uA, uK; varying float vY; void main() { gl_FragColor = vec4(0.27, 0.85, 1.0, (1.0 - smoothstep(0.7, 1.0, vY)) * 0.9 * uA * uK); }' }));
  const ray = add(rayGeo, rayMat, 5), dot = add(new THREE.SphereGeometry(0.006, 12, 8), mat({ color: CYAN }), 5);
  const ringMat = mat({ color: 0x8fb4d8 }), ring = add(new THREE.TorusGeometry(0.07, 0.006, 8, 40), ringMat);
  const ringCore = add(new THREE.CircleGeometry(0.06, 32), mat({ color: CYAN, side: THREE.DoubleSide, depthWrite: false }, 0.0));
  // ------------------------------------------------------------------ the markers (from the spine), their numbers and the line joining them
  const hexG = new THREE.CylinderGeometry(0.09, 0.09, 0.01, 6), gemG = new THREE.OctahedronGeometry(0.022);
  const hexMat = lam({ color: 0x2a3442, emissive: 0x000000 }), gemMat = mat({ color: PEARL });
  const hexes = new THREE.InstancedMesh(hexG, hexMat, 5), gems = new THREE.InstancedMesh(gemG, gemMat, 5);
  hexes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(15).fill(1), 3);
  gems.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(15).fill(1), 3);
  set.group.add(hexes, gems);
  const numTex = n => { const c = document.createElement('canvas'); c.width = c.height = 64; const x = c.getContext('2d');
    x.fillStyle = '#e8eef8'; x.font = '700 40px system-ui, sans-serif'; x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillText(String(n), 32, 34); return new THREE.CanvasTexture(c); };
  const nums = [0, 1, 2, 3, 4].map(i => { const m = add(new THREE.PlaneGeometry(0.05, 0.05), mat({ map: numTex(i + 1), depthWrite: false }), 2); m.rotation.x = -Math.PI / 2; return m; });
  const lineGeo = new THREE.BufferGeometry().setAttribute('position', new THREE.BufferAttribute(new Float32Array(8 * 3), 3));
  const lineMat = K.fade(set, new THREE.LineBasicMaterial({ color: 0x6f8fb0, transparent: true }), 0.55), line = new THREE.LineSegments(lineGeo, lineMat);
  set.group.add(line);
  // ------------------------------------------------------------------ the network (from the badge): nodes, white cores, links, beads
  const nodeMat = lam({ color: PEARL, emissive: 0x2a3a52 }), coreMat = mat({ color: 0xffffff }), linkMat = mat({ color: 0xbfd2ea }, 0.85), beadMat = mat(Object.assign({ color: 0xffffff, depthWrite: false }, ADD));
  const nodes = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 0), nodeMat, 10), cores = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(1, 1), coreMat, 10);
  nodes.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(30).fill(1), 3);
  const linkG = new THREE.CylinderGeometry(1, 1, 1, 6, 1, true); linkG.translate(0, 0.5, 0);
  const links = new THREE.InstancedMesh(linkG, linkMat, 12), beads = new THREE.InstancedMesh(new THREE.SphereGeometry(0.012, 10, 8), beadMat, 24);
  links.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(36).fill(1), 3);
  for (const m of [nodes, cores, links, beads]) { m.frustumCulled = false; set.group.add(m); }
  // ------------------------------------------------------------------ boot trails: six fading discs a boot
  const trails = new THREE.InstancedMesh(new THREE.CircleGeometry(0.06, 16), mat(Object.assign({ color: PEARL, depthWrite: false }, ADD)), 12);
  trails.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(36), 3); trails.frustumCulled = false; set.group.add(trails);
  // ------------------------------------------------------------------ holograms: the mini menu, the card, the narration hold's sign
  function holo(w, h, px) {
    const c = document.createElement('canvas'); c.width = px; c.height = Math.round(px * h / w);
    const tex = new THREE.CanvasTexture(c), m = add(new THREE.PlaneGeometry(w, h), mat({ map: tex, side: THREE.DoubleSide, depthWrite: false }), 6);
    return { c, x: c.getContext('2d'), tex, m, sig: '' };
  }
  const menu = holo(0.32, 0.2, 512), card = holo(0.3, 0.18, 480), sign = holo(0.56, 0.2, 700);
  const rr = (x, a, b, w, h, r) => { x.beginPath(); x.moveTo(a + r, b); x.arcTo(a + w, b, a + w, b + h, r); x.arcTo(a + w, b + h, a, b + h, r); x.arcTo(a, b + h, a, b, r); x.arcTo(a, b, a + w, b, r); x.closePath(); };
  function drawMenu(F) {
    const M = F.menu, sig = M.kind + M.tab + M.rows.join('') + M.shown;
    if (sig === menu.sig) return;
    menu.sig = sig;
    const x = menu.x, W = menu.c.width, H = menu.c.height;
    x.clearRect(0, 0, W, H); rr(x, 4, 4, W - 8, H - 8, 22); x.fillStyle = 'rgba(10,18,30,0.86)'; x.fill(); x.strokeStyle = 'rgba(70,217,255,0.7)'; x.lineWidth = 3; x.stroke();
    x.font = '700 30px system-ui, sans-serif'; x.fillStyle = '#e7eef8'; x.textBaseline = 'middle'; x.fillText('Menu', 26, 36);
    const tabs = ['Story', 'Settings', 'Circles', 'Debug'];
    x.font = '24px system-ui, sans-serif';
    tabs.forEach((t, i) => { const on = (M.kind === 'sticks' || M.tab) && i === 1; rr(x, 22 + i * 120, 62, 112, 40, 10); x.fillStyle = on ? '#46d9ff' : 'rgba(160,178,202,0.18)'; x.fill(); x.fillStyle = on ? '#04131c' : '#cfd9e6'; x.fillText(t, 34 + i * 120, 83); });
    if (!M.shown && M.kind !== 'sticks') return;
    const rows = M.kind === 'sticks' ? [['Moving with the sticks: on', 1]] : ['Narration', 'Subtitles', 'Sound', 'Labels', 'Moving with the sticks'].map((n, i) => [n, M.rows[i] || 0]);
    rows.forEach(([n, on], i) => { x.fillStyle = on ? '#e7eef8' : 'rgba(207,217,230,0.55)'; x.font = (on ? '700 ' : '') + '23px system-ui, sans-serif'; x.fillText((on ? '▸ ' : '   ') + n, 26, 132 + i * 37); });
    menu.tex.needsUpdate = true;
  }
  function drawCard(room) {
    const sig = 'c' + room;
    if (card.sig === sig) return;
    card.sig = sig;
    const x = card.x, W = card.c.width, H = card.c.height;
    x.clearRect(0, 0, W, H); rr(x, 4, 4, W - 8, H - 8, 20); x.fillStyle = 'rgba(8,26,38,0.88)'; x.fill(); x.strokeStyle = '#46d9ff'; x.lineWidth = 4; x.stroke();
    x.textBaseline = 'middle'; x.fillStyle = '#46d9ff'; x.font = '24px system-ui, sans-serif'; x.fillText(room ? 'Next' : 'Network theory', 28, 60);
    x.fillStyle = '#e7eef8'; x.font = '700 40px system-ui, sans-serif'; x.fillText(room ? 'Your circle’s stories' : 'Next: Airports', 28, 130);
    card.tex.needsUpdate = true;
  }
  function drawSign() {
    if (sign.sig) return;
    sign.sig = 's';
    const x = sign.x, W = sign.c.width, H = sign.c.height;
    x.clearRect(0, 0, W, H); rr(x, 4, 4, W - 8, H - 8, 20); x.fillStyle = 'rgba(10,18,30,0.9)'; x.fill(); x.strokeStyle = 'rgba(232,238,248,0.8)'; x.lineWidth = 3; x.stroke();
    x.fillStyle = '#e7eef8'; x.textBaseline = 'middle';
    const L = ['My voice is off. Point at Narration off, on the panel,', 'and pull the trigger (or pinch).', 'Or press Play to go on without it.'];
    L.forEach((s, i) => { x.font = (i ? '' : '700 ') + '27px system-ui, sans-serif'; x.fillText(s, 24, 50 + i * 76 * (H - 40) / 230); });
    sign.tex.needsUpdate = true;
  }
  // ------------------------------------------------------------------ the plain figure (where bodies cannot be drawn)
  function plainFigure(col) {
    const g = new THREE.Group(), c = new THREE.Color(...col), plate = c.clone().multiplyScalar(0.28);
    const pm = lam({ color: plate }), lm = mat({ color: c.clone() });
    const box = (w, h, d, m) => { const o = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), m || pm); g.add(o); return o; };
    const cyl = m => { const geo = new THREE.CylinderGeometry(0.045, 0.04, 1, 10); geo.translate(0, 0.5, 0); const o = new THREE.Mesh(geo, m || pm); g.add(o); return o; };
    const P = { g, pm, lm, col: c, helmet: box(0.22, 0.26, 0.24), visor: box(0.17, 0.04, 0.02, lm), torso: box(0.36, 0.5, 0.22), pelvis: box(0.3, 0.14, 0.2),
      arms: [cyl(), cyl()], legs: [cyl(), cyl()], boots: [box(0.11, 0.08, 0.26), box(0.11, 0.08, 0.26)], fists: [box(0.08, 0.08, 0.08), box(0.08, 0.08, 0.08)],
      emblem: new THREE.InstancedMesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 6), lm, 4), spine: new THREE.InstancedMesh(new THREE.SphereGeometry(0.018, 8, 6), lm, 5),
      pts: {} };
    g.add(P.emblem, P.spine);
    return P;
  }
  const _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _q2 = new THREE.Quaternion(), _e = new THREE.Euler(), _a = V3(), _b = V3(), _c = V3(), _d = V3(), _s = new THREE.Vector3(1, 1, 1), _Y = new THREE.Vector3(0, 1, 0), _col = new THREE.Color();
  // a point of the actor's own frame (x its left, z its forward, from its floor point) in the set's frame
  const toSet = (A, p, out) => { const s = Math.sin(A.heading * D), c = Math.cos(A.heading * D); return out.set(A.p[0] + p[0] * c + p[2] * s, p[1], A.p[1] - p[0] * s + p[2] * c); };
  const EMB = [[0, 1.33, 0.12], [0, 1.37, 0.12], [-0.034, 1.31, 0.12], [0.034, 1.31, 0.12]], SPN = [0, 1, 2, 3, 4].map(i => [0, 1.47 - i * 0.1, -0.14]);
  function posePlain(P, A, I) {
    const look = A.look, show = !(I.hide & 1) && I.power > 0.001 && !I.gone;
    P.g.visible = show;
    if (!show) return;
    const off = [0, 0, -0.08];   // (the body about 8 cm behind its eyes)
    toSet(A, [0, A.eye + 0.02, 0.02], P.helmet.position); P.helmet.rotation.set(-look[1] * D, look[0] * D, 0, 'YXZ');
    P.visor.position.copy(toSet(A, [0, A.eye, 0.13], _a)); P.visor.rotation.copy(P.helmet.rotation);
    toSet(A, [0, 1.28, off[2]], P.torso.position); P.torso.rotation.set(0, A.heading * D, 0);
    toSet(A, [0, 0.98, off[2]], P.pelvis.position); P.pelvis.rotation.copy(P.torso.rotation);
    for (let i = 0; i < 2; i++) {
      const sg = i ? -1 : 1, sh = toSet(A, [sg * 0.235, 1.46, off[2]], _a), w = toSet(A, A.hands[i].w, _b);
      const arm = P.arms[i]; arm.position.copy(sh); _c.copy(w).sub(sh); arm.scale.set(1, _c.length(), 1); arm.quaternion.setFromUnitVectors(_Y, _c.normalize());
      P.fists[i].position.copy(w); P.pts[i ? 'rfist' : 'lfist'] = w.toArray();
      const hip = toSet(A, [sg * 0.1, 0.92, off[2]], _a), foot = toSet(A, [sg * 0.1, 0.07, off[2] + 0.03], _d);
      const leg = P.legs[i]; leg.position.copy(foot); _c.copy(hip).sub(foot); leg.scale.set(1, _c.length(), 1); leg.quaternion.setFromUnitVectors(_Y, _c.normalize());
      P.boots[i].position.copy(foot).setY(0.04); P.boots[i].rotation.copy(P.torso.rotation);
      P.pts[i ? 'rboot' : 'lboot'] = [foot.x, 0, foot.z];
    }
    for (let i = 0; i < 4; i++) { toSet(A, EMB[i], _a); _m.compose(_a, _q.setFromEuler(_e.set(Math.PI / 2, A.heading * D, 0, 'YXZ')), _s); P.emblem.setMatrixAt(i, _m); P.pts['emblem' + i] = _a.toArray(); }
    for (let i = 0; i < 5; i++) { toSet(A, SPN[i], _a); _m.compose(_a, _q.identity(), _s); P.spine.setMatrixAt(i, _m); P.pts['spine' + i] = _a.toArray(); }
    P.emblem.instanceMatrix.needsUpdate = P.spine.instanceMatrix.needsUpdate = true;
    P.emblem.visible = !(I.hide & 2); P.spine.visible = !(I.hide & 4);
    P.pts.visor = P.visor.position.toArray(); P.pts.chest = toSet(A, [0, 1.33, off[2]], _a).toArray();
    // the lights: power as brightness, a dark part off, a flash towards white
    const fl = I.flash ? I.flash[1] : 0, on = (I.dark & 8 ? 0.15 : 1) * I.power;
    P.lm.color.copy(P.col).multiplyScalar(0.2 + 0.8 * on).lerp(_col.setRGB(1, 1, 1), fl * 0.6);
    P.pm.emissive.copy(P.col).multiplyScalar(0.05 * I.power);
  }
  // ------------------------------------------------------------------ live input (the engine's see(): the viewer's head and ray, the panel, the room)
  const LIVE = { head: [0, 1.6, 0], ray: null, panel: null, room: false, ar: false, hover: -1, paused: false, hold: false, labels: true };
  // ------------------------------------------------------------------ practice (explore mode): its own clock and script
  const PR = { on: false, t: 0, run: true, G: null, idleTo: 0, mk: -1, want: -1 };
  // the live clock (real seconds, always running): signals sent in explore mode and from the room
  const LC = { t: 0, sig: [], last: -1e9 };
  function practiceScript() {
    const P = { g: actorTracks(), c: actorTracks(), ray: [], target: [], lit: [], marks: -1e9, line: [-1e9, -1e9],
      net: { leave: -1e9, grow: [-1e9, -1e9], links: [], sprout: [-1e9, -1e9] }, dim: [], beads: [], signals: [], menu: [], trails: [], card: [], floor: [], quiet: [], ntag: [], tags: [], copyOn: [], name: [] };
    const g = P.g;
    g.mv.push([0, 0, 'home', 'snap']); g.face.push([0, 1]); g.look.push([0, 'you']); g.yaw.push([0, 0, 0]);
    g.parts.push([0, 'dark', GUIDE.ALL], [0, 'power', 0.12, 0], [0, 'power', 1, 1.2]);
    [8, 7, 5, 6, 1, 4, 3].forEach((p, i) => g.parts.push([0.15 * i, 'light', p === 1 ? [1, 2] : [p]], [0.15 * i, 'flash', p]));
    g.parts.push([0, 'hide', [1, 2]]);
    P.tags.push([0.3, 3.3, 'Practice mode']);
    return P;
  }
  const pushT = (list, e) => { list.push(e); list.sort((x, y) => x[0] - y[0]); };
  // the idle loop, 30 s at a time ahead of the clock: a weight shift every 4 s, a visor sweep every 9 s, a glance every 6 s
  function idleAhead() {
    const P = PR.G;
    while (PR.idleTo < PR.t + 40) {
      const t0 = Math.max(3, PR.idleTo), t1 = t0 + 30;
      for (let t = Math.ceil(t0 / 9) * 9; t < t1; t += 9) P.g.sweep.push(t + 0.5);
      for (let t = Math.ceil(t0 / 6) * 6; t < t1; t += 6) { pushT(P.g.look, [t + 0.2, 'net']); pushT(P.g.look, [t + 1.6, 'you']); }
      for (let t = Math.ceil(t0 / 4) * 4, k = 0; t < t1; t += 4, k++) pushT(P.g.eye, [t, k % 2 ? 1.6 : 1.61]);
      P.g.sweep.sort((x, y) => x - y);
      PR.idleTo = t1;
    }
  }
  // what the guide does in practice, started now on its clock
  function react(kind, a, b) {
    if (!PR.G) return;
    const t = PR.t, g = PR.G.g;
    if (kind === 'done') {
      pushT(g.face, [t, 1]); pushT(g.look, [t, 'you']); pushT(g.nod, [t + 0.3, 2]);
      pushT(PR.G.tags, [t, t + 2.5, `Task ${a} of ${b}: done`]);
    } else if (kind === 'all') {
      pushT(PR.G.tags, [t, t + 4, 'Practice complete']);
      pushT(g.face, [t, 0]);
      [90, 180, 270, 360].forEach((y, i) => pushT(g.yaw, [t + 0.2 + i * 0.75, y, 0.3]));
      pushT(g.yaw, [t + 3.3, 0, 0]); pushT(g.face, [t + 3.25, 1]);
      pushT(g.r, [t + 3.4, t + 4.6, 'wave', 2]);
    } else if (kind === 'signal') {
      pushT(g.look, [t, 'node:' + a]); pushT(g.r, [t, t + 1.4, 'point', 'node:' + a]); pushT(g.look, [t + 1.6, 'you']);
    } else if (kind === 'nudge') {
      if (a === 0) { pushT(g.look, [t, 'node:0']); pushT(g.r, [t, t + 1.6, 'point', 'node:0']); }
      else if (a === 2 || a === 3) { pushT(g.look, [t, 'panel:foot']); pushT(g.r, [t, t + 1.6, 'point', a === 2 ? 'panel:play' : 'panel:next']); }
      else if (a === 4) pushT(g.r, [t, t + 1.2, 'stick']);
      else if (a === 5) { pushT(g.look, [t, 'panel:recenter']); pushT(g.r, [t, t + 1.6, 'point', 'panel:recenter']); }
      else pushT(g.look, [t, 'node:1']);
      pushT(g.look, [t + 1.9, 'you']);
    }
  }
  // practice: walk to marker i at 0.6 m/s (from where it stands now)
  function walkTo(i) {
    if (!PR.G) { PR.want = i; return; }
    if (i === PR.mk) return PR.t;
    const g = PR.G.g, from = evalActor(g, PR.t, LIVE, PR.G).p, to = GUIDE.MARKS[clamp(i, 0, 4)], L = Math.hypot(to[0] - from[0], to[1] - from[1]);
    // (a move under way ends where it is now: the new one starts from here)
    g.mv = g.mv.filter(m => m[0] <= PR.t);
    const last = g.mv[g.mv.length - 1];
    if (last && last[1] > PR.t) { last[1] = PR.t; last[2] = from; last[3] = 'snap'; last[0] = PR.t; }
    const end = PR.t + Math.max(0.6, L / 0.6 + 0.3);
    g.mv.push([PR.t, end, 'm' + clamp(i, 0, 4), 'walk']);
    PR.mk = i;
    return end;
  }
  // ------------------------------------------------------------------ one frame
  let last = null, F = null, figT = [null, null], copyWas = false;
  const H = [[0, 0, 0, 0, 0, 0, 1], [0, 0, 0, 0, 0, 0, 1]], I0 = { head: null, g: H, floor: 0, toWorld: null, rgb: GUIDE.COL, dt: 0, ease: 0 };
  // the grips (bodies.js) for an actor's two hands: worked out in its own frame (facing +z), turned with its heading
  function grips(A, out, k) {
    _q2.setFromAxisAngle(_Y, A.heading * D);
    for (let i = 0; i < 2; i++) {
      const h = A.hands[i], g = HOST.bodies.grip(i ? 'r' : 'l', h.w, h.a, out[i], k);
      _a.set(g[0], g[1], g[2]).applyQuaternion(_q2); _q.set(g[3], g[4], g[5], g[6]).premultiply(_q2);
      g[0] = _a.x + A.p[0]; g[1] = _a.y; g[2] = _a.z + A.p[1]; g[3] = _q.x; g[4] = _q.y; g[5] = _q.z; g[6] = _q.w;
    }
    return out;
  }
  // its look this frame, with the live guard: the viewer's head within 0.6 m of its head dims it, within 0.35 m hides it
  function look(A, rgb) {
    const d = Math.hypot(A.head[0] - LIVE.head[0], A.head[1] - LIVE.head[1], A.head[2] - LIVE.head[2]);
    return { hide: d < 0.35 ? 511 : A.hide, dark: A.dark, power: d < 0.6 ? Math.min(0.3, A.power) : A.power, flash: d < 0.6 ? null : A.flash, rgb };
  }
  // an actor drawn by bodies.js at clock t; re-warmed after a jump (a seek, a late join, a gap over 0.5 s): 30 steps of
  // 1/30 s over the second before t, solve only
  function drawBody(i, A, t, mode, evalAt) {
    const B = FIG.B[i], S = FIG.S, L = HOST.bodies, tw = set.group.matrixWorld, rgb = i ? GUIDE.COPY_COL : GUIDE.COL;
    const prev = figT[i];
    const jump = !prev || prev.mode !== mode || t < prev.t - 1e-6 || t - prev.t > 0.5;
    if (jump) {
      for (let k = 0; k < 30; k++) {
        const tk = t - 1 + k / 30, Ak = evalAt(tk);
        if (!Ak) continue;
        S.add(B, Object.assign({}, I0, { head: Ak.head, g: grips(Ak, H, B.k), toWorld: tw, rgb, dt: k ? 1 / 30 : 0, jump: k === 0, warm: true }));
      }
    }
    const lk = look(A, rgb);
    const ok = S.add(B, Object.assign({}, I0, { head: A.head, g: grips(A, H, B.k), toWorld: tw, rgb, dt: jump ? 1 / 30 : Math.max(0, t - prev.t), hide: lk.hide, dark: lk.dark, power: lk.power, flash: lk.flash }));
    figT[i] = { t, mode };
    return ok;
  }
  // a named point of an actor in the set's frame (bodies.point is in the world: back through the set's frame)
  const _inv = new THREE.Matrix4();
  function pointOf(i, name, out) {
    if (FIG.kind === 'bodies' && FIG.B[i] && FIG.B[i].drawn !== undefined) {
      const w = HOST.bodies.point(FIG.B[i], name, { toWorld: set.group.matrixWorld }, out);
      return w ? out.applyMatrix4(_inv) : null;
    }
    if (FIG.kind === 'plain') { const p = FIG.plain[i].pts[name]; return p ? out.fromArray(p) : null; }
    // (not yet known: worked out from the script's own frame)
    const A = i ? F && F.c : F && F.g;
    if (!A) return null;
    if (name === 'rfist' || name === 'lfist') return toSet(A, A.hands[name === 'rfist' ? 1 : 0].w, out);
    if (name.startsWith('emblem')) return toSet(A, EMB[+name.slice(6)], out);
    if (name.startsWith('spine')) return toSet(A, SPN[+name.slice(5)], out);
    return toSet(A, [0, 1.33, 0], out);
  }
  function update(S, t, dt) {
    if (FIG.dead) return;
    set.group.updateWorldMatrix(true, false);
    _inv.copy(set.group.matrixWorld).invert();
    const mode = S.guide_mode > 0.5 ? 1 : 0;
    LC.t += Math.max(0, dt || 0);
    if (mode && !PR.on) {
      PR.on = true; PR.t = 0; PR.G = practiceScript(); PR.idleTo = 0; PR.mk = -1;
      if (PR.want >= 0) { PR.G.g.mv.push([0, 0, 'm' + PR.want, 'snap']); PR.mk = PR.want; }
    }
    if (!mode) { PR.on = false; PR.G = null; }
    if (mode && PR.run && !LIVE.paused) PR.t += Math.max(0, Math.min(0.1, dt || 0));
    if (mode) idleAhead();
    const Gc = mode ? PR.G : G, clock = mode ? PR.t : S.guide_clock;
    F = evalGuide(Gc, clock, LIVE);
    if (mode) { F.marks = 99; F.line = 1; F.floor = 1; F.net = { fly: 1, left: true, grow: 1, links: [1, 1, 1, 1, 1, 1], sprout: S.guide_net > 0.5 ? 1 : 0, dim: 1 }; F.beads = []; F.target = 0; F.ray = rayOfPractice(); }
    F.beads = F.beads.concat(liveBeads(F.net.sprout > 0.5));
    // the narration hold: it points at the panel's Sound button (Narration off) and looks at it
    if (LIVE.hold && !mode) { F.g.hands[1] = gGesture('point', 1, 'panel:sound', clock, clock, F.g.p, F.g.heading, LIVE, Gc); F.ray = 1; }
    // the figures
    const stand = Math.min(1, set.uA.value);
    if (FIG.kind === 'bodies') {
      const Sx = FIG.S;
      Sx.attach(rootOf(set.group));
      Sx.begin(clock * 1000);
      if (stand > 0.003) {
        drawBody(0, F.g, clock, mode, tk => evalGuide(Gc, tk, LIVE).g);
        if (F.c) drawBody(1, F.c, clock, mode, tk => evalGuide(Gc, tk, LIVE).c);
        else figT[1] = null;
      }
      Sx.end();
    } else if (FIG.kind === 'plain') {
      posePlain(FIG.plain[0], F.g, look(F.g));
      if (F.c) posePlain(FIG.plain[1], F.c, look(F.c)); else FIG.plain[1].g.visible = false;
    }
    copyWas = !!F.c;
    // shadows
    shadows[0].position.set(F.g.p[0], 0.003, F.g.p[1] - 0.05); op(shadows[0].material, F.g.hide & 1 ? 0 : 0.9);
    shadows[1].visible = !!F.c; if (F.c) { shadows[1].position.set(F.c.p[0], 0.003, F.c.p[1] - 0.05); op(shadows[1].material, 0.9 * F.copyA); }
    // the room: a floor and its grid in VR and on a page, nothing in AR (the real floor)
    floor.visible = !LIVE.ar; floorMat.uniforms.uG.value = F.floor;
    drawRay(F);
    drawTarget(F);
    drawMarks(F, mode);
    drawNet(F, mode);
    drawTrails(F, Gc, clock);
    drawHolos(F);
    TAG.text = LIVE.paused && (mode || clock > GUIDE.CH[2].a) ? 'Paused' : F.tag || '';
    TAG.a = LIVE.paused && (mode || clock > GUIDE.CH[2].a) ? 1 : F.tagA;
  }
  const rootOf = o => { while (o.parent) o = o.parent; return o; };
  // practice: the ray is on while the guide points (its right hand's span)
  function rayOfPractice() {
    const r = PR.G.g.r; let a = 0;
    for (const s of r) if (s[2] === 'point' && PR.t >= s[0] + 0.25 && PR.t <= s[1]) a = Math.min(1, (PR.t - s[0] - 0.25) / 0.3, (s[1] - PR.t) / 0.2);
    return a;
  }
  // the ray from the right fist along the aim (to its target where it has one), its dot where it meets it
  function drawRay(F) {
    const on = F.ray > 0.01 && !(F.g.hide & 1);
    ray.visible = dot.visible = on;
    if (!on) return;
    const h = F.g.hands[1], fist = pointOf(0, 'rfist', _a);
    if (!fist) { ray.visible = dot.visible = false; return; }
    let dir;
    if (h.at) dir = _b.fromArray(h.at).sub(fist);
    else { _q2.setFromAxisAngle(_Y, F.g.heading * D); dir = _b.set(h.a[0], h.a[1], h.a[2]).applyQuaternion(_q2); }
    const len0 = h.at ? dir.length() : 3;
    dir.normalize();
    const from = _c.copy(fist).addScaledVector(dir, 0.07), len = Math.max(0.05, (len0 - 0.07) * F.ray);
    ray.position.copy(from); ray.quaternion.setFromUnitVectors(_Y, dir); ray.scale.set(1, len, 1);
    rayMat.uniforms.uK.value = F.ray;
    dot.position.copy(from).addScaledVector(dir, len); op(dot.material, F.ray);
    dot.visible = !!h.at && F.ray > 0.95;
  }
  function drawTarget(F) {
    const a = F.target, on = a > 0.01;
    ring.visible = ringCore.visible = on;
    if (!on) return;
    ring.position.fromArray(GUIDE.PT); ringCore.position.copy(ring.position);
    _a.fromArray(LIVE.head); ring.lookAt(_a); ringCore.lookAt(_a);
    ring.scale.setScalar(0.3 + 0.7 * a);
    const lit = F.lit || LIVE.hover === 'target';
    ringMat.color.setHex(lit ? CYAN : 0x8fb4d8); op(ringMat, a); op(ringCore.material, lit ? 0.35 * a : 0);
  }
  // the markers: from the spine's nodes (0.3 s apart, 0.8 s each, along an arc, turning flat) to the floor
  function drawMarks(F, mode) {
    const T = F.marks, here = nearMark(F.g.p);
    let shown = 0;
    for (let i = 0; i < 5; i++) {
      const x = clamp((T - 0.3 * i) / 0.8, 0, 1), m = GUIDE.MARKS[i];
      if (T < 0.3 * i) { _m.makeScale(0, 0, 0); hexes.setMatrixAt(i, _m); gems.setMatrixAt(i, _m); nums[i].visible = false; continue; }
      shown++;
      const from = pointOf(0, 'spine' + i, _a) || _a.set(m[0], 1.3, m[1]), e = gSmooth(x);
      _b.set(lerp(from.x, m[0], e), lerp(from.y, 0.006, e) + Math.sin(Math.PI * x) * 0.45, lerp(from.z, m[1], e));
      _q.setFromEuler(_e.set((1 - e) * Math.PI / 2, F.g.heading * D * (1 - e), 0, 'YXZ'));
      const s = 0.25 + 0.75 * e;
      _m.compose(_b, _q, _c.set(s, s, s)); hexes.setMatrixAt(i, _m);
      _d.set(0, 0.035, 0).applyQuaternion(_q).multiplyScalar(s).add(_b);
      _m.compose(_d, _q2.setFromAxisAngle(_Y, LC.t * 0.8 + i), _c.set(s, s, s)); gems.setMatrixAt(i, _m);
      const lit = i === here && x >= 1;
      hexes.setColorAt(i, _col.setRGB(lit ? 1.6 : 1, lit ? 1.7 : 1, lit ? 1.9 : 1));
      gems.setColorAt(i, lit ? _col.setRGB(1, 1, 1) : _col.setRGB(0.55, 0.6, 0.7));
      nums[i].visible = x >= 1; nums[i].position.set(m[0] + 0.045, 0.013, m[1] + 0.035); op(nums[i].material, 0.8);
    }
    hexes.instanceMatrix.needsUpdate = gems.instanceMatrix.needsUpdate = true;
    hexes.instanceColor.needsUpdate = gems.instanceColor.needsUpdate = true;
    hexes.visible = gems.visible = shown > 0;
    hexMat.emissive.setHex(here >= 0 ? 0x101820 : 0);
    // the line on the floor joining them in order, drawn as it grows
    const k = clamp(F.line, 0, 1) * 4, pos = lineGeo.attributes.position.array;
    let n = 0;
    for (let j = 0; j < 4 && j < k; j++) {
      const a = GUIDE.MARKS[j], b = GUIDE.MARKS[j + 1], f = Math.min(1, k - j);
      pos.set([a[0], 0.004, a[1], lerp(a[0], b[0], f), 0.004, lerp(a[1], b[1], f)], n * 6); n++;
    }
    lineGeo.setDrawRange(0, n * 2); lineGeo.attributes.position.needsUpdate = true;
    line.visible = n > 0;
  }
  const nearMark = p => GUIDE.MARKS.findIndex(m => Math.hypot(m[0] - p[0], m[1] - p[1]) < 0.2);
  // the network: the badge leaves the chest (1.6 s), grows to its place (0.7 m across), six more nodes sprout; signals
  // run as beads along the links; dimmed while the story moves on; a node the viewer points at lights
  const NP = NET.U.map(() => V3());
  function nodePlace(i, F, out) {
    const N = F.net, fin = _d.fromArray(gNode(i));
    if (i < 4) {
      const g = N.grow, s = lerp(0.03 / 0.35, 1, g), C = _c.fromArray(NET.C);
      fin.sub(C).multiplyScalar(s).add(C);
      if (N.fly < 1) {
        const from = pointOf(0, 'emblem' + i, out) || out.copy(C);
        const C2 = _c.fromArray(NET.C), e = gSmooth(N.fly);
        const sm = _b.fromArray(gNode(i)).sub(C2).multiplyScalar(0.03 / 0.35).add(C2);
        return out.lerpVectors(from, sm, e).setY(lerp(from.y, sm.y, e) + Math.sin(Math.PI * N.fly) * 0.15);
      }
      return out.copy(fin);
    }
    const a = NET.L.find(l => l[1] === i)[0], A = _b.fromArray(gNode(a));
    return out.lerpVectors(A, fin, N.sprout);
  }
  function drawNet(F, mode) {
    const N = F.net, on = N.left;
    nodes.visible = cores.visible = links.visible = on;
    if (!on) { beads.count = 0; return; }
    const n = N.sprout > 0.001 ? 10 : 4, dim = N.dim;
    for (let i = 0; i < 10; i++) {
      if (i >= n) { _m.makeScale(0, 0, 0); nodes.setMatrixAt(i, _m); cores.setMatrixAt(i, _m); continue; }
      nodePlace(i, F, NP[i]);
      const grow = i < 4 ? lerp(0.25, 1, N.grow) : N.sprout, r = (i ? 0.0175 : 0.025) * grow, hv = LIVE.hover === i;
      _m.compose(NP[i], _q.setFromEuler(_e.set(0.4 * i, LC.t * 0.3 + i, 0)), _c.set(r, r, r)); nodes.setMatrixAt(i, _m);
      _m.compose(NP[i], _q.identity(), _c.set(r * 0.45, r * 0.45, r * 0.45)); cores.setMatrixAt(i, _m);
      const glow = (hv ? 1 : 0) + nodeFlash(i, F);
      nodes.setColorAt(i, _col.setRGB(1, 1, 1).multiplyScalar(dim * (1 + glow * 0.8)));
    }
    let li = 0;
    for (let j = 0; j < 12; j++) {
      const [a, b] = NET.L[j];
      if (a >= n || b >= n) { _m.makeScale(0, 0, 0); links.setMatrixAt(j, _m); continue; }
      const lit = j < 6 ? N.links[j] : N.sprout;
      _c.copy(NP[b]).sub(NP[a]);
      const len = _c.length();
      _m.compose(NP[a], _q.setFromUnitVectors(_Y, _c.normalize()), _d.set(0.002 * (j < 6 ? lerp(0.5, 1, N.grow) : 1), len, 0.002 * (j < 6 ? lerp(0.5, 1, N.grow) : 1)));
      links.setMatrixAt(j, _m); links.setColorAt(j, _col.setRGB(1, 1, 1).multiplyScalar(dim * (0.25 + 0.75 * lit))); li++;
    }
    nodes.instanceMatrix.needsUpdate = cores.instanceMatrix.needsUpdate = links.instanceMatrix.needsUpdate = true;
    nodes.instanceColor.needsUpdate = links.instanceColor.needsUpdate = true;
    op(nodeMat, 1); op(coreMat, dim); op(linkMat, 1);
    // beads
    let k = 0;
    for (const [u, v, x] of F.beads) {
      if (k >= 24) break;
      const A = u === 'fist' ? pointOf(0, 'rfist', _a) : NP[u], B = NP[v];
      if (!A || (u !== 'fist' && u >= n) || v >= n) continue;
      _b.lerpVectors(A, B, gSmooth(x));
      _m.compose(_b, _q.identity(), _c.set(1, 1, 1)); beads.setMatrixAt(k++, _m);
    }
    beads.count = k; beads.instanceMatrix.needsUpdate = true;
    beads.visible = k > 0;
  }
  // a node lights as a bead reaches it (0.3 s)
  function nodeFlash(i, F) {
    let f = 0;
    for (const [, v, x] of F.beads) if (v === i && x > 0.8) f = 1;
    return f;
  }
  // the signals sent live (explore mode, a room's effect): on the live clock
  function liveBeads(grown) {
    const out = [];
    LC.sig = LC.sig.filter(s => LC.t - s[0] < 3);
    for (const b of beadsAt({ beads: [], signals: LC.sig }, LC.t, grown)) out.push(b);
    return out;
  }
  // boot trails: six fading discs a boot, 0.08 s apart, from the script (where the feet were then)
  function drawTrails(F, Gc, t) {
    let k = 0;
    if (F.trails) for (let j = 1; j <= 6; j++) {
      const A = evalActor(Gc.g, t - j * 0.08, LIVE, Gc);
      for (let s = 0; s < 2; s++) {
        toSet(A, [s ? -0.1 : 0.1, 0.004, -0.06], _a);
        _m.compose(_a, _q.setFromEuler(_e.set(-Math.PI / 2, 0, 0)), _c.set(1, 1, 1)); trails.setMatrixAt(k, _m);
        trails.setColorAt(k++, _col.setRGB(0.9, 0.93, 0.97).multiplyScalar(0.5 * (1 - j / 7)));
      }
    }
    trails.count = k; trails.visible = k > 0;
    trails.instanceMatrix.needsUpdate = true; if (trails.instanceColor) trails.instanceColor.needsUpdate = true;
  }
  // the holograms: the mini menu over its right hand, the card in its left, the narration hold's sign before it
  function drawHolos(F) {
    _a.fromArray(LIVE.head);
    menu.m.visible = !!F.menu && F.menu.a > 0.01;
    if (menu.m.visible) {
      drawMenu(F);
      const f = pointOf(0, 'rfist', _b);
      if (f) { menu.m.position.copy(f).add(_c.set(0, 0.17, 0)); menu.m.lookAt(_a); }
      op(menu.m.material, F.menu.a); menu.m.scale.setScalar(0.6 + 0.4 * F.menu.a);
    }
    card.m.visible = F.card > 0.01;
    if (card.m.visible) {
      drawCard(LIVE.room);
      const f = pointOf(0, 'lfist', _b);
      if (f) { card.m.position.copy(f).add(_c.set(0, 0.13, 0)); card.m.lookAt(_a); }
      op(card.m.material, F.card); card.m.scale.setScalar(0.6 + 0.4 * F.card);
    }
    sign.m.visible = !!LIVE.hold;
    if (sign.m.visible) {
      drawSign();
      toSet(F.g, [0, 0.95, 0.4], sign.m.position); sign.m.lookAt(_a); op(sign.m.material, 1);
    }
  }
  // ------------------------------------------------------------------ anchors, labels, views, controls
  const TAG = { text: '', a: 0 };
  const headOf = (A, up) => (A ? [A.head[0], A.head[1] + up, A.head[2]] : [0, -50, 0]);
  const anchors = {
    head: () => headOf(F && F.g, 0), tag: () => headOf(F && F.g, 0.36), copy: () => headOf(F && F.c, 0), copyTag: () => headOf(F && F.c, 0.36),
    fist: () => { const p = pointOf(0, 'rfist', V3()); return p ? p.toArray() : headOf(F && F.g, -0.5); },
    chest: () => { const p = pointOf(0, 'emblem0', V3()); return p ? p.toArray() : headOf(F && F.g, -0.28); },
    boots: () => (F ? [F.g.p[0], 0.05, F.g.p[1]] : [0, 0, 0]),
    net: () => NET.C.slice(), target: () => GUIDE.PT.slice(), menu: () => (menu.m.visible ? menu.m.position.toArray() : headOf(F && F.g, -0.2)),
    card: () => card.m.position.toArray(),
    nodeTag: () => { const i = nodeTagI(); return i >= 0 ? [NP[i].x, NP[i].y + 0.05, NP[i].z] : [0, -50, 0]; },
  };
  for (let i = 0; i < 5; i++) anchors['marker' + i] = () => [GUIDE.MARKS[i][0], 0.03, GUIDE.MARKS[i][1]];
  for (let i = 0; i < 10; i++) anchors['node' + i] = () => NP[i].toArray();
  const nodeTagI = () => (LIVE.hover >= 0 && typeof LIVE.hover === 'number' ? LIVE.hover : F ? F.ntag : -1);
  const degree = i => NET.L.filter(l => (l[0] === i || l[1] === i) && l[0] < (F && F.net.sprout > 0.5 ? 10 : 4) && l[1] < (F && F.net.sprout > 0.5 ? 10 : 4)).length;
  const quiet = () => (F && F.quiet ? 0 : 1);
  const labels = [
    { text: () => [TAG.text, ''], at: 'tag', alpha: () => (TAG.text === 'Labels: hidden' ? 1 : quiet()) * TAG.a },
    { text: ['Guest', ''], at: 'copyTag', cls: 'amb', alpha: () => (F && F.c && F.name ? quiet() : 0) },
    { text: () => { const i = nodeTagI(), d = i >= 0 ? degree(i) : 0; return i < 0 ? ['', ''] : [`${i ? (d > 1 ? 'Node' : 'Leaf') : 'Hub'}: ${d} link${d === 1 ? '' : 's'}`, '']; },
      at: 'nodeTag', cls: 'cyn', alpha: () => (nodeTagI() >= 0 && F && F.net.left ? quiet() : 0) },
  ];
  // views [az, el, dist, tx, ty, tz]: where you stand (the guide at home ahead); from the right at the markers; at the
  // network; wide enough for both robots
  const cam = {
    default: [-8, 12, 2.48, 0.35, 1.1, -2.0],
    side: [44, 22, 2.87, 0.45, 0.6, -2.2],
    net: [16, 13, 1.12, -0.05, 1.3, -1.25],
    wide: [-15, 14, 2.83, 0.8, 1.0, -2.05],
  };
  const controls = [{ key: 'net', label: 'Network', options: [['grown', 'Grown'], ['badge', 'Badge']] }];
  const explore = c => ({ guide_mode: 1, guide_net: c.net === 'badge' ? 0 : 1 });
  // ------------------------------------------------------------------ what the engine calls
  function see(o) { Object.assign(LIVE, o); }
  // the hit of a ray (in the set's frame: origin o, unit direction d): a node, the target, or null
  function hit(o, d) {
    let best = null, bd = 6;
    const test = (p, r, kind, id) => {
      const px = p[0] - o[0], py = p[1] - o[1], pz = p[2] - o[2], s = px * d[0] + py * d[1] + pz * d[2];
      if (s <= 0) return;
      const q = Math.hypot(px - s * d[0], py - s * d[1], pz - s * d[2]);
      if (q < r && s < bd) { bd = s; best = { kind, id, dist: s, point: [o[0] + d[0] * s, o[1] + d[1] * s, o[2] + d[2] * s] }; }
    };
    if (F && F.net.left) for (let i = 0; i < (F.net.sprout > 0.5 ? 10 : 4); i++) test(NP[i].toArray(), i ? 0.045 : 0.055, 'node', i);
    if (F && F.target > 0.5) test(GUIDE.PT, 0.085, 'target', 0);
    return best;
  }
  function signal(i) {
    if (!(i >= 0 && i < 10)) return false;
    LC.sig.push([LC.t, i]); LC.last = LC.t;
    return true;
  }
  const signalOn = () => LC.t - LC.last < Math.max(1.5, signalSpan(0, true) + 0.4);
  function chapters(ch) { G = compileScript(SCRIPT, ch.map(c => ({ key: c.key, a: c.a, b: c.b }))); }
  function dispose() {
    FIG.dead = true;
    if (FIG.S) { FIG.S.dispose(); FIG.S = null; }
  }
  // the figure: bodies.js where the shell has it (a draw set of its own), else the plain figure
  if (forcePlain || !HOST.needBodies) usePlain(forcePlain ? 'nofvt' : 'no HOST.needBodies');
  else HOST.needBodies().then(ok => {
    if (FIG.dead || FIG.kind !== 'wait') return;
    const L = ok && HOST.bodies;
    const S = L && L.set ? L.set(2) : null, a = S && L.person('tutorial-guide'), b = S && L.person('tutorial-copy');
    if (!S || !a || !b) { if (S) S.dispose(); usePlain('no bodies'); return; }
    L.size(a, 1.62); L.size(b, 1.62);
    FIG.S = S; FIG.B = [a, b]; FIG.kind = 'bodies';
  }, () => usePlain('load failed'));
  return Object.assign(set, { params, update, anchors, labels, cam, controls, explore, see, hit, signal, signalOn, chapters, dispose, react, walkTo,
    figure: () => FIG.kind, usePlain, bodyStats: () => (FIG.S ? FIG.S.stats() : null),
    practice: () => ({ on: PR.on, t: PR.t, mk: PR.mk }), setRun: on => { PR.run = !!on; }, practiceReset: () => { PR.want = -1; PR.run = true; },
    frame: () => F, nodeAt: i => NP[i].toArray(), degree,
    state: () => ({ figure: FIG.kind, n: FIG.S ? FIG.S.stats().n : FIG.kind === 'plain' ? (F && F.c ? 2 : 1) : 0, hide: F ? F.g.hide : 0, copy: !!(F && F.c),
      nodes: F && F.net.left ? (F.net.sprout > 0.001 ? 10 : 4) : 0, beads: F ? F.beads.length : 0, tag: TAG.text, pos: F ? F.g.p : null, fail: FIG.fail }) });
};


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['guide'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(58, 1, 0.05, 400);   // standing where the viewer stands: a wide view of the room
  Object.assign(GL, { renderer, scene, camera, canvas });
  GL.rig = new THREE.Group(); GL.world = new THREE.Group();
  scene.add(GL.rig); GL.rig.add(GL.world);
  // the guide's plates are lit by one sky light and a light from over your shoulder
  scene.add(new THREE.HemisphereLight(0xdde8ff, 0x1a2233, 0.85));
  GL.sun = new THREE.DirectionalLight(0xffffff, 0.85);
  scene.add(GL.sun); scene.add(GL.sun.target);
  // stars: only in VR, faint (xrStars)
  const sr = K.rng(9), sp = new Float32Array(1800 * 3), sc = new Float32Array(1800 * 3);
  for (let i = 0; i < 1800; i++) {
    const z = sr() * 2 - 1, t = sr() * Math.PI * 2, r = Math.sqrt(1 - z * z), b = 0.25 + 0.75 * Math.pow(sr(), 3);
    sp.set([150 * r * Math.cos(t), 150 * z, 150 * r * Math.sin(t)], 3 * i); sc.set([b, b, b * 1.05], 3 * i);
  }
  const sg = new THREE.BufferGeometry();
  sg.setAttribute('position', new THREE.BufferAttribute(sp, 3)); sg.setAttribute('color', new THREE.BufferAttribute(sc, 3));
  GL.stars = new THREE.Points(sg, new THREE.PointsMaterial({ size: 1.3, sizeAttenuation: false, vertexColors: true, transparent: true, opacity: 0.1 }));
  scene.add(GL.stars); GL.stars.visible = false;
  // the sets themselves: each built on its own, a step of the load (buildSet, LOAD)
  GL.sets = {};
}
// (no set is drawn in another's frame here; the engine's shared lines keep the hook)
const FRAME = {};
const frameOf = k => FRAME[k] || k;
// one set, built as a step of the load (LOAD) and hidden until the story fades it in; what a set needs built first (the
// PET scanner's vision row: its 3D organs) is built a slice a step until done (prep; the step runs again while it says no)
function buildSet(k) {
  if (SETS[k].prep && !SETS[k].prep(25)) return true;
  const s = SETS[k](K);
  GL.sets[k] = s;
  GL.world.add(s.group);
  s.setAlpha(0);
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
// on a screen narrower than square (a phone held upright) a wide view stands further back: GL.nf is the view's own
// factor (NARROW in the story; 1 for most views), taken in full at half as wide as tall
GL.nf = 1;
// once the set is built: the guide's body waits for bodies.js (HOST.needBodies, loaded by the shell), at most 8 s;
// without it the plain figure stands in
function sceneJoin() {
  const s = GL.sets.guide;
  if (s.figure() !== 'wait') return false;
  if (!LOAD.bw) LOAD.bw = performance.now();
  if (performance.now() - LOAD.bw > 8000) { s.usePlain('bodies.js took too long'); return false; }
  return true;
}
function applyCamera(v) {
  viewDir(v, _vd); _vt.set(v[3], v[4], v[5]);
  GL.camera.position.copy(_vt).addScaledVector(_vd, v[2] * Math.min(GL.fit || 1, 1.25));   // (life size: never far behind where you stand)
  GL.camera.position.y = Math.max(GL.camera.position.y, 0.3);   // never under the floor
  GL.camera.up.set(0, 1, 0); GL.camera.lookAt(_vt);
}
// a small screen held sideways keeps the framing this story had before the strip above the panel was fitted (resize)
const STRIP_FIT = 0;
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

// ----------------------------------------------------------- the viewer --
// What the guide sees of you, in its set's frame, every frame (the set's see): your head and where your ray points
// (a page: standing at the origin, the mouse's ray), the main panel's buttons it points at (a page: where the panel
// would hang), a shared room, AR, the narration hold, whether the story is paused, and what you point at
const _sv = new THREE.Vector3(), _sm = new THREE.Matrix4(), _sd = new THREE.Vector3();
const PANEL_IDS = { stories: ['main', 'stories'], sound: ['main', 'sound'], recenter: ['main', 'recenter'], top: ['main', 'mode'], foot: ['foot', 'track'], play: ['foot', 'play'], next: ['foot', 'next'], prev: ['foot', 'prev'] };
function panelPoint(id, out) {
  const [pn, rid] = PANEL_IDS[id], P = XR[pn], r = P && P.regions.find(q => q.id === rid);
  const x = r ? r.x + r.w / 2 : P ? P.w / 2 : 0, y = r ? r.y + r.h / 2 : P ? P.h / 2 : 0, mw = P ? P.mesh.geometry.parameters.width : 0.62, mh = P ? P.mesh.geometry.parameters.height : 0.7;
  if (!P) return null;
  P.mesh.updateWorldMatrix(true, false);
  return out.set((x / P.w - 0.5) * mw, (0.5 - y / P.h) * mh, 0).applyMatrix4(P.mesh.matrixWorld).applyMatrix4(_sm).toArray();
}
const LIVE = { head: [0, 1.6, 0], ray: null, panel: null, room: false, ar: false, hover: -1, paused: false, hold: false };
function tellGuide(xr) {
  const s = GL.sets.guide;
  GL.world.updateMatrixWorld(true);
  _sm.copy(s.group.matrixWorld).invert();
  LIVE.head = xr ? _sv.copy(XR.head).applyMatrix4(_sm).toArray() : [0, 1.6, 0];
  LIVE.ray = null; LIVE.hover = -1;
  if (xr) {
    for (const c of XR.ctrls) if (c.src && c.g.visible && c.hover && (c.hover.kind === 'node' || c.hover.kind === 'target' || c.hover.kind === 'floor')) {
      LIVE.ray = _sv.copy(c.hover.point).applyMatrix4(_sm).toArray();
      if (c.hover.kind === 'node') LIVE.hover = c.hover.id; else if (c.hover.kind === 'target') LIVE.hover = 'target';
    }
    LIVE.panel = {};
    for (const k in PANEL_IDS) LIVE.panel[k] = panelPoint(k, _sd);
  } else {
    LIVE.panel = null;
    if (PH.hit) { LIVE.ray = PH.hit.point; LIVE.hover = PH.hit.kind === 'node' ? PH.hit.id : PH.hit.kind === 'target' ? 'target' : -1; }
  }
  LIVE.room = !!(HOST.room && HOST.room.inRoom && HOST.room.inRoom());
  LIVE.ar = !!(xr && !XR.clear);
  LIVE.paused = APP.mode === 'story' ? !APP.playing && !HOST.picking : !PR.run;
  LIVE.hold = HOLD.on;
  s.see(LIVE);
}

// ================================================================== STORY ==
// Narration timing: [time in the recording, original story cue]. The story's animation is stretched or squeezed between
// these points so each cue lands on the matching sentence. Written with NARRATION_ENDS by node tools/voice/narrate.mjs
// tutorial from the guide's synthetic voice it records (Kokoro's af_heart); run it again after the words change.
const NARRATION_SYNC = [
  [0, 0],                                             // Hello
  [27.5, 25], [28.82, 26.2], [30.25, 26.4], [43.45, 38.4], [46.72, 41.2], [48.14, 42.2],  // Pointing
  [54.52, 48], [55.84, 49.2], [57.57, 49.4],          // Playing a story
  [83.53, 73], [84.85, 74.2], [86.43, 74.4],          // Exploring
  [112.39, 98], [113.71, 99.2], [115.16, 99.4],       // The menu
  [142.22, 124], [143.54, 125.2], [145.14, 125.4],    // Recenter
  [161.2, 140], [162.52, 141.2], [163.93, 141.4], [187.91, 163.2], [190.48, 165.3],  // Together
  [191.25, 166], [192.57, 167.2], [194.09, 167.4], [215.65, 187],  // Your turn
];
// where each chapter's words end in the recording (seconds by chapter key): the slideshow lets the voice finish there
const NARRATION_ENDS = { hello: 26, point: 52.05, play: 76.75, explore: 109.95, menu: 139.3, recenter: 159.85, together: 190.25, end: 208.25 };
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
// the chapters (story seconds), from the guide's script (sets/script.js), which keys its moves in them
const CH = GUIDE.CH.map(c => Object.assign({}, c));
CH.forEach(c => { c.na = narrT(c.a); c.nb = narrT(c.b); }); // chapter times on the recording's clock
// the engine's own params beside the sets' (DEF): none here; the guide's clock runs at an even pace (evalTrack)
const DEF_MORE = {}, LIN = new Set(['guide_clock']), LOG = new Set();
// no view moved or set back for the side panel (view, FIT)
const FIT = {};
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
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

function buildStory() {
  const F = GL.sets.guide;
  F.chapters(CH);
  // ------------------------------------------------------------ panel copy (the words the guide says; .credits and
  // data-say=" " are shown, not spoken; data-xr is a line's wording in a headset)
  const html = {
    hello: `<h1 data-at="1.2">Meet your guide</h1>
      <p class="lede" data-at="2.2">a robot that shows you round</p>
      <p data-at="8">Calibrating.</p>
      <p data-at="11">Done.</p>
      <p data-at="12.4">Hello. I am your guide, and I am a robot. In a few minutes, I will show you how this app works in a headset.</p>
      <p data-at="20.4">Give me a little room: I keep about two metres in front of you.</p>
      <p class="note" data-at="20.4" data-say=" " data-xr="Look at me, or at this panel: both show the way.">On a screen you watch through a window. This tutorial is made for a headset: put one on, and the guide stands in your room.</p>`,
    point: `<h2 data-at="0.6">Pointing</h2>
      <p data-at="1.4">Each hand sends out a ray, like this one.</p>
      <p data-at="5.6">Point it at a button and pull the trigger, under your index finger. With bare hands, pinch your thumb and finger instead.</p>
      <p data-at="13.4">Missed by four centimetres. Correcting.</p>
      <p data-at="16.2">There.</p>
      <p data-at="17.2">Now point at the target yourself. My visor follows your ray.</p>`,
    play: `<h2 data-at="0.6">Playing a story</h2>
      <p data-at="1.4">A story plays like a film, in chapters. Here are five of them, from my back.</p>
      <p data-at="7">Under the panel is a bar. The round button plays and pauses. The arrows jump a chapter.</p>
      <p data-at="13.4">Try it now: press Pause. I stop mid-step, and my scan stops too. Press Play, and I go on.</p>`,
    explore: `<h2 data-at="0.6">Exploring</h2>
      <p data-at="1.4">After each story comes explore mode, where you try things for yourself.</p>
      <p data-at="7">This is the badge from my chest: a hub, three nodes and six links. A small network.</p>
      <p data-at="13">Point at the hub, in the middle. It has the most links.</p>
      <p data-at="17.2">Pull the trigger on any node, and a signal spreads from it, one link at a time. You can try it soon.</p>`,
    menu: `<h2 data-at="0.6">The menu</h2>
      <p data-at="1.4">To open the menu, click a thumbstick: press it in. With bare hands, pinch twice with your left hand.</p>
      <p data-at="8.2">Its Settings tab has Narration, Subtitles, Sound and Labels.</p>
      <p data-at="12.6">Watch: I hide my own labels. And back again.</p>
      <p data-at="16.4">In VR, Moving with the sticks, also in Settings, moves you through a scene: the left stick moves you, the right one turns you.</p>`,
    recenter: `<h2 data-at="0.6">Recenter</h2>
      <p data-at="1.4">If you turn away and lose the panel, press Recenter. Everything comes back in front of you.</p>
      <p data-at="10.2">Facing you. Squared up. Recenter is on the panel, and in the menu's settings too.</p>`,
    together: `<h2 data-at="0.6">Together</h2>
      <p data-at="1.4">People can share one room, each in their own headset. Start one, or join with a three-letter code, in the menu's Circles tab.</p>
      <p data-at="10.8">Copy created. In a room, other people appear as bodies like this one, with their name above.</p>
      <p data-at="17.2">Each story stands in its own circle, and everyone in it sees the same moment.</p>
      <p data-at="23.2">Copy removed. It did not mind.</p>`,
    end: `<h2 data-at="0.6">Your turn</h2>
      <p data-at="1.4">That is all. To pick a story, press Stories on the panel. The airports are a good first one.</p>
      <p data-at="8.6">Or stay, and practise: I have a few small tasks for you.</p>
      <p data-at="13">Powering down.</p>
      <p class="credits" data-at="15">Your guide's moves and words were written by Claude, an AI model made by Anthropic. Its body is the app's armour figure, posed by code. Narration: a synthetic voice (Kokoro).</p>`,
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
  const cam = (t, k, name, ease) => wp.push([t, ...view(k, name), ease, k]);
  ramp('guide_a', 0, 0.3, 0, 1);
  ramp('guide_clock', 0, T_END_STORY, 0, T_END_STORY);   // (the guide's whole script runs on this clock: LIN)
  key('guide_mode', 0, 0);
  // sound effects (sfxCue: story time, a sound, where it comes from, its options), from the guide's anchors; seq marks a
  // run of steps or places that belongs together
  const q = (ch, t, name, at, o) => sfxCue(C[ch].a + t, name, 'guide', at, o);
  q('hello', 2.9, 'ratchet', 'boots', { n: 7, rise: true, dur: 1.5 });
  q('hello', 5.8, 'rise', 'head', { gain: 0.4 });
  q('hello', 8.0, 'step', 'head', { pitch: 0.8 });
  q('hello', 9.0, 'ratchet', 'head', { n: 4, gain: 0.3 });
  q('hello', 10.7, 'ping', 'head');
  q('hello', 12.5, 'pick', 'fist');
  q('point', 1.0, 'whoosh', 'fist', { dur: 0.5, pitch: 1.3 });
  q('point', 5.1, 'pick', 'target', { gain: 0.35 });
  q('point', 13.2, 'step', 'head', { pitch: 2.0 });
  q('point', 16.0, 'ping', 'target');
  q('play', 0.8, 'ratchet', 'head', { n: 4 });
  [3.6, 3.9, 4.2, 4.5, 4.8].forEach((t, i) => q('play', t, 'place', 'marker' + i, { gain: 0.4, seq: true }));
  [14.1, 16.5, 18.9, 21.3].forEach((t, i) => q('play', t, 'step', 'marker' + (i + 1), { pitch: [1.0, 1.12, 1.26, 1.41][i], seq: true }));
  q('explore', 3.6, 'click', 'chest');
  q('explore', 4.0, 'whoosh', 'chest', { pitch: 1.2 });
  q('explore', 5.6, 'grow', 'net', { dur: 3, gain: 0.4 });
  [6.0, 7.0, 8.0].forEach(t => q('explore', t, 'link', 'net', { gain: 0.35, seq: true }));
  q('explore', 8.8, 'ping', 'net');
  q('explore', 9.4, 'grow', 'net', { dur: 2.5, gain: 0.3 });
  q('explore', 15.0, 'pulse', 'node0');
  q('explore', 19.8, 'pulse', 'node4', { gain: 0.35 });
  q('menu', 2.6, 'click', 'fist');
  q('menu', 2.8, 'open', 'menu', { gain: 0.4 });
  q('menu', 12.0, 'close', 'menu', { gain: 0.35 });
  q('menu', 12.8, 'toggleOff', 'fist');
  q('menu', 14.8, 'toggleOn', 'fist');
  q('menu', 18.4, 'whoosh', 'boots', { dur: 0.8 });
  q('menu', 20.5, 'ratchet', 'head', { n: 2, gain: 0.35 });
  q('menu', 21.3, 'ratchet', 'head', { n: 2, gain: 0.35 });
  q('menu', 22.2, 'whoosh', 'boots', { pitch: 0.8 });
  q('recenter', 7.0, 'ratchet', 'head', { n: 3 });
  q('recenter', 9.7, 'ping', 'head');
  q('together', 10.2, 'join', 'copy');
  q('together', 19.3, 'pick', 'head', { gain: 0.35 });
  q('together', 21.6, 'leave', 'copy');
  q('end', 2.6, 'notice', 'fist', { gain: 0.35 });
  q('end', 14.4, 'close', 'head', { gain: 0.4 });
  q('end', 18.2, 'toggleOff', 'head');
  // a page's camera: where you stand; from the right at the markers; at the network; wide for both robots; back
  cam(0, 'guide', 'default');
  cam(C.play.a + 2, 'guide', 'default');
  cam(C.play.a + 6, 'guide', 'side');
  cam(C.play.b - 1, 'guide', 'side');
  cam(C.explore.a + 4, 'guide', 'net');
  cam(C.explore.b - 1, 'guide', 'net');
  cam(C.menu.a + 3, 'guide', 'default');
  cam(C.together.a + 8, 'guide', 'default');
  cam(C.together.a + 11, 'guide', 'wide');
  cam(C.together.b - 1, 'guide', 'wide');
  cam(C.end.a + 2, 'guide', 'default');
  cam(C.end.b, 'guide', 'default');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);
}
// the story's own length in story seconds (T_END is the recording's)
const T_END_STORY = GUIDE.T_END;
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
// a set label shows as far as its set is in and its own rule allows
// (labels a set marks as minor give way on narrow screens)
const setLabelAlpha = (L, S) => {
  const a = S[L.set + '_a'] || 0;
  if (a < 0.5 || (L.minor && !GL.wide && !XR.on)) return 0;
  const v = (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1);
  if (v > 0) labelText(L);
  return L.none ? 0 : v;
};
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

// ------------------------------------------------------------- the narration hold --
// In a headset narration is off until turned on: once a session, at 7.8 s, the story waits for the voice (the guide
// points at the panel's Sound button, Narration off, and a sign says so) when there is a recording, narration is off
// and this device's sound is on, in a real session, outside a shared room, the switch tutorialHold is not 'off' (every
// test page sets it), and the story played into 7.8 s (never after a seek past it). Turning narration on, or Play,
// goes on.
const HOLD = { done: false, on: false, at: 7.8 };
function holdCan() {
  let sw = '';
  try { sw = localStorage.getItem('tutorialHold') || ''; } catch (e) { /* storage blocked */ }
  return !!(AUD && AUD.state !== 'none' && HOST.xr && HOST.xr.voice && !HOST.xr.voice() && !(HOST.audio && HOST.audio.muted)
    && HOST.session && !(HOST.room && HOST.room.inRoom && HOST.room.inRoom()) && sw !== 'off');
}
// every frame of the story: the clock crossed 7.8 s while playing (t0 before the frame, t after)
function holdStep(t0, t) {
  if (APP.mode !== 'story') { HOLD.on = false; return; }
  if (HOLD.on && (APP.playing || (HOST.xr && HOST.xr.voice && HOST.xr.voice()))) { HOLD.on = false; HOLD.done = true; if (!APP.playing) APP.playing = true; return; }
  const at = narrT(HOLD.at);
  if (!HOLD.done && APP.playing && t0 < at && t >= at && t - t0 < 0.5 && holdCan()) { HOLD.on = true; HOLD.done = true; APP.t = at; APP.playing = false; }
}

// ================================================================ EXPLORE ==
// Explore mode is practice: seven small tasks the guide reacts to (point at the hub, send a signal, pause and play,
// another marker, open the menu, Recenter, move with the sticks or walk round it), and the network from its chest to
// point at. The ticks are this device's own (each person practises for themselves): kept in sessionStorage, never in
// the room's state. The room shares the network's look, the marker it stands at and whether practice runs.
const SCENES = [
  ['guide', 'Practice', 'Seven small tasks. I nod when you get one.'],
];
const TABS = [['scenes', 'Practice']];
const X = { tab: 'scenes', scene: 'guide', ctl: {}, t0: 0, turn: 'off' };
const XS = {};
const orbit = { cur: [-8, 12, 2.48, 0.35, 1.1, -2.0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);

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
const STEP = new Set(['guide_clock', 'guide_mode', 'guide_net']);   // (they jump, they do not ease)
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;
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
  if (!c || !c.options.some(o => o[0] === v)) return;
  if (ctlValue(k, c) !== v) sfxAct(v === 'grown' ? 'grow' : 'snap', 'guide', 'net', { dur: 0.8, gain: 0.4 });   // (sound effects: the network grows or shrinks back)
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  renderScenes();
}

// ---------------------------------------------------------------- practice --
const TASKS = [
  { id: 'hub', name: 'Point at the hub', hint: 'The middle node. Hold your ray on it.', page: 'The middle node. Hold the mouse over it.' },
  { id: 'signal', name: 'Send a signal', hint: 'Pull the trigger (or pinch) on any node.', page: 'Click any node.' },
  { id: 'pause', name: 'Pause me, then play', hint: 'The round button on the bar below.' },
  { id: 'marker', name: 'Send me to another marker', hint: 'The arrows on the bar.' },
  { id: 'menu', name: 'Open the menu', hint: 'Click a thumbstick, or pinch twice with your left hand.', xr: true },
  { id: 'recenter', name: 'Recenter', hint: 'On the panel, or in the menu’s settings.', xr: true },
  { id: 'move', name: 'Move with the sticks', ar: 'Walk round me', hint: 'Turn it on in the menu’s settings, then push the left stick.', arHint: 'Take a few steps.', xr: true },
];
// PR: run (practice playing: the room's), mk (the marker it stands at: -1 at home; the room's), the ticks (this
// device's), and what the tasks are measuring
const PR = { run: true, mk: -1, done: TASKS.map(() => false), hub: 0, sawPause: false, rc: 0, needRc: false, stick: 0, rig0: null, head0: null, last: 0, nudge: 0, t: 0, all: false, arrive: null };
const TICKS = 'tutorialTicks';
function ticksLoad() {
  try { const v = JSON.parse(sessionStorage.getItem(TICKS) || 'null'); if (Array.isArray(v) && v.length === TASKS.length) PR.done = v.map(Boolean); } catch (e) { /* storage blocked */ }
}
function ticksSave() { try { sessionStorage.setItem(TICKS, JSON.stringify(PR.done)); } catch (e) { /* storage blocked */ } }
const inXR = () => !!(XR.on && GL.renderer && GL.renderer.xr.isPresenting);
const isAR = () => inXR() && !XR.clear;
const WALK_WORDS = { room: 'In a shared room you walk for real', none: 'This headset cannot move you with the sticks', own: 'Not in this scene', session: 'In a headset' };
// why a task cannot be done here ('' it can): a page does tasks 1 to 4; a headset all but Recenter while anchored and
// the sticks where the shell refuses them (in VR)
function taskWhy(i) {
  const T = TASKS[i];
  if (T.xr && !inXR()) return 'in a headset';
  if (T.id === 'recenter' && HOST.anchor && HOST.anchor.on) return 'anchored: nothing moves';
  if (T.id === 'move' && !isAR()) { const w = HOST.xr && HOST.xr.walkWhy ? HOST.xr.walkWhy() : ''; if (w && w !== 'ar') return WALK_WORDS[w] || w; }
  return '';
}
const taskName = i => (TASKS[i].id === 'move' && isAR() ? TASKS[i].ar : TASKS[i].name);
const taskHint = i => (TASKS[i].id === 'move' && isAR() ? TASKS[i].arHint : !inXR() && TASKS[i].page ? TASKS[i].page : TASKS[i].hint);
const taskCount = () => { let n = 0, d = 0; TASKS.forEach((T, i) => { if (!taskWhy(i)) { n++; if (PR.done[i]) d++; } }); return [d, n]; };
// a task done: a tick, the guide's nod and its tag (Task 3 of 7: done), a ping; all of them: its full turn and a wave
function tick(id) {
  const i = TASKS.findIndex(T => T.id === id);
  if (i < 0 || PR.done[i] || taskWhy(i) || APP.mode !== 'explore') return false;
  PR.done[i] = true; ticksSave(); PR.last = PR.t;
  const [d, n] = taskCount(), g = GL.sets.guide;
  if (d >= n && !PR.all) { PR.all = true; g.react('all'); sfxAct('rise', 'guide', 'head', { gain: 0.5 }); sfxAct('ratchet', 'guide', 'head', { n: 4, gain: 0.35, delay: 0.2 }); }
  else { g.react('done', d, n); sfxAct('ping', 'guide', 'head'); }
  renderScenes();
  return true;
}
function practiceReset() {
  PR.done = TASKS.map(() => false); PR.all = false; PR.hub = 0; PR.sawPause = false; PR.stick = 0; PR.last = PR.t; PR.nudge = PR.t;
  PR.rig0 = PR.head0 = null; ticksSave(); renderScenes();
}
// the practice bar: Play and Pause, the arrows (the marker the guide walks to)
function practiceToggle(on) {
  const run = on === undefined ? !PR.run : !!on;
  if (run === PR.run) return;
  PR.run = run;
  GL.sets.guide.setRun(run);
  if (!run) PR.sawPause = true;
  else if (PR.sawPause) tick('pause');
  sfxAct(run ? 'toggleOn' : 'toggleOff', 'guide', 'head', { gain: 0.35 });
  renderScenes();
}
function practiceMark(i, quiet) {
  i = clamp(i, 0, 4);
  if (i === PR.mk) return;
  PR.mk = i;
  PR.arrive = { i, at: GL.sets.guide.walkTo(i) };
  if (!quiet) tick('marker');
  renderScenes();
}
const practiceStepBy = d => practiceMark(PR.mk < 0 ? (d > 0 ? 0 : 4) : (PR.mk + d + 5) % 5);
// every frame in explore mode: what the tasks measure (the hub held under a ray, the menu, Recenter, the sticks or a
// walk), a nudge after 15 s with nothing done, the step on arriving at a marker
function practiceStep(dt) {
  if (APP.mode !== 'explore') return;
  const g = GL.sets.guide, P = g.practice();
  PR.t = P.t;
  if (LIVE.hover === 0) { PR.hub += dt; if (PR.hub >= 0.4) tick('hub'); }
  if (inXR()) {
    if (HOST.collab && HOST.collab.menu) tick('menu');
    const need = !!XR.needRecenter;
    if ((need && !PR.needRc) || PR.rc) { PR.rc = 0; tick('recenter'); }
    PR.needRc = need;
    if (isAR()) {
      if (!PR.head0) PR.head0 = LIVE.head.slice();
      if (Math.hypot(LIVE.head[0] - PR.head0[0], LIVE.head[2] - PR.head0[2]) >= 1) tick('move');
    } else {
      const src = HOST.session && Array.from(HOST.session.inputSources || []).find(s => s.handedness === 'left' && s.gamepad);
      const ax = src ? src.gamepad.axes : null, push = ax && ax.length >= 4 ? Math.hypot(ax[2], ax[3]) : 0;
      if (xrWalking() && push > 0.3) PR.stick += dt;
      if (!PR.rig0) PR.rig0 = GL.rig.position.clone();
      if (xrWalking() && (PR.stick >= 1 || Math.hypot(GL.rig.position.x - PR.rig0.x, GL.rig.position.z - PR.rig0.z) >= 0.3)) tick('move');
    }
  }
  if (PR.arrive && P.t >= PR.arrive.at) { sfxAct('step', 'guide', 'marker' + PR.arrive.i, { pitch: [1.0, 1.12, 1.26, 1.41, 1.59][PR.arrive.i] }); PR.arrive = null; }
  // a nudge: the next task mimed, at most every 20 s, never while paused
  if (PR.run && !PR.all && P.t - PR.last > 15 && P.t - PR.nudge > 20) {
    const i = TASKS.findIndex((T, k) => !PR.done[k] && !taskWhy(k));
    if (i >= 0) { PR.nudge = P.t; g.react('nudge', i); }
  }
}
// send a signal from node i: the beads run out hop by hop; in a shared room the others at this station see it too
// (an effect, sig); remote: it came from the room
function sendSignal(i, remote) {
  const s = GL.sets.guide;
  if (!s.signal(i)) return false;
  sfxAct('pulse', 'guide', 'node' + i, { gain: 0.45 });
  if (!remote) {
    if (HOST.collab && HOST.collab.effect) HOST.collab.effect('sig', { n: i });
    if (APP.mode === 'explore') { s.react('signal', i); tick('signal'); }
  }
  return true;
}
function guideEffect(type, d) {
  if (type === 'sig' && d && typeof d === 'object' && Number.isInteger(d.n) && d.n >= 0 && d.n < 10) sendSignal(d.n, true);
}
// shared rooms: the network's look, the marker, practice running (outcomes only; never the ticks, the guide's
// reactions or its clock: each device's own)
function collabState() {
  return { net: ctlValue('guide', GL.sets.guide.controls[0]), mk: PR.mk, run: PR.run ? 1 : 0 };
}
function collabApply(v) {
  if (!v || typeof v !== 'object') return;
  if (v.net === 'badge' || v.net === 'grown') { if (ctlValue('guide', GL.sets.guide.controls[0]) !== v.net) setCtl('guide', 'net', v.net); }
  if (Number.isInteger(v.mk) && v.mk >= -1 && v.mk <= 4 && v.mk !== PR.mk) { if (v.mk < 0) PR.mk = -1; else practiceMark(v.mk, true); }
  if ((v.run === 0 || v.run === 1) && !!v.run !== PR.run) { PR.run = !!v.run; GL.sets.guide.setRun(PR.run); renderScenes(); }
}
// shared rooms: life size in a headset, so no view places anything there (none to share)
function collabView() { return null; }
function collabSetView(v, now) { /* nothing to set */ }
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
function buildExplore() {
  $('#explore').innerHTML = `<div class="pane on" id="pane-scenes" role="region" aria-label="Practice"></div>`;
  $('#pane-scenes').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.ctl) setCtl(X.scene, b.dataset.ctl, b.dataset.v);
    else if (b.dataset.act === 'signal') sendSignal(0);
    else if (b.dataset.act === 'again') practiceReset();
    else if (b.dataset.act === 'airports') HOST.go('airports');
    else if (b.dataset.act === 'play') practiceToggle();
    else if (b.dataset.act === 'prev') practiceStepBy(-1);
    else if (b.dataset.act === 'next') practiceStepBy(1);
  });
  ticksLoad();
  renderScenes();
  $('#viewctl').innerHTML = '';
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) { X.tab = k; }
const markWords = () => (PR.mk < 0 ? 'At home' : `Marker ${PR.mk + 1} of 5`);
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane || !GL.sets.guide) return;
  const sc = SCENES[0], s = GL.sets.guide, [d, n] = taskCount();
  const rows = TASKS.map((T, i) => {
    const why = taskWhy(i), done = PR.done[i] && !why;
    return `<li style="display:flex;gap:10px;align-items:flex-start;margin:0 0 8px;${why ? 'opacity:0.45' : ''}"><span aria-hidden="true" style="flex:none;width:20px;height:20px;border-radius:5px;border:2px solid ${done ? 'var(--cyan)' : 'var(--muted)'};${done ? 'background:var(--cyan);color:#04131c;' : ''}text-align:center;line-height:18px;font-weight:700">${done ? '✓' : ''}</span>
      <span aria-label="${done ? 'Done: ' : ''}${esc(taskName(i))}"><b>${i + 1}. ${esc(taskName(i))}</b><br><small style="color:var(--muted)">${esc(why ? why[0].toUpperCase() + why.slice(1) : taskHint(i))}</small></span></li>`;
  }).join('');
  const room = !!(HOST.room && HOST.room.inRoom && HOST.room.inRoom());
  pane.innerHTML = `<h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])} ${d} of ${n} done.</p>
    <ol style="list-style:none;padding:0;margin:0 0 14px">${rows}</ol>
    <div class="actions" style="display:flex;gap:8px;align-items:center;margin-bottom:14px" role="group" aria-label="Practice bar">
      <button class="btn" type="button" data-act="play" aria-label="${PR.run ? 'Pause' : 'Play'}">${PR.run ? 'Pause' : 'Play'}</button>
      <button class="btn" type="button" data-act="prev" aria-label="Previous marker">◀</button>
      <button class="btn" type="button" data-act="next" aria-label="Next marker">▶</button>
      <span style="color:var(--muted)">${markWords()}</span></div>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, nm]) => `<button type="button" data-ctl="${c.key}" data-v="${v}" aria-pressed="${ctlValue(X.scene, c) === v}"${ctlValue(X.scene, c) === v ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(nm)}</button>`).join('')}</div>`).join('')}
    <div class="actions"><button class="btn primary" type="button" data-act="signal">Send a signal from the hub</button>
      <button class="btn" type="button" data-act="again">Start again</button>${room ? '' : '<button class="btn" type="button" data-act="airports">Start the airports story</button>'}</div>`;
}
// labels the panes add (none: the sets label their own picks)
function updateExtraLabels() {}

// ----------------------------------------------------------- canvas input --
// on a page: drag to look round the guide, the wheel to come nearer; the mouse over a node lights it (and its tag),
// a click on a node sends a signal from it
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _inv = new THREE.Matrix4(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3();
const PH = { hit: null, x: -1, y: -1 };
function pageHit(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(GL.sets.guide.group.matrixWorld).invert();
  _ro.copy(_rc.ray.origin).applyMatrix4(_inv); _rd.copy(_rc.ray.direction).transformDirection(_inv);
  return GL.sets.guide.hit(_ro.toArray(), _rd.toArray());
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
    if (APP.mode === 'explore' && ev.pointerType === 'mouse' && !pts.size) { PH.hit = pageHit(ev.clientX, ev.clientY); cv.style.cursor = PH.hit && PH.hit.kind === 'node' ? 'pointer' : 'grab'; }
    if (!pts.has(ev.pointerId) || APP.mode !== 'explore') return;
    const p = pts.get(ev.pointerId), dx = ev.clientX - p[0], dy = ev.clientY - p[1];
    pts.set(ev.pointerId, [ev.clientX, ev.clientY]);
    if (pts.size === 2) {
      const [a, b] = [...pts.values()], d = Math.hypot(a[0] - b[0], a[1] - b[1]);
      if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.6, 8);
      pinch = d; down.moved = true; return;
    }
    if (down && Math.hypot(ev.clientX - down.x, ev.clientY - down.y) > 4) down.moved = true;
    if (down && down.moved) {
      orbit.to = null;
      orbit.cur[0] -= dx * 0.25; orbit.cur[1] = clamp(orbit.cur[1] + dy * 0.2, -10, 70);
    }
  });
  cv.addEventListener('pointerleave', () => { PH.hit = null; });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      const h = pageHit(ev.clientX, ev.clientY);
      if (h && h.kind === 'node') sendSignal(h.id);
    }
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.6, 8);
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
// The guide stands on your floor, life size: the set's frame hangs under the rig (set from your head when the place was
// set, level), its floor the floor plane's height where the session reports planes (the plane labelled floor, the
// largest; else the lowest large plane facing up over a metre below your head; read once a second until found, kept,
// moved only if it moves more than 5 cm), else a standing eye height (1.6 m) below where your head was. The same in VR
// and AR; views do not move it, and this never moves GL.rig itself.
const XRF = { y: null, t: 0 };
function xrPlace(v) {
  XR.R = 1; XR.hitR = 1; XR.target.set(0, 0, 0);
  const y = XRF.y === null ? -1.6 : XRF.y - GL.rig.position.y;
  GL.world.quaternion.identity();
  GL.world.scale.setScalar(1);
  GL.world.position.set(0, y, 0);
  XR.globeBase.set(0, y, 0);
}
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
// a label's height: the same size to the eye, near or far (life size: labels may be metres away)
function xrLabelH(sp) { return 0.021 * Math.max(1, sp.position.distanceTo(XR.camLocal)); }
// nothing to point at in explore mode: no tip
function xrTip() {}

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
// the trigger on a node sends a signal from it (the target only lights while your ray is on it)
function xrPressScene(c, h) {
  if (h.kind !== 'node' || XR.stories) return;
  c.press = { kind: 'node' };
  if (sendSignal(h.id)) buzz(c, 0.5, 40);
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
      // (a soft click at the button, unless the press made a sound of its own: the shell's rule for page buttons)
      if (r && r.id === p.id && r.fn) { buzz(c); const n = sfxN(); r.fn(); if (sfxN() === n) sfxPlay('click', 'world', h.point); }
    }
  } else xrReleaseScene(c, p);
}
function xrReleaseScene() {}
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
// life size, the scene stays where it is: only the panel moves
function xrGrabScene() { return true; }
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
const _xo = new THREE.Vector3(), _xdd = new THREE.Vector3(), _xgm = new THREE.Matrix4();
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
  } else if (!XR.stories && GL.sets.guide) {
    // the guide's network and target, in the set's frame; else where the ray meets the floor (the guide's visor follows it)
    const s = GL.sets.guide;
    _xgm.copy(s.group.matrixWorld).invert();
    _xo.copy(c.o).applyMatrix4(_xgm); _xdd.copy(c.d).transformDirection(_xgm);
    const sh2 = s.hit(_xo.toArray(), _xdd.toArray());
    if (sh2) { hit = { kind: sh2.kind, id: sh2.id, point: _xp.fromArray(sh2.point).applyMatrix4(s.group.matrixWorld).clone() }; dist = c.o.distanceTo(hit.point); }
    else if (_xdd.y < -0.05) {
      const k = -_xo.y / _xdd.y;
      if (k > 0 && k < 8) { hit = { kind: 'floor', point: _xp.copy(_xdd).multiplyScalar(k).add(_xo).applyMatrix4(s.group.matrixWorld).clone() }; dist = k; }
    }
  }
  c.hover = hit;
  // a soft tick as the ray comes onto a button of the story's panels (as on the shell's menu), or onto a node
  const hr = hit && hit.kind === 'panel' && hit.P.at(hit.x, hit.y), hk = hr && hr.fn ? XR.panels.indexOf(hit.P) + '.' + hr.id : hit && hit.kind === 'node' ? 'n' + hit.id : '';
  if (hk && hk !== c.hk) sfxPlay('hover', 'world', hit.point);
  c.hk = hk;
  if (c.wantPress) { c.wantPress = false; xrPress(c); }
  if (c.grab) carry(c, dt);
  if (c.press && c.press.kind === 'panel' && c.press.r.drag && hit && hit.kind === 'panel' && hit.P === c.press.P) c.press.r.drag(hit.x, hit.y);
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
// once the head's pose is read: the floor from the session's planes (once a second until found)
function xrPosed(frame, ref, pose) {
  if (!pose || !frame || !ref) return;
  const now = performance.now();
  if (XRF.y !== null && now - XRF.t < 1000) return;
  XRF.t = now;
  let planes = null;
  try { planes = frame.detectedPlanes; } catch (e) { planes = null; }   // (Chromium throws where the feature is off)
  if (!planes || typeof planes.forEach !== 'function') return;
  const headY = XR.head.y;
  let best = null;
  planes.forEach(pl => {
    let pose2 = null, poly = null, lab = '';
    try { pose2 = frame.getPose(pl.planeSpace, ref); poly = pl.polygon; lab = String(pl.semanticLabel || '').toLowerCase(); } catch (e) { return; }
    if (!pose2 || !poly || poly.length < 3 || pl.orientation === 'vertical') return;
    const y = pose2.transform.position.y;
    let a = 0;
    for (let i = 0; i < poly.length; i++) { const p = poly[i], q = poly[(i + 1) % poly.length]; a += p.x * q.z - q.x * p.z; }
    a = Math.abs(a) / 2;
    const score = lab === 'floor' ? 1e6 + a : y < headY - 1 && a > 1 ? -y : -Infinity;
    if (score > -Infinity && (!best || score > best.s)) best = { s: score, y };
  });
  if (best && (XRF.y === null || Math.abs(best.y - XRF.y) > 0.05)) XRF.y = best.y;
}
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
// a session begins: its floor is found afresh
function xrOnEnter() { XRF.y = null; XRF.t = 0; }
// the stars in the headset: only in VR, faint (a tenth); never on the page
function xrStars(on) {
  if (on) { GL.stars.visible = XR.clear; GL.stars.material.size = 2.2; }
  else GL.stars.visible = false;
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
function xrOnEnd() { XRF.y = null; }
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
  if (!force && now - P.t < 60) return;   // (the throttle before the signature: P.sig() builds a string each call)
  const sg = P.sig(), k = sg.indexOf('\u0001'), base = (k < 0 ? sg : sg.slice(0, k)) + '|' + P.hover + '|' + XR.fontOK, s = k < 0 ? base : base + sg.slice(k);
  if (s === P.last) return;
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
const sigMainS = () => (HOLD.on ? 'hold' : '');
// explore mode in the main panel's signature (sigMain)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), JSON.stringify(X.ctl.guide || {}), PR.done.map(Number).join(''), TASKS.map((T, i) => taskWhy(i)).join(','), PR.run, PR.mk,
    HOST.room && HOST.room.inRoom && HOST.room.inRoom() ? 'r' : ''].join('|');
}
const XR_HERE = 'tutorial';
const XR_TITLE = 'Tutorial';
// the story's points (ul.steps) on the headset's panel (drawStoryEl): lines at most, and the colour of one without
// its own
const XR_STEP_LINES = 3, XR_STEP_COL = 'var(--amber)';
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
  const head = makePanel(1400, 236, 1.02, drawLandHead, () => 'h' + XR.inStory + xrCards() + HOST.anchor.status() + HOST.list.length + xrLandTitle());
  head.mesh.position.set(0, XR_LAND.head, -1.22);
  XR.landGroup.add(head.mesh); XR.land.push(head); XR.panels.push(head);
  xrLandingCards();
}
// One card per story, 0.36 m wide, in two rows on one arc, as the All stories circle's icon has them: the first half of
// the stories (rounded up) in the upper row, in the list's order, the rest under them, a shorter row centred. In a row
// neighbours stand 0.381 m apart and the outer ones at most 62° to the side (eight: 0.306 rad apart at 1.25 m), never
// nearer than 1.25 m (a few stories stand closer together in angle). Built again when the shell's list of stories
// changes while the app runs (HOST.listRev: a story added in a release gets its card, and the shell's other set of cards,
// HOST.menu, v188: Experiments and back). The cards are the shell's set on show (a shell without HOST.menu: HOST.list)
const xrLandList = () => (HOST.menu ? HOST.menu.cards() : HOST.list);
// the Stories screen's title: the set on show, no count of stories (v188)
const xrLandTitle = () => (HOST.menu ? HOST.menu.title() : 'Network stories');
function xrLandingCards() {
  for (const P of XR.land.splice(1)) {
    XR.landGroup.remove(P.mesh); XR.panels.splice(XR.panels.indexOf(P), 1);
    P.tex.dispose(); P.mesh.geometry.dispose(); P.mesh.material.dispose();
  }
  const L = xrLandList(), n = L.length, per = Math.ceil(n / 2), d = Math.max(1.25, per > 1 ? 0.1905 / Math.sin(1.085 / (per - 1)) : 0), step = 2 * Math.asin(0.1905 / d);
  XR.landRev = HOST.listRev;
  L.forEach((s, k) => {
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
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText(xrLandTitle(), 48, 44);
  // anchored: where the place stands, in place of the hint
  const an = HOST.anchor.status();
  textBlock(ctx, an || 'The same ideas, very different networks. Point at a story and pull the trigger (or pinch).', 48, 128, 860, 27, 38, an ? VC.ink : VC.muted, 400, 2);
  // (the sound, Sound check, Anchor, Exit, Recenter or Place again, and Repeat are the shell's menu's, for every story)
  if (XR.inStory && !xrCards()) vButton(ctx, P, 'back', P.w - 44 - 294, 128, 294, 64, 'Back to the story', xrLandingClose, { px: 26 });
}
function drawLandCard(ctx, P, s) {
  const here = s.key === XR_HERE, id = 'card', hov = P.hover === id;
  // (v202: the colour bar clipped to the outline, its top corners rounded as the card's: square, it poked past them)
  rr(ctx, 8, 8, P.w - 16, P.h - 16, 22);
  ctx.lineWidth = 4; ctx.strokeStyle = hov ? s.col : here && XR.inStory ? 'rgba(70,217,255,0.6)' : 'rgba(140,170,210,0.3)'; ctx.stroke();
  ctx.save(); ctx.clip(); ctx.fillStyle = s.col; ctx.fillRect(8, 8, P.w - 16, 10); ctx.restore();
  fitTitle(ctx, s.kick.toUpperCase(), 48, 64, P.w - 96, 28, 34, s.col, 700, 22);
  // a long title shrinks a little, else takes two lines and the description moves down (ending above the length)
  const dy = 112 + fitTitle(ctx, s.title, 46, 112, P.w - 94, 72, 78, VC.ink, 700, 58, true) + 32;
  textBlock(ctx, s.desc, 48, dy, P.w - 96, 31, 45, VC.muted, 400, Math.min(7, Math.floor((P.h - 243 - dy) / 45) + 1));
  ctx.font = vfont(26); ctx.fillStyle = VC.faint; ctx.fillText(fitText(ctx, s.len, P.w - 96), 48, P.h - 196);
  const label = s.menu ? 'Open' : here && XR.inStory ? 'Resume' : 'Start';   // (a card of the shell's other set: HOST.go opens it)
  vButton(ctx, P, 'go', 48, P.h - 140, P.w - 96, 92, label, null, { primary: true, px: 34 });
  P.regions.push({ id, x: 0, y: 0, w: P.w, h: P.h, fn: () => (here && !xrCards() ? xrLandingClose() : HOST.go(s.key)) });
}
function drawStoriesPane(ctx, P, x, y, W) {
  y += textBlock(ctx, 'Choose a story', x, y, W, 46, 54, VC.ink, 700) + 6;
  y += textBlock(ctx, 'The same ideas, very different networks. Pick one; you stay in the headset view.', x, y, W, 25, 35, VC.muted) + 22;
  // fit the cards above the Back button (the list grew to four)
  const L = xrLandList(), h = Math.min(210, Math.floor((P.h - 96 - y) / L.length) - 18);
  for (const { key: k, kick, title, desc, col } of L) {
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
const xrHint = () => (HOST.anchor.on ? 'Trigger (or pinch): use buttons. Anchored: to move things, use Place again in the menu.' : 'Trigger (or pinch): use buttons, or point at a node of the guide’s network. Grip: ' + (XR.free ? 'move and turn' : 'move') + ' this panel.');

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


// explore: practice's pane, mirroring the HTML one (renderScenes)
function drawExplorePane(ctx, P, x, y, W) {
  const sc = SCENES[0], s = GL.sets.guide, [d, n] = taskCount();
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink; ctx.fillText(sc[1], x, y);
  y += 46;
  y += textBlock(ctx, `${sc[2]} ${d} of ${n} done.`, x, y, W, 24, 32, VC.muted, 400, 2) + 14;
  for (let i = 0; i < TASKS.length; i++) {
    const why = taskWhy(i), done = PR.done[i] && !why;
    ctx.globalAlpha = why ? 0.45 : 1;
    rr(ctx, x, y + 2, 30, 30, 7);
    if (done) { ctx.fillStyle = VC.cyan; ctx.fill(); ctx.fillStyle = '#04131c'; ctx.font = vfont(24, 700); ctx.fillText('✓', x + 6, y + 4); }
    else { ctx.lineWidth = 3; ctx.strokeStyle = VC.muted; ctx.stroke(); }
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, `${i + 1}. ${taskName(i)}`, W - 50), x + 46, y);
    ctx.font = vfont(21); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, why ? why[0].toUpperCase() + why.slice(1) : taskHint(i), W - 50), x + 46, y + 33);
    ctx.globalAlpha = 1;
    y += 76;
  }
  y += 6;
  for (const c of s.controls || []) {
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(c.label, x, y + 16);
    let bx = x + 150;
    for (const [v, nm] of c.options) {
      vButton(ctx, P, 'ctl:' + c.key + ':' + v, bx, y, 150, 54, nm, () => setCtl(X.scene, c.key, v), { on: ctlValue(X.scene, c) === v, px: 24 });
      bx += 160;
    }
    y += 70;
  }
  vButton(ctx, P, 'signal', x, y, 380, 58, 'Send a signal from the hub', () => sendSignal(0), { primary: true, px: 24 });
  vButton(ctx, P, 'again', x + 392, y, 210, 58, 'Start again', practiceReset, { px: 24 });
  if (!(HOST.room && HOST.room.inRoom && HOST.room.inRoom())) vButton(ctx, P, 'airports', x, y + 70, 380, 58, 'Start the airports story', () => HOST.go('airports'), { px: 24 });
}
// ----------------------------------------------------------- footer panel --
// (explore mode: practice's own bar, so what it shows is in the signature)
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.floor(APP.t) + APP.playing + (curCh ? curCh.key : '') + slideSig() : 'x' + PR.run + PR.mk;
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
// explore mode's footer: practice's bar, as a story's: the round Play and Pause, the arrows (the marker the guide
// walks to), where it stands
function drawFootX(ctx, P) {
  const bx = 28, by = 40;
  vButton(ctx, P, 'play', bx, by, 96, 96, '', practiceToggle, { r: 48 });
  ctx.fillStyle = VC.ink;
  if (PR.run) { ctx.fillRect(bx + 34, by + 30, 10, 36); ctx.fillRect(bx + 52, by + 30, 10, 36); }
  else { ctx.beginPath(); ctx.moveTo(bx + 38, by + 26); ctx.lineTo(bx + 38, by + 70); ctx.lineTo(bx + 72, by + 48); ctx.closePath(); ctx.fill(); }
  const tri = (cx, cy, dir) => { ctx.beginPath(); ctx.moveTo(cx - 9 * dir, cy - 13); ctx.lineTo(cx - 9 * dir, cy + 13); ctx.lineTo(cx + 9 * dir, cy); ctx.closePath(); ctx.fill(); };
  vButton(ctx, P, 'prev', 140, 52, 78, 72, '', () => practiceStepBy(-1));
  ctx.fillStyle = VC.ink; tri(171, 88, -1); ctx.fillRect(184, 75, 5, 26);
  vButton(ctx, P, 'next', 228, 52, 78, 72, '', () => practiceStepBy(1));
  ctx.fillStyle = VC.ink; tri(262, 88, 1); ctx.fillRect(271, 75, 5, 26);
  ctx.font = vfont(27, 700); ctx.fillStyle = VC.ink; ctx.fillText(markWords(), 344, 58);
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(PR.run ? 'Practice runs. Pause it, or send the guide along the markers.' : 'Paused.', 344, 100);
}


// ------------------------------------------------------------- narration --
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
function audioInit() {
  AUD = HOST.audio.narration(arrVoice(), AUD_HOOKS);   // (an arrangement's recording, or the story's own)
  // react at once to play/pause, seeks, chapter jumps and mode changes
  for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {
    const f = APP[name];
    APP[name] = function (...args) { const r = f.apply(APP, args); AUD.seeked(); audioSync(); return r; };
  }
}
const narrationFile = () => HOST.pkgUrl('tutorial', 'audio/narration.mp3');
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
    // practice: the guide boots again at home, the network grown, practice running from the first marker's side
    const S = storyState(storyT(this.t));
    for (const n in DEF) XS[n] = S[n];
    X.scene = 'guide'; X.t0 = performance.now();
    X.ctl.guide = { net: 'grown' };
    orbit.cur = view('guide', 'default'); orbit.to = null;
    PR.run = true; PR.mk = -1; PR.last = PR.nudge = 0; PR.hub = 0; PR.sawPause = false; PR.all = PR.done.every(Boolean); PR.rig0 = PR.head0 = null;
    GL.sets.guide.practiceReset();
    sfxAct('rise', 'guide', 'head', { gain: 0.4 });
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
    HOLD.on = false;
  },
};

let lastNow = 0;
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
  holdStep(t0, APP.t);   // the narration hold (a headset, narration off): the story waits at 7.8 s
  slideStep(t0);   // slideshow: the story waits at the end of each chapter
  sfxStep(was, dt);   // sound effects: the cues the clock crossed, the spans it is in, the live sounds
  // the end: Repeat (shell) starts this story or the next one again, else explore mode opens
  if (APP.mode === 'story' && APP.playing && APP.t >= T_END) { APP.t = T_END; if (HOST.ended()) APP.playing = false; else APP.enterExplore(); }
  audioSync();
  const ts = storyT(APP.t); // original story time for this point in the narration
  if (APP.mode === 'story') {
    S = storyState(ts); tSet = ts;
    if (xr) xrPlace(storyCam(ts)); else applyCamera(storyCam(ts));
    updateStoryDOM(ts);
    updateTimeline(APP.t, APP.playing);
  } else {
    const pn = performance.now();
    S = exploreStep(dt, pn); tSet = pn / 1000;
    orbitStep(xr ? pn : now);
    if (xr) xrPlace(orbit.cur); else applyCamera(orbit.cur);
    practiceStep(dt);
  }
  K.U.uTime.value = (performance.now() / 1000) % 3600;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  tellGuide(xr);   // (what the guide sees of you: your head, your ray, the panel's buttons)
  updateSets(S, tSet, dt, APP.mode === 'story');
  arrPlace();   // (an arrangement's places, on top of what the story does with its sets)
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
    // #tutorial&explore&net=badge (any control by its key); &view=side a view; &signal sends a signal from the hub
    const s = GL.sets[X.scene];
    if (hp.get('view') && s.cam[hp.get('view')]) orbit.cur = view(X.scene, hp.get('view'));
    for (const c of s.controls || []) if (hp.get(c.key)) setCtl(X.scene, c.key, hp.get(c.key));
    if (hp.has('signal')) sendSignal(0);
    if (hp.has('now')) Object.assign(XS, exploreTargets());
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
const ARR = { o: null, A: null, built: false, pend: undefined, name: '', M: null, R: null, sk: null, pl: null, tx: [], seg: -1, d: 0, url: '', want: '', vk: 0, tk: false, dropped: [] };
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
  if (!A && !ARR.A) { ARR.dropped = []; return { dropped: [] }; }
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
  ARR.dropped = drop.slice();   // (kept: whoever asked for the apply, the shell's editor reads it, arrange.dropped)
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
// (dropped: the edits the last apply left out, whoever asked for it: the load's, the pass story's change of language)
const ARR_API = { model: arrModel, apply: arrApply, get: () => ARR.A, dropped: () => ARR.dropped.slice() };

// what the app shell needs to change story
return {
  inputs: () => XR.ctrls.map(c => c.src),
  caption: xrCaption,
  // (Recenter from the shell's menu comes through here: practice's task 6 counts it; the panel's own button sets
  // XR.needRecenter, which practiceStep watches)
  recenter: () => { PR.rc = performance.now(); return xrRecenterAsk(); },
  panels: () => (XR.main && XR.foot ? { main: XR.main, foot: XR.foot } : null),   // (for the shell's menu, its Story tab)
  xrPose: () => (XR.on ? { rp: GL.rig.position.clone(), rq: GL.rig.quaternion.clone(), off: XR.globeOff.clone(), s: XR.size, held: XR.ctrls.map(c => (c.grab ? c.grab.target : '')).join(' '),
    pp: XR.panelGroup.position.clone(), pr: yawOf(XR.panelGroup.quaternion, XR.panelGroup.rotation.y), rot: XR.rot.clone(), pq: XR.panelGroup.quaternion.clone() } : null),
  // shared rooms (shared.js): the clock is APP's, the shared state practice's (the network, the marker, running); a
  // signal is an effect
  collab: {
    APP, scene: () => (LOAD.done ? GL.scene : null), state: collabState, apply: v => { SFXQ.quiet++; try { return collabApply(v); } finally { SFXQ.quiet--; } }, view: collabView, setView: collabSetView,
    effect: guideEffect,
    hover: i => { const c = XR.ctrls[i]; return c && c.hover ? c.ray.scale.z : 0; },
    panel(p, yaw, q) { xrPanelPose(p, yaw, q); },
    place(o, s, q) { XR.globeOff.fromArray(o); XR.size = s; xrSceneRot(q); },
  },
  // arrangements (tools/engine/SPEC.md): the story's own timeline as data, an arrangement laid over it, the one laid
  arrange: ARR_API,
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    // timers left running must not write into the next story's panes (they share ids) or build this one after all
    LOAD.gone = true; clearTimeout(LOAD.t); clearTimeout(xrMsg.t);
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    // the guide's figures first: bodies.js's geometries are shared with every other set and must not be disposed below
    if (GL.sets && GL.sets.guide) GL.sets.guide.dispose();
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
