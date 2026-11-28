// Protein crowds, a story package (tools/packages/SPEC.md): a cube of up to a million balls standing for proteins' parts,
// a made-up cloud or the crowd of Back into the cell (packages/ppicell's PPI_STRUCTS and CROWD, read at build time),
// drawn as sphere impostors or instanced meshes and culled four ways, with a read-out of what each frame costs
// (src/sets/crowds.js, src/sets/cull.js; src/README.md says what the sweep measured).
// Runs inside index.html, which owns the page, the renderer and the headset session.
// Built by src/build.mjs from the app's kit (tools/engine/kit.js), the shared engine parts (tools/engine/) and the sets and
// engine files in src/: edit those, not this file.
HOST.register('crowds', function (HOST) {
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
const KEY = 'crowds';
const pkgUrl = file => (HOST.pkgUrl ? HOST.pkgUrl(KEY, file) : `packages/${KEY}/${file}`);
// what the index says about this package (its title, its files), or null
const pkgMeta = () => (HOST.packages && HOST.packages.get(KEY)) || (HOST.meta && HOST.meta(KEY)) || null;
// ================================================================== SETS ==
// Each set is one 3D scene of the story, centred on the origin. The story fades sets in and out and drives them
// through their params (see SETS.x.params); the set contract is packages/lbi/src/SPEC.md, "What a set exports".
const SETS = {};
// ---- packages/ppicell/src/sets/structs.js, read at build time
// Generated by src/data/gen_structs.py from the Protein Data Bank (public domain): never edit by hand.
// Each crowd molecule as a few balls (its residues grouped: x, y, z, radius), tenths of an angstrom, centred.
const PPI_STRUCTS = {"bira":{"coarse":[[110,-143,9,108],[254,-180,3,96],[222,-133,-110,98],[94,53,81,101],[9,-60,55,95],[-99,111,124,100],[-44,69,-73,106],[-58,-6,160,100],[72,11,-80,104],[-141,131,5,100],[-239,59,-93,113]]},"ubq":{"coarse":[[-22,-59,-85,84],[-10,88,-17,81],[80,0,-13,82],[63,48,108,88],[-45,-56,33,95],[-82,-10,-58,77]]},"cam":{"coarse":[[-157,56,117,96],[-42,183,111,112],[-86,187,-1,103],[-60,-13,20,90],[106,-109,-71,117],[110,-241,-100,97]]},"gapdh":{"coarse":[[89,218,248,131],[177,232,70,120],[243,171,215,117],[-121,79,287,129],[41,58,284,122],[-99,54,65,129],[-209,-290,64,125],[-156,-221,-116,121],[-300,-197,-29,118],[-54,-181,261,129],[-180,-151,165,127],[54,-86,83,128],[-106,266,-186,131],[-200,220,-2,121],[-267,197,-153,118],[108,177,-245,127],[-53,127,-255,121],[92,87,-38,128],[238,-233,-151,124],[186,-229,44,121],[324,-167,-33,118],[72,-80,-304,129],[195,-71,-200,127],[-40,-55,-109,129]]},"tub":{"coarse":[[360,-9,24,105],[149,22,190,110],[50,122,47,109],[254,134,98,106],[216,118,-47,105],[147,6,8,104],[270,-85,118,107],[214,-202,41,112],[200,-19,-163,115],[343,-49,-161,111],[362,-151,-19,110],[41,104,-135,113],[-236,-45,11,109],[-138,8,215,111],[-290,37,155,104],[-340,126,35,105],[-159,137,61,117],[-282,26,-132,121],[-221,-208,37,110],[-90,-11,-129,120],[-86,-150,-63,120],[78,-113,-5,107],[-63,-69,79,103],[-391,115,-127,107]]},"actin":{"coarse":[[160,-41,-149,107],[25,-57,-74,104],[214,-104,117,109],[149,2,32,97],[65,93,-42,99],[170,113,-145,106],[-35,23,42,98],[-42,-146,184,113],[-146,-67,80,96],[-228,-118,160,93],[-115,61,136,87],[-110,145,-80,105],[-203,64,-30,107],[1,12,-173,104]]}};

// ---- packages/ppicell/src/sets/balls.js, read at build time
// Real proteins as balls, the crowd's way (chapter 2) shared with the lenses (chapter 6) and what it would take
// (chapter 8): each molecule its few coarse balls from the Protein Data Bank (PPI_STRUCTS' `coarse`: its residues
// grouped), every ball one point drawn as a lit sphere with its true depth (a sphere impostor), a whole crowd in one draw.
// BALLS.of(key, per): a molecule's balls in scene units (per: scene units per angstrom); BALLS.reach(balls): how far its
// balls reach from its middle; BALLS.mat(set, U): the material (U: uT, uJig, uHalf, uMark and, if the crowd fades on its
// own, its own uA); BALLS.half(): the points' scale, half the drawn height in pixels (a headset's eye or the page's);
// BALLS.cloud(set, mols, opts): a crowd whose molecules each move as one ({ balls, c } each), placed with place(i, ...).
const BALLS = (() => {
  const v2 = new THREE.Vector2();
  const of = (key, per) => PPI_STRUCTS[key].coarse.map(b => [b[0] / 10 * per, b[1] / 10 * per, b[2] / 10 * per, b[3] / 10 * per]);
  const reach = balls => Math.max(...balls.map(b => Math.hypot(b[0], b[1], b[2]) + b[3]));
  const half = () => {
    const r = GL.renderer;
    return r.xr.isPresenting && typeof XR !== 'undefined' && XR.viewH ? XR.viewH / 2 : r.getDrawingBufferSize(v2).y / 2;
  };
  // (each ball a lit sphere: a point as big as the ball on screen, its round face shaded and its depth written where the
  // sphere's surface is, so neighbouring balls meet as spheres do; a ball of radius 0 is not drawn)
  function mat(set, U) {
    const D = { uA: set.uA, uT: { value: 0 }, uJig: { value: 0 }, uHalf: { value: 400 }, uMark: { value: 0 } };
    for (const k in D) if (!U[k]) U[k] = D[k];   // (filled in place: the caller keeps its uniforms)
    const m = new THREE.ShaderMaterial({
      uniforms: U, depthWrite: true, extensions: { fragDepth: true },
      vertexShader: `
attribute float aRad, aPh, aMark; attribute vec3 aCol;
uniform float uT, uJig, uHalf, uMark;
varying vec3 vC, vP; varying float vR;
void main() {
  if (aRad <= 0.0) { gl_Position = vec4(0.0, 0.0, 2.0, 1.0); gl_PointSize = 0.0; return; }
  vec3 p = position + uJig * vec3(sin(uT * 1.7 + aPh), sin(uT * 1.3 + aPh * 2.1), sin(uT * 1.9 + aPh * 0.7));
  vec4 mv = modelViewMatrix * vec4(p, 1.0);
  float r = aRad * length(modelViewMatrix[0].xyz);
  gl_Position = projectionMatrix * mv;
  gl_PointSize = clamp(2.0 * r * projectionMatrix[1][1] * uHalf / max(-mv.z, 0.001), 1.0, 256.0);
  vec3 lit = mix(aCol, vec3(0.27, 0.85, 1.0), aMark * uMark);
  vC = lit * (aMark > 0.5 ? 1.0 : 1.0 - 0.6 * uMark); vP = mv.xyz; vR = r;
}`,
      fragmentShader: `
uniform float uA; uniform mat4 projectionMatrix;   // (three.js declares it only in the vertex shader)
varying vec3 vC, vP; varying float vR;
void main() {
  vec2 c = gl_PointCoord * 2.0 - 1.0; c.y = -c.y;
  float d2 = dot(c, c);
  if (d2 > 1.0 || uA < 0.004) discard;
  vec3 n = vec3(c, sqrt(1.0 - d2));
  vec3 L = normalize(vec3(-0.45, 0.6, 0.66));
  float diff = max(dot(n, L), 0.0), spec = pow(max(dot(reflect(-L, n), vec3(0.0, 0.0, 1.0)), 0.0), 28.0);
  float rim = pow(1.0 - n.z, 2.0);
  vec3 col = vC * (0.42 + 0.62 * diff) * (0.78 + 0.22 * n.z) + 0.22 * spec + 0.18 * rim * vC;
  vec4 clip = projectionMatrix * vec4(vP + n * vR, 1.0);
  gl_FragDepthEXT = clamp(clip.z / clip.w * 0.5 + 0.5, 0.0, 1.0);
  gl_FragColor = vec4(col, uA);
}`,
    });
    // (see-through only while it fades, as the kit's materials are, and then writing no depth: a ball nearly faded out
    // would otherwise hide what lies behind it, a dark hole where it is, before its colour shows; the owner, 23 November 2026)
    Object.defineProperty(m, 'transparent', { configurable: true, get: () => U.uA.value < 0.999, set() {} });
    Object.defineProperty(m, 'depthWrite', { configurable: true, get: () => U.uA.value >= 0.999, set() {} });
    set.mats.push(m);
    return m;
  }
  // a crowd of molecules that move: mols [{ balls, c: [r, g, b] } (or cols, a colour a ball)]; place(i, pos, quat, k) puts molecule i at pos, turned by
  // quat (a THREE.Quaternion or null), k times its size (0 hides it); tint(i, c); tick(t) once a frame, after the places
  function cloud(set, mols, opts = {}) {
    const NB = mols.reduce((s, m) => s + m.balls.length, 0), first = [];
    const pos = new Float32Array(3 * NB), rad = new Float32Array(NB), col = new Float32Array(3 * NB), ph = new Float32Array(NB), mk = new Float32Array(NB), loc = new Float32Array(4 * NB);
    let n = 0;
    mols.forEach((m, i) => {
      first.push(n);
      const p = m.ph === undefined ? i * 2.39996 : m.ph;
      m.balls.forEach((b, k) => { loc.set(b, 4 * n); rad[n] = b[3]; col.set(m.cols ? m.cols[k] : m.c, 3 * n); ph[n] = p; pos.set(b.slice(0, 3), 3 * n); n++; });
    });
    first.push(n);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.BufferAttribute(pos, 3)); g.setAttribute('aRad', new THREE.BufferAttribute(rad, 1));
    g.setAttribute('aCol', new THREE.BufferAttribute(col, 3)); g.setAttribute('aPh', new THREE.BufferAttribute(ph, 1)); g.setAttribute('aMark', new THREE.BufferAttribute(mk, 1));
    const U = { uT: { value: 0 }, uJig: { value: opts.jig || 0 }, uHalf: { value: 400 }, uMark: { value: 0 } };
    if (opts.own) U.uA = { value: 1 };
    const points = new THREE.Points(g, mat(set, U)); points.frustumCulled = false;
    const V = new THREE.Vector3();
    let moved = false, tinted = false;
    return { points, U, n: mols.length, balls: NB,
      place(i, p, q, k = 1) {
        for (let j = first[i]; j < first[i + 1]; j++) {
          V.set(loc[4 * j] * k, loc[4 * j + 1] * k, loc[4 * j + 2] * k); if (q) V.applyQuaternion(q);
          pos[3 * j] = p[0] + V.x; pos[3 * j + 1] = p[1] + V.y; pos[3 * j + 2] = p[2] + V.z; rad[j] = loc[4 * j + 3] * k;
        }
        moved = true;
      },
      tint(i, c) { for (let j = first[i]; j < first[i + 1]; j++) col.set(c, 3 * j); tinted = true; },
      tick(t) {
        U.uT.value = t; U.uHalf.value = half();
        if (moved) { g.attributes.position.needsUpdate = true; g.attributes.aRad.needsUpdate = true; moved = false; }
        if (tinted) { g.attributes.aCol.needsUpdate = true; tinted = false; }
      } };
  }
  // drop each molecule (its reach) where it overlaps none placed before, nor the obstacles ([{ p, r }]): spot() a candidate
  // middle, tries of them, then it takes the last
  function scatter(reaches, spot, tol = 0.95, tries = 60, obst = []) {
    const out = obst.slice();
    reaches.forEach(rr => {
      let p;
      for (let k = 0; k < tries; k++) { p = spot(); if (out.every(o => Math.hypot(o.p[0] - p[0], o.p[1] - p[1], o.p[2] - p[2]) > tol * (o.r + rr))) break; }
      out.push({ p, r: rr });
    });
    return out.slice(obst.length).map(o => o.p);
  }
  return { of, reach, half, mat, cloud, scatter };
})();

// ---- packages/ppicell/src/sets/crowd.js (up to its set), read at build time
// One dot opening into the crowd it stands for (chapter 2): a cube of cytoplasm about 100 nanometres across, packed as a
// real cytoplasm is (proteins fill about a fifth of it here), with real proteins from the Protein Data Bank, each
// simplified to a few balls (its residues grouped: PPI_STRUCTS' `coarse`, src/data/gen_structs.py): ubiquitin,
// calmodulin, actin, GAPDH and tubulin, sized to scale against each other and the cube, none overlapping, jiggling in
// place. One kind is marked (crowd_mark: every calmodulin), the copies one dot of the map stands for. Drawn in the
// cell's frame, at a spot in the cytosol; the cube grows out of a single dot (crowd_open).
// Every ball is one point drawn as a lit sphere with its true depth (a sphere impostor: how molecular viewers draw big
// crowds), all in one draw; the jiggle is the shader's, so nothing is sent to the graphics card a frame. The packing is
// done before the set is built, a slice a load step (SETS.crowd.prep), so no step runs long.
const CROWD = (() => {
  const SIDE = 0.2, HALF = SIDE / 2, PER_A = SIDE / 1000;   // (scene units per angstrom: the side is 100 nm, 1,000 A)
  // the kinds, largest first (packed in that order, the small ones then fill the gaps); share: of the molecules, each
  // among a cell's most plentiful proteins (illustrative shares); a muted colour each
  const KINDS = [
    { key: 'tub', share: 0.11, c: [0.55, 0.72, 0.6] },
    { key: 'gapdh', share: 0.12, c: [0.76, 0.7, 0.55] },
    { key: 'actin', share: 0.2, c: [0.78, 0.62, 0.72] },
    { key: 'cam', share: 0.12, c: [0.55, 0.62, 0.8], mark: true },
    { key: 'ubq', share: 0.45, c: [0.66, 0.7, 0.76] },
  ];
  // how many: a real cube this size holds a few thousand; WANT keeps the balls near 40,000 (one draw of points)
  const WANT = 3600, TOL = 0.9, JIG = 0.0011;
  for (const k of KINDS) {
    const S = PPI_STRUCTS[k.key];
    k.balls = S.coarse.map(b => [b[0] / 10 * PER_A, b[1] / 10 * PER_A, b[2] / 10 * PER_A, b[3] / 10 * PER_A]);
    k.reach = Math.max(...k.balls.map(b => Math.hypot(b[0], b[1], b[2]) + b[3]));
    k.want = Math.round(WANT * k.share);
  }
  const maxR = Math.max(...KINDS.flatMap(k => k.balls.map(b => b[3]))), CW = 2 * maxR;
  const rnd = (s => () => { s = s + 0x6D2B79F5 | 0; let t = Math.imul(s ^ s >>> 15, 1 | s); t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t; return ((t ^ t >>> 14) >>> 0) / 4294967296; })(23);
  const P = { done: false, ki: 0, n: 0, tries: 0, mols: [], balls: [], grid: new Map() };
  const key = (a, b, c) => a + 2000 * b + 4e6 * c, cell = v => Math.floor((v + HALF) / CW);
  const Q = new THREE.Quaternion(), V = new THREE.Vector3();
  function fits(pts) {
    for (const [x, y, z, r] of pts) {
      const gx = cell(x), gy = cell(y), gz = cell(z);
      for (let dx = -1; dx <= 1; dx++) for (let dy = -1; dy <= 1; dy++) for (let dz = -1; dz <= 1; dz++) {
        for (const o of P.grid.get(key(gx + dx, gy + dy, gz + dz)) || []) if (Math.hypot(o[0] - x, o[1] - y, o[2] - z) < TOL * (o[3] + r)) return false;
      }
    }
    return true;
  }
  // a slice of the packing (ms milliseconds): each molecule a random spot and turn, kept where none of its balls overlaps
  // another's; a kind stops at its share or after many misses in a row
  function pack(ms) {
    const t0 = performance.now();
    while (!P.done && performance.now() - t0 < ms) {
      const k = KINDS[P.ki];
      if (!k || P.n >= k.want || P.tries > 400) { if (!k) { P.done = true; break; } P.ki++; P.n = 0; P.tries = 0; continue; }
      const room = HALF - k.reach, c = [0, 1, 2].map(() => (rnd() * 2 - 1) * room);
      Q.setFromEuler(new THREE.Euler(rnd() * 6.283, rnd() * 6.283, rnd() * 6.283));
      const pts = k.balls.map(b => { V.set(b[0], b[1], b[2]).applyQuaternion(Q); return [c[0] + V.x, c[1] + V.y, c[2] + V.z, b[3]]; });
      if (!fits(pts)) { P.tries++; continue; }
      P.tries = 0; P.n++;
      const m = { k: P.ki, c, ph: rnd() * 6.283, mark: !!k.mark };
      P.mols.push(m);
      for (const b of pts) {
        P.balls.push([...b, P.mols.length - 1]);
        const g = key(cell(b[0]), cell(b[1]), cell(b[2]));
        if (!P.grid.has(g)) P.grid.set(g, []);
        P.grid.get(g).push(b);
      }
    }
    if (P.done) P.grid = null;
    return P.done;
  }
  return { SIDE, HALF, PER_A, KINDS, JIG, P, pack };
})();

// The culling's sums on the grid, apart from three.js so node can test them (src/test-cull.mjs). The balls are sorted
// into G x G x G cells (index i + G * (j + G * k)); each cell has an opacity, how much of a line of sight one cell long
// its balls block on average: count * pi * mean(r^2) / h^2, the optical depth of balls scattered at random (a line
// through a cloud of n balls a unit volume, each of cross-section s, meets on average n * s of them a unit length).
const CULL = (() => {
  // each cell's opacity -> the least of its 3 x 3 x 3 neighbourhood, outside the grid counting as empty: a line of sight
  // that only grazes a cell, or runs along the cube's skin, is never credited with more than its thinnest neighbour
  function erode(op, G) {
    const out = new Float32Array(G * G * G);
    for (let k = 0; k < G; k++) for (let j = 0; j < G; j++) for (let i = 0; i < G; i++) {
      let m = Infinity;
      for (let dk = -1; dk <= 1; dk++) for (let dj = -1; dj <= 1; dj++) for (let di = -1; di <= 1; di++) {
        const x = i + di, y = j + dj, z = k + dk;
        const v = x < 0 || y < 0 || z < 0 || x >= G || y >= G || z >= G ? 0 : op[x + G * (y + G * z)];
        if (v < m) m = v;
      }
      out[i + G * (j + G * k)] = m;
    }
    return out;
  }
  // tau[c]: the least optical depth in front of cell c as seen from the eye e (in cell units, [x, y, z], anywhere): a
  // sweep outwards from the eye's cell, each cell taking the least of its neighbours one step towards the eye (along
  // any of the axes on which the eye lies beyond it: the 26-neighbour steps a line of sight from the eye to any point of
  // the cell can take) plus that neighbour's opacity; a neighbour outside the grid gives 0 (nothing in front). As many
  // steps as the larger of a line's spans in cells is never more than its length in cells, so on an even crowd this is
  // a lower bound on every line of sight into the cell; uneven ones are covered by the eroded opacity. O(cells).
  function sweep(op, G, e, tau) {
    const ei = [Math.floor(e[0]), Math.floor(e[1]), Math.floor(e[2])], ord = [], st = [];
    for (let a = 0; a < 3; a++) {
      const c = Math.min(G - 1, Math.max(0, ei[a])), o = [c], s = new Int8Array(G);
      for (let d = 1; d < G; d++) { if (c - d >= 0) o.push(c - d); if (c + d < G) o.push(c + d); }
      for (let i = 0; i < G; i++) s[i] = i === ei[a] ? 0 : i < ei[a] ? 1 : -1;
      ord.push(o); st.push(s);
    }
    const [ox, oy, oz] = ord, [sx, sy, sz] = st;
    for (const k of oz) for (const j of oy) for (const i of ox) {
      const dx = sx[i], dy = sy[j], dz = sz[k], c = i + G * (j + G * k);
      if (!dx && !dy && !dz) { tau[c] = 0; continue; }
      let m = Infinity;
      for (let b = 1; b < 8; b++) {
        const x = i + (b & 1 ? dx : 0), y = j + (b & 2 ? dy : 0), z = k + (b & 4 ? dz : 0);
        if ((b & 1 && !dx) || (b & 2 && !dy) || (b & 4 && !dz)) continue;
        if (x < 0 || y < 0 || z < 0 || x >= G || y >= G || z >= G) { m = 0; break; }
        const p = x + G * (y + G * z), v = tau[p] + op[p];
        if (v < m) m = v;
      }
      tau[c] = m;
    }
    return tau;
  }
  // how deep a cell must lie (in optical depth) to be left out as hidden: a line of sight through a random crowd gets
  // through depth tau with chance exp(-tau), and the eroded opacity and the step count both err the safe way
  // (src/test-cull.mjs casts rays to check that no first hit is in a hidden cell). A packed crowd is not random: its
  // molecules leave channels between them, and at 12 the sweep found a hole of some 170 pixels inside a million balls
  // (a ball seen through a channel between near ones), so 18 (none found; src/README.md, "What the sweep says")
  const TAU = 18;
  return { erode, sweep, TAU };
})();

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


// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story (each sets/<name>.js defines SETS.<name>; list the files in build.mjs)
const SET_ORDER = ['crowds'];
// on a small screen held sideways the scene stands back to fit the strip above the panel (resize)
const STRIP_FIT = 0.9;
// (no set is drawn in another's frame here; the engine's shared lines keep the hook)
const FRAME = {};
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

const buildMs = dt => (GL.renderer && GL.renderer.xr.isPresenting ? 1 : clamp((dt || 0) * 125, 2, 8));

// ================================================================== STORY ==
// The chapters, on story time (seconds): a key, the name on the timeline, and where each begins and ends.
const CH = [
  { key: 'title', name: 'Crowds', a: 0, b: 14 },
];
// Narration timing: [time in the recording, story time] pairs; the story is stretched or squeezed between them so
// each cue lands on its sentence. Without a recording (the default: captions only) the story keeps its own clock.
// With one (audio/narration.mp3 in the package: e7_app.js, narrationFile) put the pairs here, and where each chapter's
// words end in it as NARRATION_ENDS = { title: 19.5, ... } (the slideshow lets the voice finish there).
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
// each set's views nudged so they fit beside the side panel on a wide screen: { set: { view: [daz, del, ddist, dtx,
// dty, dtz] } } (added to the set's own view, in story and explore mode alike); none here
const FIT = {};
// how much further back a view stands on a phone held upright: { set: { view: factor } }
const NARROW = { crowds: { default: 1.15 } };
const narrowOf = (k, name) => (NARROW[k] && NARROW[k][name]) || 1;
// a set's anchor point, in the set's own coordinates
function anchorOf(k, at) {
  const s = GL.sets[k];
  let p = typeof at === 'string' ? s.anchors[at] : at;
  if (typeof p === 'function') p = p();
  return p || [0, 0, 0];
}

const f2 = v => (v < 0 ? '−' : '') + Math.abs(v).toFixed(2);
const word = n => ['no', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'][n] || String(n);
const listOf = a => (a.length < 2 ? a.join('') : a.slice(0, -1).join(', ') + ' and ' + a[a.length - 1]);
// colours as text on the HTML panel, which is light in the light theme: a colour mixed with the panel's ink (darker on
// a light panel, lighter on a dark one). The headset's panel is dark: its canvas twin takes the colour itself (data-col).
const inkCol = c => `color-mix(in srgb, ${c} 55%, var(--ink))`;
const swCol = c => c;   // a swatch or a bar in the same colour
const CYAN = '#46d9ff', AMBER = '#ffb43b', MAGENTA = '#ff5ad9';

function buildStory() {
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // values a set starts the story with (keyed at time 0, so a set's resting defaults never leak into the story)
  const start = vals => { for (const n in vals) if (n in DEF) key(n, 0, vals[n]); };
  const step = (at, out, col, b, text) => `<li data-at="${at}"${out ? ` data-out="${out}"` : ''} data-col="${col}" style="border-left-color:${swCol(col)}"><b style="color:${inkCol(col)}">${esc(b)}</b>${text}</li>`;
  // ------------------------------------------------------------ panel copy
  // Each chapter's text: data-at is when a line appears (seconds into the chapter), data-out when it goes. The headset's
  // panel cannot scroll, so no chapter shows more than fits at once: parts that take turns in one place (turns), each
  // fading out as the next comes.
  const turns = (...parts) => `<div style="display:grid">${parts.map(p => `<div style="grid-area:1/1">${p}</div>`).join('')}</div>`;
  const html = {
    title: `<h1 data-at="0.6">${esc(XR_TITLE)}</h1>
      <p class="lede" data-at="1.6">How many balls can a headset draw, and what can it leave out?</p>
      <p data-at="3">Each ball is a part of a protein, as in the crowd of Back into the cell. A cube of cytoplasm holds thousands of them; a cell, billions.</p>
      <ul class="steps">${step(5, 0, CYAN, 'Impostors', 'one point a ball, shaded as a sphere')}
        ${step(6.5, 0, AMBER, 'Meshes', 'one small ball of triangles, copied for every ball')}
        ${step(8, 0, MAGENTA, 'Culling', 'cells out of view, far detail, front to back, hidden cells')}</ul>
      <p data-at="10"><button class="btn primary" id="btnGoExplore" type="button">Explore</button></p>`,
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
  start({ crowds_n: 100000, crowds_what: 1, crowds_draw: 0, crowds_size: 1, crowds_shade: 0, crowds_ao: 1, crowds_col: 0,
    crowds_grid: 1, crowds_lod: 1, crowds_order: 1, crowds_hide: 1 });
  const a = C.title.a, b = C.title.b;
  show('crowds', 0.2, 2);
  // (the grid shown for a moment: each cell its own colour)
  key('crowds_col', a + 8, 0); key('crowds_col', a + 8.05, 1); key('crowds_col', a + 11.5, 1); key('crowds_col', a + 11.55, 0);
  cam(a, 'crowds', 'default', -20);
  cam(b, 'crowds', 'default', 20, 'spin');
  sfxCue(a + 8, 'step', 'crowds', 'top', { gain: 0.4 });
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  // (the sets label their own parts; the story adds what the scene alone does not say)
  label('crowds', 'top', '<b>The grid</b> · each cell its own colour', C.title.a + 8.2, C.title.a + 11.5, 'cyn');
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
// (v224) where the side panel and the timeline are, read at the start of a page's frame (labelRead, frame), before the
// frame writes anything, so the read finds the layout done and forces none; placeLabels reads them itself in a frame
// that did not (the stories with frames of their own)
const LRECT = { f: -1, pr: null, bar: 0 };
function labelRead() {
  LRECT.f = window.__frames || 0;
  LRECT.pr = $('#panel').getBoundingClientRect(); LRECT.bar = $('#bar').getBoundingClientRect().top || window.innerHeight;
}
function placeLabels(list, alphaOf) {
  _placed.length = 0;
  const vis = [], W = window.innerWidth, H = window.innerHeight;
  if (LRECT.f !== (window.__frames || 0)) labelRead();
  const pr = LRECT.pr, barTop = LRECT.bar;
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
// Explore mode: one scene, the crowd, with two tabs: the balls (how many, what, how drawn and shaded) and the culling
// (four switches, and holding the culling's eyes still to walk out and look). Both show the read-out: what is built,
// what is drawn and what a frame costs (computed each half second from the set's stats()).
const SCENES = [
  ['crowds', 'Crowd', 'Balls standing for proteins\' parts, drawn as impostors (one point each, shaded as a sphere) or as small meshes, and four ways of leaving out what you cannot see. Frame rate in a headset: press B or Y twice.'],
];
const SCENE_SHORT = {};
const TABS = [['scenes', 'Balls'], ['cull', 'Culling']];
const ctlsOf = k => GL.sets[k].controls || [];
// a control the panes offer now: a set may say when one applies (when(values)), so none sits there doing nothing; the
// shared state keeps every control (ctlsOf) all the same
const ctlShown = (k, c) => !c.when || c.when(Object.fromEntries(ctlsOf(k).map(x => [x.key, ctlValue(k, x)])));
const X = { tab: 'scenes', scene: SET_ORDER[0], ctl: {}, t0: 0, turn: 'on' };
const XS = {};
// params that pick something by number jump to their new value instead of easing through the ones in between
const STEP = new Set(['crowds_n', 'crowds_size', 'crowds_draw', 'crowds_what', 'crowds_shade', 'crowds_ao', 'crowds_col', 'crowds_grid', 'crowds_lod', 'crowds_order', 'crowds_hide']);
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);
const ctlOf = (k, key) => ctlsOf(k).find(c => c.key === key);
// a view option's camera: the cam view of the same name, or the one it stands for ({ set: { option: view } })
const CAM_ALIAS = {};
function camFor(k, v) {
  const c = GL.sets[k].cam || {}, al = CAM_ALIAS[k] || {};
  for (const x of [al[v], v]) if (x && c[x]) return x;
  return null;
}
const viewCam = k => { const c = ctlOf(k, 'view'); return c ? camFor(k, ctlValue(k, c)) : null; };
// the view on show in a set
const viewIs = (k, v) => { const c = ctlOf(k, 'view'); return !!c && ctlValue(k, c) === v; };
// what the sets know (their api())
const API = {};
const api = k => API[k] || (API[k] = (GL.sets[k] && GL.sets[k].api ? GL.sets[k].api() : null) || {});
// work for the next frame, once the sets have drawn what was just picked (their anchors follow their params)
const NEXT = [];

// what the chosen scene and its controls ask for: that set fully in, every other set out
function exploreTargets(now = performance.now()) {
  const k = X.scene, s = GL.sets[k], tg = Object.assign({}, s.params);
  tg[k + '_a'] = 1;
  const c = { t: (now - X.t0) / 1000 };
  for (const ct of s.controls || []) c[ct.key] = ctlValue(k, ct);
  if (s.explore) Object.assign(tg, s.explore(c));
  const out = {};
  for (const n in DEF) out[n] = n in tg ? tg[n] : n.endsWith('_a') ? 0 : XS[n];
  return out;
}
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  // (LOG's params ease on their log scale, as in the story: logMix)
  for (const n in DEF) XS[n] = STEP.has(n) ? tg[n] : LOG.has(n) ? logMix(XS[n], tg[n], k) : Math.abs(tg[n] - XS[n]) < 1e-6 ? tg[n] : XS[n] + (tg[n] - XS[n]) * k;   // (snapped at the end: a value still shrinking would change the picks' key every frame, pickMemo)
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
// (sound effects: a control changed)
function ctlSound(k, key, v) {
  if (key === 'view') sfxAct('whoosh', k, null, { dur: 0.7, pitch: 1.1 }); else sfxAct('step', k, null);
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

// Hold the culling: this device's own (its eyes, not the room's), so never in the shared state
function setHold(on) {
  api('crowds').hold(on);
  sfxAct('step', 'crowds', null);
  renderAll();
}

// ------------------------------------------------------- shared rooms --
// What everyone at a station sees alike in explore mode: the tab, the scene and every control (how many balls, what,
// how drawn and shaded, the four culling switches, the view). The camera, Hold and the read-out are each person's own.
// v: the shape of this state (FORMAT is the app's: a package that changes its state's shape bumps v, and apply ignores
// a state of another v, from an older copy on another device).
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
  return { v: COLLAB_V, tab: X.tab, scene: X.scene, ctl };
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
  renderAll();
}

// ------------------------------------------------------------------ panes --
// (a lit chip as the shell's primary button: its text in the panel's colour, readable in either theme)
const chip = (attrs, label, on, col) => `<button type="button" ${attrs} aria-pressed="${!!on}"${on ? ' style="background:var(--cyan);color:var(--panel-solid)"' : ''}>${col ? `<span class="sw" style="background:${swCol(col)}"></span>` : ''}${label}</button>`;
const cap = s => (s ? String(s).charAt(0).toUpperCase() + String(s).slice(1) : '');
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
      hold: () => setHold(v === '1'),
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
// a tab picked by hand (a shared room's tab arriving does not come here: its scene comes with it)
function pickTab(k) { showTab(k); }
function renderAll() { renderScenes(); renderCull(); updateExtraLabels(); }
// the controls of one tab ('cull' or the rest), as rows of chips
const ctlRows = tab => ctlsOf(X.scene).filter(c => ctlShown(X.scene, c) && (c.tab === 'cull') === (tab === 'cull'))
  .map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => chip(`data-act="ctl" data-ctl="${c.key}" data-v="${v}"`, esc(n), ctlValue(X.scene, c) === v)).join('')}</div>`).join('');
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene);
  pane.innerHTML = `<p class="sub">${esc(sc[2])}</p><p class="sub crowds-read">${esc(readLine())}</p><p class="sub">${esc(whatLine())}</p>${ctlRows('scenes')}`;
}
function renderCull() {
  const pane = $('#pane-cull');
  if (!pane) return;
  const held = api('crowds').held && api('crowds').held();
  pane.innerHTML = `<p class="sub">The balls are sorted into a grid of cells; a draw is a run of neighbouring cells. Each switch leaves out what you would not see, or draws it more cheaply.</p>
    <p class="sub crowds-read">${esc(readLine())}</p><p class="sub crowds-cull">${esc(cullLine())}</p>${ctlRows('cull')}
    <p class="grp-h">Hold the culling</p><div class="chips">${chip('data-act="hold" data-v="1"', 'Hold here', held)}${chip('data-act="hold" data-v="0"', 'Follow me', !held)}</div>
    <p class="sub">Held, the cells are judged from where you were: walk or turn away and see what is left out. Yours alone.</p>`;
}
// ------------------------------------------------------------ the read-out (both panes, page and headset)
const big = v => (v >= 1e6 ? (v / 1e6).toFixed(v >= 1e7 ? 0 : 1) + 'M' : v >= 1e4 ? Math.round(v / 1000) + 'k' : fmt(Math.round(v)));
const cst = () => (GL.sets.crowds ? GL.sets.crowds.stats() : null);
// what is drawn and what a frame costs (computed each half second)
function readLine() {
  const s = cst();
  if (!s || !s.n) return s && s.building ? `Building ${fmt(s.building)} balls…` : 'Building the crowd…';
  const pct = s.n ? Math.round(100 * s.drawn / s.n) : 0, mesh = s.mode === 1;
  const fr = s.fps ? `${Math.round(s.fps)} frames a second (${s.mean.toFixed(1)} ms, worst ${s.worst.toFixed(0)} ms)` : 'frame rate not yet measured';
  return `${fmt(s.n)} balls; ${fmt(s.drawn)} drawn (${pct} %) in ${s.cellsDrawn} of ${s.cells} cells, ${s.draws} draws${s.eyes > 1 ? ' an eye' : ''}. `
    + `${mesh ? `${big(s.tris)} triangles` : `${big(s.drawn)} points`}; ${fmt(s.calls)} draw calls in all. ${fr}.${s.building ? ` Building ${fmt(s.building)}…` : ''}`;
}
// what is in the scene: the crowd's molecules, or the cloud
function whatLine() {
  const s = cst();
  if (!s || !s.n) return '';
  const names = api('crowds').kindNames || [];
  const gl = s.gl2 ? '' : ' Meshes need WebGL 2, which this browser lacks: impostors instead.';
  if (s.what === 1) return `About ${fmt(s.mols)} protein molecules (${s.kinds.map((n, i) => `${big(n)} balls of ${names[i]}`).join(', ')}), copies of one packed cube of cytoplasm about 100 nm across, each copy turned.${gl}`;
  return `A made-up cloud: ${fmt(s.n)} balls at random, a fifth of the cube filled, coloured as the protein kinds.${gl}`;
}
// what each culling switch leaves out now
function cullLine() {
  const s = cst();
  if (!s || !s.n) return '';
  const [a, b, c] = s.perLod, mesh = s.mode === 1;
  return `${s.out} cells out of view and ${s.hidden} hidden behind full cells left out; ${fmt(s.thinOut)} far balls thinned out. `
    + (mesh ? `Detail: ${big(a)} balls at 320 triangles, ${big(b)} at 80, ${big(c)} at 20.` : `Detail: ${big(a)} balls with their true depth, ${big(b)} flat and cheaper.`)
    + ` Grid ${s.G} x ${s.G} x ${s.G}; built in ${fmt(s.ms)} ms.`;
}
// the read-out written again (each half second, from the set): only its lines, not the panes
function readTick() {
  document.querySelectorAll('#explore .crowds-read').forEach(e => { e.textContent = readLine(); });
  document.querySelectorAll('#explore .crowds-cull').forEach(e => { e.textContent = cullLine(); });
}
// labels the panes add (none: the sets label their own picks)
function updateExtraLabels() {}


// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2();
// what a ray (a THREE.Raycaster in world coordinates) points at in the scene on show, or null: nothing to pick here
function pickWith(rc) { return null; }
// what is under the mouse, in explore mode
function pickAt(mx, my) {
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  return pickWith(_rc);
}
// where a pick is, in its set's own frame (for the headset's ray and tip), or null
function pickPos(p) { return null; }
// a pick's tip: [bold, rest]
const pickText = p => ['', ''];
// a pick clicked or pressed
function choosePick(p) {}
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
// (v224) something made after the load (a label's sprite or sign, a set's late mesh), compiled at once with the scene's
// lights and its textures sent to the card, not on the frame that first shows it: three.js r128 keys every program by
// the scene's light counts, an unlit material's too, so one compiled in a scene without lights was linked again there.
// Returns o
function compileLate(o) {
  const r = GL.renderer;
  if (!r || !o || !GL.scene) return o;
  const sc = compileLate.sc || (compileLate.sc = new THREE.Scene());
  try {
    sc.children = GL.scene.children.filter(x => x.isLight).concat({ traverse: f => o.traverse(f), traverseVisible() {} });
    r.compile(sc, GL.camera);
    const tex = t => { if (t && t.isTexture && t.image) r.initTexture(t); };   // (a map, or a shader's texture: ovary's stain)
    o.traverse(x => { for (const m of [].concat(x.material || [])) { tex(m.map); for (const k in m.uniforms || {}) tex(m.uniforms[k].value); } });
  } catch (e) { /* compiled on first use instead */ }
  sc.children = [];
  return o;
}
// the headset's own materials compiled in the load, not in the frame that first shows one (v137): a label's sprite, a 3D
// sign or panel, a panel on top, a controller's dot and ray, with the scene's lights (compileLate, v224). Kept (never
// disposed: a compiled program goes when the last material that uses it does), a handful of objects
function xrWarm() {
  try {
    const sc = new THREE.Group(), t = new THREE.Texture(), g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute([0, 0, 0, 1, 0, 0, 0, 1, 0], 3));
    sc.add(new THREE.Sprite(new THREE.SpriteMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })),
      new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, depthTest: false, depthWrite: false })),
      new THREE.Mesh(g, new THREE.MeshBasicMaterial({ map: t, transparent: true, alphaTest: 0.1 })),
      new THREE.Mesh(g, new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthTest: false, depthWrite: false })),
      new THREE.Line(g, new THREE.LineBasicMaterial({ color: 0x9fe8ff, transparent: true, depthTest: false, depthWrite: false })));
    compileLate(sc);
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
  GL.world.add(compileLate(sp));
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
  GL.world.add(compileLate(sg));
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
// (v224) a headset points each controller every frame: a ray that has not moved, over a scene that has not moved or
// changed, is not tested again (pickRay; fn(a, b) tests it). Its key: the ray, the world's and every set's matrices and
// what the story's pickSig(out) adds (what can be picked; false: test this ray); a story without pickSig tests every
// ray, as before. Two keys are kept, one a controller (a miss takes the place of the one used longer ago)
const PKM = { k: [[], []], r: [null, null], u: [0, 0], t: [], n: 0 };
function pickMemo(o, d, fn, a, b) {
  const K = PKM.t;
  K.length = 0;
  if (typeof pickSig !== 'function' || pickSig(K) === false) return fn(a, b);
  K.push(o.x, o.y, o.z, d.x, d.y, d.z);
  for (const e of GL.world.matrixWorld.elements) K.push(e);
  for (const k of SET_ORDER) for (const e of GL.sets[k].group.matrixWorld.elements) K.push(e);
  for (let j = 0; j < 2; j++) {
    const P = PKM.k[j];
    if (P.length !== K.length) continue;
    let same = true;
    for (let i = 0; i < K.length && same; i++) same = P[i] === K[i];
    if (same) { PKM.u[j] = ++PKM.n; return PKM.r[j]; }
  }
  const j = PKM.u[0] <= PKM.u[1] ? 0 : 1, r = fn(a, b);
  PKM.t = PKM.k[j]; PKM.k[j] = K; PKM.r[j] = r; PKM.u[j] = ++PKM.n;
  return r;
}
function pickRay(o, d) {
  if (APP.mode !== 'explore') return null;
  _prc.set(o, d);
  return pickMemo(o, d, pickWith, _prc);
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
  // (its 2D context, and with it the canvas's memory, only at the first draw: a page that never enters a headset makes none, v226)
  const P = { w, h, cv, cx: null, get ctx() { return this.cx || (this.cx = cv.getContext('2d')); }, tex, mesh, draw, sig, regions: [], hover: null, last: '', t: 0, inScene: false };
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
// the story's own part of the main panel's signature (sigMain): '' (nothing beyond the chapter and its lines)
const sigMainS = () => '';
// explore mode in the main panel's signature: everything its panes show (drawn again only when this changes)
function sigMainX() {
  return ['x', audioLabel(), xrSig(), X.tab, X.scene, JSON.stringify(X.ctl), readLine(), whatLine(), cullLine(), !!(api('crowds').held && api('crowds').held())].join('|');
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
// explore mode's pane for each tab (drawExplorePane): the headset's twin of each render* in e4_explore.js
function drawTabPane(ctx, P, x, y, W, bottom) {
  ({ scenes: drawScenesPane, cull: drawCullPane }[X.tab] || drawScenesPane)(ctx, P, x, y, W, bottom);
}
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
// a tab's controls (ctlRows' twin): each a row, its name on the left and its options as chips beside it
function drawCtlRows(ctx, P, tab, x, y, W, bottom) {
  const L = 250;
  for (const c of ctlsOf(X.scene).filter(c => ctlShown(X.scene, c) && (c.tab === 'cull') === (tab === 'cull'))) {
    if (y + 52 > bottom) break;
    ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, c.label, L - 14), x, y + 14);
    y += flow(ctx, P, c.options.map(([v, n]) => ({ id: 'ctl:' + c.key + ':' + v, label: n, on: ctlValue(X.scene, c) === v, fn: () => setCtl(X.scene, c.key, v) })), x + L, y, W - L, bottom, { px: 22, h: 50 }) + 12;
  }
  return y;
}
// the balls: the read-out, what is in the scene and the controls (renderScenes' twin)
function drawScenesPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, readLine(), x, y, W, 23, 31, VC.ink, 400, 4) + 8;
  y += textBlock(ctx, whatLine(), x, y, W, 21, 29, VC.muted, 400, 3) + 14;
  drawCtlRows(ctx, P, 'scenes', x, y, W, bottom);
}
// the culling: the read-out, what each switch leaves out, the switches and Hold (renderCull's twin)
function drawCullPane(ctx, P, x, y, W, bottom) {
  y += textBlock(ctx, readLine(), x, y, W, 23, 31, VC.ink, 400, 4) + 8;
  y += textBlock(ctx, cullLine(), x, y, W, 21, 29, VC.muted, 400, 4) + 14;
  y = drawCtlRows(ctx, P, 'cull', x, y, W, bottom);
  if (y + 52 > bottom) return;
  const held = !!(api('crowds').held && api('crowds').held());
  ctx.font = vfont(22); ctx.fillStyle = VC.muted; ctx.fillText('Hold the culling', x, y + 14);
  y += flow(ctx, P, [{ id: 'hold:1', label: 'Hold here', on: held, fn: () => setHold(true) }, { id: 'hold:0', label: 'Follow me', on: !held, fn: () => setHold(false) }], x + 250, y, W - 250, bottom, { px: 22, h: 50 }) + 12;
  if (y + 30 < bottom) textBlock(ctx, 'Held, the cells are judged from where you were: walk or turn away and see what is left out. Yours alone.', x, y, W, 21, 29, VC.muted, 400, 2);
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
// (v224) a page at rest draws nothing, as a headset away from its station does (xrIdle): a paused story, its frame
// once drawn (a set's look depends only on its params and the time), is not worked out or drawn again until something
// changes: the story's time, mode or play, the window's size, the page's classes, theme or clear colour (focus mode,
// the panels, the look), any input on the page (pointer, wheel, keys, a control), a load step, a set still building, a
// model still loading; and at least once a second (a file that came meanwhile). Sets on their way to the card (PRIME) go
// on in the quiet frames, off screen. The clock, the slideshow, the sound effects and the narration go on every frame;
// explore mode and a headset draw every frame, as before. After any change, input or build it draws on for 2 s of frame
// time (PAGE.hold, the sum of the drawn frames' dt, not the clock: a slow page's dt is capped at 0.1): some sets ease on
// the frame's dt (mutation's letters, qubits' cube, micro's crossfades) and settle only on drawn frames
const PAGE = { v: [], at: 0, wake: 1, on: false, hold: 0 };
const pageWake = () => { PAGE.wake = 1; };
const pageBusy = () => (typeof molWait === 'function' && molWait()) || !!GL.jobPend ||
  SET_ORDER.some(k => { const s = GL.sets[k]; return !!(s && s.idle && s.buildPend !== false && (s.buildPend = s.idle(0, 0) !== false)); });
function pageIdle(now, dt) {
  if (!PAGE.on) { PAGE.on = true; for (const e of ['pointerdown', 'pointermove', 'pointerup', 'wheel', 'keydown', 'keyup', 'input', 'change', 'resize', 'focus', 'touchstart']) window.addEventListener(e, pageWake, { capture: true, passive: true }); }
  const V = PAGE.v, b = document.body, h = document.documentElement, cc = GL.renderer.getClearColor(_pgc).getHex() + GL.renderer.getClearAlpha();
  const same = V[0] === APP.t && V[1] === APP.mode && V[2] === APP.playing && V[3] === window.innerWidth && V[4] === window.innerHeight &&
    V[5] === window.devicePixelRatio && V[6] === b.className && V[7] === h.className && V[8] === h.getAttribute('data-theme') && V[9] === cc;
  let busy = false;
  if (same && !PAGE.wake && APP.mode === 'story' && !APP.playing && LOAD.done && now - PAGE.at < 1000 && PAGE.hold <= 0 && !(busy = pageBusy())) {
    if (typeof PRIME !== 'undefined' && PRIME.q.length && typeof primeStep === 'function') primeStep(dt);   // (the quiet frames send the sets to the card meanwhile: off screen)
    if (navigator.xr && typeof xrPrep === 'function') xrPrep(1);   // (and the headset's keep-clear sample goes on: it returns at once when done)
    return true;
  }
  PAGE.hold = !same || PAGE.wake || busy ? 2 : PAGE.hold - dt;   // (also after a build ends: a fade on the clock, pet's shells; not the once-a-second frame alone, or it would never rest)
  V[0] = APP.t; V[1] = APP.mode; V[2] = APP.playing; V[3] = window.innerWidth; V[4] = window.innerHeight;
  V[5] = window.devicePixelRatio; V[6] = b.className; V[7] = h.className; V[8] = h.getAttribute('data-theme'); V[9] = cc;
  PAGE.at = now; PAGE.wake = 0;
  return false;
}
const _pgc = new THREE.Color();
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
  if (!xr && pageIdle(now, dt)) { window.__frames = (window.__frames || 0) + 1; return; }   // (a page at rest: nothing changed, nothing drawn)
  if (!xr) labelRead();   // (the panel's and the timeline's places, before the frame writes anything: placeLabels)
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
  GL.sets.crowds.onBuild = () => renderAll();   // (the panes' lines, once the set has built a crowd)
  GL.sets.crowds.onStats = () => readTick();   // (the read-out, each half second)
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
    // #<key>&explore&scene=<set>&<control key>=<option> (an option by its key or its name), &tab=<tab>, &now (no easing)
    const sc = hp.get('scene');
    if (sc && GL.sets[sc]) openScene(sc, false);
    orbit.cur = view(X.scene, viewCam(X.scene) || 'default'); orbit.to = null;
    for (const c of ctlsOf(X.scene)) {
      const q = String(hp.get(c.key) || '').toLowerCase(), o = q && c.options.find(([v, n]) => v.toLowerCase() === q || String(n).toLowerCase() === q);
      if (o) setCtl(X.scene, c.key, o[0]);
    }
    if (hp.get('tab') && TABS.some(t => t[0] === hp.get('tab'))) pickTab(hp.get('tab'));
    // &hold: the culling held where the view starts (for a look from outside at what is left out)
    if (hp.has('hold')) NEXT.push(() => api('crowds').hold(true));
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
