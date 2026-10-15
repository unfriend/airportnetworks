// A glimpse into the future of network medicine: a 3D tour of the Ludwig Boltzmann
// Institute for Network Medicine, from the parts of a protein machine to whole bodies.
// Runs inside index.html, which owns the page, the renderer and the headset session.
HOST.register('lbi', function (HOST) {
'use strict';
const D2R = Math.PI / 180;
const $ = s => document.querySelector(s);
const fmt = n => Math.round(n).toLocaleString('en-US');
const esc = s => String(s).replace(/[&<>"]/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
const css = name => getComputedStyle(document.documentElement).getPropertyValue(name).trim();

// =================================================================== KIT ==
// Shared helpers for the 3D sets: makeKit(THREE) returns K.
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
// Each set is one 3D scene of the tour, centred on the origin. The story fades
// sets in and out and drives them through their params (see SETS.x.params).
const SETS = {};
const STUB_CORE=[{"sym":"PSMA1","name":"Proteasome alpha 1","role":"proteasome core","module":5,"essential":1,"degree":4},{"sym":"PSMA2","name":"Proteasome alpha 2","role":"proteasome core","module":5,"essential":1,"degree":4},{"sym":"PSMA3","name":"Proteasome alpha 3","role":"proteasome core","module":5,"essential":1,"degree":6},{"sym":"PSMA4","name":"Proteasome alpha 4","role":"proteasome core","module":5,"essential":1,"degree":4},{"sym":"PSMA5","name":"Proteasome alpha 5","role":"proteasome core","module":5,"essential":1,"degree":4},{"sym":"PSMA6","name":"Proteasome alpha 6","role":"proteasome core","module":5,"essential":1,"degree":4},{"sym":"PSMA7","name":"Proteasome alpha 7","role":"proteasome core","module":5,"essential":1,"degree":3},{"sym":"PSMB1","name":"Proteasome beta 1","role":"proteasome core","module":5,"essential":1,"degree":3},{"sym":"PSMB2","name":"Proteasome beta 2","role":"proteasome core","module":5,"essential":1,"degree":3},{"sym":"PSMB3","name":"Proteasome beta 3","role":"proteasome core","module":5,"essential":1,"degree":3},{"sym":"PSMB4","name":"Proteasome beta 4","role":"proteasome core","module":5,"essential":1,"degree":3},{"sym":"PSMB5","name":"Proteasome beta 5","role":"proteasome core","module":5,"essential":1,"degree":3},{"sym":"PSMB6","name":"Proteasome beta 6","role":"proteasome core","module":5,"essential":1,"degree":3},{"sym":"PSMB7","name":"Proteasome beta 7","role":"proteasome core","module":5,"essential":1,"degree":3},{"sym":"PSMC1","name":"Proteasome ATPase 1","role":"proteasome lid motor","module":5,"essential":1,"degree":4},{"sym":"PSMC2","name":"Proteasome ATPase 2","role":"proteasome lid motor","module":5,"essential":1,"degree":4},{"sym":"PSMC3","name":"Proteasome ATPase 3","role":"proteasome lid motor","module":5,"essential":1,"degree":3},{"sym":"PSMC4","name":"Proteasome ATPase 4","role":"proteasome lid motor","module":5,"essential":1,"degree":4},{"sym":"PSMC5","name":"Proteasome ATPase 5","role":"proteasome lid motor","module":5,"essential":1,"degree":3},{"sym":"PSMC6","name":"Proteasome ATPase 6","role":"proteasome lid motor","module":5,"essential":1,"degree":3},{"sym":"PSMD1","name":"Proteasome non-ATPase 1","role":"proteasome regulator","module":5,"essential":1,"degree":2},{"sym":"PSMD2","name":"Proteasome non-ATPase 2","role":"proteasome regulator","module":5,"essential":1,"degree":3},{"sym":"POLR2A","name":"RNA polymerase II A","role":"makes messenger RNA","module":9,"essential":1,"degree":11},{"sym":"POLR2B","name":"RNA polymerase II B","role":"makes messenger RNA","module":9,"essential":1,"degree":5},{"sym":"POLR2C","name":"RNA polymerase II C","role":"RNA polymerase subunit","module":9,"essential":1,"degree":4},{"sym":"POLR2D","name":"RNA polymerase II D","role":"RNA polymerase subunit","module":9,"essential":1,"degree":2},{"sym":"POLR2E","name":"RNA polymerase II E","role":"RNA polymerase subunit","module":9,"essential":1,"degree":2},{"sym":"POLR2F","name":"RNA polymerase II F","role":"RNA polymerase subunit","module":9,"essential":1,"degree":2},{"sym":"POLR2G","name":"RNA polymerase II G","role":"RNA polymerase subunit","module":9,"essential":1,"degree":2},{"sym":"POLR2H","name":"RNA polymerase II H","role":"RNA polymerase subunit","module":9,"essential":1,"degree":3},{"sym":"POLR2I","name":"RNA polymerase II I","role":"RNA polymerase subunit","module":9,"essential":1,"degree":1},{"sym":"POLR2J","name":"RNA polymerase II J","role":"RNA polymerase subunit","module":9,"essential":1,"degree":2},{"sym":"POLR2K","name":"RNA polymerase II K","role":"RNA polymerase subunit","module":9,"essential":1,"degree":2},{"sym":"POLR2L","name":"RNA polymerase II L","role":"RNA polymerase subunit","module":9,"essential":1,"degree":1},{"sym":"TBP","name":"TATA-binding protein","role":"marks where genes start","module":9,"essential":1,"degree":3},{"sym":"GTF2B","name":"Transcription factor IIB","role":"positions RNA polymerase","module":9,"essential":1,"degree":2},{"sym":"TAF1","name":"TFIID subunit 1","role":"promoter recognition","module":9,"essential":0,"degree":1},{"sym":"MED1","name":"Mediator subunit 1","role":"relays signals to RNA polymerase","module":2,"essential":0,"degree":4},{"sym":"MED12","name":"Mediator subunit 12","role":"mediator kinase module","module":2,"essential":0,"degree":3},{"sym":"CDK8","name":"Cyclin-dependent kinase 8","role":"mediator kinase","module":2,"essential":0,"degree":2},{"sym":"CCNC","name":"Cyclin C","role":"partner of CDK8","module":2,"essential":0,"degree":2},{"sym":"EP300","name":"p300 acetyltransferase","role":"switches genes on","module":2,"essential":0,"degree":11},{"sym":"CREBBP","name":"CREB-binding protein","role":"switches genes on","module":2,"essential":0,"degree":7},{"sym":"MYC","name":"MYC proto-oncogene","role":"drives cell growth","module":0,"essential":0,"degree":3},{"sym":"MAX","name":"MYC-associated factor X","role":"partner of MYC","module":0,"essential":0,"degree":1},{"sym":"ELK1","name":"ELK1 transcription factor","role":"responds to growth signals","module":3,"essential":0,"degree":2},{"sym":"NCOA3","name":"Nuclear receptor coactivator 3","role":"helps the oestrogen receptor","module":2,"essential":0,"degree":2},{"sym":"ESR1","name":"Oestrogen receptor alpha","role":"hormone-driven gene switch","module":2,"essential":0,"degree":8},{"sym":"SIRT1","name":"Sirtuin 1","role":"stress-response deacetylase","module":2,"essential":0,"degree":1},{"sym":"HIPK2","name":"HIPK2 kinase","role":"activates p53","module":2,"essential":0,"degree":1},{"sym":"CTCF","name":"CTCF insulator protein","role":"organises the genome","module":1,"essential":0,"degree":2},{"sym":"MCM2","name":"MCM helicase 2","role":"unwinds DNA for copying","module":6,"essential":1,"degree":4},{"sym":"MCM3","name":"MCM helicase 3","role":"unwinds DNA for copying","module":6,"essential":1,"degree":3},{"sym":"MCM4","name":"MCM helicase 4","role":"unwinds DNA for copying","module":6,"essential":1,"degree":2},{"sym":"MCM5","name":"MCM helicase 5","role":"unwinds DNA for copying","module":6,"essential":1,"degree":3},{"sym":"MCM6","name":"MCM helicase 6","role":"unwinds DNA for copying","module":6,"essential":1,"degree":3},{"sym":"MCM7","name":"MCM helicase 7","role":"unwinds DNA for copying","module":6,"essential":1,"degree":3},{"sym":"CDC45","name":"CDC45","role":"replication helicase partner","module":6,"essential":1,"degree":3},{"sym":"GINS1","name":"GINS subunit 1","role":"replication helicase partner","module":6,"essential":1,"degree":4},{"sym":"GINS2","name":"GINS subunit 2","role":"replication helicase partner","module":6,"essential":1,"degree":3},{"sym":"GINS3","name":"GINS subunit 3","role":"replication helicase partner","module":6,"essential":1,"degree":3},{"sym":"GINS4","name":"GINS subunit 4","role":"replication helicase partner","module":6,"essential":1,"degree":4},{"sym":"PCNA","name":"PCNA sliding clamp","role":"holds the DNA copier on","module":0,"essential":1,"degree":9},{"sym":"POLD1","name":"DNA polymerase delta","role":"copies DNA","module":0,"essential":1,"degree":1},{"sym":"RFC1","name":"Replication factor C","role":"loads the PCNA clamp","module":0,"essential":1,"degree":1},{"sym":"ORC1","name":"Origin recognition 1","role":"marks where copying starts","module":6,"essential":0,"degree":3},{"sym":"ORC2","name":"Origin recognition 2","role":"marks where copying starts","module":6,"essential":0,"degree":2},{"sym":"ORC3","name":"Origin recognition 3","role":"marks where copying starts","module":6,"essential":0,"degree":3},{"sym":"ORC4","name":"Origin recognition 4","role":"marks where copying starts","module":6,"essential":0,"degree":2},{"sym":"ORC5","name":"Origin recognition 5","role":"marks where copying starts","module":6,"essential":0,"degree":2},{"sym":"ORC6","name":"Origin recognition 6","role":"marks where copying starts","module":6,"essential":0,"degree":1},{"sym":"CDC6","name":"CDC6","role":"licenses replication origins","module":6,"essential":0,"degree":4},{"sym":"CDT1","name":"CDT1","role":"licenses replication origins","module":6,"essential":0,"degree":4},{"sym":"GMNN","name":"Geminin","role":"prevents re-copying DNA","module":6,"essential":0,"degree":1},{"sym":"FEN1","name":"Flap endonuclease 1","role":"trims DNA flaps","module":0,"essential":0,"degree":1},{"sym":"LIG1","name":"DNA ligase 1","role":"seals DNA","module":0,"essential":0,"degree":1},{"sym":"SMC1A","name":"Cohesin SMC1A","role":"holds sister DNA together","module":1,"essential":1,"degree":5},{"sym":"SMC3","name":"Cohesin SMC3","role":"holds sister DNA together","module":1,"essential":1,"degree":2},{"sym":"RAD21","name":"Cohesin RAD21","role":"holds sister DNA together","module":1,"essential":1,"degree":6},{"sym":"STAG1","name":"Cohesin SA1","role":"cohesin subunit","module":1,"essential":0,"degree":1},{"sym":"STAG2","name":"Cohesin SA2","role":"cohesin subunit","module":1,"essential":0,"degree":3},{"sym":"PDS5A","name":"PDS5A","role":"cohesin regulator","module":1,"essential":0,"degree":2},{"sym":"WAPL","name":"WAPL","role":"releases cohesin","module":1,"essential":0,"degree":1},{"sym":"NIPBL","name":"NIPBL","role":"loads cohesin","module":1,"essential":0,"degree":2},{"sym":"MAU2","name":"MAU2","role":"loads cohesin","module":1,"essential":0,"degree":1},{"sym":"TP53","name":"p53 tumour suppressor","role":"guardian of the genome","module":2,"essential":0,"degree":18},{"sym":"MDM2","name":"MDM2 ubiquitin ligase","role":"keeps p53 in check","module":2,"essential":0,"degree":8},{"sym":"MDM4","name":"MDM4","role":"keeps p53 in check","module":2,"essential":0,"degree":2},{"sym":"USP7","name":"USP7 deubiquitinase","role":"stabilises MDM2 and p53","module":2,"essential":0,"degree":2},{"sym":"TP53BP1","name":"p53-binding protein 1","role":"guides DNA break repair","module":1,"essential":0,"degree":2},{"sym":"TP53BP2","name":"p53-binding protein 2","role":"helps p53 trigger cell death","module":2,"essential":0,"degree":1},{"sym":"BRCA1","name":"BRCA1","role":"repairs broken DNA","module":1,"essential":0,"degree":11},{"sym":"BARD1","name":"BARD1","role":"partner of BRCA1","module":1,"essential":0,"degree":1},{"sym":"BRCA2","name":"BRCA2","role":"loads RAD51 onto DNA","module":1,"essential":0,"degree":3},{"sym":"PALB2","name":"PALB2","role":"links BRCA1 and BRCA2","module":1,"essential":0,"degree":2},{"sym":"RAD51","name":"RAD51 recombinase","role":"repairs DNA by copying","module":1,"essential":0,"degree":2},{"sym":"RBBP8","name":"CtIP","role":"trims broken DNA ends","module":1,"essential":0,"degree":2},{"sym":"BRIP1","name":"BRIP1 helicase","role":"partner of BRCA1","module":1,"essential":0,"degree":1},{"sym":"ATM","name":"ATM kinase","role":"senses DNA breaks","module":1,"essential":0,"degree":7},{"sym":"CHEK2","name":"CHK2 kinase","role":"relays DNA damage alarms","module":1,"essential":0,"degree":4},{"sym":"MRE11","name":"MRE11 nuclease","role":"grabs DNA breaks","module":1,"essential":0,"degree":3},{"sym":"RAD50","name":"RAD50","role":"grabs DNA breaks","module":1,"essential":0,"degree":2},{"sym":"NBN","name":"Nibrin","role":"grabs DNA breaks","module":1,"essential":0,"degree":4},{"sym":"H2AX","name":"Histone H2AX","role":"flags DNA breaks","module":1,"essential":0,"degree":3},{"sym":"MDC1","name":"MDC1","role":"gathers repair proteins","module":1,"essential":0,"degree":3},{"sym":"RNF8","name":"RNF8 ubiquitin ligase","role":"marks DNA breaks","module":1,"essential":0,"degree":2},{"sym":"RNF168","name":"RNF168 ubiquitin ligase","role":"marks DNA breaks","module":1,"essential":0,"degree":1},{"sym":"PARP1","name":"PARP1","role":"spots single-strand DNA breaks","module":0,"essential":0,"degree":2},{"sym":"XRCC1","name":"XRCC1","role":"scaffold for DNA repair","module":0,"essential":0,"degree":4},{"sym":"LIG3","name":"DNA ligase 3","role":"seals repaired DNA","module":0,"essential":0,"degree":1},{"sym":"POLB","name":"DNA polymerase beta","role":"fills DNA gaps","module":0,"essential":0,"degree":1},{"sym":"MLH1","name":"MLH1","role":"fixes copying mistakes","module":0,"essential":0,"degree":2},{"sym":"PMS2","name":"PMS2","role":"fixes copying mistakes","module":0,"essential":0,"degree":1},{"sym":"MSH2","name":"MSH2","role":"spots copying mistakes","module":0,"essential":0,"degree":2},{"sym":"MSH6","name":"MSH6","role":"spots copying mistakes","module":0,"essential":0,"degree":2},{"sym":"FANCD2","name":"FANCD2","role":"repairs DNA cross-links","module":1,"essential":0,"degree":3},{"sym":"FANCI","name":"FANCI","role":"repairs DNA cross-links","module":1,"essential":0,"degree":1},{"sym":"ATR","name":"ATR kinase","role":"senses stalled DNA copying","module":1,"essential":1,"degree":3},{"sym":"CHEK1","name":"CHK1 kinase","role":"pauses the cell cycle","module":1,"essential":1,"degree":4},{"sym":"ATRIP","name":"ATRIP","role":"partner of ATR","module":1,"essential":0,"degree":2},{"sym":"CDK1","name":"CDK1 kinase","role":"starts cell division","module":0,"essential":1,"degree":4},{"sym":"PLK1","name":"Polo-like kinase 1","role":"drives mitosis","module":1,"essential":1,"degree":3},{"sym":"CDC20","name":"CDC20","role":"triggers chromosome separation","module":0,"essential":1,"degree":5},{"sym":"ANAPC1","name":"APC/C subunit 1","role":"cell-cycle ubiquitin ligase","module":0,"essential":1,"degree":2},{"sym":"ANAPC2","name":"APC/C subunit 2","role":"cell-cycle ubiquitin ligase","module":0,"essential":1,"degree":3},{"sym":"ANAPC4","name":"APC/C subunit 4","role":"cell-cycle ubiquitin ligase","module":0,"essential":1,"degree":2},{"sym":"ANAPC11","name":"APC/C subunit 11","role":"cell-cycle ubiquitin ligase","module":0,"essential":1,"degree":1},{"sym":"CDC27","name":"APC/C subunit CDC27","role":"cell-cycle ubiquitin ligase","module":0,"essential":1,"degree":3},{"sym":"WEE1","name":"WEE1 kinase","role":"brakes cell division","module":0,"essential":1,"degree":1},{"sym":"AURKA","name":"Aurora kinase A","role":"builds the spindle","module":1,"essential":1,"degree":1},{"sym":"CCNA2","name":"Cyclin A2","role":"partner of CDK1 and CDK2","module":0,"essential":1,"degree":4},{"sym":"CDK2","name":"CDK2 kinase","role":"starts DNA copying","module":0,"essential":0,"degree":5},{"sym":"CDK4","name":"CDK4 kinase","role":"moves cells past G1","module":2,"essential":0,"degree":6},{"sym":"CDK6","name":"CDK6 kinase","role":"moves cells past G1","module":2,"essential":0,"degree":2},{"sym":"CCNB1","name":"Cyclin B1","role":"partner of CDK1","module":0,"essential":0,"degree":2},{"sym":"CCNE1","name":"Cyclin E1","role":"partner of CDK2","module":0,"essential":0,"degree":4},{"sym":"CCND1","name":"Cyclin D1","role":"partner of CDK4 and CDK6","module":2,"essential":0,"degree":4},{"sym":"CDKN1A","name":"p21","role":"brakes the cell cycle","module":0,"essential":0,"degree":5},{"sym":"CDKN1B","name":"p27","role":"brakes the cell cycle","module":0,"essential":0,"degree":3},{"sym":"CDKN2A","name":"p16 / ARF","role":"brakes the cell cycle","module":2,"essential":0,"degree":3},{"sym":"RB1","name":"Retinoblastoma protein","role":"gatekeeper of cell division","module":2,"essential":0,"degree":5},{"sym":"E2F1","name":"E2F1","role":"switches on S-phase genes","module":2,"essential":0,"degree":2},{"sym":"TFDP1","name":"DP1","role":"partner of E2F1","module":2,"essential":0,"degree":1},{"sym":"CDC25A","name":"CDC25A phosphatase","role":"activates CDKs","module":1,"essential":0,"degree":3},{"sym":"CDC25C","name":"CDC25C phosphatase","role":"activates CDK1","module":1,"essential":0,"degree":3},{"sym":"FZR1","name":"CDH1 (FZR1)","role":"APC/C activator","module":0,"essential":0,"degree":1},{"sym":"MAD2L1","name":"MAD2","role":"spindle checkpoint","module":0,"essential":0,"degree":2},{"sym":"MAD1L1","name":"MAD1","role":"spindle checkpoint","module":0,"essential":0,"degree":1},{"sym":"BUB1B","name":"BUBR1","role":"spindle checkpoint","module":0,"essential":0,"degree":1},{"sym":"CUL1","name":"Cullin 1","role":"ubiquitin ligase scaffold","module":0,"essential":1,"degree":2},{"sym":"SKP1","name":"SKP1","role":"ubiquitin ligase adaptor","module":0,"essential":1,"degree":4},{"sym":"RBX1","name":"RBX1","role":"ubiquitin ligase core","module":0,"essential":1,"degree":1},{"sym":"FBXW7","name":"FBXW7","role":"tags MYC and cyclin E for destruction","module":0,"essential":0,"degree":3},{"sym":"SKP2","name":"SKP2","role":"tags p27 for destruction","module":0,"essential":0,"degree":2},{"sym":"BTRC","name":"beta-TrCP","role":"tags beta-catenin and IkB","module":0,"essential":0,"degree":3},{"sym":"HSP90AA1","name":"HSP90 chaperone","role":"folds signalling proteins","module":2,"essential":0,"degree":7},{"sym":"CDC37","name":"CDC37","role":"HSP90 partner for kinases","module":2,"essential":0,"degree":2},{"sym":"EGFR","name":"EGF receptor","role":"growth-factor receptor","module":3,"essential":0,"degree":6},{"sym":"ERBB2","name":"HER2","role":"growth-factor receptor","module":3,"essential":0,"degree":4},{"sym":"ERBB3","name":"HER3","role":"growth-factor receptor","module":3,"essential":0,"degree":2},{"sym":"INSR","name":"Insulin receptor","role":"senses insulin","module":3,"essential":0,"degree":3},{"sym":"IGF1R","name":"IGF-1 receptor","role":"senses growth factor IGF-1","module":3,"essential":0,"degree":2},{"sym":"HRAS","name":"HRAS","role":"growth signal switch","module":3,"essential":0,"degree":3},{"sym":"KRAS","name":"KRAS","role":"growth signal switch","module":3,"essential":0,"degree":4},{"sym":"NRAS","name":"NRAS","role":"growth signal switch","module":3,"essential":0,"degree":2},{"sym":"CDH1","name":"E-cadherin","role":"glues cells together","module":4,"essential":0,"degree":1},{"sym":"LRP6","name":"LRP6","role":"Wnt co-receptor","module":4,"essential":0,"degree":1},{"sym":"TGFBR1","name":"TGF-beta receptor 1","role":"senses TGF-beta","module":2,"essential":0,"degree":4},{"sym":"TGFBR2","name":"TGF-beta receptor 2","role":"senses TGF-beta","module":2,"essential":0,"degree":2},{"sym":"TNFRSF1A","name":"TNF receptor 1","role":"senses TNF","module":8,"essential":0,"degree":2},{"sym":"LRP1","name":"LRP1","role":"clears lipoproteins and amyloid","module":4,"essential":0,"degree":2},{"sym":"APP","name":"Amyloid precursor protein","role":"source of amyloid-beta","module":4,"essential":0,"degree":5},{"sym":"PSEN1","name":"Presenilin 1","role":"gamma-secretase core","module":4,"essential":0,"degree":6},{"sym":"PSEN2","name":"Presenilin 2","role":"gamma-secretase core","module":4,"essential":0,"degree":2},{"sym":"NCSTN","name":"Nicastrin","role":"gamma-secretase subunit","module":4,"essential":0,"degree":3},{"sym":"APH1A","name":"APH-1A","role":"gamma-secretase subunit","module":4,"essential":0,"degree":3},{"sym":"PSENEN","name":"PEN-2","role":"gamma-secretase subunit","module":4,"essential":0,"degree":1},{"sym":"BACE1","name":"BACE1 (beta-secretase)","role":"cuts APP into amyloid","module":4,"essential":0,"degree":1},{"sym":"GRB2","name":"GRB2 adaptor","role":"links receptors to RAS","module":3,"essential":0,"degree":8},{"sym":"SOS1","name":"SOS1","role":"switches RAS on","module":3,"essential":0,"degree":4},{"sym":"SHC1","name":"SHC1 adaptor","role":"links receptors to GRB2","module":3,"essential":0,"degree":2},{"sym":"RAF1","name":"RAF1 kinase","role":"relays RAS signals","module":3,"essential":0,"degree":5},{"sym":"BRAF","name":"BRAF kinase","role":"relays RAS signals","module":3,"essential":0,"degree":5},{"sym":"MAP2K1","name":"MEK1","role":"relays to ERK","module":3,"essential":0,"degree":4},{"sym":"MAP2K2","name":"MEK2","role":"relays to ERK","module":3,"essential":0,"degree":3},{"sym":"MAPK1","name":"ERK2","role":"growth signal kinase","module":3,"essential":0,"degree":3},{"sym":"MAPK3","name":"ERK1","role":"growth signal kinase","module":3,"essential":0,"degree":3},{"sym":"PIK3CA","name":"PI3K catalytic alpha","role":"makes the PIP3 signal","module":3,"essential":0,"degree":3},{"sym":"PIK3R1","name":"PI3K regulatory p85","role":"docks PI3K on receptors","module":3,"essential":0,"degree":3},{"sym":"PTEN","name":"PTEN phosphatase","role":"erases the PIP3 signal","module":2,"essential":0,"degree":1},{"sym":"AKT1","name":"AKT1 kinase","role":"survival and growth kinase","module":7,"essential":0,"degree":7},{"sym":"PDPK1","name":"PDK1 kinase","role":"activates AKT","module":7,"essential":0,"degree":1},{"sym":"MTOR","name":"mTOR kinase","role":"growth controller","module":7,"essential":0,"degree":6},{"sym":"RPTOR","name":"Raptor","role":"mTORC1 subunit","module":7,"essential":0,"degree":4},{"sym":"RICTOR","name":"Rictor","role":"mTORC2 subunit","module":7,"essential":0,"degree":2},{"sym":"MLST8","name":"mLST8","role":"mTOR subunit","module":7,"essential":0,"degree":3},{"sym":"TSC1","name":"Hamartin (TSC1)","role":"brake on mTOR","module":7,"essential":0,"degree":1},{"sym":"TSC2","name":"Tuberin (TSC2)","role":"brake on mTOR","module":7,"essential":0,"degree":3},{"sym":"RHEB","name":"RHEB","role":"switches mTOR on","module":7,"essential":0,"degree":2},{"sym":"RPS6KB1","name":"S6 kinase 1","role":"boosts protein synthesis","module":7,"essential":0,"degree":2},{"sym":"EIF4EBP1","name":"4E-BP1","role":"holds back protein synthesis","module":7,"essential":0,"degree":2},{"sym":"EIF4E","name":"eIF4E","role":"starts protein synthesis","module":7,"essential":0,"degree":1},{"sym":"IRS1","name":"Insulin receptor substrate 1","role":"relays insulin signals","module":3,"essential":0,"degree":4},{"sym":"SRC","name":"SRC kinase","role":"signalling kinase","module":3,"essential":0,"degree":2},{"sym":"PTPN11","name":"SHP2 phosphatase","role":"boosts RAS signals","module":3,"essential":0,"degree":1},{"sym":"CBL","name":"CBL ubiquitin ligase","role":"switches receptors off","module":3,"essential":0,"degree":2},{"sym":"STAT3","name":"STAT3","role":"signal-driven gene switch","module":3,"essential":0,"degree":3},{"sym":"JAK2","name":"JAK2 kinase","role":"cytokine receptor kinase","module":3,"essential":0,"degree":1},{"sym":"ABL1","name":"ABL1 kinase","role":"signalling kinase, target of imatinib","module":1,"essential":0,"degree":2},{"sym":"GSK3B","name":"GSK3-beta kinase","role":"brake in Wnt and insulin signalling","module":4,"essential":0,"degree":5},{"sym":"CTNNB1","name":"beta-catenin","role":"Wnt signal and cell glue","module":4,"essential":0,"degree":12},{"sym":"APC","name":"APC","role":"destroys beta-catenin","module":4,"essential":0,"degree":2},{"sym":"AXIN1","name":"Axin 1","role":"scaffold that destroys beta-catenin","module":4,"essential":0,"degree":6},{"sym":"CSNK1A1","name":"Casein kinase 1 alpha","role":"primes beta-catenin for destruction","module":4,"essential":0,"degree":2},{"sym":"DVL1","name":"Dishevelled 1","role":"relays Wnt signals","module":4,"essential":0,"degree":1},{"sym":"CTNNA1","name":"alpha-catenin","role":"links cell junctions to actin","module":4,"essential":0,"degree":1},{"sym":"TCF7L2","name":"TCF7L2 (TCF4)","role":"Wnt-driven gene switch","module":4,"essential":0,"degree":1},{"sym":"LEF1","name":"LEF1","role":"Wnt-driven gene switch","module":4,"essential":0,"degree":1},{"sym":"TGFB1","name":"TGF-beta 1","role":"signal that restrains growth","module":2,"essential":0,"degree":1},{"sym":"SMAD2","name":"SMAD2","role":"carries TGF-beta signals","module":2,"essential":0,"degree":3},{"sym":"SMAD3","name":"SMAD3","role":"carries TGF-beta signals","module":2,"essential":0,"degree":5},{"sym":"SMAD4","name":"SMAD4","role":"partner of SMAD2/3","module":2,"essential":0,"degree":2},{"sym":"SMAD7","name":"SMAD7","role":"blocks TGF-beta signalling","module":2,"essential":0,"degree":1},{"sym":"TNF","name":"Tumour necrosis factor","role":"inflammation signal","module":8,"essential":0,"degree":1},{"sym":"APOE","name":"Apolipoprotein E","role":"carries lipids in the brain","module":4,"essential":0,"degree":2},{"sym":"INS","name":"Insulin","role":"hormone that lowers blood sugar","module":3,"essential":0,"degree":1},{"sym":"TRADD","name":"TRADD","role":"TNF receptor adaptor","module":8,"essential":0,"degree":4},{"sym":"TRAF2","name":"TRAF2","role":"TNF receptor adaptor","module":8,"essential":0,"degree":2},{"sym":"RIPK1","name":"RIPK1 kinase","role":"decides survive or die","module":8,"essential":0,"degree":3},{"sym":"CHUK","name":"IKK-alpha","role":"NF-kB activating kinase","module":8,"essential":0,"degree":2},{"sym":"IKBKB","name":"IKK-beta","role":"NF-kB activating kinase","module":8,"essential":0,"degree":3},{"sym":"IKBKG","name":"NEMO","role":"IKK regulator","module":8,"essential":0,"degree":3},{"sym":"NFKBIA","name":"IkB-alpha","role":"holds NF-kB in the cytoplasm","module":2,"essential":0,"degree":4},{"sym":"RELA","name":"NF-kB p65","role":"inflammation gene switch","module":2,"essential":0,"degree":4},{"sym":"NFKB1","name":"NF-kB p50","role":"inflammation gene switch","module":2,"essential":0,"degree":2},{"sym":"FADD","name":"FADD","role":"death-receptor adaptor","module":8,"essential":0,"degree":2},{"sym":"CASP8","name":"Caspase 8","role":"starts cell death","module":8,"essential":0,"degree":3},{"sym":"CASP9","name":"Caspase 9","role":"starts cell death","module":8,"essential":0,"degree":3},{"sym":"CASP3","name":"Caspase 3","role":"executes cell death","module":8,"essential":0,"degree":3},{"sym":"APAF1","name":"APAF1","role":"builds the apoptosome","module":8,"essential":0,"degree":2},{"sym":"CYCS","name":"Cytochrome c","role":"released to trigger cell death","module":8,"essential":0,"degree":1},{"sym":"BCL2","name":"BCL-2","role":"blocks cell death","module":7,"essential":0,"degree":3},{"sym":"BCL2L1","name":"BCL-XL","role":"blocks cell death","module":7,"essential":0,"degree":4},{"sym":"MCL1","name":"MCL-1","role":"blocks cell death","module":7,"essential":0,"degree":2},{"sym":"BAX","name":"BAX","role":"punches holes in mitochondria","module":7,"essential":0,"degree":3},{"sym":"BAK1","name":"BAK","role":"punches holes in mitochondria","module":7,"essential":0,"degree":2},{"sym":"BID","name":"BID","role":"links caspase-8 to mitochondria","module":7,"essential":0,"degree":4},{"sym":"BAD","name":"BAD","role":"sensitises cells to death","module":7,"essential":0,"degree":3},{"sym":"XIAP","name":"XIAP","role":"blocks caspases","module":8,"essential":0,"degree":3},{"sym":"DIABLO","name":"SMAC","role":"releases the caspase brake","module":8,"essential":0,"degree":1},{"sym":"MAPT","name":"Tau","role":"stabilises microtubules in neurons","module":4,"essential":0,"degree":2},{"sym":"CDK5","name":"CDK5 kinase","role":"neuronal kinase","module":4,"essential":0,"degree":2},{"sym":"CDK5R1","name":"p35","role":"activates CDK5","module":4,"essential":0,"degree":1},{"sym":"APBB1","name":"Fe65","role":"binds the tail of APP","module":4,"essential":0,"degree":1}];
const STUB_MODS=[{"name":"Cell cycle & DNA copying","css":"#ff6b38"},{"name":"DNA break repair","css":"#4d94ff"},{"name":"p53 & gene control","css":"#ffd62e"},{"name":"Growth-factor signalling","css":"#40e673"},{"name":"Wnt & amyloid","css":"#cc61ff"},{"name":"Proteasome","css":"#26ebeb"},{"name":"DNA replication start","css":"#ff61ad"},{"name":"AKT-mTOR & survival","css":"#9eff40"},{"name":"TNF & cell death","css":"#ffb385"},{"name":"RNA polymerase II","css":"#ebf0ff"}];
const STUB_EDGES=[[0,1],[0,6],[0,7],[0,14],[1,2],[1,8],[1,15],[2,3],[2,9],[2,16],[2,137],[2,86],[3,4],[3,10],[3,17],[4,5],[4,11],[4,18],[5,6],[5,12],[5,19],[6,13],[7,8],[7,13],[8,9],[9,10],[10,11],[11,12],[12,13],[14,15],[14,18],[14,21],[15,19],[15,21],[16,19],[16,17],[17,18],[17,20],[20,21],[22,23],[22,24],[22,26],[22,27],[22,29],[22,32],[22,25],[22,28],[22,34],[22,35],[22,37],[23,24],[23,30],[23,31],[23,33],[24,31],[24,32],[25,28],[26,29],[27,29],[34,35],[34,36],[37,38],[37,41],[37,47],[38,39],[38,40],[39,40],[41,42],[41,43],[41,47],[41,85],[41,86],[41,91],[41,206],[41,210],[41,220],[41,233],[42,47],[42,46],[42,85],[42,210],[42,220],[42,233],[43,44],[43,152],[45,185],[45,186],[46,47],[47,91],[47,155],[47,203],[47,136],[48,85],[49,85],[50,80],[50,78],[51,55],[51,54],[51,57],[51,71],[52,56],[52,54],[52,58],[53,55],[53,56],[54,57],[55,72],[56,119],[57,61],[58,59],[58,60],[58,61],[59,60],[59,61],[60,61],[62,74],[62,75],[62,63],[62,64],[62,137],[62,114],[62,108],[62,130],[62,72],[65,68],[65,66],[65,71],[66,67],[67,69],[67,70],[68,69],[71,72],[71,130],[72,73],[76,77],[76,78],[76,83],[76,91],[76,98],[77,78],[78,79],[78,80],[78,81],[80,121],[81,82],[83,84],[85,86],[85,87],[85,88],[85,91],[85,98],[85,99],[85,118],[85,89],[85,90],[85,155],[85,107],[85,242],[85,189],[85,140],[86,87],[86,88],[86,139],[86,140],[86,190],[89,103],[91,92],[91,94],[91,95],[91,96],[91,97],[91,98],[91,99],[93,94],[93,95],[93,115],[96,100],[98,99],[98,102],[98,103],[98,208],[99,143],[100,101],[100,102],[101,102],[102,104],[103,104],[104,105],[105,106],[107,108],[108,109],[108,110],[111,112],[111,113],[113,114],[115,116],[115,117],[117,118],[117,119],[118,143],[118,144],[120,134],[120,130],[120,144],[120,128],[121,144],[121,129],[122,127],[122,124],[122,134],[122,146],[122,148],[123,124],[123,125],[124,126],[125,127],[127,145],[130,131],[131,135],[131,137],[131,138],[131,143],[132,136],[132,139],[132,140],[132,137],[132,156],[132,155],[133,136],[133,139],[135,137],[135,138],[135,152],[136,140],[138,153],[140,141],[141,142],[146,147],[149,150],[149,151],[150,152],[150,153],[150,154],[154,210],[154,232],[155,156],[155,190],[155,158],[155,181],[157,178],[157,180],[157,158],[157,203],[157,205],[157,206],[158,159],[158,178],[159,188],[160,202],[160,161],[160,225],[161,202],[162,179],[162,181],[162,187],[163,179],[163,181],[163,182],[163,187],[164,179],[164,182],[165,210],[166,212],[167,168],[167,219],[167,220],[167,222],[168,218],[169,223],[169,226],[170,171],[170,224],[171,172],[171,177],[171,224],[171,253],[172,210],[172,209],[172,174],[172,175],[172,176],[173,174],[173,175],[174,175],[178,180],[178,179],[178,202],[178,204],[178,205],[178,208],[181,182],[181,183],[182,183],[182,184],[183,185],[183,186],[184,185],[184,186],[187,188],[188,202],[190,191],[190,197],[190,192],[190,209],[190,247],[192,198],[192,193],[192,194],[192,195],[192,199],[193,195],[193,199],[193,200],[194,195],[196,197],[197,198],[200,201],[206,207],[209,212],[209,210],[209,250],[210,211],[210,212],[210,213],[210,216],[210,217],[210,215],[211,212],[212,213],[212,214],[219,221],[219,220],[220,221],[226,227],[226,228],[226,235],[227,228],[228,231],[229,231],[229,230],[230,231],[230,232],[232,233],[232,234],[233,234],[235,236],[236,246],[236,238],[237,238],[237,239],[237,248],[238,248],[239,240],[241,244],[241,247],[241,246],[242,244],[242,245],[242,247],[243,245],[243,246],[244,246],[248,249],[250,251],[251,252]];
// placeholder sets with the spec's params, for testing the engine
(function () {
  const P = {
    int: 'int_reveal:1 int_edges:1 int_dim:0 int_path0 int_path1 int_path2 int_path3 int_path4 int_path5 int_path6 int_path7 int_path8 int_path9 int_atp int_flat int_build int_hub int_hood int_pins int_route int_dis int_rare int_iei int_drugs int_heat int_cand',
    mac: 'mac_explode mac_wire mac_net', web: 'web_net web_globe web_ties web_spin', dna: 'dna_helix dna_chrom dna_fold dna_field',
    atp: 'atp_parts atp_colour atp_build atp_turns atp_flow atp_net atp_shrink', crowd: 'crowd_red crowd_grow',
    sankey: 'sankey_left sankey_right sankey_flow sankey_hi', scale: 'scale_len scale_time scale_net scale_med scale_rg scale_syn scale_team',
    body: 'body_pet body_net body_state', tissue: 'tissue_graph tissue_mark tissue_embed',
  };
  const COL = { int: 0x46d9ff, mac: 0xd8cfb8, web: 0xffb43b, dna: 0x65cbf3, atp: 0x14a3a3, crowd: 0x95a6bd, sankey: 0xff5ad9, scale: 0x1d5bbf, body: 0xff6a2a, tissue: 0xd77fb0 };
  for (const key of Object.keys(P)) {
    SETS[key] = function (K) {
      const { THREE } = K, set = K.newSet(key), r = K.rng(key.length * 7), n = 3000, g = K.pointsGeo(n), c = K.rgb('#' + COL[key].toString(16).padStart(6, '0'));
      for (let i = 0; i < n; i++) { g.attributes.position.array.set(K.v3.mul(K.unit(r), Math.cbrt(r())), 3 * i); g.attributes.aCol.array.set(c, 3 * i); g.attributes.aSize.array[i] = 0.025; }
      const pts = new THREE.Points(g, K.points(set)); set.group.add(pts);
      const params = { [key + '_a']: 1 };
      for (const p of P[key].split(' ')) { const [k, v] = p.split(':'); params[k] = v ? +v : 0; }
      const anyPoint = new Proxy({}, { get: (o, k) => (k === 'protein' ? () => [0.2, 0.1, 0] : [0.3, 0.2, 0]) });
      const cams = new Proxy({ default: [0, 12, 3.6, 0, 0, 0] }, { get: (o, k) => o[k] || (k === 'field' ? [0, 10, 14, 0, 0, 0] : [30, 20, 2.6, 0, 0, 0]) });
      const out = Object.assign(set, {
        params, anchors: anyPoint, cam: cams,
        labels: [{ text: [key, 'stub'], at: [0, 1, 0], cls: 'cyn', alpha: () => 1 }],
        controls: [{ key: 'view', label: 'Show', options: [['a', 'Look A'], ['b', 'Look B']] }],
        explore: c => ({}),
        update(S, t) { pts.rotation.y = t * 0.2; const k = Object.keys(params)[1]; pts.scale.setScalar(1 + 0.3 * (S[k] || 0)); },
      });
      if (key === 'int') Object.assign(out, {
        core: STUB_CORE, modules: STUB_MODS, nodeCount: 8000, edgeCount: 22000, coreCount: STUB_CORE.length,
        select() {}, route: (a, b) => (a < 0 ? null : [STUB_CORE[a], 5, STUB_CORE[b]]), pick: () => -1,
        partners: i => STUB_EDGES.filter(e => e[0] === i || e[1] === i).map(e => (e[0] === i ? e[1] : e[0])),
      });
      if (key === 'sankey') Object.assign(out, { left: new Array(9), right: new Array(19), total: 173 });
      return out;
    };
  }
})();

// ================================================================= SCENE ==
const GL = {};
// the sets, in the order they appear in the story
const SET_ORDER = ['int', 'mac', 'web', 'dna', 'atp', 'crowd', 'sankey', 'scale', 'body', 'tissue'];
function buildScene(canvas) {
  const renderer = HOST.makeRenderer({ canvas, antialias: true, alpha: true, powerPreference: 'high-performance' });
  renderer.xr.enabled = true;
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(32, 1, 0.01, 400);
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
  scene.add(GL.stars);
  // the sets themselves, all hidden until the story fades them in
  GL.sets = {};
  for (const k of SET_ORDER) {
    const s = SETS[k](K);
    GL.sets[k] = s;
    GL.world.add(s.group);
    s.setAlpha(0);
  }
}
// show each set as far as S fades it in, and let the visible ones update
function updateSets(S, t, dt) {
  for (const k of SET_ORDER) {
    const s = GL.sets[k], a = S[k + '_a'] || 0;
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

// ================================================================== STORY ==
// Narration timing: [time in your recording, original story cue]. The story's
// animation is stretched or squeezed between these points so each cue lands
// on the matching sentence. Edit here if you record a narration.
const NARRATION_SYNC = [
  [0, 0], [468, 468],
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
  { key: 'title', name: 'Intro', a: 0, b: 22 },
  { key: 'whole', name: 'Parts', a: 22, b: 54 },
  { key: 'everywhere', name: 'Networks', a: 54, b: 78 },
  { key: 'blocks', name: 'Life', a: 78, b: 114 },
  { key: 'complex', name: 'Complexes', a: 114, b: 162 },
  { key: 'map', name: 'Map', a: 162, b: 222 },
  { key: 'rare', name: 'Disease', a: 222, b: 248 },
  { key: 'iei', name: 'Immunity', a: 248, b: 290 },
  { key: 'treat', name: 'Treatment', a: 290, b: 322 },
  { key: 'scales', name: 'Scales', a: 322, b: 356 },
  { key: 'lbi', name: 'Institute', a: 356, b: 384 },
  { key: 'body', name: 'Body', a: 384, b: 410 },
  { key: 'tissue', name: 'Tissue', a: 410, b: 440 },
  { key: 'mission', name: 'Mission', a: 440, b: 468 },
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
  const I = GL.sets.int, SK = GL.sets.sankey;
  // clinical categories, molecular clusters, disease genes
  const SANKEY_N = [SK.left ? SK.left.length : 9, SK.right ? SK.right.length : 19, SK.total || 173];
  // fade a set in over [t0, t1] and out over [t2, t3]
  const show = (k, t0, t1, t2, t3) => { ramp(k + '_a', t0, t1, 0, 1); if (t2 !== undefined) ramp(k + '_a', t2, t3, 1, 0); };
  // ------------------------------------------------------------ panel copy
  const html = {
    title: `<svg class="route-mark" viewBox="0 0 360 44" aria-hidden="true"><path id="titleArc" d="M8 36 Q180 -16 352 36" fill="none" stroke="var(--amber)" stroke-width="2.2" stroke-linecap="round" pathLength="1" stroke-dasharray="1" stroke-dashoffset="1"/><circle cx="8" cy="36" r="4.5" fill="var(--amber)"/><circle cx="352" cy="36" r="4.5" fill="var(--amber)" id="titleDot" opacity="0"/></svg>
      <h1 data-at="1.2">A glimpse into the future</h1>
      <p class="lede" data-at="2.4">of network medicine</p>
      <p data-at="3.6">Welcome to the Ludwig Boltzmann Institute for Network Medicine in Vienna: a tour from the parts of a protein machine to the whole body.</p>
      <p data-at="8">Each dot is a human protein, each line a physical interaction between two of them: ${fmt(I.nodeCount)} proteins and ${fmt(I.edgeCount)} interactions in this illustrative map.</p>
      <p class="note" data-at="13">The lights are groups of proteins that work together: the proteasome, growth-factor signalling, cell death and DNA repair.</p>`,
    whole: `<h2 data-at="0.6">More than the sum of its parts</h2>
      <p data-at="1.2">A computer is built from a few hundred parts: chips full of transistors, resistors, screws.</p>
      <div style="display:grid">
        <p data-at="7" data-out="15.5" style="grid-area:1/1">Take it apart and lay out every piece, and you have the complete parts list. It still does not tell you how the computer works.</p>
        <p data-at="16" class="amber" style="grid-area:1/1">What makes it work is how the parts are wired together.</p>
      </div>
      <p data-at="25">Parts joined by wires: a network. Life is built the same way.</p>
      <p class="credits" data-at="27">After Todd McLellan, Things Come Apart (2013), and the Apple I circuit diagram by Steve Wozniak and Steve Jobs (1976).</p>`,
    everywhere: `<h2 data-at="0.6">Networks are everywhere</h2>
      <p data-at="1.2">Once you look for the wiring, you find it everywhere. The internet is a network of computers and cables, held together by a few giant hubs.</p>
      <p data-at="11">Friendships form a network too. Each light is a city; most ties join nearby cities, a few cross oceans.</p>
      <p class="note" data-at="17">The first story in this app follows the world's airline network.</p>
      <p class="credits" data-at="19">Friendship map after Paul Butler, Facebook (December 2010). City positions from the airports story; ties illustrative.</p>`,
    blocks: `<h2 data-at="0.6">The building blocks of life</h2>
      <p data-at="1.2">In 2001 the human genome was read for the first time. Our DNA holds</p>
      <div class="facts"><div data-at="3"><b>23</b><small>chromosomes</small></div><div data-at="5.5"><b>3 billion</b><small>letters (base pairs)</small></div><div data-at="9"><b>20,000</b><small>genes</small></div></div>
      <p data-at="16">Each gene is the recipe for a protein. In 2021 AlphaFold predicted the shape of nearly every human protein.</p>
      <p data-at="26">Here are 25 of them. There are about 20,000 kinds, each with its own shape and job.</p>
      <p class="credits" data-at="30">International Human Genome Sequencing Consortium, Nature (2001); Jumper et al., Nature (2021). Shapes in the AlphaFold style, coloured by confidence; illustrative.</p>`,
    complex: `<h2 data-at="0.6">Putting the pieces together</h2>
      <p data-at="1.2">Proteins rarely work alone. These 13 build ATP synthase, the machine that makes most of the cell's energy currency, ATP.</p>
      <div style="display:grid">
        <p data-at="9" data-out="17.5" style="grid-area:1/1">Assembled, they form a rotary motor in the inner membrane of mitochondria. Two helpers, ATPAF1 and ATPAF2, hold the head together while it is built, then leave.</p>
        <p data-at="18" data-out="29.5" style="grid-area:1/1">In action: protons flowing through the membrane turn the rotor. Each turn takes 8 protons and makes 3 ATP.</p>
        <p data-at="30" style="grid-area:1/1">As a network, each protein is a node and each contact a link.</p>
      </div>
      <p data-at="38" class="amber">The whole machine is one small neighbourhood in the map of all human protein interactions: the interactome.</p>
      <p class="credits" data-at="40">The complex in action after the animation by Drew Berry and Franck Tétaz (WEHI). Structure illustrative.</p>`,
    map: `<h2 data-at="0.6">The interactome as a map</h2>
      <p data-at="1.2">Read it like the map of a city.</p>
      <ul class="steps">
        <li data-at="4"><b>Shape</b>A city's layout shapes its life; the network's shape was set by evolution.</li>
        <li data-at="14"><b>Location</b>Central proteins matter most, like the centre of town.</li>
        <li data-at="28"><b>Neighbourhoods</b>Proteins that work together sit together.</li>
        <li data-at="42"><b>Distance</b>Close in the network means related.</li>
      </ul>
      <div style="display:grid">
        <p class="note" data-at="15" data-out="27.5" style="grid-area:1/1">In yeast, proteins with many partners are about three times as likely to be essential for life as those with few.</p>
        <p class="note" data-at="29" data-out="41.5" style="grid-area:1/1">Map which genes depend on which, and the cell's jobs fall into districts.</p>
        <p class="note" data-at="47" style="grid-area:1/1">Diseases whose modules overlap, like multiple sclerosis and rheumatoid arthritis, tend to share symptoms and to occur together. Peroxisomal disorders lie far away.</p>
      </div>
      <p class="credits" data-at="52">Köberlin et al., Cell (2015); Jeong et al., Nature (2001); Costanzo et al., Science (2018); Menche et al., Science (2015). Disease modules illustrative.</p>`,
    rare: `<h2 data-at="0.6">Understand, diagnose, treat</h2>
      <p data-at="1.2">More than 6,000 rare diseases have a known genetic cause. Each is rare; together they affect millions.</p>
      <p data-at="6">For every patient the same questions: which gene is broken? What does that do to the cell? How can we treat it?</p>
      <p data-at="14" class="amber">A broken gene sits in a neighbourhood of the interactome. Drugs act on neighbourhoods too: where the two overlap, a drug may help.</p>`,
    iei: `<h2 data-at="0.6">Inborn errors of immunity</h2>
      <div class="facts"><div data-at="1.2"><b>430</b><small>rare diseases</small></div><div data-at="2.4"><b>80%</b><small>of genetic origin</small></div><div data-at="3.6"><b>1 in 1,000</b><small>to 1 in 5,000 people</small></div></div>
      <p data-at="6">Diagnosis is often missing or late, the diseases are poorly understood, and 95% of patients get treatment that is not specific to their disease.</p>
      <div style="display:grid">
        <p data-at="12" data-out="20" style="grid-area:1/1">On the interactome, the disease genes fall into clusters. Each cluster is a shared mechanism: an endotype.</p>
        <p data-at="21" style="grid-area:1/1">The ${SANKEY_N[0]} clinical categories doctors use cut across the ${SANKEY_N[1]} molecular clusters. Endotypes define diseases by their mechanism.</p>
      </div>
      <p class="credits" data-at="34">Guthrie et al., Science Advances (2023): ${SANKEY_N[2]} disease genes; flows between categories illustrative. Zhang et al. 2017; Picard et al. 2017; Bousfiha et al. 2018.</p>`,
    treat: `<h2 data-at="0.6">Better treatments, faster diagnoses</h2>
      <p data-at="1.2">Drugs already used for a cluster sit closer to it in the network than other drugs. That points to old drugs worth repurposing, and to new targeted ones.</p>
      <p data-at="12">Diagnosis: a patient's genome holds many rare variants. Let a signal spread through the network from genes that match the patient's symptoms, and it ranks the candidate genes.</p>
      <p data-at="24" class="amber">The broken gene comes out on top. On real patients, this informed network propagation ranked the right gene better than any single clue.</p>
      <p class="credits" data-at="28">Guthrie et al., Science Advances (2023); Buphamalai et al., Nature Communications (2021).</p>`,
    scales: `<h2 data-at="0.6">Networks across scales</h2>
      <p data-at="1.2">From a billionth of a metre to a whole body, from a millionth of a second to a lifetime, life is built from networks.</p>
      <p data-at="15">Proteins bind proteins, cells signal to cells, organs talk to organs, and diseases spread from person to person.</p>
      <p data-at="24" class="amber">Medicine reaches into all of them: diagnosis, treatment, nutrition and lifestyle.</p>
      <p class="credits" data-at="30">After Sin and Menche (2021).</p>`,
    lbi: `<h2 data-at="0.6">Network medicine at the LBI-NetMed</h2>
      <ul class="steps">
        <li data-at="2"><b>RG1</b>The geometry of molecular networks in health and disease: the mathematics of how perturbations mix and evolve over time.</li>
        <li data-at="4"><b>RG2</b>Intra- and inter-cellular networks: the human network architecture across scales.</li>
        <li data-at="6"><b>RG3</b>Disease patterns and treatment outcomes across the population, from health registry data.</li>
        <li data-at="8"><b>RG4</b>DataDiVR: the future of data exploration, with virtual reality, machine learning and AI.</li>
      </ul>
      <p data-at="15">Led by Julia Guthrie, André Rendeiro and Jörg Menche, the groups work together across every scale.</p>`,
    body: `<h2 data-at="0.6">Whole-body networks</h2>
      <p data-at="1.2">A total-body PET scan follows a tracer sugar through every organ at once. The brain and the heart take up the most.</p>
      <p data-at="10">Organs that rise and fall together form a network of organs.</p>
      <p data-at="17" class="amber">Disease rewires it.</p>
      <p class="credits" data-at="21">Reed et al., NeuroImage (2023); Geist et al., Med (2025). Organ network illustrative.</p>`,
    tissue: `<h2 data-at="0.6">From tissue to cells</h2>
      <p data-at="1.2">A slice of stomach wall, stained pink and purple: glands at the surface, loose tissue with blood vessels, muscle below.</p>
      <p data-at="9">Zoom in and it is made of cells. Join each cell to its neighbours, and the tissue becomes a network.</p>
      <p data-at="18">Imaging dozens of proteins at once tells the cell types apart, and every sample becomes a point we can compare with the others.</p>
      <p class="credits" data-at="24">Rendeiro et al., Nature (2021); Abila et al., Nature Medicine (2026).</p>`,
    mission: `<h2 data-at="0.6">Our mission</h2>
      <p data-at="1.2">We are more than 40 researchers from many disciplines at the Ludwig Boltzmann Institute for Network Medicine. We want to</p>
      <ul class="steps">
        <li data-at="3"><b>Understand</b>gain fundamental insights into the network architecture of health and disease</li>
        <li data-at="5"><b>Help patients</b>turn these insights into concrete patient benefit</li>
        <li data-at="7"><b>Build in Vienna</b>make Vienna an international centre of excellence for network medicine</li>
        <li data-at="9"><b>Look ahead</b>invent the future of medicine</li>
      </ul>
      <p data-at="15"><button class="btn primary" id="btnGoExplore" type="button">Explore the scenes</button></p>
      <p class="credits" data-at="17">Thank you! netmed.lbg.ac.at · menchelab.com</p>`,
  };
  const story = $('#story');
  story.innerHTML = CH.map(c => `<section class="ch" data-ch="${c.key}">${html[c.key]}</section>`).join('');
  CH.forEach(c => {
    const sec = story.querySelector(`[data-ch="${c.key}"]`);
    ST.items.push({ sec, ch: c, els: Array.from(sec.querySelectorAll('[data-at]')).map(el => ({
      el, at: c.a + parseFloat(el.dataset.at), out: el.dataset.out ? c.a + parseFloat(el.dataset.out) : c.b - 0.05, o: -1 })),
      grow: [] });
  });

  // ------------------------------------------------------------ timeline keys
  const wp = [];
  // a camera waypoint at time t: a set's named view, turned by spin degrees, optionally nudged
  const cam = (t, k, name, spin, ease, nudge) => {
    const v = view(k, name);
    v[0] += spin || 0;
    if (nudge) for (let i = 0; i < nudge.length; i++) v[i] += nudge[i] || 0;
    wp.push([t, ...v, ease]);
  };
  let a, b;
  // Intro: the interactome grows, pathways light up one after another
  a = C.title.a; b = C.title.b;
  show('int', 0.2, 2.5, b - 1.5, b + 0.5);
  ramp('int_reveal', 0.5, 7, 0, 1);
  [[5, 7], [3, 10], [8, 13], [1, 16]].forEach(([m, t]) => ramp('int_path' + m, t, t + 1.5, 0, 1));
  [5, 3, 8, 1].forEach(m => ramp('int_path' + m, b - 1, b + 0.5, 1, 0));
  cam(a, 'int', 'default', -20, null, [0, 0, 0.5]);
  cam(b, 'int', 'default', 110, 'spin');
  // Parts: the computer comes apart, its circuit is wired, a network remains
  a = C.whole.a; b = C.whole.b;
  show('mac', a - 0.5, a + 2, b - 1.5, b + 0.5);
  ramp('mac_explode', a + 7, a + 12.5, 0, 1);
  ramp('mac_wire', a + 16, a + 23, 0, 1);
  ramp('mac_net', a + 25, a + 29.5, 0, 1);
  cam(a + 0.5, 'mac', 'default', -25);
  cam(a + 7, 'mac', 'default', 5, 'spin');
  cam(a + 13, 'mac', 'table', -10);
  cam(a + 24, 'mac', 'table', 10, 'spin');
  cam(b, 'mac', 'table', 30, 'spin', [0, -15, 0.4]);
  // Networks are everywhere: the internet, then friendships around the world
  a = C.everywhere.a; b = C.everywhere.b;
  show('web', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('web_net', a + 0.5, a + 8, 0, 1); ramp('web_net', a + 9.5, a + 12, 1, 0);
  ramp('web_globe', a + 10, a + 12.5, 0, 1); ramp('web_ties', a + 12, a + 20, 0, 1);
  ramp('web_spin', a + 10, b + 1, 0, 0.12);
  cam(a, 'web', 'net', -30);
  cam(a + 10, 'web', 'net', 30, 'spin');
  cam(a + 12.5, 'web', 'globe', -10);
  cam(b, 'web', 'globe', 10, 'spin');
  // Building blocks: DNA, chromosomes, protein shapes, all the proteins
  a = C.blocks.a; b = C.blocks.b;
  show('dna', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('dna_helix', a, a + 3, 0, 1);
  ramp('dna_chrom', a + 8, a + 13, 0, 1);
  ramp('dna_fold', a + 16, a + 21, 0, 1);
  ramp('dna_field', a + 25, a + 32, 0, 1);
  cam(a, 'dna', 'helix', -15);
  cam(a + 8, 'dna', 'helix', 15, 'spin');
  cam(a + 13, 'dna', 'chrom');
  cam(a + 16, 'dna', 'chrom', 8, 'spin');
  cam(a + 21, 'dna', 'fold');
  cam(a + 25, 'dna', 'fold', 10, 'spin');
  cam(a + 32, 'dna', 'field');
  cam(b, 'dna', 'field', 15, 'spin');
  // Complexes: the parts of ATP synthase, assembled, running, as a network, inside the interactome
  a = C.complex.a; b = C.complex.b;
  show('atp', a - 0.5, a + 1.5, a + 39, a + 41.5);
  ramp('atp_parts', a, a + 2, 0, 1);
  ramp('atp_colour', a + 5, a + 7, 0, 1);
  ramp('atp_build', a + 9, a + 16.5, 0, 1);
  ramp('atp_flow', a + 18, a + 20, 0, 1); ramp('atp_flow', a + 29, a + 31, 1, 0);
  key('atp_turns', a + 18, 0); key('atp_turns', a + 30, 4.5);
  ramp('atp_net', a + 30, a + 33, 0, 1);
  ramp('atp_shrink', a + 37.5, a + 41, 0, 1);
  show('int', a + 38, a + 41);
  key('int_atp', a + 36.9, 0); key('int_atp', a + 37, 1);
  cam(a, 'atp', 'parts');
  cam(a + 7, 'atp', 'parts', 10, 'spin');
  cam(a + 16.5, 'atp', 'complex', -20);
  cam(a + 30, 'atp', 'complex', 40, 'spin');
  cam(a + 36, 'atp', 'complex', 60, 'spin');
  cam(a + 40, 'int', 'atp');
  cam(b, 'int', 'default', 40);
  // The interactome as a map: the network becomes a city
  a = C.map.a; b = C.map.b;
  ramp('int_atp', a, a + 2, 1, 0);
  ramp('int_flat', a + 2, a + 8, 0, 1); ramp('int_build', a + 6, a + 10.5, 0, 1);
  ramp('int_hub', a + 14, a + 16, 0, 1); ramp('int_hub', a + 26.5, a + 28.5, 1, 0);
  ramp('int_pins', a + 16, a + 18, 0, 1);
  ramp('int_hood', a + 28, a + 31, 0, 1); ramp('int_hood', a + 40.5, a + 42.5, 1, 0);
  ramp('int_route', a + 42, a + 47, 0, 1);
  ramp('int_dis', a + 46.5, a + 50, 0, 1);
  ramp('int_a', b - 1.5, b + 0.5, 1, 0);
  cam(a + 1, 'int', 'default', 50);
  cam(a + 9, 'int', 'city');
  cam(a + 27, 'int', 'city', 40, 'spin');
  cam(a + 41, 'int', 'city', 70, 'spin');
  cam(b, 'int', 'city', 100, 'spin');
  // reset the map while the interactome is hidden
  for (const n of ['int_flat', 'int_build', 'int_pins', 'int_route', 'int_dis']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  // Rare diseases: one patient among many, a disease neighbourhood and a drug's
  a = C.rare.a; b = C.rare.b;
  show('crowd', a - 0.5, a + 1.5, a + 11, a + 13);
  ramp('crowd_red', a + 3, a + 5, 0, 1);
  ramp('crowd_grow', a + 5, a + 10, 0, 1);
  ramp('int_a', a + 11.5, a + 13.5, 0, 1);
  ramp('int_rare', a + 13, a + 17, 0, 1);
  cam(a, 'crowd', 'default');
  cam(a + 5, 'crowd', 'close');
  cam(a + 11, 'crowd', 'default', 0, null, [0, 8, 1.5]);
  cam(a + 13.5, 'int', 'rare', -20);
  cam(b, 'int', 'rare', 25, 'spin');
  // Inborn errors of immunity: clusters on the interactome, then clinic versus mechanism
  a = C.iei.a; b = C.iei.b;
  ramp('int_rare', a, a + 2, 1, 0);
  ramp('int_iei', a + 1, a + 5, 0, 1);
  ramp('int_a', a + 19.5, a + 21.5, 1, 0);
  show('sankey', a + 20.5, a + 22.5, b - 1.5, b + 0.5);
  ramp('sankey_left', a + 21, a + 24, 0, 1);
  ramp('sankey_right', a + 24, a + 27, 0, 1);
  ramp('sankey_flow', a + 26, a + 33, 0, 1);
  key('sankey_hi', a + 34, 0); key('sankey_hi', a + 34.01, 9); key('sankey_hi', a + 37, 9); key('sankey_hi', a + 37.01, 1);
  key('sankey_hi', b - 1.5, 1); key('sankey_hi', b - 1.49, 0);
  cam(a + 1, 'int', 'iei', -15);
  cam(a + 20, 'int', 'iei', 25, 'spin');
  cam(a + 21.5, 'sankey', 'default', -12);
  cam(b, 'sankey', 'default', 12, 'spin');
  // Treatments and diagnosis: drugs dock on clusters, a signal spreads from the patient's genes
  a = C.treat.a; b = C.treat.b;
  ramp('int_a', a - 1, a + 1, 0, 1);
  ramp('int_drugs', a + 2, a + 10, 0, 1); ramp('int_drugs', a + 11, a + 13, 1, 0);
  ramp('int_iei', a + 12, a + 14, 1, 0);
  ramp('int_heat', a + 13, a + 22, 0, 1);
  ramp('int_cand', a + 20, a + 24, 0, 1);
  ramp('int_a', b - 1.5, b + 0.5, 1, 0);
  for (const n of ['int_heat', 'int_cand']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  cam(a, 'int', 'iei', 25);
  cam(a + 11, 'int', 'iei', 45, 'spin');
  cam(a + 14, 'int', 'heat', -15);
  cam(b, 'int', 'heat', 20, 'spin');
  // Scales: the tower of length scales, time, networks, medicine
  a = C.scales.a; b = C.scales.b;
  show('scale', a - 0.5, a + 1.5);
  ramp('scale_len', a, a + 9, 0, 1);
  ramp('scale_time', a + 9, a + 15, 0, 1);
  ramp('scale_net', a + 15, a + 22, 0, 1);
  ramp('scale_med', a + 24, a + 29, 0, 1);
  cam(a, 'scale', 'low', -20);
  cam(a + 9, 'scale', 'high', 10);
  cam(a + 15, 'scale', 'tower', 20);
  cam(b, 'scale', 'tower', 50, 'spin');
  // The institute: four research groups across the scales, and the links between them
  a = C.lbi.a; b = C.lbi.b;
  ramp('scale_time', a, a + 2, 1, 0); ramp('scale_med', a, a + 2, 1, 0); ramp('scale_net', a, a + 2, 1, 0);
  ramp('scale_rg', a + 2, a + 10, 0, 1);
  ramp('scale_syn', a + 13, a + 21, 0, 1);
  ramp('scale_a', b - 1.5, b + 0.5, 1, 0);
  for (const n of ['scale_len', 'scale_rg', 'scale_syn']) ramp(n, b + 0.6, b + 1.2, 1, 0);
  cam(a + 1, 'scale', 'tower', 60);
  cam(b, 'scale', 'tower', 110, 'spin');
  // The whole body: a PET scan and the network of organs
  a = C.body.a; b = C.body.b;
  show('body', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('body_pet', a, a + 4, 0, 1);
  ramp('body_net', a + 10, a + 13, 0, 1);
  ramp('body_state', a + 17, a + 20, 0, 1);
  cam(a, 'body', 'front', -25);
  cam(a + 10, 'body', 'front', 25, 'spin');
  cam(a + 12, 'body', 'net', -10);
  cam(b, 'body', 'net', 20, 'spin');
  // Tissue: a stained section, cells, a network of neighbours, many markers, an embedding
  a = C.tissue.a; b = C.tissue.b;
  show('tissue', a - 0.5, a + 1.5, b - 1.5, b + 0.5);
  ramp('tissue_graph', a + 11, a + 16, 0, 1);
  ramp('tissue_mark', a + 18, a + 21, 0, 1);
  ramp('tissue_embed', a + 23, a + 28, 0, 1);
  cam(a, 'tissue', 'section', -10);
  cam(a + 5, 'tissue', 'section', 10, 'spin');
  cam(a + 10, 'tissue', 'zoom');
  cam(a + 21, 'tissue', 'zoom', 15, 'spin');
  cam(a + 25, 'tissue', 'embed', -10);
  cam(b, 'tissue', 'embed', 25, 'spin');
  // Mission: the team, then the interactome with every pathway alight
  a = C.mission.a; b = C.mission.b;
  ramp('scale_team', a - 0.5, a + 3, 0, 1);
  show('scale', a - 0.5, a + 1.5, a + 12, a + 14);
  show('int', a + 12.5, a + 14.5);
  for (let m = 0; m < 10; m++) ramp('int_path' + m, a + 14 + 0.6 * m, a + 15.5 + 0.6 * m, 0, 1);
  cam(a, 'scale', 'team', -20);
  cam(a + 12.5, 'scale', 'team', 30, 'spin');
  cam(a + 14.5, 'int', 'default', 0, null, [0, 0, 0.6]);
  cam(b, 'int', 'default', 120, 'spin');
  for (const n in TR) TR[n].sort((x, y) => x[0] - y[0]);
  buildCamera(wp);

  // --------------------------------------------------------- story labels
  label('mac', 'chips', '<b>Chips</b>transistors inside', C.whole.a + 13, C.whole.a + 24, 'cyn');
  label('web', 'hub', '<b>A hub</b>of the internet', C.everywhere.a + 4, C.everywhere.a + 9.5, 'amb');
  label('dna', 'fold0', '<b>SRP9</b>', C.blocks.a + 21, C.blocks.a + 26, 'cyn');
  label('dna', 'fold1', '<b>LENEP</b>', C.blocks.a + 21.5, C.blocks.a + 26, 'cyn');
  label('dna', 'fold2', '<b>GNG5</b>', C.blocks.a + 22, C.blocks.a + 26, 'cyn');
  label('int', 'atp', '<b>ATP synthase</b>in the interactome', C.complex.a + 41, C.complex.b - 0.5, 'cyn');
  label('int', 'pinRed', '<b>A hub</b>in the centre', C.map.a + 18, C.map.a + 27, 'mag');
  label('int', 'pinBlue', '<b>A protein</b>on the edge', C.map.a + 18.5, C.map.a + 27, 'cyn');
  label('crowd', 'red', '<b>One patient</b>', C.rare.a + 4, C.rare.a + 11, 'mag');
  label('int', 'rare', '<b>Disease gene</b>and its neighbours', C.rare.a + 16, C.rare.b - 0.5, 'mag');
  label('int', 'treat', '<b>Drug target</b>and its neighbours', C.rare.a + 17, C.rare.b - 0.5, 'grn');
  label('int', 'seed', '<b>Symptom genes</b>where the signal starts', C.treat.a + 14, C.treat.b - 1, 'amb');
  label('int', 'causal', '<b>Top candidate</b>the broken gene', C.treat.a + 22, C.treat.b - 1, 'mag');
  label('tissue', 'mucosa', '<b>Glands</b>', C.tissue.a + 2, C.tissue.a + 9, 'mag');
  label('tissue', 'submucosa', '<b>Loose tissue</b>with vessels', C.tissue.a + 2.6, C.tissue.a + 9, 'mag');
  label('tissue', 'muscle', '<b>Muscle</b>', C.tissue.a + 3.2, C.tissue.a + 9, 'mag');
}
// camera waypoints: [t, az, el, dist, tx, ty, tz, ease]; 'spin' segments turn at a steady pace
function buildCamera(wp) {
  wp.sort((x, y) => x[0] - y[0]);
  // keep turning the short way round between views
  let prev = null;
  ST.wp = wp.map(w => {
    let az = w[1];
    if (prev !== null) az += 360 * Math.round((prev - az) / 360);
    prev = az;
    return [w[0], az, w[2], w[3], w[4], w[5], w[6], w[7]];
  });
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
      const p = wp[i - 1], q = wp[i], x = (q[7] === 'spin' ? spinEase : smoothSeg)(t - p[0], q[0] - p[0]);
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
  ST.labels.push({ kind: 'story', el: labelEl(html, cls), set, at, tIn, tOut, o: -1 });
}
function buildSetLabels() {
  for (const k of SET_ORDER) for (const L of GL.sets[k].labels || []) {
    const [b, r] = L.text;
    LBL.sets.push({ kind: 'set', el: labelEl(`<b>${esc(b)}</b>${esc(r || '')}`, L.cls), set: k, at: L.at, alpha: L.alpha, o: -1 });
  }
}
// a set label shows as far as its set is in and its own rule allows
const setLabelAlpha = (L, S) => { const a = S[L.set + '_a'] || 0; return a < 0.5 ? 0 : (2 * a - 1) * clamp(L.alpha ? L.alpha(S) : 1, 0, 1); };
// where a label points, in the world's own coordinates
const _v = new THREE.Vector3();
function labelPos(L, out) {
  const p = anchorOf(L.set, L.at);
  return out.set(p[0], p[1], p[2]).applyMatrix4(GL.sets[L.set].group.matrix);
}
// labels on screen: pinned next to their point, nudged down where they would overlap
const _placed = [];
function placeLabels(list, alphaOf) {
  _placed.length = 0;
  const vis = [];
  for (const L of list) {
    let o = Math.round(alphaOf(L) * 100) / 100;
    if (o > 0) {
      labelPos(L, _v).applyMatrix4(GL.world.matrixWorld).project(GL.camera);
      if (_v.z > 1 || Math.abs(_v.x) > 1.2 || Math.abs(_v.y) > 1.2) o = 0;
    }
    if (o !== L.o) { L.el.style.opacity = o; L.o = o; }
    if (o <= 0) continue;
    if (!L.w) { L.w = L.el.offsetWidth || 120; L.h = L.el.offsetHeight || 22; }
    vis.push([L, (_v.x * 0.5 + 0.5) * window.innerWidth + 9, (-_v.y * 0.5 + 0.5) * window.innerHeight - 11]);
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
  for (const e of it.els) {
    const o = Math.round(fadeVal(t, e.at, e.out, 0.6) * 100) / 100;
    if (o !== e.o) { e.el.style.opacity = o; e.o = o; e.el.style.visibility = o > 0 ? 'visible' : 'hidden'; }
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
// Explore mode: open any scene of the tour and play with it, or search the
// curated proteins of the interactome and trace routes between them.
const SCENES = [
  ['int', 'Interactome', 'Human proteins and their interactions. Light up groups that work together, flatten it into a city map, follow diseases and a signal spreading from a patient\'s genes.'],
  ['mac', 'Computer', 'A classic computer, its parts and its wiring: the parts list alone does not tell you how it works.'],
  ['web', 'Internet and friends', 'A map of the internet and the ties between cities around the world: networks are everywhere.'],
  ['dna', 'Genome and proteins', 'DNA, the 23 chromosomes, the shapes of proteins and how many kinds there are.'],
  ['atp', 'ATP synthase', 'A rotary motor built from 13 kinds of protein: its parts, the machine, how it runs and its network.'],
  ['crowd', 'Rare diseases', 'More than 6,000 rare diseases have a known genetic cause. Each patient asks: which gene, what mechanism, which treatment?'],
  ['sankey', 'Immunity', 'Inborn errors of immunity: the clinical categories doctors use, against the clusters the disease genes form in the interactome.'],
  ['scale', 'Scales and team', 'Networks from molecules to people, the four research groups of the institute, and the team.'],
  ['body', 'Whole body', 'A total-body PET scan and the network of organs, in health and in disease.'],
  ['tissue', 'Tissue', 'A stained section of stomach wall, its cells, their network of neighbours, many markers at once, and an embedding.'],
];
const TABS = [['scenes', 'Scenes'], ['protein', 'Proteins']];
const X = { tab: 'scenes', scene: 'int', ctl: {}, t0: 0, turn: 'on', sel: -1, path: null, pathErr: null, pathEnds: null };
const XS = {};
const orbit = { cur: [0, 12, 3.6, 0, 0, 0], from: null, to: null, t0: 0, dur: 1.6 };
const ctlValue = (k, c) => (X.ctl[k] && X.ctl[k][c.key] !== undefined ? X.ctl[k][c.key] : c.options[0][0]);

// what the chosen scene and its controls ask for: that set fully in, every other set out
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
function exploreStep(dt, now) {
  const tg = exploreTargets(now), k = 1 - Math.exp(-dt * 3.5);
  for (const n in DEF) XS[n] += (tg[n] - XS[n]) * k;
  // a turning scene, unless you are steering it
  if (X.turn === 'on' && !orbit.to && !orbit.held) orbit.cur[0] += dt * 4;
  return XS;
}
function openScene(k, fly = true) {
  if (!GL.sets[k]) return;
  const same = X.scene === k;
  X.scene = k; X.t0 = performance.now();
  if (!same && k !== 'int') { selectProtein(-1, false); clearRoute(); }
  if (fly && !same) flyTo(view(k, 'default'));
  renderScenes();
}
function setCtl(k, key, v) {
  (X.ctl[k] = X.ctl[k] || {})[key] = v;
  X.t0 = performance.now();
  const s = GL.sets[k], c = (s.controls || []).find(x => x.key === key);
  // some views have their own best camera (cam views named like the option)
  if (s.cam && s.cam[v]) flyTo(view(k, v));
  if (c) renderScenes();
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

// ------------------------------------------------------- proteins (curated) --
const INT = () => GL.sets.int;
function matches(q, limit) {
  q = q.trim().toLowerCase();
  if (!q) return [];
  const res = [];
  INT().core.forEach((p, i) => {
    const c = p.sym.toLowerCase(), nm = (p.name || '').toLowerCase(), r = (p.role || '').toLowerCase();
    let s = -1;
    if (c === q) s = 0; else if (c.startsWith(q)) s = 1; else if (nm.startsWith(q)) s = 2;
    else if (nm.includes(q) || r.includes(q)) s = 3;
    if (s >= 0) res.push([s, i]);
  });
  return res.sort((a, b) => a[0] - b[0] || INT().core[b[1]].degree - INT().core[a[1]].degree).slice(0, limit || 8).map(r => r[1]);
}
const findProtein = s => { const m = matches(s, 1); return m.length ? m[0] : -1; };
const modName = i => { const m = INT().modules[INT().core[i].module]; return m ? m.name : ''; };
const modCss = i => { const m = INT().modules[INT().core[i].module]; return m ? (m.css || '#95a6bd') : '#95a6bd'; };
function attachSuggest(input, list, onPick) {
  let items = [], hi = -1;
  const close = () => { list.classList.remove('on'); input.setAttribute('aria-expanded', 'false'); hi = -1; };
  const render = () => {
    const q = input.value, C0 = INT().core;
    items = /\s(to|-|–|>)\s/i.test(q) ? [] : matches(q, 8);
    if (!items.length) { close(); return; }
    list.innerHTML = items.map((i, k) => `<li role="option" data-i="${i}" aria-selected="${k === hi}"><b>${esc(C0[i].sym)}</b><span>${esc(C0[i].name)}</span><em>${esc(modName(i))}</em></li>`).join('');
    list.classList.add('on'); input.setAttribute('aria-expanded', 'true');
  };
  input.addEventListener('input', () => { hi = -1; render(); });
  input.addEventListener('focus', render);
  input.addEventListener('blur', () => setTimeout(close, 150));
  input.addEventListener('keydown', ev => {
    if (ev.key === 'ArrowDown' || ev.key === 'ArrowUp') {
      if (!items.length) return;
      hi = (hi + (ev.key === 'ArrowDown' ? 1 : -1) + items.length) % items.length; render(); ev.preventDefault();
    } else if (ev.key === 'Enter') {
      const pick = hi >= 0 ? items[hi] : null;
      close(); onPick(pick, input.value); ev.preventDefault();
    } else if (ev.key === 'Escape') close();
  });
  list.addEventListener('mousedown', ev => {
    const li = ev.target.closest('li');
    if (li) { ev.preventDefault(); close(); onPick(+li.dataset.i, input.value); }
  });
}
function runQuery(q) {
  const parts = q.split(/\s+(?:to|->|-|–|—|>)\s+/i);
  showTab('protein');
  if (parts.length === 2) {
    const s = findProtein(parts[0]), t = findProtein(parts[1]);
    $('#pf').value = s >= 0 ? INT().core[s].sym : parts[0]; $('#pt').value = t >= 0 ? INT().core[t].sym : parts[1];
    runRoute(s, t);
  } else {
    const i = findProtein(q);
    if (i >= 0) selectProtein(i); else renderProtein(-2, q);
  }
}
// the interactome must be on show for anything about proteins
function needInt() { if (X.scene !== 'int') openScene('int'); }
function selectProtein(i, show = true) {
  X.sel = i;
  if (INT().select) INT().select(i);
  if (i >= 0 && show) { needInt(); if (INT().anchors.protein) { const p = INT().anchors.protein(INT().core[i].sym); if (p) flyTo([orbit.cur[0], 18, 2.2, p[0], p[1], p[2]]); } }
  renderProtein(i);
  updateExtraLabels();
}
function runRoute(s, t) {
  X.pathErr = null; X.path = null;
  if (s < 0 || t < 0) X.pathErr = 'Pick two proteins from the suggestions, for example TP53 and BRCA1.';
  else if (s === t) X.pathErr = 'Pick two different proteins.';
  else {
    needInt();
    X.pathEnds = [s, t];
    X.path = INT().route ? INT().route(s, t) : null;
    if (!X.path) X.pathErr = 'No route between these two proteins.';
    else flyTo(view('int', 'default'));
  }
  renderRoute();
  updateExtraLabels();
}
function clearRoute() {
  X.path = null; X.pathErr = null; X.pathEnds = null;
  if (INT().route) INT().route(-1, -1);
  renderRoute();
}
// route steps as names: curated proteins by symbol, the others as unnamed proteins
function routeNames(path) {
  return path.map(n => (typeof n === 'object' && n ? n.sym || '·' : typeof n === 'string' ? n : '·'));
}

// ------------------------------------------------------------------ panes --
const QUICK = ['TP53', 'BRCA1', 'CTNNB1', 'EGFR', 'MTOR', 'PSMA1'];
const ROUTES = [['TP53', 'BRCA1'], ['EGFR', 'CASP3'], ['PSMA1', 'POLR2A']];
function buildExplore() {
  $('#explore').innerHTML = `
    <div class="tabs" role="tablist">${TABS.map(([k, n]) => `<button role="tab" type="button" data-tab="${k}" aria-selected="${k === X.tab}">${n}</button>`).join('')}</div>
    <div class="pane on" id="pane-scenes" role="tabpanel"></div>
    <div class="pane" id="pane-protein" role="tabpanel">
      <div class="search"><input id="q" type="search" placeholder="Search a protein, or type TP53 to BRCA1" autocomplete="off" spellcheck="false" aria-label="Search proteins or a route" role="combobox" aria-expanded="false" aria-controls="qs"><ul class="sugg" id="qs" role="listbox"></ul></div>
      <div id="pinfo"></div>
      <h3>Routes</h3><p class="sub">The fewest steps between two proteins, through the whole network.</p>
      <div class="row"><div class="field"><label for="pf">From</label><input id="pf" autocomplete="off" spellcheck="false"><ul class="sugg" id="pfs"></ul></div>
      <div class="field"><label for="pt">To</label><input id="pt" autocomplete="off" spellcheck="false"><ul class="sugg" id="pts"></ul></div></div>
      <div class="actions"><button class="btn primary" type="button" id="pgo">Find route</button>
      ${ROUTES.map(([s, t]) => `<button class="btn" type="button" data-pre="${s} ${t}">${s} to ${t}</button>`).join('')}</div><div id="presult"></div>
    </div>`;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.addEventListener('click', () => showTab(b.dataset.tab)));
  attachSuggest($('#q'), $('#qs'), (i, text) => { if (i !== null && i !== undefined) { $('#q').value = INT().core[i].sym; selectProtein(i); } else runQuery(text); });
  const pickField = id => (i, text) => { const v = i !== null && i !== undefined ? i : findProtein(text); if (v >= 0) $(id).value = INT().core[v].sym; };
  attachSuggest($('#pf'), $('#pfs'), pickField('#pf'));
  attachSuggest($('#pt'), $('#pts'), pickField('#pt'));
  $('#pgo').addEventListener('click', () => runRoute(findProtein($('#pf').value), findProtein($('#pt').value)));
  $('#pane-protein').querySelectorAll('[data-pre]').forEach(b => b.addEventListener('click', () => {
    const [s, t] = b.dataset.pre.split(' ');
    $('#pf').value = s; $('#pt').value = t; runRoute(findProtein(s), findProtein(t));
  }));
  $('#pane-scenes').addEventListener('click', ev => {
    const b = ev.target.closest('button');
    if (!b) return;
    if (b.dataset.scene) openScene(b.dataset.scene);
    else if (b.dataset.ctl) setCtl(X.scene, b.dataset.ctl, b.dataset.v);
  });
  renderScenes(); renderProtein(-1); renderRoute();
  $('#viewctl').innerHTML = `<div class="grp"><span>Turn</span><div class="seg" data-ctl="turn" role="group" aria-label="Turn">${[['on', 'On'], ['off', 'Off']].map(([v, n]) => `<button type="button" data-v="${v}" aria-pressed="${X.turn === v}">${n}</button>`).join('')}</div></div>`;
  $('#viewctl').addEventListener('click', ev => { const b = ev.target.closest('[data-v]'); if (b) setTurn(b.dataset.v); });
}
function setTurn(v) {
  X.turn = v;
  document.querySelectorAll('[data-ctl="turn"] button').forEach(b => b.setAttribute('aria-pressed', b.dataset.v === v));
}
function showTab(k) {
  X.tab = k;
  document.querySelectorAll('#explore .tabs button').forEach(b => b.setAttribute('aria-selected', b.dataset.tab === k));
  document.querySelectorAll('#explore .pane').forEach(p => p.classList.toggle('on', p.id === 'pane-' + k));
  if (k === 'protein') needInt();
  updateExtraLabels();
}
function renderScenes() {
  const pane = $('#pane-scenes');
  if (!pane) return;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  pane.innerHTML = `<div class="chips">${SCENES.map(([k, n]) => `<button type="button" data-scene="${k}" aria-pressed="${k === X.scene}"${k === X.scene ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(n)}</button>`).join('')}</div>
    <h3>${esc(sc[1])}</h3><p class="sub">${esc(sc[2])}</p>
    ${(s.controls || []).map(c => `<p class="grp-h">${esc(c.label)}</p><div class="chips">${c.options.map(([v, n]) => `<button type="button" data-ctl="${c.key}" data-v="${v}" aria-pressed="${ctlValue(X.scene, c) === v}"${ctlValue(X.scene, c) === v ? ' style="background:var(--cyan);color:#04131c"' : ''}>${esc(n)}</button>`).join('')}</div>`).join('')}`;
}
function renderProtein(i, q) {
  const pane = $('#pinfo');
  if (!pane) return;
  const C0 = INT().core;
  if (i < 0) {
    pane.innerHTML = `${i === -2 ? `<p class="empty">No protein matches “${esc(q)}”. Try a gene symbol like TP53, or a name like insulin.</p>` : `<p class="empty">Search above, or click a protein in the interactome. The ${fmt(C0.length)} named proteins come from the network-medicine story; the others are drawn to show the size of the whole map.</p>`}
      <div class="quick">${QUICK.filter(s => findProtein(s) >= 0).map(s => `<button type="button" data-c="${s}">${s} ${esc(C0[findProtein(s)].name)}</button>`).join('')}</div>`;
    pane.querySelectorAll('[data-c]').forEach(b => b.addEventListener('click', () => selectProtein(findProtein(b.dataset.c))));
    return;
  }
  const p = C0[i], part = INT().partners ? INT().partners(i) : [];
  pane.innerHTML = `<h3>${esc(p.sym)} ${esc(p.name)}</h3><p class="sub">${esc(p.role || '')}</p>
    <dl class="stats">
      <dt>Group</dt><dd><span class="sw" style="display:inline-block;margin-right:6px;background:${modCss(i)}"></span>${esc(modName(i))}</dd>
      <dt>Partners</dt><dd>${part.length}<small>${part.length === 1 ? 'named protein binds it' : 'named proteins bind it'}</small></dd>
      <dt>Essential</dt><dd>${p.essential ? 'Yes<small>cells cannot live without it</small>' : 'No'}</dd>
    </dl>
    <div class="chips">${part.map(j => `<button type="button" data-i="${j}">${esc(C0[j].sym)}</button>`).join('')}</div>`;
  pane.querySelectorAll('.chips [data-i]').forEach(b => b.addEventListener('click', () => selectProtein(+b.dataset.i)));
}
function renderRoute() {
  const el = $('#presult');
  if (!el) return;
  if (X.pathErr) { el.innerHTML = `<p class="empty">${esc(X.pathErr)}</p>`; return; }
  if (!X.path) { el.innerHTML = ''; return; }
  const names = routeNames(X.path), steps = names.length - 1, named = names.filter(n => n !== '·').length;
  el.innerHTML = `<div class="result"><b>${steps}</b> ${steps === 1 ? 'step' : 'steps'}<small>${named} named, ${names.length - named} unnamed proteins on the way</small></div>
    <ol class="hops">${names.map((n, k) => `<li><span>${k}</span>${esc(n === '·' ? 'unnamed protein' : n)}</li>`).join('')}</ol>`;
}
function updateExtraLabels() {
  LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); });
  LBL.extra = [];
  if (X.scene !== 'int' || !INT().anchors.protein) return;
  const add = (i, rest, cls) => {
    const sym = INT().core[i].sym;
    LBL.extra.push({ kind: 'extra', el: labelEl(`<b>${esc(sym)}</b>${esc(rest)}`, cls), set: 'int', at: () => INT().anchors.protein(sym), o: -1, txt: [sym, rest, cls] });
  };
  if (X.sel >= 0) add(X.sel, INT().core[X.sel].role || '', 'cyn');
  if (X.path && X.pathEnds) { add(X.pathEnds[0], 'start', 'mag'); add(X.pathEnds[1], 'end', 'mag'); }
}

// ----------------------------------------------------------- canvas input --
const _rc = new THREE.Raycaster(), _m2 = new THREE.Vector2(), _ro = new THREE.Vector3(), _rd = new THREE.Vector3(), _inv = new THREE.Matrix4();
// the curated protein under the mouse, in explore mode with the interactome on show
function pickAt(mx, my) {
  if (X.scene !== 'int' || !INT().pick) return -1;
  _m2.set(mx / window.innerWidth * 2 - 1, -(my / window.innerHeight) * 2 + 1);
  _rc.setFromCamera(_m2, GL.camera);
  _inv.copy(INT().group.matrixWorld).invert();
  _ro.copy(_rc.ray.origin).applyMatrix4(_inv); _rd.copy(_rc.ray.direction).transformDirection(_inv);
  return INT().pick(_ro, _rd);
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
        if (pinch > 0) orbit.cur[2] = clamp(orbit.cur[2] * pinch / d, 0.3, 40);
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
    const i = pickAt(ev.clientX, ev.clientY);
    cv.style.cursor = i >= 0 ? 'pointer' : 'grab';
    if (i >= 0) {
      const p = INT().core[i];
      tip.innerHTML = `<b>${esc(p.sym)}</b>${esc(p.role || p.name)}`;
      tip.style.transform = `translate(${ev.clientX + 14}px, ${ev.clientY + 12}px)`;
      tip.style.opacity = 1;
    } else tip.style.opacity = 0;
  });
  const end = ev => {
    pts.delete(ev.pointerId);
    if (pts.size < 2) pinch = 0;
    if (APP.mode === 'explore' && down && !down.moved && ev.type === 'pointerup') {
      const i = pickAt(ev.clientX, ev.clientY);
      if (i >= 0) { $('#q').value = INT().core[i].sym; showTab('protein'); selectProtein(i, false); }
    }
    if (!pts.size) { down = null; orbit.held = false; }
  };
  cv.addEventListener('pointerup', end);
  cv.addEventListener('pointercancel', end);
  cv.addEventListener('pointerleave', () => { tip.style.opacity = 0; });
  cv.addEventListener('wheel', ev => {
    if (APP.mode !== 'explore') return;
    ev.preventDefault();
    orbit.to = null;
    orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ev.deltaY * 0.0012), 0.3, 40);
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
// Turn a story/orbit view [az, el, dist, tx, ty, tz] into a pose for the
// floating scene: the side the camera looks from faces you, "up" stays up, the
// target sits in front of you, and closer views make the scene bigger.
const _xX = new THREE.Vector3(1, 0, 0), _xY = new THREE.Vector3(0, 1, 0);
function xrPlace(v) {
  const d = Math.max(v[2], 0.05);
  _xq.setFromAxisAngle(_xX, clamp(v[1], -85, 85) * D2R).multiply(_xq2.setFromAxisAngle(_xY, -v[0] * D2R));
  XR.R = XR.baseR * clamp(Math.pow(3.6 / d, 0.85), 0.12, 3.2);
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
  XR.globeOff.set(0, 0, 0);
  if (XR.panelGroup) { XR.panelGroup.position.copy(XR.panelHome.p); XR.panelGroup.rotation.set(0, XR.panelHome.yaw, 0); }
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
function xrTip(S) {
  let i = -1;
  if (APP.mode === 'explore') for (const c of XR.ctrls) if (c.hover && c.hover.kind === 'globe' && c.hover.i >= 0) { i = c.hover.i; break; }
  if (i !== XR.tipI) {
    XR.tipI = i;
    if (XR.tip) dropSprite(XR.tip);
    const p = i >= 0 ? INT().core[i] : null;
    XR.tip = p ? { set: 'int', at: () => INT().anchors.protein(p.sym), txt: [p.sym, p.role || p.name, 'tip'] } : null;
  }
  if (XR.tip) placeLabelXR(XR.tip, 1, S);
}

// --------------------------------------------------- picking a protein --
// The curated protein nearest a ray given in the world's own coordinates (explore mode, interactome on show)
const _pinv = new THREE.Matrix4(), _po = new THREE.Vector3(), _pd = new THREE.Vector3();
function pickRay(o, d) {
  if (APP.mode !== 'explore' || X.scene !== 'int' || !INT().pick) return -1;
  _pinv.copy(INT().group.matrix).invert();
  return INT().pick(_po.copy(o).applyMatrix4(_pinv), _pd.copy(d).transformDirection(_pinv));
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
  g.addEventListener('selectend', () => { if (c.wantPress) { c.wantPress = false; xrPress(c); } xrRelease(c); audioGesture(); });
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
  if (h.kind === 'panel') {
    const r = h.P.at(h.x, h.y);
    if (!r) return;
    c.press = { kind: 'panel', P: h.P, id: r.id, r };
    if (r.drag) { r.drag(h.x, h.y); buzz(c, 0.2, 12); }
  } else c.press = Object.assign(startDrag(c), { kind: 'globe', i: h.i });
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
  } else if (!p.moved && p.i >= 0) { buzz(c); xrClickProtein(p.i); }
}
function xrGrab(c, on) {
  c.grab = null;
  const h = c.hover;
  if (!on || !h) return;
  if (XR.stories) return; // the Stories screen stays put
  const obj = h.kind === 'panel' ? XR.panelGroup : GL.world;
  c.grab = { target: h.kind === 'panel' ? 'panel' : 'globe', q0: new THREE.Quaternion().setFromRotationMatrix(c.g.matrix).invert(),
    o0: c.o.clone(), p0: obj.getWorldPosition(new THREE.Vector3()), reach: 1 };
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
  // panels first: they are drawn on top of everything
  XR.raycaster.set(c.o, c.d);
  const hs = XR.raycaster.intersectObjects(XR.panelMeshes.filter(m => m.visible), false);
  if (hs.length) {
    const h = hs[0], P = XR.panels.find(q => q.mesh === h.object);
    hit = { kind: 'panel', P, x: h.uv.x * P.w, y: (1 - h.uv.y) * P.h, point: h.point };
    dist = h.distance;
  } else if (!XR.stories) {
    // the scene counts as a ball around the view's target; a curated protein counts if the ray passes close
    const oL = _xa.copy(c.o).applyMatrix4(_xinv), dL = _xb.copy(c.d).transformDirection(_xinv);
    _xc.copy(oL).sub(XR.target);
    const b = _xc.dot(dL), disc = b * b - (_xc.lengthSq() - XR.hitR * XR.hitR);
    const t = disc > 0 ? -b - Math.sqrt(disc) : -1;
    const i = pickRay(oL, dL);
    if (t > 0 || i >= 0) {
      if (i >= 0) { const q = INT().anchors.protein(INT().core[i].sym); _xp.set(q[0], q[1], q[2]).applyMatrix4(INT().group.matrix); }
      else _xp.copy(dL).multiplyScalar(t).add(oL);
      _xp.applyMatrix4(GL.world.matrixWorld);
      hit = { kind: 'globe', i, point: _xp.clone() };
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
      if (Math.abs(ay) > 0.2) { orbit.to = null; orbit.cur[2] = clamp(orbit.cur[2] * Math.exp(ay * dt * 1.5), 0.3, 40); }
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
function xrBegin(frame, dt) {
  const ref = GL.renderer.xr.getReferenceSpace();
  const pose = frame && ref ? frame.getViewerPose(ref) : null;
  if (pose) {
    const p = pose.transform.position, q = pose.transform.orientation;
    XR.head.set(p.x, p.y, p.z); XR.headQ.set(q.x, q.y, q.z, q.w);
    if (XR.needRecenter) { xrRecenter(); XR.needRecenter = false; }
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
  if (XR.land) { for (const P of XR.land) P.mesh.visible = land; XR.main.mesh.visible = XR.foot.mesh.visible = !land; }
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
function xrClickProtein(i) {
  if (APP.mode !== 'explore') return;
  XR.kbd.open = false;
  if (XR.routing) { xrSetPathEnd(i); return; }
  showTab('protein'); selectProtein(i, false);
}
// while routing, clicks in the network fill the highlighted end (From, then To)
function xrSetPathEnd(i) {
  const sym = INT().core[i].sym;
  if (XR.pick === 'to') { XR.pt = i; $('#pt').value = sym; }
  else { XR.pf = i; $('#pf').value = sym; XR.pick = 'to'; }
  if (XR.pf >= 0 && XR.pt >= 0) runRoute(XR.pf, XR.pt);
}
function xrPathPreset(s, t) {
  XR.pf = s; XR.pt = t; XR.pick = 'to';
  $('#pf').value = INT().core[s].sym; $('#pt').value = INT().core[t].sym;
  runRoute(s, t);
}
function xrClearPath() {
  XR.pf = -1; XR.pt = -1; XR.pick = 'from';
  clearRoute(); updateExtraLabels();
}
function xrPickSuggestion(i) {
  XR.kbd.open = false; XR.kbd.q = '';
  if (XR.routing) xrSetPathEnd(i);
  else { $('#q').value = INT().core[i].sym; showTab('protein'); selectProtein(i); }
}
function xrZoom(f) {
  const c = orbit.cur;
  orbit.from = c.slice();
  orbit.to = c.slice(); orbit.to[2] = clamp(c[2] * f, 0.3, 40);
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
    session = await navigator.xr.requestSession(mode, { optionalFeatures: ['local-floor', 'hand-tracking'] });
  } catch (err) {
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
  if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; }
  for (const L of [...ST.labels, ...LBL.sets, ...LBL.extra]) L.o = -1;
  // every headset session starts the story from the top; entered from the start screen, it shows the Stories menu first
  const fromStart = HOST.picking || HOST.landingVR;
  HOST.landingVR = false;
  HOST.closePicker();
  if (fromStart) { APP.enterStory(0); APP.playing = false; XR.stories = true; XR.inStory = false; }
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
// wearer as a new visitor. Restart the story and place everything in front of them.
const XR_AWAY_MS = 3000;
function xrVisibility() {
  const v = XR.session && XR.session.visibilityState;
  if (v === 'hidden') { if (!XR.hiddenAt) XR.hiddenAt = performance.now(); }
  else if (v === 'visible' && XR.hiddenAt) {
    const away = performance.now() - XR.hiddenAt;
    XR.hiddenAt = 0;
    if (away > XR_AWAY_MS) xrFreshStart();
    if (AUD.ctx && AUD.ctx.state !== 'running') AUD.ctx.resume().catch(() => {});
  }
  audioSync();
}
function xrFreshStart() {
  XR.kbd.open = false; XR.kbd.q = '';
  for (const c of XR.ctrls) { c.press = null; c.grab = null; c.wantPress = false; }
  APP.enterStory(0); APP.playing = false;
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
  // keep the cell and the panel where they were in the story before
  const p = HOST.xrPose;
  if (p) {
    XR.needRecenter = false;
    GL.rig.position.copy(p.rp); GL.rig.quaternion.copy(p.rq);
    XR.globeOff.copy(p.off);
    XR.panelGroup.position.copy(p.pp); XR.panelGroup.rotation.set(0, p.pr, 0);
  }
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
  return ['x', audioLabel(), X.tab, X.scene, JSON.stringify(X.ctl[X.scene] || {}), X.sel, X.path ? routeNames(X.path).join(',') : '', X.pathErr || '',
    XR.kbd.open, XR.kbd.q, XR.pf, XR.pt, XR.pick, XR.routing].join('|');
}
const XR_HERE = 'lbi';
const XR_STORIES = HOST.list;
// ------------------------------------------------------- headset landing --
// The Stories screen in the headset: a title panel and one card per story,
// floating in an arc in front of you while the story itself is hidden.
function xrLandingSetup() {
  XR.land = [];
  XR.landGroup = new THREE.Group();
  GL.rig.add(XR.landGroup);
  const head = makePanel(1400, 300, 1.02, drawLandHead, () => 'h' + XR.inStory + audioLabel());
  head.mesh.position.set(0, 0.36, -1.12);
  XR.landGroup.add(head.mesh); XR.land.push(head);
  HOST.list.forEach((s, k) => {
    const a = (k - (HOST.list.length - 1) / 2) * 0.42, d = 1.06;
    const P = makePanel(640, 820, 0.4, (ctx, P) => drawLandCard(ctx, P, s), () => 'c' + XR.inStory + s.key);
    P.mesh.position.set(Math.sin(a) * d, -0.13, -Math.cos(a) * d);
    P.mesh.rotation.y = -a;
    XR.landGroup.add(P.mesh); XR.land.push(P);
  });
  for (const P of XR.land) XR.panels.push(P);
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
  ctx.font = vfont(58, 700); ctx.fillStyle = VC.ink; ctx.fillText('Networks, in four stories', 48, 44);
  textBlock(ctx, 'The same ideas, very different networks. Each story takes a few minutes, then it is yours to explore. Point at a story and pull the trigger (or pinch).', 48, 128, 860, 27, 38, VC.muted);
  let x = P.w - 44;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 40, w, 64, label, fn, o); x -= 14; };
  hb('exit', 'Exit', () => { if (XR.session) XR.session.end(); }, 110, { px: 27 });
  hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 170, { px: 27 });
  if (XR.inStory) vButton(ctx, P, 'back', P.w - 44 - 294, 128, 294, 64, 'Back to the story', xrLandingClose, { px: 26 });
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
  for (const { key: k, kick, title, desc, col } of XR_STORIES) {
    const here = k === XR_HERE, h = 210;
    vButton(ctx, P, 'story:' + k, x, y, W, h, '', () => { if (here) XR.stories = false; else HOST.go(k); }, { on: here, r: 14 });
    ctx.font = vfont(21, 700); ctx.fillStyle = col; ctx.fillText(kick.toUpperCase(), x + 26, y + 22);
    ctx.font = vfont(38, 700); ctx.fillStyle = VC.ink; ctx.fillText(title, x + 26, y + 54);
    if (here) { ctx.font = vfont(22); ctx.fillStyle = VC.cyan; ctx.textAlign = 'right'; ctx.fillText('You are here', x + W - 26, y + 26); ctx.textAlign = 'left'; }
    textBlock(ctx, desc, x + 26, y + 106, W - 52, 24, 33, VC.muted, 400, 3);
    y += h + 18;
  }
  vButton(ctx, P, 'story:close', x, y + 4, 220, 60, 'Back', () => { XR.stories = false; }, { px: 25 });
}
function drawMain(ctx, P) {
  const story = APP.mode === 'story';
  let x = P.w - 36;
  const hb = (id, label, fn, w, o) => { x -= w; vButton(ctx, P, id, x, 26, w, 54, label, fn, o); x -= 12; };
  hb('exit', 'Exit', () => { if (XR.session) XR.session.end(); }, 96);
  if (AUD.state !== 'none') hb('sound', audioLabel(), () => audioToggle(), 180, { on: AUD.ok && !AUD.muted && AUD.ctx.state === 'running', px: 23 });
  hb('recenter', 'Recenter', () => { XR.needRecenter = true; }, 140);
  hb('stories', 'Stories', () => { XR.stories = true; XR.kbd.open = false; APP.playing = false; }, 130);
  if (!XR.stories) hb('mode', story ? 'Explore now' : 'Replay story', () => (story ? APP.enterExplore() : APP.enterStory(0)), 186, { primary: story });
  ctx.font = vfont(30, 700); ctx.fillStyle = VC.ink;
  ctx.fillText(fitText(ctx, 'A glimpse into the future', x - 40), 40, 36);
  ctx.fillStyle = VC.line; ctx.fillRect(36, 104, P.w - 72, 2);
  if (XR.stories) drawStoriesPane(ctx, P, 44, 136, P.w - 88);
  else if (story) {
    drawStoryPane(ctx, P, 44, 136, P.w - 88);
    ctx.fillStyle = VC.line; ctx.fillRect(36, P.h - 96, P.w - 72, 2);
    textBlock(ctx, 'Trigger (or pinch): use buttons. Grip: move the scene or this panel. A or X: play and pause.', 44, P.h - 74, P.w - 88, 22, 30, VC.faint);
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
      ctx.font = vfont(58, 700); ctx.fillStyle = VC.amber; ctx.fillText(fitText(ctx, b ? b.textContent : '', cw - 16), x + k * cw, y);
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


// explore: tabs and panes mirroring the HTML ones
function drawExplorePane(ctx, P, x, y, W) {
  const tw = W / TABS.length;
  TABS.forEach(([k, n], j) => {
    const on = X.tab === k, tx = x + j * tw, hov = P.hover === 'tab:' + k;
    if (hov && !on) { rr(ctx, tx + 4, y, tw - 8, 62, 8); ctx.fillStyle = VC.chip; ctx.fill(); }
    ctx.font = vfont(26, on ? 700 : 400); ctx.fillStyle = on ? VC.ink : VC.muted;
    ctx.textAlign = 'center'; ctx.fillText(n, tx + tw / 2, y + 18); ctx.textAlign = 'left';
    if (on) { ctx.fillStyle = VC.cyan; ctx.fillRect(tx + 12, y + 58, tw - 24, 4); }
    P.regions.push({ id: 'tab:' + k, x: tx, y, w: tw, h: 64, fn: () => { XR.kbd.open = false; showTab(k); } });
  });
  ctx.fillStyle = VC.line; ctx.fillRect(x, y + 62, W, 2);
  y += 92;
  const bottom = P.h - 34;
  if (XR.kbd.open && X.tab === 'protein') return drawKeyboard(ctx, P, x, y, W);
  if (X.tab === 'scenes') drawScenesPane(ctx, P, x, y, W, bottom);
  else drawProteinPane(ctx, P, x, y, W, bottom);
}
function searchField(ctx, P, x, y, W, text) {
  vButton(ctx, P, 'search', x, y, W, 66, '', () => { XR.kbd.open = true; XR.kbd.q = ''; }, { r: 10 });
  ctx.strokeStyle = VC.muted; ctx.lineWidth = 3;
  ctx.beginPath(); ctx.arc(x + 32, y + 30, 11, 0, 7); ctx.moveTo(x + 40, y + 38); ctx.lineTo(x + 49, y + 47); ctx.stroke();
  ctx.font = vfont(25); ctx.fillStyle = VC.faint; ctx.fillText(text, x + 66, y + 20);
}
function chipFlow(ctx, P, items, x, y, W, maxY, label, fn, idp, colorOf) {
  let cx = x, cy = y, shown = 0;
  ctx.font = vfont(23);
  for (const it of items) {
    const t = label(it), col = colorOf ? colorOf(it) : null, sw = col ? 22 : 0, w = ctx.measureText(t).width + 26 + sw;
    if (cx + w > x + W) { cx = x; cy += 50; }
    if (cy + 42 > maxY) break;
    vButton(ctx, P, idp + it, cx, cy, w, 42, '', () => fn(it), { r: 6 });
    if (col) swatch(ctx, cx + 12, cy + 14, 14, col);
    ctx.font = vfont(23); ctx.fillStyle = VC.ink; ctx.textBaseline = 'middle';
    ctx.fillText(t, cx + 13 + sw, cy + 22); ctx.textBaseline = 'top';
    cx += w + 8; shown++;
  }
  return { h: cy - y + 42, shown };
}
// the scenes of the tour, and the chosen scene's own controls
function drawScenesPane(ctx, P, x, y, W, bottom) {
  const cw = (W - 12) / 2;
  SCENES.forEach(([k, n], j) => {
    const bx = x + (j % 2) * (cw + 12), by = y + Math.floor(j / 2) * 66;
    vButton(ctx, P, 'scene:' + k, bx, by, cw, 56, n, () => openScene(k), { on: X.scene === k, px: 25, left: true });
  });
  y += Math.ceil(SCENES.length / 2) * 66 + 14;
  const sc = SCENES.find(s => s[0] === X.scene), s = GL.sets[X.scene];
  y += textBlock(ctx, sc[2], x, y, W, 25, 35, VC.muted, 400, 4) + 18;
  for (const c of s.controls || []) {
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
}
// search the named proteins, show one, or trace a route between two
function drawProteinPane(ctx, P, x, y, W, bottom) {
  const C0 = INT().core, bw = (W - 12) / 2;
  vButton(ctx, P, 'pmode:info', x, y, bw, 54, 'One protein', () => { XR.routing = false; }, { on: !XR.routing, px: 24 });
  vButton(ctx, P, 'pmode:route', x + bw + 12, y, bw, 54, 'Route between two', () => { XR.routing = true; }, { on: !!XR.routing, px: 24 });
  y += 72;
  searchField(ctx, P, x, y, W, XR.routing ? `Search the ${XR.pick === 'from' ? 'From' : 'To'} protein` : 'Search a protein');
  y += 92;
  if (XR.routing) {
    [['from', 'From', XR.pf], ['to', 'To', XR.pt]].forEach(([k, lab, i], j) => {
      const bx = x + j * (bw + 12), on = XR.pick === k;
      vButton(ctx, P, 'end:' + k, bx, y, bw, 98, '', () => { XR.pick = k; }, { on });
      ctx.font = vfont(21); ctx.fillStyle = on ? VC.cyan : VC.muted; ctx.fillText(on ? lab + ' (point at one)' : lab, bx + 16, y + 14);
      ctx.font = vfont(28, 700); ctx.fillStyle = i >= 0 ? VC.ink : VC.faint;
      ctx.fillText(fitText(ctx, i >= 0 ? `${C0[i].sym}  ${C0[i].name}` : '—', bw - 32), bx + 16, y + 50);
    });
    y += 116;
    let bx = x;
    ROUTES.forEach(([s, t], k) => {
      const n = `${s} to ${t}`, w = Math.max(150, 15 * n.length + 30);
      vButton(ctx, P, 'pre' + k, bx, y, w, 58, n, () => xrPathPreset(findProtein(s), findProtein(t)), { px: 22 }); bx += w + 10;
    });
    vButton(ctx, P, 'pclear', bx, y, 120, 58, 'Clear', xrClearPath, { px: 22 });
    y += 84;
    if (X.pathErr) { textBlock(ctx, X.pathErr, x, y, W, 26, 38, VC.muted); return; }
    if (!X.path) { textBlock(ctx, 'Point at two named proteins in the network, or try one of the examples.', x, y, W, 26, 38, VC.muted); return; }
    const names = routeNames(X.path), L = names.length - 1, named = names.filter(n => n !== '·').length;
    ctx.font = vfont(64, 700); ctx.fillStyle = VC.magenta;
    ctx.fillText(`${L} ${L === 1 ? 'step' : 'steps'}`, x, y);
    y += 82;
    y += textBlock(ctx, `${named} named and ${names.length - named} unnamed proteins on the way.`, x, y, W, 24, 34, VC.muted) + 12;
    textBlock(ctx, names.map(n => (n === '·' ? '•' : n)).join('  →  '), x, y, W, 27, 40, VC.ink, 400, Math.max(1, Math.floor((bottom - y) / 40)));
    return;
  }
  const i = X.sel;
  if (i < 0) {
    y += textBlock(ctx, `Point at a named protein in the interactome and pull the trigger (or pinch). The ${fmt(C0.length)} named proteins come from the network-medicine story; the others show the size of the whole map.`, x, y, W, 27, 40, VC.muted) + 22;
    chipFlow(ctx, P, QUICK.filter(s => findProtein(s) >= 0), x, y, W, bottom, c => `${c} ${C0[findProtein(c)].name}`, c => selectProtein(findProtein(c)), 'quick:');
    return;
  }
  const p = C0[i], part = INT().partners ? INT().partners(i) : [];
  y += textBlock(ctx, `${p.sym} ${p.name}`, x, y, W, 38, 46, VC.ink, 700, 2) + 4;
  y += textBlock(ctx, p.role || '', x, y, W, 25, 34, VC.muted, 400, 2) + 18;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Group', x, y + 3);
  swatch(ctx, x + 190, y + 6, 22, modCss(i));
  ctx.font = vfont(27); ctx.fillStyle = VC.ink; ctx.fillText(fitText(ctx, modName(i), W - 230), x + 224, y);
  y += 44;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Partners', x, y + 3);
  ctx.font = vfont(27); ctx.fillStyle = VC.ink; ctx.fillText(`${part.length} named`, x + 190, y);
  y += 44;
  ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText('Essential', x, y + 3);
  ctx.font = vfont(27); ctx.fillStyle = VC.ink; ctx.fillText(p.essential ? 'Yes, cells cannot live without it' : 'No', x + 190, y);
  y += 56;
  vButton(ctx, P, 'aroute', x, y, 330, 60, 'Find a route from here', () => {
    xrClearPath(); XR.routing = true;
    XR.pf = i; XR.pt = -1; XR.pick = 'to'; $('#pf').value = p.sym; $('#pt').value = '';
  }, { px: 23 });
  y += 80;
  chipFlow(ctx, P, part, x, y, W, bottom, j => C0[j].sym, j => selectProtein(j), 'nb:');
}
// on-panel keyboard for searching proteins
const KROWS = ['QWERTYUIOP', 'ASDFGHJKL', 'ZXCVBNM'];
function drawKeyboard(ctx, P, x, y, W) {
  const kb = XR.kbd, forPath = !!XR.routing, C0 = INT().core;
  ctx.font = vfont(22); ctx.fillStyle = VC.muted;
  ctx.fillText(forPath ? `Search the ${XR.pick === 'from' ? 'From' : 'To'} protein` : 'Search a named protein by gene symbol or name', x, y);
  y += 36;
  rr(ctx, x, y, W, 70, 10); ctx.fillStyle = 'rgba(149,166,189,0.10)'; ctx.fill();
  ctx.lineWidth = 2; ctx.strokeStyle = VC.cyan; ctx.stroke();
  ctx.font = vfont(32); ctx.fillStyle = kb.q ? VC.ink : VC.faint;
  const shown = kb.q || 'Type with the keys below';
  ctx.fillText(shown, x + 20, y + 18);
  if (kb.q) { const w = ctx.measureText(kb.q).width; ctx.fillStyle = VC.cyan; ctx.fillRect(x + 24 + w, y + 16, 3, 38); }
  y += 88;
  const route = /\s(to|-|>)\s/i.test(kb.q.trim()), sug = route ? [] : matches(kb.q, 5);
  if (route) textBlock(ctx, 'Press Find route for the fewest steps between these two proteins.', x, y, W, 25, 36, VC.muted);
  else if (kb.q && !sug.length) textBlock(ctx, `No named protein matches “${kb.q}”.`, x, y, W, 25, 36, VC.muted);
  else if (!kb.q) textBlock(ctx, 'Tip: type two symbols with TO between them, like TP53 TO BRCA1, to find a route.', x, y, W, 24, 34, VC.faint);
  sug.forEach((i, k) => {
    const id = 'sug:' + i, yy = y + k * 60;
    vButton(ctx, P, id, x, yy, W, 54, '', () => xrPickSuggestion(i), { r: 8 });
    ctx.font = vfont(25, 700); ctx.fillStyle = VC.ink; ctx.fillText(C0[i].sym, x + 16, yy + 14);
    ctx.font = vfont(23); ctx.fillStyle = VC.muted; ctx.fillText(fitText(ctx, C0[i].name, W - 400), x + 156, yy + 15);
    ctx.fillStyle = VC.faint; ctx.textAlign = 'right'; ctx.fillText(fitText(ctx, modName(i), 220), x + W - 16, yy + 15); ctx.textAlign = 'left';
  });
  const kw = 84, kh = 70, g = 9, ky0 = P.h - 34 - 4 * kh - 3 * g;
  KROWS.forEach((row, r) => {
    const rw = row.length * kw + (row.length - 1) * g, rx = x + (W - rw) / 2 - (r === 2 ? 50 : 0);
    [...row].forEach((ch, k) => vButton(ctx, P, 'key:' + ch, rx + k * (kw + g), ky0 + r * (kh + g), kw, kh, ch,
      () => { kb.q = (kb.q + ch).slice(0, 24); }, { px: 28 }));
    if (r === 2) vButton(ctx, P, 'key:back', rx + rw + g, ky0 + r * (kh + g), 2 * kw, kh, '⌫ Delete', () => { kb.q = kb.q.slice(0, -1); }, { px: 24 });
  });
  const by = ky0 + 3 * (kh + g);
  vButton(ctx, P, 'key:space', x + 40, by, 380, kh, 'Space', () => { if (kb.q && !kb.q.endsWith(' ')) kb.q += ' '; }, { px: 24 });
  vButton(ctx, P, 'key:clear', x + 432, by, 170, kh, 'Clear', () => { kb.q = ''; }, { px: 24 });
  vButton(ctx, P, 'key:done', x + 614, by, 290, kh, route ? 'Find route' : sug.length ? 'Choose ' + C0[sug[0]].sym : 'Close', () => {
    if (route) {
      kb.open = false; runQuery(kb.q.trim()); kb.q = '';
      if (X.pathEnds) { XR.pf = X.pathEnds[0]; XR.pt = X.pathEnds[1]; XR.pick = 'to'; XR.routing = true; }
    } else if (sug.length) xrPickSuggestion(sug[0]); else kb.open = false;
  }, { px: 24, primary: route || !!sug.length });
}

// ----------------------------------------------------------- footer panel --
function sigFoot() {
  return APP.mode === 'story' ? 's' + Math.round(APP.t * 4) + APP.playing + (curCh ? curCh.key : '') : 'x' + X.turn;
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
// Optional voice-over: put an MP3 at audio/narration-lbi.mp3 (next to this page).
// Second 0 of the recording plays at second 0 of the story; the story clock
// follows the audio, so seeking, pausing and chapter jumps stay in sync.
// Without the file the story runs silently, exactly as before.
// Narration through Web Audio. The file is loaded and decoded once; the audio
// engine is unlocked by the first tap or click (e.g. Enter VR) and from then on
// can start, stop and jump at any moment, also inside a headset where
// controller clicks may not count as taps for the browser.
const AUD = { ctx: null, gain: null, buf: null, src: null, startAt: 0, offset: 0, ok: false, muted: false,
  state: 'loading', needSeek: true, audible: false, duration: 0 };
function audioInit() {
  try { AUD.muted = localStorage.getItem('narrationMuted') === '1'; } catch (e) { /* storage blocked */ }
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) { AUD.state = 'none'; audioButton(); return; }
  AUD.ctx = new AC();
  AUD.gain = AUD.ctx.createGain();
  AUD.gain.connect(AUD.ctx.destination);
  AUD.ctx.addEventListener('statechange', () => { audioSync(); audioButton(); });
  fetch('audio/narration-lbi.mp3').then(r => {
    if (!r.ok) throw new Error('missing');
    return r.arrayBuffer();
  }).then(data => new Promise((res, rej) => AUD.ctx.decodeAudioData(data, res, rej))).then(buf => {
    AUD.buf = buf; AUD.duration = buf.duration; AUD.ok = true; AUD.state = 'ok';
    if (AUD.duration + 1 > T_END) {
      T_END = AUD.duration + 1;
      document.querySelectorAll('#track .tick, #track .name').forEach(el => {
        const c = C[el.dataset.k]; if (c) el.style.left = (100 * c.na / T_END).toFixed(2) + '%';
      });
      $('#track').setAttribute('aria-valuemax', Math.round(T_END)); lastTick = -1;
    }
    audioSync(); audioButton();
  }).catch(err => {
    AUD.state = err && err.message === 'missing' ? 'none' : 'error';
    if (AUD.state === 'error') { console.warn('Narration could not be decoded:', err); xrMsg('The narration file could not be played. Export it as a standard MP3 and upload it again.'); }
    audioButton();
  });
  ['pointerdown', 'keydown', 'touchend', 'click'].forEach(t => document.addEventListener(t, audioGesture, true));
  $('#btnSound').addEventListener('click', () => audioToggle());
  // react at once to play/pause, seeks, chapter jumps and mode changes
  for (const name of ['seek', 'togglePlay', 'enterExplore', 'enterStory']) {
    const f = APP[name];
    APP[name] = function (...args) { const r = f.apply(APP, args); AUD.needSeek = true; audioSync(); return r; };
  }
}
// called from every user gesture (page clicks and taps, and controller clicks in VR)
function audioGesture() {
  const ctx = AUD.ctx;
  if (!ctx) return;
  if (ctx.state !== 'running' && ctx.state !== 'closed') {
    const r = ctx.resume();
    if (r && r.then) r.then(() => { audioSync(); audioButton(); }, () => {});
  }
  audioSync(); audioButton();
}
function audioPos() { return AUD.src ? AUD.offset + (AUD.ctx.currentTime - AUD.startAt) : AUD.offset; }
function audioStart(at) {
  audioStop();
  const src = AUD.ctx.createBufferSource();
  src.buffer = AUD.buf; src.connect(AUD.gain);
  src.start(0, Math.max(0, at));
  AUD.src = src; AUD.offset = at; AUD.startAt = AUD.ctx.currentTime; AUD.audible = true;
}
function audioStop() {
  if (AUD.src) { try { AUD.src.stop(); } catch (e) { /* already stopped */ } AUD.src.disconnect(); AUD.src = null; }
  AUD.audible = false;
}
function audioWanted() {
  return AUD.ok && !AUD.muted && APP.mode === 'story' && APP.playing &&
    !(document.hidden && !XR.on) && !(XR.on && XR.session && XR.session.visibilityState === 'hidden') &&
    APP.t < AUD.duration - 0.05;
}
// start, stop or re-seek the narration to match the story
function audioSync() {
  const ctx = AUD.ctx;
  if (!ctx || !AUD.ok) return;
  const want = audioWanted() && ctx.state === 'running';
  if (!want) { if (AUD.src) audioStop(); return; }
  if (!AUD.src || (AUD.needSeek && Math.abs(audioPos() - APP.t) > 0.15)) audioStart(APP.t);
  AUD.needSeek = false;
}
// while it plays, the narration is the clock: gently pull the story toward it
function audioFollow() {
  if (!AUD.src || !AUD.audible || AUD.ctx.state !== 'running') return;
  const d = audioPos() - APP.t;
  APP.t = Math.abs(d) < 0.6 ? APP.t + d * 0.2 : audioPos();
}
function audioToggle() {
  AUD.muted = !AUD.muted;
  try { localStorage.setItem('narrationMuted', AUD.muted ? '1' : '0'); } catch (e) { /* storage blocked */ }
  audioGesture();
}
function audioLabel() {
  if (AUD.state === 'loading') return 'Sound loading';
  if (AUD.state === 'error') return 'Sound unavailable';
  if (AUD.muted) return 'Sound off';
  return AUD.ctx && AUD.ctx.state === 'running' ? 'Sound on' : 'Play sound';
}
function audioButton() {
  const b = $('#btnSound');
  b.hidden = AUD.state === 'none';
  b.textContent = audioLabel();
  b.setAttribute('aria-pressed', AUD.ok && !AUD.muted ? 'true' : 'false');
  b.title = AUD.muted ? 'Turn the narration on' : 'Turn the narration off';
}
document.addEventListener('visibilitychange', () => { if (!document.hidden && AUD.ctx && AUD.ctx.state !== 'running') AUD.ctx.resume().catch(() => {}); audioSync(); });

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
    orbit.cur = storyCam(ts).slice(); orbit.to = null;
    let best = 'int', ba = 0;
    for (const k of SET_ORDER) if (S[k + '_a'] > ba + 0.01) { ba = S[k + '_a']; best = k; }
    X.scene = best; X.t0 = performance.now();
    ST.labels.forEach(L => { L.el.style.opacity = 0; L.o = 0; });
    renderScenes();
    updateExtraLabels();
    $('#panel').scrollTop = 0;
  },
  enterStory(t) {
    this.mode = 'story';
    document.body.classList.remove('exploring');
    $('#btnMode').textContent = 'Explore now';
    if (X.sel >= 0) selectProtein(-1, false);
    if (X.path) clearRoute();
    LBL.extra.forEach(L => { L.el.remove(); dropSprite(L); }); LBL.extra = [];
    $('#tip').style.opacity = 0;
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
    if (APP.t >= T_END) { APP.t = T_END; APP.enterExplore(); }
  }
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
  }
  K.U.uTime.value = tSet;
  GL.camera.updateMatrixWorld();
  updateLight(xr);
  updateSets(S, tSet, dt);
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
  buildStory(); buildSetLabels(); buildTimeline(); buildExplore(); bindCanvas(); xrSetup(); audioInit();
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
    if (ev.key === '/' && APP.mode === 'explore') { showTab('protein'); $('#q').focus(); ev.preventDefault(); }
  });
  APP.playing = !matchMedia('(prefers-reduced-motion: reduce)').matches;
  // the start screen pauses the story; picking this story again starts it from the top
  if (HOST.picking) APP.playing = false;
  window.addEventListener('storypause', () => { APP.playing = false; });
  window.addEventListener('storyrestart', () => { APP.enterStory(0); APP.playing = true; audioGesture(); });
  const hp = new URLSearchParams(location.hash.slice(1));
  if (hp.has('t')) { APP.t = clamp(parseFloat(hp.get('t')) || 0, 0, T_END - 0.01); APP.playing = false; }
  if (hp.has('explore')) {
    APP.enterExplore();
    // #lbi&explore&scene=atp&view=complex (any control of the scene by its key), or &q=TP53, &route=TP53,BRCA1
    if (hp.get('scene')) openScene(hp.get('scene'), false);
    const s = GL.sets[X.scene];
    for (const c of s.controls || []) if (hp.get(c.key)) setCtl(X.scene, c.key, hp.get(c.key));
    orbit.cur = view(X.scene, 'default'); orbit.to = null;
    if (hp.get('tab')) showTab(hp.get('tab'));
    if (hp.get('q')) { $('#q').value = hp.get('q'); runQuery(hp.get('q')); }
    if (hp.get('route')) { const [a, b] = hp.get('route').split(','); runRoute(findProtein(a), findProtein(b)); }
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
  // for tests and the browser console: HOST.cur.peek('NET.N')
  peek: src => eval(src),
  dispose() {
    try { audioStop(); if (AUD.ctx) AUD.ctx.close(); } catch (e) { /* already closed */ }
    if (GL.mo) GL.mo.disconnect();
    if (XR.session) XR.session.removeEventListener('visibilitychange', xrVisibility);
    if (GL.scene) GL.scene.traverse(o => {
      if (o.geometry) o.geometry.dispose();
      if (o.material) [].concat(o.material).forEach(m => { if (m.map) m.map.dispose(); if (m.uniforms) for (const u of Object.values(m.uniforms)) if (u.value && u.value.isTexture) u.value.dispose(); m.dispose(); });
    });
  },
};
});
